import type Phaser from 'phaser';
import { WORLD } from '../game/Constants';
import { runViewportOrigin, viewportSizeFromScale } from '../game/Viewport';
import { DeliveryChallengeRun, type DeliveryChallengeDefinition } from './DeliveryChallengeRun';

interface BodyPort { x: number; y: number; width: number; height: number }
export interface DeliveryStampRoutePort {
  readonly chapter: { readonly challenge?: DeliveryChallengeDefinition };
  readonly challenge?: DeliveryChallengeRun;
  distance: number;
  state: 'running' | 'ending' | 'complete' | 'failed';
}

/** Six chapter-owned visual pickups. No Arcade groups, star pool, RNG or rewards. */
export class DeliveryStampController {
  private readonly objects: { id: string; at: number; y: number; image: Phaser.GameObjects.Image; width: number; height: number }[] = [];
  private disposed = false;
  constructor(private readonly scene: Phaser.Scene, private readonly lead: {body: unknown}, private readonly route: DeliveryStampRoutePort) {
    const definition = route.chapter.challenge;
    if (!definition || !route.challenge) return;
    for (const stamp of definition.stamps) {
      if (!scene.textures.exists(stamp.key)) throw new Error(`Delivery postage missing: ${stamp.key}`);
      const size = stamp.kind === 'ordinary' ? 20 : 22;
      const source = scene.textures.get(stamp.key).getSourceImage() as HTMLImageElement;
      const scale = Math.min(size / source.width, size / source.height);
      const image = scene.add.image(WORLD.width + 18 + stamp.at, stamp.y, stamp.key)
        .setScale(scale).setDepth(8.5).setName(`delivery-postage:${stamp.id}`).setVisible(false);
      this.objects.push({id:stamp.id, at:stamp.at, y:stamp.y, image, width:source.width * scale, height:source.height * scale});
    }
  }
  update(): void {
    if (this.disposed || this.scene.scene.isPaused()) return;
    const running = this.route.state === 'running', size = viewportSizeFromScale(this.scene.scale);
    const left = -runViewportOrigin(size).x, body = this.lead.body as BodyPort | undefined;
    for (const object of this.objects) {
      const x = WORLD.width + 18 + object.at - this.route.distance;
      const visible = running && !this.route.challenge?.isCollected(object.id) && x + object.width / 2 >= left && x - object.width / 2 <= WORLD.width;
      object.image.setPosition(x, object.y).setVisible(visible);
      if (!visible || !body || !Number.isFinite(body.x) || !Number.isFinite(body.y)) continue;
      const overlaps = body.x < x + object.width / 2 && body.x + body.width > x - object.width / 2 &&
        body.y < object.y + object.height / 2 && body.y + body.height > object.y - object.height / 2;
      if (overlaps && this.route.challenge?.collect(object.id)) object.image.setVisible(false);
    }
  }
  clear(): void { if (this.disposed) return; this.disposed = true; this.objects.forEach(object => object.image.destroy()); this.objects.length = 0; }
}
