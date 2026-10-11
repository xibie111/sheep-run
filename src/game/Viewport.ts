import { WORLD } from "./Constants";
import type Phaser from "phaser";

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ViewportScaleLike {
  gameSize?: {
    width: number;
    height: number;
  };
}

const BASE_ASPECT = WORLD.width / WORLD.height;
const MAX_WIDTH = WORLD.width * 2;
const MAX_HEIGHT = WORLD.height * 2;

function boundedSize(width: number, height: number): ViewportSize {
  return {
    width: Math.min(MAX_WIDTH, Math.max(WORLD.width, Math.round(width))),
    height: Math.min(MAX_HEIGHT, Math.max(WORLD.height, Math.round(height))),
  };
}

export function adaptiveViewportSize(parentWidth: number, parentHeight: number): ViewportSize {
  if (!Number.isFinite(parentWidth) || !Number.isFinite(parentHeight) || parentWidth <= 0 || parentHeight <= 0) {
    return { width: WORLD.width, height: WORLD.height };
  }

  const aspect = parentWidth / parentHeight;
  if (aspect >= BASE_ASPECT) {
    return boundedSize(WORLD.height * aspect, WORLD.height);
  }

  return boundedSize(WORLD.width, WORLD.width / aspect);
}

export function viewportSizeFromScale(scale?: ViewportScaleLike): ViewportSize {
  const width = scale?.gameSize?.width;
  const height = scale?.gameSize?.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height || width <= 0 || height <= 0) {
    return { width: WORLD.width, height: WORLD.height };
  }
  return boundedSize(width, height);
}

export function viewportOffsetX(size: ViewportSize): number {
  return (size.width - WORLD.width) / 2;
}

export function viewportOffsetY(size: ViewportSize): number {
  return Math.floor((size.height - WORLD.height) / 2);
}

// Reveal extra road behind the player while keeping the authored entry distance
// and player physics. Visual recycling follows this expanded viewport's edge.
export function runViewportOrigin(size: ViewportSize): { x: number; y: number } {
  return { x: size.width - WORLD.width, y: viewportOffsetY(size) };
}

// Translate the current screen edge into gameplay coordinates. Entities render
// at viewport.width + padding without moving the physical player or spawn lane.
export function runViewportRight(size: ViewportSize): number {
  return size.width - runViewportOrigin(size).x;
}

// FIT + autoRound can leave a sub-logical-pixel strip after integer raster/CSS
// rounding. Cover only that rounding remainder with one uniform display scale.
// Extreme aspect ratios beyond the logical limits retain FIT instead of cropping.
export function watchCanvasRounding(game: Phaser.Game, parent: HTMLElement): void {
  const refresh = (): void => {
    const { canvas, scale } = game;
    const size = viewportSizeFromScale(scale);
    if (parent.clientWidth <= 0 || parent.clientHeight <= 0) return;
    // One ratio avoids separate axis rounding. Keep CSS dimensions integral as
    // well: browsers quantize fractional layout widths before applying transforms.
    const fit = Math.min(parent.clientWidth / size.width, parent.clientHeight / size.height);
    const width = size.width * fit;
    const height = size.height * fit;
    const cover = Math.max(parent.clientWidth / width, parent.clientHeight / height);
    const factor = cover >= 1 && cover <= 1 + 1 / Math.max(size.width, size.height) ? cover : 1;
    Object.assign(canvas.style, {
      width: `${size.width}px`, height: `${size.height}px`,
      left: "50%", top: "50%", right: "auto", bottom: "auto",
      marginLeft: "0px", marginTop: "0px", transformOrigin: "50% 50%",
      transform: `translate(-50%, -50%) scale(${fit * factor})`,
    });
    // Phaser's input uses canvasBounds and displayScale, including CSS transforms.
    scale.updateBounds();
    scale.displayScale.set(scale.baseSize.width / scale.canvasBounds.width, scale.baseSize.height / scale.canvasBounds.height);
  };
  const stop = (): void => { game.scale.off("resize", refresh); };
  game.scale.on("resize", refresh);
  game.events.once("destroy", stop);
  refresh();
}

export function watchViewport(scene: Phaser.Scene, layout: (size: ViewportSize) => void): () => void {
  const refresh = (): void => layout(viewportSizeFromScale(scene.scale));
  const stop = (): void => {
    scene.scale.off("resize", refresh);
    scene.events.off("shutdown", stop);
  };
  refresh();
  scene.scale.on("resize", refresh);
  scene.events.once("shutdown", stop);
  return stop;
}

// Keep the authored 480x270 panel geometry and touch regions together on resize.
export function centerSceneContent(scene: Phaser.Scene, excluded: readonly Phaser.GameObjects.GameObject[] = []): void {
  const content = scene.children.list
    .filter((object) => !excluded.includes(object))
    .map((object) => {
      const item = object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
      return { item, x: item.x, y: item.y };
    });
  watchViewport(scene, (size) => {
    const x = Math.floor(viewportOffsetX(size));
    const y = viewportOffsetY(size);
    for (const entry of content) entry.item.setPosition(entry.x + x, entry.y + y);
  });
}
