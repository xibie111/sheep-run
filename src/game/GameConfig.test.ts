import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => {
  class Scene {} class Sprite {}
  return { default: { Scene, Physics: { Arcade: { Sprite } }, AUTO: "auto", Scale: { FIT: "fit", ENVELOP: "envelop", CENTER_BOTH: "center" } } };
});
vi.mock("../scenes/WardrobeScene", () => ({ WardrobeScene: class WardrobeScene {} }));
import { createGameConfig } from "./GameConfig";
import { WORLD } from "./Constants";

describe("mobile UI canvas configuration", () => {
  it("retains the simulation clock and existing scene navigation", () => {
    const config = createGameConfig({} as HTMLElement);
    expect(config.fps).toMatchObject({ min: 25, smoothStep: true });
    expect(config.scene).toHaveLength(7);
  });
  it.each([
    [960, 540, 480, 270], [1672, 941, 480, 270],
    [896, 414, 584, 270], [844, 390, 584, 270], [800, 600, 480, 360],
  ])("adapts %ix%i to %ix%i without stretching the baseline", (width, height, logicalWidth, logicalHeight) => {
    const config = createGameConfig({ clientWidth: width, clientHeight: height } as HTMLElement);
    expect(config.width).toBe(logicalWidth); expect(config.height).toBe(logicalHeight);
    expect(config.scale).toMatchObject({ mode: "fit", autoCenter: "center", autoRound: true, width: logicalWidth, height: logicalHeight });
    expect(config.render).toMatchObject({ pixelArt: true, roundPixels: true, antialias: false, antialiasGL: false });
    expect(config.input).toMatchObject({ mouse: false, keyboard: false, touch: { capture: true } });
  });
  it("uses 480x270 before a valid parent size is available", () => {
    const config = createGameConfig({} as HTMLElement);
    expect(config.width).toBe(WORLD.width);
    expect(config.height).toBe(WORLD.height);
  });
});
