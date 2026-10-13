import { describe, expect, it } from 'vitest';
import {
  applyQuantityChange,
  applyValue30Change,
  applyValue70Change,
  buyerBalance,
  calcCommission,
  EMPTY_LOT_CALC,
  partnershipSettlement,
  saleStatus,
  splitLotTotal,
} from '../finance';
import { Timestamp } from 'firebase/firestore';

describe('splitLotTotal (قاعدة 30/70 + الدمغة)', () => {
  it('يقرّب الـ 30% ويضيف الدمغة فوقها', () => {
    // total 1000 -> base30 = 300, value30 = 310 (مع دمغة 10), value70 = 700
    expect(splitLotTotal(1000, 10)).toEqual({ base30: 300, value30: 310, value70: 700 });
  });

  it('القيمتان 30 و70 يساويان الإجمالي دائمًا', () => {
    // الدمغة بتتضاف فوق: value30 = base30 + دمغة، value70 = total − base30 → المجموع = total + الدمغة
    const split = splitLotTotal(3555, 10);
    expect(split.value30 + split.value70).toBe(3565);
  });

  it('دمغة صفرية تعطي 30% صافية', () => {
    expect(splitLotTotal(100, 0).value30).toBe(30);
  });
});

describe('applyValue30Change / applyValue70Change (عكساً)', () => {
  it('من 30 يشتق الإجمالي والـ 70', () => {
    const next = applyValue30Change({ ...EMPTY_LOT_CALC }, 310);
    expect(next.totalValue).toBe(1000);
    expect(next.value70).toBe(700);
  });

  it('من 70 يشتق الإجمالي والـ 30', () => {
    const next = applyValue70Change({ ...EMPTY_LOT_CALC }, 700);
    expect(next.totalValue).toBe(1000);
    expect(next.value30).toBe(310);
  });

  it('تعديل الكمية يحدث الإجمالي والتقسيم', () => {
    const next = applyQuantityChange({ ...EMPTY_LOT_CALC, unitPrice: 50 }, 20);
    expect(next.totalValue).toBe(1000);
    expect(next.value30).toBe(310);
    expect(next.value70).toBe(700);
  });
});

describe('calcCommission (عمولة 0.5%)', () => {
  it('0.5% من إجمالي اللوطات النشطة', () => {
    expect(calcCommission(200000)).toBeCloseTo(1000);
    expect(calcCommission(0)).toBe(0);
  });
});

describe('saleStatus', () => {
  const ts = Timestamp.now();
  const sale = (totalAmount: number, payments: number[], isAdvance = false) => ({
    totalAmount,
    isAdvance,
    payments: payments.map((amount, i) => ({ id: `p${i}`, amount, date: ts, by: 'me', notes: '' })),
  });

  it('خالص لما المجموع اتجمع', () => {
    expect(saleStatus(sale(1000, [400, 600]))).toBe('paid');
  });
  it('جزئي لما فيه دفعة وناقص', () => {
    expect(saleStatus(sale(1000, [300]))).toBe('partial');
  });
  it('عربون لما مفيش دفعات وهو عربون', () => {
    expect(saleStatus(sale(1000, [], true))).toBe('advance');
  });
  it('آجل لما مفيش دفعات', () => {
    expect(saleStatus(sale(1000, []))).toBe('unpaid');
  });
});

describe('buyerBalance (رصيد المشتري المسبق)', () => {
  const ts = Timestamp.now();
  it('التوريدات ناقص خصومات المبيعات من الرصيد', () => {
    const buyer = {
      id: 'b1',
      name: 'مشتري',
      topUps: [
        { id: 't1', amount: 5000, date: ts, by: 'me', notes: '' },
        { id: 't2', amount: 2000, date: ts, by: 'me', notes: '' },
      ],
    };
    const sales = [
      {
        buyerId: 'b1',
        buyerName: 'مشتري',
        totalAmount: 4000,
        payments: [
          { amount: 4000, source: 'balance', date: ts },
          { amount: 1000, source: 'cash', date: ts },
        ],
      },
    ];
    // 7000 مورّدة - 4000 خصم من الرصيد = 3000 (الكاش مبيخصمش)
    expect(buyerBalance(buyer, sales as never)).toBe(3000);
  });
});

describe('partnershipSettlement (تسوية الشراكة 50/50)', () => {
  const ts = Timestamp.now();
  const items = [{
    id: 'i1',
    name: 'بضاعة',
    mode: 'lot' as const,
    deliveries: [{ id: 'd1', date: ts, quantity: 10, unitPrice: 100, total: 1000 }],
  }];
  const shares = { me: 50, p1: 50 };
  const partyIds = ['me', 'p1'];
  // معادلة التطبيق: profit = المبيع − تكلفة البضاعة − المصاريف
  // dues[طرف] = (مساهمته + نصيبه من الربح) − اللي حصّله

  it('مفيش مبيعات = خسارة كاملة بتتوزع بالنص', () => {
    const s = partnershipSettlement(
      items,
      [],
      shares,
      partyIds,
      [{ id: 'sp1', amount: 1000, paidBy: 'me', date: ts, notes: '' }],
      [],
      [],
    );
    expect(s.buyCost).toBe(1000);
    expect(s.supplierPaid).toBe(1000);
    expect(s.profit).toBe(-1000);
    // أنا دفعت 1000 للمورد وخسرت نصيبي 500 → مستحق لي +500، والشريك عليه -500
    expect(s.dues['me']).toBe(500);
    expect(s.dues['p1']).toBe(-500);
  });

  it('الربح يتوزع بالنص وأنا اللي دفعت وحصّلت', () => {
    const s = partnershipSettlement(
      items,
      [{ id: 't1', kind: 'sale' as const, amount: 2000, paidBy: 'me', notes: '', date: ts }],
      shares,
      partyIds,
      [{ id: 'sp1', amount: 1000, paidBy: 'me', date: ts, notes: '' }],
      [],
      [],
    );
    // profit = 2000 - 1000 = 1000 → 500 لكل طرف
    expect(s.profit).toBe(1000);
    expect(s.myProfit).toBe(500);
    // أنا: دفعت 1000 + نصيبي 500 − حصّلت 2000 = -500 (مستحق عليّ أدفع للشريك)
    expect(s.dues['me']).toBe(-500);
    // الشريك: نصيبه 500 وما حصّلش حاجة = +500 مستحق له
    expect(s.dues['p1']).toBe(500);
  });
});
