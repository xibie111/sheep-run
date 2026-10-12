import { describe, expect, it } from "vitest";
import { WORLD } from "../game/Constants";
import { companionCanCelebrate, CompanionResponses, COMPANION_RESPONSE_RULES as RULES } from "./CompanionResponses";

describe("effective-time companion response queue", () => {
  it("waits for safe following and chooses the crown ahead of a coalesced star request", () => {
    const queue = new CompanionResponses();
    queue.request("star", 0); queue.request("star", 0); queue.request("crown", 0);
    expect(queue.update(0, "entering", true)).toBeNull();
    expect(queue.update(1000, "following", false)).toBeNull();
    expect(queue.update(1200, "following", true)).toEqual({ kind: "crown", progress: 0 });
    expect(queue.update(1500, "following", true)?.kind).toBe("crown");
  });
  it("keeps jump, fall, crouch, hit and dash presentation ahead of celebrations", () => {
    const lead = Object.freeze({ x: 101, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" as const });
    expect(companionCanCelebrate(lead)).toBe(true);
    for (const motionState of ["JUMPING", "FALLING", "HIT", "DEAD", "DASH", "IDLE"] as const) {
      expect(companionCanCelebrate(Object.freeze({ ...lead, motionState }))).toBe(false);
    }
    expect(companionCanCelebrate(Object.freeze({ ...lead, displayHeight: 30 }))).toBe(false);
    expect(companionCanCelebrate(Object.freeze({ ...lead, y: 170 }))).toBe(false);
    expect(lead).toEqual({ x: 101, y: WORLD.groundY, displayWidth: 48, displayHeight: 42, motionState: "RUNNING" });
  });
  it("hides and suspends an active response while the lead performs an action", () => {
    const queue = new CompanionResponses(); queue.request("crown", 0);
    queue.update(1000, "following", true);
    expect(queue.update(1200, "following", true)?.progress).toBeCloseTo(200 / RULES.crownMs);
    expect(queue.update(1220, "following", false)).toBeNull();
    expect(queue.update(2500, "following", false)).toBeNull();
    expect(queue.update(2520, "following", true)?.progress).toBeCloseTo(200 / RULES.crownMs);
    expect(queue.update(2720, "following", true)?.progress).toBeCloseTo(400 / RULES.crownMs);
  });
  it("respects a cooldown and coalesces repeated events instead of continuously interrupting", () => {
    const queue = new CompanionResponses(); queue.request("star", 0);
    queue.update(1000, "following", true);
    for (let at = 1100; at < 1800; at += 100) { queue.request("star", at); queue.update(at, "following", true); }
    expect(queue.update(1850, "following", true)).toBeNull();
    queue.request("star", 2000); queue.request("star", 2100);
    expect(queue.update(3449, "following", true)).toBeNull();
    expect(queue.update(3450, "following", true)).toEqual({ kind: "star", progress: 0 });
    expect(queue.update(4300, "following", true)).toBeNull();
    expect(queue.update(5900, "following", true)).toBeNull();
  });
  it("drops stale star celebrations without dropping a pending record celebration", () => {
    const queue = new CompanionResponses(); queue.request("star", 0); queue.request("crown", 0);
    expect(queue.update(5000, "following", false)).toBeNull();
    expect(queue.update(5020, "following", true)?.kind).toBe("crown");
    expect(queue.update(6200, "following", true)).toBeNull();
    expect(queue.update(9000, "following", true)).toBeNull();
  });
  it("does not turn a duplicate active crown request into a new celebration", () => {
    const queue = new CompanionResponses(); queue.request("crown", 0);
    expect(queue.update(1000, "following", true)?.kind).toBe("crown");
    queue.request("crown", 1000);
    expect(queue.update(2100, "following", true)).toBeNull();
    expect(queue.update(3700, "following", true)).toBeNull();
  });
  it("replaces queued and active celebrations with a farewell heart without delaying departure", () => {
    const queue = new CompanionResponses(); queue.request("crown", 8000);
    queue.update(8500, "following", true); queue.request("star", 8510);
    expect(queue.update(9000, "leaving", false)).toEqual({ kind: "heart", progress: 0 });
    queue.request("crown", 9100); queue.request("star", 9100);
    expect(queue.update(9500, "leaving", false)).toEqual({ kind: "heart", progress: .5 });
    expect(queue.update(10_000, "gone", false)).toBeNull();
    expect(queue.update(11_000, "following", true)).toBeNull();
  });
  it("freezes on repeated effective time and never resumes after cleanup", () => {
    const queue = new CompanionResponses(); queue.request("star", 0);
    const first = queue.update(1000, "following", true);
    for (let frame = 0; frame < 500; frame++) expect(queue.update(1000, "following", true)).toEqual(first);
    queue.clear(); queue.clear(); queue.request("crown", 1100);
    expect(queue.update(1200, "following", true)).toBeNull();
    const nextRun = new CompanionResponses(); expect(nextRun.update(1200, "following", true)).toBeNull();
  });
});
