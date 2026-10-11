import { describe, expect, it } from "vitest";
import { companionAccessory } from "./CompanionAccessory";
import { companionPose } from "./CompanionPose";

describe("small, attached neck bell", () => {
  const lead = { x: 101, y: 218, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" as const };
  it("hangs below the neck instead of crossing the cheek, including run frame changes", () => {
    const pose = companionPose(lead, 5000, 0, false);
    for (const frame of [1, 2, 3, 4, 11, 12]) {
      const accessory = companionAccessory(pose, frame, 5000, false);
      expect(accessory.y).toBeGreaterThan(pose.y - pose.height * .36);
      expect(accessory.y).toBeLessThan(pose.y - pose.height * .28);
      expect(accessory.bellY).toBe(accessory.y + 1);
      expect(accessory.bellY + 7).toBeLessThan(pose.y);
      expect(accessory.bellX + 3).toBeLessThan(pose.x + pose.width / 2);
    }
  });
  it("uses the jumping neck pose, scales with crouching, rotates about the sheep and freezes on effective time", () => {
    const jump = companionPose({ ...lead, y: 120, motionState: "JUMPING" }, 5000, 0, false);
    const jumping = companionAccessory(jump, 5, 5000, false);
    expect(jumping.bellY).toBeLessThan(jump.y - 10);
    const crouch = companionPose({ ...lead, displayHeight: 30 }, 5000, 0, false);
    expect(companionAccessory(crouch, 1, 5000, false).y - crouch.y).toBeCloseTo((companionAccessory(companionPose(lead, 5000, 0, false), 1, 5000, false).y - 218) * 30 / 42);
    const nod = { ...jump, angle: 4 };
    expect(companionAccessory(nod, 5, 5000, false).x).not.toBe(jumping.x);
    expect(companionAccessory(jump, 5, 5000, false)).toEqual(jumping);
    expect(companionAccessory(jump, 5, 5000, true).bellAngle).toBe(0);
  });
});
