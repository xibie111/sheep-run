import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const sources = ['src/content-v2/TripCardModel.ts', 'src/content-v2/TripCard.ts', 'src/scenery/landmarkCatalog.ts',
  'src/delivery/DeliveryChapters.ts', 'src/delivery/DeliveryPanel.ts', 'src/delivery/DeliveryHud.ts'];
const all = (await Promise.all(sources.map(path => readFile(resolve(root, path), 'utf8')))).join('\n');
const copy = [...new Set([...all.matchAll(/["'`]([^"'`\n]*[\u4e00-\u9fff][^"'`\n]*)["'`]/g)].map(match => match[1]))];
const chars = [...new Set(copy.join('') + '0123456789 · …，。！「」')].filter(c => /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef0-9·…]/u.test(c)).sort();
const report = { passed: true, sources, copy, characters: chars.join(''), fonts: [] };
for (const size of [12, 20, 40, 64]) {
  const raw = await readFile(resolve(root, `assets/fonts/pasture-display-${size}.fnt`), 'utf8');
  const ids = new Set([...raw.matchAll(/<char\s+id="(\d+)"/g)].map(match => Number(match[1])));
  const missing = chars.filter(c => !ids.has(c.codePointAt(0))).join('');
  report.fonts.push({size, missing}); if(missing) report.passed = false;
}
const dir = resolve(root, 'docs/content-update-v2'); await mkdir(dir, {recursive:true});
await writeFile(resolve(dir, 'all-copy.txt'), copy.join('\n')+'\n');
await writeFile(resolve(dir, 'all-glyphs.txt'), chars.join('')+'\n');
await writeFile(resolve(dir, 'font-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({passed: report.passed, fonts: report.fonts}));
if (!report.passed) process.exitCode = 1;
