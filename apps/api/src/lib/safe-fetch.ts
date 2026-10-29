/** Operator-approved HTTPS origins only. This is intentionally NOT arbitrary URL
 * fetching: a hostname allowlist cannot prove DNS ownership or defeat rebinding.
 * Operators must approve hosts they trust; local XML upload remains available.
 */
export function approvedUrl(raw: string, allowedHosts: string[]): URL {
  const u = new URL(raw);
  const allowed = allowedHosts.map(h => h.trim().toLowerCase()).filter(Boolean);
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") ||
      !allowed.includes(u.hostname.toLowerCase()) ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname) ||
      /^[\d.]+$/.test(u.hostname) || /(?:^|\.)(?:localhost|local|internal)$/.test(u.hostname)) {
    throw new Error("URL must use HTTPS on an operator-approved public host");
  }
  return u;
}

export async function fetchApproved(raw: string, allowedHosts: string[], maxBytes = 8 * 1024 * 1024, fetcher: typeof fetch = fetch): Promise<{ bytes: Uint8Array; contentType: string }> {
  const signal = AbortSignal.timeout(15000);
  let u = approvedUrl(raw, allowedHosts);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await fetcher(u.href, { redirect: "manual", signal });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      await res.body?.cancel();
      const location = res.headers.get("location");
      if (!location) throw new Error("Missing redirect location");
      u = approvedUrl(new URL(location, u).href, allowedHosts);
      continue;
    }
    if (!res.ok) { await res.body?.cancel(); throw new Error(`Feed fetch failed: HTTP ${res.status}`); }
    if (Number(res.headers.get("content-length")) > maxBytes) { await res.body?.cancel(); throw new Error("Response too large"); }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Empty response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new Error("Response too large");
        chunks.push(value);
      }
    } catch (e) { await reader.cancel(); throw e; }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { bytes, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }
  throw new Error("Too many redirects");
}
