import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { SceneEventScheduler, sceneEventSeed } from './SceneEventScheduler';
import { animalOffers, animalAnchorX, allowsAnimal, crowdedForAnimal, type LandscapeState } from './AnimalRules';
import { animalPoses } from './AnimalChoreography';
import { SpawnSystem } from '../systems/SpawnSystemOwner';
import frames from '../../assets/ambient-life-v1/frames.json';

const land: LandscapeState = { theme: 'spring', weather: 'sunny', weatherAlpha: 0, dayPhase: 'afternoon', landTint: 0xffffff, nearOffset: 0, nearRatio: .24, nearRepeatWidth: 960 };
describe('ambient animal scheduling and landscape rules', () => {
  it('waits 20 effective seconds, postpones blocked/missing anchors, and starts only once', () => {
    const s = new SceneEventScheduler(41);
    expect(s.choose(19_999, ['ducks'], false)).toBeNull();
    expect(s.choose(20_000, [], false)).toBeNull();
    expect(s.choose(50_000, ['ducks'], true)).toBeNull();
    expect(s.choose(50_000, ['ducks'], false)).toBe('ducks');
    expect(s.choose(50_000, ['rabbit'], false)).toBeNull();
  });
  it('draws one 30–45 second cooldown after completion, then reproduces it after reset', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = new SceneEventScheduler(seed);
      s.choose(20_000, ['a', 'b'], false); s.finish(27_000);
      const deadline = s.nextEligibleAtMs;
      expect(deadline).toBeGreaterThanOrEqual(57_000); expect(deadline).toBeLessThan(72_000);
      s.finish(99_000); expect(s.nextEligibleAtMs).toBe(deadline);
      expect(s.choose(deadline - 1, ['a'], false)).toBeNull();
      expect(s.choose(deadline, ['a'], false)).toBe('a');
      s.stop(); expect(s.choose(999_000, ['a'], false)).toBeNull();
      s.reset(); expect(s.nextEligibleAtMs).toBe(20_000);
      s.choose(20_000, ['a', 'b'], false); s.finish(27_000); expect(s.nextEligibleAtMs).toBe(deadline);
    }
  });
  it('does not consume shared randomness or change seeded hazards and pickups', () => {
    const shared = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('shared RNG was consumed'); });
    try {
      const run = (ambient: boolean) => {
        const spawn = new SpawnSystem(17), s = new SceneEventScheduler(sceneEventSeed()), trace = [];
        for (let i = 0; i < 20_000; i++) {
          if (ambient) { if (i % 160 === 0) s.finish(i * 40); s.choose(i * 40, ['ducks', 'squirrel'], i % 2 === 0); }
          trace.push(...spawn.update(.04, 300));
        }
        return trace;
      };
      expect(run(true)).toEqual(run(false)); expect(shared).not.toHaveBeenCalled();
    } finally { shared.mockRestore(); }
  });
  it('selects only visible painted anchors, tracks their scroll through a tile boundary, and leaves the road clear', () => {
    const offers = animalOffers({ ...land, nearOffset: 845 }, 0, 480, 190);
    expect(offers.map(o => o.kind)).toEqual(['duck-family', 'rabbit-butterfly']);
    for (const offer of offers) {
      expect(offer.worldX).toBeGreaterThan(160); expect(offer.y).toBeLessThan(211);
      expect(animalAnchorX(offer, { ...land, nearOffset: 965 })).toBe(offer.worldX - 120);
    }
    expect(animalOffers({ ...land, nearRepeatWidth: 0 }, 0, 480, 190)).toEqual([]);
  });
  it('uses displayed weather/day state and excludes butterflies and ducks from winter', () => {
    for (const kind of ['duck-family', 'rabbit-butterfly'] as const) {
      expect(allowsAnimal(kind, { ...land, dayPhase: 'night' })).toBe(false);
      expect(allowsAnimal(kind, { ...land, weather: 'rain', weatherAlpha: .5 })).toBe(false);
      expect(allowsAnimal(kind, { ...land, weather: 'rain', weatherAlpha: 0 })).toBe(true);
    }
    for (const theme of ['spring', 'summer', 'autumn', 'winter'] as const) {
      expect(allowsAnimal('squirrel-acorn', { ...land, theme })).toBe(false);
      expect(animalOffers({ ...land, theme }, 0, 480, 190).some(o => o.kind === 'squirrel-acorn')).toBe(false);
    }
    expect(animalOffers({ ...land, theme: 'winter' }, 0, 480, 190)).toEqual([]);
    expect(allowsAnimal('duck-family', { ...land, theme: 'winter' })).toBe(false);
    expect(allowsAnimal('rabbit-butterfly', { ...land, theme: 'winter' })).toBe(false);
  });
  it('defers for imminent hazards and short combinations without changing them', () => {
    const hazards = [{ active: true, x: 250, rightEdge: 282 }, { active: true, x: 455, rightEdge: 487 }];
    const before = structuredClone(hazards);
    expect(crowdedForAnimal(hazards, 190)).toBe(true);
    expect(crowdedForAnimal([hazards[1]!], 190)).toBe(false);
    expect(hazards).toEqual(before);
  });
  it.each(['duck-family', 'squirrel-acorn', 'rabbit-butterfly'] as const)('freezes %s poses with effective time and offers a static reduced-motion version', kind => {
    expect(animalPoses(kind, 2400, false)).toEqual(animalPoses(kind, 2400, false));
    expect(animalPoses(kind, 2000, true)).toEqual(animalPoses(kind, 3500, true));
    expect(animalPoses(kind, 2000, false)).not.toEqual(animalPoses(kind, 3500, false));
    for (const pose of animalPoses(kind, 2400, false)) expect(frames[pose.frame]).toBeDefined();
  });
  it('ships all eighteen isolated sprite frames inside the packaged PNG', () => {
    const png = readFileSync(new URL('../../assets/ambient-life-v1/runtime/animals-atlas.png', import.meta.url));
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20), rects = Object.values(frames);
    expect(rects).toHaveLength(18);
    for (const [index, f] of rects.entries()) {
      expect(f.width * f.height).toBeGreaterThan(0); expect(f.x + f.width).toBeLessThanOrEqual(width); expect(f.y + f.height).toBeLessThanOrEqual(height);
      for (const previous of rects.slice(0, index)) expect(previous.x < f.x + f.width && f.x < previous.x + previous.width && previous.y < f.y + f.height && f.y < previous.y + previous.height).toBe(false);
    }
  });
});
