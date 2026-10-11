import { describe, expect, it, vi } from 'vitest';
import { DeliveryRoute, DELIVERY_OBSTACLES, DELIVERY_LENGTH } from './DeliveryRoute';
import { SpawnSystem } from '../systems/SpawnSystemOwner';
import { DifficultySystem } from '../systems/DifficultySystem';

describe('delivery route clock and fixed plan', () => {
  it('finishes by travelled distance, with a safe final road and roughly one minute of play', () => {
    const route = new DeliveryRoute(), difficulty = new DifficultySystem(); let ms = 0, count = 0;
    while (route.state === 'running') { ms += 20; count += route.advance(20, difficulty.update(.02)).length; }
    expect(ms).toBeGreaterThan(50000); expect(ms).toBeLessThan(65000);
    expect(route.distance).toBe(DELIVERY_LENGTH); expect(count).toBe(14);
    expect(DELIVERY_LENGTH - DELIVERY_OBSTACLES.at(-1)!.at).toBeGreaterThan(1500);
    expect(route.state).toBe('ending');
    for (let i = 0; i < 209; i++) route.advance(20, 0);
    expect(route.state).toBe('ending'); route.advance(20, 0); expect(route.state).toBe('complete');
  });
  it('gives the same authored positions and phases across frame rates and speed upgrades', () => {
    const simulate = (step: number, multiplier: number) => { const r = new DeliveryRoute(), d = new DifficultySystem(multiplier), seen = []; while (r.state === 'running') seen.push(...r.advance(step, d.update(step / 1000))); return seen; };
    expect(simulate(10, 1)).toEqual(simulate(40, 1.2));
    expect(simulate(16, 1)).toEqual(DELIVERY_OBSTACLES);
  });
  it('cannot advance from invalid time, zero delta, failure or completion; restart has no residual plan', () => {
    const route = new DeliveryRoute(); route.advance(NaN, 390); route.advance(-20, 390); route.advance(0, 390);
    expect(route.distance).toBe(0); route.advance(20, 390); const distance = route.distance;
    route.fail(); expect(route.advance(40, 390)).toEqual([]); expect(route.distance).toBe(distance);
    const restart = new DeliveryRoute(); expect(restart.distance).toBe(0); expect(restart.state).toBe('running');
  });
  it('bounds resumed deltas and does not use wall clock', () => {
    const route = new DeliveryRoute(); vi.useFakeTimers();
    try { vi.advanceTimersByTime(900000); expect(route.distance).toBe(0); route.advance(900000, 200); expect(route.distance).toBe(8); } finally { vi.useRealTimers(); }
  });
  it('does not draw Math.random or perturb the original spawn stream', () => {
    const expected = new SpawnSystem(123), actual = new SpawnSystem(123), random = vi.spyOn(Math, 'random');
    const route = new DeliveryRoute(); for (let i = 0; i < 4000; i++) { route.advance(20, 320); expect(actual.update(.02, 320)).toEqual(expected.update(.02, 320)); }
    expect(random).not.toHaveBeenCalled(); random.mockRestore();
  });
});
