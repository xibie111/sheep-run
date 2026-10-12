import Phaser from "phaser";
import { POWER_UP } from "../game/Constants";
import { RUN_STAR_ART } from "../data/collectibleArtAssets";

export class Star extends Phaser.Physics.Arcade.Sprite {
  baseY: number;
  private phase: number;
  collected = false;
  missed = false;

  /** Include the rotated sprite's full outline when checking the visible edge. */
  get visualRightEdge(): number { return this.getBounds().right; }

  constructor(scene: Phaser.Scene, x: number, y: number, phase: number) {
    super(scene, x, y, RUN_STAR_ART.key);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.baseY = y;
    this.phase = phase;
    this.setDepth(7);
    this.setScale(1);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(16, 16, true);
  }

  activate(x: number, y: number, phase: number, speed: number): void {
    this.baseY = y;
    this.phase = phase;
    this.collected = false;
    this.missed = false;
    this.setPosition(x, y).setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    this.updateMotion(0, speed);
  }

  deactivate(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
    this.setActive(false).setVisible(false);
  }

  updateMotion(deltaSeconds: number, speed: number, magnetTarget?: { x: number; y: number; radiusPx?: number }): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (magnetTarget && !this.missed) {
      const deltaX = magnetTarget.x - this.x;
      const deltaY = magnetTarget.y - this.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > 0 && distance <= (magnetTarget.radiusPx ?? POWER_UP.magnetRadiusPx)) {
        const attractionSpeed = speed * 1.5;
        body.setVelocity(deltaX / distance * attractionSpeed, deltaY / distance * attractionSpeed);
        this.setAngle(Math.sin(this.phase) * 7);
        return;
      }
    }
    // A missed star is only scenery until recycled, even after magnetic motion.
    if (this.missed) body.setVelocity(-speed, 0);
    else body.setVelocityX(-speed);
    this.phase += deltaSeconds * 5;
    this.y = this.baseY + Math.sin(this.phase) * 4;
    this.setAngle(Math.sin(this.phase) * 7);
  }
}
