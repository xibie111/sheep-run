import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.DELIVERY_STORAGE_URL || 'http://127.0.0.1:4342/';
const phase = process.env.DELIVERY_STORAGE_PHASE || 'all';
const maxUpgrades = false;
const output = process.env.DELIVERY_STORAGE_OUT
  ? pathToFileURL(resolve(process.env.DELIVERY_STORAGE_OUT) + sep)
  : new URL('../../docs/delivery-expansion-v1/storage-browser/', import.meta.url);
await mkdir(new URL('screenshots/', output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = { passed: false, url, phoneHardware: false, engine: 'Edge Chromium mobile touch emulation',
  method: 'Isolated initial storage fixtures; route distance/cursor and endingMs advanced only in the review context, challenge.collect called for six stamps. The real production update performs success/once-only settlement and actual touches open result/album/retry. This is not natural play or phone evidence.',
  cases: [], checks: [], errors: [], screenshots: [], suppressedHotReloads: [] };
const check = (condition, name) => { assert(condition, name); report.checks.push(name); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const panelSelector = '[data-adventure-overlay="delivery-panel"]:visible';
const protectedKeys = ['sheep-run-save', 'sheep-run-journey-v1', 'sheep-run-collections-v1', 'sheep-run-mailbox-v1'];

async function frames(f, count = 2) {
  await f.page.evaluate(count => new Promise(resolve => {
    const after = () => { if (!--count) { window.g.events.off('postrender', after); resolve(); } };
    window.g.events.on('postrender', after);
  }), count);
}
async function ready(f, scene) {
  await f.page.waitForFunction(scene => window.g.scene.isActive(scene) && window.g.scene.getScene(scene).children.list.length, scene);
  await frames(f);
}
async function open(width, height, dpr, fixture, initial) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  await context.routeWebSocket('**/*', socket => {
    const server = socket.connectToServer(); socket.onMessage(message => server.send(message));
    server.onMessage(message => {
      let packet; try { packet = JSON.parse(String(message)); } catch {}
      if (['update', 'full-reload', 'prune'].includes(packet?.type)) { report.suppressedHotReloads.push(packet.type); return; }
      socket.send(message);
    });
  });
  const page = await context.newPage(), f = { context, page, width, height, dpr, fixture };
  f.cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(initial => {
    const mainKey = 'sheep-run-save', oldKey = 'sheep-run-delivery-v1', challengeKey = 'sheep-run-delivery-challenges-v1';
    const rawSet = Storage.prototype.setItem;
    const seed = (key, value) => { if (localStorage.getItem(key) === null && value !== null) rawSet.call(localStorage, key, value); };
    seed(mainKey, JSON.stringify({ version: 5, spentStars: 0, highScore: 12345, totalStars: 42, coins: 77, selectedSkin: 'white', unlockedSkins: ['white'],
      upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } }));
    seed('sheep-run-mailbox-v1', JSON.stringify({ version: 1, readIds: ['welcome-v1', 'goodnight-v1', 'future-letter-v9'] }));
    seed('sheep-run-collections-v1', JSON.stringify({ version: 1, badges: [] }));
    seed('sheep-run-journey-v1', JSON.stringify({ version: 1, runs: 7, summons: 2, stars: 123, obstacles: 24, record: false, seasons: ['spring'], skins: 1, achieved: {}, rewards: {}, readAchievements: [], readRewards: [] }));
    seed(oldKey, initial.old); seed(challengeKey, initial.challenge);
    window.__storageWrites = []; window.__allowChallengeWrites = !initial.quota;
    Storage.prototype.setItem = function(key, value) {
      const fail = key === challengeKey && !window.__allowChallengeWrites;
      window.__storageWrites.push({ key, value, failed: fail });
      if (fail) throw new DOMException('Isolated challenge-key quota fixture', 'QuotaExceededError');
      return rawSet.call(this, key, value);
    };
  }, initial);
  const mainRequest = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await mainRequest).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  await ready(f, 'MenuScene');
  check(await page.locator('[data-menu-art]').count() === 1, `${width}/${dpr}: one actual game/menu display surface`);
  return f;
}
async function target(f, scene, name) {
  return f.page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene);
    const find = list => { for (const item of list) { if (item.name === name) return item; const child = item.list && find(item.list); if (child) return child; } };
    const object = find(s.children.list); if (!object) throw new Error(`Missing touch target ${scene}/${name}`);
    const box = object.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: canvas.x + (box.centerX - s.cameras.main.scrollX * object.scrollFactorX) * canvas.width / size.width,
      y: canvas.y + (box.centerY - s.cameras.main.scrollY * object.scrollFactorY) * canvas.height / size.height };
  }, { scene, name });
}
async function tap(f, scene, name) { const point = await target(f, scene, name); await f.page.touchscreen.tap(point.x, point.y); await frames(f); }
async function cancelTarget(f, scene, name) {
  const point = await target(f, scene, name);
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }); await frames(f);
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await frames(f);
}
async function gesture(f, action) {
  const p = await f.page.evaluate(() => { const r = window.g.canvas.getBoundingClientRect(); return { x: r.x + r.width * .68, y: r.y + r.height * .5, unit: r.width / window.g.scale.gameSize.width }; });
  if (action === 'tap') { await f.page.touchscreen.tap(p.x, p.y); return; }
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + (action === 'up' ? -46 : 46) * p.unit }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function screenshot(f, name) {
  const file = `screenshots/${f.width}x${f.height}-dpr${f.dpr}-${f.fixture}-${name}.png`;
  await f.page.screenshot({ path: fileURLToPath(new URL(file, output)), scale: 'css' }); report.screenshots.push(file);
}
async function protectedStorage(f) { return f.page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), protectedKeys); }
async function runFacts(f) {
  return f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), d = s.delivery;
    return { active: window.g.scene.isActive('RunScene'), paused: window.g.scene.isPaused('RunScene'), finished: s.finished,
      nowMs: s.activeRunTimeMs, deliveryId: s.data.get('delivery-id'), chapterId: d?.chapter.id, state: d?.state,
      distance: d?.distance, endingMs: d?.endingMs, phase: d?.phase.id, speed: s.difficultySystem.speed,
      endlessAbsent: !s.starRoutes && !s.runGoal && !s.goalView && !s.travel && !s.journey && !s.companions,
      stars: s.stars.getChildren().filter(object => object.active).length, powerUps: s.powerUps.getChildren().filter(object => object.active).length,
      sheep: { x: s.sheep.x, y: s.sheep.y, grounded: s.sheep.grounded, state: s.sheep.motionState },
      handlers: s.events.listeners('preupdate').filter(listener => listener === s.onPreUpdate).length,
      objects: s.children.list.filter(object => object.name?.startsWith('delivery-') || object.name?.startsWith('companion-')).map(object => ({ name: object.name, active: object.active, visible: object.visible, alpha: object.alpha })),
      gestures: { active: !!s.inputSystem.gestureRecognizer.active, pending: s.inputSystem.pendingActions.length },
      overlays: [...document.querySelectorAll('[data-adventure-overlay]')].map(canvas => ({ type: canvas.dataset.adventureOverlay, display: canvas.style.display })),
    };
  });
}
async function panelFacts(f, label) {
  const facts = await f.page.locator(panelSelector).evaluate(canvas => ({ ...canvas.dataset, width: canvas.width, height: canvas.height,
    cssWidth: parseFloat(canvas.style.width), cssHeight: parseFloat(canvas.style.height), smoothing: canvas.getContext('2d').imageSmoothingEnabled }));
  check(facts.width === Math.round(facts.cssWidth * f.dpr) && facts.height === Math.round(facts.cssHeight * f.dpr), `${label}: physical panel pixels follow DPR ${f.dpr}`);
  check(facts.smoothing === false, `${label}: generated artwork is drawn without smoothing`);
  for (const line of JSON.parse(facts.lines)) check(line.ink.x >= line.box.x - 1 && line.ink.y >= line.box.y - 1 && line.ink.x + line.ink.width <= line.box.x + line.box.width + 1 && line.ink.y + line.ink.height <= line.box.y + line.box.height + 1, `${label}: clear text fits ${line.text}`);
  return facts;
}
const OLD = 'sheep-run-delivery-v1', CHALLENGE = 'sheep-run-delivery-challenges-v1', ID = 'windmill-invitation-v1';
const oldValid = JSON.stringify({ version: 1, completedIds: ['hill-goodnight-v1', 'dinner-for-you-v1', 'future-resident-v9'] });
const challengeValid = JSON.stringify({ version: 1, chapters: {} });
const fixtures = [
  { name: 'challenge-invalid-json', old: oldValid, challenge: '{"version":1,"chapters":', protectChallenge: true },
  { name: 'challenge-future-version', old: oldValid, challenge: JSON.stringify({ version: 7, chapters: { 'future-route-v7': { fancyStars: 9 } }, futureMeta: 'keep exact bytes' }), protectChallenge: true },
  { name: 'challenge-corrupt-known-record', old: oldValid, challenge: JSON.stringify({ version: 1, chapters: { [ID]: { bestStars: 7, keepsake: true, futureMeta: 'keep' } } }), protectChallenge: true },
  { name: 'challenge-impossible-three-stars-without-keepsake', old: oldValid, challenge: JSON.stringify({ version: 1, chapters: { [ID]: { bestStars: 3, keepsake: false, futureMeta: 'keep exact bytes' } } }), protectChallenge: true },
  { name: 'challenge-impossible-one-star-with-keepsake', old: oldValid, challenge: JSON.stringify({ version: 1, chapters: { [ID]: { bestStars: 1, keepsake: true, futureMeta: 'keep exact bytes' } } }), protectChallenge: true },
  { name: 'postcard-invalid-json', old: '{"version":1,"completedIds":', challenge: challengeValid, protectOld: true },
  { name: 'postcard-future-version', old: JSON.stringify({ version: 2, completedIds: ['hill-goodnight-v1', 'future-resident-v2'], metadata: ['unchanged'] }), challenge: challengeValid, protectOld: true },
  { name: 'unknown-ids-and-extra-fields', old: oldValid,
    challenge: JSON.stringify({ version: 1, futureTop: { format: 'keep', flags: [1, 'x'] }, chapters: { 'future-unknown-v9': { bestStars: 9, keepsake: 'future-custom', arbitrary: ['leave', { nested: true }] }, [ID]: { bestStars: 2, keepsake: false, futureKnown: { gift: 'keep' } }, 'rainy-umbrella-v1': { bestStars: 3, keepsake: true, untouched: 'yes' } } }) },
  { name: 'challenge-quota-session-and-recovery', old: oldValid, challenge: challengeValid, quota: true },
];
async function checkpoint() { await writeFile(new URL('storage-review.json', output), JSON.stringify(report, null, 2)); }
async function rawFacts(f) {
  return f.page.evaluate(({ old, challenge }) => ({ old: localStorage.getItem(old), challenge: localStorage.getItem(challenge), writes: [...window.__storageWrites] }), { old: OLD, challenge: CHALLENGE });
}
async function start(f) {
  await tap(f, 'MenuScene', 'mailbox-entry'); await tap(f, 'MenuScene', 'mailbox-delivery');
  await tap(f, 'MenuScene', 'delivery-next'); await tap(f, 'MenuScene', `delivery-chapter:${ID}`);
  check((await panelFacts(f, 'brief')).chapterId === ID, `${f.fixture}: actual touched selection resolves chosen chapter`);
  await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
  check((await runFacts(f)).chapterId === ID, `${f.fixture}: chosen chapter starts`);
}
async function finish(f) {
  await f.page.evaluate(() => {
    const run = window.g.scene.getScene('RunScene'), d = run.delivery;
    for (const o of run.obstacles.getChildren()) if (o.active) o.deactivate();
    d.chapter.challenge.stamps.forEach(stamp => d.challenge.collect(stamp.id));
    d.distance = d.chapter.length - 1; d.next = d.chapter.obstacles.length;
  });
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'ending');
  await f.page.evaluate(() => { const d = window.g.scene.getScene('RunScene').delivery; d.endingMs = d.chapter.endingDurationMs - 30; });
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'complete'); await frames(f);
  const facts = await panelFacts(f, 'success');
  check(facts.mode === 'success' && JSON.parse(facts.result).stars === 3, `${f.fixture}: production update reaches actual successful three-star result`);
  await screenshot(f, facts.saved === 'true' ? 'success-saved' : 'success-unsaved'); return facts;
}
async function album(f) {
  await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene');
  await tap(f, 'MenuScene', 'mailbox-delivery'); await tap(f, 'MenuScene', 'delivery-album');
  const facts = await panelFacts(f, 'album');
  check(facts.mode === 'album' && JSON.parse(facts.albumCollected)[0] === true, `${f.fixture}: real album retains earned windmill keepsake in current session`);
  await screenshot(f, 'session-album'); return facts;
}
async function reload(f) {
  await f.page.reload({ waitUntil: 'domcontentloaded' });
  await f.page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main); await ready(f, 'MenuScene');
}
async function testCase(initial) {
  const f = await open(896, 414, 2, initial.name, initial), before = await protectedStorage(f), rawBefore = await rawFacts(f);
  const record = { name: initial.name, initial, protectedBefore: before, rawBefore, fixture: report.method }; report.cases.push(record);
  await start(f);
  // This isolated failure is deliberate: no new completion/rating may be saved before success.
  await f.page.evaluate(() => window.g.scene.getScene('RunScene').onObstacleOverlap());
  const failure = await panelFacts(f, 'failure'), rawFailed = await rawFacts(f);
  check(failure.mode === 'failure' && rawFailed.old === rawBefore.old && rawFailed.challenge === rawBefore.challenge, `${initial.name}: failed trip changes neither independent archive`);
  await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene');
  record.success = await finish(f);
  record.after = await rawFacts(f);
  record.deliveryWrites = record.after.writes.slice(rawBefore.writes.length);
  const unsaved = !!(initial.protectOld || initial.protectChallenge || initial.quota);
  check(record.success.saved === String(!unsaved), `${initial.name}: actual result save state is correct`);
  const successLines = JSON.parse(record.success.lines).map(line => line.text);
  check(successLines.includes('暂未保存') === unsaved, `${initial.name}: actual result shows 暂未保存 only when write unavailable`);
  if (initial.protectOld) check(record.after.old === initial.old, `${initial.name}: original corrupt/future postcard bytes preserved`);
  else {
    const completed = JSON.parse(record.after.old).completedIds;
    check(['hill-goodnight-v1', 'dinner-for-you-v1', 'future-resident-v9', ID].every(id => completed.includes(id)), `${initial.name}: both original completion IDs and unknown future ID survive the new success`);
  }
  if (initial.protectChallenge || initial.quota) check(record.after.challenge === initial.challenge, `${initial.name}: original corrupt/future/quota challenge bytes preserved exactly`);
  else {
    const parsed = JSON.parse(record.after.challenge);
    check(parsed.chapters[ID].bestStars === 3 && parsed.chapters[ID].keepsake, `${initial.name}: only independent challenge rating/keepsake written`);
    if (initial.name === 'unknown-ids-and-extra-fields') {
      const source = JSON.parse(initial.challenge);
      check(JSON.stringify(parsed.futureTop) === JSON.stringify(source.futureTop), `${initial.name}: unknown top fields preserved`);
      check(JSON.stringify(parsed.chapters['future-unknown-v9']) === JSON.stringify(source.chapters['future-unknown-v9']), `${initial.name}: unknown chapter record preserved`);
      check(JSON.stringify(parsed.chapters[ID].futureKnown) === JSON.stringify(source.chapters[ID].futureKnown), `${initial.name}: known chapter extra fields preserved while best record updates`);
      check(JSON.stringify(parsed.chapters['rainy-umbrella-v1']) === JSON.stringify(source.chapters['rainy-umbrella-v1']), `${initial.name}: unrelated known chapter record preserved`);
    }
  }
  const writesBefore = record.after.writes.length; await delay(150); await frames(f);
  check((await rawFacts(f)).writes.length === writesBefore, `${initial.name}: completed run does not repeat settlement writes`);
  record.album = await album(f);
  if (initial.quota) {
    check(JSON.parse(record.album.lines).some(line => line.text === '暂未保存'), `${initial.name}: album clearly retains unsaved session warning`);
    check(record.deliveryWrites.some(write => write.key === CHALLENGE && write.failed), `${initial.name}: only challenge-key write actually threw quota`);
    check(record.deliveryWrites.every(write => write.key === OLD || write.key === CHALLENGE), `${initial.name}: production delivery writes after initialization are confined to its two archives`);
    // Recover storage in the same session; a real retry and production result flush the dirty challenge state.
    await f.page.evaluate(() => { window.__allowChallengeWrites = true; });
    await tap(f, 'MenuScene', 'delivery-back'); await tap(f, 'MenuScene', 'delivery-next'); await tap(f, 'MenuScene', `delivery-chapter:${ID}`); await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
    record.recovery = await finish(f);
    check(record.recovery.saved === 'true', `${initial.name}: subsequent successful retry flushes retained session after write access recovers`);
    check(JSON.parse((await rawFacts(f)).challenge).chapters[ID].bestStars === 3, `${initial.name}: recovered archive contains retained best record`);
  }
  check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(before), `${initial.name}: main economic/private/journey/collection bytes unchanged after delivery and album`);
  await reload(f); record.afterRefresh = await rawFacts(f);
  if (initial.protectOld) check(record.afterRefresh.old === initial.old, `${initial.name}: browser refresh leaves original future/corrupt postcard bytes unchanged`);
  if (initial.protectChallenge) check(record.afterRefresh.challenge === initial.challenge, `${initial.name}: browser refresh leaves original future/corrupt challenge bytes unchanged`);
  else {
    check(JSON.parse(record.afterRefresh.challenge).chapters[ID].bestStars === 3, `${initial.name}: persisted new record restores after actual refresh`);
    await tap(f, 'MenuScene', 'mailbox-entry'); await tap(f, 'MenuScene', 'mailbox-delivery'); await tap(f, 'MenuScene', 'delivery-album');
    check(JSON.parse((await panelFacts(f, 'refreshed-album')).albumCollected)[0], `${initial.name}: actual refreshed album restores the earned stamp`);
    await screenshot(f, 'refreshed-album');
    if (initial.name === 'unknown-ids-and-extra-fields') check(record.afterRefresh.challenge === record.after.challenge, `${initial.name}: refresh does not rewrite unknown fields`);
  }
  check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(before), `${initial.name}: protected records also unchanged after refresh`);
  await checkpoint(); await f.context.close(); process.stdout.write(JSON.stringify({ case: initial.name, passed: true }) + '\n');
}
try {
  const selected = phase === 'all' ? fixtures : fixtures.filter(initial => initial.name === phase);
  check(selected.length > 0, 'recognized archive browser case');
  for (const initial of selected) await testCase(initial);
  check(report.errors.length === 0, 'no runtime exceptions during archive compatibility/quota fixtures'); report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' }).catch(() => {});
  throw error;
} finally { await checkpoint(); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, cases: report.cases.length, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors }) + '\n');
