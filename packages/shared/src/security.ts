/** Safe inside an HTML script element, including hostile strings in structured data. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Only these public asset namespaces/types may be served through /media. */
export function isPublicMediaKey(key: string): boolean {
  if (!/^[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp|avif|gif|mp4|webm|pdf)$/.test(key)) return false;
  if (key.startsWith("covers/") || key.startsWith("posts/") || key.startsWith("imported/")) return true;
  return ["hero-wide.jpg", "og-cover.jpg"].includes(key);
}

export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("https://")) {
    try { const u = new URL(value); return u.username || u.password ? null : u.href; } catch { return null; }
  }
  const key = value.replace(/^\/?media\//, "").replace(/^\//, "");
  return isPublicMediaKey(key) ? `/media/${key}` : null;
}

export function csvCell(value: string | null): string {
  let text = value ?? "";
  if (/^[\s]*[=+@\-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
