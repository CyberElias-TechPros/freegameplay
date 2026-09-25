#!/usr/bin/env node
// Import a Blogger "Back up content" XML export through the admin pipeline.
//
// Usage:
//   node scripts/import-blogger.mjs data/blogger/sample-export.xml [--local] [--dry-run] [--download-media]
//
// Behaviour:
//   1. DRY RUN first — full mapping + stats, zero writes, so the report can
//      be reviewed before anything lands.
//   2. Real import (idempotent — safe to re-run; re-runs update in place).
import fs from "node:fs";
import path from "node:path";
import { adminToken, api, apiBase, loadEnv, root } from "./lib.mjs";

const args = process.argv.slice(2);
const mode = args.includes("--local") ? "local" : "remote";
const dryRunOnly = args.includes("--dry-run");
const downloadMedia = args.includes("--download-media");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: node scripts/import-blogger.mjs <blogger-export.xml> [--local] [--dry-run] [--download-media]");
  process.exit(1);
}
const abs = path.isAbsolute(file) ? file : path.join(root(), file);
if (!fs.existsSync(abs)) {
  console.error(`✗ File not found: ${abs}`);
  process.exit(1);
}
loadEnv();
const base = apiBase(mode);
const token = adminToken();
if (!token) {
  console.error("✗ No ADMIN_TOKEN found (apps/api/.dev.vars or .env).");
  process.exit(1);
}
const xml = fs.readFileSync(abs, "utf8");

async function runImport(dryRun) {
  return api(base, "/api/admin/import", {
    token,
    body: xml,
    headers: {
      "Content-Type": "application/xml",
      "x-dry-run": dryRun ? "1" : "0",
      "x-import-meta": JSON.stringify({ kind: "blogger", sourceLabel: `blogger-${path.basename(abs)}`, downloadMedia: dryRun ? false : downloadMedia }),
    },
  });
}

console.log(`\n── DRY RUN · ${path.relative(root(), abs)} → ${base} [${mode}]`);
const dry = await runImport(true);
if (!dry.ok) {
  console.error("✗ Dry-run failed:", dry.status, dry.text.slice(0, 600));
  process.exit(1);
}
const dj = dry.json;
console.log(`  parsed: ${dj.parse.totals.entries} entries → ${dj.parse.totals.posts} posts, ${dj.parse.totals.pages} pages, ${dj.parse.totals.comments} comments, ${dj.parse.totals.labels} labels, ${dj.parse.totals.images} image refs`);
const warns = dj.parse.diagnostics.filter((d) => d.level !== "info");
for (const d of warns) console.log(`  ⚠ [${d.code}] ${d.message}`);
for (const d of dj.parse.diagnostics.filter((d) => d.level === "info")) console.log(`    · [${d.code}] ${d.message}`);
console.log(`  would create: games=${dj.stats.games.created} posts=${dj.stats.posts.created} guides=${dj.stats.guides.created} pages=${dj.stats.pages.created} redirects=${dj.stats.redirects.created}`);
console.log(`  would update: games=${dj.stats.games.updated} posts=${dj.stats.posts.updated} guides=${dj.stats.guides.updated} pages=${dj.stats.pages.updated} redirects=${dj.stats.redirects.updated}`);
console.log(`  unresolved media (rights review needed): ${dj.stats.media.unresolved}`);

if (dryRunOnly) {
  console.log("\n--dry-run: stopping here, nothing was written.");
  process.exit(0);
}

console.log(`\n── IMPORT · ${path.relative(root(), abs)} [${mode}]`);
const real = await runImport(false);
if (!real.ok) {
  console.error("✗ Import failed:", real.status, real.text.slice(0, 600));
  process.exit(1);
}
const rj = real.json;
console.log(`  run: ${rj.run.jobId} (${rj.run.status})`);
for (const table of ["games", "posts", "guides", "pages"]) {
  console.log(`  ${table}: created=${rj.stats[table].created} updated=${rj.stats[table].updated} failed=${rj.stats[table].failed}`);
}
console.log(`  redirects: created=${rj.stats.redirects.created} updated=${rj.stats.redirects.updated} skipped=${rj.stats.redirects.skipped}`);
console.log(`  media: uploaded=${rj.stats.media.uploaded} unresolved=${rj.stats.media.unresolved}`);
for (const w of rj.warnings ?? []) console.warn(`  ⚠ ${w}`);
console.log("\nMigration report available at: GET /api/admin/report (admin token)");
process.exit(rj.stats.posts.failed + rj.stats.guides.failed + rj.stats.pages.failed > 0 ? 1 : 0);
