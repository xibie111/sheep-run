import { WORLD } from "../game/Constants";

export const ILLUSTRATED_REPEAT_WIDTH = WORLD.width * 2;

export const BACKGROUND_KEYS = {
  menu: "illustrated-pasture-menu",
  runFar: "illustrated-pasture-far",
  runNear: "illustrated-pasture-near",
} as const;

export const BACKGROUND_ASSET_PATHS: Readonly<Record<string, string>> = {
  [BACKGROUND_KEYS.menu]: new URL("../../assets/backgrounds/menu-pasture-v1.png", import.meta.url).href,
  [BACKGROUND_KEYS.runFar]: new URL("../../assets/backgrounds/run-far-v1.png", import.meta.url).href,
  [BACKGROUND_KEYS.runNear]: new URL("../../assets/backgrounds/run-near-v1.png", import.meta.url).href,
};
