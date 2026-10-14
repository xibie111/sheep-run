import type Phaser from "phaser";
import { DecorationSystem } from "./DecorationSystem";
import { ChunkSystem } from "./ChunkSystem";
import { ParallaxSystem } from "./ParallaxSystem";
import { ThemeSystem } from "./ThemeSystem";
import { WeatherSystem } from "./WeatherSystem";
import type { ThemeId, WeatherId } from "./types";
import { viewportSizeFromScale } from "../game/Viewport";
import { BACKGROUND_KEYS } from "../data/backgroundAssets";

export interface EnvironmentOptions {
  seed?: number;
  reducedMotion?: boolean;
  calmAtmosphere?: boolean;
}

export interface EnvironmentSnapshot {
  theme: ThemeId;
  weather: WeatherId;
  weatherAlpha: number;
  activeChunks: number;
  generatedChunks: number;
  recycledChunks: number;
  pooledDecorations: number;
  allocatedDecorations: number;
}

export class EnvironmentSystem {
  private readonly themes: ThemeSystem;
  private readonly weather: WeatherSystem;
  private readonly parallax: ParallaxSystem;
  private readonly chunks: ChunkSystem;
  private readonly decorations: DecorationSystem;
  private readonly renderedChunks = new Map<number, ThemeId>();
  private readonly reducedMotion: boolean;
  private destroyed = false;
  private lastDistance = 0;

  constructor(private readonly scene: Phaser.Scene, options: EnvironmentOptions = {}) {
    this.reducedMotion = options.reducedMotion ?? false;
    this.themes = new ThemeSystem();
    this.weather = new WeatherSystem(scene, this.reducedMotion, options.seed, options.calmAtmosphere);
    this.parallax = new ParallaxSystem(scene, { reducedMotion: this.reducedMotion, themes: this.themes, calmAtmosphere: options.calmAtmosphere });
    this.chunks = new ChunkSystem(options.seed ?? 1);
    // Trees, fences and buildings now live in the illustrated near layer.
    // Keep chunk scheduling, but avoid drawing the older procedural scenery over it.
    this.decorations = new DecorationSystem(scene.textures?.exists(BACKGROUND_KEYS.runNear) ? undefined : scene);
  }

  setTheme(themeId: ThemeId | null): void {
    this.themes.setTheme(themeId);
    this.reconcileChunks(this.lastDistance + viewportSizeFromScale(this.scene.scale).width);
  }

  setWeather(weatherId: WeatherId | null): void {
    this.weather.setWeather(weatherId);
  }

  update(distancePx: number, _deltaMs = 0, score?: number): void {
    if (this.destroyed) return;
    if (score !== undefined) this.themes.setScore(score);
    this.lastDistance = Number.isFinite(distancePx) ? Math.max(0, distancePx) : 0;
    const themeState = this.themes.visualAtDistance(this.lastDistance, this.reducedMotion);
    const weather = this.weather.update(this.lastDistance, themeState.theme.allowedWeather);
    this.parallax.update(this.lastDistance, weather.weather === 'rain' ? weather.alpha : 0);
    this.reconcileChunks(this.lastDistance + viewportSizeFromScale(this.scene.scale).width);
    this.decorations.update(this.lastDistance);
  }

  ensureChunks(cameraRight: number): void {
    if (this.destroyed) return;
    this.reconcileChunks(cameraRight);
  }

  recycleChunks(cameraLeft: number): void {
    if (this.destroyed) return;
    this.chunks.recycleChunks(cameraLeft);
    this.reconcileRenderedChunks();
  }

  presentation() {
    const weather = this.weather.snapshot();
    return { ...this.parallax.presentation(), weather: weather.weather, weatherAlpha: weather.alpha };
  }

  snapshot(): EnvironmentSnapshot {
    const weather = this.weather.snapshot();
    const theme = this.themes.visualAtDistance(this.lastDistance, this.reducedMotion).theme;
    const chunks = this.chunks.snapshot();
    const decorations = this.decorations.snapshot();
    return {
      theme: theme.id,
      weather: weather.weather,
      weatherAlpha: weather.alpha,
      activeChunks: chunks.active,
      generatedChunks: chunks.generated,
      recycledChunks: chunks.recycled,
      pooledDecorations: decorations.pooled,
      allocatedDecorations: decorations.allocated,
    };
  }

  clear(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.renderedChunks.clear();
    this.decorations.clear();
    this.chunks.clear();
    this.parallax.destroy();
    this.weather.destroy();
  }

  private reconcileChunks(cameraRight: number): void {
    const cameraLeft = Math.max(0, cameraRight - viewportSizeFromScale(this.scene.scale).width);
    const themeAt = (distancePx: number): ThemeId => this.themes.atDistance(distancePx).id;
    const active = this.chunks.ensureChunks(cameraRight, cameraLeft, themeAt);
    const activeIndices = new Set(active.map((chunk) => chunk.index));
    for (const [index] of this.renderedChunks) {
      if (!activeIndices.has(index)) this.decorations.detachChunk(index);
    }
    for (const chunk of active) {
      if (this.renderedChunks.get(chunk.index) === chunk.themeId) continue;
      this.decorations.attach(chunk.index, chunk.x, chunk.decorations);
      this.renderedChunks.set(chunk.index, chunk.themeId);
    }
    this.reconcileRenderedChunks();
  }

  private reconcileRenderedChunks(): void {
    const activeIndices = new Set(this.chunks.chunks().map((chunk) => chunk.index));
    for (const index of this.renderedChunks.keys()) {
      if (activeIndices.has(index)) continue;
      this.decorations.detachChunk(index);
      this.renderedChunks.delete(index);
    }
  }
}
