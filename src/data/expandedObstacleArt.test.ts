import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// These checks inspect shipped metadata; the browser-only texture API is unused.
vi.mock("phaser", () => ({ default: {} }));
import frames from "../../assets/seasons/expanded-obstacles-v3/frames.json";
import { EXPANDED_OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import { SEASON_OBSTACLE_NAMES } from "./seasonArtAssets";
import { expandedObstacleRuntimeKeys } from "./expandedObstacleArt";

const kinds = ["HayCart", "WaterTrough", "HangingLantern", "FlyingGoose"] as const;

describe("shipped expanded four-season obstacle artwork", () => {
  it("contains sixteen positive nonoverlapping subject frames within the actual PNG", () => {
    const png = readFileSync(new URL("../../assets/seasons/expanded-obstacles-v3/atlas.png", import.meta.url));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    expect([width, height]).toEqual([1448, 1086]);
    const inspected: Array<{ x: number; y: number; width: number; height: number }> = [];
    expect(Object.keys(frames).sort()).toEqual([...SEASON_ORDER].sort());
    for (const season of SEASON_ORDER) {
      expect(Object.keys(frames[season]).sort()).toEqual([...kinds].sort());
      for (const kind of kinds) {
        const frame = frames[season][kind];
        for (const value of Object.values(frame)) expect(Number.isInteger(value)).toBe(true);
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.width).toBeGreaterThan(0);
        expect(frame.height).toBeGreaterThan(0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(width);
        expect(frame.y + frame.height).toBeLessThanOrEqual(height);
        expect(inspected.some(previous => previous.x < frame.x + frame.width
          && frame.x < previous.x + previous.width && previous.y < frame.y + frame.height
          && frame.y < previous.y + previous.height), `${season}/${kind} overlaps another subject`).toBe(false);
        inspected.push(frame);
      }
    }
    expect(inspected).toHaveLength(16);
  });

  it("provides a distinct readable name for each of the four seasonal variants", () => {
    expect(EXPANDED_OBSTACLE_DEFINITIONS.map(definition => definition.kind)).toEqual(kinds);
    for (const kind of kinds) {
      const names = SEASON_ORDER.map(season => SEASON_OBSTACLE_NAMES[season][kind]);
      expect(names.every(name => typeof name === "string" && name.trim().length > 0)).toBe(true);
      expect(new Set(names).size).toBe(4);
    }
  });

  it("accounts for all four constructor textures and sixteen seasonal textures during retry cleanup", () => {
    const keys = expandedObstacleRuntimeKeys();
    expect(keys).toHaveLength(20);
    expect(new Set(keys).size).toBe(20);
    for (const definition of EXPANDED_OBSTACLE_DEFINITIONS) expect(keys).toContain(definition.texture);
    for (const kind of kinds) for (const season of SEASON_ORDER) {
      expect(keys).toContain(`season-${season}-obstacle-${kind}`);
    }
  });
});
