"use client";

// Operator console.
//
// This is where every business process started by a visitor gets finished by a
// human:
//   • comments land as `pending` → approved / rejected here
//   • contact messages arrive → triaged here
//   • subscribers double opt-in → exported to an ESP here
//   • scores are submitted → reviewed / purged here
//   • migrations run → reported and rolled back here
//
// Auth: the operator pastes the ADMIN_TOKEN once per tab. It is held in
// sessionStorage and attached as a Bearer header to same-origin /api/admin/*
// calls. Nothing about the token is bundled or logged.

import { useCallback, useEffect, useState } from "react";
import {
  admin,
  getAdminToken,
  setAdminToken,
} from "@/lib/admin";
import type {
  AdminComment,
  AdminOverview,
  ContactMessage,
  MigrationReport,
  Subscriber,
} from "@fg/shared";

type Tab = "overview" | "inbox" | "comments" | "subscribers" | "scores" | "migration";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "inbox", label: "Inbox" },
  { id: "comments", label: "Comments" },
  { id: "subscribers", label: "Subscribers" },
  { id: "scores", label: "Scores" },
  { id: "migration", label: "Migration" },
];

export function AdminConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setToken(getAdminToken());
    setBooting(false);
  }, []);

  if (booting) return null;

  if (!token) return <Gate onUnlock={setToken} />;

  return (
    <>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <p className="section-index">operator</p>
          <h2 className="section-title" style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}>
            Admin console
          </h2>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            setAdminToken("");
            setToken(null);
          }}
        >
          Lock
        </button>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            className="admin-tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <Overview /> : null}
      {tab === "inbox" ? <Inbox /> : null}
      {tab === "comments" ? <Comments /> : null}
      {tab === "subscribers" ? <Subscribers /> : null}
      {tab === "scores" ? <Scores /> : null}
      {tab === "migration" ? <Migration /> : null}
    </>
  );
}

// ── Gate ─────────────────────────────────────────────────────────────────────

function Gate({ onUnlock }: { onUnlock: (t: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setAdminToken(value.trim());
    // A health call is the cheapest possible proof the token is right.
    const res = await admin.health();
    setBusy(false);
    if (res.ok) {
      onUnlock(value.trim());
    } else {
      setAdminToken("");
      setError(res.status === 401 ? "That token was rejected." : res.error ?? "Could not reach the API.");
    }
  };

  return (
    <div className="admin-gate">
      <p className="section-index" style={{ marginBottom: 10 }}>
        locked
      </p>
      <h2 style={{ fontSize: "1.6rem", marginBottom: 10 }}>Admin console</h2>
      <p style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65, marginBottom: 22 }}>
        Paste the <code style={{ fontFamily: "var(--font-mono)" }}>ADMIN_TOKEN</code> for this deployment. It is kept in this
        tab&apos;s session storage only and never written to a cookie.
      </p>
      <form className="contact-form" onSubmit={unlock}>
        <div className="field">
          <label htmlFor="admin-token">Admin token</label>
          <input
            id="admin-token"
            type="password"
            required
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="••••••••••••"
          />
        </div>
        {error ? (
          <p className="form-status err" role="status">
            {error}
          </p>
        ) : null}
        <div>
          <button className="btn btn-primary" type="submit" disabled={busy || value.trim().length === 0}>
            {busy ? "Checking…" : "Unlock"}
            <span aria-hidden>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="form-status err" role="status">
      {error}
    </p>
  );
}

function Pill({ status }: { status: string }) {
  const cls = status === "approved" || status === "confirmed" || status === "new" ? "ok" : status === "pending" ? "warn" : "bad";
  return <span className={`admin-pill ${cls}`}>{status}</span>;
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await admin.overview(30);
    setLoading(false);
    if (res.ok && res.data) setData(res.data);
    else setError(res.error ?? "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <p className="admin-note">Loading…</p>;
  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return null;

  const peak = Math.max(1, ...data.analytics.series.map((d) => d.views));

  return (
    <>
      <ErrorNote error={error} />

      <div className="admin-cards">
        <Card label="games" value={data.counts.games} />
        <Card label="posts" value={data.counts.posts} />
        <Card label="guides" value={data.counts.guides} />
        <Card label="redirects" value={data.counts.redirects} />
        <Card label="unread messages" value={data.counts.messages} />
        <Card label="comments pending" value={data.counts.comments.pending} />
        <Card label="subscribers" value={data.counts.subscribers.confirmed} />
        <Card label="scores" value={data.counts.scores} />
      </div>

      <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>Traffic · last {data.analytics.days} days</h3>
      <p className="admin-note" style={{ marginBottom: 4 }}>
        {data.analytics.totals.views.toLocaleString()} views · {data.analytics.totals.visitors.toLocaleString()} visitors ·{" "}
        {data.analytics.totals.pages.toLocaleString()} distinct pages · first-party only, no cookies
      </p>
      <div className="admin-bars" aria-hidden>
        {data.analytics.series.map((d) => (
          <div
            key={d.day}
            className="admin-bar"
            style={{ height: `${Math.round((d.views / peak) * 100)}%` }}
            data-label={`${d.day} — ${d.views} views / ${d.visitors} visitors`}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, marginTop: 28 }}>
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Top pages</h3>
          <table className="admin-table">
            <tbody>
              {data.analytics.topPages.slice(0, 10).map((p) => (
                <tr key={p.path}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{p.path}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Top referrers</h3>
          <table className="admin-table">
            <tbody>
              {data.analytics.topReferrers.slice(0, 10).map((r) => (
                <tr key={r.referrer}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{r.referrer}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => void load()}>
          Refresh
        </button>
        <span className="admin-note">
          backend: {Object.entries(data.health.checks).filter(([, v]) => v).length}/3 services healthy
        </span>
      </div>
    </>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-card">
      <b>{value.toLocaleString()}</b>
      <span>{label}</span>
    </div>
  );
}

// ── Inbox ────────────────────────────────────────────────────────────────────

function Inbox() {
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await admin.messages();
    if (res.ok && res.data) setItems(res.data.items);
    else setError(res.error ?? "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: number, status: string) => {
    await admin.setMessageStatus(id, status);
    await load();
  };

  return (
    <>
      <ErrorNote error={error} />
      <table className="admin-table">
        <thead>
          <tr>
            <th>From</th>
            <th>Subject</th>
            <th>Message</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>
                <b style={{ color: "var(--ink)" }}>{m.name}</b>
                <br />
                <a href={`mailto:${m.email}`} style={{ fontSize: 12 }}>
                  {m.email}
                </a>
                <br />
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{m.createdAt.slice(0, 16).replace("T", " ")}</span>
              </td>
              <td>{m.subject ?? "—"}</td>
              <td style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>{m.body}</td>
              <td>
                <Pill status={m.status} />
              </td>
              <td>
                <div className="admin-actions">
                  {m.status !== "read" ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void setStatus(m.id, "read")}>
                      Mark read
                    </button>
                  ) : null}
                  {m.status !== "archived" ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void setStatus(m.id, "archived")}>
                      Archive
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-note">
                Inbox is empty.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

// ── Comments ─────────────────────────────────────────────────────────────────

function Comments() {
  const [items, setItems] = useState<AdminComment[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status?: string) => {
    const res = await admin.comments(status);
    if (res.ok && res.data) setItems(res.data.items);
    else setError(res.error ?? "failed");
  }, []);

  useEffect(() => {
    void load(filter || undefined);
  }, [filter, load]);

  const act = async (fn: () => Promise<{ ok: boolean }>) => {
    await fn();
    await load(filter || undefined);
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {["pending", "approved", "rejected", ""].map((s) => (
          <button
            key={s || "all"}
            type="button"
            className="admin-tab"
            aria-selected={filter === s}
            onClick={() => setFilter(s)}
          >
            {s || "all"}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
      <table className="admin-table">
        <thead>
          <tr>
            <th>Author</th>
            <th>On</th>
            <th>Comment</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <b style={{ color: "var(--ink)" }}>{c.authorName}</b>
                {c.authorEmail ? (
                  <>
                    <br />
                    <a href={`mailto:${c.authorEmail}`} style={{ fontSize: 12 }}>
                      {c.authorEmail}
                    </a>
                  </>
                ) : null}
                <br />
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.createdAt.slice(0, 16).replace("T", " ")}</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {c.targetType}/{c.targetSlug}
                {c.parentId ? ` ↳ #${c.parentId}` : ""}
              </td>
              <td style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>{c.body}</td>
              <td>
                <Pill status={c.status} />
              </td>
              <td>
                <div className="admin-actions">
                  {c.status !== "approved" ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void act(() => admin.setCommentStatus(c.id, "approved"))}>
                      Approve
                    </button>
                  ) : null}
                  {c.status !== "rejected" ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void act(() => admin.setCommentStatus(c.id, "rejected"))}>
                      Reject
                    </button>
                  ) : null}
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => void act(() => admin.deleteComment(c.id))}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-note">
                Nothing here.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

// ── Subscribers ──────────────────────────────────────────────────────────────

function Subscribers() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status?: string) => {
    const res = await admin.subscribers(status);
    if (res.ok && res.data) setItems(res.data.items);
    else setError(res.error ?? "failed");
  }, []);

  useEffect(() => {
    void load(filter || undefined);
  }, [filter, load]);

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {["", "confirmed", "pending", "unsubscribed"].map((s) => (
          <button key={s || "all"} type="button" className="admin-tab" aria-selected={filter === s} onClick={() => setFilter(s)}>
            {s || "all"}
          </button>
        ))}
        <a className="btn btn-ghost btn-sm" href={admin.subscribersExportUrl()} style={{ marginLeft: "auto" }}>
          Export confirmed CSV
        </a>
      </div>
      <ErrorNote error={error} />
      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Source</th>
            <th>Status</th>
            <th>Confirmed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.email}</td>
              <td>{s.source ?? "—"}</td>
              <td>
                <Pill status={s.status} />
              </td>
              <td style={{ fontSize: 12 }}>{s.confirmedAt ? s.confirmedAt.slice(0, 16).replace("T", " ") : "—"}</td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    await admin.deleteSubscriber(s.id);
                    await load(filter || undefined);
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-note">
                No subscribers yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

// ── Scores ───────────────────────────────────────────────────────────────────

function Scores() {
  const [items, setItems] = useState<(import("@fg/shared").ScoreEntry & { clientHash: string; elapsedMs: number | null })[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await admin.scores();
    if (res.ok && res.data) setItems(res.data.items);
    else setError(res.error ?? "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <ErrorNote error={error} />
      <p className="admin-note" style={{ marginBottom: 14 }}>
        Submissions are sanity-checked against reported play time server-side. Use this list to spot patterns the heuristic
        can&apos;t see (identical client hashes, impossible run lengths) and delete individual rows.
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Game</th>
            <th>Score</th>
            <th>Elapsed</th>
            <th>Client</th>
            <th>When</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td style={{ color: "var(--ink)" }}>{s.playerName}</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.gameSlug}</td>
              <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--volt)" }}>{s.score.toLocaleString()}</td>
              <td style={{ fontSize: 12 }}>{s.elapsedMs ? `${(s.elapsedMs / 1000).toFixed(1)}s` : "—"}</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>{s.clientHash}</td>
              <td style={{ fontSize: 12 }}>{s.createdAt.slice(0, 16).replace("T", " ")}</td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={async () => {
                    await admin.deleteScore(s.id);
                    await load();
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="admin-note">
                No scores submitted yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

// ── Migration ────────────────────────────────────────────────────────────────

function Migration() {
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await admin.report();
    if (res.ok && res.data) setReport(res.data);
    else setError(res.error ?? "failed");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runImport = async (dryRun: boolean) => {
    if (!url.trim()) return;
    setBusy(true);
    setResult(null);
    const res = await admin.importFeed(url.trim(), dryRun, false);
    setBusy(false);
    if (res.ok && res.data) {
      const s = res.data.stats;
      setResult(
        `${dryRun ? "Dry-run" : "Import"} finished — posts ${s.posts.created}+/${s.posts.updated}~, guides ${s.guides.created}+/${s.guides.updated}~, pages ${s.pages.created}+, redirects ${s.redirects.created}+, media unresolved ${s.media.unresolved}.` +
          (res.data.warnings?.length ? ` Warnings: ${res.data.warnings.join(" | ")}` : ""),
      );
      await load();
    } else {
      setResult(res.error ?? "Import failed.");
    }
  };

  return (
    <>
      <ErrorNote error={error} />

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <span style={{ marginBottom: 12 }}>Import from a feed URL</span>
        <p className="admin-note" style={{ marginBottom: 14 }}>
          Pulls a Blogger / Blogspot / RSS / Atom feed server-side and runs it through the same idempotent pipeline as the
          CLI. Always dry-run first.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500"
            style={{
              flex: "1 1 320px",
              background: "var(--bg-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: 6,
              padding: "11px 14px",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
            }}
          />
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy || !url.trim()} onClick={() => void runImport(true)}>
            {busy ? "Working…" : "Dry run"}
          </button>
          <button className="btn btn-primary btn-sm" type="button" disabled={busy || !url.trim()} onClick={() => void runImport(false)}>
            Import
          </button>
        </div>
        {result ? (
          <p className="admin-note" style={{ marginTop: 14, color: "var(--ink-2)" }} role="status">
            {result}
          </p>
        ) : null}
      </div>

      {report ? (
        <>
          <h3 style={{ fontSize: "1rem", margin: "24px 0 10px" }}>Recent runs</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Source</th>
                <th>Status</th>
                <th>Started</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {report.runs.map((r) => (
                <tr key={r.jobId}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.jobId}</td>
                  <td>
                    {r.sourceType}
                    <br />
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.sourceLabel ?? "—"}</span>
                  </td>
                  <td>
                    <Pill status={r.status === "done" ? "approved" : r.status === "failed" ? "rejected" : "pending"} />
                  </td>
                  <td style={{ fontSize: 12 }}>{r.startedAt.slice(0, 16).replace("T", " ")}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.stats
                      ? `g${r.stats.games.created} p${r.stats.posts.created} gu${r.stats.guides.created} pg${r.stats.pages.created} r${r.stats.redirects.created}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginTop: 28 }}>
            <div>
              <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Unresolved media ({report.unresolvedMedia.length})</h3>
              <p className="admin-note" style={{ marginBottom: 10 }}>
                Images referenced by imported content that have not been transferred to R2. Review rights, then re-import with
                <code> --download-media</code>.
              </p>
              <table className="admin-table">
                <tbody>
                  {report.unresolvedMedia.slice(0, 12).map((m) => (
                    <tr key={m.url}>
                      <td style={{ fontSize: 11, wordBreak: "break-all" }}>{m.url}</td>
                    </tr>
                  ))}
                  {report.unresolvedMedia.length === 0 ? (
                    <tr>
                      <td className="admin-note">None — every image is hosted locally.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Unverified redirects ({report.unverifiedRedirects.length})</h3>
              <p className="admin-note" style={{ marginBottom: 10 }}>
                Legacy URLs registered but not yet confirmed to resolve. Mark them verified once you have spot-checked them in
                production.
              </p>
              <table className="admin-table">
                <tbody>
                  {report.unverifiedRedirects.slice(0, 12).map((r) => (
                    <tr key={r.fromUrl}>
                      <td style={{ fontSize: 11, wordBreak: "break-all" }}>
                        {r.fromUrl} → {r.toUrl}
                      </td>
                    </tr>
                  ))}
                  {report.unverifiedRedirects.length === 0 ? (
                    <tr>
                      <td className="admin-note">All redirects verified.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
