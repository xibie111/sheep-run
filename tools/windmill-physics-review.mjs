import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.WINDMILL_REVIEW_URL || 'http://127.0.0.1:4351/';
const phase = process.env.WINDMILL_REVIEW_PHASE || 'dev';
const out = resolve(process.env.WINDMILL_REVIEW_OUT || 'docs/windmill-physics-fix-v1/browser');
const chapterIds = ['hill-goodnight-v1', 'dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'];
const windmillId = chapterIds[2];
const layerKeys = ['windmill-meadow-physics-backdrop', 'windmill-meadow-physics-landmark', 'windmill-meadow-physics-grass'];
await mkdir(resolve(out, 'screenshots'), { recursive: true });
await mkdir(resolve(out, 'videos'), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = {
  passed: false, phase, url, engine: 'Headless Microsoft Edge Chromium, actual app WebGL, mobile touchscreen emulation',
  phoneHardware: false,
  methods: {
    entry: 'Independent ephemeral contexts, default save. Actual mailbox/chapter/start touchscreen entry. No personal browser profile or localStorage is opened.',
    matrix: 'Real touch pause, then stop only PauseScene to expose the paused actual render. Isolated route distance/cursor assignments and updateDelivery(0/40), deactivating pre-existing obstacles, verify geometry/rendering. No fixture rewrites of route configuration, physics configuration, input or reward rules. Staged completion follows the actual app ending/save path only inside the ephemeral context. These fixtures are not natural-play/collision proof.',
    finale: 'While paused, advance only isolated route distance to 20500 and its obstacle cursor past the already completed authored hazards. Restore normal scene updates via actual touchscreen resume. Record 8.8 seconds of the actual game canvas at its native logical resolution, including real touch pause/resume, world approach and delivery ending. This is a staged safe finale, not a natural full-run completion.',
    video: 'Native HTMLCanvasElement.captureStream(30) + browser MediaRecorder WebM; no synthetic frames or rewritten images. Canvas capture includes Phaser PauseScene and ending art; HTML overlay panels outside the game canvas are excluded. PNG screenshots capture the actual whole viewport.',
    limitations: ['No real Android/phone hardware, device input latency, hardware GPU or APK test.', 'DPR emulation and WebGL/browser rendering are separate from device proof.', 'No natural full windmill run was requested as a required check.'],
  },
  checks: [], profiles: [], reduced: null, video: null, retry: null, regressions: [], screenshots: [], errors: [], suppressedHotReloads: [],
};
const check = (value, label) => { assert(value, label); report.checks.push(label); };
const near = (a, b, label, tolerance = 1e-6) => check(Math.abs(a - b) <= tolerance, `${label}: ${a} ~= ${b}`);
const mod = (value, period) => ((value % period) + period) % period;
const sleep = ms => new Promise(done => setTimeout(done, ms));
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
async function open(width, height, dpr, label, reducedMotion = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await context.routeWebSocket('**/*', socket => {
    const server = socket.connectToServer(); socket.onMessage(message => server.send(message));
    server.onMessage(message => {
      let packet; try { packet = JSON.parse(String(message)); } catch {}
      if (['update', 'full-reload', 'prune'].includes(packet?.type)) { report.suppressedHotReloads.push(packet.type); return; }
      socket.send(message);
    });
  });
  const page = await context.newPage(), f = { context, page, width, height, dpr, label, reducedMotion };
  page.on('pageerror', error => report.errors.push({ label, message: error.message }));
  const request = page.waitForRequest(r => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(r.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await request).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  await ready(f, 'MenuScene');
  const renderer = await page.evaluate(() => ({ webgl: !!window.g.renderer.gl, dpr: window.devicePixelRatio,
    rendererName: window.g.renderer.gl?.getParameter(window.g.renderer.gl.RENDERER) }));
  check(renderer.webgl, `${label}: actual app WebGL`);
  near(renderer.dpr, dpr, `${label}: observed DPR`);
  f.renderer = renderer;
  return f;
}
async function tap(f, scene, name) {
  const point = await f.page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene);
    const find = list => { for (const item of list) { if (item.name === name) return item; const child = item.list && find(item.list); if (child) return child; } };
    const object = find(s.children.list);
    if (!object?.input?.enabled) throw new Error(`Inactive/missing touch target ${scene}/${name}`);
    const box = object.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: canvas.x + (box.centerX - s.cameras.main.scrollX * object.scrollFactorX) * canvas.width / size.width,
      y: canvas.y + (box.centerY - s.cameras.main.scrollY * object.scrollFactorY) * canvas.height / size.height };
  }, { scene, name });
  await f.page.touchscreen.tap(point.x, point.y); await frames(f);
}
async function selectChapter(f, id, mailboxOpen = false) {
  if (!mailboxOpen) await tap(f, 'MenuScene', 'mailbox-entry');
  await tap(f, 'MenuScene', 'mailbox-delivery');
  const selector = '[data-adventure-overlay="delivery-panel"]:visible';
  const pageFor = Math.floor(chapterIds.indexOf(id) / 2);
  let data = await f.page.locator(selector).evaluate(canvas => ({ ...canvas.dataset }));
  while (+data.page < pageFor) { await tap(f, 'MenuScene', 'delivery-next'); data = await f.page.locator(selector).evaluate(canvas => ({ ...canvas.dataset })); }
  while (+data.page > pageFor) { await tap(f, 'MenuScene', 'delivery-previous'); data = await f.page.locator(selector).evaluate(canvas => ({ ...canvas.dataset })); }
  await tap(f, 'MenuScene', `delivery-chapter:${id}`); await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene');
  check(await f.page.evaluate(id => window.g.scene.getScene('RunScene').delivery.chapter.id === id, id), `${f.label}: actual touch starts ${id}`);
}
async function freeze(f) {
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  await f.page.evaluate(() => window.g.scene.stop('PauseScene')); await frames(f);
  check(await f.page.evaluate(() => window.g.scene.isPaused('RunScene')), `${f.label}: fixture remains actually paused`);
}
async function setDistance(f, distance, delta = 0) {
  await f.page.evaluate(({ distance, delta }) => {
    const s = window.g.scene.getScene('RunScene'), r = s.delivery;
    r.distance = distance; r.next = r.chapter.obstacles.length;
    for (const obstacle of s.obstacles.getChildren()) if (obstacle.active) obstacle.deactivate();
    s.updateDelivery(delta);
  }, { distance, delta });
  await frames(f);
  return facts(f);
}
async function facts(f) {
  return f.page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), r = s.delivery, ox = -s.cameras.main.scrollX, oy = -s.cameras.main.scrollY;
    const image = o => {
      if (!o) return null;
      const b = o.getBounds(), sf = o.scrollFactorX;
      return { name: o.name, key: o.texture.key, x: o.x, y: o.y, width: o.width, height: o.height, displayWidth: o.displayWidth,
        displayHeight: o.displayHeight, scaleX: o.scaleX, scaleY: o.scaleY, depth: o.depth, alpha: o.alpha, visible: o.visible,
        originX: o.originX, originY: o.originY, scrollFactorX: sf, scrollFactorY: o.scrollFactorY,
        left: b.left + ox * sf, right: b.right + ox * sf, top: b.top + oy * o.scrollFactorY, bottom: b.bottom + oy * o.scrollFactorY };
    };
    const tile = o => ({ ...image(o), position: o.tilePositionX, tileScaleX: o.tileScaleX, tileScaleY: o.tileScaleY,
      sourceWidth: o.texture.getSourceImage().width, frameWidth: o.frame.cutWidth, frameHeight: o.frame.cutHeight });
    const landmark = s.children.list.find(o => o.name === 'delivery-windmill-grounded');
    const grass = s.children.list.find(o => o.name === 'delivery-windmill-near-grass');
    const mailbox = s.children.list.find(o => o.name === 'delivery-destination');
    return { size: { width: window.g.scale.gameSize.width, height: window.g.scale.gameSize.height }, ox, oy, distance: r.distance,
      state: r.state, endingMs: r.endingMs, nowMs: s.activeRunTimeMs, player: { x: s.sheep.x, y: s.sheep.y },
      reducedMotion: s.reducedMotion, chapter: { id: r.chapter.id, length: r.chapter.length, destinationAt: r.chapter.destinationAt, landscapes: r.chapter.landscapes },
      landmark: image(landmark), grass: grass && tile(grass), mailbox: image(mailbox),
      landscapes: s.deliveryView.landscapes.map(o => ({ image: image(o.image), left: image(o.left), right: image(o.right), road: tile(o.road) })),
      landmarkCount: s.children.list.filter(o => o.name === 'delivery-windmill-grounded').length,
      grassCount: s.children.list.filter(o => o.name === 'delivery-windmill-near-grass').length,
      activeObstacles: s.obstacles.getChildren().filter(o => o.active).map(o => ({ kind: o.definition.kind, x: o.x, at: o.getData('delivery-at'), depth: o.depth })),
    };
  });
}
async function shot(f, label) {
  const file = `screenshots/${phase}-${f.width}x${f.height}-dpr${f.dpr}-${f.label}-${label}.png`;
  await frames(f); await f.page.screenshot({ path: resolve(out, file), scale: 'css' }); report.screenshots.push(file); return file;
}
async function samplers(f) {
  return f.page.evaluate(keys => {
    const gl = window.g.renderer.gl, old = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const values = keys.map(key => {
      const source = window.g.textures.get(key).source[0]; gl.bindTexture(gl.TEXTURE_2D, source.glTexture.webGLTexture);
      return { key, source: [source.width, source.height], mode: source.scaleMode,
        min: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER), mag: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER), nearest: gl.NEAREST };
    });
    gl.bindTexture(gl.TEXTURE_2D, old); return values;
  }, layerKeys);
}
function geometry(f, a, label) {
  check(a.landmarkCount === 1 && a.grassCount === 1, `${label}: only one windmill and grass layer`);
  near(a.ox, a.size.width - 480, `${label}: unchanged camera x origin`);
  near(a.oy, Math.floor((a.size.height - 270) / 2), `${label}: unchanged camera y origin`);
  near(a.landmark.x, a.player.x + 158 + a.chapter.length - a.distance, `${label}: grounded world x`);
  near(a.landmark.y, 218, `${label}: landmark world ground baseline`);
  near(a.landmark.bottom, 218 + a.oy, `${label}: landmark screen ground baseline`);
  near(a.landmark.displayHeight, 160, `${label}: constant landmark height`);
  near(a.landmark.scaleX, a.landmark.scaleY, `${label}: uniformly scaled windmill`);
  near(a.grass.bottom, 218 + a.oy, `${label}: grass shares screen ground baseline`);
  near(a.grass.tileScaleX, .5, `${label}: grass tile scale`); near(a.grass.tileScaleX, a.grass.tileScaleY, `${label}: grass aspect ratio`);
  near(a.grass.height, 64, `${label}: single 128px grass source scaled to64px`);
  near(a.grass.width, a.size.width, `${label}: grass covers viewport`);
  near(mod(a.grass.position * .5 + a.ox, 480), mod(f.reducedMotion ? 0 : a.distance, 480), `${label}: grass origin and distance phase`);
  const last = a.landscapes.at(-1), start = a.chapter.landscapes.at(-1).transitionStart, end = a.chapter.landscapes.at(-1).transitionEnd;
  const alpha = Math.max(0, Math.min(1, (a.distance - start) / (end - start)));
  near(a.landmark.alpha, alpha, `${label}: landmark transition alpha`); near(a.grass.alpha, alpha, `${label}: grass transition alpha`);
  near(last.image.alpha, alpha, `${label}: backdrop transition alpha`);
  check(last.image.key === layerKeys[0] && last.road.key === layerKeys[0], `${label}: final image and road use clean plate`);
  check(last.left.left <= 1e-6 && last.right.right >= a.size.width - 1e-6, `${label}: clean plate covers viewport with mirrored outer edges`);
  near(last.left.right, last.image.left, `${label}: clean left join`); near(last.right.left, last.image.right, `${label}: clean right join`);
  for (const [index, { road }] of a.landscapes.entries()) {
    near(road.tileScaleX, road.tileScaleY, `${label}/${index}: road uniform scale`);
    near(road.y, 213 + a.oy, `${label}/${index}: unchanged road top`);
    near(mod(road.position * road.tileScaleX + a.ox, road.frameWidth * road.tileScaleX),
      mod(f.reducedMotion ? 0 : a.distance, road.frameWidth * road.tileScaleX), `${label}/${index}: road world phase`);
  }
  if (a.distance >= a.chapter.destinationAt) {
    check(a.mailbox.visible, `${label}: actual mailbox visible`);
    near(a.landmark.x - a.mailbox.x, 80, `${label}: windmill beside actual mailbox`);
    near(a.mailbox.bottom, a.landmark.bottom, `${label}: mailbox and windmill same ground`);
  }
  check(a.landmark.depth < a.mailbox.depth && a.grass.depth < a.mailbox.depth, `${label}: scenery behind actual mailbox`);
  if (a.distance === a.chapter.length) {
    check(a.landmark.left >= 0 && a.landmark.right <= a.size.width && a.landmark.top >= 0, `${label}: complete windmill rectangle fits at destination`);
  }
}
async function cleanupAndReenter(f, profile) {
  await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); window.qaOld = { view: s.deliveryView,
    landmark: s.children.list.find(o => o.name === 'delivery-windmill-grounded'), grass: s.children.list.find(o => o.name === 'delivery-windmill-near-grass') };
    s.scene.launch('PauseScene'); });
  await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
  profile.cleanup = await f.page.evaluate(() => ({ viewDisposed: window.qaOld.view.disposed,
    landmarkDestroyed: !window.qaOld.landmark.scene, grassDestroyed: !window.qaOld.grass.scene,
    runViewRemoved: !window.g.scene.getScene('RunScene').deliveryView }));
  check(Object.values(profile.cleanup).every(Boolean), `${f.label}: shutdown destroys owned objects and clears delivery view`);
  await selectChapter(f, windmillId, true); await freeze(f);
  profile.reentry = await facts(f);
  check(profile.reentry.distance < 200 && profile.reentry.landmarkCount === 1 && profile.reentry.grassCount === 1, `${f.label}: reentry resets distance with no duplicate objects`);
}
async function matrix() {
  const views = phase === 'smoke' ? [[800, 600, 2]] : [[480,270,1],[480,270,2],[896,414,1],[896,414,2],[844,390,1],[844,390,2],[800,600,1],[800,600,2]];
  for (const [width, height, dpr] of views) {
    const f = await open(width, height, dpr, 'matrix'); await selectChapter(f, windmillId); await freeze(f);
    const profile = { width, height, dpr, main: f.main, renderer: f.renderer, samples: [] }; report.profiles.push(profile);
    profile.samplers = await samplers(f);
    check(profile.samplers.every(s => s.mode === 1 && s.min === s.nearest && s.mag === s.nearest), `${width}/${dpr}: all three runtime source samplers are NEAREST`);
    for (const distance of [13600, 14100, 14600, 20750, 20920]) {
      const before = await setDistance(f, distance); geometry(f, before, `${width}/${dpr}/${distance}`);
      await f.page.evaluate(() => window.g.scene.getScene('RunScene').updateDelivery(40)); await frames(f);
      const after = await facts(f), travelled = after.distance - before.distance;
      check(travelled > 0 && after.state === 'running', `${width}/${dpr}/${distance}: direct fixture update advances real route`);
      near(before.landmark.x - after.landmark.x, travelled, `${width}/${dpr}/${distance}: landmark moves at1x`);
      near(mod(after.grass.position - before.grass.position, before.grass.sourceWidth) * before.grass.tileScaleX,
        travelled, `${width}/${dpr}/${distance}: grass moves at1x`);
      const road = before.landscapes.at(-1).road;
      near(mod(after.landscapes.at(-1).road.position - road.position, road.frameWidth) * road.tileScaleX,
        travelled, `${width}/${dpr}/${distance}: road moves at1x`);
      check(after.landscapes.at(-1).image.x < before.landscapes.at(-1).image.x, `${width}/${dpr}/${distance}: far panorama moves left`);
      check(before.landscapes.at(-1).image.x - after.landscapes.at(-1).image.x < travelled, `${width}/${dpr}/${distance}: far panorama slower than near layers`);
      profile.samples.push({ before, after, travelled });
      if (distance === 14100) profile.transitionScreenshot = await shot(f, 'transition-half');
    }
    const endpoint = await setDistance(f, 21000); geometry(f, endpoint, `${width}/${dpr}/endpoint`);
    profile.endpoint = endpoint; profile.endpointScreenshot = await shot(f, 'endpoint');
    if (phase !== 'smoke' && width === 896 && dpr === 2) {
      const distance = 20820; await setDistance(f, distance); profile.resize = [];
      for (const [w,h] of [[800,600],[480,270],[896,414]]) {
        await f.page.setViewportSize({ width: w, height: h });
        const expected = w/h >= 480/270 ? Math.round(270*w/h) : 480;
        await f.page.waitForFunction(expected => window.g.scale.gameSize.width === expected, expected); await frames(f);
        const state = await facts(f); near(state.distance, distance, `resize${w}: route remains paused`); geometry(f, state, `resize${w}`);
        profile.resize.push(state);
      }
    }
    await cleanupAndReenter(f, profile); await f.context.close(); await checkpoint();
    process.stdout.write(`${phase} ${width}x${height} DPR${dpr}: windmill matrix passed\n`);
  }
}
async function reduced() {
  const f = await open(896, 414, 2, 'reduced', true); await selectChapter(f, windmillId); await freeze(f);
  const before = await setDistance(f, 20750), after = await setDistance(f, 20880);
  geometry(f, before, 'reduced/before'); geometry(f, after, 'reduced/after');
  near(after.grass.position, before.grass.position, 'reduced: optional grass phase frozen');
  near(after.landscapes.at(-1).image.x, before.landscapes.at(-1).image.x, 'reduced: distant panorama frozen');
  near(before.landmark.x - after.landmark.x, 130, 'reduced: necessary grounded destination moves with world');
  const record = { before, after, screenshot: await shot(f, 'world-placement') }; report.reduced = record;
  await f.context.close(); await checkpoint();
}
async function finale() {
  const [width,height,dpr] = phase === 'smoke' ? [800,600,2] : [896,414,2];
  const f = await open(width, height, dpr, 'safe-finale'); await selectChapter(f, windmillId); await freeze(f);
  const fixture = await setDistance(f, 20500);
  check(fixture.activeObstacles.length === 0 && fixture.state === 'running', 'video: isolated20500 fixture is after all authored hazards');
  await f.page.evaluate(() => {
    window.g.scene.getScene('RunScene').scene.launch('PauseScene');
    const canvas = window.g.canvas, stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    window.qaRecorder = new MediaRecorder(stream, { mimeType }); window.qaChunks = [];
    window.qaRecorder.ondataavailable = event => { if (event.data.size) window.qaChunks.push(event.data); };
    window.qaRecording = { mimeType, width: canvas.width, height: canvas.height, startedAt: performance.now() };
    window.qaRecorder.start(100);
  });
  await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.distance >= 20770);
  const approaching = await facts(f);
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene');
  const paused = await facts(f); await sleep(650); const held = await facts(f);
  near(held.distance, paused.distance, 'video: real touch pause freezes route'); near(held.nowMs, paused.nowMs, 'video: real touch pause freezes effective clock');
  near(held.landmark.x, paused.landmark.x, 'video: real touch pause freezes landmark'); near(held.grass.position, paused.grass.position, 'video: real touch pause freezes grass');
  near(held.landscapes.at(-1).road.position, paused.landscapes.at(-1).road.position, 'video: real touch pause freezes road');
  const pausedScreenshot = await shot(f, 'real-pause');
  await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').delivery.distance >= 21000);
  const endpoint = await facts(f); geometry(f, endpoint, 'video/normal-endpoint');
  check(endpoint.distance > held.distance, 'video: actual resume restores normal progression');
  const endpointScreenshot = await shot(f, 'normal-endpoint');
  await f.page.evaluate(async () => {
    const remaining = 8800 - (performance.now() - window.qaRecording.startedAt);
    if (remaining > 0) await new Promise(done => setTimeout(done, remaining));
    window.qaRecording.endedAt = performance.now();
    await new Promise(done => { window.qaRecorder.onstop = done; window.qaRecorder.stop(); });
  });
  const video = await f.page.evaluate(async () => {
    const blob = new Blob(window.qaChunks, { type: window.qaRecording.mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ''; for (let start=0; start<bytes.length; start+=32768) binary += String.fromCharCode(...bytes.subarray(start,start+32768));
    return { ...window.qaRecording, bytes: bytes.length, base64: btoa(binary) };
  });
  const file = `videos/${phase}-safe-finale-${width}x${height}-dpr${dpr}.webm`;
  await writeFile(resolve(out, file), Buffer.from(video.base64, 'base64')); delete video.base64;
  near(video.endedAt - video.startedAt, 8800, 'video: approximately8.8seconds recording', 300);
  check(video.bytes > 10000, 'video: actual WebM contains captured frames');
  report.video = { fixture, approaching, paused, held, endpoint, final: await facts(f), capture: video, file, pausedScreenshot, endpointScreenshot };
  await f.context.close(); await checkpoint(); process.stdout.write(`${phase}: staged normal finale and real touch pause/resume video passed\n`);
}
async function regression() {
  const f = await open(800,600,2,'regression');
  for (const [index,id] of ['dinner-for-you-v1','lighthouse-starlight-v1'].entries()) {
    await selectChapter(f,id,index>0); await freeze(f); const state = await setDistance(f,id==='dinner-for-you-v1'?13000:23000);
    check(state.landmarkCount===0 && state.grassCount===0, `regression/${id}: no windmill-only layers`);
    check(state.landscapes.every(o=>o.image.key!==layerKeys[0]), `regression/${id}: original chapter art retained`);
    report.regressions.push({id,state,screenshot:await shot(f,id)});
    await f.page.evaluate(()=>window.g.scene.getScene('RunScene').scene.launch('PauseScene')); await ready(f,'PauseScene');
    await tap(f,'PauseScene','button:返回首页'); await ready(f,'MenuScene');
  }
  await f.context.close(); await checkpoint();
}

async function grassRetry() {
  const context = await browser.newContext({ viewport: { width:800,height:600 }, deviceScaleFactor:2, isMobile:true,hasTouch:true });
  // A harmless marker in this temporary context verifies retry does not clear storage.
  await context.addInitScript(() => localStorage.setItem('qa-windmill-retry-marker','preserved'));
  let blocking = true, failedRequests = 0;
  const grassRequest = address => /\/assets\/windmill-physics-v1\/runtime\/grass\.png(?:\?.*)?$/.test(address)
    || /\/assets\/grass-[^/]+\.png(?:\?.*)?$/.test(address);
  await context.route('**/*', route => {
    if (blocking && grassRequest(route.request().url())) { failedRequests++; return route.abort('failed'); }
    return route.continue();
  });
  const page = await context.newPage(), f = { context,page,width:800,height:600,dpr:2,label:'actual-grass-retry' };
  page.on('pageerror',error=>report.errors.push({label:f.label,message:error.message}));
  const request = page.waitForRequest(r=>/(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(r.url()));
  await page.goto(url,{waitUntil:'domcontentloaded'}); f.main=(await request).url();
  await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},f.main);
  await page.waitForFunction(()=>window.g.scene.getScene('PreloadScene').children.list.some(o=>o.name==='local-load-error'));
  check(failedRequests>0,'retry: actual new grass PNG request was deliberately failed');
  const failed = await page.evaluate(()=>({menuActive:window.g.scene.isActive('MenuScene'),
    grassPresent:window.g.textures.exists('windmill-meadow-physics-grass'),
    marker:localStorage.getItem('qa-windmill-retry-marker')}));
  check(!failed.menuActive && !failed.grassPresent,'retry: missing actual grass blocks entry and shows fallback');
  const failedScreenshot=await shot(f,'grass-load-failed');
  blocking=false;
  const response = page.waitForResponse(r=>grassRequest(r.url()) && r.status()===200);
  await tap(f,'PreloadScene','button:重试'); await response; await ready(f,'MenuScene');
  const recovered = await page.evaluate(()=>({menuActive:window.g.scene.isActive('MenuScene'),
    grassPresent:window.g.textures.exists('windmill-meadow-physics-grass'),
    marker:localStorage.getItem('qa-windmill-retry-marker')}));
  check(recovered.menuActive && recovered.grassPresent,'retry: actual touchscreen retry reloads grass and reaches menu');
  check(recovered.marker==='preserved','retry: ephemeral storage marker survives actual retry');
  report.retry={main:f.main,failedRequests,failed,recovered,failedScreenshot,recoveredScreenshot:await shot(f,'grass-retry-recovered')};
  await context.close(); await checkpoint(); process.stdout.write(`${phase}: actual grass load failure and touch retry passed\n`);
}

try {
  await matrix();
  if (phase !== 'smoke') await reduced();
  await finale();
  if (phase === 'smoke') { await regression(); await grassRetry(); }
  check(report.errors.length === 0, 'no unhandled browser errors'); report.passed = true;
} catch (error) {
  report.failure = error.stack || String(error);
  for (const [index,context] of browser.contexts().entries()) for (const page of context.pages()) {
    try { await page.screenshot({ path: resolve(out,'screenshots',`${phase}-failure-${index}.png`), scale:'css' }); } catch {}
  }
  throw error;
} finally { await checkpoint(); await browser.close(); }
process.stdout.write(JSON.stringify({passed:report.passed,phase,profiles:report.profiles.length,checks:report.checks.length,
  screenshots:report.screenshots.length,video:report.video?.file,phoneHardware:false})+'\n');
