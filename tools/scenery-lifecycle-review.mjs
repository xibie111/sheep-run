import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/scenery-review/2026-10-11/',report={passed:false,phoneHardware:false,checks:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('sheep-run-mailbox-v1','{"version":1,"readIds":["welcome-v1"]}'));
 const glob='**/assets/meteors-*.png';await page.route(glob,r=>r.abort());
 const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto('http://127.0.0.1:1894');report.main=(await request).url();
 await page.evaluate(async url=>window.g=(await import(url)).game.instance,report.main);
 const ready=scene=>page.waitForFunction(scene=>window.g.scene.isActive(scene)&&window.g.scene.getScene(scene).children.list.length,scene);
 const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=2;const f=()=>{if(!--n){window.g.events.off('postrender',f);resolve()}};window.g.events.on('postrender',f)}));
 const center=async(scene,name)=>page.evaluate(({scene,name})=>{const b=window.g.scene.getScene(scene).children.getByName(name).getBounds(),c=window.g.canvas.getBoundingClientRect(),s=window.g.scale.gameSize;return{x:c.x+b.centerX*c.width/s.width,y:c.y+b.centerY*c.height/s.height}},{scene,name});
 const tap=async(scene,name)=>{const p=await center(scene,name);await page.touchscreen.tap(p.x,p.y);await frames();};
 await page.waitForFunction(()=>window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
 assert(!await page.evaluate(()=>window.g.scene.isActive('MenuScene')));await page.screenshot({path:out+'screenshots/postcard-load-failure.png',scale:'css'});
 await page.unroute(glob);await tap('PreloadScene','button:重试');await ready('MenuScene');
 assert(await page.evaluate(()=>['rainbow','meteors','fireflies'].every(id=>window.g.textures.exists('scenery-'+id))));report.checks.push('failed postcard load blocks entry; touch retry restores all three assets');
 assert.equal(await page.evaluate(()=>localStorage.getItem('sheep-run-mailbox-v1')),'{"version":1,"readIds":["welcome-v1"]}');
 await page.evaluate(()=>localStorage.setItem('sheep-run-scenery-v1',JSON.stringify({version:1,seenIds:['rainbow-v1']})));
 await tap('MenuScene','button:成就册');await tap('MenuScene','journey-next');await tap('MenuScene','journey-next');
 const cdp=await context.newCDPSession(page),p=await center('MenuScene','achievement-card:0');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await frames();
 assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="journey-book"]').dataset.mode),'achievements');
 await tap('MenuScene','achievement-card:0');assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="journey-book"]').dataset.mode),'postcard');
 await page.setViewportSize({width:800,height:600});await frames();
 assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="journey-book"]').dataset.postcard),'0');
 await page.screenshot({path:out+'screenshots/postcard-resize-dpr1.png',scale:'css'});report.checks.push('touch cancel leaves card closed; valid tap opens; resize retains reading state');
 await tap('MenuScene','button:合上手账');await tap('MenuScene','button:合上手账');await tap('MenuScene','button:开始游戏');await ready('RunScene');
 const original=await page.evaluate(()=>window.g.events.listenerCount('postrender'));
 for(let n=0;n<3;n++){
   await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');window.old=s.rareScenery;s.rareScenery.update({nowMs:45000,deltaMs:0,landscape:{...s.environmentSystem.presentation(),theme:'winter',dayPhase:'night',weather:'sunny',weatherAlpha:0},viewport:window.g.scale.gameSize,blocked:false});});
   await tap('RunScene','button:暂停');await ready('PauseScene');await tap('PauseScene','button:重新开始');await ready('RunScene');
   assert(await page.evaluate(()=>window.old.snapshot().stopped&&window.old.snapshot().id===null));assert.equal(await page.evaluate(()=>window.g.events.listenerCount('postrender')),original);
 }report.checks.push('three touch restarts clear scenery and retain stable render listener counts');
 // A real fatal callback clears an active view before the result is displayed.
 const fatal=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');const C=s.rareScenery.constructor;s.rareScenery.clear();s.rareScenery=new C(s,false,()=>{},undefined,71);s.rareScenery.update({nowMs:45000,deltaMs:0,landscape:{...s.environmentSystem.presentation(),theme:'winter',dayPhase:'night',weather:'sunny',weatherAlpha:0},viewport:window.g.scale.gameSize,blocked:false});const before=s.rareScenery.snapshot().id;window.old=s.rareScenery;s.onObstacleOverlap();return{before,after:window.old.snapshot(),objects:s.children.list.filter(o=>o.name.startsWith('rare-scenery:')).length};});
 assert(fatal.before&&fatal.after.stopped&&fatal.objects===0);await ready('ResultScene');report.checks.push('fatal collision immediately clears view before results');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(out+'lifecycle-review.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
