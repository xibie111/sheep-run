import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENERY_CARDS, SCENERY_COPY } from './sceneryCatalog';
describe('postcard glyphs',()=>{
  it.each([12,20,40,64])('contains all scenery copy in the local %i atlas',size=>{
    const xml=readFileSync(new URL(`../../assets/fonts/pasture-display-${size}.fnt`,import.meta.url),'utf8');
    const ids=new Set([...xml.matchAll(/<char id="(\d+)"/g)].map(m=>Number(m[1])));
    for(const char of new Set([...SCENERY_COPY+SCENERY_CARDS.map(c=>c.title+c.hint+c.message).join('')]))expect(ids.has(char.codePointAt(0)!),char).toBe(true);
  });
});
