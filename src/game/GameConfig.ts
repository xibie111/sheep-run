import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { MenuScene } from "../scenes/MenuScene";
import { PauseScene } from "../scenes/PauseScene";
import { PreloadScene } from "../scenes/PreloadScene";
import { ResultScene } from "../scenes/ResultScene";
import { RunScene } from "../scenes/RunScene";
import { WardrobeScene } from "../scenes/WardrobeScene";
import { PLAYER, RUN } from "./Constants";
import { adaptiveViewportSize, watchCanvasRounding } from "./Viewport";

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  const viewport = adaptiveViewportSize(parent.clientWidth, parent.clientHeight);
  return {
    type: Phaser.AUTO,
    parent,
    width: viewport.width,
    height: viewport.height,
    backgroundColor: "#b4ddd1",
    callbacks: { postBoot: (game) => watchCanvasRounding(game, parent) },
    scene: [BootScene, PreloadScene, MenuScene, RunScene, PauseScene, WardrobeScene, ResultScene],
    scale: {
      width: viewport.width,
      height: viewport.height,
      // Fit the adaptive raster without cropping the authored gameplay area.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      parent,
    },
    render: {
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      antialiasGL: false,
      powerPreference: "low-power",
      transparent: false,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: PLAYER.gravityY },
        debug: false,
        fps: 60,
      },
    },
    fps: { min: 1000 / RUN.simulationDeltaCapMs, smoothStep: true },
    input: {
      mouse: false,
      keyboard: false,
      activePointers: 2,
      touch: { capture: true },
    },
    disableContextMenu: true,
    banner: false,
  };
}
