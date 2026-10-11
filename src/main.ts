import { SheepRunGame } from "./game/Game";
import "../style.css";

const parent = document.getElementById("game-container");
if (!parent) throw new Error("Missing #game-container game root");

export const game = new SheepRunGame(parent);

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy());
}
