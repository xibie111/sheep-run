import type { SheepSkinDefinition } from "../data/sheepSkins";
import { SaveSystem, type SaveData } from "../systems/SaveSystem";

type WardrobeSave = Pick<SaveData, "totalStars" | "spentStars" | "coins" | "unlockedSkins" | "selectedSkin">;

/** Keep ownership separate from eligibility so spending never disables equip. */
export function wardrobePurchaseState(skin: SheepSkinDefinition, save: WardrobeSave) {
  const unlocked = save.unlockedSkins.includes(skin.id);
  const equipped = save.selectedSkin === skin.id;
  const currency = skin.unlock.type === "default" ? null : skin.unlock.type === "coins" ? "coin" : "star";
  const available = skin.unlock.type === "stars" ? save.totalStars
    : skin.unlock.type === "star-purchase" ? SaveSystem.availableStars(save) : save.coins;
  const enough = skin.unlock.type === "default" || available >= skin.unlock.amount;
  const purchase = skin.unlock.type === "coins" || skin.unlock.type === "star-purchase";
  const insufficientLabel = skin.unlock.type === "stars" ? "累计星数不足"
    : skin.unlock.type === "star-purchase" ? "星星不足" : "金币不足";
  return {
    unlocked, equipped, enough, currency,
    // A purchased skin remains selectable with a zero balance.
    disabled: equipped || (!unlocked && !enough),
    actionLabel: equipped ? "已装备" : unlocked ? "装备" : enough ? purchase ? "购买" : "解锁" : insufficientLabel,
    costLabel: skin.unlock.type === "default" ? "免费" : String(skin.unlock.amount),
    explanation: skin.unlock.type === "stars" ? `累计星数达标解锁：${skin.unlock.amount}星星，不扣星星`
      : unlocked ? "已拥有，可随时装备"
      : skin.unlock.type === "default" ? "初始装扮"
      : `购买需${skin.unlock.amount}${currency === "star" ? "星星" : "金币"}`,
  } as const;
}
