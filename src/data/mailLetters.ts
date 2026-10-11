export interface MailLetter {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly signature: string;
}

/** Confirmed copy. Paragraph boundaries and punctuation are part of the letter. */
export const MAIL_LETTERS: readonly MailLetter[] = [
  {
    id: "welcome-v1", title: "欢迎信",
    paragraphs: [
      "哈喽哈喽，催眠羊同学！",
      "这是专门为你做的《小羊快跑》哦！",
      "其实，做这个游戏还挺开心的。投入其中的时候，就能进入一种心无旁骛的心流状态，专心把这片小牧场一点点做好。",
      "这片牧场都是为你准备的，这里的小羊也都是你的。希望它们能带给你一点小快乐，更希望你每天都开开心心的！",
    ],
    signature: "爱你的小杨同学",
  },
  {
    id: "goodnight-v1", title: "晚安信",
    paragraphs: [
      "这是一封写给你的晚安信。",
      "今天是不是特别特别累？回到宿舍，有没有特别想我呀？有没有偷偷吃火鸡面？",
      "想跟你说点什么，又一时不知道从哪里说起，那就先道一声晚安吧。",
      "希望你今晚睡得安稳，做一个甜甜的好梦。今天的疲惫，就留在今天吧。",
      "晚安，催眠羊同学。",
    ],
    signature: "爱你的小杨同学",
  },
];

export const MAIL_UI_COPY = "给催眠羊的小邮局 合上邮箱 未读 已读 返回 收好这封信 上一页 下一页 阅读记录未保存 页";
