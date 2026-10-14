import type { MailReadStore } from '../systems/MailReadStore';
import { MailReader } from '../ui/MailReader';
import { deliveryChapterPage } from '../delivery/DeliveryPanelModel';
import { getResident, type ResidentId } from './ResidentCatalog';
import { RESIDENT_LETTERS } from './ResidentLetters';
import { canOpenResidentLetter, getResidentProgress, getResidentStoriesProgress } from './ResidentProgress';

export type ResidentPanelMode = 'list' | 'detail' | 'letters' | 'read' | 'keepsake' | 'group';
export interface ResidentPanelSnapshot { completedIds: readonly string[]; readIds: readonly string[] }

/** UI state is ephemeral. Availability is always queried from real delivery completions. */
export class ResidentPanelModel {
  mode: ResidentPanelMode = 'list';
  residentId?: ResidentId;
  stageIndex = 0;
  letterPageIndex = 0;
  private lettersReturn: 'list' | 'detail' = 'list';
  readonly reader: MailReader;
  constructor(private readonly snapshot: () => ResidentPanelSnapshot, store: MailReadStore) {
    this.reader = new MailReader(RESIDENT_LETTERS, store, id => canOpenResidentLetter(id, this.snapshot().completedIds));
  }
  get progress() { const state = this.snapshot(); return getResidentStoriesProgress(state.completedIds, state.readIds); }
  get selected() { const state = this.snapshot(); return getResidentProgress(this.residentId, state.completedIds, state.readIds); }
  get selectedStage() { return this.selected?.stages[this.stageIndex]; }
  get letters() { return deliveryChapterPage(RESIDENT_LETTERS, this.letterPageIndex, 3); }
  selectResident(id: unknown): boolean {
    const resident = getResident(id); if (!resident) return false;
    this.residentId = resident.id;
    this.stageIndex = (this.selected?.currentStage?.index ?? 3) - 1;
    this.mode = 'detail'; return true;
  }
  selectStage(index: number): boolean {
    if (!Number.isInteger(index) || !this.selected?.stages[index]?.unlocked) return false;
    this.stageIndex = index; return true;
  }
  showLetters(): void { this.lettersReturn = this.mode === 'detail' ? 'detail' : 'list'; this.mode = 'letters'; }
  moveLetters(delta: number): void { this.letterPageIndex = deliveryChapterPage(RESIDENT_LETTERS, this.letterPageIndex + delta, 3).index; }
  openLetter(id: string): boolean {
    if (!this.reader.open(id)) return false;
    this.mode = 'read'; return true;
  }
  keepLetter(): boolean { if (!this.reader.keep()) return false; this.mode = 'letters'; return true; }
  showKeepsake(): boolean { if (!this.selected?.keepsakeUnlocked) return false; this.mode = 'keepsake'; return true; }
  showGroup(): boolean { if (!this.progress.groupPhotoUnlocked) return false; this.mode = 'group'; return true; }
  back(): boolean {
    if (this.mode === 'list') return false;
    if (this.mode === 'read') { this.reader.back(); this.mode = 'letters'; }
    else if (this.mode === 'letters') this.mode = this.lettersReturn;
    else if (this.mode === 'keepsake') this.mode = 'detail';
    else this.mode = 'list';
    return true;
  }
  reset(): void { this.reader.back(); this.mode = 'list'; this.residentId = undefined; this.stageIndex = 0; this.letterPageIndex = 0; }
}

export const RESIDENT_UI_TEXT = [
  '居民故事', '居民来信', '私人信件', '故事进度', '当前委托', '故事已完成', '未读回信', '没有未读回信',
  '已完成', '可出发', '尚未解锁', '先完成上一段故事', '后续委托只需完成上一段', '查看委托', '返回邮箱', '返回居民', '返回',
  '纪念插画', '牧场居民合照', '合照尚未解锁', '全部故事完成后解锁', '完成最后一段故事后解锁', '已读', '未读',
  '完成对应委托后收到回信', '上一页', '下一页', '收好这封信', '暂未保存', '共九封居民回信',
  '给催眠羊的', '送信小旅行', '合上邮箱', '小邮局', '0123456789/ ·：',
] as const;
