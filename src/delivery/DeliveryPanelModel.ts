import type { DeliveryChallengeSnapshot } from './DeliveryChallengeRun';
import type { DeliveryChallengeRecord } from './DeliveryChallengeStore';

/** Two full-size touch cards per page; selection remains separate from browsing. */
export function deliveryChapterPage<T>(chapters: readonly T[], page: number, pageSize = 2) {
  const capacity = Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : 2));
  const count = Math.max(1, Math.ceil(chapters.length / capacity));
  const index = Math.max(0, Math.min(count - 1, Math.floor(Number.isFinite(page) ? page : 0)));
  return { index, count, items: chapters.slice(index * capacity, (index + 1) * capacity),
    hasPrevious: index > 0, hasNext: index < count - 1 };
}

/** A missing result never becomes a historical rating merely because a chapter was completed. */
export function deliveryResultSummary(result: DeliveryChallengeSnapshot | undefined, success: boolean) {
  if (!result) return undefined;
  const ordinary = Math.max(0, Math.min(5, Math.floor(Number.isFinite(result.ordinaryCollected) ? result.ordinaryCollected : 0)));
  const hidden = result.hiddenCollected === true;
  const delivered = success && result.finished && result.successful;
  const earned = [delivered, delivered && ordinary >= 4, delivered && hidden] as const;
  return { ordinary, total: 5, hidden, delivered, earned, stars: earned.filter(Boolean).length };
}

/** Keep old postcards outside the new chapter-only cosmetic challenge system. */
export function deliveryBestRating(isChallenge: boolean, record?: DeliveryChallengeRecord) {
  return isChallenge && record ? { stars: record.bestStars, keepsake: record.keepsake } : undefined;
}

/** Route names break at their authored separators, with a bounded readable fallback. */
export function deliveryRouteLines(itinerary: string, capacity = 14): string[] {
  const maximum = Math.max(5, Math.floor(capacity));
  const chunks = itinerary.split(/\s*·\s*/).filter(Boolean);
  const lines: string[] = [];
  for (const chunk of chunks) {
    const last = lines.at(-1);
    if (last && [...last + ' · ' + chunk].length <= maximum) lines[lines.length - 1] += ' · ' + chunk;
    else {
      const chars = [...chunk];
      for (let start = 0; start < chars.length; start += maximum) lines.push(chars.slice(start, start + maximum).join(''));
    }
  }
  return lines;
}

export const DELIVERY_EXPANSION_UI_TEXT = [
  '选一段送信路线', '章节邮票册', '投递完成', '本局评价', '投递邮票', '纪念邮票',
  '已找到', '未找到', '已收藏', '未收藏', '已通关', '未通关', '难度', '最佳',
  '返回章节', '返回邮箱', '返回', '查看明信片', '重新送一次', '邮票册',
  '送达', '四枚邮票', '隐藏纪念', '暂未保存', '先收集，再成功送达。',
  '每章五枚普通邮票，四枚点亮一颗星。', '找到隐藏纪念邮票，再添一颗星。',
  '准备好了，就重新出发。', '约一分钟的小旅行', '轻触跳跃 · 上滑高跳', '下滑下蹲',
  '小风车', '小雨伞', '小灯塔', '本次已收好，暂未保存到设备', '先完成上一段故事', '返回居民',
] as const;
