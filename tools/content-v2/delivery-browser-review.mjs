import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.DELIVERY_REVIEW_URL ?? 'http://127.0.0.1:4334/tools/content-v2/delivery-preview.html';
const output = path.resolve('docs/content-update-v2/delivery/browser'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { kind: 'isolated-mobile-browser-fixture-not-phone', base, cases: [] };
try {
  for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    const assert = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
    await page.goto(base); await page.waitForFunction(() => window.deliveryFixtureReady, { timeout: 30000 });
    const read = () => page.locator('[data-adventure-overlay="delivery-panel"]').evaluate(canvas => ({ ...canvas.dataset }));
    const tap = async index => {
      const point = await page.evaluate(i => { const canvas = document.querySelector('[data-adventure-overlay="delivery-panel"]'), box = JSON.parse(canvas.dataset.targets)[i], rect = window.deliveryGame.canvas.getBoundingClientRect(), size = window.deliveryGame.scale.gameSize; return { x: rect.x + (box.x + box.width / 2) / size.width * rect.width, y: rect.y + (box.y + box.height / 2) / size.height * rect.height }; }, index);
      await page.touchscreen.tap(point.x, point.y); await page.waitForTimeout(60); return point;
    };
    let state = await read(); assert('selection starts with original chapter', state.chapterId === 'hill-goodnight-v1');
    await tap(5); state = await read(); assert('touch chooses dinner chapter', state.chapterId === 'dinner-for-you-v1');
    assert('modal owns input', await page.evaluate(() => window.deliveryModalOwner()) === 'delivery');
    assert('local font complete', (await page.evaluate(() => window.deliveryFontMissing)).length === 0, await page.evaluate(() => window.deliveryFontMissing));
    const lines = JSON.parse(state.lines), panel = JSON.parse(state.panel);
    assert('text inks stay in intended boxes', lines.every(line => line.ink.x >= line.box.x - 1 && line.ink.y >= line.box.y - 1 && line.ink.x + line.ink.width <= line.box.x + line.box.width + 1 && line.ink.y + line.ink.height <= line.box.y + line.box.height + 1));
    assert('panel fits logical viewport', await page.evaluate(box => box.x >= 0 && box.y >= 0 && box.x + box.width <= window.deliveryGame.scale.gameSize.width && box.y + box.height <= window.deliveryGame.scale.gameSize.height, panel));
    const locked = await page.evaluate(() => window.deliveryFixture.children.getByName('delivery-card').input.enabled);
    assert('locked postcard disabled', !locked);
    await page.screenshot({ path: path.join(output, `select-${width}x${height}-dpr${dpr}.png`) });
    const rect = await page.evaluate(() => { const canvas = window.deliveryGame.canvas.getBoundingClientRect(); return { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height, scroll: document.documentElement.scrollHeight > innerHeight }; });
    assert('full screen canvas and no scrolling', Math.abs(rect.x) < 1 && Math.abs(rect.y) < 1 && Math.abs(rect.width - width) < 1 && Math.abs(rect.height - height) < 1 && !rect.scroll, rect);
    const cdp = await context.newCDPSession(page);
    const p = await page.evaluate(() => { const canvas = document.querySelector('[data-adventure-overlay="delivery-panel"]'), box = JSON.parse(canvas.dataset.targets)[4], rect = window.deliveryGame.canvas.getBoundingClientRect(), size = window.deliveryGame.scale.gameSize; return { x: rect.x + (box.x + box.width / 2) / size.width * rect.width, y: rect.y + (box.y + box.height / 2) / size.height * rect.height }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await page.waitForTimeout(30);
    assert('touch cancellation keeps selection', (await read()).chapterId === 'dinner-for-you-v1');
    const startPoint = await page.evaluate(() => { const canvas = document.querySelector('[data-adventure-overlay="delivery-panel"]'), box = JSON.parse(canvas.dataset.targets)[2], rect = window.deliveryGame.canvas.getBoundingClientRect(), size = window.deliveryGame.scale.gameSize; return { x: rect.x + (box.x + box.width / 2) / size.width * rect.width, y: rect.y + (box.y + box.height / 2) / size.height * rect.height }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startPoint.x, y: startPoint.y }] });
    await page.evaluate(() => window.deliveryFixture.scene.pause()); await page.waitForTimeout(30);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => window.deliveryFixture.scene.resume()); await page.waitForTimeout(30);
    assert('pause cancels held touch and restores unpressed panel', await page.evaluate(() => window.deliveryFixture.starts.length === 0) && JSON.parse((await read()).pressed).length === 0);
    await tap(2); assert('start callback gets selected chapter exactly once', await page.evaluate(() => JSON.stringify(window.deliveryFixture.starts)) === JSON.stringify(['dinner-for-you-v1']));
    assert('closing restores parent modal input', await page.evaluate(() => window.deliveryModalOwner() === 'mailbox' && window.deliveryFixture.under.input.enabled));
    await page.evaluate(() => window.deliveryFixture.unlock()); await tap(3); assert('unlocked postcard can reopen', (await read()).mode === 'postcard');
    await page.screenshot({ path: path.join(output, `postcard-${width}x${height}-dpr${dpr}.png`) });
    await tap(1); assert('postcard returns to chapter selector', (await read()).mode === 'select');
    for (const mode of ['brief', 'failure', 'success']) {
      await page.evaluate(mode => window.deliveryFixture.show(mode), mode);
      await page.screenshot({ path: path.join(output, `${mode}-${width}x${height}-dpr${dpr}.png`) });
      assert(`${mode} uses selected chapter`, (await read()).chapterId === 'dinner-for-you-v1');
    }
    await page.evaluate(() => window.deliveryFixture.showRoute(12000)); await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(output, `route-${width}x${height}-dpr${dpr}.png`) });
    await page.evaluate(() => window.deliveryFixture.showRoute(18000, 2100, true)); await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(output, `ending-${width}x${height}-dpr${dpr}.png`) });
    assert('reduced-motion ending illustration visible', await page.evaluate(() => window.deliveryFixture.children.getByName('delivery-sharing-dinner').alpha === 1));
    const beforeClear = await page.evaluate(() => ({ postrender: window.deliveryGame.events.listenerCount('postrender'), pause: window.deliveryFixture.events.listenerCount('pause'), resume: window.deliveryFixture.events.listenerCount('resume') }));
    await page.evaluate(() => window.deliveryFixture.panel.clear()); await page.waitForTimeout(30);
    assert('manual panel clear removes own render/pause/resume listeners', await page.evaluate(before => window.deliveryGame.events.listenerCount('postrender') === before.postrender - 1 && window.deliveryFixture.events.listenerCount('pause') === before.pause - 2 && window.deliveryFixture.events.listenerCount('resume') === before.resume - 1, beforeClear));
    await page.evaluate(() => window.deliveryFixture.clearFixture()); await page.waitForTimeout(30);
    assert('scene clears panel surfaces and delivery objects', await page.locator('[data-adventure-overlay="delivery-panel"]').count() === 0 && await page.evaluate(() => window.deliveryFixture.children.list.length === 0));
    assert('no browser runtime errors', errors.length === 0, errors);
    report.cases.push({ width, height, dpr, errors, checks }); await context.close();
  }
} finally { await browser.close(); }
report.passed = report.cases.length === 8 && report.cases.every(item => item.checks.every(check => check.passed));
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, checks: report.cases.reduce((count, item) => count + item.checks.length, 0), failures: report.cases.flatMap(item => item.checks.filter(check => !check.passed).map(check => ({ viewport: `${item.width}x${item.height}@${item.dpr}`, ...check }))) }, null, 2));
if (!report.passed) process.exitCode = 1;
