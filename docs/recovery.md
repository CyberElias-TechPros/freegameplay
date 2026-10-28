# Restricted backup and recovery runbook

Updated 2026-10-28. **Locally rehearsed; not a cloud recovery certification.** Use a private operator workstation. Backups contain personal data, token hashes, messages and migration records. Never attach them to issues, chat, public artifacts or the media bucket.

## Contract and isolation

- Admin `GET /api/admin/export` requires the bearer admin token and produces `formatVersion: 1` JSON. Scheduled daily export uses the same function in `apps/api/src/lib/backup.ts`.
- Capture submits 21 read statements in one D1 batch transaction. `tableCounts` records returned row counts. Each query fetches at most 10,001 rows; any table over 10,000 causes the entire export to fail, rather than silently truncate. This is a small-site export, not a production-scale archival system.
- Scope: settings, categories/tags/authors, games/posts/guides/pages, three tag joins, redirects/media metadata, migration runs/items, messages/comments/subscribers/scores/pageviews and `_fg_migrations`. Search tables rebuild through schema triggers.
- Excludes R2 image bytes, KV, provider secrets/config, DNS and native local data. Preserve/reconcile public media separately. An API export alone is not a complete infrastructure backup.
- Scheduled JSON goes **only** to `BACKUPS` (`freegameplay-backups`), not `MEDIA`. Deny public bucket access and do not attach a public domain. Verify provider settings externally; local bindings are not proof of production isolation.
- Public routes reject synthetic backup keys/encoded variants before storage lookup, through both the Worker and Next proxy. This does not assess historical deployments or purge older CDN copies.
- Current retention code keeps 14 from the first 100 listed objects; pagination, alerting, retention failure tests and provider-scale limits remain open. Use provider-controlled backup/export and monitoring before production reliance.

## Rehearsal (no remote writes)

1. Freeze/reconcile content and take a provider snapshot before any production schema change. Record release/schema identifiers, capture time, data counts and a separately stored SHA-256 checksum. Restrict file access to the recovery operator.
2. Download the authenticated JSON into the ignored `backups/` directory. Avoid secrets in shell history/process arguments; use the approved credential manager. Never use a public `/media` URL to obtain a backup.
3. Run:

   ```bash
   node scripts/restore-backup.mjs backups/export.json
   # Optional: create a NEW sensitive SQL file, mode 0600, inside ignored backups/ only.
   node scripts/restore-backup.mjs backups/export.json --write-sql backups/isolated-restore.sql
   ```

4. The tool checks format version, all required tables, optional manifest counts, allowed columns/scalar values, foreign keys, integrity and final counts. It restores into **in-memory SQLite** using the current checked-in schema. It will not connect to Cloudflare, overwrite an existing SQL output, or choose a live database.
5. Generated SQL is for an **empty isolated database**, never a populated live DB. Schema-version compatibility, provider SQL limitations, current client compatibility and FTS behavior must be rehearsed on disposable D1 before cutover. SQLite success is not D1 recovery proof.
6. Reconcile game/content/search/media, engagement counts and privacy deletions against the approved receipt. The current tool does not reapply deletion tombstones; establish that process before restoring old personal data.
7. Only after review, choose a new resource binding and a reversible cutover window. Keep the previous resources unchanged. Run read-only smoke and manual user journeys. Measure RPO/RTO; neither has been approved or proven in production here.
8. Dispose of local sensitive files per the approved retention policy. No destructive cleanup is automated.

## Why per-run rollback is disabled

The former timestamp/source-based deletion could remove unrelated or previously existing content. `POST /api/admin/rollback` now returns **409**, without destructive work. Import receipts are useful audit evidence but not before-images. Per-row provenance, update conflict handling, transaction boundaries and a safe rollback preview remain unimplemented. Do not restore that endpoint as a shortcut.

## Migration interruption

`scripts/migrate.mjs` refuses to proceed if it cannot initialize/read/write its history. SQL execution and bookkeeping are still separate; no checksum adoption or automatic repair is provided. If a migration or bookkeeping step fails, stop writes, inspect the schema/history on a clone and decide forward repair versus isolated restore. Blindly rerunning `ALTER TABLE` after partial success is unsafe.

## Evidence

On 2026-10-28, an authenticated export from the running local Worker was restored by the offline CLI: 8 games, 6 posts, 4 guides, 3 pages, 12 media records, 3 migration records and all remaining exported tables passed count/foreign-key/integrity checks. Automated tests cover SQL quoting, malformed/missing tables, unknown columns, foreign-key failures, manifest mismatches, incomplete export results and row-limit refusal. This does not establish encryption configuration, retention, concurrency/load capacity, disaster recovery or prior exposure handling in a live account.
