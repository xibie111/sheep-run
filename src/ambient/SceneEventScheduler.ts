export const AMBIENT_TIMING = { firstEligibleMs: 20_000, cooldownMinMs: 30_000, cooldownMaxMs: 45_000 } as const;

/** A stream owned by this presentation system, never by obstacles or pickups. */
export class SceneEventRandom {
  private value: number;
  constructor(seed: number) { this.value = (seed >>> 0) || 0x471f392b; }
  next(): number {
    let value = this.value; value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.value = value >>> 0; return this.value / 0x1_0000_0000;
  }
}
let fallbackSeed = 0x71ea9001;
export function sceneEventSeed(): number {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  fallbackSeed = (fallbackSeed + 0x9e3779b9) >>> 0; return fallbackSeed;
}

/** Deadlines belong to the run's effective clock. Waiting never changes a hazard. */
export class SceneEventScheduler {
  private random: SceneEventRandom;
  private phase: 'waiting' | 'playing' | 'stopped' = 'waiting';
  private eligibleAt = AMBIENT_TIMING.firstEligibleMs as number;
  constructor(private readonly seed: number) { this.random = new SceneEventRandom(seed); }
  get state() { return this.phase; }
  get nextEligibleAtMs(): number { return this.eligibleAt; }
  choose<T>(nowMs: number, offers: readonly T[], blocked: boolean): T | null {
    if (this.phase !== 'waiting' || !Number.isFinite(nowMs) || nowMs < this.eligibleAt || blocked || !offers.length) return null;
    this.phase = 'playing';
    return offers[Math.floor(this.random.next() * offers.length)]!;
  }
  finish(nowMs: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(nowMs)) return;
    this.phase = 'waiting';
    this.eligibleAt = nowMs + AMBIENT_TIMING.cooldownMinMs
      + this.random.next() * (AMBIENT_TIMING.cooldownMaxMs - AMBIENT_TIMING.cooldownMinMs);
  }
  stop(): void { this.phase = 'stopped'; }
  reset(): void { this.random = new SceneEventRandom(this.seed); this.phase = 'waiting'; this.eligibleAt = AMBIENT_TIMING.firstEligibleMs; }
}
