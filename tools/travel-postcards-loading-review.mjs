import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.POSTCARD_LOADING_QA_OUT??'docs/travel-postcards-v2/final-loading-browser',url=process.env.POSTCARD_LOADING_QA_URL??'http://127.0.0.1:4360/';await mkdir(out,{recursive:true});
const report={passed:false,checks:[],errors:[],method:'Ephemeral Edge mobile touch DPR2. Abort only the new spring postcard request, then restore and touch the production retry button. The old and unknown postcard IDs are fixture records, never a user profile.',phoneHardware:false};
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:896,height:414},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
const check=(value,label)=>{assert(value,label);report.checks.push(label);};
const expected=JSON.stringify({version:1,seenIds:['rainbow-v1','future-qa-card']});
await context.addInitScript(raw=>{localStorage.setItem('sheep-run-scenery-v1',raw);},expected);
let reject=true,aborted=0;
await page.route(/\/assets\/spring-pasture-[^/]+\.png$/,route=>{if(reject){aborted++;return route.abort();}return route.continue();});
try{
  const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js$/.test(r.url()));await page.goto(url);const main=(await request).url();report.main=main;
  await page.evaluate(async m=>{window.g=(await import(m)).game.instance;},main);
  await page.waitForFunction(()=>window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
  report.aborted=aborted;check(aborted>=1,'new postcard request failed including any built-in loader retries');
  check(await page.evaluate(()=>!window.g.scene.isActive('MenuScene')),'menu remains blocked on missing postcard');
  check(await page.evaluate(()=>localStorage.getItem('sheep-run-scenery-v1'))===expected,'existing and unknown card records untouched on failure');
  await page.screenshot({path:out+'/missing-postcard.png',scale:'css'});
  reject=false;
  const point=await page.evaluate(()=>{const s=window.g.scene.getScene('PreloadScene'),o=s.children.getByName('button:重试'),b=o.getBounds(),r=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:r.x+b.centerX*r.width/z.width,y:r.y+b.centerY*r.height/z.height};});
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForFunction(()=>window.g.scene.isActive('MenuScene')&&window.g.scene.getScene('MenuScene').children.list.length);
  report.resources=await page.evaluate(()=>['spring-pasture','summer-pond','autumn-sunset','winter-sunshine','duck-outing','butterfly-path'].map(name=>{const image=window.g.textures.get('scenery-'+name).getSourceImage();return{name,width:image.width,height:image.height};}));
  check(report.resources.every(r=>r.width===600&&r.height===400),'touch retry loads all six runtime postcards at proper dimensions');
  check(await page.evaluate(()=>localStorage.getItem('sheep-run-scenery-v1'))===expected,'retry preserves old and unknown card records');
  check(report.errors.length===0,'no uncaught runtime errors');
  await page.screenshot({path:out+'/retry-menu.png',scale:'css'});report.passed=true;
}catch(e){report.failure=e.stack||String(e);throw e;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors.length}));
