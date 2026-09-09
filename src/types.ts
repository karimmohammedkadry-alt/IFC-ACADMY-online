export type PageTab = 
  | 'loading' 
  | 'login' 
  | 'home' 
  | 'players' 
  | 'attendance'
  | 'payments' 
  | 'finance' 
  | 'reports' 
  | 'coaches' 
  | 'settings';

export type PaymentMethod = 'كاش' | 'فودافون كاش' | 'بطاقة ائتمانية' | 'إنستاباي' | 'تحويل بنكي';

export type SubscriptionStatus = 'نشط' | 'متأخر' | 'منتهي' | 'معلق';

export type AttendanceStatus = 'حاضر' | 'غائب' | 'بعذر';

export interface AuditLogRecord {
  id: string;
  action: string;
  details: string;
  user: string;
  timestamp: string;
  device: string;
  browser: string;
  ipPlaceholder?: string;
  status: 'نجاح' | 'تنبيه' | 'فشل';
}

export interface SessionRecord {
  id: string;
  sessionNumber: number;
  date: string; // YYYY-MM-DD
  dayName: string; // السبت، الاثنين...
  time: string; // 4:00 م - 5:30 م
  status: AttendanceStatus;
  notes?: string;
}

export interface Player {
  id: string;
  memberNumber: string | number; // e.g. 'IFC-001', 1001
  name: string;
  nationalId?: string; // الرقم القومي (14 رقم)
  birthDate?: string;
  notes?: string;
  avatarUrl?: string;
  team: string; // شباب، براعم، ناشئين، بنات
  sport: string; // كيك بوكسينغ
  trainingSchedule?: string[];
  subscriptionStartDate: string; // YYYY-MM-DD
  subscriptionEndDate: string; // YYYY-MM-DD
  totalSessions: number;
  attendedSessions: number;
  absentSessions: number;
  attendanceRate: number; // percentage, e.g. 50, 75
  sessions: SessionRecord[];
  phone: string;
  parentPhone: string;
  subscriptionPlan: string;
  monthlyFee: number;
  paymentMethod?: PaymentMethod;
  subscriptionExpiry: string;
  status: SubscriptionStatus;
  joinDate: string;
}

export interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  type?: 'اشتراك لاعب' | 'راتب مدرب';
  playerId?: string;
  playerName: string;
  memberNumber?: string | number;
  team?: string;
  coachId?: string;
  amount: number;
  method: PaymentMethod;
  date: string; // YYYY-MM-DD used for day filters
  createdAt?: string; // ISO timestamp: day/month/year + hour/minute/second
  periodMonth: string; // مايو 2024
  status: 'مدفوع' | 'معلق' | 'مسترجع';
  notes?: string;
  collectedBy: string; // أمين الصندوق / مسؤول الخزينة
}

export interface ExpenseRecord {
  id: string;
  title: string;
  category: 'إيجار ملاعب' | 'رواتب مدربين' | 'أدوات ومعدات' | 'صيانة وكهرباء' | 'تسويق وإعلان' | 'أخرى';
  amount: number;
  date: string;
  paidTo: string;
  coachId?: string;
  method: PaymentMethod;
  notes?: string;
}

export interface Coach {
  id: string;
  name: string;
  avatarUrl: string;
  role: string; // كابتن كيك بوكسينغ، مدرب لياقة بدنية وكارديو...
  sport: string; // كيك بوكسينغ
  teams: string[];
  phone: string;
  monthlySalary: number;
  joinDate: string;
  status: 'نشط' | 'في إجازة' | 'متوقف';
  sessionsCountThisMonth: number;
  lastSalaryPaidMonth?: string;
}

export interface AcademySettings {
  academyName: string;
  logoText: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  currentSeason: string;
  whatsappNotificationsEnabled: boolean;
  smsAlertsEnabled: boolean;
  customLogoUrl?: string;
  colorTheme?: 'classic-blue' | 'royal-gold' | 'emerald' | 'obsidian' | 'custom';
  primaryColor?: string; // e.g. #2563eb
  backgroundColor?: string; // e.g. #090d16
  navbarColor?: string; // e.g. #0b1120
  desktopNotificationsEnabled?: boolean;
}

export interface MonthlyArchiveRecord {
  id: string;
  monthKey: string; // e.g. '2026-08'
  monthLabel: string; // e.g. 'أغسطس 2026'
  archivedAt: string; // ISO date string
  archivedBy: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  paymentsCount: number;
  expensesCount: number;
  activePlayersCount?: number;
  overduePlayersCount?: number;
  payments?: PaymentRecord[];
  expenses?: ExpenseRecord[];
  notes?: string;
}

export type NotificationType =
  | 'player_added'
  | 'player_updated'
  | 'player_deleted'
  | 'coach_added'
  | 'coach_updated'
  | 'coach_deleted'
  | 'subscription_renewed'
  | 'subscription_expiring_soon'
  | 'subscription_one_session_left'
  | 'subscription_overdue'
  | 'salary_paid'
  | 'expense_added';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read?: boolean;
  category: 'players' | 'coaches' | 'subscriptions' | 'finance' | 'system';
  meta?: {
    playerId?: string;
    playerName?: string;
    memberNumber?: string | number;
    coachId?: string;
    coachName?: string;
    amount?: number;
    parentPhone?: string;
    daysLeft?: number;
    month?: string;
    invoiceNumber?: string;
    method?: string;
    deletedPlayer?: Player;
  };
}
