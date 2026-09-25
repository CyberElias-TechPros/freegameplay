"use client";

// Moderated comment thread for a post or guide.
//
// Flow (this is the whole business logic, end to end):
//   visitor writes → POST /api/comments → status "pending"
//   → invisible to everyone until an admin approves it in /admin
//   → approved comments (and replies to them) render here.
//
// Nothing about moderation is hidden from the visitor: the form states
// plainly that comments are reviewed first, so nobody is surprised when
// theirs doesn't appear instantly.

import { useCallback, useEffect, useState } from "react";
import { clientComments, clientSubmitComment, formatDate } from "@/lib/api";
import type { CommentNode, CommentsPayload } from "@fg/shared";

export function Comments({ targetType, targetSlug }: { targetType: "post" | "guide"; targetSlug: string }) {
  const [payload, setPayload] = useState<CommentsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setPayload(await clientComments(targetType, targetSlug));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [targetType, targetSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="comments" aria-label="Comments">
      <p className="section-index" style={{ marginBottom: 20 }}>
        Discussion · {payload?.total ?? 0}
      </p>

      {failed ? (
        <p className="admin-note">Comments are unavailable right now.</p>
      ) : payload && payload.comments.length === 0 ? (
        <p className="admin-note" style={{ marginBottom: 24 }}>
          No comments yet. Be the first — every comment is reviewed before it appears.
        </p>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {(payload?.comments ?? []).map((c) => (
            <Comment
              key={c.id}
              node={c}
              onReply={(id) => setReplyTo((cur) => (cur === id ? null : id))}
              replyOpen={replyTo === c.id}
            />
          ))}
        </div>
      )}

      <CommentForm
        targetType={targetType}
        targetSlug={targetSlug}
        parentId={replyTo}
        onDone={() => {
          setReplyTo(null);
          void load();
        }}
      />
    </section>
  );
}

function Comment({
  node,
  onReply,
  replyOpen,
  depth = 0,
}: {
  node: CommentNode;
  onReply: (id: number) => void;
  replyOpen: boolean;
  depth?: number;
}) {
  return (
    <article className="comment">
      <div className="comment-head">
        <b>{node.authorName}</b>
        <time dateTime={node.createdAt}>{formatDate(node.createdAt)}</time>
      </div>
      <p className="comment-body">{node.body}</p>
      {depth === 0 ? (
        <button type="button" className="comment-reply-btn" onClick={() => onReply(node.id)}>
          {replyOpen ? "Cancel reply" : "Reply"}
        </button>
      ) : null}
      {node.replies.length > 0 ? (
        <div className="comment-replies">
          {node.replies.map((r) => (
            <Comment key={r.id} node={r} onReply={onReply} replyOpen={false} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CommentForm({
  targetType,
  targetSlug,
  parentId,
  onDone,
}: {
  targetType: "post" | "guide";
  targetSlug: string;
  parentId: number | null;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(null);
  }, [parentId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await clientSubmitComment({
      targetType,
      targetSlug,
      parentId,
      authorName: name,
      authorEmail: email || undefined,
      body,
      website: honeypot,
    });
    setBusy(false);
    if (res.ok) {
      setStatus({ kind: "ok", text: res.message ?? "Thanks — your comment is awaiting moderation." });
      setBody("");
      onDone();
    } else {
      setStatus({ kind: "err", text: res.error ?? "Something went wrong. Please try again." });
    }
  };

  return (
    <form className="contact-form" onSubmit={submit}>
      <p className="section-index" style={{ marginBottom: 14 }}>
        {parentId ? "Write a reply" : "Leave a comment"}
      </p>
      <div className="field">
        <label htmlFor="cm-name">Name</label>
        <input id="cm-name" required value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="RetroRita" />
      </div>
      <div className="field">
        <label htmlFor="cm-email">Email (never shown)</label>
        <input id="cm-email" type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="cm-body">Comment</label>
        <textarea id="cm-body" required rows={5} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="What did you think?" />
      </div>
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="cm-website">Website</label>
        <input id="cm-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      {status ? (
        <p className={`form-status ${status.kind}`} role="status">
          {status.text}
        </p>
      ) : null}
      <div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Sending…" : parentId ? "Post reply" : "Post comment"}
          <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
