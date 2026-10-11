import { WORLD } from "../game/Constants";
import type { SheepState } from "../game/GameState";
import { COMPANION_RULES as RULES, companionTrailingX } from "./CompanionRules";

export interface LeadPose { readonly x: number; readonly y: number; readonly displayWidth: number; readonly displayHeight: number; readonly motionState: SheepState; }
export interface CompanionPose { x: number; y: number; width: number; height: number; angle: number; state: SheepState; phase: "entering" | "following" | "leaving" | "gone"; }
const ease = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function companionPose(lead: LeadPose, elapsedMs: number, viewportLeft: number, reducedMotion: boolean): CompanionPose {
  const width = lead.displayWidth * RULES.scale, height = lead.displayHeight * RULES.scale;
  const trailing = companionTrailingX(lead.x, lead.displayWidth), outside = viewportLeft - width / 2 - 6;
  const phase = elapsedMs < RULES.entranceMs ? "entering" : elapsedMs < RULES.visitMs - RULES.farewellMs ? "following" : elapsedMs < RULES.visitMs ? "leaving" : "gone";
  const farewell = Math.max(0, Math.min(1, (elapsedMs - (RULES.visitMs - RULES.farewellMs)) / RULES.farewellMs));
  const x = phase === "entering" ? outside + (trailing - outside) * ease(elapsedMs / RULES.entranceMs)
    : phase === "following" ? trailing : trailing + (outside - trailing) * ease(farewell);
  const hop = phase === "leaving" && !reducedMotion ? Math.sin(farewell * Math.PI) * 7 : 0;
  return { x, y: Math.min(WORLD.groundY, lead.y) - hop, width, height,
    angle: phase === "leaving" && !reducedMotion ? Math.sin(farewell * Math.PI * 2) * 4 : 0,
    state: phase === "leaving" ? "RUNNING" : lead.motionState, phase };
}
