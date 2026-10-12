import { describe, expect, it } from 'vitest';
import { RunGoal } from './RunGoal';
import { RunTravel } from './RunTravel';

describe('observed run travel record', () => {
  it('starts empty and does not infer anything from catalogs, unlocked skins or planned events', () => {
    expect(new RunTravel().snapshot()).toEqual({ seasons: [], stars: 0, companionSkins: [], animals: [],
      landmarks: [], newCollections: [], goal: null, newRecord: false });
  });
  it('records actual star pickups once per spawn-event ID, with no reward multiplier', () => {
    const travel = new RunTravel(); travel.star('star-spawn-1'); travel.star('star-spawn-1'); travel.star('star-spawn-2');
    expect(travel.snapshot().stars).toBe(2);
  });
  it('preserves first-visit order while deduplicating repeated seasons', () => {
    const travel = new RunTravel(); travel.visitSeason('spring'); travel.visitSeason('summer'); travel.visitSeason('spring'); travel.visitSeason('winter');
    expect(travel.snapshot().seasons).toEqual(['spring', 'summer', 'winter']);
  });
  it('records only summoned skins, avoiding repeat callbacks and duplicate summary labels', () => {
    const travel = new RunTravel(); travel.summon('white', 'bell-1'); travel.summon('mint', 'bell-1');
    travel.summon('white', 'bell-2'); travel.summon('mint', 'bell-3');
    expect(travel.snapshot().companionSkins).toEqual(['white', 'mint']);
  });
  it('separates visible animals and landmarks, never counting offscreen plans', () => {
    const travel = new RunTravel();
    travel.visibleAnimal('duck-family', 'animal-1'); travel.visibleAnimal('rabbit-butterfly', 'animal-1');
    travel.visibleAnimal('duck-family', 'animal-2'); travel.visibleAnimal('rabbit-butterfly', 'animal-3');
    travel.visibleLandmark('windmill', 'landmark-1'); travel.visibleLandmark('old-bridge', 'landmark-1');
    travel.visibleLandmark('old-bridge', 'landmark-2');
    expect(travel.snapshot()).toMatchObject({ animals: ['duck-family', 'rabbit-butterfly'], landmarks: ['windmill', 'old-bridge'] });
  });
  it('ignores empty decorative IDs and deduplicates newly collected badges', () => {
    const travel = new RunTravel(); travel.visibleAnimal(''); travel.visibleLandmark(''); travel.collect('');
    travel.collect('spring-flower'); travel.collect('spring-flower'); travel.collect('summer-watermelon');
    expect(travel.snapshot()).toMatchObject({ animals: [], landmarks: [], newCollections: ['spring-flower', 'summer-watermelon'] });
  });
  it('copies actual goal snapshots and preserves unfinished progress at failure', () => {
    const travel = new RunTravel(), goal = new RunGoal({ random: () => 0 });
    goal.star(1); travel.goal(goal.snapshot()); const failed = travel.finish(); goal.star(2);
    expect(failed.goal).toMatchObject({ progress: 1, complete: false });
  });
  it('records a new best only when the observer explicitly reports it', () => {
    const travel = new RunTravel(); expect(travel.snapshot().newRecord).toBe(false);
    travel.record(); travel.record(); expect(travel.snapshot().newRecord).toBe(true);
  });
  it('deep-freezes snapshot arrays and copied goal so result presentation cannot alter the run', () => {
    const travel = new RunTravel(), goal = new RunGoal({ random: () => 0 });
    travel.visitSeason('summer'); travel.summon('cloud'); travel.visibleAnimal('duck-family'); travel.visibleLandmark('bridge'); travel.collect('summer-1'); travel.goal(goal.snapshot());
    const first = travel.snapshot();
    for (const value of [first, first.seasons, first.companionSkins, first.animals, first.landmarks, first.newCollections, first.goal]) expect(Object.isFrozen(value)).toBe(true);
    travel.star(); goal.star(); travel.goal(goal.snapshot());
    expect(first.stars).toBe(0); expect(first.goal?.progress).toBe(0);
  });
  it('finishing stops all later events including callbacks from visuals being destroyed', () => {
    const travel = new RunTravel(); travel.visitSeason('spring'); travel.star('actual'); const result = travel.finish();
    travel.star('late'); travel.summon('mint'); travel.visibleAnimal('duck-family'); travel.visibleLandmark('bridge');
    travel.collect('spring-1'); travel.goal(new RunGoal().snapshot()); travel.record(); travel.visitSeason('winter');
    expect(travel.snapshot()).toEqual(result);
  });
  it('resets completely and accepts reused event IDs in the next run while old results stay intact', () => {
    const travel = new RunTravel(); travel.star(1); travel.visitSeason('summer'); travel.record(); const previous = travel.finish();
    travel.reset(); expect(travel.snapshot()).toEqual(new RunTravel().snapshot()); travel.star(1);
    expect(travel.snapshot().stars).toBe(1); expect(previous).toMatchObject({ stars: 1, seasons: ['summer'], newRecord: true });
  });
  it('clears exit data and prevents unmounted listeners from recreating a next-run record', () => {
    const travel = new RunTravel(); travel.star(1); travel.summon('cloud'); travel.record(); travel.clear();
    travel.star(2); travel.visibleAnimal('duck-family');
    expect(travel.snapshot()).toEqual(new RunTravel().snapshot());
  });
});
