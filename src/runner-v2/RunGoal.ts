export const RUN_GOALS = [
  { id: 'six-stars', label: '收集6颗星星', shortLabel: '收星', target: 6, metric: 'stars', stamp: 'stars' },
  { id: 'eight-obstacles', label: '成功越过8个障碍', shortLabel: '越障', target: 8, metric: 'obstacles', stamp: 'obstacles' },
  { id: 'thirty-seconds', label: '有效跑动30秒', shortLabel: '奔跑', target: 30, metric: 'seconds', stamp: 'time' },
] as const;

export type RunGoalId = typeof RUN_GOALS[number]['id'];
export type RunEventId = string | number;
export interface RunGoalSnapshot {
  readonly id: RunGoalId;
  readonly label: string;
  readonly shortLabel: string;
  readonly progress: number;
  readonly target: number;
  readonly complete: boolean;
  readonly stamp: typeof RUN_GOALS[number]['stamp'];
}
export interface RunGoalOptions {
  seed?: number;
  /** An isolated goal stream, useful for deterministic local acceptance. */
  random?: () => number;
  onComplete?: (goal: RunGoalSnapshot) => void;
}

let fallbackSeed = 0x67a1bd34;
function goalRandom(seed?: number): () => number {
  let value = seed ?? (globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!
    : (fallbackSeed = (fallbackSeed + 0x9e3779b9) >>> 0));
  value = (value >>> 0) || 0x67a1bd34;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    value >>>= 0;
    return value / 0x1_0000_0000;
  };
}

/** One cosmetic objective. Only observed pickups, passes and effective scene delta count. */
export class RunGoal {
  private readonly random: () => number;
  private definition: typeof RUN_GOALS[number];
  private progress = 0;
  private complete = false;
  private stopped = false;
  private readonly stars = new Set<RunEventId>();
  private readonly obstacles = new Set<RunEventId>();

  constructor(private readonly options: RunGoalOptions = {}) {
    this.random = options.random ?? goalRandom(options.seed);
    this.definition = this.choose();
  }
  private choose(): typeof RUN_GOALS[number] {
    const draw = this.random();
    const value = Number.isFinite(draw) ? Math.min(1 - Number.EPSILON, Math.max(0, draw)) : 0;
    return RUN_GOALS[Math.floor(value * RUN_GOALS.length)]!;
  }
  private add(metric: typeof RUN_GOALS[number]['metric'], amount: number): void {
    if (this.stopped || this.complete || this.definition.metric !== metric) return;
    const next = this.progress + amount;
    this.progress = next + 1e-9 >= this.definition.target ? this.definition.target : next;
    if (this.progress >= this.definition.target) {
      this.complete = true;
      this.options.onComplete?.(this.snapshot());
    }
  }
  star(eventId?: RunEventId): void {
    if (this.stopped || this.complete || this.definition.metric !== 'stars' || (eventId !== undefined && this.stars.has(eventId))) return;
    if (eventId !== undefined) this.stars.add(eventId);
    this.add('stars', 1);
  }
  passed(eventId?: RunEventId): void {
    if (this.stopped || this.complete || this.definition.metric !== 'obstacles' || (eventId !== undefined && this.obstacles.has(eventId))) return;
    if (eventId !== undefined) this.obstacles.add(eventId);
    this.add('obstacles', 1);
  }
  update(deltaSeconds: number): void {
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) this.add('seconds', deltaSeconds);
  }
  snapshot(): RunGoalSnapshot {
    return Object.freeze({ id: this.definition.id, label: this.definition.label, shortLabel: this.definition.shortLabel,
      progress: this.progress, target: this.definition.target, complete: this.complete, stamp: this.definition.stamp });
  }
  finish(): RunGoalSnapshot { this.stopped = true; return this.snapshot(); }
  reset(): void {
    this.definition = this.choose(); this.progress = 0; this.complete = false; this.stopped = false;
    this.stars.clear(); this.obstacles.clear();
  }
  clear(): void { this.stopped = true; this.stars.clear(); this.obstacles.clear(); }
}

export const RUN_GOAL_COPY = '本局小目标小目标完成收好本局印章已完成秒';
