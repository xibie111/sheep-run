export const RUNNER_V2_ASSET_IDS = ['goal-panel', 'goal-stamp', 'response-star', 'response-crown', 'response-heart'] as const;
export type RunnerV2AssetId = typeof RUNNER_V2_ASSET_IDS[number];

export function runnerV2AssetKey(id: RunnerV2AssetId): string { return `runner-v2-${id}`; }

/** Missing local art is a bundle error; runtime loading uses the shared retry flow. */
export function createRunnerV2Assets(urls: Readonly<Record<string, string>>) {
  return RUNNER_V2_ASSET_IDS.map(id => {
    const path = `../../assets/runner-update-v2/runtime/${id}.png`, url = urls[path];
    if (typeof url !== 'string' || !url.trim()) throw new Error(`Missing local runner v2 image: ${id}`);
    return { id, key: runnerV2AssetKey(id), url };
  });
}

const urls = import.meta.glob('../../assets/runner-update-v2/runtime/*.png', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

export const RUNNER_V2_ASSETS = createRunnerV2Assets(urls);
