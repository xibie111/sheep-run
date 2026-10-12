import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.RUNNER_V2_DELIVERY_URL || 'http://127.0.0.1:4331/';
const phase = process.env.RUNNER_V2_DELIVERY_PHASE || 'all';
const output = new URL('../docs/runner-update-v2/delivery-integration/', import.meta.url);
await mkdir(new URL('screenshots/', output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = { passed: false, url, phase, phoneHardware: false, engine: 'Edge Chromium mobile touch emulation',
  methods: { natural: 'Dinner route is played only through real touchscreen taps/swipes chosen from read-only runtime observations. No collision, physics, input, route, seed, spawn, clock, invincibility or reward mutation.',
    isolated: 'Separate contexts exercise authored route stage rendering and completion by explicitly assigning only the delivery route distance/next/ending fields. Failure uses the existing collision callback as an isolated fixture. These are not natural-play evidence.' },
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
async function open(width, height, dpr, fixture) {
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
  await page.addInitScript(() => {
    if (localStorage.getItem('sheep-run-save') === null) localStorage.setItem('sheep-run-save', JSON.stringify({
      version: 4, highScore: 12345, totalStars: 0, coins: 77, selectedSkin: 'white', unlockedSkins: ['white'],
      upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 },
    }));
  });
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
async function selectDinner(f, old = false) {
  await tap(f, 'MenuScene', 'mailbox-entry'); await tap(f, 'MenuScene', 'mailbox-delivery');
  const panel = await panelFacts(f, `${f.width}/${f.dpr}/select`);
  check(panel.mode === 'select', `${f.width}/${f.dpr}: real mailbox opens chapter selection`);
  const lines = JSON.parse(panel.lines).map(line => line.text);
  check(lines.includes('把晚安送到山坡上') && lines.includes('带着晚饭去找你'), `${f.width}/${f.dpr}: both original and dinner chapters remain available`);
  const id = old ? 'hill-goodnight-v1' : 'dinner-for-you-v1';
  await cancelTarget(f, 'MenuScene', `delivery-chapter:${id}`);
  check((await f.page.locator(panelSelector).evaluate(canvas => canvas.dataset.chapterId)) === panel.chapterId, `${f.width}/${f.dpr}: cancelled chapter press does not change selection`);
  await tap(f, 'MenuScene', `delivery-chapter:${id}`);
  check((await f.page.locator(panelSelector).evaluate(canvas => canvas.dataset.chapterId)) === id, `${f.width}/${f.dpr}: touch selects ${id}`);
  await screenshot(f, old ? 'old-chapter-selection' : 'dinner-selection');
  await cancelTarget(f, 'MenuScene', 'delivery-start');
  check(await f.page.evaluate(() => window.g.scene.isActive('MenuScene') && !window.g.scene.isActive('RunScene')), `${f.width}/${f.dpr}: cancelled start does not launch or penetrate menu`);
  await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
  const run = await runFacts(f);
  check(run.deliveryId === id && run.chapterId === id && run.endlessAbsent, `${f.width}/${f.dpr}: selected route starts with exact ID and no endless additions`);
  check(run.stars === 0 && run.powerUps === 0 && run.handlers === 1, `${f.width}/${f.dpr}: delivery has no endless pickups and one run handler`);
  check(!run.overlays.some(canvas => canvas.type === 'run-goal'), `${f.width}/${f.dpr}: delivery does not retain the endless objective surface`);
  return run;
}
async function pauseResume(f, label) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  const before = await runFacts(f); await delay(130); const after = await runFacts(f);
  check(before.paused && after.paused, `${label}: touch pause actually pauses the delivery scene`);
  for (const key of ['nowMs', 'distance', 'endingMs', 'state']) check(after[key] === before[key], `${label}: ${key} freezes while paused`);
  await cancelTarget(f, 'PauseScene', 'button:继续游戏'); check((await runFacts(f)).paused, `${label}: cancelling resume keeps the scene paused`);
  await screenshot(f, `pause-${label.replaceAll(/[^a-z0-9]/gi, '-')}`);
  await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  check(!(await runFacts(f)).paused, `${label}: touch resume restores the same route`);
}
async function menuInput(f) {
  return f.page.evaluate(() => {
    const s = window.g.scene.getScene('MenuScene');
    return Object.fromEntries(['button:开始游戏', 'button:settings', 'button:衣橱', 'button:收藏册', 'button:成就册', 'mailbox-entry', 'easter-egg:sheep']
      .map(name => [name, s.children.getByName(name)?.input?.enabled ?? null]));
  });
}
async function menuModalChecks(f) {
  const before = await menuInput(f);
  for (const [entry, close, owner] of [['button:收藏册', 'button:合上收藏册', 'collection'], ['button:成就册', 'button:合上手账', 'journey'], ['mailbox-entry', 'button:合上邮箱', 'mailbox']]) {
    await cancelTarget(f, 'MenuScene', entry);
    check(await f.page.evaluate(() => !window.g.scene.getScene('MenuScene').data.get('menu-modal-owner')), `${f.width}/${f.dpr}: cancelled ${owner} entry leaves menu unlocked`);
    await tap(f, 'MenuScene', entry);
    check(await f.page.evaluate(owner => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === owner, owner), `${f.width}/${f.dpr}: ${owner} obtains the sole menu lock`);
    check(Object.values(await menuInput(f)).every(value => value === false), `${f.width}/${f.dpr}: ${owner} blocks every underlying menu touch entry`);
    // The book close button overlaps the base menu's start position. Use the
    // corner settings entry, whose coordinates contain no modal action button.
    await tap(f, 'MenuScene', 'button:settings');
    check(await f.page.evaluate(() => window.g.scene.isActive('MenuScene') && !window.g.scene.isActive('RunScene')), `${f.width}/${f.dpr}: ${owner} prevents start gesture penetration`);
    await tap(f, 'MenuScene', close);
    check(JSON.stringify(await menuInput(f)) === JSON.stringify(before), `${f.width}/${f.dpr}: ${owner} closing restores exact prior input states`);
  }
  await tap(f, 'MenuScene', 'button:settings'); await ready(f, 'PauseScene');
  check(Object.values(await menuInput(f)).every(value => value === false), `${f.width}/${f.dpr}: settings blocks all menu touches`);
  await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'MenuScene');
  check(JSON.stringify(await menuInput(f)) === JSON.stringify(before), `${f.width}/${f.dpr}: settings restores exact menu state`);
  for (let count = 0; count < 5; count++) { await tap(f, 'MenuScene', 'easter-egg:sheep'); if (await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'private-letter')) break; }
  check(await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'private-letter'), `${f.width}/${f.dpr}: original hidden love letter still opens through touch`);
  check(Object.values(await menuInput(f)).every(value => value === false), `${f.width}/${f.dpr}: love letter excludes mailbox and menu`);
  await tap(f, 'MenuScene', 'button:收下这份喜欢');
  check(JSON.stringify(await menuInput(f)) === JSON.stringify(before), `${f.width}/${f.dpr}: love letter restores menu after closing`);
}
async function naturalDinner() {
  const f = await open(896, 414, 2, 'natural'); await selectDinner(f);
  const protectedBefore = await protectedStorage(f);
  const log = { main: f.main, width: f.width, height: f.height, dpr: f.dpr, actions: [], samples: [], phases: [], failures: [], attempts: 1,
    integrity: 'Only reads actual scene state and dispatches real mobile touch events; no runtime assignments or artificial rewards.' };
  report.natural.push(log);
  let lastActionMs = -1000, lastSampleMs = -1000, wallStart = Date.now(); const seenPhases = new Set();
  for (;;) {
    const s = await f.page.evaluate(() => {
      const run = window.g.scene.getScene('RunScene'), body = run.sheep.body, d = run.delivery;
      return { active: window.g.scene.isActive('RunScene'), finished: run.finished, state: d.state, id: d.chapter.id, phase: d.phase.id,
        distance: d.distance, endingMs: d.endingMs, nowMs: run.activeRunTimeMs, speed: run.difficultySystem.speed,
        x: run.sheep.x, y: run.sheep.y, grounded: run.sheep.grounded, multiplier: run.upgradeEffects.jumpImpulseMultiplier,
        body: { x: body.x, y: body.y, width: body.width, height: body.height },
        obstacles: run.obstacles.getChildren().filter(o => o.active && o.rightEdge > run.sheep.x - 30).map(o => ({ kind: o.definition.kind,
          at: o.getData('delivery-at'), left: o.body.x, width: o.body.width, right: o.rightEdge })).sort((a, b) => a.left - b.left),
        companion: !!run.children.getByName('companion-sheep'), endingVisible: !!run.children.getByName('delivery-sharing-dinner')?.alpha,
      };
    });
    if (s.nowMs - lastSampleMs > 700) { log.samples.push(s); lastSampleMs = s.nowMs; }
    if (!seenPhases.has(s.phase)) { seenPhases.add(s.phase); log.phases.push({ phase: s.phase, distance: s.distance, nowMs: s.nowMs }); await screenshot(f, `natural-phase-${s.phase}-${log.attempts}`); process.stdout.write(JSON.stringify({ naturalPhase: s.phase, attempt: log.attempts, distance: s.distance }) + '\n'); }
    if (s.state === 'complete') { log.complete = s; await screenshot(f, 'natural-dinner-success'); break; }
    if (s.state === 'failed' || s.finished) {
      log.failures.push(s); await screenshot(f, `natural-failure-${log.attempts}`);
      if (log.attempts++ >= 3) throw new Error('Natural dinner touch bot failed three attempts');
      await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene'); lastActionMs = lastSampleMs = -1000; seenPhases.clear(); continue;
    }
    if (Date.now() - wallStart > 260000) throw new Error('Natural dinner touch run exceeded bounded deadline');
    if (s.state === 'ending') { if (!log.endingShot && s.endingVisible && s.endingMs >= 1800) { await screenshot(f, 'natural-sharing-dinner-ending'); log.endingShot = s; } await delay(25); continue; }
    let action = null;
    const hazard = s.obstacles[0];
    if (hazard && s.grounded && s.nowMs - lastActionMs > 200) {
      const duck = ['FlyingBird', 'HangingVine', 'HangingBranch'].includes(hazard.kind);
      if (duck && hazard.left - s.body.x - s.body.width <= s.speed * .06 && hazard.left + hazard.width > s.body.x) action = 'down';
      else if (!duck) {
        const high = hazard.kind === 'TallStack';
        const apex = (high ? Math.min(580 * s.multiplier, 590) : 500 * s.multiplier) / 1450;
        const center = hazard.left + hazard.width / 2 - s.x;
        if (center <= s.speed * (apex + .035) && center > -hazard.width) action = high ? 'up' : 'tap';
      }
    }
    if (action) { log.actions.push({ nowMs: s.nowMs, distance: s.distance, action, kind: hazard.kind, at: hazard.at }); await gesture(f, action); lastActionMs = s.nowMs; }
    await delay(18);
  }
  const actual = await panelFacts(f, 'natural-completion');
  check(actual.mode === 'success' && actual.chapterId === 'dinner-for-you-v1', 'natural full dinner route reaches actual success panel');
  check(log.phases.map(p => p.phase).includes('cottage') && log.endingShot, 'natural run actually displayed the cottage and shared-dinner ending');
  check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(protectedBefore), 'natural completion does not change endless score, coins, journal, collections or mail read state');
  const delivery = await f.page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-delivery-v1')));
  check(delivery.version === 1 && delivery.completedIds.includes('dinner-for-you-v1'), 'natural dinner writes only the independent chapter postcard completion');
  log.saved = delivery; log.protectedBefore = protectedBefore;
  await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene');
  await tap(f, 'MenuScene', 'mailbox-delivery'); await tap(f, 'MenuScene', 'delivery-chapter:dinner-for-you-v1');
  await tap(f, 'MenuScene', 'delivery-card');
  check((await panelFacts(f, 'natural-postcard')).mode === 'postcard', 'naturally earned dinner postcard is readable again from mailbox');
  await screenshot(f, 'natural-postcard-reopened'); await f.context.close();
}
async function isolatedMatrix() {
  for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const f = await open(width, height, dpr, 'isolated'), view = { width, height, dpr, main: f.main, fixtures: [] }; report.views.push(view);
    await menuModalChecks(f); await selectDinner(f); view.initial = await runFacts(f);
    const before = await protectedStorage(f);
    await pauseResume(f, `${width}-${dpr}-initial`);
    await cancelTarget(f, 'RunScene', 'button:暂停'); check(!(await runFacts(f)).paused, `${width}/${dpr}: cancelled pause does not activate overlay`);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:重新开始'); await ready(f, 'RunScene');
    const restarted = await runFacts(f); view.restart = restarted;
    check(restarted.chapterId === 'dinner-for-you-v1' && restarted.distance < 100 && restarted.endlessAbsent && restarted.handlers === 1, `${width}/${dpr}: pause restart preserves dinner ID and clean runtime`);
    await f.page.evaluate(() => window.g.scene.getScene('RunScene').onObstacleOverlap()); view.fixtures.push('Isolated failure: invoked existing collision callback, no physics or rewards changed');
    const failure = await panelFacts(f, `${width}/${dpr}/failure`);
    check(failure.mode === 'failure' && failure.chapterId === 'dinner-for-you-v1', `${width}/${dpr}: failure retains selected chapter and task wording`);
    await screenshot(f, 'dinner-failure'); await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene');
    check((await runFacts(f)).chapterId === 'dinner-for-you-v1', `${width}/${dpr}: real failure retry restarts the same dinner route`);
    for (const [distance, name] of [[6500, 'field'], [12200, 'cottage'], [17500, 'arrival']]) {
      await f.page.evaluate(distance => { const d = window.g.scene.getScene('RunScene').delivery; d.distance = distance; d.next = d.chapter.obstacles.filter(o => o.at <= distance).length; }, distance);
      view.fixtures.push(`Stage fixture: route distance=${distance}; authored cursor skips prior requests only in this isolated context`);
      await frames(f); await screenshot(f, `dinner-${name}`);
    }
    await pauseResume(f, `${width}-${dpr}-arrival`);
    await f.page.evaluate(() => { const d = window.g.scene.getScene('RunScene').delivery; d.distance = d.chapter.length - 1; d.next = d.chapter.obstacles.length; });
    await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'ending');
    await pauseResume(f, `${width}-${dpr}-ending`);
    await f.page.evaluate(() => { const d = window.g.scene.getScene('RunScene').delivery; d.endingMs = 1900; }); await frames(f);
    await screenshot(f, 'sharing-dinner-ending');
    await f.page.evaluate(() => { const d = window.g.scene.getScene('RunScene').delivery; d.endingMs = d.chapter.endingDurationMs - 30; });
    view.fixtures.push('Completion fixture: endingMs advanced after actual ending appeared; production update and DeliveryStore complete perform final transition');
    await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'complete'); await frames(f);
    view.success = await panelFacts(f, `${width}/${dpr}/success`); await screenshot(f, 'dinner-success');
    check(view.success.mode === 'success' && view.success.chapterId === 'dinner-for-you-v1', `${width}/${dpr}: completion panel uses actual selected dinner chapter`);
    check(JSON.stringify(await protectedStorage(f)) === JSON.stringify(before), `${width}/${dpr}: failure/retry/completion preserve protected save, journal, collection and read records`);
    const completion = await f.page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-delivery-v1')));
    check(completion.version === 1 && completion.completedIds.includes('dinner-for-you-v1') && !completion.completedIds.includes('hill-goodnight-v1'), `${width}/${dpr}: postcard completion marks only the actual selected chapter`);
    await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene');
    check(await f.page.locator('[data-adventure-overlay="delivery-hud"]').count() === 0, `${width}/${dpr}: exit removes delivery HUD canvas`);
    check(await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return !s.delivery && !s.deliveryPanel && !s.deliveryView && s.events.listeners('preupdate').filter(l => l === s.onPreUpdate).length === 0; }), `${width}/${dpr}: exited route leaves no controller or update listener`);
    await tap(f, 'MenuScene', 'mailbox-delivery'); await tap(f, 'MenuScene', 'delivery-chapter:dinner-for-you-v1'); await tap(f, 'MenuScene', 'delivery-card');
    check((await panelFacts(f, `${width}/${dpr}/postcard`)).mode === 'postcard', `${width}/${dpr}: earned dinner postcard opens without replaying`);
    await screenshot(f, 'dinner-postcard'); await tap(f, 'MenuScene', 'delivery-back'); await tap(f, 'MenuScene', 'delivery-back'); await tap(f, 'MenuScene', 'button:合上邮箱');
    await selectDinner(f, true); check((await runFacts(f)).chapterId === 'hill-goodnight-v1', `${width}/${dpr}: original chapter remains playable`);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
    await tap(f, 'MenuScene', 'button:合上邮箱'); await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene');
    check(await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return !s.delivery && s.starRoutes && s.runGoal && s.travel; }), `${width}/${dpr}: later endless start clears retained chapter ID and restores A systems`);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
    check(await f.page.locator('[data-menu-art]').count() === 1 && await f.page.locator('[data-adventure-overlay="delivery-panel"]').count() === 1, `${width}/${dpr}: repeated menu entry has one menu surface and one owned hidden delivery panel`);
    await f.page.reload({ waitUntil: 'domcontentloaded' }); await f.page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main); await ready(f, 'MenuScene');
    const persisted = await f.page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-delivery-v1')));
    check(persisted.completedIds.includes('dinner-for-you-v1'), `${width}/${dpr}: dinner postcard survives actual browser refresh`);
    await f.context.close(); process.stdout.write(JSON.stringify({ width, height, dpr, passed: true }) + '\n');
  }
}
try {
  if (['all', 'natural'].includes(phase)) await naturalDinner();
  if (['all', 'matrix'].includes(phase)) await isolatedMatrix();
  check(report.errors.length === 0, 'no runtime exceptions in dinner/original routes, mailbox, modal coordination, restart or refresh');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' }).catch(() => {});
  throw error;
} finally {
  await writeFile(new URL(phase === 'all' ? 'browser-review.json' : `browser-review-${phase}.json`, output), JSON.stringify(report, null, 2)); await browser.close();
}
process.stdout.write(JSON.stringify({ passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors }) + '\n');
