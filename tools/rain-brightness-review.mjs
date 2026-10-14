import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/rain-brightness-v1/browser',url='http://127.0.0.1:4357/';
await mkdir(`${out}/screenshots`,{recursive:true});
const report={passed:false,url,phoneHardware:false,checks:[],profiles:[],errors:[],screenshots:[],
  method:'Independent ephemeral touch profiles, actual WebGL. Force spring and rain only in isolated browser state. Render fixed-distance night fixtures to compare tint; then actual touchscreen resume for real particle updates, pause freeze and resume. No natural rain-schedule or full-run proof; no fixtures in production.'};
const check=(value,name)=>{assert(value,name);report.checks.push(name);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true,channel:'msedge'});
async function frames(page){await page.evaluate(()=>new Promise(resolve=>{let n=2;const fn=()=>{if(!--n){window.g.events.off('postrender',fn);resolve();}};window.g.events.on('postrender',fn);}));}
async function ready(page,name){await page.waitForFunction(name=>window.g.scene.isActive(name)&&window.g.scene.getScene(name).children.list.length,name);await frames(page);}
async function tap(page,scene,name){const p=await page.evaluate(({scene,name})=>{
  const s=window.g.scene.getScene(scene);const find=list=>{for(const o of list){if(o.name===name)return o;const c=o.list&&find(o.list);if(c)return c;}};
  const o=find(s.children.list);if(!o?.input?.enabled)throw new Error(`Missing ${name}`);
  const b=o.getBounds(),r=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;
  return{x:r.x+(b.centerX-s.cameras.main.scrollX*o.scrollFactorX)*r.width/z.width,y:r.y+(b.centerY-s.cameras.main.scrollY*o.scrollFactorY)*r.height/z.height};
},{scene,name});await page.touchscreen.tap(p.x,p.y);await frames(page);}
async function facts(page){return page.evaluate(()=>{
  const s=window.g.scene.getScene('RunScene'),env=s.environmentSystem,e=env.weather.rainEmitter;
  return{size:{width:window.g.scale.gameSize.width,height:window.g.scale.gameSize.height},webgl:!!window.g.renderer.gl,
    weather:env.weather.snapshot(),layers:env.parallax.layers.map(l=>({key:l.definition.key,tint:l.sprite.tintTopLeft,phase:l.sprite.tilePositionX})),
    alive:e?.getAliveParticleCount()??0,total:e?.getParticleCount()??0,limit:e?.maxAliveParticles??0,
    emitting:!!e?.emitting,blendMode:e?.blendMode,particles:e?.alive.map(p=>[p.x,p.y,p.lifeCurrent])??[],
    distance:s.scoreSystem.travelledDistancePx,paused:window.g.scene.isPaused('RunScene'),
    player:{x:s.sheep.x,y:s.sheep.y,width:s.sheep.displayWidth,height:s.sheep.displayHeight}};
});}
try{
  for(const dpr of[1,2])for(const[width,height]of[[480,270],[896,414],[844,390],[800,600]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js$/.test(r.url()));await page.goto(url);
    const main=(await request).url();await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},main);
    await ready(page,'MenuScene');await tap(page,'MenuScene','button:开始游戏');await ready(page,'RunScene');
    await tap(page,'RunScene','button:暂停');await ready(page,'PauseScene');await page.evaluate(()=>window.g.scene.stop('PauseScene'));
    await page.evaluate(()=>{const e=window.g.scene.getScene('RunScene').environmentSystem;e.setTheme('spring');e.setWeather('sunny');e.update(9500,0,0);});
    const dryNight=await facts(page);check(dryNight.layers.some(l=>l.tint!==0xffffff),`${width}/${dpr}: night fixture has original day tint`);
    await page.evaluate(()=>{const e=window.g.scene.getScene('RunScene').environmentSystem;e.setWeather('rain');e.update(9500,0,0);});
    const wetNight=await facts(page);check(wetNight.layers.every(l=>l.tint===0xffffff),`${width}/${dpr}: rain restores original background colours`);
    check(JSON.stringify(dryNight.layers.map(l=>l.phase))===JSON.stringify(wetNight.layers.map(l=>l.phase)),`${width}/${dpr}: colour change leaves scenery phase intact`);
    await page.evaluate(()=>window.g.scene.getScene('RunScene').scene.launch('PauseScene'));await ready(page,'PauseScene');
    await tap(page,'PauseScene','button:继续游戏');await ready(page,'RunScene');await sleep(1100);
    const running=await facts(page);check(running.webgl,`${width}/${dpr}: actual WebGL`);
    check(running.alive>=30&&running.alive<=64&&running.total<=64,`${width}/${dpr}: stronger real rain stays capped`);
    check(running.particles.some(p=>p[1]>=218+Math.floor((running.size.height-270)/2)),`${width}/${dpr}: real drops reach the expanded road`);
    check(running.layers.every(l=>l.tint===0xffffff),`${width}/${dpr}: normal rain frames retain original colours`);
    check(running.blendMode===1,`${width}/${dpr}: additive drops do not darken scenery`);
    const name=`${width}x${height}-dpr${dpr}-rain.png`;await page.screenshot({path:`${out}/screenshots/${name}`,scale:'css'});report.screenshots.push(`screenshots/${name}`);
    await tap(page,'RunScene','button:暂停');await ready(page,'PauseScene');const before=await facts(page);await sleep(180);const after=await facts(page);
    check(JSON.stringify(before.particles)===JSON.stringify(after.particles),`${width}/${dpr}: actual pause freezes particle positions and ages`);
    check(before.distance===after.distance,`${width}/${dpr}: actual pause freezes gameplay distance`);
    await tap(page,'PauseScene','button:继续游戏');await ready(page,'RunScene');await sleep(80);const resumed=await facts(page);
    check(JSON.stringify(resumed.particles)!==JSON.stringify(after.particles),`${width}/${dpr}: actual resume moves drops`);
    await page.evaluate(()=>{const e=window.g.scene.getScene('RunScene').environmentSystem;e.setWeather('sunny');e.update(9500,0,0);});
    const stopped=await facts(page);check(!stopped.emitting&&stopped.alive===0,`${width}/${dpr}: rain clears immediately on sunny switch`);
    report.profiles.push({width,height,dpr,main,dryNight,wetNight,running,pause:{before,after},resumed,stopped});
    await context.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  }
  check(report.errors.length===0,'no unhandled runtime errors');report.passed=true;
}catch(error){report.failure=error.stack||String(error);throw error;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,profiles:report.profiles.length,checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors.length}));
