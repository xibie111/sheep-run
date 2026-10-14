import { isDeliveryChapterId } from './DeliveryChapters';
import { canEnterDeliveryChapter } from '../residents/ResidentProgress';
export const DELIVERY_STORAGE_KEY = 'sheep-run-delivery-v1';
type Port = Pick<Storage, 'getItem' | 'setItem'>;
type Envelope = { version: 1; completedIds: string[]; [field: string]: unknown };
export interface DeliverySnapshot { completedIds: string[]; saveFailed: boolean }

/** Route postcards are cosmetic; no writes to the runner save or its version. */
export class DeliveryStore {
  private session = new Set<string>();
  private dirty = false;
  constructor(private readonly storage: () => Port | undefined = () => typeof window === 'undefined' ? undefined : window.localStorage) {}
  private read(): { envelope: Envelope; port?: Port } {
    const empty: Envelope = { version: 1, completedIds: [] };
    try {
      const port = this.storage(); if (!port) return { envelope: empty };
      const raw = port.getItem(DELIVERY_STORAGE_KEY); if (raw === null) return { envelope: empty, port };
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !('version' in value) || value.version !== 1 ||
        !('completedIds' in value) || !Array.isArray(value.completedIds) || !value.completedIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256)) return { envelope: empty };
      return { envelope: value as Envelope, port };
    } catch { return { envelope: empty }; }
  }
  load(): DeliverySnapshot { const { envelope, port } = this.read(); return { completedIds: [...new Set([...envelope.completedIds, ...this.session])], saveFailed: this.dirty || !port }; }
  /** Retry only real successes retained in this session, without granting another reward. */
  retrySave(): DeliverySnapshot {
    if (this.dirty) {
      const { envelope, port } = this.read();
      if (port) try {
        port.setItem(DELIVERY_STORAGE_KEY, JSON.stringify({ ...envelope, completedIds: [...new Set([...envelope.completedIds, ...this.session])] }));
        this.dirty = false;
      } catch { /* Preserve the original archive and this session until storage recovers. */ }
    }
    return this.load();
  }
  complete(id: string) {
    if (!isDeliveryChapterId(id)) return { added: false, saved: false };
    const { envelope, port } = this.read(), ids = envelope.completedIds;
    if (!canEnterDeliveryChapter(id, [...ids, ...this.session])) return { added: false, saved: false };
    const added = !ids.includes(id) && !this.session.has(id);
    this.session.add(id);
    if (!added && !this.dirty && port) return { added, saved: true };
    this.dirty = true;
    if (port) try { port.setItem(DELIVERY_STORAGE_KEY, JSON.stringify({ ...envelope, completedIds: [...new Set([...ids, ...this.session])] })); this.dirty = false; } catch { /* keep this session */ }
    return { added, saved: !this.dirty };
  }
}
export const deliveryStore = new DeliveryStore();
