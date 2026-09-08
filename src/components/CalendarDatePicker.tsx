import React from 'react';
import { Calendar, ChevronRight, ChevronLeft, RotateCcw, CalendarDays, Clock } from 'lucide-react';

interface CalendarDatePickerProps {
  selectedDate: string; // 'ALL' or 'YYYY-MM-DD'
  onSelectDate: (date: string) => void;
  label?: string;
  recordCount?: number;
  recordUnit?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseLocalDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  selectedDate,
  onSelectDate,
  label = 'تقويم التواريخ:',
  recordCount,
  recordUnit = 'سجل',
  className = '',
}) => {
  const today = localDateKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);

  const formatArabicFullDate = (dateStr: string) => {
    if (dateStr === 'ALL' || !dateStr) return 'جميع الأيام (السجل العام الشامل)';
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('ar-EG', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const shiftDay = (days: number) => {
    const baseDate = selectedDate === 'ALL' || !selectedDate ? new Date() : parseLocalDate(selectedDate);
    baseDate.setDate(baseDate.getDate() + days);
    onSelectDate(localDateKey(baseDate));
  };

  const isAll = selectedDate === 'ALL' || !selectedDate;

  return (
    <div dir="rtl" className={`p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md space-y-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-xs shrink-0">
            <div className="w-7 h-7 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-yellow-400" />
            </div>
            <span>{label}</span>
          </div>
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10">
            <button type="button" onClick={() => onSelectDate('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isAll ? 'bg-yellow-400 text-black shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>جميع الأيام</button>
            <button type="button" onClick={() => onSelectDate(today)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedDate === today ? 'bg-yellow-400 text-black shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>اليوم</button>
            <button type="button" onClick={() => onSelectDate(yesterday)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedDate === yesterday ? 'bg-yellow-400 text-black shadow-xs' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'}`}>أمس</button>
          </div>
        </div>

        {/* التاريخ الموحد: إدخال/تقويم + سهم يوم سابق + سهم يوم لاحق */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10">
            <button type="button" onClick={() => shiftDay(1)} title="زيادة يوم" aria-label="زيادة يوم" className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => shiftDay(-1)} title="نقص يوم" aria-label="نقص يوم" className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="relative flex items-center">
            <Calendar className="absolute right-3 w-4 h-4 text-yellow-400 pointer-events-none" />
            <input
              type="date"
              aria-label="اختيار التاريخ"
              value={isAll ? today : selectedDate}
              onChange={(e) => onSelectDate(e.target.value || today)}
              className="w-[155px] bg-black/60 border border-white/20 focus:border-yellow-400 focus:outline-hidden text-yellow-300 font-mono text-xs rounded-xl pr-9 pl-3 py-2.5 cursor-text transition-all shadow-inner"
            />
          </div>
          {!isAll && (
            <button type="button" onClick={() => onSelectDate('ALL')} title="عرض كل الأيام" className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-1.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-yellow-400" />
          {isAll ? <span className="text-slate-400">يتم الآن عرض البيانات التراكمية لكافة الأيام المسجلة</span> : <span>عرض بيانات يوم: <strong className="text-yellow-300">{formatArabicFullDate(selectedDate)}</strong></span>}
        </div>
        {recordCount !== undefined && <span className="px-2.5 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-300 font-bold text-[11px]">{recordCount} {recordUnit}</span>}
      </div>
    </div>
  );
};
