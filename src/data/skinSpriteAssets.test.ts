import { describe, expect, it, vi } from "vitest";
import { SHEEP_SKINS, sheepTextureKey } from "./sheepSkins";
import { loadSkinSpriteAssets, registerSkinRenderFrames } from "./skinSpriteAssets";

describe("local production skin loading", () => {
  it("preloads every catalog sheet as 128px cells", () => {
    const spritesheet = vi.fn();
    loadSkinSpriteAssets({ load: { spritesheet } } as never);
    expect(spritesheet).toHaveBeenCalledTimes(SHEEP_SKINS.length);
    for (const skin of SHEEP_SKINS) {
      expect(spritesheet).toHaveBeenCalledWith(sheepTextureKey(skin.id), expect.stringContaining(`${skin.id}-sheet.png`), { frameWidth: 128, frameHeight: 128, endFrame: 14 });
    }
  });

  it("registers all visible frames with uniform display scale and no top padding", () => {
    const setSize = vi.fn();
    const get = vi.fn(() => ({ setSize }));
    const texture = { source: [{ width: 640, height: 384 }], has: vi.fn(() => true), get };
    registerSkinRenderFrames({ textures: { exists: vi.fn(() => true), get: vi.fn(() => texture) } } as never);
    expect(setSize).toHaveBeenCalledTimes(SHEEP_SKINS.length * 15);
    expect(setSize).toHaveBeenNthCalledWith(1, 128, 112, 0, 16);
    expect(setSize).toHaveBeenNthCalledWith(15, 128, 112, 512, 272);
    expect(48 / 128).toBe(42 / 112);
  });

  it("fails visibly on missing art or a missing pose instead of silently restoring placeholders", () => {
    expect(() => registerSkinRenderFrames({ textures: { exists: () => false } } as never)).toThrow(/failed to load/);
    const texture = { source: [{ width: 640, height: 384 }], has: () => false };
    expect(() => registerSkinRenderFrames({ textures: { exists: () => true, get: () => texture } } as never)).toThrow(/missing frame 0/);
  });
});
