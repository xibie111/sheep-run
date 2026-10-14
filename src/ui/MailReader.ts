import type { MailLetter } from "../data/mailLetters";
import type { MailReadStore } from "../systems/MailReadStore";

export interface MailLine { text: string; paragraph: number; signature: boolean; offset: number; y: number; height: number }
export type MailPage = readonly MailLine[];
type Fits = (text: string) => boolean;

/** Wrap whole Unicode characters, preserving every character and paragraph. */
export function wrapMailParagraph(value: string, fits: Fits): string[] {
  const rows: string[] = []; let row = "";
  for (const char of value) {
    if (row && !fits(row + char)) {
      const chars = [...row];
      // Keep closing punctuation off the beginning and an opening quote off the end.
      const carry = (/[。，！？、；：）》」』]/.test(char) || /[（《「『]$/.test(row)) && chars.length > 1 ? chars.pop()! : "";
      rows.push(chars.join("")); row = carry;
    }
    row += char;
  }
  if (row) rows.push(row);
  return rows;
}

export function paginateMail(letter: MailLetter, fits: Fits, height: number, lineHeight = 18, paragraphGap = 8): MailPage[] {
  if (height < lineHeight) throw new Error("Mail reading area needs at least one full line");
  const pages: MailLine[][] = [[]]; let y = 0, offset = 0;
  [...letter.paragraphs, letter.signature].forEach((paragraph, index) => {
    wrapMailParagraph(paragraph, fits).forEach((text, row) => {
      let gap = row === 0 && index > 0 && y > 0 ? paragraphGap : 0;
      if (y + gap + lineHeight > height) { pages.push([]); y = 0; gap = 0; }
      y += gap;
      pages[pages.length - 1].push({ text, paragraph: index, signature: index === letter.paragraphs.length, offset, y, height: lineHeight });
      offset += [...text].length; y += lineHeight;
    });
  });
  const last = pages[pages.length - 1], previous = pages[pages.length - 2];
  // Avoid leaving only a signature on an otherwise empty final sheet.
  if (previous && previous.length > 1 && last.every(row => row.signature) && (last.length + 1) * lineHeight + paragraphGap <= height) {
    const closingLine = previous.pop()!;
    last.forEach((row, index) => { row.y = lineHeight + paragraphGap + index * lineHeight; });
    last.unshift({ ...closingLine, y: 0 });
  }
  return pages;
}

/** Opening, returning and flipping deliberately have no persistence side effects. */
export class MailReader {
  letter?: MailLetter;
  page = 0;
  pages: MailPage[] = [];
  constructor(private readonly letters: readonly MailLetter[], private readonly store: MailReadStore,
    private readonly canOpen: (id: string) => boolean = () => true) {}
  open(id: string): boolean {
    const letter = this.letters.find(item => item.id === id);
    if (!letter || !this.canOpen(id)) return false;
    this.letter = letter; this.page = 0; this.pages = []; return true;
  }
  back(): void { this.letter = undefined; this.page = 0; this.pages = []; }
  relayout(fits: Fits, height: number, lineHeight = 18, paragraphGap = 8): void {
    if (!this.letter) return;
    const anchor = this.pages[this.page]?.[0]?.offset ?? 0;
    this.pages = paginateMail(this.letter, fits, height, lineHeight, paragraphGap);
    this.page = 0;
    this.pages.forEach((rows, index) => { if ((rows[0]?.offset ?? 0) <= anchor) this.page = index; });
  }
  flip(direction: number): void { this.page = Math.max(0, Math.min(this.pages.length - 1, this.page + direction)); }
  get canKeep(): boolean { return Boolean(this.letter && this.pages.length && this.page === this.pages.length - 1); }
  keep(): boolean {
    if (!this.canKeep) return false;
    this.store.markRead(this.letter!.id); this.back(); return true;
  }
}
