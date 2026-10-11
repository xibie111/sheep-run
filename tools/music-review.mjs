import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const origin = process.env.MUSIC_REVIEW_URL || "http://127.0.0.1:4196";
const production = process.env.MUSIC_REVIEW_PRODUCTION === "1";
const output = new URL("../docs/music-review/2026-10-11/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = { origin, production, contexts: "isolated, touch input, native AudioContext, no autoplay-policy override", failures: [] };

async function openGame({ muted = false, blocked = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 896, height: 414 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(), errors = [], musicRequests = [];
  let mainUrl, block = blocked;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (new RegExp(production ? "/assets/main-[^/]+\\.js" : "/src/main\\.ts").test(request.url())) mainUrl = request.url();
    if (request.url().includes("pasture-morning-v1") && request.url().includes(".wav")) musicRequests.push(request.url());
  });
  await page.route("**/*pasture-morning-v1*.wav*", route => block ? route.abort() : route.continue());
  await page.addInitScript(muted => {
    localStorage.setItem("sheep-run-save", JSON.stringify({ version: 4, highScore: 1234, totalStars: 36, coins: 12, selectedSkin: "white", unlockedSkins: ["white"], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: !muted, sfx: true, musicVolume: 1, sfxVolume: 1 } }));
    window.musicRecords = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function(...args) {
      const node = original.apply(this, args), record = { node, starts: 0, stops: 0, offsets: [] };
      const start = node.start.bind(node), stop = node.stop.bind(node);
      node.start = (...args) => { record.starts++; record.offsets.push(args[1] || 0); return start(...args); };
      node.stop = (...args) => { record.stops++; return stop(...args); };
      window.musicRecords.push(record); return node;
    };
  }, muted);
  const moduleRequest = page.waitForRequest(request => new RegExp(production ? "/assets/main-[^/]+\\.js" : "/src/main\\.ts").test(request.url()));
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  mainUrl = (await moduleRequest).url();
  await page.evaluate(async url => { window.musicGame = (await import(url)).game.instance; }, mainUrl);
  await page.waitForFunction(() => window.musicGame.scene.isActive("MenuScene") && window.musicGame.scene.getScene("MenuScene").children.list.length > 0);
  await page.evaluate(() => { window.musicSystem = window.musicGame.registry.get("audioSystem"); });
  assert.equal(await page.evaluate(() => window.musicSystem.context), null, "no custom AudioContext before touch");
  assert.equal(musicRequests.length, 0);
  return { context, page, errors, musicRequests, releaseFile: () => { block = false; } };
}
const musicState = page => page.evaluate(() => {
  const audio = window.musicSystem, buffer = audio.musicBuffer;
  const records = window.musicRecords.filter(record => record.node.buffer?.duration > 1);
  return { state: audio.context?.state, settings: audio.currentSettings, duration: buffer?.duration, channels: buffer?.numberOfChannels,
    sampleRate: buffer?.sampleRate, active: Boolean(audio.musicSource), loop: audio.musicSource?.loop, gain: audio.musicGain?.gain.value,
    nodes: records.map(record => ({ starts: record.starts, stops: record.stops, offsets: record.offsets })), offset: audio.musicOffset };
});
async function waitMusic(page) { await page.waitForFunction(() => window.musicSystem.context?.state === "running" && window.musicSystem.musicSource?.loop && window.musicSystem.musicBuffer?.duration > 70); }
async function tap(page, sceneKey, name) {
  const p = await page.evaluate(({ sceneKey, name }) => {
    const game = window.musicGame, scene = game.scene.getScene(sceneKey);
    const walk = list => { for (const object of list) { if (object.name === name) return object; if (object.list) { const found = walk(object.list); if (found) return found; } } };
    const object = walk(scene.children.list); if (!object) throw Error(`Missing ${name}`);
    const box = object.getBounds(), rect = game.canvas.getBoundingClientRect(), size = game.scale.gameSize;
    return { x: rect.x + (box.centerX - scene.cameras.main.scrollX * object.scrollFactorX) * rect.width / size.width,
      y: rect.y + (box.centerY - scene.cameras.main.scrollY * object.scrollFactorY) * rect.height / size.height };
  }, { sceneKey, name });
  await page.touchscreen.tap(p.x, p.y);
}
async function signal(page) {
  return page.evaluate(() => {
    const analyser = window.musicAnalyser, data = new Float32Array(analyser.fftSize), spectrum = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data); analyser.getFloatFrequencyData(spectrum);
    let index = 0; for (let i = 1; i < spectrum.length; i++) if (spectrum[i] > spectrum[index]) index = i;
    return { time: window.musicSystem.context.currentTime, rms: Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length),
      peak: data.reduce((value, v) => Math.max(value, Math.abs(v)), 0), dominantHz: index * window.musicSystem.context.sampleRate / analyser.fftSize };
  });
}
try {
  const game = await openGame(); const { page } = game;
  await page.mouse.click(400, 60);
  assert.equal(await page.evaluate(() => window.musicSystem.context), null, "mouse cannot unlock custom music");
  await page.touchscreen.tap(400, 60); await waitMusic(page);
  const initial = await musicState(page);
  assert.equal(initial.nodes.length, 1); assert.equal(initial.channels, 2);
  assert(Math.abs(initial.duration - 73.8461678) < .002);
  assert.equal(game.musicRequests.length, 1);
  const seam = await page.evaluate(() => {
    const buffer = window.musicSystem.musicBuffer;
    let delta = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) { const data = buffer.getChannelData(channel); delta = Math.max(delta, Math.abs(data[0] - data.at(-1))); }
    const analyser = window.musicSystem.context.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0;
    window.musicSystem.musicGain.connect(analyser); window.musicAnalyser = analyser;
    return delta;
  });
  assert(seam < .03, "decoded loop boundary has no abrupt discontinuity");
  const samples = [];
  for (let index = 0; index < 12; index++) { await page.waitForTimeout(350); samples.push(await signal(page)); }
  assert(samples.every(sample => sample.rms > .001 && sample.peak < .4), "actual output contains bounded audible music");
  assert(new Set(samples.map(sample => sample.dominantHz)).size >= 3, "melody and accompaniment move beyond a fixed drone");
  await tap(page, "MenuScene", "button:开始游戏");
  await page.waitForFunction(() => window.musicGame.scene.isActive("RunScene"));
  await tap(page, "RunScene", "button:暂停");
  await page.waitForFunction(() => window.musicGame.scene.isActive("PauseScene"));
  const duringPause = await musicState(page);
  assert.equal(duringPause.nodes.length, 1, "scene transitions do not overlap background tracks");
  await tap(page, "PauseScene", "button:继续游戏");
  await page.waitForFunction(() => !window.musicGame.scene.isActive("PauseScene"));
  await tap(page, "RunScene", "button:暂停");
  await page.waitForFunction(() => window.musicGame.scene.isActive("PauseScene"));
  await tap(page, "PauseScene", "button:返回首页");
  await page.waitForFunction(() => window.musicGame.scene.isActive("MenuScene"));
  await page.evaluate(() => window.musicSystem.toggleMusic()); await page.waitForTimeout(100);
  const muted = await musicState(page), silence = await signal(page);
  assert(!muted.active && muted.nodes[0].stops === 1 && silence.rms === 0);
  const savedOffset = muted.offset;
  await page.evaluate(() => window.musicSystem.toggleMusic()); await waitMusic(page);
  const resumed = await musicState(page);
  assert(Math.abs(resumed.nodes.at(-1).offsets[0] - savedOffset) < .01);
  assert.equal(game.musicRequests.length, 1, "mute/resume does not fetch or decode twice");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => window.musicSystem.context.state === "suspended");
  assert.equal((await musicState(page)).active, false);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await waitMusic(page);
  const restored = await musicState(page);
  assert.equal(restored.nodes.filter(node => node.starts > node.stops).length, 1);
  assert.deepEqual(game.errors, []);
  await page.evaluate(() => { window.closedMusicContext = window.musicSystem.context; window.musicGame.destroy(true); });
  await page.waitForFunction(() => window.closedMusicContext.state === "closed");
  assert.equal((await musicState(page)).active, false);
  report.playback = { initial, samples, seam, duringPause, muted, silence, resumed, restored, visibility: "simulated document event, real native context suspension/resumption", destroy: "source stopped and context closed", errors: game.errors };
  await game.context.close();

  const savedMute = await openGame({ muted: true });
  await savedMute.page.touchscreen.tap(400, 60); await savedMute.page.waitForTimeout(200);
  assert.equal(savedMute.musicRequests.length, 0);
  assert.equal((await musicState(savedMute.page)).active, false);
  await savedMute.page.evaluate(() => window.musicSystem.toggleMusic()); await waitMusic(savedMute.page);
  const save = await savedMute.page.evaluate(() => JSON.parse(localStorage.getItem("sheep-run-save")));
  assert.equal(save.highScore, 1234); assert.equal(save.totalStars, 36); assert.equal(save.coins, 12);
  assert.equal(save.settings.music, true); assert.deepEqual(savedMute.errors, []);
  report.savedMute = { noFetchWhileMuted: true, enabledOnRequest: true, scoreAndInventoryUnchanged: true };
  await savedMute.context.close();

  const failed = await openGame({ blocked: true });
  await failed.page.touchscreen.tap(400, 60);
  await failed.page.waitForFunction(() => window.musicSystem.context && window.musicSystem.musicLoading === null);
  assert.equal((await musicState(failed.page)).active, false);
  assert(await failed.page.evaluate(() => window.musicGame.scene.isActive("MenuScene")));
  failed.releaseFile();
  await failed.page.touchscreen.tap(400, 60); await waitMusic(failed.page);
  assert.equal(failed.musicRequests.length, 2); assert.deepEqual(failed.errors, []);
  report.failureRecovery = { unavailableFileDoesNotBlockGame: true, nextTouchRetries: true, errors: failed.errors };
  await failed.context.close();
} catch (error) { report.failures.push(error.stack); process.exitCode = 1; }
finally {
  await writeFile(new URL(production ? "production-verification.json" : "browser-verification.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ production, failures: report.failures, playback: Boolean(report.playback), savedMute: report.savedMute, failureRecovery: report.failureRecovery }));
  await browser.close();
}
