import React from 'react';

interface SkeletonLoaderProps {
    type?: 'card' | 'table' | 'metrics' | 'list';
    count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type = 'list', count = 3 }) => {
    const renderItems = () => {
        const items = [];
        for (let i = 0; i < count; i++) {
            items.push(i);
        }
        return items;
    };

    if (type === 'metrics') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {renderItems().map((idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse">
                        <div className="flex justify-between items-center mb-4">
                            <div className="w-10 h-10 bg-slate-200/70 rounded-xl"></div>
                            <div className="w-16 h-4 bg-slate-200/70 rounded"></div>
                        </div>
                        <div className="w-32 h-8 bg-slate-200/70 rounded mb-2"></div>
                        <div className="w-24 h-3 bg-slate-100/70 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'card') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderItems().map((idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-pulse">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                            <div className="flex-1">
                                <div className="w-3/4 h-5 bg-slate-200 rounded mb-2"></div>
                                <div className="w-1/2 h-3.5 bg-slate-100 rounded"></div>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4 mt-4 space-y-3">
                            <div className="flex justify-between">
                                <div className="w-16 h-3 bg-slate-100 rounded"></div>
                                <div className="w-20 h-4 bg-slate-200 rounded"></div>
                            </div>
                            <div className="flex justify-between">
                                <div className="w-20 h-3 bg-slate-100 rounded"></div>
                                <div className="w-14 h-4 bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between">
                    <div className="w-1/4 h-4 bg-slate-200 rounded"></div>
                    <div className="w-1/6 h-4 bg-slate-200 rounded"></div>
                    <div className="w-1/6 h-4 bg-slate-200 rounded"></div>
                </div>
                <div className="p-4 space-y-4">
                    {renderItems().map((idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                            <div className="w-1/3 h-5 bg-slate-100 rounded"></div>
                            <div className="w-24 h-5 bg-slate-200 rounded"></div>
                            <div className="w-16 h-5 bg-slate-100/80 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: list of card outlines
    return (
        <div className="space-y-4">
            {renderItems().map((idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center animate-pulse">
                    <div className="space-y-2">
                        <div className="w-40 h-4 bg-slate-200 rounded"></div>
                        <div className="w-24 h-3 bg-slate-100 rounded"></div>
                    </div>
                    <div className="w-20 h-6 bg-slate-200 rounded-lg"></div>
                </div>
            ))}
        </div>
    );
};
