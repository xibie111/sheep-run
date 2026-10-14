import type { DeliveryChallengeChapterId, DeliveryChallengeDefinition } from './DeliveryChallengeRun';
import { WoodFence, Pumpkin, Rock, WideLog, MushroomCluster, HangingBranch, Bramble, TallStack, type ObstacleDefinition } from '../game/ObstacleDefinitions';
import { RESIDENT_ROUTES, type ResidentEndingDefinition } from './ResidentRoutes';

export type DeliveryChapterId = 'hill-goodnight-v1' | 'dinner-for-you-v1' | DeliveryChallengeChapterId;
export type DeliveryPhase = 'pasture' | 'forest' | 'hill' | 'arrival' | 'dusk-pasture' | 'field' | 'cottage' | 'sunny-pasture' | 'wheat-path' | 'windmill-meadow' | 'cloudy-pasture' | 'rain-forest' | 'river-cottage' | 'twilight-meadow' | 'starlight-path' | 'seaside-lighthouse'
  | 'flower-cottage' | 'flower-path' | 'field-crossroads' | 'windmill-picnic' | 'after-rain-meadow' | 'bridge-neighbor'
  | 'bridge-meadow' | 'sunny-riverside' | 'lighthouse-hill' | 'seaside-path' | 'harbor-cottage' | 'harbor-dusk' | 'starlight-coast' | 'lighthouse-platform';
export interface DeliveryPhaseDefinition { readonly id: DeliveryPhase; readonly start: number; readonly label: string; readonly weather?: 'clear' | 'rain' | 'starlight' }
export interface DeliveryObstacleRequest { readonly at: number; readonly definition: ObstacleDefinition; readonly phase: number }
export interface DeliveryLandscape { readonly key: string; readonly transitionStart: number; readonly transitionEnd: number; readonly focus?: 'right' }
export interface DeliveryChapter {
  readonly id: DeliveryChapterId; readonly title: string; readonly introduction: readonly string[]; readonly itinerary: string;
  readonly length: number; readonly seed: number; readonly phases: readonly DeliveryPhaseDefinition[];
  readonly obstacles: readonly DeliveryObstacleRequest[]; readonly landscapes: readonly DeliveryLandscape[];
  readonly previewKey: string; readonly postcardKey: string; readonly endingKey: string; readonly accessoryKey?: string;
  readonly companionAt: number; readonly destinationAt: number; readonly endingDurationMs: number; readonly endingKind: 'goodnight' | 'dinner' | 'invitation' | 'umbrella' | 'lighthouse' | 'resident';
  readonly residentEnding?: ResidentEndingDefinition;
  readonly postcardTitle: string; readonly deliveredLabel: string; readonly successText: string; readonly postcardText: string;
  readonly challenge?: DeliveryChallengeDefinition; readonly difficultyLabel?: string;
  readonly weather?: 'clear' | 'rain' | 'starlight'; readonly roadCropRatio?: number;
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
const challenge = (slug: string, ordinaryAt: readonly number[], hiddenAt: number): DeliveryChallengeDefinition => Object.freeze({
  keepsakeKey: `delivery-expansion-${slug}-keepsake`,
  stamps: Object.freeze([...ordinaryAt.map((at, index) => Object.freeze({
    id: `${slug}-ordinary-${index + 1}`, at, y: 182, kind: 'ordinary' as const,
    key: `delivery-expansion-${slug}-ordinary`,
  })), Object.freeze({ id: `${slug}-keepsake`, at: hiddenAt, y: 88, kind: 'keepsake' as const,
    key: `delivery-expansion-${slug}-keepsake` })]),
});
const expansionArt = (slug: string, middleAt: number, destinationAt: number): readonly DeliveryLandscape[] => Object.freeze([
  { key: `delivery-expansion-${slug}-pasture`, transitionStart: 0, transitionEnd: 0 },
  { key: `delivery-expansion-${slug}-middle`, transitionStart: middleAt - 500, transitionEnd: middleAt + 500 },
  { key: `delivery-expansion-${slug}-destination`, transitionStart: destinationAt - 500, transitionEnd: destinationAt + 500, focus: 'right' },
]);
const invitation: DeliveryChapter = Object.freeze({
  id: 'windmill-invitation-v1', title: '给风车送邀请函',
  introduction: ['风车旁的牧场居民，', '还没收到野餐邀请。', '带上信，一起出发吧。'],
  itinerary: '晴日牧场 · 麦田小路 · 风车邮箱', difficultyLabel: '轻松', length: 21000, seed: 0x77696e64,
  phases: Object.freeze([{ id: 'sunny-pasture', start: 0, label: '晴日牧场' },
    { id: 'wheat-path', start: 6500, label: '麦田小路' }, { id: 'windmill-meadow', start: 14100, label: '风车草地' },
    { id: 'arrival', start: 19000, label: '风车旁的邮箱' }] as const),
  obstacles: authored(0x77696e64, [[900, Rock], [2350, Pumpkin], [3800, WoodFence], [5250, Rock], [6700, WideLog],
    [8150, HangingBranch], [9600, MushroomCluster], [11050, WoodFence], [12500, HangingBranch], [13950, Pumpkin],
    [15400, WideLog], [16850, Rock]]),
  landscapes: expansionArt('windmill', 6500, 14100), weather: 'clear', roadCropRatio: .72,
  previewKey: 'delivery-expansion-windmill-destination', postcardKey: 'delivery-expansion-windmill-postcard',
  endingKey: 'delivery-expansion-windmill-ending', accessoryKey: 'delivery-expansion-windmill-carried',
  companionAt: 14000, destinationAt: 20200, endingDurationMs: 4600, endingKind: 'invitation',
  postcardTitle: '风车下的邀请', deliveredLabel: '邀请函已送达', successText: '邀请函送到了，明信片已收好。',
  postcardText: '邀请函送到了，风车下多了一个等你的位置。', failureTitle: '这封邀请函，再送一次吧',
  failureText: '邀请函还在邮袋里。', startLabel: '带上邀请函出发',
  challenge: challenge('windmill', [1550, 5900, 10300, 14600, 18400], 8600),
});
const umbrella: DeliveryChapter = Object.freeze({
  id: 'rainy-umbrella-v1', title: '雨天的借伞信',
  introduction: ['河边的小屋下雨了，', '有人正等着借伞的回信。', '把信和小雨伞一起送过去。'],
  itinerary: '阴天牧场 · 雨中树林 · 河边小屋', difficultyLabel: '适中', length: 22000, seed: 0x7261696e,
  phases: Object.freeze([{ id: 'cloudy-pasture', start: 0, label: '阴天牧场', weather: 'clear' },
    { id: 'rain-forest', start: 6800, label: '雨中树林', weather: 'rain' }, { id: 'river-cottage', start: 14900, label: '河边小屋', weather: 'rain' },
    { id: 'arrival', start: 20000, label: '屋前邮箱', weather: 'rain' }] as const),
  obstacles: authored(0x7261696e, [[900, Rock], [2300, HangingBranch], [3700, WoodFence], [5100, HangingBranch],
    [6500, Bramble], [7900, HangingBranch], [9300, WideLog], [10700, HangingBranch], [12100, MushroomCluster],
    [13500, HangingBranch], [14900, WoodFence], [16300, HangingBranch], [17700, Rock]]),
  landscapes: expansionArt('rain', 6800, 14900), weather: 'rain', roadCropRatio: .72,
  previewKey: 'delivery-expansion-rain-destination', postcardKey: 'delivery-expansion-rain-postcard',
  endingKey: 'delivery-expansion-rain-ending', accessoryKey: 'delivery-expansion-rain-carried',
  companionAt: 14700, destinationAt: 21200, endingDurationMs: 4600, endingKind: 'umbrella',
  postcardTitle: '屋檐下的小雨伞', deliveredLabel: '借伞信已送达', successText: '信和雨伞送到了，明信片已收好。',
  postcardText: '雨还在下，回家的路已经有人照亮。', failureTitle: '这封借伞信，再送一次吧',
  failureText: '信和小雨伞还在身边。', startLabel: '带上信和雨伞出发',
  challenge: challenge('rain', [1550, 5750, 9950, 14200, 18800], 11300),
});
const starlight: DeliveryChapter = Object.freeze({
  id: 'lighthouse-starlight-v1', title: '送到灯塔的星光信',
  introduction: ['灯塔上的守夜人，', '正在等今晚最后一封信。', '沿着星光，把它送到海边。'],
  itinerary: '暮色草地 · 星光小路 · 海边灯塔', difficultyLabel: '稍有挑战', length: 24000, seed: 0x6c696768,
  phases: Object.freeze([{ id: 'twilight-meadow', start: 0, label: '暮色草地', weather: 'clear' },
    { id: 'starlight-path', start: 7500, label: '星光小路', weather: 'starlight' }, { id: 'seaside-lighthouse', start: 16300, label: '海边灯塔', weather: 'starlight' },
    { id: 'arrival', start: 22000, label: '灯塔邮箱', weather: 'starlight' }] as const),
  obstacles: authored(0x6c696768, [[950, WoodFence], [2350, HangingBranch], [3750, WideLog], [5150, HangingBranch],
    [6550, TallStack], [7950, Rock], [9350, HangingBranch], [10750, Bramble], [12150, TallStack],
    [13550, HangingBranch], [14950, WideLog], [16350, HangingBranch], [17750, MushroomCluster], [19150, TallStack]]),
  landscapes: expansionArt('lighthouse', 7500, 16300), weather: 'starlight', roadCropRatio: .72,
  previewKey: 'delivery-expansion-lighthouse-destination', postcardKey: 'delivery-expansion-lighthouse-postcard',
  endingKey: 'delivery-expansion-lighthouse-ending', accessoryKey: 'delivery-expansion-lighthouse-carried',
  companionAt: 16100, destinationAt: 23200, endingDurationMs: 5000, endingKind: 'lighthouse',
  postcardTitle: '灯塔收到的星光', deliveredLabel: '星光信已送达', successText: '星光信送到了，明信片已收好。',
  postcardText: '最后一封信送到了，灯塔也亮了起来。', failureTitle: '这封星光信，再送一次吧',
  failureText: '星光信还在邮袋里。', startLabel: '沿着星光出发',
  challenge: challenge('lighthouse', [1600, 5850, 10000, 15650, 20900], 14150),
});
export const DELIVERY_EXPANSION_TEXT = [invitation, umbrella, starlight].flatMap(chapter => [chapter.title, ...chapter.introduction,
  chapter.itinerary, chapter.difficultyLabel!, ...chapter.phases.map(phase => phase.label), chapter.postcardTitle,
  chapter.deliveredLabel, chapter.successText, chapter.postcardText, chapter.failureTitle, chapter.failureText, chapter.startLabel]);

export const DELIVERY_CHAPTERS: readonly DeliveryChapter[] = Object.freeze([goodnight, dinner, invitation, umbrella, starlight, ...RESIDENT_ROUTES]);
export function isDeliveryChapterId(value: unknown): value is DeliveryChapterId { return typeof value === 'string' && DELIVERY_CHAPTERS.some(chapter => chapter.id === value); }
export function getDeliveryChapter(id: unknown): DeliveryChapter | undefined { return DELIVERY_CHAPTERS.find(chapter => chapter.id === id); }
export function defaultDeliveryChapter(): DeliveryChapter { return goodnight; }
/** A unions this with its existing font input. */
export const DELIVERY_V2_TEXT = [dinner.title, ...dinner.introduction, dinner.itinerary, ...dinner.phases.map(phase => phase.label),
  dinner.postcardTitle, dinner.deliveredLabel, dinner.successText, dinner.postcardText, dinner.failureTitle, dinner.failureText, dinner.startLabel,
  '选一段送信路线', '约一分钟的小旅行', '已收好', '未送达', '选择章节', '返回章节', '返回邮箱', '重新送一次', '查看明信片',
  '准备好了，就重新出发。', '本次已收好，暂未保存到设备'] as const;
