# FreeGameplay

Four first-party browser games, a gaming-content website and a bundled Android/Pocket Arcade client. No account is required to play.

**Implementation update — 2026-10-28:** security containment, backend fixes, shared gameplay, mobile/offline foundations and release tooling have been implemented and locally tested. **This is not a production release or completion of all 430 roadmap tasks.** See [current status and evidence](docs/status.md), [roadmap](docs/implementation-roadmap.md), [task spreadsheet](docs/implementation-tasks.csv) and [historical audit + remediation update](docs/roadmap-audit.md).

## Repository

| Path | Purpose |
|---|---|
| `apps/api` | Hono/Cloudflare Worker; D1 content/engagement; public R2 media; separate private R2 backups; KV cache |
| `apps/web` | Next.js website, content/search, four games, browser-local favorites/history |
| `apps/mobile` | React/Vite Pocket Arcade, hosted offline-capable edition and Capacitor Android project |
| `packages/game-core` | Shared Breakout, Dodge, Snake and Gravity engines; run clock |
| `packages/shared` | Types, content parsers, HTML sanitization and security helpers |
| `scripts` | Local setup, read-only smoke, imports, explicit deployment and isolated restore rehearsal |
| `tests` | Unit, Worker/SQLite integration, restore and Playwright journeys |

## Local setup

Use **Node 22.13+** (`.nvmrc` selects Node 22). No cloud credentials are needed. Run commands from the repository root. Server-side loopback URLs below are sandbox-internal; browser requests use same-origin `/api` and `/media` rewrites.

```bash
npm ci

# Generate local-only secrets; do not commit or paste them into chat.
node --input-type=module - <<'JS'
import fs from 'node:fs'; import {randomBytes} from 'node:crypto';
fs.writeFileSync('apps/api/.dev.vars', [
  `ADMIN_TOKEN=${randomBytes(32).toString('hex')}`,
  `ANALYTICS_SALT=${randomBytes(32).toString('hex')}`,
  'SITE_URL=http://localhost:3000',
  'APP_ENV=development', 'ALLOW_TEST_EMAIL_LINKS=1'
].join('\n')+'\n', {mode:0o600,flag:'wx'});
JS

# Stop the local Worker before applying schema changes.
npm run db:local:init
npm run db:local:status          # 0001, 0002, 0003 applied
npm run dev:api                  # terminal 1, :8787
```

In another terminal, with the API ready:

```bash
npm run media:local              # uploads the 12 bundled media files
npm run seed:local               # mutates local content; safe only on disposable data
npm run dev:web                  # terminal 2, :3000, binds 0.0.0.0
```

For a proxied preview, set `SITE_URL` to the approved preview web origin if testing email links/CORS. `API_BASE=http://127.0.0.1:8787` is a **server-only** local default; never put loopback service addresses in browser fetch calls. The frontend rewrites API/media calls to this backend.

## Pocket Arcade / Android

```bash
npm run build:mobile
npm run preview --workspace @fg/mobile   # :4173, binds 0.0.0.0
npm run android:sync                     # build + copy assets/plugins to native project
```

Pocket Arcade contains all four games, local favorites/bests, search, instructions, share and local-data reset. It makes no content API calls and contains no ads, analytics, accounts or notifications. The hosted edition precaches **only its own static assets**; offline reload needs one successful online cache install. Updates wait until existing tabs close. The Android edition uses packaged assets, not a remote website or service worker.

Native source uses provisional ID `site.freegameplay.app`, minSdk 24, compile/target SDK 36, Gradle 8.14.3 and Java 21 in the manual CI workflow. **No native build/device/signing result is claimed here:** Java/Android SDK were unavailable in this sandbox. See [mobile release checklist](docs/mobile-release.md). The workflow creates a debug APK only and does not publish anything.

## Verification and command safety

| Command | Scope / side effects |
|---|---|
| `npm test` | Node tests, real in-memory SQLite; no production writes |
| `npm run typecheck` | Five workspaces |
| `npm run build:web` | Next production build; may read configured content API |
| `npm run build:mobile` | Static mobile build and content-versioned offline cache manifest |
| `npm run --workspace @fg/api dry-run` | Bundle Worker without deploying |
| `npm run verify:local` | **Mutates local test data and resets local limiter buckets**; refuses remote mode |
| `npm run smoke -- https://your-approved-origin` | Read-only public API/media/auth-boundary probes; no credentials |
| `npm run test:browser` | Requires seeded API/web and built mobile preview on 8787/3000/4173; synthetic gameplay/local browser state |
| `npm audit` | Current registry advisory scan, not a penetration test |
| `npm run deploy` | Prints a plan only; no cloud writes |
| `node scripts/restore-backup.mjs backups/export.json` | Isolated in-memory SQLite rehearsal; never writes a remote DB |

Do not run Next dev and production build concurrently against the same `.next` directory; restart dev after building. Playwright's Linux browser runtime comes from the pinned Chromium package; other OS setups may need a locally installed compatible Chromium and adjusted launcher configuration.

## Security and operational behavior

- HTML is allowlist-sanitized at import and rendering boundaries; JSON-LD delimiters escaped; CSV formulas neutralized.
- Public media accepts approved image paths, refuses backup/private keys and uses short revalidatable caching. Backups use a **separate `BACKUPS` binding**, never `MEDIA`.
- Production fails closed without `ADMIN_TOKEN` and `ANALYTICS_SALT`. CORS uses explicit origins. Rate keys contain keyed hashes rather than raw IPs; KV limiting is **not atomic** and proxy identity needs production validation.
- Newsletter requires a configured provider in production. Test confirmation links require both local-development flags. Confirmation tokens are hashed, expiring and single-use; confirmation mail includes unsubscribe. Provider failure returns no token; reliable retry delivery is still pending.
- Scores are deduplicated and use active-run durations, but client-supplied scores are **untrusted**, not verified competitive rankings.
- The former destructive per-run rollback endpoint now returns **409**. Use reviewed isolated recovery, not timestamp-based deletion. See [recovery runbook](docs/recovery.md).
- Four commercial-title catalog entries are editorial references, not free playable games. Unreviewed third-party embeds are disabled.
- Ads stay off unless publisher configuration, explicit reviewed flag and consent gates allow them. These switches do **not** certify CMP/legal compliance; withdrawal/network behavior still needs review.

## Deployment — approval required

Use `.env.example` as a configuration inventory, not production-ready values. Do not share credentials. Configure provider secrets through approved secret storage. Deployment requires explicit `CLOUDFLARE_ACCOUNT_ID`, token, canonical HTTPS `SITE_URL`, strong `ADMIN_TOKEN` and `ANALYTICS_SALT`.

```bash
npm run deploy                         # inspect plan; safe default
# After backup, isolated staging, security/rights/legal review and owner approval:
npm run deploy -- --apply               # remote mutations: provision/migrate/deploy/secrets/smoke
# --seed and --upload-media are separate opt-ins; never silently overwrite live content.
```

The script is **not cloud-verified** and is not atomic. Stop on failure and inspect actual resources before retrying. Resource names are intentionally fixed; custom staging naming requires reviewed configuration. Migration bookkeeping fails closed but is not checksummed/transactionally coupled to schema execution. Take a provider backup before remote migration; do not replay a partially applied ALTER migration blindly.

Frontend hosting uses root `apps/web`, the Next.js preset and approved `API_BASE`/`NEXT_PUBLIC_SITE_URL`. Validate final DNS, rewrites, CSP and both origins before traffic cutover. Production uses stricter frame/CSP settings than local previews. No cloud deployment or DNS change was made by this implementation.

## Still open

Audience/age/market decisions; content rights and legal approvals; live exposure assessment; atomic abuse controls; trusted proxy attribution; complete migration provenance/reversal; production-scale recovery/retention; monitoring/alerts; physical-device accessibility/performance tests; signed Android release/store review. Accounts, sync, payments, native ads and push remain conditional, not hidden placeholders.
