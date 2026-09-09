import React from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type SystemToastType = 'success' | 'error' | 'info';

interface SystemToastProps {
  open: boolean;
  type: SystemToastType;
  title: string;
  message?: string;
  onClose: () => void;
}

export const SystemToast: React.FC<SystemToastProps> = ({ open, type, title, message, onClose }) => {
  if (!open) return null;
  const success = type === 'success';
  const info = type === 'info';
  return (
    <div className="fixed left-1/2 bottom-7 z-[9999] -translate-x-1/2 px-4 w-full max-w-md pointer-events-none" dir="rtl">
      <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-[#15112d]/95 backdrop-blur-xl px-4 py-3.5 shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-3 fade-in duration-200">
        <div className={`mt-0.5 rounded-full p-1.5 ${success ? 'bg-emerald-500/15 text-emerald-400' : info ? 'bg-sky-500/15 text-sky-400' : 'bg-rose-500/15 text-rose-400'}`}>
          {success ? <CheckCircle2 className="w-5 h-5" /> : info ? <Info className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-white">{title}</div>
          {message && <div className="text-xs text-slate-300 mt-1 leading-5">{message}</div>}
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
