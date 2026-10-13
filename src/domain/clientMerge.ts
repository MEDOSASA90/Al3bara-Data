import type { Client, Transaction } from './types';

/**
 * Pure merge of legacy in-doc transaction arrays with the transactions
 * subcollection docs, deduped by transaction id (subcollection wins).
 * Keeps every view consuming the same `Client.transactions` shape while
 * the one-time migration moves arrays into subcollection docs.
 */
export function mergeClientsWithTransactions(
  clients: Client[],
  txsByClientId: ReadonlyMap<string, Transaction[]>,
): Client[] {
  return clients.map((client) => {
    const docTxs = txsByClientId.get(client.id) ?? [];
    const legacyTxs = client.transactions ?? [];
    if (docTxs.length === 0) {
      return legacyTxs === client.transactions ? client : { ...client, transactions: legacyTxs };
    }
    const byId = new Map<string, Transaction>();
    for (const tx of legacyTxs) byId.set(tx.id, tx);
    for (const tx of docTxs) byId.set(tx.id, tx);
    const merged = [...byId.values()].sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    });
    return { ...client, transactions: merged };
  });
}

/** Group subcollection transaction docs by their parent client id. */
export function groupTransactionsByClientId(
  txs: (Transaction & { clientId?: string; clientType?: string })[],
): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (typeof tx.clientId !== 'string' || tx.clientId === '') continue;
    const list = map.get(tx.clientId) ?? [];
    list.push(tx);
    map.set(tx.clientId, list);
  }
  return map;
}

/** Clients that still hold transactions in the legacy in-doc array (need one-time migration). */
export function clientsNeedingMigration(
  clients: Client[],
): Client[] {
  return clients.filter((client) => (client.transactions ?? []).length > 0);
}

/** Count of legacy in-doc transactions across a client list (migration progress metric). */
export function countLegacyTransactions(clients: Client[]): number {
  return clients.reduce((sum, client) => sum + (client.transactions?.length ?? 0), 0);
}
