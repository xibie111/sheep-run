import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../ambient/animalAssets', () => ({ ANIMAL_TEXTURE: 'ambient-life-atlas' }));
import type { LandscapeState } from '../ambient/AnimalRules';
import { SceneEventRandom } from '../ambient/SceneEventScheduler';
import {
  TravelPostcardExposure, TravelPostcardObserver, visibleTravelPostcards,
  type TravelPostcardContext, type TravelPostcardFacts, type TravelPostcardId,
} from './TravelPostcardObserver';

const landscape: LandscapeState = { theme: 'spring', dayPhase: 'morning', weather: 'sunny', weatherAlpha: 0,
  landTint: 0xffffff, nearOffset: 0, nearRatio: .24, nearRepeatWidth: 1134 };
const facts = (overrides: Partial<TravelPostcardFacts> = {}): TravelPostcardFacts => ({
  landscape, backgroundVisible: true, pondVisible: false, duckFamilyVisible: false, butterflyPairVisible: false, ...overrides,
});

function image(key: string, name = '', x = 0, y = 0, width = 480, height = 270, scrollFactor = 0) {
  return { texture: { key }, name, active: true, visible: true, alpha: 1, scrollFactorX: scrollFactor, scrollFactorY: scrollFactor,
    bounds: { x, y, width, height, right: x + width, bottom: y + height }, getBounds() { return this.bounds; } };
}
function harness(land = landscape) {
  let paused = false, active = true, shown = true, canvasSize = { width: 480, height: 270 };
  const events = new EventEmitter(), objects = [image(`season-${land.theme}-far`), image(`season-${land.theme}-near`)];
  const camera = { visible: true, alpha: 1, scrollX: 0, scrollY: 0, renderList: [...objects] };
  const notify = vi.fn(), discover = vi.fn((_id: TravelPostcardId) => ({ added: true, saved: true }));
  const off = vi.spyOn(events, 'off');
  const scene = { game: { events, canvas: { getBoundingClientRect: () => canvasSize } }, children: { list: objects }, cameras: { main: camera },
    scene: { isPaused: () => paused, isActive: () => active, isVisible: () => shown } };
  const observer = new TravelPostcardObserver(scene as never, notify, { discover });
  const context = (extra: Partial<TravelPostcardContext> = {}): TravelPostcardContext => ({ deltaMs: 100, landscape: land, viewport: { width: 480, height: 270 }, ...extra });
  const frame = (extra: Partial<TravelPostcardContext> = {}) => { observer.update(context(extra)); events.emit('postrender'); };
  const frames = (count: number, extra: Partial<TravelPostcardContext> = {}) => { for (let i = 0; i < count; i++) frame(extra); };
  const add = (object: ReturnType<typeof image>) => { objects.push(object); camera.renderList.push(object); return object; };
  const animal = (slot: string, x = 150, y = 180) => add(image('ambient-life-atlas', `ambient-life:${slot}`, x, y, 20, 14, 1));
  return { scene, camera, objects, observer, context, frame, frames, events, notify, discover, off, add, animal,
    pause: (value: boolean) => { paused = value; }, hideScene: () => { shown = false; }, stopScene: () => { active = false; },
    hideCanvas: () => { canvasSize = { width: 0, height: 0 }; } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('travel postcard conditions', () => {
  it('requires the actual season, day phase and appropriate dry/clear weather', () => {
    expect(visibleTravelPostcards(facts())).toEqual(['spring-pasture-v1']);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, dayPhase: 'night' } }))).toEqual([]);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, weather: 'rain', weatherAlpha: .15 } }))).toEqual([]);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, weather: 'rain', weatherAlpha: .14 } }))).toEqual(['spring-pasture-v1']);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, theme: 'summer' } }))).toEqual([]);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, theme: 'summer' }, pondVisible: true }))).toEqual(['summer-pond-v1']);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, theme: 'autumn', dayPhase: 'afternoon' } }))).toEqual([]);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, theme: 'autumn', dayPhase: 'sunset' } }))).toEqual(['autumn-sunset-v1']);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, theme: 'winter', weather: 'wind' } }))).toEqual([]);
    expect(visibleTravelPostcards(facts({ landscape: { ...landscape, theme: 'winter' } }))).toEqual(['winter-sunshine-v1']);
  });
  it('never infers a visible background/pond/animal from environment or a planned event', () => {
    expect(visibleTravelPostcards(facts({ backgroundVisible: false }))).toEqual([]);
    expect(visibleTravelPostcards(facts({ backgroundVisible: false, duckFamilyVisible: true }))).toEqual(['duck-outing-v1']);
    expect(visibleTravelPostcards(facts({ backgroundVisible: false, butterflyPairVisible: true }))).toEqual(['butterfly-path-v1']);
  });
});

describe('effective rendered exposure', () => {
  it('requires 1500 consecutive milliseconds, freezes during pause and completes each card once', () => {
    const rule = new TravelPostcardExposure();
    for (let i = 0; i < 10; i++) expect(rule.observe(100, ['spring-pasture-v1'])).toBeNull();
    expect(rule.observe(999_999, ['spring-pasture-v1'], true)).toBeNull();
    for (let i = 0; i < 4; i++) expect(rule.observe(100, ['spring-pasture-v1'])).toBeNull();
    expect(rule.observe(100, ['spring-pasture-v1'])).toBe('spring-pasture-v1');
    for (let i = 0; i < 40; i++) expect(rule.observe(100, ['spring-pasture-v1'])).toBeNull();
  });
  it('rejects invalid/large deltas and resets incomplete observations on a hidden or cropped frame', () => {
    const rule = new TravelPostcardExposure();
    for (const delta of [NaN, Infinity, -1, 0]) expect(rule.observe(delta, ['duck-outing-v1'])).toBeNull();
    expect(rule.observe(999_999, ['duck-outing-v1'])).toBeNull();
    for (let i = 0; i < 12; i++) rule.observe(100, ['duck-outing-v1']);
    rule.observe(100, []);
    for (let i = 0; i < 14; i++) expect(rule.observe(100, ['duck-outing-v1'])).toBeNull();
    rule.hide();
    for (let i = 0; i < 14; i++) expect(rule.observe(100, ['duck-outing-v1'])).toBeNull();
    expect(rule.observe(100, ['duck-outing-v1'])).toBe('duck-outing-v1');
  });
  it('emits one card per frame and drops a second ready observation when it is no longer visible', () => {
    const rule = new TravelPostcardExposure(), visible: TravelPostcardId[] = ['spring-pasture-v1', 'duck-outing-v1'];
    for (let i = 0; i < 14; i++) rule.observe(100, visible);
    expect(rule.observe(100, visible)).toBe('spring-pasture-v1');
    expect(rule.observe(100, ['spring-pasture-v1'])).toBeNull();
    for (let i = 0; i < 14; i++) expect(rule.observe(100, visible)).toBeNull();
    expect(rule.observe(100, visible)).toBe('duck-outing-v1');
    rule.clear(); expect(rule.observe(999_999, visible)).toBeNull();
    const fresh = new TravelPostcardExposure();
    for (let i = 0; i < 14; i++) fresh.observe(100, visible);
    expect(fresh.observe(100, visible)).toBe('spring-pasture-v1');
    expect(fresh.observe(100, visible)).toBe('duck-outing-v1');
  });
  it('does not consume ambient/gameplay random streams or call Math.random', () => {
    const random = new SceneEventRandom(48), baseline = new SceneEventRandom(48), globalRandom = vi.spyOn(Math, 'random');
    const rule = new TravelPostcardExposure();
    for (let i = 0; i < 100; i++) { rule.observe(100, visibleTravelPostcards(facts())); expect(random.next()).toBe(baseline.next()); }
    expect(globalRandom).not.toHaveBeenCalled();
  });
});

describe('postrender scene observer', () => {
  it('does not count sprite placement, planned animals or renderer frames without new effective time', () => {
    const h = harness();
    for (let i = 0; i < 30; i++) h.observer.update(h.context({ animalKind: 'duck-family' }));
    expect(h.discover).not.toHaveBeenCalled();
    h.events.emit('postrender'); for (let i = 0; i < 30; i++) h.events.emit('postrender');
    expect(h.discover).not.toHaveBeenCalled();
    h.frames(14); expect(h.discover).toHaveBeenCalledExactlyOnceWith('spring-pasture-v1');
    h.frames(30); expect(h.notify).toHaveBeenCalledTimes(1); h.observer.clear();
  });
  it('requires matching visible seasonal artwork actually submitted to the main camera', () => {
    const h = harness(); h.camera.renderList = []; h.frames(20); expect(h.discover).not.toHaveBeenCalled();
    h.camera.renderList = [...h.objects]; h.objects[1].texture.key = 'season-summer-near'; h.frames(20);
    expect(h.discover).not.toHaveBeenCalled();
    h.objects[1].texture.key = 'season-spring-near'; h.objects[0].alpha = .59; h.frames(20);
    expect(h.discover).not.toHaveBeenCalled();
    h.objects[0].alpha = 1; h.frames(15); expect(h.discover).toHaveBeenCalledExactlyOnceWith('spring-pasture-v1'); h.observer.clear();
  });
  it('requires the summer pond itself to be fully visible rather than merely generated', () => {
    const h = harness({ ...landscape, theme: 'summer' }); h.frames(20); expect(h.discover).not.toHaveBeenCalled();
    const pond = h.animal('pond', -1); h.frames(20); expect(h.discover).not.toHaveBeenCalled();
    pond.bounds.x = 100; pond.bounds.right = 120; h.frames(14); expect(h.discover).not.toHaveBeenCalled();
    h.frame(); expect(h.discover).toHaveBeenCalledExactlyOnceWith('summer-pond-v1'); h.observer.clear();
  });
  it('requires mother and all ducklings, or both rabbit and butterfly, in the actual rendering', () => {
    const h = harness({ ...landscape, theme: 'winter', dayPhase: 'night' });
    h.animal('mother'); h.animal('duckling-1'); h.animal('duckling-2'); h.frames(20, { animalKind: 'duck-family' });
    expect(h.discover).not.toHaveBeenCalled(); h.animal('duckling-3'); h.frames(15, { animalKind: 'duck-family' });
    expect(h.discover).toHaveBeenCalledExactlyOnceWith('duck-outing-v1');
    h.animal('rabbit'); h.frames(20, { animalKind: 'rabbit-butterfly' }); expect(h.discover).toHaveBeenCalledTimes(1);
    h.animal('butterfly'); h.frames(15, { animalKind: 'rabbit-butterfly' });
    expect(h.discover).toHaveBeenLastCalledWith('butterfly-path-v1'); h.observer.clear();
  });
  it('freezes on pause, excludes hidden/destroyed/canvasless scenes, and clears the listener once on exit', () => {
    const h = harness(); h.frames(10); h.pause(true); h.frames(100); expect(h.discover).not.toHaveBeenCalled();
    h.pause(false); h.frames(5); expect(h.discover).toHaveBeenCalledTimes(1);
    h.observer.update(h.context()); h.observer.clear(); h.observer.clear(); h.events.emit('postrender'); h.frames(30);
    expect(h.discover).toHaveBeenCalledTimes(1); expect(h.off).toHaveBeenCalledExactlyOnceWith('postrender', expect.any(Function));
    expect(h.events.listenerCount('postrender')).toBe(0);
    for (const stop of ['hideScene', 'stopScene', 'hideCanvas'] as const) {
      const other = harness(); other[stop](); other.frames(20); expect(other.discover).not.toHaveBeenCalled(); other.observer.clear();
    }
    const bare = new TravelPostcardObserver({ scene: { isPaused: () => false } } as never, vi.fn(), { discover: h.discover });
    bare.update(h.context()); bare.clear(); expect(h.discover).toHaveBeenCalledTimes(1);
  });
  it('resets exposure while the document is hidden and prevents a delayed pending discovery after exit', () => {
    const h = harness(); h.frames(14); vi.stubGlobal('document', { visibilityState: 'hidden' }); h.frame();
    vi.stubGlobal('document', { visibilityState: 'visible' }); h.frames(14); expect(h.discover).not.toHaveBeenCalled();
    h.observer.update(h.context()); h.observer.clear(); h.events.emit('postrender'); expect(h.discover).not.toHaveBeenCalled();
  });
  it('uses camera origin and individual scroll factors for wide and taller viewports', () => {
    const h = harness({ ...landscape, theme: 'summer' }); h.camera.scrollX = -104; h.camera.scrollY = -45;
    for (const background of h.objects) Object.assign(background.bounds, { x: 0, y: 45, width: 584, height: 270, right: 584, bottom: 315 });
    h.animal('pond', -50, 180); h.frames(15, { viewport: { width: 584, height: 360 } });
    expect(h.discover).toHaveBeenCalledExactlyOnceWith('summer-pond-v1'); h.observer.clear();
  });
  it('snapshots structural viewport sizes whose width and height are inherited getters', () => {
    class Size { get width() { return 480; } get height() { return 270; } }
    const h = harness(); h.frames(15, { viewport: new Size() });
    expect(h.discover).toHaveBeenCalledExactlyOnceWith('spring-pasture-v1'); h.observer.clear();
  });
  it('keeps existing discoveries quiet and emits only one save-failure notice for a new card', () => {
    const h = harness(); h.discover.mockReturnValue({ added: false, saved: true }); h.frames(30);
    expect(h.discover).toHaveBeenCalledTimes(1); expect(h.notify).not.toHaveBeenCalled(); h.observer.clear();
    const failure = harness(); failure.discover.mockReturnValue({ added: true, saved: false }); failure.frames(30);
    expect(failure.notify).toHaveBeenCalledExactlyOnceWith('明信片暂未保存，本次仍可查看'); failure.observer.clear();
  });
});
