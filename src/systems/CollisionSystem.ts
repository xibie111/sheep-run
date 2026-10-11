import type Phaser from "phaser";

export interface LogicalHitbox {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function toSourceHitbox(hitbox: LogicalHitbox, scaleX: number, scaleY: number): LogicalHitbox {
  const safeScaleX = Math.max(0.0001, Math.abs(scaleX));
  const safeScaleY = Math.max(0.0001, Math.abs(scaleY));
  return {
    width: hitbox.width / safeScaleX,
    height: hitbox.height / safeScaleY,
    offsetX: hitbox.offsetX / safeScaleX,
    offsetY: hitbox.offsetY / safeScaleY,
  };
}

export class CollisionSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  connect(
    sheep: Phaser.Physics.Arcade.Sprite,
    obstacles: Phaser.Physics.Arcade.Group,
    stars: Phaser.Physics.Arcade.Group,
    handlers: {
      onObstacle: (obstacle: object) => void;
      onStar: (star: object) => void;
      onPowerUp?: (powerUp: object) => void;
    },
    powerUps?: Phaser.Physics.Arcade.Group,
  ): void {
    this.scene.physics.add.overlap(sheep, obstacles, (_sheep, obstacle) => handlers.onObstacle(obstacle as object));
    this.scene.physics.add.overlap(sheep, stars, (_sheep, star) => handlers.onStar(star as object));
    if (powerUps && handlers.onPowerUp) {
      this.scene.physics.add.overlap(sheep, powerUps, (_sheep, powerUp) => handlers.onPowerUp!(powerUp as object));
    }
  }
}
