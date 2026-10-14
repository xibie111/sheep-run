import { describe, expect, it } from 'vitest';
import { DeliverySelection } from './DeliverySelection';
import { DELIVERY_CHAPTERS } from './DeliveryChapters';
import { RESIDENTS } from '../residents/ResidentCatalog';

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
    expect(selection.movePage(99)).toBe(true); expect(selection.page.index).toBe(Math.ceil(DELIVERY_CHAPTERS.length / 2) - 1);
    expect(selection.movePage(1)).toBe(false); expect(selection.id).toBe('windmill-invitation-v1');
  });
  it('keeps all original five chapters freely selectable and rejects the six new locked routes', () => {
    const completed: string[] = [], selection = new DeliverySelection(undefined, () => completed);
    for (const chapter of DELIVERY_CHAPTERS.slice(0, 5)) expect(selection.select(chapter.id)).toBe(true);
    for (const resident of RESIDENTS) {
      const before = selection.id;
      expect(selection.select(resident.stages[1].chapterId)).toBe(false); expect(selection.id).toBe(before);
      expect(selection.select(resident.stages[2].chapterId)).toBe(false);
      completed.push(resident.stages[0].chapterId);
      expect(selection.select(resident.stages[1].chapterId)).toBe(true);
      expect(selection.select(resident.stages[2].chapterId)).toBe(false);
      completed.push(resident.stages[1].chapterId);
      expect(selection.select(resident.stages[2].chapterId)).toBe(true);
    }
  });
  it('does not retain a directly requested locked route and rechecks access when saves change', () => {
    const completed: string[] = [], id = RESIDENTS[0].stages[1].chapterId;
    const selection = new DeliverySelection(id, () => completed);
    expect(selection.id).toBe('hill-goodnight-v1'); expect(selection.canSelect(id)).toBe(false);
    completed.push(RESIDENTS[0].stages[0].chapterId); expect(selection.select(id)).toBe(true);
    completed.length = 0; expect(selection.canSelect(selection.id)).toBe(false);
  });
});
