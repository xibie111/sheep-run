import { CompanionRandom, COMPANION_RULES } from "./CompanionRules";

export type CompanionPhase = "waiting" | "bell" | "companion" | "stopped";

/** All deadlines are expressed in RunScene's effective run time, never wall time. */
export class BellScheduler {
  private random: CompanionRandom;
  private phase: CompanionPhase = "waiting";
  private eligibleAtMs: number = COMPANION_RULES.firstEligibleMs;
  constructor(private readonly seed: number) { this.random = new CompanionRandom(seed); }
  get state(): CompanionPhase { return this.phase; }
  get nextEligibleAtMs(): number { return this.eligibleAtMs; }
  randomSkin = (): number => this.random.next();
  reset(): void {
    this.random = new CompanionRandom(this.seed); this.phase = "waiting";
    this.eligibleAtMs = COMPANION_RULES.firstEligibleMs;
  }
  trySpawn(nowMs: number, safe: boolean): boolean {
    if (!Number.isFinite(nowMs) || this.phase !== "waiting" || nowMs < this.eligibleAtMs || !safe) return false;
    this.phase = "bell"; return true;
  }
  collect(): boolean {
    if (this.phase !== "bell") return false;
    this.phase = "companion"; return true;
  }
  missed(nowMs: number): void { if (this.phase === "bell") this.cooldown(nowMs); }
  departed(nowMs: number): void { if (this.phase === "companion") this.cooldown(nowMs); }
  stop(): void { this.phase = "stopped"; }
  private cooldown(nowMs: number): void {
    this.phase = "waiting";
    this.eligibleAtMs = nowMs + COMPANION_RULES.cooldownMinMs
      + this.random.next() * (COMPANION_RULES.cooldownMaxMs - COMPANION_RULES.cooldownMinMs);
  }
}
