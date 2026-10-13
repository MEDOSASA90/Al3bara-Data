import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../domain/constants';
import type { Audit, Transaction } from '../domain/types';
import { addClientTransaction } from './repositories';

/** Creates the buyer client doc and stores the commission tx as a subcollection doc. */
export async function createBuyerClient(
  userId: string,
  buyerName: string,
  commissionTx: Transaction,
): Promise<void> {
  const audit: Audit = { createdBy: userId, createdAt: commissionTx.date };
  const ref = await addDoc(collection(db, COLLECTIONS.advanceClients), {
    userId,
    name: buyerName,
    isBuyer: true,
    transactions: [],
    audit,
  });
  await addClientTransaction('advance', ref.id, userId, commissionTx);
}

/** Marks the doc as a buyer account (used when a commission lands on an existing client). */
export async function markBuyerDoc(clientId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.advanceClients, clientId), { isBuyer: true });
}
