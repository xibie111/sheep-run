import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DELIVERY_EXPANSION_ASSETS, prepareDeliveryExpansionTextures, validateDeliveryExpansionTextures } from './DeliveryExpansionAssets';
import { DELIVERY_CHAPTERS } from './DeliveryChapters';
import { DeliveryRoute } from './DeliveryRoute';
import { DeliveryView } from './DeliveryView';
import { runViewportOrigin } from '../game/Viewport';
vi.mock('../companions/CompanionView', () => ({ CompanionView: class { update() { return false; } destroy() {} } }));

class Display {
  x = 0; y = 0; width = 960; height = 540; scaleX = 1; scaleY = 1; alpha = 1; visible = true;
  name = ''; destroyed = false; tileScaleX = 1; tileScaleY = 1; tilePositionX = 0; depth = 0;
  texture: any;
  constructor(readonly key: string, readonly sources: Map<string, any>) {
    this.texture = sources.get(key) ?? { getSourceImage: () => ({ width: 960, height: 540 }), has: () => false, add: vi.fn() };
    const source = this.texture.getSourceImage(); this.width = source.width; this.height = source.height;
  }
  get displayWidth() { return this.width * this.scaleX; }
  get displayHeight() { return this.height * this.scaleY; }
  setPosition(x: number, y: number) { this.x=x; this.y=y; return this; }
  setX(x: number) { this.x=x; return this; }
  setScale(x: number,y=x) { this.scaleX=x; this.scaleY=y; return this; }
  setDisplaySize(w: number,h: number) { this.scaleX=w/this.width; this.scaleY=h/this.height; return this; }
  setSize(w: number,h: number) { this.width=w; this.height=h; return this; }
  setAlpha(a: number) { this.alpha=a; return this; }
  setVisible(v: boolean) { this.visible=v; return this; }
  setName(n: string) { this.name=n; return this; }
  setDepth(d: number) { this.depth=d; return this; }
  setOrigin() { return this; } setScrollFactor() { return this; } setCrop() { return this; }
  fillStyle() { return this; } fillRect() { return this; } play() { return this; }
  destroy() { this.destroyed=true; }
}
function fixture(width=480,height=270) {
  const sources = new Map<string, any>();
  for (const asset of DELIVERY_EXPANSION_ASSETS) sources.set(asset.key, {
    getSourceImage: () => ({ width:asset.width,height:asset.height }), has: () => false, add:vi.fn(), setFilter:vi.fn(),
  });
  for (const key of ['delivery-forest-v1','delivery-hill-v1','delivery-postcard-v1',
    'content-v2-delivery-dusk-pasture','content-v2-delivery-field','content-v2-delivery-cottage',
    'content-v2-delivery-dinner-ending','content-v2-delivery-lunchbox']) sources.set(key, {
    getSourceImage: () => ({width:960,height:540}),has:()=>false,add:vi.fn(),setFilter:vi.fn(),
  });
  const records:Display[]=[];
  const create = (key='graphics') => { const item=new Display(key,sources); records.push(item); return item; };
  const scale = Object.assign(new EventEmitter(), {gameSize:{width,height}});
  const events=new EventEmitter();
  const scene:any={ scale,events,textures:{exists:(key:string)=>sources.has(key),get:(key:string)=>sources.get(key)},
    add:{image:(_x:number,_y:number,key:string)=>create(key),tileSprite:(_x:number,_y:number,_w:number,_h:number,key:string)=>create(key),
      graphics:()=>create(),rectangle:()=>create(),sprite:(_x:number,_y:number,key:string)=>create(key)}};
  const lead:any={x:100,y:207,displayWidth:48,displayHeight:42,motionState:'RUN',setVisible:vi.fn()};
  return {scene,lead,sources,records,scale,events};
}
describe('generated delivery expansion art',()=>{
  it('has 24 unique self-contained PNG files with the declared dimensions',()=>{
    expect(new Set(DELIVERY_EXPANSION_ASSETS.map(a=>a.key)).size).toBe(24);
    for(const asset of DELIVERY_EXPANSION_ASSETS){
      const name=asset.key.replace('delivery-expansion-','');
      const png=readFileSync(`assets/delivery-expansion-v1/chapters/runtime/${name}.png`);
      expect(png.subarray(1,4).toString()).toBe('PNG');
      expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([asset.width,asset.height]);
    }
  });
  it('all new chapter configured art resolves to this manifest',()=>{
    const keys=new Set<string>(DELIVERY_EXPANSION_ASSETS.map(a=>a.key));
    for(const chapter of DELIVERY_CHAPTERS.filter(c=>c.challenge)) {
      for(const key of [...chapter.landscapes.map(l=>l.key),chapter.previewKey,chapter.endingKey,chapter.postcardKey,chapter.accessoryKey!]) expect(keys.has(key)).toBe(true);
    }
  });
  it('reports missing and wrong-size assets for retry and refuses partial preparation',()=>{
    const {scene,sources}=fixture();
    sources.delete(DELIVERY_EXPANSION_ASSETS[0].key);
    sources.get(DELIVERY_EXPANSION_ASSETS[1].key).getSourceImage=()=>({width:1,height:1});
    expect(validateDeliveryExpansionTextures(scene)).toEqual([DELIVERY_EXPANSION_ASSETS[0].key,DELIVERY_EXPANSION_ASSETS[1].key]);
    expect(()=>prepareDeliveryExpansionTextures(scene)).toThrow('invalid');
    expect(sources.get(DELIVERY_EXPANSION_ASSETS[2].key).setFilter).not.toHaveBeenCalled();
  });
  it('prepares exactly the generated art with Phaser NEAREST=1',()=>{
    const {scene,sources}=fixture();prepareDeliveryExpansionTextures(scene);
    for(const asset of DELIVERY_EXPANSION_ASSETS) expect(sources.get(asset.key).setFilter).toHaveBeenCalledWith(1);
    expect(sources.get('delivery-hill-v1').setFilter).not.toHaveBeenCalled();
  });
});
describe.each(DELIVERY_CHAPTERS.map(c=>[c.id] as const))('DeliveryView lifecycle %s',id=>{
  it('retains uniform backgrounds/carried art, ending and idempotent cleanup',()=>{
    const f=fixture(585,270),chapter=DELIVERY_CHAPTERS.find(c=>c.id===id)!;
    const view=new DeliveryView(f.scene,f.lead,'white',false,id),route=new DeliveryRoute(id);
    route.distance=chapter.destinationAt;view.update(route,1000);
    const backgrounds=f.records.filter(r=>chapter.landscapes.some(l=>l.key===r.key)&&r.depth===-9.5);
    backgrounds.forEach(image=>expect(image.scaleX).toBe(image.scaleY));
    if(chapter.challenge) {
      const carried=f.records.find(r=>r.name==='delivery-carried-item')!;
      expect(carried.key).toBe(chapter.accessoryKey);expect(carried.scaleX).toBe(carried.scaleY);
      expect(Math.max(carried.displayWidth,carried.displayHeight)).toBeLessThanOrEqual(20);
      expect(f.records.find(r=>r.name==='delivery-destination')!.visible).toBe(true);
    }
    route.state='ending';route.endingMs=1800;view.update(route,3000);
    const ending=f.records.find(r=>r.key===chapter.endingKey&&r.depth===20)!;
    expect(ending.alpha).toBe(1);expect(ending.scaleX).toBe(ending.scaleY);
    view.update(route,999999);expect(ending.alpha).toBe(1); // visual clock is effective route time
    view.clear();view.clear();expect(f.records.every(r=>r.destroyed)).toBe(true);
    expect(f.scale.listenerCount('resize')).toBe(0);expect(f.events.listenerCount('shutdown')).toBe(0);
    view.update(route,1000000);expect(f.records.every(r=>r.destroyed)).toBe(true);
  });
});
describe('expanded route art high viewport',()=>{
  it.each(DELIVERY_CHAPTERS.filter(chapter=>chapter.challenge).flatMap(chapter=>[false,true].map(reducedMotion=>[chapter.id,reducedMotion] as const)))
    ('keeps the right-side destination visible in tall viewport for %s reducedMotion=%s',(id,reducedMotion)=>{
      const f=fixture(480,360),chapter=DELIVERY_CHAPTERS.find(c=>c.id===id)!;
      const view=new DeliveryView(f.scene,f.lead,'white',reducedMotion,id);
      const destination=f.records.find(r=>r.key===chapter.landscapes[2].key&&r.depth===-9.5)!;
      const checkRightEdge=()=>{
        const origin=runViewportOrigin(f.scale.gameSize);
        expect(destination.x+destination.displayWidth/2+origin.x).toBeCloseTo(f.scale.gameSize.width,8);
      };
      checkRightEdge(); // focal point also holds before the first update
      const route=new DeliveryRoute(id);
      for(const distance of [chapter.landscapes[2].transitionStart,chapter.destinationAt,chapter.length]){
        route.distance=distance;view.update(route,1000);checkRightEdge();
      }
      if(id==='lighthouse-starlight-v1'){
        // The actual lighthouse tower occupies source x798..853 in this960px PNG.
        // Its complete silhouette must remain inside the visible horizontal span.
        const left=destination.x-destination.displayWidth/2;
        expect(left+798*destination.scaleX).toBeGreaterThan(0);
        expect(left+853*destination.scaleX).toBeLessThan(480);
      }
      const road=f.records.find(r=>r.key===chapter.landscapes[2].key&&r.depth===-9.4)!;
      expect(road.y).toBe(258);expect(road.tileScaleX).toBe(road.tileScaleY);
      f.scale.gameSize={width:585,height:360};f.scale.emit('resize');checkRightEdge();
      view.clear();
    });
  it.each(['hill-goodnight-v1','dinner-for-you-v1'] as const)
    ('preserves old unfocused pan and reduced-motion centering for %s',id=>{
      for(const reducedMotion of [false,true]){
        const f=fixture(480,360),view=new DeliveryView(f.scene,f.lead,'white',reducedMotion,id);
        const chapter=DELIVERY_CHAPTERS.find(c=>c.id===id)!;
        const image=f.records.find(r=>r.key===chapter.landscapes[0].key&&r.depth===-9.5)!;
        const route=new DeliveryRoute(id);route.distance=0;view.update(route,0);
        expect(image.x).toBeCloseTo(reducedMotion?240:285,8);
        route.distance=chapter.length;view.update(route,1000);
        expect(image.x).toBeCloseTo(reducedMotion?240:195,8);
        view.clear();
      }
    });
  it.each([480,585])('covers a taller %spx viewport without a vertically repeated road strip',width=>{
    const f=fixture(width,360);const view=new DeliveryView(f.scene,f.lead,'white',true,'rainy-umbrella-v1');
    for(const road of f.records.filter(r=>r.depth===-9.4)) {
      const source=road.texture.getSourceImage();
      expect((source.height-Math.round(source.height*.72))*road.tileScaleY).toBeGreaterThanOrEqual(road.height);
      expect(road.tileScaleX).toBe(road.tileScaleY);
    }
    const route=new DeliveryRoute('rainy-umbrella-v1');route.state='ending';route.endingMs=1500;view.update(route,1500);
    const ending=f.records.find(r=>r.name==='delivery-ending-umbrella')!;expect(ending.alpha).toBe(0);
    route.endingMs=1600;view.update(route,1600);expect(ending.alpha).toBe(1);
    view.clear();
  });
  it('invalid IDs safely preserve original default view art',()=>{
    const f=fixture();const view=new DeliveryView(f.scene,f.lead,'white',false,'future-id');
    expect(f.records.some(r=>r.name==='delivery-stargazing')).toBe(true);
    expect(f.records.some(r=>r.name==='delivery-carried-item')).toBe(false);view.clear();
  });
});
