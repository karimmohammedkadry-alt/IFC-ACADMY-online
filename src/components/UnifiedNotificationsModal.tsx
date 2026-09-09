import React, { useEffect, useState } from 'react';
import {
  X,
  Bell,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Banknote,
  UserPlus,
  UserMinus,
  Edit,
  Award,
  Trash2,
  CheckCheck,
  Flame,
  ShieldCheck,
  UserX,
  ExternalLink,
  Search,
} from 'lucide-react';
import { AppNotification, Player, Coach } from '../types';
import { IFCLogo } from './IFCLogo';
import {
  getDaysUntilExpiration,
  formatRemainingDaysArabic,
} from '../utils/dateUtils';
import { playerMatchesSearch, normalizeSearchText } from '../utils/playerSearch';
import { getSubscriptionWhatsAppMessage } from '../utils/notificationsManager';

interface UnifiedNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead?: (id: string) => void;
  onClearAll: () => void;
  onDeleteNotification: (id: string) => void;
  notificationTrash?: AppNotification[];
  onRestoreFromTrash?: (id: string) => void;
  onDeleteFromTrash?: (id: string) => void;
  expiringInWeekPlayers: Player[];
  overduePlayers: Player[];
  onQuickPay?: (player: Player) => void;
  players: Player[];
  coaches: Coach[];
}

export const UnifiedNotificationsModal: React.FC<UnifiedNotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAll,
  onDeleteNotification,
  notificationTrash = [],
  onRestoreFromTrash,
  onDeleteFromTrash,
  expiringInWeekPlayers,
  overduePlayers,
  onQuickPay,
  players,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'subscriptions' | 'players' | 'coaches' | 'finance' | 'trash'
  >('all');

  useEffect(() => {
    if (isOpen) onMarkAllAsRead();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter((notif) => {
    let matchesTab = true;
    if (activeFilter === 'subscriptions') matchesTab = notif.category === 'subscriptions';
    else if (activeFilter === 'players') matchesTab = notif.category === 'players';
    else if (activeFilter === 'coaches') matchesTab = notif.category === 'coaches';
    else if (activeFilter === 'finance') matchesTab = notif.category === 'finance' || notif.type === 'subscription_renewed' || notif.type === 'salary_paid';
    else if (activeFilter === 'trash') matchesTab = false;
    if (!matchesTab) return false;
    const q = normalizeSearchText(searchQuery);
    if (!q) return true;
    const player = notif.meta?.playerId ? players.find((p) => p.id === notif.meta?.playerId) : undefined;
    return (player ? playerMatchesSearch(player, searchQuery) : false) ||
      normalizeSearchText(notif.title).includes(q) ||
      normalizeSearchText(notif.message).includes(q) ||
      normalizeSearchText(notif.meta?.playerName).includes(q) ||
      normalizeSearchText(notif.meta?.memberNumber).includes(q) ||
      normalizeSearchText(notif.meta?.parentPhone).includes(q);
  });

  const handleSendWhatsApp = (player: Player) => {
    const phone = (player.parentPhone || '').replace(/\D/g, '');
    if (!phone) return;
    const normalized = phone.startsWith('20') ? phone : `20${phone.replace(/^0+/, '')}`;
    const text = encodeURIComponent(getSubscriptionWhatsAppMessage(player));
    window.open(`https://wa.me/${normalized}?text=${text}`, '_blank');
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'player_added':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'player_updated':
        return <Edit className="w-4 h-4 text-sky-400" />;
      case 'player_deleted':
        return <UserMinus className="w-4 h-4 text-rose-400" />;
      case 'coach_added':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'coach_updated':
        return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      case 'coach_deleted':
        return <UserX className="w-4 h-4 text-rose-400" />;
      case 'subscription_renewed':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'subscription_expiring_soon':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'subscription_one_session_left':
        return <Clock className="w-4 h-4 text-orange-400" />;
      case 'subscription_overdue':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'salary_paid':
        return <Banknote className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-yellow-400" />;
    }
  };

  const formatNotificationTime = (iso: string) => {
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return 'الآن';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'الآن';
      if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays === 1) return 'أمس';
      if (diffDays < 7) return `منذ ${diffDays} أيام`;

      return date.toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'مؤخراً';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-yellow-500/30 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative text-slate-200 animate-scaleUp max-h-[92vh] flex flex-col">
        {/* Header with Brand and Global Actions */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <IFCLogo size="md" withGlow />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white tracking-wide">
                  مركز الإشعارات والتنبيهات الموحد
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  {unreadCount} غير مقروء
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تنبيهات الاشتراكات، وسجل عمليات اللاعبين والمدربين والرواتب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs / Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-yellow-500 text-slate-950 shadow-md shadow-yellow-500/20'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10'
            }`}
          >
            الكل ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('subscriptions')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'subscriptions'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>تنبيهات التجديد</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
              {expiringInWeekPlayers.length + overduePlayers.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('players')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'players'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10'
            }`}
          >
            عمليات اللاعبين
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('coaches')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'coaches'
                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10'
            }`}
          >
            المدربين
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('finance')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'finance'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10'
            }`}
          >
            المالية والرواتب
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('trash')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'trash'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>سلة المهملات</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">{notificationTrash.length}</span>
          </button>

          {/* Clean / Clear Actions */}
          <div className="mr-auto flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="مسح كافة الإشعارات المسجلة"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">مسح السجل</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Alert Banner if there are subscriptions expiring or overdue */}
        {(expiringInWeekPlayers.length > 0 || overduePlayers.length > 0) &&
          (activeFilter === 'all' || activeFilter === 'subscriptions') && (
            <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-rose-500/15 border border-yellow-500/30 text-xs text-yellow-200 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span>
                  يوجد{' '}
                  <strong className="text-yellow-400 font-bold">
                    {expiringInWeekPlayers.length}
                  </strong>{' '}
                  لاعب تنتهي اشتراكاتهم خلال أسبوع، و{' '}
                  <strong className="text-rose-400 font-bold">
                    {overduePlayers.length}
                  </strong>{' '}
                  لاعب اشتراكاتهم منتهية.
                </span>
              </div>
            </div>
          )}

        {/* Notifications / Trash Scrollable List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[58vh]">
          {activeFilter === 'trash' ? (
            notificationTrash.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Trash2 className="w-12 h-12 text-slate-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-slate-200 text-sm">سلة المهملات فارغة</p>
                <p className="text-xs mt-1 text-slate-400">اللاعب المحذوف يمكن استعادته من هنا.</p>
              </div>
            ) : (
              notificationTrash.map((notif) => (
                <div key={notif.id} className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{notif.title}</h4>
                      <p className="text-xs text-slate-300 mt-1">{notif.message}</p>
                      {notif.meta?.memberNumber && (
                        <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300">#{notif.meta.memberNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {notif.meta?.deletedPlayer && onRestoreFromTrash && (
                      <button type="button" onClick={() => onRestoreFromTrash(notif.id)} className="px-2.5 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold">استعادة اللاعب</button>
                    )}
                    {onDeleteFromTrash && (
                      <button type="button" onClick={() => onDeleteFromTrash(notif.id)} className="p-2 text-slate-500 hover:text-rose-400" title="حذف نهائي">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-slate-200 text-sm">لا توجد إشعارات مسجلة في هذا القسم!</p>
              <p className="text-xs mt-1 text-slate-400 max-w-xs mx-auto">سيتم إدراج أي عمليات إضافة، تعديل، حذف، تجديدات اشتراك أو صرف رواتب هنا بشكل فوري وتلقائي.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const matchedPlayer = notif.meta?.playerId
                ? players.find((p) => p.id === notif.meta?.playerId)
                : undefined;

              const isExpiringOrOverdue =
                notif.type === 'subscription_expiring_soon' ||
                notif.type === 'subscription_one_session_left' ||
                notif.type === 'subscription_overdue';

              return (
                <div
                  key={notif.id}
                  onClick={() => onMarkAsRead && onMarkAsRead(notif.id)}
                  className={`p-3 rounded-xl border backdrop-blur-md transition-all flex flex-col gap-2 cursor-pointer ${
                    !notif.read ? 'ring-1 ring-blue-500/40 shadow-sm shadow-blue-500/10' : 'opacity-90'
                  } ${
                    isExpiringOrOverdue
                      ? 'bg-amber-500/[0.06] border-amber-500/30 hover:border-amber-500/50'
                      : notif.type === 'salary_paid'
                      ? 'bg-emerald-500/[0.05] border-emerald-500/25 hover:border-emerald-500/40'
                      : notif.type === 'subscription_renewed'
                      ? 'bg-yellow-500/[0.05] border-yellow-500/25 hover:border-yellow-500/40'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 shrink-0 mt-0.5 relative">
                        {getNotificationIcon(notif.type)}
                        {!notif.read && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-slate-900 animate-pulse" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-100">{notif.title}</h4>
                          {!notif.read && <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">جديد</span>}
                          {notif.meta?.memberNumber && <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">#{notif.meta.memberNumber}</span>}
                          {notif.meta?.amount && <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">{notif.meta.amount} ج.م</span>}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono">{formatNotificationTime(notif.timestamp)}</span>
                      {!notif.read && onMarkAsRead && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onMarkAsRead(notif.id); }} className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer" title="تحديد كمقروء">
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onDeleteNotification(notif.id); }} className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer" title="نقل إلى سلة المهملات">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpiringOrOverdue && (
                    <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06] mt-1 flex-wrap">
                      {matchedPlayer && onQuickPay && (
                        <button type="button" onClick={() => { onQuickPay(matchedPlayer); onClose(); }} className="px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          <span>تجديد الاشتراك</span>
                        </button>
                      )}
                      {matchedPlayer && matchedPlayer.parentPhone && (
                        <button type="button" onClick={() => handleSendWhatsApp(matchedPlayer)} className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          <span>إرسال واتساب</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-3 mt-3 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>أكاديمية IFC - نظام الإشعارات المتكامل</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-semibold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
