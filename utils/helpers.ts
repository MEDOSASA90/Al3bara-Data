import { Timestamp } from 'firebase/firestore';
import { Lot } from '../types';

export const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!(file instanceof Blob)) {
            return reject("Input is not a Blob/File");
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(",")[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const formatCurrency = (amount: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
        return '0.00';
    }
    try {
        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (e) {
        return amount.toFixed(2);
    }
};

export const formatDate = (timestamp: Timestamp) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'لا يوجد تاريخ';
    try {
        return timestamp.toDate().toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch (e) {
        return 'تاريخ غير صالح';
    }
};

export const sortLotsByNumber = (lots: Lot[]): Lot[] => {
    if (!lots || lots.length === 0) return [];

    return [...lots].sort((a, b) => {
        if (!a.lotNumber) return 1;
        if (!b.lotNumber) return -1;

        const numA = parseInt(String(a.lotNumber).replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b.lotNumber).replace(/\D/g, '')) || 0;
        return numA - numB;
    });
};

export const formatSpecificDateTime = (timestamp: Timestamp | null) => {
    if (!timestamp || !timestamp.toDate || typeof timestamp.toDate !== 'function') {
        return 'لا يوجد تاريخ';
    }
    try {
        const date = timestamp.toDate();
        if (isNaN(date.getTime())) {
            return 'تاريخ غير صالح';
        }

        const year = date.toLocaleDateString('ar-EG', { year: 'numeric', numberingSystem: 'arab' });
        const month = date.toLocaleDateString('ar-EG', { month: '2-digit', numberingSystem: 'arab' });
        const day = date.toLocaleDateString('ar-EG', { day: '2-digit', numberingSystem: 'arab' });
        const time = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, numberingSystem: 'arab' });

        return `${year}/${month}/${day} ${time}`;
    } catch (e) {
        console.error("Error in formatSpecificDateTime:", e);
        return 'خطأ في عرض التاريخ';
    }
};

export const getDirectImageUrl = (url: string): string => {
    if (!url) return url;

    try {
        if (url.includes('drive.google.com')) {
            let fileId = '';

            const viewMatch = url.match(/\/file\/d\/([^\/\?]+)/);
            if (viewMatch) {
                fileId = viewMatch[1];
            }

            if (!fileId) {
                const openMatch = url.match(/[?&]id=([^&]+)/);
                if (openMatch) {
                    fileId = openMatch[1];
                }
            }

            if (!fileId) {
                const ucMatch = url.match(/[?&]id=([^&]+)/);
                if (ucMatch) {
                    return url;
                }
            }

            if (fileId) {
                return `https://drive.google.com/uc?export=view&id=${fileId}`;
            }
        }
        return url;
    } catch (error) {
        console.error('Error converting image URL:', error);
        return url;
    }
};
