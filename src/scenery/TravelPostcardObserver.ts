import type Phaser from 'phaser';
import type { AnimalEventId, LandscapeState } from '../ambient/AnimalRules';
import { ANIMAL_TEXTURE } from '../ambient/animalAssets';
import { seasonLayerKey } from '../data/seasonArtAssets';
import type { ViewportSize } from '../game/Viewport';
import { sceneryStore, type SceneryStore } from './SceneryStore';
import { sceneryCard } from './sceneryCatalog';

export const TRAVEL_POSTCARD_VISIBLE_MS = 1_500;
export const TRAVEL_POSTCARD_IDS = [
  'spring-pasture-v1', 'summer-pond-v1', 'autumn-sunset-v1', 'winter-sunshine-v1',
  'duck-outing-v1', 'butterfly-path-v1',
] as const;
export type TravelPostcardId = typeof TRAVEL_POSTCARD_IDS[number];

export interface TravelPostcardFacts {
  landscape: LandscapeState;
  backgroundVisible: boolean;
  pondVisible: boolean;
  duckFamilyVisible: boolean;
  butterflyPairVisible: boolean;
}
export interface TravelPostcardContext {
  deltaMs: number;
  landscape: LandscapeState;
  viewport: ViewportSize;
  animalKind?: AnimalEventId | string | null;
  paused?: boolean;
}

/** Observation rules only: no scheduling, random values, game objects or rewards. */
export function visibleTravelPostcards(facts: TravelPostcardFacts): readonly TravelPostcardId[] {
  const { landscape: land } = facts;
  const daylight = land.dayPhase === 'morning' || land.dayPhase === 'afternoon';
  const dry = land.weather !== 'rain' || land.weatherAlpha < .15;
  const ids: TravelPostcardId[] = [];
  if (facts.backgroundVisible) {
    if (land.theme === 'spring' && daylight && dry) ids.push('spring-pasture-v1');
    if (land.theme === 'summer' && daylight && dry && facts.pondVisible) ids.push('summer-pond-v1');
    if (land.theme === 'autumn' && land.dayPhase === 'sunset' && dry) ids.push('autumn-sunset-v1');
    if (land.theme === 'winter' && daylight && land.weather === 'sunny') ids.push('winter-sunshine-v1');
  }
  if (facts.duckFamilyVisible) ids.push('duck-outing-v1');
  if (facts.butterflyPairVisible) ids.push('butterfly-path-v1');
  return ids;
}

/** A pause freezes exposure; an actually hidden/cropped frame breaks continuity. */
export class TravelPostcardExposure {
  private readonly elapsed = new Map<TravelPostcardId, number>();
  private readonly completed = new Set<TravelPostcardId>();
  private stopped = false;
  observe(deltaMs: number, visibleIds: readonly TravelPostcardId[], paused = false): TravelPostcardId | null {
    if (this.stopped || paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return null;
    const delta = Math.min(100, deltaMs);
    for (const id of TRAVEL_POSTCARD_IDS) {
      if (this.completed.has(id)) continue;
      this.elapsed.set(id, visibleIds.includes(id) ? (this.elapsed.get(id) ?? 0) + delta : 0);
    }
    // A second ready observation must remain genuinely visible next frame.
    // It is never carried into a later scene or emitted as a second toast here.
    const ready = TRAVEL_POSTCARD_IDS.find(id => !this.completed.has(id) && (this.elapsed.get(id) ?? 0) >= TRAVEL_POSTCARD_VISIBLE_MS);
    if (!ready) return null;
    this.completed.add(ready); return ready;
  }
  hide(): void { this.elapsed.clear(); }
  clear(): void { this.stopped = true; this.elapsed.clear(); }
}

type DisplayObject = Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;

/** Reads only objects the actual main-camera renderer submitted this frame. */
export class TravelPostcardObserver {
  private readonly exposure = new TravelPostcardExposure();
  private pending?: TravelPostcardContext;
  private stopped = false;
  private readonly listening: boolean;
  private readonly afterRender = (): void => {
    if (this.stopped || !this.pending) return;
    const context = this.pending; this.pending = undefined;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { this.exposure.hide(); return; }
    if (context.paused || this.scene.scene?.isPaused?.()) return;
    const camera = this.scene.cameras?.main;
    const canvas = this.scene.game?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    if (!this.scene.scene?.isActive?.() || !this.scene.scene?.isVisible?.() || !camera || camera.visible === false || camera.alpha < .6 ||
      !rect || rect.width <= 0 || rect.height <= 0 || !Array.isArray(this.scene.children?.list) || !Array.isArray(camera.renderList)) {
      this.exposure.hide(); return;
    }
    const rendered = new Set(camera.renderList);
    const visible = (object: Phaser.GameObjects.GameObject): object is DisplayObject => {
      const image = object as DisplayObject;
      if (!rendered.has(object) || !image.active || !image.visible || image.alpha < .6 || typeof image.getBounds !== 'function') return false;
      const bounds = image.getBounds(), x = camera.scrollX * (image.scrollFactorX ?? 1), y = camera.scrollY * (image.scrollFactorY ?? 1);
      const epsilon = .001;
      return bounds.width > 0 && bounds.height > 0 && [bounds.x, bounds.y, bounds.right, bounds.bottom, x, y].every(Number.isFinite) &&
        bounds.x - x >= -epsilon && bounds.right - x <= context.viewport.width + epsilon &&
        bounds.y - y >= -epsilon && bounds.bottom - y <= context.viewport.height + epsilon;
    };
    const objects = this.scene.children.list.filter(visible);
    const named = (name: string): boolean => objects.some(object => object.name === `ambient-life:${name}` && object.texture?.key === ANIMAL_TEXTURE);
    const seasonal = (slot: string): boolean => objects.some(object => object.texture?.key === seasonLayerKey(context.landscape.theme, slot));
    const facts: TravelPostcardFacts = {
      landscape: context.landscape,
      backgroundVisible: seasonal('pasture-far-mountain') && seasonal('pasture-treeline'),
      pondVisible: named('pond'),
      duckFamilyVisible: context.animalKind === 'duck-family' && named('mother') && [1, 2, 3].every(index => named(`duckling-${index}`)),
      butterflyPairVisible: context.animalKind === 'rabbit-butterfly' && named('rabbit') && named('butterfly'),
    };
    const id = this.exposure.observe(context.deltaMs, visibleTravelPostcards(facts));
    if (!id) return;
    const result = this.store.discover(id);
    if (result.added) this.notify(result.saved ? `遇见了${sceneryCard(id).title}，明信片已收好。` : '明信片暂未保存，本次仍可查看');
  };
  constructor(private readonly scene: Phaser.Scene, private readonly notify: (message: string) => void,
    private readonly store: Pick<SceneryStore, 'discover'> = sceneryStore) {
    this.listening = !!scene.game?.events?.on && !!scene.game?.events?.off;
    if (this.listening) scene.game.events.on('postrender', this.afterRender);
  }
  update(context: TravelPostcardContext): void {
    if (this.stopped || !this.listening) return;
    if (context.paused || this.scene.scene?.isPaused?.() || !Number.isFinite(context.deltaMs) || context.deltaMs <= 0) {
      this.pending = undefined; return;
    }
    // Snapshot presentation state for this pass; do not retain mutable scene state.
    this.pending = { ...context, landscape: { ...context.landscape },
      viewport: { width: context.viewport.width, height: context.viewport.height } };
  }
  clear(): void {
    if (this.stopped) return;
    this.stopped = true; this.pending = undefined; this.exposure.clear();
    if (this.listening) this.scene.game.events.off('postrender', this.afterRender);
  }
}
