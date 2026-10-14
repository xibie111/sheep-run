const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Phaser's tilePosition is in source pixels, before tileScale is applied. */
export function deliveryRoadOffset(distance: number, originX: number, scale: number, sourceWidth: number, reducedMotion: boolean): number {
  const phase = ((reducedMotion ? 0 : distance) - originX) / scale;
  return ((phase % sourceWidth) + sourceWidth) % sourceWidth;
}

/** A unique distant panorama traverses its complete visible route interval. */
export function deliveryPanoramaOffset(distance: number, start: number, end: number, available: number,
  viewportWidth: number, imageWidth: number, focused: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return focused ? -available : 0;
  // Small mirrored edge strips supply room on wide screens without enlarging
  // the painting, cropping tall landmarks, or repeating its unique buildings.
  const pan = Math.max(available, viewportWidth / 8);
  const from = focused ? -available + Math.min(pan, imageWidth * .035) : pan;
  const to = focused ? -available : -pan;
  return from + (to - from) * clamp((distance - start) / Math.max(1, end - start));
}
