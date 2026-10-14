import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_CHAPTERS, defaultDeliveryChapter, getDeliveryChapter, isDeliveryChapterId, DELIVERY_V2_TEXT } from './DeliveryChapters';
import { DeliveryRoute, createDeliveryRoute, DELIVERY_ID, DELIVERY_SEED, DELIVERY_PHASES, DELIVERY_OBSTACLES } from './DeliveryRoute';
import { DeliverySelection } from './DeliverySelection';
import { DifficultySystem } from '../systems/DifficultySystem';
import { SpawnSystem } from '../systems/SpawnSystemOwner';

const dinnerId = 'dinner-for-you-v1';
describe('configurable delivery chapters', () => {
  it('keeps the original route as the absent/unknown ID default and retains the original authored contract', () => {
    expect(defaultDeliveryChapter().id).toBe('hill-goodnight-v1');
    expect(new DeliveryRoute().chapter).toBe(defaultDeliveryChapter());
    expect(createDeliveryRoute('future-route').chapter).toBe(defaultDeliveryChapter());
    expect(DELIVERY_ID).toBe('hill-goodnight-v1'); expect(DELIVERY_SEED).toBe(0x6e696768);
    expect(DELIVERY_PHASES.map(phase => [phase.id, phase.start])).toEqual([['pasture', 0], ['forest', 5200], ['hill', 11700], ['arrival', 16700]]);
    expect(DELIVERY_OBSTACLES.map(request => request.at)).toEqual([600, 1900, 3200, 4450, 5650, 6500, 7350, 8450, 9300, 10400, 11900, 13100, 14300, 15400]);
    expect(defaultDeliveryChapter().title).toBe('把晚安送到山坡上');
  });
  it('retains the original five IDs alongside the six resident routes, and ignores invalid selection', () => {
    expect(DELIVERY_CHAPTERS).toHaveLength(11);
    expect(getDeliveryChapter(dinnerId)?.title).toBe('带着晚饭去找你');
    expect(getDeliveryChapter('future-route')).toBeUndefined();
    expect(isDeliveryChapterId(dinnerId)).toBe(true); expect(isDeliveryChapterId(null)).toBe(false);
    const selected = new DeliverySelection(); expect(selected.id).toBe(DELIVERY_ID);
    expect(selected.select(dinnerId)).toBe(true); expect(selected.select('future')).toBe(false); expect(selected.id).toBe(dinnerId);
    expect(new DeliverySelection(dinnerId).id).toBe(dinnerId);
  });
  it('finishes dinner by distance after roughly one minute with a clear safe final road', () => {
    const route = createDeliveryRoute(dinnerId), difficulty = new DifficultySystem(); let ms = 0;
    while (route.state === 'running') { ms += 20; route.advance(20, difficulty.update(.02)); }
    expect(ms).toBeGreaterThan(50000); expect(ms).toBeLessThan(65000);
    expect(route.distance).toBe(route.chapter.length); expect(route.state).toBe('ending');
    expect(route.chapter.length - route.chapter.obstacles.at(-1)!.at).toBe(3200);
    expect(route.chapter.destinationAt).toBeGreaterThan(route.chapter.obstacles.at(-1)!.at);
  });
  it('progresses through dusk, field, lit window and safe arrival using real distance', () => {
    const route = createDeliveryRoute(dinnerId);
    expect(route.phase.id).toBe('dusk-pasture');
    route.distance = 5200; expect(route.phase.id).toBe('field');
    route.distance = 11700; expect(route.phase.id).toBe('cottage');
    route.distance = 16500; expect(route.phase.id).toBe('arrival');
  });
  it('emits each fixed obstacle once at all frame rates and upgrades, with a chapter-only seed', () => {
    const simulate = (step: number, factor: number) => { const route = createDeliveryRoute(dinnerId), difficulty = new DifficultySystem(factor), seen = []; while (route.state === 'running') seen.push(...route.advance(step, difficulty.update(step / 1000))); return seen; };
    expect(simulate(10, 1)).toEqual(simulate(40, 1.2));
    expect(simulate(16, 1)).toEqual(getDeliveryChapter(dinnerId)!.obstacles);
    expect(getDeliveryChapter(dinnerId)!.seed).not.toBe(DELIVERY_SEED);
  });
  it('failure freezes time; a retry is fresh; reaching completion can only transition once', () => {
    const route = createDeliveryRoute(dinnerId); route.advance(20, 390); route.fail(); const distance = route.distance;
    for (let i = 0; i < 10; i++) expect(route.advance(40, 390)).toEqual([]);
    expect(route.distance).toBe(distance); expect(route.state).toBe('failed');
    const retry = createDeliveryRoute(dinnerId); expect(retry.distance).toBe(0); expect(retry.state).toBe('running');
    retry.distance = retry.chapter.length - 1; retry.advance(40, 390); expect(retry.state).toBe('ending');
    let completions = 0, last = retry.state;
    for (let i = 0; i < 400; i++) { retry.advance(20, 0); if (retry.state === 'complete' && last !== 'complete') completions++; last = retry.state; }
    expect(completions).toBe(1); expect(retry.endingMs).toBe(4200); expect(retry.advance(40, 390)).toEqual([]);
  });
  it('pause/invalid deltas cannot progress distance or ending and the normal spawner stream stays untouched', () => {
    const route = createDeliveryRoute(dinnerId), expected = new SpawnSystem(991), actual = new SpawnSystem(991), random = vi.spyOn(Math, 'random');
    try {
      for (let i = 0; i < 4000; i++) { route.advance(20, 320); expect(actual.update(.02, 320)).toEqual(expected.update(.02, 320)); }
      const distance = route.distance, ending = route.endingMs;
      route.advance(0, 390); route.advance(NaN, 390); route.advance(-9, 390);
      expect(route.distance).toBe(distance); expect(route.endingMs).toBe(ending); expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });
  it('exports actual new chapter/UI text for the shared local font', () => {
    expect(DELIVERY_V2_TEXT).toContain('带着晚饭去找你'); expect(DELIVERY_V2_TEXT).toContain('饭盒打开了，喜欢也藏不住了。');
    expect(DELIVERY_V2_TEXT.join('')).not.toMatch(/undefined|NaN/);
  });
});
