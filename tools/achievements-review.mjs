import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.env.ACHIEVEMENTS_REVIEW_URL||'http://127.0.0.1:1894/';
const eventsOnly=process.argv.includes('--events');
const output=new URL('../docs/achievements-review/2026-10-11/',import.meta.url);
await mkdir(new URL('screenshots/',output),{recursive:true});
const catalog=[...(await readFile(new URL('../src/data/journeyBook.ts',import.meta.url),'utf8')).matchAll(/\{id:"([^"]+)",metric:"([^"]+)",name:"([^"]+)",goal:(\d+),condition:"([^"]+)",message:"([^"]+)",icon:"([^"]+)"\}/g)].map(m=>({id:m[1],metric:m[2],name:m[3],goal:Number(m[4]),condition:m[5],message:m[6]}));
assert.equal(catalog.length,20);
const badges=['spring-flower','spring-butterfly','spring-clover','summer-sunflower','summer-watermelon','summer-shell','autumn-maple','autumn-acorn','autumn-pumpkin','winter-snowflake','winter-mitten','winter-cocoa'];
const skins=['white','black','brown','golden','farmer','mint','rose','blueberry','lavender','pumpkin'];
const oldDate='2026-10-08',oldIds=catalog.slice(0,8).map(a=>a.id);
const oldJournal={version:1,runs:20,summons:20,stars:50,obstacles:50,record:true,seasons:['spring','summer','autumn','winter'],skins:5,achieved:Object.fromEntries(oldIds.map(id=>[id,oldDate])),rewards:{},readAchievements:['first-run','five-skins'],readRewards:[]};
const save={version:4,highScore:12345,totalStars:51,coins:77,selectedSkin:'white',unlockedSkins:skins,upgrades:{jump:0,speed:0,magnet:0,dash:0},settings:{music:false,sfx:false,musicVolume:1,sfxVolume:1}};
const report={passed:false,url,phoneHardware:false,engine:'Production Edge Chromium mobile touch emulation',method:'Isolated localStorage snapshots verify historical reconciliation. Real touchscreen taps navigate production UI. A separate frozen run injects cosmetic observer events and a collectible pickup position; this is not natural play or phone hardware proof.',catalog,views:[],checks:[],errors:[],screenshots:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
const check=(value,label)=>{assert(value,label);report.checks.push(label);};
async function ready(f,s){await f.page.waitForFunction(s=>window.g.scene.isActive(s)&&window.g.scene.getScene(s).children.list.length,s);await frames(f);}
async function frames(f){await f.page.evaluate(()=>new Promise(resolve=>{let n=2;const f=()=>{if(!--n){window.g.events.off('postrender',f);resolve();}};window.g.events.on('postrender',f);}));}
async function open(width,height,dpr,fixture='complete'){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true}),page=await context.newPage(),f={context,page,width,height,dpr,fixture};
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(({fixture,save,oldJournal,badges})=>{
  if(localStorage.getItem('sheep-run-save')===null)localStorage.setItem('sheep-run-save',JSON.stringify(fixture==='complete'?save:{...save,highScore:0,totalStars:0,coins:0,unlockedSkins:['white']}));
  if(localStorage.getItem('sheep-run-collections-v1')===null)localStorage.setItem('sheep-run-collections-v1',JSON.stringify({version:1,badges:fixture==='complete'?badges:fixture==='events'?badges.slice(0,2):[]}));
  if(fixture==='complete'&&localStorage.getItem('sheep-run-journey-v1')===null)localStorage.setItem('sheep-run-journey-v1',JSON.stringify(oldJournal));
  if(localStorage.getItem('sheep-run-scenery-v1')===null)localStorage.setItem('sheep-run-scenery-v1',JSON.stringify({version:1,seenIds:fixture==='complete'?['rainbow-v1','meteors-v1','fireflies-v1']:[]}));
 },{fixture,save,oldJournal,badges});
 const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto(url,{waitUntil:'domcontentloaded'});f.main=(await request).url();
 await page.evaluate(async main=>window.g=(await import(main)).game.instance,f.main);await ready(f,'MenuScene');return f;
}
async function target(f,s,n){return f.page.evaluate(({s,n})=>{const scene=window.g.scene.getScene(s),o=scene.children.getByName(n);if(!o)throw Error(`Missing ${s} ${n}`);const b=o.getBounds(),r=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:r.x+(b.centerX-scene.cameras.main.scrollX*o.scrollFactorX)*r.width/z.width,y:r.y+(b.centerY-scene.cameras.main.scrollY*o.scrollFactorY)*r.height/z.height};},{s,n});}
async function tap(f,s,n){const p=await target(f,s,n);await f.page.touchscreen.tap(p.x,p.y);await frames(f);}
const data=f=>f.page.locator('[data-adventure-overlay="journey-book"]').evaluate(c=>({...c.dataset}));
const texts=async f=>JSON.parse((await data(f)).lines).map(l=>l.text);
async function checkInk(f,label){const d=await data(f),lines=JSON.parse(d.lines),panel=JSON.parse(d.panel),size=await f.page.evaluate(()=>({width:window.g.scale.gameSize.width,height:window.g.scale.gameSize.height}));for(const l of lines){check(l.ink.x>=l.box.x-1&&l.ink.y>=l.box.y-1&&l.ink.x+l.ink.width<=l.box.x+l.box.width+1&&l.ink.y+l.ink.height<=l.box.y+l.box.height+1,`${f.width}x${f.height} DPR ${f.dpr} ${label}: ink fits ${l.text}`);}check(panel.x>=-1&&panel.y>=-1&&panel.x+panel.width<=size.width+1&&panel.y+panel.height<=size.height+1,`${f.width}x${f.height} ${label}: panel is visible`);}
async function shot(f,name){const file=`screenshots/${f.width}x${f.height}-dpr${f.dpr}-${f.fixture}-${name}.png`;await f.page.screenshot({path:fileURLToPath(new URL(file,output)),scale:'css'});report.screenshots.push(file);}
const states=f=>f.page.evaluate(()=>{const s=window.g.scene.getScene('MenuScene');return Object.fromEntries(['button:settings','button:开始游戏','button:衣橱','button:收藏册','mailbox-entry','menu-sheep'].map(n=>[n,s.children.getByName(n)?.input?.enabled??null]));});
try{
 for(const[width,height,dpr]of(eventsOnly?[]:[[480,270,1],[896,414,2],[844,390,1],[800,600,2]])){
  const f=await open(width,height,dpr),view={width,height,dpr,main:f.main,details:[],pages:[]};report.views.push(view);
  const economy=await f.page.evaluate(()=>localStorage.getItem('sheep-run-save')),before=await states(f);
  const journal=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('sheep-run-journey-v1')));
  check(Object.keys(journal.achieved).length===20,`${width}: old counters, owned skins and badges reconcile all 12 new achievements`);
  check(oldIds.every(id=>journal.achieved[id]===oldDate),`${width}: original 8 achievement dates retained`);
  check(['first-run','five-skins'].every(id=>journal.readAchievements.includes(id)),`${width}: historical read markers retained`);
  check(journal.skins===10&&journal.version===1,`${width}: valid unique skin count and existing journal schema`);
  await tap(f,'MenuScene','button:成就册');
  check((await data(f)).page==='0',`${width}: opens on first page`);
  check(await f.page.evaluate(()=>!window.g.scene.getScene('MenuScene').children.getByName('journey-prev').input.enabled),`${width}: previous disabled on first page`);
  const blocked=await states(f);check(Object.values(blocked).every(v=>v===false||v===null),`${width}: underlying menu inputs blocked`);
  const physical=await f.page.locator('[data-adventure-overlay="journey-book"]').evaluate(c=>({width:c.width,height:c.height,cssWidth:parseFloat(c.style.width),cssHeight:parseFloat(c.style.height),dpr:window.devicePixelRatio}));
  check(physical.width===Math.round(physical.cssWidth*dpr)&&physical.height===Math.round(physical.cssHeight*dpr),`${width}: canvas renders at DPR ${dpr} physical pixels`);
  view.surface=physical;
  const cdp=await f.context.newCDPSession(f.page),p=await target(f,'MenuScene','journey-next');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await frames(f);
  check((await data(f)).page==='0',`${width}: actual browser touch cancellation does not turn page`);await cdp.detach();
  for(let page=0;page<5;page++){
   if(page)await tap(f,'MenuScene','journey-next');
   check((await data(f)).page===String(page),`${width}: achievement page ${page+1}/6 reached`);
   const rows=await texts(f);check(rows.some(t=>t.includes(`第 ${page+1} / 6 页`)),`${width}: page counter ${page+1}/6 correct`);
   await checkInk(f,`page-${page+1}`);view.pages.push(page+1);await shot(f,`page-${page+1}`);
   for(let card=0;card<4;card++){
    const a=catalog[page*4+card];await tap(f,'MenuScene',`achievement-card:${card}`);
    const d=await data(f),lines=await texts(f);check(d.mode==='detail'&&lines.includes(a.name)&&lines.includes(a.condition),`${width}: detail ${a.id} title and condition exact`);
    check(lines.join('').includes(a.message),`${width}: detail ${a.id} complete message rendered`);
    check(lines.some(t=>/^达成日期 \d{4}-\d{2}-\d{2}$/.test(t)),`${width}: detail ${a.id} shows date`);
    await checkInk(f,`detail-${a.id}`);view.details.push(a.id);if(page>=2&&card===0)await shot(f,`detail-${a.id}`);
    await tap(f,'MenuScene','button:合上手账');check((await data(f)).mode==='achievements'&&(await data(f)).page===String(page),`${width}: detail returns to page ${page+1}`);
   }
  }
  await tap(f,'MenuScene','journey-next');check((await data(f)).page==='5',`${width}: scenery remains last page 6/6`);await checkInk(f,'scenery');await shot(f,'page-6-scenery');
  check(await f.page.evaluate(()=>!window.g.scene.getScene('MenuScene').children.getByName('journey-next').input.enabled),`${width}: next disabled on last page`);
  for(let i=0;i<3;i++){await tap(f,'MenuScene',`achievement-card:${i}`);check((await data(f)).mode==='postcard',`${width}: scenery ${i} opens`);await checkInk(f,`postcard-${i}`);if(i===0)await shot(f,'scenery-detail');await tap(f,'MenuScene','button:合上手账');check((await data(f)).page==='5'&&(await data(f)).mode==='achievements',`${width}: scenery returns to last page`);}
  await tap(f,'MenuScene','journey-next');check((await data(f)).page==='5',`${width}: touching disabled final next does not escape book`);
  await tap(f,'MenuScene','journey-prev');await tap(f,'MenuScene','journey-next');check((await data(f)).page==='5',`${width}: rapid page navigation remains bounded`);
  await tap(f,'MenuScene','button:合上手账');check((await data(f)).open==='false',`${width}: closes book`);check(JSON.stringify(await states(f))===JSON.stringify(before),`${width}: underlying menu input states restored exactly`);
  check(await f.page.evaluate(()=>window.g.scene.isActive('MenuScene')&&!window.g.scene.isActive('RunScene')),`${width}: closing gesture does not start run`);
  check(await f.page.evaluate(()=>localStorage.getItem('sheep-run-save'))===economy,`${width}: reading and historical unlocks do not change gameplay economy`);
  const afterRead=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('sheep-run-journey-v1')));check(afterRead.readAchievements.length===20,`${width}: all 20 details persist read markers`);
  await f.page.reload();await f.page.evaluate(async main=>window.g=(await import(main)).game.instance,f.main);await ready(f,'MenuScene');
  check(await f.page.evaluate(({oldIds,oldDate})=>{const j=JSON.parse(localStorage.getItem('sheep-run-journey-v1'));return j.readAchievements.length===20&&oldIds.every(id=>j.achieved[id]===oldDate);},{oldIds,oldDate}),`${width}: full refresh retains read markers and original dates`);
  await tap(f,'MenuScene','button:成就册');await shot(f,'after-reload');await tap(f,'MenuScene','button:合上手账');
  if(width===896)for(let i=0;i<3;i++){await tap(f,'MenuScene','button:开始游戏');await ready(f,'RunScene');await f.page.evaluate(()=>window.g.scene.getScene('RunScene').scene.start('MenuScene',{}));await ready(f,'MenuScene');check(await f.page.locator('[data-adventure-overlay="journey-book"]').count()===1&&await f.page.locator('[data-adventure-overlay="journey-toast"]').count()===0,`restart ${i+1}: single journal, no toast residue`);check(await f.page.evaluate(()=>{const s=window.g.scene.getScene('MenuScene');return s.children.list.filter(o=>o.name==='button:成就册').length===1&&s.children.getByName('button:开始游戏').input.enabled&&s.data.get('menu-modal-owner')==null;}),`restart ${i+1}: one entry and menu inputs restored`);await tap(f,'MenuScene','button:成就册');await tap(f,'MenuScene','button:合上手账');}
  await f.context.close();console.log(JSON.stringify({width,height,dpr,details:view.details.length}));
 }
 if(!eventsOnly){const locked=await open(480,270,2,'locked');await tap(locked,'MenuScene','button:成就册');
 for(let i=0;i<4;i++)await tap(locked,'MenuScene','journey-next');await checkInk(locked,'locked-page-5');await shot(locked,'locked-page-5');
 check((await texts(locked)).filter(t=>t==='进度 0 / 1').length===4,'unearned seasonal achievements show clear 0 / 1 progress');
 await tap(locked,'MenuScene','achievement-card:3');await checkInk(locked,'locked-detail');check((await texts(locked)).includes('进度 0 / 1')&&!(await texts(locked)).some(t=>t.startsWith('达成日期')),'unearned detail shows progress and no invented date');await shot(locked,'locked-detail');await locked.context.close();}
 const events=await open(844,390,2,'events');await tap(events,'MenuScene','button:开始游戏');await ready(events,'RunScene');
 const initial=await events.page.evaluate(()=>{const r=window.g.scene.getScene('RunScene');r.sys.sceneUpdate=()=>{};r.physics.pause();return localStorage.getItem('sheep-run-save');});
 const threshold=await events.page.evaluate(()=>{const r=window.g.scene.getScene('RunScene'),read=()=>JSON.parse(localStorage.getItem('sheep-run-journey-v1'));for(let i=0;i<24;i++)r.journey.star();const stars24=read();r.journey.star();const stars25=read();for(let i=0;i<24;i++)r.journey.star();const stars49=read();r.journey.star();r.journey.star();const stars50=read();for(let i=0;i<49;i++)r.journey.passed();const obstacles49=read();r.journey.passed();r.journey.passed();const obstacles50=read();for(let i=0;i<20;i++)r.journey.summon();return{stars24,stars25,stars49,stars50,obstacles49,obstacles50,afterSummons:read()};});
 check(!threshold.stars24.achieved['twenty-five-stars']&&Boolean(threshold.stars25.achieved['twenty-five-stars']),'real RunScene cosmetic observer unlocks 25-star stamp exactly at 25');
 check(!threshold.stars49.achieved['fifty-stars']&&Boolean(threshold.stars50.achieved['fifty-stars'])&&threshold.stars50.stars===50,'real observer unlocks 50-star stamp at 50 and caps follow-up observations');
 check(!threshold.obstacles49.achieved['fifty-obstacles']&&Boolean(threshold.obstacles50.achieved['fifty-obstacles'])&&threshold.obstacles50.obstacles===50,'real observer unlocks 50-obstacle stamp at 50');
 check(Boolean(threshold.afterSummons.achieved['twenty-friends'])&&threshold.afterSummons.summons===20,'real observer unlocks 20-companion stamp at 20');report.eventThresholds=threshold;
 await events.page.evaluate(()=>{const r=window.g.scene.getScene('RunScene'),h=r.hiddenCollections;h.update(0,0,1200);h.image.x=r.sheep.x;h.update(0,0,1200);});
 const picked=await events.page.evaluate(()=>JSON.parse(localStorage.getItem('sheep-run-journey-v1')));check(Boolean(picked.achieved['spring-collector']),'actual HiddenCollectionRun pickup callback unlocks spring-collector');
 check(await events.page.evaluate(()=>localStorage.getItem('sheep-run-save'))===initial,'cosmetic observer and collection pickup do not change gameplay save');
 await shot(events,'collection-unlock');await events.page.evaluate(()=>{const r=window.g.scene.getScene('RunScene');r.hiddenCollections.surface.show(false);for(let i=0;i<9;i++)r.journeyToast.update(2300);});await frames(events);check(await events.page.locator('[data-adventure-overlay="journey-toast"]').evaluate(c=>c.style.display==='block'&&c.dataset.message.includes('春日收藏家')),'cosmetic collectible callback queues the new spring achievement notice');await shot(events,'observer-notice');
 const summary=await events.page.evaluate(()=>{const r=window.g.scene.getScene('RunScene'),ids=r.journey.finish(false);r.scene.start('ResultScene',{score:0,best:0,newRecord:false,coinsEarned:0,coinBalance:0,achievements:ids});return ids;});await ready(events,'ResultScene');
 check(summary.includes('twenty-five-stars')&&summary.includes('fifty-stars')&&summary.includes('fifty-obstacles')&&summary.includes('twenty-friends')&&summary.includes('spring-collector'),'merged result IDs include all new event achievements, including collectible callback');
 report.eventSummary=summary;check((await texts(events)).includes(`本局点亮 ${summary.length} 枚印章`),'result has one merged count for new unlocks');await shot(events,'merged-result');await tap(events,'ResultScene','button:本局成就');await checkInk(events,'merged-result-book');await shot(events,'merged-result-book');await events.context.close();
 check(report.errors.length===0,'no browser runtime errors');report.passed=true;
}catch(error){report.failure=error.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:fileURLToPath(new URL('screenshots/failure.png',output)),scale:'css'});throw error;}
finally{await writeFile(new URL(eventsOnly?'browser-event-review.json':'browser-review.json',output),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors}));
