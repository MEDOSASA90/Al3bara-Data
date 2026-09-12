import { Timestamp } from 'firebase/firestore';
import {
  COMMISSION_RATE,
  PAYMENT_DEADLINE_DAYS,
} from './constants';
import type { Client, Delivery, Entity, FinancialSummary, Lot, PartnershipBuyer, PartnershipItem, PartnershipSale, PartnershipTx, SupplierPayment, Transaction } from './types';

/** Form numeric field: a real number or an empty (cleared) input. */
export type NumericInput = number | '';

export function isNumberInput(value: NumericInput): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

export interface LotSplit {
  base30: number;
  value30: number;
  value70: number;
}

/**
 * Forward split: total -> 30% (+stamp) / 70%.
 * Mirrors the original LotModal / AuctionBrochureModal math exactly:
 * base30 is rounded, the stamp is added on top, 70% = total - base30.
 */
export function splitLotTotal(totalValue: number, stampFee: number): LotSplit {
  const base30 = Math.round(totalValue * 0.3);
  return { base30, value30: base30 + stampFee, value70: totalValue - base30 };
}

export interface LotCalcState {
  quantity: NumericInput;
  unitPrice: NumericInput;
  totalValue: NumericInput;
  value30: NumericInput;
  value70: NumericInput;
  stampFee: number;
}

export const EMPTY_LOT_CALC: LotCalcState = {
  quantity: '',
  unitPrice: '',
  totalValue: '',
  value30: '',
  value70: '',
  stampFee: 10,
};

function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}

/** qty x unitPrice -> total + split (or derive unitPrice from an existing total). */
export function applyQuantityChange(state: LotCalcState, qty: NumericInput): LotCalcState {
  const next: LotCalcState = { ...state, quantity: qty };
  if (isNumberInput(qty) && isNumberInput(state.unitPrice) && qty > 0 && state.unitPrice > 0) {
    const total = round2(qty * state.unitPrice);
    const split = splitLotTotal(total, state.stampFee);
    next.totalValue = total;
    next.value30 = split.value30;
    next.value70 = split.value70;
  } else if (
    isNumberInput(qty) &&
    isNumberInput(state.totalValue) &&
    qty > 0 &&
    state.totalValue > 0
  ) {
    next.unitPrice = round2(state.totalValue / qty);
  }
  return next;
}

/** unitPrice change -> total + split. */
export function applyUnitPriceChange(state: LotCalcState, price: NumericInput): LotCalcState {
  const next: LotCalcState = { ...state, unitPrice: price };
  if (isNumberInput(price) && isNumberInput(state.quantity) && price > 0 && state.quantity > 0) {
    const total = round2(state.quantity * price);
    const split = splitLotTotal(total, state.stampFee);
    next.totalValue = total;
    next.value30 = split.value30;
    next.value70 = split.value70;
  }
  return next;
}

/** total change -> split + (optionally) unitPrice. */
export function applyTotalChange(state: LotCalcState, total: NumericInput): LotCalcState {
  const next: LotCalcState = { ...state, totalValue: total };
  if (isNumberInput(total) && total >= 0) {
    const split = splitLotTotal(total, state.stampFee);
    next.value30 = split.value30;
    next.value70 = split.value70;
    if (isNumberInput(state.quantity) && state.quantity > 0) {
      next.unitPrice = round2(total / state.quantity);
    }
  } else {
    next.value30 = '';
    next.value70 = '';
  }
  return next;
}

/** Manual 30% edit -> re-derive 70% (or the whole total when no total exists yet). */
export function applyValue30Change(state: LotCalcState, v30: NumericInput): LotCalcState {
  const next: LotCalcState = { ...state, value30: v30 };
  if (isNumberInput(v30)) {
    const base30 = Math.max(0, v30 - state.stampFee);
    if (isNumberInput(state.totalValue) && state.totalValue > 0) {
      next.value70 = state.totalValue - base30;
    } else {
      const derivedTotal = Math.round(base30 / 0.3);
      next.totalValue = derivedTotal;
      next.value70 = derivedTotal - base30;
      if (isNumberInput(state.quantity) && state.quantity > 0) {
        next.unitPrice = round2(derivedTotal / state.quantity);
      }
    }
  }
  return next;
}

/** Manual 70% edit -> re-derive 30% (or the whole total when no total exists yet). */
export function applyValue70Change(state: LotCalcState, v70: NumericInput): LotCalcState {
  const next: LotCalcState = { ...state, value70: v70 };
  if (isNumberInput(v70)) {
    if (isNumberInput(state.totalValue) && state.totalValue > 0) {
      const base30 = state.totalValue - v70;
      next.value30 = base30 + state.stampFee;
    } else {
      const derivedTotal = Math.round(v70 / 0.7);
      next.totalValue = derivedTotal;
      const base30 = derivedTotal - v70;
      next.value30 = base30 + state.stampFee;
      if (isNumberInput(state.quantity) && state.quantity > 0) {
        next.unitPrice = round2(derivedTotal / state.quantity);
      }
    }
  }
  return next;
}

/** Stamp change -> re-derive 30% from the current total. */
export function applyStampChange(state: LotCalcState, fee: number): LotCalcState {
  const next: LotCalcState = { ...state, stampFee: fee };
  if (isNumberInput(state.totalValue) && state.totalValue > 0) {
    const base30 = Math.round(state.totalValue * 0.3);
    next.value30 = base30 + fee;
  }
  return next;
}

/** Buyer commission: 0.5% of the active (non-archived) lots total. */
export function calcCommission(activeLotsTotal: number): number {
  return activeLotsTotal * COMMISSION_RATE;
}

export function activeLotsTotal(entity: Pick<Entity, 'lots'>): number {
  return entity.lots.filter((lot) => !lot.isArchived).reduce((sum, lot) => sum + lot.totalValue, 0);
}

export function summarizeTransactions(transactions: Transaction[]): FinancialSummary {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const tx of transactions) {
    if (tx.amount > 0) totalDebit += tx.amount;
    else totalCredit += Math.abs(tx.amount);
  }
  return { totalDebit, totalCredit, netBalance: totalDebit - totalCredit };
}

export function clientBalance(client: Pick<Client, 'transactions'>): number {
  return client.transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

export interface PricedLine {
  quantity: number;
  pricePerKilo: number;
}

export function transactionItemsTotal(items: PricedLine[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.pricePerKilo, 0);
}

/** Payment deadline for a lot session: auction date + 15 days. */
export function lotPaymentDeadline(auctionDate: Timestamp): Date {
  const deadline = auctionDate.toDate();
  deadline.setDate(deadline.getDate() + PAYMENT_DEADLINE_DAYS);
  return deadline;
}

export function daysUntilDeadline(auctionDate: Timestamp, now: Date = new Date()): number {
  const deadline = lotPaymentDeadline(auctionDate);
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isLotUnpaid(lot: Pick<Lot, 'is70Paid' | 'isArchived'>): boolean {
  return !lot.isArchived && !lot.is70Paid;
}

/* ---------- partnerships (no commission) ---------- */

/** Purchase cost of one item: sum of deliveries when present, else legacy buyCost. */
export function itemBuyCost(item: Pick<PartnershipItem, 'deliveries' | 'buyCost'>): number {
  const deliveries = item.deliveries ?? [];
  if (deliveries.length > 0) return deliveries.reduce((sum, d) => sum + (d.total || 0), 0);
  return item.buyCost || 0;
}

/** Total quantity of one item: sum of deliveries when present, else legacy quantity. */
export function itemQuantity(item: Pick<PartnershipItem, 'deliveries' | 'quantity'>): number {
  const deliveries = item.deliveries ?? [];
  if (deliveries.length > 0) return deliveries.reduce((sum, d) => sum + (d.quantity || 0), 0);
  return item.quantity || 0;
}

/** Sum of one delivery list (recomputes qty × unitPrice when total is missing). */
export function deliveriesTotal(deliveries: Delivery[]): number {
  return (deliveries ?? []).reduce((sum, d) => sum + (d.total || (d.quantity || 0) * (d.unitPrice || 0)), 0);
}

/** Total paid to the supplier across all supplier payments. */
export function supplierTotals(payments: SupplierPayment[]): { paid: number } {
  return { paid: (payments ?? []).reduce((sum, pay) => sum + (pay.amount || 0), 0) };
}

/** Remaining supplier balance: total buy cost minus total paid. */
export function supplierBalance(buyCostTotal: number, supplierPaid: number): number {
  return (buyCostTotal || 0) - (supplierPaid || 0);
}

export interface PartnershipSettlement {
  buyCost: number;
  expenses: number;
  sales: number;
  /** Sales returns given back to buyers (refund txs). */
  refunds: number;
  /** Total paid to the supplier. */
  supplierPaid: number;
  /** Remaining supplier balance (buyCost - supplierPaid). */
  supplierBalance: number;
  profit: number;
  /** Profit share per party id. */
  profits: Record<string, number>;
  /** Paid amounts (items + expenses) per party id. */
  contributed: Record<string, number>;
  /** Sales received per party id, adjusted by reimbursements. */
  collected: Record<string, number>;
  /** Settlement balance per party id: (contributed + profit share) - collected. >0 = owed to them. */
  dues: Record<string, number>;
  /** Compat: my profit share. */
  myProfit: number;
  /** Compat: combined profit of all other partners. */
  partnerProfit: number;
  /** Compat aliases. */
  contributedMe: number;
  contributedPartner: number;
  collectedMe: number;
  collectedPartner: number;
  /** Compat: dues['me']. >0 means the partners owe me. */
  dueToMe: number;
}

/** Shares input: new Record form or a legacy mySharePct number (single partner). */
export type SharesInput = Record<string, number> | number;

function sharesRecord(shares: SharesInput, fallbackPartnerId: string | null): Record<string, number> {
  if (typeof shares === 'number' && !Number.isNaN(shares)) {
    const mine = Math.min(100, Math.max(0, shares));
    const record: Record<string, number> = { me: mine };
    if (fallbackPartnerId) record[fallbackPartnerId] = 100 - mine;
    return record;
  }
  const record: Record<string, number> = {};
  if (shares && typeof shares === 'object') {
    for (const [key, value] of Object.entries(shares)) {
      if (typeof value === 'number' && !Number.isNaN(value) && value > 0) record[key] = value;
      else if (typeof value === 'number' && !Number.isNaN(value) && value === 0) record[key] = 0;
    }
  }
  if (record['me'] === undefined) record['me'] = 50;
  return record;
}

function defaultReimburseTo(from: string, partyIds: string[]): string {
  if (from !== 'me') return 'me';
  const other = partyIds.find((id) => id !== 'me');
  return other ?? 'me';
}

/**
 * Pure partnership settlement (no commission — commission syncs separately to advance accounts).
 * - buyCost: sum of item costs (deliveries sum when present, else legacy buyCost).
 * - expenses/sales: from ledger txs by kind; refunds reduce sales.
 * - supplier payments: full/partial payments to the supplier, counted in contributed by payer.
 * - NOTE: legacy item.paidBy is stored but NOT counted in contributed (avoids double count
 *   with the synthesized supplier payments).
 * - profit = (sales - refunds) - buyCost - expenses, split by the per-party shares map.
 * - contributed: supplier payments + expense txs + refund txs (refund money out counts as contribution).
 * - collected: sales received by each side, adjusted by reimbursements
 *   (reimbursement from A to B: collectedA -= x, collectedB += x).
 * - dues[party] = (contributed[party] + profits[party]) - collected[party].
 *   dueToMe (compat) = dues['me'].
 */
export function partnershipSettlement(
  items: PartnershipItem[],
  txs: PartnershipTx[],
  shares: SharesInput,
  partnerIds: string[] = [],
  supplierPayments: SupplierPayment[] = [],
): PartnershipSettlement {
  const safeItems = items ?? [];
  const safeTxs = txs ?? [];
  const safeSupplierPayments = supplierPayments ?? [];

  const firstPartnerId =
    partnerIds.find((id) => id !== 'me') ??
    (() => {
      for (const item of safeItems) {
        if (typeof item.paidBy === 'string' && item.paidBy !== '' && item.paidBy !== 'me' && item.paidBy !== 'partner') {
          return item.paidBy;
        }
      }
      for (const tx of safeTxs) {
        if (typeof tx.paidBy === 'string' && tx.paidBy !== '' && tx.paidBy !== 'me' && tx.paidBy !== 'partner') {
          return tx.paidBy;
        }
      }
      return null;
    })();
  const shareMap = sharesRecord(shares, firstPartnerId ?? 'partner-1');

  // Party universe: shares keys + every party seen in txs/supplier payments (+ legacy 'partner' alias).
  // NOTE: legacy item.paidBy is stored but excluded from contributed and from party discovery.
  const partySet = new Set<string>(['me', ...Object.keys(shareMap), ...partnerIds]);
  const legacyPartnerSeen =
    safeTxs.some((tx) => tx.paidBy === 'partner') ||
    safeSupplierPayments.some((pay) => pay.paidBy === 'partner');
  for (const tx of safeTxs) {
    if (typeof tx.paidBy === 'string' && tx.paidBy !== '') partySet.add(tx.paidBy);
    if (typeof tx.reimburseTo === 'string' && tx.reimburseTo !== '') partySet.add(tx.reimburseTo);
  }
  for (const pay of safeSupplierPayments) {
    if (typeof pay.paidBy === 'string' && pay.paidBy !== '') partySet.add(pay.paidBy);
  }
  // Fold the legacy 'partner' alias into the first partner id.
  const aliasTarget = firstPartnerId ?? partnerIds.find((id) => id !== 'me') ?? 'partner-1';
  if (partySet.has('partner')) {
    partySet.delete('partner');
    partySet.add(aliasTarget);
  }
  if (legacyPartnerSeen && shareMap[aliasTarget] === undefined && shareMap['partner'] !== undefined) {
    shareMap[aliasTarget] = shareMap['partner'] as number;
    delete shareMap['partner'];
  }
  const partyIds = [...partySet];

  const resolve = (raw: string): string => (raw === 'partner' ? aliasTarget : raw);

  const buyCost = safeItems.reduce((sum, item) => sum + itemBuyCost(item), 0);
  let expenses = 0;
  let grossSales = 0;
  let refunds = 0;
  const contributed: Record<string, number> = {};
  const collected: Record<string, number> = {};
  for (const id of partyIds) {
    contributed[id] = 0;
    collected[id] = 0;
  }

  // Supplier payments (full/partial) count as contributions by paidBy (source of money).
  // deliveredBy is display-only and never affects settlement.
  for (const pay of safeSupplierPayments) {
    const id = resolve(pay.paidBy ?? 'me');
    contributed[id] = (contributed[id] ?? 0) + (pay.amount || 0);
  }

  for (const tx of safeTxs) {
    const amount = tx.amount || 0;
    if (tx.kind === 'expense') {
      expenses += amount;
      const id = resolve(tx.paidBy ?? 'me');
      contributed[id] = (contributed[id] ?? 0) + amount;
    } else if (tx.kind === 'sale') {
      grossSales += amount;
      const id = resolve(tx.paidBy ?? 'me');
      collected[id] = (collected[id] ?? 0) + amount;
    } else if (tx.kind === 'refund') {
      // Sales return: money goes back out to the buyer — reduces net sales,
      // counts as a contribution by the payer (source of money only).
      refunds += amount;
      const id = resolve(tx.paidBy ?? 'me');
      contributed[id] = (contributed[id] ?? 0) + amount;
    } else {
      // reimbursement from tx.paidBy to tx.reimburseTo (defaults to the other side / 'me')
      const from = resolve(tx.paidBy ?? 'me');
      const to = tx.reimburseTo ? resolve(tx.reimburseTo) : defaultReimburseTo(from, partyIds);
      collected[from] = (collected[from] ?? 0) - amount;
      collected[to] = (collected[to] ?? 0) + amount;
    }
  }

  const sales = grossSales - refunds;
  const supplierPaid = supplierTotals(safeSupplierPayments).paid;
  const supBalance = supplierBalance(buyCost, supplierPaid);
  const profit = sales - buyCost - expenses;
  const totalShare = Object.values(shareMap).reduce((sum, v) => sum + (v || 0), 0);
  const profits: Record<string, number> = {};
  const dues: Record<string, number> = {};
  for (const id of partyIds) {
    const pct = totalShare > 0 ? (shareMap[id] ?? 0) / totalShare : 0;
    profits[id] = profit * pct;
    dues[id] = (contributed[id] ?? 0) + profits[id] - (collected[id] ?? 0);
  }

  const myProfit = profits['me'] ?? 0;
  const contributedMe = contributed['me'] ?? 0;
  const collectedMe = collected['me'] ?? 0;
  const contributedPartner = partyIds
    .filter((id) => id !== 'me')
    .reduce((sum, id) => sum + (contributed[id] ?? 0), 0);
  const collectedPartner = partyIds
    .filter((id) => id !== 'me')
    .reduce((sum, id) => sum + (collected[id] ?? 0), 0);
  const dueToMe = dues['me'] ?? 0;

  return {
    buyCost,
    expenses,
    sales,
    refunds,
    supplierPaid,
    supplierBalance: supBalance,
    profit,
    profits,
    contributed,
    collected,
    dues,
    myProfit,
    partnerProfit: profit - myProfit,
    contributedMe,
    contributedPartner,
    collectedMe,
    collectedPartner,
    dueToMe,
  };
}

export function sortLotsByNumber(lots: Lot[]): Lot[] {
  return [...lots].sort((a, b) => {
    if (!a.lotNumber) return 1;
    if (!b.lotNumber) return -1;
    const numA = parseInt(String(a.lotNumber).replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(b.lotNumber).replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
}

export interface DayGroup {
  key: string;
  date: Date;
  transactions: Transaction[];
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Groups transactions by calendar day, newest day first. */
export function groupTransactionsByDay(transactions: Transaction[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const tx of transactions) {
    const date = tx.date.toDate();
    const key = dayKey(date);
    const existing = map.get(key);
    if (existing) {
      existing.transactions.push(tx);
    } else {
      map.set(key, { key, date, transactions: [tx] });
    }
  }
  return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

/* ---------- partnership sales (المباع) ---------- */

export type SaleStatus = 'paid' | 'partial' | 'advance' | 'unpaid';

/** Total collected against a sale. */
export function salePaid(sale: Pick<PartnershipSale, 'payments'>): number {
  return (sale.payments ?? []).reduce((sum, pay) => sum + (pay.amount || 0), 0);
}

/** Remaining balance on a sale: total minus collected. */
export function saleRemaining(sale: Pick<PartnershipSale, 'payments' | 'totalAmount'>): number {
  return (sale.totalAmount || 0) - salePaid(sale);
}

/** Sale status: paid / partial / advance (unpaid + isAdvance) / unpaid. */
export function saleStatus(sale: Pick<PartnershipSale, 'payments' | 'totalAmount' | 'isAdvance'>): SaleStatus {
  const remaining = saleRemaining(sale);
  if (remaining <= 0.009) return 'paid';
  const paid = salePaid(sale);
  if (paid > 0.009) return 'partial';
  return sale.isAdvance === true ? 'advance' : 'unpaid';
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  paid: '✅ خالص',
  partial: '🟡 جزئي',
  advance: '📝 عربون',
  unpaid: '🔴 آجل',
};

/** Aggregate bought/paid/remaining across a list of sales. */
export function salesTotals(sales: PartnershipSale[]): { bought: number; paid: number; remaining: number } {
  let bought = 0;
  let paid = 0;
  for (const sale of sales ?? []) {
    bought += sale.totalAmount || 0;
    paid += salePaid(sale);
  }
  return { bought, paid, remaining: bought - paid };
}

/* ---------- partnership buyers (prepaid balances) ---------- */

/** A sale belongs to a buyer: match by buyerId, fallback to trimmed name. */
export function saleBelongsToBuyer(
  sale: Pick<PartnershipSale, 'buyerId' | 'buyerName'>,
  buyer: Pick<PartnershipBuyer, 'id' | 'name'>,
): boolean {
  if (typeof sale.buyerId === 'string' && sale.buyerId !== '') return sale.buyerId === buyer.id;
  return sale.buyerName.trim() !== '' && sale.buyerName.trim() === buyer.name.trim();
}

/** All sales of one buyer across a sales list (id match, fallback name). */
export function buyerSales(
  buyer: Pick<PartnershipBuyer, 'id' | 'name'>,
  sales: PartnershipSale[],
): PartnershipSale[] {
  return (sales ?? []).filter((sale) => saleBelongsToBuyer(sale, buyer));
}

/**
 * Buyer prepaid balance: Σ top-ups − Σ balance-source payments across the buyer's sales.
 * Goes negative when deductions exceed top-ups (allowed).
 */
export function buyerBalance(
  buyer: Pick<PartnershipBuyer, 'id' | 'name' | 'topUps'>,
  sales: PartnershipSale[],
): number {
  const topped = (buyer.topUps ?? []).reduce((sum, t) => sum + (t.amount || 0), 0);
  let deducted = 0;
  for (const sale of buyerSales(buyer, sales ?? [])) {
    for (const pay of sale.payments ?? []) {
      if (pay.source === 'balance') deducted += pay.amount || 0;
    }
  }
  return topped - deducted;
}
