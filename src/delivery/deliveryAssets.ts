import forestUrl from '../../assets/delivery-v1/runtime/forest.png?url';
import hillUrl from '../../assets/delivery-v1/runtime/hill.png?url';
import postcardUrl from '../../assets/delivery-v1/runtime/postcard.png?url';
import { WINDMILL_MEADOW_ASSETS } from './windmillMeadowAssets';
export const DELIVERY_ASSETS = [
  { key: 'delivery-forest-v1', url: forestUrl },
  { key: 'delivery-hill-v1', url: hillUrl },
  { key: 'delivery-postcard-v1', url: postcardUrl },
  ...WINDMILL_MEADOW_ASSETS,
] as const;
