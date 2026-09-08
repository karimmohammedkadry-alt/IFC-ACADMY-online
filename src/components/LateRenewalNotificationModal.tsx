import React, { useState } from 'react';
import {
  X,
  Bell,
  Send,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Phone,
  Clock,
  Calendar,
  CreditCard,
  Flame,
} from 'lucide-react';
import { Player } from '../types';
import { notifyToast } from '../utils/toast';
import { IFCLogo } from './IFCLogo';
import {
  getDaysUntilExpiration,
  formatRemainingDaysArabic,
} from '../utils/dateUtils';

interface LateRenewalNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  expiringIn3DaysPlayers: Player[];
  overduePlayers: Player[];
  onQuickPay?: (player: Player) => void;
}

export const LateRenewalNotificationModal: React.FC<LateRenewalNotificationModalProps> = ({
  isOpen,
  onClose,
  expiringIn3DaysPlayers,
  overduePlayers,
  onQuickPay,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'expiring3Days' | 'overdue'>('expiring3Days');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentList =
    activeSubTab === 'expiring3Days' ? expiringIn3DaysPlayers : overduePlayers;

  const handleSendWhatsApp = (player: Player, isExpiringSoon: boolean) => {
    const days = getDaysUntilExpiration(player.subscriptionEndDate || player.subscriptionExpiry);
    const dayNotice =
      days === 0
        ? 'ينتهي اليوم'
        : days === 1
        ? 'ينتهي غداً'
        : days > 1
        ? `ينتهي خلال ${days} أيام`
        : 'قد انتهى بالفعل';

    const text = encodeURIComponent(
      `مرحباً ولي أمر اللاعب (${player.name})، تحية طيبة من أكاديمية IFC للكيك بوكسينغ 🥊 (international fight club)\n\nنود إحاطتكم بأن اشتراك الكيك بوكسينغ الخاص بعضوية رقم #${player.memberNumber} (${dayNotice}) بتاريخ ${player.subscriptionEndDate || player.subscriptionExpiry}.\n\nقيمة التجديد الشهري: ${player.monthlyFee} ج.م.\nطرق السداد المتاحة: (كاش بالخزينة / فودافون كاش / إنستاباي).\n\nيرجى المبادرة بالتجديد لضمان استمرار الحصص والتدريبات دون انقطاع.\nشاكرين تعاونكم الدائم معنا!`
    );
    window.open(`https://wa.me/2${player.parentPhone}?text=${text}`, '_blank');
  };

  const handleSendAll = () => {
    notifyToast('success', 'تم تجهيز رسائل التذكير', `تم تجهيز ${currentList.length} رسالة تذكير بنجاح.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-yellow-500/30 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative text-slate-200 animate-scaleUp">
        {/* Header with Logo */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <IFCLogo size="md" withGlow />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white tracking-wide">
                  مركز تنبيهات الاشتراكات
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-mono">
                  IFC ALERT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                متابعة الأعضاء قبل انتهاء الاشتراك بـ 3 أيام لتسريع التجديد
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs between 3-Day Expiry and Overdue */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/10 mb-4">
          <button
            type="button"
            onClick={() => setActiveSubTab('expiring3Days')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'expiring3Days'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-yellow-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>تنتهي خلال 3 أيام</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeSubTab === 'expiring3Days'
                  ? 'bg-black/30 text-slate-950'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {expiringIn3DaysPlayers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('overdue')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'overdue'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>اشتراكات منتهية ومتأخرة</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeSubTab === 'overdue'
                  ? 'bg-black/30 text-white'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {overduePlayers.length}
            </span>
          </button>
        </div>

        {/* Action Callout Bar */}
        {currentList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-yellow-500/10 border border-yellow-500/25 p-3 rounded-xl text-xs text-yellow-200 mb-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>
                يوجد <strong>{currentList.length}</strong> لاعب{' '}
                {activeSubTab === 'expiring3Days'
                  ? 'ستنتهي اشتراكاتهم خلال الأيام الـ 3 القادمة.'
                  : 'اشتراكاتهم منتهية ولم يتم سدادها بعد.'}
              </span>
            </div>
            <button
              onClick={handleSendAll}
              className="w-full sm:w-auto px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-yellow-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال تذكير للكل</span>
            </button>
          </div>
        )}

        {/* List of Players */}
        {currentList.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-slate-200">
              {activeSubTab === 'expiring3Days'
                ? 'لا توجد اشتراكات تنتهي خلال الـ 3 أيام القادمة!'
                : 'لا توجد أي اشتراكات متأخرة حالياً!'}
            </p>
            <p className="text-xs mt-1 text-slate-400">
              جميع الأعضاء المسجلين منتظمون في سداد اشتراكات أكاديمية IFC.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {currentList.map((player) => {
              const days = getDaysUntilExpiration(
                player.subscriptionEndDate || player.subscriptionExpiry
              );
              const remainingInfo = formatRemainingDaysArabic(days);

              return (
                <div
                  key={player.id}
                  className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl hover:border-yellow-500/40 backdrop-blur-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={player.avatarUrl}
                      alt={player.name}
                      className="w-11 h-11 rounded-full object-cover border-2 border-yellow-400/40 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>{player.name}</span>
                        <span className="text-[11px] font-mono text-yellow-400 font-normal">
                          #{player.memberNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${remainingInfo.badgeClass}`}
                        >
                          {remainingInfo.text}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                        <span>{player.team}</span>
                        <span>•</span>
                        <span className="text-slate-300">
                          نهاية الاشتراك:{' '}
                          <strong className="text-white font-mono">
                            {player.subscriptionEndDate || player.subscriptionExpiry}
                          </strong>
                        </span>
                        <span>•</span>
                        <span className="text-yellow-400 font-bold font-mono">
                          {player.monthlyFee} ج.م
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {onQuickPay && (
                      <button
                        onClick={() => {
                          onQuickPay(player);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-bold transition-colors cursor-pointer"
                        title="تسجيل سداد فوري وتجديد الاشتراك"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>تجديد وسداد</span>
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handleSendWhatsApp(player, activeSubTab === 'expiring3Days')
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold backdrop-blur-md transition-colors cursor-pointer"
                      title="إرسال رسالة تذكير واتساب لولي الأمر"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Bell className="w-3.5 h-3.5 text-yellow-400" />
            <span>نظام إشعارات IFC الدولي للكيك بوكسينغ</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
