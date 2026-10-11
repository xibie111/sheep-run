export const LOVE_LETTER = {
  title: "写给催眠羊",
  lines: ["催眠羊，我喜欢你。", "这片牧场和每一只小羊，", "都是为你准备的。"],
  footer: "这款游戏，只为你而做。",
  close: "收下这份喜欢",
} as const;

export const SCORE_EASTER_EGGS = [
  { score: 520, message: "520 · 催眠羊，我喜欢你。" },
  { score: 1314, message: "1314 · 想陪你一直走下去。" },
] as const;

export const GOOD_NIGHT = "催眠羊，今天辛苦啦，晚安。我喜欢你。";
export const FAVORITE_FOODS = {
  title: "给催眠羊留的小饭桌",
  names: ["火鸡面", "麻辣烫", "滑蛋饭"],
  message: "你喜欢的，我都记得。也最喜欢你。",
  hint: "点点小饭桌",
  close: "一起吃饭吧",
} as const;

/** Device-local bedtime; display only, never the run's weather or clock. */
export function isBedtime(hour: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour < 24 && (hour >= 20 || hour < 6);
}

export function resultWhisper(newRecord: boolean): string {
  return newRecord ? "催眠羊真厉害！" : "没关系，我陪催眠羊再跑一次。";
}

/** Cosmetic triggers only: never award, persist or adjust a score. */
export class ScoreEggTracker {
  private readonly shown = new Set<number>();
  observe(score: number): (typeof SCORE_EASTER_EGGS)[number][] {
    if (!Number.isFinite(score) || score < 0) return [];
    return SCORE_EASTER_EGGS.filter(egg => {
      if (score < egg.score || this.shown.has(egg.score)) return false;
      this.shown.add(egg.score);
      return true;
    });
  }
}

/** Three completed touches close together reveal the letter. */
export class MenuEggTaps {
  private count = 0;
  private last = -Infinity;
  touch(now: number): boolean {
    if (!Number.isFinite(now)) return false;
    this.count = now - this.last <= 1800 && now >= this.last ? this.count + 1 : 1;
    this.last = now;
    if (this.count < 3) return false;
    this.count = 0;
    return true;
  }
}
