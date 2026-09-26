#!/usr/bin/env node
// Apply every apps/api/migrations/*.sql file, in order, to D1.
//
//   node scripts/migrate.mjs --local            # local miniflare D1 (dev)
//   node scripts/migrate.mjs --remote           # the provisioned Cloudflare D1
//   node scripts/migrate.mjs --local --status   # show applied/pending only
//
// Why not `wrangler d1 migrations apply`: the repo ships the schema as plain
// .sql files and must stay runnable with zero Cloudflare access. This runner
// keeps ordering, idempotency and reporting in one place and tracks its own
// bookkeeping table, so `--status` is accurate without depending on wrangler
// internals. Every migration file is written to be safe to re-apply.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadEnv, root } from "./lib.mjs";

const ROOT = root();
const MIGRATIONS_DIR = path.join(ROOT, "apps", "api", "migrations");
const BOOKKEEPING = "_fg_migrations";

const mode = process.argv.includes("--remote") ? "remote" : "local";
const statusOnly = process.argv.includes("--status");
loadEnv();

const DB_NAME = process.env.CF_D1_NAME || "freegameplay-db";

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function wrangler(args) {
  return spawnSync("npx", ["wrangler", ...args], {
    cwd: path.join(ROOT, "apps", "api"),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

const remoteFlag = mode === "local" ? "--local" : "--remote";

function sql(query) {
  const r = wrangler(["d1", "execute", DB_NAME, remoteFlag, "--command", query, "--json"]);
  if (r.status !== 0 || !r.stdout) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

/** Names of migrations already recorded in our own bookkeeping table. */
function appliedSet() {
  const out = sql(
    `CREATE TABLE IF NOT EXISTS ${BOOKKEEPING} (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  );
  if (!out) return new Set();
  const res = sql(`SELECT name FROM ${BOOKKEEPING}`);
  const rows = res?.[0]?.results ?? [];
  return new Set(rows.map((r) => String(r.name)));
}

const files = migrationFiles();
if (files.length === 0) {
  console.error("✗ No migration files found in apps/api/migrations/");
  process.exit(1);
}

const applied = appliedSet();
console.log(`\nD1 migrations → ${DB_NAME} [${mode}]\n`);
for (const f of files) {
  console.log(`  ${applied.has(f) ? "✓" : "•"} ${f}  (${applied.has(f) ? "applied" : "pending"})`);
}

if (statusOnly) process.exit(0);

const pending = files.filter((f) => !applied.has(f));
if (pending.length === 0) {
  console.log("\nNothing to do — schema is up to date.\n");
  process.exit(0);
}

let ok = 0;
for (const f of pending) {
  const file = path.join(MIGRATIONS_DIR, f);
  process.stdout.write(`  → applying ${f} … `);
  const r = wrangler(["d1", "execute", DB_NAME, remoteFlag, "--file", file]);
  if (r.status !== 0) {
    console.log("FAILED");
    console.error((r.stdout ?? "") + (r.stderr ?? ""));
    console.error(`\n✗ Migration ${f} failed. Fix the SQL and re-run — earlier migrations are already applied.`);
    process.exit(1);
  }
  sql(`INSERT OR IGNORE INTO ${BOOKKEEPING} (name) VALUES ('${f.replace(/'/g, "''")}')`);
  console.log("ok");
  ok++;
}
console.log(`\n${ok} migration(s) applied. Schema is up to date.\n`);
