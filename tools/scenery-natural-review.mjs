import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/scenery-review/2026-10-11/',report={passed:false,phoneHardware:false,fixture:'Real effective time, real obstacles and weather/day progression. Collision damage disabled solely for observation; independent weather, obstacle and scenery seeds fixed. No accelerated clock or forced weather.'};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const context=await browser.newContext({viewport:{width:896,height:414},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto('http://127.0.0.1:1894');report.main=(await request).url();await page.evaluate(async u=>window.g=(await import(u)).game.instance,report.main);
 await page.waitForFunction(()=>window.g.scene.isActive('MenuScene'));
 const tap=async(scene,name)=>{const p=await page.evaluate(({scene,name})=>{const b=window.g.scene.getScene(scene).children.getByName(name).getBounds(),r=window.g.canvas.getBoundingClientRect(),s=window.g.scale.gameSize;return{x:r.x+b.centerX*r.width/s.width,y:r.y+b.centerY*r.height/s.height}},{scene,name});await page.touchscreen.tap(p.x,p.y);};
 await tap('MenuScene','button:开始游戏');await page.waitForFunction(()=>window.g.scene.isActive('RunScene')&&window.g.scene.getScene('RunScene').rareScenery);
 await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.onObstacleOverlap=()=>{};s.spawnSystem.reset(78);s.environmentSystem.weather.seed=2;const C=s.rareScenery.constructor;s.rareScenery.clear();window.notices=[];s.rareScenery=new C(s,false,m=>{window.notices.push(m);s.journeyToast.notice(m)},undefined,71);window.first=null;s.events.on('postupdate',()=>{const p=s.rareScenery.snapshot();if(p.id&&!window.first)window.first={...p,time:s.activeRunTimeMs,landscape:s.environmentSystem.presentation()}});});
 await page.waitForFunction(()=>window.g.scene.getScene('RunScene').activeRunTimeMs>=3000);await tap('RunScene','button:暂停');await page.waitForFunction(()=>window.g.scene.isActive('PauseScene'));
 const time=await page.evaluate(()=>window.g.scene.getScene('RunScene').activeRunTimeMs);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.g.scene.getScene('RunScene').activeRunTimeMs),time);report.initialPauseFrozen=true;
 await tap('PauseScene','button:继续游戏');await page.waitForFunction(()=>localStorage.getItem('sheep-run-scenery-v1')&&window.g.scene.getScene('RunScene').rareScenery.snapshot().id,null,{timeout:180000});
 report.observation=await page.evaluate(()=>({first:window.first,now:window.g.scene.getScene('RunScene').activeRunTimeMs,state:window.g.scene.getScene('RunScene').rareScenery.snapshot(),saved:JSON.parse(localStorage.getItem('sheep-run-scenery-v1')),notices:window.notices}));
 assert(report.observation.first.time>=45000);assert.equal(report.observation.saved.seenIds.length,1);assert.equal(report.observation.notices.length,1);
 await page.screenshot({path:out+'screenshots/natural-discovery.png',scale:'css'});
 await page.waitForFunction(()=>!window.g.scene.getScene('RunScene').rareScenery.snapshot().id,null,{timeout:15000});
 report.ended=true;report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(out+'natural-review.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
