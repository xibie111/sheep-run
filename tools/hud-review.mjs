import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../docs/hud-review/2026-10-09/", import.meta.url);
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:"msedge"});
const report = [];
try {
for(const [width,height,dpr] of [[1672,941,1],[896,414,1],[800,600,1],[390,844,2]]) {
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:dpr});
 const page=await context.newPage(); const errors=[];
 page.on("pageerror",e=>{errors.push(e.message);console.error(e.stack);});
 page.on("console",m=>{if(m.type()==="error" && !m.text().startsWith("Ignored attempt to cancel"))errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.setItem("sheep-run-save",JSON.stringify({version:4,highScore:12345,totalStars:0,coins:0,selectedSkin:"white",unlockedSkins:["white"],upgrades:{jump:0,speed:0,magnet:0,dash:0},settings:{music:false,sfx:false,musicVolume:0,sfxVolume:0}}));});
 await page.goto(process.env.HUD_REVIEW_URL || "http://localhost:4193/");
 await page.evaluate(async()=>{window.reviewGame=(await import("/src/main.ts")).game.instance;});
 const ready=async key=>page.waitForFunction(key=>{const g=window.reviewGame,s=g.scene.getScene(key);return g.scene.isActive(key)&&s.children.list.length>0;},key);
 const frame=async()=>page.evaluate(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("render stalled")),5000);window.reviewGame.events.once("postrender",()=>{clearTimeout(timer);resolve();});}));
 const tap=async(key,name)=>{
   const p=await page.evaluate(({key,name})=>{const g=window.reviewGame,o=g.scene.getScene(key).children.list.find(o=>o.name===name);if(!o)throw Error("missing "+name);const b=o.getBounds(),r=g.canvas.getBoundingClientRect(),s=g.scale.gameSize;return{x:r.x+b.centerX*r.width/s.width,y:r.y+b.centerY*r.height/s.height};},{key,name});
   await page.touchscreen.tap(p.x,p.y); await frame();
 };
 const shot=async name=>{await frame();await page.screenshot({path:fileURLToPath(new URL(name+"-"+width+"x"+height+".png",output))});};
 const checks=[];const check=(name,pass)=>{assert.ok(pass,name);checks.push(name);};
 const fonts=async key=>page.evaluate(key=>{const g=window.reviewGame,flatten=o=>[o,...(o.list||[]).flatMap(flatten)],objects=g.scene.getScene(key).children.list.flatMap(flatten);return{system:objects.filter(o=>o.type==="Text").map(o=>o.text),bitmap:objects.filter(o=>o.type==="BitmapText").map(o=>({text:o.text,font:o.font}))};},key);
 await ready("MenuScene"); await shot("menu");
 await tap("MenuScene","button:开始游戏");await ready("RunScene");
 await frame();
 const first=await page.evaluate(()=>JSON.parse(document.querySelector("[data-run-hud-art]").dataset.values));
 await page.evaluate(()=>{const s=window.reviewGame.scene.getScene("RunScene");for(let i=0;i<12;i++){const star=s.acquireStar();star.activate(350,150,0,s.speed);s.onStarOverlap(star);}});
 await frame();
 const audit=await page.evaluate(()=>{
   const g=window.reviewGame,c=document.querySelector("[data-run-hud-art]"),r=g.canvas.getBoundingClientRect(),layout=JSON.parse(c.dataset.layout);
   const panels=Object.values(layout);
   return{layout,values:JSON.parse(c.dataset.values),size:{width:g.scale.gameSize.width,height:g.scale.gameSize.height},backing:{width:c.width,height:c.height},css:{width:r.width,height:r.height},
     inBounds:panels.every(p=>p.x>=0&&p.y>=0&&p.x+p.width<=g.scale.gameSize.width&&p.y+p.height<=g.scale.gameSize.height),
     spaced:layout.score.x+layout.score.width<layout.stars.x&&layout.stars.x+layout.stars.width<layout.best.x&&layout.best.x+layout.best.width<g.scale.gameSize.width-52,
     fontKeys:g.cache.bitmapFont.getKeys(),interactive:!!getComputedStyle(c).pointerEvents && getComputedStyle(c).pointerEvents!=="none"};
 });
 check("three matching plaques fit without overlap",audit.inBounds&&audit.spaced);
 check("live score advances and star awards update HUD",audit.values.score>first.score&&audit.values.stars===12);
 check("HUD pixels preserve uniform generated frame ratios",Math.abs(audit.layout.score.width/audit.layout.score.height-1018/343)<1e-7&&Math.abs(audit.layout.stars.width/audit.layout.stars.height-818/248)<1e-7);
 check("screen resolution includes device pixel ratio",audit.backing.width===Math.ceil(audit.css.width*dpr)&&audit.backing.height===Math.ceil(audit.css.height*dpr));
 check("HUD lets touches reach Phaser",!audit.interactive);
 check("only one typeface family loads",audit.fontKeys.length===4&&audit.fontKeys.every(key=>key.startsWith("pasture-display-")));
 check("HUD shows the persisted record",audit.values.best===12345);
 check("run has no system text",!(await fonts("RunScene")).system.length);
 await shot("run");
 await tap("RunScene","button:暂停");await ready("PauseScene");await shot("pause");
 check("paused HUD dims and freezes",await page.evaluate(()=>{const c=document.querySelector("[data-run-hud-art]");return c.dataset.paused==="true"&&window.reviewGame.scene.isPaused("RunScene");}));
 const frozen=await page.evaluate(()=>document.querySelector("[data-run-hud-art]").dataset.values);await frame();
 check("paused values remain stable",frozen===await page.evaluate(()=>document.querySelector("[data-run-hud-art]").dataset.values));
 await page.setViewportSize({width:800,height:600});await frame();await frame();
 check("paused resize aligns HUD canvas",await page.evaluate(()=>{const c=document.querySelector("[data-run-hud-art]"),g=window.reviewGame,r=g.canvas.getBoundingClientRect();return JSON.parse(c.dataset.layout).stars.x===g.scale.gameSize.width/2-41&&Math.abs(c.getBoundingClientRect().width-r.width)<1;}));
 await page.setViewportSize({width,height});await frame();await frame();
 await tap("PauseScene","button:重新开始");await ready("RunScene");await frame();
 check("restart creates one clean HUD and resets stars",await page.evaluate(()=>document.querySelectorAll("[data-run-hud-art]").length===1&&JSON.parse(document.querySelector("[data-run-hud-art]").dataset.values).stars===0));
 await tap("RunScene","button:暂停");await ready("PauseScene");await tap("PauseScene","button:返回首页");await ready("MenuScene");
 check("home removes run HUD",await page.evaluate(()=>!document.querySelector("[data-run-hud-art]")));
 await tap("MenuScene","button:衣橱");await ready("WardrobeScene");await shot("wardrobe");
 const wardrobe=await fonts("WardrobeScene");
 check("wardrobe labels all use common bitmap face",!wardrobe.system.length&&wardrobe.bitmap.length>0&&wardrobe.bitmap.every(o=>o.font.startsWith("pasture-display-")));
 await tap("WardrobeScene","button:返回");await ready("MenuScene");
 await page.evaluate(()=>window.reviewGame.scene.getScene("MenuScene").scene.start("ResultScene",{score:12345,best:12345,newRecord:true,coinsEarned:617,coinBalance:617}));
 await ready("ResultScene");await shot("result");
 const result=await fonts("ResultScene");
 check("result labels and numbers all use common bitmap face",!result.system.length&&result.bitmap.every(o=>o.font.startsWith("pasture-display-")));
 check("font atlases cover every rendered string",await page.evaluate(()=>{const g=window.reviewGame,all=o=>[o,...(o.list||[]).flatMap(all)];return["RunScene","WardrobeScene","ResultScene"].every(key=>g.scene.getScene(key).children.list.flatMap(all).filter(o=>o.type==="BitmapText").every(o=>[...o.text].every(ch=>ch==="\n"||g.cache.bitmapFont.get(o.font).data.chars[ch.codePointAt(0)])));}));
 check("no browser errors",errors.length===0);
 report.push({viewport:{width,height,dpr},audit,wardrobeFonts:wardrobe.bitmap,resultFonts:result.bitmap,checks,errors});
 await context.close();
}
await writeFile(new URL("acceptance.json",output),JSON.stringify({passed:true,report},null,2)+"\n");
console.log(JSON.stringify({passed:true,viewports:report.length,checks:report.reduce((n,r)=>n+r.checks.length,0)}));
} finally {await browser.close();}
