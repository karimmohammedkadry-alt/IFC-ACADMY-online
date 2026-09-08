import React from 'react';
import { Users, UserCheck, UserX, ArrowLeft } from 'lucide-react';
import { Player, PageTab } from '../types';
import { IFCLogo } from '../components/IFCLogo';

interface DashboardViewProps {
  players: Player[];
  onNavigate: (tab: PageTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  players,
  onNavigate,
}) => {
  const totalPlayers = players.length;
  const activePlayers = players.filter((p) => p.status === 'نشط').length;
  const inactivePlayers = players.filter((p) => p.status !== 'نشط').length;

  const activePercentage = totalPlayers > 0 ? Math.round((activePlayers / totalPlayers) * 100) : 0;
  const inactivePercentage = totalPlayers > 0 ? Math.round((inactivePlayers / totalPlayers) * 100) : 0;

  return (
    <div id="view-dashboard" className="space-y-8 animate-fadeIn py-4 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <IFCLogo size="lg" withGlow />
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
              الصفحة الرئيسية - <span className="text-yellow-400">IFC ACADEMY</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              نظرة عامة ومباشرة على أعداد اللاعبين وحالات الاشتراك في الأكاديمية
            </p>
          </div>
        </div>
      </div>

      {/* The 3 Specific Cards (إجمالي اللاعبين، لاعبين نشطين، لاعبين غير نشطين فقط) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Players */}
        <div
          onClick={() => onNavigate('players')}
          className="group relative bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-xl border border-white/10 hover:border-blue-500/40 rounded-3xl p-7 shadow-xl shadow-black/20 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none" />
          
          <div className="flex items-center justify-between mb-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10 backdrop-blur-md group-hover:scale-105 transition-transform">
              <Users className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold">
              100%
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block tracking-wider">
              إجمالي اللاعبين
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                {totalPlayers}
              </span>
              <span className="text-xs font-semibold text-slate-400">لاعب مسجل</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>جميع المسجلين بالأكاديمية</span>
            <span className="text-blue-400 group-hover:translate-x-[-4px] transition-transform font-bold inline-flex items-center gap-1">
              التفاصيل &larr;
            </span>
          </div>
        </div>

        {/* Card 2: Active Players */}
        <div
          onClick={() => onNavigate('players')}
          className="group relative bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-xl border border-white/10 hover:border-emerald-500/40 rounded-3xl p-7 shadow-xl shadow-black/20 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          
          <div className="flex items-center justify-between mb-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 backdrop-blur-md group-hover:scale-105 transition-transform">
              <UserCheck className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              {activePercentage}%
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block tracking-wider">
              لاعبين نشطين
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight">
                {activePlayers}
              </span>
              <span className="text-xs font-semibold text-slate-400">لاعب منتظم</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>اشتراكات سارية وحضور منتظم</span>
            <span className="text-emerald-400 group-hover:translate-x-[-4px] transition-transform font-bold inline-flex items-center gap-1">
              التفاصيل &larr;
            </span>
          </div>
        </div>

        {/* Card 3: Inactive Players */}
        <div
          onClick={() => onNavigate('players')}
          className="group relative bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-xl border border-white/10 hover:border-rose-500/40 rounded-3xl p-7 shadow-xl shadow-black/20 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />
          
          <div className="flex items-center justify-between mb-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10 backdrop-blur-md group-hover:scale-105 transition-transform">
              <UserX className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
              {inactivePercentage}%
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 block tracking-wider">
              لاعبين غير نشطين
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black text-rose-400 font-mono tracking-tight">
                {inactivePlayers}
              </span>
              <span className="text-xs font-semibold text-slate-400">غير نشط / متأخر</span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>متأخرون عن التجديد أو منقطعون</span>
            <span className="text-rose-400 group-hover:translate-x-[-4px] transition-transform font-bold inline-flex items-center gap-1">
              التفاصيل &larr;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
