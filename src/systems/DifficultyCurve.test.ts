import { describe, expect, it } from "vitest";
import { RUN } from "../game/Constants";
import { DifficultySystem } from "./DifficultySystem";

describe("DifficultySystem", () => {
  it("preserves the existing acceleration curve and caps at maximum speed", () => {
    const difficulty = new DifficultySystem();
    expect(difficulty.speed).toBe(RUN.initialSpeed);
    expect(difficulty.update(10)).toBe(RUN.initialSpeed + 10 * RUN.speedAcceleration);
    expect(difficulty.update(100)).toBe(RUN.maxSpeed);
  });

  it("applies the saved speed multiplier after the base acceleration cap", () => {
    const difficulty = new DifficultySystem(1.04);
    expect(difficulty.speed).toBe(RUN.initialSpeed * 1.04);
    expect(difficulty.update(100)).toBe(RUN.maxSpeed * 1.04);
  });

  it("ignores invalid elapsed time and resets between runs", () => {
    const difficulty = new DifficultySystem();
    difficulty.update(2);
    difficulty.update(Number.NaN);
    difficulty.update(-1);
    expect(difficulty.elapsed).toBe(2);
    difficulty.reset();
    expect(difficulty.elapsed).toBe(0);
    expect(difficulty.speed).toBe(RUN.initialSpeed);
  });
});
