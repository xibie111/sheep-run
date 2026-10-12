// Isolated QA page only; production game never imports this fixture.
import Phaser from 'phaser';
import { adaptiveViewportSize, watchCanvasRounding } from '../../src/game/Viewport';
import { DISPLAY_FONTS } from '../../src/ui/DisplayText';
import { MAILBOX_ASSETS } from '../../src/data/mailboxAssets';
import { CONTENT_V2_UI_ASSETS } from '../../src/content-v2/assetManifest';
import { DELIVERY_V2_ASSETS } from '../../src/delivery/DeliveryV2Assets';
import { DELIVERY_EXPANSION_UI_ASSETS } from '../../src/delivery/DeliveryExpansionUiAssets';
import { DELIVERY_EXPANSION_ASSETS } from '../../src/delivery/DeliveryExpansionAssets';
import { createDeliveryPanel, type DeliveryPanelMode } from './DeliveryPanelReadabilityDraft';
import { DELIVERY_CHAPTERS, DELIVERY_EXPANSION_TEXT } from '../../src/delivery/DeliveryChapters';
import { DeliveryChallengeRun } from '../../src/delivery/DeliveryChallengeRun';
import { deliveryStore } from '../../src/delivery/DeliveryStore';
import { deliveryChallengeStore } from '../../src/delivery/DeliveryChallengeStore';
import { DELIVERY_EXPANSION_UI_TEXT } from '../../src/delivery/DeliveryPanelModel';
import { acquireMenuModal, menuModalOwner } from '../../src/ui/MenuModal';
import { attachDeliveryHud } from '../../src/delivery/DeliveryHud';
import { createDeliveryRoute } from '../../src/delivery/DeliveryRoute';
import { RUN_HUD_ASSET } from '../../src/data/runHudAssets';

const parent = document.getElementById('ui-fixture')!, size = adaptiveViewportSize(innerWidth, innerHeight);
const oldAssets = ['forest', 'hill', 'postcard'].map(name => ({ key: `delivery-${name}-v1`, url: new URL(`../../assets/delivery-v1/runtime/${name}.png`, import.meta.url).href }));
class UiFixture extends Phaser.Scene {
  panel!: ReturnType<typeof createDeliveryPanel>; under!: Phaser.GameObjects.Container;
  starts: string[] = []; underClicks = 0; exits = 0; parentLease?: () => void;
  constructor() { super('DeliveryExpansionUiFixture'); }
  preload() {
    [...MAILBOX_ASSETS, ...CONTENT_V2_UI_ASSETS, ...DELIVERY_V2_ASSETS, ...oldAssets, ...DELIVERY_EXPANSION_ASSETS, ...DELIVERY_EXPANSION_UI_ASSETS, RUN_HUD_ASSET]
      .filter((asset, i, all) => all.findIndex(other => other.key === asset.key) === i).forEach(asset => this.load.image(asset.key, asset.url));
    Object.values(DISPLAY_FONTS).forEach(font => this.load.bitmapFont(font.key, font.image, font.data));
  }
  create() {
    [...DELIVERY_EXPANSION_ASSETS, ...DELIVERY_EXPANSION_UI_ASSETS].forEach(asset => this.textures.get(asset.key).setFilter(1));
    const bg = this.add.image(size.width / 2, size.height / 2, 'content-v2-delivery-dusk-pasture').setScrollFactor(0);
    const source = bg.texture.getSourceImage() as HTMLImageElement; bg.setScale(Math.max(size.width / source.width, size.height / source.height));
    this.under = this.add.container(48, 48).setName('fixture-under').setSize(44, 44).setInteractive(new Phaser.Geom.Rectangle(0, 0, 44, 44), Phaser.Geom.Rectangle.Contains);
    this.under.on('pointerup', () => this.underClicks++);
    this.parentLease = acquireMenuModal(this, 'mailbox', [this.under]);
    this.panel = createDeliveryPanel(this, { start: id => this.starts.push(id), exit: () => this.exits++ }, true);
    const font = this.cache.bitmapFont.get(DISPLAY_FONTS.body.key).data;
    const copy = [...DELIVERY_EXPANSION_UI_TEXT, ...DELIVERY_EXPANSION_TEXT, ...DELIVERY_CHAPTERS.flatMap(chapter => [chapter.title, ...chapter.introduction, chapter.itinerary, chapter.postcardTitle, chapter.postcardText, chapter.successText, chapter.failureTitle, chapter.failureText, chapter.startLabel]), '0123456789/ %·'];
    const missing = [...new Set(copy.join(''))].filter(char => !/\s/.test(char) && !font.chars[char.codePointAt(0)!]);
    Object.assign(window, { deliveryExpansionUi: this, deliveryExpansionUiReady: false, deliveryExpansionFontMissing: missing,
      deliveryExpansionExpectedAssets: [...DELIVERY_EXPANSION_ASSETS, ...DELIVERY_EXPANSION_UI_ASSETS].map(asset => ({ key: asset.key, width: asset.width, height: asset.height })),
      deliveryExpansionModalOwner: () => menuModalOwner(this) });
    if (missing.length) { Object.assign(window, { deliveryExpansionUiBlocked: 'bitmap-font-missing-glyphs' }); return; }
    this.panel.show('select');
    Object.assign(window, { deliveryExpansionUiReady: true });
  }
  result(id: string, ordinary: number, hidden: boolean, success: boolean) {
    const chapter = DELIVERY_CHAPTERS.find(item => item.id === id)!;
    if (!chapter.challenge) return undefined;
    const challenge = new DeliveryChallengeRun(chapter.challenge);
    chapter.challenge.stamps.filter(stamp => stamp.kind === 'ordinary').slice(0, ordinary).forEach(stamp => challenge.collect(stamp.id));
    if (hidden) challenge.collect(chapter.challenge.stamps.find(stamp => stamp.kind === 'keepsake')!.id);
    return challenge.finish(success);
  }
  show(mode: DeliveryPanelMode, id = this.panel.chapterId, ordinary = 0, hidden = false, saveFailed = false) {
    this.panel.close(); this.panel.show(mode, saveFailed, id, mode === 'success' || mode === 'failure' ? this.result(id, ordinary, hidden, mode === 'success') : undefined);
  }
  save(id: string, ordinary = 5, hidden = true) {
    const result = this.result(id, ordinary, hidden, true)!;
    deliveryStore.complete(id); return deliveryChallengeStore.recordResult(id, result);
  }
  showHud(id: string, ordinary: number, hidden: boolean) {
    this.panel.close(); this.parentLease?.(); this.parentLease = undefined;
    const route = createDeliveryRoute(id);
    route.chapter.challenge?.stamps.filter(stamp => stamp.kind === 'ordinary').slice(0, ordinary).forEach(stamp => route.challenge!.collect(stamp.id));
    if (hidden) route.challenge!.collect(route.chapter.challenge!.stamps.find(stamp => stamp.kind === 'keepsake')!.id);
    route.distance = 12000;
    const pause = this.add.container(0, 0).setName('fixture-pause').setSize(48, 36).setInteractive(new Phaser.Geom.Rectangle(0, 0, 48, 36), Phaser.Geom.Rectangle.Contains);
    attachDeliveryHud(this, route, pause);
    Object.assign(window, { deliveryExpansionHudRoute: route });
  }
  clearFixture() { this.panel.clear(); this.parentLease?.(); this.scene.stop(); }
}
const fixture = new UiFixture();
const game = new Phaser.Game({ type: Phaser.WEBGL, width: size.width, height: size.height, parent, backgroundColor: '#20303c', pixelArt: true,
  roundPixels: true, input: { activePointers: 3 }, scene: [fixture], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, autoRound: true } });
game.events.once('ready', () => watchCanvasRounding(game, parent));
Object.assign(window, { deliveryExpansionUiGame: game });
