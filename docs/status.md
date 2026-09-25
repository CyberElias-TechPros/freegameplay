# Status report — what is actually done, verified, and not

Honesty contract: **Implemented** means the code exists in this branch. **Verified** means it was run in this environment and the result is recorded here. **Blocked** means a real external dependency prevents completion from this sandbox — each is listed with what unblocks it. Nothing below claims what was not run.

---

## 1. Implemented **and** verified (locally, end-to-end)

Verified on a local stack: local D1 (migrations applied), local R2, local KV, `wrangler dev` API on :8787, production `next build` + `next start` on :3000.

| Area | What was verified (actual results) |
|---|---|
| **Typecheck** | `npm run typecheck` → exit 0 across all three workspaces (`@fg/shared`, `@fg/api`, `@fg/web`), after every change. |
| **Unit tests** | `npm test` → **48 tests, 48 pass** (Node's built-in runner + type stripping, no extra dependency). Covers slug/legacy-URL helpers, Blogger XML + RSS/Atom parsing incl. idempotency and malformed-XML handling, and every input-validation rule shared by the write endpoints (email, `safePath`, `slugish`, spam heuristic, score plausibility, referrer/device bucketing). |
| **API E2E suite** | `node scripts/verify.mjs --local` → **ALL CHECKS PASSED (85 checks)**: content APIs, search, media, sitemap/robots, feed, contact + rate limit, admin auth/report/rollback/export, engagement flows, taxonomy archives, 404 shape. Re-runnable within an hour (the suite clears the rate-limit buckets it touches first). |
| **Frontend build** | `next build` → success, **20 routes**. |
| **Frontend runtime E2E** | Every route returns the right status and content: `/` (hero, ticker, stats, featured/latest games, blog, guides, categories, newsletter CTA), `/authors`, `/authors/elias` 200, `/authors/nobody` 404, `/tags`, `/tags/browser-games`, `/admin`, all content routes, `/nonexistent-page` 404. |
| **Real homepage (defect fixed)** | The homepage previously rendered the **categories** page (verified in the baseline: `/` returned `<title>Categories</title>`). `apps/web/src/app/page.tsx` is now a real landing page and verified to render hero + ticker + stats + featured/latest games + latest posts + latest guides + category grid + newsletter CTA. |
| **Leaderboards** | `GET /api/games/:slug/leaderboard` → top-10 best-per-player + the caller's own best and rank. `POST /api/games/:slug/scores` → `{ok, accepted, rank}`. Verified: implausible flood (999 999 pts in 1 s) rejected 422; a realistic Breakout run accepted; duplicate session+score → `{accepted:false, duplicate:true}`; `myBest`/`myRank` computed. External (iframe) games get an empty board and no score endpoint. |
| **Comments** | Submit → always `pending`, invisible publicly. Verified: approved comment appears, pending one does not; threaded replies attach only to approved parents; invalid target type 400, too-short body 400, unknown document 404; admin approve/reject/delete flips visibility. Author emails are stored for moderation but never rendered. |
| **Newsletter** | Double opt-in. Subscribe → `pending` + a confirmation link when no email provider is configured; confirm → `confirmed`; unsubscribe token works; bad email 400, bad token 400; admin CSV export verified. Delivery is gated behind `RESEND_API_KEY` + `NOTIFY_FROM`, so the whole flow works without keys. |
| **Analytics** | Cookie-free, IP-free. Beacon accepted (202); `/api/*` and `/media/*` paths reported `ignored`; protocol-relative paths sanitised to `/`; the admin report aggregates views/visitors/referrers/devices/days. No raw IP or User-Agent is persisted — only a daily-rotating salted hash. |
| **Author + tag archives** | `GET /api/content/authors` and `/api/content/tags` return items with `postCount`; detail endpoints return the author's/tag's posts; unknown slug → 404. Web routes `/authors`, `/authors/:slug`, `/tags`, `/tags/:slug` render correctly. |
| **SEO: legacy 308s** | Old Blogspot-shaped URL → `308` → new path, verified through the real Next middleware. 5 URLs checked after running the sample import, e.g. `/2024/05/the-golden-age-of-portal-games.html` → `/blog/the-golden-age-of-portal-games` and `/p/about-this-blog.html` → `/about-this-blog`. Unknown legacy URLs degrade gracefully (404 page, not a crash) when the API is down. |
| **SEO: sitemap/robots/feed** | `/sitemap.xml` 200 with all slugs **including `/authors/:slug` and `/tags/:slug`** + images; `/robots.txt` with Sitemap line; `/feed.xml` RSS 2.0. All same-origin via the web app. |
| **SEO: metadata** | Article pages carry `article:published_time` with the **original** date (verified: `2016-05-12T21:14:00.000Z` on an imported 2016 post), OG tags, JSON-LD (`VideoGame` on game pages). |
| **Blogger XML import** | Sample export → 2 posts + 1 guide + 1 page + 4 redirects, comments excluded and archived in the report, 3 unresolved media for rights review. Idempotent re-run: 0 created / N updated. |
| **RSS/Atom/Blogspot feed import** | RSS 2.0 fixture → 3 posts (one full, one summary-only with `EXCERPT_ONLY` warning, one 2021-dated), 3 redirects, 2 unresolved media. Blogspot feed fixture → 2 posts + 1 static page, original 2016/2017 dates preserved to the meta tags, 308s registered. Idempotent re-run verified. |
| **Feed URL mode + SSRF guard** | `POST /api/admin/import {"url": …}` fetches server-side; `127.0.0.1` and `file://` both rejected with clear 400s. |
| **Media pipeline** | 12/12 media uploaded to local R2; `/media/…` served with immutable cache headers; missing key → 404. |
| **Playable games** | All four built-in engines (breakout/dodge/snake/gravity) mount a real `<canvas>` on game pages with a live leaderboard; external games use the iframe embed path. |
| **Search** | FTS5 search returns posts/games/guides through the web `/search` page and API. |
| **Contact form** | Valid payload → 201, visible in `GET /api/admin/messages`; invalid → 400; rate-limited (5/hour/IP). Notification email sent when `NOTIFY_TO` is set, and never fails the submission. |
| **Content takedown** | `DELETE /api/admin/content/:kind/:slug` verified: removes the row, detaches tag links, deletes the game's scores, purges the affected KV cache entries, returns 200; unknown slug → 404; bad kind → 400; no token → 401. |
| **Ops: rate-limit reset** | `POST /api/admin/rate-limits/:name/reset` verified — clears one limiter's buckets. |
| **Admin auth** | Missing token → 401 on all admin routes. The token is compared in constant time, sent as `Authorization: Bearer` from `sessionStorage`, never baked into a bundle or a cookie. |
| **Security headers** | Verified present on every response: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, COOP. CORS is an explicit allowlist, not a wildcard. |
| **Ads (AdSense)** | 21 placements across home / list / article / guide / about / contact / privacy pages, responsive units, desktop-only above-the-fold banners, in-article units split at paragraph boundaries, in-feed units in the games grid and lists, sidebar rails on article/guide pages. No ads on game play pages or 404 (user-initiated-click policy). `/ads.txt` at root; privacy policy rewritten with full AdSense/cookie disclosure + opt-out links; Google Consent Mode v2 with an EEA/UK/CH-only banner. Gated on `NEXT_PUBLIC_ADSENSE_CLIENT`, so every slot renders a labelled placeholder until it is set. |
| **Cron + backups** | Hourly sitemap refresh + daily D1 dump → R2 (14-day retention) are implemented; the cron **triggers** are configured in `wrangler.jsonc` but were exercised only via the documented local manual trigger, not by real Cloudflare scheduling. |

---

## 2. Implemented, blocked from production verification

The sandbox has **no egress to Cloudflare** (verified repeatedly: TLS connections to `*.workers.dev` / Cloudflare APIs fail). So the production path is written and locally proven, but the actual Cloudflare resources were not created or deployed from here.

| Item | State | What unblocks it |
|---|---|---|
| **Cloudflare deployment** | Worker + D1 + R2 + KV not created on your account. `scripts/deploy.sh` provisions everything idempotently (8 ordered steps: provision → deploy → `migrate.mjs --remote` → secrets → media → seed → import → verify). | `npm ci` → run `scripts/deploy.sh` with `CLOUDFLARE_API_TOKEN` in the environment; rotate the token afterwards. |
| **Worker dry-run** | `npm run --workspace @fg/api dry-run` → `wrangler deploy --dry-run` succeeds locally: 468.74 KiB / gzip 101.89 KiB, all bindings resolved (D1, R2, KV, vars). Runs in CI without a Cloudflare account. | Already done — it is the API job in `.github/workflows/ci.yml`. |
| **Vercel deployment** | `apps/web` builds clean and is configured through `apps/web/next.config.ts` — the same file that drives local dev: `/api/*` and `/media/*` rewrites to `API_BASE`, CSP, HSTS, `X-Frame-Options`, `Permissions-Policy`, COOP and the immutable media cache. One config, both environments, no hardcoded hostnames. The Vercel project must have **Root Directory = `apps/web`** (that is how `main` already deploys). | Import the repo on Vercel with that root directory, then set `API_BASE` + `NEXT_PUBLIC_API_BASE` to the deployed worker URL and `NEXT_PUBLIC_SITE_URL` to the production domain. |
| **Production verification** | `verify.mjs --remote` exists for exactly this; not run because the remote backend does not exist yet. | Run it after deploy. |
| **DNS / custom domain** | — | Point the domain at the Vercel host; the API `SITE_URL` binding must match the final origin. |

---

## 3. Not implemented (honest gaps — not faked)

| Area | Note |
|---|---|
| **User accounts / author login** | There are no user accounts, sessions, or registration. This is a deliberate single-operator model: one editor, one `ADMIN_TOKEN`, entered at runtime into `sessionStorage` and sent as a bearer token. Readers never authenticate — leaderboards take a display name, comments take a name + email, the newsletter takes an email. A multi-author platform would need a users/sessions table, password or OAuth flows, and per-author permissions; none of that exists and none of it is stubbed. |
| **Content CRUD UI** | Games / posts / guides / pages are **import-driven**: they arrive via `scripts/seed.mjs`, a Blogger XML export, or a feed URL, and can be rolled back per run (`POST /api/admin/rollback`) or taken down individually (`DELETE /api/admin/content/:kind/:slug`). There is no in-browser WYSIWYG editor, no draft→publish state machine, and no media-upload-from-browser endpoint. Media is uploaded by `scripts/upload-media.mjs` or resolved during an import with `--download-media`. This is a real limitation, stated plainly rather than papered over. |
| **Tag / category management** | Tags and categories are created as a side effect of importing content. There is no endpoint to rename, merge, or delete them (deleting all content that uses one will leave an orphan tag row). |
| **Image optimization** | Media is served as stored (original quality, immutable cache). `next/image`-style responsive resizing would be a performance enhancement, not a correctness gap. |
| **i18n** | English only. The schema supports adding locales; there is no UI, no locale routing, and no translation pipeline. |
| **Error monitoring / uptime** | No Sentry/Datadog-style error reporting or external uptime checks are wired in. `GET /api/health` is the built-in liveness probe and is what `verify.mjs` asserts against. |
| **Backup restore tooling** | The cron writes daily D1 dumps to R2 with 14-day retention, but there is no script that restores one. The dump is a plain SQL file, so `wrangler d1 execute --file` would do it — that step is manual. |
| **Search quality** | FTS5 over titles/excerpts/bodies. No stemming, no synonyms, no typo tolerance, no result ranking beyond FTS5's built-in `rank`. |
| **Accessibility audit** | The UI uses semantic landmarks, labelled controls and visible focus styles, but it has not been run through a screen reader or an automated WCAG audit. |

---

## 4. How to run it locally (the exact sequence)

```bash
npm ci

# 1. Apply migrations (stop `wrangler dev` first — see the note below)
npm run db:local:init          # node scripts/migrate.mjs --local
npm run db:local:status        # both migrations should read "applied"

# 2. Start the API
npm run dev:api                # wrangler dev on :8787

# 3. Media, then seed content
npm run media:local            # 12/12 into local R2
npm run seed:local             # 8 games, 6 posts, 4 guides, 3 pages, …

# 4. Optional: exercise the import paths
npm run import:sample          # data/blogger/sample-export.xml

# 5. Verify, test, build
npm test                       # 48 unit tests
npm run verify:local           # 85 E2E checks
npm run build:web              # 20 routes
npm run dev:web                # :3000
```

Two environment quirks worth knowing:

- **Stop `wrangler dev` before running migrations.** `wrangler d1 execute --local` silently loses writes while the dev server is running, so migration bookkeeping appears to vanish.
- **Kill `next start` and delete `apps/web/.next` before rebuilding.** A stale server bound to :3000 plus a half-overwritten `.next` produces phantom 404s. `pkill -f "next start"` matches its own shell and reports success without killing anything — kill the `next-server` processes directly.

---

## 5. Cutover checklist (when you're ready)

1. **Do not delete the old Blogger site yet.** It stays up until the steps below pass.
2. Run `scripts/deploy.sh` from a machine with internet (provisions the CF backend, uploads media, seeds, imports the real Blogger export and/or feed, runs `verify --remote`).
3. Deploy `apps/web` to Vercel with the env vars above.
4. Verify in production: spot-check a dozen old URLs (should 308), search, one game (should be playable), `/feed.xml`, `/sitemap.xml`.
5. Check `/api/admin/report` for the real import run — review `EXCERPT_ONLY` warnings and the unresolved-media list (rights review).
6. Decide on media: keep remote `blogspot.com` / `blogger.googleusercontent.com` URLs (works, but the old site must stay up) or re-import with `--download-media` to bring Blogger-hosted images into R2 (then the old site can be parked safely).
7. Set the optional secrets you want, in this order — the app is complete without any of them:
   - `ADMIN_TOKEN` (generate one; `deploy.sh` does it if unset)
   - `ANALYTICS_SALT` (any long random string; rotates the visitor hash daily)
   - `RESEND_API_KEY` + `NOTIFY_FROM` (enables newsletter + contact notification emails)
   - `NOTIFY_TO` (where contact-form notifications go)
   - `NEXT_PUBLIC_ADSENSE_CLIENT` (enables real ad units instead of placeholders)
8. Point DNS at the new frontend. Keep the old blog accessible for a while after cutover; the 308 registry is the permanent record of old→new addresses.
9. Rotate the Cloudflare API token that was used.

---

## 6. Verification ledger (runs that produced the results above)

| Date | Command | Result |
|---|---|---|
| 2026-09-25 | `npm run typecheck` (3 workspaces) | exit 0, 0 errors |
| 2026-09-25 | `npm test` | 48 tests, 48 pass, 0 fail |
| 2026-09-25 | `node scripts/verify.mjs --local` | ALL CHECKS PASSED (85 checks), re-run confirmed |
| 2026-09-25 | `npm run build:web` | success, 20 routes |
| 2026-09-25 | `next start` :3000 status sweep | all routes correct (200/404 as expected) |
| 2026-09-25 | Security-header sweep | CSP / HSTS / X-Frame-Options / Permissions-Policy present |
| 2026-09-25 | Legacy Blogger URL sweep | 5 URLs → 308 through the web middleware, and the imported `/about-this-blog` page renders |
| 2026-09-25 | `npm run --workspace @fg/api dry-run` | 468.74 KiB / gzip 101.89 KiB, bindings resolved |
| 2026-09-25 | `scripts/import-blogger.mjs data/blogger/sample-export.xml` | posts=2, guides=1, pages=1, redirects=4, media unresolved=3 |
| 2026-09-25 | Engagement endpoint sweep (curl) | leaderboards, comments + moderation, subscribe/confirm/CSV, analytics beacons, admin overview all green |
| 2026-09-25 | Content-takedown sweep (curl) | import → read → delete → gone; 400/404/401 guards correct |
