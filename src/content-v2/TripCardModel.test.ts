import { describe, expect, it } from "vitest";
import { shortenTripText, tripCardModel, wrapTripText } from "./TripCardModel";

describe("this run's travel card facts", () => {
  it("keeps missing facts unknown and does not invent a skin, season or event", () => {
    const model = tripCardModel();
    expect(model.protagonist).toBeUndefined();
    expect(model.highlights).toEqual([]);
    expect(model.summary).not.toMatch(/春|夏|秋|冬|星星|伙伴|鸭|风车|0/);
  });

  it("handles a zero-star short run without claiming that stars were picked up", () => {
    const model = tripCardModel({ starsCollected: 0, companionSkins: [], animals: [], landmarks: [], newCollections: [] });
    expect(model.summary).toBe("还没有收起星星，下一段路再慢慢找。");
    expect(model.highlights).toEqual([]);
  });

  it("records actual seasons once, in encounter order, and real integer star count", () => {
    const model = tripCardModel({ seasons: ["spring", "summer", "spring", "winter"], starsCollected: 12.9 });
    expect(model.summary).toBe("今天跑过了春日牧场、夏日牧场、冬日牧场，收好了12颗星星。");
  });

  it("still reports zero pickups when a season was observed", () => {
    expect(tripCardModel({ seasons: ["spring"], starsCollected: 0 }).summary).toBe("今天跑过了春日牧场，还没有收起星星。");
  });

  it.each([NaN, Infinity, -1])("does not replace invalid star count %s with zero", value => {
    expect(tripCardModel({ starsCollected: value }).summary).toBe(tripCardModel().summary);
  });

  it("chooses at most three meaningful facts in the agreed priority order", () => {
    const model = tripCardModel({
      newRecord: true,
      newCollections: [{ id: "a", name: "花朵徽章" }],
      goals: [{ id: "g", title: "收起十颗星星", completed: true }],
      companionSkins: [{ id: "mint", name: "薄荷羊" }],
      animals: [{ id: "duck", name: "一家小鸭" }],
      landmarks: [{ id: "windmill", name: "风车草地" }],
    });
    expect(model.highlights.map(item => item.kind)).toEqual(["record", "collection", "goal"]);
    expect(model.highlights[1].text).toContain("花朵徽章");
    expect(model.highlights[2].text).toContain("收起十颗星星");
  });

  it("uses companion, animal and landmark facts when there are no higher priority facts", () => {
    const model = tripCardModel({
      companionSkins: [{ id: "mint", name: "薄荷羊" }],
      animals: [{ id: "duck", name: "一家小鸭" }],
      landmarks: [{ id: "bridge", name: "河边小桥" }],
      goals: [{ id: "g", title: "未达成的目标", completed: false }],
    });
    expect(model.highlights.map(item => item.text)).toEqual(["薄荷羊陪你走了一段路。", "遇见了一家小鸭。", "经过了河边小桥。"]);
    expect(JSON.stringify(model)).not.toContain("未达成的目标");
  });

  it("deduplicates actual IDs and ignores nameless events", () => {
    const model = tripCardModel({
      companionSkins: [{ id: "mint", name: "薄荷羊" }, { id: "mint", name: "薄荷羊" }, { id: "", name: "假的" }, { id: "a", name: " " }],
      goals: [{ id: "g", title: "同行", completed: true }, { id: "g", title: "同行", completed: true }],
    });
    expect(model.highlights.find(item => item.kind === "companion")!.ids).toEqual(["mint"]);
    expect(model.highlights.find(item => item.kind === "goal")!.text).toBe("完成了「同行」。");
  });

  it("limits long names while keeping identities and the exact total count", () => {
    const name = "这是一个特别特别特别特别特别特别特别长的伙伴名字";
    const model = tripCardModel({
      protagonist: { id: "mint", name },
      newCollections: [{ id: "a", name }, { id: "b", name: "雪花徽章" }, { id: "c", name: "枫叶徽章" }],
    });
    expect(model.protagonist?.name).toBe(name);
    expect(model.highlights[0].text).toContain("…");
    expect(model.highlights[0].text).toContain("3件收藏");
    expect(model.highlights[0].ids).toEqual(["a", "b", "c"]);
  });

  it("does not mutate A's frozen run snapshot", () => {
    const input = Object.freeze({ seasons: Object.freeze(["spring"] as const), animals: Object.freeze([Object.freeze({ id: "duck", name: "一家小鸭" })]) });
    expect(() => tripCardModel(input)).not.toThrow();
    expect(input.seasons).toEqual(["spring"]);
  });
});

describe("bounded local bitmap paragraphs", () => {
  const width = (value: string) => [...value].length * 10;
  it("wraps using measured glyph width and keeps punctuation off the start", () => {
    const rows = wrapTripText("经过河边小桥，收起星星。", 50, width, 8);
    expect(rows.join("")).toBe("经过河边小桥，收起星星。");
    expect(rows.every(row => width(row) <= 50)).toBe(true);
    expect(rows.every(row => !/^[，。]/.test(row))).toBe(true);
  });
  it("caps rows with a visible ellipsis rather than clipping overflowing text", () => {
    const rows = wrapTripText("长长的路上遇见了很多很多很多小羊", 50, width, 2);
    expect(rows).toHaveLength(2); expect(rows[1].endsWith("…")).toBe(true);
    expect(rows.every(row => width(row) <= 50)).toBe(true);
  });
  it("treats non-BMP characters as single characters and handles empty bounds", () => {
    expect(shortenTripText("羊🐑羊羊", 3)).toBe("羊🐑…");
    expect(wrapTripText("", 50, width, 2)).toEqual([]);
    expect(wrapTripText("羊", 0, width, 2)).toEqual([]);
    expect(wrapTripText("羊", 50, width, 0)).toEqual([]);
  });
});
