import { deliveryRoadOffset } from './DeliveryScrolling';

/** A grounded destination follows the mailbox's world position, including reduced motion. */
export function windmillMeadowLandmarkX(distance: number, length: number, playerX: number): number {
  return playerX + 78 + length - distance + 80;
}

/** Near grass shares the road's physical travel and optional reduced-motion freeze. */
export function windmillMeadowGrassOffset(distance: number, originX: number, scale: number,
  sourceWidth: number, reducedMotion: boolean): number {
  return deliveryRoadOffset(distance, originX, scale, sourceWidth, reducedMotion);
}
