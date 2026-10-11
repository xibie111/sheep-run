export interface ButtonContentSize {
  width: number;
  height: number;
}

/** Keep the complete content group inside the light face of the wooden button. */
export function buttonContentLayout(width: number, height: number, text: ButtonContentSize, icon: ButtonContentSize, stacked: boolean, iconRight: boolean): {
  textX: number; textY: number; iconX: number; iconY: number; scale: number;
} {
  const hasText = text.width > 0;
  const hasIcon = icon.width > 0;
  const gap = hasText && hasIcon ? (stacked ? 3 : 7) : 0;
  const groupWidth = stacked ? Math.max(text.width, icon.width) : text.width + icon.width + gap;
  const groupHeight = stacked ? text.height + icon.height + gap : Math.max(text.height, icon.height);
  const inset = stacked ? 18 : hasText && hasIcon ? (width >= 120 ? 44 : 20) : 14;
  const availableWidth = Math.max(1, width - inset);
  const availableHeight = Math.max(1, height - 16);
  const scale = Math.min(1, availableWidth / Math.max(1, groupWidth), availableHeight / Math.max(1, groupHeight));
  const horizontal = (icon.width + gap) / 2;
  const iconHorizontal = (text.width + gap) / 2;
  return {
    textX: stacked || !hasIcon ? 0 : (iconRight ? -horizontal : horizontal) * scale,
    textY: stacked && hasIcon ? (icon.height + gap) / 2 * scale : 0,
    iconX: stacked || !hasText ? 0 : (iconRight ? iconHorizontal : -iconHorizontal) * scale,
    iconY: stacked && hasText ? -(text.height + gap) / 2 * scale : 0,
    scale,
  };
}
