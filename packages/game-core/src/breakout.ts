import { GameCore, type EngineApi, type HudState } from "./engine-core";

const COLS = 10;
const ROWS = 5;
const BRICK_W = 84;
const BRICK_H = 20;
const GAP = 6;
const TOP = 64;
const LEFT = (960 - (COLS * (BRICK_W + GAP) - GAP)) / 2;

const ROW_COLORS = ["#ff5470", "#ff9b3d", "#c9f73a", "#7da2ff", "#38e1c8"];

interface Brick {
  x: number;
  y: number;
  alive: boolean;
  hp: number;
}

export class BreakoutEngine extends GameCore implements EngineApi {
  paddle = { x: 960 / 2, w: 112, h: 12, y: 0 };
  ball = { x: 960 / 2, y: 0, vx: 0, vy: 0, r: 7, stuck: true };
  bricks: Brick[] = [];
  level = 1;
  speed = 340;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    super(canvas, "fg-best-breakout", onHud);
    this.loadBest();
    this.bindInput();
    this.resetGame();
    this.drawReady();
  }

  resetGame() {
    this.level = 1;
    this.paddle.y = this.H - 44;
    this.buildLevel();
    this.lives = 3;
    this.score = 0;
    this.detail = "";
    this.emit();
  }

  buildLevel() {
    this.bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.bricks.push({
          x: LEFT + c * (BRICK_W + GAP),
          y: TOP + r * (BRICK_H + GAP),
          alive: true,
          hp: r < 1 ? 2 : 1,
        });
      }
    }
    this.speed = 340 + (this.level - 1) * 30;
    this.resetBall();
  }

  resetBall() {
    this.ball.stuck = true;
    this.ball.x = this.paddle.x;
    this.ball.y = this.paddle.y - 16;
    const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
    this.ball.vx = Math.cos(angle) * this.speed;
    this.ball.vy = Math.sin(angle) * this.speed;
  }

  keyPress(k: string) {
    if (this.phase === "ready" && k === " ") this.start();
    if (k === " " && this.phase === "playing" && this.ball.stuck) {
      this.ball.stuck = false;
      this.emit();
    }
  }

  pointerMove(x: number, y: number) {
    void y;
    this.paddle.x = Math.max(this.paddle.w / 2, Math.min(this.W - this.paddle.w / 2, x));
    if (this.ball.stuck) {
      this.ball.x = this.paddle.x;
    }
  }

  pointerDownAt() {
    if (this.phase === "ready") {
      this.start();
      this.ball.stuck = false;
    } else if (this.phase === "playing" && this.ball.stuck) {
      this.ball.stuck = false;
    }
  }

  step(dt: number) {
    const p = this.paddle;
    const k = this.keys;
    const move = 620 * dt;
    if (k["arrowleft"] || k["a"]) p.x -= move;
    if (k["arrowright"] || k["d"]) p.x += move;
    p.x = Math.max(p.w / 2, Math.min(this.W - p.w / 2, p.x));

    const b = this.ball;
    if (b.stuck) {
      b.x = p.x;
      b.y = p.y - 16;
      return;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // walls
    if (b.x < b.r) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > this.W - b.r) {
      b.x = this.W - b.r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < b.r) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
    }
    // bottom → lose life
    if (b.y > this.H + b.r) {
      this.lives--;
      this.emit();
      if (this.lives <= 0) {
        this.gameOver();
        return;
      }
      this.resetBall();
      return;
    }
    // paddle
    if (b.vy > 0 && b.y + b.r >= p.y - p.h / 2 && b.y + b.r <= p.y + p.h / 2 + 14 && Math.abs(b.x - p.x) <= p.w / 2 + b.r) {
      const rel = (b.x - p.x) / (p.w / 2); // -1..1
      const angle = -Math.PI / 2 + rel * (Math.PI / 3);
      const sp = Math.hypot(b.vx, b.vy) * 1.01;
      b.vx = Math.cos(angle) * sp;
      b.vy = Math.sin(angle) * sp;
      b.y = p.y - p.h / 2 - b.r;
    }
    // bricks
    for (const br of this.bricks) {
      if (!br.alive) continue;
      if (b.x + b.r < br.x || b.x - b.r > br.x + BRICK_W || b.y + b.r < br.y || b.y - b.r > br.y + BRICK_H) continue;
      // resolve on the shallow axis
      const ox = Math.min(b.x + b.r - br.x, br.x + BRICK_W - (b.x - b.r));
      const oy = Math.min(b.y + b.r - br.y, br.y + BRICK_H - (b.y - b.r));
      if (ox < oy) b.vx = -b.vx;
      else b.vy = -b.vy;
      br.hp--;
      if (br.hp <= 0) {
        br.alive = false;
        this.score += 10 * this.level;
        this.emit();
        if (this.bricks.every((x) => !x.alive)) {
          this.level++;
          this.score += 100;
          this.detail = `LEVEL ${this.level}`;
          this.buildLevel();
        }
      }
      break;
    }
  }

  draw() {
    this.clear();
    const g = this.ctx;
    // bricks
    for (const br of this.bricks) {
      if (!br.alive) continue;
      const color = ROW_COLORS[Math.floor((br.y - TOP) / (BRICK_H + GAP))];
      g.save();
      g.shadowColor = color;
      g.shadowBlur = br.hp > 1 ? 14 : 8;
      g.fillStyle = color;
      g.globalAlpha = br.hp > 1 ? 1 : 0.82;
      g.fillRect(br.x, br.y, BRICK_W, BRICK_H);
      g.restore();
    }
    // paddle
    this.neonStroke("#c9f73a", () => {
      g.beginPath();
      g.roundRect(this.paddle.x - this.paddle.w / 2, this.paddle.y - this.paddle.h / 2, this.paddle.w, this.paddle.h, 6);
      g.stroke();
      g.fillStyle = "rgba(201,247,58,0.16)";
      g.fill();
    }, 2, 10);
    // ball
    const grd = g.createRadialGradient(this.ball.x, this.ball.y, 1, this.ball.x, this.ball.y, this.ball.r + 6);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.4, "#c9f73a");
    grd.addColorStop(1, "rgba(201,247,58,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(this.ball.x, this.ball.y, this.ball.r + 6, 0, Math.PI * 2);
    g.fill();
    // HUD
    this.hudText(`SCORE ${String(this.score).padStart(4, "0")}`, 18, 14, "left", 13, "rgba(238,242,251,0.9)");
    this.hudText(`BEST ${String(this.best).padStart(4, "0")}`, this.W - 18, 14, "right");
    this.hudText("LV " + String(this.level).padStart(2, "0"), this.W / 2, 14, "center", 13, "rgba(201,247,58,0.9)");
    let hearts = "";
    for (let i = 0; i < 3; i++) hearts += i < this.lives ? "● " : "○ ";
    this.hudText(hearts.trim(), this.W / 2, this.H - 24, "center", 12, "rgba(255,84,112,0.8)");
    if (this.ball.stuck && this.phase === "playing") {
      this.hudText("SPACE / TAP TO LAUNCH", this.W / 2, this.H - 70, "center", 12, "rgba(201,247,58,0.9)");
    }
    if (this.detail) this.hudText(this.detail, this.W / 2, this.H / 2 - 10, "center", 22, "rgba(201,247,58,1)");
  }

  drawReady() {
    this.clear();
    this.hudText("VECTOR BREAKOUT", this.W / 2, this.H / 2 - 14, "center", 26, "rgba(238,242,251,0.9)");
    this.hudText("PRESS START", this.W / 2, this.H / 2 + 22, "center", 13, "rgba(201,247,58,0.9)");
  }
}
