export type ThemeId = "spring" | "summer" | "autumn" | "winter";
export type WeatherId = "sunny" | "rain" | "wind";
export type DayPhase = "morning" | "afternoon" | "sunset" | "night";
export type DecorationId = "tree" | "flower" | "fence" | "barn" | "hayBale" | "barrel" | "rock";
export type DecorationLayer = "midground" | "ground" | "foreground";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  skySet: string;
  cloudSet: string;
  farMountainSet: string;
  midgroundSet: string;
  decorationSet: string;
  groundDecorationSet: string;
  palette: { sky: number; land: number };
  allowedWeather: readonly WeatherId[];
}

export interface DecorationInstance {
  id: DecorationId;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
}

export interface EnvironmentChunk {
  index: number;
  x: number;
  width: number;
  themeId: ThemeId;
  decorations: DecorationInstance[];
}
