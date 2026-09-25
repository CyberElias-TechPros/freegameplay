import { GameCore, type EngineApi, type HudState } from "./engine-core";

interface Rock {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
  verts: number[];
}

interface Star {
  x: number;
  y: number;
  z: number;
}

export class DodgeEngine extends GameCore implements EngineApi {
  ship = { x: 960 / 2, y: 500, r: 13 };
  rocks: Rock[] = [];
  stars: Star[] = [];
  elapsed = 0;
  spawnEvery = 0.9;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    super(canvas, "fg-best-dodge", onHud);
    this.loadBest();
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      z: 0.3 + Math.random() * 0.7,
    }));
    this.bindInput();
    this.drawReady();
  }

  resetGame() {
    this.ship.x = this.W / 2;
    this.ship.y = this.H - 90;
    this.rocks = [];
    this.elapsed = 0;
    this.score = 0;
    this.spawnEvery = 0.9;
    this.emit();
  }

  keyPress(k: string) {
    if (k === " " && this.phase === "ready") this.start();
  }

  pointerMove(x: number, y: number) {
    this.ship.x = Math.max(this.ship.r, Math.min(this.W - this.ship.r, x));
    this.ship.y = Math.max(this.H * 0.4, Math.min(this.H - this.ship.r - 8, y));
  }

  pointerDownAt() {
    if (this.phase === "ready") this.start();
  }

  step(dt: number) {
    this.elapsed += dt;
    const k = this.keys;
    const sp = 460 * dt;
    if (k["arrowleft"] || k["a"]) this.ship.x -= sp;
    if (k["arrowright"] || k["d"]) this.ship.x += sp;
    if (k["arrowup"] || k["w"]) this.ship.y -= sp;
    if (k["arrowdown"] || k["s"]) this.ship.y += sp;
    this.ship.x = Math.max(this.ship.r, Math.min(this.W - this.ship.r, this.ship.x));
    this.ship.y = Math.max(this.H * 0.4, Math.min(this.H - this.ship.r - 8, this.ship.y));

    // score by survival
    this.score = Math.floor(this.elapsed * 10);
    if (this.score !== 0 && this.score % 50 === 0) this.emit();

    // stars
    for (const s of this.stars) {
      s.y += (30 + 140 * s.z) * dt;
      if (s.y > this.H) {
        s.y = -2;
        s.x = Math.random() * this.W;
      }
    }

    // spawn
    this.spawnEvery = Math.max(0.22, 0.9 - this.elapsed * 0.012);
    if (Math.random() < dt / this.spawnEvery) {
      const r = 9 + Math.random() * 19;
      const n = 7;
      const verts = Array.from({ length: n }, () => 0.72 + Math.random() * 0.5);
      this.rocks.push({
        x: r + Math.random() * (this.W - r * 2),
        y: -r * 2,
        r,
        vy: 120 + Math.random() * 140 + Math.min(this.elapsed * 6, 160),
        vx: (Math.random() - 0.5) * 60,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 1.6,
        verts,
      });
    }

    // move + collide
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const rock = this.rocks[i];
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.rot += rock.vr * dt;
      if (rock.y - rock.r > this.H) {
        this.rocks.splice(i, 1);
        continue;
      }
      const dx = rock.x - this.ship.x;
      const dy = rock.y - this.ship.y;
      if (dx * dx + dy * dy < (rock.r * 0.82 + this.ship.r) ** 2) {
        this.gameOver();
        return;
      }
    }
  }

  draw() {
    this.clear();
    const g = this.ctx;
    // stars
    g.fillStyle = "rgba(238,242,251,0.5)";
    for (const s of this.stars) {
      g.globalAlpha = 0.15 + s.z * 0.5;
      g.fillRect(s.x, s.y, s.z > 0.7 ? 2 : 1, 1 + s.z * 2);
    }
    g.globalAlpha = 1;
    // rocks
    for (const rock of this.rocks) {
      g.save();
      g.translate(rock.x, rock.y);
      g.rotate(rock.rot);
      g.beginPath();
      rock.verts.forEach((v, i) => {
        const a = (i / rock.verts.length) * Math.PI * 2;
        const px = Math.cos(a) * rock.r * v;
        const py = Math.sin(a) * rock.r * v;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.closePath();
      g.strokeStyle = "rgba(255,84,112,0.85)";
      g.lineWidth = 2;
      g.shadowColor = "rgba(255,84,112,0.7)";
      g.shadowBlur = 10;
      g.stroke();
      g.fillStyle = "rgba(255,84,112,0.08)";
      g.fill();
      g.restore();
    }
    // ship
    const s = this.ship;
    g.save();
    g.translate(s.x, s.y);
    g.beginPath();
    g.moveTo(0, -s.r - 4);
    g.lineTo(s.r, s.r);
    g.lineTo(0, s.r * 0.4);
    g.lineTo(-s.r, s.r);
    g.closePath();
    g.strokeStyle = "#c9f73a";
    g.lineWidth = 2;
    g.shadowColor = "#c9f73a";
    g.shadowBlur = 14;
    g.stroke();
    g.fillStyle = "rgba(201,247,58,0.14)";
    g.fill();
    g.restore();
    // HUD
    this.hudText(`SCORE ${String(this.score).padStart(5, "0")}`, 18, 14, "left", 13, "rgba(238,242,251,0.9)");
    this.hudText(`BEST ${String(this.best).padStart(5, "0")}`, this.W - 18, 14, "right");
    this.hudText(`T+${this.elapsed.toFixed(1)}s`, this.W / 2, 14, "center", 13, "rgba(201,247,58,0.9)");
  }

  drawReady() {
    this.clear();
    for (const s of this.stars) {
      this.ctx.globalAlpha = 0.2 + s.z * 0.4;
      this.ctx.fillRect(s.x, s.y, 1, 2);
    }
    this.ctx.globalAlpha = 1;
    this.hudText("ORBIT DODGE", this.W / 2, this.H / 2 - 14, "center", 26, "rgba(238,242,251,0.9)");
    this.hudText("PRESS START", this.W / 2, this.H / 2 + 22, "center", 13, "rgba(201,247,58,0.9)");
  }
}
