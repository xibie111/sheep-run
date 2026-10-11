// Deterministic packing only: artwork comes from the built-in image generator.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = new URL("../../", import.meta.url);
const definition = JSON.parse(await readFile(new URL(process.argv[2] || "assets/skins/generated-v2/sleep-cap-prompts.json", root), "utf8"));
const skins = [...definition.skins, ...(definition.additionalSkins ?? [])];
const runtime = new URL(definition.outputDirectory || "assets/skins/runtime-v2/", root);
const review = new URL(definition.reviewDirectory || "docs/skin-review/2026-10-10/", root);
await mkdir(runtime, { recursive: true });
await mkdir(review, { recursive: true });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const manifest = { frameWidth: 128, frameHeight: 128, frameCount: 15, packing: "15 separate alpha subjects, ordered in 5 columns and 3 rows", visibleFrame: { width: 128, height: 112, topPadding: 16 }, skins: [] };
try {
  const page = await browser.newPage();
  for (const skin of skins) {
    const source = await readFile(new URL(skin.source, root));
    const packed = await page.evaluate(async data => {
      const source = new Image();
      source.src = data;
      await source.decode();
      const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
      const full = canvas(source.width, source.height), fullCtx = full.getContext("2d", { willReadFrequently: true });
      fullCtx.drawImage(source, 0, 0);
      const parts = [], bounds = [], raster = fullCtx.getImageData(0, 0, source.width, source.height);
      const labels = new Int32Array(source.width * source.height), components = [];
      let component = 0;
      // Generated pose spacing is approximate. Extract complete subjects before
      // packing so a hoof crossing an imagined grid line never becomes a ghost.
      for (let n = 0; n < labels.length; n++) {
        if (labels[n] || raster.data[n * 4 + 3] < 128) continue;
        component++;
        const todo = [n]; labels[n] = component;
        let area = 0, minX = source.width, minY = source.height, maxX = -1, maxY = -1;
        while (todo.length) {
          const p = todo.pop(), x = p % source.width, y = Math.floor(p / source.width);
          area++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dy) || x + dx < 0 || x + dx >= source.width || y + dy < 0 || y + dy >= source.height) continue;
            const q = (y + dy) * source.width + x + dx;
            if (!labels[q] && raster.data[q * 4 + 3] >= 128) { labels[q] = component; todo.push(q); }
          }
        }
        if (area > 1000) components.push({ component, area, minX, minY, maxX, maxY });
      }
      if (components.length !== 15) throw Error(`Expected 15 separate subjects, found ${components.length}`);
      components.sort((a, b) => (a.minY + a.maxY) - (b.minY + b.maxY));
      const ordered = [0, 1, 2].flatMap(row => components.slice(row * 5, (row + 1) * 5).sort((a, b) => (a.minX + a.maxX) - (b.minX + b.maxX)));
      for (let i = 0; i < ordered.length; i++) {
        const subject = ordered[i], width = subject.maxX - subject.minX + 1, height = subject.maxY - subject.minY + 1;
        if (subject.minX <= 0 || subject.minY <= 0 || subject.maxX >= source.width - 1 || subject.maxY >= source.height - 1) throw Error(`Source pose ${i} touches image edge`);
        const pixels = fullCtx.getImageData(subject.minX, subject.minY, width, height);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const n = (y * width + x) * 4, belongs = labels[(subject.minY + y) * source.width + subject.minX + x] === subject.component;
          pixels.data[n + 3] = belongs ? 255 : 0;
          if (!belongs) pixels.data[n] = pixels.data[n + 1] = pixels.data[n + 2] = 0;
        }
        const cleaned = canvas(width, height); cleaned.getContext("2d").putImageData(pixels, 0, 0);
        parts.push({ cleaned, minX: 0, minY: 0, width, height });
        bounds.push({ i, component: subject.component, area: subject.area, bounds: [subject.minX, subject.minY, subject.maxX + 1, subject.maxY + 1] });
      }
      const scale = Math.min(120 / Math.max(...parts.map(p => p.width)), 104 / Math.max(...parts.map(p => p.height)));
      const output = canvas(640, 384), ctx = output.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      const frames = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i], width = Math.round(part.width * scale), height = Math.round(part.height * scale);
        const x = Math.floor((128 - width) / 2), bottom = i === 5 ? 120 : 128, y = bottom - height;
        if (x < 0 || y < 16) throw Error(`Pose ${i} exceeds render cell`);
        ctx.drawImage(part.cleaned, part.minX, part.minY, part.width, part.height, (i % 5) * 128 + x, Math.floor(i / 5) * 128 + y, width, height);
        const pixels = ctx.getImageData((i % 5) * 128, Math.floor(i / 5) * 128, 128, 128).data;
        let visible = 0, lastRow = -1, firstRow = 128, softAlpha = 0;
        for (let py = 0; py < 128; py++) for (let px = 0; px < 128; px++) {
          const alpha = pixels[(py * 128 + px) * 4 + 3];
          if (alpha && alpha !== 255) softAlpha++;
          if (alpha) { visible++; lastRow = Math.max(lastRow, py); firstRow = Math.min(firstRow, py); }
        }
        frames.push({ i, x, y, width, height, bottom, visiblePixels: visible, firstRow, lastRow, softAlpha });
      }
      return { data: output.toDataURL("image/png"), sourceSize: [source.width, source.height], scale, sourceBounds: bounds, frames };
    }, `data:image/png;base64,${source.toString("base64")}`);
    for (const frame of packed.frames) {
      assert.ok(frame.visiblePixels > 0 && frame.firstRow >= 16, `${skin.id} frame ${frame.i}: padding`);
      assert.equal(frame.softAlpha, 0, `${skin.id} frame ${frame.i}: hard alpha`);
      assert.equal(frame.lastRow + 1, frame.bottom, `${skin.id} frame ${frame.i}: baseline`);
    }
    const png = Buffer.from(packed.data.split(",")[1], "base64");
    await writeFile(new URL(skin.runtime, root), png);
    const { data, ...measurements } = packed;
    manifest.skins.push({ id: skin.id, name: skin.name, source: skin.source, runtime: skin.runtime, sourceHash: hash(source), runtimeHash: hash(png), ...measurements });
    console.log(`${skin.id}: 640x384, 15 poses; uniform scale ${packed.scale.toFixed(4)}, clean alpha and aligned feet`);
  }
  await writeFile(new URL("manifest.json", runtime), JSON.stringify(manifest, null, 2) + "\n");
  const images = [];
  for (const [name, path] of [["奶油白", "assets/skins/runtime-v1/white-sheet.png"], ...skins.map(s => [s.name, s.runtime])]) {
    images.push({ name, data: `data:image/png;base64,${(await readFile(new URL(path, root))).toString("base64")}` });
  }
  const contact = await page.evaluate(async images => {
    const canvas = document.createElement("canvas"); canvas.width = images.length * 256; canvas.height = 300;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#f3e8ce"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < images.length; i++) {
      const image = new Image(); image.src = images[i].data; await image.decode();
      ctx.drawImage(image, 0, 16, 128, 112, i * 256, 12, 256, 224);
      ctx.fillStyle = "#542b16"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText(images[i].name, i * 256 + 128, 278);
    }
    return canvas.toDataURL("image/png");
  }, images);
  await writeFile(new URL("new-skin-preview.png", review), Buffer.from(contact.split(",")[1], "base64"));
} finally { await browser.close(); }
