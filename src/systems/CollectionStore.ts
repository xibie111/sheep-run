import { COLLECTION_BADGES, type CollectionBadgeId } from "../data/pastureCollections";

export const COLLECTION_STORAGE_KEY = "sheep-run-collections-v1";
type CollectionStorage = Pick<Storage, "getItem" | "setItem">;
export interface CollectionSnapshot { ids: CollectionBadgeId[]; saveFailed: boolean }
const known = new Set<string>(COLLECTION_BADGES.map(badge => badge.id));

/** Separate cosmetic save: never read, write, migrate or clear the gameplay save. */
export class CollectionStore {
  private readonly session = new Set<CollectionBadgeId>();
  private blocked = false;
  private dirty = false;
  constructor(private readonly storage: () => CollectionStorage = () => window.localStorage) {}
  load(): CollectionSnapshot {
    try {
      const raw = this.storage().getItem(COLLECTION_STORAGE_KEY);
      this.blocked = false;
      if (raw === null) {
        this.dirty = this.session.size > 0;
        return { ids: [...this.session], saveFailed: this.dirty };
      }
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
        !("badges" in value) || !Array.isArray(value.badges) || value.badges.some(id => typeof id !== "string" || !known.has(id))) {
        this.blocked = true;
        return { ids: [...this.session], saveFailed: true };
      }
      const stored = value.badges as CollectionBadgeId[];
      this.dirty = [...this.session].some(id => !stored.includes(id));
      return { ids: [...new Set([...stored, ...this.session])], saveFailed: this.dirty };
    } catch { this.blocked = true; return { ids: [...this.session], saveFailed: true }; }
  }
  unlock(id: CollectionBadgeId): { added: boolean; saved: boolean } {
    if (!known.has(id)) return {added:false,saved:false};
    const snapshot = this.load();
    const added = !snapshot.ids.includes(id);
    if (added) {
      this.session.add(id);
      this.dirty = true;
    }
    return {added,saved:!this.retrySave().saveFailed};
  }
  retrySave(): CollectionSnapshot {
    const snapshot = this.load();
    // Preserve malformed or future saves rather than replacing them with defaults.
    if (this.blocked || !this.dirty) return snapshot;
    try {
      this.storage().setItem(COLLECTION_STORAGE_KEY, JSON.stringify({version:1,badges:snapshot.ids}));
      this.dirty = false;
    } catch { /* Keep session badges pending until a later pickup or album open. */ }
    return {ids:snapshot.ids,saveFailed:this.dirty};
  }
}
export const collectionStore = new CollectionStore();
