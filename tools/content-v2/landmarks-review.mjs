import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.CONTENT_V2_QA_URL || 'http://127.0.0.1:4332';
const out = path.resolve('docs/content-update-v2/landmarks/browser'); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const runs = [];
try {
  for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await context.newPage(), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/docs/content-update-v2/landmarks/fixture.html`);
    await page.waitForFunction(() => window.landmarkQA?.ready, { timeout: 30_000 });
    const snap = () => page.evaluate(() => window.landmarkQA.snapshot());
    const step = async (distance, state = {}) => { await page.evaluate(([d, s]) => window.landmarkQA.step(d, s), [distance, state]); await page.waitForTimeout(80); };
    const check = (name, value) => { checks.push({ name, passed: !!value }); };
    await step(2399); check('no opening landmark', (await snap()).id === null);
    await step(2500, { blocked: true }); check('congestion defers', (await snap()).id === null);
    await step(2500); check('single background sprite', (await snap()).sprites.length === 1);
    check('offscreen does not record', (await snap()).encounters.length === 0);
    await step(3500); await page.waitForTimeout(600);
    const windmill = await snap(); check('rendered windmill recorded', windmill.encounters[0]?.id === 'windmill-meadow');
    await page.screenshot({ path: path.join(out, `windmill-${width}x${height}-dpr${dpr}.png`) });
    await step(3500, { paused: true }); const before = await snap();
    await step(4000, { paused: true }); const stopped = await snap();
    check('pause leaves distance-position-age unchanged', before.x === stopped.x && before.ageMs === stopped.ageMs);
    await step(4100); check('resume follows background', (await snap()).x < stopped.x);
    await step(12_000); check('offscreen recycled', (await snap()).id === null);
    await step(13_200); check('next landmark remains one sprite', (await snap()).id === 'old-barn' && (await snap()).sprites.length === 1);
    await step(14_000); await page.waitForTimeout(600);
    check('barn actually recorded', (await snap()).encounters.some(event => event.id === 'old-barn'));
    await page.screenshot({ path: path.join(out, `barn-${width}x${height}-dpr${dpr}.png`) });
    await step(19_000); await step(20_200); await step(21_000); await page.waitForTimeout(600);
    check('bridge actually recorded', (await snap()).encounters.some(event => event.id === 'riverside-bridge'));
    await page.screenshot({ path: path.join(out, `bridge-${width}x${height}-dpr${dpr}.png`) });
    const bounds = await page.evaluate(() => { const canvas = document.querySelector('canvas'), r = canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height,
      scroll: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth }; });
    check('fixture fills viewport without scroll', Math.abs(bounds.x) < 1 && Math.abs(bounds.y) < 1 && Math.abs(bounds.width - width) < 1 && Math.abs(bounds.height - height) < 1 && !bounds.scroll);
    check('texture aspect matches generated runtime', JSON.stringify(await page.evaluate(() => window.landmarkQA.definitions.map(item => [item.width, item.height]))) === JSON.stringify([[62,75.5],[90,45],[110,30]]));
    await page.evaluate(() => window.landmarkQA.clear()); check('clear removes all sprites', (await snap()).sprites.length === 0);
    runs.push({ width, height, dpr, checks, errors }); await context.close();
  }
} finally { await browser.close(); }
const report = { environment: 'isolated Chromium/Edge touch browser simulation, not a physical device', base, runs,
  passed: runs.every(run => !run.errors.length && run.checks.every(check => check.passed)) };
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1;
