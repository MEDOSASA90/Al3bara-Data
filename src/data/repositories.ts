import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../domain/constants';
import type {
  ArchiveType,
  BuyerTopUp,
  Client,
  ClientType,
  Delivery,
  Entity,
  Lot,
  Partner,
  Partnership,
  PartnershipBuyer,
  PartnershipItem,
  PartnershipSale,
  PartnershipTx,
  PredefinedBuyer,
  PredefinedItem,
  RejectedLot,
  ShareLink,
  ShareScope,
  SupplierPayment,
  Transaction,
} from '../domain/types';

/* ---------- collection helpers ---------- */

function clientCollection(type: ClientType): string {
  return type === 'advance' ? COLLECTIONS.advanceClients : COLLECTIONS.workClients;
}

/* ---------- document mappers ---------- */

function asTransactionList(value: unknown): Transaction[] {
  return Array.isArray(value) ? (value as Transaction[]) : [];
}

function asLotList(value: unknown): Lot[] {
  return Array.isArray(value) ? (value as Lot[]) : [];
}

function asPartnershipItemList(value: unknown): PartnershipItem[] {
  return Array.isArray(value) ? (value as PartnershipItem[]) : [];
}

function asPartnershipTxList(value: unknown): PartnershipTx[] {
  return Array.isArray(value) ? (value as PartnershipTx[]) : [];
}

function asSupplierPaymentList(value: unknown): SupplierPayment[] {
  return Array.isArray(value) ? (value as SupplierPayment[]) : [];
}

function asPartnershipSaleList(value: unknown): PartnershipSale[] {
  return Array.isArray(value) ? (value as PartnershipSale[]) : [];
}

function asPartnerList(value: unknown): Partner[] {
  if (!Array.isArray(value)) return [];
  const list: Partner[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    if (typeof rec['id'] !== 'string' || typeof rec['name'] !== 'string') continue;
    const partner: Partner = { id: rec['id'] as string, name: rec['name'] as string };
    if (typeof rec['phone'] === 'string' && (rec['phone'] as string) !== '') {
      partner.phone = rec['phone'] as string;
    }
    list.push(partner);
  }
  return list;
}

function asSharesRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record: Record<string, number> = {};
  let hasAny = false;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'number' && !Number.isNaN(val)) {
      record[key] = val;
      hasAny = true;
    }
  }
  return hasAny ? record : null;
}

/** Legacy paidBy 'partner' maps to the first partner id. */
function resolvePartyId(raw: unknown, firstPartnerId: string): string {
  if (raw === 'me') return 'me';
  if (typeof raw === 'string' && raw !== '') {
    if (raw === 'partner') return firstPartnerId;
    return raw;
  }
  return 'me';
}

function normalizePartnershipItems(value: unknown, firstPartnerId: string): PartnershipItem[] {
  return asPartnershipItemList(value).map((item) => {
    const deliveries = Array.isArray(item.deliveries) ? (item.deliveries as Delivery[]) : [];
    const next: PartnershipItem = {
      ...item,
      mode: item.mode === 'weight' ? 'weight' : 'lot',
      deliveries: [...deliveries],
      paidBy: resolvePartyId(item.paidBy, firstPartnerId),
    };
    // Synthesize one legacy delivery from quantity/buyCost when no deliveries exist.
    if (next.deliveries.length === 0) {
      const qty = next.quantity ?? 0;
      const cost = next.buyCost ?? 0;
      if (qty > 0 || cost > 0) {
        next.deliveries = [
          {
            id: `${next.id}-legacy`,
            date: Timestamp.now(),
            quantity: qty,
            unitPrice: qty > 0 ? cost / qty : cost,
            total: cost,
          },
        ];
      }
    }
    return next;
  });
}

function normalizePartnershipTxs(value: unknown, firstPartnerId: string): PartnershipTx[] {
  return asPartnershipTxList(value).map((tx) => {
    const next: PartnershipTx = { ...tx, paidBy: resolvePartyId(tx.paidBy, firstPartnerId) };
    if (typeof tx.reimburseTo === 'string' && tx.reimburseTo !== '') {
      next.reimburseTo = resolvePartyId(tx.reimburseTo, firstPartnerId);
    }
    if (typeof tx.deliveredBy === 'string' && tx.deliveredBy !== '') {
      next.deliveredBy = resolvePartyId(tx.deliveredBy, firstPartnerId);
    }
    return next;
  });
}

function normalizeSupplierPayments(value: unknown, firstPartnerId: string): SupplierPayment[] {
  return asSupplierPaymentList(value).map((pay) => {
    const next: SupplierPayment = { ...pay, paidBy: resolvePartyId(pay.paidBy, firstPartnerId) };
    if (typeof pay.deliveredBy === 'string' && pay.deliveredBy !== '') {
      next.deliveredBy = resolvePartyId(pay.deliveredBy, firstPartnerId);
    }
    return next;
  });
}

function normalizePartnershipSales(value: unknown, firstPartnerId: string): PartnershipSale[] {
  return asPartnershipSaleList(value).map((sale) => {
    const payments = Array.isArray(sale.payments) ? sale.payments : [];
    const lines = Array.isArray(sale.lines) ? sale.lines : [];
    const next: PartnershipSale = {
      ...sale,
      lines: lines.map((line) => ({
        ...line,
        mode: line.mode === 'lot' ? 'lot' : 'weight',
      })),
      payments: payments.map((pay) => ({
        ...pay,
        by: resolvePartyId(pay.by, firstPartnerId),
        source: pay.source === 'balance' ? 'balance' : 'cash',
      })),
    };
    if (typeof sale.buyerId === 'string' && sale.buyerId !== '') next.buyerId = sale.buyerId;
    return next;
  });
}

function asPartnershipBuyerList(value: unknown): PartnershipBuyer[] {
  return Array.isArray(value) ? (value as PartnershipBuyer[]) : [];
}

function normalizePartnershipBuyers(value: unknown): PartnershipBuyer[] {
  return asPartnershipBuyerList(value)
    .filter((b) => b && typeof b === 'object' && typeof b.id === 'string' && typeof b.name === 'string')
    .map((b) => {
      const topUps = Array.isArray(b.topUps) ? (b.topUps as BuyerTopUp[]) : [];
      const next: PartnershipBuyer = {
        ...b,
        topUps: topUps
          .filter((t) => t && typeof t === 'object' && typeof t.id === 'string')
          .map((t) => ({ ...t })),
      };
      if (typeof b.phone !== 'string' || b.phone === '') delete next.phone;
      if (typeof b.notes !== 'string' || b.notes === '') delete next.notes;
      return next;
    });
}

export function toPartnership(id: string, data: DocumentData): Partnership {
  const legacyName = typeof data['partnerName'] === 'string' ? (data['partnerName'] as string) : '';
  const legacyPhone = typeof data['partnerPhone'] === 'string' ? (data['partnerPhone'] as string) : '';
  const legacyShare = typeof data['mySharePct'] === 'number' ? (data['mySharePct'] as number) : 50;

  let partners = asPartnerList(data['partners']);
  if (partners.length === 0 && legacyName !== '') {
    const fallback: Partner = { id: 'partner-1', name: legacyName };
    if (legacyPhone !== '') fallback.phone = legacyPhone;
    partners = [fallback];
  }

  const firstId = partners[0]?.id ?? 'partner-1';
  let shares = asSharesRecord(data['shares']);
  if (!shares) {
    shares = { me: legacyShare, [firstId]: 100 - legacyShare };
  } else if (shares['me'] === undefined) {
    shares = { ...shares, me: legacyShare };
  }

  const createdRaw = data['createdAt'];
  const createdAt =
    createdRaw && typeof (createdRaw as { toMillis?: unknown }).toMillis === 'function'
      ? (createdRaw as Partnership['createdAt'])
      : Timestamp.now();

  const rawItems = asPartnershipItemList(data['items']);
  const items = normalizePartnershipItems(data['items'], firstId);
  const storedPayments = normalizeSupplierPayments(data['supplierPayments'], firstId);
  // One legacy supplier payment per legacy item with buyCost > 0 and a payer.
  const legacyPayments: SupplierPayment[] = [];
  for (const raw of rawItems) {
    const rawDeliveries = Array.isArray(raw.deliveries) ? raw.deliveries : [];
    const buyCost = raw.buyCost ?? 0;
    if (rawDeliveries.length === 0 && buyCost > 0 && typeof raw.paidBy === 'string' && raw.paidBy !== '') {
      legacyPayments.push({
        id: `legacy-${raw.id}`,
        amount: buyCost,
        paidBy: resolvePartyId(raw.paidBy, firstId),
        date: createdAt,
        notes: 'تحويل تلقائي',
      });
    }
  }

  const partnership: Partnership = {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
    partners,
    shares,
    partnerName: partners[0]?.name ?? legacyName,
    mySharePct: shares['me'] ?? legacyShare,
    inOurName: data['inOurName'] === true,
    status: data['status'] === 'settled' ? 'settled' : 'active',
    createdAt,
    items,
    txs: normalizePartnershipTxs(data['txs'], firstId),
    supplierPayments: [...storedPayments, ...legacyPayments],
    sales: normalizePartnershipSales(data['sales'], firstId),
    buyers: normalizePartnershipBuyers(data['buyers']),
  };
  if (typeof data['supplierName'] === 'string' && (data['supplierName'] as string).trim() !== '') {
    partnership.supplierName = (data['supplierName'] as string).trim();
  }
  const primaryPhone = partners[0]?.phone ?? (legacyPhone !== '' ? legacyPhone : undefined);
  if (primaryPhone !== undefined) partnership.partnerPhone = primaryPhone;
  if (data['settledAt']) partnership.settledAt = data['settledAt'] as Partnership['settledAt'];
  return partnership;
}

export function toClient(id: string, data: DocumentData): Client {
  return {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
    transactions: asTransactionList(data['transactions']),
    isBuyer: data['isBuyer'] === true,
    isArchived: data['isArchived'] === true,
    archiveType: data['archiveType'] as ArchiveType | undefined,
    phone: data['phone'] as string | string[] | undefined,
  };
}

export function toEntity(id: string, data: DocumentData): Entity {
  return {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
    buyerName: typeof data['buyerName'] === 'string' ? (data['buyerName'] as string) : undefined,
    auctionDate: data['auctionDate'] as Entity['auctionDate'],
    lots: asLotList(data['lots']),
  };
}

export function toPredefinedItem(id: string, data: DocumentData): PredefinedItem {
  return {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
  };
}

export function toPredefinedBuyer(id: string, data: DocumentData): PredefinedBuyer {
  return {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
  };
}

export function toRejectedLot(id: string, data: DocumentData): RejectedLot {
  const lot: RejectedLot = {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
    myBidPrice: typeof data['myBidPrice'] === 'number' ? (data['myBidPrice'] as number) : 0,
    sessionDate: typeof data['sessionDate'] === 'string' ? (data['sessionDate'] as string) : '',
    entityName: typeof data['entityName'] === 'string' ? (data['entityName'] as string) : '',
  };
  if (typeof data['quantity'] === 'string') lot.quantity = data['quantity'] as string;
  if (typeof data['notes'] === 'string') lot.notes = data['notes'] as string;
  return lot;
}

/* ---------- live subscriptions ---------- */

export function subscribeToClients(
  type: ClientType,
  onData: (clients: Client[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = collection(db, clientCollection(type));
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toClient(d.id, d.data()))),
    (error) => onError(error as Error),
  );
}

export function subscribeToEntities(
  onData: (entities: Entity[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = query(collection(db, COLLECTIONS.entities), orderBy('auctionDate', 'desc'));
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toEntity(d.id, d.data()))),
    (error) => onError(error as Error),
  );
}

export function subscribeToPredefinedItems(
  onData: (items: PredefinedItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = collection(db, COLLECTIONS.predefinedItems);
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toPredefinedItem(d.id, d.data()))),
    (error) => onError(error as Error),
  );
}

export function subscribeToPredefinedBuyers(
  onData: (buyers: PredefinedBuyer[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = collection(db, COLLECTIONS.predefinedBuyers);
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toPredefinedBuyer(d.id, d.data()))),
    (error) => onError(error as Error),
  );
}

export function subscribeToRejectedLots(
  onData: (lots: RejectedLot[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = query(collection(db, COLLECTIONS.rejectedLots), orderBy('sessionDate', 'desc'));
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toRejectedLot(d.id, d.data()))),
    (error) => onError(error as Error),
  );
}

export function subscribeToPartnerships(
  onData: (partnerships: Partnership[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = query(collection(db, COLLECTIONS.partnerships), orderBy('createdAt', 'desc'));
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toPartnership(d.id, d.data()))),
    (error) => onError(error as Error),
  );
}

/* ---------- clients ---------- */

export interface NewClientInput {
  name: string;
  userId: string;
  phone?: string;
  isBuyer?: boolean;
}

export async function createClient(type: ClientType, input: NewClientInput): Promise<string> {
  const ref = await addDoc(collection(db, clientCollection(type)), {
    name: input.name,
    userId: input.userId,
    phone: input.phone ?? '',
    isBuyer: input.isBuyer ?? false,
    transactions: [],
  });
  return ref.id;
}

export async function setClientTransactions(
  type: ClientType,
  clientId: string,
  transactions: Transaction[],
): Promise<void> {
  await updateDoc(doc(db, clientCollection(type), clientId), { transactions });
}

export async function markClientBuyer(
  type: ClientType,
  clientId: string,
  transactions: Transaction[],
): Promise<void> {
  await updateDoc(doc(db, clientCollection(type), clientId), { transactions, isBuyer: true });
}

export async function archiveClient(
  type: ClientType,
  clientId: string,
  transactions: Transaction[],
  archiveType: ArchiveType,
): Promise<void> {
  await updateDoc(doc(db, clientCollection(type), clientId), {
    transactions,
    isArchived: true,
    archiveType,
  });
}

export async function restoreClient(type: ClientType, clientId: string): Promise<void> {
  await updateDoc(doc(db, clientCollection(type), clientId), {
    isArchived: false,
    archiveType: null,
  });
}

export async function deleteClient(type: ClientType, clientId: string): Promise<void> {
  await deleteDoc(doc(db, clientCollection(type), clientId));
}

/* ---------- entities & lots ---------- */

export interface NewEntityInput {
  name: string;
  buyerName: string;
  auctionDate: Entity['auctionDate'];
  userId: string;
}

export async function createEntity(input: NewEntityInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.entities), {
    name: input.name,
    buyerName: input.buyerName,
    auctionDate: input.auctionDate,
    userId: input.userId,
    lots: [],
  });
  return ref.id;
}

export async function updateEntityMeta(
  entityId: string,
  patch: { name: string; buyerName: string; auctionDate: Entity['auctionDate'] },
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.entities, entityId), patch);
}

export async function setEntityLots(entityId: string, lots: Lot[]): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.entities, entityId), { lots });
}

export async function appendEntityLots(
  entityId: string,
  lots: Lot[],
  buyerName?: string,
): Promise<void> {
  const patch: { lots: Lot[]; buyerName?: string } = { lots };
  if (buyerName) patch.buyerName = buyerName;
  await updateDoc(doc(db, COLLECTIONS.entities, entityId), patch);
}

export async function deleteEntity(entityId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.entities, entityId));
}

/* ---------- partnerships (shared goods with another merchant, no commission) ---------- */

export interface NewPartnershipInput {
  userId: string;
  name: string;
  partners: Partner[];
  shares: Record<string, number>;
  inOurName: boolean;
  supplierName?: string;
}

export interface PartnershipMetaPatch {
  name: string;
  partners: Partner[];
  shares: Record<string, number>;
  inOurName: boolean;
  supplierName?: string;
}

function partnershipDocPayload(input: { name: string; partners: Partner[]; shares: Record<string, number>; inOurName: boolean; supplierName?: string }): Record<string, unknown> {
  const primary = input.partners[0];
  return {
    name: input.name,
    partners: input.partners,
    shares: input.shares,
    partnerName: primary?.name ?? '',
    partnerPhone: primary?.phone ?? '',
    mySharePct: input.shares['me'] ?? 50,
    inOurName: input.inOurName,
    supplierName: input.supplierName ?? '',
  };
}

export async function createPartnership(input: NewPartnershipInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.partnerships), {
    userId: input.userId,
    ...partnershipDocPayload(input),
    status: 'active',
    createdAt: Timestamp.now(),
    items: [],
    txs: [],
  });
  return ref.id;
}

export async function updatePartnershipMeta(partnershipId: string, patch: PartnershipMetaPatch): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), partnershipDocPayload(patch));
}

export async function setPartnershipItems(partnershipId: string, items: PartnershipItem[]): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), { items });
}

export async function setPartnershipTxs(partnershipId: string, txs: PartnershipTx[]): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), { txs });
}

export async function setPartnershipSupplierPayments(
  partnershipId: string,
  supplierPayments: SupplierPayment[],
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), { supplierPayments });
}

export async function setPartnershipSales(
  partnershipId: string,
  sales: PartnershipSale[],
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), { sales });
}

export async function setPartnershipBuyers(
  partnershipId: string,
  buyers: PartnershipBuyer[],
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), { buyers });
}

export async function settlePartnership(
  partnershipId: string,
  txs: PartnershipTx[],
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.partnerships, partnershipId), {
    txs,
    status: 'settled',
    settledAt: Timestamp.now(),
  });
}

export async function deletePartnership(partnershipId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.partnerships, partnershipId));
}

/* ---------- partner share links (public read-only) ---------- */

export function toShareLink(token: string, data: DocumentData): ShareLink {
  const scope = data['scope'];
  return {
    token,
    partnershipId: typeof data['partnershipId'] === 'string' ? (data['partnershipId'] as string) : '',
    scope: scope === 'buyer' || scope === 'supplier' ? scope : 'full',
    buyerId: typeof data['buyerId'] === 'string' ? (data['buyerId'] as string) : undefined,
    createdAt: data['createdAt'] as ShareLink['createdAt'],
    revoked: data['revoked'] === true,
  };
}

/** Creates a public share token. Returns the token. */
export async function createShareLink(partnershipId: string, scope: ShareScope = 'full', buyerId?: string): Promise<string> {
  const token = crypto.randomUUID();
  const payload: Record<string, unknown> = { partnershipId, scope, createdAt: Timestamp.now() };
  if (buyerId) payload['buyerId'] = buyerId;
  await setDoc(doc(db, COLLECTIONS.shareLinks, token), payload);
  return token;
}

export async function revokeShareLink(token: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.shareLinks, token), { revoked: true });
}

export function subscribeToShareLinks(
  partnershipId: string,
  onData: (links: ShareLink[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = query(collection(db, COLLECTIONS.shareLinks), where('partnershipId', '==', partnershipId));
  return onSnapshot(
    ref,
    (snapshot) => {
      const links = snapshot.docs.map((d) => toShareLink(d.id, d.data()));
      links.sort((a, b) => {
        const ta = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
        const tb = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      onData(links);
    },
    (error) => onError(error as Error),
  );
}

/** Public single-doc read (works without login when rules allow). */
export async function getShareLink(token: string): Promise<ShareLink | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.shareLinks, token));
  if (!snapshot.exists()) return null;
  return toShareLink(snapshot.id, snapshot.data());
}

/** Public single-doc read (works without login when rules allow). */
export async function getPartnershipDoc(partnershipId: string): Promise<Partnership | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.partnerships, partnershipId));
  if (!snapshot.exists()) return null;
  return toPartnership(snapshot.id, snapshot.data());
}

/* ---------- predefined lists ---------- */

export async function createPredefinedItem(name: string, userId: string): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.predefinedItems), { name, userId });
  return ref.id;
}

export async function createPredefinedBuyer(name: string, userId: string): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.predefinedBuyers), { name, userId });
  return ref.id;
}

export async function deletePredefinedItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.predefinedItems, id));
}

export async function deletePredefinedBuyer(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.predefinedBuyers, id));
}

/* ---------- rejected lots journal ---------- */

export interface NewRejectedLotInput {
  userId: string;
  name: string;
  quantity?: string;
  myBidPrice: number;
  sessionDate: string;
  entityName: string;
  notes?: string;
}

export async function createRejectedLot(input: NewRejectedLotInput): Promise<string> {
  const payload: Record<string, string | number> = {
    userId: input.userId,
    name: input.name,
    myBidPrice: input.myBidPrice,
    sessionDate: input.sessionDate,
    entityName: input.entityName,
  };
  if (input.quantity) payload['quantity'] = input.quantity;
  if (input.notes) payload['notes'] = input.notes;
  const ref = await addDoc(collection(db, COLLECTIONS.rejectedLots), payload);
  return ref.id;
}

export async function deleteRejectedLot(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.rejectedLots, id));
}

/** Creates an advance-client buyer record unless one with the same name exists. */
export async function createBuyerClientIfMissing(name: string, userId: string): Promise<void> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.advanceClients), where('name', '==', name)),
  );
  if (!snapshot.empty) return;
  await addDoc(collection(db, COLLECTIONS.advanceClients), {
    name,
    userId,
    isBuyer: true,
    transactions: [],
  });
}
