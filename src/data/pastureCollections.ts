import { SEASON_ORDER, SEASON_SCORE_INTERVAL } from "../environment/SeasonProgress";
import type { ThemeId } from "../environment/types";

export const COLLECTION_BADGES = [
  { id: "spring-flower", season: "spring", name: "春日花", at: 250, message: "催眠羊，你一笑，我的春天就来了。" },
  { id: "spring-butterfly", season: "spring", name: "小蝴蝶", at: 700, message: "喜欢你，是每天都会发生的小心动。" },
  { id: "spring-clover", season: "spring", name: "幸运草", at: 1200, message: "遇见催眠羊，就是我最好的运气。" },
  { id: "summer-sunflower", season: "summer", name: "向日葵", at: 250, message: "你在哪里，我的心就朝向哪里。" },
  { id: "summer-watermelon", season: "summer", name: "甜西瓜", at: 700, message: "夏天的西瓜很甜，你比它还甜。" },
  { id: "summer-shell", season: "summer", name: "小贝壳", at: 1200, message: "想和催眠羊一起，把晚风听完。" },
  { id: "autumn-maple", season: "autumn", name: "红枫叶", at: 250, message: "把喜欢写在风里，让它吹向你。" },
  { id: "autumn-acorn", season: "autumn", name: "小橡果", at: 700, message: "认真收好每一份，关于你的温柔。" },
  { id: "autumn-pumpkin", season: "autumn", name: "暖南瓜", at: 1200, message: "想陪你吃热饭，也想陪你过秋天。" },
  { id: "winter-snowflake", season: "winter", name: "小雪花", at: 250, message: "下雪的时候，最想牵的是你的手。" },
  { id: "winter-mitten", season: "winter", name: "暖手套", at: 700, message: "催眠羊，冷的时候让我抱抱你。" },
  { id: "winter-cocoa", season: "winter", name: "热可可", at: 1200, message: "四季都想陪你，我一直喜欢你。" },
] as const;

export type CollectionBadge = (typeof COLLECTION_BADGES)[number];
export type CollectionBadgeId = CollectionBadge["id"];
export const COLLECTION_SEASON_NAMES: Record<ThemeId, string> = {spring:"春日", summer:"盛夏", autumn:"暖秋", winter:"冬日"};

/** Rare cosmetic collectibles, independent of obstacle/star/power-up scheduling. */
export class CollectionSchedule {
  private previous = 0;
  private epoch = -1;
  private readonly shown = new Set<CollectionBadgeId>();
  observe(score: number): CollectionBadge[] {
    if (!Number.isFinite(score) || score < this.previous) return [];
    const epoch = Math.floor(score / SEASON_SCORE_INTERVAL);
    if (epoch !== this.epoch) { this.epoch = epoch; this.shown.clear(); }
    const season = SEASON_ORDER[epoch % SEASON_ORDER.length];
    const crossed = COLLECTION_BADGES.filter(badge => badge.season === season &&
      score >= epoch * SEASON_SCORE_INTERVAL + badge.at && this.previous < epoch * SEASON_SCORE_INTERVAL + badge.at && !this.shown.has(badge.id));
    crossed.forEach(badge => this.shown.add(badge.id));
    this.previous = score;
    return crossed;
  }
}
