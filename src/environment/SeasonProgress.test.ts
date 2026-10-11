import { describe, expect, it } from "vitest";
import { seasonAtScore, SEASON_SCORE_INTERVAL } from "./SeasonProgress";

describe("score-driven seasons", () => {
  it.each([
    [0, "spring"], [1499, "spring"], [1500, "summer"], [2999, "summer"],
    [3000, "autumn"], [4499, "autumn"], [4500, "winter"], [5999, "winter"],
    [6000, "spring"], [7500, "summer"], [-1, "spring"], [NaN, "spring"], [Infinity, "spring"],
  ] as const)("selects %s points as %s", (score, season) => {
    expect(SEASON_SCORE_INTERVAL).toBe(1500);
    expect(seasonAtScore(score)).toBe(season);
  });
});
