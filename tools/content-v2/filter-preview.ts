import Phaser from 'phaser';
import { CONTENT_V2_ASSETS, prepareContentV2Textures } from '../../src/content-v2';

/** Separate WebGL-only preload fixture; never imported by production scenes. */
class FilterFixture extends Phaser.Scene {
  preload() { for (const asset of CONTENT_V2_ASSETS) this.load.image(asset.key, asset.url); }
  create() {
    // Prove prepare corrects a previously linear source, rather than merely
    // observing pixelArt's default nearest mode.
    const before = CONTENT_V2_ASSETS.map(asset => {
      const texture = this.textures.get(asset.key);
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      return texture.source[0].scaleMode;
    });
    prepareContentV2Textures(this);
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = renderer.gl;
    const results = CONTENT_V2_ASSETS.map(asset => {
      const source = this.textures.get(asset.key).source[0];
      gl.bindTexture(gl.TEXTURE_2D, source.glTexture!.webGLTexture);
      const min = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER);
      const mag = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER);
      return { key: asset.key, mode: source.scaleMode, nearest: Phaser.Textures.FilterMode.NEAREST,
        min, mag, glNearest: gl.NEAREST, passed: source.scaleMode === Phaser.Textures.FilterMode.NEAREST && min === gl.NEAREST && mag === gl.NEAREST };
    });
    Object.assign(window, { filterReview: { renderer: this.game.renderer.type, webgl: Phaser.WEBGL, before, results,
      passed: before.every(mode => mode === Phaser.Textures.FilterMode.LINEAR) && results.length === CONTENT_V2_ASSETS.length && results.every(result => result.passed) } });
  }
}
new Phaser.Game({ type: Phaser.WEBGL, width: 480, height: 270, pixelArt: true, antialias: false,
  banner: false, scene: [FilterFixture], input: {mouse:false, keyboard:false} });
