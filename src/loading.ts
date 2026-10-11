import { destroyLoadingScreen, showLoadingScreen } from "./ui/LoadingScreen";

const screen = showLoadingScreen();
// Paint entry UI before the much larger Phaser module is downloaded.
void import("./main").catch(() => screen?.showBootError(() => window.location.reload()));
if (import.meta.hot) import.meta.hot.dispose(destroyLoadingScreen);
