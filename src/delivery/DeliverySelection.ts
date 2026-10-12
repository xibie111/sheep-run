import { DELIVERY_CHAPTERS, defaultDeliveryChapter, getDeliveryChapter, type DeliveryChapter, type DeliveryChapterId } from './DeliveryChapters';
import { deliveryChapterPage } from './DeliveryPanelModel';
/** Selection is ephemeral; it never changes route completion or any gameplay storage. */
export class DeliverySelection {
  private selected: DeliveryChapter = defaultDeliveryChapter();
  private pageIndex = 0;
  constructor(id?: string) { if (id) this.select(id); }
  get chapter(): DeliveryChapter { return this.selected; }
  get id(): DeliveryChapterId { return this.selected.id; }
  get page() { return deliveryChapterPage(DELIVERY_CHAPTERS, this.pageIndex); }
  movePage(delta: number): boolean {
    if (!Number.isFinite(delta)) return false;
    const index = deliveryChapterPage(DELIVERY_CHAPTERS, this.pageIndex + Math.trunc(delta)).index;
    if (index === this.pageIndex) return false;
    this.pageIndex = index; return true;
  }
  select(id: unknown): boolean {
    const chapter = getDeliveryChapter(id); if (!chapter) return false;
    this.selected = chapter; this.pageIndex = Math.floor(DELIVERY_CHAPTERS.indexOf(chapter) / 2); return true;
  }
}
