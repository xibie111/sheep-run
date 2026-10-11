import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/mailbox-review/2026-10-11/ui-v2-acceptance/", import.meta.url); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = { engine: "Edge Chromium mobile touch emulation", phoneHardware: false, fixtures: "Isolated browser CSS safe-area insets to exercise constrained reading space; body font remains 12; storage and audio instrumentation only", checks: [], screenshots: [], errors: [], pages: [] };
const check = (ok, label) => { assert(ok, label); report.checks.push(label); };
const copy = [
  ["welcome-v1", ["哈喽哈喽，催眠羊同学！", "这是专门为你做的《小羊快跑》哦！", "其实，做这个游戏还挺开心的。投入其中的时候，就能进入一种心无旁骛的心流状态，专心把这片小牧场一点点做好。", "这片牧场都是为你准备的，这里的小羊也都是你的。希望它们能带给你一点小快乐，更希望你每天都开开心心的！", "爱你的小杨同学"]],
  ["goodnight-v1", ["这是一封写给你的晚安信。", "今天是不是特别特别累？回到宿舍，有没有特别想我呀？有没有偷偷吃火鸡面？", "想跟你说点什么，又一时不知道从哪里说起，那就先道一声晚安吧。", "希望你今晚睡得安稳，做一个甜甜的好梦。今天的疲惫，就留在今天吧。", "晚安，催眠羊同学。", "爱你的小杨同学"]],
];
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 0, totalStars: 0, coins: 0, selectedSkin: "white", unlockedSkins: ["white"], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, sfxVolume: 0.3, musicVolume: 1 } }));
      const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener, records = new Set(); window.cancelListeners = records;
      EventTarget.prototype.addEventListener = function(type, listener, options) { if (this.tagName === "CANVAS" && /^(pointercancel|touchcancel)$/.test(type)) records.add(listener); return add.call(this, type, listener, options); };
      EventTarget.prototype.removeEventListener = function(type, listener, options) { if (this.tagName === "CANVAS" && /^(pointercancel|touchcancel)$/.test(type)) records.delete(listener); return remove.call(this, type, listener, options); };
    });
    const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url())); await page.goto("http://127.0.0.1:4199"); const main = (await request).url();
    await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, main); await page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
    const data = () => page.locator('[data-adventure-overlay="mailbox"]').evaluate(c => ({ ...c.dataset }));
    const tap = async (name, sceneKey = "MenuScene") => { const p = await page.evaluate(({ name, sceneKey }) => { const b = window.g.scene.getScene(sceneKey).children.getByName(name).getBounds(), r = window.g.canvas.getBoundingClientRect(), s = window.g.scale.gameSize; return { x: r.x + b.centerX * r.width / s.width, y: r.y + b.centerY * r.height / s.height }; }, { name, sceneKey }); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(50); };
    const shot = async name => { const file = `480x270-dpr${dpr}-${name}.png`; await page.screenshot({ path: fileURLToPath(new URL(file, output)) }); report.screenshots.push(file); };
    // Instantiate the real, existing AudioSystem through its existing menu entry.
    await tap("button:settings"); await tap("button:继续游戏", "PauseScene");
    await page.evaluate(() => {
      const audio = window.g.registry.get("audioSystem"), play = audio.play.bind(audio); window.audioCalls = []; window.oscillators = 0;
      audio.play = cue => { window.audioCalls.push(cue); return play(cue); };
      const create = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function() { window.oscillators++; return create.call(this); };
      document.documentElement.style.setProperty("--safe-top", "40px"); document.documentElement.style.setProperty("--safe-bottom", "40px");
      const scale = window.g.scale; scale.emit("resize", scale.gameSize, scale.baseSize, scale.displaySize, scale.gameSize.width, scale.gameSize.height);
    });
    await tap("mailbox-entry");
    const list = await data(), boxes = JSON.parse(list.targets);
    check(boxes["mailbox-letter:goodnight-v1"].y + boxes["mailbox-letter:goodnight-v1"].height < boxes["button:合上邮箱"].y, "constrained list leaves letters separate from close");
    check(await page.evaluate(() => window.audioCalls.join() === "button" && window.oscillators === 0), "one muted button cue per touch, existing SFX switch respected");
    await shot("constrained-letter-list");
    for (const [id, paragraphs] of copy) {
      await tap(`mailbox-letter:${id}`); const first = await data(), count = Number(first.pages); check(count > 1, `${id}: constrained screen uses pagination`);
      const records = []; const raw = await page.evaluate(() => localStorage.getItem("sheep-run-mailbox-v1"));
      for (let i = 0; i < count; i++) {
        const d = await data(), rows = JSON.parse(d.lines).filter(l => l.paragraph !== undefined), b = JSON.parse(d.body);
        check(Number(d.page) === i, "page index matches actual navigation");
        check(rows.every(l => l.fontSize >= 11.99 && l.box.y >= b.y && l.box.y + l.box.height <= b.y + b.height), "constrained body remains full size and inside reading space");
        check(await page.evaluate(i => window.g.scene.getScene("MenuScene").children.getByName("mailbox-keep").input.enabled === i, i === count - 1), "keep target enabled only on final page");
        records.push(...rows); await shot(`${id}-constrained-page-${i + 1}`);
        if (i < count - 1) await tap("mailbox-next");
      }
      paragraphs.forEach((p, i) => check(records.filter(l => l.paragraph === i).map(l => l.text).join("") === p, `${id}: pagination preserves paragraph ${i + 1}`));
      check(await page.evaluate(() => localStorage.getItem("sheep-run-mailbox-v1")) === raw, "all page turns leave read status untouched");
      await tap("mailbox-prev"); check(Number((await data()).page) === count - 2, "previous page works"); await tap("mailbox-next");
      await tap("mailbox-keep"); report.pages.push({ id, dpr, count });
    }
    await tap("button:合上邮箱");
    const listenerCount = await page.evaluate(() => window.cancelListeners.size);
    for (let i = 0; i < 3; i++) {
      // Return no Phaser ScenePlugin: serializing its scene graph delays the next browser check.
      await page.evaluate(() => { window.g.scene.getScene("MenuScene").scene.start("RunScene"); }); await page.waitForFunction(() => window.g.scene.isActive("RunScene"));
      await page.evaluate(() => { window.g.scene.getScene("RunScene").scene.start("MenuScene"); }); await page.waitForFunction(() => document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset.prop);
      check(await page.evaluate(() => window.cancelListeners.size) === listenerCount, "canvas cancellation listener count remains stable across scene reentry");
    }
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-top", "0px"); document.documentElement.style.setProperty("--safe-bottom", "0px");
      const scale = window.g.scale; scale.emit("resize", scale.gameSize, scale.baseSize, scale.displaySize, scale.gameSize.width, scale.gameSize.height);
    });
    for (let i = 0; i < 3; i++) await tap("easter-egg:sheep");
    check(await page.evaluate(() => window.g.scene.getScene("MenuScene").data.get("menu-modal-owner") === "private-letter"), "final build retains private love letter");
    check(await page.locator('[data-adventure-overlay="collection-album"]').evaluate(c => JSON.parse(c.dataset.lines).length === 0) && await page.locator('[data-adventure-overlay="journey-book"]').evaluate(c => JSON.parse(c.dataset.lines).length === 0), "closed book entry layers cannot paint over private letter");
    await shot("final-private-letter"); await tap("button:收下这份喜欢");
    await tap("mailbox-entry"); check((await data()).open === "true", "private letter close restores final-build mailbox touch target"); await tap("button:合上邮箱");
    await context.close();
  }
  check(report.errors.length === 0, "no browser runtime errors");
} catch (error) {
  report.failure = error.stack;
  report.diagnostics = [];
  for (const context of browser.contexts()) for (const page of context.pages()) {
    report.diagnostics.push(await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus(), scenes: window.g?.scene.scenes.map(s => ({ key: s.scene.key, status: s.sys.settings.status })), mailbox: { ...document.querySelector('[data-adventure-overlay="mailbox"]')?.dataset }, listeners: window.cancelListeners?.size })));
    await page.screenshot({ path: fileURLToPath(new URL("pagination-failure.png", output)) });
  }
  throw error;
}
finally { await writeFile(new URL("pagination-verification.json", output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots.length, pages: report.pages, errors: report.errors }));
