import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_CHAPTERS, defaultDeliveryChapter, getDeliveryChapter } from './DeliveryChapters';
import { DeliveryRoute } from './DeliveryRoute';
import { LEGACY_DELIVERY_CHALLENGE_CHAPTER_IDS } from './DeliveryChallengeRun';
import { DifficultySystem } from '../systems/DifficultySystem';
import { SpawnSystem } from '../systems/SpawnSystemOwner';
import { INPUT, PLAYER, RUN, WORLD } from '../game/Constants';
import { ProgressionSystem } from '../systems/ProgressionSystem';

const authored = LEGACY_DELIVERY_CHALLENGE_CHAPTER_IDS.map(id => getDeliveryChapter(id)!);
const maxEffects = ProgressionSystem.effectsFor({ jump: 5, speed: 5, magnet: 5, dash: 5 });
describe('three resident delivery routes', () => {
  it('expands to five chapters without giving historical routes artificial ratings', () => {
    expect(DELIVERY_CHAPTERS).toHaveLength(11);
    for (const id of ['hill-goodnight-v1', 'dinner-for-you-v1']) expect(getDeliveryChapter(id)!.challenge).toBeUndefined();
    expect(new DeliveryRoute('future-route').chapter).toBe(defaultDeliveryChapter());
    expect(new DeliveryRoute('future-route').challenge).toBeUndefined();
    expect(new Set(DELIVERY_CHAPTERS.map(chapter => chapter.seed)).size).toBe(11);
  });
  it.each(authored)('$id ends by road distance in approximately 60–90 seconds and preserves the full arrival zone', chapter => {
    const route = new DeliveryRoute(chapter.id), difficulty = new DifficultySystem(); let elapsed = 0;
    while (route.state === 'running') { elapsed += 20; route.advance(20, difficulty.update(.02)); }
    expect(elapsed).toBeGreaterThanOrEqual(60000); expect(elapsed).toBeLessThanOrEqual(90000);
    expect(route.distance).toBe(chapter.length); expect(route.state).toBe('ending');
    expect(route.challenge!.snapshot().stars).toBe(0);
    const last = chapter.obstacles.at(-1)!;
    expect(chapter.length - last.at).toBeGreaterThanOrEqual(3200);
    // The last object's entire collision and visible extent leave before arrival begins.
    const arrival = chapter.phases.at(-1)!.start;
    expect(arrival - last.at - last.definition.width - 498).toBeGreaterThan(0);
    expect(chapter.destinationAt).toBeGreaterThan(arrival);
  });
  it.each(authored)('$id emits deterministic positions at varied frame rates/upgrades and applies every configured stage', chapter => {
    const simulate = (delta: number, factor: number) => {
      const route = new DeliveryRoute(chapter.id), difficulty = new DifficultySystem(factor), emitted = [];
      while (route.state === 'running') emitted.push(...route.advance(delta, difficulty.update(delta / 1000)));
      return emitted;
    };
    expect(simulate(10, 1)).toEqual(simulate(40, maxEffects.worldSpeedMultiplier));
    expect(simulate(16, 1)).toEqual(chapter.obstacles);
    const route = new DeliveryRoute(chapter.id);
    for (const phase of chapter.phases) { route.distance = phase.start; expect(route.phase).toEqual(phase); }
    expect(chapter.landscapes).toHaveLength(3); expect(chapter.weather).toBeTruthy();
  });
  it('the rain chapter starts cloudy and switches to purely visual rain at the authored forest boundary', () => {
    const route = new DeliveryRoute('rainy-umbrella-v1');
    expect(route.phase.weather ?? route.chapter.weather).toBe('clear');
    route.distance = 6799; expect(route.phase.weather ?? route.chapter.weather).toBe('clear');
    route.distance = 6800; expect(route.phase.weather ?? route.chapter.weather).toBe('rain');
    route.distance = 20000; expect(route.phase.weather ?? route.chapter.weather).toBe('rain');
  });
  it('the lighthouse chapter switches from dusk to starlight and legacy chapter phases keep their previous defaults', () => {
    const route = new DeliveryRoute('lighthouse-starlight-v1');
    expect(route.phase.weather ?? route.chapter.weather).toBe('clear');
    route.distance = 7500; expect(route.phase.weather ?? route.chapter.weather).toBe('starlight');
    for (const id of ['hill-goodnight-v1', 'dinner-for-you-v1']) {
      const old = new DeliveryRoute(id);
      expect(old.chapter.weather).toBeUndefined(); expect(old.phase.weather).toBeUndefined();
    }
  });
  it.each(authored)('$id has five ordinary stamps, one unique hidden keepsake, and no obstacle overlap at their approach', chapter => {
    const stamps = chapter.challenge!.stamps;
    expect(stamps.filter(stamp => stamp.kind === 'ordinary')).toHaveLength(5);
    expect(stamps.filter(stamp => stamp.kind === 'keepsake')).toHaveLength(1);
    expect(new Set(stamps.map(stamp => stamp.id)).size).toBe(6);
    for (const stamp of stamps) {
      expect(stamp.at).toBeGreaterThan(1000); expect(stamp.at).toBeLessThan(chapter.length - 2000);
      const clearance = Math.min(...chapter.obstacles.map(obstacle => Math.abs(stamp.at - obstacle.at)));
      expect(clearance).toBeGreaterThanOrEqual(450);
      expect(stamp.y).toBeGreaterThan(70); expect(stamp.y).toBeLessThan(WORLD.groundY);
      expect(stamp.key).toMatch(/^delivery-expansion-/);
    }
  });
  it.each(authored)('$id leaves reaction, jump recovery and down-swipe recovery time between fixed hazards', chapter => {
    const maxSpeed = RUN.maxSpeed * maxEffects.worldSpeedMultiplier;
    const upgradedJump = Math.min(-PLAYER.highJumpVelocityY * maxEffects.jumpImpulseMultiplier, PLAYER.maxHighJumpSpeed);
    const recovery = 2 * upgradedJump / PLAYER.gravityY + INPUT.crouchDurationMs / 1000 + RUN.minimumReactionTime;
    for (let i = 1; i < chapter.obstacles.length; i++) {
      const gap = chapter.obstacles[i].at - chapter.obstacles[i - 1].at;
      expect(gap).toBeGreaterThanOrEqual(1300);
      expect((gap - chapter.obstacles[i - 1].definition.width - (PLAYER.width - 12)) / maxSpeed).toBeGreaterThan(recovery);
    }
  });
  it.each(authored)('$id can clear every authored obstacle with unchanged jump/crouch bodies across actual upgrades', chapter => {
    for (const speedLevel of [0, 5]) for (const jumpLevel of [0, 5]) {
      const effects = ProgressionSystem.effectsFor({ jump: jumpLevel, speed: speedLevel, magnet: 0, dash: 0 });
      const route = new DeliveryRoute(chapter.id), difficulty = new DifficultySystem(effects.worldSpeedMultiplier);
      const encounters = new Map<number, number>();
      // Capture speed at body-center crossings in the actual distance/acceleration clock.
      while (route.state === 'running') {
        const speed = difficulty.update(.01); route.advance(10, speed);
        for (const obstacle of chapter.obstacles) if (!encounters.has(obstacle.at) &&
          route.distance >= 498 + obstacle.at + obstacle.definition.hitbox.offsetX + obstacle.definition.hitbox.width / 2 - (PLAYER.x + PLAYER.width / 2)) encounters.set(obstacle.at, speed);
      }
      for (const request of chapter.obstacles) {
        const obstacle = request.definition, speed = encounters.get(request.at)!;
        const halfCrossing = (obstacle.hitbox.width + PLAYER.width - 12) / (2 * speed);
        const obstacleTop = WORLD.groundY - obstacle.groundOffset - obstacle.height + obstacle.hitbox.offsetY;
        if (obstacle.kind === 'HangingBranch') {
          expect(2 * halfCrossing).toBeLessThan(INPUT.crouchDurationMs / 1000);
          expect(WORLD.groundY - PLAYER.crouchBodyHeight).toBeGreaterThanOrEqual(obstacleTop + obstacle.hitbox.height);
        } else {
          const high = obstacle.kind === 'TallStack';
          const impulse = high ? Math.min(-PLAYER.highJumpVelocityY * effects.jumpImpulseMultiplier, PLAYER.maxHighJumpSpeed) : -PLAYER.jumpVelocityY * effects.jumpImpulseMultiplier;
          const apex = impulse / PLAYER.gravityY;
          // Center the physical jump arc on the full horizontal collision interval.
          for (let offset = -halfCrossing; offset <= halfCrossing; offset += .002) {
            const t = apex + offset, foot = WORLD.groundY - impulse * t + PLAYER.gravityY * t * t / 2;
            expect(foot, `${chapter.id}/${obstacle.kind}/speed${speedLevel}/jump${jumpLevel}`).toBeLessThan(obstacleTop);
          }
        }
      }
    }
  });
  it.each(authored)('$id hidden stamp is high-jump reachable, while ordinary stamps can be collected on the existing ground', chapter => {
    const hidden = chapter.challenge!.stamps.find(stamp => stamp.kind === 'keepsake')!;
    const ordinary = chapter.challenge!.stamps.filter(stamp => stamp.kind === 'ordinary');
    const bodyHeight = PLAYER.height - 8, highApex = PLAYER.highJumpVelocityY ** 2 / (2 * PLAYER.gravityY);
    const normalApex = PLAYER.jumpVelocityY ** 2 / (2 * PLAYER.gravityY);
    // Runtime renderer uses a 20px ordinary stamp and 22px keepsake; base physics are unchanged.
    expect(WORLD.groundY - highApex - bodyHeight).toBeLessThan(hidden.y + 11);
    expect(WORLD.groundY - highApex).toBeGreaterThan(hidden.y - 11);
    expect(WORLD.groundY - normalApex - bodyHeight).toBeGreaterThan(hidden.y + 11);
    for (const stamp of ordinary) expect(stamp.y + 10).toBeGreaterThan(WORLD.groundY - bodyHeight);
  });
  it.each(authored)('$id failure/retry reset collections, success settles once, pause does not use wall clock', chapter => {
    const failed = new DeliveryRoute(chapter.id), stamp = chapter.challenge!.stamps[0];
    failed.challenge!.collect(stamp.id); failed.fail(); const distance = failed.distance;
    expect(failed.challenge!.snapshot()).toMatchObject({ stars: 0, successful: false, ordinaryCollected: 1 });
    failed.advance(40, 390); expect(failed.distance).toBe(distance);
    const retry = new DeliveryRoute(chapter.id); expect(retry.challenge!.snapshot().ordinaryCollected).toBe(0);
    for (const stamp of chapter.challenge!.stamps) retry.challenge!.collect(stamp.id);
    retry.distance = chapter.length - 1; retry.advance(20, 390);
    vi.useFakeTimers(); try { vi.advanceTimersByTime(900000); expect(retry.endingMs).toBe(0); } finally { vi.useRealTimers(); }
    expect(retry.advance(0, 390)).toEqual([]); expect(retry.challenge!.snapshot().stars).toBe(0);
    let completed = 0, state = retry.state;
    for (let i = 0; i < 300; i++) { retry.advance(20, 0); if (state !== 'complete' && retry.state === 'complete') completed++; state = retry.state; }
    expect(completed).toBe(1); expect(retry.challenge!.snapshot()).toMatchObject({ stars: 3, successful: true });
    retry.fail(); expect(retry.state).toBe('complete');
  });
  it('new routes do not consume endless-mode seeds, star streams or Math.random', () => {
    const expected = new SpawnSystem(184), actual = new SpawnSystem(184), random = vi.spyOn(Math, 'random');
    try {
      const routes = authored.map(chapter => new DeliveryRoute(chapter.id));
      for (let i = 0; i < 2500; i++) { for (const route of routes) route.advance(20, 390); expect(actual.update(.02, 390)).toEqual(expected.update(.02, 390)); }
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });
});
