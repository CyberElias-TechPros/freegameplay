import { GameCore, type EngineApi, type HudState } from "./engine-core";

const CELL = 30;
const COLS = 32;
const ROWS = 20;

interface Point {
  x: number;
  y: number;
}

export class SnakeEngine extends GameCore implements EngineApi {
  snake: Point[] = [];
  dir: Point = { x: 1, y: 0 };
  queue: Point[] = [];
  food: Point = { x: 10, y: 10 };
  tickEvery = 0.115;
  tickAcc = 0;
  lastSwipe: Point | null = null;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudState) => void) {
    super(canvas, "fg-best-snake", onHud);
    this.loadBest();
    this.bindInput();
    this.resetGame();
    this.drawReady();
  }

  resetGame() {
    const cy = Math.floor(ROWS / 2);
    this.snake = [
      { x: 8, y: cy },
      { x: 7, y: cy },
      { x: 6, y: cy },
    ];
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.tickEvery = 0.115;
    this.tickAcc = 0;
    this.score = 0;
    this.lives = 3;
    this.placeFood();
    this.emit();
  }

  placeFood() {
    while (true) {
      const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      if (!this.snake.some((s) => s.x === p.x && s.y === p.y)) {
        this.food = p;
        return;
      }
    }
  }

  steer(d: Point) {
    const last = this.queue.length > 0 ? this.queue[this.queue.length - 1] : this.dir;
    if (d.x === -last.x && d.y === -last.y) return; // no 180°
    if (d.x === last.x && d.y === last.y) return;
    if (this.queue.length < 3) this.queue.push(d);
  }

  keyPress(key: string) {
    if (key === " " && this.phase === "ready") {
      this.start();
      return;
    }
    const k = this.keys;
    if (key === "arrowleft" || k["a"]) this.steer({ x: -1, y: 0 });
    if (key === "arrowright" || k["d"]) this.steer({ x: 1, y: 0 });
    if (key === "arrowup" || k["w"]) this.steer({ x: 0, y: -1 });
    if (key === "arrowdown" || k["s"]) this.steer({ x: 0, y: 1 });
  }

  pointerDownAt(x: number, y: number) {
    if (this.phase === "ready") this.start();
    this.lastSwipe = { x, y };
  }

  pointerMove(x: number, y: number) {
    if (!this.lastSwipe) return;
    const dx = x - this.lastSwipe.x;
    const dy = y - this.lastSwipe.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) this.steer({ x: dx > 0 ? 1 : -1, y: 0 });
    else this.steer({ x: 0, y: dy > 0 ? 1 : -1 });
    this.lastSwipe = { x, y };
  }

  step(dt: number) {
    this.tickAcc += dt;
    while (this.tickAcc >= this.tickEvery) {
      this.tickAcc -= this.tickEvery;
      this.tick();
      if (this.phase !== "playing") return;
    }
  }

  tick() {
    if (this.queue.length > 0) this.dir = this.queue.shift() as Point;
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;
    // walls
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      this.hit();
      return;
    }
    // self
    if (this.snake.some((s) => s.x === nx && s.y === ny)) {
      this.hit();
      return;
    }
    this.snake.unshift({ x: nx, y: ny });
    if (nx === this.food.x && ny === this.food.y) {
      this.score += 10;
      this.tickEvery = Math.max(0.055, this.tickEvery * 0.965);
      this.placeFood();
      this.emit();
    } else {
      this.snake.pop();
    }
  }

  hit() {
    this.lives--;
    this.emit();
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    // respawn in place, keep length
    const cy = Math.floor(ROWS / 2);
    const len = Math.max(3, Math.min(this.snake.length, 5));
    this.snake = Array.from({ length: len }, (_, i) => ({ x: 8 - i, y: cy }));
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.detail = "RESTART SECTOR";
  }

  draw() {
    this.clear();
    const g = this.ctx;
    // food (pulsing orb)
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 220);
    const fx = this.food.x * CELL + CELL / 2;
    const fy = this.food.y * CELL + CELL / 2;
    g.save();
    g.shadowColor = "#ff5470";
    g.shadowBlur = 18 * pulse;
    g.fillStyle = "#ff5470";
    g.beginPath();
    g.arc(fx, fy, 7 * pulse + 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // snake
    this.snake.forEach((s, i) => {
      const t = i / Math.max(this.snake.length - 1, 1);
      const x = s.x * CELL;
      const y = s.y * CELL;
      g.save();
      g.shadowColor = i === 0 ? "#c9f73a" : "rgba(201,247,58,0.4)";
      g.shadowBlur = i === 0 ? 14 : 6;
      g.fillStyle = i === 0 ? "#c9f73a" : `rgba(201,247,58,${0.85 - t * 0.55})`;
      const pad = i === 0 ? 2 : 3 + t * 3;
      g.beginPath();
      g.roundRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, i === 0 ? 8 : 5);
      g.fill();
      g.restore();
    });
    // HUD
    this.hudText(`SCORE ${String(this.score).padStart(4, "0")}`, 18, 14, "left", 13, "rgba(238,242,251,0.9)");
    this.hudText(`BEST ${String(this.best).padStart(4, "0")}`, this.W - 18, 14, "right");
    this.hudText(`LEN ${String(this.snake.length).padStart(2, "0")}`, this.W / 2, 14, "center", 13, "rgba(201,247,58,0.9)");
    let hearts = "";
    for (let i = 0; i < 3; i++) hearts += i < this.lives ? "● " : "○ ";
    this.hudText(hearts.trim(), this.W / 2, this.H - 24, "center", 12, "rgba(255,84,112,0.8)");
    if (this.detail) this.hudText(this.detail, this.W / 2, this.H / 2 - 10, "center", 20, "rgba(201,247,58,1)");
  }

  drawReady() {
    this.clear();
    this.hudText("NEON SNAKE", this.W / 2, this.H / 2 - 14, "center", 26, "rgba(238,242,251,0.9)");
    this.hudText("PRESS START", this.W / 2, this.H / 2 + 22, "center", 13, "rgba(201,247,58,0.9)");
  }
}
