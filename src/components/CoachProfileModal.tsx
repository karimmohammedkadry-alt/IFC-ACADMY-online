import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Calendar,
  DollarSign,
  Edit3,
  Trash2,
  Receipt,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertTriangle,
  Save,
  Check,
} from 'lucide-react';
import { Coach, PaymentRecord } from '../types';
import { formatDateTimeArabic } from '../utils/dateUtils';

interface CoachProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  coach: Coach | null;
  payments: PaymentRecord[];
  onUpdateCoach: (id: string, updates: Partial<Coach>) => void;
  onPaySalary: (coachId: string) => void;
  onDeleteCoach: (coachId: string) => void;
  isAmountsVisible?: boolean;
}

export const CoachProfileModal: React.FC<CoachProfileModalProps> = ({
  isOpen,
  onClose,
  coach,
  payments,
  onUpdateCoach,
  onPaySalary,
  onDeleteCoach,
  isAmountsVisible = true,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editTeams, setEditTeams] = useState<string[]>([]);

  const availableGroups = ['شباب', 'براعم', 'ناشئين', 'بنات'];

  useEffect(() => {
    if (coach) {
      setEditName(coach.name.replace(/^كابتن\s*\/\s*/, ''));
      setEditPhone(coach.phone || '');
      setEditSalary(coach.monthlySalary ? String(coach.monthlySalary) : '');
      setEditTeams(coach.teams || []);
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [coach, isOpen]);

  if (!isOpen || !coach) return null;

  // Find all salary payment records for this coach
  const coachPayments = payments.filter(
    (p) =>
      p.type === 'راتب مدرب' &&
      (p.coachId === coach.id ||
        p.playerId === coach.id ||
        p.playerName.trim().toLowerCase() === coach.name.trim().toLowerCase())
  );

  const totalPaidSalaries = coachPayments.reduce((sum, p) => sum + p.amount, 0);

  const formatMoney = (amount: number) => {
    if (!isAmountsVisible) return '•••• ج.م';
    return `${amount.toLocaleString()} ج.م`;
  };

  const getCleanPhone = (phoneStr: string) => {
    return phoneStr.replace(/[^0-9]/g, '');
  };

  const handleGroupToggle = (groupName: string) => {
    if (editTeams.includes(groupName)) {
      setEditTeams(editTeams.filter((g) => g !== groupName));
    } else {
      setEditTeams([...editTeams, groupName]);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const formattedName = editName.trim().startsWith('كابتن')
      ? editName.trim()
      : `كابتن / ${editName.trim()}`;

    onUpdateCoach(coach.id, {
      name: formattedName,
      phone: editPhone.trim(),
      monthlySalary: editSalary.trim() ? Number(editSalary) : 0,
      teams: editTeams,
    });

    setIsEditing(false);
  };

  const handleDelete = () => {
    onDeleteCoach(coach.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative text-slate-200 animate-scaleUp my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xl backdrop-blur-md">
              {coach.name.replace('كابتن / ', '').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-lg sm:text-xl text-white">{coach.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {coach.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تاريخ الانضمام للأكاديمية:{' '}
                <span className="text-white font-mono font-medium">
                  {coach.joinDate || '2024-01-01'}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Bar (when not editing) */}
        {!isEditing && (
          <div className="flex items-center gap-2.5 mb-5 flex-wrap">
            <button
              onClick={() => {
                onClose();
                onPaySalary(coach.id);
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              <span>صرف راتب جديد</span>
            </button>

            <button
              onClick={() => setIsEditing(true)}
              className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-blue-400" />
              <span>تعديل البيانات</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المدرب</span>
            </button>
          </div>
        )}

        {/* Delete Confirmation Popup within modal */}
        {showDeleteConfirm && (
          <div className="mb-5 p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 animate-fadeIn">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white mb-1">
                  تأكيد حذف المدرب ({coach.name})
                </h4>
                <p className="text-xs text-rose-200/80 mb-3">
                  هل أنت متأكد من رغبتك في حذف هذا المدرب من قاعدة البيانات؟ لن يتم حذف سجلات الرواتب السابقة التي تم صرفها.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    نعم، حذف نهائي
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Editing Mode Form */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4 mb-6 p-4 rounded-xl bg-white/[0.03] border border-purple-500/30">
            <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2 mb-3">
              <Edit3 className="w-4 h-4" />
              <span>تعديل بيانات المدرب</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اسم الكابتن / المدرب *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-purple-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  الراتب الشهري (ج.م) *
                </label>
                <input
                  type="text"
                  required
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-purple-300 font-bold font-mono focus:outline-hidden focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم الهاتف (واتساب)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-purple-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                المجموعات المسندة
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableGroups.map((group) => {
                  const isSelected = editTeams.includes(group);
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => handleGroupToggle(group)}
                      className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/25 border-purple-500/50 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{group}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-purple-500/25 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </form>
        ) : (
          /* Info Grid (View Mode) */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Monthly Salary */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
              <span className="text-slate-400 text-xs flex items-center gap-1.5 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                الراتب الشهري الأساسي
              </span>
              <div className="text-lg font-bold font-mono text-purple-300">
                {formatMoney(coach.monthlySalary)}
              </div>
            </div>

            {/* Last Disbursed Salary Month */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
              <span className="text-slate-400 text-xs flex items-center gap-1.5 mb-1">
                <Calendar className="w-4 h-4 text-purple-400" />
                آخر شهر تم صرف راتبه
              </span>
              <div className="text-sm font-bold text-white">
                {coach.lastSalaryPaidMonth ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {coach.lastSalaryPaidMonth}
                  </span>
                ) : (
                  <span className="text-slate-400">لم يسجل صرف حتى الآن</span>
                )}
              </div>
            </div>

            {/* Phone & WhatsApp */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
              <span className="text-slate-400 text-xs flex items-center gap-1.5 mb-1">
                <Phone className="w-4 h-4 text-blue-400" />
                رقم الهاتف والتواصل
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-white text-sm font-bold">{coach.phone}</span>
                {coach.phone && (
                  <a
                    href={`https://wa.me/2${getCleanPhone(coach.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>واتساب</span>
                  </a>
                )}
              </div>
            </div>

            {/* Assigned Teams / Groups */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
              <span className="text-slate-400 text-xs flex items-center gap-1.5 mb-1.5">
                <Users className="w-4 h-4 text-yellow-400" />
                المجموعات المسندة للتدريب
              </span>
              <div className="flex flex-wrap gap-1.5">
                {coach.teams && coach.teams.length > 0 ? (
                  coach.teams.map((team, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-semibold"
                    >
                      {team}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">لا توجد مجموعات</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Salary History */}
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-400" />
              <span>سجل صرف الرواتب ({coachPayments.length})</span>
            </h3>
            {coachPayments.length > 0 && (
              <span className="text-xs text-slate-400">
                إجمالي المنصرف: <strong className="text-emerald-400 font-mono">{formatMoney(totalPaidSalaries)}</strong>
              </span>
            )}
          </div>

          {coachPayments.length === 0 ? (
            <div className="text-center py-8 bg-white/[0.02] border border-white/5 rounded-xl text-slate-400 text-xs">
              <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p>لا توجد سندات صرف رواتب مسجلة لهذا المدرب حتى الآن.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                يمكنك الضغط على زر "صرف راتب جديد" في الأعلى لإصدار سند صرف رسمي.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {coachPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-white/[0.03] border border-white/5 hover:border-white/15 rounded-xl p-3 flex items-center justify-between text-xs transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{payment.periodMonth || 'راتب شهر'}</span>
                        <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-sm">
                          {payment.invoiceNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formatDateTimeArabic(payment.createdAt || payment.date)}
                        </span>
                        <span>•</span>
                        <span>طريقة الدفع: {payment.method}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="font-bold font-mono text-emerald-400 text-sm">
                      {formatMoney(payment.amount)}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      بواسطة: {payment.collectedBy || 'الإدارة'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end mt-6 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
