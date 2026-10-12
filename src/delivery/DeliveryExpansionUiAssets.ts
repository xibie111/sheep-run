import paperUrl from '../../assets/delivery-expansion-v1/ui/runtime/page-paper.png?url';
import frameUrl from '../../assets/delivery-expansion-v1/ui/runtime/chapter-frame.png?url';
import buttonUrl from '../../assets/delivery-expansion-v1/ui/runtime/action-button.png?url';
import slotUrl from '../../assets/delivery-expansion-v1/ui/runtime/keepsake-slot.png?url';
import goldUrl from '../../assets/delivery-expansion-v1/ui/runtime/rating-gold.png?url';
import grayUrl from '../../assets/delivery-expansion-v1/ui/runtime/rating-gray.png?url';
import counterUrl from '../../assets/delivery-expansion-v1/ui/runtime/stamp-counter.png?url';
import albumUrl from '../../assets/delivery-expansion-v1/ui/runtime/stamp-album.png?url';
import previousUrl from '../../assets/delivery-expansion-v1/ui/runtime/page-previous.png?url';
import nextUrl from '../../assets/delivery-expansion-v1/ui/runtime/page-next.png?url';
import lockUrl from '../../assets/delivery-expansion-v1/ui/runtime/lock.png?url';
import completeUrl from '../../assets/delivery-expansion-v1/ui/runtime/complete-seal.png?url';

export const DELIVERY_EXPANSION_UI_KEYS = {
  paper: 'delivery-expansion-ui-paper', frame: 'delivery-expansion-ui-chapter', button: 'delivery-expansion-ui-button',
  slot: 'delivery-expansion-ui-slot', gold: 'delivery-expansion-ui-rating-gold', gray: 'delivery-expansion-ui-rating-gray',
  counter: 'delivery-expansion-ui-stamp-counter', album: 'delivery-expansion-ui-album',
  previous: 'delivery-expansion-ui-page-previous', next: 'delivery-expansion-ui-page-next',
  lock: 'delivery-expansion-ui-lock', complete: 'delivery-expansion-ui-complete',
} as const;
export const DELIVERY_EXPANSION_UI_ASSETS = [
  { key: DELIVERY_EXPANSION_UI_KEYS.paper, url: paperUrl, width: 512, height: 245 }, { key: DELIVERY_EXPANSION_UI_KEYS.frame, url: frameUrl, width: 256, height: 190 },
  { key: DELIVERY_EXPANSION_UI_KEYS.button, url: buttonUrl, width: 384, height: 80 }, { key: DELIVERY_EXPANSION_UI_KEYS.slot, url: slotUrl, width: 96, height: 96 },
  { key: DELIVERY_EXPANSION_UI_KEYS.gold, url: goldUrl, width: 64, height: 63 }, { key: DELIVERY_EXPANSION_UI_KEYS.gray, url: grayUrl, width: 64, height: 64 },
  { key: DELIVERY_EXPANSION_UI_KEYS.counter, url: counterUrl, width: 64, height: 63 }, { key: DELIVERY_EXPANSION_UI_KEYS.album, url: albumUrl, width: 61, height: 64 },
  { key: DELIVERY_EXPANSION_UI_KEYS.previous, url: previousUrl, width: 64, height: 64 }, { key: DELIVERY_EXPANSION_UI_KEYS.next, url: nextUrl, width: 64, height: 64 },
  { key: DELIVERY_EXPANSION_UI_KEYS.lock, url: lockUrl, width: 51, height: 64 }, { key: DELIVERY_EXPANSION_UI_KEYS.complete, url: completeUrl, width: 63, height: 64 },
] as const;
