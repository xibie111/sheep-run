import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAIL_LETTERS, MAIL_UI_COPY } from "./mailLetters";

describe("bundled mailbox glyph coverage", () => {
  const copy = MAIL_UI_COPY + MAIL_LETTERS.map(letter => letter.title + letter.paragraphs.join("") + letter.signature).join("");
  it.each([12, 20, 40, 64])("contains real ink for every confirmed letter and label at %i", size => {
    const xml = readFileSync(new URL(`../../assets/fonts/pasture-display-${size}.fnt`, import.meta.url), "utf8");
    const chars = new Map([...xml.matchAll(/<char\s+([^>]+)\/>/g)].map(match => {
      const attributes = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(entry => [entry[1], entry[2]]));
      return [Number(attributes.id), attributes];
    }));
    for (const char of new Set([...copy])) {
      const glyph = chars.get(char.codePointAt(0)!);
      expect(glyph, `missing ${char}`).toBeDefined();
      if (char.trim()) expect(Number(glyph!.width) * Number(glyph!.height), `empty glyph ${char}`).toBeGreaterThan(0);
    }
  });
});
