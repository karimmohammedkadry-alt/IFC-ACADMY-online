import React, { useState, useEffect } from 'react';
import { X, Award, DollarSign, Save, Calendar, Wallet } from 'lucide-react';
import { Coach, PaymentMethod, ExpenseRecord } from '../types';

interface PaySalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  coaches: Coach[];
  onDisburseSalary: (expense: ExpenseRecord, coachId: string, month: string) => void;
  preSelectedCoachId?: string;
}

export const PaySalaryModal: React.FC<PaySalaryModalProps> = ({
  isOpen,
  onClose,
  coaches,
  onDisburseSalary,
  preSelectedCoachId,
}) => {
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('كاش');
  const [periodMonth, setPeriodMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal opens or coaches list updates
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (preSelectedCoachId) {
      setSelectedCoachId(preSelectedCoachId);
      const matched = coaches.find((c) => c.id === preSelectedCoachId);
      if (matched) {
        setAmount(String(matched.monthlySalary));
      } else {
        setAmount('');
      }
    } else {
      setSelectedCoachId('');
      setAmount('');
    }
    setPeriodMonth('');
    setNotes('');
  }, [isOpen, preSelectedCoachId, coaches]);

  if (!isOpen) return null;

  const handleCoachSelect = (coachId: string) => {
    setSelectedCoachId(coachId);
    const coach = coaches.find((c) => c.id === coachId);
    if (coach) {
      setAmount(String(coach.monthlySalary));
    } else {
      setAmount('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const coach = coaches.find((c) => c.id === selectedCoachId);

    if (!coach) {
      setError('يرجى اختيار المدرب المراد صرف راتبه');
      return;
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح للراتب');
      return;
    }

    const finalPeriod = periodMonth.trim() || 'شهر جاري';

    const newExpense: ExpenseRecord = {
      id: `sal-${Date.now()}`,
      title: `صرف راتب ${coach.name} - ${finalPeriod}`,
      category: 'رواتب مدربين',
      amount: numericAmount,
      date: new Date().toISOString().split('T')[0],
      paidTo: coach.name,
      coachId: coach.id,
      method,
      notes: notes.trim() || `صرف راتب ${finalPeriod} للمدرب (${coach.name})`,
    };

    onDisburseSalary(newExpense, coach.id, finalPeriod);
    onClose();
  };

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-200 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/25">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">صرف ودفع مرتب مدرب</h3>
              <p className="text-xs text-slate-400">
                تسجيل سند صرف راتب مدرب وتوثيقه بالخزينة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Coach Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>اختر المدرب *</span>
            </label>
            {coaches.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
                لا يوجد مدربون مسجلون حالياً في النظام.
              </div>
            ) : (
              <select
                value={selectedCoachId}
                onChange={(e) => handleCoachSelect(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 backdrop-blur-md cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  -- اختر المدرب من القائمة --
                </option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                    {c.name} (الراتب: {c.monthlySalary} ج.م)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Coach Quick info badge */}
          {selectedCoach && (
            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">{selectedCoach.name}</span>
                <span className="text-slate-400 text-[11px] font-mono">{selectedCoach.phone}</span>
              </div>
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 block">الراتب الأساسي</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {selectedCoach.monthlySalary.toLocaleString()} ج.م
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Amount to disburse */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>المبلغ المنصرف (ج.م) *</span>
              </label>
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="المبلغ المنصرف"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-emerald-300 font-bold focus:outline-hidden focus:border-purple-400 backdrop-blur-md font-mono"
              />
            </div>

            {/* Period / Month */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>عن فترة *</span>
              </label>
              <input
                type="text"
                required
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                placeholder="مثال: شهر مايو 2024"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-purple-400 backdrop-blur-md"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-blue-400" />
              <span>طريقة الصرف والتحويل *</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['كاش', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                    method === m
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/25'
                      : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ملاحظات أو مكافآت / خصومات
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: صرف راتب الشهر مع مكافأة بطولة..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-400 backdrop-blur-md"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/10 backdrop-blur-md transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={coaches.length === 0}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>تأكيد صرف الراتب</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
