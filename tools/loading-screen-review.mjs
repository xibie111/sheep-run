import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/loading-screen-review/2026-10-10/", import.meta.url);
await mkdir(output, { recursive: true });
const origin = process.env.LOADING_REVIEW_URL || "http://127.0.0.1:4173";
const production = process.env.LOADING_REVIEW_PRODUCTION === "1";
const dpr = Number(process.env.LOADING_REVIEW_DPR || 1);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = { origin, production, dpr, contexts: "isolated, no user profile", viewports: [], failures: [] };
const screenshot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(dpr === 1 ? name : name.replace(".png", `-dpr${dpr}.png`), output)) });
async function inspectTip(page, index) {
  await page.evaluate(index => {
    document.querySelector(".loading-tip-text").textContent = window.loadingReviewTips[index];
    document.querySelector(".loading-tips-copy").style.right = "calc(10% + 1px)";
  }, index);
  await page.waitForTimeout(40);
  await page.evaluate(() => { document.querySelector(".loading-tips-copy").style.right = ""; });
  await page.waitForTimeout(40);
}
const rects = page => page.evaluate(() => {
  const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const sheep = document.querySelector(".loading-sheep");
  const copy = document.querySelector(".loading-tips-copy"), tipArt = document.querySelector(".loading-tip-text-art");
  const pixels = tipArt.getContext("2d").getImageData(0, 0, tipArt.width, tipArt.height).data;
  return { title: rect(".loading-title"), sheep: rect(".loading-sheep"), tips: rect(".loading-tips"), tipCopy: rect(".loading-tips-copy"), tipArt: rect(".loading-tip-text-art"), tipLayout: tipArt.dataset.layout ? JSON.parse(tipArt.dataset.layout) : null, drawnTip: tipArt.dataset.text, pixelFont: tipArt.dataset.font, tipHardAlpha: pixels.every((value, i) => i % 4 !== 3 || value === 0 || value === 255), tipPixels: pixels.some((value, i) => i % 4 === 3 && value > 0), copyOverflow: copy.scrollHeight > copy.clientHeight + 1, bar: rect(".loading-progress"),
    viewport: [innerWidth, innerHeight], progress: Number(document.querySelector("#loading-screen").dataset.progress),
    tip: document.querySelector(".loading-tip-text").textContent,
    sheepPixels: sheep.getContext("2d").getImageData(0, 0, 128, 112).data.filter((_, i) => i % 4 === 3).some(alpha => alpha > 0),
    hidden: document.querySelector("#loading-screen").hidden };
});
function checkLayout(layout) {
  const [width, height] = layout.viewport;
  for (const key of ["title", "sheep", "tips", "bar"]) {
    const box = layout[key];
    assert(box.x >= -0.1 && box.y >= -0.1 && box.right <= width + 0.1 && box.bottom <= height + 0.1, `${key} stays within viewport`);
  }
  assert(Math.abs(layout.sheep.w / layout.sheep.h - 128 / 112) < 0.001, "sheep uniform scaling");
  const box = layout.tipArt, inner = layout.tipCopy;
  assert(box.x >= inner.x - 0.5 && box.right <= inner.right + 0.5 && box.y >= inner.y - 0.5 && box.bottom <= inner.bottom + 0.5, "tip pixel canvas fits inner wood, excluding border and flowers");
  const text = layout.tipLayout;
  assert(text && text.titleY >= 0 && text.bodyY + text.lines.length * 14 * text.bodyScale <= text.height, "pixel text fits inner canvas");
  assert.equal(text.lines.join(""), layout.tip, "every character is painted");
  assert(layout.tipPixels && layout.tipHardAlpha && !layout.copyOverflow, "complete hard pixel tip visible");
  assert.equal(layout.pixelFont, "Ark Pixel 12 / integer pixels");
  assert(layout.bar.right < layout.tips.x || layout.bar.bottom < layout.tips.y, "tip plaque does not obscure progress");
  assert(layout.sheepPixels, "actual white sheep frame drawn");
  assert(!layout.hidden);
}
async function getGame(page, mainUrl) {
  await page.evaluate(async url => { window.loadingReviewGame = (await import(url)).game.instance; }, mainUrl);
  await page.waitForFunction(() => window.loadingReviewGame.scene.isActive("MenuScene") && window.loadingReviewGame.scene.getScene("MenuScene").children.list.length > 0);
}
async function target(page, sceneKey, name) {
  return page.evaluate(({ sceneKey, name }) => {
    const game = window.loadingReviewGame, scene = game.scene.getScene(sceneKey);
    const walk = list => { for (const o of list) { if (o.name === name) return o; if (o.list) { const match = walk(o.list); if (match) return match; } } };
    const o = walk(scene.children.list); if (!o) throw Error(`Missing ${name}`);
    const b = o.getBounds(), r = game.canvas.getBoundingClientRect(), size = game.scale.gameSize;
    return { x: r.x + (b.centerX - scene.cameras.main.scrollX * o.scrollFactorX) * r.width / size.width,
      y: r.y + (b.centerY - scene.cameras.main.scrollY * o.scrollFactorY) * r.height / size.height };
  }, { sceneKey, name });
}
async function tap(page, key, name) { const p = await target(page, key, name); await page.touchscreen.tap(p.x, p.y); }
try {
  for (const [width, height] of [[960, 540], [896, 414], [844, 390], [800, 600], [480, 270], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: dpr });
    const page = await context.newPage();
    const errors = []; let mainUrl;
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", request => { if (new RegExp(production ? "/assets/main-[^/]+\\.js" : "/src/main\\.ts").test(request.url())) mainUrl = request.url(); });
    let releaseModule, releaseAsset;
    const moduleGate = new Promise(resolve => { releaseModule = resolve; });
    const assetGate = new Promise(resolve => { releaseAsset = resolve; });
    await page.route(production ? "**/assets/main-*.js" : "**/src/main.ts*", async route => { await moduleGate; await route.continue(); });
    await page.route(production ? "**/assets/winter-*.png" : "**/assets/seasons/extensions-v2/winter.png*", async route => { await assetGate; await route.continue(); });
    await page.addInitScript(() => localStorage.setItem("loading-review-marker", "isolated-save"));
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector(".loading-tip-text-art").dataset.font && document.querySelector(".loading-sheep").getContext("2d").getImageData(0, 0, 128, 112).data.some((value, index) => index % 4 === 3 && value > 0));
    const beforeModule = await rects(page); checkLayout(beforeModule);
    assert.equal(beforeModule.progress, 0);
    releaseModule();
    await page.waitForFunction(() => { const p = Number(document.querySelector("#loading-screen").dataset.progress); return p > 0 && p < 100; });
    const initialTip = await page.locator(".loading-tip-text").textContent();
    await page.waitForFunction(first => document.querySelector(".loading-tip-text").textContent !== first, initialTip, { timeout: 10000 });
    const loading = await rects(page); checkLayout(loading);
    if (!production) {
      await page.evaluate(async () => {
        const { LOADING_TIPS } = await import("/src/data/loadingTips.ts");
        window.loadingReviewTips = LOADING_TIPS;
      });
      const tipCount = await page.evaluate(() => window.loadingReviewTips.length);
      for (let index = 0; index < tipCount; index++) {
        // Exercise the real fitting callback, even at a fixed minimum plaque width.
        await inspectTip(page, index);
        checkLayout(await rects(page));
      }
      await inspectTip(page, tipCount - 1);
      await screenshot(page, `loading-goodnight-${width}x${height}.png`);
      await inspectTip(page, 11);
      checkLayout(await rects(page));
    }
    await screenshot(page, `${production ? "production-" : ""}loading-${width}x${height}.png`);
    await page.touchscreen.tap(width / 2, height / 2);
    await page.mouse.click(width / 2, height / 2);
    const afterTouch = await rects(page);
    assert(!afterTouch.hidden && afterTouch.progress < 100, "loading touch/mouse cannot dismiss or bypass missing resources");
    await page.setViewportSize({ width: 800, height: 600 }); checkLayout(await rects(page));
    await page.setViewportSize({ width: 896, height: 414 }); checkLayout(await rects(page));
    await page.setViewportSize({ width, height });
    releaseAsset();
    await getGame(page, mainUrl);
    assert(await page.locator("#loading-screen").evaluate(el => el.hidden));
    const tipAfterLoad = await page.locator(".loading-tip-text").textContent();
    if (width === 960) {
      await page.waitForTimeout(3200);
      assert.equal(await page.locator(".loading-tip-text").textContent(), tipAfterLoad, "tip timer stopped after success");
    }
    await tap(page, "MenuScene", "button:开始游戏");
    await page.waitForFunction(() => window.loadingReviewGame.scene.isActive("RunScene"));
    await tap(page, "RunScene", "button:暂停");
    await page.waitForFunction(() => window.loadingReviewGame.scene.isActive("PauseScene"));
    const gameSheep = await page.evaluate(() => {
      const game = window.loadingReviewGame, sheep = game.scene.getScene("RunScene").sheep;
      const box = game.canvas.getBoundingClientRect(), size = game.scale.gameSize;
      return { width: sheep.displayWidth * box.width / size.width, height: sheep.displayHeight * box.height / size.height };
    });
    assert(Math.abs(loading.sheep.w - gameSheep.width) < 0.1 && Math.abs(loading.sheep.h - gameSheep.height) < 0.1, "loading sheep matches actual gameplay display size");
    await page.setViewportSize({ width: 800, height: 600 });
    assert(await page.locator("#loading-screen").evaluate(el => el.hidden));
    await tap(page, "PauseScene", "button:继续游戏");
    await page.waitForFunction(() => !window.loadingReviewGame.scene.isActive("PauseScene"));
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => localStorage.getItem("loading-review-marker")), "isolated-save");
    assert.deepEqual(errors, []);
    report.viewports.push({ width, height, beforeModule, loading, gameSheep, resizeDuringLoad: true, runPauseResumeResize: true, errors });
    await context.close();
  }
  // Missing bundled art uses the existing resource-independent Phaser retry UI.
  const context = await browser.newContext({ viewport: { width: 896, height: 414 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); let mainUrl, block = true;
  page.on("request", request => { if (new RegExp(production ? "/assets/main-[^/]+\\.js" : "/src/main\\.ts").test(request.url())) mainUrl = request.url(); });
  await page.route(production ? "**/assets/black-sheet-*.png" : "**/assets/skins/runtime-v1/black-sheet.png*", route => block ? route.abort() : route.continue());
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#game-status").textContent.includes("加载失败"));
  assert(await page.locator("#loading-screen").evaluate(el => el.hidden));
  await page.evaluate(async url => { window.loadingReviewGame = (await import(url)).game.instance; }, mainUrl);
  await screenshot(page, `${production ? "production-" : ""}load-failure.png`);
  const retry = await target(page, "PreloadScene", "button:重试");
  await page.mouse.click(retry.x, retry.y);
  assert(await page.locator("#game-status").textContent().then(text => text.includes("加载失败")));
  block = false;
  await page.touchscreen.tap(retry.x, retry.y);
  await getGame(page, mainUrl);
  assert(await page.locator("#loading-screen").evaluate(el => el.hidden));
  report.resourceFailure = { failedAsset: "black-sheet", mouseIgnored: true, touchRetry: "menu reached" };
  await context.close();
  // A failed game-module download has its own small, touch-only reload control.
  const bootContext = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const bootPage = await bootContext.newPage(); let failBoot = true, bootMain;
  bootPage.on("request", request => { if (new RegExp(production ? "/assets/main-[^/]+\\.js" : "/src/main\\.ts").test(request.url())) bootMain = request.url(); });
  await bootPage.route(production ? "**/assets/main-*.js" : "**/src/main.ts*", route => failBoot ? route.abort() : route.continue());
  await bootPage.goto(origin, { waitUntil: "domcontentloaded" });
  await bootPage.locator(".loading-retry").waitFor({ state: "visible" });
  const retryBox = await bootPage.locator(".loading-retry").boundingBox();
  await bootPage.mouse.click(retryBox.x + retryBox.width / 2, retryBox.y + retryBox.height / 2);
  await bootPage.keyboard.press("Enter");
  assert(await bootPage.locator(".loading-retry").isVisible());
  const cdp = await bootContext.newCDPSession(bootPage);
  const touch = { x: retryBox.x + retryBox.width / 2, y: retryBox.y + retryBox.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  assert(await bootPage.locator(".loading-retry").isVisible());
  failBoot = false;
  await bootPage.touchscreen.tap(touch.x, touch.y);
  await bootPage.waitForFunction(() => document.querySelector("#loading-screen").hidden);
  await getGame(bootPage, bootMain);
  report.bootstrapFailure = { mouseAndKeyboardIgnored: true, pointerCancel: true, touchReload: "menu reached" };
  await bootContext.close();
} catch (error) {
  report.failures.push(error.stack); process.exitCode = 1;
} finally {
  const reportName = production ? "production-verification" : "browser-verification";
  await writeFile(new URL(`${reportName}${dpr === 1 ? "" : `-dpr${dpr}`}.json`, output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ completedViewports: report.viewports.length, failures: report.failures, resourceFailure: report.resourceFailure }));
  await browser.close();
}
