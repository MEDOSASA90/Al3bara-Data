import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AppShell } from './components/ui/AppShell';
import { Modal } from './components/ui/Modal';
import { SplashScreen } from './components/ui/SplashScreen';
import {
  archiveReportHtml,
  allClientsHtml,
  clientSummaryHtml,
  entitiesSummaryHtml,
  partnershipHtml,
  singleEntityHtml,
  transactionHtml,
  type ArchivedLotEntry,
} from './components/print/reports';
import { syncBuyerCommission } from './data/commissionSync';
import { removePartnerCommission, syncPartnerCommission } from './data/partnerCommissionSync';
import {
  appendEntityLots,
  archiveClient,
  createBuyerClientIfMissing,
  createClient,
  createEntity,
  createPartnership,
  createPredefinedBuyer,
  createPredefinedItem,
  createRejectedLot,
  createShareLink,
  deleteClient,
  deleteEntity,
  deletePartnership,
  deleteRejectedLot,
  restoreClient,
  revokeShareLink,
  setClientTransactions,
  setEntityLots,
  setPartnershipBuyers,
  setPartnershipItems,
  setPartnershipSales,
  setPartnershipSupplierPayments,
  setPartnershipTxs,
  settlePartnership,
  subscribeToEntities,
  subscribeToClients,
  subscribeToPartnerships,
  subscribeToPredefinedBuyers,
  subscribeToPredefinedItems,
  subscribeToRejectedLots,
  subscribeToShareLinks,
  updateEntityMeta,
  updatePartnershipMeta,
} from './data/repositories';
import type {
  ArchiveType,
  BuyerTopUp,
  Client,
  ClientType,
  Delivery,
  Entity,
  ImageRef,
  Lot,
  Partnership,
  PartnershipBuyer,
  PartnershipItem,
  PartnershipSale,
  PartnershipTx,
  RejectedLot,
  SalePayment,
  SessionUser,
  ShareLink,
  SupplierPayment,
  Transaction,
  ViewMode,
} from './domain/types';
import { activeLotsTotal, buyerBalance, calcCommission, clientBalance, partnershipSettlement } from './domain/finance';
import { REMEMBER_EMAIL_KEY } from './domain/constants';
import { useAuth } from './hooks/useAuth';
import { useLiveQuery } from './hooks/useLiveQuery';
import { useTheme } from './hooks/useTheme';
import { formatDate, timestampFromDateInput, toBase64 } from './utils/format';
import { compressImage } from './utils/images';
import { uploadToDrive } from './utils/driveUpload';
import { printHtmlDocument } from './utils/print';
import { uniqueId } from './utils/ids';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { EntitiesView, type LotStatusFilter } from './features/entities/EntitiesView';
import { EntityModal, type EntityFormData } from './features/entities/EntityModal';
import { LotModal, type LotFormData } from './features/entities/LotModal';
import { SupplyModal, type SupplyFormData } from './features/entities/SupplyModal';
import { LoadingModal, type LoadingFormData } from './features/entities/LoadingModal';
import { ClientsView } from './features/clients/ClientsView';
import { PartnershipsView } from './features/partnerships/PartnershipsView';
import { PartnershipDetails, type SupplierPaymentFormData } from './features/partnerships/PartnershipDetails';
import { ShareView } from './features/partnerships/ShareView';
import { PartnershipModal, type PartnershipFormData } from './features/partnerships/PartnershipModal';
import type { PartnershipItemFormData } from './features/partnerships/ItemModal';
import type { PartnershipTxFormData } from './features/partnerships/TxModal';
import type { PartnershipSaleFormData, SalePaymentFormData } from './features/partnerships/SalesModal';
import type { NewBuyerFormData } from './features/partnerships/BuyersModal';
import type { BuyerTopUpFormData } from './features/partnerships/BuyerAccountModal';
import { BuyerProfileModal, type BuyerSaleRef } from './features/partnerships/BuyerProfileModal';
import { ClientModal } from './features/clients/ClientModal';
import { TransactionModal, type TransactionFormData } from './features/clients/TransactionModal';
import { PaymentModal, type PaymentFormData } from './features/clients/PaymentModal';
import {
  ArchiveClientsView,
  ArchiveLotsView,
  ArchiveMenuView,
  type ArchiveMenuTarget,
} from './features/archive/ArchiveView';
import {
  AuctionBrochureModal,
  type AwardedEntityPayload,
  type RejectedLotInput,
} from './features/brochures/AuctionBrochureModal';
import { AiAssistant } from './features/ai/AiAssistant';
import { InsightsCards } from './features/ai/InsightsCards';
import { buildBusinessSnapshot } from './ai/assistant';

/* ---------- small local dialogs ---------- */

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ isOpen, title, message, confirmLabel, onClose, onConfirm }: ConfirmDialogProps): ReactNode {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="break-words text-slate-700 dark:text-slate-200">{message}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-danger"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

interface QuickAddModalProps {
  isOpen: boolean;
  title: string;
  placeholder: string;
  confirmLabel: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

function QuickAddModal({ isOpen, title, placeholder, confirmLabel, onClose, onSave }: QuickAddModalProps): ReactNode {
  const [name, setName] = useState('');
  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          onSave(trimmed);
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
          className="input min-w-0 flex-1"
        />
        <button type="submit" className="btn-primary">
          {confirmLabel}
        </button>
      </form>
    </Modal>
  );
}

/* ---------- view titles ---------- */

const VIEW_TITLES: Record<ViewMode, string> = {
  dashboard: 'لوحة التحكم',
  entities: 'الجهات واللوطات',
  advances: 'حسابات السلف',
  work: 'حسابات الشغل',
  partnerships: 'حسابات الشركاء',
  archiveMenu: 'الأرشيف',
  archiveEntities: 'أرشيف الجهات',
  archiveWork: 'أرشيف الشغل',
  archiveAdvances: 'أرشيف السلف',
};

/** Public partner share route: #/share/TOKEN (viewed without login). */
function shareTokenFromHash(): string | null {
  const match = window.location.hash.match(/^#\/share\/([A-Za-z0-9-]+)/);
  return match?.[1] ?? null;
}

function viewFromHash(): ViewMode {
  if (shareTokenFromHash() !== null) return 'dashboard';
  const hash = window.location.hash.replace('#', '');
  const known: ViewMode[] = ['dashboard', 'entities', 'advances', 'work', 'partnerships', 'archiveMenu', 'archiveEntities', 'archiveWork', 'archiveAdvances'];
  return known.includes(hash as ViewMode) ? (hash as ViewMode) : 'dashboard';
}

/* ---------- authed shell ---------- */

interface AuthedAppProps {
  user: SessionUser;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  onHome: () => void;
  viewMode: ViewMode;
  onNavigate: (view: ViewMode) => void;
}

function AuthedApp({ user, theme, onToggleTheme, onLogout, onHome, viewMode, onNavigate }: AuthedAppProps): ReactNode {
  const subscribeAdvances = useCallback(
    (onData: (clients: Client[]) => void, onError: (error: Error) => void) =>
      subscribeToClients('advance', onData, onError),
    [],
  );
  const subscribeWork = useCallback(
    (onData: (clients: Client[]) => void, onError: (error: Error) => void) =>
      subscribeToClients('work', onData, onError),
    [],
  );
  const subscribeEntitiesCb = useCallback(
    (onData: (entities: Entity[]) => void, onError: (error: Error) => void) =>
      subscribeToEntities(onData, onError),
    [],
  );
  const subscribeItems = useCallback(
    (onData: (items: { id: string; userId: string; name: string }[]) => void, onError: (error: Error) => void) =>
      subscribeToPredefinedItems(onData, onError),
    [],
  );
  const subscribeBuyers = useCallback(
    (onData: (buyers: { id: string; userId: string; name: string }[]) => void, onError: (error: Error) => void) =>
      subscribeToPredefinedBuyers(onData, onError),
    [],
  );
  const subscribeRejected = useCallback(
    (onData: (lots: RejectedLot[]) => void, onError: (error: Error) => void) =>
      subscribeToRejectedLots(onData, onError),
    [],
  );
  const subscribePartnerships = useCallback(
    (onData: (partnerships: Partnership[]) => void, onError: (error: Error) => void) =>
      subscribeToPartnerships(onData, onError),
    [],
  );

  const { items: advanceClients, error: advancesError } = useLiveQuery(subscribeAdvances);
  const { items: workClients, error: workError } = useLiveQuery(subscribeWork);
  const { items: entities, error: entitiesError } = useLiveQuery(subscribeEntitiesCb);
  const { items: partnerships, error: partnershipsError } = useLiveQuery(subscribePartnerships);
  const { items: predefinedItems } = useLiveQuery(subscribeItems);
  const { items: predefinedBuyers } = useLiveQuery(subscribeBuyers);
  const { items: rejectedLots } = useLiveQuery(subscribeRejected);

  const dbError = advancesError ?? workError ?? entitiesError ?? partnershipsError;

  const [entitiesFilter, setEntitiesFilter] = useState<LotStatusFilter>('all');

  const [clientModal, setClientModal] = useState<{ open: boolean; kind: ClientType }>({ open: false, kind: 'advance' });
  const [txModal, setTxModal] = useState<{ open: boolean; kind: ClientType; client: Client | null; tx: Transaction | null }>({
    open: false, kind: 'advance', client: null, tx: null,
  });
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; kind: ClientType; client: Client | null }>({
    open: false, kind: 'advance', client: null,
  });
  const [entityModal, setEntityModal] = useState<{ open: boolean; entity: Entity | null }>({ open: false, entity: null });
  const [lotModal, setLotModal] = useState<{ open: boolean; entityId: string; lot: Lot | null }>({ open: false, entityId: '', lot: null });
  const [supplyModal, setSupplyModal] = useState<{ open: boolean; entityId: string; lotId?: string }>({ open: false, entityId: '' });
  const [loadingModal, setLoadingModal] = useState<{ open: boolean; entityId: string; lotId?: string }>({ open: false, entityId: '' });
  const [brochureOpen, setBrochureOpen] = useState(false);
  const [itemQuickAdd, setItemQuickAdd] = useState(false);
  const [buyerQuickAdd, setBuyerQuickAdd] = useState(false);

  const [deleteEntityId, setDeleteEntityId] = useState<string | null>(null);
  const [partnershipModal, setPartnershipModal] = useState<{ open: boolean; partnership: Partnership | null }>({
    open: false,
    partnership: null,
  });
  const [openPartnershipId, setOpenPartnershipId] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [deletePartnershipId, setDeletePartnershipId] = useState<string | null>(null);
  const [deleteClientReq, setDeleteClientReq] = useState<{ kind: ClientType; id: string } | null>(null);
  const [deleteLotReq, setDeleteLotReq] = useState<{ entityId: string; lotId: string } | null>(null);
  const [deleteTxReq, setDeleteTxReq] = useState<{ kind: ClientType; clientId: string; txId: string } | null>(null);
  const [settleReq, setSettleReq] = useState<{ kind: ClientType; client: Client; total: number } | null>(null);
  const [restoreReq, setRestoreReq] = useState<{ kind: ClientType; client: Client } | null>(null);

  const buyerNames = useMemo(() => predefinedBuyers.map((b) => b.name), [predefinedBuyers]);
  const exportDate = useMemo(() => new Date().toLocaleDateString('ar-EG'), []);

  /* ----- uploads ----- */

  const handleFileUpload = useCallback(async (file: File, prefix: string): Promise<ImageRef | undefined> => {
    try {
      const compressed = await compressImage(file, 1024, 0.7);
      const base64 = await toBase64(compressed);
      const fileName = `${prefix}_${Date.now()}_${file.name}`;
      const result = await uploadToDrive(base64, fileName, compressed.type || 'image/jpeg');
      if (!result.success) {
        alert(`فشل الرفع: ${result.error}`);
        return undefined;
      }
      return { name: fileName, url: result.url };
    } catch (error) {
      console.error('Upload failed:', error);
      alert('فشل رفع الملف');
      return undefined;
    }
  }, []);

  /* ----- clients & transactions ----- */

  const handleAddClient = useCallback(async (name: string, phone?: string): Promise<void> => {
    await createClient(clientModal.kind, { name, userId: user.uid, phone });
    setClientModal((current) => ({ ...current, open: false }));
  }, [clientModal.kind, user.uid]);

  const handleSaveTransaction = useCallback(async (data: TransactionFormData): Promise<void> => {
    if (!txModal.client) return;
    const base: Transaction = {
      id: txModal.tx?.id ?? uniqueId(),
      amount: data.amount,
      notes: data.notes,
      date: Timestamp.fromDate(data.date),
      isSettled: data.isSettled,
      items: data.items,
    };
    if (data.image) base.image = data.image;
    if (txModal.tx?.entityId) base.entityId = txModal.tx.entityId;

    const updated = txModal.tx
      ? txModal.client.transactions.map((t) => (t.id === txModal.tx?.id ? base : t))
      : [...txModal.client.transactions, base];
    await setClientTransactions(txModal.kind, txModal.client.id, updated);
    setTxModal({ open: false, kind: 'advance', client: null, tx: null });
  }, [txModal]);

  const handleSavePayment = useCallback(async (data: PaymentFormData): Promise<void> => {
    if (!paymentModal.client) return;
    const notes = data.linkedTransactionId ? `${data.notes} (مرتبط بحركة ${data.linkedTransactionId})` : data.notes;
    const payment: Transaction = {
      id: uniqueId(),
      amount: -Math.abs(data.amount),
      notes: notes || 'سداد دفعة',
      date: Timestamp.fromDate(data.date),
      isSettled: true,
    };
    if (data.receiptImage) payment.image = data.receiptImage;
    await setClientTransactions(paymentModal.kind, paymentModal.client.id, [...paymentModal.client.transactions, payment]);
    setPaymentModal({ open: false, kind: 'advance', client: null });
  }, [paymentModal]);

  const handleConfirmSettle = useCallback(async (): Promise<void> => {
    if (!settleReq) return;
    const balancing: Transaction = {
      id: uniqueId(),
      amount: -settleReq.total,
      notes: 'تسوية نهائية وإغلاق الحساب',
      date: Timestamp.now(),
      isSettled: true,
    };
    const archiveType: ArchiveType = settleReq.kind === 'advance' ? 'advances' : 'work';
    await archiveClient(settleReq.kind, settleReq.client.id, [...settleReq.client.transactions, balancing], archiveType);
    setSettleReq(null);
  }, [settleReq]);

  const handleConfirmRestore = useCallback(async (): Promise<void> => {
    if (!restoreReq) return;
    await restoreClient(restoreReq.kind, restoreReq.client.id);
    setRestoreReq(null);
  }, [restoreReq]);

  /* ----- entities & lots ----- */

  const refreshCommission = useCallback(async (entity: Entity): Promise<void> => {
    await syncBuyerCommission(entity, { userId: user.uid, advanceClients });
  }, [advanceClients, user.uid]);

  const handleSaveEntity = useCallback(async (data: EntityFormData): Promise<void> => {
    const name = data.name.trim();
    if (!name) {
      alert('يرجى إدخال اسم صحيح للجهة.');
      return;
    }
    const auctionDate = timestampFromDateInput(data.auctionDate);
    if (entityModal.entity) {
      await updateEntityMeta(entityModal.entity.id, { name, buyerName: data.buyerName, auctionDate });
      await refreshCommission({ ...entityModal.entity, name, buyerName: data.buyerName, auctionDate });
    } else {
      await createEntity({ name, buyerName: data.buyerName, auctionDate, userId: user.uid });
    }
    setEntityModal({ open: false, entity: null });
  }, [entityModal.entity, refreshCommission, user.uid]);

  const handleSaveAwardedEntity = useCallback(async (payload: AwardedEntityPayload): Promise<void> => {
    const auctionDate = timestampFromDateInput(payload.auctionDate);
    const newLots: Lot[] = payload.lots.map((lot, index) => ({
      id: `${Date.now()}_${index}`,
      lotNumber: lot.lotNumber,
      name: lot.name,
      quantity: lot.quantity,
      totalValue: Number(lot.totalValue),
      value30: Number(lot.value30),
      value70: Number(lot.value70),
      isArchived: false,
      is70Paid: false,
    }));

    const existing = entities.find(
      (entity) =>
        entity.name.trim().toLowerCase() === payload.entityName.trim().toLowerCase() &&
        formatDate(entity.auctionDate) === formatDate(auctionDate),
    );

    if (existing) {
      const merged = [...existing.lots, ...newLots];
      await appendEntityLots(existing.id, merged, payload.buyerName || undefined);
      await refreshCommission({ ...existing, lots: merged, buyerName: payload.buyerName || existing.buyerName });
    } else {
      const id = await createEntity({
        name: payload.entityName.trim(),
        buyerName: payload.buyerName,
        auctionDate,
        userId: user.uid,
      });
      await setEntityLots(id, newLots);
      await refreshCommission({ id, userId: user.uid, name: payload.entityName.trim(), buyerName: payload.buyerName, auctionDate, lots: newLots });
    }
    setBrochureOpen(false);
  }, [entities, refreshCommission, user.uid]);

  const handleSaveLot = useCallback(async (data: LotFormData): Promise<void> => {
    const entity = entities.find((e) => e.id === lotModal.entityId);
    if (!entity) return;
    const base: Lot = {
      id: lotModal.lot?.id ?? uniqueId(),
      lotNumber: data.lotNumber,
      name: data.name,
      quantity: data.quantity,
      totalValue: data.totalValue,
      value30: data.value30,
      value70: data.value70,
      is70Paid: lotModal.lot?.is70Paid ?? false,
      isArchived: lotModal.lot?.isArchived ?? false,
    };
    if (data.contractImage) base.contractImage = data.contractImage;
    else if (lotModal.lot?.contractImage) base.contractImage = lotModal.lot.contractImage;
    if (lotModal.lot?.paymentDetails) base.paymentDetails = lotModal.lot.paymentDetails;
    if (lotModal.lot?.loadingDetails) base.loadingDetails = lotModal.lot.loadingDetails;

    const updated = lotModal.lot
      ? entity.lots.map((l) => (l.id === lotModal.lot?.id ? base : l))
      : [...entity.lots, base];
    await setEntityLots(entity.id, updated);
    await refreshCommission({ ...entity, lots: updated });
    setLotModal({ open: false, entityId: '', lot: null });
  }, [entities, lotModal, refreshCommission]);

  const handleSaveSupply = useCallback(async (data: SupplyFormData): Promise<void> => {
    const entity = entities.find((e) => e.id === supplyModal.entityId);
    if (!entity) return;
    const updated = entity.lots.map((lot) => {
      const targeted = supplyModal.lotId ? lot.id === supplyModal.lotId : !lot.is70Paid;
      if (!targeted) return lot;
      const next: Lot = {
        ...lot,
        is70Paid: true,
        paymentDetails: { payerName: data.payerName, date: Timestamp.fromDate(data.date) },
      };
      if (data.receiptImage && next.paymentDetails) next.paymentDetails.receiptImage = data.receiptImage;
      return next;
    });
    await setEntityLots(entity.id, updated);
    setSupplyModal({ open: false, entityId: '' });
  }, [entities, supplyModal]);

  const handleSaveLoading = useCallback(async (data: LoadingFormData): Promise<void> => {
    const entity = entities.find((e) => e.id === loadingModal.entityId);
    if (!entity) return;
    const updated = entity.lots.map((lot) => {
      const targeted = loadingModal.lotId ? lot.id === loadingModal.lotId : !lot.isArchived;
      if (!targeted) return lot;
      return { ...lot, isArchived: true, loadingDetails: { loaderName: data.loaderName, date: Timestamp.fromDate(data.date) } };
    });
    await setEntityLots(entity.id, updated);
    setLoadingModal({ open: false, entityId: '' });
  }, [entities, loadingModal]);

  const handleToggleLotArchive = useCallback(async (entityId: string, lotId: string): Promise<void> => {
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) return;
    const updated = entity.lots.map((lot) => (lot.id === lotId ? { ...lot, isArchived: !lot.isArchived } : lot));
    await setEntityLots(entity.id, updated);
    await refreshCommission({ ...entity, lots: updated });
  }, [entities, refreshCommission]);

  const handleConfirmDeleteLot = useCallback(async (): Promise<void> => {
    if (!deleteLotReq) return;
    const entity = entities.find((e) => e.id === deleteLotReq.entityId);
    if (entity) {
      const updated = entity.lots.filter((l) => l.id !== deleteLotReq.lotId);
      await setEntityLots(entity.id, updated);
      await refreshCommission({ ...entity, lots: updated });
    }
    setDeleteLotReq(null);
  }, [deleteLotReq, entities, refreshCommission]);

  const handleConfirmDeleteEntity = useCallback(async (): Promise<void> => {
    if (!deleteEntityId) return;
    await deleteEntity(deleteEntityId);
    setDeleteEntityId(null);
  }, [deleteEntityId]);

  const handleConfirmDeleteClient = useCallback(async (): Promise<void> => {
    if (!deleteClientReq) return;
    await deleteClient(deleteClientReq.kind, deleteClientReq.id);
    setDeleteClientReq(null);
  }, [deleteClientReq]);

  const handleConfirmDeleteTx = useCallback(async (): Promise<void> => {
    if (!deleteTxReq) return;
    const source = deleteTxReq.kind === 'advance' ? advanceClients : workClients;
    const client = source.find((c) => c.id === deleteTxReq.clientId);
    if (client) {
      await setClientTransactions(deleteTxReq.kind, client.id, client.transactions.filter((t) => t.id !== deleteTxReq.txId));
    }
    setDeleteTxReq(null);
  }, [deleteTxReq, advanceClients, workClients]);

  /* ----- partnerships (shared goods, profit split by agreement) ----- */

  useEffect(() => {
    if (viewMode !== 'partnerships') setOpenPartnershipId(null);
  }, [viewMode]);

  useEffect(() => {
    if (!openPartnershipId) {
      setShareLinks([]);
      return;
    }
    const unsubscribe = subscribeToShareLinks(
      openPartnershipId,
      (links) => setShareLinks(links),
      (error) => console.error('Share links sync failed:', error),
    );
    return unsubscribe;
  }, [openPartnershipId]);

  const handleCreateShareLink = useCallback(async (): Promise<void> => {
    if (!openPartnershipId) return;
    await createShareLink(openPartnershipId, 'full');
  }, [openPartnershipId]);

  const handleCreateBuyerLink = useCallback(async (buyerId: string): Promise<void> => {
    if (!openPartnershipId) return;
    await createShareLink(openPartnershipId, 'buyer', buyerId);
  }, [openPartnershipId]);

  const handleCreateSupplierLink = useCallback(async (): Promise<void> => {
    if (!openPartnershipId) return;
    await createShareLink(openPartnershipId, 'supplier');
  }, [openPartnershipId]);

  const handleRevokeShareLink = useCallback(async (token: string): Promise<void> => {
    await revokeShareLink(token);
  }, []);

  const syncPartner = useCallback(
    async (partnership: Partnership): Promise<void> => {
      await syncPartnerCommission(partnership, { userId: user.uid, advanceClients });
    },
    [advanceClients, user.uid],
  );

  const handleSavePartnership = useCallback(
    async (data: PartnershipFormData): Promise<void> => {
      if (partnershipModal.partnership) {
        const current = partnershipModal.partnership;
        await updatePartnershipMeta(current.id, {
          name: data.name,
          partners: data.partners,
          shares: data.shares,
          inOurName: data.inOurName,
          supplierName: data.supplierName,
        });
        await syncPartner({
          ...current,
          name: data.name,
          partners: data.partners,
          shares: data.shares,
          inOurName: data.inOurName,
          supplierName: data.supplierName,
        });
      } else {
        await createPartnership({
          userId: user.uid,
          name: data.name,
          partners: data.partners,
          shares: data.shares,
          inOurName: data.inOurName,
          supplierName: data.supplierName,
        });
      }
      setPartnershipModal({ open: false, partnership: null });
    },
    [partnershipModal.partnership, syncPartner, user.uid],
  );

  const handleSavePartnershipItem = useCallback(
    async (partnershipId: string, data: PartnershipItemFormData, existingId: string | null): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const deliveries: Delivery[] = data.deliveries.map((d) => ({
        id: uniqueId('del'),
        date: timestampFromDateInput(d.dateInput),
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        total: d.quantity * d.unitPrice,
      }));
      const existing = existingId ? current.items.find((item) => item.id === existingId) : undefined;
      const base: PartnershipItem = {
        id: existingId ?? uniqueId('pitem'),
        name: data.name,
        mode: data.mode,
        deliveries,
        createdBy: existing?.createdBy ?? editor,
        createdAt: existing?.createdAt ?? now,
        updatedBy: editor,
        updatedAt: now,
      };
      if (data.notes !== '') base.notes = data.notes;
      const updated = existingId
        ? current.items.map((item) => (item.id === existingId ? base : item))
        : [...current.items, base];
      await setPartnershipItems(current.id, updated);
      await syncPartner({ ...current, items: updated });
    },
    [partnerships, syncPartner, user.email, user.uid],
  );

  const handleDeletePartnershipItem = useCallback(
    async (partnershipId: string, itemId: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const updated = current.items.filter((item) => item.id !== itemId);
      await setPartnershipItems(current.id, updated);
      await syncPartner({ ...current, items: updated });
    },
    [partnerships, syncPartner],
  );

  const handleSavePartnershipTx = useCallback(
    async (partnershipId: string, data: PartnershipTxFormData, existingId: string | null): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const existing = existingId ? current.txs.find((tx) => tx.id === existingId) : undefined;
      const base: PartnershipTx = {
        id: existingId ?? uniqueId('ptx'),
        kind: data.kind,
        amount: data.amount,
        paidBy: data.paidBy,
        notes: data.notes,
        date: timestampFromDateInput(data.dateInput),
        createdBy: existing?.createdBy ?? editor,
        createdAt: existing?.createdAt ?? now,
        updatedBy: editor,
        updatedAt: now,
      };
      if (data.kind === 'reimbursement') base.reimburseTo = data.reimburseTo;
      else if (data.deliveredBy) base.deliveredBy = data.deliveredBy;
      const updated = existingId
        ? current.txs.map((tx) => (tx.id === existingId ? base : tx))
        : [...current.txs, base];
      await setPartnershipTxs(current.id, updated);
    },
    [partnerships, user.email, user.uid],
  );

  const handleDeletePartnershipTx = useCallback(
    async (partnershipId: string, txId: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      await setPartnershipTxs(
        current.id,
        current.txs.filter((tx) => tx.id !== txId),
      );
    },
    [partnerships],
  );

  const handleSaveSupplierPayment = useCallback(
    async (partnershipId: string, data: SupplierPaymentFormData, existingId: string | null): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const stored = (current.supplierPayments ?? []).filter((pay) => !pay.id.startsWith('legacy-'));
      const existing = existingId ? stored.find((pay) => pay.id === existingId) : undefined;
      const base: SupplierPayment = {
        id: existingId ?? uniqueId('spay'),
        amount: data.amount,
        paidBy: data.paidBy,
        date: timestampFromDateInput(data.dateInput),
        notes: data.notes,
        createdBy: existing?.createdBy ?? editor,
        createdAt: existing?.createdAt ?? now,
        updatedBy: editor,
        updatedAt: now,
      };
      if (data.deliveredBy) base.deliveredBy = data.deliveredBy;
      if (current.supplierName) base.supplierName = current.supplierName;
      const updated = existingId
        ? stored.map((pay) => (pay.id === existingId ? base : pay))
        : [...stored, base];
      await setPartnershipSupplierPayments(current.id, updated);
    },
    [partnerships, user.email, user.uid],
  );

  const handleDeleteSupplierPayment = useCallback(
    async (partnershipId: string, paymentId: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      await setPartnershipSupplierPayments(
        current.id,
        (current.supplierPayments ?? []).filter((pay) => pay.id !== paymentId && !pay.id.startsWith('legacy-')),
      );
    },
    [partnerships],
  );

  const handleSaveSupplierName = useCallback(
    async (partnershipId: string, supplierName: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      await updatePartnershipMeta(current.id, {
        name: current.name,
        partners: current.partners,
        shares: current.shares,
        inOurName: current.inOurName,
        supplierName,
      });
    },
    [partnerships],
  );

  /* ----- partnership sales (المباع) ----- */

  const handleSavePartnershipSale = useCallback(
    async (partnershipId: string, data: PartnershipSaleFormData, existingId: string | null): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const existing = existingId ? (current.sales ?? []).find((sale) => sale.id === existingId) : undefined;
      const lines = data.lines.map((line) => {
        // Never send `undefined` to Firestore — it rejects the whole write.
        const base = {
          name: line.name,
          mode: line.mode,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.quantity * line.unitPrice,
        };
        return line.unit === undefined ? base : { ...base, unit: line.unit };
      });
      const totalAmount = lines.reduce((sum, line) => sum + line.total, 0);
      // Auto-collect payments on create only (edits preserve existing payments).
      let payments: SalePayment[] = existing?.payments ?? [];
      if (!existing) {
        const saleDate = timestampFromDateInput(data.dateInput);
        if (data.hasDeposit && data.depositAmount > 0) {
          payments = [
            ...payments,
            {
              id: uniqueId('spaymt'),
              amount: Math.min(data.depositAmount, totalAmount),
              date: saleDate,
              by: 'me',
              notes: 'عربون',
              source: 'cash',
              createdBy: editor,
              createdAt: now,
              updatedBy: editor,
              updatedAt: now,
            },
          ];
        }
        const collected = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
        const remaining = totalAmount - collected;
        if (data.deductFromBalance && remaining > 0) {
          payments = [
            ...payments,
            {
              id: uniqueId('spaymt'),
              amount: remaining,
              date: saleDate,
              by: 'me',
              notes: 'خصم من رصيد المشتري',
              source: 'balance',
              createdBy: editor,
              createdAt: now,
              updatedBy: editor,
              updatedAt: now,
            },
          ];
        } else if (!data.hasDeposit && !data.deductFromBalance && totalAmount > 0) {
          // No deposit, no deduction → fully-paid cash sale counting in sales totals.
          payments = [
            ...payments,
            {
              id: uniqueId('spaymt'),
              amount: totalAmount,
              date: saleDate,
              by: 'me',
              notes: 'تحصيل كاش',
              source: 'cash',
              createdBy: editor,
              createdAt: now,
              updatedBy: editor,
              updatedAt: now,
            },
          ];
        }
      }
      const base: PartnershipSale = {
        id: existingId ?? uniqueId('psale'),
        buyerName: data.buyerName,
        lines,
        totalAmount,
        date: timestampFromDateInput(data.dateInput),
        payments,
        createdBy: existing?.createdBy ?? editor,
        createdAt: existing?.createdAt ?? now,
        updatedBy: editor,
        updatedAt: now,
      };
      if (data.buyerId) base.buyerId = data.buyerId;
      else if (existing?.buyerId) base.buyerId = existing.buyerId;
      if (data.isAdvance) base.isAdvance = true;
      if (data.notes !== '') base.notes = data.notes;
      const updated = existingId
        ? (current.sales ?? []).map((sale) => (sale.id === existingId ? base : sale))
        : [...(current.sales ?? []), base];
      await setPartnershipSales(current.id, updated);
    },
    [partnerships, user.email, user.uid],
  );

  const handleDeletePartnershipSale = useCallback(
    async (partnershipId: string, saleId: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      await setPartnershipSales(
        current.id,
        (current.sales ?? []).filter((sale) => sale.id !== saleId),
      );
    },
    [partnerships],
  );

  const handleSaveSalePayment = useCallback(
    async (partnershipId: string, saleId: string, data: SalePaymentFormData, existingId: string | null): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const updated = (current.sales ?? []).map((sale) => {
        if (sale.id !== saleId) return sale;
        const payments = sale.payments ?? [];
        const existing = existingId ? payments.find((pay) => pay.id === existingId) : undefined;
        const base: SalePayment = {
          id: existingId ?? uniqueId('spaymt'),
          amount: data.amount,
          date: timestampFromDateInput(data.dateInput),
          by: data.by,
          notes: data.notes,
          createdBy: existing?.createdBy ?? editor,
          createdAt: existing?.createdAt ?? now,
          updatedBy: editor,
          updatedAt: now,
        };
        return {
          ...sale,
          payments: existingId ? payments.map((pay) => (pay.id === existingId ? base : pay)) : [...payments, base],
          updatedBy: editor,
          updatedAt: now,
        };
      });
      await setPartnershipSales(current.id, updated);
    },
    [partnerships, user.email, user.uid],
  );

  const handleDeleteSalePayment = useCallback(
    async (partnershipId: string, saleId: string, paymentId: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const updated = (current.sales ?? []).map((sale) =>
        sale.id === saleId
          ? { ...sale, payments: (sale.payments ?? []).filter((pay) => pay.id !== paymentId), updatedBy: editor, updatedAt: Timestamp.now() }
          : sale,
      );
      await setPartnershipSales(current.id, updated);
    },
    [partnerships, user.email, user.uid],
  );

  /* ----- partnership buyers (first-class, prepaid balances) ----- */

  const handleAddBuyer = useCallback(
    async (partnershipId: string, data: NewBuyerFormData): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const buyer: PartnershipBuyer = {
        id: uniqueId('pbuyer'),
        name: data.name,
        topUps: [],
        createdBy: editor,
        createdAt: now,
        updatedBy: editor,
        updatedAt: now,
      };
      if (data.phone !== '') buyer.phone = data.phone;
      if (data.notes !== '') buyer.notes = data.notes;
      await setPartnershipBuyers(current.id, [...(current.buyers ?? []), buyer]);
    },
    [partnerships, user.email, user.uid],
  );

  const handleTopUpBuyer = useCallback(
    async (partnershipId: string, buyerId: string, data: BuyerTopUpFormData): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current) return;
      const editor = user.email ?? user.uid;
      const now = Timestamp.now();
      const topUp: BuyerTopUp = {
        id: uniqueId('ptopup'),
        amount: data.amount,
        date: timestampFromDateInput(data.dateInput),
        by: data.by,
        notes: data.notes,
        createdBy: editor,
        createdAt: now,
        updatedBy: editor,
        updatedAt: now,
      };
      const updated = (current.buyers ?? []).map((buyer) =>
        buyer.id === buyerId
          ? { ...buyer, topUps: [...(buyer.topUps ?? []), topUp], updatedBy: editor, updatedAt: now }
          : buyer,
      );
      await setPartnershipBuyers(current.id, updated);
    },
    [partnerships, user.email, user.uid],
  );

  /* ----- buyer profile ----- */

  const [buyerProfile, setBuyerProfile] = useState<string | null>(null);

  function matchesBuyerName(clientName: string, buyerName: string): boolean {
    const a = clientName.trim();
    const b = buyerName.trim();
    if (a === '' || b === '') return false;
    return a === b || a.includes(b) || b.includes(a);
  }

  const buyerAllSales: BuyerSaleRef[] = useMemo(() => {
    if (buyerProfile === null) return [];
    const refs: BuyerSaleRef[] = [];
    for (const partnership of partnerships) {
      for (const sale of partnership.sales ?? []) {
        if (sale.buyerName.trim() === buyerProfile.trim()) {
          refs.push({ partnershipId: partnership.id, partnershipName: partnership.name, sale });
        }
      }
    }
    refs.sort((a, b) => {
      const ta = typeof a.sale.date?.toMillis === 'function' ? a.sale.date.toMillis() : 0;
      const tb = typeof b.sale.date?.toMillis === 'function' ? b.sale.date.toMillis() : 0;
      return tb - ta;
    });
    return refs;
  }, [buyerProfile, partnerships]);

  const buyerPrivateMatches = useMemo(() => {
    if (buyerProfile === null) return { advances: [], work: [] };
    return {
      advances: advanceClients.filter((c) => !c.isArchived && matchesBuyerName(c.name, buyerProfile)),
      work: workClients.filter((c) => !c.isArchived && matchesBuyerName(c.name, buyerProfile)),
    };
  }, [buyerProfile, advanceClients, workClients]);

  const buyerProfileBalance = useMemo(() => {
    if (buyerProfile === null || openPartnershipId === null) return null;
    const current = partnerships.find((x) => x.id === openPartnershipId);
    if (!current) return null;
    const buyer = (current.buyers ?? []).find((b) => b.name.trim() === buyerProfile.trim());
    if (!buyer) return null;
    return buyerBalance(buyer, current.sales ?? []);
  }, [buyerProfile, openPartnershipId, partnerships]);

  const handleSettlePartnership = useCallback(
    async (partnershipId: string): Promise<void> => {
      const current = partnerships.find((x) => x.id === partnershipId);
      if (!current || current.status !== 'active') return;
      const partnerIds = ['me', ...current.partners.map((partner) => partner.id)];
      const settlement = partnershipSettlement(current.items ?? [], current.txs ?? [], current.shares, partnerIds, current.supplierPayments ?? [], current.sales ?? [], current.buyers ?? []);
      // Hub settlement through me: every other party settles directly with me.
      const settleTxs: PartnershipTx[] = [];
      let index = 0;
      for (const [partyId, due] of Object.entries(settlement.dues)) {
        if (partyId === 'me' || Math.abs(due) < 0.01) continue;
        index += 1;
        const tx: PartnershipTx = {
          id: `${uniqueId('psettle')}-${index}`,
          kind: 'reimbursement',
          amount: Math.abs(due),
          paidBy: due > 0 ? 'me' : partyId,
          notes: 'تسوية نهائية وإغلاق الشراكة',
          date: Timestamp.now(),
        };
        if (due > 0) tx.reimburseTo = partyId;
        else tx.reimburseTo = 'me';
        settleTxs.push(tx);
      }
      await settlePartnership(current.id, [...(current.txs ?? []), ...settleTxs]);
    },
    [partnerships],
  );

  const handleConfirmDeletePartnership = useCallback(async (): Promise<void> => {
    if (!deletePartnershipId) return;
    await removePartnerCommission(deletePartnershipId, advanceClients);
    await deletePartnership(deletePartnershipId);
    setOpenPartnershipId((current) => (current === deletePartnershipId ? null : current));
    setDeletePartnershipId(null);
  }, [deletePartnershipId, advanceClients]);

  /* ----- predefined ----- */

  const handleAddPredefinedItem = useCallback(async (name: string): Promise<void> => {
    await createPredefinedItem(name, user.uid);
    setItemQuickAdd(false);
  }, [user.uid]);

  const handleAddPredefinedBuyer = useCallback(async (name: string): Promise<void> => {
    await createPredefinedBuyer(name, user.uid);
    await createBuyerClientIfMissing(name, user.uid);
    setBuyerQuickAdd(false);
  }, [user.uid]);

  const handleAddRejectedLot = useCallback(async (input: RejectedLotInput): Promise<void> => {
    await createRejectedLot({ ...input, userId: user.uid });
  }, [user.uid]);

  const handleDeleteRejectedLot = useCallback(async (id: string): Promise<void> => {
    await deleteRejectedLot(id);
  }, []);

  /* ----- exports ----- */

  const handlePrint = useCallback(async (html: string): Promise<void> => {
    try {
      await printHtmlDocument(html);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'تعذر الطباعة');
    }
  }, []);

  const archivedAdvances = useMemo(() => advanceClients.filter((c) => c.isArchived), [advanceClients]);
  const archivedWork = useMemo(() => workClients.filter((c) => c.isArchived), [workClients]);
  const activeAdvances = useMemo(() => advanceClients.filter((c) => !c.isArchived), [advanceClients]);
  const activeWork = useMemo(() => workClients.filter((c) => !c.isArchived), [workClients]);

  const archivedLotEntries: ArchivedLotEntry[] = useMemo(
    () =>
      entities.flatMap((entity) =>
        entity.lots.filter((lot) => lot.isArchived).map((lot) => ({ lot, entityName: entity.name, entityBuyer: entity.buyerName })),
      ),
    [entities],
  );

  const businessSnapshot = useMemo(
    () =>
      buildBusinessSnapshot(entities, advanceClients, workClients, {
        partnerships,
        archivedCounts: {
          lots: archivedLotEntries.length,
          advances: archivedAdvances.length,
          work: archivedWork.length,
        },
        rejectedCount: rejectedLots.length,
      }),
    [entities, advanceClients, workClients, partnerships, archivedLotEntries, archivedAdvances, archivedWork, rejectedLots],
  );

  /* ----- render ----- */

  const renderContent = (): ReactNode => {
    switch (viewMode) {
      case 'dashboard':
        return (
          <div className="space-y-4">
            <InsightsCards snapshot={businessSnapshot} />
            <DashboardView
              entities={entities}
              advanceClients={advanceClients}
              workClients={workClients}
              onNavigate={onNavigate}
              onMetricClick={(filter) => {
                setEntitiesFilter(filter);
                onNavigate('entities');
              }}
            />
          </div>
        );
      case 'entities':
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEntityModal({ open: true, entity: null })}
                className="btn-primary"
              >
                + جهة جديدة
              </button>
              <button
                type="button"
                onClick={() => setBrochureOpen(true)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-warn-600 px-4 py-2 font-bold text-white shadow-soft transition hover:bg-warn-700"
              >
                📄 كراسات جلسات المزادات والترسية
              </button>
              <button
                type="button"
                onClick={() => void handlePrint(entitiesSummaryHtml(entities, exportDate))}
                className="btn-ghost"
              >
                🖨️ ملخص الجهات
              </button>
            </div>
            <EntitiesView
              key={entitiesFilter}
              entities={entities}
              initialStatusFilter={entitiesFilter}
              onOpenLotModal={(entity, lot) => setLotModal({ open: true, entityId: entity.id, lot: lot ?? null })}
              onOpenEntityModal={(entity) => setEntityModal({ open: true, entity })}
              onDeleteEntity={(entityId) => setDeleteEntityId(entityId)}
              onDeleteLot={(entityId, lotId) => setDeleteLotReq({ entityId, lotId })}
              onArchiveLot={(entityId, lotId) => void handleToggleLotArchive(entityId, lotId)}
              onOpenSupplyModal={(entityId, lotId) => setSupplyModal({ open: true, entityId, lotId })}
              onOpenLoadingModal={(entityId, lotId) => setLoadingModal({ open: true, entityId, lotId })}
              onExportEntity={(entity) => void handlePrint(singleEntityHtml(entity, exportDate))}
            />
          </div>
        );
      case 'advances':
      case 'work': {
        const kind: ClientType = viewMode === 'advances' ? 'advance' : 'work';
        const clients = kind === 'advance' ? activeAdvances : activeWork;
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setClientModal({ open: true, kind })}
                className="btn-primary"
              >
                + عميل جديد
              </button>
              <button
                type="button"
                onClick={() => void handlePrint(allClientsHtml(clients, exportDate))}
                className="btn-ghost"
              >
                🖨️ تصدير الكل
              </button>
            </div>
            <ClientsView
              kind={kind}
              clients={clients}
              onAddClient={() => setClientModal({ open: true, kind })}
              onDeleteClient={(clientId) => setDeleteClientReq({ kind, id: clientId })}
              onAddTransaction={(client) => setTxModal({ open: true, kind, client, tx: null })}
              onEditTransaction={(client, transaction) => setTxModal({ open: true, kind, client, tx: transaction })}
              onDeleteTransaction={(clientId, transactionId) => setDeleteTxReq({ kind, clientId, txId: transactionId })}
              onAddPayment={(client) => setPaymentModal({ open: true, kind, client })}
              onExportTransaction={(client, transaction) => void handlePrint(transactionHtml(client, transaction, exportDate))}
              onExportSummary={(client) => void handlePrint(clientSummaryHtml(client, exportDate))}
              onSettleClient={(client, total) => setSettleReq({ kind, client, total })}
            />
          </div>
        );
      }
      case 'partnerships': {
        const open = openPartnershipId ? partnerships.find((x) => x.id === openPartnershipId) ?? null : null;
        if (open) {
          return (
            <>
              <PartnershipDetails
                partnership={open}
                onBack={() => setOpenPartnershipId(null)}
                onEditMeta={() => setPartnershipModal({ open: true, partnership: open })}
                onDeletePartnership={() => setDeletePartnershipId(open.id)}
                onPrint={() => void handlePrint(partnershipHtml(open, exportDate))}
                onSaveItem={(data, existingId) => void handleSavePartnershipItem(open.id, data, existingId)}
                onDeleteItem={(itemId) => void handleDeletePartnershipItem(open.id, itemId)}
                onSaveTx={(data, existingId) => void handleSavePartnershipTx(open.id, data, existingId)}
                onDeleteTx={(txId) => void handleDeletePartnershipTx(open.id, txId)}
                onSettle={() => void handleSettlePartnership(open.id)}
                onSaveSupplierPayment={(data, existingId) => void handleSaveSupplierPayment(open.id, data, existingId)}
                onDeleteSupplierPayment={(paymentId) => void handleDeleteSupplierPayment(open.id, paymentId)}
                onSaveSupplierName={(name) => void handleSaveSupplierName(open.id, name)}
                onSaveSale={(data, existingId) => void handleSavePartnershipSale(open.id, data, existingId)}
                onDeleteSale={(saleId) => void handleDeletePartnershipSale(open.id, saleId)}
                onSaveSalePayment={(saleId, data, existingId) => void handleSaveSalePayment(open.id, saleId, data, existingId)}
                onDeleteSalePayment={(saleId, paymentId) => void handleDeleteSalePayment(open.id, saleId, paymentId)}
                onOpenBuyerProfile={(buyerName) => setBuyerProfile(buyerName)}
                onAddBuyer={(data) => void handleAddBuyer(open.id, data)}
                onTopUpBuyer={(buyerId, data) => void handleTopUpBuyer(open.id, buyerId, data)}
                shareLinks={shareLinks}
                onCreateShareLink={() => void handleCreateShareLink()}
                onCreateBuyerLink={(buyerId) => void handleCreateBuyerLink(buyerId)}
                onCreateSupplierLink={() => void handleCreateSupplierLink()}
                onRevokeShareLink={(token) => void handleRevokeShareLink(token)}
              />
              {buyerProfile !== null ? (
                <BuyerProfileModal
                  isOpen
                  onClose={() => setBuyerProfile(null)}
                  buyerName={buyerProfile}
                  currentPartnershipName={open.name}
                  currentSales={(open.sales ?? []).filter((sale) => sale.buyerName.trim() === buyerProfile.trim())}
                  allSales={buyerAllSales}
                  privateMatches={buyerPrivateMatches}
                  balance={buyerProfileBalance}
                />
              ) : null}
            </>
          );
        }
        return (
          <PartnershipsView
            partnerships={partnerships}
            onAdd={() => setPartnershipModal({ open: true, partnership: null })}
            onOpen={(selected) => setOpenPartnershipId(selected.id)}
            onEdit={(selected) => setPartnershipModal({ open: true, partnership: selected })}
            onDelete={(id) => setDeletePartnershipId(id)}
          />
        );
      }
      case 'archiveMenu': {
        const archivedLots = entities.reduce((count, entity) => count + entity.lots.filter((l) => l.isArchived).length, 0);
        return (
          <ArchiveMenuView
            counts={{ archivedLots, archivedAdvances: archivedAdvances.length, archivedWork: archivedWork.length }}
            onNavigate={(target: ArchiveMenuTarget) => {
              if (target === 'lots') onNavigate('archiveEntities');
              else if (target === 'work') onNavigate('archiveWork');
              else onNavigate('archiveAdvances');
            }}
            onExportReport={() =>
              void handlePrint(archiveReportHtml([...archivedAdvances, ...archivedWork], archivedLotEntries, exportDate))
            }
          />
        );
      }
      case 'archiveAdvances':
        return (
          <ArchiveClientsView
            clients={archivedAdvances}
            kindLabel="السلف"
            onRestore={(client) => setRestoreReq({ kind: 'advance', client })}
            onExportClient={(client) => void handlePrint(clientSummaryHtml(client, exportDate))}
            onExportAll={(clients) => void handlePrint(allClientsHtml(clients, exportDate))}
          />
        );
      case 'archiveWork':
        return (
          <ArchiveClientsView
            clients={archivedWork}
            kindLabel="الشغل"
            onRestore={(client) => setRestoreReq({ kind: 'work', client })}
            onExportClient={(client) => void handlePrint(clientSummaryHtml(client, exportDate))}
            onExportAll={(clients) => void handlePrint(allClientsHtml(clients, exportDate))}
          />
        );
      case 'archiveEntities':
        return (
          <ArchiveLotsView
            entities={entities}
            onRestoreLot={(lot, entityId) => void handleToggleLotArchive(entityId, lot.id)}
          />
        );
    }
  };

  return (
    <AppShell
      view={viewMode}
      onNavigate={onNavigate}
      title={VIEW_TITLES[viewMode]}
      userEmail={user.email}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
      onHome={onHome}
    >
        {dbError ? (
          <div className="card border-debit-500/40 bg-debit-50 p-4 text-debit-700 dark:bg-debit-600/10 dark:text-rose-200" role="alert">
            تعذر تحميل البيانات: {dbError.message}
          </div>
        ) : null}

        {renderContent()}

      <ClientModal
        isOpen={clientModal.open}
        clientTypeLabel={clientModal.kind === 'advance' ? 'سلف' : 'شغل'}
        existingClients={clientModal.kind === 'advance' ? advanceClients : workClients}
        onClose={() => setClientModal((current) => ({ ...current, open: false }))}
        onSave={(name, phone) => void handleAddClient(name, phone)}
      />

      {txModal.client ? (
        <TransactionModal
          isOpen={txModal.open}
          client={txModal.client}
          transaction={txModal.tx}
          predefinedItems={predefinedItems}
          onClose={() => setTxModal({ open: false, kind: 'advance', client: null, tx: null })}
          onSave={(data) => void handleSaveTransaction(data)}
          onUpload={handleFileUpload}
          onOpenPredefinedItemModal={() => setItemQuickAdd(true)}
        />
      ) : null}

      {paymentModal.client ? (
        <PaymentModal
          isOpen={paymentModal.open}
          client={paymentModal.client}
          onClose={() => setPaymentModal({ open: false, kind: 'advance', client: null })}
          onSave={(data) => void handleSavePayment(data)}
          onUpload={handleFileUpload}
        />
      ) : null}

      <EntityModal
        isOpen={entityModal.open}
        entity={entityModal.entity}
        buyerNames={buyerNames}
        onClose={() => setEntityModal({ open: false, entity: null })}
        onSave={(data) => void handleSaveEntity(data)}
        onAddBuyer={() => setBuyerQuickAdd(true)}
      />

      <LotModal
        isOpen={lotModal.open}
        lot={lotModal.lot}
        onClose={() => setLotModal({ open: false, entityId: '', lot: null })}
        onSave={(data) => void handleSaveLot(data)}
        onFileUpload={handleFileUpload}
      />

      <SupplyModal
        isOpen={supplyModal.open}
        title="توريد 70%"
        onClose={() => setSupplyModal({ open: false, entityId: '' })}
        onSave={(data) => void handleSaveSupply(data)}
        onFileUpload={handleFileUpload}
      />

      <LoadingModal
        isOpen={loadingModal.open}
        onClose={() => setLoadingModal({ open: false, entityId: '' })}
        onSave={(data) => void handleSaveLoading(data)}
      />

      <AuctionBrochureModal
        isOpen={brochureOpen}
        onClose={() => setBrochureOpen(false)}
        predefinedBuyers={predefinedBuyers}
        onOpenPredefinedBuyerModal={() => setBuyerQuickAdd(true)}
        onSaveAwardedEntity={(payload) => handleSaveAwardedEntity(payload)}
        rejectedLots={rejectedLots}
        onAddRejectedLot={(input) => handleAddRejectedLot(input)}
        onDeleteRejectedLot={(id) => handleDeleteRejectedLot(id)}
      />

      <QuickAddModal
        isOpen={itemQuickAdd}
        title="إضافة صنف جاهز"
        placeholder="اسم الصنف"
        confirmLabel="حفظ"
        onClose={() => setItemQuickAdd(false)}
        onSave={(name) => void handleAddPredefinedItem(name)}
      />

      <QuickAddModal
        isOpen={buyerQuickAdd}
        title="إضافة مشتري"
        placeholder="اسم المشتري"
        confirmLabel="حفظ"
        onClose={() => setBuyerQuickAdd(false)}
        onSave={(name) => void handleAddPredefinedBuyer(name)}
      />

      <PartnershipModal
        isOpen={partnershipModal.open}
        partnership={partnershipModal.partnership}
        onClose={() => setPartnershipModal({ open: false, partnership: null })}
        onSave={(data) => void handleSavePartnership(data)}
      />

      <ConfirmDialog
        isOpen={deletePartnershipId !== null}
        title="حذف الشراكة"
        message="هل أنت متأكد من حذف هذه الشراكة وكل أصنافها وحركاتها؟ لا يمكن التراجع."
        confirmLabel="حذف"
        onClose={() => setDeletePartnershipId(null)}
        onConfirm={() => void handleConfirmDeletePartnership()}
      />

      <ConfirmDialog
        isOpen={deleteEntityId !== null}
        title="حذف الجهة"
        message="هل أنت متأكد من حذف هذه الجهة وكل لوطاتها؟ لا يمكن التراجع."
        confirmLabel="حذف"
        onClose={() => setDeleteEntityId(null)}
        onConfirm={() => void handleConfirmDeleteEntity()}
      />

      <ConfirmDialog
        isOpen={deleteClientReq !== null}
        title="حذف العميل"
        message="هل أنت متأكد من حذف هذا العميل وكل حركاته؟ لا يمكن التراجع."
        confirmLabel="حذف"
        onClose={() => setDeleteClientReq(null)}
        onConfirm={() => void handleConfirmDeleteClient()}
      />

      <ConfirmDialog
        isOpen={deleteLotReq !== null}
        title="حذف اللوط"
        message="هل أنت متأكد من حذف هذا اللوط؟ لا يمكن التراجع."
        confirmLabel="حذف"
        onClose={() => setDeleteLotReq(null)}
        onConfirm={() => void handleConfirmDeleteLot()}
      />

      <ConfirmDialog
        isOpen={deleteTxReq !== null}
        title="حذف الحركة"
        message="هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع."
        confirmLabel="حذف"
        onClose={() => setDeleteTxReq(null)}
        onConfirm={() => void handleConfirmDeleteTx()}
      />

      <ConfirmDialog
        isOpen={settleReq !== null}
        title="تسوية وأرشفة"
        message="سيتم إضافة حركة تسوية نهائية ونقل العميل للأرشيف. متابعة؟"
        confirmLabel="تسوية وأرشفة"
        onClose={() => setSettleReq(null)}
        onConfirm={() => void handleConfirmSettle()}
      />

      <ConfirmDialog
        isOpen={restoreReq !== null}
        title="استعادة العميل"
        message="هل تريد استعادة هذا العميل من الأرشيف؟"
        confirmLabel="استعادة"
        onClose={() => setRestoreReq(null)}
        onConfirm={() => void handleConfirmRestore()}
      />

      <AiAssistant snapshot={businessSnapshot} />
    </AppShell>
  );
}

/* ---------- root ---------- */

export default function App(): ReactNode {
  const { user, authLoading, login, logout, loginError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>(() => viewFromHash());
  const [shareToken, setShareToken] = useState<string | null>(() => shareTokenFromHash());
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    const onPopState = (): void => {
      setViewMode(viewFromHash());
      setShareToken(shareTokenFromHash());
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
    };
  }, []);

  const navigate = useCallback((view: ViewMode): void => {
    setViewMode(view);
    window.history.pushState({ view }, '', `#${view}`);
  }, []);

  const goHome = useCallback((): void => navigate('dashboard'), [navigate]);

  const handleLogout = useCallback(async (): Promise<void> => {
    setViewMode('dashboard');
    await logout();
  }, [logout]);

  const handleLogin = useCallback(async (email: string, password: string, remember: boolean): Promise<void> => {
    setLoginBusy(true);
    try {
      await login(email, password, remember);
    } finally {
      setLoginBusy(false);
    }
  }, [login]);

  if (authLoading) {
    return <SplashScreen />;
  }

  if (shareToken !== null) {
    return <ShareView token={shareToken} />;
  }

  if (!user) {
    return (
      <LoginView
        initialEmail={localStorage.getItem(REMEMBER_EMAIL_KEY) ?? ''}
        loading={loginBusy}
        error={loginError}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <AuthedApp
      user={user}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={() => void handleLogout()}
      onHome={goHome}
      viewMode={viewMode}
      onNavigate={navigate}
    />
  );
}

// Re-exported helpers used by tests or future automation layers.
export { activeLotsTotal, calcCommission, clientBalance };
