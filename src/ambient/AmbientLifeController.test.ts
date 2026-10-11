import { describe, expect, it, vi } from 'vitest';
vi.mock('./animalAssets', () => ({ ANIMAL_TEXTURE: 'ambient-life-atlas' }));
import { AmbientLifeController } from './AmbientLifeController';
import type { LandscapeState } from './AnimalRules';

function harness() {
  let paused = false, notice = false;
  const objects: Array<{ x: number; y: number; frame: string; alpha: number; name: string; destroyed: boolean }> = [];
  const scene = {
    scene: { isPaused: () => paused },
    game: { canvas: { parentElement: { querySelectorAll: () => [{ style: { display: notice ? 'block' : 'none' } }] } } },
    physics: { add: { existing() { throw new Error('Ambient life must not allocate a body'); } } },
    add: { image: (x: number, y: number, _texture: string, frame: string) => {
      const image = { x, y, frame, alpha: 1, name: '', destroyed: false,
        setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; }, setTint() { return this; }, setFlipX() { return this; },
        setName(n: string) { this.name = n; return this; }, setFrame(f: string) { this.frame = f; return this; },
        setPosition(px: number, py: number) { this.x = px; this.y = py; return this; }, setAlpha(a: number) { this.alpha = a; return this; },
        destroy() { this.destroyed = true; },
      }; objects.push(image); return image;
    } },
  };
  const landscape: LandscapeState = { theme: 'spring', weather: 'sunny', weatherAlpha: 0, dayPhase: 'afternoon', landTint: 0xffffff, nearOffset: 845, nearRatio: .24, nearRepeatWidth: 960 };
  const context = (nowMs: number) => ({ nowMs, speed: 190, viewport: { width: 480, height: 270 }, landscape, obstacles: [] });
  return { scene, objects, context, pause: (v: boolean) => { paused = v; }, notice: (v: boolean) => { notice = v; } };
}
describe('ambient life lifecycle', () => {
  it('places the pond before an event, adds ordinary images only, and freezes all state when paused', () => {
    const h = harness(), c = new AmbientLifeController(h.scene as never, false, 41);
    c.update(h.context(0)); expect(c.snapshot()).toMatchObject({ kind: null, ponds: 1, startedCount: 0 });
    c.update(h.context(20_000)); expect(c.snapshot()).toMatchObject({ state: 'playing', startedCount: 1 });
    c.update(h.context(21_000));
    const before = structuredClone(h.objects.map(o => ({ x: o.x, y: o.y, frame: o.frame, alpha: o.alpha }))), state = c.snapshot();
    h.pause(true); c.update({ ...h.context(999_999), landscape: { ...h.context(0).landscape, nearOffset: 999 } });
    expect(c.snapshot()).toEqual(state);
    expect(h.objects.map(o => ({ x: o.x, y: o.y, frame: o.frame, alpha: o.alpha }))).toEqual(before);
    h.pause(false); c.update(h.context(21_000)); expect(c.snapshot().elapsedMs).toBe(1000);
    expect(h.objects.every(o => !('body' in o) && !('input' in o))).toBe(true);
    c.clear(); c.clear(); expect(h.objects.every(o => o.destroyed)).toBe(true);
    expect(c.snapshot()).toMatchObject({ state: 'stopped', objects: 0, kind: null });
    c.update(h.context(999_999)); expect(c.snapshot().objects).toBe(0);
  });
  it('defers for notices, bell pickup and companion transitions but allows settled companionship', () => {
    const h = harness(), c = new AmbientLifeController(h.scene as never, false, 41);
    h.notice(true); c.update(h.context(20_000)); expect(c.snapshot().kind).toBeNull();
    h.notice(false); c.update({ ...h.context(20_200), companionState: 'bell' }); expect(c.snapshot().kind).toBeNull();
    c.update({ ...h.context(20_400), companionState: 'companion' }); expect(c.snapshot().kind).toBeNull();
    c.update({ ...h.context(21_401), companionState: 'companion' }); expect(c.snapshot().kind).not.toBeNull();
    c.clear();
  });
  it('ends a season-invalid event and starts its cooldown once; a new run starts clean', () => {
    const h = harness(), c = new AmbientLifeController(h.scene as never, false, 41);
    c.update(h.context(20_000));
    c.update({ ...h.context(21_000), landscape: { ...h.context(0).landscape, theme: 'winter' } });
    c.update({ ...h.context(21_250), landscape: { ...h.context(0).landscape, theme: 'winter' } });
    expect(c.snapshot()).toMatchObject({ kind: null, state: 'waiting', ponds: 0 });
    const deadline = c.snapshot().nextEligibleAtMs;
    expect(deadline).toBeGreaterThanOrEqual(51_250); expect(deadline).toBeLessThan(66_250);
    c.update(h.context(21_250)); expect(c.snapshot().nextEligibleAtMs).toBe(deadline);
    c.clear(); const restarted = new AmbientLifeController(h.scene as never, false, 41);
    restarted.update(h.context(0)); expect(restarted.snapshot()).toMatchObject({ startedCount: 0, kind: null, nextEligibleAtMs: 20_000 }); restarted.clear();
  });
  it('lets a started background performance finish when a later non-overlapping notice appears', () => {
    const h = harness(), c = new AmbientLifeController(h.scene as never, false, 41);
    c.update(h.context(20_000)); h.notice(true); c.update(h.context(22_000));
    expect(c.snapshot()).toMatchObject({ state: 'playing', startedCount: 1 });
    c.update(h.context(28_000)); expect(c.snapshot()).toMatchObject({ state: 'waiting', kind: null }); c.clear();
  });
  it('tracks the painted landmark instead of the screen and recycles after leaving the viewport', () => {
    const h = harness(), c = new AmbientLifeController(h.scene as never, false, 41);
    c.update(h.context(20_000)); c.update(h.context(22_000));
    const positions = h.objects.filter(o => !o.destroyed).map(o => o.x);
    c.update({ ...h.context(22_000), landscape: { ...h.context(0).landscape, nearOffset: 850 } });
    expect(h.objects.filter(o => !o.destroyed).map(o => o.x)).toEqual(positions.map(x => x - 5));
    c.update({ ...h.context(22_200), landscape: { ...h.context(0).landscape, nearOffset: 1450 } });
    expect(c.snapshot()).toMatchObject({ state: 'waiting', kind: null }); c.clear();
  });
});
