import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='docs/obstacle-recycle-review/2026-10-11/';
const report={passed:false,phoneHardware:false,method:'Production Edge mobile-touch browser; first obstacle spawns normally. Isolated frozen-position fixtures exercise the actual movement/recycling methods and capture real rendered output.',views:[],errors:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const [width,height] of [[896,414],[844,390],[800,600],[480,270],[1440,405]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));await page.goto('http://127.0.0.1:1894/');const main=(await request).url();
  await page.evaluate(async url=>window.g=(await import(url)).game.instance,main);
  const ready=s=>page.waitForFunction(s=>window.g.scene.isActive(s)&&window.g.scene.getScene(s).children.list.length,s);
  const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=2;const f=()=>{if(!--n){window.g.events.off('postrender',f);resolve();}};window.g.events.on('postrender',f);}));
  const tap=async(s,n)=>{const p=await page.evaluate(({s,n})=>{const b=window.g.scene.getScene(s).children.getByName(n).getBounds(),c=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:c.x+b.centerX*c.width/z.width,y:c.y+b.centerY*c.height/z.height};},{s,n});await page.touchscreen.tap(p.x,p.y);await frames();};
  const shot=name=>page.screenshot({path:output+'screenshots/'+width+'x'+height+'-'+name+'.png',scale:'css'});
  await ready('MenuScene');const view={width,height,main,modes:[]};report.views.push(view);
  for(const mode of ['endless','delivery']){
   if(mode==='endless')await tap('MenuScene','button:开始游戏');
   else {await tap('MenuScene','mailbox-entry');await tap('MenuScene','mailbox-delivery');await tap('MenuScene','delivery-start');}
   await ready('RunScene');await page.waitForFunction(()=>window.g.scene.getScene('RunScene').obstacles.getChildren().some(o=>o.active));
   const before=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.sys.sceneUpdate=()=>{};s.physics.pause();window.ob=s.obstacles.getChildren().find(o=>o.active);return {score:s.scoreSystem.score,kind:window.ob.definition.kind,left:s.cameras.main.scrollX,origin:s.scale.gameSize.width-480};});
   const result={mode,before,checks:[],samples:[]};view.modes.push(result);
   const check=(value,label)=>{assert(value,label);result.checks.push(label);};
   const position=async(screenRight)=>{const value=await page.evaluate(({mode,screenRight})=>{const s=window.g.scene.getScene('RunScene'),o=window.ob,left=s.cameras.main.scrollX,x=left+screenRight-(o.displayWidth+o.definition.width)/2;
    if(mode==='delivery'){s.delivery.distance=498+o.getData('delivery-at')-x;s.updateDelivery(0);}else {o.body.reset(x,218-o.definition.groundOffset);s.moveObjects(0);}
    const b=o.getBounds();return {active:o.active,visible:o.visible,bodyEnabled:o.body.enable,passed:o.passed,score:s.scoreSystem.score,worldRight:o.visualRightEdge,boundsRight:b.right,screenRight:b.right-left,authoredRight:o.rightEdge,x:o.x,recycleX:s.obstacleRecycleX};},{mode,screenRight});await frames();result.samples.push(value);return value;};
   let value=await position(42);check(value.active&&value.visible,'passed obstacle remains on road');check(Math.abs(value.worldRight-value.boundsRight)<.001,'visual right edge matches Phaser artwork bounds');await shot(mode+'-behind');
   if(before.origin>40){value=await position(before.origin-25);check(value.authoredRight<-20&&value.active&&value.visible,'old fixed recycle point is still visible and retained');await shot(mode+'-old-boundary');}
   value=await position(8);check(value.active&&value.visible,'last visible pixels retained at screen edge');await shot(mode+'-edge');
   const score=value.score;value=await position(-19);check(value.active,'offscreen rounding margin retained');
   value=await position(-21);check(!value.active&&!value.visible&&!value.bodyEnabled,'fully offscreen obstacle is returned to pool');check(value.score===score,'recycling does not re-award score');await shot(mode+'-recycled');
   if(mode==='endless'){check(score===before.score+25,'one passing reward only');}
   await page.evaluate(()=>window.g.scene.getScene('RunScene').scene.start('MenuScene',{}));await ready('MenuScene');
  }
  await context.close();console.log(JSON.stringify({width,height,checks:view.modes.reduce((n,m)=>n+m.checks.length,0)}));
 }
 assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.failure=e.stack;for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:output+'screenshots/failure.png',scale:'css'});throw e;}
finally{await writeFile(output+'browser-review.json',JSON.stringify(report,null,2));await browser.close();}
