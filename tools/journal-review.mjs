import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const {chromium}=createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const url=process.env.JOURNAL_REVIEW_URL||"http://127.0.0.1:4198",production=process.argv.includes("--production");
const output=new URL("../docs/journal-review/2026-10-11/",import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"msedge"});
const report={url,production,phoneHardware:false,engine:"Edge Chromium mobile touch emulation",fixtures:"Isolated browser storage and explicit run event fixtures only; no production acceleration",checks:[],errors:[],screenshots:[]};
const check=(value,label)=>{assert(value,label);report.checks.push(label);};
const badges=["spring-flower","spring-butterfly","spring-clover","summer-sunflower","summer-watermelon","summer-shell","autumn-maple","autumn-acorn","autumn-pumpkin","winter-snowflake","winter-mitten","winter-cocoa"];
async function open(width,height,collected=[],skins=["white"]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true});const page=await context.newPage();
  page.on("pageerror",e=>report.errors.push(e.message));
  await page.addInitScript(({collected,skins})=>{
    if(localStorage.getItem("sheep-run-save")===null)localStorage.setItem("sheep-run-save",JSON.stringify({version:4,highScore:0,totalStars:0,coins:0,selectedSkin:"white",unlockedSkins:skins,upgrades:{jump:0,speed:0,magnet:0,dash:0},settings:{music:false,sfx:false,musicVolume:1,sfxVolume:1}}));
    if(localStorage.getItem("sheep-run-collections-v1")===null)localStorage.setItem("sheep-run-collections-v1",JSON.stringify({version:1,badges:collected}));
  },{collected,skins});
  const request=page.waitForRequest(r=>new RegExp(production?"/assets/main-[^/]+\\.js":"/src/main\\.ts").test(r.url()));await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},(await request).url());
  await page.waitForFunction(()=>window.g.scene.isActive("MenuScene")&&window.g.scene.getScene("MenuScene").children.list.length>0);
  return {context,page,width,height};
}
async function tap(f,sceneKey,name){
  const p=await f.page.evaluate(({sceneKey,name})=>{const scene=window.g.scene.getScene(sceneKey),o=scene.children.getByName(name);if(!o)throw Error(`Missing ${name}`);const b=o.getBounds(),r=window.g.canvas.getBoundingClientRect(),s=window.g.scale.gameSize;return{x:r.x+(b.centerX-scene.cameras.main.scrollX*o.scrollFactorX)*r.width/s.width,y:r.y+(b.centerY-scene.cameras.main.scrollY*o.scrollFactorY)*r.height/s.height};},{sceneKey,name});await f.page.touchscreen.tap(p.x,p.y);await f.page.waitForTimeout(80);
}
async function shot(f,name){const file=`${f.width}x${f.height}-${production?"production-":""}${name}.png`;await f.page.screenshot({path:fileURLToPath(new URL(file,output))});report.screenshots.push(file);}
const data=(f,kind)=>f.page.locator(`[data-adventure-overlay="${kind}"]`).evaluate(c=>({...c.dataset}));
async function checkInk(f,kind){const d=await data(f,kind),lines=JSON.parse(d.lines);for(const l of lines)check(l.ink.x>=l.box.x-1&&l.ink.y>=l.box.y-1&&l.ink.x+l.ink.width<=l.box.x+l.box.width+1&&l.ink.y+l.ink.height<=l.box.y+l.box.height+1,`${f.width}x${f.height} ${kind}: ${l.text} fits`);}
try{
  for(const [w,h]of(process.argv.includes("--events")?[]:process.argv.includes("--baseline")?[[960,540]]:[[896,414],[844,390],[800,600]])){
    const f=await open(w,h,badges,["white","black","brown","golden","farmer"]);
    await shot(f,"menu-unread");await tap(f,"MenuScene","button:收藏册");await checkInk(f,"collection-album");
    check(JSON.parse((await data(f,"collection-album")).rewards).all!==undefined,`${w}: historical badges backfill permanent rewards`);
    for(const season of["spring","summer","autumn","winter"]){await tap(f,"MenuScene",`collection-tab:${season}`);await tap(f,"MenuScene","collection-reward");check((await data(f,"journey-book")).reward===season&& (await data(f,"journey-book")).open==="true",`${w}: opens ${season} illustration`);await checkInk(f,"journey-book");await shot(f,`${season}-letter`);await tap(f,"MenuScene","button:合上手账");}
    await tap(f,"MenuScene","collection-complete-reward");await shot(f,"four-seasons-cover");
    for(let i=0;i<3;i++){await tap(f,"MenuScene","journey-next");await checkInk(f,"journey-book");await shot(f,`complete-letter-${i+1}`);}
    check(await f.page.evaluate(()=>JSON.parse(localStorage.getItem("sheep-run-journey-v1")).readRewards.includes("all")),`${w}: full letter read marker saved`);
    await tap(f,"MenuScene","button:合上手账");await tap(f,"MenuScene","button:合上收藏册");await tap(f,"MenuScene","button:成就册");
    await checkInk(f,"journey-book");await shot(f,"achievements-page-1");await tap(f,"MenuScene","journey-next");await checkInk(f,"journey-book");await shot(f,"achievements-page-2");
    check(Object.keys(JSON.parse((await data(f,"journey-book")).achieved)).join()==="five-skins",`${w}: only historical skins backfilled, no invented run stats`);
    await tap(f,"MenuScene","achievement-card:3");await checkInk(f,"journey-book");await shot(f,"skin-stamp-detail");
    const gameplay=await f.page.evaluate(()=>localStorage.getItem("sheep-run-save"));check(JSON.parse(gameplay).coins===0&&JSON.parse(gameplay).totalStars===0,`${w}: books award no currency`);
    await f.context.close();
  }
  if(!production){
    const f=await open(844,390,badges.slice(0,2));await tap(f,"MenuScene","button:收藏册");await shot(f,"spring-two-of-three");check(await f.page.evaluate(()=>!window.g.scene.getScene("MenuScene").children.getByName("collection-reward").input.enabled),"2/3 envelope stays locked");
    await tap(f,"MenuScene","button:合上收藏册");await tap(f,"MenuScene","button:开始游戏");await f.page.waitForFunction(()=>window.g.scene.isActive("RunScene"));
    await f.page.evaluate(()=>{const r=window.g.scene.getScene("RunScene");r.spawnSystem.update=()=>[];r.obstacles.getChildren().forEach(o=>o.deactivate());r.scoreSystem.distance=1200;});
    await f.page.waitForFunction(()=>window.g.scene.getScene("RunScene").hiddenCollections.badge?.id==="spring-clover");
    await f.page.evaluate(()=>{const r=window.g.scene.getScene("RunScene");r.hiddenCollections.image.x=r.sheep.x;});
    await f.page.waitForFunction(()=>JSON.parse(localStorage.getItem("sheep-run-collections-v1")).badges.includes("spring-clover"));
    await f.page.waitForFunction(()=>document.querySelector('[data-adventure-overlay="collection-toast"]').dataset.message?.includes("收藏完成"));await shot(f,"last-badge-delivery");
    check((await data(f,"collection-toast")).message.includes("收藏完成"),"last badge announces delivered letter");
    await tap(f,"RunScene","button:暂停");await f.page.waitForFunction(()=>window.g.scene.isPaused("RunScene"));const paused=await f.page.evaluate(()=>[window.g.scene.getScene("RunScene").activeRunTimeMs,localStorage.getItem("sheep-run-journey-v1")]);await f.page.waitForTimeout(650);check(JSON.stringify(paused)===JSON.stringify(await f.page.evaluate(()=>[window.g.scene.getScene("RunScene").activeRunTimeMs,localStorage.getItem("sheep-run-journey-v1")])),"paused run freezes time and achievement progression");
    await tap(f,"PauseScene","button:继续游戏");
    await f.page.evaluate(async()=>{
      const r=window.g.scene.getScene("RunScene"),{WoodFence}=await import("/src/game/ObstacleDefinitions.ts");
      const {obstacleGap}=await import("/src/systems/ObstaclePatterns.ts"),{runViewportRight,viewportSizeFromScale}=await import("/src/game/Viewport.ts"),{PLAYER}=await import("/src/game/Constants.ts");
      r.powerUpSystem.activate("starMultiplier",r.activeRunTimeMs);
      for(let i=0;i<10;i++){const star=r.acquireStar();star.activate(400,100,0,r.speed);r.onStarOverlap(star);r.onStarOverlap(star);}
      for(let i=0;i<20;i++){const o=r.acquireObstacle(WoodFence,0);o.activate(10,0,r.speed,"spring");r.moveObjects(0);o.deactivate();}
      const last=r.obstacles.getChildren()[0],behind=PLAYER.width+r.speed*.95,ahead=PLAYER.width/2+11+r.speed*.4;
      const trailing=(behind+obstacleGap(r.speed,r.upgradeEffects.jumpImpulseMultiplier,true)-4-ahead)/2;
      last.x=runViewportRight(viewportSizeFromScale(r.scale))+14-trailing-last.definition.width;
      r.companions.observeObstacleSpawn({type:"obstacle",definition:WoodFence,phase:0,pattern:{id:"single",index:0,length:1}},last);
      r.activeRunTimeMs+=25001;
    });
    await f.page.waitForFunction(()=>window.g.scene.getScene("RunScene").companions.bell);
    await f.page.evaluate(()=>{const r=window.g.scene.getScene("RunScene");r.companions.bell.image.x=r.sheep.x;});
    await f.page.waitForFunction(()=>JSON.parse(localStorage.getItem("sheep-run-journey-v1")).summons===1);
    await f.page.evaluate(()=>{const r=window.g.scene.getScene("RunScene");for(const score of[6000,7500,9000,10500]){r.scoreSystem.distance=score-r.scoreSystem.bonus;r.update(0,0);}r.time.timeScale=40;});
    await f.page.waitForTimeout(200);check(await f.page.evaluate(()=>JSON.parse(localStorage.getItem("sheep-run-journey-v1")).summons)===1,"real bell pickup observer counts exactly one summon");
    const live=await f.page.evaluate(()=>{const r=window.g.scene.getScene("RunScene");return{stars:r.scoreSystem.starCount,journal:JSON.parse(localStorage.getItem("sheep-run-journey-v1"))};});
    check(live.stars===10&&live.journal.stars===10,"double-star and duplicate overlaps still count ten actual stars");check(Boolean(live.journal.achieved["twenty-obstacles"]),"twenty actual passed obstacle hooks unlock stamp");
    await f.page.waitForFunction(()=>{const c=document.querySelector('[data-adventure-overlay="journey-toast"]');return c.style.display==="block"&&c.dataset.message?.includes("点亮");});
    await f.page.evaluate(()=>{window.g.scene.getScene("RunScene").time.timeScale=1;});check((await data(f,"journey-toast")).message.includes("点亮"),"short achievement notice waits until private letters finish");await shot(f,"achievement-run-notice");
    await f.page.evaluate(()=>window.g.scene.getScene("RunScene").onObstacleOverlap());await f.page.waitForFunction(()=>window.g.scene.isActive("ResultScene"));await shot(f,"merged-result");
    check((await data(f,"journey-book")).lines.includes("本局点亮 6 枚印章"),"one merged result entrance for six achievements");
    await tap(f,"ResultScene","button:本局成就");await shot(f,"merged-result-book");check(JSON.parse((await data(f,"journey-book")).achieved)["first-run"]!==undefined,"first finished run included in result book");
    for(let i=0;i<3;i++){await f.page.evaluate(()=>window.g.scene.getScenes(true).find(s=>["ResultScene","MenuScene"].includes(s.sys.settings.key)).scene.start("RunScene"));await f.page.waitForTimeout(150);await f.page.evaluate(()=>window.g.scene.getScene("RunScene").scene.start("MenuScene"));await f.page.waitForTimeout(150);check(await f.page.locator('[data-adventure-overlay="journey-book"]').count()===1,`restart ${i+1}: no book overlay residue`);check(await f.page.locator('[data-adventure-overlay="journey-toast"]').count()===0,`restart ${i+1}: no run toast residue`);}
    await tap(f,"MenuScene","button:收藏册");await tap(f,"MenuScene","collection-reward");await shot(f,"reward-after-restarts");check((await data(f,"journey-book")).open==="true","season reward remains accessible after repeated restarts");
    await f.page.reload();await f.page.evaluate(async()=>{window.g=(await import("/src/main.ts")).game.instance;});await f.page.waitForFunction(()=>window.g.scene.isActive("MenuScene"));await tap(f,"MenuScene","button:收藏册");await tap(f,"MenuScene","collection-reward");check((await data(f,"journey-book")).open==="true","reward and badge persist across full page reload");await shot(f,"reward-after-reload");
    await f.context.close();
    const natural=await open(896,414);await tap(natural,"MenuScene","button:开始游戏");await natural.page.waitForFunction(()=>window.g.scene.isActive("ResultScene"),null,{timeout:30000});
    check(JSON.parse((await data(natural,"journey-book")).achieved)["first-run"]!==undefined,"natural unmodified run unlocks first finish");await shot(natural,"natural-first-result");await tap(natural,"ResultScene","button:本局成就");await checkInk(natural,"journey-book");await shot(natural,"natural-first-stamps");await natural.context.close();
  }
  check(report.errors.length===0,"no browser runtime errors");
}catch(error){report.failure=error.stack;throw error;}finally{await writeFile(new URL(process.argv.includes("--baseline")?"baseline-verification.json":production?"production-verification.json":process.argv.includes("--events")?"browser-event-verification.json":"browser-verification.json",output),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors}));
