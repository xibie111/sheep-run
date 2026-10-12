/** Consolidate only this run's successful reports; never edits game/player data. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const dir = 'docs/skins-v4/';
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const sha = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const sources = [
  'browser/browser-review-matrix.json', 'browser/browser-review-runtime-only.json',
  'browser/browser-review-edge.json', 'browser/browser-review-natural.json',
  'wardrobe-ink/review.json', 'webgl-play/report.json',
  'final-build/report.json',
];
const reports = await Promise.all(sources.map(path => json(dir + path)));
for (const [i, report] of reports.entries()) assert.equal(report.passed, true, sources[i]);
const manifest = await json('assets/skins/runtime-v4/manifest.json');
const fonts = await json(dir + 'font-report.json'), visuals = await json(dir + 'visual-review.json');
assert(fonts.passed && Object.keys(visuals.skins).length === 8 && Object.values(visuals.skins).every(s => s.reviewed));
assert.equal(reports[1].views.length, 8);
assert.equal(reports[1].views.flatMap(v => v.runtime).length, 64);
const tests = await readFile(new URL(dir + 'tests.log', root), 'utf8');
const typecheck = await readFile(new URL(dir + 'typecheck.log', root), 'utf8');
const build = await readFile(new URL(dir + 'build.log', root), 'utf8');
const testTotal = Number(tests.match(/Tests\s+(\d+) passed/)?.[1]);
const fileTotal = Number(tests.match(/Test Files\s+(\d+) passed/)?.[1]);
assert(testTotal >= 1086 && fileTotal >= 103 && !/error TS\d+/i.test(typecheck));
assert(/built in/.test(build));
const checkedMain = [...new Set(reports[1].views.map(v => v.main))];
const builds = (await readdir(new URL('dist/assets/', root))).filter(p => /^main-.*\.js$/.test(p));
const old = await json(dir + 'old-skin-hashes-before.json');
for (const [path, expected] of Object.entries(old.files)) assert.equal(await sha(path), expected, path);
const ids = manifest.skins.map(s => s.id), names = ['草莓羊', '柠檬羊', '水手羊', '星灯羊', '邮差羊', '雨衣羊', '探险羊', '航天羊'];
const prices = [40, 70, 100, 150, 60, 90, 120, 160];
const acceptance = {
  passed: true, date: '2026-10-12', localOnly: true, phoneHardwareVerified: false,
  skins: ids.map((id, i) => ({ id, name: names[i], price: prices[i], currency: i < 4 ? '星星' : '金币', poses: 15,
    source: manifest.skins[i].source, runtime: manifest.skins[i].runtime, runtimeSha256: manifest.skins[i].runtimeHash })),
  persistence: { key: 'sheep-run-save', version: 5, migration: 'v1-v4 -> v5, spentStars defaults to 0',
    availableStars: 'totalStars - spentStars', totalStars: 'Lifetime earned stars, never reduced for purchase',
    transaction: 'One paid purchase write updates spentStars plus unlockedSkins; failed write neither charges nor unlocks',
    legacy: 'black/brown cumulative totalStars unlocks remain free', corruptOrFuture: 'Refuse transactions and retain raw storage',
    autoEquip: false, realPlayerSaveTouched: false },
  art: { generator: 'builtin image_gen', prompts: 'assets/skins/generated-v4/prompts.json',
    provenance: 'assets/skins/generated-v4/generation-outputs.json', manifest: 'assets/skins/runtime-v4/manifest.json',
    packingTool: 'tools/skin-review/pack_skins_v4.py', atlas: '640x384; 5x3; 128x128 transport; 128x112 visible; top16 blank',
    scale: 'Uniform per skin, nearest-neighbor, hard alpha; no repaint/recolor/standing-frame duplication',
    preservedOldFiles: Object.keys(old.files).length, fonts: fonts.fonts,
    referenceOnly: 'Generated wardrobe reference is retained as art direction; approved catalog data controls actual prices/currencies.' },
  commandProvenance: await json(dir + 'final-command-provenance.json'),
  commands: { test: { command: 'npm test -- --run', passed: true, files: fileTotal, tests: testTotal, log: dir + 'tests.log' },
    typecheck: { command: 'npm run typecheck', passed: true, log: dir + 'typecheck.log' },
    build: { command: 'npm run build', passed: true, log: dir + 'build.log' } },
  browser: reports.map((r, i) => ({ report: dir + sources[i], passed: r.passed, url: r.url,
    profiles: r.views?.length ?? null, checks: r.checks.length, screenshots: r.screenshots.length,
    runtimeErrors: (r.runtimeErrors ?? r.errors ?? []).length, phoneHardware: false })),
  coverage: { sizes: ['480x270', '896x414', '844x390', '800x600'], dpr: [1, 2],
    wardrobe: 'All six dynamic pages, eight exact prices/currencies, purchase, pointercancel, repeat touches, zero-balance equip, refresh persistence',
    runtime: '64 skin/size/DPR combinations; real tap/high-jump/crouch, pause, real 15-crop sampling, hit/result/trip portrait',
    webgl: 'Normal AUTO/WebGL wardrobe plus eight skins in ordinary touch runs, natural collisions/trip portraits, companion and delivery starts',
    delivery: 'Every new skin is rendered; real mailbox entry covers all five current chapters. This report does not claim full chapter completion.',
    companion: 'Actual owned-skin selection/bell-collection/controller, 85% size, no body, real run event and touch exit cleanup',
    natural: 'Additional untouched gameplay: strawberry, raincoat, astronaut each exceed 10 effective seconds through real touches; pause/resume',
    storageAndRetry: 'Insufficient funds, old rules, corrupt JSON/future/invalid spent, v4 migration, quota/migration failure/recovery, new lemon PNG load failure/retry' },
  isolation: { playerProfilesUsed: false, productionFixtureCodeAdded: false,
    canvas: 'Forced Canvas only for raw drawImage crop/filter instrumentation; NineSlice appearance is separately verified with normal WebGL',
    controlledPoses: 'Suppress spawns only in isolated pose contexts; freeze only while sampling frames; production hit callback creates result',
    controlledCompanion: 'Explicit safe-gap/effective-time fixture only in isolated contexts',
    natural: 'No physics/spawn/clock/random/immunity modifications',
    harnessCorrections: 'Per-pose sampling replaces bounded aggregate draw history; natural robot touch lead corrected; final PNG hash reads real response bytes rather than loader-revoked blob URLs. No gameplay changes.' },
  builds: { browserCheckedMain: checkedMain, finalSmokeMain: reports.at(-1).main, finalSmokeSkins: reports.at(-1).assets.length,
    finalLocal: await Promise.all(builds.map(async p => ({ file: 'dist/assets/' + p, sha256: await sha('dist/assets/' + p) }))),
    priorCheckpoint: 'docs/skins-v4/checkpoints/main-CrNOPRWE/',
    skinIntegrity: 'docs/skins-v4/post-delivery-integrity.json',
    parallelChanges: 'Concurrent B owns delivery title readability, challenge-store validation and new-chapter destination focus. Skin/economy/font sources and assets are frozen; older runtime evidence remains labelled with its actual build.' },
  remaining: ['No phone hardware test', 'No APK/package/device verification requested or performed'],
  parallelFinalHandoff: 'docs/skins-v4/parallel-final-handoff.json',
  prohibitedActionsPerformed: { apk: false, appVersion: false, androidArchive: false, commit: false, push: false, publish: false },
};
await writeFile(new URL(dir + 'acceptance.json', root), JSON.stringify(acceptance, null, 2));
process.stdout.write(JSON.stringify({ passed: true, skins: ids.length, poses: ids.length * 15, testTotal, browserChecks: reports.reduce((n, r) => n + r.checks.length, 0), phoneHardware: false }) + '\n');
