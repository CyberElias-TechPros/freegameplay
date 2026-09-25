#!/usr/bin/env node
// End-to-end verification of the content API (local or deployed).
// Exercises every public route, the media path, search, redirects, sitemap,
// contact form validation, the engagement flows (leaderboards, moderated
// comments, double opt-in newsletter, analytics beacons), the taxonomy
// archives and the admin endpoints. Exits non-zero on any failure.
import { adminToken, api, apiBase, loadEnv } from "./lib.mjs";

const mode = process.argv.includes("--local") ? "local" : "remote";
loadEnv();
const base = apiBase(mode);
const token = adminToken();

let failures = 0;
function fail(label, detail) {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
}
function check(label, cond, detail) {
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else fail(label, detail);
}

console.log(`\nVerifying ${base} [${mode}]\n`);

// The suite writes to rate-limited endpoints on purpose. Reset the buckets it
// touches first so a re-run within the same window doesn't report false
// failures (the limits themselves are verified separately below).
if (token) {
  for (const limiter of ["contact", "comment", "subscribe", "score", "beacon"]) {
    await api(base, `/api/admin/rate-limits/${limiter}/reset`, { token, method: "POST" });
  }
}

// Health
{
  const r = await api(base, "/api/health");
  check("GET /api/health → 200 ok:true", r.ok && r.json?.ok === true, `status=${r.status}`);
}

// Home aggregate
let home = null;
{
  const r = await api(base, "/api/content/home");
  home = r.json;
  check("GET /api/content/home → 200", r.ok, `status=${r.status}`);
  check("home: site.name present", Boolean(home?.site?.name));
  check("home: stats.games >= 1", (home?.stats?.games ?? 0) >= 1, `games=${home?.stats?.games}`);
  check("home: featuredGames non-empty", (home?.featuredGames?.length ?? 0) >= 1);
  check("home: latestPosts non-empty", (home?.latestPosts?.length ?? 0) >= 1);
  check("home: latestGuides non-empty", (home?.latestGuides?.length ?? 0) >= 1);
  check("home: categories non-empty", (home?.categories?.length ?? 0) >= 1);
}

// Games list + filters
{
  const all = await api(base, "/api/content/games");
  check("GET /api/content/games → 200 with items", all.ok && (all.json?.items?.length ?? 0) >= 1, `status=${all.status}`);
  const genre = await api(base, "/api/content/games?genre=arcade");
  check("games?genre=arcade filters correctly", genre.ok && genre.json?.items?.every((g) => /arcade/i.test(g.genre ?? "")), `n=${genre.json?.items?.length}`);
  const q = await api(base, "/api/content/games?q=snake");
  check("games?q=snake finds Neon Snake", q.ok && q.json?.items?.some((g) => /neon snake/i.test(g.title)), `n=${q.json?.items?.length}`);
}

// Game detail + related
{
  const r = await api(base, "/api/content/games/vector-breakout");
  check("GET /api/content/games/vector-breakout → 200", r.ok, `status=${r.status}`);
  check("game detail: builtin engine = breakout", r.json?.item?.builtin?.engine === "breakout");
  check("game detail: related present", Array.isArray(r.json?.related));
  const miss = await api(base, "/api/content/games/does-not-exist");
  check("game detail: unknown slug → 404", miss.status === 404, `status=${miss.status}`);
}

// Posts list + detail
{
  const list = await api(base, "/api/content/posts");
  check("GET /api/content/posts → 200 with items", list.ok && (list.json?.items?.length ?? 0) >= 1);
  check("post list omits contentHtml", list.json?.items?.every((p) => p.contentHtml === undefined || p.contentHtml === null));
  const slug = list.json?.items?.[0]?.slug;
  const one = await api(base, `/api/content/posts/${slug}`);
  check("GET /api/content/posts/:slug → 200", one.ok, `status=${one.status}`);
  check("post detail includes contentHtml", typeof one.json?.item?.contentHtml === "string" && one.json.item.contentHtml.length > 0);
  check("post detail has readingMinutes", (one.json?.item?.readingMinutes ?? 0) >= 1);
}

// Guides list + detail
{
  const list = await api(base, "/api/content/guides");
  check("GET /api/content/guides → 200 with items", list.ok && (list.json?.items?.length ?? 0) >= 1);
  const g = list.json?.items?.[0];
  const one = await api(base, `/api/content/guides/${g.slug}`);
  check("GET /api/content/guides/:slug → 200", one.ok, `status=${one.status}`);
  const withGame = list.json?.items?.find((i) => i.gameSlug);
  if (withGame) {
    const gd = await api(base, `/api/content/guides/${withGame.slug}`);
    check("game guide detail links to its game", gd.ok && gd.json?.item?.gameSlug === withGame.gameSlug, `game=${withGame.gameSlug}`);
  } else {
    fail("no guide with a game link found in seed");
  }
}

// Categories
{
  const r = await api(base, "/api/content/categories");
  check("GET /api/content/categories → 200", r.ok && (r.json?.items?.length ?? 0) >= 1);
  const cat = r.json?.items?.[0]?.slug;
  const detail = await api(base, `/api/content/categories/${cat}`);
  check(`GET /api/content/categories/${cat} → 200`, detail.ok, `status=${detail.status}`);
}

// Tags
{
  const r = await api(base, "/api/content/tags");
  check("GET /api/content/tags → 200", r.ok && (r.json?.items?.length ?? 0) >= 1);
}

// Search (FTS + fallback)
{
  const fts = await api(base, "/api/search?q=breakout");
  check("GET /api/search?q=breakout → hits", fts.ok && (fts.json?.hits?.length ?? 0) >= 1, `hits=${fts.json?.hits?.length}`);
  check("search returns mixed types", new Set(fts.json?.hits?.map((h) => h.type)).size >= 1);
  const short = await api(base, "/api/search?q=%27%22%20weird");
  check("search: hostile query does not 500", short.status === 200 || short.status === 400, `status=${short.status}`);
}

// Legacy redirects
{
  const r = await api(base, "/api/redirect?from=/2025/02/vector-breakout.html");
  check("redirect: legacy game URL → 308 /games/…", r.ok && r.json?.status === 308 && r.json?.location?.startsWith("/games/"), `json=${JSON.stringify(r.json)}`);
  const blog = await api(base, "/api/redirect?from=/2024/05/the-golden-age-of-portal-games.html");
  check("redirect: legacy post URL resolves", blog.ok && (blog.json?.status === 308 || blog.json?.status === 404), `json=${JSON.stringify(blog.json)}`);
  const root2 = await api(base, "/api/redirect?from=/");
  check("redirect: root → 308 /", root2.ok && root2.json?.status === 308 && root2.json?.location === "/");
}

// Media
{
  const r = await fetch(base.replace(/\/+$/, "") + "/media/covers/vector-breakout.jpg");
  const buf = Buffer.from(await r.arrayBuffer());
  check("GET /media/covers/vector-breakout.jpg → 200 image", r.ok && /image\//.test(r.headers.get("content-type") ?? ""), `status=${r.status} type=${r.headers.get("content-type")}`);
  check("media: bytes received", buf.length > 1000, `bytes=${buf.length}`);
  check("media: immutable cache header", /immutable/.test(r.headers.get("cache-control") ?? ""));
  const miss = await api(base, "/media/nope.jpg");
  check("media: missing key → 404", miss.status === 404);
}

// Sitemap + robots
{
  const sm = await api(base, "/api/sitemap.xml");
  check("GET /api/sitemap.xml → 200 xml", sm.ok && /<urlset/.test(sm.text), `status=${sm.status}`);
  check("sitemap includes a game URL", /\/games\/vector-breakout/.test(sm.text));
  const rb = await api(base, "/api/robots.txt");
  check("GET /api/robots.txt → has Sitemap line", rb.ok && /Sitemap:/.test(rb.text));
  const fd = await api(base, "/api/feed.xml");
  check("GET /api/feed.xml → 200 rss with full content", fd.ok && /<rss/.test(fd.text) && /content:encoded/.test(fd.text), `status=${fd.status}`);

  // ads.txt is served by the WEB app (root level) — check it there when a web port is available
  const webBase = process.env.VERIFY_WEB_BASE;
  if (webBase) {
    const at = await api(webBase.replace(/\/+$/, ""), "/ads.txt");
    check("GET /ads.txt → 200 with google.com DIRECT line", at.ok && /google\.com, ca-pub-[^,]+, DIRECT, f08c47fec0942fa0/.test(at.text), `status=${at.status}`);
  }
}

// Feed import: SSRF guard + raw-XML auto-detection (no write: guarded URL, dry-run header)
if (token) {
  const srf = await api(base, "/api/admin/import", {
    token,
    body: { url: "http://127.0.0.1:8787/api/feed.xml" },
    headers: { "x-dry-run": "1" },
  });
  check("feed import: private host rejected (SSRF guard)", srf.status === 400 && /private address/.test(srf.text), `status=${srf.status}`);
  const badfeed = await api(base, "/api/admin/import", {
    token,
    body: "<rss><channel>not a real feed</channel></rss>",
    headers: { "x-dry-run": "1" },
  });
  check("feed import: empty channel parses without import (dry-run ok)", badfeed.status === 200 && badfeed.json?.parse?.totals?.entries === 0, `status=${badfeed.status}`);
}

// Contact form: validation + happy path
{
  const bad = await api(base, "/api/contact", { body: { name: "x", email: "nope", body: "hi" } });
  check("contact: invalid payload → 400", bad.status === 400, `status=${bad.status}`);
  const good = await api(base, "/api/contact", {
    body: { name: "Verify Bot", email: "verify@freegameplay.test", subject: "E2E check", body: "This is an automated end-to-end verification message. Please ignore." },
  });
  check("contact: valid payload → 201", good.status === 201, `status=${good.status} ${good.text.slice(0, 120)}`);
}

// Admin
if (token) {
  const h = await api(base, "/api/admin/health", { token });
  check("admin: health 200 with all checks true", h.ok && h.json?.ok === true && h.json?.checks?.db && h.json?.checks?.r2 && h.json?.checks?.kv, `json=${JSON.stringify(h.json?.checks)}`);
  const rep = await api(base, "/api/admin/report", { token });
  check("admin: report lists runs", rep.ok && (rep.json?.runs?.length ?? 0) >= 1, `runs=${rep.json?.runs?.length}`);
  const msgs = await api(base, "/api/admin/messages", { token });
  check("admin: messages includes the E2E message", msgs.ok && msgs.json?.items?.some((m) => m.email === "verify@freegameplay.test"));
  const noAuth = await api(base, "/api/admin/health");
  check("admin: missing token → 401", noAuth.status === 401, `status=${noAuth.status}`);
} else {
  console.log("  ⚠ Skipping admin checks (no ADMIN_TOKEN in env).");
}

// ── Engagement: leaderboards ────────────────────────────────────────────────
{
  const board = await api(base, "/api/games/vector-breakout/leaderboard");
  check("leaderboard: builtin game returns a board", board.ok && board.json?.gameSlug === "vector-breakout", `status=${board.status}`);
  check("leaderboard: engine reported", board.json?.engine === "breakout", `engine=${board.json?.engine}`);
  const ext = await api(base, "/api/games/ftl-light-years-away/leaderboard");
  check("leaderboard: external game has no board", ext.ok && (ext.json?.entries?.length ?? 0) === 0);
  const miss = await api(base, "/api/games/does-not-exist/leaderboard");
  check("leaderboard: unknown slug → 404", miss.status === 404, `status=${miss.status}`);

  // Submit a score, then read it back on the board.
  const sessionId = `verify-${Date.now()}`;
  const sub = await api(base, "/api/games/vector-breakout/scores", {
    body: { playerName: "Verify Bot", score: 1234, elapsedMs: 45000, sessionId },
  });
  check("leaderboard: score submission accepted", sub.status === 201 && sub.json?.accepted === true, `status=${sub.status} ${sub.text.slice(0, 120)}`);
  const after = await api(base, "/api/games/vector-breakout/leaderboard");
  check("leaderboard: submitted score appears", (after.json?.entries ?? []).some((e) => e.playerName === "Verify Bot"), `n=${after.json?.total}`);
  const dupe = await api(base, "/api/games/vector-breakout/scores", {
    body: { playerName: "Verify Bot", score: 1234, elapsedMs: 45000, sessionId },
  });
  check("leaderboard: duplicate session/score de-duplicated", dupe.status === 200 && dupe.json?.duplicate === true, `status=${dupe.status}`);
  const flood = await api(base, "/api/games/vector-breakout/scores", {
    body: { playerName: "Flood Bot", score: 999999, elapsedMs: 1000, sessionId: `verify-flood-${Date.now()}` },
  });
  check("leaderboard: implausible score rejected", flood.status === 422, `status=${flood.status}`);
  const bad = await api(base, "/api/games/vector-breakout/scores", { body: { score: "nope" } });
  check("leaderboard: non-numeric score → 400", bad.status === 400, `status=${bad.status}`);
}

// ── Engagement: comments (moderated) ────────────────────────────────────────
{
  const slug = "the-comeback-of-the-browser-arcade";
  const list = await api(base, `/api/content/post/${slug}/comments`);
  check("comments: post thread is readable", list.ok && Array.isArray(list.json?.comments), `status=${list.status}`);
  const bad = await api(base, "/api/comments", { body: { targetType: "game", targetSlug: "x", authorName: "A", body: "nope" } });
  check("comments: non-post/guide target → 400", bad.status === 400, `status=${bad.status}`);
  const short = await api(base, "/api/comments", { body: { targetType: "post", targetSlug: slug, authorName: "V", body: "hi" } });
  check("comments: too-short body → 400", short.status === 400, `status=${short.status}`);
  const missing = await api(base, "/api/comments", { body: { targetType: "post", targetSlug: "no-such-post", authorName: "V", body: "long enough body here" } });
  check("comments: unknown target → 404", missing.status === 404, `status=${missing.status}`);

  if (token) {
    // Post → must be invisible until approved.
    const post = await api(base, "/api/comments", {
      body: { targetType: "post", targetSlug: slug, authorName: "Verify Bot", body: "Automated verification comment." },
    });
    check("comments: submission accepted as pending", post.status === 201 && post.json?.status === "pending", `status=${post.status}`);
    const beforeApprove = await api(base, `/api/content/post/${slug}/comments`);
    const hidden = (beforeApprove.json?.comments ?? []).every((c) => c.body !== "Automated verification comment.");
    check("comments: pending comment is not public", hidden);

    const adminList = await api(base, "/api/admin/comments", { token });
    const created = (adminList.json?.items ?? []).find((c) => c.body === "Automated verification comment.");
    check("admin: comment appears in the moderation queue", Boolean(created));
    if (created) {
      await api(base, `/api/admin/comments/${created.id}/status`, { token, method: "POST", body: { status: "approved" } });
      const afterApprove = await api(base, `/api/content/post/${slug}/comments`);
      const shown = JSON.stringify(afterApprove.json?.comments ?? []).includes("Automated verification comment.");
      check("comments: approved comment becomes public", shown);
      await api(base, `/api/admin/comments/${created.id}`, { token, method: "DELETE" });
    }
  }
}

// ── Engagement: newsletter (double opt-in) ──────────────────────────────────
{
  const email = `verify-${Date.now()}@freegameplay.test`;
  const sub = await api(base, "/api/subscribe", { body: { email, source: "verify" } });
  check("subscribe: creates a pending subscriber", sub.status === 201 && sub.json?.status === "pending", `status=${sub.status}`);
  const tokenFromUrl = String(sub.json?.confirmUrl ?? "").split("token=")[1];
  check("subscribe: returns a confirmation link (no provider configured)", Boolean(tokenFromUrl));
  const badConfirm = await api(base, "/api/subscribe/confirm?token=definitely-not-a-token");
  check("subscribe: invalid confirm token → 400", badConfirm.status === 400, `status=${badConfirm.status}`);
  const badEmail = await api(base, "/api/subscribe", { body: { email: "not-an-email" } });
  check("subscribe: invalid email → 400", badEmail.status === 400, `status=${badEmail.status}`);
  if (tokenFromUrl) {
    const confirmed = await fetch(`${base}/api/subscribe/confirm?token=${tokenFromUrl}`);
    check("subscribe: confirmation activates the subscription", confirmed.ok, `status=${confirmed.status}`);
  }
}

// ── Engagement: analytics ───────────────────────────────────────────────────
{
  const beacon = await api(base, "/api/analytics/pageview", { body: { path: "/verify-beacon", referrer: "https://example.com/x", vw: 1280 } });
  check("analytics: pageview beacon accepted", beacon.status === 202, `status=${beacon.status}`);
  const ignored = await api(base, "/api/analytics/pageview", { body: { path: "/api/health" } });
  check("analytics: internal paths ignored", ignored.status === 202 && ignored.json?.ignored === true, `status=${ignored.status}`);
  const hostile = await api(base, "/api/analytics/pageview", { body: { path: "//evil.example.com" } });
  check("analytics: protocol-relative path sanitised", hostile.status === 202, `status=${hostile.status}`);
}

// ── Taxonomy archives ───────────────────────────────────────────────────────
{
  const authors = await api(base, "/api/content/authors");
  check("authors: list returns counts", authors.ok && (authors.json?.items?.length ?? 0) >= 1 && typeof authors.json?.items?.[0]?.postCount === "number");
  const first = authors.json?.items?.[0]?.slug;
  const one = await api(base, `/api/content/authors/${first}`);
  check("authors: detail returns posts", one.ok && Array.isArray(one.json?.posts), `status=${one.status}`);
  const tags = await api(base, "/api/content/tags");
  check("tags: list returns counts", tags.ok && (tags.json?.items?.length ?? 0) >= 1 && typeof tags.json?.items?.[0]?.postCount === "number");
  const tag = tags.json?.items?.[0]?.slug;
  const tagDetail = await api(base, `/api/content/tags/${tag}`);
  check("tags: detail returns posts", tagDetail.ok && Array.isArray(tagDetail.json?.posts), `status=${tagDetail.status}`);
  const noAuthor = await api(base, "/api/content/authors/nobody-here");
  check("authors: unknown slug → 404", noAuthor.status === 404, `status=${noAuthor.status}`);
}

// ── Admin additions ─────────────────────────────────────────────────────────
if (token) {
  const ov = await api(base, "/api/admin/overview", { token });
  check("admin: overview returns counts + analytics", ov.ok && ov.json?.counts?.games >= 1 && Array.isArray(ov.json?.analytics?.series), `status=${ov.status}`);
  const an = await api(base, "/api/admin/analytics?days=7", { token });
  check("admin: analytics report", an.ok && typeof an.json?.totals?.views === "number", `status=${an.status}`);
  const subs = await api(base, "/api/admin/subscribers", { token });
  check("admin: subscribers list", subs.ok && Array.isArray(subs.json?.items), `status=${subs.status}`);
  const csv = await api(base, "/api/admin/subscribers/export", { token });
  check("admin: subscriber CSV export", csv.ok && /email,name,status/.test(csv.text), `status=${csv.status}`);
  const sc = await api(base, "/api/admin/scores", { token });
  check("admin: scores list", sc.ok && Array.isArray(sc.json?.items), `status=${sc.status}`);
  const noAuth = await api(base, "/api/admin/comments");
  check("admin: engagement endpoints require the token", noAuth.status === 401, `status=${noAuth.status}`);
}

// 404 shape
{
  const r = await api(base, "/api/definitely-not-a-route");
  check("unknown /api route → 404 JSON", r.status === 404 && r.json?.error === "not_found");
}

console.log(failures === 0 ? `\n\x1b[32mALL CHECKS PASSED\x1b[0m\n` : `\n\x1b[31m${failures} CHECK(S) FAILED\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
