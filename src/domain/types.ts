import type { Timestamp } from 'firebase/firestore';

export type ViewMode =
  | 'dashboard'
  | 'entities'
  | 'advances'
  | 'work'
  | 'partnerships'
  | 'archiveMenu'
  | 'archiveEntities'
  | 'archiveWork'
  | 'archiveAdvances';

export type ClientType = 'advance' | 'work';

export type ArchiveType = 'entities' | 'work' | 'advances';

export type Theme = 'light' | 'dark';

export interface SessionUser {
  uid: string;
  email: string | null;
}

export interface ImageRef {
  name: string;
  url: string;
}

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  pricePerKilo: number;
  image?: ImageRef;
}

export interface Transaction {
  id: string;
  amount: number;
  notes: string;
  date: Timestamp;
  isSettled: boolean;
  items?: TransactionItem[];
  /** Links a commission credit back to its awarded entity. */
  entityId?: string;
  /** Links a partner-commission credit back to its partnership. */
  partnershipId?: string;
  image?: ImageRef;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  transactions: Transaction[];
  isBuyer?: boolean;
  isArchived?: boolean;
  archiveType?: ArchiveType;
  /** Single phone or several phones joined by ", " — kept for backward compatibility. */
  phone?: string | string[];
}

export interface PaymentDetails {
  payerName: string;
  date: Timestamp;
  receiptImage?: ImageRef | null;
}

export interface LoadingDetails {
  loaderName: string;
  date: Timestamp;
}

export interface Lot {
  id: string;
  lotNumber: string;
  name: string;
  quantity: string;
  totalValue: number;
  value30: number;
  value70: number;
  is70Paid?: boolean;
  paymentDetails?: PaymentDetails;
  loadingDetails?: LoadingDetails;
  contractImage?: ImageRef;
  isArchived: boolean;
}

export interface Entity {
  id: string;
  userId: string;
  name: string;
  buyerName?: string;
  auctionDate: Timestamp;
  lots: Lot[];
}

export interface PredefinedItem {
  id: string;
  userId: string;
  name: string;
}

export interface PredefinedBuyer {
  id: string;
  userId: string;
  name: string;
}

/** A lot the user bid on but lost — kept as a journal so reappearing lots are recognized. */
export interface RejectedLot {
  id: string;
  userId: string;
  name: string;
  quantity?: string;
  myBidPrice: number;
  sessionDate: string;
  entityName: string;
  notes?: string;
}

export interface FinancialSummary {
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

/** A party in a partnership. 'me' (the app user) is reserved and never appears here. */
export interface Partner {
  id: string;
  name: string;
  phone?: string;
}

/** Party id in a partnership: 'me' = the app user, otherwise a Partner.id. */
export type Payer = string;

export type PartnershipStatus = 'active' | 'settled';

/** How a shared-goods item is priced: lump-sum lot or weight × unit price. */
export type PricingMode = 'lot' | 'weight';

/** Audit trail: who created / last edited a record (email of the editor). */
export interface Audit {
  createdBy?: string;
  createdAt?: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

/** One arrival of a shared-goods item: qty at that day's price. */
export interface Delivery extends Audit {
  id: string;
  date: Timestamp;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** A payment made to the supplier for a partnership (full or partial). */
export interface SupplierPayment extends Audit {
  id: string;
  amount: number;
  /** Source of the money (settlement counts on this). */
  paidBy: Payer;
  /** Who physically delivered it (display only, no settlement effect). */
  deliveredBy?: Payer;
  date: Timestamp;
  notes: string;
  supplierName?: string;
}

export interface PartnershipItem extends Audit {
  id: string;
  name: string;
  mode: PricingMode;
  deliveries: Delivery[];
  /** Legacy: total purchase cost (used when deliveries is empty). */
  quantity?: number;
  buyCost?: number;
  /** Legacy: who paid (kept stored; NOT counted in contributed to avoid double count). */
  paidBy?: Payer;
  notes?: string;
}

export type PartnershipTxKind = 'expense' | 'sale' | 'reimbursement' | 'refund';

export interface PartnershipTx extends Audit {
  id: string;
  kind: PartnershipTxKind;
  amount: number;
  /** Source of the money (settlement counts on this). */
  paidBy: Payer;
  /** Who physically delivered it (display only, no settlement effect). */
  deliveredBy?: Payer;
  notes: string;
  date: Timestamp;
  /** Reimbursement direction: money moves paidBy -> reimburseTo. */
  reimburseTo?: Payer;
}

export interface Partnership {
  id: string;
  userId: string;
  name: string;
  /** All non-me parties. */
  partners: Partner[];
  /** Profit share per party id (incl 'me'). Must sum to 100. */
  shares: Record<string, number>;
  /** Legacy: single-partner name (kept for backward compat, mirrors partners[0]). */
  partnerName?: string;
  /** Legacy: single-partner phone (kept for backward compat). */
  partnerPhone?: string;
  /** Legacy: my profit share 0-100 (kept for backward compat, mirrors shares['me']). */
  mySharePct?: number;
  /** True when the shared goods are held in our name → 0.5% commission on buyCost. */
  inOurName: boolean;
  status: PartnershipStatus;
  createdAt: Timestamp;
  settledAt?: Timestamp;
  items: PartnershipItem[];
  txs: PartnershipTx[];
  /** Optional supplier name for this partnership. */
  supplierName?: string;
  /** Payments made to the supplier (full or partial). */
  supplierPayments: SupplierPayment[];
  /** Credit sales to buyers (المباع): buyer owes totalAmount minus payments. */
  sales: PartnershipSale[];
}

/** One sold line inside a partnership sale. */
export interface SaleLine {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

/** A collection received against a partnership sale. */
export interface SalePayment extends Audit {
  id: string;
  amount: number;
  date: Timestamp;
  by: Payer;
  notes: string;
}

/** A credit sale to a buyer inside a partnership. */
export interface PartnershipSale extends Audit {
  id: string;
  buyerName: string;
  lines: SaleLine[];
  totalAmount: number;
  date: Timestamp;
  isAdvance?: boolean;
  payments: SalePayment[];
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

/** Reserved party id for the app user. */
export const ME_PARTY_ID = 'me';

/** Public read-only share link for a partnership (viewed without login). */
export interface ShareLink {
  token: string;
  partnershipId: string;
  createdAt: Timestamp;
  revoked?: boolean;
}

export interface PartyRef {
  id: string;
  name: string;
}

/** All parties incl 'me' first, then every partner. */
export function partnershipParties(partnership: Pick<Partnership, 'partners'>): PartyRef[] {
  const list: PartyRef[] = [{ id: ME_PARTY_ID, name: 'وليد' }];
  for (const partner of partnership.partners ?? []) {
    list.push({ id: partner.id, name: partner.name });
  }
  return list;
}

/** Display name of a party id ('me' → وليد, unknown → the raw id). */
export function partyNameOf(partnership: Pick<Partnership, 'partners'>, partyId: string): string {
  if (partyId === ME_PARTY_ID) return 'وليد';
  const found = (partnership.partners ?? []).find((partner) => partner.id === partyId);
  if (found) return found.name;
  if (partyId === 'partner') {
    const first = (partnership.partners ?? [])[0];
    if (first) return first.name;
  }
  return partyId;
}

/** My share from the shares map (defaults to 50 for legacy docs). */
export function myShareOf(partnership: Pick<Partnership, 'shares' | 'mySharePct'>): number {
  const fromShares = partnership.shares?.[ME_PARTY_ID];
  if (typeof fromShares === 'number' && !Number.isNaN(fromShares)) return fromShares;
  if (typeof partnership.mySharePct === 'number' && !Number.isNaN(partnership.mySharePct)) {
    return partnership.mySharePct;
  }
  return 50;
}

/** First (primary) partner name — used for commission sync and legacy displays. */
export function primaryPartnerName(partnership: Pick<Partnership, 'partners' | 'partnerName'>): string {
  const first = (partnership.partners ?? [])[0];
  if (first) return first.name;
  return partnership.partnerName ?? '';
}
