import type Phaser from "phaser";
import { WORLD } from "../game/Constants";
import { ILLUSTRATED_REPEAT_WIDTH } from "../data/backgroundAssets";
import { SEASON_ART, SEASON_PUDDLE_ART, seasonLayerKey, seasonObstacleKey } from "../data/seasonArtAssets";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { BASE_OBSTACLE_DEFINITIONS, OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { addCanvasTexture } from "./TextureUtils";
import { createSceneryRepeat, createPanoramaRepeat, createRoadFill, sceneryExtension } from "./SceneryRepeat";

/** Keep generated transparency crisp at the same threshold used for sprite bounds. */
function snapAlpha(context: CanvasRenderingContext2D): void {
  const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  for (let index = 3; index < pixels.data.length; index += 4) pixels.data[index] = pixels.data[index]! >= 128 ? 255 : 0;
  context.putImageData(pixels, 0, 0);
}

/** Format generated artwork into cached game textures. No procedural replacement art. */
export function createSeasonArtTextures(scene: Phaser.Scene): void {
  const puddleAtlas = scene.textures.get(SEASON_PUDDLE_ART.key).getSourceImage() as HTMLImageElement;
  for (const season of SEASON_ORDER) {
    const sources = SEASON_ART[season];
    const far = scene.textures.get(sources.far.key).getSourceImage() as HTMLImageElement;
    const near = scene.textures.get(sources.near.key).getSourceImage() as HTMLImageElement;
    const extension = scene.textures.get(sources.extension.key).getSourceImage() as HTMLImageElement;
    const farRepeat = scene.textures.exists(seasonLayerKey(season, "pasture-far-mountain")!) ? undefined : createPanoramaRepeat(far);
    const nearRepeat = scene.textures.exists(seasonLayerKey(season, "pasture-treeline")!) && scene.textures.exists(seasonLayerKey(season, "pasture-ground")!) ? undefined : createSceneryRepeat(near, "near", sceneryExtension(extension, "near", sources.extension.offsetY));
    const band = (slot: string, source: HTMLCanvasElement | undefined, top: number, bottom: number): void => {
      const key = seasonLayerKey(season, slot)!;
      if (scene.textures.exists(key)) return;
      const c = document.createElement("canvas"); c.width = source?.width ?? ILLUSTRATED_REPEAT_WIDTH; c.height = WORLD.height;
      const ctx = c.getContext("2d")!; ctx.imageSmoothingEnabled = false;
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, c.width, bottom - top); ctx.clip();
      if (source) ctx.drawImage(source, 0, 0); ctx.restore();
      snapAlpha(ctx);
      addCanvasTexture(scene, key, c);
    };
    band("pasture-far-mountain", farRepeat, 0, WORLD.height);
    band("pasture-treeline", nearRepeat, 0, WORLD.groundY - 7);
    band("pasture-ground", nearRepeat, WORLD.groundY - 7, WORLD.height);
    const formattedFar = farRepeat ?? scene.textures.get(seasonLayerKey(season, "pasture-far-mountain")!).getSourceImage() as HTMLCanvasElement;
    const formattedRoad = nearRepeat ?? scene.textures.get(seasonLayerKey(season, "pasture-ground")!).getSourceImage() as HTMLCanvasElement;
    for (const [slot, source, row] of [["pasture-sky-fill", formattedFar, 0]] as const) {
      const c = document.createElement("canvas"); c.width = c.height = 1;
      const context = c.getContext("2d")!;
      context.drawImage(source, Math.floor(source.width / 2), row, 1, 1, 0, 0, 1, 1);
      snapAlpha(context);
      addCanvasTexture(scene, seasonLayerKey(season, slot)!, c);
    }
    addCanvasTexture(scene, seasonLayerKey(season, "pasture-soil-fill")!, createRoadFill(formattedRoad));

    const atlas = scene.textures.get(sources.obstacles.key).getSourceImage() as HTMLImageElement;
    const scan = document.createElement("canvas"); scan.width = atlas.width; scan.height = atlas.height;
    const scanContext = scan.getContext("2d", { willReadFrequently: true })!; scanContext.drawImage(atlas, 0, 0);
    const pixels = scanContext.getImageData(0, 0, atlas.width, atlas.height).data;
    for (const [index, definition] of BASE_OBSTACLE_DEFINITIONS.entries()) {
      const x0 = Math.round((index % 3) * atlas.width / 3), x1 = Math.round(((index % 3) + 1) * atlas.width / 3);
      const y0 = Math.round(Math.floor(index / 3) * atlas.height / 2), y1 = Math.round((Math.floor(index / 3) + 1) * atlas.height / 2);
      let left = x1, top = y1, right = -1, bottom = -1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (pixels[(y * atlas.width + x) * 4 + 3]! < 128) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      let spriteAtlas = atlas;
      if (definition.kind === "Puddle") {
        const frame = SEASON_PUDDLE_ART.frames[season];
        spriteAtlas = puddleAtlas;
        left = frame.x; top = frame.y; right = left + frame.width - 1; bottom = top + frame.height - 1;
        if (right >= puddleAtlas.width || bottom >= puddleAtlas.height) throw new Error(`Puddle frame exceeds atlas: ${season}`);
      }
      if (right < left || bottom < top) throw new Error(`Generated seasonal sprite missing: ${season}/${definition.kind}`);
      const width = right - left + 1, height = bottom - top + 1;
      const c = document.createElement("canvas"); c.width = definition.width * 4; c.height = definition.height * 4;
      const ctx = c.getContext("2d")!; ctx.imageSmoothingEnabled = false;
      // Water occupies the road strip, rather than rising into the grass like a rock.
      // The transport frame, foot baseline and authored collision body are retained.
      const artHeight = definition.kind === "Puddle" ? definition.hitbox.height * 4 : c.height;
      const scale = Math.min(c.width / width, artHeight / height);
      const displayWidth = Math.round(width * scale), displayHeight = Math.round(height * scale);
      ctx.drawImage(spriteAtlas, left, top, width, height, Math.floor((c.width - displayWidth) / 2), c.height - displayHeight, displayWidth, displayHeight);
      snapAlpha(ctx);
      addCanvasTexture(scene, seasonObstacleKey(season, definition.kind), c);
    }
  }
  // Only small formatted textures are needed during play; source PNGs remain on disk.
  for (const season of SEASON_ORDER) for (const asset of Object.values(SEASON_ART[season])) scene.textures.remove(asset.key);
  scene.textures.remove(SEASON_PUDDLE_ART.key);
}

export function seasonRuntimeKeys(): string[] {
  return SEASON_ORDER.flatMap(season => [
    ...["pasture-far-mountain", "pasture-treeline", "pasture-ground", "pasture-sky-fill", "pasture-soil-fill"].map(slot => seasonLayerKey(season, slot)!),
    ...OBSTACLE_DEFINITIONS.map(definition => seasonObstacleKey(season, definition.kind)),
  ]);
}
