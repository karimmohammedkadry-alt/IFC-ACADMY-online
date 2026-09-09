import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Calendar, Phone, DollarSign, Users, CreditCard, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { Player, PaymentMethod } from '../types';
import { calculateEndDateByMonths } from '../utils/dateUtils';
import { generateNextMemberNumber, isMemberNumberUnique } from '../utils/memberNumberUtils';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Partial<Player>) => void | Promise<boolean | void>;
  playerToEdit?: Player | null;
  defaultNextMemberNumber?: string | number;
  existingPlayers?: Player[];
}

export const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  playerToEdit,
  defaultNextMemberNumber,
  existingPlayers = [],
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // All fields empty by default without hardcoded values
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    playerToEdit?.paymentMethod || 'كاش'
  );
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [memberNumber, setMemberNumber] = useState<string>('');
  const [team, setTeam] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<string>('');
  const [subscriptionDurationMonths, setSubscriptionDurationMonths] = useState<number>(1);
  const [paymentPeriodMonth, setPaymentPeriodMonth] = useState<string>(todayStr.slice(0, 7));
  const [totalSessions, setTotalSessions] = useState<number>(() => { try { return Math.max(1, Number(JSON.parse(localStorage.getItem('ifc_academy_prefs') || '{}').monthlySessions || 8)); } catch { return 8; } });
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(todayStr);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(calculateEndDateByMonths(todayStr, 1));
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state when opening or when playerToEdit changes
  useEffect(() => {
    if (playerToEdit) {
      setName(playerToEdit.name || '');
      setNationalId(playerToEdit.nationalId || '');
      setMemberNumber(playerToEdit.memberNumber ? String(playerToEdit.memberNumber) : '');
      setTeam(playerToEdit.team || '');
      setPhone(playerToEdit.phone || '');
      setParentPhone(playerToEdit.parentPhone || '');
      setMonthlyFee(playerToEdit.monthlyFee ? String(playerToEdit.monthlyFee) : '');
      const sDate = playerToEdit.subscriptionStartDate || todayStr;
      const eDate = playerToEdit.subscriptionEndDate || playerToEdit.subscriptionExpiry || calculateEndDateByMonths(sDate, 1);
      setSubscriptionStartDate(sDate);
      setSubscriptionEndDate(eDate);
      setPaymentPeriodMonth(sDate.slice(0, 7));
      setTotalSessions(Math.max(1, Number(playerToEdit.totalSessions || 8)));
      setPaymentMethod(playerToEdit.paymentMethod || 'كاش');
    } else {
      // Leave the member number blank by default; the server/database generates the next unique number.

      setName('');
      setNationalId('');
      setMemberNumber('');
      setTeam('');
      setPhone('');
      setParentPhone('');
      setMonthlyFee('');
      setSubscriptionDurationMonths(1);
      setSubscriptionStartDate(todayStr);
      setSubscriptionEndDate(calculateEndDateByMonths(todayStr, 1));
      setPaymentPeriodMonth(todayStr.slice(0, 7));
      setTotalSessions((() => { try { return Math.max(1, Number(JSON.parse(localStorage.getItem('ifc_academy_prefs') || '{}').monthlySessions || 8)); } catch { return 8; } })());
      setPaymentMethod('كاش');
    }
    setValidationError(null);
  }, [playerToEdit, isOpen, defaultNextMemberNumber]);

  // When duration or start date changes, recalculate end date automatically
  const handleDurationChange = (months: number) => {
    setSubscriptionDurationMonths(months);
    const start = subscriptionStartDate || todayStr;
    const computedEnd = calculateEndDateByMonths(start, months);
    setSubscriptionEndDate(computedEnd);
  };

  const handleStartDateChange = (val: string) => {
    setSubscriptionStartDate(val);
    if (val && !isNaN(new Date(val).getTime())) {
      const computedEnd = calculateEndDateByMonths(val, subscriptionDurationMonths);
      setSubscriptionEndDate(computedEnd);
    }
  };

  if (!isOpen) return null;

  const handleNationalIdChange = (val: string) => {
    // Only numbers, maximum 14 digits
    const cleaned = val.replace(/\D/g, '').slice(0, 14);
    setNationalId(cleaned);
  };

  const handlePhoneChange = (val: string, setter: (s: string) => void) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 11);
    setter(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('يرجى إدخال اسم اللاعب');
      return;
    }

    if (!team) {
      setValidationError('يرجى اختيار المجموعة / الفئة للاعب');
      return;
    }

    if (nationalId && nationalId.length !== 14) {
      setValidationError('الرقم القومي يجب أن يتكون من 14 رقماً بالضبط');
      return;
    }

    const startDate = subscriptionStartDate || new Date().toISOString().split('T')[0];
    let endDate = subscriptionEndDate;
    if (!endDate) {
      const calcEnd = new Date(startDate);
      calcEnd.setMonth(calcEnd.getMonth() + 1);
      endDate = calcEnd.toISOString().split('T')[0];
    }

    // Automatically determine status based on end date
    const isStillActive = new Date(endDate) >= new Date();
    const computedStatus = isStillActive ? 'نشط' : 'متأخر';

    const finalMemberNumber = memberNumber.trim();

    if (finalMemberNumber && !isMemberNumberUnique(finalMemberNumber, existingPlayers, playerToEdit?.id)) {
      setValidationError(
        `رقم العضوية (${finalMemberNumber}) مستخدم بالفعل للاعب آخر. يرجى اختيار رقم فريد أو الضغط على "توليد تلقائي".`
      );
      return;
    }

    const finalMonthlyFee = monthlyFee.trim() ? Number(monthlyFee) : 0;

    const saved = await onSave({
      id: playerToEdit?.id,
      name: name.trim(),
      nationalId: nationalId.trim() || undefined,
      memberNumber: finalMemberNumber,
      team,
      sport: 'كيك بوكسينغ',
      phone: phone.trim(),
      parentPhone: parentPhone.trim(),
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      subscriptionExpiry: endDate,
      monthlyFee: finalMonthlyFee,
      paymentMethod,
      subscriptionPlan: `اشتراك شهري (${team})`,
      status: computedStatus,
      avatarUrl: playerToEdit?.avatarUrl || '',
      attendedSessions: playerToEdit?.attendedSessions || 0,
      absentSessions: playerToEdit?.absentSessions || 0,
      attendanceRate: playerToEdit?.attendanceRate || 0,
      joinDate: playerToEdit?.joinDate || startDate,
      sessions: playerToEdit?.sessions || [],
      totalSessions: Math.max(1, Number(totalSessions || 1)),
      paymentPeriodMonth,
    });
    if (saved !== false) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative text-slate-200 max-h-[92vh] overflow-y-auto my-6 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/25">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {playerToEdit ? 'تعديل بيانات اللاعب' : 'إضافة لاعب'}
              </h3>
              <p className="text-xs text-slate-400">
                تسجيل بيانات اللاعب، طريقة الدفع وفترة الاشتراك
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

        {validationError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold animate-fadeIn">
            {validationError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Payment Method - prominent at the start */}
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <label className="block text-xs font-bold text-blue-300 mb-2 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>طريقة الدفع *</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['كاش', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                    paymentMethod === m
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                      : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Player Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اسم اللاعب بالكامل *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسم اللاعب"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all"
              />
            </div>

            {/* National ID - exactly 14 digits */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>الرقم القومي (14 رقم)</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {nationalId.length}/14
                </span>
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => handleNationalIdChange(e.target.value)}
                maxLength={14}
                placeholder="14 رقماً فقط"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all"
              />
            </div>

            {/* Member Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  رقم العضوية (كود اللاعب) *
                </label>
                <button
                  type="button"
                  onClick={() => setMemberNumber(generateNextMemberNumber(existingPlayers))}
                  className="text-[11px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1 font-bold cursor-pointer"
                  title="توليد رقم تسلسلي جديد تلقائياً"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>توليد تلقائي</span>
                </button>
              </div>
              <input
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value.trim().toUpperCase())}
                placeholder="مثال: IFC-001"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-yellow-300 font-mono font-bold focus:outline-hidden focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/20 backdrop-blur-md transition-all uppercase"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                نظام تسلسلي (حروف وأرقام مثل IFC-001) يضمن عدم التكرار.
              </p>
            </div>

            {/* Group/Team: شباب، براعم، ناشئين، بنات */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>المجموعة / الفئة *</span>
              </label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  -- اختر المجموعة / الفئة --
                </option>
                <option value="شباب" className="bg-slate-900 text-slate-200">
                  شباب
                </option>
                <option value="براعم" className="bg-slate-900 text-slate-200">
                  براعم
                </option>
                <option value="ناشئين" className="bg-slate-900 text-slate-200">
                  ناشئين
                </option>
                <option value="بنات" className="bg-slate-900 text-slate-200">
                  بنات
                </option>
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>رقم هاتف اللاعب</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value, setPhone)}
                placeholder="أدخل رقم الهاتف"
                maxLength={11}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all"
              />
            </div>

            {/* Parent Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>رقم ولي الأمر (واتساب)</span>
              </label>
              <input
                type="text"
                value={parentPhone}
                onChange={(e) => handlePhoneChange(e.target.value, setParentPhone)}
                placeholder="أدخل رقم ولي الأمر"
                maxLength={11}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all"
              />
            </div>

            {/* Subscription Duration Selection */}
            <div className="sm:col-span-2">
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
                    onClick={() => handleDurationChange(item.months)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                      subscriptionDurationMonths === item.months
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subscription Start Date - Either type or select from calendar */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>تاريخ بداية الاشتراك *</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">كتابة أو اختيار من التقويم</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={subscriptionStartDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all font-mono"
                />
              </div>
            </div>

            {/* Subscription End Date - Auto calculated after duration, but also editable */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تاريخ نهاية الاشتراك (محسوب تلقائياً) *</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-normal">محسوب تلقائياً</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={subscriptionEndDate}
                  onChange={(e) => setSubscriptionEndDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-emerald-500/30 rounded-xl px-3.5 py-2.5 text-sm text-emerald-300 focus:outline-hidden focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 backdrop-blur-md transition-all font-mono font-bold"
                />
              </div>
            </div>

            {/* Billing month + monthly sessions */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-sky-400"/><span>شهر الاشتراك / السداد *</span></label>
              <input type="month" required value={paymentPeriodMonth} onChange={e=>setPaymentPeriodMonth(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400"/><span>عدد الحصص للشهر *</span></label>
              <input type="number" min={1} max={100} required value={totalSessions} onChange={e=>setTotalSessions(Math.max(1,Math.min(100,Number(e.target.value)||1)))} className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" />
            </div>

            {/* Monthly Fee - Starts empty (no 0!) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>قيمة الاشتراك الشهري (ج.م) *</span>
              </label>
              <input
                type="text"
                required
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value.replace(/\D/g, ''))}
                placeholder="أدخل قيمة الاشتراك (مثال: 650)"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-emerald-400 font-bold focus:outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md transition-all font-mono"
              />
            </div>
          </div>

          {/* Form Actions */}
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
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{playerToEdit ? 'حفظ التعديلات' : 'إضافة لاعب'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
