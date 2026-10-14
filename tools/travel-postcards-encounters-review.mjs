import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.POSTCARD_ENCOUNTER_QA_URL ?? 'http://127.0.0.1:4359/';
const out = process.env.POSTCARD_ENCOUNTER_QA_OUT ?? 'docs/travel-postcards-v2/encounter-browser';
await mkdir(`${out}/screenshots`, { recursive: true });
const report = { passed: false, url, phoneHardware: false, browser: 'Edge headless mobile touch / actual WebGL', profiles: [], fixtures: [], checks: [], errors: [], screenshots: [],
  earlierHarnessReports: ['docs/travel-postcards-v2/encounter-browser/report-initial-monitor-order.json',
    'docs/travel-postcards-v2/encounter-browser/report-initial-phaser-size-getters.json'],
  method: 'Natural starts use untouched gameplay/environment/collision/random sources and real touchscreen controls. Other-card fixtures freeze only the isolated scene update and Arcade world, render real seasonal textures and real AmbientLifeController/AnimalView; actual renderer prerender/postrender passes and capped real frame delta drive the production observer. No direct discover call, synthetic observer facts, user profile, production fixture or default dist mutation.' };
const check = (value, label) => { assert.ok(value, label); report.checks.push(label); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function frames(page, count = 2) { await page.evaluate(count => new Promise(resolve => { const listener = () => { if (!--count) { window.g.events.off('postrender', listener); resolve(); } }; window.g.events.on('postrender', listener); }), count); }
async function ready(page, scene) { await page.waitForFunction(scene => window.g.scene.isActive(scene) && window.g.scene.getScene(scene).children.list.length, scene); await frames(page); }
async function tap(page, scene, name) {
  const point = await page.evaluate(({ scene, name }) => { const s = window.g.scene.getScene(scene); const find = list => { for (const object of list) { if (object.name === name) return object; const child = object.list && find(object.list); if (child) return child; } }; const object = find(s.children.list); if (!object?.input?.enabled) throw new Error(`Missing enabled target ${scene}/${name}`); const b = object.getBounds(), r = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize; return { x: r.x + (b.centerX - s.cameras.main.scrollX * object.scrollFactorX) * r.width / size.width, y: r.y + (b.centerY - s.cameras.main.scrollY * object.scrollFactorY) * r.height / size.height }; }, { scene, name });
  await page.touchscreen.tap(point.x, point.y); await frames(page);
}
async function setup(width, height, dpr, reduced = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  const request = page.waitForRequest(request => /\/assets\/main-[^/]+\.js$/.test(request.url()));
  await page.goto(url); const main = (await request).url();
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; window.__discoveries = []; window.__lastSeen = []; window.__monitor = () => {
    const s = window.g.scene.getScene('RunScene'); if (!window.g.scene.isActive('RunScene') || !s.travelPostcards) return;
    const seen = JSON.parse(localStorage.getItem('sheep-run-scenery-v1') ?? '{"seenIds":[]}').seenIds;
    for (const id of seen) if (!window.__lastSeen.includes(id)) window.__discoveries.push({ id, activeMs: s.activeRunTimeMs, exposureMs: s.travelPostcards.exposure.elapsed.get(id), rendered: s.cameras.main.renderList.map(o => ({ name: o.name, key: o.texture?.key, alpha: o.alpha })) });
    window.__lastSeen = seen;
  }; window.g.events.on('postrender', window.__monitor); }, main);
  await ready(page, 'MenuScene'); await tap(page, 'MenuScene', 'button:开始游戏'); await ready(page, 'RunScene');
  return { context, page, main, width, height, dpr, reduced };
}
async function state(page) { return page.evaluate(() => { const s = window.g.scene.getScene('RunScene'), c = s.travelPostcards; return { now: s.activeRunTimeMs, reduced: s.reducedMotion, landscape: s.environmentSystem?.presentation(), seen: JSON.parse(localStorage.getItem('sheep-run-scenery-v1') ?? '{"seenIds":[]}').seenIds, elapsed: c ? [...c.exposure.elapsed] : [], completed: c ? [...c.exposure.completed] : [], listenerCount: window.g.events.listenerCount('postrender'), ownListeners: c ? window.g.events.listeners('postrender').filter(fn => fn === c.afterRender).length : 0, discoveries: window.__discoveries, webgl: !!window.g.renderer.gl, paused: window.g.scene.isPaused('RunScene'), fixture: window.__fixture ? { ageMs: window.__fixture.ageMs, kind: s.ambientLife?.snapshot().kind } : null, rendered: s.cameras.main.renderList.map(o => ({ name: o.name, key: o.texture?.key, alpha: o.alpha, bounds: o.getBounds ? o.getBounds() : null })) }; }); }
async function screenshot(page, name) { await page.screenshot({ path: `${out}/screenshots/${name}`, scale: 'css' }); report.screenshots.push(`screenshots/${name}`); }
async function prepareFixture(page, kind) {
  return page.evaluate(kind => {
    const s = window.g.scene.getScene('RunScene'); s.update = () => {}; s.sys.sceneUpdate = s.update; s.physics.pause();
    for (const group of [s.obstacles, s.stars, s.powerUps]) for (const object of group.getChildren()) object.deactivate();
    s.rareScenery?.clear(); s.landmarks?.clear(); s.companions?.clear(); s.journeyToast?.clear();
    const Life = s.ambientLife.constructor; s.ambientLife.clear();
    s.ambientLife = new Life(s, s.reducedMotion, kind === 'rabbit-butterfly' ? 10000 : 41);
    const season = kind === 'summer-pond-v1' ? 'summer' : kind === 'autumn-sunset-v1' ? 'autumn' : kind === 'winter-sunshine-v1' ? 'winter' : 'spring';
    // Sunset plus an exact panorama repeat places the true animal anchors on screen.
    // The high distance is an isolated view fixture, not ordinary progression.
    const distance = ['duck-family', 'rabbit-butterfly'].includes(kind) ? s.environmentSystem.presentation().nearRepeatWidth / .24 * 4 : kind === 'autumn-sunset-v1' ? 7000 : 0;
    s.environmentSystem.setTheme(season); s.environmentSystem.setWeather('sunny'); s.environmentSystem.update(distance, 0, s.scoreSystem.score);
    const landscape = s.environmentSystem.presentation();
    const isAnimal = kind === 'duck-family' || kind === 'rabbit-butterfly';
    s.ambientLife.update({ nowMs: isAnimal ? 20000 : 0, speed: 190, viewport: window.g.scale.gameSize, landscape, obstacles: [] });
    window.__fixture = { ageMs: 0, kind, baseMs: isAnimal ? 20000 : 0, landscape };
    window.__fixture.tick = () => {
      if (window.g.scene.isPaused('RunScene') || !window.g.scene.isActive('RunScene')) return;
      const f = window.__fixture, deltaMs = Math.max(0, Math.min(40, window.g.loop.delta)); f.ageMs += deltaMs;
      s.ambientLife.update({ nowMs: f.baseMs + f.ageMs, speed: 190, viewport: window.g.scale.gameSize, landscape: f.landscape, obstacles: [] });
      s.travelPostcards.update({ deltaMs, landscape: f.landscape, viewport: { width: window.g.scale.gameSize.width, height: window.g.scale.gameSize.height }, animalKind: s.ambientLife.snapshot().kind });
      s.journeyToast?.update(deltaMs);
    };
    window.g.events.on('prerender', window.__fixture.tick);
    return { landscape, selected: s.ambientLife.snapshot(), isAnimal, generatedSeen: JSON.parse(localStorage.getItem('sheep-run-scenery-v1') ?? '{"seenIds":[]}').seenIds,
      actualObjects: s.children.list.filter(o => o.name.startsWith('ambient-life:')).map(o => ({ name: o.name, texture: o.texture?.key, frame: o.frame?.name, alpha: o.alpha, body: !!o.body, input: !!o.input })) };
  }, kind);
}
try {
  for (const [width, height, dpr, reduced] of [[480,270,1,false], [896,414,2,false], [844,390,2,false], [800,600,2,true]]) {
    const h = await setup(width, height, dpr, reduced), { page } = h, label = `${width}x${height}-dpr${dpr}${reduced ? '-reduced' : ''}`;
    const initial = await state(page); check(initial.webgl, `${label}: actual WebGL`); check(initial.seen.length === 0 && !initial.completed.includes('spring-pasture-v1'), `${label}: generation alone has no discovery`);
    await page.waitForFunction(() => window.g.scene.getScene('RunScene').activeRunTimeMs >= 1050);
    const before = await state(page); check(!before.seen.includes('spring-pasture-v1'), `${label}: natural spring stays uncollected before1500ms`);
    if (width === 480) {
      await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene'); const earlyPause = await state(page);
      await page.waitForTimeout(250); const earlyFrozen = await state(page);
      check(!earlyFrozen.seen.includes('spring-pasture-v1') && earlyPause.now === earlyFrozen.now && JSON.stringify(earlyPause.elapsed) === JSON.stringify(earlyFrozen.elapsed), `${label}: touch pause during incomplete exposure neither advances nor discovers`);
      await tap(page, 'PauseScene', 'button:继续游戏'); await ready(page, 'RunScene');
      report.earlyPause = { earlyPause, earlyFrozen };
    }
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('sheep-run-scenery-v1') ?? '{"seenIds":[]}').seenIds.includes('spring-pasture-v1'), null, { timeout: 10000 });
    await frames(page);
    const natural = await state(page), first = natural.discoveries.find(d => d.id === 'spring-pasture-v1');
    check(first.exposureMs >= 1500 && first.activeMs < 2500, `${label}: untouched natural first run records after1500ms actual rendering`);
    check(first.rendered.some(o => o.key === 'season-spring-near') && first.rendered.some(o => o.key === 'season-spring-far'), `${label}: natural discovery has matching real seasonal layers`);
    await screenshot(page, `${label}-spring-pasture-v1-natural.png`);
    console.log(JSON.stringify({ natural: label, activeMs: first.activeMs, exposureMs: first.exposureMs }));
    await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene'); const paused = await state(page); await page.waitForTimeout(200); const frozen = await state(page);
    check(paused.now === frozen.now && JSON.stringify(paused.elapsed) === JSON.stringify(frozen.elapsed), `${label}: real touch pause freezes effective time/exposure`);
    await tap(page, 'PauseScene', 'button:继续游戏'); await ready(page, 'RunScene'); await page.waitForTimeout(90); const resumed = await state(page);
    check(resumed.now > frozen.now && resumed.seen.filter(id => id === 'spring-pasture-v1').length === 1, `${label}: real touch resume and unique persisted card`);
    const restartEvidence = [];
    for (let n = 0; n < 3; n++) {
      await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene');
      await page.evaluate(() => { window.__oldObserver = window.g.scene.getScene('RunScene').travelPostcards; });
      await tap(page, 'PauseScene', 'button:重新开始'); await ready(page, 'RunScene');
      const restart = await page.evaluate(() => { const c = window.g.scene.getScene('RunScene').travelPostcards; return { oldStopped: window.__oldObserver.stopped, oldListener: window.g.events.listeners('postrender').includes(window.__oldObserver.afterRender), newListener: window.g.events.listeners('postrender').filter(fn => fn === c.afterRender).length, total: window.g.events.listenerCount('postrender') }; });
      check(restart.oldStopped && !restart.oldListener && restart.newListener === 1, `${label}: touch restart${n+1} removes old observer and has exactly one new listener`);
      restartEvidence.push(restart);
    }
    check(restartEvidence.every(x => x.total === restartEvidence[0].total), `${label}: aggregate postrender listener count stable over repeated restarts`);
    await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene'); await page.evaluate(() => { window.__oldObserver = window.g.scene.getScene('RunScene').travelPostcards; });
    await tap(page, 'PauseScene', 'button:返回首页'); await ready(page, 'MenuScene');
    check(await page.evaluate(() => window.__oldObserver.stopped && !window.g.events.listeners('postrender').includes(window.__oldObserver.afterRender)), `${label}: real touch exit removes observer`);
    report.profiles.push({ width, height, dpr, reduced, main: h.main, initial, before, natural, paused, frozen, resumed, restartEvidence });
    await h.context.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  }
  for (const [width, height, dpr, reduced] of [[480,270,1,false], [896,414,2,false], [800,600,2,true]]) {
    for (const [kind, id] of [['summer-pond-v1','summer-pond-v1'], ['autumn-sunset-v1','autumn-sunset-v1'], ['winter-sunshine-v1','winter-sunshine-v1'], ['duck-family','duck-outing-v1'], ['rabbit-butterfly','butterfly-path-v1']]) {
      const h = await setup(width, height, dpr, reduced), { page } = h, label = `${width}x${height}-dpr${dpr}${reduced ? '-reduced' : ''}-${id}`;
      const generated = await prepareFixture(page, kind); check(!generated.generatedSeen.includes(id), `${label}: generating actual fixture objects does not discover`);
      if (generated.isAnimal) check(generated.selected.kind === kind && generated.actualObjects.some(o => o.name !== 'ambient-life:pond'), `${label}: real AmbientLifeController created requested AnimalView`);
      await page.waitForFunction(id => JSON.parse(localStorage.getItem('sheep-run-scenery-v1') ?? '{"seenIds":[]}').seenIds.includes(id), id, { timeout: 10000 });
      await frames(page);
      const shown = await state(page), discovery = shown.discoveries.find(d => d.id === id); check(discovery.exposureMs >= 1500, `${label}: actual postrender exposure records only after1500 effective ms`);
      if (generated.isAnimal) check(generated.actualObjects.every(o => !o.body && !o.input), `${label}: genuine animal objects have no physics/input`);
      check(shown.ownListeners === 1, `${label}: one active observer listener`);
      await screenshot(page, `${label}.png`);
      await tap(page, 'RunScene', 'button:暂停'); await ready(page, 'PauseScene'); const before = await state(page); await page.waitForTimeout(120); const after = await state(page);
      check(before.fixture.ageMs === after.fixture.ageMs && JSON.stringify(before.elapsed) === JSON.stringify(after.elapsed), `${label}: fixture presentation and exposure freeze under real touch pause`);
      await tap(page, 'PauseScene', 'button:继续游戏'); await ready(page, 'RunScene'); await frames(page, 5);
      const resumed = await state(page); check(resumed.fixture.ageMs > after.fixture.ageMs && resumed.seen.filter(x => x === id).length === 1, `${label}: resume advances actual view without duplicate discovery`);
      await page.evaluate(() => window.g.events.off('prerender', window.__fixture.tick));
      report.fixtures.push({ width, height, dpr, reduced, id, main: h.main, generated, shown, before, after, resumed });
      console.log(JSON.stringify({ fixture: label, effectiveMs: discovery.exposureMs, actualKind: generated.selected.kind }));
      await h.context.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    }
  }
  check(report.errors.length === 0, 'no unhandled browser runtime errors'); report.passed = true;
} catch (error) {
  report.failure = error.stack || String(error);
  for (const context of browser.contexts()) for (const page of context.pages()) { report.failureState = await state(page).catch(() => null); await page.screenshot({ path: `${out}/screenshots/failure.png`, scale: 'css' }); }
  throw error;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, profiles: report.profiles.length, fixtures: report.fixtures.length, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors.length }));
