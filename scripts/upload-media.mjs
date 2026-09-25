#!/usr/bin/env node
// Upload data/media/** to Cloudflare R2.
//   --local  → wrangler CLI against the local miniflare bucket
//   --remote → Cloudflare REST API (needs CLOUDFLARE_API_TOKEN + account)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { adminToken, loadEnv, localBase, MIME_BY_EXT, readState, requireEnv, root, walkFiles } from "./lib.mjs";

const mode = process.argv.includes("--local") ? "local" : "remote";
loadEnv();
const bucket = "freegameplay-media";
const mediaDir = path.join(root(), "data", "media");
const files = [...walkFiles(mediaDir)];
if (files.length === 0) {
  console.log("No media files found in data/media/ — nothing to do.");
  process.exit(0);
}

console.log(`Uploading ${files.length} media file(s) → ${bucket} [${mode}]`);

if (mode === "local") {
  let ok = 0;
  for (const { file, key } of files) {
    const r = spawnSync(
      "npx",
      ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "-f", file, "--local"],
      { cwd: path.join(root(), "apps", "api"), stdio: "inherit" },
    );
    if (r.status === 0) ok++;
    else {
      console.error(`Failed: ${key}`);
      process.exit(1);
    }
  }
  console.log(`Done: ${ok}/${files.length} uploaded (local R2).`);
  // Verify via the worker
  const base = localBase();
  const probe = await fetch(`${base}/media/${files[0].key}`);
  console.log(probe.ok ? `Verified: GET /media/${files[0].key} → ${probe.status} ${probe.headers.get("content-type")}` : `Verify failed: ${probe.status}`);
  process.exit(probe.ok ? 0 : 1);
}

// ── remote ────────────────────────────────────────────────────────────────────
const token = requireEnv("CLOUDFLARE_API_TOKEN");
const state = readState();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || state?.accountId;
if (!accountId) {
  console.error("✗ No account id. Run `node scripts/provision.mjs` first.");
  process.exit(1);
}
const api = `https://api.cloudflare.com/client/v4`;

let ok = 0;
for (const { file, key } of files) {
  const mime = MIME_BY_EXT[path.extname(key).toLowerCase()] ?? "application/octet-stream";
  const body = fs.readFileSync(file);
  const res = await fetch(`${api}/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
    body,
  });
  if (!res.ok) {
    console.error(`Failed ${key}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  ok++;
  console.log(`  ↑ ${key} (${body.length} B, ${mime})`);
}
console.log(`Done: ${ok}/${files.length} uploaded to ${bucket}.`);
