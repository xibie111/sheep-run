import { describe, expect, it } from "vitest";
import { sheepAnimationForState } from "./SheepAnimation";

describe("sheep animation state mapping", () => {
  it.each([
    ["IDLE", "sheep-idle"],
    ["RUNNING", "sheep-run"],
    ["JUMPING", "sheep-jump"],
    ["FALLING", "sheep-fall"],
    ["HIT", "sheep-hit"],
    ["DASH", "sheep-dash"],
    ["DEAD", "sheep-dead"],
  ] as const)("maps %s to %s", (state, animation) => {
    expect(sheepAnimationForState(state)).toBe(animation);
  });

  it("names non-default skin animations without changing the white defaults", () => {
    expect(sheepAnimationForState("RUNNING", "white")).toBe("sheep-run");
    expect(sheepAnimationForState("RUNNING", "black")).toBe("sheep-black-run");
    expect(sheepAnimationForState("JUMPING", "farmer")).toBe("sheep-farmer-jump");
  });
});
