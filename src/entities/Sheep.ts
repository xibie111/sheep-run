import Phaser from "phaser";
import { PLAYER, WORLD } from "../game/Constants";
import type { JumpKind } from "../systems/InputSystem";
import type { SheepState } from "../game/GameState";
import type { SkinId } from "../data/sheepSkins";
import { sheepTextureKey } from "../data/sheepSkins";
import { sheepAnimationForState } from "./SheepAnimation";
import { syncSheepArcadeBody } from "./SheepBody";

export class Sheep extends Phaser.Physics.Arcade.Sprite {
  motionState: SheepState = "IDLE";
  private crouching = false;
  private dashing = false;

  constructor(scene: Phaser.Scene, private readonly jumpImpulseMultiplier = 1, private readonly skinId: SkinId = "white") {
    super(scene, PLAYER.x + PLAYER.width / 2, WORLD.groundY, sheepTextureKey(skinId));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDisplaySize(PLAYER.displayWidth, PLAYER.displayHeight);
    this.setDepth(8);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setBounce(0);
    this.syncBodySize();
    this.motionState = "RUNNING";
  }

  get grounded(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down || this.y >= WORLD.groundY - 0.5;
  }

  applyJump(kind: JumpKind): boolean {
    if (this.motionState === "HIT" || this.motionState === "DEAD") return false;
    this.setCrouching(false);
    const impulse = (kind === "high" ? PLAYER.highJumpVelocityY : PLAYER.jumpVelocityY) * this.jumpImpulseMultiplier;
    (this.body as Phaser.Physics.Arcade.Body).setVelocityY(
      kind === "high" ? Math.max(impulse, -PLAYER.maxHighJumpSpeed) : impulse,
    );
    this.motionState = "JUMPING";
    return true;
  }

  setCrouching(active: boolean): void {
    const crouching = active && this.grounded && !this.dashing && this.motionState !== "HIT" && this.motionState !== "DEAD";
    if (crouching === this.crouching) return;
    this.crouching = crouching;
    this.setDisplaySize(PLAYER.displayWidth, this.crouching ? PLAYER.crouchDisplayHeight : PLAYER.displayHeight);
    this.syncBodySize();
  }

  setDashing(active: boolean): void {
    if (this.motionState === "HIT" || this.motionState === "DEAD") return;
    this.dashing = active;
    if (active) {
      this.setCrouching(false);
      this.motionState = "DASH";
    } else if (this.motionState === "DASH") {
      this.motionState = this.grounded ? "RUNNING" : "FALLING";
    }
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.motionState !== "HIT" && this.motionState !== "DEAD") {
      if (this.dashing) this.motionState = "DASH";
      else if (this.grounded) this.motionState = "RUNNING";
      else if ((this.body as Phaser.Physics.Arcade.Body).velocity.y < 0) this.motionState = "JUMPING";
      else this.motionState = "FALLING";
    }
    const animation = sheepAnimationForState(this.motionState, this.skinId);
    if (this.anims.currentAnim?.key !== animation) this.play(animation, true);
  }

  private syncBodySize(): void {
    const logicalHeight = this.crouching ? PLAYER.crouchBodyHeight : PLAYER.height - 8;
    syncSheepArcadeBody(this.body as Phaser.Physics.Arcade.Body, {
      frameWidth: this.frame.width,
      frameHeight: this.frame.height,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      logicalWidth: PLAYER.width,
      logicalHeight,
    });
  }
}
