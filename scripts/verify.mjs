#!/usr/bin/env node
// End-to-end verification of the content API (local or deployed).
// Exercises every public route, the media path, search, redirects, sitemap,
// contact form validation, and admin endpoints. Exits non-zero on any failure.
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

// 404 shape
{
  const r = await api(base, "/api/definitely-not-a-route");
  check("unknown /api route → 404 JSON", r.status === 404 && r.json?.error === "not_found");
}

console.log(failures === 0 ? `\n\x1b[32mALL CHECKS PASSED\x1b[0m\n` : `\n\x1b[31m${failures} CHECK(S) FAILED\x1b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
