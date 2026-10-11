import { COLORS } from "../game/Constants";

export type SkinId = "white" | "black" | "brown" | "golden" | "farmer"
  | "mint" | "rose" | "blueberry" | "lavender" | "pumpkin" | "forest" | "chestnut" | "sunset"
  | "sleepy-blue" | "sleepy-cream" | "sleepy-pink" | "sleepy-mint" | "dream"
  | "peach" | "milktea" | "cloud" | "bearcap";
type SkinUnlock = { type: "default" | "stars" | "coins"; amount: number };

export interface SheepSkinDefinition {
  id: SkinId;
  label: string;
  unlock: SkinUnlock;
  palette: { wool: string; woolShade: string; face: string; hat?: string };
}

export const SHEEP_SKINS: readonly SheepSkinDefinition[] = [
  { id: "white", label: "White", unlock: { type: "default", amount: 0 }, palette: { wool: COLORS.wool, woolShade: COLORS.woolShade, face: COLORS.face } },
  { id: "black", label: "Black", unlock: { type: "stars", amount: 10 }, palette: { wool: "#514944", woolShade: "#342f2c", face: "#c28d6a" } },
  { id: "brown", label: "Brown", unlock: { type: "stars", amount: 30 }, palette: { wool: "#a96d43", woolShade: "#78472f", face: "#dba078" } },
  { id: "golden", label: "Golden", unlock: { type: "coins", amount: 40 }, palette: { wool: "#e4aa38", woolShade: "#b97b25", face: "#d28d58" } },
  { id: "farmer", label: "Farmer", unlock: { type: "coins", amount: 90 }, palette: { wool: "#eee5cb", woolShade: "#c9bda1", face: "#bd805e", hat: "#4f8150" } },
  // Additional generated cosmetic themes, priced by user authorization; existing
  // unlock/equip APIs implement every purchase. No attributes or effects.
  { id: "mint", label: "薄荷羊", unlock: { type: "coins", amount: 20 }, palette: { wool: "#c8dbc0", woolShade: "#9aac86", face: "#c28d6a" } },
  { id: "rose", label: "樱花羊", unlock: { type: "coins", amount: 25 }, palette: { wool: "#f2c3bd", woolShade: "#ca918c", face: "#c28d6a" } },
  { id: "blueberry", label: "蓝莓羊", unlock: { type: "coins", amount: 35 }, palette: { wool: "#b3bde4", woolShade: "#818bb5", face: "#c28d6a" } },
  { id: "lavender", label: "薰衣草羊", unlock: { type: "coins", amount: 45 }, palette: { wool: "#c5a6db", woolShade: "#9571b3", face: "#c28d6a" } },
  { id: "pumpkin", label: "南瓜羊", unlock: { type: "coins", amount: 50 }, palette: { wool: "#edaa53", woolShade: "#bd733a", face: "#c28d6a" } },
  { id: "forest", label: "森林羊", unlock: { type: "coins", amount: 60 }, palette: { wool: "#90ad5a", woolShade: "#55733b", face: "#c28d6a" } },
  { id: "chestnut", label: "栗木羊", unlock: { type: "coins", amount: 70 }, palette: { wool: "#b78356", woolShade: "#805a3e", face: "#c28d6a" } },
  { id: "sunset", label: "夕阳羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#edb084", woolShade: "#cb7d74", face: "#c28d6a" } },
  { id: "sleepy-blue", label: "催眠羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f4ebd8", woolShade: "#c5b4a0", face: "#eeb081", hat: "#acbdd3" } },
  { id: "sleepy-cream", label: "月夜羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f4ebd8", woolShade: "#c5b4a0", face: "#eeb081", hat: "#dacbb4" } },
  { id: "sleepy-pink", label: "柔粉睡羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f4ebd8", woolShade: "#c5b4a0", face: "#eeb081", hat: "#d7afa9" } },
  { id: "sleepy-mint", label: "薄荷睡羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f4ebd8", woolShade: "#c5b4a0", face: "#eeb081", hat: "#afc1ad" } },
  { id: "dream", label: "梦境羊", unlock: { type: "coins", amount: 100 }, palette: { wool: "#dcc7ef", woolShade: "#b599c8", face: "#eeb081" } },
  { id: "peach", label: "蜜桃羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f7d4c2", woolShade: "#dda998", face: "#eeb081" } },
  { id: "milktea", label: "奶茶羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#e6cba5", woolShade: "#bc956f", face: "#eeb081" } },
  { id: "cloud", label: "云朵羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f4f0df", woolShade: "#b4cddb", face: "#eeb081" } },
  { id: "bearcap", label: "小熊帽羊", unlock: { type: "coins", amount: 80 }, palette: { wool: "#f4ebd8", woolShade: "#c5b4a0", face: "#eeb081", hat: "#b99264" } },
];

export function isSkinId(value: string): value is SkinId {
  return SHEEP_SKINS.some((skin) => skin.id === value);
}

export function skinDefinition(value: string): SheepSkinDefinition | null {
  return SHEEP_SKINS.find((skin) => skin.id === value) ?? null;
}

export function sheepTextureKey(skinId: SkinId): string {
  return skinId === "white" ? "sheep-runner" : `sheep-runner-${skinId}`;
}
