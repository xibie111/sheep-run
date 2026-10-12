import { WoodFence, Pumpkin, Rock, WideLog, MushroomCluster, HangingBranch, Bramble, TallStack, type ObstacleDefinition } from '../game/ObstacleDefinitions';

export type DeliveryChapterId = 'hill-goodnight-v1' | 'dinner-for-you-v1';
export type DeliveryPhase = 'pasture' | 'forest' | 'hill' | 'arrival' | 'dusk-pasture' | 'field' | 'cottage';
export interface DeliveryPhaseDefinition { readonly id: DeliveryPhase; readonly start: number; readonly label: string }
export interface DeliveryObstacleRequest { readonly at: number; readonly definition: ObstacleDefinition; readonly phase: number }
export interface DeliveryLandscape { readonly key: string; readonly transitionStart: number; readonly transitionEnd: number }
export interface DeliveryChapter {
  readonly id: DeliveryChapterId; readonly title: string; readonly introduction: readonly string[]; readonly itinerary: string;
  readonly length: number; readonly seed: number; readonly phases: readonly DeliveryPhaseDefinition[];
  readonly obstacles: readonly DeliveryObstacleRequest[]; readonly landscapes: readonly DeliveryLandscape[];
  readonly previewKey: string; readonly postcardKey: string; readonly endingKey: string; readonly accessoryKey?: string;
  readonly companionAt: number; readonly destinationAt: number; readonly endingDurationMs: number; readonly endingKind: 'goodnight' | 'dinner';
  readonly postcardTitle: string; readonly deliveredLabel: string; readonly successText: string; readonly postcardText: string;
  readonly failureTitle: string; readonly failureText: string; readonly startLabel: string;
}
const authored = (seed: number, plan: readonly (readonly [number, ObstacleDefinition])[]): readonly DeliveryObstacleRequest[] =>
  Object.freeze(plan.map(([at, definition], index) => Object.freeze({ at, definition,
    phase: (((seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0) / 0x100000000) * Math.PI * 2 })));

// Preserve every authored distance, seed, phase boundary and line of the first chapter.
const goodnight: DeliveryChapter = Object.freeze({
  id: 'hill-goodnight-v1', title: '把晚安送到山坡上', introduction: ['山坡上的小屋，', '还在等一封晚安信。'],
  itinerary: '牧场 · 林间 · 山坡', length: 18000, seed: 0x6e696768,
  phases: Object.freeze([
    { id: 'pasture', start: 0, label: '牧场出发' }, { id: 'forest', start: 5200, label: '林间小路' },
    { id: 'hill', start: 11700, label: '星空山坡' }, { id: 'arrival', start: 16700, label: '即将送达' },
  ] as const),
  obstacles: authored(0x6e696768, [[600, Rock], [1900, Pumpkin], [3200, WoodFence], [4450, Rock],
    [5650, MushroomCluster], [6500, WideLog], [7350, HangingBranch], [8450, Bramble], [9300, MushroomCluster],
    [10400, TallStack], [11900, Rock], [13100, HangingBranch], [14300, WideLog], [15400, Pumpkin]]),
  landscapes: Object.freeze([{ key: 'delivery-forest-v1', transitionStart: 4800, transitionEnd: 5700 },
    { key: 'delivery-hill-v1', transitionStart: 11200, transitionEnd: 12300 }]),
  previewKey: 'delivery-hill-v1', postcardKey: 'delivery-postcard-v1', endingKey: 'delivery-postcard-v1',
  companionAt: 6500, destinationAt: 17400, endingDurationMs: 4200, endingKind: 'goodnight',
  postcardTitle: '山坡晚安', deliveredLabel: '晚安已送达', successText: '晚安已送达，明信片已收好。',
  postcardText: '山坡上的晚安，一直为你留着。', failureTitle: '这封晚安，再送一次吧',
  failureText: '信还在邮袋里。', startLabel: '背上邮袋出发',
});
const dinner: DeliveryChapter = Object.freeze({
  id: 'dinner-for-you-v1', title: '带着晚饭去找你', introduction: ['把热乎乎的晚饭，', '送到有灯光的窗边。'],
  itinerary: '傍晚牧场 · 田间 · 窗边小屋', length: 18000, seed: 0x64696e72,
  phases: Object.freeze([{ id: 'dusk-pasture', start: 0, label: '傍晚牧场出发' }, { id: 'field', start: 5200, label: '田间小路' },
    { id: 'cottage', start: 11700, label: '窗边小屋' }, { id: 'arrival', start: 16500, label: '晚饭快到了' }] as const),
  // All hazards end 3,200 road units before destination. Shared runner physics stay unchanged.
  obstacles: authored(0x64696e72, [[650, Rock], [2100, Pumpkin], [3600, WoodFence], [4950, WideLog],
    [6350, Rock], [7800, Bramble], [9100, MushroomCluster], [10400, HangingBranch],
    [11900, TallStack], [13300, WideLog], [14800, Pumpkin]]),
  landscapes: Object.freeze([{ key: 'content-v2-delivery-dusk-pasture', transitionStart: 0, transitionEnd: 0 },
    { key: 'content-v2-delivery-field', transitionStart: 4800, transitionEnd: 5700 },
    { key: 'content-v2-delivery-cottage', transitionStart: 11200, transitionEnd: 12300 }]),
  previewKey: 'content-v2-delivery-cottage', postcardKey: 'content-v2-delivery-dinner-postcard',
  endingKey: 'content-v2-delivery-dinner-ending', accessoryKey: 'content-v2-delivery-lunchbox',
  companionAt: 6500, destinationAt: 17400, endingDurationMs: 4200, endingKind: 'dinner',
  postcardTitle: '一起吃晚饭', deliveredLabel: '晚饭已送达', successText: '晚饭已送达，明信片已收好。',
  postcardText: '饭盒打开了，喜欢也藏不住了。', failureTitle: '这份晚饭，再送一次吧',
  failureText: '晚饭还在小饭盒里。', startLabel: '带上晚饭出发',
});
export const DELIVERY_CHAPTERS: readonly DeliveryChapter[] = Object.freeze([goodnight, dinner]);
export function isDeliveryChapterId(value: unknown): value is DeliveryChapterId { return typeof value === 'string' && DELIVERY_CHAPTERS.some(chapter => chapter.id === value); }
export function getDeliveryChapter(id: unknown): DeliveryChapter | undefined { return DELIVERY_CHAPTERS.find(chapter => chapter.id === id); }
export function defaultDeliveryChapter(): DeliveryChapter { return goodnight; }
/** A unions this with its existing font input. */
export const DELIVERY_V2_TEXT = [dinner.title, ...dinner.introduction, dinner.itinerary, ...dinner.phases.map(phase => phase.label),
  dinner.postcardTitle, dinner.deliveredLabel, dinner.successText, dinner.postcardText, dinner.failureTitle, dinner.failureText, dinner.startLabel,
  '选一段送信路线', '约一分钟的小旅行', '已收好', '未送达', '选择章节', '返回章节', '返回邮箱', '重新送一次', '查看明信片',
  '准备好了，就重新出发。', '本次已收好，暂未保存到设备'] as const;
