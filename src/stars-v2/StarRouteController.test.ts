import { describe, expect, it, vi } from 'vitest';
import { PLAYER, POOL, RUN, WORLD } from '../game/Constants';
import { SpawnSystem, type SpawnRequest } from '../systems/SpawnSystemOwner';
import { StarRouteController } from './StarRouteController';
import { STAR_ROUTE_RULES, type StarRouteContext, type StarRoutePlan } from './StarRoutePlanner';

const token = { type: 'star', y: 120, phase: 1 } as const;
const context: StarRouteContext = { speed: RUN.initialSpeed, spawnX: WORLD.width + 14, playerX: PLAYER.x + PLAYER.width / 2,
  jumpImpulseMultiplier: 1, window: { openingSafe: true, patternEnded: true, nextObstacleInPx: 2000 },
  obstacles: [{ left: -530, right: -500, kind: 'Rock' }], pickups: [] };
function fixture(seed = 10) {
  const members: object[][] = [];
  const available = vi.fn(() => POOL.stars as number);
  const spawn = vi.fn((plan: StarRoutePlan) => {
    const stars = plan.points.map(() => ({})); members.push(stars); return stars;
  });
  const routes = new StarRouteController({ available, spawn }, seed);
  return { routes, members, available, spawn };
}
function nextGroup(f: ReturnType<typeof fixture>): object[] {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    while (f.routes.budget.pending < 3) f.routes.enqueue(token);
    const plan = f.routes.update(context)!;
    const members = f.members.at(-1)!;
    if (plan.kind !== 'single') return members;
    for (const member of members) f.routes.collect(member);
  }
  throw new Error('route rotation did not contain a group');
}

describe('conserved star route budgets and lifecycle', () => {
  it('never creates stars without legacy requests and spends exactly each group size', () => {
    const f = fixture();
    expect(f.routes.update(context)).toBeNull();
    for (let index = 0; index < 20; index += 1) {
      f.routes.enqueue(token);
      const before = f.routes.budget;
      const plan = f.routes.update(context);
      if (plan) expect(before.pending - f.routes.budget.pending).toBe(plan.points.length);
      const budget = f.routes.budget;
      expect(budget.received).toBe(budget.spawned + budget.pending + budget.discarded);
      expect(budget.spawned).toBeLessThanOrEqual(index + 1);
    }
  });
  it('does not consume a budget or partially activate a group when the pool is short', () => {
    const f = fixture();
    f.available.mockReturnValue(0); f.routes.enqueue(token);
    expect(f.routes.update(context)).toBeNull(); expect(f.spawn).not.toHaveBeenCalled();
    expect(f.routes.budget.pending).toBe(1);
    f.available.mockReturnValue(3); expect(f.routes.update(context)).not.toBeNull();
    for (let attempt = 0; attempt < 4 && f.routes.pendingKind !== 'arc'; attempt += 1) {
      while (f.routes.budget.pending < 3) f.routes.enqueue(token);
      f.routes.update(context);
    }
    expect(f.routes.pendingKind).toBe('arc');
    while (f.routes.budget.pending < 3) f.routes.enqueue(token);
    f.available.mockReturnValue(2); const before = f.routes.budget;
    f.spawn.mockClear();
    expect(f.routes.update(context)).toBeNull(); expect(f.spawn).not.toHaveBeenCalled();
    expect(f.routes.budget).toEqual(before);
  });
  it('postpones until a safe gap and bounds delayed credits to avoid catch-up floods', () => {
    const f = fixture();
    for (let index = 0; index < 100; index += 1) f.routes.enqueue(token);
    expect(f.routes.budget.pending).toBe(STAR_ROUTE_RULES.bankLimit);
    expect(f.routes.budget.discarded).toBe(100 - STAR_ROUTE_RULES.bankLimit);
    expect(f.routes.update({ ...context, window: { ...context.window, patternEnded: false } })).toBeNull();
    expect(f.routes.budget.spawned).toBe(0);
    expect(f.routes.update(context)).not.toBeNull();
  });
  it('does not change state while paused with no effective update', () => {
    const f = fixture(); f.routes.enqueue(token);
    const before = f.routes.budget;
    // Paused scenes do not call update/enqueue; no wall-clock deadline exists.
    vi.useFakeTimers(); vi.advanceTimersByTime(120_000); vi.useRealTimers();
    expect(f.routes.budget).toEqual(before);
  });
  it('marks a group complete only after every actual accepted unique pickup', () => {
    const f = fixture(); const stars = nextGroup(f);
    for (let index = 0; index < stars.length; index += 1) {
      const event = f.routes.collect(stars[index]!)!;
      expect(event.collected).toBe(index + 1);
      expect(event.completed).toBe(index === stars.length - 1);
      expect(f.routes.collect(stars[index]!)).toBeNull();
    }
  });
  it('invalidates missed groups without pretending that generated stars were collected', () => {
    const f = fixture(); const stars = nextGroup(f);
    f.routes.recycle(stars[0]!);
    expect(stars.map(star => f.routes.collect(star))).toEqual(stars.map(() => null));
  });
  it('clears memberships and budgets on exit and isolates a new run', () => {
    const f = fixture(); const stars = nextGroup(f); f.routes.clear(); f.routes.enqueue(token);
    expect(f.routes.budget.pending).toBe(0);
    expect(f.routes.update(context)).toBeNull(); expect(f.routes.collect(stars[0]!)).toBeNull();
    const fresh = fixture(); fresh.routes.enqueue(token);
    expect(fresh.routes.update(context)).not.toBeNull();
    expect(fresh.routes.collect(stars[0]!)).toBeNull();
  });
  it('uses an independent reproducible kind stream without Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('shared RNG called'); });
    const sequence = (seed: number) => {
      const f = fixture(seed); const plans: string[] = [];
      for (let index = 0; index < 12; index += 1) {
        while (f.routes.budget.pending < 3) f.routes.enqueue(token);
        plans.push(f.routes.update(context)!.kind);
      }
      return plans;
    };
    expect(sequence(20)).toEqual(sequence(20));
    expect(new Set(sequence(20))).toEqual(new Set(['single', 'arc', 'high-low', 'landing']));
    random.mockRestore();
  });
});

describe('original spawn streams remain unchanged', () => {
  it('keeps every original request, obstacle phase, group and power-up schedule under route observations', () => {
    for (const seed of [1, 42, 876]) {
      const observed = new SpawnSystem(seed); const untouched = new SpawnSystem(seed);
      const f = fixture(seed);
      for (let frame = 0; frame < 3000; frame += 1) {
        const speed = Math.min(RUN.maxSpeed, RUN.initialSpeed + frame * .04 * RUN.speedAcceleration);
        const actual = observed.update(.04, speed);
        expect(actual).toEqual(untouched.update(.04, speed));
        for (const request of actual) if (request.type === 'star') f.routes.enqueue(request);
        observed.starRouteWindow(speed); observed.starRouteWindow(speed);
        f.routes.update({ ...context, speed, window: observed.starRouteWindow(speed) });
      }
    }
  });
  it('keeps natural seeded long-run routes within three pooled instances and the original star budget', () => {
    type PooledStar = { active: boolean; x: number };
    for (const speed of [RUN.initialSpeed, 270, RUN.maxSpeed]) {
      const spawn = new SpawnSystem(876); const stars: PooledStar[] = [];
      const obstacles: Array<{ left: number; right: number; kind: Extract<SpawnRequest, { type: 'obstacle' }>['definition']['kind'] }> = [];
      const kinds = new Set<string>();
      let peak = 0;
      const routes = new StarRouteController({
        available: () => POOL.stars - stars.filter(star => star.active).length,
        spawn: plan => plan.points.map(point => {
          let star = stars.find(item => !item.active);
          if (!star) { star = { active: false, x: 0 }; stars.push(star); }
          star.active = true; star.x = point.x; return star;
        }),
      }, 50);
      for (let frame = 0; frame < 15_000; frame += 1) {
        for (const obstacle of obstacles) { obstacle.left -= speed * .04; obstacle.right -= speed * .04; }
        while (obstacles[0] && obstacles[0].right < -600) obstacles.shift();
        for (const star of stars) if (star.active) {
          star.x -= speed * .04;
          if (star.x < PLAYER.x - 4) { routes.recycle(star); star.active = false; }
        }
        for (const request of spawn.update(.04, speed)) {
          if (request.type === 'star') routes.enqueue(request);
          else if (request.type === 'obstacle') obstacles.push({ left: WORLD.width + 18,
            right: WORLD.width + 18 + request.definition.width, kind: request.definition.kind });
        }
        const plan = routes.update({ ...context, speed, obstacles, window: spawn.starRouteWindow(speed) });
        if (plan) kinds.add(plan.kind);
        peak = Math.max(peak, stars.filter(star => star.active).length);
      }
      expect(peak).toBeLessThanOrEqual(POOL.stars);
      expect(stars).toHaveLength(POOL.stars);
      expect(kinds).toEqual(new Set(['single', 'arc', 'high-low', 'landing']));
      expect(routes.budget.spawned).toBeLessThanOrEqual(routes.budget.received);
      expect(routes.budget.spawned, JSON.stringify({ speed, budget: routes.budget })).toBeGreaterThan(routes.budget.received * .9);
      expect(routes.budget.pending).toBeLessThanOrEqual(STAR_ROUTE_RULES.bankLimit);
    }
  });
});
