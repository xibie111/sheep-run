import { describe,expect,it,vi } from "vitest";
import { JourneyStore,JourneyRun,JOURNEY_STORAGE_KEY,achievementProgress } from "./JourneyStore";
import { ACHIEVEMENTS,collectionRewards } from "../data/journeyBook";
import { COLLECTION_BADGES } from "../data/pastureCollections";
import { SHEEP_SKINS } from "../data/sheepSkins";

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
describe("cosmetic achievements",()=>{
  it("only backfills observed skins and badges, never guesses earlier runs, records or companions",()=>{
    const f=fixture();expect(f.store.reconcile(["white","black","brown","golden","farmer","black","future",null],COLLECTION_BADGES.map(b=>b.id)).sort()).toEqual(["five-skins","spring-collector","summer-collector","autumn-collector","winter-collector","all-collections"].sort());
    const s=f.store.load();expect(s.skins).toBe(5);expect(s.summons).toBe(0);expect(s.runs).toBe(0);expect(s.stars).toBe(0);expect(s.obstacles).toBe(0);expect(s.record).toBe(false);expect(s.seasons).toEqual([]);
    expect(f.values.get("sheep-run-save")).toBe("untouched economy");expect(f.storage.getItem.mock.calls.every(([key])=>key===JOURNEY_STORAGE_KEY)).toBe(true);
  });
  it("counts actual star objects rather than double-star rewards, and requires twenty successful passes in one run",()=>{
    const f=fixture(),notify=vi.fn(),run=new JourneyRun(f.store,notify);
    for(let i=0;i<9;i++)run.star();expect(f.store.load().achieved["ten-stars"]).toBeUndefined();run.star();expect(notify).toHaveBeenCalledWith(["ten-stars"]);
    for(let i=0;i<19;i++)run.passed();expect(f.store.load().achieved["twenty-obstacles"]).toBeUndefined();run.passed();expect(notify).toHaveBeenCalledWith(["twenty-obstacles"]);
    run.finish(false);expect(run.finish(true)).toEqual(["five-stars","ten-stars","five-obstacles","ten-obstacles","twenty-obstacles","first-run"]);expect(f.store.load().runs).toBe(1);expect(f.store.load().record).toBe(false);
    run.star();run.passed();run.summon();expect(f.store.load().summons).toBe(0);
  });
  it("resets per-run goals; exit does not finish a run; an abandoned run keeps already observed achievements",()=>{
    const f=fixture();const one=new JourneyRun(f.store);for(let i=0;i<9;i++)one.star();one.clear();one.finish(true);expect(f.store.load().runs).toBe(0);
    const two=new JourneyRun(f.store);two.star();expect(f.store.load().stars).toBe(9);expect(f.store.load().achieved["ten-stars"]).toBeUndefined();two.summon();two.clear();expect(f.store.load().summons).toBe(1);
  });
  it("counts each actual summon, unlocks at one and five, records all visited seasons, and dates never change",()=>{
    const f=fixture();expect(f.store.summoned()).toEqual(["first-friend"]);for(let i=0;i<3;i++)expect(f.store.summoned()).toEqual([]);expect(f.store.summoned()).toEqual(["five-friends"]);
    const run=new JourneyRun(f.store);run.visit("spring");run.visit("spring");run.visit("summer");run.visit("autumn");expect(f.store.load().achieved["four-seasons"]).toBeUndefined();run.visit("winter");
    expect(run.finish(true)).toEqual(["two-seasons","three-seasons","four-seasons","first-run","first-record"]);expect(run.finish(true)).toEqual(["two-seasons","three-seasons","four-seasons","first-run","first-record"]);
    const later=new JourneyStore(()=>f.storage,()=>"2026-12-31");later.summoned();later.finished(true);expect(later.load().achieved["first-record"]).toBe("2026-10-11");
  });
  it("has clear progress, read markers only for unlocked items, and no wall-clock timer or random consumption",()=>{
    const f=fixture(),random=vi.spyOn(Math,"random"),timers=vi.spyOn(globalThis,"setTimeout");const run=new JourneyRun(f.store);
    const raw=JSON.stringify(f.store.load());expect(JSON.stringify(f.store.load())).toBe(raw);
    f.store.readAchievement("first-friend");f.store.readReward("spring");expect(f.store.load().readAchievements).toEqual([]);expect(f.store.load().readRewards).toEqual([]);
    run.summon();f.store.readAchievement("first-friend");expect(f.store.load().readAchievements).toEqual(["first-friend"]);
    expect(achievementProgress(f.store.load(),"five-friends")).toBe(1);expect(ACHIEVEMENTS).toHaveLength(44);expect(random).not.toHaveBeenCalled();expect(timers).not.toHaveBeenCalled();random.mockRestore();timers.mockRestore();
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

describe("extended journal milestones",()=>{
  it("counts completed runs once, reaches five and twenty, and counts twenty actual summons",()=>{
    const f=fixture();
    for(let i=0;i<4;i++){const run=new JourneyRun(f.store);run.finish(false);run.finish(true);}
    expect(f.store.load().runs).toBe(4);expect(f.store.load().achieved["five-runs"]).toBeUndefined();
    const fifth=new JourneyRun(f.store);expect(fifth.finish(false)).toEqual(["five-runs"]);expect(fifth.finish(false)).toEqual(["five-runs"]);
    for(let i=5;i<19;i++)new JourneyRun(f.store).finish(false);
    expect(f.store.load().achieved["twenty-runs"]).toBeUndefined();expect(new JourneyRun(f.store).finish(false)).toEqual(["twenty-runs"]);
    const companionRun=new JourneyRun(f.store);for(let i=0;i<19;i++)companionRun.summon();
    expect(f.store.load().achieved["twenty-friends"]).toBeUndefined();companionRun.summon();
    expect(f.store.load().achieved["twenty-friends"]).toBe("2026-10-11");
    companionRun.finish(false);companionRun.summon();expect(f.store.load().summons).toBe(20);
  });

  it("observes a full run beyond the original caps, with one notification per new stamp",()=>{
    const f=fixture(),notify=vi.fn(),run=new JourneyRun(f.store,notify);
    for(let i=0;i<24;i++)run.star();expect(f.store.load().achieved["twenty-five-stars"]).toBeUndefined();
    run.star();expect(f.store.load().achieved["twenty-five-stars"]).toBe("2026-10-11");
    for(let i=25;i<49;i++)run.star();expect(f.store.load().achieved["fifty-stars"]).toBeUndefined();run.star();
    for(let i=0;i<49;i++)run.passed();expect(f.store.load().achieved["fifty-obstacles"]).toBeUndefined();run.passed();
    for(let i=0;i<20;i++){run.star();run.passed();}
    for(const id of ["ten-stars","twenty-five-stars","fifty-stars","twenty-obstacles","fifty-obstacles"]){
      expect(notify.mock.calls.flatMap(([ids])=>ids).filter(value=>value===id)).toHaveLength(1);
    }
    run.finish(false);const completed=f.store.load();
    run.star();run.passed();run.summon();run.visit("summer");run.finish(true);
    expect(f.store.load()).toEqual(completed);expect(completed.record).toBe(false);
  });

  it("never combines per-run stars or obstacles, and discarded runs stop all observers",()=>{
    const f=fixture(),first=new JourneyRun(f.store);
    for(let i=0;i<24;i++)first.star();for(let i=0;i<49;i++)first.passed();first.finish(false);
    const second=new JourneyRun(f.store);second.star();second.passed();
    expect(f.store.load().stars).toBe(24);expect(f.store.load().obstacles).toBe(49);
    expect(f.store.load().achieved["twenty-five-stars"]).toBeUndefined();expect(f.store.load().achieved["fifty-obstacles"]).toBeUndefined();
    const before=f.store.load();second.clear();second.star();second.passed();second.summon();second.visit("winter");second.finish(true);
    expect(f.store.load()).toEqual(before);
    const third=new JourneyRun(f.store);for(let i=0;i<25;i++)third.star();third.clear();
    expect(f.store.load().achieved["twenty-five-stars"]).toBe("2026-10-11");expect(f.store.load().runs).toBe(1);
  });

  it("backfills only satisfied goals from a valid eight-stamp v1 journal without changing earlier dates, reads, schema or economy",()=>{
    const f=fixture(),originalIds=["first-run","first-friend","five-friends","ten-stars","twenty-obstacles","first-record","four-seasons","five-skins"];
    const old={version:1,runs:20,summons:20,stars:50,obstacles:50,record:true,seasons:["spring","summer","autumn","winter"],skins:10,
      achieved:Object.fromEntries(originalIds.map(id=>[id,"2026-09-30"])),
      rewards:{spring:"2026-09-30",summer:"2026-09-30",autumn:"2026-09-30",winter:"2026-09-30",all:"2026-09-30"},
      readAchievements:originalIds,readRewards:["spring","all"]};
    f.values.set(JOURNEY_STORAGE_KEY,JSON.stringify(old));expect(f.store.load().saveFailed).toBe(false);
    const newly=f.store.reconcile([],[]);expect(newly).toHaveLength(23);
    expect(new Set(newly)).toEqual(new Set([
      "five-runs","twenty-runs","twenty-friends","twenty-five-stars","fifty-stars","fifty-obstacles","ten-skins",
      "spring-collector","summer-collector","autumn-collector","winter-collector","all-collections","two-seasons",
      "three-runs","ten-runs","ten-friends","five-stars","fifteen-stars","thirty-five-stars",
      "five-obstacles","ten-obstacles","thirty-five-obstacles","three-seasons",
    ]));
    const next=f.store.load();for(const id of originalIds)expect(next.achieved[id as keyof typeof next.achieved]).toBe("2026-09-30");
    expect(next.readAchievements).toEqual(old.readAchievements);expect(next.readRewards).toEqual(old.readRewards);expect(next.rewards).toEqual(old.rewards);
    const persisted=JSON.parse(f.values.get(JOURNEY_STORAGE_KEY)!);
    expect(Object.keys(persisted).sort()).toEqual(Object.keys(old).sort());expect(persisted.version).toBe(1);
    expect(new JourneyStore(()=>f.storage).load().achieved).toEqual(next.achieved);
    expect(f.values.get("sheep-run-save")).toBe("untouched economy");
    expect(f.storage.setItem.mock.calls.every(([key])=>key===JOURNEY_STORAGE_KEY)).toBe(true);
  });

  it("only completes each seasonal stamp from all three valid badges, then completes the twelve-badge stamp once",()=>{
    const f=fixture(),owned:string[]=[];
    for(const season of ["spring","summer","autumn","winter"] as const){
      const badges=COLLECTION_BADGES.filter(b=>b.season===season).map(b=>b.id);
      owned.push(...badges.slice(0,2));
      f.store.reconcile([], [...owned,...badges.slice(0,2),`${season}-future`,null,{}]);
      expect(f.store.load().achieved[`${season}-collector`]).toBeUndefined();
      owned.push(badges[2]);const newly=f.store.reconcile([],owned);
      expect(newly).toContain(`${season}-collector`);
      expect(newly.includes("all-collections")).toBe(season==="winter");
      expect(achievementProgress(f.store.load(),`${season}-collector`)).toBe(1);
    }
    f.store.readAchievement("spring-collector");f.store.readReward("spring");
    const snapshot=f.store.load(),later=new JourneyStore(()=>f.storage,()=>"2026-12-31");
    expect(later.reconcile([],owned.concat(owned))).toEqual([]);expect(later.load().achieved).toEqual(snapshot.achieved);
    later.reconcile([],[]);expect(later.load().achieved["all-collections"]).toBe("2026-10-11");
    expect(later.load().readAchievements).toEqual(["spring-collector"]);expect(later.load().readRewards).toEqual(["spring"]);
  });

  it("uses the current skin catalog, validates and deduplicates before the ten-skin goal",()=>{
    const f=fixture(),skins=SHEEP_SKINS.slice(0,10).map(s=>s.id);
    f.store.reconcile([...skins.slice(0,9),...skins.slice(0,9),"unknown",null,{},5],[]);
    expect(f.store.load().skins).toBe(9);expect(f.store.load().achieved["ten-skins"]).toBeUndefined();
    expect(f.store.reconcile(skins,[])).toEqual(["ten-skins"]);
    expect(f.store.load().achieved["ten-skins"]).toBe("2026-10-11");
    expect(f.store.reconcile(["white"],[])).toEqual([]);expect(f.store.load().skins).toBe(10);
  });

  it("caps every displayed achievement at its goal even when lifetime or single-run records exceed it",()=>{
    const f=fixture();for(let i=0;i<260;i++)f.store.finished(true);for(let i=0;i<110;i++)f.store.summoned();
    f.store.runBest(110,160);for(const season of ["spring","summer","autumn","winter"] as const)f.store.season(season);
    f.store.reconcile(SHEEP_SKINS.map(s=>s.id),COLLECTION_BADGES.map(b=>b.id));
    const snapshot=f.store.load();
    for(const a of ACHIEVEMENTS)expect(achievementProgress(snapshot,a.id),a.id).toBe(a.goal);
    expect(Object.keys(snapshot.achieved)).toHaveLength(44);
  });

  it("merges stamps from a newly completed collection into one run summary and ignores later collection callbacks after cleanup",()=>{
    const f=fixture(),notify=vi.fn(),run=new JourneyRun(f.store,notify),spring=COLLECTION_BADGES.filter(b=>b.season==="spring").map(b=>b.id);
    run.collected(f.store.reconcile([],spring));run.collected(f.store.reconcile([],spring));
    expect(notify).toHaveBeenCalledTimes(1);expect(notify).toHaveBeenCalledWith(["spring-collector"]);
    expect(run.finish(false)).toEqual(["spring-collector","first-run"]);
    const summer=f.store.reconcile([],COLLECTION_BADGES.filter(b=>b.season==="summer").map(b=>b.id));
    run.collected(summer);expect(run.finish(false)).toEqual(["spring-collector","first-run"]);
    const discarded=new JourneyRun(f.store,notify);discarded.clear();discarded.collected(summer);
    expect(discarded.finish(false)).toEqual([]);expect(f.store.load().runs).toBe(1);
  });

  it("preserves a structurally valid v1 save with an unknown future stamp instead of silently replacing it",()=>{
    const f=fixture(),{saveFailed:_saveFailed,...journal}=f.store.load();
    const raw=JSON.stringify({...journal,achieved:{"future-stamp":"2026-10-11"}});f.values.set(JOURNEY_STORAGE_KEY,raw);
    f.store.runBest(50,50);expect(f.store.load().saveFailed).toBe(true);
    expect(f.store.load().achieved["fifty-stars"]).toBe("2026-10-11");expect(f.store.load().achieved["fifty-obstacles"]).toBe("2026-10-11");
    expect(f.values.get(JOURNEY_STORAGE_KEY)).toBe(raw);expect(f.storage.setItem).not.toHaveBeenCalled();
  });
});
