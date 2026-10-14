import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.resolve(process.env.ORIGINAL_SMOKE_OUT ?? 'docs/resident-stories-v1/original-touch-smoke-final-menu-style');
await mkdir(output, { recursive: true });
const report = { passed: false, url: 'http://127.0.0.1:4386/', profile: { width: 896, height: 414, dpr: 1 },
  method: 'Independent fresh Edge touch context. Actual mouse and touchscreen input, read-only game state observation; no progress fixtures or production hooks.',
  phoneHardware: false, checks: [], errors: [], consoleErrors: [], consoleWarnings: [], screenshots: [], taps: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('crash', () => report.errors.push('Browser renderer crashed'));
page.on('console', message => {
  if (message.type() === 'error') report.consoleErrors.push(message.text());
  if (message.type() === 'warning' && report.consoleWarnings.length < 20) report.consoleWarnings.push(message.text());
});
function check(name, passed, detail) {
  report.checks.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) });
  if (!passed) throw new Error(name + ': ' + JSON.stringify(detail));
}
async function state() {
  return page.evaluate(() => {
    const g = window.g, run = g.scene.getScene('RunScene');
    return { menu: g.scene.isActive('MenuScene'), wardrobe: g.scene.isActive('WardrobeScene'),
      run: g.scene.isActive('RunScene'), paused: g.scene.isPaused('RunScene'), pause: g.scene.isActive('PauseScene'),
      time: run.activeRunTimeMs, deliveryId: run.data?.get('delivery-id') ?? null,
      sheep: run.sheep?.active ? { y: run.sheep.y, vy: run.sheep.body.velocity.y, motion: run.sheep.motionState } : null };
  });
}
async function point(sceneName, name) {
  return page.evaluate(({ sceneName, name }) => {
    const scene = window.g.scene.getScene(sceneName);
    const collect = list => list.flatMap(item => [item, ...(item.list ? collect(item.list) : [])]);
    const target = collect(scene.children.list).find(item => item.name === name && item.input?.enabled);
    if (!target) throw new Error('Missing active target ' + name);
    const box = target.getBounds(), rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: rect.x + box.centerX / size.width * rect.width, y: rect.y + box.centerY / size.height * rect.height,
      logical: { x: box.x, y: box.y, width: box.width, height: box.height }, input: { x: target.input.hitArea.x, y: target.input.hitArea.y, width: target.input.hitArea.width, height: target.input.hitArea.height } };
  }, { sceneName, name });
}
async function tap(sceneName, name) { const p = await point(sceneName, name); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(100); report.taps.push({ sceneName, name, point: p, after: await state() }); }
async function active(sceneName) { await page.waitForFunction(name => window.g.scene.isActive(name), sceneName); }
async function screenshot(name) { await page.screenshot({ path: path.join(output, name) }); report.screenshots.push(name); }
try {
  const requested = page.waitForRequest(request => /\/assets\/main-[^/]+\.js$/.test(request.url()));
  await page.goto(report.url, { waitUntil: 'domcontentloaded' });
  report.mainModule = (await requested).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, report.mainModule);
  await active('MenuScene');
  await page.waitForTimeout(80);
  check('frozen production revision', report.mainModule.endsWith('/main-DRAtxdjq.js'), report.mainModule);
  const start = await point('MenuScene', 'button:开始游戏');
  await page.mouse.click(start.x, start.y);
  await page.waitForTimeout(160);
  let s = await state();
  check('mouse start leaves MenuScene active and RunScene inactive', s.menu && !s.run, s);
  await tap('MenuScene', 'button:衣橱'); await active('WardrobeScene');
  s = await state(); check('touch wardrobe opens WardrobeScene', s.wardrobe && !s.menu, s);
  await screenshot('wardrobe-wide-touch.png');
  await tap('WardrobeScene', 'button:返回'); await active('MenuScene');
  s = await state(); check('touch wardrobe return opens menu', s.menu && !s.wardrobe, s);
  await tap('MenuScene', 'button:开始游戏'); await active('RunScene');
  s = await state(); check('touch start opens ordinary RunScene', s.run && !s.menu && s.deliveryId === null, s);
  await page.evaluate(() => {
    const run = window.g.scene.getScene('RunScene');
    window.smokeSamples = [];
    window.smokeObserve = () => window.smokeSamples.push({ y: run.sheep.y, vy: run.sheep.body.velocity.y,
      motion: run.sheep.motionState, crouching: run.sheep.crouching, dashing: run.sheep.dashing,
      pending: run.inputSystem.pendingActions.length });
    run.events.on('postupdate', window.smokeObserve);
  });
  await page.mouse.click(500, 250);
  await page.waitForTimeout(300);
  const samples = await page.evaluate(() => {
    window.g.scene.getScene('RunScene').events.off('postupdate', window.smokeObserve);
    return window.smokeSamples;
  });
  check('mouse gameplay tap does not jump, crouch, dash or enqueue gestures', samples.length >= 3 && samples.every(sample =>
    sample.motion === 'RUNNING' && sample.vy >= 0 && !sample.crouching && !sample.dashing && sample.pending === 0)
    && Math.max(...samples.map(sample => sample.y)) - Math.min(...samples.map(sample => sample.y)) < .5, samples);
  await tap('RunScene', 'button:暂停'); await active('PauseScene');
  s = await state(); check('touch pause pauses RunScene and opens PauseScene', s.paused && s.pause && !s.run, s);
  await screenshot('pause-wide-landscape.png');
  await tap('PauseScene', 'button:继续游戏'); await active('RunScene');
  s = await state(); check('touch continue resumes RunScene and closes pause', s.run && !s.pause && !s.paused, s);
  await tap('RunScene', 'button:暂停'); await active('PauseScene');
  await page.evaluate(() => { window.oldSmokeSheep = window.g.scene.getScene('RunScene').sheep; });
  await tap('PauseScene', 'button:重新开始'); await active('RunScene');
  s = await state();
  const recreated = await page.evaluate(() => window.g.scene.getScene('RunScene').sheep !== window.oldSmokeSheep);
  check('touch restart recreates ordinary run and closes pause', s.run && !s.pause && s.deliveryId === null && recreated, { ...s, recreated });
  await tap('RunScene', 'button:暂停'); await active('PauseScene');
  await tap('PauseScene', 'button:返回首页'); await active('MenuScene');
  s = await state(); check('touch home stops run and pause and returns menu', s.menu && !s.run && !s.pause, s);
  check('no runtime exceptions', report.errors.length === 0, report.errors);
  check('no console errors', report.consoleErrors.length === 0, report.consoleErrors);
  report.passed = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
  report.finalState = await state().catch(error => String(error));
  await screenshot('failure.png').catch(() => {});
  process.exitCode = 1;
} finally {
  await context.close(); await browser.close();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, errors: report.errors, failure: report.failure, output }));
}
