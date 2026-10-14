import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_CHAPTERS, getDeliveryChapter } from './DeliveryChapters';
import { DeliveryRoute } from './DeliveryRoute';
import { RESIDENT_ROUTES, RESIDENT_ROUTE_TEXT } from './ResidentRoutes';
import { RESIDENTS, RESIDENT_NEW_CHAPTER_IDS } from '../residents/ResidentCatalog';
import { RESIDENT_ASSETS, RESIDENT_NPC_ART } from '../residents/residentAssets';
import { DELIVERY_EXPANSION_ASSETS } from './DeliveryExpansionAssets';
import { INPUT, PLAYER, RUN, WORLD } from '../game/Constants';
import { DifficultySystem } from '../systems/DifficultySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { SpawnSystem } from '../systems/SpawnSystemOwner';

const historical = [
  ['hill-goodnight-v1', 'cbce8da2ca271f8b88d5fc31ba7a638b5d512ebfc465152111e915099ef414e7'],
  ['dinner-for-you-v1', '89f7e4dd6fb92cfae677fed9075d834dbc38f1f65c1fe527ae1dad2540024ad6'],
  ['windmill-invitation-v1', 'bc0bc6b607a007e4e0d999805e46b85d569e88f32973a9829f13c1cb08e53cd3'],
  ['rainy-umbrella-v1', 'f6598827b2e0c35a195cd9f2b34337cbf68f4e16d21ef3b1bacfc93143303f8a'],
  ['lighthouse-starlight-v1', 'b4680034d2c090e3c22ec256cbaea04fd37492f7d166749446e7e67ffa82c979'],
] as const;

describe('resident story route content', () => {
  it.each(historical)('preserves every pre-existing authored field of %s', (id, digest) => {
    // Recorded before adding resident routes: includes text, hazards, stamps and render tweaks.
    expect(createHash('sha256').update(JSON.stringify(getDeliveryChapter(id))).digest('hex')).toBe(digest);
  });
  it('adds exactly two independent routes for each resident with the requested chapter/postcard titles', () => {
    expect(RESIDENT_ROUTES.map(route => route.id)).toEqual(RESIDENT_NEW_CHAPTER_IDS);
    expect(DELIVERY_CHAPTERS).toHaveLength(11);
    expect(new Set(DELIVERY_CHAPTERS.map(route => route.seed)).size).toBe(11);
    expect(new Set(RESIDENT_ROUTES.map(route => JSON.stringify(route.obstacles.map(item => [item.at, item.definition.kind])))).size).toBe(6);
    expect(RESIDENT_ROUTES.map(route => route.postcardTitle)).toEqual([
      '花圃收到的谢谢', '风车下的一天', '小桥那边的回音', '雨后的河边茶会', '迟到的回信', '灯亮的时候',
    ]);
    for (const resident of RESIDENTS) for (const stage of resident.stages) {
      expect(getDeliveryChapter(stage.chapterId)?.title).toBe(stage.title);
    }
  });
  it('uses separate NPC assets and declared generated art, with all route copy available to the font builder', () => {
    const keys = new Set<string>([...RESIDENT_ASSETS, ...DELIVERY_EXPANSION_ASSETS].map(asset => asset.key));
    for (const route of RESIDENT_ROUTES) {
      for (const key of [...route.landscapes.map(layer => layer.key), route.previewKey, route.endingKey,
        route.postcardKey, route.accessoryKey!, ...route.challenge!.stamps.map(stamp => stamp.key)]) expect(keys.has(key), key).toBe(true);
      expect(route.endingKey).not.toBe(route.postcardKey);
      for (const npc of [route.residentEnding!.recipient, ...route.residentEnding!.guests]) {
        expect(keys.has(RESIDENT_NPC_ART[npc])).toBe(true);
        expect(RESIDENT_NPC_ART[npc]).not.toMatch(/^sheep|skin/);
      }
      for (const line of route.introduction) expect([...line].length).toBeLessThanOrEqual(15);
      expect(RESIDENT_ROUTE_TEXT).toContain(route.title);
      expect(RESIDENT_ROUTE_TEXT).toContain(route.postcardText);
      expect(RESIDENT_ROUTE_TEXT).toContain(route.challenge!.keepsakeTitle);
    }
    expect(RESIDENT_ROUTES.map(route => route.residentEnding!.moment)).toEqual([
      'flowers', 'photo', 'doorstep-flowers', 'tea-rainbow', 'harbor-lights', 'gathering',
    ]);
  });
  it('turns off the river rain at the wet-meadow transition and brings stars over the harbor coast', () => {
    const river = new DeliveryRoute('riverside-thanks-v1');
    expect(river.phase.weather).toBe('rain');
    river.distance = 6999; expect(river.phase.weather).toBe('rain');
    river.distance = 7000; expect(river.phase.weather).toBe('clear');
    const harbor = new DeliveryRoute('lighthouse-gathering-v1');
    expect(harbor.phase.weather).toBe('clear');
    harbor.distance = 8200; expect(harbor.phase.weather).toBe('starlight');
  });
});

describe.each(RESIDENT_ROUTES)('resident route $id', chapter => {
  it('takes 60–90 seconds under actual acceleration at both base and maximum speed upgrade', () => {
    for (const level of [0, 5]) {
      const effects = ProgressionSystem.effectsFor({ speed: level, jump: 0, dash: 0, magnet: 0 });
      const route = new DeliveryRoute(chapter.id), difficulty = new DifficultySystem(effects.worldSpeedMultiplier);
      let elapsed = 0;
      while (route.state === 'running') { elapsed += 20; route.advance(20, difficulty.update(.02)); }
      expect(elapsed).toBeGreaterThanOrEqual(60000);
      expect(elapsed).toBeLessThanOrEqual(90000);
      expect(route.distance).toBe(chapter.length);
      expect(route.state).toBe('ending');
      expect(route.challenge!.snapshot().stars).toBe(0);
    }
  });
  it('retains deterministic obstacles and phase changes across frame rates/upgrades with a clear finish', () => {
    const sample = (delta: number, multiplier: number) => {
      const route = new DeliveryRoute(chapter.id), difficulty = new DifficultySystem(multiplier), emitted = [];
      while (route.state === 'running') emitted.push(...route.advance(delta, difficulty.update(delta / 1000)));
      return emitted;
    };
    expect(sample(10, 1)).toEqual(chapter.obstacles);
    expect(sample(40, 1.1)).toEqual(chapter.obstacles);
    const route = new DeliveryRoute(chapter.id);
    for (const phase of chapter.phases) { route.distance = phase.start; expect(route.phase).toBe(phase); }
    const final = chapter.obstacles.at(-1)!;
    expect(chapter.length - final.at).toBeGreaterThanOrEqual(3200);
    expect(chapter.phases.at(-1)!.start - final.at - final.definition.width * (final.definition.visualScale ?? 1) - 498).toBeGreaterThan(0);
    expect(chapter.destinationAt).toBeGreaterThan(chapter.phases.at(-1)!.start);
    expect(chapter.landscapes).toHaveLength(3);
    expect(new Set(chapter.landscapes.map(layer => layer.key)).size).toBe(3);
  });
  it('keeps five grounded stamps and a distinct high-jump keepsake outside hazard/recovery zones', () => {
    const stamps = chapter.challenge!.stamps, hidden = stamps.filter(stamp => stamp.kind === 'keepsake');
    expect(stamps.filter(stamp => stamp.kind === 'ordinary')).toHaveLength(5);
    expect(hidden).toHaveLength(1);
    expect(new Set(stamps.map(stamp => stamp.id)).size).toBe(6);
    for (const stamp of stamps) {
      expect(stamp.at).toBeGreaterThan(1000);
      expect(stamp.at + 498).toBeLessThan(chapter.phases.at(-1)!.start);
      const clearance = Math.min(...chapter.obstacles.map(obstacle => Math.abs(stamp.at - obstacle.at)));
      expect(clearance).toBeGreaterThanOrEqual(600);
      if (stamp.kind === 'ordinary') expect(stamp.y + 10).toBeGreaterThan(WORLD.groundY - (PLAYER.height - 8));
    }
    const highFoot = WORLD.groundY - PLAYER.highJumpVelocityY ** 2 / (2 * PLAYER.gravityY);
    const normalFoot = WORLD.groundY - PLAYER.jumpVelocityY ** 2 / (2 * PLAYER.gravityY);
    expect(highFoot - (PLAYER.height - 8)).toBeLessThan(hidden[0].y + 11);
    expect(highFoot).toBeGreaterThan(hidden[0].y - 11);
    expect(normalFoot - (PLAYER.height - 8)).toBeGreaterThan(hidden[0].y + 11);
  });
  it('leaves enough reaction, landing and crouch recovery and is clearable with unchanged physical arcs', () => {
    const maxEffects = ProgressionSystem.effectsFor({ speed: 5, jump: 5, magnet: 5, dash: 5 });
    const maxSpeed = RUN.maxSpeed * maxEffects.worldSpeedMultiplier;
    const upgradedImpulse = Math.min(-PLAYER.highJumpVelocityY * maxEffects.jumpImpulseMultiplier, PLAYER.maxHighJumpSpeed);
    const recovery = 2 * upgradedImpulse / PLAYER.gravityY + INPUT.crouchDurationMs / 1000 + RUN.minimumReactionTime;
    for (let i = 1; i < chapter.obstacles.length; i++) {
      const previous = chapter.obstacles[i - 1], current = chapter.obstacles[i];
      expect((current.at - previous.at - previous.definition.width - (PLAYER.width - 12)) / maxSpeed).toBeGreaterThan(recovery);
    }
    for (const speedLevel of [0, 5]) for (const jumpLevel of [0, 5]) {
      const effects = ProgressionSystem.effectsFor({ speed: speedLevel, jump: jumpLevel, magnet: 0, dash: 0 });
      const route = new DeliveryRoute(chapter.id), difficulty = new DifficultySystem(effects.worldSpeedMultiplier);
      const encounters = new Map<number, number>();
      while (route.state === 'running') {
        const speed = difficulty.update(.01); route.advance(10, speed);
        for (const obstacle of chapter.obstacles) if (!encounters.has(obstacle.at) && route.distance >=
          498 + obstacle.at + obstacle.definition.hitbox.offsetX + obstacle.definition.hitbox.width / 2 - (PLAYER.x + PLAYER.width / 2)) encounters.set(obstacle.at, speed);
      }
      for (const request of chapter.obstacles) {
        const obstacle = request.definition, speed = encounters.get(request.at)!;
        const halfCrossing = (obstacle.hitbox.width + PLAYER.width - 12) / (2 * speed);
        const top = WORLD.groundY - obstacle.groundOffset - obstacle.height + obstacle.hitbox.offsetY;
        if (obstacle.kind === 'HangingBranch') {
          expect(halfCrossing * 2).toBeLessThan(INPUT.crouchDurationMs / 1000);
          expect(WORLD.groundY - PLAYER.crouchBodyHeight).toBeGreaterThanOrEqual(top + obstacle.hitbox.height);
        } else {
          const impulse = obstacle.kind === 'TallStack'
            ? Math.min(-PLAYER.highJumpVelocityY * effects.jumpImpulseMultiplier, PLAYER.maxHighJumpSpeed)
            : -PLAYER.jumpVelocityY * effects.jumpImpulseMultiplier;
          for (let offset = -halfCrossing; offset <= halfCrossing; offset += .002) {
            const t = impulse / PLAYER.gravityY + offset;
            expect(WORLD.groundY - impulse * t + PLAYER.gravityY * t * t / 2,
              `${chapter.id}/${obstacle.kind}/speed${speedLevel}/jump${jumpLevel}`).toBeLessThan(top);
          }
        }
      }
    }
  });
  it('requires a completed ending for the first star, freezes on failure/pause, and retries with empty collections', () => {
    const failed = new DeliveryRoute(chapter.id);
    failed.challenge!.collect(chapter.challenge!.stamps[0].id);
    failed.fail(); const before = failed.distance;
    failed.advance(40, 390);
    expect(failed.distance).toBe(before); expect(failed.challenge!.snapshot().stars).toBe(0);
    const retry = new DeliveryRoute(chapter.id);
    expect(retry.challenge!.snapshot().ordinaryCollected).toBe(0);
    retry.distance = chapter.length - 1; retry.advance(20, 390);
    expect(retry.state).toBe('ending');
    vi.useFakeTimers();
    try { vi.advanceTimersByTime(900000); expect(retry.endingMs).toBe(0); } finally { vi.useRealTimers(); }
    retry.advance(0, 0); retry.advance(NaN, 0);
    expect(retry.endingMs).toBe(0);
    let completed = 0;
    for (let i = 0; i < 350; i++) {
      const state = retry.state;
      retry.advance(20, 0);
      if (state !== 'complete' && retry.state === 'complete') completed++;
    }
    expect(completed).toBe(1);
    expect(retry.challenge!.snapshot()).toMatchObject({ successful: true, stars: 1, ordinaryCollected: 0, hiddenCollected: false });
    retry.fail(); expect(retry.state).toBe('complete');
    const firstResult = retry.challenge!.snapshot();
    expect(retry.challenge!.finish(true)).toEqual(firstResult);
  });
});

it('constructing and running all resident routes leaves the endless spawn RNG and award rules alone', () => {
  const baseline = new SpawnSystem(14291), unchanged = new SpawnSystem(14291), random = vi.spyOn(Math, 'random');
  try {
    const routes = RESIDENT_ROUTES.map(chapter => new DeliveryRoute(chapter.id));
    for (let i = 0; i < 3000; i++) {
      for (const route of routes) route.advance(20, 390);
      expect(unchanged.update(.02, 390)).toEqual(baseline.update(.02, 390));
    }
    expect(random).not.toHaveBeenCalled();
  } finally { random.mockRestore(); }
});
