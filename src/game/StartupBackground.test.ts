import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

describe('startup background handoff', () => {
  it('uses the loading sky colour for the web root, WebView, native window and launch theme without changing the launcher art', () => {
    const sky = read('loading.css').match(/background:\s*(#[0-9a-f]{6})/i)![1];
    expect(read('style.css')).toMatch(new RegExp(`background:\\s*${sky}`, 'i'));
    expect(read('capacitor.config.ts')).toContain(`backgroundColor: "${sky}"`);
    expect(read('src/game/GameConfig.ts')).toContain(`backgroundColor: "${sky}"`);
    const rgb = [1, 3, 5].map(offset => parseInt(sky.slice(offset, offset + 2), 16));
    const activity = read('android/app/src/main/java/com/sheeprun/game/MainActivity.java');
    expect(activity.match(new RegExp(`Color\\.rgb\\(${rgb.join(', ')}\\)`, 'g'))).toHaveLength(2);
    const theme = read('android/app/src/main/res/values/styles.xml');
    for (const name of ['android:windowBackground', 'android:background', 'windowSplashScreenBackground'])
      expect(theme).toContain(`<item name="${name}">${sky}</item>`);
    expect(theme).toContain('<item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>');
  });
});
