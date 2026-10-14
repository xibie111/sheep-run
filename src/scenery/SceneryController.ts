import type Phaser from 'phaser';
import type { LandscapeState } from '../ambient/AnimalRules';
import { sceneEventSeed } from '../ambient/SceneEventScheduler';
import type { ViewportSize } from '../game/Viewport';
import { SceneryExposure, ScenerySchedule, SCENERY_RULES } from './ScenerySchedule';
import { SceneryView } from './SceneryView';
import { sceneryStore, type SceneryStore } from './SceneryStore';
import { sceneryCard } from './sceneryCatalog';

interface Context { nowMs: number; deltaMs: number; landscape: LandscapeState; viewport: ViewportSize; blocked: boolean; }
export class SceneryController {
  private readonly schedule: ScenerySchedule;
  private active?: { view: SceneryView; start: number; exposure: SceneryExposure };
  private stopped = false;
  private lastNow = 0;
  private readonly seenIds: readonly string[];
  constructor(private readonly scene: Phaser.Scene, private readonly reduced: boolean, private readonly notify: (message: string) => void,
    private readonly store: SceneryStore = sceneryStore, seed = sceneEventSeed()) {
    this.schedule = new ScenerySchedule(seed); this.seenIds = store.load().seenIds;
  }
  get busy(): boolean { return !!this.active; }
  update(ctx: Context): void {
    if (this.stopped || this.scene.scene.isPaused() || !Number.isFinite(ctx.nowMs)) return;
    this.lastNow = ctx.nowMs;
    if (this.active) {
      const { view, start, exposure } = this.active, age = ctx.nowMs - start;
      const valid = view.id === 'rainbow-v1' ? ctx.landscape.weather === 'sunny' && ctx.landscape.dayPhase !== 'night'
        : view.id === 'meteors-v1' ? ctx.landscape.dayPhase === 'night' && (ctx.landscape.weather !== 'rain' || ctx.landscape.weatherAlpha < .15)
        : ctx.landscape.theme !== 'winter' && ['sunset', 'night'].includes(ctx.landscape.dayPhase) && (ctx.landscape.weather !== 'rain' || ctx.landscape.weatherAlpha < .15);
      if (age >= SCENERY_RULES.durationMs || !valid) {
        view.destroy(); this.active = undefined;
        this.schedule.finish(ctx.nowMs, exposure.complete); return;
      }
      if (exposure.observe(ctx.deltaMs, view.update(age, ctx.viewport, ctx.landscape))) {
        const result = this.store.discover(view.id);
        if (result.added) this.notify(`遇见了${sceneryCard(view.id).title}，明信片已收好。`);
        if (!result.saved) this.notify('明信片暂未保存，本次仍可查看');
      }
      return;
    }
    const id = this.schedule.choose(ctx.nowMs, ctx.landscape, ctx.blocked, this.seenIds);
    if (!id) return;
    const view = new SceneryView(this.scene, id, this.reduced);
    this.active = { view, start: ctx.nowMs, exposure: new SceneryExposure() }; view.update(0, ctx.viewport, ctx.landscape);
  }
  snapshot() { return { id: this.active?.view.id ?? null, ageMs: this.active ? this.lastNow - this.active.start : 0, stopped: this.stopped }; }
  clear(): void { this.stopped = true; this.schedule.stop(); this.active?.view.destroy(); this.active = undefined; }
}
