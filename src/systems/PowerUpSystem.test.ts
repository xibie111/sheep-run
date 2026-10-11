import { describe, expect, it } from "vitest";
import { PowerUpSystem } from "./PowerUpSystem";
import { INPUT } from "../game/Constants";

describe("PowerUpSystem timed effects", () => {
  it("refreshes a same-type effect without stacking and allows other types to coexist", () => {
    const effects = new PowerUpSystem();

    effects.activate("magnet", 0);
    effects.activate("shield", 1000);
    effects.activate("magnet", 4000);

    expect(effects.activeEffects(5000)).toEqual([
      { type: "magnet", remainingMs: 7000 },
      { type: "shield", remainingMs: 2000 },
    ]);
    expect(effects.update(8000)).toEqual(["shield"]);
    expect(effects.activeEffects(8000)).toEqual([{ type: "magnet", remainingMs: 4000 }]);
  });

  it("consumes a shield once and reports expiry at the exact boundary", () => {
    const effects = new PowerUpSystem();
    effects.activate("shield", 0);

    expect(effects.consumeShield(100)).toBe(true);
    expect(effects.consumeShield(101)).toBe(false);
    effects.activate("shield", 1000);
    expect(effects.isActive("shield", 1000 + 5999)).toBe(true);
    expect(effects.isActive("shield", 7000)).toBe(false);
  });

  it("exposes the configured score multiplier and dash cooldown without extending immunity", () => {
    const effects = new PowerUpSystem(true);

    expect(effects.starMultiplier(0)).toBe(1);
    expect(effects.dashCooldownMs(0)).toBe(INPUT.dashCooldownMs);
    effects.activate("starMultiplier", 0);
    effects.activate("dash", 0);
    expect(effects.starMultiplier(1)).toBe(2);
    expect(effects.dashCooldownMs(1)).toBe(INPUT.dashCooldownMs / 2);
    expect(INPUT.dashInvulnerabilityMs).toBe(280);
  });

  it("expires all active effects and clears them on run reset", () => {
    const effects = new PowerUpSystem(true);
    effects.activate("magnet", 0);
    effects.activate("dash", 0);

    expect(effects.update(8000).sort()).toEqual(["dash", "magnet"]);
    effects.activate("shield", 9000);
    effects.reset();
    expect(effects.activeEffects(9000)).toEqual([]);
  });

  it("ignores Dash activation by default", () => {
    const effects = new PowerUpSystem();
    effects.activate("dash", 0);

    expect(effects.isActive("dash", 1)).toBe(false);
    expect(effects.dashCooldownMs(1)).toBe(INPUT.dashCooldownMs);
    expect(effects.activeEffects(1)).toEqual([]);
  });
});
