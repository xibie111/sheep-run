const urls = import.meta.glob('../../assets/scenery-v1/runtime/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const SCENERY_ASSETS = ['rainbow', 'meteors', 'fireflies'].map(id => ({ key: `scenery-${id}`, url: urls[`../../assets/scenery-v1/runtime/${id}.png`]! }));
