import type Phaser from "phaser";
import type { ObstacleKind } from "../game/ObstacleDefinitions";
import type { ThemeId } from "../environment/types";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { NEW_OBSTACLE_NAMES } from "./newObstacleNames";
import { EXPANDED_OBSTACLE_NAMES } from "./expandedObstacleNames";

export const SEASON_PUDDLE_ART = {
  key: "season-puddles-source",
  url: new URL("../../assets/seasons/puddles-v2/atlas.png", import.meta.url).href,
  // Measured subject bounds; transparent padding in the source is not uniform.
  frames: {
    spring: { x: 106, y: 211, width: 1043, height: 140 },
    summer: { x: 107, y: 512, width: 1041, height: 139 },
    autumn: { x: 106, y: 812, width: 1042, height: 139 },
    winter: { x: 106, y: 1087, width: 1042, height: 141 },
  },
} as const;

export const SEASON_ART = {
  // The v2 extension's darkest running verge is three logical pixels above the original.
  spring: { extension: { key: "season-spring-extension-source", offsetY: 3, url: new URL("../../assets/seasons/extensions-v2/spring.png", import.meta.url).href }, far: { key: "season-spring-far-source", url: new URL("../../assets/seasons/seamless-v3/spring-far.png", import.meta.url).href }, near: { key: "season-spring-near-source", url: new URL("../../assets/seasons/generated-v1/spring-near.png", import.meta.url).href }, obstacles: { key: "season-spring-obstacles-source", url: new URL("../../assets/seasons/generated-v1/spring-obstacles.png", import.meta.url).href } },
  summer: { extension: { key: "season-summer-extension-source", offsetY: 3, url: new URL("../../assets/seasons/extensions-v2/summer.png", import.meta.url).href }, far: { key: "season-summer-far-source", url: new URL("../../assets/seasons/seamless-v3/summer-far.png", import.meta.url).href }, near: { key: "season-summer-near-source", url: new URL("../../assets/seasons/generated-v1/summer-near.png", import.meta.url).href }, obstacles: { key: "season-summer-obstacles-source", url: new URL("../../assets/seasons/generated-v1/summer-obstacles.png", import.meta.url).href } },
  autumn: { extension: { key: "season-autumn-extension-source", offsetY: 3, url: new URL("../../assets/seasons/extensions-v2/autumn.png", import.meta.url).href }, far: { key: "season-autumn-far-source", url: new URL("../../assets/seasons/seamless-v3/autumn-far.png", import.meta.url).href }, near: { key: "season-autumn-near-source", url: new URL("../../assets/seasons/generated-v1/autumn-near.png", import.meta.url).href }, obstacles: { key: "season-autumn-obstacles-source", url: new URL("../../assets/seasons/generated-v1/autumn-obstacles.png", import.meta.url).href } },
  winter: { extension: { key: "season-winter-extension-source", offsetY: 3, url: new URL("../../assets/seasons/extensions-v2/winter.png", import.meta.url).href }, far: { key: "season-winter-far-source", url: new URL("../../assets/seasons/seamless-v3/winter-far.png", import.meta.url).href }, near: { key: "season-winter-near-source", url: new URL("../../assets/seasons/generated-v1/winter-near.png", import.meta.url).href }, obstacles: { key: "season-winter-obstacles-source", url: new URL("../../assets/seasons/generated-v1/winter-obstacles.png", import.meta.url).href } },
} as const;

export const SEASON_OBSTACLE_NAMES: Record<ThemeId, Record<ObstacleKind, string>> = {
  spring: { WoodFence: "花藤木栏", Pumpkin: "育苗花盆", Rock: "苔石", Puddle: "花瓣水洼", FlyingBird: "燕子", WideLog: "长满苔藓的倒木", TallStack: "花箱堆垛", HangingVine: "低垂花藤", ...NEW_OBSTACLE_NAMES.spring, ...EXPANDED_OBSTACLE_NAMES.spring },
  summer: { WoodFence: "瓜果木箱", Pumpkin: "西瓜", Rock: "枯木", Puddle: "灌溉水洼", FlyingBird: "蜜蜂", WideLog: "林间倒木", TallStack: "果箱堆垛", HangingVine: "低悬蜂巢", ...NEW_OBSTACLE_NAMES.summer, ...EXPANDED_OBSTACLE_NAMES.summer },
  autumn: { WoodFence: "麦秆捆", Pumpkin: "南瓜", Rock: "落叶石", Puddle: "落叶泥洼", FlyingBird: "乌鸦", WideLog: "落叶倒木", TallStack: "干草堆垛", HangingVine: "低垂松果", ...NEW_OBSTACLE_NAMES.autumn, ...EXPANDED_OBSTACLE_NAMES.autumn },
  winter: { WoodFence: "积雪木箱", Pumpkin: "雪球堆", Rock: "冰块", Puddle: "薄冰", FlyingBird: "雪鸮", WideLog: "积雪倒木", TallStack: "雪覆箱垛", HangingVine: "低垂冰棱", ...NEW_OBSTACLE_NAMES.winter, ...EXPANDED_OBSTACLE_NAMES.winter },
};

export function seasonObstacleKey(season: ThemeId, kind: ObstacleKind): string {
  return `season-${season}-obstacle-${kind}`;
}

export function seasonLayerKey(season: ThemeId, slot: string): string | undefined {
  const bands: Record<string, string> = { "pasture-far-mountain": "far", "pasture-treeline": "near", "pasture-ground": "road", "pasture-sky-fill": "sky-fill", "pasture-soil-fill": "soil-fill" };
  return bands[slot] ? `season-${season}-${bands[slot]}` : undefined;
}

export const SEASON_SOURCE_KEYS = [SEASON_PUDDLE_ART.key, ...SEASON_ORDER.flatMap(season => Object.values(SEASON_ART[season]).filter(asset => "url" in asset).map(asset => asset.key))];

export function loadSeasonArt(scene: Phaser.Scene): void {
  scene.load.image(SEASON_PUDDLE_ART.key, SEASON_PUDDLE_ART.url);
  for (const season of SEASON_ORDER) {
    for (const asset of Object.values(SEASON_ART[season])) if ("url" in asset) scene.load.image(asset.key, asset.url);
  }
}
