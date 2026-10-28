import test from 'node:test';
import assert from 'node:assert/strict';
import { rehearseRestore } from '../scripts/restore-backup.mjs';
const empty=()=>Object.fromEntries(['site_settings','categories','tags','authors','games','posts','guides','pages','post_tags','game_tags','guide_tags','redirects','media','migration_runs','migration_items','messages','comments','subscribers','scores','pageviews','_fg_migrations'].map(t=>[t,[]]));
test('offline backup rehearsal restores quotes/HTML without executing injected SQL',()=>{
 const dump:any={formatVersion:1,...empty()};dump.posts=[{id:1,slug:'test',title:"Don't; DROP TABLE posts; --",content_html:'<p>hello</p>'}];
 const result=rehearseRestore(dump);assert.equal(result.counts.posts,1);assert.match(result.sql,/Don''t/);
});
test('backup rehearsal rejects missing tables, unknown columns and broken relations',()=>{
 assert.throws(()=>rehearseRestore({formatVersion:1}),/Missing table/);
 const dump:any={formatVersion:1,...empty()};dump.posts=[{id:1,slug:'test',title:'Test',injected:42}];assert.throws(()=>rehearseRestore(dump),/Unknown column/);
 dump.posts=[{id:1,slug:'test',title:'Test',author_id:999}];assert.throws(()=>rehearseRestore(dump),/FOREIGN KEY/);
});

test('backup export batches reads and rejects oversized or incomplete results',async()=>{
 const {exportBackup,BACKUP_TABLES}=await import('../apps/api/src/lib/backup.ts');
 let calls=0;
 const db:any={prepare:(sql:string)=>{assert.match(sql,/ LIMIT 10001$/);return sql;},batch:async(statements:any[])=>{calls++;assert.equal(statements.length,BACKUP_TABLES.length);return statements.map(()=>({success:true,results:[]}));}};
 const result=await exportBackup(db,'test');assert.equal(calls,1);assert.equal(result.capture,'D1 batch transaction');assert.equal((result.tableCounts as any).posts,0);
 db.batch=async()=>[{success:true,results:Array.from({length:10001},()=>({}))}];await assert.rejects(()=>exportBackup(db,'test'),/threshold/);
 db.batch=async()=>[];await assert.rejects(()=>exportBackup(db,'test'),/Incomplete/);
 const dump:any={formatVersion:1,...empty(),tableCounts:{}};assert.throws(()=>rehearseRestore(dump),/Manifest count mismatch/);
});
