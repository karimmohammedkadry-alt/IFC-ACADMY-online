import React from 'react';
import {
  X,
  User,
  Phone,
  Calendar,
  CreditCard,
  Award,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Edit3,
  Receipt,
  FileText,
} from 'lucide-react';
import { Player, PaymentRecord, MonthlyArchiveRecord, SessionRecord } from '../types';
import { formatDateTimeArabic } from '../utils/dateUtils';

interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  payments: PaymentRecord[];
  onEditPlayer: (player: Player) => void;
  onOpenPaymentForPlayer: (player: Player) => void;
  isAmountsVisible?: boolean;
  monthlyArchives?: MonthlyArchiveRecord[];
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  onClose,
  player,
  payments,
  onEditPlayer,
  onOpenPaymentForPlayer,
  isAmountsVisible = true,
  monthlyArchives = [],
}) => {
  if (!isOpen || !player) return null;

  const playerPayments = payments.filter(
    (p) =>
      p.playerId === player.id ||
      p.playerName.trim().toLowerCase() === player.name.trim().toLowerCase()
  );

  const archivedPayments = monthlyArchives.flatMap((a) => (a.payments || []).filter((p) => p.playerId === player.id || (p.playerName || '').trim().toLowerCase() === player.name.trim().toLowerCase()).map((p) => ({ ...p, __month: a.monthLabel })));
  const archivedAttendance: Array<SessionRecord & { __month: string }> = monthlyArchives.flatMap((a) => (a.attendance || []).filter((s: any) => s.playerId === player.id).map((s: any) => ({ ...s, __month: a.monthLabel })));
  const allPlayerPayments = [...playerPayments, ...archivedPayments.filter((ap) => !playerPayments.some((p) => p.id === ap.id))];
  const totalPaid = allPlayerPayments.reduce((sum, p) => sum + p.amount, 0);
  const subscriptionPayments = allPlayerPayments.filter((p) => p.type !== 'راتب مدرب');
  const renewals = subscriptionPayments.filter((p) => p.coverageStart || p.coverageEnd || p.durationMonths || p.periodMonth);
  const allPlayerAttendance = [...(player.sessions || []), ...archivedAttendance.filter((as) => !(player.sessions || []).some((s) => s.id === as.id))];


  const formatMoney = (amount: number) => {
    if (!isAmountsVisible) return '•••• ج.م';
    return `${amount.toLocaleString()} ج.م`;
  };

  const getCleanPhone = (phoneStr: string) => {
    return phoneStr.replace(/[^0-9]/g, '');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative text-slate-200 animate-scaleUp my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-lg backdrop-blur-md">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg sm:text-xl text-white">{player.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  #{player.memberNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    player.status === 'نشط'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {player.status === 'نشط' ? 'اشتراك ساري' : 'متأخر عن السداد'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                الفئة / الفرقة: <span className="text-white font-semibold">{player.team}</span>
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

        {/* Quick Action Bar */}
        <div className="flex items-center gap-2.5 mb-5 flex-wrap">
          <button
            onClick={() => {
              onClose();
              onOpenPaymentForPlayer(player);
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>تسجيل سداد اشتراك</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onEditPlayer(player);
            }}
            className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-semibold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-blue-400" />
            <span>تعديل البيانات</span>
          </button>

          {player.parentPhone && (
            <a
              href={`https://wa.me/2${getCleanPhone(player.parentPhone)}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>مراسلة ولي الأمر (واتساب)</span>
            </a>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
          {/* National ID */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-slate-400 block mb-1">الرقم القومي (14 رقم)</span>
            <div className="text-sm font-mono font-bold text-white tracking-wider">
              {player.nationalId ? player.nationalId : 'غير مسجل'}
            </div>
          </div>

          {/* Monthly Fee */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-slate-400 block mb-1">قيمة الاشتراك الشهري</span>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {formatMoney(player.monthlyFee)}
            </div>
          </div>

          {/* Player Phone */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-slate-400 block mb-1">هاتف اللاعب</span>
            <div className="text-sm font-mono text-white flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              <span>{player.phone || 'غير مدخل'}</span>
            </div>
          </div>

          {/* Parent Phone */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-slate-400 block mb-1">هاتف ولي الأمر</span>
            <div className="text-sm font-mono text-white flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{player.parentPhone || 'غير مدخل'}</span>
            </div>
          </div>

          {/* Subscription Dates */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>فترة الاشتراك الحالية</span>
            </span>
            <div className="text-xs text-slate-200 mt-1 font-mono">
              من: <span className="text-white font-bold">{player.subscriptionStartDate}</span> إلى:{' '}
              <span className="text-blue-400 font-bold">{player.subscriptionEndDate}</span>
            </div>
          </div>

          {/* Total Paid */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>إجمالي مدفوعات اللاعب</span>
            </span>
            <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">{formatMoney(totalPaid)} <span className="text-[11px] text-slate-400 font-normal">({subscriptionPayments.length} سداد)</span></div>
          </div>

        </div>

        {/* Attendance Statistics */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-5">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" />
              <span>إحصائيات الحضور والالتزام بالتدريب</span>
            </span>
            <span className="font-mono text-blue-400 font-bold text-sm">
              نسبة الالتزام: {player.attendanceRate}%
            </span>
          </h4>

          {/* Progress bar */}
          <div className="w-full bg-white/10 rounded-full h-2 mb-3.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                player.attendanceRate >= 75
                  ? 'bg-emerald-500'
                  : player.attendanceRate >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${player.attendanceRate}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5">
              <div className="text-[10px] text-slate-400">إجمالي الحصص</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {player.totalSessions}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-[10px] text-emerald-400">حضور</div>
              <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                {player.attendedSessions}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="text-[10px] text-rose-400">غياب</div>
              <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                {player.absentSessions}
              </div>
            </div>
          </div>

          {/* Detailed Absences & Attendance Table */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>سجل الحصص والغياب بالتفصيل</span>
              </span>
              {player.absentSessions > 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {player.absentSessions} حصص غياب مسجلة
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  ملتزم بكافة الحصص
                </span>
              )}
            </div>

            {player.sessions && player.sessions.length > 0 ? (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-white/[0.05] text-slate-300 border-b border-white/10 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">التاريخ</th>
                      <th className="py-2 px-3">اليوم</th>
                      <th className="py-2 px-3 text-center">حالة الحضور</th>
                      <th className="py-2 px-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {player.sessions
                      .slice()
                      .sort((a, b) => (a.date > b.date ? -1 : 1))
                      .map((sess, idx) => {
                        const sessDate = new Date(sess.date);
                        const dayName = isNaN(sessDate.getTime())
                          ? ''
                          : sessDate.toLocaleDateString('ar-EG', { weekday: 'long' });
                        const isAbsent = sess.status === 'غائب';

                        return (
                          <tr
                            key={idx}
                            className={isAbsent ? 'bg-rose-500/10 hover:bg-rose-500/15' : 'hover:bg-white/[0.02]'}
                          >
                            <td className="py-2 px-3 font-mono text-slate-200 font-semibold">{sess.date}</td>
                            <td className="py-2 px-3 text-slate-400">{dayName}</td>
                            <td className="py-2 px-3 text-center">
                              {isAbsent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] shadow-sm">
                                  <XCircle className="w-3 h-3" />
                                  <span>غائب</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>حاضر</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-[10px]">
                              {isAbsent ? (
                                <span className="text-rose-300 font-semibold">غياب مسجل في الملف</span>
                              ) : (
                                <span className="text-slate-400">حضور تدريب</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-3 px-2 text-center text-[11px] text-slate-500 bg-white/[0.02] rounded-lg border border-white/5">
                لم يتم تسجيل حصص لهذا اللاعب بعد.
              </div>
            )}
          </div>
        </div>

        {/* Archived history: remains visible after monthly reset */}
        <div className="mb-5 p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-400" /><span>السجل المؤرشف للاعب</span></h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
            <div className="p-2 rounded-lg bg-white/[0.03]"><span className="text-slate-400">مدفوعات مؤرشفة</span><div className="font-bold text-emerald-400 mt-1">{archivedPayments.length}</div></div>
            <div className="p-2 rounded-lg bg-white/[0.03]"><span className="text-slate-400">حضور مؤرشف</span><div className="font-bold text-blue-400 mt-1">{archivedAttendance.filter(s => s.status === 'حاضر').length}</div></div>
            <div className="p-2 rounded-lg bg-white/[0.03]"><span className="text-slate-400">غياب مؤرشف</span><div className="font-bold text-rose-400 mt-1">{archivedAttendance.filter(s => s.status === 'غائب').length}</div></div>
          </div>
          {archivedAttendance.length > 0 ? <div className="max-h-28 overflow-y-auto text-[10px] text-slate-300 space-y-1">{archivedAttendance.slice().sort((a,b)=>a.date<b.date?1:-1).map((s,i)=><div key={`${s.id}-${i}`} className="flex justify-between border-b border-white/5 pb-1"><span>{s.date} · {s.__month}</span><span className={s.status==='غائب'?'text-rose-300':s.status==='بعذر'?'text-amber-300':'text-emerald-300'}>{s.status}</span></div>)}</div> : <div className="text-[10px] text-slate-500">لا يوجد حضور مؤرشف لهذا اللاعب.</div>}
        </div>

        {/* Renewals History */}
        <div className="mb-5">
          <h4 className="text-xs font-bold text-white mb-2.5 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-400" /><span>سجل التجديدات والفترات المسددة</span></h4>
          {renewals.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">لا توجد عمليات تجديد مسجلة بعد.</div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {renewals.map((pay) => (
                <div key={pay.id} className="p-2.5 rounded-xl bg-blue-500/[0.04] border border-blue-500/10 flex items-center justify-between text-xs">
                  <div><div className="font-bold text-white">{pay.periodMonth}</div><div className="text-[10px] text-slate-400 mt-1">من {pay.coverageStart || '—'} إلى {pay.coverageEnd || '—'} · {pay.durationMonths || 1} شهر · إيصال {pay.invoiceNumber}</div></div>
                  <div className="text-left"><div className="font-mono font-bold text-emerald-400">{formatMoney(pay.amount)}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments History */}
        <div>
          <h4 className="text-xs font-bold text-white mb-2.5 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>سجل الإيصالات والمدفوعات الخاصة باللاعب</span>
          </h4>

          {playerPayments.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
              لا توجد إيصالات سداد مسجلة لهذا اللاعب حتى الآن.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {playerPayments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-blue-400 ml-2">
                      {pay.invoiceNumber}
                    </span>
                    <span className="text-slate-300">{pay.periodMonth}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      طريقة السداد: {pay.method} | تاريخ ووقت السداد: {formatDateTimeArabic(pay.createdAt || pay.date)}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-emerald-400">
                    {formatMoney(pay.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
