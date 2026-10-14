import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const evidence = new URL('../docs/aegis/work/2026-10-13-expanded-obstacles/', import.meta.url);
await mkdir(evidence, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const git = path => execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
const kinds = ['WoodFence', 'Pumpkin', 'Rock', 'Puddle', 'FlyingBird', 'WideLog', 'TallStack', 'HangingVine', 'WoodBarrel', 'MilkChurn', 'FruitBasket', 'MushroomCluster', 'Bramble', 'HangingBranch'];
const source = await readFile(new URL('src/game/ObstacleDefinitions.ts', root), 'utf8');
const before = git('src/game/ObstacleDefinitions.ts').toString('utf8');
const definition = (text, kind) => text.match(new RegExp(`export const ${kind}: ObstacleDefinition = \\{[\\s\\S]*?\\n\\};`))?.[0].replace(/\r\n/g, '\n');
const originalDefinitions = kinds.map(kind => {
  const current = definition(source, kind), baseline = definition(before, kind);
  assert.ok(current && baseline, `find original ${kind}`);
  assert.equal(current, baseline, `preserve original ${kind} definition`);
  return { kind, unchangedFromHead: true, sha256: hash(current) };
});
const protectedPaths = ['src/game/Constants.ts', 'src/entities/Obstacle.ts', 'src/entities/Sheep.ts', 'src/systems/InputSystem.ts', 'src/systems/GestureRecognizer.ts', 'src/systems/CollisionSystem.ts', 'src/systems/ScoreSystem.ts', 'src/systems/SaveSystem.ts', 'src/systems/ProgressionSystem.ts', 'src/systems/SpawnSystemOwner.ts', 'src/data/newObstacleArt.ts', 'src/data/additionalObstacleArt.ts', 'src/utils/SeasonArtTextures.ts'];
const protectedFiles = [];
for (const path of protectedPaths) {
  const current = await readFile(new URL(path, root)), baseline = git(path);
  assert.equal(hash(current), hash(baseline), `preserve ${path}`);
  protectedFiles.push({ path, unchangedFromHead: true, sha256: hash(current) });
}
const atlasPath = 'assets/seasons/expanded-obstacles-v3/atlas.png';
const sha256 = hash(await readFile(new URL(atlasPath, root)));
assert.equal(sha256, 'adb262a10c4f976ae2a87514c9a02909919c5e3d9be73ce9eed0534ae8748954', 'generated source unchanged');
// Confirm all already tracked seasonal PNG sources remain exactly their Git baseline.
const tracked = execFileSync('git', ['ls-files', 'assets/seasons/*.png', 'assets/seasons/**/*.png'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const originalArt = [];
for (const path of tracked) {
  const current = hash(await readFile(new URL(path, root))), baseline = hash(git(path));
  assert.equal(current, baseline, `preserve source art ${path}`);
  originalArt.push({ path, sha256: current, unchangedFromHead: true });
}
const snapshotPath = 'builds/expanded-obstacles-v3-verified-20261013-1538/';
const bundle = 'main-CdyYAPt0.js', snapshot = new URL(snapshotPath, root);
const bundleSha256 = hash(await readFile(new URL(`assets/${bundle}`, snapshot)));
assert.equal(bundleSha256, '8c492da20512908bc451ff009c6088e3f82c9ffe3950406bdbb76454ed492643', 'verified production bundle preserved');
const copiedAtlas = [];
for (const file of await readdir(new URL('assets/', snapshot))) {
  if (file.endsWith('.png') && hash(await readFile(new URL(`assets/${file}`, snapshot))) === sha256) copiedAtlas.push(file);
}
assert.equal(copiedAtlas.length, 1, 'verified package includes the generated atlas byte-for-byte');
const integratedPath = 'builds/expanded-obstacles-v3/', integratedBundle = 'main-DOnQKyTN.js';
const integratedSha256 = hash(await readFile(new URL(`${integratedPath}assets/${integratedBundle}`, root)));
assert.equal(integratedSha256, '04260fa870eb1a1334ae17ac3fbb4dc5d1a739da5f92d0b76b37bde40a23576d', 'integrated browser-verified bundle preserved');
assert.equal(hash(await readFile(new URL(`${integratedPath}assets/${copiedAtlas[0]}`, root))), sha256, 'integrated package includes unchanged generated atlas');
const report = { passed: true, method: 'Compare original 14 definitions and protected files/art byte-for-byte against actual Git HEAD. Concurrent menu, delivery and skin work is outside this claim.', originalDefinitions, protectedFiles, originalArt, generatedAtlas: { path: atlasPath, sha256, unchangedFromGeneration: true }, verifiedProductionSnapshot: { path: snapshotPath, bundle, bundleSha256, atlas: copiedAtlas[0] }, integratedProductionSnapshot: { path: integratedPath, bundle: integratedBundle, bundleSha256: integratedSha256, atlas: copiedAtlas[0] } };
await writeFile(new URL('integrity-verification.json', evidence), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, originalKinds: originalDefinitions.length, protectedFiles: protectedFiles.length, originalArt: originalArt.length }));
