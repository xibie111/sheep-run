export const JOURNEY_CARDS_PER_PAGE = 4;

export interface JourneyPages {
  readonly achievements: number;
  readonly postcards: number;
  readonly achievementPages: number;
  readonly postcardPages: number;
  readonly totalPages: number;
}

export interface JourneyPageContent {
  readonly page: number;
  readonly section: "achievements" | "postcards";
  readonly sectionPage: number;
  readonly first: number;
  readonly end: number;
}

const count = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** The two catalogues share navigation, but each starts on its own page. */
export function journeyPages(achievements: number, postcards: number): JourneyPages {
  achievements = count(achievements); postcards = count(postcards);
  const achievementPages = Math.ceil(achievements / JOURNEY_CARDS_PER_PAGE);
  const postcardPages = Math.max(1, Math.ceil(postcards / JOURNEY_CARDS_PER_PAGE));
  return { achievements, postcards, achievementPages, postcardPages, totalPages: achievementPages + postcardPages };
}

/** Drawing, enabled touch targets and activation all use this same catalogue slice. */
export function journeyPageContent(pages: JourneyPages, requestedPage: number): JourneyPageContent {
  const page = Math.min(pages.totalPages - 1, count(requestedPage));
  const section = page < pages.achievementPages ? "achievements" : "postcards";
  const sectionPage = section === "achievements" ? page : page - pages.achievementPages;
  const first = sectionPage * JOURNEY_CARDS_PER_PAGE;
  return { page, section, sectionPage, first, end: Math.min(first + JOURNEY_CARDS_PER_PAGE, pages[section]) };
}

/** Empty cells never have an index, including the last partial postcard page. */
export function journeyCardIndex(content: JourneyPageContent, slot: number): number | undefined {
  if (!Number.isInteger(slot) || slot < 0 || slot >= JOURNEY_CARDS_PER_PAGE) return undefined;
  const index = content.first + slot;
  return index < content.end ? index : undefined;
}
