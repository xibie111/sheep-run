import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Isolated acceptance harness. This file is never imported by the production app.
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.RESIDENT_QA_URL ?? 'http://127.0.0.1:4384/';
const expectedMain = process.env.RESIDENT_QA_MAIN ?? 'main-BZRohG9M.js';
const expectedSha256 = process.env.RESIDENT_QA_SHA256;
const output = path.resolve(process.env.RESIDENT_RECOVERY_QA_OUT ?? 'docs/resident-stories-v1/recovery-browser');
await mkdir(output, { recursive: true });
const assetSource = await readFile(new URL('../../src/residents/residentAssets.ts', import.meta.url), 'utf8');
const assets = [...assetSource.matchAll(/\{ key: '([^']+)', url: new URL\('[^']+', import\.meta\.url\)\.href, width: (\d+), height: (\d+) \}/g)]
  .map(([, key, width, height]) => ({ key, width: Number(width), height: Number(height) }));
const keys = ['sheep-run-delivery-v1', 'sheep-run-mailbox-v1', 'sheep-run-delivery-challenges-v1'];
const report = { passed: false, url, expectedMain, engine: 'Headless Microsoft Edge; mobile touch emulation; software WebGL', phoneHardware: false,
  method: 'Real immutable production app. Actual touchscreen taps. Explicit isolated request-failure and localStorage fixtures; no route simulation or production test hooks.', cases: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let active;
function check(name, passed, detail) { active.checks.push({ name, passed: !!passed, detail }); if (!passed) throw new Error(name + ': ' + JSON.stringify(detail)); }
async function open(id, fixture = {}, failPng = false) {
  const result = { id, checks: [], pageErrors: [], consoleErrors: [], expectedInjectedErrors: [], fixture, interceptedRequests: [] };
  report.cases.push(result); active = result;
  const context = await browser.newContext({ viewport: { width: 896, height: 414 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') {
    const entry = { text: message.text(), location: message.location() };
    if (failPng && /404/.test(message.text()) && result.interceptedRequests.includes(entry.location.url)) result.expectedInjectedErrors.push(entry); else result.consoleErrors.push(entry);
  } });
  await page.addInitScript(({ fixture, keys }) => {
    for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, value);
    window.residentRecoveryWrites = [];
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (keys.includes(key)) window.residentRecoveryWrites.push({ key, value }); return real.call(this, key, value); };
  }, { fixture, keys });
  let rejected = false;
  if (failPng) await context.route('**/*', route => {
    // Vite deduplicates the identical NPC/portrait bytes to the NPC filename.
    if (!rejected && /\/ahe-npc-[^/]+\.png(?:\?.*)?$/.test(route.request().url())) {
      rejected = true; result.interceptedRequests.push(route.request().url());
      return route.fulfill({ status: 404, body: 'Deliberate resident recovery acceptance fixture', contentType: 'text/plain' });
    }
    return route.continue();
  });
  const mainRequest = page.waitForRequest(request => /\/assets\/main-[^/]+\.js$/.test(request.url()), { timeout: 60000 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  result.main = (await mainRequest).url();
  check('frozen production bundle matches requested snapshot', result.main.endsWith('/' + expectedMain), result.main);
  result.mainSha256 = createHash('sha256').update(await (await page.request.get(result.main)).body()).digest('hex');
  if (expectedSha256) check('frozen production bundle SHA256 matches supplied build', result.mainSha256 === expectedSha256, result.mainSha256);
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, result.main);
  return { page, context, result };
}
async function menu(f) {
  await f.page.waitForFunction(() => window.g?.scene.isActive('MenuScene') && window.g.scene.getScene('MenuScene').children.list.some(o => o.name === 'mailbox-entry'), null, { timeout: 90000 });
  await f.page.waitForTimeout(100);
}
async function point(f, name, sceneKey = 'MenuScene') {
  return f.page.evaluate(({ name, sceneKey }) => {
    const all = list => list.flatMap(o => [o, ...(o.list ? all(o.list) : [])]);
    const item = all(window.g.scene.getScene(sceneKey).children.list).find(o => o.name === name && o.input?.enabled);
    if (!item) throw new Error('No enabled touch target ' + name);
    const box = item.getBounds(), rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: rect.x + box.centerX / size.width * rect.width, y: rect.y + box.centerY / size.height * rect.height };
  }, { name, sceneKey });
}
async function tap(f, name, sceneKey) { const p = await point(f, name, sceneKey); await f.page.touchscreen.tap(p.x, p.y); await f.page.waitForTimeout(100); }
async function screen(f, name) { await f.page.screenshot({ path: path.join(output, name + '.png') }); f.result.screenshots ??= []; f.result.screenshots.push(name + '.png'); }
async function verifyTextures(f) {
  const data = await f.page.evaluate(assets => {
    const gl = window.g.renderer.gl, old = gl.getParameter(gl.TEXTURE_BINDING_2D);
    try { return assets.map(asset => {
      if (!window.g.textures.exists(asset.key)) return { key: asset.key, missing: true };
      const texture = window.g.textures.get(asset.key), source = texture.getSourceImage();
      const filters = texture.source.map(source => { gl.bindTexture(gl.TEXTURE_2D, source.glTexture.webGLTexture); return {
        sourceNearest: source.scaleMode === 1, minNearest: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER) === gl.NEAREST,
        magNearest: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER) === gl.NEAREST }; });
      return { key: asset.key, size: [source.width, source.height], expected: [asset.width, asset.height], filters };
    }); } finally { gl.bindTexture(gl.TEXTURE_2D, old); }
  }, assets);
  check(`all ${assets.length} resident textures load at authored sizes with actual WebGL NEAREST filters`, data.length === assets.length && data.every(item => !item.missing && item.size.join() === item.expected.join() && item.filters.every(f => f.sourceNearest && f.minNearest && f.magNearest)), data);
}
async function finish(f) {
  check('zero unexpected runtime exceptions', f.result.pageErrors.length === 0, f.result.pageErrors);
  check('zero unexpected console errors', f.result.consoleErrors.length === 0, f.result.consoleErrors);
  await f.context.close();
}
try {
  const f = await open('single-png-failure-touch-retry', {}, true);
  await f.page.waitForFunction(() => window.g?.scene.getScene('PreloadScene').children.list.some(o => o.name === 'local-load-error'), null, { timeout: 90000 });
  check('exactly one resident PNG request received an injected 404', f.result.interceptedRequests.length === 1, f.result.interceptedRequests);
  check('resource failure prevents entering MenuScene', await f.page.evaluate(() => !window.g.scene.isActive('MenuScene') && window.g.scene.isActive('PreloadScene')));
  await screen(f, 'resource-error-before-retry');
  const retry = await point(f, 'button:重试', 'PreloadScene');
  await f.page.mouse.click(retry.x, retry.y); await f.page.waitForTimeout(150);
  check('non-touch mouse click does not retry', await f.page.evaluate(() => window.g.scene.getScene('PreloadScene').children.list.some(o => o.name === 'local-load-error')));
  await tap(f, 'button:重试', 'PreloadScene'); await menu(f);
  check('actual touch retry reaches MenuScene', await f.page.evaluate(() => window.g.scene.isActive('MenuScene')));
  await verifyTextures(f); await screen(f, 'resource-retry-recovered-menu');
  check('injected 404 console error explicitly classified', f.result.expectedInjectedErrors.length === 1, f.result.expectedInjectedErrors);
  await finish(f);
  const fixtures = {
    corrupt: { [keys[0]]: '{broken delivery bytes', [keys[1]]: '{"version":1,"readIds":[null]}', [keys[2]]: '{"version":1,"chapters":{"windmill-invitation-v1":{"stars":99,"keepsake":true}}}' },
    future: { [keys[0]]: '{ "version":9,"completedIds":["future-route-v9"],"future":{"keep":true} }', [keys[1]]: '{ "version":9,"readIds":["future-letter-v9"],"future":{"keep":true} }', [keys[2]]: '{ "version":9,"chapters":{"future-route-v9":{"stars":7}},"future":{"keep":true} }' },
  };
  for (const [id, fixture] of Object.entries(fixtures)) {
    const f = await open('write-protection-' + id, fixture); await menu(f);
    await tap(f, 'mailbox-entry'); await tap(f, 'mailbox-residents');
    check('actual touch entered residents from mailbox', await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'residents'));
    await tap(f, 'resident-resident:windmill-keeper-v1');
    await screen(f, 'protected-' + id + '-resident');
    const state = await f.page.evaluate(keys => ({ values: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), writes: window.residentRecoveryWrites }), keys);
    check('all protected archive bytes remain exact after resident entry', JSON.stringify(state.values) === JSON.stringify(fixture), state.values);
    check('no protected archive write attempted', state.writes.length === 0, state.writes);
    await tap(f, 'resident-back'); await tap(f, 'resident-back');
    check('nested resident close restores mailbox owner', await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'mailbox'));
    await tap(f, 'button:合上邮箱');
    check('mailbox close releases all modal ownership', await f.page.evaluate(() => !window.g.scene.getScene('MenuScene').data.get('menu-modal-owner')));
    await finish(f);
  }
  if (process.env.RESIDENT_RECOVERY_ART === '1') {
    const residents = [
      { id: 'windmill-keeper-v1', slug: 'windmill', chapters: ['windmill-invitation-v1', 'windmill-thanks-v1', 'windmill-photo-v1'] },
      { id: 'riverside-neighbor-v1', slug: 'riverside', chapters: ['rainy-umbrella-v1', 'riverside-thanks-v1', 'riverside-sunshine-v1'] },
      { id: 'lighthouse-keeper-v1', slug: 'lighthouse', chapters: ['lighthouse-starlight-v1', 'lighthouse-old-letter-v1', 'lighthouse-gathering-v1'] },
    ];
    const fixture = { [keys[0]]: JSON.stringify({ version: 1, completedIds: residents.flatMap(r => r.chapters) }),
      [keys[1]]: JSON.stringify({ version: 1, readIds: [] }), [keys[2]]: JSON.stringify({ version: 1, chapters: {} }) };
    const f = await open('menu-style-art-actual-ui-with-isolated-completion-fixture', fixture); await menu(f);
    await tap(f, 'mailbox-entry'); await tap(f, 'mailbox-residents');
    const inspectArt = async (kind, name) => {
      const state = await f.page.locator(`[data-adventure-overlay="${kind}"]:visible`).last().evaluate(canvas => ({ ...canvas.dataset }));
      const images = JSON.parse(state.images);
      check(name + ': actual UI draws authored illustration with uniform scale', images.length > 0 && images.every(image => Math.abs(image.width / image.height - image.sourceWidth / image.sourceHeight) < 1e-6), images);
      await screen(f, name);
    };
    for (const resident of residents) {
      await tap(f, 'resident-resident:' + resident.id); await tap(f, 'resident-keepsake');
      await inspectArt('resident-panel', resident.slug + '-keepsake'); await tap(f, 'resident-back');
      for (const stageIndex of [1, 2]) {
        await tap(f, 'resident-stage:' + stageIndex); await tap(f, 'resident-brief'); await tap(f, 'delivery-card');
        await inspectArt('delivery-panel', resident.chapters[stageIndex] + '-postcard');
        await tap(f, 'delivery-back'); await tap(f, 'delivery-back');
        check(resident.chapters[stageIndex] + ': postcard and brief release back to resident lease', await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'residents'));
      }
      await tap(f, 'resident-back');
    }
    await tap(f, 'resident-group'); await inspectArt('resident-panel', 'group-photo'); await tap(f, 'resident-back');
    await tap(f, 'resident-back'); await tap(f, 'button:合上邮箱');
    check('all art modals release ownership after repeated nested visits', await f.page.evaluate(() => !window.g.scene.getScene('MenuScene').data.get('menu-modal-owner')));
    const state = await f.page.evaluate(keys => ({ values: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), writes: window.residentRecoveryWrites }), keys);
    check('art browsing fabricates no read marks or challenge stars and changes no archive bytes', JSON.stringify(state.values) === JSON.stringify(fixture) && state.writes.length === 0, state);
    await finish(f);
  }
  report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.map(c => ({ id: c.id, checks: c.checks.length, failed: c.checks.filter(x => !x.passed) })), failure: report.failure, report: path.join(output, 'report.json') }, null, 2));
