import type Phaser from "phaser";
import { ADDITIONAL_OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { seasonObstacleKey } from "./seasonArtAssets";
import { addCanvasTexture } from "../utils/TextureUtils";
import frames from "../../assets/seasons/additional-obstacles-v1/frames.json";

export const ADDITIONAL_OBSTACLE_ART = {
  key: "additional-obstacles-source",
  url: new URL("../../assets/seasons/additional-obstacles-v1/atlas.png", import.meta.url).href,
} as const;

export const ADDITIONAL_TOWER_ART = {
  key: "additional-towers-source",
  url: new URL("../../assets/seasons/additional-obstacles-v1/towers-source.png", import.meta.url).href,
} as const;

export function loadAdditionalObstacleArt(scene: Phaser.Scene): void {
  scene.load.image(ADDITIONAL_OBSTACLE_ART.key, ADDITIONAL_OBSTACLE_ART.url);
  scene.load.image(ADDITIONAL_TOWER_ART.key, ADDITIONAL_TOWER_ART.url);
}

/** Measured alpha bounds avoid assumptions about generated atlas spacing. */
export function createAdditionalObstacleTextures(scene: Phaser.Scene): void {
  const atlas = scene.textures.get(ADDITIONAL_OBSTACLE_ART.key).getSourceImage() as HTMLImageElement;
  const towers = scene.textures.get(ADDITIONAL_TOWER_ART.key).getSourceImage() as HTMLImageElement;

  for (const season of SEASON_ORDER) {
    for (const definition of ADDITIONAL_OBSTACLE_DEFINITIONS) {
      const frame = frames[season][definition.kind as keyof typeof frames.spring];
      const source = definition.kind === "TallStack" ? towers : atlas;
      if (!frame || frame.x + frame.width > source.width || frame.y + frame.height > source.height) {
        throw new Error(`Additional obstacle frame invalid: ${season}/${definition.kind}`);
      }
      const canvas = document.createElement("canvas");
      canvas.width = definition.width * 4; canvas.height = definition.height * 4;
      const context = canvas.getContext("2d")!;
      context.imageSmoothingEnabled = false;
      const sourceWidth = frame.width, sourceHeight = frame.height;
      const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
      context.drawImage(source, frame.x, frame.y, sourceWidth, sourceHeight,
        Math.floor((canvas.width - width) / 2), canvas.height - height, width, height);
      const formatted = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 3; index < formatted.data.length; index += 4) formatted.data[index] = formatted.data[index]! >= 128 ? 255 : 0;
      context.putImageData(formatted, 0, 0);
      addCanvasTexture(scene, seasonObstacleKey(season, definition.kind), canvas);
      // Obstacle's constructor needs a base texture before activation selects the season.
      if (season === "spring") addCanvasTexture(scene, definition.texture, canvas);
    }
  }
  scene.textures.remove(ADDITIONAL_OBSTACLE_ART.key);
  scene.textures.remove(ADDITIONAL_TOWER_ART.key);
}

export function additionalObstacleRuntimeKeys(): string[] {
  return ADDITIONAL_OBSTACLE_DEFINITIONS.flatMap(definition => [
    definition.texture, ...SEASON_ORDER.map(season => seasonObstacleKey(season, definition.kind)),
  ]);
}
