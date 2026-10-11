import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const out = new URL("../../docs/skin-review/2026-10-08/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const report = [];
try {
  for (const [width, height] of [[896,414],[844,390]]) {
    const context = await browser.newContext({ viewport: {width,height}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
    const page = await context.newPage();
    const errors = [], checks = [], skins = [], uiPages = [];
    const note = (label, value = true) => { assert.ok(value,label); checks.push(label); };
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(process.env.SKIN_REVIEW_URL || "http://localhost:4177");
    await page.waitForFunction(async () => {
      const { game } = await import("/src/main.ts"); window.skinGame = game.instance;
      return game.instance.scene.isActive("MenuScene") && game.instance.scene.getScene("MenuScene").children.list.length > 0;
    });
    const frame = () => page.evaluate(() => new Promise((resolve,reject) => {
      const timer = setTimeout(()=>reject(Error("Render stalled")),5000);
      window.skinGame.events.once("postrender",()=>{clearTimeout(timer);resolve();});
    }));
    const active = async key => { await page.waitForFunction(key => window.skinGame.scene.isActive(key) && window.skinGame.scene.getScene(key).children.list.length>0,key); await frame(); };
    const screenshot = async name => { await frame(); await page.screenshot({path:fileURLToPath(new URL(`${name}-${width}x${height}.png`,out))}); };
    const target = async (name,key) => page.evaluate(({name,key}) => {
      const scene = window.skinGame.scene.getScene(key);
      const find = list => { for (const item of list) { if(item.name===name)return item; if(item.list){const found=find(item.list);if(found)return found;} } };
      const item = find(scene.children.list); if(!item)return null;
      const b=item.getBounds(),r=window.skinGame.canvas.getBoundingClientRect(),s=window.skinGame.scale.gameSize;
      return {x:r.x+(b.x+b.width/2)*r.width/s.width,y:r.y+(b.y+b.height/2)*r.height/s.height,disabled:item.getData("disabled"),state:item.getData("state")};
    },{name,key});
    const tap = async (name,key) => { const t=await target(name,key);assert.ok(t,`Missing ${name}`);await page.touchscreen.tap(t.x,t.y);await frame(); };
    const audit = key => page.evaluate(key => {
      const scene=window.skinGame.scene.getScene(key),s=window.skinGame.scale.gameSize,missing=[],clipped=[],cards=[],texts=[];
      const walk=list=>list.forEach(item=>{
        if(item.type==="BitmapText"){
          texts.push(item.text);const font=scene.cache.bitmapFont.get(item.font).data.chars;
          for(const c of item.text)if(c!=="\n"&&!font[c.codePointAt(0)])missing.push(c);
          const b=item.getBounds();if(b.x<-.5||b.y<-.5||b.right>s.width+.5||b.bottom>s.height+.5)clipped.push(item.text);
        }
        if(item.name?.startsWith("skin-card:"))cards.push(item.name.slice(10));
        if(item.list)walk(item.list);
      });walk(scene.children.list);return {missing,clipped,cards,texts};
    },key);
    const save = () => page.evaluate(async () => (await import("/src/systems/SaveSystem.ts")).SaveSystem.load());
    const catalog = await page.evaluate(async () => (await import("/src/data/sheepSkins.ts")).SHEEP_SKINS);
    note("Thirteen distinct skins",catalog.length===13);
    const assets = await page.evaluate(async () => {
      const {SHEEP_SKINS,sheepTextureKey}=await import("/src/data/sheepSkins.ts");
      const {SKIN_ANIMATION_FRAMES}=await import("/src/data/skinSpriteAssets.ts");
      return SHEEP_SKINS.map(({id})=>{
        const texture=window.skinGame.textures.get(sheepTextureKey(id));
        const frames=Array.from({length:15},(_,i)=>{const f=texture.get(i);return {width:f.width,height:f.height,cutX:f.cutX,cutY:f.cutY};});
        const prefix=id==="white"?"sheep":`sheep-${id}`;
        const animations=Object.fromEntries(Object.keys(SKIN_ANIMATION_FRAMES).map(state=>[state,window.skinGame.anims.get(`${prefix}-${state}`).frames.map(f=>Number(f.textureFrame))]));
        return {id,source:[texture.source[0].width,texture.source[0].height],frames,animations};
      });
    });
    for(const asset of assets){
      note(`${asset.id}: local atlas and 15 uniform render frames`,asset.source[0]===640&&asset.source[1]===384&&asset.frames.every(f=>f.width===128&&f.height===112));
      assert.deepEqual(asset.animations,{idle:[0,10],run:[1,2,3,4,11,12],jump:[5],fall:[6],hit:[7],dash:[8,13],dead:[9,14]});
    }
    await screenshot("menu-generated");
    await page.evaluate(async()=>{
      const {SaveSystem}=await import("/src/systems/SaveSystem.ts");
      SaveSystem.save({...SaveSystem.load(),coins:5000,totalStars:100,selectedSkin:"white",unlockedSkins:["white"]});
    });
    await tap("button:衣橱","MenuScene");await active("WardrobeScene");
    for(let n=0;n<3;n++){
      const auditPage=await audit("WardrobeScene");uiPages.push(auditPage);
      note(`Page ${n+1}: local font and bounds`,!auditPage.missing.length&&!auditPage.clipped.length);
      note(`Page ${n+1}: five/five/three cards`,auditPage.cards.length===(n===2?3:5));
      await screenshot(`wardrobe-page-${n+1}`);
      await tap("button:page-next","WardrobeScene");
    }
    note("Paging wraps to original five",(await audit("WardrobeScene")).cards[0]==="white");
    for (const skin of catalog) {
      for(let i=0;!await target(`skin-card:${skin.id}`,"WardrobeScene");i++){assert.ok(i<3);await tap("button:page-next","WardrobeScene");}
      await tap(`skin-card:${skin.id}`,"WardrobeScene");
      const before=await save();
      if(skin.id!=="white"){
        await tap("button:解锁","WardrobeScene");
        const after=await save();
        note(`${skin.id}: purchase uses existing price`,after.coins===before.coins-(skin.unlock.type==="coins"?skin.unlock.amount:0)&&after.unlockedSkins.includes(skin.id));
        await tap("button:装备","WardrobeScene");
      }
      note(`${skin.id}: equipped and persisted`,(await save()).selectedSkin===skin.id&&(await target(`skin-card:${skin.id}`,"WardrobeScene")).state==="equipped");
      const ui=await audit("WardrobeScene");note(`${skin.id}: Chinese text intact`,!ui.missing.length&&!ui.clipped.length);
      await tap("button:返回","WardrobeScene");await active("MenuScene");
      await tap("button:开始游戏","MenuScene");await active("RunScene");
      const geometry=await page.evaluate(()=>{
        const run=window.skinGame.scene.getScene("RunScene"),p=run.sheep,b=p.body;
        const standing={texture:p.texture.key,frame:p.frame.name,frameSize:[p.frame.width,p.frame.height],display:[p.displayWidth,p.displayHeight],scale:[p.scaleX,p.scaleY],width:b.width,height:b.height,bottom:b.bottom,y:p.y};
        const surface=document.createElement("canvas");surface.width=128;surface.height=112;const c=surface.getContext("2d");
        c.drawImage(p.frame.source.image,p.frame.cutX,p.frame.cutY,128,112,0,0,128,112);
        const pixels=c.getImageData(0,0,128,112).data;let last=-1;
        for(let y=0;y<112;y++)for(let x=0;x<128;x++)if(pixels[(y*128+x)*4+3])last=Math.max(last,y);
        standing.visibleFeet=p.y-p.displayHeight+(last+1)*p.scaleY;
        p.setCrouching(true);const crouch={width:b.width,height:b.height,bottom:b.bottom,y:p.y};p.setCrouching(false);
        return {standing,crouch};
      });
      note(`${skin.id}: fixed world hitbox and aligned visible feet`,Math.abs(geometry.standing.width-30)<.001&&Math.abs(geometry.standing.height-30)<.001&&Math.abs(geometry.standing.bottom-218)<.01&&Math.abs(geometry.standing.visibleFeet-218)<.01&&Math.abs(geometry.standing.scale[0]-geometry.standing.scale[1])<.0001);
      note(`${skin.id}: crouch retains fixed geometry`,Math.abs(geometry.crouch.width-30)<.001&&Math.abs(geometry.crouch.height-18)<.001&&Math.abs(geometry.crouch.bottom-218)<.01);
      if(["white","farmer","mint","sunset"].includes(skin.id))await screenshot(`run-${skin.id}`);
      if(["white","mint","sunset"].includes(skin.id)){
        await page.touchscreen.tap(width*.58,height*.45);await frame();
        await page.waitForFunction(()=>{const p=window.skinGame.scene.getScene("RunScene").sheep;return p.motionState==="JUMPING"&&Number(p.frame.name)===5;},null,{timeout:1000});
        const jump=await page.evaluate(()=>{const p=window.skinGame.scene.getScene("RunScene").sheep;return {state:p.motionState,vy:p.body.velocity.y,frame:Number(p.frame.name)};});
        note(`${skin.id}: original touch jump works (${JSON.stringify(jump)})`,jump.vy<0&&jump.state==="JUMPING"&&jump.frame===5);
      }
      skins.push({id:skin.id,geometry});
      await tap("button:暂停","RunScene");await active("PauseScene");
      await tap("button:返回首页","PauseScene");await active("MenuScene");
      await tap("button:衣橱","MenuScene");await active("WardrobeScene");
    }
    await page.reload();
    await page.waitForFunction(async()=>{const {game}=await import("/src/main.ts");window.skinGame=game.instance;return game.instance.scene.isActive("MenuScene");});
    await active("MenuScene");
    note("Equipped extra skin survives reload",(await save()).selectedSkin==="sunset");
    await tap("button:衣橱","MenuScene");await active("WardrobeScene");await screenshot("wardrobe-final");
    const bounds=await page.evaluate(()=>{const r=window.skinGame.canvas.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,pixels:[window.skinGame.canvas.width,window.skinGame.canvas.height],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]};});
    note("Full coverage and no page scroll",bounds.x<=0&&bounds.y<=0&&bounds.x+bounds.w>=width-.01&&bounds.y+bounds.h>=height-.01&&bounds.scroll[0]===width&&bounds.scroll[1]===height);
    note("No JavaScript or asset errors",errors.length===0);
    report.push({width,height,checks,assets,skins,uiPages,bounds,errors});
    console.log(`${width}x${height}: ${checks.length} skin/UI checks passed`);
    await context.close();
  }
  await writeFile(new URL("browser-review.json",out),JSON.stringify({passed:true,viewports:report},null,2));
} finally { await browser.close(); }
