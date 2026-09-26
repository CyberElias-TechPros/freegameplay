// Input validation shared by every public write endpoint.
// One place, so the rules can't drift between scores/comments/subscribe.

export const LIMITS = {
  name: { min: 2, max: 40 },
  score: { min: 0, max: 9_999_999 },
  commentBody: { min: 3, max: 2000 },
  email: { max: 254 },
  path: { max: 300 },
} as const;

export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 6 || v.length > LIMITS.email.max) return false;
  // Deliberately pragmatic: reject the obviously broken, accept the rest.
  return /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/.test(v);
}

/** Strip control characters and collapse whitespace. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);
}

/** A safe, URL-ish path. Always starts with "/", never "//" (open redirect). */
export function safePath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  let p = value.trim();
  if (!p.startsWith("/")) p = "/" + p;
  if (p.startsWith("//")) return fallback; // protocol-relative → reject
  if (p.length > LIMITS.path.max) return fallback;
  // Only allow the characters a real Next route can contain.
  if (!/^\/[A-Za-z0-9\-._~/%=?&]*$/.test(p)) return fallback;
  return p;
}

export function slugish(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return null;
  if (s.length < 1 || s.length > 120) return null;
  return s;
}

/** Guard against link-only / spam-shaped comments. */
export function looksLikeSpam(body: string): boolean {
  const links = (body.match(/https?:\/\//gi) ?? []).length;
  if (links >= 3) return true;
  if (links >= 1 && body.replace(/\s+/g, " ").length < 40) return true;
  const upper = body.replace(/[^A-Z]/g, "").length;
  if (body.length > 30 && upper / body.length > 0.7) return true;
  return false;
}

/**
 * Plausibility check for a self-reported score.
 *
 * This is a speed bump, not a security boundary: a determined client can lie
 * about elapsed time, so the real protections are the IP rate limit, the daily
 * per-visitor submission cap, session de-duplication and admin review. The
 * ceiling below is deliberately far above anything a human can produce in the
 * four engines (a fast Breakout clear is ~50 points/second) while still
 * rejecting the obvious `score: 999999, elapsedMs: 1000` flood.
 */
export const MAX_POINTS_PER_SECOND = 200;

export function scoreIsPlausible(score: number, elapsedMs: number | undefined): boolean {
  if (!Number.isFinite(score) || score < 0 || score > LIMITS.score.max) return false;
  if (elapsedMs === undefined || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return true;
  return score / (elapsedMs / 1000) <= MAX_POINTS_PER_SECOND;
}
