import type Phaser from 'phaser';
import type { Sheep } from '../entities/Sheep';
import { sheepTextureKey, type SkinId } from '../data/sheepSkins';
import { sheepAnimationForState } from '../entities/SheepAnimation';
import { runViewportOrigin, viewportSizeFromScale, watchViewport } from '../game/Viewport';
import { WORLD } from '../game/Constants';
import { MAILBOX_ART } from '../data/mailboxAssets';
import { CompanionView } from '../companions/CompanionView';
import type { DeliveryRoute } from './DeliveryRoute';
import { defaultDeliveryChapter, getDeliveryChapter, type DeliveryChapter } from './DeliveryChapters';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Route art, satchel and story companion have no physics, input or rewards. */
export class DeliveryView {
  private readonly landscapes: { image: Phaser.GameObjects.Image; road: Phaser.GameObjects.TileSprite }[] = [];
  private readonly bag: Phaser.GameObjects.Graphics;
  private readonly lunchbox?: Phaser.GameObjects.Image;
  private readonly chapter: DeliveryChapter;
  private readonly envelope: Phaser.GameObjects.Graphics;
  private readonly mailbox: Phaser.GameObjects.Image;
  private companion?: CompanionView;
  private metFriend = false;
  private endingFriend?: CompanionView;
  private endingLead?: Phaser.GameObjects.Sprite;
  private readonly endingMatte: Phaser.GameObjects.Rectangle;
  private readonly endingArt: Phaser.GameObjects.Image;
  private stopLayout: () => void;
  private disposed = false;
  constructor(private readonly scene: Phaser.Scene, private readonly lead: Sheep, private readonly skin: SkinId, private readonly reducedMotion: boolean, chapterId?: string) {
    this.chapter = getDeliveryChapter(chapterId) ?? defaultDeliveryChapter();
    for (const { key } of this.chapter.landscapes) {
      const texture = scene.textures.get(key), source = texture.getSourceImage() as HTMLImageElement;
      const edge = Math.round(source.height * (this.chapter.endingKind === 'dinner' ? .72 : .75));
      if (!texture.has('road')) texture.add('road', 0, 0, edge, source.width, source.height - edge);
      const image = scene.add.image(0, 0, key, '__BASE').setOrigin(.5, 0).setDepth(-9.5).setCrop(0, 0, source.width, edge).setAlpha(0);
      const road = scene.add.tileSprite(0, 0, WORLD.width, 60, key, 'road').setOrigin(0).setScrollFactor(0).setDepth(-9.4).setAlpha(0);
      this.landscapes.push({ image, road });
    }
    this.bag = scene.add.graphics().setDepth(8.2).setName('delivery-mailbag');
    // A small code-native pixel accessory; never changes the skin atlas.
    this.bag.fillStyle(0x563827).fillRect(-7, -6, 15, 13).fillRect(0, -13, 2, 13);
    this.bag.fillStyle(0xbb7c43).fillRect(-6, -5, 13, 10);
    this.bag.fillStyle(0xf0c574).fillRect(-5, -5, 11, 4);
    this.bag.fillStyle(0xffedc5).fillRect(-4, -8, 8, 4);
    this.bag.fillStyle(0x79512d).fillRect(-1, -1, 3, 3);
    if (this.chapter.accessoryKey) {
      this.bag.setVisible(false);
      this.lunchbox = scene.add.image(0, 0, this.chapter.accessoryKey).setDepth(8.2).setName('delivery-dinner-lunchbox');
      this.lunchbox.setScale(18 / this.lunchbox.width);
    }
    this.mailbox = scene.add.image(600, WORLD.groundY, MAILBOX_ART.key).setOrigin(.5, 1).setDisplaySize(28, 58).setDepth(5.7).setName('delivery-destination').setVisible(false);
    this.envelope = scene.add.graphics().setDepth(9).setName('delivery-envelope').setVisible(false);
    this.envelope.fillStyle(0x5c4030).fillRect(-7, -5, 14, 10);
    this.envelope.fillStyle(0xffedcd).fillRect(-6, -4, 12, 8);
    this.envelope.fillStyle(0xc28b52).fillRect(-4, -3, 2, 1).fillRect(-2, -2, 2, 1).fillRect(0, -1, 2, 1).fillRect(2, -2, 2, 1).fillRect(4, -3, 1, 1);
    this.endingMatte = scene.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x122b50).setOrigin(0).setScrollFactor(0).setDepth(19).setAlpha(0);
    this.endingArt = scene.add.image(0, 0, this.chapter.endingKey).setScrollFactor(0).setDepth(20).setAlpha(0).setName(this.chapter.endingKind === 'dinner' ? 'delivery-sharing-dinner' : 'delivery-stargazing');
    this.stopLayout = watchViewport(scene, size => {
      const origin = runViewportOrigin(size);
      for (const { image, road } of this.landscapes) {
        const source = image.texture.getSourceImage() as HTMLImageElement, edge = Math.round(source.height * (this.chapter.endingKind === 'dinner' ? .72 : .75));
        const scale = Math.max((213 + origin.y) / edge, size.width / source.width);
        image.setPosition(size.width / 2 - origin.x, 213 - edge * scale).setScale(scale);
        road.setPosition(0, 213 + origin.y).setSize(size.width, Math.max(1, size.height - 213 - origin.y));
        road.tileScaleX = scale; road.tileScaleY = scale;
      }
      const art = this.endingArt.texture.getSourceImage() as HTMLImageElement;
      this.endingMatte.setSize(size.width, size.height);
      this.endingArt.setPosition(size.width / 2, size.height / 2).setScale(Math.min(size.width / art.width, size.height / art.height));
    });
  }
  update(route: DeliveryRoute, nowMs: number) {
    if (this.disposed) return;
    const size = viewportSizeFromScale(this.scene.scale), origin = runViewportOrigin(size);
    const weights = this.chapter.landscapes.map(layer => layer.transitionEnd === layer.transitionStart ? 1 : clamp((route.distance - layer.transitionStart) / (layer.transitionEnd - layer.transitionStart)));
    this.landscapes.forEach(({ image, road }, i) => {
      image.setAlpha(weights[i]); road.setAlpha(weights[i]);
      // The wide upper illustration never tiles, so it cannot expose a join.
      const available = Math.max(0, (image.displayWidth - size.width) / 2);
      image.x = size.width / 2 - origin.x + (this.reducedMotion ? 0 : Math.min(available, 45) * (1 - 2 * clamp((route.distance - this.chapter.landscapes[i].transitionStart) / 6500)));
      road.tilePositionX = this.reducedMotion ? 0 : route.distance;
    });
    this.bag.setPosition(this.lead.x - 9, this.lead.y - this.lead.displayHeight * .43).setScale(1, this.lead.displayHeight / 42);
    this.lunchbox?.setPosition(this.lead.x - 9, this.lead.y - this.lead.displayHeight * .43);
    if (!this.metFriend && route.distance >= this.chapter.companionAt && route.state === 'running') {
      this.metFriend = true; this.companion = new CompanionView(this.scene, 'white', nowMs, this.reducedMotion);
    }
    if (this.companion?.update(nowMs, this.lead, -origin.x)) this.companion = undefined;
    if (this.chapter.endingKind === 'goodnight' && route.distance >= this.chapter.destinationAt) this.mailbox.setVisible(true).setX(this.lead.x + 78 + this.chapter.length - route.distance);
    if (route.state === 'ending' || route.state === 'complete') {
      if (!this.endingLead) {
        this.companion?.destroy(); this.companion = undefined;
        this.lead.setVisible(false); this.bag.setVisible(false);
        this.endingLead = this.scene.add.sprite(this.lead.x, WORLD.groundY, sheepTextureKey(this.skin)).setOrigin(.5, 1).setDisplaySize(48, 42).setDepth(8).setName('delivery-ending-lead');
        this.endingLead.play(sheepAnimationForState('IDLE', this.skin));
        this.endingFriend = new CompanionView(this.scene, 'white', 0, this.reducedMotion);
      }
      // Keep the same friend beside the sheep; only the initial entrance progresses.
      this.endingFriend?.update(Math.min(route.endingMs, 8000), { x: this.lead.x, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: 'IDLE' }, -origin.x);
      const t = clamp(route.endingMs / 1300), x = this.lead.x + 78 * t, y = WORLD.groundY - 25 - 21 * t - (this.reducedMotion ? 0 : Math.sin(t * Math.PI) * 16);
      this.envelope.setVisible(this.chapter.endingKind === 'goodnight' && route.endingMs < 1300).setPosition(x, y).setAlpha(this.reducedMotion ? 1 - t : 1);
      // Dinner is set down between the sheep, then opens in the generated two-sheep illustration.
      this.lunchbox?.setPosition(this.lead.x + 30 * t, WORLD.groundY - 9).setVisible(route.endingMs < 1700);
      // After the envelope lands, hold the two-sheep stargazing illustration.
      // This is part of the scene's effective-time presentation, so pause freezes it.
      const reveal = this.reducedMotion ? Number(route.endingMs >= 1600) : clamp((route.endingMs - 1300) / 400);
      this.endingMatte.setAlpha(reveal); this.endingArt.setAlpha(reveal);
    }
  }
  stopCompanion() { this.companion?.destroy(); this.companion = undefined; }
  clear() {
    if (this.disposed) return; this.disposed = true;
    this.stopLayout(); this.companion?.destroy(); this.endingFriend?.destroy(); this.endingLead?.destroy();
    this.bag.destroy(); this.envelope.destroy(); this.mailbox.destroy();
    this.lunchbox?.destroy();
    this.endingArt.destroy(); this.endingMatte.destroy();
    this.landscapes.forEach(({ image, road }) => { image.destroy(); road.destroy(); });
  }
}
