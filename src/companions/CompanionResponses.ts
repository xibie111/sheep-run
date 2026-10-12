import { PLAYER, WORLD } from "../game/Constants";
import type { CompanionPose, LeadPose } from "./CompanionPose";

export type CompanionResponseKind = "star" | "crown" | "heart";
export const COMPANION_RESPONSE_KEYS: Readonly<Record<CompanionResponseKind, string>> = {
  star: "runner-v2-response-star", crown: "runner-v2-response-crown", heart: "runner-v2-response-heart",
};
export const COMPANION_RESPONSE_RULES = {
  starMs: 850, crownMs: 1100, cooldownMs: 1600, starPendingMs: 2400,
} as const;
export interface CompanionResponse { readonly kind: CompanionResponseKind; readonly progress: number; }
type Celebration = Exclude<CompanionResponseKind, "heart">;
interface Active { kind: Celebration; elapsedMs: number; }

/** Only observes lead presentation: crouching is represented by its existing shorter display height. */
export function companionCanCelebrate(lead: LeadPose): boolean {
  return lead.motionState === "RUNNING" && lead.y >= WORLD.groundY - .5
    && lead.displayHeight >= PLAYER.displayHeight - .5;
}

/** Effective-time queue. No timers, animation commands, randomness, input or gameplay state. */
export class CompanionResponses {
  private starAtMs: number | null = null;
  private crownPending = false;
  private active: Active | null = null;
  private previousNowMs: number | null = null;
  private previousSafe = false;
  private cooldownUntilMs = 0;
  private farewellAtMs: number | null = null;
  private disposed = false;

  request(kind: Celebration, nowMs: number): void {
    if (this.disposed || this.farewellAtMs !== null) return;
    // Coalesce repeated star events. A queued crown is always chosen first.
    if (kind === "crown") {
      if (this.active?.kind !== "crown") this.crownPending = true;
    } else if (this.starAtMs === null && this.active?.kind !== "star") this.starAtMs = nowMs;
  }

  update(nowMs: number, phase: CompanionPose["phase"], safeRunning: boolean): CompanionResponse | null {
    if (this.disposed) return null;
    const delta = this.previousNowMs === null ? 0 : Math.max(0, nowMs - this.previousNowMs);
    this.previousNowMs = nowMs;
    if (phase === "gone") { this.clear(); return null; }
    if (phase === "leaving") {
      this.starAtMs = null; this.crownPending = false; this.active = null; this.previousSafe = false;
      this.farewellAtMs ??= nowMs;
      return { kind: "heart", progress: Math.min(1, Math.max(0, (nowMs - this.farewellAtMs) / 1000)) };
    }
    if (this.starAtMs !== null && nowMs - this.starAtMs > COMPANION_RESPONSE_RULES.starPendingMs) this.starAtMs = null;
    const safe = phase === "following" && safeRunning;
    if (this.active && safe && this.previousSafe) this.active.elapsedMs += delta;
    this.previousSafe = safe;
    if (!safe) return null;
    if (this.active) {
      const duration = this.active.kind === "crown" ? COMPANION_RESPONSE_RULES.crownMs : COMPANION_RESPONSE_RULES.starMs;
      if (this.active.elapsedMs < duration) return { kind: this.active.kind, progress: this.active.elapsedMs / duration };
      this.active = null; this.cooldownUntilMs = nowMs + COMPANION_RESPONSE_RULES.cooldownMs;
    }
    if (nowMs < this.cooldownUntilMs) return null;
    const kind = this.crownPending ? "crown" : this.starAtMs !== null ? "star" : null;
    if (!kind) return null;
    if (kind === "crown") this.crownPending = false; else this.starAtMs = null;
    this.active = { kind, elapsedMs: 0 };
    return { kind, progress: 0 };
  }

  clear(): void {
    this.disposed = true; this.active = null; this.starAtMs = null; this.crownPending = false;
    this.previousNowMs = null; this.previousSafe = false; this.farewellAtMs = null;
  }
}
