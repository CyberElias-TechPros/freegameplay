# FreeGameplay

Free browser games you can actually play, plus the guides and writing around them — on real infrastructure, not a template.

**Stack (by design, nothing more):** Cloudflare Workers (Hono) + D1 (SQLite/FTS5) + R2 (media) + KV (cache) as the content backend, and a bespoke Next.js frontend on Vercel. The frontend is not generic: custom design system, four playable built-in canvas games, live best-scores, and a migration pipeline that carries an old Blogger/Blogspot site — URLs, dates, authors and labels — onto the new platform with 308 redirects instead of dead links.

> **Status is documented honestly in [docs/status.md](docs/status.md)** — what is verified, what is blocked on Cloudflare egress (the sandbox can't reach it), and what is deliberately not built.

## Monorepo layout

```
apps/api        Cloudflare Worker — content API, admin API, media, search, sitemap/robots/feed
apps/web        Next.js frontend (Vercel) — bespoke UI, playable games, SEO layer
packages/shared Shared types + parsers (Blogger export, RSS/Atom feeds, legacy-URL slugs)
scripts/        seed, upload-media, import-blogger, import-feed, verify, provision, deploy
data/           seed content, media (committed for reproducible local runs), sample import fixtures
docs/           importing-content.md · status.md
```

## Local development (full stack, no Cloudflare account needed)

```bash
npm ci

# 1. API on :8787 with local D1/R2/KV (wrangler)
cd apps/api
printf 'ADMIN_TOKEN=%s\nSITE_URL=http://localhost:3000\n' "$(openssl rand -hex 24)" > .dev.vars
npx wrangler d1 execute freegameplay-db --local --file migrations/0001_init.sql
npx wrangler dev --port 8787 --ip 0.0.0.0

# 2. Load content (in apps/api or repo root)
node scripts/upload-media.mjs --local
node scripts/seed.mjs --local
node scripts/import-blogger.mjs data/blogger/sample-export.xml --local   # optional demo import

# 3. Verify the API end-to-end
node scripts/verify.mjs --local        # → ALL CHECKS PASSED

# 4. Frontend on :3000
cd ../web
API_BASE=http://127.0.0.1:8787 NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787 NEXT_PUBLIC_SITE_URL=http://localhost:3000 npx next build
API_BASE=http://127.0.0.1:8787 NEXT_PUBLIC_SITE_URL=http://localhost:3000 npx next start -p 3000
```

## Importing content (Blogger, Blogspot, any feed)

Four input paths, one idempotent pipeline, dry-run first, 308s for old URLs, original dates preserved, images held for rights review:

```bash
# your old Blogspot blog — no login needed (full content lives in the feed)
node scripts/import-feed.mjs "https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500" --dry-run
node scripts/import-feed.mjs "https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500"

# a Blogger XML export (Settings → Export blog data)
node scripts/import-blogger.mjs export.xml --dry-run && node scripts/import-blogger.mjs export.xml

# any RSS 2.0 / Atom feed (this site serves /feed.xml too — re-importable)
node scripts/import-feed.mjs https://example.com/feed --dry-run
```

Full contract, guarantees and troubleshooting: **[docs/importing-content.md](docs/importing-content.md)**.

## Production deployment

Requires a machine with internet egress to Cloudflare (this repo was developed in a sandbox without it).

```bash
export CLOUDFLARE_API_TOKEN=…     # the user's token — rotate afterwards
node scripts/deploy.sh            # provision D1/R2/KV, deploy worker, upload media, seed, import, verify --remote
```

Then deploy `apps/web` on Vercel (Next.js preset) with `API_BASE` / `NEXT_PUBLIC_API_BASE` = the worker URL and `NEXT_PUBLIC_SITE_URL` = the final domain. Cutover checklist, including keeping the old Blogger site up until then: **[docs/status.md §4](docs/status.md)**.

## Operations

- **Admin API** (Bearer `ADMIN_TOKEN`): `GET /api/admin/health|report|messages|export`, `POST /api/admin/import` (dry-run via `x-dry-run`), `POST /api/admin/rollback {jobId}`.
- **Cron**: hourly sitemap refresh, daily 04:00 D1 dump → R2 (14-day retention).
- **Public**: `POST /api/contact` (rate-limited 5/hour/IP), `GET /api/search`, `/sitemap.xml`, `/robots.txt`, `/feed.xml`.

## What is (not) in scope

**Monetisation**: AdSense — the full unit inventory from the old site is mapped in `apps/web/src/lib/ads.ts` (21 placements, responsive units, desktop-only top banners, in-article/in-feed/sidebar slots). Set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` to go live; without it, slots render labelled placeholders and no ad script loads. Compliance: `/ads.txt`, ad-disclosing privacy policy, Consent Mode v2 with an EEA/UK/CH-only banner. No ads on game play pages or 404s.

Not built (deliberate): public comments (Blogger comments are archived, not imported), analytics, i18n, leaderboards, newsletter. Omissions and the roadmap live in [docs/status.md §3](docs/status.md).
