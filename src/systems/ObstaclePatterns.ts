import { INPUT, PLAYER, RUN } from "../game/Constants";
import { FlyingBird, HangingVine, Puddle, Pumpkin, Rock, TallStack, WideLog, WoodFence, WoodBarrel, MilkChurn, FruitBasket, MushroomCluster, Bramble, HangingBranch, HayCart, WaterTrough, HangingLantern, FlyingGoose, type ObstacleDefinition } from "../game/ObstacleDefinitions";

export interface ObstaclePattern {
  readonly id: string;
  readonly obstacles: readonly ObstacleDefinition[];
}

export const OBSTACLE_RHYTHM = {
  openingObstacles: 3,
  tripleAfterObstacles: 12,
  actionRecoverySeconds: INPUT.jumpBufferMs / 1000,
  betweenPatternsSeconds: 0.65,
} as const;

const OPENING_PATTERNS: readonly ObstaclePattern[] = [
  { id: "opening-rock", obstacles: [Rock] },
  { id: "opening-pumpkin", obstacles: [Pumpkin] },
  { id: "opening-puddle", obstacles: [Puddle] },
  { id: "opening-fence", obstacles: [WoodFence] },
];

const FLOW_PATTERNS: readonly ObstaclePattern[] = [
  { id: "wide-log", obstacles: [WideLog] },
  { id: "high-stack", obstacles: [TallStack] },
  { id: "low-high", obstacles: [Rock, TallStack] },
  { id: "ground-pair", obstacles: [Puddle, Pumpkin] },
  { id: "fence-log", obstacles: [WoodFence, WideLog] },
  { id: "bird-ground", obstacles: [FlyingBird, Rock] },
  { id: "high-duck", obstacles: [TallStack, HangingVine] },
  { id: "duck-jump", obstacles: [HangingVine, WideLog] },
  { id: "barrel-basket", obstacles: [WoodBarrel, FruitBasket] },
  { id: "milk-mushrooms", obstacles: [MilkChurn, MushroomCluster] },
  { id: "bramble", obstacles: [Bramble] },
  { id: "branch-barrel", obstacles: [HangingBranch, WoodBarrel] },
  { id: "hay-cart", obstacles: [HayCart] },
  { id: "water-trough", obstacles: [WaterTrough] },
  { id: "hanging-lantern", obstacles: [HangingLantern] },
  { id: "flying-goose", obstacles: [FlyingGoose] },
  { id: "cart-trough", obstacles: [HayCart, WaterTrough] },
  { id: "lantern-cart", obstacles: [HangingLantern, HayCart] },
];

const TRIPLE_PATTERNS: readonly ObstaclePattern[] = [
  { id: "ground-triple", obstacles: [Puddle, WideLog, Pumpkin] },
  { id: "high-middle", obstacles: [Rock, TallStack, Rock] },
  { id: "bird-middle", obstacles: [WoodFence, FlyingBird, Puddle] },
  { id: "duck-middle", obstacles: [WideLog, HangingVine, WoodFence] },
  { id: "basket-branch-bramble", obstacles: [FruitBasket, HangingBranch, Bramble] },
  { id: "mushroom-milk-rock", obstacles: [MushroomCluster, MilkChurn, Rock] },
  { id: "cart-lantern-trough", obstacles: [HayCart, HangingLantern, WaterTrough] },
  { id: "trough-goose-cart", obstacles: [WaterTrough, FlyingGoose, HayCart] },
];

export function availableObstaclePatterns(obstaclesSpawned: number): readonly ObstaclePattern[] {
  return obstaclesSpawned < OBSTACLE_RHYTHM.openingObstacles
    ? OPENING_PATTERNS
    : obstaclesSpawned < OBSTACLE_RHYTHM.tripleAfterObstacles
      ? FLOW_PATTERNS
      : [...FLOW_PATTERNS, ...TRIPLE_PATTERNS];
}

/** Clear space behind the previous sprite, including the player's body crossing it. */
export function obstacleGap(speed: number, jumpImpulseMultiplier: number, betweenPatterns: boolean): number {
  const highJumpSeconds = 2 * Math.abs(PLAYER.highJumpVelocityY) * jumpImpulseMultiplier / PLAYER.gravityY;
  const recoverySeconds = Math.max(INPUT.crouchDurationMs / 1000, highJumpSeconds + RUN.simulationDeltaCapMs / 1000)
    + OBSTACLE_RHYTHM.actionRecoverySeconds;
  const bodyWidth = PLAYER.width - 12;
  const minimumGap = Math.max(RUN.minimumJumpDistance, RUN.obstacleSpacing,
    speed * RUN.minimumReactionTime, bodyWidth + speed * recoverySeconds);
  return minimumGap + (betweenPatterns ? speed * OBSTACLE_RHYTHM.betweenPatternsSeconds : 0);
}
