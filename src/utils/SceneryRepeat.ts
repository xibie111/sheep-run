import { ILLUSTRATED_REPEAT_WIDTH } from "../data/backgroundAssets";
import { WORLD } from "../game/Constants";

const OVERLAP = 48;
const QUIET_WIDTH = 180;

/** Match clear sky gradients across painted panels while retaining clouds and land. */
export function matchScenerySky(pixels: Uint8ClampedArray, width: number, reference: Uint8ClampedArray, referenceWidth: number, height: number): void {
  const clearSky = (r: number, g: number, b: number): boolean => r < 125 && g > 110 && b > 200 && b - g > 35 && g - r > 45;
  for (let y = 0; y < Math.min(height, 100); y++) {
    const channels: number[][] = [[], [], []];
    for (let x = 0; x < referenceWidth; x++) {
      const i = (y * referenceWidth + x) * 4;
      if (clearSky(reference[i]!, reference[i + 1]!, reference[i + 2]!)) {
        for (let c = 0; c < 3; c++) channels[c]!.push(reference[i + c]!);
      }
    }
    if (!channels[0]!.length) continue;
    const color = channels.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!);
    const amount = Math.min(1, (100 - y) / 20);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!clearSky(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)) continue;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(pixels[i + c]! + (color[c]! - pixels[i + c]!) * amount);
    }
  }
}

/** Format one atlas row with a uniform scale and the original running verge. */
export function sceneryExtension(atlas: HTMLImageElement, band: "far" | "near", nearOffsetY = 0): HTMLCanvasElement {
  const source = document.createElement("canvas");
  source.width = atlas.width; source.height = Math.floor(atlas.height / 2);
  const paint = source.getContext("2d")!; paint.imageSmoothingEnabled = false;
  paint.drawImage(atlas, 0, band === "far" ? 0 : Math.ceil(atlas.height / 2), source.width, source.height, 0, 0, source.width, source.height);
  if (band === "near") {
    const image = paint.getImageData(0, 0, source.width, source.height);
    retainGroundConnectedAlpha(image.data, source.width, source.height);
    paint.putImageData(image, 0, 0);
  }
  const scale = band === "far" ? WORLD.height / source.height
    : (WORLD.height - (WORLD.groundY - 7)) / (source.height * (1 - 0.72));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale); canvas.height = WORLD.height;
  const ctx = canvas.getContext("2d")!; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, band === "far" ? 0 : WORLD.height - source.height * scale + nearOffsetY, source.width * scale, source.height * scale);
  return canvas;
}

/** Match the road's row palette without smoothing its stones or changing the verge. */
export function matchSceneryRoad(pixels: Uint8ClampedArray, width: number, reference: Uint8ClampedArray, referenceWidth: number, height: number): void {
  for (let y = WORLD.groundY - 4; y < height; y++) {
    const mean = (data: Uint8ClampedArray, rowWidth: number): number[] => {
      const sums = [0, 0, 0]; let count = 0;
      for (let x = 0; x < rowWidth; x++) {
        const i = (y * rowWidth + x) * 4;
        if (data[i + 3]! < 128) continue;
        for (let c = 0; c < 3; c++) sums[c]! += data[i + c]!;
        count++;
      }
      return sums.map(value => count ? value / count : 0);
    };
    const target = mean(reference, referenceWidth), current = mean(pixels, width);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3]! < 128) continue;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.max(0, Math.min(255, Math.round(pixels[i + c]! + target[c]! - current[c]!)));
    }
  }
}

/** Discard isolated alpha speckles in generated transparent sky, retaining the meadow. */
export function retainGroundConnectedAlpha(pixels: Uint8ClampedArray, width: number, height: number): void {
  const connected = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = (index: number): void => {
    if (!connected[index] && pixels[index * 4 + 3]! >= 128) { connected[index] = 1; queue[tail++] = index; }
  };
  for (let x = 0; x < width; x++) visit((height - 1) * width + x);
  while (head < tail) {
    const index = queue[head++]!, x = index % width;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const next = index + dy * width + dx;
      if (x + dx >= 0 && x + dx < width && next >= 0 && next < connected.length) visit(next);
    }
  }
  for (let index = 0; index < connected.length; index++) pixels[index * 4 + 3] = connected[index] ? 255 : 0;
}

/** Join unflipped scenery along a low-error pixel path; never blur pixel artwork. */
export function joinSceneryPixels(
  destination: Uint8ClampedArray,
  destinationWidth: number,
  incoming: Uint8ClampedArray,
  incomingWidth: number,
  height: number,
  startX: number,
  overlap: number,
): void {
  const costs = new Float64Array(overlap * height);
  const parents = new Int16Array(overlap * height);
  // Keep both ends of a cyclic overlap intact: an edge-cut can expose a whole
  // unmatched column when the joined tail is moved to the start of the tile.
  const minimum = overlap >= 3 ? 1 : 0, maximum = overlap >= 3 ? overlap - 2 : overlap - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < overlap; x++) {
      if (x < minimum || x > maximum) { costs[y * overlap + x] = Infinity; continue; }
      const a = (y * destinationWidth + startX + x) * 4;
      const b = (y * incomingWidth + x) * 4;
      const alphaA = destination[a + 3]! / 255, alphaB = incoming[b + 3]! / 255;
      let error = 2 * (destination[a + 3]! - incoming[b + 3]!) ** 2;
      for (let c = 0; c < 3; c++) error += (destination[a + c]! * alphaA - incoming[b + c]! * alphaB) ** 2;
      // Center preference breaks ties in empty sky, keeping paths away from edges.
      error += Math.abs(x - overlap / 2) * 0.01;
      let parent = x;
      if (y > 0) {
        for (let candidate = Math.max(minimum, x - 1); candidate <= Math.min(maximum, x + 1); candidate++) {
          if (costs[(y - 1) * overlap + candidate]! < costs[(y - 1) * overlap + parent]!) parent = candidate;
        }
        error += costs[(y - 1) * overlap + parent]!;
      }
      costs[y * overlap + x] = error;
      parents[y * overlap + x] = parent;
    }
  }
  let seam = minimum;
  for (let x = minimum + 1; x <= maximum; x++) {
    if (costs[(height - 1) * overlap + x]! < costs[(height - 1) * overlap + seam]!) seam = x;
  }
  for (let y = height - 1; y >= 0; y--) {
    const sourceStart = (y * incomingWidth + seam) * 4;
    destination.set(incoming.subarray(sourceStart, (y + 1) * incomingWidth * 4), (y * destinationWidth + startX + seam) * 4);
    seam = parents[y * overlap + seam]!;
  }
}

/** Keep one farm/valley, then extend it with same-scale meadow and hillside crops. */
export function createSceneryRepeat(source: CanvasImageSource, band: "far" | "near", extension?: HTMLCanvasElement): HTMLCanvasElement {
  const original = document.createElement("canvas");
  original.width = WORLD.width; original.height = WORLD.height;
  const originalContext = original.getContext("2d")!;
  originalContext.imageSmoothingEnabled = false;
  originalContext.drawImage(source, 0, 0, WORLD.width, WORLD.height);
  const pixels = originalContext.getImageData(0, 0, WORLD.width, WORLD.height).data;
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = pixels[index]! >= 128 ? 255 : 0;
  if (extension && band === "far") matchScenerySky(pixels, WORLD.width, pixels, WORLD.width, WORLD.height);

  const repeatWidth = extension ? WORLD.width + extension.width - OVERLAP * 2 : ILLUSTRATED_REPEAT_WIDTH;
  const workingWidth = repeatWidth + OVERLAP;
  const working = new Uint8ClampedArray(workingWidth * WORLD.height * 4);
  const crop = (x: number, width: number): Uint8ClampedArray => {
    const result = new Uint8ClampedArray(width * WORLD.height * 4);
    for (let y = 0; y < WORLD.height; y++) {
      const start = (y * WORLD.width + x) * 4;
      result.set(pixels.subarray(start, start + width * 4), y * width * 4);
    }
    return result;
  };
  for (let y = 0; y < WORLD.height; y++) working.set(pixels.subarray(y * WORLD.width * 4, (y + 1) * WORLD.width * 4), y * workingWidth * 4);
  if (extension) {
    const extra = extension.getContext("2d")!.getImageData(0, 0, extension.width, WORLD.height).data;
    for (let index = 3; index < extra.length; index += 4) extra[index] = extra[index]! >= 128 ? 255 : 0;
    if (band === "far") matchScenerySky(extra, extension.width, pixels, WORLD.width, WORLD.height);
    else matchSceneryRoad(extra, extension.width, pixels, WORLD.width, WORLD.height);
    joinSceneryPixels(working, workingWidth, extra, extension.width, WORLD.height, WORLD.width - OVERLAP, OVERLAP);
  } else {
    const quiet = [crop(0, QUIET_WIDTH), crop(band === "far" ? WORLD.width - QUIET_WIDTH : 120, QUIET_WIDTH)];
    let end = WORLD.width;
    for (let index = 0; index < 4; index++) {
      joinSceneryPixels(working, workingWidth, quiet[index % 2]!, QUIET_WIDTH, WORLD.height, end - OVERLAP, OVERLAP);
      end += QUIET_WIDTH - OVERLAP;
    }
  }
  // Join the last meadow back to the original's beginning before cropping the cycle.
  joinSceneryPixels(working, workingWidth, crop(0, OVERLAP), OVERLAP, WORLD.height, repeatWidth, OVERLAP);
  const canvas = document.createElement("canvas");
  canvas.width = repeatWidth; canvas.height = WORLD.height;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    const row = y * workingWidth * 4;
    image.data.set(working.subarray(row, row + canvas.width * 4), y * canvas.width * 4);
    image.data.set(working.subarray(row + canvas.width * 4, row + workingWidth * 4), y * canvas.width * 4);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** Use one continuous authored far panorama rather than splicing two hill systems. */
export function createPanoramaRepeat(source: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = WORLD.height / source.height;
  const overlap = 96;
  const width = Math.round(source.width * scale);
  canvas.width = width; canvas.height = WORLD.height;
  const context = canvas.getContext("2d")!; context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, width, WORLD.height);
  const image = context.getImageData(0, 0, width, WORLD.height);
  matchScenerySky(image.data, width, image.data, width, WORLD.height);
  const beginning = new Uint8ClampedArray(overlap * WORLD.height * 4);
  for (let y = 0; y < WORLD.height; y++) beginning.set(image.data.subarray(y * width * 4, (y * width + overlap) * 4), y * overlap * 4);
  joinSceneryPixels(image.data, width, beginning, overlap, WORLD.height, width - overlap, overlap);
  canvas.width = width - overlap;
  const result = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < WORLD.height; y++) {
    result.data.set(image.data.subarray((y * width + overlap) * 4, (y + 1) * width * 4), y * canvas.width * 4);
  }
  context.putImageData(result, 0, 0);
  return canvas;
}

/** Continue the actual last road row into taller views, preserving horizontal phase. */
export function createRoadFill(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = 32;
  const context = canvas.getContext("2d")!; context.imageSmoothingEnabled = false;
  for (let y = 0; y < canvas.height; y++) {
    const row = source.height - 1 - (y < 16 ? y : 31 - y);
    context.drawImage(source, 0, row, source.width, 1, 0, y, source.width, 1);
  }
  return canvas;
}
