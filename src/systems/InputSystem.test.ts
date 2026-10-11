import { describe, expect, it } from "vitest";
import { InputSystem, JumpTiming } from "./InputSystem";

describe("JumpTiming", () => {
  it("allows a jump request through the exact coyote-time boundary", () => {
    const timing = new JumpTiming();
    timing.noteGrounded(100);

    expect(timing.request("normal", 220, false)).toBe(true);
  });

  it("rejects a jump request just beyond the coyote-time boundary", () => {
    const timing = new JumpTiming();
    timing.noteGrounded(100);

    expect(timing.request("normal", 221, false)).toBe(false);
    expect(timing.consumeBuffered(341, true)).toBe("normal");
  });

  it("buffers a high jump until the exact landing-window boundary", () => {
    const timing = new JumpTiming();

    expect(timing.request("high", 50, false)).toBe(false);
    expect(timing.consumeBuffered(170, true)).toBe("high");
    expect(timing.consumeBuffered(171, true)).toBeNull();
  });

  it("expires a buffered jump after the configured window", () => {
    const timing = new JumpTiming();

    timing.request("normal", 50, false);
    expect(timing.consumeBuffered(171, true)).toBeNull();
  });
});

describe("InputSystem", () => {
  it("exposes no keyboard input API", () => {
    const input = new InputSystem(true);

    expect(input).not.toHaveProperty("keyDown");
    expect(input).not.toHaveProperty("keyUp");
  });

  it("routes a short full-surface tap to a normal jump", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 80, y: 100, at: 0 });
    input.handleGesture({ type: "up", pointerId: 1, x: 80, y: 100, at: 120 });

    expect(input.update(120, true).jump).toBe("normal");
  });

  it("starts touch dash after Hold and ends its window independently", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 80, y: 100, at: 0 });
    expect(input.update(259, true).dashing).toBe(false);
    expect(input.update(260, true)).toMatchObject({ dashing: true, dashInvulnerable: true });
    expect(input.update(540, true)).toMatchObject({ dashing: true, dashInvulnerable: false });
    input.handleGesture({ type: "up", pointerId: 1, x: 80, y: 100, at: 550 });
    expect(input.update(550, true).dashing).toBe(false);
  });

  it("stops obstacle immunity when a held touch dash is released early", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 80, y: 100, at: 0 });
    expect(input.update(260, true)).toMatchObject({ dashing: true, dashInvulnerable: true });
    input.handleGesture({ type: "up", pointerId: 1, x: 80, y: 100, at: 300 });

    expect(input.update(300, true)).toMatchObject({ dashing: false, dashInvulnerable: false });
    expect(input.isObstacleImmune(300)).toBe(false);
  });

  it("does not grant post-release immunity on the exact touch-hold threshold", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 80, y: 100, at: 0 });
    input.handleGesture({ type: "up", pointerId: 1, x: 80, y: 100, at: 260 });

    expect(input.update(260, true)).toMatchObject({ dashing: false, dashInvulnerable: false });
    expect(input.isObstacleImmune(260)).toBe(false);
  });

  it("keeps swipe crouch active only for its configured duration", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 100, y: 100, at: 0 });
    input.handleGesture({ type: "move", pointerId: 1, x: 100, y: 130, at: 100 });

    expect(input.update(100, true).crouching).toBe(true);
    expect(input.update(419, true).crouching).toBe(true);
    expect(input.update(420, true).crouching).toBe(false);
  });

  it("keeps swipe crouch active only for its configured duration after a second touch is ignored", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 100, y: 100, at: 0 });
    input.handleGesture({ type: "move", pointerId: 1, x: 100, y: 130, at: 80 });
    expect(input.update(80, true).crouching).toBe(true);

    input.handleGesture({ type: "down", pointerId: 2, x: 100, y: 100, at: 100 });
    expect(input.update(399, true).crouching).toBe(true);
    expect(input.update(400, true).crouching).toBe(false);
  });

  it("clears the active touch hold when its pointer is canceled", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 80, y: 100, at: 0 });
    expect(input.update(260, true).dashing).toBe(true);
    input.cancel();

    expect(input.update(261, true)).toMatchObject({ dashing: false, dashInvulnerable: false, crouching: false });
  });

  it("buffers the gesture kind and clears held states on cancellation", () => {
    const input = new InputSystem(true);
    input.handleGesture({ type: "down", pointerId: 1, x: 100, y: 100, at: 0 });
    input.handleGesture({ type: "move", pointerId: 1, x: 100, y: 70, at: 80 });
    expect(input.update(80, false).jump).toBeNull();
    expect(input.update(200, true).jump).toBe("high");

    input.handleGesture({ type: "down", pointerId: 3, x: 100, y: 100, at: 240 });
    input.cancel();
    expect(input.update(301, true)).toMatchObject({ dashing: false, dashInvulnerable: false, crouching: false });
  });
});

describe("InputSystem default Dash gate", () => {
  it("ignores a stationary hold action by default", () => {
    const input = new InputSystem();
    input.handleGesture({ type: "down", pointerId: 1, x: 80, y: 100, at: 0 });

    expect(input.update(259, true).dashing).toBe(false);
    expect(input.update(260, true)).toMatchObject({ dashing: false, dashInvulnerable: false });
  });


});
