import type Phaser from "phaser";
import { ENVIRONMENT } from "../game/Constants";
import type { WeatherId } from "./types";
import { runViewportOrigin, watchViewport } from "../game/Viewport";

const WEATHER_STATES: readonly WeatherId[] = ["sunny", "rain", "wind"];
const WEATHER_WEIGHTS: Readonly<Record<WeatherId, number>> = { sunny: 55, rain: 30, wind: 15 };
let fallbackSeed = 0;

function localWeatherSeed(): number {
  // Seed the schedule without consuming the gameplay's Math.random stream.
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  return (Date.now() ^ Math.imul(++fallbackSeed, 0x9e3779b9)) >>> 0;
}

export interface WeatherSnapshot {
  weather: WeatherId;
  alpha: number;
}

interface ParticleEmitterLike {
  setAlpha(alpha: number): unknown;
  setDepth(depth: number): unknown;
  start(): unknown;
  stop(kill?: boolean): unknown;
  destroy(): unknown;
  updateConfig(config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): unknown;
}

const RAIN_CONFIG: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
  emitting: false,
  frequency: 18,
  maxAliveParticles: ENVIRONMENT.maxRainParticles,
  reserve: ENVIRONMENT.maxRainParticles,
  x: { min: 0, max: 480 },
  y: 0,
  lifespan: 1000,
  speedX: { min: -75, max: -45 },
  speedY: { min: 300, max: 390 },
  gravityY: 40,
  rotate: 12,
  alpha: { start: 0.9, end: 0.35 },
  scale: { start: 1.15, end: 0.9 },
  blendMode: 'ADD',
};

const WIND_CONFIG: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
  emitting: false,
  frequency: 190,
  maxAliveParticles: ENVIRONMENT.maxWindParticles,
  reserve: ENVIRONMENT.maxWindParticles,
  x: { min: 0, max: 480 },
  y: { min: 110, max: 202 },
  lifespan: 2100,
  speedX: { min: -55, max: -28 },
  speedY: { min: 18, max: 48 },
  gravityY: 8,
  rotate: { start: 0, end: 240 },
  alpha: { start: 0.9, end: 0 },
  scale: { start: 1, end: 0.55 },
};

export class WeatherSystem {
  private readonly rainEmitter: ParticleEmitterLike | null;
  private readonly windEmitter: ParticleEmitterLike | null;
  private readonly reducedMotion: boolean;
  private readonly seed: number;
  private override: WeatherId | null = null;
  private activeWeather: WeatherId = "sunny";
  private current: WeatherSnapshot = { weather: "sunny", alpha: 0 };
  private destroyed = false;
  private stopWatching?: () => void;
  private stillRain?: Phaser.GameObjects.Graphics;
  private redrawStillRain?: () => void;

  constructor(scene?: Phaser.Scene, reducedMotion = false, seed = localWeatherSeed(), private readonly calmAtmosphere = false) {
    this.reducedMotion = reducedMotion;
    this.seed = seed >>> 0;
    if (!scene || reducedMotion) {
      this.rainEmitter = null;
      this.windEmitter = null;
      if (scene && reducedMotion && calmAtmosphere) {
        this.stillRain = scene.add.graphics().setDepth(-10.5).setScrollFactor(0).setName('calm-weather');
        this.redrawStillRain = () => {
          const size = scene.scale.gameSize, origin = runViewportOrigin(size), art = this.stillRain!;
          art.clear();
          if (this.current.weather !== 'rain') return;
          for (let i = 0; i < 32; i++) art.fillStyle(0xc4dfdf, .45 * this.current.alpha).fillRect((i * 73) % size.width, 72 + (i * 23) % Math.max(1, origin.y + 130), 1, 4);
        };
        this.stopWatching = watchViewport(scene, this.redrawStillRain);
      }
    } else {
      this.rainEmitter = scene.add.particles(0, 0, "pasture-weather-rain", RAIN_CONFIG).setDepth(5).setScrollFactor(0);
      this.windEmitter = scene.add.particles(0, 0, "pasture-weather-leaf", WIND_CONFIG).setDepth(5).setScrollFactor(0);
      this.stopWatching = watchViewport(scene, (size) => {
        const origin = runViewportOrigin(size);
        const lifespan = Math.ceil((size.height + 24) / 300 * 1000);
        // Cover the whole expanded road without filling/expanding the pool on resize.
        const frequency = Math.max(Math.ceil(lifespan / ENVIRONMENT.maxRainParticles), Math.round(18 * 480 / size.width));
        // updateConfig replays the creation config: preserve emission and don't
        // reserve another particle pool each time the viewport changes.
        this.rainEmitter?.updateConfig({ x: { min: 0, max: size.width + 24 }, lifespan, frequency,
          emitting: this.activeWeather === "rain", reserve: 0 });
        this.windEmitter?.updateConfig({ x: { min: 0, max: size.width }, y: { min: origin.y + 110, max: origin.y + 202 }, emitting: this.activeWeather === "wind", reserve: 0 });
      });
    }
  }

  setWeather(weatherId: WeatherId | null): void {
    this.override = weatherId;
  }

  atDistance(distancePx: number, allowed: readonly WeatherId[] = WEATHER_STATES): WeatherSnapshot {
    const distance = Number.isFinite(distancePx) ? Math.max(0, distancePx) : 0;
    const segmentProgress = distance % ENVIRONMENT.weatherSegmentDistancePx;
    const segment = Math.floor(distance / ENVIRONMENT.weatherSegmentDistancePx);
    const scheduled = segment === 0 ? "sunny" : this.randomWeather(segment, allowed);
    const desired = this.override ?? scheduled;
    const weather = allowed.includes(desired)
      ? desired
      : allowed.includes("sunny") ? "sunny" : allowed[0] ?? "sunny";
    const alpha = weather === "sunny"
      ? 0
      : this.override ? 1 : Math.min(1,
        segmentProgress / ENVIRONMENT.weatherFadeDistancePx,
        (ENVIRONMENT.weatherSegmentDistancePx - segmentProgress) / ENVIRONMENT.weatherFadeDistancePx);
    return { weather, alpha };
  }

  private randomWeather(segment: number, allowed: readonly WeatherId[]): WeatherId {
    // Hash the absolute segment: frame rate, pause and query order cannot reroll it.
    let value = (this.seed ^ Math.imul(segment + 1, 0x9e3779b9)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    const random = ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
    let total = 0;
    for (const weather of WEATHER_STATES) if (allowed.includes(weather)) total += WEATHER_WEIGHTS[weather];
    let roll = random * total;
    for (const weather of WEATHER_STATES) {
      if (!allowed.includes(weather)) continue;
      roll -= WEATHER_WEIGHTS[weather];
      if (roll < 0) return weather;
    }
    return "sunny";
  }

  update(distancePx: number, allowed?: readonly WeatherId[]): WeatherSnapshot {
    if (this.destroyed) return this.current;
    this.current = this.reducedMotion && !this.calmAtmosphere ? { weather: "sunny", alpha: 0 } : this.atDistance(distancePx, allowed);
    this.redrawStillRain?.();
    this.rainEmitter?.setAlpha(this.current.weather === "rain" ? this.current.alpha : 0);
    this.windEmitter?.setAlpha(this.current.weather === "wind" ? this.current.alpha : 0);
    if (this.current.weather !== this.activeWeather) {
      if (this.activeWeather === "rain") this.rainEmitter?.stop(true);
      if (this.activeWeather === "wind") this.windEmitter?.stop(true);
      if (this.current.weather === "rain") this.rainEmitter?.start();
      if (this.current.weather === "wind") this.windEmitter?.start();
      this.activeWeather = this.current.weather;
    }
    return this.current;
  }

  snapshot(): WeatherSnapshot {
    return this.current;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopWatching?.();
    this.stillRain?.destroy();
    this.rainEmitter?.stop(true);
    this.windEmitter?.stop(true);
    this.rainEmitter?.destroy();
    this.windEmitter?.destroy();
  }
}
