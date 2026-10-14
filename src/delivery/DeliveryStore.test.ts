import { describe, expect, it } from 'vitest';
import { DeliveryStore, DELIVERY_STORAGE_KEY } from './DeliveryStore';
import { DELIVERY_ID } from './DeliveryRoute';
const storage = (initial: string | null = null) => { const values = new Map<string, string>(); if (initial !== null) values.set(DELIVERY_STORAGE_KEY, initial); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; };
describe('independent delivery postcards', () => {
  it('starts locked, keeps only the first completion, and persists on reload without gameplay writes', () => {
    const port = storage(), store = new DeliveryStore(() => port);
    expect(store.load().completedIds).toEqual([]); expect(port.values.size).toBe(0);
    expect(store.complete(DELIVERY_ID)).toEqual({ added: true, saved: true });
    expect(store.complete(DELIVERY_ID)).toEqual({ added: false, saved: true });
    expect(new DeliveryStore(() => port).load().completedIds).toEqual([DELIVERY_ID]);
    expect([...port.values.keys()]).toEqual([DELIVERY_STORAGE_KEY]);
  });
  it('preserves unknown IDs and rejects invalid route completions', () => {
    const port = storage(JSON.stringify({ version: 1, completedIds: ['future-route'] })), store = new DeliveryStore(() => port);
    expect(store.complete('invalid').added).toBe(false); store.complete(DELIVERY_ID);
    expect(store.load().completedIds).toEqual(['future-route', DELIVERY_ID]);
  });
  it('preserves extension fields and merges another writer when retrying a real session success', () => {
    const port = storage(JSON.stringify({ version: 1, completedIds: ['future-route'], cursor: { nested: [1, 2] } }));
    let failed = true;
    const store = new DeliveryStore(() => ({ getItem: port.getItem, setItem: (key, value) => { if (failed) throw Error('quota'); port.setItem(key, value); } }));
    expect(store.complete(DELIVERY_ID).saved).toBe(false);
    port.setItem(DELIVERY_STORAGE_KEY, JSON.stringify({ version: 1, completedIds: ['future-route', 'dinner-for-you-v1'], cursor: { nested: [1, 2, 3] }, futureFlag: true }));
    failed = false;
    expect(store.retrySave()).toEqual({ completedIds: ['future-route', 'dinner-for-you-v1', DELIVERY_ID], saveFailed: false });
    expect(JSON.parse(port.getItem(DELIVERY_STORAGE_KEY)!)).toEqual({ version: 1, completedIds: ['future-route', 'dinner-for-you-v1', DELIVERY_ID], cursor: { nested: [1, 2, 3] }, futureFlag: true });
  });
  it.each(['bad json', JSON.stringify({ version: 2, completedIds: [] }), JSON.stringify({ version: 1, completedIds: [42] })])('never overwrites malformed or future data: %s', raw => {
    const port = storage(raw), store = new DeliveryStore(() => port); expect(store.complete(DELIVERY_ID)).toEqual({ added: true, saved: false });
    expect(port.getItem(DELIVERY_STORAGE_KEY)).toBe(raw); expect(store.load().completedIds).toContain(DELIVERY_ID);
  });
  it('keeps session reward during storage failure and retries once storage recovers', () => {
    const port = storage(); let fails = true;
    const store = new DeliveryStore(() => ({ getItem: port.getItem, setItem: (key, value) => { if (fails) throw Error('quota'); port.setItem(key, value); } }));
    expect(store.complete(DELIVERY_ID).saved).toBe(false); expect(store.load().completedIds).toContain(DELIVERY_ID);
    fails = false; expect(store.complete(DELIVERY_ID)).toEqual({ added: false, saved: true }); expect(store.load().saveFailed).toBe(false);
  });
  it('unlocks the new postcard independently and keeps original and unknown future records on each write', () => {
    const port = storage(JSON.stringify({ version: 1, completedIds: ['future-route', DELIVERY_ID] })), store = new DeliveryStore(() => port);
    expect(store.complete('dinner-for-you-v1')).toEqual({ added: true, saved: true });
    expect(store.complete('dinner-for-you-v1')).toEqual({ added: false, saved: true });
    expect(new DeliveryStore(() => port).load().completedIds).toEqual(['future-route', DELIVERY_ID, 'dinner-for-you-v1']);
    expect([...port.values.keys()]).toEqual([DELIVERY_STORAGE_KEY]);
  });
  it('keeps both postcards in this session while storage fails, then flushes them without duplicate completion', () => {
    const port = storage(); let fails = true;
    const store = new DeliveryStore(() => ({ getItem: port.getItem, setItem: (key, value) => { if (fails) throw Error('quota'); port.setItem(key, value); } }));
    expect(store.complete('dinner-for-you-v1')).toEqual({ added: true, saved: false });
    expect(store.complete(DELIVERY_ID)).toEqual({ added: true, saved: false });
    expect(store.load().completedIds).toEqual(['dinner-for-you-v1', DELIVERY_ID]);
    fails = false; expect(store.complete('dinner-for-you-v1')).toEqual({ added: false, saved: true });
    expect(new DeliveryStore(() => port).load().completedIds).toEqual(['dinner-for-you-v1', DELIVERY_ID]);
  });
  it('does not overwrite a future schema when the dinner chapter is completed', () => {
    const raw = JSON.stringify({ version: 2, completedIds: ['future-route'], futureField: true }), port = storage(raw);
    const store = new DeliveryStore(() => port);
    expect(store.complete('dinner-for-you-v1')).toEqual({ added: true, saved: false });
    expect(port.getItem(DELIVERY_STORAGE_KEY)).toBe(raw); expect(store.load().completedIds).toContain('dinner-for-you-v1');
  });
});
