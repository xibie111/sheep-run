import type { ThemeId } from "./types";

export const SEASON_SCORE_INTERVAL = 1500;
export const SEASON_ORDER: readonly ThemeId[] = ["spring", "summer", "autumn", "winter"];

/** Current run score selects scenery; no high-score, reward or physics rules live here. */
export function seasonAtScore(score: number): ThemeId {
  const value = Number.isFinite(score) ? Math.max(0, score) : 0;
  return SEASON_ORDER[Math.floor(value / SEASON_SCORE_INTERVAL) % SEASON_ORDER.length]!;
}
