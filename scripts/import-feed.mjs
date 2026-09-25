#!/usr/bin/env node
// Import content from a feed — RSS 2.0, Atom, or a Blogger (Blogspot) feed.
//
// Usage:
//   node scripts/import-feed.mjs <feed-url-or-file.xml> [--local] [--dry-run] [--download-media] [--label my-feed]
//
// Examples:
//   # any RSS 2.0 feed (dry-run first, always review before the real import)
//   node scripts/import-feed.mjs https://example.com/feed --dry-run
//   node scripts/import-feed.mjs https://example.com/feed
//
//   # your old Blogspot blog — no login needed, Blogger feeds carry full
//   # post content in <content:encoded>:
//   node scripts/import-feed.mjs "https://yourblog.blogspot.com/feeds/posts/default?alt=rss&max-results=500"
//
//   # offline / saved copy of a feed
//   node scripts/import-feed.mjs data/feeds/sample-rss.xml --local
//
// Behaviour mirrors the Blogger XML import: dry-run reports the full mapping
// (entries → posts/pages, images, dates, warnings) without writing anything;
// the real import is idempotent (re-runs update in place), preserves original
// publish dates, registers 308 redirects for the feed's original URLs, and
// records referenced images as unresolved media for rights review (pass
// --download-media to also pull Blogger-hosted media into R2).
import fs from "node:fs";
import path from "node:path";
import { adminToken, api, apiBase, loadEnv, root } from "./lib.mjs";

const args = process.argv.slice(2);
const mode = args.includes("--local") ? "local" : "remote";
const dryRunOnly = args.includes("--dry-run");
const downloadMedia = args.includes("--download-media");
const labelIdx = args.indexOf("--label");
const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;
const target = args.filter((a, i) => !a.startsWith("--") && !(labelIdx >= 0 && i === labelIdx + 1))[0];
if (!target) {
  console.error("Usage: node scripts/import-feed.mjs <feed-url-or-file.xml> [--local] [--dry-run] [--download-media] [--label name]");
  process.exit(1);
}
loadEnv();
const base = apiBase(mode);
const token = adminToken();
if (!token) {
  console.error("✗ No ADMIN_TOKEN found (apps/api/.dev.vars or .env).");
  process.exit(1);
}

// local file → raw XML body; URL → let the backend fetch it (SSRF-guarded)
const body = /^https?:\/\//i.test(target) ? { url: target } : fs.readFileSync(path.isAbsolute(target) ? target : path.join(root(), target), "utf8");

async function runImport(dryRun) {
  return api(base, "/api/admin/import", {
    token,
    body,
    headers: {
      "x-dry-run": dryRun ? "1" : "0",
      "x-import-meta": JSON.stringify({ kind: "rss", sourceLabel: label, downloadMedia: dryRun ? false : downloadMedia }),
    },
  });
}

function showParse(title, j) {
  console.log(`${title}: ${j.parse.totals.entries} entries → ${j.parse.totals.posts} posts, ${j.parse.totals.pages} pages, ${j.parse.totals.labels} labels, ${j.parse.totals.images} image refs`);
  for (const d of j.parse.diagnostics.filter((d) => d.level === "warn" || d.level === "error")) console.log(`  ⚠ [${d.code}] ${d.message}`);
  for (const d of j.parse.diagnostics.filter((d) => d.level === "info")) console.log(`    · [${d.code}] ${d.message}`);
}

console.log(`\n── DRY RUN · ${target} → ${base} [${mode}]`);
const dry = await runImport(true);
if (!dry.ok) {
  console.error("✗ Dry-run failed:", dry.status, dry.text.slice(0, 600));
  process.exit(1);
}
const dj = dry.json;
console.log(`  feed: ${dj.parse.feedTitle ?? "(untitled)"} · kind: ${dj.parse.hasExcerptsOnly ? "⚠ summaries only" : "full content"}`);
showParse("parsed", dj);
console.log(`  would create: posts=${dj.stats.posts.created} guides=${dj.stats.guides.created} pages=${dj.stats.pages.created} redirects=${dj.stats.redirects.created}`);
console.log(`  would update: posts=${dj.stats.posts.updated} guides=${dj.stats.guides.updated} pages=${dj.stats.pages.updated} redirects=${dj.stats.redirects.updated}`);
console.log(`  unresolved media (rights review needed): ${dj.stats.media.unresolved}`);

if (dryRunOnly) {
  console.log("\n--dry-run: stopping here, nothing was written.");
  process.exit(0);
}

console.log(`\n── IMPORT · ${target} [${mode}]`);
const real = await runImport(false);
if (!real.ok) {
  console.error("✗ Import failed:", real.status, real.text.slice(0, 600));
  process.exit(1);
}
const rj = real.json;
console.log(`  run: ${rj.run.jobId} (${rj.run.status})`);
for (const table of ["posts", "guides", "pages"]) {
  console.log(`  ${table}: created=${rj.stats[table].created} updated=${rj.stats[table].updated} failed=${rj.stats[table].failed}`);
}
console.log(`  redirects: created=${rj.stats.redirects.created} updated=${rj.stats.redirects.updated} skipped=${rj.stats.redirects.skipped}`);
console.log(`  media: uploaded=${rj.stats.media.uploaded} unresolved=${rj.stats.media.unresolved}`);
for (const w of rj.warnings ?? []) console.warn(`  ⚠ ${w}`);
console.log("\nMigration report: GET /api/admin/report (admin token)");
process.exit(rj.stats.posts.failed + rj.stats.guides.failed + rj.stats.pages.failed > 0 ? 1 : 0);
