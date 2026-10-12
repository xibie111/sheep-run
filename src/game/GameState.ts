export type SheepState = "IDLE" | "RUNNING" | "JUMPING" | "FALLING" | "HIT" | "DASH" | "DEAD";

export interface RunResult {
  score: number;
  best: number;
  newRecord: boolean;
  saveFailed?: true;
}

export interface ResultSceneData extends RunResult {
  coinsEarned: number;
  coinBalance: number;
  achievements?: import("../data/journeyBook").AchievementId[];
  travel?: import('../runner-v2/RunTravel').RunTravelSnapshot;
  leadSkin?: import('../data/sheepSkins').SkinId;
}
