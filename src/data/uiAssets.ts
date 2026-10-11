import type Phaser from "phaser";

export type UiButtonStyle = "primary" | "secondary" | "disabled" | "selected" | "equipped" | "back" | "icon";

export const UI_KEYS = {
  titleMain: "ui-title-main",
  titlePause: "ui-title-pause",
  titleWardrobe: "ui-title-wardrobe",
  panelPause: "ui-panel-pause",
  pauseDialog: "ui-pause-reference-dialog",
  panelWardrobe: "ui-panel-wardrobe",
  panelSmall: "ui-panel-small",
  panelStatus: "ui-panel-status",
  buttonPrimary: "ui-button-primary",
  buttonPrimaryPressed: "ui-button-primary-pressed",
  buttonSecondary: "ui-button-secondary",
  buttonSecondaryPressed: "ui-button-secondary-pressed",
  buttonDisabled: "ui-button-disabled",
  buttonSelected: "ui-button-selected",
  buttonEquipped: "ui-button-equipped",
  buttonBack: "ui-button-back",
  buttonIcon: "ui-button-icon",
  badgeStar: "ui-badge-star",
  badgeCoin: "ui-badge-coin",
  skinCardNormal: "ui-skin-card-normal",
  skinCardSelected: "ui-skin-card-selected",
  skinCardLocked: "ui-skin-card-locked",
  skinCardEquipped: "ui-skin-card-equipped",
  skinCardDisabled: "ui-skin-card-disabled",
} as const;

export type UiIconName =
  | "play"
  | "settings"
  | "hanger"
  | "home"
  | "retry"
  | "back"
  | "lock"
  | "unlock"
  | "check"
  | "equip"
  | "coin"
  | "star"
  | "mute"
  | "volume"
  | "pause"
  | "close"
  | "arrow-left"
  | "arrow-right"
  | "shirt";

const iconKeys: Readonly<Record<UiIconName, string>> = {
  play: "ui-icon-play",
  settings: "ui-icon-settings",
  hanger: "ui-icon-hanger",
  home: "ui-icon-home",
  retry: "ui-icon-retry",
  back: "ui-icon-back",
  lock: "ui-icon-lock",
  unlock: "ui-icon-unlock",
  check: "ui-icon-check",
  equip: "ui-icon-equip",
  coin: "ui-icon-coin",
  star: "ui-icon-star",
  mute: "ui-icon-mute",
  volume: "ui-icon-volume",
  pause: "ui-icon-pause",
  close: "ui-icon-close",
  "arrow-left": "ui-icon-arrow-left",
  "arrow-right": "ui-icon-arrow-right",
  shirt: "ui-icon-shirt",
};

export function uiIconKey(icon: UiIconName): string {
  return iconKeys[icon];
}

export const UI_ASSET_PATHS: Readonly<Record<string, string>> = {
  [UI_KEYS.pauseDialog]: new URL("../../assets/ui/pause/pause-dialog-reference-v1.png", import.meta.url).href,
  [UI_KEYS.titleMain]: new URL("../../assets/ui/title_signs/title_main_blank.png", import.meta.url).href,
  [UI_KEYS.titlePause]: new URL("../../assets/ui/title_signs/title_pause_blank.png", import.meta.url).href,
  [UI_KEYS.titleWardrobe]: new URL("../../assets/ui/title_signs/title_wardrobe_blank.png", import.meta.url).href,
  [UI_KEYS.panelPause]: new URL("../../assets/ui/panels/panel_pause.png", import.meta.url).href,
  [UI_KEYS.panelWardrobe]: new URL("../../assets/ui/panels/panel_wardrobe.png", import.meta.url).href,
  [UI_KEYS.panelSmall]: new URL("../../assets/ui/panels/panel_small.png", import.meta.url).href,
  [UI_KEYS.panelStatus]: new URL("../../assets/ui/panels/panel_status.png", import.meta.url).href,
  [UI_KEYS.buttonPrimary]: new URL("../../assets/ui/buttons/button_primary.png", import.meta.url).href,
  [UI_KEYS.buttonPrimaryPressed]: new URL("../../assets/ui/buttons/button_primary_pressed.png", import.meta.url).href,
  [UI_KEYS.buttonSecondary]: new URL("../../assets/ui/buttons/button_secondary.png", import.meta.url).href,
  [UI_KEYS.buttonSecondaryPressed]: new URL("../../assets/ui/buttons/button_secondary_pressed.png", import.meta.url).href,
  [UI_KEYS.buttonDisabled]: new URL("../../assets/ui/buttons/button_disabled.png", import.meta.url).href,
  [UI_KEYS.buttonSelected]: new URL("../../assets/ui/buttons/button_selected.png", import.meta.url).href,
  [UI_KEYS.buttonEquipped]: new URL("../../assets/ui/buttons/button_equipped.png", import.meta.url).href,
  [UI_KEYS.buttonBack]: new URL("../../assets/ui/buttons/button_back.png", import.meta.url).href,
  [UI_KEYS.buttonIcon]: new URL("../../assets/ui/buttons/button_icon.png", import.meta.url).href,
  [UI_KEYS.badgeStar]: new URL("../../assets/ui/badges/badge_star_blank.png", import.meta.url).href,
  [UI_KEYS.badgeCoin]: new URL("../../assets/ui/badges/badge_coin_blank.png", import.meta.url).href,
  [UI_KEYS.skinCardNormal]: new URL("../../assets/ui/skin_cards/skin_card_normal.png", import.meta.url).href,
  [UI_KEYS.skinCardSelected]: new URL("../../assets/ui/skin_cards/skin_card_selected.png", import.meta.url).href,
  [UI_KEYS.skinCardLocked]: new URL("../../assets/ui/skin_cards/skin_card_locked.png", import.meta.url).href,
  [UI_KEYS.skinCardEquipped]: new URL("../../assets/ui/skin_cards/skin_card_equipped.png", import.meta.url).href,
  [UI_KEYS.skinCardDisabled]: new URL("../../assets/ui/skin_cards/skin_card_disabled.png", import.meta.url).href,
  ["ui-flower-white"]: new URL("../../assets/ui/decorations/flower_white.png", import.meta.url).href,
  ["ui-flower-yellow"]: new URL("../../assets/ui/decorations/flower_yellow.png", import.meta.url).href,
  ["ui-flower-coral"]: new URL("../../assets/ui/decorations/flower_coral.png", import.meta.url).href,
  ["ui-grass"]: new URL("../../assets/ui/decorations/grass_cluster.png", import.meta.url).href,
  ["ui-leaves"]: new URL("../../assets/ui/decorations/leaves_cluster.png", import.meta.url).href,
  ["ui-sparkle"]: new URL("../../assets/ui/decorations/pixel_sparkle.png", import.meta.url).href,
  ["ui-glint"]: new URL("../../assets/ui/decorations/pixel_glint.png", import.meta.url).href,
  ["ui-icon-play"]: new URL("../../assets/ui/icons/icon_play.png", import.meta.url).href,
  ["ui-icon-settings"]: new URL("../../assets/ui/icons/icon_settings.png", import.meta.url).href,
  ["ui-icon-hanger"]: new URL("../../assets/ui/icons/icon_hanger.png", import.meta.url).href,
  ["ui-icon-home"]: new URL("../../assets/ui/icons/icon_home.png", import.meta.url).href,
  ["ui-icon-retry"]: new URL("../../assets/ui/icons/icon_retry.png", import.meta.url).href,
  ["ui-icon-back"]: new URL("../../assets/ui/icons/icon_back.png", import.meta.url).href,
  ["ui-icon-lock"]: new URL("../../assets/ui/icons/icon_lock.png", import.meta.url).href,
  ["ui-icon-unlock"]: new URL("../../assets/ui/icons/icon_unlock.png", import.meta.url).href,
  ["ui-icon-check"]: new URL("../../assets/ui/icons/icon_check.png", import.meta.url).href,
  ["ui-icon-equip"]: new URL("../../assets/ui/icons/icon_equip.png", import.meta.url).href,
  ["ui-icon-coin"]: new URL("../../assets/ui/icons/icon_coin.png", import.meta.url).href,
  ["ui-icon-star"]: new URL("../../assets/ui/icons/icon_star.png", import.meta.url).href,
  ["ui-icon-mute"]: new URL("../../assets/ui/icons/icon_mute.png", import.meta.url).href,
  ["ui-icon-volume"]: new URL("../../assets/ui/icons/icon_volume.png", import.meta.url).href,
  ["ui-icon-pause"]: new URL("../../assets/ui/icons/icon_pause.png", import.meta.url).href,
  ["ui-icon-close"]: new URL("../../assets/ui/icons/icon_close.png", import.meta.url).href,
  ["ui-icon-arrow-left"]: new URL("../../assets/ui/icons/icon_arrow_left.png", import.meta.url).href,
  ["ui-icon-arrow-right"]: new URL("../../assets/ui/icons/icon_arrow_right.png", import.meta.url).href,
  ["ui-icon-shirt"]: new URL("../../assets/ui/icons/icon_shirt.png", import.meta.url).href,
};

export function loadUiAssets(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries(UI_ASSET_PATHS)) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

export function uiButtonTextureKey(style: UiButtonStyle, pressed = false): string {
  if (style === "primary") return pressed ? UI_KEYS.buttonPrimaryPressed : UI_KEYS.buttonPrimary;
  if (style === "secondary") return pressed ? UI_KEYS.buttonSecondaryPressed : UI_KEYS.buttonSecondary;
  if (style === "disabled") return UI_KEYS.buttonDisabled;
  if (style === "selected") return UI_KEYS.buttonSelected;
  if (style === "equipped") return UI_KEYS.buttonEquipped;
  if (style === "back") return UI_KEYS.buttonBack;
  return UI_KEYS.buttonIcon;
}
