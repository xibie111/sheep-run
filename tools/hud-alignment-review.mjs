import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/hud-alignment-review/2026-10-09/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = [];
try {
  for (const [width, height, dpr] of [[1672, 941, 1], [896, 414, 2], [800, 600, 1], [390, 844, 2]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: dpr });
    const page = await context.newPage(), errors = [], checks = [];
    page.on("pageerror", error => { errors.push(error.message); console.error(error.stack); });
    page.on("console", message => {
      if (message.type() === "error" && !message.text().startsWith("Ignored attempt to cancel")) errors.push(message.text());
    });
    await page.addInitScript(() => {
      window.hudArtDraws = [];
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
        if (this.canvas.dataset.runHudArt && args.length === 8) window.hudArtDraws.push(args.slice(0, 4));
        return drawImage.call(this, image, ...args);
      };
    });
    await page.addInitScript(() => localStorage.setItem("sheep-run-save", JSON.stringify({
      version: 4, highScore: 12345, totalStars: 0, coins: 0, selectedSkin: "white", unlockedSkins: ["white"],
      upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 0, sfxVolume: 0 },
    })));
    await page.goto(process.env.HUD_ALIGNMENT_URL || "http://127.0.0.1:4195/");
    await page.evaluate(async () => { window.reviewGame = (await import("/src/main.ts")).game.instance; });
    const ready = key => page.waitForFunction(key => {
      const game = window.reviewGame, scene = game.scene.getScene(key);
      return game.scene.isActive(key) && scene.children.list.length > 0;
    }, key);
    const frame = () => page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("render stalled")), 5000);
      window.reviewGame.events.once("postrender", () => { clearTimeout(timer); resolve(); });
    }));
    const point = (key, name) => page.evaluate(({ key, name }) => {
      const game = window.reviewGame, object = game.scene.getScene(key).children.list.find(object => object.name === name);
      if (!object) throw Error("missing " + name);
      const bounds = object.getData("hud-rect") || object.getBounds(), rect = game.canvas.getBoundingClientRect(), size = game.scale.gameSize;
      return { x: rect.x + (bounds.x + bounds.width / 2) * rect.width / size.width,
        y: rect.y + (bounds.y + bounds.height / 2) * rect.height / size.height };
    }, { key, name });
    const tap = async (key, name) => { const position = await point(key, name); await page.touchscreen.tap(position.x, position.y); await frame(); };
    const shot = async name => { await frame(); await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}x${height}.png`, output)) }); };
    const check = (name, passed) => { assert.ok(passed, name); checks.push(name); };
    const audit = () => page.evaluate(() => {
      const game = window.reviewGame, scene = game.scene.getScene("RunScene"), canvas = document.querySelector("[data-run-hud-art]");
      const layout = JSON.parse(canvas.dataset.layout), typography = JSON.parse(canvas.dataset.typography);
      const target = scene.children.list.find(object => object.name === "button:暂停");
      const surface = canvas.getBoundingClientRect(), gameRect = game.canvas.getBoundingClientRect();
      const counters = ["score", "best", "stars", "streak"];
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      const scale = canvas.width / game.scale.gameSize.width;
      const inkPixels = Object.fromEntries(counters.map(name => {
        const rect = typography[name].number.ink;
        let count = 0;
        for (let y = Math.max(0, Math.floor(rect.y * scale)); y < Math.min(canvas.height, Math.ceil((rect.y + rect.height) * scale)); y++) {
          for (let x = Math.max(0, Math.floor(rect.x * scale)); x < Math.min(canvas.width, Math.ceil((rect.x + rect.width) * scale)); x++) {
            const index = (y * canvas.width + x) * 4;
            if (pixels[index] >= 35 && pixels[index] <= 130 && pixels[index + 1] < 80 && pixels[index + 2] < 55 && pixels[index + 3] === 255) count++;
          }
        }
        return [name, count];
      }));
      return { layout, typography, inkPixels, values: JSON.parse(canvas.dataset.values), plaques: canvas.dataset.plaques,
        starIcon: JSON.parse(canvas.dataset.starIcon), starFrame: canvas.dataset.starFrame,
        starFrameDraws: window.hudArtDraws.filter(rect => rect[0] === 66 && rect[1] === 511 && rect[2] === 522 && rect[3] === 167).length,
        target: { x: target.x, y: target.y, width: target.width, height: target.height, rect: target.getData("hud-rect"),
          hitWidth: target.input.hitArea.width, hitHeight: target.input.hitArea.height },
        logical: { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
        physical: { width: canvas.width, height: canvas.height }, surface: { x: surface.x, y: surface.y, width: surface.width, height: surface.height },
        gameRect: { x: gameRect.x, y: gameRect.y, width: gameRect.width, height: gameRect.height },
        pointerEvents: getComputedStyle(canvas).pointerEvents, fontKeys: game.cache.bitmapFont.getKeys(),
        systemText: scene.children.list.filter(object => object.type === "Text").length };
    });
    const alignment = (state, name) => {
      const counters = ["score", "best", "stars", "streak"], panels = counters.map(key => state.layout[key]);
      const left = state.layout.score, right = state.layout.best, row = [left, state.layout.pause, right];
      check(name + " only score and best use full plaques", state.plaques === "score,best");
      check(name + " matching score plaque bounds", left.width === right.width && left.height === right.height && left.y === right.y);
      check(name + " common numeral size and score baseline", new Set(counters.map(key => state.typography[key].number.fontSize)).size === 1 && state.typography.score.number.baseline === state.typography.best.number.baseline);
      check(name + " original star column remains centered", ["pause", "stars", "streak"].every(key => Math.abs(state.layout[key].x + state.layout[key].width / 2 - state.logical.width / 2) < 1e-7));
      const starInk = state.typography.stars.number.ink, starIcon = state.starIcon;
      check(name + " frameless star icon and live digits stay centered", state.starFrame === "false" && state.starFrameDraws === 0 && Math.abs((starIcon.x + starInk.x + starInk.width) / 2 - state.logical.width / 2) < 1e-7 && Math.abs(starIcon.y + starIcon.height / 2 - starInk.y - starInk.height / 2) < 1e-7);
      check(name + " controls fit without overlap", Object.values(state.layout).every(rect => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= state.logical.width && rect.y + rect.height <= state.logical.height) && row.every((rect, index) => index === row.length - 1 || rect.x + rect.width <= row[index + 1].x + 1e-7) && state.layout.pause.y + state.layout.pause.height < state.layout.stars.y && state.layout.stars.y + state.layout.stars.height < state.layout.streak.y);
      const pause = state.layout.pause, target = state.target;
      check(name + " pause artwork matches touch bounds", JSON.stringify(target.rect) === JSON.stringify(pause) && target.width === pause.width && target.hitWidth === pause.width && target.height === pause.height && target.hitHeight === pause.height && target.x === pause.x + pause.width / 2 && target.y === pause.y + pause.height / 2);
      check(name + " physical canvas avoids fractional pixels", Math.abs(state.surface.width * dpr - state.physical.width) < 1e-6 && Math.abs(state.surface.height * dpr - state.physical.height) < 1e-6 && Math.abs(state.surface.x - state.gameRect.x) <= 1 / dpr && Math.abs(state.surface.y - state.gameRect.y) <= 1 / dpr);
    };
    await ready("MenuScene");
    await tap("MenuScene", "button:开始游戏"); await ready("RunScene"); await frame();
    const initial = await audit(); alignment(initial, "initial");
    check("one font family, no system HUD text, no DOM touch interception", initial.fontKeys.length === 4 && initial.fontKeys.every(key => key.startsWith("pasture-display-")) && initial.systemText === 0 && initial.pointerEvents === "none");
    check("digits actually draw brown ink on every visible counter", ["score", "best", "stars"].every(key => initial.inkPixels[key] > 0) && initial.typography.streak.number.visible === false);
    check("saved best score appears", initial.values.best === 12345);
    const cdp = await context.newCDPSession(page), pausePoint = await point("RunScene", "button:暂停");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...pausePoint, id: 1 }] }); await frame();
    check("pause press has visible state", await page.evaluate(() => document.querySelector("[data-run-hud-art]").dataset.pressed === "true"));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); await frame();
    check("touch cancellation clears pause press without activating", await page.evaluate(() => document.querySelector("[data-run-hud-art]").dataset.pressed === "false" && !window.reviewGame.scene.isPaused("RunScene")));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...pausePoint, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: pausePoint.x - 100, y: pausePoint.y + 80, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await frame();
    check("dragging out cancels pause", await page.evaluate(() => document.querySelector("[data-run-hud-art]").dataset.pressed === "false" && !window.reviewGame.scene.isPaused("RunScene")));
    await page.evaluate(() => {
      const scene = window.reviewGame.scene.getScene("RunScene");
      for (let index = 0; index < 12; index++) { const star = scene.acquireStar(); star.activate(350, 150, 0, scene.speed); scene.onStarOverlap(star); }
    }); await frame();
    const milestone = await audit(); alignment(milestone, "milestone");
    check("live score, star count, streak and milestone render together", milestone.values.score > initial.values.score && milestone.values.stars === 12 && milestone.values.streak === 12 && milestone.values.milestone === 10);
    await shot("run");
    await tap("RunScene", "button:暂停"); await ready("PauseScene"); await shot("pause");
    const frozen = await page.evaluate(() => document.querySelector("[data-run-hud-art]").dataset.values);
    await frame(); await frame();
    check("pause dims and freezes HUD", await page.evaluate(frozen => {
      const canvas = document.querySelector("[data-run-hud-art]");
      return canvas.dataset.paused === "true" && canvas.dataset.values === frozen && window.reviewGame.scene.isPaused("RunScene");
    }, frozen));
    await page.setViewportSize({ width: 960, height: 540 }); await frame(); await frame();
    const resized = await audit(); alignment(resized, "paused resize");
    await page.setViewportSize({ width, height }); await frame(); await frame();
    await tap("PauseScene", "button:继续游戏"); await ready("RunScene");
    await page.waitForFunction(() => JSON.parse(document.querySelector("[data-run-hud-art]").dataset.values).milestone === null, null, { timeout: 3000 });
    const resumed = await audit(); alignment(resumed, "resumed");
    check("milestone clears without moving star and streak counters", resumed.values.stars === 12 && resumed.values.streak === 12 && resumed.typography.stars.number.baseline === milestone.typography.stars.number.baseline);
    await shot("run-normal");
    await tap("RunScene", "button:暂停"); await ready("PauseScene");
    await page.evaluate(() => {
      const score = window.reviewGame.scene.getScene("RunScene").scoreSystem;
      score.bonus = 999999999999999; score.bestAtRunStart = 999999999999999; score.collectedStars = 123456789; score.starStreak = 123456789;
    }); await frame();
    const huge = await audit(); alignment(huge, "large values");
    check("large counters shrink together and stay inside controls", huge.typography.score.number.fontSize < initial.typography.score.number.fontSize && ["score", "best"].every(key => huge.typography[key].number.width <= initial.layout[key].width - 40 + 1e-7) && huge.typography.stars.number.width <= initial.layout.stars.width * 0.45 + 1e-7);
    await tap("PauseScene", "button:重新开始"); await ready("RunScene"); await frame();
    check("restart resets counters and leaves one HUD", await page.evaluate(() => document.querySelectorAll("[data-run-hud-art]").length === 1 && JSON.parse(document.querySelector("[data-run-hud-art]").dataset.values).stars === 0));
    await tap("RunScene", "button:暂停"); await ready("PauseScene");
    await tap("PauseScene", "button:返回首页"); await ready("MenuScene");
    check("return home removes HUD", await page.evaluate(() => !document.querySelector("[data-run-hud-art]")));
    check("no browser errors", errors.length === 0);
    report.push({ viewport: { width, height, dpr }, initial, milestone, resized, resumed, huge, checks, errors });
    console.log(`${width}x${height}@${dpr}: ${checks.length} checks passed`);
    await context.close();
  }
  await writeFile(new URL("acceptance.json", output), JSON.stringify({ passed: true, report }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, viewports: report.length, checks: report.reduce((count, entry) => count + entry.checks.length, 0) }));
} finally { await browser.close(); }
