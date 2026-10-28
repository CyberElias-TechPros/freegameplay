import type { HudState } from './engine-core';
/** Active monotonic run duration; paused time and prior replays are excluded. */
export class RunClock {
  phase: HudState['phase'] = 'ready';
  total = 0;
  since = 0;
  reported = false;
  sessionId = '';
  update(next: HudState['phase'], now: number) {
    if (next === 'playing' && (this.phase === 'ready' || this.phase === 'over')) {
      this.total = 0; this.reported = false; this.sessionId = crypto.randomUUID();
    }
    if (this.phase === 'playing' && next !== 'playing') this.total += Math.max(0, now - this.since);
    if (next === 'playing' && this.phase !== 'playing') this.since = now;
    this.phase = next;
  }
  elapsed(now: number) { return Math.round(this.total + (this.phase === 'playing' ? Math.max(0, now - this.since) : 0)); }
}
