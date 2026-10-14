import { describe, expect, it } from 'vitest';
import { PLAYER } from '../game/Constants';
import { adaptiveViewportSize, runViewportOrigin } from '../game/Viewport';
import { getDeliveryChapter } from './DeliveryChapters';
import { DeliveryRoute } from './DeliveryRoute';
import { deliveryRoadOffset } from './DeliveryScrolling';
import { windmillMeadowGrassOffset, windmillMeadowLandmarkX } from './WindmillMeadowMotion';

const chapter = getDeliveryChapter('windmill-invitation-v1')!;
const modulo = (value: number, period: number) => ((value % period) + period) % period;

describe('windmill meadow destination world placement', () => {
  it('keeps a grounded windmill exactly 80 world units beside the actual mailbox', () => {
    for (const playerX of [PLAYER.x, 100]) {
      let previous = windmillMeadowLandmarkX(chapter.destinationAt, chapter.length, playerX);
      for (let distance = chapter.destinationAt; distance <= chapter.length; distance += 10) {
        const actualMailboxX = playerX + 78 + chapter.length - distance;
        const current = windmillMeadowLandmarkX(distance, chapter.length, playerX);
        expect(current - actualMailboxX).toBe(80);
        if (distance > chapter.destinationAt) expect(current - previous).toBe(-10);
        previous = current;
      }
    }
  });

  it('reaches the same final world anchor across base, phone and tall viewports', () => {
    const endpointWorldX = windmillMeadowLandmarkX(chapter.length, chapter.length, PLAYER.x);
    expect(endpointWorldX).toBe(238);
    for (const [width, height, expectedScreenX] of [[480, 270, 238], [896, 414, 342], [844, 390, 342], [800, 600, 238]]) {
      const origin = runViewportOrigin(adaptiveViewportSize(width, height));
      expect(endpointWorldX + origin.x).toBe(expectedScreenX);
      expect(endpointWorldX + origin.x - (PLAYER.x + origin.x)).toBe(158);
    }
  });

  it('enters near the destination instead of clamping the near building to the meadow phase', () => {
    expect(windmillMeadowLandmarkX(chapter.destinationAt, chapter.length, PLAYER.x)).toBe(1038);
    expect(windmillMeadowLandmarkX(20800, chapter.length, PLAYER.x)).toBe(438);
    const width = 128;
    const firstContactDistance = chapter.length + 238 - width / 2 - 480;
    expect(firstContactDistance).toBe(20694);
    expect(windmillMeadowLandmarkX(firstContactDistance, chapter.length, PLAYER.x) - width / 2).toBe(480);
  });

  it('holds on a stopped route and resets its world placement when the route restarts', () => {
    const route = new DeliveryRoute(chapter.id);
    route.distance = chapter.length - 1;
    route.advance(40, 390);
    expect(route.state).toBe('ending');
    const atEnding = windmillMeadowLandmarkX(route.distance, chapter.length, PLAYER.x);
    for (let elapsed = 0; elapsed <= chapter.endingDurationMs; elapsed += 40) route.advance(40, 390);
    expect(route.state).toBe('complete');
    expect(windmillMeadowLandmarkX(route.distance, chapter.length, PLAYER.x)).toBe(atEnding);
    const restarted = new DeliveryRoute(chapter.id);
    expect(windmillMeadowLandmarkX(restarted.distance, chapter.length, PLAYER.x)).toBe(21238);
  });
});

describe('windmill meadow grass uses the road world phase', () => {
  it('matches one-times road travel across independent texture scales, widths and wraps', () => {
    const originX = 104, roadScale = .61, roadWidth = 960;
    for (const [grassScale, grassWidth] of [[.5, 960], [.75, 512], [1.15, 128]]) {
      const grassPeriod = grassScale * grassWidth;
      const distance = originX + grassPeriod * 3 - 5;
      const before = windmillMeadowGrassOffset(distance, originX, grassScale, grassWidth, false);
      const after = windmillMeadowGrassOffset(distance + 10, originX, grassScale, grassWidth, false);
      expect(after).toBeLessThan(before);
      const grassTravel = modulo(after - before, grassWidth) * grassScale;
      const roadBefore = deliveryRoadOffset(distance, originX, roadScale, roadWidth, false);
      const roadAfter = deliveryRoadOffset(distance + 10, originX, roadScale, roadWidth, false);
      const roadTravel = modulo(roadAfter - roadBefore, roadWidth) * roadScale;
      expect(grassTravel).toBeCloseTo(10, 8);
      expect(grassTravel).toBeCloseTo(roadTravel, 8);
    }
  });

  it('retains the world origin through resizing without applying the camera twice', () => {
    const distance = 20800;
    for (const [width, height] of [[480, 270], [896, 414], [800, 600]]) {
      const origin = runViewportOrigin(adaptiveViewportSize(width, height));
      for (const scale of [.5, .675, 1.15]) {
        const phase = windmillMeadowGrassOffset(distance, origin.x, scale, 960, false);
        expect(modulo(phase * scale + origin.x, 960 * scale))
          .toBeCloseTo(modulo(distance, 960 * scale), 8);
      }
    }
  });

  it('freezes optional grass scroll in reduced motion while the necessary landmark keeps world alignment', () => {
    const scale = .675, originX = 104;
    const initial = windmillMeadowGrassOffset(0, originX, scale, 960, true);
    for (const distance of [chapter.destinationAt, 20800, chapter.length]) {
      expect(windmillMeadowGrassOffset(distance, originX, scale, 960, true)).toBe(initial);
      expect(windmillMeadowLandmarkX(distance, chapter.length, PLAYER.x)
        - (PLAYER.x + 78 + chapter.length - distance)).toBe(80);
    }
    expect(modulo(initial * scale + originX, 960 * scale)).toBeCloseTo(0, 8);
  });
});
