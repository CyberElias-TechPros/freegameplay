// Restricted admin export and private cron share the same contract. D1 batch
// executes these read statements sequentially in one transaction. The fixed row
// budget prevents silent truncation; large installations must use provider exports.
export const BACKUP_TABLES = ['site_settings','categories','tags','authors','games','posts','guides','pages','post_tags','game_tags','guide_tags','redirects','media','migration_runs','migration_items','messages','comments','subscribers','scores','pageviews','_fg_migrations'] as const;
export async function exportBackup(db: D1Database, version: string) {
  const batches = await db.batch(BACKUP_TABLES.map(table => db.prepare(`SELECT * FROM ${table} LIMIT 10001`)));
  const out: Record<string, unknown> = { formatVersion: 1, exportedAt: new Date().toISOString(), appVersion: version, capture: 'D1 batch transaction' };
  const counts: Record<string, number> = {};
  for (let i=0;i<BACKUP_TABLES.length;i++) {
    const result=batches[i];
    if (!result?.success || !Array.isArray(result.results)) throw new Error('Incomplete backup result');
    if (result.results.length>10000) throw new Error('Backup size threshold reached; use provider snapshot/export tooling');
    out[BACKUP_TABLES[i]]=result.results;counts[BACKUP_TABLES[i]]=result.results.length;
  }
  out.tableCounts=counts;
  return out;
}
