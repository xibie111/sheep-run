import Phaser from "phaser";
import { uiButtonTextureKey, uiIconKey, type UiButtonStyle, type UiIconName } from "../data/uiAssets";
import { addPixelText } from "./PixelText";
import { bindTouchTarget } from "./TouchTarget";
import { addDisplayText } from "./DisplayText";
import { buttonContentLayout } from "./ButtonLayout";
import { addUiIcon } from "./UiIcon";

export { uiButtonTextureKey as buttonTextureKey };
export interface SceneButtonOptions {
  width?: number; height?: number; accent?: boolean; style?: UiButtonStyle;
  icon?: UiIconName; iconKey?: string; iconPosition?: "left" | "right" | "top";
  textColor?: string; fontSize?: string; disabled?: boolean; depth?: number;
  font?: "pixel" | "display";
  art?: { key: string; frame?: string; width: number; height: number };
}

export function addSceneButton(scene: Phaser.Scene, x: number, y: number, label: string, onActivate: () => void, options: SceneButtonOptions = {}): Phaser.GameObjects.Container {
  const width = options.width ?? 184;
  const height = options.height ?? 54;
  const style = options.style ?? (options.accent ? "primary" : "secondary");
  const disabled = options.disabled === true || style === "disabled";
  const corner = Math.min(style === "primary" ? 44 : 24, width - 4);
  // One source pixel scale keeps the wooden corners square; only the middle grows.
  const artScale = options.art ? Math.min(width / options.art.width, height / options.art.height) : 1;
  const background = options.art
    ? scene.add.image(0, 0, options.art.key, options.art.frame)
      .setDisplaySize(options.art.width * artScale, options.art.height * artScale)
      .setTint(disabled ? 0xa79b84 : 0xffffff)
    : scene.add.nineslice(0, 0, uiButtonTextureKey(disabled && style !== "equipped" ? "disabled" : style), undefined,
      width * 2, height * 2, corner, corner, 16, 20).setScale(0.5);
  const children: Phaser.GameObjects.GameObject[] = [background];
  const iconKey = options.iconKey ?? (options.icon ? uiIconKey(options.icon) : undefined);
  const stacked = !!iconKey && !!label && (options.iconPosition === "top" || width < height * 1.5);
  const requestedSize = parseInt(options.fontSize ?? (height > 42 ? "12" : "10"), 10);
  const size = requestedSize <= 10 ? 10 : requestedSize <= 15 ? 12 : requestedSize;
  const color = options.textColor ? parseInt(options.textColor.replace("#", ""), 16) : disabled && style !== "equipped" ? 0x82795e : 0x542b16;
  const text = options.font === "display"
    ? addDisplayText(scene, 0, 0, label, requestedSize >= 20 ? 20 : 12, color)
    : addPixelText(scene, 0, 0, label, size, color);
  const glyphs = text.getTextBounds().characters.filter(glyph => glyph.w > 0 && glyph.h > 0);
  const left = glyphs.length ? Math.min(...glyphs.map(glyph => glyph.x)) : 0;
  const top = glyphs.length ? Math.min(...glyphs.map(glyph => glyph.y)) : 0;
  const inkWidth = glyphs.length ? Math.max(...glyphs.map(glyph => glyph.x + glyph.w)) - left : 0;
  const inkHeight = glyphs.length ? Math.max(...glyphs.map(glyph => glyph.y + glyph.h)) - top : 0;
  const iconSize = label ? (stacked ? 17 : 18) : Math.min(23, height - 14);
  let icon: Phaser.GameObjects.Image | undefined;
  if (iconKey) {
    icon = addUiIcon(scene, 0, 0, iconKey, iconSize);
    children.push(icon);
  }
  const layout = buttonContentLayout(width, height, { width: inkWidth, height: inkHeight },
    { width: icon?.displayWidth ?? 0, height: icon?.displayHeight ?? 0 }, stacked, options.iconPosition === "right");
  if (label) text.setOrigin(0).setScale(layout.scale).setPosition(
    Math.round(layout.textX - (left + inkWidth / 2) * layout.scale),
    Math.round(layout.textY - (top + inkHeight / 2) * layout.scale) - 2,
  );
  else text.setY(-2);
  if (icon) icon.setScale(icon.scaleX * layout.scale).setPosition(Math.round(layout.iconX), Math.round(layout.iconY) - 2);
  children.push(text);
  const button = scene.add.container(x, y, children).setSize(width, height).setDepth(options.depth ?? 10).setName("button:" + (label || options.icon || "icon"));
  button.setData("disabled", disabled);
  button.setData("pressed", false);
  if (disabled) return button;
  const textY = text.y, iconY = icon?.y ?? 0;
  bindTouchTarget(scene, button, width, height, onActivate, (pressed) => {
    button.setData("pressed", pressed);
    if (!options.art) background.setTexture(uiButtonTextureKey(style, pressed));
    background.setTint(pressed ? 0xf3d29a : 0xffffff);
    background.setY(pressed ? 1 : 0);
    text.setY(textY + (pressed ? 1 : 0));
    icon?.setY(iconY + (pressed ? 1 : 0));
  });
  return button;
}
