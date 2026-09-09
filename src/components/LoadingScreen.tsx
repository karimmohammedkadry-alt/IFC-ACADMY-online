import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { IFCLogo } from './IFCLogo';

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(15);
  const [currentStep, setCurrentStep] = useState('جاري تهيئة بيئة العمل ونظام IFC ACADEMY...');

  useEffect(() => {
    const steps = [
      { at: 25, text: 'الاتصال بالخادم وتأمين جلسة العمل...' },
      { at: 50, text: 'تحميل سجلات اللاعبين والاشتراكات والمجموعات...' },
      { at: 75, text: 'مزامنة المعاملات المالية والمصروفات...' },
      { at: 95, text: 'تجهيز مؤشرات الأداء والتقارير الإدارية...' },
      { at: 100, text: 'اكتمل التحميل بنجاح! جاري الانتقال لتسجيل الدخول...' },
    ];

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 9) + 5;
        if (next >= 100) {
          clearInterval(timer);
          setCurrentStep('اكتمل التحميل بنجاح! جاري الانتقال لتسجيل الدخول...');
          // Auto advance to login after 600ms
          setTimeout(() => {
            onComplete();
          }, 600);
          return 100;
        }
        for (const step of steps) {
          if (next >= step.at && prev < step.at) {
            setCurrentStep(step.text);
          }
        }
        return next;
      });
    }, 160);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div
      id="page-loading-splash"
      className="min-h-[85vh] flex flex-col items-center justify-center p-6 text-slate-100"
      dir="rtl"
    >
      <div className="max-w-md w-full flex flex-col items-center text-center animate-fadeIn">
        {/* Official IFC Logo with ambient gold glow */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-yellow-500/20 blur-3xl animate-pulse" />
          <IFCLogo size="xl" withGlow className="w-28 h-28" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black tracking-wider text-white font-sans uppercase mb-1">
          IFC <span className="text-yellow-400">ACADEMY</span>
        </h1>
        <p className="text-sm text-yellow-400/90 font-medium mb-1">
          INTERNATIONAL FIGHT CLUB • KICKBOXING
        </p>
        <p className="text-xs text-slate-400 mb-8">
          نظام برمجي متكامل لإدارة الأكاديميات الرياضية والمالية
        </p>

        {/* Progress Card */}
        <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-blue-400 flex items-center gap-1.5">
              {progress < 100 ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {progress < 100 ? 'جاري التحميل...' : 'مكتمل'}
            </span>
            <span className="font-mono text-slate-200 text-sm">{progress}%</span>
          </div>

          {/* Bar */}
          <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden mb-4 p-0.5 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status step text */}
          <p className="text-xs text-slate-400 h-5 overflow-hidden text-ellipsis whitespace-nowrap">
            {currentStep}
          </p>

          {/* Enter System Button (Only when loaded) */}
          {progress === 100 && (
            <button
              id="btn-enter-system"
              onClick={onComplete}
              className="w-full mt-6 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 animate-fadeIn"
            >
              <span>الانتقال إلى تسجيل الدخول</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* System specs note */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <span>IFC ACADEMY</span>
          <span>•</span>
          <span>الإصدار v2.4.0</span>
          <span>•</span>
          <span>لوحة الإدارة المعتمدة</span>
        </div>
      </div>
    </div>
  );
};
