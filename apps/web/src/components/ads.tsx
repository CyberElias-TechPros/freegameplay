"use client";

// AdUnit — a single AdSense placement (client-side consent aware).
//
//  • publisher id not configured → labelled placeholder box (layout visible,
//    zero network traffic) — preview/dev mode.
//  • consent denied (EEA/UK/CH visitor chose "essential only") → nothing
//    renders and no ad script is loaded.
//  • consent granted → responsive unit, data-block-on-load on above-fold
//    units. The adsbygoogle script is injected once by bootstrapAds().

import { useEffect, useRef, useState } from "react";
import { adsEnabled, bootstrapAds, getConsentState, onConsentChange, PLACEMENTS, publisherId, type AdPlacement } from "@/lib/ads";

export function AdUnit({ placement, className }: { placement: AdPlacement; className?: string }) {
  const spec = PLACEMENTS[placement];
  const enabled = adsEnabled();
  const [state, setState] = useState<string>("pending");
  const pushed = useRef(false);
  void pushed;

  useEffect(() => {
    bootstrapAds();
    setState(getConsentState());
    return onConsentChange(() => setState(getConsentState()));
  }, []);

  const granted = state === "granted";

  // ads configured + consent explicitly denied → no ad markup at all
  if (enabled && state !== "pending" && !granted) return null;

  // ads configured + geo/consent still resolving → invisible no-op
  if (enabled && state === "pending") {
    return <div className={`ad-unit-pending ${className ?? ""}`} aria-hidden style={{ minHeight: 0, margin: 0 }} />;
  }

  // ads not configured → labelled placeholder (dev/preview)
  if (!enabled) {
    return (
      <aside className={`ad-unit ad-unit-placeholder ${className ?? ""}`} aria-hidden data-placement={placement} data-device={spec.device}>
        <span className="ad-label">
          ad · {placement}
          <em>
            {spec.unit} · {spec.slot}
          </em>
        </span>
      </aside>
    );
  }

  return (
    <aside className={`ad-unit ${className ?? ""}`} data-placement={placement} data-device={spec.device}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId()}
        data-ad-slot={spec.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
        {...(spec.aboveFold ? { "data-block-on-load": true } : {})}
      />
    </aside>
  );
}
