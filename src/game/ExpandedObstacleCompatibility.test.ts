import { describe, expect, it } from "vitest";
import { PLAYER, RUN, WORLD } from "./Constants";
import { OBSTACLE_DEFINITIONS, type ObstacleKind } from "./ObstacleDefinitions";
import { isSafeBellGap, type BellGapContext } from "../companions/BellGap";
import { COMPANION_RULES } from "../companions/CompanionRules";
import { planStarRoute, type StarRouteContext, type StarRouteKind } from "../stars-v2/StarRoutePlanner";

const overheadKinds = ["FlyingBird", "HangingVine", "HangingBranch", "HangingLantern", "FlyingGoose"] as const;
const groundKinds = ["HayCart", "WaterTrough"] as const;
const routeKinds: readonly StarRouteKind[] = ["single", "arc", "high-low", "landing"];
const speeds = [RUN.initialSpeed, 270, RUN.maxSpeed];

function widthOf(kind: ObstacleKind): number {
  const definition = OBSTACLE_DEFINITIONS.find(item => item.kind === kind);
  if (!definition) throw new Error(`Missing obstacle definition: ${kind}`);
  return definition.width;
}

/** Recovered obstacle from the existing StarRoutePlanner acceptance fixture. */
function clearStarContext(kind: ObstacleKind, speed: number, multiplier: number): StarRouteContext {
  return {
    speed, spawnX: WORLD.width + 14, playerX: PLAYER.x + PLAYER.width / 2,
    jumpImpulseMultiplier: multiplier,
    window: { openingSafe: true, patternEnded: true, nextObstacleInPx: 2000 },
    obstacles: [{ left: -500 - widthOf(kind), right: -500, kind }], pickups: [],
  };
}

/** The earliest safe trailing distance used in CompanionRules.test.ts. */
function clearBellContext(kind: ObstacleKind, speed: number, multiplier: number): BellGapContext {
  const spawnX = WORLD.width + 14;
  const right = spawnX - (PLAYER.width + speed * COMPANION_RULES.trailingRecoverySeconds + 1);
  const lastObstacle = { left: right - widthOf(kind), right, kind };
  return {
    spawnX, speed, jumpImpulseMultiplier: multiplier, patternEnded: true,
    lastObstacle, obstacles: [lastObstacle], pickups: [],
  };
}

describe("expanded obstacle pickup compatibility", () => {
  it.each(overheadKinds)("does not encourage a star jump after %s", kind => {
    for (const speed of speeds) for (const multiplier of [1, 1.15]) for (const route of routeKinds) {
      expect(planStarRoute(route, clearStarContext(kind, speed, multiplier), [0, 1, 2]),
        `${kind}/${route}/${speed}/${multiplier}`).toBeNull();
    }
  });

  it.each(overheadKinds)("defers a companion bell after %s", kind => {
    for (const speed of speeds) for (const multiplier of [1, 1.1]) {
      expect(isSafeBellGap(clearBellContext(kind, speed, multiplier)),
        `${kind}/${speed}/${multiplier}`).toBe(false);
    }
  });

  it.each(groundKinds)("retains recovered star routes after %s", kind => {
    for (const speed of speeds) for (const multiplier of [1, 1.15]) for (const route of routeKinds) {
      expect(planStarRoute(route, clearStarContext(kind, speed, multiplier), [0, 1, 2]),
        `${kind}/${route}/${speed}/${multiplier}`).not.toBeNull();
    }
  });

  it.each(groundKinds)("retains a safe companion bell gap after %s", kind => {
    for (const speed of speeds) for (const multiplier of [1, 1.1]) {
      expect(isSafeBellGap(clearBellContext(kind, speed, multiplier)),
        `${kind}/${speed}/${multiplier}`).toBe(true);
    }
  });
});
