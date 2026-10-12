/** Verify the final shared build after parallel delivery-only changes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../../', import.meta.url), out = new URL('docs/skins-v4/final-build/', root);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile(new URL('assets/skins/runtime-v4/manifest.json', root), 'utf8'));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage(), report = { passed: false, phoneHardware: false, isolatedPlayerData: true, checks: [], errors: [], assets: [], screenshots: [] };
const downloads = [], delivered = new Map();
page.on('response', response => {
  const skin = manifest.skins.find(s => response.url().includes(`/${s.id}-sheet-`) && response.url().endsWith('.png'));
  if (skin) downloads.push(response.body().then(raw => delivered.set(skin.id, { url: response.url(), hash: createHash('sha256').update(raw).digest('hex') })));
});
page.on('pageerror', e => report.errors.push(e.message));
const check = (ok, text) => { assert(ok, text); report.checks.push(text); };
await page.addInitScript(() => localStorage.setItem('sheep-run-save', JSON.stringify({ version: 5, highScore: 7, totalStars: 360, spentStars: 0, coins: 430, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } })));
try {
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js$/.test(r.url()));
  await page.goto('http://127.0.0.1:4343/', { waitUntil: 'domcontentloaded' }); report.main = (await request).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, report.main);
  await page.waitForFunction(() => window.g.scene.isActive('MenuScene'), null, { timeout: 15000 });
  await Promise.all(downloads);
  check(await page.evaluate(() => window.g.renderer.type === 2), 'Final build uses normal AUTO/WebGL');
  for (const skin of manifest.skins) {
    const data = await page.evaluate(id => {
      const t = window.g.textures.get(`sheep-runner-${id}`);
      return { id, size: [t.source[0].width, t.source[0].height], filter: t.source[0].scaleMode,
        frames: Array.from({ length: 15 }, (_, i) => { const f = t.get(i); return [f.cutX, f.cutY, f.cutWidth, f.cutHeight]; }) };
    }, skin.id);
    Object.assign(data, delivered.get(skin.id));
    check(data.hash === skin.runtimeHash && data.size.join() === '640,384' && data.filter === 1, `${skin.id} exact generated PNG hash/dimensions/filter loaded by final build`);
    data.frames.forEach((f, i) => check(f.join() === [i % 5 * 128, Math.floor(i / 5) * 128 + 16, 128, 112].join(), `${skin.id} final frame ${i}`));
    report.assets.push(data);
  }
  const tap = async (key, name) => {
    const p = await page.evaluate(({ key, name }) => {
      const s = window.g.scene.getScene(key), find = list => { for (const o of list) { if (o.name === name) return o; const child = o.list && find(o.list); if (child) return child; } }, o = find(s.children.list);
      if (!o?.input?.enabled) throw Error(`No enabled ${key}/${name}`);
      const b = o.getBounds(), c = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize;
      return { x: c.x + b.centerX * c.width / z.width, y: c.y + b.centerY * c.height / z.height };
    }, { key, name }); await page.touchscreen.tap(p.x, p.y);
    await page.evaluate(() => new Promise(resolve => { let n = 2; const fn = () => { if (!--n) { window.g.events.off('postrender', fn); resolve(); } }; window.g.events.on('postrender', fn); }));
  };
  await tap('MenuScene', 'button:衣橱'); await page.waitForFunction(() => window.g.scene.isActive('WardrobeScene'));
  for (let n = 0; n < 4; n++) await tap('WardrobeScene', 'button:page-next');
  await tap('WardrobeScene', 'skin-card:strawberry-v1'); await tap('WardrobeScene', 'button:购买');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-save')));
  check(save.version === 5 && save.totalStars === 360 && save.spentStars === 40 && save.coins === 430 && save.unlockedSkins.includes('strawberry-v1') && save.selectedSkin === 'white', 'Final build real touch purchase atomically spends 40 stars and does not auto-equip');
  await tap('WardrobeScene', 'button:装备');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-save')).selectedSkin === 'strawberry-v1'), 'Final build real equip works');
  const screenshot = 'wardrobe-dpr2-device.png'; await page.screenshot({ path: fileURLToPath(new URL(screenshot, out)), scale: 'device' }); report.screenshots.push(screenshot);
  check(!report.errors.length, 'No final build runtime exceptions'); report.passed = true;
} finally {
  await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2)); await browser.close();
}
process.stdout.write(JSON.stringify({ passed: report.passed, main: report.main, checks: report.checks.length, skins: report.assets.length }) + '\n');
