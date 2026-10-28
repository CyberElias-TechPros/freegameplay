#!/usr/bin/env node
// Offline, non-destructive restore rehearsal. No provider credentials or network.
// Usage: node scripts/restore-backup.mjs backups/export.json [--write-sql backups/restored.sql]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function rehearseRestore(dump) {
  if (!dump || dump.formatVersion!==1) throw new Error('Unsupported/missing backup formatVersion (expected 1)');
  const tables=['site_settings','categories','tags','authors','games','posts','guides','pages','post_tags','game_tags','guide_tags','redirects','media','migration_runs','migration_items','messages','comments','subscribers','scores','pageviews','_fg_migrations'];
  const db=new DatabaseSync(':memory:');
  const schema=fs.readdirSync(path.join(root,'apps/api/migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync(path.join(root,'apps/api/migrations',f),'utf8')).join('\n');
  const bookkeeping="CREATE TABLE IF NOT EXISTS _fg_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));";
  db.exec(`PRAGMA foreign_keys=ON; ${schema} ${bookkeeping}`);
  const literal=v=>{if(v===null)return 'NULL';if(typeof v==='string')return "'"+v.replace(/'/g,"''")+"'";if(typeof v==='number'&&Number.isFinite(v))return String(v);throw new Error('Unsupported SQL value');};
  const statements=['DELETE FROM site_settings;']; // initial schema inserts a default singleton
  const counts={};
  try {
    for(const table of tables) {
      if(!Array.isArray(dump[table]))throw new Error(`Missing table ${table}`);
      if(dump[table].length>10000)throw new Error(`Oversized table ${table}`);
      const columns=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(r=>r.name));
      counts[table]=dump[table].length;
      if(dump.tableCounts && dump.tableCounts[table]!==counts[table])throw new Error(`Manifest count mismatch: ${table}`);
      for(const row of dump[table]) {
        if(!row || typeof row!=='object' || Array.isArray(row))throw new Error(`Invalid row in ${table}`);
        const keys=Object.keys(row);
        if(!keys.length||keys.some(k=>!columns.has(k)))throw new Error(`Unknown column in ${table}`);
        statements.push(`INSERT INTO "${table}" (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map(k=>literal(row[k])).join(',')});`);
      }
    }
    db.exec(`BEGIN; PRAGMA defer_foreign_keys=ON; ${statements.join('\n')} COMMIT;`);
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Foreign key integrity check failed');
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Integrity check failed');
    for(const table of tables)if(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n!==counts[table])throw new Error(`Count mismatch: ${table}`);
    // FTS triggers have rebuilt searchable content during insertion.
    return {counts,sql:`-- PRIVATE DATA. Fresh database only. Never execute against a live populated database.\n${schema}\n${bookkeeping}\nBEGIN;\nPRAGMA defer_foreign_keys=ON;\n${statements.join('\n')}\nCOMMIT;\n`};
  } finally {db.close();}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const file=process.argv[2];if(!file)throw new Error('Usage: node scripts/restore-backup.mjs <private-export.json> [--write-sql backups/restored.sql]');
  if(fs.statSync(file).size>50*1024*1024)throw new Error('Backup exceeds 50 MB offline-tool budget');
  const result=rehearseRestore(JSON.parse(fs.readFileSync(file,'utf8')));
  console.log('Offline rehearsal passed:',result.counts);
  const flag=process.argv.indexOf('--write-sql');
  if(flag!==-1) {
    if(!process.argv[flag+1])throw new Error('Missing output path');
    const output=path.resolve(root,process.argv[flag+1]);
    if(!output.startsWith(path.join(root,'backups')+path.sep))throw new Error('Output must be inside ignored backups/ directory');
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result.sql,{mode:0o600,flag:'wx'});
    console.log('Private SQL written; no remote database was changed.');
  }
}
