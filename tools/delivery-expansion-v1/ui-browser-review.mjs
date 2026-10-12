import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.DELIVERY_UI_REVIEW_URL ?? 'http://127.0.0.1:4342/tools/delivery-expansion-v1/ui-preview.html';
const output = path.resolve(process.env.DELIVERY_UI_REVIEW_OUT ?? 'docs/delivery-expansion-v1/ui-browser'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { kind: base.includes('draft') ? 'draft-readability-rendering-not-production' : 'isolated-real-rendering-mobile-touch-browser-not-phone', base, cases: [] };
try {
  for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    const assert = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
    const read = () => page.locator('[data-adventure-overlay="delivery-panel"]').evaluate(canvas => ({ ...canvas.dataset }));
    const point = name => page.evaluate(name => {
      const canvas = document.querySelector('[data-adventure-overlay="delivery-panel"]'), names = JSON.parse(canvas.dataset.targetNames), index = names.indexOf(name);
      if (index < 0 || !JSON.parse(canvas.dataset.enabled)[index]) throw new Error('disabled or unknown target ' + name);
      const box = JSON.parse(canvas.dataset.targets)[index], rect = window.deliveryExpansionUiGame.canvas.getBoundingClientRect(), size = window.deliveryExpansionUiGame.scale.gameSize;
      return { x: rect.x + (box.x + box.width / 2) / size.width * rect.width, y: rect.y + (box.y + box.height / 2) / size.height * rect.height };
    }, name);
    const tap = async name => { const p = await point(name); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(50); };
    const validate = async label => {
      const state = await read(), lines = JSON.parse(state.lines), images = JSON.parse(state.images), panel = JSON.parse(state.panel);
      assert(label + ': physical font inks fit line boxes', lines.every(line => line.ink.x >= line.box.x - 1 && line.ink.y >= line.box.y - 1 && line.ink.x + line.ink.width <= line.box.x + line.box.width + 1 && line.ink.y + line.ink.height <= line.box.y + line.box.height + 1));
      assert(label + ': fonts remain >=11 logical pixels', lines.every(line => line.fontSize >= 10.999), lines.filter(line => line.fontSize < 10.999));
      assert(label + ': illustrations/icons retain original aspect', images.every(image => Math.abs(image.width / image.height - image.sourceWidth / image.sourceHeight) < .000001));
      if (state.challenge === 'true' || state.mode === 'select' || state.mode === 'album') {
        const paperFraction = await page.locator('[data-adventure-overlay="delivery-panel"]').evaluate(canvas => {
          const box = JSON.parse(canvas.dataset.lines)[0].box, ratio = canvas.width / window.deliveryExpansionUiGame.scale.gameSize.width;
          const pixels = canvas.getContext('2d').getImageData(Math.round(box.x * ratio), Math.round(box.y * ratio), Math.round(box.width * ratio), Math.round(box.height * ratio)).data;
          let light = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] >= 190 && pixels[i + 1] >= 150 && pixels[i + 2] >= 80 && pixels[i + 3] >= 180) light++;
          return light / (pixels.length / 4);
        });
        assert(label + ': title sits on visible cream paper rather than wood', paperFraction >= .45, paperFraction);
      }
      const boxes = JSON.parse(state.targets), names = JSON.parse(state.targetNames), enabled = JSON.parse(state.enabled);
      const active = boxes.filter((_box, i) => enabled[i] && names[i] !== 'delivery-blocker');
      assert(label + ': targets contained and touch sized', active.every(box => box.width >= 32 && box.height >= 32 && box.x >= panel.x && box.y >= panel.y && box.x + box.width <= panel.x + panel.width + 1 && box.y + box.height <= panel.y + panel.height + 1));
      assert(label + ': active touch areas do not overlap', active.every((a, i) => active.every((b, j) => i === j || !(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height))));
      await page.screenshot({ path: path.join(output, label + '-' + width + 'x' + height + '-dpr' + dpr + '.png') });
      return state;
    };
    await page.goto(base); await page.waitForFunction(() => window.deliveryExpansionUiReady || window.deliveryExpansionUiBlocked, { timeout: 45000 });
    const missing = await page.evaluate(() => window.deliveryExpansionFontMissing);
    assert('all new chapter and UI glyphs exist in actual bitmap font', missing.length === 0, missing);
    assert('all 36 runtime assets have real expected dimensions and NEAREST filter', await page.evaluate(() => window.deliveryExpansionExpectedAssets.length === 36 && window.deliveryExpansionExpectedAssets.every(asset => {
      const texture = window.deliveryExpansionUi.textures.get(asset.key), image = texture.getSourceImage();
      return image.width === asset.width && image.height === asset.height && texture.source.every(source => source.scaleMode === 1);
    })));
    if (missing.length) {
      report.cases.push({ width, height, dpr, blocked: 'bitmap-font-missing-glyphs', errors, checks }); await context.close(); continue;
    }
    const bounds = await page.evaluate(() => { const r = window.deliveryExpansionUiGame.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scroll: document.documentElement.scrollHeight > innerHeight }; });
    assert('Canvas reaches screen edges and page cannot scroll', Math.abs(bounds.x) < 1 && Math.abs(bounds.y) < 1 && Math.abs(bounds.width - width) < 1 && Math.abs(bounds.height - height) < 1 && !bounds.scroll, bounds);
    let state = await validate('select-page-1'); assert('original two chapters occupy first page', JSON.parse(state.visibleChapterIds).join(',') === 'hill-goodnight-v1,dinner-for-you-v1');
    assert('first page previous arrow disabled', !JSON.parse(state.enabled)[JSON.parse(state.targetNames).indexOf('delivery-previous')]);
    await tap('delivery-next'); state = await validate('select-page-2'); assert('new windmill/rain chapters occupy second page', JSON.parse(state.visibleChapterIds).join(',') === 'windmill-invitation-v1,rainy-umbrella-v1');
    await tap('delivery-chapter:windmill-invitation-v1'); state = await validate('brief-windmill');
    assert('card opens actual brief and retains chapter ID', state.mode === 'brief' && state.chapterId === 'windmill-invitation-v1');
    await tap('delivery-back'); state = await read(); assert('brief returns to same list page', state.mode === 'select' && state.page === '1');
    await tap('delivery-next'); state = await validate('select-page-3'); assert('final page contains one lighthouse card', JSON.parse(state.visibleChapterIds).join(',') === 'lighthouse-starlight-v1');
    assert('final page next arrow disabled', !JSON.parse(state.enabled)[JSON.parse(state.targetNames).indexOf('delivery-next')]);
    await tap('delivery-chapter:lighthouse-starlight-v1'); await validate('brief-lighthouse'); await tap('delivery-back');
    await tap('delivery-album'); state = await validate('album-locked'); assert('only three new challenge stamps in album and all start locked', state.mode === 'album' && JSON.parse(state.albumCollected).join(',') === 'false,false,false');
    assert('inner pages keep modal touch lease', await page.evaluate(() => window.deliveryExpansionModalOwner()) === 'delivery');
    await tap('delivery-back'); assert('album returns to list without changing selection', (await read()).chapterId === 'lighthouse-starlight-v1' && (await read()).page === '2');
    const cdp = await context.newCDPSession(page), cancelPoint = await point('delivery-previous');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [cancelPoint] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await page.waitForTimeout(50);
    assert('cancelled touch restores unpressed state without navigation', (await read()).page === '2' && JSON.parse((await read()).pressed).length === 0);
    await page.evaluate(() => window.deliveryExpansionUi.show('brief', 'rainy-umbrella-v1')); await validate('brief-rain');
    const startPoint = await point('delivery-start');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [startPoint] });
    await page.evaluate(() => window.deliveryExpansionUi.scene.pause()); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => window.deliveryExpansionUi.scene.resume()); await page.waitForTimeout(50);
    assert('pause cancels held touch without accidental start', await page.evaluate(() => window.deliveryExpansionUi.starts.length === 0) && JSON.parse((await read()).pressed).length === 0);
    await tap('delivery-start'); assert('touch starts exactly the selected rain chapter once', await page.evaluate(() => JSON.stringify(window.deliveryExpansionUi.starts)) === '["rainy-umbrella-v1"]');
    assert('closed modal restores parent mailbox input', await page.evaluate(() => window.deliveryExpansionModalOwner() === 'mailbox' && window.deliveryExpansionUi.under.input.enabled));
    for (const [label, ordinary, hidden, expected] of [['none', 0, false, [true, false, false]], ['partial', 3, false, [true, false, false]], ['ordinary', 4, false, [true, true, false]], ['hidden-only', 0, true, [true, false, true]], ['full', 5, true, [true, true, true]]]) {
      await page.evaluate(({ ordinary, hidden }) => window.deliveryExpansionUi.show('success', 'windmill-invitation-v1', ordinary, hidden), { ordinary, hidden });
      state = await validate('result-' + label); const result = JSON.parse(state.result);
      assert('result ' + label + ': individual conditions and actual count', result.ordinary === ordinary && result.hidden === hidden && JSON.stringify(result.earned) === JSON.stringify(expected));
      await tap('delivery-card'); await validate('postcard-' + label); await tap('delivery-back'); assert('postcard returns to original result state', (await read()).mode === 'success' && JSON.parse((await read()).result).ordinary === ordinary);
    }
    await page.evaluate(() => window.deliveryExpansionUi.show('success', 'rainy-umbrella-v1', 5, true, true)); state = await validate('result-save-failed'); assert('write failure visibly reported', JSON.parse(state.lines).some(line => line.text === '暂未保存'));
    for (const id of ['hill-goodnight-v1', 'dinner-for-you-v1']) {
      await page.evaluate(id => window.deliveryExpansionUi.show('success', id), id); state = await validate('legacy-' + id);
      assert('legacy result ' + id + ' has no fictional rating', state.challenge === 'false' && JSON.parse(state.result) === null && !JSON.parse(state.lines).some(line => /本局评价|投递邮票|纪念邮票/.test(line.text)));
      assert('legacy result ' + id + ' retains original two-action flow', !JSON.parse(state.enabled)[JSON.parse(state.targetNames).indexOf('delivery-card')]);
    }
    await page.evaluate(() => window.deliveryExpansionUi.show('failure', 'lighthouse-starlight-v1', 5, true)); state = await validate('failure-progress'); assert('failure shows collection progress but awards no stars', JSON.parse(state.result).stars === 0 && JSON.parse(state.result).ordinary === 5);
    await tap('delivery-start'); assert('failure retry retains lighthouse chapter', await page.evaluate(() => window.deliveryExpansionUi.starts.at(-1)) === 'lighthouse-starlight-v1');
    await page.evaluate(() => { window.deliveryExpansionUi.save('windmill-invitation-v1'); window.deliveryExpansionUi.save('rainy-umbrella-v1'); window.deliveryExpansionUi.show('select', 'windmill-invitation-v1'); });
    state = await validate('select-best-records'); assert('new cards show real best stars and collection state', JSON.parse(state.lines).filter(line => line.text.includes('已收藏')).length === 2);
    await tap('delivery-album'); state = await validate('album-collected'); assert('album unlocks only successful collected keepsakes', JSON.parse(state.albumCollected).join(',') === 'true,true,false');
    await tap('delivery-back'); assert('all UI taps remain exclusive from underlying menu', await page.evaluate(() => window.deliveryExpansionUi.underClicks === 0));
    assert('generated runtime textures use nearest filtering in WebGL', await page.evaluate(() => window.deliveryExpansionUi.textures.list['delivery-expansion-ui-rating-gold'].source.every(source => source.scaleMode === 1)));
    const before = await page.evaluate(() => ({ render: window.deliveryExpansionUiGame.events.listenerCount('postrender'), pause: window.deliveryExpansionUi.events.listenerCount('pause'), resume: window.deliveryExpansionUi.events.listenerCount('resume') }));
    await page.evaluate(() => window.deliveryExpansionUi.panel.clear());
    assert('manual clear removes panel render/pause/resume listeners', await page.evaluate(before => window.deliveryExpansionUiGame.events.listenerCount('postrender') === before.render - 1 && window.deliveryExpansionUi.events.listenerCount('pause') === before.pause - 2 && window.deliveryExpansionUi.events.listenerCount('resume') === before.resume - 1, before));
    assert('manual clear destroys all owned touch targets and Canvas', await page.locator('[data-adventure-overlay="delivery-panel"]').count() === 0 && await page.evaluate(() => !window.deliveryExpansionUi.children.list.some(object => object.name.startsWith('delivery-'))));
    await page.evaluate(() => window.deliveryExpansionUi.showHud('windmill-invitation-v1', 4, true)); await page.waitForTimeout(60);
    const hud = await page.locator('[data-adventure-overlay="delivery-hud"]').evaluate(canvas => ({ ...canvas.dataset }));
    assert('chapter HUD uses independent real stamp counts', hud.ordinary === '4' && hud.hidden === 'true');
    await page.screenshot({ path: path.join(output, 'hud-' + width + 'x' + height + '-dpr' + dpr + '.png') });
    await page.evaluate(() => window.deliveryExpansionUi.clearFixture()); await page.waitForTimeout(40);
    assert('scene exit removes all delivery overlays', await page.locator('[data-adventure-overlay^="delivery-"]').count() === 0);
    assert('no browser runtime error', errors.length === 0, errors);
    report.cases.push({ width, height, dpr, errors, checks }); await context.close();
  }
} finally { await browser.close(); }
report.passed = report.cases.length === 8 && report.cases.every(item => item.checks.every(check => check.passed));
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, checks: report.cases.reduce((sum, item) => sum + item.checks.length, 0), failures: report.cases.flatMap(item => item.checks.filter(check => !check.passed).map(check => ({ viewport: `${item.width}x${item.height}@${item.dpr}`, ...check }))) }, null, 2));
if (!report.passed) process.exitCode = 1;
