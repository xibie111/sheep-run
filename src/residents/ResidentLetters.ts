import type { MailLetter } from '../data/mailLetters';

/** Approved narrative copy. Preserve every paragraph, punctuation mark and signature. */
export const RESIDENT_LETTERS: readonly MailLetter[] = Object.freeze([
  { id: 'resident-windmill-letter-1-v1', title: '阿禾的第一封回信', paragraphs: [
    '邀请函收到了，谢谢你跑这一趟！',
    '我已经把野餐垫铺在风车下面了。',
    '不过，准备食物时借了花圃邻居的小篮子，还没来得及好好道谢。',
    '你愿意帮我把感谢信送过去吗？',
  ], signature: '——阿禾' },
  { id: 'resident-windmill-letter-2-v1', title: '野餐桌上的小花', paragraphs: [
    '感谢信送到了，邻居还给野餐桌送来了一束花。',
    '现在食物、花和座位都准备好了，只差把这一天留住。',
    '我想请大家在风车下面拍张合照。',
    '这里有最后一封集合邀请，麻烦你再送一次吧。',
  ], signature: '——阿禾' },
  { id: 'resident-windmill-letter-3-v1', title: '给你留了一个位置', paragraphs: [
    '合照洗好了，野餐也比想象中热闹。',
    '照片里的每只小羊都笑得很开心。',
    '谢谢你把大家的心意一封封送到。',
    '风车下给你留着一个位置，下次经过，记得来坐一会儿。',
  ], signature: '——阿禾' },
  { id: 'resident-riverside-letter-1-v1', title: '屋檐下收到的信', paragraphs: [
    '小雨伞和回信都收到了，谢谢你！',
    '窗边的花没有被雨淋坏，我也能安心去看看河岸。',
    '这把伞是小桥另一边的邻居借给我的。',
    '等雨小一点，能帮我把感谢信送过去吗？',
  ], signature: '——小沐' },
  { id: 'resident-riverside-letter-2-v1', title: '雨停之后', paragraphs: [
    '听说感谢信已经送到了，我很开心。',
    '今天河面终于亮起来了，窗边的花也开了一朵。',
    '我想邀请邻居来河边喝茶，再看看雨后的彩虹。',
    '晴天邀请已经写好，交给你啦。',
  ], signature: '——小沐' },
  { id: 'resident-riverside-letter-3-v1', title: '晴天也欢迎你', paragraphs: [
    '今天的茶会很舒服，连彩虹都来做客了。',
    '下雨时，我们借给彼此一把伞；天晴时，又能一起坐下来。',
    '谢谢你把这些小小的关心送到河的两边。',
    '以后无论晴天还是雨天，河边小屋都欢迎你。',
  ], signature: '——小沐' },
  { id: 'resident-lighthouse-letter-1-v1', title: '灯塔里的第一声问候', paragraphs: [
    '今晚的星光信收到了，谢谢你。',
    '整理信箱时，我找到一封很久以前的来信，来自港口的小屋。',
    '那时我忙着照看灯塔，一直没把回信寄出去。',
    '现在终于写好了，你愿意帮我送到港口吗？',
  ], signature: '——阿灯' },
  { id: 'resident-lighthouse-letter-2-v1', title: '港口亮起的小灯', paragraphs: [
    '回信送到后，港口的朋友也给我寄来了一张小卡片。',
    '原来隔着这么远，我们一直看得见彼此窗边的灯。',
    '我想邀请大家来灯塔看看夜景。',
    '这次，请帮我把邀请送回来吧。',
  ], signature: '——阿灯' },
  { id: 'resident-lighthouse-letter-3-v1', title: '有人看见这束光', paragraphs: [
    '今晚灯塔旁多了好多脚步声。',
    '大家一起看海，也一起看远处的小灯。',
    '以前我觉得守夜只是把灯照亮，现在知道，这束光会被人看见。',
    '谢谢你送来的每封信。下次夜里经过，我会为你留着灯。',
  ], signature: '——阿灯' },
].map(letter => Object.freeze({ ...letter, paragraphs: Object.freeze(letter.paragraphs) })));
export function getResidentLetter(id: unknown): MailLetter | undefined { return RESIDENT_LETTERS.find(letter => letter.id === id); }
export const RESIDENT_LETTER_TEXT = RESIDENT_LETTERS.flatMap(letter => [letter.title, ...letter.paragraphs, letter.signature]);
