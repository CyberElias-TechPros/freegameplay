// Split an HTML string at safe block-boundary positions, near requested
// fractional offsets (e.g. [0.4, 0.75] → three parts). Used to drop in-article
// ad units at paragraph boundaries — never mid-sentence or inside inline
// markup. Returns a single-part array when the content is too short or has no
// usable boundary (the caller then renders no inline ads).

const BOUNDARY_RE = /<\/(?:p|h[1-6]|ul|ol|blockquote|figure|div|table|pre|section)\s*>/gi;

/** Minimum characters of remaining content before we bother splitting. */
const MIN_PART = 500;

export function splitProse(html: string, ratios: number[]): string[] {
  if (!html || html.length < 1000) return [html];
  const parts: string[] = [];
  let rest = html;

  for (const r of ratios) {
    if (rest.length < MIN_PART * 2) break;
    const target = Math.floor(rest.length * r);
    let best = -1;
    let bestDist = Infinity;
    BOUNDARY_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BOUNDARY_RE.exec(rest)) !== null) {
      const end = m.index + m[0].length;
      if (end < rest.length * 0.06) continue; // never cut in the first 6%
      const dist = Math.abs(end - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = end;
      }
    }
    if (best === -1) break;
    parts.push(rest.slice(0, best));
    rest = rest.slice(best);
  }
  parts.push(rest);
  return parts;
}
