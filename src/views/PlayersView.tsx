import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Calendar,
  DollarSign,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import { Player } from '../types';
import { exportToExcel } from '../utils/excelExport';
import { CalendarDatePicker } from '../components/CalendarDatePicker';
import { ImportExportToolbar } from '../components/ImportExportToolbar';

interface PlayersViewProps {
  players: Player[];
  onAddPlayer: () => void;
  onEditPlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
  onSelectPlayer?: (player: Player) => void;
  onExportReport: () => void;
  onExportPlayerStatement?: (playerId: string) => void;
  onImportPlayers?: (data: any) => void;
  isAmountsVisible?: boolean;
  onToggleAmountsVisible?: () => void;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
  onSelectPlayer,
  onExportReport,
  onExportPlayerStatement,
  onImportPlayers,
  isAmountsVisible = true,
  onToggleAmountsVisible,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('جميع المجموعات');
  const [selectedFilter, setSelectedFilter] = useState('جميع الاشتراكات');
  const [selectedDate, setSelectedDate] = useState('ALL');

  // Filter players
  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      if (selectedDate !== 'ALL') {
        const matchesDate =
          player.subscriptionStartDate === selectedDate ||
          player.subscriptionEndDate === selectedDate;
        if (!matchesDate) return false;
      }

      const matchesSearch =
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.memberNumber.toString().includes(searchTerm) ||
        player.phone.includes(searchTerm) ||
        player.parentPhone.includes(searchTerm) ||
        (player.nationalId && player.nationalId.includes(searchTerm));

      const matchesTeam =
        selectedTeam === 'جميع المجموعات' || player.team === selectedTeam;

      let matchesStatus = true;
      if (selectedFilter === 'اشتراكات سارية (نشطة)') {
        matchesStatus = player.status === 'نشط';
      } else if (selectedFilter === 'اشتراكات متأخرة / منتهية') {
        matchesStatus = player.status === 'متأخر' || player.status === 'منتهي';
      }

      return matchesSearch && matchesTeam && matchesStatus;
    });
  }, [players, searchTerm, selectedTeam, selectedFilter, selectedDate]);

  // Aggregate stats
  const totalPlayers = players.length;
  const activePlayers = players.filter((p) => p.status === 'نشط').length;
  const overduePlayers = players.filter(
    (p) => p.status === 'متأخر' || p.status === 'منتهي'
  ).length;

  const handleExportCsvClean = () => {
    const headers = [
      'رقم العضوية',
      'اسم اللاعب',
      'الرقم القومي',
      'المجموعة',
      'تاريخ البداية',
      'تاريخ النهاية',
      'قيمة الاشتراك',
      'هاتف اللاعب',
      'هاتف ولي الأمر',
      'الحالة',
    ];

    const rows = filteredPlayers.map((p) => [
      p.memberNumber,
      p.name,
      p.nationalId || 'غير مسجل',
      p.team,
      p.subscriptionStartDate,
      p.subscriptionEndDate,
      p.monthlyFee,
      p.phone || '',
      p.parentPhone || '',
      p.status,
    ]);

    exportToExcel('قائمة_اللاعبين_IFC_Academy', headers, rows);
  };

  const formatMoney = (amount: number) => {
    if (!isAmountsVisible) return '•••• ج.م';
    return `${amount.toLocaleString()} ج.م`;
  };

  return (
    <div id="view-players" className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* 1. Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 backdrop-blur-md flex items-center justify-center text-blue-400 shadow-sm shadow-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>قائمة اللاعبين</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-normal">
                {players.length} لاعب
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة بيانات اللاعبين، متابعة الاشتراكات واستعراض الملف الشخصي
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onToggleAmountsVisible && (
            <button
              onClick={onToggleAmountsVisible}
              className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-semibold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
              title={isAmountsVisible ? 'إخفاء المبالغ المالية' : 'إظهار المبالغ المالية'}
            >
              {isAmountsVisible ? (
                <>
                  <EyeOff className="w-4 h-4 text-blue-400" />
                  <span>إخفاء الرسوم</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>إظهار الرسوم</span>
                </>
              )}
            </button>
          )}

          {onExportPlayerStatement && filteredPlayers.length > 0 && (
            <button
              onClick={() => onExportPlayerStatement(filteredPlayers[0]?.id)}
              id="btn-export-players-pdf"
              className="px-3.5 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer shadow-sm shadow-yellow-500/10"
              title="تصدير كشف حساب اللاعب بصيغة PDF"
            >
              <FileText className="w-4 h-4 text-yellow-400" />
              <span>كشف حساب PDF</span>
            </button>
          )}

          {/* Import / Export Toolbar */}
          <ImportExportToolbar
            onExport={handleExportCsvClean}
            onImport={onImportPlayers}
            exportLabel="تصدير اللاعبين (Excel)"
            importLabel="استيراد لاعبين"
            preferredSheets={['اللاعبين', 'Players', 'players']}
          />

          <button
            id="btn-open-add-player"
            onClick={onAddPlayer}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة لاعب</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar for Calendar Day Selection */}
      <CalendarDatePicker
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        label="تقويم يوم بدء أو انتهاء الاشتراك:"
        recordCount={filteredPlayers.length}
        recordUnit="لاعب"
      />

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>إجمالي اللاعبين المسجلين</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalPlayers}</div>
          <div className="text-[11px] text-slate-500 mt-1">كافة الفئات والمجموعات</div>
        </div>

        {/* Active */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
            <span>اشتراكات سارية ونشطة</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{activePlayers}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1">
            {totalPlayers > 0 ? Math.round((activePlayers / totalPlayers) * 100) : 0}% من إجمالي اللاعبين
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between text-xs text-rose-400 mb-1">
            <span>اشتراكات متأخرة للتجديد</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{overduePlayers}</div>
          <div className="text-[11px] text-rose-400/80 mt-1">بحاجة لمتابعة السداد والتجديد</div>
        </div>
      </div>

      {/* 3. Search and Filters */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم، كود اللاعب، الرقم القومي أو الهاتف..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400 backdrop-blur-md"
            />
          </div>

          {/* Group / Team Filter - شباب، براعم، ناشئين، بنات */}
          <div>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-400 backdrop-blur-md cursor-pointer"
            >
              <option value="جميع المجموعات" className="bg-slate-900 text-slate-200">
                جميع المجموعات
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

          {/* Subscription Status Filter */}
          <div>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-400 backdrop-blur-md cursor-pointer"
            >
              <option value="جميع الاشتراكات" className="bg-slate-900 text-slate-200">
                جميع حالات الاشتراك
              </option>
              <option value="اشتراكات سارية (نشطة)" className="bg-slate-900 text-slate-200">
                اشتراكات سارية (نشطة)
              </option>
              <option value="اشتراكات متأخرة / منتهية" className="bg-slate-900 text-slate-200">
                اشتراكات متأخرة / منتهية
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Players List Table - NO IMAGES, CLICK ROW FOR PROFILE */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="p-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-blue-400" />
            <span>اضغط على أي لاعب لفتح ملفه الشخصي ومتابعة سجل الحضور والمدفوعات</span>
          </span>
          <span className="font-mono text-slate-500">{filteredPlayers.length} معروض</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-white/[0.04] border-b border-white/10 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">اللاعب</th>
                <th className="py-3.5 px-3">رقم العضوية</th>
                <th className="py-3.5 px-3">الرقم القومي</th>
                <th className="py-3.5 px-3">المجموعة</th>
                <th className="py-3.5 px-3">بداية الاشتراك</th>
                <th className="py-3.5 px-3">نهاية الاشتراك</th>
                <th className="py-3.5 px-3">قيمة الاشتراك</th>
                <th className="py-3.5 px-3">رقم ولي الأمر</th>
                <th className="py-3.5 px-3">الحالة</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-200">
                        {players.length === 0
                          ? 'لا يوجد لاعبون مسجلون حالياً.'
                          : 'لا توجد نتائج مطابقة لبحثك.'}
                      </p>
                      {players.length === 0 && (
                        <button
                          onClick={onAddPlayer}
                          className="mt-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>إضافة أول لاعب الآن</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                    onClick={() => onSelectPlayer && onSelectPlayer(player)}
                  >
                    {/* Player Info - NO PHOTO AS REQUESTED */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">
                          {player.name}
                        </span>
                        {player.phone && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {player.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Member Code */}
                    <td className="py-3 px-3 font-mono font-bold text-blue-300">
                      #{player.memberNumber}
                    </td>

                    {/* National ID */}
                    <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                      {player.nationalId ? player.nationalId : <span className="text-slate-600">-</span>}
                    </td>

                    {/* Group */}
                    <td className="py-3 px-3 font-medium text-slate-300">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-xs font-semibold">
                        {player.team}
                      </span>
                    </td>

                    {/* Subscription Start Date */}
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {player.subscriptionStartDate || player.joinDate}
                    </td>

                    {/* Subscription End Date */}
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={
                          player.status === 'نشط' ? 'text-emerald-400' : 'text-rose-400 font-bold'
                        }
                      >
                        {player.subscriptionEndDate || player.subscriptionExpiry}
                      </span>
                    </td>

                    {/* Monthly Fee */}
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {formatMoney(player.monthlyFee)}
                    </td>

                    {/* Parent Phone */}
                    <td className="py-3 px-3 font-mono text-slate-400" onClick={(e) => e.stopPropagation()}>
                      {player.parentPhone ? (
                        <a
                          href={`https://wa.me/2${player.parentPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
                          title="مراسلة واتساب"
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{player.parentPhone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          player.status === 'نشط'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {player.status === 'نشط' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>نشط</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            <span>متأخر</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectPlayer && onSelectPlayer(player)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors cursor-pointer"
                          title="عرض الملف الشخصي"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onExportPlayerStatement && onExportPlayerStatement(player.id)}
                          className="p-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 transition-colors cursor-pointer"
                          title="كشف حساب (PDF)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onEditPlayer(player)}
                          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition-colors cursor-pointer"
                          title="تعديل بيانات اللاعب"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف اللاعب "${player.name}"؟`)) {
                              onDeletePlayer(player.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                          title="حذف اللاعب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
