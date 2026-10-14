const urls = import.meta.glob('../../assets/scenery-v1/runtime/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const travelUrls = import.meta.glob('../../assets/travel-postcards-v2/runtime/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const SCENERY_ASSETS = [
  ...['rainbow', 'meteors', 'fireflies'].map(id => ({ key: `scenery-${id}`, url: urls[`../../assets/scenery-v1/runtime/${id}.png`]!, width: 600, height: 400 })),
  ...['spring-pasture', 'summer-pond', 'autumn-sunset', 'winter-sunshine', 'duck-outing', 'butterfly-path'].map(id => ({ key: `scenery-${id}`, url: travelUrls[`../../assets/travel-postcards-v2/runtime/${id}.png`]!, width: 600, height: 400 })),
];

interface TexturePort { exists(key: string): boolean; get(key: string): { getSourceImage(): { width: number; height: number } } }
export function validateSceneryTextures(scene: { textures: TexturePort }): string[] {
  return SCENERY_ASSETS.filter(asset => {
    if (!asset.url || !scene.textures.exists(asset.key)) return true;
    const image = scene.textures.get(asset.key).getSourceImage();
    return image.width !== asset.width || image.height !== asset.height;
  }).map(asset => asset.key);
}
