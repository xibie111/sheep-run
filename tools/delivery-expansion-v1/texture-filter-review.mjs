import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.DELIVERY_FILTER_URL||'http://127.0.0.1:4344/';
const output=new URL('../../docs/delivery-expansion-v1/production-filter/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={passed:false,url:base,phoneHardware:false,method:'Actual production AUTO game, headless Edge software WebGL. Read actual sampler min/mag and restore previous binding. No filter assignments, gameplay mutations or render-config replacement.',profiles:[],errors:[]};
try {
  for(const [width,height]of [[480,270],[896,414],[844,390],[800,600]])for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    const request=page.waitForRequest(r=>/(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(r.url()));
    await page.goto(base,{waitUntil:'domcontentloaded'});const main=(await request).url();
    await page.evaluate(async main=>{window.g=(await import(main)).game.instance;},main);
    await page.waitForFunction(()=>window.g.scene.isActive('MenuScene'));
    const state=await page.evaluate(()=>{
      const gl=window.g.renderer.gl;if(!gl)return {renderer:window.g.renderer.type,webgl:false};
      const old=gl.getParameter(gl.TEXTURE_BINDING_2D);
      const results=Object.entries(window.g.textures.list).filter(([key])=>key.startsWith('delivery-expansion-')).map(([key,texture])=>{
        const source=texture.source[0];gl.bindTexture(gl.TEXTURE_2D,source.glTexture.webGLTexture);
        const min=gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER),mag=gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER);
        return {key,mode:source.scaleMode,min,mag,passed:source.scaleMode===1&&min===gl.NEAREST&&mag===gl.NEAREST};
      });
      gl.bindTexture(gl.TEXTURE_2D,old);
      return {renderer:window.g.renderer.type,webgl:true,glNearest:gl.NEAREST,results};
    });
    report.profiles.push({width,height,dpr,main,...state});assert.equal(state.webgl,true);
    assert.equal(state.results.length,36);assert.ok(state.results.every(r=>r.passed));
    await context.close();
  }
  assert.equal(report.errors.length,0);report.passed=true;
}catch(error){report.errors.push(error.stack||String(error));throw error;}
finally{await writeFile(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:report.passed,profiles:report.profiles.length,texturesPerProfile:36,errors:report.errors}));}
