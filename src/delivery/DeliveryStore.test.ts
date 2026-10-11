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
});
