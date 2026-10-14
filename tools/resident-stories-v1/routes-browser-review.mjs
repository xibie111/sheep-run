// Natural play only. Run after the source server and complete generated asset pack are ready.
// PowerShell example: $env:RESIDENT_QA_ROUTE='windmill-thanks-v1'; node tools/resident-stories-v1/routes-browser-review.mjs
// RESIDENT_QA_ROUTES accepts comma-separated IDs; RESIDENT_QA_OUT/URL/WIDTH/HEIGHT/DPR are optional.
// One isolated context per route. No route, clock, collider, body, input, reward or save-economy overrides.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chapterIds = ['windmill-thanks-v1', 'windmill-photo-v1', 'riverside-thanks-v1', 'riverside-sunshine-v1', 'lighthouse-old-letter-v1', 'lighthouse-gathering-v1'];
const chains = {
  windmill: ['windmill-invitation-v1', 'windmill-thanks-v1', 'windmill-photo-v1'],
  riverside: ['rainy-umbrella-v1', 'riverside-thanks-v1', 'riverside-sunshine-v1'],
  lighthouse: ['lighthouse-starlight-v1', 'lighthouse-old-letter-v1', 'lighthouse-gathering-v1'],
};
const chainMode = ['true', '1'].includes(process.env.RESIDENT_QA_CHAIN);
const chainName = process.env.RESIDENT_QA_RESIDENT;
assert(!chainName || chainName in chains, 'RESIDENT_QA_RESIDENT must be windmill, riverside or lighthouse');
const defaultIds = chainMode ? chainName ? chains[chainName] : Object.values(chains).flat() : chapterIds;
const prerequisites = {
  'windmill-thanks-v1': ['windmill-invitation-v1'],
  'windmill-photo-v1': ['windmill-invitation-v1', 'windmill-thanks-v1'],
  'riverside-thanks-v1': ['rainy-umbrella-v1'],
  'riverside-sunshine-v1': ['rainy-umbrella-v1', 'riverside-thanks-v1'],
  'lighthouse-old-letter-v1': ['lighthouse-starlight-v1'],
  'lighthouse-gathering-v1': ['lighthouse-starlight-v1', 'lighthouse-old-letter-v1'],
};
const selected = (process.env.RESIDENT_QA_ROUTES || process.env.RESIDENT_QA_ROUTE || defaultIds.join(',')).split(',').map(id => id.trim()).filter(Boolean);
assert(selected.length && new Set(selected).size === selected.length && selected.every(id => defaultIds.includes(id)), 'Route filter must contain unique IDs from the requested route/chain set');
if (chainMode) assert(JSON.stringify(selected) === JSON.stringify(defaultIds), 'Chain mode requires all ordered stages; choose RESIDENT_QA_RESIDENT to run one complete chain');
const positive = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  assert(Number.isFinite(value) && value > 0, `${name} must be positive`); return value;
};
const url = process.env.RESIDENT_QA_URL || 'http://127.0.0.1:4382/';
const width = positive('RESIDENT_QA_WIDTH', 896), height = positive('RESIDENT_QA_HEIGHT', 414), dpr = positive('RESIDENT_QA_DPR', 2);
const deadlineMs = positive('RESIDENT_QA_TIMEOUT_MS', 300000);
// Bot timing inputs are read from the unchanged controls, never assigned into the game.
// Production bundles keep these module constants private; validate gravity against the live world below.
const controlSource = await readFile(new URL('../../src/game/Constants.ts', import.meta.url), 'utf8');
const constants = Object.fromEntries(['PLAYER', 'RUN', 'INPUT'].map(name => {
  const body = controlSource.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const;`))?.[1];
  assert(body, `Cannot read existing ${name} controls`);
  return [name, Object.fromEntries([...body.matchAll(/\b(\w+)\s*:\s*(-?\d+(?:\.\d+)?)/g)].map(([, key, value]) => [key, Number(value)]))];
}));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.RESIDENT_QA_OUT || fileURLToPath(new URL(`../../docs/resident-stories-v1/routes-browser/${stamp}-${process.pid}/`, import.meta.url)));
await mkdir(resolve(output, 'screenshots'), { recursive: true });
const reportPath = resolve(output, `routes-${selected.length === 1 ? selected[0] : 'all'}-${process.pid}.json`);
const report = {
  passed: false, startedAt: new Date().toISOString(), url, viewport: { width, height, dpr }, selected, chainMode, chainName,
  phoneHardware: false, engine: 'Edge Chromium mobile touch emulation',
  method: 'Actual app (source or immutable production bundle), real elapsed scene time and active collisions. UI entry, tap jumps and CDP up/down swipes only. Runtime observation is read-only. No direct route completion, time acceleration, invulnerability, obstacle removal or economic fixtures.',
  controlSourceSha256: createHash('sha256').update(controlSource).digest('hex'),
  fixture: chainMode ? 'No localStorage fixtures. A fresh browser context plays each first chapter followed by its two new stages, sharing only naturally earned completions. No completion, stamp, letter or reward is injected.'
    : 'Only sheep-run-delivery-v1 prerequisite completedIds are seeded in each isolated browser context. The target route is initially incomplete; its postcards, stars and keepsake must be earned through real play.',
  output, checks: [], routes: [], errors: [], warnings: [], screenshots: [], captureFailures: [], sourceChanges: [],
};
const check = (condition, name) => { assert(condition, name); report.checks.push(name); };
const delay = ms => new Promise(done => setTimeout(done, ms));
const checkpoint = () => writeFile(reportPath, JSON.stringify(report, null, 2));
const progress = detail => process.stdout.write(JSON.stringify({ time: new Date().toISOString(), ...detail }) + '\n');
const panelSelector = '[data-adventure-overlay="delivery-panel"]:visible';
const protectedKeys = ['sheep-run-save', 'sheep-run-journey-v1', 'sheep-run-collections-v1', 'sheep-run-mailbox-v1'];
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--mute-audio'] });

async function frames(f, count = 2) {
  await f.page.evaluate(count => new Promise((done, reject) => {
    const timer = setTimeout(() => { window.g.events.off('postrender', after); reject(new Error('No Phaser postrender within 5 seconds')); }, 5000);
    const after = () => { if (!--count) { clearTimeout(timer); window.g.events.off('postrender', after); done(); } };
    window.g.events.on('postrender', after);
  }), count);
}
async function ready(f, scene) {
  await f.page.waitForFunction(scene => window.g?.scene.isActive(scene) && window.g.scene.getScene(scene).children.list.length, scene, { timeout: 30000 });
  await frames(f);
}
async function screenshot(f, label) {
  const name = `${f.id}-${width}x${height}-dpr${dpr}-${label}.png`;
  const path = resolve(output, 'screenshots', name);
  let timer;
  try {
    const capture = f.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true });
    const { data } = await Promise.race([capture, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('CDP screenshot exceeded 20 seconds')), 20000); })]);
    await writeFile(path, Buffer.from(data, 'base64')); report.screenshots.push(path); return path;
  } catch (error) {
    report.captureFailures.push({ id: f.id, label, message: String(error) }); return null;
  } finally { clearTimeout(timer); }
}
async function target(f, scene, name) {
  return f.page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene);
    const find = list => { for (const item of list) { if (item.name === name && item.input?.enabled) return item; const child = item.list && find(item.list); if (child) return child; } };
    const object = find(s.children.list);
    if (!object) throw new Error(`Missing enabled touch target ${scene}/${name}`);
    const box = object.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    const point = { x: canvas.x + (box.centerX - s.cameras.main.scrollX * object.scrollFactorX) * canvas.width / size.width,
      y: canvas.y + (box.centerY - s.cameras.main.scrollY * object.scrollFactorY) * canvas.height / size.height };
    if (!(point.x >= canvas.x && point.x <= canvas.right && point.y >= canvas.y && point.y <= canvas.bottom)) throw new Error(`Touch target outside canvas: ${scene}/${name} ${JSON.stringify(point)}`);
    return { ...point, object: { x: object.x, y: object.y, width: object.width, height: object.height,
      bounds: { x: box.x, y: box.y, width: box.width, height: box.height }, hitArea: { ...object.input.hitArea } } };
  }, { scene, name });
}
async function tap(f, scene, name) {
  const p = await target(f, scene, name); f.touches.push({ scene, name, ...p });
  await f.page.touchscreen.tap(p.x, p.y); await frames(f);
}
async function gesture(f, action) {
  const p = f.gesturePoint;
  assert(p, 'Fixed viewport touch coordinate must be captured before natural play');
  if (action === 'tap') { await f.page.touchscreen.tap(p.x, p.y); return; }
  const point = { x: p.x, y: p.y, id: 1, radiusX: 1, radiusY: 1, force: 1 };
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: p.y + (action === 'up' ? -46 : 46) * p.unit }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function panelFacts(f) {
  await f.page.locator(panelSelector).waitFor({ state: 'visible', timeout: 10000 });
  return f.page.locator(panelSelector).evaluate(canvas => ({ ...canvas.dataset, width: canvas.width, height: canvas.height,
    cssWidth: parseFloat(canvas.style.width), cssHeight: parseFloat(canvas.style.height), smoothing: canvas.getContext('2d').imageSmoothingEnabled }));
}
async function storage(f) {
  return f.page.evaluate(keys => ({ protected: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])),
    completion: JSON.parse(localStorage.getItem('sheep-run-delivery-v1')), challenge: JSON.parse(localStorage.getItem('sheep-run-delivery-challenges-v1')) }), protectedKeys);
}
async function runFacts(f) {
  return f.page.evaluate(() => {
    const run = window.g.scene.getScene('RunScene'), body = run.sheep.body, d = run.delivery;
    const box = object => ({ x: object.x, y: object.y, width: object.width, height: object.height });
    const canvas = window.g.canvas.getBoundingClientRect();
    return {
      active: window.g.scene.isActive('RunScene'), paused: window.g.scene.isPaused('RunScene'), finished: run.finished,
      state: d.state, id: d.chapter.id, phase: d.phase.id, phaseWeather: d.phase.weather ?? d.chapter.weather,
      activeWeather: run.deliveryWeather, environment: run.environmentSystem?.presentation(),
      distance: d.distance, endingMs: d.endingMs, nowMs: run.activeRunTimeMs, runningSeconds: run.difficultySystem.elapsed, speed: run.difficultySystem.speed,
      x: run.sheep.x, y: run.sheep.y, grounded: run.sheep.grounded, motion: run.sheep.motionState, multiplier: run.upgradeEffects.jumpImpulseMultiplier,
      body: { ...box(body), velocityY: body.velocity.y, enable: body.enable },
      physics: { paused: run.physics.world.isPaused, timeScale: run.physics.world.timeScale, sceneTimeScale: run.time.timeScale, gravityY: run.physics.world.gravity.y,
        colliders: run.physics.world.colliders.getActive().length },
      obstacles: run.obstacles.getChildren().filter(o => o.active).map(o => ({ kind: o.definition.kind, at: o.getData('delivery-at'),
        left: o.body.x, top: o.body.y, width: o.body.width, height: o.body.height, right: o.body.right, enabled: o.body.enable })).sort((a, b) => a.left - b.left),
      challenge: d.challenge?.snapshot(), stamps: d.chapter.challenge.stamps.map(stamp => {
        const image = run.children.getByName(`delivery-postage:${stamp.id}`);
        return { ...stamp, x: image?.x, y: image?.y, visible: image?.visible, collected: d.challenge.isCollected(stamp.id) };
      }),
      ending: run.children.list.filter(o => o.name === `delivery-ending-${d.chapter.endingKind}` || o.name.startsWith('resident-ending-npc:') || o.name === 'resident-photo-flash')
        .map(o => ({ name: o.name, alpha: o.alpha, visible: o.visible, texture: o.texture?.key })),
      endlessAbsent: !run.starRoutes && !run.runGoal && !run.travel && !run.journey && !run.companions,
      currencyPickups: run.stars.getChildren().filter(o => o.active).length + run.powerUps.getChildren().filter(o => o.active).length,
      listeners: run.events.listeners('preupdate').filter(listener => listener === run.onPreUpdate).length,
      canvas: { width: canvas.width, height: canvas.height, backingWidth: window.g.canvas.width, backingHeight: window.g.canvas.height,
        logicalWidth: window.g.scale.gameSize.width, logicalHeight: window.g.scale.gameSize.height },
    };
  });
}
async function open(id) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await context.newPage(), f = { id, context, page, touches: [], cdp: await context.newCDPSession(page) };
  await page.exposeBinding('__residentQaTouch', async (_source, packet) => { if (f.botAction) await f.botAction(packet); });
  page.on('pageerror', error => report.errors.push({ id: f.id, type: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push({ id: f.id, type: 'console', message: message.text() });
    if (message.type() === 'warning') report.warnings.push({ id: f.id, message: message.text() });
  });
  page.on('requestfailed', request => report.errors.push({ id: f.id, type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
    let packet; try { packet = JSON.parse(String(payload)); } catch { return; }
    if (['update', 'full-reload', 'prune'].includes(packet.type)) report.sourceChanges.push({ id: f.id, type: packet.type, at: new Date().toISOString() });
  }));
  if (!chainMode) await page.addInitScript(ids => {
    // This is the only gameplay-related fixture write. Never seed the route under test.
    localStorage.setItem('sheep-run-delivery-v1', JSON.stringify({ version: 1, completedIds: ids }));
  }, prerequisites[id]);
  const mainRequest = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()), { timeout: 30000 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await mainRequest).url();
  // Import the already-loaded entry solely to obtain a read-only observation reference.
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  await ready(f, 'MenuScene');
  f.constants = constants;
  const save = await storage(f);
  check(!save.completion?.completedIds.includes(id) && !save.challenge?.chapters[id], `${id}: target completion/rating initially absent`);
  return f;
}
async function selectChapter(f) {
  const mailboxClosed = await f.page.evaluate(() => window.g.scene.getScene('MenuScene').children.getByName('mailbox-entry').input.enabled);
  if (mailboxClosed) await tap(f, 'MenuScene', 'mailbox-entry');
  await tap(f, 'MenuScene', 'mailbox-delivery');
  let facts = await panelFacts(f);
  check(facts.mode === 'select', `${f.id}: touch opens chapter selection`);
  const seenPages = new Set();
  while (!JSON.parse(facts.visibleChapterIds).includes(f.id)) {
    assert(!seenPages.has(facts.page), `Chapter list loop while selecting ${f.id}`); seenPages.add(facts.page);
    assert(+facts.page + 1 < +facts.pageCount, `Chapter ${f.id} missing from touch chapter list`);
    await tap(f, 'MenuScene', 'delivery-next'); facts = await panelFacts(f);
  }
  check(!JSON.parse(facts.lockedChapterIds).includes(f.id), `${f.id}: ${chainMode ? 'naturally earned prerequisite' : 'prerequisite-only fixture'} permits chapter selection`);
  await tap(f, 'MenuScene', `delivery-chapter:${f.id}`); facts = await panelFacts(f);
  check(facts.mode === 'brief' && facts.chapterId === f.id, `${f.id}: exact chapter brief opens through touch`);
  await screenshot(f, 'brief'); await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
  const state = await runFacts(f);
  f.gesturePoint = await f.page.evaluate(() => {
    const r = window.g.canvas.getBoundingClientRect();
    return { x: r.x + r.width * .68, y: r.y + r.height * .5, unit: r.width / window.g.scale.gameSize.width };
  });
  check(state.id === f.id && state.endlessAbsent && state.currencyPickups === 0 && state.listeners === 1, `${f.id}: exact chapter starts once without endless pickups/systems`);
  return state;
}
async function pauseResume(f, log, label) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  const before = await runFacts(f); await delay(240); const after = await runFacts(f);
  check(before.paused && after.paused, `${f.id}/${label}: UI pauses RunScene`);
  for (const key of ['distance', 'nowMs', 'endingMs', 'runningSeconds', 'state']) check(before[key] === after[key], `${f.id}/${label}: ${key} frozen during pause`);
  await screenshot(f, `pause-${label}`);
  await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  const resumed = await runFacts(f); check(!resumed.paused && resumed.id === f.id, `${f.id}/${label}: touch resumes same chapter`);
  log.pauses.push({ label, before, after, resumed });
}
async function intentionalFailureAndRetry(f, log) {
  progress({ chapter: f.id, stage: 'intentional-real-collision' });
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.state === 'failed', null, { timeout: 18000 });
  const failed = await runFacts(f), panel = await panelFacts(f), save = await storage(f);
  check(panel.mode === 'failure' && failed.challenge.successful === false && failed.challenge.stars === 0, `${f.id}: actual unavoided collision fails without star awards`);
  check(!save.completion.completedIds.includes(f.id) && !save.challenge?.chapters[f.id], `${f.id}: real failure does not save completion/postcard/keepsake`);
  log.intentionalFailure = failed; await screenshot(f, 'intentional-failure');
  await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene');
  const retried = await runFacts(f);
  check(retried.id === f.id && retried.state === 'running' && retried.distance < 100 && retried.listeners === 1, `${f.id}: touch retry resets same route without duplicate update listeners`);
  log.retry = retried; await pauseResume(f, log, 'running');
}
async function backgroundDuringEnding(f, log) {
  // A real browser-tab switch may produce visibilitychange in headed Chromium.
  // Some headless versions keep every tab visible: record that limitation rather
  // than synthesizing DOM events, changing visibility getters or freezing clocks.
  const other = await f.context.newPage();
  try {
    await other.bringToFront(); await delay(100);
    const visibility = await f.page.evaluate(() => ({ state: document.visibilityState, focused: document.hasFocus() }));
    const before = await runFacts(f); await delay(240); const after = await runFacts(f);
    log.endingBackground = { method: 'Actual second tab + bringToFront; no synthesized visibility events', visibility, before, after };
    if (visibility.state === 'hidden' || before.paused) {
      check(before.paused && after.paused, `${f.id}: ending pauses on actual tab visibility/focus loss`);
      for (const key of ['nowMs', 'distance', 'endingMs']) check(before[key] === after[key], `${f.id}: ${key} freezes while browser tab is away`);
    } else log.endingBackground.limitation = 'This headless Edge keeps the original tab visible/focused; real hidden-tab suspension was not exercised. Explicit touch pause is tested separately.';
  } finally { await other.close(); await f.page.bringToFront(); }
  if ((await runFacts(f)).paused) {
    await ready(f, 'PauseScene'); await screenshot(f, 'ending-background-paused');
    await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  }
}
async function residentEvidence(f, log) {
  await tap(f, 'MenuScene', 'mailbox-residents');
  const panel = f.page.locator('[data-adventure-overlay="resident-panel"]:visible');
  const facts = async () => { await panel.waitFor({ state: 'visible' }); return panel.evaluate(canvas => ({ ...canvas.dataset })); };
  const list = await facts(), state = JSON.parse(list.progress);
  const resident = state.residents.find(resident => resident.stages.some(item => item.stage.chapterId === f.id));
  const stage = resident.stages.find(item => item.stage.chapterId === f.id), letterId = stage.stage.letterId;
  check(stage.completed && stage.letterUnlocked && stage.unread, `${f.id}: actual new completion unlocks its unread resident letter`);
  log.residentProgress = state; await screenshot(f, 'resident-progress');
  await tap(f, 'MenuScene', `resident-resident:${resident.resident.id}`);
  await tap(f, 'MenuScene', 'resident-letters');
  let letters = await facts(); const seen = new Set();
  while (!JSON.parse(letters.enabled).includes(`resident-letter:${letterId}`)) {
    assert(!seen.has(letters.page), `${f.id}: new letter is missing from actual letter pages`); seen.add(letters.page);
    assert(JSON.parse(letters.enabled).includes('resident-next'), `${f.id}: no next page for newly unlocked letter`);
    await tap(f, 'MenuScene', 'resident-next'); letters = await facts();
  }
  await tap(f, 'MenuScene', `resident-letter:${letterId}`);
  log.letter = { id: letterId, pages: [] };
  let reader = await facts();
  check(reader.mode === 'read' && reader.letterId === letterId, `${f.id}: touch opens its actual earned reply`);
  for (;;) {
    log.letter.pages.push({ page: +reader.page, count: +reader.pageCount, lines: JSON.parse(reader.lines) });
    await screenshot(f, `letter-page-${+reader.page + 1}`);
    if (+reader.page + 1 === +reader.pageCount) break;
    await tap(f, 'MenuScene', 'resident-next'); reader = await facts();
  }
  check(JSON.parse(reader.enabled).includes('resident-keep'), `${f.id}: reply can be kept after visiting all its pages`);
  await tap(f, 'MenuScene', 'resident-keep');
  const kept = await facts(), after = JSON.parse(kept.progress);
  check(!after.residents.find(item => item.resident.id === resident.resident.id).stages.find(item => item.stage.chapterId === f.id).unread,
    `${f.id}: keeping the earned letter clears its unread state`);
  await tap(f, 'MenuScene', 'resident-back');
  const detail = await facts();
  if (resident.keepsakeUnlocked) {
    check(JSON.parse(detail.enabled).includes('resident-keepsake'), `${f.id}: completing stage three unlocks the resident illustration`);
    await tap(f, 'MenuScene', 'resident-keepsake'); log.keepsake = await facts(); await screenshot(f, 'resident-keepsake');
    check(log.keepsake.mode === 'keepsake', `${f.id}: real touch opens the earned resident illustration`);
    await tap(f, 'MenuScene', 'resident-back');
  } else check(!JSON.parse(detail.enabled).includes('resident-keepsake'), `${f.id}: resident illustration remains locked before stage three`);
  await tap(f, 'MenuScene', 'resident-back');
  const returned = await facts();
  if (state.groupPhotoUnlocked) {
    await tap(f, 'MenuScene', 'resident-group'); log.groupPhoto = await facts(); await screenshot(f, 'resident-group-photo');
    check(log.groupPhoto.mode === 'group', `${f.id}: all nine naturally completed stages unlock the group photograph`);
    await tap(f, 'MenuScene', 'resident-back');
  } else check(!JSON.parse(returned.enabled).includes('resident-group'), `${f.id}: group photograph remains locked before all stories finish`);
  await tap(f, 'MenuScene', 'resident-back');
}
function decideAction(s, constants, acted, hiddenActed) {
  if (!s.grounded) return null;
  const hazard = s.obstacles.find(o => o.enabled && o.right > s.body.x);
  if (hazard && !acted.has(hazard.at)) {
    const duck = ['FlyingBird', 'HangingVine', 'HangingBranch'].includes(hazard.kind);
    const gap = hazard.left - s.body.x - s.body.width;
    if (duck) {
      // Fit the unchanged crouch window around the whole body/obstacle crossing.
      const crossing = (hazard.width + s.body.width) / s.speed;
      const leadSeconds = Math.max(.025, Math.min(.055, constants.INPUT.crouchDurationMs / 1000 - crossing - .025));
      if (gap <= s.speed * leadSeconds && hazard.right > s.body.x) return { action: 'down', why: hazard.kind, at: hazard.at, gap, leadSeconds };
    } else {
      const high = hazard.kind === 'TallStack';
      const impulse = high ? Math.min(-constants.PLAYER.highJumpVelocityY * s.multiplier, constants.PLAYER.maxHighJumpSpeed) : -constants.PLAYER.jumpVelocityY * s.multiplier;
      const apex = impulse / constants.PLAYER.gravityY, center = hazard.left + hazard.width / 2 - s.x;
      if (center <= s.speed * (apex + (high ? .035 : .075)) && center > -hazard.width) return { action: high ? 'up' : 'tap', why: hazard.kind, at: hazard.at, gap, apex };
    }
  }
  const hidden = s.stamps.find(stamp => stamp.kind === 'keepsake' && !stamp.collected && !hiddenActed.has(stamp.id));
  const apex = Math.min(-constants.PLAYER.highJumpVelocityY * s.multiplier, constants.PLAYER.maxHighJumpSpeed) / constants.PLAYER.gravityY;
  if (hidden && hidden.x > s.body.x && hidden.x - s.x <= s.speed * (apex + .015) && (!hazard || hazard.left > s.body.x + s.speed * .85)) {
    return { action: 'up', why: hidden.id, stampId: hidden.id, apex };
  }
  return null;
}
async function installTouchObserver(f, log) {
  f.botAction = async ({ action, state }) => {
    const record = { nowMs: state.nowMs, distance: state.distance, speed: state.speed, ...action, body: state.body, hazards: state.obstacles };
    log.actions.push(record); const started = Date.now();
    await gesture(f, action.action); record.dispatchDurationMs = Date.now() - started;
  };
  await f.page.evaluate(({ control, chooseSource }) => {
    // Install one read-only observer. Its local sets prevent duplicate bot touches;
    // it never changes player, route, collision, input, seed, clock or save fields.
    const choose = (0, eval)(`(${chooseSource})`), scene = window.g.scene.getScene('RunScene');
    const acted = new Set(), hiddenActed = new Set(); let pending = false, disposed = false;
    const observe = () => {
      const d = scene.delivery, body = scene.sheep.body;
      if (disposed || pending || d.state !== 'running' || scene.finished || !scene.sheep.grounded) return;
      const state = { nowMs: scene.activeRunTimeMs, distance: d.distance, speed: scene.difficultySystem.speed,
        x: scene.sheep.x, y: scene.sheep.y, grounded: scene.sheep.grounded, multiplier: scene.upgradeEffects.jumpImpulseMultiplier,
        body: { x: body.x, y: body.y, width: body.width, height: body.height },
        obstacles: scene.obstacles.getChildren().filter(o => o.active && o.body.enable).map(o => ({ kind: o.definition.kind,
          at: o.getData('delivery-at'), left: o.body.x, top: o.body.y, width: o.body.width, height: o.body.height, right: o.body.right, enabled: o.body.enable })).sort((a, b) => a.left - b.left),
        stamps: d.chapter.challenge.stamps.filter(stamp => stamp.kind === 'keepsake').map(stamp => {
          const image = scene.children.getByName(`delivery-postage:${stamp.id}`);
          return { ...stamp, x: image.x, y: image.y, collected: d.challenge.isCollected(stamp.id) };
        }) };
      const action = choose(state, control, acted, hiddenActed); if (!action) return;
      if (action.at !== undefined) acted.add(action.at); if (action.stampId) hiddenActed.add(action.stampId);
      pending = true;
      window.__residentQaTouch({ action, state }).then(() => { pending = false; }, error => { pending = false; window.__residentQaObserver.error = String(error); });
    };
    window.__residentQaObserver = { stop() { disposed = true; scene.events.off('postupdate', observe); } };
    scene.events.on('postupdate', observe);
  }, { control: f.constants, chooseSource: decideAction.toString() });
}
async function naturalRoute(id, shared) {
  const f = shared ?? await open(id); f.id = id; f.touches = [];
  const initial = await storage(f);
  check(!initial.completion?.completedIds.includes(id), `${id}: completion has not been prefilled`);
  const log = { id, main: f.main, fixtureCompletedIds: chainMode ? [] : prerequisites[id], initial, constants: f.constants, touches: f.touches,
    actions: [], samples: [], phases: [], pickups: [], pauses: [], observedObstacleAts: [], phaseScreenshots: [], observationGaps: [] };
  report.routes.push(log); await checkpoint();
  try {
    await selectChapter(f); log.before = await storage(f);
    const chapter = await f.page.evaluate(() => {
      const chapter = window.g.scene.getScene('RunScene').delivery.chapter;
      return { id: chapter.id, title: chapter.title, length: chapter.length, seed: chapter.seed, phases: chapter.phases,
        endingDurationMs: chapter.endingDurationMs, obstacles: chapter.obstacles.map(item => ({ at: item.at, kind: item.definition.kind, phase: item.phase })),
        stamps: chapter.challenge.stamps, postcardTitle: chapter.postcardTitle, postcardKey: chapter.postcardKey,
        endingKey: chapter.endingKey, endingKind: chapter.endingKind, residentEnding: chapter.residentEnding };
    });
    log.chapter = chapter; log.planHash = createHash('sha256').update(JSON.stringify(chapter.obstacles)).digest('hex');
    const lifecycle = id === 'windmill-thanks-v1' && process.env.RESIDENT_QA_SKIP_LIFECYCLE !== '1';
    if (lifecycle) await intentionalFailureAndRetry(f, log);
    await installTouchObserver(f, log);
    const wallStart = Date.now(), observed = new Set(), seenPhases = new Set();
    let lastSampleMs = -1000, lastCollected = '', pendingPhaseShot = null, lastObservationWall = Date.now(), lastObservationGame = 0;
    for (;;) {
      const requestStarted = Date.now(), s = await runFacts(f), observedAt = Date.now(); log.lastState = s;
      if (observedAt - lastObservationWall > 150) log.observationGaps.push({ wallMs: observedAt - lastObservationWall,
        protocolMs: observedAt - requestStarted, gameMs: s.nowMs - lastObservationGame, atMs: s.nowMs, distance: s.distance, phase: s.phase });
      lastObservationWall = observedAt; lastObservationGame = s.nowMs;
      if (report.errors.some(error => error.id === id)) throw new Error(`Browser runtime/console/request errors in ${id}: ${JSON.stringify(report.errors.filter(error => error.id === id))}`);
      if (report.sourceChanges.some(change => change.id === id)) throw new Error(`Source changed during natural route ${id}; rerun against a stable source snapshot`);
      if (Date.now() - wallStart > deadlineMs) throw new Error(`${id} exceeded ${deadlineMs} ms wall deadline at ${s.phase}/${s.distance}; effective running seconds ${s.runningSeconds}`);
      if (s.nowMs - lastSampleMs >= 750) { log.samples.push(s); lastSampleMs = s.nowMs; }
      s.obstacles.forEach(o => observed.add(o.at));
      const collected = JSON.stringify(s.challenge.collectedIds);
      if (collected !== lastCollected) { log.pickups.push({ nowMs: s.nowMs, distance: s.distance, ...s.challenge }); lastCollected = collected; }
      if (!seenPhases.has(s.phase)) {
        seenPhases.add(s.phase); log.phases.push({ phase: s.phase, distance: s.distance, nowMs: s.nowMs, phaseWeather: s.phaseWeather, activeWeather: s.activeWeather, environment: s.environment });
        pendingPhaseShot = s.phase; await checkpoint(); progress({ chapter: id, phase: s.phase, distance: Math.round(s.distance), runningSeconds: s.runningSeconds });
      }
      if (s.state === 'failed' || s.finished && s.state !== 'complete') {
        log.unexpectedFailure = s; await screenshot(f, 'unexpected-failure');
        throw new Error(`Natural touch route ${id} failed at phase ${s.phase}, distance ${Math.round(s.distance)}; latest action ${JSON.stringify(log.actions.at(-1))}; hazards ${JSON.stringify(s.obstacles)}`);
      }
      if (s.state === 'complete') { log.complete = s; log.wallDurationMs = Date.now() - wallStart; break; }
      if (s.state === 'ending') {
        if (lifecycle && !log.pauses.some(pause => pause.label === 'ending') && s.endingMs >= 650) { await pauseResume(f, log, 'ending'); continue; }
        if (lifecycle && !log.endingBackground && s.endingMs >= 2400) { await backgroundDuringEnding(f, log); continue; }
        if (!log.endingShot && s.endingMs >= 1900 && s.ending.some(o => o.name === `delivery-ending-${chapter.endingKind}` && o.visible && o.alpha > .9)) {
          log.endingShot = { state: s, path: await screenshot(f, 'ending') }; await checkpoint();
        }
        await delay(20); continue;
      }
      assert(s.physics.timeScale === 1 && s.physics.sceneTimeScale === 1 && s.physics.gravityY === f.constants.PLAYER.gravityY && !s.physics.paused && s.body.enable && s.physics.colliders > 0,
        `${id}: running scene must retain natural clocks and active physics/colliders`);
      if (process.env.RESIDENT_QA_PHASE_SCREENSHOTS === '1' && pendingPhaseShot && s.grounded && !s.obstacles.some(o => o.right > s.body.x) &&
        !chapter.obstacles.some(o => o.at > s.distance && o.at - s.distance < s.speed * 3.5)) {
        // Never block the bot for a screenshot while an imminent obstacle needs input.
        const started = Date.now();
        log.phaseScreenshots.push({ phase: pendingPhaseShot, path: await screenshot(f, `phase-${pendingPhaseShot}`), durationMs: Date.now() - started, distance: s.distance }); pendingPhaseShot = null;
      }
      await delay(35);
    }
    log.observedObstacleAts = [...observed].sort((a, b) => a - b);
    check(log.complete.runningSeconds >= 60 && log.complete.runningSeconds <= 90, `${id}: real effective route duration is within 60–90 seconds`);
    check(JSON.stringify(log.phases.map(phase => phase.phase)) === JSON.stringify(chapter.phases.map(phase => phase.id)), `${id}: all four authored phases reached naturally in order`);
    check(log.phases.every(phase => phase.phaseWeather === phase.activeWeather), `${id}: runtime weather follows authored phases`);
    check(JSON.stringify(log.observedObstacleAts) === JSON.stringify(chapter.obstacles.map(obstacle => obstacle.at)), `${id}: all authored hazards actually spawned and passed with collisions enabled`);
    check(log.endingShot && log.complete.endingMs === chapter.endingDurationMs, `${id}: normal ending art and full presentation time reached`);
    const panel = await panelFacts(f); log.successPanel = panel;
    check(panel.mode === 'success' && panel.chapterId === id, `${id}: real successful delivery panel appears`);
    check(panel.width === Math.round(panel.cssWidth * dpr) && panel.height === Math.round(panel.cssHeight * dpr) && !panel.smoothing, `${id}: completion panel uses crisp DPR-aware drawing`);
    log.successScreenshot = await screenshot(f, 'success'); log.after = await storage(f);
    check(JSON.stringify(log.after.protected) === JSON.stringify(log.before.protected), `${id}: economic/private/collection stores unchanged by failure and delivery`);
    check(log.after.completion.completedIds.includes(id), `${id}: successful natural delivery persists target completion`);
    check(log.after.challenge.chapters[id].bestStars === log.complete.challenge.stars && log.after.challenge.chapters[id].keepsake === log.complete.challenge.hiddenCollected,
      `${id}: saved star/keepsake result matches actually collected stamps`);
    log.postage = { ordinary: log.complete.challenge.ordinaryCollected, hidden: log.complete.challenge.hiddenCollected, stars: log.complete.challenge.stars,
      threeStarsAchieved: log.complete.challenge.stars === 3, note: 'Natural collection result only; stars do not gate story completion.' };
    await tap(f, 'RunScene', 'delivery-card'); const postcard = await panelFacts(f); log.postcardPanel = postcard;
    check(postcard.mode === 'postcard' && postcard.chapterId === id && JSON.parse(postcard.lines).some(line => line.text === chapter.postcardTitle), `${id}: touch opens exact earned postcard/title`);
    log.postcardScreenshot = await screenshot(f, 'postcard'); await tap(f, 'RunScene', 'delivery-back'); await tap(f, 'RunScene', 'delivery-back'); await ready(f, 'MenuScene');
    check(!await f.page.evaluate(() => window.g.scene.isActive('RunScene')), `${id}: touch exit cleans up route and returns to menu`);
    if (chainMode) await residentEvidence(f, log);
    log.passed = true; await checkpoint(); progress({ chapter: id, passed: true, runningSeconds: log.complete.runningSeconds, wallDurationMs: log.wallDurationMs, postage: log.postage });
  } catch (error) {
    log.failure = error.stack;
    log.failureUi = await f.page.evaluate(() => ({ owner: window.g.scene.getScene('MenuScene').data.get('menu-modal-owner'),
      pointer: { x: window.g.input.activePointer.x, y: window.g.input.activePointer.y, wasTouch: window.g.input.activePointer.wasTouch },
      overlays: [...document.querySelectorAll('[data-adventure-overlay]')].map(canvas => ({ ...canvas.dataset, display: canvas.style.display })) })).catch(() => null);
    await screenshot(f, 'failure-debug').catch(screenshotError => { log.screenshotFailure = String(screenshotError); }); await checkpoint(); throw error;
  } finally {
    await f.page.evaluate(() => window.__residentQaObserver?.stop()).catch(() => {}); f.botAction = undefined;
    if (!shared) await f.context.close();
  }
}

try {
  progress({ stage: 'starting', selected, url, output, reportPath });
  const shared = chainMode ? await open(selected[0]) : undefined;
  try {
    for (const id of selected) await naturalRoute(id, shared);
    if (shared) {
      report.finalStorage = await shared.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, JSON.parse(localStorage.getItem(key))])));
      check(selected.every(id => report.finalStorage['sheep-run-delivery-v1'].completedIds.includes(id)), 'Fresh player completed every selected stage in order without completion fixtures');
      check(report.routes.every(route => report.finalStorage['sheep-run-mailbox-v1'].readIds.includes(route.letter.id)), 'Every naturally unlocked reply was opened, paged through and kept by real touch');
    }
  } finally { if (shared) await shared.context.close(); }
  check(new Set(report.routes.map(route => route.chapter.seed)).size === selected.length && new Set(report.routes.map(route => route.planHash)).size === selected.length,
    'Selected routes retain distinct actual runtime seeds and obstacle plans');
  check(report.errors.length === 0, 'No page, console or failed-request errors');
  check(report.sourceChanges.length === 0, 'No source reloads/updates during verification');
  check(report.routes.every(route => route.successScreenshot && route.postcardScreenshot && route.endingShot?.path), 'Each naturally completed route has its actual ending, success and postcard screenshots');
  report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString(); await checkpoint(); await browser.close();
  progress({ passed: report.passed, completedRoutes: report.routes.filter(route => route.passed).map(route => route.id), reportPath, failure: report.failure });
}
