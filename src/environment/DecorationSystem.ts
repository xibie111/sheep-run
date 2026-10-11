import type Phaser from "phaser";
import { ENVIRONMENT } from "../game/Constants";
import { DECORATION_CATALOG } from "./DecorationCatalog";
import type { DecorationDefinition } from "./DecorationCatalog";
import type { DecorationInstance } from "./types";
import { runViewportOrigin, viewportSizeFromScale } from "../game/Viewport";

interface DecorationImageLike {
  setDepth(depth: number): unknown;
  setScale(scale: number): unknown;
  setFlipX(flip: boolean): unknown;
  setTexture(texture: string): unknown;
  setVisible(visible: boolean): unknown;
  setPosition(x: number, y: number): unknown;
  setScrollFactor(factor: number): unknown;
  destroy(): unknown;
}

interface PooledImage {
  image: DecorationImageLike;
  instance: DecorationInstance;
  chunkX: number;
  speedFactor: number;
}

const LAYER_DEPTH: Record<DecorationDefinition["layer"], number> = {
  midground: -4,
  ground: 2,
  foreground: 4,
};

const LAYER_SPEED: Record<DecorationDefinition["layer"], number> = {
  midground: 0.4,
  ground: ENVIRONMENT.parallaxRatios.ground,
  foreground: ENVIRONMENT.parallaxRatios.foregroundGrass,
};

export interface DecorationSnapshot {
  active: number;
  pooled: number;
  allocated: number;
}

export class DecorationSystem {
  private readonly scene?: Phaser.Scene;
  private readonly activeByChunk = new Map<number, PooledImage[]>();
  private readonly pool: PooledImage[] = [];
  private allocated = 0;
  private destroyed = false;

  constructor(scene?: Phaser.Scene) {
    this.scene = scene;
  }

  attach(chunkIndex: number, chunkX: number, instances: readonly DecorationInstance[]): void {
    if (this.destroyed || !this.scene) return;
    this.detachChunk(chunkIndex);
    const entries: PooledImage[] = [];
    for (const instance of instances) {
      const definition = DECORATION_CATALOG.find((candidate) => candidate.id === instance.id);
      if (!definition || definition.collision !== false) continue;
      const pooled = this.pool.pop();
      const image = pooled?.image ?? this.createImage(definition, instance, chunkX);
      image.setTexture(definition.textureKey);
      image.setDepth(LAYER_DEPTH[definition.layer]);
      image.setScale(instance.scale);
      image.setFlipX(instance.flipX);
      image.setVisible(true);
      entries.push({ image, instance, chunkX, speedFactor: LAYER_SPEED[definition.layer] });
    }
    this.activeByChunk.set(chunkIndex, entries);
  }

  detachChunk(chunkIndex: number): void {
    const entries = this.activeByChunk.get(chunkIndex);
    if (!entries) return;
    this.activeByChunk.delete(chunkIndex);
    for (const entry of entries) {
      entry.image.setVisible(false);
      this.pool.push(entry);
    }
  }

  update(cameraLeft: number): void {
    if (this.destroyed) return;
    const size = viewportSizeFromScale(this.scene?.scale);
    const origin = runViewportOrigin(size);
    for (const entries of this.activeByChunk.values()) {
      for (const entry of entries) {
        const x = Math.round((entry.chunkX + entry.instance.x - cameraLeft) * entry.speedFactor) + origin.x;
        const visible = x >= -64 && x <= size.width + 64;
        entry.image.setPosition(x, entry.instance.y + origin.y);
        entry.image.setVisible(visible);
      }
    }
  }

  snapshot(): DecorationSnapshot {
    let active = 0;
    for (const entries of this.activeByChunk.values()) active += entries.length;
    return { active, pooled: this.pool.length, allocated: this.allocated };
  }

  destroy(): void {
    this.clear();
  }

  clear(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const entries of this.activeByChunk.values()) {
      for (const entry of entries) this.pool.push(entry);
    }
    this.activeByChunk.clear();
    for (const entry of this.pool) entry.image.destroy();
    this.pool.length = 0;
  }

  private createImage(definition: DecorationDefinition, instance: DecorationInstance, chunkX: number): DecorationImageLike {
    this.allocated += 1;
    const image = this.scene!.add.image(
      Math.round(chunkX + instance.x),
      instance.y,
      definition.textureKey,
    );
    image.setScrollFactor(0);
    return image;
  }
}
