/** Align the DOM canvas itself to physical pixels, avoiding compositor resampling. */
export function sizeDisplaySurface(canvas: HTMLCanvasElement, gameCanvas: HTMLCanvasElement, parent: HTMLElement, logicalWidth: number): number {
  const rect = gameCanvas.getBoundingClientRect(), parentRect = parent.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const left = Math.round(rect.left * dpr), top = Math.round(rect.top * dpr);
  canvas.width = Math.max(1, Math.round(rect.right * dpr) - left);
  canvas.height = Math.max(1, Math.round(rect.bottom * dpr) - top);
  Object.assign(canvas.style, { left: `${left / dpr - parentRect.left}px`, top: `${top / dpr - parentRect.top}px`,
    width: `${canvas.width / dpr}px`, height: `${canvas.height / dpr}px` });
  return canvas.width / logicalWidth;
}
