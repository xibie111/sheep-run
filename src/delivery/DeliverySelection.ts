import { defaultDeliveryChapter, getDeliveryChapter, type DeliveryChapter, type DeliveryChapterId } from './DeliveryChapters';
/** Selection is ephemeral; it never changes route completion or any gameplay storage. */
export class DeliverySelection {
  private selected: DeliveryChapter = defaultDeliveryChapter();
  constructor(id?: string) { if (id) this.select(id); }
  get chapter(): DeliveryChapter { return this.selected; }
  get id(): DeliveryChapterId { return this.selected.id; }
  select(id: unknown): boolean { const chapter = getDeliveryChapter(id); if (!chapter) return false; this.selected = chapter; return true; }
}
