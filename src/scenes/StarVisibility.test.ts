import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {
  Scene: class {}, Physics: { Arcade: { Sprite: class {} } },
  Input: { Events: {} }, Scenes: { Events: { PRE_UPDATE: "preupdate" } },
} }));

import { RunScene } from "./RunScene";
import { Star } from "../entities/Star";
import { PLAYER } from "../game/Constants";

function fixture(width: number, height = 270, cameraLeft?: number) {
  const star = Object.assign(Object.create(Star.prototype), {
    x: PLAYER.x - 5, y: 90, active: true, visible: true, collected: false, missed: false,
    updateMotion: vi.fn(),
    getBounds: () => ({ right: star.x + 12 }),
    deactivate: vi.fn(() => { star.active = false; star.visible = false; }),
  }) as Star;
  const missStar = vi.fn();
  const scene = Object.assign(Object.create(RunScene.prototype), {
    scale: { gameSize: { width, height } },
    cameras: cameraLeft === undefined ? undefined : { main: { scrollX: cameraLeft } },
    difficultySystem: { speed: 190 }, activeRunTimeMs: 0,
    obstacles: { getChildren: () => [] }, stars: { getChildren: () => [star] }, powerUps: { getChildren: () => [] },
    powerUpSystem: { isActive: () => false }, scoreSystem: { missStar },
    starRoutes: { recycle: vi.fn() },
  }) as RunScene;
  const move = () => (scene as unknown as { moveObjects(delta: number): void }).moveObjects(0.04);
  return { scene, star, missStar, move };
}

describe("missed star visibility", () => {
  it.each([[480, 270], [584, 270], [960, 270], [480, 360]])(
    "keeps a star behind the sheep until its entire outline leaves %sx%s", (width, height) => {
      const { star, missStar, move } = fixture(width, height);
      const left = -(width - 480);
      move();
      expect(star.missed).toBe(true);
      expect(missStar).toHaveBeenCalledTimes(1);
      expect(star.active && star.visible).toBe(true);
      expect(star.deactivate).not.toHaveBeenCalled();
      // The center is already outside, but part of the star is still visible.
      star.x = left - 11; move();
      expect(star.deactivate).not.toHaveBeenCalled();
      expect(missStar).toHaveBeenCalledTimes(1);
      star.x = left - 13; move();
      expect(star.deactivate).toHaveBeenCalledTimes(1);
      expect(star.active || star.visible).toBe(false);
      expect(missStar).toHaveBeenCalledTimes(1);
    },
  );
  it("follows the camera's actual visible edge", () => {
    const { star, move } = fixture(584, 270, -170);
    star.x = -160; move();
    expect(star.active).toBe(true);
    star.x = -183; move();
    expect(star.deactivate).toHaveBeenCalledOnce();
  });
  it("does not award a delayed overlap for an already missed star", () => {
    const { scene, star, move } = fixture(480);
    move();
    (scene as unknown as { onStarOverlap(star: object): void }).onStarOverlap(star);
    expect(star.collected).toBe(false);
    expect(star.deactivate).not.toHaveBeenCalled();
  });
});
