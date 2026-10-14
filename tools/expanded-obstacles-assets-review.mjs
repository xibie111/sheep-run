import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL(process.env.EXPANDED_OBSTACLES_ASSETS_QA_OUTPUT ?? "../docs/aegis/work/2026-10-13-expanded-obstacles/assets-review/", import.meta.url);
await mkdir(new URL("screenshots/", output), { recursive: true });
const url = process.env.EXPANDED_OBSTACLES_QA_URL ?? "http://127.0.0.1:11075";
const kinds = ["HayCart", "WaterTrough", "HangingLantern", "FlyingGoose"];
const seasons = [["spring", 0], ["summer", 1500], ["autumn", 3000], ["winter", 4500]];
const report = {
  passed: false, browser: "Edge", productionPreview: url, phoneHardware: false,
  method: "Isolated-storage production build, touch menu entry, real texture pixels and Arcade bodies. Frozen-position galleries and edge/pool fixtures invoke shipping methods directly. These fixtures are not natural gameplay and do not modify shipping code.",
  views: [],
};

// A root-owned preview can be preparing its build when this script starts.
let readyServer = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try { if ((await fetch(url)).ok) { readyServer = true; break; } } catch {}
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert(readyServer, "production preview becomes available");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const [width, height, dpr] of [[1672, 941, 1], [896, 414, 2], [800, 600, 1]]) {
    const view = { width, height, dpr, checks: [], errors: [], diagnostics: [], textures: [], galleries: [], recycling: [], poolReuse: [] };
    report.views.push(view);
    const check = (condition, label) => { assert(condition, label); view.checks.push(label); };
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    await context.addInitScript(() => {
      localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 12345, totalStars: 0, coins: 0, selectedSkin: "white", unlockedSkins: ["white"], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false } }));
      localStorage.setItem("sheep-run-mailbox-v1", JSON.stringify({ version: 1, readIds: ["welcome-v1", "retired-letter"] }));
    });
    const page = await context.newPage();
    page.on("pageerror", error => view.errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      if (message.text().startsWith("Ignored attempt to cancel")) view.diagnostics.push(message.text());
      else view.errors.push(message.text());
    });
    const request = page.waitForRequest(request => /\/assets\/main-[^/]+\.js/.test(request.url()));
    await page.goto(url);
    view.bundle = (await request).url();
    await page.evaluate(async main => { window.qaGame = (await import(main)).game.instance; }, view.bundle);
    await page.waitForFunction(() => window.qaGame.scene.isActive("MenuScene") && document.querySelector("[data-menu-art]")?.dataset.layout);
    const frames = (count = 2) => page.evaluate(count => new Promise((resolve, reject) => {
      const game = window.qaGame;
      const timeout = setTimeout(() => { game.events.off("postrender", next); reject(Error("Rendering stalled")); }, 5000);
      const next = () => { if (--count <= 0) { clearTimeout(timeout); game.events.off("postrender", next); resolve(); } };
      game.events.on("postrender", next);
    }), count);
    const tap = async (key, name) => {
      const point = await page.evaluate(({ key, name }) => {
        const scene = window.qaGame.scene.getScene(key), object = scene.children.getByName(name);
        if (!object) throw Error(`Missing ${key}/${name}`);
        const matrix = object.getWorldTransformMatrix(), rect = window.qaGame.canvas.getBoundingClientRect(), size = window.qaGame.scale.gameSize;
        return { x: rect.x + matrix.tx * rect.width / size.width, y: rect.y + matrix.ty * rect.height / size.height };
      }, { key, name });
      await page.touchscreen.tap(point.x, point.y);
      await frames();
    };
    const shot = async name => {
      await frames();
      const path = `screenshots/${width}x${height}-${name}.png`;
      await page.screenshot({ path: fileURLToPath(new URL(path, output)), scale: "css" });
      return path;
    };
    await tap("MenuScene", "button:开始游戏");
    await page.waitForFunction(() => window.qaGame.scene.isActive("RunScene") && window.qaGame.scene.getScene("RunScene").sheep?.body);
    await frames();
    view.fixture = await page.evaluate(kinds => {
      const game = window.qaGame, scene = game.scene.getScene("RunScene");
      scene.sys.sceneUpdate = () => {};
      scene.physics.pause(); scene.inputSystem.reset();
      for (const group of [scene.obstacles, scene.stars, scene.powerUps]) for (const child of group.getChildren()) child.deactivate();
      const generator = new scene.spawnSystem.constructor(78), definitions = {};
      for (let frame = 0; frame < 15000; frame += 1) for (const request of generator.update(.04, 390)) {
        if (request.type === "obstacle") definitions[request.definition.kind] = request.definition;
      }
      window.qaDefinitions = definitions; window.qaObstacles = {};
      window.qaSaveBefore = [localStorage.getItem("sheep-run-save"), localStorage.getItem("sheep-run-mailbox-v1")];
      const label = document.createElement("div"); label.id = "qa-fixture-label";
      label.textContent = "QA FIXTURE · frozen gallery · not natural gameplay";
      Object.assign(label.style, { position: "fixed", left: "8px", bottom: "8px", zIndex: "9999", padding: "4px 8px", background: "#fff3d6", color: "#542b16", border: "1px solid #542b16", font: "12px sans-serif", pointerEvents: "none" });
      document.body.append(label);
      return { logical: { width: game.scale.gameSize.width, height: game.scale.gameSize.height }, camera: { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY }, reachable: kinds.filter(kind => definitions[kind]), totalReachable: Object.keys(definitions).length };
    }, kinds);
    check(view.fixture.reachable.length === 4, "all four new definitions can be obtained from the shipped seeded generator");
    view.textures = await page.evaluate(kinds => ["spring", "summer", "autumn", "winter"].flatMap(season => kinds.map(kind => {
      const key = `season-${season}-obstacle-${kind}`, texture = window.qaGame.textures.get(key), source = texture.getSourceImage();
      const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
      const context = canvas.getContext("2d"); context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0, partial = 0, left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      let pixelHash = 2166136261;
      for (const byte of pixels) pixelHash = Math.imul(pixelHash ^ byte, 16777619) >>> 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const alpha = pixels[(y * canvas.width + x) * 4 + 3];
        if (alpha) { visible++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
        if (alpha > 0 && alpha < 255) partial++;
      }
      return { key, visible, partial, pixelHash: pixelHash.toString(16).padStart(8, "0"), nearest: texture.source[0].scaleMode === 1, width: canvas.width, height: canvas.height, ink: { left, top, right, bottom } };
    })), kinds);
    check(view.textures.length === 16 && view.textures.every(texture => texture.visible > 0 && texture.partial === 0 && texture.nearest), "all sixteen actual runtime textures contain hard-alpha visible art and use nearest filtering");
    check(new Set(view.textures.map(texture => texture.pixelHash)).size === 16, "all sixteen seasonal runtime sprites have distinct actual pixel content");
    check(await page.evaluate(() => !window.qaGame.textures.exists("expanded-obstacles-v3-source")), "generated source atlas is released after runtime texture preparation");

    for (const [season, score] of seasons) {
      const gallery = await page.evaluate(({ kinds, season, score }) => {
        const scene = window.qaGame.scene.getScene("RunScene");
        for (const child of scene.obstacles.getChildren()) child.deactivate();
        scene.scoreSystem.distance = 0; scene.scoreSystem.bonus = score;
        scene.environmentSystem.update(0, 0, score);
        const positions = [125, 235, 350, 405];
        const rows = kinds.map((kind, index) => {
          const definition = window.qaDefinitions[kind], object = scene.acquireObstacle(definition, 0);
          window.qaObstacles[kind] = object;
          object.activate(positions[index], 0, 0, season); object.body.updateFromGameObject();
          const bounds = object.getBounds(), body = object.body, source = object.texture.getSourceImage();
          const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
          const context = canvas.getContext("2d"); context.drawImage(source, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const bx0 = Math.max(0, Math.floor((body.x - bounds.x) / bounds.width * canvas.width));
          const by0 = Math.max(0, Math.floor((body.y - bounds.y) / bounds.height * canvas.height));
          const bx1 = Math.min(canvas.width, Math.ceil((body.right - bounds.x) / bounds.width * canvas.width));
          const by1 = Math.min(canvas.height, Math.ceil((body.bottom - bounds.y) / bounds.height * canvas.height));
          let opaqueInBody = 0;
          for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) if (pixels[(y * canvas.width + x) * 4 + 3]) opaqueInBody++;
          return { kind, texture: object.texture.key, name: object.getData("visualName"), x: object.x, y: object.y,
            bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom },
            body: { x: body.x, y: body.y, width: body.width, height: body.height, right: body.right, bottom: body.bottom },
            scale: [object.scaleX, object.scaleY], definition, opaqueInBody, bodyInkCoverage: opaqueInBody / Math.max(1, (bx1 - bx0) * (by1 - by0)) };
        });
        return { season: scene.environmentSystem.snapshot().theme, rows };
      }, { kinds, season, score });
      view.galleries.push(gallery);
      check(gallery.season === season, `${season}: background season agrees with the gallery`);
      for (const row of gallery.rows) {
        const d = row.definition;
        check(row.texture === `season-${season}-obstacle-${row.kind}` && !!row.name, `${season}/${row.kind}: correct actual seasonal texture and display name`);
        check(Math.abs(row.scale[0] - row.scale[1]) < .00001, `${season}/${row.kind}: uniform sprite scale`);
        check(Math.abs(row.body.width - d.hitbox.width) < .001 && Math.abs(row.body.height - d.hitbox.height) < .001,
          `${season}/${row.kind}: real Arcade body keeps authored dimensions`);
        check(Math.abs(row.body.x - (row.x + d.hitbox.offsetX)) < .001
          && Math.abs(row.body.y - (218 - d.groundOffset - d.height + d.hitbox.offsetY)) < .001
          && row.y === 218 - d.groundOffset && Math.abs(row.bounds.bottom - row.y) < .001,
          `${season}/${row.kind}: real body placement and foot baseline remain anchored`);
        check(row.bodyInkCoverage >= .6, `${season}/${row.kind}: most of the collision area overlaps visible subject ink`);
      }
      gallery.screenshot = await shot(`${season}-gallery`);
      await page.evaluate(rows => {
        const scene = window.qaGame.scene.getScene("RunScene"), graphics = scene.add.graphics().setName("qa-body-overlay").setDepth(100);
        graphics.lineStyle(1, 0xff00ff, 1);
        for (const row of rows) graphics.strokeRect(row.body.x, row.body.y, row.body.width, row.body.height);
      }, gallery.rows);
      gallery.bodyScreenshot = await shot(`${season}-body-overlay`);
      await page.evaluate(() => window.qaGame.scene.getScene("RunScene").children.getByName("qa-body-overlay").destroy());
    }

    for (const kind of kinds) {
      const rows = view.galleries.map(gallery => gallery.rows.find(row => row.kind === kind));
      check(rows.every(row => JSON.stringify(row.body) === JSON.stringify(rows[0].body)), `${kind}: seasonal changes never move or resize the real body`);
      const recycled = { kind, samples: [] }; view.recycling.push(recycled);
      await page.evaluate(kind => {
        const scene = window.qaGame.scene.getScene("RunScene");
        for (const child of scene.obstacles.getChildren()) child.deactivate();
        scene.scoreSystem.distance = 0; scene.scoreSystem.bonus = 0;
        const object = scene.acquireObstacle(window.qaDefinitions[kind], 0);
        window.qaRecycleObject = object; object.activate(200, 0, 0, "spring");
        document.getElementById("qa-fixture-label").textContent = `QA FIXTURE · ${kind} edge/recycle · not natural gameplay`;
      }, kind);
      const place = async (screenRight, behind = false) => {
        const sample = await page.evaluate(({ screenRight, behind }) => {
          const scene = window.qaGame.scene.getScene("RunScene"), object = window.qaRecycleObject, left = scene.cameras.main.scrollX;
          const x = behind ? 80 - object.definition.width - 1 : left + screenRight - (object.displayWidth + object.definition.width) / 2;
          object.body.reset(x, 218 - object.definition.groundOffset); scene.moveObjects(0);
          const bounds = object.getBounds();
          return { active: object.active, visible: object.visible, bodyEnabled: object.body.enable, passed: object.passed, score: scene.scoreSystem.score,
            authoredRight: object.rightEdge, visualRight: object.visualRightEdge, boundsRight: bounds.right, screenRight: bounds.right - left, recycleX: scene.obstacleRecycleX };
        }, { screenRight, behind });
        recycled.samples.push(sample); await frames(); return sample;
      };
      let state = await place(0, true);
      check(state.active && state.visible && state.passed && state.score === 25, `${kind}: passes behind sheep while retaining artwork and awarding exactly 25`);
      check(Math.abs(state.visualRight - state.boundsRight) < .001, `${kind}: visualRightEdge matches actual rendered bounds`);
      await page.evaluate(() => window.qaGame.scene.getScene("RunScene").moveObjects(0));
      check(await page.evaluate(() => window.qaGame.scene.getScene("RunScene").scoreSystem.score) === 25, `${kind}: repeated movement does not repeat passing reward`);
      recycled.behindScreenshot = await shot(`${kind}-behind`);
      if (view.fixture.camera.x < -40) {
        const oldBoundary = await place(-21 - view.fixture.camera.x);
        check(oldBoundary.authoredRight < -20 && oldBoundary.active && oldBoundary.visible, `${kind}: previous fixed world recycle boundary remains visible and retained in wide screens`);
      }
      state = await place(8);
      check(state.active && state.visible && Math.abs(state.screenRight - 8) < .001, `${kind}: last visible pixels are retained at the screen edge`);
      recycled.edgeScreenshot = await shot(`${kind}-edge`);
      state = await place(-19); check(state.active, `${kind}: offscreen pixel-rounding margin is retained`);
      state = await place(-21);
      check(!state.active && !state.visible && !state.bodyEnabled && state.score === 25, `${kind}: fully offscreen artwork recycles without another reward`);
      const reuse = await page.evaluate(kind => {
        const scene = window.qaGame.scene.getScene("RunScene"), old = window.qaRecycleObject, object = scene.acquireObstacle(window.qaDefinitions[kind], 0);
        object.activate(200, 0, 0, "winter"); object.body.updateFromGameObject();
        return { kind, sameObject: object === old, active: object.active, visible: object.visible, bodyEnabled: object.body.enable, passed: object.passed,
          texture: object.texture.key, poolCount: scene.obstacles.getChildren().filter(child => child.definition.kind === kind).length };
      }, kind);
      view.poolReuse.push(reuse);
      check(reuse.sameObject && reuse.active && reuse.visible && reuse.bodyEnabled && !reuse.passed && reuse.poolCount === 1
        && reuse.texture === `season-winter-obstacle-${kind}`, `${kind}: pool reuses the same object with fresh passing state and the requested seasonal art`);
    }
    check(await page.evaluate(() => JSON.stringify(window.qaSaveBefore) === JSON.stringify([localStorage.getItem("sheep-run-save"), localStorage.getItem("sheep-run-mailbox-v1")])), "all fixture checks leave existing saves unchanged");
    check(view.errors.length === 0, "no application or resource runtime errors");
    console.log(JSON.stringify({ width, height, checks: view.checks.length, textures: view.textures.length }));
    await context.close();
  }
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: fileURLToPath(new URL("screenshots/failure.png", output)), scale: "css" });
  throw error;
} finally {
  await writeFile(new URL("browser-verification.json", output), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, checks: report.views.reduce((sum, view) => sum + view.checks.length, 0) }));
