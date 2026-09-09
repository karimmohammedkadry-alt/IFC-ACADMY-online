import React, { useState } from 'react';
import {
  Archive,
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Users,
  CreditCard,
  Layers,
} from 'lucide-react';
import { MonthlyArchiveRecord } from '../types';
import { formatDateTimeArabic } from '../utils/dateUtils';

interface MonthlyArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  archives: MonthlyArchiveRecord[];
  onTriggerNewMonthArchive?: () => void;
  currency?: string;
}

export const MonthlyArchiveModal: React.FC<MonthlyArchiveModalProps> = ({
  isOpen,
  onClose,
  archives,
  onTriggerNewMonthArchive,
  currency = 'ج.م',
}) => {
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>(
    archives[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'expenses'>('overview');

  if (!isOpen) return null;

  const currentArchive =
    archives.find((a) => a.id === selectedArchiveId) || archives[0];

  const handleExportCsv = () => {
    if (!currentArchive) return;
    const headers = ['رقم السند', 'المستفيد', 'المبلغ', 'طريقة الدفع', 'التاريخ', 'الحالة'];
    const rows = currentArchive.payments.map((p) => [
      p.invoiceNumber,
      p.playerName,
      p.amount,
      p.method,
      p.date,
      p.status,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_أرشيف_${currentArchive.monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0b1120] border border-white/15 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-white/[0.02] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Archive className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                أرشيف الشهور السابقة والتقارير المالية الدورية
              </h3>
              <p className="text-xs text-slate-400">
                استعراض سجلات الأشهر المؤرشفة، صافي الأرباح، وكشوف المقبوضات والمصروفات المغلقة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              أرشفة وتصفير تلقائي أول كل شهر
            </span>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {archives.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <Archive className="w-8 h-8 opacity-60" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">لا توجد تقارير مؤرشفة حتى الآن</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                يقوم النظام تلقائياً أول يوم من كل شهر ميلادي بأرشفة وحفظ كافة معاملات وإيرادات ومصروفات الشهر المنتهي وتنزيلها في هذا السجل الدائم، مع تصفير العداد وبدء الدورة الجديدة.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Archive Selector & Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span>اختر دورة الشهر المؤرشف:</span>
                </label>
                <select
                  value={currentArchive?.id}
                  onChange={(e) => setSelectedArchiveId(e.target.value)}
                  className="bg-black/60 border border-white/20 focus:border-yellow-400 text-yellow-300 font-bold text-xs rounded-xl px-4 py-2 cursor-pointer focus:outline-hidden"
                >
                  {archives.map((arc) => (
                    <option key={arc.id} value={arc.id} className="bg-slate-900 text-white">
                      {arc.monthLabel} ({arc.monthKey}) - صافي: {arc.netProfit.toLocaleString()} {currency}
                    </option>
                  ))}
                </select>
              </div>

              {currentArchive && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير Excel</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة التقرير</span>
                  </button>
                </div>
              )}
            </div>

            {currentArchive && (
              <>
                {/* Meta info badge */}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>
                    تم إغلاق وأرشفة الدورة بتاريخ:{' '}
                    <strong className="text-slate-200">
                      {new Date(currentArchive.archivedAt).toLocaleString('ar-EG')}
                    </strong>
                  </span>
                  <span>
                    بواسطة: <strong className="text-slate-200">{currentArchive.archivedBy}</strong>
                  </span>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center justify-between text-emerald-400 mb-2">
                      <span className="text-xs font-semibold">إجمالي الإيرادات</span>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {currentArchive.totalIncome.toLocaleString()} {currency}
                    </div>
                    <div className="text-[11px] text-emerald-400/80 mt-1">
                      {currentArchive.paymentsCount} عملية تحصيل مسجلة
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center justify-between text-rose-400 mb-2">
                      <span className="text-xs font-semibold">إجمالي المصروفات</span>
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {currentArchive.totalExpenses.toLocaleString()} {currency}
                    </div>
                    <div className="text-[11px] text-rose-400/80 mt-1">
                      {currentArchive.expensesCount} سند صرف ومصروف
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center justify-between text-amber-400 mb-2">
                      <span className="text-xs font-semibold">صافي الأرباح</span>
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        currentArchive.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {currentArchive.netProfit.toLocaleString()} {currency}
                    </div>
                    <div className="text-[11px] text-amber-400/80 mt-1">
                      {currentArchive.netProfit >= 0 ? 'فائض مالي إيجابي' : 'عجز في دورة الشهر'}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between text-blue-400 mb-2">
                      <span className="text-xs font-semibold">حالة اللاعبين بالأرشيف</span>
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {currentArchive.activePlayersCount} لاعب نشط
                    </div>
                    <div className="text-[11px] text-rose-400 mt-1 font-semibold">
                      {currentArchive.overduePlayersCount} متأخر عن السداد
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-400">إجمالي اللاعبين</span>
                    <strong className="text-white">{(currentArchive.playersCount ?? currentArchive.activePlayersCount ?? 0).toLocaleString()}</strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-400">إجمالي المدربين</span>
                    <strong className="text-white">{(currentArchive.coachesCount ?? 0).toLocaleString()}</strong>
                  </div>
                </div>

                {/* Sub-tabs: Overview, Payments, Expenses */}
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-yellow-400 text-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    الملخص المالي العام
                  </button>
                  <button
                    onClick={() => setActiveTab('payments')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'payments'
                        ? 'bg-yellow-400 text-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    سندات القبض المؤرشفة ({currentArchive.payments.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'expenses'
                        ? 'bg-yellow-400 text-black'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    المصروفات المؤرشفة ({currentArchive.expenses.length})
                  </button>
                </div>

                {/* Tab content */}
                {activeTab === 'payments' && (
                  <div className="rounded-2xl border border-white/10 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-white/[0.04] text-slate-300 font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">رقم السند</th>
                          <th className="p-3">اللاعب / المستفيد</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">طريقة الدفع</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {currentArchive.payments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              لا توجد سندات مقبوضات مسجلة في هذا الشهر.
                            </td>
                          </tr>
                        ) : (
                          currentArchive.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-white/[0.02]">
                              <td className="p-3 font-mono font-bold text-yellow-400">
                                {p.invoiceNumber}
                              </td>
                              <td className="p-3 font-semibold">{p.playerName}</td>
                              <td className="p-3 font-bold text-emerald-400">
                                {p.amount.toLocaleString()} {currency}
                              </td>
                              <td className="p-3">{p.method}</td>
                              <td className="p-3 font-mono text-slate-400">{formatDateTimeArabic(p.createdAt || p.date)}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'expenses' && (
                  <div className="rounded-2xl border border-white/10 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-white/[0.04] text-slate-300 font-bold border-b border-white/10">
                        <tr>
                          <th className="p-3">بند المصروف</th>
                          <th className="p-3">التصنيف</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">الجهة المستفيدة</th>
                          <th className="p-3">طريقة الدفع</th>
                          <th className="p-3">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {currentArchive.expenses.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              لا توجد مصروفات مسجلة في هذا الشهر.
                            </td>
                          </tr>
                        ) : (
                          currentArchive.expenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-white/[0.02]">
                              <td className="p-3 font-semibold text-white">{exp.title}</td>
                              <td className="p-3 text-slate-400">{exp.category}</td>
                              <td className="p-3 font-bold text-rose-400">
                                {exp.amount.toLocaleString()} {currency}
                              </td>
                              <td className="p-3">{exp.paidTo}</td>
                              <td className="p-3">{exp.method}</td>
                              <td className="p-3 font-mono text-slate-400">{exp.date}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'overview' && (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 text-xs text-slate-300 leading-relaxed">
                    <h5 className="font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>تقرير الدورة الشهرية المؤرشفة: {currentArchive.monthLabel}</span>
                    </h5>
                    <p>
                      تم إغلاق هذه الدورة وحفظ كامل قيود المقبوضات ({currentArchive.paymentsCount} سند)
                      وقيود المصروفات ({currentArchive.expensesCount} عملية). تم تسجيل صافي دخل قدره{' '}
                      <strong className="text-yellow-400 font-bold">
                        {currentArchive.netProfit.toLocaleString()} {currency}
                      </strong>
                      . الأرشيف محفوظ بشكل دائم ولا يتأثر بالعمليات الجديدة أو تصفير الدورة.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            إجمالي الدورات المؤرشفة بالسجل: <strong>{archives.length} شهر</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
