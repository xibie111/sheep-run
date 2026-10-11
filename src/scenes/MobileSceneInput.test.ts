import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Scene: class Scene {},
    Input: { Events: {}, Keyboard: { Events: { ANY_KEY_DOWN: "keydown" } } },
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
  },
}));

import { MenuScene } from "./MenuScene";
import { PauseScene } from "./PauseScene";
import { ResultScene } from "./ResultScene";

describe("mobile scene input boundary", () => {
  it.each([
    ["menu", MenuScene],
    ["pause", PauseScene],
    ["result", ResultScene],
  ])("does not retain keyboard listeners in the %s scene", (_name, SceneClass) => {
    const source = (SceneClass.prototype as unknown as { create?: () => void }).create?.toString() ?? "";
    expect(source).not.toContain("input.keyboard");
    expect(source).not.toContain("onKeyDown");
    expect(source).not.toContain("keydown");
  });
});
