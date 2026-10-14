/** Chapter-only collections. These never use the runner's stars, power-ups or economy. */
import { RESIDENT_NEW_CHAPTER_IDS } from '../residents/ResidentCatalog';
export const LEGACY_DELIVERY_CHALLENGE_CHAPTER_IDS = ['windmill-invitation-v1', 'rainy-umbrella-v1', 'lighthouse-starlight-v1'] as const;
export const DELIVERY_CHALLENGE_CHAPTER_IDS = [...LEGACY_DELIVERY_CHALLENGE_CHAPTER_IDS, ...RESIDENT_NEW_CHAPTER_IDS] as const;
export type DeliveryChallengeChapterId = typeof DELIVERY_CHALLENGE_CHAPTER_IDS[number];
export type DeliveryStampKind = 'ordinary' | 'keepsake';
export interface DeliveryStampDefinition {
  readonly id: string;
  /** Same authored route coordinate used by fixed obstacles; x = 498 + at - distance. */
  readonly at: number;
  readonly y: number;
  readonly kind: DeliveryStampKind;
  readonly key: string;
}
export interface DeliveryChallengeDefinition {
  readonly stamps: readonly DeliveryStampDefinition[];
  readonly keepsakeKey: string;
  readonly keepsakeTitle?: string;
}
export interface DeliveryChallengeSnapshot {
  readonly ordinaryCollected: number;
  readonly totalOrdinary: number;
  readonly hiddenCollected: boolean;
  readonly collectedIds: readonly string[];
  readonly finished: boolean;
  readonly successful: boolean;
  readonly stars: 0 | 1 | 2 | 3;
  /** Delivery, four ordinary stamps, and the hidden keepsake are distinct achievements. */
  readonly earnedStars: readonly [boolean, boolean, boolean];
}
export function isDeliveryChallengeChapterId(id: unknown): id is DeliveryChallengeChapterId {
  return typeof id === 'string' && (DELIVERY_CHALLENGE_CHAPTER_IDS as readonly string[]).includes(id);
}

/** One disposable run; successful delivery is required before any stars can be awarded. */
export class DeliveryChallengeRun {
  private readonly stamps: ReadonlyMap<string, DeliveryStampDefinition>;
  private readonly collected = new Set<string>();
  private finished = false;
  private successful = false;
  constructor(readonly definition: DeliveryChallengeDefinition) {
    this.stamps = new Map(definition.stamps.map(stamp => [stamp.id, stamp]));
  }
  collect(id: string): boolean {
    if (this.finished || !this.stamps.has(id) || this.collected.has(id)) return false;
    this.collected.add(id); return true;
  }
  isCollected(id: string): boolean { return this.collected.has(id); }
  snapshot(): DeliveryChallengeSnapshot {
    let ordinaryCollected = 0, totalOrdinary = 0, hiddenCollected = false;
    for (const stamp of this.stamps.values()) {
      if (stamp.kind === 'ordinary') { totalOrdinary++; if (this.collected.has(stamp.id)) ordinaryCollected++; }
      else if (this.collected.has(stamp.id)) hiddenCollected = true;
    }
    const earnedStars = [this.successful, this.successful && ordinaryCollected >= 4, this.successful && hiddenCollected] as const;
    const stars = earnedStars.filter(Boolean).length as 0 | 1 | 2 | 3;
    return Object.freeze({ ordinaryCollected, totalOrdinary, hiddenCollected,
      collectedIds: Object.freeze([...this.collected]), finished: this.finished, successful: this.successful,
      stars, earnedStars: Object.freeze(earnedStars) });
  }
  /** First outcome wins. Failure cannot later turn into a success or unlock a keepsake. */
  finish(successful: boolean): DeliveryChallengeSnapshot {
    if (!this.finished) { this.finished = true; this.successful = successful; }
    return this.snapshot();
  }
}
