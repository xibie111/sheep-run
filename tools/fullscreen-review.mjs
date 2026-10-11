import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UI_PLAYWRIGHT_PATH || "C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/aegis/work/2026-10-08-adaptive-fullscreen/", import.meta.url);
await mkdir(new URL("screenshots/", output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = [];
try {
  for (const [width, height, logicalWidth, logicalHeight] of [[1672, 941, 480, 270], [896, 414, 584, 270], [800, 600, 480, 360]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(process.env.SHEEP_REVIEW_URL || "http://localhost:4173");
    await page.waitForFunction(async () => {
      const { game } = await import("/src/main.ts");
      window.reviewGame = game.instance;
      return game.instance.scene.isActive("MenuScene") && game.instance.scene.getScene("MenuScene").children.list.length > 0;
    });
    const frame = () => page.evaluate(() => new Promise(resolve => window.reviewGame.events.once("postrender", resolve)));
    const active = async key => {
      await page.waitForFunction(key => window.reviewGame.scene.isActive(key) && window.reviewGame.scene.getScene(key).children.list.length > 0, key);
      await frame();
    };
    const findTarget = (scene, name) => {
      const walk = objects => {
        for (const object of objects) {
          if (object.name === name) return object;
          if (object.list) { const result = walk(object.list); if (result) return result; }
        }
      };
      return walk(scene.children.list);
    };
    const target = async (key, name) => page.evaluate(({ key, name, findSource }) => {
      const find = (0, eval)("(" + findSource + ")");
      const scene = window.reviewGame.scene.getScene(key);
      const object = find(scene, name);
      if (!object) throw Error("Missing target: " + name);
      const b = object.getBounds(), r = window.reviewGame.canvas.getBoundingClientRect(), size = window.reviewGame.scale.gameSize;
      return { x: r.x + (b.centerX - scene.cameras.main.scrollX * object.scrollFactorX) * r.width / size.width,
        y: r.y + (b.centerY - scene.cameras.main.scrollY * object.scrollFactorY) * r.height / size.height };
    }, { key, name, findSource: findTarget.toString() });
    const tap = async (key, name) => { const t = await target(key, name); await page.touchscreen.tap(t.x, t.y); };
    const point = async (x, y) => page.evaluate(({ x, y }) => {
      const r = window.reviewGame.canvas.getBoundingClientRect(), size = window.reviewGame.scale.gameSize;
      return { x: r.x + x * r.width / size.width, y: r.y + y * r.height / size.height };
    }, { x, y });
    const screenshot = async (key, alias) => {
      await frame();
      const filename = alias || `${key}-${width}x${height}.png`;
      await page.screenshot({ path: fileURLToPath(new URL("screenshots/" + filename, output)) });
      return filename;
    };
    const audit = async key => page.evaluate(key => {
      const game = window.reviewGame, scene = game.scene.getScene(key), size = game.scale.gameSize;
      const r = game.canvas.getBoundingClientRect();
      const clipped = [], buttons = [], sheep = [];
      const inspect = objects => {
        for (const object of objects) {
          if (object.input || object.name?.includes("sheep") || object.name === "wardrobe-preview") {
            const b = object.getBounds(), camera = scene.cameras.main;
            const x = b.x - camera.scrollX * object.scrollFactorX, y = b.y - camera.scrollY * object.scrollFactorY;
            if (x < -0.5 || y < -0.5 || x + b.width > size.width + 0.5 || y + b.height > size.height + 0.5) clipped.push({ name: object.name, x, y, width: b.width, height: b.height });
            if (object.input) buttons.push({ name: object.name, x, y, width: b.width, height: b.height });
            else sheep.push({ name: object.name, width: b.width, height: b.height });
          }
          if (object.list && object.name !== "ui-pasture-backdrop") inspect(object.list);
        }
      };
      inspect(scene.children.list);
      return { scene: key, logical: { width: size.width, height: size.height },
        canvas: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, pixels: [game.canvas.width, game.canvas.height] },
        container: { width: document.getElementById("game-container").clientWidth, height: document.getElementById("game-container").clientHeight },
        scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        imageRendering: getComputedStyle(game.canvas).imageRendering, clipped, buttons, sheep,
        camera: { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY } };
    }, key);
    const check = details => {
      assert.deepEqual(details.logical, { width: logicalWidth, height: logicalHeight });
      assert.deepEqual(details.container, { width, height });
      assert.deepEqual(details.scroll, [width, height]);
      assert(details.canvas.x <= 0.01 && details.canvas.y <= 0.01 && details.canvas.right >= width - 0.01 && details.canvas.bottom >= height - 0.01, "canvas covers all four edges");
      assert(Math.abs(details.canvas.width / logicalWidth - details.canvas.height / logicalHeight) < 0.0001, "uniform scaling");
      assert.equal(details.imageRendering, "pixelated");
      assert.deepEqual(details.clipped, [], "no clipped touch buttons or preview sheep");
    };
    const scenes = [];
    let details = await audit("MenuScene"); check(details); scenes.push(details);
    await screenshot("menu", width === 1672 ? "fullscreen-landscape.png" : undefined);
    await tap("MenuScene", "button:衣橱"); await active("WardrobeScene");
    details = await audit("WardrobeScene"); check(details); scenes.push(details); await screenshot("wardrobe");
    await tap("WardrobeScene", "skin-card:golden");
    details = await audit("WardrobeScene"); check(details);
    await tap("WardrobeScene", "button:返回"); await active("MenuScene");
    await tap("MenuScene", "button:开始游戏"); await active("RunScene");
    details = await audit("RunScene"); check(details); scenes.push(details);
    const before = await page.evaluate(() => {
      const scene = window.reviewGame.scene.getScene("RunScene");
      window.reviewGestures = [];
      const original = scene.inputSystem.handleGesture.bind(scene.inputSystem);
      scene.inputSystem.handleGesture = event => { window.reviewGestures.push(event); return original(event); };
      window.reviewJumps = [];
      const applyJump = scene.sheep.applyJump.bind(scene.sheep);
      scene.sheep.applyJump = kind => { window.reviewJumps.push(kind); return applyJump(kind); };
      return { x: scene.sheep.x, width: scene.sheep.displayWidth, height: scene.sheep.displayHeight, bounds: { ...scene.physics.world.bounds } };
    });
    const playPoint = await point(logicalWidth / 2, 120);
    await page.mouse.click(playPoint.x, playPoint.y); await frame();
    assert.equal(await page.evaluate(() => window.reviewGestures.length), 0, "mouse ignored");
    // Playwright dispatches the CDP touch pair together, keeping this a tap.
    await page.touchscreen.tap(playPoint.x, playPoint.y);
    await page.waitForFunction(() => window.reviewJumps.includes("normal"));
    assert(await page.evaluate(() => window.reviewGestures.some(event => event.type === "down") && window.reviewGestures.some(event => event.type === "up")), "real CDP touch jump");
    await tap("RunScene", "button:暂停"); await active("PauseScene");
    // Pause before slow screenshots, so a natural collision cannot retire the player.
    await page.evaluate(() => { window.reviewGame.scene.getScene("PauseScene").sys.setVisible(false); });
    await screenshot("run", width === 896 ? "wide-road-landscape.png" : width === 800 ? "narrow-landscape.png" : undefined);
    await page.evaluate(() => { window.reviewGame.scene.getScene("PauseScene").sys.setVisible(true); });
    details = await audit("PauseScene"); check(details); scenes.push(details);
    await screenshot("pause", width === 896 ? "pause-wide-landscape.png" : undefined);
    await tap("PauseScene", "button:继续游戏"); await active("RunScene");
    await tap("RunScene", "button:暂停"); await active("PauseScene");
    await page.evaluate(() => {
      const run = window.reviewGame.scene.getScene("RunScene");
      window.reviewRestart = undefined;
      run.events.once("create", () => { window.reviewRestart = { clock: run.activeRunTimeMs, score: run.scoreSystem.score }; });
    });
    await tap("PauseScene", "button:重新开始"); await active("RunScene");
    await page.waitForFunction(() => window.reviewRestart !== undefined);
    assert.deepEqual(await page.evaluate(() => window.reviewRestart), { clock: 0, score: 0 }, "touch restart reset the run at scene creation");
    await tap("RunScene", "button:暂停"); await active("PauseScene");
    if (width === 896) {
      await page.evaluate(() => {
        const run = window.reviewGame.scene.getScene("RunScene");
        window.reviewRun = run.sheep;
        window.reviewScore = run.scoreSystem.score;
      });
      await page.setViewportSize({ width: 800, height: 600 });
      await page.waitForFunction(() => window.reviewGame.scale.gameSize.height === 360);
      await frame();
      const resized = await page.evaluate(() => {
        const run = window.reviewGame.scene.getScene("RunScene");
        return { sameSheep: run.sheep === window.reviewRun, sameScore: run.scoreSystem.score === window.reviewScore, x: run.sheep.x,
          width: run.sheep.displayWidth, height: run.sheep.displayHeight, bounds: { ...run.physics.world.bounds },
          camera: [run.cameras.main.scrollX, run.cameras.main.scrollY] };
      });
      assert(resized.sameSheep && resized.sameScore, "resize preserves the paused run");
      assert.deepEqual([resized.x, resized.width, resized.height, resized.bounds], [before.x, before.width, before.height, before.bounds], "resize preserves physics and player proportions");
      await screenshot("pause-resized", "pause-resized-800x600.png");
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => window.reviewGame.scale.gameSize.width === 584 && window.reviewGame.scale.gameSize.height === 270);
      await frame();
      details = await audit("PauseScene"); check(details);
      scenes.push({ resize: resized });
    }
    await tap("PauseScene", "button:返回首页"); await active("MenuScene");
    // A seeded result checks its layout and touch navigation without altering score rules.
    await page.evaluate(() => window.reviewGame.scene.getScene("MenuScene").scene.start("ResultScene", { score: 123, best: 200, newRecord: false, coinsEarned: 0, coinBalance: 0 }));
    await active("ResultScene"); details = await audit("ResultScene"); check(details); scenes.push(details); await screenshot("result");
    await tap("ResultScene", "button:再跑一次"); await active("RunScene");
    assert.deepEqual(errors, [], "no browser runtime errors");
    report.push({ width, height, errors, touch: "wardrobe, selection, back, start, jump, pause, resume, restart, home, result retry passed", mouse: "ignored", scenes });
    await writeFile(new URL("browser-evidence.json", output), JSON.stringify(report, null, 2));
    console.log(`PASS ${width}x${height} => ${logicalWidth}x${logicalHeight}: full coverage, uniform pixels, touch navigation`);
    await context.close();
  }
} finally { await browser.close(); }
