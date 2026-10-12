import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const output=process.env.CONTENT_V2_QA_OUT??'docs/content-update-v2/filter-fix'; await mkdir(output,{recursive:true});
const report={passed:false,environment:'Actual Phaser WEBGL renderer in headless Edge with software GPU; not physical phone or production bundle.',runs:[]};
try{
  for(const [width,height] of [[480,270],[896,414],[844,390],[800,600]])for(const dpr of [1,2]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
    const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.CONTENT_V2_QA_URL??'http://127.0.0.1:4332')+'/tools/content-v2/filter-preview.html');
    await page.waitForFunction(()=>window.filterReview,{timeout:15000});
    const state=await page.evaluate(()=>window.filterReview);
    report.runs.push({width,height,dpr,errors,...state});await context.close();
  }
  report.passed=report.runs.every(r=>r.passed&&r.renderer===r.webgl&&!r.errors.length);
}finally{await writeFile(output+'/webgl-report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,profiles:report.runs.length,texturesPerProfile:report.runs[0]?.results.length ?? 0}));
if(!report.passed)process.exitCode=1;
