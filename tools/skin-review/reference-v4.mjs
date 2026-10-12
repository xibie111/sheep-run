import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless:true, channel:'msedge' });
const context = await browser.newContext({viewport:{width:896,height:414},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const page = await context.newPage(); let main;
page.on('request', r => {if (/\/assets\/main-[^/]+\.js/.test(r.url())) main = r.url();});
try {
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:4333/');
  await page.waitForTimeout(1000);
  await page.evaluate(async url => window.g = (await import(url)).game.instance, main);
  await page.waitForFunction(() => window.g.scene.isActive('MenuScene'));
  const p = await page.evaluate(() => {const s=window.g.scene.getScene('MenuScene'),b=s.children.getByName('button:衣橱').getBounds(),r=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;return{x:r.x+b.centerX*r.width/z.width,y:r.y+b.centerY*r.height/z.height};});
  await page.touchscreen.tap(p.x,p.y);
  await page.waitForFunction(() => window.g.scene.isActive('WardrobeScene'));
  await page.waitForTimeout(200);
  await mkdir('docs/skins-v4',{recursive:true});
  await page.screenshot({path:'docs/skins-v4/wardrobe-before.png'});
} finally {await browser.close();}
