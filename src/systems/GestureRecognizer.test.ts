import { describe, expect, it } from "vitest";
import { GestureRecognizer } from "./GestureRecognizer";

const down = (recognizer: GestureRecognizer, pointerId = 1, at = 0, x = 100, y = 100): void => {
  recognizer.handle({ type: "down", pointerId, x, y, at });
};

describe("GestureRecognizer", () => {
  it("maps a short, low-travel release to a normal jump", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "up", pointerId: 1, x: 108, y: 104, at: 200 }))
      .toEqual([{ type: "jump" }]);
  });

  it("locks an upward swipe and emits only one high jump", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "move", pointerId: 1, x: 104, y: 70, at: 120 }))
      .toEqual([{ type: "high-jump" }]);
    expect(recognizer.handle({ type: "move", pointerId: 1, x: 105, y: 42, at: 160 })).toEqual([]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 105, y: 42, at: 180 })).toEqual([]);
  });

  it("locks a downward swipe as one crouch action", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "move", pointerId: 1, x: 103, y: 132, at: 120 }))
      .toEqual([{ type: "crouch" }]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 103, y: 132, at: 180 })).toEqual([]);
  });

  it("starts dash only after a stationary hold reaches its threshold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "tick", at: 259 })).toEqual([]);
    expect(recognizer.handle({ type: "tick", at: 260 })).toEqual([{ type: "dash-start" }]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 100, at: 300 }))
      .toEqual([{ type: "dash-end" }]);
  });

  it("starts and ends dash when pointer release lands exactly on the Hold threshold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 100, at: 260 }))
      .toEqual([{ type: "dash-start" }, { type: "dash-end" }]);
  });

  it("gives a clear swipe priority over the pending hold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 70, at: 259 }))
      .toEqual([{ type: "high-jump" }]);
    expect(recognizer.handle({ type: "tick", at: 260 })).toEqual([]);
  });

  it("starts the hold before a late swipe is classified at the threshold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 70, at: 260 }))
      .toEqual([{ type: "dash-start" }]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 70, at: 270 }))
      .toEqual([{ type: "dash-end" }]);
  });

  it("does not classify an exact 20px release as a tap", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "up", pointerId: 1, x: 120, y: 100, at: 100 }))
      .toEqual([]);
  });

  it.each([
    { direction: -1, action: "high-jump" },
    { direction: 1, action: "crouch" },
  ] as const)("recognizes a continuous swipe as one $action after crossing the tap boundary", ({ direction, action }) => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    for (const distance of [10, 20, 21, 22, 27]) {
      expect(recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 100 + direction * distance, at: distance * 3 }))
        .toEqual([]);
    }
    expect(recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 100 + direction * 28, at: 100 }))
      .toEqual([{ type: action }]);
    expect(recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 100 + direction * 48, at: 140 })).toEqual([]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 100 + direction * 48, at: 180 })).toEqual([]);
  });

  it("does not turn an incomplete swipe returning to its origin into a tap or hold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);
    recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 122, at: 40 });
    recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 100, at: 80 });

    expect(recognizer.handle({ type: "tick", at: 260 })).toEqual([]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 100, at: 280 })).toEqual([]);
  });

  it("clears a continuous swipe on cancellation before it reaches the swipe threshold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);
    recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 78, at: 40 });

    expect(recognizer.handle({ type: "cancel" })).toEqual([]);
    expect(recognizer.handle({ type: "move", pointerId: 1, x: 100, y: 52, at: 80 })).toEqual([]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 52, at: 100 })).toEqual([]);
    down(recognizer, 2, 120);
    expect(recognizer.handle({ type: "up", pointerId: 2, x: 100, y: 100, at: 160 })).toEqual([{ type: "jump" }]);
  });

  it("does not dash after moving exactly 20px before the hold threshold", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);
    expect(recognizer.handle({ type: "move", pointerId: 1, x: 120, y: 100, at: 259 })).toEqual([]);
    expect(recognizer.handle({ type: "tick", at: 260 })).toEqual([]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 120, y: 100, at: 270 })).toEqual([]);
  });

  it("starts and ends a hold before classifying a threshold-frame release swipe", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 70, at: 260 }))
      .toEqual([{ type: "dash-start" }, { type: "dash-end" }]);
  });

  it("ignores ambiguous movement and unrelated pointers", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);

    expect(recognizer.handle({ type: "move", pointerId: 2, x: 100, y: 60, at: 80 })).toEqual([]);
    expect(recognizer.handle({ type: "move", pointerId: 1, x: 130, y: 80, at: 80 })).toEqual([]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 130, y: 80, at: 100 })).toEqual([]);
  });

  it("ends a held dash and clears the pointer when cancelled", () => {
    const recognizer = new GestureRecognizer();
    down(recognizer);
    recognizer.handle({ type: "tick", at: 260 });

    expect(recognizer.handle({ type: "cancel" })).toEqual([{ type: "dash-end" }]);
    expect(recognizer.handle({ type: "up", pointerId: 1, x: 100, y: 100, at: 300 })).toEqual([]);
  });
});
