import { test, expect } from '@playwright/test';
const web = process.env.TEST_WEB_ORIGIN ?? 'http://127.0.0.1:3000';
const mobile = process.env.TEST_MOBILE_ORIGIN ?? 'http://127.0.0.1:4173';
test('web homepage has working media and navigation', async ({ page }) => {
  await page.goto(web);
  await expect(page.getByRole('heading',{level:1})).toContainText('Free');
  await expect.poll(() => page.locator('.hero-bg img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeAttached();
});
test('web game starts, pauses, accepts name spaces and saves favorites',async({page})=>{
  await page.goto(`${web}/games/vector-breakout`);
  await page.getByRole('button',{name:'Save game',exact:false}).click();
  await page.getByRole('button',{name:'Start game',exact:false}).click();
  await expect(page.locator('.game-status')).toContainText('playing');
  await page.keyboard.press('Space'); // serve, not pause
  await expect(page.locator('.game-status')).toContainText('playing');
  await page.keyboard.press('p');
  await expect(page.locator('.game-status')).toContainText('paused');
  await page.getByLabel('Your name').fill('Two Words');
  await expect(page.getByLabel('Your name')).toHaveValue('Two Words');
  await page.goto(`${web}/saved`);
  await expect(page.getByRole('link',{name:'Vector Breakout →'}).first()).toBeVisible();
});
test('web private paths are denied without immutable headers',async({request})=>{
  const r=await request.get(`${web}/media/backups/db-test.json`);
  expect(r.status()).toBe(404);expect(r.headers()['cache-control']).not.toContain('immutable');
});
for (const title of ['Vector Breakout','Orbit Dodge','Neon Snake','Gravity Well']) {
  test(`packaged mobile UI plays ${title} offline after load`,async({page,context})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(mobile);
    await context.setOffline(true);
    await page.getByRole('article').filter({has:page.getByRole('heading',{name:title})}).getByRole('button',{name:'Play now'}).click();
    await page.getByRole('button',{name:'Start game'}).click();
    await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await expect(page.getByRole('button',{name:'Resume game'})).toBeVisible();
    await page.getByRole('button',{name:'Resume game'}).click();
    await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Back to arcade',exact:false}).click();
    expect(errors).toEqual([]);
  });
}
test('mobile favorites survive reload, settings clear local data',async({page})=>{
  await page.goto(mobile);await page.getByRole('button',{name:'Save Neon Snake',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Saved',exact:false}).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Neon Snake'})).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:false}).click();
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Clear my data'}).click();
  await page.getByRole('button',{name:'Saved',exact:false}).click();await expect(page.getByRole('article')).toHaveCount(0);
});

test('hosted pocket arcade reloads offline after public-only precache',async({page,context})=>{
  await page.goto(mobile);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  const cached=await page.evaluate(async()=>{const keys=await caches.keys();const paths:string[]=[];for(const key of keys){for(const r of await (await caches.open(key)).keys())paths.push(new URL(r.url).pathname);}return paths;});
  expect(cached.every(p=>!p.includes('/api/')&&!p.includes('/admin'))).toBe(true);
  await context.setOffline(true);await page.reload();
  await expect(page.getByRole('heading',{name:'Good games. Zero waiting.'})).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(4);
});
