import { INPUT } from "../game/Constants";

export type GestureAction =
  | { type: "jump" }
  | { type: "high-jump" }
  | { type: "crouch" }
  | { type: "dash-start" }
  | { type: "dash-end" };

export type GestureEvent =
  | { type: "down"; pointerId: number; x: number; y: number; at: number }
  | { type: "move"; pointerId: number; x: number; y: number; at: number }
  | { type: "tick"; at: number }
  | { type: "up"; pointerId: number; x: number; y: number; at: number }
  | { type: "cancel" };

type GestureState = "pending" | "swipe-pending" | "up" | "down" | "ignored" | "dash";

interface ActivePointer {
  id: number;
  startX: number;
  startY: number;
  startedAt: number;
  lastX: number;
  lastY: number;
  state: GestureState;
}

export class GestureRecognizer {
  private active: ActivePointer | null = null;

  handle(event: GestureEvent): GestureAction[] {
    if (event.type === "down") {
      if (this.active) return [];
      this.active = {
        id: event.pointerId,
        startX: event.x,
        startY: event.y,
        startedAt: event.at,
        lastX: event.x,
        lastY: event.y,
        state: "pending",
      };
      return [];
    }

    if (event.type === "cancel") {
      const wasDashing = this.active?.state === "dash";
      this.active = null;
      return wasDashing ? [{ type: "dash-end" }] : [];
    }

    const active = this.active;
    if (!active || ("pointerId" in event && event.pointerId !== active.id)) return [];

    if (event.type === "tick") {
      if (active.state !== "pending" || event.at - active.startedAt < INPUT.holdThresholdMs) return [];
      if (this.travel(active, active.lastX, active.lastY) >= INPUT.tapTravelPx) {
        active.state = "ignored";
        return [];
      }
      active.state = "dash";
      return [{ type: "dash-start" }];
    }

    const holdAction: GestureAction[] = [];
    if (active.state === "pending" && event.at - active.startedAt >= INPUT.holdThresholdMs) {
      if (this.travel(active, active.lastX, active.lastY) >= INPUT.tapTravelPx) {
        active.state = "ignored";
      } else {
        active.state = "dash";
        holdAction.push({ type: "dash-start" });
      }
    }
    active.lastX = event.x;
    active.lastY = event.y;
    const swipeAction = this.lockDirection(active, event.x, event.y);
    if (event.type === "move") return swipeAction ? [swipeAction] : holdAction;

    const actions: GestureAction[] = swipeAction ? [swipeAction] : [...holdAction];
    if (active.state === "dash") actions.push({ type: "dash-end" });
    else if (active.state === "pending" && this.travel(active, event.x, event.y) < INPUT.tapTravelPx) {
      actions.push({ type: "jump" });
    }
    this.active = null;
    return actions;
  }

  private lockDirection(active: ActivePointer, x: number, y: number): GestureAction | null {
    if (active.state !== "pending" && active.state !== "swipe-pending") return null;
    const deltaX = x - active.startX;
    const deltaY = y - active.startY;
    if (Math.hypot(deltaX, deltaY) >= INPUT.swipeMinDistancePx) {
      if (Math.abs(deltaY) >= Math.abs(deltaX) * INPUT.swipeVerticalRatio) {
        active.state = deltaY < 0 ? "up" : "down";
        return { type: active.state === "up" ? "high-jump" : "crouch" };
      }
      active.state = "ignored";
      return null;
    }
    // Leaving the tap range rules out tap/hold, but a swipe may still continue.
    if (this.travel(active, x, y) > INPUT.tapTravelPx) active.state = "swipe-pending";
    return null;
  }

  private travel(active: ActivePointer, x: number, y: number): number {
    return Math.hypot(x - active.startX, y - active.startY);
  }
}
