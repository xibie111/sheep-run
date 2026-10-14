import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.ACHIEVEMENTS_V3_QA_URL || 'http://127.0.0.1:11095/';
const output = new URL('../docs/aegis/work/2026-10-13-achievements-v3/browser-review/', import.meta.url);
await mkdir(new URL('screenshots/', output), { recursive: true });
const parseCatalog = source => [...source.matchAll(/\{id:"([^"]+)",metric:"([^"]+)",name:"([^"]+)",goal:(\d+),condition:"([^"]+)",message:"([^"]+)",icon:"([^"]+)"\}/g)]
  .map(m => ({ id: m[1], metric: m[2], name: m[3], goal: Number(m[4]), condition: m[5], message: m[6], icon: m[7] }));
const originals = [...parseCatalog(await readFile(new URL('../src/data/journeyBook.ts', import.meta.url), 'utf8')), ...parseCatalog(await readFile(new URL('../src/data/expandedAchievements.ts', import.meta.url), 'utf8'))];
const additions = parseCatalog(await readFile(new URL('../src/data/journeyMilestonesV3.ts', import.meta.url), 'utf8'));
assert.equal(originals.length, 32, 'original catalog count');
assert.equal(additions.length, 12, 'additional catalog count');
const catalog = [...originals, ...additions], pages = Math.ceil(catalog.length / 4), oldDate = '2026-10-08', newDate = '2026-10-13';
const skins = [...(await readFile(new URL('../src/data/sheepSkins.ts', import.meta.url), 'utf8')).matchAll(/\{ id: "([^"]+)", label:/g)].map(m => m[1]);
assert(skins.length >= 30, 'at least thirty real skin ids available');
const badges = ['spring-flower', 'spring-butterfly', 'spring-clover', 'summer-sunflower', 'summer-watermelon', 'summer-shell', 'autumn-maple', 'autumn-acorn', 'autumn-pumpkin', 'winter-snowflake', 'winter-mitten', 'winter-cocoa'];
const journal = { version: 1, runs: 250, summons: 100, stars: 100, obstacles: 150, record: true, seasons: ['spring', 'summer', 'autumn', 'winter'], skins: 30,
  achieved: Object.fromEntries(catalog.map(a => [a.id, originals.some(o => o.id === a.id) ? oldDate : newDate])),
  rewards: Object.fromEntries(['spring', 'summer', 'autumn', 'winter', 'all'].map(id => [id, oldDate])), readAchievements: originals.map(a => a.id), readRewards: [] };
const lockedMetrics = { runs: 2, summons: 3, stars: 4, obstacles: 4, record: 1, seasons: 2, skins: 14, spring: 0, summer: 0, autumn: 0, winter: 0, all: 0 };
const lockedJournal = { version: 1, runs: 2, summons: 3, stars: 4, obstacles: 4, record: true, seasons: ['spring','summer'], skins: 14,
  achieved: Object.fromEntries(originals.filter(a => lockedMetrics[a.metric] >= a.goal).map(a => [a.id, oldDate])), rewards: {}, readAchievements: [], readRewards: [] };
const save = { version: 4, highScore: 12345, totalStars: 51, coins: 77, selectedSkin: 'white', unlockedSkins: skins.slice(0, 30), upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } };
const report = { passed: false, url, phoneHardware: false, engine: 'Production Edge Chromium mobile touch emulation',
  method: 'Isolated v1 journals exercise actual production touch targets: 44 stamps, twelve new details/read dates, meaningful below-goal locked progress, and one emitted five-stars PNG HTTP failure followed by a real preload touch retry. Browser fixtures never change project source or actual user storage. All twelve assets, including the retried three-runs icon, are integrated.',
  catalog, fixtures: { complete: journal, locked: lockedJournal, save }, views: [], checks: [], errors: [], resourceErrors: [], consoleErrors: [], expectedFailure: { messages: [], requests: [] }, screenshots: [] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const check = (value, label) => { assert(value, label); report.checks.push(label); };
const frames = f => f.page.evaluate(() => new Promise(resolve => { let n = 2; const after = () => { if (!--n) { window.g.events.off('postrender', after); resolve(); } }; window.g.events.on('postrender', after); }));
async function ready(f, scene) { await f.page.waitForFunction(s => window.g?.scene.isActive(s) && window.g.scene.getScene(s).children.list.length, scene); await frames(f); }
async function open(width, height, dpr, fixture = 'complete') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await context.newPage(), f = { context, page, width, height, dpr, fixture, blockHttp: fixture === 'retry', blockedHttp: 0, blockedUrls: [] };
  if (fixture === 'retry') await page.route(/\/assets\/five-stars-[^/]+\.png$/, async route => {
    if (f.blockHttp) { f.blockedHttp++; f.blockedUrls.push(route.request().url()); await route.abort('failed'); }
    else await route.continue();
  });
  page.on('pageerror', e => report.errors.push({ fixture, width, message: e.message }));
  page.on('console', m => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const event = { fixture, width, type: m.type(), message: m.text(), location: m.location() };
    const knownFailure = fixture === 'retry' && f.blockHttp && (m.text().includes('five-stars') || /\/assets\/five-stars-[^/]+\.png$/.test(m.location().url) || (f.blockedHttp > 0 && /^Failed to load resource: net::ERR_FAILED/.test(m.text())));
    if (knownFailure) report.expectedFailure.messages.push(event);
    else if (m.type() === 'error') report.consoleErrors.push(event);
  });
  page.on('requestfailed', r => { const event = { fixture, width, url: r.url(), failure: r.failure()?.errorText }; if (fixture === 'retry' && /\/assets\/five-stars-[^/]+\.png$/.test(r.url()) && f.blockHttp) report.expectedFailure.requests.push(event); else report.resourceErrors.push(event); });
  page.on('response', r => { if (r.status() >= 400) report.resourceErrors.push({ fixture, width, url: r.url(), status: r.status() }); });
  await page.addInitScript(({ fixture, save, journal, lockedJournal, skins, badges }) => {
    if (localStorage.getItem('sheep-run-save') === null) localStorage.setItem('sheep-run-save', JSON.stringify(fixture === 'locked' ? { ...save, unlockedSkins: skins.slice(0, 14) } : save));
    if (localStorage.getItem('sheep-run-journey-v1') === null) localStorage.setItem('sheep-run-journey-v1', JSON.stringify(fixture === 'locked' ? lockedJournal : fixture === 'retry' ? { ...journal, readAchievements: Object.keys(journal.achieved), readRewards: Object.keys(journal.rewards) } : journal));
    if (localStorage.getItem('sheep-run-collections-v1') === null) localStorage.setItem('sheep-run-collections-v1', JSON.stringify({ version: 1, badges: fixture === 'locked' ? [] : badges }));
    if (localStorage.getItem('sheep-run-scenery-v1') === null) localStorage.setItem('sheep-run-scenery-v1', JSON.stringify({ version: 1, seenIds: fixture === 'locked' ? [] : ['rainbow-v1', 'meteors-v1', 'fireflies-v1'] }));
    window.__iconDraws = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      const id = window.__iconSources?.get(image);
      if (id && this.canvas.dataset.adventureOverlay === 'journey-book') window.__iconDraws.push({ id, args, alpha: this.globalAlpha, smoothing: this.imageSmoothingEnabled, transform: this.getTransform().a });
      return draw.call(this, image, ...args);
    };
  }, { fixture, save, journal, lockedJournal, skins, badges });
  const mainRequest = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  f.main = (await mainRequest).url();
  await page.evaluate(async main => window.g = (await import(main)).game.instance, f.main);
  if (fixture === 'retry') await page.waitForFunction(() => window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
  else { await ready(f, 'MenuScene'); await registerSources(f); }
  return f;
}
async function registerSources(f) {
  const facts = await f.page.evaluate(ids => { window.__iconSources = new WeakMap(); return ids.map(id => { const key = `achievement-icon-${id}`, exists = window.g.textures.exists(key), source = exists ? window.g.textures.get(key).getSourceImage() : null; if (source) window.__iconSources.set(source, id); return { id, key, exists, width: source?.width, height: source?.height }; }); }, catalog.map(a => a.id));
  for (const icon of facts) check(icon.exists && icon.width === 32 && icon.height === 32, `${f.width} ${f.fixture}: native 32x32 ${icon.id}`);
  return facts;
}
async function target(f, sceneName, name) {
  return f.page.evaluate(({ sceneName, name }) => { const scene = window.g.scene.getScene(sceneName), o = scene.children.getByName(name); if (!o) throw Error(`Missing ${sceneName} ${name}`); const b = o.getBounds(), r = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize; return { x: r.x + (b.centerX - scene.cameras.main.scrollX * o.scrollFactorX) * r.width / z.width, y: r.y + (b.centerY - scene.cameras.main.scrollY * o.scrollFactorY) * r.height / z.height }; }, { sceneName, name });
}
async function tap(f, sceneName, name) { await f.page.evaluate(() => window.__iconDraws = []); const point = await target(f, sceneName, name); await f.page.touchscreen.tap(point.x, point.y); await frames(f); }
const data = f => f.page.locator('[data-adventure-overlay="journey-book"]').evaluate(c => ({ ...c.dataset }));
const journalState = f => f.page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-journey-v1')));
const storageValues = f => f.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
const paging = f => f.page.evaluate(() => { const scene = window.g.scene.getScene('MenuScene'); return { prev: scene.children.getByName('journey-prev').input.enabled, next: scene.children.getByName('journey-next').input.enabled }; });
const menuStates = f => f.page.evaluate(() => { const scene = window.g.scene.getScene('MenuScene'), own = /^(journey-|achievement-card:|button:合上手账)/, values = {}; const visit = (objects, prefix = '') => objects.forEach((o, i) => { const name = `${prefix}${o.name || o.type + ':' + i}`; if (o.input && !own.test(o.name || '')) values[name] = o.input.enabled; if (Array.isArray(o.list)) visit(o.list, name + '/'); }); visit(scene.children.list); return values; });
async function shot(f, name) { const file = `screenshots/${f.width}x${f.height}-dpr${f.dpr}-${f.fixture}-${name}.png`; await f.page.screenshot({ path: fileURLToPath(new URL(file, output)), scale: 'css' }); report.screenshots.push(file); }
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
async function rendered(f, ids, size, alpha, label) {
  const draws = await f.page.evaluate(n => window.__iconDraws.slice(-n), ids.length), state = await data(f), panel = JSON.parse(state.panel), k = panel.width / 430, lines = JSON.parse(state.lines);
  check(draws.length === ids.length, `${f.width} ${label}: all ${ids.length} expected icons actually drawn`);
  for (let i = 0; i < ids.length; i++) {
    const icon = draws[i], a = icon.args, box = { x: a[4], y: a[5], width: a[6], height: a[7] };
    check(icon.id === ids[i] && a[0] === 0 && a[1] === 0 && a[2] === 32 && a[3] === 32, `${f.width} ${label}: native full source ${ids[i]}`);
    check(!icon.smoothing && Math.abs(icon.alpha - alpha) < .0001, `${f.width} ${label}: crisp pixels opacity ${alpha} ${ids[i]}`);
    check(Math.abs(box.width - size * k) < .001 && Math.abs(box.height - size * k) < .001, `${f.width} ${label}: uniform ${size}px aspect ${ids[i]}`);
    check(icon.transform > 0 && lines.every(line => !overlaps(box, line.ink)), `${f.width} ${label}: ${ids[i]} avoids actual text/button ink`);
    check(box.x >= panel.x && box.y >= panel.y && box.x + box.width <= panel.x + panel.width && box.y + box.height <= panel.y + panel.height, `${f.width} ${label}: ${ids[i]} inside book`);
  }
  for (const line of lines) check(line.ink.x >= line.box.x - 1 && line.ink.y >= line.box.y - 1 && line.ink.x + line.ink.width <= line.box.x + line.box.width + 1 && line.ink.y + line.ink.height <= line.box.y + line.box.height + 1, `${f.width} ${label}: fitted text ${line.text}`);
  return draws;
}
function assertDates(state, label) {
  for (const achievement of originals) check(state.achieved[achievement.id] === oldDate, `${label}: retains old date ${achievement.id}`);
  for (const achievement of additions) check(state.achieved[achievement.id] === newDate, `${label}: retains new date ${achievement.id}`);
}
try {
  for (const [width, height, dpr] of [[480, 270, 1], [896, 414, 2], [800, 600, 1], [1672, 941, 1]]) {
    const f = await open(width, height, dpr), view = { width, height, dpr, main: f.main, cards: [], details: [] };
    report.views.push(view);
    const initialSave = await f.page.evaluate(() => localStorage.getItem('sheep-run-save')), initialStates = await menuStates(f);
    check((await data(f)).unread === 'true', `${width}: twelve unread additions mark entry`);
    const before = await journalState(f); check(before.readAchievements.length === 32 && additions.every(a => !before.readAchievements.includes(a.id)), `${width}: old thirty-two read, new twelve unread`); assertDates(before, `${width} initial`);
    await tap(f, 'MenuScene', 'button:成就册');
    check(Object.values(await menuStates(f)).every(value => value === false), `${width}: all underlying menu inputs blocked`);
    const surface = await f.page.locator('[data-adventure-overlay="journey-book"]').evaluate(c => ({ width: c.width, height: c.height, cssWidth: parseFloat(c.style.width), cssHeight: parseFloat(c.style.height), dpr: window.devicePixelRatio }));
    check(surface.width === Math.round(surface.cssWidth * dpr) && surface.height === Math.round(surface.cssHeight * dpr), `${width}: physical display canvas matches DPR ${dpr}`); view.surface = surface;
    check(!(await paging(f)).prev && (await paging(f)).next, `${width}: first-page previous disabled`);
    await tap(f, 'MenuScene', 'journey-prev'); check((await data(f)).page === '0', `${width}: disabled previous cannot leave first page`);
    for (let page = 0; page < pages; page++) {
      if (page) await tap(f, 'MenuScene', 'journey-next');
      const pageCatalog = catalog.slice(page * 4, page * 4 + 4);
      if (!page) { await tap(f, 'MenuScene', 'button:合上手账'); await tap(f, 'MenuScene', 'button:成就册'); }
      view.cards.push(...await rendered(f, pageCatalog.map(a => a.id), 30, 1, `page-${page + 1}`));
      check((await data(f)).page === String(page), `${width}: page ${page + 1}/${pages + 1} exact`);
      const rows = JSON.parse((await data(f)).lines).map(line => line.text);
      check(rows.some(row => row.includes(`点亮 ${catalog.length} / ${catalog.length}`) && row.includes(`第 ${page + 1} / ${pages + 1} 页`)), `${width}: exact 44-stamp twelve-page counter`);
      const cardEnabled = await f.page.evaluate(() => [0, 1, 2, 3].map(index => window.g.scene.getScene('MenuScene').children.getByName(`achievement-card:${index}`).input.enabled));
      check(cardEnabled.every(value => value), `${width}: page ${page + 1} four real cards are enabled`);
      await shot(f, `page-${page + 1}`);
      if (page < originals.length / 4) continue;
      for (let card = 0; card < pageCatalog.length; card++) {
        const achievement = pageCatalog[card]; await tap(f, 'MenuScene', `achievement-card:${card}`);
        view.details.push(...await rendered(f, [achievement.id], 44, 1, `detail-${achievement.id}`));
        const detail = await data(f), text = JSON.parse(detail.lines).map(line => line.text);
        check(detail.mode === 'detail' && text.includes(achievement.name) && text.includes(achievement.condition) && text.join('').includes(achievement.message), `${width}: ${achievement.id} exact detail text`);
        check(text.includes(`达成日期 ${newDate}`) && (await journalState(f)).readAchievements.includes(achievement.id), `${width}: ${achievement.id} touch changes unread to read with saved date`);
        await shot(f, `detail-${achievement.id}`);
        await tap(f, 'MenuScene', 'button:合上手账'); check((await data(f)).page === String(page) && (await data(f)).mode === 'achievements', `${width}: ${achievement.id} returns to same stamp page`);
      }
    }
    check(new Set(view.cards.map(draw => draw.id)).size === catalog.length && new Set(view.details.map(draw => draw.id)).size === additions.length, `${width}: every stamp and new detail actually rendered`);
    await tap(f, 'MenuScene', 'journey-next');
    check((await data(f)).page === String(pages) && JSON.parse((await data(f)).lines).some(line => line.text === '风景明信片'), `${width}: scenery remains page ${pages + 1} final page`);
    check((await paging(f)).prev && !(await paging(f)).next, `${width}: last-page next disabled`);
    await tap(f, 'MenuScene', 'journey-next'); check((await data(f)).page === String(pages), `${width}: disabled next cannot leave last page`); await shot(f, `page-${pages + 1}-scenery`);
    await tap(f, 'MenuScene', 'achievement-card:0'); check((await data(f)).mode === 'postcard', `${width}: final scenery still opens`); await shot(f, 'scenery-postcard');
    await tap(f, 'MenuScene', 'button:合上手账'); await tap(f, 'MenuScene', 'button:合上手账');
    check((await data(f)).open === 'false' && (await data(f)).unread === 'false', `${width}: closed book clears twelve unread markers`);
    check(JSON.stringify(await menuStates(f)) === JSON.stringify(initialStates), `${width}: close restores original menu input states`);
    check(await f.page.evaluate(() => localStorage.getItem('sheep-run-save')) === initialSave, `${width}: achievement viewing preserves main save byte-for-byte`);
    const read = await journalState(f); check(read.readAchievements.length === catalog.length && catalog.every(a => read.readAchievements.includes(a.id)), `${width}: all twelve new read markers persisted`); assertDates(read, `${width} after viewing`);
    await f.page.reload(); await f.page.evaluate(async main => window.g = (await import(main)).game.instance, f.main); await ready(f, 'MenuScene'); await registerSources(f);
    const reloaded = await journalState(f); check(reloaded.readAchievements.length === catalog.length && (await data(f)).unread === 'false', `${width}: read state survives reload`); assertDates(reloaded, `${width} reload`);
    check(await f.page.evaluate(() => localStorage.getItem('sheep-run-save')) === initialSave, `${width}: reload preserves main save byte-for-byte`);
    await tap(f, 'MenuScene', 'button:成就册'); for (let page = 0; page < pages - 1; page++) await tap(f, 'MenuScene', 'journey-next');
    await rendered(f, catalog.slice((pages - 1) * 4, pages * 4).map(a => a.id), 30, 1, `reloaded-new-page-${pages}`); await shot(f, `after-reload-page-${pages}`);
    await f.context.close(); console.log(JSON.stringify({ width, height, dpr, stamps: catalog.length, newDetails: additions.length }));
  }
  const locked = await open(896, 414, 2, 'locked'), lockedBefore = await journalState(locked), lockedSave = await locked.page.evaluate(() => localStorage.getItem('sheep-run-save'));
  await tap(locked, 'MenuScene', 'button:成就册');
  for (let page = 0; page < pages; page++) {
    if (page) await tap(locked, 'MenuScene', 'journey-next'); if (page < 8) continue;
    const pageCatalog = catalog.slice(page * 4, page * 4 + 4);
    await rendered(locked, pageCatalog.map(a => a.id), 30, .5, `locked-page-${page + 1}`);
    const text = JSON.parse((await data(locked)).lines).map(line => line.text);
    for (const achievement of pageCatalog) check(text.includes(`进度 ${lockedMetrics[achievement.metric]} / ${achievement.goal}`), `locked ${achievement.id}: real below-threshold progress`);
    await shot(locked, `page-${page + 1}`);
    for (let card = 0; card < pageCatalog.length; card++) {
      const achievement = pageCatalog[card]; await tap(locked, 'MenuScene', `achievement-card:${card}`);
      await rendered(locked, [achievement.id], 44, .5, `locked-detail-${achievement.id}`);
      check(JSON.parse((await data(locked)).lines).some(line => line.text === `进度 ${lockedMetrics[achievement.metric]} / ${achievement.goal}`), `locked ${achievement.id}: detail keeps actual progress`);
      const current = await journalState(locked); check(!current.achieved[achievement.id] && !current.readAchievements.includes(achievement.id), `locked ${achievement.id}: touch cannot forge unlock or read marker`);
      await shot(locked, `detail-${achievement.id}`); await tap(locked, 'MenuScene', 'button:合上手账'); check((await data(locked)).page === String(page), `locked ${achievement.id}: detail returns same page`);
    }
  }
  const lockedAfter = await journalState(locked);
  check(JSON.stringify(lockedAfter) === JSON.stringify(lockedBefore), 'locked browsing changes no journal values');
  check(await locked.page.evaluate(() => localStorage.getItem('sheep-run-save')) === lockedSave, 'locked browsing changes no main save values'); await locked.context.close();
  const retry = await open(896, 414, 2, 'retry'); report.retry = { main: retry.main };
  const beforeRetry = await storageValues(retry), blockedLoads = retry.blockedHttp;
  report.retry.blockedHttp = blockedLoads; report.retry.blockedUrls = [...new Set(retry.blockedUrls)];
  check(blockedLoads >= 1 && report.retry.blockedUrls.length === 1, 'isolated HTTP blocks only five-stars PNG through normal loader attempts');
  check(await retry.page.evaluate(() => !window.g.textures.exists('achievement-icon-five-stars') && !window.g.scene.isActive('MenuScene') && !!window.g.scene.getScene('PreloadScene').children.getByName('button:重试')), 'missing new stamp uses real local preload error with touch retry');
  await shot(retry, 'preload-failure'); retry.blockHttp = false; await tap(retry, 'PreloadScene', 'button:重试'); await ready(retry, 'MenuScene'); report.retry.textureFacts = await registerSources(retry);
  check(retry.blockedHttp === blockedLoads, 'released HTTP fixture allows real touch retry without new blockage');
  check(JSON.stringify(await storageValues(retry)) === JSON.stringify(beforeRetry), 'real retry preserves every localStorage key and value exactly');
  const retriedIndex = catalog.findIndex(achievement => achievement.id === 'five-stars'), retriedPage = Math.floor(retriedIndex / 4);
  await tap(retry, 'MenuScene', 'button:成就册'); for (let page = 0; page < retriedPage; page++) await tap(retry, 'MenuScene', 'journey-next');
  await rendered(retry, catalog.slice(retriedPage * 4, retriedPage * 4 + 4).map(a => a.id), 30, 1, `retried-new-page-${retriedPage + 1}`); await tap(retry, 'MenuScene', `achievement-card:${retriedIndex % 4}`); await rendered(retry, ['five-stars'], 44, 1, 'retried-five-stars-detail'); await shot(retry, 'preload-retry-success'); await retry.context.close();
  check(new Set([...report.views.map(view => view.main), report.retry.main]).size === 1, 'all browser scenarios use the same actual production main bundle');
  check(report.errors.length === 0, 'no browser runtime exceptions'); check(report.resourceErrors.length === 0, 'no unexpected failed resources'); check(report.consoleErrors.length === 0, 'no unexpected browser console errors'); report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' }).catch(() => {});
  throw error;
} finally { await writeFile(new URL('browser-review.json', output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, resourceErrors: report.resourceErrors }));

