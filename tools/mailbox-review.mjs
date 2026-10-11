import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const url = process.env.MAILBOX_REVIEW_URL || "http://127.0.0.1:4199";
const output = new URL("../docs/mailbox-review/2026-10-11/ui-v2-acceptance/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = { url, engine: "Edge Chromium mobile touch emulation", phoneHardware: false, production: true, fixtures: "Isolated storage, denied storage and network failure fixtures; no production gameplay acceleration", checks: [], screenshots: [], errors: [], layouts: [] };
const check = (value, label) => { assert(value, label); report.checks.push(label); };
const expected = [
  { id: "welcome-v1", title: "欢迎信", paragraphs: ["哈喽哈喽，催眠羊同学！", "这是专门为你做的《小羊快跑》哦！", "其实，做这个游戏还挺开心的。投入其中的时候，就能进入一种心无旁骛的心流状态，专心把这片小牧场一点点做好。", "这片牧场都是为你准备的，这里的小羊也都是你的。希望它们能带给你一点小快乐，更希望你每天都开开心心的！"] },
  { id: "goodnight-v1", title: "晚安信", paragraphs: ["这是一封写给你的晚安信。", "今天是不是特别特别累？回到宿舍，有没有特别想我呀？有没有偷偷吃火鸡面？", "想跟你说点什么，又一时不知道从哪里说起，那就先道一声晚安吧。", "希望你今晚睡得安稳，做一个甜甜的好梦。今天的疲惫，就留在今天吧。", "晚安，催眠羊同学。"] },
];
const signature = "爱你的小杨同学", key = "sheep-run-mailbox-v1";
const data = async f => f.page.locator('[data-adventure-overlay="mailbox"]').evaluate(c => ({ ...c.dataset }));
async function attachGame(page) {
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const main = (await request).url(); await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, main);
  return main;
}
async function open(w = 844, h = 390, dpr = 1, fixture = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
  await page.addInitScript(({ fixture, key }) => {
    if (!localStorage.getItem("sheep-run-save")) localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 0, totalStars: 0, coins: 0, selectedSkin: "white", unlockedSkins: ["white"], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } }));
    if (fixture.badges && !localStorage.getItem("sheep-run-collections-v1")) localStorage.setItem("sheep-run-collections-v1", JSON.stringify({ version: 1, badges: fixture.badges }));
    if (fixture.raw && !localStorage.getItem(key)) localStorage.setItem(key, fixture.raw);
    if (fixture.denyWrite) { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException("quota", "QuotaExceededError"); return original.call(this, k, v); }; }
  }, { fixture, key });
  if (fixture.failAsset) await page.route("**/assets/mailbox-*.png", route => route.abort());
  const main = await attachGame(page);
  if (!fixture.failAsset) await page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
  return { context, page, w, h, dpr, main };
}
async function point(f, name, sceneKey = "MenuScene") {
  return f.page.evaluate(({ name, sceneKey }) => {
    const scene = window.g.scene.getScene(sceneKey), object = scene.children.getByName(name);
    if (!object) throw Error(`Missing touch target ${name}`);
    const b = object.getBounds(), r = window.g.canvas.getBoundingClientRect(), s = window.g.scale.gameSize;
    return { x: r.x + (b.centerX - scene.cameras.main.scrollX * object.scrollFactorX) * r.width / s.width, y: r.y + (b.centerY - scene.cameras.main.scrollY * object.scrollFactorY) * r.height / s.height };
  }, { name, sceneKey });
}
async function tap(f, name, sceneKey = "MenuScene") { const p = await point(f, name, sceneKey); await f.page.touchscreen.tap(p.x, p.y); await f.page.waitForTimeout(60); }
async function shot(f, name) { const size = f.page.viewportSize(), file = `${size.width}x${size.height}-dpr${f.dpr}-${name}.png`; await f.page.screenshot({ path: fileURLToPath(new URL(file, output)) }); report.screenshots.push(file); }
const inputs = f => f.page.evaluate(() => Object.fromEntries(window.g.scene.getScene("MenuScene").children.list.filter(o => o.input).map(o => [o.name, o.input.enabled])));
async function checkText(f) {
  const d = await data(f), p = JSON.parse(d.panel), lines = JSON.parse(d.lines);
  for (const l of lines) {
    check(l.ink.width > 0 && l.ink.height > 0 && l.ink.x >= l.box.x - 1 && l.ink.y >= l.box.y - 1 && l.ink.x + l.ink.width <= l.box.x + l.box.width + 1 && l.ink.y + l.ink.height <= l.box.y + l.box.height + 1, `${f.w} DPR${f.dpr}: ink fits ${l.text}`);
    check(l.box.x >= p.x && l.box.y >= p.y && l.box.x + l.box.width <= p.x + p.width + 1 && l.box.y + l.box.height <= p.y + p.height, `${f.w}: line inside panel`);
    if (l.paragraph !== undefined) check(l.fontSize >= 11.99, "body keeps comfortable 12 logical pixels");
  }
  const physical = await f.page.locator('[data-adventure-overlay="mailbox"]').evaluate(c => ({ width: c.width, height: c.height, rect: { width: c.getBoundingClientRect().width, height: c.getBoundingClientRect().height }, dpr: window.devicePixelRatio, smooth: c.getContext("2d").imageSmoothingEnabled }));
  check(Math.abs(physical.width - physical.rect.width * f.dpr) <= 1 && Math.abs(physical.height - physical.rect.height * f.dpr) <= 1 && !physical.smooth, "actual physical-pixel surface and nearest-neighbor render");
}
function overlaps(a, b) { return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }
async function layoutChecks(f) {
  const d = await data(f), prop = JSON.parse(d.prop), hit = JSON.parse(d.hit);
  const objects = await f.page.evaluate(() => {
    const scene = window.g.scene.getScene("MenuScene");
    return scene.children.list.filter(o => o.input?.enabled && o.name !== "mailbox-entry").map(o => { const b = o.getBounds(); return { name: o.name, x: b.x, y: b.y, width: b.width, height: b.height }; });
  });
  const menu = await f.page.locator("[data-menu-art]").evaluate(c => JSON.parse(c.dataset.layout));
  for (const o of objects) { check(!overlaps(hit, o), `${f.w}: mailbox expanded hit excludes ${o.name}`); check(!overlaps(prop, o), `${f.w}: mailbox artwork excludes ${o.name}`); }
  for (const name of ["title", "score"]) check(!overlaps(hit, menu[name]) && !overlaps(prop, menu[name]), `${f.w}: mailbox excludes ${name}`);
  check(prop.width / prop.height === 28 / 58 && hit.width > prop.width && hit.height > prop.height, "mailbox ratio and expanded touch size");
  report.layouts.push({ viewport: [f.w, f.h], dpr: f.dpr, prop, hit, objects });
}
async function readAll(f, letter, keep = true, prefix = "") {
  await tap(f, `mailbox-letter:${letter.id}`); let d = await data(f), rows = [];
  const savedBefore = await f.page.evaluate(key => localStorage.getItem(key), key);
  const pages = Number(d.pages);
  for (let i = 0; i < pages; i++) {
    d = await data(f); check(d.letter === letter.id && Number(d.page) === i, `${letter.id}: exact page navigation`);
    const lines = JSON.parse(d.lines); check(lines.some(l => l.text === letter.title), `${letter.id}: exact title`); rows.push(...lines.filter(l => l.paragraph !== undefined));
    const state = await inputs(f); check(state["mailbox-keep"] === (i === pages - 1), "keep only on the last page");
    await checkText(f); await shot(f, `${prefix}${letter.id}-page-${i + 1}`);
    if (i < pages - 1) { check((await f.page.evaluate(key => localStorage.getItem(key), key)) === savedBefore, "flipping never changes read persistence"); await tap(f, "mailbox-next"); }
  }
  [...letter.paragraphs, signature].forEach((paragraph, index) => check(rows.filter(l => l.paragraph === index).map(l => l.text).join("") === paragraph, `${letter.id}: exact paragraph ${index + 1} including punctuation`));
  if (keep) { await tap(f, "mailbox-keep"); check((await data(f)).mode === "list", "keeping returns to letter list"); }
  else { await tap(f, "mailbox-back"); }
  return pages;
}
try {
  if (!process.argv.includes("--extra")) for (const [w, h] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const f = await open(w, h, dpr); await layoutChecks(f); await shot(f, "menu-unread");
    check((await data(f)).unread === "true" && JSON.parse((await data(f)).readIds).length === 0, "initial upright flag and two unread letters");
    const before = await inputs(f), save = await f.page.evaluate(() => localStorage.getItem("sheep-run-save"));
    await tap(f, "mailbox-entry"); check((await data(f)).open === "true", "touch opens mailbox"); await checkText(f); await shot(f, "letter-list-unread");
    const blocked = await inputs(f); check(Object.entries(blocked).filter(([name]) => !name.startsWith("mailbox") && name !== "button:合上邮箱").every(([, enabled]) => !enabled), "mail modal disables every underlying input target");
    check(JSON.parse((await data(f)).lines).filter(l => expected.some(e => e.title === l.text)).map(l => l.text).join() === "欢迎信,晚安信", "fixed letter order");
    await tap(f, "mailbox-letter:welcome-v1"); await tap(f, "mailbox-back");
    check(!(await f.page.evaluate(key => localStorage.getItem(key), key)), "open and return leave both unread");
    await tap(f, "button:合上邮箱"); check(JSON.stringify(await inputs(f)) === JSON.stringify(before), "closing restores exact input states");
    await tap(f, "mailbox-entry"); await readAll(f, expected[0]);
    check(JSON.parse((await data(f)).readIds).join() === "welcome-v1", "only welcome explicitly kept");
    await tap(f, "mailbox-letter:goodnight-v1"); await tap(f, "mailbox-back");
    // Each letter's exact copy is verified on every actual rendered page.
    await readAll(f, expected[1]);
    check((await data(f)).unread === "false", "both kept => lowered flag");
    await tap(f, "button:合上邮箱"); await shot(f, "menu-all-read");
    check(await f.page.evaluate(() => localStorage.getItem("sheep-run-save")) === save, "reading does not alter gameplay save");
    await f.page.reload(); await f.page.evaluate(async main => { window.g = (await import(main)).game.instance; }, f.main);
    await f.page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
    check((await data(f)).unread === "false", "full refresh retains read states");
    await tap(f, "mailbox-entry"); await readAll(f, expected[0], false); check(JSON.parse((await data(f)).readIds).length === 2, "already-read letter can be reread");
    await f.context.close();
  }
  if (!process.argv.includes("--matrix")) {
    const f = await open();
    const before = await inputs(f);
    await f.page.evaluate(() => { window.g.scene.getScene("MenuScene").children.getByName("button:衣橱").input.enabled = false; });
    await tap(f, "mailbox-entry"); await tap(f, "button:合上邮箱");
    check(!(await inputs(f))["button:衣橱"], "originally disabled wardrobe stays disabled after mail closes");
    await f.page.evaluate(() => { window.g.scene.getScene("MenuScene").children.getByName("button:衣橱").input.enabled = true; });
    const cdp = await f.context.newCDPSession(f.page);
    const p = await point(f, "mailbox-entry");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); await f.page.waitForTimeout(60);
    check((await data(f)).open === "false", "OS touch cancellation never opens mailbox");
    await tap(f, "mailbox-entry"); await tap(f, "mailbox-letter:goodnight-v1");
    const keepP = await point(f, "mailbox-back");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: keepP.x, y: keepP.y }] });
    await f.page.evaluate(() => window.g.canvas.dispatchEvent(new PointerEvent("pointercancel", { pointerType: "touch", bubbles: true })));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await f.page.waitForTimeout(60);
    check((await data(f)).mode === "read", "pointercancel preserves reader state");
    // Neutral reader body taps at the sheep and mailbox cannot trigger bottom UI.
    for (let i = 0; i < 3; i++) await tap(f, "easter-egg:sheep"); await tap(f, "button:settings"); await tap(f, "mailbox-entry");
    check((await data(f)).open === "true" && await f.page.evaluate(() => window.g.scene.isActive("MenuScene") && !window.g.scene.isActive("PauseScene")), "sheep Easter egg and settings blocked beneath mail");
    check(!(await f.page.evaluate(key => localStorage.getItem(key), key)), "cancelled or blocked touches do not mark read");
    await tap(f, "mailbox-back"); await tap(f, "button:合上邮箱");
    for (let i = 0; i < 5; i++) { await tap(f, "mailbox-entry"); await tap(f, "button:合上邮箱"); }
    check(JSON.stringify(await inputs(f)) === JSON.stringify(before), "rapid repeated open/close leaves no input leak or pass-through");
    for (const [entry, closeName, owner] of [["button:收藏册", "button:合上收藏册", "collection"], ["button:成就册", "button:合上手账", "journey"]]) {
      await tap(f, entry); check(await f.page.evaluate(owner => window.g.scene.getScene("MenuScene").data.get("menu-modal-owner") === owner, owner), `${owner} retains its own modal`);
      check(!(await inputs(f))["mailbox-entry"], `${owner} excludes mailbox target`);
      await tap(f, closeName); check((await inputs(f))["mailbox-entry"], `${owner} close restores mailbox`);
    }
    for (let i = 0; i < 3; i++) await tap(f, "easter-egg:sheep");
    check(await f.page.evaluate(() => window.g.scene.getScene("MenuScene").data.get("menu-modal-owner") === "private-letter"), "existing hidden love letter remains accessible");
    check(!(await inputs(f))["mailbox-entry"], "love letter excludes mailbox");
    await shot(f, "original-love-letter"); await tap(f, "button:收下这份喜欢");
    await tap(f, "button:settings"); await f.page.waitForFunction(() => window.g.scene.isPaused("MenuScene"));
    check((await f.page.locator('[data-adventure-overlay="mailbox"]').evaluate(c => c.style.display)) === "none", "settings hides mailbox surface while paused");
    await tap(f, "button:继续游戏", "PauseScene"); await f.page.waitForFunction(() => window.g.scene.isActive("MenuScene"));
    check(JSON.stringify(await inputs(f)) === JSON.stringify(before), "settings resume restores exact menu inputs");
    await tap(f, "mailbox-entry"); await tap(f, "mailbox-letter:goodnight-v1");
    const resizeBefore = await data(f); if (Number(resizeBefore.pages) > 1) await tap(f, "mailbox-next");
    await f.page.setViewportSize({ width: 800, height: 600 }); await f.page.waitForTimeout(150);
    check((await data(f)).letter === "goodnight-v1" && Number((await data(f)).page) < Number((await data(f)).pages), "resize preserves letter and a valid content page"); await checkText(f); await shot(f, "resized-reader");
    await tap(f, "mailbox-back"); await tap(f, "button:合上邮箱");
    const counts = await f.page.evaluate(() => { const s = window.g.scene.getScene("MenuScene"); return { children: s.children.list.length, postrender: window.g.events.listenerCount("postrender"), pointeroutside: s.input.listenerCount("pointerupoutside"), cancels: s.events.listenerCount("menu-modal-cancel") }; });
    for (let i = 0; i < 4; i++) {
      await tap(f, "mailbox-entry"); await tap(f, "mailbox-letter:welcome-v1");
      await f.page.evaluate(() => { window.g.scene.getScene("MenuScene").scene.start("RunScene"); }); await f.page.waitForFunction(() => window.g.scene.isActive("RunScene"));
      check(await f.page.locator('[data-adventure-overlay="mailbox"]').count() === 0, "scene exit removes mail display layer");
      await f.page.evaluate(() => { window.g.scene.getScene("RunScene").scene.start("MenuScene"); }); await f.page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
      const now = await f.page.evaluate(() => { const s = window.g.scene.getScene("MenuScene"); return { children: s.children.list.length, postrender: window.g.events.listenerCount("postrender"), pointeroutside: s.input.listenerCount("pointerupoutside"), cancels: s.events.listenerCount("menu-modal-cancel") }; });
      check(JSON.stringify(now) === JSON.stringify(counts), `reentry ${i + 1}: no extra objects or listeners`);
      check(await f.page.locator('[data-adventure-overlay="mailbox"]').count() === 1 && (await data(f)).open === "false", "one clean mailbox after reentry");
    }
    await shot(f, "clean-after-reentries"); await f.context.close();
    const reward = await open(844, 390, 1, { badges: ["spring-flower", "spring-butterfly", "spring-clover"] });
    await tap(reward, "button:收藏册"); await tap(reward, "collection-reward");
    check(await reward.page.evaluate(() => window.g.scene.getScene("MenuScene").data.get("menu-modal-owner") === "journey"), "existing collection reward child still opens");
    await tap(reward, "button:合上手账"); check(await reward.page.evaluate(() => window.g.scene.getScene("MenuScene").data.get("menu-modal-owner") === "collection"), "reward child closes back to collection parent");
    check(!(await inputs(reward))["mailbox-entry"], "nested reward does not prematurely enable mailbox"); await tap(reward, "button:合上收藏册"); check((await inputs(reward))["mailbox-entry"], "parent finally restores mailbox"); await reward.context.close();
    for (const fixture of [{ raw: "damaged record" }, { raw: '{"version":2,"readIds":["future"]}' }, { denyWrite: true }]) {
      const denied = await open(844, 390, 2, fixture); await tap(denied, "mailbox-entry"); await readAll(denied, expected[0], true, fixture.denyWrite ? "write-denied-" : fixture.raw.startsWith("{") ? "future-" : "damaged-");
      const d = await data(denied); check(d.saveFailed === "true" && JSON.parse(d.readIds).includes("welcome-v1"), "failed persistence retains session read state");
      check(!JSON.parse(d.lines).some(l => l.text === "阅读记录未保存"), "save failure status stays internal without a visible notice, as requested");
      check(await denied.page.evaluate(key => localStorage.getItem(key), key) === (fixture.raw || null), "damaged/future/denied storage never overwritten");
      await shot(denied, fixture.denyWrite ? "write-failure" : fixture.raw.startsWith("{") ? "future-storage" : "damaged-storage"); await denied.context.close();
    }
    const failed = await open(844, 390, 1, { failAsset: true, raw: '{"version":1,"readIds":["welcome-v1","removed-letter"]}' });
    await failed.page.waitForFunction(() => window.g.scene.getScene("PreloadScene").children.getByName("local-load-error")); await shot(failed, "resource-error");
    await failed.page.unroute("**/assets/mailbox-*.png"); await tap(failed, "button:重试", "PreloadScene");
    await failed.page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
    check(JSON.parse((await data(failed)).readIds).join() === "welcome-v1,removed-letter", "resource retry loads mailbox and preserves read IDs"); await shot(failed, "resource-retry-menu"); await failed.context.close();
  }
  check(report.errors.length === 0, "no browser runtime errors");
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await writeFile(new URL(process.argv.includes("--extra") ? "extra-verification.json" : "matrix-verification.json", output), JSON.stringify(report, null, 2)); await browser.close();
}
console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors }));
