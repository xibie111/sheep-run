import { ENVIRONMENT } from "../game/Constants";
import type { DayPhase, ThemeDefinition, ThemeId } from "./types";
import { seasonAtScore } from "./SeasonProgress";

const DAY_PHASES: readonly DayPhase[] = ["morning", "afternoon", "sunset", "night"];
const DAY_TINTS = [
  { sky: 0xffffff, land: 0xffffff },
  { sky: 0xf5f2c8, land: 0xf4f6d1 },
  { sky: 0xffbe84, land: 0xffd09b },
  { sky: 0x8290ae, land: 0x9ba1b4 },
] as const;

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "spring", label: "Spring", skySet: "pasture-sky", cloudSet: "pasture-cloud",
    farMountainSet: "pasture-far-mountain", midgroundSet: "pasture-treeline",
    decorationSet: "spring", groundDecorationSet: "spring-ground", palette: { sky: 0xffffff, land: 0xffffff },
    allowedWeather: ["sunny", "rain", "wind"],
  },
  {
    id: "summer", label: "Summer", skySet: "pasture-sky", cloudSet: "pasture-cloud",
    farMountainSet: "pasture-far-mountain", midgroundSet: "pasture-treeline",
    decorationSet: "summer", groundDecorationSet: "summer-ground", palette: { sky: 0xfffce5, land: 0xeaf4b9 },
    allowedWeather: ["sunny", "rain", "wind"],
  },
  {
    id: "autumn", label: "Autumn", skySet: "pasture-sky", cloudSet: "pasture-cloud",
    farMountainSet: "pasture-far-mountain", midgroundSet: "pasture-treeline",
    decorationSet: "autumn", groundDecorationSet: "autumn-ground", palette: { sky: 0xfff0dc, land: 0xf0c18a },
    allowedWeather: ["sunny", "rain", "wind"],
  },
  {
    id: "winter", label: "Winter", skySet: "pasture-sky", cloudSet: "pasture-cloud",
    farMountainSet: "pasture-far-mountain", midgroundSet: "pasture-treeline",
    decorationSet: "winter", groundDecorationSet: "winter-ground", palette: { sky: 0xd8eaf3, land: 0xd7e6ed },
    allowedWeather: ["sunny", "wind"],
  },
];

export interface ThemeVisualState {
  theme: ThemeDefinition;
  dayPhase: DayPhase;
  skyTint: number;
  landTint: number;
}

function multiplyTint(left: number, right: number): number {
  const channel = (shift: number): number => Math.round(((left >>> shift) & 0xff) * ((right >>> shift) & 0xff) / 0xff);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function interpolateTint(from: number, to: number, amount: number): number {
  const channel = (shift: number): number => Math.round(((from >>> shift) & 0xff) + ((((to >>> shift) & 0xff) - ((from >>> shift) & 0xff)) * amount));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function normalizedDistance(distancePx: number): number {
  return Number.isFinite(distancePx) ? Math.max(0, distancePx) : 0;
}

export class ThemeSystem {
  private override: ThemeId | null = null;
  private progressScore: number | null = null;

  setScore(score: number | null): void {
    this.progressScore = score;
  }

  atScore(score: number): ThemeDefinition {
    const id = this.override ?? seasonAtScore(score);
    return THEMES.find(theme => theme.id === id)!;
  }

  setTheme(themeId: ThemeId | null): void {
    this.override = themeId;
  }

  atDistance(distancePx: number): ThemeDefinition {
    if (this.override) return THEMES.find((theme) => theme.id === this.override)!;
    if (this.progressScore !== null) return this.atScore(this.progressScore);
    const distance = normalizedDistance(distancePx);
    const index = Math.floor(distance / ENVIRONMENT.seasonLengthPx) % THEMES.length;
    return THEMES[index]!;
  }

  visualAtDistance(distancePx: number, reducedMotion = false, preserveArtPalette = false): ThemeVisualState {
    const distance = reducedMotion ? 0 : normalizedDistance(distancePx);
    const seasonProgress = distance % ENVIRONMENT.seasonLengthPx;
    const seasonIndex = this.progressScore === null ? Math.floor(distance / ENVIRONMENT.seasonLengthPx) % THEMES.length
      : THEMES.findIndex(theme => theme.id === seasonAtScore(this.progressScore!));
    const phaseIndex = Math.floor(seasonProgress / ENVIRONMENT.dayPhaseDistancePx);
    const phaseProgress = seasonProgress - phaseIndex * ENVIRONMENT.dayPhaseDistancePx;
    const transitionStart = ENVIRONMENT.dayPhaseDistancePx - ENVIRONMENT.tintTransitionDistancePx;
    const transition = Math.max(0, Math.min(1, (phaseProgress - transitionStart) / ENVIRONMENT.tintTransitionDistancePx));
    const nextPhaseIndex = (phaseIndex + 1) % DAY_PHASES.length;
    const nextThemeIndex = this.progressScore === null && phaseIndex === DAY_PHASES.length - 1 ? (seasonIndex + 1) % THEMES.length : seasonIndex;
    const scheduledTheme = THEMES[seasonIndex]!;
    const currentTheme = this.override ? this.atDistance(distance) : scheduledTheme;
    const nextTheme = this.override ? currentTheme : THEMES[nextThemeIndex]!;
    const currentDay = DAY_TINTS[phaseIndex]!;
    const nextDay = DAY_TINTS[nextPhaseIndex]!;
    // Authored seasonal scenery already carries its season colors; keep only the day cycle.
    const currentSky = multiplyTint(currentDay.sky, preserveArtPalette ? 0xffffff : currentTheme.palette.sky);
    const nextSky = multiplyTint(nextDay.sky, preserveArtPalette ? 0xffffff : nextTheme.palette.sky);
    const currentLand = multiplyTint(currentDay.land, preserveArtPalette ? 0xffffff : currentTheme.palette.land);
    const nextLand = multiplyTint(nextDay.land, preserveArtPalette ? 0xffffff : nextTheme.palette.land);

    return {
      theme: this.override ? this.atDistance(distance) : currentTheme,
      dayPhase: DAY_PHASES[phaseIndex]!,
      skyTint: interpolateTint(currentSky, nextSky, transition),
      landTint: interpolateTint(currentLand, nextLand, transition),
    };
  }
}

export function getThemeAtDistance(distancePx: number): ThemeDefinition {
  return new ThemeSystem().atDistance(distancePx);
}
