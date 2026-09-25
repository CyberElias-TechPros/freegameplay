"use client";

// Newsletter sign-up. Double opt-in is handled server-side: this component
// only collects the address and reports the outcome. The confirmation email
// carries the link that actually activates the subscription.

import { useState } from "react";
import { clientSubscribe } from "@/lib/api";

export function SubscribeForm({ source = "site" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await clientSubscribe({ email, name: name || undefined, source, website: honeypot });
    setBusy(false);
    if (res.ok) {
      setStatus({ kind: "ok", text: res.message ?? "Almost there — check your inbox to confirm." });
      setEmail("");
      setName("");
    } else {
      setStatus({ kind: "err", text: res.error ?? "Something went wrong. Please try again." });
    }
  };

  return (
    <form className="subscribe" onSubmit={submit} noValidate>
      <input
        type="email"
        required
        value={email}
        maxLength={254}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
      />
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Subscribe"}
        <span aria-hidden>→</span>
      </button>
      {/* Honeypot — hidden from people, filled only by bots. */}
      <div aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor={`sub-name-${source}`}>Name</label>
        <input id={`sub-name-${source}`} tabIndex={-1} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor={`sub-web-${source}`}>Website</label>
        <input id={`sub-web-${source}`} tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      {status ? (
        <p className={`form-status ${status.kind}`} role="status" style={{ flexBasis: "100%" }}>
          {status.text}
        </p>
      ) : null}
    </form>
  );
}
