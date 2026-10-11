import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/obstacles-v2-review/2026-10-11/", import.meta.url);
const report = { passed: false, browser: "Edge mobile touch emulation", deviceScaleFactor: 1, phoneHardware: false, errors: [] };
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 123, totalStars: 8, coins: 8, selectedSkin: "white", unlockedSkins: ["white"], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false } }));
    localStorage.setItem("sheep-run-mailbox-v1", '{"version":1,"readIds":["welcome-v1","retired-letter"]}');
  });
  const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
  const glob = "**/assets/new-obstacles-atlas-*.png";
  await page.route(glob, route => route.abort());
  const mainRequest = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
  await page.goto(process.env.NEW_OBSTACLES_QA_URL ?? "http://127.0.0.1:9258");
  await page.evaluate(async url => { window.g = (await import(url)).game.instance; }, (await mainRequest).url());
  await page.waitForFunction(() => window.g.scene.getScene("PreloadScene").children.getByName("local-load-error"));
  assert(!await page.evaluate(() => window.g.scene.isActive("MenuScene")));
  report.failedAssetBlockedMenu = true;
  const before = await page.evaluate(() => [localStorage.getItem("sheep-run-save"), localStorage.getItem("sheep-run-mailbox-v1")]);
  await page.screenshot({ path: fileURLToPath(new URL("screenshots/new-atlas-load-failure.png", output)), scale: "css" });
  await page.unroute(glob);
  const tap = async (scene, name) => {
    const p = await page.evaluate(({ scene, name }) => { const b = window.g.scene.getScene(scene).children.getByName(name).getBounds(), r = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize; return { x: r.x + b.centerX * r.width / z.width, y: r.y + b.centerY * r.height / z.height }; }, { scene, name });
    await page.touchscreen.tap(p.x, p.y);
  };
  await tap("PreloadScene", "button:重试");
  await page.waitForFunction(() => window.g.scene.isActive("MenuScene") && window.g.scene.getScene("MenuScene").children.getByName("button:开始游戏"));
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem("sheep-run-save"), localStorage.getItem("sheep-run-mailbox-v1")]), before);
  report.existingSavesUnchanged = true;
  const kinds = ["WoodBarrel", "MilkChurn", "FruitBasket", "MushroomCluster", "Bramble", "HangingBranch"];
  report.recoveredTextures = await page.evaluate(kinds => ["spring", "summer", "autumn", "winter"].flatMap(s => kinds.map(k => `season-${s}-obstacle-${k}`)).filter(k => window.g.textures.exists(k)), kinds);
  assert.equal(report.recoveredTextures.length, 24);
  await tap("MenuScene", "button:开始游戏");
  await page.waitForFunction(() => window.g.scene.isActive("RunScene") && window.g.scene.getScene("RunScene").sheep?.body);
  report.poolReuse = await page.evaluate(kinds => {
    const run = window.g.scene.getScene("RunScene"), sample = new run.spawnSystem.constructor(78), definitions = {};
    for (let n = 0; n < 15000; n++) for (const r of sample.update(.04, 390)) if (r.type === "obstacle") definitions[r.definition.kind] = r.definition;
    run.spawnSystem.update = () => []; run.physics.pause(); const update = Object.getPrototypeOf(run).update;
    run.update = function(time) { update.call(this, time, 0); };
    return kinds.map((kind, i) => {
      let first; const uses = [];
      for (const season of ["spring", "summer", "autumn", "winter"]) {
        const o = run.acquireObstacle(definitions[kind], 0); first ??= o;
        o.activate(130 + i * 59, 0, 0, season); o.body.updateFromGameObject();
        uses.push({ season, reused: o === first, texture: o.texture.key, body: [o.body.x, o.body.y, o.body.width, o.body.height] });
        o.deactivate();
      }
      first.activate(130 + i * 59, 0, 0, "winter");
      return { kind, uses };
    });
  }, kinds);
  for (const row of report.poolReuse) for (const use of row.uses) {
    assert(use.reused); assert.equal(use.texture, `season-${use.season}-obstacle-${row.kind}`);
    assert.deepEqual(use.body, row.uses[0].body);
  }
  await page.evaluate(() => { const s = window.g.scene.getScene("RunScene"); s.scoreSystem.distance = 0; s.scoreSystem.bonus = 4500; s.update(0, 0); });
  await page.waitForTimeout(80);
  await page.screenshot({ path: fileURLToPath(new URL("screenshots/new-atlas-retry-winter-dpr1.png", output)), scale: "css" });
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { await writeFile(new URL("asset-retry-verification.json", output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, recoveredTextures: report.recoveredTextures.length, reusedKinds: report.poolReuse.length }));
