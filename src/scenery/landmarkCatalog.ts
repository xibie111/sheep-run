import type { ThemeId } from '../environment/types';

/** Single, authored background silhouettes; dimensions keep the generated aspect. */
export const LANDMARKS = [
  // The illustrated farm belongs to the near meadow (-17). Keep its landmark
  // on the same moving plane and behind the foreground road (-13).
  { id: 'windmill-meadow', title: '风车草地', key: 'content-v2-landmark-windmill', threshold: 2400, layer: 'near', depth: -16.5, width: 62, height: 75.5, bottom: 187 },
  { id: 'old-barn', title: '旧谷仓', key: 'content-v2-landmark-barn', threshold: 6500, layer: 'near', depth: -9.8, width: 90, height: 45, bottom: 193 },
  { id: 'riverside-bridge', title: '河边小桥', key: 'content-v2-landmark-bridge', threshold: 10800, layer: 'near', depth: -9.8, width: 110, height: 30, bottom: 198 },
] as const;
export type LandmarkId = typeof LANDMARKS[number]['id'];
export type LandmarkDefinition = typeof LANDMARKS[number];
export interface LandmarkEncounter { id: LandmarkId; title: string; distance: number; theme: ThemeId; }
export const LANDMARK_COPY = LANDMARKS.map(item => item.title).join('');
export const LANDMARK_RULES = { minimumGapDistance: 1200, exposureMs: 400, staticVisitMs: 8000, fadeMs: 350, farRatio: .15 } as const;
export function landmarkDefinition(id: LandmarkId): LandmarkDefinition { return LANDMARKS.find(item => item.id === id)!; }
