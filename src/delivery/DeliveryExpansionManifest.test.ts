import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_EXPANSION_RUNTIME_ASSETS, prepareDeliveryExpansionRuntime, validateDeliveryExpansionRuntime } from './DeliveryExpansionManifest';
import { readFileSync } from 'node:fs';

const textures = (missing = '', wrong = '') => {
  const filter = vi.fn();
  return {filter,scene:{textures:{exists:(key:string)=>key!==missing,get:(key:string)=>{
    const asset=DELIVERY_EXPANSION_RUNTIME_ASSETS.find(item=>item.key===key)!;
    return {getSourceImage:()=>({width:key===wrong?1:asset.width,height:asset.height}),setFilter:filter};
  }}}};
};
describe('delivery expansion atomic preload contract',()=>{
  it('uses 36 separate versioned runtime assets, never reference screens or generated paths',()=>{
    expect(DELIVERY_EXPANSION_RUNTIME_ASSETS).toHaveLength(36);
    expect(new Set(DELIVERY_EXPANSION_RUNTIME_ASSETS.map(asset=>asset.key)).size).toBe(36);
    const restyledChapterKeys = new Set(['windmill', 'rain', 'lighthouse'].flatMap(theme =>
      ['pasture', 'middle', 'destination', 'ending', 'postcard'].map(stage => `delivery-expansion-${theme}-${stage}`)));
    for(const asset of DELIVERY_EXPANSION_RUNTIME_ASSETS){
      expect(asset.url).toContain(restyledChapterKeys.has(asset.key)
        ? '/assets/delivery-menu-style-v2/runtime/' : '/assets/delivery-expansion-v1/');
      expect(asset.url).toContain('/runtime/');expect(asset.url).not.toMatch(/reference|sources|generated_images/);
    }
  });
  it.each(DELIVERY_EXPANSION_RUNTIME_ASSETS.map(asset=>asset.key))('reports absent or wrong dimensions for %s and refuses partial preparation',key=>{
    const absent=textures(key),corrupt=textures('',key);
    expect(validateDeliveryExpansionRuntime(absent.scene as never)).toContain(key);
    expect(validateDeliveryExpansionRuntime(corrupt.scene as never)).toContain(key);
    expect(()=>prepareDeliveryExpansionRuntime(absent.scene as never)).toThrow(key);
    expect(absent.filter).not.toHaveBeenCalled();
  });
  it('successful retry prepares every source using the installed Phaser NEAREST constant',()=>{
    const phaserConstants=readFileSync(new URL('../../node_modules/phaser/src/textures/const.js',import.meta.url),'utf8');
    const nearest=Number(phaserConstants.match(/NEAREST:\s*(\d+)/)![1]);
    const f=textures();prepareDeliveryExpansionRuntime(f.scene as never);prepareDeliveryExpansionRuntime(f.scene as never);
    expect(f.filter).toHaveBeenCalledTimes(72);expect(f.filter.mock.calls.every(args=>args[0]===nearest)).toBe(true);
  });
});
