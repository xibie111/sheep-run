import type Phaser from 'phaser';
import { WORLD } from '../game/Constants';
import { runViewportOrigin, viewportSizeFromScale, watchViewport } from '../game/Viewport';
import { WINDMILL_MEADOW_ART } from './windmillMeadowAssets';
import { windmillMeadowGrassOffset, windmillMeadowLandmarkX } from './WindmillMeadowMotion';

/** Grounded scenery is independent of the distant painting, without physics or input. */
export class WindmillMeadowView {
  private readonly landmark: Phaser.GameObjects.Image;
  private readonly grass: Phaser.GameObjects.TileSprite;
  private readonly stopLayout: () => void;
  private distance = 0;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly length: number,
    private readonly playerX: number, private readonly reducedMotion: boolean) {
    this.landmark = scene.add.image(0, WORLD.groundY, WINDMILL_MEADOW_ART.landmark.key)
      .setOrigin(.5, 1).setDepth(-9.3).setAlpha(0).setName('delivery-windmill-grounded');
    // Uniform scale, full sails, no frame-dependent zoom or tower stretching.
    this.landmark.setScale(160 / this.landmark.height);
    this.grass = scene.add.tileSprite(0, 0, WORLD.width, 64, WINDMILL_MEADOW_ART.grass.key)
      .setOrigin(0).setScrollFactor(0).setDepth(-9.2).setAlpha(0).setName('delivery-windmill-near-grass');
    this.grass.tileScaleX = .5; this.grass.tileScaleY = .5;
    this.stopLayout = watchViewport(scene, () => this.layout());
  }

  private layout(): void {
    const size = viewportSizeFromScale(this.scene.scale), origin = runViewportOrigin(size);
    this.grass.setPosition(0, WORLD.groundY + origin.y - 64).setSize(size.width, 64);
    const source = this.grass.texture.getSourceImage() as HTMLImageElement;
    this.grass.tilePositionX = windmillMeadowGrassOffset(this.distance, origin.x,
      this.grass.tileScaleX, source.width, this.reducedMotion);
    // Even with reduced motion a grounded building must travel with the world
    // and the actual mailbox, rather than remaining attached to the screen.
    this.landmark.setX(windmillMeadowLandmarkX(this.distance, this.length, this.playerX));
  }

  update(distance: number, alpha: number): void {
    if (this.disposed) return;
    this.distance = distance;
    this.landmark.setAlpha(alpha); this.grass.setAlpha(alpha);
    this.layout();
  }

  clear(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLayout(); this.landmark.destroy(); this.grass.destroy();
  }
}
