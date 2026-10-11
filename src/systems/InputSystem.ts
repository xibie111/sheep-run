import { GAME_FEATURES, INPUT } from "../game/Constants";
import { GestureRecognizer, type GestureAction, type GestureEvent } from "./GestureRecognizer";

export type JumpKind = "normal" | "high";

export interface InputFrame {
  jump: JumpKind | null;
  crouching: boolean;
  dashing: boolean;
  dashInvulnerable: boolean;
}

export class JumpTiming {
  private lastGroundedAt = Number.NEGATIVE_INFINITY;
  private buffered: { kind: JumpKind; expiresAt: number } | null = null;

  noteGrounded(now: number): void {
    this.lastGroundedAt = now;
  }

  request(kind: JumpKind, now: number, grounded: boolean): boolean {
    if (grounded || now - this.lastGroundedAt <= INPUT.coyoteTimeMs) {
      this.lastGroundedAt = Number.NEGATIVE_INFINITY;
      this.buffered = null;
      return true;
    }
    this.buffered = { kind, expiresAt: now + INPUT.jumpBufferMs };
    return false;
  }

  consumeBuffered(now: number, grounded: boolean): JumpKind | null {
    if (!this.buffered) return null;
    if (now > this.buffered.expiresAt) {
      this.buffered = null;
      return null;
    }
    if (!grounded) return null;
    const { kind } = this.buffered;
    this.buffered = null;
    this.lastGroundedAt = Number.NEGATIVE_INFINITY;
    return kind;
  }

  reset(): void {
    this.lastGroundedAt = Number.NEGATIVE_INFINITY;
    this.buffered = null;
  }
}

export class DashWindow {
  private immuneUntil = Number.NEGATIVE_INFINITY;
  private cooldownUntil = Number.NEGATIVE_INFINITY;

  tryStart(now: number, cooldownMs: number = INPUT.dashCooldownMs): boolean {
    if (now < this.cooldownUntil) return false;
    this.immuneUntil = now + INPUT.dashInvulnerabilityMs;
    this.cooldownUntil = now + Math.max(0, cooldownMs);
    return true;
  }

  isInvulnerable(now: number): boolean {
    return now < this.immuneUntil;
  }

  cancel(): void {
    this.immuneUntil = Number.NEGATIVE_INFINITY;
  }

  reset(): void {
    this.immuneUntil = Number.NEGATIVE_INFINITY;
    this.cooldownUntil = Number.NEGATIVE_INFINITY;
  }
}

export class InputSystem {
  private readonly gestureRecognizer = new GestureRecognizer();
  private readonly jumpTiming = new JumpTiming();
  private readonly dashWindow = new DashWindow();
  private readonly pendingActions: GestureAction[] = [];
  private touchDash = false;
  private crouchUntil = Number.NEGATIVE_INFINITY;

  constructor(private readonly dashEnabled: boolean = GAME_FEATURES.dash) {}

  handleGesture(event: GestureEvent): void {
    this.pendingActions.push(...this.gestureRecognizer.handle(event));
  }

  update(now: number, grounded: boolean, dashCooldownMs: number = INPUT.dashCooldownMs): InputFrame {
    this.pendingActions.push(...this.gestureRecognizer.handle({ type: "tick", at: now }));
    if (grounded) this.jumpTiming.noteGrounded(now);

    let jump: JumpKind | null = null;
    for (const action of this.pendingActions.splice(0)) {
      switch (action.type) {
        case "jump":
          if (this.jumpTiming.request("normal", now, grounded)) jump = "normal";
          break;
        case "high-jump":
          if (this.jumpTiming.request("high", now, grounded)) jump = "high";
          break;
        case "crouch":
          this.crouchUntil = now + INPUT.crouchDurationMs;
          break;
        case "dash-start":
          if (this.dashEnabled) this.startDash(now, dashCooldownMs);
          break;
        case "dash-end":
          this.touchDash = false;
          break;
      }
    }

    jump ??= this.jumpTiming.consumeBuffered(now, grounded);
    if (jump !== null) this.crouchUntil = Number.NEGATIVE_INFINITY;

    return {
      jump,
      crouching: jump === null && now < this.crouchUntil,
      dashing: this.touchDash,
      dashInvulnerable: this.isObstacleImmune(now),
    };
  }

  isObstacleImmune(now: number): boolean {
    return this.dashEnabled && this.touchDash && this.dashWindow.isInvulnerable(now);
  }

  cancel(): void {
    this.gestureRecognizer.handle({ type: "cancel" });
    this.pendingActions.length = 0;
    this.touchDash = false;
    this.crouchUntil = Number.NEGATIVE_INFINITY;
    this.jumpTiming.reset();
    this.dashWindow.cancel();
  }

  reset(): void {
    this.cancel();
    this.dashWindow.reset();
  }

  private startDash(now: number, cooldownMs: number): void {
    if (this.touchDash) return;
    if (!this.dashWindow.tryStart(now, cooldownMs)) return;
    this.touchDash = true;
  }
}
