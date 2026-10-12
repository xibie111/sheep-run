import type { ThemeId } from "../environment/types";

export interface TripNamedEvent { readonly id: string; readonly name: string }
export interface TripGoalRecord { readonly id: string; readonly title: string; readonly completed: boolean }

/** A supplies facts observed in this run. Omitted fields mean unknown, never zero. */
export interface TripCardInput {
  readonly protagonist?: TripNamedEvent;
  readonly seasons?: readonly ThemeId[];
  readonly starsCollected?: number;
  readonly companionSkins?: readonly TripNamedEvent[];
  readonly animals?: readonly TripNamedEvent[];
  readonly landmarks?: readonly TripNamedEvent[];
  readonly newCollections?: readonly TripNamedEvent[];
  readonly goals?: readonly TripGoalRecord[];
  readonly newRecord?: boolean;
}

export type TripHighlightKind = "record" | "collection" | "goal" | "companion" | "animal" | "landmark";
export interface TripHighlight { kind: TripHighlightKind; text: string; ids: readonly string[] }
export interface TripCardModel {
  title: string;
  protagonist?: TripNamedEvent;
  seasons: readonly ThemeId[];
  summary: string;
  highlights: readonly TripHighlight[];
  footer: string;
}

const SEASONS: Record<ThemeId, string> = { spring: "春日牧场", summer: "夏日牧场", autumn: "秋日牧场", winter: "冬日牧场" };

/** Include punctuation and templates as well as literal UI labels in A's glyph pass. */
export const TRIP_COPY = [
  "这次旅行", "查看这次旅行", "收好旅行卡", "本局小羊", "旅途印记",
  "春日牧场", "夏日牧场", "秋日牧场", "冬日牧场",
  "今天跑过了", "收好了", "颗星星", "这一小段旅程，也值得好好收起。",
  "还没有收起星星，下一段路再慢慢找。", "还没有收起星星", "刷新了牧场纪录！", "新收好了", "件收藏",
  "完成了", "个目标", "陪你走了一段路。", "遇见了", "经过了", "等", "和",
  "把这一程，轻轻收在心里。", "、，。！「」0123456789… · ",
] as const;

function realEvents(values?: readonly TripNamedEvent[]): TripNamedEvent[] {
  const seen = new Set<string>();
  return (values ?? []).filter(value => {
    if (!value || typeof value.id !== "string" || !value.id.trim() || typeof value.name !== "string" || !value.name.trim() || seen.has(value.id)) return false;
    seen.add(value.id); return true;
  }).map(value => ({ id: value.id, name: value.name.trim() }));
}

/** Bound generated sentences without replacing actual names with invented ones. */
function listNames(values: readonly { name: string }[]): string {
  const first = values.slice(0, 2).map(value => shortenTripText(value.name, 18)).join("和");
  return values.length > 2 ? `${first}等` : first;
}

export function shortenTripText(value: string, maximumCharacters: number): string {
  const characters = [...value];
  return characters.length <= maximumCharacters ? value : `${characters.slice(0, Math.max(0, maximumCharacters - 1)).join("")}…`;
}

/** Only completed/observed facts become copy; at most three meaningful moments. */
export function tripCardModel(input: TripCardInput = {}): TripCardModel {
  const seasons = [...new Set(input.seasons ?? [])].filter((id): id is ThemeId => Object.hasOwn(SEASONS, id));
  const stars = typeof input.starsCollected === "number" && Number.isFinite(input.starsCollected) && input.starsCollected >= 0 ? Math.floor(input.starsCollected) : undefined;
  const clauses: string[] = [];
  if (seasons.length) clauses.push(`今天跑过了${seasons.map(id => SEASONS[id]).join("、")}`);
  if (stars !== undefined && stars > 0) clauses.push(`收好了${BigInt(stars)}颗星星`);
  if (stars === 0 && seasons.length) clauses.push("还没有收起星星");
  const summary = clauses.length ? `${clauses.join("，")}。` : stars === 0 ? "还没有收起星星，下一段路再慢慢找。" : "这一小段旅程，也值得好好收起。";
  const highlights: TripHighlight[] = [];
  if (input.newRecord === true) highlights.push({ kind: "record", text: "刷新了牧场纪录！", ids: [] });
  const collections = realEvents(input.newCollections);
  if (collections.length) highlights.push({ kind: "collection", text: `新收好了${listNames(collections)}${collections.length > 2 ? `${collections.length}件收藏` : ""}。`, ids: collections.map(value => value.id) });
  const goals = (input.goals ?? []).filter(goal => goal && goal.completed === true && typeof goal.id === "string" && goal.id.trim() && typeof goal.title === "string" && goal.title.trim());
  const completed = [...new Map(goals.map(goal => [goal.id, goal])).values()];
  if (completed.length) highlights.push({ kind: "goal", text: completed.length === 1 ? `完成了「${shortenTripText(completed[0].title, 24)}」。` : `完成了${completed.length}个目标。`, ids: completed.map(goal => goal.id) });
  const companions = realEvents(input.companionSkins);
  if (companions.length) highlights.push({ kind: "companion", text: `${listNames(companions)}陪你走了一段路。`, ids: companions.map(value => value.id) });
  const animals = realEvents(input.animals);
  if (animals.length) highlights.push({ kind: "animal", text: `遇见了${listNames(animals)}。`, ids: animals.map(value => value.id) });
  const landmarks = realEvents(input.landmarks);
  if (landmarks.length) highlights.push({ kind: "landmark", text: `经过了${listNames(landmarks)}。`, ids: landmarks.map(value => value.id) });
  const protagonist = realEvents(input.protagonist ? [input.protagonist] : undefined)[0];
  return { title: "这次旅行", protagonist, seasons, summary, highlights: highlights.slice(0, 3), footer: "把这一程，轻轻收在心里。" };
}

/** Measure with the actual local bitmap painter; keep closing marks off line starts. */
export function wrapTripText(value: string, width: number, measure: (text: string) => number, maximumLines: number): string[] {
  if (!value || width <= 0 || maximumLines <= 0) return [];
  const rows: string[] = []; let row = "";
  for (const char of value) {
    if (row && measure(row + char) > width) {
      if (/^[，。！？」、；：]/.test(char)) {
        const letters = [...row], tail = letters.pop()!;
        if (letters.length) { rows.push(letters.join("")); row = tail; }
        else { rows.push(row); row = ""; }
      } else { rows.push(row); row = ""; }
    }
    row += char;
  }
  if (row) rows.push(row);
  if (rows.length <= maximumLines) return rows;
  const result = rows.slice(0, maximumLines);
  let last = result[maximumLines - 1];
  while (last && measure(last + "…") > width) last = [...last].slice(0, -1).join("");
  result[maximumLines - 1] = last + "…";
  return result;
}
