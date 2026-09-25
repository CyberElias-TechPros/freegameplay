"use client";

import { useEffect, useRef, useState } from "react";
import { BreakoutEngine } from "./breakout";
import { DodgeEngine } from "./dodge";
import { SnakeEngine } from "./snake";
import { GravityEngine } from "./gravity";
import type { EngineApi, HudState } from "./engine-core";

export type BuiltinEngine = "breakout" | "dodge" | "snake" | "gravity";

const TITLES: Record<BuiltinEngine, string> = {
  breakout: "Vector Breakout",
  dodge: "Orbit Dodge",
  snake: "Neon Snake",
  gravity: "Gravity Well",
};

export function GameEngine({
  engine,
  onStart,
}: {
  engine: BuiltinEngine;
  onStart?: (state: HudState) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<EngineApi | null>(null);
  const [hud, setHud] = useState<HudState>({ phase: "ready", score: 0, best: 0, lives: 0, detail: "" });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let core: EngineApi;
    const onHud = (h: HudState) => {
      setHud(h);
      onStart?.(h);
    };
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
  }, [engine]);

  const phase = hud.phase;

  return (
    <div className="player">
      <div className="player-topbar">
        <span className="live">Live session</span>
        <span>{TITLES[engine]}</span>
        <span>
          {phase === "playing" ? "PAUSE [P]" : phase === "paused" ? "RESUME [P]" : phase === "over" ? "PLAY AGAIN" : "READY"}
        </span>
      </div>
      <div className="player-stage">
        <canvas ref={canvasRef} aria-label={`${TITLES[engine]} — built-in game canvas`} role="img" />
        {phase !== "playing" ? (
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
                }}
              >
                {phase === "over" ? "Play again" : phase === "paused" ? "Resume" : "Start game"}
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
