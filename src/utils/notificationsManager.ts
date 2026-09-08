import { AppNotification, Player } from '../types';

const STORAGE_KEY = 'ifc_notifications_hub_v3';
const TRASH_KEY = 'ifc_notifications_trash_v1';

export const getStoredNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse notifications:', e);
    return [];
  }
};

export const saveNotifications = (notifications: AppNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.error('Failed to save notifications:', e);
  }
};

export const getNotificationTrash = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse notification trash:', e);
    return [];
  }
};

export const saveNotificationTrash = (items: AppNotification[]) => {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(items.slice(0, 200)));
  } catch (e) {
    console.error('Failed to save notification trash:', e);
  }
};

export const loadNotifications = (): AppNotification[] => getStoredNotifications();

export const addNotification = (notif: AppNotification): AppNotification[] => {
  const current = getStoredNotifications();
  const updated = [notif, ...current.filter((n) => n.id !== notif.id)].slice(0, 200);
  saveNotifications(updated);
  return updated;
};

export const markAllNotificationsAsRead = (notifications: AppNotification[]): AppNotification[] => {
  const updated = notifications.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);
  return updated;
};

export const markNotificationAsRead = (id: string, notifications: AppNotification[]): AppNotification[] => {
  const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
  return updated;
};

export const clearAllNotifications = (): AppNotification[] => {
  saveNotifications([]);
  return [];
};

export const moveNotificationToTrash = (id: string, notifications: AppNotification[]): AppNotification[] => {
  const target = notifications.find((n) => n.id === id);
  if (target) {
    const trash = getNotificationTrash();
    saveNotificationTrash([target, ...trash.filter((n) => n.id !== id)]);
  }
  const updated = notifications.filter((n) => n.id !== id);
  saveNotifications(updated);
  return updated;
};

export const restoreNotificationFromTrash = (id: string): { active: AppNotification[]; trash: AppNotification[] } => {
  const trash = getNotificationTrash();
  const target = trash.find((n) => n.id === id);
  const remaining = trash.filter((n) => n.id !== id);
  const active = target ? addNotification({ ...target, read: true }) : getStoredNotifications();
  saveNotificationTrash(remaining);
  return { active, trash: remaining };
};

export const deleteNotificationPermanently = (id: string): AppNotification[] => {
  const remaining = getNotificationTrash().filter((n) => n.id !== id);
  saveNotificationTrash(remaining);
  return remaining;
};

export const createNotification = (
  type: AppNotification['type'],
  title: string,
  message: string,
  category: AppNotification['category'],
  meta?: AppNotification['meta']
): AppNotification => ({
  id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  type,
  title,
  message,
  timestamp: new Date().toISOString(),
  read: false,
  category,
  meta,
});

/** Dynamic subscription alerts: one week before expiry, one session left, and overdue. */
export const buildExpirationAlerts = (
  expiringSoonPlayers: Player[],
  overduePlayers: Player[],
  options: { expiryWarning?: boolean; expiredWarning?: boolean; oneSessionWarning?: boolean; expiryWarningDays?: number } = {}
): AppNotification[] => {
  const alerts: AppNotification[] = [];

  if (options.expiryWarning !== false) expiringSoonPlayers.forEach((player) => {
    const endDate = player.subscriptionEndDate || player.subscriptionExpiry || '';
    const days = getDaysUntilExpiration(endDate);
    const warningDays = Math.max(1, Math.min(30, Number(options.expiryWarningDays || 7)));
    if (days < 0 || days > warningDays) return;
    alerts.push({
      id: `exp-week-${player.id}-${endDate}`,
      type: 'subscription_expiring_soon',
      title: days === 7 ? 'تذكير: باقي أسبوع على التجديد' : days === 0 ? 'تنبيه: الاشتراك ينتهي اليوم' : 'تنبيه: اقترب موعد التجديد',
      message: days === 0
        ? `اشتراك اللاعب (${player.name}) ينتهي اليوم بتاريخ ${endDate}. يرجى التجديد.`
        : `اشتراك اللاعب (${player.name}) ينتهي بتاريخ ${endDate}، والمتبقي ${days} ${days === 1 ? 'يوم' : 'أيام'}.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'subscriptions',
      meta: { playerId: player.id, playerName: player.name, memberNumber: player.memberNumber, parentPhone: player.parentPhone, amount: player.monthlyFee, daysLeft: days },
    });
  });

  const sessionSeen = new Set<string>();
  if (options.oneSessionWarning !== false) [...expiringSoonPlayers, ...overduePlayers].forEach((player) => {
    const remaining = Math.max(0, Number(player.totalSessions || 8) - Number(player.attendedSessions || 0));
    if (remaining !== 1 || sessionSeen.has(player.id)) return;
    sessionSeen.add(player.id);
    const endDate = player.subscriptionEndDate || player.subscriptionExpiry || '';
    alerts.push({
      id: `session-left-${player.id}-${endDate}-${player.totalSessions}-${player.attendedSessions}`,
      type: 'subscription_one_session_left',
      title: 'تنبيه: متبقي حصة واحدة',
      message: `اللاعب (${player.name}) متبقي له حصة واحدة فقط ضمن اشتراكه الحالي.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'subscriptions',
      meta: { playerId: player.id, playerName: player.name, memberNumber: player.memberNumber, parentPhone: player.parentPhone, amount: player.monthlyFee, daysLeft: getDaysUntilExpiration(endDate) },
    });
  });

  const seen = new Set<string>();
  if (options.expiredWarning !== false) overduePlayers.forEach((player) => {
    const endDate = player.subscriptionEndDate || player.subscriptionExpiry || '';
    const id = `overdue-${player.id}-${endDate}`;
    if (seen.has(id)) return;
    seen.add(id);
    const days = getDaysUntilExpiration(endDate);
    alerts.push({
      id,
      type: 'subscription_overdue',
      title: 'تنبيه عاجل: اشتراك منتهي ولم يُجدد',
      message: `اشتراك اللاعب (${player.name}) منتهي ولم يتم تجديده. قيمة التجديد ${player.monthlyFee} ج.م.`,
      timestamp: new Date().toISOString(),
      read: false,
      category: 'subscriptions',
      meta: { playerId: player.id, playerName: player.name, memberNumber: player.memberNumber, parentPhone: player.parentPhone, amount: player.monthlyFee, daysLeft: days },
    });
  });

  return alerts;
};

function getDaysUntilExpiration(endDateStr: string | undefined): number {
  if (!endDateStr) return -999;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(endDateStr); if (isNaN(end.getTime())) return -999;
  end.setHours(0,0,0,0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}
