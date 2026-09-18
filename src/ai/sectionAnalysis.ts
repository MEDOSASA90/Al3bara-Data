import type { Client, Partnership } from '../domain/types';
import { clientBalance, itemBuyCost, partnershipSettlement } from '../domain/finance';
import { generateText } from './geminiClient';

const SECTION_SYSTEM =
  'أنت محلل مالي لتاجر خردة (العبارة). أجب بالعربية المصرية المبسطة، ' +
  'نقاط قصيرة مرقمة، أرقام بالجنيه، بدون حشو ولا اختراع أرقام خارج البيانات.';

function txDate(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return '';
}

/** AI summary of one client ledger (advances / work / archive). */
export async function summarizeClient(client: Client, scopeLabel: string): Promise<string> {
  const txs = client.transactions ?? [];
  const balance = clientBalance(client);
  const debit = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const credit = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const recent = [...txs]
    .sort((a, b) => {
      const ta = typeof a.date?.toMillis === 'function' ? a.date.toMillis() : 0;
      const tb = typeof b.date?.toMillis === 'function' ? b.date.toMillis() : 0;
      return tb - ta;
    })
    .slice(0, 10)
    .map((t) => ({ amount: t.amount, notes: t.notes, date: txDate(t.date), settled: t.isSettled }));
  const payload = { name: client.name, scope: scopeLabel, balance, debit, credit, txCount: txs.length, recent };
  return generateText({
    system: SECTION_SYSTEM,
    prompt: `حلّل حساب العميل التالي ولخصه: الإجماليات، سلوك السداد، وآخر الحركات، ثم اقتراح عملي واحد.\n${JSON.stringify(payload)}`,
  });
}

/** AI analysis of one partnership: margins, dues, risks. */
export async function summarizePartnership(p: Partnership): Promise<string> {
  const partyIds = ['me', ...p.partners.map((partner) => partner.id)];
  const s = partnershipSettlement(
    p.items ?? [],
    p.txs ?? [],
    p.shares,
    partyIds,
    p.supplierPayments ?? [],
    p.sales ?? [],
    p.buyers ?? [],
  );
  const items = (p.items ?? []).map((item) => ({
    name: item.name,
    mode: item.mode ?? 'lot',
    cost: itemBuyCost(item),
    deliveries: (item.deliveries ?? []).length,
  }));
  const dues = partyIds.map((id) => ({ party: id === 'me' ? 'وليد' : (p.partners.find((x) => x.id === id)?.name ?? id), due: s.dues[id] ?? 0 }));
  const payload = {
    name: p.name,
    status: p.status,
    partners: p.partners.map((x) => ({ name: x.name, share: p.shares[x.id] ?? 0 })),
    myShare: p.shares['me'] ?? 0,
    buyCost: s.buyCost,
    expenses: s.expenses,
    sales: s.sales,
    profit: s.profit,
    myProfit: s.myProfit,
    dues,
    items,
    salesCount: (p.sales ?? []).length,
  };
  return generateText({
    system: SECTION_SYSTEM,
    prompt: `حلّل الشراكة التالية: هوامش الربح، شرح المستحقات على كل طرف، وأهم 3 مخاطر أو ملاحظات عملية.\n${JSON.stringify(payload)}`,
  });
}
