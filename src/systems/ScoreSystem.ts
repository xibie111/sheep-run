import { RUN } from "../game/Constants";
import type { RunResult } from "../game/GameState";
import { SaveSystem } from "./SaveSystem";

export type StarMilestone = 10 | 20 | 30;

export interface StarAward {
  score: number;
  starCount: number;
  streak: number;
  milestone: StarMilestone | null;
}

const STAR_MILESTONES: readonly StarMilestone[] = [10, 20, 30];

export class ScoreSystem {
  private distance = 0;
  private bonus = 0;
  private bestAtRunStart = 0;
  private collectedStars = 0;
  private starStreak = 0;
  private saveFailuresAtStart = 0;

  constructor() {
    this.beginRun();
  }

  beginRun(): void {
    this.saveFailuresAtStart = SaveSystem.failureCount;
    this.distance = 0;
    this.bonus = 0;
    this.collectedStars = 0;
    this.starStreak = 0;
    this.bestAtRunStart = SaveSystem.load().highScore;
  }

  reset(): void {
    this.beginRun();
  }

  get bestAtStart(): number {
    return this.bestAtRunStart;
  }

  get travelledDistancePx(): number {
    return this.distance / RUN.distanceScale;
  }

  get starCount(): number {
    return this.collectedStars;
  }

  get streak(): number {
    return this.starStreak;
  }

  update(speed: number, deltaMs: number): number {
    this.distance += speed * (deltaMs / 1000) * RUN.distanceScale;
    return this.score;
  }

  awardPassedObstacle(): number {
    this.bonus += RUN.obstacleBonus;
    return this.score;
  }

  awardStar(multiplier: 1 | 2 = 1): StarAward {
    this.bonus += RUN.starBonus * multiplier;
    this.collectedStars += 1;
    this.starStreak += 1;
    SaveSystem.recordTotalStars();
    const milestone = STAR_MILESTONES.find((value) => value === this.collectedStars) ?? null;
    return {
      score: this.score,
      starCount: this.collectedStars,
      streak: this.starStreak,
      milestone,
    };
  }

  missStar(): void {
    this.starStreak = 0;
  }

  get score(): number {
    return Math.floor(this.distance + this.bonus);
  }

  finish(): RunResult {
    const newRecord = this.score > this.bestAtRunStart;
    const best = newRecord ? SaveSystem.recordHighScore(this.score) : this.bestAtRunStart;
    return {
      score: this.score, best, newRecord,
      ...(SaveSystem.failureCount > this.saveFailuresAtStart ? { saveFailed: true as const } : {}),
    };
  }
}
