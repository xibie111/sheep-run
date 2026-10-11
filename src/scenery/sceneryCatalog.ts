export const SCENERY_CARDS = [
  { id: 'rainbow-v1', title: '雨后彩虹', hint: '雨停天晴后，看看远处天空', message: '雨会停，天会晴。把这道彩虹收好，送给今天认真奔跑的你。', art: 'scenery-rainbow' },
  { id: 'meteors-v1', title: '夜间流星', hint: '夜晚的牧场，偶尔有流星经过', message: '星星从夜空轻轻划过。愿你心里那个小小的愿望，慢慢开花。', art: 'scenery-meteors' },
  { id: 'fireflies-v1', title: '萤火虫草地', hint: '夏日傍晚或暖夜，留意草地', message: '一点一点的小光，也能照亮回家的路。今晚，牧场陪你慢慢走。', art: 'scenery-fireflies' },
] as const;
export type SceneryId = typeof SCENERY_CARDS[number]['id'];
export const SCENERY_COPY = '风景明信片已遇见还未遇见返回明信片遇见了，明信片已收好。明信片暂未保存本次仍可查看';
export const sceneryCard = (id: SceneryId) => SCENERY_CARDS.find(card => card.id === id)!;
