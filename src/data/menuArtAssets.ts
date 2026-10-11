import { MENU_ART_GEOMETRY } from "./menuArtGeometry";

export type MenuArtName = Exclude<keyof typeof MENU_ART_GEOMETRY, "digits">;
export const MENU_ART_ASSETS = {
  title: { key: "menu-reference-title-v2", url: new URL("../../assets/ui/menu-reference-v2/title-v2.png", import.meta.url).href },
  start: { key: "menu-reference-start-v2", url: new URL("../../assets/ui/menu-reference-v2/start-v2.png", import.meta.url).href },
  wardrobe: { key: "menu-reference-wardrobe-v2", url: new URL("../../assets/ui/menu-reference-v2/wardrobe-v2.png", import.meta.url).href },
  settings: { key: "menu-reference-settings-v2", url: new URL("../../assets/ui/menu-reference-v2/settings-v2.png", import.meta.url).href },
  score: { key: "menu-reference-score-v2", url: new URL("../../assets/ui/menu-reference-v2/score-v2.png", import.meta.url).href },
  digits: { key: "menu-reference-digits-v2", url: new URL("../../assets/ui/menu-reference-v2/digits-v2.png", import.meta.url).href },
} as const;

export { MENU_ART_GEOMETRY };
