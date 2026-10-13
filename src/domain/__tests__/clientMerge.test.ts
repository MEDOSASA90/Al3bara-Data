import { describe, expect, it } from 'vitest';
import {
  clientsNeedingMigration,
  countLegacyTransactions,
  groupTransactionsByClientId,
  mergeClientsWithTransactions,
} from '../clientMerge';
import { Timestamp } from 'firebase/firestore';
import type { Client, Transaction } from '../types';

const ts = Timestamp.now();

function tx(id: string, amount = 100): Transaction {
  return { id, amount, notes: '', date: ts, isSettled: false };
}

function client(id: string, transactions: Transaction[]): Client {
  return { id, userId: 'u1', name: `عميل ${id}`, transactions };
}

describe('groupTransactionsByClientId', () => {
  it('يجمع الحركات على حسب العميل ويتجاهل غير المحدودة', () => {
    const grouped = groupTransactionsByClientId([
      { ...tx('a'), clientId: 'c1' },
      { ...tx('b'), clientId: 'c1' },
      { ...tx('c'), clientId: 'c2' },
      { ...tx('d'), clientId: '' },
    ]);
    expect(grouped.get('c1')).toHaveLength(2);
    expect(grouped.get('c2')).toHaveLength(1);
    expect(grouped.has('')).toBe(false);
  });
});

describe('mergeClientsWithTransactions', () => {
  it('يدمج المصفوفة القديمة مع مستندات المجموعة الفرعية', () => {
    const clients = [client('c1', [tx('legacy-1'), tx('legacy-2')])];
    const merged = mergeClientsWithTransactions(clients, new Map([['c1', [tx('sub-1')]]]));
    expect(merged[0]?.transactions.map((t) => t.id).sort()).toEqual(['legacy-1', 'legacy-2', 'sub-1']);
  });

  it('نسخة المجموعة الفرعية بتكسب عند تعارض الـ id (بتشيل النسخة القديمة)', () => {
    const clients = [client('c1', [tx('t1', 100)])];
    const merged = mergeClientsWithTransactions(clients, new Map([['c1', [tx('t1', 999)]]]));
    expect(merged[0]?.transactions).toHaveLength(1);
    expect(merged[0]?.transactions[0]?.amount).toBe(999);
  });

  it('عميل من غير حركات في المجموعة الفرعية يسيب المصفوفة زي ما هي', () => {
    const clients = [client('c1', [tx('legacy-1')])];
    const merged = mergeClientsWithTransactions(clients, new Map());
    expect(merged[0]?.transactions).toHaveLength(1);
  });
});

describe('migration helpers', () => {
  it('clientsNeedingMigration بيرجع اللي لسه عليهم مصفوفة', () => {
    const list = [client('c1', [tx('a')]), client('c2', [])];
    expect(clientsNeedingMigration(list).map((c) => c.id)).toEqual(['c1']);
  });

  it('countLegacyTransactions بيجمع أعداد الحركات القديمة', () => {
    const list = [client('c1', [tx('a'), tx('b')]), client('c2', [tx('c')]), client('c3', [])];
    expect(countLegacyTransactions(list)).toBe(3);
  });
});
