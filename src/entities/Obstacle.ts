import Phaser from "phaser";
import { WORLD } from "../game/Constants";
import type { ObstacleDefinition } from "../game/ObstacleDefinitions";
import { toSourceHitbox } from "../systems/CollisionSystem";
import type { ThemeId } from "../environment/types";
import { SEASON_OBSTACLE_NAMES, seasonObstacleKey } from "../data/seasonArtAssets";

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
  passed = false;
  readonly definition: ObstacleDefinition;
  private readonly baseY: number;
  private phase: number;
  visualSeason: ThemeId = "spring";

  constructor(scene: Phaser.Scene, x: number, definition: ObstacleDefinition, phase = Math.random() * Math.PI * 2) {
    const baseY = WORLD.groundY - definition.groundOffset;
    super(scene, x, baseY, definition.texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(6);
    this.definition = definition;
    this.baseY = baseY;
    this.phase = phase;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    this.syncVisualGeometry();
  }

  activate(x: number, phase: number, speed: number, season: ThemeId = "spring"): void {
    this.applySeasonAppearance(season);
    this.passed = false;
    this.phase = phase;
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, this.baseY);
    this.moveAt(speed);
  }

  private applySeasonAppearance(season: ThemeId): void {
    this.visualSeason = season;
    const key = seasonObstacleKey(season, this.definition.kind);
    if (!this.scene.textures?.exists(key)) return;
    this.setTexture(key);
    this.setData("season", season).setData("visualName", SEASON_OBSTACLE_NAMES[season][this.definition.kind]);
    this.syncVisualGeometry();
  }

  private syncVisualGeometry(): void {
    const definition = this.definition;
    const scale = definition.visualScale ?? 1;
    const width = definition.width * scale, height = definition.height * scale;
    const paddingX = (width - definition.width) / 2;
    const paddingY = height - definition.height;
    this.setDisplaySize(width, height).setOrigin(paddingX / width, 1);
    // Grow artwork around the original horizontal center and foot baseline.
    // Compensate its padding so the world-space collision body does not move.
    const body = this.body as Phaser.Physics.Arcade.Body;
    const hitbox = toSourceHitbox({ ...definition.hitbox,
      offsetX: definition.hitbox.offsetX + paddingX,
      offsetY: definition.hitbox.offsetY + paddingY,
    }, this.scaleX, this.scaleY);
    body.setSize(hitbox.width, hitbox.height);
    body.setOffset(hitbox.offsetX, hitbox.offsetY);
  }

  deactivate(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  moveAt(speed: number, deltaSeconds = 0): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(-speed);
    if (!this.definition.motion) return;
    this.phase += deltaSeconds * this.definition.motion.frequency;
    this.y = this.baseY + Math.sin(this.phase) * this.definition.motion.amplitude;
  }

  get rightEdge(): number {
    // Passing and scoring retain the authored edge, independent of decoration.
    return this.x + this.definition.width;
  }

  get visualRightEdge(): number {
    // Artwork grows evenly around the authored horizontal center.
    return this.rightEdge + (this.displayWidth - this.definition.width) / 2;
  }
}
