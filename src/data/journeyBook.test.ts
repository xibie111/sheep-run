import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "./journeyBook";

describe("expanded achievement catalog", () => {
  it("preserves the eight existing IDs and thresholds, and assigns unique stable IDs to the new stamps", () => {
    const original = {
      "first-run": 1, "first-friend": 1, "five-friends": 5, "ten-stars": 10,
      "twenty-obstacles": 20, "first-record": 1, "four-seasons": 4, "five-skins": 5,
    };
    const added = {
      "five-runs": 5, "twenty-runs": 20, "twenty-friends": 20,
      "twenty-five-stars": 25, "fifty-stars": 50, "fifty-obstacles": 50, "ten-skins": 10,
      "spring-collector": 1, "summer-collector": 1, "autumn-collector": 1, "winter-collector": 1, "all-collections": 1,
    };
    expect(Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a.goal]))).toEqual({ ...original, ...added });
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
