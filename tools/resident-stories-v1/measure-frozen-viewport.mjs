import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url = 'http://127.0.0.1:4386/';
const extraOnly = process.env.MEASURE_EXTRA_ONLY === '1';
const profiles = extraOnly ? [[1672, 941, 1]] : [[480, 270], [896, 414], [844, 390], [800, 600]].flatMap(([width, height]) => [1, 2].map(dpr => [width, height, dpr]));
const report = { url, method: 'Read-only geometry measurement of the frozen production menu; independent from the completed touch matrix.', profiles: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [width, height, dpr] of profiles) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      const request = page.waitForRequest(request => /\/assets\/main-[^/]+\.js$/.test(request.url()));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const main = (await request).url();
      await page.evaluate(async main => { window.measureGame = (await import(main)).game.instance; }, main);
      await page.waitForFunction(() => window.measureGame?.scene.isActive('MenuScene'));
      await page.waitForTimeout(100);
      const measured = await page.evaluate(() => {
        const game = window.measureGame;
        const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        return {
          actualDpr: devicePixelRatio, window: { width: innerWidth, height: innerHeight },
          container: rect(document.getElementById('game-container')),
          canvasCss: rect(game.canvas), canvasStyle: { width: game.canvas.style.width, height: game.canvas.style.height },
          logical: { width: game.scale.gameSize.width, height: game.scale.gameSize.height },
          canvasBacking: { width: game.canvas.width, height: game.canvas.height },
        };
      });
      report.profiles.push({ requested: { width, height, dpr }, mainModule: main, ...measured });
      if (extraOnly) await page.screenshot({ path: 'docs/resident-stories-v1/viewport-final-menu-style-1672-menu.png' });
      console.log(JSON.stringify(report.profiles.at(-1)));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile('docs/resident-stories-v1/' + (extraOnly ? 'viewport-1672-final-menu-style.json' : 'viewport-final-menu-style.json'), JSON.stringify(report, null, 2));
}
