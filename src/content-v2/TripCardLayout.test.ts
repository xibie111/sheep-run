import { describe, expect, it } from "vitest";
import { adaptiveViewportSize } from "../game/Viewport";
import { fitTripArt, tripCardLayout } from "./TripCardLayout";

describe("generated travel card layout", () => {
  const safe = { left: 0, right: 0, top: 0, bottom: 0 };
  it.each([[480, 270], [896, 414], [844, 390], [800, 600]])("keeps every field and touch target inside %sx%s viewport", (width, height) => {
    const size = adaptiveViewportSize(width, height), layout = tripCardLayout(size, safe);
    expect(layout.panel.width).toBeLessThanOrEqual(390); expect(layout.panel.height).toBeLessThanOrEqual(220);
    const boxes = [layout.title, layout.portrait, layout.protagonistName, layout.seasons, layout.summary, layout.footer, layout.close, ...layout.highlights.flatMap(row => [row.text, row.stamp])];
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(layout.panel.x);
      expect(box.y).toBeGreaterThanOrEqual(layout.panel.y);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + .001);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height + .001);
    }
    expect(layout.close.height).toBeGreaterThanOrEqual(32);
    expect(layout.summary.y + layout.summary.height).toBeLessThan(layout.highlights[0].text.y);
    expect(layout.highlights[2].text.y + layout.highlights[2].text.height).toBeLessThan(layout.close.y);
  });

  it("moves the panel inside safe areas without reducing the canvas", () => {
    const safe = { left: 30, right: 18, top: 10, bottom: 12 };
    const layout = tripCardLayout({ width: 480, height: 270 }, safe);
    expect(layout.panel.x).toBeGreaterThanOrEqual(safe.left + 10);
    expect(layout.panel.y).toBeGreaterThanOrEqual(safe.top + 10);
    expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(480 - safe.right - 10);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(270 - safe.bottom - 10);
  });

  it.each([1.4, 1.8, 2.2])("preserves a paper ratio of %s with contained internal layout", aspect => {
    const layout = tripCardLayout({ width: 480, height: 270 }, safe, aspect);
    expect(layout.panel.width / layout.panel.height).toBeCloseTo(aspect);
    expect(layout.close.y + layout.close.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height + .001);
  });

  it("contains landscape, square and sheep portrait art without stretching or cropping", () => {
    const box = { x: 20, y: 30, width: 92, height: 88 };
    for (const [width, height] of [[128, 112], [1536, 1024], [1024, 1024]]) {
      const art = fitTripArt(width, height, box);
      expect(art.width / art.height).toBeCloseTo(width / height);
      expect(art.x).toBeGreaterThanOrEqual(box.x); expect(art.y).toBeGreaterThanOrEqual(box.y);
      expect(art.x + art.width).toBeLessThanOrEqual(box.x + box.width + .001);
      expect(art.y + art.height).toBeLessThanOrEqual(box.y + box.height + .001);
    }
  });
});
