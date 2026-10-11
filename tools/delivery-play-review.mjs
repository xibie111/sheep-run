import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/delivery-review/2026-10-11/',report={passed:false,phoneHardware:false,method:'Production bundle, real elapsed time, CDP mobile touch gestures. No damage suppression, clock acceleration or obstacle removal. Automated gesture timing reads object positions.',checks:[],actions:[],phases:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const context=await browser.newContext({viewport:{width:896,height:414},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 const req=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto('http://127.0.0.1:1894');report.main=(await req).url();
 await page.evaluate(async u=>window.g=(await import(u)).game.instance,report.main);
 const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=2;const f=()=>{if(!--n){window.g.events.off('postrender',f);resolve();}};window.g.events.on('postrender',f);}));
 const ready=s=>page.waitForFunction(s=>window.g.scene.isActive(s)&&window.g.scene.getScene(s).children.list.length,s);
 const tap=async(s,n)=>{const p=await page.evaluate(({s,n})=>{const o=window.g.scene.getScene(s).children.getByName(n);if(!o?.input?.enabled)throw Error('Inactive '+n);const b=o.getBounds(),c=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:c.x+b.centerX*c.width/z.width,y:c.y+b.centerY*c.height/z.height};},{s,n});await page.touchscreen.tap(p.x,p.y);await frames();};
 const shot=name=>page.screenshot({path:out+'screenshots/'+name+'.png',scale:'css'});
 await ready('MenuScene');await tap('MenuScene','mailbox-entry');await tap('MenuScene','mailbox-delivery');await tap('MenuScene','delivery-start');await ready('RunScene');
 const saves=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 await page.waitForFunction(()=>window.g.scene.getScene('RunScene').delivery.state==='failed');await shot('natural-failure');
 assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="delivery-panel"]').dataset.mode),'failure');
 assert(!await page.evaluate(()=>localStorage.getItem('sheep-run-delivery-v1')));report.checks.push('real collision fails; no postcard or endless reward');
 await tap('RunScene','delivery-start');await ready('RunScene');
 const lifecycle=()=>page.evaluate(()=>({postrender:window.g.events.listenerCount('postrender'),upoutside:window.g.scene.getScene('RunScene').input.listenerCount('pointerupoutside'),overlays:document.querySelectorAll('[data-adventure-overlay]').length}));
 const baseline=await lifecycle();
 for(let i=0;i<3;i++){await tap('RunScene','button:暂停');await ready('PauseScene');await tap('PauseScene','button:重新开始');await ready('RunScene');assert(await page.evaluate(()=>!!window.g.scene.getScene('RunScene').delivery));assert.deepEqual(await lifecycle(),baseline);}
 report.checks.push('three touch retries preserve delivery mode without duplicate objects or listeners');
 const cdp=await context.newCDPSession(page),acted=new Set();let pausedForest=false,pausedEnding=false;const start=Date.now();
 while(Date.now()-start<90000){
   const state=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene'),r=s.delivery,p=s.sheep.body;return{mode:r.state,phase:r.phase.id,distance:r.distance,ending:r.endingMs,activeMs:s.activeRunTimeMs,speed:s.speed,grounded:s.sheep.grounded,objects:s.obstacles.getChildren().filter(o=>o.active).map(o=>({at:o.getData('delivery-at'),kind:o.definition.kind,x:o.body.x,right:o.body.right,gap:o.body.x-p.right})),companion:!!s.children.getByName('companion-sheep')};});
   if(state.mode==='failed')throw Error('Touch run failed '+JSON.stringify(state));
   if(!report.phases.some(p=>p.phase===state.phase)){report.phases.push(state);await shot('natural-'+state.phase);}
   if(state.phase==='forest'&&state.companion&&!pausedForest){await tap('RunScene','button:暂停');await ready('PauseScene');const ms=state.activeMs;const frozen=await page.evaluate(()=>window.g.scene.getScene('RunScene').activeRunTimeMs);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.g.scene.getScene('RunScene').activeRunTimeMs),frozen);await shot('natural-companion-paused');await tap('PauseScene','button:继续游戏');pausedForest=true;report.checks.push('companion and effective run time freeze on pause');}
   if(state.mode==='ending'){
     if(!pausedEnding){await tap('RunScene','button:暂停');await ready('PauseScene');const frozen=await page.evaluate(()=>window.g.scene.getScene('RunScene').delivery.endingMs);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.g.scene.getScene('RunScene').delivery.endingMs),frozen);await tap('PauseScene','button:继续游戏');pausedEnding=true;report.checks.push('delivery presentation freezes on pause and resumes');}
     if(state.ending>1800&&!report.endingCaptured){await shot('natural-ending');report.endingCaptured=true;}
   }
   if(state.mode==='complete'){report.finish=state;break;}
   for(const o of state.objects){
     const duck=o.kind==='HangingBranch',high=o.kind==='TallStack',ahead=state.speed*(duck?.07:high?.34:.19);
     if(!acted.has(o.at)&&o.gap>0&&o.gap<=ahead&&state.grounded){
       acted.add(o.at);report.actions.push({...o,action:duck?'crouch':high?'high-jump':'jump',atMs:state.activeMs});
       const x=720,y=270;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
       if(duck||high)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(duck?85:-85),id:0}]});
       await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     }
   }
   await page.waitForTimeout(16);
 }
 assert(report.finish,'route did not finish');await frames();await shot('natural-success');
 assert.equal(report.actions.length,14);assert(report.actions.some(a=>a.action==='high-jump'));assert(report.actions.filter(a=>a.action==='crouch').length===2);
 assert.equal(await page.evaluate(()=>window.g.scene.getScene('RunScene').obstacles.getChildren().filter(o=>o.active).length),0);report.checks.push('all 14 original obstacle collisions passed using jump, high-jump and crouch; finish road empty');
 const after=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k!=='sheep-run-delivery-v1').map(k=>[k,localStorage.getItem(k)])));assert.deepEqual(after,saves);report.checks.push('real failed and successful route leave all original stores unchanged');
 await tap('RunScene','delivery-back');await ready('MenuScene');await tap('MenuScene','button:合上邮箱');await tap('MenuScene','button:开始游戏');await ready('RunScene');
 assert(await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');return !s.delivery&&!!s.companions&&!!s.journey&&!!s.rareScenery&&!s.children.getByName('delivery-mailbag');}));report.checks.push('ordinary start returns to endless rules with no route residue');
 await page.waitForTimeout(1600);assert(await page.evaluate(()=>window.g.scene.getScene('RunScene').stars.getLength()>0));report.checks.push('endless stars still spawn');assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.failure=e.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:out+'screenshots/natural-failure-debug.png',scale:'css'});throw e;}
finally{await writeFile(out+'play-review.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
