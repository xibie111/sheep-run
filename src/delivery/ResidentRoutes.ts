import type { DeliveryChapter, DeliveryLandscape, DeliveryObstacleRequest, DeliveryPhaseDefinition } from './DeliveryChapters';
import type { DeliveryChallengeDefinition } from './DeliveryChallengeRun';
import type { ResidentChapterId } from '../residents/ResidentCatalog';
import { RESIDENT_ROUTE_ART } from '../residents/residentAssets';
import { WoodFence, Pumpkin, Rock, WideLog, MushroomCluster, HangingBranch, Bramble, TallStack,
  WoodBarrel, MilkChurn, FruitBasket, type ObstacleDefinition } from '../game/ObstacleDefinitions';

export type ResidentNpc = 'ahe' | 'xiaomu' | 'adeng' | 'flowerNeighbor' | 'bridgeNeighbor' | 'harborNeighbor';
export interface ResidentEndingDefinition {
  readonly recipient: ResidentNpc;
  readonly guests: readonly ResidentNpc[];
  readonly moment: 'flowers' | 'photo' | 'doorstep-flowers' | 'tea-rainbow' | 'harbor-lights' | 'gathering';
}
type RouteSlug = keyof typeof RESIDENT_ROUTE_ART;
interface RoutePlan {
  readonly id: ResidentChapterId; readonly slug: RouteSlug; readonly title: string;
  readonly introduction: readonly string[]; readonly itinerary: string; readonly length: number; readonly seed: number;
  readonly phases: readonly DeliveryPhaseDefinition[];
  readonly obstacles: readonly (readonly [number, ObstacleDefinition])[];
  readonly ordinary: readonly number[]; readonly hidden: number; readonly keepsakeTitle: string;
  readonly postcardTitle: string; readonly postcardText: string; readonly deliveredLabel: string;
  readonly ending: ResidentEndingDefinition;
}

// Every plan has its own authored rhythm and seed. No endless RNG or timing is used.
// Lengths use the unchanged 190→390 speed curve, including the current speed upgrades.
const plans: readonly RoutePlan[] = [
  {
    id: 'windmill-thanks-v1', slug: 'windmill-thanks', title: '把感谢送到花圃',
    introduction: ['阿禾写好了感谢信。', '带着小花印章的信封，', '去花圃谢谢借篮子的邻居。'],
    itinerary: '风车草地 · 麦田小路 · 花圃小屋', length: 22400, seed: 0x77667432,
    phases: [{ id: 'windmill-meadow', start: 0, label: '风车草地', weather: 'clear' },
      { id: 'wheat-path', start: 6600, label: '麦田小路', weather: 'clear' },
      { id: 'flower-cottage', start: 14500, label: '花圃小屋', weather: 'clear' },
      { id: 'arrival', start: 20900, label: '把感谢送到门前', weather: 'clear' }],
    obstacles: [[900, Rock], [2450, FruitBasket], [4000, WoodFence], [5550, Pumpkin], [7100, WideLog],
      [8650, HangingBranch], [10200, MushroomCluster], [11750, MilkChurn], [13300, WoodFence],
      [14850, HangingBranch], [16400, FruitBasket], [17950, Rock]],
    ordinary: [1675, 6325, 10975, 15625, 19900], hidden: 9425, keepsakeTitle: '花圃小花',
    postcardTitle: '花圃收到的谢谢', postcardText: '花束送到了野餐桌旁，花瓶里装着邻居的心意。',
    deliveredLabel: '感谢信已送达', ending: { recipient: 'flowerNeighbor', guests: [], moment: 'flowers' },
  },
  {
    id: 'windmill-photo-v1', slug: 'windmill-photo', title: '风车下的合照',
    introduction: ['大家都准备好野餐了。', '把最后一封集合邀请，', '送到风车下的阿禾手里。'],
    itinerary: '花圃小路 · 田间路口 · 风车野餐地', length: 23200, seed: 0x77667033,
    phases: [{ id: 'flower-path', start: 0, label: '花圃小路', weather: 'clear' },
      { id: 'field-crossroads', start: 7200, label: '田间路口', weather: 'clear' },
      { id: 'windmill-picnic', start: 15100, label: '风车野餐地', weather: 'clear' },
      { id: 'arrival', start: 21700, label: '合照给你留了位置', weather: 'clear' }],
    obstacles: [[1000, Pumpkin], [2550, WoodBarrel], [4150, HangingBranch], [5700, MushroomCluster],
      [7250, WoodFence], [8850, WideLog], [10400, FruitBasket], [12000, HangingBranch],
      [13600, TallStack], [15200, Rock], [16800, Bramble], [18400, Pumpkin]],
    ordinary: [1775, 6475, 11200, 16000, 20800], hidden: 9650, keepsakeTitle: '风车合照',
    postcardTitle: '风车下的一天', postcardText: '阿禾、花圃邻居和你，在野餐垫旁留下了一张合照。',
    deliveredLabel: '集合邀请已送达', ending: { recipient: 'ahe', guests: ['flowerNeighbor'], moment: 'photo' },
  },
  {
    id: 'riverside-thanks-v1', slug: 'riverside-thanks', title: '把谢谢送过小桥',
    introduction: ['借来的伞挡住了小雨。', '带上小沐写好的感谢信，', '送给小桥另一边的邻居。'],
    itinerary: '河边小屋 · 雨后草地 · 小桥旁的邻居家', length: 23600, seed: 0x72767432,
    phases: [{ id: 'river-cottage', start: 0, label: '河边小屋', weather: 'rain' },
      { id: 'after-rain-meadow', start: 7000, label: '雨渐渐停了', weather: 'clear' },
      { id: 'bridge-neighbor', start: 15500, label: '小桥旁的邻居家', weather: 'clear' },
      { id: 'arrival', start: 22000, label: '门口的小花', weather: 'clear' }],
    obstacles: [[850, Rock], [2400, HangingBranch], [3950, WoodFence], [5550, Bramble],
      [7150, HangingBranch], [8750, WideLog], [10350, MushroomCluster], [11950, HangingBranch],
      [13550, FruitBasket], [15150, MilkChurn], [16750, HangingBranch], [18350, Rock]],
    ordinary: [1625, 6350, 11150, 15950, 21200], hidden: 14350, keepsakeTitle: '桥边小花',
    postcardTitle: '小桥那边的回音', postcardText: '雨停了，门口的小花替小沐向邻居说了一声谢谢。',
    deliveredLabel: '桥边感谢信已送达', ending: { recipient: 'bridgeNeighbor', guests: [], moment: 'doorstep-flowers' },
  },
  {
    id: 'riverside-sunshine-v1', slug: 'riverside-sunshine', title: '雨后的晴天邀请',
    introduction: ['河面又亮起来了。', '把晴天邀请送到小屋，', '和小沐一起等彩虹来做客。'],
    itinerary: '桥边草地 · 晴日河岸 · 河边小屋', length: 24400, seed: 0x72767333,
    phases: [{ id: 'bridge-meadow', start: 0, label: '桥边草地', weather: 'clear' },
      { id: 'sunny-riverside', start: 7400, label: '晴日河岸', weather: 'clear' },
      { id: 'river-cottage', start: 16200, label: '河边小屋', weather: 'clear' },
      { id: 'arrival', start: 22800, label: '茶杯已经摆好了', weather: 'clear' }],
    obstacles: [[1050, FruitBasket], [2700, Rock], [4300, WideLog], [5900, HangingBranch],
      [7500, MushroomCluster], [9100, WoodBarrel], [10700, WoodFence], [12300, Pumpkin],
      [13900, HangingBranch], [15500, TallStack], [17100, WideLog], [18700, Rock]],
    ordinary: [1875, 6700, 11500, 16300, 22000], hidden: 9900, keepsakeTitle: '雨后彩虹',
    postcardTitle: '雨后的河边茶会', postcardText: '茶杯摆在屋外的小桌上，彩虹也来参加小沐的茶会。',
    deliveredLabel: '晴天邀请已送达', ending: { recipient: 'xiaomu', guests: ['bridgeNeighbor'], moment: 'tea-rainbow' },
  },
  {
    id: 'lighthouse-old-letter-v1', slug: 'lighthouse-old-letter', title: '灯塔里的旧信',
    introduction: ['阿灯写好了迟到的回信。', '收好带灯塔印章的信封，', '沿海边小路送到港口小屋。'],
    itinerary: '灯塔山坡 · 海边小路 · 港口小屋', length: 25200, seed: 0x6c686f32,
    phases: [{ id: 'lighthouse-hill', start: 0, label: '灯塔山坡', weather: 'starlight' },
      { id: 'seaside-path', start: 7700, label: '海边小路', weather: 'starlight' },
      { id: 'harbor-cottage', start: 16900, label: '港口小屋', weather: 'starlight' },
      { id: 'arrival', start: 23600, label: '窗边等着这封信', weather: 'starlight' }],
    obstacles: [[950, WoodFence], [2550, HangingBranch], [4150, WoodBarrel], [5750, WideLog],
      [7350, TallStack], [8950, Rock], [10550, HangingBranch], [12150, MilkChurn],
      [13750, Bramble], [15350, HangingBranch], [16950, FruitBasket], [18550, TallStack], [20150, Rock]],
    ordinary: [1750, 6550, 11350, 16150, 22800], hidden: 14550, keepsakeTitle: '港口小灯',
    postcardTitle: '迟到的回信', postcardText: '港口的朋友打开旧信，窗边的小灯终于为回信亮起来。',
    deliveredLabel: '迟到的回信已送达', ending: { recipient: 'harborNeighbor', guests: [], moment: 'harbor-lights' },
  },
  {
    id: 'lighthouse-gathering-v1', slug: 'lighthouse-gathering', title: '灯亮的时候',
    introduction: ['今晚一起去看看海吧。', '带上夜景邀请，', '送到灯塔平台的阿灯手里。'],
    itinerary: '港口暮色 · 星光海岸 · 灯塔平台', length: 26000, seed: 0x6c686733,
    phases: [{ id: 'harbor-dusk', start: 0, label: '港口暮色', weather: 'clear' },
      { id: 'starlight-coast', start: 8200, label: '星光海岸', weather: 'starlight' },
      { id: 'lighthouse-platform', start: 17800, label: '灯塔平台', weather: 'starlight' },
      { id: 'arrival', start: 24400, label: '一起等灯亮起来', weather: 'starlight' }],
    obstacles: [[1100, Pumpkin], [2750, HangingBranch], [4400, TallStack], [6050, WoodFence],
      [7700, WideLog], [9350, HangingBranch], [11000, MushroomCluster], [12650, Bramble],
      [14300, HangingBranch], [15950, WoodBarrel], [17600, TallStack], [19250, HangingBranch], [20900, Rock]],
    ordinary: [1925, 6875, 11825, 16775, 23500], hidden: 15125, keepsakeTitle: '灯塔聚会',
    postcardTitle: '灯亮的时候', postcardText: '灯塔和港口的小灯同时亮起，每一束光都有人看见。',
    deliveredLabel: '夜景邀请已送达', ending: { recipient: 'adeng', guests: ['harborNeighbor', 'ahe', 'xiaomu'], moment: 'gathering' },
  },
];

function chapter(plan: RoutePlan): DeliveryChapter {
  const art = RESIDENT_ROUTE_ART[plan.slug];
  const obstacles: readonly DeliveryObstacleRequest[] = Object.freeze(plan.obstacles.map(([at, definition], index) => Object.freeze({
    at, definition, phase: (((plan.seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0) / 0x100000000) * Math.PI * 2,
  })));
  const landscapes: readonly DeliveryLandscape[] = Object.freeze([
    { key: art.start, transitionStart: 0, transitionEnd: 0 },
    { key: art.middle, transitionStart: plan.phases[1].start - 500, transitionEnd: plan.phases[1].start + 500 },
    { key: art.destination, transitionStart: plan.phases[2].start - 500, transitionEnd: plan.phases[2].start + 500, focus: 'right' },
  ]);
  const challenge: DeliveryChallengeDefinition = Object.freeze({ keepsakeKey: art.keepsake, keepsakeTitle: plan.keepsakeTitle,
    stamps: Object.freeze([...plan.ordinary.map((at, index) => Object.freeze({ id: `${plan.id}-ordinary-${index + 1}`,
      at, y: 182, kind: 'ordinary' as const, key: art.ordinary })),
    Object.freeze({ id: `${plan.id}-keepsake`, at: plan.hidden, y: 88, kind: 'keepsake' as const, key: art.keepsake })]),
  });
  return Object.freeze({
    id: plan.id, title: plan.title, introduction: Object.freeze([...plan.introduction]), itinerary: plan.itinerary,
    length: plan.length, seed: plan.seed, phases: Object.freeze(plan.phases.map(phase => Object.freeze(phase))), obstacles, landscapes,
    previewKey: art.destination, postcardKey: art.postcard, endingKey: art.ending, accessoryKey: art.carried,
    companionAt: plan.length, destinationAt: plan.length - 800, endingDurationMs: 5400, endingKind: 'resident',
    residentEnding: Object.freeze({ ...plan.ending, guests: Object.freeze([...plan.ending.guests]) }),
    postcardTitle: plan.postcardTitle, deliveredLabel: plan.deliveredLabel,
    successText: `${plan.deliveredLabel}，明信片已收好。`, postcardText: plan.postcardText,
    challenge, difficultyLabel: '居民委托', weather: plan.phases[0].weather, roadCropRatio: .72,
    failureTitle: '这份心意，再送一次吧', failureText: '信还好好地放在身边。', startLabel: '带上信出发',
  });
}

export const RESIDENT_ROUTES: readonly DeliveryChapter[] = Object.freeze(plans.map(chapter));
export const RESIDENT_ROUTE_TEXT = RESIDENT_ROUTES.flatMap(route => [route.title, ...route.introduction, route.itinerary,
  ...route.phases.map(phase => phase.label), route.postcardTitle, route.deliveredLabel, route.successText, route.postcardText,
  route.failureTitle, route.failureText, route.startLabel, route.difficultyLabel!, route.challenge!.keepsakeTitle!]);
