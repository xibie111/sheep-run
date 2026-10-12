import { describe, expect, it } from 'vitest';
import { DeliverySelection } from './DeliverySelection';

describe('delivery chapter navigation', () => {
  it('initializes a chosen chapter on its page, falls back safely on invalid ID', () => {
    expect(new DeliverySelection('lighthouse-starlight-v1').page.index).toBe(2);
    expect(new DeliverySelection('future').id).toBe('hill-goodnight-v1');
  });
  it('browses all five chapters without changing the selected route until a card is touched', () => {
    const selection = new DeliverySelection('dinner-for-you-v1');
    expect(selection.movePage(1)).toBe(true); expect(selection.id).toBe('dinner-for-you-v1');
    expect(selection.page.items.map(chapter => chapter.id)).toEqual(['windmill-invitation-v1', 'rainy-umbrella-v1']);
    expect(selection.select('rainy-umbrella-v1')).toBe(true); expect(selection.id).toBe('rainy-umbrella-v1'); expect(selection.page.index).toBe(1);
    expect(selection.select('future')).toBe(false); expect(selection.id).toBe('rainy-umbrella-v1'); expect(selection.page.index).toBe(1);
  });
  it('keeps the same selected chapter and page through brief/postcard returns and retry reads', () => {
    const selection = new DeliverySelection('windmill-invitation-v1');
    const before = [selection.id, selection.page.index];
    for (let i = 0; i < 6; i++) expect([selection.id, selection.page.index]).toEqual(before);
    expect(selection.movePage(-9)).toBe(true); expect(selection.page.index).toBe(0);
    expect(selection.movePage(-1)).toBe(false); expect(selection.movePage(NaN)).toBe(false);
    expect(selection.movePage(99)).toBe(true); expect(selection.page.index).toBe(2);
    expect(selection.movePage(1)).toBe(false); expect(selection.id).toBe('windmill-invitation-v1');
  });
});
