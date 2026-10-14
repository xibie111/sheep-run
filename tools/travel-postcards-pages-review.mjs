import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.TRAVEL_POSTCARDS_UI_QA_URL || 'http://127.0.0.1:4360/';
const out = process.env.TRAVEL_POSTCARDS_UI_QA_OUT || 'docs/travel-postcards-v2/final-ui-browser';
const expectedMain = process.env.TRAVEL_POSTCARDS_UI_QA_MAIN || 'main-CEyfZHby.js';
await mkdir(`${out}/screenshots`, { recursive: true });
const source = await readFile('src/scenery/sceneryCatalog.ts', 'utf8');
const catalog = [...source.matchAll(/\{ id: '([^']+)', title: '([^']+)', hint: '([^']+)', message: '([^']+)', art: '([^']+)' \}/g)]
  .map(m => ({ id: m[1], title: m[2], hint: m[3], message: m[4], art: m[5] }));
assert.equal(catalog.length, 9, 'nine production postcards');
const fixture = { version: 1, seenIds: [...catalog.map(c => c.id), 'future-id'] };
const report = { passed: false, url, engine: 'Edge Chromium mobile touch emulation / real production WebGL', phoneHardware: false,
  method: 'Eight sequential disposable contexts at four viewports and DPR1/2. Only sheep-run-scenery-v1 is initialized with existing three, new six and future-id already seen. Real touchscreen activates production menu/cards/buttons. drawImage interception observes actual postcard art and nearest-neighbor/aspect behavior. CDP touchCancel exercises actual input cancellation; real viewport changes preserve active detail/page. No user browser profile or user save touched. This is an isolated-store UI fixture, not natural postcard discovery. Root owns separate observer/resource failure QA.',
  notApplicable: ['Settings modal: current production menu has no settings entry or SettingsScene. No new settings functionality is introduced.'],
  fixture, catalog, profiles: [], checks: [], screenshots: [], errors: [], resourceErrors: [], consoleErrors: [], expectedConsoleDiagnostics: [] };
const check = (ok, label) => { assert(ok, label); report.checks.push(label); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const tag = f => `${f.width}x${f.height}/DPR${f.dpr}`;
async function frames(f) { await f.page.evaluate(() => new Promise(resolve => { let n = 2; const after = () => { if (!--n) { window.g.events.off('postrender', after); resolve(); } }; window.g.events.on('postrender', after); })); }
async function ready(f) { await f.page.waitForFunction(() => window.g?.scene.isActive('MenuScene') && window.g.scene.getScene('MenuScene').children.list.length); await frames(f); }
const data = f => f.page.locator('[data-adventure-overlay="journey-book"]').evaluate(c => ({ ...c.dataset }));
async function point(f, name) { return f.page.evaluate(name => { const s = window.g.scene.getScene('MenuScene'), target = s.children.getByName(name); if (!target) throw Error(`Missing ${name}`); const b = target.getBounds(), r = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize; return { x: r.x + (b.centerX - s.cameras.main.scrollX * target.scrollFactorX) * r.width / size.width, y: r.y + (b.centerY - s.cameras.main.scrollY * target.scrollFactorY) * r.height / size.height }; }, name); }
async function tap(f, name) { await f.page.evaluate(() => window.__postcardDraws = []); const p = await point(f, name); await f.page.touchscreen.tap(p.x, p.y); await frames(f); }
const inputs = f => f.page.evaluate(() => { const s = window.g.scene.getScene('MenuScene'), result = {}; const visit = (objects, prefix = '') => objects.forEach((o, i) => { const name = prefix + (o.name || o.type + ':' + i); if (o.input && !/^(journey-|achievement-card:|button:合上手账)/.test(o.name || '')) result[name] = o.input.enabled; if (Array.isArray(o.list)) visit(o.list, name + '/'); }); visit(s.children.list); return result; });
const paging = f => f.page.evaluate(() => { const s = window.g.scene.getScene('MenuScene'); return { prev: s.children.getByName('journey-prev').input.enabled, next: s.children.getByName('journey-next').input.enabled }; });
const sceneryRaw = f => f.page.evaluate(() => localStorage.getItem('sheep-run-scenery-v1'));
async function shot(f, label) { const file = `screenshots/${f.width}x${f.height}-dpr${f.dpr}-${label}.png`; await f.page.screenshot({ path: `${out}/${file}`, scale: 'css' }); report.screenshots.push(file); }
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
async function rendered(f, cards, label) {
  const state = await data(f), panel = JSON.parse(state.panel), lines = JSON.parse(state.lines);
  const draws = await f.page.evaluate(n => window.__postcardDraws.slice(-n), cards.length);
  check(draws.length === cards.length, `${tag(f)} ${label}: every expected art actually drawn`);
  for (let i = 0; i < cards.length; i++) {
    const draw = draws[i], a = draw.args, box = { x: a[4], y: a[5], width: a[6], height: a[7] };
    check(draw.id === cards[i].id && a[0] === 0 && a[1] === 0 && a[2] === 600 && a[3] === 400, `${tag(f)} ${label}: full source of ${cards[i].id}`);
    check(!draw.smoothing && draw.alpha === 1 && draw.transform > 0, `${tag(f)} ${label}: opaque nearest-neighbor ${cards[i].id}`);
    check(Math.abs(box.width / box.height - 1.5) < .0001, `${tag(f)} ${label}: ${cards[i].id} aspect retained`);
    check(box.x >= panel.x - .1 && box.y >= panel.y - .1 && box.x + box.width <= panel.x + panel.width + .1 && box.y + box.height <= panel.y + panel.height + .1, `${tag(f)} ${label}: ${cards[i].id} fits book`);
    check(lines.every(line => !overlaps(box, line.ink)), `${tag(f)} ${label}: ${cards[i].id} does not cover any text`);
  }
  check(lines.every(line => line.ink.x >= line.box.x - 1 && line.ink.y >= line.box.y - 1 && line.ink.x + line.ink.width <= line.box.x + line.box.width + 1 && line.ink.y + line.ink.height <= line.box.y + line.box.height + 1), `${tag(f)} ${label}: every actual text ink fits its line box`);
  check(lines.every(line => line.ink.x >= panel.x - 1 && line.ink.y >= panel.y - 1 && line.ink.x + line.ink.width <= panel.x + panel.width + 1 && line.ink.y + line.ink.height <= panel.y + panel.height + 1), `${tag(f)} ${label}: all text inside book`);
  return { state, lines, draws };
}
async function go(f, page) { let state = await data(f); while (Number(state.page) !== page) { await tap(f, Number(state.page) < page ? 'journey-next' : 'journey-prev'); state = await data(f); } }
async function open(width, height, dpr) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await context.newPage(), f = { context, page, width, height, dpr };
  page.on('pageerror', e => report.errors.push({ profile: tag(f), message: e.message }));
  page.on('console', e => { if (e.type() !== 'error') return; const diagnostic = { profile: tag(f), message: e.text() }; if (/Ignored attempt to cancel a touchcancel event with cancelable=false/.test(e.text())) report.expectedConsoleDiagnostics.push(diagnostic); else report.consoleErrors.push(diagnostic); });
  page.on('requestfailed', r => report.resourceErrors.push({ profile: tag(f), url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) report.resourceErrors.push({ profile: tag(f), url: r.url(), status: r.status() }); });
  await page.addInitScript(fixture => {
    if (localStorage.getItem('sheep-run-scenery-v1') === null) localStorage.setItem('sheep-run-scenery-v1', JSON.stringify(fixture));
    window.__postcardDraws = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      const id = window.__postcardSources?.get(image);
      if (id && this.canvas.dataset.adventureOverlay === 'journey-book') window.__postcardDraws.push({ id, args, smoothing: this.imageSmoothingEnabled, alpha: this.globalAlpha, transform: this.getTransform().a });
      return draw.call(this, image, ...args);
    };
  }, fixture);
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js$/.test(r.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); f.main = (await request).url();
  check(f.main.endsWith(`/${expectedMain}`), `${tag(f)}: frozen intended production build`);
  await page.evaluate(async main => window.g = (await import(main)).game.instance, f.main);
  await ready(f);
  const textures = await page.evaluate(catalog => { window.__postcardSources = new WeakMap(); return catalog.map(card => { const exists = window.g.textures.exists(card.art), source = exists ? window.g.textures.get(card.art).getSourceImage() : null; if (source) window.__postcardSources.set(source, card.id); return { id: card.id, exists, width: source?.width, height: source?.height }; }); }, catalog);
  check(textures.every(t => t.exists && t.width === 600 && t.height === 400), `${tag(f)}: all nine 600x400 textures loaded`);
  check(await page.evaluate(() => !!window.g.renderer.gl), `${tag(f)}: actual WebGL renderer`);
  return f;
}

try {
  for (const dpr of [1, 2]) for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) {
    const f = await open(width, height, dpr), view = { width, height, dpr, main: f.main, pages: [], details: [] }; report.profiles.push(view);
    const initialInputs = await inputs(f), raw = await sceneryRaw(f);
    await tap(f, 'button:成就册');
    check(Object.values(await inputs(f)).every(v => !v), `${tag(f)}: opening book disables every underlying touch target`);
    const base = await data(f), firstScenery = Number(base.sceneryStartPage), total = Number(base.totalPages);
    check(Number(base.sceneryPages) === 3 && total === firstScenery + 3, `${tag(f)}: catalogue drives three scenery pages`);
    const surface = await f.page.locator('[data-adventure-overlay="journey-book"]').evaluate(c => ({ width: c.width, height: c.height, cssWidth: parseFloat(c.style.width), cssHeight: parseFloat(c.style.height), dpr: window.devicePixelRatio }));
    check(surface.width === Math.round(surface.cssWidth * dpr) && surface.height === Math.round(surface.cssHeight * dpr), `${tag(f)}: display canvas matches physical DPR`); view.surface = surface;
    for (let local = 0; local < 3; local++) {
      await go(f, firstScenery + local);
      const expected = catalog.slice(local * 4, local * 4 + 4), shown = await rendered(f, expected, `scenery-page-${local + 1}`), current = shown.state;
      check(JSON.stringify(JSON.parse(current.visibleCards)) === JSON.stringify(expected.map(c => c.id)), `${tag(f)}: page ${local + 1} drawn indices exactly match catalogue`);
      check(JSON.stringify(JSON.parse(current.cardTargets)) === JSON.stringify(Array.from({ length: 4 }, (_, i) => i < expected.length)), `${tag(f)}: page ${local + 1} targets match only real cards`);
      check(shown.lines.some(l => l.text === `已遇见 9 / 9 · 第 ${firstScenery + local + 1} / ${total} 页`), `${tag(f)}: page ${local + 1} exact nine-card progress and page counter`);
      check(expected.every(c => shown.lines.some(l => l.text === c.title)), `${tag(f)}: page ${local + 1} exact card titles`);
      view.pages.push({ page: firstScenery + local, visibleCards: JSON.parse(current.visibleCards), targets: JSON.parse(current.cardTargets), draws: shown.draws });
      if (width === 480 && dpr === 1 || local === 2) await shot(f, `scenery-page-${local + 1}`);
      for (let slot = 0; slot < expected.length; slot++) {
        const card = expected[slot]; if (!catalog.slice(3).some(c => c.id === card.id)) continue;
        const parentPage = Number((await data(f)).page); await tap(f, `achievement-card:${slot}`);
        const detail = await rendered(f, [card], `detail-${card.id}`), rows = detail.lines;
        check(detail.state.mode === 'postcard' && Number(detail.state.postcard) === local * 4 + slot, `${tag(f)}: ${card.id} actual touched slot opens correct global card`);
        check(rows[0].text === card.title && rows.slice(1, -2).map(l => l.text).join('') === card.message, `${tag(f)}: ${card.id} exact title and entire unchanged message`);
        if (width === 480 && dpr === 1 || slot === 0) await shot(f, `detail-${card.id}`);
        if (card.id === catalog[3].id) {
          const changedSize = width === 800 ? { width: 896, height: 414 } : { width: 800, height: 600 };
          await f.page.evaluate(() => window.__postcardDraws = []); await f.page.setViewportSize(changedSize); await f.page.waitForTimeout(150); await frames(f);
          const resized = await rendered(f, [card], `resized-detail-${card.id}`);
          check(resized.state.mode === 'postcard' && Number(resized.state.postcard) === local * 4 + slot && Number(resized.state.page) === parentPage, `${tag(f)}: viewport resize preserves active detail and original page`);
          await f.page.setViewportSize({ width, height }); await f.page.waitForTimeout(150); await frames(f);
        }
        await tap(f, 'button:合上手账'); const returned = await data(f);
        check(returned.mode === 'achievements' && Number(returned.page) === parentPage && JSON.stringify(JSON.parse(returned.visibleCards)) === JSON.stringify(expected.map(c => c.id)), `${tag(f)}: ${card.id} returns to its original page`);
        view.details.push({ id: card.id, parentPage, lines: rows.map(l => l.text), draws: detail.draws });
      }
    }
    check(!(await paging(f)).next, `${tag(f)}: last page next target disabled`);
    const lastPage = Number((await data(f)).page);
    await tap(f, 'achievement-card:1');
    check((await data(f)).mode === 'achievements' && Number((await data(f)).page) === lastPage, `${tag(f)}: tapping last-page empty cell cannot open phantom card`);
    const cancel = await point(f, 'journey-prev'), cdp = await f.context.newCDPSession(f.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancel.x, y: cancel.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await frames(f);
    check(Number((await data(f)).page) === lastPage, `${tag(f)}: OS touchCancel does not turn page`); await cdp.detach();
    await go(f, firstScenery); const rapid = await point(f, 'journey-next');
    for (let i = 0; i < 6; i++) await f.page.touchscreen.tap(rapid.x, rapid.y); await frames(f);
    check(Number((await data(f)).page) === total - 1 && (await data(f)).mode === 'achievements' && !(await paging(f)).next, `${tag(f)}: rapid touch navigation stops safely at last page`);
    await tap(f, 'button:合上手账');
    check((await data(f)).open === 'false' && JSON.stringify(await inputs(f)) === JSON.stringify(initialInputs), `${tag(f)}: close restores exact original underlying input states`);
    await tap(f, 'button:收藏册');
    check(await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('collection-album-open') === true && !window.g.scene.getScene('MenuScene').children.getByName('button:成就册').input.enabled), `${tag(f)}: collection modal mutually excludes journal`);
    await tap(f, 'button:合上收藏册'); await tap(f, 'mailbox-entry');
    check(await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'mailbox' && !window.g.scene.getScene('MenuScene').children.getByName('button:成就册').input.enabled), `${tag(f)}: mailbox modal mutually excludes journal`);
    await tap(f, 'button:合上邮箱');
    for (let i = 0; i < 3; i++) await tap(f, 'easter-egg:sheep');
    check(await f.page.evaluate(() => window.g.scene.getScene('MenuScene').data.get('menu-modal-owner') === 'private-letter' && !window.g.scene.getScene('MenuScene').children.getByName('button:成就册').input.enabled), `${tag(f)}: private letter mutually excludes journal`);
    await tap(f, 'button:收下这份喜欢');
    check(JSON.stringify(await inputs(f)) === JSON.stringify(initialInputs), `${tag(f)}: other modals close with exact original input state`);
    check(await sceneryRaw(f) === raw, `${tag(f)}: all opening/flipping/reading leaves postcard record and unknown ID unchanged`);
    const saveBeforeRefresh = await f.page.evaluate(() => localStorage.getItem('sheep-run-save'));
    await f.page.reload({ waitUntil: 'domcontentloaded' }); await f.page.evaluate(async main => window.g = (await import(main)).game.instance, f.main); await ready(f);
    check(await sceneryRaw(f) === raw && JSON.parse(await sceneryRaw(f)).seenIds.includes('future-id'), `${tag(f)}: refresh retains all old/new and future postcard IDs`);
    check(await f.page.evaluate(() => localStorage.getItem('sheep-run-save')) === saveBeforeRefresh, `${tag(f)}: postcard UI does not mutate main game save`);
    check(await f.page.locator('[data-adventure-overlay="journey-book"]').count() === 1, `${tag(f)}: refresh has one journal display surface`);
    await f.context.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
  check(report.errors.length === 0 && report.consoleErrors.length === 0 && report.resourceErrors.length === 0, 'No unexpected runtime, font, console or resource failures'); report.passed = true;
} catch (error) { report.failure = error.stack || String(error); throw error; }
finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, profiles: report.profiles.length, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors.length, resources: report.resourceErrors.length }));
