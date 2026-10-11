import { describe, expect, it } from "vitest";
import { buttonContentLayout } from "./ButtonLayout";

describe("button content containment", () => {
  it("centers a start label and play icon as one group inside the light panel", () => {
    const layout = buttonContentLayout(172, 48, { width: 80, height: 18 }, { width: 18, height: 18 }, false, false);
    const left = layout.iconX - 9 * layout.scale;
    const right = layout.textX + 40 * layout.scale;
    expect(left + right).toBeCloseTo(0);
    expect(right).toBeLessThanOrEqual(64);
    expect(layout.textX - 40 * layout.scale).toBeGreaterThan(layout.iconX + 9 * layout.scale);
  });
  it("keeps a stacked hanger and label inside the wardrobe button without overlapping", () => {
    const layout = buttonContentLayout(64, 48, { width: 24, height: 12 }, { width: 17, height: 17 }, true, false);
    expect(layout.iconY + 8.5 * layout.scale).toBeLessThan(layout.textY - 6 * layout.scale);
    expect(layout.textY + 6 * layout.scale).toBeLessThanOrEqual(16);
    expect(layout.iconY - 8.5 * layout.scale).toBeGreaterThanOrEqual(-16);
  });
  it("uniformly fits a long label and right-hand icon without negative room", () => {
    const layout = buttonContentLayout(120, 36, { width: 120, height: 20 }, { width: 18, height: 18 }, false, true);
    expect(layout.scale).toBeGreaterThan(0);
    expect(layout.scale).toBeLessThan(1);
    expect(layout.textX - 60 * layout.scale).toBeGreaterThanOrEqual(-38);
    expect(layout.iconX + 9 * layout.scale).toBeLessThanOrEqual(38);
  });
});
