import { Timestamp } from 'firebase/firestore';
import { activeLotsTotal, calcCommission } from '../domain/finance';
import type { Client, Entity, Transaction } from '../domain/types';
import { formatDate } from '../utils/format';
import {
  addClientTransaction,
  deleteClientTransactionsWhere,
  updateClientTransaction,
} from './repositories';
import { createBuyerClient } from './commissionWrites';

export interface CommissionContext {
  userId: string;
  advanceClients: Client[];
}

/**
 * Buyer commission sync (0.5% of active lots total):
 * - stored as a settled credit (-amount) transaction linked by entityId
 * - every write targets the transaction SUBCOLLECTION (doc id preserved, so
 *   legacy in-doc copies are shadowed by the merge until migration clears them)
 * - follows the buyer when it changes, updates in place, removed at zero
 */
export async function syncBuyerCommission(
  entity: Entity,
  context: CommissionContext,
): Promise<void> {
  const commission = calcCommission(activeLotsTotal(entity));
  const buyerName = entity.buyerName?.trim() ?? '';
  const matchEntity = (tx: Transaction): boolean => tx.entityId === entity.id;

  for (const client of context.advanceClients) {
    const tx = client.transactions.find(matchEntity);
    if (!tx) continue;

    if (client.name === buyerName) {
      if (commission > 0) {
        await updateClientTransaction('advance', client.id, context.userId, {
          ...tx,
          amount: -commission,
          date: entity.auctionDate ?? Timestamp.now(),
          notes: `عمولة 0.5% عن جلسة بتاريخ ${formatDate(entity.auctionDate)}`,
          isSettled: true,
        });
      } else {
        await deleteClientTransactionsWhere('advance', client.id, matchEntity);
      }
      return;
    }

    // Buyer changed — drop the commission from the previous owner(s).
    await deleteClientTransactionsWhere('advance', client.id, matchEntity);
  }

  if (commission > 0 && buyerName) {
    const buyerClient = context.advanceClients.find((c) => c.name === buyerName);
    const commissionTx: Transaction = {
      id: `${Date.now()}_comm`,
      entityId: entity.id,
      amount: -commission,
      notes: `عمولة 0.5% عن جلسة بتاريخ ${formatDate(entity.auctionDate)}`,
      date: entity.auctionDate ?? Timestamp.now(),
      isSettled: true,
      items: [],
      createdBy: 'العمولة التلقائية',
    };

    if (buyerClient) {
      await addClientTransaction('advance', buyerClient.id, context.userId, commissionTx);
    } else {
      await createBuyerClient(context.userId, buyerName, commissionTx);
    }
  }
}
