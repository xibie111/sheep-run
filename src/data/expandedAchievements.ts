/** Additional cosmetic milestones use existing journal observations only. */
export const EXPANDED_ACHIEVEMENTS = [
  {id:"fifty-runs",metric:"runs",name:"熟悉的小路",goal:50,condition:"累计完成五十局跑酷",message:"第五十次回到牧场，草地和小羊都认得你的脚步。",icon:"play"},
  {id:"hundred-runs",metric:"runs",name:"百次出发",goal:100,condition:"累计完成一百局跑酷",message:"出发一百次，每一次都有新的风景在前面等你。",icon:"home"},
  {id:"two-hundred-fifty-runs",metric:"runs",name:"牧场常客",goal:250,condition:"累计完成二百五十局跑酷",message:"二百五十次出发，牧场已经收好了满满的回忆。",icon:"home"},
  {id:"fifty-friends",metric:"summons",name:"朋友常来",goal:50,condition:"累计召唤伙伴五十次",message:"铃声响了五十次，熟悉的朋友还是会笑着赶来。",icon:"bell"},
  {id:"hundred-friends",metric:"summons",name:"百次同行",goal:100,condition:"累计召唤伙伴一百次",message:"一百次有人陪你奔跑，平常的小路也有了新的温暖。",icon:"bell"},
  {id:"seventy-five-stars",metric:"stars",name:"星光小旅行",goal:75,condition:"单局收集七十五颗星星",message:"七十五颗星星，记着这一趟亮亮的小旅行。",icon:"star"},
  {id:"hundred-stars",metric:"stars",name:"一口袋星河",goal:100,condition:"单局收集一百颗星星",message:"一百颗星星都收好了，今天的努力亮得像一片星河。",icon:"star"},
  {id:"hundred-obstacles",metric:"obstacles",name:"跨过一百步",goal:100,condition:"单局成功越过一百个障碍",message:"越过一百道难题，前面的小路依然值得期待。",icon:"arrow-right"},
  {id:"one-hundred-fifty-obstacles",metric:"obstacles",name:"一路向前",goal:150,condition:"单局成功越过一百五十个障碍",message:"把一百五十个障碍留在身后，带着勇气继续往前。",icon:"arrow-right"},
  {id:"twenty-skins",metric:"skins",name:"多彩衣橱",goal:20,condition:"拥有二十款小羊皮肤",message:"二十种小羊模样，每一款都想陪你走走看看。",icon:"shirt"},
  {id:"thirty-skins",metric:"skins",name:"满满的衣橱",goal:30,condition:"拥有三十款小羊皮肤",message:"三十款小羊挤满衣橱，明天也会有新的可爱等你。",icon:"shirt"},
  {id:"two-seasons",metric:"seasons",name:"风景变了",goal:2,condition:"累计到达两个不同季节",message:"两种不同的季节，都留下了你和小羊的脚印。",icon:"flower"},
] as const;
