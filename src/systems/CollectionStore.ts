import { COLLECTION_BADGES, type CollectionBadgeId } from "../data/pastureCollections";

export const COLLECTION_STORAGE_KEY = "sheep-run-collections-v1";
type CollectionStorage = Pick<Storage, "getItem" | "setItem">;
export interface CollectionSnapshot { ids: CollectionBadgeId[]; saveFailed: boolean }
const known = new Set<string>(COLLECTION_BADGES.map(badge => badge.id));

/** Separate cosmetic save: never read, write, migrate or clear the gameplay save. */
export class CollectionStore {
  private readonly session = new Set<CollectionBadgeId>();
  private blocked = false;
  private writeFailed = false;
  constructor(private readonly storage: () => CollectionStorage = () => window.localStorage) {}
  load(): CollectionSnapshot {
    try {
      const raw = this.storage().getItem(COLLECTION_STORAGE_KEY);
      this.blocked = false;
      if (!raw) return { ids: [...this.session], saveFailed: this.writeFailed };
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
        !("badges" in value) || !Array.isArray(value.badges) || value.badges.some(id => typeof id !== "string" || !known.has(id))) {
        this.blocked = true;
        return { ids: [...this.session], saveFailed: true };
      }
      const stored = value.badges as CollectionBadgeId[];
      if ([...this.session].every(id => stored.includes(id))) this.writeFailed = false;
      return { ids: [...new Set([...stored, ...this.session])], saveFailed: this.writeFailed };
    } catch { this.blocked = true; return { ids: [...this.session], saveFailed: true }; }
  }
  unlock(id: CollectionBadgeId): { added: boolean; saved: boolean } {
    if (!known.has(id)) return {added:false,saved:false};
    const snapshot = this.load();
    if (snapshot.ids.includes(id)) return {added:false,saved:!snapshot.saveFailed};
    this.session.add(id);
    // Preserve malformed or future saves rather than replacing them with defaults.
    if (this.blocked) return {added:true,saved:false};
    try {
      this.storage().setItem(COLLECTION_STORAGE_KEY, JSON.stringify({version:1,badges:[...snapshot.ids,id]}));
      this.writeFailed = false;
      return {added:true,saved:true};
    } catch { this.writeFailed = true; return {added:true,saved:false}; }
  }
}
export const collectionStore = new CollectionStore();
