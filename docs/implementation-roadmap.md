# FreeGameplay — end-to-end implementation roadmap

**Planning baseline: 2026-10-27 · Web + Android · Living execution checklist**

> **Bottom line:** retain the existing Next.js/Hono/Cloudflare foundation, repair security and correctness first, deliver genuinely good touch-first web gameplay, then ship an Android experience with useful offline capabilities. Growth features should earn their cost through audience evidence. The application is not production-complete merely because routes exist and unit tests pass.

**Companion documents:** [source-based audit and risk register](roadmap-audit.md) · [task spreadsheet](implementation-tasks.csv) · [current status + historical ledger](status.md) · [import instructions](importing-content.md).

> **Implementation update — 2026-10-28:** 34 narrowly verified tasks (**V**), 129 partially implemented/source-inspected (**I**), 28 externally blocked (**B**), 185 to do (**T**), 54 conditional/deferred (**D**); **430 total**. I does not mean completed acceptance. Checked tasks are local verification, not a production release. See [current evidence](status.md), [recovery](recovery.md), [mobile release](mobile-release.md) and [provisional architecture](architecture-decisions.md). Original baseline findings remain historical; new dated task notes and spreadsheet states control current execution.

## Contents

1. [Purpose and audience](#purpose-and-audience)
2. [What exists and what was verified](#what-exists-and-what-was-verified)
3. [Architecture and platform choices](#architecture-and-platform-choices)
4. [Release sequence and gates](#release-sequence-and-gates)
5. [Success measures and budgets](#success-measures-and-budgets)
6. [Execution rules, roles and task contract](#execution-rules-roles-and-task-contract)
7. [Immediate work queue](#immediate-work-queue)
8. [Detailed checklist](#detailed-checklist)
9. [Operating cadence and change control](#operating-cadence-and-change-control)

## Purpose and audience

**Product promise:** help a visitor quickly find a genuinely playable free game, understand its controls, enjoy a reliable session, and return to useful games and guides without misleading download buttons, compulsory registration, intrusive advertising or excessive data use.

These are **research hypotheses**, not established audience facts:

| Audience / job | Need to validate | Product response to test | Evidence of success |
|---|---|---|---|
| Casual player with a few minutes | Find something enjoyable immediately | Playable-first catalog, short-session filters, clear start control | Successful game starts, repeat play, task completion |
| Android user on a lower-end phone | Responsive controls, limited storage/data, interrupted networks | Touch-first engines, small payloads, optional offline packs | Device playtests, startup time, crashes, bytes/session |
| Returning player | Find a previous game and keep a personal best | Local favorites/history first; optional sync later | Repeat sessions without forced identity collection |
| Reader looking for help | Relevant, accurate guidance without ad obstruction | Searchable guides linked to the correct game/version | Guide usefulness feedback and search success |
| Legacy Blogger visitor | Bookmarks and useful content survive | Source-host migration plan, redirect map, rights-reviewed images | Old URL tests, content parity, crawl health |
| Operator/editor/moderator | Publish safely and handle problems without developer intervention | Reliable import first, moderation and support tools, editorial UI as justified | Publishing/moderation turnaround, recovery drills |

Research must include people with accessibility needs. Recruit in Nigeria and other intended markets **only if the owner confirms those markets**; the owner's location is not proof of audience geography. Decide child-directed/general-audience positioning before data, ads, accounts or store declarations. “For all ages” in a seed record is not a legal age classification.

### Scope discipline

- **Required web launch:** rights-cleared playable catalog; reliable mobile/desktop controls; discovery and guides; security/privacy fixes; accurate SEO/migration; support; monitoring; tested recovery; sustainable operating cost.
- **Required Android launch:** the web foundation plus an approved Android architecture, meaningful mobile functionality, safe lifecycle/storage/navigation, signed releases, device QA, policy declarations and support. Browser installation is not an Android store release.
- **Feature gates:** comments, newsletter, public scores, ads and notifications may launch disabled if their safety/operations gate is incomplete. Hide disabled CTAs, explain limitations and test flag defaults.
- **Growth scope, not launch blockers:** reader accounts, cross-device sync, advanced editor workflows, personalization, localization, native ads and expanded catalog partnerships. Each has a decision gate; defer if benefit is unproven.
- **Not assumed:** real-money prizes, crypto, betting, chat/direct messaging, user-uploaded executable games, a game marketplace, subscription billing or multiplayer servers. These introduce separate safety, financial, infrastructure and policy work and require a new approved scope.

## What exists and what was verified

> This section records the **2026-10-27 planning baseline**. See the 2026-10-28 status ledger above for subsequent implementation/tests; do not treat old findings as newly observed.

Status vocabulary: **V** = verified in this review; **I** = implemented/source inspected, not fully verified; **H** = historical verification only; **T** = to do; **B** = blocked on a specified dependency; **D** = deliberately deferred/conditional. Checked boxes below mean the narrowly described baseline item exists or the named check passed, **not that the whole feature is launch-ready**.

- [x] **BASE.01 · I** — TypeScript workspaces and shared content models exist. Why: reuse contracts. Connects: root package configuration → API/web/shared. Evidence: `package.json`, `packages/shared/src/types.ts`.
- [x] **BASE.02 · I** — Hono routes and D1 migrations exist. Why: one content source for clients. Connects: Worker → D1, KV, R2. Evidence: `apps/api/src`, `apps/api/migrations`.
- [x] **BASE.03 · I** — Next.js content pages, archives, search and design components exist. Why: discovery and reading. Connects: server API client and same-origin rewrites. Evidence: `apps/web/src/app`, `next.config.ts`.
- [x] **BASE.04 · I** — Four canvas game engines exist. Why: first-party playable content. Connects: canvas/input/local best/leaderboard event. Evidence: `components/engines`; see GAME tasks for defects.
- [x] **BASE.05 · I** — Blogger/RSS/Atom parsers and import/redirect pipeline exist. Why: preserve content investment. Connects: shared parsers → admin import → D1/media/middleware. Evidence: parsers, import scripts and sample fixtures.
- [x] **BASE.06 · I** — Comments, score boards, opt-in, pageview reporting and admin console exist. Why: engagement and operation. Connects: public write routes → D1 → admin UI. Evidence: route/component source; safety work remains.
- [x] **BASE.07 · I** — SEO routes, ad scaffolding, cron, deployment helpers and CI exist. Why: discoverability and repeatable operations. Evidence: meta routes, scripts and workflow. Provider compliance, recovery and production operation are not established.
- [x] **BASE.08 · V** — Clean `npm ci --no-fund --no-audit` completed on 2026-10-27. Why: reproducible baseline. Connects: lockfile → npm registry → local toolchain.
- [x] **BASE.09 · V** — `npm test`: 48 passed, 0 failed. Why: protect current helper/parser behavior. Does not exercise real games, browsers or Android; some current tests encode weak behavior that must change.
- [x] **BASE.10 · V** — `npm run typecheck`: all three workspaces passed. Why: baseline contract/type health; runtime schema coverage remains to do.
- [x] **BASE.11 · V** — Dependency advisory scan recorded: 8 flagged packages, including 1 critical. Why: prioritize patch triage; this is a completed scan, not a clean security bill.
- [x] **BASE.12 · V** — Repository review and this roadmap produced. Why: replace blanket completion claims with evidence-led execution. Connects: risk register → task IDs → release gates.

**Historical only:** `status.md` records 85 API checks, a web build and route/deployment checks from 2026-09-25. They have not been rerun here. **Unknown:** present production resources, DNS, email delivery, ad approval, real content rights and traffic. **Absent in checkout:** Android app, PWA manifest/service worker, native signing/store workflow, reader authentication, editor CRUD workflow and tested restore tooling. Do not publish a percentage-complete figure from the mix of code presence and future scope.

## Architecture and platform choices

### Keep the proven shape; strengthen boundaries

```text
Web browser
  → Next.js web frontend (SSR/SEO and same-origin /api + /media)
  → Hono Worker API
      → D1: content, engagement, editorial state and migrations
      → KV: explicitly versioned non-sensitive caches
      → R2 PUBLIC MEDIA binding: approved public assets only
      → R2 PRIVATE BACKUP binding: restricted recovery data (PROPOSED)
      → email provider / retry queue (production gate)

Android client (PROPOSED, ADR required)
  → packaged client + reviewed shared game code + local storage
  → explicitly configured HTTPS public API; no embedded admin credentials
  → native lifecycle, app links, optional notifications

Operator web surface
  → isolated, short-lived authenticated admin access
  → audited privileged API → content/moderation/recovery workflows

CI / release tooling
  → disposable local tests → isolated staging → approved production release
  → separate web rollback, API compatibility and Android staged rollout
```

No new database, search SaaS, Kubernetes cluster or analytics SDK is justified merely by “highest potential.” Start with the current services, measure bottlenecks, and keep provider adapters small. Runtime validation and documented API contracts are required because installed Android versions cannot all update immediately.

### Android recommendation — conditional, not already selected

| Option | Benefits | Constraints | Decision |
|---|---|---|---|
| Mobile web + PWA | Lowest maintenance, shareable URLs, install/offline where supported | Not itself a Play release; browser capability differences | Build web capability first |
| Trusted Web Activity | Maximum reuse of hosted web experience | Depends on verified web origin/browser behavior; less independent offline/native control | Valid fallback if research needs are web-first |
| Capacitor with packaged React client | Reuse TypeScript/canvas; local assets and native integrations | WebView/bridge security, plugin and lifecycle maintenance; SSR pages cannot simply run locally | **Preferred hypothesis for useful offline Android**, subject to spike |
| Kotlin/Compose native shell | Native navigation/accessibility/lifecycle | More client code; canvas engines still need a secure host or rewrite | Choose only when device evidence/needs justify cost |

The architecture spike must compare real startup, input latency, memory, accessibility and offline behavior on lower-end devices. If Capacitor wins, create `apps/mobile` plus shared `packages/game-core`/API client as needed; keep Next server components/SSR in `apps/web`. **Do not assume a static export of the current dynamic Next application will work.** Offline game packs contain only owned/licensed assets. External iframe games remain online-only unless explicit rights and technical support allow otherwise.

### Decisions needing owner approval

1. Audience, launch countries/languages, age positioning, accessibility commitment.
2. Minimum safe launch catalog and rights evidence; real Blogger export/domain ownership.
3. Monthly spend ceiling, staffing/moderation coverage, availability/recovery objectives.
4. Android distribution goal: Play Store, direct APK, or both; legal publisher identity and signing custody.
5. Android ADR after the device spike; which optional engagement/monetization features to enable.
6. Reader accounts only if validated sync benefits outweigh data/security/support costs.

Research, code containment and local tests can proceed while these decisions are being resolved. No provider spending, production migration, ad activation or store submission is implied by approval of this roadmap alone.

## Release sequence and gates

| Gate | Deliverable | Exit evidence / stop conditions |
|---|---|---|
| **G0 — Safe foundation** | Contained private data, patched dependencies, safe rendering/validation, recoverable data | No unresolved critical or reachable high security defects; R01 investigated if live; isolated staging; repeatable tests and restore proof |
| **G1 — Web beta** | Honest catalog, all launch games usable on touch and keyboard, stable discovery/reading | CAT/WEB/GAME/SEO core tasks pass; rights verified; accessibility and slow-network sessions observed; unready engagement disabled |
| **G2 — Public web + installable web** | Operable, monitored public service and optional PWA | G1 + OPS/QA/REL gates; rollback rehearsal; real content migration approved; support/legal pages; PWA offline/update tests if advertised |
| **G3 — Android beta** | Signed internal/closed-test artifact with actual mobile value | ADR accepted; API compatibility; offline/lifecycle/deep-link/security/device tests; no privileged secrets in artifact |
| **G4 — Android public** | Store/distribution release and support readiness | Applicable policy/testing requirements checked at submission; staged rollout/rollback plan; privacy declarations match SDK/data behavior; release approval |
| **G5 — Sustainable growth** | Evidence-driven content, retention, editorial and localization improvements | Baseline metrics and budget; experiment guardrails; optional feature-specific safety/policy gates; recurring maintenance owners |

**Critical path:** private-data containment → dependency/rendering/input hardening → migration/cache/recovery reliability → honest catalog and touch gameplay → web QA/operations/cutover → Android architecture and API compatibility → packaged/offline/lifecycle implementation → device/policy QA → staged Android release.

**Parallel lanes:** audience research, rights inventory, design/accessibility audits, test scaffolding, architecture spikes and deployment planning. Security containment must not wait for research. Android research can start early; public Android launch must not outrun backend safety.

**Planning ranges, not delivery commitments:** for an experienced small team with a product/operator owner, web/backend engineer, mobile engineer and shared QA/design/security coverage, allow roughly 1–2 weeks for baseline/decisions, 2–5 weeks for G0 remediation, 3–6 weeks for web-quality/G1 work, 1–3 weeks for cutover/G2, 1–2 weeks for the Android spike and 4–8 weeks for Android implementation/testing. Some lanes overlap; store reviews, account requirements and real migration complexity are external. A single developer should sequence lanes and re-estimate rather than add these ranges as a promise. G5 is ongoing. Assign per-task estimates after reproduction/design; the checklist is not a fixed-price quotation.

## Success measures and budgets

All numbers below are **proposed targets to ratify and measure**, not present performance claims or universal store requirements.

| Measure | Initial target | Measurement / limitation |
|---|---|---|
| Successful play start | ≥98% of eligible user start attempts reach a responsive playing state in beta | Start + ready/failure events; synthetic probes and consent-safe aggregates; exclude robots consistently |
| Time to playable | p75 ≤3 s after start for a cached first-party game on the agreed test profile | Record device, connection and cold/warm cache; separate catalog navigation from engine startup |
| Web experience | p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 | Real-user data when enough traffic; lab budgets before launch, not a claim that lab scores equal field experience |
| Transfer cost | Initial browse page ≤1 MB compressed; initial JS ≤250 KB gzip on core browse routes | Agree exclusions and per-route budgets; lazy-load game and ad code; profile real assets |
| Gameplay responsiveness | Target 60 fps on reference devices, acceptable ≥30 fps on supported low tier | Frame-time distributions, touch latency, thermal/memory/battery checks; reduce visual effects before simulation correctness |
| Availability | Initial 99.5% monthly public core-journey success target | External HTTP + playable/readiness checks, not only process liveness |
| API reads | Initial p95 ≤500 ms at agreed normal load | Test from intended regions and include proxy/network; tune query/service budget separately |
| Android stability | Initial ≥99.5% crash-free sessions, no reproducible blocking ANR | Beta sample size explicitly reported; current platform quality thresholds checked independently |
| Recovery | Initial RPO ≤24 h, RTO ≤4 h | RPO = tolerated data-loss interval; RTO = restoration time; upgrade objectives if business needs require |
| Accessibility | WCAG 2.2 AA target for web shell/content; equivalent Android operability | Automated checks plus keyboard/screen-reader/manual review; disclose game-specific limitations honestly |
| Support/moderation | Critical safety triage same day; ordinary support ≤2 working days | Coverage must be staffed; close comments or reduce scope if queues cannot be handled |
| Cost | Owner-approved monthly cap and alert thresholds at 50/80/100% | Model requests, CPU, D1 reads/writes, storage, media delivery/proxy, email, build and monitoring costs |
| Retention/usefulness | Establish baseline before setting uplift goals | Voluntary feedback and lawful cohorts; daily rotating pageview hashes cannot measure cross-day user retention |

**North-star candidate:** weekly successful, enjoyable play sessions, corroborated by voluntary usefulness/enjoyment feedback—not pageviews or ad clicks alone. Guardrails: crashes, failed starts, data usage, accessibility, complaints, opt-outs and cost per successful session. Do not collect persistent identity just to make a retention chart possible.

## Execution rules, roles and task contract

### Roles

**PO** product owner/business; **UX** research/design/accessibility; **BE** backend/data; **FE** frontend; **GAME** game engineering; **AND** Android; **QA** test/release quality; **SEC** security; **OPS** infrastructure/reliability; **ED** editorial/SEO/rights; **LEGAL** privacy/policy adviser; **MOD** trust/safety/support; **DATA** analytics/experimentation. These are responsibilities, not a requirement to hire fourteen people. A person may hold multiple roles; high-risk changes need an independent reviewer where feasible.

### Task semantics

Each detailed row includes a stable ID, checkbox, action, rationale/outcome, affected system/integration and observable acceptance condition. Its phase supplies **status, priority, accountable role, reviewers, release gate and external blockers**. The CSV expands these inherited fields per task and adds estimate/assignee/evidence fields.

- **P0:** containment or security stop-ship. **P1:** core release requirement. **P2:** quality/operational expansion. **P3:** conditional growth.
- All detailed tasks start **T (to do)**; conditional phases start **D**. Existing baseline assets above are not counted as completed remediation.
- The numbered sequence within each phase is a conservative working order. The CSV lists the preceding row as a sequencing dependency; phase entry gates apply to every row. Independent rows can be parallelized after an owner updates dependencies. Dependencies are not proof of effort or technical necessity.
- Estimate field starts **unestimated**. Before sprint commitment: name an assignee, estimate in hours/days or XS/S/M/L, assess uncertainty, split any task larger than two focused engineering days, add explicit prerequisites and a test case.
- If blocked, change state to **B**, name the blocker/owner/unblock action and review date. Do not mark blocked work complete. If de-scoped, use **D** with a reason, not a tick.
- Completion needs linked code/design/policy evidence, reviewer, command/device/environment/date and results. A checkbox is not evidence by itself.

### Definition of ready

A task is ready when its problem can be reproduced or research question is defined; acceptance conditions and dependencies are agreed; input data/access are available; scope fits a reviewable unit; privacy/rights impact is known; owner and reviewer are assigned. External access is supplied through provider controls or secure configuration, never chat credentials.

### Definition of done (applies to every implementation task)

Code/design reviewed; positive/negative/error-path tests pass; schema/API backward compatibility assessed; accessibility and low-end-device impact considered; logs redact sensitive data; flags and kill switches default safely; monitoring/docs updated; rollback/recovery path recorded; staging acceptance evidence linked. Production tasks additionally need owner approval, safe rollout and post-release observation. Policy tasks need the appropriate qualified review rather than a developer's unsupported compliance claim.

### Source of truth

This Markdown is the primary plan. `implementation-tasks.csv` is an initial spreadsheet snapshot, not an automatically synchronized issue tracker. If work moves into issues, retain these IDs and link issues/evidence here; select one operational tracker and regenerate/archive the CSV so status does not diverge. No issues, deployments or store submissions are created by this planning change.

## Immediate work queue

1. **SEC.01–SEC.05:** determine whether the private-backup path exists in any live environment; contain it and preserve recovery/audit evidence.
2. **SEC.06–SEC.08:** triage and patch the flagged dependency graph; lock and regression-test supported versions.
3. **SEC.09–SEC.20:** safe HTML/JSON-LD, production opt-in token handling and bounded safe URL fetching.
4. **QA.01–QA.05:** establish isolated reproducible integration/browser tests; never run the existing mutation-heavy verifier against real users without isolation.
5. **API/CAT:** repair cache invalidation, migration integrity, public media paths and playability truthfulness.
6. **GAME:** touch controls, keyboard focus, Breakout launch, timing/lifecycle and Snake completion edge case.
7. **PROD/ADR/LEGAL:** resolve audience, rights, budget, age positioning and Android architecture while engineering repairs proceed.

**First sprint outcome:** demonstrated containment plus regression tests, prioritized dependency fixes, clear release boundaries and an instrumented reproducible local/staging baseline—not a larger feature list or an Android wrapper over unsafe backend behavior.

## Detailed checklist

Each phase below is a workstream, not necessarily a calendar sprint. Core gates override chronological ordering: operations and QA start early and run throughout. For risk details and source files, use [the audit](roadmap-audit.md).

**Backlog size:** 430 numbered action items across 24 workstreams, plus the 12 baseline evidence items above. This is a detailed v1 work breakdown, not a claim that discovery can reveal no further work. Split newly discovered complexity into child IDs and retain traceability.

| Workstream | Items | Accountable role | Priority | Gate |
|---|---:|---|---|---|
| [PROD — Product discovery, audience and scope](#workstream-prod) | 14 | PO | P1 | G1 |
| [SEC — Immediate security containment and trust boundaries](#workstream-sec) | 26 | SEC | P0 | G0 |
| [API — Backend contracts, migrations and cache correctness](#workstream-api) | 20 | BE | P1 | G0/G1 |
| [DATA — Data governance, privacy and legal readiness](#workstream-data) | 14 | LEGAL | P1 | G1/G2; before data features activate |
| [CAT — Catalog integrity, game rights and media pipeline](#workstream-cat) | 17 | ED | P1 | G1 |
| [WEB — Web discovery, reading and responsive usability](#workstream-web) | 18 | FE | P1 | G1 |
| [GAME — Game mechanics, touch controls and engine lifecycle](#workstream-game) | 24 | GAME | P1 | G1; reusable foundation for G3 |
| [SCORE — Player identity and fair casual leaderboards](#workstream-score) | 14 | BE | P1 | Before public scores activate |
| [COM — Newsletter, comments, contact and community operations](#workstream-com) | 18 | BE | P1 | Feature-specific activation before G2/G4 |
| [MIG — Safe legacy migration and precise import rollback](#workstream-mig) | 19 | BE | P1 | Before real migration/cutover |
| [CMS — Editorial and operator tooling beyond import-only publishing](#workstream-cms) | 16 | FE | P2 | G5; earlier if launch publishing requires it |
| [SEO — Search, content quality and migration discoverability](#workstream-seo) | 14 | ED | P1 | G1/G2 |
| [PERF — Performance, accessibility and inclusive quality](#workstream-perf) | 15 | UX | P1 | G1/G2/G3 |
| [ADS — Optional advertising and sustainable monetization](#workstream-ads) | 16 | PO | P2 | Separate gate before any ads activate |
| [PWA — Installable web and explicitly bounded offline support](#workstream-pwa) | 18 | FE | P1 | G2 if installation/offline advertised; foundation for chosen Android path |
| [ADR — Android architecture and delivery feasibility](#workstream-adr) | 12 | AND | P1 | Before committing Android build scope |
| [AND — Android client implementation and platform integration](#workstream-and) | 30 | AND | P1 | G3 |
| [STORE — Android signing, policy, testing tracks and publication](#workstream-store) | 20 | OPS | P1 | G4 |
| [OPS — Infrastructure, observability, recovery and cost control](#workstream-ops) | 22 | OPS | P1 | G0 recovery; G2 production operations; ongoing |
| [QA — Quality engineering, automation and release evidence](#workstream-qa) | 24 | QA | P1 | Every gate |
| [REL — Web deployment, migration cutover and safe rollout](#workstream-rel) | 18 | OPS | P1 | G2 |
| [ACCOUNT — Optional reader accounts and cross-device continuity](#workstream-account) | 13 | BE | P3 | G5 only after validated demand |
| [GROW — Evidence-led growth, content and product evolution](#workstream-grow) | 16 | PO | P3 | G5; ongoing after stable launches |
| [DOC — Documentation accuracy and sustainable handover](#workstream-doc) | 12 | PO | P1 | Every release; final G2/G4 handover |

<a id="workstream-prod"></a>

### PROD — Product discovery, audience and scope

**Accountable:** PO · **Reviewers/partners:** UX, ED, LEGAL, OPS · **Priority:** P1 · **Initial state:** T · **Gate:** G1

**Entry dependencies:** BASE.12; can run alongside containment. **External needs/blockers:** Owner decisions; consented research participants.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **PROD.01 — Write a one-page product charter.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Prevent feature drift; define who is helped and how.
  - **Uses / connects:** README promise, owner interview, current catalog.
  - **Done when:** Owner approves purpose, exclusions and primary journeys.

- [ ] **PROD.02 — Inventory existing audience evidence.**
  - **Why / outcome:** Avoid assuming geography, age or demand.
  - **Uses / connects:** Lawfully accessible traffic summaries, support messages, legacy content.
  - **Done when:** Evidence separated from hypotheses with dates and gaps.

- [ ] **PROD.03 — Choose research segments and sample.**
  - **Why / outcome:** Include lower-end phones and accessibility needs.
  - **Uses / connects:** Recruitment screener, target markets, research consent.
  - **Done when:** Recruitment plan includes device/network diversity and avoids unnecessary personal data.

- [ ] **PROD.04 — Interview first-time and returning players.**
  - **Why / outcome:** Learn why people play or abandon.
  - **Uses / connects:** Consented research sessions, current alternatives.
  - **Done when:** Ranked pain points supported by anonymized notes.

- [ ] **PROD.05 — Observe find-start-play-return tasks.**
  - **Why / outcome:** Identify friction rather than rely on preferences.
  - **Uses / connects:** Existing web build, touch/keyboard devices.
  - **Done when:** Task completion, confusion and failure observations recorded.

- [ ] **PROD.06 — Interview readers and guide seekers.**
  - **Why / outcome:** Make writing useful rather than traffic filler.
  - **Uses / connects:** Search queries volunteered by participants, sample guides.
  - **Done when:** Top guide questions and relevance criteria documented.

- [ ] **PROD.07 — Shadow the operator workflow.**
  - **Why / outcome:** Expose publishing and moderation costs.
  - **Uses / connects:** Admin console, import reports, inbox process.
  - **Done when:** Current workflow map identifies manual work and failure points.

- [ ] **PROD.08 — Review relevant competing experiences.**
  - **Why / outcome:** Learn conventions without copying blindly.
  - **Uses / connects:** Public game portals and Android alternatives reviewed on permitted devices.
  - **Done when:** Comparison covers time-to-play, ads, controls, offline and accessibility.

- [ ] **PROD.09 — Choose age positioning and launch markets.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Drive privacy, rights and store decisions.
  - **Uses / connects:** Legal review, audience evidence, content ratings.
  - **Done when:** Explicit owner decision with prohibited content/targeting rules.

- [ ] **PROD.10 — Define launch journey acceptance scripts.**
  - **Why / outcome:** Turn purpose into testable outcomes.
  - **Uses / connects:** Research findings, catalog and game engines.
  - **Done when:** Scripts cover browse, play, guide, return, support and outage.

- [ ] **PROD.11 — Set feature flags and launch scope.**
  - **Why / outcome:** Ship a safe core without unfinished optional surfaces.
  - **Uses / connects:** PO priorities, risk register, OPS configuration.
  - **Done when:** Each engagement feature has on/off owner, safe default and activation gate.

- [ ] **PROD.12 — Approve quality and cost budgets.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Avoid speed or revenue goals harming users.
  - **Uses / connects:** Proposed targets, infrastructure estimates, staffing.
  - **Done when:** Targets, spend ceiling and moderation capacity signed off.

- [ ] **PROD.13 — Prioritize by impact, risk and effort.**
  - **Why / outcome:** Focus work on real needs.
  - **Uses / connects:** Research, audit findings, dependency graph.
  - **Done when:** Ordered release backlog with explicit deferred items.

- [ ] **PROD.14 — Schedule ongoing feedback rounds.**
  - **Why / outcome:** Keep roadmap responsive to evidence.
  - **Uses / connects:** Beta recruitment, support and analytics.
  - **Done when:** Named owner and recurring review calendar exist.

<a id="workstream-sec"></a>

### SEC — Immediate security containment and trust boundaries

**Accountable:** SEC · **Reviewers/partners:** BE, FE, OPS, LEGAL, QA · **Priority:** P0 · **Initial state:** T · **Gate:** G0

**Entry dependencies:** BASE.12; do not wait for product research. **External needs/blockers:** Production investigation needs authorized operator access; no live exposure assumed.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **SEC.01 — Establish whether matching deployments and backups exist.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Scope potential private-data exposure without assuming a breach.
  - **Uses / connects:** worker.ts, media.ts, authorized resource inventory.
  - **Done when:** Operator records environments, backup presence and exposure assessment; no public probing of real private data.

- [x] **SEC.02 — Block private keys at every public media entry point.**
  - **2026-10-28 state: V.** Public/private image boundary and encoded-key tests pass in tests/worker.test.ts; Next proxy denial covered by tests/browser/journeys.spec.ts. Local origins only; production exposure is separate.
  - **Why / outcome:** Stop the unauthenticated backup path immediately.
  - **Uses / connects:** Worker media route, frontend proxy/cache configuration.
  - **Done when:** Synthetic private keys and encoded variants return denial through both origins.

- [ ] **SEC.03 — Create a separate private backup bucket and binding.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Prevent public-media code from reaching recovery data.
  - **Uses / connects:** Wrangler environment bindings, cron, restricted IAM.
  - **Done when:** Public handler lacks backup binding access path; private storage never publicly routed.

- [ ] **SEC.04 — Handle any historical exposure safely.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Contain cached data and affected credentials without destroying evidence.
  - **Uses / connects:** Incident lead, access logs, CDN purge, token invalidation, legal review.
  - **Done when:** Investigation receipt, purge validation and conditional notification decisions recorded.

- [x] **SEC.05 — Add backup isolation regression tests.**
  - **2026-10-28 state: V.** Public/private image boundary and encoded-key tests pass in tests/worker.test.ts; Next proxy denial covered by tests/browser/journeys.spec.ts. Local origins only; production exposure is separate.
  - **Why / outcome:** Keep the private boundary from regressing.
  - **Uses / connects:** Local R2 fixtures, integration suite, public routes.
  - **Done when:** Tests fail if any private fixture is served or publicly cached.

- [ ] **SEC.06 — Triage dependency advisories against actual use.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Separate reachable runtime risk from toolchain flags.
  - **Uses / connects:** Lockfile, npm audit, provider advisories.
  - **Done when:** Each flagged package has affected version, reachability, owner and fix decision.

- [ ] **SEC.07 — Upgrade flagged dependencies in reviewed increments.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Remove known risk without blind breaking updates.
  - **Uses / connects:** Next, Hono, Wrangler and transitive graph.
  - **Done when:** Supported patched versions installed; changelogs and compatibility changes reviewed.

- [x] **SEC.08 — Lock and verify the patched dependency graph.**
  - **2026-10-28 state: V.** Clean npm ci and npm audit: 0 advisories; patched lockfile; web/mobile builds and Worker dry-run pass. Registry snapshot dated 2026-10-28.
  - **Why / outcome:** Prove the remediation is reproducible.
  - **Uses / connects:** npm ci, tests, typecheck, web build, Worker dry-run, fresh audit.
  - **Done when:** Clean install passes; remaining advisories explicitly triaged with expiry and no unresolved reachable high/critical risk.

- [x] **SEC.09 — Define an HTML allowlist and URL policy.**
  - **2026-10-28 state: V.** packages/shared/src/content-safety.ts defines tags/attributes/protocols; tests/security.test.ts malicious/legitimate fixtures; import and rendering call sites sanitized.
  - **Why / outcome:** Establish one safe content boundary.
  - **Uses / connects:** Import HTML, controls, guides, static pages, embedded links.
  - **Done when:** Allowed elements/attributes/protocols documented; executable markup disallowed.

- [x] **SEC.10 — Implement server-side HTML sanitization.**
  - **2026-10-28 state: V.** packages/shared/src/content-safety.ts defines tags/attributes/protocols; tests/security.test.ts malicious/legitimate fixtures; import and rendering call sites sanitized.
  - **Why / outcome:** Stop imported markup from executing as application code.
  - **Uses / connects:** Runtime-compatible sanitizer, admin import, future editor.
  - **Done when:** Malicious fixtures are neutralized; legitimate article structure preserved.

- [ ] **SEC.11 — Review and re-sanitize existing stored content.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** New validation does not repair historical records.
  - **Uses / connects:** D1 export, revision snapshots, sanitization migration.
  - **Done when:** Dry-run diff reviewed; original recovery copy private; sanitized records verified.

- [ ] **SEC.12 — Escape JSON-LD script delimiters.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Prevent structured-data fields breaking out of script tags.
  - **Uses / connects:** components/meta.tsx, metadata fixtures.
  - **Done when:** Titles containing closing-script payloads render inert valid JSON-LD.

- [ ] **SEC.13 — Harden admin and CSP boundaries.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Reduce impact of same-origin content compromise.
  - **Uses / connects:** Admin auth, session handling, CSP nonce/hash design.
  - **Done when:** Privileged UI access model approved; unsafe inline allowance reduced with regression evidence.

- [x] **SEC.14 — Forbid production confirmation-link disclosure.**
  - **2026-10-28 state: V.** apps/api/src/routes/subscribe.ts and tests/worker.test.ts: production failures never disclose confirmation links; hashed expiring single-use tokens, unsubscribe authority and equivalent membership responses.
  - **Why / outcome:** Ensure subscription requires inbox ownership even during outages.
  - **Uses / connects:** subscribe.ts, environment validator, email failure path.
  - **Done when:** No production response or log contains confirmation tokens; explicit local test mode only.

- [x] **SEC.15 — Expire and consume confirmation tokens.**
  - **2026-10-28 state: V.** apps/api/src/routes/subscribe.ts and tests/worker.test.ts: production failures never disclose confirmation links; hashed expiring single-use tokens, unsubscribe authority and equivalent membership responses.
  - **Why / outcome:** Stop reuse and replay after unsubscribe.
  - **Uses / connects:** Subscriber schema, token hashing, confirm/unsubscribe transitions.
  - **Done when:** Expired/used/old tokens fail; unsubscribe invalidates earlier confirmation authority.

- [x] **SEC.16 — Make subscription responses non-enumerating.**
  - **2026-10-28 state: V.** apps/api/src/routes/subscribe.ts and tests/worker.test.ts: production failures never disclose confirmation links; hashed expiring single-use tokens, unsubscribe authority and equivalent membership responses.
  - **Why / outcome:** Protect membership privacy.
  - **Uses / connects:** subscribe endpoint, retry/status copy.
  - **Done when:** New, pending and confirmed addresses have equivalent safe public responses.

- [x] **SEC.17 — Add mail-failure and token-abuse regression tests.**
  - **2026-10-28 state: V.** apps/api/src/routes/subscribe.ts and tests/worker.test.ts: production failures never disclose confirmation links; hashed expiring single-use tokens, unsubscribe authority and equivalent membership responses.
  - **Why / outcome:** Prove opt-in under provider failure and retries.
  - **Uses / connects:** Fake mail adapter, test clock, isolated D1.
  - **Done when:** Provider errors never bypass confirmation; repeated/cross-state requests tested.

- [ ] **SEC.18 — Specify safe outbound fetch rules.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Bound SSRF and resource consumption.
  - **Uses / connects:** Feed/media fetches, Worker networking constraints.
  - **Done when:** Allowed schemes, ports, hosts, redirects, DNS strategy, time and byte limits approved.

- [ ] **SEC.19 — Implement bounded fetch with validated redirects.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Make feed/media retrieval enforce those rules.
  - **Uses / connects:** Fetch adapter, streamed size limits, egress controls.
  - **Done when:** Every hop validated; credentials/private destinations rejected; oversized responses abort early.

- [ ] **SEC.20 — Test hostile URL and stream cases.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Catch bypasses string matching misses.
  - **Uses / connects:** IPv6/mapped IPv4, rebinding strategy, redirect fixtures, slow/large streams.
  - **Done when:** Negative suite passes in supported runtime; residual platform limits documented.

- [ ] **SEC.21 — Map actual personal-data flows.**
  - **Why / outcome:** Replace inaccurate IP-free/anonymous claims.
  - **Uses / connects:** D1, KV keys, provider logs, backups, frontend proxy.
  - **Done when:** Field/purpose/retention/access table reviewed by privacy owner.

- [x] **SEC.22 — Replace raw-IP rate keys with keyed identifiers.**
  - **2026-10-28 state: V.** Keyed expiring rate identifiers in apps/api/src/lib/rate.ts; Worker regression asserts test IP absent from KV keys. Trusted ingress/atomicity not claimed.
  - **Why / outcome:** Minimize stored networking identifiers.
  - **Uses / connects:** rate.ts, managed secret, rotation window.
  - **Done when:** KV/log scans contain no raw test IP; limiter behavior preserved with documented retention.

- [ ] **SEC.23 — Verify trusted ingress attribution.**
  - **Why / outcome:** Avoid proxy users sharing or spoofing security identity.
  - **Uses / connects:** Vercel-to-Worker path, trusted header policy, direct API traffic.
  - **Done when:** Tests distinguish legitimate clients and reject forged forwarding metadata where used for trust.

- [ ] **SEC.24 — Choose and implement atomic abuse limits.**
  - **Why / outcome:** KV eventual consistency is not strict coordination.
  - **Uses / connects:** Worker platform limiter or Durable Object/D1 design, route budgets.
  - **Done when:** Concurrent load respects documented bounds; shared-NAT fairness and failure policy tested.

- [ ] **SEC.25 — Enforce idempotency in database writes.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Prevent retries/concurrency creating duplicate scores or operations.
  - **Uses / connects:** Unique constraints, request keys, conflict handling.
  - **Done when:** Concurrent duplicate requests yield one durable action and deterministic responses.

- [ ] **SEC.26 — Add abuse kill switches and body limits.**
  - **2026-10-28 state: I.** Security hardening implemented: private BACKUPS binding, dependency updates, sanitizer/JSON-LD, approved-host bounded fetch, body limits and score uniqueness. See docs/status.md and tests/security.test.ts. Full task acceptance, live-data review, threat review or broader race/runtime testing remains open.
  - **Why / outcome:** Limit cost and harm when public writes are attacked.
  - **Uses / connects:** Public endpoints, content-type/size middleware, flags, alerts.
  - **Done when:** Bounded inputs, Retry-After and feature disable paths verified without disabling core gameplay.

<a id="workstream-api"></a>

### API — Backend contracts, migrations and cache correctness

**Accountable:** BE · **Reviewers/partners:** FE, AND, OPS, QA · **Priority:** P1 · **Initial state:** T · **Gate:** G0/G1

**Entry dependencies:** SEC core fixes; QA harness can develop in parallel. **External needs/blockers:** Staging bindings for provider-specific verification.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **API.01 — Inventory routes and runtime response shapes.**
  - **Why / outcome:** Expose documented versus actual contract drift.
  - **Uses / connects:** Hono route tree, shared types, admin clients.
  - **Done when:** Endpoint matrix includes auth, method, status, cache and consumer.

- [ ] **API.02 — Define runtime request and response schemas.**
  - **Why / outcome:** TypeScript casts do not validate untrusted JSON.
  - **Uses / connects:** Shared validation schemas, bounded strings/enums/numbers.
  - **Done when:** Public/admin payloads have versioned schemas and negative fixtures.

- [ ] **API.03 — Apply schemas to every write route.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Return controlled errors for malformed inputs.
  - **Uses / connects:** Contact, comments, scores, subscribe, admin import.
  - **Done when:** Wrong-type/null/oversized inputs yield documented 4xx rather than incidental 500.

- [ ] **API.04 — Normalize serializers and error envelopes.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Keep web and installed Android clients compatible.
  - **Uses / connects:** snake_case D1 rows, camelCase API models, correlation IDs.
  - **Done when:** Migration reports, health and list payloads match contract tests.

- [x] **API.05 — Set explicit CORS and origin rules.**
  - **2026-10-28 state: V.** Explicit-origin CORS/preflight including DELETE and multi-page KV invalidation fixtures pass in tests/worker.test.ts and tests/security.test.ts.
  - **Why / outcome:** Align intended consumers and supported methods.
  - **Uses / connects:** Worker CORS, web same-origin paths, proposed mobile origin.
  - **Done when:** Allowed reads/writes/preflights including DELETE tested; auth independent of CORS.

- [ ] **API.06 — Document API evolution and deprecation.**
  - **Why / outcome:** Installed clients lag backend releases.
  - **Uses / connects:** OpenAPI or equivalent contract, compatibility fixtures.
  - **Done when:** Additive-change policy and minimum-supported-client process approved.

- [ ] **API.07 — Inventory every cache layer and key.**
  - **Why / outcome:** Fix invalidation based on real storage names.
  - **Uses / connects:** KV home/tags/feed/board/sitemap, HTTP cache, Next fetch/route cache.
  - **Done when:** Mutation-to-key dependency map is complete and reviewed.

- [ ] **API.08 — Implement centralized cache key builders.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Eliminate bare-key/prefix disagreement.
  - **Uses / connects:** API route cache helpers and import/takedown paths.
  - **Done when:** Reads and invalidations use identical builders and version namespaces.

- [x] **API.09 — Paginate KV listing and invalidation.**
  - **2026-10-28 state: V.** Explicit-origin CORS/preflight including DELETE and multi-page KV invalidation fixtures pass in tests/worker.test.ts and tests/security.test.ts.
  - **Why / outcome:** Large caches must purge fully.
  - **Uses / connects:** kvDeleteByPrefix, reset endpoints, cursor handling.
  - **Done when:** Fixture spanning multiple listing pages is completely invalidated.

- [ ] **API.10 — Invalidate all affected API views on mutation.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Prevent deleted or corrected content lingering.
  - **Uses / connects:** Publish/import/delete/rollback → home/search/feed/taxonomy/sitemap/boards.
  - **Done when:** Warm-cache mutation tests remove stale data within the chosen bound.

- [ ] **API.11 — Add authenticated frontend revalidation.**
  - **Why / outcome:** API invalidation alone leaves Next pages stale.
  - **Uses / connects:** Worker mutation events, signed revalidation endpoint, Next tags/paths.
  - **Done when:** Web detail/list/meta pages refresh safely; replay/forgery tests pass.

- [ ] **API.12 — Test stale races and emergency takedown.**
  - **Why / outcome:** Bound exposure during regeneration and outages.
  - **Uses / connects:** Concurrent requests, cache versions, takedown runbook.
  - **Done when:** Old content cannot be repopulated after takedown; emergency path verified.

- [ ] **API.13 — Audit migration runner failure semantics.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Non-repeatable ALTERs need reliable bookkeeping.
  - **Uses / connects:** migrate.mjs, _fg_migrations, migrations 0001/0002.
  - **Done when:** Failed bookkeeping and interrupted applies reproduce safely in disposable databases.

- [ ] **API.14 — Implement checksummed migration tracking.**
  - **Why / outcome:** Detect edited/applied or partial migrations.
  - **Uses / connects:** D1 schema history, runner errors, locking/serialization.
  - **Done when:** Rerun skips known applies; checksum mismatch/failure stops with actionable recovery.

- [ ] **API.15 — Standardize timestamps and foreign-key behavior.**
  - **Why / outcome:** Prevent date comparisons and deletion anomalies.
  - **Uses / connects:** Schema, import dates, UTC serializers, FK checks.
  - **Done when:** UTC format consistent; orphan and date-boundary tests pass.

- [ ] **API.16 — Add publication state and visibility predicates.**
  - **Why / outcome:** Drafts/future content must not leak.
  - **Uses / connects:** Content schema, lists/detail/search/feed/sitemap.
  - **Done when:** Every public query shares published/visible rules; draft/future fixtures excluded.

- [ ] **API.17 — Profile queries and remove redundant reads.**
  - **Why / outcome:** Improve latency and D1 cost before scaling tools.
  - **Uses / connects:** Query plan evidence, joins, indexes, list payloads.
  - **Done when:** Baseline/after measurements show bounded reads; no unbounded N+1 path.

- [ ] **API.18 — Make pagination and totals deterministic.**
  - **Why / outcome:** Avoid missing/duplicated entries and capped totals.
  - **Uses / connects:** Tie-break IDs, cursors/page bounds, admin totals.
  - **Done when:** Equal-date data, final/invalid pages and more-than-limit totals tested.

- [ ] **API.19 — Implement timeouts and degraded-cache policy.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Prevent upstream outages becoming hanging requests.
  - **Uses / connects:** Server API client, fetch cancellation, stale-safe public data.
  - **Done when:** Timeout returns appropriate UI/error; private data never served from shared fallback.

- [ ] **API.20 — Add configuration validation and flags.**
  - **2026-10-28 state: I.** Request/serializer/cache fixes, no-store web fetch timeout, fail-closed migration history and production secret preflight implemented. tests/worker.test.ts and local verifier pass; complete schema coverage, interruption/race and production tests remain open.
  - **Why / outcome:** Fail safely on missing production origins/secrets.
  - **Uses / connects:** Worker/web startup or deploy validation, flag defaults.
  - **Done when:** Missing required settings stop release; optional surfaces hide cleanly.

<a id="workstream-data"></a>

### DATA — Data governance, privacy and legal readiness

**Accountable:** LEGAL · **Reviewers/partners:** PO, SEC, BE, MOD, OPS · **Priority:** P1 · **Initial state:** T · **Gate:** G1/G2; before data features activate

**Entry dependencies:** PROD age/market decision; SEC data inventory. **External needs/blockers:** Qualified advice; legal publisher identity; provider agreements.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **DATA.01 — Assign a data owner and processing inventory.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Establish accountability rather than generic privacy copy.
  - **Uses / connects:** SEC inventory, operator roles, provider list.
  - **Done when:** Every data category has purpose, owner and access scope.

- [ ] **DATA.02 — Choose lawful processing and consent approach.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Align data use with actual audience/jurisdictions.
  - **Uses / connects:** Target markets, age positioning, legal review.
  - **Done when:** Documented basis/consent decisions and unresolved questions.

- [ ] **DATA.03 — Set retention for every datastore and log.**
  - **Why / outcome:** Avoid indefinite collection by default.
  - **Uses / connects:** D1 tables, KV, backups, email and telemetry providers.
  - **Done when:** Retention schedule includes deletion jobs, exceptions and verification.

- [ ] **DATA.04 — Minimize contact and comment fields.**
  - **Why / outcome:** Collect only what operations actually need.
  - **Uses / connects:** Forms, API schemas, admin UI.
  - **Done when:** Optionality and necessity reviewed; unused fields removed or not collected.

- [ ] **DATA.05 — Implement access/export/correction/deletion workflow.**
  - **Why / outcome:** Make privacy requests operational.
  - **Uses / connects:** Verified requester procedure, D1 lookup, provider adapters.
  - **Done when:** Synthetic request fulfilled within approved SLA with audit receipt.

- [ ] **DATA.06 — Propagate deletion to derived data and restores.**
  - **Why / outcome:** Backups must not resurrect erased data silently.
  - **Uses / connects:** Tombstones/suppression ledger, recovery scripts, caches.
  - **Done when:** Restore rehearsal reapplies deletions and documents retention exceptions.

- [ ] **DATA.07 — Review vendor agreements and transfers.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Data flow outside the app still matters.
  - **Uses / connects:** Hosting, email, monitoring, optional ads/notifications.
  - **Done when:** Vendor inventory and legal review approved for chosen markets.

- [ ] **DATA.08 — Publish accurate privacy and terms pages.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Tell users what really happens.
  - **Uses / connects:** Data inventory, retention, game rights, support contact.
  - **Done when:** Copy matches implementation and is versioned and accessible.

- [ ] **DATA.09 — Define content rights and takedown procedure.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Prevent unlicensed distribution and slow removals.
  - **Uses / connects:** Rights ledger, operator inbox, cache purge, app packs.
  - **Done when:** Ownership/complaint process has evidence requirements and response owner.

- [ ] **DATA.10 — Define child safety and prohibited-content rules.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Avoid accidental child-directed data/ads behavior.
  - **Uses / connects:** Age positioning, content ratings, moderation policy.
  - **Done when:** Age-related design and policy obligations resolved before launch.

- [ ] **DATA.11 — Add privacy controls and local-data reset.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Give meaningful control without accounts.
  - **Uses / connects:** Web storage, PWA caches, Android storage, consent settings.
  - **Done when:** User can clear history/favorites and revoke optional permissions safely.

- [ ] **DATA.12 — Audit telemetry for sensitive fields.**
  - **Why / outcome:** Paths and errors can contain personal information.
  - **Uses / connects:** Analytics, logs, crash payloads, URL/token redaction.
  - **Done when:** Test emails/tokens/search secrets absent from recorded telemetry.

- [ ] **DATA.13 — Document breach response and escalation.**
  - **Why / outcome:** Make containment a practiced process.
  - **Uses / connects:** R01 response, provider contacts, notification criteria.
  - **Done when:** Tabletop exercise completed; decision owner and deadlines recorded.

- [ ] **DATA.14 — Review accessibility and public claims.**
  - **Why / outcome:** Avoid overstating compliance or availability.
  - **Uses / connects:** Product copy, legal pages, release marketing.
  - **Done when:** Claims tied to evidence; limitations and support options explicit.

<a id="workstream-cat"></a>

### CAT — Catalog integrity, game rights and media pipeline

**Accountable:** ED · **Reviewers/partners:** PO, GAME, BE, FE, LEGAL, QA · **Priority:** P1 · **Initial state:** T · **Gate:** G1

**Entry dependencies:** PROD promise; SEC safe rendering/fetch; API contracts. **External needs/blockers:** Actual content/export files and rights evidence from owner.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **CAT.01 — Inventory every seeded and imported game.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Separate real play from editorial references.
  - **Uses / connects:** data/seed/content.json, D1 export, engine registry.
  - **Done when:** Inventory lists price, platform, host, playable mode and missing evidence.

- [x] **CAT.02 — Classify playable versus editorial catalog entries.**
  - **2026-10-28 state: V.** Seed marks four commercial references nonplayable; builtin-only homepage count and no unreviewed iframe. Shared media URL helper tested; homepage loads actual image through web proxy.
  - **Why / outcome:** Keep the free-play promise honest.
  - **Uses / connects:** Shared Game model, cards, catalog API.
  - **Done when:** Non-playable/commercial references cannot appear as playable free games.

- [ ] **CAT.03 — Choose the minimum launch collection.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Favor tested quality over inflated counts.
  - **Uses / connects:** Research needs, rights ledger, four built-in engines.
  - **Done when:** Owner approves a small catalog with device coverage and guide support.

- [ ] **CAT.04 — Record rights for games, covers, fonts and writing.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Hosting or seeing an asset is not permission.
  - **Uses / connects:** License documents, author/provider consent, provenance.
  - **Done when:** Each public asset has rights status; unknown assets held back.

- [ ] **CAT.05 — Create a capability schema.**
  - **Why / outcome:** Filter by actual user needs.
  - **Uses / connects:** Touch/keyboard/gamepad, offline, orientation, size, session length.
  - **Done when:** Typed capabilities have validated defaults and editor explanations.

- [ ] **CAT.06 — Define game/provider approval criteria.**
  - **Why / outcome:** Reject unsafe or unreliable embeds.
  - **Uses / connects:** Provider origin, CSP/frame permissions, trackers, ratings.
  - **Done when:** Provider review checklist and revocation process approved.

- [x] **CAT.07 — Correct media URL normalization.**
  - **2026-10-28 state: V.** Seed marks four commercial references nonplayable; builtin-only homepage count and no unreviewed iframe. Shared media URL helper tested; homepage loads actual image through web proxy.
  - **Why / outcome:** Remove duplicated /media prefixes.
  - **Uses / connects:** lib/api.ts, seed records, imported URLs, OG images.
  - **Done when:** Bare keys, prefixed paths and approved absolute URLs each resolve once.

- [ ] **CAT.08 — Choose immutable content-hash or versioned keys.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Match cache lifetime to asset mutability.
  - **Uses / connects:** upload-media.mjs, R2 keys, stored media references.
  - **Done when:** Replacing an image changes its URL or invalidates every cache correctly.

- [ ] **CAT.09 — Generate appropriately sized image variants.**
  - **Why / outcome:** Reduce mobile data while keeping art readable.
  - **Uses / connects:** Build/upload image processing, AVIF/WebP fallback, media metadata.
  - **Done when:** Width/height/srcset available; image quality and byte budgets measured.

- [ ] **CAT.10 — Implement safe upload validation.**
  - **Why / outcome:** Prevent media becoming executable/unbounded storage.
  - **Uses / connects:** MIME sniffing, extension/size limits, SVG policy, access control.
  - **Done when:** Wrong MIME, oversized and executable upload fixtures rejected.

- [ ] **CAT.11 — Add alt text and rights metadata.**
  - **Why / outcome:** Make assets usable and auditable.
  - **Uses / connects:** Media inventory, content schemas, editor controls.
  - **Done when:** Meaningful images require useful alt; decorative images marked appropriately.

- [ ] **CAT.12 — Validate approved external media/frames.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Make remote content work without wildcard CSP.
  - **Uses / connects:** next.config.ts, provider registry, sanitized content.
  - **Done when:** Approved origins render; unapproved origins fail with understandable fallback.

- [ ] **CAT.13 — Add embed readiness/failure fallback.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Broken third-party games should not strand players.
  - **Uses / connects:** Game detail UI, timeout/readiness where supported, safe external link.
  - **Done when:** Blocked/unavailable host shows retry/alternative; no false success measurement.

- [ ] **CAT.14 — Reconcile descriptions and control instructions.**
  - **2026-10-28 state: I.** Privacy/help copy, local-data reset, playable/editorial separation and external-embed removal implemented; media cache shortened. Legal/rights inventory, all local-storage failure cases, immutable/versioned media and catalog/device review remain open.
  - **Why / outcome:** Stop marketing features the engines do not have.
  - **Uses / connects:** Seed prose, engine mechanics, device controls.
  - **Done when:** Each launch game's rules match observed play and supported inputs.

- [ ] **CAT.15 — Create a catalog health checker.**
  - **Why / outcome:** Detect broken content after providers change.
  - **Uses / connects:** URLs, rights expiries, media references, synthetic play probes.
  - **Done when:** Scheduled report identifies failures without hammering external hosts.

- [ ] **CAT.16 — Add a public report-broken-game action.**
  - **Why / outcome:** Collect actionable device evidence safely.
  - **Uses / connects:** Support form, game slug/version, optional diagnostics.
  - **Done when:** Report reaches triage without unnecessary fingerprinting.

- [ ] **CAT.17 — Review real migration content before publication.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Seed fixtures are not a real archive migration.
  - **Uses / connects:** Blogger inventory, missing media/excerpts, copyright review.
  - **Done when:** Real content owner signs parity/rights report before cutover.

<a id="workstream-web"></a>

### WEB — Web discovery, reading and responsive usability

**Accountable:** FE · **Reviewers/partners:** UX, QA, ED, BE · **Priority:** P1 · **Initial state:** T · **Gate:** G1

**Entry dependencies:** CAT capability model; API contracts; research insights. **External needs/blockers:** Representative users and browser/device access.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **WEB.01 — Map responsive information architecture.**
  - **Why / outcome:** Make play the primary journey.
  - **Uses / connects:** Homepage, browse, game details, guides, search, saved items.
  - **Done when:** Mobile and desktop navigation priorities approved.

- [ ] **WEB.02 — Define loading/empty/error/offline UI states.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Avoid dead ends and developer-only messages.
  - **Uses / connects:** Shared primitives, route error boundaries, API timeout errors.
  - **Done when:** Every core route has tested visitor-facing states and retry behavior.

- [ ] **WEB.03 — Make Play now truthful and prominent.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Reduce time-to-game without misleading users.
  - **Uses / connects:** Capability model, home hero, game cards.
  - **Done when:** Play CTA only targets supported playable items; editorial links labelled Read.

- [ ] **WEB.04 — Repair facets using complete API metadata.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Filters should not disappear on later pages.
  - **Uses / connects:** games API genres/capabilities, games/page.tsx.
  - **Done when:** Facets remain stable across sort/page/search combinations.

- [ ] **WEB.05 — Preserve filters and sort through pagination.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Make browsing reversible and shareable.
  - **Uses / connects:** Query parser, sort control, pagination, back navigation.
  - **Done when:** Reload/back/deep-link restore the same result state.

- [ ] **WEB.06 — Design mobile-friendly filter controls.**
  - **Why / outcome:** Fit useful choices without overcrowding.
  - **Uses / connects:** Touch targets, chips/drawer, URL state.
  - **Done when:** Users can apply/clear multiple filters at narrow widths.

- [ ] **WEB.07 — Improve search input and results states.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Find useful games/guides despite latency.
  - **Uses / connects:** Search palette/page, abortable requests, result types.
  - **Done when:** Stale responses cannot overwrite newer query; error/no-results handled.

- [ ] **WEB.08 — Fix mobile menu and search focus lifecycle.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Keyboard and screen-reader navigation must work.
  - **Uses / connects:** Header, search dialog, focus trap/return, Escape.
  - **Done when:** Focus stays in open modal and returns to trigger; background is inert.

- [ ] **WEB.09 — Add skip navigation and coherent headings.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Make long pages navigable.
  - **Uses / connects:** Root layout, landmarks, article/game headings.
  - **Done when:** Keyboard skip link and heading outline pass manual review.

- [ ] **WEB.10 — Build a touch-friendly game-detail layout.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Keep controls visible without accidental scrolling.
  - **Uses / connects:** Player, instructions, leaderboard, safe-area CSS.
  - **Done when:** Portrait/landscape layouts preserve play area and reachable controls.

- [ ] **WEB.11 — Improve guide readability and game links.**
  - **Why / outcome:** Help players solve actual problems.
  - **Uses / connects:** Prose rendering, TOC, game/version references.
  - **Done when:** Useful headings and readable line lengths; related game link is correct.

- [ ] **WEB.12 — Implement local favorites.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Support return visits without account friction.
  - **Uses / connects:** Browser storage adapter, cards/detail, saved page.
  - **Done when:** Save/remove persists; denied storage has graceful fallback.

- [ ] **WEB.13 — Implement bounded recent-play history.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Help visitors resume discovery privately.
  - **Uses / connects:** Local timestamps/game IDs, clear-data control.
  - **Done when:** History updates only on real play; cap/clear behavior tested.

- [ ] **WEB.14 — Add safe shareable links.**
  - **Why / outcome:** Let users recommend games without tracking clutter.
  - **Uses / connects:** Canonical game URLs, Web Share fallback.
  - **Done when:** Supported share works; unsupported browsers copy a clean URL.

- [ ] **WEB.15 — Remove production ad placeholders when ads are off.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Do not ship debug inventory as user content.
  - **Uses / connects:** Ad component, environment modes, layout reservations.
  - **Done when:** Production disabled-ads mode shows no debug slots or unused gaps.

- [ ] **WEB.16 — Fix static-page params and runtime rendering.**
  - **2026-10-28 state: I.** Web source updated for content truthfulness, discovery/filter/search, focus/skip-link, local library, page metadata and ad gating. Build and representative mobile-viewport browser journeys pass; all task-specific states/accessibility/device acceptance remain open.
  - **Why / outcome:** Prevent wrong build parameters and stale outage pages.
  - **Uses / connects:** [page]/generateStaticParams, route caching, API availability.
  - **Done when:** Build with real backend resolves expected pages; outage/recovery tests pass.

- [ ] **WEB.17 — Audit every public route at responsive breakpoints.**
  - **Why / outcome:** Catch overflow and hidden controls.
  - **Uses / connects:** Screenshots at narrow/mobile/tablet/desktop widths.
  - **Done when:** No horizontal overflow or obscured critical actions; visual changes reviewed.

- [ ] **WEB.18 — Run moderated usability validation.**
  - **Why / outcome:** Confirm repairs meet audience needs.
  - **Uses / connects:** PROD journey scripts, representative users.
  - **Done when:** Observed blockers resolved or explicitly gated before beta.

<a id="workstream-game"></a>

### GAME — Game mechanics, touch controls and engine lifecycle

**Accountable:** GAME · **Reviewers/partners:** FE, AND, UX, QA · **Priority:** P1 · **Initial state:** T · **Gate:** G1; reusable foundation for G3

**Entry dependencies:** CAT verified game rules; QA browser harness. **External needs/blockers:** Touch-only and lower-end reference devices.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **GAME.01 — Write a behavior specification for each game.**
  - **Why / outcome:** Tests need clear rules rather than prose guesses.
  - **Uses / connects:** Breakout, Dodge, Snake, Gravity source and descriptions.
  - **Done when:** Controls, scoring, win/loss, restart and difficulty rules agreed.

- [ ] **GAME.02 — Extract simulation seams for deterministic tests.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Make physics and edge cases reproducible.
  - **Uses / connects:** Engine classes, clock/RNG adapters, state snapshots.
  - **Done when:** Fixed seed/input trace yields same supported simulation result.

- [x] **GAME.03 — Scope keyboard capture to the focused player.**
  - **2026-10-28 state: V.** packages/game-core and RunClock; tests/games.test.ts verify focus, Space serving, pause-excluded timing, replay result scope, RAF lifecycle and full Snake board. Browser control journey passes.
  - **Why / outcome:** Avoid swallowing typing, scrolling or shortcuts.
  - **Uses / connects:** GameCore listeners, form fields, focus state.
  - **Done when:** Leaderboard name/search typing unaffected; focused play keys work.

- [x] **GAME.04 — Separate Breakout launch from pause handling.**
  - **2026-10-28 state: V.** packages/game-core and RunClock; tests/games.test.ts verify focus, Space serving, pause-excluded timing, replay result scope, RAF lifecycle and full Snake board. Browser control journey passes.
  - **Why / outcome:** Space currently toggles pause before launch.
  - **Uses / connects:** GameCore onKeyDown, Breakout keyPress.
  - **Done when:** Start → serve → lose life → serve works with keyboard and touch.

- [ ] **GAME.05 — Add accessible on-screen pause/resume/restart.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Touch users need all lifecycle controls.
  - **Uses / connects:** GameEngine overlay/topbar, aria labels, confirmation policy.
  - **Done when:** All controls reachable by touch/keyboard; restart never accidental.

- [ ] **GAME.06 — Implement Gravity touch thrust.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** All launch games must be genuinely mobile playable.
  - **Uses / connects:** Direction pad/virtual stick, normalized input adapter.
  - **Done when:** Touch-only user can steer, collect and finish/restart a run.

- [ ] **GAME.07 — Harden Snake swipe and optional direction controls.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Avoid stale swipes or inaccessible gesture-only play.
  - **Uses / connects:** Pointer lifecycle, direction queue, visible controls.
  - **Done when:** Pointerup/cancel clears gestures; reversals/rapid inputs behave correctly.

- [ ] **GAME.08 — Harden Breakout and Dodge pointer controls.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Prevent stuck input and off-canvas surprises.
  - **Uses / connects:** Pointer capture/cancel, coordinate transforms, resize handling.
  - **Done when:** Dragging across bounds and multi-touch interruptions do not leave input stuck.

- [ ] **GAME.09 — Reset input on blur and visibility changes.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Avoid unintended movement after interruptions.
  - **Uses / connects:** GameCore key state, tab/app lifecycle.
  - **Done when:** Lost focus clears pressed keys and pauses safely.

- [x] **GAME.10 — Measure active play time per run.**
  - **2026-10-28 state: V.** packages/game-core and RunClock; tests/games.test.ts verify focus, Space serving, pause-excluded timing, replay result scope, RAF lifecycle and full Snake board. Browser control journey passes.
  - **Why / outcome:** Replay and pause time must not inflate score plausibility.
  - **Uses / connects:** GameEngine start/reset, monotonic clock, pause accumulator.
  - **Done when:** Multiple runs each get fresh IDs and accurate active duration.

- [x] **GAME.11 — Emit one scoped result per finished run.**
  - **2026-10-28 state: V.** packages/game-core and RunClock; tests/games.test.ts verify focus, Space serving, pause-excluded timing, replay result scope, RAF lifecycle and full Snake board. Browser control journey passes.
  - **Why / outcome:** Avoid duplicate or cross-game score submission.
  - **Uses / connects:** GameEngine → typed result event/callback → leaderboard.
  - **Done when:** Restart/remount/replay emits exactly one result for the correct game/version.

- [x] **GAME.12 — Stop unnecessary frame loops when inactive.**
  - **2026-10-28 state: V.** packages/game-core and RunClock; tests/games.test.ts verify focus, Space serving, pause-excluded timing, replay result scope, RAF lifecycle and full Snake board. Browser control journey passes.
  - **Why / outcome:** Preserve battery and device responsiveness.
  - **Uses / connects:** RAF lifecycle, paused/over/hidden states.
  - **Done when:** No continuous draw loop while inactive; resume does not duplicate RAF.

- [ ] **GAME.13 — Handle unavailable canvas and low memory.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Failing rendering must not crash the whole page.
  - **Uses / connects:** Canvas context creation, error boundary, retry/fallback.
  - **Done when:** Unsupported/context-loss fixture shows useful alternatives.

- [x] **GAME.14 — Fix Snake full-board completion.**
  - **2026-10-28 state: V.** packages/game-core and RunClock; tests/games.test.ts verify focus, Space serving, pause-excluded timing, replay result scope, RAF lifecycle and full Snake board. Browser control journey passes.
  - **Why / outcome:** Food placement must terminate when no cell is free.
  - **Uses / connects:** Snake placeFood, terminal win state.
  - **Done when:** Near-full/full-board deterministic tests complete without infinite loop.

- [ ] **GAME.15 — Test Snake tail, respawn and food invariants.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Prevent false collision or unreachable food.
  - **Uses / connects:** Tick order, growth, lives, respawn placement.
  - **Done when:** Rules documented; collisions and post-respawn food remain valid.

- [ ] **GAME.16 — Test Breakout collisions and high speeds.**
  - **Why / outcome:** Keep ball/brick physics stable under acceleration.
  - **Uses / connects:** Fixed timestep, collision resolution, level reset.
  - **Done when:** Edge/corner/high-speed tests avoid tunneling or trapped loops within supported range.

- [ ] **GAME.17 — Test Dodge spawn and survival scoring.**
  - **Why / outcome:** Balance challenge across refresh rates.
  - **Uses / connects:** Seeded RNG, timestep, elapsed score.
  - **Done when:** Equivalent active time/input produces consistent bounded difficulty.

- [ ] **GAME.18 — Test Gravity orbit, collision and completion.**
  - **Why / outcome:** Ensure scoring/win behavior matches description.
  - **Uses / connects:** Simulation traces, sun/orb collision, bonus score.
  - **Done when:** Win/loss/replay state and best score are consistent.

- [ ] **GAME.19 — Pass supported difficulty/config into engines.**
  - **Why / outcome:** Do not silently ignore catalog configuration.
  - **Uses / connects:** BuiltinGameConfig, constructors, UI labels.
  - **Done when:** Unsupported config rejected; supported levels have explicit tested effect.

- [ ] **GAME.20 — Add DOM-readable status and instructions.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Canvas-only information excludes assistive users.
  - **Uses / connects:** Score/lives/phase DOM text, restrained live announcements.
  - **Done when:** Screen-reader can identify state/control purpose without constant chatter.

- [ ] **GAME.21 — Add reduced-effects and quality settings.**
  - **2026-10-28 state: I.** Shared engines/mobile controls, visibility/input cleanup, canvas fallback, Snake/Gravity fixes and reduced-motion styling implemented. Unit/browser evidence in docs/status.md; full simulations, assistive technology and physical-device acceptance remain open.
  - **Why / outcome:** Prioritize input and battery over glow.
  - **Uses / connects:** Canvas effects, DPR cap, motion preference, local settings.
  - **Done when:** Low tier meets agreed frame budget; setting persists safely.

- [ ] **GAME.22 — Support fullscreen and orientation transitions.**
  - **Why / outcome:** Increase mobile play area without trapping users.
  - **Uses / connects:** Fullscreen API/native adapter, safe areas, resize tests.
  - **Done when:** Enter/exit/back/rotation preserve a valid paused or active state.

- [ ] **GAME.23 — Run endurance and route-unmount tests.**
  - **Why / outcome:** Find leaks and repeated listener accumulation.
  - **Uses / connects:** Long sessions, mount/destroy counts, memory profiles.
  - **Done when:** Repeated navigation leaves no active timers/listeners; memory stabilizes.

- [ ] **GAME.24 — Playtest every launch game on reference devices.**
  - **Why / outcome:** Simulated touch does not prove real usability.
  - **Uses / connects:** Low/mid/high Android, desktop keyboard, accessibility checks.
  - **Done when:** Completed device matrix with control, heat, latency and failure notes.

<a id="workstream-score"></a>

### SCORE — Player identity and fair casual leaderboards

**Accountable:** BE · **Reviewers/partners:** GAME, FE, AND, SEC, MOD, QA · **Priority:** P1 · **Initial state:** T · **Gate:** Before public scores activate

**Entry dependencies:** SEC atomic limits/idempotency; GAME scoped results; DATA identity decision. **External needs/blockers:** Owner decision on casual ranking; no prizes assumed.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **SCORE.01 — Define leaderboard trust and identity semantics.**
  - **Why / outcome:** Avoid calling self-reported scores verified competition.
  - **Uses / connects:** Existing scores schema, daily visitor hashes, display names.
  - **Done when:** Casual/unverified status, ranking identity and retention policy approved.

- [ ] **SCORE.02 — Choose an anonymous player identifier model.**
  - **Why / outcome:** Separate a player from name, IP and analytics hash.
  - **Uses / connects:** First-party random ID/session design, local storage, privacy review.
  - **Done when:** Name collisions and shared NAT do not merge distinct players; reset limitations disclosed.

- [ ] **SCORE.03 — Add identity and game-version fields.**
  - **Why / outcome:** Keep rules/versions from mixing on a board.
  - **Uses / connects:** D1 migration, shared score models, engine version registry.
  - **Done when:** Old data has explicit migration/archive treatment and reversible migration.

- [ ] **SCORE.04 — Issue bounded play-session records where justified.**
  - **Why / outcome:** Improve replay control without promising cheat-proof clients.
  - **Uses / connects:** API session issuance, expiry, nonce, engine/rules version.
  - **Done when:** Expired, wrong-game and replayed sessions rejected; no client secret shipped.

- [ ] **SCORE.05 — Validate score types, timing and engine bounds.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Reject trivial forged/inconsistent submissions.
  - **Uses / connects:** Runtime schemas, per-engine rules, active elapsed time.
  - **Done when:** Missing/NaN/negative/infinite timing and impossible scores follow explicit rejection rules.

- [x] **SCORE.06 — Enforce storage-level submission uniqueness.**
  - **2026-10-28 state: V.** 0003_security.sql unique game/player/session index; duplicate submission Worker regression. Scores remain client-reported/untrusted.
  - **Why / outcome:** Close check-then-insert races.
  - **Uses / connects:** D1 unique index, idempotency response mapping.
  - **Done when:** Simultaneous identical submissions create one row.

- [ ] **SCORE.07 — Select deterministic best rows and tie breaks.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Current MAX aggregates can mix score metadata.
  - **Uses / connects:** SQL ranking/window query, stable timestamps/IDs.
  - **Done when:** Returned detail/date belong to the winning row; tie tests pass.

- [ ] **SCORE.08 — Compute personal best independently of public cache.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Prevent cross-player leakage.
  - **Uses / connects:** Identity lookup, public board cache, no-store personal response.
  - **Done when:** Two callers never receive each other's personal record.

- [ ] **SCORE.09 — Offer explicit score publishing and name controls.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Respect privacy and moderate public names.
  - **Uses / connects:** Game-over UI, name validation, opt-in copy, local best.
  - **Done when:** Players understand what becomes public; local play works without publishing.

- [ ] **SCORE.10 — Handle submission failures visibly and safely.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Retrying should not lose play or silently fail.
  - **Uses / connects:** Leaderboard UI, result queue, Retry-After, idempotency.
  - **Done when:** Offline/429/422/500 show useful status; retry cannot double-submit.

- [ ] **SCORE.11 — Separate offline/local scores from ranked results.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Offline data is not automatically trustworthy.
  - **Uses / connects:** Local game storage, online board eligibility policy.
  - **Done when:** Offline best labelled local; ranked eligibility enforced server-side.

- [ ] **SCORE.12 — Add reporting and moderation for names/scores.**
  - **Why / outcome:** Give operator a practical abuse response.
  - **Uses / connects:** Admin scores, report route, moderation audit, cache invalidation.
  - **Done when:** Removal/review action records reason and updates public board.

- [ ] **SCORE.13 — Test name collision, rename and daily boundaries.**
  - **Why / outcome:** Prove identity is not display name or daily hash.
  - **Uses / connects:** Concurrent fixtures, UTC rollover, shared network tests.
  - **Done when:** Distinct players remain distinct; rank and personal best stable by policy.

- [ ] **SCORE.14 — Gate stronger competitive features.**
  - **2026-10-28 state: I.** Timing/deduplication, deterministic best-row query, personal no-cache handling and local-versus-public copy implemented. Client-reported rank integrity, identity/NAT fairness, privacy approval and complete failure/consent UX remain open.
  - **Why / outcome:** Avoid misleading anti-cheat claims or unsafe prizes.
  - **Uses / connects:** Server replay/deterministic-validation feasibility ADR.
  - **Done when:** Any future prizes require separate integrity/legal scope; casual launch copy honest.

<a id="workstream-com"></a>

### COM — Newsletter, comments, contact and community operations

**Accountable:** BE · **Reviewers/partners:** FE, MOD, SEC, LEGAL, QA · **Priority:** P1 · **Initial state:** T · **Gate:** Feature-specific activation before G2/G4

**Entry dependencies:** SEC token/validation fixes; DATA retention; MOD coverage approved. **External needs/blockers:** Verified sender domain and email-provider access; moderator staffing.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **COM.01 — Choose email provider and delivery contract.**
  - **Why / outcome:** Production opt-in needs real reliable inbox delivery.
  - **Uses / connects:** Existing sendMail adapter, provider limits, vendor review.
  - **Done when:** Approved provider/configuration; local fake adapter separated.

- [ ] **COM.02 — Configure sender identity and DNS authentication.**
  - **Why / outcome:** Reduce spoofing and deliverability failures.
  - **Uses / connects:** Domain owner, SPF/DKIM/DMARC setup and provider verification.
  - **Done when:** Provider verification and independent delivery checks recorded.

- [ ] **COM.03 — Create versioned email templates with safe links.**
  - **2026-10-28 state: I.** Confirmation email now includes opt-out; target cleanup, CSV formula escaping, totals/contact bounds improved. Unit/local API evidence only; template render review, spreadsheet-client checks, full queue/moderation and delivery workflows remain open.
  - **Why / outcome:** Make messages understandable and non-injectable.
  - **Uses / connects:** Confirmation/support templates, approved site origin, escaping.
  - **Done when:** Text/HTML/mobile render review; no unescaped user fields.

- [ ] **COM.04 — Add durable delivery jobs or transactional outbox.**
  - **Why / outcome:** Avoid losing confirmation when requests fail.
  - **Uses / connects:** D1 job state, queue/worker, provider adapter.
  - **Done when:** Pending job survives restart and retries with bounded backoff.

- [ ] **COM.05 — Add provider idempotency and retry limits.**
  - **Why / outcome:** Avoid duplicate emails and cost storms.
  - **Uses / connects:** Delivery key, retry schedule, failure queue.
  - **Done when:** Timeout/retry produces at most intended deliveries; terminal failure visible.

- [ ] **COM.06 — Handle bounce/complaint webhooks securely.**
  - **Why / outcome:** Stop emailing unreachable or unwilling recipients.
  - **Uses / connects:** Signed webhook verification, replay defense, suppression ledger.
  - **Done when:** Forged/replayed events rejected; hard bounce/complaint suppresses future sends.

- [x] **COM.07 — Implement safe subscription token lifecycle.**
  - **2026-10-28 state: V.** tests/worker.test.ts validates subscription confirm/expiry/unsubscribe/resubscribe and comment target/parent boundaries; confirmation mail opt-out tested with fake provider.
  - **Why / outcome:** Complete double opt-in without token reuse.
  - **Uses / connects:** SEC changes, token hashes/expiry, pending/confirmed/unsubscribed states.
  - **Done when:** End-to-end subscribe-confirm-unsubscribe-resubscribe tests pass.

- [ ] **COM.08 — Implement resend and link-expiry UX.**
  - **2026-10-28 state: I.** Confirmation email now includes opt-out; target cleanup, CSV formula escaping, totals/contact bounds improved. Unit/local API evidence only; template render review, spreadsheet-client checks, full queue/moderation and delivery workflows remain open.
  - **Why / outcome:** Let legitimate users recover without enumeration.
  - **Uses / connects:** Web forms, API throttles, email templates.
  - **Done when:** Expired link offers safe resend; responses do not reveal membership.

- [ ] **COM.09 — Add newsletter send workflow and opt-out checks.**
  - **Why / outcome:** A signup form is not a complete newsletter operation.
  - **Uses / connects:** Approved ESP or campaign job, suppression list, unsubscribe links.
  - **Done when:** Test campaign reaches only confirmed unsuppressed test recipients; dry-run available.

- [x] **COM.10 — Correct comment parent/target validation.**
  - **2026-10-28 state: V.** tests/worker.test.ts validates subscription confirm/expiry/unsubscribe/resubscribe and comment target/parent boundaries; confirmation mail opt-out tested with fake provider.
  - **Why / outcome:** Same slug in different content types must not cross-link.
  - **Uses / connects:** comments.ts, target type/ID, parent status/depth.
  - **Done when:** Cross-type/unknown/rejected parent tests fail safely.

- [ ] **COM.11 — Define delete/unpublish discussion behavior.**
  - **2026-10-28 state: I.** Confirmation email now includes opt-out; target cleanup, CSV formula escaping, totals/contact bounds improved. Unit/local API evidence only; template render review, spreadsheet-client checks, full queue/moderation and delivery workflows remain open.
  - **Why / outcome:** Prevent comments reappearing under reused slugs.
  - **Uses / connects:** Stable content IDs, FK policy, tombstones, cache.
  - **Done when:** Delete/recreate fixture cannot attach old discussion unintentionally.

- [ ] **COM.12 — Add bounded comment pagination and reply depth.**
  - **Why / outcome:** Avoid huge payloads and unreachable older discussion.
  - **Uses / connects:** Public comment query, cursor, recursive UI policy.
  - **Done when:** Large threads page consistently; depth and rendering limits enforced.

- [ ] **COM.13 — Add clear submission/moderation feedback.**
  - **Why / outcome:** Users should know pending is not public.
  - **Uses / connects:** Comment form, validation, status copy, retry behavior.
  - **Done when:** Pending content remains private; failures are actionable and accessible.

- [ ] **COM.14 — Protect CSV exports from spreadsheet injection.**
  - **2026-10-28 state: I.** Confirmation email now includes opt-out; target cleanup, CSV formula escaping, totals/contact bounds improved. Unit/local API evidence only; template render review, spreadsheet-client checks, full queue/moderation and delivery workflows remain open.
  - **Why / outcome:** Escaping quotes alone does not stop formulas.
  - **Uses / connects:** Subscriber CSV, dangerous leading-character policy.
  - **Done when:** Formula-like names/sources export inertly in tested spreadsheet handling.

- [ ] **COM.15 — Correct admin totals and missing-item behavior.**
  - **2026-10-28 state: I.** Confirmation email now includes opt-out; target cleanup, CSV formula escaping, totals/contact bounds improved. Unit/local API evidence only; template render review, spreadsheet-client checks, full queue/moderation and delivery workflows remain open.
  - **Why / outcome:** Capped result sets must not pretend to be full totals.
  - **Uses / connects:** Subscribers/comments/inbox APIs, DB COUNT, 404/409 handling.
  - **Done when:** More-than-page fixtures have accurate totals and pagination.

- [ ] **COM.16 — Add report, appeal and moderator procedures.**
  - **Why / outcome:** Human review needs consistent policy and ownership.
  - **Uses / connects:** Community rules, report inbox, audit log, escalation.
  - **Done when:** Moderator can triage/report/remove/appeal using documented steps.

- [ ] **COM.17 — Improve contact queue and acknowledgements.**
  - **2026-10-28 state: I.** Confirmation email now includes opt-out; target cleanup, CSV formula escaping, totals/contact bounds improved. Unit/local API evidence only; template render review, spreadsheet-client checks, full queue/moderation and delivery workflows remain open.
  - **Why / outcome:** Do not silently lose user problems.
  - **Uses / connects:** Contact DB write, async notification, inbox statuses.
  - **Done when:** Provider failure leaves durable message; read/archive/reply workflow tested.

- [ ] **COM.18 — Add moderation and support capacity monitoring.**
  - **Why / outcome:** Avoid publishing community features with no coverage.
  - **Uses / connects:** Queue age/count, owner alerts, feature flags.
  - **Done when:** Backlog threshold triggers response or disables new submissions safely.

<a id="workstream-mig"></a>

### MIG — Safe legacy migration and precise import rollback

**Accountable:** BE · **Reviewers/partners:** ED, OPS, SEC, QA · **Priority:** P1 · **Initial state:** T · **Gate:** Before real migration/cutover

**Entry dependencies:** SEC safe fetch/render; API migrations/cache; CAT rights inventory. **External needs/blockers:** Real Blogger export/feed, old-domain control and source inventory.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **MIG.01 — Capture a read-only source inventory and backup.**
  - **Why / outcome:** Preserve original content before transformation.
  - **Uses / connects:** Blogger export, feed pages, URL/media inventory, checksums.
  - **Done when:** Owner-approved snapshot stored privately; counts and coverage recorded.

- [ ] **MIG.02 — Determine source-domain redirect capability.**
  - **Why / outcome:** New-site middleware cannot redirect requests still served by Blogspot.
  - **Uses / connects:** Domain/DNS ownership, Blogger hosting behavior, old URL samples.
  - **Done when:** Separate old-host and new-host transition plan with limitations documented.

- [ ] **MIG.03 — Test feed completeness and pagination.**
  - **Why / outcome:** A single capped feed can omit older posts/pages.
  - **Uses / connects:** Source feed settings, next links/export, entry IDs.
  - **Done when:** Expected post/page counts reconciled; truncated/excerpt entries flagged.

- [ ] **MIG.04 — Define source identity and collision policy.**
  - **Why / outcome:** Slug matching alone can update the wrong document.
  - **Uses / connects:** source namespace/source_id, slug history, conflict report.
  - **Done when:** Same title/different source and same source/changed slug handled explicitly.

- [ ] **MIG.05 — Preserve original dates for all content kinds.**
  - **Why / outcome:** Static pages also have publication history.
  - **Uses / connects:** ImportPage types, parser mappings, D1 fields.
  - **Done when:** Post/guide/page original dates survive import and rerun.

- [ ] **MIG.06 — Fix source-kind and label propagation.**
  - **Why / outcome:** Accurate provenance is needed for audit and rollback.
  - **Uses / connects:** ParsedImport.kind/label, admin headers, runImport.
  - **Done when:** RSS/Blogger/manual runs retain correct source metadata.

- [ ] **MIG.07 — Persist run status before any mutations.**
  - **Why / outcome:** Partial failure must leave an auditable record.
  - **Uses / connects:** migration_runs, running/failed/completed states.
  - **Done when:** Injected failure midway leaves durable status and progress.

- [ ] **MIG.08 — Record per-row provenance and before-images.**
  - **Why / outcome:** Exact rollback needs row identities and prior revisions.
  - **Uses / connects:** migration_items, content revision IDs, created/updated markers.
  - **Done when:** Every mutation has stable row ID, job ID and restoration information.

- [ ] **MIG.09 — Define transactions/chunk boundaries and resumability.**
  - **Why / outcome:** Large archives exceed request/operation limits.
  - **Uses / connects:** D1 batches, job queue/checkpoints, retry keys.
  - **Done when:** Interrupted import resumes without duplication or lost audit rows.

- [ ] **MIG.10 — Make dry-run structurally representative.**
  - **Why / outcome:** Preview should catch conflicts and validation failures.
  - **Uses / connects:** Same schemas/mapping as apply, zero-write mode.
  - **Done when:** Snapshot comparison proves no data writes; preview matches applied scope.

- [ ] **MIG.11 — Handle tag removal and relational updates correctly.**
  - **Why / outcome:** Empty new tag lists should clear old associations.
  - **Uses / connects:** upsertTagsForDoc, stable source lookup, FK mapping.
  - **Done when:** Rerun adding/removing all tags and changing references passes.

- [ ] **MIG.12 — Fix media-host policy with rights approval.**
  - **Why / outcome:** One hardcoded host is not complete Blogger support.
  - **Uses / connects:** Approved source hosts, secure fetch adapter, media rights ledger.
  - **Done when:** Actual approved source fixtures transfer; unknown ownership remains blocked.

- [ ] **MIG.13 — Rewrite all relevant media references.**
  - **Why / outcome:** Inline images alone do not cover covers/srcset/guide art.
  - **Uses / connects:** HTML parser, image attributes, cover fields, media mapping.
  - **Done when:** Transferred articles have no unintended dependency on retired assets.

- [ ] **MIG.14 — Preserve full audit counts beyond 4000 items.**
  - **Why / outcome:** Large migrations need complete receipts.
  - **Uses / connects:** Chunked migration_items writes, stats aggregation.
  - **Done when:** Large fixture records every item and reconciles totals.

- [ ] **MIG.15 — Implement rollback preview and explicit confirmation.**
  - **2026-10-28 state: I.** Unsafe legacy rollback removed; endpoint now 409. This is containment, NOT completed reversal. Before-images/provenance, safe preview/conflict handling and restoration/caches remain open.
  - **Why / outcome:** Destructive actions must show exact scope.
  - **Uses / connects:** Job detail API/UI, row provenance and revisions.
  - **Done when:** Preview lists restores/deletes/conflicts; unrelated rows excluded.

- [ ] **MIG.16 — Implement safe per-job reversal and conflict handling.**
  - **2026-10-28 state: I.** Unsafe legacy rollback removed; endpoint now 409. This is containment, NOT completed reversal. Before-images/provenance, safe preview/conflict handling and restoration/caches remain open.
  - **Why / outcome:** Protect later editorial work and other runs.
  - **Uses / connects:** Before-images, revision checks, redirect/media/taxonomy ownership.
  - **Done when:** Interleaved run and later-edit tests preserve unrelated changes.

- [ ] **MIG.17 — Invalidate caches and rebuild search after rollback.**
  - **2026-10-28 state: I.** Unsafe legacy rollback removed; endpoint now 409. This is containment, NOT completed reversal. Before-images/provenance, safe preview/conflict handling and restoration/caches remain open.
  - **Why / outcome:** Reverted database alone is not a reverted product.
  - **Uses / connects:** API cache service, Next revalidation, FTS consistency.
  - **Done when:** Rolled-back content disappears from lists/search/feed/sitemap and web caches.

- [ ] **MIG.18 — Reconcile real migration before cutover.**
  - **Why / outcome:** A successful script exit is not content parity.
  - **Uses / connects:** Source totals, destination counts, sampled body/media/date/URL comparisons.
  - **Done when:** ED signs report; every warning resolved, accepted or withheld.

- [ ] **MIG.19 — Keep old site and recovery artifacts until sign-off.**
  - **Why / outcome:** Prevent irreversible loss during migration.
  - **Uses / connects:** Owner retention decision, redirect monitoring, backup/restore.
  - **Done when:** Retirement requires approved parity/traffic checks and documented fallback.

<a id="workstream-cms"></a>

### CMS — Editorial and operator tooling beyond import-only publishing

**Accountable:** FE · **Reviewers/partners:** BE, ED, SEC, MOD, UX, QA · **Priority:** P2 · **Initial state:** D · **Gate:** G5; earlier if launch publishing requires it

**Entry dependencies:** PROD operator research; SEC admin auth; API publication model; MIG revisions. **External needs/blockers:** Explicit scope decision; editor identity provider if selected.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **CMS.01 — Decide build-versus-integrate for editorial workflow.**
  - **Why / outcome:** Do not build a large CMS without operator need.
  - **Uses / connects:** Current import-driven process, cost/security comparison.
  - **Done when:** ADR chooses minimal in-app editor or approved integration with exit plan.

- [ ] **CMS.02 — Design admin access with short-lived sessions.**
  - **Why / outcome:** Long-lived bearer tokens in sessionStorage are weak operational access.
  - **Uses / connects:** Auth provider/session design, isolated admin origin/path, MFA.
  - **Done when:** Named operators, logout/revocation and least privilege documented.

- [ ] **CMS.03 — Define roles and authorization matrix.**
  - **Why / outcome:** Editors/moderators should not control infrastructure.
  - **Uses / connects:** Content, moderation, subscriber export, import/recovery permissions.
  - **Done when:** Server denies forbidden operations for every role in tests.

- [ ] **CMS.04 — Add audit trail for privileged changes.**
  - **Why / outcome:** Investigate mistakes and abuse.
  - **Uses / connects:** Actor/action/resource/reason/revision/time, redacted metadata.
  - **Done when:** Every destructive/publish/export action has a protected audit record.

- [ ] **CMS.05 — Build content list and filters.**
  - **Why / outcome:** Make operational inventory searchable.
  - **Uses / connects:** Games/posts/guides/pages APIs, status filters, pagination.
  - **Done when:** Editors can find drafts, errors, scheduled and published items.

- [ ] **CMS.06 — Implement structured game editor.**
  - **Why / outcome:** Preserve capability and rights validation.
  - **Uses / connects:** Engine registry, provider/rights/capability forms.
  - **Done when:** Invalid playable combinations cannot publish.

- [ ] **CMS.07 — Implement article/guide/page editor.**
  - **Why / outcome:** Enable safe content creation without raw database work.
  - **Uses / connects:** Sanitized structured/rich text, preview, metadata.
  - **Done when:** Save/preview/publish retains valid formatting and blocks active markup.

- [ ] **CMS.08 — Implement autosave and conflict detection.**
  - **Why / outcome:** Prevent lost work and concurrent overwrites.
  - **Uses / connects:** Revision numbers/ETags, local draft policy, server saves.
  - **Done when:** Conflicting edits prompt reconciliation; recoverable interrupted save tested.

- [ ] **CMS.09 — Add draft/review/schedule/publish transitions.**
  - **Why / outcome:** Make visibility intentional.
  - **Uses / connects:** Publication state machine, UTC schedule, permissions.
  - **Done when:** Draft previews private; scheduled content appears only at intended time.

- [ ] **CMS.10 — Build revision history and restore.**
  - **Why / outcome:** Recover editorial mistakes.
  - **Uses / connects:** MIG revision model, comparison view, audit trail.
  - **Done when:** Prior revision restores as a new revision without deleting later history.

- [ ] **CMS.11 — Add media library and usage/rights review.**
  - **Why / outcome:** Avoid orphaned or unlicensed assets.
  - **Uses / connects:** CAT media metadata, upload validation, referenced-by query.
  - **Done when:** Editor sees rights/alt/size; used assets cannot disappear silently.

- [ ] **CMS.12 — Add taxonomy rename/merge/archive tools.**
  - **Why / outcome:** Keep browse/search coherent as catalog grows.
  - **Uses / connects:** Categories/tags/authors, redirects, join updates.
  - **Done when:** Merge preserves relations; renamed archives redirect correctly.

- [ ] **CMS.13 — Add preview without analytics/ads.**
  - **Why / outcome:** Reviews should not pollute metrics or expose drafts.
  - **Uses / connects:** Authenticated preview tokens, no-store/noindex, ad flags.
  - **Done when:** Unauthorized preview denied; no public cache or ad requests.

- [ ] **CMS.14 — Add safe takedown and deletion UI.**
  - **Why / outcome:** Recover from rights/safety issues quickly.
  - **Uses / connects:** Cache service, stable IDs, confirmation and reason.
  - **Done when:** Previewed takedown reaches all public surfaces within bound.

- [ ] **CMS.15 — Add admin pagination and accessible controls.**
  - **Why / outcome:** Large datasets and keyboard users must be supported.
  - **Uses / connects:** Admin tabs/tables, real totals, focus/live status.
  - **Done when:** More-than-cap dataset navigable; keyboard workflow passes.

- [ ] **CMS.16 — Run operator acceptance sessions.**
  - **Why / outcome:** Validate actual day-to-day usefulness.
  - **Uses / connects:** ED/MOD scenario scripts, staging data.
  - **Done when:** Operator publishes, corrects, moderates and recovers without developer intervention.

<a id="workstream-seo"></a>

### SEO — Search, content quality and migration discoverability

**Accountable:** ED · **Reviewers/partners:** FE, BE, QA, LEGAL · **Priority:** P1 · **Initial state:** T · **Gate:** G1/G2

**Entry dependencies:** CAT truthful capabilities; API visibility; MIG redirect plan. **External needs/blockers:** Domain verification and search-console access for post-launch checks.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **SEO.01 — Map search intent to catalog and guide topics.**
  - **Why / outcome:** Serve useful needs rather than generic keyword pages.
  - **Uses / connects:** Research, existing archive, permitted aggregate query evidence.
  - **Done when:** Topic plan ties each page to a real user question/game.

- [ ] **SEO.02 — Create a representative search evaluation set.**
  - **Why / outcome:** Tune relevance with repeatable evidence.
  - **Uses / connects:** FTS5 queries, titles, synonyms, misspellings, expected results.
  - **Done when:** Human-labelled query set covers games/guides/posts and no-results cases.

- [ ] **SEO.03 — Normalize search text and bound query work.**
  - **2026-10-28 state: I.** Search race cancellation/focus and JSON-LD/OG image normalization improved. Build/security fixtures pass; full evaluation/crawl/schema/metadata route matrix remains open.
  - **Why / outcome:** Avoid HTML noise and expensive queries.
  - **Uses / connects:** FTS content, tokenization, length/type/limit validation.
  - **Done when:** Malformed/long queries bounded; user-facing excerpts contain readable text.

- [ ] **SEO.04 — Tune ranking and exact-title behavior.**
  - **Why / outcome:** Put the intended game ahead of incidental article matches.
  - **Uses / connects:** FTS weights, type boosts, deterministic ordering.
  - **Done when:** Evaluation set improves without hiding relevant guides.

- [ ] **SEO.05 — Add curated aliases and no-result recovery.**
  - **Why / outcome:** Handle common vocabulary without search SaaS complexity.
  - **Uses / connects:** Alias table/config, suggestions, fallback logic.
  - **Done when:** Common misses lead to useful alternatives; performance stays within budget.

- [ ] **SEO.06 — Audit canonical and robots behavior by route.**
  - **Why / outcome:** Avoid duplicate/filter/preview indexing mistakes.
  - **Uses / connects:** Page metadata, search/facet URLs, robots route, preview environment.
  - **Done when:** Canonical/noindex matrix tested; private/admin surfaces not indexable.

- [ ] **SEO.07 — Fix structured-data semantics and escaping.**
  - **2026-10-28 state: I.** Search race cancellation/focus and JSON-LD/OG image normalization improved. Build/security fixtures pass; full evaluation/crawl/schema/metadata route matrix remains open.
  - **Why / outcome:** Rich data must reflect actual price/platform/content.
  - **Uses / connects:** VideoGame/Article/Breadcrumb/ItemList generators, SEC JSON-LD fix.
  - **Done when:** Valid schemas and accurate claims; no guaranteed rich-result promise.

- [ ] **SEO.08 — Normalize OG images and social metadata.**
  - **2026-10-28 state: I.** Search race cancellation/focus and JSON-LD/OG image normalization improved. Build/security fixtures pass; full evaluation/crawl/schema/metadata route matrix remains open.
  - **Why / outcome:** Shared links need accessible working previews.
  - **Uses / connects:** Canonical media helper, absolute URLs, fallback art.
  - **Done when:** Representative URLs render correct title/description/image without broken prefixes.

- [ ] **SEO.09 — Generate sitemap only from eligible public content.**
  - **Why / outcome:** Drafts/deleted content must not be advertised.
  - **Uses / connects:** API visibility predicate, sitemap cache/size limits.
  - **Done when:** Every sitemap URL resolves appropriately; large catalog splits if needed.

- [ ] **SEO.10 — Keep feed dates/content and URL behavior consistent.**
  - **Why / outcome:** Support readers and migration tools reliably.
  - **Uses / connects:** RSS generation, XML escaping, public visibility, caching.
  - **Done when:** Feed parses, dates/links valid, removed content expires within bound.

- [ ] **SEO.11 — Test redirects, chains, queries and loops.**
  - **Why / outcome:** Preserve useful legacy traffic without unsafe destinations.
  - **Uses / connects:** Redirect registry, middleware, source-host plan.
  - **Done when:** Known paths reach intended canonical URL; no external open redirects or loops.

- [ ] **SEO.12 — Audit crawlable links and status codes.**
  - **Why / outcome:** Search engines need real navigation and useful errors.
  - **Uses / connects:** HTML links, 404/410/503 policy, API outage behavior.
  - **Done when:** Broken-link crawl passes; outages not mistaken for successful empty content.

- [ ] **SEO.13 — Verify domain and submit discovery endpoints.**
  - **Why / outcome:** Make launch discoverable and observable.
  - **Uses / connects:** Search console provider controls, sitemap, domain owner.
  - **Done when:** Ownership verified and sitemap submitted by authorized operator.

- [ ] **SEO.14 — Monitor migration/search quality after launch.**
  - **Why / outcome:** Detect ranking/indexing or relevance regressions.
  - **Uses / connects:** Crawl reports, 404s, search zero-results, guide usefulness.
  - **Done when:** 7/30/90-day review actions assigned; no promise to preserve rankings exactly.

<a id="workstream-perf"></a>

### PERF — Performance, accessibility and inclusive quality

**Accountable:** UX · **Reviewers/partners:** FE, GAME, AND, QA, OPS · **Priority:** P1 · **Initial state:** T · **Gate:** G1/G2/G3

**Entry dependencies:** WEB/GAME core journeys available; budgets ratified. **External needs/blockers:** Reference devices and screen-reader/manual testers.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **PERF.01 — Define repeatable performance profiles.**
  - **Why / outcome:** Compare improvements fairly.
  - **Uses / connects:** Low-tier Android, CPU/network throttling, cold/warm caches.
  - **Done when:** Device/browser/network/version conditions recorded in test protocol.

- [ ] **PERF.02 — Capture initial page and gameplay baselines.**
  - **Why / outcome:** Optimize actual bottlenecks.
  - **Uses / connects:** Lab traces, bundle analyzer, frame/memory profiling.
  - **Done when:** Measurements saved per core route/game before changes.

- [ ] **PERF.03 — Lazy-load game code by selected engine.**
  - **Why / outcome:** Browse pages should not pay for all engines.
  - **Uses / connects:** GameEngine imports, dynamic chunks, route boundaries.
  - **Done when:** Only selected engine loads when needed; startup remains within budget.

- [ ] **PERF.04 — Reduce nonessential client JavaScript.**
  - **Why / outcome:** Preserve interactivity on low-end devices.
  - **Uses / connects:** Framer Motion usage, server/client boundaries, fonts.
  - **Done when:** Route bundle report meets agreed budget or records justified exception.

- [ ] **PERF.05 — Optimize images and font loading.**
  - **Why / outcome:** Reduce bytes and layout shifts.
  - **Uses / connects:** CAT variants, dimensions, font subsets/preload.
  - **Done when:** Above-fold assets load promptly; no duplicate fonts/images fetched.

- [ ] **PERF.06 — Reserve stable layout space for dynamic content.**
  - **Why / outcome:** Prevent ads/images/boards shifting controls.
  - **Uses / connects:** CSS aspect ratios, consent/ad states, async panels.
  - **Done when:** CLS target met in slow-load and consent-change scenarios.

- [ ] **PERF.07 — Audit color, text scaling and motion.**
  - **Why / outcome:** Preserve visual identity without excluding readers.
  - **Uses / connects:** Design tokens, contrast tools, 200%/400% zoom, reduced motion.
  - **Done when:** Text/control contrast and zoom/reflow checks pass; motion preference respected.

- [ ] **PERF.08 — Audit touch targets and focus visibility.**
  - **Why / outcome:** Prevent missed taps and lost keyboard position.
  - **Uses / connects:** Buttons/menus/forms/game controls, mobile layouts.
  - **Done when:** Chosen web/native target sizes and focus requirements verified manually.

- [ ] **PERF.09 — Run keyboard-only journeys.**
  - **Why / outcome:** Find traps hidden by mouse testing.
  - **Uses / connects:** Browse/search/game/forms/admin where enabled.
  - **Done when:** All shell actions operable; focus order/return meaningful.

- [ ] **PERF.10 — Run screen-reader journeys.**
  - **Why / outcome:** Semantics need human verification.
  - **Uses / connects:** TalkBack, desktop reader, headings/status/errors.
  - **Done when:** Critical browse/read/form/control flows usable; game limitations documented.

- [ ] **PERF.11 — Provide accessible validation and announcements.**
  - **Why / outcome:** Make failure/success understandable.
  - **Uses / connects:** Forms, score updates, consent, offline state.
  - **Done when:** Field errors linked; live regions restrained; no color-only meaning.

- [ ] **PERF.12 — Test reduced data and storage-disabled behavior.**
  - **Why / outcome:** Do not assume unlimited connectivity or browser storage.
  - **Uses / connects:** Save-Data where supported, private mode, quota failures.
  - **Done when:** Essential browsing/play survives optional storage/telemetry failures.

- [ ] **PERF.13 — Profile battery, thermal and memory endurance.**
  - **Why / outcome:** Short demos can hide costly gameplay loops.
  - **Uses / connects:** 15–30 minute sessions, background transitions, quality settings.
  - **Done when:** No growing leaks; idle CPU minimized; device findings meet approved budgets.

- [ ] **PERF.14 — Enforce route budgets and regression alerts.**
  - **Why / outcome:** Keep later features from eroding quality.
  - **Uses / connects:** CI lab checks, field vitals with privacy review, release baselines.
  - **Done when:** Budget regression fails or needs explicit reviewed exception.

- [ ] **PERF.15 — Publish accessibility limitations and feedback path.**
  - **Why / outcome:** Be transparent while improving nonvisual gameplay support.
  - **Uses / connects:** Accessibility statement, support form, known issues.
  - **Done when:** Statement matches audit and has an owner/update date.

<a id="workstream-ads"></a>

### ADS — Optional advertising and sustainable monetization

**Accountable:** PO · **Reviewers/partners:** LEGAL, FE, AND, ED, QA, OPS · **Priority:** P2 · **Initial state:** D · **Gate:** Separate gate before any ads activate

**Entry dependencies:** DATA consent/legal review; WEB/PERF quality gates; provider approval. **External needs/blockers:** Publisher ownership/approval; then-current policies; CMP selection.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **ADS.01 — Decide whether ads are worthwhile at launch.**
  - **Why / outcome:** Revenue must exceed UX/compliance/maintenance costs.
  - **Uses / connects:** Traffic assumptions, spend model, audience feedback.
  - **Done when:** Written go/no-go; ad-free launch remains valid.

- [ ] **ADS.02 — Verify publisher and unit ownership.**
  - **Why / outcome:** Old slot IDs may not be usable inventory.
  - **Uses / connects:** Publisher account controls, placement inventory.
  - **Done when:** Authorized publisher and valid unit types recorded; no credentials committed.

- [ ] **ADS.03 — Review current platform/provider consent requirements.**
  - **Why / outcome:** Custom banner is not proof of policy compliance.
  - **Uses / connects:** Provider documentation and qualified privacy review at activation time.
  - **Done when:** Applicable CMP, regional/age and data-use requirements documented.

- [ ] **ADS.04 — Select and integrate approved consent tooling.**
  - **Why / outcome:** Make choices meaningful and enforceable.
  - **Uses / connects:** Certified CMP if required, web consent adapter, policy version.
  - **Done when:** Required choices available; no optional ad processing before allowed state.

- [ ] **ADS.05 — Default unknown/failed geo to safe behavior.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** Network/region errors must not auto-grant.
  - **Uses / connects:** geo endpoint/proxy, GB code, caching policy, fallback.
  - **Done when:** Unknown/GB/proxy cases tested; no shared cached country leakage.

- [ ] **ADS.06 — Use same-origin browser geo requests or remove geo dependency.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** Avoid exposed backend/localhost and CSP mismatch.
  - **Uses / connects:** lib/ads.ts, /api/geo rewrite, deployment env.
  - **Done when:** Browser request audit shows no localhost or unintended cross-origin call.

- [ ] **ADS.07 — Fix ad bootstrap and mounted-unit lifecycle.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** Script load alone does not request each ad correctly.
  - **Uses / connects:** Consent transitions, adsbygoogle unit push, route changes.
  - **Done when:** Accept-after-deny and new route units initialize once with no duplicates.

- [ ] **ADS.08 — Add persistent consent review/withdrawal control.**
  - **Why / outcome:** A one-time banner is insufficient control.
  - **Uses / connects:** Footer/settings, CMP API, stored policy version.
  - **Done when:** Revocation disables future requests and applies documented cleanup.

- [ ] **ADS.09 — Exclude gameplay/admin/errors/support-sensitive pages.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** Prevent accidental clicks and unnecessary tracking.
  - **Uses / connects:** Route-aware ad policy, root consent bootstrap, auto-ad settings.
  - **Done when:** Network tests show zero ad requests on excluded routes.

- [ ] **ADS.10 — Correct ads.txt seller identifiers and disabled state.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** Publish accurate authorized-seller data.
  - **Uses / connects:** ads.txt route, approved publisher configuration.
  - **Done when:** Valid seller line only when enabled; no placeholder publisher in production.

- [ ] **ADS.11 — Design conservative ad density and labels.**
  - **Why / outcome:** Keep content and controls primary.
  - **Uses / connects:** Placement map, responsive CSS, reserved dimensions.
  - **Done when:** No deceptive play/download lookalikes; content readable without ads.

- [ ] **ADS.12 — Test blocked/empty/slow ads without product failure.**
  - **Why / outcome:** Ads must not be a dependency for free play.
  - **Uses / connects:** Ad blocker/network failure/test creatives, layout.
  - **Done when:** Empty ad supply and blocked scripts do not break navigation or shift controls.

- [ ] **ADS.13 — Audit CSP and third-party request inventory.**
  - **Why / outcome:** Consent must constrain actual outgoing behavior.
  - **Uses / connects:** Browser network trace, approved provider domains.
  - **Done when:** Only reviewed origins load in approved states; no wildcard workaround.

- [ ] **ADS.14 — Separate Android ad strategy from web AdSense.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** WebView/native inventory has different integration requirements.
  - **Uses / connects:** Selected Android architecture, SDK/provider review, test IDs.
  - **Done when:** Ads disabled in Android until approved integration and disclosures pass.

- [ ] **ADS.15 — Measure revenue against guardrails.**
  - **Why / outcome:** Avoid optimizing clicks at the expense of trust.
  - **Uses / connects:** Aggregate revenue, play starts, abandonment, latency, complaints.
  - **Done when:** Ramp stops on agreed regressions; production ads never clicked in testing.

- [ ] **ADS.16 — Add instant ad kill switch and review cadence.**
  - **2026-10-28 state: I.** Safe-default reviewed flag/consent bootstrap, same-origin geo, disabled ads.txt and gameplay/admin exclusions; no native ads. Full provider/CMP/withdrawal network traces and operating cadence not verified.
  - **Why / outcome:** Provider/policy changes require fast response.
  - **Uses / connects:** Remote configuration, owner procedure, release monitoring.
  - **Done when:** Operator disables inventory across clients; monthly review scheduled.

<a id="workstream-pwa"></a>

### PWA — Installable web and explicitly bounded offline support

**Accountable:** FE · **Reviewers/partners:** GAME, AND, SEC, UX, QA · **Priority:** P1 · **Initial state:** T · **Gate:** G2 if installation/offline advertised; foundation for chosen Android path

**Entry dependencies:** G1-quality web; API cache/visibility; DATA local storage policy. **External needs/blockers:** Browser install support varies; offline rights must be approved.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **PWA.01 — Define the offline product contract.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Avoid promising offline for every external game.
  - **Uses / connects:** CAT capabilities, core journeys, rights ledger.
  - **Done when:** Exact cached games/pages/actions and online-only features listed.

- [ ] **PWA.02 — Define service-worker scope and cache boundaries.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Prevent caching private admin/token responses.
  - **Uses / connects:** Routes, Next runtime requests, public assets, auth/consent paths.
  - **Done when:** Explicit allowlist and denylist reviewed by security.

- [ ] **PWA.03 — Create web app manifest and install artwork.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Provide recognizable installable identity.
  - **Uses / connects:** App name/id/start_url/scope/display/theme, maskable icons.
  - **Done when:** Manifest valid; icons and launch scope tested on target browsers.

- [ ] **PWA.04 — Implement accessible install guidance.**
  - **Why / outcome:** Help users without coercive repeated prompts.
  - **Uses / connects:** Browser install events, dismissal preference, fallback help.
  - **Done when:** Install/dismiss/revisit paths behave respectfully; no unsupported prompt claims.

- [ ] **PWA.05 — Add service worker with versioned public caches.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Make chosen public shell/assets available offline.
  - **Uses / connects:** Build manifest, cache names, lifecycle hooks.
  - **Done when:** Controlled offline load succeeds; API writes/private responses never cached.

- [ ] **PWA.06 — Define navigation fallback without hiding errors.**
  - **Why / outcome:** Offline fallback should not turn every missing route into success.
  - **Uses / connects:** Navigation strategy, offline page, real 404 behavior.
  - **Done when:** Unknown online URLs stay 404; known offline content has clear stale label.

- [ ] **PWA.07 — Bundle/cache first-party game assets safely.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Provide play without fetching unavailable dependencies.
  - **Uses / connects:** Selected engine chunks, fonts, media, version manifest.
  - **Done when:** Each advertised offline game starts after network removal.

- [ ] **PWA.08 — Add explicit download size and progress.**
  - **Why / outcome:** Respect mobile data and storage limits.
  - **Uses / connects:** Offline pack manifest, byte counts, cancel control.
  - **Done when:** User sees size/progress and can cancel/remove downloads.

- [ ] **PWA.09 — Handle quota limits and eviction.**
  - **Why / outcome:** Browser storage is not guaranteed durable.
  - **Uses / connects:** Storage estimate/persistence capability, LRU cleanup.
  - **Done when:** Low-quota and evicted-cache tests recover gracefully.

- [ ] **PWA.10 — Expose offline availability and storage controls.**
  - **Why / outcome:** Users need to know what is saved.
  - **Uses / connects:** Game badges, downloads/settings UI, storage adapter.
  - **Done when:** Status is accurate; remove pack frees associated cache entries.

- [ ] **PWA.11 — Keep submissions online-only or explicitly queued.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Silent offline posts can surprise users.
  - **Uses / connects:** Scores/comments/contact UI, idempotent retry policy.
  - **Done when:** Clear pending state; no duplicate or unconsented delayed submission.

- [ ] **PWA.12 — Implement update availability prompts.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Do not replace engine assets mid-run.
  - **Uses / connects:** Worker waiting/activation, active game state, reload control.
  - **Done when:** Update waits until safe point; user sees version and restart choice.

- [ ] **PWA.13 — Test mixed-version and failed-update recovery.**
  - **Why / outcome:** Partial caches must not strand installed users.
  - **Uses / connects:** Versioned manifests, previous cache retention, rollback.
  - **Done when:** Interrupted update leaves a playable supported version or clear recovery UI.

- [ ] **PWA.14 — Exclude admin, exports, tokens and personal responses.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Service workers must not become private-data archives.
  - **Uses / connects:** Cache tests, subscription links, authenticated routes.
  - **Done when:** Cache inspection finds only approved public assets.

- [ ] **PWA.15 — Test installed mode routing and links.**
  - **Why / outcome:** Browser tab behavior differs from standalone mode.
  - **Uses / connects:** Manifest scope, external links, share/deep links.
  - **Done when:** In-scope navigation stable; external origins open safely.

- [ ] **PWA.16 — Audit HTTPS and preview-origin behavior.**
  - **Why / outcome:** Service workers require correct origin and scope.
  - **Uses / connects:** Deployment config, preview isolation, dev-only guards.
  - **Done when:** No production worker registered on unintended preview/dev hosts.

- [ ] **PWA.17 — Run airplane-mode and reconnect matrix.**
  - **Why / outcome:** Demonstrate honest offline behavior.
  - **Uses / connects:** Cold/warm installed launch, saved/unsaved games, sync.
  - **Done when:** Supported flows pass and unsupported flows explain why.

- [ ] **PWA.18 — Document PWA support limits and reset path.**
  - **2026-10-28 state: I.** Hosted Pocket Arcade only: manifest/icons, bounded public-static cache, no private/API/write caching, update waits for tab close. Offline reload browser test passes. Main Next website offline scope, install/update UI, quota and target-browser review remain open.
  - **Why / outcome:** Reduce support confusion across browsers.
  - **Uses / connects:** Help page, cache reset, browser support table.
  - **Done when:** User can recover stale installation without exposing private data.

<a id="workstream-adr"></a>

### ADR — Android architecture and delivery feasibility

**Accountable:** AND · **Reviewers/partners:** PO, FE, GAME, SEC, OPS, QA, UX · **Priority:** P1 · **Initial state:** T · **Gate:** Before committing Android build scope

**Entry dependencies:** PROD charter; BASE engine inventory; can spike alongside web remediation. **External needs/blockers:** Representative physical Android devices; approved distribution goal.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **ADR.01 — Define Android-specific jobs and acceptance criteria.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Give installation real value beyond a wrapped website.
  - **Uses / connects:** Offline play, recent games, native sharing, interruptions.
  - **Done when:** Owner approves value proposition and excludes unjustified features.

- [ ] **ADR.02 — Choose distribution channels and publisher identity.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Signing and policies depend on distribution.
  - **Uses / connects:** Play account/direct APK decision, legal business identity.
  - **Done when:** Channel owner, budget and account readiness recorded.

- [ ] **ADR.03 — Compare PWA/TWA/Capacitor/native using criteria.**
  - **2026-10-28 state: I.** docs/architecture-decisions.md records provisional bundled Capacitor/shared-core choice, boundaries, alternatives and re-evaluation gates. Owner approval, measured device comparison and estimate are not complete.
  - **Why / outcome:** Avoid premature framework commitment.
  - **Uses / connects:** Architecture table, team skills, maintenance and device constraints.
  - **Done when:** Weighted decision criteria and risks documented.

- [ ] **ADR.04 — Build a disposable representative architecture spike.**
  - **Why / outcome:** Measure actual canvas/WebView behavior.
  - **Uses / connects:** One game, browse shell, local assets, HTTPS API fixture.
  - **Done when:** Prototype demonstrates startup, input, back, offline and memory on device.

- [ ] **ADR.05 — Measure spike on low/mid-tier devices.**
  - **Why / outcome:** Desktop emulation misses mobile bottlenecks.
  - **Uses / connects:** Physical hardware, supported OS/WebView versions.
  - **Done when:** Results include cold start, frame time, memory, TalkBack and interruption behavior.

- [ ] **ADR.06 — Investigate store policy fit for the chosen approach.**
  - **Why / outcome:** Packaging alone does not guarantee acceptance.
  - **Uses / connects:** Current store policies, dynamic code/content, WebView/UGC rules.
  - **Done when:** Policy risks and required functionality reviewed before full implementation.

- [ ] **ADR.07 — Decide packaged versus remote content boundaries.**
  - **2026-10-28 state: I.** docs/architecture-decisions.md records provisional bundled Capacitor/shared-core choice, boundaries, alternatives and re-evaluation gates. Owner approval, measured device comparison and estimate are not complete.
  - **Why / outcome:** Remote scripts must not gain native privileges.
  - **Uses / connects:** App shell, bundled game code, content API, third-party frames.
  - **Done when:** Trust boundary diagram and allowed update channels approved.

- [ ] **ADR.08 — Define shared-code extraction plan.**
  - **2026-10-28 state: I.** docs/architecture-decisions.md records provisional bundled Capacitor/shared-core choice, boundaries, alternatives and re-evaluation gates. Owner approval, measured device comparison and estimate are not complete.
  - **Why / outcome:** Reuse logic without dragging SSR into mobile.
  - **Uses / connects:** Game simulation/input adapters, API schemas/client, design tokens.
  - **Done when:** Package boundaries and dependency direction documented.

- [ ] **ADR.09 — Choose Android support/device policy.**
  - **2026-10-28 state: I.** docs/architecture-decisions.md records provisional bundled Capacitor/shared-core choice, boundaries, alternatives and re-evaluation gates. Owner approval, measured device comparison and estimate are not complete.
  - **Why / outcome:** Testing needs explicit minimum and target constraints.
  - **Uses / connects:** Audience devices, SDK/plugin support, current store requirements.
  - **Done when:** min/target/compile policy chosen and dated; not guessed from stale rules.

- [ ] **ADR.10 — Define API compatibility and offline data versions.**
  - **Why / outcome:** Older installs and cached packs must keep working.
  - **Uses / connects:** API schema/versioning, local DB migration, feature flags.
  - **Done when:** Compatibility window, deprecation and recovery rules approved.

- [ ] **ADR.11 — Choose native integrations minimally.**
  - **2026-10-28 state: I.** docs/architecture-decisions.md records provisional bundled Capacitor/shared-core choice, boundaries, alternatives and re-evaluation gates. Owner approval, measured device comparison and estimate are not complete.
  - **Why / outcome:** Each permission/plugin increases maintenance and privacy costs.
  - **Uses / connects:** Share, links, haptics, optional push, storage.
  - **Done when:** Only justified plugins/permissions selected with owner and review.

- [ ] **ADR.12 — Publish accepted ADR and implementation estimate.**
  - **2026-10-28 state: I.** docs/architecture-decisions.md records provisional bundled Capacitor/shared-core choice, boundaries, alternatives and re-evaluation gates. Owner approval, measured device comparison and estimate are not complete.
  - **Why / outcome:** Convert spike evidence into a committed approach.
  - **Uses / connects:** Measured alternatives, security/policy review, PO approval.
  - **Done when:** Selected path, rejected options, fallback and re-evaluation trigger recorded.

<a id="workstream-and"></a>

### AND — Android client implementation and platform integration

**Accountable:** AND · **Reviewers/partners:** FE, GAME, BE, SEC, UX, QA, OPS · **Priority:** P1 · **Initial state:** T · **Gate:** G3

**Entry dependencies:** ADR accepted; G0 backend safety; shared GAME fixes; API contracts; DATA policy. **External needs/blockers:** Android SDK/JDK/Gradle toolchain and physical devices; SDK downloads may need an external runner.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **AND.01 — Create the approved Android client workspace.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Establish a maintainable client rather than copy Next SSR.
  - **Uses / connects:** apps/mobile or selected native project, workspace config.
  - **Done when:** Clean checkout builds a debug artifact using documented toolchain.

- [ ] **AND.02 — Pin JDK/Gradle/SDK/plugin versions.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Avoid developer and CI build drift.
  - **Uses / connects:** Toolchain files, wrapper checksums, supported versions.
  - **Done when:** Reproducible build on a second clean machine/runner.

- [ ] **AND.03 — Reserve package ID and app identity.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Package names and signing identity are long-lived.
  - **Uses / connects:** Application ID, labels, icons, publisher identity.
  - **Done when:** Owner approves unique package name and immutable identity record.

- [ ] **AND.04 — Implement environment-specific build variants.**
  - **Why / outcome:** Prevent test builds contacting production accidentally.
  - **Uses / connects:** Dev/staging/release API config, app labels, signing config.
  - **Done when:** Each variant clearly labelled and routes only to intended environment.

- [ ] **AND.05 — Extract and consume shared game logic.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Keep game rules consistent across web and Android.
  - **Uses / connects:** packages/game-core proposal, input/render adapters.
  - **Done when:** Shared tests pass; web regression suite stays green.

- [ ] **AND.06 — Implement mobile API client and runtime validation.**
  - **Why / outcome:** Handle older installs and malformed server responses.
  - **Uses / connects:** Generated/typed contract, HTTPS base, timeout/retry adapters.
  - **Done when:** Mock and staging contract tests pass; no localhost in release bundle.

- [ ] **AND.07 — Build app navigation and discoverable browse shell.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Native back and mobile navigation need deliberate design.
  - **Uses / connects:** Catalog, search, guides, saved/recent/settings routes.
  - **Done when:** Main journeys reachable with predictable navigation state.

- [ ] **AND.08 — Implement capability-aware catalog and game details.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Do not offer unsupported games on Android.
  - **Uses / connects:** CAT capability/rights model, mobile filters, download badges.
  - **Done when:** Unsupported/input-incompatible items labelled or excluded accurately.

- [ ] **AND.09 — Implement readable guides and sanitized content rendering.**
  - **Why / outcome:** Imported markup must not become privileged app code.
  - **Uses / connects:** Sanitized API content, approved renderer, external link handler.
  - **Done when:** Script/unsafe URL fixtures cannot execute or access bridge.

- [ ] **AND.10 — Integrate first-party game host.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Make shared engines responsive in packaged environment.
  - **Uses / connects:** Canvas/native host per ADR, bundle assets, controls.
  - **Done when:** All launch games start and finish on touch-only reference device.

- [ ] **AND.11 — Implement app pause/resume and process recreation.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Calls, app switching and process death are normal.
  - **Uses / connects:** Android lifecycle/plugin adapter, persisted safe state.
  - **Done when:** Background pauses; resume does not fast-forward or double-submit; process death recovers intentionally.

- [ ] **AND.12 — Implement system back and predictive-back behavior.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Back should leave play safely without trapping users.
  - **Uses / connects:** Navigation stack, pause/exit confirmation, OS callbacks.
  - **Done when:** Hardware/gesture back works in game, dialogs, links and root.

- [ ] **AND.13 — Handle rotation, insets and window resizing.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Device shape and orientation can change mid-session.
  - **Uses / connects:** Edge-to-edge/insets, cutouts, large screens, foldable policies.
  - **Done when:** Controls remain visible; state preserved or safely paused by approved behavior.

- [ ] **AND.14 — Secure native bridge and embedded navigation.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Remote pages must not invoke privileged native methods.
  - **Uses / connects:** Origin allowlist, bridge exposure, WebView settings, CSP.
  - **Done when:** Unapproved navigation/intents/frames denied or externalized; bridge tests pass.

- [ ] **AND.15 — Disable unnecessary file/debug/network capabilities.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Minimize attack surface in production.
  - **Uses / connects:** Manifest permissions, cleartext policy, WebView debugging, file access.
  - **Done when:** Release audit shows only required permissions, HTTPS and no debug bridge.

- [ ] **AND.16 — Implement local data repository and migrations.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Store favorites/history/settings/offline packs reliably.
  - **Uses / connects:** SQLite/IndexedDB/native adapter per ADR, schema versions.
  - **Done when:** Upgrade/downgrade-policy and corrupt-data recovery fixtures pass.

- [ ] **AND.17 — Implement offline game pack download/install.**
  - **Why / outcome:** Offer useful offline play within rights/storage limits.
  - **Uses / connects:** Signed/verified manifest, hashes, approved static assets.
  - **Done when:** Size/consent/progress/cancel verified; failed download never marks pack playable.

- [ ] **AND.18 — Verify offline pack integrity and update policy.**
  - **Why / outcome:** Avoid tampered assets and unreviewed executable updates.
  - **Uses / connects:** Checksums/signatures where appropriate, bundled-code policy, store review.
  - **Done when:** Modified assets rejected; code updates use approved distribution path.

- [ ] **AND.19 — Implement cache/storage management UI.**
  - **Why / outcome:** Give users control over device resources.
  - **Uses / connects:** Pack inventory, storage estimates, eviction/reset controls.
  - **Done when:** User can remove individual/all packs; insufficient-storage case explained.

- [ ] **AND.20 — Keep offline and online score rules distinct.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Do not inflate public rankings with unverified offline claims.
  - **Uses / connects:** SCORE eligibility, local best, retry policy.
  - **Done when:** Offline achievements clearly local unless validated by approved server rules.

- [ ] **AND.21 — Implement Android app links and web fallback.**
  - **Why / outcome:** Shared game URLs should open the right destination.
  - **Uses / connects:** Verified assetlinks association, release signing certificate, web routes.
  - **Done when:** Cold/warm link opens correct game; uninstalled user reaches web; bad links safe.

- [ ] **AND.22 — Implement safe share and external browsing.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Avoid leaking internal tokens or unsafe intents.
  - **Uses / connects:** Native share adapter, verified canonical URLs, system browser.
  - **Done when:** Shares contain public URLs; arbitrary schemes/intents cannot escape policy.

- [ ] **AND.23 — Add settings and privacy/data controls.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Android permissions and local data need user control.
  - **Uses / connects:** DATA policies, consent choices, clear data, accessibility preferences.
  - **Done when:** Controls work offline where possible; reset never leaves partial state.

- [ ] **AND.24 — Evaluate notifications as an opt-in feature.**
  - **Why / outcome:** Reminders must earn attention, not be launch noise.
  - **Uses / connects:** Audience demand, Android permission rules, optional FCM/backend.
  - **Done when:** Default off; implement only after consent, token lifecycle and useful-content decision.

- [ ] **AND.25 — If approved, implement push registration and revocation.**
  - **Why / outcome:** Tokens and deep links need secure lifecycle.
  - **Uses / connects:** Notification provider, API token store, logout/disable/uninstall handling.
  - **Done when:** Denied permissions respected; stale tokens removed; links validated; no sensitive payloads.

- [ ] **AND.26 — Integrate privacy-preserving crash diagnostics.**
  - **Why / outcome:** Diagnose real device failures without collecting secrets.
  - **Uses / connects:** Reviewed reporting SDK/adapter, release IDs, redaction.
  - **Done when:** Synthetic crash visible with symbols; sensitive payload tests pass; opt-out honored where required.

- [ ] **AND.27 — Implement Android accessibility and large text.**
  - **2026-10-28 state: I.** apps/mobile standalone shell, shared engines, bundled assets, native App/Share hooks, restricted config/manifest, settings and local storage. Build/sync and browser journeys pass. No Gradle/device/release-mode result; full native acceptance remains open (docs/mobile-release.md).
  - **Why / outcome:** Web accessibility alone does not cover native shell.
  - **Uses / connects:** TalkBack traversal, focus, font scale, controls and contrast.
  - **Done when:** Core journeys usable on device with assistive settings; limitations documented.

- [ ] **AND.28 — Add minimum-version/maintenance handling.**
  - **Why / outcome:** Prevent incompatible clients from failing mysteriously.
  - **Uses / connects:** API compatibility response, remote flags, safe update link.
  - **Done when:** Supported older build continues; incompatible build explains update without data loss.

- [ ] **AND.29 — Build and inspect release-mode artifact.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Debug builds can hide signing/config/performance errors.
  - **Uses / connects:** AAB/APK, minification, dependency/permission scan.
  - **Done when:** Release artifact installs in test track; no secrets/debug endpoints; size/startup measured.

- [ ] **AND.30 — Run upgrade and reinstall acceptance scenarios.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Users bring old state and interrupted downloads.
  - **Uses / connects:** Previous app builds, local migrations, pack versions, backups.
  - **Done when:** Upgrade preserves approved data; reinstall/reset behavior matches privacy policy.

<a id="workstream-store"></a>

### STORE — Android signing, policy, testing tracks and publication

**Accountable:** OPS · **Reviewers/partners:** AND, PO, LEGAL, UX, MOD, QA · **Priority:** P1 · **Initial state:** T · **Gate:** G4

**Entry dependencies:** G3 signed beta; DATA rights/privacy; AND release artifact; QA Android evidence. **External needs/blockers:** Authorized publisher account; identity verification; current store testing/review requirements.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **STORE.01 — Verify publisher account readiness.**
  - **Why / outcome:** Store account restrictions can block launch.
  - **Uses / connects:** Account owner, legal identity, payments/profile where required.
  - **Done when:** Authorized owner confirms prerequisites without sharing credentials in chat.

- [ ] **STORE.02 — Assign signing-key custodians and recovery policy.**
  - **Why / outcome:** Lost or leaked signing keys threaten all future updates.
  - **Uses / connects:** Secure secret store, role separation, recovery documentation.
  - **Done when:** At least two approved recovery custodians; encrypted/offline backup procedure tested.

- [ ] **STORE.03 — Create upload/signing setup using platform guidance.**
  - **Why / outcome:** Release identity must be stable and protected.
  - **Uses / connects:** App signing service if selected, upload key, certificate fingerprints.
  - **Done when:** Test upload accepted; private keys excluded from repo/logs/artifacts.

- [ ] **STORE.04 — Define versionCode/versionName and release notes policy.**
  - **Why / outcome:** Updates need monotonic install identity and clear changes.
  - **Uses / connects:** Android build pipeline, changelog, API compatibility.
  - **Done when:** Automated version checks prevent downgrade/collision mistakes.

- [ ] **STORE.05 — Recheck then-current target API and artifact requirements.**
  - **Why / outcome:** Requirements change and are not fixed by this roadmap.
  - **Uses / connects:** Official store console/docs at submission date.
  - **Done when:** Dated checklist records target SDK, AAB/ABI/native-library requirements as applicable.

- [ ] **STORE.06 — Recheck testing-track and production-access requirements.**
  - **Why / outcome:** Account-specific rules differ and can change.
  - **Uses / connects:** Publisher account type/age, console eligibility.
  - **Done when:** Actual required test duration/audience/criteria recorded; no guessed numbers.

- [ ] **STORE.07 — Complete content and audience declarations.**
  - **Why / outcome:** Store forms must match real games and community features.
  - **Uses / connects:** Content ratings questionnaire, age decision, external content policy.
  - **Done when:** Ratings/target audience reviewed; prohibited mismatches resolved.

- [ ] **STORE.08 — Complete Data safety/privacy declarations.**
  - **Why / outcome:** SDK behavior and backend storage must be disclosed accurately.
  - **Uses / connects:** DATA inventory, crash/push/ad SDK inventory, privacy URL.
  - **Done when:** Declarations reviewed against release network traces and permissions.

- [ ] **STORE.09 — Provide account deletion if accounts exist.**
  - **Why / outcome:** Optional identity adds store/privacy obligations.
  - **Uses / connects:** ACCOUNT workflow, public deletion URL, in-app access.
  - **Done when:** Deletion works and meets then-current requirements; not falsely advertised if accounts absent.

- [ ] **STORE.10 — Complete ads/UGC/permissions policy review.**
  - **Why / outcome:** Community names/comments and SDKs affect store obligations.
  - **Uses / connects:** Ads flags, moderation/report/block needs, permission justification.
  - **Done when:** Required controls implemented or feature disabled; reviewers document decision.

- [ ] **STORE.11 — Create truthful store listing assets.**
  - **Why / outcome:** Avoid claiming all games offline or inventing popularity.
  - **Uses / connects:** App icon, feature graphic, real screenshots, description.
  - **Done when:** Assets match release build; accessibility/localization and rights reviewed.

- [ ] **STORE.12 — Prepare review-access instructions.**
  - **Why / outcome:** Reviewers need functioning journeys without privileged secrets.
  - **Uses / connects:** Test accounts if required, backend availability, demo instructions.
  - **Done when:** Review package contains safe limited access; no admin token shared.

- [ ] **STORE.13 — Run internal-track install and update tests.**
  - **Why / outcome:** Validate real distribution/signature behavior.
  - **Uses / connects:** Store-generated APK delivery, app links, crash mapping.
  - **Done when:** Multiple devices install/update successfully from track.

- [ ] **STORE.14 — Run required closed/open tests and collect feedback.**
  - **Why / outcome:** Meet actual account rules and learn device failures.
  - **Uses / connects:** Test cohorts, pre-launch reports, support intake.
  - **Done when:** Required evidence completed; blocking findings resolved before production request.

- [ ] **STORE.15 — Define staged rollout thresholds and owner.**
  - **Why / outcome:** Limit blast radius of device/backend regressions.
  - **Uses / connects:** Crash/ANR/start success metrics, support queue, feature kill switches.
  - **Done when:** Ramp/hold/stop thresholds and escalation contact signed off.

- [ ] **STORE.16 — Publish only after explicit release approval.**
  - **Why / outcome:** Prevent accidental public launch.
  - **Uses / connects:** PO/QA/SEC sign-off, immutable release artifact.
  - **Done when:** Approval links to exact version/checksum and test evidence.

- [ ] **STORE.17 — Monitor rollout and stop on regressions.**
  - **Why / outcome:** Store release is not the end of delivery.
  - **Uses / connects:** Vitals, crash symbols, backend health, support feedback.
  - **Done when:** Named owner reviews each stage; halt/hotfix procedure exercised.

- [ ] **STORE.18 — Document Android rollback limits.**
  - **Why / outcome:** Installed clients cannot simply be downgraded.
  - **Uses / connects:** Forward hotfix, feature flags, API backward compatibility.
  - **Done when:** Recovery plan uses supported mechanisms and preserves user data.

- [ ] **STORE.19 — If direct APK is selected, secure distribution.**
  - **Why / outcome:** Sideloading adds authenticity/update/support responsibilities.
  - **Uses / connects:** HTTPS download, signature/checksum, update notices, version history.
  - **Done when:** User can verify provenance; signed update path tested; no silent insecure auto-update.

- [ ] **STORE.20 — Schedule policy and signing maintenance.**
  - **Why / outcome:** Keep future updates publishable.
  - **Uses / connects:** Target API review calendar, account/key access, SDK inventory.
  - **Done when:** Quarterly and pre-release reviews assigned with renewal alerts.

<a id="workstream-ops"></a>

### OPS — Infrastructure, observability, recovery and cost control

**Accountable:** OPS · **Reviewers/partners:** BE, SEC, FE, AND, QA, PO · **Priority:** P1 · **Initial state:** T · **Gate:** G0 recovery; G2 production operations; ongoing

**Entry dependencies:** SEC containment; API migration/cache plan; owner budget and provider access. **External needs/blockers:** Cloud/DNS/email access and permitted network egress; no provisioning assumed.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **OPS.01 — Inventory current resources without changing them.**
  - **Why / outcome:** Avoid creating duplicates or overwriting unknown production.
  - **Uses / connects:** Authorized cloud/project inventory, DNS ownership, deployment history.
  - **Done when:** Environment/resource/owner map reviewed; unknowns named.

- [ ] **OPS.02 — Separate development, staging and production.**
  - **Why / outcome:** Testing must not mutate real users/content.
  - **Uses / connects:** Distinct Worker/D1/R2/KV bindings, frontend envs, domains.
  - **Done when:** Cross-environment write tests fail; preview uses safe isolated backend.

- [ ] **OPS.03 — Define infrastructure configuration and naming.**
  - **Why / outcome:** Scripts currently hardcode several resource names.
  - **Uses / connects:** provision.mjs, Wrangler environments, deployment state.
  - **Done when:** Deterministic names/config with account confirmation and drift detection.

- [ ] **OPS.04 — Set least-privilege service credentials.**
  - **Why / outcome:** Reduce damage from CI or operator compromise.
  - **Uses / connects:** Provider IAM, environment secrets, rotation schedule.
  - **Done when:** Scope/owner/expiry recorded; secrets never printed or committed.

- [ ] **OPS.05 — Add explicit configuration preflight.**
  - **2026-10-28 state: I.** Secret preflight and small-site 21-table D1-batch/count-manifest private export implemented; local isolated restore passed. Provider access, production-sized restore, paginated retention, alerting/readiness and approved RPO/RTO remain open.
  - **Why / outcome:** Catch wrong origins, placeholder IDs and missing salts.
  - **Uses / connects:** .env.example, runtime/deploy validator, provider bindings.
  - **Done when:** Production deployment refuses invalid required settings.

- [ ] **OPS.06 — Choose private backup format and full scope.**
  - **2026-10-28 state: I.** Secret preflight and small-site 21-table D1-batch/count-manifest private export implemented; local isolated restore passed. Provider access, production-sized restore, paginated retention, alerting/readiness and approved RPO/RTO remain open.
  - **Why / outcome:** Current JSON/export coverage cannot be treated as SQL recovery.
  - **Uses / connects:** All tables, schema version, migration_items/bookkeeping, R2 assets.
  - **Done when:** Versioned backup manifest lists complete scope and consistency guarantees.

- [ ] **OPS.07 — Implement bounded consistent backup capture.**
  - **2026-10-28 state: I.** Secret preflight and small-site 21-table D1-batch/count-manifest private export implemented; local isolated restore passed. Provider access, production-sized restore, paginated retention, alerting/readiness and approved RPO/RTO remain open.
  - **Why / outcome:** Whole-table accumulation will not scale safely.
  - **Uses / connects:** D1 supported export/restore approach, chunking, snapshot boundary.
  - **Done when:** Production-sized fixture exported within limits with verified counts/checksums.

- [ ] **OPS.08 — Implement private backup retention and monitoring.**
  - **2026-10-28 state: I.** Secret preflight and small-site 21-table D1-batch/count-manifest private export implemented; local isolated restore passed. Provider access, production-sized restore, paginated retention, alerting/readiness and approved RPO/RTO remain open.
  - **Why / outcome:** A cron declaration is not evidence of usable backups.
  - **Uses / connects:** Private R2 bucket, lifecycle policy, job status/age alerts.
  - **Done when:** Missing/failed backup pages operator; retention test keeps required generations.

- [x] **OPS.09 — Build restricted restore tooling with dry-run.**
  - **2026-10-28 state: V.** scripts/restore-backup.mjs restores into isolated in-memory SQLite only; tests/restore.test.ts rejects malformed/missing/unknown/FK/count data. Real local 21-table export rehearsal passed.
  - **Why / outcome:** Restore must be repeatable, not an improvised SQL command.
  - **Uses / connects:** JSON/SQL format-aware restore, schema order, FK/FTS rebuild.
  - **Done when:** Dry-run validates manifest/schema; restore targets isolated new resources by default.

- [ ] **OPS.10 — Test full restore and record RPO/RTO.**
  - **2026-10-28 state: I.** Secret preflight and small-site 21-table D1-batch/count-manifest private export implemented; local isolated restore passed. Provider access, production-sized restore, paginated retention, alerting/readiness and approved RPO/RTO remain open.
  - **Why / outcome:** Prove recovery before relying on it.
  - **Uses / connects:** Sanitized representative data, media, permissions, deletion ledger.
  - **Done when:** Counts/relationships/content/search match; measured recovery meets approved objectives.

- [x] **OPS.11 — Test corrupt/incomplete backup rejection.**
  - **2026-10-28 state: V.** scripts/restore-backup.mjs restores into isolated in-memory SQLite only; tests/restore.test.ts rejects malformed/missing/unknown/FK/count data. Real local 21-table export rehearsal passed.
  - **Why / outcome:** Failed recovery should not partially destroy good state.
  - **Uses / connects:** Checksums, manifest completeness, restore staging.
  - **Done when:** Corrupt input rejected before cutover; previous service remains recoverable.

- [ ] **OPS.12 — Design structured logs and correlation IDs.**
  - **Why / outcome:** Debug distributed web/API/mobile failures safely.
  - **Uses / connects:** Worker/Next logs, request/release IDs, redaction.
  - **Done when:** End-to-end request trace possible without raw tokens/emails/IP payloads.

- [ ] **OPS.13 — Integrate error reporting with reviewed data controls.**
  - **Why / outcome:** Production failures need actionable diagnosis.
  - **Uses / connects:** Server/client/native adapter, source maps/symbols, sampling.
  - **Done when:** Synthetic failures arrive with release context; sensitive data stripped.

- [ ] **OPS.14 — Add external journey uptime checks.**
  - **Why / outcome:** Health endpoint alone misses broken images/games.
  - **Uses / connects:** HTTP status/content, image probes, game startup automation.
  - **Done when:** Alerts distinguish frontend/backend/media/game failures with runbook links.

- [ ] **OPS.15 — Create health and readiness semantics.**
  - **2026-10-28 state: I.** Secret preflight and small-site 21-table D1-batch/count-manifest private export implemented; local isolated restore passed. Provider access, production-sized restore, paginated retention, alerting/readiness and approved RPO/RTO remain open.
  - **Why / outcome:** Avoid returning healthy when essential storage is broken.
  - **Uses / connects:** API health routes, DB/R2/KV probes, dependency isolation.
  - **Done when:** Readiness reflects required dependencies; probe itself does not create excessive load.

- [ ] **OPS.16 — Define SLO dashboard and alert thresholds.**
  - **Why / outcome:** Turn quality targets into operational decisions.
  - **Uses / connects:** Play success/errors/latency, uptime, backup age, queue age.
  - **Done when:** Dashboard and alert routing tested; noisy/nonactionable alerts removed.

- [ ] **OPS.17 — Model capacity and monthly costs.**
  - **Why / outcome:** Prevent surprise spend from games/media/abuse.
  - **Uses / connects:** Worker/D1/KV/R2, Vercel proxy/build, email, observability usage.
  - **Done when:** Baseline and 10x scenario estimate approved with assumptions and caps.

- [ ] **OPS.18 — Set budget alerts and degradation controls.**
  - **Why / outcome:** Cost incidents need safe controls.
  - **Uses / connects:** Provider budgets, rate limits, sampling, optional-feature kill switches.
  - **Done when:** 50/80/100% test notifications route correctly; core play prioritized.

- [ ] **OPS.19 — Add cron/job concurrency and failure handling.**
  - **Why / outcome:** Scheduled work must survive overlap and retries.
  - **Uses / connects:** Locks/idempotency, job checkpoints, retry/dead-letter state.
  - **Done when:** Overlapping/manual reruns do not duplicate destructive work.

- [ ] **OPS.20 — Write outage/security/provider runbooks.**
  - **Why / outcome:** Operator needs steps under pressure.
  - **Uses / connects:** API down, media failure, email outage, ad incident, dependency compromise.
  - **Done when:** Runbooks include detect/contain/recover/verify/escalate and owners.

- [ ] **OPS.21 — Run load and recovery exercises.**
  - **Why / outcome:** Validate limits and rollback under realistic pressure.
  - **Uses / connects:** Staging load generator, failure injection, quotas.
  - **Done when:** Agreed concurrency/latency budget met; overload fails boundedly.

- [ ] **OPS.22 — Review access and provider lock-in escape.**
  - **Why / outcome:** Sustainable operation includes portability.
  - **Uses / connects:** Export/restore docs, credential offboarding, schema/assets.
  - **Done when:** Owner can recover data and revoke staff access without one person's laptop.

<a id="workstream-qa"></a>

### QA — Quality engineering, automation and release evidence

**Accountable:** QA · **Reviewers/partners:** BE, FE, GAME, AND, SEC, OPS, UX · **Priority:** P1 · **Initial state:** T · **Gate:** Every gate

**Entry dependencies:** BASE.08–BASE.10; start alongside remediation, expand as features land. **External needs/blockers:** Browser/device binaries may require approved external CI runners.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **QA.01 — Create a test-strategy matrix by risk and journey.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Prevent counting helper tests as complete validation.
  - **Uses / connects:** Audit R01–R17, release gates, supported clients.
  - **Done when:** Each risk/journey mapped to unit/integration/browser/device/manual evidence.

- [ ] **QA.02 — Pin toolchain and deterministic fixture setup.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Tests must reproduce from clean checkout.
  - **Uses / connects:** Node version, lockfile, local D1/R2/KV, test seeds.
  - **Done when:** One documented setup path creates disposable isolated data.

- [x] **QA.03 — Split smoke verification from destructive tests.**
  - **2026-10-28 state: V.** scripts/verify.mjs refuses remote mode and local integration passes; scripts/smoke.mjs is read-only. Wrangler local D1/R2/KV plus Worker real-SQLite tests pass.
  - **Why / outcome:** Current verifier writes data and resets rate limits.
  - **Uses / connects:** scripts/verify.mjs, production/staging safeguards.
  - **Done when:** Read-only production smoke cannot mutate; write suite requires explicit isolated target.

- [x] **QA.04 — Add Worker integration tests with real local bindings.**
  - **2026-10-28 state: V.** scripts/verify.mjs refuses remote mode and local integration passes; scripts/smoke.mjs is read-only. Wrangler local D1/R2/KV plus Worker real-SQLite tests pass.
  - **Why / outcome:** Mocks alone miss SQL/cache/storage behavior.
  - **Uses / connects:** Hono requests, local D1/R2/KV, migrations.
  - **Done when:** Routes exercise real schema, auth, errors and isolation without cloud secrets.

- [ ] **QA.05 — Add browser E2E harness and network assertions.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** HTTP 200 does not mean images or gameplay work.
  - **Uses / connects:** Playwright or approved alternative, real web/API stack.
  - **Done when:** Browse→image→play→score/guide flows tested; missing assets and console errors fail.

- [ ] **QA.06 — Automate critical security regression fixtures.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Preserve fixes to private data, XSS, SSRF and opt-in.
  - **Uses / connects:** SEC tests, malicious content, synthetic backup/token data.
  - **Done when:** Each repaired security finding has a failing-before/passing-after test.

- [ ] **QA.07 — Test complete mutation/cache lifecycle.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Stale UI errors often escape unit tests.
  - **Uses / connects:** Warm KV/Next/browser caches, publish/delete/rollback.
  - **Done when:** Public views, sitemap/feed/search and personal data cache boundaries verified.

- [ ] **QA.08 — Test migration and restore interruption scenarios.**
  - **Why / outcome:** Data safety includes failures, not just successful runs.
  - **Uses / connects:** Crash checkpoints, partial apply, duplicate runs, rollback conflicts.
  - **Done when:** Recovery leaves consistent schema/content and complete audit trail.

- [ ] **QA.09 — Test API schemas and older-client compatibility.**
  - **Why / outcome:** Android versions cannot upgrade atomically.
  - **Uses / connects:** Contract snapshots, generated clients, previous-version fixtures.
  - **Done when:** Supported clients tolerate additive changes; breaking diffs fail CI.

- [ ] **QA.10 — Automate deterministic game rules and controls.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Capture gameplay bugs independently of screenshots.
  - **Uses / connects:** Seeded traces, fake clocks, focused keyboard/touch inputs.
  - **Done when:** Every engine covers start/pause/restart/win/loss and boundary cases.

- [ ] **QA.11 — Test touch-only completion paths.**
  - **Why / outcome:** Android users cannot rely on keyboard fallbacks.
  - **Uses / connects:** Browser mobile input plus real device tests.
  - **Done when:** All launch engines controllable and replayable without hardware keyboard.

- [ ] **QA.12 — Add accessibility automation and manual checklist.**
  - **Why / outcome:** Tools find some issues, humans find operability failures.
  - **Uses / connects:** axe or equivalent, keyboard, screen readers, contrast/zoom.
  - **Done when:** No unresolved critical automated issues; manual evidence covers core journeys.

- [ ] **QA.13 — Add visual regression across key breakpoints.**
  - **Why / outcome:** Protect layouts while improving mechanics/features.
  - **Uses / connects:** Stable seeded pages, screenshots, reviewed baselines.
  - **Done when:** Meaningful diffs reviewed; dynamic ads/time excluded without masking bugs.

- [ ] **QA.14 — Test network failures and offline transitions.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Mobile networks interrupt real usage.
  - **Uses / connects:** Slow/failed fetch, airplane mode, reconnect, timeout retries.
  - **Done when:** App communicates state and recovers without duplicate writes/data loss.

- [ ] **QA.15 — Test storage denial/quota/corruption.**
  - **Why / outcome:** Browser/native storage cannot be assumed reliable.
  - **Uses / connects:** Private mode, quota injection, local migration fixtures.
  - **Done when:** Core functionality survives or provides clear safe recovery.

- [ ] **QA.16 — Test consent/ads network behavior in all states.**
  - **Why / outcome:** UI banner presence does not prove request blocking.
  - **Uses / connects:** Known/unknown regions, accept/reject/revoke, excluded routes.
  - **Done when:** Network traces match policy; no ads on play/admin/error paths.

- [ ] **QA.17 — Add Android unit/instrumented UI tests.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Native lifecycle and navigation need native evidence.
  - **Uses / connects:** JUnit/approved mobile harness, emulator, platform adapters.
  - **Done when:** Back, permission, process death, app links and storage migration covered.

- [ ] **QA.18 — Run real-device Android compatibility matrix.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Emulators miss thermal, GPU and vendor behavior.
  - **Uses / connects:** Low/mid/high devices, supported OS/WebView, tablets as scoped.
  - **Done when:** Signed release mode passes documented support matrix.

- [ ] **QA.19 — Test production-like builds with seeded backend.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Build success with an empty backend can hide outage pages.
  - **Uses / connects:** Next build/start, Worker dry-run, release mobile bundle.
  - **Done when:** Real content and assets render; no localhost links or placeholder configuration.

- [ ] **QA.20 — Add CI required checks and artifact retention.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Make evidence a repeatable merge/release condition.
  - **Uses / connects:** Workflow jobs, secretless tests, screenshots/logs, restricted artifacts.
  - **Done when:** Typecheck/unit/integration/browser/build gates run and failures block promotion.

- [ ] **QA.21 — Improve dependency and secret scanning.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Existing grep coverage and output are insufficient.
  - **Uses / connects:** SCA, lockfile review, secret scanner, log redaction.
  - **Done when:** Entire relevant tree scanned; findings redacted; rotation response documented.

- [ ] **QA.22 — Add fuzz/property tests for untrusted parsers and inputs.**
  - **Why / outcome:** Explore cases hand fixtures miss.
  - **Uses / connects:** XML/HTML/URL/JSON parsing, size/depth limits, timestamps.
  - **Done when:** Resource-bounded fuzz corpus and regression seeds checked in appropriately.

- [ ] **QA.23 — Record release test manifest and residual risks.**
  - **2026-10-28 state: I.** Expanded unit/Worker/restore and 9 browser journeys; clean install/typechecks/builds, dependency audit and manual Android debug CI scaffold. Broader lifecycle/accessibility/race/network/device suite, browser CI/required checks and signed release manifest remain open.
  - **Why / outcome:** Go/no-go needs traceable evidence.
  - **Uses / connects:** Commit/artifact hash, environment/device/date, test results.
  - **Done when:** Exact candidate has signed test report and named unresolved issues.

- [ ] **QA.24 — Run independent beta acceptance and defect triage.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Avoid developers approving only their happy path.
  - **Uses / connects:** PROD journey scripts, operator/user tests, severity rules.
  - **Done when:** No open stop-ship defects; accepted limitations visible to owner/users.

<a id="workstream-rel"></a>

### REL — Web deployment, migration cutover and safe rollout

**Accountable:** OPS · **Reviewers/partners:** PO, BE, FE, ED, SEC, QA, MOD · **Priority:** P1 · **Initial state:** T · **Gate:** G2

**Entry dependencies:** G0/G1 evidence; OPS recovery; MIG parity; DATA legal pages; QA release candidate. **External needs/blockers:** Production provider/DNS access and explicit release approval; cloud egress unavailable in this sandbox.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [x] **REL.01 — Fix and test deploy-script environment parsing.**
  - **2026-10-28 state: V.** Deploy shell delegates to Node; scripts/lib.mjs uses node:util parseEnv; tests/ops.test.ts covers quoted sender, existing secrets, comments and literal shell syntax without execution.
  - **Why / outcome:** Dotenv values are not necessarily shell-safe.
  - **Uses / connects:** deploy.sh, .env.example, quoted sender names, safe env loader.
  - **Done when:** Documented sample config loads without execution/parsing surprises.

- [ ] **REL.02 — Use reproducible install and configuration preflight.**
  - **2026-10-28 state: I.** Plan-only deployment, explicit account/apply, opt-in content writes, safe dotenv and read-only smoke implemented. Local plan/smoke tests pass; cloud provisioning/staging/repeated-release behavior not verified.
  - **Why / outcome:** Releases should use the reviewed dependency graph.
  - **Uses / connects:** npm ci, lockfile, production config validator.
  - **Done when:** Fresh runner builds exact candidate and rejects placeholder bindings.

- [ ] **REL.03 — Separate provision, migrate, deploy and seed actions.**
  - **2026-10-28 state: I.** Plan-only deployment, explicit account/apply, opt-in content writes, safe dotenv and read-only smoke implemented. Local plan/smoke tests pass; cloud provisioning/staging/repeated-release behavior not verified.
  - **Why / outcome:** Repeat deploy must not overwrite edited production content.
  - **Uses / connects:** Script subcommands, flags, operator approvals.
  - **Done when:** Repeated code deploy leaves content unchanged; seed/import requires explicit action.

- [ ] **REL.04 — Test provisioning API assumptions and environment names.**
  - **2026-10-28 state: I.** Plan-only deployment, explicit account/apply, opt-in content writes, safe dotenv and read-only smoke implemented. Local plan/smoke tests pass; cloud provisioning/staging/repeated-release behavior not verified.
  - **Why / outcome:** Hardcoded names/response shapes can misconfigure accounts.
  - **Uses / connects:** provision.mjs, mocked provider contract, Wrangler config.
  - **Done when:** Correct account/env confirmed; pagination/error/duplicate-resource cases handled.

- [ ] **REL.05 — Establish safe release ordering and expand-contract migrations.**
  - **Why / outcome:** Deployment before secrets/schema can expose broken service.
  - **Uses / connects:** Backward-compatible schema, secrets, API, web, flags.
  - **Done when:** Upgrade and rollback rehearsed with old/new API and web versions.

- [ ] **REL.06 — Deploy isolated staging with synthetic content.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Validate provider behavior before real cutover.
  - **Uses / connects:** Cloud backend, frontend project, staging domains, noindex.
  - **Done when:** Browser/mobile smoke succeeds; staging cannot access production private resources.

- [ ] **REL.07 — Configure final public/server origins.**
  - **Why / outcome:** Avoid localhost URLs, broken metadata and incorrect geo paths.
  - **Uses / connects:** API_BASE, SITE_URL, NEXT_PUBLIC_SITE_URL, same-origin rewrites.
  - **Done when:** Browser network/HTML contain correct public URLs; no browser localhost dependencies.

- [ ] **REL.08 — Verify frontend hosting root/build/output settings.**
  - **Why / outcome:** Monorepo settings must match actual runtime.
  - **Uses / connects:** apps/web project settings, workspace install, backend availability.
  - **Done when:** Preview candidate builds and renders real data with expected cache behavior.

- [ ] **REL.09 — Verify TLS, DNS, CSP and provider routing.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Headers and certificates must work across real origins.
  - **Uses / connects:** DNS owner, frontend/Worker routes, approved embed/media hosts.
  - **Done when:** HTTPS/redirect/security-header and origin tests pass externally.

- [ ] **REL.10 — Perform private production backup before migration.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Preserve existing service data before destructive change.
  - **Uses / connects:** OPS backup/restore tooling, resource manifest.
  - **Done when:** Backup verified with checksum and restore candidate; recovery access tested.

- [ ] **REL.11 — Freeze or reconcile old-site writes during final import.**
  - **Why / outcome:** Avoid losing posts created between snapshots.
  - **Uses / connects:** Editorial freeze window or delta-import plan.
  - **Done when:** Final source/destination counts and content changes reconciled.

- [ ] **REL.12 — Apply approved real content migration.**
  - **Why / outcome:** Move actual owned content rather than sample fixtures.
  - **Uses / connects:** MIG import job, rights sign-off, dry-run report.
  - **Done when:** Per-item receipt complete; blocking media/date/URL issues resolved.

- [ ] **REL.13 — Run non-destructive production readiness checks.**
  - **2026-10-28 state: I.** Plan-only deployment, explicit account/apply, opt-in content writes, safe dotenv and read-only smoke implemented. Local plan/smoke tests pass; cloud provisioning/staging/repeated-release behavior not verified.
  - **Why / outcome:** Production data is not a test fixture.
  - **Uses / connects:** Read-only smoke, synthetic dedicated test records if approved.
  - **Done when:** Core routes/assets/controls/redirects pass without resetting real-user limiters.

- [ ] **REL.14 — Approve go/no-go and rollback triggers.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Launch requires accountable risk acceptance.
  - **Uses / connects:** QA report, SEC sign-off, PO budget, MOD coverage, OPS runbooks.
  - **Done when:** Named approvers sign exact release version; abort thresholds documented.

- [ ] **REL.15 — Switch traffic/domain gradually where supported.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Limit cutover blast radius.
  - **Uses / connects:** DNS/hosting controls, TTL plan, monitoring, old host.
  - **Done when:** Traffic reaches intended release; rollback window and old-host limitations known.

- [ ] **REL.16 — Observe launch and verify user journeys.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Deployment success is not product success.
  - **Uses / connects:** External monitors, real device/browser checks, support inbox.
  - **Done when:** Start/read/search/contact and enabled engagement work; no critical alerts.

- [ ] **REL.17 — Exercise rollback or forward-repair decision procedure.**
  - **Why / outcome:** Data migrations and clients require compatible recovery.
  - **Uses / connects:** Previous artifact, schema compatibility, feature flags, restore plan.
  - **Done when:** Rehearsal proves recovery without blindly reverting schema or losing newer data.

- [ ] **REL.18 — Complete 24-hour and 7-day launch reviews.**
  - **2026-10-28 state: B.** Requires named owner/provider/legal approval, access to relevant live resources, independent participants or native toolchain/physical devices. No approval, cloud change, signed artifact or device result is inferred from local implementation; see docs/status.md release blockers.
  - **Why / outcome:** Catch delayed cache, email, cron and crawl problems.
  - **Uses / connects:** OPS dashboard, backups, moderation, 404s, cost, feedback.
  - **Done when:** Findings assigned and release ledger updated before wider promotion.

<a id="workstream-account"></a>

### ACCOUNT — Optional reader accounts and cross-device continuity

**Accountable:** BE · **Reviewers/partners:** AND, FE, PO, SEC, LEGAL, QA, MOD · **Priority:** P3 · **Initial state:** D · **Gate:** G5 only after validated demand

**Entry dependencies:** PROD demand evidence; DATA privacy; stable anonymous/local experience; G2. **External needs/blockers:** Owner approval; reviewed identity provider and recovery support capacity.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **ACCOUNT.01 — Validate whether cross-device sync merits accounts.**
  - **Why / outcome:** Avoid forcing registration for casual play.
  - **Uses / connects:** User research, local favorites/history feedback, support cost.
  - **Done when:** Clear benefit and adoption hypothesis; keep anonymous play available.

- [ ] **ACCOUNT.02 — Choose managed identity and threat model.**
  - **Why / outcome:** Do not invent password security casually.
  - **Uses / connects:** OAuth/passkey/email options, provider review, account recovery.
  - **Done when:** ADR covers takeover, enumeration, session theft and provider outage.

- [ ] **ACCOUNT.03 — Define account data and deletion semantics.**
  - **Why / outcome:** Identity changes privacy and store obligations.
  - **Uses / connects:** User IDs, preferences, favorites, score ownership, retention.
  - **Done when:** Minimal data model and deletion/export policy approved.

- [ ] **ACCOUNT.04 — Implement safe authentication flows.**
  - **Why / outcome:** Make login optional and understandable.
  - **Uses / connects:** Provider SDK/server validation, redirect allowlist, short-lived sessions.
  - **Done when:** Login/logout/expiry/error flows pass on web and Android.

- [ ] **ACCOUNT.05 — Secure Android credential/session storage.**
  - **Why / outcome:** Tokens must not leak through local JavaScript/logs.
  - **Uses / connects:** OS-backed storage where appropriate, refresh rotation, bridge boundary.
  - **Done when:** Release artifact/log/storage audit passes; revoked tokens stop working.

- [ ] **ACCOUNT.06 — Implement account recovery and abuse controls.**
  - **Why / outcome:** Lost access and fraudulent accounts need a response.
  - **Uses / connects:** Provider recovery, throttles, session/device revocation.
  - **Done when:** Recovery does not expose membership or weaken provider guarantees.

- [ ] **ACCOUNT.07 — Migrate local data with explicit consent.**
  - **Why / outcome:** Do not upload private device history silently.
  - **Uses / connects:** Local favorites/best/history, user confirmation, merge rules.
  - **Done when:** User can choose what syncs; cancel leaves data local.

- [ ] **ACCOUNT.08 — Implement idempotent sync and conflict resolution.**
  - **Why / outcome:** Intermittent devices can overwrite newer preferences.
  - **Uses / connects:** Per-item versions/tombstones, retry keys, offline queue.
  - **Done when:** Concurrent edits/deletes converge under documented policy.

- [ ] **ACCOUNT.09 — Keep local best and ranked identity distinct.**
  - **Why / outcome:** Login alone does not validate past scores.
  - **Uses / connects:** SCORE trust policy, account linkage rules.
  - **Done when:** Unverified scores cannot become verified by linking an account.

- [ ] **ACCOUNT.10 — Add account export and deletion UI/API.**
  - **Why / outcome:** Users need practical control over stored identity.
  - **Uses / connects:** Verified deletion, provider cleanup, backup suppression, web deletion page.
  - **Done when:** End-to-end deletion verified across web/app/providers and future restore.

- [ ] **ACCOUNT.11 — Provide permissions and blocked-user controls if needed.**
  - **Why / outcome:** New identity can enable new abuse patterns.
  - **Uses / connects:** Community policy, reporting, privacy controls.
  - **Done when:** Applicable UGC requirements met before identity-linked interactions expand.

- [ ] **ACCOUNT.12 — Test old-version and account-switch behavior.**
  - **Why / outcome:** Shared devices must not show another person's data.
  - **Uses / connects:** Cache partitioning, logout cleanup, sync reset, compatibility fixtures.
  - **Done when:** No cross-account data leakage; offline queues cannot submit as wrong account.

- [ ] **ACCOUNT.13 — Pilot accounts without gating play.**
  - **Why / outcome:** Measure value rather than manufacture signups.
  - **Uses / connects:** Feature flag, voluntary cohort, privacy-respecting metrics.
  - **Done when:** Benefit outweighs support/security cost; rollback retains anonymous experience.

<a id="workstream-grow"></a>

### GROW — Evidence-led growth, content and product evolution

**Accountable:** PO · **Reviewers/partners:** DATA, ED, UX, GAME, LEGAL, OPS, AND · **Priority:** P3 · **Initial state:** D · **Gate:** G5; ongoing after stable launches

**Entry dependencies:** Stable G2/G4; approved measurement/consent plan; costs and support sustainable. **External needs/blockers:** Sufficient audience evidence; rights/translation/partnership capacity.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [ ] **GROW.01 — Define event semantics and measurement limits.**
  - **Why / outcome:** Pageviews do not measure enjoyable successful play.
  - **Uses / connects:** Start/ready/end/failure, search, guide usefulness, privacy inventory.
  - **Done when:** Event dictionary avoids sensitive payloads and unsupported cross-day identity assumptions.

- [ ] **GROW.02 — Implement minimal aggregate product telemetry.**
  - **Why / outcome:** Answer product questions without invasive tracking.
  - **Uses / connects:** First-party endpoints, sampling, retention, opt-out policy.
  - **Done when:** Synthetic journeys produce expected deduplicated aggregates; failures never block play.

- [ ] **GROW.03 — Create a weekly product-quality dashboard.**
  - **Why / outcome:** Put usefulness and reliability ahead of vanity metrics.
  - **Uses / connects:** Successful sessions, start failures, data cost, feedback, support.
  - **Done when:** Dashboard shows sample sizes and segments only when privacy-safe.

- [ ] **GROW.04 — Establish retention baseline through lawful means.**
  - **Why / outcome:** Daily hashes cannot provide durable cohorts.
  - **Uses / connects:** Voluntary surveys or approved consented identity design.
  - **Done when:** Method/limitations documented before publishing retention figures.

- [ ] **GROW.05 — Collect lightweight in-context feedback.**
  - **Why / outcome:** Learn why games/guides help or disappoint.
  - **Uses / connects:** Optional post-session question, report-broken flow.
  - **Done when:** Feedback is skippable, accessible, rate-limited and reaches an owner.

- [ ] **GROW.06 — Create a curated editorial cadence.**
  - **Why / outcome:** Fresh useful content supports sustainable return visits.
  - **Uses / connects:** Guide gaps, catalog health, original research/playtests.
  - **Done when:** Each new piece has accuracy, rights, accessibility and freshness review.

- [ ] **GROW.07 — Expand games only through admission checks.**
  - **Why / outcome:** More titles should not reduce catalog trust.
  - **Uses / connects:** CAT rights/capabilities, GAME device tests, performance budgets.
  - **Done when:** New game passes standard checklist before Play now visibility.

- [ ] **GROW.08 — Test transparent collections before personalization.**
  - **Why / outcome:** Editorial discovery is cheaper and less invasive.
  - **Uses / connects:** Short-session/offline/touch collections, explicit filters.
  - **Done when:** Users find suitable games faster in evaluated tasks.

- [ ] **GROW.09 — Run bounded experiments with guardrails.**
  - **Why / outcome:** Prevent revenue/engagement wins masking quality loss.
  - **Uses / connects:** Experiment plan, sample-size logic, flags, quality/cost metrics.
  - **Done when:** Hypothesis, stop conditions and analysis plan approved before rollout.

- [ ] **GROW.10 — Evaluate localization from real demand.**
  - **Why / outcome:** English-only gaps need prioritization, not automatic translations.
  - **Uses / connects:** Audience feedback, language requests, editorial capacity.
  - **Done when:** Target language has support/moderation owner and benefit case.

- [ ] **GROW.11 — Build locale/content workflow when approved.**
  - **Why / outcome:** Translation affects routing, SEO and game instructions.
  - **Uses / connects:** Message catalogs, locale schema/routes, hreflang, RTL if relevant.
  - **Done when:** Human-reviewed locale passes layout, search, metadata and device QA.

- [ ] **GROW.12 — Evaluate partnerships with explicit rights and privacy.**
  - **Why / outcome:** External catalogs/SDKs introduce obligations.
  - **Uses / connects:** Provider contracts, tracking review, revenue/cost model.
  - **Done when:** Partnership admitted only after legal/security/performance review.

- [ ] **GROW.13 — Optimize infrastructure based on measured bottlenecks.**
  - **Why / outcome:** Avoid premature migrations to complex services.
  - **Uses / connects:** OPS cost/query metrics, cache hit rate, capacity tests.
  - **Done when:** Change ADR includes before/after evidence and rollback; current stack retained where sufficient.

- [ ] **GROW.14 — Evaluate optional premium/supporter models separately.**
  - **Why / outcome:** Billing can conflict with the free-play promise.
  - **Uses / connects:** User research, economics, store payment rules, consumer law.
  - **Done when:** New scope explicitly approved; essential free play not silently paywalled.

- [ ] **GROW.15 — Review quarterly roadmap and retire weak features.**
  - **Why / outcome:** Highest potential includes removing maintenance burden.
  - **Uses / connects:** Adoption, support cost, accessibility debt, failure rates.
  - **Done when:** Keep/improve/retire decisions documented with user migration plan.

- [ ] **GROW.16 — Schedule dependency, content and game balance maintenance.**
  - **Why / outcome:** Quality decays without recurring ownership.
  - **Uses / connects:** Security advisories, provider changes, game playtests, policy dates.
  - **Done when:** Monthly/quarterly owner calendar with overdue escalation exists.

<a id="workstream-doc"></a>

### DOC — Documentation accuracy and sustainable handover

**Accountable:** PO · **Reviewers/partners:** ED, BE, FE, AND, OPS, QA, SEC · **Priority:** P1 · **Initial state:** T · **Gate:** Every release; final G2/G4 handover

**Entry dependencies:** BASE.12; update alongside each implementation task. **External needs/blockers:** Named maintainers and actual release evidence.

**Working order:** follow numbered items; each next item inherits the preceding item as a planning dependency until explicitly parallelized. Acceptance below supplements the global definition of done.

- [x] **DOC.01 — Mark historical status claims as historical.**
  - **2026-10-28 state: V.** README, docs/status.md, recovery.md and importing-content.md corrected; historical report retained as superseded. Dated test scope, limitations and per-task evidence recorded; no blanket completion.
  - **Why / outcome:** Avoid treating previous claims as fresh verification.
  - **Uses / connects:** docs/status.md, audit ledger, README status link.
  - **Done when:** Reader sees date/scope and current risk caveat before old completion claims.

- [x] **DOC.02 — Correct backup/restore descriptions.**
  - **2026-10-28 state: V.** README, docs/status.md, recovery.md and importing-content.md corrected; historical report retained as superseded. Dated test scope, limitations and per-task evidence recorded; no blanket completion.
  - **Why / outcome:** Current exports are JSON, not directly executable SQL.
  - **Uses / connects:** README/status/import docs, OPS backup design.
  - **Done when:** Docs name actual format, private storage and tested restore procedure.

- [x] **DOC.03 — Correct import and rollback contract documentation.**
  - **2026-10-28 state: V.** README, docs/status.md, recovery.md and importing-content.md corrected; historical report retained as superseded. Dated test scope, limitations and per-task evidence recorded; no blanket completion.
  - **Why / outcome:** Wrong endpoints/guarantees cause destructive mistakes.
  - **Uses / connects:** /admin/rollback/:jobId, dry-run behavior, MIG implementation.
  - **Done when:** Examples match tested routes; unsupported reversibility claims removed.

- [x] **DOC.04 — Correct media and old-host redirect claims.**
  - **2026-10-28 state: V.** README, docs/status.md, recovery.md and importing-content.md corrected; historical report retained as superseded. Dated test scope, limitations and per-task evidence recorded; no blanket completion.
  - **Why / outcome:** Local registry does not control a third-party host.
  - **Uses / connects:** Media normalization, rights transfer, source-domain plan.
  - **Done when:** Docs distinguish hosted/mapped/redirectable URLs and known host limits.

- [ ] **DOC.05 — Document secure configuration and local setup.**
  - **2026-10-28 state: I.** Updated README/local setup, provisional architecture decisions, recovery/mobile runbooks and in-app help. Second-operator/device validation and approval gates remain open.
  - **Why / outcome:** New maintainers need safe reproducible commands.
  - **Uses / connects:** .env.example, Node/toolchain pin, migration order, relative browser URLs.
  - **Done when:** New contributor follows setup without secrets in chat or browser localhost calls.

- [x] **DOC.06 — Document test scope and command safety.**
  - **2026-10-28 state: V.** README, docs/status.md, recovery.md and importing-content.md corrected; historical report retained as superseded. Dated test scope, limitations and per-task evidence recorded; no blanket completion.
  - **Why / outcome:** Prevent production mutation and false test confidence.
  - **Uses / connects:** Unit/integration/browser/mobile commands, verifier safeguards.
  - **Done when:** Each command states environment, data effects and required access.

- [ ] **DOC.07 — Record architecture decisions and diagrams.**
  - **2026-10-28 state: I.** Updated README/local setup, provisional architecture decisions, recovery/mobile runbooks and in-app help. Second-operator/device validation and approval gates remain open.
  - **Why / outcome:** Preserve reasons behind choices for future teams.
  - **Uses / connects:** ADR Android, auth, cache, backup, offline and provider decisions.
  - **Done when:** Accepted/rejected alternatives and re-evaluation triggers stored in repo.

- [ ] **DOC.08 — Document release/rollback/recovery procedures.**
  - **2026-10-28 state: I.** Updated README/local setup, provisional architecture decisions, recovery/mobile runbooks and in-app help. Second-operator/device validation and approval gates remain open.
  - **Why / outcome:** Reduce dependence on the original developer.
  - **Uses / connects:** REL/STORE/OPS runbooks, artifact and key custody.
  - **Done when:** Second operator completes staging release and restore using docs.

- [ ] **DOC.09 — Create support and moderation handbook.**
  - **Why / outcome:** Product safety depends on humans, not just routes.
  - **Uses / connects:** MOD policies, escalation contacts, queue tools, response templates.
  - **Done when:** Operator handles sample incident, rights complaint and privacy request.

- [ ] **DOC.10 — Publish known limitations and user help.**
  - **2026-10-28 state: I.** Updated README/local setup, provisional architecture decisions, recovery/mobile runbooks and in-app help. Second-operator/device validation and approval gates remain open.
  - **Why / outcome:** Do not market unsupported offline/accessibility capabilities.
  - **Uses / connects:** Web help, Android listing, game controls, provider limitations.
  - **Done when:** User-facing copy matches tested capabilities and offers support.

- [x] **DOC.11 — Update task states with evidence and risk acceptance.**
  - **2026-10-28 state: V.** README, docs/status.md, recovery.md and importing-content.md corrected; historical report retained as superseded. Dated test scope, limitations and per-task evidence recorded; no blanket completion.
  - **Why / outcome:** Keep roadmap useful after the initial snapshot.
  - **Uses / connects:** IDs, issues/PRs, checks, owner decisions, CSV snapshot policy.
  - **Done when:** Every completed/deferred item has reason/evidence; release gaps remain visible.

- [ ] **DOC.12 — Complete maintenance ownership handover.**
  - **Why / outcome:** Finished v1 means someone can operate and improve it.
  - **Uses / connects:** Provider accounts, secure access, budgets, calendars, recovery contacts.
  - **Done when:** Named primary/backup owners acknowledge responsibilities; no credentials embedded in docs.

## Operating cadence and change control

### Daily during active delivery

- Review critical security and production incidents before feature work.
- Keep at most a small number of tasks in progress per person; finish evidence/review before starting more.
- Move blockers to a visible queue with a named owner and next review date.
- Reproduce and classify new defects; attach them to a task/risk rather than burying them in chat.

### Weekly

- PO/UX review user feedback and scope; ED reviews catalog accuracy and rights.
- Engineering/QA review dependencies, test failures, accessibility and performance regressions.
- SEC/OPS review advisories, backup age, error trends, access changes and cost alerts.
- MOD reviews unresolved reports, response times and whether enabled community features remain supportable.
- Update completed tasks with evidence and publish a short **done / next / blocked / decisions** report.

### At each release gate

1. Freeze the exact candidate commit and build/artifact IDs.
2. List included task IDs and disabled/deferred features.
3. Attach positive/negative/device/security/accessibility/recovery evidence.
4. Confirm rights, privacy, policy, environment and support readiness.
5. Record open defects by severity, user impact, workaround and owner.
6. Require accountable PO + QA + engineering/OPS approval; SEC/legal approval for relevant risks.
7. Rehearse rollback/forward repair and verify monitoring before public promotion.
8. Observe the rollout and compare real metrics to the release thresholds.
9. Review after 24 hours, 7 days and 30 days; promote only if evidence supports it.

**Stop-ship:** exposed private data, reachable unmitigated critical/high security defect, unsafe destructive migration, inability to restore essential data, unlicensed launch content, broken launch-game input, critical accessibility barrier in a core shell journey, incompatible supported installed clients, false privacy/store declarations, or no responsible incident operator. Feature-specific problems may be resolved by disabling that feature and its UI, provided core journeys and obligations remain satisfied. Product preferences do not waive these safeguards.

### Per-task execution/issue template

```text
ID / title:
State: T | B | D | In progress | In review | Verified complete
Priority / release gate:
Accountable person / reviewer:
User problem and expected outcome:
Source finding or research evidence:
Scope / explicit exclusions:
Files, schema, API, providers and clients affected:
Prerequisite IDs / external blocker / unblock owner / review date:
Estimate range / confidence / unknowns:
Implementation substeps (split further if >2 focused days):
Acceptance tests (happy, invalid, failure, concurrency, accessibility):
Privacy, rights, security and compatibility impact:
Feature flag / telemetry / operational owner:
Migration / rollout / rollback or forward-repair plan:
Evidence: commit or PR, command/device/environment/date/results:
Docs / support instructions updated:
Approval / completion date / residual risks:
```

### First-release completion is not end of maintenance

“Finish” means a trustworthy web service and Android release that users can actually use, operators can recover and maintain, and the team can improve from evidence. It does not mean every optional growth idea is implemented. Preserve free anonymous play, accurate availability, low-data usability and safe operations as permanent constraints. Revise the roadmap when real research or platform requirements change; do not silently turn assumptions into completed facts.
