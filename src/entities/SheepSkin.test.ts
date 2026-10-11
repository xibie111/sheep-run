import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Physics: {
      Arcade: {
        Sprite: class {
          scene: unknown;
          texture: { key: string };
          frame: { width: number; height: number };
          scaleX = 1;
          scaleY = 1;
          body: unknown;
          x: number;
          y: number;
          anims = { currentAnim: null as { key: string } | null, play: vi.fn((_key: string, _ignoreIfPlaying?: boolean) => undefined) };

          constructor(scene: unknown, x: number, y: number, key: string) {
            this.scene = scene;
            this.x = x;
            this.y = y;
            this.texture = { key };
            this.frame = { width: 24, height: 21 };
          }

          setOrigin(): this { return this; }
          setDisplaySize(width: number, height: number): this { this.scaleX = width / 24; this.scaleY = height / 21; return this; }
          setDepth(): this { return this; }
          play(key: string, ignoreIfPlaying?: boolean): this { this.anims.play(key, ignoreIfPlaying); return this; }
          preUpdate(): void {}
        },
      },
    },
  },
}));

import { Sheep } from "./Sheep";

describe("Sheep skin rendering", () => {
  it("uses the selected palette texture and skin-specific animation keys", () => {
    const body = {
      blocked: { down: true }, touching: { down: true }, velocity: { y: 0 }, position: { x: 0, y: 0 }, prevFrame: { x: 0, y: 0 },
      setCollideWorldBounds: vi.fn(), setBounce: vi.fn(), setSize: vi.fn(), setOffset: vi.fn(),
      updateFromGameObject: vi.fn(), setVelocityY: vi.fn(),
    };
    const scene = {
      add: { existing: vi.fn() },
      physics: { add: { existing: (sprite: { body: unknown }) => { sprite.body = body; } } },
    };
    const sheep = new Sheep(scene as never, 1, "black");
    const sprite = sheep as unknown as { texture: { key: string }; anims: { play: ReturnType<typeof vi.fn> } };

    expect(sprite.texture.key).toBe("sheep-runner-black");
    sheep.preUpdate(0, 16);
    expect(sprite.anims.play).toHaveBeenCalledWith("sheep-black-run", true);
  });
});
