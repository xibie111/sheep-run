import type { SpawnRequest } from '../systems/SpawnSystemOwner';
import { planStarRoute, STAR_ROUTE_RULES, starRouteSize, type StarRouteContext, type StarRouteKind, type StarRoutePlan } from './StarRoutePlanner';

type StarToken = Extract<SpawnRequest, { type: 'star' }>;
export interface StarRoutePort {
  /** Includes inactive instances and unallocated room in the existing three-star pool. */
  readonly available: () => number;
  /** Atomically activate exactly plan.points.length pooled stars, or none. */
  readonly spawn: (plan: StarRoutePlan) => readonly object[] | null;
}
export interface StarRouteCollection {
  readonly id: number;
  readonly kind: StarRouteKind;
  readonly collected: number;
  readonly total: number;
  readonly completed: boolean;
}
interface Group { id: number; kind: StarRouteKind; members: Set<object>; collected: number; total: number; }

/**
 * Legacy star requests become conserved budget tokens. Groups spend 3/2/1
 * tokens, never add a second star scheduler or consume original random streams.
 */
export class StarRouteController {
  private bank: StarToken[] = [];
  private randomState: number;
  private kinds: StarRouteKind[] = [];
  private desired: StarRouteKind = 'single';
  private groups = new Map<number, Group>();
  private membership = new WeakMap<object, Group>();
  private serial = 0;
  private stopped = false;
  private tokensReceived = 0;
  private starsSpawned = 0;
  private tokensDiscarded = 0;
  constructor(private readonly port: StarRoutePort, seed = 0x7357a2c1) {
    this.randomState = (seed >>> 0) || 0x7357a2c1;
  }
  get budget(): Readonly<{ received: number; spawned: number; pending: number; discarded: number }> {
    return { received: this.tokensReceived, spawned: this.starsSpawned, pending: this.bank.length, discarded: this.tokensDiscarded };
  }
  get pendingKind(): StarRouteKind { return this.desired; }
  enqueue(token: StarToken): void {
    if (this.stopped || !Number.isFinite(token.y) || !Number.isFinite(token.phase)) return;
    this.tokensReceived += 1;
    if (this.bank.length < STAR_ROUTE_RULES.bankLimit) this.bank.push(token);
    else this.tokensDiscarded += 1;
  }
  update(context: StarRouteContext): StarRoutePlan | null {
    if (this.stopped) return null;
    const size = starRouteSize(this.desired);
    if (this.bank.length < size || this.port.available() < size) return null;
    const plan = planStarRoute(this.desired, context, this.bank.slice(0, size).map(token => token.phase));
    if (!plan) return null;
    const members = this.port.spawn(plan);
    if (!members || members.length !== size || new Set(members).size !== size) return null;
    this.bank.splice(0, size);
    this.starsSpawned += size;
    const group: Group = { id: ++this.serial, kind: plan.kind, members: new Set(members), collected: 0, total: size };
    this.groups.set(group.id, group);
    for (const member of members) this.membership.set(member, group);
    this.desired = this.nextKind();
    return plan;
  }
  /** Called only for the game's actual accepted overlap, before pooled reuse. */
  collect(star: object): StarRouteCollection | null {
    if (this.stopped) return null;
    const group = this.membership.get(star);
    if (!group || !group.members.delete(star)) return null;
    this.membership.delete(star);
    group.collected += 1;
    const completed = group.collected === group.total;
    if (completed) this.groups.delete(group.id);
    return { id: group.id, kind: group.kind, collected: group.collected, total: group.total, completed: completed && group.kind !== 'single' };
  }
  /** One missed member invalidates completion, without changing score or streak. */
  recycle(star: object): void {
    const group = this.membership.get(star);
    if (!group) return;
    for (const member of group.members) this.membership.delete(member);
    this.groups.delete(group.id);
    group.members.clear();
  }
  clear(): void {
    this.stopped = true; this.bank = [];
    for (const group of this.groups.values()) group.members.clear();
    this.groups.clear(); this.membership = new WeakMap();
  }
  private nextKind(): StarRouteKind {
    if (!this.kinds.length) {
      this.kinds = ['arc', 'high-low', 'landing', 'single'];
      for (let index = this.kinds.length - 1; index > 0; index -= 1) {
        let value = this.randomState; value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
        this.randomState = value >>> 0;
        const other = Math.floor(this.randomState / 0x1_0000_0000 * (index + 1));
        [this.kinds[index], this.kinds[other]] = [this.kinds[other]!, this.kinds[index]!];
      }
    }
    return this.kinds.shift()!;
  }
}
