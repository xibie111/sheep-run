import { describe, expect, it, vi } from "vitest";
import { CollectionStore, COLLECTION_STORAGE_KEY } from "./CollectionStore";
import { CollectionSchedule, COLLECTION_BADGES } from "../data/pastureCollections";

describe("cosmetic collection persistence", () => {
  it("merges current storage, ignores duplicate pickups, and never touches the gameplay save", () => {
    const values = new Map([["sheep-run-save", "original gameplay save"]]);
    const storage = {getItem:vi.fn((key:string) => values.get(key) ?? null),setItem:vi.fn((key:string,value:string) => values.set(key,value))};
    const store = new CollectionStore(() => storage);
    expect(store.unlock("spring-flower")).toEqual({added:true,saved:true});
    values.set(COLLECTION_STORAGE_KEY, JSON.stringify({version:1,badges:["spring-flower","summer-shell"]}));
    store.unlock("winter-cocoa");
    expect(store.load().ids).toEqual(["spring-flower","summer-shell","winter-cocoa"]);
    expect(store.unlock("winter-cocoa")).toEqual({added:false,saved:true});
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(values.get("sheep-run-save")).toBe("original gameplay save");
    expect(storage.getItem.mock.calls.every(([key]) => key===COLLECTION_STORAGE_KEY)).toBe(true);
  });
  it.each(["", "invalid json", JSON.stringify({version:2,badges:[]}),JSON.stringify({version:1,badges:["future-badge"]})])("preserves an unreadable or future collection save", raw => {
    const storage = {getItem:()=>raw,setItem:vi.fn()};
    const store = new CollectionStore(() => storage);
    expect(store.unlock("spring-flower")).toEqual({added:true,saved:false});
    expect(store.load()).toEqual({ids:["spring-flower"],saveFailed:true});
    expect(store.retrySave()).toEqual({ids:["spring-flower"],saveFailed:true});
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("keeps this session's collection when storage is denied", () => {
    const store = new CollectionStore(() => {throw new Error("storage denied");});
    expect(store.unlock("spring-flower")).toEqual({added:true,saved:false});
    expect(store.load()).toEqual({ids:["spring-flower"],saveFailed:true});
  });
  it("reports a failed write and retries all session badges on the next pickup", () => {
    let raw:string|null=null,denied=true;
    const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{if(denied)throw new Error("quota");raw=value;}};
    const store=new CollectionStore(()=>storage);
    expect(store.unlock("spring-flower")).toEqual({added:true,saved:false});
    expect(store.load()).toEqual({ids:["spring-flower"],saveFailed:true});
    denied=false;
    expect(store.unlock("spring-clover")).toEqual({added:true,saved:true});
    expect(new CollectionStore(()=>storage).load()).toEqual({ids:["spring-flower","spring-clover"],saveFailed:false});
  });
  it.each(["access", "read"])("keeps a pending badge unsaved after storage %s recovers until a duplicate pickup retries it", failure => {
    let raw:string|null=null,denied=true;
    const storage={
      getItem:()=>{if(denied&&failure==="read")throw new Error("storage denied");return raw;},
      setItem:vi.fn((_key:string,value:string)=>{raw=value;})
    };
    const store=new CollectionStore(()=>{if(denied&&failure==="access")throw new Error("storage denied");return storage;});
    expect(store.unlock("spring-flower")).toEqual({added:true,saved:false});
    denied=false;
    expect(store.load()).toEqual({ids:["spring-flower"],saveFailed:true});
    expect(raw).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.unlock("spring-flower")).toEqual({added:false,saved:true});
    expect(store.unlock("spring-flower")).toEqual({added:false,saved:true});
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(new CollectionStore(()=>storage).load()).toEqual({ids:["spring-flower"],saveFailed:false});
  });
  it("retries the last badge without another unlock and stops writing once it is saved", () => {
    const ids=COLLECTION_BADGES.map(badge=>badge.id),last=ids[ids.length-1];
    let raw=JSON.stringify({version:1,badges:ids.slice(0,-1)}),denied=true;
    const storage={getItem:()=>raw,setItem:vi.fn((_key:string,value:string)=>{if(denied)throw new Error("quota");raw=value;})};
    const store=new CollectionStore(()=>storage);
    expect(store.unlock(last)).toEqual({added:true,saved:false});
    expect(store.retrySave()).toEqual({ids,saveFailed:true});
    expect(JSON.parse(raw).badges).toEqual(ids.slice(0,-1));
    denied=false;
    expect(store.load()).toEqual({ids,saveFailed:true});
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(store.retrySave()).toEqual({ids,saveFailed:false});
    expect(new CollectionStore(()=>storage).load()).toEqual({ids,saveFailed:false});
    expect(store.retrySave()).toEqual({ids,saveFailed:false});
    expect(store.unlock(last)).toEqual({added:false,saved:true});
    expect(storage.setItem).toHaveBeenCalledTimes(3);
  });
  it("merges other saved badges when pending collection writes recover", () => {
    let raw:string|null=null,denied=true;
    const storage={getItem:()=>raw,setItem:vi.fn((_key:string,value:string)=>{if(denied)throw new Error("quota");raw=value;})};
    const store=new CollectionStore(()=>storage);
    expect(store.unlock("spring-flower")).toEqual({added:true,saved:false});
    raw=JSON.stringify({version:1,badges:["summer-shell"]});
    denied=false;
    expect(store.retrySave()).toEqual({ids:["summer-shell","spring-flower"],saveFailed:false});
    expect(new CollectionStore(()=>storage).load()).toEqual({ids:["summer-shell","spring-flower"],saveFailed:false});
  });
  it("does not create a save when retrying without a pending collection", () => {
    const storage={getItem:()=>null,setItem:vi.fn()};
    expect(new CollectionStore(()=>storage).retrySave()).toEqual({ids:[],saveFailed:false});
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
describe("four-season hidden badges", () => {
  it("offers three per season once, and allows missed badges on a later season cycle", () => {
    const schedule = new CollectionSchedule();
    const first=[];
    for (let score=0;score<6000;score+=25) first.push(...schedule.observe(score));
    expect(first.map(badge=>badge.id)).toEqual(COLLECTION_BADGES.map(badge=>badge.id));
    expect(schedule.observe(5999)).toEqual([]);
    expect(schedule.observe(6250).map(badge=>badge.id)).toEqual(["spring-flower"]);
    expect(schedule.observe(6250)).toEqual([]);
  });
  it("handles score bonuses crossing a trigger and rejects invalid or backwards observations", () => {
    const schedule = new CollectionSchedule();
    schedule.observe(230);
    expect(schedule.observe(430).map(badge=>badge.id)).toEqual(["spring-flower"]);
    expect(schedule.observe(NaN)).toEqual([]);
    expect(schedule.observe(Infinity)).toEqual([]);
    expect(schedule.observe(250)).toEqual([]);
    expect(schedule.observe(701).map(badge=>badge.id)).toEqual(["spring-butterfly"]);
  });
});
