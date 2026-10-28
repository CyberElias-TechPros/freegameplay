# Pocket Arcade / Android release checklist

**2026-10-28 — development candidate, not store-ready.** Architecture is a provisional implementation, not an owner-approved public release commitment.

## Implemented

- `apps/mobile`: standalone React/Vite UI consuming `@fg/game-core`, not a remote WebView wrapper around the content site.
- Four bundled first-party games; search, saved games, local personal bests, visible instructions and on-screen controls.
- Native app-state listener pauses gameplay; back listener returns from games/settings, then exits at the arcade root. These native branches are implemented but not device-tested. Browser listeners are guarded so offline web play does not lazy-load native fallback modules.
- Safe public-URL sharing; no user-provided schemes or downloaded executable game packs.
- Local-data reset and storage-error messaging. Scores are explicitly personal, not verified leaderboards.
- No account, ad/analytics SDK, notifications or content API dependency. Android requests internet permission only; backups and cleartext traffic disabled; mixed content and WebView debugging disabled; no remote `server.url`.
- Hosted web edition: manifest/icons plus versioned public-static-only cache. First successful online installation is required. No API/admin/private responses are cached. Updating waits for existing tabs to close; remove hosted offline data using browser site-data controls. Packaged Android uses bundled assets directly.

## Repeatable build path

```bash
npm ci
npm run typecheck
npm test
npm run android:sync
# On an approved workstation/runner with Java 21 + Android SDK installed:
cd apps/mobile/android
./gradlew assembleDebug lintDebug
```

The manual `.github/workflows/android.yml` follows this path and retains a debug APK for seven days. It has **not been executed in this session**. Gradle/plugin downloads require provider access unavailable in the sandbox. `android:sync` passing means assets/plugins were copied, not that native compilation or installation succeeded.

## Blocking gates before public release

| Gate | Required evidence / decision |
|---|---|
| Product and identity | Approve bundled-client scope, target audience/age, package ID `site.freegameplay.app`, app name, domain ownership and support contact |
| Toolchain | Native build/lint passes; inspect merged release manifest, dependencies, permissions and bridge configuration |
| Branding | Review native launcher/splash assets, adaptive-icon cropping and store artwork; generated Capacitor defaults are not final store branding |
| Physical devices | Cold offline launch; all four games start/play/end/replay; low-end Android and varied WebView versions; touch accuracy; landscape/insets/large text |
| Lifecycle | Calls/background interruptions, lock/unlock, rotation, process death, restart, hardware/gesture/predictive back, no duplicate loops/results |
| Storage | Storage denied/full/corrupt, upgrade, reinstall and partial reset; current local storage is not a versioned migration repository |
| Accessibility | TalkBack, focus order, touch targets, contrast, font scaling, reduced-motion behavior and documented canvas limitations |
| Native security | Unapproved navigation/bridge calls rejected, share/file-provider scope reviewed, no runtime downloads of executable code, no debug endpoints/secrets |
| Privacy and rights | Actual release data-flow inventory, privacy URL, rights register, target-age and data-safety declarations reviewed; no claims inferred from absent SDKs alone |
| Signing | Owner-controlled key custody, upload key/recovery and app-signing policy; never commit keystores/passwords |
| Distribution | Version code policy, release-mode AAB inspection, internal testing, current store policies/target SDK requirements and review approval |
| Operations | Crash/ANR monitoring decision, support/incident owner, staged rollout and tested forward-repair plan |

## Test evidence and limitations

Nine Playwright journeys passed at 390×844: website media/game controls/local library/private-boundary checks, four mobile games after network loss, mobile favorite/reset persistence, and hosted offline reload after cache installation. They do not test Android's native bridge, cold packaged startup, physical touch latency, process recreation, signed upgrades, accessibility certification or store policy compliance.

Guides, accounts/sync, public rankings, downloadable packs, app links, push, native ads and crash SDKs are not included. Their roadmap entries remain open or conditional. Browser installation is not equivalent to an Android store release.
