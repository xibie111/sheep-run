import { SCENERY_CARDS, type SceneryId } from './sceneryCatalog';
export const SCENERY_STORAGE_KEY = 'sheep-run-scenery-v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256;

/** Cosmetic discoveries only. Unknown IDs are retained; incompatible data is never overwritten. */
export class SceneryStore {
  private session = new Set<string>();
  private dirty = false;
  constructor(private readonly storage: () => StoragePort | undefined = () => typeof window === 'undefined' ? undefined : window.localStorage) {}
  private read(): { ids: string[]; port?: StoragePort } {
    try {
      const port = this.storage(); if (!port) return { ids: [] };
      const raw = port.getItem(SCENERY_STORAGE_KEY); if (raw === null) return { ids: [], port };
      const record: unknown = JSON.parse(raw);
      if (!record || typeof record !== 'object' || Array.isArray(record) || !('version' in record) || record.version !== 1 ||
        !('seenIds' in record) || !Array.isArray(record.seenIds) || !record.seenIds.every(validId)) return { ids: [] };
      return { ids: [...new Set(record.seenIds)], port };
    } catch { return { ids: [] }; }
  }
  load() {
    const { ids, port } = this.read();
    return { seenIds: [...new Set([...ids, ...this.session])], saveFailed: this.dirty || !port };
  }
  discover(id: SceneryId): { added: boolean; saved: boolean } {
    if (!SCENERY_CARDS.some(card => card.id === id)) return { added: false, saved: false };
    const { ids, port } = this.read(), added = !ids.includes(id) && !this.session.has(id);
    this.session.add(id);
    if (!added && !this.dirty && port) return { added, saved: true };
    this.dirty = true;
    if (port) try { port.setItem(SCENERY_STORAGE_KEY, JSON.stringify({ version: 1, seenIds: [...new Set([...ids, ...this.session])] })); this.dirty = false; } catch { /* retain session */ }
    return { added, saved: !this.dirty };
  }
}
export const sceneryStore = new SceneryStore();
