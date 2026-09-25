"use client";

// Leaderboard panel for the built-in games.
//
// Reads the board on mount, and accepts a `onScore` callback so the game
// engine can push a finished run here. Submission is fire-and-forget from the
// engine's perspective: a failed POST must never interrupt play.
//
// The panel is deliberately quiet until there is something to show — a game
// with no scores yet gets an invitation, not an empty table.

import { useCallback, useEffect, useRef, useState } from "react";
import { clientLeaderboard, clientSubmitScore, formatScore } from "@/lib/api";
import type { LeaderboardPayload, ScoreEntry } from "@fg/shared";

const NAME_KEY = "fg-player-name";

function readName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeName(value: string): void {
  try {
    localStorage.setItem(NAME_KEY, value);
  } catch {
    /* private mode — the name just won't persist */
  }
}

export interface ScoreSubmission {
  score: number;
  elapsedMs: number;
  sessionId: string;
}

export function Leaderboard({ gameSlug }: { gameSlug: string }) {
  const [board, setBoard] = useState<LeaderboardPayload | null>(null);
  const [name, setName] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const submitted = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      setBoard(await clientLeaderboard(gameSlug));
    } catch {
      /* the game stays playable whether or not the board loads */
    }
  }, [gameSlug]);

  useEffect(() => {
    setName(readName());
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (run: ScoreSubmission) => {
      const key = `${run.sessionId}:${run.score}`;
      if (submitted.current.has(key)) return;
      submitted.current.add(key);

      const playerName = readName() || "ANON";
      setBusy(true);
      try {
        const res = await clientSubmitScore(gameSlug, {
          playerName,
          score: run.score,
          elapsedMs: run.elapsedMs,
          sessionId: run.sessionId,
        });
        if (res.accepted) {
          setStatus(res.rank ? `Ranked #${res.rank} on the board.` : "Score recorded.");
          await refresh();
        } else if (res.message) {
          setStatus(res.message);
        }
      } catch {
        setStatus("Couldn't reach the leaderboard — your best is still saved locally.");
      } finally {
        setBusy(false);
      }
    },
    [gameSlug, refresh],
  );

  // The engine reports finished runs through a DOM event, which keeps the
  // canvas component free of any knowledge of this panel.
  useEffect(() => {
    const onScore = (e: Event) => {
      const detail = (e as CustomEvent<ScoreSubmission>).detail;
      if (detail && Number.isFinite(detail.score)) void submit(detail);
    };
    window.addEventListener("fg:score", onScore);
    return () => window.removeEventListener("fg:score", onScore);
  }, [submit]);

  const entries: ScoreEntry[] = board?.entries ?? [];
  const hasBoard = (board?.total ?? 0) > 0;

  return (
    <div className="hud-panel">
      <h4>Leaderboard</h4>

      <div className="field" style={{ marginBottom: 16 }}>
        <label htmlFor="fg-player">Your name</label>
        <input
          id="fg-player"
          value={name}
          maxLength={40}
          placeholder="ANON"
          onChange={(e) => {
            setName(e.target.value);
            writeName(e.target.value.trim().slice(0, 40));
          }}
        />
      </div>

      {!board ? (
        <p style={{ color: "var(--ink-3)", fontSize: 13 }}>Loading the board…</p>
      ) : !hasBoard ? (
        <p style={{ color: "var(--ink-3)", fontSize: 13, lineHeight: 1.6 }}>
          No scores yet. Finish a run and you&apos;ll be the first name on the board.
        </p>
      ) : (
        <ol className="board" aria-label="Top scores">
          {entries.map((e, i) => (
            <li key={`${e.playerName}-${e.id}`} className={e.mine ? "mine" : undefined}>
              <span className="board-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="board-name">{e.playerName}</span>
              <span className="board-score">{formatScore(e.score)}</span>
            </li>
          ))}
        </ol>
      )}

      {board?.myBest ? (
        <p style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--volt)" }}>
          Your best {formatScore(board.myBest)}
          {board.myRank ? ` · rank #${board.myRank}` : ""}
        </p>
      ) : null}

      {status ? (
        <p className="form-status" role="status" style={{ marginTop: 10, fontSize: 12 }}>
          {status}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => void refresh()} disabled={busy}>
          {busy ? "Sending…" : "Refresh"}
        </button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".18em", color: "var(--ink-3)", textTransform: "uppercase" }}>
          {board?.total ?? 0} players
        </span>
      </div>
    </div>
  );
}

/** Helper for the engine: emit a finished run the Leaderboard listens for. */
export function emitScore(run: ScoreSubmission): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ScoreSubmission>("fg:score", { detail: run }));
}
