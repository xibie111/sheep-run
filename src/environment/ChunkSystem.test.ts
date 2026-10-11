import { describe, expect, it } from "vitest";
import { ENVIRONMENT } from "../game/Constants";
import { ChunkSystem } from "./ChunkSystem";

describe("ChunkSystem", () => {
  it("creates stable 480px visual chunks and retains the requested camera window", () => {
    const chunks = new ChunkSystem();
    const visible = chunks.ensureChunks(1000);

    expect(visible.map((chunk) => chunk.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(visible[0]).toMatchObject({ x: 0, width: ENVIRONMENT.chunkWidthPx });
    expect(chunks.ensureChunks(1000).map((chunk) => chunk.index)).toEqual(visible.map((chunk) => chunk.index));
    expect(chunks.snapshot()).toMatchObject({ generated: 6, allocated: 6, active: 6, recycled: 0, pooled: 0 });
    chunks.clear();
  });

  it("recycles behind chunks and never grows past six resident chunks", () => {
    const chunks = new ChunkSystem();
    chunks.ensureChunks(1000);
    const shifted = chunks.ensureChunks(1000 + ENVIRONMENT.chunkWidthPx * 5);
    expect(shifted.map((chunk) => chunk.index)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(chunks.snapshot()).toMatchObject({ generated: 11, allocated: 6, active: 6, recycled: 5, pooled: 0 });
    expect(chunks.ensureChunks(1000 + ENVIRONMENT.chunkWidthPx * 5).map((chunk) => chunk.index)).toEqual(shifted.map((chunk) => chunk.index));
  });

  it("recycles by the left camera edge while retaining the current and forward window", () => {
    const chunks = new ChunkSystem();
    chunks.ensureChunks(2000);
    chunks.recycleChunks(ENVIRONMENT.chunkWidthPx * 5);
    expect(chunks.snapshot().active).toBeLessThanOrEqual(ENVIRONMENT.maxChunks);
    expect(chunks.snapshot().recycled).toBe(2);
  });
});
