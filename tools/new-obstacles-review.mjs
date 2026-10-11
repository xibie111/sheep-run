import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/obstacles-v2-review/2026-10-11/", import.meta.url);
const kinds = ["WoodBarrel", "MilkChurn", "FruitBasket", "MushroomCluster", "Bramble", "HangingBranch"];
const seasons = [["spring", 0], ["summer", 1500], ["autumn", 3000], ["winter", 4500]];
const report = { passed: false, engine: "Edge mobile touch emulation", phoneHardware: false, build: "production snapshot", fixtures: "Isolated storage; frozen galleries; fixed-speed single-obstacle live Arcade trials using real touch. Natural observation uses an unaccelerated seeded production scheduler and suppresses damage only. No fixture code ships in the game.", views: [] };
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const [width, height] of [[896, 414], [844, 390], [800, 600], [480, 270]]) {
    const view = { width, height, checks: [], errors: [], textures: [], galleries: [], trials: [] }; report.views.push(view);
    const check = (value, label) => { assert.ok(value, label); view.checks.push(label); };
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await context.addInitScript(() => localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 0, totalStars: 0, coins: 0, selectedSkin: "white", unlockedSkins: ["white"], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false } })));
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    page.on("pageerror", error => view.errors.push(error.message));
    const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
    await page.goto(process.env.NEW_OBSTACLES_QA_URL ?? "http://127.0.0.1:9258");
    await page.evaluate(async url => { window.g = (await import(url)).game.instance; }, (await request).url());
    const ready = key => page.waitForFunction(key => window.g.scene.isActive(key) && window.g.scene.getScene(key).children.list.length > 0, key);
    const frames = count => page.evaluate(count => new Promise(resolve => { const next = () => { if (--count <= 0) { window.g.events.off("postrender", next); resolve(); } }; window.g.events.on("postrender", next); }), count);
    const tap = async (scene, name) => { const p = await page.evaluate(({ scene, name }) => { const b = window.g.scene.getScene(scene).children.getByName(name).getBounds(), r = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize; return { x: r.x + b.centerX * r.width / z.width, y: r.y + b.centerY * r.height / z.height }; }, { scene, name }); await page.touchscreen.tap(p.x, p.y); await frames(2); };
    const shot = name => page.screenshot({ path: fileURLToPath(new URL(`screenshots/${width}x${height}-${name}.png`, output)), scale: "css" });
    await ready("MenuScene"); await tap("MenuScene", "button:开始游戏"); await ready("RunScene"); await frames(2);
    await page.evaluate(() => {
      const run = window.g.scene.getScene("RunScene"), sample = new run.spawnSystem.constructor(78); window.definitions = {};
      window.naturalFirstSeen = {};
      for (let frame = 1; frame <= 15000; frame++) for (const r of sample.update(.04, 390)) if (r.type === "obstacle") {
        window.definitions[r.definition.kind] = r.definition;
        window.naturalFirstSeen[r.definition.kind] ??= frame * .04;
      }
    });
    check(await page.evaluate(() => Object.keys(window.definitions).length) === 14, "all fourteen types are reachable through the shipped seeded scheduler");
    const restart = async () => {
      await page.evaluate(() => {
        const run = window.g.scene.getScene("RunScene"), proto = Object.getPrototypeOf(run);
        run.update = proto.update; run.onObstacleOverlap = proto.onObstacleOverlap;
        run.spawnSystem.update = run.spawnSystem.constructor.prototype.update;
        for (const key of ["PauseScene", "ResultScene"]) window.g.scene.stop(key);
        if (run.sys.isPaused()) run.scene.resume();
        run.scene.restart();
      });
      await ready("RunScene"); await frames(2);
      await page.evaluate(() => { const run = window.g.scene.getScene("RunScene"); run.spawnSystem.update = () => []; run.physics.pause(); run.inputSystem.reset(); for (const group of [run.obstacles, run.stars, run.powerUps]) for (const o of group.getChildren()) o.deactivate(); });
    };
    view.textures = await page.evaluate(kinds => {
      const g = window.g;
      return ["spring", "summer", "autumn", "winter"].flatMap(season => kinds.map(kind => {
        const key = `season-${season}-obstacle-${kind}`, t = g.textures.get(key), c = t.getSourceImage(), p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let visible = 0, partial = 0; for (let i = 3; i < p.length; i += 4) { if (p[i]) visible++; if (p[i] > 0 && p[i] < 255) partial++; }
        return { key, visible, partial, nearest: t.source[0].scaleMode === 1, width: c.width, height: c.height };
      }));
    }, kinds);
    check(view.textures.length === 24 && view.textures.every(t => t.visible > 0 && !t.partial && t.nearest), "24 actual seasonal textures have visible pixels, hard alpha and nearest-neighbor filtering");
    check(await page.evaluate(() => !window.g.textures.exists("new-obstacles-v2-source")), "source atlas released after texture preparation");
    for (const [season, score] of seasons) {
      await restart();
      const gallery = await page.evaluate(({ kinds, season, score }) => {
        const s = window.g.scene.getScene("RunScene"), save = localStorage.getItem("sheep-run-save"), update = Object.getPrototypeOf(s).update;
        s.update = function(time) { update.call(this, time, 0); };
        s.scoreSystem.distance = 0; s.scoreSystem.bonus = score; s.update(0, 0);
        const rows = kinds.map((kind, index) => {
          const d = window.definitions[kind], o = s.acquireObstacle(d, 0); o.activate(130 + index * 59, 0, 0, season); o.body.updateFromGameObject();
          const b = o.getBounds();
          return { kind, texture: o.texture.key, name: o.getData("visualName"), x: o.x, y: o.y, display: { x: b.x, y: b.y, width: b.width, height: b.height }, body: { x: o.body.x, y: o.body.y, width: o.body.width, height: o.body.height }, scale: [o.scaleX, o.scaleY], definition: d };
        });
        return { season: s.environmentSystem.snapshot().theme, rows, saveUnchanged: save === localStorage.getItem("sheep-run-save") };
      }, { kinds, season, score });
      view.galleries.push(gallery);
      check(gallery.season === season && gallery.saveUnchanged, `${season}: background and obstacles agree without a save change`);
      for (const r of gallery.rows) {
        check(r.texture === `season-${season}-obstacle-${r.kind}` && r.name, `${season}/${r.kind}: correct actual seasonal texture and name`);
        check(Math.abs(r.scale[0] - r.scale[1]) < .0001 && Math.abs(r.body.width - r.definition.hitbox.width) < .001 && Math.abs(r.body.height - r.definition.hitbox.height) < .001 && r.y === 218 - r.definition.groundOffset, `${season}/${r.kind}: uniform artwork, authored collision and baseline`);
      }
      await frames(2); await shot(season);
    }
    const trials = kinds.flatMap(kind => [[kind, 190, kind === "HangingBranch" ? "crouch" : "normal", true], [kind, 429, kind === "HangingBranch" ? "crouch" : "normal", true], [kind, 190, "none", false]]);
    for (const [kind, speed, action, expectedPass] of trials) {
      await restart();
      await page.evaluate(({ kind, speed, action }) => {
        const s = window.g.scene.getScene("RunScene"), d = window.definitions[kind];
        s.difficultySystem.update = () => speed; Object.defineProperty(s.difficultySystem, "speed", { configurable: true, get: () => speed });
        const crossing = (s.sheep.body.width + d.hitbox.width) / speed;
        const entry = action === "crouch" || kind === "HangingBranch" ? .05 : 500 / 1450 - 1 / 120 - crossing / 2;
        const o = s.acquireObstacle(d, 0); o.activate(s.sheep.body.right + speed * entry - d.hitbox.offsetX, 0, speed, "spring");
        window.trialObstacle = o; window.trialStarted = false;
        const start = () => {
          if (action !== "none" && !(action === "crouch" ? s.sheep.body.height === 18 : s.sheep.body.velocity.y < 0)) return;
          window.trialStarted = true; s.events.off("preupdate", start); s.physics.resume();
        };
        if (action === "none") start(); else s.events.on("preupdate", start);
      }, { kind, speed, action });
      if (action !== "none") {
        const p = await page.evaluate(() => { const r = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize; return { x: r.x + 340 * r.width / z.width, y: r.y + 125 * r.height / z.height, dy: 48 * r.height / z.height }; });
        if (action === "normal") await page.touchscreen.tap(p.x, p.y);
        else { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: p.x, y: p.y }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: p.x, y: p.y + p.dy }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
      }
      await page.waitForFunction(() => window.g.scene.getScene("RunScene").finished || window.trialObstacle.passed, null, { polling: "raf", timeout: 4000 });
      const result = await page.evaluate(() => { const s = window.g.scene.getScene("RunScene"); return { passed: window.trialObstacle.passed, finished: s.finished, bonus: s.scoreSystem.bonus, started: window.trialStarted }; });
      view.trials.push({ kind, speed, action, expectedPass, ...result });
      check(expectedPass ? result.passed && !result.finished && result.bonus === 25 : result.finished && !result.passed, `${kind}@${speed}: ${action} ${expectedPass ? "clears with original reward" : "collides"}`);
    }
    if (width === 896) {
      await restart();
      view.firstSeen = await page.evaluate(() => window.naturalFirstSeen);
      await page.evaluate(() => {
        const s = window.g.scene.getScene("RunScene"); s.spawnSystem.update = s.spawnSystem.constructor.prototype.update; s.spawnSystem.reset(78);
        s.difficultySystem.update = () => 390; Object.defineProperty(s.difficultySystem, "speed", { configurable: true, get: () => 390 }); s.physics.resume();
        s.onObstacleOverlap = () => {}; window.observedKinds = new Set();
        s.events.on("postupdate", () => { for (const o of s.obstacles.getChildren()) if (o.active) window.observedKinds.add(o.definition.kind); });
      });
      await page.waitForFunction(kinds => kinds.every(k => window.observedKinds.has(k)), kinds, { polling: "raf", timeout: 180000 });
      view.naturalKinds = await page.evaluate(() => [...window.observedKinds]);
      check(kinds.every(k => view.naturalKinds.includes(k)), "all six new kinds appeared through natural scheduling and live object pooling");
      await tap("RunScene", "button:暂停"); await ready("PauseScene");
      const before = await page.evaluate(() => { const s = window.g.scene.getScene("RunScene"); return [s.activeRunTimeMs, ...s.obstacles.getChildren().map(o => o.x)]; }); await frames(6);
      check(JSON.stringify(before) === JSON.stringify(await page.evaluate(() => { const s = window.g.scene.getScene("RunScene"); return [s.activeRunTimeMs, ...s.obstacles.getChildren().map(o => o.x)]; })), "touch pause freezes obstacle motion and active game time");
      await shot("paused"); await tap("PauseScene", "button:重新开始"); await ready("RunScene"); await frames(2);
      check(await page.evaluate(() => { const s = window.g.scene.getScene("RunScene"); return s.obstacles.getChildren().length === 0 && s.speed < 195; }), "touch restart clears pools and restores speed");
    }
    check(view.errors.length === 0, "no browser runtime errors");
    console.log(JSON.stringify({ width, height, checks: view.checks.length, trials: view.trials.length }));
    await context.close();
  }
  report.passed = true;
} catch (error) { report.failure = error.stack; for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: fileURLToPath(new URL("screenshots/failure.png", output)) }); throw error; }
finally { await writeFile(new URL("browser-verification.json", output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed }));
