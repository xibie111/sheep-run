import { afterEach, describe, expect, it, vi } from 'vitest';
import { adaptiveViewportSize } from '../game/Viewport';
import type { ArtRect } from './MenuArtLayout';
import { RESULT_BOXES, resultPlacement, resultTripEntry } from './ResultLayout';

const overlaps = (a: ArtRect, b: ArtRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('result travel entry placement', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([[480, 270], [896, 414], [844, 390], [800, 600]])(
    'keeps the two book entries and existing title, numbers and actions separate at %sx%s for both DPRs', (width, height) => {
      const size = adaptiveViewportSize(width, height), safe = { left: 0, right: 0, top: 0, bottom: 0 };
      let previous: ArtRect | undefined;
      for (const dpr of [1, 2]) {
        vi.stubGlobal('window', { devicePixelRatio: dpr });
        const entry = resultTripEntry(size, safe), placement = resultPlacement(size, safe);
        const book = { x: safe.left + 7, y: safe.top + 5, width: 133, height: 29 };
        expect(overlaps(entry, book)).toBe(false); expect(entry.width).toBe(128); expect(entry.height).toBe(34);
        expect(entry.x).toBeGreaterThanOrEqual(safe.left); expect(entry.x + entry.width).toBeLessThanOrEqual(size.width - safe.right);
        expect(entry.y).toBeGreaterThanOrEqual(safe.top); expect(entry.y + entry.height).toBeLessThanOrEqual(size.height - safe.bottom);
        for (const name of ['title', 'score', 'record', 'best', 'earned', 'retry', 'home', 'saveError', 'saveHint'] as const) {
          const authored = RESULT_BOXES[name];
          const box = { x: placement.x + authored.x * placement.scale, y: placement.y + authored.y * placement.scale,
            width: authored.width * placement.scale, height: authored.height * placement.scale };
          expect(overlaps(entry, box), `trip entry overlaps ${name}`).toBe(false);
        }
        if (previous) expect(entry).toEqual(previous); previous = entry;
      }
    });

  it('keeps a modest asymmetric safe-area offset without moving or overlapping the existing result actions', () => {
    const size = { width: 584, height: 270 }, safe = { left: 16, right: 24, top: 12, bottom: 8 };
    const entry = resultTripEntry(size, safe), placement = resultPlacement(size, safe);
    expect(entry.x + entry.width).toBe(size.width - safe.right - 7); expect(entry.y).toBe(safe.top + 5);
    for (const name of ['title', 'score', 'retry', 'home'] as const) {
      const box = RESULT_BOXES[name];
      expect(overlaps(entry, { x: placement.x + box.x * placement.scale, y: placement.y + box.y * placement.scale,
        width: box.width * placement.scale, height: box.height * placement.scale })).toBe(false);
    }
  });
});
