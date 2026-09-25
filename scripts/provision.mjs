#!/usr/bin/env node
// Provision the Cloudflare account for FreeGameplay (idempotent):
//   • discover the account (or use CLOUDFLARE_ACCOUNT_ID)
//   • create D1 database `freegameplay-db`      (if missing)
//   • create R2 bucket  `freegameplay-media`    (if missing)
//   • create KV namespace (title FreeGameplayCache) (if missing)
//   • patch apps/api/wrangler.jsonc placeholders with the real IDs
//   • record worker URL + account id in .deploy-state.json
//
// Requires CLOUDFLARE_API_TOKEN (scopes: Workers Scripts Edit, D1 Edit,
// R2 Write, KV Edit, Account Settings Read).
import fs from "node:fs";
import path from "node:path";
import { loadEnv, readState, requireEnv, root, writeState } from "./lib.mjs";

loadEnv();
const token = requireEnv("CLOUDFLARE_API_TOKEN");
const api = "https://api.cloudflare.com/client/v4";
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function get(p) {
  const res = await fetch(api + p, { headers: H });
  if (!res.ok) throw new Error(`GET ${p} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function post(p, body) {
  const res = await fetch(api + p, { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${p} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// 1) Account ───────────────────────────────────────────────────────────────────
let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!accountId) {
  const accounts = await get("/accounts?per_page=20");
  if (!accounts.result || accounts.result.length === 0) throw new Error("Token can't see any accounts — check scopes (Account Settings Read).");
  accountId = accounts.result[0].id;
  console.log(`Discovered account: ${accounts.result[0].name} (${accountId})`);
} else {
  console.log(`Using account: ${accountId}`);
}

// 2) D1 ────────────────────────────────────────────────────────────────────────
let d1 = (await get(`/accounts/${accountId}/d1?limit=100`)).result?.find((d) => d.name === "freegameplay-db");
if (d1) console.log(`D1 exists: freegameplay-db (${d1.uuid})`);
else {
  const r = await post(`/accounts/${accountId}/d1`, { name: "freegameplay-db" });
  d1 = r.result;
  console.log(`D1 created: freegameplay-db (${d1.uuid})`);
}

// 3) R2 ────────────────────────────────────────────────────────────────────────
let bucket = (await get(`/accounts/${accountId}/r2/buckets?limit=100`)).result?.find((b) => b.name === "freegameplay-media");
if (bucket) console.log(`R2 exists: freegameplay-media`);
else {
  await post(`/accounts/${accountId}/r2/buckets`, { name: "freegameplay-media" });
  console.log("R2 created: freegameplay-media");
}

// 4) KV ────────────────────────────────────────────────────────────────────────
let kv = (await get(`/accounts/${accountId}/kv/namespaces?limit=100`)).result?.find((k) => k.title === "FreeGameplayCache");
if (kv) console.log(`KV exists: FreeGameplayCache (${kv.id})`);
else {
  const r = await post(`/accounts/${accountId}/kv/namespaces`, { title: "FreeGameplayCache" });
  kv = r.result;
  console.log(`KV created: FreeGameplayCache (${kv.id})`);
}

// 5) Patch wrangler.jsonc placeholders ────────────────────────────────────────
const cfgPath = path.join(root(), "apps", "api", "wrangler.jsonc");
let cfg = fs.readFileSync(cfgPath, "utf8");
const before = cfg;
cfg = cfg.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${d1.uuid}"`);
cfg = cfg.replace(/"id":\s*"__KV_NAMESPACE_ID__"/, `"id": "${kv.id}"`);
if (cfg !== before) fs.writeFileSync(cfgPath, cfg);
console.log(`wrangler.jsonc ${cfg !== before ? "patched" : "already up to date"} (d1=${d1.uuid.slice(0, 8)}…, kv=${kv.id.slice(0, 8)}…)`);

// 6) Worker URL ───────────────────────────────────────────────────────────────
const workerName = process.env.CF_WORKER_NAME || "freegameplay-api";
let workerUrl = null;
try {
  const sub = await get(`/accounts/${accountId}/workers/subdomain`);
  if (sub.success && sub.result) workerUrl = `https://${workerName}.${sub.result}.workers.dev`;
} catch {
  console.warn("⚠ Could not read workers subdomain (Workers Scripts Read scope missing?) — you can still deploy; the URL will be printed by wrangler.");
}

const state = {
  ...(readState() ?? {}),
  accountId,
  d1Id: d1.uuid,
  kvId: kv.id,
  bucket: "freegameplay-media",
  workerName,
  workerUrl,
  provisionedAt: new Date().toISOString(),
};
writeState(state);
console.log(`State written to .deploy-state.json${workerUrl ? `\nWorker URL will be: ${workerUrl}` : ""}`);
console.log("\nNext: `npx wrangler deploy` in apps/api (or just run scripts/deploy.sh).");
