import { Timestamp } from 'firebase/firestore';
import { COMMISSION_RATE } from '../domain/constants';
import type { Client, Partnership, Transaction } from '../domain/types';
import { primaryPartnerName } from '../domain/types';
import { itemBuyCost } from '../domain/finance';
import {
  addClientTransaction,
  deleteClientTransactionsWhere,
  updateClientTransaction,
} from './repositories';
import { createBuyerClient } from './commissionWrites';

export interface PartnerCommissionContext {
  userId: string;
  advanceClients: Client[];
}

/** 0.5% of total buy cost when the goods are held in our name, otherwise zero. */
export function partnerCommissionValue(partnership: Pick<Partnership, 'items' | 'inOurName'>): number {
  if (!partnership.inOurName) return 0;
  const buyCost = (partnership.items ?? []).reduce((sum, item) => sum + itemBuyCost(item), 0);
  return buyCost * COMMISSION_RATE;
}

function commissionTx(partnership: Partnership, commission: number): Transaction {
  return {
    id: `${Date.now()}_partcomm`,
    partnershipId: partnership.id,
    amount: -commission,
    notes: `عمولة 0.5% شراكة: ${partnership.name}`,
    date: partnership.createdAt ?? Timestamp.now(),
    isSettled: true,
    items: [],
    createdBy: 'العمولة التلقائية',
  };
}

/**
 * Mirrors `syncBuyerCommission` for partnerships:
 * - commission = 0.5% of buy cost when inOurName, else 0
 * - stored as a settled credit transaction linked by partnershipId in the
 *   transaction SUBCOLLECTION of the advance account named after the partner
 * - follows the partner when the name changes, updates in place, removed at zero
 */
export async function syncPartnerCommission(
  partnership: Partnership,
  context: PartnerCommissionContext,
): Promise<void> {
  const commission = partnerCommissionValue(partnership);
  const partnerName = primaryPartnerName(partnership).trim();
  const matchPartnership = (tx: Transaction): boolean => tx.partnershipId === partnership.id;

  for (const client of context.advanceClients) {
    const tx = client.transactions.find(matchPartnership);
    if (!tx) continue;

    if (client.name === partnerName) {
      if (commission > 0) {
        await updateClientTransaction('advance', client.id, context.userId, {
          ...tx,
          amount: -commission,
          date: partnership.createdAt ?? Timestamp.now(),
          notes: `عمولة 0.5% شراكة: ${partnership.name}`,
          isSettled: true,
        });
      } else {
        await deleteClientTransactionsWhere('advance', client.id, matchPartnership);
      }
      return;
    }

    // Partner changed — drop the commission from the previous owner(s).
    await deleteClientTransactionsWhere('advance', client.id, matchPartnership);
  }

  if (commission > 0 && partnerName !== '') {
    const partnerClient = context.advanceClients.find((c) => c.name === partnerName);
    const tx = commissionTx(partnership, commission);

    if (partnerClient) {
      await addClientTransaction('advance', partnerClient.id, context.userId, tx);
    } else {
      await createBuyerClient(context.userId, partnerName, tx);
    }
  }
}

/** Removes the partnership commission from every advance account (e.g. on partnership delete). */
export async function removePartnerCommission(
  partnershipId: string,
  advanceClients: Client[],
): Promise<void> {
  for (const client of advanceClients) {
    if (client.transactions.some((tx) => tx.partnershipId === partnershipId)) {
      await deleteClientTransactionsWhere(
        'advance',
        client.id,
        (tx) => tx.partnershipId === partnershipId,
      );
    }
  }
}
