import { describe, expect, it } from 'vitest';
import { SCENERY_STORAGE_KEY, SceneryStore } from './SceneryStore';
function storage(initial: string | null = null) {
  let raw = initial, fail = false, writes = 0;
  const port = { getItem: (key: string) => { expect(key).toBe(SCENERY_STORAGE_KEY); return raw; }, setItem: (key: string, value: string) => { expect(key).toBe(SCENERY_STORAGE_KEY); writes++; if (fail) throw Error('quota'); raw = value; } };
  return { port, raw: () => raw, writes: () => writes, fail: (value: boolean) => { fail = value; } };
}
describe('separate scenery collection', () => {
  it('starts empty, keeps unknown IDs, saves discoveries once and survives reload', () => {
    const s = storage(), store = new SceneryStore(() => s.port);
    expect(store.load()).toEqual({ seenIds: [], saveFailed: false });
    expect(store.discover('rainbow-v1')).toEqual({ added: true, saved: true });
    expect(store.discover('rainbow-v1')).toEqual({ added: false, saved: true });
    expect(s.writes()).toBe(1);
    expect(new SceneryStore(() => s.port).load().seenIds).toEqual(['rainbow-v1']);
    const old = storage('{"version":1,"seenIds":["older-postcard"]}'), updated = new SceneryStore(() => old.port);
    updated.discover('meteors-v1');
    expect(JSON.parse(old.raw()!).seenIds).toEqual(['older-postcard', 'meteors-v1']);
    expect(updated.load().seenIds).not.toContain('fireflies-v1');
  });
  it.each(['{bad', '{"version":2,"seenIds":["rainbow-v1"]}', '{"version":1,"seenIds":[2]}'])('preserves incompatible storage %s and permits session collection', raw => {
    const s = storage(raw), store = new SceneryStore(() => s.port);
    expect(store.discover('rainbow-v1')).toEqual({ added: true, saved: false });
    expect(store.load()).toEqual({ seenIds: ['rainbow-v1'], saveFailed: true });
    expect(s.raw()).toBe(raw); expect(s.writes()).toBe(0);
  });
  it('retains failed writes and retries without issuing another discovery', () => {
    const s = storage(), store = new SceneryStore(() => s.port); s.fail(true);
    expect(store.discover('fireflies-v1')).toEqual({ added: true, saved: false });
    expect(store.load().seenIds).toEqual(['fireflies-v1']); s.fail(false);
    expect(store.discover('fireflies-v1')).toEqual({ added: false, saved: true });
    expect(new SceneryStore(() => s.port).load().seenIds).toEqual(['fireflies-v1']);
  });
  it('works when access to localStorage itself throws', () => {
    const store = new SceneryStore(() => { throw Error('disabled'); });
    expect(store.discover('meteors-v1')).toEqual({ added: true, saved: false });
    expect(store.load().seenIds).toEqual(['meteors-v1']);
  });
});
