
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
// FIX: The project is loading Firebase SDK v9+, so all imports and function calls have been updated to the v9+ modular syntax.
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
// FIX: Add QuerySnapshot to fix type error in onSnapshot callback.
import {
    collection,
    doc,
    where,
    onSnapshot,
    addDoc,
    deleteDoc,
    updateDoc,
    deleteField,
    Timestamp,
    query,
    orderBy,
    FirestoreError,
    QuerySnapshot,
    getDocs
} from 'firebase/firestore';
import { ViewMode, Client, Entity, Lot, Transaction, User, TransactionItem, PredefinedItem, PaymentDetails, LoadingDetails, PredefinedBuyer, FinancialSummary } from './types';
import { uploadToDrive } from './uploadToDrive';
import { compressImage } from "./compressImage";



// --- Helper Functions ---

export const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!(file instanceof Blob)) {
            return reject("Input is not a Blob/File");
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Check if result contains the comma separator for data URI
            const base64 = result.includes(',') ? result.split(",")[1] : result;
            resolve(base64);
        };
        reader.onerror = reject;

        reader.readAsDataURL(file);
    });
};

const formatCurrency = (amount: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
        return '0.00';
    }
    try {
        // Using ar-EG locale for number formatting without currency symbol
        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (e) {
        return amount.toFixed(2);
    }
};

const formatDate = (timestamp: Timestamp) => {
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

// Sort lots numerically by lot number
const sortLotsByNumber = (lots: Lot[]): Lot[] => {
    if (!lots || lots.length === 0) return [];

    return [...lots].sort((a, b) => {
        // Handle undefined or null lot numbers
        if (!a.lotNumber) return 1;
        if (!b.lotNumber) return -1;

        // Extract numeric part from lot number
        const numA = parseInt(String(a.lotNumber).replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b.lotNumber).replace(/\D/g, '')) || 0;
        return numA - numB;
    });
};

const formatSpecificDateTime = (timestamp: Timestamp | null) => {
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

const getDirectImageUrl = (url: string): string => {
    if (!url) return url;

    try {
        // Check if it's a Google Drive URL
        if (url.includes('drive.google.com')) {
            // Extract file ID from various Google Drive URL formats
            let fileId = '';

            // Format: https://drive.google.com/file/d/FILE_ID/view
            const viewMatch = url.match(/\/file\/d\/([^\/\?]+)/);
            if (viewMatch) {
                fileId = viewMatch[1];
            }

            // Format: https://drive.google.com/open?id=FILE_ID
            if (!fileId) {
                const openMatch = url.match(/[?&]id=([^&]+)/);
                if (openMatch) {
                    fileId = openMatch[1];
                }
            }

            // Format: https://drive.google.com/uc?export=view&id=FILE_ID (already direct)
            if (!fileId) {
                const ucMatch = url.match(/[?&]id=([^&]+)/);
                if (ucMatch) {
                    return url; // Already in direct format
                }
            }

            // If we found a file ID, convert to direct image URL
            if (fileId) {
                return `https://drive.google.com/uc?export=view&id=${fileId}`;
            }
        }

        // Return original URL if not a Google Drive URL or couldn't parse
        return url;
    } catch (error) {
        console.error('Error converting image URL:', error);
        return url; // Return original URL on error
    }
};



// --- UI Components ---

const SplashScreen: React.FC = () => (
    <div className="fixed inset-0 bg-gray-900 flex flex-col justify-center items-center z-50 text-white animate-fadeIn">
        <svg
            className="w-28 h-28 mb-6 text-cyan-400 animate-float"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.7))' }}
        >
            <path d="M10 55L20 40H80L90 55H10Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
            <path d="M20 65V55" stroke="currentColor" strokeWidth="3" />
            <path d="M80 65V55" stroke="currentColor" strokeWidth="3" />
            <path d="M10 55L20 65H80L90 55" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
            <rect x="25" y="40" width="10" height="10" stroke="currentColor" strokeWidth="2.5" />
            <rect x="45" y="40" width="10" height="10" stroke="currentColor" strokeWidth="2.5" />
            <rect x="65" y="40" width="10" height="10" stroke="currentColor" strokeWidth="2.5" />
            <path d="M5 75H95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M15 80H85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
        </svg>
        <h1 className="text-3xl font-bold tracking-wider animate-fadeInScale" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.3)' }}>
            العبارة للتجارة والتوريدات
        </h1>
    </div>
);

const BalanceDisplay: React.FC<{ total: number }> = ({ total }) => {
    const isDebit = total >= 0;
    const statusText = isDebit ? '(مدين)' : '(دائن)';
    // Use Math.abs to safely handle the number, ensuring no negative sign duplication
    const safeTotal = isNaN(total) ? 0 : Math.abs(total);
    const amount = formatCurrency(safeTotal);
    const bgColor = isDebit ? 'bg-red-600' : 'bg-green-600';

    return (
        <div className={`p-4 rounded-lg shadow-lg ${bgColor} text-white w-full max-w-sm`}>
            <div className="flex justify-between items-baseline">
                <span className="text-base font-semibold">الرصيد النهائي {statusText}</span>
                <span className="text-3xl font-bold tracking-tighter" dir="ltr">{amount}</span>
            </div>
        </div>
    );
};


const PermissionsFix: React.FC = () => (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mt-6 mb-4 rounded-r-md" role="alert">
        <p className="font-bold">كيفية إصلاح خطأ الأذونات</p>
        <p className="mt-2 text-sm">
            يبدو أن قواعد أمان Firestore في مشروع Firebase الخاص بك تحتاج إلى تحديث.
            انسخ القواعد التالية والصقها في قسم "Rules" في Firestore داخل لوحة تحكم Firebase الخاصة بك, ثم انشرها.
        </p>
        <pre className="bg-gray-800 text-white p-4 rounded-md mt-4 text-left overflow-x-auto" dir="ltr">
            <code>
                {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // For advanceClients collection
    match /advanceClients/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // For workClients collection
    match /workClients/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // For entities collection
    match /entities/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // For predefinedItems collection
    match /predefinedItems/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // For predefinedBuyers collection
    match /predefinedBuyers/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}`}
            </code>
        </pre>
        <p className="mt-2 text-xs">
            هذه القواعد المحدثة تضمن أن كل مستخدم يمكنه فقط الوصول إلى البيانات التي قام بإنشائها. لقد تم تبسيطها لتكون أكثر قوة وتمنع الأخطاء حتى لو كانت بعض البيانات القديمة غير مكتملة.
        </p>
    </div>
);

const IndexFix: React.FC<{ errorMessage: string }> = ({ errorMessage }) => {
    const urlMatch = errorMessage.match(/https?:\/\/[^\s]+/);
    const indexUrl = urlMatch ? urlMatch[0] : null;

    return (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-800 p-4 mt-6 mb-4 rounded-r-md" role="alert">
            <p className="font-bold">مطلوب فهرس لقاعدة البيانات (خطوة إعداد لمرة واحدة)</p>
            <p className="mt-2 text-sm">
                لتحميل البيانات وفرزها بسرعة وكفاءة، يتطلب Firestore إنشاء "فهرس" خاص. هذه خطوة إعداد لمرة واحدة تضمن أفضل أداء للتطبيق.
            </p>
            <p className="mt-2 text-sm">
                لا تقلق، العملية بسيطة. اضغط على الرابط أدناه، وسيتم نقلك إلى صفحة إنشاء الفهرس في لوحة تحكم Firebase. كل ما عليك هو الضغط على زر "إنشاء" (Create) والانتظار بضع دقائق حتى يكتمل بناء الفهرس.
            </p>
            {indexUrl ? (
                <a
                    href={indexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors"
                >
                    إنشاء الفهرس الآن
                </a>
            ) : <p className="mt-2 text-sm font-semibold">لم يتم العثور على رابط الإنشاء التلقائي. يرجى مراجعة سجلات الأخطاء في المتصفح.</p>}
        </div>
    );
};


const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; dialogClassName?: string }> = ({ isOpen, onClose, title, children, dialogClassName }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fadeIn" onClick={onClose}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 ${dialogClassName || 'bg-white'}`} onClick={e => e.stopPropagation()}>
                <div className={`p-6 border-b flex justify-between items-center ${dialogClassName ? 'border-gray-700' : 'border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
                            </svg>
                        </div>
                        <h3 className={`text-xl font-bold ${dialogClassName ? 'text-white' : 'text-gray-800'}`}>{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${dialogClassName ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

const Header: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => (
    <header className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white shadow-xl border-b border-slate-700 sticky top-0 z-50">
        <div className="w-full max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
                    </svg>
                </div>
                <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent leading-tight">
                    العبارة <span className="hidden xs:inline">للتجارة والتوريدات</span>
                </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden md:flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5 border border-slate-600">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs md:text-sm text-gray-300 max-w-[150px] truncate" dir="ltr">{user.email}</span>
                </div>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-3 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    title="تسجيل الخروج"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="hidden md:inline text-sm">خروج</span>
                </button>
            </div>
        </div>
    </header>
);

const MetricCard: React.FC<{
    title: string;
    value: React.ReactNode;
    tag?: React.ReactNode;
    gradient: string;
    icon: string;
    subText?: string
}> = ({ title, value, tag, gradient, icon, subText }) => (
    <div className={`group relative bg-gradient-to-br ${gradient} rounded-2xl p-4 md:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white/90 uppercase tracking-wider">{title}</span>
                <div className="flex items-center gap-2">
                    {tag}
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <span className="text-2xl">{icon}</span>
                    </div>
                </div>
            </div>
            <p className="text-3xl font-black text-white mb-2" dir="ltr">{value}</p>
            {subText && <p className="text-xs text-white/80 font-medium">{subText}</p>}
        </div>
    </div>
);


const DashboardMetrics: React.FC<{ entities: Entity[] }> = ({ entities }) => {
    const metrics = useMemo(() => {
        // Safety check for undefined entities
        if (!entities) return { totalInvoices: 0, remainingToSupply: 0, remaining30: 0, upcomingLot: undefined };

        const allLots = entities.flatMap(e => (e.lots || []).filter(l => l && !l.isArchived));

        const totalInvoices = allLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
        const remainingToSupply = allLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);
        const remaining30 = allLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);

        const upcomingLot = allLots
            .filter(lot => !lot.is70Paid) // Filter out already paid lots
            .map(lot => {
                const entity = entities.find(e => e.lots && e.lots.some(l => l.id === lot.id));
                return { ...lot, auctionDate: entity?.auctionDate };
            })
            .filter(lot => lot.auctionDate && typeof lot.auctionDate.toMillis === 'function' && (new Date(lot.auctionDate.toMillis() + 15 * 24 * 60 * 60 * 1000) > new Date()))
            .sort((a, b) => {
                const dateA = a.auctionDate ? a.auctionDate.toMillis() : 0;
                const dateB = b.auctionDate ? b.auctionDate.toMillis() : 0;
                return dateA - dateB;
            })
        [0];

        return {
            totalInvoices,
            remainingToSupply,
            remaining30,
            upcomingLot,
        };
    }, [entities]);

    const getStatusTag = (days: number) => {
        if (isNaN(days)) return null;
        if (days < 0) return <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded-full">متأخر</span>;
        if (days <= 5) return <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">قيد الانتظار</span>;
        return <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">قادم</span>;
    };

    const getDaysDiff = (date: Timestamp) => {
        if (!date || typeof date.toMillis !== 'function') return 0;
        const deadline = new Date(date.toMillis());
        deadline.setDate(deadline.getDate() + 15);
        const now = new Date();
        const diffTime = deadline.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Check if all debts (70%) are paid, but only if there are invoices to begin with
    const isFullyPaid = metrics.totalInvoices > 0 && metrics.remainingToSupply === 0;

    if (isFullyPaid) {
        return (
            <div className="mb-8">
                <div className="bg-white p-8 rounded-lg shadow-md border border-green-200 text-center animate-fadeIn">
                    <h4 className="text-2xl font-bold text-gray-600 mb-4">إجمالي حساب المشتريات</h4>
                    <p className="text-5xl font-bold text-gray-900" dir="ltr">{formatCurrency(metrics.totalInvoices)}</p>
                    <div className="mt-6 inline-block bg-green-100 text-green-800 px-6 py-2 rounded-full font-semibold">
                        تم سداد جميع المستحقات
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="إجمالي الفواتير"
                    value={formatCurrency(metrics.totalInvoices)}
                    gradient="from-blue-500 to-indigo-600"
                    icon="📄"
                />
                <MetricCard
                    title="إجمالي المتبقي (70%)"
                    value={formatCurrency(metrics.remainingToSupply)}
                    gradient="from-orange-500 to-red-600"
                    icon="📉"
                />
                <MetricCard
                    title="إجمالي المتبقي (30%)"
                    value={formatCurrency(metrics.remaining30)}
                    gradient="from-purple-500 to-pink-600"
                    icon="📊"
                />
                {metrics.upcomingLot && metrics.upcomingLot.auctionDate ? (() => {
                    const deadlineDate = new Date(metrics.upcomingLot.auctionDate.toMillis());
                    deadlineDate.setDate(deadlineDate.getDate() + 15);
                    const deadlineTimestamp = Timestamp.fromDate(deadlineDate);

                    return (
                        <MetricCard
                            title="أقرب ميعاد للدفع"
                            value={formatDate(deadlineTimestamp)}
                            tag={getStatusTag(getDaysDiff(metrics.upcomingLot.auctionDate))}
                            gradient="from-teal-500 to-cyan-600"
                            icon="📅"
                        />
                    );
                })() : (
                    <MetricCard
                        title="أقرب ميعاد للدفع"
                        value="لا يوجد"
                        gradient="from-teal-500 to-cyan-600"
                        icon="📅"
                    />
                )}
            </div>
        </div>
    );
};


const TransactionPrintLayout: React.FC<{ client: Client; transaction: Transaction; exportDate: string }> = ({ client, transaction, exportDate }) => {
    return (
        <div className="bg-white font-sans min-h-screen flex flex-col" dir="rtl" style={{ maxWidth: '210mm', margin: '0 auto', padding: '40px' }}>

            {/* Header */}
            <header className="mb-10 flex justify-between items-start border-b-2 border-slate-100 pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            ع
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
                        كشف حساب حركة
                    </span>
                    <p className="text-slate-400 text-xs font-medium">{exportDate}</p>
                </div>
            </header>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">العميل</h3>
                    <p className="text-2xl font-bold text-slate-800">{client.name}</p>
                    {client.phone && <p className="text-slate-500 text-sm mt-1">{client.phone}</p>}
                </div>
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">تفاصيل الحركة</h3>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                            <span className="text-blue-700 text-sm">التاريخ</span>
                            <span className="text-blue-900 font-bold">{formatDate(transaction.date)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200">
                            <span className="text-blue-700 text-sm">القيمة الإجمالية</span>
                            <span className="text-2xl font-black text-blue-900" dir="ltr">{formatCurrency(transaction.amount)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            {transaction.items && transaction.items.length > 0 && (
                <section className="mb-10 flex-grow">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                        <h3 className="text-lg font-bold text-slate-800">تفاصيل الأصناف</h3>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-right">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider">الصنف</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider">الكمية (كجم)</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider">سعر الكيلو</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-center">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transaction.items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-slate-700 font-medium">{item.name}</td>
                                        <td className="p-4 text-slate-600 font-mono text-sm">{item.quantity}</td>
                                        <td className="p-4 text-slate-600 font-mono text-sm">{formatCurrency(item.pricePerKilo)}</td>
                                        <td className="p-4 text-slate-900 font-bold text-center font-mono text-sm bg-slate-50/30">
                                            {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Notes */}
            {transaction.notes && (
                <section className="mb-10 bg-amber-50 p-5 rounded-xl border border-amber-100 flex gap-4 items-start">
                    <span className="text-2xl">📝</span>
                    <div>
                        <h3 className="text-sm font-bold text-amber-800 mb-1">ملاحظات</h3>
                        <p className="text-amber-900 text-sm leading-relaxed">{transaction.notes}</p>
                    </div>
                </section>
            )}

            {/* Images */}
            {transaction.items?.some(item => item.image && item.image.url) && (
                <section className="mb-10 break-inside-avoid">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                        <h3 className="text-lg font-bold text-slate-800">الصور المرفقة</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {transaction.items
                            .filter(item => item.image && item.image.url)
                            .map(item => (
                                <div key={item.id} className="group relative border border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition-shadow break-inside-avoid">
                                    <div className="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
                                        <img
                                            src={getDirectImageUrl(item.image.url)}
                                            alt={item.name}
                                            className="w-full h-32 object-cover transform group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <p className="text-center text-xs text-slate-500 mt-2 font-semibold">{item.name}</p>
                                </div>
                            ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="mt-auto pt-8 border-t border-slate-100 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-slate-400">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                </div>
                <p className="text-slate-400 text-xs font-medium">تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
            </footer>

        </div>
    );
};

const ClientSummaryPrintLayout: React.FC<{ client: Client; exportDate: string }> = ({ client, exportDate }) => {
    const total = client.transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const sortedTransactions = [...client.transactions].sort((a, b) => {
        const dateA = a.date ? a.date.toMillis() : 0;
        const dateB = b.date ? b.date.toMillis() : 0;
        return dateA - dateB;
    });

    return (
        <div className="bg-white font-sans min-h-screen flex flex-col" dir="rtl" style={{ maxWidth: '210mm', margin: '0 auto', padding: '40px' }}>

            {/* Header */}
            <header className="mb-10 flex justify-between items-start border-b-2 border-slate-100 pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            ع
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">العبارة للتجارة والتوريدات</h1>
                    </div>
                    <p className="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                </div>
                <div className="text-left">
                    <span className="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full mb-2">
                        ملخص حساب عميل
                    </span>
                    <p className="text-slate-400 text-xs font-medium">{exportDate}</p>
                </div>
            </header>

            {/* Client Info */}
            <section className="mb-10 bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-3xl">
                        👤
                    </div>
                    <div>
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">بيانات العميل</h2>
                        <p className="text-3xl font-black text-slate-800">{client.name}</p>
                        {client.phone && <p className="text-slate-500 mt-1">{client.phone}</p>}
                    </div>
                </div>
            </section>

            {/* Transactions Table */}
            <section className="mb-10 flex-grow">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                    <h3 className="text-lg font-bold text-slate-800">كشف الحركات</h3>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">التاريخ</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider">البيان</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-center">مدين</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-center">دائن</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedTransactions.map((t, index) => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 text-slate-700 font-medium whitespace-nowrap">{formatDate(t.date)}</td>
                                    <td className="p-4 text-slate-600">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${t.amount > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'} mb-1`}>
                                            {t.amount > 0 ? 'مشتريات' : 'سداد'}
                                        </span>
                                        <div className="text-sm">{t.notes || (t.amount > 0 ? "حركة مشتريات" : "دفعة سداد")}</div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-slate-800 font-mono text-sm">
                                        {t.amount > 0 ? formatCurrency(t.amount) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="p-4 text-center font-bold text-green-600 font-mono text-sm">
                                        {t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : <span className="text-slate-300">-</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Footer Summary */}
            <footer className="mt-auto pt-8 border-t border-slate-100">
                <div className="flex justify-end">
                    <div className={`p-8 rounded-2xl shadow-lg ${total >= 0 ? 'bg-gradient-to-br from-red-50 to-white border border-red-100' : 'bg-gradient-to-br from-green-50 to-white border border-green-100'} w-full max-w-md`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className={`text-sm font-bold uppercase tracking-wider ${total >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                الرصيد النهائي {total >= 0 ? '(مدين)' : '(دائن)'}
                            </span>
                            <span className="text-2xl">{total >= 0 ? '📉' : '✅'}</span>
                        </div>
                        <div className="flex items-baseline justify-between border-t border-black/5 pt-4">
                            <span className="text-slate-500 text-sm">الإجمالي المستحق</span>
                            <div className={`text-4xl font-black tracking-tight ${total >= 0 ? 'text-red-800' : 'text-green-800'}`} dir="ltr">
                                {formatCurrency(Math.abs(total))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2 mt-12">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    </div>
                    <p className="text-slate-400 text-xs font-medium">تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
                </div>
            </footer>
        </div>
    );
};

// --- Transaction Group Component ---

const TransactionGroupItem: React.FC<{
    transactions: Transaction[];
    client: Client;
    clientType: 'advance' | 'work';
    onOpenTransactionModal: (c: Client, t: Transaction) => void;
    onDeleteTransaction: (cid: string, type: 'advance' | 'work', tid: string) => void;
    onExportTransaction: (c: Client, t: Transaction) => void;
}> = ({ transactions, client, clientType, onOpenTransactionModal, onDeleteTransaction, onExportTransaction }) => {
    const [expanded, setExpanded] = useState(false);

    if (transactions.length === 0) return null;

    // Single transaction case - preserve exact existing layout
    if (transactions.length === 1) {
        const t = transactions[0];
        const isPayment = t.amount < 0;
        const transactionBgColor = isPayment ? 'bg-green-50/70 border-green-200' : 'bg-gray-50 border-gray-200';
        const amountColor = isPayment ? 'text-green-700' : 'text-gray-800';

        return (
            <div key={t.id} className={`${transactionBgColor} p-2 md:p-3 rounded-md border`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className={`font-bold text-lg ${amountColor}`} dir="ltr">{formatCurrency(t.amount)}</p>
                        <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                        {t.notes && <p className="text-sm text-gray-600 mt-1">ملاحظات: {t.notes}</p>}
                        {t.image && (
                            <a
                                href={t.image.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                عرض صورة الحركة
                            </a>
                        )}
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                        <button onClick={() => onOpenTransactionModal(client, t)} className="bg-blue-500 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-blue-600 transition-colors">تعديل</button>
                        <button onClick={() => onDeleteTransaction(client.id, clientType, t.id)} className="bg-red-500 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-red-600 transition-colors">حذف</button>
                        <button onClick={() => onExportTransaction(client, t)} className="bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-green-600 transition-colors">تصدير PDF</button>
                    </div>
                </div>
                {t.items && t.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                        <h5 className="text-sm font-bold text-gray-700 mb-2">تفاصيل الأصناف:</h5>
                        <div className="space-y-2">
                            {t.items.map(item => (
                                <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200/80 shadow-sm">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                                        <p className="text-xs text-gray-500 mt-1" dir="ltr">
                                            {item.quantity} كجم &times; {formatCurrency(item.pricePerKilo)}
                                        </p>
                                    </div>
                                    <div className="text-right pl-2">
                                        <p className="text-base font-bold text-gray-900" dir="ltr">
                                            {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                        </p>
                                        {item.image && (
                                            <a
                                                href={item.image.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-500 hover:underline"
                                            >
                                                عرض الصورة
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Multiple transactions case
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const isTotalPayment = totalAmount < 0;
    // Use a distinct look for grouped items
    const groupBgColor = isTotalPayment ? 'bg-green-100 border-green-300' : 'bg-indigo-50 border-indigo-200';
    const headerAmountColor = isTotalPayment ? 'text-green-800' : 'text-indigo-900';
    const dateStr = formatDate(transactions[0].date);

    // Collect unique notes
    const allNotes = Array.from(new Set(transactions.map(t => t.notes).filter(Boolean)));

    return (
        <div className={`${groupBgColor} rounded-md border overflow-hidden shadow-sm`}>
            <div
                className="p-2 md:p-3 flex justify-between items-center cursor-pointer hover:bg-opacity-80 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg ${headerAmountColor}`} dir="ltr">{formatCurrency(totalAmount)}</span>
                        <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full text-gray-600 font-medium border border-gray-200">
                            مجمع ({transactions.length})
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{dateStr}</p>
                    {allNotes.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                            {allNotes.join('، ')}
                        </p>
                    )}
                </div>
                <div className="text-gray-500">
                    {expanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
            </div>

            {expanded && (
                <div className="bg-white/50 border-t p-2 space-y-2">
                    {transactions.map(t => {
                        const isPayment = t.amount < 0;
                        const innerBg = isPayment ? 'bg-green-50' : 'bg-white';
                        const amtColor = isPayment ? 'text-green-700' : 'text-gray-800';
                        return (
                            <div key={t.id} className={`${innerBg} p-2 rounded border border-gray-100 shadow-sm flex justify-between items-start`}>
                                <div>
                                    <p className={`font-bold text-sm ${amtColor}`} dir="ltr">{formatCurrency(t.amount)}</p>
                                    {t.notes && <p className="text-xs text-gray-500">{t.notes}</p>}
                                    {t.image && (
                                        <a
                                            href={t.image.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            صورة
                                        </a>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); onOpenTransactionModal(client, t) }} className="text-blue-600 hover:text-blue-800 text-xs px-1">تعديل</button>
                                    <button onClick={(e) => { e.stopPropagation(); onDeleteTransaction(client.id, clientType, t.id) }} className="text-red-600 hover:text-red-800 text-xs px-1">حذف</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};


const App: React.FC = () => {
    // --- State ---
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
    const [clients, setClients] = useState<Client[]>([]);
    const [workClients, setWorkClients] = useState<Client[]>([]);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [predefinedItems, setPredefinedItems] = useState<PredefinedItem[]>([]);
    const [predefinedBuyers, setPredefinedBuyers] = useState<PredefinedBuyer[]>([]);

    const [dbError, setDbError] = useState<string | null>(null);

    // Modals
    const [isClientModalOpen, setClientModalOpen] = useState(false);
    const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
    const [isEntityModalOpen, setEntityModalOpen] = useState(false);
    const [isLotModalOpen, setLotModalOpen] = useState(false);
    const [isPredefinedItemModalOpen, setPredefinedItemModalOpen] = useState(false);
    const [isPredefinedBuyerModalOpen, setPredefinedBuyerModalOpen] = useState(false);
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isSupplyModalOpen, setSupplyModalOpen] = useState(false);
    const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
    const [isConfirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
    const [isConfirmDeleteClientModalOpen, setConfirmDeleteClientModalOpen] = useState(false);
    const [isConfirmDeleteLotModalOpen, setConfirmDeleteLotModalOpen] = useState(false);
    const [isConfirmDeleteTransactionModalOpen, setConfirmDeleteTransactionModalOpen] = useState(false);


    // Modal Data
    const [currentClient, setCurrentClient] = useState<Client | null>(null);
    const [currentEntity, setCurrentEntity] = useState<Entity | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
    const [editingLot, setEditingLot] = useState<Lot | null>(null);
    const [supplyTarget, setSupplyTarget] = useState<{ type: 'lot' | 'entity'; entityId: string; lotId?: string } | null>(null);
    const [loadingTarget, setLoadingTarget] = useState<{ entityId: string; lotId?: string } | null>(null);
    const [newPredefinedItemName, setNewPredefinedItemName] = useState('');
    const [newPredefinedBuyerName, setNewPredefinedBuyerName] = useState('');
    const [entityToDeleteId, setEntityToDeleteId] = useState<string | null>(null);
    const [clientToDelete, setClientToDelete] = useState<{ id: string; type: 'advance' | 'work' } | null>(null);
    const [lotToDelete, setLotToDelete] = useState<{ entityId: string; lotId: string } | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<{ clientId: string; clientType: 'advance' | 'work'; transactionId: string } | null>(null);
    const [settleTarget, setSettleTarget] = useState<{ client: Client; total: number } | null>(null);
    const [isSettleModalOpen, setSettleModalOpen] = useState(false);
    const [clientToRestore, setClientToRestore] = useState<Client | null>(null);
    const [isRestoreModalOpen, setRestoreModalOpen] = useState(false);



    // --- Effects ---

    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    useEffect(() => {
        // FIX: Use Firebase v9 modular syntax for onAuthStateChanged.
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) {
            setClients([]);
            setWorkClients([]);
            setEntities([]);
            setPredefinedItems([]);
            setPredefinedBuyers([]);
            return;
        }

        const collectionsToFetch = [
            { name: 'advanceClients', setter: setClients, sortField: null },
            { name: 'workClients', setter: setWorkClients, sortField: null },
            { name: 'entities', setter: setEntities, sortField: 'auctionDate' },
            { name: 'predefinedItems', setter: setPredefinedItems, sortField: null },
            { name: 'predefinedBuyers', setter: setPredefinedBuyers, sortField: null }
        ];

        const unsubscribers = collectionsToFetch.map(({ name, setter, sortField }) => {
            // FIX: Use Firebase v9 modular syntax for collection, query, and onSnapshot.
            let q;
            const collRef = collection(db, name);
            if (sortField) {
                q = query(collRef, where("userId", "==", user.uid), orderBy(sortField, "desc"));
            } else {
                q = query(collRef, where("userId", "==", user.uid));
            }

            // FIX: Explicitly type snapshot as QuerySnapshot to resolve error on snapshot.docs
            return onSnapshot(q, (snapshot: QuerySnapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                setter(data);
                setDbError(null);
            }, (err: FirestoreError) => {
                console.error(`Error fetching ${name}: `, err);
                setDbError(`فشل تحميل ${name}. السبب: ${err.message}`);
            });
        });

        return () => unsubscribers.forEach(unsub => unsub());

    }, [user]);

    // --- Browser History API for Back Button Support ---

    // Handle browser back/forward button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.viewMode) {
                setViewMode(event.state.viewMode);
                // Close any open modals when navigating back
                setTransactionModalOpen(false);
                setClientModalOpen(false);
                setEntityModalOpen(false);
                setLotModalOpen(false);
                setPaymentModalOpen(false);
                setSupplyModalOpen(false);
                setIsLoadingModalOpen(false);
                setPredefinedItemModalOpen(false);
                setPredefinedBuyerModalOpen(false);
            } else {
                // If no state, go back to dashboard
                setViewMode('dashboard');
            }
        };

        // Add event listener
        window.addEventListener('popstate', handlePopState);

        // Initialize with dashboard state if not already set
        if (!window.history.state || !window.history.state.viewMode) {
            window.history.replaceState({ viewMode: 'dashboard' }, '', '#dashboard');
        }

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    // Update history when viewMode changes
    useEffect(() => {
        // Only push state if we're not already at this state
        const currentState = window.history.state;
        if (!currentState || currentState.viewMode !== viewMode) {
            window.history.pushState({ viewMode }, '', `#${viewMode}`);
        }
    }, [viewMode]);

    // --- Handlers ---

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            // FIX: Use Firebase v9 modular syntax for signInWithEmailAndPassword.
            await signInWithEmailAndPassword(auth, email, password);
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
        } catch (err: any) {
            console.error("Login error:", err);
            let errorMsg = "حدث خطأ في تسجيل الدخول.";

            const errorCode = err.code || '';
            const errorMessage = err.message || '';

            // Handle common error codes with friendly Arabic messages
            if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
                errorMsg = "فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.";
            } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
            } else if (errorCode === 'auth/too-many-requests') {
                errorMsg = "تم حظر الوصول مؤقتاً بسبب تكرار محاولات الدخول الفاشلة. يرجى المحاولة لاحقاً.";
            } else if (errorMessage) {
                errorMsg = errorMessage;
            }
            setError(errorMsg);
        }
    };

    const handleLogout = async () => {
        // FIX: Use Firebase v9 modular syntax for signOut.
        await signOut(auth);
    };

    const addClient = async (name: string, phone: string | undefined, type: 'advance' | 'work') => {
        if (!user) return;
        const collectionName = type === 'advance' ? 'advanceClients' : 'workClients';

        try {
            const newClient = {
                name: name.trim(),
                phone: phone?.trim() || '',
                transactions: [],
                userId: user.uid
            };

            await addDoc(collection(db, collectionName), newClient);
            setClientModalOpen(false);
        } catch (error) {
            console.error('Error adding client:', error);
            alert('حدث خطأ أثناء إضافة العميل');
        }
    };


    const handleFileUpload = async (file: File | null, prefix: string): Promise<{ name: string; url: string } | undefined> => {
        if (!file) return undefined;
        try {
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '');
            const fileName = `${prefix}_${Date.now()}_${cleanFileName}`;

            // Convert to base64 before upload to bypass CORS via Cloud Function
            const base64 = await toBase64(file);

            const result: any = await uploadToDrive(base64, fileName, file.type);

            if (result && result.success) {
                return { name: file.name, url: result.url };
            }
            const errorMessage = result && result.error ? (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)) : 'فشل رفع الملف';
            throw new Error(errorMessage);
        } catch (error) {
            console.error("Error uploading file:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`خطأ في رفع الملف: ${errorMessage}`);
            return undefined;
        }
    };

    const addOrUpdateClient = async (name: string, type: 'advance' | 'work') => {
        if (!name.trim() || !user) return;
        const collectionName = type === 'advance' ? 'advanceClients' : 'workClients';
        try {
            // FIX: Use Firebase v9 modular syntax for adding a document.
            await addDoc(collection(db, collectionName), {
                userId: user.uid,
                name: name.trim(),
                transactions: [],
            });
            setClientModalOpen(false);
        } catch (error) {
            console.error(`Error adding ${type} client:`, error);
        }
    };

    const openConfirmDeleteClientModal = (clientId: string, type: 'advance' | 'work') => {
        setClientToDelete({ id: clientId, type });
        setConfirmDeleteClientModalOpen(true);
    };

    const handleConfirmDeleteClient = async () => {
        if (!clientToDelete) return;
        const collectionName = clientToDelete.type === 'advance' ? 'advanceClients' : 'workClients';
        try {
            await deleteDoc(doc(db, collectionName, clientToDelete.id));
        } catch (error) {
            console.error(`Error deleting ${clientToDelete.type} client:`, error);
            alert(`فشل حذف العميل. الخطأ: ${error}`);
        } finally {
            setConfirmDeleteClientModalOpen(false);
            setClientToDelete(null);
        }
    };

    const addOrUpdateTransaction = async (
        transactionData: { amount: number; notes: string; date: Date; items: TransactionItem[]; isSettled: boolean; image?: { name: string; url: string } },
        clientId: string,
        type: 'advance' | 'work'
    ) => {
        if (!user) return;
        const collectionName = type === 'advance' ? 'advanceClients' : 'workClients';
        // FIX: Use Firebase v9 modular syntax to get a document reference.
        const clientRef = doc(db, collectionName, clientId);

        const clientList = type === 'advance' ? clients : workClients;
        const client = clientList.find(c => c.id === clientId);
        if (!client) return;

        const newTransaction: Transaction = {
            id: editingTransaction ? editingTransaction.id : `${Date.now()}`,
            amount: transactionData.amount || 0,
            notes: transactionData.notes || '',
            // FIX: Use Firebase v9 modular syntax for creating a Timestamp.
            date: Timestamp.fromDate(transactionData.date),
            isSettled: transactionData.isSettled,
            items: transactionData.items,
            // Only include image field if it exists (Firestore doesn't accept undefined)
            ...(transactionData.image && { image: transactionData.image })
        };

        const updatedTransactions = editingTransaction
            ? client.transactions.map(t => t.id === editingTransaction.id ? newTransaction : t)
            : [...client.transactions, newTransaction];

        try {
            // FIX: Use Firebase v9 modular syntax for updating a document.
            await updateDoc(clientRef, { transactions: updatedTransactions });
            setTransactionModalOpen(false);
            setEditingTransaction(null);
            setCurrentClient(null);
        } catch (error) {
            console.error("Error adding/updating transaction:", error);
        }
    };

    const openConfirmDeleteTransactionModal = (clientId: string, clientType: 'advance' | 'work', transactionId: string) => {
        setTransactionToDelete({ clientId, clientType, transactionId });
        setConfirmDeleteTransactionModalOpen(true);
    };

    const handleConfirmDeleteTransaction = async () => {
        if (!transactionToDelete) return;
        const { clientId, clientType, transactionId } = transactionToDelete;

        const collectionName = clientType === 'advance' ? 'advanceClients' : 'workClients';
        const clientRef = doc(db, collectionName, clientId);

        const clientList = clientType === 'advance' ? clients : workClients;
        const client = clientList.find(c => c.id === clientId);
        if (!client) {
            alert("لم يتم العثور على العميل.");
            setConfirmDeleteTransactionModalOpen(false);
            setTransactionToDelete(null);
            return;
        }

        const updatedTransactions = client.transactions.filter(t => t.id !== transactionId);

        try {
            await updateDoc(clientRef, { transactions: updatedTransactions });
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert(`فشل حذف الحركة. الخطأ: ${error}`);
        } finally {
            setConfirmDeleteTransactionModalOpen(false);
            setTransactionToDelete(null);
        }
    };

    const addPayment = async (
        paymentData: { amount: number; notes: string; date: Date; linkedTransactionId?: string; receiptImage?: { name: string; url: string } },
        clientId: string,
        type: 'advance' | 'work'
    ) => {
        if (!user) return;
        const collectionName = type === 'advance' ? 'advanceClients' : 'workClients';
        const clientRef = doc(db, collectionName, clientId);

        const clientList = type === 'advance' ? clients : workClients;
        const client = clientList.find(c => c.id === clientId);
        if (!client) {
            alert("لم يتم العثور على العميل.");
            return;
        }

        const newTransaction: Transaction = {
            id: `${Date.now()}`,
            amount: -Math.abs(paymentData.amount || 0), // Crucial: make it negative
            notes: paymentData.notes || 'دفعة سداد',
            date: Timestamp.fromDate(paymentData.date),
            isSettled: true, // Mark as a payment/settlement
            items: paymentData.receiptImage ? [{
                id: `receipt_${Date.now()}`,
                name: 'إيصال السداد',
                quantity: 0,
                pricePerKilo: 0,
                image: paymentData.receiptImage
            }] : [] // Add receipt image as an item if provided
        };

        let updatedTransactions = [...client.transactions, newTransaction];

        // If a transaction was linked, mark it as settled
        if (paymentData.linkedTransactionId) {
            updatedTransactions = updatedTransactions.map(t =>
                t.id === paymentData.linkedTransactionId ? { ...t, isSettled: true } : t
            );
        }

        try {
            await updateDoc(clientRef, { transactions: updatedTransactions });
            setPaymentModalOpen(false);
            setCurrentClient(null);
        } catch (error) {
            console.error("Error adding payment:", error);
            alert(`فشل إضافة السداد. الخطأ: ${error}`);
        }
    };

    // --- Automated Commission Logic ---

    const syncBuyerCommission = async (entityData: Entity) => {
        if (!user) return;
        const { id: entityId, buyerName, auctionDate, lots } = entityData;

        // 1. Calculate Commission
        // Calculate commission based on active lots (non-archived)
        const activeLots = (lots || []).filter(l => !l.isArchived);
        const totalValue = activeLots.reduce((sum, l) => sum + (l.totalValue || 0), 0);
        const commission = totalValue * 0.005; // 0.5%

        // 2. Find if this entity commission already exists in ANY client (to handle buyer change)
        // We use the 'clients' (advanceClients) state to find potential old owners of this commission
        for (const client of clients) {
            const transactionIndex = client.transactions?.findIndex(t => t.entityId === entityId);

            if (transactionIndex !== undefined && transactionIndex !== -1) {
                // Commission found in this client's history

                // Case A: This IS the current buyer
                if (client.name === buyerName) {
                    if (commission > 0) {
                        // Update existing transaction with new values
                        const updatedTransactions = [...client.transactions];
                        updatedTransactions[transactionIndex] = {
                            ...updatedTransactions[transactionIndex],
                            amount: -commission, // Credit
                            date: auctionDate || Timestamp.now(),
                            notes: `عمولة 0.5% عن جلسة بتاريخ ${formatDate(auctionDate)}`,
                            isSettled: true
                        };
                        // If client wasn't marked as buyer before, mark it now
                        await updateDoc(doc(db, 'advanceClients', client.id), {
                            transactions: updatedTransactions,
                            isBuyer: true
                        });
                    } else {
                        // Commission is 0 (e.g. all lots deleted), remove the transaction
                        const updatedTransactions = client.transactions.filter(t => t.entityId !== entityId);
                        await updateDoc(doc(db, 'advanceClients', client.id), { transactions: updatedTransactions });
                    }
                    return; // Done
                }

                // Case B: This is NOT the current buyer (Buyer changed)
                // Remove it from this client
                const updatedTransactions = client.transactions.filter(t => t.entityId !== entityId);
                await updateDoc(doc(db, 'advanceClients', client.id), { transactions: updatedTransactions });
            }
        }

        // 3. If we are here, we didn't find/update the commission in the current buyer
        // (It's either a new commission or transferred from another buyer)
        if (commission > 0 && buyerName) {
            // Find current buyer doc in state
            const buyerClient = clients.find(c => c.name === buyerName);

            const newTransaction: Transaction = {
                id: `${Date.now()}_comm`,
                entityId: entityId, // Link to entity
                amount: -commission,
                notes: `عمولة 0.5% عن جلسة بتاريخ ${formatDate(auctionDate)}`,
                date: auctionDate || Timestamp.now(),
                isSettled: true,
                items: []
            };

            if (buyerClient) {
                // Add to existing buyer
                await updateDoc(doc(db, 'advanceClients', buyerClient.id), {
                    transactions: [...buyerClient.transactions, newTransaction],
                    isBuyer: true // Ensure marked as buyer
                });
            } else {
                // Create new buyer client
                await addDoc(collection(db, 'advanceClients'), {
                    userId: user.uid,
                    name: buyerName,
                    isBuyer: true,
                    transactions: [newTransaction]
                });
            }
        }
    };


    const addOrUpdateEntity = async (entityData: { name: string; buyerName: string; auctionDate: string }) => {
        const trimmedName = entityData.name.trim();
        if (!user || !trimmedName) {
            alert("يرجى إدخال اسم صحيح للجهة.");
            return;
        }

        try {
            if (!entityData.auctionDate) {
                throw new Error("Date string is missing.");
            }
            const utcDate = new Date(`${entityData.auctionDate}T00:00:00.000Z`);
            if (isNaN(utcDate.getTime())) {
                throw new Error(`Invalid date created from string: ${entityData.auctionDate}`);
            }

            const firestoreTimestamp = Timestamp.fromDate(utcDate);

            if (editingEntity) {
                // Update existing entity
                const entityRef = doc(db, 'entities', editingEntity.id);
                const updatedData = {
                    name: trimmedName,
                    buyerName: entityData.buyerName || '',
                    auctionDate: firestoreTimestamp,
                };
                await updateDoc(entityRef, updatedData);

                // SYNC COMMISSION (Buyer might have changed)
                // We need to pass the full entity object including lots to sync function
                const fullEntityData: Entity = {
                    ...editingEntity,
                    ...updatedData
                };
                await syncBuyerCommission(fullEntityData);

            } else {
                // Add new entity
                const dataToSave = {
                    userId: user.uid,
                    name: trimmedName,
                    buyerName: entityData.buyerName || '',
                    auctionDate: firestoreTimestamp,
                    lots: [],
                };
                // We don't sync commission here because a new entity has 0 lots => 0 commission
                await addDoc(collection(db, 'entities'), dataToSave);
            }

            setEntityModalOpen(false);
            setEditingEntity(null);

        } catch (error) {
            console.error("CRITICAL: Firestore save failed in addOrUpdateEntity.", error);
            alert(`فشلت عملية الحفظ بشكل غير متوقع. الخطأ: ${String(error)}`);
        }
    };

    const addOrUpdateLot = async (lotData: any, entityId: string) => {
        if (!user) return;
        const entityRef = doc(db, 'entities', entityId);
        const entity = entities.find(e => e.id === entityId);
        if (!entity) return;

        const newLotData: Partial<Lot> = {
            lotNumber: lotData.lotNumber,
            name: lotData.name,
            quantity: lotData.quantity,
            totalValue: lotData.totalValue || 0,
            value30: lotData.value30 || 0,
            value70: (lotData.totalValue || 0) - (lotData.value30 || 0),
            // Only include contractImage if it exists (Firestore doesn't accept undefined)
            ...(lotData.contractImage && { contractImage: lotData.contractImage })
        };

        const updatedLots = editingLot
            ? entity.lots.map(l => l.id === editingLot.id ? { ...l, ...newLotData } : l)
            : [...(entity.lots || []), { ...newLotData, id: `${Date.now()}`, isArchived: false } as Lot];

        try {
            await updateDoc(entityRef, { lots: updatedLots });

            // SYNC COMMISSION
            const updatedEntity: Entity = { ...entity, lots: updatedLots as Lot[] };
            await syncBuyerCommission(updatedEntity);

            setLotModalOpen(false);
            setEditingLot(null);
            setCurrentEntity(null);
        } catch (error) {
            console.error("Error adding/updating lot:", error);
        }
    };

    const handleSupplySave = async (data: { payerName: string; date: Date; receiptImage?: { name: string; url: string } }) => {
        if (!supplyTarget || !user) return;

        const entityRef = doc(db, 'entities', supplyTarget.entityId);
        const entity = entities.find(e => e.id === supplyTarget.entityId);
        if (!entity) return;

        const paymentDetails: PaymentDetails = {
            payerName: data.payerName,
            date: Timestamp.fromDate(data.date),
            receiptImage: data.receiptImage || null
        };

        let updatedLots: Lot[] = [];

        if (supplyTarget.type === 'lot' && supplyTarget.lotId) {
            updatedLots = entity.lots.map(l =>
                l.id === supplyTarget.lotId ? { ...l, is70Paid: true, paymentDetails: paymentDetails } : l
            );
        } else if (supplyTarget.type === 'entity') {
            updatedLots = entity.lots.map(l =>
                !l.is70Paid ? { ...l, is70Paid: true, paymentDetails: paymentDetails } : l
            );
        } else {
            return;
        }

        try {
            await updateDoc(entityRef, { lots: updatedLots });
            setSupplyModalOpen(false);
            setSupplyTarget(null);
        } catch (error) {
            console.error("Error updating supply payment:", error);
            alert("حدث خطأ أثناء حفظ التوريد");
        }
    };

    const handleLoadingSave = async (data: { loaderName: string; date: Date }) => {
        if (!loadingTarget || !user) return;

        const entityRef = doc(db, 'entities', loadingTarget.entityId);
        const entity = entities.find(e => e.id === loadingTarget.entityId);
        if (!entity) return;

        const loadingDetails: LoadingDetails = {
            loaderName: data.loaderName,
            date: Timestamp.fromDate(data.date),
        };

        let updatedLots: Lot[];

        if (loadingTarget.lotId) {
            updatedLots = entity.lots.map(l =>
                l.id === loadingTarget.lotId
                    ? { ...l, isArchived: true, loadingDetails: loadingDetails }
                    : l
            );
        } else {
            updatedLots = entity.lots.map(l => ({
                ...l,
                isArchived: true,
                loadingDetails: loadingDetails
            }));
        }

        try {
            await updateDoc(entityRef, { lots: updatedLots });
            // SYNC COMMISSION (If archiving affects commission, which depends on business logic. 
            // Assuming commission is based on ALL purchased lots, archiving usually shouldn't reduce commission 
            // unless commission is only on ACTIVE lots. 
            // The user said "total value of purchased lots", which implies all. 
            // However, my calculation uses `!l.isArchived`.
            // If commission should include archived lots, I should remove that filter.
            // For now, I will follow the logic that "Archive" means "Done/History" but might still count for commission.
            // Re-reading: "Calculate ... and add as credit". 
            // If I archive, the calculation logic `!l.isArchived` will REDUCE commission. 
            // This effectively "refunds" the commission if I archive.
            // Let's assume "Archive" means it's done and we shouldn't change the commission anymore.
            // So I will NOT call sync here to avoid changing commission when archiving.

            setIsLoadingModalOpen(false);
            setLoadingTarget(null);
        } catch (error) {
            console.error("Error updating loading details:", error);
            alert("حدث خطأ أثناء حفظ بيانات التحميل");
        }
    };

    const openConfirmDeleteLotModal = (entityId: string, lotId: string) => {
        setLotToDelete({ entityId, lotId });
        setConfirmDeleteLotModalOpen(true);
    };

    const handleConfirmDeleteLot = async () => {
        if (!lotToDelete) return;
        const { entityId, lotId } = lotToDelete;
        const entityRef = doc(db, 'entities', entityId);
        const entity = entities.find(e => e.id === entityId);

        if (!entity) {
            alert("لم يتم العثور على الجهة.");
            setConfirmDeleteLotModalOpen(false);
            setLotToDelete(null);
            return;
        }

        const updatedLots = entity.lots.filter(l => l.id !== lotId);

        try {
            await updateDoc(entityRef, { lots: updatedLots });

            // SYNC COMMISSION
            const updatedEntity: Entity = { ...entity, lots: updatedLots };
            await syncBuyerCommission(updatedEntity);

        } catch (error) {
            console.error("Error deleting lot:", error);
            alert(`فشل حذف اللوط. الخطأ: ${error}`);
        } finally {
            setConfirmDeleteLotModalOpen(false);
            setLotToDelete(null);
        }
    };


    const toggleLotArchive = async (lot: Lot, entityId: string) => {
        // FIX: Use Firebase v9 modular syntax to get a document reference.
        const entityRef = doc(db, 'entities', entityId);
        const entity = entities.find(e => e.id === entityId);
        if (!entity) return;

        const updatedLots = entity.lots.map(l =>
            l.id === lot.id ? { ...l, isArchived: !l.isArchived } : l
        );

        // FIX: Use Firebase v9 modular syntax for updating a document.
        await updateDoc(entityRef, { lots: updatedLots });

        // SYNC COMMISSION
        // Because my commission calc depends on !isArchived, toggling archive WILL change commission.
        const updatedEntity: Entity = { ...entity, lots: updatedLots };
        await syncBuyerCommission(updatedEntity);
    };

    const openConfirmDeleteModal = (entityId: string) => {
        setEntityToDeleteId(entityId);
        setConfirmDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!entityToDeleteId) return;
        try {
            await deleteDoc(doc(db, 'entities', entityToDeleteId));
            // Note: We could also remove the commission transaction here, but that requires finding it.
            // Given simpler requirements, we'll leave the transaction history unless explicitly asked to delete.
        } catch (error) {
            console.error("Error deleting entity:", error);
            alert(`فشل حذف الجهة. الخطأ: ${error}`);
        } finally {
            setConfirmDeleteModalOpen(false);
            setEntityToDeleteId(null);
        }
    };


    const addPredefinedItem = async () => {
        if (!newPredefinedItemName.trim() || !user) return;
        try {
            // FIX: Use Firebase v9 modular syntax for adding a document.
            await addDoc(collection(db, 'predefinedItems'), {
                userId: user.uid,
                name: newPredefinedItemName.trim(),
            });
            setNewPredefinedItemName('');
            setPredefinedItemModalOpen(false);
        } catch (error) {
            console.error("Error adding predefined item:", error);
        }
    };

    const addPredefinedBuyer = async () => {
        const newBuyerName = newPredefinedBuyerName.trim();
        if (!newBuyerName || !user) return;
        try {
            // 1. Add to predefinedBuyers list
            await addDoc(collection(db, 'predefinedBuyers'), {
                userId: user.uid,
                name: newBuyerName,
            });

            // 2. Check if an Advance Client with this name already exists
            const q = query(
                collection(db, 'advanceClients'),
                where('userId', '==', user.uid),
                where('name', '==', newBuyerName)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // 3. If not exists, create a new Advance Client marked as isBuyer
                await addDoc(collection(db, 'advanceClients'), {
                    userId: user.uid,
                    name: newBuyerName,
                    transactions: [],
                    isBuyer: true // Mark this as a Buyer Account
                });
            }

            setNewPredefinedBuyerName('');
            setPredefinedBuyerModalOpen(false);
        } catch (error) {
            console.error("Error adding predefined buyer:", error);
            alert("حدث خطأ أثناء إضافة المشتري");
        }
    };

    const handlePrint = (htmlContent: string) => {
        const printWindow = window.open('', '_blank', 'width=900,height=700');

        if (!printWindow) {
            alert("يرجى السماح بفتح النوافذ المنبثقة (Popups)");
            return;
        }

        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl">
                <head>
                    <title>تصدير PDF</title>
                    <script>
                        const originalWarn = console.warn;
                        console.warn = (...args) => {
                            if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
                            originalWarn.apply(console, args);
                        };
                    </script>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                        body {
                            font-family: 'Cairo', sans-serif;
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            #imageModal {
                                display: none !important;
                            }
                        }
                        #imageModal {
                            display: none;
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background-color: rgba(0, 0, 0, 0.9);
                            z-index: 9999;
                            justify-content: center;
                            align-items: center;
                        }
                        #imageModal.active {
                            display: flex;
                        }
                        #imageModal img {
                            max-width: 90%;
                            max-height: 90%;
                            object-fit: contain;
                        }
                        #imageModal .close-btn {
                            position: absolute;
                            top: 20px;
                            right: 20px;
                            color: white;
                            font-size: 40px;
                            font-weight: bold;
                            cursor: pointer;
                            background: rgba(0, 0, 0, 0.5);
                            width: 50px;
                            height: 50px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: background 0.3s;
                        }
                        #imageModal .close-btn:hover {
                            background: rgba(0, 0, 0, 0.8);
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                    
                    <!-- Image Modal -->
                    <div id="imageModal" onclick="closeImageModal()">
                        <span class="close-btn" onclick="closeImageModal()">&times;</span>
                        <img id="modalImage" src="" alt="" onclick="event.stopPropagation()">
                    </div>

                    <script>
                    function openImageModal(imageUrl, imageName) {
                        const modal = document.getElementById('imageModal');
                        const modalImg = document.getElementById('modalImage');
                        modal.classList.add('active');
                        modalImg.src = imageUrl;
                        modalImg.alt = imageName;
                    }

                    function closeImageModal() {
                        const modal = document.getElementById('imageModal');
                        modal.classList.remove('active');
                    }

                    // Close modal on Escape key
                    document.addEventListener('keydown', function(event) {
                        if (event.key === 'Escape') {
                            closeImageModal();
                        }
                    });

                    // Wait for all images to load before printing
                    window.onload = function() {
                        const images = document.getElementsByTagName('img');
                        let loadedCount = 0;
                        const totalImages = images.length;

                        if (totalImages === 0) {
                            window.print();
                            return;
                        }

                        function checkAllLoaded() {
                            loadedCount++;
                            if (loadedCount === totalImages) {
                                setTimeout(() => {
                                    window.print();
                                }, 500);
                            }
                        }

                        for (let i = 0; i < totalImages; i++) {
                            if (images[i].complete) {
                                checkAllLoaded();
                            } else {
                                images[i].onload = checkAllLoaded;
                                images[i].onerror = checkAllLoaded;
                            }
                        }

                        // Fallback: Force print after 10 seconds if images hang
                        setTimeout(() => {
                            if (loadedCount < totalImages) {
                                window.print();
                            }
                        }, 10000);
                    };
                </script>
            </body>
        </html>
        `);
        printWindow.document.close();
        printWindow.focus();
    };

    const generateTransactionHTML = (client: Client, transaction: Transaction, exportDate: string): string => {
        const itemsHTML = transaction.items && transaction.items.length > 0 ? `
            <section class="mb-10 flex-grow">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                    <h3 class="text-lg font-bold text-slate-800">تفاصيل الأصناف</h3>
                </div>
                <div class="rounded-xl border border-slate-200 overflow-hidden">
                    <table class="w-full text-right">
                        <thead>
                            <tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <th class="p-4 text-xs font-bold uppercase tracking-wider">الصنف</th>
                                <th class="p-4 text-xs font-bold uppercase tracking-wider">الكمية (كجم)</th>
                                <th class="p-4 text-xs font-bold uppercase tracking-wider">سعر الكيلو</th>
                                <th class="p-4 text-xs font-bold uppercase tracking-wider text-center">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${transaction.items.map((item, index) => `
                                <tr class="hover:bg-slate-50/50 transition-colors">
                                    <td class="p-4 text-slate-700 font-medium">${item.name}</td>
                                    <td class="p-4 text-slate-600 font-mono text-sm">${item.quantity}</td>
                                    <td class="p-4 text-slate-600 font-mono text-sm">${formatCurrency(item.pricePerKilo)}</td>
                                    <td class="p-4 text-slate-900 font-bold text-center font-mono text-sm bg-slate-50/30">
                                        ${formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        ` : '';

        const notesHTML = transaction.notes ? `
            <section class="mb-10 bg-amber-50 p-5 rounded-xl border border-amber-100 flex gap-4 items-start">
                <span class="text-2xl">📝</span>
                <div>
                    <h3 class="text-sm font-bold text-amber-800 mb-1">ملاحظات</h3>
                    <p class="text-amber-900 text-sm leading-relaxed">${transaction.notes}</p>
                </div>
            </section>
        ` : '';

        const imagesHTML = transaction.items?.some(item => item.image && item.image.url) ? `
            <section class="mb-10 break-inside-avoid">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                    <h3 class="text-lg font-bold text-slate-800">الصور المرفقة</h3>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    ${transaction.items
                .filter(item => item.image && item.image.url)
                .map(item => `
                            <div class="group relative border border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition-shadow break-inside-avoid">
                                <div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
                                    <img 
                                        src="${getDirectImageUrl(item.image.url)}"
                                        alt="${item.name}"
                                        class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                        onerror="this.style.display='none'"
                                        referrerpolicy="no-referrer"
                                        onclick="openImageModal(this.src, '${item.name}')"
                                    />
                                </div>
                                <p class="text-center text-xs text-slate-500 mt-2 font-semibold">${item.name}</p>
                            </div>
                        `).join('')}
                </div>
            </section>
        ` : '';

        const transactionImageHTML = transaction.image && transaction.image.url ? `
            <section class="mb-10 break-inside-avoid">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-1 h-6 bg-purple-600 rounded-full"></div>
                    <h3 class="text-lg font-bold text-slate-800">صورة الحركة</h3>
                </div>
                <div class="border border-slate-200 rounded-xl p-3 bg-white shadow-sm hover:shadow-md transition-shadow max-w-md mx-auto">
                    <a href="${getDirectImageUrl(transaction.image.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
                        <div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
                            <img 
                                src="${getDirectImageUrl(transaction.image.url)}"
                                alt="صورة الحركة"
                                class="w-full h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onerror="this.style.display='none'"
                                referrerpolicy="no-referrer"
                            />
                        </div>
                        <p class="text-center text-xs text-blue-600 mt-2 font-medium">↗ انقر للعرض بحجم كامل</p>
                        <p class="text-center text-xs text-gray-400 mt-1 break-all px-1" style="font-size: 7px; line-height: 1.2; word-break: break-all;">
                            ${getDirectImageUrl(transaction.image.url)}
                        </p>
                    </a>
                </div>
            </section>
        ` : '';

        return `
            <div class="bg-white font-sans min-h-screen flex flex-col" dir="rtl" style="max-width: 210mm; margin: 0 auto; padding: 40px;">
                <header class="mb-10 flex justify-between items-start border-b-2 border-slate-100 pb-8">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
                                </svg>
                            </div>
                            <h1 class="text-2xl font-bold text-slate-900">العبارة للتجارة والتوريدات</h1>
                        </div>
                        <p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                    </div>
                    <div class="text-left">
                        <span class="inline-block bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
                            كشف حساب حركة
                        </span>
                        <p class="text-slate-400 text-xs font-medium">${exportDate}</p>
                    </div>
                </header>

                <div class="grid grid-cols-2 gap-8 mb-10">
                    <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">العميل</h3>
                        <p class="text-2xl font-bold text-slate-800">${client.name}</p>
                    </div>
                    <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <h3 class="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">تفاصيل الحركة</h3>
                        <div class="flex flex-col gap-1">
                            <div class="flex justify-between items-center">
                                <span class="text-blue-700 text-sm">التاريخ</span>
                                <span class="text-blue-900 font-bold">${formatDate(transaction.date)}</span>
                            </div>
                            <div class="flex justify-between items-center mt-2 pt-2 border-t border-blue-200">
                                <span class="text-blue-700 text-sm">القيمة الإجمالية</span>
                                <span class="text-2xl font-black text-blue-900" dir="ltr">${formatCurrency(transaction.amount)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                ${itemsHTML}
                ${notesHTML}
                ${imagesHTML}
                ${transactionImageHTML}

                <footer class="mt-auto pt-8 border-t border-slate-100 flex flex-col items-center gap-2">
                    <div class="flex items-center gap-2 text-slate-400">
                        <span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        <span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        <span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                    </div>
                    <p class="text-slate-400 text-xs font-medium">تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
                </footer>
            </div>
        `;
    };

    const generateEntitiesSummaryHTML = (entities: Entity[], exportDate: string): string => {
        // Calculate overall metrics
        const allLots = entities.flatMap(e => (e.lots || []).filter(l => !l.isArchived));
        const totalInvoices = allLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
        const total30 = allLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
        const total70 = allLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);
        const remainingToSupply = allLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);

        // Aggregate shippers data
        const shippersMap = new Map<string, { lotsCount: number; initialBalance: number }>();
        allLots.forEach(lot => {
            if (lot.loadingDetails?.loaderName) {
                const loaderName = lot.loadingDetails.loaderName;
                const existing = shippersMap.get(loaderName) || { lotsCount: 0, initialBalance: 0 };
                shippersMap.set(loaderName, {
                    lotsCount: existing.lotsCount + 1,
                    initialBalance: existing.initialBalance + (lot.value30 || 0)
                });
            }
        });

        // Convert shippers map to array and sort by name
        const shippersArray = Array.from(shippersMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

        // Generate shippers HTML
        const shippersHTML = shippersArray.length > 0 ? `
            <section class="mb-10">
                <div class="flex items-center gap-2 mb-6">
                    <div class="w-1 h-8 bg-green-600 rounded-full"></div>
                    <h2 class="text-2xl font-bold text-slate-800">صف الشاحنين</h2>
                </div>
                <div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                    <table class="w-full text-right">
                        <thead>
                            <tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
                                <th class="p-3 text-xs font-bold uppercase">#</th>
                                <th class="p-3 text-xs font-bold uppercase">اسم الشاحن</th>
                                <th class="p-3 text-xs font-bold uppercase">الرصيد المبدئي</th>
                                <th class="p-3 text-xs font-bold uppercase text-center">عدد الحركات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shippersArray.map((shipper, index) => `
                                <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                                    <td class="p-4 text-slate-800 font-bold text-base">${index + 1}</td>
                                    <td class="p-4 text-slate-700 font-medium text-lg">${shipper.name}</td>
                                    <td class="p-4 font-black text-purple-700 text-lg" dir="ltr">${formatCurrency(shipper.initialBalance)}</td>
                                    <td class="p-4 text-center font-bold text-blue-700 text-lg">${shipper.lotsCount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        ` : '';

        const entitiesHTML = entities.map(entity => {
            const activeLots = (entity.lots || []).filter(l => !l.isArchived);
            if (activeLots.length === 0) return '';

            const entityTotal = activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
            const entity30 = activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
            const entity70 = activeLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);
            const entityRemaining = activeLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);

            const lotsHTML = sortLotsByNumber(activeLots).map(lot => `
                <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                    <td class="p-4 text-slate-800 font-bold text-base">${lot.lotNumber}</td>
                    <td class="p-4 text-slate-700 font-medium">${lot.name}</td>
                    <td class="p-4 text-slate-600 font-semibold text-base">${lot.quantity || '-'}</td>
                    <td class="p-4 font-black text-blue-700 text-lg" dir="ltr">${formatCurrency(lot.totalValue)}</td>
                    <td class="p-4 font-black text-purple-700 text-lg" dir="ltr">${formatCurrency(lot.value30)}</td>
                    <td class="p-4 font-black text-orange-700 text-lg" dir="ltr">${formatCurrency(lot.value70)}</td>
                    <td class="p-4 text-center">
                        ${lot.is70Paid
                    ? `<span class="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700">تم السداد</span>
                               ${lot.paymentDetails?.payerName ? `<div class="text-xs text-slate-500 mt-1">بواسطة: ${lot.paymentDetails.payerName}</div>` : ''}`
                    : `<span class="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700">لم يتم السداد</span>`
                }
                    </td>
                </tr>
            `).join('');

            return `
                <div class="mb-8 break-inside-avoid">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-xl p-4 text-white">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h3 class="text-2xl font-black mb-2">${entity.name}</h3>
                                ${entity.buyerName ? `<p class="text-base text-white/90 mb-2">المشتري: ${entity.buyerName}</p>` : ''}
                                <div class="flex flex-col gap-1">
                                    <p class="text-sm text-white/80">ميعاد الجلسة: ${formatSpecificDateTime(entity.auctionDate)}</p>
                                    ${(() => {
                    if (entity.auctionDate && typeof entity.auctionDate.toMillis === 'function') {
                        const deadlineDate = new Date(entity.auctionDate.toMillis());
                        deadlineDate.setDate(deadlineDate.getDate() + 15);
                        const allPaid = activeLots.every(l => l.is70Paid);
                        return `<p class="text-base font-bold ${allPaid ? 'text-green-300' : 'text-amber-300'} mt-1">آخر ميعاد للدفع: ${allPaid ? 'تم السداد ✓' : formatDate(Timestamp.fromDate(deadlineDate))}</p>`;
                    }
                    return '';
                })()}
                                </div>
                            </div>
                            <div class="text-center bg-white/10 rounded-lg px-6 py-4">
                                <div class="text-xs text-white/70 uppercase mb-1">عدد اللوطات</div>
                                <div class="text-4xl font-black">${activeLots.length}</div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-gradient-to-br from-slate-50 to-blue-50 grid grid-cols-2 gap-6 p-6 border-x border-slate-200">
                        <div class="bg-white rounded-lg p-4 shadow-sm border-r-4 border-blue-500">
                            <p class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي القيمة</p>
                            <p class="font-black text-blue-700 text-2xl" dir="ltr">${formatCurrency(entityTotal)}</p>
                        </div>
                        <div class="bg-white rounded-lg p-4 shadow-sm border-r-4 border-purple-500">
                            <p class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 30%</p>
                            <p class="font-black text-purple-700 text-2xl" dir="ltr">${formatCurrency(entity30)}</p>
                        </div>
                        <div class="bg-white rounded-lg p-4 shadow-sm border-r-4 border-orange-500">
                            <p class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 70%</p>
                            <p class="font-black text-orange-700 text-2xl" dir="ltr">${formatCurrency(entity70)}</p>
                        </div>
                        <div class="bg-white rounded-lg p-4 shadow-sm border-r-4 ${entityRemaining > 0 ? 'border-red-500' : 'border-green-500'}">
                            <p class="text-xs text-slate-500 font-bold uppercase mb-2">المتبقي</p>
                            <p class="font-black ${entityRemaining > 0 ? 'text-red-700' : 'text-green-700'} text-2xl" dir="ltr">${formatCurrency(entityRemaining)}</p>
                        </div>
                    </div>

                    <div class="border border-slate-200 rounded-b-xl overflow-hidden">
                        <table class="w-full text-right">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
                                    <th class="p-3 text-xs font-bold uppercase">رقم اللوط</th>
                                    <th class="p-3 text-xs font-bold uppercase">المسمى</th>
                                    <th class="p-3 text-xs font-bold uppercase">الكمية</th>
                                    <th class="p-3 text-xs font-bold uppercase">الإجمالي</th>
                                    <th class="p-3 text-xs font-bold uppercase">30%</th>
                                    <th class="p-3 text-xs font-bold uppercase">70%</th>
                                    <th class="p-3 text-xs font-bold uppercase text-center">حالة السداد</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lotsHTML}
                            </tbody>
                        </table>
                    </div>

                    ${(() => {
                    const lotsWithImages = activeLots.filter(lot => lot.contractImage && lot.contractImage.url);
                    if (lotsWithImages.length === 0) return '';

                    return `
                            <div class="mt-6">
                                <div class="flex items-center gap-2 mb-4">
                                    <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                                    <h4 class="text-lg font-bold text-slate-800">صور العقود المرفقة</h4>
                                </div>
                                <div class="grid grid-cols-3 gap-4">
                                    ${lotsWithImages.map(lot => `
                                        <div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition-shadow">
                                            <div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
                                                <img 
                                                    src="${getDirectImageUrl(lot.contractImage.url)}"
                                                    alt="عقد ${lot.name}"
                                                    class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                    onerror="this.style.display='none'"
                                                    referrerpolicy="no-referrer"
                                                    onclick="openImageModal(this.src, 'عقد ${lot.name}')"
                                                />
                                            </div>
                                            <p class="text-center text-xs text-slate-500 mt-2 font-semibold">لوط ${lot.lotNumber} - ${lot.name}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                })()}
                </div>
            `;
        }).filter(html => html).join('');

        return `
            <div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
                <header class="mb-10 flex justify-between items-start border-b-2 border-slate-200 pb-8">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
                                </svg>
                            </div>
                            <h1 class="text-3xl font-black text-slate-900">العبارة للتجارة والتوريدات</h1>
                        </div>
                        <p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                    </div>
                    <div class="text-left">
                        <span class="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg mb-2 shadow-lg">
                            ملخص حساب الجهات
                        </span>
                        <p class="text-slate-400 text-xs font-medium">${exportDate}</p>
                    </div>
                </header>

                <section class="mb-10">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-blue-500">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي الفواتير</div>
                            <div class="text-3xl font-black text-blue-700" dir="ltr">${formatCurrency(totalInvoices)}</div>
                        </div>
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-purple-500">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي 30%</div>
                            <div class="text-3xl font-black text-purple-700" dir="ltr">${formatCurrency(total30)}</div>
                        </div>
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-orange-500">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي 70%</div>
                            <div class="text-3xl font-black text-orange-700" dir="ltr">${formatCurrency(total70)}</div>
                        </div>
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 ${remainingToSupply > 0 ? 'border-red-500' : 'border-green-500'}">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">المتبقي للسداد</div>
                            <div class="text-3xl font-black ${remainingToSupply > 0 ? 'text-red-700' : 'text-green-700'}" dir="ltr">${formatCurrency(remainingToSupply)}</div>
                        </div>
                    </div>
                </section>

                ${shippersHTML}

                <section>
                    <div class="flex items-center gap-2 mb-6">
                        <div class="w-1 h-8 bg-blue-600 rounded-full"></div>
                        <h2 class="text-2xl font-bold text-slate-800">تفاصيل الجهات واللوطات</h2>
                    </div>
                    ${entitiesHTML}
                </section>

                <footer class="mt-16 pt-8 border-t-2 border-slate-200 text-center text-slate-400 text-xs">
                    <p class="font-medium">العبارة للتجارة والتوريدات © ${new Date().getFullYear()}</p>
                    <p class="mt-1">تم إنشاء هذا المستند تلقائياً بواسطة نظام إدارة المزادات</p>
                </footer>
            </div>
        `;
    };

    const generateSingleEntityHTML = (entity: Entity, exportDate: string): string => {
        const activeLots = (entity.lots || []).filter(l => !l.isArchived);
        const entityTotal = activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
        const entity30 = activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
        const entity70 = activeLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);
        const entityRemaining = activeLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);

        const lotsHTML = sortLotsByNumber(activeLots).map(lot => `
            <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                <td class="p-4 text-slate-800 font-bold text-base">${lot.lotNumber}</td>
                <td class="p-4 text-slate-700 font-medium">${lot.name}</td>
                <td class="p-4 text-slate-600 font-semibold text-base">${lot.quantity || '-'}</td>
                <td class="p-4 font-black text-blue-700 text-lg" dir="ltr">${formatCurrency(lot.totalValue)}</td>
                <td class="p-4 font-black text-purple-700 text-lg" dir="ltr">${formatCurrency(lot.value30)}</td>
                <td class="p-4 font-black text-orange-700 text-lg" dir="ltr">${formatCurrency(lot.value70)}</td>
                <td class="p-4 text-center">
                    ${lot.is70Paid
                ? `<span class="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700">تم السداد</span>
                           ${lot.paymentDetails?.payerName ? `<div class="text-xs text-slate-500 mt-1">بواسطة: ${lot.paymentDetails.payerName}</div>` : ''}`
                : `<span class="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700">لم يتم السداد</span>`
            }
                </td>
            </tr>
        `).join('');

        return `
            <div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
                <header class="mb-10 flex justify-between items-start border-b-2 border-slate-200 pb-8">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
                                </svg>
                            </div>
                            <h1 class="text-3xl font-black text-slate-900">العبارة للتجارة والتوريدات</h1>
                        </div>
                        <p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                    </div>
                    <div class="text-left">
                        <span class="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg mb-2 shadow-lg">
                            تقرير جهة
                        </span>
                        <p class="text-slate-400 text-xs font-medium">${exportDate}</p>
                    </div>
                </header>

                <section class="mb-8">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-xl">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h2 class="text-3xl font-black mb-2">${entity.name}</h2>
                                ${entity.buyerName ? `<p class="text-lg text-white/90 mb-2">المشتري: ${entity.buyerName}</p>` : ''}
                                <div class="flex flex-col gap-1">
                                    <p class="text-sm text-white/80">ميعاد الجلسة: ${formatSpecificDateTime(entity.auctionDate)}</p>
                                    ${(() => {
                if (entity.auctionDate && typeof entity.auctionDate.toMillis === 'function') {
                    const deadlineDate = new Date(entity.auctionDate.toMillis());
                    deadlineDate.setDate(deadlineDate.getDate() + 15);
                    const allPaid = activeLots.every(l => l.is70Paid);
                    return `<p class="text-base font-bold ${allPaid ? 'text-green-300' : 'text-amber-300'} mt-1">آخر ميعاد للدفع: ${allPaid ? 'تم السداد ✓' : formatDate(Timestamp.fromDate(deadlineDate))}</p>`;
                }
                return '';
            })()}
                                </div>
                            </div>
                            <div class="text-center bg-white/10 rounded-lg px-6 py-4">
                                <div class="text-sm text-white/70 uppercase mb-1">عدد اللوطات</div>
                                <div class="text-5xl font-black">${activeLots.length}</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="mb-8">
                    <div class="grid grid-cols-2 gap-6">
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-blue-500">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">إجمالي القيمة</div>
                            <div class="text-3xl font-black text-blue-700" dir="ltr">${formatCurrency(entityTotal)}</div>
                        </div>
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-purple-500">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 30%</div>
                            <div class="text-3xl font-black text-purple-700" dir="ltr">${formatCurrency(entity30)}</div>
                        </div>
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 border-orange-500">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">قيمة 70%</div>
                            <div class="text-3xl font-black text-orange-700" dir="ltr">${formatCurrency(entity70)}</div>
                        </div>
                        <div class="bg-white rounded-lg p-6 shadow-lg border-r-4 ${entityRemaining > 0 ? 'border-red-500' : 'border-green-500'}">
                            <div class="text-xs text-slate-500 font-bold uppercase mb-2">المتبقي</div>
                            <div class="text-3xl font-black ${entityRemaining > 0 ? 'text-red-700' : 'text-green-700'}" dir="ltr">${formatCurrency(entityRemaining)}</div>
                        </div>
                    </div>
                </section>

                <section>
                    <div class="flex items-center gap-2 mb-6">
                        <div class="w-1 h-8 bg-blue-600 rounded-full"></div>
                        <h2 class="text-2xl font-bold text-slate-800">تفاصيل اللوطات</h2>
                    </div>
                    <div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                        <table class="w-full text-right">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
                                    <th class="p-3 text-xs font-bold uppercase">رقم اللوط</th>
                                    <th class="p-3 text-xs font-bold uppercase">المسمى</th>
                                    <th class="p-3 text-xs font-bold uppercase">الكمية</th>
                                    <th class="p-3 text-xs font-bold uppercase">الإجمالي</th>
                                    <th class="p-3 text-xs font-bold uppercase">30%</th>
                                    <th class="p-3 text-xs font-bold uppercase">70%</th>
                                    <th class="p-3 text-xs font-bold uppercase text-center">حالة السداد</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lotsHTML}
                            </tbody>
                        </table>
                    </div>

                    ${(() => {
                const lotsWithImages = activeLots.filter(lot => lot.contractImage && lot.contractImage.url);
                if (lotsWithImages.length === 0) return '';

                return `
                            <div class="mt-6">
                                <div class="flex items-center gap-2 mb-4">
                                    <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                                    <h4 class="text-lg font-bold text-slate-800">صور العقود المرفقة</h4>
                                </div>
                                <div class="grid grid-cols-3 gap-4">
                                    ${lotsWithImages.map(lot => `
                                        <div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition-shadow">
                                            <a href="${getDirectImageUrl(lot.contractImage.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
                                                <div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
                                                    <img 
                                                        src="${getDirectImageUrl(lot.contractImage.url)}"
                                                        alt="عقد ${lot.name}"
                                                        class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                        onerror="this.style.display='none'"
                                                        referrerpolicy="no-referrer"
                                                    />
                                                </div>
                                                <p class="text-center text-xs text-slate-500 mt-2 font-semibold">لوط ${lot.lotNumber} - ${lot.name}</p>
                                                <p class="text-center text-xs text-blue-600 mt-1 font-medium">↗ انقر للعرض بحجم كامل</p>
                                                <p class="text-center text-xs text-gray-400 mt-1 break-all px-1" style="font-size: 7px; line-height: 1.2; word-break: break-all;">
                                                    ${getDirectImageUrl(lot.contractImage.url)}
                                                </p>
                                            </a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
            })()}
                </section>

                <footer class="mt-16 pt-8 border-t-2 border-slate-200 text-center text-slate-400 text-xs">
                    <p class="font-medium">العبارة للتجارة والتوريدات © ${new Date().getFullYear()}</p>
                    <p class="mt-1">تم إنشاء هذا المستند تلقائياً بواسطة نظام إدارة المزادات</p>
                </footer>
            </div>
        `;
    };


    const generateClientSummaryHTML = (client: Client, exportDate: string): string => {
        const total = client.transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
        const sortedTransactions = [...client.transactions].sort((a, b) => {
            const dateA = a.date ? a.date.toMillis() : 0;
            const dateB = b.date ? b.date.toMillis() : 0;
            return dateA - dateB;
        });

        return `
            <div class="bg-white font-sans min-h-screen flex flex-col" dir="rtl" style="max-width: 210mm; margin: 0 auto; padding: 40px;">
                <header class="mb-10 flex justify-between items-start border-b-2 border-slate-100 pb-8">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
                                </svg>
                            </div>
                            <h1 class="text-2xl font-bold text-slate-900">العبارة للتجارة والتوريدات</h1>
                        </div>
                        <p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                    </div>
                    <div class="text-left">
                        <span class="inline-block bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full mb-2">
                            ملخص حساب عميل
                        </span>
                        <p class="text-slate-400 text-xs font-medium">${exportDate}</p>
                    </div>
                </header>

                <section class="mb-10 bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-3xl">
                            👤
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">بيانات العميل</h2>
                            <p class="text-3xl font-black text-slate-800">${client.name}</p>
                        </div>
                    </div>
                </section>
                
                <section class="mb-10 flex-grow">
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                        <h3 class="text-lg font-bold text-slate-800">كشف الحركات</h3>
                    </div>
                    <div class="rounded-xl border border-slate-200 overflow-hidden">
                        <table class="w-full text-right">
                            <thead>
                                <tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <th class="p-4 text-xs font-bold uppercase tracking-wider">التاريخ</th>
                                    <th class="p-4 text-xs font-bold uppercase tracking-wider">البيان</th>
                                    <th class="p-4 text-xs font-bold uppercase tracking-wider text-center">مدين</th>
                                    <th class="p-4 text-xs font-bold uppercase tracking-wider text-center">دائن</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${sortedTransactions.map((t, index) => `
                                    <tr class="hover:bg-slate-50/50 transition-colors">
                                        <td class="p-4 text-slate-700 font-medium whitespace-nowrap">${formatDate(t.date)}</td>
                                        <td class="p-4 text-slate-600">
                                            <span class="inline-block px-2 py-1 rounded text-xs font-medium ${t.amount > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'} mb-1">
                                                ${t.amount > 0 ? 'مشتريات' : 'سداد'}
                                            </span>
                                            <div class="text-sm">${t.notes || (t.amount > 0 ? "حركة مشتريات" : "دفعة سداد")}</div>
                                        </td>
                                        <td class="p-4 text-center font-bold text-slate-800 font-mono text-sm">
                                            ${t.amount > 0 ? formatCurrency(t.amount) : '<span class="text-slate-300">-</span>'}
                                        </td>
                                        <td class="p-4 text-center font-bold text-green-600 font-mono text-sm">
                                            ${t.amount < 0 ? formatCurrency(Math.abs(t.amount)) : '<span class="text-slate-300">-</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
                
                <!-- All Images Section (Consolidated) -->
                ${(() => {
                // Collect all images from different sources
                const allImages = [];

                // 1. Transaction images
                sortedTransactions.forEach(t => {
                    if (t.image && t.image.url) {
                        allImages.push({
                            url: t.image.url,
                            label: `حركة - ${formatDate(t.date)}`,
                            sublabel: formatCurrency(Math.abs(t.amount)),
                            type: 'transaction'
                        });
                    }
                });

                // 2. Item images
                sortedTransactions.forEach(t => {
                    if (t.items && t.items.length > 0) {
                        t.items.forEach(item => {
                            if (item.image && item.image.url) {
                                allImages.push({
                                    url: item.image.url,
                                    label: `صنف - ${item.name}`,
                                    sublabel: formatDate(t.date),
                                    type: 'item'
                                });
                            }
                        });
                    }
                });

                // 3. Receipt images
                sortedTransactions.forEach(t => {
                    if (t.amount < 0 && (t as any).receiptImage && (t as any).receiptImage.url) {
                        allImages.push({
                            url: (t as any).receiptImage.url,
                            label: `إيصال دفع - ${formatDate(t.date)}`,
                            sublabel: formatCurrency(Math.abs(t.amount)),
                            type: 'receipt'
                        });
                    }
                });

                if (allImages.length === 0) return '';

                return `
                        <section class="mb-8 break-inside-avoid">
                            <div class="flex items-center gap-2 mb-4">
                                <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                                <h3 class="text-lg font-bold text-slate-800">جميع الصور المرفقة (${allImages.length})</h3>
                            </div>
                            <div class="grid grid-cols-3 gap-4">
                                ${allImages.map(img => `
                                    <div class="border border-slate-200 rounded-xl p-2 bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <a href="${getDirectImageUrl(img.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
                                            <div class="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden bg-slate-100">
                                                <img 
                                                    src="${getDirectImageUrl(img.url)}"
                                                    alt="${img.label}"
                                                    class="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                    onerror="this.style.display='none'"
                                                    referrerpolicy="no-referrer"
                                                />
                                            </div>
                                            <p class="text-center text-xs text-slate-700 mt-2 font-semibold">${img.label}</p>
                                            <p class="text-center text-xs text-slate-500 mt-0.5">${img.sublabel}</p>
                                            <p class="text-center text-xs text-blue-600 mt-1 font-medium">↗ انقر للعرض بحجم كامل</p>
                                            <p class="text-center text-xs text-gray-400 mt-1 break-all px-1" style="font-size: 7px; line-height: 1.2; word-break: break-all;">
                                                ${getDirectImageUrl(img.url)}
                                            </p>
                                        </a>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
            })()}
                
                <footer class="mt-auto pt-8 border-t border-slate-100">
                    <div class="flex justify-end">
                        <div class="p-8 rounded-2xl shadow-lg ${total >= 0 ? 'bg-gradient-to-br from-red-50 to-white border border-red-100' : 'bg-gradient-to-br from-green-50 to-white border border-green-100'} w-full max-w-md">
                            <div class="flex justify-between items-center mb-4">
                                <span class="text-sm font-bold uppercase tracking-wider ${total >= 0 ? 'text-red-600' : 'text-green-600'}">
                                    الرصيد النهائي ${total >= 0 ? '(مدين)' : '(دائن)'}
                                </span>
                                <span class="text-2xl">${total >= 0 ? '📉' : '✅'}</span>
                            </div>
                            <div class="flex items-baseline justify-between border-t border-black/5 pt-4">
                                <span class="text-slate-500 text-sm">الإجمالي المستحق</span>
                                <div class="text-4xl font-black tracking-tight ${total >= 0 ? 'text-red-800' : 'text-green-800'}" dir="ltr">
                                    ${formatCurrency(Math.abs(total))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-center gap-2 mt-12">
                        <div class="flex items-center gap-2 text-slate-400">
                            <span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                            <span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                            <span class="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                        </div>
                        <p class="text-slate-400 text-xs font-medium">تم استخراج هذا المستند إلكترونياً من نظام العبارة للتجارة والتوريدات</p>
                    </div>
                </footer>
            </div>
        `;
    };

    const generateAllClientsHTML = (clientsList: Client[], title: string, exportDate: string): string => {
        const totalBalance = clientsList.reduce((sum, client) => {
            const clientBalance = client.transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
            return sum + clientBalance;
        }, 0);

        const clientsHTML = clientsList.map(client => {
            const balance = client.transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
            const lastTransaction = client.transactions.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0))[0];

            return `
                <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                    <td class="p-4 text-slate-800 font-bold">${client.name}</td>
                    <td class="p-4 text-slate-600 text-sm">${lastTransaction ? formatDate(lastTransaction.date) : '-'}</td>
                    <td class="p-4 text-center font-bold font-mono text-sm ${balance >= 0 ? 'text-red-600' : 'text-green-600'}">
                        ${formatCurrency(Math.abs(balance))} ${balance >= 0 ? '(مدين)' : '(دائن)'}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="bg-white font-sans min-h-screen" dir="rtl" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
                <header class="mb-10 flex justify-between items-start border-b-2 border-slate-200 pb-8">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                                <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
                                </svg>
                            </div>
                            <h1 class="text-3xl font-black text-slate-900">العبارة للتجارة والتوريدات</h1>
                        </div>
                        <p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                    </div>
                    <div class="text-left">
                        <span class="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg mb-2 shadow-lg">
                            ${title}
                        </span>
                        <p class="text-slate-400 text-xs font-medium">${exportDate}</p>
                    </div>
                </header>

                <section class="mb-8">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-xl">
                        <div class="flex justify-between items-center">
                            <div>
                                <h2 class="text-3xl font-black mb-2">ملخص الحسابات</h2>
                                <p class="text-lg text-white/90">عدد العملاء: ${clientsList.length}</p>
                            </div>
                            <div class="text-center bg-white/10 rounded-lg px-6 py-4">
                                <div class="text-sm text-white/70 uppercase mb-1">إجمالي الرصيد</div>
                                <div class="text-3xl font-black" dir="ltr">${formatCurrency(Math.abs(totalBalance))}</div>
                                <div class="text-sm font-bold mt-1 ${totalBalance >= 0 ? 'text-red-200' : 'text-green-200'}">
                                    ${totalBalance >= 0 ? '(مدين)' : '(دائن)'}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                        <table class="w-full text-right">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
                                    <th class="p-4 text-xs font-bold uppercase">اسم العميل</th>
                                    <th class="p-4 text-xs font-bold uppercase">آخر حركة</th>
                                    <th class="p-4 text-xs font-bold uppercase text-center">الرصيد الحالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${clientsHTML}
                            </tbody>
                        </table>
                    </div>
                </section>

                <footer class="mt-16 pt-8 border-t-2 border-slate-200 text-center text-slate-400 text-xs">
                    <p class="font-medium">العبارة للتجارة والتوريدات © ${new Date().getFullYear()}</p>
                    <p class="mt-1">تم إنشاء هذا المستند تلقائياً بواسطة نظام إدارة المزادات</p>
                </footer>
            </div>
        `;
    };

    const exportAllAdvanceClients = () => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        const html = generateAllClientsHTML(clients, 'حساب السلف', exportDate);
        handlePrint(html);
    };

    const exportAllWorkClients = () => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        const html = generateAllClientsHTML(workClients, 'حساب الشغل', exportDate);
        handlePrint(html);
    };


    const handleSettleClient = (client: Client, total: number) => {
        setSettleTarget({ client, total });
        setSettleModalOpen(true);
    };

    const confirmSettleAndArchive = async () => {
        if (!settleTarget || !user) return;

        const { client, total } = settleTarget;

        // Determine which collection this client belongs to
        const isAdvanceClient = clients.some(c => c.id === client.id);
        const isWorkClient = workClients.some(c => c.id === client.id);

        let collectionName: string;
        let archiveType: 'entities' | 'work' | 'advances';

        if (isAdvanceClient) {
            collectionName = 'advanceClients';
            archiveType = 'advances';
        } else if (isWorkClient) {
            collectionName = 'workClients';
            archiveType = 'work';
        } else {
            // This shouldn't happen, but handle it gracefully
            alert('خطأ: لم يتم العثور على العميل في أي قائمة');
            setSettleModalOpen(false);
            setSettleTarget(null);
            return;
        }

        try {
            const clientRef = doc(db, collectionName, client.id);

            // Create a balancing transaction to zero out the account
            const balancingTransaction: Transaction = {
                id: `settle_${Date.now()}`,
                amount: -total, // Opposite of current balance to zero it out
                notes: `تسوية نهائية - تم التسديد بالكامل`,
                date: Timestamp.now(),
                isSettled: true,
                items: []
            };

            const updatedTransactions = [...client.transactions, balancingTransaction];

            // Update client: add balancing transaction, mark as archived, set archive type
            await updateDoc(clientRef, {
                transactions: updatedTransactions,
                isArchived: true,
                archiveType: archiveType
            });

            setSettleModalOpen(false);
            setSettleTarget(null);

            alert(`تم تسوية حساب ${client.name} ونقله إلى أرشيف ${archiveType === 'advances' ? 'حساب السلف' : archiveType === 'work' ? 'حساب الشغل' : 'حساب الجهات'}`);
        } catch (error) {
            console.error('Error settling and archiving client:', error);
            alert(`فشل في تسوية الحساب. الخطأ: ${error}`);
        }
    };

    const handleRestoreClient = (client: Client) => {
        setClientToRestore(client);
        setRestoreModalOpen(true);
    };

    const confirmRestoreClient = async () => {
        if (!clientToRestore || !user) return;

        // Determine which collection this client belongs to
        const isAdvanceClient = clients.some(c => c.id === clientToRestore.id);
        const isWorkClient = workClients.some(c => c.id === clientToRestore.id);

        let collectionName: string;

        if (isAdvanceClient) {
            collectionName = 'advanceClients';
        } else if (isWorkClient) {
            collectionName = 'workClients';
        } else {
            alert('خطأ: لم يتم العثور على العميل في أي قائمة');
            setRestoreModalOpen(false);
            setClientToRestore(null);
            return;
        }

        try {
            const clientRef = doc(db, collectionName, clientToRestore.id);

            // Remove archive flags
            await updateDoc(clientRef, {
                isArchived: false,
                archiveType: deleteField() // Remove the field completely
            });

            setRestoreModalOpen(false);
            setClientToRestore(null);

            alert(`تم استرجاع ${clientToRestore.name} من الأرشيف بنجاح`);
        } catch (error) {
            console.error('Error restoring client:', error);
            alert(`فشل في استرجاع العميل. الخطأ: ${error}`);
        }
    };

    const handleExportTransaction = (client: Client, transaction: Transaction) => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        const html = generateTransactionHTML(client, transaction, exportDate);
        handlePrint(html);
    };


    const handleExportClientSummary = (client: Client) => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        const html = generateClientSummaryHTML(client, exportDate);
        handlePrint(html);
    };

    const handleExportEntitiesSummary = () => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        const html = generateEntitiesSummaryHTML(entities, exportDate);
        handlePrint(html);
    };

    const handleExportSingleEntity = (entity: Entity) => {
        const exportDate = formatSpecificDateTime(Timestamp.now());
        const html = generateSingleEntityHTML(entity, exportDate);
        handlePrint(html);
    };

    const handleExportAllClients = (clients: Client[], typeName: string) => {
        const exportDate = formatSpecificDateTime(Timestamp.now());

        const html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تصدير جماعي - ${typeName}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; direction: rtl; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .client-section { page-break-after: always; margin-bottom: 40px; }
                    .client-section:last-child { page-break-after: auto; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>تصدير جماعي - ${typeName}</h1>
                    <p>تاريخ التصدير: ${exportDate}</p>
                    <p>عدد العملاء: ${clients.length}</p>
                </div>
                ${clients.map((client, index) => `
                    <div class="client-section">
                        ${generateClientSummaryHTML(client, exportDate)}
                    </div>
                `).join('')}
            </body>
            </html>
        `;

        handlePrint(html);
    };

    const handleExportArchiveReport = () => {
        const exportDate = formatSpecificDateTime(Timestamp.now());

        const archivedAdvances = clients.filter(c => c.isArchived && c.archiveType === 'advances');
        const archivedWork = workClients.filter(c => c.isArchived && c.archiveType === 'work');
        const archivedLotsCount = entities.reduce((sum, e) => sum + (e.lots?.filter(l => l.isArchived).length || 0), 0);

        // Get all archived lots with their entity information
        const archivedLotsWithEntity = entities.flatMap(entity =>
            (entity.lots || [])
                .filter(lot => lot.isArchived)
                .map(lot => ({ lot, entityName: entity.name, entityBuyer: entity.buyerName }))
        );



        const html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير شامل للأرشيف</title>
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
                    .entity-header { background: #e9ecef; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 تقرير شامل للأرشيف</h1>
                    <p>تاريخ التصدير: ${exportDate}</p>
                </div>
                
                <div class="stats">
                    <h2>الإحصائيات العامة</h2>
                    <ul>
                        <li>إجمالي عملاء السلف المؤرشفين: ${archivedAdvances.length}</li>
                        <li>إجمالي عملاء الشغل المؤرشفين: ${archivedWork.length}</li>
                        <li>إجمالي اللوطات المؤرشفة: ${archivedLotsCount}</li>
                        <li><strong>الإجمالي الكلي: ${archivedAdvances.length + archivedWork.length + archivedLotsCount}</strong></li>
                    </ul>
                </div>

                ${archivedLotsWithEntity.length > 0 ? `
                <div class="section entities">
                    <h2>تفاصيل الجهات واللوطات المؤرشفة</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم الجهة</th>
                                <th>المشتري</th>
                                <th>رقم اللوط</th>
                                <th>المسمى</th>
                                <th>الكمية</th>
                                <th>الإجمالي</th>
                                <th>30%</th>
                                <th>70%</th>
                                <th>الشاحن</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${archivedLotsWithEntity.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.entityName}</td>
                                    <td>${item.entityBuyer || '-'}</td>
                                    <td>${item.lot.lotNumber}</td>
                                    <td>${item.lot.name}</td>
                                    <td>${item.lot.quantity || '-'}</td>
                                    <td>${formatCurrency(item.lot.totalValue)}</td>
                                    <td>${formatCurrency(item.lot.value30)}</td>
                                    <td>${formatCurrency(item.lot.value70)}</td>
                                    <td>${item.lot.loadingDetails?.loaderName || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : ''}
                
                <div class="section">
                    <h2>عملاء السلف المؤرشفين</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم العميل</th>
                                <th>الرصيد النهائي</th>
                                <th>عدد الحركات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${archivedAdvances.map((client, index) => {
            const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
            return `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${client.name}</td>
                                        <td>${formatCurrency(Math.abs(total))} ${total >= 0 ? '(مدين)' : '(دائن)'}</td>
                                        <td>${client.transactions?.length || 0}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2>عملاء الشغل المؤرشفين</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>اسم العميل</th>
                                <th>الرصيد النهائي</th>
                                <th>عدد الحركات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${archivedWork.map((client, index) => {
            const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
            return `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${client.name}</td>
                                        <td>${formatCurrency(Math.abs(total))} ${total >= 0 ? '(مدين)' : '(دائن)'}</td>
                                        <td>${client.transactions?.length || 0}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;

        handlePrint(html);
    };


    // --- Render Logic ---
    if (loading) return null;
    if (showSplash) return <SplashScreen />;

    if (!user) {
        return (
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
                </div>

                <div className="w-full max-w-md relative z-10">
                    {/* Logo and Title */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-2xl shadow-2xl mb-6 animate-pulse">
                            <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
                            </svg>
                        </div>
                        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-3">
                            العبارة للتجارة والتوريدات
                        </h2>
                        <p className="text-slate-400 text-sm">إدارة المزادات والتوريدات العامة</p>
                    </div>

                    {/* Login Card */}
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
                        <p className="text-center text-slate-300 mb-6 text-sm">أهلاً بك، يرجى تسجيل الدخول للمتابعة</p>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-xl mb-6 text-center backdrop-blur-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="email">
                                    البريد الإلكتروني
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all backdrop-blur-sm"
                                    placeholder="example@email.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-slate-300 text-sm font-bold mb-2" htmlFor="password">
                                    كلمة المرور
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all backdrop-blur-sm"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <div className="flex items-center">
                                <label className="flex items-center text-sm text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="form-checkbox h-5 w-5 text-cyan-500 bg-white/10 border-white/20 rounded focus:ring-cyan-500"
                                    />
                                    <span className="mr-2">تذكرني</span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-500/50"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    دخول
                                </span>
                            </button>
                        </form>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-slate-500 text-xs mt-6">
                        © 2024 العبارة للتجارة والتوريدات - جميع الحقوق محفوظة
                    </p>
                </div>
            </div>
        );
    }

    const openTransactionModal = (client: Client, transaction: Transaction | null = null) => {
        setCurrentClient(client);
        setEditingTransaction(transaction);
        setTransactionModalOpen(true);
    };

    const openLotModal = (entity: Entity, lot: Lot | null = null) => {
        setCurrentEntity(entity);
        setEditingLot(lot);
        setLotModalOpen(true);
    };

    const openEntityModal = (entity: Entity | null = null) => {
        setEditingEntity(entity);
        setEntityModalOpen(true);
    };

    const openPaymentModal = (client: Client) => {
        setCurrentClient(client);
        setPaymentModalOpen(true);
    };

    const openSupplyModal = (type: 'lot' | 'entity', entityId: string, lotId?: string) => {
        setSupplyTarget({ type, entityId, lotId });
        setSupplyModalOpen(true);
    };

    const openLoadingModal = (entityId: string, lotId?: string) => {
        setLoadingTarget({ entityId, lotId });
        setIsLoadingModalOpen(true);
    };


    const renderContent = () => {
        switch (viewMode) {
            case 'dashboard':
                return <DashboardView
                    onNavigate={setViewMode}
                    entities={entities}
                    clients={clients.filter(c => !c.isArchived)}
                    workClients={workClients.filter(c => !c.isArchived)}
                />;
            case 'entities':
                return <EntitiesView
                    entities={entities}
                    onOpenLotModal={openLotModal}
                    onOpenEntityModal={openEntityModal}
                    onToggleArchive={toggleLotArchive}
                    onDeleteEntity={openConfirmDeleteModal}
                    onDeleteLot={openConfirmDeleteLotModal}
                    onOpenSupplyModal={openSupplyModal}
                    onOpenLoadingModal={openLoadingModal}
                    onExportEntity={handleExportSingleEntity}
                />;
            case 'advances':
                return <ClientsView
                    type="advance"
                    clients={clients.filter(c => !c.isArchived)}
                    onOpenClientModal={() => setClientModalOpen(true)}
                    onDeleteClient={openConfirmDeleteClientModal}
                    onOpenTransactionModal={openTransactionModal}
                    onOpenPaymentModal={openPaymentModal}
                    onExportTransaction={handleExportTransaction}
                    onDeleteTransaction={openConfirmDeleteTransactionModal}
                    onExportSummary={handleExportClientSummary}
                    onSettleClient={handleSettleClient}
                />;
            case 'work':
                return <ClientsView
                    type="work"
                    clients={workClients.filter(c => !c.isArchived)}
                    onOpenClientModal={() => setClientModalOpen(true)}
                    onDeleteClient={openConfirmDeleteClientModal}
                    onOpenTransactionModal={openTransactionModal}
                    onOpenPaymentModal={openPaymentModal}
                    onExportTransaction={handleExportTransaction}
                    onDeleteTransaction={openConfirmDeleteTransactionModal}
                    onExportSummary={handleExportClientSummary}
                    onSettleClient={handleSettleClient}
                />;
            case 'archiveMenu':
                return <ArchiveMenuView
                    onNavigate={setViewMode}
                    entities={entities}
                    clients={clients}
                    workClients={workClients}
                    onExportReport={handleExportArchiveReport}
                />;
            case 'archiveAdvances':
                return <ArchiveClientsView
                    type="advance"
                    clients={clients.filter(c => c.isArchived && c.archiveType === 'advances')}
                    onOpenTransactionModal={openTransactionModal}
                    onExportTransaction={handleExportTransaction}
                    onExportSummary={handleExportClientSummary}
                    onRestoreClient={handleRestoreClient}
                    onExportAll={handleExportAllClients}
                />;
            case 'archiveWork':
                return <ArchiveClientsView
                    type="work"
                    clients={workClients.filter(c => c.isArchived && c.archiveType === 'work')}
                    onOpenTransactionModal={openTransactionModal}
                    onExportTransaction={handleExportTransaction}
                    onExportSummary={handleExportClientSummary}
                    onRestoreClient={handleRestoreClient}
                    onExportAll={handleExportAllClients}
                />;
            case 'archiveEntities':
                return <ArchiveView entities={entities} onToggleArchive={toggleLotArchive} />;
            default:
                return null;
        }
    };

    return (
        <>
            <div id="app-container" className="bg-gray-50 min-h-screen">
                <Header user={user} onLogout={handleLogout} />
                <main className="w-full max-w-7xl mx-auto p-2 md:p-6">



                    {dbError && (dbError.includes("Missing or insufficient permissions")
                        ? <PermissionsFix />
                        : (dbError.includes("requires an index")
                            ? <IndexFix errorMessage={dbError} />
                            : <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{dbError}</p></div>))
                    }

                    <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                        {/* Header with Back Button and Section Title */}
                        {viewMode !== 'dashboard' && (
                            <div className="flex items-center justify-between mb-4 p-4 border-b border-gray-200">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setViewMode('dashboard')}
                                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        العودة للوحة التحكم
                                    </button>
                                    <div className="h-6 w-px bg-gray-300"></div>
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        {
                                            {
                                                'entities': 'حساب الجهات',
                                                'advances': 'حساب السلف',
                                                'work': 'حساب الشغل',
                                                'archiveMenu': 'الأرشيف',
                                                'archiveEntities': 'أرشيف حساب الجهات',
                                                'archiveWork': 'أرشيف حساب الشغل',
                                                'archiveAdvances': 'أرشيف حساب السلف',
                                            }[viewMode]
                                        }
                                    </h2>
                                </div>
                                <div>
                                    {viewMode === 'entities' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEntityModal()}
                                                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow"
                                            >
                                                + إضافة جهة
                                            </button>
                                            <button
                                                onClick={handleExportEntitiesSummary}
                                                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                تصدير ملخص
                                            </button>
                                        </div>
                                    )}
                                    {(viewMode === 'advances' || viewMode === 'work') && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => viewMode === 'advances' ? exportAllAdvanceClients() : exportAllWorkClients()}
                                                className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                تصدير ملخص
                                            </button>
                                            <button
                                                onClick={() => setClientModalOpen(true)}
                                                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
                                            >
                                                + إضافة عميل {viewMode === 'advances' ? 'سلف' : 'شغل'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="p-2">
                            {renderContent()}
                        </div>
                    </div>
                </main>

                {/* Modals */}
                {isClientModalOpen && (
                    <ClientModal
                        isOpen={isClientModalOpen}
                        onClose={() => setClientModalOpen(false)}
                        onSave={(name) => addOrUpdateClient(name, viewMode === 'advances' ? 'advance' : 'work')}
                        clientType={viewMode === 'advances' ? 'سلف' : 'شغل'}
                    />
                )}

                {isTransactionModalOpen && currentClient && (
                    <TransactionModal
                        isOpen={isTransactionModalOpen}
                        onClose={() => { setTransactionModalOpen(false); setCurrentClient(null); setEditingTransaction(null); }}
                        onSave={(data) => addOrUpdateTransaction(data, currentClient.id, viewMode === 'advances' ? 'advance' : 'work')}
                        client={currentClient}
                        transaction={editingTransaction}
                        predefinedItems={predefinedItems}
                        onOpenPredefinedItemModal={() => setPredefinedItemModalOpen(true)}
                    />
                )}

                {isEntityModalOpen && (
                    <EntityModal
                        isOpen={isEntityModalOpen}
                        onClose={() => { setEntityModalOpen(false); setEditingEntity(null); }}
                        onSave={addOrUpdateEntity}
                        entity={editingEntity}
                        predefinedBuyers={predefinedBuyers}
                        onOpenPredefinedBuyerModal={() => setPredefinedBuyerModalOpen(true)}
                    />
                )}

                {isLotModalOpen && currentEntity && (
                    <LotModal
                        isOpen={isLotModalOpen}
                        onClose={() => { setLotModalOpen(false); setCurrentEntity(null); setEditingLot(null); }}
                        onSave={(data) => addOrUpdateLot(data, currentEntity.id)}
                        lot={editingLot}
                        onFileUpload={handleFileUpload}
                    />
                )}

                {isPredefinedItemModalOpen && (
                    <Modal isOpen={isPredefinedItemModalOpen} onClose={() => setPredefinedItemModalOpen(false)} title="إضافة صنف جديد">
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={newPredefinedItemName}
                                onChange={(e) => setNewPredefinedItemName(e.target.value)}
                                placeholder="اسم الصنف"
                                className="w-full p-2 border rounded-md"
                            />
                            <button onClick={addPredefinedItem} className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700">
                                حفظ الصنف
                            </button>
                        </div>
                    </Modal>
                )}

                {isPredefinedBuyerModalOpen && (
                    <Modal isOpen={isPredefinedBuyerModalOpen} onClose={() => setPredefinedBuyerModalOpen(false)} title="إضافة مشتري جديد">
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={newPredefinedBuyerName}
                                onChange={(e) => setNewPredefinedBuyerName(e.target.value)}
                                placeholder="اسم المشتري"
                                className="w-full p-2 border rounded-md"
                            />
                            <button onClick={addPredefinedBuyer} className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700">
                                حفظ المشتري
                            </button>
                        </div>
                    </Modal>
                )}

                {isPaymentModalOpen && currentClient && (
                    <PaymentModal
                        isOpen={isPaymentModalOpen}
                        onClose={() => { setPaymentModalOpen(false); setCurrentClient(null); }}
                        onSave={(data) => {
                            const clientType = viewMode === 'advances' ? 'advance' : 'work';
                            addPayment(data, currentClient.id, clientType);
                        }}
                        client={currentClient}
                        onFileUpload={handleFileUpload}
                    />
                )}

                {isSupplyModalOpen && (
                    <SupplyModal
                        isOpen={isSupplyModalOpen}
                        onClose={() => { setSupplyModalOpen(false); setSupplyTarget(null); }}
                        onSave={handleSupplySave}
                        targetLabel={supplyTarget?.type === 'lot' ? 'توريد لوط' : 'توريد الجهة بالكامل'}
                        onFileUpload={handleFileUpload}
                    />
                )}

                {isLoadingModalOpen && (
                    <LoadingModal
                        isOpen={isLoadingModalOpen}
                        onClose={() => { setIsLoadingModalOpen(false); setLoadingTarget(null); }}
                        onSave={handleLoadingSave}
                    />
                )}

                {isConfirmDeleteModalOpen && (
                    <Modal
                        isOpen={isConfirmDeleteModalOpen}
                        onClose={() => setConfirmDeleteModalOpen(false)}
                        title="تأكيد الحذف"
                    >
                        <div className="text-center">
                            <p className="text-lg text-gray-700 mb-4">
                                هل أنت متأكد من رغبتك في حذف هذه الجهة وكل اللوطات المرتبطة بها؟
                            </p>
                            <p className="text-sm text-red-600 font-semibold">
                                هذه العملية لا يمكن التراجع عنها.
                            </p>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => setConfirmDeleteModalOpen(false)}
                                    className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="px-6 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 font-semibold"
                                >
                                    حذف
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {isConfirmDeleteClientModalOpen && (
                    <Modal
                        isOpen={isConfirmDeleteClientModalOpen}
                        onClose={() => setConfirmDeleteClientModalOpen(false)}
                        title="تأكيد حذف العميل"
                    >
                        <div className="text-center">
                            <p className="text-lg text-gray-700 mb-4">
                                هل أنت متأكد من رغبتك في حذف هذا العميل وكل الحركات المرتبطة به؟
                            </p>
                            <p className="text-sm text-red-600 font-semibold">
                                هذه العملية لا يمكن التراجع عنها.
                            </p>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => setConfirmDeleteClientModalOpen(false)}
                                    className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleConfirmDeleteClient}
                                    className="px-6 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 font-semibold"
                                >
                                    حذف
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {isConfirmDeleteLotModalOpen && (
                    <Modal
                        isOpen={isConfirmDeleteLotModalOpen}
                        onClose={() => setConfirmDeleteLotModalOpen(false)}
                        title="تأكيد حذف اللوط"
                    >
                        <div className="text-center">
                            <p className="text-lg text-gray-700 mb-4">
                                هل أنت متأكد من رغبتك في حذف هذا اللوط؟
                            </p>
                            <p className="text-sm text-red-600 font-semibold">
                                هذه العملية لا يمكن التراجع عنها.
                            </p>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => setConfirmDeleteLotModalOpen(false)}
                                    className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleConfirmDeleteLot}
                                    className="px-6 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 font-semibold"
                                >
                                    حذف
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
                {isConfirmDeleteTransactionModalOpen && (
                    <Modal
                        isOpen={isConfirmDeleteTransactionModalOpen}
                        onClose={() => setConfirmDeleteTransactionModalOpen(false)}
                        title="تأكيد حذف الحركة"
                    >
                        <div className="text-center">
                            <p className="text-lg text-gray-700 mb-4">
                                هل أنت متأكد من رغبتك في حذف هذه الحركة؟
                            </p>
                            <p className="text-sm text-red-600 font-semibold">
                                هذه العملية لا يمكن التراجع عنها.
                            </p>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => setConfirmDeleteTransactionModalOpen(false)}
                                    className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleConfirmDeleteTransaction}
                                    className="px-6 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 font-semibold"
                                >
                                    حذف
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {isSettleModalOpen && settleTarget && (
                    <Modal
                        isOpen={isSettleModalOpen}
                        onClose={() => setSettleModalOpen(false)}
                        title="تأكيد تسوية الحساب"
                    >
                        <div className="text-center">
                            <p className="text-lg text-gray-700 mb-4">
                                هل أنت متأكد من تسوية الحساب للعميل <strong>{settleTarget.client.name}</strong> بالكامل؟
                            </p>
                            <p className="text-md text-gray-600 mb-2">
                                المبلغ المتبقي: <span dir="ltr" className="font-bold">{formatCurrency(Math.abs(settleTarget.total))}</span> {settleTarget.total >= 0 ? '(مدين)' : '(دائن)'}
                            </p>
                            <p className="text-sm text-red-600 font-semibold mt-4">
                                سيتم إضافة حركة تصفية ونقل العميل إلى الأرشيف.
                            </p>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => setSettleModalOpen(false)}
                                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={confirmSettleAndArchive}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                >
                                    تأكيد وتسوية
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                {isRestoreModalOpen && clientToRestore && (
                    <Modal
                        isOpen={isRestoreModalOpen}
                        onClose={() => setRestoreModalOpen(false)}
                        title="تأكيد استرجاع من الأرشيف"
                    >
                        <div className="text-center">
                            <p className="text-lg text-gray-700 mb-4">
                                هل أنت متأكد من استرجاع <strong>{clientToRestore.name}</strong> من الأرشيف؟
                            </p>
                            <p className="text-sm text-blue-600 font-semibold mt-4">
                                سيتم إعادة العميل إلى القائمة الرئيسية ({clientToRestore.archiveType === 'advances' ? 'حساب السلف' : 'حساب الشغل'}).
                            </p>
                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={confirmRestoreClient}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                >
                                    تأكيد الاسترجاع
                                </button>
                                <button
                                    onClick={() => setRestoreModalOpen(false)}
                                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}


                {/* Client Modal */}
                {
                    isClientModalOpen && (
                        <ClientModal
                            isOpen={isClientModalOpen}
                            onClose={() => setClientModalOpen(false)}
                            onSave={(name, phone) => {
                                const clientType = viewMode === 'advances' ? 'advance' : 'work';
                                addClient(name, phone, clientType);
                            }}
                            clientType={viewMode === 'advances' ? 'سلف' : 'شغل'}
                            existingClients={viewMode === 'advances' ? clients : workClients}
                        />
                    )
                }
            </div >
        </>
    );
};


// --- Sub-Components for Views ---

// Extracted ClientCard to fix "Hooks inside loop" error
const ClientCard: React.FC<{
    client: Client;
    type: 'advance' | 'work';
    onDeleteClient: (clientId: string, type: 'advance' | 'work') => void;
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onOpenPaymentModal: (client: Client) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
    onDeleteTransaction: (clientId: string, clientType: 'advance' | 'work', transactionId: string) => void;
    onExportSummary: (client: Client) => void;
    onSettleClient: (client: Client, total: number) => void;
}> = ({ client, type, onDeleteClient, onOpenTransactionModal, onOpenPaymentModal, onExportTransaction, onDeleteTransaction, onExportSummary, onSettleClient }) => {

    const [isExpanded, setIsExpanded] = useState(true);
    const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);

    // Group transactions by date
    // Now safe because this is a top-level hook inside ClientCard
    const groupedTransactions = useMemo(() => {
        const grouped: { [key: string]: Transaction[] } = {};
        (client.transactions || []).forEach(t => {
            // Use a consistent date key (YYYY-MM-DD)
            if (!t.date || typeof t.date.toDate !== 'function') return;

            const date = t.date.toDate();
            const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });

        // Sort keys descending by date
        return Object.entries(grouped).sort((a, b) => {
            const dateA = a[1][0].date ? a[1][0].date.toMillis() : 0;
            const dateB = b[1][0].date ? b[1][0].date.toMillis() : 0;
            return dateB - dateA;
        });
    }, [client.transactions]);

    return (
        <div className={`p-3 md:p-4 rounded-lg shadow-md border ${client.isBuyer ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div
                    className="flex items-center gap-2 cursor-pointer group select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 group-hover:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">{client.name}</h3>
                        {client.phone && <p className="text-sm text-gray-500">📞 {client.phone}</p>}
                    </div>
                    {client.isBuyer && (
                        <span className="bg-purple-200 text-purple-800 text-xs px-2 py-1 rounded-full font-bold border border-purple-300">
                            مشتري
                        </span>
                    )}
                </div>
                <div className="flex items-center flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onExportSummary(client)} className="text-sm bg-teal-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-teal-700 transition-colors">تصدير ملخص</button>
                    <button onClick={() => onOpenPaymentModal(client)} className="text-sm bg-green-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-green-700 transition-colors">إضافة سداد</button>
                    <button onClick={() => onOpenTransactionModal(client)} className="text-sm bg-blue-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-blue-700 transition-colors">+ إضافة حركة</button>
                    <button onClick={() => onDeleteClient(client.id, type)} className="text-sm bg-red-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-red-700 transition-colors">حذف العميل</button>
                </div>
            </div>

            {/* Transactions List */}
            {isExpanded ? (
                <>
                    <div className="space-y-3">
                        {groupedTransactions.length > 0 ? (
                            groupedTransactions.map(([dateKey, transactions]) => (
                                <TransactionGroupItem
                                    key={dateKey}
                                    transactions={transactions}
                                    client={client}
                                    clientType={type}
                                    onOpenTransactionModal={onOpenTransactionModal}
                                    onDeleteTransaction={onDeleteTransaction}
                                    onExportTransaction={onExportTransaction}
                                />
                            ))
                        ) : (
                            <p className="text-sm text-center text-gray-500 py-4">لا توجد حركات مسجلة لهذا العميل.</p>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t flex justify-end items-center gap-4 flex-wrap">
                        {Math.abs(total) > 0 && (
                            <button
                                onClick={() => onSettleClient(client, total)}
                                className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                تم التسديد بالكامل
                            </button>
                        )}
                        <BalanceDisplay total={total} />
                    </div>
                </>
            ) : (
                <div className="mt-2 pt-2 border-t flex justify-between items-center text-sm text-gray-500">
                    <span>تم إخفاء التفاصيل</span>
                    <span className={`${total >= 0 ? 'text-red-600' : 'text-green-600'} font-bold`}>
                        الرصيد: {formatCurrency(Math.abs(total))} {total >= 0 ? '(مدين)' : '(دائن)'}
                    </span>
                </div>
            )}
        </div>
    );
};

const ClientsView: React.FC<{
    type: 'advance' | 'work';
    clients: Client[];
    onOpenClientModal: () => void;
    onDeleteClient: (clientId: string, type: 'advance' | 'work') => void;
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onOpenPaymentModal: (client: Client) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
    onDeleteTransaction: (clientId: string, clientType: 'advance' | 'work', transactionId: string) => void;
    onExportSummary: (client: Client) => void;
    onSettleClient: (client: Client, total: number) => void;
}> = ({ type, clients, onOpenClientModal, onDeleteClient, onOpenTransactionModal, onOpenPaymentModal, onExportTransaction, onDeleteTransaction, onExportSummary, onSettleClient }) => {

    const [searchTerm, setSearchTerm] = useState('');

    // Filter clients based on search term
    const filteredClients = useMemo(() => {
        if (!searchTerm.trim()) return clients;

        const lowerSearch = searchTerm.toLowerCase();
        return clients.filter(client =>
            client.name.toLowerCase().includes(lowerSearch)
        );
    }, [clients, searchTerm]);

    if (!clients || clients.length === 0) {
        return (
            <div>
                <SummaryPanel clients={clients} type={type} />
                <p className="text-center text-gray-500 py-8">لا يوجد عملاء لعرضهم. ابدأ بإضافة عميل جديد.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Summary Panel */}
            <SummaryPanel clients={clients} type={type} />

            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 mb-6">
                <input
                    type="text"
                    placeholder="🔍 ابحث باسم العميل..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                {searchTerm && (
                    <p className="text-sm text-gray-500 mt-2">
                        عرض {filteredClients.length} من {clients.length} عميل
                    </p>
                )}
            </div>

            {/* Clients List */}
            <div className="space-y-6">
                {filteredClients.map(client => (
                    <ClientCard
                        key={client.id}
                        client={client}
                        type={type}
                        onDeleteClient={onDeleteClient}
                        onOpenTransactionModal={onOpenTransactionModal}
                        onOpenPaymentModal={onOpenPaymentModal}
                        onExportTransaction={onExportTransaction}
                        onDeleteTransaction={onDeleteTransaction}
                        onExportSummary={onExportSummary}
                        onSettleClient={onSettleClient}
                    />
                ))}
            </div>
        </div>
    );
};


const EntitiesView: React.FC<{
    entities: Entity[];
    onOpenLotModal: (entity: Entity, lot?: Lot) => void;
    onOpenEntityModal: (entity: Entity) => void;
    onToggleArchive: (lot: Lot, entityId: string) => void;
    onDeleteEntity: (entityId: string) => void;
    onDeleteLot: (entityId: string, lotId: string) => void;
    onOpenSupplyModal: (type: 'lot' | 'entity', entityId: string, lotId?: string) => void;
    onOpenLoadingModal: (entityId: string, lotId?: string) => void;
    onExportEntity: (entity: Entity) => void;
}> = ({ entities, onOpenLotModal, onOpenEntityModal, onToggleArchive, onDeleteEntity, onDeleteLot, onOpenSupplyModal, onOpenLoadingModal, onExportEntity }) => {

    const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Calculate active lots entities
    const activeLotsEntities = useMemo(() => {
        if (!entities || entities.length === 0) return [];

        return entities
            .filter(e => {
                const hasActiveLots = (e.lots || []).some(l => !l.isArchived);
                const hasNoLots = (e.lots || []).length === 0;
                // Show if has active lots OR if completely empty (new entity)
                // Hide if it has lots but all are archived
                return hasActiveLots || hasNoLots;
            })
            .map(e => ({
                ...e,
                lots: (e.lots || []).filter(l => !l.isArchived)
            }));
    }, [entities]);

    // Filter entities based on search term
    const filteredEntities = useMemo(() => {
        if (!searchTerm.trim()) return activeLotsEntities;

        const lowerSearch = searchTerm.toLowerCase();
        return activeLotsEntities.filter(entity => {
            // Search in entity name
            if (entity.name.toLowerCase().includes(lowerSearch)) return true;

            // Search in buyer name
            if (entity.buyerName?.toLowerCase().includes(lowerSearch)) return true;

            // Search in lot numbers and names
            return entity.lots.some(lot =>
                lot.lotNumber.toLowerCase().includes(lowerSearch) ||
                lot.name.toLowerCase().includes(lowerSearch)
            );
        });
    }, [activeLotsEntities, searchTerm]);

    // Group entities by auction date with statistics
    const groupedByAuctionDate = useMemo(() => {
        const groups: {
            [key: string]: {
                entities: Entity[];
                stats: {
                    totalValue: number;
                    total30: number;
                    remaining70: number;
                    closestDeadline: Timestamp | null;
                };
            };
        } = {};

        filteredEntities.forEach(entity => {
            if (entity.auctionDate) {
                const dateKey = formatSpecificDateTime(entity.auctionDate);
                if (!groups[dateKey]) {
                    groups[dateKey] = {
                        entities: [],
                        stats: {
                            totalValue: 0,
                            total30: 0,
                            remaining70: 0,
                            closestDeadline: null
                        }
                    };
                }

                groups[dateKey].entities.push(entity);

                // Calculate statistics
                const activeLots = (entity.lots || []).filter(l => !l.isArchived);
                groups[dateKey].stats.totalValue += activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
                groups[dateKey].stats.total30 += activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
                groups[dateKey].stats.remaining70 += activeLots.filter(l => !l.is70Paid).reduce((sum, lot) => sum + (lot.value70 || 0), 0);

                // Calculate closest deadline
                if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                    const deadlineDate = new Date(entity.auctionDate.toMillis());
                    deadlineDate.setDate(deadlineDate.getDate() + 15);
                    const deadline = Timestamp.fromDate(deadlineDate);

                    if (!groups[dateKey].stats.closestDeadline ||
                        deadline.toMillis() < groups[dateKey].stats.closestDeadline.toMillis()) {
                        groups[dateKey].stats.closestDeadline = deadline;
                    }
                }
            }
        });

        return groups;
    }, [filteredEntities]);

    // Early return after all hooks are defined
    if (!entities || entities.length === 0) {
        return <p className="text-center text-gray-500 py-8">لا توجد جهات لعرضها. ابدأ بإضافة جهة جديدة.</p>;
    }

    // Generate HTML for session PDF export
    const generateSessionHTML = (auctionDate: string, sessionEntities: Entity[], exportDate: string, stats: { totalValue: number; total30: number; remaining70: number; closestDeadline: Timestamp | null }): string => {
        const entitiesHTML = sessionEntities.map(entity => {
            const activeLots = (entity.lots || []).filter(l => !l.isArchived);
            if (activeLots.length === 0) return '';

            const entityTotal = activeLots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0);
            const entity30 = activeLots.reduce((sum, lot) => sum + (lot.value30 || 0), 0);
            const entity70 = activeLots.reduce((sum, lot) => sum + (lot.value70 || 0), 0);

            const lotsHTML = sortLotsByNumber(activeLots).map(lot => `
                <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                    <td class="p-2 md:p-4 text-slate-800 font-bold text-xs md:text-base">${lot.lotNumber}</td>
                    <td class="p-2 md:p-4 text-slate-700 font-medium text-xs md:text-sm">${lot.name}</td>
                    <td class="p-2 md:p-4 text-slate-600 font-semibold text-xs md:text-base">${lot.quantity || '-'}</td>
                    <td class="p-2 md:p-4 font-black text-blue-700 text-sm md:text-lg" dir="ltr">${formatCurrency(lot.totalValue)}</td>
                    <td class="p-2 md:p-4 font-black text-purple-700 text-sm md:text-lg" dir="ltr">${formatCurrency(lot.value30)}</td>
                    <td class="p-2 md:p-4 font-black text-orange-700 text-sm md:text-lg" dir="ltr">${formatCurrency(lot.value70)}</td>
                    <td class="p-2 md:p-4 text-center">
                        ${lot.is70Paid
                    ? `<span class="inline-block px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold bg-green-100 text-green-700">تم السداد</span>
                           ${lot.paymentDetails?.payerName ? `<div class="text-[10px] md:text-xs text-slate-500 mt-1">بواسطة: ${lot.paymentDetails.payerName}</div>` : ''}`
                    : `<span class="inline-block px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold bg-red-100 text-red-700">لم يتم السداد</span>`
                }
                    </td>
                </tr>
            `).join('');

            return `
                <div class="mb-8 break-inside-avoid">
                    <div class="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-xl mb-4">
                        <h3 class="text-lg md:text-2xl font-black mb-2">${entity.name}</h3>
                        ${entity.buyerName ? `<p class="text-lg text-white/90">المشتري: ${entity.buyerName}</p>` : ''}
                    </div>
                    
                    <div class="border border-slate-200 rounded-xl overflow-x-auto shadow-lg mb-4 table-responsive">
                        <table class="w-full text-right">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 border-b-2 border-slate-300">
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase">رقم اللوط</th>
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase">اسم اللوط</th>
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase">الكمية</th>
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase">الإجمالي</th>
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase">قيمة 30%</th>
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase">قيمة 70%</th>
                                    <th class="p-2 md:p-3 text-[10px] md:text-xs font-bold uppercase text-center">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lotsHTML}
                            </tbody>
                        </table>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 entity-grid">
                        <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <p class="text-xs text-gray-600 mb-1">إجمالي الجهة</p>
                            <p class="text-sm md:text-lg font-bold text-blue-700" dir="ltr">${formatCurrency(entityTotal)}</p>
                        </div>
                        <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <p class="text-xs text-gray-600 mb-1">إجمالي 30%</p>
                            <p class="text-sm md:text-lg font-bold text-purple-700" dir="ltr">${formatCurrency(entity30)}</p>
                        </div>
                        <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <p class="text-xs text-gray-600 mb-1">إجمالي 70%</p>
                            <p class="text-sm md:text-lg font-bold text-orange-700" dir="ltr">${formatCurrency(entity70)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>تقرير جلسة - ${auctionDate}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @media print {
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                    
                    /* Mobile responsive styles */
                    @media (max-width: 768px) {
                        .container-padding { padding: 16px !important; }
                        .header-title { font-size: 1.25rem !important; }
                        .section-title { font-size: 1.125rem !important; }
                        .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
                        .entity-grid { grid-template-columns: 1fr !important; }
                        .table-responsive { overflow-x: auto; }
                        .text-responsive { font-size: 0.875rem !important; }
                        .hide-mobile { display: none !important; }
                    }
                    
                    /* Ensure tables are scrollable on mobile */
                    table { min-width: 100%; }
                </style>
            </head>
            <body class="bg-white font-sans">
                <div class="min-h-screen container-padding" style="max-width: 297mm; margin: 0 auto; padding: 40px;">
                    <header class="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start gap-4 border-b-2 border-slate-200 pb-6 md:pb-8">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <div class="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                                    <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
                                    </svg>
                                </div>
                                <h1 class="text-xl md:text-3xl font-black text-slate-900 header-title">العبارة للتجارة والتوريدات</h1>
                            </div>
                            <p class="text-slate-500 text-sm mr-14">إدارة المزادات والتوريدات العامة</p>
                        </div>
                        <div class="text-left">
                            <span class="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg mb-2 shadow-lg">
                                تقرير جلسة
                            </span>
                            <p class="text-slate-400 text-xs font-medium">${exportDate}</p>
                        </div>
                    </header>

                    <section class="mb-8">
                        <div class="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-xl">
                            <div class="flex items-center gap-3 mb-4">
                                <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
                                </svg>
                                <h2 class="text-xl md:text-3xl font-black section-title">جلسة: ${auctionDate}</h2>
                            </div>
                            <p class="text-white/80">عدد الجهات: ${sessionEntities.length}</p>
                        </div>
                    </section>

                    <section class="mb-8">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                            <h3 class="text-base md:text-lg font-bold text-slate-800 section-title">إحصائيات الجلسة</h3>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stats-grid">
                            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <p class="text-xs text-gray-600 mb-1">إجمالي قيمة اللوطات</p>
                                <p class="text-xl font-bold text-blue-700" dir="ltr">${formatCurrency(stats.totalValue)}</p>
                            </div>
                            <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                <p class="text-xs text-gray-600 mb-1">إجمالي 30%</p>
                                <p class="text-xl font-bold text-purple-700" dir="ltr">${formatCurrency(stats.total30)}</p>
                            </div>
                            <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                <p class="text-xs text-gray-600 mb-1">المتبقي 70%</p>
                                <p class="text-xl font-bold text-orange-700" dir="ltr">${formatCurrency(stats.remaining70)}</p>
                            </div>
                            <div class="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <p class="text-xs text-gray-600 mb-1">أقرب ميعاد للدفع</p>
                                <p class="text-base font-bold text-amber-700" dir="ltr">${stats.closestDeadline ? formatDate(stats.closestDeadline) : 'لا يوجد'}</p>
                            </div>
                        </div>
                    </section>

                    <section class="mb-8">
                        <div class="flex items-center gap-2 mb-6">
                            <div class="w-1 h-6 bg-blue-600 rounded-full"></div>
                            <h3 class="text-lg font-bold text-slate-800">الجهات واللوطات</h3>
                        </div>
                        ${entitiesHTML}
                    </section>

                    <footer class="mt-12 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs">
                        <p class="font-medium">العبارة للتجارة والتوريدات © ${new Date().getFullYear()}</p>
                        <p class="mt-1">تم إنشاء هذا المستند تلقائياً بواسطة نظام إدارة المزادات</p>
                    </footer>
                </div>
            </body>
            </html>
        `;
    };

    // Handle print functionality
    const handlePrint = (html: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    return (
        <div className="space-y-6">
            <DashboardMetrics entities={entities} />

            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                <input
                    type="text"
                    placeholder="🔍 ابحث بالجهة، المشتري، أو رقم/اسم اللوط..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                {searchTerm && (
                    <p className="text-sm text-gray-500 mt-2">
                        عرض {filteredEntities.length} من {activeLotsEntities.length} جهة
                    </p>
                )}
            </div>

            {/* Grouped Sessions */}
            <div className="space-y-6">
                {(Object.entries(groupedByAuctionDate) as [string, { entities: Entity[]; stats: { totalValue: number; total30: number; remaining70: number; closestDeadline: Timestamp | null } }][])
                    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                    .map(([auctionDate, sessionData]) => (
                        <div key={auctionDate} className="border-4 border-blue-300 rounded-xl p-4 bg-blue-50">
                            {/* Session Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-3 border-b-2 border-blue-400">
                                <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    جلسة: <span dir="ltr">{auctionDate}</span>
                                </h2>
                                <button
                                    onClick={() => {
                                        const exportDate = formatSpecificDateTime(Timestamp.now());
                                        const html = generateSessionHTML(auctionDate, sessionData.entities, exportDate, sessionData.stats);
                                        handlePrint(html);
                                    }}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-semibold"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                                    </svg>
                                    تصدير PDF للجلسة
                                </button>
                            </div>

                            {/* Session Statistics */}
                            <div className="mb-4 bg-white rounded-lg p-4 border-2 border-blue-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                                    </svg>
                                    إحصائيات الجلسة
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <p className="text-xs text-gray-600 mb-1">إجمالي قيمة اللوطات</p>
                                        <p className="text-lg font-bold text-blue-700" dir="ltr">
                                            {formatCurrency(sessionData.stats.totalValue)}
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                        <p className="text-xs text-gray-600 mb-1">إجمالي 30%</p>
                                        <p className="text-lg font-bold text-purple-700" dir="ltr">
                                            {formatCurrency(sessionData.stats.total30)}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                                        <p className="text-xs text-gray-600 mb-1">المتبقي 70%</p>
                                        <p className="text-lg font-bold text-orange-700" dir="ltr">
                                            {formatCurrency(sessionData.stats.remaining70)}
                                        </p>
                                    </div>
                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                        <p className="text-xs text-gray-600 mb-1">أقرب ميعاد للدفع</p>
                                        <p className="text-sm font-bold text-amber-700" dir="ltr">
                                            {sessionData.stats.closestDeadline ? formatDate(sessionData.stats.closestDeadline) : 'لا يوجد'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Entities in this session */}
                            <div className="space-y-4">
                                {sessionData.entities.map(entity => {
                                    const isExpanded = expandedEntityId === entity.id;

                                    const entityMetrics = {
                                        totalLotsValue: entity.lots.reduce((sum, lot) => sum + (lot.totalValue || 0), 0),
                                        total30: entity.lots.reduce((sum, lot) => sum + (lot.value30 || 0), 0),
                                        total70: entity.lots.reduce((sum, lot) => sum + (lot.value70 || 0), 0),
                                    };

                                    let closestDeadlineTimestamp: Timestamp | null = null;
                                    if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                                        const deadlineDate = new Date(entity.auctionDate.toMillis());
                                        deadlineDate.setDate(deadlineDate.getDate() + 15);
                                        closestDeadlineTimestamp = Timestamp.fromDate(deadlineDate);
                                    }

                                    const areAllLotsPaid = entity.lots.length > 0 && entity.lots.every(l => l.is70Paid);

                                    return (
                                        <div key={entity.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                                            <div className="p-3 md:p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                                <div
                                                    className="flex-grow cursor-pointer w-full md:w-auto"
                                                    onClick={() => setExpandedEntityId(isExpanded ? null : entity.id)}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="text-lg font-bold text-blue-700">{entity.name}</h3>
                                                            {entity.buyerName && <p className="text-xs text-gray-600 mt-1">المشتري: {entity.buyerName}</p>}
                                                        </div>
                                                        {/* Arrow for mobile only */}
                                                        <div className="md:hidden">
                                                            <svg className={`w-6 h-6 text-gray-500 transition-transform transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {/* زر تم التحميل (نقل للأرشيف) */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenLoadingModal(entity.id); // Open for whole entity
                                                        }}
                                                        className="text-xs bg-teal-100 text-teal-700 font-semibold py-1.5 px-3 rounded-md hover:bg-teal-200 flex-grow md:flex-grow-0 text-center"
                                                    >
                                                        تم التحميل
                                                    </button>

                                                    {/* زر تعديل */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenEntityModal(entity);
                                                        }}
                                                        className="text-xs bg-gray-200 text-gray-700 font-semibold py-1.5 px-3 rounded-md hover:bg-gray-300 flex-grow md:flex-grow-0 text-center"
                                                    >
                                                        تعديل
                                                    </button>

                                                    {/* زر تصدير PDF */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onExportEntity(entity);
                                                        }}
                                                        className="text-xs bg-green-100 text-green-700 font-semibold py-1.5 px-3 rounded-md hover:bg-green-200 flex items-center justify-center gap-1 flex-grow md:flex-grow-0"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        تصدير
                                                    </button>

                                                    {/* زر حذف */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteEntity(entity.id);
                                                        }}
                                                        className="text-xs bg-red-100 text-red-700 font-semibold py-1.5 px-3 rounded-md hover:bg-red-200 flex-grow md:flex-grow-0 text-center"
                                                    >
                                                        حذف
                                                    </button>

                                                    {/* زر السهم - Desktop */}
                                                    <div
                                                        className="cursor-pointer hidden md:block mr-2"
                                                        onClick={() => setExpandedEntityId(isExpanded ? null : entity.id)}
                                                    >
                                                        <svg className={`w-6 h-6 text-gray-500 transition-transform transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-blue-50 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-t border-b border-gray-200">
                                                <div>
                                                    <p className="text-xs text-gray-600">إجمالي اللوطات</p>
                                                    <p className="font-bold text-gray-800" dir="ltr">{formatCurrency(entityMetrics.totalLotsValue)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">إجمالي 30%</p>
                                                    <p className="font-bold text-gray-800" dir="ltr">{formatCurrency(entityMetrics.total30)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">المتبقي 70%</p>
                                                    <p className="font-bold text-gray-800" dir="ltr">{formatCurrency(entityMetrics.total70)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">أقرب ميعاد للدفع</p>
                                                    {areAllLotsPaid ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-green-600">تم السداد</span>
                                                            {entity.lots[0]?.paymentDetails?.payerName && (
                                                                <span className="text-xs text-gray-600">بواسطة: {entity.lots[0].paymentDetails.payerName}</span>
                                                            )}
                                                            {entity.lots[0]?.paymentDetails?.receiptImage && (
                                                                <a
                                                                    href={entity.lots[0].paymentDetails.receiptImage.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] bg-teal-100 text-teal-700 px-1 rounded border border-teal-200 hover:bg-teal-200 w-fit mt-1"
                                                                >
                                                                    عرض الإيصال
                                                                </a>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="font-bold text-red-600">{formatSpecificDateTime(closestDeadlineTimestamp)}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="p-4 space-y-4">
                                                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                                                        <button
                                                            onClick={() => onOpenSupplyModal('entity', entity.id)}
                                                            className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 text-sm"
                                                        >
                                                            توريد المبلغ المتبقي
                                                        </button>
                                                        <button onClick={() => onOpenLotModal(entity)} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 text-sm">+ إضافة لوط</button>
                                                    </div>
                                                    <h4 className="font-bold text-gray-700 pt-2 border-t mt-4">قائمة اللوطات:</h4>
                                                    <div className="space-y-3">
                                                        {sortLotsByNumber(entity.lots).map(lot => {
                                                            let lotDeadline: Timestamp | null = null;
                                                            if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                                                                const deadlineDate = new Date(entity.auctionDate.toMillis());
                                                                deadlineDate.setDate(deadlineDate.getDate() + 15);
                                                                lotDeadline = Timestamp.fromDate(deadlineDate);
                                                            }
                                                            return (
                                                                <div key={lot.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                                    <p className="font-bold text-blue-800">لوط رقم: <span style={{ unicodeBidi: 'plaintext', direction: 'ltr', display: 'inline-block' }}>{lot.lotNumber}</span> - {lot.name}</p>
                                                                    <div className="text-sm text-gray-700 mt-2 space-y-1">
                                                                        <div className="grid grid-cols-2 gap-x-4">
                                                                            <p>الكمية: <span className="font-semibold" dir="ltr">{lot.quantity}</span></p>
                                                                            <p>الإجمالي: <span className="font-semibold" dir="ltr">{formatCurrency(lot.totalValue)}</span></p>
                                                                            <p>قيمة 30%: <span className="font-semibold" dir="ltr">{formatCurrency(lot.value30)}</span></p>
                                                                            <p>قيمة 70%: <span className="font-semibold" dir="ltr">{formatCurrency(lot.value70)}</span></p>
                                                                        </div>

                                                                        <div className="mt-2">
                                                                            {lot.is70Paid ? (
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <span className="font-bold text-green-600">تم السداد</span>
                                                                                    {lot.paymentDetails?.payerName && (
                                                                                        <span className="text-gray-700">
                                                                                            بواسطة: {lot.paymentDetails.payerName}
                                                                                        </span>
                                                                                    )}
                                                                                    {lot.paymentDetails?.receiptImage && (
                                                                                        <a
                                                                                            href={lot.paymentDetails.receiptImage.url}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded border border-teal-200 hover:bg-teal-200"
                                                                                        >
                                                                                            عرض إيصال الدفع
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <p>آخر ميعاد للدفع: <span className="font-semibold text-red-600"> {formatSpecificDateTime(lotDeadline)}</span></p>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex gap-2 mt-2">
                                                                            {lot.contractImage ? (
                                                                                <a
                                                                                    href={lot.contractImage.url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-200"
                                                                                >
                                                                                    عرض صورة العقد
                                                                                </a>
                                                                            ) : <span className="text-xs text-gray-400">لا يوجد عقد</span>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-3 flex items-center flex-wrap gap-2">
                                                                        <button onClick={() => onOpenLotModal(entity, lot)} className="bg-blue-500 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-blue-600">تعديل</button>
                                                                        {lot.is70Paid ? (
                                                                            <span className="bg-green-100 text-green-800 text-xs font-bold py-1 px-3 rounded-md border border-green-200">تم التوريد</span>
                                                                        ) : (
                                                                            <button onClick={() => onOpenSupplyModal('lot', entity.id, lot.id)} className="bg-red-500 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-red-600">توريد 70%</button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => onOpenLoadingModal(entity.id, lot.id)}
                                                                            className="bg-green-500 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-green-600"
                                                                        >
                                                                            تم التحميل
                                                                        </button>
                                                                        <button onClick={() => onDeleteLot(entity.id, lot.id)} className="bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-md hover:bg-red-700">حذف</button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
            </div>
        </div >
    );
};


const ArchiveClientsView: React.FC<{
    type: 'advance' | 'work';
    clients: Client[];
    onOpenTransactionModal: (client: Client, transaction?: Transaction) => void;
    onExportTransaction: (client: Client, transaction: Transaction) => void;
    onExportSummary: (client: Client) => void;
    onRestoreClient: (client: Client) => void;
    onExportAll: (clients: Client[], type: string) => void;
}> = ({ type, clients, onOpenTransactionModal, onExportTransaction, onExportSummary, onRestoreClient, onExportAll }) => {

    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterType, setFilterType] = React.useState<'all' | 'debit' | 'credit'>('all');

    // Filter clients based on search and filter
    const filteredClients = React.useMemo(() => {
        return clients.filter(client => {
            // Search by name
            const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());

            // Filter by balance type
            const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);
            const matchesFilter =
                filterType === 'all' ||
                (filterType === 'debit' && total >= 0) ||
                (filterType === 'credit' && total < 0);

            return matchesSearch && matchesFilter;
        });
    }, [clients, searchTerm, filterType]);

    if (!clients || clients.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-500 text-lg">لا يوجد عملاء مؤرشفين في هذا القسم</p>
            </div>
        );
    }

    return (
        <div>
            <div className="bg-gradient-to-r from-slate-500 to-gray-600 text-white p-6 rounded-lg shadow-lg mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">العملاء المؤرشفين</h2>
                        <p className="text-slate-200">إجمالي: {clients.length} عميل مؤرشف | معروض: {filteredClients.length}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onExportAll(clients, type === 'advance' ? 'حساب السلف' : 'حساب الشغل')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            تصدير الكل ({clients.length})
                        </button>
                        <div className="text-5xl">🗄️</div>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <input
                    type="text"
                    placeholder="🔍 ابحث بالاسم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'all' | 'debit' | 'credit')}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="all">الكل</option>
                    <option value="debit">مدين فقط</option>
                    <option value="credit">دائن فقط</option>
                </select>
            </div>

            {/* Archived Clients List */}
            <div className="space-y-6">
                {filteredClients.map(client => {
                    const [isExpanded, setIsExpanded] = React.useState(false);
                    const total = (client.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0);

                    // Group transactions by date
                    const groupedTransactions = React.useMemo(() => {
                        const grouped: { [key: string]: Transaction[] } = {};
                        (client.transactions || []).forEach(t => {
                            if (!t.date || typeof t.date.toDate !== 'function') return;

                            const date = t.date.toDate();
                            const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                            if (!grouped[key]) grouped[key] = [];
                            grouped[key].push(t);
                        });

                        return Object.entries(grouped).sort((a, b) => {
                            const dateA = a[1][0].date ? a[1][0].date.toMillis() : 0;
                            const dateB = b[1][0].date ? b[1][0].date.toMillis() : 0;
                            return dateB - dateA;
                        });
                    }, [client.transactions]);

                    return (
                        <div key={client.id} className="p-4 rounded-lg shadow-md border bg-slate-50 border-slate-300">
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <div
                                    className="flex items-center gap-2 cursor-pointer group select-none"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                >
                                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 group-hover:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">{client.name}</h3>
                                    <span className="bg-slate-300 text-slate-700 text-xs px-2 py-1 rounded-full font-bold border border-slate-400">
                                        مؤرشف
                                    </span>
                                </div>
                                <div className="flex items-center flex-wrap gap-2">
                                    <button
                                        onClick={() => onRestoreClient(client)}
                                        className="text-sm bg-blue-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        استرجاع
                                    </button>
                                    <button onClick={() => onExportSummary(client)} className="text-sm bg-teal-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-teal-700 transition-colors">تصدير ملخص</button>
                                </div>
                            </div>

                            {/* Transactions List */}
                            {isExpanded && (
                                <>
                                    <div className="space-y-3">
                                        {groupedTransactions.length > 0 ? (
                                            groupedTransactions.map(([dateKey, transactions]) => (
                                                <TransactionGroupItem
                                                    key={dateKey}
                                                    transactions={transactions}
                                                    client={client}
                                                    clientType={type}
                                                    onOpenTransactionModal={onOpenTransactionModal}
                                                    onDeleteTransaction={() => { }} // No delete in archive
                                                    onExportTransaction={onExportTransaction}
                                                />
                                            ))
                                        ) : (
                                            <p className="text-sm text-center text-gray-500 py-4">لا توجد حركات مسجلة.</p>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t flex justify-end items-center gap-4">
                                        <div className={`px-6 py-3 rounded-lg font-bold text-lg ${total >= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            الرصيد النهائي: <span dir="ltr">{formatCurrency(Math.abs(total))}</span> {total >= 0 ? '(مدين)' : '(دائن)'}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const ArchiveView: React.FC<{
    entities: Entity[];
    onToggleArchive: (lot: Lot, entityId: string) => void;
}> = ({ entities, onToggleArchive }) => {

    const archivedLotsEntities = entities.map(e => ({
        ...e,
        lots: (e.lots || []).filter(l => l.isArchived)
    }));

    if (archivedLotsEntities.filter(e => e.lots.length > 0).length === 0) {
        return <p className="text-center text-gray-500 py-8">الأرشيف فارغ.</p>
    }

    return (
        <div className="space-y-4">
            {archivedLotsEntities.map(entity => (
                entity.lots.length > 0 && (
                    <div key={entity.id}>
                        <h3 className="font-bold text-lg mb-2 text-gray-800">{entity.name}</h3>
                        <div className="space-y-2">
                            {entity.lots.map(lot => (
                                <div key={lot.id} className="bg-white border border-gray-200 p-4 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div>
                                        <p className="font-bold text-gray-900 text-lg">
                                            لوط رقم: {lot.lotNumber} - {lot.name}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            القيمة: <span className="font-medium text-gray-800">{formatCurrency(lot.totalValue)}</span>
                                            <span className="mx-2 text-gray-300">|</span>
                                            تاريخ المزاد: <span className="font-medium text-gray-800">{formatDate(entity.auctionDate)}</span>
                                        </p>
                                        {lot.loadingDetails && (
                                            <p className="text-sm text-green-600 mt-2 font-medium">
                                                تم التحميل بواسطة: {lot.loadingDetails.loaderName} في {formatDate(lot.loadingDetails.date)}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onToggleArchive(lot, entity.id)}
                                        className="text-sm text-blue-600 font-semibold hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition-colors"
                                    >
                                        استرجاع من الأرشيف
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            ))}
        </div>
    );
};

// --- Dashboard Components ---

const DashboardView: React.FC<{
    onNavigate: (view: ViewMode) => void;
    entities: Entity[];
    clients: Client[];
    workClients: Client[];
}> = ({ onNavigate, entities, clients, workClients }) => {

    const stats = useMemo(() => {
        // Count only entities that have at least one active (non-archived) lot
        const entitiesCount = entities.filter(e => e.lots?.some(l => !l.isArchived)).length;
        const activeLots = entities.reduce((sum, e) => sum + (e.lots?.filter(l => !l.isArchived).length || 0), 0);

        const advancesBalance = clients.reduce((sum, c) =>
            sum + (c.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0), 0
        );

        const workBalance = workClients.reduce((sum, c) =>
            sum + (c.transactions || []).reduce((acc, t) => acc + (t.amount || 0), 0), 0
        );

        const archivedLots = entities.reduce((sum, e) => sum + (e.lots?.filter(l => l.isArchived).length || 0), 0);
        const archivedAdvances = clients.filter(c => c.isArchived && c.archiveType === 'advances').length;
        const archivedWork = workClients.filter(c => c.isArchived && c.archiveType === 'work').length;
        const totalArchivedClients = archivedAdvances + archivedWork;

        return { entitiesCount, activeLots, advancesBalance, workBalance, archivedLots, archivedAdvances, archivedWork, totalArchivedClients };
    }, [entities, clients, workClients]);

    const cards = [
        {
            id: 'entities' as ViewMode,
            title: 'حساب الجهات',
            icon: '🏢',
            gradient: 'from-blue-500 to-cyan-500',
            hoverGradient: 'hover:from-blue-600 hover:to-cyan-600',
            stat: `${stats.entitiesCount} جهة`,
            subStat: `${stats.activeLots} لوط نشط`
        },
        {
            id: 'work' as ViewMode,
            title: 'حساب الشغل',
            icon: '💼',
            gradient: 'from-purple-500 to-pink-500',
            hoverGradient: 'hover:from-purple-600 hover:to-pink-600',
            stat: formatCurrency(stats.workBalance),
            subStat: `${workClients.length} عميل`
        },
        {
            id: 'advances' as ViewMode,
            title: 'حساب السلف',
            icon: '💰',
            gradient: 'from-orange-500 to-red-500',
            hoverGradient: 'hover:from-orange-600 hover:to-red-600',
            stat: formatCurrency(stats.advancesBalance),
            subStat: `${clients.length} عميل`
        },
        {
            id: 'archiveMenu' as ViewMode,
            title: 'الأرشيف',
            icon: '📦',
            gradient: 'from-gray-500 to-slate-600',
            hoverGradient: 'hover:from-gray-600 hover:to-slate-700',
            stat: `${stats.totalArchivedClients + stats.archivedLots}`,
            subStat: `${stats.totalArchivedClients} عميل + ${stats.archivedLots} لوط`
        }
    ];

    return (
        <div className="py-8">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-800 mb-3">لوحة التحكم الرئيسية</h1>
                <p className="text-gray-600">اختر القسم الذي تريد الوصول إليه</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {cards.map(card => (
                    <button
                        key={card.id}
                        onClick={() => onNavigate(card.id)}
                        className={`relative overflow-hidden rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl p-8 text-white bg-gradient-to-br ${card.gradient} ${card.hoverGradient} group`}
                    >
                        {/* Glassmorphism overlay */}
                        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-6xl">{card.icon}</span>
                                <svg className="w-8 h-8 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>

                            <h2 className="text-2xl font-bold mb-4">{card.title}</h2>

                            <div className="space-y-2">
                                <p className="text-3xl font-black" dir="ltr">{card.stat}</p>
                                <p className="text-sm opacity-90">{card.subStat}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const ArchiveMenuView: React.FC<{
    onNavigate: (view: ViewMode) => void;
    entities: Entity[];
    clients: Client[];
    workClients: Client[];
    onExportReport: () => void;
}> = ({ onNavigate, entities, clients, workClients, onExportReport }) => {

    const stats = useMemo(() => {
        const archivedLots = entities.reduce((sum, e) => sum + (e.lots?.filter(l => l.isArchived).length || 0), 0);
        const archivedAdvances = clients.filter(c => c.isArchived && c.archiveType === 'advances').length;
        const archivedWork = workClients.filter(c => c.isArchived && c.archiveType === 'work').length;

        return { archivedLots, archivedAdvances, archivedWork };
    }, [entities, clients, workClients]);

    const archiveCards = [
        {
            id: 'archiveEntities' as ViewMode,
            title: 'أرشيف حساب الجهات',
            icon: '🏛️',
            gradient: 'from-blue-500 to-cyan-500',
            hoverGradient: 'hover:from-blue-600 hover:to-cyan-600',
            stat: `${stats.archivedLots} لوط`,
            subStat: 'مؤرشف'
        },
        {
            id: 'archiveWork' as ViewMode,
            title: 'أرشيف حساب الشغل',
            icon: '📋',
            gradient: 'from-purple-500 to-pink-500',
            hoverGradient: 'hover:from-purple-600 hover:to-pink-600',
            stat: `${stats.archivedWork} عميل`,
            subStat: 'مؤرشف'
        },
        {
            id: 'archiveAdvances' as ViewMode,
            title: 'أرشيف حساب السلف',
            icon: '💼',
            gradient: 'from-orange-500 to-red-500',
            hoverGradient: 'hover:from-orange-600 hover:to-red-600',
            stat: `${stats.archivedAdvances} عميل`,
            subStat: 'مؤرشف'
        }
    ];

    return (
        <div className="py-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-3">الأرشيف</h1>
                <p className="text-gray-600">اختر نوع الأرشيف الذي تريد عرضه</p>
            </div>

            {/* Comprehensive Report Button */}
            <div className="mb-8 flex justify-center">
                <button
                    onClick={onExportReport}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all flex items-center gap-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    📊 تصدير تقرير شامل للأرشيف
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {archiveCards.map(card => (
                    <button
                        key={card.id}
                        onClick={() => onNavigate(card.id)}
                        className={`relative overflow-hidden rounded-2xl shadow-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl p-8 text-white bg-gradient-to-br ${card.gradient} ${card.hoverGradient} group`}
                    >
                        {/* Glassmorphism overlay */}
                        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-6xl">{card.icon}</span>
                                <svg className="w-8 h-8 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>

                            <h2 className="text-2xl font-bold mb-4">{card.title}</h2>

                            <div className="space-y-2">
                                <p className="text-3xl font-black" dir="ltr">{card.stat}</p>
                                <p className="text-sm opacity-90">{card.subStat}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const SummaryPanel: React.FC<{
    clients: Client[];
    type: 'work' | 'advance';
}> = ({ clients, type }) => {
    const summary = useMemo<FinancialSummary>(() => {
        let totalDebit = 0;
        let totalCredit = 0;

        clients.forEach(client => {
            (client.transactions || []).forEach(transaction => {
                const amount = transaction.amount || 0;
                if (amount > 0) {
                    totalDebit += amount;
                } else {
                    totalCredit += Math.abs(amount);
                }
            });
        });

        const netBalance = totalDebit - totalCredit;

        return { totalDebit, totalCredit, netBalance };
    }, [clients]);

    return (
        <div className="bg-gradient-to-br from-white via-slate-50 to-slate-100 rounded-2xl shadow-2xl p-8 mb-8 border border-slate-200/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-xl shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v-2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.32-.42-.58-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.46.26-.58.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
                    </svg>
                </div>
                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-slate-900">
                    الملخص المالي
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Debit */}
                <div className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-white/90 uppercase tracking-wider">إجمالي المدين</span>
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <span className="text-2xl">📈</span>
                            </div>
                        </div>
                        <p className="text-3xl font-black text-white mb-2" dir="ltr">{formatCurrency(summary.totalDebit)}</p>
                        <p className="text-xs text-white/80 font-medium">المشتريات والديون</p>
                    </div>
                </div>

                {/* Total Credit */}
                <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-white/90 uppercase tracking-wider">إجمالي الدائن</span>
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <span className="text-2xl">📉</span>
                            </div>
                        </div>
                        <p className="text-3xl font-black text-white mb-2" dir="ltr">{formatCurrency(summary.totalCredit)}</p>
                        <p className="text-xs text-white/80 font-medium">المدفوعات والسداد</p>
                    </div>
                </div>

                {/* Net Balance */}
                <div className={`group relative bg-gradient-to-br ${summary.netBalance >= 0 ? 'from-blue-500 to-indigo-600' : 'from-teal-500 to-cyan-600'} rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-white/90 uppercase tracking-wider">الرصيد الصافي</span>
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <span className="text-2xl">{summary.netBalance >= 0 ? '⚖️' : '✅'}</span>
                            </div>
                        </div>
                        <p className="text-3xl font-black text-white mb-2" dir="ltr">
                            {formatCurrency(Math.abs(summary.netBalance))}
                        </p>
                        <p className="text-xs text-white/80 font-medium">
                            {summary.netBalance >= 0 ? 'مستحق للشركة' : 'مستحق للعملاء'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Modals Components ---

const SupplyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { payerName: string; date: Date; receiptImage?: { name: string; url: string } }) => void;
    targetLabel: string;
    onFileUpload: (file: File, prefix: string) => Promise<{ name: string, url: string } | undefined>;
}> = ({ isOpen, onClose, onSave, targetLabel, onFileUpload }) => {
    const [payerName, setPayerName] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let receiptImage = undefined;
        if (receiptFile) {
            setIsUploading(true);
            try {
                // Compress first
                const compressedFile = await compressImage(receiptFile, 1024, 0.7);
                receiptImage = await onFileUpload(compressedFile, 'receipt');
            } catch (err) {
                console.error(err);
                alert("فشل رفع الصورة");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        const [year, month, day] = date.split('-').map(Number);
        const correctedDate = new Date(year, month - 1, day);

        onSave({ payerName, date: correctedDate, receiptImage });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={targetLabel}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم القائم بالدفع</label>
                    <input
                        type="text"
                        value={payerName}
                        onChange={e => setPayerName(e.target.value)}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الدفع</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                        required
                    />
                </div>

                <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">إرفاق إيصال الدفع</label>
                    <div className="flex items-center gap-2">
                        <label htmlFor="receipt-upload" className="cursor-pointer bg-gray-200 text-gray-700 font-semibold text-sm py-2 px-4 rounded hover:bg-gray-300 transition-colors">
                            {receiptFile ? 'تغيير الملف' : 'اختيار ملف'}
                        </label>
                        <input id="receipt-upload" type="file" className="hidden" onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)} />
                        <span className="text-sm text-gray-500">{receiptFile ? receiptFile.name : 'لا يوجد ملف مختار'}</span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">إلغاء</button>
                    <button type="submit" disabled={isUploading} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        {isUploading ? 'جاري الرفع...' : 'تأكيد التوريد'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const LoadingModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { loaderName: string; date: Date }) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [loaderName, setLoaderName] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const [year, month, day] = date.split('-').map(Number);
        const correctedDate = new Date(year, month - 1, day);
        onSave({ loaderName, date: correctedDate });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="بيانات التحميل">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم القائم بالتحميل</label>
                    <input
                        type="text"
                        value={loaderName}
                        onChange={e => setLoaderName(e.target.value)}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ التحميل</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                        required
                    />
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">إلغاء</button>
                    <button type="submit" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">حفظ ونقل للأرشيف</button>
                </div>
            </form>
        </Modal>
    );
};

const ClientModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, phone?: string) => void;
    clientType: 'سلف' | 'شغل';
    existingClients: Client[];
}> = ({ isOpen, onClose, onSave, clientType, existingClients }) => {
    const [mode, setMode] = useState<'select' | 'new'>('select');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [name, setName] = useState('');
    const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Filter clients based on search query
    const filteredClients = (existingClients || []).filter(client =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.phone && client.phone.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleClientSelection = (value: string) => {
        if (value === 'new') {
            setMode('new');
            setSelectedClientId('');
        } else {
            setMode('select');
            setSelectedClientId(value);
            setShowSuggestions(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (value && mode === 'select') {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (client: Client) => {
        setSelectedClientId(client.id);
        setSearchQuery(client.name);
        setMode('select');
        setShowSuggestions(false);
    };

    const addPhoneNumber = () => {
        setPhoneNumbers([...phoneNumbers, '']);
    };

    const removePhoneNumber = (index: number) => {
        setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
    };

    const updatePhoneNumber = (index: number, value: string) => {
        const updated = [...phoneNumbers];
        updated[index] = value;
        setPhoneNumbers(updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'select' && selectedClientId) {
            const client = (existingClients || []).find(c => c.id === selectedClientId);
            if (client) {
                onSave(client.name, client.phone);
            }
        } else if (mode === 'new' && name.trim()) {
            const validPhones = phoneNumbers.filter(p => p.trim() !== '');
            const phoneString = validPhones.length > 0 ? validPhones.join(', ') : '';
            onSave(name.trim(), phoneString);
        }

        // Reset form
        setName('');
        setPhoneNumbers(['']);
        setSearchQuery('');
        setSelectedClientId('');
        setMode('select');
        onClose();
    };

    const handleClose = () => {
        setName('');
        setPhoneNumbers(['']);
        setSearchQuery('');
        setSelectedClientId('');
        setMode('select');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`إضافة/اختيار عميل ${clientType}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="🔍 ابحث عن عميل بالاسم أو الهاتف..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                    />

                    {/* Autocomplete Suggestions */}
                    {showSuggestions && filteredClients.length > 0 && searchQuery && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {filteredClients.slice(0, 5).map(client => (
                                <div
                                    key={client.id}
                                    onClick={() => handleSuggestionClick(client)}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center transition-colors"
                                >
                                    <div>
                                        <p className="font-semibold text-gray-800">{client.name}</p>
                                        {client.phone && <p className="text-xs text-gray-500">{client.phone}</p>}
                                    </div>
                                    {client.isArchived && (
                                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full border border-orange-200 flex-shrink-0 mr-2">
                                            مؤرشف
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Client Selection Dropdown */}
                <div>
                    <select
                        value={mode === 'new' ? 'new' : selectedClientId}
                        onChange={(e) => handleClientSelection(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                        <option value="">-- اختر عميل --</option>
                        <option value="new" className="font-bold text-green-600">➕ إضافة عميل جديد</option>
                        {filteredClients.length > 0 && (
                            <optgroup label="العملاء الموجودين">
                                {filteredClients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.name} {client.phone ? `- ${client.phone}` : ''}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                {/* New Client Form */}
                {mode === 'new' && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                        {/* Name Input */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                الاسم <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="اسم العميل"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>

                        {/* Phone Numbers */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                أرقام الهاتف (اختياري)
                            </label>
                            <div className="space-y-2">
                                {phoneNumbers.map((phone, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => updatePhoneNumber(index, e.target.value)}
                                            placeholder="رقم الهاتف"
                                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        {phoneNumbers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removePhoneNumber(index)}
                                                className="px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-bold text-lg"
                                                title="حذف رقم الهاتف"
                                            >
                                                ×
                                            </button>
                                        )}
                                        {index === phoneNumbers.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={addPhoneNumber}
                                                className="px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-bold text-lg"
                                                title="إضافة رقم هاتف آخر"
                                            >
                                                +
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={mode === 'select' ? !selectedClientId : !name.trim()}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {mode === 'select' ? 'اختيار' : 'حفظ'}
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                        إلغاء
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const TransactionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { amount: number; notes: string; date: Date; items: TransactionItem[]; isSettled: boolean; image?: { name: string; url: string } }) => void;
    client: Client;
    transaction: Transaction | null;
    predefinedItems: PredefinedItem[];
    onOpenPredefinedItemModal: () => void;
}> = ({ isOpen, onClose, onSave, client, transaction, predefinedItems, onOpenPredefinedItemModal }) => {
    const [date, setDate] = useState(new Date());
    const [notes, setNotes] = useState('');
    const [isSettled, setIsSettled] = useState(false);
    const [showItems, setShowItems] = useState(false);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [totalAmount, setTotalAmount] = useState<number | ''>('');
    const [transactionImage, setTransactionImage] = useState<{ name: string; url: string } | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const calculatedTotalFromItems = useMemo(() => {
        if (!showItems || items.length === 0) return 0;
        return items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.pricePerKilo || 0)), 0);
    }, [items, showItems]);

    useEffect(() => {
        if (transaction) {
            setDate(transaction.date.toDate());
            setNotes(transaction.notes);
            setIsSettled(transaction.isSettled);
            const transactionItems = transaction.items || [];
            setItems(transactionItems);
            setShowItems(transactionItems.length > 0);
            setTotalAmount(transaction.amount); // Load the saved amount
            setTransactionImage(transaction.image || null);
        } else {
            // Reset for new transaction
            setDate(new Date());
            setNotes('');
            setIsSettled(false);
            setItems([]);
            setShowItems(false);
            setTotalAmount('');
            setTransactionImage(null);
        }
    }, [transaction]);

    useEffect(() => {
        // Automatically update the total amount if items are being shown/edited
        if (showItems) {
            setTotalAmount(calculatedTotalFromItems);
        }
    }, [calculatedTotalFromItems, showItems]);

    const handleDateChange = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        if (year && month && day) {
            setDate(new Date(year, month - 1, day));
        }
    };

    const handleItemChange = (index: number, field: keyof TransactionItem, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const handleItemImageUpload = async (index: number, file: File | null) => {
        if (!file) return;

        try {
            // 1) Compress the image
            const compressedFile = await compressImage(file);

            // 2) Convert to Base64
            const base64 = await toBase64(compressedFile);

            // 3) Upload
            const fileName = `${client.name}_item_${Date.now()}_${compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
            const result: any = await uploadToDrive(base64, fileName, compressedFile.type);

            if (result && result.success) {
                const newItems = [...items];
                newItems[index].image = { name: compressedFile.name, url: result.url };
                setItems(newItems);
                alert("تم رفع الصورة بنجاح");
            } else {
                console.error("Upload failed:", result);
                alert("فشل رفع الصورة");
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("فشل معالجة/رفع الصورة");
        }
    };

    const handleTransactionImageUpload = async (file: File | null) => {
        if (!file) return;

        setIsUploadingImage(true);
        try {
            // 1) Compress
            const compressedFile = await compressImage(file);

            // 2) Base64
            const base64 = await toBase64(compressedFile);

            // 3) Upload
            const fileName = `${client.name}_tx_${Date.now()}_${compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
            const result: any = await uploadToDrive(base64, fileName, compressedFile.type);

            if (result && result.success) {
                setTransactionImage({ name: compressedFile.name, url: result.url });
                alert("تم رفع صورة الحركة بنجاح");
            } else {
                console.error("Upload failed:", result);
                alert("فشل رفع الصورة");
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("فشل معالجة/رفع الصورة");
        } finally {
            setIsUploadingImage(false);
        }
    };




    const addItem = () => {
        setItems([...items, { id: `${Date.now()}`, name: '', quantity: 0, pricePerKilo: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalAmount = typeof totalAmount === 'number' ? totalAmount : parseFloat(String(totalAmount)) || 0;
        onSave({
            amount: finalAmount,
            notes,
            date,
            items: showItems ? items : [],
            isSettled,
            image: transactionImage || undefined
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={transaction ? `تعديل حركة لـ ${client.name}` : `إضافة حركة لـ ${client.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الحركة</label>
                    <input type="date" value={date.toLocaleDateString('en-CA')} onChange={e => handleDateChange(e.target.value)} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300" required />
                </div>

                <div>
                    <button type="button" onClick={() => setShowItems(!showItems)} className="text-sm text-blue-600 hover:underline">
                        {showItems ? 'إخفاء الأوزان' : 'إضافة أوزان'}
                    </button>
                </div>

                {showItems && (
                    <div className="p-3 bg-gray-50 rounded-md border space-y-3">
                        {items.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                                {/* Item Name */}
                                <div className="md:col-span-2">
                                    <select
                                        value={item.name}
                                        onChange={(e) => {
                                            if (e.target.value === 'add_new') {
                                                onOpenPredefinedItemModal();
                                            } else {
                                                handleItemChange(index, 'name', e.target.value)
                                            }
                                        }}
                                        className="w-full p-2 border rounded-md"
                                    >
                                        <option value="">-- اختر صنف --</option>
                                        {predefinedItems.map(pItem => <option key={pItem.id} value={pItem.name}>{pItem.name}</option>)}
                                        <option value="add_new" className="font-bold text-blue-600">-- إضافة صنف جديد --</option>
                                    </select>
                                </div>
                                {/* Quantity */}
                                <input type="number" placeholder="الكمية" value={item.quantity || ''} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-full p-2 border rounded-md" />
                                {/* Price */}
                                <input type="number" placeholder="سعر الكيلو" value={item.pricePerKilo || ''} onChange={e => handleItemChange(index, 'pricePerKilo', parseFloat(e.target.value))} className="w-full p-2 border rounded-md" />
                                {/* Total */}
                                <div className="p-2 bg-gray-800 text-white rounded-md text-center font-semibold">
                                    {formatCurrency((item.quantity || 0) * (item.pricePerKilo || 0))}
                                </div>
                                {/* Actions */}
                                <div className="flex items-center space-x-2">
                                    <input type="file" id={`item-image-${index}`} className="hidden" onChange={(e) => handleItemImageUpload(index, e.target.files ? e.target.files[0] : null)} />
                                    <label htmlFor={`item-image-${index}`} className="text-xs bg-gray-200 p-2 rounded-md cursor-pointer hover:bg-gray-300">اختيار ملف</label>
                                    {item.image && <a href={item.image.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500">تم</a>}
                                    <button type="button" onClick={() => removeItem(index)} className="text-red-500 font-bold">×</button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">+ إضافة صنف جديد</button>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ الإجمالي</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={totalAmount}
                        onChange={e => setTotalAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="mt-1 w-full p-3 bg-gray-800 text-white rounded-md font-bold text-lg text-center"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300 resize-none"></textarea>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">صورة الحركة (اختياري)</label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="file"
                            id="transaction-image"
                            className="hidden"
                            onChange={(e) => handleTransactionImageUpload(e.target.files ? e.target.files[0] : null)}
                            disabled={isUploadingImage}
                        />
                        <label
                            htmlFor="transaction-image"
                            className={`text-sm bg-gray-200 p-2 rounded-md cursor-pointer hover:bg-gray-300 ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isUploadingImage ? 'جاري الرفع...' : 'اختيار صورة'}
                        </label>
                        {transactionImage && (
                            <div className="flex items-center gap-2">
                                <a href={transactionImage.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                                    عرض الصورة
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setTransactionImage(null)}
                                    className="text-red-500 font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center">
                    <input type="checkbox" id="isSettled" checked={isSettled} onChange={e => setIsSettled(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    <label htmlFor="isSettled" className="mr-2 block text-sm text-gray-900">هل هذه العملية سداد؟</label>
                </div>

                <div className="mt-4 flex justify-end">
                    <button type="submit" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                        {transaction ? 'حفظ التعديلات' : 'إضافة حركة'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const PaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { amount: number; date: Date; notes: string; linkedTransactionId?: string; receiptImage?: { name: string; url: string } }) => void;
    client: Client;
    onFileUpload: (file: File, prefix: string) => Promise<{ name: string, url: string } | undefined>;
}> = ({ isOpen, onClose, onSave, client, onFileUpload }) => {
    const [amount, setAmount] = useState<number | ''>('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [notes, setNotes] = useState('');
    const [linkedTransactionId, setLinkedTransactionId] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const unsettledTransactions = (client.transactions || []).filter(t => !t.isSettled);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof amount !== 'number' || amount <= 0) {
            alert("الرجاء إدخال مبلغ صحيح.");
            return;
        }

        const [year, month, day] = date.split('-').map(Number);
        const correctedDate = new Date(year, month - 1, day);

        let receiptImage: { name: string; url: string } | undefined;

        if (receiptFile) {
            setIsUploading(true);
            try {
                // Compress first
                const compressedFile = await compressImage(receiptFile, 1024, 0.7);
                receiptImage = await onFileUpload(compressedFile, 'payment_receipt');
            } catch (error) {
                console.error(error);
                alert('فشل رفع صورة الإيصال');
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        onSave({ amount, date: correctedDate, notes, linkedTransactionId, receiptImage });
        setReceiptFile(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`إضافة سداد لـ ${client.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">مبلغ السداد</label>
                    <input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || '')} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">تاريخ السداد</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">ربط هذا السداد بحركة معينة (اختياري)</label>
                    <select value={linkedTransactionId} onChange={e => setLinkedTransactionId(e.target.value)} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300">
                        <option value="">-- لا يوجد ربط --</option>
                        {unsettledTransactions.map(t => (
                            <option key={t.id} value={t.id}>
                                {`حركة بتاريخ ${formatDate(t.date)} - بمبلغ ${formatCurrency(t.amount)}`}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">ملاحظات</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300 resize-none"></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium">صورة الإيصال (اختياري)</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                    />
                    {receiptFile && (
                        <p className="text-xs text-gray-500 mt-1">تم اختيار: {receiptFile.name}</p>
                    )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">إلغاء</button>
                    <button type="submit" disabled={isUploading} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        {isUploading ? 'جاري الرفع...' : 'حفظ السداد'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}


const EntityModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; buyerName: string; auctionDate: string }) => void;
    entity: Entity | null;
    predefinedBuyers: PredefinedBuyer[];
    onOpenPredefinedBuyerModal: () => void;
}> = ({ isOpen, onClose, onSave, entity, predefinedBuyers, onOpenPredefinedBuyerModal }) => {
    const [name, setName] = useState('');
    const [buyerName, setBuyerName] = useState('');
    const [auctionDateString, setAuctionDateString] = useState('');

    useEffect(() => {
        if (entity) {
            setName(entity.name);
            setBuyerName(entity.buyerName || '');
            // Convert Firestore Timestamp to 'YYYY-MM-DD' string for the input
            if (entity.auctionDate && typeof entity.auctionDate.toDate === 'function') {
                try {
                    setAuctionDateString(entity.auctionDate.toDate().toISOString().split('T')[0]);
                } catch (e) {
                    setAuctionDateString('');
                }
            }
        } else {
            // New entity: today's date (UTC) as YYYY-MM-DD string
            setAuctionDateString(new Date().toISOString().split('T')[0]);
            setBuyerName('');
        }
    }, [entity, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, buyerName, auctionDate: auctionDateString });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={entity ? 'تعديل الجهة' : 'إضافة جهة جديدة'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم الجهة</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300" required />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">اسم المشتري</label>
                    <select
                        value={buyerName}
                        onChange={(e) => {
                            if (e.target.value === 'add_new') {
                                onOpenPredefinedBuyerModal();
                            } else {
                                setBuyerName(e.target.value);
                            }
                        }}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                    >
                        <option value="">-- اختر مشتري --</option>
                        {predefinedBuyers.map(buyer => <option key={buyer.id} value={buyer.name}>{buyer.name}</option>)}
                        <option value="add_new" className="font-bold text-blue-600">-- إضافة مشتري جديد --</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الجلسة</label>
                    <input
                        type="date"
                        value={auctionDateString}
                        onChange={e => setAuctionDateString(e.target.value)}
                        className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none bg-white hover:border-gray-300"
                        required
                    />
                </div>
                <div className="mt-4 flex justify-end">
                    <button type="submit" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                        {entity ? 'حفظ التعديلات' : 'إضافة'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};


const LotModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    lot: Lot | null;
    onFileUpload: (file: File, prefix: string) => Promise<{ name: string, url: string } | undefined>;
}> = ({ isOpen, onClose, onSave, lot, onFileUpload }) => {
    const [lotNumber, setLotNumber] = useState('');
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [quantityType, setQuantityType] = useState<'count' | 'weight'>('count');
    const [totalValue, setTotalValue] = useState<number | ''>('');
    const [value30, setValue30] = useState<number | ''>('');
    const [contractImageFile, setContractImageFile] = useState<File | null>(null);
    const [existingImage, setExistingImage] = useState<{ name: string, url: string } | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (lot) {
            setLotNumber(lot.lotNumber);
            setName(lot.name);
            const qMatch = lot.quantity.match(/([\d.]+)\s*(.*)/);
            if (qMatch) {
                setQuantity(parseFloat(qMatch[1]));
                const unit = qMatch[2].toLowerCase();
                if (unit.includes('طن') || unit.includes('kg') || unit.includes('kilo') || unit.includes('weight')) {
                    setQuantityType('weight');
                } else {
                    setQuantityType('count');
                }
            } else {
                setQuantity('');
            }
            setTotalValue(lot.totalValue);
            setValue30(lot.value30);
            setExistingImage(lot.contractImage);
            setContractImageFile(null);
        } else {
            setLotNumber('');
            setName('');
            setQuantity('');
            setQuantityType('count');
            setTotalValue('');
            setValue30('');
            setExistingImage(undefined);
            setContractImageFile(null);
        }
    }, [lot]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totalValue === '' || isNaN(totalValue)) return;
        if (value30 === '' || isNaN(value30)) return;

        let contractImage: { name: string, url: string } | undefined | null = existingImage;
        if (contractImageFile) {
            setIsUploading(true);
            try {
                // Compress first
                const compressedFile = await compressImage(contractImageFile, 1024, 0.7);
                contractImage = await onFileUpload(compressedFile, 'lot_contract');
            } catch (error) {
                console.error("Error uploading image:", error);
                alert("فشل رفع صورة العقد");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        const quantityString = (typeof quantity === 'number') ? `${quantity} ${quantityType === 'weight' ? 'طن' : 'قطعة'}` : '';

        onSave({ lotNumber, name, quantity: quantityString, totalValue, value30, contractImage });
    };

    const value70 = (typeof totalValue === 'number' && typeof value30 === 'number') ? totalValue - value30 : 0;

    const darkInputClasses = "w-full p-3 bg-gray-900 text-white rounded-md placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const darkDisplayClasses = "p-3 bg-gray-900 border border-gray-700 rounded-md text-gray-300 text-right";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={lot ? 'تعديل بيانات اللوط' : 'إضافة لوط جديد'} dialogClassName="bg-gray-800 text-gray-200">
            <form onSubmit={handleSubmit} className="space-y-4">

                <input type="text" placeholder="رقم اللوط" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className={darkInputClasses} required />

                <input type="text" placeholder="مسمى اللوط" value={name} onChange={e => setName(e.target.value)} className={darkInputClasses} required />

                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-900 border border-gray-700 rounded-md p-1">
                        <button type="button" onClick={() => setQuantityType('count')} className={`px-4 py-2 text-sm rounded-md ${quantityType === 'count' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>
                            عدد
                        </button>
                        <button type="button" onClick={() => setQuantityType('weight')} className={`px-4 py-2 text-sm rounded-md ${quantityType === 'weight' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>
                            وزن
                        </button>
                    </div>
                    <div className="flex-grow">
                        <input type="number" placeholder="الكمية" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))} className={darkInputClasses} />
                    </div>
                </div>

                <input
                    type="number"
                    placeholder="إجمالي قيمة اللوط"
                    value={totalValue}
                    onChange={e => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setTotalValue(val);
                        if (typeof val === 'number' && !isNaN(val)) {
                            setValue30(parseFloat((val * 0.3).toFixed(2)));
                        } else {
                            setValue30('');
                        }
                    }}
                    className={darkInputClasses}
                    required
                />

                <div className="flex items-center bg-gray-900 border border-gray-700 rounded-md p-0 focus-within:ring-2 focus-within:ring-blue-500">
                    <label htmlFor="lot-value-30" className="px-3 text-gray-400 whitespace-nowrap">قيمة 30%</label>
                    <input
                        id="lot-value-30"
                        type="number"
                        value={value30}
                        onChange={e => setValue30(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full p-3 bg-transparent text-white text-left focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        required
                    />
                </div>

                <div className={darkDisplayClasses}>
                    قيمة 70% (محسوبة): <span className="font-bold text-white float-left" dir="ltr">{formatCurrency(value70)}</span>
                </div>

                <div className="relative">
                    <input type="text" readOnly value={contractImageFile ? contractImageFile.name : (existingImage ? existingImage.name : '')} placeholder="إرفاق صورة العقد (اختياري)" className={`${darkInputClasses} pl-28 text-right`} />
                    <label htmlFor="contract-image-upload" className="absolute top-1/2 left-2 transform -translate-y-1/2 cursor-pointer bg-gray-700 text-gray-200 font-semibold text-sm py-1.5 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                        اختيار ملف
                    </label>
                    <input id="contract-image-upload" type="file" className="hidden" onChange={(e) => setContractImageFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                {existingImage && !contractImageFile && <a href={existingImage.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline mt-2 inline-block">عرض الصورة الحالية</a>}

                <div className="flex items-center gap-4 pt-4">
                    <button type="submit" disabled={isUploading} className="bg-green-600 text-white font-bold py-3 px-6 rounded-md hover:bg-green-700 transition-colors flex-grow disabled:opacity-50 disabled:cursor-not-allowed">
                        {isUploading ? 'جاري الرفع...' : (lot ? 'حفظ' : 'إضافة اللوط')}
                    </button>
                    <button type="button" onClick={onClose} className="bg-gray-600 text-white py-3 px-6 rounded-md hover:bg-gray-500 transition-colors flex-grow">
                        إلغاء
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default App;
