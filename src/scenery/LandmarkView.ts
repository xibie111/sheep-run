import type Phaser from 'phaser';
import type { ViewportSize } from '../game/Viewport';
import { runViewportOrigin, runViewportRight } from '../game/Viewport';
import type { LandmarkDefinition } from './landmarkCatalog';

export interface LandmarkPlacement { x: number; alpha: number; tint: number; viewport: ViewportSize; }
export interface LandmarkViewPort {
  place(state: LandmarkPlacement): void;
  /** A previous actual renderer pass, not merely sprite creation or placement. */
  consumeRendered(): boolean;
  destroy(): void;
}
export class LandmarkView implements LandmarkViewPort {
  private readonly image: Phaser.GameObjects.Image;
  private effective = false;
  private rendered = false;
  private destroyed = false;
  private readonly afterRender = (): void => {
    const rect = this.scene.game.canvas.getBoundingClientRect();
    this.rendered = this.effective && this.scene.scene.isActive() && this.scene.scene.isVisible()
      && !this.scene.scene.isPaused() && this.image.visible && this.image.active
      && rect.width > 0 && rect.height > 0 && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
  };
  constructor(private readonly scene: Phaser.Scene, private readonly definition: LandmarkDefinition) {
    this.image = scene.add.image(0, 0, definition.key, '__BASE').setOrigin(.5, 1).setScale(.5)
      .setDepth(definition.depth).setName(`landmark:${definition.id}`);
    scene.game.events.on('postrender', this.afterRender);
  }
  place(state: LandmarkPlacement): void {
    if (this.destroyed) return;
    const { width, height, bottom } = this.definition;
    const origin = runViewportOrigin(state.viewport), left = -origin.x, right = runViewportRight(state.viewport);
    const x = Math.round(state.x), y = bottom;
    this.image.setPosition(x, y).setAlpha(state.alpha).setTint(state.tint);
    // Keep all artwork in the pasture above y207; tall viewports reveal sky/soil,
    // rather than moving this physical-world anchor with the viewport centre.
    const clippedWidth = Math.max(0, Math.min(x + width / 2, right - 4) - Math.max(x - width / 2, left + 4));
    this.effective = clippedWidth / width >= .9 && y - height >= -origin.y + 70 && y < 207 && state.alpha >= .8;
  }
  consumeRendered(): boolean { const result = this.rendered; this.rendered = false; return result; }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.game.events.off('postrender', this.afterRender);
    this.image.destroy(); this.effective = this.rendered = false;
  }
}
