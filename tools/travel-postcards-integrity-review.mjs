import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const root='assets/travel-postcards-v2/',manifest=JSON.parse(await readFile(root+'manifest.json','utf8'));
const report={passed:false,sources:[],protectedPaths:['assets/scenery-v1','assets/skins','src/entities','src/input','src/systems/SaveSystem.ts','src/systems/ProgressionSystem.ts','src/systems/SpawnSystemOwner.ts','src/game/Constants.ts','package.json','package-lock.json','android'],fontReport:'font-report.json',bundle:'dist/assets/main-CEyfZHby.js'};
for(const item of manifest.assets){
  const original=await readFile(item.generatedOriginal),source=await readFile(root+item.source),runtime=await readFile(root+item.runtime);
  const same=hash(original)===hash(source)&&hash(source)===item.sourceSha256&&hash(runtime)===item.runtimeSha256;
  assert(same,item.name+': original generated pixels or packed asset changed');
  report.sources.push({name:item.name,originalUnchanged:same,sourceSha256:hash(source),runtimeSha256:hash(runtime)});
}
report.protectedDiff=execFileSync('git',['diff','--name-only','HEAD','--',...report.protectedPaths],{encoding:'utf8'}).trim();assert.equal(report.protectedDiff,'','protected gameplay, original images, main save or Android changed');
const fonts=JSON.parse(await readFile('docs/travel-postcards-v2/font-report.json','utf8'));assert(fonts.passed,'prior glyph ink or metrics changed');report.fonts=fonts.fonts;
report.bundleSha256=hash(await readFile(report.bundle));report.passed=true;
await mkdir('docs/travel-postcards-v2',{recursive:true});await writeFile('docs/travel-postcards-v2/integrity.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,originalImages:report.sources.length,protectedChanges:report.protectedDiff,fonts:report.fonts.length,bundle:report.bundle}));
