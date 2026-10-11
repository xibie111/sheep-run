const urls=import.meta.glob("../../assets/journey-v1/runtime/*.png",{eager:true,query:"?url",import:"default"}) as Record<string,string>;
export const JOURNEY_ART_ASSETS=["spring","summer","autumn","winter"].map(season=>({key:`journey-${season}`,url:urls[`../../assets/journey-v1/runtime/${season}.png`]!}));
