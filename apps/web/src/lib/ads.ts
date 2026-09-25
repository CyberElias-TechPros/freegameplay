// ─────────────────────────────────────────────────────────────────────────────
// AdSense configuration — unit inventory migrated from the old site.
//
// PUBLISHER ID
//   The 10-digit numbers below are the ad SLOTS (data-ad-slot values).
//   The publisher ID (ca-pub-XXXXXXXXXXXXXXXX) is NOT part of the unit list —
//   set it once via env and every slot below goes live:
//
//     NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
//
//   Until it is set, every placement renders a clearly-labelled placeholder
//   box instead (no script loads, no network calls) so the layout is visible
//   in preview/development.
//
// DEVICE RULES (why, per AdSense quality guidance):
//   • "-top" placements (above the fold) render on DESKTOP only —
//     mobile above-the-fold banners are the top quality-score killer and
//     eat the entire first viewport.
//   • in-article / in-feed / below-content / sidebar placements render on
//     ALL devices with fully responsive units (data-full-width-responsive) —
//     never hard-coded pixel sizes.
//   • The interactive game pages (/games/[slug]) and 404 carry NO ads —
//     ads on an active play surface create user-initiated clicks
//     (policy violation), and empty error pages should not monetise.
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_PUBLISHER = "ca-pub-0000000000000000";

export function publisherId(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT || PLACEHOLDER_PUBLISHER;
}

/** True once the real publisher id is configured — gates script + ad push. */
export function adsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
  return v.length > 0 && v !== PLACEHOLDER_PUBLISHER;
}

/** Legacy unit name → data-ad-slot (the 10-digit ids from the old site). */
export const AD_SLOTS: Record<string, string> = {
  "Home-Page-Top-Ad": "4995416581",
  "Home-Page-Small-Ad-Unit": "3702516210",
  "Home-Page-Below-Ad-Unit": "6983285679",
  "Page-Top-Ad-Unit": "7813151618",
  "earn online (in-feed)": "7893994353",
  "earnings 2 (in-feed)": "2284243324",
  "earnings 3 (in-article)": "9971161657",
  "De-Tax (display)": "7966964742",
  "De-Tax1 (in-feed)": "7138659300",
  "De-Tax2 (in-article)": "7468271297",
  "De-Tax4 (multiplex)": "9573250952",
  "studyabroadupdates2025_content-section-1_AdSense2_1x1_as": "4059036212",
  "studyabroadupdates2025_content-section-2_AdSense1_1x1_as": "5811101585",
  "studyabroadupdates2025_sidebar1_AdSense1_1x1_as": "7606133987",
  "studyabroadupdates2025_sidebar2_AdSense2_1x1_as": "9457631077",
  "About-Page-Top-Ad": "9982059506",
  "About-Between-Content-Ad-Unit": "1952344480",
  "About-Below-Ad-Unit": "3053689074",
  "Contact-Page-Top-Ad": "8453355413",
  "Contact-Below-Ad-Unit": "6801362393",
  "PandP-Between-Ad-Unit": "8651590561",
  "PandP-page-Below-Ad-Unit": "9235954044",
};

export type AdPlacement =
  // home
  | "home-top"
  | "home-small"
  | "home-infeed"
  | "home-below"
  // list pages: /games /blog /guides /search /categories
  | "list-top"
  | "list-infeed-1"
  | "list-infeed-2"
  | "list-below"
  // post article pages
  | "article-top"
  | "article-inline-1"
  | "article-inline-2"
  | "article-sidebar"
  | "article-below"
  // guide pages
  | "guide-sidebar"
  | "guide-below"
  // static pages
  | "about-top"
  | "about-inline"
  | "about-below"
  | "contact-top"
  | "contact-below"
  | "privacy-between"
  | "privacy-below";

export interface PlacementSpec {
  unit: string; // legacy unit name
  slot: string; // data-ad-slot
  device: "all" | "desktop";
  /** Above the fold → data-block-on-load so it never auto-refreshes in view. */
  aboveFold?: boolean;
  note: string;
}

export const PLACEMENTS: Record<AdPlacement, PlacementSpec> = {
  "home-top": {
    unit: "Home-Page-Top-Ad",
    slot: AD_SLOTS["Home-Page-Top-Ad"],
    device: "desktop",
    aboveFold: true,
    note: "Banner under the header on the home page (desktop only).",
  },
  "home-small": {
    unit: "Home-Page-Small-Ad-Unit",
    slot: AD_SLOTS["Home-Page-Small-Ad-Unit"],
    device: "all",
    note: "Compact unit below the hero, above the first section.",
  },
  "home-infeed": {
    unit: "earn online (in-feed)",
    slot: AD_SLOTS["earn online (in-feed)"],
    device: "all",
    note: "In-feed unit between content sections on the home page.",
  },
  "home-below": {
    unit: "Home-Page-Below-Ad-Unit",
    slot: AD_SLOTS["Home-Page-Below-Ad-Unit"],
    device: "all",
    note: "Below the last home section, above the footer.",
  },
  "list-top": {
    unit: "Page-Top-Ad-Unit",
    slot: AD_SLOTS["Page-Top-Ad-Unit"],
    device: "desktop",
    aboveFold: true,
    note: "Generic top banner for list/browse pages (desktop only).",
  },
  "list-infeed-1": {
    unit: "De-Tax1 (in-feed)",
    slot: AD_SLOTS["De-Tax1 (in-feed)"],
    device: "all",
    note: "In-feed, after the 3rd item in games/blog/guides/search lists.",
  },
  "list-infeed-2": {
    unit: "earnings 2 (in-feed)",
    slot: AD_SLOTS["earnings 2 (in-feed)"],
    device: "all",
    note: "In-feed, after the 7th item in list pages.",
  },
  "list-below": {
    unit: "De-Tax4 (multiplex)",
    slot: AD_SLOTS["De-Tax4 (multiplex)"],
    device: "all",
    note: "Multiplex banner below the list content.",
  },
  "article-top": {
    unit: "studyabroadupdates2025_content-section-1_AdSense2_1x1_as",
    slot: AD_SLOTS["studyabroadupdates2025_content-section-1_AdSense2_1x1_as"],
    device: "desktop",
    aboveFold: true,
    note: "Content-section unit above the article body (desktop only).",
  },
  "article-inline-1": {
    unit: "De-Tax2 (in-article)",
    slot: AD_SLOTS["De-Tax2 (in-article)"],
    device: "all",
    note: "In-article, inserted at ~40% of the post content.",
  },
  "article-inline-2": {
    unit: "earnings 3 (in-article)",
    slot: AD_SLOTS["earnings 3 (in-article)"],
    device: "all",
    note: "In-article, inserted at ~75% of the post content.",
  },
  "article-sidebar": {
    unit: "studyabroadupdates2025_sidebar1_AdSense1_1x1_as",
    slot: AD_SLOTS["studyabroadupdates2025_sidebar1_AdSense1_1x1_as"],
    device: "desktop",
    note: "Sticky rail on post pages (≥1100px).",
  },
  "article-below": {
    unit: "studyabroadupdates2025_content-section-2_AdSense1_1x1_as",
    slot: AD_SLOTS["studyabroadupdates2025_content-section-2_AdSense1_1x1_as"],
    device: "all",
    note: "Content-section unit below the article body.",
  },
  "guide-sidebar": {
    unit: "studyabroadupdates2025_sidebar2_AdSense2_1x1_as",
    slot: AD_SLOTS["studyabroadupdates2025_sidebar2_AdSense2_1x1_as"],
    device: "desktop",
    note: "Sticky rail on guide pages (≥1100px).",
  },
  "guide-below": {
    unit: "De-Tax (display)",
    slot: AD_SLOTS["De-Tax (display)"],
    device: "all",
    note: "Display unit below the guide content.",
  },
  "about-top": {
    unit: "About-Page-Top-Ad",
    slot: AD_SLOTS["About-Page-Top-Ad"],
    device: "desktop",
    aboveFold: true,
    note: "Top banner on the About page (desktop only).",
  },
  "about-inline": {
    unit: "About-Between-Content-Ad-Unit",
    slot: AD_SLOTS["About-Between-Content-Ad-Unit"],
    device: "all",
    note: "Between the About page content blocks.",
  },
  "about-below": {
    unit: "About-Below-Ad-Unit",
    slot: AD_SLOTS["About-Below-Ad-Unit"],
    device: "all",
    note: "Below the About page content.",
  },
  "contact-top": {
    unit: "Contact-Page-Top-Ad",
    slot: AD_SLOTS["Contact-Page-Top-Ad"],
    device: "desktop",
    aboveFold: true,
    note: "Top banner on the Contact page (desktop only).",
  },
  "contact-below": {
    unit: "Contact-Below-Ad-Unit",
    slot: AD_SLOTS["Contact-Below-Ad-Unit"],
    device: "all",
    note: "Below the contact form.",
  },
  "privacy-between": {
    unit: "PandP-Between-Ad-Unit",
    slot: AD_SLOTS["PandP-Between-Ad-Unit"],
    device: "all",
    note: "Between the privacy policy content blocks.",
  },
  "privacy-below": {
    unit: "PandP-page-Below-Ad-Unit",
    slot: AD_SLOTS["PandP-page-Below-Ad-Unit"],
    device: "all",
    note: "Below the privacy policy content.",
  },
};

// ── Consent / geo (client-side, module singleton) ────────────────────────────
// Region detection happens client-side so the layout stays fully static:
// the content API (Cloudflare) knows the visitor's country via request.cf,
// and AdUnits/ConsentBanner share this module's singleton state.

export const CONSENT_REQUIRED_REGIONS = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE","IS","IT","LI","LT","LU","LV","MT","ME","NL","NO","PL","PT","RO","RS","SE","SI","SK","UK","CH",
]);

export type ConsentState = "pending" | "granted" | "denied";

const CONSENT_COOKIE = "fg-consent";

let geoPromise: Promise<string> | null = null;
let consent: ConsentState = "pending";
let scriptLoading = false;
const listeners = new Set<() => void>();

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith(CONSENT_COOKIE + "="));
  return m ? decodeURIComponent(m.slice(CONSENT_COOKIE.length + 1)) : null;
}

export function writeConsentCookie(value: "ads" | "essential") {
  const d = new Date();
  d.setTime(d.getTime() + 60 * 60 * 24 * 365 * 1000);
  document.cookie = `${CONSENT_COOKIE}=${value}; expires=${d.toUTCString()}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** Visitor's country (2-letter). "local"/"unknown" when the API can't tell. */
export function getCountry(): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve("unknown");
  if (!geoPromise) {
    const cached = sessionStorage.getItem("fg-country");
    if (cached) {
      geoPromise = Promise.resolve(cached);
    } else {
      geoPromise = fetch(`${apiBaseForGeo()}/api/geo`)
        .then((r) => (r.ok ? r.json() : { country: "unknown" }))
        .then((d: { country?: string }) => {
          const c = (d.country ?? "unknown").toUpperCase();
          sessionStorage.setItem("fg-country", c);
          return c;
        })
        .catch(() => "unknown");
    }
  }
  return geoPromise;
}

function apiBaseForGeo(): string {
  return (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || window.location.origin;
}

export function getConsentState(): ConsentState {
  return consent;
}

export function setConsentState(s: ConsentState) {
  consent = s;
  listeners.forEach((l) => l());
}

export function onConsentChange(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function gtagConsentUpdate(values: Record<string, string>) {
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = w.gtag ?? function gtag(...args: unknown[]) {
    (w.dataLayer as unknown[]).push(args);
  };
  w.gtag("consent", "update", values);
}

/** Load the adsbygoogle script exactly once (only when ads are granted). */
function loadAdScript() {
  if (scriptLoading || document.querySelector('script[data-adsense]')) return;
  scriptLoading = true;
  const s = document.createElement("script");
  s.dataset.adsense = "1";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId()}&hl=en`;
  document.head.appendChild(s);
}

/**
 * Shared bootstrap: resolve geo → consent state → (granted) load ad script.
 * Safe to call from every AdUnit; the promise + flags make it once-only.
 */
let bootstrapPromise: Promise<void> | null = null;
export function bootstrapAds(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (!adsEnabled()) {
        setConsentState("denied"); // placeholders are fine without consent
        return;
      }
      const cookie = readCookie();
      const country = await getCountry();
      const required = CONSENT_REQUIRED_REGIONS.has(country);
      if (cookie === "ads") {
        gtagConsentUpdate({ ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
        setConsentState("granted");
        loadAdScript();
      } else if (cookie === "essential") {
        gtagConsentUpdate({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
        setConsentState("denied");
      } else if (required) {
        // EEA/UK/CH without a choice yet: deny by default, banner will ask.
        gtagConsentUpdate({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
        setConsentState("denied");
      } else {
        setConsentState("granted");
        loadAdScript();
      }
    })();
  }
  return bootstrapPromise;
}

/** True when the consent banner should be visible (EEA/UK/CH, no choice yet). */
export function isConsentBannerVisible(): boolean {
  const cookie = typeof document === "undefined" ? null : readCookie();
  if (cookie) return false;
  if (!adsEnabled()) return false;
  return consent === "denied" && CONSENT_REQUIRED_REGIONS.has(sessionStorage.getItem("fg-country") ?? "");
}

/**
 * Units from the old inventory that have NO equivalent page in this app and
 * are therefore intentionally NOT mounted (kept here so the mapping is
 * explicit and auditable, not lost):
 *
 *   Viewer-Top-Ad / Viewer-Page-Small-Ad-Unit / Viewer-Page-Below-Ad-Unit
 *   Register-Top-Ad / Register-Form-Between-Ad-Unit / Register-Page-Below-Ad-Unit
 *   Profile-Top-Ad-Place / Profile-Page-Below-Ad-Unit
 *   Pay-Top-Ad / Pay-Page-Below-Ad-Unit
 *   TandC-Top-Ad / TandC-Page-Between-Ad-Unit / TandC-Page-Below-Ad-Unit
 *   PandP-Top-Ad
 *   studyabroadupdates2025_sidebar_AdSense3_1x1_as
 *   studyabroadupdates2025_footer-sec1/2/3_AdSense* (footer area is covered
 *     by the below-content units on every page)
 *
 * If those app pages (viewer/pay/register/profile/T&Cs) come back in a future
 * version, mount their units with <AdUnit placement=…> using the ids:
 *   Viewer 5186988271 / 3065281453 / 1424912632
 *   Register 9906037883 / 1943771475 / 6629956096
 *   Profile 8160635978 / 6137107860
 *   Pay 6963104376 / 4109710322
 *   TandC 3532201225 / 9044382356 / 6438384406
 *   PandP-Top 6308498256
 */
