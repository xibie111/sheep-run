import { describe, expect, it } from "vitest";
import { containsRunPausePoint, runHudLayout, runHudNumberBox } from "./RunHudLayout";

describe("two-plaque run HUD", () => {
  it.each([[480, 270], [584, 270], [960, 270], [480, 360], [480, 540]])(
    "aligns the score plaques and centers pause above the original star column at %sx%s", (width, height) => {
      const layout = runHudLayout({ width, height }, { left: 0, right: 0, top: 0, bottom: 0 });
      expect(layout.score.width).toBe(layout.best.width);
      expect(layout.score.height).toBe(layout.best.height);
      expect(layout.score.y).toBe(layout.best.y);
      expect(layout.score.x).toBe(8);
      expect(layout.best.x + layout.best.width).toBe(width - 8);
      for (const name of ["pause", "stars", "streak", "milestone"] as const) {
        expect(layout[name].x + layout[name].width / 2).toBe(width / 2);
      }
      expect(layout.pause.y + layout.pause.height).toBeLessThan(layout.stars.y);
      expect(layout.stars.y + layout.stars.height).toBeLessThan(layout.streak.y);
      expect(layout.stars.width).toBe(82);
      expect(layout.score.x + layout.score.width).toBeLessThan(layout.pause.x);
      expect(layout.pause.x + layout.pause.width).toBeLessThan(layout.best.x);
      const left = runHudNumberBox("score", layout.score), right = runHudNumberBox("best", layout.best);
      expect(left.y).toBe(right.y);
      expect(left.height).toBe(right.height);
      expect(left.width).toBe(right.width);
    },
  );

  it("anchors the score plaques and center column inside asymmetric safe areas", () => {
    const safe = { left: 72, right: 80, top: 12, bottom: 0 };
    const layout = runHudLayout({ width: 480, height: 270 }, safe);
    expect(layout.score.x).toBe(safe.left + 8);
    expect(layout.best.x + layout.best.width).toBeCloseTo(480 - safe.right - 8);
    expect(layout.pause.x + layout.pause.width / 2).toBe((safe.left + 480 - safe.right) / 2);
    expect(layout.pause.y).toBe(safe.top + 7);
    expect(layout.score.width).toBeLessThan(116);
    expect(layout.score.width).toBe(layout.best.width);
  });

  it("excludes only the visible central pause target from gameplay gestures", () => {
    const { pause } = runHudLayout({ width: 584, height: 360 }, { left: 20, right: 30, top: 12, bottom: 0 });
    expect(containsRunPausePoint(pause, pause.x + pause.width / 2, pause.y + pause.height / 2)).toBe(true);
    expect(containsRunPausePoint(pause, pause.x, pause.y)).toBe(true);
    expect(containsRunPausePoint(pause, pause.x + pause.width, pause.y + pause.height)).toBe(true);
    expect(containsRunPausePoint(pause, pause.x - 1, pause.y + 10)).toBe(false);
    expect(containsRunPausePoint(pause, pause.x + 10, pause.y + pause.height + 1)).toBe(false);
  });
});

