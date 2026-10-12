import type { ThemeId } from '../environment/types';

/** Single, authored background silhouettes; dimensions keep the generated aspect. */
export const LANDMARKS = [
  { id: 'windmill-meadow', title: '风车草地', key: 'content-v2-landmark-windmill', threshold: 2400, layer: 'far', width: 62, height: 75.5, bottom: 187 },
  { id: 'old-barn', title: '旧谷仓', key: 'content-v2-landmark-barn', threshold: 6500, layer: 'near', width: 90, height: 45, bottom: 193 },
  { id: 'riverside-bridge', title: '河边小桥', key: 'content-v2-landmark-bridge', threshold: 10800, layer: 'near', width: 110, height: 30, bottom: 198 },
] as const;
export type LandmarkId = typeof LANDMARKS[number]['id'];
export type LandmarkDefinition = typeof LANDMARKS[number];
export interface LandmarkEncounter { id: LandmarkId; title: string; distance: number; theme: ThemeId; }
export const LANDMARK_COPY = LANDMARKS.map(item => item.title).join('');
export const LANDMARK_RULES = { minimumGapDistance: 1200, exposureMs: 400, staticVisitMs: 8000, fadeMs: 350, farRatio: .15 } as const;
export function landmarkDefinition(id: LandmarkId): LandmarkDefinition { return LANDMARKS.find(item => item.id === id)!; }
