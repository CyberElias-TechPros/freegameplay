"use client";

// Consent banner — Google Consent Mode v2 front-end (client-side).
//
// Shown ONLY to visitors in regions where consent is required (EEA, UK, CH)
// and no choice has been made yet. The region comes from the content API
// (Cloudflare request.cf country, cached in sessionStorage) so the layout
// stays fully static. Everyone else: no prompt, ads load directly.
//
//  "Essential only" → ad storage denied, all ad units unmount.
//  "Accept all"     → ad storage granted, ad script loads, units render.
// Choice is stored in a first-party cookie (fg-consent) for one year and
// pushed to Google via gtag('consent','update', …).

import { useEffect, useState } from "react";
import { bootstrapAds, CONSENT_REQUIRED_REGIONS, getCountry, isConsentBannerVisible, setConsentState, writeConsentCookie, onConsentChange } from "@/lib/ads";

export function ConsentBanner() {
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    bootstrapAds();
    const refresh = () => {
      setVisible(isConsentBannerVisible());
      setTick((t) => t + 1);
    };
    // banner appears once geo resolves to a consent-required region
    getCountry().then(refresh);
    const off = onConsentChange(refresh);
    return () => {
      off();
      getCountry().catch(() => {});
    };
  }, []);

  const choose = (value: "ads" | "essential") => {
    writeConsentCookie(value);
    const v = value === "ads" ? "granted" : "denied";
    const w = window as unknown as { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = w.gtag ?? function gtag(...args: unknown[]) {
      (w.dataLayer as unknown[]).push(args);
    };
    w.gtag("consent", "update", { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
    setConsentState(value === "ads" ? "granted" : "denied");
    // load the ad script only on full acceptance
    if (value === "ads") bootstrapAds();
    setVisible(false);
  };

  if (!visible) return null;
  void tick;

  return (
    <div className="consent-bar" role="region" aria-label="Cookie and ad consent">
      <div className="consent-inner">
        <p>
          <b>We use ads.</b> AdSense (Google) and its partners set cookies to serve and improve ads. You can allow all,
          or keep only essential functions — in which case no ads will load.
        </p>
        <div className="consent-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => choose("essential")}>
            Essential only
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => choose("ads")}>
            Accept all
          </button>
          <a className="consent-link" href="/privacy-policy">
            Privacy policy
          </a>
        </div>
      </div>
    </div>
  );
}
