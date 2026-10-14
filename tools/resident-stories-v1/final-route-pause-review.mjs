import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = resolve('docs/resident-stories-v1/routes-browser/final-menu-style');
await mkdir(out, { recursive: true });
const report = { passed: false, url: 'http://127.0.0.1:4386/', viewport: { width: 896, height: 414, dpr: 2 },
  method: 'Isolated visual fixture seeds only prerequisites, uses scene.start, positions chapter at middle distance and skips authored spawns; real touchscreen taps open and resume PauseScene. Not natural route completion evidence.', checks: [], errors: [] };
const check = (value, label) => { assert(value, label); report.checks.push(label); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
  await page.addInitScript(() => localStorage.setItem('sheep-run-delivery-v1', JSON.stringify({ version: 1, completedIds: ['windmill-invitation-v1'] })));
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js$/.test(r.url()));
  await page.goto(report.url, { waitUntil: 'domcontentloaded' }); report.main = (await request).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, report.main);
  await page.waitForFunction(() => window.g?.scene.isActive('MenuScene'));
  await page.evaluate(() => { window.g.scene.stop('MenuScene'); window.g.scene.start('RunScene', { deliveryId: 'windmill-thanks-v1' }); });
  await page.waitForFunction(() => window.g.scene.isActive('RunScene') && window.g.scene.getScene('RunScene').sheep?.grounded);
  await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.delivery.distance = 8000; s.delivery.next = s.delivery.chapter.obstacles.length; s.updateDelivery(0); });
  const target = async (scene, name) => page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene), o = s.children.getByName(name), b = o.getBounds(), c = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: c.x + (b.centerX - s.cameras.main.scrollX * o.scrollFactorX) * c.width / size.width,
      y: c.y + (b.centerY - s.cameras.main.scrollY * o.scrollFactorY) * c.height / size.height, enabled: o.input?.enabled };
  }, { scene, name });
  const pause = await target('RunScene', 'button:暂停'); check(pause.enabled, 'Actual pause touch target enabled');
  await page.touchscreen.tap(pause.x, pause.y);
  await page.waitForFunction(() => window.g.scene.isActive('PauseScene') && window.g.scene.isPaused('RunScene'));
  const facts = () => page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return { distance: s.delivery.distance, nowMs: s.activeRunTimeMs, endingMs: s.delivery.endingMs, paused: window.g.scene.isPaused('RunScene') }; });
  const before = await facts(); await page.waitForTimeout(200); const after = await facts();
  check(before.paused && after.paused && before.distance === after.distance && before.nowMs === after.nowMs && before.endingMs === after.endingMs, 'Actual touch pause freezes route and effective clocks');
  const buttons = await page.evaluate(() => { const s = window.g.scene.getScene('PauseScene'), size = window.g.scale.gameSize;
    return s.children.list.filter(o => o.name.startsWith('button:')).map(o => { const b = o.getBounds(); return { name: o.name, x: b.x, y: b.y, right: b.right, bottom: b.bottom, enabled: o.input?.enabled, fits: b.x >= 0 && b.y >= 0 && b.right <= size.width && b.bottom <= size.height }; }); });
  check(buttons.length === 3 && buttons.every(b => b.fits && b.enabled), 'Resume restart and menu buttons fit wide viewport');
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true });
  const screenshot = resolve(out, 'pause-wide-landscape.png'); await writeFile(screenshot, Buffer.from(data, 'base64'));
  const resume = await target('PauseScene', 'button:继续游戏'); await page.touchscreen.tap(resume.x, resume.y);
  await page.waitForFunction(() => window.g.scene.isActive('RunScene') && !window.g.scene.isActive('PauseScene'));
  check(await page.evaluate(() => window.g.scene.getScene('RunScene').delivery.chapter.id === 'windmill-thanks-v1'), 'Actual touch resume returns to same chapter');
  check(report.errors.length === 0, 'No browser runtime errors');
  Object.assign(report, { passed: true, before, after, buttons, screenshot });
} catch (error) { report.failure = String(error); throw error; }
finally { await writeFile(resolve(out, 'pause-report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
