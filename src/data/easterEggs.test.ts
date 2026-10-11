import { describe, expect, it } from "vitest";
import { isBedtime, MenuEggTaps, resultWhisper, ScoreEggTracker } from "./easterEggs";

describe("cosmetic love-letter triggers", () => {
  it("requires three completed touches and supports a later rediscovery", () => {
    const taps = new MenuEggTaps();
    expect([100, 250, 400, 700, 800, 900].map(now => taps.touch(now))).toEqual([false, false, true, false, false, true]);
  });
  it("starts a new sequence after a long gap or a backwards clock", () => {
    const taps = new MenuEggTaps();
    expect([100, 200, 2100, 2200, 100, 200, 300].map(now => taps.touch(now))).toEqual([false, false, false, false, false, false, true]);
  });
  it("ignores invalid touch times", () => { expect(new MenuEggTaps().touch(NaN)).toBe(false); });
  it("handles bonus jumps across a score threshold only once", () => {
    const tracker = new ScoreEggTracker();
    expect(tracker.observe(519)).toEqual([]);
    expect(tracker.observe(544).map(e => e.score)).toEqual([520]);
    expect(tracker.observe(544)).toEqual([]);
    expect(tracker.observe(1315).map(e => e.score)).toEqual([1314]);
    expect(tracker.observe(2000)).toEqual([]);
  });
  it("queues skipped thresholds in order and allows them again in a new run", () => {
    expect(new ScoreEggTracker().observe(1500).map(e => e.score)).toEqual([520, 1314]);
    expect(new ScoreEggTracker().observe(520).map(e => e.score)).toEqual([520]);
  });
  it("does not trigger on negative or invalid scores", () => {
    const tracker = new ScoreEggTracker();
    expect(tracker.observe(NaN)).toEqual([]); expect(tracker.observe(Infinity)).toEqual([]); expect(tracker.observe(-1)).toEqual([]);
  });
});

describe("personal menu and result messages", () => {
  it("starts bedtime at 20:00, ends at 06:00, and includes midnight", () => {
    expect([19, 20, 23, 0, 5, 6, 12].map(isBedtime)).toEqual([false, true, true, true, true, false, false]);
    expect([NaN, Infinity, -1, 24, 20.5].map(isBedtime)).toEqual([false, false, false, false, false]);
  });
  it("uses encouragement and record praise without depending on score or rewards", () => {
    expect(resultWhisper(false)).toBe("没关系，我陪催眠羊再跑一次。");
    expect(resultWhisper(true)).toBe("催眠羊真厉害！");
  });
});
