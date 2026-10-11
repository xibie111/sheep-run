import Phaser from "phaser";
import { UI_KEYS, uiIconKey, type UiIconName } from "../data/uiAssets";
import { addPixelText } from "./PixelText";
import { addIllustratedBackdrop } from "./IllustratedBackdrop";
import { addDisplayText } from "./DisplayText";

/** Shared illustrated scenery; UI art and touch targets stay independent. */
export function addPastureBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return addIllustratedBackdrop(scene);
}

export function addUiPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.NineSlice {
  const key = "ui-panel-frame";
  if (!scene.textures.exists(key)) {
    const source = scene.textures.get(UI_KEYS.panelPause).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width / 4; canvas.height = source.height / 4;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    scene.textures.addCanvas(key, canvas);
  }
  return scene.add.nineslice(x, y, key, undefined, width, height, 14, 14, 14, 14).setDepth(3);
}

export function addWoodTitle(scene: Phaser.Scene, x: number, y: number, label: string, width: number, height: number, size: number, depth = 5): void {
  const board = scene.add.image(x, y, UI_KEYS.titleMain).setDepth(depth);
  board.setScale(Math.min(width / board.frame.width, height / board.frame.height));
  if (size >= 32) {
    addDisplayText(scene, x, y, label, 40).setDepth(depth + 2);
    return;
  }
  addPixelText(scene, x + 2, y + 3, label, size, 0x713514).setDepth(depth + 1);
  addPixelText(scene, x, y, label, size, 0xffedaa).setDepth(depth + 2);
}

export function addCurrencyBadge(scene: Phaser.Scene, x: number, y: number, amount: number, icon: UiIconName): Phaser.GameObjects.BitmapText {
  scene.add.image(x, y, icon === "coin" ? UI_KEYS.badgeCoin : UI_KEYS.badgeStar).setDisplaySize(88, 34).setDepth(5);
  scene.add.image(x - 25, y, uiIconKey(icon)).setDisplaySize(19, 19).setDepth(6);
  return addPixelText(scene, x + 10, y - 1, String(amount), 12).setDepth(7);
}
