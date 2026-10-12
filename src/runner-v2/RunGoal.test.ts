import { describe, expect, it, vi } from 'vitest';
import { RUN_GOALS, RunGoal } from './RunGoal';

describe('run-local cosmetic goal', () => {
  it.each([[0, 'six-stars'], [.34, 'eight-obstacles'], [.99, 'thirty-seconds']] as const)(
    'selects exactly one goal from its isolated stream %s', (random, id) => {
      const draw = vi.fn(() => random), goal = new RunGoal({ random: draw });
      expect(goal.snapshot().id).toBe(id); expect(draw).toHaveBeenCalledTimes(1);
      goal.star(); goal.passed(); goal.update(1); expect(draw).toHaveBeenCalledTimes(1);
    });
  it('counts actual star events once without double-star reward affecting the count', () => {
    const complete = vi.fn(), goal = new RunGoal({ random: () => 0, onComplete: complete });
    goal.passed('obstacle'); goal.update(200);
    expect(goal.snapshot().progress).toBe(0);
    for (let i = 0; i < 5; i++) { goal.star(`pickup-${i}`); goal.star(`pickup-${i}`); }
    expect(goal.snapshot()).toMatchObject({ progress: 5, complete: false });
    goal.star('pickup-5'); goal.star('pickup-5'); goal.star('pickup-6');
    expect(goal.snapshot()).toMatchObject({ progress: 6, complete: true }); expect(complete).toHaveBeenCalledTimes(1);
  });
  it('uses eight successful passes, never obstacle generation or other metrics', () => {
    const complete = vi.fn(), goal = new RunGoal({ random: () => .5, onComplete: complete });
    for (let i = 0; i < 8; i++) { goal.star(i); goal.passed(i); goal.passed(i); }
    expect(goal.snapshot()).toMatchObject({ progress: 8, target: 8, complete: true });
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('only advances the time goal from effective delta supplied by the active scene', () => {
    const goal = new RunGoal({ random: () => .9 });
    goal.update(15); const paused = goal.snapshot();
    // Paused scenes do not call update; snapshot polling has no timing side effects.
    for (let i = 0; i < 50; i++) expect(goal.snapshot()).toEqual(paused);
    goal.update(14.75); expect(goal.snapshot().complete).toBe(false);
    goal.update(.25); expect(goal.snapshot()).toMatchObject({ progress: 30, complete: true });
  });
  it('ignores invalid time deltas and caps progress at the target', () => {
    const goal = new RunGoal({ random: () => .9 });
    for (const value of [0, -1, NaN, Infinity, -Infinity]) goal.update(value);
    expect(goal.snapshot().progress).toBe(0);
    goal.update(31); expect(goal.snapshot().progress).toBe(30);
  });
  it('completes at thirty effective seconds despite sub-frame floating-point rounding', () => {
    const goal = new RunGoal({ random: () => .9 });
    for (let i = 0; i < 750; i++) goal.update(.04);
    expect(goal.snapshot()).toMatchObject({ progress: 30, complete: true });
  });
  it('finishing before completion stops all observations without penalizing or awarding', () => {
    const complete = vi.fn(), goal = new RunGoal({ random: () => 0, onComplete: complete });
    goal.star(1); const finished = goal.finish();
    for (let i = 2; i < 20; i++) goal.star(i);
    goal.passed(); goal.update(100);
    expect(goal.snapshot()).toEqual(finished); expect(complete).not.toHaveBeenCalled();
  });
  it('restarts from zero, allows reused pool-event IDs, and chooses only once per run', () => {
    const draw = vi.fn(() => 0), complete = vi.fn(), goal = new RunGoal({ random: draw, onComplete: complete });
    for (let i = 0; i < 6; i++) goal.star(i);
    goal.reset(); expect(goal.snapshot()).toMatchObject({ progress: 0, complete: false });
    for (let i = 0; i < 6; i++) goal.star(i);
    expect(complete).toHaveBeenCalledTimes(2); expect(draw).toHaveBeenCalledTimes(2);
  });
  it('clear stops completion and retains a frozen last-goal snapshot for safe teardown', () => {
    const complete = vi.fn(), goal = new RunGoal({ random: () => .9, onComplete: complete });
    goal.update(20); goal.clear(); goal.update(30);
    expect(goal.snapshot()).toMatchObject({ progress: 20, complete: false }); expect(complete).not.toHaveBeenCalled();
  });
  it('returns immutable snapshots and keeps callback payload isolated', () => {
    const snapshots: unknown[] = [], goal = new RunGoal({ random: () => .9, onComplete: value => snapshots.push(value) });
    const first = goal.snapshot(); expect(Object.isFrozen(first)).toBe(true);
    goal.update(30); expect(first.progress).toBe(0); expect(Object.isFrozen(snapshots[0])).toBe(true);
  });
  it('never consumes shared Math.random even across resets', () => {
    const shared = vi.spyOn(Math, 'random'), goal = new RunGoal({ seed: 12345 });
    goal.reset(); goal.reset(); goal.update(100); expect(shared).not.toHaveBeenCalled(); shared.mockRestore();
  });
  it('keeps equal independent seeds deterministic without consuming companion/obstacle streams', () => {
    const a = new RunGoal({ seed: 431 }), b = new RunGoal({ seed: 431 });
    for (let i = 0; i < 30; i++) { expect(a.snapshot().id).toEqual(b.snapshot().id); a.reset(); b.reset(); }
  });
  it.each([NaN, -1, 1, Infinity])('handles an out-of-range injected draw %s without a missing goal', random => {
    expect(RUN_GOALS.some(goal => goal.id === new RunGoal({ random: () => random }).snapshot().id)).toBe(true);
  });
});
