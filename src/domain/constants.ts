/** Shared business constants — single source of truth for all finance rules. */

export const STAMP_FEE_DEFAULT = 10;

export const COMMISSION_RATE = 0.005;

export const PAYMENT_DEADLINE_DAYS = 15;

export const AUCTION_INSURANCE_DEFAULT = 50000;

export const AUCTION_HALL_DEFAULT =
  'قاعة نادي الحضارات الرياضي - شارع صلاح سالم أمام مرور عين الصيرة';

export const COLLECTIONS = {
  advanceClients: 'advanceClients',
  workClients: 'workClients',
  entities: 'entities',
  predefinedItems: 'predefinedItems',
  predefinedBuyers: 'predefinedBuyers',
  rejectedLots: 'rejectedLots',
  partnerships: 'partnerships',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const THEME_STORAGE_KEY = 'app-theme';

export const REMEMBER_EMAIL_KEY = 'remembered-email';
