import type Phaser from "phaser";
import { WORLD } from "../game/Constants";
import { COMPANION_BELL_ART } from "./companionAssets";
import { COMPANION_RULES as RULES } from "./CompanionRules";
import type { Rect } from "./BellGap";

export class BellView {
  readonly image: Phaser.GameObjects.Image;
  private disposed = false;
  constructor(scene: Phaser.Scene, spawnX: number, private readonly reducedMotion: boolean) {
    this.image = scene.add.image(spawnX, WORLD.groundY - RULES.bellAboveGroundPx, COMPANION_BELL_ART.key)
      .setDisplaySize(RULES.bellWidth, RULES.bellHeight).setDepth(7.2).setName("companion-bell-pickup");
    this.image.setData("visual-only", true).setData("pickup", "companion-bell");
  }
  update(nowMs: number, deltaSeconds: number, speed: number): void {
    this.image.x -= speed * deltaSeconds;
    this.image.setAngle(this.reducedMotion ? 0 : Math.sin(nowMs / 160) * 5);
  }
  get bounds(): Rect {
    return { x: this.image.x - RULES.bellWidth / 2, y: this.image.y - RULES.bellHeight / 2, width: RULES.bellWidth, height: RULES.bellHeight };
  }
  destroy(): void { if (!this.disposed) { this.disposed = true; this.image.destroy(); } }
}
