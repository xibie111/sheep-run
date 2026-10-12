import type { TripCardInput, TripNamedEvent } from '../content-v2/TripCardModel';
import { SKIN_NAMES } from '../data/skinSpriteAssets';
import { isSkinId, type SkinId } from '../data/sheepSkins';
import { COLLECTION_BADGES } from '../data/pastureCollections';
import { SEASON_ORDER } from '../environment/SeasonProgress';
import { LANDMARKS } from '../scenery/landmarkCatalog';
import { RUN_GOALS } from './RunGoal';
import type { RunTravelSnapshot } from './RunTravel';

const skinNames = new Map(Object.entries(SKIN_NAMES));
const collectionNames = new Map<string, string>(COLLECTION_BADGES.map(item => [item.id, item.name]));
const landmarkNames = new Map<string, string>(LANDMARKS.map(item => [item.id, item.title]));
const animalNames = new Map<string, string>([
  ['duck-family', '一家小鸭'], ['rabbit-butterfly', '追蝴蝶的小兔'],
]);

function named(ids: readonly string[], names: ReadonlyMap<string, string>): readonly TripNamedEvent[] {
  const seen = new Set<string>(), events: TripNamedEvent[] = [];
  for (const id of ids) {
    const name = names.get(id);
    if (!name || seen.has(id)) continue;
    seen.add(id); events.push(Object.freeze({ id, name }));
  }
  return Object.freeze(events);
}

/** Translate only this run's observed IDs. Catalogs supply labels, never additional experiences. */
export function toTripCardInput(snapshot: RunTravelSnapshot, leadSkin?: SkinId): TripCardInput {
  const protagonist = leadSkin !== undefined && isSkinId(leadSkin)
    ? Object.freeze({ id: leadSkin, name: SKIN_NAMES[leadSkin] }) : undefined;
  const goal = snapshot.goal;
  const goals = goal && RUN_GOALS.some(item => item.id === goal.id) && typeof goal.label === 'string'
    && goal.label.trim() && typeof goal.complete === 'boolean'
    ? [Object.freeze({ id: goal.id, title: goal.label, completed: goal.complete })] : [];
  return Object.freeze({
    ...(protagonist ? { protagonist } : {}),
    seasons: Object.freeze([...new Set(snapshot.seasons.filter(id => SEASON_ORDER.includes(id)))]),
    ...(Number.isSafeInteger(snapshot.stars) && snapshot.stars >= 0 ? { starsCollected: snapshot.stars } : {}),
    companionSkins: named(snapshot.companionSkins.filter(isSkinId), skinNames),
    animals: named(snapshot.animals, animalNames),
    landmarks: named(snapshot.landmarks, landmarkNames),
    newCollections: named(snapshot.newCollections, collectionNames),
    goals: Object.freeze(goals),
    ...(typeof snapshot.newRecord === 'boolean' ? { newRecord: snapshot.newRecord } : {}),
  });
}
