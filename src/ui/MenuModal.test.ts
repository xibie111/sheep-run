import { describe, expect, it } from "vitest";
import { ModalInputStack } from "./MenuModal";

describe("menu modal input ownership", () => {
  it("blocks bottom touches and restores their exact prior enabled states", () => {
    const start = { input: { enabled: true } }, disabled = { input: { enabled: false } }, close = { input: { enabled: false } };
    const stack = new ModalInputStack(), release = stack.acquire("mailbox", [start, disabled, close], [close])!;
    close.input.enabled = true;
    expect(start.input.enabled).toBe(false); expect(stack.owner).toBe("mailbox");
    expect(stack.acquire("collection", [start, disabled, close], [])).toBeUndefined();
    release(); expect(start.input.enabled).toBe(true); expect(disabled.input.enabled).toBe(false); expect(close.input.enabled).toBe(false);
    close.input.enabled = true; release(); expect(close.input.enabled).toBe(true);
  });
  it("permits the existing collection reward child and restores the parent first", () => {
    const start = { input: { enabled: true } }, album = { input: { enabled: false } }, reward = { input: { enabled: false } };
    const stack = new ModalInputStack(), objects = [start, album, reward];
    const parent = stack.acquire("collection", objects, [album])!; album.input.enabled = true;
    const child = stack.acquire("journey", objects, [reward], "collection")!; reward.input.enabled = true;
    expect(album.input.enabled).toBe(false); expect(start.input.enabled).toBe(false);
    child(); expect(album.input.enabled).toBe(true); expect(start.input.enabled).toBe(false); expect(stack.owner).toBe("collection");
    parent(); expect(start.input.enabled).toBe(true); expect(album.input.enabled).toBe(false);
  });
  it("does not restore destroyed or replaced input objects and clears on exit", () => {
    const target: { input: { enabled: boolean } | null } = { input: { enabled: true } };
    const stack = new ModalInputStack(), release = stack.acquire("mailbox", [target], [])!;
    target.input = { enabled: false }; release(); expect(target.input.enabled).toBe(false);
    stack.acquire("mailbox", [target], []); stack.clear(); expect(stack.owner).toBeUndefined();
  });
});
