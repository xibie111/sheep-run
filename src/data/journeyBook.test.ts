import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "./journeyBook";

describe("expanded achievement catalog", () => {
  it("preserves all thirty-two existing IDs and thresholds and appends twelve unique intermediate milestones", () => {
    const original = {
      "first-run": 1, "first-friend": 1, "five-friends": 5, "ten-stars": 10,
      "twenty-obstacles": 20, "first-record": 1, "four-seasons": 4, "five-skins": 5,
    };
    const added = {
      "five-runs": 5, "twenty-runs": 20, "twenty-friends": 20,
      "twenty-five-stars": 25, "fifty-stars": 50, "fifty-obstacles": 50, "ten-skins": 10,
      "spring-collector": 1, "summer-collector": 1, "autumn-collector": 1, "winter-collector": 1, "all-collections": 1,
    };
    const expanded = {
      "fifty-runs": 50, "hundred-runs": 100, "two-hundred-fifty-runs": 250,
      "fifty-friends": 50, "hundred-friends": 100,
      "seventy-five-stars": 75, "hundred-stars": 100,
      "hundred-obstacles": 100, "one-hundred-fifty-obstacles": 150,
      "twenty-skins": 20, "thirty-skins": 30, "two-seasons": 2,
    };
    const intermediate = {
      "three-runs": 3, "ten-runs": 10, "ten-friends": 10,
      "five-stars": 5, "fifteen-stars": 15, "thirty-five-stars": 35,
      "five-obstacles": 5, "ten-obstacles": 10, "thirty-five-obstacles": 35,
      "fifteen-skins": 15, "twenty-five-skins": 25, "three-seasons": 3,
    };
    expect(ACHIEVEMENTS).toHaveLength(44);
    expect(ACHIEVEMENTS.slice(0, 32).map(a => a.id)).toEqual(Object.keys({ ...original, ...added, ...expanded }));
    expect(ACHIEVEMENTS.slice(32).map(a => a.id)).toEqual(Object.keys(intermediate));
    expect(ACHIEVEMENTS.slice(0, 20).map(a => a.id)).toEqual(Object.keys({ ...original, ...added }));
    expect(Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a.goal]))).toEqual({ ...original, ...added, ...expanded, ...intermediate });
    expect(Object.fromEntries(ACHIEVEMENTS.slice(20, 32).map(a => [a.id, a.metric]))).toEqual({
      "fifty-runs": "runs", "hundred-runs": "runs", "two-hundred-fifty-runs": "runs",
      "fifty-friends": "summons", "hundred-friends": "summons",
      "seventy-five-stars": "stars", "hundred-stars": "stars",
      "hundred-obstacles": "obstacles", "one-hundred-fifty-obstacles": "obstacles",
      "twenty-skins": "skins", "thirty-skins": "skins", "two-seasons": "seasons",
    });
    expect(Object.fromEntries(ACHIEVEMENTS.slice(32).map(a => [a.id, a.metric]))).toEqual({
      "three-runs": "runs", "ten-runs": "runs", "ten-friends": "summons",
      "five-stars": "stars", "fifteen-stars": "stars", "thirty-five-stars": "stars",
      "five-obstacles": "obstacles", "ten-obstacles": "obstacles", "thirty-five-obstacles": "obstacles",
      "fifteen-skins": "skins", "twenty-five-skins": "skins", "three-seasons": "seasons",
    });
    expect(new Set(ACHIEVEMENTS.map(a => `${a.metric}:${a.goal}`)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const stamp of ACHIEVEMENTS) {
      expect(stamp.name.trim(), stamp.id).not.toBe("");
      expect(stamp.condition.trim(), stamp.id).not.toBe("");
      expect(stamp.message.trim(), stamp.id).not.toBe("");
    }
  });

  it.each([12, 20, 40, 64])("has actual local pixel glyphs for every achievement name, condition and message at %i", size => {
    const xml = readFileSync(new URL(`../../assets/fonts/pasture-display-${size}.fnt`, import.meta.url), "utf8");
    const chars = new Map([...xml.matchAll(/<char\s+([^>]+)\/>/g)].map(match => {
      const attributes = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(entry => [entry[1], entry[2]]));
      return [Number(attributes.id), attributes];
    }));
    const copy = ACHIEVEMENTS.map(a => a.name + a.condition + a.message).join("");
    for (const char of new Set([...copy])) {
      const glyph = chars.get(char.codePointAt(0)!);
      expect(glyph, `missing ${char}`).toBeDefined();
      if (char.trim()) expect(Number(glyph!.width) * Number(glyph!.height), `empty ${char}`).toBeGreaterThan(0);
    }
  });
});
