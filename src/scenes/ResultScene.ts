import Phaser from "phaser";
import { SCENE, WORLD } from "../game/Constants";
import type { ResultSceneData } from "../game/GameState";
import { watchViewport } from "../game/Viewport";
import { addTiledPastureBackdrop } from "../ui/ViewportBackdrop";
import { addResultView } from "../ui/ResultView";
import { attachJourneyBook } from "../ui/JourneyBook";
import { ACHIEVEMENTS } from "../data/journeyBook";
import { isSkinId } from '../data/sheepSkins';

export class ResultScene extends Phaser.Scene {
  private result: ResultSceneData = { score: 0, best: 0, newRecord: false, coinsEarned: 0, coinBalance: 0 };

  constructor() {
    super({ key: SCENE.result });
  }

  init(data?: object): void {
    this.result = { score: 0, best: 0, newRecord: false, coinsEarned: 0, coinBalance: 0 };
    if (data && "score" in data && "best" in data && "newRecord" in data) {
      const result = data as Partial<ResultSceneData> & Pick<ResultSceneData, "score" | "best" | "newRecord">;
      this.result = {
        score: result.score,
        best: result.best,
        newRecord: result.newRecord,
        coinsEarned: typeof result.coinsEarned === "number" && Number.isFinite(result.coinsEarned) ? result.coinsEarned : 0,
        coinBalance: typeof result.coinBalance === "number" && Number.isFinite(result.coinBalance) ? result.coinBalance : 0,
        achievements: Array.isArray(result.achievements) ? [...new Set(result.achievements.filter(id => ACHIEVEMENTS.some(a => a.id === id)))] : [],
        ...(result.travel ? { travel: result.travel } : {}),
        ...(typeof result.leadSkin === 'string' && isSkinId(result.leadSkin) ? { leadSkin: result.leadSkin } : {}),
        ...(result.saveFailed === true ? { saveFailed: true as const } : {}),
      };
    }
  }

  create(): void {
    addTiledPastureBackdrop(this);
    const shade = this.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x4a382f, 0.28).setOrigin(0).setName("result-shade");
    watchViewport(this, (size) => shade.setSize(size.width, size.height));
    addResultView(this, this.result);
    attachJourneyBook(this, this.result.achievements ?? []);
  }

}
