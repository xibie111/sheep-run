import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=new URL('../docs/scenery-review/2026-10-11/',import.meta.url),base=process.env.SCENERY_QA_URL??'http://127.0.0.1:1894';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={passed:false,browser:'Edge mobile touch emulation',phoneHardware:false,fixtures:'Frozen production scenes with controlled effective time, actual rendered weather and postrender callbacks. These screenshots are integration fixtures, not unassisted gameplay.',views:[]};
const ids=['rainbow-v1','meteors-v1','fireflies-v1'];
async function setup(w,h,dpr=2,reduced=false){
  const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:dpr,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto(base);const main=(await request).url();
  await page.evaluate(async url=>window.g=(await import(url)).game.instance,main);
  const ready=scene=>page.waitForFunction(scene=>window.g.scene.isActive(scene)&&window.g.scene.getScene(scene).children.list.length,scene);
  const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=2;const fn=()=>{if(!--n){window.g.events.off('postrender',fn);resolve();}};window.g.events.on('postrender',fn);}));
  const tap=async(scene,name)=>{const p=await page.evaluate(({scene,name})=>{const o=window.g.scene.getScene(scene).children.getByName(name);if(!o)throw Error('Missing '+name);const b=o.getBounds(),c=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:c.x+b.centerX*c.width/z.width,y:c.y+b.centerY*c.height/z.height};},{scene,name});await page.touchscreen.tap(p.x,p.y);await frames();};
  const screenshot=name=>page.screenshot({path:fileURLToPath(new URL('screenshots/'+name+'.png',output)),scale:'css'});
  await ready('MenuScene');return{context,page,ready,frames,tap,screenshot,errors,main};
}
async function begin(h,id,reduced){
  return h.page.evaluate(({id,reduced})=>{
    const s=window.g.scene.getScene('RunScene');s.sys.sceneUpdate=()=>{};s.physics.pause();s.companions.clear();s.ambientLife?.clear();s.journeyToast.clear();
    for(const group of [s.obstacles,s.stars,s.powerUps])for(const o of group.getChildren())o.deactivate();
    const C=s.rareScenery.constructor;s.rareScenery.clear();window.notes=[];s.rareScenery=new C(s,reduced,message=>window.notes.push(message),undefined,71);
    s.environmentSystem.setTheme(id==='fireflies-v1'?'summer':id==='meteors-v1'?'winter':'spring');
    const distance=id==='meteors-v1'?10000:id==='fireflies-v1'?6500:0;
    s.environmentSystem.setWeather(id==='rainbow-v1'?'rain':'sunny');s.environmentSystem.update(distance,0);
    window.ctx={nowMs:44900,deltaMs:0,landscape:s.environmentSystem.presentation(),viewport:window.g.scale.gameSize,blocked:true};
    s.rareScenery.update(window.ctx);
    s.environmentSystem.setWeather('sunny');s.environmentSystem.update(distance,0);
    window.ctx={...window.ctx,nowMs:45000,landscape:s.environmentSystem.presentation(),blocked:false};s.rareScenery.update(window.ctx);
    return{snapshot:s.rareScenery.snapshot(),landscape:window.ctx.landscape};
  },{id,reduced});
}
async function step(h,n){await h.page.evaluate(async n=>{for(let i=0;i<n;i++){window.ctx.nowMs+=100;window.ctx.deltaMs=100;window.g.scene.getScene('RunScene').rareScenery.update(window.ctx);await new Promise(resolve=>window.g.events.once('postrender',resolve));}},n);}
async function record(h){return h.page.evaluate(()=>({raw:localStorage.getItem('sheep-run-scenery-v1'),notes:window.notes,state:window.g.scene.getScene('RunScene').rareScenery.snapshot()}));}
async function openCards(h){await h.tap('MenuScene','button:成就册');await h.tap('MenuScene','journey-next');await h.tap('MenuScene','journey-next');}
try{
  for(const [w,hgt,dpr,reduced]of[[896,414,2,false],[844,390,2,false],[800,600,2,false],[480,270,2,false],[800,600,1,true]]){
    const h=await setup(w,hgt,dpr,reduced),r={w,h:hgt,dpr,reduced,main:h.main,checks:[],events:[]};report.views.push(r);
    const check=(value,label)=>{assert(value,label);r.checks.push(label);};const label=`${w}x${hgt}-dpr${dpr}`;
    await openCards(h);await h.screenshot(label+'-locked');
    check(await h.page.evaluate(()=>{const s=window.g.scene.getScene('MenuScene');return [0,1,2,3].every(i=>!s.children.getByName(`achievement-card:${i}`).input.enabled)&&!s.children.getByName('button:开始游戏').input.enabled;}),'locked cards cannot be opened; underlying menu blocked');
    await h.tap('MenuScene','button:合上手账');await h.tap('MenuScene','button:开始游戏');await h.ready('RunScene');
    const gameplay=await h.page.evaluate(()=>localStorage.getItem('sheep-run-save'));
    for(const id of ids){
      const start=await begin(h,id,reduced);check(start.snapshot.id===id,'correct actual environment selects '+id);r.events.push(start);
      if(id==='rainbow-v1'){
        await h.page.evaluate(()=>window.g.scene.getScene('RunScene').rareScenery.active.view.art.setVisible(false));await step(h,20);
        check(!(await record(h)).raw,'hidden scenery never records');
        await h.page.evaluate(()=>window.g.scene.getScene('RunScene').rareScenery.active.view.art.setVisible(true));
        await step(h,5);
        if(w===896){
          await h.tap('RunScene','button:暂停');await h.ready('PauseScene');const before=await record(h);await step(h,20);check(JSON.stringify(before)===JSON.stringify(await record(h)),'pause freezes exposure and state');
          await h.screenshot('scenery-paused');await h.tap('PauseScene','button:继续游戏');await h.ready('RunScene');
          // Discard the fixture wall-clock advance while paused.
          await h.page.evaluate(()=>window.ctx.nowMs=47500);
        }
      }else{await step(h,15);check(!JSON.parse((await record(h)).raw).seenIds.includes(id),'insufficient visible exposure does not unlock '+id);}
      await step(h,25);const seen=await record(h);
      check(JSON.parse(seen.raw).seenIds.includes(id),'visible exposure unlocks '+id);check(seen.notes.filter(n=>n.includes('已收好')).length===1,'one first discovery notice');
      check(await h.page.evaluate(()=>window.g.scene.getScene('RunScene').children.list.filter(o=>o.name.startsWith('rare-scenery:')).every(o=>!o.body&&!o.input&&o.depth<0)),'visual only, behind gameplay');
      const changedPixels=await h.page.evaluate(async()=>{
        const s=window.g.scene.getScene('RunScene'),art=s.rareScenery.active.view.art;
        const sample=()=>new Promise(resolve=>window.g.renderer.snapshot(image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);resolve({pixels:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height});}));
        art.setVisible(false);const a=await sample();art.setVisible(true);const b=await sample();
        const size=window.g.scale.gameSize,originY=Math.floor((size.height-270)/2),sky=Math.max(76,28+originY);
        const bottom=s.rareScenery.snapshot().id==='fireflies-v1'?207+originY:sky+63,top=s.rareScenery.snapshot().id==='fireflies-v1'?170+originY:sky-16;
        let changed=0;for(let y=Math.floor(top*a.h/size.height);y<Math.ceil(bottom*a.h/size.height);y++)for(let x=Math.floor((size.width*.62-110)*a.w/size.width);x<Math.ceil((size.width*.62+110)*a.w/size.width);x++){const i=(y*a.w+x)*4;if(a.pixels[i]!==b.pixels[i]||a.pixels[i+1]!==b.pixels[i+1]||a.pixels[i+2]!==b.pixels[i+2])changed++;}return changed;
      });
      check(changedPixels>30,'actual rendered pixel difference confirms visible '+id);r.events.at(-1).changedPixels=changedPixels;
      await h.screenshot(label+'-'+id);
      await step(h,55);check((await record(h)).state.id===null,'event leaves after duration');
    }
    check(await h.page.evaluate(before=>localStorage.getItem('sheep-run-save')===before,gameplay),'gameplay save unchanged');
    await begin(h,'meteors-v1',reduced);await step(h,30);check((await record(h)).notes.length===0,'repeat scenery has no duplicate discovery notice');
    await h.page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');window.oldScenery=s.rareScenery;s.scene.start('MenuScene');});await h.ready('MenuScene');
    check(await h.page.evaluate(()=>window.oldScenery.snapshot().stopped&&window.oldScenery.snapshot().id===null),'exit clears the active scene');
    await openCards(h);await h.screenshot(label+'-collected');
    for(let i=0;i<3;i++){
      await h.tap('MenuScene',`achievement-card:${i}`);const text=await h.page.evaluate(()=>{const c=document.querySelector('[data-adventure-overlay="journey-book"]');return{mode:c.dataset.mode,lines:JSON.parse(c.dataset.lines),panel:JSON.parse(c.dataset.panel)};});
      check(text.mode==='postcard','postcard opens '+i);
      check(text.lines.every(l=>l.ink.x>=text.panel.x-1&&l.ink.x+l.ink.width<=text.panel.x+text.panel.width+1&&l.ink.y>=text.panel.y-1&&l.ink.y+l.ink.height<=text.panel.y+text.panel.height+1),'postcard text fits panel '+i);
      await h.screenshot(label+'-card-'+i);await h.tap('MenuScene','button:合上手账');
    }
    await h.tap('MenuScene','button:合上手账');check(await h.page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('button:开始游戏').input.enabled),'close restores menu input');
    await h.page.reload();await h.page.evaluate(async url=>window.g=(await import(url)).game.instance,h.main);await h.ready('MenuScene');await openCards(h);
    check(await h.page.evaluate(()=>JSON.parse(document.querySelector('[data-adventure-overlay="journey-book"]').dataset.scenery).length===3),'reload preserves all postcards');
    check(h.errors.length===0,'no runtime errors');r.errors=h.errors;console.log(JSON.stringify({label,checks:r.checks.length}));await h.context.close();
  }
  report.passed=true;
}catch(e){report.failure=e.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:fileURLToPath(new URL('screenshots/failure.png',output)),scale:'css'});throw e;}
finally{await writeFile(new URL('browser-review.json',output),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed}));
