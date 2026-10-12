import { describe, expect, it, vi } from 'vitest';
import { LandmarkView } from './LandmarkView';
import { LANDMARKS } from './landmarkCatalog';

function harness() {
  let listener: (() => void) | undefined, paused = false, active = true, visible = true;
  const image = { visible: true, active: true, setOrigin: vi.fn(), setScale: vi.fn(), setDepth: vi.fn(), setName: vi.fn(),
    setPosition: vi.fn(), setAlpha: vi.fn(), setTint: vi.fn(), destroy: vi.fn() };
  for (const key of ['setOrigin', 'setScale', 'setDepth', 'setName', 'setPosition', 'setAlpha', 'setTint'] as const) image[key].mockReturnValue(image);
  const on = vi.fn((_event, fn) => { listener = fn; }), off = vi.fn();
  const scene = { add: { image: vi.fn(() => image) }, game: { canvas: { getBoundingClientRect: () => ({ width: 896, height: 414 }) }, events: { on, off } },
    scene: { isPaused: () => paused, isActive: () => active, isVisible: () => visible } };
  const view = new LandmarkView(scene as never, LANDMARKS[0]);
  return { view, image, scene, render: () => listener!(), pause: (value: boolean) => { paused = value; },
    sleep: () => { active = false; }, hide: () => { visible = false; } };
}
describe('landmark render confirmation', () => {
  it('does not equate placing with seeing and excludes clipped or paused scene art', () => {
    const h = harness(), state = { x: 300, alpha: 1, tint: 0xffffff, viewport: { width: 480, height: 270 } };
    h.view.place(state); expect(h.view.consumeRendered()).toBe(false);
    h.render(); expect(h.view.consumeRendered()).toBe(true); expect(h.view.consumeRendered()).toBe(false);
    h.view.place({ ...state, x: 500 }); h.render(); expect(h.view.consumeRendered()).toBe(false);
    h.view.place(state); h.pause(true); h.render(); expect(h.view.consumeRendered()).toBe(false);
    h.pause(false); h.hide(); h.render(); expect(h.view.consumeRendered()).toBe(false);
    h.view.destroy(); h.view.destroy();
    expect(h.scene.game.events.off).toHaveBeenCalledTimes(1); expect(h.image.destroy).toHaveBeenCalledTimes(1);
  });
  it('is a single nonphysical image and remains above the road in the taller camera', () => {
    const h = harness(); h.view.place({ x: 280, alpha: 1, tint: 0x8899aa, viewport: { width: 480, height: 360 } });
    expect(h.scene.add.image).toHaveBeenCalledTimes(1);
    expect(h.image.setPosition).toHaveBeenCalledWith(280, 187); expect(h.image.setScale).toHaveBeenCalledWith(.5);
    expect(h.image.setDepth).toHaveBeenCalledWith(-9.8); h.render(); expect(h.view.consumeRendered()).toBe(true);
    h.sleep(); h.render(); expect(h.view.consumeRendered()).toBe(false); h.view.destroy();
  });
});
