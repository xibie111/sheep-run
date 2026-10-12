// Standalone browser QA only. This file is never imported by production gameplay.
import Phaser from 'phaser';
import { adaptiveViewportSize, watchCanvasRounding, runViewportOrigin } from '../../src/game/Viewport';
import { DISPLAY_FONTS } from '../../src/ui/DisplayText';
import { MAILBOX_ASSETS } from '../../src/data/mailboxAssets';
import { CONTENT_V2_UI_ASSETS } from '../../src/content-v2/assetManifest';
import { DELIVERY_V2_ASSETS, prepareDeliveryV2Textures } from '../../src/delivery/DeliveryV2Assets';
import { createDeliveryPanel } from '../../src/delivery/DeliveryPanel';
import { DeliveryView } from '../../src/delivery/DeliveryView';
import { createDeliveryRoute } from '../../src/delivery/DeliveryRoute';
import { DELIVERY_V2_TEXT } from '../../src/delivery/DeliveryChapters';
import { DELIVERY_STORAGE_KEY, deliveryStore } from '../../src/delivery/DeliveryStore';
import { acquireMenuModal, menuModalOwner } from '../../src/ui/MenuModal';
import type { Sheep } from '../../src/entities/Sheep';
import { WORLD } from '../../src/game/Constants';
import { COMPANION_BELL_ART } from '../../src/companions/companionAssets';
import { COMPANION_RESPONSE_KEYS } from '../../src/companions/CompanionResponses';
import { SKIN_ANIMATION_FRAMES } from '../../src/data/skinSpriteAssets';

const parent = document.getElementById('delivery-fixture')!, size = adaptiveViewportSize(innerWidth, innerHeight);
const qaParams = new URLSearchParams(location.search);
const qaFontImage = qaParams.get('fontImage'), qaFontData = qaParams.get('fontData');
const oldAssets = ['forest', 'hill', 'postcard'].map(name => ({ key: `delivery-${name}-v1`, url: new URL(`../../assets/delivery-v1/runtime/${name}.png`, import.meta.url).href }));
class DeliveryFixture extends Phaser.Scene {
  panel!: ReturnType<typeof createDeliveryPanel>;
  route = createDeliveryRoute('dinner-for-you-v1'); view?: DeliveryView;
  starts: string[] = []; under!: Phaser.GameObjects.Container; releaseParent?: () => void;
  lead?: Phaser.GameObjects.Sprite;
  constructor() { super('DeliveryFixture'); }
  preload() {
    [...MAILBOX_ASSETS, ...DELIVERY_V2_ASSETS, ...oldAssets, ...CONTENT_V2_UI_ASSETS].forEach(asset => this.load.image(asset.key, asset.url));
    Object.values(DISPLAY_FONTS).forEach(font => this.load.bitmapFont(font.key,
      font.key === DISPLAY_FONTS.body.key && qaFontImage?.startsWith('/') ? qaFontImage : font.image,
      font.key === DISPLAY_FONTS.body.key && qaFontData?.startsWith('/') ? qaFontData : font.data));
    this.load.spritesheet('sheep-runner', new URL('../../assets/skins/runtime-v1/white-sheet.png', import.meta.url).href, { frameWidth: 128, frameHeight: 128, endFrame: 14 });
    this.load.image(COMPANION_BELL_ART.key, COMPANION_BELL_ART.url);
    // Responses stay hidden in this fixture; source is existing generated bell solely to satisfy CompanionView's texture dependency.
    Object.values(COMPANION_RESPONSE_KEYS).forEach(key => this.load.image(key, COMPANION_BELL_ART.url));
  }
  create() {
    prepareDeliveryV2Textures(this);
    const origin = runViewportOrigin(size); this.cameras.main.setScroll(-origin.x, -origin.y);
    // Same frame crops as production; only white is loaded here.
    const sheet = this.textures.get('sheep-runner');
    for (let i = 0; i < 15; i++) sheet.get(i).setSize(128, 112, (i % 5) * 128, Math.floor(i / 5) * 128 + 16);
    for (const [name, frames] of Object.entries(SKIN_ANIMATION_FRAMES)) this.anims.create({ key: `sheep-${name}`, frames: frames.map(frame => ({ key: 'sheep-runner', frame })), frameRate: 8, repeat: name === 'idle' || name === 'run' ? -1 : 0 });
    const bg = this.add.image(size.width / 2, size.height / 2, 'content-v2-delivery-dusk-pasture').setDepth(-20).setScrollFactor(0);
    const image = bg.texture.getSourceImage() as HTMLImageElement; bg.setScale(Math.max(size.width / image.width, size.height / image.height));
    this.under = this.add.container(50, 50).setSize(44, 44).setInteractive(new Phaser.Geom.Rectangle(0, 0, 44, 44), Phaser.Geom.Rectangle.Contains);
    this.releaseParent = acquireMenuModal(this, 'mailbox', [this.under]);
    this.panel = createDeliveryPanel(this, { start: id => this.starts.push(id) }, true);
    const font = this.cache.bitmapFont.get(DISPLAY_FONTS.body.key).data;
    const missing = [...new Set(DELIVERY_V2_TEXT.join(''))].filter(char => !/\s/.test(char) && !font.chars[char.codePointAt(0)!]);
    Object.assign(window, { deliveryFixture: this, deliveryFixtureReady: true, deliveryFontMissing: missing, deliveryModalOwner: () => menuModalOwner(this) });
    this.panel.show('select');
  }
  show(mode: 'select' | 'brief' | 'postcard' | 'success' | 'failure', id = 'dinner-for-you-v1', saveFailed = false) { this.panel.close(); this.panel.show(mode, saveFailed, id); }
  unlock(id = 'dinner-for-you-v1') { deliveryStore.complete(id); this.show('select', id); }
  showRoute(distance: number, endingMs = 0, reduced = false) {
    this.panel.close(); this.view?.clear(); this.lead?.destroy(); this.route = createDeliveryRoute('dinner-for-you-v1');
    // Cosmetic lead fixture, no Arcade physics or production input/score writes.
    this.lead = this.add.sprite(160, WORLD.groundY, 'sheep-runner', 0).setDisplaySize(48, 42).setOrigin(.5, 1);
    const lead = this.lead as unknown as Sheep;
    lead.motionState = 'IDLE'; this.route.distance = distance;
    if (endingMs) { this.route.state = 'ending'; this.route.endingMs = endingMs; }
    this.view = new DeliveryView(this, lead, 'white', reduced, this.route.chapter.id); this.view.update(this.route, 0);
  }
  clearFixture() { this.panel.clear(); this.view?.clear(); this.lead?.destroy(); this.releaseParent?.(); this.scene.stop(); }
}
const fixture = new DeliveryFixture();
const game = new Phaser.Game({ type: Phaser.CANVAS, width: size.width, height: size.height, parent, backgroundColor: '#20303c',
  pixelArt: true, roundPixels: true, input: { activePointers: 3 }, scene: [fixture],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, autoRound: true },
});
game.events.once('ready', () => watchCanvasRounding(game, parent));
Object.assign(window, { deliveryGame: game, deliveryStoreKey: DELIVERY_STORAGE_KEY });
