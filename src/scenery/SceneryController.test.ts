import { describe, expect, it, vi } from 'vitest';
const view = vi.hoisted(()=>({ visible:true, destroyed:0 }));
vi.mock('./SceneryView',()=>({SceneryView:class { constructor(_scene:unknown,readonly id:string){} update(){return view.visible;} destroy(){view.destroyed++;} }}));
import { SceneryController } from './SceneryController';
import { SceneryStore } from './SceneryStore';
import type { LandscapeState } from '../ambient/AnimalRules';
const land:LandscapeState={theme:'winter',weather:'sunny',weatherAlpha:0,dayPhase:'night',landTint:0xffffff,nearOffset:0,nearRatio:.24,nearRepeatWidth:1134};
function harness() {
  let paused=false,raw:string|null=null;const notify=vi.fn(),store=new SceneryStore(()=>({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}}));
  const scene={scene:{isPaused:()=>paused}};
  const c=new SceneryController(scene as never,false,notify,store,71),context=(nowMs:number)=>({nowMs,deltaMs:100,landscape:land,viewport:{width:480,height:270},blocked:false});
  return{c,context,store,notify,pause:(v:boolean)=>{paused=v;}};
}
describe('rare scenery lifecycle',()=>{
  it('records only after presentation, pauses exactly, gives one notice, and never repeats this run',()=>{
    view.visible=false;const h=harness();h.c.update(h.context(45000));
    for(let t=45100;t<=47000;t+=100)h.c.update(h.context(t));expect(h.store.load().seenIds).toEqual([]);
    view.visible=true;for(let t=47100;t<=48000;t+=100)h.c.update(h.context(t));
    const before=h.c.snapshot();h.pause(true);h.c.update(h.context(80000));expect(h.c.snapshot()).toEqual(before);expect(h.store.load().seenIds).toEqual([]);
    h.pause(false);for(let t=48100;t<=48500;t+=100)h.c.update(h.context(t));
    expect(h.store.load().seenIds).toEqual(['meteors-v1']);expect(h.notify).toHaveBeenCalledTimes(1);
    h.c.update(h.context(54000));h.c.update(h.context(90000));expect(h.c.snapshot().id).toBeNull();h.c.clear();
  });
  it('failure/exit before sufficient exposure clears without a record; restart is fresh',()=>{
    view.visible=true;const h=harness();h.c.update(h.context(45000));h.c.update(h.context(45100));h.c.clear();h.c.clear();
    h.c.update(h.context(90000));expect(h.c.snapshot()).toMatchObject({id:null,stopped:true});expect(h.store.load().seenIds).toEqual([]);
    const fresh=harness();fresh.c.update(fresh.context(29999));expect(fresh.c.snapshot().id).toBeNull();fresh.c.clear();
  });
  it('does not lose the run opportunity when daylight cancels an unseen night fade-in',()=>{
    view.visible=false;const h=harness();h.c.update(h.context(30000));
    expect(h.c.snapshot().id).toBe('meteors-v1');
    h.c.update({...h.context(30100),landscape:{...land,dayPhase:'morning'}});
    expect(h.c.snapshot().id).toBeNull();h.c.update(h.context(32599));expect(h.c.snapshot().id).toBeNull();
    let restartedAt=32600;
    for(;restartedAt<=45100;restartedAt+=2500){h.c.update(h.context(restartedAt));if(h.c.snapshot().id)break;}
    expect(h.c.snapshot().id).toBe('meteors-v1');
    view.visible=true;for(let t=restartedAt+100;t<=restartedAt+1600;t+=100)h.c.update(h.context(t));
    expect(h.store.load().seenIds).toEqual(['meteors-v1']);
    h.c.update(h.context(restartedAt+9000));h.c.update(h.context(90000));expect(h.c.snapshot().id).toBeNull();h.c.clear();
  });
  it('cancels when the actual sky changes and keeps repeated discoveries quiet',()=>{
    view.visible=true;const h=harness();h.store.discover('meteors-v1');h.c.update(h.context(45000));
    for(let t=45100;t<=47000;t+=100)h.c.update(h.context(t));expect(h.notify).not.toHaveBeenCalled();
    h.c.update({...h.context(47100),landscape:{...land,dayPhase:'morning'}});expect(h.c.snapshot().id).toBeNull();h.c.clear();
  });
});
