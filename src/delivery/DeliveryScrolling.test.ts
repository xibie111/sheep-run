import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_CHAPTERS, type DeliveryChapter } from './DeliveryChapters';
import { DeliveryRoute } from './DeliveryRoute';
import { deliveryPanoramaOffset, deliveryRoadOffset } from './DeliveryScrolling';
import { adaptiveViewportSize, runViewportOrigin, type ViewportSize } from '../game/Viewport';

const views: readonly ViewportSize[] = [
  adaptiveViewportSize(480, 270),
  adaptiveViewportSize(896, 414),
  adaptiveViewportSize(844, 390),
  adaptiveViewportSize(800, 600),
];
const modulo = (value: number, period: number) => ((value % period) + period) % period;
const sourceWidth = 960, sourceHeight = 540;

function geometry(chapter: DeliveryChapter, view: ViewportSize) {
  const origin = runViewportOrigin(view);
  const edge = Math.round(sourceHeight * (chapter.roadCropRatio ?? (chapter.endingKind === 'dinner' ? .72 : .75)));
  const bottomScale = chapter.challenge ? (view.height - 213 - origin.y) / (sourceHeight - edge) : 0;
  const scale = Math.max((213 + origin.y) / edge, view.width / sourceWidth, bottomScale);
  const imageWidth = sourceWidth * scale;
  return { origin, scale, imageWidth, available: Math.max(0, (imageWidth - view.width) / 2) };
}

describe('delivery road scroll uses physical travel rather than source-pixel travel', () => {
  it.each(DELIVERY_CHAPTERS)('$id moves the road exactly as far as an obstacle in every viewport', chapter => {
    for (const view of views) {
      const { scale, origin } = geometry(chapter, view);
      // A texture feature moves by -tilePositionX * tileScaleX in both Phaser
      // WebGL and Canvas. Sample through many texture wraps, not just near zero.
      let previous = deliveryRoadOffset(0, origin.x, scale, sourceWidth, false);
      for (let distance = 100; distance <= 30000; distance += 100) {
        const next = deliveryRoadOffset(distance, origin.x, scale, sourceWidth, false);
        const travelled = modulo(next - previous, sourceWidth) * scale;
        const obstacleMovement = (498 - (distance - 100)) - (498 - distance);
        expect(travelled).toBeCloseTo(obstacleMovement, 8);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(sourceWidth);
        previous = next;
      }
    }
  });

  it('keeps its world phase through camera-origin and texture-scale changes', () => {
    const distance = 4921;
    for (const view of views) for (const scale of [.526, .61, .675, 1.15]) {
      const origin = runViewportOrigin(view);
      const phase = deliveryRoadOffset(distance, origin.x, scale, sourceWidth, false);
      expect(phase * scale).toBeCloseTo(modulo(distance - origin.x, sourceWidth * scale), 8);
      // Screen x = world x + origin.x. The origin correction belongs to the
      // same world phase as the obstacles, rather than an arbitrary screen zero.
      expect(modulo(phase * scale + origin.x, sourceWidth * scale))
        .toBeCloseTo(modulo(distance, sourceWidth * scale), 8);
    }
  });

  it('crosses a texture join while continuing left at one-times road speed', () => {
    const scale = .625, origin = 104;
    const beforeDistance = sourceWidth * scale * 3 + origin - 5;
    const before = deliveryRoadOffset(beforeDistance, origin, scale, sourceWidth, false);
    const after = deliveryRoadOffset(beforeDistance + 10, origin, scale, sourceWidth, false);
    expect(after).toBeLessThan(before); // Normal source-phase wrap is not reverse motion.
    expect(modulo(after - before, sourceWidth) * scale).toBeCloseTo(10, 8);
  });

  it('freezes reduced motion but retains the camera anchor in wide viewports', () => {
    for (const view of views) {
      const origin = runViewportOrigin(view);
      for (const scale of [.526, .675]) {
        const initial = deliveryRoadOffset(0, origin.x, scale, sourceWidth, true);
        for (const distance of [100, 6500, 24000]) {
          expect(deliveryRoadOffset(distance, origin.x, scale, sourceWidth, true)).toBe(initial);
        }
        expect(modulo(initial * scale + origin.x, sourceWidth * scale)).toBeCloseTo(0, 8);
      }
    }
  });
});

describe('unique delivery panoramas traverse their actual visible route interval', () => {
  it.each(DELIVERY_CHAPTERS)('$id keeps all visible panoramas moving left until their next fully visible stage', chapter => {
    for (const view of views) {
      const { imageWidth, available } = geometry(chapter, view);
      for (const [index, layer] of chapter.landscapes.entries()) {
        const start = layer.transitionStart;
        const end = chapter.landscapes[index + 1]?.transitionEnd ?? chapter.length;
        const focused = layer.focus === 'right' || index === chapter.landscapes.length - 1;
        const at = (distance: number) => deliveryPanoramaOffset(distance, start, end,
          available, view.width, imageWidth, focused, false);
        const steps = [0, .1, .3, .7, .95, .999, 1].map(progress => start + (end - start) * progress);
        let previousDistance = steps[0], previous = at(previousDistance);
        for (const distance of steps.slice(1)) {
          const current = at(distance);
          expect(current).toBeLessThan(previous); // Includes the final 0.1%, catching premature clamps.
          expect((previous - current) / (distance - previousDistance)).toBeGreaterThan(0);
          expect((previous - current) / (distance - previousDistance)).toBeLessThan(1);
          previous = current; previousDistance = distance;
        }
        expect(at(start - 100)).toBe(at(start));
        expect(at(end + 100)).toBe(at(end)); // Only hidden stages or a stopped route have completed the pan.
      }
    }
  });

  it('provides real movement even when a wide viewport exactly fits the illustration', () => {
    const view = views[1], start = 4800, end = 12300;
    const at = (distance: number) => deliveryPanoramaOffset(distance, start, end, 0,
      view.width, view.width, false, false);
    expect(at(start)).toBeGreaterThan(0);
    expect(at(end)).toBeLessThan(0);
    expect(at(end - 1)).toBeGreaterThan(at(end));
  });

  it.each(DELIVERY_CHAPTERS)('$id never exposes the mirrored right edge at its unique destination', chapter => {
    for (const view of views) {
      const { imageWidth, available } = geometry(chapter, view);
      const layer = chapter.landscapes.at(-1)!;
      for (const progress of [0, .25, .5, .75, 1]) {
        const distance = layer.transitionStart + (chapter.length - layer.transitionStart) * progress;
        const offset = deliveryPanoramaOffset(distance, layer.transitionStart, chapter.length,
          available, view.width, imageWidth, true, false);
        const paintedRight = view.width / 2 + offset + imageWidth / 2;
        // The viewport ends inside the original painting; its right-side
        // mirror extension therefore cannot duplicate the destination building.
        expect(paintedRight).toBeGreaterThanOrEqual(view.width - 1e-8);
        if (progress === 1) expect(paintedRight).toBeCloseTo(view.width, 8);
        expect(offset + available).toBeGreaterThanOrEqual(-1e-8);
        expect(offset + available).toBeLessThanOrEqual(imageWidth * .035 + 1e-8);
      }
    }
  });

  it('keeps the complete measured lighthouse silhouette visible throughout its final pan', () => {
    const chapter = DELIVERY_CHAPTERS.find(chapter => chapter.id === 'lighthouse-starlight-v1')!;
    const layer = chapter.landscapes.at(-1)!;
    for (const view of views) {
      const { scale, imageWidth, available } = geometry(chapter, view);
      for (const progress of [0, .25, .5, .75, 1]) {
        const distance = layer.transitionStart + (chapter.length - layer.transitionStart) * progress;
        const offset = deliveryPanoramaOffset(distance, layer.transitionStart, chapter.length,
          available, view.width, imageWidth, true, false);
        const paintedLeft = view.width / 2 + offset - imageWidth / 2;
        // Actual tower bounds in the preserved 960-pixel generated painting.
        expect(paintedLeft + 798 * scale).toBeGreaterThanOrEqual(0);
        expect(paintedLeft + 853 * scale).toBeLessThanOrEqual(view.width);
      }
    }
  });

  it('preserves reduced-motion destination framing and freezes every other panorama', () => {
    for (const chapter of DELIVERY_CHAPTERS) for (const view of views) {
      const { imageWidth, available } = geometry(chapter, view);
      for (const focused of [false, true]) {
        const at = (distance: number) => deliveryPanoramaOffset(distance, 0, chapter.length,
          available, view.width, imageWidth, focused, true);
        const initial = at(0);
        expect(at(chapter.length / 2)).toBe(initial);
        expect(at(chapter.length)).toBe(initial);
        expect(initial).toBe(focused ? -available : 0);
      }
    }
  });

  it('ignores elapsed wall time while paused, and restarting restores initial scroll', () => {
    const route = new DeliveryRoute('dinner-for-you-v1');
    route.advance(20, 300);
    const layer = route.chapter.landscapes[0], end = route.chapter.landscapes[1].transitionEnd;
    const snapshot = (distance: number) => ({
      road: deliveryRoadOffset(distance, 104, .61, sourceWidth, false),
      panorama: deliveryPanoramaOffset(distance, layer.transitionStart, end, 0, 584, 584, false, false),
    });
    const paused = snapshot(route.distance);
    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(300000);
      expect(snapshot(route.distance)).toEqual(paused);
    } finally { vi.useRealTimers(); }
    route.advance(20, 300);
    expect(snapshot(route.distance)).not.toEqual(paused);
    const restarted = new DeliveryRoute(route.chapter.id);
    expect(snapshot(restarted.distance)).toEqual(snapshot(0));
    expect(restarted.distance).toBe(0);
  });
});
