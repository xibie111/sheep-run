import type { AnimalFrame } from './animalAssets';
import { ANIMAL_DURATIONS, type AnimalEventId } from './AnimalRules';
export interface AnimalPose { slot: string; frame: AnimalFrame; x: number; y: number; alpha: number; flipX?: boolean; }
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number): number => a + (b - a) * clamp(t);

/** Local positions only: the controller adds the moving, painted landscape anchor. */
export function animalPoses(kind: AnimalEventId, elapsedMs: number, reducedMotion: boolean): AnimalPose[] {
  const duration = ANIMAL_DURATIONS[kind], age = Math.max(0, Math.min(duration, elapsedMs)), t = age / 1000;
  const alpha = Math.min(clamp(age / 350), clamp((duration - age) / 600));
  const pose = (slot: string, frame: AnimalFrame, x: number, y: number, opacity = 1, flipX = false): AnimalPose => ({ slot, frame, x, y, alpha: alpha * opacity, flipX });
  const walking = Math.floor(age / 180) % 2;
  if (kind === 'duck-family') {
    const head = reducedMotion ? 18 : mix(-1, 24, t / 7);
    return [pose('mother', reducedMotion || !walking ? 'duck-0' : 'duck-1', head, -5),
      ...[1, 2, 3].flatMap(index => {
        const lag = reducedMotion ? 0 : index === 3 ? 6 * (1 - clamp(t / 4)) : 0;
        const x = head - index * 11 - lag;
        return [pose(`duckling-${index}`, reducedMotion || (walking + index) % 2 === 0 ? 'duckling-0' : 'duckling-1', x, -5),
          pose(`ripple-${index}`, 'ripple', x, -4, .6)];
      })];
  }
  if (kind === 'squirrel-acorn') {
    if (reducedMotion) return [pose('squirrel', 'squirrel-pat', 12, 0), pose('soil', 'soil', 3, 1), pose('acorn', 'acorn', 3, 0)];
    const leaving = t >= 4.3;
    const x = t < 1.2 ? mix(36, 12, t / 1.2) : leaving ? mix(12, 42, (t - 4.3) / 1.7) : 12;
    const frame: AnimalFrame = t < 1.2 || leaving ? walking ? 'squirrel-run-0' : 'squirrel-run-1'
      : t < 2.3 ? 'squirrel-dig' : walking ? 'squirrel-dig' : 'squirrel-pat';
    return [pose('soil', 'soil', 3, 1, clamp((t - 1.4) / .8)),
      pose('acorn', 'acorn', t < 1.2 ? x - 8 : 3, t < 1.2 ? -3 : 0, t < 2.1 ? 1 : 0),
      pose('squirrel', frame, x, 0, 1, leaving)];
  }
  const hop = (start: number): number => t >= start && t < start + 1 ? Math.sin((t - start) * Math.PI) * 7 : 0;
  const up = reducedMotion ? 0 : hop(.8) + hop(2.3);
  const x = reducedMotion ? 0 : mix(-8, 11, t / 6);
  const frame: AnimalFrame = reducedMotion ? 'rabbit-idle' : up > .5 ? 'rabbit-hop' : t > 4.5 ? 'rabbit-run' : walking ? 'rabbit-idle' : 'rabbit-land';
  return [pose('rabbit', frame, x, -up), pose('butterfly', reducedMotion || !walking ? 'butterfly-open' : 'butterfly-closed',
    x + 13 + (reducedMotion ? 0 : Math.sin(t * 2) * 4), -13 + (reducedMotion ? 0 : Math.cos(t * 2) * 3))];
}
