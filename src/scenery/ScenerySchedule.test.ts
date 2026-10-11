import { describe, expect, it, vi } from 'vitest';
import { ScenerySchedule, SceneryExposure } from './ScenerySchedule';
import type { LandscapeState } from '../ambient/AnimalRules';
import { SpawnSystem } from '../systems/SpawnSystemOwner';
const land: LandscapeState = { theme:'winter', dayPhase:'night', weather:'sunny', weatherAlpha:0, landTint:0xffffff, nearOffset:0, nearRatio:.24, nearRepeatWidth:1134 };
describe('rare scenery qualification and visibility', () => {
  it('waits 45 seconds and postpones busy scenes, allowing only one event per run', () => {
    const s = new ScenerySchedule(71);
    expect(s.choose(44_999,land,false,[])).toBeNull();
    expect(s.choose(80_000,land,true,[])).toBeNull();
    expect(s.choose(80_000,land,false,[])).toBe('meteors-v1');
    expect(s.choose(999_999,land,false,[])).toBeNull();
    s.stop(); expect(s.choose(999_999,land,false,[])).toBeNull();
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
