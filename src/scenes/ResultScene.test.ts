import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../ui/ResultView', () => ({ addResultView: vi.fn() }));
vi.mock('../ui/JourneyBook', () => ({ attachJourneyBook: vi.fn() }));
vi.mock('../ui/ViewportBackdrop', () => ({ addTiledPastureBackdrop: vi.fn() }));
vi.mock('../game/Viewport', () => ({ watchViewport: vi.fn((_scene: unknown, layout: (size: { width: number; height: number }) => void) => { layout({ width: 584, height: 270 }); }) }));

import { ResultScene } from './ResultScene';
import type { ResultSceneData } from '../game/GameState';
import { RunTravel } from '../runner-v2/RunTravel';
import { RunGoal } from '../runner-v2/RunGoal';
import { addResultView } from '../ui/ResultView';
import { attachJourneyBook } from '../ui/JourneyBook';

const current = (scene: ResultScene) => (scene as unknown as { result: ResultSceneData }).result;
const result = { score: 240, best: 240, newRecord: true, coinsEarned: 9, coinBalance: 39 };
function travel() {
  const run = new RunTravel(), goal = new RunGoal({ random: () => .9 });
  run.visitSeason('summer'); run.star(); run.summon('sleepy-pink'); run.visibleLandmark('old-barn');
  goal.update(30); run.goal(goal.snapshot()); run.record(); return run.finish();
}

describe('result trip payload lifecycle', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('retains the actual finished trip, lead skin and original score/reward values', () => {
    const scene = new ResultScene(), snapshot = travel();
    scene.init({ ...result, travel: snapshot, leadSkin: 'cloud' });
    expect(current(scene)).toMatchObject({ ...result, travel: snapshot, leadSkin: 'cloud' });
    expect(Object.isFrozen(current(scene).travel)).toBe(true);
  });

  it.each(['not-a-skin', undefined, null, 12])('excludes invalid or absent lead skin %s without replacing it from the save', leadSkin => {
    const getItem = vi.fn(() => { throw new Error('Result protagonist must not come from current save'); });
    vi.stubGlobal('window', { localStorage: { getItem } });
    const scene = new ResultScene(); scene.init({ ...result, travel: travel(), leadSkin });
    expect(current(scene).travel).toBeDefined(); expect(Object.hasOwn(current(scene), 'leadSkin')).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('does not carry a preceding trip or protagonist into the next valid result', () => {
    const scene = new ResultScene(); scene.init({ ...result, travel: travel(), leadSkin: 'mint', saveFailed: true });
    scene.init({ score: 12, best: 240, newRecord: false });
    expect(current(scene)).toEqual({ score: 12, best: 240, newRecord: false, coinsEarned: 0, coinBalance: 0, achievements: [] });
  });

  it.each([undefined, {}, { score: 12 }])('resets stale trip and rewards on a missing or incomplete re-entry %j', launch => {
    const scene = new ResultScene(); scene.init({ ...result, travel: travel(), leadSkin: 'mint' }); scene.init(launch);
    expect(current(scene)).toEqual({ score: 0, best: 0, newRecord: false, coinsEarned: 0, coinBalance: 0 });
  });

  it('passes the preserved trip to the result UI while independently sanitizing achievement IDs', () => {
    const scene = new ResultScene(), snapshot = travel(), shade = { setOrigin() { return this; }, setName() { return this; }, setSize: vi.fn() };
    Object.assign(scene, { add: { rectangle: vi.fn(() => shade) } });
    scene.init({ ...result, travel: snapshot, leadSkin: 'lavender', achievements: ['first-run', 'missing', 'first-run'] }); scene.create();
    expect(addResultView).toHaveBeenCalledExactlyOnceWith(scene, expect.objectContaining({ travel: snapshot, leadSkin: 'lavender' }));
    expect(attachJourneyBook).toHaveBeenCalledExactlyOnceWith(scene, ['first-run']);
    expect(shade.setSize).toHaveBeenCalledExactlyOnceWith(584, 270);
  });
});
