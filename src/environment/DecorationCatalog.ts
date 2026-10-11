import { ENVIRONMENT } from "../game/Constants";
import type { DecorationId, DecorationInstance, DecorationLayer, ThemeId } from "./types";

export interface DecorationDefinition {
  id: DecorationId;
  textureKey: string;
  layer: DecorationLayer;
  minScale: number;
  maxScale: number;
  flip?: boolean;
  collision: false;
}

interface PatternEntry {
  id: DecorationId;
  count: number;
}

const entries = (items: readonly [DecorationId, number][]): readonly PatternEntry[] => items.map(([id, count]) => ({ id, count }));

export const DECORATION_CATALOG: readonly DecorationDefinition[] = [
  { id: "tree", textureKey: "environment-tree", layer: "midground", minScale: 1, maxScale: 2, flip: true, collision: false },
  { id: "flower", textureKey: "environment-flower", layer: "ground", minScale: 1, maxScale: 2, flip: true, collision: false },
  { id: "fence", textureKey: "environment-fence-decoration", layer: "midground", minScale: 1, maxScale: 1, flip: true, collision: false },
  { id: "barn", textureKey: "environment-barn", layer: "midground", minScale: 1, maxScale: 2, collision: false },
  { id: "hayBale", textureKey: "environment-hay-bale", layer: "midground", minScale: 1, maxScale: 2, flip: true, collision: false },
  { id: "barrel", textureKey: "environment-barrel", layer: "ground", minScale: 1, maxScale: 1, flip: true, collision: false },
  { id: "rock", textureKey: "environment-rock-decoration", layer: "ground", minScale: 1, maxScale: 2, flip: true, collision: false },
];

const BASE_PATTERNS: readonly (readonly PatternEntry[])[] = [
  entries([["tree", 2], ["flower", 4], ["fence", 1]]),
  entries([["barn", 1], ["hayBale", 2], ["flower", 3]]),
  entries([["tree", 1], ["rock", 2], ["barrel", 1], ["flower", 2]]),
  entries([["fence", 1], ["barrel", 1], ["flower", 4], ["hayBale", 1]]),
];

const PATTERN_ORDER: Record<ThemeId, readonly number[]> = {
  spring: [0, 1, 2, 3],
  summer: [1, 3, 0, 2],
  autumn: [2, 1, 3, 0],
  winter: [3, 2, 0, 1],
};

function hashPattern(seed: number, chunkIndex: number, themeId: ThemeId): number {
  let hash = 2166136261;
  const value = `${seed >>> 0}:${chunkIndex}:${themeId}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: { value: number }): number {
  let value = state.value || 0x9e3779b9;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.value = value >>> 0;
  return state.value / 0x1_0000_0000;
}

export function generateDecorationPattern(seed: number, chunkIndex: number, themeId: ThemeId): DecorationInstance[] {
  const random = { value: hashPattern(seed, chunkIndex, themeId) };
  const patterns = PATTERN_ORDER[themeId];
  const selected = BASE_PATTERNS[patterns[random.value % patterns.length]!]!;
  const expanded: DecorationId[] = [];
  for (const item of selected) for (let count = 0; count < item.count; count += 1) expanded.push(item.id);

  return expanded.map((id, index) => {
    const definition = DECORATION_CATALOG.find((candidate) => candidate.id === id)!;
    const spread = (index + 1) / (expanded.length + 1);
    const x = Math.round(28 + spread * (ENVIRONMENT.chunkWidthPx - 56) + (nextRandom(random) - 0.5) * 18);
    const safeY = definition.layer === "midground"
      ? Math.round(128 + nextRandom(random) * 56)
      : Math.round(224 + nextRandom(random) * 40);
    const scaleSteps = definition.maxScale - definition.minScale + 1;
    const scale = definition.minScale + Math.floor(nextRandom(random) * scaleSteps);
    const flipX = definition.flip === true && nextRandom(random) >= 0.5;
    return { id, x: Math.max(12, Math.min(ENVIRONMENT.chunkWidthPx - 12, x)), y: safeY, scale, flipX };
  });
}
