import { ACHIEVEMENTS, type AchievementId } from "./journeyBook";
import { EXPANDED_ACHIEVEMENTS } from "./expandedAchievements";
import { JOURNEY_MILESTONES_V3 } from "./journeyMilestonesV3";

const expandedIds = new Set<string>(EXPANDED_ACHIEVEMENTS.map(achievement => achievement.id));
const milestoneIds = new Set<string>(JOURNEY_MILESTONES_V3.map(achievement => achievement.id));

/** Existing stamps keep their original artwork; additions have a separate bundle. */
export function achievementIconPath(id: AchievementId): string {
  const version = milestoneIds.has(id) ? "v3" : expandedIds.has(id) ? "v2" : "v1";
  return `../../assets/achievement-icons-${version}/runtime/${id}.png`;
}

export function achievementIconKey(id: AchievementId): string {
  return `achievement-icon-${id}`;
}

/** Derive the complete icon set from the journal catalog; fail on incomplete bundles. */
export function createAchievementIconAssets(urls: Readonly<Record<string, string>>) {
  return ACHIEVEMENTS.map(achievement => {
    const path = achievementIconPath(achievement.id);
    const url = urls[path];
    if (typeof url !== "string" || !url.trim()) throw new Error(`Missing local achievement icon: ${achievement.id}`);
    return { id: achievement.id, key: achievementIconKey(achievement.id), url };
  });
}

const originalUrls = import.meta.glob("../../assets/achievement-icons-v1/runtime/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

const expandedUrls = import.meta.glob("../../assets/achievement-icons-v2/runtime/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

const milestoneUrls = import.meta.glob("../../assets/achievement-icons-v3/runtime/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

export const ACHIEVEMENT_ICON_ASSETS = createAchievementIconAssets({ ...originalUrls, ...expandedUrls, ...milestoneUrls });
