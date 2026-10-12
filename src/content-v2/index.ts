import type Phaser from 'phaser';
import { CONTENT_V2_UI_ASSETS, prepareContentUiTextures, validateContentUiTextures } from './assetManifest';
import { LANDMARK_ASSETS, prepareLandmarkTextures, validateLandmarkTextures } from '../scenery/landmarkAssets';
import { DELIVERY_V2_ASSETS, prepareDeliveryV2Textures, validateDeliveryV2Textures } from '../delivery/DeliveryV2Assets';
import { TRIP_COPY } from './TripCardModel';
import { LANDMARK_COPY } from '../scenery/landmarkCatalog';
import { DELIVERY_V2_TEXT } from '../delivery/DeliveryChapters';

export { CONTENT_V2_KEYS, CONTENT_V2_UI_ASSETS, prepareContentUiTextures, validateContentUiTextures } from './assetManifest';
export { LandmarkController } from '../scenery/LandmarkController';
export type { LandmarkUpdateContext, LandmarkLandscapeState } from '../scenery/LandmarkController';
export { LANDMARKS, LANDMARK_RULES, LANDMARK_COPY } from '../scenery/landmarkCatalog';
export type { LandmarkId, LandmarkEncounter } from '../scenery/landmarkCatalog';
export { LANDMARK_ASSETS, prepareLandmarkTextures, validateLandmarkTextures } from '../scenery/landmarkAssets';
export { createTripCard } from './TripCard';
export type { TripCardOptions, TripCardView } from './TripCard';
export { tripCardModel, TRIP_COPY, wrapTripText } from './TripCardModel';
export type { TripCardInput, TripNamedEvent, TripGoalRecord } from './TripCardModel';
export { tripCardLayout, fitTripArt } from './TripCardLayout';
export { DELIVERY_CHAPTERS, defaultDeliveryChapter, getDeliveryChapter, isDeliveryChapterId, DELIVERY_V2_TEXT } from '../delivery/DeliveryChapters';
export type { DeliveryChapter, DeliveryChapterId, DeliveryPhaseDefinition } from '../delivery/DeliveryChapters';
export { DeliveryRoute, createDeliveryRoute, DELIVERY_ID, DELIVERY_TITLE, DELIVERY_LENGTH, DELIVERY_SEED } from '../delivery/DeliveryRoute';
export { createDeliveryPanel } from '../delivery/DeliveryPanel';
export { DeliveryView } from '../delivery/DeliveryView';
export { DeliveryStore, deliveryStore, DELIVERY_STORAGE_KEY } from '../delivery/DeliveryStore';
export { DELIVERY_V2_ASSETS, prepareDeliveryV2Textures, validateDeliveryV2Textures } from '../delivery/DeliveryV2Assets';

/** Only new runtime assets; old DELIVERY_ASSETS and shared font/skin loading stay intact. */
export const CONTENT_V2_ASSETS = [...CONTENT_V2_UI_ASSETS, ...LANDMARK_ASSETS, ...DELIVERY_V2_ASSETS] as const;
export const CONTENT_V2_COPY = [...TRIP_COPY, LANDMARK_COPY, ...DELIVERY_V2_TEXT] as const;

export function validateContentV2Textures(scene: Phaser.Scene): string[] {
  return [...validateContentUiTextures(scene), ...validateLandmarkTextures(scene), ...validateDeliveryV2Textures(scene)];
}
export function prepareContentV2Textures(scene: Phaser.Scene): void {
  prepareContentUiTextures(scene); prepareLandmarkTextures(scene); prepareDeliveryV2Textures(scene);
}
