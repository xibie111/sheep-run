import { describe, expect, it } from "vitest";
import { SHEEP_SKINS, skinDefinition, type SkinId } from "../data/sheepSkins";
import { wardrobePurchaseState } from "./WardrobePurchase";

const empty = { totalStars: 0, spentStars: 0, coins: 0, unlockedSkins: ["white"], selectedSkin: "white" };
const state = (id: SkinId, save: Partial<typeof empty> = {}) => wardrobePurchaseState(skinDefinition(id)!, { ...empty, ...save });

describe("Wardrobe purchase presentation", () => {
  it.each(SHEEP_SKINS.filter(skin => skin.unlock.type === "star-purchase"))("uses available stars and a purchase button for $id", skin => {
    const exact = state(skin.id, { totalStars: skin.unlock.amount + 15, spentStars: 15 });
    expect(exact).toMatchObject({ enough: true, disabled: false, actionLabel: "购买", currency: "star", costLabel: String(skin.unlock.amount) });
    expect(exact.explanation).toBe(`购买需${skin.unlock.amount}星星`);
    expect(state(skin.id, { totalStars: skin.unlock.amount + 15, spentStars: 16 })).toMatchObject({ enough: false, disabled: true, actionLabel: "星星不足" });
  });

  it.each(SHEEP_SKINS.slice(26, 30))("uses only coins for $id", skin => {
    expect(state(skin.id, { coins: skin.unlock.amount, totalStars: 999 })).toMatchObject({ disabled: false, actionLabel: "购买", currency: "coin" });
    expect(state(skin.id, { coins: skin.unlock.amount - 1, totalStars: 999 })).toMatchObject({ disabled: true, actionLabel: "金币不足" });
  });

  it.each(["black", "brown"] as const)("keeps cumulative eligibility and a non-spending explanation for %s", id => {
    const cost = skinDefinition(id)!.unlock.amount;
    const unlocked = state(id, { totalStars: cost, spentStars: cost, coins: 999 });
    expect(unlocked).toMatchObject({ enough: true, disabled: false, actionLabel: "解锁", currency: "star" });
    expect(unlocked.explanation).toBe(`累计星数达标解锁：${cost}星星，不扣星星`);
    expect(state(id, { totalStars: cost - 1, coins: 999 }).actionLabel).toBe("累计星数不足");
  });

  it.each(SHEEP_SKINS.filter(skin => skin.unlock.type === "star-purchase" || skin.id.endsWith("-v1")))("equips owned $id even below its original price", skin => {
    const owned = { unlockedSkins: ["white", skin.id] };
    expect(state(skin.id, owned)).toMatchObject({ unlocked: true, enough: false, disabled: false, actionLabel: "装备" });
    expect(state(skin.id, { ...owned, selectedSkin: skin.id })).toMatchObject({ equipped: true, disabled: true, actionLabel: "已装备" });
  });

  it("shows free default skin and does not infer ownership from sufficient balances", () => {
    expect(state("white")).toMatchObject({ currency: null, costLabel: "免费", equipped: true, disabled: true });
    expect(state("strawberry-v1", { totalStars: 100 })).toMatchObject({ unlocked: false, actionLabel: "购买" });
  });
});
