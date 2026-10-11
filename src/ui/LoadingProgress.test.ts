import { describe, expect, it } from "vitest";
import { LoadingProgress } from "./LoadingProgress";

describe("loading progress follows completed work", () => {
  it("reserves the last 15 percent for preparation and reaches 100 only on completion", () => {
    const progress = new LoadingProgress();
    expect(progress.snapshot()).toMatchObject({ stage: "boot", percent: 0, indeterminate: true });
    progress.assets(0.5);
    expect(progress.snapshot()).toMatchObject({ stage: "assets", percent: 42, indeterminate: false });
    progress.assets(1);
    expect(progress.snapshot().percent).toBe(85);
    progress.preparing(0, 9);
    expect(progress.snapshot()).toMatchObject({ stage: "preparing", percent: 85 });
    progress.preparing(5, 9);
    expect(progress.snapshot().percent).toBe(92);
    progress.preparing(9, 9);
    expect(progress.snapshot().percent).toBe(99);
    progress.complete();
    expect(progress.snapshot()).toMatchObject({ stage: "ready", percent: 100 });
  });
  it("ignores regressions, invalid values and late asset notifications", () => {
    const progress = new LoadingProgress();
    progress.assets(NaN); progress.assets(Infinity); progress.preparing(1, 0);
    expect(progress.snapshot().stage).toBe("boot");
    progress.assets(0.6); progress.assets(0.2);
    expect(progress.snapshot().percent).toBe(51);
    progress.preparing(5, 10); progress.assets(0.8); progress.preparing(1, 10);
    expect(progress.snapshot()).toMatchObject({ stage: "preparing", percent: 92 });
    progress.complete(); progress.assets(0); progress.preparing(0, 9);
    expect(progress.snapshot()).toMatchObject({ stage: "ready", percent: 100 });
  });
  it("freezes on failure and resets for a real retry", () => {
    const progress = new LoadingProgress();
    progress.assets(0.5); progress.fail();
    progress.assets(1); progress.preparing(9, 9); progress.complete();
    expect(progress.snapshot()).toMatchObject({ stage: "error", percent: 42 });
    progress.reset(); progress.assets(0.1);
    expect(progress.snapshot()).toMatchObject({ stage: "assets", percent: 8 });
  });
});
