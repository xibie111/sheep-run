import type Phaser from "phaser";
import { registerDisplayText } from "./DisplayTextLayer";

/** Hand-lettered UI face; all glyphs are local bitmap assets on a hard pixel grid. */
export const DISPLAY_FONTS = {
  small: { key: "pasture-display-12", image: new URL("../../assets/fonts/pasture-display-12.png", import.meta.url).href, data: new URL("../../assets/fonts/pasture-display-12.fnt", import.meta.url).href },
  button: { key: "pasture-display-20", image: new URL("../../assets/fonts/pasture-display-20.png", import.meta.url).href, data: new URL("../../assets/fonts/pasture-display-20.fnt", import.meta.url).href },
  title: { key: "pasture-display-40", image: new URL("../../assets/fonts/pasture-display-40.png", import.meta.url).href, data: new URL("../../assets/fonts/pasture-display-40.fnt", import.meta.url).href },
  body: { key: "pasture-display-64", image: new URL("../../assets/fonts/pasture-display-64.png", import.meta.url).href, data: new URL("../../assets/fonts/pasture-display-64.fnt", import.meta.url).href },
} as const;

export function addDisplayText(scene: Phaser.Scene, x: number, y: number, text: string, size = 12, color = 0x542b16): Phaser.GameObjects.BitmapText {
  const font = size >= 32 ? DISPLAY_FONTS.title : DISPLAY_FONTS.body;
  const object = scene.add.bitmapText(x, y, font.key, text, size).setOrigin(0.5).setTint(size >= 32 ? 0xffffff : color).setDepth(10);
  registerDisplayText(scene, object);
  return object;
}
