"use client";

import { updateLibrary } from "@/lib/library";
import { useEffect, useRef, useState } from "react";
import { BreakoutEngine, DodgeEngine, SnakeEngine, GravityEngine, RunClock, type EngineApi, type HudState } from "@fg/game-core";
import { emitScore } from "../leaderboard";

export type BuiltinEngine = "breakout" | "dodge" | "snake" | "gravity";

const TITLES: Record<BuiltinEngine, string> = {
  breakout: "Vector Breakout",
  dodge: "Orbit Dodge",
  snake: "Neon Snake",
  gravity: "Gravity Well",
};

export function GameEngine({
  engine,
  gameSlug,
  onStart,
}: {
  engine: BuiltinEngine;
  gameSlug: string;
  onStart?: (state: HudState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<EngineApi | null>(null);
  const [hud, setHud] = useState<HudState>({ phase: "ready", score: 0, best: 0, lives: 0, detail: "" });
  const [error, setError] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let core: EngineApi;
    const clock = new RunClock();
    const onHud = (h: HudState) => {
      if (h.phase === "playing" && (clock.phase === "ready" || clock.phase === "over")) updateLibrary({ slug: gameSlug, title: TITLES[engine] }, "recent");
      clock.update(h.phase, performance.now());
      setHud(h);
      onStart?.(h);
      if (h.phase === "over" && h.score > 0 && !clock.reported) {
        clock.reported = true;
        emitScore({ gameSlug, score: h.score, elapsedMs: clock.elapsed(performance.now()), sessionId: clock.sessionId });
      }
    };
    try {
    switch (engine) {
      case "breakout":
        core = new BreakoutEngine(canvas, onHud);
        break;
      case "dodge":
        core = new DodgeEngine(canvas, onHud);
        break;
      case "snake":
        core = new SnakeEngine(canvas, onHud);
        break;
      case "gravity":
        core = new GravityEngine(canvas, onHud);
        break;
    }
    } catch { setError(true); return; }
    apiRef.current = core;
    // visibility: pause when the tab is hidden
    const onVis = () => {
      if (document.hidden) core.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      core.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, gameSlug]);

  const phase = hud.phase;

  return (
    <div className="player" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) apiRef.current?.pause(); }}>
      <div className="player-topbar">
        <span className="live">Live session</span>
        <span>{TITLES[engine]}</span>
        <button type="button" onClick={() => { if (phase === "playing") apiRef.current?.pause(); else if (phase === "paused") { apiRef.current?.resume(); canvasRef.current?.focus(); } }}>
          {phase === "playing" ? "PAUSE [P]" : phase === "paused" ? "RESUME [P]" : phase === "over" ? "PLAY AGAIN" : "READY"}
        </button>
      </div>
      <div className="player-stage">
        <canvas tabIndex={0} style={{ touchAction: "none" }} ref={canvasRef} aria-label={`${TITLES[engine]} — built-in game canvas`} role="img" />
        {error ? <p role="alert">This device could not start the game. Try another browser.</p> : phase !== "playing" ? (
          <div className="player-overlay">
            <div>
              <h3>
                {phase === "over" ? (hud.score > 0 && hud.score >= hud.best ? "New record" : "Game over") : phase === "paused" ? "Paused" : TITLES[engine]}
              </h3>
              <p>
                {phase === "over" ? (
                  <>
                    Score <b style={{ color: "var(--volt)" }}>{hud.score}</b> · Best {hud.best}
                  </>
                ) : phase === "paused" ? (
                  <>
                    Score {hud.score} — press P to continue
                  </>
                ) : (
                  "No downloads. No walls. Just press start."
                )}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const api = apiRef.current;
                  if (!api) return;
                  if (phase === "ready" || phase === "over") api.start();
                  else api.resume();
                  canvasRef.current?.focus();
                }}
              >
                {phase === "over" ? "Play again" : phase === "paused" ? "Resume" : "Start game"}
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="game-status" role="status">{phase} · Score {hud.score} · Best {hud.best}</p>
      <div className="game-touch-controls" aria-label="Game controls">
        {([['arrowleft', 'Left'], ['arrowup', 'Up'], ['arrowdown', 'Down'], ['arrowright', 'Right'], [' ', 'Launch']] as const).map(([key, label]) => (
          <button key={key} type="button" className="btn btn-ghost btn-sm" disabled={phase !== 'playing'}
            onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); apiRef.current?.input(key, true); }}
            onPointerUp={() => apiRef.current?.input(key, false)} onPointerCancel={() => apiRef.current?.input(key, false)}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); apiRef.current?.input(key, true); } }}
            onKeyUp={() => apiRef.current?.input(key, false)} onBlur={() => apiRef.current?.input(key, false)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
