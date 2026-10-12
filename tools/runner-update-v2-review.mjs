import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.RUNNER_V2_REVIEW_URL || 'http://127.0.0.1:4331/';
const phase = process.env.RUNNER_V2_REVIEW_PHASE || 'all';
const output = new URL('../docs/runner-update-v2/browser/', import.meta.url);
await mkdir(new URL(phase === 'production' ? 'screenshots/production/' : 'screenshots/', output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = {
  passed: false, url, phase, phoneHardware: false, engine: 'Edge Chromium mobile touchscreen emulation',
  methods: {
    natural: 'Unmodified new-run gameplay. Read-only observed obstacles/stars choose real touch taps and vertical swipes. No score, physics, difficulty, immunity, random seed, object, scheduler or clock mutations.',
    isolated: 'Separate browser contexts with local save fixtures. Gameplay is frozen only inside acceptance contexts. Accepted pickup/pass callbacks, conserved route planning and companion pickup/display state are exercised with explicit fixtures; this is not natural gameplay or phone evidence.',
  },
  views: [], natural: [], checks: [], screenshots: [], errors: [], expectedResourceMessages: [],
  hotReloadsSuppressed: [],
};
const check = (value, label) => { assert(value, label); report.checks.push(label); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
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
async function open(width, height, dpr, fixture = 'isolated', reduced = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  // QA evidence is written into the watched workspace. Keep Vite connected but
  // suppress its dev-only reload messages; this changes no production objects.
  await context.routeWebSocket('**/*', socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => server.send(message));
    server.onMessage(message => {
      let value; try { value = JSON.parse(String(message)); } catch {}
      if (['update', 'full-reload', 'prune'].includes(value?.type)) {
        report.hotReloadsSuppressed.push({ type: value.type, path: value.path ?? value.updates?.map(update => update.path) }); return;
      }
      socket.send(message);
    });
  });
  const page = await context.newPage(), f = { context, page, width, height, dpr, fixture, reduced, blocked: false, blockedUrls: [] };
  f.cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (/error|warning/.test(message.type()) && fixture === 'resource-retry') report.expectedResourceMessages.push(message.text()); });
  await page.addInitScript(({ fixture }) => {
    const save = { version: 4, highScore: fixture === 'natural' ? 0 : 12345, totalStars: 0, coins: 77,
      selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 },
      settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } };
    if (localStorage.getItem('sheep-run-save') === null) localStorage.setItem('sheep-run-save', JSON.stringify(save));
  }, { fixture });
  if (fixture === 'resource-retry') {
    f.blocked = true;
    await page.route(/\/assets\/runner-update-v2\/runtime\/[^/]*heart[^/]*\.png(?:\?.*)?$/, async route => {
      // Vite's eager ?url import is JavaScript, not the Phaser image/XHR load.
      if (route.request().resourceType() === 'script' || new URL(route.request().url()).searchParams.has('url')) { await route.continue(); return; }
      if (f.blocked) { f.blockedUrls.push(route.request().url()); await route.abort('failed'); }
      else await route.continue();
    });
  }
  // loading.ts imports extensionless "./main". Use the exact request URL so
  // importing it does not create a second game under a different module URL.
  const mainRequest = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await mainRequest).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  if (fixture === 'resource-retry') await page.waitForFunction(() => window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
  else { await ready(f, 'MenuScene'); check(await page.locator('[data-menu-art]').count() === 1, `${width}/${dpr}: one actual game owns the menu surface`); }
  return f;
}
async function target(f, scene, name) {
  return f.page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene);
    const find = list => { for (const object of list) { if (object.name === name) return object; const child = object.list && find(object.list); if (child) return child; } };
    const o = find(s.children.list); if (!o) throw new Error(`Missing touch target: ${scene}/${name}`);
    const box = o.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: canvas.x + (box.centerX - s.cameras.main.scrollX * o.scrollFactorX) * canvas.width / size.width,
      y: canvas.y + (box.centerY - s.cameras.main.scrollY * o.scrollFactorY) * canvas.height / size.height };
  }, { scene, name });
}
async function tap(f, scene, name) { const p = await target(f, scene, name); await f.page.touchscreen.tap(p.x, p.y); await frames(f); }
async function inputStates(f, scene, names) {
  return f.page.evaluate(({ scene, names }) => {
    const find = (list, name) => { for (const object of list) { if (object.name === name) return object; const child = object.list && find(object.list, name); if (child) return child; } };
    const s = window.g.scene.getScene(scene);
    return Object.fromEntries(names.map(name => [name, find(s.children.list, name)?.input?.enabled ?? null]));
  }, { scene, names });
}
async function gesture(f, action) {
  const p = await f.page.evaluate(() => {
    const r = window.g.canvas.getBoundingClientRect();
    return { x: r.x + r.width * .68, y: r.y + r.height * .5, unit: r.width / window.g.scale.gameSize.width };
  });
  if (action === 'tap') { await f.page.touchscreen.tap(p.x, p.y); return; }
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + (action === 'up' ? -46 : 46) * p.unit }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function shot(f, name) {
  const file = `screenshots/${phase === 'production' ? 'production/' : ''}${f.width}x${f.height}-dpr${f.dpr}-${f.fixture}-${name}.png`;
  await f.page.screenshot({ path: fileURLToPath(new URL(file, output)), scale: 'css' }); report.screenshots.push(file);
}
async function start(f) {
  await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene');
  check(await f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'); return !!s.starRoutes && !!s.runGoal && !!s.goalView && !!s.travel;
  }), `${f.width}/${f.dpr}: production A modules exist in endless run`);
  check(await f.page.locator('[data-menu-art]').count() === 0, `${f.width}/${f.dpr}: real scene start removes all menu artwork`);
}
async function loadedAssets(f) {
  const assets = await f.page.evaluate(() => window.g.textures.getTextureKeys()
    .filter(key => key.startsWith('runner-v2-') || key.startsWith('content-v2-') || key.startsWith('landmark-'))
    .map(key => {
      const texture = window.g.textures.get(key), source = texture.getSourceImage();
      return { key, width: source.width, height: source.height, filter: texture.filterMode };
    }));
  for (const key of ['runner-v2-goal-panel', 'runner-v2-goal-stamp', 'runner-v2-response-star', 'runner-v2-response-crown', 'runner-v2-response-heart']) {
    const asset = assets.find(asset => asset.key === key);
    check(asset && asset.width > 0 && asset.height > 0, `${f.width}/${f.dpr}: generated asset ${key} is actually preloaded`);
  }
  check(assets.some(asset => asset.key === 'content-v2-trip-paper'), `${f.width}/${f.dpr}: B travel-card paper is actually preloaded`);
  return assets;
}
async function pointerCancel(f) {
  const p = await f.page.evaluate(() => { const r = window.g.canvas.getBoundingClientRect(); return { x: r.x + r.width * .7, y: r.y + r.height * .5 }; });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await frames(f);
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await frames(f);
  check(await f.page.evaluate(() => {
    const i = window.g.scene.getScene('RunScene').inputSystem;
    return i.gestureRecognizer.active === null && i.pendingActions.length === 0 && !i.touchDash;
  }), `${f.width}/${f.dpr}: OS touch cancellation leaves no queued tap, gesture or Dash`);
}
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
async function goalFacts(f, label) {
  const facts = await f.page.locator('[data-adventure-overlay="run-goal"]').evaluate(canvas => ({
    ...canvas.dataset, width: canvas.width, height: canvas.height,
    cssWidth: parseFloat(canvas.style.width), cssHeight: parseFloat(canvas.style.height),
    smoothing: canvas.getContext('2d').imageSmoothingEnabled,
  }));
  const box = JSON.parse(facts.layout), typography = JSON.parse(facts.typography).text;
  const hud = await f.page.evaluate(async () => {
    const { runHudLayout } = await import('/src/ui/RunHudLayout.ts');
    return runHudLayout(window.g.scale.gameSize, { left: 0, right: 0, top: 0, bottom: 0 });
  });
  for (const [name, slot] of Object.entries(hud)) check(!overlap(box, slot), `${label}: goal does not overlap ${name}`);
  check(facts.width === Math.round(facts.cssWidth * f.dpr) && facts.height === Math.round(facts.cssHeight * f.dpr), `${label}: physical display surface matches DPR ${f.dpr}`);
  check(facts.smoothing === false, `${label}: generated art uses nearest-neighbor display`);
  check(typography.ink.x >= box.x - 1 && typography.ink.y >= box.y - 1 && typography.ink.x + typography.ink.width <= box.x + box.width + 1 && typography.ink.y + typography.ink.height <= box.y + box.height + 1, `${label}: real bitmap text stays inside goal strip`);
  const stamp = JSON.parse(facts.stamp);
  if (stamp) check(!overlap(stamp, typography.ink), `${label}: completion stamp and words remain distinct`);
  return { ...facts, goal: JSON.parse(facts.goal), layout: box, typography };
}
async function state(f) {
  return f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene');
    return { paused: window.g.scene.isPaused('RunScene'), finished: s.finished, nowMs: s.activeRunTimeMs,
      score: s.scoreSystem.score, stars: s.scoreSystem.starCount, goal: s.runGoal?.snapshot(), travel: s.travel?.snapshot(),
      budget: s.starRoutes?.budget, companion: s.companions?.scheduler.state,
      responses: s.children.list.filter(o => o.name?.startsWith('companion-response-')).map(o => ({ name: o.name, visible: o.visible })),
      overlays: document.querySelectorAll('[data-adventure-overlay="run-goal"]').length,
      listeners: s.events.listenerCount('preupdate'), runListeners: s.events.listeners('preupdate').filter(listener => listener === s.onPreUpdate).length,
      physics: s.physics.world.isPaused,
    };
  });
}
async function pauseFrozen(f, label) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  const before = await state(f); await delay(160); const after = await state(f);
  check(before.paused && after.paused, `${label}: actual touch pause activates pause scene`);
  for (const field of ['nowMs', 'score', 'stars', 'goal', 'travel', 'budget', 'companion']) check(JSON.stringify(after[field]) === JSON.stringify(before[field]), `${label}: ${field} freezes while paused`);
  await shot(f, `pause-${label.replaceAll(/[^a-z0-9]/gi, '-')}`);
  await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  check(!(await state(f)).paused, `${label}: actual touch resume restores run`);
}

async function naturalPlay() {
  const f = await open(896, 414, 2, 'natural'); await start(f);
  let lastGestureAt = -1000, started = Date.now(), lastShotAt = -1000;
  const pausedPhases = new Set();
  const log = { width: f.width, height: f.height, dpr: f.dpr, main: f.main, actions: [], samples: [], outcomes: [], routeCompletions: [], observedResponses: [], integrity: 'No runtime mutations; all actions are CDP touchscreen taps/swipes.' };
  log.assets = await loadedAssets(f);
  report.natural.push(log);
  let previousSampleMs = -1000, retries = 0, previousObserved = null;
  for (;;) {
    const sample = await f.page.evaluate(() => {
      const s = window.g.scene.getScene('RunScene'), lead = s.sheep, body = lead.body;
      const pool = s.stars.getChildren();
      const groups = s.starRoutes ? [...s.starRoutes.groups.values()].map(group => ({ id: group.id, kind: group.kind, collected: group.collected, total: group.total,
        slots: [...group.members].map(o => pool.indexOf(o)),
        stars: [...group.members].filter(o => o.active).map(o => ({ x: o.x, y: o.baseY })) })) : [];
      return { active: window.g.scene.isActive('RunScene'), finished: s.finished, nowMs: s.activeRunTimeMs, speed: s.difficultySystem.speed,
        score: s.scoreSystem.score, starCount: s.scoreSystem.starCount, goal: s.runGoal?.snapshot(), travel: s.travel?.snapshot(),
        grounded: lead.grounded, leadX: lead.x, body: { x: body.x, y: body.y, width: body.width, height: body.height },
        jumpMultiplier: s.upgradeEffects.jumpImpulseMultiplier,
        starBudget: s.starRoutes?.budget, activeStars: s.stars.getChildren().filter(o => o.active).length,
        pooledStars: pool.map((o, slot) => ({ slot, active: o.active, collected: o.collected, missed: o.missed, kind: o.getData('route-kind') })),
        obstacles: s.obstacles.getChildren().filter(o => o.active && o.rightEdge > lead.x - 30).map(o => ({
          kind: o.definition.kind, left: o.body.x, width: o.body.width, right: o.rightEdge,
        })).sort((a, b) => a.left - b.left),
        groups, companion: s.companions?.scheduler.state, bellX: s.children.getByName('companion-bell-pickup')?.x ?? null,
        responses: s.children.list.filter(o => o.name?.startsWith('companion-response-') && o.visible).map(o => o.name),
        visibleLandmarks: s.children.list.filter(o => o.name?.startsWith('landmark') && o.visible).map(o => o.name),
      };
    });
    if (previousObserved) for (const group of previousObserved.groups) {
      if (group.kind === 'single' || sample.groups.some(current => current.id === group.id) || !group.slots.length) continue;
      const acceptedLastMembers = group.slots.every(slot => {
        const star = sample.pooledStars[slot]; return star && !star.active && star.collected && !star.missed && star.kind === group.kind;
      });
      if (acceptedLastMembers && sample.starCount - previousObserved.starCount >= group.slots.length) {
        log.routeCompletions.push({ id: group.id, kind: group.kind, total: group.total, previouslyCollected: group.collected,
          remainingAcceptedSlots: group.slots, nowMs: sample.nowMs,
          evidence: 'Observed controller progress plus the actual remaining pooled members deactivated as collected (not missed), and matching real star-count increments.' });
      }
    }
    previousObserved = sample;
    if (sample.nowMs - previousSampleMs >= 700) { log.samples.push(sample); previousSampleMs = sample.nowMs; }
    for (const response of sample.responses) if (!log.observedResponses.includes(response)) log.observedResponses.push(response);
    if (sample.finished || !sample.active) {
      log.outcomes.push({ result: 'collision-ended', nowMs: sample.nowMs, score: sample.score, stars: sample.starCount, travel: sample.travel });
      await ready(f, 'ResultScene'); await shot(f, `natural-result-${retries}`);
      if (++retries >= 3 || sample.nowMs >= 35000) break;
      await tap(f, 'ResultScene', 'button:再跑一次'); await ready(f, 'RunScene');
      lastGestureAt = -1000; previousSampleMs = -1000; previousObserved = null; pausedPhases.clear(); continue;
    }
    if (sample.nowMs >= 40000 || Date.now() - started > 160000) {
      log.outcomes.push({ result: 'observed-run', nowMs: sample.nowMs, score: sample.score, stars: sample.starCount, travel: sample.travel });
      await shot(f, 'natural-final'); break;
    }
    const nextHazard = sample.obstacles[0];
    const captureSafe = !nextHazard || nextHazard.left - sample.body.x - sample.body.width > sample.speed * 1.5;
    if (captureSafe && (sample.nowMs - lastShotAt > 10000 || sample.companion === 'companion' && sample.nowMs - lastShotAt > 2500)) {
      await shot(f, `natural-${Math.floor(sample.nowMs)}ms`); lastShotAt = sample.nowMs;
    }
    if (!pausedPhases.has(sample.companion) && sample.nowMs > 7500 && sample.grounded && captureSafe) {
      await pauseFrozen(f, `natural-${sample.companion}`); pausedPhases.add(sample.companion); continue;
    }
    let action = null, reason = null;
    const hazard = sample.obstacles[0];
    if (hazard && sample.grounded && sample.nowMs - lastGestureAt > 200) {
      const duck = ['FlyingBird', 'HangingVine', 'HangingBranch'].includes(hazard.kind);
      const front = hazard.left - (sample.body.x + sample.body.width);
      if (duck && front <= sample.speed * .06 && front > -hazard.width) { action = 'down'; reason = hazard.kind; }
      else if (!duck) {
        const high = hazard.kind === 'TallStack';
        const apex = (high ? Math.min(580 * sample.jumpMultiplier, 590) : 500 * sample.jumpMultiplier) / 1450;
        const center = hazard.left + hazard.width / 2 - sample.leadX;
        if (center <= sample.speed * apex + sample.speed * .035 && center > -hazard.width) { action = high ? 'up' : 'tap'; reason = hazard.kind; }
      }
    }
    if (!action && sample.grounded && sample.nowMs - lastGestureAt > 400 && (sample.bellX === null || sample.bellX - sample.leadX > sample.speed * .75)) {
      const group = sample.groups.find(group => group.kind !== 'landing' && group.stars.some(star => star.y < 180));
      const normalFlight = 1000 * sample.jumpMultiplier / 1450;
      const safeJumpWindow = !hazard || hazard.left - sample.body.x - sample.body.width > sample.speed * (normalFlight + .16);
      if (group && safeJumpWindow) {
        const highest = [...group.stars].sort((a, b) => a.y - b.y)[0];
        const flight = 1000 * sample.jumpMultiplier / 1450;
        const contact = flight * (group.kind === 'arc' ? .49 : .5);
        if (highest.x - sample.leadX <= sample.speed * contact + sample.speed * .02 && highest.x > sample.leadX - 10) { action = 'tap'; reason = `star-route:${group.kind}`; }
      }
    }
    if (action) { log.actions.push({ nowMs: sample.nowMs, action, reason }); await gesture(f, action); lastGestureAt = sample.nowMs; }
    await delay(22);
  }
  if (await f.page.evaluate(() => window.g.scene.isActive('RunScene') && !window.g.scene.getScene('RunScene').finished)) {
    // Stopping touch input is an ordinary player action; wait for an actual
    // collision rather than calling the loss hook or altering a hazard.
    await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').finished, null, { timeout: 15000 });
    await ready(f, 'ResultScene');
    const result = await f.page.evaluate(() => window.g.scene.getScene('ResultScene').result);
    log.outcomes.push({ result: 'natural-collision-after-touch-stopped', score: result.score, travel: result.travel,
      nowMs: log.samples.at(-1)?.nowMs });
    await shot(f, 'natural-result');
    check(result.travel?.stars > 0 && result.travel.newRecord === true, 'natural result preserves actual collected stars and best-at-start record crossing');
  }
  const longest = Math.max(...log.outcomes.map(row => row.nowMs));
  check(longest >= 30000, 'natural touch gameplay reaches at least 30 seconds without immunity or clock acceleration');
  check(log.actions.some(row => row.action === 'tap') && log.actions.some(row => row.action === 'up' || row.action === 'down'), 'natural gameplay uses actual tap and swipe controls');
  check(log.samples.some(row => row.starCount > 0), 'natural gameplay collects at least one actual star');
  check(log.samples.some(row => row.travel?.stars === row.starCount && row.starCount > 0), 'natural travel stars match actual accepted pickups');
  check(log.samples.some(row => row.goal?.complete), 'a naturally selected single-run target completes during normal touch play');
  check(log.samples.every(row => row.activeStars <= 3 && row.starBudget.spawned <= row.starBudget.received), 'natural live star routes retain the three-object pool and conserved original star budget');
  log.pausedPhases = [...pausedPhases];
  if (await f.page.evaluate(() => window.g.scene.isActive('ResultScene'))) {
    await tap(f, 'ResultScene', 'button:查看这次旅行');
    const trip = await f.page.locator('[data-content-v2-overlay="trip-card"]').evaluate(canvas => ({ ...canvas.dataset }));
    const model = JSON.parse(trip.model), actual = await f.page.evaluate(() => window.g.scene.getScene('ResultScene').result.travel);
    log.trip = { model, actual };
    check(model.summary.includes(`收好了${actual.stars}颗星星`), 'natural trip card presents exactly the actually collected star count');
    check(actual.goal.complete && model.highlights.some(highlight => highlight.kind === 'goal' && highlight.ids.includes(actual.goal.id)), 'natural trip card carries the completed actual per-run goal');
    await shot(f, 'natural-trip-card'); await tap(f, 'ResultScene', 'button:收好旅行卡');
    await tap(f, 'ResultScene', 'button:返回牧场'); await ready(f, 'MenuScene');
    check(await f.page.locator('[data-adventure-overlay="run-goal"]').count() === 0 && await f.page.locator('[data-content-v2-overlay="trip-card"]').count() === 0, 'natural run and result exit remove goal and trip display layers');
    check(await f.page.evaluate(() => !window.g.scene.getScene('RunScene').children.list.some(object => object.name?.startsWith('companion-response-'))), 'natural result exit leaves no companion response object');
    await shot(f, 'natural-returned-menu');
  }
  await f.context.close();
}

async function freezeFixture(f) {
  // A touch-cancel/resume check may leave an already-started normal jump in
  // flight. Let the genuine player settle; celebrations must not force a pose.
  await f.page.waitForFunction(() => {
    const s = window.g.scene.getScene('RunScene');
    return s.sheep.motionState === 'RUNNING' && s.sheep.y >= 217.5;
  });
  await f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene');
    s.physics.pause(); s.events.off('preupdate', s.onPreUpdate, s); s.sys.sceneUpdate = () => {};
  });
}
async function fixtureGoals(f) {
  for (let index = 0; index < 3; index += 1) {
    const facts = await f.page.evaluate(async index => {
      const { RUN_GOALS } = await import('/src/runner-v2/RunGoal.ts');
      const { Rock } = await import('/src/game/ObstacleDefinitions.ts');
      const s = window.g.scene.getScene('RunScene');
      s.runGoal.definition = RUN_GOALS[index]; s.runGoal.progress = 0; s.runGoal.complete = false; s.runGoal.stopped = false;
      s.runGoal.stars.clear(); s.runGoal.obstacles.clear(); s.goalView.completedAtMs = null; s.goalView.previous = '';
      const before = { score: s.scoreSystem.score, stars: s.scoreSystem.starCount };
      if (index === 0) for (let i = 0; i < 6; i++) {
        const star = s.acquireStar(); star.activate(s.sheep.x, 203, 0, 0);
        s.onStarOverlap(star); s.onStarOverlap(star);
      }
      if (index === 1) for (let i = 0; i < 8; i++) {
        const o = s.acquireObstacle(Rock, 0); o.activate(80 - Rock.width - 2, 0, 0);
        s.moveObjects(0); s.moveObjects(0); o.deactivate();
      }
      if (index === 2) for (let i = 0; i < 750; i++) s.runGoal.update(.04);
      s.goalView.update(40); s.travel.goal(s.runGoal.snapshot());
      return { before, after: { score: s.scoreSystem.score, stars: s.scoreSystem.starCount }, goal: s.runGoal.snapshot(), travel: s.travel.snapshot() };
    }, index);
    await frames(f);
    check(facts.goal.complete && facts.goal.progress === facts.goal.target, `${f.width}/${f.dpr}: isolated goal ${facts.goal.id} completes exactly`);
    if (index === 0) check(facts.after.stars - facts.before.stars === 6 && facts.after.score - facts.before.score === 600, `${f.width}/${f.dpr}: duplicate star callbacks do not add pickups or goal reward`);
    if (index === 1) check(facts.after.score - facts.before.score === 200, `${f.width}/${f.dpr}: passed obstacles retain exactly their original 25-point rewards`);
    if (index === 2) check(facts.after.score === facts.before.score && facts.after.stars === facts.before.stars, `${f.width}/${f.dpr}: time goal gives only a cosmetic stamp`);
    check(facts.travel.stars === facts.after.stars, `${f.width}/${f.dpr}: run-local travel uses actual star count`);
    await goalFacts(f, `${f.width}/${f.dpr}/${facts.goal.id}`); await shot(f, `goal-${facts.goal.id}`);
  }
}
async function fixtureCompanion(f) {
  const initial = await f.page.evaluate(async () => {
    const { BellView } = await import('/src/companions/BellView.ts');
    const s = window.g.scene.getScene('RunScene'), c = s.companions;
    c.bell?.destroy(); c.bell = new BellView(s, s.sheep.x, s.reducedMotion); c.scheduler.phase = 'bell';
    const update = nowMs => c.update({ nowMs, deltaSeconds: 0, speed: s.difficultySystem.speed,
      viewport: window.g.scale.gameSize, obstacles: [], pickups: [] });
    const start = s.activeRunTimeMs; update(start); update(start + 1200);
    window.__companionFixture = { start, update };
    return { skin: c.companion?.skin, physicsBody: !!c.companion?.sheep.body,
      travel: s.travel.snapshot(), sheep: { x: s.sheep.x, width: s.sheep.displayWidth },
      friend: { x: c.companion.sheep.x, width: c.companion.sheep.displayWidth } };
  });
  check(initial.skin === 'white' && !initial.physicsBody, `${f.width}/${f.dpr}: white fallback companion is an actual non-physics display object`);
  check(initial.travel.companionSkins.includes('white'), `${f.width}/${f.dpr}: actual bell collection records its summoned skin`);
  check(initial.friend.x + initial.friend.width / 2 < initial.sheep.x - initial.sheep.width / 2, `${f.width}/${f.dpr}: friend keeps a clear gap behind lead`);
  await f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), f = window.__companionFixture;
    s.companions.notifyRecord(); s.companions.notifyRecord(); f.update(f.start + 1300);
  });
  await frames(f);
  const crown = await f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene');
    return { visible: s.children.getByName('companion-response-crown').visible,
      lead: { state: s.sheep.motionState, y: s.sheep.y, height: s.sheep.displayHeight },
      controller: { nowMs: s.companions.nowMs, recordNotified: s.companions.recordNotified, pendingRecord: s.companions.pendingRecord },
      response: { ...s.companions.companion.responses } };
  });
  report.companionFixtures ??= []; report.companionFixtures.push({ width: f.width, height: f.height, dpr: f.dpr, crown });
  check(crown.visible, `${f.width}/${f.dpr}: queued record crown draws after safe entrance`);
  await shot(f, 'companion-crown');
  const group = await f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), f = window.__companionFixture;
    f.update(f.start + 2500); f.update(f.start + 4200);
    s.starRoutes.desired = 'arc'; s.starRoutes.bank = [];
    for (let i = 0; i < 3; i++) s.starRoutes.enqueue({ type: 'star', y: 120, phase: i });
    for (const star of s.stars.getChildren()) if (star.active) { s.starRoutes.recycle(star); star.deactivate(); }
    const before = s.scoreSystem.starCount;
    const plan = s.starRoutes.update({ speed: s.difficultySystem.speed, spawnX: 494, playerX: s.sheep.x,
      jumpImpulseMultiplier: s.upgradeEffects.jumpImpulseMultiplier,
      window: { openingSafe: true, patternEnded: true, nextObstacleInPx: 2000 },
      obstacles: [{ left: -530, right: -500, kind: 'Rock' }], pickups: [] });
    const stars = s.stars.getChildren().filter(o => o.active);
    for (const star of stars) { s.onStarOverlap(star); s.onStarOverlap(star); }
    f.update(f.start + 4300);
    return { kind: plan.kind, size: plan.points.length, picked: s.scoreSystem.starCount - before,
      star: s.children.getByName('companion-response-star').visible,
      groupsRemaining: s.starRoutes.groups.size, budget: s.starRoutes.budget, travel: s.travel.snapshot() };
  });
  await frames(f);
  check(group.kind === 'arc' && group.size === 3 && group.picked === 3, `${f.width}/${f.dpr}: actual pooled arc accepted once per member`);
  check(group.groupsRemaining === 0 && group.star, `${f.width}/${f.dpr}: full collected group produces the companion star response`);
  check(group.budget.spawned <= group.budget.received && group.travel.stars >= 9, `${f.width}/${f.dpr}: group response adds no stars outside original pickup budget`);
  await shot(f, 'companion-star');
  await f.page.evaluate(() => { const f = window.__companionFixture; f.update(f.start + 9100); }); await frames(f);
  check(await f.page.evaluate(() => window.g.scene.getScene('RunScene').children.getByName('companion-response-heart').visible), `${f.width}/${f.dpr}: departure displays generated heart`);
  if (f.reduced) check(await f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), friend = s.children.getByName('companion-sheep');
    return friend.angle === 0 && friend.y === s.sheep.y && s.children.getByName('companion-response-heart').angle === 0;
  }), `${f.width}/${f.dpr}: reduced-motion preference retains static farewell and collection opportunities`);
  await shot(f, 'companion-heart');
  await f.page.evaluate(() => { const f = window.__companionFixture; f.update(f.start + 10001); });
  check(await f.page.evaluate(() => !window.g.scene.getScene('RunScene').children.getByName('companion-sheep') && !window.g.scene.getScene('RunScene').children.list.some(o => o.name?.startsWith('companion-response-'))), `${f.width}/${f.dpr}: exact ten-second lifecycle removes every response object`);
}

async function existingPowerupFixtures(f) {
  const facts = await f.page.evaluate(async () => {
    const { Rock } = await import('/src/game/ObstacleDefinitions.ts');
    const s = window.g.scene.getScene('RunScene'), now = s.activeRunTimeMs;
    s.powerUpSystem.reset();
    const before = { score: s.scoreSystem.score, stars: s.scoreSystem.starCount, travelStars: s.travel.snapshot().stars };
    s.powerUpSystem.activate('starMultiplier', now);
    const doubled = s.acquireStar(); doubled.activate(s.sheep.x, 203, 0, 0); s.onStarOverlap(doubled); s.onStarOverlap(doubled);
    const afterDouble = { score: s.scoreSystem.score, stars: s.scoreSystem.starCount, travelStars: s.travel.snapshot().stars };
    s.powerUpSystem.activate('magnet', now);
    const nearby = s.acquireStar(); nearby.activate(s.sheep.x + 50, 203, 0, s.difficultySystem.speed); s.moveObjects(.04);
    const magnet = { vx: nearby.body.velocity.x, vy: nearby.body.velocity.y, worldSpeed: s.difficultySystem.speed };
    s.starRoutes.recycle(nearby); nearby.deactivate();
    s.powerUpSystem.activate('shield', now);
    const obstacle = s.acquireObstacle(Rock, 0); obstacle.activate(s.sheep.x, 0, 0); s.onObstacleOverlap(obstacle);
    const shield = { ended: s.finished, obstacleActive: obstacle.active, active: s.powerUpSystem.isActive('shield', now) };
    s.powerUpSystem.reset();
    return { before, afterDouble, magnet, shield, defaultDashImmune: s.inputSystem.isObstacleImmune(now), travel: s.travel.snapshot() };
  });
  check(facts.afterDouble.score - facts.before.score === 200 && facts.afterDouble.stars - facts.before.stars === 1 && facts.afterDouble.travelStars - facts.before.travelStars === 1, `${f.width}/${f.dpr}: existing double-star effect keeps a single actual pickup and the original 200-point award`);
  check(facts.magnet.vx < -facts.magnet.worldSpeed && facts.magnet.vy < 0, `${f.width}/${f.dpr}: original magnet still attracts the pooled star toward the sheep`);
  check(!facts.shield.ended && !facts.shield.obstacleActive && !facts.shield.active, `${f.width}/${f.dpr}: original shield consumes one charge and preserves the run`);
  check(!facts.defaultDashImmune, `${f.width}/${f.dpr}: Dash remains off by default`);
}

async function isolatedViews() {
  for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const f = await open(width, height, dpr, 'isolated', width === 800 && dpr === 2); await start(f);
    const view = { width, height, dpr, main: f.main, assets: await loadedAssets(f), initial: await state(f), intro: await goalFacts(f, `${width}/${dpr}/intro`) }; report.views.push(view);
    await pointerCancel(f);
    await shot(f, 'intro'); await pauseFrozen(f, `${width}-${dpr}-early`);
    await freezeFixture(f); await fixtureGoals(f); await fixtureCompanion(f); await existingPowerupFixtures(f);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
    await tap(f, 'PauseScene', 'button:重新开始'); await ready(f, 'RunScene');
    const fresh = await state(f);
    view.restart = fresh;
    check(fresh.goal.progress <= .2 && !fresh.goal.complete && fresh.stars === 0, `${width}/${dpr}: actual restart resets all per-run progress`);
    check(fresh.travel.stars === 0 && fresh.travel.companionSkins.length === 0 && fresh.travel.animals.length === 0 && fresh.travel.landmarks.length === 0 && fresh.travel.newCollections.length === 0, `${width}/${dpr}: next run does not fabricate previous experiences`);
    check(fresh.overlays === 1 && fresh.runListeners === 1 && fresh.listeners === view.initial.listeners, `${width}/${dpr}: restart leaves one goal surface, one run handler and the original plugin listener count`);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
    check(await f.page.locator('[data-adventure-overlay="run-goal"]').count() === 0, `${width}/${dpr}: exit removes the run-local display canvas`);
    await start(f); await freezeFixture(f);
    const actual = await f.page.evaluate(() => {
      const s = window.g.scene.getScene('RunScene');
      const star = s.acquireStar(); star.activate(s.sheep.x, 203, 0, 0); s.onStarOverlap(star);
      const observed = s.travel.snapshot(); s.onObstacleOverlap();
      return observed;
    });
    await f.page.evaluate(() => {
      const s = window.g.scene.getScene('RunScene'); s.sys.sceneUpdate = Object.getPrototypeOf(s).update;
    });
    await ready(f, 'ResultScene');
    const final = await f.page.evaluate(() => window.g.scene.getScene('ResultScene').result);
    check(final.travel && final.travel.stars === actual.stars && final.travel.companionSkins.length === 0, `${width}/${dpr}: result receives only this run's actual travel snapshot`);
    await shot(f, 'result');
    const tripTarget = await f.page.evaluate(() => {
      const s = window.g.scene.getScene('ResultScene');
      const find = list => { for (const object of list) { if (object.input && /旅行/.test(object.name)) return object.name; const child = object.list && find(object.list); if (child) return child; } };
      return find(s.children.list);
    });
    check(!!tripTarget, `${width}/${dpr}: integrated result exposes trip card touch entry`);
    const watched = ['button:再跑一次', 'button:返回牧场', tripTarget];
    const beforeModal = await inputStates(f, 'ResultScene', watched);
    await tap(f, 'ResultScene', tripTarget);
    check(Object.values(await inputStates(f, 'ResultScene', watched)).every(value => value === false), `${width}/${dpr}: travel card blocks every underlying result entry`);
    const trip = await f.page.locator('[data-content-v2-overlay="trip-card"]').evaluate(canvas => ({ ...canvas.dataset }));
    const lines = JSON.parse(trip.lines);
    for (const line of lines) check(line.ink.x >= line.box.x - 1 && line.ink.y >= line.box.y - 1 && line.ink.x + line.ink.width <= line.box.x + line.box.width + 1 && line.ink.y + line.ink.height <= line.box.y + line.box.height + 1, `${width}/${dpr}: trip line fits ${line.text}`);
    check(trip.open === 'true' && lines.some(line => line.text.includes('1')), `${width}/${dpr}: trip card shows the actual one-star isolated run`);
    await shot(f, 'trip-card'); await tap(f, 'ResultScene', 'button:收好旅行卡');
    check(await f.page.evaluate(() => !window.g.scene.getScene('ResultScene').data.get('content-v2-trip-open')), `${width}/${dpr}: trip close restores result actions`);
    check(JSON.stringify(await inputStates(f, 'ResultScene', watched)) === JSON.stringify(beforeModal), `${width}/${dpr}: trip close restores captured input states exactly`);
    await f.context.close();
    process.stdout.write(JSON.stringify({ viewport: [width, height], dpr, checked: true }) + '\n');
  }
}

async function resourceRetry() {
  const f = await open(896, 414, 2, 'resource-retry');
  const before = await f.page.evaluate(() => localStorage.getItem('sheep-run-save'));
  check(f.blockedUrls.length >= 1 && new Set(f.blockedUrls).size === 1, 'isolated network fixture blocks exactly the new heart asset across normal loader retries');
  check(await f.page.evaluate(() => !window.g.textures.exists('runner-v2-response-heart') && !window.g.scene.isActive('MenuScene')), 'missing generated response uses the real preload failure screen');
  await shot(f, 'failed-heart-load'); f.blocked = false;
  await tap(f, 'PreloadScene', 'button:重试'); await ready(f, 'MenuScene');
  await loadedAssets(f);
  check(await f.page.evaluate(() => localStorage.getItem('sheep-run-save')) === before, 'touch resource retry preserves the protected gameplay save exactly');
  await shot(f, 'heart-retry-success');
  report.resourceRetry = { blockedUrls: [...new Set(f.blockedUrls)], attempts: f.blockedUrls.length };
  await f.context.close();
}

try {
  if (['all', 'natural', 'production'].includes(phase)) await naturalPlay();
  if (['all', 'isolated'].includes(phase)) await isolatedViews();
  if (['all', 'isolated', 'retry'].includes(phase)) await resourceRetry();
  check(report.errors.length === 0, 'no runtime exceptions during new run, UI, companions, result and restart');
  if (phase === 'production') check(report.hotReloadsSuppressed.length === 0, 'final static build has no HMR activity or source updates');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' }).catch(() => {});
  throw error;
} finally {
  await writeFile(new URL(phase === 'all' ? 'browser-review.json' : `browser-review-${phase}.json`, output), JSON.stringify(report, null, 2)); await browser.close();
}
process.stdout.write(JSON.stringify({ passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors }) + '\n');
