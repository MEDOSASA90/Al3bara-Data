
import type { Timestamp } from 'firebase/firestore';

export type ViewMode = 'dashboard' | 'entities' | 'advances' | 'work' |
    'archiveMenu' | 'archiveEntities' | 'archiveWork' | 'archiveAdvances';

export interface FinancialSummary {
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
}

export interface User {
    uid: string;
    email: string | null;
}

export interface Image {
    name: string;
    url: string;
}

export interface TransactionItem {
    id: string;
    name: string;
    quantity: number;
    pricePerKilo: number;
    image?: Image;
}

export interface Transaction {
    id: string;
    amount: number;
    notes: string;
    date: Timestamp;
    isSettled: boolean;
    items?: TransactionItem[];
    entityId?: string; // Added to link commission transaction to the entity
    image?: Image;
}

export interface Client {
    id: string;
    userId: string;
    name: string;
    transactions: Transaction[];
    isBuyer?: boolean;
    isArchived?: boolean;
    archiveType?: 'entities' | 'work' | 'advances'; // Track which archive category
    phone?: string; // Added phone field
}

export interface PaymentDetails {
    payerName: string;
    date: Timestamp;
    receiptImage?: Image | null;
}

export interface LoadingDetails {
    loaderName: string;
    date: Timestamp;
}

export interface Lot {
    id: string;
    lotNumber: string;
    name: string;
    quantity: string;
    totalValue: number;
    value30: number;
    value70: number;
    is70Paid?: boolean;
    paymentDetails?: PaymentDetails;
    loadingDetails?: LoadingDetails;
    contractImage?: Image;
    isArchived: boolean;
}

export interface Entity {
    id: string;
    userId: string;
    name: string;
    buyerName?: string;
    auctionDate: Timestamp;
    lots: Lot[];
}

export interface PredefinedItem {
    id: string;
    userId: string;
    name: string;
}

export interface PredefinedBuyer {
    id: string;
    userId: string;
    name: string;
}
