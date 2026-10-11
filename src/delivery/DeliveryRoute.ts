import { RUN } from '../game/Constants';
import { WoodFence, Pumpkin, Rock, WideLog, MushroomCluster, HangingBranch, Bramble, TallStack, type ObstacleDefinition } from '../game/ObstacleDefinitions';

export const DELIVERY_ID = 'hill-goodnight-v1';
export const DELIVERY_TITLE = '把晚安送到山坡上';
export const DELIVERY_LENGTH = 18000;
export const DELIVERY_SEED = 0x6e696768;
export type DeliveryPhase = 'pasture' | 'forest' | 'hill' | 'arrival';
export const DELIVERY_PHASES = [
  { id: 'pasture', start: 0, label: '牧场出发' },
  { id: 'forest', start: 5200, label: '林间小路' },
  { id: 'hill', start: 11700, label: '星空山坡' },
  { id: 'arrival', start: 16700, label: '即将送达' },
] as const;
const plan: readonly (readonly [number, ObstacleDefinition])[] = [
  [600, Rock], [1900, Pumpkin], [3200, WoodFence], [4450, Rock],
  [5650, MushroomCluster], [6500, WideLog], [7350, HangingBranch],
  [8450, Bramble], [9300, MushroomCluster], [10400, TallStack],
  [11900, Rock], [13100, HangingBranch], [14300, WideLog], [15400, Pumpkin],
];
// Authored distances and a route-only seed never draw from the endless spawner.
export const DELIVERY_OBSTACLES = plan.map(([at, definition], index) => ({
  at, definition, phase: (((DELIVERY_SEED ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0) / 0x100000000) * Math.PI * 2,
}));

export class DeliveryRoute {
  distance = 0;
  endingMs = 0;
  state: 'running' | 'ending' | 'complete' | 'failed' = 'running';
  private next = 0;
  get phase() { return [...DELIVERY_PHASES].reverse().find(phase => this.distance >= phase.start)!; }
  advance(deltaMs: number, speed: number) {
    const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, RUN.simulationDeltaCapMs)) : 0;
    if (this.state === 'ending') {
      this.endingMs = Math.min(4200, this.endingMs + delta);
      if (this.endingMs >= 4200) this.state = 'complete';
      return [];
    }
    if (this.state !== 'running' || !Number.isFinite(speed) || speed <= 0) return [];
    this.distance = Math.min(DELIVERY_LENGTH, this.distance + speed * delta / 1000);
    const requests: typeof DELIVERY_OBSTACLES = [];
    while (this.next < DELIVERY_OBSTACLES.length && DELIVERY_OBSTACLES[this.next].at <= this.distance) requests.push(DELIVERY_OBSTACLES[this.next++]);
    if (this.distance >= DELIVERY_LENGTH) this.state = 'ending';
    return requests;
  }
  fail() { if (this.state === 'running') this.state = 'failed'; }
}
