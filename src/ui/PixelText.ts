import type Phaser from "phaser";
import { addDisplayText, DISPLAY_FONTS } from "./DisplayText";

export const PIXEL_FONTS = {
  small: DISPLAY_FONTS.small,
  body: DISPLAY_FONTS.small,
} as const;

export function addPixelText(scene: Phaser.Scene, x: number, y: number, text: string, size = 12, color = 0x542b16): Phaser.GameObjects.BitmapText {
  return addDisplayText(scene, x, y, text, size, color);
}
