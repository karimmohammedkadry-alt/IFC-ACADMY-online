import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  User,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Award,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  Building,
  Phone,
} from 'lucide-react';
import { Player, PaymentRecord, ExpenseRecord, AcademySettings } from '../types';
import { IFCLogo } from './IFCLogo';
import { printDocument, downloadStandaloneHtmlArchive } from '../utils/printPdfUtils';

export type ExportPdfMode = 'player_statement' | 'expenses_report';

interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ExportPdfMode;
  players: Player[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  initialPlayerId?: string;
  initialMonth?: string;
  academySettings?: AcademySettings;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode,
  players,
  payments,
  expenses,
  initialPlayerId,
  initialMonth = 'مايو 2024',
}) => {
  const [currentMode, setCurrentMode] = useState<ExportPdfMode>(initialMode);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    initialPlayerId || players[0]?.id || ''
  );
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>('الكل');

  // Keep synced if initialPlayerId changes
  React.useEffect(() => {
    if (initialPlayerId) {
      setSelectedPlayerId(initialPlayerId);
    }
    setCurrentMode(initialMode);
  }, [initialPlayerId, initialMode]);

  if (!isOpen) return null;

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) || players[0];
  const playerPayments = payments.filter(
    (pay) =>
      pay.playerId === selectedPlayer?.id ||
      (selectedPlayer && pay.playerName.trim() === selectedPlayer.name.trim())
  );
  const totalPlayerPaid = playerPayments.reduce((sum, p) => sum + p.amount, 0);

  // Filter expenses
  const filteredExpenses = expenses.filter((e) => {
    if (selectedExpenseCategory === 'الكل') return true;
    return e.category === selectedExpenseCategory;
  });

  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSalaries = expenses
    .filter((e) => e.category === 'رواتب مدربين')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalRentAndTools = expenses
    .filter((e) => e.category === 'إيجار ملاعب' || e.category === 'أدوات ومعدات')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalOther = expenses
    .filter((e) => e.category !== 'رواتب مدربين' && e.category !== 'إيجار ملاعب' && e.category !== 'أدوات ومعدات')
    .reduce((sum, e) => sum + e.amount, 0);

  const documentElementId = 'ifc-pdf-printable-area';
  const currentDateFormatted = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrintPdf = () => {
    const title =
      currentMode === 'player_statement'
        ? `كشف_حساب_اللاعب_${selectedPlayer?.name || 'IFC'}`
        : 'تقرير_مصروفات_أكاديمية_IFC';
    printDocument(documentElementId, title);
  };

  const handleDownloadArchive = () => {
    const filename =
      currentMode === 'player_statement'
        ? `كشف_حساب_${selectedPlayer?.name ? selectedPlayer.name.replace(/\s+/g, '_') : 'اللاعب'}.html`
        : 'تقرير_المصروفات_الشهرية_IFC.html';
    const title =
      currentMode === 'player_statement'
        ? `كشف حساب اللاعب - ${selectedPlayer?.name}`
        : 'تقرير المصروفات الشهرية - IFC Academy';
    downloadStandaloneHtmlArchive(documentElementId, filename, title);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900/95 border border-yellow-500/30 rounded-3xl max-w-4xl w-full my-auto shadow-2xl relative text-slate-100 flex flex-col max-h-[92vh] animate-scaleUp"
      >
        {/* Top Control Bar (Hidden from Print) */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/60 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <IFCLogo size="md" withGlow />
            <div>
              <h2 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>تصدير المستندات الرسمية بصيغة PDF</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  PDF EXPORT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                معاينة وطباعة كشوفات الحساب وتقارير المصروفات وفق معايير الأرشفة المعتمدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Mode Switcher */}
            <div className="flex items-center bg-white/[0.05] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setCurrentMode('player_statement')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentMode === 'player_statement'
                    ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                كشف حساب لاعب
              </button>
              <button
                type="button"
                onClick={() => setCurrentMode('expenses_report')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentMode === 'expenses_report'
                    ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                تقرير المصروفات
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter bar for document selection */}
        <div className="px-4 sm:px-6 py-2.5 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {currentMode === 'player_statement' ? (
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <span className="text-slate-400 font-semibold shrink-0">اختر اللاعب:</span>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="bg-slate-800 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-yellow-400 w-full sm:w-64"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    #{p.memberNumber} - {p.name} ({p.team})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <span className="text-slate-400 font-semibold shrink-0">تصفية بند المصروف:</span>
              <select
                value={selectedExpenseCategory}
                onChange={(e) => setSelectedExpenseCategory(e.target.value)}
                className="bg-slate-800 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-yellow-400 w-full sm:w-56"
              >
                <option value="الكل" className="bg-slate-900">جميع بنود الصرف</option>
                <option value="رواتب مدربين" className="bg-slate-900">رواتب مدربين</option>
                <option value="إيجار ملاعب" className="bg-slate-900">إيجار ملاعب وصالات</option>
                <option value="أدوات ومعدات" className="bg-slate-900">أدوات ومعدات كيك بوكس</option>
                <option value="صيانة وكهرباء" className="bg-slate-900">صيانة وكهرباء</option>
                <option value="تسويق وإعلان" className="bg-slate-900">تسويق وإعلان</option>
                <option value="أخرى" className="bg-slate-900">أخرى</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownloadArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 border border-white/15 text-xs font-semibold transition-all cursor-pointer"
              title="تنزيل نسخة أرشيفية مستقلة يمكن فتحها بأي وقت بدون إنترنت"
            >
              <Download className="w-3.5 h-3.5 text-yellow-400" />
              <span>حفظ كملف أرشيف</span>
            </button>
            <button
              onClick={handlePrintPdf}
              id="btn-print-pdf-document"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 text-xs font-black shadow-lg shadow-yellow-500/20 transition-all cursor-pointer"
              title="طباعة مباشرة أو حفظ بتنسيق PDF من نافذة المتصفح"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة / تصدير PDF</span>
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
          {/* Real A4 Paper Simulation with White Background for Accurate PDF Export */}
          <div
            id={documentElementId}
            className="bg-white text-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 max-w-[800px] mx-auto border border-slate-200 font-sans"
            style={{ minHeight: '840px' }}
          >
            {/* Header: Official IFC Academy Header */}
            <div className="border-b-2 border-yellow-600/40 pb-5 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-yellow-500 p-0.5 shadow-md flex items-center justify-center bg-black">
                  <IFCLogo size="md" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-wider text-slate-950 uppercase font-sans m-0">
                    IFC <span className="text-yellow-600">ACADEMY</span>
                  </h1>
                  <div className="text-[11px] font-bold text-slate-700 tracking-wide">
                    INTERNATIONAL FIGHT CLUB • KICKBOXING
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    النظام الإداري والمالي المعتمد لإدارة المقاتلين والاشتراكات الرياضية
                  </div>
                </div>
              </div>

              <div className="text-left">
                <div className="inline-block px-3 py-1 rounded-md bg-slate-100 border border-slate-300 text-[11px] font-mono font-bold text-slate-800">
                  {currentMode === 'player_statement' ? 'كشف حساب لاعب معتمد' : 'تقرير مصروفات رسمي'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  تاريخ الاستخراج: {currentDateFormatted}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  كود المستند: IFC-{Math.floor(100000 + Math.random() * 900000)}
                </div>
              </div>
            </div>

            {/* Document Body depending on Mode */}
            {currentMode === 'player_statement' && selectedPlayer && (
              <div className="space-y-5">
                {/* Statement Title */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 m-0">
                      كشف حساب واشتراكات اللاعب: {selectedPlayer.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      العضوية: #{selectedPlayer.memberNumber} • {selectedPlayer.team} • {selectedPlayer.sport}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      selectedPlayer.status === 'نشط'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    حالة الاشتراك: {selectedPlayer.status === 'نشط' ? 'سارٍ ونشط' : 'متأخر عن التجديد'}
                  </span>
                </div>

                {/* Player Profile & Subscription Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">خطة الاشتراك</span>
                    <strong className="text-slate-900 font-bold mt-0.5 block">
                      {selectedPlayer.subscriptionPlan}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">قيمة الاشتراك الشهري</span>
                    <strong className="text-yellow-700 font-mono font-black text-sm mt-0.5 block">
                      {selectedPlayer.monthlyFee} ج.م
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">تاريخ بداية الاشتراك</span>
                    <strong className="text-slate-900 font-mono font-bold mt-0.5 block">
                      {selectedPlayer.subscriptionStartDate || selectedPlayer.joinDate}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">تاريخ نهاية الاشتراك</span>
                    <strong
                      className={`font-mono font-bold mt-0.5 block ${
                        selectedPlayer.status === 'نشط' ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {selectedPlayer.subscriptionEndDate || selectedPlayer.subscriptionExpiry}
                    </strong>
                  </div>
                </div>

                {/* Contact & Attendance Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">هاتف اللاعب</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPlayer.phone}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">هاتف ولي الأمر</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPlayer.parentPhone}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">نسبة التزام الحضور</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {selectedPlayer.attendanceRate}% ({selectedPlayer.attendedSessions} من {selectedPlayer.totalSessions} حصص)
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">إجمالي المسدد مسجلاً</span>
                    <span className="font-mono font-black text-emerald-700">
                      {totalPlayerPaid > 0 ? `${totalPlayerPaid.toLocaleString()} ج.م` : `${selectedPlayer.monthlyFee} ج.م`}
                    </span>
                  </div>
                </div>

                {/* Financial Transactions Table */}
                <div>
                  <h3 className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between">
                    <span>سجل المدفوعات والإيصالات المسجلة</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      عدد الإيصالات: {playerPayments.length || 1}
                    </span>
                  </h3>
                  <table className="w-full text-right text-xs border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold">
                        <th className="py-2 px-3 border border-slate-300">رقم الإيصال</th>
                        <th className="py-2 px-3 border border-slate-300">تاريخ السداد</th>
                        <th className="py-2 px-3 border border-slate-300">الفترة / البيان</th>
                        <th className="py-2 px-3 border border-slate-300">طريقة الدفع</th>
                        <th className="py-2 px-3 border border-slate-300 text-left font-mono">المبلغ</th>
                        <th className="py-2 px-3 border border-slate-300 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerPayments.length > 0 ? (
                        playerPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-slate-800">
                              {p.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 border border-slate-300 font-mono text-slate-700">
                              {p.date}
                            </td>
                            <td className="py-2 px-3 border border-slate-300 text-slate-800">
                              {p.periodMonth} - اشتراك كيك بوكسينغ
                            </td>
                            <td className="py-2 px-3 border border-slate-300 text-slate-700">
                              {p.method}
                            </td>
                            <td className="py-2 px-3 border border-slate-300 text-left font-mono font-bold text-emerald-800">
                              {p.amount.toLocaleString()} ج.م
                            </td>
                            <td className="py-2 px-3 border border-slate-300 text-center">
                              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-sm">
                                مدفوع
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2 px-3 border border-slate-300 font-mono font-bold text-slate-800">
                            INV-10{selectedPlayer.memberNumber}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 font-mono text-slate-700">
                            {selectedPlayer.subscriptionStartDate}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-800">
                            اشتراك دورة الكيك بوكسينغ الحالية
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-700">
                            كاش بالخزينة
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-left font-mono font-bold text-emerald-800">
                            {selectedPlayer.monthlyFee.toLocaleString()} ج.م
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-center">
                            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-sm">
                              مدفوع
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Training Sessions & Attendance Breakdown */}
                {selectedPlayer.sessions && selectedPlayer.sessions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-xs text-slate-800 mb-2">
                      سجل الحصص التدريبية الأخيرة
                    </h3>
                    <table className="w-full text-right text-xs border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-bold">
                          <th className="py-1.5 px-3 border border-slate-300 text-center w-16">الحصة</th>
                          <th className="py-1.5 px-3 border border-slate-300">اليوم والتاريخ</th>
                          <th className="py-1.5 px-3 border border-slate-300">توقيت الحصة</th>
                          <th className="py-1.5 px-3 border border-slate-300 text-center">حالة الحضور</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPlayer.sessions.map((s) => (
                          <tr key={s.id}>
                            <td className="py-1.5 px-3 border border-slate-300 text-center font-mono font-bold text-slate-700">
                              #{s.sessionNumber}
                            </td>
                            <td className="py-1.5 px-3 border border-slate-300 font-mono text-slate-800">
                              {s.dayName} - {s.date}
                            </td>
                            <td className="py-1.5 px-3 border border-slate-300 text-slate-700">
                              {s.time}
                            </td>
                            <td className="py-1.5 px-3 border border-slate-300 text-center font-bold">
                              {s.status === 'حاضر' ? (
                                <span className="text-emerald-700 font-bold">حاضر</span>
                              ) : (
                                <span className="text-rose-700 font-bold">غائب</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Document Body for Expenses Report */}
            {currentMode === 'expenses_report' && (
              <div className="space-y-5">
                {/* Title */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 m-0">
                      كشف تقرير المصروفات وسندات الصرف المعتمدة
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      التصنيف: {selectedExpenseCategory} • إجمالي عدد السندات: {filteredExpenses.length} سند
                    </p>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs text-slate-500 block">إجمالي المصروفات</span>
                    <span className="text-base font-black text-rose-700">
                      {totalExpensesAmount.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* Subtotals KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">رواتب المدربين</span>
                    <strong className="text-purple-700 font-mono font-black text-sm mt-0.5 block">
                      {totalSalaries.toLocaleString()} ج.م
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">إيجارات ومعدات رياضية</span>
                    <strong className="text-slate-800 font-mono font-black text-sm mt-0.5 block">
                      {totalRentAndTools.toLocaleString()} ج.م
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">صيانة وتشغيل وتسويق</span>
                    <strong className="text-slate-800 font-mono font-black text-sm mt-0.5 block">
                      {totalOther.toLocaleString()} ج.م
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">الإجمالي العام للمصروفات</span>
                    <strong className="text-rose-700 font-mono font-black text-sm mt-0.5 block">
                      {totalExpensesAmount.toLocaleString()} ج.م
                    </strong>
                  </div>
                </div>

                {/* Full Itemized Expenses Table */}
                <div>
                  <h3 className="font-bold text-xs text-slate-800 mb-2">
                    بيان سندات الصرف التفصيلية
                  </h3>
                  <table className="w-full text-right text-xs border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold">
                        <th className="py-2 px-3 border border-slate-300 text-center w-10">#</th>
                        <th className="py-2 px-3 border border-slate-300">التاريخ</th>
                        <th className="py-2 px-3 border border-slate-300">بيان وسند الصرف</th>
                        <th className="py-2 px-3 border border-slate-300">التصنيف</th>
                        <th className="py-2 px-3 border border-slate-300">المدفوع له</th>
                        <th className="py-2 px-3 border border-slate-300">طريقة الدفع</th>
                        <th className="py-2 px-3 border border-slate-300 text-left font-mono">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((exp, idx) => (
                        <tr key={exp.id}>
                          <td className="py-2 px-3 border border-slate-300 text-center font-mono text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 font-mono text-slate-700">
                            {exp.date}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 font-bold text-slate-900">
                            {exp.title}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-700">
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-sm text-[10px]">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-800 font-medium">
                            {exp.paidTo}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-slate-600">
                            {exp.method}
                          </td>
                          <td className="py-2 px-3 border border-slate-300 text-left font-mono font-bold text-rose-800">
                            {exp.amount.toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                        <td colSpan={6} className="py-2.5 px-3 border border-slate-300 text-right">
                          إجمالي المصروفات المنصرفة:
                        </td>
                        <td className="py-2.5 px-3 border border-slate-300 text-left font-mono text-rose-800 text-sm">
                          {totalExpensesAmount.toLocaleString()} ج.م
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Official Signatures and Academy Endorsement Stamp */}
            <div className="mt-8 pt-6 border-t-2 border-slate-300 flex items-end justify-between text-xs text-slate-700">
              {/* Accountant signature */}
              <div className="text-center w-40">
                <span className="font-bold text-slate-800 block mb-8">
                  المحاسب / مسؤول الخزينة
                </span>
                <div className="border-b border-dashed border-slate-400 pb-1 font-serif text-[11px] text-slate-500">
                  (التوقيع والاعتماد)
                </div>
              </div>

              {/* Official IFC Round Seal / Stamp */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-yellow-600/70 p-1 flex flex-col items-center justify-center text-center rotate-[-6deg] bg-yellow-50/40">
                  <span className="text-[9px] font-black text-yellow-800 tracking-wider font-sans">
                    IFC ACADEMY
                  </span>
                  <span className="text-[8px] font-bold text-slate-800">
                    ختم الاعتماد الرسمي
                  </span>
                  <span className="text-[7px] text-slate-500 font-mono">
                    APPROVED & VERIFIED
                  </span>
                  <span className="text-[7px] font-bold text-yellow-800 mt-0.5">
                    FIGHT CLUB
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 mt-1">مستند رسمي معتمد</span>
              </div>

              {/* Director signature */}
              <div className="text-center w-40">
                <span className="font-bold text-slate-800 block mb-8">
                  مدير عام أكاديمية IFC
                </span>
                <div className="border-b border-dashed border-slate-400 pb-1 font-serif text-[11px] text-slate-500">
                  (كابتن / المدير الإداري)
                </div>
              </div>
            </div>

            {/* Document Footer Notice */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 flex items-center justify-between">
              <span>أكاديمية IFC للكيك بوكسينغ والفنون القتالية • كشوفات وحسابات معتمدة</span>
              <span className="font-mono">صفحة 1 من 1</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-slate-950/60 rounded-b-3xl shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-yellow-400" />
            <span>
              جاهز للطباعة المباشرة على ورق A4 أو الحفظ كملف PDF رقمي عالي الدقة.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handlePrintPdf}
              className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 flex items-center gap-2 shadow-lg shadow-yellow-400/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ بتنسيق PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
