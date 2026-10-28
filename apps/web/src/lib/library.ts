export interface SavedGame { slug: string; title: string; }
const KEY = 'fg-library-v1';
export function readLibrary(): { saved: SavedGame[]; recent: SavedGame[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const valid = (v: unknown): SavedGame[] => Array.isArray(v) ? v.filter((g): g is SavedGame => !!g && typeof g.slug === 'string' && /^[a-z0-9-]+$/.test(g.slug) && typeof g.title === 'string').slice(0, 50) : [];
    return { saved: valid(raw.saved), recent: valid(raw.recent) };
  } catch { return { saved: [], recent: [] }; }
}
export function updateLibrary(game: SavedGame, action: 'save' | 'recent' | 'clear'): boolean {
  try {
    const value = readLibrary();
    if (action === 'clear') localStorage.removeItem(KEY);
    else {
      if (action === 'save') value.saved = value.saved.some(g=>g.slug===game.slug) ? value.saved.filter(g=>g.slug!==game.slug) : [game,...value.saved].slice(0,50);
      else value.recent = [game,...value.recent.filter(g=>g.slug!==game.slug)].slice(0,20);
      localStorage.setItem(KEY,JSON.stringify(value));
    }
    window.dispatchEvent(new Event('fg:library'));
    return true;
  } catch { return false; }
}
