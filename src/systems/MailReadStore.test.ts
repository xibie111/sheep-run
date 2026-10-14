import { describe, expect, it, vi } from "vitest";
import { MAIL_LETTERS } from "../data/mailLetters";
import { MAIL_STORAGE_KEY, MailReadStore } from "./MailReadStore";

const memory = () => {
  const values = new Map<string, string>();
  return { values, port: { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => values.set(key, value)) } };
};
describe("independent mailbox read persistence", () => {
  it("starts with two unread letters and does not write defaults", () => {
    const { port } = memory(), store = new MailReadStore(() => port);
    const snapshot = store.load();
    expect(MAIL_LETTERS.map(letter => snapshot.readIds.includes(letter.id))).toEqual([false, false]);
    expect(port.setItem).not.toHaveBeenCalled();
  });
  it("marks only the explicitly kept letter, persists, and leaves new IDs unread", () => {
    const { values, port } = memory(); values.set("sheep-run-save", "protected");
    const store = new MailReadStore(() => port);
    expect(store.markRead("welcome-v1")).toEqual({ readIds: ["welcome-v1"], saveFailed: false });
    expect(new MailReadStore(() => port).load().readIds).toEqual(["welcome-v1"]);
    expect(store.load().readIds.includes("goodnight-v1")).toBe(false);
    expect(store.load().readIds.includes("welcome-v2")).toBe(false);
    expect(values.get("sheep-run-save")).toBe("protected");
    expect(port.setItem.mock.calls.every(([key]) => key === MAIL_STORAGE_KEY)).toBe(true);
  });
  it("deduplicates records but retains removed and unknown letter IDs", () => {
    const { values, port } = memory();
    values.set(MAIL_STORAGE_KEY, JSON.stringify({ version: 1, readIds: ["old-letter", "welcome-v1", "old-letter"] }));
    const store = new MailReadStore(() => port);
    store.markRead("goodnight-v1");
    expect(new MailReadStore(() => port).load().readIds).toEqual(["old-letter", "welcome-v1", "goodnight-v1"]);
  });
  it("merges a newer valid record from another instance before writing", () => {
    const { port } = memory(), one = new MailReadStore(() => port), two = new MailReadStore(() => port);
    one.markRead("welcome-v1"); two.markRead("goodnight-v1");
    expect(one.load().readIds).toEqual(["welcome-v1", "goodnight-v1"]);
  });
  it.each(["broken JSON", "null", "[]", '{"version":2,"readIds":[]}', '{"version":1,"readIds":[13]}', '{"version":1,"readIds":[""]}'])("never overwrites invalid or future data: %s", raw => {
    const port = { getItem: () => raw, setItem: vi.fn() }, store = new MailReadStore(() => port);
    expect(store.load().saveFailed).toBe(true);
    expect(store.markRead("welcome-v1")).toEqual({ readIds: ["welcome-v1"], saveFailed: true });
    expect(store.load().readIds).toEqual(["welcome-v1"]);
    expect(port.setItem).not.toHaveBeenCalled();
  });
  it("keeps session state on access failure", () => {
    const store = new MailReadStore(() => { throw Error("denied"); });
    expect(store.markRead("goodnight-v1")).toEqual({ readIds: ["goodnight-v1"], saveFailed: true });
    expect(store.load().readIds).toEqual(["goodnight-v1"]);
  });
  it("retries failed session writes on another explicit keep action", () => {
    let raw: string | null = null, denied = true;
    const port = { getItem: () => raw, setItem: (_key: string, value: string) => { if (denied) throw Error("quota"); raw = value; } };
    const store = new MailReadStore(() => port);
    expect(store.markRead("welcome-v1").saveFailed).toBe(true);
    denied = false;
    expect(store.markRead("welcome-v1").saveFailed).toBe(false);
    expect(new MailReadStore(() => port).load().readIds).toEqual(["welcome-v1"]);
  });
  it("preserves future extension fields and retries only an actual keep action when opening the mailbox again", () => {
    const { values, port } = memory();
    values.set(MAIL_STORAGE_KEY, JSON.stringify({ version: 1, readIds: ['future-letter'], annotations: { private: true } }));
    let failed = true;
    const store = new MailReadStore(() => ({ getItem: port.getItem, setItem: (key, value) => { if (failed) throw Error('quota'); port.setItem(key, value); } }));
    expect(store.markRead('resident-windmill-letter-1-v1').saveFailed).toBe(true);
    failed = false;
    expect(store.retrySave()).toEqual({ readIds: ['future-letter', 'resident-windmill-letter-1-v1'], saveFailed: false });
    expect(JSON.parse(values.get(MAIL_STORAGE_KEY)!)).toEqual({ version: 1, readIds: ['future-letter', 'resident-windmill-letter-1-v1'], annotations: { private: true } });
    expect(store.load().readIds).not.toContain('resident-windmill-letter-2-v1');
    store.retrySave(); expect(port.setItem).toHaveBeenCalledTimes(1);
  });
});
