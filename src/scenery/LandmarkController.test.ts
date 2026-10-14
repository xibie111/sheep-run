import { describe, expect, it, vi } from 'vitest';
import { LandmarkController, type LandmarkUpdateContext } from './LandmarkController';
import { LANDMARK_RULES, LANDMARKS } from './landmarkCatalog';
import type { LandmarkPlacement, LandmarkViewPort } from './LandmarkView';
import { adaptiveViewportSize } from '../game/Viewport';

function harness(reducedMotion = false) {
  let paused = false;
  const views: Array<LandmarkViewPort & { rendered: boolean; placement?: LandmarkPlacement; destroyed: boolean }> = [];
  const notify = vi.fn();
  const scene = { scene: { isPaused: () => paused } };
  const controller = new LandmarkController(scene as never, { reducedMotion, onEncounter: notify, createView: () => {
    const view = { rendered: false, destroyed: false, placement: undefined as LandmarkPlacement | undefined,
      place(state: LandmarkPlacement) { this.placement = state; },
      consumeRendered() { const result = this.rendered; this.rendered = false; return result; },
      destroy() { this.destroyed = true; } };
    views.push(view); return view;
  } });
  const context = (distance: number, patch: Partial<LandmarkUpdateContext> = {}): LandmarkUpdateContext => ({ distance, deltaMs: 100,
    viewport: { width: 480, height: 270 }, blocked: false,
    landscape: { theme: 'spring', weather: 'sunny', weatherAlpha: 0, dayPhase: 'morning', landTint: 0xffffff,
      nearOffset: distance * .24, nearRatio: .24, nearRepeatWidth: 1134 }, ...patch });
  return { controller, context, views, notify, pause: (value: boolean) => { paused = value; },
    render: () => { for (const view of views) if (!view.destroyed) view.rendered = true; } };
}

describe('route landmarks', () => {
  it('starts by real travelled distance, defers congestion, and never creates an opening pile', () => {
    const h = harness();
    h.controller.update(h.context(0)); h.controller.update(h.context(2399)); expect(h.views).toHaveLength(0);
    h.controller.update(h.context(2600, { blocked: true })); expect(h.views).toHaveLength(0);
    h.controller.update(h.context(2601)); expect(h.views).toHaveLength(1);
    expect(h.controller.snapshot()).toMatchObject({ id: 'windmill-meadow', startedCount: 1, encounters: [] });
    h.controller.update(h.context(20_000)); expect(h.views).toHaveLength(1);
    expect(h.controller.snapshot().id).toBeNull();
    h.controller.update(h.context(20_001)); expect(h.views).toHaveLength(1);
    h.controller.update(h.context(21_200)); expect(h.views).toHaveLength(2);
    expect(h.controller.snapshot().id).toBe('old-barn');
  });
  it('records once only after actual renders inside the effective viewport', () => {
    const h = harness(); h.controller.update(h.context(2400));
    for (let d = 2401; d <= 2405; d++) { h.render(); h.controller.update(h.context(d)); }
    expect(h.notify).not.toHaveBeenCalled(); // generated, rendered, but still offscreen
    h.controller.update(h.context(3500));
    for (let i = 0; i < 5; i++) h.controller.update(h.context(3500));
    expect(h.notify).not.toHaveBeenCalled(); // a placement is not a render
    for (let i = 0; i < 4; i++) { h.render(); h.controller.update(h.context(3500)); }
    expect(h.notify).toHaveBeenCalledExactlyOnceWith({ id: 'windmill-meadow', title: '风车草地', distance: 3500, theme: 'spring' });
    for (let i = 0; i < 10; i++) { h.render(); h.controller.update(h.context(3500)); }
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.controller.snapshot().encounters).toHaveLength(1);
  });
  it('moves the windmill with the near layer and ignores unrelated far offset changes', () => {
    const h = harness(); h.controller.update(h.context(2400));
    const x = h.controller.snapshot().x!; h.controller.update(h.context(2500));
    expect(h.controller.snapshot().x).toBeCloseTo(x - 24);
    const c = h.context(2600); c.landscape.farOffset = 400; c.landscape.farRatio = .05;
    h.controller.update(c); expect(h.controller.snapshot().x).toBeCloseTo(x - 48);
    c.landscape.farOffset = 50_000;
    h.controller.update(c); expect(h.controller.snapshot().x).toBeCloseTo(x - 48);
    expect(LANDMARKS[0].layer).toBe('near');
  });
  it('crosses the painted near texture cycle without moving the windmill backwards or repeating it', () => {
    const h = harness(), period = 1134;
    const beforeDistance = period / .24 - 50, afterDistance = beforeDistance + 100;
    h.controller.update(h.context(beforeDistance));
    const before = h.controller.snapshot();
    h.controller.update(h.context(afterDistance));
    const after = h.controller.snapshot();
    expect(afterDistance * .24 % period).toBeLessThan(beforeDistance * .24 % period);
    expect(after.x).toBeCloseTo(before.x! - 24);
    expect(after.id).toBe('windmill-meadow');
    expect(after.startedCount).toBe(1);
    expect(h.views.filter(view => !view.destroyed)).toHaveLength(1);
  });
  it('follows the near layer one-for-one without repeating a landmark in a wide viewport', () => {
    const h = harness(); h.controller.update(h.context(2400)); h.controller.update(h.context(12_000));
    h.controller.update(h.context(13_200, { viewport: { width: 960, height: 270 } }));
    const x = h.controller.snapshot().x!; h.controller.update(h.context(13_300, { viewport: { width: 960, height: 270 } }));
    expect(h.controller.snapshot().x).toBeCloseTo(x - 24); expect(h.views).toHaveLength(2);
    expect(h.views.filter(view => !view.destroyed)).toHaveLength(1);
  });
  it('pauses without moving or exposing, resumes, then recycles and clears idempotently', () => {
    const h = harness(); h.controller.update(h.context(2400)); h.render();
    const before = h.controller.snapshot(); h.pause(true); h.controller.update(h.context(8000));
    expect(h.controller.snapshot()).toEqual(before); expect(h.notify).not.toHaveBeenCalled();
    h.pause(false); h.controller.update(h.context(2500)); expect(h.controller.snapshot().x).toBeCloseTo(before.x! - 24);
    const resumed = h.controller.snapshot(); h.controller.update(h.context(8000, { paused: true }));
    expect(h.controller.snapshot()).toEqual(resumed);
    h.controller.update(h.context(6200)); expect(h.views[0]!.destroyed).toBe(true);
    h.controller.clear(); h.controller.clear(); h.controller.update(h.context(20_000));
    expect(h.controller.snapshot()).toMatchObject({ id: null, stopped: true, startedCount: 1 });
  });
  it('shows reduced-motion landmarks inside the viewport and ends a static visit', () => {
    const h = harness(true); h.controller.update(h.context(2400));
    expect(h.controller.snapshot().x).toBe(312);
    for (let i = 0; i < 4; i++) { h.render(); h.controller.update(h.context(2400)); }
    expect(h.notify).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 80; i++) { h.render(); h.controller.update(h.context(2400)); }
    expect(h.views[0]!.destroyed).toBe(true); expect(h.controller.busy).toBe(false);
  });
  it('holds the reduced-motion windmill while world and far phases advance, and does not age it during pause', () => {
    const h = harness(true); h.controller.update(h.context(2400));
    const initialX = h.controller.snapshot().x;
    const c = h.context(2500); c.landscape.farOffset = 25_000;
    h.controller.update(c);
    expect(h.controller.snapshot().x).toBe(initialX);
    const paused = h.controller.snapshot(); h.pause(true);
    h.controller.update(h.context(2600)); expect(h.controller.snapshot()).toEqual(paused);
    h.pause(false); h.controller.update(h.context(2600));
    expect(h.controller.snapshot().x).toBe(initialX);
    expect(h.controller.snapshot().ageMs).toBe(paused.ageMs + 100);
  });
  it('keeps each silhouette aspect and ground anchor at narrow, wide and tall viewports', () => {
    for (const [width, height] of [[480, 270], [896, 414], [844, 390], [800, 600]]) {
      const h = harness(true), size = adaptiveViewportSize(width!, height!);
      h.controller.update(h.context(2400, { viewport: size }));
      expect(h.views).toHaveLength(1); expect(h.views[0]!.placement!.viewport).toEqual(size);
      const landmark = LANDMARKS[0]; expect(landmark.bottom).toBeLessThan(207);
      expect(landmark.bottom - landmark.height).toBeGreaterThan(70);
    }
    expect(LANDMARKS.map(item => [item.width, item.height])).toEqual([[62, 75.5], [90, 45], [110, 30]]);
  });
  it('keeps the route pending on invalid input, and never touches the random stream', () => {
    const random = vi.spyOn(Math, 'random'), h = harness();
    h.controller.update(h.context(Number.NaN)); h.controller.update(h.context(2400, { deltaMs: -1 }));
    expect(h.views).toHaveLength(0); h.controller.update(h.context(2400));
    const before = h.controller.snapshot(); h.controller.update(h.context(2200));
    expect(h.controller.snapshot()).toEqual(before); expect(random).not.toHaveBeenCalled(); random.mockRestore();
    expect(LANDMARK_RULES.minimumGapDistance).toBe(1200);
  });
});
