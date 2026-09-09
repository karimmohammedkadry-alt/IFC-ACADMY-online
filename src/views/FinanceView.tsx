import React, { useState, useMemo } from 'react';
import {
  Banknote,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Plus,
  Trash2,
  Filter,
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  FileText,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import { ExpenseRecord, PaymentRecord, Coach } from '../types';
import { exportToExcel } from '../utils/excelExport';
import { CalendarDatePicker } from '../components/CalendarDatePicker';
import { ImportExportToolbar } from '../components/ImportExportToolbar';
import { playerMatchesSearch, normalizeSearchText } from '../utils/playerSearch';

interface FinanceViewProps {
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  players?: import('../types').Player[];
  coaches: Coach[];
  onOpenAddExpense: () => void;
  onOpenPaySalary: (coachId?: string) => void;
  onDeleteExpense: (id: string) => void;
  onExportExpensesPdf?: () => void;
  onImportExpenses?: (imported: any) => void;
  isAmountsVisible?: boolean;
  onToggleAmountsVisible?: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  expenses,
  payments,
  players = [],
  coaches,
  onOpenAddExpense,
  onOpenPaySalary,
  onDeleteExpense,
  onExportExpensesPdf,
  onImportExpenses,
  isAmountsVisible = true,
  onToggleAmountsVisible,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('جميع التصنيفات');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Current month default in YYYY-MM format
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYm);
  const [selectedDate, setSelectedDate] = useState<string>('ALL');

  // Compute all available months from data
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentYm);
    payments.forEach((p) => {
      if (p.date && p.date.length >= 7) monthsSet.add(p.date.substring(0, 7));
    });
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) monthsSet.add(e.date.substring(0, 7));
    });
    return Array.from(monthsSet).sort().reverse();
  }, [payments, expenses, currentYm]);

  // Format month name in Arabic
  const formatMonthLabel = (ym: string) => {
    if (ym === 'ALL') return 'جميع الشهور (السجل التراكمي الشامل)';
    const [year, month] = ym.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    if (isNaN(dateObj.getTime())) return ym;
    const isCurrent = ym === currentYm;
    return `${dateObj.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })} ${isCurrent ? '(الشهر الحالي)' : ''}`;
  };

  // Filter payments and expenses by selected month AND selected date
  const monthPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchMonth = selectedMonth === 'ALL' || (p.date && p.date.startsWith(selectedMonth));
      const matchDate = selectedDate === 'ALL' || (p.date && p.date === selectedDate);
      const linkedPlayer = players.find((pl) =>
        (p.playerId && pl.id === p.playerId) ||
        (p.memberNumber && String(pl.memberNumber) === String(p.memberNumber)) ||
        normalizeSearchText(pl.name) === normalizeSearchText(p.playerName)
      );
      const matchSearch = !searchTerm.trim() ||
        (linkedPlayer ? playerMatchesSearch(linkedPlayer, searchTerm) : false) ||
        normalizeSearchText(p.playerName).includes(normalizeSearchText(searchTerm)) ||
        normalizeSearchText(p.invoiceNumber).includes(normalizeSearchText(searchTerm));
      return matchMonth && matchDate && matchSearch;
    });
  }, [payments, players, selectedMonth, selectedDate, searchTerm]);

  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchMonth = selectedMonth === 'ALL' || (e.date && e.date.startsWith(selectedMonth));
      const matchDate = selectedDate === 'ALL' || (e.date && e.date === selectedDate);
      return matchMonth && matchDate;
    });
  }, [expenses, selectedMonth, selectedDate]);

  const totalIncome = monthPayments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  // Calculate salaries specific stats
  const totalMonthlyBudgetSalaries = coaches.reduce((s, c) => s + c.monthlySalary, 0);
  const salaryExpenses = monthExpenses.filter((e) => e.category === 'رواتب مدربين');
  const totalSalariesPaidThisMonth = salaryExpenses.reduce((s, e) => s + e.amount, 0);
  const remainingSalariesToPay = Math.max(0, totalMonthlyBudgetSalaries - totalSalariesPaidThisMonth);

  const formatMoney = (val: number) => {
    if (!isAmountsVisible) return '•••• ج.م';
    return `${val.toLocaleString()} ج.م`;
  };

  const filteredExpenses = useMemo(() => {
    return monthExpenses.filter((exp) => {
      const categoryMatch = selectedCategory === 'جميع التصنيفات' || exp.category === selectedCategory;
      const q = normalizeSearchText(searchTerm);
      const linkedPlayer = players.find((pl) => normalizeSearchText(pl.name) === normalizeSearchText(exp.paidTo));
      const searchMatch = !q ||
        normalizeSearchText(exp.title).includes(q) ||
        normalizeSearchText(exp.paidTo).includes(q) ||
        (linkedPlayer ? playerMatchesSearch(linkedPlayer, searchTerm) : false);
      return categoryMatch && searchMatch;
    });
  }, [monthExpenses, selectedCategory, searchTerm, players]);

  const handleExportExpensesCsv = () => {
    const headers = [
      'رقم السند',
      'بند الصرف / الوصف',
      'التصنيف',
      'المبلغ',
      'التاريخ',
      'المستفيد',
      'طريقة الصرف',
      'المسؤول',
    ];

    const rows = filteredExpenses.map((exp) => [
      exp.receiptNumber || '-',
      exp.title,
      exp.category,
      exp.amount,
      exp.date,
      exp.paidTo || '-',
      exp.paymentMethod || 'كاش',
      exp.recordedBy || 'المدير العام',
    ]);

    exportToExcel(`سجل_المصروفات_${selectedMonth}_${selectedDate}`, headers, rows);
  };

  return (
    <div id="view-finance" className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 backdrop-blur-md">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة المصروفات والمالية والرواتب</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              مراقبة التدفقات المالية، صرف رواتب المدربين، والمصروفات التشغيلية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Eye Privacy Toggle */}
          {onToggleAmountsVisible && (
            <button
              onClick={onToggleAmountsVisible}
              className="px-3.5 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-semibold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
              title={isAmountsVisible ? 'إخفاء المبالغ المالية' : 'إظهار المبالغ المالية'}
            >
              {isAmountsVisible ? (
                <>
                  <EyeOff className="w-4 h-4 text-blue-400" />
                  <span>إخفاء المبالغ</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>إظهار المبالغ</span>
                </>
              )}
            </button>
          )}

          {onExportExpensesPdf && (
            <button
              onClick={onExportExpensesPdf}
              id="btn-export-expenses-pdf"
              className="px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-bold text-xs rounded-xl flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer shadow-sm shadow-yellow-500/10"
              title="تصدير تقرير المصروفات وسندات الصرف بصيغة PDF"
            >
              <FileText className="w-4 h-4 text-yellow-400" />
              <span>تقرير المصروفات PDF</span>
            </button>
          )}

          {/* Import / Export Toolbar in Header */}
          <ImportExportToolbar
            onExport={handleExportExpensesCsv}
            onImport={onImportExpenses}
            exportLabel="تصدير المالية (Excel)"
            importLabel="استيراد مالية ومصروفات"
            preferredSheets={['المصروفات', 'Expenses', 'expenses']}
          />

          <button
            onClick={() => onOpenPaySalary()}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
          >
            <Award className="w-4 h-4" />
            <span>صرف راتب مدرب</span>
          </button>

          <button
            onClick={onOpenAddExpense}
            className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>تسجيل سند صرف عام</span>
          </button>
        </div>
      </div>

      {/* Month Selector & Import / Export Controls */}
      <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في المالية: الاسم، العضوية، الهاتف، ولي الأمر، الرقم القومي أو بند الصرف..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400"
          />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Month Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Calendar className="w-4 h-4 text-yellow-400" />
            <span>تحديد الشهر المالي:</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-black/60 border border-white/20 focus:border-yellow-400 text-yellow-300 font-bold text-xs rounded-xl px-3 py-2 cursor-pointer focus:outline-hidden"
          >
            {availableMonths.map((ym) => (
              <option key={ym} value={ym} className="bg-slate-900 text-white">
                {formatMonthLabel(ym)}
              </option>
            ))}
            <option value="ALL" className="bg-slate-900 text-yellow-400">
              جميع الشهور (السجل التراكمي الشامل)
            </option>
          </select>

          {selectedMonth === currentYm && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
              دورة الشهر الجاري
            </span>
          )}
        </div>

        {/* Import & Export Toolbar */}
        <ImportExportToolbar
          onExport={handleExportExpensesCsv}
          onImport={onImportExpenses}
          exportLabel="تصدير كشف المالية (Excel)"
          importLabel="استيراد سندات Excel"
          preferredSheets={['المصروفات', 'Expenses', 'expenses']}
        />
      </div>

      {/* Daily Calendar Date Filter */}
      <CalendarDatePicker
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        label="تقويم يوم المعاملات والمصروفات:"
        recordCount={monthPayments.length + monthExpenses.length}
        recordUnit="معاملة"
      />

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>إيرادات اشتراكات {selectedMonth === 'ALL' ? 'الشاملة' : formatMonthLabel(selectedMonth)}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            +{formatMoney(totalIncome)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{monthPayments.length} اشتراك مسدد</div>
        </div>

        {/* Expenses */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>مصروفات {selectedMonth === 'ALL' ? 'الشاملة' : formatMonthLabel(selectedMonth)}</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            -{formatMoney(totalExpenses)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{monthExpenses.length} سند صرف</div>
        </div>

        {/* Salaries KPI */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-purple-400 mb-1">
            <span>ميزانية رواتب المدربين</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {formatMoney(totalMonthlyBudgetSalaries)}
          </div>
          <div className="text-[10px] text-purple-400/80 mt-1">
            تم صرف: {formatMoney(totalSalariesPaidThisMonth)} • متبقي: {formatMoney(remainingSalariesToPay)}
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>صافي الرصيد المالي</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-black font-mono ${
              netProfit >= 0 ? 'text-blue-400' : 'text-rose-400'
            }`}
          >
            {formatMoney(netProfit)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">الرصيد المتبقي بالخزينة</div>
        </div>
      </div>

      {/* Dedicated Section: كشف رواتب المدربين والعاملين */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-white">
              كشف رواتب ومستحقات المدربين ({formatMonthLabel(selectedMonth)})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            إجمالي المدربين: <strong className="text-white font-mono">{coaches.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-white/[0.04] text-slate-400 border-b border-white/10">
                <th className="py-3 px-4">المدرب</th>
                <th className="py-3 px-3">المجموعات المسندة</th>
                <th className="py-3 px-3">الراتب الشهري المحدد</th>
                <th className="py-3 px-3">حالة صرف الشهر الحالي</th>
                <th className="py-3 px-4 text-center">إجراء الصرف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {coaches.map((coach) => {
                const isPaid = expenses.some(
                  (e) =>
                    e.category === 'رواتب مدربين' &&
                    (e.coachId === coach.id || e.paidTo.includes(coach.name.replace('كابتن / ', '')))
                );

                return (
                  <tr key={coach.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-white block text-sm">{coach.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{coach.phone}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-400">
                      <div className="flex flex-wrap gap-1">
                        {coach.teams.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-sm bg-white/[0.05] text-[10px] text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-purple-300 text-sm">
                      {formatMoney(coach.monthlySalary)}
                    </td>

                    <td className="py-3 px-3">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تم صرف الراتب</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          <span>بانتظار الصرف</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenPaySalary(coach.id)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 mx-auto transition-all cursor-pointer ${
                          isPaid
                            ? 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{isPaid ? 'صرف دفعة إضافية' : 'صرف الراتب الآن'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table & filter for All Expenses */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">تصفية سجل المصروفات:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-400 backdrop-blur-md cursor-pointer"
            >
              <option value="جميع التصنيفات" className="bg-slate-900 text-slate-200">
                جميع التصنيفات
              </option>
              <option value="رواتب مدربين" className="bg-slate-900 text-slate-200">
                رواتب مدربين
              </option>
              <option value="إيجار ملاعب" className="bg-slate-900 text-slate-200">
                إيجار ملاعب وصالات
              </option>
              <option value="أدوات ومعدات" className="bg-slate-900 text-slate-200">
                أدوات ومعدات رياضية
              </option>
              <option value="صيانة وكهرباء" className="bg-slate-900 text-slate-200">
                صيانة وكهرباء
              </option>
              <option value="تسويق وإعلان" className="bg-slate-900 text-slate-200">
                تسويق وإعلان
              </option>
              <option value="أخرى" className="bg-slate-900 text-slate-200">
                أخرى
              </option>
            </select>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredExpenses.length} سند صرف مسجل
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-white/[0.06] text-slate-400 border-b border-white/10 font-semibold">
              <tr>
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">بيان الصرف</th>
                <th className="py-3.5 px-3">التصنيف</th>
                <th className="py-3.5 px-3">المدفوع له</th>
                <th className="py-3.5 px-3 font-mono">المبلغ</th>
                <th className="py-3.5 px-3">طريقة الدفع</th>
                <th className="py-3.5 px-3">التاريخ</th>
                <th className="py-3.5 px-4">ملاحظات</th>
                <th className="py-3.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredExpenses.map((exp, idx) => (
                <tr key={exp.id} className="hover:bg-white/[0.05] transition-colors">
                  <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                    {exp.category === 'رواتب مدربين' && (
                      <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                    <span>{exp.title}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] border ${
                        exp.category === 'رواتب مدربين'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-bold'
                          : 'bg-white/[0.06] text-slate-300 border border-white/10'
                      }`}
                    >
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-300 font-medium">{exp.paidTo}</td>
                  <td className="py-3.5 px-3 font-mono font-bold text-rose-400 text-sm">
                    {formatMoney(exp.amount)}
                  </td>
                  <td className="py-3.5 px-3 text-slate-400">{exp.method}</td>
                  <td className="py-3.5 px-3 font-mono text-slate-400 text-[11px]">{exp.date}</td>
                  <td className="py-3.5 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                    {exp.notes || '-'}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="حذف المصروف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
