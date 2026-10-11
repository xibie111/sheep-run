import type Phaser from "phaser";
import { UI_KEYS } from "../data/uiAssets";
import { bindTouchTarget } from "./TouchTarget";
import { displayArtLayer } from "./DisplayArtLayer";

const SCALE = 0.25;
const PANEL = { x: 452, y: 68, width: 768, height: 816 };
const BUTTONS = [
  { frame: "continue", label: "继续游戏", x: 556, y: 352, width: 560, height: 157 },
  { frame: "restart", label: "重新开始", x: 608, y: 526, width: 454, height: 129 },
  { frame: "home", label: "返回首页", x: 608, y: 666, width: 454, height: 124 },
] as const;

export function registerPauseDialogFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(UI_KEYS.pauseDialog);
  for (const item of [{ frame: "dialog", ...PANEL }, ...BUTTONS]) {
    if (!texture.has(item.frame)) texture.add(item.frame, 0, item.x, item.y, item.width, item.height);
  }
}

/** Reference artwork and matching live touch regions share the same source geometry. */
export function addPauseDialog(scene: Phaser.Scene, actions: readonly [() => void, () => void, () => void]): void {
  const centerX = 240, centerY = 128;
  const panel = scene.add.image(centerX, centerY, UI_KEYS.pauseDialog, "dialog")
    .setDisplaySize(PANEL.width * SCALE, PANEL.height * SCALE).setDepth(41).setName("pause-dialog-art");
  const art: Parameters<typeof displayArtLayer>[1] = [{ image: panel }];
  BUTTONS.forEach((item, index) => {
    const width = item.width * SCALE, height = item.height * SCALE;
    const x = centerX + (item.x + item.width / 2 - PANEL.x - PANEL.width / 2) * SCALE;
    const y = centerY + (item.y + item.height / 2 - PANEL.y - PANEL.height / 2) * SCALE;
    const image = scene.add.image(0, 0, UI_KEYS.pauseDialog, item.frame).setDisplaySize(width, height);
    const pressShade = scene.add.rectangle(0, 0, width - 20, height - 12, 0x713514);
    art.push({ image, shade: pressShade });
    pressShade.alpha = 0;
    const button = scene.add.container(x, y, [image, pressShade]).setDepth(44)
      .setName("button:" + item.label).setData("disabled", false).setData("label", item.label);
    bindTouchTarget(scene, button, width, height, actions[index], pressed => {
      button.setData("pressed", pressed);
      image.setY(pressed ? 1 : 0);
      pressShade.alpha = pressed ? 0.12 : 0;
    });
  });
  displayArtLayer(scene, art);
}
