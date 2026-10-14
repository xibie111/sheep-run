/** Verify exact v5 generated assets and touch transactions in the final shared build. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../../', import.meta.url), out = new URL('docs/skins-v5/final-build/', root);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile(new URL('assets/skins/runtime-v5/manifest.json', root), 'utf8'));
const report = { passed: false, phoneHardware: false, isolatedBrowserData: true, url: process.env.SKINS_V5_FINAL_URL || 'http://127.0.0.1:4352/', checks: [], errors: [], assets: [], purchases: [], screenshots: [] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage(), downloads = [], delivered = new Map();
const check = (condition, label) => { assert(condition, label); report.checks.push(label); };
page.on('response', response => {
  const skin = manifest.skins.find(s => response.url().includes(`/${s.id}-sheet-`) && response.url().endsWith('.png'));
  if (skin) downloads.push(response.body().then(raw => delivered.set(skin.id, { url: response.url(), sha256: createHash('sha256').update(raw).digest('hex') })));
});
page.on('pageerror', error => report.errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('sheep-run-save', JSON.stringify({ version: 5, highScore: 7, totalStars: 240, spentStars: 0, coins: 380, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } })));
const nextFrame = () => page.evaluate(() => new Promise(resolve => { let count = 2; const after = () => { if (!--count) { window.g.events.off('postrender', after); resolve(); } }; window.g.events.on('postrender', after); }));
async function tap(key, name) {
  const point = await page.evaluate(({ key, name }) => {
    const scene = window.g.scene.getScene(key);
    const find = list => { for (const o of list) { if (o.name === name) return o; const child = o.list && find(o.list); if (child) return child; } };
    const o = find(scene.children.list); if (!o?.input?.enabled) throw Error(`Disabled/missing ${key}/${name}`);
    const bounds = o.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: canvas.x + bounds.centerX * canvas.width / size.width, y: canvas.y + bounds.centerY * canvas.height / size.height };
  }, { key, name });
  await page.touchscreen.tap(point.x, point.y); await nextFrame();
}
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-save')));
const shot = async name => { await page.screenshot({ path: fileURLToPath(new URL(name, out)), scale: 'device' }); report.screenshots.push(name); };
try {
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js$/.test(r.url()));
  await page.goto(report.url, { waitUntil: 'domcontentloaded' }); report.main = (await request).url();
  const mainBytes = await readFile(new URL(`dist/assets/${report.main.split('/').pop()}`, root));
  report.mainSha256 = createHash('sha256').update(mainBytes).digest('hex');
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, report.main);
  await page.waitForFunction(() => window.g.scene.isActive('MenuScene'), null, { timeout: 15000 }); await Promise.all(downloads);
  check(await page.evaluate(() => window.g.renderer.type === 2), 'Final build uses normal AUTO/WebGL renderer');
  for (const skin of manifest.skins) {
    const data = await page.evaluate(id => {
      const t = window.g.textures.get(`sheep-runner-${id}`);
      return { id, dimensions: [t.source[0].width, t.source[0].height], filter: t.source[0].scaleMode, frames: Array.from({ length: 15 }, (_, i) => { const f = t.get(i); return [f.cutX, f.cutY, f.cutWidth, f.cutHeight]; }) };
    }, skin.id);
    Object.assign(data, delivered.get(skin.id));
    check(data.sha256 === skin.runtimeHash && data.dimensions.join() === '640,384' && data.filter === 1, `${skin.id}: final HTTP PNG matches exact generated runtime hash, size and nearest filter`);
    data.frames.forEach((frame, i) => check(frame.join() === [i % 5 * 128, Math.floor(i / 5) * 128 + 16, 128, 112].join(), `${skin.id}: final registered frame ${i}`)); report.assets.push(data);
  }
  await tap('MenuScene', 'button:衣橱'); await page.waitForFunction(() => window.g.scene.isActive('WardrobeScene'));
  for (let i = 0; i < 6; i++) await tap('WardrobeScene', 'button:page-next');
  for (let i = 0; i < manifest.skins.length; i++) {
    const { id } = manifest.skins[i]; if (i === 5) { await shot('wardrobe-page7-dpr2.png'); await tap('WardrobeScene', 'button:page-next'); }
    await tap('WardrobeScene', `skin-card:${id}`); const before = await save(); await tap('WardrobeScene', 'button:购买'); const after = await save();
    const stars = { 'bee-v1': 60, 'mushroom-v1': 80, 'fox-v1': 100 }, coins = { 'chef-v1': 100, 'pirate-v1': 120, 'dinosaur-v1': 160 };
    check(after.version === 5 && after.totalStars === before.totalStars && after.spentStars === before.spentStars + (stars[id] || 0) && after.coins === before.coins - (coins[id] || 0) && after.unlockedSkins.includes(id) && after.selectedSkin === before.selectedSkin, `${id}: final actual touch spends only the existing single currency and preserves save version`);
    await tap('WardrobeScene', 'button:装备'); check((await save()).selectedSkin === id, `${id}: final actual touch equips`); report.purchases.push({ id, before, after });
  }
  await shot('wardrobe-page8-dpr2.png');
  const end = await save(); check(end.totalStars === 240 && end.spentStars === 240 && end.coins === 0, 'All six exact prices spend 240 stars and 380 coins without new economy rules');
  await tap('WardrobeScene', 'button:返回'); await tap('MenuScene', 'button:开始游戏'); await page.waitForFunction(() => window.g.scene.isActive('RunScene'));
  check(await page.evaluate(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.texture.key === 'sheep-runner-dinosaur-v1' && p.displayWidth === 48 && p.displayHeight === 42 && p.body.width === 30 && p.body.height === 30; }), 'Final actual run uses equipped dinosaur with unchanged collision dimensions');
  await shot('dinosaur-final-running-dpr2.png'); check(report.errors.length === 0, 'No final build runtime exceptions'); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { report.completedAt = new Date().toISOString(); await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2)); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, main: report.main, checks: report.checks.length, skins: report.assets.length, failure: report.failure?.split('\n')[0] }) + '\n');
