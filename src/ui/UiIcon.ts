import type Phaser from "phaser";

/** Center the visible ink, not the source PNG's transparent margins. */
export function addUiIcon(scene: Phaser.Scene, x: number, y: number, key: string, size: number): Phaser.GameObjects.Image {
  const texture = scene.textures.get(key);
  const frameName = "ui-visible-ink";
  if (!texture.has(frameName)) {
    const source = texture.getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let row = 0; row < canvas.height; row++) {
      for (let column = 0; column < canvas.width; column++) {
        if (pixels[(row * canvas.width + column) * 4 + 3]! < 16) continue;
        left = Math.min(left, column); top = Math.min(top, row);
        right = Math.max(right, column); bottom = Math.max(bottom, row);
      }
    }
    // Named frames change Phaser's default frame: retain the full original first.
    if (texture.firstFrame === "__BASE") texture.add("ui-original", 0, 0, 0, canvas.width, canvas.height);
    texture.add(frameName, 0, left, top, Math.max(1, right - left + 1), Math.max(1, bottom - top + 1));
  }
  const icon = scene.add.image(x, y, key, frameName);
  return icon.setScale(size / Math.max(icon.frame.width, icon.frame.height));
}
