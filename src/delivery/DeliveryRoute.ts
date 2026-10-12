import { DeliveryChallengeRun } from './DeliveryChallengeRun';
import { RUN } from '../game/Constants';
import { defaultDeliveryChapter, getDeliveryChapter, type DeliveryChapterId, type DeliveryObstacleRequest } from './DeliveryChapters';
export { DELIVERY_CHAPTERS, defaultDeliveryChapter, getDeliveryChapter, isDeliveryChapterId, DELIVERY_V2_TEXT, DELIVERY_EXPANSION_TEXT } from './DeliveryChapters';
export type { DeliveryChapter, DeliveryChapterId, DeliveryPhase, DeliveryPhaseDefinition, DeliveryObstacleRequest } from './DeliveryChapters';
const original = defaultDeliveryChapter();
export const DELIVERY_ID = original.id;
export const DELIVERY_TITLE = original.title;
export const DELIVERY_LENGTH = original.length;
export const DELIVERY_SEED = original.seed;
export const DELIVERY_PHASES = original.phases;
export const DELIVERY_OBSTACLES = original.obstacles;

export class DeliveryRoute {
  readonly chapter;
  readonly challenge?: DeliveryChallengeRun;
  distance = 0;
  endingMs = 0;
  state: 'running' | 'ending' | 'complete' | 'failed' = 'running';
  private next = 0;
  constructor(chapterId: DeliveryChapterId | string = DELIVERY_ID) { this.chapter = getDeliveryChapter(chapterId) ?? defaultDeliveryChapter(); this.challenge = this.chapter.challenge ? new DeliveryChallengeRun(this.chapter.challenge) : undefined; }
  get phase() { return [...this.chapter.phases].reverse().find(phase => this.distance >= phase.start)!; }
  advance(deltaMs: number, speed: number): DeliveryObstacleRequest[] {
    const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, RUN.simulationDeltaCapMs)) : 0;
    if (this.state === 'ending') {
      this.endingMs = Math.min(this.chapter.endingDurationMs, this.endingMs + delta);
      if (this.endingMs >= this.chapter.endingDurationMs) { this.state = 'complete'; this.challenge?.finish(true); }
      return [];
    }
    if (this.state !== 'running' || !Number.isFinite(speed) || speed <= 0) return [];
    this.distance = Math.min(this.chapter.length, this.distance + speed * delta / 1000);
    const requests: DeliveryObstacleRequest[] = [];
    while (this.next < this.chapter.obstacles.length && this.chapter.obstacles[this.next].at <= this.distance) requests.push(this.chapter.obstacles[this.next++]);
    if (this.distance >= this.chapter.length) this.state = 'ending';
    return requests;
  }
  fail() { if (this.state === 'running') { this.state = 'failed'; this.challenge?.finish(false); } }
}
export function createDeliveryRoute(chapterId?: DeliveryChapterId | string): DeliveryRoute { return new DeliveryRoute(chapterId); }
