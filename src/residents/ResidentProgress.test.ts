import { describe, expect, it, vi } from 'vitest';
import { DeliveryStore, DELIVERY_STORAGE_KEY } from '../delivery/DeliveryStore';
import { DeliveryChallengeStore, DELIVERY_CHALLENGE_STORAGE_KEY } from '../delivery/DeliveryChallengeStore';
import type { DeliveryChallengeSnapshot } from '../delivery/DeliveryChallengeRun';
import { RESIDENTS, RESIDENT_NEW_CHAPTER_IDS, residentStageForChapter } from './ResidentCatalog';
import { canEnterDeliveryChapter, canOpenResidentLetter, getResidentProgress, getResidentStoriesProgress,
  getUnlockedResidentLetters, newlyUnlockedResidentLetters, reconcileResidentProgress } from './ResidentProgress';

const memory = () => {
  const values = new Map<string, string>(), failingKeys = new Set<string>();
  return { values, failingKeys, getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { if (failingKeys.has(key)) throw Error('quota'); values.set(key, value); }) };
};
const success: DeliveryChallengeSnapshot = { ordinaryCollected: 0, totalOrdinary: 5, hiddenCollected: false,
  collectedIds: [], finished: true, successful: true, stars: 1, earnedStars: [true, false, false] };

describe('resident story progression from real chapter completions', () => {
  it('keeps three stable chains and six distinct additions with existing first chapters', () => {
    expect(RESIDENTS.map(resident => [resident.id, ...resident.stages.map(stage => stage.chapterId)])).toEqual([
      ['windmill-keeper-v1', 'windmill-invitation-v1', 'windmill-thanks-v1', 'windmill-photo-v1'],
      ['riverside-neighbor-v1', 'rainy-umbrella-v1', 'riverside-thanks-v1', 'riverside-sunshine-v1'],
      ['lighthouse-keeper-v1', 'lighthouse-starlight-v1', 'lighthouse-old-letter-v1', 'lighthouse-gathering-v1'],
    ]);
    expect(new Set(RESIDENT_NEW_CHAPTER_IDS).size).toBe(6);
    expect(new Set(RESIDENTS.flatMap(resident => resident.stages.map(stage => stage.id))).size).toBe(9);
    expect(residentStageForChapter('lighthouse-old-letter-v1')?.resident.name).toBe('阿灯');
    expect(residentStageForChapter('unknown')).toBeUndefined();
  });
  it.each(RESIDENTS)('advances $name independently after each success without reads, stars or waiting', resident => {
    const completed: string[] = [];
    for (const [index, stage] of resident.stages.entries()) {
      const before = getResidentProgress(resident.id, completed)!;
      expect(before.currentStage?.chapterId).toBe(stage.chapterId);
      expect(before.completedCount).toBe(index);
      expect(before.stages.map(item => item.unlocked)).toEqual(index === 0 ? [true, false, false] : index === 1 ? [true, true, false] : [true, true, true]);
      expect(canOpenResidentLetter(stage.letterId, completed)).toBe(false);
      completed.push(stage.chapterId);
      const after = getResidentProgress(resident.id, completed)!;
      expect(after.completedCount).toBe(index + 1);
      expect(after.unreadCount).toBe(index + 1);
      expect(after.keepsakeUnlocked).toBe(index === 2);
      expect(getUnlockedResidentLetters(completed).map(letter => letter.id)).toContain(stage.letterId);
      expect(getResidentStoriesProgress(completed).residents.filter(item => item.resident.id !== resident.id).every(item => item.completedCount === 0)).toBe(true);
    }
    const finished = getResidentProgress(resident.id, completed)!;
    expect(finished.completed).toBe(true); expect(finished.currentStage).toBeUndefined();
    expect(getResidentProgress(resident.id, completed, resident.stages.map(stage => stage.letterId))).toMatchObject({ completedCount: 3, unreadCount: 0, keepsakeUnlocked: true });
  });
  it('recognizes legacy first-stage saves without fabricating any new persisted record', () => {
    const port = memory(), ids = RESIDENTS.map(resident => resident.stages[0]!.chapterId);
    const raw = JSON.stringify({ version: 1, completedIds: [...ids, 'future-chapter'], extension: { keep: true } });
    port.values.set(DELIVERY_STORAGE_KEY, raw);
    const stories = getResidentStoriesProgress(new DeliveryStore(() => port).load().completedIds, ['welcome-v1']);
    expect(stories.residents.map(resident => [resident.completedCount, resident.unreadCount, resident.currentStage?.index])).toEqual([[1, 1, 2], [1, 1, 2], [1, 1, 2]]);
    expect(port.setItem).not.toHaveBeenCalled(); expect(port.getItem(DELIVERY_STORAGE_KEY)).toBe(raw);
    expect(stories.groupPhotoUnlocked).toBe(false);
  });
  it('keeps all five originals open and rejects unknown or locked direct requests', () => {
    for (const id of ['hill-goodnight-v1', 'dinner-for-you-v1', ...RESIDENTS.map(resident => resident.stages[0]!.chapterId)]) expect(canEnterDeliveryChapter(id, [])).toBe(true);
    for (const id of [...RESIDENT_NEW_CHAPTER_IDS, 'unknown', '', undefined, {}]) expect(canEnterDeliveryChapter(id, [])).toBe(false);
    for (const resident of RESIDENTS) {
      expect(canEnterDeliveryChapter(resident.stages[1]!.chapterId, [resident.stages[0]!.chapterId])).toBe(true);
      expect(canEnterDeliveryChapter(resident.stages[2]!.chapterId, [resident.stages[0]!.chapterId])).toBe(false);
      expect(canEnterDeliveryChapter(resident.stages[2]!.chapterId, [resident.stages[1]!.chapterId])).toBe(true);
    }
  });
  it('derives the group photo and letters once, and replay or unknown read IDs add no rewards', () => {
    const all = RESIDENTS.flatMap(resident => resident.stages.map(stage => stage.chapterId));
    expect(getResidentStoriesProgress(all.slice(0, -1)).groupPhotoUnlocked).toBe(false);
    expect(getResidentStoriesProgress(all).groupPhotoUnlocked).toBe(true);
    expect(getUnlockedResidentLetters([...all, ...all, 'unknown']).length).toBe(9);
    expect(newlyUnlockedResidentLetters(all, [...all, ...all])).toEqual([]);
    expect(newlyUnlockedResidentLetters(all.slice(0, -1), all).map(letter => letter.id)).toEqual(['resident-lighthouse-letter-3-v1']);
    expect(getResidentProgress('missing', all)).toBeUndefined();
    expect(getResidentStoriesProgress([], ['resident-windmill-letter-3-v1']).residents[0]?.completedCount).toBe(0);
  });
});

describe('resident progress save reconciliation', () => {
  it('does not let direct completion or challenge calls bypass a new chapter lock', () => {
    const port = memory(), deliveries = new DeliveryStore(() => port), challenges = new DeliveryChallengeStore(() => port, () => deliveries.load().completedIds);
    expect(deliveries.complete('windmill-thanks-v1')).toEqual({ added: false, saved: false });
    expect(challenges.recordResult('windmill-thanks-v1', success).accepted).toBe(false);
    expect(port.setItem).not.toHaveBeenCalled();
    deliveries.complete('windmill-invitation-v1');
    expect(deliveries.complete('windmill-thanks-v1')).toEqual({ added: true, saved: true });
    expect(challenges.recordResult('windmill-thanks-v1', success).accepted).toBe(true);
  });
  it('recovers a missing completion write after reload using a genuinely successful challenge record', () => {
    const port = memory(), deliveries = new DeliveryStore(() => port), challenges = new DeliveryChallengeStore(() => port, () => deliveries.load().completedIds);
    port.failingKeys.add(DELIVERY_STORAGE_KEY);
    expect(deliveries.complete('windmill-invitation-v1').saved).toBe(false);
    expect(challenges.recordResult('windmill-invitation-v1', success).saved).toBe(true);
    const challengeBytes = port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY);
    port.failingKeys.clear();
    const restored = new DeliveryStore(() => port), restoredChallenges = new DeliveryChallengeStore(() => port, () => restored.load().completedIds);
    const result = reconcileResidentProgress(restored, restoredChallenges);
    expect(result).toEqual({ completedIds: ['windmill-invitation-v1'], saveFailed: false, recoveredIds: ['windmill-invitation-v1'] });
    expect(getResidentProgress('windmill-keeper-v1', result.completedIds)?.currentStage?.index).toBe(2);
    expect(port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY)).toBe(challengeBytes);
    const writes = port.setItem.mock.calls.length;
    expect(reconcileResidentProgress(restored, restoredChallenges).recoveredIds).toEqual([]);
    expect(port.setItem).toHaveBeenCalledTimes(writes);
  });
  it('keeps the story available if only challenge saving fails and retries only the actual earned rating', () => {
    const port = memory(), deliveries = new DeliveryStore(() => port), challenges = new DeliveryChallengeStore(() => port, () => deliveries.load().completedIds);
    deliveries.complete('rainy-umbrella-v1'); port.failingKeys.add(DELIVERY_CHALLENGE_STORAGE_KEY);
    expect(challenges.recordResult('rainy-umbrella-v1', success).saved).toBe(false);
    expect(reconcileResidentProgress(deliveries, challenges).saveFailed).toBe(true);
    expect(getUnlockedResidentLetters(new DeliveryStore(() => port).load().completedIds)[0]?.id).toBe('resident-riverside-letter-1-v1');
    // A fresh process cannot claim an unsaved rating from a postcard alone.
    const freshChallenges = new DeliveryChallengeStore(() => port);
    reconcileResidentProgress(new DeliveryStore(() => port), freshChallenges);
    expect(freshChallenges.load().chapters).toEqual({});
    port.failingKeys.clear();
    expect(reconcileResidentProgress(deliveries, challenges).saveFailed).toBe(false);
    expect(new DeliveryChallengeStore(() => port).load().chapters['rainy-umbrella-v1']).toEqual({ bestStars: 1, keepsake: false });
  });
  it('reconciles chain dependencies in order without inventing absent predecessors or unlocked letters', () => {
    const port = memory();
    port.values.set(DELIVERY_CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, chapters: {
      'windmill-photo-v1': { bestStars: 1, keepsake: false }, 'windmill-thanks-v1': { bestStars: 1, keepsake: false },
    } }));
    const deliveries = new DeliveryStore(() => port), challenges = new DeliveryChallengeStore(() => port, () => deliveries.load().completedIds);
    expect(reconcileResidentProgress(deliveries, challenges).completedIds).toEqual([]);
    deliveries.complete('windmill-invitation-v1');
    expect(reconcileResidentProgress(deliveries, challenges).recoveredIds).toEqual(['windmill-thanks-v1', 'windmill-photo-v1']);
    expect(getResidentProgress('windmill-keeper-v1', deliveries.load().completedIds)).toMatchObject({ completedCount: 3, unreadCount: 3, keepsakeUnlocked: true });
  });
  it('protects future completion bytes while exposing recoverable successful session progress', () => {
    const port = memory(), raw = JSON.stringify({ version: 9, completedIds: ['future-route'], future: { x: true } });
    port.values.set(DELIVERY_STORAGE_KEY, raw);
    port.values.set(DELIVERY_CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, chapters: { 'lighthouse-starlight-v1': { bestStars: 1, keepsake: false } } }));
    const deliveries = new DeliveryStore(() => port), challenges = new DeliveryChallengeStore(() => port);
    expect(reconcileResidentProgress(deliveries, challenges)).toMatchObject({ completedIds: ['lighthouse-starlight-v1'], saveFailed: true });
    expect(port.getItem(DELIVERY_STORAGE_KEY)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled();
    expect(reconcileResidentProgress(deliveries, challenges).recoveredIds).toEqual([]);
  });
  it('does not promote failures, corrupt stars or a future challenge schema into completion', () => {
    for (const raw of ['broken', JSON.stringify({ version: 2, chapters: { 'windmill-invitation-v1': { bestStars: 1, keepsake: false } } }),
      JSON.stringify({ version: 1, chapters: { 'windmill-invitation-v1': { bestStars: 0, keepsake: false } } })]) {
      const port = memory(); port.values.set(DELIVERY_CHALLENGE_STORAGE_KEY, raw);
      const deliveries = new DeliveryStore(() => port), challenges = new DeliveryChallengeStore(() => port);
      expect(challenges.recordResult('windmill-invitation-v1', { ...success, successful: false, stars: 0, earnedStars: [false, false, false] }).accepted).toBe(false);
      expect(reconcileResidentProgress(deliveries, challenges).completedIds).toEqual([]);
      expect(getUnlockedResidentLetters(deliveries.load().completedIds)).toEqual([]);
      expect(port.setItem).not.toHaveBeenCalled();
    }
  });
});
