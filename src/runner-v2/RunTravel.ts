import type { ThemeId } from '../environment/types';
import type { SkinId } from '../data/sheepSkins';
import type { RunEventId, RunGoalSnapshot } from './RunGoal';

export interface RunTravelSnapshot {
  readonly seasons: readonly ThemeId[];
  readonly stars: number;
  readonly companionSkins: readonly SkinId[];
  readonly animals: readonly string[];
  readonly landmarks: readonly string[];
  readonly newCollections: readonly string[];
  readonly goal: RunGoalSnapshot | null;
  readonly newRecord: boolean;
}

/** A run-local account of observed events. Never infers visits from catalogs or save data. */
export class RunTravel {
  private stopped = false;
  private readonly seasons = new Set<ThemeId>();
  private stars = 0;
  private readonly companionSkins = new Set<SkinId>();
  private readonly animals = new Set<string>();
  private readonly landmarks = new Set<string>();
  private readonly newCollections = new Set<string>();
  private runGoal: RunGoalSnapshot | null = null;
  private newRecord = false;
  private readonly starEvents = new Set<RunEventId>();
  private readonly summonEvents = new Set<RunEventId>();
  private readonly animalEvents = new Set<RunEventId>();
  private readonly landmarkEvents = new Set<RunEventId>();

  private observe(events: Set<RunEventId>, eventId?: RunEventId): boolean {
    if (this.stopped || (eventId !== undefined && events.has(eventId))) return false;
    if (eventId !== undefined) events.add(eventId);
    return true;
  }
  visitSeason(id: ThemeId): void { if (!this.stopped) this.seasons.add(id); }
  star(eventId?: RunEventId): void { if (this.observe(this.starEvents, eventId)) this.stars++; }
  summon(skin: SkinId, eventId?: RunEventId): void {
    if (this.observe(this.summonEvents, eventId)) this.companionSkins.add(skin);
  }
  visibleAnimal(id: string, eventId?: RunEventId): void {
    if (id && this.observe(this.animalEvents, eventId)) this.animals.add(id);
  }
  visibleLandmark(id: string, eventId?: RunEventId): void {
    if (id && this.observe(this.landmarkEvents, eventId)) this.landmarks.add(id);
  }
  /** Called only when a newly discovered badge is actually picked up. */
  collect(id: string): void { if (!this.stopped && id) this.newCollections.add(id); }
  goal(goal: RunGoalSnapshot): void { if (!this.stopped) this.runGoal = Object.freeze({ ...goal }); }
  record(): void { if (!this.stopped) this.newRecord = true; }
  snapshot(): RunTravelSnapshot {
    return Object.freeze({ seasons: Object.freeze([...this.seasons]), stars: this.stars,
      companionSkins: Object.freeze([...this.companionSkins]), animals: Object.freeze([...this.animals]),
      landmarks: Object.freeze([...this.landmarks]), newCollections: Object.freeze([...this.newCollections]),
      goal: this.runGoal ? Object.freeze({ ...this.runGoal }) : null, newRecord: this.newRecord });
  }
  finish(): RunTravelSnapshot { this.stopped = true; return this.snapshot(); }
  /** Reset is explicit so pooled scenes cannot carry one journey into the next. */
  reset(): void {
    this.stopped = false; this.stars = 0; this.newRecord = false; this.runGoal = null;
    this.seasons.clear(); this.companionSkins.clear(); this.animals.clear(); this.landmarks.clear(); this.newCollections.clear();
    this.starEvents.clear(); this.summonEvents.clear(); this.animalEvents.clear(); this.landmarkEvents.clear();
  }
  clear(): void { this.reset(); this.stopped = true; }
}
