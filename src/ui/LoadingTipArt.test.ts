import { describe, expect, it } from "vitest";
import { LOADING_TIPS } from "../data/loadingTips";
import { LOADING_PIXEL_GLYPHS } from "../data/loadingPixelFont";
import { loadingTipLayout } from "./LoadingTipArt";

describe("pixel loading tips fit complete copy", () => {
  it("gives the goodnight tip larger pixel blocks when the inner frame allows", () => {
    const layout = loadingTipLayout("晚安，催眠羊", 237, 63);
    expect(layout.lines.join("")).toBe("晚安，催眠羊");
    expect(layout.bodyScale).toBe(2);
  });
  it.each([[960, 540], [896, 414], [844, 390], [800, 600], [480, 270], [390, 844]])("fits every tip in the wooden inner frame at %sx%s and DPR 1/2/3", (width, height) => {
    const unit = Math.min(width / 480, height / 270);
    const panelWidth = width < height || height < 360 ? Math.max(216, 156 * unit) : 156 * unit;
    for (const dpr of [1, 2, 3]) for (const text of LOADING_TIPS) {
      const layout = loadingTipLayout(text, Math.floor(panelWidth * 0.76 * dpr), Math.floor(panelWidth * 120 / 320 * 0.54 * dpr));
      expect(layout.lines.join("")).toBe(text);
      expect(Number.isInteger(layout.bodyScale)).toBe(true);
      expect(layout.bodyScale).toBeGreaterThanOrEqual(1);
      expect(layout.titleY).toBeGreaterThanOrEqual(0);
      expect(layout.bodyY + 14 * layout.bodyScale * layout.lines.length).toBeLessThanOrEqual(layout.height);
      for (const line of layout.lines) {
        const advance = [...line].reduce((sum, char) => sum + LOADING_PIXEL_GLYPHS[char.codePointAt(0)!]!.advance, 0);
        expect(advance * layout.bodyScale).toBeLessThanOrEqual(layout.width);
      }
    }
  });
});
