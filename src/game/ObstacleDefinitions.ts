export type ObstacleKind = "WoodFence" | "Pumpkin" | "Rock" | "Puddle" | "FlyingBird" | "WideLog" | "TallStack" | "HangingVine"
  | "WoodBarrel" | "MilkChurn" | "FruitBasket" | "MushroomCluster" | "Bramble" | "HangingBranch"
  | "HayCart" | "WaterTrough" | "HangingLantern" | "FlyingGoose";

export interface ObstacleDefinition {
  readonly kind: ObstacleKind;
  readonly texture: string;
  readonly width: number;
  readonly height: number;
  readonly groundOffset: number;
  /** Uniform artwork enlargement; authored geometry still owns collision and timing. */
  readonly visualScale?: number;
  readonly hitbox: {
    readonly width: number;
    readonly height: number;
    readonly offsetX: number;
    readonly offsetY: number;
  };
  readonly motion?: {
    readonly amplitude: number;
    readonly frequency: number;
  };
}

export const WoodFence: ObstacleDefinition = {
  kind: "WoodFence",
  texture: "fence",
  visualScale: 1.2,
  width: 36,
  height: 36,
  groundOffset: 0,
  hitbox: { width: 30, height: 26, offsetX: 3, offsetY: 7 },
};

export const Pumpkin: ObstacleDefinition = {
  kind: "Pumpkin",
  texture: "obstacle-pumpkin",
  visualScale: 1.2,
  width: 26,
  height: 24,
  groundOffset: 0,
  hitbox: { width: 21, height: 19, offsetX: 2, offsetY: 3 },
};

export const Rock: ObstacleDefinition = {
  kind: "Rock",
  texture: "obstacle-rock",
  visualScale: 1.2,
  width: 30,
  height: 18,
  groundOffset: 0,
  hitbox: { width: 25, height: 12, offsetX: 2, offsetY: 4 },
};

export const Puddle: ObstacleDefinition = {
  kind: "Puddle",
  texture: "obstacle-puddle",
  visualScale: 1.2,
  width: 38,
  height: 13,
  groundOffset: 0,
  hitbox: { width: 34, height: 7, offsetX: 2, offsetY: 4 },
};

export const FlyingBird: ObstacleDefinition = {
  kind: "FlyingBird",
  texture: "obstacle-bird",
  visualScale: 1.2,
  width: 30,
  height: 21,
  groundOffset: 44,
  hitbox: { width: 24, height: 12, offsetX: 3, offsetY: 4 },
  motion: { amplitude: 3, frequency: 3.5 },
};

// The original atlas has exactly these five cells, in this order.
export const BASE_OBSTACLE_DEFINITIONS: readonly ObstacleDefinition[] = [
  WoodFence,
  Pumpkin,
  Rock,
  Puddle,
  FlyingBird,
];

export const WideLog: ObstacleDefinition = {
  kind: "WideLog",
  texture: "obstacle-wide-log",
  visualScale: 1.2,
  width: 64,
  height: 24,
  groundOffset: 0,
  hitbox: { width: 54, height: 18, offsetX: 5, offsetY: 4 },
};

export const TallStack: ObstacleDefinition = {
  kind: "TallStack",
  texture: "obstacle-tall-stack",
  visualScale: 1.08,
  width: 36,
  height: 94,
  groundOffset: 0,
  hitbox: { width: 20, height: 88, offsetX: 8, offsetY: 3 },
};

export const HangingVine: ObstacleDefinition = {
  kind: "HangingVine",
  texture: "obstacle-hanging-vine",
  visualScale: 1.2,
  width: 28,
  height: 40,
  groundOffset: 20,
  hitbox: { width: 18, height: 36, offsetX: 5, offsetY: 2 },
};

export const ADDITIONAL_OBSTACLE_DEFINITIONS: readonly ObstacleDefinition[] = [WideLog, TallStack, HangingVine];

export const WoodBarrel: ObstacleDefinition = {
  kind: "WoodBarrel", texture: "obstacle-wood-barrel", visualScale: 1.2,
  width: 32, height: 32, groundOffset: 0,
  hitbox: { width: 26, height: 26, offsetX: 3, offsetY: 4 },
};
export const MilkChurn: ObstacleDefinition = {
  kind: "MilkChurn", texture: "obstacle-milk-churn", visualScale: 1.2,
  width: 28, height: 40, groundOffset: 0,
  hitbox: { width: 20, height: 31, offsetX: 4, offsetY: 6 },
};
export const FruitBasket: ObstacleDefinition = {
  kind: "FruitBasket", texture: "obstacle-fruit-basket", visualScale: 1.2,
  width: 42, height: 27, groundOffset: 0,
  hitbox: { width: 36, height: 19, offsetX: 3, offsetY: 6 },
};
export const MushroomCluster: ObstacleDefinition = {
  kind: "MushroomCluster", texture: "obstacle-mushroom-cluster", visualScale: 1.2,
  width: 32, height: 24, groundOffset: 0,
  hitbox: { width: 26, height: 17, offsetX: 3, offsetY: 5 },
};
export const Bramble: ObstacleDefinition = {
  kind: "Bramble", texture: "obstacle-bramble", visualScale: 1.2,
  width: 48, height: 26, groundOffset: 0,
  hitbox: { width: 38, height: 18, offsetX: 5, offsetY: 6 },
};
export const HangingBranch: ObstacleDefinition = {
  kind: "HangingBranch", texture: "obstacle-hanging-branch", visualScale: 1.2,
  width: 36, height: 20, groundOffset: 20,
  // Leaves frame the solid core; clearance fits the existing 320 ms crouch.
  hitbox: { width: 20, height: 14, offsetX: 8, offsetY: 4 },
};
export const NEW_OBSTACLE_DEFINITIONS: readonly ObstacleDefinition[] = [WoodBarrel, MilkChurn, FruitBasket, MushroomCluster, Bramble, HangingBranch];

export const HayCart: ObstacleDefinition = {
  kind: "HayCart", texture: "obstacle-hay-cart", visualScale: 1.2,
  width: 72, height: 40, groundOffset: 0,
  hitbox: { width: 42, height: 28, offsetX: 16, offsetY: 10 },
};
export const WaterTrough: ObstacleDefinition = {
  kind: "WaterTrough", texture: "obstacle-water-trough", visualScale: 1.2,
  width: 80, height: 22, groundOffset: 0,
  hitbox: { width: 60, height: 14, offsetX: 10, offsetY: 6 },
};
export const HangingLantern: ObstacleDefinition = {
  kind: "HangingLantern", texture: "obstacle-hanging-lantern", visualScale: 1.2,
  width: 22, height: 28, groundOffset: 22,
  hitbox: { width: 12, height: 18, offsetX: 5, offsetY: 8 },
};
export const FlyingGoose: ObstacleDefinition = {
  kind: "FlyingGoose", texture: "obstacle-flying-goose", visualScale: 1.2,
  width: 34, height: 26, groundOffset: 52,
  hitbox: { width: 26, height: 12, offsetX: 4, offsetY: 7 },
  motion: { amplitude: 4, frequency: 2.6 },
};
export const EXPANDED_OBSTACLE_DEFINITIONS: readonly ObstacleDefinition[] = [HayCart, WaterTrough, HangingLantern, FlyingGoose];
export const OBSTACLE_DEFINITIONS: readonly ObstacleDefinition[] = [
  ...BASE_OBSTACLE_DEFINITIONS, ...ADDITIONAL_OBSTACLE_DEFINITIONS, ...NEW_OBSTACLE_DEFINITIONS, ...EXPANDED_OBSTACLE_DEFINITIONS,
];

const OVERHEAD_OBSTACLE_KINDS = new Set(OBSTACLE_DEFINITIONS.filter(definition => definition.groundOffset > 0).map(definition => definition.kind));
/** Jump routes and companion bells must follow the same hazard classification. */
export function isOverheadObstacle(kind: ObstacleKind): boolean { return OVERHEAD_OBSTACLE_KINDS.has(kind); }
