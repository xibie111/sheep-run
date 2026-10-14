export const WORLD = {
  width: 480,
  height: 270,
  groundY: 218,
} as const;

export const PLAYER = {
  x: 80,
  width: 42,
  height: 38,
  displayWidth: 48,
  displayHeight: 42,
  crouchDisplayHeight: 30,
  crouchBodyHeight: 18,
  gravityY: 1450,
  jumpVelocityY: -500,
  highJumpVelocityY: -580,
  // Keep upgraded high jumps close to the tallest ground obstacle as well.
  maxHighJumpSpeed: 590,
} as const;

export const INPUT = {
  tapTravelPx: 20,
  swipeMinDistancePx: 28,
  swipeVerticalRatio: 1.3,
  holdThresholdMs: 260,
  crouchDurationMs: 320,
  coyoteTimeMs: 120,
  jumpBufferMs: 120,
  dashInvulnerabilityMs: 280,
  dashCooldownMs: 850,
} as const;

export const GAME_FEATURES = {
  dash: false,
} as const;

export const RUN = {
  initialSpeed: 190,
  speedAcceleration: 5.1,
  maxSpeed: 390,
  distanceScale: 0.12,
  simulationDeltaCapMs: 40,
  obstacleBonus: 25,
  starBonus: 100,
  safeSpawnWindow: 1.25,
  minimumJumpDistance: 250,
  minimumReactionTime: 0.9,
  obstacleSpacing: 220,
  obstacleGapVariation: 80,
  starSpawnDelay: 1.1,
  starIntervalMin: 1.55,
  starIntervalMax: 2.25,
} as const;

export const ENVIRONMENT = {
  dayPhaseDistancePx: 3000,
  seasonLengthPx: 12000,
  weatherSegmentDistancePx: 8000,
  tintTransitionDistancePx: 600,
  weatherFadeDistancePx: 600,
  maxRainParticles: 64,
  maxWindParticles: 12,
  chunkWidthPx: 480,
  chunksBehind: 1,
  chunksAhead: 3,
  maxChunks: 6,
  parallaxRatios: {
    sky: 0,
    cloud: 0.07,
    farMountain: 0.15,
    treeLine: 0.24,
    farmBuilding: 0.34,
    field: 0.48,
    fence: 0.65,
    ground: 1,
    foregroundGrass: 1.25,
  },
} as const;

export const POWER_UP = {
  durationsMs: { magnet: 8000, shield: 6000, starMultiplier: 8000, dash: 7000 },
  magnetRadiusPx: 110,
  dashCooldownScale: 0.5,
  starScoreMultiplier: 2,
  spawnDelaySeconds: 14,
  spawnIntervalMinSeconds: 16,
  spawnIntervalMaxSeconds: 22,
} as const;

export const POOL = {
  obstaclesPerKind: 3,
  stars: 3,
  powerUps: 2,
} as const;

export const COLORS = {
  ink: "#4a382f",
  inkSoft: "#725b48",
  paper: "#fff3d6",
  sky: "#b4ddd1",
  skyLight: "#e7f0c5",
  cloud: "#fff1d5",
  hillFar: "#aecb83",
  hillNear: "#82ad6c",
  grass: "#6c9c5c",
  grassLight: "#9fc76b",
  grassDark: "#3f704b",
  mint: "#8fc276",
  soil: "#b8774d",
  soilLight: "#d79a61",
  woodLight: "#d09458",
  woodDark: "#6b493b",
  wool: "#fff7da",
  woolShade: "#ded4b7",
  face: "#c28d6a",
  coral: "#d96d54",
  yellow: "#f5c85d",
} as const;

export const SCENE = {
  boot: "BootScene",
  preload: "PreloadScene",
  menu: "MenuScene",
  run: "RunScene",
  pause: "PauseScene",
  wardrobe: "WardrobeScene",
  result: "ResultScene",
} as const;

export const STORAGE = {
  saveKey: "sheep-run-save",
  legacyBestKey: "sheep-run-best-v1",
} as const;
