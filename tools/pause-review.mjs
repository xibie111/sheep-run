import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/pause-review/2026-10-09/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = [];
try {
  for (const [width, height] of [[1672, 941], [896, 414], [844, 390], [800, 600]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [], diagnostics = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => {
      if (msg.type() !== "error") return;
      if (msg.text().startsWith("Ignored attempt to cancel a touchcancel event with cancelable=false")) diagnostics.push(msg.text());
      else errors.push(msg.text());
    });
    await page.goto(process.env.PAUSE_REVIEW_URL || "http://localhost:4191/");
    await page.evaluate(async () => { window.pauseReviewGame = (await import("/src/main.ts")).game.instance; });
    const ready = async key => page.waitForFunction(key => {
      const g = window.pauseReviewGame, s = g.scene.getScene(key);
      return g.scene.isActive(key) && s.children.list.length > 0;
    }, key);
    const frame = async () => page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Render stalled")), 5000);
      window.pauseReviewGame.events.once("postrender", () => { clearTimeout(timer); resolve(); });
    }));
    const target = async (key, name) => page.evaluate(({key, name}) => {
      const g = window.pauseReviewGame, o = g.scene.getScene(key).children.list.find(o => o.name === name);
      if (!o) throw Error("Missing target: " + name);
      const bounds = o.getBounds(), r = g.canvas.getBoundingClientRect(), size = g.scale.gameSize;
      return { x: r.x + bounds.centerX * r.width / size.width, y: r.y + bounds.centerY * r.height / size.height, pressed: o.getData("pressed") };
    }, {key, name});
    const tap = async (key, name) => { const p = await target(key, name); await page.touchscreen.tap(p.x, p.y); await frame(); };
    const screenshot = async name => { await frame(); await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}x${height}.png`, output)) }); };
    const checks = [];
    const check = (name, value) => { assert.ok(value, name); checks.push(name); };
    await ready("MenuScene");
    await tap("MenuScene", "button:开始游戏"); await ready("RunScene");
    await tap("RunScene", "button:暂停"); await ready("PauseScene");
    const audit = await page.evaluate(() => {
      const g = window.pauseReviewGame, s = g.scene.getScene("PauseScene"), size = g.scale.gameSize;
      const art = s.children.list.find(o => o.name === "pause-dialog-art"), overlay = s.children.list.find(o => o.name === "pause-dim-overlay");
      const bounds = art.getBounds(), o = overlay.getBounds();
      const buttons = s.children.list.filter(o => o.name.startsWith("button:")).map(o => ({ name: o.name, bounds: o.getBounds() }));
      return { texture: art.texture.key, frame: art.frame.name, uniform: Math.abs(art.scaleX-art.scaleY)<0.000001,
        buttons, panelInBounds: bounds.x >= 0 && bounds.y >= 0 && bounds.right <= size.width && bounds.bottom <= size.height,
        overlayCovers: o.x <= 0 && o.y <= 0 && o.right >= size.width && o.bottom >= size.height,
        paused: g.scene.isPaused("RunScene"), runTime: g.scene.getScene("RunScene").activeRunTimeMs,
        texts: s.children.list.filter(o => o.type === "BitmapText").map(o => o.text),
      };
    });
    check("reference art is loaded", audit.texture === "ui-pause-reference-dialog" && audit.frame === "dialog");
    check("panel scales uniformly and stays visible", audit.uniform && audit.panelInBounds);
    check("dim overlay covers the full viewport", audit.overlayCovers);
    check("three reference actions are present", JSON.stringify(audit.buttons.map(o=>o.name)) === JSON.stringify(["button:继续游戏","button:重新开始","button:返回首页"]));
    check("run is paused beneath the overlay", audit.paused);
    check("audio rows are absent from run pause", !audit.texts.some(t=>/音乐|音效/.test(t)));
    await screenshot("pause");
    const p = await target("PauseScene", "button:继续游戏"), cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x:p.x,y:p.y,id:1 }] }); await frame();
    check("button responds visually to a touch press", (await target("PauseScene","button:继续游戏")).pressed === true);
    await screenshot("pause-pressed");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); await frame();
    check("OS cancellation restores the button", (await target("PauseScene","button:继续游戏")).pressed === false);
    check("OS cancellation preserves pause", await page.evaluate(()=>window.pauseReviewGame.scene.isActive("PauseScene")));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x:p.x,y:p.y,id:1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x:20,y:20,id:1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await frame();
    check("dragging outside cancels the action", await page.evaluate(()=>window.pauseReviewGame.scene.isActive("PauseScene")));
    const afterTime = await page.evaluate(()=>window.pauseReviewGame.scene.getScene("RunScene").activeRunTimeMs);
    check("run simulation remains frozen", afterTime === audit.runTime);
    await tap("PauseScene", "button:继续游戏"); await ready("RunScene");
    check("continue resumes and closes pause", await page.evaluate(()=>!window.pauseReviewGame.scene.isPaused("RunScene") && !window.pauseReviewGame.scene.isActive("PauseScene")));
    await tap("RunScene", "button:暂停"); await ready("PauseScene");
    await tap("PauseScene", "button:重新开始"); await ready("RunScene");
    check("restart resets active run time", await page.evaluate(()=>window.pauseReviewGame.scene.getScene("RunScene").activeRunTimeMs<1000));
    await tap("RunScene", "button:暂停"); await ready("PauseScene");
    await tap("PauseScene", "button:返回首页"); await ready("MenuScene");
    check("home closes both run and pause", await page.evaluate(()=>!window.pauseReviewGame.scene.isActive("RunScene") && !window.pauseReviewGame.scene.isActive("PauseScene")));
    await tap("MenuScene", "button:settings"); await ready("PauseScene");
    check("menu overlay also omits audio controls", await page.evaluate(()=>{
      const s=window.pauseReviewGame.scene.getScene("PauseScene");
      return s.children.list.some(o=>o.name==="pause-dialog-art") && !s.children.list.some(o=>o.type==="BitmapText" && /音乐|音效/.test(o.text));
    }));
    await screenshot("settings");
    await tap("PauseScene", "button:继续游戏"); await ready("MenuScene");
    check("continue closes the menu overlay", await page.evaluate(()=>!window.pauseReviewGame.scene.isActive("PauseScene") && !window.pauseReviewGame.scene.isPaused("MenuScene")));
    await tap("MenuScene", "button:settings"); await ready("PauseScene");
    await tap("PauseScene", "button:重新开始"); await ready("RunScene");
    check("restart from the menu overlay starts a run", await page.evaluate(()=>!window.pauseReviewGame.scene.isActive("PauseScene")));
    await tap("RunScene", "button:暂停"); await ready("PauseScene");
    await tap("PauseScene", "button:返回首页"); await ready("MenuScene");
    check("no page or console errors", errors.length === 0);
    report.push({width,height,checks,audit,errors,diagnostics});
    console.log(`${width}x${height}: ${checks.length} pause checks passed`);
    await context.close();
  }
  await writeFile(new URL("acceptance.json",output),JSON.stringify({passed:true,viewports:report},null,2));
} finally { await browser.close(); }
