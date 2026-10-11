import Phaser from "phaser";

export function addCanvasTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) return;
  if (!scene.textures.addCanvas(key, canvas)) throw new Error(`Unable to register texture: ${key}`);
}

export function removeConnectedLightBackground(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const width = source.width;
  const height = source.height;
  if (!width || !height) throw new Error("Sheep texture has no dimensions");

  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const workContext = work.getContext("2d", { willReadFrequently: true });
  if (!workContext) throw new Error("Canvas 2D context is unavailable");
  workContext.imageSmoothingEnabled = false;
  workContext.drawImage(source, 0, 0);

  const imageData = workContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let tail = 0;
  const isBackground = (pixel: number): boolean => {
    const red = pixels[pixel];
    const green = pixels[pixel + 1];
    const blue = pixels[pixel + 2];
    return red > 232 && green > 232 && blue > 232 && Math.max(red, green, blue) - Math.min(red, green, blue) < 18;
  };
  const enqueue = (position: number): void => {
    if (visited[position]) return;
    if (!isBackground(position * 4)) return;
    visited[position] = 1;
    queue[tail] = position;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  for (let head = 0; head < tail; head += 1) {
    const position = queue[head];
    const x = position % width;
    const y = Math.floor(position / width);
    pixels[position * 4 + 3] = 0;
    if (x > 0) enqueue(position - 1);
    if (x < width - 1) enqueue(position + 1);
    if (y > 0) enqueue(position - width);
    if (y < height - 1) enqueue(position + width);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0 || maxY < 0) throw new Error("Sheep texture has no visible subject");

  workContext.putImageData(imageData, 0, 0);
  const padding = 3;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - cropX + padding + 1);
  const cropHeight = Math.min(height - cropY, maxY - cropY + padding + 1);
  const output = document.createElement("canvas");
  output.width = cropWidth;
  output.height = cropHeight;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Canvas 2D context is unavailable");
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(work, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return output;
}

export function createPixelSheepFallback(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 42;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  const sprite = [
    ".....OOO.......",
    "...OOWWO.......",
    "..OWWWWWOOO....",
    ".OWWWWWWWOFOO..",
    "OWWWWWWWWOFFEN.",
    "OWWWWWWWWWOFFO.",
    "OWWWWWWWWOOO...",
    ".OWWWWWWO......",
    "..OOSSSOO......",
  ];
  const colors: Record<string, string> = {
    O: "#4a382f",
    W: "#fff7da",
    S: "#ded4b7",
    F: "#c28d6a",
    E: "#4a382f",
    N: "#d96d54",
  };
  const scale = 3;
  context.fillStyle = colors.O;
  context.fillRect(0, 23, 6, 5);
  context.fillStyle = colors.W;
  context.fillRect(1, 22, 4, 4);
  for (let row = 0; row < sprite.length; row += 1) {
    for (let column = 0; column < sprite[row].length; column += 1) {
      const cell = sprite[row][column];
      if (cell === ".") continue;
      context.fillStyle = colors[cell];
      context.fillRect(3 + column * scale, row * scale, scale, scale);
    }
  }
  context.fillStyle = colors.O;
  context.fillRect(13, 28, 6, 9);
  context.fillRect(28, 28, 6, 9);
  context.fillStyle = colors.F;
  context.fillRect(14, 33, 4, 4);
  context.fillRect(29, 33, 4, 4);
  return canvas;
}
