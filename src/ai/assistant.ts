import type { Client, Entity, Partnership } from '../domain/types';
import { activeLotsTotal, clientBalance, daysUntilDeadline, isLotUnpaid } from '../domain/finance';
import { generateText } from './geminiClient';

const ASSISTANT_SYSTEM =
  'أنت مساعد تجاري ذكي لتاجر مزادات الخردة والكهنة (العبارة). ' +
  'أجب بالعربية المصرية المبسطة، باختصار ودقة، واذكر الأرقام بالجنيه المصري. ' +
  'اعتمد فقط على الملخص المرفق ولا تخترع أرقاماً غير موجودة فيه.';

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ج`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Optional extra context for the business snapshot (backward compatible). */
export interface BusinessSnapshotExtras {
  partnerships?: Partnership[];
  archivedCounts?: { lots: number; advances: number; work: number };
  rejectedCount?: number;
}

/**
 * Arabic compact summary of the whole business for AI context:
 * totals, unpaid-70 lots + overdue, top debtors, recent activity.
 */
export function buildBusinessSnapshot(
  entities: Entity[],
  advanceClients: Client[],
  workClients: Client[],
  extras?: BusinessSnapshotExtras,
): string {
  const now = new Date();
  const activeEntities = entities.filter((entity) => entity.lots.some((lot) => !lot.isArchived));

  let totalLotsValue = 0;
  let unpaid70Total = 0;
  const overdueLines: string[] = [];
  const entityLines: string[] = [];

  for (const entity of entities) {
    totalLotsValue += activeLotsTotal(entity);
    const unpaid = entity.lots.filter(isLotUnpaid);
    if (unpaid.length === 0) continue;
    const unpaidSum = unpaid.reduce((sum, lot) => sum + lot.value70, 0);
    unpaid70Total += unpaidSum;
    const daysLeft = daysUntilDeadline(entity.auctionDate, now);
    const overdue = daysLeft < 0;
    if (overdue) {
      overdueLines.push(
        `${entity.name}: ${unpaid.length} لوط متأخر ${Math.abs(daysLeft)} يوم (${formatMoney(unpaidSum)})`,
      );
    }
    entityLines.push(
      `${entity.name}: ${unpaid.length} لوط غير محصّل 70% بقيمة ${formatMoney(unpaidSum)}`,
    );
  }

  const allClients = [...advanceClients, ...workClients];
  const debtors = allClients
    .map((client) => ({ name: client.name, balance: clientBalance(client) }))
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const totalReceivables = debtors.reduce((sum, entry) => sum + entry.balance, 0);
  const topDebtors = debtors.slice(0, 5);

  const recentTx = allClients
    .flatMap((client) =>
      client.transactions.map((tx) => ({ clientName: client.name, amount: tx.amount, date: tx.date })),
    )
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
    .slice(0, 5);

  const lines: string[] = [
    'ملخص النشاط التجاري (العبارة):',
    `عدد الكيانات: ${entities.length} (نشط: ${activeEntities.length})`,
    `عدد العملاء: ${allClients.length} (سلف: ${advanceClients.length}، شغل: ${workClients.length})`,
    `إجمالي قيمة اللوطات النشطة: ${formatMoney(totalLotsValue)}`,
    `إجمالي 70% غير المحصّل: ${formatMoney(unpaid70Total)}`,
    `إجمالي المستحق من العملاء: ${formatMoney(totalReceivables)}`,
  ];

  lines.push('أرصدة غير محصلة 70%:');
  if (entityLines.length === 0) lines.push('- لا توجد لوطات غير محصلة.');
  else for (const line of entityLines.slice(0, 8)) lines.push(`- ${line}`);

  lines.push('لوطات متأخرة عن مهلة 15 يوم:');
  if (overdueLines.length === 0) lines.push('- لا توجد لوطات متأخرة.');
  else for (const line of overdueLines.slice(0, 8)) lines.push(`- ${line}`);

  lines.push('أكبر المدينين:');
  if (topDebtors.length === 0) lines.push('- لا توجد مديونيات.');
  else for (const entry of topDebtors) lines.push(`- ${entry.name}: ${formatMoney(entry.balance)}`);

  lines.push('أحدث الحركات:');
  if (recentTx.length === 0) lines.push('- لا توجد حركات مسجلة.');
  else {
    for (const tx of recentTx) {
      const kind = tx.amount > 0 ? 'مدين' : 'دائن';
      lines.push(`- ${tx.clientName}: ${kind} ${formatMoney(Math.abs(tx.amount))} بتاريخ ${formatDate(tx.date.toDate())}`);
    }
  }

  const partnerships = extras?.partnerships ?? [];
  if (partnerships.length > 0) {
    const active = partnerships.filter((p) => p.status === 'active').length;
    lines.push(`الشراكات: ${partnerships.length} (نشطة: ${active})`);
    for (const p of partnerships.slice(0, 5)) {
      const partnerNames = p.partners.map((partner) => partner.name).join('، ') || 'بدون شركاء';
      lines.push(`- ${p.name} [${p.status === 'active' ? 'نشطة' : 'مسواة'}] مع ${partnerNames}`);
    }
  }

  const archived = extras?.archivedCounts;
  if (archived) {
    lines.push(`الأرشيف: لوطات ${archived.lots}، سلف ${archived.advances}، شغل ${archived.work}`);
  }

  if (extras?.rejectedCount !== undefined && extras.rejectedCount > 0) {
    lines.push(`لوطات مرفوضة (خسرناها): ${extras.rejectedCount}`);
  }

  return lines.join('\n');
}

/** Chat over a prebuilt snapshot — keeps prompts small and grounded. */
export async function askAssistant(question: string, snapshot: string): Promise<string> {
  if (question.trim() === '') throw new Error('اكتب سؤالاً أولاً.');
  return generateText({
    system: ASSISTANT_SYSTEM,
    prompt: `ملخص النشاط:\n${snapshot}\n\nسؤال التاجر: ${question}`,
  });
}
