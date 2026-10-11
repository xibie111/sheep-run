import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = 'docs/delivery-review/2026-10-11/', base = process.env.DELIVERY_QA_URL ?? 'http://127.0.0.1:1894';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = { passed: false, browser: 'Edge mobile touch emulation', phoneHardware: false, fixtures: 'Stage screenshots use frozen route-distance fixtures; separate real-time touch play is recorded by delivery-play-review.mjs.', views: [] };
async function setup(w, h, dpr, reduced) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: dpr, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  const request = page.waitForRequest(r => /\/assets\/main-[^/]+\.js/.test(r.url())); await page.goto(base); const main = (await request).url();
  await page.evaluate(async u => window.g = (await import(u)).game.instance, main);
  const ready = scene => page.waitForFunction(scene => window.g.scene.isActive(scene) && window.g.scene.getScene(scene).children.list.length, scene);
  const frames = () => page.evaluate(() => new Promise(resolve => { let n = 2; const f = () => { if (!--n) { window.g.events.off('postrender', f); resolve(); } }; window.g.events.on('postrender', f); }));
  const center = (scene, name) => page.evaluate(({ scene, name }) => { const o = window.g.scene.getScene(scene).children.getByName(name); if (!o?.input?.enabled) throw Error('Inactive ' + name); const b = o.getBounds(), c = window.g.canvas.getBoundingClientRect(), s = window.g.scale.gameSize; return { x: c.x + b.centerX * c.width / s.width, y: c.y + b.centerY * c.height / s.height }; }, { scene, name });
  const tap = async (scene, name) => { const p = await center(scene, name); await page.touchscreen.tap(p.x, p.y); await frames(); };
  const shot = name => page.screenshot({ path: out + 'screenshots/' + name + '.png', scale: 'css' });
  await ready('MenuScene'); return { context, page, errors, main, ready, frames, center, tap, shot };
}
try {
  for (const [w, h, dpr, reduced] of [[896,414,2,false],[844,390,2,false],[800,600,2,false],[480,270,2,false],[896,414,1,false],[844,390,1,false],[480,270,1,false],[800,600,1,true]]) {
    const t = await setup(w,h,dpr,reduced), label = `${w}x${h}-dpr${dpr}`, r = { w,h,dpr,reduced,main:t.main,checks:[] }; report.views.push(r);
    const check = (value, message) => { assert(value,message); r.checks.push(message); };
    await t.tap('MenuScene','mailbox-entry'); await t.shot(label+'-mailbox');
    check(await t.page.evaluate(() => { const s=window.g.scene.getScene('MenuScene'),a=s.children.getByName('mailbox-delivery').getBounds(); return ['mailbox-letter:welcome-v1','mailbox-letter:goodnight-v1','button:合上邮箱'].every(n=>{const b=s.children.getByName(n).getBounds();return a.bottom<=b.top||a.top>=b.bottom;}); }), 'mail entry does not overlap letters or close target');
    await t.tap('MenuScene','mailbox-delivery'); await t.shot(label+'-brief');
    check(await t.page.evaluate(()=>{const s=window.g.scene.getScene('MenuScene');return s.data.get('menu-modal-owner')==='delivery'&&!s.children.getByName('mailbox-letter:welcome-v1').input.enabled&&!s.children.getByName('button:开始游戏').input.enabled;}),'nested delivery panel blocks mailbox and underlying menu');
    const lines=await t.page.evaluate(()=>{const d=document.querySelector('[data-adventure-overlay="delivery-panel"]').dataset;return {lines:JSON.parse(d.lines),panel:JSON.parse(d.panel)};});
    check(lines.lines.every(l=>l.ink.x>=lines.panel.x&&l.ink.x+l.ink.width<=lines.panel.x+lines.panel.width&&l.ink.y>=lines.panel.y&&l.ink.y+l.ink.height<=lines.panel.y+lines.panel.height),'all brief glyphs fit the panel');
    check(!await t.page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('delivery-card').input.enabled),'postcard locked initially');
    await t.tap('MenuScene','delivery-back'); check(await t.page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('mailbox-letter:welcome-v1').input.enabled),'nested close restores exact mailbox input');
    await t.tap('MenuScene','mailbox-delivery'); await t.tap('MenuScene','delivery-start'); await t.ready('RunScene');
    const before=await t.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k!=='sheep-run-delivery-v1').map(k=>[k,localStorage.getItem(k)])));
    check(await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return !!s.delivery&&!s.journey&&!s.rareScenery&&!s.companions&&s.stars.getLength()===0&&s.powerUps.getLength()===0;}),'route isolates endless collectible and achievement systems');
    await t.tap('RunScene','button:暂停'); await t.ready('PauseScene'); const frozen=await t.page.evaluate(()=>JSON.stringify(window.g.scene.getScene('RunScene').delivery)); await t.page.waitForTimeout(220);
    check(frozen===await t.page.evaluate(()=>JSON.stringify(window.g.scene.getScene('RunScene').delivery)),'run pause freezes distance');
    await t.tap('PauseScene','button:继续游戏'); await t.ready('RunScene');
    await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.sys.sceneUpdate=()=>{};s.physics.pause();});
    for (const [phase,distance] of [['pasture',1500],['forest',7100],['hill',13200]]) {
      await t.page.evaluate(({distance})=>{const s=window.g.scene.getScene('RunScene');s.delivery.distance=distance;s.updateDelivery(0);s.activeRunTimeMs+=1200;s.deliveryView.update(s.delivery,s.activeRunTimeMs);}, {distance});
      await t.frames(); await t.shot(label+'-'+phase);
      check(await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return s.sheep.x===101&&Math.abs(s.sheep.body.width-30)<.01&&s.children.getByName('delivery-mailbag').visible;}),'preserves player position and collision width in '+phase);
    }
    await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.delivery.distance=18000;s.updateDelivery(20);});
    await t.frames(); await t.shot(label+'-delivery');
    await t.tap('RunScene','button:暂停'); const ending=await t.page.evaluate(()=>window.g.scene.getScene('RunScene').delivery.endingMs); await t.page.waitForTimeout(200);
    check(ending===await t.page.evaluate(()=>window.g.scene.getScene('RunScene').delivery.endingMs),'ending pause freezes the presentation'); await t.tap('PauseScene','button:继续游戏');
    await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');for(let i=0;i<80;i++)s.updateDelivery(20);}); await t.frames();await t.shot(label+'-two-sheep');
    check(await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene'),f=s.children.getByName('companion-sheep');return f.visible&&!f.body&&Math.abs(f.x-s.sheep.x)>40;}),'ending companion is visible and separated');
    await t.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');for(let i=0;i<140&&!s.finished;i++)s.updateDelivery(20);});await t.frames();await t.shot(label+'-success');
    check(await t.page.evaluate(()=>JSON.parse(localStorage.getItem('sheep-run-delivery-v1')).completedIds.includes('hill-goodnight-v1')),'completion stores independent postcard');
    check(JSON.stringify(before)===JSON.stringify(await t.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k!=='sheep-run-delivery-v1').map(k=>[k,localStorage.getItem(k)])))),'route completion leaves all existing stores byte-identical');
    await t.tap('RunScene','delivery-back');await t.ready('MenuScene');
    check(await t.page.evaluate(()=>document.querySelector('[data-adventure-overlay="mailbox"]').dataset.open==='true'),'return opens mailbox directly');
    await t.tap('MenuScene','mailbox-delivery');await t.tap('MenuScene','delivery-card');await t.shot(label+'-postcard');
    check(await t.page.evaluate(()=>document.querySelector('[data-adventure-overlay="delivery-panel"]').dataset.mode==='postcard'),'earned card reopens');
    await t.page.reload();await t.page.evaluate(async u=>window.g=(await import(u)).game.instance,t.main);await t.ready('MenuScene');await t.tap('MenuScene','mailbox-entry');await t.tap('MenuScene','mailbox-delivery');
    check(await t.page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('delivery-card').input.enabled),'refresh preserves card');
    check(t.errors.length===0,'no browser errors');r.errors=t.errors;console.log(JSON.stringify({label,checks:r.checks.length}));await t.context.close();
  }
  report.passed=true;
} catch(e) {report.failure=e.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:out+'screenshots/failure.png',scale:'css'});throw e;}
finally {await writeFile(out+'browser-review.json',JSON.stringify(report,null,2));await browser.close();}
