import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/background-review/2026-10-08/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = [];
try {
  for (const [width, height] of [[1600, 900], [896, 414], [844, 390], [800, 600]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto(process.env.BACKGROUND_REVIEW_URL || "http://localhost:4186/");
    await page.evaluate(async () => {
      const { game } = await import("/src/main.ts");
      window.reviewGame = game.instance;
    });
    await page.waitForFunction(() => window.reviewGame.scene.isActive("MenuScene") && window.reviewGame.scene.getScene("MenuScene").children.list.some(o => o.name === "ui-pasture-backdrop"));
    const frame = async () => page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Background review render timed out")), 5000);
      window.reviewGame.events.once("postrender", () => { clearTimeout(timer); resolve(); });
    }));
    const snap = async name => { await frame(); await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}x${height}.png`, output)) }); };
    const tap = async (sceneKey, name) => {
      const target = await page.evaluate(({ sceneKey, name }) => {
        const scene = window.reviewGame.scene.getScene(sceneKey);
        const object = scene.children.list.find(o => o.name === name);
        if (!object) throw Error("Missing button: " + name);
        const bounds = object.getBounds(), canvas = window.reviewGame.canvas.getBoundingClientRect(), size = window.reviewGame.scale.gameSize;
        return { x: canvas.x + bounds.centerX * canvas.width / size.width, y: canvas.y + bounds.centerY * canvas.height / size.height };
      }, { sceneKey, name });
      await page.touchscreen.tap(target.x, target.y);
      await frame();
    };
    const menu = await page.evaluate(() => {
      const game = window.reviewGame, scene = game.scene.getScene("MenuScene"), size = game.scale.gameSize;
      const image = scene.children.list.find(o => o.name === "ui-pasture-backdrop").list[0];
      const bounds = image.getBounds(), rect = game.canvas.getBoundingClientRect();
      return {
        texture: image.texture.key, uniform: image.scaleX === image.scaleY,
        covers: bounds.x <= 0 && bounds.y <= 0 && bounds.right >= size.width && bounds.bottom >= size.height,
        canvasCovers: rect.x <= 0.5 && rect.y <= 0.5 && rect.right >= innerWidth - 0.5 && rect.bottom >= innerHeight - 0.5,
        scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      };
    });
    assert.equal(menu.texture, "illustrated-pasture-menu");
    assert.ok(menu.uniform && menu.covers && menu.canvasCovers);
    assert.deepEqual(menu.scroll, [width, height]);
    await snap("menu");
    await tap("MenuScene", "button:衣橱");
    await page.waitForFunction(() => window.reviewGame.scene.isActive("WardrobeScene"));
    await snap("wardrobe");
    await tap("WardrobeScene", "button:返回");
    await page.waitForFunction(() => window.reviewGame.scene.isActive("MenuScene"));
    await tap("MenuScene", "button:开始游戏");
    await page.waitForFunction(() => window.reviewGame.scene.isActive("RunScene"));
    await page.evaluate(() => window.reviewGame.scene.pause("RunScene"));
    const run = await page.evaluate(() => {
      const game = window.reviewGame, scene = game.scene.getScene("RunScene"), parallax = scene.environmentSystem.parallax;
      const layers = ["pasture-far-mountain", "pasture-treeline", "pasture-ground"].map(key => {
        const source = game.textures.get(key).getSourceImage();
        const ctx = source.getContext("2d");
        const left = [...ctx.getImageData(0, 0, 1, source.height).data];
        const right = [...ctx.getImageData(source.width - 1, 0, 1, source.height).data];
        const beforeMirror = [...ctx.getImageData(479, 0, 1, source.height).data];
        const afterMirror = [...ctx.getImageData(480, 0, 1, source.height).data];
        return { key, width: source.width, height: source.height, edgeMatches: left.every((n, i) => n === right[i]), mirrorMatches: beforeMirror.every((n, i) => n === afterMirror[i]) };
      });
      parallax.update(959);
      const before = parallax.snapshot();
      parallax.update(960);
      const wrapped = parallax.snapshot();
      const near = game.textures.get("illustrated-pasture-near").getSourceImage();
      const canvas = document.createElement("canvas"); canvas.width = near.width; canvas.height = near.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(near, 0, 0);
      const alpha = [ctx.getImageData(near.width / 2, 0, 1, 1).data[3], ctx.getImageData(near.width / 2, near.height - 1, 1, 1).data[3]];
      parallax.update(0);
      return { layers, alpha, groundBefore: before.find(l => l.key === "pasture-ground").x, groundWrapped: wrapped.find(l => l.key === "pasture-ground").x, ratios: wrapped.filter(l => ["pasture-far-mountain", "pasture-treeline", "pasture-ground"].includes(l.key)).map(l => l.ratio) };
    });
    assert.ok(run.layers.every(layer => layer.width === 960 && layer.height === 270 && layer.edgeMatches && layer.mirrorMatches));
    assert.equal(run.alpha[0], 0);
    assert.ok(run.alpha[1] >= 250, "Road pixels are effectively opaque");
    assert.equal(run.groundBefore, 959); assert.equal(run.groundWrapped, 0);
    assert.deepEqual(run.ratios, [0.15, 0.24, 1]);
    await snap("run");
    await page.evaluate(() => window.reviewGame.scene.getScene("RunScene").environmentSystem.parallax.update(2000));
    await snap("run-scrolled");
    await page.evaluate(() => {
      window.reviewGame.scene.stop("RunScene");
      window.reviewGame.scene.start("ResultScene", { score: 125, best: 125, newRecord: true });
    });
    await snap("result");
    assert.deepEqual(errors, []);
    report.push({ width, height, menu, run, errors });
    console.log(`${width}x${height}: background, seamless repeats, alpha, touch navigation and console passed`);
    await context.close();
  }
  await writeFile(new URL("acceptance.json", output), JSON.stringify({ passed: true, viewports: report }, null, 2));
} finally {
  await browser.close();
}
