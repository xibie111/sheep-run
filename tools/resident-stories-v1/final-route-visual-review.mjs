// Isolated rendering fixtures only. This script does not prove natural play or rewards.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = process.env.RESIDENT_VISUAL_URL || 'http://127.0.0.1:4386/';
const out = resolve(process.env.RESIDENT_VISUAL_OUT || 'docs/resident-stories-v1/routes-browser/final-menu-style');
const oldPath = resolve('docs/resident-stories-v1/routes-browser/2026-10-13T09-49-15-919Z-73440/routes-all-73440.json');
const previous = JSON.parse(await readFile(oldPath, 'utf8'));
const ids = previous.selected.filter(id => !['windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'].includes(id));
const sizes = [[480, 270, 1], [896, 414, 2], [844, 390, 1], [800, 600, 1]];
const expectedMain = 'b118ebd942ea408967888bf6a4f3d0e547cba0123d176ca7c5b2c439f4efed2a';
await mkdir(resolve(out, 'screenshots'), { recursive: true });
const report = { passed: false, startedAt: new Date().toISOString(), url, output: out, phoneHardware: false,
  method: 'Isolated rendering fixtures: completion prerequisites seeded, scene.start used, RunScene paused after normal initial settle, authored route distance/cursor/state/endingMs positioned explicitly, updateDelivery(0) invokes actual production views. Scene resumes for real rendering and DOM HUD capture. No fixture is natural-play, collision-reachability, timing, reward or save evidence.',
  previousNaturalReport: oldPath, previousNaturalPassed: previous.passed, sizes, checks: [], routes: [], views: [], screenshots: [], errors: [], warnings: [] };
const check = (condition, label) => { assert(condition, label); report.checks.push(label); };
const save = () => writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
let current;
async function frames(page) {
  await page.evaluate(() => new Promise((done, reject) => {
    let left = 2; const timer = setTimeout(() => reject(new Error('Render frame timeout')), 8000);
    const tick = () => { if (!--left) { clearTimeout(timer); window.g.events.off('postrender', tick); done(); } };
    window.g.events.on('postrender', tick);
  }));
}
async function enter(page, id) {
  await page.evaluate(id => {
    const g = window.g;
    for (const key of ['MenuScene', 'RunScene', 'PauseScene', 'ResultScene']) g.scene.stop(key);
    g.scene.start('RunScene', { deliveryId: id });
  }, id);
  await page.waitForFunction(id => window.g.scene.isActive('RunScene') && window.g.scene.getScene('RunScene').delivery?.chapter.id === id && window.g.scene.getScene('RunScene').sheep?.grounded, id, { timeout: 15000 });
  await page.evaluate(() => window.g.scene.pause('RunScene'));
  await frames(page);
  return page.evaluate(() => {
    const c = window.g.scene.getScene('RunScene').delivery.chapter;
    return { id: c.id, title: c.title, length: c.length, seed: c.seed, phases: c.phases, endingDurationMs: c.endingDurationMs,
      obstacles: c.obstacles.map(item => ({ at: item.at, kind: item.definition.kind, phase: item.phase })),
      stamps: c.challenge.stamps, landscapes: c.landscapes, endingKey: c.endingKey };
  });
}
async function positionAndRead(page, distance, endingMs) {
  await page.evaluate(({ distance, endingMs }) => {
    const s = window.g.scene.getScene('RunScene'), r = s.delivery;
    window.g.scene.pause('RunScene');
    r.distance = distance; r.next = r.chapter.obstacles.length;
    r.state = endingMs === null ? 'running' : 'ending'; r.endingMs = endingMs ?? 0;
    s.updateDelivery(0);
    window.g.scene.resume('RunScene');
  }, { distance, endingMs });
  await frames(page);
  return page.evaluate(() => {
    const g = window.g, s = g.scene.getScene('RunScene'), cam = s.cameras.main, size = g.scale.gameSize;
    const box = object => { const b = object.getBounds(); return { x: b.x - cam.scrollX * object.scrollFactorX,
      y: b.y - cam.scrollY * object.scrollFactorY, width: b.width, height: b.height, right: b.right - cam.scrollX * object.scrollFactorX, bottom: b.bottom - cam.scrollY * object.scrollFactorY }; };
    const object = o => ({ name: o.name, texture: o.texture?.key, alpha: o.alpha, visible: o.visible,
      scaleX: o.scaleX, scaleY: o.scaleY, tileScaleX: o.tileScaleX, tileScaleY: o.tileScaleY, tilePositionX: o.tilePositionX,
      textureFilter: o.texture?.source[0]?.scaleMode, cropHeight: o.isCropped ? o._crop.height : null,
      bounds: box(o), renderedBottom: o.isCropped ? box(o).y + o._crop.height * Math.abs(o.scaleY) : box(o).bottom });
    const canvas = g.canvas.getBoundingClientRect(), container = document.querySelector('#game-container').getBoundingClientRect();
    return { active: g.scene.isActive('RunScene'), chapter: s.delivery.chapter.id, distance: s.delivery.distance, state: s.delivery.state,
      phase: s.delivery.phase.id, weather: s.deliveryWeather, size: { width: size.width, height: size.height },
      canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height, backingWidth: g.canvas.width, backingHeight: g.canvas.height },
      container: { x: container.x, y: container.y, width: container.width, height: container.height },
      camera: { scrollX: cam.scrollX, scrollY: cam.scrollY },
      player: { bounds: box(s.sheep), scaleX: s.sheep.scaleX, scaleY: s.sheep.scaleY, displayWidth: s.sheep.displayWidth, displayHeight: s.sheep.displayHeight },
      pause: object(s.children.getByName('button:暂停')),
      render: { pixelArt: g.config.pixelArt, antialias: g.config.antialias, roundPixels: cam.roundPixels },
      landscapes: s.deliveryView.landscapes.map(layer => ({ image: object(layer.image), left: object(layer.left), right: object(layer.right), road: object(layer.road) })),
      ending: object(s.deliveryView.endingArt), matte: object(s.deliveryView.endingMatte),
      activeObstacles: s.obstacles.getChildren().filter(o => o.active).length,
      overlays: [...document.querySelectorAll('[data-adventure-overlay]')].filter(o => o.style.display !== 'none').map(o => o.dataset.adventureOverlay),
    };
  });
}
try {
  for (const [width, height, dpr] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    page.on('pageerror', e => report.errors.push({ current, kind: 'pageerror', message: e.message }));
    page.on('console', e => { if (e.type() === 'error') report.errors.push({ current, kind: 'console', message: e.text() }); else if (e.type() === 'warning') report.warnings.push(e.text()); });
    page.on('requestfailed', r => report.errors.push({ current, kind: 'requestfailed', url: r.url(), error: r.failure() }));
    await page.addInitScript(completedIds => localStorage.setItem('sheep-run-delivery-v1', JSON.stringify({ version: 1, completedIds })), previous.selected);
    const entryRequest = page.waitForRequest(r => /\/assets\/main-[^/]+\.js$/.test(r.url()));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const main = (await entryRequest).url();
    const mainBody = await (await context.request.get(main)).body();
    check(createHash('sha256').update(mainBody).digest('hex') === expectedMain, `${width}x${height}: exact frozen production bundle SHA`);
    report.main = main; report.mainSha256 = expectedMain;
    await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, main);
    await page.waitForFunction(() => window.g?.scene.isActive('MenuScene'));
    const probeIds = width === sizes[0][0] ? previous.selected : ids;
    for (const id of probeIds) {
      current = `${width}x${height}/dpr${dpr}/${id}`;
      const chapter = await enter(page, id);
      if (width === sizes[0][0]) {
        const old = previous.routes.find(route => route.id === id);
        const planHash = createHash('sha256').update(JSON.stringify(chapter.obstacles)).digest('hex');
        check(planHash === old.planHash, `${id}: exact obstacle plan hash matches successful natural nine-stage chain`);
        check(chapter.seed === old.chapter.seed && chapter.length === old.chapter.length && chapter.endingDurationMs === old.chapter.endingDurationMs, `${id}: seed length ending duration unchanged`);
        check(JSON.stringify(chapter.phases) === JSON.stringify(old.chapter.phases), `${id}: phase distances and weather unchanged`);
        check(JSON.stringify(chapter.stamps) === JSON.stringify(old.chapter.stamps), `${id}: ordinary and hidden stamp schedule unchanged`);
        report.routes.push({ id, planHash, previousPlanHash: old.planHash, chapter });
      }
      if (!ids.includes(id)) continue;
      const stages = [['start', 300, null, 0], ['middle', chapter.landscapes[1].transitionEnd + 500, null, 1],
        ['destination', chapter.length - 700, null, 2], ['ending', chapter.length, 3000, null]];
      for (const [stage, distance, endingMs, layerIndex] of stages) {
        const label = `${current}/${stage}`, f = await positionAndRead(page, distance, endingMs);
        report.lastObservation = { label, ...f };
        check(f.active, `${label}: active scene renders real HUD during capture`);
        check(Math.abs(f.canvas.width / f.size.width - f.canvas.height / f.size.height) < .00001, `${label}: uniform canvas scale`);
        check(f.canvas.x <= f.container.x + .1 && f.canvas.y <= f.container.y + .1 && f.canvas.x + f.canvas.width >= f.container.x + f.container.width - .1 && f.canvas.y + f.canvas.height >= f.container.y + f.container.height - .1, `${label}: canvas covers container without empty border`);
        check(f.render.pixelArt && !f.render.antialias && f.render.roundPixels, `${label}: production pixel render settings`);
        const p = f.pause.bounds;
        check(p.x >= 0 && p.y >= 0 && p.right <= f.size.width && p.bottom <= f.size.height, `${label}: pause UI fully within viewport`);
        check(f.activeObstacles === 0 && f.overlays.every(name => name === 'delivery-hud'), `${label}: isolated rendering fixture has no stale obstacles or modal overlays`);
        if (layerIndex !== null) {
          check(f.overlays.includes('delivery-hud'), `${label}: real delivery HUD visible during capture`);
          const layer = f.landscapes[layerIndex], { image, left, right, road } = layer;
          check(image.alpha === 1 && image.texture.startsWith('resident-v1-') && image.textureFilter === 1, `${label}: new resident texture loaded with nearest filtering`);
          check(Math.abs(image.scaleX - image.scaleY) < 1e-6 && Math.abs(road.tileScaleX - road.tileScaleY) < 1e-6, `${label}: background and road use uniform pixel scale`);
          check(Math.abs(left.bounds.right - image.bounds.x) < .1 && Math.abs(image.bounds.right - right.bounds.x) < .1 && left.bounds.x <= 0 && right.bounds.right >= f.size.width, `${label}: mirrored panorama extensions meet and cover both sides`);
          check(image.bounds.y <= .1 && Math.abs(image.renderedBottom - road.bounds.y) < .1 && road.bounds.x === 0 && road.bounds.right >= f.size.width && road.bounds.bottom >= f.size.height, `${label}: panorama and tiled road meet without gap and cover vertical viewport`);
          check(f.player.bounds.x >= 0 && f.player.bounds.right <= f.size.width && f.player.bounds.y >= 0 && f.player.bounds.bottom <= f.size.height && f.player.displayWidth === 48 && f.player.displayHeight === 42, `${label}: complete player retains baseline 48x42 proportions`);
        } else {
          check(f.ending.alpha === 1 && f.matte.alpha === 1 && f.ending.texture === chapter.endingKey, `${label}: correct complete ending illustration shown`);
          check(f.ending.scaleX === f.ending.scaleY && f.ending.bounds.x >= -.1 && f.ending.bounds.y >= -.1 && f.ending.bounds.right <= f.size.width + .1 && f.ending.bounds.bottom <= f.size.height + .1, `${label}: entire ending art fits without distortion or crop`);
          check(f.matte.bounds.x === 0 && f.matte.bounds.y === 0 && f.matte.bounds.width === f.size.width && f.matte.bounds.height === f.size.height, `${label}: intentional story matte covers remaining aspect-ratio margins`);
        }
        const file = `${width}x${height}-dpr${dpr}-${id}-${stage}.png`;
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true });
        await page.evaluate(() => window.g.scene.pause('RunScene'));
        await writeFile(resolve(out, 'screenshots', file), Buffer.from(data, 'base64'));
        report.screenshots.push(`screenshots/${file}`); report.views.push({ width, height, dpr, id, stage, ...f, screenshot: `screenshots/${file}` });
        await save();
      }
      process.stdout.write(JSON.stringify({ current, screenshots: report.screenshots.length, checks: report.checks.length }) + '\n');
    }
    await context.close();
  }
  check(report.errors.length === 0, 'No browser page, console or asset request failures');
  check(report.screenshots.length === 96, 'All six routes and four visual stages captured at all four requested viewport sizes');
  check(report.routes.length === 9, 'All nine authored route plans compared with natural chain evidence');
  report.passed = true;
} catch (error) { report.failure = { current, message: String(error), stack: error.stack }; throw error; }
finally { report.finishedAt = new Date().toISOString(); await save(); await browser.close(); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, screenshots: report.screenshots.length, report: resolve(out, 'report.json') }));
