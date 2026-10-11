import { describe, expect, it } from "vitest";
import { MENU_ART_GEOMETRY } from "../data/menuArtAssets";
import { menuArtLayout, scoreGlyphLayout, scoreNumberBox } from "./MenuArtLayout";

describe("complete main-menu artwork bounds", () => {
  it.each([[480, 270], [584, 270], [480, 360], [960, 270]])("keeps crown, decoration and buttons within safe edges at %sx%s", (width, height) => {
    const safe = { left: 30, right: 18, top: 12, bottom: 10 };
    const layout = menuArtLayout({ width, height }, safe);
    for (const [name, rect] of Object.entries(layout)) {
      expect(rect.x, name).toBeGreaterThanOrEqual(safe.left);
      expect(rect.y, name).toBeGreaterThanOrEqual(safe.top);
      expect(rect.x + rect.width, name).toBeLessThanOrEqual(width - safe.right);
      expect(rect.y + rect.height, name).toBeLessThanOrEqual(height - safe.bottom);
      const ink = MENU_ART_GEOMETRY[name as keyof typeof layout].ink;
      expect(rect.width / ink.width, name).toBeCloseTo(rect.height / ink.height);
    }
    expect(layout.score.x + layout.score.width).toBe(width - safe.right - 8);
    expect(layout.score.y).toBe(safe.top + 8);
  });

  it.each([0, 12345, 123456789012345, 1e30])("fits the actual dynamic score %s inside the blank number row", score => {
    const badge = menuArtLayout({ width: 584, height: 270 }, { left: 0, right: 0, top: 0, bottom: 0 }).score;
    const box = scoreNumberBox(badge);
    const glyphs = scoreGlyphLayout(score, box);
    expect(glyphs.map(glyph => glyph.digit).join("")).toBe(BigInt(score).toString().padStart(5, "0"));
    for (const { source, destination } of glyphs) {
      expect(destination.x).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(destination.y).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(destination.x + destination.width).toBeLessThanOrEqual(box.x + box.width + 1e-9);
      expect(destination.y + destination.height).toBeLessThanOrEqual(box.y + box.height + 1e-9);
      expect(destination.width / source.width).toBeCloseTo(destination.height / source.height);
    }
  });
});
