import { Timestamp } from 'firebase/firestore';
import { activeLotsTotal, calcCommission } from '../domain/finance';
import type { Client, Entity, Transaction } from '../domain/types';
import { formatDate } from '../utils/format';
import {
  archiveClientDoc,
  createBuyerClient,
  removeCommissionTransactions,
  updateBuyerTransactions,
} from './commissionWrites';

export interface CommissionContext {
  userId: string;
  advanceClients: Client[];
}

/**
 * Replicates the original `syncBuyerCommission` behavior exactly:
 * - commission = 0.5% of active (non-archived) lots total
 * - stored as a settled credit (-amount) transaction linked by entityId
 * - follows the buyer when it changes, updates in place, removed at zero
 */
export async function syncBuyerCommission(
  entity: Entity,
  context: CommissionContext,
): Promise<void> {
  const commission = calcCommission(activeLotsTotal(entity));
  const buyerName = entity.buyerName?.trim() ?? '';

  for (const client of context.advanceClients) {
    const index = client.transactions.findIndex((t) => t.entityId === entity.id);
    if (index === -1) continue;

    if (client.name === buyerName) {
      if (commission > 0) {
        const updated = [...client.transactions];
        const current = updated[index];
        if (!current) continue;
        updated[index] = {
          ...current,
          amount: -commission,
          date: entity.auctionDate ?? Timestamp.now(),
          notes: `عمولة 0.5% عن جلسة بتاريخ ${formatDate(entity.auctionDate)}`,
          isSettled: true,
        };
        await updateBuyerTransactions(client.id, updated);
      } else {
        await removeCommissionTransactions(client.id, entity.id);
      }
      return;
    }

    // Buyer changed — drop the commission from the previous owner.
    await removeCommissionTransactions(client.id, entity.id);
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
    };

    if (buyerClient) {
      await updateBuyerTransactions(buyerClient.id, [...buyerClient.transactions, commissionTx]);
    } else {
      await createBuyerClient(context.userId, buyerName, commissionTx);
    }
  }
}

export { archiveClientDoc };
