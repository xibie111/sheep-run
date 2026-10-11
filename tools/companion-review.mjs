import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const mode = process.argv[2] ?? (process.env.COMPANION_REVIEW_PRODUCTION === "1" ? "--production" : process.env.COMPANION_REVIEW_FIXTURES === "1" ? "--fixtures" : process.env.COMPANION_REVIEW_MISS === "1" ? "--miss" : process.env.COMPANION_REVIEW_ACCESSORY === "1" ? "--accessory" : "--natural");
assert(["--natural", "--production", "--fixtures", "--miss", "--accessory"].includes(mode), "Unknown review mode");
const production = mode === "--production";
const url = process.env.COMPANION_REVIEW_URL || (production ? "http://127.0.0.1:4197" : "http://127.0.0.1:4196");
const output = new URL("../docs/companion-review/2026-10-11/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = { url, production, engine: "Edge Chromium mobile touch emulation", phoneHardware: false, checks: [], failures: [], cases: [] };
const check = (value, text) => { assert(value, text); report.checks.push(text); };
async function open(width, height, unlockedSkins = ["white"], reducedMotion = false) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(unlockedSkins => {
    localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 1000, totalStars: 40, coins: 20, selectedSkin: "white", unlockedSkins,
      upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: true, musicVolume: 1, sfxVolume: .6 } }));
    window.bellSounds = [];
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(...args) {
      const node = original.apply(this, args), start = node.start.bind(node), setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
      let bell = false;
      node.frequency.setValueAtTime = (value, time) => { if (value === 1568) bell = true; return setFrequency(value, time); };
      node.start = (...args) => { if (bell) window.bellSounds.push({ at: this.currentTime }); return start(...args); };
      return node;
    };
  }, unlockedSkins);
  const moduleRequest = page.waitForRequest(request => new RegExp(production ? "/assets/main-[^/]+\\.js" : "/src/main\\.ts").test(request.url()));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const mainUrl = (await moduleRequest).url();
  await page.evaluate(async mainUrl => { window.g = (await import(mainUrl)).game.instance; }, mainUrl);
  await page.waitForFunction(() => window.g.scene.isActive("MenuScene") && window.g.scene.getScene("MenuScene").children.list.length > 0);
  const cdp = await context.newCDPSession(page);
  return { page, context, cdp, errors, width, height };
}
async function tap(f, sceneKey, name) {
  const p = await f.page.evaluate(({ sceneKey, name }) => {
    const scene = window.g.scene.getScene(sceneKey), object = scene.children.getByName(name);
    if (!object) throw new Error(`Missing touch target ${sceneKey}/${name}`);
    const target = object.getData("hud-rect"), box = target ? { centerX: target.x + target.width / 2, centerY: target.y + target.height / 2 } : object.getBounds();
    const rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
    return { x: rect.x + (box.centerX - scene.cameras.main.scrollX * object.scrollFactorX) * rect.width / size.width,
      y: rect.y + (box.centerY - scene.cameras.main.scrollY * object.scrollFactorY) * rect.height / size.height };
  }, { sceneKey, name });
  await f.page.touchscreen.tap(p.x, p.y);
}
async function gesture(f, kind) {
  const x = f.width * .67, y = f.height * .57;
  if (kind === "jump") return f.page.touchscreen.tap(x, y);
  await f.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await f.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (kind === "crouch" ? 100 : -100) }] });
  await f.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const state = f => f.page.evaluate(() => {
  const r = window.g.scene.getScene("RunScene"), c = r.companions;
  const live = name => r.children.list.filter(o => o.active && o.name === name);
  const bell = live("companion-bell-pickup")[0], partner = live("companion-sheep")[0], lead = r.sheep;
  return { active: window.g.scene.isActive("RunScene"), paused: window.g.scene.isPaused("RunScene"), finished: r.finished, now: r.activeRunTimeMs,
    speed: r.speed, schedule: c?.scheduler.state, eligible: c?.scheduler.nextEligibleAtMs, visitStarted: c?.companion?.startedAtMs,
    bell: bell ? { x: bell.x, y: bell.y, angle: bell.angle, body: Boolean(bell.body), key: bell.texture.key } : null,
    partner: partner ? { x: partner.x, y: partner.y, width: partner.displayWidth, height: partner.displayHeight, angle: partner.angle, skin: partner.getData("skin"), phase: partner.getData("phase"), frame: partner.frame.name, animation: partner.anims.currentAnim?.key, body: Boolean(partner.body) } : null,
    lead: { x: lead.x, y: lead.y, width: lead.frame ? lead.displayWidth : null, height: lead.frame ? lead.displayHeight : null, motion: lead.motionState, body: lead.body ? { x: lead.body.x, y: lead.body.y, width: lead.body.width, height: lead.body.height } : null },
    bells: live("companion-bell-pickup").length, partners: live("companion-sheep").length, accessories: live("companion-neck-bell").length,
    sounds: window.bellSounds.length, score: r.scoreSystem.score, bonus: r.scoreSystem.bonus, stars: r.scoreSystem.starCount, streak: r.scoreSystem.streak,
    save: JSON.parse(localStorage.getItem("sheep-run-save")), viewport: { width: window.g.scale.gameSize.width, height: window.g.scale.gameSize.height },
    objects: r.children.list.filter(o => o.active && o.name.startsWith("companion")).map(o => o.name),
    inputListeners: ["pointerdown", "pointermove", "pointerup", "pointerupoutside"].map(event => r.input.listenerCount(event)),
  };
});
async function start(f, seed = 42) {
  await tap(f, "MenuScene", "button:开始游戏");
  await f.page.waitForFunction(() => window.g.scene.isActive("RunScene") && window.g.scene.getScene("RunScene").companions);
  // Reproducible isolated review seed; no timer, position or spawning acceleration.
  await f.page.evaluate(seed => { const r = window.g.scene.getScene("RunScene"); r.spawnSystem.reset(seed, r.upgradeEffects.jumpImpulseMultiplier); }, seed);
}
async function screenshot(f, name) {
  await f.page.screenshot({ path: fileURLToPath(new URL(name, output)), fullPage: true });
}
async function pauseCheck(f, label) {
  await tap(f, "RunScene", "button:暂停"); await f.page.waitForFunction(() => window.g.scene.isActive("PauseScene"));
  const before = await state(f); await f.page.waitForTimeout(650); const after = await state(f);
  check(before.now === after.now && JSON.stringify(before.bell) === JSON.stringify(after.bell) && JSON.stringify(before.partner) === JSON.stringify(after.partner), `${label}: pause freezes effective clock and presentation`);
  await screenshot(f, `${f.width}x${f.height}-${label}-paused.png`);
  await tap(f, "PauseScene", "button:继续游戏"); await f.page.waitForFunction(() => window.g.scene.isActive("RunScene"));
}
async function pilot(f, until, { miss = false, limitMs = 70_000, screenshotPhase = true } = {}) {
  const began = Date.now(); let lastGesture = 0; const snapshots = {}, events = [];
  while (Date.now() - began < limitMs) {
    const s = await state(f);
    assert(s.bells <= 1 && s.partners <= 1 && !(s.bells && s.partners), "single bell/companion invariant throughout the actual run");
    if (s.finished) {
      await screenshot(f, `${f.width}x${f.height}-pilot-failure.png`);
      const nearby = await f.page.evaluate(() => window.g.scene.getScene("RunScene").obstacles.getChildren().filter(o => o.active).map(o => ({ kind: o.definition.kind, x: o.x, y: o.y, width: o.body.width, height: o.body.height })));
      throw new Error(`Touch pilot hit obstacle at ${s.now}: ${JSON.stringify({ lead: s.lead, nearby })}`);
    }
    for (const phase of [s.bell ? "bell" : null, s.partner?.phase]) if (phase && !snapshots[phase]) {
      snapshots[phase] = s; events.push({ phase, now: s.now, bell: s.bell, partner: s.partner });
      if (screenshotPhase) await screenshot(f, `${f.width}x${f.height}-natural-${phase}.png`);
    }
    if (until(s, snapshots)) return { state: s, snapshots, events };
    const action = await f.page.evaluate(miss => {
      const r = window.g.scene.getScene("RunScene"), lead = r.sheep, body = lead.body, speed = r.speed;
      const next = r.obstacles.getChildren().filter(o => o.active && o.rightEdge >= body.x).sort((a, b) => a.x - b.x)[0];
      const approachSeconds = next?.definition.kind === "TallStack" ? .32 : .23;
      if (next && next.x - body.right < speed * approachSeconds && next.rightEdge > body.x) {
        if (["FlyingBird", "HangingVine"].includes(next.definition.kind)) return "crouch";
        if (lead.grounded) return next.definition.kind === "TallStack" ? "high" : "jump";
      }
      const bell = r.children.getByName("companion-bell-pickup");
      if (miss && bell && lead.grounded && bell.x - body.right < speed * .18 && bell.x + 12 > body.x) return "high";
      return null;
    }, miss);
    if (action && Date.now() - lastGesture > 160) { await gesture(f, action); lastGesture = Date.now(); }
    await f.page.waitForTimeout(20);
  }
  throw new Error(`Pilot timeout: ${JSON.stringify(await state(f))}`);
}
async function fixtureBell(f) {
  await f.page.evaluate(async () => {
    const r = window.g.scene.getScene("RunScene"), { WoodFence } = await import("/src/game/ObstacleDefinitions.ts");
    r.spawnSystem.update = () => []; // Isolated fixture only: keep lifecycle/rendering tests separate from natural runs.
    for (const object of [...r.obstacles.getChildren(), ...r.stars.getChildren(), ...r.powerUps.getChildren()]) object.deactivate();
    const rightEdge = 494 - (42 + r.speed * .95 + 6);
    r.companions.observeObstacleSpawn({ type: "obstacle", definition: WoodFence, phase: 0, pattern: { id: "review-safe-gap", index: 0, length: 1 } },
      { x: rightEdge - 36, rightEdge, definition: WoodFence, active: false });
    r.activeRunTimeMs = Math.max(25_000, r.companions.scheduler.nextEligibleAtMs);
  });
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").children.getByName("companion-bell-pickup"));
}
async function fixtureCollect(f) {
  await fixtureBell(f);
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").companions.scheduler.state === "companion");
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").children.getByName("companion-sheep")?.getData("phase") === "following");
}
async function fixtures() {
  const f = await open(896, 414); await start(f); await fixtureCollect(f);
  const baseline = await state(f); check(baseline.partner.skin === "white", "fixture: white fallback uses existing animated sheet and accessory");
  await screenshot(f, "fixture-white-fallback.png");
  const skinCases = [];
  for (const skin of ["mint", "bearcap", "dream", "sleepy-blue"]) {
    // Local review storage only. Choice still runs through the production catalog validator on pickup.
    await f.page.evaluate(skin => {
      const r = window.g.scene.getScene("RunScene"); r.activeRunTimeMs += 10_100;
      const save = JSON.parse(localStorage.getItem("sheep-run-save")); save.unlockedSkins = ["white", skin]; localStorage.setItem("sheep-run-save", JSON.stringify(save));
    }, skin);
    await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").companions.scheduler.state === "waiting");
    await fixtureCollect(f); const s = await state(f);
    check(s.partner.skin === skin && s.partner.animation === `sheep-${skin}-run`, `fixture: actual ${skin} runtime texture and run animation`);
    await screenshot(f, `fixture-skin-${skin}.png`); skinCases.push(s.partner);
  }
  // Test read-only mirroring through real touch gestures and unchanged main-character physics.
  await gesture(f, "jump"); await f.page.waitForTimeout(110); const up = await state(f);
  check(up.partner.animation.includes("jump") && Math.abs(up.partner.y - up.lead.y) < .01, "fixture: companion mirrors touch jump without changing the lead");
  await screenshot(f, "fixture-jumping.png");
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").sheep.motionState === "FALLING");
  const fall = await state(f); check(fall.partner.animation.includes("fall") && Math.abs(fall.partner.y - fall.lead.y) < .01, "fixture: falling presentation follows the lead");
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").sheep.grounded);
  await gesture(f, "crouch"); await f.page.waitForTimeout(60); const crouch = await state(f);
  check(crouch.lead.height === 30 && Math.abs(crouch.partner.height - 25.5) < .01, "fixture: touch crouch at 85 percent");
  await screenshot(f, "fixture-crouching.png"); await f.page.waitForTimeout(600);
  // Magnet and multiplier still affect original stars only; bell runs at world speed on its own.
  await f.page.evaluate(() => { const r = window.g.scene.getScene("RunScene"); r.activeRunTimeMs += 10_100; });
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").companions.scheduler.state === "waiting");
  await fixtureBell(f);
  const effects = await f.page.evaluate(() => {
    const r = window.g.scene.getScene("RunScene"), now = r.activeRunTimeMs;
    const magnet = r.acquirePowerUp("magnet"); magnet.activate(r.sheep.x, 199, "magnet", 0, r.speed); r.onPowerUpOverlap(magnet);
    const doubles = r.acquirePowerUp("starMultiplier"); doubles.activate(r.sheep.x, 199, "starMultiplier", 0, r.speed); r.onPowerUpOverlap(doubles);
    const shield = r.acquirePowerUp("shield"); shield.activate(r.sheep.x, 199, "shield", 0, r.speed); r.onPowerUpOverlap(shield);
    const star = r.acquireStar(); star.activate(r.sheep.x + 90, r.sheep.y - 15, 0, r.speed);
    window.reviewStar = star;
    return { beforeStars: r.scoreSystem.starCount, beforeBonus: r.scoreSystem.bonus, now, starX: star.x, bellX: r.children.getByName("companion-bell-pickup").x,
      effects: r.powerUpSystem.activeEffects(now).map(e => e.type), pools: [r.stars.getChildren().length, r.powerUps.getChildren().length] };
  });
  await f.page.waitForTimeout(100); const moved = await state(f);
  const actualStar = await f.page.evaluate(() => ({ x: window.reviewStar.x, vx: window.reviewStar.body.velocity.x }));
  check(actualStar.vx < -moved.speed, "fixture: original star is attracted by magnet");
  const normalBellTravel = effects.bellX - moved.bell.x, expectedTravel = (moved.now - effects.now) / 1000 * (moved.speed + (moved.speed - (moved.now - effects.now) / 1000 * 5.1)) / 2;
  check(Math.abs(normalBellTravel - expectedTravel) < 2, "fixture: bell follows world speed despite magnet");
  await f.page.waitForFunction(() => !window.reviewStar.active);
  const doubled = await state(f); check(doubled.stars === effects.beforeStars + 1 && doubled.bonus - effects.beforeBonus === 200, "fixture: original star multiplier doubles score while counting one pickup");
  const beforeBellStars = doubled.stars, beforeBellSave = doubled.save;
  await f.page.waitForFunction(() => window.g.scene.getScene("RunScene").companions.scheduler.state === "companion");
  const bellCollected = await state(f);
  check(bellCollected.stars === beforeBellStars && bellCollected.bonus === doubled.bonus && JSON.stringify(bellCollected.save) === JSON.stringify(beforeBellSave), "fixture: bell grants no score bonus, stars, currency, unlocks or save fields");
  const shieldResult = await f.page.evaluate(async () => {
    const r = window.g.scene.getScene("RunScene"), { WoodFence } = await import("/src/game/ObstacleDefinitions.ts");
    const obstacle = r.acquireObstacle(WoodFence, 0); obstacle.activate(400, 0, r.speed, "spring"); r.onObstacleOverlap(obstacle);
    return { finished: r.finished, shield: r.powerUpSystem.isActive("shield", r.activeRunTimeMs), obstacle: obstacle.active, partner: r.children.getByName("companion-sheep")?.active };
  });
  check(!shieldResult.finished && !shieldResult.shield && !shieldResult.obstacle && shieldResult.partner, "fixture: shield absorbs original obstacle and companion continues");
  await screenshot(f, "fixture-powerups.png");
  // Simulated background event uses the actual automatic-pause handler.
  await f.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await f.page.waitForFunction(() => window.g.scene.isActive("PauseScene"));
  const hidden = await state(f); await f.page.waitForTimeout(300);
  check((await state(f)).now === hidden.now, "fixture: background automatic pause freezes companion clock");
  await f.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
  await tap(f, "PauseScene", "button:继续游戏");
  // A fatal collision destroys the whole companion immediately, before the result transition.
  await f.page.evaluate(() => window.g.scene.getScene("RunScene").onObstacleOverlap());
  const fatal = await state(f); check(fatal.finished && fatal.objects.length === 0, "fixture: fatal collision immediately clears the companion");
  await f.page.waitForFunction(() => window.g.scene.isActive("ResultScene"));
  check((await state(f)).objects.length === 0, "fixture: companion never enters results");
  // Restart and exit via existing touch controls in all three states.
  await f.page.evaluate(() => { window.g.scene.stop("ResultScene"); window.g.scene.start("MenuScene"); });
  await f.page.waitForFunction(() => window.g.scene.isActive("MenuScene")); await start(f);
  const restartEvidence = [];
  for (const stage of ["waiting", "bell", "companion", "bell", "companion", "waiting"]) {
    if (stage === "bell") await fixtureBell(f); if (stage === "companion") await fixtureCollect(f);
    await tap(f, "RunScene", "button:暂停"); await f.page.waitForFunction(() => window.g.scene.isActive("PauseScene"));
    const before = await state(f); await tap(f, "PauseScene", "button:重新开始");
    await f.page.waitForFunction(() => window.g.scene.isActive("RunScene") && window.g.scene.getScene("RunScene").activeRunTimeMs < 2000);
    const after = await state(f);
    check(after.objects.length === 0 && after.schedule === "waiting" && after.eligible === 25_000 && JSON.stringify(after.inputListeners) === JSON.stringify(baseline.inputListeners), `fixture: ${stage} restart leaves no objects or duplicate input listeners`);
    check(after.sounds === before.sounds, `fixture: ${stage} restart plays no duplicate bell`); restartEvidence.push({ stage, before, after });
  }
  await fixtureCollect(f); await tap(f, "RunScene", "button:暂停"); await f.page.waitForFunction(() => window.g.scene.isActive("PauseScene"));
  await tap(f, "PauseScene", "button:返回首页"); await f.page.waitForFunction(() => window.g.scene.isActive("MenuScene"));
  check((await state(f)).objects.length === 0 && (await state(f)).schedule === undefined, "fixture: exit clears objects and releases controller");
  check(f.errors.length === 0, "fixtures: no browser runtime errors");
  report.cases.push({ fixtures: "Isolated saved unlocks; effective clock advanced for cooldowns; safe-gap observer fixture; original spawning disabled only in this review page. Original star/power-up/obstacle objects and real touch/physics used for their checks.", skinCases, up, fall, crouch, effects, actualStar, normalBellTravel, expectedTravel, shieldResult, hidden, fatal, restartEvidence, errors: f.errors });
  await f.context.close();
  const reduced = await open(800, 600, ["white"], true); await start(reduced); await fixtureCollect(reduced);
  await reduced.page.evaluate(() => { const r = window.g.scene.getScene("RunScene"); r.activeRunTimeMs = r.companions.companion.startedAtMs + 9250; });
  await reduced.page.waitForTimeout(70); const goodbye = await state(reduced);
  check(goodbye.partner.phase === "leaving" && goodbye.partner.angle === 0 && goodbye.partner.y === goodbye.lead.y, "fixture: reduced motion removes farewell hop and nod");
  await screenshot(reduced, "800x600-reduced-motion-farewell.png");
  report.cases.push({ reducedMotion: goodbye, errors: reduced.errors }); await reduced.context.close();
}
async function accessoryComparison() {
  const f = await open(896, 414); await start(f); await fixtureCollect(f);
  await f.page.evaluate(() => { const r = window.g.scene.getScene("RunScene"); r.sys.pause(); });
  await f.page.waitForTimeout(80);
  await screenshot(f, "accessory-after.png");
  // Reconstruct the previous attachment only in this isolated, paused review page.
  await f.page.evaluate(() => {
    const c = window.g.scene.getScene("RunScene").companions.companion, s = c.sheep;
    c.collar.setSize(12, 2).setFillStyle(0x526a2d).setPosition(s.x + s.displayWidth * .20, s.y - s.displayHeight * .42).setAngle(0);
    c.bell.setOrigin(.5, .5).setDisplaySize(10, 12).setPosition(s.x + s.displayWidth * .20 + 2, s.y - s.displayHeight * .42 + 5).setAngle(0);
  });
  await f.page.waitForTimeout(80); await screenshot(f, "accessory-before.png");
  check(f.errors.length === 0, "accessory: same-frame before/after display comparison saved");
  report.cases.push({ comparison: "Same paused frame, final production position versus previous accessory reconstructed only in isolated review page", errors: f.errors }); await f.context.close();
}
try {
  if (mode === "--accessory") await accessoryComparison();
  else if (mode === "--fixtures") await fixtures();
  else if (mode === "--miss") {
    for (const [width, height] of [[896, 414], [844, 390], [800, 600]]) {
    console.log(`Natural miss ${width}x${height}`);
    const f = await open(width, height); await start(f);
    const arrival = await pilot(f, s => Boolean(s.bell));
    const missed = await pilot(f, s => !s.bell && !s.partner && s.schedule === "waiting", { miss: true });
    check(missed.state.now > arrival.state.now && !missed.state.finished && missed.state.sounds === 0 && missed.state.objects.length === 0, "natural miss: real touch jump avoids bell; recycled without companion, penalty or sound");
    check(missed.state.eligible - missed.state.now >= 34_900 && missed.state.eligible - missed.state.now <= 50_000, "natural miss: fresh 35–50 second effective-time cooldown");
    await screenshot(f, `${width}x${height}-natural-missed.png`);
    await f.page.waitForTimeout(500); check((await state(f)).bells === 0, "natural miss: no immediate replacement");
    check(f.errors.length === 0, "natural miss: no runtime errors");
    report.cases.push({ width, height, fixture: "Original seeded spawning and physics, real effective time and touch high jump; no accelerated clock or pickup positioning", arrival, missed, errors: f.errors }); await f.context.close();
    }
  }
  else {
  for (const [width, height] of (production ? [[844, 390]] : [[896, 414], [844, 390], [800, 600]])) {
    console.log(`Natural touch run ${width}x${height}`);
    const f = await open(width, height, width === 844 ? ["white", "mint", "bearcap", "dream"] : ["white"]);
    await start(f); await pauseCheck(f, "waiting");
    const arrival = await pilot(f, s => Boolean(s.bell));
    check(arrival.state.now >= 25_000 && !arrival.state.bell.body, `${width}x${height}: natural eligible bell, no physics body`);
    await pauseCheck(f, "bell");
    const collected = await pilot(f, s => Boolean(s.partner));
    check(collected.state.sounds === 1 && !collected.state.partner.body && collected.state.bells === 0, `${width}x${height}: one pickup, companion and bell sound ${JSON.stringify({ sounds: collected.state.sounds, bellCount: collected.state.bells, body: collected.state.partner.body })}`);
    const following = await pilot(f, s => s.partner?.phase === "following");
    check(Math.abs(following.state.partner.width / following.state.lead.width - .85) < .001, `${width}x${height}: 85 percent size`);
    check(following.state.partner.x + following.state.partner.width / 2 <= following.state.lead.x - following.state.lead.width / 2 - 11.9, `${width}x${height}: clear trailing gap`);
    await pauseCheck(f, "following");
    const departed = await pilot(f, s => !s.partner && s.schedule === "waiting");
    check(departed.state.eligible - departed.state.now >= 34_900 && departed.state.eligible - departed.state.now <= 50_000, `${width}x${height}: full departure starts cooldown`);
    check(departed.state.sounds === 1 && departed.state.objects.length === 0, `${width}x${height}: no lingering partner or sound`);
    check(departed.state.now - collected.state.visitStarted >= 10_000 && departed.state.now - collected.state.visitStarted < 10_100, `${width}x${height}: visit lasts ten effective seconds`);
    check(departed.state.lead.x === 101, `${width}x${height}: viewport preserves the original lead position`);
    check(width === 844 ? ["mint", "bearcap", "dream"].includes(collected.state.partner.skin) : collected.state.partner.skin === "white", `${width}x${height}: actual unlocked/fallback rendering`);
    check(f.errors.length === 0, `${width}x${height}: no browser errors`);
    report.cases.push({ width, height, fixture: "isolated saved unlocks and original spawn seed 42; real effective time, obstacles, physics and touch gestures", arrival, collected, following, departed, errors: f.errors });
    await f.context.close();
  }
  }
} catch (error) { report.failures.push(error.stack); process.exitCode = 1; }
finally { await writeFile(new URL(production ? "production-verification.json" : mode === "--accessory" ? "accessory-comparison.json" : mode === "--fixtures" ? "browser-fixtures.json" : mode === "--miss" ? "browser-miss.json" : "browser-verification.json", output), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, completed: report.cases.map(c => [c.width, c.height]) })); await browser.close(); }
