import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve, sep} from 'node:path';
const {chromium} = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.DELIVERY_RETRY_URL || 'http://127.0.0.1:4342/';
const output = process.env.DELIVERY_RETRY_OUT ? pathToFileURL(resolve(process.env.DELIVERY_RETRY_OUT)+sep) : new URL('../../docs/delivery-expansion-v1/asset-retry/', import.meta.url);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,channel:'msedge'});
const report = {passed:false, url:base, phoneHardware:false, method:'Actual PreloadScene touch error/retry with intercepted new runtime PNG responses; isolated browser storage only.', cases:[], errors:[]};
try {
  for(const item of [
    {file:'windmill-pasture.png', key:'delivery-expansion-windmill-pasture', mode:'missing'},
    {file:'rain-ordinary.png', key:'delivery-expansion-rain-ordinary', mode:'missing'},
    {file:'lighthouse-postcard.png', key:'delivery-expansion-lighthouse-postcard', mode:'bad-size'},
    {file:'rating-gold.png', key:'delivery-expansion-ui-rating-gold', mode:'missing'},
  ]) {
    const context = await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true});
    let broken = true, requests = 0;
    // Vite development uses original names; production adds a content hash.
    // A final .png glob also excludes Vite's ?import&url module requests.
    await context.route('**/' + item.file.replace(/\.png$/, '') + '*.png', async route => {
      requests++;
      if(!broken) return route.continue();
      if(item.mode==='missing') return route.abort('failed');
      // A valid 1x1 PNG tests texture dimensions rather than only network failure.
      return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3McAAAAASUVORK5CYII=','base64')});
    });
    const page = await context.newPage(); page.on('pageerror',error=>report.errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('sheep-run-delivery-v1',JSON.stringify({version:1,completedIds:['hill-goodnight-v1','future-chapter-v9']})));
    const request = page.waitForRequest(r=>/(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(r.url()));
    await page.goto(base,{waitUntil:'domcontentloaded'}); const main = (await request).url();
    await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},main);
    await page.waitForFunction(()=>window.g.scene.getScene('PreloadScene').children.getByName('local-load-error'));
    assert.equal(await page.evaluate(()=>window.g.scene.isActive('MenuScene')),false);
    const invalidSource = await page.evaluate(key => {
      if (!window.g.textures.exists(key)) return null;
      const image = window.g.textures.get(key).getSourceImage();
      return {width:image.width,height:image.height};
    },item.key);
    if(item.mode==='bad-size') assert.deepEqual(invalidSource,{width:1,height:1});
    const before=await page.evaluate(()=>localStorage.getItem('sheep-run-delivery-v1'));
    const point=await page.evaluate(()=>{
      const s=window.g.scene.getScene('PreloadScene'),b=s.children.getByName('button:重试').getBounds(),c=window.g.canvas.getBoundingClientRect(),z=window.g.scale.gameSize;
      return {x:c.x+b.centerX*c.width/z.width,y:c.y+b.centerY*c.height/z.height};
    });
    await page.screenshot({path:fileURLToPath(new URL(item.key+'-error.png',output)),scale:'css'});
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await page.evaluate(()=>window.g.scene.isActive('MenuScene')),false);
    broken=false; await page.touchscreen.tap(point.x,point.y);
    await page.waitForFunction(()=>window.g.scene.isActive('MenuScene'));
    const after=await page.evaluate(()=>localStorage.getItem('sheep-run-delivery-v1'));
    assert.equal(after,before); assert.ok(requests>=2);
    const facts=await page.evaluate(key=>{
      const t=window.g.textures.get(key),i=t.getSourceImage();
      return {width:i.width,height:i.height,filter:t.source[0].scaleMode,oldError:!!window.g.scene.getScene('PreloadScene').children.getByName('local-load-error')};
    },item.key);
    assert.equal(facts.filter,1); assert.equal(facts.oldError,false);
    assert.ok(facts.width>1&&facts.height>1);
    report.cases.push({...item,main,requests,invalidSource,facts,oldAndUnknownCompletionBytesRetained:before===after,cancelDidNotRetry:true,touchRetryRestoredMenu:true});
    await page.screenshot({path:fileURLToPath(new URL(item.key+'-restored.png',output)),scale:'css'});
    await context.close();
  }
  assert.equal(report.errors.length,0); report.passed=true;
} catch(error) {report.errors.push(error.stack||String(error));throw error;}
finally {await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');await browser.close();process.stdout.write(JSON.stringify(report)+'\n');}
