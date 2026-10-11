import { ENVIRONMENT, WORLD } from "../game/Constants";
import { generateDecorationPattern } from "./DecorationCatalog";
import type { EnvironmentChunk, ThemeId } from "./types";

export type ThemeAtDistance = (distancePx: number) => ThemeId;

export interface ChunkSnapshot {
  generated: number;
  allocated: number;
  active: number;
  recycled: number;
  pooled: number;
}

export class ChunkSystem {
  private readonly active = new Map<number, EnvironmentChunk>();
  private readonly pool: EnvironmentChunk[] = [];
  private readonly seed: number;
  private generated = 0;
  private allocated = 0;
  private recycled = 0;

  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }

  ensureChunks(cameraRight: number, cameraLeft = Math.max(0, cameraRight - WORLD.width), themeAt: ThemeAtDistance = () => "spring"): readonly EnvironmentChunk[] {
    const width = ENVIRONMENT.chunkWidthPx;
    const minIndex = Math.max(0, Math.floor(Math.max(0, cameraLeft) / width) - ENVIRONMENT.chunksBehind);
    const maxIndex = Math.max(minIndex, Math.floor(Math.max(0, cameraRight) / width) + ENVIRONMENT.chunksAhead);
    const boundedMax = Math.min(maxIndex, minIndex + ENVIRONMENT.maxChunks - 1);
    const desired = new Set<number>();
    for (let index = minIndex; index <= boundedMax; index += 1) desired.add(index);

    for (const [index, chunk] of this.active) {
      if (desired.has(index)) continue;
      this.active.delete(index);
      this.recycled += 1;
      this.pool.push(chunk);
    }

    for (const index of desired) {
      const distance = index * width;
      const themeId = themeAt(distance);
      const resident = this.active.get(index);
      if (resident) {
        if (resident.themeId !== themeId) {
          resident.themeId = themeId;
          resident.decorations = generateDecorationPattern(this.seed, index, themeId);
          this.generated += 1;
        }
        continue;
      }
      const chunk = this.pool.pop() ?? this.allocate();
      chunk.index = index;
      chunk.x = index * width;
      chunk.width = width;
      chunk.themeId = themeId;
      chunk.decorations = generateDecorationPattern(this.seed, index, themeId);
      this.generated += 1;
      this.active.set(index, chunk);
    }

    return [...this.active.values()].sort((left, right) => left.index - right.index);
  }

  recycleChunks(cameraLeft: number): void {
    const minIndex = Math.max(0, Math.floor(Math.max(0, cameraLeft) / ENVIRONMENT.chunkWidthPx) - ENVIRONMENT.chunksBehind);
    for (const [index, chunk] of this.active) {
      if (index >= minIndex) continue;
      this.active.delete(index);
      this.recycled += 1;
      this.pool.push(chunk);
    }
  }

  chunks(): readonly EnvironmentChunk[] {
    return [...this.active.values()].sort((left, right) => left.index - right.index);
  }

  snapshot(): ChunkSnapshot {
    return { generated: this.generated, allocated: this.allocated, active: this.active.size, recycled: this.recycled, pooled: this.pool.length };
  }

  clear(): void {
    for (const chunk of this.active.values()) this.pool.push(chunk);
    this.recycled += this.active.size;
    this.active.clear();
    this.pool.length = 0;
  }

  private allocate(): EnvironmentChunk {
    this.allocated += 1;
    return { index: 0, x: 0, width: ENVIRONMENT.chunkWidthPx, themeId: "spring", decorations: [] };
  }
}
