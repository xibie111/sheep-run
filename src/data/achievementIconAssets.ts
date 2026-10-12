import { ACHIEVEMENTS, type AchievementId } from "./journeyBook";

export function achievementIconKey(id: AchievementId): string {
  return `achievement-icon-${id}`;
}

/** Derive the complete icon set from the journal catalog; fail on incomplete bundles. */
export function createAchievementIconAssets(urls: Readonly<Record<string, string>>) {
  return ACHIEVEMENTS.map(achievement => {
    const path = `../../assets/achievement-icons-v1/runtime/${achievement.id}.png`;
    const url = urls[path];
    if (typeof url !== "string" || !url.trim()) throw new Error(`Missing local achievement icon: ${achievement.id}`);
    return { id: achievement.id, key: achievementIconKey(achievement.id), url };
  });
}

const urls = import.meta.glob("../../assets/achievement-icons-v1/runtime/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

export const ACHIEVEMENT_ICON_ASSETS = createAchievementIconAssets(urls);
