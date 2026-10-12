import { describe, expect, it } from 'vitest';
import { adaptiveViewportSize, runViewportOrigin } from '../game/Viewport';
import { runHudLayout } from '../ui/RunHudLayout';
import type { ArtRect } from '../ui/MenuArtLayout';
import { TallStack } from '../game/ObstacleDefinitions';
import { WORLD } from '../game/Constants';
import { RunGoal } from './RunGoal';
import { runGoalLayout, runGoalPresentation } from './RunGoalView';

const overlaps = (a: ArtRect, b: ArtRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const safe = { left: 0, right: 0, top: 0, bottom: 0 };

describe('generated goal strip placement and readable states', () => {
  it.each([[480, 270], [896, 414], [844, 390], [800, 600], [480, 540]])(
    'keeps the 116x22 parchment below best without covering HUD or road at %sx%s', (width, height) => {
      const viewport = adaptiveViewportSize(width, height), hud = runHudLayout(viewport, safe), box = runGoalLayout(viewport, safe);
      expect(box.width).toBe(116); expect(box.height).toBe(22);
      expect(box.x).toBe(hud.best.x); expect(box.y).toBe(hud.best.y + hud.best.height + 4);
      for (const slot of Object.values(hud)) expect(overlaps(box, slot)).toBe(false);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThan(viewport.height);
      const tallestObstacleTop = WORLD.groundY + runViewportOrigin(viewport).y - TallStack.height * (TallStack.visualScale ?? 1);
      expect(box.y + box.height).toBeLessThan(tallestObstacleTop);
    });
  it('moves with asymmetric safe areas without touching adjacent central HUD', () => {
    const insets = { left: 72, right: 80, top: 12, bottom: 0 }, size = { width: 480, height: 270 };
    const hud = runHudLayout(size, insets), box = runGoalLayout(size, insets);
    expect(box.x + box.width).toBe(size.width - insets.right - 8);
    expect(box.height / box.width).toBeCloseTo(22 / 116);
    for (const slot of Object.values(hud)) expect(overlaps(box, slot)).toBe(false);
  });
  it.each([0, .5, .9])('shows the complete selected objective briefly, then compact real progress for goal draw %s', random => {
    const goal = new RunGoal({ random: () => random }), box = runGoalLayout({ width: 480, height: 270 }, safe);
    const intro = runGoalPresentation(goal.snapshot(), 0, null, box);
    expect(intro).toMatchObject({ mode: 'intro', message: goal.snapshot().label, stamp: null });
    const active = runGoalPresentation(goal.snapshot(), 2200, null, box);
    expect(active.mode).toBe('active'); expect(active.message).toContain('0/'); expect(active.stamp).toBeNull();
  });
  it('shows the completion announcement once then retains the stamp and completed count', () => {
    const goal = new RunGoal({ random: () => 0 }); for (let i = 0; i < 6; i++) goal.star(i);
    const box = runGoalLayout({ width: 480, height: 270 }, safe);
    const complete = runGoalPresentation(goal.snapshot(), 3000, 3000, box);
    expect(complete).toMatchObject({ mode: 'complete', message: '小目标完成' });
    const settled = runGoalPresentation(goal.snapshot(), 5000, 3000, box);
    expect(settled.message).toBe('收星 6/6'); expect(settled.stamp).toEqual(complete.stamp);
  });
  it('contains the stamp on the left, with a separate unobstructed text area', () => {
    const goal = new RunGoal({ random: () => .9 }); goal.update(30);
    const box = runGoalLayout({ width: 480, height: 270 }, safe), presentation = runGoalPresentation(goal.snapshot(), 30000, 30000, box);
    const stamp = presentation.stamp!;
    expect(stamp.x).toBe(box.x + 4); expect(stamp.width).toBe(18); expect(stamp.height).toBe(18);
    expect(stamp.y).toBeGreaterThanOrEqual(box.y); expect(stamp.y + stamp.height).toBeLessThanOrEqual(box.y + box.height);
    expect(overlaps(stamp, presentation.words)).toBe(false);
    expect(presentation.words.x + presentation.words.width).toBeLessThanOrEqual(box.x + box.width);
  });
  it('floors time only for presentation while preserving the measured objective snapshot', () => {
    const goal = new RunGoal({ random: () => .9 }); goal.update(10.75);
    const presentation = runGoalPresentation(goal.snapshot(), 3000, null, runGoalLayout({ width: 480, height: 270 }, safe));
    expect(presentation.message).toBe('奔跑 10/30秒'); expect(goal.snapshot().progress).toBe(10.75);
  });
});
