import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const output = new URL("../../docs/android-build/2026-10-10/fullscreen/", import.meta.url);
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:"msedge"});
const report = [];
try {
  for (const [width,height] of [[896,414],[915,412],[800,360],[1672,941],[800,600]]) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    const page = await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("http://127.0.0.1:5177/");
    await page.waitForSelector("#loading-screen", { state: "hidden" });
    await page.evaluate(async()=>{
      const {game}=await import("/src/main.ts");
      window.reviewGame=game.instance;
      return game.instance.scene.isActive("MenuScene") && game.instance.scene.getScene("MenuScene").children.list.length > 0;
    });
    await page.evaluate(()=>{
      const style=document.documentElement.style;
      style.setProperty("--safe-area-inset-left","36px");
      style.setProperty("--safe-area-inset-right","18px");
      style.setProperty("--safe-area-inset-top","0px");
      style.setProperty("--safe-area-inset-bottom","0px");
      window.dispatchEvent(new Event("resize"));
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const inspect = async()=>page.evaluate(async()=>{
      const game=window.reviewGame, r=game.canvas.getBoundingClientRect();
      const scene=game.scene.getScene(game.scene.isActive("RunScene") ? "RunScene" : "MenuScene");
      const {safeUiInsets}=await import("/src/ui/UiLayout.ts");
      return {canvas:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
        logical:{width:game.scale.gameSize.width,height:game.scale.gameSize.height},
        safe:safeUiInsets(scene),
        cssLeft:getComputedStyle(document.documentElement).getPropertyValue("--safe-left").trim(),
        scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};
    });
    const check = data=>{
      assert(data.canvas.x<=0.1 && data.canvas.y<=0.1 && data.canvas.right>=width-0.1 && data.canvas.bottom>=height-0.1,"all edges covered");
      assert(Math.abs(data.canvas.width/data.logical.width-data.canvas.height/data.logical.height)<0.0001,"uniform scaling");
      assert.equal(data.cssLeft,"36px","native cutout inset reaches UI");
      assert(data.safe.left>data.safe.right && data.safe.right>0,"UI respects both cutout sides");
      assert.deepEqual(data.scroll,[width,height]);
    };
    const menu=await inspect(); check(menu);
    await page.screenshot({path:fileURLToPath(new URL("menu-"+width+"x"+height+".png",output))});
    const target=await page.evaluate(()=>{
      const game=window.reviewGame,scene=game.scene.getScene("MenuScene");
      const walk=list=>{
        for (const object of list) {
          if (object.name==="button:开始游戏") return object;
          if (object.list) {const found=walk(object.list);if(found)return found;}
        }
      };
      const button=walk(scene.children.list);
      if(!button) throw Error("Start touch target missing: " + JSON.stringify(scene.children.list.map(o => o.name)));
      const b=button.getBounds(),r=game.canvas.getBoundingClientRect(),s=game.scale.gameSize;
      return {x:r.x+b.centerX*r.width/s.width,y:r.y+b.centerY*r.height/s.height};
    });
    await page.touchscreen.tap(target.x,target.y);
    await page.waitForFunction(()=>window.reviewGame.scene.isActive("RunScene"));
    const run=await inspect();check(run);
    await page.screenshot({path:fileURLToPath(new URL("run-"+width+"x"+height+".png",output))});
    assert.deepEqual(errors,[]);
    report.push({width,height,menu,run,touchStart:true,errors});
    await context.close();
  }
  await writeFile(new URL("verification.json",output),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({viewportCases:report.length,fullCanvasCoverage:true,cutoutInsetsReachUI:true,touchStart:true}));
} finally {await browser.close();}




