# Roadmap baseline and risk register

**Reviewed:** 2026-10-27 · **Baseline:** `275c224` · **Scope:** repository source inspection, clean dependency installation, existing unit tests, TypeScript checks, dependency-advisory scan. This is not a penetration test, a visual/device audit, a legal opinion, or certification of a live deployment.

## Remediation update — 2026-10-28

The original findings below remain the **2026-10-27 historical baseline**, not a claim that all vulnerable paths still exist. Subsequent implementation is recorded here and in [current status](status.md). No penetration test, live exposure assessment, legal approval or production deployment has occurred.

| Risk | Current local remediation | Remaining gate |
|---|---|---|
| R01 private backups | Public image-key allowlist and encoded/private-key denial; distinct BACKUPS binding; tests through Worker/Next | Actual bucket policy, historical exposure/CDN copies, least-privilege provider access |
| R02 dependencies | Patched lockfile; clean install and current audit reports zero advisories; builds pass | Ongoing advisory/release monitoring and runtime threat review |
| R03 HTML/JSON-LD | Shared allowlist sanitizer on import/render; delimiter escaping; malicious fixtures | Review existing production content and broader browser vectors |
| R04 confirmation bypass | Explicit dev-only test links; hashed/expiring/single-use tokens; generic production responses; unsubscribe mail link | Live delivery, durable retries, email render/privacy review |
| R05 outbound fetch | Exact approved HTTPS hosts, validated redirects, timeout/byte caps | DNS/provider behavior and operator host approval; not a claim of arbitrary DNS-rebinding-proof fetching |
| R06 ads/consent | Reviewed flag and safer consent defaults; relative geo; no native ads | Approved CMP/markets/age policy, withdrawal cleanup and full network traces |
| R07 privacy/identity | Raw-IP rate keys replaced by keyed hashes; local-data reset and clearer copy | Proxy/NAT attribution, retention/deletion/privacy-owner review |
| R08 abuse/dedupe | Storage unique index and active-run duration; duplicate fixtures | Atomic rate limits, concurrent abuse testing, untrusted score/identity semantics |
| R09 caches | Versioned shared key helper; paginated invalidation; dynamic web no-store/timeouts | Takedown races, complete mutation matrix, production CDN behavior |
| R10 rollback | Unsafe implementation deleted; endpoint refuses with 409 | Exact provenance/before-images and conflict-aware reversal not implemented |
| R11 recovery/deploy | Versioned private JSON export, count manifest, D1 batch reads; isolated restore rehearsal; deploy plan-only + explicit apply/content opt-ins | Production-scale restore, media/config recovery, retention pagination/alerts, migration atomicity/checksums, live cloud workflow |
| R12 catalog | Four first-party playable titles; four commercial entries now editorial references; unreviewed iframes removed | Rights register, final catalog and provider approvals |
| R13 gameplay | Shared core; focus/Space/timing/RAF/Snake/Gravity/input fixes; mobile touch controls | Endurance, complete simulation tests and physical-device validation |
| R14 API/moderation | Comment targeting, contact bounds, deletion cleanup, CSV safety and response fixes | Complete runtime schema/negative cases, moderation operations and concurrency |
| R15 discovery/assets | Media normalization, filters/search/focus/library, metadata and failure improvements | Broad responsive/assistive-tech/crawl/performance validation |
| R16 configuration/docs | Explicit CORS, production secret guard, stricter production CSP, corrected runbooks and historical labels | External origin/security-header checks and approved operational ownership |
| R17 Android | Bundled four-game Capacitor project; hosted offline edition; local data/settings/native hooks; debug CI scaffold | Architecture/identity approval; native compile/lint, devices/signing/store testing |

Fresh evidence: **88 Node tests**, five workspace typechecks, nine browser journeys, Next/mobile builds, Worker dry-run, all local mutating API checks, six read-only smoke probes and a real local export→isolated SQLite restore. See [status](status.md) for exact scopes and [roadmap](implementation-roadmap.md) for partial/blocked task states. Browser offline success is not proof of native Android behavior. CI definitions are implemented, not evidence of a completed hosted workflow run.

## Historical audit follows

## Evidence rules

- **Observed:** directly visible in the inspected source; behavior still needs a regression test.
- **Verified now:** a command actually run on 2026-10-27, with its result below.
- **Historical:** reported by `docs/status.md` for 2026-09-25; not rerun in this review.
- **Unknown:** requires environment access, owner confirmation, devices, provider approval, or additional experiments.
- Severity describes release risk, not a CVSS score or proof of exploitation. The private-data path below warrants containment if any matching deployment is live; no live exposure has been established here.

## Verification ledger

| Check | Current result | Limit |
|---|---|---|
| `npm ci --no-fund --no-audit` | Passed; Node v22.22.3, npm 10.9.8 | Does not establish production compatibility |
| `npm test` | **48 passed, 0 failed** | Helpers/parsers only; not browser, Android, or infrastructure tests |
| `npm run typecheck` | Passed in shared, API and web workspaces | Static typing is not runtime validation |
| `npm audit --json` | Registry reported **8 vulnerable package entries: 1 critical, 6 high, 1 moderate** | Advisory flags require reachability analysis; not eight proven exploitable application defects |
| API integration suite | Historical report: 85 checks | Not rerun; mutation-heavy and unsafe to assume production-safe |
| Web build / runtime | Historical report: build + route checks | Not rerun; no new visual or gameplay verification claimed |
| Cloud deployment / DNS / email / ads | Unknown in this review | No live resource changes or external-provider verification performed |
| Android | No Android project found in checkout | No APK/AAB, device test, signing setup or store submission verified |

Registry-flagged packages: direct dependencies `next` (critical), `hono` (moderate), `wrangler` (high); transitive `miniflare`, `postcss`, `sharp`, `source-map-js`, `undici` (high). Preserve exact scan output in restricted CI evidence on remediation; rerun because advisory data changes. Do not apply `npm audit fix --force` without compatibility testing.

## Existing assets worth preserving

| Asset | Evidence | Why keep it / qualification |
|---|---|---|
| TypeScript workspaces | root `package.json`, `apps/*`, `packages/shared` | Shared contracts and parsers reduce duplicated work; Android can share contracts through generated schemas/clients |
| Content backend | `apps/api/src/worker.ts`, `routes/`, two SQL migrations | Hono + D1/FTS5 + R2 + KV are a coherent small-platform foundation; production isolation and safety are incomplete |
| Web experience | `apps/web/src/app`, components, fonts, stylesheet | Real Next.js pages and visual identity; keep brand while improving usability and performance |
| Four canvas games | `apps/web/src/components/engines` | Real engine implementations, not placeholders; control, lifecycle and edge-case repairs are needed |
| Search and archives | `routes/search.ts`, `taxonomy.ts`, corresponding web pages | Functional discovery foundation; ranking, filters and scale need work |
| Import and legacy mapping | shared parsers, `admin/import.ts`, import scripts, middleware | Valuable migration assets; rollback, sanitization and source-domain claims must be corrected |
| Engagement | comments, scores, subscribe, analytics, admin UI | Working scaffolding; trust, privacy, identity, reliability and reporting limitations remain |
| Automation | migrations, seed, upload, provision/deploy/verify scripts, CI | Useful starting point; recovery, integration tests and production safeguards need implementation |

## Findings → implementation work

Task references point to `implementation-roadmap.md`. “Acceptance” here states the regression evidence required, not a fix already delivered.

### R01 — Critical: private backups can traverse the public media handler

**Observed:** `worker.ts` writes `backups/db-YYYY-MM-DD.json` into `env.MEDIA`, including messages, subscribers and comments. `routes/media.ts` serves any existing key from that same binding without authentication or a public-prefix allowlist. It assigns public immutable cache headers. The web config also gives `/media/*` immutable caching.

**Impact:** if cron has produced a backup on a matching public deployment, private data and subscription tokens may be downloadable through the media route. A private R2 bucket alone does not fix an unauthenticated Worker proxy.

**Next:** separate private backup storage/bindings and reject non-public media prefixes; verify all encodings and aliases. If live, involve the operator/security lead, disable access, assess logs, purge CDN caches, invalidate affected tokens and evaluate notification obligations. Do not delete recovery copies blindly. **Tasks:** SEC.01–SEC.05; OPS backup work. **Acceptance:** synthetic private backup is inaccessible through both API and frontend; restore remains possible through restricted tooling.

### R02 — Critical gate: dependency advisory flags

**Verified now:** the registry scan above reports a critical flag on Next.js plus other flagged dependencies. Exploitability and deployment exposure have not been assessed. **Tasks:** SEC.06–SEC.08. **Acceptance:** supported patched dependency graph, clean regression/build checks, recorded triage for any remaining advisories; no unresolved reachable critical/high issue at release.

### R03 — High: imported HTML and JSON-LD lack a safe rendering boundary

**Observed:** `admin/import.ts` persists HTML; game/article/guide/static pages render it with `dangerouslySetInnerHTML`. `components/meta.tsx` injects `JSON.stringify(data)` directly into a script element without escaping `<`. The parser's `stripHtml` helper extracts text; it is not sanitization of stored article HTML. CSP currently allows inline scripts. Admin credentials live in same-origin session storage.

**Impact:** compromised or untrusted imported content can become stored script/markup injection; administrative import permission does not make external feed content safe. **Tasks:** SEC.09–SEC.13 and CMS sanitization. **Acceptance:** adversarial HTML/URL/JSON-LD fixtures cannot execute code, submit unexpected forms or steal same-origin data; existing legitimate content remains readable.

### R04 — High: newsletter ownership verification can be bypassed

**Observed:** `subscribe.ts` returns `confirmUrl` whenever `sendMail` returns `sent:false`, including provider failures, not just local development. Confirmation tokens have no expiry/consumption logic. Unsubscribe leaves the confirmation token usable, and confirm does not require pending status. Already-confirmed responses reveal subscription state despite the comment claiming otherwise.

**Tasks:** SEC.14–SEC.17 and COM.01–COM.09. **Acceptance:** production never exposes confirmation tokens; failed delivery retries safely; expired/used/pre-unsubscribe confirmation links cannot re-enroll a recipient; public responses do not enumerate membership.

### R05 — High: URL fetch safety checks are incomplete

**Observed:** `admin/admin.ts` checks the initial feed hostname then fetches with `redirect:"follow"`. Resolved IPs and redirect hops are not validated; the size check happens after buffering the entire body. The media fetch path also lacks a complete timeout/size/redirect policy. **Tasks:** SEC.18–SEC.20. **Acceptance:** private/loopback/link-local, IPv4-mapped IPv6, redirect-to-private, DNS-change, credentials-in-URL and oversized-stream cases are rejected with bounded resource use. Choose a realistic runtime-compatible egress design rather than claiming string checks solve DNS rebinding.

### R06 — High: consent/ad implementation is not a production compliance solution

**Observed:** `lib/ads.ts` uses `UK` but not `GB`; unknown geo falls into the grant path. Geo may call `NEXT_PUBLIC_API_BASE`, contradicting the same-origin browser contract and CSP. Shared bootstrap promise can prevent loading after a later acceptance. `AdUnit` does not push each mounted unit into `adsbygoogle`; its `pushed` ref is unused. Root `ConsentBanner` invokes bootstrap even on play/admin routes. `/api/geo` has public cache headers; the end-user geo behind the frontend proxy has not been proven. `/ads.txt` uses a `ca-pub-` identifier rather than a validated seller identifier format. Custom consent UI is not proof of a certified CMP or legal compliance.

**Tasks:** ADS phase. **Acceptance:** policy review using then-current provider requirements, correct default-denied behavior, revocable choices, no third-party requests on excluded routes, verified geo or a consent approach not dependent on unreliable geo, valid seller configuration and lifecycle tests. Ads remain off until this gate passes; Android monetization is a separate decision.

### R07 — High: privacy claims exceed implementation; identity conflates people

**Observed:** `lib/rate.ts` embeds raw IP strings in KV keys. `lib/identity.ts` is used for daily hashes; scores identify a caller through that hash rather than a durable browser identity. The score board groups by `player_name`, so unrelated people called ANON share one entry and renamed players can occupy multiple entries. NAT/proxy users may share a hash; new days change it. Server-to-server frontend proxy behavior requires testing.

**Tasks:** SEC.21–SEC.23; DATA; SCORE. **Acceptance:** accurate data inventory and retention disclosures, keyed limiter identifiers, trusted ingress attribution, stable optional player identity separate from display names, no use of daily analytics hashes as account/session authentication. Pseudonymous hashes are not automatically anonymous data.

### R08 — High: rate limits and score deduplication are race-prone

**Observed:** KV limiter does get/increment/put without atomic coordination. Daily count and score dedupe precede inserts without a unique database constraint. `elapsedMs` is optional and invalid/nonpositive timings can pass the plausibility helper; current tests explicitly permit absent timing. Client time and score cannot establish trustworthy competition.

**Tasks:** SEC.24–SEC.26; SCORE. **Acceptance:** concurrent requests obey chosen limits; idempotency is enforced by storage; casual boards are honestly labelled; no prizes or integrity guarantees without stronger server validation.

### R09 — High: cache invalidation does not match actual keys

**Observed:** home and tags use bare keys (`home`, `tags`), while `purgeContentCache` lists `home:`/`tags:` prefixes. Import sweeps `cache:` rather than all actual keys. Feed, sitemap, board and Next data/full-route caches have different lifecycles. KV listing helpers do not iterate cursors.

**Impact:** deleted/corrected/private content can remain visible, including after rights takedowns. **Tasks:** API.07–API.12. **Acceptance:** warm every cache layer, mutate/unpublish, prove the old item disappears within a documented bound; test more than one KV listing page and concurrent regeneration.

### R10 — High: import rollback is not exact job reversal

**Observed:** `rollbackJob` selects documents using source type and timestamp comparisons, not row IDs attributed to the run. SQLite default timestamps and ISO strings use different formats. Updates have no before-images; redirect/media/taxonomy changes are not restored. Audit records are persisted at the end and limited to 4,000 items, so partial failures can lack a complete trail. Endpoint is `/admin/rollback/:jobId`, not the JSON-body route claimed in older docs. Dry-run currently does not persist a run, despite the header comment implying one.

**Tasks:** MIG phase. **Acceptance:** interleaved jobs, partial failures, existing-document updates, later editor changes and rollback retries are tested against explicit per-item provenance; preview makes destructive scope visible.

### R11 — High: backup/restore and deployment promises need correction

**Observed:** cron produces **JSON**, not SQL; no restore tool exists. Cron export omits `migration_items` and migration bookkeeping; admin export also omits engagement tables. Whole-table accumulation is unbounded. Migration 0002 contains non-repeatable `ALTER TABLE` statements; runner bookkeeping writes are not checked. `deploy.sh` sources a dotenv-style file containing unquoted `NOTIFY_FROM`, uses `npm install`, deploys before migrations/secrets, and seeds every run. It does not import real Blogger content automatically. Provisioning names/env handling and provider response-shape assumptions need contract tests.

**Tasks:** API migrations; OPS; REL. **Acceptance:** sanitized production-sized restore rehearsal, interrupted migration recovery, safe repeated deployments without overwriting edited content, isolated environments and explicit deployment approvals.

### R12 — High product risk: the catalog overpromises playability

**Observed:** seed data includes built-in games and non-browser/editorial entries. `GameCard` calls any non-builtin item “External play,” including entries without an embed. Game details infer external play from a URL instead of a validated capability model. Current CSP blocks arbitrary external frames and remote Blogger images. JSON-LD declares every game free and browser-based regardless of actual availability.

**Tasks:** CAT; WEB; SEO. **Acceptance:** “Play now” only appears for tested supported games; editorial/commercial references are clearly separated; rights, price, provider and device capability labels match reality. Do not solve this by widening CSP to every domain.

### R13 — High product risk: mobile and repeat-run gameplay are incomplete

**Observed:** Gravity uses keyboard thrust without touch movement hooks; pause is displayed as text rather than a touch button. Core keyboard handlers are global and consume arrows/space while a player may be typing. Space toggles pause before Breakout's launch hook. `GameEngine` sets its start timestamp only once, not for each replay, and elapsed wall time includes pauses. RAF continues drawing while paused/over. Pointer cancellation/focus loss need lifecycle handling. Snake food placement loops forever if the board fills.

**Tasks:** GAME phase. **Acceptance:** all four games playable start-to-finish on touch-only devices and keyboard, with accessible controls, isolated focus, accurate active-play timing, deterministic edge tests and no background render-loop leak.

### R14 — Medium/high: API validation and moderation invariants

**Observed:** contact code calls `.trim()` on unvalidated values. Many endpoints cast incoming JSON to TypeScript types rather than enforce schemas. Comment parent lookup checks slug/status but not target type; two document types with the same slug can be mixed. Content deletion leaves slug-linked comments; reusing a slug risks reattaching old discussions. Response contracts drift: migration report rows are cast snake_case→camelCase rather than mapped; subscriber totals count only the capped result set.

**Tasks:** API; COM; CMS. **Acceptance:** wrong-type input returns controlled 4xx, all list totals are database totals, parent/target constraints are enforced, delete/recreate cannot leak old discussion, response contract tests match clients.

### R15 — Medium/high: discoverability, assets and failure UX

**Observed:** `resolveMedia('/media/covers/x.jpg')` produces `/media/media/covers/x.jpg`; seed and import paths use the already-prefixed form. Upload keys are filenames, not content hashes despite immutable-cache claims. Games filters derive genres from the current page rather than API facets; pagination drops sort. `[page]/generateStaticParams` emits `slug` rather than `page`. Several outage states return visitor-facing developer instructions. JSON-LD, canonical coverage and rich-result eligibility need validation rather than assumptions.

**Tasks:** CAT media; WEB; SEO. **Acceptance:** every seed image loads from one canonical path; updated media has versioned URLs; filtering/pagination is stable; build and outage recovery are tested with a real local backend.

### R16 — Medium: security configuration and documentation drift

**Observed:** Worker CORS is `origin:["*"]`, despite documentation asserting an explicit allowlist. DELETE is omitted from allowed methods. This is not itself an authentication bypass, but the intended boundary is unclear. Admin token handling has duplicated checks; same-origin script access remains a concern. CI does not run browser/API integration suites, and its secret pattern ignores some paths and can print matching secret lines.

**Tasks:** SEC; QA; DOC. **Acceptance:** documented CORS policy tested for all intended clients, admin access isolated, CI redacts findings, and claims reflect code and evidence.

### R17 — New platform: Android must be designed, not asserted

**Observed:** no Android/Capacitor/TWA project, manifest/service worker, store assets, signing pipeline, native lifecycle integration or device test suite is present. A responsive page is not an Android release. **Tasks:** ADR, PWA, AND, STORE. **Acceptance:** a signed tested artifact and approved distribution path; no promise of store acceptance or offline support for arbitrary external games.

## Changes delivered by this review

Planning artifacts and entry-point documentation only. **No listed application defect is fixed by creating the roadmap.** Existing code and production resources have not been changed by this review. Runtime remediation must receive its own reviewed implementation and regression evidence.
