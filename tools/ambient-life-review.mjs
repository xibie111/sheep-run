import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = new URL('../docs/ambient-life-review/2026-10-11/', import.meta.url);
const report = { passed: false, browser: 'Edge mobile touch emulation', phoneHardware: false,
  fixtures: 'Visual galleries use a frozen production scene, real landscape anchors and deterministic event selection. Live observation uses normal effective time, real obstacles and pause touch; damage is suppressed only so observation can continue. All fixtures are isolated in this script.', views: [] };
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const gameUrl = process.env.AMBIENT_QA_URL ?? 'http://127.0.0.1:1894';
const setup = async (width, height, dpr = 2, reduced = false) => {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(() => localStorage.setItem('sheep-run-save', JSON.stringify({ version: 4, highScore: 0, totalStars: 0, coins: 0, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false } })));
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url()));
  await page.goto(gameUrl); const main = (await request).url();
  await page.evaluate(async url => { window.g = (await import(url)).game.instance; }, main);
  const ready = scene => page.waitForFunction(scene => window.g.scene.isActive(scene) && window.g.scene.getScene(scene).children.list.length, scene);
  const frames = n => page.evaluate(n => new Promise(resolve => { const tick = () => { if (--n <= 0) { window.g.events.off('postrender', tick); resolve(); } }; window.g.events.on('postrender', tick); }), n);
  const tap = async (scene, name) => {
    const p = await page.evaluate(({ scene, name }) => { const o = window.g.scene.getScene(scene).children.getByName(name); if (!o) throw new Error(`Missing ${scene}/${name}`); const b = o.getBounds(), c = window.g.canvas.getBoundingClientRect(), z = window.g.scale.gameSize; return { x: c.x + b.centerX * c.width / z.width, y: c.y + b.centerY * c.height / z.height }; }, { scene, name });
    await page.touchscreen.tap(p.x, p.y); await frames(2);
  };
  return { context, page, errors, ready, frames, tap, main };
};
try {
  for (const [width, height] of [[896,414],[844,390],[800,600],[480,270]]) {
    const h = await setup(width, height), { page, ready, frames, tap } = h;
    const record = { width, height, dpr: 2, main: h.main, checks: [], galleries: [], errors: h.errors }; report.views.push(record);
    const check = (value, label) => { assert.ok(value, label); record.checks.push(label); };
    await ready('MenuScene'); await tap('MenuScene', 'button:开始游戏'); await ready('RunScene'); await frames(2);
    check(await page.evaluate(() => { const t = window.g.textures.get('ambient-life-atlas'), c = t.getSourceImage(), pixels = c.getContext('2d').getImageData(0,0,c.width,c.height).data; return t.getFrameNames().length === 18 && t.source[0].scaleMode === 1 && !pixels.some((v,i) => i%4===3 && v!==0 && v!==255) && !window.g.textures.exists('ambient-life-source'); }), '18 visible frames, hard alpha, nearest filtering; source released');
    const cases = width === 896 ? [
      ['duck-family','spring'],['rabbit-butterfly','spring'],
      ['duck-family','summer'],['rabbit-butterfly','summer'],
      ['duck-family','autumn'],['rabbit-butterfly','autumn'],
    ] : [['duck-family','spring'],['rabbit-butterfly','spring']];
    for (const [kind, theme] of cases) {
      const result = await page.evaluate(({ kind, theme }) => {
        const s = window.g.scene.getScene('RunScene'); s.update = () => {}; s.sys.sceneUpdate = s.update; s.physics.pause();
        for (const group of [s.obstacles,s.stars,s.powerUps]) for (const o of group.getChildren()) o.deactivate();
        s.companions.clear(); s.journeyToast?.clear();
        const ctor = s.ambientLife.constructor; s.ambientLife.clear(); s.ambientLife = new ctor(s, false, 71);
        const life = s.ambientLife, choose = life.scheduler.choose.bind(life.scheduler);
        life.scheduler.choose = (now, offers, blocked) => choose(now, offers.filter(o => o.kind === kind), blocked);
        life.nextCheckMs = Infinity; life.noticeVisible = false;
        s.environmentSystem.setTheme(theme); s.environmentSystem.setWeather('sunny');
        const p = s.environmentSystem.presentation(), anchor = kind === 'duck-family' ? 239 : 297;
        const distance = (p.nearRepeatWidth + anchor - 330) / .24;
        s.environmentSystem.update(distance, 0, 0);
        const landscape = s.environmentSystem.presentation();
        const ctx = { nowMs: 20_000, speed: 190, viewport: window.g.scale.gameSize, landscape, obstacles: [] };
        const save = localStorage.getItem('sheep-run-save'); life.update(ctx); life.update({ ...ctx, nowMs: 22_800 });
        window.visualContext = ctx;
        const objects = s.children.list.filter(o => o.name.startsWith('ambient-life:')).map(o => ({ name:o.name, x:o.x,y:o.y, depth:o.depth, body:!!o.body, input:!!o.input, alpha:o.alpha, bounds:o.getBounds(), scales:[o.scaleX,o.scaleY] }));
        return { kind, theme, landscape, snapshot: life.snapshot(), objects, saveUnchanged: save === localStorage.getItem('sheep-run-save') };
      }, { kind, theme });
      record.galleries.push(result);
      check(result.snapshot.kind === kind && result.snapshot.state === 'playing', `${theme}/${kind}: actual production controller selected the event`);
      check(result.objects.some(o => o.name !== 'ambient-life:pond' && o.alpha > .9), `${theme}/${kind}: opaque animal pose is actually visible`);
      check(result.saveUnchanged && result.objects.every(o => !o.body && !o.input && o.depth < 0 && o.y <= 206 && o.scales[0] === o.scales[1]), `${theme}/${kind}: background placement, uniform scale, no physics/input/reward`);
      await frames(2); await page.screenshot({ path: fileURLToPath(new URL(`screenshots/${width}x${height}-${theme}-${kind}.png`, output)), scale: 'css' });
    }
    if (width === 896) {
      // Restore ordinary scene lifecycle before observing the actual run clock.
      await page.evaluate(() => { const s=window.g.scene.getScene('RunScene'); s.update=Object.getPrototypeOf(s).update; s.scene.restart(); });
      await ready('RunScene'); await frames(2);
      await page.evaluate(() => { const s=window.g.scene.getScene('RunScene'); s.onObstacleOverlap=()=>{}; s.spawnSystem.reset(78); const ctor=s.ambientLife.constructor; s.ambientLife.clear(); s.ambientLife=new ctor(s,false,71); window.observedEvents=[]; s.events.on('postupdate',()=>{const p=s.ambientLife?.playing;if(p&&!window.observedEvents.some(e=>e.startedMs===p.startedMs))window.observedEvents.push({kind:p.offer.kind,startedMs:p.startedMs});}); });
      await page.waitForFunction(() => window.g.scene.getScene('RunScene').activeRunTimeMs >= 3000);
      await tap('RunScene','button:暂停'); await ready('PauseScene');
      const waiting = await page.evaluate(() => {const s=window.g.scene.getScene('RunScene');return [s.activeRunTimeMs,s.ambientLife.snapshot()];});
      await page.waitForTimeout(220);
      check(JSON.stringify(waiting)===JSON.stringify(await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return [s.activeRunTimeMs,s.ambientLife.snapshot()];})), 'touch pause freezes initial eligibility clock');
      await tap('PauseScene','button:继续游戏'); await ready('RunScene');
      await page.waitForFunction(() => {const s=window.g.scene.getScene('RunScene'),a=s.ambientLife.snapshot();return a.kind && a.elapsedMs>=1100 && a.elapsedMs<4000 && !s.ambientLife.playing.exitAtMs;}, null, {timeout:150000});
      record.naturalEvents=await page.evaluate(()=>window.observedEvents);
      check(record.naturalEvents.every(e=>e.startedMs>=20_000), 'natural live appearance only after 20 effective seconds and safe anchors');
      await page.screenshot({path:fileURLToPath(new URL('screenshots/natural-live-event.png',output)),scale:'css'});
      await tap('RunScene','button:暂停'); await ready('PauseScene');
      const frozen = await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return {time:s.activeRunTimeMs,life:s.ambientLife.snapshot(),objects:s.children.list.filter(o=>o.name.startsWith('ambient-life:')).map(o=>[o.x,o.y,o.frame.name,o.alpha])};});
      await page.waitForTimeout(250);
      check(JSON.stringify(frozen)===JSON.stringify(await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return {time:s.activeRunTimeMs,life:s.ambientLife.snapshot(),objects:s.children.list.filter(o=>o.name.startsWith('ambient-life:')).map(o=>[o.x,o.y,o.frame.name,o.alpha])};})), 'touch pause freezes live poses, pond scroll and controller deadlines');
      await page.screenshot({path:fileURLToPath(new URL('screenshots/natural-event-paused.png',output)),scale:'css'});
      await tap('PauseScene','button:继续游戏'); await ready('RunScene');
      await page.waitForFunction(()=>window.g.scene.getScene('RunScene').ambientLife.snapshot().state==='waiting',null,{timeout:10000});
      record.cooldown=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return s.ambientLife.snapshot().nextEligibleAtMs-s.activeRunTimeMs;});
      check(record.cooldown>=29_500&&record.cooldown<=45_000,'natural completion starts one 30–45 second cooldown');
      await tap('RunScene','button:暂停'); await ready('PauseScene');
      const cooldown=await page.evaluate(()=>window.g.scene.getScene('RunScene').ambientLife.snapshot());await page.waitForTimeout(220);
      check(JSON.stringify(cooldown)===JSON.stringify(await page.evaluate(()=>window.g.scene.getScene('RunScene').ambientLife.snapshot())),'touch pause freezes cooldown');
      const initialListeners=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return [s.input.listenerCount('pointerdown'),s.events.listenerCount('preupdate')];});
      for(let n=0;n<3;n++){
        await page.evaluate(()=>{window.oldLife=window.g.scene.getScene('RunScene').ambientLife;});
        await tap('PauseScene','button:重新开始'); await ready('RunScene'); await frames(2);
        check(await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return window.oldLife.snapshot().state==='stopped'&&window.oldLife.snapshot().objects===0&&s.ambientLife.snapshot().startedCount===0&&s.ambientLife.snapshot().nextEligibleAtMs===20_000;}),`touch restart ${n+1}: old objects cleared, scheduler reset`);
        check(JSON.stringify(initialListeners)===JSON.stringify(await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return [s.input.listenerCount('pointerdown'),s.events.listenerCount('preupdate')];})),`touch restart ${n+1}: input/listener counts stable`);
        await tap('RunScene','button:暂停');await ready('PauseScene');
      }
      await page.evaluate(()=>{window.oldLife=window.g.scene.getScene('RunScene').ambientLife;});
      await tap('PauseScene','button:返回首页');await ready('MenuScene');
      check(await page.evaluate(()=>window.oldLife.snapshot().objects===0),'touch exit clears all event and habitat objects');
    }
    check(h.errors.length===0,'no browser runtime errors');
    console.log(JSON.stringify({width,height,checks:record.checks.length}));await h.context.close();
  }
  // Reduced motion: the actual preference drives both scenery and quiet animal poses.
  const h=await setup(800,600,1,true);await h.ready('MenuScene');await h.tap('MenuScene','button:开始游戏');await h.ready('RunScene');
  report.reducedMotion=await h.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.update=()=>{};s.sys.sceneUpdate=s.update;s.physics.pause();const life=s.ambientLife;life.nextCheckMs=Infinity;life.noticeVisible=false;const context={nowMs:20000,speed:190,viewport:window.g.scale.gameSize,landscape:s.environmentSystem.presentation(),obstacles:[]};life.update(context);life.update({...context,nowMs:22000});const before=s.children.list.filter(o=>o.name.startsWith('ambient-life:')).map(o=>[o.x,o.y,o.frame.name,o.alpha]);life.update({...context,nowMs:23500});return {state:life.snapshot(),landscape:context.landscape,stable:JSON.stringify(before)===JSON.stringify(s.children.list.filter(o=>o.name.startsWith('ambient-life:')).map(o=>[o.x,o.y,o.frame.name,o.alpha]))};});
  assert(report.reducedMotion.stable && report.reducedMotion.state.kind && report.reducedMotion.landscape.nearRatio===0);
  await h.frames(2);await h.page.screenshot({path:fileURLToPath(new URL('screenshots/reduced-motion-800x600-dpr1.png',output)),scale:'css'});await h.context.close();
  report.passed=true;
} catch(error){report.failure=error.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:fileURLToPath(new URL('screenshots/failure.png',output)),scale:'css'});throw error;}
finally{await writeFile(new URL('browser-review.json',output),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed}));
