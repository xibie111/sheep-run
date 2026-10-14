import { SceneEventRandom } from '../ambient/SceneEventScheduler';
import type { LandscapeState } from '../ambient/AnimalRules';
import type { SceneryId } from './sceneryCatalog';

export const SCENERY_RULES = { firstMs: 30_000, retryMs: 2_500, durationMs: 9_000, visibleMs: 1_500, afterRainMs: 25_000 } as const;
export class ScenerySchedule {
  private readonly random: SceneEventRandom;
  private rainAt: number | null = null;
  private retryAt = SCENERY_RULES.firstMs as number;
  private attempts = 0;
  private used = false;
  private stopped = false;
  constructor(seed: number) { this.random = new SceneEventRandom(seed); }
  choose(now: number, land: LandscapeState, blocked: boolean, seen: readonly string[]): SceneryId | null {
    if (land.weather === 'rain' && land.weatherAlpha >= .3) this.rainAt = now;
    if (this.used || blocked || !Number.isFinite(now) || now < this.retryAt) return null;
    const offers: SceneryId[] = [];
    const dry = land.weather !== 'rain' || land.weatherAlpha < .15;
    if (land.weather === 'sunny' && land.dayPhase !== 'night' && this.rainAt !== null && now - this.rainAt <= SCENERY_RULES.afterRainMs) offers.push('rainbow-v1');
    if (dry && land.dayPhase === 'night') offers.push('meteors-v1');
    if (dry && ((land.theme === 'summer' && land.dayPhase === 'sunset') || (land.theme !== 'winter' && land.dayPhase === 'night'))) offers.push('fireflies-v1');
    if (!offers.length) return null;
    this.retryAt = now + SCENERY_RULES.retryMs;
    const chance = Math.min(1, .35 + this.attempts++ * .15);
    if (this.random.next() >= chance) return null;
    const unseen = offers.filter(id => !seen.includes(id)), candidates = unseen.length ? unseen : offers;
    this.used = true;
    return candidates[Math.floor(this.random.next() * candidates.length)]!;
  }
  /** A cancelled fade-in is not a completed encounter. Keep its opportunity pending. */
  finish(now: number, observed: boolean): void {
    if (this.stopped || !this.used || observed || !Number.isFinite(now)) return;
    this.used = false; this.retryAt = now + SCENERY_RULES.retryMs;
  }
  stop(): void { this.stopped = true; this.used = true; }
}

/** Only consecutive effective milliseconds of rendered, sufficiently visible scenery count. */
export class SceneryExposure {
  private visibleMs = 0;
  private recorded = false;
  get complete(): boolean { return this.recorded; }
  observe(deltaMs: number, visible: boolean): boolean {
    if (this.recorded) return false;
    this.visibleMs = visible ? this.visibleMs + Math.max(0, Math.min(100, deltaMs)) : 0;
    if (this.visibleMs < SCENERY_RULES.visibleMs) return false;
    this.recorded = true; return true;
  }
}
