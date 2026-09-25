# Status report — what is actually done, verified, and not

Honesty contract: "Implemented" means the code exists in this branch. "Verified" means it was run in this environment and the result is recorded here. "Blocked" means a real external dependency prevents completion from this sandbox — each is listed with what unblocks it. Nothing below claims what was not run.

## 1. Implemented **and** verified (locally, end-to-end)

Verified on a clean local stack: fresh local D1 (migrations applied), local R2, local KV, `wrangler dev` API on :8787, production `next build` + `next start` on :3000.

| Area | What was verified (actual results) |
|---|---|
| **Backend build** | `tsc --noEmit` clean for both workspaces (API + web), repeatedly, after every change. |
| **API E2E suite** | `node scripts/verify.mjs --local` → **ALL CHECKS PASSED** (33 checks: content APIs, search, media, sitemap/robots, feed, contact + rate limit, admin auth/report/rollback, 404 shape). Run after the RSS feature, on a fresh DB. |
| **Frontend build** | `next build` → success, 16 routes, type-check included in build. |
| **Frontend runtime E2E** | All pages 200 with content markers (home, games list, each game, blog, each post, guides, categories, search, about/contact/privacy, 404 for unknown). |
| **SEO: legacy 308s** | Old Blogspot-shaped URL → `308` → new path, verified through the real Next middleware (e.g. `/2016/05/why-i-built-my-first-browser-game-in.html` → `/blog/why-i-built-my-first-browser-game-in`). Works for game and post URLs; unknown legacy URLs degrade gracefully (404 page, not a crash) when the API is down. |
| **SEO: sitemap/robots** | `/sitemap.xml` 200 with all slugs + images; `/robots.txt` with Sitemap line; both same-origin via the web app. |
| **SEO: metadata** | Article pages carry `article:published_time` with the **original** date (verified: `2016-05-12T21:14:00.000Z` on an imported 2016 post), OG tags, JSON-LD (`VideoGame` on game pages). |
| **Blogger XML import** | Sample export → 2 posts + 1 guide + 1 page + 4 redirects, comments excluded and archived in the report, 3 unresolved media for rights review. Idempotent re-run: 0 created / N updated. |
| **RSS/Atom/Blogspot feed import (new)** | RSS 2.0 fixture → 3 posts (one full, one summary-only with `EXCERPT_ONLY` warning, one 2021-dated), 3 redirects, 2 unresolved media. Blogspot feed fixture → 2 posts + 1 static page, original 2016/2017 dates preserved to the meta tags, 308s registered. Idempotent re-run verified. |
| **Feed URL mode + SSRF guard (new)** | `POST /api/admin/import {"url": …}` fetches server-side; `127.0.0.1` and `file://` both rejected with clear 400s. |
| **Outgoing feed (new)** | `/feed.xml` on both API and web app: RSS 2.0, 13 items, full `content:encoded`, RFC 822 dates, `<link rel="alternate">` in `<head>`, footer link. |
| **Media pipeline** | 12/12 media uploaded to local R2; `/media/…` served with immutable cache headers; missing key → 404. Two post featured images verified as `image/jpeg` through the web app. |
| **Playable games** | All four built-in engines (breakout/dodge/snake/gravity) mount a real `<canvas>` on game pages with live best-score (`localStorage`); external games use the iframe embed path. |
| **Search** | FTS5 search returns posts/games/guides through the web `/search` page and API. |
| **Contact form** | Valid payload → 201, visible in `GET /api/admin/messages`; invalid → 400; rate-limited (5/hour/IP). |
| **Admin auth** | Missing token → 401 on all admin routes; server-side only. |
| **Cron + backups** | Hourly sitemap refresh + daily D1 dump → R2 (14-day retention) are implemented; the cron **triggers** are configured in `wrangler.jsonc` but were exercised only via the documented local manual trigger, not by real Cloudflare scheduling. |

## 2. Implemented, blocked from production verification

The sandbox has **no egress to Cloudflare** (verified repeatedly: TLS connections to `*.workers.dev` / Cloudflare APIs fail). So the production path is written and locally proven, but the actual Cloudflare resources were not created or deployed from here.

| Item | State | What unblocks it (all from your machine, credentials already in place) |
|---|---|---|
| **Cloudflare deployment** | Worker + D1 + R2 + KV not created on your account. `scripts/deploy.sh` provisions everything idempotently, then seeds + imports + verifies against the real backend. | `npm ci` → run `scripts/deploy.sh` (it reads `CLOUDFLARE_API_TOKEN` from env — the token you provided; rotate it afterwards). |
| **Vercel deployment** | `apps/web` builds clean and is configured for Vercel (`next build`/`next start`). | Import the repo on Vercel, framework preset Next.js, set `API_BASE` + `NEXT_PUBLIC_API_BASE` to the deployed worker URL, `NEXT_PUBLIC_SITE_URL` to the production domain. |
| **Production verification** | `verify.mjs --remote` exists for exactly this; not run because the remote backend does not exist yet. | Run it after deploy. |
| **DNS / custom domain** | — | Point the domain at the Vercel host; the API `SITE_URL` binding must match the final origin. |

## 3. Not implemented (roadmap — deliberately not faked)

| Area | Note |
|---|---|
| **Public comments** | Blogger comments are archived in migration reports only. The platform has no comment system; if wanted, it's a new feature (storage + moderation + abuse protection), not a migration setting. |
| **Analytics** | No analytics bundled (privacy-first default). A first-party events table or a lightweight self-hosted counter is a candidate feature. |
| **i18n** | English only; schema supports adding locales, no UI. |
| **Leaderboards / multiplayer** | Out of scope for the migration; the game engine contract would need a server-side score pipeline. |
| **Newsletter / email** | Not implemented (no ESP configured). Contact form is the only inbound channel. |
| **GDPR cookie banner** | No cookies are set at all (only `localStorage` best-scores), so no banner is *required*; if analytics or ads are ever added, consent handling must be added with them. |
| **Ads** | Deliberately none. |
| **Image optimization** | Media is served as stored (original quality, immutable cache). `next/image`-style responsive resizing would be a perf enhancement, not a correctness gap. |

## 4. Cutover checklist (when you're ready)

1. **Do not delete the old Blogger site yet.** It stays up until the steps below pass.
2. Run `scripts/deploy.sh` from a machine with internet (provisions CF backend, uploads media, seeds, imports the real Blogger export +/or feed, runs `verify --remote`).
3. Deploy `apps/web` to Vercel with the env vars above.
4. Verify in production: spot-check a dozen old URLs (should 308), search, one game (should be playable), `/feed.xml`, `/sitemap.xml`.
5. Check `/api/admin/report` for the real import run — review `EXCERPT_ONLY` warnings and the unresolved-media list (rights review).
6. Decide on media: keep remote `blogspot.com`/`blogger.googleusercontent.com` URLs (works, but the old site must stay up) or re-import with `--download-media` to bring Blogger-hosted images into R2 (then the old site can be parked safely).
7. Point DNS at the new frontend. Keep the old blog accessible for a while after cutover; the 308 registry is the permanent record of old→new addresses.
8. Rotate the Cloudflare API token that was used.

## 5. Verification ledger (runs that produced the results above)

- `verify.mjs --local`: **ALL CHECKS PASSED** — fresh D1, after RSS feature (2026-09-25).
- `next build`: success, 16 routes (2026-09-25).
- Frontend E2E via `next start` (:3000) against local API (:8787): 15/15 pages 200 + SEO/308/404/feed spot checks (2026-09-25).
- Feed imports: RSS fixture (3 posts, idempotent re-run 0/3), Blogspot fixture (2 posts + 1 page, original dates to meta) (2026-09-25).
- tsc: 0 errors, both workspaces, final state.
