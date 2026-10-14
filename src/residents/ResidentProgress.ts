import { getResident, RESIDENTS, residentStageForChapter, type ResidentDefinition, type ResidentStage } from './ResidentCatalog';
import { RESIDENT_LETTERS } from './ResidentLetters';
import type { DeliveryStore } from '../delivery/DeliveryStore';
import type { DeliveryChallengeStore } from '../delivery/DeliveryChallengeStore';

const ORIGINAL_CHAPTER_IDS = ['hill-goodnight-v1', 'dinner-for-you-v1', 'windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'] as const;
/** One entry guard shared by selection, run initialization and completion. Reading and stars never gate stories. */
export function canEnterDeliveryChapter(id: unknown, completedIds: readonly string[]): boolean {
  if (typeof id !== 'string') return false;
  if ((ORIGINAL_CHAPTER_IDS as readonly string[]).includes(id)) return true;
  const mapping = residentStageForChapter(id);
  if (!mapping) return false;
  const previous = mapping.resident.stages[mapping.stage.index - 2];
  return !!previous && completedIds.includes(previous.chapterId);
}
export const canEnterResidentChapter = canEnterDeliveryChapter;
export interface ResidentStageProgress {
  readonly stage: ResidentStage;
  readonly unlocked: boolean;
  readonly completed: boolean;
  readonly letterUnlocked: boolean;
  readonly unread: boolean;
}
export interface ResidentProgress {
  readonly resident: ResidentDefinition;
  readonly stages: readonly ResidentStageProgress[];
  readonly completedCount: number;
  readonly total: 3;
  readonly currentStage?: ResidentStage;
  readonly unreadCount: number;
  readonly completed: boolean;
  readonly keepsakeUnlocked: boolean;
}
/** Derive all story state from actual success IDs. There is no second narrative save to migrate. */
export function getResidentProgress(id: unknown, completedIds: readonly string[], readIds: readonly string[] = []): ResidentProgress | undefined {
  const resident = getResident(id);
  if (!resident) return undefined;
  const completedSet = new Set(completedIds), readSet = new Set(readIds);
  const stages = resident.stages.map(stage => {
    const completed = completedSet.has(stage.chapterId);
    return Object.freeze({ stage, unlocked: canEnterDeliveryChapter(stage.chapterId, completedIds), completed,
      letterUnlocked: completed, unread: completed && !readSet.has(stage.letterId) });
  });
  const completedCount = stages.filter(stage => stage.completed).length;
  return Object.freeze({ resident, stages: Object.freeze(stages), completedCount, total: 3,
    currentStage: stages.find(stage => stage.unlocked && !stage.completed)?.stage,
    unreadCount: stages.filter(stage => stage.unread).length, completed: completedCount === 3,
    keepsakeUnlocked: stages[2]!.completed });
}
export function getResidentStoriesProgress(completedIds: readonly string[], readIds: readonly string[] = []) {
  const residents = RESIDENTS.map(resident => getResidentProgress(resident.id, completedIds, readIds)!);
  return Object.freeze({ residents: Object.freeze(residents), groupPhotoUnlocked: residents.every(resident => resident.completed) });
}
export function getUnlockedResidentLetters(completedIds: readonly string[]) {
  const unlocked = new Set(RESIDENTS.flatMap(resident => resident.stages.filter(stage => completedIds.includes(stage.chapterId)).map(stage => stage.letterId)));
  return RESIDENT_LETTERS.filter(letter => unlocked.has(letter.id));
}
export function canOpenResidentLetter(id: unknown, completedIds: readonly string[]): boolean {
  return getUnlockedResidentLetters(completedIds).some(letter => letter.id === id);
}
/** For optional result hints; retries and replays cannot announce the same unlock twice. */
export function newlyUnlockedResidentLetters(before: readonly string[], after: readonly string[]) {
  const previous = new Set(getUnlockedResidentLetters(before).map(letter => letter.id));
  return getUnlockedResidentLetters(after).filter(letter => !previous.has(letter.id));
}

/** A validated challenge record can only be created by a successful run. Recover a missed
 * completion write from that evidence; never manufacture challenge ratings, read flags or dates. */
export function reconcileResidentProgress(deliveries: DeliveryStore, challenges: DeliveryChallengeStore) {
  let current = deliveries.retrySave();
  const archive = challenges.retrySave(), recoveredIds: string[] = [];
  const successfulIds = new Set(Object.keys(archive.chapters));
  // Catalogue order visits each prerequisite before its successor.
  for (const resident of RESIDENTS) for (const stage of resident.stages) {
    if (current.completedIds.includes(stage.chapterId) || !successfulIds.has(stage.chapterId) ||
      !canEnterDeliveryChapter(stage.chapterId, current.completedIds)) continue;
    const result = deliveries.complete(stage.chapterId);
    if (result.added) recoveredIds.push(stage.chapterId);
    current = deliveries.load();
  }
  return { ...current, saveFailed: current.saveFailed || archive.saveFailed, recoveredIds };
}
