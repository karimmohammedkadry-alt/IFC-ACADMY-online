import React from 'react';
import { X, CreditCard, Award, ArrowLeft, Receipt, DollarSign } from 'lucide-react';

interface NewFinancialActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPayment: () => void;
  onSelectSalary: () => void;
}

export const NewFinancialActionModal: React.FC<NewFinancialActionModalProps> = ({
  isOpen,
  onClose,
  onSelectPayment,
  onSelectSalary,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-slate-200 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">تسجيل معاملة مالية</h3>
              <p className="text-xs text-slate-400">اختر نوع العملية المالية للمتابعة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3.5">
          {/* Option 1: Player Subscription Payment */}
          <button
            onClick={() => {
              onClose();
              onSelectPayment();
            }}
            className="w-full text-right p-4 rounded-2xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 hover:from-blue-600/20 hover:to-indigo-600/20 border border-blue-500/30 hover:border-blue-400/50 transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                  تسجيل سداد اشتراك لاعب
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تحصيل رسوم الاشتراك وإصدار إيصال رسمي للمشترك
                </p>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-[-3px] transition-all" />
          </button>

          {/* Option 2: Pay Coach Salary */}
          <button
            onClick={() => {
              onClose();
              onSelectSalary();
            }}
            className="w-full text-right p-4 rounded-2xl bg-gradient-to-r from-purple-600/10 to-indigo-600/10 hover:from-purple-600/20 hover:to-indigo-600/20 border border-purple-500/30 hover:border-purple-400/50 transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  صرف ودفع مرتب مدرب
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تسجيل سند صرف راتب شهري لأحد مدربي الأكاديمية
                </p>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-purple-400 group-hover:translate-x-[-3px] transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
};
