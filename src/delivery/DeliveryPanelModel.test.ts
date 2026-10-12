import { describe, expect, it } from 'vitest';
import { deliveryBestRating, deliveryChapterPage, deliveryResultSummary, deliveryRouteLines } from './DeliveryPanelModel';
import type { DeliveryChallengeSnapshot } from './DeliveryChallengeRun';

const result = (ordinaryCollected: number, hiddenCollected = false, successful = true): DeliveryChallengeSnapshot => ({
  ordinaryCollected, hiddenCollected, totalOrdinary: 5, collectedIds: [], finished: true, successful,
  stars: successful ? (1 + Number(ordinaryCollected >= 4) + Number(hiddenCollected)) as 1 | 2 | 3 : 0,
  earnedStars: [successful, successful && ordinaryCollected >= 4, successful && hiddenCollected],
});

describe('five-chapter delivery UI model', () => {
  it('pages five chapters into two full cards and a single final card without duplicates', () => {
    const chapters = ['hill', 'dinner', 'windmill', 'rainy', 'lighthouse'];
    expect([0, 1, 2].flatMap(page => deliveryChapterPage(chapters, page).items)).toEqual(chapters);
    expect(deliveryChapterPage(chapters, 2)).toMatchObject({ count: 3, index: 2, hasPrevious: true, hasNext: false, items: ['lighthouse'] });
  });
  it('clamps invalid navigation and safely handles an empty catalogue', () => {
    expect(deliveryChapterPage([1, 2, 3], Infinity).index).toBe(0);
    expect(deliveryChapterPage([1, 2, 3], -1).index).toBe(0);
    expect(deliveryChapterPage([1, 2, 3], 30).index).toBe(1);
    expect(deliveryChapterPage([], 5, 0)).toMatchObject({ count: 1, index: 0, items: [], hasPrevious: false, hasNext: false });
  });
  it('never invents stars for a missing result or a legacy completed chapter', () => {
    expect(deliveryResultSummary(undefined, true)).toBeUndefined();
    expect(deliveryBestRating(false, { bestStars: 3, keepsake: true })).toBeUndefined();
    expect(deliveryBestRating(true)).toBeUndefined();
  });
  it('distinguishes all three conditions rather than filling the first N stars', () => {
    expect(deliveryResultSummary(result(0, true), true)).toMatchObject({ stars: 2, earned: [true, false, true], ordinary: 0, hidden: true });
    expect(deliveryResultSummary(result(4), true)).toMatchObject({ stars: 2, earned: [true, true, false] });
    expect(deliveryResultSummary(result(5, true), true)).toMatchObject({ stars: 3, earned: [true, true, true] });
  });
  it('shows failure progress without awarding any stars even for five collected stamps', () => {
    expect(deliveryResultSummary(result(5, true, false), false)).toMatchObject({ ordinary: 5, hidden: true, stars: 0, earned: [false, false, false] });
    expect(deliveryResultSummary(result(5, true), false)?.delivered).toBe(false);
    expect(deliveryResultSummary({ ...result(5, true), finished: false }, true)?.stars).toBe(0);
  });
  it('does not produce NaN or negative counts with malformed optional data', () => {
    expect(deliveryResultSummary(result(NaN), true)?.ordinary).toBe(0);
    expect(deliveryResultSummary(result(-2), true)?.ordinary).toBe(0);
    expect(deliveryResultSummary(result(80), true)?.ordinary).toBe(5);
  });
  it('wraps authored route separators into readable lines without dropping places', () => {
    const route = '阴天牧场 · 雨中树林 · 河边小屋 · 屋前邮箱';
    const lines = deliveryRouteLines(route, 12);
    expect(lines.length).toBeGreaterThan(1); expect(lines.every(line => [...line].length <= 12)).toBe(true);
    expect(lines.join('')).toContain('阴天牧场'); expect(lines.join('')).toContain('屋前邮箱');
    expect(deliveryRouteLines('')).toEqual([]);
    expect(deliveryRouteLines('很长很长很长很长很长很长很长很长', 8).every(line => [...line].length <= 8)).toBe(true);
  });
});
