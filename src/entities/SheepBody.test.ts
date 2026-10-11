import { describe, expect, it } from "vitest";
import { syncSheepArcadeBody, type SheepBodySyncPort } from "./SheepBody";

class BodyProbe implements SheepBodySyncPort {
  width = 0;
  height = 0;
  offsetX = 0;
  offsetY = 0;
  bottom = 0;
  position = { x: 0, y: 0 };
  prevFrame = { x: 0, y: 0 };
  updates = 0;

  constructor(
    private readonly gameObjectY: number,
    private readonly frameHeight: number,
    private readonly scaleX: number,
    private readonly scaleY: number,
    previousHeight: number,
    priorFrameDelta = 0,
  ) {
    this.position.y = gameObjectY - previousHeight;
    this.prevFrame.y = this.position.y - priorFrameDelta;
  }

  setSize(width: number, height: number): void {
    this.width = width * this.scaleX;
    this.height = height * this.scaleY;
  }

  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  updateFromGameObject(): void {
    this.updates += 1;
    this.position.y = this.gameObjectY + this.scaleY * (this.offsetY - this.frameHeight);
    this.bottom = this.position.y + this.height;
  }

  get postUpdateSpriteY(): number {
    return this.gameObjectY + this.position.y - this.prevFrame.y;
  }
}

describe("sheep Arcade body sync", () => {
  it.each([42, 30])("preserves the existing world hitbox and feet with 128px assets at display height %s", (displayHeight) => {
    const logicalHeight = displayHeight === 42 ? 30 : 18;
    const body = new BodyProbe(218, 112, 48 / 128, displayHeight / 112, logicalHeight);
    syncSheepArcadeBody(body, {
      frameWidth: 128, frameHeight: 112, scaleX: 48 / 128, scaleY: displayHeight / 112,
      logicalWidth: 42, logicalHeight,
    });
    expect(body.width).toBeCloseTo(30, 5);
    expect(body.height).toBeCloseTo(logicalHeight, 5);
    expect(body.bottom).toBeCloseTo(218, 5);
    expect(body.postUpdateSpriteY).toBeCloseTo(218, 5);
  });
  it("keeps the feet aligned through postUpdate after entering crouch", () => {
    const body = new BodyProbe(218, 21, 2, 30 / 21, 30);

    syncSheepArcadeBody(body, {
      frameWidth: 24,
      frameHeight: 21,
      scaleX: 2,
      scaleY: 30 / 21,
      logicalWidth: 42,
      logicalHeight: 18,
    });

    expect(body.height).toBe(18);
    expect(body.bottom).toBeCloseTo(218, 5);
    expect(body.postUpdateSpriteY).toBeCloseTo(218, 5);
    expect(body.updates).toBe(1);
  });

  it("keeps the feet aligned through postUpdate when standing again", () => {
    const body = new BodyProbe(218, 21, 2, 42 / 21, 18);

    syncSheepArcadeBody(body, {
      frameWidth: 24,
      frameHeight: 21,
      scaleX: 2,
      scaleY: 42 / 21,
      logicalWidth: 42,
      logicalHeight: 30,
    });

    expect(body.height).toBe(30);
    expect(body.bottom).toBeCloseTo(218, 5);
    expect(body.postUpdateSpriteY).toBeCloseTo(218, 5);
    expect(body.updates).toBe(1);
  });

  it("preserves an actual physics displacement while changing geometry", () => {
    const body = new BodyProbe(218, 21, 2, 30 / 21, 30, 3);

    syncSheepArcadeBody(body, {
      frameWidth: 24,
      frameHeight: 21,
      scaleX: 2,
      scaleY: 30 / 21,
      logicalWidth: 42,
      logicalHeight: 18,
    });

    expect(body.postUpdateSpriteY).toBeCloseTo(221, 5);
  });
});
