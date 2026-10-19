import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const mode = process.env.BOOT_QA_MODE || 'after';
const url = process.env.BOOT_QA_URL || `http://127.0.0.1:${mode === 'before' ? 4380 : 4381}/`;
const out = process.env.BOOT_QA_OUT || `docs/boot-green-fix-v1/${mode}`;
await mkdir(`${out}/screenshots`, { recursive: true });
const report = { mode, url, passed: false, phoneHardware: false, method: 'Ephemeral mobile-touch Edge contexts, actual WebGL. Gates main-module and black-sheep PNG downloads, instruments the real HTMLElement.hidden setter and actual Phaser postrender. Faults are confined to these contexts. Cold navigation, refresh and touch retry use normal production code. No user browser profile or save.', profiles: [], checks: [], faults: {}, errors: [], screenshots: [] };
const check = (value, name) => { assert(value, name); report.checks.push(name); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const mainPattern = /\/assets\/main-[^/]+\.js(?:\?.*)?$/;
const assetPattern = /\/assets\/black-sheet-[^/]+\.png(?:\?.*)?$/;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function instrumentation() {
  window.bootTrace = { hidden: [], frames: [], errors: [] };
  window.bootFacts = () => {
    const g = window.g, menu = g?.scene?.keys?.MenuScene, root = document.getElementById('loading-screen');
    const rendered = !!menu?.cameras?.main?.renderList?.some(o => o.name === 'ui-pasture-backdrop');
    return { time: performance.now(), hidden: root?.hidden ?? false, stage: root?.dataset.stage, menuActive: !!g?.scene?.isActive('MenuScene'), menuChildren: menu?.children?.list?.length || 0, rendered, webgl: !!g?.renderer?.gl };
  };
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  Object.defineProperty(HTMLElement.prototype, 'hidden', { ...descriptor, set(value) { descriptor.set.call(this, value); if (this.id === 'loading-screen') window.bootTrace.hidden.push({ ...window.bootFacts(), assigned: Boolean(value) }); } });
  window.addEventListener('error', event => window.bootTrace.errors.push(event.message));
  const sample = () => { const facts = window.bootFacts(); if (window.bootTrace.frames.length < 1600) window.bootTrace.frames.push(facts); requestAnimationFrame(sample); };
  requestAnimationFrame(sample);
}
async function contextFor(width, height, dpr) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  await context.addInitScript(instrumentation);
  const page = await context.newPage(); const errors = []; let mainUrl;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (mainPattern.test(request.url())) mainUrl = request.url(); });
  return { context, page, errors, main: () => mainUrl };
}
async function capture(page, name) { const filename = `${name}.png`; await page.screenshot({ path: `${out}/screenshots/${filename}`, scale: 'css' }); report.screenshots.push(`screenshots/${filename}`); }
async function frames(page, count = 3) { await page.evaluate(count => new Promise(resolve => { const frame = () => --count ? requestAnimationFrame(frame) : resolve(); requestAnimationFrame(frame); }), count); }
async function connect(page, mainUrl) {
  await page.evaluate(async mainUrl => {
    window.g = (await import(mainUrl)).game.instance;
    window.g.events.on('postrender', () => { window.bootTrace.lastRender = window.bootFacts(); });
  }, mainUrl);
}
async function completed(page) {
  await page.waitForFunction(() => window.g?.scene.isActive('MenuScene') && window.g.scene.getScene('MenuScene').children.list.length > 5 && document.getElementById('loading-screen').hidden, { timeout: 30000 });
  await frames(page);
  return page.evaluate(() => ({ facts: window.bootFacts(), trace: window.bootTrace }));
}
async function buttonPoint(page, sceneKey, name) {
  return page.evaluate(({ sceneKey, name }) => {
    const scene = window.g.scene.getScene(sceneKey); const walk = list => { for (const item of list) { if (item.name === name) return item; const child = item.list && walk(item.list); if (child) return child; } };
    const item = walk(scene.children.list); if (!item) throw Error(`Missing ${name}`); const b = item.getBounds(), r = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: r.x + (b.centerX - scene.cameras.main.scrollX * item.scrollFactorX) * r.width / size.width, y: r.y + (b.centerY - scene.cameras.main.scrollY * item.scrollFactorY) * r.height / size.height };
  }, { sceneKey, name });
}
try {
  const profiles = mode === 'before' ? [[896, 414, 1]] : [1, 2].flatMap(dpr => [[480, 270], [896, 414], [844, 390], [800, 600]].map(([w, h]) => [w, h, dpr]));
  for (const [width, height, dpr] of profiles) {
    const h = await contextFor(width, height, dpr); const { page } = h; let moduleGate, assetGate;
    await page.route(mainPattern, async route => { await moduleGate.promise; await route.continue(); });
    await page.route(assetPattern, async route => { await assetGate.promise; await route.continue(); });
    const entry = { width, height, dpr, navigations: [] };
    for (const navigation of ['cold', 'refresh']) {
      moduleGate = deferred(); assetGate = deferred();
      if (navigation === 'cold') await page.goto(url, { waitUntil: 'domcontentloaded' }); else await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#loading-screen')?.dataset.stage === 'boot');
      await frames(page); const moduleWaiting = await page.evaluate(() => window.bootFacts());
      check(!moduleWaiting.hidden, `${width}/${dpr}/${navigation}: loading covers delayed module`);
      moduleGate.resolve(); await page.waitForFunction(() => document.querySelector('#loading-screen').dataset.stage === 'assets');
      await connect(page, h.main()); await frames(page); const assetsWaiting = await page.evaluate(() => window.bootFacts());
      check(!assetsWaiting.hidden && !assetsWaiting.menuActive, `${width}/${dpr}/${navigation}: loading covers missing core PNG`);
      if (navigation === 'cold') await capture(page, `${width}x${height}-dpr${dpr}-loading`);
      assetGate.resolve(); const success = await completed(page); const hides = success.trace.hidden.filter(v => v.assigned);
      check(hides.length > 0, `${width}/${dpr}/${navigation}: loading has real handoff`);
      if (mode === 'after') check(hides.every(v => v.menuActive && v.rendered), `${width}/${dpr}/${navigation}: every successful hide follows visible menu render`);
      else check(hides.some(v => !v.menuActive || !v.rendered), 'baseline: loading hidden before menu background submitted');
      check(success.facts.webgl && success.facts.rendered, `${width}/${dpr}/${navigation}: real WebGL menu is visible`);
      entry.navigations.push({ navigation, moduleWaiting, assetsWaiting, success });
    }
    await capture(page, `${width}x${height}-dpr${dpr}-menu`);
    if (mode === 'after') {
      await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'isolated post-start gameplay error' })));
      await frames(page); check(await page.locator('#loading-screen').evaluate(el => el.hidden), `${width}/${dpr}: later gameplay error does not reopen startup UI`);
    }
    check(h.errors.length === 0, `${width}/${dpr}: no unexpected page error`); entry.errors = h.errors; report.profiles.push(entry); await h.context.close();
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
  // Throw from the real MenuScene.create after module import has completed.
  {
    const h = await contextFor(896, 414, 1); const { page } = h; const assetGate = deferred();
    await page.route(assetPattern, async route => { await assetGate.promise; await route.continue(); });
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.querySelector('#loading-screen')?.dataset.stage === 'assets');
    await connect(page, h.main());
    await page.evaluate(() => { const scene = window.g.scene.getScene('MenuScene'); const create = scene.create; scene.create = function (...args) { scene.create = create; throw Error('isolated MenuScene.create startup failure'); }; });
    assetGate.resolve(); await page.waitForFunction(() => window.bootTrace.errors.some(v => v.includes('isolated MenuScene.create'))); await frames(page);
    const fault = await page.evaluate(() => ({ facts: window.bootFacts(), trace: window.bootTrace, retryVisible: !document.querySelector('.loading-retry').hidden }));
    if (mode === 'before') {
      check(fault.facts.hidden && !fault.facts.rendered && !fault.retryVisible, 'baseline: async menu failure leaves loading hidden with no retry');
      await capture(page, 'startup-failure-uncovered');
    }
    else {
      check(!fault.facts.hidden && fault.facts.stage === 'error' && fault.retryVisible, 'startup scene exception remains covered by clear DOM retry UI');
      await capture(page, 'startup-failure-retry');
      await page.touchscreen.tap(448, 20); check(await page.locator('.loading-retry').isVisible(), 'outside touch cannot dismiss startup error');
      const button = await page.locator('.loading-retry').boundingBox();
      const reloaded = page.waitForEvent('domcontentloaded'); await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2); await reloaded;
      await page.waitForFunction(() => ['assets', 'preparing', 'ready'].includes(document.querySelector('#loading-screen')?.dataset.stage));
      await connect(page, h.main()); const recovered = await completed(page); check(recovered.facts.rendered, 'touch reload recovers after injected one-context startup failure'); fault.recovered = recovered;
      await capture(page, 'startup-failure-recovered');
    }
    report.faults.menuCreate = { ...fault, errors: h.errors }; await h.context.close();
  }
  // Existing missing-local-resource retry must still work without loaded art.
  if (mode === 'after') {
    const h = await contextFor(844, 390, 2); const { page } = h; let fail = true;
    await page.route(assetPattern, route => fail ? route.abort() : route.continue());
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('game-status')?.textContent.includes('加载失败')); await connect(page, h.main());
    check(await page.locator('#loading-screen').evaluate(el => el.hidden), 'missing local asset exposes independent Phaser resource retry');
    const point = await buttonPoint(page, 'PreloadScene', 'button:重试'); await capture(page, 'missing-core-resource-retry'); fail = false; await page.touchscreen.tap(point.x, point.y);
    const recovered = await completed(page); check(recovered.facts.rendered, 'existing resource retry reaches real menu render');
    report.faults.resource = { recovered, errors: h.errors }; await h.context.close();
  }
  const colors = {};
  for (const path of ['style.css', 'src/game/GameConfig.ts', 'capacitor.config.ts', 'android/app/src/main/java/com/sheeprun/game/MainActivity.java', 'android/app/src/main/res/values/styles.xml']) colors[path] = (await readFile(path, 'utf8')).split('\n').filter(line => /background|Color\.rgb|SplashScreenBackground/.test(line));
  report.nativeSourceColors = { currentWorkingSource: colors, notPackagedOrDeviceValidated: true };
  report.passed = true;
} catch (error) { report.failure = error.stack || String(error); process.exitCode = 1; }
finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, mode, profiles: report.profiles.length, checks: report.checks.length, screenshots: report.screenshots.length, failure: report.failure }));
