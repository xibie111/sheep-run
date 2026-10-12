import type Phaser from 'phaser';
import type { LandscapeState } from '../ambient/AnimalRules';
import { runViewportOrigin, runViewportRight, type ViewportSize } from '../game/Viewport';
import { LANDMARKS, LANDMARK_RULES, type LandmarkDefinition, type LandmarkEncounter } from './landmarkCatalog';
import { LandmarkView, type LandmarkViewPort } from './LandmarkView';

/** Optional far fields allow future panoramas to provide their exact own offset. */
export interface LandmarkLandscapeState extends LandscapeState { farOffset?: number; farRatio?: number; }
export interface LandmarkUpdateContext {
  /** Real world distance in pixels, e.g. RunScene.distancePx, never score. */
  distance: number; deltaMs: number; viewport: ViewportSize; landscape: LandmarkLandscapeState;
  /** Animals, rare scenery, partner entrance/farewell, or important banners. */
  blocked: boolean; paused?: boolean;
}
export interface LandmarkControllerOptions {
  reducedMotion?: boolean;
  onEncounter?: (encounter: LandmarkEncounter) => void;
  createView?: (definition: LandmarkDefinition) => LandmarkViewPort;
}
interface Active {
  definition: LandmarkDefinition; view: LandmarkViewPort; x: number; offset: number;
  static: boolean; ageMs: number; exposureMs: number; recorded: boolean;
}
/** Visual-only route queue: no physics, timers, stores, input handlers, or RNG. */
export class LandmarkController {
  private active?: Active;
  private cursor = 0;
  private lastDistance = 0;
  private nextAllowedDistance = 0;
  private stopped = false;
  private readonly makeView: (definition: LandmarkDefinition) => LandmarkViewPort;
  private readonly encounters: LandmarkEncounter[] = [];
  constructor(private readonly scene: Phaser.Scene, private readonly options: LandmarkControllerOptions = {}) {
    this.makeView = options.createView ?? (definition => new LandmarkView(scene, definition));
  }
  get busy(): boolean { return !!this.active; }
  update(context: LandmarkUpdateContext): void {
    if (this.stopped || context.paused || this.scene.scene.isPaused() || !Number.isFinite(context.distance)
      || !Number.isFinite(context.deltaMs) || context.deltaMs < 0 || context.distance < this.lastDistance) return;
    const distance = Math.max(0, context.distance); this.lastDistance = distance;
    const delta = Math.min(100, context.deltaMs);
    const left = -runViewportOrigin(context.viewport).x, right = runViewportRight(context.viewport);
    if (this.active) {
      const active = this.active; active.ageMs += delta;
      const offset = this.offset(active.definition, context.landscape);
      // The unwrapped layer offset follows the same painted background. A
      // reduced-motion layer stays still; the static visit leaves by a soft fade.
      if (!active.static) { active.x -= offset - active.offset; active.offset = offset; }
      const exiting = active.static && active.ageMs > LANDMARK_RULES.staticVisitMs - LANDMARK_RULES.fadeMs;
      const alpha = exiting ? Math.max(0, (LANDMARK_RULES.staticVisitMs - active.ageMs) / LANDMARK_RULES.fadeMs) : 1;
      const rendered = active.view.consumeRendered();
      active.view.place({ x: active.x, alpha, tint: context.landscape.landTint, viewport: context.viewport });
      const fullVisible = active.x - active.definition.width / 2 >= left + 4 && active.x + active.definition.width / 2 <= right - 4;
      active.exposureMs = rendered && fullVisible && alpha >= .8 ? active.exposureMs + delta : 0;
      if (!active.recorded && active.exposureMs >= LANDMARK_RULES.exposureMs) {
        active.recorded = true;
        const encounter: LandmarkEncounter = { id: active.definition.id, title: active.definition.title, distance, theme: context.landscape.theme };
        this.encounters.push(encounter); this.options.onEncounter?.(encounter);
      }
      if (active.x + active.definition.width / 2 < left - 12 || (active.static && active.ageMs >= LANDMARK_RULES.staticVisitMs)) {
        active.view.destroy(); this.active = undefined;
        this.nextAllowedDistance = distance + LANDMARK_RULES.minimumGapDistance;
      }
      return;
    }
    const definition = LANDMARKS[this.cursor];
    if (!definition || context.blocked || distance < Math.max(definition.threshold, this.nextAllowedDistance)) return;
    const stationary = !!this.options.reducedMotion || context.landscape.nearRatio <= 0;
    const x = stationary ? left + context.viewport.width * .65 : right + definition.width / 2 + 8;
    const view = this.makeView(definition);
    this.active = { definition, view, x, offset: this.offset(definition, context.landscape), static: stationary,
      ageMs: 0, exposureMs: 0, recorded: false };
    this.cursor++;
    view.place({ x, alpha: 1, tint: context.landscape.landTint, viewport: context.viewport });
  }
  private offset(definition: LandmarkDefinition, land: LandmarkLandscapeState): number {
    if (definition.layer === 'near') return Number.isFinite(land.nearOffset) ? land.nearOffset : 0;
    if (Number.isFinite(land.farOffset)) return land.farOffset!;
    // Existing LandscapeState exposes the treeline only; both painted layers
    // are driven by the same distance, so derive the far ratio without game RNG.
    return land.nearRatio > 0 ? land.nearOffset / land.nearRatio * (land.farRatio ?? LANDMARK_RULES.farRatio) : 0;
  }
  snapshot() {
    return { id: this.active?.definition.id ?? null, x: this.active?.x ?? null, ageMs: this.active?.ageMs ?? 0,
      exposureMs: this.active?.exposureMs ?? 0, startedCount: this.cursor, stopped: this.stopped,
      encounters: this.encounters.map(item => ({ ...item })) };
  }
  clear(): void {
    if (this.stopped) return;
    this.stopped = true; this.active?.view.destroy(); this.active = undefined;
  }
}
