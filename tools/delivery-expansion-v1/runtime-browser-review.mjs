import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.DELIVERY_RUNTIME_URL || 'http://127.0.0.1:4342/';
const phase = process.env.DELIVERY_RUNTIME_PHASE || 'all';
const maxUpgrades = phase === 'max' || process.env.DELIVERY_RUNTIME_MAX_UPGRADES === '1';
const output = process.env.DELIVERY_RUNTIME_OUT
  ? pathToFileURL(resolve(process.env.DELIVERY_RUNTIME_OUT) + sep)
  : new URL('../../docs/delivery-expansion-v1/runtime-browser/', import.meta.url);
await mkdir(new URL('screenshots/', output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = { passed: false, url, phase, phoneHardware: false, engine: 'Edge Chromium mobile touch emulation',
  methods: { natural: 'Three new routes are played only through real touchscreen taps/swipes chosen from read-only runtime observations. No collision, physics, input, route, seed, spawn, clock, invincibility or reward mutation.',
    isolated: 'Separate contexts explicitly assign authored route distance/cursor/ending fields, invoke chapter-only challenge.collect, and use the existing collision callback for failure. These actual app fixtures are not natural-play or obstacle reachability evidence.' },
  views: [], natural: [], checks: [], errors: [], screenshots: [], suppressedHotReloads: [] };
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
async function open(width, height, dpr, fixture, assetFailure = false) {
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
  if (assetFailure) {
    f.blocked = [];
    f.assetRoute = async route => {
      if (route.request().resourceType() === 'script' || /[?&](?:import|url)(?:&|$)/.test(route.request().url())) { await route.continue(); return; }
      f.blocked.push(route.request().url()); await route.abort('failed');
    };
    await context.route(/windmill-ordinary(?:-[A-Za-z0-9_-]+)?\.png(?:\?.*)?$/, f.assetRoute);
  }
  f.cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(max => {
    if (localStorage.getItem('sheep-run-save') === null) localStorage.setItem('sheep-run-save', JSON.stringify({
      version: 5, spentStars: 0, highScore: 12345, totalStars: 0, coins: 77, selectedSkin: 'white', unlockedSkins: ['white'],
      upgrades: { jump: max ? 5 : 0, speed: max ? 5 : 0, magnet: max ? 5 : 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 },
    }));
  }, maxUpgrades);
  const mainRequest = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await mainRequest).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  if (assetFailure) {
    await page.waitForFunction(() => window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
    await frames(f); return f;
  }
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
const chapters = ['hill-goodnight-v1', 'dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'];
const newChapters = chapters.slice(2);
async function checkpoint() { await writeFile(new URL(`browser-review-${phase}.json`, output), JSON.stringify(report, null, 2)); }
async function selectChapter(f, id, mailboxOpen = false) {
  if (!mailboxOpen) await tap(f, 'MenuScene', 'mailbox-entry');
  await tap(f, 'MenuScene', 'mailbox-delivery');
  let facts = await panelFacts(f, `${f.fixture}/select`);
  check(facts.mode === 'select', `${f.fixture}: actual mailbox opens chapter list`);
  const expectedPage = Math.floor(chapters.indexOf(id) / 2);
  while (+facts.page < expectedPage) { await tap(f, 'MenuScene', 'delivery-next'); facts = await panelFacts(f, `${f.fixture}/page-next`); }
  while (+facts.page > expectedPage) { await tap(f, 'MenuScene', 'delivery-previous'); facts = await panelFacts(f, `${f.fixture}/page-previous`); }
  check(JSON.parse(facts.visibleChapterIds).includes(id), `${f.fixture}: ${id} visible on correct page`);
  await cancelTarget(f, 'MenuScene', `delivery-chapter:${id}`);
  check((await panelFacts(f, `${f.fixture}/cancel`)).mode === 'select', `${f.fixture}: cancelled chapter touch does not open brief`);
  await tap(f, 'MenuScene', `delivery-chapter:${id}`);
  facts = await panelFacts(f, `${f.fixture}/brief`);
  check(facts.mode === 'brief' && facts.chapterId === id, `${f.fixture}: actual touch opens exact brief ${id}`);
  await screenshot(f, `brief-${id}`);
  await cancelTarget(f, 'MenuScene', 'delivery-start');
  check(await f.page.evaluate(() => window.g.scene.isActive('MenuScene')), `${f.fixture}: cancelled start stays in mailbox`);
  await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
  const run = await runFacts(f);
  check(run.chapterId === id && run.deliveryId === id && run.endlessAbsent, `${f.fixture}: exact chapter ID starts without endless systems`);
  check(run.stars === 0 && run.powerUps === 0 && run.handlers === 1, `${f.fixture}: no currency pickups, one scene update handler`);
  return run;
}
async function pauseResume(f, label) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  const before = await runFacts(f); await delay(150); const after = await runFacts(f);
  for (const key of ['nowMs', 'distance', 'endingMs', 'state']) check(after[key] === before[key], `${label}: ${key} freezes during pause`);
  await cancelTarget(f, 'PauseScene', 'button:继续游戏'); check((await runFacts(f)).paused, `${label}: cancelled resume remains paused`);
  await screenshot(f, `pause-${label}`);
  await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
}
async function naturalChapter(id) {
  const f = await open(896, 414, 2, `natural-${maxUpgrades ? 'max-' : ''}${id}`); await selectChapter(f, id);
  const protectedBefore = await protectedStorage(f);
  const log = { chapter: id, main: f.main, width: f.width, height: f.height, dpr: f.dpr, upgrades: { jump: maxUpgrades ? 5 : 0, speed: maxUpgrades ? 5 : 0, magnet: maxUpgrades ? 5 : 0, dash: 0 }, actions: [], samples: [], pickups: [], phases: [], failures: [], attempts: 1,
    integrity: 'Read-only scene observations; real touchscreen taps/up/down swipes only. No route, physics, collision, clock, reward or player mutation.' };
  report.natural.push(log); await checkpoint();
  let lastActionMs = -1000, lastSampleMs = -1000, wallStart = Date.now(), lastCollected = ''; const seenPhases = new Set();
  for (;;) {
    const s = await f.page.evaluate(() => {
      const run = window.g.scene.getScene('RunScene'), body = run.sheep.body, d = run.delivery;
      return { active: window.g.scene.isActive('RunScene'), finished: run.finished, state: d.state, id: d.chapter.id, phase: d.phase.id,
        distance: d.distance, endingMs: d.endingMs, nowMs: run.activeRunTimeMs, speed: run.difficultySystem.speed,
        x: run.sheep.x, y: run.sheep.y, grounded: run.sheep.grounded, multiplier: run.upgradeEffects.jumpImpulseMultiplier,
        body: { x: body.x, y: body.y, width: body.width, height: body.height },
        obstacles: run.obstacles.getChildren().filter(o => o.active && o.rightEdge > body.x).map(o => ({ kind: o.definition.kind,
          at: o.getData('delivery-at'), left: o.body.x, width: o.body.width, right: o.rightEdge })).sort((a, b) => a.left - b.left),
        challenge: d.challenge?.snapshot(), hidden: d.chapter.challenge?.stamps.filter(stamp => stamp.kind === 'keepsake').map(stamp => ({
          id: stamp.id, x: 498 + stamp.at - d.distance, y: stamp.y, collected: d.challenge.isCollected(stamp.id) }))[0],
        endingVisible: run.children.list.some(o => o.name?.startsWith('delivery-ending-') && ['delivery-ending-invitation', 'delivery-ending-umbrella', 'delivery-ending-lighthouse'].includes(o.name) && o.alpha > .9),
      };
    });
    if (s.nowMs - lastSampleMs > 700) { log.samples.push(s); lastSampleMs = s.nowMs; }
    const collected = JSON.stringify(s.challenge?.collectedIds);
    if (collected !== lastCollected) { log.pickups.push({ nowMs: s.nowMs, distance: s.distance, ...s.challenge }); lastCollected = collected; await checkpoint(); }
    if (!seenPhases.has(s.phase)) { seenPhases.add(s.phase); log.phases.push({ phase: s.phase, distance: s.distance, nowMs: s.nowMs }); await screenshot(f, `phase-${s.phase}-${log.attempts}`); await checkpoint(); process.stdout.write(JSON.stringify({ natural: id, phase: s.phase, attempt: log.attempts, distance: s.distance }) + '\n'); }
    if (s.state === 'complete') { log.complete = s; log.wallDurationMs = Date.now() - wallStart; await screenshot(f, 'success'); break; }
    if (s.state === 'failed' || s.finished) {
      log.failures.push(s); await screenshot(f, `failure-${log.attempts}`); await checkpoint();
      if (log.attempts++ >= 3) throw new Error(`Natural ${id} touch bot failed three attempts`);
      await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene'); lastActionMs = lastSampleMs = -1000; seenPhases.clear(); continue;
    }
    if (Date.now() - wallStart > 280000) throw new Error(`Natural ${id} exceeded bounded deadline`);
    if (s.state === 'ending') { if (!log.endingShot && s.endingVisible && s.endingMs >= 1800) { await screenshot(f, 'ending'); log.endingShot = s; } await delay(25); continue; }
    let action = null, why = null; const hazard = s.obstacles[0];
    if (s.grounded && s.nowMs - lastActionMs > 210) {
      if (hazard) {
        const duck = ['FlyingBird', 'HangingVine', 'HangingBranch'].includes(hazard.kind);
        if (duck && hazard.left - s.body.x - s.body.width <= s.speed * .085 && hazard.right > s.body.x) { action = 'down'; why = hazard.kind; }
        else if (!duck) {
          const high = hazard.kind === 'TallStack', apex = (high ? Math.min(580 * s.multiplier, 590) : 500 * s.multiplier) / 1450;
          const center = hazard.left + hazard.width / 2 - s.x;
          if (center <= s.speed * (apex + .025) && center > -hazard.width) { action = high ? 'up' : 'tap'; why = hazard.kind; }
        }
      }
      if (!action && s.hidden && !s.hidden.collected && s.hidden.x > s.body.x && s.hidden.x - s.x <= s.speed * .4) {
        const safe = !hazard || hazard.left > s.body.x + s.speed * .85;
        if (safe) { action = 'up'; why = s.hidden.id; }
      }
    }
    if (action) { log.actions.push({ nowMs: s.nowMs, distance: s.distance, action, why, obstacles: s.obstacles, hidden: s.hidden }); await gesture(f, action); lastActionMs = s.nowMs; }
    await delay(15);
  }
  const actual = await panelFacts(f, `${id}/natural-completion`); log.panel = actual;
  check(actual.mode === 'success' && actual.chapterId === id, `natural ${id}: reaches real successful delivery result`);
  check(log.endingShot && log.phases.length === 4, `natural ${id}: all four phases and complete ending actually shown`);
  check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(protectedBefore), `natural ${id}: protected economic/private/collection state unchanged`);
  log.saved = await f.page.evaluate(() => ({ complete: JSON.parse(localStorage.getItem('sheep-run-delivery-v1')), challenge: JSON.parse(localStorage.getItem('sheep-run-delivery-challenges-v1')) }));
  check(log.saved.complete.completedIds.includes(id) && log.saved.challenge.chapters[id].bestStars === log.complete.challenge.stars, `natural ${id}: independent chapter completion/rating saved`);
  await tap(f, 'RunScene', 'delivery-card'); check((await panelFacts(f, 'natural-postcard')).mode === 'postcard', `natural ${id}: real earned postcard opens by touch`);
  await screenshot(f, 'postcard'); await tap(f, 'RunScene', 'delivery-back'); await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene');
  log.protectedBefore = protectedBefore; await checkpoint(); await f.context.close();
}

async function listChecks(f) {
  await tap(f, 'MenuScene', 'mailbox-entry'); await tap(f, 'MenuScene', 'mailbox-delivery');
  const seen = [], pages = [];
  for (let index = 0; index < 3; index++) {
    const facts = await panelFacts(f, `matrix/${f.width}/${f.dpr}/page${index}`); pages.push(facts); seen.push(...JSON.parse(facts.visibleChapterIds));
    check(+facts.page === index && +facts.pageCount === 3, `matrix/${f.width}/${f.dpr}: chapter page ${index + 1}/3`);
    await screenshot(f, `selection-page-${index + 1}`);
    const targets = JSON.parse(facts.targets), enabled = JSON.parse(facts.enabled), names = JSON.parse(facts.targetNames);
    const touches = targets.filter((box, i) => enabled[i] && names[i] !== 'delivery-blocker');
    for (const box of touches) check(box.width >= 27 && box.height >= 28, `${f.width}/${f.dpr}: actual touch box remains usable`);
    for (let i = 0; i < touches.length; i++) for (let j = i + 1; j < touches.length; j++) check(!(touches[i].x < touches[j].x + touches[j].width && touches[i].x + touches[i].width > touches[j].x && touches[i].y < touches[j].y + touches[j].height && touches[i].y + touches[i].height > touches[j].y), `${f.width}/${f.dpr}: visible actions do not overlap`);
    await cancelTarget(f, 'MenuScene', 'delivery-album'); check((await panelFacts(f, 'cancel-album')).mode === 'select', `${f.width}/${f.dpr}: album cancel restores list`);
    await tap(f, 'MenuScene', 'delivery-album'); const album = await panelFacts(f, 'album'); check(album.mode === 'album' && JSON.parse(album.albumCollected).length === 3, `${f.width}/${f.dpr}: only three keepsakes in album`);
    await screenshot(f, `album-page-${index + 1}`); await tap(f, 'MenuScene', 'delivery-back'); check(+(await panelFacts(f, 'album-back')).page === index, `${f.width}/${f.dpr}: album returns to exact page`);
    await tap(f, 'MenuScene', `delivery-chapter:${JSON.parse(facts.visibleChapterIds)[0]}`); await panelFacts(f, 'brief-back'); await tap(f, 'MenuScene', 'delivery-back');
    check(+(await panelFacts(f, 'brief-return')).page === index, `${f.width}/${f.dpr}: brief returns to exact page`);
    if (index < 2) await tap(f, 'MenuScene', 'delivery-next');
  }
  check(JSON.stringify(seen) === JSON.stringify(chapters), `${f.width}/${f.dpr}: all five original/new chapters reachable by touch`);
  await tap(f, 'MenuScene', 'delivery-back'); await tap(f, 'MenuScene', 'button:合上邮箱'); return pages;
}
async function exitRun(f) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
}
async function fixtureFinish(f, count, hidden) {
  const id = (await runFacts(f)).chapterId;
  await f.page.evaluate(({ count, hidden }) => {
    const s = window.g.scene.getScene('RunScene'), d = s.delivery;
    for (const o of s.obstacles.getChildren()) if (o.active) o.deactivate();
    const stamps = d.chapter.challenge?.stamps ?? [];
    for (const stamp of stamps.filter(x => x.kind === 'ordinary').slice(0, count)) d.challenge.collect(stamp.id);
    if (hidden) d.challenge.collect(stamps.find(x => x.kind === 'keepsake').id);
    d.distance = d.chapter.length - 1; d.next = d.chapter.obstacles.length;
  }, { count, hidden });
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'ending');
  await f.page.evaluate(() => { window.g.scene.getScene('RunScene').delivery.endingMs = 1900; }); await frames(f);
  await screenshot(f, `fixture-ending-${id}-${count}-${hidden}`);
  await f.page.evaluate(() => { const d = window.g.scene.getScene('RunScene').delivery; d.endingMs = d.chapter.endingDurationMs - 30; });
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'complete'); await frames(f);
  return panelFacts(f, `result-${count}-${hidden}`);
}
async function isolatedMatrix() {
  for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const f = await open(width, height, dpr, 'isolated'), view = { width, height, dpr, main: f.main, fixtures: ['Explicit isolated route phase/ending cursor assignments and challenge.collect calls; not natural play.'] }; report.views.push(view);
    view.pages = await listChecks(f);
    const before = await protectedStorage(f);
    for (const id of newChapters) {
      await selectChapter(f, id); await pauseResume(f, `${id}-initial`);
      if (id === newChapters[0]) {
        const another = await f.context.newPage(); await another.goto('about:blank'); await another.bringToFront();
        await delay(100); await f.page.bringToFront(); await another.close();
        // The real blur/visibility hooks should pause the delivery before any return input.
        if (!(await runFacts(f)).paused) {
          await f.page.evaluate(() => window.dispatchEvent(new Event('blur')));
          view.fixtures.push('Headless foreground did not emit blur; dispatched actual window blur listener as explicit lifecycle fixture.');
        }
        await ready(f, 'PauseScene'); const hiddenBefore = await runFacts(f); await delay(100);
        check((await runFacts(f)).distance === hiddenBefore.distance, `${width}/${dpr}: background/blur pause freezes route`);
        await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
      }
      await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:重新开始'); await ready(f, 'RunScene');
      check((await runFacts(f)).chapterId === id, `${width}/${dpr}: pause restart preserves ${id}`);
      await f.page.evaluate(() => window.g.scene.getScene('RunScene').onObstacleOverlap());
      const failure = await panelFacts(f, `${id}/failure`); check(failure.mode === 'failure' && failure.chapterId === id, `${width}/${dpr}: failure exact chapter`);
      check(await f.page.evaluate(id => !JSON.parse(localStorage.getItem('sheep-run-delivery-challenges-v1') ?? '{"chapters":{}}').chapters[id], id), `${width}/${dpr}: failure saves no rating`);
      await screenshot(f, `failure-${id}`); await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene');
      check((await runFacts(f)).chapterId === id, `${width}/${dpr}: failure retry retains ${id}`);
      const phases = await f.page.evaluate(() => window.g.scene.getScene('RunScene').delivery.chapter.phases);
      for (const phase of phases.slice(1)) {
        await f.page.evaluate(distance => { const s = window.g.scene.getScene('RunScene'), d = s.delivery; for (const o of s.obstacles.getChildren()) if (o.active) o.deactivate(); d.distance = distance; d.next = d.chapter.obstacles.filter(o => o.at <= distance).length; }, phase.start + 650);
        await frames(f); await screenshot(f, `${id}-${phase.id}`);
      }
      const success = await fixtureFinish(f, 5, true);
      check(JSON.parse(success.result).stars === 3, `${width}/${dpr}: ${id} full-collected production completion gets three stars`);
      await screenshot(f, `success-${id}`); await tap(f, 'RunScene', 'delivery-card'); await panelFacts(f, `${id}/postcard`); await screenshot(f, `postcard-${id}`); await tap(f, 'RunScene', 'delivery-back');
      // One actual retry is a fresh route; explicit isolated collection variants use the real ending/save path.
      for (const [count, hidden] of [[0, false], [3, false], [4, false], [0, true]]) {
        await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene');
        check(await f.page.evaluate(() => window.g.scene.getScene('RunScene').delivery.challenge.snapshot().ordinaryCollected === 0), `${width}/${dpr}: retry clears run-only stamps`);
        const result = await fixtureFinish(f, count, hidden), data = JSON.parse(result.result);
        check(data.stars === 1 + Number(count >= 4) + Number(hidden) && data.ordinary === count && data.hidden === hidden, `${width}/${dpr}: ${id} actual result conditions ${count}/${hidden}`);
        check(await f.page.evaluate(id => { const r = JSON.parse(localStorage.getItem('sheep-run-delivery-challenges-v1')).chapters[id]; return r.bestStars === 3 && r.keepsake; }, id), `${width}/${dpr}: lower replay cannot erase best rating or keepsake`);
      }
      await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene');
      check(await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return !s.delivery && !s.deliveryPanel && !s.deliveryView && !s.deliveryPostage && s.events.listeners('preupdate').filter(l => l === s.onPreUpdate).length === 0 && !s.children.list.some(o => o.name?.startsWith('delivery-postage:')); }), `${width}/${dpr}: scene exit cleans route/postage and listener`);
      await tap(f, 'MenuScene', 'button:合上邮箱');
    }
    for (const id of chapters.slice(0, 2)) {
      await selectChapter(f, id); check(await f.page.evaluate(() => !window.g.scene.getScene('RunScene').delivery.challenge && !window.g.scene.getScene('RunScene').deliveryPostage), `${width}/${dpr}: old ${id} has no invented challenge or postage`);
      const old = await fixtureFinish(f, 0, false); check(JSON.parse(old.result) === null && old.mode === 'success', `${width}/${dpr}: old result retains original flow`);
      await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene'); await tap(f, 'MenuScene', 'button:合上邮箱');
    }
    check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(before), `${width}/${dpr}: all delivery fixtures preserve protected main/private records`);
    await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene');
    check(await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return !s.delivery && !s.deliveryPostage && s.starRoutes && s.runGoal && s.travel; }), `${width}/${dpr}: endless starts with original systems and no challenge`);
    await screenshot(f, 'endless-regression'); await exitRun(f);
    await f.page.reload({ waitUntil: 'domcontentloaded' }); await f.page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main); await ready(f, 'MenuScene');
    check(await f.page.evaluate(ids => ids.every(id => { const r = JSON.parse(localStorage.getItem('sheep-run-delivery-challenges-v1')).chapters[id]; return r.bestStars === 3 && r.keepsake; }), newChapters), `${width}/${dpr}: independent challenge record survives real refresh`);
    await checkpoint(); await f.context.close(); process.stdout.write(JSON.stringify({ width, height, dpr, passed: true }) + '\n');
  }
}
async function assetRetry() {
  const f = await open(480, 270, 1, 'resource-retry', true), before = await protectedStorage(f);
  check(f.blocked.length > 0, 'resource retry: generated ordinary stamp was actually blocked');
  check(await f.page.evaluate(() => !window.g.scene.isActive('MenuScene')), 'resource retry: incomplete local assets cannot enter main menu');
  await screenshot(f, 'local-load-error');
  await cancelTarget(f, 'PreloadScene', 'button:重试');
  check(await f.page.evaluate(() => !!window.g.scene.getScene('PreloadScene').children.getByName('local-load-error')), 'resource retry: cancelled retry stays on resource error');
  await f.context.unroute(/windmill-ordinary(?:-[A-Za-z0-9_-]+)?\.png(?:\?.*)?$/, f.assetRoute);
  await tap(f, 'PreloadScene', 'button:重试'); await ready(f, 'MenuScene');
  check(await f.page.evaluate(() => window.g.textures.exists('delivery-expansion-windmill-ordinary')), 'resource retry: actual retry reloads missing generated stamp');
  check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(before), 'resource retry: retry preserves initialized main and private storage');
  await screenshot(f, 'recovered-menu'); report.retry = { blockedRequests: f.blocked, protectedBefore: before }; await f.context.close();
}

try {
  check(['all', 'natural', 'max', 'matrix', 'retry', ...newChapters].includes(phase), 'selected browser review phase is recognized');
  if (['all', 'natural', 'max'].includes(phase)) for (const id of newChapters) await naturalChapter(id);
  if (newChapters.includes(phase)) await naturalChapter(phase);
  if (['all', 'matrix'].includes(phase)) await isolatedMatrix();
  if (['all', 'retry'].includes(phase)) await assetRetry();
  check(report.errors.length === 0, 'no runtime exceptions during recorded production flow'); report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' }).catch(() => {});
  throw error;
} finally { await checkpoint(); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors }) + '\n');
