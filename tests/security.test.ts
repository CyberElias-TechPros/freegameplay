import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeContent } from '../packages/shared/src/content-safety.ts';
import { isPublicMediaKey, mediaUrl, serializeJsonLd, csvCell } from '../packages/shared/src/security.ts';
import { approvedUrl, fetchApproved } from '../apps/api/src/lib/safe-fetch.ts';
import { kvDeleteByPrefix, kvGetJson, kvSetJson, sweepCaches } from '../apps/api/src/lib/cache.ts';
import { testEmailLinksAllowed } from '../apps/api/src/lib/tokens.ts';

for (const key of ['backups/db-2026-10-28.json', 'backups/db.json.jpg', 'covers/../../backups/db.json', 'covers/%2e%2e/secret.png', 'covers/a.svg', 'covers/a.html', '/covers/a.jpg', 'covers/a\\b.png', 'covers/a.png?x=1']) {
  test(`private/active media denied: ${key}`, () => assert.equal(isPublicMediaKey(key), false));
}
test('public media normalized exactly once', () => {
  for (const path of ['covers/a.jpg', '/covers/a.jpg', '/media/covers/a.jpg', 'media/covers/a.jpg']) assert.equal(mediaUrl(path), '/media/covers/a.jpg');
  assert.equal(mediaUrl('javascript:alert(1)'), null);
  assert.equal(mediaUrl('//evil.test/a.jpg'), null);
  assert.equal(mediaUrl('https://user:pass@evil.test/a.jpg'), null);
});
test('HTML boundary removes executable markup and preserves prose', () => {
  const out = sanitizeContent('<p>Hello <strong>reader</strong><img src="/media/covers/a.jpg" onerror="alert(1)"><script>alert(1)</script><svg onload="x()"></svg><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)" onclick="x()">go</a><form><input name="password"></form></p>');
  assert.match(out, /<strong>reader<\/strong>/);
  assert.doesNotMatch(out, /onerror|onclick|script|iframe|svg|javascript|form|input/);
  assert.match(out, /src="\/media\/covers\/a.jpg"/);
});
test('JSON-LD closing tags cannot leave script context', () => {
  const value = { title: '</script><script>alert(1)</script>&\u2028' };
  const out = serializeJsonLd(value);
  assert.doesNotMatch(out, /<|>|&/);
  assert.deepEqual(JSON.parse(out), value);
});
test('spreadsheet formula cells are inert', () => {
  for (const value of ['=cmd()', '+cmd', '-cmd', '@cmd', '  =cmd', '\tcmd']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('a"b'), '"a""b"');
});
test('email debug mode requires BOTH explicit local flags', () => {
  assert.equal(testEmailLinksAllowed({ APP_ENV: 'production', ALLOW_TEST_EMAIL_LINKS: '1' }), false);
  assert.equal(testEmailLinksAllowed({ APP_ENV: 'development' }), false);
  assert.equal(testEmailLinksAllowed({ APP_ENV: 'development', ALLOW_TEST_EMAIL_LINKS: '1' }), true);
});
test('approved feeds reject credentials, ports, private/literal/unapproved hosts', () => {
  for (const url of ['http://feeds.example.com/a', 'https://feeds.example.com:444/a', 'https://u:p@feeds.example.com/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://evil.test/a', 'https://feeds.example.com.evil.test/a']) assert.throws(() => approvedUrl(url, ['feeds.example.com']));
});
test('fetch validates redirect destination before making the next request', async () => {
  let requests = 0;
  await assert.rejects(fetchApproved('https://feeds.example.com/a', ['feeds.example.com'], 100, async () => {
    requests++; return new Response('', { status: 302, headers: { location: 'https://127.0.0.1/a' } });
  }), /approved/);
  assert.equal(requests, 1);
});
test('fetch enforces streaming byte budget without content-length', async () => {
  await assert.rejects(fetchApproved('https://feeds.example.com/a', ['feeds.example.com'], 4, async () => new Response('12345')), /large/);
});
test('fetch accepts bounded approved content and caps redirects', async () => {
  const out = await fetchApproved('https://feeds.example.com/a', ['feeds.example.com'], 10, async () => new Response('<rss/>'));
  assert.equal(new TextDecoder().decode(out.bytes), '<rss/>');
  await assert.rejects(fetchApproved('https://feeds.example.com/a', ['feeds.example.com'], 10, async () => new Response('', { status: 302, headers: { location: '/a' } })), /redirects/);
});

test('cache sweeps all listing pages, bare legacy keys, but not rate state', async () => {
  const values = new Map<string, string>([['home','old'], ['rl:score:hash','keep']]);
  for (let i=0;i<125;i++) values.set(`public:v2:${i}`, 'old');
  const kv = {
    get: async (k:string) => values.get(k) ?? null,
    put: async (k:string,v:string) => { values.set(k,v); },
    delete: async (k:string) => { values.delete(k); },
    list: async ({prefix,cursor}:{prefix:string;cursor?:string}) => {
      const all = [...values.keys()].filter(k=>k.startsWith(prefix)).sort();
      const offset = Number(cursor ?? 0); const end = offset+20;
      return { keys:all.slice(offset,end).map(name=>({name})), list_complete:end>=all.length, cursor:String(end) };
    },
  };
  await kvSetJson(kv as any, 'home', { safe: true }, 1);
  assert.deepEqual(await kvGetJson(kv as any, 'home'), {safe:true});
  assert.equal(await kvDeleteByPrefix(kv as any, 'missing'), 0);
  await sweepCaches(kv as any);
  assert.deepEqual([...values], [['rl:score:hash','keep']]);
});
