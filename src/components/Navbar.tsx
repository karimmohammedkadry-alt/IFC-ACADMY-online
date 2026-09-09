import React from 'react';
import {
  Home,
  Users,
  CalendarCheck2,
  CreditCard,
  Banknote,
  FileText,
  Award,
  Settings,
  Bell,
  LogOut,
} from 'lucide-react';
import { PageTab } from '../types';
import { IFCLogo } from './IFCLogo';

interface NavbarProps {
  currentTab: PageTab;
  onSelectTab: (tab: PageTab) => void;
  onLogout: () => void;
  expiringIn3DaysCount: number;
  unpaidCount?: number;
  totalNotificationsCount?: number;
  onOpenNotifications: () => void;
  currentUser?: { name: string; avatar: string; role?: string; email?: string };
  isDbConnected?: boolean;
  customLogoUrl?: string;
  academyName?: string;
  logoText?: string;
  navbarColor?: string;
  primaryColor?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onLogout,
  expiringIn3DaysCount,
  unpaidCount = 0,
  totalNotificationsCount = 0,
  onOpenNotifications,
  customLogoUrl,
  academyName,
  logoText,
  navbarColor,
  primaryColor,
}) => {
  const navItems: { id: PageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-4 h-4" /> },
    { id: 'players', label: 'اللاعبين', icon: <Users className="w-4 h-4" /> },
    { id: 'attendance', label: 'الحضور والغياب', icon: <CalendarCheck2 className="w-4 h-4" /> },
    { id: 'payments', label: 'المدفوعات', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'finance', label: 'المصروفات والمالية', icon: <Banknote className="w-4 h-4" /> },
    { id: 'reports', label: 'التقارير', icon: <FileText className="w-4 h-4" /> },
    { id: 'coaches', label: 'المدربين', icon: <Award className="w-4 h-4" /> },
    { id: 'settings', label: 'الإعدادات', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <nav
      id="main-top-navbar"
      style={navbarColor ? { backgroundColor: `${navbarColor}eb`, borderColor: primaryColor ? `${primaryColor}40` : undefined } : undefined}
      className="w-full bg-slate-950/80 backdrop-blur-2xl border-b border-yellow-500/20 shadow-lg shadow-black/40 sticky top-0 z-40 transition-colors duration-300"
      dir="rtl"
    >
      <div className="max-w-[1700px] mx-auto px-4 flex items-center justify-between h-16">
        {/* Right side: Logo & Brand */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {/* Official IFC Circular Logo */}
            <IFCLogo size="sm" withGlow customLogoUrl={customLogoUrl} className="group-hover:scale-105 transition-transform" />
            
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-wider text-white uppercase font-sans">
                {logoText || 'IFC'} <span style={{ color: primaryColor || '#eab308' }}>{academyName || 'ACADEMY'}</span>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.04] border shadow-sm backdrop-blur-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <span style={isActive ? { color: primaryColor || '#eab308' } : undefined} className={!isActive ? 'text-slate-400' : ''}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 right-3 left-3 h-[2.5px] rounded-t-full" style={{ backgroundColor: primaryColor || '#eab308' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Medium screens overflow navigation */}
        <div className="flex xl:hidden items-center gap-1 overflow-x-auto py-1 max-w-[50%] scrollbar-none">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  isActive
                    ? 'bg-white/[0.04] border'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Left side: Notifications Bell & Logout button */}
        <div className="flex items-center gap-2.5">
          {/* Notifications icon button (clean, no text, with alert badge) */}
          <button
            id="btn-nav-notifications"
            onClick={onOpenNotifications}
            className="relative p-2 sm:p-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/25 hover:border-yellow-500/40 backdrop-blur-md transition-all cursor-pointer group shadow-sm shadow-yellow-500/5 flex items-center justify-center"
            title="مركز الإشعارات والتنبيهات"
            aria-label="مركز الإشعارات والتنبيهات"
          >
            <Bell
              style={{ color: primaryColor || '#eab308' }}
              className={`w-5 h-5 transition-transform ${
                totalNotificationsCount > 0 || expiringIn3DaysCount > 0
                  ? 'animate-bell-shake'
                  : 'group-hover:rotate-12 group-hover:scale-110'
              }`}
            />
            {(totalNotificationsCount > 0 || expiringIn3DaysCount > 0) && (
              <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50 border border-yellow-100 animate-pulse">
                {totalNotificationsCount > 0
                  ? totalNotificationsCount > 99
                    ? '99+'
                    : totalNotificationsCount
                  : expiringIn3DaysCount}
              </span>
            )}
          </button>

          {/* Logout button */}
          <button
            id="btn-nav-logout"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-xl backdrop-blur-md transition-all cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
