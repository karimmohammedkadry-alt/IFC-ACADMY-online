import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, DollarSign, CheckCircle2, Receipt, Save, Search, Clock, Calendar } from 'lucide-react';
import { Player, PaymentRecord, PaymentMethod } from '../types';
import { calculateEndDateByMonths } from '../utils/dateUtils';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  onSavePayment: (
    payment: PaymentRecord,
    renewalInfo?: { playerId: string; durationMonths: number; newEndDate: string }
  ) => void;
  cashierName: string;
  preSelectedPlayerId?: string;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  players,
  onSavePayment,
  cashierName,
  preSelectedPlayerId,
}) => {
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('كاش');
  const [periodMonth, setPeriodMonth] = useState('اشتراك 1 شهر');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter players by name or member number
  const filteredPlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return players;
    const q = playerSearchQuery.toLowerCase().trim();
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.memberNumber).includes(q) ||
        (p.phone && p.phone.includes(q))
    );
  }, [players, playerSearchQuery]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.id === selectedPlayerId),
    [players, selectedPlayerId]
  );

  // Calculate new projected expiration date
  const projectedEndDate = useMemo(() => {
    if (!selectedPlayer) return '';
    const todayStr = new Date().toISOString().split('T')[0];
    const currentEnd = selectedPlayer.subscriptionEndDate || selectedPlayer.subscriptionExpiry;
    // If current subscription is still active in the future, extend from that end date; otherwise extend from today
    const baseDate = currentEnd && new Date(currentEnd) > new Date() ? currentEnd : todayStr;
    return calculateEndDateByMonths(baseDate, durationMonths);
  }, [selectedPlayer, durationMonths]);

  // Sync state whenever modal opens or players list updates
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPlayerSearchQuery('');

    if (preSelectedPlayerId) {
      setSelectedPlayerId(preSelectedPlayerId);
      const matched = players.find((p) => p.id === preSelectedPlayerId);
      if (matched && matched.monthlyFee) {
        setAmount(String(matched.monthlyFee));
      } else {
        setAmount('');
      }
    } else {
      setSelectedPlayerId('');
      setAmount('');
    }
    setDurationMonths(1);
    setPeriodMonth('اشتراك 1 شهر');
    setNotes('');
  }, [isOpen, preSelectedPlayerId, players]);

  if (!isOpen) return null;

  const handleSelectPlayer = (id: string) => {
    setSelectedPlayerId(id);
    const p = players.find((item) => item.id === id);
    if (p && p.monthlyFee) {
      setAmount(String(p.monthlyFee * durationMonths));
    }
  };

  const handleDurationChange = (months: number, label: string) => {
    setDurationMonths(months);
    setPeriodMonth(`اشتراك ${label}`);
    if (selectedPlayer && selectedPlayer.monthlyFee) {
      setAmount(String(selectedPlayer.monthlyFee * months));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPlayer) {
      setError('يرجى اختيار اللاعب أولاً قبل تأكيد السداد');
      return;
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('يرجى إدخال مبلغ سداد صحيح أكبر من 0');
      return;
    }

    const finalPeriod = periodMonth.trim() || `اشتراك ${durationMonths} شهر`;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'اشتراك لاعب',
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      memberNumber: selectedPlayer.memberNumber,
      team: selectedPlayer.team,
      amount: numericAmount,
      method,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      periodMonth: finalPeriod,
      status: 'مدفوع',
      notes: notes.trim() || `سداد ${finalPeriod} - تجديد حتى ${projectedEndDate}`,
      collectedBy: cashierName || 'مسؤول الخزينة',
    };

    onSavePayment(newPayment, {
      playerId: selectedPlayer.id,
      durationMonths,
      newEndDate: projectedEndDate,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-slate-200 animate-scaleUp max-h-[92vh] overflow-y-auto my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/25">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">تسجيل وتجديد اشتراك لاعب</h3>
              <p className="text-xs text-slate-400">إصدار إيصال تحصيل وتحديث مدة الاشتراك تلقائياً</p>
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
          {/* Player Search & Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>البحث عن اللاعب (بالاسم أو رقم العضوية) *</span>
              <span className="text-[10px] text-blue-400 font-normal">تسلسل الحروف والأرقام</span>
            </label>

            {/* Quick search input */}
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                placeholder="اكتب اسم اللاعب أو رقم العضوية للبحث السريع..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl pr-9 pl-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400 backdrop-blur-md"
              />
            </div>

            {players.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
                لا يوجد لاعبون مسجلون حالياً. يرجى إضافة لاعب أولاً.
              </div>
            ) : (
              <select
                value={selectedPlayerId}
                onChange={(e) => handleSelectPlayer(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  -- اختر اللاعب المشترك ({filteredPlayers.length} متاح) --
                </option>
                {filteredPlayers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.name} (عضوية #{p.memberNumber}) - {p.team} - {p.monthlyFee} ج.م
                  </option>
                ))}
              </select>
            )}

            {/* Selected Player Info Card */}
            {selectedPlayer && (
              <div className="mt-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{selectedPlayer.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                      #{selectedPlayer.memberNumber}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    نهاية الاشتراك الحالية: <span className="text-amber-300 font-mono">{selectedPlayer.subscriptionEndDate || 'غير محدد'}</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block">الاشتراك الشهري</span>
                  <span className="font-bold text-emerald-400 font-mono">{selectedPlayer.monthlyFee} ج.م</span>
                </div>
              </div>
            )}
          </div>

          {/* Subscription Duration Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>مدة الاشتراك *</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'شهر (1)', months: 1 },
                { label: '3 شهور', months: 3 },
                { label: '6 شهور', months: 6 },
                { label: 'سنة (12)', months: 12 },
              ].map((item) => (
                <button
                  key={item.months}
                  type="button"
                  onClick={() => handleDurationChange(item.months, item.label)}
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                    durationMonths === item.months
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                      : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Projected End Date Notification */}
          {selectedPlayer && projectedEndDate && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>تاريخ التجديد ونهاية الاشتراك الجديد:</span>
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{projectedEndDate}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                المبلغ المسدد (ج.م) *
              </label>
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="المبلغ بالجنية"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-400 focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                بيان الاشتراك
              </label>
              <input
                type="text"
                required
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                placeholder="مثال: اشتراك شهر جاري"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 backdrop-blur-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              طريقة السداد والتحصيل *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['كاش', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                    method === m
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25'
                      : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ملاحظات إضافية (اختياري)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تجديد اشتراك، خصم إخوة..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400 backdrop-blur-md"
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
              disabled={players.length === 0}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Receipt className="w-4 h-4" />
              <span>تأكيد تسجيل السداد وتجديد الاشتراك</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
