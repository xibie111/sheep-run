import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { RESIDENT_ASSETS, RESIDENT_ROUTE_ART, prepareResidentTextures, validateResidentTextures } from './residentAssets';

describe('resident generated asset integrity', () => {
  it('ships every declared PNG at its required dimensions from an unchanged generated source', () => {
    const report = JSON.parse(readFileSync(new URL('../../assets/resident-stories-v1/processing.json', import.meta.url), 'utf8'));
    expect(new Set(RESIDENT_ASSETS.map(asset => asset.key)).size).toBe(46);
    expect(report.records).toHaveLength(RESIDENT_ASSETS.length);
    for (const asset of RESIDENT_ASSETS) {
      const bytes = readFileSync(new URL(asset.url));
      expect([...bytes.subarray(1, 4)]).toEqual([80, 78, 71]);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([asset.width, asset.height]);
      const name = new URL(asset.url).pathname.split('/').at(-1);
      const record = report.records.find((row: { output: string }) => row.output === 'runtime/' + name);
      expect(record).toBeDefined();
      const source = readFileSync(new URL('../../assets/resident-stories-v1/' + record.source, import.meta.url));
      expect(createHash('sha256').update(source).digest('hex')).toBe(record.sourceSha256);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(record.outputSha256);
      expect(record.uniformScale).toBe(true); expect(record.sampler).toBe('NEAREST');
    }
  });
  it('uses the approved menu-style redraw for every stage of the six new routes', () => {
    const report = JSON.parse(readFileSync(new URL('../../assets/resident-stories-v1/processing.json', import.meta.url), 'utf8'));
    for (const route of Object.values(RESIDENT_ROUTE_ART)) {
      for (const key of [route.start, route.middle, route.destination, route.ending, route.postcard]) {
        const asset = RESIDENT_ASSETS.find(item => item.key === key);
        expect(asset, key).toBeDefined();
        const name = new URL(asset!.url).pathname.split('/').at(-1);
        const record = report.records.find((row: { output: string }) => row.output === 'runtime/' + name);
        expect(record.source, key).toMatch(/^revision-menu-style\/sources\//);
      }
    }
  });
  it('refuses missing or wrong-size art and applies nearest filtering only after validation', () => {
    const filter = vi.fn(); let missing = true, wrongSize = false;
    const scene = { textures: {
      exists: (key: string) => !(missing && key === RESIDENT_ASSETS[0].key),
      get: (key: string) => { const asset = RESIDENT_ASSETS.find(item => item.key === key)!; return {
        getSourceImage: () => ({ width: asset.width + Number(wrongSize && key === RESIDENT_ASSETS[0].key), height: asset.height }), setFilter: filter,
      }; },
    } } as unknown as Phaser.Scene;
    expect(validateResidentTextures(scene)).toEqual([RESIDENT_ASSETS[0].key]);
    expect(() => prepareResidentTextures(scene)).toThrow('Resident textures invalid'); expect(filter).not.toHaveBeenCalled();
    missing = false; wrongSize = true;
    expect(validateResidentTextures(scene)).toEqual([RESIDENT_ASSETS[0].key]);
    wrongSize = false; prepareResidentTextures(scene);
    expect(filter).toHaveBeenCalledTimes(RESIDENT_ASSETS.length);
    expect(filter.mock.calls.every(([mode]) => mode === 1)).toBe(true);
  });
});
