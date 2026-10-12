import type Phaser from "phaser";
import type { ResultSceneData } from "../game/GameState";
import { SCENE } from "../game/Constants";
import { watchViewport } from "../game/Viewport";
import { RESULT_ART_FRAMES, RESULT_SCORE_FONT, resultArtKey } from "../data/resultArtAssets";
import { addDisplayText } from "./DisplayText";
import { registerDisplayText } from "./DisplayTextLayer";
import { formatHudNumber } from "./DisplayCanvasText";
import type { ArtRect } from "./MenuArtLayout";
import { RESULT_BOXES, resultPlacement, resultTripEntry } from "./ResultLayout";
import { addSceneButton } from "./SceneButton";
import { addUiIcon } from "./UiIcon";
import { safeUiInsets } from "./UiLayout";
import { resultWhisper } from "../data/easterEggs";
import { addRecordCelebration } from "./RecordCelebration";
import { CONTENT_V2_KEYS, createTripCard } from '../content-v2';
import { toTripCardInput } from '../runner-v2/TripInput';
import { AudioSystem } from '../systems/AudioSystem';

/** Center complete bitmap ink, and shrink long values inside their own field. */
function fitText(text: Phaser.GameObjects.BitmapText, box: ArtRect): Phaser.GameObjects.BitmapText {
  text.setOrigin(0);
  const glyphs = text.getTextBounds().characters.filter(glyph => glyph.w > 0 && glyph.h > 0);
  const left = glyphs.length ? Math.min(...glyphs.map(glyph => glyph.x)) : 0;
  const top = glyphs.length ? Math.min(...glyphs.map(glyph => glyph.y)) : 0;
  const width = glyphs.length ? Math.max(...glyphs.map(glyph => glyph.x + glyph.w)) - left : 1;
  const height = glyphs.length ? Math.max(...glyphs.map(glyph => glyph.y + glyph.h)) - top : 1;
  const scale = Math.min(1, box.width / width, box.height / height);
  return text.setScale(scale).setPosition(box.x + (box.width - width * scale) / 2 - left * scale,
    box.y + (box.height - height * scale) / 2 - top * scale);
}

export function addResultView(scene: Phaser.Scene, result: ResultSceneData): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0, []).setName("result-ui");
  // One ratio preserves the authored panel and all decorative pixel proportions.
  root.add(scene.add.image(240, 135, resultArtKey("panel")).setDisplaySize(480, 941 * 480 / 1672).setName("result-panel"));
  const label = (name: string, value: string, box: ArtRect, size = 18, color = 0x542b16): void => {
    root.add(fitText(addDisplayText(scene, 0, 0, value, size, color).setName(name), box));
  };
  label("result-title", "本次得分", RESULT_BOXES.title, 40);
  const score = scene.add.bitmapText(0, 0, RESULT_SCORE_FONT.key, formatHudNumber(result.score), 40).setName("result-score").setDepth(10);
  registerDisplayText(scene, score);
  root.add(fitText(score, RESULT_BOXES.score));

  if (result.saveFailed) {
    label("save-error", "保存失败，本局进度可能未完整保存", RESULT_BOXES.saveError, 14, 0x9b431b);
    label("save-hint", "请重新打开游戏后再试", RESULT_BOXES.saveHint, 16);
  } else {
    if (result.newRecord) {
      addRecordCelebration(scene, root);
      const frame = RESULT_ART_FRAMES.record, box = RESULT_BOXES.record;
      const scale = Math.min(box.width / frame.width, box.height / frame.height);
      root.add(scene.add.image(box.x + box.width / 2, box.y + box.height / 2, resultArtKey("record"))
        .setDisplaySize(frame.width * scale, frame.height * scale).setName("result-record-badge"));
      label("result-new-record", resultWhisper(true), RESULT_BOXES.recordText, 17);
    } else {
      label("result-whisper", resultWhisper(false), RESULT_BOXES.whisper, 13);
    }
    label("result-best", `牧场纪录  ${formatHudNumber(result.best)}`, RESULT_BOXES.best, 18);
    // Only the current run's existing reward is shown; no balance or star field.
    root.add(addUiIcon(scene, 202, 192, resultArtKey("coin"), 18).setName("result-earned-icon"));
    label("result-earned", `金币 +${formatHudNumber(result.coinsEarned, 1)}`, { ...RESULT_BOXES.earned, x: 218, width: 70 }, 18);
  }

  for (const [part, title, icon, destination] of [
    ["retry", "再跑一次", "retryIcon", SCENE.run], ["home", "返回牧场", "homeIcon", SCENE.menu],
  ] as const) {
    const box = RESULT_BOXES[part], frame = RESULT_ART_FRAMES[part];
    root.add(addSceneButton(scene, box.x + box.width / 2, box.y + box.height / 2, title, () => scene.scene.start(destination), {
      width: box.width, height: box.height, font: "display", fontSize: "20", iconKey: resultArtKey(icon),
      art: { key: resultArtKey(part), width: frame.width, height: frame.height },
    }));
  }
  watchViewport(scene, size => {
    const placement = resultPlacement(size, safeUiInsets(scene));
    root.setScale(placement.scale).setPosition(placement.x, placement.y);
  });
  const trip = createTripCard(scene, result.travel ? toTripCardInput(result.travel, result.leadSkin) : {});
  const entry = addSceneButton(scene, 0, 0, '查看这次旅行', () => {
    if (!trip.show()) return;
    const audio = scene.registry.get('audioSystem') as AudioSystem | undefined;
    audio?.initializeAfterGesture(); audio?.play('button');
  }, { width: 128, height: 34, font: 'display', fontSize: '12',
    art: { key: CONTENT_V2_KEYS.tripEntry, width: 480, height: 154 } });
  // The generated entry already contains a book; reserve its left-hand ink.
  const words = entry.list[1] as Phaser.GameObjects.BitmapText;
  words.setX(words.x + 7);
  watchViewport(scene, size => {
    const box = resultTripEntry(size, safeUiInsets(scene));
    entry.setPosition(box.x + box.width / 2, box.y + box.height / 2);
  });
  scene.events.once('shutdown', () => trip.destroy());
  return root;
}
