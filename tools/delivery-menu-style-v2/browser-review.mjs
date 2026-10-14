/** Visual integration evidence. Fixtures sample renderer state, never natural route wins. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, process.env.STYLE_REVIEW_OUT ?? 'docs/delivery-menu-style-v2/browser');
const smoke = process.env.STYLE_REVIEW_SMOKE === '1';
const url = process.env.STYLE_REVIEW_URL ?? 'http://127.0.0.1:4392/';
const chapters = ['dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'];
const completedIds = ['hill-goodnight-v1', ...chapters];
const sizes = [[480, 270], [896, 414], [844, 390], [800, 600]];
const save = { version: 5, highScore: 0, totalStars: 0, spentStars: 0, coins: 0, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } };
const sha = data => createHash('sha256').update(data).digest('hex');
const report = { passed: false, url, generatedAt: new Date().toISOString(), phoneHardware: false, naturalWin: false,
  method: 'Ephemeral touch-enabled browser profiles. Five-completed DeliveryStore fixture gates cosmetic postcard access. RunScene sys.sceneUpdate is frozen and Arcade physics paused for renderer-only distance/ending fixtures. Ending is sampled by DeliveryView.update, without calling completion, awarding rewards or persisting successes. Touch controls exercise real panel/pause/retry handlers. No user browser profile or production save is read or changed.',
  checks: [], profiles: [], screenshots: [], assets: [], errors: [], expectedNetworkFailures: [] };
const check = (value, name, facts) => { report.checks.push({ name, passed: !!value, ...(facts === undefined ? {} : { facts }) }); return !!value; };
const snapshot = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(path.join(out, 'screenshots'), { recursive: true });

// Read the current explicit import bindings; old/new filenames can share their texture keys.
const bindings = new Map();
for (const relative of ['src/delivery/DeliveryV2Assets.ts', 'src/delivery/DeliveryExpansionAssets.ts']) {
  const full = path.join(root, relative), source = await readFile(full, 'utf8');
  const imports = new Map([...source.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+\.png)\?url['"]/g)].map(match => [match[1], path.resolve(path.dirname(full), match[2])]));
  for (const match of source.matchAll(/\{\s*key:\s*['"]([^'"]+)['"],\s*url:\s*(\w+)/g)) {
    const file = imports.get(match[2]);
    if (file?.includes(`${path.sep}delivery-menu-style-v2${path.sep}runtime${path.sep}`)) bindings.set(match[1], file);
  }
}
assert.equal(bindings.size, 20, 'Current asset imports must bind all twenty new runtime files before this review runs');
const runtime = [];
for (const [key, file] of bindings) {
  const bytes = await readFile(file);
  runtime.push({ key, file: path.relative(root, file).replaceAll('\\', '/'), sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length });
}
const manifestCandidates = process.env.STYLE_PROCESSING_MANIFEST ? [process.env.STYLE_PROCESSING_MANIFEST] : ['assets/delivery-menu-style-v2/processing.json', 'assets/delivery-menu-style-v2/metadata/processing.json', 'assets/delivery-menu-style-v2/manifest.json'];
let manifest, manifestPath;
for (const relative of manifestCandidates) { try { manifest = JSON.parse(await readFile(path.resolve(root, relative), 'utf8')); manifestPath = relative; break; } catch (error) { if (error.code !== 'ENOENT') throw error; } }
assert.ok(manifest, 'Packing processing manifest must exist');
const manifestHashes = new Set();
function hashes(value) { if (typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)) manifestHashes.add(value.toLowerCase()); else if (Array.isArray(value)) value.forEach(hashes); else if (value && typeof value === 'object') Object.values(value).forEach(hashes); }
hashes(manifest);
report.processing = { file: manifestPath, sha256: sha(await readFile(path.resolve(root, manifestPath))), runtime };
check(runtime.every(item => manifestHashes.has(item.sha256)), 'All twenty runtime SHA256 values are recorded in processing manifest');
check((await readdir(path.join(root, 'assets/delivery-menu-style-v2/runtime'))).filter(name => name.endsWith('.png')).length === 20, 'Exactly twenty PNGs in the new runtime directory');
const baseline = JSON.parse(await readFile(path.join(root, 'docs/delivery-menu-style-v2/baseline.json'), 'utf8'));
const pixelHashes = JSON.parse(await readFile(path.join(root, 'docs/delivery-menu-style-v2/pixel-hashes.json'), 'utf8'));
const protectedTextures = [
  ['illustrated-pasture-menu', 'assets/backgrounds/menu-pasture-v1.png'],
  ['delivery-forest-v1', 'assets/delivery-v1/runtime/forest.png'],
  ['delivery-hill-v1', 'assets/delivery-v1/runtime/hill.png'],
  ['delivery-postcard-v1', 'assets/delivery-v1/runtime/postcard.png'],
  ['windmill-meadow-physics-backdrop', 'assets/windmill-physics-v1/runtime/backdrop.png'],
  ['windmill-meadow-physics-landmark', 'assets/windmill-physics-v1/runtime/windmill.png'],
  ['windmill-meadow-physics-grass', 'assets/windmill-physics-v1/runtime/grass.png'],
];
for (const [key, file] of protectedTextures) check(sha(await readFile(path.join(root, file))) === baseline.files[file], `${key}: protected source bytes match frozen baseline`);

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const imageResponseTasks = new WeakMap();
async function frames(page) {
  await page.evaluate(() => new Promise(resolve => { let n = 2; const callback = () => { if (!--n) { window.g.events.off('postrender', callback); resolve(); } }; window.g.events.on('postrender', callback); }));
}
async function ready(page, scene) {
  await page.waitForFunction(name => window.g?.scene.isActive(name) && window.g.scene.getScene(name).children.list.length > 0, scene, { timeout: 20000 });
  await frames(page);
}
async function createProfile(width, height, dpr, label, abortUrl) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await context.addInitScript(({ save, completedIds }) => {
    localStorage.setItem('sheep-run-save', JSON.stringify(save));
    localStorage.setItem('sheep-run-delivery-v1', JSON.stringify({ version: 1, completedIds }));
  }, { save, completedIds });
  const page = await context.newPage(), profile = { label, width, height, dpr, views: [], requestsFailed: [], badHttp: [], touch: [], imageResponses: [] };
  const responseTasks = []; imageResponseTasks.set(page, responseTasks);
  page.on('pageerror', error => report.errors.push({ profile: label, error: error.message }));
  page.on('requestfailed', request => profile.requestsFailed.push({ url: request.url(), reason: request.failure()?.errorText }));
  page.on('response', response => {
    if (response.status() >= 400) profile.badHttp.push({ url: response.url(), status: response.status() });
    if (/\.png(?:\?|$)/.test(response.url())) responseTasks.push((async () => {
      try { const bytes = await response.body(); profile.imageResponses.push({ url: response.url(), status: response.status(), bytes: bytes.length, sha256: sha(bytes) }); }
      catch (error) { profile.imageResponses.push({ url: response.url(), status: response.status(), bodyError: error.message }); }
    })());
  });
  let aborted = false, permitAsset = false;
  if (abortUrl) await page.route(abortUrl, async route => { if (!permitAsset) { aborted = true; report.expectedNetworkFailures.push({ profile: label, url: route.request().url(), status: null, reason: 'actual rain-middle URL blocked until manual touch retry; no HTTP response exists' }); await route.abort('failed'); } else await route.continue(); });
  const mainRequest = page.waitForRequest(request => /\/assets\/main-[^/]+\.js$/.test(request.url()));
  mainRequest.catch(() => {}); // Retain the actual navigation error when the host stops.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  profile.main = (await mainRequest).url();
  const mainResponse = await context.request.get(profile.main); profile.mainSha256 = sha(await mainResponse.body());
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, profile.main);
  return { context, page, profile, aborted: () => aborted, releaseAsset: () => { permitAsset = true; } };
}
async function storage(page) { return page.evaluate(() => ({ runner: localStorage.getItem('sheep-run-save'), delivery: localStorage.getItem('sheep-run-delivery-v1'), challenge: localStorage.getItem('sheep-run-delivery-challenge-v1') })); }
async function tap(page, scene, name) {
  const point = await page.evaluate(({ scene, name }) => {
    const s = window.g.scene.getScene(scene);
    const find = list => { for (const object of list) { if (object.name === name) return object; if (object.list) { const found = find(object.list); if (found) return found; } } };
    const object = find(s.children.list); if (!object?.input?.enabled) throw new Error(`Disabled/missing touch target ${scene}/${name}`);
    const bounds = object.getBounds(), rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize, camera = s.cameras.main;
    return { x: rect.x + (bounds.centerX - camera.scrollX * object.scrollFactorX) * rect.width / size.width, y: rect.y + (bounds.centerY - camera.scrollY * object.scrollFactorY) * rect.height / size.height };
  }, { scene, name });
  await page.touchscreen.tap(point.x, point.y); await frames(page); return point;
}
async function run(page, id) {
  await page.evaluate(id => {
    const pause = window.g.scene.getScene('PauseScene'); if (pause.scene.isActive()) pause.scene.stop();
    const scene = window.g.scene.getScenes(true)[0];
    if (scene.sys.settings.key === 'RunScene') scene.scene.restart({ deliveryId: id }); else scene.scene.start('RunScene', { deliveryId: id });
  }, id);
  await page.waitForFunction(id => window.g.scene.isActive('RunScene') && window.g.scene.getScene('RunScene').delivery?.chapter.id === id, id, { timeout: 15000 });
  await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.sys.sceneUpdate = () => {}; s.physics.pause(); });
  await frames(page);
}
async function stage(page, index) {
  return page.evaluate(index => {
    const s = window.g.scene.getScene('RunScene'), layer = s.delivery.chapter.landscapes[index];
    const at = layer.transitionEnd;
    s.delivery.distance = at;
    const weather = s.delivery.phase.weather ?? s.delivery.chapter.weather ?? 'clear';
    s.environmentSystem?.setWeather(weather === 'rain' ? 'rain' : 'sunny'); s.environmentSystem?.update(at, 0, 0);
    s.deliveryView.update(s.delivery, 0);
    return { index, at, key: layer.key, phase: s.delivery.phase.id, weather };
  }, index);
}
async function facts(page) {
  return page.evaluate(() => {
    const g = window.g, canvas = g.canvas, rect = canvas.getBoundingClientRect(), size = g.scale.gameSize;
    const s = g.scene.getScene('RunScene'), activeRun = g.scene.isActive('RunScene') || g.scene.isPaused('RunScene');
    const origin = { x: size.width - 480, y: Math.floor((size.height - 270) / 2) };
    const images = activeRun ? s.children.list.filter(object => object.texture && /^(delivery-landscape:|delivery-road:|delivery-ending-|delivery-sharing-dinner|delivery-stargazing|delivery-windmill-)/.test(object.name ?? '')).map(object => ({
      name: object.name, type: object.type, key: object.texture.key, source: [object.texture.source[0].width, object.texture.source[0].height],
      scale: [object.scaleX, object.scaleY], display: [object.displayWidth, object.displayHeight], x: object.x, y: object.y,
      alpha: object.alpha, visible: object.visible, filter: object.texture.source[0].scaleMode,
      crop: object._crop ? { x: object._crop.x, y: object._crop.y, width: object._crop.width, height: object._crop.height } : null,
      frame: { x: object.frame.cutX, y: object.frame.cutY, width: object.frame.cutWidth, height: object.frame.cutHeight },
      tileScale: typeof object.tileScaleX === 'number' ? [object.tileScaleX, object.tileScaleY] : null,
    })) : [];
    const overlay = [...document.querySelectorAll('canvas[data-adventure-overlay="delivery-panel"]')].find(element => element.style.display === 'block');
    const panel = overlay ? { mode: overlay.dataset.mode, chapterId: overlay.dataset.chapterId, images: JSON.parse(overlay.dataset.images ?? '[]'), lines: JSON.parse(overlay.dataset.lines ?? '[]'), pressed: JSON.parse(overlay.dataset.pressed ?? '[]'), enabled: JSON.parse(overlay.dataset.enabled ?? '[]'), names: JSON.parse(overlay.dataset.targetNames ?? '[]'), smoothing: overlay.getContext('2d').imageSmoothingEnabled, width: overlay.width, height: overlay.height } : null;
    return { size: { width: size.width, height: size.height }, origin, webgl: !!g.renderer.gl,
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, pixels: [canvas.width, canvas.height], rendering: getComputedStyle(canvas).imageRendering },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, scroll: { x: scrollX, y: scrollY, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      chapter: activeRun ? s.delivery?.chapter.id : null, route: activeRun && s.delivery ? { distance: s.delivery.distance, state: s.delivery.state, endingMs: s.delivery.endingMs } : null,
      player: activeRun ? { x: s.sheep.x, y: s.sheep.y, bodyBottom: s.sheep.body?.bottom, bodyX: s.sheep.body?.x, source: s.sheep.texture?.key } : null,
      images, panel, overlayCount: document.querySelectorAll('canvas[data-adventure-overlay="delivery-panel"]').length };
  });
}
async function shot(page, profile, name, detail) {
  await frames(page); const file = `screenshots/${profile.label}-${name}.png`;
  await page.screenshot({ path: path.join(out, file), scale: 'css' });
  const state = await facts(page); const entry = { name, file, ...(detail ?? {}), state };
  profile.views.push(entry); report.screenshots.push(file);
  check(state.webgl, `${profile.label}/${name}: actual WebGL renderer`);
  check(state.canvas.rendering === 'pixelated', `${profile.label}/${name}: pixelated canvas`);
  check(Math.abs(state.canvas.x) < 1 && Math.abs(state.canvas.y) < 1 && Math.abs(state.canvas.width - state.viewport.width) < 1.5 && Math.abs(state.canvas.height - state.viewport.height) < 1.5, `${profile.label}/${name}: canvas fills viewport`, state.canvas);
  check(state.scroll.x === 0 && state.scroll.y === 0 && state.scroll.width <= state.viewport.width + 1 && state.scroll.height <= state.viewport.height + 1, `${profile.label}/${name}: no document scrolling`);
  check(state.images.filter(image => image.type !== 'Sprite').every(image => Math.abs(image.scale[0] - image.scale[1]) < 1e-9 && (!image.tileScale || Math.abs(image.tileScale[0] - image.tileScale[1]) < 1e-9)), `${profile.label}/${name}: uniform illustration and road tile scales`);
  check(state.images.every(image => image.filter === 1), `${profile.label}/${name}: NEAREST sampled texture sources`);
  if (detail?.stage) {
    const image = state.images.find(item => item.name === `delivery-landscape:${detail.stage.key}`), road = state.images.find(item => item.name === `delivery-road:${detail.stage.key}`);
    check(image?.alpha === 1 && road?.alpha === 1 && image.visible && road.visible, `${profile.label}/${name}: requested stage actually visible`, { image, road });
    const higherStages = state.images.filter(item => item.name.startsWith('delivery-landscape:')).slice(detail.stage.index + 1);
    check(higherStages.every(item => item.alpha === 0), `${profile.label}/${name}: later stage does not cover requested panorama`);
    check(Math.abs(road.y - (213 + state.origin.y)) < 1e-6, `${profile.label}/${name}: road stays at authored 213 ground rim`);
    check(Math.abs(image.y + image.crop.height * image.scale[1] - 213) < 1e-6, `${profile.label}/${name}: panorama crop meets road without gap`);
    check(Math.abs(state.player.bodyBottom - 218) < 1, `${profile.label}/${name}: physical player body ground remains 218`, state.player);
    if (detail.stage.key === 'delivery-expansion-windmill-destination') check(image.key === 'windmill-meadow-physics-backdrop' && state.images.some(item => item.name === 'delivery-windmill-grounded' && item.alpha === 1 && item.visible), `${profile.label}/${name}: existing windmill special backdrop and grounded actor remain active`);
  }
  if (state.panel) {
    check(state.panel.smoothing === false, `${profile.label}/${name}: panel canvas smoothing disabled`);
    check(state.panel.images.every(image => Math.abs(image.width / image.sourceWidth - image.height / image.sourceHeight) < 1e-8), `${profile.label}/${name}: illustrations retain source proportions in panel`);
  }
  return state;
}
async function verifyAssets(context, page, profile, protectedAlso = false) {
  const keys = [...runtime.map(item => item.key), ...(protectedAlso ? protectedTextures.map(item => item[0]) : [])];
  const textures = await page.evaluate(async keys => Promise.all(keys.map(async key => {
    const texture = window.g.textures.get(key), source = texture.getSourceImage();
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const painter = canvas.getContext('2d'); painter.imageSmoothingEnabled = false; painter.drawImage(source, 0, 0);
    const bytes = painter.getImageData(0, 0, canvas.width, canvas.height).data;
    const loadedRgbaSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('');
    return { key, exists: window.g.textures.exists(key), loadedRgbaSha256, width: source.width, height: source.height, filter: texture.source[0].scaleMode };
  })), keys);
  await Promise.all(imageResponseTasks.get(page));
  const verified = [];
  for (const texture of textures) {
    const expected = runtime.find(item => item.key === texture.key), protectedFile = protectedTextures.find(item => item[0] === texture.key)?.[1];
    const expectedFileHash = expected?.sha256 ?? baseline.files[protectedFile];
    const observed = profile.imageResponses.find(response => response.sha256 === expectedFileHash && response.status === 200);
    assert.ok(observed, `Actual PNG HTTP response must match exact asset bytes: ${texture.key}`);
    const response = await context.request.get(observed.url), bytes = await response.body(), digest = sha(bytes);
    const item = { profile: profile.label, ...texture, httpUrl: observed.url, status: response.status(), sha256: digest, expectedSha256: expected?.sha256 ?? baseline.files[protectedFile] };
    report.assets.push(item);
    verified.push(item);
    check(response.ok() && texture.exists && digest === item.expectedSha256, `${profile.label}/${texture.key}: actual HTTP bytes match correct asset`, item);
    if (expected) {
      check(texture.loadedRgbaSha256 === pixelHashes[texture.key].rgbaSha256, `${profile.label}/${texture.key}: actual decoded texture pixels match exact runtime PNG`, item);
      check(texture.width === expected.width && texture.height === expected.height && texture.filter === 1, `${profile.label}/${texture.key}: current texture dimensions and NEAREST match manifest`);
    }
  }
  return verified;
}

try {
  let retryUrl;
  const retryOnly = process.env.STYLE_REVIEW_RETRY_ONLY === '1';
  if (retryOnly) {
    const priorPath = path.join(out, 'attempt-03-auto-recovery/report.json');
    const prior = JSON.parse(await readFile(priorPath, 'utf8'));
    assert.equal(prior.processing.sha256, report.processing.sha256, 'Retained matrix must use identical frozen art');
    assert.equal(prior.profiles.length, 8);
    assert.ok(prior.profiles.every(profile => !profile.failure), 'Only reuse the fully passed matrix');
    report.checks = prior.checks.filter(item => !/^(Retry case|Resource retry|Resource failure|No unhandled browser)/.test(item.name));
    assert.ok(report.checks.every(item => item.passed));
    report.profiles = prior.profiles; report.screenshots = prior.screenshots; report.assets = prior.assets;
    report.targetedRetryRerun = { retainedMatrix: priorPath, previousRetryFailure: prior.retry.failure };
    retryUrl = prior.assets.find(item => item.key === 'delivery-expansion-rain-middle').httpUrl;
  }
  for (const dpr of retryOnly ? [] : [1, 2]) for (const [width, height] of sizes) {
    if (smoke && (width !== 896 || dpr !== 1)) continue;
    const label = `${width}x${height}-dpr${dpr}`, fixture = await createProfile(width, height, dpr, label);
    const { context, page, profile } = fixture;
    report.profiles.push(profile);
    try {
      await ready(page, 'MenuScene'); const before = await storage(page); profile.storageBefore = before;
      profile.menuOverlayBaseline = (await shot(page, profile, 'menu-reference')).overlayCount;
      const textures = await verifyAssets(context, page, profile, width === 480 && dpr === 1);
      retryUrl ??= textures.find(item => item.key === 'delivery-expansion-rain-middle').httpUrl;
      await run(page, 'hill-goodnight-v1');
      const oldStages = await page.evaluate(() => window.g.scene.getScene('RunScene').delivery.chapter.landscapes.length);
      for (let index = 0; index < oldStages; index++) { const sampled = await stage(page, index); await shot(page, profile, `goodnight-stage-${index}`, { fixture: true, stage: sampled }); }
      for (const id of chapters) {
        await run(page, id);
        for (let index = 0; index < 3; index++) { const sampled = await stage(page, index); await shot(page, profile, `${id}-stage-${index}`, { fixture: true, stage: sampled }); }
        // Presentation-only ending sample. It must not invoke route completion/save handlers.
        await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.delivery.distance = s.delivery.chapter.length; s.delivery.state = 'ending'; s.delivery.endingMs = 1800; s.deliveryView.update(s.delivery, 1800); });
        const ending = await shot(page, profile, `${id}-ending`, { fixture: true, ending: true });
        const poster = ending.images.find(item => item.name === 'delivery-sharing-dinner' || /^delivery-ending-(invitation|umbrella|lighthouse)$/.test(item.name));
        profile.endingPresentation ??= []; profile.endingPresentation.push({ id, poster: { key: poster?.key, alpha: poster?.alpha, visible: poster?.visible }, posterActuallyVisible: !!poster?.visible && poster.alpha > .01, dynamicActorsVisible: ending.images.some(item => item.name === 'delivery-ending-lead' && item.alpha > 0 && item.visible) });
        await run(page, id);
        const opened = await page.evaluate(id => window.g.scene.getScene('RunScene').deliveryPanel.show('brief', false, id), id);
        check(opened, `${label}/${id}: real existing chapter brief opened`);
        const brief = await shot(page, profile, `${id}-brief`, { fixture: true, panelBrief: true });
        const previewKey = await page.evaluate(() => window.g.scene.getScene('RunScene').delivery.chapter.previewKey);
        check(brief.panel?.mode === 'brief' && brief.panel.images.some(item => item.key === previewKey), `${label}/${id}: current destination art is actually drawn in chapter preview`);
        await tap(page, 'RunScene', 'delivery-card');
        const card = await shot(page, profile, `${id}-postcard`, { touch: true, postcard: true });
        const postcardKey = await page.evaluate(() => window.g.scene.getScene('RunScene').delivery.chapter.postcardKey);
        check(card.panel?.mode === 'postcard' && card.panel.images.some(item => item.key === postcardKey), `${label}/${id}: real touch reveals correct new postcard`);
        await tap(page, 'RunScene', 'delivery-back'); await frames(page);
        const returned = await facts(page); check(returned.panel?.mode === 'brief' && returned.panel.chapterId === id, `${label}/${id}: postcard touch return preserves selected chapter`);
        await tap(page, 'RunScene', 'delivery-back'); await ready(page, 'MenuScene');
        check((await facts(page)).overlayCount === profile.menuOverlayBaseline, `${label}/${id}: panel cleanup matches fresh menu overlay count`);
      }
      // Eight actual pause/resume/home cycles in a representative full-size profile.
      if (width === 896 && dpr === 1) for (const id of chapters) for (let repeat = 0; repeat < 2; repeat++) {
        await run(page, id); const start = await facts(page);
        await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene');
        const paused = await facts(page); await sleep(100); const held = await facts(page);
        check(JSON.stringify(paused.route) === JSON.stringify(held.route), `${label}/${id}/${repeat}: real touch pause holds fixture distance and presentation`);
        await tap(page, 'PauseScene', 'button:继续游戏'); await ready(page, 'RunScene');
        check((await facts(page)).chapter === id, `${label}/${id}/${repeat}: resume retains exact chapter`);
        await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene');
        await tap(page, 'PauseScene', 'button:返回首页'); await ready(page, 'MenuScene');
        const menu = await facts(page);
        check(menu.overlayCount === profile.menuOverlayBaseline, `${label}/${id}/${repeat}: touch home disposes old delivery panel`);
        const mailboxOpen = await page.evaluate(() => [...document.querySelectorAll('canvas[data-adventure-overlay="mailbox"]')].some(element => element.style.display === 'block' && window.g.scene.getScene('MenuScene').children.list.some(object => object.name === 'mailbox-delivery' && object.input?.enabled)));
        check(mailboxOpen, `${label}/${id}/${repeat}: touch home returns to live mailbox`);
        profile.touch.push({ id, repeat, start, paused, held, menu, mailboxOpen });
      }
      profile.storageAfter = await storage(page);
      check(JSON.stringify(before) === JSON.stringify(profile.storageAfter), `${label}: cosmetic fixtures and touch navigation leave runner/delivery/challenge records unchanged`);
      check(profile.requestsFailed.length === 0 && profile.badHttp.length === 0, `${label}: no unexpected failed requests or HTTP errors`, { failed: profile.requestsFailed, badHttp: profile.badHttp });
    } catch (error) { profile.failure = error.stack; check(false, `${label}: profile finished without harness/runtime failure`, error.message); }
    finally { await context.close(); await snapshot(); }
    process.stdout.write(JSON.stringify({ completedProfile: label, failures: report.checks.filter(item => !item.passed).length, screenshots: report.screenshots.length }) + '\n');
  }
  assert.ok(retryUrl, 'Actual rain-middle loaded URL was observed');
  if (!smoke) {
  const retry = await createProfile(896, 414, 1, 'resource-retry', retryUrl);
  report.retry = retry.profile;
  try {
    await retry.page.waitForFunction(() => window.g.scene.getScene('PreloadScene').children.list.some(object => object.name === 'local-load-error'), null, { timeout: 20000 });
    check(retry.aborted(), 'Retry case blocked the actual new rain-middle URL until manual retry');
    const saved = await storage(retry.page);
    await shot(retry.page, retry.profile, 'local-load-error', { expectedFailure: true });
    retry.releaseAsset(); await tap(retry.page, 'PreloadScene', 'button:重试'); await ready(retry.page, 'MenuScene');
    await verifyAssets(retry.context, retry.page, retry.profile);
    await run(retry.page, 'rainy-umbrella-v1'); const sampled = await stage(retry.page, 1);
    await shot(retry.page, retry.profile, 'recovered-rain-middle', { fixture: true, stage: sampled });
    check(JSON.stringify(saved) === JSON.stringify(await storage(retry.page)), 'Resource failure and real retry preserve cosmetic and runner fixture saves');
    check(retry.profile.requestsFailed.length >= 1 && retry.profile.requestsFailed.every(item => item.url === retryUrl) && retry.profile.badHttp.length === 0, 'Retry case contains only the disclosed intentionally blocked URL and no other failures', retry.profile.requestsFailed);
  } catch (error) { report.retry.failure = error.stack; check(false, 'Resource retry flow completed', error.message); }
  finally { await retry.context.close(); }
  }
  check(report.errors.length === 0, 'No unhandled browser runtime errors', report.errors);
  report.passed = report.checks.every(item => item.passed);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  const displayed = new Set(), hiddenEndings = [];
  for (const profile of report.profiles) for (const view of profile.views) {
    if (view.stage) {
      const image = view.state.images.find(item => item.name === `delivery-landscape:${view.stage.key}`);
      if (image?.visible && image.alpha === 1) displayed.add(image.key);
    }
    for (const image of view.state.panel?.images ?? []) displayed.add(image.key);
    if (view.ending) {
      const poster = view.state.images.find(item => item.name === 'delivery-sharing-dinner' || /^delivery-ending-(invitation|umbrella|lighthouse)$/.test(item.name));
      if (poster?.visible && poster.alpha > .01) displayed.add(poster.key);
      else hiddenEndings.push({ profile: profile.label, chapter: view.state.chapter, key: poster?.key, alpha: poster?.alpha, visible: poster?.visible, reason: 'Existing ending presentation keeps generated poster hidden; dynamic scene actors are recorded in profile facts.' });
    }
  }
  report.actualDisplayedNewKeys = runtime.filter(item => displayed.has(item.key)).map(item => item.key);
  report.hiddenGeneratedEndings = hiddenEndings;
  report.summary = { passed: report.passed, profiles: report.profiles.length, checks: report.checks.length, failedChecks: report.checks.filter(item => !item.passed).length, screenshots: report.screenshots.length, assetHttpChecks: report.assets.length, actualDisplayedNewAssetKeys: report.actualDisplayedNewKeys.length, runtimeErrors: report.errors.length };
  await snapshot(); await browser.close();
}
if (!report.passed) process.exitCode = 1;
process.stdout.write(JSON.stringify(report.summary) + '\n');
