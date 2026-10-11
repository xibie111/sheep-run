import Phaser from "phaser";
import type { PowerUpType } from "../systems/PowerUpSystem";

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  override type: PowerUpType;
  private homeY: number;
  private phase: number;
  collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, type: PowerUpType, phase: number) {
    super(scene, x, y, `powerup-${type}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.type = type;
    this.homeY = y;
    this.phase = phase;
    this.setDisplaySize(22, 22).setDepth(9);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(16, 16, true);
  }

  activate(x: number, y: number, type: PowerUpType, phase: number, speed: number): void {
    this.type = type;
    this.homeY = y;
    this.phase = phase;
    this.collected = false;
    this.setTexture(`powerup-${type}`).setPosition(x, y).setActive(true).setVisible(true);
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

  updateMotion(deltaSeconds: number, speed: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(-speed);
    this.phase += deltaSeconds * 5;
    this.y = this.homeY + Math.sin(this.phase) * 4;
    this.setAngle(Math.sin(this.phase) * 7);
  }
}
