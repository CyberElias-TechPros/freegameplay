// Shared core for the built-in canvas game engines.
// Fixed-timestep loop, input, storage and rendering helpers.

export interface HudState {
  phase: "ready" | "playing" | "paused" | "over";
  score: number;
  best: number;
  lives: number;
  detail: string;
}

export interface EngineConfig {
  [key: string]: number | string | boolean | undefined;
}

export interface EngineApi {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  destroy(): void;
  input(key: string, pressed: boolean): void;
}

const STEP = 1 / 60;

export class GameCore {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  raf = 0;
  last = 0;
  acc = 0;
  phase: HudState["phase"] = "ready";
  score = 0;
  best = 0;
  lives = 3;
  detail = "";
  keys: Record<string, boolean> = {};
  storageKey: string;
  onHud: (h: HudState) => void;

  // pointer state (engines override handling)
  pointerX: number | null = null;
  pointerY: number | null = null;
  pointerDown = false;

  constructor(canvas: HTMLCanvasElement, storageKey: string, onHud: (h: HudState) => void) {
    this.canvas = canvas;
    this.storageKey = storageKey;
    this.onHud = onHud;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 960;
    this.H = 600;
    canvas.width = Math.round(this.W * dpr);
    canvas.height = Math.round(this.H * dpr);
    ctx.scale(dpr, dpr);
    // logical size is fixed; CSS scales the canvas
    void rect;
  }

  emit() {
    this.onHud({ phase: this.phase, score: this.score, best: this.best, lives: this.lives, detail: this.detail });
  }

  loadBest() {
    try {
      this.best = Number(localStorage.getItem(this.storageKey) ?? 0) || 0;
    } catch {
      this.best = 0;
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(this.storageKey, String(this.best));
      } catch {
        /* private mode */
      }
    }
  }

  bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", this.prevent);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
  }

  unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.prevent);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("blur", this.onBlur);
  }

  prevent = (e: Event) => e.preventDefault();

  input(key: string, pressed: boolean) {
    this.keys[key] = pressed;
    if (pressed) this.keyPress(key);
  }

  onBlur = () => { this.keys = {}; this.onPointerUp(); this.pause(); };

  onKeyDown = (e: KeyboardEvent) => {
    if (document.activeElement !== this.canvas || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "p"].includes(k)) e.preventDefault();
    if (e.repeat && (k === "p" || k === " ")) return;
    if (k === "p") {
      if (this.phase === "playing") this.pause();
      else if (this.phase === "paused") this.resume();
      return;
    }
    this.input(k, true);
  };

  onKeyUp = (e: KeyboardEvent) => { this.input(e.key.toLowerCase(), false); };

  onPointerMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointerX = ((e.clientX - r.left) / r.width) * this.W;
    this.pointerY = ((e.clientY - r.top) / r.height) * this.H;
    if (this.pointerX !== null && this.pointerY !== null) this.pointerMove(this.pointerX, this.pointerY);
  };

  onPointerDown = (e: PointerEvent) => {
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture?.(e.pointerId);
    this.onPointerMove(e);
    this.pointerDown = true;
    if (this.pointerX !== null && this.pointerY !== null) this.pointerDownAt(this.pointerX, this.pointerY);
  };

  onPointerUp = () => {
    this.pointerDown = false;
    this.pointerReleased();
  };

  pointerReleased() {}

  // engine hooks
  keyPress(_k: string) {}
  pointerMove(_x: number, _y: number) {}
  pointerDownAt(_x: number, _y: number) {}

  start() {
    if (this.phase === "playing") return;
    if (this.phase === "ready" || this.phase === "over") this.resetGame();
    this.keys = {};
    this.phase = "playing";
    this.last = performance.now();
    this.acc = 0;
    this.emit();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.keys = {};
    this.onPointerUp();
    cancelAnimationFrame(this.raf);
    this.emit();
    this.draw();
  }

  resume() {
    if (this.phase !== "paused") return;
    this.keys = {};
    this.phase = "playing";
    this.last = performance.now();
    this.acc = 0;
    this.emit();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  reset() {
    cancelAnimationFrame(this.raf);
    this.keys = {};
    this.phase = "ready";
    this.score = 0;
    this.lives = this.startLives;
    this.emit();
    this.drawReady();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.unbindInput();
  }

  gameOver() {
    this.phase = "over";
    cancelAnimationFrame(this.raf);
    this.saveBest();
    this.emit();
  }

  startLives = 3;

  loop = (t: number) => {
    const dt = Math.min((t - this.last) / 1000, 0.1);
    this.last = t;
    if (this.phase === "playing") {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.step(STEP);
        this.acc -= STEP;
        if (this.phase !== "playing") break;
      }
    }
    this.draw();
    if (this.phase === "playing") this.raf = requestAnimationFrame(this.loop);
  };

  step(_dt: number) {}
  draw() {}
  resetGame() {}
  drawReady() {}

  // ── drawing helpers ────────────────────────────────────────────────────────
  clear() {
    const g = this.ctx;
    g.fillStyle = "#04060b";
    g.fillRect(0, 0, this.W, this.H);
    this.drawGrid();
  }

  drawGrid() {
    const g = this.ctx;
    g.strokeStyle = "rgba(125,162,255,0.045)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= this.W; x += 48) {
      g.moveTo(x, 0);
      g.lineTo(x, this.H);
    }
    for (let y = 0; y <= this.H; y += 48) {
      g.moveTo(0, y);
      g.lineTo(this.W, y);
    }
    g.stroke();
  }

  hudText(text: string, x: number, y: number, align: CanvasTextAlign = "left", size = 13, color = "rgba(167,178,204,0.9)") {
    const g = this.ctx;
    g.font = `500 ${size}px "JetBrains Mono", monospace`;
    g.textAlign = align;
    g.textBaseline = "top";
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  neonStroke(color: string, draw: () => void, width = 2, glow = 12) {
    const g = this.ctx;
    g.save();
    g.strokeStyle = color;
    g.lineWidth = width;
    g.shadowColor = color;
    g.shadowBlur = glow;
    draw();
    g.restore();
  }
}
