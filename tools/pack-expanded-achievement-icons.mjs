/** Prepare generated cutouts as native pixel icons; originals stay untouched. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)('C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1]; if (!value || value.startsWith('--')) throw Error(`Missing ${name} value`);
  return value;
};
const root = new URL('../', import.meta.url);
const bundle = option('--bundle', 'assets/achievement-icons-v2/');
const assets = new URL(bundle.endsWith('/') ? bundle : bundle + '/', root);
const catalogSource = await readFile(new URL(option('--catalog', 'src/data/expandedAchievements.ts'), root), 'utf8');
const catalog = [...catalogSource.matchAll(/\{id:"([^"]+)",metric:"[^"]+",name:"([^"]+)"/g)].map(match => ({ id: match[1], name: match[2] }));
assert.equal(catalog.length, Number(option('--expected', '12')));
const partial = process.argv.includes('--partial'), entries = [], missing = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(new URL('runtime/', assets), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage();
  for (const item of catalog) {
    const sourceUrl = new URL(`sources/${item.id}.png`, assets);
    let bytes;
    try { bytes = await readFile(sourceUrl); } catch (error) { if (partial && error.code === 'ENOENT') { missing.push(item.id); continue; } throw error; }
    const result = await page.evaluate(async base64 => {
      const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
      const scratch = document.createElement('canvas'); scratch.width = image.width; scratch.height = image.height;
      const ctx = scratch.getContext('2d'); ctx.drawImage(image, 0, 0);
      const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
      let left = image.width, top = image.height, right = -1, bottom = -1, transparent = 0, opaque = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const alpha = rgba[(y * image.width + x) * 4 + 3];
        if (alpha === 0) transparent++; if (alpha === 255) opaque++;
        if (alpha >= 128) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
      }
      if (!transparent || !opaque || right < left) throw Error('Expected a real generated transparent cutout');
      left = Math.max(0, left - 1); top = Math.max(0, top - 1); right = Math.min(image.width, right + 2); bottom = Math.min(image.height, bottom + 2);
      const crop = { x: left, y: top, width: right - left, height: bottom - top };
      const scale = 28 / Math.max(crop.width, crop.height);
      const contentSize = [Math.max(1, Math.round(crop.width * scale)), Math.max(1, Math.round(crop.height * scale))];
      const position = [Math.floor((32 - contentSize[0]) / 2), Math.floor((32 - contentSize[1]) / 2)];
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const out = canvas.getContext('2d'); out.imageSmoothingEnabled = false;
      out.drawImage(image, crop.x, crop.y, crop.width, crop.height, ...position, ...contentSize);
      const pixels = out.getImageData(0, 0, 32, 32);
      // Native hard-alpha pixels keep the icon crisp at small game UI sizes.
      let visible = 0;
      for (let i = 3; i < pixels.data.length; i += 4) { pixels.data[i] = pixels.data[i] >= 128 ? 255 : 0; if (pixels.data[i]) visible++; }
      if (visible < 80) throw Error('Generated subject becomes unreadable at native icon size');
      out.putImageData(pixels, 0, 0);
      return { png: canvas.toDataURL('image/png').split(',')[1], sourceSize: [image.width, image.height], crop, contentSize, position, visible };
    }, bytes.toString('base64'));
    const runtime = Buffer.from(result.png, 'base64'); delete result.png;
    await writeFile(new URL(`runtime/${item.id}.png`, assets), runtime);
    assert.equal(hash(await readFile(sourceUrl)), hash(bytes), 'original source stays unchanged');
    entries.push({ ...item, source: `sources/${item.id}.png`, sourceSha256: hash(bytes), ...result,
      runtime: `runtime/${item.id}.png`, runtimeSize: [32, 32], runtimeSha256: hash(runtime) });
  }
  const font = await readFile(new URL('tools/font-sources/ZCOOLKuaiLe-Regular.ttf', root));
  const preview = await page.evaluate(async ({ entries, images, font }) => {
    const face = new FontFace('PasturePreview', Uint8Array.from(atob(font), c => c.charCodeAt(0)).buffer); await face.load(); document.fonts.add(face);
    const canvas = document.createElement('canvas'); canvas.width = 4 * 144; canvas.height = 3 * 150;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff1d0'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
    for (let index = 0; index < entries.length; index++) {
      const image = new Image(); image.src = 'data:image/png;base64,' + images[index]; await image.decode();
      const x = index % 4 * 144, y = Math.floor(index / 4) * 150;
      ctx.drawImage(image, x + 16, y + 4, 112, 112); ctx.fillStyle = '#4b2a1a'; ctx.font = '16px PasturePreview'; ctx.textAlign = 'center';
      ctx.fillText(entries[index].name, x + 72, y + 134);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, { entries, images: await Promise.all(entries.map(async entry => (await readFile(new URL(entry.runtime, assets))).toString('base64'))), font: font.toString('base64') });
  await writeFile(new URL('preview.png', assets), Buffer.from(preview, 'base64'));
  await writeFile(new URL('processing.json', assets), JSON.stringify({ tool: 'tools/pack-expanded-achievement-icons.mjs',
    generatedBy: 'built-in imagegen, one independent call per icon', runtimeSize: [32, 32], resampling: 'NEAREST',
    alpha: 'Original generated alpha retained in sources; runtime alpha threshold 128; no recoloring or invented content',
    complete: !missing.length, missing, entries }, null, 2));
  console.log(JSON.stringify({ complete: !missing.length, icons: entries.length, missing }));
} finally { await browser.close(); }
