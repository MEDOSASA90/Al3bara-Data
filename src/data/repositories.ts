import {
  addDoc,
  collection,
  collectionGroup,
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
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../domain/constants';
import type {
  ArchiveType,
  Audit,
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
  SavedBrochure,
  ShareLink,
  ShareScope,
  SupplierPayment,
  Transaction,
  TransactionDocMeta,
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
  const auditRaw = data['audit'];
  const audit: Audit | undefined =
    auditRaw && typeof auditRaw === 'object' && !Array.isArray(auditRaw)
      ? (auditRaw as Audit)
      : undefined;
  return {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    name: typeof data['name'] === 'string' ? (data['name'] as string) : '',
    transactions: asTransactionList(data['transactions']),
    isBuyer: data['isBuyer'] === true,
    isArchived: data['isArchived'] === true,
    archiveType: data['archiveType'] as ArchiveType | undefined,
    phone: data['phone'] as string | string[] | undefined,
    audit,
  };
}

/** Maps one transaction subcollection doc (keeps the doc id as the transaction id). */
export function toTransactionDoc(
  id: string,
  data: DocumentData,
): Transaction & TransactionDocMeta {
  const tx: Transaction & TransactionDocMeta = {
    id,
    amount: typeof data['amount'] === 'number' ? (data['amount'] as number) : 0,
    notes: typeof data['notes'] === 'string' ? (data['notes'] as string) : '',
    date: (data['date'] ?? Timestamp.now()) as Transaction['date'],
    isSettled: data['isSettled'] === true,
    clientId: typeof data['clientId'] === 'string' ? (data['clientId'] as string) : '',
    clientType: data['clientType'] === 'work' ? 'work' : 'advance',
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
  };
  const items = data['items'];
  if (Array.isArray(items)) tx.items = items as Transaction['items'];
  if (typeof data['entityId'] === 'string') tx.entityId = data['entityId'] as string;
  if (typeof data['partnershipId'] === 'string') tx.partnershipId = data['partnershipId'] as string;
  const image = data['image'];
  if (image && typeof image === 'object') tx.image = image as Transaction['image'];
  if (typeof data['createdBy'] === 'string') tx.createdBy = data['createdBy'] as string;
  if (typeof data['updatedBy'] === 'string') tx.updatedBy = data['updatedBy'] as string;
  return tx;
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

/* ---------- saved brochures (كراسات المحفوظة) ---------- */

function asBrochureEntities(value: unknown): SavedBrochure['entities'] {
  if (!Array.isArray(value)) return [];
  const entities: SavedBrochure['entities'] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    if (typeof rec['entityName'] !== 'string') continue;
    const lots: SavedBrochure['entities'][number]['lots'] = [];
    if (Array.isArray(rec['lots'])) {
      for (const rawLot of rec['lots']) {
        if (!rawLot || typeof rawLot !== 'object') continue;
        const lotRec = rawLot as Record<string, unknown>;
        if (typeof lotRec['name'] !== 'string') continue;
        lots.push({
          lotNumber: typeof lotRec['lotNumber'] === 'string' ? (lotRec['lotNumber'] as string) : '',
          name: lotRec['name'] as string,
          quantity: typeof lotRec['quantity'] === 'string' ? (lotRec['quantity'] as string) : '',
          unit: typeof lotRec['unit'] === 'string' ? (lotRec['unit'] as string) : undefined,
          condition: typeof lotRec['condition'] === 'string' ? (lotRec['condition'] as string) : undefined,
          notes: typeof lotRec['notes'] === 'string' ? (lotRec['notes'] as string) : undefined,
        });
      }
    }
    const entity: SavedBrochure['entities'][number] = {
      id: typeof rec['id'] === 'string' ? (rec['id'] as string) : `e-${entities.length + 1}`,
      entityName: rec['entityName'] as string,
      lots,
    };
    if (typeof rec['location'] === 'string' && (rec['location'] as string) !== '') {
      entity.location = rec['location'] as string;
    }
    if (typeof rec['contactPerson'] === 'string' && (rec['contactPerson'] as string) !== '') {
      entity.contactPerson = rec['contactPerson'] as string;
    }
    if (typeof rec['contactPhone'] === 'string' && (rec['contactPhone'] as string) !== '') {
      entity.contactPhone = rec['contactPhone'] as string;
    }
    entities.push(entity);
  }
  return entities;
}

export function toSavedBrochure(id: string, data: DocumentData): SavedBrochure {
  const savedAtRaw = data['savedAt'];
  const savedAt =
    savedAtRaw && typeof (savedAtRaw as { toMillis?: unknown }).toMillis === 'function'
      ? (savedAtRaw as SavedBrochure['savedAt'])
      : Timestamp.now();
  const source = data['source'];
  const brochure: SavedBrochure = {
    id,
    userId: typeof data['userId'] === 'string' ? (data['userId'] as string) : '',
    auctionDate: typeof data['auctionDate'] === 'string' ? (data['auctionDate'] as string) : '',
    title: typeof data['title'] === 'string' ? (data['title'] as string) : '',
    hallLocation:
      typeof data['hallLocation'] === 'string' ? (data['hallLocation'] as string) : '',
    insuranceAmount:
      typeof data['insuranceAmount'] === 'number' ? (data['insuranceAmount'] as number) : 0,
    source:
      source === 'file' || source === 'ai' || source === 'auto' || source === 'preloaded'
        ? source
        : 'file',
    savedAt,
    entities: asBrochureEntities(data['entities']),
  };
  if (typeof data['fileName'] === 'string' && (data['fileName'] as string) !== '') {
    brochure.fileName = data['fileName'] as string;
  }
  if (typeof data['sourceText'] === 'string' && (data['sourceText'] as string) !== '') {
    brochure.sourceText = data['sourceText'] as string;
  }
  return brochure;
}

/** Stable id for a brochure session — dedupes re-imports of the same session. */
export function brochureDocId(auctionDate: string): string {
  return `session-${auctionDate}`;
}

/** True when a brochure with the same session date is already saved. */
export function savedBrochureExists(existing: SavedBrochure[], auctionDate: string): boolean {
  return existing.some((b) => b.auctionDate === auctionDate);
}

/** Total lot count across all entities of a brochure. */
export function brochureLotsCount(brochure: SavedBrochure): number {
  return brochure.entities.reduce((sum, e) => sum + e.lots.length, 0);
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

/**
 * Live subscription to EVERY transaction subcollection doc owned by the user
 * (across advanceClients + workClients). App merges with legacy in-doc arrays.
 */
export function subscribeToAllTransactions(
  userId: string,
  onData: (txs: (Transaction & TransactionDocMeta)[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  // No where() on purpose: a filtered collectionGroup query needs a Firestore
  // index; an unfiltered one does not. Filter per-user client-side instead
  // (the merge only attaches txs whose clientId belongs to this user's clients).
  const ref = collectionGroup(db, 'transactions');
  return onSnapshot(
    ref,
    (snapshot) =>
      onData(
        snapshot.docs
          .map((d) => toTransactionDoc(d.id, d.data()))
          .filter((tx) => tx.userId === userId),
      ),
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

export function subscribeToBrochures(
  onData: (brochures: SavedBrochure[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const ref = query(collection(db, COLLECTIONS.brochures), orderBy('auctionDate', 'desc'));
  return onSnapshot(
    ref,
    (snapshot) => onData(snapshot.docs.map((d) => toSavedBrochure(d.id, d.data()))),
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
  /** Audit: email or uid of the creator. */
  createdBy?: string;
}

export async function createClient(type: ClientType, input: NewClientInput): Promise<string> {
  const audit: Audit = {
    createdBy: input.createdBy ?? input.userId,
    createdAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, clientCollection(type)), {
    name: input.name,
    userId: input.userId,
    phone: input.phone ?? '',
    isBuyer: input.isBuyer ?? false,
    transactions: [],
    audit,
  });
  return ref.id;
}

/* ---------- transaction subcollection (the canonical storage) ---------- */

function txDocRef(type: ClientType, clientId: string, txId: string) {
  return doc(db, clientCollection(type), clientId, 'transactions', txId);
}

/** Firestore payload for one transaction doc (+ parent metadata for group queries). */
function txDocPayload(
  tx: Transaction,
  meta: TransactionDocMeta,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: tx.id,
    amount: tx.amount,
    notes: tx.notes,
    date: tx.date,
    isSettled: tx.isSettled,
    items: tx.items ?? [],
    clientId: meta.clientId,
    clientType: meta.clientType,
    userId: meta.userId,
  };
  if (tx.entityId) payload['entityId'] = tx.entityId;
  if (tx.partnershipId) payload['partnershipId'] = tx.partnershipId;
  if (tx.image) payload['image'] = tx.image;
  if (tx.createdBy) payload['createdBy'] = tx.createdBy;
  if (tx.updatedBy) payload['updatedBy'] = tx.updatedBy;
  return payload;
}

/** Adds one transaction as a subcollection doc (idempotent: doc id = tx.id). */
export async function addClientTransaction(
  type: ClientType,
  clientId: string,
  userId: string,
  tx: Transaction,
): Promise<void> {
  await setDoc(
    txDocRef(type, clientId, tx.id),
    txDocPayload(tx, { clientId, clientType: type, userId }),
  );
}

/** Updates one transaction in place (same doc id). */
export async function updateClientTransaction(
  type: ClientType,
  clientId: string,
  userId: string,
  tx: Transaction,
): Promise<void> {
  await addClientTransaction(type, clientId, userId, tx);
}

/**
 * Deletes one transaction: removes the subcollection doc AND any legacy
 * in-doc array copy (which would otherwise reappear after migration).
 */
export async function deleteClientTransaction(
  type: ClientType,
  clientId: string,
  txId: string,
): Promise<void> {
  await deleteDoc(txDocRef(type, clientId, txId));
  const clientRef = doc(db, clientCollection(type), clientId);
  const snapshot = await getDoc(clientRef);
  const data = snapshot.data();
  const legacy = asTransactionList(data?.['transactions']);
  if (legacy.some((t) => t.id === txId)) {
    await updateDoc(clientRef, { transactions: legacy.filter((t) => t.id !== txId) });
  }
}

/** Removes ALL transactions matching a predicate (subcollection docs + legacy array copies). */
export async function deleteClientTransactionsWhere(
  type: ClientType,
  clientId: string,
  predicate: (tx: Transaction) => boolean,
): Promise<void> {
  const sub = collection(db, clientCollection(type), clientId, 'transactions');
  const snapshot = await getDocs(sub);
  for (const d of snapshot.docs) {
    const tx = toTransactionDoc(d.id, d.data());
    if (predicate(tx)) await deleteDoc(d.ref);
  }
  const clientRef = doc(db, clientCollection(type), clientId);
  const clientSnapshot = await getDoc(clientRef);
  const data = clientSnapshot.data();
  const legacy = asTransactionList(data?.['transactions']);
  if (legacy.some(predicate)) {
    await updateDoc(clientRef, { transactions: legacy.filter((tx) => !predicate(tx)) });
  }
}

export async function archiveClient(
  type: ClientType,
  clientId: string,
  archiveType: ArchiveType,
): Promise<void> {
  await updateDoc(doc(db, clientCollection(type), clientId), {
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
  // Clean up the transactions subcollection first, then the client doc.
  const sub = collection(db, clientCollection(type), clientId, 'transactions');
  const snapshot = await getDocs(sub);
  for (const d of snapshot.docs) {
    await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, clientCollection(type), clientId));
}

/* ---------- entities & lots ---------- */

export interface NewEntityInput {
  name: string;
  buyerName: string;
  auctionDate: Entity['auctionDate'];
  userId: string;
  /** Audit: email or uid of the creator. */
  createdBy?: string;
}

export async function createEntity(input: NewEntityInput): Promise<string> {
  const audit: Audit = {
    createdBy: input.createdBy ?? input.userId,
    createdAt: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, COLLECTIONS.entities), {
    name: input.name,
    buyerName: input.buyerName,
    auctionDate: input.auctionDate,
    userId: input.userId,
    lots: [],
    audit,
  });
  return ref.id;
}

export async function updateEntityMeta(
  entityId: string,
  patch: { name: string; buyerName: string; auctionDate: Entity['auctionDate'] },
  editor?: string,
): Promise<void> {
  const audit: Audit = { updatedBy: editor ?? '', updatedAt: Timestamp.now() };
  await updateDoc(doc(db, COLLECTIONS.entities, entityId), { ...patch, audit });
}

export async function setEntityLots(
  entityId: string,
  lots: Lot[],
  editor?: string,
): Promise<void> {
  const audit: Audit = { updatedBy: editor ?? '', updatedAt: Timestamp.now() };
  await updateDoc(doc(db, COLLECTIONS.entities, entityId), { lots, audit });
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

/* ---------- one-time transactions migration (array -> subcollection) ---------- */

export interface MigrationProgress {
  clientName: string;
  index: number;
  total: number;
  movedTxs: number;
}

/**
 * Moves the legacy in-doc transactions array of ONE client into the
 * transactions subcollection, atomically per client (writeBatch).
 * Every tx doc keeps the array tx id (re-runs are idempotent) and the
 * array is cleared in the same batch as the last chunk.
 */
export async function migrateClientTransactions(
  type: ClientType,
  clientId: string,
  clientName: string,
  userId: string,
  index: number,
  total: number,
  onProgress?: (progress: MigrationProgress) => void,
): Promise<{ moved: number }> {
  const clientRef = doc(db, clientCollection(type), clientId);
  const snapshot = await getDoc(clientRef);
  const legacy = asTransactionList(snapshot.data()?.['transactions']);
  if (legacy.length === 0) {
    onProgress?.({ clientName, index, total, movedTxs: 0 });
    return { moved: 0 };
  }

  const BATCH_LIMIT = 450;
  let moved = 0;
  for (let start = 0; start < legacy.length; start += BATCH_LIMIT) {
    const chunk = legacy.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const tx of chunk) {
      const meta: TransactionDocMeta = { clientId, clientType: type, userId };
      batch.set(txDocRef(type, clientId, tx.id), txDocPayload(tx, meta));
      moved += 1;
    }
    const isLastChunk = start + BATCH_LIMIT >= legacy.length;
    if (isLastChunk) {
      batch.update(clientRef, { transactions: [] });
    }
    await batch.commit();
  }
  onProgress?.({ clientName, index, total, movedTxs: legacy.length });
  return { moved };
}

/* ---------- brochure library writes ---------- */

export interface SaveBrochureInput {
  userId: string;
  auctionDate: string;
  title: string;
  hallLocation: string;
  insuranceAmount: number;
  source: SavedBrochure['source'];
  fileName?: string;
  /** Extracted raw text kept for re-analysis (تحليل ذكي). */
  sourceText?: string;
  entities: SavedBrochure['entities'];
}

/**
 * Saves (or replaces) a brochure under a stable per-session id so
 * re-importing the same session updates instead of duplicating.
 */
export async function saveBrochure(input: SaveBrochureInput): Promise<string> {
  const id = brochureDocId(input.auctionDate);
  const payload: Record<string, unknown> = {
    userId: input.userId,
    auctionDate: input.auctionDate,
    title: input.title,
    hallLocation: input.hallLocation,
    insuranceAmount: input.insuranceAmount,
    source: input.source,
    savedAt: Timestamp.now(),
    entities: input.entities,
  };
  if (input.fileName) payload['fileName'] = input.fileName;
  if (input.sourceText) payload['sourceText'] = input.sourceText;
  await setDoc(doc(db, COLLECTIONS.brochures, id), payload);
  return id;
}

export async function deleteBrochure(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.brochures, id));
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
