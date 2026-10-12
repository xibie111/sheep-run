import { ACHIEVEMENTS, collectionRewards, type AchievementId, type RewardId } from "../data/journeyBook";
import { isSkinId } from "../data/sheepSkins";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import type { ThemeId } from "../environment/types";

export const JOURNEY_STORAGE_KEY="sheep-run-journey-v1";
interface Journal {
  version:1; runs:number; summons:number; stars:number; obstacles:number; record:boolean;
  seasons:ThemeId[]; skins:number; achieved:Partial<Record<AchievementId,string>>; rewards:Partial<Record<RewardId,string>>;
  readAchievements:AchievementId[]; readRewards:RewardId[];
}
export interface JourneySnapshot extends Journal {saveFailed:boolean}
type StorageAccess=()=>Pick<Storage,"getItem"|"setItem">;
const empty=():Journal=>({version:1,runs:0,summons:0,stars:0,obstacles:0,record:false,seasons:[],skins:0,achieved:{},rewards:{},readAchievements:[],readRewards:[]});
const number=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const achievementIds=new Set<string>(ACHIEVEMENTS.map(a=>a.id)),rewardIds=new Set<string>([...SEASON_ORDER,"all"]);
function validDates(v:unknown,ids:Set<string>):boolean {
  return typeof v==="object"&&v!==null&&!Array.isArray(v)&&Object.entries(v).every(([k,d])=>ids.has(k)&&typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d)));
}
function valid(raw:unknown):raw is Journal {
  if(typeof raw!=="object"||!raw)return false;
  const s=raw as Journal;
  return s.version===1&&[s.runs,s.summons,s.stars,s.obstacles,s.skins].every(number)&&typeof s.record==="boolean"
    &&Array.isArray(s.seasons)&&s.seasons.every(v=>SEASON_ORDER.includes(v))&&validDates(s.achieved,achievementIds)&&validDates(s.rewards,rewardIds)
    &&Array.isArray(s.readAchievements)&&s.readAchievements.every(v=>achievementIds.has(v)&&Boolean(s.achieved[v]))
    &&Array.isArray(s.readRewards)&&s.readRewards.every(v=>rewardIds.has(v)&&Boolean(s.rewards[v]));
}
function merge(a:Journal,b:Journal):Journal {
  return {version:1,runs:Math.max(a.runs,b.runs),summons:Math.max(a.summons,b.summons),stars:Math.max(a.stars,b.stars),obstacles:Math.max(a.obstacles,b.obstacles),record:a.record||b.record,
    skins:Math.max(a.skins,b.skins),seasons:[...new Set([...a.seasons,...b.seasons])],achieved:{...b.achieved,...a.achieved},rewards:{...b.rewards,...a.rewards},
    readAchievements:[...new Set([...a.readAchievements,...b.readAchievements])],readRewards:[...new Set([...a.readRewards,...b.readRewards])]};
}
export function achievementProgress(s:JourneySnapshot,id:AchievementId):number {
  const values:Record<typeof ACHIEVEMENTS[number]["metric"],number>={runs:s.runs,summons:s.summons,stars:s.stars,obstacles:s.obstacles,record:Number(s.record),seasons:s.seasons.length,skins:s.skins,
    spring:Number(Boolean(s.rewards.spring)),summer:Number(Boolean(s.rewards.summer)),autumn:Number(Boolean(s.rewards.autumn)),winter:Number(Boolean(s.rewards.winter)),all:Number(Boolean(s.rewards.all))};
  const achievement=ACHIEVEMENTS.find(a=>a.id===id)!;
  return Math.min(achievement.goal,values[achievement.metric]);
}
/** Cosmetic-only journal. Future/corrupt saves are preserved; unavailable storage keeps a session copy. */
export class JourneyStore {
  private session=empty();private failed=false;private dirty=false;
  constructor(private readonly storage:StorageAccess=()=>window.localStorage,private readonly today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())){}
  load():JourneySnapshot {
    try {const raw=this.storage().getItem(JOURNEY_STORAGE_KEY);if(raw!==null){const parsed:unknown=JSON.parse(raw);if(!valid(parsed))throw new Error("Unrecognized journal");this.session=merge(parsed,this.session);}if(!this.dirty)this.failed=false;}
    catch {this.failed=true;}
    return structuredClone({...this.session,saveFailed:this.failed});
  }
  private change(edit:(s:Journal)=>void):AchievementId[] {
    const before=this.load(),next=structuredClone(this.session);edit(next);
    for(const a of ACHIEVEMENTS)if(!next.achieved[a.id]&&achievementProgress({...next,saveFailed:false},a.id)>=a.goal)next.achieved[a.id]=this.today();
    const newly=ACHIEVEMENTS.filter(a=>!before.achieved[a.id]&&Boolean(next.achieved[a.id])).map(a=>a.id);
    if(JSON.stringify(next)===JSON.stringify(this.session)&&!this.dirty)return newly;
    this.session=next;this.dirty=true;
    try {const storage=this.storage(),raw=storage.getItem(JOURNEY_STORAGE_KEY);if(raw!==null){const parsed:unknown=JSON.parse(raw);if(!valid(parsed))throw new Error("Preserve unknown journal");this.session=merge(parsed,this.session);}
      storage.setItem(JOURNEY_STORAGE_KEY,JSON.stringify(this.session));this.failed=false;this.dirty=false;}
    catch {this.failed=true;}
    return newly;
  }
  reconcile(skins:readonly unknown[],badges:readonly unknown[]):AchievementId[] {
    return this.change(s=>{s.skins=Math.max(s.skins,new Set(skins.filter((v):v is string=>typeof v==="string"&&isSkinId(v))).size);
      for(const id of collectionRewards(badges))if(!s.rewards[id])s.rewards[id]=this.today();});
  }
  summoned():AchievementId[]{return this.change(s=>{s.summons++;});}
  season(id:ThemeId):AchievementId[]{return this.change(s=>{if(!s.seasons.includes(id))s.seasons.push(id);});}
  runBest(stars:number,obstacles:number):AchievementId[]{return this.change(s=>{if(number(stars))s.stars=Math.max(s.stars,stars);if(number(obstacles))s.obstacles=Math.max(s.obstacles,obstacles);});}
  finished(newRecord:boolean):AchievementId[]{return this.change(s=>{s.runs++;s.record ||= newRecord;});}
  readAchievement(id:AchievementId):void {this.change(s=>{if(s.achieved[id]&&!s.readAchievements.includes(id))s.readAchievements.push(id);});}
  readReward(id:RewardId):void {this.change(s=>{if(s.rewards[id]&&!s.readRewards.includes(id))s.readRewards.push(id);});}
}
export const journeyStore=new JourneyStore();

// Keep per-run observation in step with the catalog, without a second goal list.
const starGoal=Math.max(...ACHIEVEMENTS.filter(a=>a.metric==="stars").map(a=>a.goal));
const obstacleGoal=Math.max(...ACHIEVEMENTS.filter(a=>a.metric==="obstacles").map(a=>a.goal));

/** One observer per run; no input, physics, random numbers, rewards or wall-clock timers. */
export class JourneyRun {
  private done=false;private stars=0;private obstacles=0;private seasonId:ThemeId|undefined;
  private readonly unlocked=new Set<AchievementId>();
  constructor(private readonly store:JourneyStore=journeyStore,private readonly notify:(ids:AchievementId[])=>void=()=>{}){}
  private record(ids:AchievementId[]):void {ids.forEach(id=>this.unlocked.add(id));if(ids.length)this.notify(ids);}
  visit(id:ThemeId):void {if(this.done||this.seasonId===id)return;this.seasonId=id;this.record(this.store.season(id));}
  summon():void {if(!this.done)this.record(this.store.summoned());}
  collected(ids:AchievementId[]):void {if(!this.done)this.record(ids);}
  star():void {if(this.done||this.stars>=starGoal)return;this.stars++;this.record(this.store.runBest(this.stars,this.obstacles));}
  passed():void {if(this.done||this.obstacles>=obstacleGoal)return;this.obstacles++;this.record(this.store.runBest(this.stars,this.obstacles));}
  finish(newRecord:boolean):AchievementId[]{if(!this.done){this.done=true;this.record(this.store.finished(newRecord));}return [...this.unlocked];}
  clear():void {this.done=true;this.unlocked.clear();}
}
