import { describe, expect, it } from 'vitest';
import { DeliveryStore, DELIVERY_STORAGE_KEY } from './DeliveryStore';
import { DELIVERY_CHALLENGE_CHAPTER_IDS } from './DeliveryChallengeRun';
const port = (raw: string | null = null) => {
  const values = new Map<string, string>(); if (raw !== null) values.set(DELIVERY_STORAGE_KEY, raw);
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
describe('expanded postcard archive backwards compatibility', () => {
  it('adds three postcards while retaining both authored private trips and unknown IDs', () => {
    const storage = port(JSON.stringify({ version: 1, completedIds: ['hill-goodnight-v1', 'dinner-for-you-v1', 'future-route-v9'] }));
    const store = new DeliveryStore(() => storage);
    for (const id of DELIVERY_CHALLENGE_CHAPTER_IDS) expect(store.complete(id)).toEqual({ added: true, saved: true });
    expect(new DeliveryStore(() => storage).load().completedIds).toEqual(['hill-goodnight-v1', 'dinner-for-you-v1', 'future-route-v9', ...DELIVERY_CHALLENGE_CHAPTER_IDS]);
    expect([...storage.values.keys()]).toEqual([DELIVERY_STORAGE_KEY]);
  });
  it.each(['invalid', JSON.stringify({ version: 99, completedIds: ['future'] }), JSON.stringify({ version: 1, completedIds: [null] })])(
    'new success is session-only and does not overwrite unreadable storage: %s', raw => {
      const storage = port(raw), store = new DeliveryStore(() => storage);
      for (const id of DELIVERY_CHALLENGE_CHAPTER_IDS) expect(store.complete(id).saved).toBe(false);
      expect(storage.getItem(DELIVERY_STORAGE_KEY)).toBe(raw); expect(store.load().completedIds).toEqual([...DELIVERY_CHALLENGE_CHAPTER_IDS]);
    });
  it('new postcards survive unavailable storage and flush together when retry recovers', () => {
    const storage = port(); let failed = true;
    const store = new DeliveryStore(() => ({ getItem: storage.getItem, setItem: (key, value) => { if (failed) throw Error('full'); storage.setItem(key, value); } }));
    for (const id of DELIVERY_CHALLENGE_CHAPTER_IDS) expect(store.complete(id).saved).toBe(false);
    expect(store.load().saveFailed).toBe(true);
    failed = false; expect(store.complete(DELIVERY_CHALLENGE_CHAPTER_IDS[0])).toEqual({ added: false, saved: true });
    expect(new DeliveryStore(() => storage).load().completedIds).toEqual([...DELIVERY_CHALLENGE_CHAPTER_IDS]);
  });
});
