/** Normal AUTO/WebGL integration supplement. Independent ephemeral QA data. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.SKIN_V4_REVIEW_URL || 'http://127.0.0.1:4343/';
const output = new URL('../../docs/skins-v4/webgl-play/', import.meta.url);
await mkdir(output, { recursive: true });
const ids = ['strawberry-v1', 'lemon-v1', 'sailor-v1', 'starlight-v1', 'postman-v1', 'raincoat-v1', 'explorer-v1', 'astronaut-v1'];
const chapters = ['hill-goodnight-v1', 'dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'];
const saveFixture = (id, lead = id) => ({ version: 5, highScore: 12345, totalStars: 360, spentStars: 360, coins: 0, selectedSkin: lead, unlockedSkins: ['white', id], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } });
const report = { passed: false, url, viewport: { width: 896, height: 414, dpr: 2 }, renderer: 'Normal production AUTO/WebGL, not forced Canvas', phoneHardware: false,
  methods: {
    ordinary: 'Only real production touch entry and jump. Wait for a natural collision to show ResultScene, then real touch opens the trip card. No changes to physics, speed, obstacle/star generation, input, collision, clock or score. This is a short visual integration run, not a long-run challenge acceptance.',
    companion: 'An isolated localStorage fixture owns white plus the tested skin and equips white. The existing controller is run against an authored safe-gap fixture, at 25,000ms eligibility and 26,200ms following time; move its spawned bell onto the lead to invoke real collect/selection/event path. Physics and normal scene updates are frozen only in that named rendering fixture. No companion view is manually constructed, no body/rewards are added, and actual pause/menu touch exit must clear every object.',
    delivery: 'An isolated save equips the tested skin. Real mailbox, route pagination, brief and start touches enter one of all five current chapters, then a real tap jumps in the original delivery runner. This proves starting/rendering integration, not full route completion or challenge rewards.',
    persistence: 'Ephemeral Playwright contexts only. Never accesses a user browser profile or rewrites a player save. No edits to production or shared QA, no dist/build/font writes.' },
  checks: [], screenshots: [], views: [], runtimeErrors: [], current: null };
const check = (condition, label) => { assert(condition, label); report.checks.push(label); };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
let activePage;

async function frames(page, count = 2) {
  await page.evaluate(count => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { window.g.events.off('postrender', after); reject(new Error('Render stopped')); }, 7000);
    const after = () => { if (!--count) { clearTimeout(timeout); window.g.events.off('postrender', after); resolve(); } };
    window.g.events.on('postrender', after);
  }), count);
}
async function ready(page, key) { await page.waitForFunction(key => window.g.scene.isActive(key) && window.g.scene.getScene(key).children.list.length > 0, key, { timeout: 45000 }); await frames(page); }
async function target(page, key, name, optional = false) {
  return page.evaluate(({ key, name, optional }) => {
    const scene = window.g.scene.getScene(key), find = list => { for (const o of list) { if (o.name === name) return o; const nested = o.list && find(o.list); if (nested) return nested; } };
    const o = find(scene.children.list); if (!o) { if (optional) return null; throw new Error(`Missing ${key}/${name}`); }
    const b = o.getBounds(), box = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: box.x + (b.centerX - scene.cameras.main.scrollX * o.scrollFactorX) * box.width / size.width,
      y: box.y + (b.centerY - scene.cameras.main.scrollY * o.scrollFactorY) * box.height / size.height, enabled: o.input?.enabled === true };
  }, { key, name, optional });
}
async function tap(page, key, name) { const p = await target(page, key, name); check(p.enabled, `${report.current.id}/${report.current.stage}: real ${name} touch target enabled`); await page.touchscreen.tap(p.x, p.y); await frames(page); }
async function gameplayTap(page) { const p = await page.evaluate(() => { const box = window.g.canvas.getBoundingClientRect(); return { x: box.x + box.width * .7, y: box.y + box.height * .52 }; }); await page.touchscreen.tap(p.x, p.y); }
async function screenshot(page, id, name) { await frames(page); const path = `${id}-${name}.png`; await page.screenshot({ path: fileURLToPath(new URL(path, output)), scale: 'css' }); report.screenshots.push(path); }
async function facts(page) { return page.evaluate(() => {
  const scene = window.g.scene.getScene('RunScene'), p = scene.sheep, b = p.body;
  return { renderer: window.g.renderer.type, selected: scene.selectedSkin, key: p.texture.key, frame: Number(p.frame.name), state: p.motionState, visible: p.visible, active: p.active, width: p.displayWidth, height: p.displayHeight,
    scaleX: p.scaleX, scaleY: p.scaleY, body: { width: b.width, height: b.height, bottom: b.bottom, velocityY: b.velocity.y }, clock: scene.activeRunTimeMs, chapter: scene.delivery?.chapter.id, filter: p.texture.source[0].scaleMode, finished: scene.finished };
}); }
function verifyStanding(id, data, chapter) {
  check(data.renderer === 2, `${id}: production AUTO selects WebGL`);
  check(data.selected === id && data.key === `sheep-runner-${id}` && data.visible && data.active, `${id}: actual equipped visible sheep renders`);
  check(data.width === 48 && data.height === 42 && data.body.width === 30 && data.body.height === 30 && Math.abs(data.body.bottom - 218) < .5, `${id}: unchanged main display/body/ground baseline`);
  check(Math.abs(data.scaleX - data.scaleY) < .00001 && data.filter === 1, `${id}: proportional nearest-neighbor skin texture`);
  if (chapter) check(data.chapter === chapter, `${id}: actual ${chapter} delivery runner`);
}
async function seedMenu(page, fixture) {
  await page.evaluate(fixture => {
    for (const key of ['PauseScene', 'RunScene', 'ResultScene', 'WardrobeScene', 'MenuScene']) window.g.scene.stop(key);
    localStorage.setItem('sheep-run-save', JSON.stringify(fixture)); window.g.scene.start('MenuScene');
  }, fixture);
  await ready(page, 'MenuScene');
}

try {
  for (const [index, id] of ids.entries()) {
    report.current = { id, stage: 'ordinary' };
    const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage(); activePage = page;
    page.on('pageerror', error => report.runtimeErrors.push({ id, stage: report.current?.stage, message: error.message }));
    await page.addInitScript(fixture => { localStorage.setItem('sheep-run-save', JSON.stringify(fixture)); }, saveFixture(id));
    const requested = page.waitForRequest(request => /\/assets\/main-[^/]+\.js(?:\?.*)?$/.test(request.url()));
    await page.goto(url, { waitUntil: 'domcontentloaded' }); const main = (await requested).url();
    await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, main);
    await ready(page, 'MenuScene');
    const view = { id, main, ordinary: {}, portrait: {}, companion: {}, delivery: {} }; report.views.push(view);
    await tap(page, 'MenuScene', 'button:开始游戏'); await ready(page, 'RunScene');
    view.ordinary.running = await facts(page); verifyStanding(id, view.ordinary.running);
    await screenshot(page, id, 'ordinary-running');
    await gameplayTap(page);
    await page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'JUMPING' && Number(p.frame.name) === 5 && p.body.velocity.y < 0; }, null, { timeout: 5000 });
    view.ordinary.jump = await facts(page);
    check(view.ordinary.jump.key === `sheep-runner-${id}` && view.ordinary.jump.frame === 5 && view.ordinary.jump.body.velocityY < 0, `${id}: real ordinary touchscreen jump changes pose and physical velocity`);
    await screenshot(page, id, 'ordinary-jump');
    // No synthetic hit callback: the unhandled next real obstacle ends this run.
    await ready(page, 'ResultScene');
    view.ordinary.ended = await page.evaluate(() => window.g.scene.getScene('ResultScene').result);
    check(view.ordinary.ended.leadSkin === id, `${id}: natural collision result preserves this actual lead skin`);
    await tap(page, 'ResultScene', 'button:查看这次旅行');
    view.portrait = await page.locator('[data-content-v2-overlay="trip-card"]').evaluate(canvas => ({ model: JSON.parse(canvas.dataset.model), visible: canvas.dataset.portraitVisible, display: canvas.style.display, width: canvas.width, cssWidth: parseFloat(canvas.style.width), smoothing: canvas.getContext('2d').imageSmoothingEnabled }));
    check(view.portrait.model.protagonist.id === id && view.portrait.visible === 'true' && view.portrait.display === 'block' && !view.portrait.smoothing && view.portrait.width === Math.round(view.portrait.cssWidth * 2), `${id}: real trip card paints the correct actual portrait at DPR2`);
    await screenshot(page, id, 'actual-trip-portrait');
    await tap(page, 'ResultScene', 'button:收好旅行卡'); await tap(page, 'ResultScene', 'button:返回牧场'); await ready(page, 'MenuScene');

    report.current.stage = 'companion-fixture';
    await seedMenu(page, saveFixture(id, 'white')); await tap(page, 'MenuScene', 'button:开始游戏'); await ready(page, 'RunScene');
    view.companion = await page.evaluate(() => {
      const scene = window.g.scene.getScene('RunScene'), c = scene.companions;
      scene.physics.pause(); scene.events.off('preupdate', scene.onPreUpdate, scene); scene.sys.sceneUpdate = () => {};
      c.patternEnded = true;
      const viewport = window.g.scale.gameSize, speed = scene.difficultySystem.speed, right = scene.cameras.main.scrollX + viewport.width + 14;
      const edge = right - (42 + speed * .95 + 6); c.lastObstacle = { x: edge - 36, rightEdge: edge, definition: { kind: 'WoodFence' }, active: false };
      const update = nowMs => c.update({ nowMs, deltaSeconds: 0, speed, viewport, obstacles: [], pickups: [] });
      update(25000); if (!c.bell) throw new Error('No safe-gap fixture bell'); c.bell.image.x = scene.sheep.x; update(25000); update(26200);
      const p = c.companion?.sheep;
      return { renderer: window.g.renderer.type, skin: c.companion?.skin, key: p?.texture.key, hasBody: !!p?.body, width: p?.displayWidth, height: p?.displayHeight, leadWidth: scene.sheep.displayWidth, leadHeight: scene.sheep.displayHeight, visible: p?.visible, active: p?.active, filter: p?.texture.source[0].scaleMode, visualOnly: p?.getData('visual-only'), bellGone: !c.bell, event: scene.travel.snapshot().companionSkins };
    });
    const friend = view.companion;
    check(friend.renderer === 2 && friend.skin === id && friend.key === `sheep-runner-${id}` && friend.visible && friend.active, `${id}: actual WebGL existing controller draws this unlocked friend`);
    check(!friend.hasBody && friend.visualOnly && Math.abs(friend.width / friend.leadWidth - .85) < .0001 && Math.abs(friend.height / friend.leadHeight - .85) < .0001 && friend.filter === 1, `${id}: companion has no body and retains proportional 85% nearest art`);
    check(friend.bellGone && friend.event.includes(id), `${id}: real bell fixture collects once and records actual selected companion`);
    await screenshot(page, id, 'companion-fixture');
    await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene'); await tap(page, 'PauseScene', 'button:返回首页'); await ready(page, 'MenuScene');
    check(await page.evaluate(() => !window.g.scene.getScene('RunScene').children.list.some(o => o.name?.startsWith('companion-'))), `${id}: actual pause/menu touch exit cleans fixture companion`);

    report.current.stage = 'delivery';
    const chapter = chapters[index % chapters.length];
    await seedMenu(page, saveFixture(id)); await tap(page, 'MenuScene', 'mailbox-entry'); await tap(page, 'MenuScene', 'mailbox-delivery');
    let selected;
    for (let count = 0; !(selected = await target(page, 'MenuScene', `delivery-chapter:${chapter}`, true))?.enabled; count++) {
      check(count < 4, `${id}: actual delivery ${chapter} reachable through chapter pagination`);
      await tap(page, 'MenuScene', 'delivery-next');
    }
    await tap(page, 'MenuScene', `delivery-chapter:${chapter}`);
    await screenshot(page, id, `delivery-${chapter}-brief`);
    await tap(page, 'MenuScene', 'delivery-start'); await ready(page, 'RunScene');
    view.delivery = { chapter, running: await facts(page) }; verifyStanding(id, view.delivery.running, chapter);
    await screenshot(page, id, `delivery-${chapter}-running`);
    await gameplayTap(page);
    await page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'JUMPING' && Number(p.frame.name) === 5 && p.body.velocity.y < 0; }, null, { timeout: 5000 });
    view.delivery.jump = await facts(page); check(view.delivery.jump.key === `sheep-runner-${id}` && view.delivery.jump.chapter === chapter && view.delivery.jump.body.velocityY < 0, `${id}: real delivery touchscreen jump keeps equipped skin`);
    await screenshot(page, id, `delivery-${chapter}-jump`);
    await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene'); await tap(page, 'PauseScene', 'button:返回首页'); await ready(page, 'MenuScene');
    await context.close(); activePage = undefined;
    await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ id, main, chapter, checks: report.checks.length, screenshots: report.screenshots.length }));
  }
  check(new Set(report.views.map(view => view.main)).size === 1, 'All integration runs use one exact unchanged static main bundle');
  check(new Set(report.views.map(view => view.delivery.chapter)).size === chapters.length, 'Actual touch delivery integration covers all five current chapters');
  check(report.runtimeErrors.length === 0, 'No actual ordinary/portrait/companion/delivery WebGL runtime errors');
  report.passed = true; report.current = null;
} catch (error) {
  report.failure = { ...report.current, message: error.message, stack: error.stack };
  await activePage?.screenshot({ path: fileURLToPath(new URL('failure.png', output)), scale: 'css' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, skins: report.views.length, checks: report.checks.length, screenshots: report.screenshots.length, failure: report.failure }));
}
