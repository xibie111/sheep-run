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
import { deliveryPanoramaOffset, deliveryRoadOffset } from './DeliveryScrolling';
import { WINDMILL_MEADOW_ART } from './windmillMeadowAssets';
import { WindmillMeadowView } from './WindmillMeadowView';
import { residentStageForChapter } from '../residents/ResidentCatalog';
import { RESIDENT_NPC_ART } from '../residents/residentAssets';
import type { ResidentNpc } from './ResidentRoutes';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Route art, satchel and story companion have no physics, input or rewards. */
export class DeliveryView {
  private readonly landscapes: { image: Phaser.GameObjects.Image; road: Phaser.GameObjects.TileSprite;
    left: Phaser.GameObjects.Image; right: Phaser.GameObjects.Image }[] = [];
  private readonly bag: Phaser.GameObjects.Graphics;
  private readonly lunchbox?: Phaser.GameObjects.Image;
  private readonly chapter: DeliveryChapter;
  private readonly envelope: Phaser.GameObjects.Graphics;
  private readonly mailbox: Phaser.GameObjects.Image;
  private companion?: CompanionView;
  private metFriend = false;
  private endingFriend?: CompanionView;
  private endingLead?: Phaser.GameObjects.Sprite;
  private readonly residentActors: Phaser.GameObjects.Image[] = [];
  private readonly residentRecipient?: ResidentNpc;
  private readonly photoFlash?: Phaser.GameObjects.Rectangle;
  private readonly endingMatte: Phaser.GameObjects.Rectangle;
  private readonly endingArt: Phaser.GameObjects.Image;
  private stopLayout: () => void;
  private disposed = false;
  private distance = 0;
  private readonly windmillMeadow?: WindmillMeadowView;
  constructor(private readonly scene: Phaser.Scene, private readonly lead: Sheep, private readonly skin: SkinId, private readonly reducedMotion: boolean, chapterId?: string) {
    this.chapter = getDeliveryChapter(chapterId) ?? defaultDeliveryChapter();
    const resident = residentStageForChapter(this.chapter.id)?.resident.id;
    this.residentRecipient = this.chapter.residentEnding?.recipient
      ?? (resident === 'windmill-keeper-v1' ? 'ahe' : resident === 'riverside-neighbor-v1' ? 'xiaomu'
        : resident === 'lighthouse-keeper-v1' ? 'adeng' : undefined);
    for (const { key } of this.chapter.landscapes) {
      const renderKey = key === 'delivery-expansion-windmill-destination' ? WINDMILL_MEADOW_ART.backdrop.key : key;
      const texture = scene.textures.get(renderKey), source = texture.getSourceImage() as HTMLImageElement;
      const edge = Math.round(source.height * this.roadCropRatio);
      if (!texture.has('road')) texture.add('road', 0, 0, edge, source.width, source.height - edge);
      const edgeWidth = Math.ceil(source.width / 8), leftFrame = `delivery-left-${edge}`, rightFrame = `delivery-right-${edge}`;
      if (!texture.has(leftFrame)) texture.add(leftFrame, 0, 0, 0, edgeWidth, edge);
      if (!texture.has(rightFrame)) texture.add(rightFrame, 0, source.width - edgeWidth, 0, edgeWidth, edge);
      const image = scene.add.image(0, 0, renderKey, '__BASE').setOrigin(.5, 0).setDepth(-9.5).setCrop(0, 0, source.width, edge).setAlpha(0)
        .setName(`delivery-landscape:${key}`);
      const left = scene.add.image(0, 0, renderKey, leftFrame).setSize(edgeWidth, edge).setOrigin(1, 0).setFlipX(true).setDepth(-9.5).setAlpha(0)
        .setName(`delivery-landscape-edge-left:${key}`);
      const right = scene.add.image(0, 0, renderKey, rightFrame).setSize(edgeWidth, edge).setOrigin(0, 0).setFlipX(true).setDepth(-9.5).setAlpha(0)
        .setName(`delivery-landscape-edge-right:${key}`);
      const road = scene.add.tileSprite(0, 0, WORLD.width, 60, renderKey, 'road').setOrigin(0).setScrollFactor(0).setDepth(-9.4).setAlpha(0)
        .setName(`delivery-road:${key}`);
      this.landscapes.push({ image, road, left, right });
    }
    if (this.chapter.id === 'windmill-invitation-v1') {
      this.windmillMeadow = new WindmillMeadowView(scene, this.chapter.length, lead.x, reducedMotion);
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
      this.lunchbox = scene.add.image(0, 0, this.chapter.accessoryKey).setDepth(8.2)
        .setName(this.chapter.endingKind === 'dinner' ? 'delivery-dinner-lunchbox' : 'delivery-carried-item');
      this.lunchbox.setScale(this.chapter.endingKind === 'dinner' ? 18 / this.lunchbox.width
        : Math.min(20 / this.lunchbox.width, 18 / this.lunchbox.height));
    }
    this.mailbox = scene.add.image(600, WORLD.groundY, MAILBOX_ART.key).setOrigin(.5, 1).setDisplaySize(28, 58).setDepth(5.7).setName('delivery-destination').setVisible(false);
    this.envelope = scene.add.graphics().setDepth(9).setName('delivery-envelope').setVisible(false);
    this.envelope.fillStyle(0x5c4030).fillRect(-7, -5, 14, 10);
    this.envelope.fillStyle(0xffedcd).fillRect(-6, -4, 12, 8);
    this.envelope.fillStyle(0xc28b52).fillRect(-4, -3, 2, 1).fillRect(-2, -2, 2, 1).fillRect(0, -1, 2, 1).fillRect(2, -2, 2, 1).fillRect(4, -3, 1, 1);
    this.endingMatte = scene.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x122b50).setOrigin(0).setScrollFactor(0).setDepth(19).setAlpha(0);
    this.endingArt = scene.add.image(0, 0, this.chapter.endingKey).setScrollFactor(0).setDepth(20).setAlpha(0)
      .setName(this.chapter.endingKind === 'dinner' ? 'delivery-sharing-dinner'
        : this.chapter.endingKind === 'goodnight' ? 'delivery-stargazing' : `delivery-ending-${this.chapter.endingKind}`);
    if (this.chapter.residentEnding?.moment === 'photo') {
      // Camera flash is an effective-time visual effect; all illustrated content is generated art.
      this.photoFlash = scene.add.rectangle(0, 0, WORLD.width, WORLD.height, 0xfff7dc)
        .setOrigin(0).setScrollFactor(0).setDepth(21).setAlpha(0).setName('resident-photo-flash');
    }
    this.stopLayout = watchViewport(scene, size => {
      const origin = runViewportOrigin(size);
      for (const { image, road, left, right } of this.landscapes) {
        const source = image.texture.getSourceImage() as HTMLImageElement, edge = Math.round(source.height * this.roadCropRatio);
        const bottomScale = Math.max(1, size.height - 213 - origin.y) / (source.height - edge);
        const scale = Math.max((213 + origin.y) / edge, size.width / source.width, this.chapter.challenge ? bottomScale : 0);
        const roadScale = Math.max(scale, bottomScale);
        image.setScale(scale);
        image.setPosition(size.width / 2 - origin.x, 213 - edge * scale);
        left.setScale(scale); right.setScale(scale);
        road.setPosition(0, 213 + origin.y).setSize(size.width, Math.max(1, size.height - 213 - origin.y));
        road.tileScaleX = roadScale; road.tileScaleY = roadScale;
      }
      this.scrollLandscapes();
      const art = this.endingArt.texture.getSourceImage() as HTMLImageElement;
      this.endingMatte.setSize(size.width, size.height);
      this.photoFlash?.setSize(size.width, size.height);
      this.endingArt.setPosition(size.width / 2, size.height / 2).setScale(Math.min(size.width / art.width, size.height / art.height));
    });
  }
  private get roadCropRatio() { return this.chapter.roadCropRatio ?? (this.chapter.endingKind === 'dinner' ? .72 : .75); }
  private scrollLandscapes(): void {
    const size = viewportSizeFromScale(this.scene.scale), origin = runViewportOrigin(size);
    this.landscapes.forEach(({ image, road, left, right }, index) => {
      const layer = this.chapter.landscapes[index], next = this.chapter.landscapes[index + 1];
      const available = Math.max(0, (image.displayWidth - size.width) / 2);
      const focused = (layer.focus === 'right' || !next) && layer.key !== 'delivery-expansion-windmill-destination';
      const offset = deliveryPanoramaOffset(this.distance, layer.transitionStart, next?.transitionEnd ?? this.chapter.length,
        available, size.width, image.displayWidth, focused, this.reducedMotion);
      image.x = size.width / 2 - origin.x + offset;
      left.setPosition(image.x - image.displayWidth / 2, image.y);
      right.setPosition(image.x + image.displayWidth / 2, image.y);
      const source = image.texture.getSourceImage() as HTMLImageElement;
      road.tilePositionX = deliveryRoadOffset(this.distance, origin.x, road.tileScaleX, source.width, this.reducedMotion);
    });
  }
  update(route: DeliveryRoute, nowMs: number) {
    if (this.disposed) return;
    this.distance = route.distance;
    const size = viewportSizeFromScale(this.scene.scale), origin = runViewportOrigin(size);
    const weights = this.chapter.landscapes.map(layer => layer.transitionEnd === layer.transitionStart ? 1 : clamp((route.distance - layer.transitionStart) / (layer.transitionEnd - layer.transitionStart)));
    this.landscapes.forEach(({ image, road, left, right }, i) => {
      image.setAlpha(weights[i]); road.setAlpha(weights[i]);
      left.setAlpha(weights[i]); right.setAlpha(weights[i]);
    });
    this.scrollLandscapes();
    this.windmillMeadow?.update(route.distance, weights[weights.length - 1]!);
    this.bag.setPosition(this.lead.x - 9, this.lead.y - this.lead.displayHeight * .43).setScale(1, this.lead.displayHeight / 42);
    this.lunchbox?.setPosition(this.lead.x - 9, this.lead.y - this.lead.displayHeight * .43);
    if (!this.metFriend && route.distance >= this.chapter.companionAt && route.state === 'running') {
      this.metFriend = true; this.companion = new CompanionView(this.scene, 'white', nowMs, this.reducedMotion);
    }
    if (this.companion?.update(nowMs, this.lead, -origin.x)) this.companion = undefined;
    if (this.chapter.endingKind !== 'dinner' && route.distance >= this.chapter.destinationAt) this.mailbox.setVisible(true).setX(this.lead.x + 78 + this.chapter.length - route.distance);
    if (route.state === 'ending' || route.state === 'complete') {
      if (!this.endingLead) {
        this.companion?.destroy(); this.companion = undefined;
        this.lead.setVisible(false); this.bag.setVisible(false);
        this.endingLead = this.scene.add.sprite(this.lead.x, WORLD.groundY, sheepTextureKey(this.skin)).setOrigin(.5, 1).setDisplaySize(48, 42).setDepth(8).setName('delivery-ending-lead');
        this.endingLead.play(sheepAnimationForState('IDLE', this.skin));
        if (this.residentRecipient) {
          const people = [this.residentRecipient, ...(this.chapter.residentEnding?.guests ?? [])];
          for (const [index, person] of people.entries()) {
            // Resident clothing/poses are separate generated art, never a playable or bought skin.
            const actor = this.scene.add.image(this.lead.x + 92 + index * 48, WORLD.groundY, RESIDENT_NPC_ART[person])
              .setOrigin(.5, 1).setDepth(8).setName(`resident-ending-npc:${person}`);
            actor.setScale(48 / actor.height);
            this.residentActors.push(actor);
          }
        } else this.endingFriend = new CompanionView(this.scene, 'white', 0, this.reducedMotion);
      }
      // Keep the same friend beside the sheep; only the initial entrance progresses.
      this.endingFriend?.update(Math.min(route.endingMs, 8000), { x: this.lead.x, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: 'IDLE' }, -origin.x);
      const t = clamp(route.endingMs / 1300), x = this.lead.x + 78 * t, y = WORLD.groundY - 25 - 21 * t - (this.reducedMotion ? 0 : Math.sin(t * Math.PI) * 16);
      this.envelope.setVisible(this.chapter.endingKind === 'goodnight' && route.endingMs < 1300).setPosition(x, y).setAlpha(this.reducedMotion ? 1 - t : 1);
      // Dinner is set down between the sheep, then opens in the generated two-sheep illustration.
      if (this.chapter.endingKind === 'dinner') this.lunchbox?.setPosition(this.lead.x + 30 * t, WORLD.groundY - 9).setVisible(route.endingMs < 1700);
      else if (this.chapter.challenge) this.lunchbox?.setPosition(x, y).setVisible(route.endingMs < 1600)
        .setAlpha(this.reducedMotion ? 1 - t : 1);
      // After the envelope lands, hold the two-sheep stargazing illustration.
      // This is part of the scene's effective-time presentation, so pause freezes it.
      const reveal = this.reducedMotion ? Number(route.endingMs >= 1600) : clamp((route.endingMs - 1300) / 400);
      this.endingMatte.setAlpha(reveal); this.endingArt.setAlpha(reveal);
      // The invitation reaches the residents before the photograph is revealed.
      // Replaying an update or pausing cannot move this flash forward.
      const flashMs = route.endingMs - 1450;
      this.photoFlash?.setAlpha(this.reducedMotion || flashMs < 0 || flashMs > 220 ? 0 : (1 - flashMs / 220) * .75);
    }
  }
  stopCompanion() { this.companion?.destroy(); this.companion = undefined; }
  clear() {
    if (this.disposed) return; this.disposed = true;
    this.stopLayout(); this.companion?.destroy(); this.endingFriend?.destroy(); this.endingLead?.destroy();
    this.residentActors.forEach(actor => actor.destroy()); this.residentActors.length = 0;
    this.photoFlash?.destroy();
    this.windmillMeadow?.clear();
    this.bag.destroy(); this.envelope.destroy(); this.mailbox.destroy();
    this.lunchbox?.destroy();
    this.endingArt.destroy(); this.endingMatte.destroy();
    this.landscapes.forEach(({ image, road, left, right }) => { image.destroy(); road.destroy(); left.destroy(); right.destroy(); });
  }
}
