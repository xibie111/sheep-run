import { PLAYER } from '../game/Constants';
import type { ThemeId, WeatherId, DayPhase } from '../environment/types';
export type AnimalEventId = 'duck-family' | 'squirrel-acorn' | 'rabbit-butterfly';
export interface LandscapeState {
  theme: ThemeId; weather: WeatherId; weatherAlpha: number; dayPhase: DayPhase; landTint: number;
  nearOffset: number; nearRepeatWidth: number; nearRatio: number;
}
export interface AnimalAnchor { kind: AnimalEventId; x: number; y: number; }
export const ANIMAL_DURATIONS: Readonly<Record<AnimalEventId, number>> = {
  'duck-family': 7_000, 'squirrel-acorn': 6_000, 'rabbit-butterfly': 6_000,
};
// Measured within the unchanged original 480px section of each near panorama.
// The scenery join only alters its first/last 48px; these anchors avoid both joins.
export const ANIMAL_ANCHORS: Readonly<Record<ThemeId, readonly AnimalAnchor[]>> = {
  spring: [{ kind: 'duck-family', x: 239, y: 203 }, { kind: 'rabbit-butterfly', x: 297, y: 205 }],
  summer: [{ kind: 'duck-family', x: 239, y: 203 }, { kind: 'rabbit-butterfly', x: 297, y: 205 }],
  autumn: [{ kind: 'duck-family', x: 239, y: 203 }, { kind: 'rabbit-butterfly', x: 297, y: 205 }],
  winter: [],
};

export interface AnimalOffer extends AnimalAnchor { tile: number; worldX: number; }
export function allowsAnimal(kind: AnimalEventId, landscape: LandscapeState): boolean {
  // Temporarily retired; keep its original art and choreography available.
  if (kind === 'squirrel-acorn') return false;
  if (landscape.dayPhase === 'night' || (landscape.weather === 'rain' && landscape.weatherAlpha > .15)) return false;
  return landscape.theme !== 'winter';
}
export function animalOffers(landscape: LandscapeState, visibleLeft: number, visibleRight: number, speed: number): AnimalOffer[] {
  const width = landscape.nearRepeatWidth;
  if (!Number.isFinite(width) || width < 480) return [];
  const offers: AnimalOffer[] = [];
  const first = Math.floor((visibleLeft + landscape.nearOffset) / width) - 1;
  const last = Math.ceil((visibleRight + landscape.nearOffset) / width);
  const minimum = Math.max(PLAYER.x + 80, visibleLeft + 45 + speed * landscape.nearRatio * 2.2);
  for (const anchor of ANIMAL_ANCHORS[landscape.theme]) {
    if (!allowsAnimal(anchor.kind, landscape)) continue;
    for (let tile = first; tile <= last; tile++) {
      const worldX = anchor.x + tile * width - landscape.nearOffset;
      const half = anchor.kind === 'duck-family' ? 42 : 30;
      if (worldX >= minimum && worldX + half < visibleRight - 8) offers.push({ ...anchor, tile, worldX });
    }
  }
  return offers;
}
export function animalAnchorX(offer: AnimalOffer, landscape: LandscapeState): number {
  return offer.x + offer.tile * landscape.nearRepeatWidth - landscape.nearOffset;
}
export function crowdedForAnimal(obstacles: readonly { active: boolean; x: number; rightEdge: number }[], speed: number): boolean {
  if (!Number.isFinite(speed) || speed <= 0) return true;
  const approaching = obstacles.filter(o => o.active && o.rightEdge >= PLAYER.x - 5);
  return approaching.some(o => o.x < PLAYER.x + PLAYER.width + speed * .8)
    || approaching.filter(o => o.x < PLAYER.x + speed * 2.1).length >= 2;
}
