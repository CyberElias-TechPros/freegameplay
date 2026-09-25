// Shared helpers for the deploy/ops scripts. Node 20+, no dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function root() {
  return ROOT;
}

/** Load .env from the repo root into process.env (existing values win). */
export function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env var: ${name}`);
    console.error(`  Create .env from .env.example (repo root) and fill it in.`);
    process.exit(1);
  }
  return v;
}

const API_PORT = Number(process.env.API_PORT ?? 8787);

export function localBase() {
  return `http://127.0.0.1:${API_PORT}`;
}

export function readState() {
  const f = path.join(ROOT, ".deploy-state.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}

export function writeState(state) {
  fs.writeFileSync(path.join(ROOT, ".deploy-state.json"), JSON.stringify(state, null, 2));
}

/** Base URL of the content API for the requested mode. */
export function apiBase(mode) {
  if (mode === "local") return localBase();
  const state = readState();
  if (state?.workerUrl) return state.workerUrl;
  console.error("✗ No worker URL found. Run `node scripts/provision.mjs` first (it records the deployed worker URL).");
  process.exit(1);
}

export function adminToken() {
  // Local dev uses apps/api/.dev.vars; remote uses .env / state.
  const devVars = path.join(ROOT, "apps/api/.dev.vars");
  if (fs.existsSync(devVars)) {
    const m = fs.readFileSync(devVars, "utf8").match(/^ADMIN_TOKEN\s*=\s*(\S+)/m);
    if (m) return m[1];
  }
  const state = readState();
  return process.env.ADMIN_TOKEN || state?.adminToken || "";
}

export async function api(base, pathName, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(base.replace(/\/+$/, "") + pathName, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

export function pass(label) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}
export function fail(label, detail) {
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
}

export const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

export function* walkFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(full, base);
    else if (entry.isFile()) yield { file: full, key: path.relative(base, full).split(path.sep).join("/") };
  }
}
