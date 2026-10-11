import mailboxUrl from "../../assets/mailbox-v1/runtime/mailbox.png?url";
import panelUrl from "../../assets/mailbox-ui-v2/runtime/mail-letter-panel.png?url";
import plainUrl from "../../assets/mailbox-ui-v2/runtime/mail-button-plain.png?url";
import floralUrl from "../../assets/mailbox-ui-v2/runtime/mail-button-floral.png?url";

export const MAILBOX_ASSETS = [
  { key: "mailbox-v1", url: mailboxUrl },
  { key: "mail-letter-panel-v2", url: panelUrl },
  { key: "mail-button-plain-v2", url: plainUrl },
  { key: "mail-button-floral-v2", url: floralUrl },
] as const;
export const MAILBOX_ART = { ...MAILBOX_ASSETS[0], width: 28, height: 58, pivot: { x: 16, y: 13 } } as const;
export const MAIL_PANEL_ART = { ...MAILBOX_ASSETS[1], width: 940, height: 866 } as const;
export const MAIL_BUTTON_ART = { plain: MAILBOX_ASSETS[2].key, floral: MAILBOX_ASSETS[3].key } as const;
