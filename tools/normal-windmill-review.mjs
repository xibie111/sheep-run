import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = 'docs/normal-windmill-fix-v1/browser', url = 'http://127.0.0.1:4356/';
await mkdir(`${out}/screenshots`, { recursive: true });
const report = { passed: false, url, phoneHardware: false, engine: 'Edge Chromium, actual WebGL, mobile touchscreen emulation',
  method: 'Ephemeral profiles; real touch start/pause/resume. While paused, explicitly advance only isolated score distance and environment distance and drive the real existing landmark controller by temporarily resuming/re-pausing within one synchronous evaluate. Render screenshots from the actual scene. Resume normally for exposure and pause checks. This is a geometry/render fixture, not natural-play or collision proof; production code contains no fixture.',
  checks: [], profiles: [], screenshots: [], errors: [] };
const check = (value, name) => { assert(value, name); report.checks.push(name); };
const near = (a,b,name,tolerance=1e-6) => check(Math.abs(a-b)<=tolerance, `${name}: ${a} ~= ${b}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const browser = await chromium.launch({headless:true,channel:'msedge'});
async function frames(page) { await page.evaluate(()=>new Promise(resolve=>{ let n=2; const fn=()=>{ if(!--n){window.g.events.off('postrender',fn);resolve();} };window.g.events.on('postrender',fn);})); }
async function ready(page,scene) { await page.waitForFunction(name=>window.g.scene.isActive(name)&&window.g.scene.getScene(name).children.list.length,scene);await frames(page); }
async function tap(page,scene,name) {
  const point=await page.evaluate(({scene,name})=>{
    const s=window.g.scene.getScene(scene);
    const find=list=>{for(const o of list){if(o.name===name)return o;const child=o.list&&find(o.list);if(child)return child;}};
    const object=find(s.children.list); if(!object?.input?.enabled)throw new Error(`Missing touch ${scene}/${name}`);
    const b=object.getBounds(),r=window.g.canvas.getBoundingClientRect(),size=window.g.scale.gameSize;
    return {x:r.x+(b.centerX-s.cameras.main.scrollX*object.scrollFactorX)*r.width/size.width,y:r.y+(b.centerY-s.cameras.main.scrollY*object.scrollFactorY)*r.height/size.height};
  },{scene,name});await page.touchscreen.tap(point.x,point.y);await frames(page);
}
async function facts(page) { return page.evaluate(()=>{
  const s=window.g.scene.getScene('RunScene'), rows=s.environmentSystem.parallax.layers;
  const near=rows.find(l=>l.definition.key==='pasture-treeline'),road=rows.find(l=>l.definition.key==='pasture-ground');
  const o=s.children.list.find(o=>o.name==='landmark:windmill-meadow');
  return {size:{width:window.g.scale.gameSize.width,height:window.g.scale.gameSize.height}, originX:-s.cameras.main.scrollX,
    webgl:!!window.g.renderer.gl, distance:s.scoreSystem.travelledDistancePx, paused:window.g.scene.isPaused('RunScene'),
    landmark:s.landmarks.snapshot(),objects:s.children.list.filter(o=>o.name==='landmark:windmill-meadow').length,
    near:{phase:near.sprite.tilePositionX,width:near.sprite.frame.cutWidth,ratio:near.definition.ratio,depth:near.sprite.depth},roadDepth:road.sprite.depth,
    image:o?{x:o.x,y:o.y,depth:o.depth,width:o.displayWidth,height:o.displayHeight,scaleX:o.scaleX,scaleY:o.scaleY,body:!!o.body,texture:o.texture.key}:null,
    travel:s.travel.snapshot().landmarks};
  }); }
async function place(page,distance) {
  await page.evaluate(distance=>{
    const s=window.g.scene.getScene('RunScene');
    s.scoreSystem.update(distance-s.scoreSystem.travelledDistancePx,1000);
    s.environmentSystem.setTheme('spring');s.environmentSystem.update(distance,0,s.scoreSystem.score);
    window.g.scene.resume('RunScene');s.landmarks.update({distance,deltaMs:0,blocked:false,viewport:{width:window.g.scale.gameSize.width,height:window.g.scale.gameSize.height},landscape:s.environmentSystem.presentation()});window.g.scene.pause('RunScene');
  },distance);await frames(page);return facts(page);
}
try {
  for(const dpr of [1,2]) for(const [width,height] of [[480,270],[896,414],[844,390],[800,600]]) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    const mainRequest=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js$/.test(r.url()));
    await page.goto(url);const main=(await mainRequest).url();await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},main);
    await ready(page,'MenuScene');await tap(page,'MenuScene','button:开始游戏');await ready(page,'RunScene');
    await tap(page,'RunScene','button:暂停');await ready(page,'PauseScene');await page.evaluate(()=>window.g.scene.stop('PauseScene'));
    const profile={width,height,dpr,main};report.profiles.push(profile);
    const a=await place(page,2400),b=await place(page,2500);
    check(b.webgl,`${width}/${dpr}: actual WebGL`);check(b.objects===1,`${width}/${dpr}: one separate windmill landmark`);
    near(a.image.x-b.image.x,24,`${width}/${dpr}: landmark follows near movement`);
    near(b.near.phase-a.near.phase,24,`${width}/${dpr}: actual near texture follows same movement`);
    check(b.image.depth>b.near.depth&&b.image.depth<b.roadDepth,`${width}/${dpr}: windmill between near and road`);
    near(b.image.y,187,`${width}/${dpr}: retained meadow anchor`);near(b.image.scaleX,b.image.scaleY,`${width}/${dpr}: aspect preserved`);
    check(!b.image.body,`${width}/${dpr}: nonphysical display only`);
    const visible=await place(page,3500);near(visible.landmark.exposureMs,0,`${width}/${dpr}: paused render is not exposure`);
    const name=`${width}x${height}-dpr${dpr}-windmill.png`;await page.screenshot({path:`${out}/screenshots/${name}`,scale:'css'});report.screenshots.push(`screenshots/${name}`);
    await page.evaluate(()=>window.g.scene.getScene('RunScene').scene.launch('PauseScene'));await ready(page,'PauseScene');
    await tap(page,'PauseScene','button:继续游戏');await ready(page,'RunScene');await sleep(600);
    const running=await facts(page);check(running.landmark.encounters.length===1,`${width}/${dpr}: actual rendered exposure records once`);
    await tap(page,'RunScene','button:暂停');await ready(page,'PauseScene');const before=await facts(page);await sleep(150);const after=await facts(page);
    near(after.landmark.x,before.landmark.x,`${width}/${dpr}: real pause freezes windmill`);near(after.distance,before.distance,`${width}/${dpr}: real pause freezes travel`);
    await tap(page,'PauseScene','button:继续游戏');await ready(page,'RunScene');await sleep(100);const resumed=await facts(page);
    check(resumed.landmark.x<after.landmark.x,`${width}/${dpr}: real resume moves windmill left`);
    profile.before=a;profile.after=b;profile.visible=visible;profile.running=running;profile.pause={before,after};profile.resumed=resumed;
    await context.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  }
  check(report.errors.length===0,'no browser runtime errors');report.passed=true;
} catch(error) {report.failure=error.stack||String(error);throw error;}
finally {await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,profiles:report.profiles.length,checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors.length}));
