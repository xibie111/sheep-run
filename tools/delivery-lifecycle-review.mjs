import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='docs/delivery-review/2026-10-11/',report={passed:false,phoneHardware:false,checks:[],errors:[],fixtures:'Asset failure injected by request abort; isolated storage records; production touch UI. A frozen ending fixture tests write failure.'};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('sheep-run-mailbox-v1','{"version":1,"readIds":["welcome-v1"]}'));
 const glob='**/assets/hill-*.png';await page.route(glob,r=>r.abort());
 const req=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto('http://127.0.0.1:1894');report.main=(await req).url();await page.evaluate(async u=>window.g=(await import(u)).game.instance,report.main);
 const ready=s=>page.waitForFunction(s=>window.g.scene.isActive(s)&&window.g.scene.getScene(s).children.list.length,s);
 const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=2;const f=()=>{if(!--n){window.g.events.off('postrender',f);resolve();}};window.g.events.on('postrender',f);}));
 const center=(s,n)=>page.evaluate(({s,n})=>{const o=window.g.scene.getScene(s).children.getByName(n),b=o.getBounds(),c=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:c.x+b.centerX*c.width/z.width,y:c.y+b.centerY*c.height/z.height};},{s,n});
 const tap=async(s,n)=>{const p=await center(s,n);await page.touchscreen.tap(p.x,p.y);await frames();};
 const shot=n=>page.screenshot({path:out+'screenshots/'+n+'.png',scale:'css'});
 await page.waitForFunction(()=>window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));assert(!await page.evaluate(()=>window.g.scene.isActive('MenuScene')));await shot('delivery-asset-failed');
 await page.unroute(glob);await tap('PreloadScene','button:重试');await ready('MenuScene');assert(await page.evaluate(()=>['delivery-forest-v1','delivery-hill-v1','delivery-postcard-v1'].every(k=>window.g.textures.exists(k))));report.checks.push('missing hill art blocks entry; touch retry restores all assets');
 assert.equal(await page.evaluate(()=>localStorage.getItem('sheep-run-mailbox-v1')),'{"version":1,"readIds":["welcome-v1"]}');
 await tap('MenuScene','mailbox-entry');const cdp=await context.newCDPSession(page),p=await center('MenuScene','mailbox-delivery');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:0}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await frames();
 assert.equal(await page.evaluate(()=>window.g.scene.getScene('MenuScene').data.get('menu-modal-owner')),'mailbox');report.checks.push('touch cancel does not open delivery');
 for(let i=0;i<4;i++){await tap('MenuScene','mailbox-delivery');await tap('MenuScene','delivery-back');}
 assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-adventure-overlay="delivery-panel"]').length),1);report.checks.push('rapid repeated open/close creates one panel and preserves mailbox input');
 await tap('MenuScene','mailbox-delivery');await page.setViewportSize({width:800,height:600});await frames();await shot('delivery-brief-resized');
 assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="delivery-panel"]').dataset.mode),'brief');report.checks.push('rotation retains the current panel and relayouts its touch targets');
 await tap('MenuScene','delivery-back');await tap('MenuScene','button:合上邮箱');
 await tap('MenuScene','button:成就册');assert.equal(await page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('mailbox-entry').input.enabled),false);await tap('MenuScene','button:合上手账');
 await tap('MenuScene','button:settings');await ready('PauseScene');await tap('PauseScene','button:继续游戏');await ready('MenuScene');
 assert(await page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('mailbox-entry').input.enabled));report.checks.push('journey book/settings still exclude mailbox and restore it on close');
 await tap('MenuScene','mailbox-entry');await tap('MenuScene','mailbox-delivery');await tap('MenuScene','delivery-start');await ready('RunScene');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await ready('PauseScene');const frozen=await page.evaluate(()=>window.g.scene.getScene('RunScene').activeRunTimeMs);await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>window.g.scene.getScene('RunScene').activeRunTimeMs),frozen);
 await tap('PauseScene','button:返回首页');await ready('MenuScene');assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="mailbox"]').dataset.open),'true');report.checks.push('background blur auto-pauses; exiting a paused delivery returns to mailbox');
 await tap('MenuScene','mailbox-delivery');await tap('MenuScene','delivery-start');await ready('RunScene');
 await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.sys.sceneUpdate=()=>{};s.physics.pause();s.delivery.distance=18000;s.delivery.state='ending';s.delivery.endingMs=4180;window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sheep-run-delivery-v1')throw Error('quota');return window.realSet.call(this,k,v);};s.updateDelivery(20);});await frames();await shot('delivery-storage-failed');
 assert.equal(await page.evaluate(()=>document.querySelector('[data-adventure-overlay="delivery-panel"]').dataset.saved),'false');assert.equal(await page.evaluate(()=>localStorage.getItem('sheep-run-delivery-v1')),null);
 await tap('RunScene','delivery-back');await ready('MenuScene');await tap('MenuScene','mailbox-delivery');assert(await page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('delivery-card').input.enabled));await tap('MenuScene','delivery-card');await shot('delivery-session-postcard');report.checks.push('failed postcard write keeps session access and shows a brief save status without corrupting existing saves');
 assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.failure=e.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:out+'screenshots/lifecycle-failure.png',scale:'css'});throw e;}
finally{await writeFile(out+'lifecycle-review.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
