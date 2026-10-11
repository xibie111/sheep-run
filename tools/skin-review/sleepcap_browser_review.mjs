import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = new URL("../../", import.meta.url);
const definition = process.argv[2] ? JSON.parse(await readFile(new URL(process.argv[2], root), "utf8")) : null;
const out = new URL(definition?.reviewDirectory || "docs/skin-review/2026-10-10/", root);
const newIds = definition ? definition.skins.map(skin => skin.id) : ["sleepy-blue", "sleepy-cream", "sleepy-pink", "sleepy-mint", "dream"];
const expectedCatalogCount = definition?.expectedCatalogCount || 22;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge", args: ["--disable-webgl"] });
const reports = [];
try {
  for (const [width, height] of [[896,414],[844,390],[1280,720],[390,844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [], checks = [], poses = [];
    const check = (label, value) => { assert.ok(value, label); checks.push(label); };
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.addInitScript(() => {
      window.skinDraws = [];
      window.skinSources = new WeakMap();
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        const url = window.skinSources.get(args[0]) || args[0]?.src;
        if (window.skinSources.has(args[0]) && typeof url === "string") {
          window.skinDraws.push({ source: url.split("/").pop(), args: args.slice(1), canvas: [this.canvas.width, this.canvas.height] });
          if (window.skinDraws.length > 4000) window.skinDraws.splice(0, 2000);
        }
        return original.apply(this, args);
      };
    });
    const attachGame = async () => {
      await page.evaluate(async () => { window.skinGame = (await import("/src/main.ts")).game.instance; });
      await page.waitForFunction(() => window.skinGame.scene.isActive("MenuScene") && window.skinGame.scene.getScene("MenuScene").children.list.length > 0, null, { timeout: 10000 });
    };
    await page.goto(process.env.SKIN_REVIEW_URL || "http://127.0.0.1:4196");
    await attachGame();
    const frame = () => page.evaluate(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Render stalled")), 5000);
      window.skinGame.events.once("postrender", () => { clearTimeout(timer); resolve(); });
    }));
    const active = async key => { await page.waitForFunction(key => window.skinGame.scene.isActive(key) && window.skinGame.scene.getScene(key).children.list.length > 0, key, { timeout: 10000 }); await frame(); };
    const screenshot = async name => { await frame(); await page.screenshot({ path: fileURLToPath(new URL(`${name}-${width}x${height}.png`, out)) }); };
    const target = (name, key) => page.evaluate(({ name, key }) => {
      const find = list => { for (const item of list) { if (item.name === name) return item; if (item.list) { const child = find(item.list); if (child) return child; } } };
      const item = find(window.skinGame.scene.getScene(key).children.list); if (!item) return null;
      const bounds = item.getData("hud-rect") || item.getBounds(), rect = window.skinGame.canvas.getBoundingClientRect(), size = window.skinGame.scale.gameSize;
      return { x: rect.x + (bounds.x + bounds.width / 2) * rect.width / size.width, y: rect.y + (bounds.y + bounds.height / 2) * rect.height / size.height, disabled: item.getData("disabled"), state: item.getData("state") };
    }, { name, key });
    const tap = async (name, key) => { const t = await target(name, key); assert.ok(t, `Missing ${name}`); await page.touchscreen.tap(t.x, t.y); await frame(); };
    const audit = () => page.evaluate(() => {
      const scene = window.skinGame.scene.getScene("WardrobeScene"), size = window.skinGame.scale.gameSize, missing = [], clipped = [], cards = [], texts = [];
      const walk = list => list.forEach(item => {
        if (item.type === "BitmapText") {
          texts.push(item.text); const chars = scene.cache.bitmapFont.get(item.font).data.chars;
          for (const c of item.text) if (c !== "\n" && !chars[c.codePointAt(0)]) missing.push(c);
          const b = item.getBounds(); if (b.x < -.5 || b.y < -.5 || b.right > size.width + .5 || b.bottom > size.height + .5) clipped.push(item.text);
        }
        if (item.name?.startsWith("skin-card:")) cards.push(item.name.slice(10));
        if (item.list) walk(item.list);
      }); walk(scene.children.list); return { missing, clipped, cards, texts };
    });
    const save = () => page.evaluate(async () => (await import("/src/systems/SaveSystem.ts")).SaveSystem.load());
    const catalog = await page.evaluate(async () => (await import("/src/data/sheepSkins.ts")).SHEEP_SKINS);
    check(`${expectedCatalogCount} distinct catalog skins`, catalog.length === expectedCatalogCount && new Set(catalog.map(s => s.id)).size === expectedCatalogCount);
    const assets = await page.evaluate(async () => {
      const { SHEEP_SKINS, sheepTextureKey } = await import("/src/data/sheepSkins.ts");
      const { SKIN_ANIMATION_FRAMES } = await import("/src/data/skinSpriteAssets.ts");
      return SHEEP_SKINS.map(({ id }) => {
        const texture = window.skinGame.textures.get(sheepTextureKey(id));
        const frames = Array.from({ length: 15 }, (_, i) => { const f = texture.get(i); return { width: f.width, height: f.height, cutX: f.cutX, cutY: f.cutY }; });
        const prefix = id === "white" ? "sheep" : `sheep-${id}`;
        const animations = Object.fromEntries(Object.keys(SKIN_ANIMATION_FRAMES).map(state => [state, window.skinGame.anims.get(`${prefix}-${state}`).frames.map(f => Number(f.textureFrame))]));
        return { id, source: [texture.source[0].width, texture.source[0].height], frames, animations };
      });
    });
    for (const asset of assets) {
      check(`${asset.id}: 15 local render frames`, asset.source[0] === 640 && asset.source[1] === 384 && asset.frames.every(f => f.width === 128 && f.height === 112));
      assert.deepEqual(asset.animations, { idle: [0,10], run: [1,2,3,4,11,12], jump: [5], fall: [6], hit: [7], dash: [8,13], dead: [9,14] });
    }
    const loadedArt = await page.evaluate(async ids => {
      const { sheepTextureKey } = await import("/src/data/sheepSkins.ts");
      const { SKIN_SHEET_URLS } = await import("/src/data/skinSpriteAssets.ts");
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 384;
      const ctx = canvas.getContext("2d", { willReadFrequently: true }), result = [];
      const digest = async pixels => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))).map(b => b.toString(16).padStart(2, "0")).join("");
      for (const id of ids) {
        const source = window.skinGame.textures.get(sheepTextureKey(id)).source[0].image;
        window.skinSources.set(source, `${id}-sheet.png`);
        ctx.clearRect(0, 0, 640, 384); ctx.drawImage(source, 0, 0);
        const loadedHash = await digest(ctx.getImageData(0, 0, 640, 384).data);
        const original = new Image(); original.src = SKIN_SHEET_URLS[id]; await original.decode();
        ctx.clearRect(0, 0, 640, 384); ctx.drawImage(original, 0, 0);
        const expectedHash = await digest(ctx.getImageData(0, 0, 640, 384).data);
        result.push({ id, url: SKIN_SHEET_URLS[id], loadedHash, expectedHash });
      }
      return result;
    }, newIds);
    for (const art of loadedArt) check(`${art.id}: loaded pixels match generated runtime PNG`, art.loadedHash === art.expectedHash);
    const purchaseBudget = catalog.filter(skin => newIds.includes(skin.id)).reduce((sum, skin) => sum + skin.unlock.amount, 0);
    await page.evaluate(async coins => {
      const { SaveSystem } = await import("/src/systems/SaveSystem.ts");
      SaveSystem.save({ ...SaveSystem.load(), coins, totalStars: 100, selectedSkin: "white", unlockedSkins: ["white"] });
    }, purchaseBudget);
    await tap("button:衣橱", "MenuScene"); await active("WardrobeScene");
    const pages = [];
    const pageCount = Math.ceil(catalog.length / 5);
    for (let n = 0; n < pageCount; n++) {
      const result = await audit(); pages.push(result);
      check(`Page ${n + 1}: complete glyphs and safe bounds`, !result.missing.length && !result.clipped.length);
      check(`Page ${n + 1}: correct card count`, result.cards.length === Math.min(5, catalog.length - n * 5));
      if (n > 1) await screenshot(`wardrobe-page-${n + 1}`);
      await tap("button:page-next", "WardrobeScene");
    }
    check("Page wrap preserves original first page", (await audit()).cards[0] === "white");
    const select = async id => {
      for (let n = 0; !await target(`skin-card:${id}`, "WardrobeScene"); n++) { assert.ok(n < pageCount, `Cannot reach ${id}`); await tap("button:page-next", "WardrobeScene"); }
      await tap(`skin-card:${id}`, "WardrobeScene");
    };
    for (const id of newIds) {
      await select(id);
      const before = await save();
      const mouseTarget = await target("button:解锁", "WardrobeScene");
      await page.mouse.click(mouseTarget.x, mouseTarget.y); await frame();
      check(`${id}: mouse does not purchase`, (await save()).coins === before.coins && !(await save()).unlockedSkins.includes(id));
      await tap("button:解锁", "WardrobeScene");
      const bought = await save();
      const price = catalog.find(skin => skin.id === id).unlock.amount;
      check(`${id}: unlock costs exactly ${price} coins`, bought.coins === before.coins - price && bought.unlockedSkins.includes(id));
      check(`${id}: owned skin equip stays enabled`, (await target("button:装备", "WardrobeScene")).disabled === false);
      await tap("button:装备", "WardrobeScene");
      check(`${id}: touch equips and persists`, (await save()).selectedSkin === id && (await target(`skin-card:${id}`, "WardrobeScene")).state === "equipped");
      const ui = await audit(); check(`${id}: label fits with complete font`, !ui.missing.length && !ui.clipped.length);
      await screenshot(`wardrobe-${id}`);
      await tap("button:返回", "WardrobeScene"); await active("MenuScene");
      await page.evaluate(() => { window.skinDraws = []; });
      await tap("button:开始游戏", "MenuScene"); await active("RunScene");
      const geometry = await page.evaluate(() => {
        const scene = window.skinGame.scene.getScene("RunScene"), sheep = scene.sheep, body = sheep.body;
        const standing = { key: sheep.texture.key, source: sheep.texture.source[0].image.src, width: body.width, height: body.height, bottom: body.bottom, y: sheep.y, scale: [sheep.scaleX, sheep.scaleY] };
        const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 112;
        const ctx = canvas.getContext("2d"); ctx.drawImage(sheep.frame.source.image, sheep.frame.cutX, sheep.frame.cutY, 128, 112, 0, 0, 128, 112);
        const pixels = ctx.getImageData(0, 0, 128, 112).data; let last = -1;
        for (let y = 0; y < 112; y++) for (let x = 0; x < 128; x++) if (pixels[(y * 128 + x) * 4 + 3]) last = Math.max(last, y);
        standing.visibleFeet = sheep.y - sheep.displayHeight + (last + 1) * sheep.scaleY;
        sheep.setCrouching(true); const crouch = { width: body.width, height: body.height, bottom: body.bottom }; sheep.setCrouching(false);
        return { standing, crouch };
      });
      check(`${id}: generated sheet is rendered in run`, geometry.standing.key === `sheep-runner-${id}`);
      check(`${id}: fixed hitbox and ground-aligned feet`, Math.abs(geometry.standing.width - 30) < .001 && Math.abs(geometry.standing.height - 30) < .001 && Math.abs(geometry.standing.bottom - 218) < .01 && Math.abs(geometry.standing.visibleFeet - 218) < .01 && Math.abs(geometry.standing.scale[0] - geometry.standing.scale[1]) < .0001);
      check(`${id}: original crouch geometry`, Math.abs(geometry.crouch.width - 30) < .001 && Math.abs(geometry.crouch.height - 18) < .001 && Math.abs(geometry.crouch.bottom - 218) < .01);
      await screenshot(`run-${id}`);
      await page.touchscreen.tap(width * .58, height * .45);
      await page.waitForFunction(() => { const s = window.skinGame.scene.getScene("RunScene").sheep; return s.motionState === "JUMPING" && Number(s.frame.name) === 5 && s.body.velocity.y < 0; }, null, { timeout: 1500 });
      check(`${id}: original touch jump uses frame 5`, true);
      await page.waitForFunction(() => window.skinGame.scene.getScene("RunScene").sheep.grounded, null, { timeout: 2500 });
      await page.evaluate(() => { const run = window.skinGame.scene.getScene("RunScene"); run.scene.pause(); run.sheep.anims.stop(); window.skinDraws = []; });
      for (let i = 0; i < 15; i++) {
        await page.evaluate(i => { window.skinGame.scene.getScene("RunScene").sheep.setFrame(i); }, i); await frame();
      }
      const drawn = await page.evaluate(id => window.skinDraws.filter(d => d.source === `${id}-sheet.png`), id);
      const crops = new Set(drawn.filter(d => d.args.length === 8).map(d => `${d.args[0]},${d.args[1]},${d.args[2]},${d.args[3]}`));
      check(`${id}: all 15 PNG crops actually draw`, Array.from({ length: 15 }, (_, i) => `${(i % 5) * 128},${Math.floor(i / 5) * 128 + 16},128,112`).every(crop => crops.has(crop)));
      poses.push({ id, geometry, drawnCrops: [...crops] });
      await page.evaluate(() => { const run = window.skinGame.scene.getScene("RunScene"); run.sheep.setFrame(1); run.scene.resume(); }); await frame();
      await tap("button:暂停", "RunScene"); await active("PauseScene");
      await tap("button:返回首页", "PauseScene"); await active("MenuScene");
      await tap("button:衣橱", "MenuScene"); await active("WardrobeScene");
    }
    check("All new purchases leave zero coins", (await save()).coins === 0);
    await page.reload(); await attachGame(); await frame();
    const reloaded = await save();
    check("Selected skin survives reload", reloaded.selectedSkin === newIds.at(-1));
    check("All purchased skin IDs survive reload", newIds.every(id => reloaded.unlockedSkins.includes(id)));
    await tap("button:衣橱", "MenuScene"); await active("WardrobeScene");
    for (const id of ["white", ...newIds]) {
      await select(id); const before = await save();
      if (before.selectedSkin !== id) {
        check(`${id}: re-equip at zero balance is enabled`, (await target("button:装备", "WardrobeScene")).disabled === false);
        await tap("button:装备", "WardrobeScene");
      }
      check(`${id}: switching owned skins is free`, (await save()).selectedSkin === id && (await save()).coins === 0);
    }
    await screenshot("wardrobe-final");
    const bounds = await page.evaluate(() => { const r = window.skinGame.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] }; });
    check("Canvas remains within viewport without scrolling", bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1 && bounds.scroll[0] === width && bounds.scroll[1] === height);
    check("No browser or asset errors", errors.length === 0);
    reports.push({ width, height, checks, pages, assets, loadedArt, poses, bounds, errors });
    console.log(`${width}x${height}: ${checks.length} wardrobe/run checks passed`);
    await writeFile(new URL("sleepcap-browser-review.json", out), JSON.stringify({ passed: reports.length === 4, viewports: reports }, null, 2) + "\n");
    await context.close();
  }
} finally { await browser.close(); }
