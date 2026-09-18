import { Timestamp } from 'firebase/firestore';
import { COMMISSION_RATE } from '../domain/constants';
import type { Client, Partnership, Transaction } from '../domain/types';
import { primaryPartnerName } from '../domain/types';
import { itemBuyCost } from '../domain/finance';
import {
  createBuyerClient,
  removePartnershipCommissionTransactions,
  updateBuyerTransactions,
} from './commissionWrites';

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
  };
}

/**
 * Mirrors `syncBuyerCommission` for partnerships:
 * - commission = 0.5% of buy cost when inOurName, else 0
 * - stored as a settled credit (-amount) transaction linked by partnershipId
 *   on the advance account named partnerName (created as a buyer client if missing)
 * - follows the partner when the name changes, updates in place, removed at zero
 */
export async function syncPartnerCommission(
  partnership: Partnership,
  context: PartnerCommissionContext,
): Promise<void> {
  const commission = partnerCommissionValue(partnership);
  const partnerName = primaryPartnerName(partnership).trim();

  for (const client of context.advanceClients) {
    const index = client.transactions.findIndex((t) => t.partnershipId === partnership.id);
    if (index === -1) continue;

    if (client.name === partnerName) {
      if (commission > 0) {
        const updated = [...client.transactions];
        const current = updated[index];
        if (!current) continue;
        updated[index] = {
          ...current,
          amount: -commission,
          date: partnership.createdAt ?? Timestamp.now(),
          notes: `عمولة 0.5% شراكة: ${partnership.name}`,
          isSettled: true,
        };
        await updateBuyerTransactions(client.id, updated);
      } else {
        await removePartnershipCommissionTransactions(client.id, partnership.id);
      }
      return;
    }

    // Partner changed — drop the commission from the previous owner.
    await removePartnershipCommissionTransactions(client.id, partnership.id);
  }

  if (commission > 0 && partnerName !== '') {
    const partnerClient = context.advanceClients.find((c) => c.name === partnerName);
    const tx = commissionTx(partnership, commission);

    if (partnerClient) {
      await updateBuyerTransactions(partnerClient.id, [...partnerClient.transactions, tx]);
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
    if (client.transactions.some((t) => t.partnershipId === partnershipId)) {
      await removePartnershipCommissionTransactions(client.id, partnershipId);
    }
  }
}
