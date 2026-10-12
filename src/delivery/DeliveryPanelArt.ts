import type Phaser from 'phaser';
import type { ArtRect } from '../ui/MenuArtLayout';

/** Illustrations/icons are always contained with one scale, never stretched. */
export function deliveryFitArt(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, key: string, box: ArtRect) {
  const image = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const ratio = Math.min(box.width / image.width, box.height / image.height);
  const rect = { x: box.x + (box.width - image.width * ratio) / 2, y: box.y + (box.height - image.height * ratio) / 2,
    width: image.width * ratio, height: image.height * ratio };
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  return { key, sourceWidth: image.width, sourceHeight: image.height, ...rect };
}

/** Only straight paper/wood centers extend; decorated corners retain their proportions. */
export function deliveryFrameArt(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, key: string, box: ArtRect, edge = .12) {
  const image = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const sx = Math.round(image.width * edge), sy = Math.round(image.height * edge);
  const dx = Math.min(box.width / 3, sx * box.height / image.height), dy = Math.min(box.height / 3, sy * box.height / image.height);
  const srcX = [0, sx, image.width - sx], srcY = [0, sy, image.height - sy];
  const srcW = [sx, image.width - 2 * sx, sx], srcH = [sy, image.height - 2 * sy, sy];
  const transform = ctx.getTransform();
  const px = [box.x, box.x + dx, box.x + box.width - dx, box.x + box.width].map(value => Math.round(value * transform.a + transform.e));
  const py = [box.y, box.y + dy, box.y + box.height - dy, box.y + box.height].map(value => Math.round(value * transform.d + transform.f));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(image,
    srcX[x], srcY[y], srcW[x], srcH[y], px[x], py[y], px[x + 1] - px[x], py[y + 1] - py[y]);
  ctx.restore();
}
