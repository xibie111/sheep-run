import { describe, expect, it } from 'vitest';
import { PLAYER, RUN, WORLD } from '../game/Constants';
import { normalJumpFlightSeconds, normalJumpRise, planStarRoute, STAR_ROUTE_RULES, type StarRouteContext, type StarRouteKind } from './StarRoutePlanner';

function clearContext(speed: number = RUN.initialSpeed, jumpImpulseMultiplier = 1): StarRouteContext {
  return { speed, spawnX: WORLD.width + 14, playerX: PLAYER.x + PLAYER.width / 2,
    jumpImpulseMultiplier, window: { openingSafe: true, patternEnded: true, nextObstacleInPx: 2000 },
    obstacles: [{ left: -530, right: -500, kind: 'Rock' }], pickups: [] };
}

describe('ordinary-jump star route placement', () => {
  it.each([RUN.initialSpeed, 270, RUN.maxSpeed])('fits every route into the touch entry at speed %s', speed => {
    for (const multiplier of [1, 1.15]) for (const kind of ['single', 'arc', 'high-low', 'landing'] as StarRouteKind[]) {
      const context = clearContext(speed, multiplier);
      const plan = planStarRoute(kind, context, [0, 1, 2]);
      expect(plan, `${kind}/${multiplier}`).not.toBeNull();
      expect(plan!.points.every(point => point.x <= context.spawnX && point.x > context.playerX)).toBe(true);
      expect(plan!.actionLeft).toBeGreaterThan(context.playerX + speed * STAR_ROUTE_RULES.touchReactionSeconds - .01);
      for (const [index, point] of plan!.points.entries()) {
        const seconds = plan!.sampleTimes[index]!;
        // The exact ordinary-jump body covers the star, including its existing
        // +/-4 px bob, with no high-jump impulse or enlarged pickup body.
        const bodyBottom = WORLD.groundY - normalJumpRise(seconds, multiplier);
        expect(point.y - STAR_ROUTE_RULES.bobAmplitude + 8).toBeGreaterThan(bodyBottom - STAR_ROUTE_RULES.bodyHeight);
        expect(point.y + STAR_ROUTE_RULES.bobAmplitude - 8).toBeLessThan(bodyBottom);
        if (plan!.jumpStartX !== null) expect(point.x).toBeCloseTo(plan!.jumpStartX + speed * seconds);
      }
    }
  });
  it('makes a three-star arc with a higher middle and one full normal jump', () => {
    const plan = planStarRoute('arc', clearContext(), [1, 2, 3])!;
    expect(plan.points).toHaveLength(3);
    expect(plan.points[1]!.y).toBeLessThan(plan.points[0]!.y);
    expect(plan.points[1]!.y).toBeLessThan(plan.points[2]!.y);
    expect(plan.sampleTimes[2]).toBeLessThan(normalJumpFlightSeconds());
    expect(plan.points.map(point => point.phase)).toEqual([1, 2, 3]);
  });
  it('offers one running-height and one ordinary-jump-height star', () => {
    const plan = planStarRoute('high-low', clearContext(), [])!;
    expect(plan.points).toHaveLength(2);
    expect(plan.points[0]!.y).toBe(WORLD.groundY - STAR_ROUTE_RULES.bodyHeight / 2);
    expect(plan.points[0]!.y - plan.points[1]!.y).toBeGreaterThan(80);
    expect(plan.points[0]!.x).toBeLessThan(plan.points[1]!.x);
  });
  it('places a landing star at normal running-body height after recovery', () => {
    const plan = planStarRoute('landing', clearContext(), [])!;
    expect(plan.jumpStartX).toBeNull();
    expect(plan.points[0]!.y).toBe(WORLD.groundY - STAR_ROUTE_RULES.bodyHeight / 2);
  });
  it('postpones during the opening protection and within a continuous group', () => {
    for (const window of [{ openingSafe: false, patternEnded: true, nextObstacleInPx: 2000 },
      { openingSafe: true, patternEnded: false, nextObstacleInPx: 2000 }]) {
      expect(planStarRoute('arc', { ...clearContext(), window }, [])).toBeNull();
    }
  });
  it('postpones before the preceding jump has recovered', () => {
    expect(planStarRoute('arc', { ...clearContext(), obstacles: [{ left: 300, right: 330, kind: 'Rock' }] }, [])).toBeNull();
  });
  it.each(['FlyingBird', 'HangingVine', 'HangingBranch'] as const)('does not encourage jumping after %s', kind => {
    expect(planStarRoute('arc', { ...clearContext(), obstacles: [{ left: -530, right: -500, kind }] }, [])).toBeNull();
  });
  it('reserves action recovery before the next real scheduled obstacle', () => {
    const context = clearContext(RUN.maxSpeed);
    expect(planStarRoute('arc', { ...context, window: { ...context.window, nextObstacleInPx: 0 } }, [])).toBeNull();
    const safe = planStarRoute('arc', context, [])!;
    expect(safe.actionRight).toBeLessThan(context.spawnX + 4 + context.window.nextObstacleInPx);
  });
  it('rejects existing hazards and overlapping pickup objects', () => {
    const context = clearContext();
    const plan = planStarRoute('arc', context, [])!;
    expect(planStarRoute('arc', { ...context, obstacles: [...context.obstacles, { left: 430, right: 460, kind: 'Rock' }] }, [])).toBeNull();
    const point = plan.points[1]!;
    expect(planStarRoute('arc', { ...context, pickups: [{ x: point.x - 8, y: point.y - 8, width: 16, height: 16 }] }, [])).toBeNull();
  });
  it('declines invalid physical inputs and too little touch-response space', () => {
    expect(planStarRoute('arc', { ...clearContext(), speed: Number.NaN }, [])).toBeNull();
    expect(planStarRoute('arc', { ...clearContext(), jumpImpulseMultiplier: Number.NaN }, [])).toBeNull();
    expect(planStarRoute('arc', { ...clearContext(), playerX: 450 }, [])).toBeNull();
  });
});
