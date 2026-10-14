import { describe, expect, it } from "vitest";
import { journeyCardIndex, journeyPageContent, journeyPages } from "./JourneyPostcardPages";

describe("journey postcard catalogue paging", () => {
  it("keeps the existing three postcards after the achievement pages", () => {
    const pages = journeyPages(22, 3);
    expect(pages).toEqual({ achievements: 22, postcards: 3, achievementPages: 6, postcardPages: 1, totalPages: 7 });
    expect(journeyPageContent(pages, 5)).toMatchObject({ section: "achievements", first: 20, end: 22 });
    expect(journeyPageContent(pages, 6)).toMatchObject({ section: "postcards", sectionPage: 0, first: 0, end: 3 });
  });

  it("shows nine postcards in four, four and one cells without duplicating any card", () => {
    const pages = journeyPages(31, 9);
    expect(pages).toMatchObject({ achievementPages: 8, postcardPages: 3, totalPages: 11 });
    const indexes = Array.from({ length: 3 }, (_, localPage) => {
      const content = journeyPageContent(pages, pages.achievementPages + localPage);
      return Array.from({ length: 4 }, (_, slot) => journeyCardIndex(content, slot)).filter(index => index !== undefined);
    });
    expect(indexes).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8]]);
  });

  it("makes the empty cells and invalid slots on the last page untouchable", () => {
    const content = journeyPageContent(journeyPages(8, 9), 4);
    expect(journeyCardIndex(content, 0)).toBe(8);
    for (const slot of [1, 2, 3, 4, -1, 0.5, NaN]) expect(journeyCardIndex(content, slot)).toBeUndefined();
  });

  it("does not reserve a blank extra page for complete groups of four", () => {
    const pages = journeyPages(8, 8);
    expect(pages.totalPages).toBe(4);
    expect(journeyPageContent(pages, 3)).toMatchObject({ section: "postcards", first: 4, end: 8 });
    expect(journeyPageContent(pages, 4).page).toBe(3);
  });

  it("keeps a saved page and selected global card index across relayout", () => {
    const pages = journeyPages(19, 9), savedPage = 6;
    const before = journeyPageContent(pages, savedPage), selected = journeyCardIndex(before, 2);
    const after = journeyPageContent(journeyPages(19, 9), savedPage);
    expect(after).toEqual(before);
    expect(selected).toBe(6);
    expect(journeyCardIndex(after, 2)).toBe(selected);
  });

  it("supports catalogue growth without hard-coding a postcard page count", () => {
    expect(journeyPages(7, 17)).toMatchObject({ achievementPages: 2, postcardPages: 5, totalPages: 7 });
    expect(journeyPageContent(journeyPages(7, 17), 6)).toMatchObject({ first: 16, end: 17 });
  });

  it("clamps stale navigation bounds without changing a valid current page", () => {
    const pages = journeyPages(8, 9);
    expect(journeyPageContent(pages, -1).page).toBe(0);
    expect(journeyPageContent(pages, 500).page).toBe(4);
    expect(journeyPageContent(pages, NaN).page).toBe(0);
    expect(journeyPageContent(pages, 3).page).toBe(3);
  });

  it("provides a safe empty scenery page if there is no catalogue content", () => {
    const pages = journeyPages(0, 0), content = journeyPageContent(pages, 0);
    expect(pages.totalPages).toBe(1);
    expect(content).toMatchObject({ section: "postcards", first: 0, end: 0 });
    expect(journeyCardIndex(content, 0)).toBeUndefined();
  });
});
