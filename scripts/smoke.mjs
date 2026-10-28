// Read-only public verification: no tokens, writes or limiter resets.
const origin = process.argv[2];
if (!origin || !/^https?:\/\//.test(origin)) throw new Error('Usage: npm run smoke -- <origin>');
const paths = ['/api/health','/api/content/home','/api/content/games','/api/search?q=snake'];
for (const path of paths) {
  const r = await fetch(new URL(path,origin), { signal:AbortSignal.timeout(15000) });
  if (!r.ok || !(r.headers.get('content-type')??'').includes('application/json')) throw new Error(`${path}: ${r.status} / invalid content type`);
  const data=await r.json();
  if(path==='/api/health' && !data.ok) throw new Error('API not ready');
  console.log(`PASS ${path}`);
}
for(const path of ['/media/backups/db-test.json','/api/admin/export']) {
  const r=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(15000)});
  if(![401,403,404].includes(r.status)) throw new Error(`Private boundary failed: ${path}`);
  console.log(`PASS restricted ${path}`);
}
