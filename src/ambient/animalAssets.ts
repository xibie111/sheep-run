import type Phaser from 'phaser';
import { addCanvasTexture } from '../utils/TextureUtils';
import frames from '../../assets/ambient-life-v1/frames.json';
export type AnimalFrame = keyof typeof frames;
export const ANIMAL_SOURCE = { key: 'ambient-life-source', url: new URL('../../assets/ambient-life-v1/runtime/animals-atlas.png', import.meta.url).href } as const;
export const ANIMAL_TEXTURE = 'ambient-life-atlas';
export function prepareAnimalArt(scene: Phaser.Scene): void {
  const source = scene.textures.get(ANIMAL_SOURCE.key).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d')!; context.imageSmoothingEnabled = false; context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i]! >= 128 ? 255 : 0;
  context.putImageData(pixels, 0, 0);
  addCanvasTexture(scene, ANIMAL_TEXTURE, canvas);
  const texture = scene.textures.get(ANIMAL_TEXTURE);
  for (const [name, f] of Object.entries(frames)) {
    if (f.x < 0 || f.y < 0 || f.width <= 0 || f.height <= 0 || f.x + f.width > source.width || f.y + f.height > source.height) throw new Error(`Invalid animal frame: ${name}`);
    texture.add(name, 0, f.x, f.y, f.width, f.height);
  }
  scene.textures.remove(ANIMAL_SOURCE.key);
}
