import { isDeliveryChallengeChapterId, type DeliveryChallengeChapterId, type DeliveryChallengeSnapshot } from './DeliveryChallengeRun';
import { deliveryStore } from './DeliveryStore';
import { canEnterDeliveryChapter } from '../residents/ResidentProgress';
export const DELIVERY_CHALLENGE_STORAGE_KEY = 'sheep-run-delivery-challenges-v1';
export interface DeliveryChallengeRecord { readonly bestStars: 1 | 2 | 3; readonly keepsake: boolean }
type Port = Pick<Storage, 'getItem' | 'setItem'>;
type JsonEnvelope = { version: 1; chapters: Record<string, unknown>; [field: string]: unknown };
const merge = (a: DeliveryChallengeRecord | undefined, b: DeliveryChallengeRecord): DeliveryChallengeRecord =>
  Object.freeze({ bestStars: Math.max(a?.bestStars ?? 0, b.bestStars) as 1 | 2 | 3, keepsake: !!a?.keepsake || b.keepsake });
function validRecord(value: unknown): value is DeliveryChallengeRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'bestStars' in value &&
    Number.isInteger(value.bestStars) && Number(value.bestStars) >= 1 && Number(value.bestStars) <= 3 &&
    'keepsake' in value && typeof value.keepsake === 'boolean' &&
    // A successful keepsake run earns at least two stars; three stars always includes it.
    (value.bestStars !== 1 || !value.keepsake) && (value.bestStars !== 3 || value.keepsake);
}
function usableResult(result: DeliveryChallengeSnapshot): boolean {
  if (!result || !result.finished || !result.successful || result.totalOrdinary !== 5 || !Array.isArray(result.earnedStars) || result.earnedStars.length !== 3 || !Number.isInteger(result.ordinaryCollected) ||
    result.ordinaryCollected < 0 || result.ordinaryCollected > 5 || typeof result.hiddenCollected !== 'boolean') return false;
  const expected = [true, result.ordinaryCollected >= 4, result.hiddenCollected];
  return result.stars === expected.filter(Boolean).length && expected.every((flag, index) => result.earnedStars[index] === flag);
}
/** Fail-closed independent cosmetic archive. Future entries and fields survive every write. */
export class DeliveryChallengeStore {
  private readonly session = new Map<DeliveryChallengeChapterId, DeliveryChallengeRecord>();
  private dirty = false;
  constructor(private readonly storage: () => Port | undefined = () => typeof window === 'undefined' ? undefined : window.localStorage,
    private readonly completedIds: () => readonly string[] = () => deliveryStore.load().completedIds) {}
  private read(): { envelope: JsonEnvelope; port?: Port } {
    const empty: JsonEnvelope = { version: 1, chapters: {} };
    try {
      const port = this.storage(); if (!port) return { envelope: empty };
      const raw = port.getItem(DELIVERY_CHALLENGE_STORAGE_KEY); if (raw === null) return { envelope: empty, port };
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !('version' in value) || value.version !== 1 ||
        !('chapters' in value) || !value.chapters || typeof value.chapters !== 'object' || Array.isArray(value.chapters)) return { envelope: empty };
      const entries = Object.entries(value.chapters);
      if (entries.some(([id, record]) => !id || id.length > 256 || (isDeliveryChallengeChapterId(id) && !validRecord(record)))) return { envelope: empty };
      return { envelope: value as JsonEnvelope, port };
    } catch { return { envelope: empty }; }
  }
  load(): { chapters: Readonly<Partial<Record<DeliveryChallengeChapterId, DeliveryChallengeRecord>>>; saveFailed: boolean } {
    const { envelope, port } = this.read(), chapters: Partial<Record<DeliveryChallengeChapterId, DeliveryChallengeRecord>> = {};
    for (const [id, record] of Object.entries(envelope.chapters)) if (isDeliveryChallengeChapterId(id) && validRecord(record)) chapters[id] = { ...record };
    for (const [id, record] of this.session) chapters[id] = merge(chapters[id], record);
    return { chapters, saveFailed: this.dirty || !port };
  }
  retrySave(): ReturnType<DeliveryChallengeStore['load']> {
    if (this.dirty) {
      const { envelope, port } = this.read();
      if (port) this.persist(envelope, port);
    }
    return this.load();
  }
  private persist(envelope: JsonEnvelope, port: Port): void {
    const chapters = { ...envelope.chapters };
    for (const [chapterId, sessionRecord] of this.session) {
      const persisted = chapters[chapterId];
      chapters[chapterId] = { ...(validRecord(persisted) ? persisted : {}), ...merge(validRecord(persisted) ? persisted : undefined, sessionRecord) };
    }
    try { port.setItem(DELIVERY_CHALLENGE_STORAGE_KEY, JSON.stringify({ ...envelope, chapters })); this.dirty = false; } catch { /* Retain session rewards and the original saved bytes. */ }
  }
  recordResult(id: string, result: DeliveryChallengeSnapshot): { accepted: boolean; improved: boolean; saved: boolean; record?: DeliveryChallengeRecord } {
    if (!isDeliveryChallengeChapterId(id) || !usableResult(result) || !canEnterDeliveryChapter(id, this.completedIds())) return { accepted: false, improved: false, saved: false };
    const { envelope, port } = this.read();
    const stored = envelope.chapters[id];
    const persisted = validRecord(stored) ? stored : undefined, session = this.session.get(id);
    const previous = session ? merge(persisted, session) : persisted;
    const record = merge(previous, { bestStars: result.stars as 1 | 2 | 3, keepsake: result.hiddenCollected });
    const improved = !previous || record.bestStars > previous.bestStars || record.keepsake !== previous.keepsake;
    this.session.set(id, record);
    if (!improved && !this.dirty && port) return { accepted: true, improved, saved: true, record };
    this.dirty = true;
    if (port) this.persist(envelope, port);
    return { accepted: true, improved, saved: !this.dirty, record };
  }
}
export const deliveryChallengeStore = new DeliveryChallengeStore();
