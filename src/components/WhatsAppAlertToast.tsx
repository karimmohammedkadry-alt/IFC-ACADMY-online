import React, { useEffect, useState } from 'react';
import { MessageCircle, X, ExternalLink, BellRing, CheckCircle2 } from 'lucide-react';
import { soundAlertManager } from '../utils/soundAlert';

export interface WhatsAppAlertMessage {
  id: string;
  title: string;
  body: string;
  phone?: string;
  playerName?: string;
  timestamp: string;
  type?: 'urgent' | 'warning' | 'info';
}

interface WhatsAppAlertToastProps {
  alert: WhatsAppAlertMessage | null;
  onDismiss: () => void;
}

export const WhatsAppAlertToast: React.FC<WhatsAppAlertToastProps> = ({
  alert,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      // Play alert sound
      try {
        soundAlertManager.playWarningBellChime();
      } catch (e) {
        // ignore
      }

      // Auto dismiss after 10 seconds if no action taken
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [alert]);

  if (!alert || !visible) return null;

  const handleOpenWhatsApp = () => {
    if (!alert.phone) return;
    const cleanPhone = alert.phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
    const textMsg = encodeURIComponent(
      `مرحباً، إشعار من إدارة أكاديمية IFC للفنون القتالية:\n${alert.title}\n${alert.body}`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${textMsg}`, '_blank');
  };

  return (
    <div
      dir="rtl"
      className="fixed bottom-6 left-6 z-50 max-w-sm w-full bg-[#111b21] border border-[#25d366]/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      {/* Top green accent bar */}
      <div className="bg-[#25d366] px-4 py-1.5 flex items-center justify-between text-black text-xs font-bold">
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 fill-black" />
          <span>تنبيه مباشر (البرنامج متصل ونشط)</span>
        </div>
        <span className="text-[10px] opacity-80 font-mono">الآن</span>
      </div>

      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#25d366]/20 border border-[#25d366]/40 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4 text-[#25d366] animate-pulse" />
            </div>
            <div>
              <h4 className="text-white text-xs font-bold leading-snug">{alert.title}</h4>
              {alert.playerName && (
                <p className="text-[#25d366] text-[11px] font-medium">{alert.playerName}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            title="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-slate-300 text-xs leading-relaxed pr-10">{alert.body}</p>

        {alert.phone && (
          <div className="pt-2 flex items-center gap-2 pr-10">
            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 py-1.5 px-3 bg-[#25d366] hover:bg-[#20bd5a] text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>إرسال عبر واتساب</span>
            </button>
            <button
              onClick={() => {
                setVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="py-1.5 px-3 bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
