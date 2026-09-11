import { Timestamp } from 'firebase/firestore';
import type { Client, Entity, Lot, Partnership, Transaction } from '../../domain/types';
import { itemBuyCost, itemQuantity, partnershipSettlement, sortLotsByNumber, supplierBalance, supplierTotals } from '../../domain/finance';
import {
  formatCurrency,
  formatDate,
  formatSpecificDateTime,
  getDirectImageUrl,
} from '../../utils/format';

/** Archived lot row: the lot plus the owning entity's display info. */
export interface ArchivedLotEntry {
  lot: Lot;
  entityName: string;
  entityBuyer?: string;
}

const BRAND_SVG =
  '<svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/></svg>';

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
body { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #imageModal { display: none !important; }
}
#imageModal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; }
#imageModal.active { display: flex; }
#imageModal img { max-width: 90%; max-height: 90%; object-fit: contain; }
#imageModal .close-btn { position: absolute; top: 20px; right: 20px; color: white; font-size: 40px; font-weight: bold; cursor: pointer; background: rgba(0,0,0,0.5); width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
${body}
<div id="imageModal" onclick="closeImageModal()"><span class="close-btn" onclick="closeImageModal()">&times;</span><img id="modalImage" src="" alt="" onclick="event.stopPropagation()"></div>
<script>
function openImageModal(imageUrl, imageName) { const modal = document.getElementById('imageModal'); const modalImg = document.getElementById('modalImage'); modal.classList.add('active'); modalImg.src = imageUrl; modalImg.alt = imageName; }
function closeImageModal() { document.getElementById('imageModal').classList.remove('active'); }
document.addEventListener('keydown', function(event) { if (event.key === 'Escape') { closeImageModal(); } });
</script>
</body>
</html>`;
}

function formatPhones(phone: string | string[] | undefined): string {
  if (!phone) return '';
  const phones = Array.isArray(phone) ? phone : [phone];
  return phones.join(' • ');
}

function txTime(tx: Transaction): number {
  return tx.date && typeof tx.date.toMillis === 'function' ? tx.date.toMillis() : 0;
}

/** Payment deadline for a session: auction date + 15 days. Null when no valid date. */
function deadlineOf(auctionDate: Entity['auctionDate'] | null | undefined): Timestamp | null {
  if (!auctionDate || typeof auctionDate.toMillis !== 'function') return null;
  const d = new Date(auctionDate.toMillis());
  d.setDate(d.getDate() + 15);
  return Timestamp.fromDate(d);
}

function activeLotsOf(entity: Entity): Lot[] {
  return (entity.lots || []).filter((l) => !l.isArchived);
}

/** Remaining 70% counts only unpaid lots. */
function remaining70Of(lots: Lot[]): number {
  return lots
    .filter((l) => !l.is70Paid)
    .reduce((sum, lot) => sum + (lot.value70 || 0), 0);
}

function header(band: string, exportDate: string): string {
  return `<header class="mb-10 flex justify-between items-start border-b-2 border-slate-200 pb-8">
<div><div class="flex items-center gap-3 mb-2">
<div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">${BRAND_SVG}</div>
<h1 class="text-2xl font-bold text-slate-900">العبارة للتجارة والتوريدات</h1>
</div><p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p></div>
<div class="text-left"><span class="inline-block bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-2">${band}</span>
<p class="text-slate-400 text-xs font-medium">${exportDate}</p></div></header>`;
}

function footer(): string {
  return `<footer class="mt-16 pt-8 border-t-2 border-slate-200 text-center text-slate-400 text-xs">
<p class="font-medium">العبارة للتجارة والتوريدات © ${new Date().getFullYear()}</p>
<p class="mt-1">تم إنشاء هذا المستند تلقائياً بواسطة نظام إدارة المزادات</p></footer>`;
}

function lotRow(lot: Lot): string {
  const paid = lot.is70Paid
    ? `<span class="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700">تم السداد</span>${
        lot.paymentDetails?.payerName
          ? `<div class="text-xs text-slate-500 mt-1">بواسطة: ${lot.paymentDetails.payerName}</div>`
          : ''
      }`
    : `<span class="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700">لم يتم السداد</span>`;
  return `<tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
<td class="p-4 text-slate-800 font-bold text-base">${lot.lotNumber}</td>
<td class="p-4 text-slate-700 font-medium">${lot.name}</td>
<td class="p-4 text-slate-600 font-semibold text-base">${lot.quantity || '-'}</td>
<td class="p-4 font-black text-blue-700 text-lg" dir="ltr">${formatCurrency(lot.totalValue)}</td>
<td class="p-4 font-black text-purple-700 text-lg" dir="ltr">${formatCurrency(lot.value30)}</td>
<td class="p-4 font-black text-orange-700 text-lg" dir="ltr">${formatCurrency(lot.value70)}</td>
<td class="p-4 text-center">${paid}</td></tr>`;
}

function lotsTable(lots: Lot[]): string {
  return `<div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-3 text-xs font-bold uppercase">رقم اللوط</th>
<th class="p-3 text-xs font-bold uppercase">المسمى</th>
<th class="p-3 text-xs font-bold uppercase">الكمية</th>
<th class="p-3 text-xs font-bold uppercase">الإجمالي</th>
<th class="p-3 text-xs font-bold uppercase">30%</th>
<th class="p-3 text-xs font-bold uppercase">70%</th>
<th class="p-3 text-xs font-bold uppercase text-center">حالة السداد</th></tr></thead>
<tbody>${sortLotsByNumber(lots).map(lotRow).join('')}</tbody></table></div>`;
}

function contractImages(lots: Lot[]): string {
  const withImages = lots.filter((lot) => lot.contractImage && lot.contractImage.url);
  if (withImages.length === 0) return '';
  return `<div class="mt-6"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-blue-600 rounded-full"></div>
<h4 class="text-lg font-bold text-slate-800">صور العقود المرفقة</h4></div>
<div class="grid grid-cols-3 gap-4">${withImages
    .map(
      (lot) => `<div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm break-inside-avoid">
<div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
<img src="${getDirectImageUrl(lot.contractImage!.url)}" alt="عقد ${lot.name}" class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity" onerror="this.style.display='none'" referrerpolicy="no-referrer" onclick="openImageModal(this.src, 'عقد ${lot.name}')" />
</div><p class="text-center text-xs text-slate-500 mt-2 font-semibold">لوط ${lot.lotNumber} - ${lot.name}</p></div>`,
    )
    .join('')}</div></div>`;
}

function deadlineLine(entity: Entity, activeLots: Lot[]): string {
  const deadline = deadlineOf(entity.auctionDate);
  if (!deadline) return '';
  const allPaid = activeLots.length > 0 && activeLots.every((l) => l.is70Paid);
  return allPaid
    ? `<p class="text-base font-bold text-green-300 mt-1">آخر ميعاد للدفع: تم السداد ✓</p>`
    : `<p class="text-base font-bold text-amber-300 mt-1">آخر ميعاد للدفع: ${formatDate(deadline)}</p>`;
}

function entityBlock(entity: Entity): string {
  const active = activeLotsOf(entity);
  if (active.length === 0) return '';
  const total = active.reduce((s, l) => s + (l.totalValue || 0), 0);
  const v30 = active.reduce((s, l) => s + (l.value30 || 0), 0);
  const v70 = active.reduce((s, l) => s + (l.value70 || 0), 0);
  const remaining = remaining70Of(active);
  return `<div class="mb-8 break-inside-avoid">
<div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-xl p-4 text-white">
<div class="flex justify-between items-start"><div class="flex-1">
<h3 class="text-2xl font-black mb-2">${entity.name}</h3>
${entity.buyerName ? `<p class="text-base text-white/90 mb-2">المشتري: ${entity.buyerName}</p>` : ''}
<div class="flex flex-col gap-1">
<p class="text-sm text-white/80">ميعاد الجلسة: ${formatSpecificDateTime(entity.auctionDate)}</p>
${deadlineLine(entity, active)}</div></div>
<div class="text-center bg-white/10 rounded-lg px-6 py-4">
<div class="text-xs text-white/70 uppercase mb-1">عدد اللوطات</div>
<div class="text-4xl font-black">${active.length}</div></div></div></div>
<div class="bg-gradient-to-br from-slate-50 to-blue-50 grid grid-cols-2 gap-6 p-6 border-x border-slate-200">
<div class="bg-white rounded-lg p-4 shadow-sm border-r-4 border-blue-500"><p class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي القيمة</p><p class="font-black text-blue-700 text-2xl" dir="ltr">${formatCurrency(total)}</p></div>
<div class="bg-white rounded-lg p-4 shadow-sm border-r-4 border-purple-500"><p class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 30%</p><p class="font-black text-purple-700 text-2xl" dir="ltr">${formatCurrency(v30)}</p></div>
<div class="bg-white rounded-lg p-4 shadow-sm border-r-4 border-orange-500"><p class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 70%</p><p class="font-black text-orange-700 text-2xl" dir="ltr">${formatCurrency(v70)}</p></div>
<div class="bg-white rounded-lg p-4 shadow-sm border-r-4 ${remaining > 0 ? 'border-red-500' : 'border-green-500'}"><p class="text-xs text-slate-500 font-bold uppercase mb-2">المتبقي</p><p class="font-black ${remaining > 0 ? 'text-red-700' : 'text-green-700'} text-2xl" dir="ltr">${formatCurrency(remaining)}</p></div>
</div>
<div class="border border-slate-200 rounded-b-xl overflow-hidden"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-3 text-xs font-bold uppercase">رقم اللوط</th>
<th class="p-3 text-xs font-bold uppercase">المسمى</th>
<th class="p-3 text-xs font-bold uppercase">الكمية</th>
<th class="p-3 text-xs font-bold uppercase">الإجمالي</th>
<th class="p-3 text-xs font-bold uppercase">30%</th>
<th class="p-3 text-xs font-bold uppercase">70%</th>
<th class="p-3 text-xs font-bold uppercase text-center">حالة السداد</th></tr></thead>
<tbody>${sortLotsByNumber(active).map(lotRow).join('')}</tbody></table></div>
${contractImages(active)}</div>`;
}

export function transactionHtml(
  client: Client,
  tx: Transaction,
  exportDate: string,
): string {
  const items = tx.items || [];
  const itemsHtml =
    items.length > 0
      ? `<section class="mb-10 flex-grow"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-blue-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">تفاصيل الأصناف</h3></div>
<div class="rounded-xl border border-slate-200 overflow-hidden"><table class="w-full text-right">
<thead><tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
<th class="p-4 text-xs font-bold uppercase tracking-wider">الصنف</th>
<th class="p-4 text-xs font-bold uppercase tracking-wider">الكمية (كجم)</th>
<th class="p-4 text-xs font-bold uppercase tracking-wider">سعر الكيلو</th>
<th class="p-4 text-xs font-bold uppercase tracking-wider text-center">الإجمالي</th></tr></thead>
<tbody class="divide-y divide-slate-100">${items
        .map(
          (item) => `<tr class="hover:bg-slate-50/50 transition-colors">
<td class="p-4 text-slate-700 font-medium">${item.name}</td>
<td class="p-4 text-slate-600 font-mono text-sm">${item.quantity}</td>
<td class="p-4 text-slate-600 font-mono text-sm">${formatCurrency(item.pricePerKilo)}</td>
<td class="p-4 text-slate-900 font-bold text-center font-mono text-sm bg-slate-50/30">${formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}</td></tr>`,
        )
        .join('')}</tbody></table></div></section>`
      : '';

  const notesHtml = tx.notes
    ? `<section class="mb-10 bg-amber-50 p-5 rounded-xl border border-amber-100 flex gap-4 items-start">
<span class="text-2xl">📝</span><div>
<h3 class="text-sm font-bold text-amber-800 mb-1">ملاحظات</h3>
<p class="text-amber-900 text-sm leading-relaxed">${tx.notes}</p></div></section>`
    : '';

  const itemImages = items.filter((i) => i.image && i.image.url);
  const imagesHtml =
    itemImages.length > 0
      ? `<section class="mb-10 break-inside-avoid"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-blue-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">الصور المرفقة</h3></div>
<div class="grid grid-cols-3 gap-4">${itemImages
        .map(
          (item) => `<div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm break-inside-avoid">
<div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
<img src="${getDirectImageUrl(item.image!.url)}" alt="${item.name}" class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity" onerror="this.style.display='none'" referrerpolicy="no-referrer" onclick="openImageModal(this.src, '${item.name}')" />
</div><p class="text-center text-xs text-slate-500 mt-2 font-semibold">${item.name}</p></div>`,
        )
        .join('')}</div></section>`
      : '';

  const txImageHtml =
    tx.image && tx.image.url
      ? `<section class="mb-10 break-inside-avoid"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-purple-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">صورة الحركة</h3></div>
<div class="border border-slate-200 rounded-xl p-3 bg-white shadow-sm max-w-md mx-auto">
<img src="${getDirectImageUrl(tx.image.url)}" alt="صورة الحركة" class="w-full h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity" onerror="this.style.display='none'" referrerpolicy="no-referrer" />
<p class="text-center text-xs text-blue-600 mt-2 font-medium">↗ انقر للعرض بحجم كامل</p></div></section>`
      : '';

  const body = `<div class="bg-white font-sans min-h-screen flex flex-col" dir="rtl" style="max-width: 210mm; margin: 0 auto; padding: 40px;">
${header('كشف حساب حركة', exportDate)}
<div class="grid grid-cols-2 gap-8 mb-10">
<div class="bg-slate-50 p-6 rounded-2xl border border-slate-100">
<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">العميل</h3>
<p class="text-2xl font-bold text-slate-800">${client.name}</p>
${client.phone ? `<p class="text-sm text-slate-500 mt-2">📞 ${formatPhones(client.phone)}</p>` : ''}</div>
<div class="bg-blue-50 p-6 rounded-2xl border border-blue-100">
<h3 class="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">تفاصيل الحركة</h3>
<div class="flex flex-col gap-1">
<div class="flex justify-between items-center"><span class="text-blue-700 text-sm">التاريخ</span><span class="text-blue-900 font-bold">${formatDate(tx.date)}</span></div>
<div class="flex justify-between items-center mt-2 pt-2 border-t border-blue-200"><span class="text-blue-700 text-sm">القيمة الإجمالية</span><span class="text-2xl font-black text-blue-900" dir="ltr">${formatCurrency(tx.amount)}</span></div>
</div></div></div>
${itemsHtml}${notesHtml}${imagesHtml}${txImageHtml}
<footer class="mt-auto pt-8 border-t border-slate-100 flex flex-col items-center gap-2">
<div class="flex items-center gap-2 text-slate-400"><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span></div>
<p class="text-slate-400 text-xs font-medium">تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p></footer></div>`;
  return shell('كشف حساب حركة', body);
}

export function clientSummaryHtml(client: Client, exportDate: string): string {
  const txs = client.transactions || [];
  const total = txs.reduce((acc, t) => acc + (t.amount || 0), 0);
  const sorted = [...txs].sort((a, b) => txTime(a) - txTime(b));

  const rows = sorted
    .map(
      (t) => `<tr class="hover:bg-slate-50/50 transition-colors">
<td class="p-4 text-slate-700 font-medium whitespace-nowrap">${formatDate(t.date)}</td>
<td class="p-4 text-slate-600"><span class="inline-block px-2 py-1 rounded text-xs font-medium ${t.amount > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'} mb-1">${t.amount > 0 ? 'مشتريات' : 'سداد'}</span>
<div class="text-sm">${t.notes || (t.amount > 0 ? 'حركة مشتريات' : 'دفعة سداد')}</div></td>
<td class="p-4 text-center font-bold text-slate-800 font-mono text-sm">${t.amount > 0 ? formatCurrency(t.amount) : '<span class="text-slate-300">-</span>'}</td>
<td class="p-4 text-center font-bold text-green-600 font-mono text-sm">${t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '<span class="text-slate-300">-</span>'}</td></tr>`,
    )
    .join('');

  const allImages: { url: string; label: string; sublabel: string }[] = [];
  for (const t of sorted) {
    if (t.image && t.image.url) {
      allImages.push({
        url: t.image.url,
        label: `حركة - ${formatDate(t.date)}`,
        sublabel: formatCurrency(Math.abs(t.amount)),
      });
    }
    for (const item of t.items || []) {
      if (item.image && item.image.url) {
        allImages.push({
          url: item.image.url,
          label: `صنف - ${item.name}`,
          sublabel: formatDate(t.date),
        });
      }
    }
  }
  const imagesHtml =
    allImages.length > 0
      ? `<section class="mb-8 break-inside-avoid"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-blue-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">جميع الصور المرفقة (${allImages.length})</h3></div>
<div class="grid grid-cols-3 gap-4">${allImages
        .map(
          (img) => `<div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm">
<div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
<img src="${getDirectImageUrl(img.url)}" alt="${img.label}" class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity" onerror="this.style.display='none'" referrerpolicy="no-referrer" onclick="openImageModal(this.src, '${img.label}')" />
</div><p class="text-center text-xs text-slate-700 mt-2 font-semibold">${img.label}</p>
<p class="text-center text-xs text-slate-500 mt-0.5">${img.sublabel}</p></div>`,
        )
        .join('')}</div></section>`
      : '';

  const body = `<div class="bg-white font-sans min-h-screen flex flex-col" dir="rtl" style="max-width: 210mm; margin: 0 auto; padding: 40px;">
${header('ملخص حساب عميل', exportDate)}
<section class="mb-10 bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border border-slate-100 shadow-sm">
<div class="flex items-center gap-4"><div class="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-3xl">👤</div>
<div><h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">بيانات العميل</h2>
<p class="text-3xl font-black text-slate-800">${client.name}</p>
${client.phone ? `<p class="text-sm text-slate-500 mt-2">📞 ${formatPhones(client.phone)}</p>` : ''}</div></div></section>
<section class="mb-10 flex-grow"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-blue-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">كشف الحركات</h3></div>
<div class="rounded-xl border border-slate-200 overflow-hidden"><table class="w-full text-right">
<thead><tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
<th class="p-4 text-xs font-bold uppercase tracking-wider">التاريخ</th>
<th class="p-4 text-xs font-bold uppercase tracking-wider">البيان</th>
<th class="p-4 text-xs font-bold uppercase tracking-wider text-center">مدين</th>
<th class="p-4 text-xs font-bold uppercase tracking-wider text-center">دائن</th></tr></thead>
<tbody class="divide-y divide-slate-100">${rows}</tbody></table></div></section>
${imagesHtml}
<footer class="mt-auto pt-8 border-t border-slate-100">
<div class="flex justify-end"><div class="p-8 rounded-2xl shadow-lg ${total >= 0 ? 'bg-gradient-to-br from-red-50 to-white border border-red-100' : 'bg-gradient-to-br from-green-50 to-white border border-green-100'} w-full max-w-md">
<div class="flex justify-between items-center mb-4">
<span class="text-sm font-bold uppercase tracking-wider ${total >= 0 ? 'text-red-600' : 'text-green-600'}">الرصيد النهائي ${total >= 0 ? '(مدين)' : '(دائن)'}</span>
<span class="text-2xl">${total >= 0 ? '📉' : '✅'}</span></div>
<div class="flex items-baseline justify-between border-t border-black/5 pt-4">
<span class="text-slate-500 text-sm">الإجمالي المستحق</span>
<div class="text-4xl font-black tracking-tight ${total >= 0 ? 'text-red-800' : 'text-green-800'}" dir="ltr">${formatCurrency(Math.abs(total))}</div></div></div></div>
<div class="flex flex-col items-center gap-2 mt-12">
<div class="flex items-center gap-2 text-slate-400"><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span><span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span></div>
<p class="text-slate-400 text-xs font-medium">تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p></div></footer></div>`;
  return shell('ملخص حساب عميل', body);
}

export function entitiesSummaryHtml(entities: Entity[], exportDate: string): string {
  const allLots = entities.flatMap((e) => activeLotsOf(e));
  const totalInvoices = allLots.reduce((s, l) => s + (l.totalValue || 0), 0);
  const total30 = allLots.reduce((s, l) => s + (l.value30 || 0), 0);
  const total70 = allLots.reduce((s, l) => s + (l.value70 || 0), 0);
  const remainingToSupply = remaining70Of(allLots);

  const shippers = new Map<string, { lotsCount: number; initialBalance: number }>();
  for (const lot of allLots) {
    const name = lot.loadingDetails?.loaderName;
    if (!name) continue;
    const prev = shippers.get(name) || { lotsCount: 0, initialBalance: 0 };
    shippers.set(name, {
      lotsCount: prev.lotsCount + 1,
      initialBalance: prev.initialBalance + (lot.value30 || 0),
    });
  }
  const shippersArray = [...shippers.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const shippersHtml =
    shippersArray.length > 0
      ? `<section class="mb-10"><div class="flex items-center gap-2 mb-6">
<div class="w-1 h-8 bg-green-600 rounded-full"></div>
<h2 class="text-2xl font-bold text-slate-800">صف الشاحنين</h2></div>
<div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-3 text-xs font-bold uppercase">#</th>
<th class="p-3 text-xs font-bold uppercase">اسم الشاحن</th>
<th class="p-3 text-xs font-bold uppercase">الرصيد المبدئي</th>
<th class="p-3 text-xs font-bold uppercase text-center">عدد الحركات</th></tr></thead>
<tbody>${shippersArray
        .map(
          (shipper, i) => `<tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
<td class="p-4 text-slate-800 font-bold text-base">${i + 1}</td>
<td class="p-4 text-slate-700 font-medium text-lg">${shipper.name}</td>
<td class="p-4 font-black text-purple-700 text-lg" dir="ltr">${formatCurrency(shipper.initialBalance)}</td>
<td class="p-4 text-center font-bold text-blue-700 text-lg">${shipper.lotsCount}</td></tr>`,
        )
        .join('')}</tbody></table></div></section>`
      : '';

  const body = `<div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
${header('ملخص حساب الجهات', exportDate)}
<section class="mb-10"><div class="grid grid-cols-2 gap-6">
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-blue-500"><div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي الفواتير</div><div class="text-3xl font-black text-blue-700" dir="ltr">${formatCurrency(totalInvoices)}</div></div>
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-purple-500"><div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي 30%</div><div class="text-3xl font-black text-purple-700" dir="ltr">${formatCurrency(total30)}</div></div>
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-orange-500"><div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي 70%</div><div class="text-3xl font-black text-orange-700" dir="ltr">${formatCurrency(total70)}</div></div>
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 ${remainingToSupply > 0 ? 'border-red-500' : 'border-green-500'}"><div class="text-xs text-slate-500 font-bold uppercase mb-2">المتبقي للسداد</div><div class="text-3xl font-black ${remainingToSupply > 0 ? 'text-red-700' : 'text-green-700'}" dir="ltr">${formatCurrency(remainingToSupply)}</div></div>
</div></section>
${shippersHtml}
<section><div class="flex items-center gap-2 mb-6">
<div class="w-1 h-8 bg-blue-600 rounded-full"></div>
<h2 class="text-2xl font-bold text-slate-800">تفاصيل الجهات واللوطات</h2></div>
${entities.map(entityBlock).filter(Boolean).join('')}</section>
${footer()}</div>`;
  return shell('ملخص حساب الجهات', body);
}

export function singleEntityHtml(entity: Entity, exportDate: string): string {
  const active = activeLotsOf(entity);
  const total = active.reduce((s, l) => s + (l.totalValue || 0), 0);
  const v30 = active.reduce((s, l) => s + (l.value30 || 0), 0);
  const v70 = active.reduce((s, l) => s + (l.value70 || 0), 0);
  const remaining = remaining70Of(active);

  const body = `<div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
${header('تقرير جهة', exportDate)}
<section class="mb-8"><div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-xl">
<div class="flex justify-between items-start"><div class="flex-1">
<h2 class="text-3xl font-black mb-2">${entity.name}</h2>
${entity.buyerName ? `<p class="text-lg text-white/90 mb-2">المشتري: ${entity.buyerName}</p>` : ''}
<div class="flex flex-col gap-1">
<p class="text-sm text-white/80">ميعاد الجلسة: ${formatSpecificDateTime(entity.auctionDate)}</p>
${deadlineLine(entity, active)}</div></div>
<div class="text-center bg-white/10 rounded-lg px-6 py-4">
<div class="text-sm text-white/70 uppercase mb-1">عدد اللوطات</div>
<div class="text-5xl font-black">${active.length}</div></div></div></div></section>
<section class="mb-8"><div class="grid grid-cols-2 gap-6">
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-blue-500"><div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي القيمة</div><div class="text-3xl font-black text-blue-700" dir="ltr">${formatCurrency(total)}</div></div>
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-purple-500"><div class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 30%</div><div class="text-3xl font-black text-purple-700" dir="ltr">${formatCurrency(v30)}</div></div>
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-orange-500"><div class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 70%</div><div class="text-3xl font-black text-orange-700" dir="ltr">${formatCurrency(v70)}</div></div>
<div class="bg-white rounded-lg p-6 shadow-lg border-r-4 ${remaining > 0 ? 'border-red-500' : 'border-green-500'}"><div class="text-xs text-slate-500 font-bold uppercase mb-2">المتبقي</div><div class="text-3xl font-black ${remaining > 0 ? 'text-red-700' : 'text-green-700'}" dir="ltr">${formatCurrency(remaining)}</div></div>
</div></section>
<section><div class="flex items-center gap-2 mb-6">
<div class="w-1 h-8 bg-blue-600 rounded-full"></div>
<h2 class="text-2xl font-bold text-slate-800">تفاصيل اللوطات</h2></div>
${lotsTable(active)}
${contractImages(active)}</section>
${footer()}</div>`;
  return shell('تقرير جهة', body);
}

export function sessionHtml(
  auctionKey: string,
  entities: Entity[],
  exportDate: string,
): string {
  const withActive = entities
    .map((e) => ({ entity: e, active: activeLotsOf(e) }))
    .filter((x) => x.active.length > 0);

  const totalValue = withActive.reduce(
    (s, x) => s + x.active.reduce((a, l) => a + (l.totalValue || 0), 0),
    0,
  );
  const total30 = withActive.reduce(
    (s, x) => s + x.active.reduce((a, l) => a + (l.value30 || 0), 0),
    0,
  );
  const remaining70 = withActive.reduce((s, x) => s + remaining70Of(x.active), 0);

  let closestDeadline: Timestamp | null = null;
  for (const { entity } of withActive) {
    const d = deadlineOf(entity.auctionDate);
    if (d && (!closestDeadline || d.toMillis() < closestDeadline.toMillis())) {
      closestDeadline = d;
    }
  }

  const body = `<div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
${header('تقرير جلسة مزادات', exportDate)}
<section class="mb-6 bg-slate-900 text-white p-5 rounded-2xl shadow-md">
<h2 class="text-lg font-black flex items-center gap-2">جلسة: <span dir="ltr">${auctionKey}</span></h2>
<p class="text-xs mt-1 opacity-70">عدد الجهات المشتركة: ${withActive.length} جهة</p></section>
<section class="mb-8"><div class="flex items-center gap-2 mb-3">
<div class="w-1.5 h-6 bg-slate-900 rounded-full"></div>
<h3 class="text-sm font-bold text-slate-800">إحصائيات الجلسة الإجمالية</h3></div>
<div class="grid grid-cols-4 gap-4">
<div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><p class="text-[10px] text-slate-500 font-bold mb-1">إجمالي قيمة الترسيات</p><p class="text-base font-black text-slate-800 font-mono" dir="ltr">${formatCurrency(totalValue)}</p></div>
<div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><p class="text-[10px] text-slate-500 font-bold mb-1">إجمالي الدفعة الأولى (30%)</p><p class="text-base font-black text-indigo-700 font-mono" dir="ltr">${formatCurrency(total30)}</p></div>
<div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><p class="text-[10px] text-slate-500 font-bold mb-1">إجمالي المتبقي (70%)</p><p class="text-base font-black text-amber-700 font-mono" dir="ltr">${formatCurrency(remaining70)}</p></div>
<div class="bg-slate-50 p-4 rounded-xl border border-slate-200"><p class="text-[10px] text-slate-500 font-bold mb-1">أقرب ميعاد دفع (مهلة الـ 70%)</p><p class="text-xs font-black text-rose-700 font-mono">${closestDeadline ? formatDate(closestDeadline) : 'لا يوجد'}</p></div>
</div></section>
<section class="space-y-8"><div class="flex items-center gap-2 mb-4">
<div class="w-1.5 h-6 bg-slate-900 rounded-full"></div>
<h3 class="text-sm font-bold text-slate-800 font-black">تفاصيل الجهات واللوطات المترسية</h3></div>
${withActive
  .map(({ entity, active }) => {
    const total = active.reduce((s, l) => s + (l.totalValue || 0), 0);
    const v30 = active.reduce((s, l) => s + (l.value30 || 0), 0);
    const v70 = active.reduce((s, l) => s + (l.value70 || 0), 0);
    return `<div class="border border-slate-200 rounded-2xl p-5 break-inside-avoid shadow-sm bg-white">
<div class="bg-slate-100 p-4 rounded-xl mb-4">
<h4 class="text-md font-black text-slate-800">${entity.name}</h4>
${entity.buyerName ? `<p class="text-xs text-slate-500 mt-1 font-bold">المشتري: ${entity.buyerName}</p>` : ''}</div>
<table class="w-full text-right text-xs mb-4"><thead>
<tr class="bg-slate-50 text-slate-500 border-b border-slate-200">
<th class="p-2.5 font-bold">رقم اللوط</th>
<th class="p-2.5 font-bold">اسم وصنف اللوط</th>
<th class="p-2.5 font-bold">الكمية المقدرة</th>
<th class="p-2.5 font-bold">القيمة الكلية</th>
<th class="p-2.5 font-bold">دفعة التعاقد (30%)</th>
<th class="p-2.5 font-bold">متبقي التوريد (70%)</th>
<th class="p-2.5 font-bold text-center">حالة السداد</th></tr></thead>
<tbody class="divide-y divide-slate-100">${sortLotsByNumber(active)
      .map(
        (lot) => `<tr class="hover:bg-slate-50/20">
<td class="p-2.5 text-slate-800 font-bold">${lot.lotNumber}</td>
<td class="p-2.5 font-medium">${lot.name}</td>
<td class="p-2.5 font-mono" dir="ltr">${lot.quantity || '-'}</td>
<td class="p-2.5 text-slate-900 font-black font-mono" dir="ltr">${formatCurrency(lot.totalValue)}</td>
<td class="p-2.5 text-indigo-700 font-black font-mono" dir="ltr">${formatCurrency(lot.value30)}</td>
<td class="p-2.5 text-amber-700 font-black font-mono" dir="ltr">${formatCurrency(lot.value70)}</td>
<td class="p-2.5 text-center">${lot.is70Paid ? `<span class="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">مسدد</span>${lot.paymentDetails?.payerName ? `<div class="text-[9px] text-slate-400 mt-0.5">بواسطة: ${lot.paymentDetails.payerName}</div>` : ''}` : `<span class="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">غير مسدد</span>`}</td></tr>`,
      )
      .join('')}</tbody></table>
<div class="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-150">
<div class="text-right"><span class="text-slate-500 font-bold">إجمالي الجهة:</span><span class="font-black font-mono block mt-1" dir="ltr">${formatCurrency(total)}</span></div>
<div class="text-right"><span class="text-slate-500 font-bold">دفعة 30%:</span><span class="font-black text-indigo-800 font-mono block mt-1" dir="ltr">${formatCurrency(v30)}</span></div>
<div class="text-right"><span class="text-slate-500 font-bold">متبقي 70%:</span><span class="font-black text-amber-800 font-mono block mt-1" dir="ltr">${formatCurrency(v70)}</span></div>
</div></div>`;
  })
  .join('')}</section>
${footer()}</div>`;
  return shell('تقرير جلسة مزادات', body);
}

export function allClientsHtml(clients: Client[], exportDate: string): string {
  const balances = clients.map((c) => ({
    client: c,
    balance: (c.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0),
    last: [...(c.transactions || [])].sort((a, b) => txTime(b) - txTime(a))[0],
  }));
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  const body = `<div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
${header('ملخص الحسابات', exportDate)}
<section class="mb-8"><div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-xl">
<div class="flex justify-between items-center"><div>
<h2 class="text-3xl font-black mb-2">ملخص الحسابات</h2>
<p class="text-lg text-white/90">عدد العملاء: ${clients.length}</p></div>
<div class="text-center bg-white/10 rounded-lg px-6 py-4">
<div class="text-sm text-white/70 uppercase mb-1">إجمالي الرصيد</div>
<div class="text-3xl font-black" dir="ltr">${formatCurrency(Math.abs(totalBalance))}</div>
<div class="text-sm font-bold mt-1 ${totalBalance >= 0 ? 'text-red-200' : 'text-green-200'}">${totalBalance >= 0 ? '(مدين)' : '(دائن)'}</div></div></div></div></section>
<section><div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-4 text-xs font-bold uppercase">اسم العميل</th>
<th class="p-4 text-xs font-bold uppercase">آخر حركة</th>
<th class="p-4 text-xs font-bold uppercase text-center">الرصيد الحالي</th></tr></thead>
<tbody>${balances
    .map(
      ({ client, balance, last }) => `<tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
<td class="p-4"><div class="text-slate-800 font-bold">${client.name}</div>
${client.phone ? `<div class="text-xs text-slate-500 mt-1">📞 ${formatPhones(client.phone)}</div>` : ''}</td>
<td class="p-4 text-slate-600 text-sm">${last ? formatDate(last.date) : '-'}</td>
<td class="p-4 text-center font-bold font-mono text-sm ${balance >= 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(Math.abs(balance))} ${balance >= 0 ? '(مدين)' : '(دائن)'}</td></tr>`,
    )
    .join('')}</tbody></table></div></section>
${footer()}</div>`;
  return shell('ملخص الحسابات', body);
}

export function partnershipHtml(partnership: Partnership, exportDate: string): string {
  const items = partnership.items ?? [];
  const txs = [...(partnership.txs ?? [])].sort((a, b) => {
    const ta = a.date && typeof a.date.toMillis === 'function' ? a.date.toMillis() : 0;
    const tb = b.date && typeof b.date.toMillis === 'function' ? b.date.toMillis() : 0;
    return ta - tb;
  });
  const partyIds = ['me', ...partnership.partners.map((partner) => partner.id)];
  const s = partnershipSettlement(items, partnership.txs ?? [], partnership.shares, partyIds, partnership.supplierPayments ?? []);
  const partyName = (id: string): string =>
    id === 'me' ? 'أنا' : (partnership.partners.find((partner) => partner.id === id)?.name ?? 'طرف');
  const myDue = s.dues['me'] ?? 0;
  const dueLines = partyIds
    .map((id) => {
      const due = s.dues[id] ?? 0;
      if (Math.abs(due) < 0.01) return null;
      return due > 0 ? `مستحق لـ ${partyName(id)}: ${formatCurrency(due)}` : `مستحق على ${partyName(id)}: ${formatCurrency(Math.abs(due))}`;
    })
    .filter((line): line is string => line !== null);
  const dueLine =
    dueLines.length === 0
      ? 'الحساب متعادل — لا مستحقات'
      : myDue > 0
        ? `الشركاء مدينون لي بمبلغ ${formatCurrency(myDue)}`
        : `أنا مدين للشركاء بمبلغ ${formatCurrency(Math.abs(myDue))}`;

  const kindLabel = (kind: string): string =>
    kind === 'expense' ? 'مصروف' : kind === 'sale' ? 'بيع' : kind === 'refund' ? 'مرتجع' : 'سداد';
  const payerLabel = (payer: string): string => partyName(payer);
  const modeLabel = (mode: string | undefined): string => (mode === 'weight' ? 'وزن' : 'لوط');

  const supplierCost = items.reduce((sum, item) => sum + itemBuyCost(item), 0);
  const supplierPaidTotal = supplierTotals(partnership.supplierPayments ?? []).paid;
  const supplierRemaining = supplierBalance(supplierCost, supplierPaidTotal);
  const supplierPayments = [...(partnership.supplierPayments ?? [])].sort((a, b) => {
    const ta = a.date && typeof a.date.toMillis === 'function' ? a.date.toMillis() : 0;
    const tb = b.date && typeof b.date.toMillis === 'function' ? b.date.toMillis() : 0;
    return ta - tb;
  });

  const itemsRows = items
    .map((item) => {
      const deliveries = item.deliveries ?? [];
      const breakdown =
        deliveries.length > 0
          ? `<div class="mt-2 space-y-1">${deliveries
              .map(
                (d) =>
                  `<div class="text-[11px] text-slate-500">📦 ${formatDate(d.date)} • <span dir="ltr">${d.quantity ?? 0} × ${formatCurrency(d.unitPrice ?? 0)}</span> = <span dir="ltr" class="font-bold">${formatCurrency(d.total ?? (d.quantity ?? 0) * (d.unitPrice ?? 0))}</span></div>`,
              )
              .join('')}</div>`
          : '';
      return `<tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
<td class="p-4 text-slate-800 font-bold">${item.name}${item.notes ? `<div class="text-xs text-slate-500 mt-1">${item.notes}</div>` : ''}${breakdown}</td>
<td class="p-4 text-center text-sm font-bold">${modeLabel(item.mode)}</td>
<td class="p-4 text-slate-600 font-mono" dir="ltr">${itemQuantity(item)}</td>
<td class="p-4 font-bold font-mono" dir="ltr">${formatCurrency(itemBuyCost(item))}</td>
<td class="p-4 text-center text-sm font-bold">${deliveries.length} توريدات</td></tr>`;
    })
    .join('');

  const txRows = txs
    .map(
      (tx) => `<tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
<td class="p-4 text-slate-600 whitespace-nowrap">${formatDate(tx.date)}</td>
<td class="p-4 text-slate-700 font-bold text-sm">${kindLabel(tx.kind)}</td>
<td class="p-4 text-slate-600 text-sm">${payerLabel(tx.paidBy)}${tx.deliveredBy ? ` (سلّمها ${payerLabel(tx.deliveredBy)})` : ''}${tx.kind === 'reimbursement' && tx.reimburseTo ? ` → ${payerLabel(tx.reimburseTo)}` : ''}</td>
<td class="p-4 text-slate-600 text-sm">${tx.notes || '-'}</td>
<td class="p-4 font-black font-mono" dir="ltr">${formatCurrency(tx.amount)}</td></tr>`,
    )
    .join('');

  const supplierPayRows = supplierPayments
    .map(
      (pay) => `<tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
<td class="p-4 text-slate-600 whitespace-nowrap">${formatDate(pay.date)}</td>
<td class="p-4 text-slate-600 text-sm">${payerLabel(pay.paidBy)}${pay.deliveredBy ? ` (سلّمها ${payerLabel(pay.deliveredBy)})` : ''}</td>
<td class="p-4 text-slate-600 text-sm">${pay.notes || '-'}</td>
<td class="p-4 font-black font-mono" dir="ltr">${formatCurrency(pay.amount)}</td></tr>`,
    )
    .join('');

  const body = `<div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 210mm; margin: 0 auto; padding: 40px;">
${header('كشف حساب شراكة', exportDate)}
<section class="mb-8 bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border border-slate-100 shadow-sm">
<h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">الشراكة</h2>
<p class="text-3xl font-black text-slate-800">${partnership.name}</p>
<p class="text-sm text-slate-500 mt-2 font-bold">الشركاء: ${partnership.partners.map((partner) => `${partner.name} (${partnership.shares[partner.id] ?? 0}%)`).join('، ') || '—'} • نسبتي ${partnership.shares['me'] ?? 0}% • ${partnership.status === 'active' ? 'نشطة' : 'مسواة'}</p>
</section>
<section class="mb-8"><div class="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl p-6 text-white shadow-xl">
<div class="flex justify-between items-center"><div>
<h2 class="text-2xl font-black mb-2">نتيجة التسوية</h2>
<p class="text-lg text-white/90">${dueLine}</p></div>
<div class="text-center bg-white/10 rounded-lg px-6 py-4">
<div class="text-sm text-white/70 uppercase mb-1">صافي الربح</div>
<div class="text-3xl font-black" dir="ltr">${formatCurrency(s.profit)}</div></div></div>
<div class="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">تكلفة الشراء</div><div class="font-black" dir="ltr">${formatCurrency(s.buyCost)}</div></div>
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">المصاريف</div><div class="font-black" dir="ltr">${formatCurrency(s.expenses)}</div></div>
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">المبيعات</div><div class="font-black" dir="ltr">${formatCurrency(s.sales)}</div></div>
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">المرتجعات</div><div class="font-black" dir="ltr">${formatCurrency(s.refunds)}</div></div>
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">المدفوع للمورد</div><div class="font-black" dir="ltr">${formatCurrency(s.supplierPaid)}</div></div>
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">المتبقي للمورد</div><div class="font-black" dir="ltr">${formatCurrency(s.supplierBalance)}</div></div>
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">نصيبي من الربح</div><div class="font-black" dir="ltr">${formatCurrency(s.myProfit)}</div></div>
${partnership.partners.map((partner) => `<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">نصيب ${partner.name}</div><div class="font-black" dir="ltr">${formatCurrency(s.profits[partner.id] ?? 0)}</div></div>`).join('')}
<div class="bg-white/10 rounded-lg p-3"><div class="text-white/70 mb-1">مساهمتي / مساهمات الشركاء</div><div class="font-black" dir="ltr">${formatCurrency(s.contributedMe)} / ${formatCurrency(partnership.partners.reduce((sum, partner) => sum + (s.contributed[partner.id] ?? 0), 0))}</div></div>
</div></div></section>
<section class="mb-8"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-blue-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">البضاعة المشتركة</h3></div>
<div class="border border-slate-200 rounded-xl overflow-hidden"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-3 text-xs font-bold uppercase">الصنف</th>
<th class="p-3 text-xs font-bold uppercase">النوع</th>
<th class="p-3 text-xs font-bold uppercase">الكمية</th>
<th class="p-3 text-xs font-bold uppercase">تكلفة الشراء</th>
<th class="p-3 text-xs font-bold uppercase text-center">التوريدات</th></tr></thead>
<tbody>${itemsRows || '<tr><td class="p-4 text-center text-slate-400" colspan="5">لا أصناف</td></tr>'}</tbody></table></div></section>
<section class="mb-8"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-amber-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">المورد${partnership.supplierName ? `: ${partnership.supplierName}` : ''}</h3></div>
<div class="grid grid-cols-3 gap-3 mb-4 text-center text-sm">
<div class="bg-slate-50 rounded-lg p-3 border border-slate-200"><div class="text-slate-500 mb-1">إجمالي التكلفة</div><div class="font-black" dir="ltr">${formatCurrency(supplierCost)}</div></div>
<div class="bg-emerald-50 rounded-lg p-3 border border-emerald-100"><div class="text-emerald-600 mb-1">المدفوع</div><div class="font-black" dir="ltr">${formatCurrency(supplierPaidTotal)}</div></div>
<div class="bg-amber-50 rounded-lg p-3 border border-amber-100"><div class="text-amber-600 mb-1">المتبقي</div><div class="font-black" dir="ltr">${formatCurrency(supplierRemaining)}</div></div>
</div>
<div class="border border-slate-200 rounded-xl overflow-hidden"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-3 text-xs font-bold uppercase">التاريخ</th>
<th class="p-3 text-xs font-bold uppercase">الطرف</th>
<th class="p-3 text-xs font-bold uppercase">البيان</th>
<th class="p-3 text-xs font-bold uppercase">المبلغ</th></tr></thead>
<tbody>${supplierPayRows || '<tr><td class="p-4 text-center text-slate-400" colspan="4">لا مدفوعات للمورد</td></tr>'}</tbody></table></div></section>
<section class="mb-8"><div class="flex items-center gap-2 mb-4">
<div class="w-1 h-6 bg-purple-600 rounded-full"></div>
<h3 class="text-lg font-bold text-slate-800">دفتر الحركات</h3></div>
<div class="border border-slate-200 rounded-xl overflow-hidden"><table class="w-full text-right">
<thead><tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
<th class="p-3 text-xs font-bold uppercase">التاريخ</th>
<th class="p-3 text-xs font-bold uppercase">النوع</th>
<th class="p-3 text-xs font-bold uppercase">الطرف</th>
<th class="p-3 text-xs font-bold uppercase">البيان</th>
<th class="p-3 text-xs font-bold uppercase">المبلغ</th></tr></thead>
<tbody>${txRows || '<tr><td class="p-4 text-center text-slate-400" colspan="5">لا حركات</td></tr>'}</tbody></table></div></section>
${footer()}</div>`;
  return shell('كشف حساب شراكة', body);
}

export function archiveReportHtml(
  archivedClients: Client[],
  archivedLots: ArchivedLotEntry[],
  exportDate: string,
): string {
  const lotsHtml =
    archivedLots.length > 0
      ? `<div class="section entities"><h2>تفاصيل الجهات واللوطات المؤرشفة</h2>
<table><thead><tr>
<th>#</th><th>اسم الجهة</th><th>المشتري</th><th>رقم اللوط</th><th>المسمى</th>
<th>الكمية</th><th>الإجمالي</th><th>30%</th><th>70%</th><th>الشاحن</th></tr></thead>
<tbody>${archivedLots
        .map(
          (item, i) => `<tr>
<td>${i + 1}</td><td>${item.entityName}</td><td>${item.entityBuyer || '-'}</td>
<td>${item.lot.lotNumber}</td><td>${item.lot.name}</td><td>${item.lot.quantity || '-'}</td>
<td>${formatCurrency(item.lot.totalValue)}</td><td>${formatCurrency(item.lot.value30)}</td><td>${formatCurrency(item.lot.value70)}</td>
<td>${item.lot.loadingDetails?.loaderName || '-'}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
      : '';

  const clientsHtml = `<div class="section"><h2>العملاء المؤرشفون</h2>
<table><thead><tr><th>#</th><th>اسم العميل</th><th>الرصيد النهائي</th><th>عدد الحركات</th></tr></thead>
<tbody>${archivedClients
    .map((client, i) => {
      const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      return `<tr><td>${i + 1}</td><td>${client.name}</td>
<td>${formatCurrency(Math.abs(total))} ${total >= 0 ? '(مدين)' : '(دائن)'}</td>
<td>${client.transactions?.length || 0}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;

  const body = `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير شامل للأرشيف</title>
<style>
body { font-family: 'Arial', sans-serif; direction: rtl; padding: 20px; }
.header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
.stats { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
.section { margin-bottom: 30px; page-break-inside: avoid; }
.section h2 { background: #333; color: white; padding: 10px; border-radius: 4px; }
.section.entities h2 { background: #007bff; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
th { background: #666; color: white; font-size: 12px; }
</style></head><body>
<div class="header"><h1>📊 تقرير شامل للأرشيف</h1><p>تاريخ التصدير: ${exportDate}</p></div>
<div class="stats"><h2>الإحصائيات العامة</h2><ul>
<li>إجمالي العملاء المؤرشفين: ${archivedClients.length}</li>
<li>إجمالي اللوطات المؤرشفة: ${archivedLots.length}</li>
<li><strong>الإجمالي الكلي: ${archivedClients.length + archivedLots.length}</strong></li>
</ul></div>
${lotsHtml}
${clientsHtml}
</body></html>`;
  return body;
}
