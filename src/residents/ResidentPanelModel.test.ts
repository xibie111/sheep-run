import { describe, expect, it, vi } from 'vitest';
import { ResidentPanelModel } from './ResidentPanelModel';
import { RESIDENTS } from './ResidentCatalog';
import { RESIDENT_LETTERS } from './ResidentLetters';
import { MailReadStore } from '../systems/MailReadStore';

function harness(completedIds: string[] = []) {
  let raw: string | null = null;
  const port = { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
  const read = new MailReadStore(() => port);
  return { completedIds, read, port, model: new ResidentPanelModel(() => ({ completedIds, readIds: read.load().readIds }), read) };
}

describe('resident story UI navigation', () => {
  it.each(RESIDENTS)('offers $name first story and refuses direct requests for future letters, stages and rewards', resident => {
    const { model, port } = harness();
    expect(model.selectResident(resident.id)).toBe(true);
    expect(model.selectedStage?.stage.chapterId).toBe(resident.stages[0].chapterId);
    expect(model.selectStage(1)).toBe(false); expect(model.selectStage(2)).toBe(false);
    for (const stage of resident.stages) expect(model.openLetter(stage.letterId)).toBe(false);
    expect(model.showKeepsake()).toBe(false); expect(model.showGroup()).toBe(false);
    expect(model.mode).toBe('detail'); expect(port.setItem).not.toHaveBeenCalled();
  });

  it('recognizes an old first success and offers the next commission before any letter is read', () => {
    const resident = RESIDENTS[0], { model, completedIds, read } = harness([resident.stages[0].chapterId]);
    model.selectResident(resident.id);
    expect(model.selectedStage?.stage.index).toBe(2); expect(model.selected?.unreadCount).toBe(1);
    model.showLetters(); expect(model.openLetter(resident.stages[0].letterId)).toBe(true);
    model.reader.relayout(value => [...value].length <= 18, 90, 17, 8);
    expect(model.keepLetter()).toBe(false); model.back(); model.back();
    expect(read.load().readIds).toEqual([]); expect(model.mode).toBe('detail');
    completedIds.push(resident.stages[1].chapterId);
    model.selectResident(resident.id); expect(model.selectedStage?.stage.index).toBe(3);
  });

  it('browses all nine letters across bounded pages without opening locked entries', () => {
    const { model } = harness(); model.showLetters();
    const seen: string[] = [];
    for (let page = 0; page < 3; page++) { seen.push(...model.letters.items.map(letter => letter.id)); model.moveLetters(1); }
    expect(seen).toEqual(RESIDENT_LETTERS.map(letter => letter.id)); expect(new Set(seen).size).toBe(9);
    expect(model.letters.index).toBe(2); expect(model.letters.count).toBe(3);
    model.moveLetters(-99); expect(model.letters.index).toBe(0);
    expect(model.openLetter(RESIDENT_LETTERS[0].id)).toBe(false);
  });

  it.each(RESIDENT_LETTERS)('preserves all text and signs only $id read on its last page', letter => {
    const completed = RESIDENTS.flatMap(resident => resident.stages.map(stage => stage.chapterId));
    const { model, read, port } = harness(completed);
    model.showLetters(); expect(model.openLetter(letter.id)).toBe(true);
    model.reader.relayout(value => [...value].length <= 18, 90, 17, 8);
    const lines = model.reader.pages.flat();
    [...letter.paragraphs, letter.signature].forEach((paragraph, index) => {
      expect(lines.filter(line => line.paragraph === index).map(line => line.text).join('')).toBe(paragraph);
    });
    expect(model.reader.pages.length).toBeGreaterThan(1);
    expect(model.keepLetter()).toBe(false); expect(port.setItem).not.toHaveBeenCalled();
    model.reader.flip(99); expect(model.keepLetter()).toBe(true);
    expect(model.mode).toBe('letters'); expect(read.load().readIds).toEqual([letter.id]);
    model.openLetter(letter.id); model.reader.relayout(() => true, 1000); model.keepLetter();
    expect(port.setItem).toHaveBeenCalledOnce();
  });

  it('unlocks each ending illustration independently and the group only after all stories succeed', () => {
    const { model, completedIds } = harness();
    for (const [index, resident] of RESIDENTS.entries()) {
      completedIds.push(...resident.stages.map(stage => stage.chapterId));
      model.selectResident(resident.id); expect(model.showKeepsake()).toBe(true);
      expect(model.mode).toBe('keepsake'); model.back(); expect(model.mode).toBe('detail');
      expect(model.showGroup()).toBe(index === 2);
    }
    expect(model.mode).toBe('group'); model.back(); expect(model.mode).toBe('list');
    model.reset(); expect(model.residentId).toBeUndefined(); expect(model.reader.letter).toBeUndefined();
  });
});
