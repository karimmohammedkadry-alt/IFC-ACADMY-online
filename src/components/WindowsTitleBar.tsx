import React from 'react';
import { notifyToast } from '../utils/toast';
import { Minus, Square, X, Monitor, Globe } from 'lucide-react';

interface WindowsTitleBarProps {
  isWindowsMode: boolean;
  onToggleWindowsMode: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  isWindowsMode,
  onToggleWindowsMode,
}) => {
  return (
    <header
      id="windows-title-bar"
      className="w-full bg-white/[0.04] backdrop-blur-2xl border-b border-white/10 text-slate-300 text-xs flex items-center justify-between px-3 py-2 select-none z-50 transition-colors"
      dir="ltr"
    >
      {/* App brand and title */}
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-[10px] leading-none shadow-sm shadow-blue-500/30">
          IFC
        </div>
        <span className="font-semibold tracking-wide text-slate-200">
          IFC Academy Manager - v2.4.0 (Windows x64 Desktop & Web)
        </span>
        <span className="text-[10px] bg-white/[0.06] border border-white/10 text-blue-300 px-2 py-0.5 rounded-md backdrop-blur-md">
          {isWindowsMode ? 'Windows Desktop App' : 'Web Browser Mode'}
        </span>
      </div>

      {/* Mode toggle and window action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleWindowsMode}
          id="btn-toggle-windows-mode"
          title={isWindowsMode ? 'التحويل لواجهة المتصفح' : 'التحويل لواجهة تطبيق ويندوز'}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 backdrop-blur-md transition-colors mr-2 cursor-pointer"
        >
          {isWindowsMode ? <Globe className="w-3.5 h-3.5 text-blue-400" /> : <Monitor className="w-3.5 h-3.5 text-blue-400" />}
          <span>{isWindowsMode ? 'وضع المتصفح' : 'وضع تطبيق ويندوز'}</span>
        </button>

        <button
          id="btn-win-minimize"
          className="w-8 h-7 flex items-center justify-center hover:bg-white/[0.1] text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
          title="تصغير"
          onClick={() => notifyToast('error', 'تنبيه النظام', 'تم تصغير نافذة نظام IFC Academy في شريط المهام.')}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          id="btn-win-maximize"
          className="w-8 h-7 flex items-center justify-center hover:bg-white/[0.1] text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
          title="تكبير / استعادة"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          id="btn-win-close"
          className="w-8 h-7 flex items-center justify-center hover:bg-rose-600/80 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
          title="إغلاق البرنامج"
          onClick={() => {
            if (confirm('هل أنت متأكد من رغبتك في إغلاق نظام أكاديمية IFC؟')) {
              window.location.reload();
            }
          }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
