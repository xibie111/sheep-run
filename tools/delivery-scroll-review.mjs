import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.DELIVERY_SCROLL_URL || 'http://127.0.0.1:4351/';
const phase = process.env.DELIVERY_SCROLL_PHASE || 'all';
const out = resolve(process.env.DELIVERY_SCROLL_OUT || 'docs/delivery-scroll-fix-v1/browser');
const chapters = ['hill-goodnight-v1', 'dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'];
const physicalViews = [[480, 270], [896, 414], [844, 390], [800, 600]];
await mkdir(resolve(out, 'screenshots'), { recursive: true });
await mkdir(resolve(out, 'videos'), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = { passed: false, url, phase, engine: 'Microsoft Edge Chromium, actual app WebGL, mobile touchscreen emulation', phoneHardware: false,
  scope: 'Delivery background presentation only. No user browser profile or original localStorage was opened.',
  methods: {
    fixture: 'Independent ephemeral contexts. Real mailbox/chapter/start touch entry, then actual pause. Explicit isolated route-distance/cursor assignments, existing acquireObstacle()/activate() and direct updateDelivery(40) calls while the scene remains paused. Pause display is stopped only to capture the actual unobscured backgrounds. These are geometry/rendering fixtures, not natural-play/collision proof.',
    natural: 'Separate fresh default-save context. At least 30 seconds of effective default hill play using real CDP touchscreen taps/up/down swipes selected from read-only obstacle observations. No route, physics, spawn, scheduler, difficulty, collision, reward, skin or save mutation. Real touch pause/resume freezes distance, road and panorama. WebM is browser capture, not phone hardware.',
  }, checks: [], profiles: [], screenshots: [], natural: [], errors: [], suppressedHotReloads: [] };
const check = (value, name) => { assert(value, name); report.checks.push(name); };
const near = (actual, expected, name, tolerance = 1e-6) => check(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} ~= ${expected}`);
const mod = (value, period) => ((value % period) + period) % period;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const panelSelector = '[data-adventure-overlay="delivery-panel"]:visible';
const checkpoint = () => writeFile(resolve(out, `review-${phase}.json`), JSON.stringify(report, null, 2));

async function frames(f, count = 2) {
  await f.page.evaluate(count => new Promise(done => {
    const after = () => { if (!--count) { window.g.events.off('postrender', after); done(); } };
    window.g.events.on('postrender', after);
  }), count);
}
async function ready(f, scene) {
  await f.page.waitForFunction(scene => window.g.scene.isActive(scene) && window.g.scene.getScene(scene).children.list.length, scene);
  await frames(f);
}
async function open(width, height, dpr, label, { reducedMotion = false, video = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference', ...(video ? { recordVideo: { dir: resolve(out, 'videos'), size: { width, height } } } : {}) });
  // Source-owner edits must not replace a sampled app midway through a fixture.
  await context.routeWebSocket('**/*', socket => {
    const server = socket.connectToServer(); socket.onMessage(message => server.send(message));
    server.onMessage(message => {
      let packet; try { packet = JSON.parse(String(message)); } catch {}
      if (['update', 'full-reload', 'prune'].includes(packet?.type)) { report.suppressedHotReloads.push(packet.type); return; }
      socket.send(message);
    });
  });
  const page = await context.newPage(), f = { context, page, width, height, dpr, label, reducedMotion };
  f.cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.errors.push({ label, message: error.message }));
  const mainRequest = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await mainRequest).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  await ready(f, 'MenuScene');
  check(await page.evaluate(() => !!window.g.renderer.gl), `${label}: real WebGL renderer`);
  check(await page.evaluate(dpr => window.devicePixelRatio === dpr, dpr), `${label}: observed browser DPR matches ${dpr}`);
  return f;
}
async function target(f, scene, name) {
  return f.page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene);
    const find = list => { for (const item of list) { if (item.name === name) return item; const child = item.list && find(item.list); if (child) return child; } };
    const object = find(s.children.list);
    if (!object?.input?.enabled) throw new Error(`Inactive/missing touch target ${scene}/${name}`);
    const box = object.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: canvas.x + (box.centerX - s.cameras.main.scrollX * object.scrollFactorX) * canvas.width / size.width,
      y: canvas.y + (box.centerY - s.cameras.main.scrollY * object.scrollFactorY) * canvas.height / size.height };
  }, { scene, name });
}
async function tap(f, scene, name) {
  const point = await target(f, scene, name); await f.page.touchscreen.tap(point.x, point.y); await frames(f);
}
async function gesture(f, action) {
  const p = await f.page.evaluate(() => { const r = window.g.canvas.getBoundingClientRect(); return { x: r.x + r.width * .68, y: r.y + r.height * .5, unit: r.width / window.g.scale.gameSize.width }; });
  if (action === 'tap') { await f.page.touchscreen.tap(p.x, p.y); return; }
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + (action === 'up' ? -46 : 46) * p.unit }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function shot(f, name) {
  const relative = `screenshots/${f.width}x${f.height}-dpr${f.dpr}-${f.label}-${name}.png`;
  await frames(f); await f.page.screenshot({ path: resolve(out, relative), scale: 'css' });
  report.screenshots.push(relative); return relative;
}
async function selectChapter(f, id, mailboxOpen = false) {
  if (!mailboxOpen) await tap(f, 'MenuScene', 'mailbox-entry');
  await tap(f, 'MenuScene', 'mailbox-delivery');
  const pageFor = Math.floor(chapters.indexOf(id) / 2);
  let data = await f.page.locator(panelSelector).evaluate(canvas => ({ ...canvas.dataset }));
  while (+data.page < pageFor) { await tap(f, 'MenuScene', 'delivery-next'); data = await f.page.locator(panelSelector).evaluate(canvas => ({ ...canvas.dataset })); }
  while (+data.page > pageFor) { await tap(f, 'MenuScene', 'delivery-previous'); data = await f.page.locator(panelSelector).evaluate(canvas => ({ ...canvas.dataset })); }
  await tap(f, 'MenuScene', `delivery-chapter:${id}`);
  await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
  check(await f.page.evaluate(id => window.g.scene.getScene('RunScene').delivery.chapter.id === id, id), `${f.label}: touch entry starts ${id}`);
}
async function freezeFixture(f) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  await f.page.evaluate(() => window.g.scene.stop('PauseScene'));
  await frames(f);
  check(await f.page.evaluate(() => window.g.scene.isPaused('RunScene')), `${f.label}: isolated scroll fixture keeps real run paused`);
}
async function leaveFixture(f) {
  await f.page.evaluate(() => window.g.scene.getScene('RunScene').scene.launch('PauseScene'));
  await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
}
async function sceneFacts(f) {
  return f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), r = s.delivery;
    const size = window.g.scale.gameSize, ox = -s.cameras.main.scrollX, oy = -s.cameras.main.scrollY;
    const image = o => {
      const bounds = o.getBounds();
      return { name: o.name, key: o.texture.key, x: o.x, y: o.y, width: o.width, height: o.height, displayWidth: o.displayWidth,
        displayHeight: o.displayHeight, scaleX: o.scaleX, scaleY: o.scaleY, originX: o.originX, flipX: o.flipX, alpha: o.alpha, visible: o.visible,
        screenLeft: bounds.left + ox, screenRight: bounds.right + ox,
        frame: { x: o.frame.cutX, y: o.frame.cutY, width: o.frame.cutWidth, height: o.frame.cutHeight },
        source: { width: o.texture.getSourceImage().width, height: o.texture.getSourceImage().height } };
    };
    return { size: { width: size.width, height: size.height }, ox, oy, distance: r.distance, state: r.state, nowMs: s.activeRunTimeMs,
      chapter: { id: r.chapter.id, length: r.chapter.length, landscapes: r.chapter.landscapes },
      landscapes: s.deliveryView.landscapes.map(o => ({ image: image(o.image), left: image(o.left), right: image(o.right),
        road: { name: o.road.name, position: o.road.tilePositionX, scale: o.road.tileScaleX, scaleY: o.road.tileScaleY,
          width: o.road.width, height: o.road.height, y: o.road.y, alpha: o.road.alpha, sourceWidth: o.road.frame.cutWidth,
          sourceHeight: o.road.frame.cutHeight } })),
      environment: s.environmentSystem.parallax.layers.map(o => ({ key: o.definition.key, ratio: o.definition.ratio,
        position: o.sprite.tilePositionX, scale: o.sprite.tileScaleX, width: o.sprite.frame.cutWidth })),
      obstacles: s.obstacles.getChildren().filter(o => o.active).map(o => ({ x: o.x, bodyX: o.body.x, at: o.getData('delivery-at') })) };
  });
}
function geometryChecks(facts, label) {
  const { width, height } = facts.size;
  for (const [i, row] of facts.landscapes.entries()) {
    const { image, left, right, road } = row;
    near(image.scaleX, image.scaleY, `${label}/${i}: unchanged aspect ratio`);
    near(left.screenRight, image.screenLeft, `${label}/${i}: mirrored left edge meets original painting`);
    near(right.screenLeft, image.screenRight, `${label}/${i}: mirrored right edge meets original painting`);
    check(left.screenLeft <= 1e-6 && right.screenRight >= width - 1e-6, `${label}/${i}: source edge strips cover whole viewport without a hole`);
    check(left.flipX && right.flipX && left.frame.x === 0 && right.frame.x === image.source.width - right.frame.width,
      `${label}/${i}: extensions are mirrored outer source strips`);
    check(left.frame.width <= Math.ceil(image.source.width / 8) && right.frame.width <= Math.ceil(image.source.width / 8),
      `${label}/${i}: no whole-panorama repeat`);
    near(road.scale, road.scaleY, `${label}/${i}: road texture preserves aspect ratio`);
    near(road.y, 213 + facts.oy, `${label}/${i}: road retains current ground baseline`);
    check(road.width === width && road.height === height - road.y && road.sourceHeight * road.scaleY >= road.height - 1e-6,
      `${label}/${i}: road covers expanded ground without a vertical repeat`);
    near(mod(road.position * road.scale + facts.ox, road.sourceWidth * road.scale), mod(facts.distance, road.sourceWidth * road.scale),
      `${label}/${i}: scaled road phase matches physical world and camera origin`);
    const end = facts.chapter.landscapes[i + 1]?.transitionEnd ?? facts.chapter.length;
    const focused = facts.chapter.landscapes[i].focus === 'right' || i === facts.landscapes.length - 1;
    if (focused && facts.distance >= facts.chapter.landscapes[i].transitionStart && facts.distance <= end) {
      check(right.screenLeft >= width - 1e-6, `${label}/${i}: unique destination never shows a right-side reflection`);
      if (facts.chapter.id === 'lighthouse-starlight-v1') {
        check(image.screenLeft + 798 * image.scaleX >= 0 && image.screenLeft + 853 * image.scaleX <= width,
          `${label}/${i}: full measured tower silhouette stays visible horizontally`);
      }
    }
  }
}
async function stageStep(f, index, distance) {
  return f.page.evaluate(({ index, distance }) => {
    const s = window.g.scene.getScene('RunScene'), r = s.delivery;
    r.distance = distance; r.next = r.chapter.obstacles.length;
    for (const object of s.obstacles.getChildren()) if (object.active) object.deactivate();
    const request = r.chapter.obstacles[0], obstacle = s.acquireObstacle(request.definition, request.phase);
    const at = distance + 330 - 498; obstacle.setData('delivery-at', at); obstacle.activate(330, request.phase, 0, 'spring');
    s.updateDelivery(0);
    const row = s.deliveryView.landscapes[index];
    const before = { distance: r.distance, x: obstacle.x, phase: row.road.tilePositionX, scale: row.road.tileScaleX,
      sourceWidth: row.road.frame.cutWidth, panoramaX: row.image.x };
    s.updateDelivery(40);
    return { before, after: { distance: r.distance, x: obstacle.x, phase: row.road.tilePositionX,
      panoramaX: row.image.x, state: r.state } };
  }, { index, distance });
}
async function fixtureMatrix() {
  for (const [width, height] of physicalViews) for (const dpr of [1, 2]) {
    const f = await open(width, height, dpr, 'isolated');
    const profile = { width, height, dpr, main: f.main, chapters: [] }; report.profiles.push(profile);
    for (const id of chapters) {
      await selectChapter(f, id, profile.chapters.length > 0); await freezeFixture(f);
      const initial = await sceneFacts(f), record = { id, stages: [], resize: [] }; profile.chapters.push(record);
      for (const [index, config] of initial.chapter.landscapes.entries()) {
        const end = initial.chapter.landscapes[index + 1]?.transitionEnd ?? initial.chapter.length;
        const visibleStart = Math.max(config.transitionEnd, config.transitionStart);
        const distances = [visibleStart + 70, config.transitionStart + (end - config.transitionStart) * .8, end - 60];
        if (config.transitionStart + 6510 < end - 60) distances.push(config.transitionStart + 6510);
        const samples = [];
        for (const distance of distances) {
          const sample = await stageStep(f, index, distance), travelled = sample.after.distance - sample.before.distance;
          check(travelled > 0 && sample.after.state === 'running', `${width}/${dpr}/${id}/${index}: real route advances from 40ms`);
          near(sample.before.x - sample.after.x, travelled, `${width}/${dpr}/${id}/${index}: real obstacle moves by route distance`);
          near(mod(sample.after.phase - sample.before.phase, sample.before.sourceWidth) * sample.before.scale, travelled,
            `${width}/${dpr}/${id}/${index}: road moves exactly with real obstacle`);
          check(sample.after.panoramaX < sample.before.panoramaX, `${width}/${dpr}/${id}/${index}: distant panorama continues left at ${distance}`);
          check((sample.before.panoramaX - sample.after.panoramaX) / travelled < 1,
            `${width}/${dpr}/${id}/${index}: panorama is slower than road`);
          samples.push(sample); geometryChecks(await sceneFacts(f), `${width}/${dpr}/${id}/${index}/${Math.round(distance)}`);
        }
        record.stages.push({ index, config, samples, screenshot: await shot(f, `${id}-stage${index + 1}-edge`) });
      }
      // First chapter's opening pasture has no DeliveryView landscape yet.
      if (id === 'hill-goodnight-v1') {
        const sample = await stageStep(f, 0, 1800), facts = await sceneFacts(f);
        const ground = facts.environment.find(o => o.key === 'pasture-ground');
        near(mod(ground.position + facts.ox, ground.width), mod(Math.round(facts.distance), ground.width),
          `${width}/${dpr}: opening pasture uses full physical distance instead of 0.15`);
        check(facts.environment.some(o => o.ratio > 0 && o.ratio < 1), `${width}/${dpr}: opening pasture retains real layered parallax`);
        record.pasture = { sample, facts, screenshot: await shot(f, `${id}-opening-pasture`) };
      }
      // The focused endpoint should remain the unique original painting.
      await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.delivery.distance = s.delivery.chapter.length; s.deliveryView.update(s.delivery, s.activeRunTimeMs); });
      const destination = await sceneFacts(f); geometryChecks(destination, `${width}/${dpr}/${id}/destination`);
      record.destination = { facts: destination, screenshot: await shot(f, `${id}-destination`) };
      // Resize an already advanced stage. Layout must use the saved distance,
      // immediately, before a scene update can disguise a reset to stage start.
      await stageStep(f, 0, initial.chapter.landscapes[0].transitionStart + 1500);
      for (const [newWidth, newHeight] of [[800, 600], [896, 414], [width, height]]) {
        await f.page.setViewportSize({ width: newWidth, height: newHeight });
        const expectedLogicalWidth = newWidth / newHeight >= 480 / 270 ? Math.round(270 * newWidth / newHeight) : 480;
        await f.page.waitForFunction(expected => window.g.scale.gameSize.width === expected, expectedLogicalWidth); await frames(f);
        const facts = await sceneFacts(f); geometryChecks(facts, `${width}/${dpr}/${id}/resize${newWidth}`);
        const row = facts.landscapes[0], cfg = facts.chapter.landscapes[0], end = facts.chapter.landscapes[1]?.transitionEnd ?? facts.chapter.length;
        const available = Math.max(0, (row.image.displayWidth - facts.size.width) / 2), pan = Math.max(available, facts.size.width / 8);
        const focused = cfg.focus === 'right' || facts.landscapes.length === 1;
        const from = focused ? -available + Math.min(pan, row.image.displayWidth * .035) : pan;
        const to = focused ? -available : -pan;
        const actualOffset = row.image.x - (facts.size.width / 2 - facts.ox);
        const progress = (facts.distance - cfg.transitionStart) / (end - cfg.transitionStart);
        near(actualOffset, from + (to - from) * progress, `${width}/${dpr}/${id}: resized layout uses current progress immediately`);
        check(Math.abs(actualOffset - from) > .01, `${width}/${dpr}/${id}: resized layout does not rewind to stage entrance`);
        record.resize.push(facts);
      }
      await leaveFixture(f); await checkpoint();
    }
    await f.context.close(); process.stdout.write(`matrix ${width}x${height} DPR${dpr}: ${profile.chapters.length} chapters passed\n`);
  }
}
async function reducedCheck() {
  const f = await open(896, 414, 2, 'reduced', { reducedMotion: true });
  await selectChapter(f, 'lighthouse-starlight-v1'); await freezeFixture(f);
  const before = await sceneFacts(f), comparisons = [];
  for (const distance of [8000, 15000, 23000]) {
    await stageStep(f, 0, distance); const after = await sceneFacts(f);
    for (const [i, row] of after.landscapes.entries()) {
      near(row.image.x, before.landscapes[i].image.x, `reduced/${i}: panorama remains static`);
      near(row.road.position, before.landscapes[i].road.position, `reduced/${i}: road remains static`);
      near(mod(row.road.position * row.road.scale + after.ox, row.road.sourceWidth * row.road.scale), 0,
        `reduced/${i}: static road still uses world camera anchor`);
    }
    comparisons.push(after);
  }
  report.reduced = { main: f.main, before, comparisons, screenshot: await shot(f, 'lighthouse-static') };
  await f.context.close(); await checkpoint();
}
async function naturalRun() {
  const f = await open(896, 414, 2, 'natural-default', { video: true });
  const log = { main: f.main, chapter: 'hill-goodnight-v1', width: 896, height: 414, dpr: 2, actions: [], samples: [], phases: [], failedAttempts: [], pause: null, roadSyncSamples: [] };
  report.natural.push(log); await selectChapter(f, log.chapter);
  const observe = () => f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), r = s.delivery, body = s.sheep.body;
    const ground = s.environmentSystem.parallax.layers.find(row => row.definition.key === 'pasture-ground').sprite;
    return { state: r.state, distance: r.distance, phase: r.phase.id, nowMs: s.activeRunTimeMs, speed: s.difficultySystem.speed,
      selectedSkin: s.selectedSkin, upgrades: s.upgradeEffects, x: s.sheep.x, y: s.sheep.y, grounded: s.sheep.grounded,
      body: { x: body.x, width: body.width }, multiplier: s.upgradeEffects.jumpImpulseMultiplier,
      ground: { position: ground.tilePositionX, scale: ground.tileScaleX, width: ground.frame.cutWidth, origin: -s.cameras.main.scrollX },
      obstacles: s.obstacles.getChildren().filter(o => o.active && o.rightEdge > body.x).map(o => ({ kind: o.definition.kind,
        at: o.getData('delivery-at'), x: o.x, left: o.body.x, width: o.body.width, right: o.rightEdge })).sort((a, b) => a.left - b.left) };
  });
  let lastAction = -1000, lastSample = -1000, wallStart = Date.now(), attempts = 1;
  const seen = new Set();
  while (true) {
    const s = await observe();
    if (s.nowMs - lastSample >= 500) {
      if (s.phase === 'pasture') {
        near(mod(s.ground.position + s.ground.origin, s.ground.width), mod(Math.round(s.distance), s.ground.width),
          `natural/${Math.round(s.nowMs)}: visible opening ground follows full actual distance`);
        const previous = log.samples.at(-1);
        if (previous?.phase === 'pasture' && s.distance > previous.distance && s.distance - previous.distance < s.ground.width) {
          const movement = s.distance - previous.distance;
          const roadMovement = mod(s.ground.position - previous.ground.position, s.ground.width);
          near(roadMovement, movement, `natural/${Math.round(s.nowMs)}: rendered ground matches natural distance`, 1);
          const same = previous.obstacles.find(before => s.obstacles.some(after => after.at === before.at));
          if (same) {
            const current = s.obstacles.find(after => after.at === same.at);
            near(same.x - current.x, movement, `natural/${Math.round(s.nowMs)}: actual obstacle matches actual ground travel`);
            log.roadSyncSamples.push({ fromMs: previous.nowMs, toMs: s.nowMs, roadMovement, routeMovement: movement,
              obstacleMovement: same.x - current.x, obstacleAt: same.at });
          }
        }
      }
      log.samples.push(s); lastSample = s.nowMs;
    }
    if (!seen.has(s.phase)) { seen.add(s.phase); log.phases.push(s); await shot(f, `phase-${s.phase}-attempt${attempts}`); }
    if (s.state === 'failed') {
      log.failedAttempts.push(s); await shot(f, `failed-attempt${attempts}`); await checkpoint();
      if (attempts++ >= 3) throw new Error('Natural default hill failed three real touch attempts');
      await tap(f, 'RunScene', 'delivery-start'); await ready(f, 'RunScene'); lastAction = lastSample = -1000; seen.clear(); continue;
    }
    if (s.nowMs >= 30000 && seen.has('forest')) {
      log.final = s; log.finalFacts = await sceneFacts(f); await shot(f, 'thirty-seconds-forest'); break;
    }
    if (Date.now() - wallStart > 155000) throw new Error('Natural hill did not reach thirty effective seconds within bounded deadline');
    if (!log.pause && s.phase === 'forest') {
      await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
      const before = await sceneFacts(f); await sleep(350); const after = await sceneFacts(f);
      near(after.distance, before.distance, 'natural: actual touch pause freezes route');
      near(after.nowMs, before.nowMs, 'natural: actual touch pause freezes effective time');
      for (const [i, row] of after.landscapes.entries()) {
        near(row.road.position, before.landscapes[i].road.position, `natural/${i}: actual pause freezes road`);
        near(row.image.x, before.landscapes[i].image.x, `natural/${i}: actual pause freezes panorama`);
      }
      await shot(f, 'forest-paused'); await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
      log.pause = { before, after, resume: await observe() }; await checkpoint(); continue;
    }
    const hazard = s.obstacles[0];
    if (s.grounded && hazard && s.nowMs - lastAction > 210) {
      const duck = ['FlyingBird', 'HangingVine', 'HangingBranch'].includes(hazard.kind);
      let action;
      if (duck && hazard.left - s.body.x - s.body.width <= s.speed * .085 && hazard.right > s.body.x) action = 'down';
      else if (!duck) {
        const high = hazard.kind === 'TallStack', apex = (high ? Math.min(580 * s.multiplier, 590) : 500 * s.multiplier) / 1450;
        const center = hazard.left + hazard.width / 2 - s.x;
        if (center <= s.speed * (apex + .025) && center > -hazard.width) action = high ? 'up' : 'tap';
      }
      if (action) { log.actions.push({ ...s, action, hazard }); await gesture(f, action); lastAction = s.nowMs; }
    }
    await sleep(15);
  }
  check(log.final.nowMs >= 30000 && log.final.phase === 'forest' && log.final.state === 'running', 'natural: thirty effective seconds reaches forest without fixture mutation');
  check(log.actions.some(a => a.action === 'tap') && log.actions.some(a => a.action === 'down'), 'natural: ordinary jumps and crouch were real touch gestures');
  check(log.pause?.resume.distance > log.pause.before.distance, 'natural: actual touch resume restarts distance progression');
  check(log.final.selectedSkin === 'white' && log.final.multiplier === 1, 'natural: fresh default white sheep and base jump, no upgrade fixture');
  check(log.roadSyncSamples.length > 0, 'natural: opening ground and real obstacle synchronization was directly observed');
  const video = f.page.video(); await f.context.close();
  const videoFile = await video.path(), target = resolve(out, 'videos', `natural-default-hill-${phase}.webm`);
  await rename(videoFile, target); log.video = `videos/natural-default-hill-${phase}.webm`;
  await checkpoint(); process.stdout.write(`natural default hill: ${Math.round(log.final.nowMs)}ms, ${log.actions.length} actual actions, ${attempts} attempt(s)\n`);
}

async function representativeGallery() {
  // Late-stage movement shots deliberately include outgoing crossfades. This
  // separate gallery captures each actual painting after its own fade and
  // before the successor begins, rather than forcing any alpha values.
  for (const [width, height] of [[896, 414], [800, 600]]) {
    const f = await open(width, height, 2, 'production-gallery');
    const profile = { width, height, dpr: 2, main: f.main, chapters: [] }; report.profiles.push(profile);
    for (const id of chapters) {
      await selectChapter(f, id, profile.chapters.length > 0); await freezeFixture(f);
      const initial = await sceneFacts(f), record = { id, stages: [] }; profile.chapters.push(record);
      for (const [index, config] of initial.chapter.landscapes.entries()) {
        const next = initial.chapter.landscapes[index + 1];
        const distance = (Math.max(config.transitionEnd, config.transitionStart) + (next?.transitionStart ?? initial.chapter.length)) / 2;
        const sample = await stageStep(f, index, distance), facts = await sceneFacts(f);
        near(facts.landscapes[index].image.alpha, 1, `gallery/${id}/${index}: current painting is fully visible`);
        if (next) near(facts.landscapes[index + 1].image.alpha, 0, `gallery/${id}/${index}: successor does not obscure the current painting`);
        geometryChecks(facts, `gallery/${width}/${id}/${index}`);
        record.stages.push({ sample, facts, screenshot: await shot(f, `${id}-stage${index + 1}-representative`) });
      }
      if (id === 'hill-goodnight-v1') {
        await stageStep(f, 0, 1800);
        const facts = await sceneFacts(f);
        check(facts.landscapes.every(row => row.image.alpha === 0), `gallery/${width}: original opening pasture remains visible`);
        record.pasture = { facts, screenshot: await shot(f, `${id}-opening-pasture-representative`) };
      }
      await leaveFixture(f); await checkpoint();
    }
    await f.context.close();
  }
}

try {
  if (['all', 'matrix'].includes(phase)) await fixtureMatrix();
  if (['all', 'matrix', 'reduced'].includes(phase)) await reducedCheck();
  if (['all', 'natural'].includes(phase)) await naturalRun();
  if (phase === 'gallery') await representativeGallery();
  if (phase === 'smoke') {
    // A final-bundle smoke is explicit and smaller than the full development
    // matrix. All five chapters remain sampled in one actual touch profile.
    const f = await open(800, 600, 2, 'production-smoke');
    const profile = { width: 800, height: 600, dpr: 2, main: f.main, chapters: [] }; report.profiles.push(profile);
    for (const id of chapters) {
      await selectChapter(f, id, profile.chapters.length > 0); await freezeFixture(f);
      const initial = await sceneFacts(f), record = { id, stages: [] }; profile.chapters.push(record);
      for (const [index, config] of initial.chapter.landscapes.entries()) {
        const end = initial.chapter.landscapes[index + 1]?.transitionEnd ?? initial.chapter.length;
        const sample = await stageStep(f, index, end - 60);
        near(mod(sample.after.phase - sample.before.phase, sample.before.sourceWidth) * sample.before.scale,
          sample.after.distance - sample.before.distance, `production/${id}/${index}: road follows physical travel`);
        check(sample.after.panoramaX < sample.before.panoramaX, `production/${id}/${index}: panorama remains moving late in stage`);
        const facts = await sceneFacts(f); geometryChecks(facts, `production/${id}/${index}`);
        record.stages.push({ sample, facts, screenshot: await shot(f, `${id}-stage${index + 1}`) });
      }
      await leaveFixture(f);
    }
    await f.context.close();
  }
  check(report.errors.length === 0, 'no unhandled browser/runtime errors'); report.passed = true;
} catch (error) {
  report.failure = error.stack || String(error);
  for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
    try { await page.screenshot({ path: resolve(out, 'screenshots', `failure-${phase}-${index}.png`), scale: 'css' }); } catch {}
  }
  throw error;
} finally { await checkpoint(); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, phase, profiles: report.profiles.length, checks: report.checks.length,
  screenshots: report.screenshots.length, natural: report.natural.map(n => ({ effectiveMs: n.final?.nowMs, video: n.video })), phoneHardware: false }) + '\n');
