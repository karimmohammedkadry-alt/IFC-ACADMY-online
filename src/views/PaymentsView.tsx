import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Plus,
  Printer,
  Download,
  Filter,
  Receipt,
  FileText,
  Smartphone,
  Wallet,
  Award,
  Eye,
  EyeOff,
  SlidersHorizontal,
  MoreVertical,
  Edit3,
  Trash2,
  User,
} from 'lucide-react';
import { PaymentRecord, PaymentMethod, Player } from '../types';
import { formatDateTimeArabic } from '../utils/dateUtils';
import { exportToExcel } from '../utils/excelExport';
import { CalendarDatePicker } from '../components/CalendarDatePicker';
import { ImportExportToolbar } from '../components/ImportExportToolbar';
import { playerMatchesSearch, normalizeSearchText } from '../utils/playerSearch';

interface PaymentsViewProps {
  payments: PaymentRecord[];
  players?: Player[];
  onOpenAddPayment: () => void;
  onOpenPaySalary: () => void;
  onOpenActionChooser?: () => void;
  onPreviewInvoice: (payment: PaymentRecord) => void;
  onSelectPlayer?: (player: Player) => void;
  onEditPayment?: (payment: PaymentRecord) => void;
  onDeletePayment?: (paymentId: string) => void;
  onExportReports?: () => void;
  onImportPayments?: (data: any) => void;
  isAmountsVisible?: boolean;
  onToggleAmountsVisible?: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  payments,
  players = [],
  onOpenAddPayment,
  onOpenPaySalary,
  onOpenActionChooser,
  onPreviewInvoice,
  onSelectPlayer,
  onEditPayment,
  onDeletePayment,
  onImportPayments,
  isAmountsVisible = true,
  onToggleAmountsVisible,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('جميع الطرق');
  const [selectedType, setSelectedType] = useState<string>('جميع المعاملات');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      const linkedPlayer = players.find((p) =>
        (pay.playerId && p.id === pay.playerId) ||
        (pay.memberNumber && String(p.memberNumber) === String(pay.memberNumber)) ||
        normalizeSearchText(p.name) === normalizeSearchText(pay.playerName)
      );
      const matchesPlayerSearch = linkedPlayer ? playerMatchesSearch(linkedPlayer, searchTerm) : false;
      const matchesSearch = !searchTerm.trim() || matchesPlayerSearch ||
        normalizeSearchText(pay.playerName).includes(normalizeSearchText(searchTerm)) ||
        normalizeSearchText(pay.invoiceNumber).includes(normalizeSearchText(searchTerm)) ||
        normalizeSearchText(pay.memberNumber).includes(normalizeSearchText(searchTerm));

      const matchesMethod =
        selectedMethod === 'جميع الطرق' || pay.method === selectedMethod;

      let matchesType = true;
      if (selectedType === 'اشتراكات اللاعبين') {
        matchesType = pay.type !== 'راتب مدرب';
      } else if (selectedType === 'رواتب المدربين') {
        matchesType = pay.type === 'راتب مدرب';
      }

      const matchesDate = selectedDate === 'ALL' || pay.date === selectedDate;

      return matchesSearch && matchesMethod && matchesType && matchesDate;
    });
  }, [payments, players, searchTerm, selectedMethod, selectedType, selectedDate]);

  // Restrict stats to selected date when a date is selected, or all if ALL
  const dateScopedPayments = useMemo(() => {
    return selectedDate === 'ALL'
      ? payments
      : payments.filter((p) => p.date === selectedDate);
  }, [payments, selectedDate]);

  // Method breakdowns for selected date scope
  const totalCash = dateScopedPayments.filter((p) => p.method === 'كاش').reduce((s, p) => s + p.amount, 0);
  const totalVodafone = dateScopedPayments.filter((p) => p.method === 'فودافون كاش').reduce((s, p) => s + p.amount, 0);
  const totalCards = dateScopedPayments.filter((p) => p.method === 'بطاقة ائتمانية' || p.method === 'تحويل بنكي').reduce((s, p) => s + p.amount, 0);
  const totalInstapay = dateScopedPayments.filter((p) => p.method === 'إنستاباي').reduce((s, p) => s + p.amount, 0);
  const grandTotal = dateScopedPayments.reduce((s, p) => s + p.amount, 0);

  const formatMoney = (val: number) => {
    if (!isAmountsVisible) return '•••• ج.م';
    return `${val.toLocaleString()} ج.م`;
  };

  const handleExportCsv = () => {
    const headers = [
      'كود العضوية',
      'رقم السند',
      'المستفيد / اللاعب / المدرب',
      'نوع المعاملة',
      'المبلغ (ج.م)',
      'طريقة الدفع',
      'تاريخ ووقت السداد',
      'عن شهر',
      'المسؤول عن التحصيل',
      'الحالة',
      'ملاحظات',
    ];

    const rows = filteredPayments.map((pay) => [
      pay.memberNumber ? `#${pay.memberNumber}` : '—',
      pay.invoiceNumber,
      pay.playerName,
      pay.type === 'راتب مدرب' ? 'صرف راتب مدرب' : 'اشتراك لاعب',
      pay.amount,
      pay.method,
      formatDateTimeArabic(pay.createdAt || pay.date),
      pay.periodMonth,
      pay.collectedBy,
      pay.status || 'مدفوع',
      pay.notes || '',
    ]);

    exportToExcel('سجل_المدفوعات_IFC_Academy', headers, rows);
  };

  const handleNewTransactionClick = () => {
    if (onOpenActionChooser) {
      onOpenActionChooser();
    } else {
      onOpenAddPayment();
    }
  };

  const handlePlayerClick = (pay: PaymentRecord) => {
    if (pay.type === 'راتب مدرب') return;
    if (!onSelectPlayer) return;

    const found = players.find(
      (p) =>
        p.id === pay.playerId ||
        (pay.memberNumber && String(p.memberNumber) === String(pay.memberNumber)) ||
        p.name.trim() === pay.playerName.trim()
    );

    if (found) {
      onSelectPlayer(found);
    } else {
      // Fallback object to view profile seamlessly
      onSelectPlayer({
        id: pay.playerId || `temp-${pay.id}`,
        memberNumber: pay.memberNumber || '—',
        name: pay.playerName,
        team: pay.team || 'كيك بوكسينغ',
        sport: 'كيك بوكسينغ',
        subscriptionStartDate: pay.date,
        subscriptionEndDate: pay.date,
        totalSessions: 8,
        attendedSessions: 0,
        absentSessions: 0,
        attendanceRate: 100,
        sessions: [],
        phone: '',
        parentPhone: '',
        subscriptionPlan: 'اشتراك شهري',
        monthlyFee: pay.amount,
        subscriptionExpiry: pay.date,
        status: 'نشط',
        joinDate: pay.date,
      });
    }
  };

  return (
    <div id="view-payments" className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 backdrop-blur-md">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة المدفوعات والتحصيل والرواتب</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              توثيق سداد الاشتراكات وصرف رواتب المدربين وإصدار الفواتير
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Eye Privacy Toggle */}
          {onToggleAmountsVisible && (
            <button
              onClick={onToggleAmountsVisible}
              className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-semibold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
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

          {/* Combined Action Button: Open chooser */}
          <button
            onClick={handleNewTransactionClick}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>تسجيل معاملة مالية (سداد / راتب)</span>
          </button>

          {/* Import / Export Toolbar */}
          <ImportExportToolbar
            onExport={handleExportCsv}
            onImport={onImportPayments}
            exportLabel="تصدير السندات (Excel)"
            importLabel="استيراد معاملات"
            preferredSheets={['المدفوعات', 'Payments', 'payments']}
          />
        </div>
      </div>

      {/* Calendar Day Filter Bar */}
      <CalendarDatePicker
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        label="تقويم يوم المعاملات والمدفوعات:"
        recordCount={filteredPayments.length}
        recordUnit="سند"
      />

      {/* Breakdown stat cards for methods */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400">إجمالي المعاملات {selectedDate !== 'ALL' ? '(لهذا اليوم)' : ''}</div>
          <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
            {formatMoney(grandTotal)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{dateScopedPayments.length} سند مسجل</div>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>كاش بالخزينة</span>
          </div>
          <div className="text-xl font-black text-white mt-1 font-mono">
            {formatMoney(totalCash)}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-1">تسليم يدوي</div>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-rose-400" />
            <span>فودافون كاش</span>
          </div>
          <div className="text-xl font-black text-white mt-1 font-mono">
            {formatMoney(totalVodafone)}
          </div>
          <div className="text-[10px] text-rose-400/80 mt-1">محفظة إلكترونية</div>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            <span>فيزا وبطاقات</span>
          </div>
          <div className="text-xl font-black text-white mt-1 font-mono">
            {formatMoney(totalCards)}
          </div>
          <div className="text-[10px] text-blue-400/80 mt-1">دفع إلكتروني</div>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>إنستاباي (InstaPay)</span>
          </div>
          <div className="text-xl font-black text-white mt-1 font-mono">
            {formatMoney(totalInstapay)}
          </div>
          <div className="text-[10px] text-purple-400/80 mt-1">تحويل لحظي</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم، العضوية، الهاتف، ولي الأمر، الرقم القومي أو الإيصال..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400 backdrop-blur-md"
            />
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-400 backdrop-blur-md cursor-pointer"
            >
              <option value="جميع الطرق" className="bg-slate-900 text-slate-200">
                جميع طرق الدفع
              </option>
              <option value="كاش" className="bg-slate-900 text-slate-200">
                كاش (الخزينة)
              </option>
              <option value="فودافون كاش" className="bg-slate-900 text-slate-200">
                فودافون كاش
              </option>
              <option value="إنستاباي" className="bg-slate-900 text-slate-200">
                إنستاباي
              </option>
              <option value="بطاقة ائتمانية" className="bg-slate-900 text-slate-200">
                بطاقة ائتمانية
              </option>
              <option value="تحويل بنكي" className="bg-slate-900 text-slate-200">
                تحويل بنكي
              </option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-400 backdrop-blur-md cursor-pointer"
            >
              <option value="جميع المعاملات" className="bg-slate-900 text-slate-200">
                جميع المعاملات (اشتراكات ورواتب)
              </option>
              <option value="اشتراكات اللاعبين" className="bg-slate-900 text-slate-200">
                اشتراكات اللاعبين فقط
              </option>
              <option value="رواتب المدربين" className="bg-slate-900 text-slate-200">
                سندات رواتب المدربين فقط
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm text-white">سجل المدفوعات</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredPayments.length} معاملة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-white/[0.04] text-slate-400 border-b border-white/10 font-semibold">
                <th className="py-3 px-4">كود العضوية</th>
                <th className="py-3 px-4">المستفيد / اللاعب / المدرب</th>
                <th className="py-3 px-3">النوع</th>
                <th className="py-3 px-3">المبلغ</th>
                <th className="py-3 px-3">طريقة الدفع</th>
                <th className="py-3 px-3">التاريخ</th>
                <th className="py-3 px-3">عن شهر</th>
                <th className="py-3 px-3">المسؤول</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    لا توجد معاملات مسجلة حالياً
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const isSalary = pay.type === 'راتب مدرب';
                  return (
                    <tr key={pay.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Membership Code */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-300">
                        {pay.memberNumber ? `#${pay.memberNumber}` : '—'}
                      </td>

                      {/* Name & Details - Clickable to open player profile */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => handlePlayerClick(pay)}
                          className={`font-bold text-white text-sm flex items-center gap-1.5 ${
                            !isSalary ? 'cursor-pointer hover:text-blue-400 hover:underline transition-colors' : ''
                          }`}
                          title={!isSalary ? 'اضغط لفتح الملف التعريفي للاعب' : ''}
                        >
                          {isSalary && <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                          <span>{pay.playerName}</span>
                        </div>
                        {pay.team && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">{pay.team}</span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isSalary
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isSalary ? 'صرف راتب' : 'اشتراك لاعب'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 font-mono font-bold text-sm">
                        <span className={isSalary ? 'text-purple-300' : 'text-emerald-400'}>
                          {formatMoney(pay.amount)}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="py-3 px-3 text-slate-300">{pay.method}</td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">{formatDateTimeArabic(pay.createdAt || pay.date)}</td>

                      {/* Period Month */}
                      <td className="py-3 px-3 text-slate-300 font-medium">{pay.periodMonth}</td>

                      {/* Collected By */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">{pay.collectedBy}</td>

                      {/* Actions: Receipt Button + 3-dots Menu */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 relative">
                          <button
                            type="button"
                            onClick={() => onPreviewInvoice(pay)}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="عرض الإيصال"
                          >
                            <Printer className="w-3 h-3 text-blue-400" />
                            <span>إيصال</span>
                          </button>

                          {/* Three Dots Menu Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === pay.id ? null : pay.id);
                              }}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                              title="خيارات إضافية"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === pay.id && (
                              <div
                                className="absolute left-0 top-full mt-1 w-36 bg-slate-900/98 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl py-1 z-40 text-right animate-scaleUp"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {onEditPayment && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onEditPayment(pay);
                                    }}
                                    className="w-full px-3 py-2 text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-300 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                    <span>تعديل السند</span>
                                  </button>
                                )}

                                {!isSalary && onSelectPlayer && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handlePlayerClick(pay);
                                    }}
                                    className="w-full px-3 py-2 text-xs text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <User className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>بروفايل اللاعب</span>
                                  </button>
                                )}

                                {onDeletePayment && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onDeletePayment(pay.id);
                                    }}
                                    className="w-full px-3 py-2 text-xs text-rose-300 hover:bg-rose-600/20 flex items-center gap-2 transition-colors cursor-pointer border-t border-white/5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span>حذف السند</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
