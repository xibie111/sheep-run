/** Early and intermediate goals reuse observed v1 journal statistics. */
export const JOURNEY_MILESTONES_V3 = [
  {id:"three-runs",metric:"runs",name:"又来牧场",goal:3,condition:"累计完成三局跑酷",message:"小路上又多了你的脚印，牧场记得每一次出发。",icon:"play"},
  {id:"ten-runs",metric:"runs",name:"熟悉的脚步",goal:10,condition:"累计完成十局跑酷",message:"跑过十次的小路，已经收好了好多小小回忆。",icon:"home"},
  {id:"ten-friends",metric:"summons",name:"朋友陪我跑",goal:10,condition:"累计召唤伙伴十次",message:"铃声响起十次，每一次都有人陪你一起往前跑。",icon:"bell"},
  {id:"five-stars",metric:"stars",name:"口袋里的光",goal:5,condition:"单局收集五颗星星",message:"五颗小小的星星，让今天的口袋亮了起来。",icon:"star"},
  {id:"fifteen-stars",metric:"stars",name:"星光陪我跑",goal:15,condition:"单局收集十五颗星星",message:"一边奔跑，一边收好十五份亮亮的小心意。",icon:"star"},
  {id:"thirty-five-stars",metric:"stars",name:"满满的星光",goal:35,condition:"单局收集三十五颗星星",message:"三十五颗星光，都是今天一路向前的纪念。",icon:"star"},
  {id:"five-obstacles",metric:"obstacles",name:"小路向前",goal:5,condition:"单局成功越过五个障碍",message:"五个小难题留在身后，前面还有新的风景。",icon:"arrow-right"},
  {id:"ten-obstacles",metric:"obstacles",name:"脚步轻轻",goal:10,condition:"单局成功越过十个障碍",message:"十次轻巧地越过，记着你慢慢熟悉的小路。",icon:"arrow-right"},
  {id:"thirty-five-obstacles",metric:"obstacles",name:"一路有风景",goal:35,condition:"单局成功越过三十五个障碍",message:"越过三十五道难题，小羊还想陪你看看前面的风景。",icon:"arrow-right"},
  {id:"fifteen-skins",metric:"skins",name:"可爱的模样",goal:15,condition:"拥有十五款小羊皮肤",message:"十五种小羊模样，每次出发都能看到不一样的可爱。",icon:"shirt"},
  {id:"twenty-five-skins",metric:"skins",name:"衣橱里的心意",goal:25,condition:"拥有二十五款小羊皮肤",message:"衣橱里收好二十五份心意，每一款都想陪你走走。",icon:"shirt"},
  {id:"three-seasons",metric:"seasons",name:"一路换季",goal:3,condition:"累计到达三个不同季节",message:"三种不同的季节，留下了好多一起走过的小回忆。",icon:"flower"},
] as const;
