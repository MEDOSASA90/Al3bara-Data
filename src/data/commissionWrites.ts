import {
  addDoc,
  collection,
  doc,
  getDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../domain/constants';
import type { Transaction } from '../domain/types';
import { toClient } from './repositories';

async function readAdvanceClient(clientId: string): Promise<{ transactions: Transaction[] }> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.advanceClients, clientId));
  const data: DocumentData | undefined = snapshot.data();
  if (!data) return { transactions: [] };
  return { transactions: toClient(snapshot.id, data).transactions };
}

export async function updateBuyerTransactions(
  clientId: string,
  transactions: Transaction[],
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.advanceClients, clientId), {
    transactions,
    isBuyer: true,
  });
}

export async function removeCommissionTransactions(
  clientId: string,
  entityId: string,
): Promise<void> {
  const { transactions } = await readAdvanceClient(clientId);
  await updateDoc(doc(db, COLLECTIONS.advanceClients, clientId), {
    transactions: transactions.filter((t) => t.entityId !== entityId),
  });
}

export async function removePartnershipCommissionTransactions(
  clientId: string,
  partnershipId: string,
): Promise<void> {
  const { transactions } = await readAdvanceClient(clientId);
  await updateDoc(doc(db, COLLECTIONS.advanceClients, clientId), {
    transactions: transactions.filter((t) => t.partnershipId !== partnershipId),
  });
}

export async function createBuyerClient(
  userId: string,
  buyerName: string,
  commissionTx: Transaction,
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.advanceClients), {
    userId,
    name: buyerName,
    isBuyer: true,
    transactions: [commissionTx],
  });
}

export async function archiveClientDoc(
  collectionName: string,
  clientId: string,
  transactions: Transaction[],
  archiveType: string,
): Promise<void> {
  await updateDoc(doc(db, collectionName, clientId), {
    transactions,
    isArchived: true,
    archiveType,
  });
}
