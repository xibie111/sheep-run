import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/rare-scenery-trigger-v2/browser',url='http://127.0.0.1:4358/';await mkdir(`${out}/screenshots`,{recursive:true});
const report={passed:false,url,phoneHardware:false,profiles:[],checks:[],errors:[],screenshots:[],
  method:'Ephemeral mobile touch contexts, actual WebGL. Real start/pause/resume. Isolated fixture advances score-distance to9500/effective time33000, sets summer/clear and scenery own seed71, supplies the other scenery ID only to the in-memory unseen preference; difficulty uses normal max390. Arcade colliders disabled only in this ephemeral context to isolate scenery from early death; spawning and motion remain live. Temporarily resume/pause SceneManager to drive the real controller. Then normal scene updates/rendering verify actual exposure and permanent card record. No user browser profile, natural full run, original collision proof or wall-clock schedule proof; no fixtures in production.'};
const check=(v,n)=>{assert(v,n);report.checks.push(n);};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({channel:'msedge',headless:true});
async function frames(p){await p.evaluate(()=>new Promise(resolve=>{let n=2;const fn=()=>{if(!--n){window.g.events.off('postrender',fn);resolve();}};window.g.events.on('postrender',fn);}));}
async function ready(p,n){await p.waitForFunction(n=>window.g.scene.isActive(n)&&window.g.scene.getScene(n).children.list.length,n);await frames(p);}
async function tap(p,scene,name){const pt=await p.evaluate(({scene,name})=>{const s=window.g.scene.getScene(scene);const find=list=>{for(const o of list){if(o.name===name)return o;const c=o.list&&find(o.list);if(c)return c;}};const o=find(s.children.list);if(!o?.input?.enabled)throw new Error(name);const b=o.getBounds(),r=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:r.x+(b.centerX-s.cameras.main.scrollX*o.scrollFactorX)*r.width/z.width,y:r.y+(b.centerY-s.cameras.main.scrollY*o.scrollFactorY)*r.height/z.height};},{scene,name});await p.touchscreen.tap(pt.x,pt.y);await frames(p);}
async function facts(p){return p.evaluate(()=>{const s=window.g.scene.getScene('RunScene'),c=s.rareScenery;return{webgl:!!window.g.renderer.gl,now:s.activeRunTimeMs,distance:s.scoreSystem.travelledDistancePx,land:s.environmentSystem.presentation(),state:c.snapshot(),
  exposure:c.active?.exposure.complete??false,seen:c.store.load().seenIds,used:c.schedule.used,retryAt:c.schedule.retryAt,
  graphics:s.children.list.filter(o=>o.name.startsWith('rare-scenery:')).map(o=>({name:o.name,alpha:o.alpha,depth:o.depth,visible:o.visible})),
  speed:s.difficultySystem.speed,paused:window.g.scene.isPaused('RunScene')};});}
try{
  const views=[[480,270],[896,414],[844,390],[800,600]];
  for(const dpr of[1,2])for(const[index,[width,height]]of views.entries()){
    const id=(index+dpr)%2?'meteors-v1':'fireflies-v1';
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
    const req=p.waitForRequest(r=>/\/assets\/main-[^/]+\.js$/.test(r.url()));await p.goto(url);const main=(await req).url();await p.evaluate(async m=>{window.g=(await import(m)).game.instance;},main);
    await ready(p,'MenuScene');await tap(p,'MenuScene','button:开始游戏');await ready(p,'RunScene');await tap(p,'RunScene','button:暂停');await ready(p,'PauseScene');await p.evaluate(()=>window.g.scene.stop('PauseScene'));
    await p.evaluate(id=>{const s=window.g.scene.getScene('RunScene');s.physics.world.colliders.getActive().forEach(c=>{c.active=false;});s.activeRunTimeMs=33000;s.scoreSystem.update(9500-s.scoreSystem.travelledDistancePx,1000);s.difficultySystem.elapsedSeconds=40;s.environmentSystem.setTheme('summer');s.environmentSystem.setWeather('sunny');s.environmentSystem.update(9500,0,s.scoreSystem.score);
      const c=s.rareScenery;c.schedule.random.value=71;c.seenIds=[id==='meteors-v1'?'fireflies-v1':'meteors-v1'];
      window.g.scene.resume('RunScene');c.update({nowMs:33000,deltaMs:0,landscape:s.environmentSystem.presentation(),viewport:{width:window.g.scale.gameSize.width,height:window.g.scale.gameSize.height},blocked:false});window.g.scene.pause('RunScene');},id);
    await frames(p);const initial=await facts(p);check(initial.webgl,`${width}/${dpr}: actual WebGL`);check(initial.state.id===id,`${width}/${dpr}: starts ${id} in first night window`);check(!initial.exposure&&initial.seen.length===0,`${width}/${dpr}: generation alone does not collect`);
    await p.evaluate(()=>window.g.scene.getScene('RunScene').scene.launch('PauseScene'));await ready(p,'PauseScene');await tap(p,'PauseScene','button:继续游戏');await ready(p,'RunScene');await sleep(2250);
    const shown=await facts(p);report.lastFacts={initial,shown};check(shown.state.id===id,`${width}/${dpr}: ${id} still showing`);check(shown.exposure&&shown.seen.includes(id),`${width}/${dpr}: actual rendered exposure records ${id}`);check(shown.graphics.length===1,`${width}/${dpr}: only one rare view`);check(shown.graphics[0].alpha>=.6,`${width}/${dpr}: effect is visible`);
    const name=`${width}x${height}-dpr${dpr}-${id}.png`;await p.screenshot({path:`${out}/screenshots/${name}`,scale:'css'});report.screenshots.push(`screenshots/${name}`);
    await tap(p,'RunScene','button:暂停');await ready(p,'PauseScene');const before=await facts(p);await sleep(150);const after=await facts(p);check(before.now===after.now&&before.state.ageMs===after.state.ageMs,`${width}/${dpr}: actual pause freezes scenery clock`);
    await tap(p,'PauseScene','button:继续游戏');await ready(p,'RunScene');await sleep(70);const resumed=await facts(p);check(resumed.state.ageMs>after.state.ageMs,`${width}/${dpr}: actual resume progresses effect`);
    check(resumed.seen.filter(x=>x===id).length===1,`${width}/${dpr}: record is unique`);
    report.profiles.push({width,height,dpr,id,main,initial,shown,pause:{before,after},resumed});await context.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  }
  check(report.errors.length===0,'no unhandled runtime errors');report.passed=true;
}catch(error){report.failure=error.stack||String(error);throw error;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,profiles:report.profiles.length,checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors.length}));
