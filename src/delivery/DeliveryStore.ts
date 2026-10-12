import { isDeliveryChapterId } from './DeliveryChapters';
export const DELIVERY_STORAGE_KEY = 'sheep-run-delivery-v1';
type Port = Pick<Storage, 'getItem' | 'setItem'>;

/** Route postcards are cosmetic; no writes to the runner save or its version. */
export class DeliveryStore {
  private session = new Set<string>();
  private dirty = false;
  constructor(private readonly storage: () => Port | undefined = () => typeof window === 'undefined' ? undefined : window.localStorage) {}
  private read(): { ids: string[]; port?: Port } {
    try {
      const port = this.storage(); if (!port) return { ids: [] };
      const raw = port.getItem(DELIVERY_STORAGE_KEY); if (raw === null) return { ids: [], port };
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !('version' in value) || value.version !== 1 ||
        !('completedIds' in value) || !Array.isArray(value.completedIds) || !value.completedIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256)) return { ids: [] };
      return { ids: [...new Set(value.completedIds)], port };
    } catch { return { ids: [] }; }
  }
  load() { const { ids, port } = this.read(); return { completedIds: [...new Set([...ids, ...this.session])], saveFailed: this.dirty || !port }; }
  complete(id: string) {
    if (!isDeliveryChapterId(id)) return { added: false, saved: false };
    const { ids, port } = this.read(), added = !ids.includes(id) && !this.session.has(id);
    this.session.add(id);
    if (!added && !this.dirty && port) return { added, saved: true };
    this.dirty = true;
    if (port) try { port.setItem(DELIVERY_STORAGE_KEY, JSON.stringify({ version: 1, completedIds: [...new Set([...ids, ...this.session])] })); this.dirty = false; } catch { /* keep this session */ }
    return { added, saved: !this.dirty };
  }
}
export const deliveryStore = new DeliveryStore();
