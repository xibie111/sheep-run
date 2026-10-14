/** Read-only visual audit: isolated browser data, frozen production rendering, no gameplay edits. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = new URL('../docs/background-style-audit-20261013/', import.meta.url);
await mkdir(new URL('screenshots/', out), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage(), report = { purpose: 'Background style comparison only; phase/season sampling is a disclosed fixture, not natural play or mobile hardware validation', productionUrl: 'http://127.0.0.1:4354/', phoneHardware: false, views: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('sheep-run-save', JSON.stringify({ version: 5, highScore: 0, totalStars: 0, spentStars: 0, coins: 0, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } })));
async function frames() { await page.evaluate(() => new Promise(resolve => { let n = 2; const after = () => { if (!--n) { window.g.events.off('postrender', after); resolve(); } }; window.g.events.on('postrender', after); })); }
async function shot(name) {
  await frames(); const file = `screenshots/${name}.png`; await page.screenshot({ path: fileURLToPath(new URL(file, out)), scale: 'css' });
  const textures = await page.evaluate(() => { const s = window.g.scene.getScenes(true)[0]; return s.children.list.filter(o => o.texture && (o.name?.startsWith('delivery-landscape') || o.depth < -9)).map(o => ({ name: o.name, key: o.texture.key, source: [o.texture.source[0].width, o.texture.source[0].height], display: [o.displayWidth, o.displayHeight], scale: [o.scaleX, o.scaleY], filter: o.texture.source[0].scaleMode, alpha: o.alpha, visible: o.visible })); });
  report.views.push({ name, file, textures });
}
async function run(data = {}) {
  await page.evaluate(data => { const active = window.g.scene.getScenes(true)[0]; if (active.sys.settings.key === 'RunScene') active.scene.restart(data); else active.scene.start('RunScene', data); }, data);
  await page.waitForFunction(id => window.g.scene.isActive('RunScene') && (!id || window.g.scene.getScene('RunScene').delivery?.chapter.id === id), data.deliveryId, { timeout: 10000 });
  await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.sys.sceneUpdate = () => {}; s.physics.pause(); s.deliveryPanel?.clear(); });
}
try {
  const main = page.waitForRequest(r => /\/assets\/main-[^/]+\.js$/.test(r.url())); await page.goto(report.productionUrl, { waitUntil: 'domcontentloaded' }); report.main = (await main).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, report.main); await page.waitForFunction(() => window.g.scene.isActive('MenuScene'), null, { timeout: 15000 }); await shot('menu-reference');
  await run();
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    await page.evaluate(season => { const s = window.g.scene.getScene('RunScene'); s.environmentSystem.setTheme(season); s.environmentSystem.setWeather('sunny'); s.environmentSystem.update(0, 0); }, season); await shot(`endless-${season}`);
  }
  for (const id of ['hill-goodnight-v1', 'dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1']) {
    await run({ deliveryId: id });
    const stages = await page.evaluate(() => window.g.scene.getScene('RunScene').delivery.chapter.landscapes.map((l, i) => ({ key: l.key, at: i === 0 ? 0 : l.transitionEnd })));
    for (const [index, stage] of stages.entries()) {
      await page.evaluate(at => { const s = window.g.scene.getScene('RunScene'); s.delivery.distance = at; s.deliveryView.update(s.delivery, 0); }, stage.at); await shot(`${id}-stage-${index}`);
    }
  }
  report.passed = report.errors.length === 0;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(new URL('browser-render-audit.json', out), JSON.stringify(report, null, 2)); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, main: report.main, screenshots: report.views.length, errors: report.errors.length, failure: report.failure?.split('\n')[0] }) + '\n');
