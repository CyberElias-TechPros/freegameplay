import { GameCore, type EngineApi, type HudState } from "./engine-core";

const G = 260000; // gravitational constant (px^3/s^2 tuned)
const GOAL = 10;

interface Orb {
  angle: number;
  radius: number;
  speed: number;
  taken: boolean;
}

interface Trail {
  x: number;
  y: number;
  a: number;
}

export class GravityEngine extends GameCore implements EngineApi {
  sun = { x: 960 / 2, y: 300, r: 34 };
  player = { x: 960 / 2, y: 300 - 190, vx: 220, vy: 0, r: 9 };
  orbs: Orb[] = [];
  trail: Trail[] = [];
  collected = 0;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    super(canvas, "fg-best-gravity", onHud);
    this.loadBest();
    this.bindInput();
    this.resetGame();
    this.drawReady();
  }

  resetGame() {
    this.player = { x: this.W / 2, y: this.sun.y - 190, vx: 210, vy: 0, r: 9 };
    this.trail = [];
    this.collected = 0;
    this.score = 0;
    this.lives = 1;
    this.orbs = Array.from({ length: GOAL }, (_, i) => ({
      angle: (i / GOAL) * Math.PI * 2,
      radius: 120 + (i % 3) * 74,
      speed: (0.18 + (i % 4) * 0.09) * (i % 2 === 0 ? 1 : -1),
      taken: false,
    }));
    this.emit();
  }

  keyPress(k: string) {
    if (k === " " && this.phase === "ready") this.start();
  }

  step(dt: number) {
    const p = this.player;
    // thrust
    const k = this.keys;
    const accel = 420;
    let ax = 0;
    let ay = 0;
    if (k["arrowleft"] || k["a"]) ax -= 1;
    if (k["arrowright"] || k["d"]) ax += 1;
    if (k["arrowup"] || k["w"]) ay -= 1;
    if (k["arrowdown"] || k["s"]) ay += 1;
    const len = Math.hypot(ax, ay);
    if (len > 0) {
      p.vx += (ax / len) * accel * dt;
      p.vy += (ay / len) * accel * dt;
    }
    // gravity toward sun
    const dx = this.sun.x - p.x;
    const dy = this.sun.y - p.y;
    const d2 = Math.max(dx * dx + dy * dy, 400);
    const d = Math.sqrt(d2);
    const a = G / d2;
    p.vx += (dx / d) * a * dt;
    p.vy += (dy / d) * a * dt;
    // speed cap
    const v = Math.hypot(p.vx, p.vy);
    const vmax = 560;
    if (v > vmax) {
      p.vx = (p.vx / v) * vmax;
      p.vy = (p.vy / v) * vmax;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    this.trail.push({ x: p.x, y: p.y, a: 1 });
    if (this.trail.length > 40) this.trail.shift();
    for (const t of this.trail) t.a *= 0.92;

    // sun collision
    if (d < this.sun.r + p.r) {
      this.gameOver();
      return;
    }
    // escape
    if (p.x < -60 || p.x > this.W + 60 || p.y < -60 || p.y > this.H + 60) {
      this.gameOver();
      return;
    }
    // orbs
    for (const orb of this.orbs) {
      if (orb.taken) continue;
      orb.angle += orb.speed * dt;
      const ox = this.sun.x + Math.cos(orb.angle) * orb.radius;
      const oy = this.sun.y + Math.sin(orb.angle) * orb.radius;
      const odx = ox - p.x;
      const ody = oy - p.y;
      if (odx * odx + ody * ody < (14 + p.r) ** 2) {
        orb.taken = true;
        this.collected++;
        this.score += 100;
        this.detail = this.collected >= GOAL ? "ORBIT CLEARED" : "";
        this.emit();
        if (this.collected >= GOAL) {
          this.score += 500;
          this.saveBest();
          this.phase = "over";
          this.emit();
          return;
        }
      }
    }
  }

  draw() {
    this.clear();
    const g = this.ctx;
    // orbit guides
    g.strokeStyle = "rgba(125,162,255,0.1)";
    g.lineWidth = 1;
    for (const r of [120, 194, 268]) {
      g.beginPath();
      g.arc(this.sun.x, this.sun.y, r, 0, Math.PI * 2);
      g.stroke();
    }
    // sun
    const sg = g.createRadialGradient(this.sun.x, this.sun.y, 4, this.sun.x, this.sun.y, this.sun.r * 2.2);
    sg.addColorStop(0, "#fff6d8");
    sg.addColorStop(0.35, "#ffd76a");
    sg.addColorStop(0.6, "rgba(255,155,61,0.5)");
    sg.addColorStop(1, "rgba(255,155,61,0)");
    g.fillStyle = sg;
    g.beginPath();
    g.arc(this.sun.x, this.sun.y, this.sun.r * 2.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffdd88";
    g.beginPath();
    g.arc(this.sun.x, this.sun.y, this.sun.r * 0.8, 0, Math.PI * 2);
    g.fill();
    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      g.globalAlpha = t.a * 0.35;
      g.fillStyle = "#7da2ff";
      g.beginPath();
      g.arc(t.x, t.y, 2 + (i / this.trail.length) * 4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // orbs
    for (const orb of this.orbs) {
      if (orb.taken) continue;
      const ox = this.sun.x + Math.cos(orb.angle) * orb.radius;
      const oy = this.sun.y + Math.sin(orb.angle) * orb.radius;
      g.save();
      g.shadowColor = "#38e1c8";
      g.shadowBlur = 14;
      g.fillStyle = "#38e1c8";
      g.beginPath();
      g.arc(ox, oy, 7, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // player
    const p = this.player;
    const ang = Math.atan2(p.vy, p.vx);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(ang + Math.PI / 2);
    g.beginPath();
    g.moveTo(0, -p.r - 3);
    g.lineTo(p.r, p.r);
    g.lineTo(-p.r, p.r);
    g.closePath();
    g.strokeStyle = "#c9f73a";
    g.lineWidth = 2;
    g.shadowColor = "#c9f73a";
    g.shadowBlur = 16;
    g.stroke();
    g.fillStyle = "rgba(201,247,58,0.16)";
    g.fill();
    g.restore();
    // HUD
    this.hudText(`ORBS ${String(this.collected).padStart(2, "0")}/${GOAL}`, 18, 14, "left", 13, "rgba(56,225,200,0.95)");
    this.hudText(`SCORE ${String(this.score).padStart(4, "0")}`, 18, 34, "left", 13, "rgba(238,242,251,0.9)");
    this.hudText(`BEST ${String(this.best).padStart(4, "0")}`, this.W - 18, 14, "right");
    if (this.detail) this.hudText(this.detail, this.W / 2, this.H / 2 - 10, "center", 24, "rgba(56,225,200,1)");
  }

  drawReady() {
    this.clear();
    this.hudText("GRAVITY WELL", this.W / 2, this.H / 2 - 14, "center", 26, "rgba(238,242,251,0.9)");
    this.hudText("PRESS START", this.W / 2, this.H / 2 + 22, "center", 13, "rgba(201,247,58,0.9)");
  }
}
