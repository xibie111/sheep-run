import { describe, expect, it } from "vitest";
import { INPUT, PLAYER, RUN, WORLD } from "./Constants";
import { WideLog, TallStack, HangingVine } from "./ObstacleDefinitions";

function clearTime(velocity: number, rise: number): number {
  return 2 * Math.sqrt(velocity * velocity - 2 * PLAYER.gravityY * rise) / PLAYER.gravityY;
}

describe("obstacle avoidance with the configured jump heights", () => {
  it("gives a normal jump enough clearance time over the wide log at initial speed", () => {
    const top = WORLD.groundY - WideLog.height + WideLog.hitbox.offsetY;
    const crossing = (PLAYER.width + WideLog.hitbox.width) / RUN.initialSpeed;
    expect(clearTime(PLAYER.jumpVelocityY, WORLD.groundY - top) - crossing).toBeGreaterThan(0.08);
  });

  it("puts the tall stack above normal-jump reach and within high-jump reach", () => {
    const rise = TallStack.height - TallStack.hitbox.offsetY;
    expect(PLAYER.jumpVelocityY ** 2 / (2 * PLAYER.gravityY)).toBeLessThan(rise);
    const crossing = (PLAYER.width + TallStack.hitbox.width) / RUN.initialSpeed;
    // This deliberately budgets the full authored player width; the live body
    // is narrower and touch/Arcade tests verify its actual timing window.
    expect(clearTime(PLAYER.highJumpVelocityY, rise) - crossing).toBeGreaterThan(0.04);
  });

  it("leaves headroom and enough crouch duration at the initial speed", () => {
    const bottom = WORLD.groundY - HangingVine.groundOffset - HangingVine.height + HangingVine.hitbox.offsetY + HangingVine.hitbox.height;
    expect(bottom).toBeGreaterThan(WORLD.groundY - (PLAYER.height - 8));
    expect(bottom).toBeLessThan(WORLD.groundY - PLAYER.crouchBodyHeight);
    // SheepBody excludes twelve logical pixels from the authored width.
    const crossing = (PLAYER.width - 12 + HangingVine.hitbox.width) / RUN.initialSpeed;
    expect(INPUT.crouchDurationMs / 1000 - crossing).toBeGreaterThan(0.05);
  });
});
