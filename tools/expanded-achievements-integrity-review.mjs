import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url), assets = new URL('assets/achievement-icons-v2/', root);
const output = new URL('docs/aegis/work/2026-10-13-expanded-achievements/', root);
await mkdir(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const git = path => execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
const a = JSON.parse(await readFile(new URL('sources/prompts-a.json', assets), 'utf8'));
const b = JSON.parse(await readFile(new URL('prompts-b.json', assets), 'utf8'));
const catalog = [...(await readFile(new URL('src/data/expandedAchievements.ts', root), 'utf8')).matchAll(/\{id:"([^"]+)",metric:"([^"]+)",name:"([^"]+)",goal:(\d+)/g)].map(match => ({ id: match[1], metric: match[2], name: match[3], goal: Number(match[4]) }));
assert.equal(catalog.length, 12);
const prompts = [...a.items.map(entry => ({ id: entry.id, prompt: entry.prompt, source: entry.source, path: entry.path, sha256: entry.sha256 })),
  ...b.assets.map(entry => ({ id: entry.id, prompt: entry.prompt, source: entry.generatedSourcePath, path: entry.savedPath, sha256: entry.sha256 }))];
assert.equal(prompts.length, 12); assert.equal(new Set(prompts.map(entry => entry.id)).size, 12);
const processing = JSON.parse(await readFile(new URL('processing.json', assets), 'utf8'));
assert.equal(processing.complete, true); assert.equal(processing.entries.length, 12);
const entries = [];
for (const item of catalog) {
  const prompt = prompts.find(entry => entry.id === item.id), processed = processing.entries.find(entry => entry.id === item.id);
  assert.ok(prompt && processed, `complete generated ${item.id}`);
  assert.ok(prompt.prompt.includes('Subject:') && prompt.prompt.includes('transparent'), `save full generation request ${item.id}`);
  const source = await readFile(new URL(`sources/${item.id}.png`, assets));
  assert.equal(hash(source), prompt.sha256); assert.equal(hash(source), processed.sourceSha256);
  assert.equal(hash(source), hash(await readFile(prompt.source)), `generated original retained without edits: ${item.id}`);
  assert.equal(hash(await readFile(new URL(processed.runtime, assets))), processed.runtimeSha256);
  assert.deepEqual(processed.runtimeSize, [32, 32]);
  entries.push({ ...item, prompt, processing: processed });
}
await writeFile(new URL('prompts.json', assets), JSON.stringify({ generatedBy: 'built-in imagegen', calls: 12, independentImages: true,
  originalArtUnchanged: true, entries: entries.map(entry => entry.prompt) }, null, 2));
const originalCatalog = git('src/data/journeyBook.ts').toString('utf8').match(/\{id:[^\n]+\}/g);
const currentCatalog = (await readFile(new URL('src/data/journeyBook.ts', root), 'utf8')).match(/\{id:[^\n]+\}/g);
assert.equal(originalCatalog.length, 20); assert.deepEqual(currentCatalog, originalCatalog, 'all original twenty definitions and copy unchanged');
// The personal letters below the achievement catalog are retained verbatim.
const originalLetters = git('src/data/journeyBook.ts').toString('utf8').split('export const SEASON_LETTERS')[1].replace(/\r\n/g, '\n');
assert.equal((await readFile(new URL('src/data/journeyBook.ts', root), 'utf8')).split('export const SEASON_LETTERS')[1].replace(/\r\n/g, '\n'), originalLetters);
const protectedPaths = ['src/systems/JourneyStore.ts', 'src/systems/SaveSystem.ts', 'src/systems/ProgressionSystem.ts', 'src/game/Constants.ts', 'src/systems/InputSystem.ts', 'src/systems/GestureRecognizer.ts', 'src/systems/ScoreSystem.ts', 'src/systems/CollisionSystem.ts', 'src/entities/Sheep.ts', 'src/entities/Obstacle.ts', 'src/ui/JourneyToast.ts'];
const protectedFiles = [];
for (const path of protectedPaths) {
  const sha256 = hash(await readFile(new URL(path, root)));
  assert.equal(sha256, hash(git(path)), `preserve ${path}`); protectedFiles.push({ path, sha256, unchangedFromHead: true });
}
const oldArtPaths = execFileSync('git', ['ls-files', 'assets/achievement-icons-v1/*.png', 'assets/achievement-icons-v1/**/*.png'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const oldArt = [];
for (const path of oldArtPaths) { const sha256 = hash(await readFile(new URL(path, root))); assert.equal(sha256, hash(git(path))); oldArt.push({ path, sha256 }); }
const production = new URL('builds/achievements-v2/assets/', root), packageFiles = await readdir(production);
const bundle = packageFiles.filter(name => /^main-.*\.js$/.test(name)); assert.equal(bundle.length, 1);
const copiedIcons = [];
for (const item of entries) {
  const matching = packageFiles.filter(name => name.startsWith(`${item.id}-`) && name.endsWith('.png'));
  assert.equal(matching.length, 1, `emit one ${item.id} PNG in production`);
  const packagedHash = hash(await readFile(new URL(matching[0], production)));
  assert.equal(packagedHash, item.processing.runtimeSha256, `package actual ${item.id} runtime PNG`);
  copiedIcons.push({ id: item.id, file: matching[0], sha256: packagedHash });
}
await writeFile(new URL('integrity-verification.json', output), JSON.stringify({ passed: true, originalDefinitions: 20, originalLettersUnchanged: true,
  protectedFiles, oldArt, added: entries, production: { path: 'builds/achievements-v2/', bundle: bundle[0], bundleSha256: hash(await readFile(new URL(bundle[0], production))), copiedIcons },
  scope: 'Compare against current Git HEAD; concurrent residents/menu/font/skin work is excluded from unchanged claims.' }, null, 2));
console.log(JSON.stringify({ passed: true, originalDefinitions: 20, protectedFiles: protectedFiles.length, oldArt: oldArt.length, generated: entries.length }));
