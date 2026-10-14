import type Phaser from "phaser";
import { ENVIRONMENT, WORLD } from "../game/Constants";
import { ThemeSystem } from "./ThemeSystem";
import { runViewportOrigin, watchViewport, type ViewportSize } from "../game/Viewport";
import { BACKGROUND_KEYS, ILLUSTRATED_REPEAT_WIDTH } from "../data/backgroundAssets";
import { seasonLayerKey } from "../data/seasonArtAssets";

export interface ParallaxOptions {
  reducedMotion?: boolean;
  themes?: ThemeSystem;
  calmAtmosphere?: boolean;
}

export interface ParallaxLayerSnapshot {
  key: string;
  ratio: number;
  x: number;
  tint: number;
  repeatWidth: number;
}

interface LayerDefinition {
  key: string;
  ratio: number;
  tint: "sky" | "land";
}

const LAYERS: readonly LayerDefinition[] = [
  { key: "pasture-sky", ratio: ENVIRONMENT.parallaxRatios.sky, tint: "sky" },
  { key: "pasture-cloud", ratio: ENVIRONMENT.parallaxRatios.cloud, tint: "sky" },
  { key: "pasture-far-mountain", ratio: ENVIRONMENT.parallaxRatios.farMountain, tint: "land" },
  { key: "pasture-treeline", ratio: ENVIRONMENT.parallaxRatios.treeLine, tint: "land" },
  { key: "pasture-building", ratio: ENVIRONMENT.parallaxRatios.farmBuilding, tint: "land" },
  { key: "pasture-field", ratio: ENVIRONMENT.parallaxRatios.field, tint: "land" },
  { key: "pasture-fence", ratio: ENVIRONMENT.parallaxRatios.fence, tint: "land" },
  { key: "pasture-ground", ratio: ENVIRONMENT.parallaxRatios.ground, tint: "land" },
  { key: "pasture-foreground-grass", ratio: ENVIRONMENT.parallaxRatios.foregroundGrass, tint: "land" },
];

export class ParallaxSystem {
  private readonly layers: Array<{ sprite: Phaser.GameObjects.TileSprite; definition: LayerDefinition }> = [];
  private readonly reducedMotion: boolean;
  private readonly themes: ThemeSystem;
  private distance = 0;
  private atmosphereDistance = 0;
  private readonly calmAtmosphere: boolean;
  private repeatWidth: number = WORLD.width;
  private originX = 0;
  private readonly fills: Array<{ sprite: Phaser.GameObjects.TileSprite; tint: "sky" | "land" }> = [];
  private destroyed = false;
  private stopWatching?: () => void;
  private renderedTheme = "";
  private rainBrightness = 0;
  private readonly useSeasonArtwork: boolean;

  constructor(private readonly scene?: Phaser.Scene, options: ParallaxOptions = {}) {
    this.reducedMotion = options.reducedMotion ?? false;
    this.calmAtmosphere = options.calmAtmosphere ?? false;
    this.themes = options.themes ?? new ThemeSystem();
    this.useSeasonArtwork = scene?.textures?.exists(seasonLayerKey("spring", "pasture-far-mountain")!) ?? false;
    if (!scene) return;
    if (scene.textures?.exists(BACKGROUND_KEYS.runFar)) this.repeatWidth = ILLUSTRATED_REPEAT_WIDTH;
    // Extend sky and the road texture without repeating the horizon.
    this.fills.push(
      { sprite: scene.add.tileSprite(0, 0, WORLD.width, WORLD.height, "pasture-sky-fill").setOrigin(0).setDepth(-22).setScrollFactor(0), tint: "sky" },
      { sprite: scene.add.tileSprite(0, WORLD.height, WORLD.width, 1, "pasture-soil-fill").setOrigin(0).setDepth(-21).setScrollFactor(0), tint: "land" },
    );
    LAYERS.forEach((definition, index) => {
      // UI may add named subframes to shared textures, changing Phaser's default frame.
      const sprite = scene.add.tileSprite(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, definition.key, "__BASE");
      sprite.setOrigin(0.5);
      sprite.setDepth(-20 + index);
      sprite.setScrollFactor(0);
      this.layers.push({ sprite, definition });
    });
    this.stopWatching = watchViewport(scene, (size) => this.layout(size));
  }

  update(distancePx: number, rainBrightness = 0): void {
    if (this.destroyed) return;
    this.atmosphereDistance = Number.isFinite(distancePx) ? Math.max(0, distancePx) : 0;
    this.distance = this.reducedMotion ? 0 : this.atmosphereDistance;
    this.rainBrightness = Number.isFinite(rainBrightness) ? Math.max(0, Math.min(1, rainBrightness)) : 0;
    const visual = this.visual();
    if (visual.theme.id !== this.renderedTheme) {
      for (const { sprite, definition } of this.layers) {
        const key = seasonLayerKey(visual.theme.id, definition.key);
        if (key && this.scene?.textures?.exists(key)) sprite.setTexture(key, "__BASE");
      }
      for (const { sprite, tint } of this.fills) {
        const key = seasonLayerKey(visual.theme.id, tint === "sky" ? "pasture-sky-fill" : "pasture-soil-fill");
        if (key && this.scene?.textures?.exists(key)) sprite.setTexture(key, "__BASE");
      }
      this.renderedTheme = visual.theme.id;
    }
    for (const { sprite, definition } of this.layers) {
      const offset = Math.round(this.distance * definition.ratio) % this.layerRepeatWidth(sprite);
      sprite.tilePositionX = offset - this.originX;
      sprite.setTint(definition.tint === "sky" ? visual.skyTint : visual.landTint);
    }
    for (const { sprite, tint } of this.fills) {
      sprite.setTint(tint === "sky" ? visual.skyTint : visual.landTint);
      if (tint === "land") sprite.tilePositionX = Math.round(this.distance * ENVIRONMENT.parallaxRatios.ground) % this.layerRepeatWidth(sprite) - this.originX;
    }
  }

  private layout(size: ViewportSize): void {
    const origin = runViewportOrigin(size);
    this.originX = origin.x;
    for (const { sprite } of this.layers) sprite.setPosition(size.width / 2, origin.y + WORLD.height / 2).setSize(size.width, WORLD.height);
    this.fills[0]!.sprite.setSize(size.width, size.height);
    this.fills[1]!.sprite.setPosition(0, origin.y + WORLD.height).setSize(size.width, Math.max(1, size.height - origin.y - WORLD.height));
    this.update(this.atmosphereDistance, this.rainBrightness);
  }

  private visual() {
    const visual = this.themes.visualAtDistance(this.atmosphereDistance, this.reducedMotion && !this.calmAtmosphere, this.useSeasonArtwork);
    // Rain is conveyed by droplets; restore the authored colours instead of
    // combining them with a dark day tint. Follow the weather fade smoothly.
    const brighten = (tint: number): number => {
      const channel = (shift: number) => Math.round(((tint >>> shift) & 255) * (1 - this.rainBrightness) + 255 * this.rainBrightness);
      return (channel(16) << 16) | (channel(8) << 8) | channel(0);
    };
    return { ...visual, skyTint: brighten(visual.skyTint), landTint: brighten(visual.landTint) };
  }

  /** Exact state used by the painted near layer, including reduced-motion freezing. */
  presentation() {
    const visual = this.visual();
    const near = this.layers.find(layer => layer.definition.key === 'pasture-treeline');
    return { theme: visual.theme.id, dayPhase: visual.dayPhase, landTint: visual.landTint,
      nearOffset: Math.round(this.distance * ENVIRONMENT.parallaxRatios.treeLine),
      nearRepeatWidth: near ? this.layerRepeatWidth(near.sprite) : this.repeatWidth,
      nearRatio: this.reducedMotion ? 0 : ENVIRONMENT.parallaxRatios.treeLine };
  }

  snapshot(): ParallaxLayerSnapshot[] {
    const visual = this.visual();
    return LAYERS.map((definition) => {
      const sprite = this.layers.find(layer => layer.definition === definition)?.sprite;
      const repeatWidth = sprite ? this.layerRepeatWidth(sprite) : this.repeatWidth;
      return { key: definition.key, ratio: definition.ratio, repeatWidth,
        x: Math.round(this.distance * definition.ratio) % repeatWidth,
        tint: definition.tint === "sky" ? visual.skyTint : visual.landTint };
    });
  }

  private layerRepeatWidth(sprite: Phaser.GameObjects.TileSprite): number {
    const width = sprite.frame?.cutWidth;
    return typeof width === "number" && width > 0 ? width : this.repeatWidth;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopWatching?.();
    for (const { sprite } of this.layers) sprite.destroy();
    for (const { sprite } of this.fills) sprite.destroy();
    this.fills.length = 0;
    this.layers.length = 0;
  }
}
