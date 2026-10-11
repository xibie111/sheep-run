import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=new URL('../docs/ambient-life-review/2026-10-11/',import.meta.url);
const report={passed:false,browser:'Edge mobile touch emulation',phoneHardware:false,errors:[]};
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('sheep-run-mailbox-v1','{"version":1,"readIds":["welcome-v1","old-letter"]}');});
  const glob='**/assets/animals-atlas-*.png';await page.route(glob,route=>route.abort());
  const request=page.waitForRequest(r=>/\/assets\/main-[^/]+\.js/.test(r.url()));
  await page.goto(process.env.AMBIENT_QA_URL??'http://127.0.0.1:1894');
  await page.evaluate(async url=>{window.g=(await import(url)).game.instance;},(await request).url());
  await page.waitForFunction(()=>window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
  assert(!await page.evaluate(()=>window.g.scene.isActive('MenuScene')));report.failedLoadBlockedMenu=true;
  const before=await page.evaluate(()=>localStorage.getItem('sheep-run-mailbox-v1'));
  await page.screenshot({path:fileURLToPath(new URL('screenshots/animal-asset-load-failure.png',output)),scale:'css'});
  const tap=async(scene,name)=>{const p=await page.evaluate(({scene,name})=>{const b=window.g.scene.getScene(scene).children.getByName(name).getBounds(),c=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:c.x+b.centerX*c.width/z.width,y:c.y+b.centerY*c.height/z.height};},{scene,name});await page.touchscreen.tap(p.x,p.y);};
  await page.unroute(glob);await tap('PreloadScene','button:重试');
  await page.waitForFunction(()=>window.g.scene.isActive('MenuScene')&&window.g.scene.getScene('MenuScene').children.getByName('button:开始游戏'));
  assert.equal(await page.evaluate(()=>window.g.textures.get('ambient-life-atlas').getFrameNames().length),18);report.recoveredAllFrames=true;
  assert.equal(await page.evaluate(()=>localStorage.getItem('sheep-run-mailbox-v1')),before);report.otherSavePreserved=true;
  await tap('MenuScene','button:开始游戏');await page.waitForFunction(()=>window.g.scene.isActive('RunScene')&&window.g.scene.getScene('RunScene').ambientLife);
  // Only the scene fixture is frozen; resize still uses the production camera/input hooks.
  await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.sys.sceneUpdate=()=>{};s.physics.pause();const a=s.ambientLife;a.nextCheckMs=Infinity;a.noticeVisible=false;window.ctx={nowMs:20000,speed:190,viewport:window.g.scale.gameSize,landscape:s.environmentSystem.presentation(),obstacles:[]};a.update(window.ctx);a.update({...window.ctx,nowMs:22000});window.preResize=s.children.list.filter(o=>o.name.startsWith('ambient-life:')).map(o=>[o.name,o.x,o.y]);});
  await page.setViewportSize({width:800,height:600});await page.waitForFunction(()=>window.g.scale.gameSize.height>300);
  const resize=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');s.ambientLife.update({...window.ctx,nowMs:22000,viewport:window.g.scale.gameSize});return{same:JSON.stringify(window.preResize)===JSON.stringify(s.children.list.filter(o=>o.name.startsWith('ambient-life:')).map(o=>[o.name,o.x,o.y])),state:s.ambientLife.snapshot(),origin:s.cameras.main.scrollY};});
  assert(resize.same&&resize.state.kind&&resize.origin<0);report.resizePreservedWorldAnchors=true;
  await page.screenshot({path:fileURLToPath(new URL('screenshots/animal-retry-resize-dpr1.png',output)),scale:'css'});
  const fatal=await page.evaluate(()=>{const s=window.g.scene.getScene('RunScene');window.oldLife=s.ambientLife;s.onObstacleOverlap();return{finished:s.finished,life:window.oldLife.snapshot()};});
  assert(fatal.finished&&fatal.life.state==='stopped'&&fatal.life.objects===0);report.failureImmediatelyClearsAnimals=true;
  await page.waitForFunction(()=>window.g.scene.isActive('ResultScene'));assert.equal(await page.evaluate(()=>window.oldLife.snapshot().objects),0);report.resultHasNoAnimals=true;
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(new URL('asset-and-resize-review.json',output),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
