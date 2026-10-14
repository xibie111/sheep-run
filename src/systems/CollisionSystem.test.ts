import { describe, expect, it, vi } from "vitest";
import { OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { PLAYER, WORLD } from "../game/Constants";
import { CollisionSystem, toSourceHitbox } from "./CollisionSystem";

describe("collision geometry", () => {
  it("converts logical hitboxes into unscaled texture-frame units", () => {
    expect(toSourceHitbox({ width: 30, height: 26, offsetX: 3, offsetY: 7 }, 0.75, 0.5))
      .toEqual({ width: 40, height: 52, offsetX: 4, offsetY: 14 });
  });

  it("keeps every obstacle hitbox inside its display bounds", () => {
    expect(OBSTACLE_DEFINITIONS.map(({ kind }) => kind)).toEqual([
      "WoodFence",
      "Pumpkin",
      "Rock",
      "Puddle",
      "FlyingBird",
      "WideLog",
      "TallStack",
      "HangingVine",
      "WoodBarrel", "MilkChurn", "FruitBasket", "MushroomCluster", "Bramble", "HangingBranch",
      "HayCart", "WaterTrough", "HangingLantern", "FlyingGoose",
    ]);
    for (const definition of OBSTACLE_DEFINITIONS) {
      const { width, height, offsetX, offsetY } = definition.hitbox;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(offsetX).toBeGreaterThanOrEqual(0);
      expect(offsetY).toBeGreaterThanOrEqual(0);
      expect(offsetX + width).toBeLessThanOrEqual(definition.width);
      expect(offsetY + height).toBeLessThanOrEqual(definition.height);
    }
  });

  it("places the bird above a grounded sheep hitbox", () => {
    const bird = OBSTACLE_DEFINITIONS.find(({ kind }) => kind === "FlyingBird");
    if (!bird) throw new Error("FlyingBird definition is missing");
    const birdBottom = WORLD.groundY - bird.groundOffset - bird.height + bird.hitbox.offsetY + bird.hitbox.height;
    const sheepTop = WORLD.groundY - (PLAYER.height - 8);

    expect(birdBottom).toBeLessThan(sheepTop);
  });

  it("routes the overlapped obstacle to the shield-aware handler", () => {
    const overlap = vi.fn();
    const scene = { physics: { add: { overlap } } } as never;
    const collision = new CollisionSystem(scene);
    const sheep = {} as never;
    const obstacle = { deactivate: vi.fn() };
    const onObstacle = vi.fn();

    collision.connect(sheep, {} as never, {} as never, { onObstacle, onStar: vi.fn() });
    overlap.mock.calls[0]![2]!(sheep, obstacle);

    expect(onObstacle).toHaveBeenCalledWith(obstacle);
  });

  it("routes pickup overlaps through the canonical collision owner", () => {
    const overlap = vi.fn();
    const scene = { physics: { add: { overlap } } } as never;
    const collision = new CollisionSystem(scene);
    const sheep = {} as never;
    const obstacles = {} as never;
    const stars = {} as never;
    const powerUps = {} as never;
    const onPowerUp = vi.fn();

    collision.connect(sheep, obstacles, stars, { onObstacle: vi.fn(), onStar: vi.fn(), onPowerUp }, powerUps);

    expect(overlap).toHaveBeenCalledTimes(3);
    expect(overlap.mock.calls[2]![0]).toBe(sheep);
    expect(overlap.mock.calls[2]![1]).toBe(powerUps);
    overlap.mock.calls[2]![2]!(sheep, { type: "magnet" });
    expect(onPowerUp).toHaveBeenCalledWith({ type: "magnet" });
  });
});
