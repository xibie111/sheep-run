import type Phaser from 'phaser';
import { ANIMAL_TEXTURE } from './animalAssets';
import { animalPoses } from './AnimalChoreography';
import type { AnimalEventId } from './AnimalRules';

/** Image objects only; no bodies, input targets, tweens, timers or scene listeners. */
export class AnimalView {
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  constructor(private readonly scene: Phaser.Scene, readonly kind: AnimalEventId, private readonly reducedMotion: boolean) {}
  update(elapsedMs: number, x: number, y: number, tint: number, exitAlpha = 1): void {
    for (const pose of animalPoses(this.kind, elapsedMs, this.reducedMotion)) {
      let image = this.images.get(pose.slot);
      if (!image) {
        image = this.scene.add.image(0, 0, ANIMAL_TEXTURE, pose.frame).setOrigin(.5, 1).setScale(pose.slot === 'squirrel' ? .18 : .25)
          .setDepth(-9.5).setName(`ambient-life:${pose.slot}`);
        this.images.set(pose.slot, image);
      }
      image.setFrame(pose.frame).setPosition(Math.round(x + pose.x), Math.round(y + pose.y))
        .setAlpha(pose.alpha * exitAlpha).setTint(tint).setFlipX(pose.flipX ?? false);
    }
  }
  get objectCount(): number { return this.images.size; }
  destroy(): void { for (const image of this.images.values()) image.destroy(); this.images.clear(); }
}
