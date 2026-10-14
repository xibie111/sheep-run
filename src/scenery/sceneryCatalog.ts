export const SCENERY_CARDS = [
  { id: 'rainbow-v1', title: '雨后彩虹', hint: '雨停天晴后，看看远处天空', message: '雨会停，天会晴。把这道彩虹收好，送给今天认真奔跑的你。', art: 'scenery-rainbow' },
  { id: 'meteors-v1', title: '夜间流星', hint: '夜晚的牧场，偶尔有流星经过', message: '星星从夜空轻轻划过。愿你心里那个小小的愿望，慢慢开花。', art: 'scenery-meteors' },
  { id: 'fireflies-v1', title: '萤火虫草地', hint: '夏日傍晚或暖夜，留意草地', message: '一点一点的小光，也能照亮回家的路。今晚，牧场陪你慢慢走。', art: 'scenery-fireflies' },
  { id: 'spring-pasture-v1', title: '春日牧场', hint: '晴朗的春日，慢慢看看牧场', message: '小花把春天藏在草地里。今天的小羊，也想把一点好心情送给你。', art: 'scenery-spring-pasture' },
  { id: 'summer-pond-v1', title: '夏日池塘', hint: '夏日白天，遇见路边的池塘', message: '池塘倒映着云，微风吹过青草。跑累的时候，心里也可以留一小片清凉。', art: 'scenery-summer-pond' },
  { id: 'autumn-sunset-v1', title: '秋野晚霞', hint: '秋日傍晚，留意牧场的晚霞', message: '晚霞把牧场染成暖暖的颜色。慢一点也没关系，今天的风景会等你。', art: 'scenery-autumn-sunset' },
  { id: 'winter-sunshine-v1', title: '冬日暖阳', hint: '冬日晴朗白天，看看雪地牧场', message: '雪地很安静，阳光却很温暖。愿你在冷冷的日子里，也有柔软的小快乐。', art: 'scenery-winter-sunshine' },
  { id: 'duck-outing-v1', title: '鸭鸭出游', hint: '看见鸭妈妈和小鸭一起游过', message: '最后一只小鸭还在努力追上。别着急，朋友们会一起陪你到前面。', art: 'scenery-duck-outing' },
  { id: 'butterfly-path-v1', title: '追蝶小径', hint: '看见小兔追着蝴蝶玩耍', message: '小兔蹦了两下，蝴蝶轻轻飞过。那些不起眼的小开心，也值得收好。', art: 'scenery-butterfly-path' },
] as const;
export type SceneryId = typeof SCENERY_CARDS[number]['id'];
export const SCENERY_COPY = '风景明信片已遇见还未遇见返回明信片遇见了，明信片已收好。明信片暂未保存本次仍可查看';
export const sceneryCard = (id: SceneryId) => SCENERY_CARDS.find(card => card.id === id)!;
