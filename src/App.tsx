import { useState, useEffect } from 'react';
import {
  PageTab,
  Player,
  PaymentRecord,
  ExpenseRecord,
  Coach,
  AcademySettings,
  AttendanceStatus,
  PaymentMethod,
  MonthlyArchiveRecord,
  SessionRecord,
} from './types';
import { Navbar } from './components/Navbar';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { InvoiceModal } from './components/InvoiceModal';
import { AddPlayerModal } from './components/AddPlayerModal';
import { AddPaymentModal } from './components/AddPaymentModal';
import { AddExpenseModal } from './components/AddExpenseModal';
import { PaySalaryModal } from './components/PaySalaryModal';
import { NewFinancialActionModal } from './components/NewFinancialActionModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { CoachProfileModal } from './components/CoachProfileModal';
import { UnifiedNotificationsModal } from './components/UnifiedNotificationsModal';
import { ExportPdfModal, ExportPdfMode } from './components/ExportPdfModal';
import { MonthlyArchiveModal } from './components/MonthlyArchiveModal';
import { isExpiringWithin3Days, isExpiringWithinWeek, isOverdueOrExpired } from './utils/dateUtils';
import { logAudit } from './utils/auditLogger';
import {
  loadNotifications,
  addNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  clearAllNotifications,
  moveNotificationToTrash,
  restoreNotificationFromTrash,
  deleteNotificationPermanently,
  getNotificationTrash,
  saveNotificationTrash,
  createNotification,
  buildExpirationAlerts,
  saveNotifications,
} from './utils/notificationsManager';
import { soundAlertManager } from './utils/soundAlert';
import { sendDesktopNotification } from './utils/desktopNotifier';
import { AppNotification } from './types';
import { generateNextMemberNumber } from './utils/memberNumberUtils';

import {
  fetchPlayers,
  createPlayerApi,
  bulkImportPlayersApi,
  updatePlayerApi,
  deletePlayerApi,
  updateSessionAttendanceApi,
  fetchPayments,
  createPaymentApi,
  deletePaymentApi,
  fetchExpenses,
  createExpenseApi,
  deleteExpenseApi,
  fetchCoaches,
  createCoachApi,
  bulkImportCoachesApi,
  updateCoachApi,
  deleteCoachApi,
  fetchSettings,
  updateSettingsApi,
  resetAcademyDataApi,
  checkDatabaseStatus,
  fetchMonthlyArchives,
  createMonthlyArchiveApi,
  loginAdmin,
  validateAdminSession,
  refreshAdminSession,
  logoutAdmin,
  fetchNotifications,
  fetchNotificationTrash,
  upsertNotificationApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  moveNotificationToTrashApi,
  restoreNotificationApi,
  deleteNotificationPermanentlyApi,
  clearNotificationsApi,
} from './services/api';

import { syncDatabaseSnapshot, scheduleDatabaseSnapshot } from './services/localDb';
import { syncCloud, flushPendingCloudChanges } from './services/supabaseCloud';

import { DashboardView } from './views/DashboardView';
import { PlayersView } from './views/PlayersView';
import { AttendanceView } from './views/AttendanceView';
import { PaymentsView } from './views/PaymentsView';
import { FinanceView } from './views/FinanceView';
import { ReportsView } from './views/ReportsView';
import { CoachesView } from './views/CoachesView';
import { SettingsView } from './views/SettingsView';
import { RefreshCw, Database, AlertTriangle } from 'lucide-react';
import { SystemToast, SystemToastType } from './components/SystemToast';
import * as XLSX from 'xlsx';

const AUTH_SESSION_KEY = 'ifc_auth_session_v2';
const AUTH_TOKEN_KEY = 'ifc_admin_session_token';

const normalizeImportHeader = (value: any): string => String(value ?? '').replace(/\uFEFF/g, '').trim().toLowerCase().replace(/[\s_\-()\[\]{}:]/g, '');

const importField = (item: any, aliases: string[]): any => {
  const entries = Object.entries(item || {});
  const wanted = aliases.map(normalizeImportHeader);
  const hit = entries.find(([key]) => wanted.includes(normalizeImportHeader(key)));
  return hit ? hit[1] : undefined;
};

const toText = (value: any): string => value === undefined || value === null ? '' : String(value).trim();
const toNationalId = (value: any): string => {
  const text = normalizeArabicDigits(value);
  if (!text) return '';
  const digits = text.replace(/\.0+$/, '').replace(/\D/g, '');
  return digits.length ? digits.padStart(14, '0').slice(-14) : '';
};

const toDateString = (value: any, fallback = ''): string => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().split('T')[0];
  if (typeof value === 'number' && isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? fallback : date.toISOString().split('T')[0];
  }
  const text = toText(value);
  const iso = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? fallback : parsed.toISOString().split('T')[0];
};

const normalizeArabicDigits = (value: any): string => String(value ?? '')
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/٫/g, '.')
  .replace(/٬/g, ',');

const toNumber = (value: any, fallback = 0): number => {
  const normalized = normalizeArabicDigits(value).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
};

const IMPORT_CONCURRENCY = 8;

async function runImportTasks<T>(tasks: Array<() => Promise<T>>, concurrency = IMPORT_CONCURRENCY): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      try { results[index] = { status: 'fulfilled', value: await tasks[index]() }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

const DEFAULT_ADMIN_USER = {
  name: 'المدير العام (Admin)',
  role: 'مدير أكاديمية IFC',
  avatar:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
};

export default function App() {
  // Loading -> Login -> System Home
  const [currentTab, setCurrentTab] = useState<PageTab>('loading');

  // Privacy: Eye toggle for sensitive money amounts
  const [isAmountsVisible, setIsAmountsVisible] = useState(true);
  const toggleAmountsVisible = () => setIsAmountsVisible((prev) => !prev);

  // Admin user
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    role: string;
    avatar: string;
    email?: string;
    username: string;
  }>(DEFAULT_ADMIN_USER);

  // Local SQLite database state
  const [players, setPlayers] = useState<Player[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [settings, setSettings] = useState<AcademySettings>({
    academyName: 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ',
    logoText: 'IFC ACADEMY',
    phone: '',
    email: '',
    address: '',
    currency: 'ج.م',
    currentSeason: '',
    whatsappNotificationsEnabled: true,
    smsAlertsEnabled: false,
  });

  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Auto-lock the admin session after local inactivity. The value is controlled from Settings.
  useEffect(() => {
    let timer: number | undefined;
    let lastActivity = Date.now();
    const readMinutes = () => { try { return Math.max(5, Math.min(240, Number(JSON.parse(localStorage.getItem('ifc_security_prefs') || '{}').autoLockMinutes || 30))); } catch { return 30; } };
    const lockIfIdle = () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token || currentTab === 'login' || currentTab === 'loading') return;
      if (Date.now() - lastActivity >= readMinutes() * 60000) { void handleLogout(); return; }
      timer = window.setTimeout(lockIfIdle, 30000);
    };
    const touch = () => { lastActivity = Date.now(); };
    const events = ['mousemove','mousedown','keydown','touchstart','scroll'];
    events.forEach(e => window.addEventListener(e, touch, { passive: true }));
    timer = window.setTimeout(lockIfIdle, 30000);
    return () => { if (timer) window.clearTimeout(timer); events.forEach(e => window.removeEventListener(e, touch)); };
  }, [currentTab]);

  // Load local data after a cloud sync when online. Local storage is the offline cache.
  const loadDatabaseData = async () => {
    try {
      setIsLoadingDb(true);
      // Supabase is authoritative whenever online; local storage remains the offline cache.
      if (navigator.onLine) { try { await syncCloud(); } catch (e) { console.warn('Cloud sync before read failed:', e); } }
      setDbError(null);

      const [statusRes, playersRes, paymentsRes, expensesRes, coachesRes, settingsRes, archivesRes] =
        await Promise.allSettled([
          checkDatabaseStatus(),
          fetchPlayers(),
          fetchPayments(),
          fetchExpenses(),
          fetchCoaches(),
          fetchSettings(),
          fetchMonthlyArchives(),
        ]);

      const isConnected =
        statusRes.status === 'fulfilled' ? statusRes.value.connected : false;
      setIsDbConnected(isConnected);

      if (playersRes.status === 'fulfilled' && Array.isArray(playersRes.value)) {
        setPlayers(playersRes.value);
      }
      if (paymentsRes.status === 'fulfilled' && Array.isArray(paymentsRes.value)) {
        setPayments(paymentsRes.value);
      }
      if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value)) {
        setExpenses(expensesRes.value);
      }
      if (coachesRes.status === 'fulfilled' && Array.isArray(coachesRes.value)) {
        setCoaches(coachesRes.value);
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        setSettings(settingsRes.value);
      }
      if (archivesRes.status === 'fulfilled' && Array.isArray(archivesRes.value)) {
        setMonthlyArchives(archivesRes.value);
      }
    } catch (err: any) {
      console.error('Error fetching data from backend:', err);
      setIsDbConnected(false);
      setDbError(err.message || 'فشل الاتصال بقاعدة البيانات');
    } finally {
      setIsLoadingDb(false);
      scheduleDatabaseSnapshot();
    }
  };

  useEffect(() => {
    // Local database is the offline source of truth; Supabase is synchronized first whenever online.
    // A small automatic snapshot keeps a human-readable/inspectable copy in the IFC Academy Data folder.
    const snapshotTimer = window.setInterval(() => {
      if (localStorage.getItem(AUTH_TOKEN_KEY)) void syncDatabaseSnapshot();
    }, 10000);
    const syncTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && localStorage.getItem(AUTH_TOKEN_KEY)) void loadDatabaseData();
    }, 15000);
    const handleOnline = () => { if (localStorage.getItem(AUTH_TOKEN_KEY)) { void loadDatabaseData(); void flushPendingCloudChanges(); } };
    const cloudSyncTimer = window.setInterval(() => { if (document.visibilityState === 'visible' && localStorage.getItem(AUTH_TOKEN_KEY)) void flushPendingCloudChanges(); }, 30000);
    const handleAuthExpired = () => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem('ifc_admin_refresh_token');
      localStorage.removeItem(AUTH_SESSION_KEY);
      setCurrentUser(DEFAULT_ADMIN_USER);
      setCurrentTab('login');
      showToast('error', 'انتهت جلسة الدخول', 'انتهت جلسة الدخول المحلية. يرجى تسجيل الدخول مرة أخرى.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('ifc-auth-expired', handleAuthExpired);

    let cancelled = false;
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const refreshToken = localStorage.getItem('ifc_admin_refresh_token');
        const cachedSession = (() => { try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); } catch { return null; } })();
        if (!token) return;
        const session = await validateAdminSession(token);
        if (cancelled) return;
        if (session?.authenticated) {
          const user = session.user || cachedSession?.user || DEFAULT_ADMIN_USER;
          setCurrentUser({ ...DEFAULT_ADMIN_USER, ...user });
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ authenticated: true, user }));
          setCurrentTab('home');
          await flushPendingCloudChanges();
          await loadDatabaseData();
          return;
        }
        if (refreshToken && !session?.offline) {
          try {
            const refreshed = await refreshAdminSession(refreshToken);
            localStorage.setItem(AUTH_TOKEN_KEY, refreshed.access_token);
            localStorage.setItem('ifc_admin_refresh_token', refreshed.refresh_token);
            const user = refreshed.user || cachedSession?.user || DEFAULT_ADMIN_USER;
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ authenticated: true, user, expiresAt: refreshed.expires_at }));
            setCurrentUser({ ...DEFAULT_ADMIN_USER, ...user });
            setCurrentTab('home');
            await loadDatabaseData();
            return;
          } catch (refreshError) {
            console.warn('Local session refresh failed:', refreshError);
          }
        }
        if (session?.offline && cachedSession?.authenticated) {
          setCurrentUser({ ...DEFAULT_ADMIN_USER, ...(cachedSession.user || {}) });
          setCurrentTab('home');
          await loadDatabaseData();
          return;
        }
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('ifc_admin_refresh_token');
        localStorage.removeItem(AUTH_SESSION_KEY);
      } catch (error) {
        console.warn('Unable to restore admin session:', error);
        const cachedSession = (() => { try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); } catch { return null; } })();
        if (cachedSession?.authenticated) {
          setCurrentUser({ ...DEFAULT_ADMIN_USER, ...(cachedSession.user || {}) });
          setCurrentTab('home');
          await loadDatabaseData();
        }
      }
    };
    restoreSession();

    return () => { cancelled = true; window.clearInterval(syncTimer); window.clearInterval(snapshotTimer); window.removeEventListener('online', handleOnline); window.removeEventListener('ifc-auth-expired', handleAuthExpired); };
  }, []);

  // Modals state
  const [activeInvoice, setActiveInvoice] = useState<PaymentRecord | null>(null);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState<Player | null>(null);
  const [selectedCoachForProfile, setSelectedCoachForProfile] = useState<Coach | null>(null);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState<Player | null>(null);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isPaySalaryModalOpen, setIsPaySalaryModalOpen] = useState(false);
  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [selectedCoachIdForSalary, setSelectedCoachIdForSalary] = useState<string | undefined>();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationTrash, setNotificationTrash] = useState<AppNotification[]>([]);
  const [systemToast, setSystemToast] = useState<{ open: boolean; type: SystemToastType; title: string; message?: string }>({ open: false, type: 'success', title: '' });

  useEffect(() => {
    const loadNotificationStore = async () => {
      try {
        const [active, trash] = await Promise.all([fetchNotifications(), fetchNotificationTrash()]);
        setNotifications(active);
        setNotificationTrash(trash);
      } catch {
        setNotifications(loadNotifications());
        setNotificationTrash(getNotificationTrash());
      }
    };
    void loadNotificationStore();
  }, []);

  const pushNotification = (notif: AppNotification) => {
    void upsertNotificationApi(notif).catch(console.error);
    setNotifications((prev) => addNotification(notif));
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.title) showToast(detail.type === 'error' ? 'error' : 'success', detail.title, detail.message);
    };
    window.addEventListener('ifc-toast', handler);
    return () => window.removeEventListener('ifc-toast', handler);
  }, []);

  const handleMarkAllNotificationsAsRead = () => {
    void markAllNotificationsReadApi().catch(console.error);
    setNotifications((prev) => markAllNotificationsAsRead(prev));
  };

  const handleMarkNotificationAsRead = (id: string) => {
    void markNotificationReadApi(id).catch(console.error);
    setNotifications((prev) => markNotificationAsRead(id, prev));
  };

  const handleClearAllNotifications = () => {
    void clearNotificationsApi().catch(console.error);
    setNotifications(clearAllNotifications());
  };

  const handleDeleteNotification = (id: string) => {
    void moveNotificationToTrashApi(id).catch(console.error);
    setNotifications((prev) => {
      const next = moveNotificationToTrash(id, prev);
      setNotificationTrash(getNotificationTrash());
      return next;
    });
  };

  const handleRestoreNotification = async (id: string) => {
    const item = notificationTrash.find((n) => n.id === id);
    if (item?.meta?.deletedPlayer) {
      try {
        const restored = await createPlayerApi(item.meta.deletedPlayer);
        setPlayers((prev) => [restored, ...prev.filter((p) => p.id !== restored.id)]);
        showToast('success', 'تمت استعادة اللاعب', `تمت استعادة ${restored.name} من سلة المهملات.`);
      } catch (e) {
        showToast('error', 'تعذر استعادة اللاعب', e instanceof Error ? e.message : 'حدث خطأ أثناء الاستعادة.');
        return;
      }
    }
    void restoreNotificationApi(id).catch(console.error);
    const result = restoreNotificationFromTrash(id);
    setNotifications(result.active);
    setNotificationTrash(result.trash);
  };

  const handleDeleteTrashPermanently = (id: string) => {
    void deleteNotificationPermanentlyApi(id).catch(console.error);
    setNotificationTrash(deleteNotificationPermanently(id));
  };


  const showToast = (type: SystemToastType, title: string, message?: string) => {
    setSystemToast({ open: true, type, title, message });
    window.setTimeout(() => setSystemToast((prev) => ({ ...prev, open: false })), 3500);
  };

  // PDF Export & Archival Modal State
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
  const [pdfExportMode, setPdfExportMode] = useState<ExportPdfMode>('player_statement');
  const [pdfSelectedPlayerId, setPdfSelectedPlayerId] = useState<string | undefined>();

  const handleOpenExportPlayerStatement = (playerId?: string) => {
    setPdfExportMode('player_statement');
    setPdfSelectedPlayerId(playerId || players[0]?.id);
    setIsExportPdfModalOpen(true);
  };

  const handleOpenExportExpensesPdf = () => {
    setPdfExportMode('expenses_report');
    setIsExportPdfModalOpen(true);
  };

  // Monthly Archive Modal State & Persistence
  const [isMonthlyArchiveModalOpen, setIsMonthlyArchiveModalOpen] = useState(false);
  const [monthlyArchives, setMonthlyArchives] = useState<MonthlyArchiveRecord[]>([]);

  // Apply dynamic theme colors to root CSS variables and document body
  useEffect(() => {
    const root = document.documentElement;
    const primary = settings.primaryColor || '#2563eb';
    const bg = settings.backgroundColor || '#020617';
    const nav = settings.navbarColor || '#0b1120';

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-bg', bg);
    root.style.setProperty('--color-navbar', nav);

    document.body.style.backgroundColor = bg;
  }, [settings.primaryColor, settings.backgroundColor, settings.navbarColor]);

  // Unified notification sources: behavior is controlled by Settings > Subscriptions.
  const academyPrefs = (() => {
    try { return JSON.parse(localStorage.getItem('ifc_academy_prefs') || '{}'); } catch { return {}; }
  })();
  const expiryWarningDays = Math.max(1, Math.min(30, Number(academyPrefs.expiryWarningDays || 7)));
  const isExpiringByPreference = (player: Player) => {
    const end = player.subscriptionEndDate || player.subscriptionExpiry || '';
    if (!end || academyPrefs.expiryWarning === false) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(end); d.setHours(0,0,0,0);
    const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= expiryWarningDays;
  };
  const expiringInWeekPlayers = players.filter(isExpiringByPreference);
  const expiringIn3DaysPlayers = players.filter(isExpiringWithin3Days);
  const overduePlayers = academyPrefs.expiredWarning === false ? [] : players.filter(isOverdueOrExpired);
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const totalNotificationsCount = unreadNotificationsCount;

  useEffect(() => {
    const generated = buildExpirationAlerts(expiringInWeekPlayers, overduePlayers, { expiryWarning: academyPrefs.expiryWarning !== false, expiredWarning: academyPrefs.expiredWarning !== false, oneSessionWarning: academyPrefs.oneSessionWarning !== false, expiryWarningDays });
    setNotifications((prev) => {
      const dynamicTypes = new Set<AppNotification['type']>([
        'subscription_expiring_soon',
        'subscription_one_session_left',
        'subscription_overdue',
      ]);
      const generatedById = new Map(generated.map((n) => [n.id, n]));
      const nextMap = new Map<string, AppNotification>();

      // Keep normal notifications, and only keep dynamic subscription alerts that are still valid today.
      for (const item of prev) {
        if (!dynamicTypes.has(item.type) || generatedById.has(item.id)) {
          nextMap.set(item.id, item);
        }
      }
      for (const alert of generated) {
        if (!nextMap.has(alert.id)) nextMap.set(alert.id, alert);
      }

      const next = Array.from(nextMap.values())
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 200);
      saveNotifications(next);
      generated.forEach(alert => { void upsertNotificationApi(alert).catch(console.error); });
      return next;
    });
  }, [players, expiryWarningDays, academyPrefs.expiryWarning, academyPrefs.expiredWarning, academyPrefs.oneSessionWarning]);

  // Attendance update for single player on a specific date
  const handleUpdatePlayerAttendance = async (
    playerId: string,
    status: AttendanceStatus,
    date: string
  ) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    let targetSession = player.sessions.find((s) => s.date === date);
    const sessionId = targetSession ? targetSession.id : `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;

        const existingSessionIndex = p.sessions.findIndex((s) => s.date === date);
        let newSessions = [...p.sessions];

        if (existingSessionIndex >= 0) {
          newSessions[existingSessionIndex] = {
            ...newSessions[existingSessionIndex],
            status,
          };
        } else {
          newSessions.push({
            id: sessionId,
            sessionNumber: newSessions.length + 1,
            date,
            dayName: new Date(date).toLocaleDateString('ar-EG', { weekday: 'long' }),
            time: '5:00 م - 6:30 م',
            status,
          });
        }

        const attended = newSessions.filter((s) => s.status === 'حاضر').length;
        const absent = newSessions.filter((s) => s.status === 'غائب').length;
        const total = newSessions.length;
        const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

        return {
          ...p,
          sessions: newSessions,
          attendedSessions: attended,
          absentSessions: absent,
          totalSessions: total,
          attendanceRate: rate,
        };
      })
    );

    try {
      await updateSessionAttendanceApi(playerId, sessionId, status, undefined, date);
      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `تسجيل حضور للاعب ${player.name}: ${status}`,
        category: 'حضور وغياب',
        details: `التاريخ: ${date}`,
      });
    } catch (err) {
      console.error('Failed to persist attendance:', err);
      showToast('error', 'تعذر حفظ الحضور', err instanceof Error ? err.message : 'تعذر حفظ تسجيل الحضور في قاعدة البيانات.');
      void loadDatabaseData();
    }
  };

  // Mark all players in a group as present for a date
  const handleMarkAllPresent = async (group: string, date: string) => {
    const targetPlayers = players.filter((p) => group === 'جميع المجموعات' || p.team === group);
    const errors: string[] = [];
    for (const player of targetPlayers) {
      const existing = player.sessions.find((s) => s.date === date);
      const sId = existing ? existing.id : `sess-${Date.now()}-${player.id}`;
      try {
        await updateSessionAttendanceApi(player.id, sId, 'حاضر', undefined, date);
      } catch (err) {
        errors.push(`${player.name}: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
      }
    }
    await loadDatabaseData();
    if (errors.length) {
      showToast('error', 'تم الحضور مع وجود أخطاء', `نجح ${targetPlayers.length - errors.length} من ${targetPlayers.length} لاعب، وفشل ${errors.length}.`);
      console.warn('Bulk attendance errors:', errors);
      return;
    }
    logAudit({
      userId: 'admin', userName: currentUser.name,
      action: `تحضير جماعي لمجموعة: ${group}`, category: 'حضور وغياب',
      details: `التاريخ: ${date} - إجمالي اللاعبين: ${targetPlayers.length}`,
    });
  };

  // Add or Edit player in local SQLite + auto-add to financial records
  const handleSavePlayer = async (playerData: Partial<Player>): Promise<boolean> => {
    try {
      if (playerData.id) {
        await updatePlayerApi(playerData.id, playerData);
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerData.id ? ({ ...p, ...playerData } as Player) : p))
        );
        logAudit({
          userId: 'admin',
          userName: currentUser.name,
          action: `تعديل بيانات اللاعب: ${playerData.name}`,
          category: 'لاعبين',
          details: `المجموعة: ${playerData.team}`,
        });
        const notif = createNotification(
          'player_updated',
          'تم تعديل بيانات لاعب',
          `تم تحديث بيانات اللاعب (${playerData.name}) بنجاح`,
          'players',
          { playerId: playerData.id, playerName: playerData.name }
        );
        pushNotification(notif);
        showToast('success', 'تم تعديل بيانات اللاعب', `تم تحديث بيانات ${playerData.name} بنجاح.`);
        soundAlertManager.playSuccessTone();
        return true;
      } else {
        const isStillActive =
          playerData.subscriptionEndDate &&
          new Date(playerData.subscriptionEndDate) >= new Date();

        const newPlayer: Player = {
          id: '',
          memberNumber: playerData.memberNumber ? String(playerData.memberNumber) : '',
          nationalId: playerData.nationalId || '',
          paymentMethod: playerData.paymentMethod || 'كاش',
          name: playerData.name || 'لاعب جديد',
          avatarUrl:
            playerData.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          team: playerData.team || 'شباب',
          sport: 'كيك بوكسينغ',
          subscriptionStartDate:
            playerData.subscriptionStartDate || new Date().toISOString().split('T')[0],
          subscriptionEndDate:
            playerData.subscriptionEndDate ||
            new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          subscriptionExpiry:
            playerData.subscriptionEndDate ||
            new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          monthlyFee: playerData.monthlyFee || 0,
          subscriptionPlan: playerData.subscriptionPlan || 'اشتراك شهري',
          status: isStillActive ? 'نشط' : 'متأخر',
          totalSessions: playerData.totalSessions ?? Math.max(1, Number(academyPrefs.monthlySessions || 8)),
          attendedSessions: 0,
          absentSessions: 0,
          attendanceRate: 0,
          phone: playerData.phone || '',
          parentPhone: playerData.parentPhone || '',
          joinDate: playerData.subscriptionStartDate || new Date().toISOString().split('T')[0],
          sessions: [],
        };

        const created = await createPlayerApi(newPlayer);
        setPlayers((prev) => [created, ...prev]);

        // Auto-register payment record if fee > 0
        if (created.monthlyFee && created.monthlyFee > 0) {
          const autoPayment: PaymentRecord = {
            id: `pay-auto-${Date.now()}`,
            invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
            playerId: created.id,
            playerName: created.name,
            memberNumber: created.memberNumber,
            team: created.team,
            amount: created.monthlyFee,
            method: (playerData.paymentMethod as PaymentMethod) || 'كاش',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            periodMonth: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
            collectedBy: currentUser.name,
            status: 'مدفوع',
            notes: 'سداد اشتراك انضمام جديد تلقائي',
          };
          try {
            const createdPay = await createPaymentApi(autoPayment);
            setPayments((prev) => [createdPay, ...prev]);
          } catch (e) {
            try { await deletePlayerApi(created.id); } catch (rollbackError) { console.error('Player rollback failed after payment failure:', rollbackError); }
            throw new Error(`تم إنشاء اللاعب لكن تعذر حفظ دفعة الاشتراك، لذلك تم التراجع عن إنشاء اللاعب: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`);
          }
        }

        logAudit({
          userId: 'admin',
          userName: currentUser.name,
          action: `إضافة لاعب جديد: ${created.name}`,
          category: 'لاعبين',
          details: `المجموعة: ${created.team} - الاشتراك: ${created.monthlyFee} ج.م`,
        });

        const notif = createNotification(
          'player_added',
          'تمت إضافة لاعب جديد',
          `تم تسجيل اللاعب (${created.name}) بنجاح برقم عضوية #${created.memberNumber}`,
          'players',
          { playerId: created.id, playerName: created.name, memberNumber: created.memberNumber }
        );
        pushNotification(notif);
        showToast('success', 'تمت إضافة اللاعب بنجاح', `تم تسجيل ${created.name} برقم العضوية ${created.memberNumber}`);
        soundAlertManager.playSuccessTone();
        return true;
      }
    } catch (err) {
      console.error('Failed to save player to database:', err);
      showToast('error', 'تعذر إضافة اللاعب', err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ في قاعدة البيانات.');
      return false;
    }
    // Keep the modal open when persistence fails so the user can correct/retry.
  };

  // Delete player from local SQLite
  const handleDeletePlayer = async (playerId: string) => {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا اللاعب من سجلات الأكاديمية؟')) {
      try {
        const deleted = players.find((p) => p.id === playerId);
        await deletePlayerApi(playerId);
        setPlayers((prev) => prev.filter((p) => p.id !== playerId));
        if (deleted) {
          logAudit({
            userId: 'admin',
            userName: currentUser.name,
            action: `حذف لاعب: ${deleted.name}`,
            category: 'لاعبين',
            details: `رقم العضوية: ${deleted.memberNumber}`,
          });

          const notif = createNotification(
            'player_deleted',
            'تم حذف لاعب - موجود في سلة المهملات',
            `تم حذف اللاعب (${deleted.name}) من سجلات الأكاديمية. يمكنك استعادته من سلة المهملات.`,
            'players',
            { playerId: deleted.id, playerName: deleted.name, memberNumber: deleted.memberNumber, deletedPlayer: deleted }
          );
          // Deleted-player records go directly to the Messages Trash so they do not pollute the active feed.
          const trash = getNotificationTrash();
          saveNotificationTrash([notif, ...trash.filter((n) => n.id !== notif.id)]);
          void upsertNotificationApi(notif, true).catch(console.error);
          setNotificationTrash(getNotificationTrash());
          soundAlertManager.playAlertTone();
        }
      } catch (err) {
        console.error('Failed to delete player from database:', err);
        showToast('error', 'تعذر حذف اللاعب', err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف.');
      }
    }
  };

  // Save regular subscription payment in local SQLite
  const handleSavePayment = async (payment: PaymentRecord, renewalInfo?: { playerId: string; durationMonths: number; newEndDate: string }) => {
    try {
      const created = await createPaymentApi(payment);
      try {
        if (payment.playerId) {
          await updatePlayerApi(payment.playerId, {
            status: 'نشط',
            ...(renewalInfo?.newEndDate ? { subscriptionEndDate: renewalInfo.newEndDate, subscriptionExpiry: renewalInfo.newEndDate } : {}),
          });
        }
      } catch (playerError) {
        try { await deletePaymentApi(created.id); } catch (rollbackError) { console.error('Payment rollback failed:', rollbackError); }
        throw playerError;
      }
      setPayments((prev) => [created, ...prev]);
      if (payment.playerId) {
        setPlayers((prev) => prev.map((p) => (p.id === payment.playerId ? { ...p, status: 'نشط', ...(renewalInfo?.newEndDate ? { subscriptionEndDate: renewalInfo.newEndDate, subscriptionExpiry: renewalInfo.newEndDate } : {}) } : p)));
      }

      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `تحصيل اشتراك: ${payment.playerName}`,
        category: 'مالية',
        details: `المبلغ: ${payment.amount} ج.م - الطريقة: ${payment.method} - رقم الإيصال: ${payment.invoiceNumber}`,
      });

      const notif = createNotification(
        'subscription_renewed',
        'تم سداد / تجديد اشتراك',
        `تم تحصيل اشتراك اللاعب (${payment.playerName}) بقيمة ${payment.amount} ج.م بنجاح - إيصال #${payment.invoiceNumber}`,
        'finance',
        { amount: payment.amount, playerName: payment.playerName, method: payment.method }
      );
      pushNotification(notif);
      soundAlertManager.playCashRegisterTone();

      setActiveInvoice(created);
    } catch (err) {
      console.error('Failed to record payment in database:', err);
      showToast('error', 'تعذر تسجيل الدفعة', err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ.');
    }
  };

  // Disburse coach salary in local SQLite
  const handleDisburseSalary = async (expense: ExpenseRecord, coachId: string, month: string) => {
    try {
      const createdExp = await createExpenseApi(expense);

      const salaryPayment: PaymentRecord = {
        id: `pay-sal-${Date.now()}`,
        invoiceNumber: `SAL-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'راتب مدرب',
        playerId: coachId,
        playerName: expense.paidTo,
        coachId: coachId,
        amount: expense.amount,
        method: expense.method,
        date: expense.date,
        periodMonth: month,
        collectedBy: currentUser.name,
        status: 'مدفوع',
        notes: expense.notes,
      };
      let createdPay: PaymentRecord | null = null;
      try {
        createdPay = await createPaymentApi(salaryPayment);
        await updateCoachApi(coachId, { lastSalaryPaidMonth: month });
      } catch (stepError) {
        try { if (createdPay) await deletePaymentApi(createdPay.id); } catch (rollbackError) { console.error('Salary payment rollback failed:', rollbackError); }
        try { await deleteExpenseApi(createdExp.id); } catch (rollbackError) { console.error('Salary expense rollback failed:', rollbackError); }
        throw stepError;
      }
      if (!createdPay) throw new Error('تعذر تأكيد دفعة الراتب.');
      setExpenses((prev) => [createdExp, ...prev]);
      setPayments((prev) => [createdPay, ...prev]);
      setCoaches((prev) => prev.map((c) => (c.id === coachId ? { ...c, lastSalaryPaidMonth: month } : c)));

      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `صرف راتب مدرب: ${expense.paidTo}`,
        category: 'رواتب',
        details: `المبلغ: ${expense.amount} ج.م - عن شهر: ${month}`,
      });

      const notif = createNotification(
        'salary_paid',
        'تم صرف راتب مدرب',
        `تم صرف راتب الكابتن (${expense.paidTo}) بقيمة ${expense.amount} ج.م عن شهر ${month}`,
        'finance',
        { coachId, amount: expense.amount }
      );
      pushNotification(notif);
      soundAlertManager.playCashRegisterTone();

      setActiveInvoice(createdPay);
    } catch (err) {
      console.error('Failed to disburse salary in database:', err);
      showToast('error', 'تعذر تسجيل صرف الراتب', err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ.');
    }
  };

  // Add General Expense in local SQLite
  const handleSaveExpense = async (expense: ExpenseRecord) => {
    try {
      const created = await createExpenseApi(expense);
      setExpenses((prev) => [created, ...prev]);
      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `تسجيل مصروف عام: ${expense.title}`,
        category: 'مصروفات',
        details: `المبلغ: ${expense.amount} ج.م - البند: ${expense.category}`,
      });
    } catch (err) {
      console.error('Failed to add expense:', err);
      showToast('error', 'تعذر حفظ المصروف', err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ.');
    }
  };

  // Delete Expense from local SQLite
  const handleDeleteExpense = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      try {
        await deleteExpenseApi(id);
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } catch (err) {
        console.error('Failed to delete expense:', err);
        showToast('error', 'تعذر حذف المصروف', err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف.');
      }
    }
  };

  // Add Coach to local SQLite / State — persist first, then update UI.
  const handleAddCoach = async (coach: Coach) => {
    try {
      const created = await createCoachApi(coach);
      setCoaches((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `إضافة مدرب جديد: ${created.name}`,
        category: 'مدربين',
        details: `الراتب: ${created.monthlySalary} ج.م`,
      });
      const notif = createNotification(
        'coach_added',
        'تمت إضافة مدرب جديد',
        `تم تعيين الكابتن (${created.name}) براتب شهري ${created.monthlySalary} ج.م`,
        'coaches',
        { coachId: created.id, coachName: created.name }
      );
      pushNotification(notif);
      showToast('success', 'تمت إضافة المدرب بنجاح', `تم تسجيل ${created.name} في قاعدة البيانات.`);
      soundAlertManager.playSuccessTone();
    } catch (err) {
      console.error('Failed to add coach:', err);
      showToast('error', 'تعذر إضافة المدرب', err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ.');
    }
  };
  // Update Coach in local SQLite / Local State
  const handleUpdateCoach = async (id: string, updates: Partial<Coach>) => {
    try {
      await updateCoachApi(id, updates);
      setCoaches((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...updates } as Coach) : c)));
      setSelectedCoachForProfile((prev) => prev && prev.id === id ? ({ ...prev, ...updates } as Coach) : prev);
      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `تعديل بيانات المدرب: ${updates.name || id}`,
        category: 'مدربين',
        details: `الراتب: ${updates.monthlySalary ?? ''} ج.م`,
      });

      const notif = createNotification(
        'coach_updated',
        'تم تعديل بيانات مدرب',
        `تم تحديث بيانات الكابتن (${updates.name || id}) بنجاح`,
        'coaches',
        { coachId: id }
      );
      pushNotification(notif);
      soundAlertManager.playSuccessTone();
    } catch (err) {
      showToast('error', 'تعذر تعديل بيانات المدرب', err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ في قاعدة البيانات.');
    }
  };

  // Delete Coach from local SQLite / Local State
  const handleDeleteCoach = async (id: string) => {
    const deleted = coaches.find((c) => c.id === id);
    try {
      await deleteCoachApi(id);
      setCoaches((prev) => prev.filter((c) => c.id !== id));
      if (selectedCoachForProfile?.id === id) setSelectedCoachForProfile(null);

    if (deleted) {
      logAudit({
        userId: 'admin',
        userName: currentUser.name,
        action: `حذف مدرب: ${deleted.name}`,
        category: 'مدربين',
        details: `رقم الهاتف: ${deleted.phone}`,
      });

      const notif = createNotification(
        'coach_deleted',
        'تم حذف مدرب',
        `تم حذف المدرب (${deleted.name}) من طاقم التدريب`,
        'coaches'
      );
      pushNotification(notif);
      soundAlertManager.playAlertTone();
    }

    } catch (err) {
      showToast('error', 'تعذر حذف المدرب', err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف من قاعدة البيانات.');
    }
  };

  // Save Settings to local SQLite
  const handleSaveSettings = async (newSettings: AcademySettings) => {
    try {
      const updated = await updateSettingsApi(newSettings);
      setSettings(updated);
      try { localStorage.setItem('ifc_cache_v4:settings', JSON.stringify(updated)); } catch {}
      showToast('success', 'تم حفظ الإعدادات', 'تم حفظ إعدادات الأكاديمية محليًا، وستتم مزامنتها مع Supabase عند توفر الاتصال.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('error', 'تعذر حفظ الإعدادات', err instanceof Error ? err.message : 'تعذر حفظ الإعدادات في قاعدة البيانات.');
      throw err;
    }
  };

  const handleResetData = async () => {
    const result = await resetAcademyDataApi();
    try {
      ['players','payments','expenses','coaches','archives'].forEach((key) => localStorage.removeItem(`ifc_cache_v4:${key}`));
    } catch {}
    setPlayers([]);
    setPayments([]);
    setExpenses([]);
    setCoaches([]);
    setMonthlyArchives([]);
    await loadDatabaseData();
    return result;
  };

  // Start New Month cycle handler - Archives current financial data, resets counters, and prompts archive
  const handleStartNewMonth = async (isAutomatic = false) => {
    try {
      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

      // Gather payments and expenses for this cycle
      const cyclePayments = payments.filter((p) => !p.date || p.date.startsWith(currentYm));
      const cycleExpenses = expenses.filter((e) => !e.date || e.date.startsWith(currentYm));

      const paymentsToArchive = cyclePayments.length > 0 ? cyclePayments : payments;
      const expensesToArchive = cycleExpenses.length > 0 ? cycleExpenses : expenses;

      const totalIncome = paymentsToArchive.reduce((s, p) => s + p.amount, 0);
      const totalExpenses = expensesToArchive.reduce((s, e) => s + e.amount, 0);
      const activeCount = players.filter((p) => p.status === 'نشط').length;
      const overdueCount = players.filter((p) => isOverdueOrExpired(p)).length;

      // Create new monthly archive record
      const newArchive: MonthlyArchiveRecord = {
        id: `arch-${Date.now()}`,
        monthKey: currentYm,
        monthLabel,
        archivedAt: new Date().toISOString(),
        archivedBy: currentUser.name,
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        paymentsCount: paymentsToArchive.length,
        expensesCount: expensesToArchive.length,
        activePlayersCount: activeCount,
        overduePlayersCount: overdueCount,
        payments: paymentsToArchive,
        expenses: expensesToArchive,
        notes: isAutomatic
          ? `تمت الأرشفة التلقائية الدورية أول يوم من الشهر`
          : `تمت الأرشفة وتصفير الدورة بواسطة ${currentUser.name}`,
      };

      try {
        await createMonthlyArchiveApi(newArchive);
        setMonthlyArchives([newArchive, ...monthlyArchives.filter((a) => a.monthKey !== currentYm)]);
      } catch (e) {
        console.error('Failed to persist archive to database:', e);
        if (!isAutomatic) showToast('error', 'تعذر حفظ الأرشيف', e instanceof Error ? e.message : 'فشل حفظ الأرشيف في قاعدة البيانات، ولم يتم إكمال الدورة.');
        return;
      }

      let expiredCount = 0;
      const statusErrors: string[] = [];
      const updatedPlayers = await Promise.all(
        players.map(async (p) => {
          if (isOverdueOrExpired(p) && p.status !== 'متأخر') {
            expiredCount++;
            try {
              await updatePlayerApi(p.id, { status: 'متأخر' });
            } catch (e) {
              statusErrors.push(p.name);
              console.error(`Failed to update status for player ${p.name}:`, e);
              return p;
            }
            return { ...p, status: 'متأخر' as const };
          }
          return p;
        })
      );

      setPlayers(updatedPlayers);
      if (statusErrors.length) showToast('error', 'تعذر تحديث بعض الاشتراكات', `فشل تحديث ${statusErrors.length} لاعب بعد حفظ الأرشيف.`);

      logAudit({
        userId: 'system',
        userName: currentUser.name,
        action: 'أرشفة الدورة وتصفير العداد الشهري تلقائياً',
        category: 'مالية',
        details: `أرشيف شهر ${monthLabel}: إيرادات ${totalIncome} ج.م - مصروفات ${totalExpenses} ج.م - ترحيل ${expiredCount} اشتراكات متأخرة`,
      });

      sendDesktopNotification({
        title: 'الأرشفة الشهرية التلقائية',
        body: `تم أرشفة بيانات شهر ${monthLabel} تلقائياً وتصفير العداد المالي بإجمالي إيرادات ${totalIncome.toLocaleString()} ج.م ومصروفات ${totalExpenses.toLocaleString()} ج.م.`,
        playSound: true,
        soundType: 'cash',
      });

      const notif = createNotification(
        'subscription_overdue',
        'أرشفة وتصفير العداد الشهري تلقائياً',
        `تمت أرشفة دورة ${monthLabel} تلقائياً وتصفير العدادات للدورة الجديدة ونقل السجلات إلى الأرشيف.`,
        'system'
      );
      pushNotification(notif);
      soundAlertManager.playCashRegisterTone();

      if (!isAutomatic) {
        setIsMonthlyArchiveModalOpen(true);
        showToast('success', 'تمت أرشفة الشهر', `تمت أرشفة بيانات ${monthLabel} وتصفير العدادات وفتح سجل الأرشيف.`);
      }
    } catch (err) {
      console.error('Error starting new month:', err);
      if (!isAutomatic) {
        showToast('error', 'تعذر بدء الدورة الجديدة', 'حدث خطأ أثناء أرشفة الشهر وتصفير العدادات.');
      }
    }
  };

  // Import Players from Excel. Missing text/date fields become 'لا يوجد'.
  // Membership numbers are NEVER imported from Excel: they are generated sequentially.
  const handleImportPlayers = async (importedData: any) => {
    try {
      const list = Array.isArray(importedData) ? importedData : Array.isArray(importedData?.players) ? importedData.players : null;
      if (!list?.length) return showToast('error', 'ملف الاستيراد فارغ', 'لم يتم العثور على صفوف لاعبين صالحة.');

      // Read once so a large Excel file gets one deterministic membership sequence.
      const existingPlayers = await fetchPlayers();
      const generatedNumbers = new Set(existingPlayers.map(p => String(p.memberNumber || '').trim().toUpperCase()).filter(Boolean));
      const firstGenerated = generateNextMemberNumber(existingPlayers);
      const firstMatch = firstGenerated.match(/^IFC-(\d+)$/i);
      let nextMemberSequence = firstMatch ? Number(firstMatch[1]) : 1;
      const nextSequentialMember = () => {
        // One deterministic sequence for the entire import batch. Excel's membership
        // column is intentionally ignored so imported players always receive fresh IDs.
        let candidate = `IFC-${String(nextMemberSequence).padStart(3, '0')}`;
        while (generatedNumbers.has(candidate.toUpperCase())) {
          nextMemberSequence += 1;
          candidate = `IFC-${String(nextMemberSequence).padStart(3, '0')}`;
        }
        generatedNumbers.add(candidate.toUpperCase());
        nextMemberSequence += 1;
        return candidate;
      };

      const missing = 'لا يوجد';
      const playersToImport: Player[] = [];
      let skipped = 0;
      for (let index = 0; index < list.length; index++) {
        const item = list[index] || {};
        const name = toText(importField(item, ['name', 'playerName', 'اسم اللاعب بالكامل', 'اسم اللاعب', 'الاسم', 'اللاعب'])) || missing;
        const start = toDateString(importField(item, ['subscriptionStartDate', 'subscription_start_date', 'تاريخ بداية الاشتراك', 'بداية الاشتراك']), missing);
        const end = toDateString(importField(item, ['subscriptionEndDate', 'subscription_end_date', 'subscriptionExpiry', 'subscription_expiry', 'تاريخ نهاية الاشتراك', 'نهاية الاشتراك']), missing);
        const feeRaw = importField(item, ['monthlyFee', 'monthly_fee', 'قيمة الاشتراك الشهري', 'قيمة الاشتراك الشهري (ج.م)', 'قيمة الاشتراك']);
        const startOrToday = start === missing ? missing : start;
        const endOrMissing = end === missing ? missing : end;
        const paymentMethodRaw = toText(importField(item, ['paymentMethod', 'payment_method', 'طريقة الدفع']));
        const statusRaw = toText(importField(item, ['status', 'الحالة']));
        playersToImport.push({
          id: '',
          memberNumber: nextSequentialMember(),
          name,
          nationalId: toNationalId(importField(item, ['nationalId', 'national_id', 'الرقم القومي', 'الرقم القومي (14 رقم)'])) || missing,
          birthDate: toDateString(importField(item, ['birthDate', 'birth_date', 'تاريخ الميلاد']), missing),
          notes: toText(importField(item, ['notes', 'ملاحظات'])) || missing,
          avatarUrl: toText(importField(item, ['avatarUrl', 'avatar_url', 'الصورة'])) || missing,
          team: toText(importField(item, ['team', 'group', 'الفئة', 'المجموعة', 'المجموعة / الفئة'])) || missing,
          sport: toText(importField(item, ['sport', 'الرياضة'])) || missing,
          trainingSchedule: [],
          subscriptionStartDate: startOrToday,
          subscriptionEndDate: endOrMissing,
          totalSessions: toNumber(importField(item, ['totalSessions', 'total_sessions', 'إجمالي الحصص']), 0),
          attendedSessions: toNumber(importField(item, ['attendedSessions', 'attended_sessions', 'الحصص الحاضرة']), 0),
          absentSessions: toNumber(importField(item, ['absentSessions', 'absent_sessions', 'الحصص الغائبة']), 0),
          attendanceRate: toNumber(importField(item, ['attendanceRate', 'attendance_rate', 'نسبة الحضور']), 0),
          sessions: [],
          phone: toText(importField(item, ['phone', 'playerPhone', 'رقم هاتف اللاعب', 'هاتف اللاعب'])) || missing,
          parentPhone: toText(importField(item, ['parentPhone', 'parent_phone', 'رقم ولي الأمر', 'رقم ولي الامر', 'رقم ولي الأمر (واتساب)'])) || missing,
          subscriptionPlan: toText(importField(item, ['subscriptionPlan', 'subscription_plan', 'مدة الاشتراك', 'خطة الاشتراك'])) || missing,
          monthlyFee: toNumber(feeRaw, 0),
          paymentMethod: (paymentMethodRaw || missing) as PaymentMethod,
          subscriptionExpiry: endOrMissing,
          status: (statusRaw || missing) as Player['status'],
          joinDate: toDateString(importField(item, ['joinDate', 'join_date', 'تاريخ الانضمام']), missing),
        });
      }
      let saved = 0, updated = 0, paymentCount = 0;
      // Send manageable chunks. بيانات الاستيراد تُحفظ مباشرة في SQLite المحلية.
      for (let i = 0; i < playersToImport.length; i += 500) {
        const result = await bulkImportPlayersApi(playersToImport.slice(i, i + 500), currentUser.name);
        saved += result.saved || 0; updated += result.updated || 0; paymentCount += result.payments || 0;
        if (playersToImport.length > 500) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      const [latestPlayers, latestPayments] = await Promise.all([fetchPlayers(), fetchPayments()]);
      setPlayers(latestPlayers);
      setPayments(latestPayments);
      if (saved || updated) soundAlertManager.playSuccessTone();
      showToast('success', 'تم استيراد اللاعبين بسرعة', `تم حفظ ${playersToImport.length} لاعب. جديد/محدّث: ${saved}/${updated}. تم تسجيل ${paymentCount} اشتراك مالي تلقائيًا. تم تخطي ${skipped} صف.`);
    } catch (err) {
      console.error('Failed to bulk import players:', err);
      showToast('error', 'تعذر استيراد اللاعبين', err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد.');
    }
  };

  // Import Payments from Excel with Arabic + English headers.
  const handleImportPayments = async (importedData: any) => {
    try {
      const list = Array.isArray(importedData) ? importedData : Array.isArray(importedData?.payments) ? importedData.payments : null;
      if (!list || list.length === 0) return showToast('error', 'ملف المدفوعات فارغ', 'لم يتم العثور على سندات دفع صالحة.');
      let skipped = 0;
      const errors: string[] = [];
      const tasks: Array<() => Promise<string>> = [];
      for (let index = 0; index < list.length; index++) {
        const item = list[index] || {};
        const amountRaw = importField(item, ['amount', 'المبلغ', 'قيمة الدفع', 'قيمة الاشتراك', 'قيمة الاشتراك (ج.م)']);
        const amount = toNumber(amountRaw);
        if (!(amount > 0)) { skipped++; continue; }
        const payment: PaymentRecord = {
          id: toText(importField(item, ['id', 'paymentId', 'معرف الدفع'])) || `pay-imp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          invoiceNumber: toText(importField(item, ['invoiceNumber', 'invoice_number', 'رقم الإيصال', 'رقم الايصال', 'رقم الفاتورة'])) || '',
          type: (toText(importField(item, ['type', 'نوع الدفع', 'النوع'])) || 'اشتراك لاعب') as PaymentRecord['type'],
          playerId: toText(importField(item, ['playerId', 'player_id', 'معرف اللاعب'])) || undefined,
          playerName: toText(importField(item, ['playerName', 'player_name', 'اسم اللاعب', 'اسم اللاعب بالكامل'])) || 'لاعب مستورد',
          memberNumber: toText(importField(item, ['memberNumber', 'member_number', 'رقم العضوية', 'كود اللاعب'])) || undefined,
          team: toText(importField(item, ['team', 'الفئة', 'المجموعة'])) || undefined,
          coachId: toText(importField(item, ['coachId', 'coach_id', 'معرف المدرب'])) || undefined,
          amount,
          method: (toText(importField(item, ['method', 'paymentMethod', 'payment_method', 'طريقة الدفع'])) || 'كاش') as PaymentMethod,
          date: toDateString(importField(item, ['date', 'التاريخ', 'تاريخ الدفع']), new Date().toISOString().split('T')[0]),
          createdAt: toText(importField(item, ['createdAt', 'created_at', 'وقت السداد', 'تاريخ ووقت السداد'])) || new Date().toISOString(),
          periodMonth: toText(importField(item, ['periodMonth', 'period_month', 'الشهر', 'شهر الاشتراك'])) || new Date().toISOString().slice(0, 7),
          status: (toText(importField(item, ['status', 'الحالة'])) || 'مدفوع') as PaymentRecord['status'],
          notes: toText(importField(item, ['notes', 'ملاحظات'])),
          collectedBy: toText(importField(item, ['collectedBy', 'collected_by', 'المحصل', 'بواسطة'])) || currentUser.name,
        };
        tasks.push(async () => {
          await createPaymentApi(payment);
          return payment.playerName;
        });
      }
      const results = await runImportTasks(tasks);
      const count = results.filter((r) => r.status === 'fulfilled').length;
      results.forEach((r, i) => {
        if (r.status === 'rejected') errors.push(`تعذر حفظ سند الدفع رقم ${i + 2}: ${r.reason instanceof Error ? r.reason.message : 'خطأ غير معروف'}`);
      });
      await loadDatabaseData();
      if (count) soundAlertManager.playCashRegisterTone();
      if (errors.length) console.warn('Payment import row errors:', errors);
      showToast(errors.length ? 'error' : 'success', errors.length ? 'اكتمل الاستيراد مع وجود أخطاء' : 'تم استيراد المدفوعات بنجاح', `تم حفظ ${count} سند. تم تخطي ${skipped} صف، وفشل ${errors.length} صف.`);
    } catch (err) {
      console.error('Failed to import payments:', err);
      showToast('error', 'تعذر استيراد المدفوعات', err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد.');
    }
  };

  // Import Expenses from Excel with Arabic + English headers.
  const handleImportExpenses = async (importedData: any) => {
    try {
      const list = Array.isArray(importedData) ? importedData : Array.isArray(importedData?.expenses) ? importedData.expenses : null;
      if (!list || list.length === 0) return showToast('error', 'ملف المصروفات فارغ', 'لم يتم العثور على مصروفات صالحة.');
      let skipped = 0;
      const errors: string[] = [];
      const tasks: Array<() => Promise<string>> = [];
      for (let index = 0; index < list.length; index++) {
        const item = list[index] || {};
        const amountRaw = importField(item, ['amount', 'المبلغ', 'قيمة المصروف', 'قيمة المصروف (ج.م)']);
        const amount = toNumber(amountRaw);
        if (!(amount > 0)) { skipped++; continue; }
        const expense: ExpenseRecord = {
          id: toText(importField(item, ['id', 'expenseId', 'معرف المصروف'])) || `exp-imp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          title: toText(importField(item, ['title', 'اسم المصروف', 'البيان', 'المصروف'])) || 'مصروف مستورد',
          category: (toText(importField(item, ['category', 'الفئة', 'التصنيف'])) || 'أخرى') as ExpenseRecord['category'],
          amount,
          date: toDateString(importField(item, ['date', 'التاريخ', 'تاريخ المصروف']), new Date().toISOString().split('T')[0]),
          paidTo: toText(importField(item, ['paidTo', 'paid_to', 'المدفوع له', 'دفع إلى', 'المستفيد'])) || 'غير محدد',
          coachId: toText(importField(item, ['coachId', 'coach_id', 'معرف المدرب'])) || undefined,
          method: (toText(importField(item, ['method', 'paymentMethod', 'payment_method', 'طريقة الدفع'])) || 'كاش') as PaymentMethod,
          notes: toText(importField(item, ['notes', 'ملاحظات'])),
        };
        tasks.push(async () => {
          await createExpenseApi(expense);
          return expense.title;
        });
      }
      const results = await runImportTasks(tasks);
      const count = results.filter((r) => r.status === 'fulfilled').length;
      results.forEach((r, i) => {
        if (r.status === 'rejected') errors.push(`تعذر حفظ المصروف رقم ${i + 2}: ${r.reason instanceof Error ? r.reason.message : 'خطأ غير معروف'}`);
      });
      await loadDatabaseData();
      if (count) soundAlertManager.playSuccessTone();
      if (errors.length) console.warn('Expense import row errors:', errors);
      showToast(errors.length ? 'error' : 'success', errors.length ? 'اكتمل الاستيراد مع وجود أخطاء' : 'تم استيراد المصروفات بنجاح', `تم حفظ ${count} مصروف. تم تخطي ${skipped} صف، وفشل ${errors.length} صف.`);
    } catch (err) {
      console.error('Failed to import expenses:', err);
      showToast('error', 'تعذر استيراد المصروفات', err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد.');
    }
  };


  // Import Coaches from Excel using one bulk API request per 500 rows.
  const handleImportCoaches = async (importedData: any) => {
    try {
      const list = Array.isArray(importedData) ? importedData : Array.isArray(importedData?.coaches) ? importedData.coaches : null;
      if (!list?.length) return showToast('error', 'ملف المدربين فارغ', 'لم يتم العثور على صفوف مدربين صالحة.');
      const coachesToImport: Coach[] = [];
      let skipped = 0;
      for (let index = 0; index < list.length; index++) {
        const row = list[index] || {};
        const name = toText(importField(row, ['name', 'اسم المدرب', 'المدرب']));
        if (!name) { skipped++; continue; }
        const teamsText = toText(importField(row, ['teams', 'المجموعات', 'الفئات', 'المجموعات / الفئات']));
        coachesToImport.push({
          id: toText(importField(row, ['id', 'coachId', 'معرف المدرب', 'المعرف الداخلي'])) || `coach-imp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          name: name.startsWith('كابتن') ? name : `كابتن / ${name}`,
          avatarUrl: toText(importField(row, ['avatarUrl', 'avatar_url', 'الصورة'])),
          role: toText(importField(row, ['role', 'الدور', 'المسمى الوظيفي'])) || 'مدرب',
          sport: toText(importField(row, ['sport', 'الرياضة'])) || 'كيك بوكسينغ',
          teams: teamsText ? teamsText.split(/\s*[-،,|]\s*/).filter(Boolean) : [],
          phone: toText(importField(row, ['phone', 'الهاتف', 'رقم الهاتف'])),
          monthlySalary: toNumber(importField(row, ['monthlySalary', 'monthly_salary', 'الراتب الشهري']), 4000),
          joinDate: toDateString(importField(row, ['joinDate', 'join_date', 'تاريخ الانضمام']), new Date().toISOString().split('T')[0]),
          status: (toText(importField(row, ['status', 'الحالة'])) || 'نشط') as Coach['status'],
          sessionsCountThisMonth: toNumber(importField(row, ['sessionsCountThisMonth', 'sessions_count_this_month', 'عدد الحصص هذا الشهر'])),
          lastSalaryPaidMonth: toText(importField(row, ['lastSalaryPaidMonth', 'آخر شهر تم دفع راتبه'])) || undefined,
        });
      }
      let saved = 0;
      for (let i = 0; i < coachesToImport.length; i += 500) {
        const result = await bulkImportCoachesApi(coachesToImport.slice(i, i + 500));
        saved += result.saved || 0;
        if (coachesToImport.length > 500) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      const latestCoaches = await fetchCoaches();
      setCoaches(latestCoaches);
      if (saved) soundAlertManager.playSuccessTone();
      showToast('success', 'تم استيراد المدربين بسرعة', `تم حفظ ${saved} مدرب. تم تخطي ${skipped} صف.`);
    } catch (err) {
      console.error('Failed to bulk import coaches:', err);
      showToast('error', 'تعذر استيراد المدربين', err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد.');
    }
  };

  // Import Attendance without replacing existing history. Rows may identify the player by ID, member number, or name.
  const handleImportAttendance = async (importedData: any) => {
    const list = Array.isArray(importedData) ? importedData : Array.isArray(importedData?.attendance) ? importedData.attendance : null;
    if (!list?.length) return showToast('error', 'ملف الحضور فارغ', 'لم يتم العثور على سجلات حضور صالحة.');
    let count = 0, skipped = 0;
    const errors: string[] = [];
    let latestPlayers = players;
    try { latestPlayers = await fetchPlayers(); } catch { /* use current UI state if offline */ }
    for (let index = 0; index < list.length; index++) {
      const row = list[index] || {};
      const directPlayerId = toText(importField(row, ['playerId', 'player_id', 'معرف اللاعب', 'المعرف الداخلي للاعب']));
      const member = toText(importField(row, ['memberNumber', 'member_number', 'رقم العضوية', 'كود اللاعب']));
      const playerName = toText(importField(row, ['playerName', 'player_name', 'اسم اللاعب', 'اسم اللاعب بالكامل']));
      let playerId = directPlayerId;
      if (!playerId && (member || playerName)) {
        // Use the latest server state so a complete backup can import players first
        // and then resolve attendance even before React has re-rendered.
        playerId = latestPlayers.find((p) =>
          (member && String(p.memberNumber) === member) || (playerName && p.name.trim() === playerName.trim())
        )?.id || '';
      }
      if (!playerId) { skipped++; continue; }
      const date = toDateString(importField(row, ['date', 'التاريخ', 'تاريخ الحضور']), new Date().toISOString().split('T')[0]);
      const rawStatus = toText(importField(row, ['status', 'الحالة', 'حالة الحضور'])) || 'غائب';
      const status = (rawStatus === 'حاضر' || rawStatus === 'بعذر' ? rawStatus : 'غائب') as 'حاضر' | 'غائب' | 'بعذر';
      const sessionId = toText(importField(row, ['id', 'sessionId', 'session_id', 'المعرف الداخلي للجلسة'])) || `sess-imp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        await updateSessionAttendanceApi(playerId, sessionId, status, toText(importField(row, ['notes', 'ملاحظات'])), date);
        count++;
      } catch (e) { errors.push(`الصف ${index + 2}: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`); }
    }
    await loadDatabaseData();
    showToast(errors.length ? 'error' : 'success', errors.length ? 'اكتمل استيراد الحضور مع أخطاء' : 'تم استيراد الحضور بنجاح', `تم حفظ ${count} سجل حضور. تم تخطي ${skipped} صف، وفشل ${errors.length} صف.`);
  };

  // Automatic rollover check at the beginning of each calendar month
  useEffect(() => {
    if (players.length === 0) return;
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastActiveMonth = localStorage.getItem('ifc_last_active_month');

    if (lastActiveMonth && lastActiveMonth !== currentYm) {
      localStorage.setItem('ifc_last_active_month', currentYm);
      handleStartNewMonth(true);
    } else if (!lastActiveMonth) {
      localStorage.setItem('ifc_last_active_month', currentYm);
    }
  }, [players.length]);

  // Export all academy data as a real Excel workbook (Arabic headers; import accepts Arabic + English).
  const handleExportAllData = () => {
    const workbook = XLSX.utils.book_new();
    const playersRows = players.map((p) => ({
      'المعرف الداخلي': p.id, 'اسم اللاعب بالكامل': p.name, 'رقم العضوية': p.memberNumber, 'الرقم القومي': p.nationalId,
      'المجموعة / الفئة': p.team, 'رقم هاتف اللاعب': p.phone, 'رقم ولي الأمر (واتساب)': p.parentPhone,
      'طريقة الدفع': p.paymentMethod, 'مدة الاشتراك': p.subscriptionPlan, 'تاريخ بداية الاشتراك': p.subscriptionStartDate,
      'تاريخ نهاية الاشتراك': p.subscriptionEndDate, 'قيمة الاشتراك الشهري (ج.م)': p.monthlyFee, 'الحالة': p.status,
      'تاريخ الانضمام': p.joinDate, 'الرياضة': p.sport, 'إجمالي الحصص': p.totalSessions, 'الحصص الحاضرة': p.attendedSessions,
      'الحصص الغائبة': p.absentSessions, 'ملاحظات': p.notes,
    }));
    const paymentRows = payments.map((p) => ({
      'المعرف الداخلي': p.id, 'رقم الإيصال': p.invoiceNumber, 'اسم اللاعب': p.playerName, 'رقم العضوية': p.memberNumber || '', 'نوع الدفع': p.type,
      'المبلغ': p.amount, 'طريقة الدفع': p.method, 'التاريخ': p.date, 'الشهر': p.periodMonth, 'الحالة': p.status,
      'الفئة': p.team || '', 'المحصل': p.collectedBy || '', 'ملاحظات': p.notes || '',
    }));
    const expenseRows = expenses.map((e) => ({
      'المعرف الداخلي': e.id, 'اسم المصروف': e.title, 'الفئة': e.category, 'المبلغ': e.amount, 'التاريخ': e.date, 'المدفوع له': e.paidTo,
      'طريقة الدفع': e.method, 'ملاحظات': e.notes || '',
    }));
    const coachRows = coaches.map((c) => ({
      'المعرف الداخلي': c.id, 'اسم المدرب': c.name, 'الدور': c.role, 'الرياضة': c.sport, 'الهاتف': c.phone, 'الراتب الشهري': c.monthlySalary,
      'تاريخ الانضمام': c.joinDate, 'الحالة': c.status, 'عدد الحصص هذا الشهر': c.sessionsCountThisMonth, 'آخر شهر تم دفع راتبه': c.lastSalaryPaidMonth || '',
    }));
    const attendanceRows = players.flatMap((p) => p.sessions.map((sess) => ({
      'المعرف الداخلي للجلسة': sess.id, 'معرف اللاعب': p.id, 'اسم اللاعب': p.name, 'رقم العضوية': p.memberNumber,
      'رقم الحصة': sess.sessionNumber, 'التاريخ': sess.date, 'اليوم': sess.dayName, 'الوقت': sess.time,
      'الحالة': sess.status, 'ملاحظات': sess.notes || '',
    })));
    const settingsRows = [{
      'اسم الأكاديمية': settings.academyName, 'النص المختصر للشعار': settings.logoText, 'الهاتف': settings.phone,
      'البريد الإلكتروني': settings.email, 'العنوان': settings.address, 'العملة': settings.currency,
      'الموسم الحالي': settings.currentSeason, 'إشعارات واتساب': settings.whatsappNotificationsEnabled ? 'نعم' : 'لا',
      'تنبيهات SMS': settings.smsAlertsEnabled ? 'نعم' : 'لا', 'لون النظام': settings.primaryColor || '',
      'لون الخلفية': settings.backgroundColor || '', 'لون شريط التنقل': settings.navbarColor || '',
    }];
    const add = (rows: any[], name: string) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const headers = rows.length ? Object.keys(rows[0]) : [];
      worksheet['!cols'] = headers.map((header) => {
        const maxLen = Math.max(header.length, ...rows.map((row) => String(row[header] ?? '').length));
        const isDate = /تاريخ|date|بداية|نهاية|انضمام/i.test(header);
        const isNumberId = /رقم|هاتف|member|national|invoice|id|كود|معرف/i.test(header);
        return { wch: Math.min(42, Math.max(isDate ? 16 : isNumberId ? 18 : 14, maxLen + 2)) };
      });
      worksheet['!views'] = [{ rightToLeft: true }];
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    };
    add(playersRows, 'اللاعبين'); add(paymentRows, 'المدفوعات'); add(expenseRows, 'المصروفات'); add(coachRows, 'المدربين'); add(attendanceRows, 'الحضور'); add(settingsRows, 'الإعدادات');
    const filename = `نسخة_أكاديمية_IFC_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    showToast('success', 'تم تصدير النسخة الاحتياطية', 'تم إنشاء ملف Excel يحتوي على بيانات الأكاديمية في أوراق منفصلة.');
  };

  // Import a complete Excel backup. Arabic and English sheet/column names are supported.
  const handleImportAllData = async (backup: any) => {
    try {
      const source = backup && typeof backup === 'object' ? backup : null;
      if (!source) throw new Error('ملف النسخة الاحتياطية غير صالح.');
      const pick = (keys: string[]) => keys.reduce((acc, key) => acc ?? source[key], undefined as any);
      const playersData = pick(['players', 'اللاعبين', 'Players']) || [];
      const paymentsData = pick(['payments', 'المدفوعات', 'Payments']) || [];
      const expensesData = pick(['expenses', 'المصروفات', 'Expenses']) || [];
      const coachesData = pick(['coaches', 'المدربين', 'Coaches']) || [];
      const attendanceData = pick(['attendance', 'الحضور', 'Attendance']) || [];
      const settingsData = pick(['settings', 'الإعدادات', 'Settings']);
      if (!Array.isArray(playersData) && !Array.isArray(paymentsData) && !Array.isArray(expensesData) && !Array.isArray(coachesData) && !Array.isArray(attendanceData) && !settingsData) {
        throw new Error('لم يتم العثور على أوراق بيانات معروفة داخل ملف Excel.');
      }
      if (Array.isArray(playersData) && playersData.length) await handleImportPlayers(playersData);
      if (Array.isArray(attendanceData) && attendanceData.length) await handleImportAttendance(attendanceData);
      if (Array.isArray(paymentsData) && paymentsData.length) await handleImportPayments(paymentsData);
      if (Array.isArray(expensesData) && expensesData.length) await handleImportExpenses(expensesData);
      if (Array.isArray(coachesData) && coachesData.length) await handleImportCoaches(coachesData);
      if (settingsData) {
        const row = Array.isArray(settingsData) ? settingsData[0] : settingsData;
        if (row) {
          const importedSettings: AcademySettings = {
            ...settings,
            academyName: toText(importField(row, ['academyName','academy_name','اسم الأكاديمية'])) || settings.academyName,
            logoText: toText(importField(row, ['logoText','logo_text','النص المختصر للشعار'])) || settings.logoText,
            phone: toText(importField(row, ['phone','الهاتف'])), email: toText(importField(row, ['email','البريد الإلكتروني'])),
            address: toText(importField(row, ['address','العنوان'])), currency: toText(importField(row, ['currency','العملة'])) || settings.currency,
            currentSeason: toText(importField(row, ['currentSeason','current_season','الموسم الحالي'])),
          };
          await handleSaveSettings(importedSettings);
        }
      }
      await loadDatabaseData();
      showToast('success', 'تم استيراد النسخة الاحتياطية', 'تمت قراءة ملف Excel وحفظ البيانات المتاحة في قاعدة SQLite المحلية.');
    } catch (err) {
      console.error('Failed to import backup:', err);
      showToast('error', 'تعذر استيراد النسخة الاحتياطية', err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد.');
      throw err;
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) await logoutAdmin(token);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem('ifc_admin_refresh_token');
    } catch (e) {
      console.error('Admin sign out error:', e);
    }
    // Logout clears ONLY the login session marker. Database records are untouched.
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {
      console.warn('Unable to clear login session:', e);
    }
    setCurrentUser(DEFAULT_ADMIN_USER);
    setCurrentTab('login');
  };

  return (
    <div
      style={{ backgroundColor: settings.backgroundColor || '#020617' }}
      className="min-h-screen text-slate-100 flex flex-col font-['Cairo',sans-serif] relative overflow-x-hidden transition-colors duration-300"
    >
      {/* Ambient Lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[15%] -left-[10%] w-[520px] h-[520px] bg-blue-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-[35%] -right-[10%] w-[460px] h-[460px] bg-indigo-600/15 rounded-full blur-[110px]" />
        <div className="absolute -bottom-[10%] left-[25%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Main App Container */}
      <div className="w-full flex-1 flex flex-col relative z-10">
        {/* Navbar */}
        {currentTab !== 'loading' && currentTab !== 'login' && (
          <Navbar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            onLogout={handleLogout}
            expiringIn3DaysCount={expiringInWeekPlayers.length}
            unpaidCount={overduePlayers.length}
            totalNotificationsCount={totalNotificationsCount}
            onOpenNotifications={() => {
              setNotifications((prev) => markAllNotificationsAsRead(prev));
              setIsNotificationsOpen(true);
            }}
            currentUser={currentUser}
            isDbConnected={isDbConnected}
            customLogoUrl={settings.customLogoUrl}
            navbarColor={settings.navbarColor}
            primaryColor={settings.primaryColor}
          />
        )}

        {/* Database Sync Banner if error */}
        {dbError && currentTab !== 'loading' && currentTab !== 'login' && (
          <div
            className="bg-rose-500/20 border-b border-rose-500/40 text-rose-300 text-xs py-2 px-4 flex items-center justify-between"
            dir="rtl"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>تنبيه الاتصال: {dbError}</span>
            </div>
            <button
              onClick={loadDatabaseData}
              className="flex items-center gap-1 bg-rose-500/30 hover:bg-rose-500/40 text-white px-2.5 py-1 rounded-lg text-xs cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        )}

        {/* Main Routed Content */}
        <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 overflow-y-auto">
          {currentTab === 'loading' && (
            <LoadingScreen
              onComplete={async () => {
                const token = localStorage.getItem(AUTH_TOKEN_KEY);
                const refreshToken = localStorage.getItem('ifc_admin_refresh_token');
                const cachedSession = (() => { try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null'); } catch { return null; } })();
                if (token) {
                  const session = await validateAdminSession(token);
                  if (session?.authenticated) {
                    const user = session.user || cachedSession?.user || DEFAULT_ADMIN_USER;
                    setCurrentUser({ ...DEFAULT_ADMIN_USER, ...user });
                    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ authenticated: true, user }));
                    setCurrentTab('home');
                    void loadDatabaseData();
                    return;
                  }
                  if (refreshToken && !session?.offline) {
                    try {
                      const refreshed = await refreshAdminSession(refreshToken);
                      localStorage.setItem(AUTH_TOKEN_KEY, refreshed.access_token);
                      localStorage.setItem('ifc_admin_refresh_token', refreshed.refresh_token);
                      const user = refreshed.user || cachedSession?.user || DEFAULT_ADMIN_USER;
                      setCurrentUser({ ...DEFAULT_ADMIN_USER, ...user });
                      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ authenticated: true, user, expiresAt: refreshed.expires_at }));
                      setCurrentTab('home');
                      void loadDatabaseData();
                      return;
                    } catch {}
                  }
                  if (session?.offline && cachedSession?.authenticated) {
                    setCurrentUser({ ...DEFAULT_ADMIN_USER, ...(cachedSession.user || {}) });
                    setCurrentTab('home');
                    void loadDatabaseData();
                    return;
                  }
                  localStorage.removeItem(AUTH_TOKEN_KEY);
                  localStorage.removeItem('ifc_admin_refresh_token');
                  localStorage.removeItem(AUTH_SESSION_KEY);
                }
                setCurrentTab('login');
              }}
            />
          )}

          {currentTab === 'login' && (
            <LoginScreen
              authenticate={loginAdmin}
              onLogin={(user, token, refreshToken, expiresAt, password) => {
                setCurrentUser(user);
                try {
                  localStorage.setItem(AUTH_TOKEN_KEY, token);
                  if (refreshToken) localStorage.setItem('ifc_admin_refresh_token', refreshToken);
                  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ authenticated: true, user, expiresAt }));
                } catch (error) {
                  console.warn('Unable to save login session:', error);
                }
                setCurrentTab('home');
                void (async () => { await flushPendingCloudChanges(password); await loadDatabaseData(); })();
              }}
            />
          )}

          {currentTab === 'home' && (
            <DashboardView
              players={players}
              payments={payments}
              expenses={expenses}
              coaches={coaches}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'players' && (
            <PlayersView
              players={players}
              onAddPlayer={() => {
                setPlayerToEdit(null);
                setIsAddPlayerModalOpen(true);
              }}
              onEditPlayer={(player) => {
                setPlayerToEdit(player);
                setIsAddPlayerModalOpen(true);
              }}
              onDeletePlayer={handleDeletePlayer}
              onSelectPlayer={(player) => setSelectedPlayerForProfile(player)}
              onExportReport={() => setCurrentTab('reports')}
              onExportPlayerStatement={handleOpenExportPlayerStatement}
              onImportPlayers={handleImportPlayers}
              isAmountsVisible={isAmountsVisible}
              onToggleAmountsVisible={toggleAmountsVisible}
            />
          )}

          {currentTab === 'attendance' && (
            <AttendanceView
              players={players}
              onUpdatePlayerAttendance={handleUpdatePlayerAttendance}
              onMarkAllPresent={handleMarkAllPresent}
              onImportAttendance={handleImportAttendance}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentsView
              payments={payments}
              onOpenAddPayment={() => setIsAddPaymentModalOpen(true)}
              onOpenPaySalary={() => {
                setSelectedCoachIdForSalary(undefined);
                setIsPaySalaryModalOpen(true);
              }}
              onOpenActionChooser={() => setIsActionChooserOpen(true)}
              onPreviewInvoice={(pay) => setActiveInvoice(pay)}
              onExportReports={() => setCurrentTab('reports')}
              onImportPayments={handleImportPayments}
              isAmountsVisible={isAmountsVisible}
              onToggleAmountsVisible={toggleAmountsVisible}
            />
          )}

          {currentTab === 'finance' && (
            <FinanceView
              expenses={expenses}
              payments={payments}
              players={players}
              coaches={coaches}
              onOpenAddExpense={() => setIsAddExpenseModalOpen(true)}
              onOpenPaySalary={(coachId) => {
                setSelectedCoachIdForSalary(coachId);
                setIsPaySalaryModalOpen(true);
              }}
              onDeleteExpense={handleDeleteExpense}
              onExportExpensesPdf={handleOpenExportExpensesPdf}
              onImportExpenses={handleImportExpenses}
              isAmountsVisible={isAmountsVisible}
              onToggleAmountsVisible={toggleAmountsVisible}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              players={players}
              payments={payments}
              expenses={expenses}
              onExportPlayerStatement={handleOpenExportPlayerStatement}
              onExportExpensesPdf={handleOpenExportExpensesPdf}
              onStartNewMonth={handleStartNewMonth}
              onImportReportsData={handleImportPayments}
              onOpenMonthlyArchive={() => setIsMonthlyArchiveModalOpen(true)}
            />
          )}

          {currentTab === 'coaches' && (
            <CoachesView
              coaches={coaches}
              onAddCoach={handleAddCoach}
              onUpdateCoach={handleUpdateCoach}
              onDeleteCoach={handleDeleteCoach}
              onPaySalary={(coachId) => {
                setSelectedCoachIdForSalary(coachId);
                setIsPaySalaryModalOpen(true);
              }}
              onSelectCoach={(coach) => setSelectedCoachForProfile(coach)}
              isAmountsVisible={isAmountsVisible}
              onToggleAmountsVisible={toggleAmountsVisible}
              onImportCoaches={handleImportCoaches}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onResetData={handleResetData}
              onExportAllData={handleExportAllData}
              onImportAllData={handleImportAllData}
              onStartNewMonth={handleStartNewMonth}
              isDbConnected={isDbConnected}
              currentUsername={currentUser.username}
              onCredentialsChanged={(username) => setCurrentUser(prev => ({ ...prev, username }))}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      {/* 1. Combined Financial Action Chooser Modal */}
      <NewFinancialActionModal
        isOpen={isActionChooserOpen}
        onClose={() => setIsActionChooserOpen(false)}
        onSelectPayment={() => setIsAddPaymentModalOpen(true)}
        onSelectSalary={() => {
          setSelectedCoachIdForSalary(undefined);
          setIsPaySalaryModalOpen(true);
        }}
      />

      {/* 2. Player Profile Modal */}
      <PlayerProfileModal
        isOpen={!!selectedPlayerForProfile}
        onClose={() => setSelectedPlayerForProfile(null)}
        player={selectedPlayerForProfile}
        payments={payments}
        onEditPlayer={(player) => {
          setSelectedPlayerForProfile(null);
          setPlayerToEdit(player);
          setIsAddPlayerModalOpen(true);
        }}
        onOpenPaymentForPlayer={(player) => {
          setSelectedPlayerForProfile(null);
          setSelectedPlayerForPayment(player);
          setIsAddPaymentModalOpen(true);
        }}
        isAmountsVisible={isAmountsVisible}
      />

      {/* 3. Add / Edit Player Modal */}
      <AddPlayerModal
        isOpen={isAddPlayerModalOpen}
        onClose={() => {
          setIsAddPlayerModalOpen(false);
          setPlayerToEdit(null);
        }}
        onSave={handleSavePlayer}
        playerToEdit={playerToEdit}
        existingPlayers={players}
      />

      {/* 4. Add Subscription Payment Modal */}
      <AddPaymentModal
        isOpen={isAddPaymentModalOpen}
        onClose={() => {
          setIsAddPaymentModalOpen(false);
          setSelectedPlayerForPayment(null);
        }}
        players={players}
        onSavePayment={handleSavePayment}
        cashierName={currentUser.name}
        preSelectedPlayerId={selectedPlayerForPayment?.id}
      />

      {/* 5. Pay Coach Salary Modal */}
      <PaySalaryModal
        isOpen={isPaySalaryModalOpen}
        onClose={() => setIsPaySalaryModalOpen(false)}
        coaches={coaches}
        onDisburseSalary={handleDisburseSalary}
        preSelectedCoachId={selectedCoachIdForSalary}
      />

      {/* 6. Add General Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        onClose={() => setIsAddExpenseModalOpen(false)}
        onSaveExpense={handleSaveExpense}
      />

      {/* 7. Printable Invoice / Salary Voucher Modal */}
      <InvoiceModal
        payment={activeInvoice}
        onClose={() => setActiveInvoice(null)}
      />

      {/* 8. Unified Notifications Hub Modal */}
      <UnifiedNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onMarkAsRead={handleMarkNotificationAsRead}
        onClearAll={handleClearAllNotifications}
        onDeleteNotification={handleDeleteNotification}
        notificationTrash={notificationTrash}
        onRestoreFromTrash={handleRestoreNotification}
        onDeleteFromTrash={handleDeleteTrashPermanently}
        expiringInWeekPlayers={expiringInWeekPlayers}
        overduePlayers={overduePlayers}
        players={players}
        coaches={coaches}
        onQuickPay={(player) => {
          setSelectedPlayerForPayment(player);
          setCurrentTab('payments');
          setIsNotificationsOpen(false);
          setIsAddPaymentModalOpen(true);
        }}
      />

      {/* 9. PDF Export & Archival Modal */}
      <ExportPdfModal
        isOpen={isExportPdfModalOpen}
        onClose={() => setIsExportPdfModalOpen(false)}
        mode={pdfExportMode}
        players={players}
        payments={payments}
        expenses={expenses}
        initialPlayerId={pdfSelectedPlayerId}
        academySettings={settings}
      />

      {/* 10. Coach Profile Modal */}
      <CoachProfileModal
        isOpen={!!selectedCoachForProfile}
        onClose={() => setSelectedCoachForProfile(null)}
        coach={selectedCoachForProfile}
        payments={payments}
        onUpdateCoach={handleUpdateCoach}
        onPaySalary={(coachId) => {
          setSelectedCoachForProfile(null);
          setSelectedCoachIdForSalary(coachId);
          setIsPaySalaryModalOpen(true);
        }}
        onDeleteCoach={handleDeleteCoach}
        isAmountsVisible={isAmountsVisible}
      />

      {/* 11. Monthly Archive Modal */}
      <MonthlyArchiveModal
        isOpen={isMonthlyArchiveModalOpen}
        onClose={() => setIsMonthlyArchiveModalOpen(false)}
        archives={monthlyArchives}
        onTriggerNewMonthArchive={handleStartNewMonth}
        currency={settings.currency || 'ج.م'}
      />
      <SystemToast open={systemToast.open} type={systemToast.type} title={systemToast.title} message={systemToast.message} onClose={() => setSystemToast((prev) => ({ ...prev, open: false }))} />
    </div>
  );
}
