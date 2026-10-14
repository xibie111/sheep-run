import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = new URL(process.env.EXPANDED_OBSTACLES_TOUCH_QA_OUTPUT ?? '../docs/aegis/work/2026-10-13-expanded-obstacles/touch-review/', import.meta.url);
await mkdir(new URL('screenshots/', output), { recursive: true });
const kinds = ['HayCart', 'WaterTrough', 'HangingLantern', 'FlyingGoose'];
const report = { passed: false, phoneHardware: false, engine: 'Edge production preview, touch emulation', method: 'Isolated storage. Single-obstacle fixtures use actual Arcade overlap and real CDP touch at fixed 190/429 speeds, zero jump upgrades. Natural observation uses the shipped seeded scheduler at fixed 390 speed, unaccelerated time and suppressed damage only. Fixture code is confined to this QA script.', views: [] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  for (const [width, height] of [[896, 414], [800, 600], [1672, 941]]) {
    const view = { width, height, checks: [], errors: [], trials: [] }; report.views.push(view);
    const check = (value, label) => { assert.ok(value, label); view.checks.push(label); };
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await context.addInitScript(() => localStorage.setItem('sheep-run-save', JSON.stringify({ version: 4, highScore: 0, totalStars: 0, coins: 0, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false } })));
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    page.on('pageerror', e => view.errors.push(e.message));
    const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
    await page.goto(process.env.EXPANDED_OBSTACLES_QA_URL ?? 'http://127.0.0.1:11075');
    view.bundle = (await request).url();
    await page.evaluate(async url => { window.g = (await import(url)).game.instance; }, view.bundle);
    const ready = key => page.waitForFunction(key => window.g.scene.isActive(key) && window.g.scene.getScene(key).children.list.length > 0, key);
    const frames = count => page.evaluate(count => new Promise(resolve => { const next = () => { if (--count <= 0) { window.g.events.off('postrender', next); resolve(); } }; window.g.events.on('postrender', next); }), count);
    const tap = async (scene, name) => {
      const point = await page.evaluate(({ scene, name }) => {
        const s = window.g.scene.getScene(scene), target = s.children.getByName(name), matrix = target.getWorldTransformMatrix();
        const r = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize;
        const x = matrix.tx - s.cameras.main.scrollX * target.scrollFactorX, y = matrix.ty - s.cameras.main.scrollY * target.scrollFactorY;
        return { x: r.x + x * r.width / z.width, y: r.y + y * r.height / z.height };
      }, { scene, name });
      await page.touchscreen.tap(point.x, point.y); await frames(2);
    };
    const shot = name => page.screenshot({ path: fileURLToPath(new URL(`screenshots/${width}x${height}-${name}.png`, output)), scale: 'css' });
    await ready('MenuScene'); await tap('MenuScene', 'button:开始游戏'); await ready('RunScene'); await frames(2);
    view.scheduler = await page.evaluate(kinds => {
      const run = window.g.scene.getScene('RunScene'); window.definitions = {};
      let best = { seed: 0, completeAt: Infinity, firstSeen: {} };
      for (let seed = 1; seed <= 400; seed++) {
        const sample = new run.spawnSystem.constructor(seed), firstSeen = {};
        for (let frame = 1; frame <= 2500; frame++) {
          for (const r of sample.update(.04, 390)) if (r.type === 'obstacle') {
            window.definitions[r.definition.kind] = r.definition;
            if (kinds.includes(r.definition.kind)) firstSeen[r.definition.kind] ??= frame * .04;
          }
          if (kinds.every(k => firstSeen[k] != null)) {
            if (frame * .04 < best.completeAt) best = { seed, completeAt: frame * .04, firstSeen };
            break;
          }
        }
      }
      return { kinds: Object.keys(window.definitions), best };
    }, kinds);
    check(view.scheduler.kinds.length === 18, 'all 18 kinds reachable through the shipped scheduler');
    check(view.scheduler.best.seed > 0 && view.scheduler.best.completeAt < 60, 'find an ordinary seeded sequence for unaccelerated natural observation');
    const restart = async () => {
      await page.evaluate(() => {
        const run = window.g.scene.getScene('RunScene'), proto = Object.getPrototypeOf(run);
        run.update = proto.update; run.onObstacleOverlap = proto.onObstacleOverlap;
        run.spawnSystem.update = run.spawnSystem.constructor.prototype.update;
        for (const key of ['PauseScene', 'ResultScene']) window.g.scene.stop(key);
        if (run.sys.isPaused()) run.scene.resume();
        run.scene.restart();
      });
      await ready('RunScene'); await frames(2);
      await page.evaluate(() => {
        const s = window.g.scene.getScene('RunScene'); s.spawnSystem.update = () => [];
        s.physics.pause(); s.inputSystem.reset();
        for (const group of [s.obstacles, s.stars, s.powerUps]) for (const o of group.getChildren()) o.deactivate();
      });
    };
    const cases = kinds.flatMap(kind => {
      const action = kind === 'HangingLantern' ? 'crouch' : kind === 'FlyingGoose' ? 'none' : 'normal';
      return [[kind, 190, action, true], [kind, 429, action, true], [kind, 190, kind === 'FlyingGoose' ? 'normal' : 'none', false]];
    });
    for (const [kind, speed, action, expectedPass] of cases) {
      await restart();
      await page.evaluate(({ kind, speed, action }) => {
        const s = window.g.scene.getScene('RunScene'), d = window.definitions[kind];
        s.difficultySystem.update = () => speed; Object.defineProperty(s.difficultySystem, 'speed', { configurable: true, get: () => speed });
        const crossing = (s.sheep.body.width + d.hitbox.width) / speed;
        const entry = kind === 'HangingLantern' ? .05 : kind === 'FlyingGoose' ? .10 : 500 / 1450 - 1 / 120 - crossing / 2;
        const o = s.acquireObstacle(d, 0); o.activate(s.sheep.body.right + speed * entry - d.hitbox.offsetX, 0, speed, 'spring');
        window.trialObstacle = o; window.trialStarted = false;
        const start = () => {
          if (action !== 'none' && !(action === 'crouch' ? s.sheep.body.height === 18 : s.sheep.body.velocity.y < 0)) return;
          window.trialStarted = true; s.events.off('preupdate', start); s.physics.resume();
        };
        if (action === 'none') start(); else s.events.on('preupdate', start);
      }, { kind, speed, action });
      if (action !== 'none') {
        const p = await page.evaluate(() => {
          const r = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize;
          return { x: r.x + 340 * r.width / z.width, y: r.y + 125 * r.height / z.height, dy: 48 * r.height / z.height };
        });
        if (action === 'normal') await page.touchscreen.tap(p.x, p.y);
        else {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: p.x, y: p.y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: p.x, y: p.y + p.dy }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
      }
      await page.waitForFunction(() => window.g.scene.getScene('RunScene').finished || window.trialObstacle.passed, null, { polling: 'raf', timeout: 4000 });
      const result = await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return { passed: window.trialObstacle.passed, finished: s.finished, bonus: s.scoreSystem.bonus, started: window.trialStarted }; });
      view.trials.push({ kind, speed, action, expectedPass, ...result });
      check(expectedPass ? result.passed && !result.finished && result.bonus === 25 : result.finished && !result.passed, `${kind}@${speed}: actual touch ${action} ${expectedPass ? 'passes, awards 25 once' : 'collides'}`);
    }
    if (width === 896) {
      await restart();
      await page.evaluate(seed => {
        const s = window.g.scene.getScene('RunScene'); s.spawnSystem.update = s.spawnSystem.constructor.prototype.update; s.spawnSystem.reset(seed);
        s.difficultySystem.update = () => 390; Object.defineProperty(s.difficultySystem, 'speed', { configurable: true, get: () => 390 });
        s.onObstacleOverlap = () => {}; window.observedKinds = new Set(); window.observedNew = [];
        s.events.on('postupdate', () => { for (const o of s.obstacles.getChildren()) if (o.active && !window.observedKinds.has(o.definition.kind)) { window.observedKinds.add(o.definition.kind); window.observedNew.push({ kind: o.definition.kind, timeMs: s.activeRunTimeMs, key: o.texture.key }); } });
        s.physics.resume();
      }, view.scheduler.best.seed);
      await page.waitForFunction(kinds => kinds.every(k => window.observedKinds.has(k)), kinds, { polling: 'raf', timeout: 90000 });
      view.natural = await page.evaluate(() => ({ firstSeen: window.observedNew, all: [...window.observedKinds] }));
      check(kinds.every(k => view.natural.all.includes(k)), 'all four additions appear in real-time production scheduling and pooling');
      await shot('natural'); await tap('RunScene', 'button:暂停'); await ready('PauseScene');
      const snapshot = () => page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return [s.activeRunTimeMs, ...s.obstacles.getChildren().map(o => [o.x, o.y])]; });
      const before = await snapshot(); await frames(6);
      check(JSON.stringify(before) === JSON.stringify(await snapshot()), 'touch pause freezes motion and active game time');
      await shot('paused'); await tap('PauseScene', 'button:重新开始'); await ready('RunScene'); await frames(2);
      check(await page.evaluate(() => { const s = window.g.scene.getScene('RunScene'); return s.obstacles.getChildren().length === 0 && s.speed < 195; }), 'touch restart clears pools and restores opening speed');
    }
    check(view.errors.length === 0, 'no browser runtime errors');
    console.log(JSON.stringify({ width, height, checks: view.checks.length, trials: view.trials.length }));
    await context.close();
  }
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: fileURLToPath(new URL('screenshots/failure.png', output)), scale: 'css' });
  throw error;
} finally {
  await writeFile(new URL('browser-verification.json', output), JSON.stringify(report, null, 2)); await browser.close();
}
console.log(JSON.stringify({ passed: report.passed }));
