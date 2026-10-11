import { describe,expect,it,vi } from "vitest";
import { JourneyStore,JourneyRun,JOURNEY_STORAGE_KEY,achievementProgress } from "./JourneyStore";
import { ACHIEVEMENTS,collectionRewards } from "../data/journeyBook";
import { COLLECTION_BADGES } from "../data/pastureCollections";

function fixture(){const values=new Map<string,string>([["sheep-run-save","untouched economy"]]);const storage={getItem:vi.fn((key:string)=>values.get(key)??null),setItem:vi.fn((key:string,value:string)=>values.set(key,value))};return {values,storage,store:new JourneyStore(()=>storage,()=>"2026-10-11")};}
describe("permanent collection letters",()=>{
  it("needs exactly the valid three badges, deduplicates, and completes all twelve once",()=>{
    expect(collectionRewards(["spring-flower","spring-flower","fake"])).toEqual([]);
    const ids=COLLECTION_BADGES.map(b=>b.id);expect(collectionRewards(ids.slice(0,3))).toEqual(["spring"]);
    expect(collectionRewards(ids)).toEqual(["spring","summer","autumn","winter","all"]);
    const f=fixture();f.store.reconcile(["white"],ids);const initial=f.store.load();
    f.store.readReward("spring");f.store.readReward("all");f.store.reconcile(["white"],ids);
    expect(f.store.load().rewards).toEqual(initial.rewards);expect(f.store.load().readRewards).toEqual(["spring","all"]);
    expect(new JourneyStore(()=>f.storage).load().rewards).toEqual(initial.rewards);
    // Rewards remain accessible if badges cannot be read on a subsequent visit.
    f.store.reconcile([],[]);expect(f.store.load().rewards.all).toBe("2026-10-11");
  });
});
describe("eight cosmetic achievements",()=>{
  it("only backfills observed skins and badges, never guesses earlier runs, records or companions",()=>{
    const f=fixture();expect(f.store.reconcile(["white","black","brown","golden","farmer","black","future",null],COLLECTION_BADGES.map(b=>b.id))).toEqual(["five-skins"]);
    const s=f.store.load();expect(s.skins).toBe(5);expect(s.summons).toBe(0);expect(s.runs).toBe(0);expect(s.stars).toBe(0);expect(s.obstacles).toBe(0);expect(s.record).toBe(false);expect(s.seasons).toEqual([]);
    expect(f.values.get("sheep-run-save")).toBe("untouched economy");expect(f.storage.getItem.mock.calls.every(([key])=>key===JOURNEY_STORAGE_KEY)).toBe(true);
  });
  it("counts actual star objects rather than double-star rewards, and requires twenty successful passes in one run",()=>{
    const f=fixture(),notify=vi.fn(),run=new JourneyRun(f.store,notify);
    for(let i=0;i<9;i++)run.star();expect(f.store.load().achieved["ten-stars"]).toBeUndefined();run.star();expect(notify).toHaveBeenCalledWith(["ten-stars"]);
    for(let i=0;i<19;i++)run.passed();expect(f.store.load().achieved["twenty-obstacles"]).toBeUndefined();run.passed();expect(notify).toHaveBeenCalledWith(["twenty-obstacles"]);
    run.finish(false);expect(run.finish(true)).toEqual(["ten-stars","twenty-obstacles","first-run"]);expect(f.store.load().runs).toBe(1);expect(f.store.load().record).toBe(false);
    run.star();run.passed();run.summon();expect(f.store.load().summons).toBe(0);
  });
  it("resets per-run goals; exit does not finish a run; an abandoned run keeps already observed achievements",()=>{
    const f=fixture();const one=new JourneyRun(f.store);for(let i=0;i<9;i++)one.star();one.clear();one.finish(true);expect(f.store.load().runs).toBe(0);
    const two=new JourneyRun(f.store);two.star();expect(f.store.load().stars).toBe(9);expect(f.store.load().achieved["ten-stars"]).toBeUndefined();two.summon();two.clear();expect(f.store.load().summons).toBe(1);
  });
  it("counts each actual summon, unlocks at one and five, records all visited seasons, and dates never change",()=>{
    const f=fixture();expect(f.store.summoned()).toEqual(["first-friend"]);for(let i=0;i<3;i++)expect(f.store.summoned()).toEqual([]);expect(f.store.summoned()).toEqual(["five-friends"]);
    const run=new JourneyRun(f.store);run.visit("spring");run.visit("spring");run.visit("summer");run.visit("autumn");expect(f.store.load().achieved["four-seasons"]).toBeUndefined();run.visit("winter");
    expect(run.finish(true)).toEqual(["four-seasons","first-run","first-record"]);expect(run.finish(true)).toEqual(["four-seasons","first-run","first-record"]);
    const later=new JourneyStore(()=>f.storage,()=>"2026-12-31");later.summoned();later.finished(true);expect(later.load().achieved["first-record"]).toBe("2026-10-11");
  });
  it("has clear progress, read markers only for unlocked items, and no wall-clock timer or random consumption",()=>{
    const f=fixture(),random=vi.spyOn(Math,"random"),timers=vi.spyOn(globalThis,"setTimeout");const run=new JourneyRun(f.store);
    const raw=JSON.stringify(f.store.load());expect(JSON.stringify(f.store.load())).toBe(raw);
    f.store.readAchievement("first-friend");f.store.readReward("spring");expect(f.store.load().readAchievements).toEqual([]);expect(f.store.load().readRewards).toEqual([]);
    run.summon();f.store.readAchievement("first-friend");expect(f.store.load().readAchievements).toEqual(["first-friend"]);
    expect(achievementProgress(f.store.load(),"five-friends")).toBe(1);expect(ACHIEVEMENTS).toHaveLength(8);expect(random).not.toHaveBeenCalled();expect(timers).not.toHaveBeenCalled();random.mockRestore();timers.mockRestore();
  });
  it("merges current storage and cannot erase other unlocked stamps or read letters",()=>{
    const f=fixture(),other=new JourneyStore(()=>f.storage,()=>"2026-10-12");f.store.summoned();other.reconcile(["white"],COLLECTION_BADGES.slice(0,3).map(b=>b.id));other.readReward("spring");
    f.store.finished(true);expect(f.store.load().readRewards).toEqual(["spring"]);expect(f.store.load().achieved["first-friend"]).toBe("2026-10-11");expect(f.store.load().rewards.spring).toBe("2026-10-12");
  });
  it.each(["invalid json",JSON.stringify({version:2}),JSON.stringify({version:1,summons:-1})])("preserves malformed or future cosmetic saves",raw=>{
    const f=fixture();f.values.set(JOURNEY_STORAGE_KEY,raw);f.store.summoned();expect(f.store.load().saveFailed).toBe(true);expect(f.store.load().achieved["first-friend"]).toBe("2026-10-11");expect(f.values.get(JOURNEY_STORAGE_KEY)).toBe(raw);expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it("keeps session progress when storage is denied, then retries and restores it after write recovery",()=>{
    let raw:string|null=null,denied=true;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{if(denied)throw new Error("quota");raw=value;}};
    const store=new JourneyStore(()=>storage,()=>"2026-10-11");store.summoned();expect(store.load().saveFailed).toBe(true);denied=false;store.reconcile(["white"],[]);
    expect(store.load().saveFailed).toBe(false);expect(new JourneyStore(()=>storage).load().summons).toBe(1);
    const blocked=new JourneyStore(()=>{throw new Error("denied");},()=>"2026-10-11");blocked.summoned();expect(blocked.load().summons).toBe(1);expect(blocked.load().saveFailed).toBe(true);
  });
});
