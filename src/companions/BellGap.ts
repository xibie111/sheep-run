import { PLAYER, WORLD } from "../game/Constants";
import { isOverheadObstacle, type ObstacleKind } from "../game/ObstacleDefinitions";
import { obstacleGap } from "../systems/ObstaclePatterns";
import { COMPANION_RULES as RULES } from "./CompanionRules";

export interface Rect { x: number; y: number; width: number; height: number; }
export interface BellObstacle { left: number; right: number; kind: ObstacleKind; }
export interface BellGapContext {
  spawnX: number;
  speed: number;
  jumpImpulseMultiplier: number;
  patternEnded: boolean;
  lastObstacle: BellObstacle | null;
  obstacles: readonly BellObstacle[];
  pickups: readonly Rect[];
}

export function rectanglesOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Conservative earliest-next-obstacle bound, using the original spacing formula. */
export function isSafeBellGap(context: BellGapContext): boolean {
  const { lastObstacle: last, spawnX, speed } = context;
  if (!last || !context.patternEnded || !Number.isFinite(speed) || speed <= 0) return false;
  if (isOverheadObstacle(last.kind)) return false;
  const trailing = spawnX - last.right;
  const recoverBehind = PLAYER.width + speed * RULES.trailingRecoverySeconds;
  const recoverAhead = PLAYER.width / 2 + RULES.bellWidth / 2 + speed * RULES.leadingRecoverySeconds;
  // Reserve the 4 px difference between the original obstacle and bell boundaries.
  // Random gap variation can only delay the next group, so this remains conservative.
  const remaining = obstacleGap(speed, context.jumpImpulseMultiplier, true) - trailing - 4;
  if (trailing < recoverBehind || remaining < recoverAhead) return false;
  if (context.obstacles.some(obstacle => obstacle.left < spawnX + recoverAhead && obstacle.right > spawnX - recoverBehind)) return false;
  const padding = RULES.pickupPaddingPx;
  const box = { x: spawnX - RULES.bellWidth / 2 - padding, y: WORLD.groundY - RULES.bellAboveGroundPx - RULES.bellHeight / 2 - padding,
    width: RULES.bellWidth + padding * 2, height: RULES.bellHeight + padding * 2 };
  return !context.pickups.some(pickup => rectanglesOverlap(box, pickup));
}
