import type Phaser from "phaser";
import { EXPANDED_OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { seasonObstacleKey } from "./seasonArtAssets";
import { addCanvasTexture } from "../utils/TextureUtils";
import frames from "../../assets/seasons/expanded-obstacles-v3/frames.json";

export const EXPANDED_OBSTACLE_ART = {
  key: "expanded-obstacles-v3-source",
  url: new URL("../../assets/seasons/expanded-obstacles-v3/atlas.png", import.meta.url).href,
} as const;

export function expandedObstacleRuntimeKeys(): string[] {
  return EXPANDED_OBSTACLE_DEFINITIONS.flatMap(definition => [definition.texture,
    ...SEASON_ORDER.map(season => seasonObstacleKey(season, definition.kind))]);
}

/** Preserve the generated source; uniformly fit each measured subject at the existing foot baseline. */
export function createExpandedObstacleTextures(scene: Phaser.Scene): void {
  const source = scene.textures.get(EXPANDED_OBSTACLE_ART.key).getSourceImage() as HTMLImageElement;
  for (const season of SEASON_ORDER) for (const definition of EXPANDED_OBSTACLE_DEFINITIONS) {
    const frame = frames[season][definition.kind as keyof typeof frames.spring];
    if (!frame || frame.width <= 0 || frame.height <= 0 || frame.x < 0 || frame.y < 0
      || frame.x + frame.width > source.width || frame.y + frame.height > source.height) {
      throw new Error(`Expanded obstacle frame invalid: ${season}/${definition.kind}`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = definition.width * 4; canvas.height = definition.height * 4;
    const context = canvas.getContext("2d")!; context.imageSmoothingEnabled = false;
    const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
    const width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
    context.drawImage(source, frame.x, frame.y, frame.width, frame.height,
      Math.floor((canvas.width - width) / 2), canvas.height - height, width, height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 3; index < pixels.data.length; index += 4) pixels.data[index] = pixels.data[index]! >= 128 ? 255 : 0;
    context.putImageData(pixels, 0, 0);
    addCanvasTexture(scene, seasonObstacleKey(season, definition.kind), canvas);
    if (season === "spring") addCanvasTexture(scene, definition.texture, canvas);
  }
  scene.textures.remove(EXPANDED_OBSTACLE_ART.key);
}
