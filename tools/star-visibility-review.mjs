import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/aegis/work/2026-10-12-star-unification/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = [];
try {
  for (const [width, height, dpr] of [[1672, 941, 1], [896, 414, 2], [800, 600, 1]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true });
    const page = await context.newPage(), errors = [], diagnostics = [];
    page.on("pageerror", error => { errors.push(error.message); console.error(error.stack); });
    page.on("console", message => {
      if (message.type() !== "error") return;
      if (message.text().startsWith("Ignored attempt to cancel")) diagnostics.push(message.text());
      else errors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 12345, selectedSkin: "white", unlockedSkins: ["white"],
        totalStars: 0, coins: 0, upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false } }));
      window.starIconDraws = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        if (this.canvas.dataset.runHudArt && args.length === 8 && window.starGame?.textures.get("star").getSourceImage() === source) {
          window.starIconDraws.push(args);
        }
        return original.call(this, source, ...args);
      };
    });
    await page.goto(process.env.STAR_REVIEW_URL || "http://localhost:11065");
    await page.evaluate(async () => { window.starGame = (await import("/src/main.ts")).game.instance; });
    await page.waitForFunction(() => window.starGame.scene.isActive("MenuScene") && document.querySelector("[data-menu-art]")?.dataset.layout);
    const frame = () => page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Render stalled")), 5000);
      window.starGame.events.once("postrender", () => { clearTimeout(timer); resolve(); });
    }));
    const point = (key, name) => page.evaluate(({ key, name }) => {
      const scene = window.starGame.scene.getScene(key), game = window.starGame;
      const find = list => { for (const child of list) { if (child.name === name) return child; if (child.list) { const found = find(child.list); if (found) return found; } } };
      const object = find(scene.children.list); if (!object) throw Error("Missing button " + name);
      const matrix = object.getWorldTransformMatrix(), rect = game.canvas.getBoundingClientRect(), size = game.scale.gameSize;
      return { x: rect.x + matrix.tx * rect.width / size.width, y: rect.y + matrix.ty * rect.height / size.height };
    }, { key, name });
    const tap = async (key, name) => { const p = await point(key, name); await page.touchscreen.tap(p.x, p.y); await frame(); };
    const shot = async name => { await frame(); await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}x${height}.png`, output)) }); };
    await tap("MenuScene", "button:开始游戏");
    await page.waitForFunction(() => window.starGame.scene.isActive("RunScene") && document.querySelector("[data-run-hud-art]")?.dataset.values);
    const setup = await page.evaluate(() => {
      const scene = window.starGame.scene.getScene("RunScene");
      scene.physics.world.pause(); scene.update = () => {};
      for (const group of [scene.obstacles, scene.stars, scene.powerUps]) for (const child of group.getChildren()) child.deactivate();
      const star = scene.acquireStar(); star.activate(120, 100, 0, 0);
      window.starFixture = star; window.starMisses = 0;
      const original = scene.scoreSystem.missStar.bind(scene.scoreSystem);
      scene.scoreSystem.missStar = () => { window.starMisses++; original(); };
      scene.scoreSystem.starStreak = 2;
      const image = star.texture.getSourceImage();
      return { logical: { width: scene.scale.gameSize.width, height: scene.scale.gameSize.height },
        cameraLeft: scene.cameras.main.scrollX, texture: star.texture.key, sourceSize: [image.width, image.height],
        bodySize: [star.body.width, star.body.height] };
    });
    await shot("star-before-sheep");
    const hud = await page.evaluate(() => ({ texture: document.querySelector("[data-run-hud-art]").dataset.starTexture,
      draws: window.starIconDraws, smoothing: document.querySelector("[data-run-hud-art]").getContext("2d").imageSmoothingEnabled }));
    assert.equal(hud.texture, setup.texture, "HUD and collectible use the same texture");
    assert.deepEqual(setup.sourceSize, [24, 24]); assert.deepEqual(setup.bodySize, [16, 16]);
    assert(hud.draws.some(args => args.slice(0, 4).join(",") === "0,0,24,24"), "Actual HUD draw uses the complete shared sprite");
    assert.equal(hud.smoothing, false);
    const place = x => page.evaluate(x => {
      const scene = window.starGame.scene.getScene("RunScene"), star = window.starFixture;
      star.body.reset(x, 100); scene.moveObjects(0);
      return { x: star.x, right: star.getBounds().right, active: star.active, visible: star.visible,
        missed: star.missed, misses: window.starMisses, streak: scene.scoreSystem.streak };
    }, x);
    const behind = await place(75);
    assert(behind.active && behind.visible && behind.missed, "Missed star remains visible behind the sheep");
    assert.equal(behind.misses, 1); assert.equal(behind.streak, 0, "Original missed-streak timing retained");
    await shot("star-behind-sheep");
    const partial = await place(setup.cameraLeft - 9);
    assert(partial.right > setup.cameraLeft && partial.active && partial.visible, "Keep the partly visible outline at the edge");
    assert.equal(partial.misses, 1, "Miss is recorded once");
    await shot("star-at-left-edge");
    const outside = await place(setup.cameraLeft - 14);
    assert(outside.right < setup.cameraLeft && !outside.active && !outside.visible, "Recycle only outside the visible left edge");
    assert.equal(outside.misses, 1);
    await shot("star-outside-screen");
    const pickup = await page.evaluate(() => {
      const scene = window.starGame.scene.getScene("RunScene"), star = window.starFixture;
      const before = scene.scoreSystem.starCount;
      star.activate(scene.sheep.x, scene.sheep.y - 19, 0, 0);
      scene.sheep.body.updateFromGameObject();
      const overlap = scene.physics.world.overlap(scene.sheep, star, (_sheep, item) => scene.onStarOverlap(item));
      return { overlap, before, after: scene.scoreSystem.starCount, collected: star.collected, active: star.active, missed: star.missed };
    });
    assert(pickup.overlap && pickup.collected && !pickup.active && !pickup.missed, "A reused sprite still collects through real overlap");
    assert.equal(pickup.after, pickup.before + 1);
    const cdp = await context.newCDPSession(page), p = await point("RunScene", "button:暂停");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y, id: 1 }] }); await frame();
    assert(await page.evaluate(() => window.starGame.scene.getScene("RunScene").pauseButton.getData("pressed")), "Pause press retained");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); await frame();
    assert(await page.evaluate(() => window.starGame.scene.isActive("RunScene") && !window.starGame.scene.getScene("RunScene").pauseButton.getData("pressed")), "Cancel does not pause");
    await tap("RunScene", "button:暂停");
    await page.waitForFunction(() => window.starGame.scene.isActive("PauseScene"));
    await shot("pause");
    await tap("PauseScene", "button:继续游戏");
    assert(await page.evaluate(() => window.starGame.scene.isActive("RunScene")), "Touch resumes");
    assert.deepEqual(errors, []);
    report.push({ viewport: [width, height, dpr], setup, hud, behind, partial, outside, pickup, errors, diagnostics });
    console.log("passed", width, height, "shared star draw / full edge lifecycle / real pickup / pause touch");
    await context.close();
  }
  await writeFile(new URL("browser-verification.json", output), JSON.stringify(report, null, 2) + "\n");
} finally { await browser.close(); }
