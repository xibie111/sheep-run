import { describe, expect, it, vi } from "vitest";
import { EXPANDED_ACHIEVEMENTS } from "../data/expandedAchievements";
import { ACHIEVEMENTS, type AchievementId } from "../data/journeyBook";
import { SHEEP_SKINS } from "../data/sheepSkins";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { JourneyRun, JourneyStore, JOURNEY_STORAGE_KEY, achievementProgress } from "./JourneyStore";

const today = "2026-10-13", oldDate = "2026-10-05";
const economy = '{"version":4,"coins":77,"totalStars":51,"selectedSkin":"white"}';
const skinIds = SHEEP_SKINS.map(skin => skin.id);
const oldIds = [
  "first-run", "first-friend", "five-friends", "ten-stars", "twenty-obstacles", "first-record", "four-seasons", "five-skins",
  "five-runs", "twenty-runs", "twenty-friends", "twenty-five-stars", "fifty-stars", "fifty-obstacles", "ten-skins",
  "spring-collector", "summer-collector", "autumn-collector", "winter-collector", "all-collections",
] as const;

function fixture() {
  const values = new Map<string, string>([["sheep-run-save", economy]]);
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
  return { values, storage, store: new JourneyStore(() => storage, () => today) };
}

function expectEconomyUntouched(f: ReturnType<typeof fixture>) {
  expect(f.values.get("sheep-run-save")).toBe(economy);
  expect(f.storage.getItem.mock.calls.every(([key]) => key === JOURNEY_STORAGE_KEY)).toBe(true);
  expect(f.storage.setItem.mock.calls.every(([key]) => key === JOURNEY_STORAGE_KEY)).toBe(true);
}

describe("twelve additional cosmetic achievement boundaries", () => {
  it.each(EXPANDED_ACHIEVEMENTS)("unlocks $id at $goal once, preserving its date and read marker", stamp => {
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
          case "skins": run.collected(f.store.reconcile(skinIds.slice(0, observed), [])); break;
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
    f.store.readAchievement(id);
    observeTo(stamp.goal + 1);
    expect(achievementProgress(f.store.load(), id)).toBe(stamp.goal);
    expect(notify.mock.calls.flatMap(([ids]) => ids).filter(value => value === id)).toHaveLength(1);

    const later = new JourneyStore(() => f.storage, () => "2026-12-31");
    expect(later.reconcile([], [])).toEqual([]);
    const reloaded = later.load();
    expect(reloaded.achieved[id]).toBe(today);
    expect(reloaded.readAchievements).toContain(id);
    later.readAchievement(id);
    expect(later.load().readAchievements.filter(value => value === id)).toHaveLength(1);
    expectEconomyUntouched(f);
  });
});

describe("expanded achievements preserve v1 progress semantics", () => {
  it("backfills recorded lifetime goals from an old twenty-stamp save without inventing larger single-run records", () => {
    const f = fixture();
    const old = {
      version: 1, runs: 250, summons: 100, stars: 50, obstacles: 50, record: true,
      seasons: [...SEASON_ORDER], skins: 30,
      achieved: Object.fromEntries(oldIds.map(id => [id, oldDate])),
      rewards: { spring: oldDate, summer: oldDate, autumn: oldDate, winter: oldDate, all: oldDate },
      readAchievements: ["first-run", "five-skins", "all-collections"], readRewards: ["spring", "all"],
    };
    f.values.set(JOURNEY_STORAGE_KEY, JSON.stringify(old));
    expect(f.store.load().saveFailed).toBe(false);
    expect(f.store.reconcile([], [])).toEqual([
      "fifty-runs", "hundred-runs", "two-hundred-fifty-runs", "fifty-friends", "hundred-friends",
      "twenty-skins", "thirty-skins", "two-seasons",
      "three-runs", "ten-runs", "ten-friends", "five-stars", "fifteen-stars", "thirty-five-stars",
      "five-obstacles", "ten-obstacles", "thirty-five-obstacles", "fifteen-skins", "twenty-five-skins", "three-seasons",
    ]);
    const next = f.store.load();
    for (const id of oldIds) expect(next.achieved[id]).toBe(oldDate);
    for (const id of ["seventy-five-stars", "hundred-stars", "hundred-obstacles", "one-hundred-fifty-obstacles"] as const) {
      expect(next.achieved[id as AchievementId]).toBeUndefined();
      expect(achievementProgress(next, id as AchievementId)).toBe(50);
    }
    expect(next.stars).toBe(50); expect(next.obstacles).toBe(50);
    expect(next.readAchievements).toEqual(old.readAchievements);
    expect(next.readRewards).toEqual(old.readRewards); expect(next.rewards).toEqual(old.rewards);
    const persisted = JSON.parse(f.values.get(JOURNEY_STORAGE_KEY)!);
    expect(Object.keys(persisted).sort()).toEqual(Object.keys(old).sort()); expect(persisted.version).toBe(1);
    const later = new JourneyStore(() => f.storage, () => "2026-12-31");
    expect(later.reconcile([], [])).toEqual([]);
    expect(later.load().achieved).toEqual(next.achieved);
    expectEconomyUntouched(f);
  });

  it("never combines two runs into the new star or pass goals and observes a later complete run beyond fifty", () => {
    const f = fixture(), first = new JourneyRun(f.store);
    for (let i = 0; i < 74; i++) first.star();
    for (let i = 0; i < 99; i++) first.passed();
    first.finish(false);
    const second = new JourneyRun(f.store);
    for (let i = 0; i < 26; i++) second.star();
    for (let i = 0; i < 51; i++) second.passed();
    second.finish(false);
    expect(f.store.load().stars).toBe(74); expect(f.store.load().obstacles).toBe(99);
    for (const id of ["seventy-five-stars", "hundred-stars", "hundred-obstacles", "one-hundred-fifty-obstacles"] as const) {
      expect(f.store.load().achieved[id as AchievementId]).toBeUndefined();
    }
    const notify = vi.fn(), third = new JourneyRun(f.store, notify);
    for (let i = 0; i < 100; i++) third.star();
    for (let i = 0; i < 150; i++) third.passed();
    for (let i = 0; i < 20; i++) { third.star(); third.passed(); }
    expect(f.store.load().stars).toBe(100); expect(f.store.load().obstacles).toBe(150);
    for (const id of ["seventy-five-stars", "hundred-stars", "hundred-obstacles", "one-hundred-fifty-obstacles"] as const) {
      expect(f.store.load().achieved[id as AchievementId]).toBe(today);
      expect(notify.mock.calls.flatMap(([ids]) => ids).filter(value => value === id)).toHaveLength(1);
    }
    expectEconomyUntouched(f);
  });

  it.each(["finish", "clear"] as const)("freezes pending hundred-star and 150-pass goals after %s", mode => {
    const f = fixture(), notify = vi.fn(), run = new JourneyRun(f.store, notify);
    for (let i = 0; i < 99; i++) run.star();
    for (let i = 0; i < 149; i++) run.passed();
    run.visit("spring");
    mode === "finish" ? run.finish(false) : run.clear();
    const before = f.store.load(); notify.mockClear();
    run.star(); run.passed(); run.summon(); run.visit("winter");
    run.collected(["hundred-stars" as AchievementId]); run.finish(true);
    expect(f.store.load()).toEqual(before); expect(notify).not.toHaveBeenCalled();
    expect(before.achieved["hundred-stars" as AchievementId]).toBeUndefined();
    expect(before.achieved["one-hundred-fifty-obstacles" as AchievementId]).toBeUndefined();
    expect(before.runs).toBe(mode === "finish" ? 1 : 0); expect(before.record).toBe(false);
    expectEconomyUntouched(f);
  });

  it("deduplicates real skins at nineteen, twenty, twenty-nine and thirty without treating invalid values as ownership", () => {
    const f = fixture();
    expect(skinIds.length).toBeGreaterThanOrEqual(31);
    const reconcile = (count: number) => f.store.reconcile([
      ...skinIds.slice(0, count), ...skinIds.slice(0, count), "future-skin", null, {}, 42,
    ], []);
    reconcile(19);
    expect(f.store.load().skins).toBe(19);
    expect(f.store.load().achieved["twenty-skins" as AchievementId]).toBeUndefined();
    expect(reconcile(20)).toEqual(["twenty-skins"]);
    f.store.readAchievement("twenty-skins" as AchievementId);
    expect(reconcile(29)).toEqual(["twenty-five-skins"]);
    expect(f.store.load().skins).toBe(29);
    expect(f.store.load().achieved["thirty-skins" as AchievementId]).toBeUndefined();
    expect(reconcile(30)).toEqual(["thirty-skins"]);
    expect(reconcile(31)).toEqual([]);
    expect(f.store.reconcile(["white"], [])).toEqual([]);
    expect(f.store.load().skins).toBe(31);
    expect(f.store.load().achieved["twenty-skins" as AchievementId]).toBe(today);
    expect(f.store.load().readAchievements).toContain("twenty-skins");
    expectEconomyUntouched(f);
  });

  it("counts two different seasons cumulatively across runs, matching the displayed condition", () => {
    const f = fixture(), first = new JourneyRun(f.store), notify = vi.fn();
    const stamp = ACHIEVEMENTS.find(a => a.id === ("two-seasons" as AchievementId));
    expect(stamp?.condition).toBe("累计到达两个不同季节");
    first.visit("winter"); first.visit("winter"); first.finish(false);
    expect(f.store.load().seasons).toEqual(["winter"]);
    expect(f.store.load().achieved["two-seasons" as AchievementId]).toBeUndefined();
    const second = new JourneyRun(f.store, notify);
    second.visit("winter"); second.visit("winter");
    expect(achievementProgress(f.store.load(), "two-seasons" as AchievementId)).toBe(1);
    second.visit("summer"); second.visit("summer");
    expect(f.store.load().seasons).toEqual(["winter", "summer"]);
    expect(notify).toHaveBeenCalledExactlyOnceWith(["two-seasons"]);
    expect(second.finish(false)).toEqual(["two-seasons"]);
    expectEconomyUntouched(f);
  });

  it("keeps newly observed high goals in session during write denial and retries without resetting them", () => {
    const f = fixture();
    f.storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    const run = new JourneyRun(f.store);
    for (let i = 0; i < 100; i++) run.star();
    for (let i = 0; i < 150; i++) run.passed();
    expect(f.store.load().saveFailed).toBe(true);
    expect(f.values.has(JOURNEY_STORAGE_KEY)).toBe(false);
    const failed = f.store.load();
    expect(failed.achieved["hundred-stars" as AchievementId]).toBe(today);
    expect(failed.achieved["one-hundred-fifty-obstacles" as AchievementId]).toBe(today);
    f.storage.setItem.mockImplementation((key, value) => { f.values.set(key, value); });
    expect(f.store.reconcile([], [])).toEqual([]);
    expect(f.store.load()).toEqual({ ...failed, saveFailed: false });
    expect(new JourneyStore(() => f.storage, () => "2026-12-31").load()).toEqual(f.store.load());
    expectEconomyUntouched(f);
  });

  it("does not overwrite an unknown future journal when observing newly added goals", () => {
    const f = fixture(), { saveFailed: _saveFailed, ...journal } = f.store.load();
    const raw = JSON.stringify({ ...journal, achieved: { "future-stamp": oldDate } });
    f.values.set(JOURNEY_STORAGE_KEY, raw);
    f.store.runBest(100, 150);
    const next = f.store.load();
    expect(next.saveFailed).toBe(true);
    expect(next.achieved["hundred-stars" as AchievementId]).toBe(today);
    expect(next.achieved["one-hundred-fifty-obstacles" as AchievementId]).toBe(today);
    expect(f.values.get(JOURNEY_STORAGE_KEY)).toBe(raw);
    expect(f.storage.setItem).not.toHaveBeenCalled();
    expectEconomyUntouched(f);
  });
});
