/** Separate distant scenery, unique destination and repeating near grass. */
export const WINDMILL_MEADOW_ART = {
  backdrop: {
    key: 'windmill-meadow-physics-backdrop',
    url: new URL('../../assets/windmill-physics-v1/runtime/backdrop.png', import.meta.url).href,
  },
  landmark: {
    key: 'windmill-meadow-physics-landmark',
    url: new URL('../../assets/windmill-physics-v1/runtime/windmill.png', import.meta.url).href,
  },
  grass: {
    key: 'windmill-meadow-physics-grass',
    url: new URL('../../assets/windmill-physics-v1/runtime/grass.png', import.meta.url).href,
  },
} as const;

export const WINDMILL_MEADOW_ASSETS = [
  WINDMILL_MEADOW_ART.backdrop,
  WINDMILL_MEADOW_ART.landmark,
  WINDMILL_MEADOW_ART.grass,
] as const;
