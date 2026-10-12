/** Isolated real-browser acceptance. Never writes business files, dist or user profiles. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../../', import.meta.url);
const output = new URL('docs/skins-v4/browser/', root);
const url = process.env.SKIN_V4_REVIEW_URL || 'http://127.0.0.1:4341/';
const phase = process.env.SKIN_V4_REVIEW_PHASE || 'all';
const ids = ['strawberry-v1', 'lemon-v1', 'sailor-v1', 'starlight-v1', 'postman-v1', 'raincoat-v1', 'explorer-v1', 'astronaut-v1'];
const price = { 'strawberry-v1': 40, 'lemon-v1': 70, 'sailor-v1': 100, 'starlight-v1': 150, 'postman-v1': 60, 'raincoat-v1': 90, 'explorer-v1': 120, 'astronaut-v1': 160 };
const names = { 'strawberry-v1': '草莓羊', 'lemon-v1': '柠檬羊', 'sailor-v1': '水手羊', 'starlight-v1': '星灯羊', 'postman-v1': '邮差羊', 'raincoat-v1': '雨衣羊', 'explorer-v1': '探险羊', 'astronaut-v1': '航天羊' };
const poses = ['idle_1', 'run_1', 'run_2', 'run_3', 'run_4', 'jump', 'fall', 'hit', 'dash_1', 'dead', 'idle_2', 'run_5', 'run_6', 'dash_2', 'dead_settled'];
const animations = { idle: [0, 10], run: [1, 2, 3, 4, 11, 12], jump: [5], fall: [6], hit: [7], dash: [8, 13], dead: [9, 14] };
const fixtures = (overrides = {}) => ({ version: 5, highScore: 12345, totalStars: 360, spentStars: 0, coins: 430, selectedSkin: 'white', unlockedSkins: ['white'],
  upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 }, ...overrides });
const profiles = [[480, 270], [896, 414], [844, 390], [800, 600]].flatMap(([w, h]) => [1, 2].map(d => [w, h, d]));
await mkdir(new URL('screenshots/', output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--disable-webgl'] });
const report = { passed: false, url, phase, phoneHardware: false, engine: 'Edge Chromium mobile touch emulation; Phaser Canvas renderer',
  methods: { purchase: 'Isolated localStorage contexts, real touch on the production wardrobe, no player browser profile. Actual current-version writes are observed; v4 migration, write refusal and corrupt/future fixtures are separated.',
    runtime: 'Production skin textures and animation frames in RunScene. Real tap/swipe gestures use unchanged physics. In these named isolated fixtures only, spawning is suppressed to allow repeatable pose screenshots, then scene/input/physics are frozen for 15 real PNG crops. Companion safe-gap and elapsed-time fixture uses its real bell collection/controller. Actual hit callback produces the real result/travel card.',
    natural: 'Additional unmodified runs use only actual touchscreen taps/swipes chosen from read-only obstacle observations. No score, physics, random seed, spawn, immunity, scheduler, clock or collision mutation.',
    renderer: 'WebGL is disabled only in the acceptance browser to inspect actual canvas drawImage crops and nearest-neighbor filtering. This is browser emulation, not hardware/GPU or phone proof.' },
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
  const page = await context.newPage(), f = { context, page, width, height, dpr, fixture, blockAsset: fixture === 'resource-retry', blockedUrls: [] };
  f.cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.runtimeErrors.push({ fixture, message: error.message }));
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
  if (f.blockAsset) await page.route(/\/[^/]*lemon-v1-sheet(?:-[a-zA-Z0-9_]+)?\.png(?:\?.*)?$/, async route => {
    if (route.request().resourceType() === 'script' || new URL(route.request().url()).searchParams.has('url')) { await route.continue(); return; }
    if (f.blockAsset) { f.blockedUrls.push(route.request().url()); await route.abort('failed'); } else await route.continue();
  });
  const main = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' }); f.main = (await main).url(); await attach(f);
  if (f.blockAsset) await page.waitForFunction(() => window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'), null, { timeout: 15000 });
  else { await ready(f, 'MenuScene'); check(await page.locator('[data-menu-art]').count() === 1, `${label(f)}: one game and one menu surface`); }
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
    const scene = window.g.scene.getScene('WardrobeScene'), size = window.g.scale.gameSize, texts = [], missing = [], clipped = [], cards = [];
    const walk = list => list.forEach(o => { if (o.type === 'BitmapText') { const chars = scene.cache.bitmapFont.get(o.font).data.chars, b = o.getBounds(); texts.push(o.text);
      for (const c of o.text) if (c !== '\n' && !chars[c.codePointAt(0)]) missing.push(c);
      if (b.x < -.5 || b.y < -.5 || b.right > size.width + .5 || b.bottom > size.height + .5) clipped.push(o.text); }
      if (o.name?.startsWith('skin-card:')) cards.push({ id: o.name.slice(10), currency: o.getData('currency'), price: o.getData('price'), unlockType: o.getData('unlockType'), bounds: { x: o.getBounds().x, y: o.getBounds().y, width: o.getBounds().width, height: o.getBounds().height } }); if (o.list) walk(o.list); }); walk(scene.children.list);
    return { texts, missing, clipped, cards, stars: scene.starsText.text, coins: scene.coinsText.text, feedback: scene.message, selectedId: scene.selectedId, canvasRendering: getComputedStyle(window.g.canvas).imageRendering, dpr: window.devicePixelRatio, gameSize: { width: size.width, height: size.height } };
  });
  check(!result.missing.length && !result.clipped.length, `${label(f)}/${name}: all actual text glyphs exist and stay in viewport: ${JSON.stringify({ missing: result.missing, clipped: result.clipped })}`);
  check(result.texts.includes('可用星星') && result.texts.includes('金币'), `${label(f)}/${name}: both real balances have explicit currency labels`);
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
    check(new Set([1, 2, 3, 4, 11, 12].map(i => art.frames[i].hash)).size === 6, `${label(f)}: ${art.id} six genuinely distinct running poses`);
    check(art.frames[5].hash !== art.frames[0].hash && art.frames[7].hash !== art.frames[0].hash && art.frames[9].hash !== art.frames[0].hash && art.frames[14].hash !== art.frames[9].hash, `${label(f)}: ${art.id} jump/hit/dead/settled are different drawings`);
  }
  return result;
}
async function purchaseMatrix(f) {
  const view = { width: f.width, height: f.height, dpr: f.dpr, main: f.main, assets: await assets(f), pages: [], purchases: [], runtime: [] }; report.views.push(view);
  await wardrobe(f); const catalog = await f.page.evaluate(() => {
    const scene = window.g.scene.getScene('WardrobeScene'); return scene.children.list.length;
  }); check(catalog > 0, `${label(f)}: real wardrobe scene populated`);
  const catalogSource = await readFile(new URL('src/data/sheepSkins.ts', root), 'utf8'); const count = [...catalogSource.matchAll(/\{ id: ["']([^"']+)["'], label:/g)].length, pageCount = Math.ceil(count / 5);
  for (let n = 0; n < pageCount; n++) { const ui = await auditUi(f, `page-${n + 1}`); view.pages.push(ui); check(ui.cards.length === Math.min(5, count - n * 5), `${label(f)}: dynamically populated page ${n + 1}/${pageCount}`); await shot(f, `wardrobe-page-${n + 1}`); await tap(f, 'WardrobeScene', 'button:page-next'); }
  check((await auditUi(f, 'page-wrap')).cards[0].id === 'white', `${label(f)}: next-page wrap preserves all original pages`);
  for (const [index, id] of ids.entries()) {
    await select(f, id); const card = await target(f, 'WardrobeScene', `skin-card:${id}`), before = await save(f);
    check(card.currency === (index < 4 ? 'star' : 'coin') && card.price === price[id] && card.unlockType === (index < 4 ? 'star-purchase' : 'coins'), `${label(f)}: ${id} shows its one approved currency and exact price`);
    const ui = await auditUi(f, id); check(ui.texts.includes(names[id]), `${label(f)}: ${id} real Chinese name is drawn`);
    const oldRaw = await rawSave(f); await cancel(f, 'WardrobeScene', 'button:购买'); check(await rawSave(f) === oldRaw, `${label(f)}: ${id} pointercancel never purchases`);
    await tap(f, 'WardrobeScene', 'button:购买'); const bought = await save(f);
    check(bought.unlockedSkins.includes(id) && bought.totalStars === before.totalStars && bought.spentStars === before.spentStars + (index < 4 ? price[id] : 0) && bought.coins === before.coins - (index < 4 ? 0 : price[id]), `${label(f)}: ${id} real atomic payment/unlock with cumulative stars preserved`);
    check(bought.selectedSkin === before.selectedSkin, `${label(f)}: ${id} purchase does not auto-equip`);
    check((await target(f, 'WardrobeScene', 'button:装备')).enabled, `${label(f)}: ${id} becomes equipable`);
    await tap(f, 'WardrobeScene', 'button:装备');
    // Repeated real touches hit the now-equipped disabled button region.
    const point = await target(f, 'WardrobeScene', 'button:已装备'); for (let n = 0; n < 4; n++) await f.page.touchscreen.tap(point.x, point.y); await frames(f);
    const equipped = await save(f); check(equipped.selectedSkin === id && equipped.spentStars === bought.spentStars && equipped.coins === bought.coins && equipped.unlockedSkins.filter(s => s === id).length === 1, `${label(f)}: ${id} rapid repeat touches cannot double-pay`);
    await shot(f, `wardrobe-${id}`); view.purchases.push({ id, price: price[id], before, bought, equipped });
  }
  const end = await save(f); check(end.totalStars === 360 && end.spentStars === 360 && end.coins === 0, `${label(f)}: all exact approved prices exhaust available currencies only`);
  await f.page.reload({ waitUntil: 'domcontentloaded' }); await attach(f); await ready(f, 'MenuScene');
  check(JSON.stringify(await save(f)) === JSON.stringify(end), `${label(f)}: fresh page retains balances, unlocks and equipment`); await assets(f); await wardrobe(f);
  for (const id of ids) { await select(f, id); if ((await save(f)).selectedSkin !== id) { check((await target(f, 'WardrobeScene', 'button:装备')).enabled, `${label(f)}: owned ${id} equips after all balances reach zero`); await tap(f, 'WardrobeScene', 'button:装备'); } }
  return view;
}
async function runFacts(f) { return f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'), p = s.sheep, b = p.body; return { key: p.texture.key, frame: Number(p.frame.name), state: p.motionState, grounded: p.grounded, y: p.y, width: p.displayWidth, height: p.displayHeight, scaleX: p.scaleX, scaleY: p.scaleY, body: { width: b.width, height: b.height, bottom: b.bottom, velocityY: b.velocity.y }, clock: s.activeRunTimeMs, finished: s.finished }; }); }
async function runtimeSkin(f, id) {
  await select(f, id); if ((await save(f)).selectedSkin !== id) await tap(f, 'WardrobeScene', 'button:装备'); await tap(f, 'WardrobeScene', 'button:返回'); await ready(f, 'MenuScene'); await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene');
  await f.page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); s.spawnSystem.update = () => []; for (const o of [...s.obstacles.getChildren(), ...s.stars.getChildren(), ...s.powerUps.getChildren()]) o.deactivate(); });
  const standing = await runFacts(f); check(standing.key === `sheep-runner-${id}` && standing.width === 48 && standing.height === 42 && standing.body.width === 30 && standing.body.height === 30 && Math.abs(standing.body.bottom - 218) < .1 && Math.abs(standing.scaleX - standing.scaleY) < .00001, `${label(f)}: ${id} real running sprite keeps original display and collision geometry`);
  await shot(f, `${id}-running`);
  await gesture(f, 'tap'); await f.page.waitForFunction(() => { const p = window.g.scene.getScene('RunScene').sheep; return p.motionState === 'JUMPING' && p.body.velocity.y < 0 && Number(p.frame.name) === 5; }, null, { timeout: 2000 }); const normal = await runFacts(f); if (f.width === 896 && f.dpr === 2) await shot(f, `${id}-normal-jump`);
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
  return { id, standing, normal, high, crouch, hit, drawnCrops: [...crops], trip: JSON.parse(trip.model) };
}
async function companionsAndDelivery(f, withDelivery = true) {
  await seed(f, fixtures({ totalStars: 360, spentStars: 360, coins: 0, unlockedSkins: ['white', ids[0]], selectedSkin: 'white' }));
  const result = [];
  for (const id of ids) {
    await seed(f, fixtures({ totalStars: 360, spentStars: 360, coins: 0, unlockedSkins: ['white', id], selectedSkin: 'white' })); await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene');
    const friend = await f.page.evaluate(id => {
      const s = window.g.scene.getScene('RunScene'), c = s.companions; s.physics.pause(); s.events.off('preupdate', s.onPreUpdate, s); s.sys.sceneUpdate = () => {};
      c.patternEnded = true; const viewport = window.g.scale.gameSize, right = s.cameras.main.scrollX + viewport.width + 14, speed = s.difficultySystem.speed;
      const edge = right - (42 + speed * .95 + 6); c.lastObstacle = { x: edge - 36, rightEdge: edge, definition: { kind: 'WoodFence' }, active: false };
      const update = nowMs => c.update({ nowMs, deltaSeconds: 0, speed, viewport, obstacles: [], pickups: [] });
      update(25000); if (!c.bell) throw Error('No safe-gap bell fixture'); c.bell.image.x = s.sheep.x; update(25000); update(26200);
      const p = c.companion?.sheep; return { id, actual: c.companion?.skin, key: p?.texture.key, frame: p?.frame.name, hasBody: !!p?.body, width: p?.displayWidth, leadWidth: s.sheep.displayWidth, travel: s.travel.snapshot(), bellGone: !c.bell };
    }, id);
    check(friend.actual === id && friend.key === `sheep-runner-${id}` && !friend.hasBody && friend.bellGone && friend.travel.companionSkins.includes(id) && Math.abs(friend.width / friend.leadWidth - .85) < .0001, `${label(f)}: actual bell pickup selects owned ${id}, creates visual-only 85% companion and real trip event`);
    await shot(f, `${id}-companion`); result.push(friend); await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene');
    check(await f.page.evaluate(() => !window.g.scene.getScene('RunScene').children.list.some(o => o.name?.startsWith('companion-'))), `${label(f)}: ${id} companion objects clean up on touch exit`);
  }
  if (!withDelivery) return { companions: result, delivery: [], deliveryDeferred: 'Parallel B assets/fonts not ready in this basic-only phase' };
  // Original two routes use the exact selected new skin; route artwork/physics are untouched.
  const routes = [];
  for (const [index, chapter] of ['hill-goodnight-v1', 'dinner-for-you-v1'].entries()) {
    const id = ids[index ? 7 : 4]; await seed(f, fixtures({ totalStars: 360, spentStars: 360, coins: 0, selectedSkin: id, unlockedSkins: ['white', id] })); await tap(f, 'MenuScene', 'mailbox-entry'); await tap(f, 'MenuScene', 'mailbox-delivery');
    for (let n = 0; !await target(f, 'MenuScene', `delivery-chapter:${chapter}`, true) || !(await target(f, 'MenuScene', `delivery-chapter:${chapter}`)).enabled; n++) { check(n < 6, `${label(f)}: original route ${chapter} reachable`); await tap(f, 'MenuScene', 'delivery-next'); }
    await tap(f, 'MenuScene', `delivery-chapter:${chapter}`); await tap(f, 'MenuScene', 'delivery-start'); await ready(f, 'RunScene'); const facts = await runFacts(f);
    check(facts.key === `sheep-runner-${id}` && await f.page.evaluate(chapter => window.g.scene.getScene('RunScene').delivery.chapter.id === chapter, chapter), `${label(f)}: original ${chapter} renders equipped ${id}`); await shot(f, `${id}-${chapter}`);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); await tap(f, 'PauseScene', 'button:返回首页'); await ready(f, 'MenuScene'); routes.push({ chapter, id, facts });
  }
  return { companions: result, delivery: routes };
}
async function edgeTransactions() {
  const f = await open(896, 414, 2, 'finance-edge'); const outcomes = {}; report.failures.push(outcomes);
  for (const [index, id] of ids.entries()) {
    await seed(f, fixtures({ totalStars: index < 4 ? price[id] + 10 : 100, spentStars: index < 4 ? 11 : 0, coins: index < 4 ? 50 : price[id] - 1 })); await wardrobe(f); await select(f, id); const before = await rawSave(f), p = await target(f, 'WardrobeScene', index < 4 ? 'button:星星不足' : 'button:金币不足');
    check(p.disabled && !p.enabled, `${label(f)}: ${id} insufficient currency genuinely disables purchase`); await f.page.touchscreen.tap(p.x, p.y); await frames(f); check(await rawSave(f) === before, `${label(f)}: ${id} insufficient touch causes no transaction`); await auditUi(f, `insufficient-${id}`);
  }
  await seed(f, fixtures({ totalStars: 30, spentStars: 30, coins: 0 })); await wardrobe(f);
  for (const id of ['black', 'brown']) { await select(f, id); const ui = await auditUi(f, `legacy-${id}`); check(ui.texts.some(t => /累计/.test(t)), `${label(f)}: legacy ${id} clearly explains cumulative threshold`); await tap(f, 'WardrobeScene', 'button:解锁'); check((await save(f)).spentStars === 30 && (await save(f)).totalStars === 30 && (await save(f)).coins === 0, `${label(f)}: legacy ${id} unlock is free after available balance reaches zero`); await tap(f, 'WardrobeScene', 'button:装备'); }
  await shot(f, 'legacy-free-threshold');
  await seed(f, fixtures({ coins: 40 })); await wardrobe(f); await select(f, 'golden'); await tap(f, 'WardrobeScene', 'button:购买'); check((await save(f)).coins === 0 && (await save(f)).spentStars === 0, `${label(f)}: original golden coin price/payment unchanged`);
  await seed(f, fixtures()); await wardrobe(f); await select(f, ids[0]); const beforeFailure = await rawSave(f); await f.page.evaluate(() => { window.__blockSave = true; }); await tap(f, 'WardrobeScene', 'button:购买');
  check(await rawSave(f) === beforeFailure && (await auditUi(f, 'failed-save')).feedback === '保存失败，请重试', `${label(f)}: real quota failure neither charges nor unlocks and shows clear feedback`); await shot(f, 'purchase-save-failure');
  await f.page.evaluate(() => { window.__blockSave = false; }); await tap(f, 'WardrobeScene', 'button:购买'); check((await save(f)).spentStars === 40 && (await save(f)).unlockedSkins.includes(ids[0]), `${label(f)}: repaired storage permits exactly one paid retry`);
  const old = fixtures({ version: 4, highScore: 37, totalStars: 40, coins: 55, selectedSkin: 'black', unlockedSkins: ['white', 'black'], settings: { music: false, sfx: true, musicVolume: .4, sfxVolume: .2 } }); delete old.spentStars;
  await seed(f, old); const migrated = await save(f); check(migrated.version === 5 && migrated.spentStars === 0 && migrated.totalStars === 40 && migrated.selectedSkin === 'black' && migrated.coins === 55 && migrated.settings.sfxVolume === .2, `${label(f)}: real v4 migration retains all history with zero spent stars`);
  await wardrobe(f); await select(f, ids[0]); await tap(f, 'WardrobeScene', 'button:购买'); check((await save(f)).spentStars === 40 && (await save(f)).totalStars === 40 && (await save(f)).selectedSkin === 'black', `${label(f)}: migrated historical stars purchase once without auto-equipment`);
  for (const [kind, raw] of [['corrupt-json', '{broken'], ['future', JSON.stringify(fixtures({ version: 99 }))], ['corrupt-spend', JSON.stringify(fixtures({ totalStars: 3, spentStars: 4 }))]]) {
    // Initialize protected raw data after stopping scenes; fallback display must never replace it.
    await seed(f, raw); await wardrobe(f); const actual = await f.page.evaluate(() => window.g.scene.getScene('WardrobeScene').progression.unlockSkin('strawberry-v1'));
    check(actual.status === 'storage-error' && await rawSave(f) === raw, `${label(f)}: ${kind} protected original refuses the actual transaction interface`);
    outcomes[kind] = { status: actual.status, protected: await rawSave(f) === raw }; await shot(f, kind);
  }
  await f.context.close();
  const migration = await open(844, 390, 1, 'migration-save-failure', old), oldRaw = await rawSave(migration);
  await wardrobe(migration); await select(migration, ids[0]); await tap(migration, 'WardrobeScene', 'button:购买');
  check(await rawSave(migration) === oldRaw && JSON.parse(oldRaw).version === 4 && (await auditUi(migration, 'failed-migration')).feedback === '保存失败，请重试', 'Failed v4 migration preserves original progress and refuses purchase instead of spending temporary display data');
  await shot(migration, 'migration-write-failure'); await migration.page.evaluate(() => { window.__blockSave = false; }); await tap(migration, 'WardrobeScene', 'button:购买');
  const after = await save(migration); check(after.version === 5 && after.totalStars === 40 && after.spentStars === 40 && after.coins === 55 && after.unlockedSkins.includes(ids[0]) && after.selectedSkin === 'black', 'Repaired migration and real purchase retain all old fields and consume historic stars once');
  outcomes.failedMigration = { preservedRaw: true, recovered: after }; await migration.context.close();
}
async function resourceRetry() {
  const f = await open(896, 414, 2, 'resource-retry'), raw = await rawSave(f); report.retry = { main: f.main, blockedUrls: [...new Set(f.blockedUrls)] };
  check(f.blockedUrls.length >= 1 && await f.page.evaluate(() => !window.g.textures.exists('sheep-runner-lemon-v1') && !window.g.scene.isActive('MenuScene')), 'One new skin is absent and real preloader refuses MenuScene'); await shot(f, 'missing-skin');
  f.blockAsset = false; await tap(f, 'PreloadScene', 'button:重试'); await ready(f, 'MenuScene'); check(await rawSave(f) === raw, 'Real touch retry preserves the exact independent fixture save'); report.retry.assets = await assets(f); await wardrobe(f); await select(f, ids[1]); await shot(f, 'skin-resource-retry-success'); await f.context.close();
}
async function naturalPlay() {
  for (const id of [ids[0], ids[5], ids[7]]) {
    const f = await open(896, 414, 2, `natural-${id}`, fixtures({ highScore: 0, selectedSkin: id, unlockedSkins: ['white', id] })), log = { id, main: f.main, width: f.width, height: f.height, dpr: f.dpr, attempts: [], inputs: [], samples: [], observedEffectiveMs: 0 }; report.natural.push(log);
    await tap(f, 'MenuScene', 'button:开始游戏'); await ready(f, 'RunScene'); let attempt = 1, lastTouch = 0, sawJump = false, ending = Date.now() + 70000;
    while (Date.now() < ending) {
      const s = await f.page.evaluate(() => { const r = window.g.scene.getScene('RunScene'), p = r.sheep; return { active: window.g.scene.isActive('RunScene'), finished: r.finished, now: r.activeRunTimeMs, speed: r.difficultySystem.speed, key: p.texture.key, frame: p.frame.name, state: p.motionState, grounded: p.grounded,
        obstacles: r.obstacles.getChildren().filter(o => o.active && o.rightEdge > p.x - 16).map(o => ({ x: o.x, right: o.rightEdge, height: o.definition.height, kind: o.definition.kind, seconds: (o.x - p.x) / r.difficultySystem.speed })).sort((a, b) => a.x - b.x) }; });
      log.samples.push(s); if (s.now >= 10000 && !s.finished && s.active) { log.observedEffectiveMs = s.now; await shot(f, 'ten-seconds-real-touch'); break; }
      if (s.finished || !s.active) { log.attempts.push({ attempt, effectiveMs: s.now, endedNaturally: true }); check(attempt < 5, `${id}: unmodified natural touch run survives ten effective seconds`); attempt++; await ready(f, 'ResultScene'); await tap(f, 'ResultScene', 'button:再跑一次'); await ready(f, 'RunScene'); sawJump = false; continue; }
      const o = s.obstacles[0]; let action;
      const overhead = o && /FlyingBird|HangingVine|HangingBranch/.test(o.kind), jumpLead = o?.height > 33 ? .38 : .29;
      if (s.grounded && o && o.seconds > 0 && o.seconds < (overhead ? .32 : jumpLead) && Date.now() - lastTouch > 170) action = overhead ? 'down' : (o.height > 33 ? 'up' : 'tap');
      if (action) { log.inputs.push({ attempt, at: s.now, action, obstacle: o }); await gesture(f, action); lastTouch = Date.now(); sawJump ||= action !== 'down'; }
      if (sawJump && s.state === 'JUMPING' && !log.jumpShot) { log.jumpShot = true; await shot(f, 'natural-jump'); }
      await wait(25);
    }
    check(log.observedEffectiveMs >= 10000 && log.inputs.length > 0 && log.samples.some(s => s.key === `sheep-runner-${id}`), `${id}: separate unmodified natural gameplay and real touch evidence`);
    await tap(f, 'RunScene', 'button:暂停'); await ready(f, 'PauseScene'); const before = await runFacts(f); await wait(150); check((await runFacts(f)).clock === before.clock, `${id}: natural-play actual pause freezes clock`); await tap(f, 'PauseScene', 'button:继续游戏'); await ready(f, 'RunScene'); await f.context.close();
  }
}

try {
  const prior = JSON.parse(await readFile(new URL('docs/skins-v4/old-skin-hashes-before.json', root), 'utf8'));
  report.oldAssets = { count: Object.keys(prior.files).length, unchanged: true };
  for (const [path, expected] of Object.entries(prior.files)) { const actual = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex'); check(actual === expected, `Original skin asset SHA256 unchanged: ${path}`); }
  if (['all', 'matrix', 'runtime', 'runtime-only', 'runtime-basic', 'production'].includes(phase)) for (const [width, height, dpr] of profiles) {
    const f = await open(width, height, dpr, 'matrix', phase === 'runtime-only' ? fixtures({ unlockedSkins: ['white', ...ids], spentStars: 360, coins: 0 }) : fixtures());
    const view = phase === 'runtime-only' ? { width, height, dpr, main: f.main, assets: await assets(f), purchases: [], runtime: [] } : await purchaseMatrix(f);
    if (phase === 'runtime-only') { report.views.push(view); await wardrobe(f); }
    if (phase !== 'matrix') { for (const id of ids) { view.runtime.push(await runtimeSkin(f, id)); } if (width === 896) view.extra = await companionsAndDelivery(f, phase !== 'runtime-basic'); }
    await f.context.close(); process.stdout.write(JSON.stringify({ profile: `${width}x${height}/DPR${dpr}`, phase, purchases: view.purchases.length, actualSkins: view.runtime.length, checks: report.checks.length }) + '\n');
    await writeFile(new URL(`browser-review-${phase}.json`, output), JSON.stringify(report, null, 2));
  }
  if (['all', 'edge', 'production'].includes(phase)) { await edgeTransactions(); await resourceRetry(); }
  if (['all', 'natural', 'production'].includes(phase)) await naturalPlay();
  check(report.runtimeErrors.length === 0, 'No runtime exceptions in wardrobe, transactions, poses, companion, delivery or result'); report.passed = true;
} catch (error) { report.failure = error.stack; for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' }).catch(() => {}); throw error; }
finally { await writeFile(new URL(`browser-review-${phase}.json`, output), JSON.stringify(report, null, 2)); await browser.close(); }
process.stdout.write(JSON.stringify({ passed: report.passed, phase, profiles: report.views.length, checks: report.checks.length, screenshots: report.screenshots.length, phoneHardware: false }) + '\n');
