import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url=process.env.UI_TRIM_URL||'http://127.0.0.1:4353/';
const out=process.env.UI_TRIM_OUT?pathToFileURL(resolve(process.env.UI_TRIM_OUT)+sep):new URL('../docs/ui-trim-20261013/browser/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={passed:false,url,phoneHardware:false,method:'Actual Phaser app in isolated mobile touch browsers; local save fixture only. No production user storage.',profiles:[],errors:[]};
try{
  for(const [width,height]of [[480,270],[896,414],[844,390],[800,600]])for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'});
    await context.routeWebSocket('**/*',socket=>{const server=socket.connectToServer();socket.onMessage(m=>server.send(m));server.onMessage(m=>{let p;try{p=JSON.parse(String(m));}catch{}if(!['update','full-reload','prune'].includes(p?.type))socket.send(m);});});
    await context.addInitScript(()=>localStorage.setItem('sheep-run-save',JSON.stringify({version:5,highScore:12345,totalStars:200,spentStars:50,coins:150,selectedSkin:'white',unlockedSkins:['white','black'],upgrades:{jump:0,speed:0,magnet:0,dash:0},settings:{music:false,sfx:false,musicVolume:1,sfxVolume:1}})));
    const page=await context.newPage(),cdp=await context.newCDPSession(page),label=`${width}x${height}-dpr${dpr}`,checks=[];
    page.on('pageerror',e=>report.errors.push({label,error:e.message}));
    const check=(ok,message)=>{assert(ok,`${label}: ${message}`);checks.push(message);};
    const request=page.waitForRequest(r=>/(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(r.url()));
    await page.goto(url,{waitUntil:'domcontentloaded'});const main=(await request).url();
    await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},main);
    await page.waitForFunction(()=>window.g.scene.isActive('MenuScene'));
    const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=2;const f=()=>{if(!--n){window.g.events.off('postrender',f);resolve();}};window.g.events.on('postrender',f);}));
    const find=async(scene,name)=>page.evaluate(({scene,name})=>{
      const s=window.g.scene.getScene(scene),walk=l=>{for(const o of l){if(o.name===name)return o;const c=o.list&&walk(o.list);if(c)return c;}};
      const o=walk(s.children.list);if(!o)return null;const matrix=o.getWorldTransformMatrix(),r=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;
      return {x:r.x+(matrix.tx-s.cameras.main.scrollX*(o.scrollFactorX??1))*r.width/z.width,y:r.y+(matrix.ty-s.cameras.main.scrollY*(o.scrollFactorY??1))*r.height/z.height};
    },{scene,name});
    const tap=async(scene,name)=>{const p=await find(scene,name);assert(p,`missing ${name}`);await page.touchscreen.tap(p.x,p.y);await frames();};
    const cancel=async(scene,name)=>{const p=await find(scene,name);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await frames();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await frames();};
    const shot=async(name)=>{const file=`${label}-${name}.png`;await page.screenshot({path:fileURLToPath(new URL(file,out)),scale:'css'});return file;};
    const overlays=()=>page.evaluate(()=>Object.fromEntries(['collection-album','journey-book'].map(type=>{const c=document.querySelector(`[data-adventure-overlay="${type}"]`);return [type,{...c.dataset,lines:JSON.parse(c.dataset.lines),entry:JSON.parse(c.dataset.entry),panel:JSON.parse(c.dataset.panel)}];})));
    const menu=await overlays(),layout=await page.locator('[data-menu-art]').evaluate(c=>JSON.parse(c.dataset.layout));
    check(!(await find('MenuScene','button:settings'))&&!layout.settings,'gear is absent from input and artwork');
    check(menu['collection-album'].entry.x===8&&menu['collection-album'].entry.y===8,'collection uses former gear corner');
    const a=menu['collection-album'].entry,b=menu['journey-book'].entry;
    check(a.x+a.width<=b.x||a.y+a.height<=b.y,'book touch boxes do not overlap');
    check((b.x+b.width<=layout.title.x||b.y+b.height<=layout.title.y||b.x>=layout.title.x+layout.title.width||b.y>=layout.title.y+layout.title.height),'book buttons clear title');
    for(const type of ['collection-album','journey-book']){
      const {entry,lines}=menu[type],line=lines.find(l=>l.text=== (type==='collection-album'?'收藏册':'成就册'));
      check(line.ink.x>=entry.x+9&&line.ink.x+line.ink.width<=entry.x+entry.width-9&&line.ink.y>=entry.y+26&&line.ink.y+line.ink.height<=entry.y+39,'caption stays inside cream face: '+type);
    }
    const menuShot=await shot('menu');
    await cancel('MenuScene','button:收藏册');check((await overlays())['collection-album'].open==='false','cancelled collection press stays closed');
    await tap('MenuScene','button:收藏册');check((await overlays())['collection-album'].open==='true','collection opens through touch');
    check(await page.evaluate(()=>window.g.scene.getScene('MenuScene').children.getByName('button:开始游戏').input.enabled===false),'collection blocks main menu touches');
    let state=(await overlays())['collection-album'];for(const l of state.lines)check(l.ink.x>=state.panel.x&&l.ink.x+l.ink.width<=state.panel.x+state.panel.width+1&&l.ink.y+l.ink.height<=state.panel.y+state.panel.height+1,'collection text stays in panel');
    const collectionShot=await shot('collection');await tap('MenuScene','button:合上收藏册');
    await cancel('MenuScene','button:成就册');check((await overlays())['journey-book'].open==='false','cancelled journey press stays closed');
    await tap('MenuScene','button:成就册');check((await overlays())['journey-book'].open==='true','journey opens through touch');
    state=(await overlays())['journey-book'];for(const l of state.lines)check(l.ink.x>=state.panel.x&&l.ink.x+l.ink.width<=state.panel.x+state.panel.width+1&&l.ink.y+l.ink.height<=state.panel.y+state.panel.height+1,'journey text stays in panel');
    const journeyShot=await shot('journey');await tap('MenuScene','button:合上手账');
    await tap('MenuScene','button:衣橱');await page.waitForFunction(()=>window.g.scene.isActive('WardrobeScene'));
    const wardrobe=()=>page.evaluate(()=>{const s=window.g.scene.getScene('WardrobeScene'),all=[];const walk=l=>{for(const o of l){all.push(o);if(o.list)walk(o.list);}};walk(s.children.list);return {texts:all.filter(o=>o.type==='BitmapText'&&o.text).map(o=>({name:o.name,text:o.text,x:o.x,y:o.y})),images:all.filter(o=>o.type==='Image').map(o=>({key:o.texture.key,x:o.x,y:o.y})),buttons:all.filter(o=>o.name?.startsWith('button:')).map(o=>({name:o.name,enabled:!!o.input?.enabled}))};});
    let w=await wardrobe();check(!w.texts.some(t=>['金币','可用星星','左右切换装扮','已拥有，可随时装备'].includes(t.text)),'removed static hints are absent');
    check(w.texts.some(t=>t.name==='wardrobe-available-stars'&&t.text==='150')&&w.texts.some(t=>t.name==='wardrobe-coins'&&t.text==='150'),'true currency values remain');
    check(!w.texts.some(t=>t.y===213)&&!w.images.some(i=>i.x===82&&i.y===214),'large preview status control is absent');
    check(w.buttons.some(b=>b.name==='button:已装备'&&!b.enabled),'equipped main action remains disabled');
    const wardrobeShot=await shot('wardrobe');
    await tap('WardrobeScene','skin-card:black');w=await wardrobe();check(!w.texts.some(t=>t.name==='wardrobe-price-explanation'),'owned skin has no redundant explanation');
    await tap('WardrobeScene','button:装备');w=await wardrobe();check(w.texts.some(t=>t.name==='wardrobe-feedback'&&t.text==='已换上这套装扮'),'real equip feedback remains');
    await tap('WardrobeScene','skin-card:brown');w=await wardrobe();check(w.texts.some(t=>t.name==='wardrobe-price-explanation'&&t.text.includes('30')),'locked skin keeps truthful unlock requirement');
    await tap('WardrobeScene','button:返回');await page.waitForFunction(()=>window.g.scene.isActive('MenuScene'));await frames();
    check((await overlays())['collection-album'].entry.x===8&&!(await find('MenuScene','button:settings')),'returning restores new corner entries without gear');
    const bounds=await page.evaluate(()=>{const c=window.g.canvas.getBoundingClientRect();return {x:c.x,y:c.y,right:c.right,bottom:c.bottom,w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollHeight>innerHeight};});
    check(bounds.x<=1&&bounds.y<=1&&bounds.right>=width-1&&bounds.bottom>=height-1&&!bounds.scroll,'canvas still covers viewport without page scroll');
    report.profiles.push({width,height,dpr,main,checks,menu,shots:[menuShot,collectionShot,journeyShot,wardrobeShot]});await context.close();
  }
  assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));throw e;}
finally{await writeFile(new URL('report.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:report.passed,profiles:report.profiles.length,checks:report.profiles.reduce((n,p)=>n+p.checks.length,0),errors:report.errors}));}
