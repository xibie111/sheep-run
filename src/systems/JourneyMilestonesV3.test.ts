import { describe, expect, it, vi } from "vitest";
import { JOURNEY_MILESTONES_V3 } from "../data/journeyMilestonesV3";
import { ACHIEVEMENTS, type AchievementId } from "../data/journeyBook";
import { SHEEP_SKINS } from "../data/sheepSkins";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { JourneyRun, JourneyStore, JOURNEY_STORAGE_KEY, achievementProgress } from "./JourneyStore";

const today = "2026-10-13", oldDate = "2026-10-08";
const economy = '{"version":5,"totalStars":33,"spentStars":5,"coins":88,"selectedSkin":"white"}';
const skins = SHEEP_SKINS.map(skin => skin.id);
const previousSatisfiedIds = [
  "first-run", "first-friend", "five-friends", "ten-stars", "twenty-obstacles", "first-record", "four-seasons", "five-skins",
  "five-runs", "twenty-runs", "twenty-friends", "twenty-five-stars", "fifty-stars", "fifty-obstacles", "ten-skins",
  "spring-collector", "summer-collector", "autumn-collector", "winter-collector", "all-collections", "two-seasons",
] as const;

function fixture() {
  const values = new Map<string, string>([["sheep-run-save", economy]]);
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
  return { values, storage, store: new JourneyStore(() => storage, () => today) };
}

function untouchedEconomy(f: ReturnType<typeof fixture>) {
  expect(f.values.get("sheep-run-save")).toBe(economy);
  expect(f.storage.getItem.mock.calls.every(([key]) => key === JOURNEY_STORAGE_KEY)).toBe(true);
  expect(f.storage.setItem.mock.calls.every(([key]) => key === JOURNEY_STORAGE_KEY)).toBe(true);
}

describe("twelve early and intermediate achievement boundaries", () => {
  it.each(JOURNEY_MILESTONES_V3)("observes $id exactly at $goal and retains one notification, date and read marker", stamp => {
    const f = fixture(), notify = vi.fn(), run = new JourneyRun(f.store, notify);
    const id = stamp.id as AchievementId;
    let observed = 0;
    const observeTo = (count: number) => {
      while (observed < count) {
        observed++;
        switch (stamp.metric) {
          case "runs": new JourneyRun(f.store, notify).finish(false); break;
          case "summons": run.summon(); break;
          case "stars": run.star(); break;
          case "obstacles": run.passed(); break;
          case "skins": run.collected(f.store.reconcile(skins.slice(0, observed), [])); break;
          case "seasons": run.visit(SEASON_ORDER[observed - 1]!); break;
        }
      }
    };
    observeTo(stamp.goal - 1);
    expect(f.store.load().achieved[id]).toBeUndefined();
    expect(achievementProgress(f.store.load(), id)).toBe(stamp.goal - 1);
    expect(notify.mock.calls.flatMap(([ids]) => ids).includes(id)).toBe(false);
    observeTo(stamp.goal);
    expect(f.store.load().achieved[id]).toBe(today);
    expect(achievementProgress(f.store.load(), id)).toBe(stamp.goal);
    f.store.readAchievement(id); observeTo(stamp.goal + 1);
    expect(achievementProgress(f.store.load(), id)).toBe(stamp.goal);
    expect(notify.mock.calls.flatMap(([ids]) => ids).filter(value => value === id)).toHaveLength(1);
    const later = new JourneyStore(() => f.storage, () => "2026-12-31");
    expect(later.reconcile([], [])).toEqual([]);
    expect(later.load().achieved[id]).toBe(today);
    expect(later.load().readAchievements).toContain(id);
    later.readAchievement(id);
    expect(later.load().readAchievements.filter(value => value === id)).toHaveLength(1);
    untouchedEconomy(f);
  });
});

describe("intermediate milestones preserve the established journal rules", () => {
  it("uses actual records from a 32-stamp release v1 save to backfill ten goals, without inventing fifteen or twenty-five skins", () => {
    const f = fixture();
    // This save comes from the 32-stamp release. Its observed statistics earned
    // the original twenty goals plus two seasons, not every old catalog item.
    const old = {
      version: 1, runs: 20, summons: 20, stars: 50, obstacles: 50, record: true, skins: 10,
      seasons: ["winter", "spring", "summer", "autumn"],
      achieved: Object.fromEntries(previousSatisfiedIds.map(id => [id, oldDate])),
      rewards: { spring: oldDate, summer: oldDate, autumn: oldDate, winter: oldDate, all: oldDate },
      readAchievements: ["first-run", "fifty-stars", "two-seasons"], readRewards: ["winter", "all"],
    };
    f.values.set(JOURNEY_STORAGE_KEY, JSON.stringify(old));
    expect(f.store.load().saveFailed).toBe(false);
    expect(f.store.reconcile([], [])).toEqual([
      "three-runs", "ten-runs", "ten-friends", "five-stars", "fifteen-stars", "thirty-five-stars",
      "five-obstacles", "ten-obstacles", "thirty-five-obstacles", "three-seasons",
    ]);
    const next = f.store.load();
    expect(next.achieved["fifteen-skins" as AchievementId]).toBeUndefined();
    expect(next.achieved["twenty-five-skins" as AchievementId]).toBeUndefined();
    expect(achievementProgress(next, "fifteen-skins" as AchievementId)).toBe(10);
    expect(achievementProgress(next, "twenty-five-skins" as AchievementId)).toBe(10);
    for (const id of previousSatisfiedIds) expect(next.achieved[id]).toBe(oldDate);
    for (const id of ["seventy-five-stars", "hundred-stars", "hundred-obstacles", "one-hundred-fifty-obstacles"] as const) {
      expect(next.achieved[id]).toBeUndefined(); expect(achievementProgress(next, id)).toBe(50);
    }
    expect(next.stars).toBe(50); expect(next.obstacles).toBe(50); expect(next.skins).toBe(10);
    expect(next.seasons).toEqual(old.seasons); expect(next.rewards).toEqual(old.rewards);
    expect(next.readAchievements).toEqual(old.readAchievements); expect(next.readRewards).toEqual(old.readRewards);
    const persisted = JSON.parse(f.values.get(JOURNEY_STORAGE_KEY)!);
    expect(persisted.version).toBe(1);
    expect(Object.keys(persisted).sort()).toEqual(Object.keys(old).sort());
    const later = new JourneyStore(() => f.storage, () => "2026-12-31");
    expect(later.reconcile([], [])).toEqual([]); expect(later.load().achieved).toEqual(next.achieved);
    untouchedEconomy(f);
  });

  it.each([5, 15, 35])("does not combine two separate runs into a %i-star goal", goal => {
    const f = fixture(), first = new JourneyRun(f.store);
    for (let i = 0; i < goal - 1; i++) first.star(); first.finish(false);
    const second = new JourneyRun(f.store); second.star(); second.finish(false);
    const id = JOURNEY_MILESTONES_V3.find(stamp => stamp.metric === "stars" && stamp.goal === goal)!.id as AchievementId;
    expect(f.store.load().stars).toBe(goal - 1); expect(f.store.load().achieved[id]).toBeUndefined();
    untouchedEconomy(f);
  });

  it.each([5, 10, 35])("does not combine two separate runs into a %i-pass goal", goal => {
    const f = fixture(), first = new JourneyRun(f.store);
    for (let i = 0; i < goal - 1; i++) first.passed(); first.finish(false);
    const second = new JourneyRun(f.store); second.passed(); second.finish(false);
    const id = JOURNEY_MILESTONES_V3.find(stamp => stamp.metric === "obstacles" && stamp.goal === goal)!.id as AchievementId;
    expect(f.store.load().obstacles).toBe(goal - 1); expect(f.store.load().achieved[id]).toBeUndefined();
    untouchedEconomy(f);
  });

  it("keeps observing high milestones after the new early goals and retains the original 100-star and 150-pass caps", () => {
    const f = fixture(), notify = vi.fn(), run = new JourneyRun(f.store, notify);
    for (let i = 0; i < 125; i++) run.star();
    for (let i = 0; i < 180; i++) run.passed();
    expect(f.store.load().stars).toBe(100); expect(f.store.load().obstacles).toBe(150);
    for (const stamp of ACHIEVEMENTS.filter(item => item.metric === "stars" || item.metric === "obstacles")) {
      expect(f.store.load().achieved[stamp.id]).toBe(today);
      expect(achievementProgress(f.store.load(), stamp.id)).toBe(stamp.goal);
      expect(notify.mock.calls.flatMap(([ids]) => ids).filter(value => value === stamp.id)).toHaveLength(1);
    }
    untouchedEconomy(f);
  });

  it("counts fourteen/fifteen and twenty-four/twenty-five distinct valid skins while retaining the twenty/thirty goals", () => {
    const f = fixture(); expect(skins.length).toBeGreaterThanOrEqual(30);
    const reconcile = (count: number) => f.store.reconcile([
      ...skins.slice(0, count), ...skins.slice(0, count), "future-skin", null, {}, 42,
    ], []);
    reconcile(14);
    expect(f.store.load().skins).toBe(14); expect(f.store.load().achieved["fifteen-skins" as AchievementId]).toBeUndefined();
    expect(reconcile(15)).toEqual(["fifteen-skins"]);
    f.store.readAchievement("fifteen-skins" as AchievementId);
    expect(reconcile(20)).toEqual(["twenty-skins"]);
    expect(reconcile(24)).toEqual([]); expect(f.store.load().skins).toBe(24);
    expect(f.store.load().achieved["twenty-five-skins" as AchievementId]).toBeUndefined();
    expect(reconcile(25)).toEqual(["twenty-five-skins"]);
    expect(reconcile(30)).toEqual(["thirty-skins"]);
    expect(reconcile(5)).toEqual([]); expect(f.store.load().skins).toBe(30);
    expect(f.store.load().readAchievements).toContain("fifteen-skins");
    untouchedEconomy(f);
  });

  it("observes three different seasons across runs without counting repeated visits and preserves the two/four-season milestones", () => {
    const f = fixture(), first = new JourneyRun(f.store), notify = vi.fn();
    expect(ACHIEVEMENTS.find(stamp => stamp.id === ("three-seasons" as AchievementId))?.condition).toBe("累计到达三个不同季节");
    first.visit("winter"); first.visit("winter"); first.visit("spring"); first.finish(false);
    expect(f.store.load().seasons).toEqual(["winter", "spring"]);
    expect(f.store.load().achieved["two-seasons"]).toBe(today);
    expect(f.store.load().achieved["three-seasons" as AchievementId]).toBeUndefined();
    const second = new JourneyRun(f.store, notify); second.visit("spring"); second.visit("winter");
    expect(achievementProgress(f.store.load(), "three-seasons" as AchievementId)).toBe(2);
    second.visit("autumn"); second.visit("autumn");
    expect(notify).toHaveBeenCalledExactlyOnceWith(["three-seasons"]);
    expect(f.store.load().seasons).toEqual(["winter", "spring", "autumn"]);
    expect(f.store.load().achieved["four-seasons"]).toBeUndefined();
    second.visit("summer"); expect(f.store.load().achieved["four-seasons"]).toBe(today);
    expect(second.finish(false)).toEqual(["three-seasons", "four-seasons"]);
    untouchedEconomy(f);
  });

  it.each(["finish", "clear"] as const)("freezes pending new early goals after %s", mode => {
    const f = fixture(), notify = vi.fn(), run = new JourneyRun(f.store, notify);
    for (let i = 0; i < 4; i++) { run.star(); run.passed(); }
    run.visit("winter"); run.visit("spring");
    mode === "finish" ? run.finish(false) : run.clear();
    const before = f.store.load(); notify.mockClear();
    run.star(); run.passed(); run.visit("autumn"); run.summon();
    run.collected(["five-stars" as AchievementId]); run.finish(true);
    expect(f.store.load()).toEqual(before); expect(notify).not.toHaveBeenCalled();
    for (const id of ["five-stars", "five-obstacles", "three-seasons"] as const) expect(before.achieved[id as AchievementId]).toBeUndefined();
    expect(before.runs).toBe(mode === "finish" ? 1 : 0); expect(before.record).toBe(false);
    untouchedEconomy(f);
  });

  it("preserves the old journal during write denial, then persists session milestones once after recovery", () => {
    const f = fixture(), { saveFailed: _saveFailed, ...empty } = f.store.load();
    const raw = JSON.stringify(empty); f.values.set(JOURNEY_STORAGE_KEY, raw);
    f.storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    const run = new JourneyRun(f.store);
    for (let i = 0; i < 35; i++) { run.star(); run.passed(); }
    const failed = f.store.load();
    expect(failed.saveFailed).toBe(true); expect(f.values.get(JOURNEY_STORAGE_KEY)).toBe(raw);
    expect(failed.achieved["thirty-five-stars" as AchievementId]).toBe(today);
    expect(failed.achieved["thirty-five-obstacles" as AchievementId]).toBe(today);
    f.storage.setItem.mockImplementation((key, value) => { f.values.set(key, value); });
    expect(f.store.reconcile([], [])).toEqual([]);
    expect(f.store.load()).toEqual({ ...failed, saveFailed: false });
    expect(new JourneyStore(() => f.storage, () => "2026-12-31").load()).toEqual(f.store.load());
    untouchedEconomy(f);
  });

  it("preserves unknown future journals while retaining new early observations in the current session", () => {
    const f = fixture(), { saveFailed: _saveFailed, ...empty } = f.store.load();
    const raw = JSON.stringify({ ...empty, achieved: { "future-stamp": oldDate } });
    f.values.set(JOURNEY_STORAGE_KEY, raw); f.store.runBest(35, 35);
    const next = f.store.load();
    expect(next.saveFailed).toBe(true); expect(f.values.get(JOURNEY_STORAGE_KEY)).toBe(raw);
    expect(next.achieved["thirty-five-stars" as AchievementId]).toBe(today);
    expect(next.achieved["thirty-five-obstacles" as AchievementId]).toBe(today);
    expect(f.storage.setItem).not.toHaveBeenCalled(); untouchedEconomy(f);
  });
});
