// Route-level integration with real SQLite schema/queries and deterministic KV/R2
// adapters. Does not replace Wrangler/Cloudflare deployment verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../apps/api/src/worker.ts';
import { hashToken } from '../apps/api/src/lib/tokens.ts';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('apps/api/migrations').sort()) sqlite.exec(readFileSync(`apps/api/migrations/${file}`, 'utf8'));
  const DB = { prepare(sql:string) {
    let params:any[]=[];
    const query = {
      bind(...args:any[]) { params=args; return query; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results:sqlite.prepare(sql).all(...params) }; },
      async run() { const r=sqlite.prepare(sql).run(...params); return { success:true, meta:{ changes:Number(r.changes), last_row_id:Number(r.lastInsertRowid) } }; },
    }; return query;
  }, async batch(statements:any[]) { return Promise.all(statements.map(s=>s.run())); } };
  const values=new Map<string,string>();
  const CACHE={get:async(k:string)=>values.get(k)??null,put:async(k:string,v:string)=>{values.set(k,v);},delete:async(k:string)=>{values.delete(k);},list:async({prefix=''}={})=>({keys:[...values.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})};
  let mediaReads=0;
  const env:any={DB,CACHE,ADMIN_TOKEN:'test-only-admin',ANALYTICS_SALT:'test-only-salt',APP_VERSION:'test',APP_ENV:'development',ALLOW_TEST_EMAIL_LINKS:'1',SITE_URL:'https://site.example',MEDIA:{get:async()=>{mediaReads++;return {body:'public image',size:12};},list:async()=>({objects:[]})}};
  const request=(path:string,body?:unknown,headers:Record<string,string>={})=>worker.fetch(new Request(`https://site.example${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,{} as any);
  return {sqlite,env,request,values,mediaReads:()=>mediaReads};
}

test('public media refuses private storage lookups and cannot add immutable caching',async()=>{
  const f=fixture();
  for(const path of ['/media/backups/db-2026-10-28.json','/media/backups/db.json.jpg','/media/covers/a.svg','/media/%2562ackups/db.json']){
    const r=await f.request(path); assert.equal(r.status,404); assert.equal(r.headers.get('Cache-Control'),'no-store');
  }
  assert.equal(f.mediaReads(),0);
  const valid=await f.request('/media/covers/a.jpg'); assert.equal(valid.status,200); assert.equal(f.mediaReads(),1);
  assert.doesNotMatch(valid.headers.get('Cache-Control')!,/immutable/); f.sqlite.close();
});
test('production mail failure cannot disclose a token; existing membership has same response',async()=>{
  const f=fixture(); f.env.APP_ENV='production'; f.env.RESEND_API_KEY='fake'; f.env.NOTIFY_FROM='test@example.com';
  const original=globalThis.fetch; globalThis.fetch=async()=>new Response('down',{status:503});
  try{
    const res=await f.request('/api/subscribe',{email:'new@example.com'}); assert.equal(res.status,201);
    const json=await res.json(); assert.equal(json.confirmUrl,undefined);
    f.sqlite.exec("UPDATE subscribers SET status='confirmed'");
    assert.deepEqual(await (await f.request('/api/subscribe',{email:'new@example.com'})).json(),json);
    const row=f.sqlite.prepare('SELECT confirm_token FROM subscribers').get()!;
    assert.match(row.confirm_token as string,/^[a-f0-9]{64}$/);
  } finally {globalThis.fetch=original; f.sqlite.close();}
});
test('no mail provider in production fails closed without writing subscriber data',async()=>{
  const f=fixture();f.env.APP_ENV='production';
  assert.equal((await f.request('/api/subscribe',{email:'x@example.com'})).status,503);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM subscribers').get()!.n,0); f.sqlite.close();
});
test('confirmation is single-use, expires, and cannot undo unsubscribe',async()=>{
  const f=fixture();
  const reply=await (await f.request('/api/subscribe',{email:'reader@example.com'})).json();
  const link=new URL(reply.confirmUrl); const r=await f.request(link.pathname+link.search); assert.equal(r.status,200);
  assert.equal((await f.request(link.pathname+link.search)).status,400);
  const unsub='a'.repeat(40);f.sqlite.prepare('UPDATE subscribers SET unsubscribe_token=?').run(await hashToken(unsub));
  assert.equal((await f.request(`/api/unsubscribe?token=${unsub}`)).status,200);
  assert.equal((await f.request(link.pathname+link.search)).status,400);
  const next=await (await f.request('/api/subscribe',{email:'reader@example.com'})).json();
  f.sqlite.exec("UPDATE subscribers SET confirm_expires_at='2000-01-01T00:00:00.000Z'");
  const expired=new URL(next.confirmUrl);assert.equal((await f.request(expired.pathname+expired.search)).status,400); f.sqlite.close();
});
test('CORS allows only configured web origin and includes destructive admin method',async()=>{
  const f=fixture();
  const foreign=await f.request('/api/health',undefined,{Origin:'https://evil.example'});assert.equal(foreign.headers.get('Access-Control-Allow-Origin'),null);
  const good=await f.request('/api/health',undefined,{Origin:f.env.SITE_URL});assert.equal(good.headers.get('Access-Control-Allow-Origin'),f.env.SITE_URL);
  const options=await worker.fetch(new Request('https://site.example/api/admin/comments/1',{method:'OPTIONS',headers:{Origin:f.env.SITE_URL,'Access-Control-Request-Method':'DELETE'}}),f.env,{} as any);
  assert.match(options.headers.get('Access-Control-Allow-Methods')!,/DELETE/);f.sqlite.close();
});
test('contact wrong-type values return 400; rate keys contain no raw IP',async()=>{
  const f=fixture();
  const res=await f.request('/api/contact',{name:42,email:{},body:[]},{'cf-connecting-ip':'198.51.100.77'});
  assert.equal(res.status,400);assert.ok([...f.values.keys()].every(k=>!k.includes('198.51.100.77')));f.sqlite.close();
});
test('public write body limits reject oversized payloads',async()=>{
  const f=fixture();assert.equal((await f.request('/api/contact',{body:'x'.repeat(17000)})).status,413);f.sqlite.close();
});
test('cross-type comment parent rejected even with matching slug',async()=>{
  const f=fixture();f.sqlite.exec("INSERT INTO posts(slug,title) VALUES('same','post'); INSERT INTO guides(slug,title) VALUES('same','guide'); INSERT INTO comments(target_type,target_slug,author_name,body,status,client_hash) VALUES('post','same','Reader','hello','approved','hash');");
  const res=await f.request('/api/comments',{targetType:'guide',targetSlug:'same',parentId:1,authorName:'Reader',body:'A real reply'});assert.equal(res.status,400);f.sqlite.close();
});
test('score uniqueness enforced by database and missing timing rejected',async()=>{
  const f=fixture();f.sqlite.exec("INSERT INTO games(slug,title,leaderboard_enabled,builtin) VALUES('test-game','Test',1,'{\"engine\":\"snake\"}')");
  assert.equal((await f.request('/api/games/test-game/scores',{score:10})).status,422);
  const payload={score:10,elapsedMs:2000,sessionId:'run-test',playerName:'Reader'};
  assert.equal((await f.request('/api/games/test-game/scores',payload)).status,201);
  const dupe=await (await f.request('/api/games/test-game/scores',payload)).json();assert.equal(dupe.duplicate,true);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM scores').get()!.n,1);f.sqlite.close();
});

test('production bootstrap fails closed without either required secret',async()=>{
  for(const key of ['ADMIN_TOKEN','ANALYTICS_SALT']){
    const f=fixture();f.env.APP_ENV='production';delete f.env[key];
    assert.equal((await f.request('/api/health')).status,503);f.sqlite.close();
  }
});
test('confirmation email includes usable hashed unsubscribe token without API disclosure',async()=>{
  const f=fixture();f.env.APP_ENV='production';f.env.RESEND_API_KEY='fake';f.env.NOTIFY_FROM='test@example.com';
  const original=globalThis.fetch;let message:any;
  globalThis.fetch=async(_input,init)=>{message=JSON.parse(String(init?.body));return Response.json({id:'test-mail'});};
  try {
    const r=await f.request('/api/subscribe',{email:'mail@example.com'});
    const result=await r.json();assert.equal(result.confirmUrl,undefined);
    const match=message.html.match(/https:\/\/site\.example\/api\/unsubscribe\?token=([a-f0-9]{40})/);
    assert.ok(match);assert.equal(f.sqlite.prepare('SELECT unsubscribe_token FROM subscribers').get()!.unsubscribe_token,await hashToken(match[1]));
    assert.equal((await f.request(`/api/unsubscribe?token=${match[1]}`)).status,200);
    assert.equal(f.sqlite.prepare('SELECT status FROM subscribers').get()!.status,'unsubscribed');
  }finally{globalThis.fetch=original;f.sqlite.close();}
});
