import { Player, PaymentRecord, ExpenseRecord, Coach, AcademySettings } from '../types';

export const INITIAL_PLAYERS: Player[] = [];
export const INITIAL_PAYMENTS: PaymentRecord[] = [];
export const INITIAL_EXPENSES: ExpenseRecord[] = [];
export const INITIAL_COACHES: Coach[] = [];

export const INITIAL_SETTINGS: AcademySettings = {
  academyName: 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ',
  logoText: 'IFC ACADEMY',
  phone: '+20 100 123 4567',
  email: 'info@ifc-academy.com',
  address: 'القاهرة الجديدة، التجمع الخامس - صالة النصر الأولمبية',
  currency: 'ج.م',
  currentSeason: 'موسم 2024 / 2025',
  whatsappNotificationsEnabled: true,
  smsAlertsEnabled: false,
};
