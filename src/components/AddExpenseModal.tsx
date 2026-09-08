import React, { useState } from 'react';
import { X, Banknote, DollarSign, Save } from 'lucide-react';
import { ExpenseRecord, PaymentMethod } from '../types';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: ExpenseRecord) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseRecord['category']>('إيجار ملاعب');
  const [amount, setAmount] = useState<string>('');
  const [paidTo, setPaidTo] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('كاش');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategory('إيجار ملاعب');
      setAmount('');
      setPaidTo('');
      setMethod('كاش');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    const newExpense: ExpenseRecord = {
      id: `exp-${Date.now()}`,
      title: title.trim(),
      category,
      amount: numericAmount,
      date: new Date().toISOString().split('T')[0],
      paidTo: paidTo.trim() || 'جهة غير محددة',
      method,
      notes: notes.trim(),
    };

    onSaveExpense(newExpense);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md" dir="rtl">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-200 animate-scaleUp">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold backdrop-blur-md">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">تسجيل سند صرف ومصروفات</h3>
              <p className="text-xs text-slate-400">توثيق المصروفات ومراقبة التدفقات المالية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              بيان الصرف (عنوان المصروف) *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: حجز ملعب إضافي / صيانة كرات..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                تصنيف المصروف *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md"
              >
                <option value="إيجار ملاعب" className="bg-slate-900 text-slate-200">إيجار ملاعب</option>
                <option value="رواتب مدربين" className="bg-slate-900 text-slate-200">رواتب مدربين</option>
                <option value="أدوات ومعدات" className="bg-slate-900 text-slate-200">أدوات ومعدات</option>
                <option value="صيانة وكهرباء" className="bg-slate-900 text-slate-200">صيانة وكهرباء</option>
                <option value="تسويق وإعلان" className="bg-slate-900 text-slate-200">تسويق وإعلان</option>
                <option value="أخرى" className="bg-slate-900 text-slate-200">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                المبلغ المصروف (ج.م) *
              </label>
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="أدخل المبلغ (ج.م)"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-rose-400 focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                الجهة المستلمة / المدفوع له
              </label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="اسم الكابتن أو المورد..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                طريقة الدفع
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md"
              >
                <option value="كاش" className="bg-slate-900 text-slate-200">كاش</option>
                <option value="فودافون كاش" className="bg-slate-900 text-slate-200">فودافون كاش</option>
                <option value="بطاقة ائتمانية" className="bg-slate-900 text-slate-200">بطاقة ائتمانية</option>
                <option value="إنستاباي" className="bg-slate-900 text-slate-200">إنستاباي</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ملاحظات إضافية
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="رقم الفاتورة المرفقة أو تفاصيل الإذن..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 backdrop-blur-md"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>تسجيل المصروف</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
