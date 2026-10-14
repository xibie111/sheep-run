import { describe, expect, it } from 'vitest';
import { DeliveryChallengeStore, DELIVERY_CHALLENGE_STORAGE_KEY } from './DeliveryChallengeStore';
import { DeliveryChallengeRun, type DeliveryChallengeSnapshot } from './DeliveryChallengeRun';
import { RESIDENTS } from '../residents/ResidentCatalog';
const id = 'windmill-invitation-v1';
const outcome = (ordinary: number, hidden: boolean, success = true) => {
  const run = new DeliveryChallengeRun({ keepsakeKey: 'hidden', stamps: [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, at: i * 1000, y: 182, kind: 'ordinary' as const, key: 'ordinary' })),
    { id: 'hidden', at: 5500, y: 91, kind: 'keepsake' as const, key: 'hidden' },
  ] });
  for (let i = 0; i < ordinary; i++) run.collect(`${i}`); if (hidden) run.collect('hidden'); return run.finish(success);
};
const storage = (raw?: string) => {
  const values = new Map<string, string>(); if (raw !== undefined) values.set(DELIVERY_CHALLENGE_STORAGE_KEY, raw);
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
describe('chapter-only stars and keepsake archive', () => {
  it('does not write until successful delivery and does not touch old postcard or gameplay keys', () => {
    const port = storage(), store = new DeliveryChallengeStore(() => port);
    expect(store.load()).toEqual({ chapters: {}, saveFailed: false }); expect(port.values.size).toBe(0);
    expect(store.recordResult(id, outcome(5, true, false)).accepted).toBe(false); expect(port.values.size).toBe(0);
    expect(store.recordResult(id, outcome(4, true))).toMatchObject({ accepted: true, improved: true, saved: true });
    expect([...port.values.keys()]).toEqual([DELIVERY_CHALLENGE_STORAGE_KEY]);
    expect(new DeliveryChallengeStore(() => port).load().chapters[id]).toEqual({ bestStars: 3, keepsake: true });
  });
  it('never regresses best stars or loses a keepsake on lower-star repeat and does not write unchanged results', () => {
    const port = storage(); let writes = 0;
    const store = new DeliveryChallengeStore(() => ({ getItem: port.getItem, setItem: (key, value) => { writes++; port.setItem(key, value); } }));
    store.recordResult(id, outcome(4, true)); expect(writes).toBe(1);
    expect(store.recordResult(id, outcome(0, false))).toMatchObject({ improved: false, saved: true }); expect(writes).toBe(1);
    expect(store.load().chapters[id]).toEqual({ bestStars: 3, keepsake: true });
  });
  it('retains unknown future IDs, nested data and fields and known-record future fields', () => {
    const future = { rating: 8, rare: ['future'], futureField: { nested: true } };
    const port = storage(JSON.stringify({ version: 1, chapters: { future, [id]: { bestStars: 1, keepsake: false, notes: 'keep' } }, cursor: 'future-extension' }));
    const store = new DeliveryChallengeStore(() => port); store.recordResult(id, outcome(4, true));
    const saved = JSON.parse(port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY)!);
    expect(saved.chapters.future).toEqual(future); expect(saved.cursor).toBe('future-extension'); expect(saved.chapters[id].notes).toBe('keep');
    expect(store.recordResult('future', outcome(5, true)).accepted).toBe(false);
  });
  it.each(['broken json', JSON.stringify({ version: 2, chapters: {} }), JSON.stringify({ version: 1, chapters: [] }),
    JSON.stringify({ version: 1, chapters: { [id]: { bestStars: 7, keepsake: true } } }),
    JSON.stringify({ version: 1, chapters: { [id]: { bestStars: 1, keepsake: 'yes' } } })])('never overwrites corrupt or future raw data: %s', raw => {
    const port = storage(raw), store = new DeliveryChallengeStore(() => port);
    expect(store.load().saveFailed).toBe(true); expect(store.recordResult(id, outcome(5, true)).saved).toBe(false);
    expect(port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY)).toBe(raw); expect(store.load().chapters[id]).toEqual({ bestStars: 3, keepsake: true });
  });
  it.each([{ bestStars: 3, keepsake: false }, { bestStars: 1, keepsake: true }])(
    'treats impossible known-chapter star/keepsake records as corrupt without repairing saved bytes: %j', corrupt => {
      const raw = JSON.stringify({ version: 1, chapters: { [id]: corrupt, 'future-chapter-v9': { bestStars: 9, custom: true } } });
      const port = storage(raw); let writes = 0;
      const store = new DeliveryChallengeStore(() => ({ getItem: port.getItem, setItem: (key, value) => { writes++; port.setItem(key, value); } }));
      expect(store.load()).toEqual({ chapters: {}, saveFailed: true });
      expect(store.recordResult(id, outcome(4, true))).toMatchObject({ accepted: true, saved: false, record: { bestStars: 3, keepsake: true } });
      expect(writes).toBe(0); expect(port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY)).toBe(raw);
      expect(store.load()).toEqual({ chapters: { [id]: { bestStars: 3, keepsake: true } }, saveFailed: true });
    });
  it('retains multiple session results on quota failure, retries, and reloads once the port recovers', () => {
    const port = storage(); let fails = true;
    const store = new DeliveryChallengeStore(() => ({ getItem: port.getItem, setItem: (key, value) => { if (fails) throw Error('quota'); port.setItem(key, value); } }));
    expect(store.recordResult(id, outcome(4, true)).saved).toBe(false); store.recordResult('rainy-umbrella-v1', outcome(1, true));
    expect(store.load().saveFailed).toBe(true); expect(store.load().chapters[id]?.bestStars).toBe(3);
    fails = false; expect(store.recordResult(id, outcome(0, false))).toMatchObject({ improved: false, saved: true });
    expect(new DeliveryChallengeStore(() => port).load().chapters).toEqual({ [id]: { bestStars: 3, keepsake: true }, 'rainy-umbrella-v1': { bestStars: 2, keepsake: true } });
  });
  it('merges an external higher record before writing a lower result', () => {
    const port = storage(), store = new DeliveryChallengeStore(() => port); store.recordResult(id, outcome(0, false));
    port.setItem(DELIVERY_CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, chapters: { [id]: { bestStars: 3, keepsake: true } } }));
    store.recordResult(id, outcome(3, false)); expect(store.load().chapters[id]).toEqual({ bestStars: 3, keepsake: true });
  });
  it('ignores old chapter IDs, fabricated rating values and incomplete runs', () => {
    const port = storage(), store = new DeliveryChallengeStore(() => port);
    expect(store.recordResult('hill-goodnight-v1', outcome(5, true)).accepted).toBe(false);
    expect(store.recordResult('dinner-for-you-v1', outcome(5, true)).accepted).toBe(false);
    expect(store.recordResult(id, { ...outcome(0, false), stars: 3 }).accepted).toBe(false);
    expect(store.recordResult(id, { ...outcome(4, true), finished: false }).accepted).toBe(false);
    expect(store.recordResult(id, {} as DeliveryChallengeSnapshot).accepted).toBe(false); expect(port.values.size).toBe(0);
  });
  it('unavailable or throwing storage keeps the session without silently inventing saved data', () => {
    for (const factory of [() => undefined, () => { throw Error('blocked'); }]) {
      const store = new DeliveryChallengeStore(factory); expect(store.recordResult(id, outcome(4, false)).saved).toBe(false);
      expect(store.load()).toEqual({ chapters: { [id]: { bestStars: 2, keepsake: false } }, saveFailed: true });
    }
  });
  it.each(RESIDENTS)('guards both new $name chapters and keeps their stars independent of story prerequisites', resident => {
    const port = storage(), completed: string[] = [];
    const store = new DeliveryChallengeStore(() => port, () => completed);
    for (const stage of resident.stages.slice(1)) expect(store.recordResult(stage.chapterId, outcome(5, true)).accepted).toBe(false);
    expect(port.values.size).toBe(0);
    for (const [index, stage] of resident.stages.entries()) {
      // One-star success is sufficient: no stars or keepsakes are required to enter the next stage.
      expect(store.recordResult(stage.chapterId, outcome(0, false))).toMatchObject({ accepted: true, improved: true, saved: true, record: { bestStars: 1, keepsake: false } });
      completed.push(stage.chapterId);
      expect(Object.keys(store.load().chapters).length).toBe(index + 1);
    }
    expect([...port.values.keys()]).toEqual([DELIVERY_CHALLENGE_STORAGE_KEY]);
  });
  it('retries actual session ratings without another run and retains concurrently added future fields', () => {
    const port = storage(); let failed = true;
    const store = new DeliveryChallengeStore(() => ({ getItem: port.getItem, setItem: (key, value) => { if (failed) throw Error('quota'); port.setItem(key, value); } }));
    store.recordResult(id, outcome(4, false));
    const future = { bestStars: 8, someFutureField: { unseen: true } };
    port.setItem(DELIVERY_CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, chapters: { future, [id]: { bestStars: 1, keepsake: false, caption: 'keep' } }, cursor: 'keep' }));
    failed = false;
    expect(store.retrySave()).toMatchObject({ chapters: { [id]: { bestStars: 2, keepsake: false } }, saveFailed: false });
    const restored = JSON.parse(port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY)!);
    expect(restored.cursor).toBe('keep'); expect(restored.chapters.future).toEqual(future);
    expect(restored.chapters[id]).toEqual({ bestStars: 2, keepsake: false, caption: 'keep' });
  });
});
