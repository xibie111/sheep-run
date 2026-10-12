import { describe, expect, it } from 'vitest';
import { tripCardModel } from '../content-v2/TripCardModel';
import { SKIN_NAMES } from '../data/skinSpriteAssets';
import { RunGoal } from './RunGoal';
import { RunTravel, type RunTravelSnapshot } from './RunTravel';
import { toTripCardInput } from './TripInput';

describe('truthful B travel-card input adapter', () => {
  it('preserves known zero stars and an empty run without inventing any catalog visits', () => {
    const input = toTripCardInput(new RunTravel().snapshot());
    expect(input).toEqual({ seasons: [], starsCollected: 0, companionSkins: [], animals: [], landmarks: [], newCollections: [], goals: [], newRecord: false });
    expect(tripCardModel(input).highlights).toEqual([]);
    expect(tripCardModel(input).summary).toBe('还没有收起星星，下一段路再慢慢找。');
  });

  it('names only actual observations from the existing skin, collection and landmark catalogs', () => {
    const run = new RunTravel(); run.visitSeason('spring'); run.star(); run.star(); run.summon('mint');
    run.visibleAnimal('duck-family'); run.visibleLandmark('windmill-meadow'); run.collect('spring-flower'); run.record();
    const input = toTripCardInput(run.finish(), 'cloud');
    expect(input).toMatchObject({ protagonist: { id: 'cloud', name: SKIN_NAMES.cloud }, seasons: ['spring'], starsCollected: 2,
      companionSkins: [{ id: 'mint', name: SKIN_NAMES.mint }], animals: [{ id: 'duck-family', name: '一家小鸭' }],
      landmarks: [{ id: 'windmill-meadow', name: '风车草地' }], newCollections: [{ id: 'spring-flower', name: '春日花' }], newRecord: true });
  });

  it('preserves actual longer skin names and the precise observed animal IDs', () => {
    const run = new RunTravel(); run.summon('lavender'); run.summon('sleepy-pink'); run.visibleAnimal('rabbit-butterfly');
    expect(toTripCardInput(run.snapshot(), 'lavender')).toMatchObject({ protagonist: { id: 'lavender', name: '薰衣草羊' },
      companionSkins: [{ id: 'lavender', name: '薰衣草羊' }, { id: 'sleepy-pink', name: '柔粉睡羊' }],
      animals: [{ id: 'rabbit-butterfly', name: '追蝴蝶的小兔' }] });
  });

  it('does not substitute existing collection ownership for newly picked-up collection IDs', () => {
    const run = new RunTravel(); run.collect('winter-cocoa');
    expect(toTripCardInput(run.snapshot()).newCollections).toEqual([{ id: 'winter-cocoa', name: '热可可' }]);
    expect(toTripCardInput(new RunTravel().snapshot()).newCollections).toEqual([]);
  });

  it('filters invalid and retired IDs and deduplicates observed facts without altering their order', () => {
    const input = toTripCardInput({ ...new RunTravel().snapshot(), seasons: ['summer', 'unknown', 'summer', 'spring'],
      companionSkins: ['mint', 'missing-skin', 'mint', 'white'], animals: ['rabbit-butterfly', 'squirrel-acorn', 'rabbit-butterfly', 'missing-animal'],
      landmarks: ['old-barn', 'missing-landmark', 'old-barn'], newCollections: ['spring-clover', 'missing-badge', 'spring-clover'],
    } as unknown as RunTravelSnapshot, 'missing-skin' as never);
    expect(input.protagonist).toBeUndefined(); expect(input.seasons).toEqual(['summer', 'spring']);
    expect(input.companionSkins).toEqual([{ id: 'mint', name: SKIN_NAMES.mint }, { id: 'white', name: SKIN_NAMES.white }]);
    expect(input.animals).toEqual([{ id: 'rabbit-butterfly', name: '追蝴蝶的小兔' }]);
    expect(input.landmarks).toEqual([{ id: 'old-barn', name: '旧谷仓' }]);
    expect(input.newCollections).toEqual([{ id: 'spring-clover', name: '幸运草' }]);
  });

  it('keeps an unfinished goal incomplete so the card cannot award a completed-goal highlight', () => {
    const run = new RunTravel(), goal = new RunGoal({ random: () => 0 }); goal.star(); run.goal(goal.snapshot());
    const input = toTripCardInput(run.snapshot());
    expect(input.goals).toEqual([{ id: 'six-stars', title: '收集6颗星星', completed: false }]);
    expect(tripCardModel(input).highlights.some(item => item.kind === 'goal')).toBe(false);
  });

  it('maps a genuinely completed goal without inventing any additional goals', () => {
    const run = new RunTravel(), goal = new RunGoal({ random: () => .9 }); goal.update(30); run.goal(goal.snapshot());
    const input = toTripCardInput(run.snapshot());
    expect(input.goals).toEqual([{ id: 'thirty-seconds', title: '有效跑动30秒', completed: true }]);
    expect(tripCardModel(input).highlights).toEqual([{ kind: 'goal', text: '完成了「有效跑动30秒」。', ids: ['thirty-seconds'] }]);
  });

  it('drops an unknown goal ID instead of interpreting a future catalog plan as accomplished', () => {
    const goal = new RunGoal({ random: () => 0 }).snapshot();
    expect(toTripCardInput({ ...new RunTravel().snapshot(), goal: { ...goal, id: 'not-a-goal', complete: true } } as unknown as RunTravelSnapshot).goals).toEqual([]);
  });

  it.each([NaN, Infinity, -1, 1.5])('omits invalid star measurement %s instead of inventing zero or rounding it', stars => {
    const input = toTripCardInput({ ...new RunTravel().snapshot(), stars });
    expect(Object.hasOwn(input, 'starsCollected')).toBe(false);
  });

  it('deep-freezes the mapped arrays and named values while leaving the immutable source unchanged', () => {
    const run = new RunTravel(), goal = new RunGoal({ random: () => 0 });
    run.summon('mint'); run.visibleAnimal('duck-family'); run.visibleLandmark('old-barn'); run.collect('spring-flower'); run.goal(goal.snapshot());
    const snapshot = run.snapshot(), source = JSON.stringify(snapshot), input = toTripCardInput(snapshot, 'white');
    for (const value of [input, input.protagonist, input.seasons, input.companionSkins, input.companionSkins![0], input.animals,
      input.animals![0], input.landmarks, input.landmarks![0], input.newCollections, input.newCollections![0], input.goals, input.goals![0]]) expect(Object.isFrozen(value)).toBe(true);
    tripCardModel(input); expect(JSON.stringify(snapshot)).toBe(source);
    expect(input.companionSkins).not.toBe(snapshot.companionSkins); expect(input.seasons).not.toBe(snapshot.seasons);
  });
});
