import {
  getArray,
  getNumber,
  getOptionalNumber,
  getOptionalString,
  getString,
  isRecord,
} from './jsonGuard';

/* ---------- Brochure ---------- */

export interface BrochureAILot {
  lotNumber: string;
  name: string;
  quantity: string;
  unit?: string;
  condition?: string;
  notes?: string;
}

export interface BrochureAIEntity {
  entityName: string;
  location?: string;
  lots: BrochureAILot[];
}

export interface BrochureAIResult {
  auctionDate: string;
  title: string;
  entities: BrochureAIEntity[];
}

function validateBrochureLot(value: unknown): BrochureAILot {
  if (!isRecord(value)) throw new Error('invalid lot');
  const lot: BrochureAILot = {
    lotNumber: getString(value, 'lotNumber', '1'),
    name: getString(value, 'name'),
    quantity: getString(value, 'quantity'),
  };
  const unit = getOptionalString(value, 'unit');
  const condition = getOptionalString(value, 'condition');
  const notes = getOptionalString(value, 'notes');
  if (unit) lot.unit = unit;
  if (condition) lot.condition = condition;
  if (notes) lot.notes = notes;
  if (lot.name.trim() === '') throw new Error('invalid lot name');
  return lot;
}

function validateBrochureEntity(value: unknown): BrochureAIEntity {
  if (!isRecord(value)) throw new Error('invalid entity');
  const entityName = getString(value, 'entityName');
  if (entityName.trim() === '') throw new Error('invalid entity name');
  const entity: BrochureAIEntity = {
    entityName,
    lots: getArray(value, 'lots').map(validateBrochureLot),
  };
  const location = getOptionalString(value, 'location');
  if (location) entity.location = location;
  return entity;
}

export function validateBrochureAIResult(value: unknown): BrochureAIResult {
  if (!isRecord(value)) throw new Error('invalid brochure result');
  const auctionDate = getString(value, 'auctionDate');
  const title = getString(value, 'title');
  if (auctionDate.trim() === '') throw new Error('invalid auctionDate');
  return {
    auctionDate,
    title,
    entities: getArray(value, 'entities').map(validateBrochureEntity),
  };
}

/* ---------- Lot image analysis ---------- */

export interface LotImageAnalysis {
  condition: string;
  estimatedCategory: string;
  suggestedPrice?: number;
  notes: string;
}

export function validateLotImageAnalysis(value: unknown): LotImageAnalysis {
  if (!isRecord(value)) throw new Error('invalid image analysis');
  const analysis: LotImageAnalysis = {
    condition: getString(value, 'condition', 'غير محدد'),
    estimatedCategory: getString(value, 'estimatedCategory', 'غير محدد'),
    notes: getString(value, 'notes'),
  };
  const suggestedPrice = getOptionalNumber(value, 'suggestedPrice');
  if (suggestedPrice !== undefined) analysis.suggestedPrice = suggestedPrice;
  return analysis;
}

/* ---------- Business insights ---------- */

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface BusinessAlert {
  severity: InsightSeverity;
  title: string;
  detail: string;
}

export interface TopDebtor {
  name: string;
  amount: number;
}

export interface BusinessInsights {
  alerts: BusinessAlert[];
  topDebtors: TopDebtor[];
  cashOutlook: string;
}

function validateSeverity(value: unknown): InsightSeverity {
  if (value === 'critical' || value === 'warning' || value === 'info') return value;
  return 'info';
}

function validateBusinessAlert(value: unknown): BusinessAlert {
  if (!isRecord(value)) throw new Error('invalid alert');
  return {
    severity: validateSeverity(value['severity']),
    title: getString(value, 'title'),
    detail: getString(value, 'detail'),
  };
}

function validateTopDebtor(value: unknown): TopDebtor {
  if (!isRecord(value)) throw new Error('invalid debtor');
  return { name: getString(value, 'name'), amount: getNumber(value, 'amount', 0) };
}

export function validateBusinessInsights(value: unknown): BusinessInsights {
  if (!isRecord(value)) throw new Error('invalid insights');
  return {
    alerts: getArray(value, 'alerts').map(validateBusinessAlert),
    topDebtors: getArray(value, 'topDebtors').map(validateTopDebtor),
    cashOutlook: getString(value, 'cashOutlook'),
  };
}
