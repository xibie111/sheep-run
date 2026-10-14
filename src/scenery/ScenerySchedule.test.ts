import { describe, expect, it, vi } from 'vitest';
import { ScenerySchedule, SceneryExposure, SCENERY_RULES } from './ScenerySchedule';
import { DifficultySystem } from '../systems/DifficultySystem';
import { ThemeSystem } from '../environment/ThemeSystem';
import type { LandscapeState } from '../ambient/AnimalRules';
import { SpawnSystem } from '../systems/SpawnSystemOwner';
const land: LandscapeState = { theme:'winter', dayPhase:'night', weather:'sunny', weatherAlpha:0, landTint:0xffffff, nearOffset:0, nearRatio:.24, nearRepeatWidth:1134 };
describe('rare scenery qualification and visibility', () => {
  it('waits 30 seconds and postpones busy scenes, allowing only one observed event per run', () => {
    const s = new ScenerySchedule(71);
    expect(s.choose(29_999,land,false,[])).toBeNull();
    expect(s.choose(80_000,land,true,[])).toBeNull();
    expect(s.choose(80_000,land,false,[])).toBe('meteors-v1');
    expect(s.choose(999_999,land,false,[])).toBeNull();
    s.stop(); expect(s.choose(999_999,land,false,[])).toBeNull();
  });
  it('offers a meteor during the first real default-speed night instead of skipping it until 45 seconds', () => {
    const schedule=new ScenerySchedule(71),speed=new DifficultySystem(),themes=new ThemeSystem();
    let distance=0,encounterAt=0;
    for(let ms=40;ms<45000;ms+=40){
      distance+=speed.update(.04)*.04;
      const phase=themes.visualAtDistance(distance).dayPhase;
      const id=schedule.choose(ms,{...land,dayPhase:phase},false,[]);
      if(id){expect(phase).toBe('night');expect(id).toBe('meteors-v1');encounterAt=ms;break;}
    }
    expect(encounterAt).toBeGreaterThanOrEqual(32000);expect(encounterAt).toBeLessThan(41000);
  });
  it('retries several times within a short night, defers congestion without spending attempts, and bounds eligible failures', () => {
    for(let seed=10000;seed<10020;seed++){
      const schedule=new ScenerySchedule(seed);let id:string|null=null,attempts=0;
      for(let ms=30000;ms<=45000&&!id;ms+=SCENERY_RULES.retryMs){
        expect(schedule.choose(ms,land,true,[])).toBeNull();
        id=schedule.choose(ms,land,false,[]);attempts++;
        if(!id)expect(schedule.choose(ms+1,land,false,[])).toBeNull();
      }
      expect(id).toBe('meteors-v1');expect(attempts).toBeLessThanOrEqual(6);
    }
  });
  it('rearms only an unobserved cancellation and never reopens a completed or stopped run', () => {
    const schedule=new ScenerySchedule(71);
    expect(schedule.choose(30000,land,false,[])).toBe('meteors-v1');
    schedule.finish(30100,false);
    expect(schedule.choose(32599,land,false,[])).toBeNull();
    let id:string|null=null;
    for(let t=32600;t<=45100&&!id;t+=SCENERY_RULES.retryMs)id=schedule.choose(t,land,false,[]);
    expect(id).toBe('meteors-v1');
    schedule.finish(50000,true);expect(schedule.choose(90000,land,false,[])).toBeNull();
    const stopped=new ScenerySchedule(71);stopped.choose(30000,land,false,[]);stopped.stop();
    stopped.finish(30100,false);expect(stopped.choose(90000,land,false,[])).toBeNull();
  });
  it('requires actual preceding rain and a recent return to sunny daytime for a rainbow', () => {
    const s = new ScenerySchedule(71), day = { ...land, dayPhase:'morning' as const };
    expect(s.choose(60_000,day,false,[])).toBeNull();
    s.choose(60_000,{...day,weather:'rain',weatherAlpha:.05},true,[]);
    expect(s.choose(61_000,day,false,[])).toBeNull();
    s.choose(62_000,{...day,weather:'rain',weatherAlpha:.7},true,[]);
    expect(s.choose(62_100,{...day,weather:'wind'},false,[])).toBeNull();
    expect(s.choose(62_200,day,false,[])).toBe('rainbow-v1');
    const expired = new ScenerySchedule(71); expired.choose(50_000,{...day,weather:'rain',weatherAlpha:1},true,[]);
    expect(expired.choose(75_001,day,false,[])).toBeNull();
  });
  it('respects season, night and rain; prefers unseen eligible cards', () => {
    expect(new ScenerySchedule(71).choose(50_000,{...land,dayPhase:'morning'},false,[])).toBeNull();
    expect(new ScenerySchedule(71).choose(50_000,{...land,weather:'rain',weatherAlpha:1},false,[])).toBeNull();
    expect(new ScenerySchedule(71).choose(50_000,{...land,theme:'summer',dayPhase:'sunset'},false,[])).toBe('fireflies-v1');
    expect(new ScenerySchedule(71).choose(50_000,{...land,theme:'spring'},false,['meteors-v1'])).toBe('fireflies-v1');
  });
  it('increases the chance only on eligible spaced attempts, providing a bounded wait when conditions remain suitable', () => {
    for (let seed = 10000; seed < 10020; seed++) {
      const s = new ScenerySchedule(seed); let id: string | null = null;
      for (let now = 45_000; now <= 125_000 && !id; now += 8000) id = s.choose(now,land,false,[]);
      expect(id).toBe('meteors-v1');
    }
  });
  it('does not touch the obstacle/pickup random sequence', () => {
    const random = vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('shared RNG');});
    try {
      const trace = (withScenery: boolean) => { const spawn = new SpawnSystem(17), s = new ScenerySchedule(10000), trace = [];
        for(let i=0;i<3000;i++){if(withScenery)s.choose(i*40,land,false,[]);trace.push(...spawn.update(.04,250));}return trace; };
      expect(trace(true)).toEqual(trace(false)); expect(random).not.toHaveBeenCalled();
    } finally {random.mockRestore();}
  });
  it('does not record generated, hidden, clipped, paused or insufficiently shown scenery', () => {
    const seen = new SceneryExposure();
    for(let i=0;i<30;i++)expect(seen.observe(100,false)).toBe(false);
    for(let i=0;i<10;i++)expect(seen.observe(100,true)).toBe(false);
    expect(seen.observe(100,false)).toBe(false);
    for(let i=0;i<14;i++)expect(seen.observe(100,true)).toBe(false);
    for(let i=0;i<100;i++)expect(seen.observe(0,true)).toBe(false);
    expect(seen.observe(100,true)).toBe(true); expect(seen.observe(100,true)).toBe(false);
  });
});
