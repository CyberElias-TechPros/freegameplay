// Content-versioned, public-static-only precache. No API, HTML articles, admin,
// tokens, analytics, ads or user-specific responses can enter this cache.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const dir=new URL('./dist/',import.meta.url);
const files=fs.readdirSync(dir,{recursive:true}).filter(f=>fs.statSync(new URL(f,dir)).isFile()&&f!=='sw.js'&&!f.endsWith('.map')).sort();
const hash=createHash('sha256');for(const file of files)hash.update(file).update(fs.readFileSync(new URL(file,dir)));
const version=hash.digest('hex').slice(0,16);
const script=`const CACHE='fg-pocket-${version}';
const FILES=${JSON.stringify(files)};
const urls=FILES.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
// No skipWaiting: do not replace assets in an active game. Close/reopen all tabs to update.
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('fg-pocket-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin||url.search)return;
 const root=new URL(self.registration.scope);
 const asset=url.href===root.href?new URL('index.html',root).href:url.href;
 if(!urls.includes(asset))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(asset)||fetch(req);})());
});
`;
fs.writeFileSync(new URL('sw.js',dir),script);
console.log(`Offline manifest: ${files.length} public static files, version ${version}`);
