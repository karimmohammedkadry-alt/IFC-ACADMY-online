import { Player } from '../types';

/**
 * Returns number of days until the player's subscription expires.
 * 0 = today, 1 = tomorrow, 2 = after 2 days, 3 = after 3 days.
 * Negative number = expired.
 */
export function getDaysUntilExpiration(endDateStr: string | undefined): number {
  if (!endDateStr) return -999;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDateStr);
  if (isNaN(end.getTime())) return -999;
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if a player's subscription expires within the next 3 days (0, 1, 2, or 3 days from now).
 */
export function isExpiringWithin3Days(player: Player): boolean {
  const days = getDaysUntilExpiration(player.subscriptionEndDate || player.subscriptionExpiry);
  return days >= 0 && days <= 3;
}

/**
 * Checks if a player's subscription expires within a week (0 to 7 days from now).
 */
export function isExpiringWithinWeek(player: Player): boolean {
  const days = getDaysUntilExpiration(player.subscriptionEndDate || player.subscriptionExpiry);
  return days >= 0 && days <= 7;
}

/**
 * Calculates end date by adding months to the given start date.
 */
export function calculateEndDateByMonths(startDateStr: string, months: number): string {
  if (!startDateStr) {
    startDateStr = new Date().toISOString().split('T')[0];
  }
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

/**
 * Generates the next sequential member number (e.g. 1001, 1002...).
 */
export function getNextMemberNumber(players: Player[]): number {
  if (!players || players.length === 0) return 1001;
  const maxNum = players.reduce((max, p) => {
    const num = Number(p.memberNumber);
    return !isNaN(num) && num > max ? num : max;
  }, 1000);
  return maxNum + 1;
}

/**
 * Checks if a player's subscription is already overdue/expired.
 */
export function isOverdueOrExpired(player: Player): boolean {
  const days = getDaysUntilExpiration(player.subscriptionEndDate || player.subscriptionExpiry);
  return days < 0 || player.status === 'متأخر' || player.status === 'منتهي';
}

/**
 * Returns a human-friendly Arabic text for remaining days.
 */
export function formatRemainingDaysArabic(days: number): {
  text: string;
  badgeClass: string;
  urgency: 'critical' | 'warning' | 'normal' | 'expired';
} {
  if (days < 0) {
    const absDays = Math.abs(days);
    return {
      text: absDays === 1 ? 'منتهي منذ يوم' : `منتهي منذ ${absDays} أيام`,
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      urgency: 'expired',
    };
  }
  if (days === 0) {
    return {
      text: 'ينتهي اليوم!',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse',
      urgency: 'critical',
    };
  }
  if (days === 1) {
    return {
      text: 'ينتهي غداً (باقي يوم واحد)',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      urgency: 'warning',
    };
  }
  if (days === 2) {
    return {
      text: 'باقي يومان (48 ساعة)',
      badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
      urgency: 'warning',
    };
  }
  if (days === 3) {
    return {
      text: 'باقي 3 أيام',
      badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
      urgency: 'warning',
    };
  }
  return {
    text: `باقي ${days} يوماً`,
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    urgency: 'normal',
  };
}

/** Full payment/audit timestamp for the UI: day, month, year, hour, minute, second. */
export function formatDateTimeArabic(value: string | Date | undefined): string {
  if (!value) return 'غير محدد';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export function dateOnlyLocal(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
