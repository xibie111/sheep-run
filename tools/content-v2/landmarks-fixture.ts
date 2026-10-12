/** Isolated acceptance fixture. Never imported by production entry points. */
import Phaser from 'phaser';
import { LandmarkController, type LandmarkUpdateContext } from '../../src/scenery/LandmarkController';
import { LandmarkView, type LandmarkPlacement, type LandmarkViewPort } from '../../src/scenery/LandmarkView';
import { LANDMARK_ASSETS, prepareLandmarkTextures } from '../../src/scenery/landmarkAssets';
import { LANDMARKS, type LandmarkEncounter } from '../../src/scenery/landmarkCatalog';
import { adaptiveViewportSize, runViewportOrigin } from '../../src/game/Viewport';
import { createPanoramaRepeat, createSceneryRepeat, sceneryExtension, createRoadFill } from '../../src/utils/SceneryRepeat';

const size = adaptiveViewportSize(innerWidth, innerHeight), origin = runViewportOrigin(size);
const encounters: LandmarkEncounter[] = [];
let distance = 0, paused = false, blocked = false, controller: LandmarkController, ctx: LandmarkUpdateContext;
let near: Phaser.GameObjects.TileSprite, far: Phaser.GameObjects.TileSprite, requested: number | null = null;
const placements: LandmarkPlacement[] = [];
class LandmarkFixture extends Phaser.Scene {
  constructor() { super('LandmarkFixture'); }
  preload() {
    for (const asset of LANDMARK_ASSETS) this.load.image(asset.key, asset.url);
    this.load.image('fixture-far-source', new URL('../../assets/seasons/seamless-v3/spring-far.png', import.meta.url).href);
    this.load.image('fixture-near-source', new URL('../../assets/seasons/generated-v1/spring-near.png', import.meta.url).href);
    this.load.image('fixture-extension-source', new URL('../../assets/seasons/extensions-v2/spring.png', import.meta.url).href);
  }
  create() {
    prepareLandmarkTextures(this);
    const farCanvas = createPanoramaRepeat(this.textures.get('fixture-far-source').getSourceImage() as HTMLImageElement);
    const nearCanvas = createSceneryRepeat(this.textures.get('fixture-near-source').getSourceImage() as HTMLImageElement,
      'near', sceneryExtension(this.textures.get('fixture-extension-source').getSourceImage() as HTMLImageElement, 'near', 3));
    this.textures.addCanvas('fixture-far', farCanvas)!.setFilter(0);
    this.textures.addCanvas('fixture-near', nearCanvas)!.setFilter(0);
    this.textures.addCanvas('fixture-soil', createRoadFill(nearCanvas))!.setFilter(0);
    const sky = document.createElement('canvas'); sky.width = sky.height = 1;
    sky.getContext('2d')!.drawImage(farCanvas, Math.floor(farCanvas.width / 2), 0, 1, 1, 0, 0, 1, 1);
    this.textures.addCanvas('fixture-sky', sky)!.setFilter(0);
    this.cameras.main.setScroll(-origin.x, -origin.y).setBackgroundColor(0x68c3ed);
    this.add.tileSprite(-origin.x, -origin.y, size.width, size.height, 'fixture-sky').setOrigin(0).setDepth(-21);
    far = this.add.tileSprite(-origin.x, 0, size.width, 270, 'fixture-far').setOrigin(0).setDepth(-20);
    near = this.add.tileSprite(-origin.x, 0, size.width, 270, 'fixture-near').setOrigin(0).setDepth(-12);
    this.add.tileSprite(-origin.x, 270, size.width, Math.max(1, size.height - 270), 'fixture-soil').setOrigin(0).setDepth(-13);
    controller = new LandmarkController(this, { onEncounter: event => encounters.push(event), createView: definition => {
      const actual = new LandmarkView(this, definition);
      return { place(state: LandmarkPlacement) { placements.push({ ...state }); actual.place(state); },
        consumeRendered() { return actual.consumeRendered(); }, destroy() { actual.destroy(); } } satisfies LandmarkViewPort;
    } });
    this.events.once('shutdown', () => controller.clear());
    ctx = { distance: 0, deltaMs: 16, viewport: size, blocked: false, landscape: {
      theme: 'spring', weather: 'sunny', weatherAlpha: 0, dayPhase: 'afternoon', landTint: 0xffffff,
      nearOffset: 0, nearRatio: .24, nearRepeatWidth: nearCanvas.width } };
    (window as any).landmarkQA = {
      ready: true, size, dpr: devicePixelRatio,
      step(value: number, state: { paused?: boolean; blocked?: boolean } = {}) { requested = value; paused = state.paused ?? false; blocked = state.blocked ?? false; },
      snapshot: () => ({ ...controller.snapshot(), encounters: encounters.map(event => ({ ...event })), latestPlacement: placements.at(-1),
        sprites: this.children.list.filter(object => object.name.startsWith('landmark:')).map(object => ({ name: object.name, active: object.active })) }),
      clear: () => controller.clear(), definitions: LANDMARKS,
    };
  }
  update(_time: number, delta: number) {
    if (!controller) return;
    if (requested !== null) { distance = requested; requested = null; }
    ctx = { ...ctx, distance, deltaMs: delta, blocked, paused, landscape: { ...ctx.landscape, nearOffset: distance * .24 } };
    if (!paused) { far.tilePositionX = distance * .15 - origin.x; near.tilePositionX = distance * .24 - origin.x; }
    controller.update(ctx);
  }
}
const game = new Phaser.Game({ type: Phaser.CANVAS, width: size.width, height: size.height,
  resolution: devicePixelRatio, pixelArt: true, roundPixels: true, antialias: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: LandmarkFixture });
(window as any).landmarkFixtureGame = game;
