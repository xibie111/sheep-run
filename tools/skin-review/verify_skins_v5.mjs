/** Isolated real-browser acceptance. Never writes business files, dist or user profiles. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../../', import.meta.url);
const output = process.env.SKINS_V5_OUT ? pathToFileURL(resolve(process.env.SKINS_V5_OUT) + sep) : new URL('docs/skins-v5/browser/dev/', root);
const url = process.env.SKINS_V5_URL || 'http://127.0.0.1:4353/';
const phase = process.env.SKINS_V5_PHASE || 'matrix';
const canvasInstrumentation = phase === 'runtime';
const ids = ['bee-v1', 'mushroom-v1', 'chef-v1', 'pirate-v1', 'fox-v1', 'dinosaur-v1'];
const starIds = ['bee-v1', 'mushroom-v1', 'fox-v1'];
const price = { 'bee-v1': 60, 'mushroom-v1': 80, 'chef-v1': 100, 'pirate-v1': 120, 'fox-v1': 100, 'dinosaur-v1': 160 };
const names = { 'bee-v1': '蜜蜂羊', 'mushroom-v1': '蘑菇羊', 'chef-v1': '厨师羊', 'pirate-v1': '海盗羊', 'fox-v1': '狐狸羊', 'dinosaur-v1': '恐龙羊' };
const poses = ['idle_1', 'run_1', 'run_2', 'run_3', 'run_4', 'jump', 'fall', 'hit', 'dash_1', 'dead', 'idle_2', 'run_5', 'run_6', 'dash_2', 'dead_settled'];
const animations = { idle: [0, 10], run: [1, 2, 3, 4, 11, 12], jump: [5], fall: [6], hit: [7], dash: [8, 13], dead: [9, 14] };
const fixtures = (overrides = {}) => ({ version: 5, highScore: 12345, totalStars: 240, spentStars: 0, coins: 380, selectedSkin: 'white', unlockedSkins: ['white'],
  upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 }, ...overrides });
const matrixProfiles = [[480, 270], [896, 414], [844, 390], [800, 600]].flatMap(([w, h]) => [1, 2].map(d => [w, h, d]));
// JSON triples, e.g. SKINS_V5_RUNTIME_PROFILES='[[480,270,1],[896,414,2]]'.
const runtimeProfiles = process.env.SKINS_V5_RUNTIME_PROFILES ? JSON.parse(process.env.SKINS_V5_RUNTIME_PROFILES) : [[480, 270, 1], [896, 414, 2]];
assert(Array.isArray(runtimeProfiles) && runtimeProfiles.length && runtimeProfiles.every(profile => Array.isArray(profile) && profile.length === 3 && matrixProfiles.some(allowed => allowed.every((value, i) => value === profile[i]))), 'Runtime profiles must be nonempty supported [width,height,DPR] triples');
const profiles = canvasInstrumentation ? runtimeProfiles : matrixProfiles;
await mkdir(new URL('screenshots/', output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: canvasInstrumentation ? ['--disable-webgl'] : [] });
const report = { passed: false, startedAt: new Date().toISOString(), url, output: fileURLToPath(output), phase, requestedProfiles: profiles, phoneHardware: false, engine: canvasInstrumentation ? 'Edge mobile touch emulation; Canvas drawImage instrumentation' : 'Edge mobile touch emulation; normal AUTO/WebGL renderer',
  methods: { purchase: 'Fresh isolated browser contexts; actual touches on production wardrobe; read actual localStorage writes; pointercancel and repeated touches. No user profile or production save access.',
    runtime: 'Runtime phase disables browser WebGL to observe real gameCanvas drawImage crops. Named isolated fixture suppresses spawning while real touch gestures exercise unchanged physics. Freeze only to sample all 15 real rendered poses, then invoke original overlap callback to enter HIT/result/trip card. Direct pose sampling is disclosed separately from normal animation and real touches.',
    renderer: 'Matrix phase leaves production AUTO renderer unchanged and verifies WebGL/NineSlice/actual glyph ink. Browser emulation is not phone hardware verification.',
    isolation: 'No production source, dist, font, gameplay, input or persistence edits by this harness; hot reload updates from parallel editing are suppressed per context.' },
  views: [], failures: [], natural: [], checks: [], screenshots: [], runtimeErrors: [], expectedResourceMessages: [], suppressedHotReloads: [] };
const check = (condition, label) => { assert(condition, label); report.checks.push(label); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = f => `${f.width}x${f.height}/DPR${f.dpr}/${f.fixture}`;

async function frames(f, n = 2) {
  await f.page.evaluate(n => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { window.g.events.off('postrender', after); reject(Error('Render stopped')); }, 5000);
    const after = () => { if (!--n) { clearTimeout(timeout); window.g.events.off('postrender', after); resolve(); } };
    window.g.events.on('postrender', after);
  }), n);
}
async function ready(f, key) { await f.page.waitForFunction(key => window.g.scene.isActive(key) && window.g.scene.getScene(key).children.list.length, key, { timeout: 15000 }); await frames(f); }
async function attach(f) {
  await f.page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
}
async function open(width, height, dpr, fixture = 'matrix', save = fixtures()) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await context.routeWebSocket('**/*', socket => {
    const server = socket.connectToServer(); socket.onMessage(message => server.send(message));
    server.onMessage(message => { let packet; try { packet = JSON.parse(String(message)); } catch {}
      if (['update', 'full-reload', 'prune'].includes(packet?.type)) { report.suppressedHotReloads.push(packet); return; } socket.send(message); });
  });
  const page = await context.newPage(), f = { context, page, width, height, dpr, fixture, assetResponses: [] }, pendingAssets = [];
  f.cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.runtimeErrors.push({ fixture, message: error.message }));
  page.on('response', response => {
    const skin = ids.find(id => new RegExp(`/${id}-sheet(?:-[A-Za-z0-9_]+)?\\.png(?:\\?.*)?$`).test(response.url()));
    if (!skin || response.request().resourceType() === 'script' || new URL(response.url()).searchParams.has('url')) return;
    pendingAssets.push((async () => {
      const hash = createHash('sha256').update(await response.body()).digest('hex');
      const expected = report.manifest.skins.find(s => s.id === skin).runtimeHash;
      check(response.ok() && hash === expected, `${label(f)}: ${skin} actual HTTP PNG bytes match packed runtime manifest`);
      f.assetResponses.push({ skin, url: response.url(), sha256: hash, status: response.status() });
    })());
  });
  page.on('console', message => { if (fixture === 'resource-retry' && ['error', 'warning'].includes(message.type())) report.expectedResourceMessages.push(message.text()); });
  await page.addInitScript(({ save, fixture }) => {
    window.__skinSources = new WeakMap(); window.__skinDraws = []; window.__skinWrites = []; window.__blockSave = false;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const id = window.__skinSources.get(args[0]);
      if (id) { window.__skinDraws.push({ id, crop: args.slice(1), smoothing: this.imageSmoothingEnabled, surface: [this.canvas.width, this.canvas.height], gameCanvas: this.canvas === window.g?.canvas }); if (window.__skinDraws.length > 6000) window.__skinDraws.splice(0, 2000); }
      return draw.apply(this, args);
    };
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'sheep-run-save' && window.__blockSave) throw new DOMException('Isolated QA write refusal', 'QuotaExceededError');
      const result = write.call(this, key, value);
      if (key === 'sheep-run-save') { try { window.__skinWrites.push(JSON.parse(value)); } catch { window.__skinWrites.push({ invalidRaw: value }); } }
      return result;
    };
    if (localStorage.getItem('sheep-run-save') === null) localStorage.setItem('sheep-run-save', typeof save === 'string' ? save : JSON.stringify(save));
    if (fixture === 'migration-save-failure') window.__blockSave = true;
  }, { save, fixture });
  const main = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' }); f.main = (await main).url(); await attach(f);
  await ready(f, 'MenuScene'); check(await page.locator('[data-menu-art]').count() === 1, `${label(f)}: one game and one menu surface`);
  await Promise.all(pendingAssets); check(f.assetResponses.length === 6, `${label(f)}: all six actual new PNG responses verified`);
  return f;
}
async function target(f, key, name, optional = false) {
  return f.page.evaluate(({ key, name, optional }) => {
    const scene = window.g.scene.getScene(key), find = list => { for (const o of list) { if (o.name === name) return o; const child = o.list && find(o.list); if (child) return child; } };
    const o = find(scene.children.list); if (!o) { if (optional) return null; throw new Error(`Missing ${key}/${name}`); }
    const b = o.getBounds(), canvas = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: canvas.x + (b.centerX - scene.cameras.main.scrollX * o.scrollFactorX) * canvas.width / size.width,
      y: canvas.y + (b.centerY - scene.cameras.main.scrollY * o.scrollFactorY) * canvas.height / size.height,
      disabled: o.getData('disabled') === true, enabled: !!o.input?.enabled, state: o.getData('state'), currency: o.getData('currency'), price: o.getData('price'), unlockType: o.getData('unlockType') };
  }, { key, name, optional });
}
async function tap(f, key, name) { const p = await target(f, key, name); await f.page.touchscreen.tap(p.x, p.y); await frames(f); }
async function cancel(f, key, name) { const p = await target(f, key, name); await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] }); await frames(f); await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await frames(f); }
async function gesture(f, kind) {
  const p = await f.page.evaluate(() => { const r = window.g.canvas.getBoundingClientRect(); return { x: r.x + r.width * .68, y: r.y + r.height * .5, unit: r.width / window.g.scale.gameSize.width }; });
  if (kind === 'tap') { await f.page.touchscreen.tap(p.x, p.y); return; }
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + (kind === 'up' ? -46 : 46) * p.unit }] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function shot(f, name) { await frames(f); const path = `screenshots/${f.width}x${f.height}-dpr${f.dpr}-${f.fixture}-${name}.png`; await f.page.screenshot({ path: fileURLToPath(new URL(path, output)), scale: 'css' }); report.screenshots.push(path); }
const save = f => f.page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-save')));
const rawSave = f => f.page.evaluate(() => localStorage.getItem('sheep-run-save'));
async function seed(f, value) { await f.page.evaluate(value => { localStorage.setItem('sheep-run-save', typeof value === 'string' ? value : JSON.stringify(value)); window.__skinWrites = []; window.g.scene.stop('PauseScene'); window.g.scene.stop('RunScene'); window.g.scene.stop('ResultScene'); window.g.scene.stop('WardrobeScene'); window.g.scene.start('MenuScene'); }, value); await ready(f, 'MenuScene'); }
async function wardrobe(f) { await tap(f, 'MenuScene', 'button:衣橱'); await ready(f, 'WardrobeScene'); }
async function select(f, id) { for (let n = 0; !await target(f, 'WardrobeScene', `skin-card:${id}`, true); n++) { check(n < 12, `${label(f)}: skin ${id} reachable through dynamic pages`); await tap(f, 'WardrobeScene', 'button:page-next'); } await tap(f, 'WardrobeScene', `skin-card:${id}`); }
async function auditUi(f, name) {
  const result = await f.page.evaluate(() => {
    const scene = window.g.scene.getScene('WardrobeScene'), size = window.g.scale.gameSize, texts = [], missing = [], clipped = [], cards = [], balanceIcons = [];
    const walk = list => list.forEach(o => { if (o.type === 'BitmapText') { const chars = scene.cache.bitmapFont.get(o.font).data.chars, b = o.getBounds(); texts.push(o.text);
      for (const c of o.text) if (c !== '\n' && !chars[c.codePointAt(0)]) missing.push(c);
      if (b.x < -.5 || b.y < -.5 || b.right > size.width + .5 || b.bottom > size.height + .5) clipped.push(o.text); }
      if (o.texture && ['ui-icon-star', 'ui-icon-coin'].includes(o.texture.key) && o.getBounds().centerY < 55) balanceIcons.push(o.texture.key);
      if (o.name?.startsWith('skin-card:')) cards.push({ id: o.name.slice(10), currency: o.getData('currency'), price: o.getData('price'), unlockType: o.getData('unlockType'), bounds: { x: o.getBounds().x, y: o.getBounds().y, width: o.getBounds().width, height: o.getBounds().height } }); if (o.list) walk(o.list); }); walk(scene.children.list);
    const saved = JSON.parse(localStorage.getItem('sheep-run-save'));
    return { renderer: window.g.renderer.type, texts, missing, clipped, cards, balanceIcons, expectedStars: saved.totalStars - saved.spentStars, expectedCoins: saved.coins, stars: scene.starsText.text, coins: scene.coinsText.text, feedback: scene.message, selectedId: scene.selectedId, canvasRendering: getComputedStyle(window.g.canvas).imageRendering, dpr: window.devicePixelRatio, gameSize: { width: size.width, height: size.height } };
  });
  check(!result.missing.length && !result.clipped.length, `${label(f)}/${name}: all actual text glyphs exist and stay in viewport: ${JSON.stringify({ missing: result.missing, clipped: result.clipped })}`);
  check(result.balanceIcons.includes('ui-icon-star') && result.balanceIcons.includes('ui-icon-coin') && Number(result.stars) === result.expectedStars && Number(result.coins) === result.expectedCoins, `${label(f)}/${name}: actual star/coin badges identify currencies and display persisted balances`);
  check(result.renderer === (canvasInstrumentation ? 1 : 2), `${label(f)}/${name}: expected actual Canvas/WebGL renderer`);
  check(result.canvasRendering === 'pixelated', `${label(f)}/${name}: canvas uses pixelated rendering`);
  return result;
}
async function assets(f) {
  const result = await f.page.evaluate(async ({ ids, poses }) => {
    const out = [], digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v => v.toString(16).padStart(2, '0')).join('');
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 112; const ctx = canvas.getContext('2d', { willReadFrequently: true });
    for (const id of ids) { const key = `sheep-runner-${id}`, texture = window.g.textures.get(key); if (!window.g.textures.exists(key)) throw Error(`Missing loaded skin ${id}`);
      window.__skinSources.set(texture.source[0].image, id); const frames = [];
      for (let i = 0; i < 15; i++) { const frame = texture.get(i); ctx.clearRect(0, 0, 128, 112); ctx.drawImage(texture.source[0].image, frame.cutX, frame.cutY, 128, 112, 0, 0, 128, 112);
        const pixels = ctx.getImageData(0, 0, 128, 112).data, alpha = new Set(); let left = 128, top = 112, right = 0, bottom = 0;
        for (let y = 0; y < 112; y++) for (let x = 0; x < 128; x++) { const a = pixels[(y * 128 + x) * 4 + 3]; alpha.add(a); if (a) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); } }
        frames.push({ pose: poses[i], width: frame.width, height: frame.height, crop: [frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight], bbox: [left, top, right, bottom], alpha: [...alpha], hash: await digest(pixels) }); }
      const states = Object.fromEntries(['idle', 'run', 'jump', 'fall', 'hit', 'dash', 'dead'].map(state => [state, window.g.anims.get(`sheep-${id}-${state}`).frames.map(frame => Number(frame.textureFrame))]));
      out.push({ id, key, size: [texture.source[0].width, texture.source[0].height], filter: texture.source[0].scaleMode, states, frames }); }
    return out;
  }, { ids, poses });
  for (const art of result) {
    check(art.size[0] === 640 && art.size[1] === 384 && art.frames.length === 15, `${label(f)}: ${art.id} actual loaded 640x384/15-frame atlas`);
    assert.deepEqual(art.states, animations); check(art.filter === 1, `${label(f)}: ${art.id} Phaser NEAREST(1) texture filter`);
    for (const [i, frame] of art.frames.entries()) { check(frame.width === 128 && frame.height === 112 && frame.crop[0] === i % 5 * 128 && frame.crop[1] === Math.floor(i / 5) * 128 + 16, `${label(f)}: ${art.id}/${poses[i]} uses exact cropped transport slot`);
      check(frame.alpha.every(v => v === 0 || v === 255) && frame.alpha.includes(255) && frame.alpha.includes(0), `${label(f)}: ${art.id}/${poses[i]} has real nonempty hard-alpha art`);
      check(frame.bbox[3] >= (i === 5 ? 102 : 110) && frame.bbox[3] <= (i === 5 ? 104 : 112), `${label(f)}: ${art.id}/${poses[i]} baseline retained`); }
    check(new Set(art.frames.map(frame => frame.hash)).size === 15, `${label(f)}: ${art.id} all fifteen loaded visible frames are distinct`);
    check(new Set([1, 2, 3, 4, 11, 12].map(i => art.frames[i].hash)).size === 6, `${label(f)}: ${art.id} six genuinely distinct running poses`);
    check(art.frames[5].hash !== art.frames[0].hash && art.frames[7].hash !== art.frames[0].hash && art.frames[9].hash !== art.frames[0].hash && art.frames[14].hash !== art.frames[9].hash, `${label(f)}: ${art.id} jump/hit/dead/settled are different drawings`);
  }
  return result;
}
async function purchaseMatrix(f) {
  const view = { width: f.width, height: f.height, dpr: f.dpr, main: f.main, assetResponses: f.assetResponses, assets: await assets(f), pages: [], purchases: [], runtime: [] }; report.views.push(view);
  await wardrobe(f); const catalog = await f.page.evaluate(() => {
    const scene = window.g.scene.getScene('WardrobeScene'); return scene.children.list.length;
  }); check(catalog > 0, `${label(f)}: real wardrobe scene populated`);
  const catalogSource = await readFile(new URL('src/data/sheepSkins.ts', root), 'utf8'); const count = [...catalogSource.matchAll(/\{ id: ["']([^"']+)["'], label:/g)].length, pageCount = Math.ceil(count / 5);
  for (let n = 0; n < pageCount; n++) { const ui = await auditUi(f, `page-${n + 1}`); view.pages.push(ui); check(ui.cards.length === Math.min(5, count - n * 5), `${label(f)}: dynamically populated page ${n + 1}/${pageCount}`); await shot(f, `wardrobe-page-${n + 1}`); await tap(f, 'WardrobeScene', 'button:page-next'); }
  check((await auditUi(f, 'page-wrap')).cards[0].id === 'white', `${label(f)}: next-page wrap preserves all original pages`);
  for (const [index, id] of ids.entries()) {
    await select(f, id); const card = await target(f, 'WardrobeScene', `skin-card:${id}`), before = await save(f);
    check(card.currency === (starIds.includes(id) ? 'star' : 'coin') && card.price === price[id] && card.unlockType === (starIds.includes(id) ? 'star-purchase' : 'coins'), `${label(f)}: ${id} shows its one approved currency and exact price`);
    const ui = await auditUi(f, id); ui.ink = await inkAudit(f); check(ui.texts.includes(names[id]), `${label(f)}: ${id} real Chinese name is drawn`);
    const oldRaw = await rawSave(f); await cancel(f, 'WardrobeScene', 'button:购买'); check(await rawSave(f) === oldRaw, `${label(f)}: ${id} pointercancel never purchases`);
    await tap(f, 'WardrobeScene', 'button:购买'); const bought = await save(f);
    check(bought.unlockedSkins.includes(id) && bought.totalStars === before.totalStars && bought.spentStars === before.spentStars + (starIds.includes(id) ? price[id] : 0) && bought.coins === before.coins - (starIds.includes(id) ? 0 : price[id]), `${label(f)}: ${id} real atomic payment/unlock with cumulative stars preserved`);
    check(bought.selectedSkin === before.selectedSkin, `${label(f)}: ${id} purchase does not auto-equip`);
    check((await target(f, 'WardrobeScene', 'button:装备')).enabled, `${label(f)}: ${id} becomes equipable`);
    await tap(f, 'WardrobeScene', 'button:装备');
    // Repeated real touches hit the now-equipped disabled button region.
    const point = await target(f, 'WardrobeScene', 'button:已装备'); for (let n = 0; n < 4; n++) await f.page.touchscreen.tap(point.x, point.y); await frames(f);
    const equipped = await save(f); check(equipped.selectedSkin === id && equipped.spentStars === bought.spentStars && equipped.coins === bought.coins && equipped.unlockedSkins.filter(s => s === id).length === 1, `${label(f)}: ${id} rapid repeat touches cannot double-pay`);
    await shot(f, `wardrobe-${id}`); view.purchases.push({ id, price: price[id], before, bought, equipped });
  }
  const end = await save(f); check(end.totalStars === 240 && end.spentStars === 240 && end.coins === 0, `${label(f)}: all exact approved prices exhaust available currencies only`);
  await f.page.reload({ waitUntil: 'domcontentloaded' }); await attach(f); await ready(f, 'MenuScene');
  check(JSON.stringify(await save(f)) === JSON.stringify(end), `${label(f)}: fresh page retains balances, unlocks and equipment`); await assets(f); await wardrobe(f);
  for (const id of ids) { await select(f, id); if ((await save(f)).selectedSkin !== id) { check((await target(f, 'WardrobeScene', 'button:装备')).enabled, `${label(f)}: owned ${id} equips after all balances reach zero`); await tap(f, 'WardrobeScene', 'button:装备'); } }
  return view;
}
async function runFacts(f) { return f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'), p = s.sheep, b = p.body; return { key: p.texture.key, frame: Number(p.frame.name), state: p.motionState, grounded: p.grounded, y: p.y, width: p.displayWidth, height: p.displayHeight, scaleX: p.scaleX, scaleY: p.scaleY, body: { width: b.width, height: b.height, bottom: b.bottom, velocityY: b.velocity.y }, clock: s.activeRunTimeMs, finished: s.finished }; }); }
async function runtimeSkin(f, id) {
  await select(f, id); if ((await save(f)).selectedSkin !== id) await tap(f, 'WardrobeScene', 'button:装备'); await tap(f, 'WardrobeScene', 'button:返回'); await ready(f, 'MenuScene'); const menu = await menuAudit(f, id); if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-menu-with-saved-equipment`); await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene');
  await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.spawnSystem.update = () => []; for (const o of [...s.obstacles.getChildren(), ...s.stars.getChildren(), ...s.powerUps.getChildren()]) o.deactivate(); });
  const standing = await runFacts(f);
  standing.footprint = await f.page.evaluate(() => {
    const p = window.g.scene.getScene('RunScene').sheep, frame = p.frame, canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 112;
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(frame.source.image, frame.cutX, frame.cutY, 128, 112, 0, 0, 128, 112);
    const data = c.getImageData(0, 0, 128, 112).data; let bottom = 0; for (let y = 0; y < 112; y++) for (let x = 0; x < 128; x++) if (data[(y * 128 + x) * 4 + 3]) bottom = Math.max(bottom, y + 1);
    return { inkBottom: bottom, visibleFeet: p.y - p.displayHeight + bottom * p.scaleY, bodyBottom: p.body.bottom };
  });
  check(Math.abs(standing.footprint.visibleFeet - 218) < .1 && Math.abs(standing.footprint.bodyBottom - 218) < .1, `${label(f)}: ${id} actual drawn feet and unchanged body meet world ground`);
  const runFrames = await f.page.evaluate(() => new Promise((resolve, reject) => {
    const found = new Set(), timeout = setTimeout(() => { window.g.events.off('postrender', sample); reject(new Error('Six-frame run loop not observed')); }, 5000);
    const sample = () => { const p = window.g.scene.getScene('RunScene').sheep; if (p.motionState === 'RUNNING') found.add(Number(p.frame.name)); if (found.size === 6) { clearTimeout(timeout); window.g.events.off('postrender', sample); resolve([...found].sort((a, b) => a - b)); } };
    window.g.events.on('postrender', sample);
  }));
  check(JSON.stringify(runFrames) === JSON.stringify([1, 2, 3, 4, 11, 12]), `${label(f)}: ${id} actual six-frame running animation observed`); check(standing.key === `sheep-runner-${id}` && standing.width === 48 && standing.height === 42 && standing.body.width === 30 && standing.body.height === 30 && Math.abs(standing.body.bottom - 218) < .1 && Math.abs(standing.scaleX - standing.scaleY) < .00001, `${label(f)}: ${id} real running sprite keeps original display and collision geometry`);
  await shot(f, `${id}-running`);
  await gesture(f, 'tap'); await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'JUMPING' && p.body.velocity.y < 0 && Number(p.frame.name) === 5; }, null, { timeout: 2000 }); const normal = await runFacts(f); if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-normal-jump`);
  await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'FALLING' && p.body.velocity.y > 0 && Number(p.frame.name) === 6; }, null, { timeout: 2000 }); const falling = await runFacts(f); if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-real-fall`);
  await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').sheep.grounded, null, { timeout: 3000 });
  await gesture(f, 'up'); await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'JUMPING' && p.body.velocity.y < 0 && Number(p.frame.name) === 5; }, null, { timeout: 2000 }); const high = await runFacts(f);
  check(normal.frame === 5 && high.frame === 5 && high.body.velocityY < normal.body.velocityY - 20, `${label(f)}: ${id} real normal/high gestures use proper animation and distinct unchanged impulses`);
  if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-high-jump`); await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').sheep.grounded, null, { timeout: 3000 });
  await gesture(f, 'down'); await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').sheep.displayHeight === 30, null, { timeout: 2000 }); const crouch = await runFacts(f); check(crouch.width === 48 && crouch.body.width === 30 && crouch.body.height === 18 && Math.abs(crouch.body.bottom - 218) < .1, `${label(f)}: ${id} real crouch gesture keeps original body/baseline`);
  if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-crouching`); await f.page.waitForFunction(() => window.g.scene.getScene('RunScene').sheep.displayHeight === 42, null, { timeout: 2000 });
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); const paused = await runFacts(f); await wait(120); check((await runFacts(f)).clock === paused.clock, `${label(f)}: ${id} actual pause freezes effective clock`); await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene');
  await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.physics.pause(); s.events.off('preupdate', s.onPreUpdate, s); s.sys.sceneUpdate = () => {}; s.sys.updateList.remove(s.sheep); s.sheep.anims.stop(); window.__skinDraws = []; });
  // UpdateList removals flush on the next frame; stop again after that flush.
  await frames(f); await f.page.evaluate(() => window.g.scene.getScene('RunScene').sheep.anims.stop());
  const drawn = [];
  for (let i = 0; i < 15; i++) {
    await f.page.evaluate(i => { window.__skinDraws = []; window.g.scene.getScene('RunScene').sheep.setFrame(i); }, i); await frames(f);
    drawn.push(...await f.page.evaluate(id => window.__skinDraws.filter(d => d.id === id && d.gameCanvas).slice(-4), id));
    if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-pose-${i}-${poses[i]}`);
  }
  const crops = new Set(drawn.filter(d => d.crop.length === 8).map(d => d.crop.slice(0, 4).join(',')));
  report.poseDrawAudit ??= []; report.poseDrawAudit.push({ id, profile: label(f), crops: [...crops], draws: drawn.slice(0, 40) });
  check(Array.from({ length: 15 }, (_, i) => `${i % 5 * 128},${Math.floor(i / 5) * 128 + 16},128,112`).every(c => crops.has(c)), `${label(f)}: ${id} all 15 actual runtime PNG crops were rendered by game`);
  check(drawn.every(d => !d.smoothing), `${label(f)}: ${id} every actual game draw uses nearest-neighbor`);
  await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.sheep.setFrame(1); s.sys.updateList.add(s.sheep); s.physics.resume(); s.sys.sceneUpdate = Object.getPrototypeOf(s).update; s.events.on('preupdate', s.onPreUpdate, s); s.onObstacleOverlap(); });
  await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p?.motionState === 'HIT' && Number(p.frame.name) === 7; }, null, { timeout: 1500 }); const hit = await runFacts(f); if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-actual-hit`);
  await ready(f, 'ResultScene'); check(await f.page.evaluate(id => window.g.scene.getScene('ResultScene').result.leadSkin === id, id), `${label(f)}: ${id} actual result carries this run's equipped skin`);
  await tap(f, 'ResultScene', 'button:查看这次旅行'); const trip = await f.page.locator('[data-content-v2-overlay="trip-card"]').evaluate(c => ({ ...c.dataset, width: c.width, cssWidth: parseFloat(c.style.width), smoothing: c.getContext('2d').imageSmoothingEnabled }));
  check(JSON.parse(trip.model).protagonist.id === id && trip.portraitVisible === 'true' && !trip.smoothing && trip.width === Math.round(trip.cssWidth * f.dpr), `${label(f)}: ${id} actual travel card displays its exact pixel portrait at DPR`);
  if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-trip-card`); await cancel(f, 'ResultScene', 'button:收好旅行卡'); check(await f.page.evaluate(() => window.g.scene.getScene('ResultScene').data.get('content-v2-trip-open')), `${label(f)}: cancelled trip close keeps modal open`);
  await tap(f, 'ResultScene', 'button:收好旅行卡'); await tap(f, 'ResultScene', 'button:返回牧场'); await ready(f, 'MenuScene'); await wardrobe(f);
  return { id, menu, standing, runFrames, normal, falling, high, crouch, hit, drawnCrops: [...crops], trip: JSON.parse(trip.model) };
}

async function menuAudit(f, id) {
  const data = await f.page.evaluate(() => {
    const p = window.g.scene.getScene('MenuScene').children.getByName('menu-sheep');
    return { key: p.texture.key, frame: Number(p.frame.name), visible: p.visible, width: p.displayWidth, height: p.displayHeight, filter: p.texture.source[0].scaleMode, selectedSkin: JSON.parse(localStorage.getItem('sheep-run-save')).selectedSkin };
  });
  check(data.key === 'sheep-runner' && data.selectedSkin === id && data.visible && data.width === 72 && data.height === 63 && data.filter === 1, `${label(f)}: ${id} equipment persists while original white menu mascot retains its existing appearance`);
  return data;
}

async function webglRun(f, id) {
  await select(f, id); if ((await save(f)).selectedSkin !== id) await tap(f, 'WardrobeScene', 'button:装备');
  await tap(f, 'WardrobeScene', 'button:返回'); await ready(f, 'MenuScene'); const menu = await menuAudit(f, id);
  if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-menu-with-saved-equipment`);
  await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene'); const running = await runFacts(f);
  check(running.key === `sheep-runner-${id}` && running.width === 48 && running.height === 42 && running.body.width === 30 && running.body.height === 30 && Math.abs(running.body.bottom - 218) < .1, `${label(f)}: ${id} actual unmodified WebGL run uses equipped skin and fixed body`);
  await shot(f, `${id}-webgl-running`); await gesture(f, 'tap');
  await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'JUMPING' && p.body.velocity.y < 0 && Number(p.frame.name) === 5; }, null, { timeout: 2000 }); const jump = await runFacts(f);
  if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-webgl-touch-jump`);
  await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'FALLING' && p.body.velocity.y > 0 && Number(p.frame.name) === 6; }, null, { timeout: 2000 }); const fall = await runFacts(f);
  check(jump.frame === 5 && fall.frame === 6, `${label(f)}: ${id} actual unmodified WebGL jump/fall states follow real touch`);
  await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene'); await wardrobe(f);
  return { id, menu, running, jump, fall, fixtureMutations: false };
}

async function inkAudit(f) {
  const data = await f.page.evaluate(() => {
    const scene = window.g.scene.getScene('WardrobeScene'), size = window.g.scale.gameSize, rows = [], nineSlices = [];
    const bounds = b => ({ x: b.x, y: b.y, right: b.right, bottom: b.bottom });
    const walk = list => { for (const o of list) {
      if (o.type === 'NineSlice') nineSlices.push({ texture: o.texture.key, visible: o.visible, active: o.active });
      if (o.type === 'BitmapText' && o.text) {
        o.getTextBounds(); const font = scene.cache.bitmapFont.get(o.font).data, matrix = o.getWorldTransformMatrix(), ratio = o.fontSize / font.size, points = [], missing = [];
        let advance = 0, line = 0;
        for (const character of o.text) {
          if (character === '\n') { advance = 0; line += font.lineHeight; continue; }
          const glyph = font.chars[character.codePointAt(0)]; if (!glyph) { missing.push(character); continue; }
          if (glyph.width && glyph.height) {
            const left = (advance + glyph.xOffset) * ratio - o.displayOriginX, top = (line + glyph.yOffset) * ratio - o.displayOriginY;
            for (const [x, y] of [[left, top], [left + glyph.width * ratio, top], [left, top + glyph.height * ratio], [left + glyph.width * ratio, top + glyph.height * ratio]]) points.push({ x: matrix.a * x + matrix.c * y + matrix.tx, y: matrix.b * x + matrix.d * y + matrix.ty });
          }
          advance += glyph.xAdvance + o.letterSpacing;
        }
        const ink = { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
        let parent = o.parentContainer; while (parent && !parent.name?.startsWith('skin-card:') && !parent.name?.startsWith('button:')) parent = parent.parentContainer;
        rows.push({ name: o.name, text: o.text, missing, ink, parent: parent ? { name: parent.name, bounds: bounds(parent.list[0].getBounds()) } : null });
      }
      if (o.list) walk(o.list);
    } }; walk(scene.children.list);
    return { rows, nineSlices, size: { width: size.width, height: size.height } };
  });
  if (!canvasInstrumentation) check(data.nineSlices.length >= 7 && data.nineSlices.every(o => o.visible && o.active), `${label(f)}: actual WebGL wooden panels remain active`);
  for (const row of data.rows) {
    check(!row.missing.length && row.ink.x >= -.5 && row.ink.y >= -.5 && row.ink.right <= data.size.width + .5 && row.ink.bottom <= data.size.height + .5, `${label(f)}: actual glyph ink stays visible: ${row.text}`);
    if (row.parent) { const b = row.parent.bounds; check(row.ink.x >= b.x - .5 && row.ink.y >= b.y - .5 && row.ink.right <= b.right + .5 && row.ink.bottom <= b.bottom + .5, `${label(f)}: actual ${row.text} ink fits ${row.parent.name}`); }
  }
  return data;
}

try {
  const manifestBytes = await readFile(new URL('assets/skins/runtime-v5/manifest.json', root));
  report.manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.deepEqual(report.manifest.skins.map(s => s.id), ids);
  report.sourceProvenance = { runtimeManifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), catalogSha256: createHash('sha256').update(await readFile(new URL('src/data/sheepSkins.ts', root))).digest('hex'), skinAssetsSha256: createHash('sha256').update(await readFile(new URL('src/data/skinSpriteAssets.ts', root))).digest('hex') };
  const prior = JSON.parse(await readFile(new URL('docs/skins-v5/old-skin-hashes-before.json', root), 'utf8'));
  report.oldAssets = { count: Object.keys(prior.files).length, unchanged: true };
  for (const [path, expected] of Object.entries(prior.files)) check(createHash('sha256').update(await readFile(new URL(path, root))).digest('hex') === expected, `Original skin asset SHA256 unchanged: ${path}`);
  for (const [width, height, dpr] of profiles) {
    const f = await open(width, height, dpr, phase, canvasInstrumentation ? fixtures({ unlockedSkins: ['white', ...ids], spentStars: 240, coins: 0 }) : fixtures());
    const view = canvasInstrumentation ? { width, height, dpr, main: f.main, assetResponses: f.assetResponses, assets: await assets(f), purchases: [], runtime: [] } : await purchaseMatrix(f);
    if (canvasInstrumentation) { report.views.push(view); await wardrobe(f); for (const id of ids) view.runtime.push(await runtimeSkin(f, id)); }
    else for (const id of ids) view.runtime.push(await webglRun(f, id));
    view.canvas = await f.page.evaluate(() => {
      const r = window.g.canvas.getBoundingClientRect(), s = window.g.scale.gameSize;
      return { x: r.x, y: r.y, width: r.width, height: r.height, gameWidth: s.width, gameHeight: s.height, pixels: [window.g.canvas.width, window.g.canvas.height], scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
    });
    check(view.canvas.x <= .01 && view.canvas.y <= .01 && view.canvas.x + view.canvas.width >= width - .01 && view.canvas.y + view.canvas.height >= height - .01 && view.canvas.scroll[0] === width && view.canvas.scroll[1] === height, `${label(f)}: actual canvas fills profile without page scrolling`);
    check(Math.abs(view.canvas.width / view.canvas.gameWidth - view.canvas.height / view.canvas.gameHeight) < .001, `${label(f)}: uniform canvas scale preserves square pixels`);
    await f.context.close(); process.stdout.write(JSON.stringify({ profile: `${width}x${height}/DPR${dpr}`, phase, purchases: view.purchases.length, actualSkins: view.runtime.length, checks: report.checks.length }) + '\n');
    await writeFile(new URL(`browser-review-${phase}.json`, output), JSON.stringify(report, null, 2));
  }
  check(report.runtimeErrors.length === 0, 'No actual runtime exceptions in this browser phase'); report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: fileURLToPath(new URL(`screenshots/failure-${phase}.png`, output)), scale: 'css' }).catch(() => {});
  process.exitCode = 1;
} finally { report.finishedAt = new Date().toISOString(); await writeFile(new URL(`browser-review-${phase}.json`, output), JSON.stringify(report, null, 2)); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, phase, profiles: report.views.length, checks: report.checks.length, screenshots: report.screenshots.length, failure: report.failure?.split('\n')[0], phoneHardware: false }) + '\n');
