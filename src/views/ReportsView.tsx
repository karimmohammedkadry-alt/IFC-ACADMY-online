import React, { useMemo, useState } from 'react';
import { FileText, Printer, TrendingUp, TrendingDown, BarChart3, Users, AlertCircle, Clock3, ShieldCheck, Search, Wallet, UserPlus, CalendarCheck, RefreshCw } from 'lucide-react';
import { Player, PaymentRecord, ExpenseRecord } from '../types';
import { formatDateTimeArabic } from '../utils/dateUtils';
import { exportToExcel } from '../utils/excelExport';
import { getAuditLogs } from '../utils/auditLogger';
import { ImportExportToolbar } from '../components/ImportExportToolbar';
import { playerMatchesSearch } from '../utils/playerSearch';

interface ReportsViewProps {
  players: Player[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
  onExportPlayerStatement?: (playerId?: string) => void;
  onExportExpensesPdf?: () => void;
  onStartNewMonth?: () => void;
  onImportReportsData?: (data: any) => void;
  onOpenMonthlyArchive?: () => void;
}

type ReportType = 'monthly' | 'attendance' | 'financial' | 'expiring' | 'expired' | 'statement' | 'audit';

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }); };
const parseDate = (v?: string) => { if (!v) return null; const d = new Date(v.length === 10 ? `${v}T00:00:00` : v); return isNaN(d.getTime()) ? null : d; };
const diffDays = (a: Date, b: Date) => Math.ceil((a.getTime() - b.getTime()) / 86400000);
const endOfMonth = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0, 23, 59, 59); };
const normalize = (v: unknown) => String(v ?? '').trim().toLocaleLowerCase('ar-EG');

export const ReportsView: React.FC<ReportsViewProps> = ({ players, payments, expenses, onExportPlayerStatement, onExportExpensesPdf, onStartNewMonth, onImportReportsData, onOpenMonthlyArchive }) => {
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [auditLogs] = useState(() => getAuditLogs());

  const availableMonths = useMemo(() => {
    const set = new Set<string>([ym(new Date())]);
    payments.forEach(p => p.date?.length >= 7 && set.add(p.date.slice(0, 7)));
    expenses.forEach(e => e.date?.length >= 7 && set.add(e.date.slice(0, 7)));
    players.forEach(p => {
      [p.joinDate, p.subscriptionStartDate, p.subscriptionEndDate, p.subscriptionExpiry].forEach(v => v?.length >= 7 && set.add(v.slice(0, 7)));
      (p.sessions || []).forEach(s => s.date?.length >= 7 && set.add(s.date.slice(0, 7)));
    });
    return [...set].sort().reverse();
  }, [players, payments, expenses]);

  const searchedPlayers = useMemo(() => players.filter(p => playerMatchesSearch(p, searchQuery)), [players, searchQuery]);
  const filteredPayments = useMemo(() => payments.filter(p => {
    const player = players.find(pl => (p.playerId && pl.id === p.playerId) || String(pl.memberNumber) === String(p.memberNumber) || pl.name === p.playerName);
    const searchOk = !searchQuery.trim() || (player ? playerMatchesSearch(player, searchQuery) : normalize(`${p.playerName} ${p.memberNumber} ${p.invoiceNumber}`).includes(normalize(searchQuery)));
    return (selectedMonth === 'ALL' || p.date?.startsWith(selectedMonth)) && searchOk;
  }), [payments, players, selectedMonth, searchQuery]);
  const filteredExpenses = useMemo(() => expenses.filter(e => {
    const player = players.find(pl => pl.name === e.paidTo);
    const searchOk = !searchQuery.trim() || normalize(`${e.title} ${e.paidTo} ${e.category}`).includes(normalize(searchQuery)) || !!(player && playerMatchesSearch(player, searchQuery));
    return (selectedMonth === 'ALL' || e.date?.startsWith(selectedMonth)) && searchOk;
  }), [expenses, players, selectedMonth, searchQuery]);

  const monthly = useMemo(() => availableMonths.map(key => {
    const monthEnd = endOfMonth(key);
    const ps = payments.filter(p => p.date?.startsWith(key));
    const es = expenses.filter(e => e.date?.startsWith(key));
    const sessions = players.flatMap(p => p.sessions || []).filter(s => s.date?.startsWith(key));
    const attended = sessions.filter(s => s.status === 'حاضر').length;
    const absent = sessions.filter(s => s.status === 'غائب').length;
    const income = ps.reduce((s, p) => s + Number(p.amount || 0), 0);
    const expense = es.reduce((s, e) => s + Number(e.amount || 0), 0);
    const active = players.filter(p => { const end = parseDate(p.subscriptionEndDate || p.subscriptionExpiry); return p.status === 'نشط' && end && end >= monthEnd; }).length;
    const expired = players.filter(p => { const end = parseDate(p.subscriptionEndDate || p.subscriptionExpiry); return end && end < monthEnd; }).length;
    const expiring7 = players.filter(p => { const end = parseDate(p.subscriptionEndDate || p.subscriptionExpiry); return end && diffDays(end, monthEnd) >= 0 && diffDays(end, monthEnd) <= 7; }).length;
    const newPlayers = players.filter(p => (p.joinDate || p.subscriptionStartDate || '').startsWith(key)).length;
    const renewals = ps.filter(p => normalize(`${p.notes} ${p.type}`).includes('تجديد') || normalize(p.type).includes('اشتراك')).length;
    const attendance = attended + absent ? Math.round(attended / (attended + absent) * 100) : 0;
    return { key, label: monthLabel(key), income, expense, net: income - expense, payments: ps.length, expenses: es.length, active, expired, expiring7, attended, absent, attendance, newPlayers, renewals, avgPayment: ps.length ? Math.round(income / ps.length) : 0 };
  }), [availableMonths, payments, expenses, players]);

  const selectedMonthly = selectedMonth !== 'ALL' ? monthly.find(m => m.key === selectedMonth) : monthly[0];
  const now = new Date();
  const expiring = useMemo(() => players.filter(p => { const end = parseDate(p.subscriptionEndDate || p.subscriptionExpiry); return end && diffDays(end, now) >= 0 && diffDays(end, now) <= 7; }), [players]);
  const expired = useMemo(() => players.filter(p => { const end = parseDate(p.subscriptionEndDate || p.subscriptionExpiry); return end && end < new Date(now.getFullYear(), now.getMonth(), now.getDate()); }), [players]);
  const selectedPlayer = players.find(p => p.id === selectedPlayerId) || searchedPlayers[0] || players[0];
  const totalIncome = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const exportReport = () => {
    if (reportType === 'monthly') exportToExcel('تحليل_الأكاديمية_شهري_شامل', ['الشهر', 'الدخل', 'المصروفات', 'الصافي', 'المدفوعات', 'عمليات المصروفات', 'النشطون', 'تنتهي خلال 7 أيام', 'منتهية', 'الحضور', 'الغياب', 'نسبة الحضور', 'لاعبون جدد', 'تجديدات', 'متوسط التحصيل'], monthly.map(m => [m.label, m.income, m.expense, m.net, m.payments, m.expenses, m.active, m.expiring7, m.expired, m.attended, m.absent, `${m.attendance}%`, m.newPlayers, m.renewals, m.avgPayment]));
    else if (reportType === 'expiring') exportToExcel('اشتراكات_تنتهي_خلال_7_أيام', ['العضوية', 'اللاعب', 'النهاية', 'الأيام المتبقية', 'الاشتراك', 'ولي الأمر'], expiring.filter(p => playerMatchesSearch(p, searchQuery)).map(p => [p.memberNumber, p.name, p.subscriptionEndDate || p.subscriptionExpiry, diffDays(parseDate(p.subscriptionEndDate || p.subscriptionExpiry)!, now), p.monthlyFee, p.parentPhone]));
    else if (reportType === 'expired') exportToExcel('اشتراكات_منتهية', ['العضوية', 'اللاعب', 'النهاية', 'أيام التأخير', 'الاشتراك', 'ولي الأمر'], expired.filter(p => playerMatchesSearch(p, searchQuery)).map(p => [p.memberNumber, p.name, p.subscriptionEndDate || p.subscriptionExpiry, diffDays(now, parseDate(p.subscriptionEndDate || p.subscriptionExpiry)!), p.monthlyFee, p.parentPhone]));
    else if (reportType === 'financial') exportToExcel('التقرير_المالي', ['السند', 'الاسم', 'المبلغ', 'طريقة الدفع', 'التاريخ والوقت', 'الفترة'], filteredPayments.map(p => [p.invoiceNumber, p.playerName, p.amount, p.method, formatDateTimeArabic(p.createdAt || p.date), p.periodMonth]));
    else if (reportType === 'attendance') exportToExcel('تقرير_الحضور', ['العضوية', 'اللاعب', 'المجموعة', 'إجمالي الحصص', 'الحضور', 'الغياب', 'النسبة'], searchedPlayers.map(p => { const ss = (p.sessions || []).filter(s => selectedMonth === 'ALL' || s.date?.startsWith(selectedMonth)); const a = ss.filter(s => s.status === 'حاضر').length; const x = ss.filter(s => s.status === 'غائب').length; return [p.memberNumber, p.name, p.team, ss.length, a, x, `${ss.length ? Math.round(a / ss.length * 100) : 0}%`]; }));
    else if (reportType === 'audit') exportToExcel('سجل_عمليات_النظام', ['المستخدم', 'النوع', 'الإجراء', 'التاريخ', 'الوقت', 'الجهاز', 'التفاصيل'], auditLogs.map(l => [l.user, l.action, l.status, l.timestamp, l.browser, l.device, l.details || '']));
  };

  const tabs: [ReportType, string, any][] = [
    ['monthly', 'التحليل الشهري', BarChart3], ['attendance', 'الحضور', Users], ['financial', 'المالية', Wallet], ['expiring', 'تنتهي خلال 7 أيام', Clock3], ['expired', 'منتهية', AlertCircle], ['statement', 'كشف لاعب', FileText], ['audit', 'سجل العمليات', ShieldCheck]
  ];

  return <div id="view-reports" className="space-y-5 animate-fadeIn pb-12" dir="rtl">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div><h1 className="text-xl font-black text-white">التقارير والتحليلات</h1><p className="text-xs text-slate-400 mt-1">تحليل شامل لكل شهر: الدخل والمصروفات والحضور والاشتراكات والنمو والتجديدات.</p></div>
      <div className="flex flex-wrap gap-2">
        <ImportExportToolbar onExport={exportReport} onImport={onImportReportsData} preferredSheets={['المدفوعات', 'Payments', 'payments']} exportLabel="تصدير Excel" importLabel="استيراد بيانات" />
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-2"><Printer className="w-4 h-4" /> طباعة</button>
        {onExportExpensesPdf && <button onClick={onExportExpensesPdf} className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-300 text-xs font-bold">تقرير المصروفات PDF</button>}
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-7 gap-2 p-2 rounded-2xl bg-white/[0.03] border border-white/10">
      {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setReportType(id)} className={`px-2 py-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 ${reportType === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}><Icon className="w-4 h-4" />{label}</button>)}
    </div>

    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالاسم أو رقم العضوية أو الهاتف أو ولي الأمر أو الرقم القومي" className="w-full pr-10 pl-3 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs outline-none focus:border-blue-400" /></div>
      <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="md:w-64 bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-xs text-white"><option value="ALL">كل الشهور</option>{availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
    </div>

    {reportType === 'monthly' && <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Metric title="إجمالي الدخل" value={`${monthly.reduce((s, m) => s + m.income, 0).toLocaleString()} ج.م`} icon={<TrendingUp />} />
        <Metric title="إجمالي المصروفات" value={`${monthly.reduce((s, m) => s + m.expense, 0).toLocaleString()} ج.م`} icon={<TrendingDown />} />
        <Metric title="الصافي" value={`${monthly.reduce((s, m) => s + m.net, 0).toLocaleString()} ج.م`} icon={<BarChart3 />} />
        <Metric title="المدفوعات" value={monthly.reduce((s, m) => s + m.payments, 0).toLocaleString()} icon={<Wallet />} />
        <Metric title="لاعبون جدد" value={monthly.reduce((s, m) => s + m.newPlayers, 0).toLocaleString()} icon={<UserPlus />} />
        <Metric title="التجديدات" value={monthly.reduce((s, m) => s + m.renewals, 0).toLocaleString()} icon={<RefreshCw />} />
        <Metric title="الحضور" value={monthly.reduce((s, m) => s + m.attended, 0).toLocaleString()} icon={<CalendarCheck />} />
        <Metric title="متوسط التحصيل" value={`${monthly.length ? Math.round(monthly.reduce((s, m) => s + m.avgPayment, 0) / monthly.length).toLocaleString() : 0} ج.م`} icon={<TrendingUp />} />
      </div>

      {selectedMonthly && <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black text-white">ملخص {selectedMonthly.label}</h3><p className="text-[11px] text-slate-400 mt-1">تفاصيل الشهر المختار بالكامل.</p></div>{onOpenMonthlyArchive && <button onClick={onOpenMonthlyArchive} className="text-xs font-bold text-blue-300">فتح الأرشيف الشهري</button>}</div><div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3 mt-4"><Mini label="الدخل" value={`${selectedMonthly.income.toLocaleString()} ج.م`} /><Mini label="المصروفات" value={`${selectedMonthly.expense.toLocaleString()} ج.م`} /><Mini label="الصافي" value={`${selectedMonthly.net.toLocaleString()} ج.م`} /><Mini label="النشطون" value={selectedMonthly.active.toLocaleString()} /><Mini label="منتهية" value={selectedMonthly.expired.toLocaleString()} /><Mini label="تنتهي خلال 7 أيام" value={selectedMonthly.expiring7.toLocaleString()} /><Mini label="الحضور" value={selectedMonthly.attended.toLocaleString()} /><Mini label="الغياب" value={selectedMonthly.absent.toLocaleString()} /><Mini label="نسبة الحضور" value={`${selectedMonthly.attendance}%`} /><Mini label="لاعبون جدد" value={selectedMonthly.newPlayers.toLocaleString()} /></div></div>}

      <RevenueExpenseChart monthly={monthly} />

      <Table headers={['الشهر', 'الدخل', 'المصروفات', 'الصافي', 'المدفوعات', 'عمليات المصروفات', 'النشطون', 'تنتهي خلال 7 أيام', 'منتهية', 'الحضور', 'الغياب', 'نسبة الحضور', 'لاعبون جدد', 'تجديدات', 'متوسط التحصيل']} rows={monthly.map(m => [m.label, `${m.income.toLocaleString()} ج.م`, `${m.expense.toLocaleString()} ج.م`, `${m.net.toLocaleString()} ج.م`, m.payments, m.expenses, m.active, m.expiring7, m.expired, m.attended, m.absent, `${m.attendance}%`, m.newPlayers, m.renewals, `${m.avgPayment.toLocaleString()} ج.م`])} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AnalysisTable title="تحليل طرق التحصيل" headers={['طريقة الدفع', 'العمليات', 'الإجمالي']} rows={Array.from(new Set(payments.filter(p => selectedMonth === 'ALL' || p.date?.startsWith(selectedMonth)).map(p => p.method))).map(method => { const rows = payments.filter(p => p.method === method && (selectedMonth === 'ALL' || p.date?.startsWith(selectedMonth))); return [method, rows.length, `${rows.reduce((a, p) => a + Number(p.amount || 0), 0).toLocaleString()} ج.م`]; })} />
        <AnalysisTable title="تحليل المصروفات حسب التصنيف" headers={['التصنيف', 'العمليات', 'الإجمالي']} rows={Array.from(new Set(expenses.filter(e => selectedMonth === 'ALL' || e.date?.startsWith(selectedMonth)).map(e => e.category))).map(category => { const rows = expenses.filter(e => e.category === category && (selectedMonth === 'ALL' || e.date?.startsWith(selectedMonth))); return [category, rows.length, `${rows.reduce((a, e) => a + Number(e.amount || 0), 0).toLocaleString()} ج.م`]; })} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AnalysisTable title="تحليل نمو اللاعبين" headers={['الشهر', 'جدد', 'نشطون', 'تنتهي قريبًا', 'منتهية']} rows={monthly.map(m => [m.label, m.newPlayers, m.active, m.expiring7, m.expired])} />
        <AnalysisTable title="تحليل الحضور والتجديد" headers={['الشهر', 'الحضور', 'الغياب', 'النسبة', 'التجديدات']} rows={monthly.map(m => [m.label, m.attended, m.absent, `${m.attendance}%`, m.renewals])} />
      </div>

      <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"><h3 className="text-sm font-black text-white mb-4">قراءة أداء كل شهر</h3><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{monthly.map(m => <div key={m.key} className="p-4 rounded-xl bg-white/[0.03] border border-white/10"><div className="text-xs text-slate-400 mb-2">{m.label}</div><div className="text-sm font-black text-white">صافي {m.net.toLocaleString()} ج.م</div><div className="text-[11px] text-slate-400 mt-2">دخل {m.income.toLocaleString()} · مصروف {m.expense.toLocaleString()} · {m.newPlayers} لاعب جديد · {m.renewals} تجديد · حضور {m.attendance}%</div></div>)}</div></div>
    </section>}

    {reportType === 'financial' && <section className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Metric title="الدخل" value={`${totalIncome.toLocaleString()} ج.م`} icon={<TrendingUp />} /><Metric title="المصروفات" value={`${totalExpenses.toLocaleString()} ج.م`} icon={<TrendingDown />} /><Metric title="الصافي" value={`${(totalIncome - totalExpenses).toLocaleString()} ج.م`} icon={<BarChart3 />} /></div><Table headers={['السند', 'الاسم', 'المبلغ', 'طريقة الدفع', 'التاريخ والوقت', 'الفترة']} rows={filteredPayments.map(p => [p.invoiceNumber, p.playerName, `${Number(p.amount || 0).toLocaleString()} ج.م`, p.method, formatDateTimeArabic(p.createdAt || p.date), p.periodMonth])} /></section>}
    {reportType === 'attendance' && <Table headers={['العضوية', 'اللاعب', 'المجموعة', 'الحصص', 'الحضور', 'الغياب', 'النسبة']} rows={searchedPlayers.map(p => { const ss = (p.sessions || []).filter(s => selectedMonth === 'ALL' || s.date?.startsWith(selectedMonth)); const a = ss.filter(s => s.status === 'حاضر').length; const x = ss.filter(s => s.status === 'غائب').length; return [p.memberNumber, p.name, p.team, ss.length, a, x, `${ss.length ? Math.round(a / ss.length * 100) : 0}%`]; })} />}
    {(reportType === 'expiring' || reportType === 'expired') && <Table headers={['العضوية', 'اللاعب', 'تاريخ النهاية', reportType === 'expiring' ? 'الأيام المتبقية' : 'أيام التأخير', 'قيمة الاشتراك', 'ولي الأمر']} rows={(reportType === 'expiring' ? expiring : expired).filter(p => playerMatchesSearch(p, searchQuery)).map(p => { const end = parseDate(p.subscriptionEndDate || p.subscriptionExpiry)!; const n = reportType === 'expiring' ? diffDays(end, now) : diffDays(now, end); return [p.memberNumber, p.name, p.subscriptionEndDate || p.subscriptionExpiry, `${n} يوم`, `${p.monthlyFee} ج.م`, p.parentPhone]; })} />}
    {reportType === 'statement' && <section className="space-y-4"><div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-wrap gap-3 items-center"><span className="text-xs text-slate-300 font-bold">اختر اللاعب</span><select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">{searchedPlayers.map(p => <option key={p.id} value={p.id}>{p.name} (#{p.memberNumber})</option>)}</select>{onExportPlayerStatement && <button onClick={() => onExportPlayerStatement(selectedPlayer?.id)} className="px-3 py-2 rounded-xl bg-yellow-500/15 text-yellow-300 text-xs font-bold">تصدير كشف PDF</button>}</div>{selectedPlayer && <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs"><Info label="العضوية" value={`#${selectedPlayer.memberNumber}`} /><Info label="المجموعة" value={selectedPlayer.team} /><Info label="بداية الاشتراك" value={selectedPlayer.subscriptionStartDate} /><Info label="نهاية الاشتراك" value={selectedPlayer.subscriptionEndDate} /><Info label="الاشتراك" value={`${selectedPlayer.monthlyFee} ج.م`} /><Info label="إجمالي الحصص" value={String(selectedPlayer.totalSessions)} /><Info label="الحضور" value={String(selectedPlayer.attendedSessions)} /><Info label="الغياب" value={String(selectedPlayer.absentSessions)} /></div>}</section>}
    {reportType === 'audit' && <Table headers={['المستخدم', 'النوع', 'الإجراء', 'التاريخ', 'الوقت', 'الجهاز', 'التفاصيل']} rows={auditLogs.map(l => [l.user, l.status, l.action, l.timestamp, l.browser, l.device, l.details || '-'])} />}
  </div>;
};

const RevenueExpenseChart: React.FC<{ monthly: { key: string; label: string; income: number; expense: number }[] }> = ({ monthly }) => {
  const data = [...monthly].reverse();
  const width = 900, height = 300, pad = { left: 58, right: 22, top: 25, bottom: 48 };
  const max = Math.max(1, ...data.flatMap(m => [m.income, m.expense]));
  const x = (i: number) => pad.left + (data.length <= 1 ? 0 : i * ((width - pad.left - pad.right) / (data.length - 1)));
  const y = (v: number) => height - pad.bottom - (v / max) * (height - pad.top - pad.bottom);
  const points = (field: 'income' | 'expense') => data.map((m, i) => `${x(i)},${y(m[field])}`).join(' ');
  return <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 mb-3"><div><h3 className="text-sm font-black text-white">رسم بياني: دخل vs مصروفات شهريًا</h3><p className="text-[11px] text-slate-500 mt-1">مقارنة شهرية مباشرة من بيانات المدفوعات والمصروفات.</p></div><div className="flex gap-4 text-[11px] font-bold"><span className="text-emerald-300">● الدخل</span><span className="text-rose-300">● المصروفات</span></div></div><div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[720px] h-[300px]" role="img" aria-label="الدخل مقابل المصروفات شهريًا"><line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="currentColor" className="text-white/10" />{[0, .25, .5, .75, 1].map(r => <g key={r}><line x1={pad.left} y1={y(max * r)} x2={width - pad.right} y2={y(max * r)} stroke="currentColor" className="text-white/5" /><text x={pad.left - 8} y={y(max * r) + 4} textAnchor="end" fontSize="10" fill="currentColor" className="text-slate-500">{Math.round(max * r).toLocaleString()}</text></g>)}<polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400" points={points('income')} /><polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-rose-400" points={points('expense')} />{data.map((m, i) => <g key={m.key}><circle cx={x(i)} cy={y(m.income)} r="4" fill="currentColor" className="text-emerald-400" /><circle cx={x(i)} cy={y(m.expense)} r="4" fill="currentColor" className="text-rose-400" /><text x={x(i)} y={height - 20} textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-400">{m.label.replace(' ', '\n')}</text></g>)}</svg></div></div>;
};

const Metric: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10"><div className="text-blue-400 mb-2">{icon}</div><div className="text-[11px] text-slate-400">{title}</div><div className="text-lg font-black text-white font-mono mt-1">{value}</div></div>;
const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10"><div className="text-[10px] text-slate-500">{label}</div><div className="text-xs font-black text-white mt-1">{value}</div></div>;
const Info: React.FC<{ label: string; value?: string }> = ({ label, value }) => <div><span className="text-slate-500 block mb-1">{label}</span><b className="text-white">{value || '-'}</b></div>;
const AnalysisTable: React.FC<{ title: string; headers: string[]; rows: any[][] }> = ({ title, headers, rows }) => <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10"><h3 className="text-sm font-black text-white mb-4">{title}</h3><Table headers={headers} rows={rows} /></div>;
const Table: React.FC<{ headers: string[]; rows: any[][] }> = ({ headers, rows }) => <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-right text-xs"><thead className="bg-white/[0.06]"><tr>{headers.map(h => <th key={h} className="py-3 px-3 text-slate-300 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{rows.length ? rows.map((r, i) => <tr key={i} className="hover:bg-white/[0.02]">{r.map((c, j) => <td key={j} className="py-3 px-3 text-slate-200 whitespace-nowrap">{c}</td>)}</tr>) : <tr><td colSpan={headers.length} className="py-10 text-center text-slate-500">لا توجد بيانات في الفترة المحددة.</td></tr>}</tbody></table></div>;
