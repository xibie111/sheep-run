import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { MAIL_LETTERS } from '../../src/data/mailLetters.ts';
import { RESIDENT_LETTERS } from '../../src/residents/ResidentLetters.ts';
import { RESIDENT_CATALOG_TEXT } from '../../src/residents/ResidentCatalog.ts';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.RESIDENT_QA_URL ?? 'http://127.0.0.1:4382/';
const output = path.resolve(process.env.RESIDENT_UI_QA_OUT ?? 'docs/resident-stories-v1/ui-browser');
const selectedProfiles = process.env.RESIDENT_UI_QA_PROFILES?.split(',');
const selectedFixtures = process.env.RESIDENT_UI_QA_FIXTURES?.split(',');
const storageOnly = process.env.RESIDENT_UI_QA_STORAGE_ONLY === '1';
const storageAll = process.env.RESIDENT_UI_QA_STORAGE_ALL === '1';
const frameSettling = process.env.RESIDENT_UI_QA_FRAME_SETTLE === '1';
const profiles = [[480, 270], [896, 414], [844, 390], [800, 600]].flatMap(([width, height]) => [1, 2].map(dpr => ({ width, height, dpr, id: `${width}x${height}-dpr${dpr}` })))
  .filter(profile => !selectedProfiles || selectedProfiles.includes(profile.id));
await mkdir(output, { recursive: true });
const residents = [
  { id: 'windmill-keeper-v1', name: '阿禾', slug: 'windmill', art: 'ahe', chapters: ['windmill-invitation-v1', 'windmill-thanks-v1', 'windmill-photo-v1'] },
  { id: 'riverside-neighbor-v1', name: '小沐', slug: 'riverside', art: 'xiaomu', chapters: ['rainy-umbrella-v1', 'riverside-thanks-v1', 'riverside-sunshine-v1'] },
  { id: 'lighthouse-keeper-v1', name: '阿灯', slug: 'lighthouse', art: 'adeng', chapters: ['lighthouse-starlight-v1', 'lighthouse-old-letter-v1', 'lighthouse-gathering-v1'] },
];
const allChapters = residents.flatMap(resident => resident.chapters);
const newChapters = residents.flatMap(resident => resident.chapters.slice(1));
const allLetters = residents.flatMap(resident => resident.chapters.map((_chapter, index) => `resident-${resident.slug}-letter-${index + 1}-v1`));
const assetSource = await readFile(new URL('../../src/residents/residentAssets.ts', import.meta.url), 'utf8');
const expectedAssets = [...assetSource.matchAll(/\{ key: '([^']+)', url: new URL\('[^']+', import\.meta\.url\)\.href, width: (\d+), height: (\d+) \}/g)]
  .map(([, key, width, height]) => ({ key, width: Number(width), height: Number(height) }));
const uiSource = await readFile(new URL('../../src/residents/ResidentPanelModel.ts', import.meta.url), 'utf8');
const uiCopy = Function('return ' + uiSource.match(/export const RESIDENT_UI_TEXT = (\[[\s\S]*?\]) as const;/)[1])();
const routeSource = await readFile(new URL('../../src/delivery/ResidentRoutes.ts', import.meta.url), 'utf8');
const routeCopy = [...routeSource.matchAll(/'([^'\r\n]*[\u4e00-\u9fff][^'\r\n]*)'/g)].map(match => match[1]);
const expectedText = [...uiCopy, ...routeCopy, ...RESIDENT_CATALOG_TEXT, ...RESIDENT_LETTERS.flatMap(letter => [letter.title, ...letter.paragraphs, letter.signature])];
const report = { passed: false, url, phoneHardware: false, engine: 'Headless Microsoft Edge / Chromium, mobile touch emulation',
  methods: { ui: 'Actual game boot and actual touchscreen / CDP touch events; no scene fixtures or production test hooks.',
    progress: 'Explicit isolated localStorage fixtures: fresh, original first-stage completions, and nine completed story chapters. These are UI/compatibility fixtures, not natural route play evidence.',
    directGuards: 'Actual disabled chapter cards and direct RunScene launch requests verify production guards against locked routes; direct DeliverySelection requests are covered by unit tests.',
    saveFailure: 'Isolated context intercepts only the mailbox Storage.setItem key to throw QuotaExceededError. No production changes.',
    partialSave: 'Explicit valid one-star challenge records with a missing delivery record verify reconciliation; no three-star or read history is invented.' },
  profiles: [], supplemental: [], screenshots: [], suppressedHotReloads: [] };
const launchBrowser = () => chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let browser = await launchBrowser();
let current;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(name, passed, detail) {
  const entry = { name, passed: !!passed, ...(detail === undefined ? {} : { detail }) };
  current.checks.push(entry);
  if (!passed) throw new Error(`${current.id}: ${name}: ${JSON.stringify(detail)}`);
}
async function settle(f) {
  if (!frameSettling) { await f.page.waitForTimeout(60); return; }
  await f.page.evaluate(() => new Promise((resolve, reject) => {
    let remaining = 2;
    const finished = () => {
      if (--remaining > 0) return;
      clearTimeout(timer); window.g.events.off('postrender', finished);
      requestAnimationFrame(() => resolve());
    };
    const timer = setTimeout(() => {
      window.g.events.off('postrender', finished);
      reject(new Error('QA timed out waiting for two actual render frames'));
    }, 15000);
    window.g.events.on('postrender', finished);
  }));
}
async function diagnose(f) {
  return f.page.evaluate(() => ({
    visibility: document.visibilityState,
    loop: { running: window.g.loop.running, time: window.g.loop.time, frame: window.g.loop.frame, focused: window.g.loop.hasFocus },
    owner: window.g.scene.getScene('MenuScene').data.get('menu-modal-owner'),
    scenes: window.g.scene.scenes.map(scene => ({ key: scene.sys.settings.key, status: scene.sys.settings.status })),
    overlays: [...document.querySelectorAll('[data-adventure-overlay]')].map(element => ({
      name: element.dataset.adventureOverlay, mode: element.dataset.mode,
      display: element.style.display, opacity: element.style.opacity,
      rect: { width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height },
    })),
  }));
}
async function read(f, kind = 'resident-panel') {
  return f.page.evaluate(kind => {
    const canvases = [...document.querySelectorAll(`[data-adventure-overlay="${kind}"]`)];
    const canvas = canvases.filter(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).at(-1);
    if (!canvas) throw new Error(`No visible ${kind} canvas after actual touch and settle`);
    return { ...canvas.dataset };
  }, kind);
}
async function owner(f) { return f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner')); }
async function storage(f) { return f.page.evaluate(() => Object.fromEntries(Object.entries(localStorage))); }
async function point(f, name, allowDisabled = false) {
  return f.page.evaluate(({ name, allowDisabled }) => {
    const scene = window.g.scene.getScene('MenuScene');
    const collect = list => list.flatMap(item => [item, ...(item.list ? collect(item.list) : [])]);
    const matches = collect(scene.children.list).filter(item => item.name === name);
    const item = matches.find(item => item.input?.enabled) ?? (allowDisabled ? matches[0] : undefined);
    if (!item) throw new Error('Missing or disabled target: ' + name);
    const box = item.getBounds(), rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: rect.x + box.centerX / size.width * rect.width, y: rect.y + box.centerY / size.height * rect.height };
  }, { name, allowDisabled });
}
async function tap(f, name, allowDisabled = false) { const p = await point(f, name, allowDisabled); await f.page.touchscreen.tap(p.x, p.y); await settle(f); }
async function snapshot(f, label) {
  const name = `${current.id}-${label}.png`;
  const { data } = await f.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(data, 'base64'));
  report.screenshots.push(name);
}
async function validateTextBounds(f, kind, label) {
  const state = await read(f, kind), lines = JSON.parse(state.lines);
  const failures = lines.filter(line => line.ink.x < line.box.x - 1 || line.ink.y < line.box.y - 1 ||
    line.ink.x + line.ink.width > line.box.x + line.box.width + 1 || line.ink.y + line.ink.height > line.box.y + line.box.height + 1);
  check(label + ': complete text ink fits its authored boxes', failures.length === 0, failures);
  return state;
}
async function validateResident(f, label, screenshot = false) {
  const state = await read(f), lines = JSON.parse(state.lines), images = JSON.parse(state.images), targets = JSON.parse(state.targets);
  const failures = lines.filter(line => line.fontSize < 11.999 || line.ink.x < line.box.x - 1 || line.ink.y < line.box.y - 1 ||
    line.ink.x + line.ink.width > line.box.x + line.box.width + 1 || line.ink.y + line.ink.height > line.box.y + line.box.height + 1);
  check(label + ': every line is at least 12px and its full glyph ink fits', failures.length === 0, failures);
  check(label + ': generated art uses uniform scale', images.every(image => Math.abs(image.width / image.height - image.sourceWidth / image.sourceHeight) < 1e-6));
  const enabled = JSON.parse(state.enabled).map(name => name.slice('resident-'.length)).filter(name => name !== 'blocker');
  const bounds = await f.page.evaluate(() => ({ width: window.g.scale.gameSize.width, height: window.g.scale.gameSize.height }));
  check(label + ': active targets stay inside viewport', enabled.every(name => {
    const box = targets[name]; return box && box.width >= 28 && box.height >= 28 && box.x >= 0 && box.y >= 0 && box.x + box.width <= bounds.width && box.y + box.height <= bounds.height;
  }));
  const overlapping = enabled.flatMap((name, index) => enabled.slice(index + 1).filter(other => {
    const a = targets[name], b = targets[other]; return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  }).map(other => [name, other]));
  check(label + ': active touch areas do not overlap', overlapping.length === 0, overlapping);
  check(label + ': residents exclusively own input', await owner(f) === 'residents');
  if (screenshot) await snapshot(f, label);
  return state;
}
async function loadGame(f) {
  const requestedMain = f.page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()), { timeout: 60000 });
  await f.page.goto(url, { waitUntil: 'domcontentloaded' });
  f.main = (await requestedMain).url();
  f.result.mainModule = f.main;
  await f.page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
  await f.page.waitForFunction(() => window.g?.scene.isActive('MenuScene') && window.g.scene.getScene('MenuScene').children.list.some(item => item.name === 'mailbox-entry'), null, { timeout: 90000 });
  await settle(f);
}
async function open(profile, fixture) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr, hasTouch: true, isMobile: true });
  await context.routeWebSocket('**/*', socket => {
    const server = socket.connectToServer(); socket.onMessage(message => server.send(message)); server.onMessage(message => {
      let packet; try { packet = JSON.parse(String(message)); } catch {}
      if (['update', 'full-reload', 'prune'].includes(packet?.type)) { report.suppressedHotReloads.push(packet.type); return; }
      socket.send(message);
    });
  });
  const page = await context.newPage(), f = { context, page, profile, fixture, cdp: await context.newCDPSession(page) };
  current = { id: profile.id + '-' + fixture.kind, fixture: fixture.kind, checks: [], errors: [], consoleErrors: [], consoleWarnings: [], expectedBrowserDiagnostics: [] };
  f.result = current;
  page.on('pageerror', error => f.result.errors.push(error.message));
  page.on('crash', () => f.result.errors.push('Browser renderer crashed'));
  page.on('console', message => {
    if (message.type() === 'warning' && f.result.consoleWarnings.length < 20) f.result.consoleWarnings.push(message.text());
    if (message.type() !== 'error') return;
    if (message.text().startsWith('Ignored attempt to cancel a touchcancel event with cancelable=false')) f.result.expectedBrowserDiagnostics.push(message.text());
    else f.result.consoleErrors.push(message.text());
  });
  await page.addInitScript(fixture => {
    if (!localStorage.getItem('resident-qa-seeded')) {
      localStorage.setItem('sheep-run-save', JSON.stringify({ version: 5, spentStars: 0, highScore: 12345, totalStars: 42, coins: 77, selectedSkin: 'white', unlockedSkins: ['white'],
        upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } }));
      localStorage.setItem('sheep-run-delivery-v1', JSON.stringify({ version: 1, completedIds: fixture.completedIds, extension: { preserve: true } }));
      localStorage.setItem('sheep-run-mailbox-v1', JSON.stringify({ version: 1, readIds: fixture.kind === 'full' ? ['future-letter-v9'] : [], extension: { preserve: true } }));
      localStorage.setItem('sheep-run-delivery-challenges-v1', JSON.stringify({ version: 1, chapters: fixture.challenges ?? {}, extension: { preserve: true } }));
      localStorage.setItem('resident-qa-seeded', 'true');
    }
    const realSet = Storage.prototype.setItem;
    window.residentQaFailMailWrites = false; window.residentQaWrites = [];
    Storage.prototype.setItem = function(key, value) {
      const failed = key === 'sheep-run-mailbox-v1' && window.residentQaFailMailWrites;
      window.residentQaWrites.push({ key, failed });
      if (failed) throw new DOMException('Isolated resident mailbox save failure', 'QuotaExceededError');
      return realSet.call(this, key, value);
    };
  }, fixture);
  await loadGame(f);
  f.protectedSave = (await storage(f))['sheep-run-save'];
  return f;
}
async function close(f) {
  check('no browser runtime exceptions', f.result.errors.length === 0, f.result.errors);
  check('no console errors', f.result.consoleErrors.length === 0, f.result.consoleErrors);
  check('UI browsing preserves main gameplay save byte for byte', (await storage(f))['sheep-run-save'] === f.protectedSave);
  await f.context.close();
}
async function mailbox(f) { await tap(f, 'mailbox-entry'); check('touch opens actual mailbox', await owner(f) === 'mailbox'); await validateTextBounds(f, 'mailbox', 'mailbox list'); }
async function stories(f) { await tap(f, 'mailbox-residents'); check('mailbox touch opens residents child modal', await owner(f) === 'residents'); }
async function verifyBoot(f) {
  const result = await f.page.evaluate(({ assets: RESIDENT_ASSETS, values }) => {
    const chars = window.g.cache.bitmapFont.get('pasture-display-64').data.chars;
    const missing = [...new Set(values.join(''))].filter(char => !chars[char.codePointAt(0)]);
    const textures = RESIDENT_ASSETS.map(asset => {
      const texture = window.g.textures.get(asset.key), image = texture.getSourceImage();
      return { key: asset.key, width: image.width, height: image.height, modes: texture.source.map(source => source.scaleMode), passed: image.width === asset.width && image.height === asset.height && texture.source.every(source => source.scaleMode === 1) };
    });
    const gl = window.g.renderer.gl, filters = [];
    if (gl) {
      const previous = gl.getParameter(gl.TEXTURE_BINDING_2D);
      for (const asset of RESIDENT_ASSETS) { const source = window.g.textures.get(asset.key).source[0]; gl.bindTexture(gl.TEXTURE_2D, source.glTexture.webGLTexture);
        filters.push({ key: asset.key, min: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER), mag: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER) }); }
      gl.bindTexture(gl.TEXTURE_2D, previous);
    }
    const rect = window.g.canvas.getBoundingClientRect();
    return { missing, textures, filters, nearest: gl?.NEAREST, canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, logical: { width: window.g.scale.gameSize.width, height: window.g.scale.gameSize.height } };
  }, { assets: expectedAssets, values: expectedText });
  check('all actual resident UI and letter glyphs are loaded', result.missing.length === 0, result.missing);
  check('resident runtime textures have declared dimensions and NEAREST modes', result.textures.every(asset => asset.passed), result.textures.filter(asset => !asset.passed));
  check('actual WebGL texture min/mag filters remain NEAREST', result.filters.length === result.textures.length && result.filters.every(asset => asset.min === result.nearest && asset.mag === result.nearest));
  check('game fills physical viewport', Math.abs(result.canvas.x) < 1 && Math.abs(result.canvas.y) < 1 && Math.abs(result.canvas.width - f.profile.width) < 1 && Math.abs(result.canvas.height - f.profile.height) < 1, result.canvas);
  current.boot = result;
}
async function privateMail(f) {
  const letters = MAIL_LETTERS;
  check('private letters retain their original titles and signature', letters[0].title === '欢迎信' && letters[1].title === '晚安信' && letters.every(letter => letter.signature === '爱你的小杨同学'));
  for (const letter of letters) {
    const before = (await storage(f))['sheep-run-mailbox-v1'];
    await tap(f, 'mailbox-letter:' + letter.id); const pages = [];
    for (let index = 0; index < 30; index++) {
      const state = await read(f, 'mailbox'); pages.push(JSON.parse(state.lines).filter(line => typeof line.paragraph === 'number'));
      if (Number(state.page) === Number(state.pages) - 1) break;
      await tap(f, 'mailbox-next');
    }
    const rows = pages.flat();
    for (const [index, paragraph] of [...letter.paragraphs, letter.signature].entries()) {
      check(`${letter.id}: full original paragraph ${index} survives pagination`, rows.filter(row => row.paragraph === index).map(row => row.text).join('') === paragraph);
    }
    await tap(f, 'mailbox-back');
    check(`${letter.id}: returning before keep does not mark read`, (await storage(f))['sheep-run-mailbox-v1'] === before);
  }
}
async function checkFresh(f) {
  await verifyBoot(f); await mailbox(f);
  const mousePoint = await point(f, 'mailbox-residents'); await f.page.mouse.click(mousePoint.x, mousePoint.y); await settle(f);
  check('mouse click cannot open residents', await owner(f) === 'mailbox');
  await stories(f);
  let state = await validateResident(f, 'fresh-list', true);
  check('new player has three independent 0/3 story chains and no unread replies', JSON.parse(state.progress).residents.every(resident => resident.completedCount === 0 && resident.unreadCount === 0));
  check('group photo starts locked', !JSON.parse(state.enabled).includes('resident-group'));
  const p = await point(f, 'resident-resident:' + residents[0].id);
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await f.cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await settle(f);
  check('cancelled touch never opens a resident', (await read(f)).mode === 'list');
  await f.page.mouse.click(p.x, p.y); await settle(f); check('mouse cannot open a resident card', (await read(f)).mode === 'list');
  for (const resident of residents) {
    await tap(f, 'resident-resident:' + resident.id);
    state = await validateResident(f, 'fresh-detail-' + resident.art, true);
    check(resident.id + ': only first stage can be selected', JSON.parse(state.enabled).includes('resident-stage:0') && !JSON.parse(state.enabled).includes('resident-stage:1') && !JSON.parse(state.enabled).includes('resident-stage:2'));
    await tap(f, 'resident-stage:1', true); check(resident.id + ': physical touch on locked stage does nothing', (await read(f)).stageIndex === '0');
    await tap(f, 'resident-brief');
    check('resident detail opens correct nested chapter brief', await owner(f) === 'delivery' && (await read(f, 'delivery-panel')).chapterId === resident.chapters[0]);
    await validateTextBounds(f, 'delivery-panel', resident.id + ' nested brief');
    check('resident surface hides while child brief owns input', await f.page.locator('[data-adventure-overlay="resident-panel"]:visible').count() === 0);
    const enabledParents = await f.page.evaluate(() => window.g.scene.getScene('MenuScene').children.list.filter(item => item.input?.enabled && (item.name.startsWith('resident-') || item.name.startsWith('mailbox-'))).map(item => item.name));
    check('nested brief disables all parent residents and mailbox touch targets', enabledParents.length === 0, enabledParents);
    await tap(f, 'delivery-back'); check('brief back restores exact resident parent', await owner(f) === 'residents' && (await read(f)).residentId === resident.id && (await read(f)).mode === 'detail');
    await tap(f, 'resident-back');
  }
  await tap(f, 'resident-letters'); const seen = [];
  for (let index = 0; index < 3; index++) {
    state = await validateResident(f, 'locked-letters-' + (index + 1), index === 0);
    check('locked letter pages have no enabled letter targets', !JSON.parse(state.enabled).some(name => name.startsWith('resident-letter:')));
    seen.push(...JSON.parse(state.lines).map(line => line.text).filter(text => text.includes('回信') || text.includes('问候') || text.includes('小花') || text.includes('之后') || text.includes('位置') || text.includes('欢迎') || text.includes('小灯') || text.includes('束光')));
    if (index < 2) await tap(f, 'resident-next');
  }
  check('nine letters occupy three actual pages', state.page === '2' && state.pageCount === '3');
  await tap(f, 'resident-back'); await tap(f, 'resident-back'); check('resident close restores mailbox only', await owner(f) === 'mailbox');
  await privateMail(f);
  await tap(f, 'mailbox-delivery'); const lockedSeen = new Set();
  for (let index = 0; index < 6; index++) {
    const panel = await validateTextBounds(f, 'delivery-panel', 'normal selector page ' + index); JSON.parse(panel.lockedChapterIds).forEach(id => lockedSeen.add(id));
    const names = JSON.parse(panel.targetNames), enabled = JSON.parse(panel.enabled);
    check('normal chapter selection disables every new locked route on page ' + index, names.every((name, i) => !newChapters.some(id => name === 'delivery-chapter:' + id) || !enabled[i]));
    if (!enabled[names.indexOf('delivery-next')]) break;
    await tap(f, 'delivery-next');
  }
  check('normal selector recognizes all six locked new routes', newChapters.every(id => lockedSeen.has(id)));
  await snapshot(f, 'normal-selector-locked'); await tap(f, 'delivery-back'); await tap(f, 'button:合上邮箱');
  check('closing mailbox restores main menu input owner', !await owner(f));
  for (const id of newChapters) {
    await f.page.evaluate(id => { window.g.scene.getScene('MenuScene').scene.start('RunScene', { deliveryId: id }); }, id);
    await settle(f); await f.page.waitForFunction(() => window.g.scene.isActive('MenuScene') && !window.g.scene.isActive('RunScene'));
    check(id + ': direct locked RunScene launch returns to mailbox without gameplay', await owner(f) === 'mailbox');
  }
  check('scene restart cleans resident/delivery surfaces', await f.page.locator('[data-adventure-overlay="resident-panel"]').count() === 1 && await f.page.locator('[data-adventure-overlay="delivery-panel"]').count() === 2);
}
async function checkLegacy(f) {
  await mailbox(f); await stories(f);
  const state = await validateResident(f, 'legacy-first-stage-records', true), progress = JSON.parse(state.progress);
  check('old success IDs immediately yield 1/3, first unread reply and stage two', progress.residents.every(resident => resident.completedCount === 1 && resident.unreadCount === 1 && resident.currentStage.index === 2));
  check('old completion migration does not invent stars or read IDs', await f.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('sheep-run-delivery-challenges-v1')).chapters).length === 0 && JSON.parse(localStorage.getItem('sheep-run-mailbox-v1')).readIds.length === 0));
  for (const resident of residents) {
    await tap(f, 'resident-resident:' + resident.id); const detail = await read(f);
    check(resident.id + ': stage two available before reading', detail.stageIndex === '1' && JSON.parse(detail.enabled).includes('resident-stage:1'));
    await tap(f, 'resident-brief'); check(resident.id + ': correct second chapter brief', (await read(f, 'delivery-panel')).chapterId === resident.chapters[1]);
    await tap(f, 'delivery-back'); await tap(f, 'resident-back');
  }
  await tap(f, 'resident-back'); await tap(f, 'button:合上邮箱');
}
async function letterToLast(f, id, verify = false) {
  await tap(f, 'resident-letter:' + id); const text = [];
  for (let index = 0; index < 30; index++) {
    const state = verify ? await validateResident(f, id + '-page-' + index) : await read(f);
    if (verify && index === 0 && id.endsWith('letter-1-v1')) await snapshot(f, id + '-first-page');
    const lines = JSON.parse(state.lines); text.push(...lines.slice(1, lines.findIndex(line => /^\d+ \/ \d+$/.test(line.text))).map(line => line.text));
    if (Number(state.page) === Number(state.pageCount) - 1) return { state, text };
    check(id + ': keep target stays disabled before last page', !JSON.parse(state.enabled).includes('resident-keep'));
    await tap(f, 'resident-next');
  }
  throw new Error('Letter pagination exceeded 30 pages: ' + id);
}
async function checkFull(f) {
  await mailbox(f); await stories(f);
  let state = await validateResident(f, 'completed-resident-list', true);
  check('nine completed stages unlock three endings and group without star requirements', JSON.parse(state.progress).groupPhotoUnlocked && JSON.parse(state.progress).residents.every(resident => resident.completedCount === 3 && resident.keepsakeUnlocked && resident.unreadCount === 3));
  for (const resident of residents) {
    await tap(f, 'resident-resident:' + resident.id); await tap(f, 'resident-keepsake');
    state = await validateResident(f, 'keepsake-' + resident.art, true);
    check(resident.id + ': final generated illustration shown', state.mode === 'keepsake' && JSON.parse(state.images).some(image => image.key === 'resident-v1-' + resident.art + '-keepsake'));
    await tap(f, 'resident-back'); await tap(f, 'resident-back');
  }
  await tap(f, 'resident-group'); state = await validateResident(f, 'group-photo', true);
  check('group illustration uses generated group photo', JSON.parse(state.images).some(image => image.key === 'resident-v1-group-photo'));
  await tap(f, 'resident-back'); await tap(f, 'resident-letters');
  const expected = RESIDENT_LETTERS;
  for (const [index, id] of allLetters.entries()) {
    if (index && index % 3 === 0) await tap(f, 'resident-next');
    const before = JSON.parse((await storage(f))['sheep-run-mailbox-v1']).readIds;
    let reading = await letterToLast(f, id, true);
    check(id + ': actual readable layout has multiple pages', Number(reading.state.pageCount) > 1, Number(reading.state.pageCount));
    const letter = expected.find(letter => letter.id === id);
    check(id + ': every specified character and signature is rendered through pages', reading.text.join('') === [...letter.paragraphs, letter.signature].join(''), { actual: reading.text.join(''), expected: [...letter.paragraphs, letter.signature].join('') });
    const lastPage = Number(reading.state.page); await tap(f, 'resident-previous');
    check(id + ': previous page disables keep and does not persist read', Number((await read(f)).page) === lastPage - 1 && !JSON.parse((await read(f)).enabled).includes('resident-keep') && JSON.stringify(JSON.parse((await storage(f))['sheep-run-mailbox-v1']).readIds) === JSON.stringify(before));
    await tap(f, 'resident-back'); check(id + ': opening flipping returning does not mark read', JSON.stringify(JSON.parse((await storage(f))['sheep-run-mailbox-v1']).readIds) === JSON.stringify(before));
    reading = await letterToLast(f, id); if (index === 0) await snapshot(f, 'last-letter-page');
    await tap(f, 'resident-keep');
    const kept = JSON.parse((await storage(f))['sheep-run-mailbox-v1']);
    check(id + ': explicit final-page keep marks only this stable ID once', kept.readIds.length === before.length + 1 && kept.readIds.filter(value => value === id).length === 1 && before.every(value => kept.readIds.includes(value)));
    check(id + ': future IDs and extension fields survive', kept.readIds.includes('future-letter-v9') && kept.extension.preserve === true);
  }
  await tap(f, 'resident-back'); state = await validateResident(f, 'all-nine-replies-kept', true);
  check('all unread resident badges clear after nine explicit keep actions', JSON.parse(state.progress).residents.every(resident => resident.unreadCount === 0));
  await tap(f, 'resident-back'); await tap(f, 'button:合上邮箱');
  await loadGame(f); await mailbox(f); await stories(f); state = await read(f);
  check('refresh restores all nine read IDs and unlocked group', JSON.parse(state.progress).groupPhotoUnlocked && JSON.parse(state.progress).residents.every(resident => resident.unreadCount === 0));
}
async function saveFailure(profile) {
  const f = await open(profile, { kind: 'mail-save-failure', completedIds: residents.map(resident => resident.chapters[0]) });
  report.supplemental.push(f.result);
  try {
    await mailbox(f); await stories(f); await tap(f, 'resident-letters');
    const id = allLetters[0]; await letterToLast(f, id);
    await f.page.evaluate(() => { window.residentQaFailMailWrites = true; });
    await tap(f, 'resident-keep'); let state = await validateResident(f, 'mail-save-failed', true);
    check('failed write visibly says temporarily unsaved', state.saveFailed === 'true' && JSON.parse(state.lines).some(line => line.text === '暂未保存'));
    check('failed keep is retained in session while original storage bytes remain unread', JSON.parse(state.progress).residents[0].unreadCount === 0 && !JSON.parse((await storage(f))['sheep-run-mailbox-v1']).readIds.includes(id));
    await tap(f, 'resident-back'); await validateResident(f, 'mail-save-failed-list', true);
    await tap(f, 'resident-resident:' + residents[0].id); await validateResident(f, 'mail-save-failed-detail', true);
    await tap(f, 'resident-letters'); await letterToLast(f, id); await validateResident(f, 'mail-save-failed-read', true);
    await tap(f, 'resident-back'); await tap(f, 'resident-back'); await tap(f, 'resident-back'); await tap(f, 'resident-back');
    await f.page.evaluate(() => { window.residentQaFailMailWrites = false; }); await stories(f);
    state = await validateResident(f, 'mail-save-retried', true);
    check('reopening resident panel retries explicit read intent', state.saveFailed === 'false' && JSON.parse((await storage(f))['sheep-run-mailbox-v1']).readIds.includes(id));
    await loadGame(f); await mailbox(f); await stories(f);
    check('successful retry survives full page refresh', JSON.parse((await storage(f))['sheep-run-mailbox-v1']).readIds.includes(id));
    await close(f);
  } catch (error) { f.result.failure = error.stack; await f.context.close(); throw error; }
}
async function partialSave(profile) {
  const challenges = Object.fromEntries(residents.map(resident => [resident.chapters[0], { bestStars: 1, keepsake: false }]));
  const f = await open(profile, { kind: 'partial-save-recovery', completedIds: [], challenges }); report.supplemental.push(f.result);
  try {
    await mailbox(f); await stories(f); const state = await validateResident(f, 'recovered-completions', true);
    check('validated successful one-star records restore missed delivery writes', JSON.parse(state.progress).residents.every(resident => resident.completedCount === 1 && resident.currentStage.index === 2));
    const stored = await storage(f);
    check('recovery preserves original rating and does not synthesize reads', JSON.stringify(JSON.parse(stored['sheep-run-delivery-challenges-v1']).chapters) === JSON.stringify(challenges) && JSON.parse(stored['sheep-run-mailbox-v1']).readIds.length === 0);
    check('recovered completion IDs persist', residents.every(resident => JSON.parse(stored['sheep-run-delivery-v1']).completedIds.includes(resident.chapters[0])));
    await close(f);
  } catch (error) { f.result.failure = error.stack; await f.context.close(); throw error; }
}

try {
  for (const profile of profiles) {
    if (report.profiles.length) { await browser.close(); browser = await launchBrowser(); }
    const item = { ...profile, cases: [] }; report.profiles.push(item);
    for (const fixture of [{ kind: 'fresh', completedIds: [] }, { kind: 'legacy', completedIds: residents.map(resident => resident.chapters[0]) }, { kind: 'full', completedIds: allChapters }]
      .filter(fixture => !storageOnly && (!selectedFixtures || selectedFixtures.includes(fixture.kind)))) {
      let f;
      try {
        f = await open(profile, fixture); item.cases.push(f.result);
        if (fixture.kind === 'fresh') await checkFresh(f); else if (fixture.kind === 'legacy') await checkLegacy(f); else await checkFull(f);
        await close(f); console.log('PASS', f.result.id, f.result.checks.length);
      } catch (error) {
        if (f) {
          f.result.failure = error.stack;
          f.result.diagnostic = await diagnose(f).catch(error => ({ failure: error.message }));
          await snapshot(f, 'FAILED').catch(error => { f.result.screenshotFailure = error.message; }); await f.context.close();
        }
        else item.cases.push({ id: profile.id + '-' + fixture.kind, failure: error.stack, checks: current?.checks ?? [], errors: current?.errors ?? [] });
        console.error(error.stack); throw error;
      } finally { await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
    }
  }
  if (profiles.length && !selectedFixtures) for (const profile of storageAll ? profiles : [profiles[0]]) {
    await browser.close(); browser = await launchBrowser(); await saveFailure(profile); await partialSave(profile);
  }
  report.passed = report.profiles.length === profiles.length && [...report.profiles.flatMap(profile => profile.cases), ...report.supplemental].every(item => !item.failure && item.checks.every(check => check.passed));
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await browser.close(); await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, profiles: report.profiles.length, cases: report.profiles.reduce((sum, profile) => sum + profile.cases.length, 0),
    checks: [...report.profiles.flatMap(profile => profile.cases), ...report.supplemental].reduce((sum, item) => sum + item.checks.length, 0), supplemental: report.supplemental.length, failure: report.failure }));
}
