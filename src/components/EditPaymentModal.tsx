import React, { useState, useEffect } from 'react';
import { notifyToast } from '../utils/toast';
import { X, Save, CreditCard, Calendar, User, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { PaymentRecord, PaymentMethod } from '../types';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  onSave: (updated: PaymentRecord) => void;
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  isOpen,
  onClose,
  payment,
  onSave,
}) => {
  if (!isOpen || !payment) return null;

  const [playerName, setPlayerName] = useState(payment.playerName);
  const [memberNumber, setMemberNumber] = useState(payment.memberNumber || '');
  const [amount, setAmount] = useState(payment.amount.toString());
  const [method, setMethod] = useState<PaymentMethod>(payment.method);
  const [date, setDate] = useState(payment.date);
  const [periodMonth, setPeriodMonth] = useState(payment.periodMonth);
  const [status, setStatus] = useState<'مدفوع' | 'معلق' | 'مسترجع'>(payment.status || 'مدفوع');
  const [notes, setNotes] = useState(payment.notes || '');
  const [collectedBy, setCollectedBy] = useState(payment.collectedBy);

  useEffect(() => {
    if (payment) {
      setPlayerName(payment.playerName);
      setMemberNumber(payment.memberNumber || '');
      setAmount(payment.amount.toString());
      setMethod(payment.method);
      setDate(payment.date);
      setPeriodMonth(payment.periodMonth);
      setStatus(payment.status || 'مدفوع');
      setNotes(payment.notes || '');
      setCollectedBy(payment.collectedBy);
    }
  }, [payment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      notifyToast('error', 'تنبيه النظام', 'يرجى إدخال مبلغ صحيح.');
      return;
    }

    const updated: PaymentRecord = {
      ...payment,
      playerName: playerName.trim(),
      memberNumber: memberNumber ? String(memberNumber) : undefined,
      amount: numAmount,
      method,
      date,
      periodMonth,
      status,
      notes,
      collectedBy,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-200 animate-scaleUp my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تعديل بيانات السند المالي</h3>
              <p className="text-xs text-slate-400 font-mono">إيصال: {payment.invoiceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Player / Beneficiary Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              {payment.type === 'راتب مدرب' ? 'اسم المدرب' : 'اسم اللاعب'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl pr-9 pl-3 py-2.5 text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400"
              />
            </div>
          </div>

          {/* Member Number & Amount */}
          <div className="grid grid-cols-2 gap-3">
            {payment.type !== 'راتب مدرب' && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">كود العضوية</label>
                <input
                  type="text"
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value)}
                  placeholder="IFC-001"
                  className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-blue-400"
                />
              </div>
            )}

            <div className={payment.type === 'راتب مدرب' ? 'col-span-2' : ''}>
              <label className="block text-slate-300 font-semibold mb-1.5">المبلغ (ج.م)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/15 rounded-xl pr-9 pl-3 py-2.5 text-white font-mono font-bold focus:outline-hidden focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Payment Method & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">طريقة الدفع</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-hidden focus:border-blue-400 cursor-pointer"
              >
                <option value="كاش" className="bg-slate-900 text-slate-200">كاش (الخزينة)</option>
                <option value="فودافون كاش" className="bg-slate-900 text-slate-200">فودافون كاش</option>
                <option value="إنستاباي" className="bg-slate-900 text-slate-200">إنستاباي</option>
                <option value="بطاقة ائتمانية" className="bg-slate-900 text-slate-200">بطاقة ائتمانية</option>
                <option value="تحويل بنكي" className="bg-slate-900 text-slate-200">تحويل بنكي</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">حالة المعاملة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-hidden focus:border-blue-400 cursor-pointer"
              >
                <option value="مدفوع" className="bg-slate-900 text-emerald-400">مدفوع ومؤكد</option>
                <option value="معلق" className="bg-slate-900 text-amber-400">معلق</option>
                <option value="مسترجع" className="bg-slate-900 text-rose-400">مسترجع</option>
              </select>
            </div>
          </div>

          {/* Date & Period Month */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">تاريخ المعاملة</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-hidden focus:border-blue-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">عن شهر</label>
              <input
                type="text"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                placeholder="اشتراك شهر مايو"
                className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-hidden focus:border-blue-400"
              />
            </div>
          </div>

          {/* Collected By */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">المسؤول عن المعاملة</label>
            <input
              type="text"
              value={collectedBy}
              onChange={(e) => setCollectedBy(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-hidden focus:border-blue-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">ملاحظات إضافية</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات حول هذا السند..."
              className="w-full bg-white/[0.04] border border-white/15 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
