import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Check,
  X,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import { Player, AttendanceStatus } from '../types';
import { exportToExcel } from '../utils/excelExport';
import { CalendarDatePicker } from '../components/CalendarDatePicker';
import { ImportExportToolbar } from '../components/ImportExportToolbar';
import { playerMatchesSearch } from '../utils/playerSearch';

interface AttendanceViewProps {
  players: Player[];
  onUpdatePlayerAttendance: (
    playerId: string,
    status: 'حاضر' | 'غائب',
    sessionDate: string
  ) => void;
  onBatchMarkAllPresent?: (playerIds: string[], sessionDate: string) => void;
  onMarkAllPresent?: (group: string, date: string) => void;
  onImportAttendance?: (data: any) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  players,
  onUpdatePlayerAttendance,
  onBatchMarkAllPresent,
  onMarkAllPresent,
  onImportAttendance,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedGroup, setSelectedGroup] = useState<string>('جميع المجموعات');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter players by group, search query, and attendance status on selected date
  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesGroup =
        selectedGroup === 'جميع المجموعات' || player.team === selectedGroup;

      const matchesSearch = playerMatchesSearch(player, searchQuery);

      // Find status on selected date
      const session = player.sessions.find((s) => s.date === selectedDate);
      const statusOnDate = session?.status || 'لم يسجل';

      let matchesStatus = true;
      if (statusFilter === 'حاضر') matchesStatus = statusOnDate === 'حاضر';
      else if (statusFilter === 'غائب') matchesStatus = statusOnDate === 'غائب';
      else if (statusFilter === 'لم يسجل') matchesStatus = statusOnDate === 'لم يسجل';

      return matchesGroup && matchesSearch && matchesStatus;
    });
  }, [players, selectedGroup, selectedDate, statusFilter, searchQuery]);

  // Attendance stats for selected date
  const stats = useMemo(() => {
    const relevantPlayers =
      selectedGroup === 'جميع المجموعات'
        ? players
        : players.filter((p) => p.team === selectedGroup);

    let present = 0;
    let absent = 0;
    let unmarked = 0;

    relevantPlayers.forEach((p) => {
      const s = p.sessions.find((sess) => sess.date === selectedDate);
      if (!s) {
        unmarked++;
      } else if (s.status === 'حاضر') {
        present++;
      } else if (s.status === 'غائب') {
        absent++;
      } else {
        unmarked++;
      }
    });

    const total = relevantPlayers.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, unmarked, rate };
  }, [players, selectedGroup, selectedDate]);

  const handleMarkAllPresent = () => {
    if (onBatchMarkAllPresent) {
      const idsToMark = filteredPlayers.map((p) => p.id);
      onBatchMarkAllPresent(idsToMark, selectedDate);
    } else if (onMarkAllPresent) {
      onMarkAllPresent(selectedGroup, selectedDate);
    }
  };

  const handleExportAttendanceCsv = () => {
    const headers = [
      'رقم العضوية',
      'اسم اللاعب',
      'المجموعة',
      'التاريخ',
      'حالة الحضور',
      'نسبة الالتزام العامة',
    ];

    const rows = filteredPlayers.map((p) => {
      const sess = p.sessions.find((s) => s.date === selectedDate);
      const statusLabel = sess ? sess.status : 'لم يسجل بعد';
      return [
        p.memberNumber,
        p.name,
        p.team,
        selectedDate,
        statusLabel,
        `${p.attendanceRate}%`,
      ];
    });

    exportToExcel(`حضور_${selectedDate}`, headers, rows);
  };

  return (
    <div id="view-attendance" className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* 1. Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 backdrop-blur-md">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">تسجيل ومتابعة الحضور والغياب</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              تحضير اللاعبين اليومي (حاضر أو غائب فقط) ومتابعة الالتزام
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Import / Export Toolbar */}
          <ImportExportToolbar
            onExport={handleExportAttendanceCsv}
            onImport={onImportAttendance}
            exportLabel="تصدير الحضور (Excel)"
            importLabel="استيراد كشف حضور"
            preferredSheets={['الحضور', 'Attendance', 'attendance']}
          />

          <button
            onClick={handleMarkAllPresent}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>تحضير الكل (حاضر)</span>
          </button>
        </div>
      </div>

      {/* Calendar Day Filter Bar */}
      <CalendarDatePicker
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d === 'ALL' ? todayStr : d)}
        label="تقويم يوم الحصة التدريبية للحضور:"
        recordCount={filteredPlayers.length}
        recordUnit="لاعب"
      />

      {/* 2. Top Summary Indicators - ONLY Total, Present, Absent, Unmarked */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total In Group */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>إجمالي اللاعبين</span>
            <Users className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1 font-mono">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{selectedGroup}</div>
        </div>

        {/* Present */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-emerald-400 flex items-center justify-between">
            <span>الحاضرين</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{stats.present}</div>
          <div className="text-[10px] text-emerald-400/70 mt-0.5">{stats.rate}% نسبة الحضور</div>
        </div>

        {/* Absent */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-rose-400 flex items-center justify-between">
            <span>الغائبين</span>
            <XCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-1 font-mono">{stats.absent}</div>
          <div className="text-[10px] text-rose-400/70 mt-0.5">غائب عن التدريب</div>
        </div>

        {/* Unmarked */}
        <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>لم يُسجل بعد</span>
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-300 mt-1 font-mono">{stats.unmarked}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">بانتظار التحضير</div>
        </div>
      </div>

      {/* 3. Filters & Date Controls */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl shadow-black/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Group Filter - شباب، براعم، ناشئين، بنات */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>المجموعة / الفئة</span>
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
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

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span>حالة الحضور بالتاريخ</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-400 backdrop-blur-md cursor-pointer"
            >
              <option value="الكل" className="bg-slate-900 text-slate-200">
                جميع الحالات
              </option>
              <option value="حاضر" className="bg-slate-900 text-slate-200">
                حاضر فقط
              </option>
              <option value="غائب" className="bg-slate-900 text-slate-200">
                غائب فقط
              </option>
              <option value="لم يسجل" className="bg-slate-900 text-slate-200">
                لم يُسجل بعد
              </option>
            </select>
          </div>

          {/* Search box */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>بحث سريع عن لاعب</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="الاسم أو رقم العضوية..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-400 backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      {/* 4. Attendance Roll Call List - NO PHOTOS, ONLY PRESENT & ABSENT */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="p-3.5 bg-white/[0.02] border-b border-white/10 flex items-center justify-between text-xs">
          <div className="font-semibold text-white">
            كشف تحضير اللاعبين ({filteredPlayers.length} لاعب)
          </div>
          <div className="text-slate-400 font-mono text-[11px]">التاريخ: {selectedDate}</div>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm">لا يوجد لاعبون مطابقون للشروط المحددة</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredPlayers.map((player) => {
              const currentSession = player.sessions.find((s) => s.date === selectedDate);
              const currentStatus = currentSession?.status;

              return (
                <div
                  key={player.id}
                  className={`p-3.5 sm:p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl ${
                    currentStatus === 'غائب'
                      ? 'bg-rose-500/10 border-2 border-rose-500/40 my-1 shadow-md shadow-rose-950/20'
                      : currentStatus === 'حاضر'
                      ? 'bg-emerald-500/[0.03] hover:bg-white/[0.02]'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Player Basic Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                        currentStatus === 'غائب'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                      }`}
                    >
                      #{player.memberNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{player.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/10">
                          {player.team}
                        </span>
                        {currentStatus === 'غائب' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white flex items-center gap-1 shadow-sm animate-pulse">
                            <XCircle className="w-3 h-3" />
                            <span>غائب اليوم</span>
                          </span>
                        )}
                        {currentStatus === 'حاضر' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>حاضر اليوم</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>
                          نسبة الالتزام العامة:{' '}
                          <strong className="text-blue-400 font-mono">
                            {player.attendanceRate}%
                          </strong>
                        </span>
                        <span>•</span>
                        <span>غيابات مسجلة: <strong className={player.absentSessions > 0 ? "text-rose-400 font-mono" : "text-slate-300 font-mono"}>{player.absentSessions}</strong></span>
                        <span>•</span>
                        <span>نهاية الاشتراك: {player.subscriptionEndDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Actions: ONLY Present / Absent */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Present Button */}
                    <button
                      type="button"
                      onClick={() => onUpdatePlayerAttendance(player.id, 'حاضر', selectedDate)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        currentStatus === 'حاضر'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                          : 'bg-white/[0.05] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>حاضر</span>
                    </button>

                    {/* Absent Button */}
                    <button
                      type="button"
                      onClick={() => onUpdatePlayerAttendance(player.id, 'غائب', selectedDate)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        currentStatus === 'غائب'
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/50'
                          : 'bg-white/[0.05] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10'
                      }`}
                    >
                      <X className="w-4 h-4 stroke-[3]" />
                      <span>غائب</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
