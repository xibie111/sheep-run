import { describe, expect, it } from 'vitest';
import { adaptiveViewportSize } from '../game/Viewport';
import { deliveryPanelLayout } from './DeliveryPanelLayout';
import type { ArtRect } from '../ui/MenuArtLayout';

const contained = (outer: ArtRect, inner: ArtRect) => inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const overlaps = (a: ArtRect, b: ArtRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
describe('delivery panel touch layout', () => {
  it.each([[480, 270], [896, 414], [844, 390], [800, 600]])('keeps cards and touch actions inside %sx%s', (width, height) => {
    const size = adaptiveViewportSize(width, height), layout = deliveryPanelLayout(size, { left: 0, right: 0, top: 0, bottom: 0 });
    expect(contained(layout.blocker, layout.panel)).toBe(true);
    for (const box of [layout.back, layout.start, layout.card, layout.previous, layout.next, ...layout.cards]) {
      expect(contained(layout.panel, box)).toBe(true); expect(box.height).toBeGreaterThanOrEqual(32); expect(box.width).toBeGreaterThanOrEqual(32);
    }
    for (const controls of [[layout.back, layout.album, layout.previous, layout.next, ...layout.cards], [layout.back, layout.start, layout.card]]) {
      for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) expect(overlaps(controls[i], controls[j])).toBe(false);
    }
    expect(layout.cards[0].height).toBeGreaterThanOrEqual(140);
    for (const box of layout.albumSlots) expect(contained(layout.panel, box)).toBe(true);
  });
  it('moves a whole panel inside asymmetric safe insets without shrinking the Canvas', () => {
    const safe = { left: 21, right: 11, top: 4, bottom: 5 }, size = { width: 584, height: 270 };
    const layout = deliveryPanelLayout(size, safe);
    expect(layout.blocker).toEqual({ x: 0, y: 0, ...size });
    expect(contained({ x: safe.left, y: safe.top, width: size.width - safe.left - safe.right, height: size.height - safe.top - safe.bottom }, layout.panel)).toBe(true);
  });
});
