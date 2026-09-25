#!/usr/bin/env node
// Load the seed content (data/seed/content.json) through the SAME admin import
// pipeline used for Blogger XML — proving the pipeline is the only path.
import fs from "node:fs";
import path from "node:path";
import { adminToken, api, apiBase, loadEnv, root } from "./lib.mjs";

const mode = process.argv.includes("--local") ? "local" : "remote";
loadEnv();
const base = apiBase(mode);
const seedFile = path.join(root(), "data", "seed", "content.json");
const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
const token = adminToken();
if (!token) {
  console.error("✗ No ADMIN_TOKEN found (apps/api/.dev.vars or .env).");
  process.exit(1);
}

console.log(`Seeding from ${path.relative(root(), seedFile)} → ${base} [${mode}]`);
const res = await api(base, "/api/admin/import", {
  token,
  body: { records: seed.records },
  headers: { "x-import-meta": JSON.stringify({ kind: seed.kind ?? "seed", sourceLabel: seed.sourceLabel }) },
});

if (!res.ok) {
  console.error("✗ Seed import failed:", res.status, res.text.slice(0, 500));
  process.exit(1);
}
const { stats, run, warnings } = res.json;
console.log(`  run: ${run.jobId} (${run.status})`);
for (const table of ["games", "posts", "guides", "pages"]) {
  console.log(`  ${table}: created=${stats[table].created} updated=${stats[table].updated} skipped=${stats[table].skipped} failed=${stats[table].failed}`);
}
console.log(`  categories: created=${stats.categories.created} · tags: created=${stats.tags.created} · authors: created=${stats.authors.created}`);
console.log(`  redirects: created=${stats.redirects.created} updated=${stats.redirects.updated} skipped=${stats.redirects.skipped}`);
console.log(`  media: uploaded=${stats.media.uploaded} unresolved=${stats.media.unresolved} skipped=${stats.media.skipped}`);
for (const w of warnings ?? []) console.warn(`  ⚠ ${w}`);
const total = stats.games.failed + stats.posts.failed + stats.guides.failed + stats.pages.failed;
process.exit(total > 0 ? 1 : 0);
