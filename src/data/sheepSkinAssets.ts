import type { SkinId } from "./sheepSkins";

export const REQUIRED_OFFICIAL_SKIN_IDS: readonly SkinId[] = ["white", "black", "brown", "golden", "farmer"];
export const REQUIRED_OFFICIAL_SKIN_FRAME_SIZE = 128;
export const REQUIRED_OFFICIAL_SKIN_FRAME_COUNT = 15;

export interface OfficialSkinAssetEntry {
  id: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  files: readonly string[];
}

export function hasMatchingOfficialSkinCatalog(entries: readonly OfficialSkinAssetEntry[]): boolean {
  if (entries.length !== REQUIRED_OFFICIAL_SKIN_IDS.length) return false;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return REQUIRED_OFFICIAL_SKIN_IDS.every((id) => {
    const entry = byId.get(id);
    return entry?.frameWidth === REQUIRED_OFFICIAL_SKIN_FRAME_SIZE
      && entry.frameHeight === REQUIRED_OFFICIAL_SKIN_FRAME_SIZE
      && entry.frameCount === REQUIRED_OFFICIAL_SKIN_FRAME_COUNT
      && entry.files.length > 0;
  });
}

export function assertMatchingOfficialSkinCatalog(entries: readonly OfficialSkinAssetEntry[]): void {
  if (!hasMatchingOfficialSkinCatalog(entries)) {
    throw new Error("Official five-skin assets are required: white, black, brown, golden, farmer at 128x128 with 15 frames each.");
  }
}
