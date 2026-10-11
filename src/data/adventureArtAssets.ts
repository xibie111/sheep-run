import { COLLECTION_BADGES } from "./pastureCollections";

const urls = import.meta.glob("../../assets/adventure-v1/runtime/*.png", {eager:true,query:"?url",import:"default"}) as Record<string,string>;
const asset = (key:string,file:string) => ({key,url:urls[`../../assets/adventure-v1/runtime/${file}.png`]!});
export const ADVENTURE_ART = {
  magnet:asset("powerup-magnet","magnet"),
  shield:asset("powerup-shield","shield"),
  doubleStar:asset("powerup-starMultiplier","double-star"),
  bubble:asset("feedback-shield-bubble","shield-bubble"),
  sparkle:asset("feedback-sparkle","sparkle"),
  dust:asset("feedback-dust","dust"),
  album:asset("collection-album-book","album-book"),
  albumIcon:asset("collection-album-icon","album-icon"),
  albumButton:asset("collection-album-button","album-button"),
} as const;
export const ADVENTURE_ASSETS = [...Object.values(ADVENTURE_ART),...COLLECTION_BADGES.map(badge=>asset(`collection-${badge.id}`,badge.id))];
