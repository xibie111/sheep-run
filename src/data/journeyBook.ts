import { COLLECTION_BADGES } from "./pastureCollections";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import type { ThemeId } from "../environment/types";

export const ACHIEVEMENTS = [
  {id:"first-run",name:"第一次出发",goal:1,condition:"完成第一局跑酷",message:"出发的这一小步，也值得留下纪念。",icon:"play"},
  {id:"first-friend",name:"有你陪跑",goal:1,condition:"第一次召唤伙伴",message:"今天的路，有朋友一起走。",icon:"bell"},
  {id:"five-friends",name:"熟悉的朋友",goal:5,condition:"累计召唤伙伴五次",message:"每次铃声响起，都有熟悉的朋友赶来。",icon:"bell"},
  {id:"ten-stars",name:"满口袋星光",goal:10,condition:"单局收集十颗星星",message:"把今天的小小星光，好好装进口袋。",icon:"star"},
  {id:"twenty-obstacles",name:"轻巧的小羊",goal:20,condition:"单局成功越过二十个障碍",message:"一步一跳，路上的难题慢慢留在身后。",icon:"arrow-right"},
  {id:"first-record",name:"又进步一点",goal:1,condition:"第一次刷新个人最高分",message:"比昨天多走一点，也值得开心。",icon:"check"},
  {id:"four-seasons",name:"走过四季",goal:4,condition:"跑酷中到达春夏秋冬",message:"春夏秋冬，都想和你一起。",icon:"flower"},
  {id:"five-skins",name:"今天穿什么",goal:5,condition:"拥有五款小羊皮肤",message:"不管换成什么模样，你都是可爱的小羊。",icon:"shirt"},
] as const;
export type AchievementId = typeof ACHIEVEMENTS[number]["id"];
export type RewardId = ThemeId | "all";
export const SEASON_LETTERS: Record<ThemeId,{title:string;message:string}> = {
  spring:{title:"春日来信",message:"催眠羊，花开的时候，想把最柔软的草地留给你。累了就躺一会儿，不用赶路，也不用急着长大。我会陪你等下一阵春风。"},
  summer:{title:"夏日晚风",message:"把西瓜最甜的一口留给你，把树下最凉快的位置也留给你。今天走了很远吧？坐下来，听晚风吹过牧场。平平常常的一天，有你就很好。"},
  autumn:{title:"秋日饭桌",message:"天凉了，饭要趁热吃。桌上多摆一只碗，是因为想和你一起。你的开心、委屈和小小心事，都可以慢慢讲。我一直在这里听。"},
  winter:{title:"冬夜晚安",message:"热可可已经准备好了，毯子也暖暖的。今晚先把烦恼放在窗外吧。你不必一直勇敢，安心做一只困困的小羊。晚安，明天也会陪着你。"},
};
export const COMPLETE_LETTER = [
  "亲爱的催眠羊：从第一朵春花，到最后一杯冬夜可可，我们已经一起走过了四季。你找到的十二枚徽章，把那些小小的日子都留下来了。",
  "我想陪你看花开，陪你等晚风，陪你吃一顿热饭，也陪你度过安静的夜晚。跑得快也好，慢慢走也好，累了停下来也好，你的每一步都值得被珍惜。",
  "这封信没有期限。想我的时候，就回来翻一翻吧。愿你每次出发都有期待，每次回家都有温暖。春夏秋冬，都想和你一起。四季都陪你。",
] as const;
export function collectionRewards(ids: readonly unknown[]): RewardId[] {
  const owned = new Set(ids);
  const seasons = SEASON_ORDER.filter(season => COLLECTION_BADGES.filter(b=>b.season===season).every(b=>owned.has(b.id)));
  return seasons.length===SEASON_ORDER.length ? [...seasons,"all"] : seasons;
}
export function collectionCount(ids:readonly unknown[],season:ThemeId):number {
  const owned=new Set(ids);return COLLECTION_BADGES.filter(b=>b.season===season&&owned.has(b.id)).length;
}
