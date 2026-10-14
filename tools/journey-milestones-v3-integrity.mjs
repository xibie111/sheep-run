import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url), assets = new URL('assets/achievement-icons-v3/', root);
const output = new URL('docs/aegis/work/2026-10-13-achievements-v3/', root);
await mkdir(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = async path => ({ path, sha256: sha(await readFile(new URL(path, root))) });
const baselineFile = new URL('baseline.json', output);
if (process.argv.includes('--baseline')) {
  // Capture the actual current 32-stamp state, including uncommitted v2 work.
  const protectedPaths = ['src/data/expandedAchievements.ts', 'src/systems/JourneyStore.ts', 'src/systems/SaveSystem.ts', 'src/systems/ProgressionSystem.ts', 'src/game/Constants.ts', 'src/systems/InputSystem.ts', 'src/systems/GestureRecognizer.ts', 'src/systems/ScoreSystem.ts', 'src/systems/CollisionSystem.ts', 'src/entities/Sheep.ts', 'src/entities/Obstacle.ts', 'src/ui/JourneyToast.ts', 'src/ui/JourneyBook.ts'];
  for (const size of [12, 20, 40, 64]) for (const extension of ['png', 'fnt']) protectedPaths.push(`assets/fonts/pasture-display-${size}.${extension}`);
  for (const version of ['v1', 'v2']) for (const folder of ['sources', 'runtime']) {
    for (const file of await readdir(new URL(`assets/achievement-icons-${version}/${folder}/`, root))) if (file.endsWith('.png')) protectedPaths.push(`assets/achievement-icons-${version}/${folder}/${file}`);
  }
  await writeFile(baselineFile, JSON.stringify({ files: await Promise.all(protectedPaths.map(fingerprint)),
    originalCatalog: (await readFile(new URL('src/data/journeyBook.ts', root), 'utf8')).replace(/\r\n/g, '\n') }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ baseline: true, protected: protectedPaths.length }));
} else {
  const baseline = JSON.parse(await readFile(baselineFile, 'utf8'));
  for (const old of baseline.files) assert.equal((await fingerprint(old.path)).sha256, old.sha256, `retain ${old.path}`);
  const current = (await readFile(new URL('src/data/journeyBook.ts', root), 'utf8')).replace(/\r\n/g, '\n');
  const withoutAddition = current.replace('import { JOURNEY_MILESTONES_V3 } from "./journeyMilestonesV3";\n', '').replace('  ...JOURNEY_MILESTONES_V3,\n', '');
  assert.equal(withoutAddition, baseline.originalCatalog, 'retain entire old 32 catalog and personal letters');
  const catalog = [...(await readFile(new URL('src/data/journeyMilestonesV3.ts', root), 'utf8')).matchAll(/\{id:"([^"]+)",metric:"([^"]+)",name:"([^"]+)",goal:(\d+)/g)].map(m => ({ id: m[1], metric: m[2], name: m[3], goal: Number(m[4]) }));
  assert.equal(catalog.length, 12);
  const a = JSON.parse(await readFile(new URL('prompts-a.json', assets), 'utf8'));
  const b = JSON.parse(await readFile(new URL('prompts-b.json', assets), 'utf8'));
  const c = JSON.parse(await readFile(new URL('prompts-c.json', assets), 'utf8'));
  const d = JSON.parse(await readFile(new URL('prompts-d.json', assets), 'utf8'));
  const rows = [...a.items.filter(row => row.status === 'saved').map(row => ({ id: row.id, prompt: row.prompt, source: row.source, sha256: row.sha256 })),
    ...[...b.assets, ...c.assets, ...d.assets].map(row => ({ id: row.id, prompt: row.prompt, source: row.generatedSourcePath, sha256: row.sha256 }))];
  assert.equal(rows.length, 12); assert.equal(new Set(rows.map(row => row.id)).size, 12);
  const processing = JSON.parse(await readFile(new URL('processing.json', assets), 'utf8')); assert.equal(processing.complete, true);
  for (const item of catalog) {
    const prompt = rows.find(row => row.id === item.id), record = processing.entries.find(row => row.id === item.id);
    assert.ok(prompt && record, item.id);
    const source = await readFile(new URL(`sources/${item.id}.png`, assets));
    assert.equal(sha(source), prompt.sha256); assert.equal(sha(source), record.sourceSha256);
    assert.equal(sha(source), sha(await readFile(prompt.source)), `unchanged generated original ${item.id}`);
    assert.equal(sha(await readFile(new URL(record.runtime, assets))), record.runtimeSha256);
  }
  await writeFile(new URL('prompts.json', assets), JSON.stringify({ generator: 'built-in imagegen', independentAssets: 12,
    note: 'Network-failed requests were retried with the built-in tool. Sources are complete originals; no CLI or reused old icons.', entries: rows }, null, 2));
  const production = new URL('builds/achievements-v3/assets/', root), packageFiles = await readdir(production);
  const bundle = packageFiles.filter(name => /^main-.*\.js$/.test(name)); assert.equal(bundle.length, 1);
  for (const item of catalog) {
    const files = packageFiles.filter(name => name.startsWith(item.id + '-') && name.endsWith('.png')); assert.equal(files.length, 1);
    assert.equal(sha(await readFile(new URL(files[0], production))), processing.entries.find(row => row.id === item.id).runtimeSha256);
  }
  await writeFile(new URL('integrity-verification.json', output), JSON.stringify({ passed: true, retainedFiles: baseline.files,
    retainedCatalogCount: 32, added: catalog, production: { path: 'builds/achievements-v3/', bundle: bundle[0], sha256: sha(await readFile(new URL(bundle[0], production))) } }, null, 2));
  console.log(JSON.stringify({ passed: true, retained: baseline.files.length, originalAchievements: 32, added: 12, bundle: bundle[0] }));
}
