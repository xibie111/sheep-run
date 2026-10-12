import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 480, height: 270 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => errors.push(request.url() + ' ' + request.failure()?.errorText));
await page.goto('http://127.0.0.1:4342/tools/delivery-expansion-v1/ui-preview.html'); await page.waitForTimeout(1500);
const report = { kind: 'current-font-and-runtime-assets-preflight-not-full-ui-acceptance', errors, state: await page.evaluate(() => ({ ready: window.deliveryExpansionUiReady, missing: window.deliveryExpansionFontMissing,
  data: document.querySelector('[data-adventure-overlay="delivery-panel"]')?.dataset,
  textures: window.deliveryExpansionUi?.textures.getTextureKeys() })) };
await mkdir('docs/delivery-expansion-v1/ui-browser', { recursive: true });
await writeFile('docs/delivery-expansion-v1/ui-browser/preflight.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
