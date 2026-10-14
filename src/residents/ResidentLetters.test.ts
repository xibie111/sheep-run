import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { RESIDENT_LETTERS } from './ResidentLetters';
import { RESIDENTS } from './ResidentCatalog';
import { getUnlockedResidentLetters } from './ResidentProgress';
import { MailReader, paginateMail } from '../ui/MailReader';
import { MailReadStore } from '../systems/MailReadStore';

// SHA-256(title + LF + each original paragraph + LF + signature), independently
// computed from the approved user attachment, excluding its enclosing quotation marks.
const approved = {
  'resident-windmill-letter-1-v1': '5234033e3400dba02c1ab31dc6eaeab3e07e496f371b9a37fa95224874476409',
  'resident-windmill-letter-2-v1': '096b5a059c63f82d470fa3e9ca3ff66db0f5ccb74185696f5c04eed9516a2367',
  'resident-windmill-letter-3-v1': 'bcf1aa79b7affcdab1bc30ecebd0077178163f847daba32161fd9072de5cd8bc',
  'resident-riverside-letter-1-v1': '2f05a66fcb74e49a8683eb6c5497bba68d80d3774012f74c6caa893134949d7e',
  'resident-riverside-letter-2-v1': 'fd3ca011ce0703207ebe96a55ca3f86b577384ae2b5b6163cc2303fdc3c7c135',
  'resident-riverside-letter-3-v1': '9f188ccb83f4dacd53c87fb10d67a815966f4ef33cf19ba4d4ca4bec7c7f6369',
  'resident-lighthouse-letter-1-v1': '30d21379382ba0f0ba722eee4d94b1e8d1bb13580a301f63e57816cc35dd1149',
  'resident-lighthouse-letter-2-v1': 'dc91f06f5a1e3229b46e350235c9a5cc95381024f55bab002c7b35466dcfca26',
  'resident-lighthouse-letter-3-v1': '7a02f3139d855a171bca0b0605b96beed60bffc9ce6cf5b09858abbec57652db',
};
describe('approved resident replies', () => {
  it('contains all nine stable replies with every approved title, paragraph and signature unchanged', () => {
    expect(RESIDENT_LETTERS.map(letter => letter.id)).toEqual(Object.keys(approved));
    expect(RESIDENTS.flatMap(resident => resident.stages.map(stage => stage.letterId))).toEqual(Object.keys(approved));
    for (const letter of RESIDENT_LETTERS) {
      const hash = createHash('sha256').update([letter.title, ...letter.paragraphs, letter.signature].join('\n')).digest('hex');
      expect(hash, letter.id).toBe(approved[letter.id as keyof typeof approved]);
    }
  });
  it.each(RESIDENT_LETTERS)('paginates $title without deleting or duplicating narrative characters', letter => {
    const pages = paginateMail(letter, value => [...value].length <= 17, 85, 17, 10);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().map(row => row.text).join('')).toBe([...letter.paragraphs, letter.signature].join(''));
    expect(pages.flat().every(row => row.y >= 0 && row.y + row.height <= 85)).toBe(true);
  });
  it('opens only unlocked replies and records reading only when explicitly kept on the final page', () => {
    const port = { getItem: () => null, setItem: vi.fn() }, store = new MailReadStore(() => port);
    const reader = new MailReader(getUnlockedResidentLetters(['windmill-invitation-v1']), store);
    expect(reader.open('resident-windmill-letter-2-v1')).toBe(false);
    expect(reader.open('resident-windmill-letter-1-v1')).toBe(true);
    reader.relayout(value => [...value].length <= 17, 85, 17, 10);
    expect(reader.keep()).toBe(false); reader.flip(1); reader.back();
    expect(port.setItem).not.toHaveBeenCalled();
    reader.open('resident-windmill-letter-1-v1'); reader.relayout(value => [...value].length <= 17, 85, 17, 10);
    reader.flip(999); expect(reader.keep()).toBe(true);
    expect(store.load().readIds).toEqual(['resident-windmill-letter-1-v1']);
    expect(port.setItem).toHaveBeenCalledTimes(1);
  });
});
