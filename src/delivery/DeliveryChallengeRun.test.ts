import { describe, expect, it } from 'vitest';
import { DELIVERY_CHALLENGE_CHAPTER_IDS, DeliveryChallengeRun, isDeliveryChallengeChapterId, type DeliveryChallengeDefinition } from './DeliveryChallengeRun';
const definition: DeliveryChallengeDefinition = { keepsakeKey: 'keepsake', stamps: [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `ordinary-${i}`, at: 1000 + i * 1000, y: 182, kind: 'ordinary' as const, key: 'ordinary' })),
  { id: 'hidden', at: 3000, y: 91, kind: 'keepsake' as const, key: 'keepsake' },
] };
describe('independent delivery stamp run', () => {
  it('recognizes the original three and all six resident challenge IDs', () => {
    expect(DELIVERY_CHALLENGE_CHAPTER_IDS).toHaveLength(9);
    for (const id of DELIVERY_CHALLENGE_CHAPTER_IDS) expect(isDeliveryChallengeChapterId(id)).toBe(true);
    expect(isDeliveryChallengeChapterId('windmill-invitation-v1')).toBe(true);
    expect(isDeliveryChallengeChapterId('rainy-umbrella-v1')).toBe(true);
    expect(isDeliveryChallengeChapterId('lighthouse-starlight-v1')).toBe(true);
    expect(isDeliveryChallengeChapterId('hill-goodnight-v1')).toBe(false); expect(isDeliveryChallengeChapterId(null)).toBe(false);
  });
  it('each authored stamp can be collected only once; unknown and old star IDs are ignored', () => {
    const run = new DeliveryChallengeRun(definition);
    expect(run.collect('ordinary-0')).toBe(true); expect(run.collect('ordinary-0')).toBe(false);
    expect(run.collect('mirror-star-v1')).toBe(false); expect(run.collect('hidden')).toBe(true);
    expect(run.snapshot()).toMatchObject({ ordinaryCollected: 1, totalOrdinary: 5, hiddenCollected: true, stars: 0, successful: false });
    expect(run.snapshot().collectedIds).toEqual(['ordinary-0', 'hidden']);
  });
  it.each([[0, false, 1], [3, false, 1], [4, false, 2], [5, false, 2], [0, true, 2], [4, true, 3], [5, true, 3]])(
    'successful delivery with %i ordinary / hidden=%s awards %i independent stars', (ordinary, hidden, stars) => {
      const run = new DeliveryChallengeRun(definition);
      for (let i = 0; i < ordinary; i++) run.collect(`ordinary-${i}`); if (hidden) run.collect('hidden');
      expect(run.snapshot().stars).toBe(0); const result = run.finish(true);
      expect(result.stars).toBe(stars); expect(result.earnedStars).toEqual([true, ordinary >= 4, hidden]);
      expect(run.collect('ordinary-4')).toBe(false); expect(run.finish(false)).toEqual(result);
    });
  it('failure retains progress for presentation but cannot later award stars or change its first outcome', () => {
    const run = new DeliveryChallengeRun(definition);
    for (const stamp of definition.stamps) run.collect(stamp.id);
    const failed = run.finish(false);
    expect(failed).toMatchObject({ ordinaryCollected: 5, hiddenCollected: true, successful: false, finished: true, stars: 0 });
    expect(failed.earnedStars).toEqual([false, false, false]); expect(run.finish(true)).toEqual(failed);
    expect(run.collect('hidden')).toBe(false);
  });
  it('retry owns a new empty collection and snapshots cannot mutate the run', () => {
    const first = new DeliveryChallengeRun(definition); first.collect('hidden'); first.finish(false);
    const retry = new DeliveryChallengeRun(definition); expect(retry.snapshot().collectedIds).toEqual([]);
    const before = retry.snapshot(); expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(before.collectedIds)).toBe(true); expect(Object.isFrozen(before.earnedStars)).toBe(true);
  });
});
