import { INPUT, PLAYER, RUN, WORLD } from '../game/Constants';
import { isOverheadObstacle, type ObstacleKind } from '../game/ObstacleDefinitions';
import type { StarRouteWindow } from '../systems/SpawnSystemOwner';

export type StarRouteKind = 'single' | 'arc' | 'high-low' | 'landing';
export interface StarRoutePoint { readonly x: number; readonly y: number; readonly phase: number; }
export interface StarRouteObstacle { readonly left: number; readonly right: number; readonly kind: ObstacleKind; }
export interface StarRoutePickup { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface StarRouteContext {
  readonly speed: number;
  readonly spawnX: number;
  /** Body center, without changing the authored player position. */
  readonly playerX: number;
  readonly groundY?: number;
  readonly jumpImpulseMultiplier: number;
  readonly window: StarRouteWindow;
  readonly obstacles: readonly StarRouteObstacle[];
  readonly pickups: readonly StarRoutePickup[];
}
export interface StarRoutePlan {
  readonly kind: StarRouteKind;
  readonly points: readonly StarRoutePoint[];
  readonly actionLeft: number;
  readonly actionRight: number;
  readonly jumpStartX: number | null;
  readonly sampleTimes: readonly number[];
}

export const STAR_ROUTE_RULES = {
  starSize: 16,
  bobAmplitude: 4,
  bodyWidth: PLAYER.width - 12,
  bodyHeight: PLAYER.height - 8,
  pickupPadding: 14,
  bankLimit: 6,
  touchReactionSeconds: .35,
} as const;

export function starRouteSize(kind: StarRouteKind): number { return kind === 'arc' ? 3 : kind === 'high-low' ? 2 : 1; }

export function normalJumpFlightSeconds(multiplier = 1): number {
  return 2 * Math.abs(PLAYER.jumpVelocityY) * Math.max(1, multiplier) / PLAYER.gravityY;
}
export function normalJumpRise(seconds: number, multiplier = 1): number {
  return Math.max(0, Math.abs(PLAYER.jumpVelocityY) * Math.max(1, multiplier) * seconds - PLAYER.gravityY * seconds * seconds / 2);
}

/**
 * A whole route occupies one obstacle-free action window. The jump follows the
 * existing ordinary impulse, gravity and body geometry, including the star bob.
 * No hazard is moved, delayed or deleted to make this window available.
 */
export function planStarRoute(kind: StarRouteKind, context: StarRouteContext, phases: readonly number[]): StarRoutePlan | null {
  const { speed, spawnX, playerX, window: gap } = context;
  const multiplier = context.jumpImpulseMultiplier;
  if (![speed, spawnX, playerX, multiplier, gap.nextObstacleInPx].every(Number.isFinite)
    || speed <= 0 || multiplier < 1 || !gap.openingSafe || !gap.patternEnded) return null;
  const groundY = context.groundY ?? WORLD.groundY;
  if (!Number.isFinite(groundY)) return null;
  const flight = normalJumpFlightSeconds(multiplier);
  // Contacts at 26%, 49% and 72% make a shallow three-star ordinary-jump arc.
  const sampleTimes = kind === 'arc' ? [.26 * flight, .49 * flight, .72 * flight]
    : kind === 'high-low' ? [0, .5 * flight]
      : kind === 'single' ? [.5 * flight] : [0];
  const span = speed * (sampleTimes[sampleTimes.length - 1]! - sampleTimes[0]!);
  const firstX = spawnX - span;
  // All stars are inside the existing entry boundary. Ordinary taps get their
  // own response margin; the larger hazard response window remains unchanged.
  const jumpStartX = kind === 'landing' ? null : firstX - speed * sampleTimes[0]!;
  const actionStart = jumpStartX ?? firstX;
  if (actionStart - playerX < speed * STAR_ROUTE_RULES.touchReactionSeconds + STAR_ROUTE_RULES.bodyWidth / 2) return null;
  const actionEnd = jumpStartX === null ? firstX : jumpStartX + speed * flight;
  const recovery = INPUT.jumpBufferMs / 1000 + RUN.simulationDeltaCapMs / 1000;
  const halfBody = STAR_ROUTE_RULES.bodyWidth / 2;
  const actionLeft = actionStart - halfBody;
  const actionRight = actionEnd + speed * recovery + halfBody;
  // Completing the preceding obstacle near its jump apex permits a complete
  // descent and input recovery before this next action starts.
  const highImpulse = Math.min(Math.abs(PLAYER.highJumpVelocityY) * multiplier, PLAYER.maxHighJumpSpeed);
  const trailingRecovery = speed * (highImpulse / PLAYER.gravityY + recovery) + halfBody;
  const previous = context.obstacles.filter(obstacle => obstacle.right <= actionStart)
    .sort((a, b) => b.right - a.right)[0];
  if (!previous || isOverheadObstacle(previous.kind) || previous.right + trailingRecovery > actionLeft) return null;
  if (context.obstacles.some(obstacle => obstacle.left < actionRight && obstacle.right > actionLeft)) return null;
  // The next obstacle is forecast at its real boundary (4 px beyond the star
  // boundary), from current travel. Random spacing variation is already included.
  if (spawnX + 4 + gap.nextObstacleInPx < actionRight + halfBody) return null;
  const points = sampleTimes.map((seconds, index) => ({
    x: firstX + speed * (seconds - sampleTimes[0]!),
    y: groundY - STAR_ROUTE_RULES.bodyHeight / 2 - normalJumpRise(seconds, multiplier),
    phase: phases[index] ?? 0,
  }));
  const padding = STAR_ROUTE_RULES.pickupPadding + STAR_ROUTE_RULES.starSize / 2;
  if (points.some(point => context.pickups.some(pickup =>
    point.x + padding > pickup.x && point.x - padding < pickup.x + pickup.width
      && point.y + padding > pickup.y && point.y - padding < pickup.y + pickup.height))) return null;
  return { kind, points, actionLeft, actionRight, jumpStartX, sampleTimes };
}
