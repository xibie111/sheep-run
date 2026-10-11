import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoreSystem } from "./ScoreSystem";

describe("ScoreSystem star progress", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves distance and obstacle/star bonuses", () => {
    const score = new ScoreSystem();

    score.update(190, 1000);
    expect(score.score).toBe(22);
    expect(score.awardPassedObstacle()).toBe(47);
    expect(score.awardStar().score).toBe(147);
  });

  it("exposes bonus-independent physical distance for atmosphere scheduling", () => {
    const score = new ScoreSystem();

    score.update(190, 1000);
    expect(score.travelledDistancePx).toBeCloseTo(190);
    score.awardPassedObstacle();
    score.awardStar();
    expect(score.travelledDistancePx).toBeCloseTo(190);

    score.update(200, 500);
    expect(score.travelledDistancePx).toBeCloseTo(290);
    score.beginRun();
    expect(score.travelledDistancePx).toBe(0);
  });

  it("persists one lifetime star and applies the active score multiplier", () => {
    const score = new ScoreSystem();

    expect(score.awardStar(2)).toMatchObject({ score: 200, starCount: 1, streak: 1 });
    const saved = vi.mocked(window.localStorage.setItem).mock.calls
      .map(([, value]) => JSON.parse(value) as { totalStars?: number })
      .some((value) => value.totalStars === 1);
    expect(saved).toBe(true);
  });

  it("fires per-run milestones only at 10, 20, and 30 stars", () => {
    const score = new ScoreSystem();
    const milestones: Array<number | null> = [];

    for (let star = 1; star <= 30; star += 1) {
      milestones.push(score.awardStar().milestone);
    }

    expect(milestones.filter((milestone) => milestone !== null)).toEqual([10, 20, 30]);
    expect(score.starCount).toBe(30);
  });

  it("resets only the streak when a star is missed", () => {
    const score = new ScoreSystem();

    score.awardStar();
    score.awardStar();
    score.missStar();

    expect(score.starCount).toBe(2);
    expect(score.streak).toBe(0);
    expect(score.awardStar()).toMatchObject({ starCount: 3, streak: 1, milestone: null });
  });

  it("keeps the current-run best visible when storage writes fail", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error("storage blocked"); },
      },
    });
    const score = new ScoreSystem();
    score.update(190, 1_000);

    expect(score.finish()).toEqual({ score: 22, best: 22, newRecord: true, saveFailed: true });
  });

  it("reports an earlier lost star write even if storage recovers before settlement", () => {
    const values = new Map<string, string>([["sheep-run-save", JSON.stringify({ version: 4, highScore: 0 })]]);
    let blocked = true;
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { if (blocked) throw new Error("full"); values.set(key, value); },
    } });
    const score = new ScoreSystem();
    score.awardStar();
    blocked = false;

    expect(score.finish()).toMatchObject({ score: 100, saveFailed: true });
    expect(JSON.parse(values.get("sheep-run-save")!).totalStars).toBe(0);
    score.beginRun();
    expect(score.finish()).not.toHaveProperty("saveFailed");
  });

  it("resets per-run progress when a new run begins", () => {
    const score = new ScoreSystem();
    score.awardStar();
    score.awardStar();
    score.beginRun();

    expect(score.starCount).toBe(0);
    expect(score.streak).toBe(0);
    expect(score.score).toBe(0);
  });
});
