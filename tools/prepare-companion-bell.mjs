import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const { chromium } = createRequire(import.meta.url)("C:/Users/mechrevo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const root = new URL("../assets/companions/", import.meta.url);
const source = await readFile(new URL("sheep-bell-v1-source.png", root));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const work = document.createElement("canvas"); work.width = image.width; work.height = image.height;
    const context = work.getContext("2d"); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, work.width, work.height).data;
    let left = work.width, top = work.height, right = -1, bottom = -1;
    for (let y = 0; y < work.height; y++) for (let x = 0; x < work.width; x++) {
      if (pixels[(y * work.width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < 0) throw Error("Empty bell master");
    const crop = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    const scale = Math.min(24 / crop.width, 28 / crop.height), width = Math.round(crop.width * scale), height = Math.round(crop.height * scale);
    const canvas = document.createElement("canvas"); canvas.width = 28; canvas.height = 32;
    const target = canvas.getContext("2d"); target.imageSmoothingEnabled = false;
    target.drawImage(image, crop.x, crop.y, crop.width, crop.height, Math.floor((28 - width) / 2), Math.floor((32 - height) / 2), width, height);
    const data = target.getImageData(0, 0, 28, 32);
    const palette = [[65,35,18],[113,62,24],[182,102,27],[235,150,36],[255,197,65],[255,225,128],[255,248,212],[50,70,15],[95,125,27],[153,183,57]];
    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i + 3] < 128) { data.data.fill(0, i, i + 4); continue; }
      let nearest = Infinity, color = palette[0];
      for (const candidate of palette) {
        const distance = candidate.reduce((sum, value, channel) => sum + (value - data.data[i + channel]) ** 2, 0);
        if (distance < nearest) { nearest = distance; color = candidate; }
      }
      data.data.set([...color, 255], i);
    }
    target.putImageData(data, 0, 0);
    return { png: canvas.toDataURL("image/png").split(",")[1], source: { width: image.width, height: image.height }, crop,
      runtime: { width: 28, height: 32, subjectWidth: width, subjectHeight: height, interpolation: "nearest", alphaThreshold: 128, palette } };
  }, source.toString("base64"));
  const png = Buffer.from(result.png, "base64"); delete result.png;
  await writeFile(new URL("sheep-bell-v1.png", root), png);
  await writeFile(new URL("sheep-bell-v1.processing.json", root), JSON.stringify({ tool: "built-in image_gen", transparentBackground: true, originalCopiedWithoutChanges: true,
    prompt: "sheep-bell-v1.prompt.txt", sourceSha256: createHash("sha256").update(source).digest("hex"), runtimeSha256: createHash("sha256").update(png).digest("hex"), ...result }, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
