"use client";

import { useState } from "react";
import { clientContact } from "@/lib/api";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await clientContact({ name, email, subject: subject || undefined, body });
    setBusy(false);
    if (res.ok) {
      setStatus({ kind: "ok", text: res.message ?? "Message received — we'll get back to you." });
      setName("");
      setEmail("");
      setSubject("");
      setBody("");
    } else {
      setStatus({ kind: "err", text: res.error ?? "Something went wrong. Please try again." });
    }
  };

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="cf-name">Name</label>
        <input id="cf-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="RetroRita" maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="cf-email">Email</label>
        <input id="cf-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={320} />
      </div>
      <div className="field">
        <label htmlFor="cf-subject">Subject</label>
        <input id="cf-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Game request, bug, idea…" maxLength={300} />
      </div>
      <div className="field">
        <label htmlFor="cf-body">Message</label>
        <textarea id="cf-body" required rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What's on your mind?" maxLength={6000} />
      </div>
      {status ? (
        <p className={`form-status ${status.kind}`} role="status">
          {status.text}
        </p>
      ) : null}
      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send message"}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
