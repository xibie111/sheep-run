import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync('assets/windmill-physics-v1/manifest.json', 'utf8'));

describe('built-in generated windmill layers', () => {
  it('ships three independent packaged images with recorded source, prompt and runtime hashes', () => {
    expect(manifest.tool).toBe('built-in image_gen');
    expect(manifest.runtimeDependsOnExternalPaths).toBe(false);
    expect(manifest.assets.map((asset: { name: string }) => asset.name)).toEqual(['backdrop', 'windmill', 'grass']);
    const dimensions = [[960, 540], [400, 512], [960, 128]];
    for (const [index, asset] of manifest.assets.entries()) {
      const image = readFileSync(asset.runtime);
      expect(image.subarray(1, 4).toString()).toBe('PNG');
      expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual(dimensions[index]);
      expect(image[25]).toBe(6); // RGBA: transparency is retained rather than baked to a dark background.
      expect(sha256(image)).toBe(asset.runtimeSha256);
      expect(sha256(readFileSync(asset.source))).toBe(asset.sourceSha256);
      expect(sha256(readFileSync(asset.prompt))).toBe(asset.promptSha256);
      expect(asset.runtime).toContain('windmill-physics-v1');
    }
  });

  it('keeps the original reference intact and the extracted sprite supported at its bottom baseline', () => {
    expect(sha256(readFileSync(manifest.reference))).toBe(manifest.referenceSha256);
    for (const asset of manifest.assets.slice(1)) {
      expect(asset.groundBaseline).toBe(asset.size[1]);
      expect(asset.alphaTrim).toHaveLength(4);
      expect(asset.alpha).toContain('hard 0/255');
      expect(asset.fitted[1]).toBeLessThanOrEqual(asset.size[1]);
      expect(asset.uniformScale).toBeGreaterThan(0);
    }
  });
});
