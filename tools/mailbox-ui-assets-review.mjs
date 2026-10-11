import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/mailbox-review/2026-10-11/ui-v2-acceptance/", import.meta.url);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = { engine: "Edge Chromium mobile touch emulation", phoneHardware: false, cases: [], errors: [] };
try {
  for (const [file, key] of [["mail-letter-panel", "mail-letter-panel-v2"], ["mail-button-plain", "mail-button-plain-v2"], ["mail-button-floral", "mail-button-floral-v2"]]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("sheep-run-mailbox-v1", '{"version":1,"readIds":["retired-letter"]}'));
    const glob = `**/assets/${file}-*.png`;
    await page.route(glob, route => route.abort());
    const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
    await page.goto("http://127.0.0.1:4199");
    await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, (await request).url());
    await page.waitForFunction(() => window.g.scene.getScene("PreloadScene").children.getByName("local-load-error"));
    assert(!await page.evaluate(() => window.g.scene.isActive("MenuScene")), "invalid UI image cannot enter menu");
    const tap = async (sceneKey, name) => {
      const p = await page.evaluate(({ sceneKey, name }) => { const b = window.g.scene.getScene(sceneKey).children.getByName(name).getBounds(), r = window.g.canvas.getBoundingClientRect(), s = window.g.scale.gameSize; return { x: r.x + b.centerX * r.width / s.width, y: r.y + b.centerY * r.height / s.height }; }, { sceneKey, name });
      await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(60);
    };
    await page.screenshot({ path: fileURLToPath(new URL(`${file}-load-failure.png`, output)) });
    await page.unroute(glob); await tap("PreloadScene", "button:重试");
    await page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
    assert(await page.evaluate(key => { const im = window.g.textures.get(key).getSourceImage(); return im.width > 0 && im.height > 0; }, key));
    assert.equal(await page.evaluate(() => localStorage.getItem("sheep-run-mailbox-v1")), '{"version":1,"readIds":["retired-letter"]}');
    await tap("MenuScene", "mailbox-entry"); await tap("MenuScene", "mailbox-letter:welcome-v1");
    assert.equal(await page.locator('[data-adventure-overlay="mailbox"]').evaluate(c => c.dataset.letter), "welcome-v1");
    await page.screenshot({ path: fileURLToPath(new URL(`${file}-retry-reader.png`, output)) });
    report.cases.push({ key, failedLoadBlockedMenu: true, touchRetryRenderedReader: true, unknownReadIdsPreserved: true });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; throw error; }
finally { await writeFile(new URL("ui-asset-retry-verification.json", output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
