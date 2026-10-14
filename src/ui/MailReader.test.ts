import { describe, expect, it, vi } from "vitest";
import { MAIL_LETTERS } from "../data/mailLetters";
import { MailReadStore } from "../systems/MailReadStore";
import { MailReader, paginateMail, wrapMailParagraph } from "./MailReader";

describe("explicit mailbox reading actions", () => {
  const harness = () => {
    const port = { getItem: () => null, setItem: vi.fn() }, store = new MailReadStore(() => port);
    return { store, port, reader: new MailReader(MAIL_LETTERS, store) };
  };
  it("open, flip, back and reopening do not mark a letter read", () => {
    const { reader, store, port } = harness();
    reader.open("welcome-v1"); reader.relayout(s => [...s].length <= 24, 108);
    reader.flip(1); reader.back(); reader.open("goodnight-v1"); reader.back();
    expect(store.load().readIds).toEqual([]); expect(port.setItem).not.toHaveBeenCalled();
  });
  it("only the last page permits keeping, once, and returns to the list", () => {
    const { reader, store, port } = harness(); reader.open("welcome-v1"); reader.relayout(s => s.length <= 24, 108);
    expect(reader.pages.length).toBeGreaterThan(1); expect(reader.keep()).toBe(false);
    reader.flip(999); expect(reader.keep()).toBe(true); expect(reader.letter).toBeUndefined();
    expect(reader.keep()).toBe(false); expect(port.setItem).toHaveBeenCalledOnce();
    expect(store.load().readIds).toEqual(["welcome-v1"]);
  });
  it("rejects an unknown letter and can reread a kept one", () => {
    const { reader, store } = harness(); expect(reader.open("missing")).toBe(false);
    reader.open("goodnight-v1"); reader.relayout(() => true, 1000); reader.keep();
    expect(reader.open("goodnight-v1")).toBe(true); expect(store.load().readIds).toEqual(["goodnight-v1"]);
  });
  it("retains an approximate content anchor when resizing pages", () => {
    const { reader } = harness(); reader.open("welcome-v1"); reader.relayout(s => s.length <= 18, 90); reader.flip(1);
    const anchor = reader.pages[reader.page][0].offset;
    reader.relayout(s => s.length <= 32, 180);
    expect(reader.pages[reader.page][0].offset).toBeLessThanOrEqual(anchor);
    expect(reader.page).toBeLessThan(reader.pages.length);
  });
  it('checks optional story access before accepting a direct letter request', () => {
    const { store, port } = harness(); let unlocked = false;
    const reader = new MailReader(MAIL_LETTERS, store, id => unlocked && id === 'welcome-v1');
    expect(reader.open('welcome-v1')).toBe(false); expect(reader.letter).toBeUndefined();
    unlocked = true; expect(reader.open('welcome-v1')).toBe(true);
    expect(reader.open('goodnight-v1')).toBe(false); expect(reader.letter?.id).toBe('welcome-v1');
    expect(port.setItem).not.toHaveBeenCalled();
  });
});
describe("mail pagination preserves confirmed content", () => {
  it("keeps a closing body line with a signature-only last page when space allows", () => {
    const pages = paginateMail({ id: "fixture", title: "", paragraphs: ["一段正文", "另一段正文"], signature: "署名" }, () => true, 52);
    expect(pages).toHaveLength(2);
    expect(pages[1].map(row => row.text)).toEqual(["另一段正文", "署名"]);
    expect(pages[1][1].y).toBe(26);
    expect(pages.flat().every(row => row.y + row.height <= 52)).toBe(true);
  });
  it.each(MAIL_LETTERS)("preserves every character, paragraph and signature of $id at different sizes", letter => {
    for (const [columns, height] of [[24, 108], [38, 160], [48, 246]]) {
      const pages = paginateMail(letter, s => [...s].length <= columns, height);
      const rows = pages.flat();
      [...letter.paragraphs, letter.signature].forEach((paragraph, index) => expect(rows.filter(row => row.paragraph === index).map(row => row.text).join("")).toBe(paragraph));
      expect(rows.filter(row => row.signature).map(row => row.text).join("")).toBe("爱你的小杨同学");
      expect(rows.every(row => row.y >= 0 && row.y + row.height <= height)).toBe(true);
      expect(pages.every(page => page.length > 0)).toBe(true);
    }
  });
  it("preserves paragraph gaps and keeps punctuation off line starts", () => {
    const rows = wrapMailParagraph("这是《小羊快跑》哦！真的。", s => s.length <= 6);
    expect(rows.join("")).toBe("这是《小羊快跑》哦！真的。");
    expect(rows.every(row => row.length <= 6 && !/^[。，！？）》]/.test(row))).toBe(true);
    const pages = paginateMail(MAIL_LETTERS[0], () => true, 1000);
    expect(pages[0][1].y - pages[0][0].y).toBe(26);
  });
});
