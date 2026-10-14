export const MAIL_STORAGE_KEY = "sheep-run-mailbox-v1";
type StoragePort = Pick<Storage, "getItem" | "setItem">;
type MailEnvelope = { version: 1; readIds: string[]; [field: string]: unknown };
export interface MailReadSnapshot { readIds: string[]; saveFailed: boolean }

/** Separate from the gameplay save; unknown IDs survive catalogue updates. */
export class MailReadStore {
  private readonly session = new Set<string>();
  private dirty = false;
  constructor(private readonly storage: () => StoragePort | undefined = () => typeof window === "undefined" ? undefined : window.localStorage) {}

  private read(): { ids: string[]; writable: boolean; port?: StoragePort; envelope?: MailEnvelope } {
    try {
      const port = this.storage();
      if (!port) return { ids: [], writable: false };
      const raw = port.getItem(MAIL_STORAGE_KEY);
      if (raw === null) return { ids: [], writable: true, port };
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return { ids: [], writable: false };
      const record = value as { version?: unknown; readIds?: unknown };
      if (record.version !== 1 || !Array.isArray(record.readIds) || !record.readIds.every(validId)) return { ids: [], writable: false };
      return { ids: [...new Set(record.readIds as string[])], writable: true, port, envelope: value as MailEnvelope };
    } catch { return { ids: [], writable: false }; }
  }

  load(): MailReadSnapshot {
    const current = this.read();
    return { readIds: [...new Set([...current.ids, ...this.session])], saveFailed: this.dirty || !current.writable };
  }

  retrySave(): MailReadSnapshot {
    if (this.dirty) {
      const current = this.read();
      if (current.writable && current.port) try {
        current.port.setItem(MAIL_STORAGE_KEY, JSON.stringify({ ...current.envelope, version: 1, readIds: [...new Set([...current.ids, ...this.session])] }));
        this.dirty = false;
      } catch { /* An explicit keep action remains unread in storage until it can be saved. */ }
    }
    return this.load();
  }

  markRead(id: string): MailReadSnapshot {
    if (!validId(id)) return this.load();
    const current = this.read();
    const previouslyRead = current.ids.includes(id) || this.session.has(id);
    this.session.add(id);
    const ids = [...new Set([...current.ids, ...this.session])];
    if (previouslyRead && !this.dirty && current.writable) return { readIds: ids, saveFailed: false };
    this.dirty = true;
    if (current.writable && current.port) {
      try { current.port.setItem(MAIL_STORAGE_KEY, JSON.stringify({ ...current.envelope, version: 1, readIds: ids })); this.dirty = false; }
      catch { /* Keep explicit read actions for this session and retry on the next one. */ }
    }
    return { readIds: ids, saveFailed: this.dirty };
  }
}

function validId(id: unknown): id is string { return typeof id === "string" && id.length > 0 && id.length <= 256; }
export const mailReadStore = new MailReadStore();
