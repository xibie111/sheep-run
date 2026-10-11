import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UI_PLAYWRIGHT_PATH || "C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = process.env.UI_REVIEW_OUTPUT ? new URL(process.env.UI_REVIEW_OUTPUT) : new URL("../docs/ui-review/2026-10-08/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = [];
try {
  for (const [width, height] of [[896, 414], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const errors = [], browserDiagnostics = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => {
      if (msg.type() !== "error") return;
      // Chromium/CDP's synthetic OS-cancel event is not cancelable. Phaser's
      // capture listener emits this browser diagnostic; preserve it separately.
      if (msg.text().startsWith("Ignored attempt to cancel a touchcancel event with cancelable=false")) browserDiagnostics.push(msg.text());
      else errors.push(msg.text());
    });
    await page.goto(process.env.UI_REVIEW_URL || "http://localhost:4173");
    await page.waitForFunction(async () => {
      const { game } = await import("/src/main.ts");
      window.uiGame = game.instance;
      return game.instance.scene.isActive("MenuScene") && game.instance.scene.getScene("MenuScene").children.list.length > 0;
    });
    const frame = async () => page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Render stalled: " + JSON.stringify({ loop: window.uiGame.loop.running, paused: window.uiGame.isPaused, scenes: window.uiGame.scene.getScenes(true).map(s => s.sys.settings.key) }))), 5000);
      window.uiGame.events.once("postrender", () => { clearTimeout(timer); resolve(); });
    }));
    const active = async key => {
      await page.waitForFunction(key => window.uiGame.scene.isActive(key) && window.uiGame.scene.getScene(key).children.list.length > 0, key);
      await frame();
    };
    const screenshot = async name => { await frame(); await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}x${height}.png`, output)) }); };
    const target = async (name, key) => page.evaluate(({ name, key }) => {
      const scene = key ? window.uiGame.scene.getScene(key) : window.uiGame.scene.getScenes(true).at(-1);
      const walk = objects => { for (const o of objects) { if (o.name === name) return o; if (o.list) { const child = walk(o.list); if (child) return child; } } };
      const object = walk(scene.children.list);
      if (!object) throw Error("UI target not found: " + name);
      const b = object.getBounds(), r = window.uiGame.canvas.getBoundingClientRect(), size = window.uiGame.scale.gameSize;
      return { x: r.x + (b.x + b.width / 2) * r.width / size.width, y: r.y + (b.y + b.height / 2) * r.height / size.height, disabled: object.getData("disabled"), state: object.getData("state"), texture: object.list?.[0]?.texture?.key };
    }, { name, key });
    const tap = async (name, key) => { const t = await target(name, key); await page.touchscreen.tap(t.x, t.y); await frame(); };
    const audit = async key => page.evaluate(key => {
      const scene = window.uiGame.scene.getScene(key);
      const texts = [], cards = [], missing = [], clipped = [];
      const size = window.uiGame.scale.gameSize;
      const inspect = objects => objects.forEach(o => {
        if (o.type === "BitmapText") {
          texts.push(o.text);
          const chars = scene.cache.bitmapFont.get(o.font).data.chars;
          for (const c of o.text) if (c !== "\n" && !chars[c.codePointAt(0)]) missing.push(c);
          const b = o.getBounds();
          if (b.x < -0.5 || b.y < -0.5 || b.right > size.width + 0.5 || b.bottom > size.height + 0.5) clipped.push({ text: o.text, bounds: b });
        }
        if (o.name?.startsWith("skin-card:")) cards.push({ name: o.name, state: o.getData("state"), selected: o.getData("selected") });
        if (o.list) inspect(o.list);
      });
      inspect(scene.children.list);
      const r = window.uiGame.canvas.getBoundingClientRect();
      return { texts, cards, missing, clipped, canvas: { x: r.x, y: r.y, width: r.width, height: r.height, pixels: [window.uiGame.canvas.width,window.uiGame.canvas.height] }, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
    }, key);
    const save = async () => page.evaluate(async () => (await import("/src/systems/SaveSystem.ts")).SaveSystem.load());
    const checks = [];
    const note = (name, value = true) => { assert.ok(value, name); checks.push(name); };

    await screenshot("menu");
    const menu = await audit("MenuScene");
    console.log("viewport", width, height, menu.canvas, menu.scroll);
    note("page does not scroll", menu.scroll[0] === width && menu.scroll[1] === height);
    const start = await target("button:开始游戏", "MenuScene");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
    await frame();
    note("touch press uses pressed texture", (await target("button:开始游戏","MenuScene")).texture === "ui-button-primary-pressed");
    await screenshot("menu-pressed");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await frame();
    note("OS cancellation restores appearance", (await target("button:开始游戏","MenuScene")).texture === "ui-button-primary");
    note("OS cancellation does not navigate", await page.evaluate(() => window.uiGame.scene.isActive("MenuScene")));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: width / 2, y: 30, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await frame();
    note("dragging out cancels activation", await page.evaluate(() => window.uiGame.scene.isActive("MenuScene")));
    console.log("touch cancel and drag-out verified",width,height);

    await tap("button:衣橱", "MenuScene"); await active("WardrobeScene"); await screenshot("wardrobe");
    const wardrobe = await audit("WardrobeScene");
    note("all five cards render", wardrobe.cards.length === 5);
    note("Chinese names and original prices render", ["奶油白","炭黑","暖棕","闪金","农夫羊","免费","10星","30星","40金币","90金币"].every(t => wardrobe.texts.includes(t)));
    await tap("skin-card:golden", "WardrobeScene"); await screenshot("wardrobe-locked");
    note("insufficient balance disables unlock", (await target("button:余额不足", "WardrobeScene")).disabled);
    const beforeDisabled = await save();
    await tap("button:余额不足", "WardrobeScene");
    note("disabled action does not change save", JSON.stringify(beforeDisabled) === JSON.stringify(await save()));
    await tap("button:arrow-right", "WardrobeScene");
    note("right arrow selects farmer", (await audit("WardrobeScene")).cards.find(c => c.name === "skin-card:farmer").selected);
    await tap("button:arrow-left", "WardrobeScene");
    note("left arrow selects golden", (await audit("WardrobeScene")).cards.find(c => c.name === "skin-card:golden").selected);
    await tap("button:返回", "WardrobeScene"); await active("MenuScene");

    // Fixture lives only in this fresh isolated browser context; call the public API.
    await page.evaluate(async () => {
      const { SaveSystem } = await import("/src/systems/SaveSystem.ts");
      const data = SaveSystem.load();
      SaveSystem.save({ ...data, highScore: 12345, totalStars: 35, coins: 140, selectedSkin: "white", unlockedSkins: ["white"] });
    });
    await tap("button:衣橱", "MenuScene"); await active("WardrobeScene");
    await tap("skin-card:black", "WardrobeScene"); await tap("button:解锁", "WardrobeScene");
    note("star unlock uses existing progression behavior", (await save()).unlockedSkins.includes("black") && (await save()).totalStars === 35);
    await tap("button:装备", "WardrobeScene");
    note("equip refreshes stored and visible state", (await save()).selectedSkin === "black" && (await target("skin-card:black","WardrobeScene")).state === "equipped");
    await tap("skin-card:brown", "WardrobeScene"); await screenshot("wardrobe-states");
    await tap("skin-card:golden", "WardrobeScene"); await tap("button:解锁","WardrobeScene");
    note("40-coin unlock refreshes balance", (await save()).coins === 100 && (await save()).unlockedSkins.includes("golden"));
    await tap("button:装备", "WardrobeScene");
    await tap("skin-card:farmer", "WardrobeScene"); await tap("button:解锁","WardrobeScene");
    note("90-coin unlock refreshes balance", (await save()).coins === 10 && (await save()).unlockedSkins.includes("farmer"));
    note("an unlocked skin can equip after its purchase lowers balance", !(await target("button:装备","WardrobeScene")).disabled);
    await tap("button:装备", "WardrobeScene");
    note("farmer is stored and visibly equipped", (await save()).selectedSkin === "farmer" && (await target("skin-card:farmer","WardrobeScene")).state === "equipped");
    await screenshot("wardrobe-equipped");
    const equipped = await audit("WardrobeScene");
    await tap("button:返回", "WardrobeScene"); await active("MenuScene");

    await tap("button:settings","MenuScene"); await active("PauseScene");
    note("settings opens existing audio controls above menu", await page.evaluate(() => window.uiGame.scene.isPaused("MenuScene")));
    await tap("button:返回首页","PauseScene"); await active("MenuScene");
    await tap("button:开始游戏","MenuScene"); await active("RunScene");
    await tap("button:暂停","RunScene"); await active("PauseScene"); await screenshot("pause");
    note("pause keeps RunScene underneath", await page.evaluate(() => window.uiGame.scene.isPaused("RunScene")));
    const pause = await audit("PauseScene");
    const beforeAudio = await save();
    // Label is set at runtime; the mute button initially has an empty name.
    const audioTap = async (x, y) => {
      const p = await page.evaluate(({x,y}) => { const g=window.uiGame,r=g.canvas.getBoundingClientRect(),s=g.scale.gameSize;return {x:(x+Math.floor((s.width-480)/2))*r.width/s.width,y:(y+Math.floor((s.height-270)/2))*r.height/s.height}; }, {x,y});
      await page.touchscreen.tap(p.x,p.y); await frame();
    };
    await audioTap(249,85); await audioTap(308,85);
    await audioTap(249,113); await audioTap(308,113);
    const audio = await save();
    note("music and SFX controls persist through existing AudioSystem", audio.settings.musicVolume === beforeAudio.settings.musicVolume-0.1 && audio.settings.sfxVolume === beforeAudio.settings.sfxVolume-0.1 && audio.settings.music !== beforeAudio.settings.music && audio.settings.sfx !== beforeAudio.settings.sfx);
    await screenshot("pause-audio");
    await tap("button:继续游戏","PauseScene"); await active("RunScene");
    note("continue resumes RunScene and closes overlay", await page.evaluate(() => !window.uiGame.scene.isActive("PauseScene") && !window.uiGame.scene.isPaused("RunScene")));
    await tap("button:暂停","RunScene"); await active("PauseScene"); await tap("button:重新开始","PauseScene"); await active("RunScene");
    note("restart navigation returns to RunScene", await page.evaluate(() => !window.uiGame.scene.isActive("PauseScene")));
    await tap("button:暂停","RunScene"); await active("PauseScene"); await tap("button:返回首页","PauseScene"); await active("MenuScene");
    note("home closes both run and overlay", await page.evaluate(() => !window.uiGame.scene.isActive("RunScene") && !window.uiGame.scene.isActive("PauseScene")));
    note("no missing bitmap glyphs", [menu,wardrobe,equipped,pause].every(a=>a.missing.length===0));
    note("important UI text remains inside canvas", [menu,wardrobe,equipped,pause].every(a=>a.clipped.length===0));
    const finalCanvas = (await audit("MenuScene")).canvas;
    const coverage = finalCanvas.x <= 0.5 && finalCanvas.y <= 0.5 && finalCanvas.x + finalCanvas.width >= width - 0.5 && finalCanvas.y + finalCanvas.height >= height - 0.5;
    if (coverage) note("canvas reaches every screen edge");
    note("canvas scales both axes uniformly", Math.abs(finalCanvas.width / finalCanvas.pixels[0] - finalCanvas.height / finalCanvas.pixels[1]) < 0.0001);
    if (errors.length) console.log("browser errors",errors);
    note("no browser errors", errors.length===0);
    report.push({ width,height,coverage,finalCanvas,checks,errors,browserDiagnostics,menu,wardrobe,equipped,pause });
    console.log(`${width}x${height}: ${checks.length} UI checks passed`);
    await context.close();
  }
  const result = { passed: report.every(r => r.coverage && r.errors.length === 0), viewports: report };
  await writeFile(new URL("acceptance.json",output),JSON.stringify(result,null,2));
  assert.ok(result.passed, "Strict fullscreen coverage");
} finally {
  await browser.close();
}
