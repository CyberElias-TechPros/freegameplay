# Importing content

Everything the old site has can be brought into the new platform. Four input paths, one pipeline, one contract.

## The four input paths

| Path | What you give it | When to use it |
|---|---|---|
| **Blogspot feed (recommended for Blogger)** | One public feed URL — no login, no export | Pulling the old Blogspot blog in. Blogger feeds carry **full post HTML** in `<content:encoded>`, so the feed alone is enough. |
| **Blogger XML export** | `Settings → Export blog data` file (`.xml`, zip) | When you also want pages, settings, and a permanent local copy. The feed is usually sufficient; the export is the more complete artifact. |
| **Any RSS 2.0 / Atom feed** | Feed URL or a saved `.xml` file | Other old blogs, a WordPress site (`/feed`), a Ghost/Medium/Feedburner feed, or **this site's own feed** (`/feed.xml`) when moving again in the future. |
| **JSON records** | `{ "records": { … } }` body | Hand-curated content, programmatic imports, or content that only exists in a database elsewhere. |

## Recommended workflow (always the same four steps)

```bash
# 1. Dry run — parses, maps, reports. Writes nothing.
node scripts/import-feed.mjs "<feed-url-or-file.xml>" --dry-run          # feeds
node scripts/import-blogger.mjs export.xml --dry-run                    # Blogger XML export

# 2. Read the report: entry→slug mapping, EXCERPT_ONLY / NO_DATE / DUPLICATE warnings,
#    unresolved media count, redirects that would be created.

# 3. Real import (idempotent — safe to re-run, updates in place)
node scripts/import-feed.mjs "<feed-url-or-file.xml>"
# add --download-media to also pull Blogger-hosted images into R2 (see media below)

# 4. Verify + keep the receipt
node scripts/verify.mjs --local        # or --remote in production
# GET /api/admin/report → the migration report (per-item created/updated/failed)
# GET /api/admin/export → full JSON of what's in the DB (your rollback source)
```

Everything is also available as admin API calls (same logic, for UI or automation):

```bash
# raw XML or { "xml": "…" } or { "url": "https://…" } (server-side fetch, SSRF-guarded)
curl -X POST "$API/api/admin/import" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-dry-run: 1" \
  -H "x-import-meta: {\"kind\":\"rss\",\"sourceLabel\":\"old-blog\"}" \
  -d '{"url":"https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500"}'
```

`x-dry-run: 0` (or omit) performs the import. Rollback for any run: `POST /api/admin/rollback { "jobId": "…" }`.

## Pulling the old Blogspot blog (zero login)

```
https://<your-blog>.blogspot.com/feeds/posts/default?alt=rss&max-results=500
```

That's the whole move:

```bash
node scripts/import-feed.mjs "https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500" --dry-run
# inspect, then:
node scripts/import-feed.mjs "https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500"
```

What arrives, intact:

- **Full post content** — Blogger puts the complete HTML in `<content:encoded>`; the import uses it verbatim.
- **Original publish dates** — used as `published_at` and as the `article:published_time` meta, so the archive keeps its timeline.
- **Original URLs** — every entry's link is normalized and registered in the legacy-URL registry → **308 Permanent Redirect** from the old Blogspot URL to the new path. Old bookmarks, search results and inbound links keep working.
- **Authors** (`dc:creator`) and **labels** (categories) — matched by slug, created if missing.
- **Static pages** — entries whose URL is a `/p/…` page land in `pages`, not `blog`.

Blogger's default Atom feed (`/feeds/posts/default`, no `alt=rss`) is also understood and is routed to the dedicated Blogger parser, which additionally supports the full XML export.

Feeds that only carry summaries (many WordPress/Feedburner feeds do this) still import — each summary-only entry gets an explicit `EXCERPT_ONLY` warning in the dry-run report so you know exactly which posts may be truncated.

## What the import guarantees (same contract as the Blogger path)

- **Idempotent.** Content is keyed by its source id (feed `guid`/entry id, Blogger post id). Re-running updates in place; nothing duplicates. Dry-runs write nothing at all.
- **No blind image downloads.** Images referenced by imported content are recorded as **unresolved media** with a rights note. You review them, then either keep the remote URLs as-is or re-import with `--download-media` (which only downloads Blogger-hosted media into R2 — your own property).
- **Dates preserved.** No post is re-dated to "today".
- **URLs preserved.** Legacy URL registry + 308s, not a soft-redirect gamble.
- **Comments stay out.** Blogger comments are archived in the migration report only — they are not imported into the new site (the platform has no public comment system; see status doc).
- **Reversible.** Every run is a `migration_runs` row with per-item stats; `POST /api/admin/rollback {jobId}` removes exactly what that run created.

## JSON records (for everything that has no feed)

`POST /api/admin/import` with:

```json
{
  "records": {
    "categories": [{ "slug": "arcade", "name": "Arcade" }],
    "tags": [{ "slug": "retro", "name": "Retro" }],
    "authors": [{ "slug": "elias", "name": "Elias" }],
    "games":   [{ "slug": "vector-breakout", "title": "Vector Breakout", "description": "<p>…</p>" }],
    "posts":   [{ "slug": "…", "title": "…", "contentHtml": "<p>…</p>", "publishedAt": "2016-05-12T21:14:00Z", "legacyUrl": "/2016/05/….html" }],
    "guides":  [], "pages": [], "media": []
  }
}
```

`legacyUrl` (optional) is what powers the 308 — set it for anything that had an old address.

## Outgoing: this site's own feed

The platform serves **`/feed.xml`** (RSS 2.0, full post content, RFC 822 dates, cached 5 min). Subscribe readers, and — if this site is ever migrated again — point `import-feed.mjs` at it. The feed is declared in `<head>` (`<link rel="alternate" type="application/rss+xml">`) and linked from the footer.

## Troubleshooting

| Symptom | Meaning |
|---|---|
| `EXCERPT_ONLY` warnings | The feed carries summaries for those entries. Content will be shorter than the originals — either accept it, or find the source with full content (Blogger exports always have it). |
| `DUPLICATE_ENTRY` | Two entries share a `guid`/id; the later one was skipped. |
| `NO_DATE` | Entry had no parseable date; the import time was used. |
| `Feed URL rejected: private address not allowed` | The `{ "url" }` mode refuses localhost/private ranges by design (SSRF guard). Save the feed to a file and import it locally instead. |
| Feed fetch fails over the internet | Server-side fetch needs egress. From a machine without internet, `curl` the feed to a file first, then import the file. |
| A post's slug looks off | Slugs come from the feed's URL (last path segment, `.html` stripped), falling back to the title. You can fix slugs in the DB or re-import corrected records — legacy URLs are keyed separately, so redirects stay stable. |
