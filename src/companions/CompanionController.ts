import type Phaser from "phaser";
import type { SkinId } from "../data/sheepSkins";
import type { Obstacle } from "../entities/Obstacle";
import type { SpawnRequest } from "../systems/SpawnSystemOwner";
import { runViewportOrigin, runViewportRight, type ViewportSize } from "../game/Viewport";
import { BellScheduler } from "./BellScheduler";
import { BellView } from "./BellView";
import { CompanionView } from "./CompanionView";
import { chooseCompanionSkin, companionSeed, COMPANION_RULES as RULES } from "./CompanionRules";
import { isSafeBellGap, rectanglesOverlap, type Rect } from "./BellGap";
import type { LeadPose } from "./CompanionPose";

interface CompanionOptions {
  lead: LeadPose & { readonly body: unknown };
  leadSkin: SkinId;
  unlockedSkins: () => readonly unknown[];
  playBell: () => void;
  onSummoned?: (skin: SkinId) => void;
  jumpImpulseMultiplier: number;
  reducedMotion: boolean;
  seed?: number;
}
interface UpdateContext {
  nowMs: number; deltaSeconds: number; speed: number; viewport: ViewportSize;
  obstacles: readonly Obstacle[]; pickups: readonly Rect[];
}

/** Owns all companion state and artwork, without touching original pools or rewards. */
export class CompanionController {
  readonly scheduler: BellScheduler;
  private bell: BellView | null = null;
  private companion: CompanionView | null = null;
  private lastObstacle: Obstacle | null = null;
  private patternEnded = false;
  private disposed = false;
  private nowMs = 0;
  private recordNotified = false;
  private pendingRecord = false;
  constructor(private readonly scene: Phaser.Scene, private readonly options: CompanionOptions) {
    this.scheduler = new BellScheduler(options.seed ?? companionSeed());
  }
  observeObstacleSpawn(request: Extract<SpawnRequest, { type: "obstacle" }>, obstacle: Obstacle | null): void {
    this.patternEnded = request.pattern.index === request.pattern.length - 1;
    this.lastObstacle = obstacle;
  }
  update(context: UpdateContext): void {
    if (this.disposed) return;
    const { nowMs, deltaSeconds, speed, viewport } = context;
    this.nowMs = nowMs;
    const viewportLeft = -runViewportOrigin(viewport).x;
    if (this.companion) {
      if (this.companion.update(nowMs, this.options.lead, viewportLeft)) { this.companion = null; this.scheduler.departed(nowMs); }
      return;
    }
    if (this.bell) {
      this.bell.update(nowMs, deltaSeconds, speed);
      const body = this.options.lead.body as { x: number; y: number; width: number; height: number };
      if (rectanglesOverlap(this.bell.bounds, body) && this.scheduler.collect()) {
        this.bell.destroy(); this.bell = null;
        const skin = chooseCompanionSkin(this.options.unlockedSkins(), this.options.leadSkin, this.scheduler.randomSkin);
        this.companion = new CompanionView(this.scene, skin, nowMs, this.options.reducedMotion);
        if (this.pendingRecord) { this.companion.respond("crown", nowMs); this.pendingRecord = false; }
        this.companion.update(nowMs, this.options.lead, viewportLeft);
        this.options.playBell();
        this.options.onSummoned?.(skin);
      } else if (this.bell.image.x + RULES.bellWidth / 2 < viewportLeft + RULES.recycleX) {
        this.bell.destroy(); this.bell = null; this.scheduler.missed(nowMs);
      }
      return;
    }
    if (this.scheduler.state !== "waiting" || nowMs < this.scheduler.nextEligibleAtMs) return;
    const obstacleBounds = (obstacle: Obstacle) => ({ left: obstacle.x, right: obstacle.rightEdge, kind: obstacle.definition.kind });
    const spawnX = runViewportRight(viewport) + 14;
    const safe = isSafeBellGap({ spawnX, speed, jumpImpulseMultiplier: this.options.jumpImpulseMultiplier, patternEnded: this.patternEnded,
      lastObstacle: this.lastObstacle ? obstacleBounds(this.lastObstacle) : null,
      obstacles: context.obstacles.filter(obstacle => obstacle.active).map(obstacleBounds), pickups: context.pickups });
    if (this.scheduler.trySpawn(nowMs, safe)) this.bell = new BellView(this.scene, spawnX, this.options.reducedMotion);
  }
  /** A completed real star route can only be celebrated by a currently present friend. */
  notifyStarGroup(): void {
    if (!this.disposed) this.companion?.respond("star", this.nowMs);
  }
  /** RunScene supplies its once-run score crossing; additionally guard duplicate notifications here. */
  notifyRecord(): void {
    if (this.disposed || this.recordNotified) return;
    this.recordNotified = true;
    if (this.companion) this.companion.respond("crown", this.nowMs);
    else this.pendingRecord = true;
  }
  clear(): void {
    if (this.disposed) return;
    this.disposed = true; this.scheduler.stop();
    this.pendingRecord = false;
    this.bell?.destroy(); this.companion?.destroy(); this.bell = null; this.companion = null; this.lastObstacle = null;
  }
}
