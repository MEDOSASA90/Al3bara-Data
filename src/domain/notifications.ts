import { PAYMENT_DEADLINE_DAYS } from './constants';
import { normalizeArabic } from '../components/ui/SearchableDropdown';
import type { Entity, RejectedLot } from './types';

/** Kinds of alerts the notification center understands. */
export type AppAlertKind =
  | 'auction_soon'
  | 'brochure_new'
  | 'lot_reappeared'
  | 'payment_due'
  | 'payment_overdue';

/** One computed alert shown in the bell panel (and pushed as a phone notification). */
export interface AppAlert {
  /** Stable id — used to dedupe shown notifications and store dismissals. */
  id: string;
  kind: AppAlertKind;
  title: string;
  body: string;
  /** Related day (YYYY-MM-DD) when applicable. */
  date?: string;
  /** Where navigating from the alert should land. */
  navigateTo: 'dashboard' | 'entities';
  createdAt: number;
}

/** Minimal structural view of any brochure/session (saved, preloaded, or parsed). */
export interface BrochureSessionRef {
  id: string;
  auctionDate: string;
  title: string;
  /** Only saved/auto brochures carry this (ms epoch). */
  savedAtMs?: number;
  entities: { entityName: string; lots: { lotNumber: string; name: string }[] }[];
}

export interface AlertsInput {
  entities: Entity[];
  rejectedLots: RejectedLot[];
  /** All known sessions (saved library + preloaded upcoming). */
  sessions: BrochureSessionRef[];
  /** Brochure ids the user already saw (localStorage). */
  seenBrochureIds: string[];
  now?: Date;
  /** Safety caps so a huge journal doesn't flood the panel. */
  maxReappeared?: number;
  maxPayments?: number;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(target: Date, now: Date): number {
  const ms = startOfDay(target).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86400000);
}

function deadlineOf(entity: Entity): Date | null {
  try {
    const auction = entity.auctionDate.toDate();
    const deadline = new Date(auction);
    deadline.setDate(deadline.getDate() + PAYMENT_DEADLINE_DAYS);
    return deadline;
  } catch {
    return null;
  }
}

function formatDay(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * Computes every current alert from live data:
 * - كراسة جديدة قريبة (upcoming preloaded session not saved yet)
 * - كراسة جديدة اتحفظت (saved in the last 48h and not seen)
 * - لوط مرفوض رجع تاني (rejected-lot journal match inside a session)
 * - موعد دفع الـ 70% قرب / فات (deadline = session + PAYMENT_DEADLINE_DAYS)
 */
export function buildAlerts(input: AlertsInput): AppAlert[] {
  const now = input.now ?? new Date();
  const alerts: AppAlert[] = [];
  const maxReappeared = input.maxReappeared ?? 40;
  const maxPayments = input.maxPayments ?? 20;

  /* --- upcoming preloaded sessions not yet saved → كراسة جديدة --- */
  for (const session of input.sessions) {
    if (session.savedAtMs !== undefined) continue; // already in the library
    const date = parseDateOnly(session.auctionDate);
    if (!date) continue;
    const days = daysUntil(date, now);
    if (days >= 0 && days <= 7) {
      alerts.push({
        id: `auction-soon:${session.auctionDate}`,
        kind: 'auction_soon',
        title: '📅 كراسة مزاد جديدة قريبة',
        body: `جلسة ${session.title} بتاريخ ${session.auctionDate} — ${days === 0 ? 'النهارده!' : `بعد ${days} يوم`} — افتح الكراسات وشوف اللوطات`,
        date: session.auctionDate,
        navigateTo: 'entities',
        createdAt: now.getTime(),
      });
    }
  }

  /* --- freshly saved brochures the user hasn't seen yet --- */
  for (const session of input.sessions) {
    if (session.savedAtMs === undefined) continue;
    if (input.seenBrochureIds.includes(session.id)) continue;
    const ageHours = (now.getTime() - session.savedAtMs) / 3600000;
    if (ageHours > 48) continue;
    const lotsCount = session.entities.reduce((sum, e) => sum + e.lots.length, 0);
    alerts.push({
      id: `brochure-new:${session.id}`,
      kind: 'brochure_new',
      title: '📄 كراسة جديدة اتحفظت',
      body: `${session.title} — ${session.entities.length} جهة و ${lotsCount} لوط اتسجلوا في مكتبة الكراسات`,
      date: session.auctionDate,
      navigateTo: 'entities',
      createdAt: session.savedAtMs,
    });
  }

  /* --- rejected lots reappearing inside any known session --- */
  const rejectedByNorm = new Map<string, RejectedLot[]>();
  for (const entry of input.rejectedLots) {
    const key = normalizeArabic(entry.name);
    if (key === '') continue;
    const arr = rejectedByNorm.get(key) ?? [];
    arr.push(entry);
    rejectedByNorm.set(key, arr);
  }
  if (rejectedByNorm.size > 0) {
    let count = 0;
    outer: for (const session of input.sessions) {
      for (const entity of session.entities) {
        for (const lot of entity.lots) {
          const key = normalizeArabic(lot.name);
          const matches = key === '' ? undefined : rejectedByNorm.get(key);
          if (!matches || matches.length === 0) continue;
          const first = matches[0];
          alerts.push({
            id: `lot-reap:${session.auctionDate}:${lot.lotNumber}:${key}`,
            kind: 'lot_reappeared',
            title: '🔁 لوط قدمت فيه قبل كده رجع تاني',
            body: `${lot.name} رجع في «${session.title}» — كانت مزايدتك ${Math.round(first.myBidPrice).toLocaleString('en-US')} ج.م واترفضت`,
            date: session.auctionDate,
            navigateTo: 'entities',
            createdAt: now.getTime(),
          });
          count += 1;
          if (count >= maxReappeared) break outer;
        }
      }
    }
  }

  /* --- 70% payment deadlines (session + PAYMENT_DEADLINE_DAYS) --- */
  const due: AppAlert[] = [];
  const overdue: AppAlert[] = [];
  for (const entity of input.entities) {
    const deadline = deadlineOf(entity);
    if (!deadline) continue;
    const days = daysUntil(deadline, now);
    const activeLots = (entity.lots ?? []).filter((l) => !l.isArchived && l.is70Paid !== true);
    if (activeLots.length === 0) continue;
    const unpaid = activeLots.reduce((sum, l) => sum + (l.value70 || 0), 0);
    if (days < 0) {
      overdue.push({
        id: `pay-overdue:${entity.id}`,
        kind: 'payment_overdue',
        title: '🔴 موعد دفع الـ 70% فات',
        body: `${entity.name} — الـ 70% (${Math.round(unpaid).toLocaleString('en-US')} ج.م) كان المفروض يتدفع ${formatDay(deadline)} — ${Math.abs(days)} يوم تأخير`,
        date: undefined,
        navigateTo: 'entities',
        createdAt: now.getTime(),
      });
    } else if (days <= 3) {
      due.push({
        id: `pay-due:${entity.id}`,
        kind: 'payment_due',
        title: days === 0 ? '🟠 موعد دفع الـ 70% النهارده' : '🟡 موعد دفع الـ 70% قرب',
        body: `${entity.name} — الـ 70% (${Math.round(unpaid).toLocaleString('en-US')} ج.م) لازم يتدفع خلال ${days === 0 ? 'النهارده' : `${days} يوم`} (${formatDay(deadline)})`,
        date: undefined,
        navigateTo: 'entities',
        createdAt: now.getTime(),
      });
    }
  }
  alerts.push(...overdue.slice(0, maxPayments));
  alerts.push(...due.slice(0, maxPayments));

  const kindOrder: Record<AppAlertKind, number> = {
    payment_overdue: 0,
    payment_due: 1,
    lot_reappeared: 2,
    brochure_new: 3,
    auction_soon: 4,
  };
  alerts.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  return alerts;
}
