import type { SkinId } from "../data/sheepSkins";
import type { SheepState } from "../game/GameState";

const ANIMATION_BY_STATE: Readonly<Record<SheepState, string>> = {
  IDLE: "sheep-idle",
  RUNNING: "sheep-run",
  JUMPING: "sheep-jump",
  FALLING: "sheep-fall",
  HIT: "sheep-hit",
  DASH: "sheep-dash",
  DEAD: "sheep-dead",
};

export function sheepAnimationForState(state: SheepState, skinId: SkinId = "white"): string {
  const animation = ANIMATION_BY_STATE[state];
  return skinId === "white" ? animation : animation.replace("sheep-", `sheep-${skinId}-`);
}
