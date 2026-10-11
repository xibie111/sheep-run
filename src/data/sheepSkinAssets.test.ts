import { describe, expect, it } from "vitest";
import { assertMatchingOfficialSkinCatalog, hasMatchingOfficialSkinCatalog } from "./sheepSkinAssets";

const validEntries = [
  { id: "white", frameWidth: 128, frameHeight: 128, frameCount: 15, files: ["idle.png"] },
  { id: "black", frameWidth: 128, frameHeight: 128, frameCount: 15, files: ["idle.png"] },
  { id: "brown", frameWidth: 128, frameHeight: 128, frameCount: 15, files: ["idle.png"] },
  { id: "golden", frameWidth: 128, frameHeight: 128, frameCount: 15, files: ["idle.png"] },
  { id: "farmer", frameWidth: 128, frameHeight: 128, frameCount: 15, files: ["idle.png"] },
] as const;

describe("official five-skin asset guard", () => {
  it("accepts only the approved five IDs and frame contract", () => {
    expect(hasMatchingOfficialSkinCatalog(validEntries)).toBe(true);
    expect(() => assertMatchingOfficialSkinCatalog(validEntries)).not.toThrow();
  });

  it("rejects the supplied eight-theme catalog shape without mapping", () => {
    const mismatched = ["blueberry", "chestnut", "forest", "lavender", "mint", "pumpkin", "rose", "sunset"]
      .map((id) => ({ id, frameWidth: 128, frameHeight: 128, frameCount: 15, files: ["idle.png"] }));

    expect(hasMatchingOfficialSkinCatalog(mismatched)).toBe(false);
    expect(() => assertMatchingOfficialSkinCatalog(mismatched)).toThrow(/white, black, brown, golden, farmer/);
  });

  it("rejects a partial or wrong-size official catalog", () => {
    expect(hasMatchingOfficialSkinCatalog(validEntries.slice(0, 4))).toBe(false);
    expect(hasMatchingOfficialSkinCatalog(validEntries.map((entry, index) => index === 2 ? { ...entry, frameWidth: 64 } : entry))).toBe(false);
  });
});
