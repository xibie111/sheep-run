import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.EXPANDED_ACHIEVEMENTS_RUN_URL || 'http://127.0.0.1:11085/';
const output = new URL('../docs/aegis/work/2026-10-13-expanded-achievements/run-review/', import.meta.url);
await mkdir(new URL('screenshots/', output), { recursive: true });
const parseCatalog = source => [...source.matchAll(/\{id:"([^"]+)",metric:"([^"]+)",name:"([^\"]+)",goal:(\d+),condition:"([^\"]+)",message:"([^\"]+)",icon:"([^\"]+)"\}/g)]
  .map(match => ({ id: match[1], metric: match[2], name: match[3], goal: Number(match[4]), condition: match[5] }));
const catalog = [
  ...parseCatalog(await readFile(new URL('../src/data/journeyBook.ts', import.meta.url), 'utf8')),
  ...parseCatalog(await readFile(new URL('../src/data/expandedAchievements.ts', import.meta.url), 'utf8')),
];
assert.equal(catalog.length, 32);
const newEventIds = ['seventy-five-stars', 'hundred-stars', 'hundred-obstacles', 'one-hundred-fifty-obstacles'];
const save = { version: 5, highScore: 0, totalStars: 0, spentStars: 0, coins: 77, selectedSkin: 'white', unlockedSkins: ['white'],
  upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } };
const report = { passed: false, url, viewport: { width: 896, height: 414, dpr: 2 }, phoneHardware: false,
  method: 'Isolated production Edge context; genuine touchscreen starts and navigates. Only physics and automatic spawning are frozen for the fixture. Actual pooled Star.activate/onStarOverlap and Obstacle.activate/moveObjects dispatch shipping events. Observer and toast wrappers delegate to the original methods. No achieved IDs, counters or threshold results are written by the fixture. Explicit toast update deltas drain the real queue for screenshots; pause timing uses actual scene frames. This is deterministic event-path verification, not natural obstacle avoidance or phone hardware play.',
  economyMethod: 'Shipping ScoreSystem.awardStar records one lifetime star per genuine pickup. Main Save bytes are compared immediately around the original JourneyRun.star/passed callbacks to prove achievements add no transactions. Whole pickup stage permits exactly the existing lifetime-star increment. Passing stage must preserve main Save bytes. Collision ending permits one existing capped awardRun transaction plus the existing high-score update.',
  initialSave: save, newEventIds, cases: [], checks: [], errors: [], failedRequests: [], screenshots: [] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
const check = (value, label) => { assert(value, label); report.checks.push(label); };
async function frames() {
  await page.evaluate(() => new Promise(resolve => {
    let remaining = 2;
    const render = () => { if (!--remaining) { window.g.events.off('postrender', render); resolve(); } };
    window.g.events.on('postrender', render);
  }));
}
async function ready(scene) { await page.waitForFunction(key => window.g.scene.isActive(key) && window.g.scene.getScene(key).children.list.length, scene); await frames(); }
async function tap(sceneKey, name) {
  const point = await page.evaluate(({ sceneKey, name }) => {
    const scene = window.g.scene.getScene(sceneKey), object = scene.children.getByName(name);
    if (!object?.input?.enabled) throw new Error(`Unavailable touch target ${sceneKey}/${name}`);
    const matrix = object.getWorldTransformMatrix(), camera = scene.cameras.main;
    const rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: rect.x + (matrix.tx - camera.scrollX * object.scrollFactorX) * rect.width / size.width,
      y: rect.y + (matrix.ty - camera.scrollY * object.scrollFactorY) * rect.height / size.height };
  }, { sceneKey, name });
  await page.touchscreen.tap(point.x, point.y); await frames();
}
async function shot(name) {
  const file = `screenshots/${name}-896x414-dpr2.png`;
  await page.screenshot({ path: fileURLToPath(new URL(file, output)), scale: 'css' }); report.screenshots.push(file);
}
const readState = () => page.evaluate(() => {
  const s = window.g.scene.getScene('RunScene');
  return { journal: JSON.parse(localStorage.getItem('sheep-run-journey-v1')), mainRaw: localStorage.getItem('sheep-run-save'),
    score: s.scoreSystem.score, stars: s.scoreSystem.starCount, toast: { pending: [...s.journeyToast.pending], message: s.journeyToast.message, remaining: s.journeyToast.remaining },
    notifications: structuredClone(window.fixtureProbe.notifications), observerWrites: structuredClone(window.fixtureProbe.observerWrites) };
});
async function displayNotice(id) {
  const name = catalog.find(item => item.id === id).name;
  // Genuine score events cross 520/1314, whose existing 3800 ms notices have
  // priority. Let their shipping timers finish rather than suppressing them.
  await page.waitForFunction(() => {
    const parent = window.g.canvas.parentElement;
    return parent.querySelector('[data-easter-egg="score"]')?.style.display !== 'block'
      && parent.querySelector('[data-adventure-overlay="collection-toast"]')?.style.display !== 'block';
  }, null, { timeout: 12000 });
  const drain = await page.evaluate(name => {
    const toast = window.g.scene.getScene('RunScene').journeyToast;
    let steps = 0;
    while (!(toast.message.includes(name) && toast.remaining > 0) && steps++ < 30) toast.update(2300);
    return { found: toast.message.includes(name) && toast.remaining > 0, message: toast.message, steps };
  }, name);
  check(drain.found, `${id}: shipping queue displays the new achievement notice`);
  await frames();
  const rendered = await page.locator('[data-adventure-overlay="journey-toast"]').evaluate(canvas => ({ message: canvas.dataset.message, display: canvas.style.display }));
  check(rendered.message.includes(name) && rendered.display === 'block', `${id}: new notice is actually visible in the production overlay`);
  report.cases.push({ type: 'visible-notice', id, ...drain, rendered }); await shot(`notice-${id}`);
}
try {
  await page.addInitScript(save => {
    localStorage.clear(); localStorage.setItem('sheep-run-save', JSON.stringify(save));
    window.fixtureMainWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      const before = this.getItem(key); setItem.call(this, key, value);
      if (key === 'sheep-run-save') window.fixtureMainWrites.push({ before, after: String(value) });
    };
  }, save);
  const bundleResponse = page.waitForResponse(response => /\/assets\/main-[^/]+\.js(?:\?|$)/.test(response.url()));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const response = await bundleResponse, bytes = await response.body();
  report.bundle = { url: response.url(), status: response.status(), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  check(response.status() === 200, 'loads a real production bundle');
  await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, response.url());
  await ready('MenuScene');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('sheep-run-journey-v1')).stars === 0), 'fresh isolated journal has no invented historical pickup progress');
  await tap('MenuScene', 'button:开始游戏'); await ready('RunScene');
  report.fixture = await page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene');
    s.physics.pause(); s.spawnObjects = () => {};
    for (const group of [s.stars, s.obstacles, s.powerUps]) for (const object of group.getChildren()) object.deactivate();
    window.fixtureProbe = { notifications: [], observerWrites: [], starObjects: new Set(), obstacleObjects: new Set() };
    for (const method of ['star', 'passed']) {
      const original = s.journey[method].bind(s.journey);
      s.journey[method] = (...args) => {
        const before = localStorage.getItem('sheep-run-save'); const result = original(...args);
        const after = localStorage.getItem('sheep-run-save');
        window.fixtureProbe.observerWrites.push({ method, unchanged: before === after });
        return result;
      };
    }
    const original = s.journeyToast.achievements.bind(s.journeyToast);
    s.journeyToast.achievements = ids => { window.fixtureProbe.notifications.push([...ids]); return original(ids); };
    // Obtain a shipping definition from its genuine existing scheduler, without
    // importing source modules into this production-only test or fabricating one.
    const request = s.spawnSystem.update(2, 190).find(item => item.type === 'obstacle');
    if (!request) throw new Error('No authored obstacle definition from existing scheduler');
    window.fixtureDefinition = request.definition;
    window.fixtureInitialMain = localStorage.getItem('sheep-run-save');
    return { physicsPaused: s.physics.world.isPaused, autoSpawnDisabled: true, actualDefinition: request.definition,
      activeRunTimeMs: s.activeRunTimeMs, initialMain: JSON.parse(window.fixtureInitialMain), initialJournal: JSON.parse(localStorage.getItem('sheep-run-journey-v1')) };
  });
  check(report.fixture.physicsPaused && report.fixture.initialJournal.stars === 0 && report.fixture.initialJournal.obstacles === 0, 'actual RunScene starts clean, then freezes physics and disables only automatic spawning for the fixture');

  for (const target of [74, 75, 99, 100]) {
    const result = await page.evaluate(target => {
      const s = window.g.scene.getScene('RunScene');
      while (s.scoreSystem.starCount < target) {
        const object = s.acquireStar(); if (!object) throw new Error('Real star pool exhausted');
        window.fixtureProbe.starObjects.add(object); object.activate(s.sheep.x, s.sheep.y - 19, 0, 0);
        s.onStarOverlap(object);
        if (!object.collected || object.active) throw new Error('Shipping star pickup did not collect and recycle the instance');
        const before = JSON.stringify({ journal: localStorage.getItem('sheep-run-journey-v1'), main: localStorage.getItem('sheep-run-save'),
          count: s.scoreSystem.starCount, score: s.scoreSystem.score, pending: s.journeyToast.pending, notifications: window.fixtureProbe.notifications });
        s.onStarOverlap(object);
        const after = JSON.stringify({ journal: localStorage.getItem('sheep-run-journey-v1'), main: localStorage.getItem('sheep-run-save'),
          count: s.scoreSystem.starCount, score: s.scoreSystem.score, pending: s.journeyToast.pending, notifications: window.fixtureProbe.notifications });
        if (before !== after) throw new Error('Repeated collected Star generated another event');
      }
      const main = JSON.parse(localStorage.getItem('sheep-run-save'));
      return { target, journal: JSON.parse(localStorage.getItem('sheep-run-journey-v1')), main, poolInstances: window.fixtureProbe.starObjects.size,
        sameCollectedObjectIgnored: true, observerCalls: window.fixtureProbe.observerWrites.filter(item => item.method === 'star').length };
    }, target);
    report.cases.push({ type: 'actual-star-overlap', ...result });
    check(result.journal.stars === target && result.main.totalStars === target && result.observerCalls === target, `${target}: genuine pooled pickups reach both existing lifetime count and new single-run observer count exactly once`);
    check(Boolean(result.journal.achieved['seventy-five-stars']) === (target >= 75), `${target}: 75-star achievement boundary is exact`);
    check(Boolean(result.journal.achieved['hundred-stars']) === (target >= 100), `${target}: 100-star achievement boundary is exact`);
    check(result.main.coins === 77 && result.main.spentStars === 0 && result.main.selectedSkin === 'white'
      && JSON.stringify(result.main.upgrades) === JSON.stringify(save.upgrades), `${target}: pickup achievements spend no currency or change upgrades/equipment`);
    check(result.poolInstances === 1 && result.sameCollectedObjectIgnored, `${target}: actual star pool reuse and duplicate collected-object guard work`);
    if (target === 75 || target === 100) await displayNotice(target === 75 ? 'seventy-five-stars' : 'hundred-stars');
    if (target === 75) {
      await tap('RunScene', 'button:暂停'); await ready('PauseScene');
      const frozen = await page.evaluate(() => {
        const s = window.g.scene.getScene('RunScene'); return { time: s.activeRunTimeMs, remaining: s.journeyToast.remaining,
          pending: [...s.journeyToast.pending], journal: localStorage.getItem('sheep-run-journey-v1'), main: localStorage.getItem('sheep-run-save') };
      });
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => {
        const s = window.g.scene.getScene('RunScene'); return { time: s.activeRunTimeMs, remaining: s.journeyToast.remaining,
          pending: [...s.journeyToast.pending], journal: localStorage.getItem('sheep-run-journey-v1'), main: localStorage.getItem('sheep-run-save') };
      });
      check(JSON.stringify(frozen) === JSON.stringify(after), 'actual touch pause freezes run time, the visible new toast lifetime, queue and both saves');
      report.pause = { before: frozen, after, wallWaitMs: 350 }; await shot('new-toast-paused');
      await tap('PauseScene', 'button:继续游戏'); await ready('RunScene');
      const resumed = await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return { time: s.activeRunTimeMs, remaining: s.journeyToast.remaining }; });
      check(resumed.time > frozen.time && resumed.remaining < frozen.remaining, 'actual touch resume continues the effective timer and new achievement toast');
    }
  }
  const afterStars = await readState(); report.afterStars = afterStars;
  check(afterStars.journal.stars === 100 && afterStars.observerWrites.filter(item => item.method === 'star').every(item => item.unchanged), 'all 100 genuine JourneyRun.star callbacks preserve main Save bytes; existing pickups alone add the lifetime stars');

  for (const target of [99, 100, 149, 150]) {
    const result = await page.evaluate(target => {
      const s = window.g.scene.getScene('RunScene');
      while (JSON.parse(localStorage.getItem('sheep-run-journey-v1')).obstacles < target) {
        const object = s.acquireObstacle(window.fixtureDefinition, 0); if (!object) throw new Error('Real obstacle pool exhausted');
        window.fixtureProbe.obstacleObjects.add(object);
        object.activate(79 - object.definition.width, 0, 0, 'spring'); s.moveObjects(0);
        if (!object.passed) throw new Error('Shipping rear-edge pass event did not fire');
        const before = JSON.stringify({ journal: localStorage.getItem('sheep-run-journey-v1'), main: localStorage.getItem('sheep-run-save'),
          score: s.scoreSystem.score, pending: s.journeyToast.pending, notifications: window.fixtureProbe.notifications });
        s.moveObjects(0);
        const after = JSON.stringify({ journal: localStorage.getItem('sheep-run-journey-v1'), main: localStorage.getItem('sheep-run-save'),
          score: s.scoreSystem.score, pending: s.journeyToast.pending, notifications: window.fixtureProbe.notifications });
        if (before !== after) throw new Error('Already passed obstacle generated another event');
        window.fixtureObstacle = object; object.deactivate();
      }
      return { target, journal: JSON.parse(localStorage.getItem('sheep-run-journey-v1')), mainRaw: localStorage.getItem('sheep-run-save'),
        poolInstances: window.fixtureProbe.obstacleObjects.size, samePassedObjectIgnored: true,
        observerCalls: window.fixtureProbe.observerWrites.filter(item => item.method === 'passed').length };
    }, target);
    report.cases.push({ type: 'actual-obstacle-rear-edge', ...result });
    check(result.journal.obstacles === target && result.observerCalls === target, `${target}: shipping moveObjects passes the real pooled obstacle exactly once`);
    check(Boolean(result.journal.achieved['hundred-obstacles']) === (target >= 100), `${target}: 100-pass achievement boundary is exact`);
    check(Boolean(result.journal.achieved['one-hundred-fifty-obstacles']) === (target >= 150), `${target}: 150-pass achievement boundary is exact`);
    check(result.mainRaw === afterStars.mainRaw, `${target}: passing and its achievements preserve main Save bytes`);
    check(result.poolInstances === 1 && result.samePassedObjectIgnored, `${target}: real obstacle pool reuse and passed-event guard work`);
    if (target === 100 || target === 150) await displayNotice(target === 100 ? 'hundred-obstacles' : 'one-hundred-fifty-obstacles');
  }
  const beforeFinish = await readState(); report.beforeFinish = beforeFinish;
  check(beforeFinish.observerWrites.length === 250 && beforeFinish.observerWrites.every(item => item.unchanged), 'all 250 new-threshold observer calls add no main-save transaction');
  for (const id of newEventIds) {
    check(beforeFinish.notifications.flat().filter(value => value === id).length === 1, `${id}: one real notification, including repeated entity-event attempts`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(beforeFinish.journal.achieved[id]), `${id}: actual store persists its achievement date`);
  }
  report.finish = await page.evaluate(() => {
    const s = window.g.scene.getScene('RunScene'), object = window.fixtureObstacle;
    const before = localStorage.getItem('sheep-run-save'), writeIndex = window.fixtureMainWrites.length;
    object.activate(s.sheep.x, 0, 0, 'spring'); s.onObstacleOverlap(object);
    const afterFirst = localStorage.getItem('sheep-run-save'); s.onObstacleOverlap(object);
    return { finished: s.finished, before: JSON.parse(before), immediatelyAfter: JSON.parse(afterFirst),
      secondCollisionIgnored: afterFirst === localStorage.getItem('sheep-run-save'), writeIndex };
  });
  check(report.finish.finished && report.finish.secondCollisionIgnored, 'genuine collision-ending handler runs once and ignores a repeated collision');
  await ready('ResultScene');
  const result = await page.evaluate(writeIndex => {
    const scene = window.g.scene.getScene('ResultScene'), main = JSON.parse(localStorage.getItem('sheep-run-save'));
    const writes = window.fixtureMainWrites.slice(writeIndex);
    return { result: structuredClone(scene.result), main, writes,
      summaryButtons: scene.children.list.filter(object => object.name === 'button:本局成就').length,
      journal: JSON.parse(localStorage.getItem('sheep-run-journey-v1')),
      journeyCanvases: document.querySelectorAll('[data-adventure-overlay="journey-book"]').length,
      remainingRunToasts: document.querySelectorAll('[data-adventure-overlay="journey-toast"]').length };
  }, report.finish.writeIndex); report.result = result;
  check(newEventIds.every(id => result.result.achievements.includes(id)), 'real RunScene collision → ResultScene launch carries all four new observer achievements');
  check(new Set(result.result.achievements).size === result.result.achievements.length, 'real merged result summary contains no duplicate achievements');
  check(result.summaryButtons === 1 && result.journeyCanvases === 1 && result.remainingRunToasts === 0, 'result owns one merged achievement entry and book, with no abandoned run toast');
  const coinsEarned = Math.min(20, Math.floor(result.result.score / 25));
  check(result.result.coinsEarned === coinsEarned && result.main.coins === report.finish.before.coins + coinsEarned,
    'collision finish applies exactly the existing capped score-to-coin reward');
  check(result.main.totalStars === 100 && result.main.spentStars === 0 && result.main.highScore === result.result.score, 'finish preserves pickup totals and records the existing high score');
  check(result.writes.filter(write => JSON.parse(write.after).coins > JSON.parse(write.before).coins).length === 1,
    'main Save records one coin award transaction across duplicate collision attempts');
  check(result.journal.runs === 1 && result.journal.stars === 100 && result.journal.obstacles === 150, 'real finish records one completed run and the new single-run maxima');
  await shot('real-result-summary');
  await tap('ResultScene', 'button:本局成就');
  const index = catalog.findIndex(item => item.id === 'seventy-five-stars'), desiredPage = Math.floor(index / 4);
  for (let i = 0; i < desiredPage; i++) await tap('ResultScene', 'journey-next');
  await tap('ResultScene', `achievement-card:${index % 4}`);
  const detail = await page.locator('[data-adventure-overlay="journey-book"]').evaluate(canvas => ({ ...canvas.dataset }));
  const lines = JSON.parse(detail.lines).map(line => line.text);
  check(detail.mode === 'detail' && lines.includes('星光小旅行') && lines.includes('单局收集七十五颗星星')
    && lines.some(line => /^达成日期 \d{4}-\d{2}-\d{2}$/.test(line)), 'touch navigation opens the actually earned new achievement detail with its real date');
  report.detail = detail; await shot('earned-seventy-five-stars-detail');
  await tap('ResultScene', 'button:合上手账');
  const returned = await page.locator('[data-adventure-overlay="journey-book"]').evaluate(canvas => ({ mode: canvas.dataset.mode, page: canvas.dataset.page, open: canvas.dataset.open }));
  check(returned.mode === 'achievements' && returned.page === String(desiredPage), 'detail touch returns to its originating achievement page');
  await tap('ResultScene', 'button:合上手账');
  check(await page.locator('[data-adventure-overlay="journey-book"]').evaluate(canvas => canvas.dataset.open === 'false'), 'touch closes the book back to the genuine result screen');
  check(report.errors.length === 0 && report.failedRequests.length === 0, 'production fixture has no browser runtime or resource failures');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  try { await shot('failure'); } catch {}
  throw error;
} finally {
  await writeFile(new URL('browser-events.json', output), JSON.stringify(report, null, 2));
  await writeFile(new URL('verification.md', output), `# Production run event verification\n\nStatus: ${report.passed ? 'PASS' : 'FAIL'}. ${report.checks.length} checks.\n\n${report.method}\n\n${report.economyMethod}\n\nBundle: ${report.bundle?.url ?? 'not loaded'}\nSHA256: ${report.bundle?.sha256 ?? 'unavailable'}\nViewport: 896 × 414, DPR 2. Browser errors: ${report.errors.length}; resource failures: ${report.failedRequests.length}.\n\nNo APK or physical Android device test was performed. Production preview service is left running; only this script's browser is closed. Full cases, raw save fixtures, observer snapshots, collision transactions and screenshots are preserved in browser-events.json.\n`);
  await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors.length, bundle: report.bundle?.url }));
