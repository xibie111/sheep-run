import type Phaser from 'phaser';
import { DELIVERY_EXPANSION_UI_KEYS } from '../delivery/DeliveryExpansionUiAssets';
import { MAIL_BUTTON_ART } from '../data/mailboxAssets';
import type { ResidentId } from './ResidentCatalog';

/** Generated resident assets remain independent from playable and companion skin catalogs. */
export const RESIDENT_ASSETS = [
  { key: 'resident-v1-windmill-middle', url: new URL('../../assets/resident-stories-v1/runtime/windmill-middle.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-riverside-middle', url: new URL('../../assets/resident-stories-v1/runtime/riverside-middle.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-lighthouse-middle', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-middle.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-ahe-npc', url: new URL('../../assets/resident-stories-v1/runtime/ahe-npc.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-ahe-portrait', url: new URL('../../assets/resident-stories-v1/runtime/ahe-portrait.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-ahe-envelope', url: new URL('../../assets/resident-stories-v1/runtime/ahe-envelope.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-ahe-ordinary', url: new URL('../../assets/resident-stories-v1/runtime/ahe-ordinary.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-ahe-keepsake', url: new URL('../../assets/resident-stories-v1/runtime/ahe-keepsake.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-xiaomu-npc', url: new URL('../../assets/resident-stories-v1/runtime/xiaomu-npc.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-xiaomu-portrait', url: new URL('../../assets/resident-stories-v1/runtime/xiaomu-portrait.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-xiaomu-envelope', url: new URL('../../assets/resident-stories-v1/runtime/xiaomu-envelope.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-xiaomu-ordinary', url: new URL('../../assets/resident-stories-v1/runtime/xiaomu-ordinary.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-xiaomu-keepsake', url: new URL('../../assets/resident-stories-v1/runtime/xiaomu-keepsake.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-adeng-npc', url: new URL('../../assets/resident-stories-v1/runtime/adeng-npc.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-adeng-portrait', url: new URL('../../assets/resident-stories-v1/runtime/adeng-portrait.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-adeng-envelope', url: new URL('../../assets/resident-stories-v1/runtime/adeng-envelope.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-adeng-ordinary', url: new URL('../../assets/resident-stories-v1/runtime/adeng-ordinary.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-adeng-keepsake', url: new URL('../../assets/resident-stories-v1/runtime/adeng-keepsake.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-flower-neighbor', url: new URL('../../assets/resident-stories-v1/runtime/flower-neighbor.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-bridge-neighbor', url: new URL('../../assets/resident-stories-v1/runtime/bridge-neighbor.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-harbor-neighbor', url: new URL('../../assets/resident-stories-v1/runtime/harbor-neighbor.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-group-photo', url: new URL('../../assets/resident-stories-v1/runtime/group-photo.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-windmill-thanks-destination', url: new URL('../../assets/resident-stories-v1/runtime/windmill-thanks-destination.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-windmill-thanks-ending', url: new URL('../../assets/resident-stories-v1/runtime/windmill-thanks-ending.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-windmill-thanks-postcard', url: new URL('../../assets/resident-stories-v1/runtime/windmill-thanks-postcard.png', import.meta.url).href, width: 640, height: 360 },
  { key: 'resident-v1-windmill-thanks-stamp', url: new URL('../../assets/resident-stories-v1/runtime/windmill-thanks-stamp.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-windmill-photo-destination', url: new URL('../../assets/resident-stories-v1/runtime/windmill-photo-destination.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-windmill-photo-ending', url: new URL('../../assets/resident-stories-v1/runtime/windmill-photo-ending.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-windmill-photo-postcard', url: new URL('../../assets/resident-stories-v1/runtime/windmill-photo-postcard.png', import.meta.url).href, width: 640, height: 360 },
  { key: 'resident-v1-windmill-photo-stamp', url: new URL('../../assets/resident-stories-v1/runtime/windmill-photo-stamp.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-riverside-thanks-destination', url: new URL('../../assets/resident-stories-v1/runtime/riverside-thanks-destination.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-riverside-thanks-ending', url: new URL('../../assets/resident-stories-v1/runtime/riverside-thanks-ending.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-riverside-thanks-postcard', url: new URL('../../assets/resident-stories-v1/runtime/riverside-thanks-postcard.png', import.meta.url).href, width: 640, height: 360 },
  { key: 'resident-v1-riverside-thanks-stamp', url: new URL('../../assets/resident-stories-v1/runtime/riverside-thanks-stamp.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-riverside-sunshine-destination', url: new URL('../../assets/resident-stories-v1/runtime/riverside-sunshine-destination.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-riverside-sunshine-ending', url: new URL('../../assets/resident-stories-v1/runtime/riverside-sunshine-ending.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-riverside-sunshine-postcard', url: new URL('../../assets/resident-stories-v1/runtime/riverside-sunshine-postcard.png', import.meta.url).href, width: 640, height: 360 },
  { key: 'resident-v1-riverside-sunshine-stamp', url: new URL('../../assets/resident-stories-v1/runtime/riverside-sunshine-stamp.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-lighthouse-old-letter-destination', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-old-letter-destination.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-lighthouse-old-letter-ending', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-old-letter-ending.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-lighthouse-old-letter-postcard', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-old-letter-postcard.png', import.meta.url).href, width: 640, height: 360 },
  { key: 'resident-v1-lighthouse-old-letter-stamp', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-old-letter-stamp.png', import.meta.url).href, width: 128, height: 128 },
  { key: 'resident-v1-lighthouse-gathering-destination', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-gathering-destination.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-lighthouse-gathering-ending', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-gathering-ending.png', import.meta.url).href, width: 960, height: 540 },
  { key: 'resident-v1-lighthouse-gathering-postcard', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-gathering-postcard.png', import.meta.url).href, width: 640, height: 360 },
  { key: 'resident-v1-lighthouse-gathering-stamp', url: new URL('../../assets/resident-stories-v1/runtime/lighthouse-gathering-stamp.png', import.meta.url).href, width: 128, height: 128 },
] as const;

export const RESIDENT_UI_KEYS = {
  paper: DELIVERY_EXPANSION_UI_KEYS.paper, card: DELIVERY_EXPANSION_UI_KEYS.frame,
  envelope: 'resident-v1-ahe-envelope', locked: DELIVERY_EXPANSION_UI_KEYS.lock,
  completed: DELIVERY_EXPANSION_UI_KEYS.complete, keepsake: DELIVERY_EXPANSION_UI_KEYS.slot, button: MAIL_BUTTON_ART.plain,
} as const;
export const RESIDENT_NPC_ART = { ahe: 'resident-v1-ahe-npc', xiaomu: 'resident-v1-xiaomu-npc', adeng: 'resident-v1-adeng-npc', flowerNeighbor: 'resident-v1-flower-neighbor', bridgeNeighbor: 'resident-v1-bridge-neighbor', harborNeighbor: 'resident-v1-harbor-neighbor' } as const;
const slugByResident: Record<ResidentId, string> = { 'windmill-keeper-v1': 'ahe', 'riverside-neighbor-v1': 'xiaomu', 'lighthouse-keeper-v1': 'adeng' };
export const residentPortraitKey = (id: ResidentId): string => `resident-v1-${slugByResident[id]}-portrait`;
export const residentKeepsakeKey = (id: ResidentId): string => `resident-v1-${slugByResident[id]}-keepsake`;
export const RESIDENT_GROUP_PHOTO_KEY = 'resident-v1-group-photo';
export const RESIDENT_ROUTE_ART = {
  'windmill-thanks': { start: 'resident-v1-windmill-photo-destination', middle: 'resident-v1-windmill-middle', destination: 'resident-v1-windmill-thanks-destination', ending: 'resident-v1-windmill-thanks-ending', postcard: 'resident-v1-windmill-thanks-postcard', carried: 'resident-v1-ahe-envelope', ordinary: 'resident-v1-ahe-ordinary', keepsake: 'resident-v1-windmill-thanks-stamp' },
  'windmill-photo': { start: 'resident-v1-windmill-thanks-destination', middle: 'resident-v1-windmill-middle', destination: 'resident-v1-windmill-photo-destination', ending: 'resident-v1-windmill-photo-ending', postcard: 'resident-v1-windmill-photo-postcard', carried: 'resident-v1-ahe-envelope', ordinary: 'resident-v1-ahe-ordinary', keepsake: 'resident-v1-windmill-photo-stamp' },
  'riverside-thanks': { start: 'resident-v1-riverside-sunshine-destination', middle: 'resident-v1-riverside-middle', destination: 'resident-v1-riverside-thanks-destination', ending: 'resident-v1-riverside-thanks-ending', postcard: 'resident-v1-riverside-thanks-postcard', carried: 'resident-v1-xiaomu-envelope', ordinary: 'resident-v1-xiaomu-ordinary', keepsake: 'resident-v1-riverside-thanks-stamp' },
  'riverside-sunshine': { start: 'resident-v1-riverside-thanks-destination', middle: 'resident-v1-riverside-middle', destination: 'resident-v1-riverside-sunshine-destination', ending: 'resident-v1-riverside-sunshine-ending', postcard: 'resident-v1-riverside-sunshine-postcard', carried: 'resident-v1-xiaomu-envelope', ordinary: 'resident-v1-xiaomu-ordinary', keepsake: 'resident-v1-riverside-sunshine-stamp' },
  'lighthouse-old-letter': { start: 'resident-v1-lighthouse-gathering-destination', middle: 'resident-v1-lighthouse-middle', destination: 'resident-v1-lighthouse-old-letter-destination', ending: 'resident-v1-lighthouse-old-letter-ending', postcard: 'resident-v1-lighthouse-old-letter-postcard', carried: 'resident-v1-adeng-envelope', ordinary: 'resident-v1-adeng-ordinary', keepsake: 'resident-v1-lighthouse-old-letter-stamp' },
  'lighthouse-gathering': { start: 'resident-v1-lighthouse-old-letter-destination', middle: 'resident-v1-lighthouse-middle', destination: 'resident-v1-lighthouse-gathering-destination', ending: 'resident-v1-lighthouse-gathering-ending', postcard: 'resident-v1-lighthouse-gathering-postcard', carried: 'resident-v1-adeng-envelope', ordinary: 'resident-v1-adeng-ordinary', keepsake: 'resident-v1-lighthouse-gathering-stamp' },
} as const;
export function validateResidentTextures(scene: Phaser.Scene): string[] {
  return RESIDENT_ASSETS.filter(asset => {
    if (!scene.textures.exists(asset.key)) return true;
    const source = scene.textures.get(asset.key).getSourceImage() as { width: number; height: number };
    return source.width !== asset.width || source.height !== asset.height;
  }).map(asset => asset.key);
}
export function prepareResidentTextures(scene: Phaser.Scene): void {
  const invalid = validateResidentTextures(scene);
  if (invalid.length) throw new Error(`Resident textures invalid: ${invalid.join(', ')}`);
  RESIDENT_ASSETS.forEach(asset => scene.textures.get(asset.key).setFilter(1));
}
