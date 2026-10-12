/** Supplemental normal AUTO/WebGL wardrobe rendering, isolated browser data. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = new URL('../../docs/skins-v4/wardrobe-ink/', import.meta.url);
await mkdir(output, { recursive: true });
const url = process.env.SKIN_V4_REVIEW_URL || 'http://127.0.0.1:4341/';
const ids = ['strawberry-v1', 'lemon-v1', 'sailor-v1', 'starlight-v1', 'postman-v1', 'raincoat-v1', 'explorer-v1', 'astronaut-v1'];
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const report = { passed: false, url, phoneHardware: false, method: 'Unmodified AUTO renderer in isolated Edge mobile touch contexts. Display ink boxes derive from the same atlas glyph sizes, display origins and world transforms used by DisplayTextLayer. No gameplay or source edits, no player profile, no forced Canvas mode.', views: [], screenshots: [], errors: [], checks: [] };
const check = (condition, message) => { assert(condition, message); report.checks.push(message); };

try {
  for (const [width, height, dpr] of [[480, 270, 1], [896, 414, 2], [844, 390, 1], [800, 600, 2]]) {
    const label = `${width}x${height}-dpr${dpr}`;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ label, message: error.message }));
    await page.addInitScript(() => {
      localStorage.setItem('sheep-run-save', JSON.stringify({ version: 5, highScore: 12, totalStars: 360, spentStars: 0, coins: 430, selectedSkin: 'white', unlockedSkins: ['white'], upgrades: { jump: 0, speed: 0, magnet: 0, dash: 0 }, settings: { music: false, sfx: false, musicVolume: 1, sfxVolume: 1 } }));
    });
    const mainRequest = page.waitForRequest(request => /(?:\/src\/main(?:\.ts)?|\/assets\/main-[^/]+\.js)(?:\?.*)?$/.test(request.url()));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async main => { window.g = (await import(main)).game.instance; }, (await mainRequest).url());
    await page.waitForFunction(() => window.g.scene.isActive('MenuScene'), null, { timeout: 15000 });
    const frames = async () => page.evaluate(() => new Promise(resolve => { let count = 2; const after = () => { if (!--count) { window.g.events.off('postrender', after); resolve(); } }; window.g.events.on('postrender', after); }));
    const target = async (key, name, optional = false) => page.evaluate(({ key, name, optional }) => {
      const scene = window.g.scene.getScene(key), find = list => { for (const o of list) { if (o.name === name) return o; const nested = o.list && find(o.list); if (nested) return nested; } };
      const o = find(scene.children.list); if (!o) { if (optional) return null; throw new Error(`Missing ${key}/${name}`); }
      const b = o.getBounds(), rect = window.g.canvas.getBoundingClientRect(), size = window.g.scale.gameSize;
      return { x: rect.x + b.centerX * rect.width / size.width, y: rect.y + b.centerY * rect.height / size.height };
    }, { key, name, optional });
    const tap = async (key, name) => { const p = await target(key, name); await page.touchscreen.tap(p.x, p.y); await frames(); };
    await tap('MenuScene', 'button:衣橱');
    await page.waitForFunction(() => window.g.scene.isActive('WardrobeScene'));
    const audit = async () => page.evaluate(() => {
      const scene = window.g.scene.getScene('WardrobeScene'), size = window.g.scale.gameSize;
      const rows = [], nineSlices = [];
      const bounds = b => ({ x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height });
      const walk = list => { for (const o of list) {
        if (o.type === 'NineSlice') nineSlices.push({ texture: o.texture.key, bounds: bounds(o.getBounds()), visible: o.visible, active: o.active });
        if (o.type === 'BitmapText' && o.text) {
          o.getTextBounds();
          const data = scene.cache.bitmapFont.get(o.font).data, matrix = o.getWorldTransformMatrix(), ratio = o.fontSize / data.size, points = [], missing = [];
          let advance = 0, line = 0;
          for (const character of o.text) {
            if (character === '\n') { advance = 0; line += data.lineHeight; continue; }
            const glyph = data.chars[character.codePointAt(0)];
            if (!glyph) { missing.push(character); continue; }
            if (glyph.width && glyph.height) {
              const left = (advance + glyph.xOffset) * ratio - o.displayOriginX;
              const top = (line + glyph.yOffset) * ratio - o.displayOriginY;
              for (const [x, y] of [[left, top], [left + glyph.width * ratio, top], [left, top + glyph.height * ratio], [left + glyph.width * ratio, top + glyph.height * ratio]]) {
                points.push({ x: matrix.a * x + matrix.c * y + matrix.tx, y: matrix.b * x + matrix.d * y + matrix.ty });
              }
            }
            advance += glyph.xAdvance + o.letterSpacing;
          }
          const ink = { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
          let parent = o.parentContainer; while (parent && !parent.name?.startsWith('skin-card:') && !parent.name?.startsWith('button:')) parent = parent.parentContainer;
          // Compare ink with the visible art frame, not the Container union
          // which would otherwise grow to include an overflowing label.
          rows.push({ name: o.name, text: o.text, font: o.font, missing, ink, parent: parent ? { name: parent.name, bounds: bounds(parent.list[0].getBounds()) } : null });
        }
        if (o.list) walk(o.list);
      } }; walk(scene.children.list);
      return { renderer: window.g.renderer.type, gameSize: { width: size.width, height: size.height }, rows, nineSlices, selectedId: scene.selectedId };
    });
    for (const id of ['black', ...ids]) {
      for (let count = 0; !await target('WardrobeScene', `skin-card:${id}`, true); count++) { check(count < 8, `${label}: ${id} reachable`); await tap('WardrobeScene', 'button:page-next'); }
      await tap('WardrobeScene', `skin-card:${id}`);
      const data = await audit();
      check(data.renderer === 2, `${label}/${id}: production AUTO selects real WebGL renderer`);
      check(data.nineSlices.length >= 7 && data.nineSlices.every(o => o.visible && o.active), `${label}/${id}: production wooden panels/button NineSlices active`);
      for (const row of data.rows) {
        check(!row.missing.length, `${label}/${id}: ${row.text} glyphs present`);
        check(row.ink.x >= -.5 && row.ink.y >= -.5 && row.ink.right <= data.gameSize.width + .5 && row.ink.bottom <= data.gameSize.height + .5, `${label}/${id}: ${row.text} ink stays visible`);
        if (row.parent) {
          const b = row.parent.bounds;
          check(row.ink.x >= b.x - .5 && row.ink.right <= b.right + .5 && row.ink.y >= b.y - .5 && row.ink.bottom <= b.bottom + .5, `${label}/${id}: ${row.text} ink fits ${row.parent.name}`);
        }
      }
      const explanation = data.rows.find(row => row.name === 'wardrobe-price-explanation');
      check(!!explanation, `${label}/${id}: actual selected-skin price explanation`);
      check(explanation.ink.x >= data.gameSize.width / 2 - 80.5 && explanation.ink.right <= data.gameSize.width / 2 + 226.5, `${label}/${id}: explanation fits right panel width`);
      if (id === 'black') check(explanation.text === '累计星数达标解锁：10星星，不扣星星', `${label}: legacy cost clearly cumulative/non-spending`);
      const screenshot = `${label}-${id}.png`; await page.screenshot({ path: fileURLToPath(new URL(screenshot, output)), scale: 'css' });
      report.screenshots.push(screenshot); report.views.push({ label, id, ...data });
    }
    await context.close();
  }
  check(!report.errors.length, 'No actual browser runtime errors');
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(new URL('review.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, views: report.views.length, screenshots: report.screenshots.length, checks: report.checks.length, failure: report.failure?.message }));
}
