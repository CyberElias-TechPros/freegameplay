# Architecture decisions — implementation candidate

2026-10-28. **Provisional; owner/security approval pending.** These notes explain current code, not approved store or infrastructure commitments.

## Boundaries

```text
Browser ─ same-origin /api + /media ─ Next rewrites ─ Worker
  │                                               ├─ D1 content / engagement
  ├─ local favorites + recent games                ├─ KV public cache / hashed rate keys
  └─ @fg/game-core                                 ├─ MEDIA (public image allowlist)
                                                  └─ BACKUPS (admin/cron only)

Android packaged assets / hosted Pocket Arcade
  ├─ React browse / saved / help / settings
  ├─ @fg/game-core (same four engines)
  ├─ local favorites + personal bests
  └─ minimal native app-state / back / share plugins
       No content API, accounts, analytics, ads or notification dependency
```

The backend's `SITE_URL` is the canonical frontend origin. Browser code uses relative service URLs; loopback defaults are server-internal only. Frontend private/dynamic reads do not use shared fallback content caches. Production deployment and ingress identity are still unverified.

## A. Retain the content platform, extract gameplay

Keep Next/Hono/D1/R2/KV rather than rewrite working content/import/SEO layers. Extract engine lifecycle/input/run-clock code into `packages/game-core`; web and mobile depend on this package, not each other's UI. `packages/shared` owns parsers, sanitization and type/security helpers. Dependency direction must remain platform UI → shared packages, never shared engine → Next or Capacitor.

Why: fixes to focus, timing, Snake and Gravity benefit both clients. Tradeoff: deterministic simulation seams and complete engine tests remain incomplete; shared source does not guarantee identical performance across browsers/WebViews.

## B. Bundled Capacitor spike instead of remote website wrapper

A bundled client gives offline games, native lifecycle/back integration and a smaller navigation model without duplicating four engines in Kotlin. Capacitor 8 adds only App and Share plugins. TWA would depend more directly on a deployed web origin; a full native rewrite would add engine duplication and native maintenance. Neither alternative was measured on devices here.

Re-evaluate after actual low/mid-tier device testing, native build/lint, startup/memory measurements, TalkBack assessment and store-policy review. If native bridge/lifecycle/performance or meaningful-functionality requirements fail, revisit TWA/native scope rather than mask defects. No estimate or architecture approval is implied by scaffolding.

## C. Offline boundary

Android uses packaged assets and no runtime executable pack download. The hosted Pocket Arcade precaches only enumerated same-origin static files with content-derived cache versions. It deliberately does not cache API responses, admin HTML, exports, engagement writes, ads or user content. The Next content website has no full offline contract yet.

Hosted updates wait for existing tabs to close, avoiding forced mid-game reload. A user-facing update prompt, eviction/quota tests and advanced pack storage controls remain open. Personal bests are local; no delayed public score submission is queued.

## D. Public media must not share a recovery namespace

Use separate R2 bindings/buckets plus a restrictive public image-key policy. Namespace checks alone would not protect an accidentally public recovery bucket; production storage policy and historical exposure assessment are independent gates. Backups remain private JSON and isolated restores, not public SQL downloads.

## E. Fail closed rather than pretend reversibility

Unsafe timestamp-based import rollback is removed and returns 409. D1 migration history failures stop execution. Deployment is plan-only unless explicitly applied; seed/media changes require separate opt-ins. These controls reduce accidental harm but do not substitute for transactional migration tracking, checksums, provenance/before-images or production recovery drills.

## F. Keep identity and monetization separate from play

Anonymous gameplay and local storage are the current default. No login/paywall is introduced. Public client-reported scores remain unverified; shared-NAT/proxy identity is unresolved. Native ads/push/accounts are absent. Web ads require explicit reviewed configuration and consent gates, but no compliance certification is claimed. Product/legal decisions must precede expansion.
