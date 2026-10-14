/** Stable content IDs only: no route or persistence imports, so routes may use this catalogue. */
export const RESIDENT_NEW_CHAPTER_IDS = [
  'windmill-thanks-v1', 'windmill-photo-v1', 'riverside-thanks-v1',
  'riverside-sunshine-v1', 'lighthouse-old-letter-v1', 'lighthouse-gathering-v1',
] as const;
export type ResidentChapterId = typeof RESIDENT_NEW_CHAPTER_IDS[number];
export const RESIDENT_IDS = ['windmill-keeper-v1', 'riverside-neighbor-v1', 'lighthouse-keeper-v1'] as const;
export type ResidentId = typeof RESIDENT_IDS[number];
export type ResidentFirstChapterId = 'windmill-invitation-v1' | 'rainy-umbrella-v1' | 'lighthouse-starlight-v1';
export interface ResidentStage {
  readonly id: string;
  readonly index: 1 | 2 | 3;
  readonly chapterId: ResidentFirstChapterId | ResidentChapterId;
  readonly title: string;
  readonly letterId: string;
}
export interface ResidentDefinition {
  readonly id: ResidentId;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly appearance: string;
  readonly portraitKey: string;
  readonly keepsakeKey: string;
  readonly stages: readonly ResidentStage[];
}
const stages = (slug: string, chapters: readonly (readonly [ResidentStage['chapterId'], string])[]): readonly ResidentStage[] =>
  Object.freeze(chapters.map(([chapterId, title], index) => Object.freeze({
    id: `resident-${slug}-stage-${index + 1}-v1`, index: index + 1 as 1 | 2 | 3, chapterId, title,
    letterId: `resident-${slug}-letter-${index + 1}-v1`,
  })));
export const RESIDENTS: readonly ResidentDefinition[] = Object.freeze([
  Object.freeze({
    id: 'windmill-keeper-v1', name: '阿禾', role: '风车管理员',
    description: '喜欢准备食物，也愿意照顾新来的居民。', appearance: '草帽、绿色围巾，温暖朴实。',
    portraitKey: 'resident-v1-ahe-portrait', keepsakeKey: 'resident-v1-ahe-keepsake',
    stages: stages('windmill', [
      ['windmill-invitation-v1', '给风车送邀请函'], ['windmill-thanks-v1', '把感谢送到花圃'], ['windmill-photo-v1', '风车下的合照'],
    ]),
  }),
  Object.freeze({
    id: 'riverside-neighbor-v1', name: '小沐', role: '河边小屋的居民',
    description: '细心，喜欢听雨和照料窗边植物。', appearance: '浅蓝围巾、小雨帽。',
    portraitKey: 'resident-v1-xiaomu-portrait', keepsakeKey: 'resident-v1-xiaomu-keepsake',
    stages: stages('riverside', [
      ['rainy-umbrella-v1', '雨天的借伞信'], ['riverside-thanks-v1', '把谢谢送过小桥'], ['riverside-sunshine-v1', '雨后的晴天邀请'],
    ]),
  }),
  Object.freeze({
    id: 'lighthouse-keeper-v1', name: '阿灯', role: '灯塔守夜人',
    description: '安静认真，喜欢收好每一封来信。', appearance: '深蓝小帽、暖黄色围巾，手边有小提灯。',
    portraitKey: 'resident-v1-adeng-portrait', keepsakeKey: 'resident-v1-adeng-keepsake',
    stages: stages('lighthouse', [
      ['lighthouse-starlight-v1', '送到灯塔的星光信'], ['lighthouse-old-letter-v1', '灯塔里的旧信'], ['lighthouse-gathering-v1', '灯亮的时候'],
    ]),
  }),
]);
export const RESIDENT_GROUP_PHOTO_KEY = 'resident-v1-group-photo';
export function getResident(id: unknown): ResidentDefinition | undefined { return RESIDENTS.find(resident => resident.id === id); }
export function isResidentChapterId(id: unknown): id is ResidentChapterId {
  return typeof id === 'string' && (RESIDENT_NEW_CHAPTER_IDS as readonly string[]).includes(id);
}
export function residentStageForChapter(id: unknown): { resident: ResidentDefinition; stage: ResidentStage } | undefined {
  for (const resident of RESIDENTS) {
    const stage = resident.stages.find(candidate => candidate.chapterId === id);
    if (stage) return { resident, stage };
  }
  return undefined;
}
export const RESIDENT_CATALOG_TEXT = RESIDENTS.flatMap(resident => [resident.name, resident.role, resident.description,
  ...resident.stages.map(stage => stage.title), `收到${resident.name}的回信`]);
