import Database from '@tauri-apps/plugin-sql';
import { mkdir, readFile, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';

let dbPromise: Promise<Database> | null = null;

const schema = [
  `CREATE TABLE IF NOT EXISTS admin_credentials (id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, member_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, national_id TEXT DEFAULT '', payment_method TEXT DEFAULT 'كاش', birth_date TEXT DEFAULT '', notes TEXT DEFAULT '', avatar_url TEXT DEFAULT '', team TEXT NOT NULL, sport TEXT DEFAULT 'كيك بوكسينغ', training_schedule TEXT DEFAULT '[]', subscription_start_date TEXT NOT NULL, subscription_end_date TEXT NOT NULL, total_sessions INTEGER DEFAULT 8, attended_sessions INTEGER DEFAULT 0, absent_sessions INTEGER DEFAULT 0, attendance_rate REAL DEFAULT 0, phone TEXT DEFAULT '', parent_phone TEXT DEFAULT '', subscription_plan TEXT DEFAULT 'شهري (3 أيام/أسبوع)', monthly_fee INTEGER DEFAULT 500, subscription_expiry TEXT NOT NULL, status TEXT DEFAULT 'نشط', join_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS player_sessions (id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, session_number INTEGER NOT NULL, date TEXT NOT NULL, day_name TEXT NOT NULL, time TEXT NOT NULL, status TEXT DEFAULT 'غائب', notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'اشتراك لاعب', player_id TEXT, player_name TEXT NOT NULL, member_number TEXT, team TEXT DEFAULT '', coach_id TEXT, amount INTEGER NOT NULL CHECK(amount > 0), method TEXT NOT NULL, date TEXT NOT NULL, period_month TEXT NOT NULL, coverage_start TEXT, coverage_end TEXT, duration_months INTEGER DEFAULT 1, due_amount INTEGER DEFAULT 0, remaining_amount INTEGER DEFAULT 0, status TEXT DEFAULT 'مدفوع', notes TEXT DEFAULT '', collected_by TEXT DEFAULT 'مسؤول الخزينة', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), date TEXT NOT NULL, paid_to TEXT NOT NULL, coach_id TEXT, method TEXT NOT NULL, notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS coaches (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_url TEXT DEFAULT '', role TEXT NOT NULL, sport TEXT DEFAULT 'كيك بوكسينغ', teams TEXT DEFAULT '[]', phone TEXT DEFAULT '', monthly_salary INTEGER DEFAULT 4000, join_date TEXT NOT NULL, status TEXT DEFAULT 'نشط', sessions_count_this_month INTEGER DEFAULT 0, last_salary_paid_month TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS academy_settings (id INTEGER PRIMARY KEY CHECK (id = 1), academy_name TEXT NOT NULL, logo_text TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL, currency TEXT NOT NULL, current_season TEXT NOT NULL, whatsapp_notifications_enabled INTEGER DEFAULT 1, sms_alerts_enabled INTEGER DEFAULT 0, custom_logo_url TEXT DEFAULT '', color_theme TEXT DEFAULT 'classic-blue', primary_color TEXT DEFAULT '#2563eb', background_color TEXT DEFAULT '#020617', navbar_color TEXT DEFAULT '#0b1120', desktop_notifications_enabled INTEGER DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS monthly_archives (id TEXT PRIMARY KEY, month_key TEXT NOT NULL UNIQUE, month_label TEXT NOT NULL, archived_at TEXT NOT NULL, archived_by TEXT DEFAULT 'المدير العام (Admin)', total_income INTEGER NOT NULL DEFAULT 0, total_expenses INTEGER NOT NULL DEFAULT 0, net_profit INTEGER NOT NULL DEFAULT 0, payments_count INTEGER NOT NULL DEFAULT 0, expenses_count INTEGER NOT NULL DEFAULT 0, active_players_count INTEGER NOT NULL DEFAULT 0, overdue_players_count INTEGER NOT NULL DEFAULT 0, payments TEXT DEFAULT '[]', expenses TEXT DEFAULT '[]', notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT NOT NULL, operation TEXT NOT NULL, changed_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sync_tombstones (table_name TEXT NOT NULL, record_id TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY(table_name,record_id))`,
  `CREATE TABLE IF NOT EXISTS pending_password_change (id INTEGER PRIMARY KEY CHECK(id=1), old_secret TEXT NOT NULL, new_secret TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS system_backups (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, created_by TEXT, backup_type TEXT NOT NULL DEFAULT 'local', note TEXT)`,
  `CREATE TABLE IF NOT EXISTS app_notifications (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, timestamp TEXT NOT NULL, read INTEGER DEFAULT 0, category TEXT NOT NULL, meta TEXT DEFAULT '{}', is_trash INTEGER DEFAULT 0, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS idx_players_member_number ON players(member_number)`,
  `CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)`,
  `CREATE INDEX IF NOT EXISTS idx_players_status ON players(status)`,
  `CREATE INDEX IF NOT EXISTS idx_players_subscription_end ON players(subscription_end_date)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_player_date ON player_sessions(player_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_player_date ON payments(player_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_number)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`,
  `CREATE INDEX IF NOT EXISTS idx_coaches_name ON coaches(name)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_trash ON app_notifications(is_trash, timestamp)`,
];

export const defaultSettings = {
  academyName: 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ', logoText: 'IFC ACADEMY', phone: '+20 100 123 4567', email: 'info@ifc-academy.com', address: 'القاهرة الجديدة، التجمع الخامس - صالة النصر الأولمبية', currency: 'ج.م', currentSeason: 'موسم 2024 / 2025', whatsappNotificationsEnabled: true, smsAlertsEnabled: false, customLogoUrl: '', colorTheme: 'classic-blue', primaryColor: '#2563eb', backgroundColor: '#020617', navbarColor: '#0b1120', desktopNotificationsEnabled: true,
};

async function ensureColumn(db: Database, table: string, column: string, definition: string) {
  const columns = await db.select<any[]>(`PRAGMA table_info(${table})`);
  if (!columns.some(c => c.name === column)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function getDb() {
  if (!dbPromise) dbPromise = Database.load('sqlite:ifc_academy.db').then(async db => {
    await db.execute('PRAGMA foreign_keys = ON');
    for (const statement of schema) await db.execute(statement);
    // Safe migrations for databases created by earlier IFC Academy builds.
    await ensureColumn(db, 'payments', 'coverage_start', 'TEXT');
    await ensureColumn(db, 'payments', 'coverage_end', 'TEXT');
    await ensureColumn(db, 'payments', 'duration_months', 'INTEGER DEFAULT 1');
    await ensureColumn(db, 'payments', 'due_amount', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'payments', 'remaining_amount', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'app_notifications', 'is_trash', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'player_sessions', 'updated_at', "TEXT DEFAULT ''");
    await ensureColumn(db, 'payments', 'updated_at', "TEXT DEFAULT ''");
    await ensureColumn(db, 'expenses', 'updated_at', "TEXT DEFAULT ''");
    await ensureColumn(db, 'coaches', 'updated_at', "TEXT DEFAULT ''");
    await ensureColumn(db, 'monthly_archives', 'updated_at', "TEXT DEFAULT ''");
    await ensureColumn(db, 'app_notifications', 'updated_at', "TEXT DEFAULT ''");
    for (const [t,idcol] of [['players','id'],['player_sessions','id'],['payments','id'],['expenses','id'],['coaches','id'],['monthly_archives','id'],['app_notifications','id']] as const) { await db.execute(`UPDATE ${t} SET updated_at=COALESCE(NULLIF(updated_at,''),created_at) WHERE updated_at IS NULL OR updated_at=''`); }
    const syncTables = ['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','app_notifications'];
    for (const t of syncTables) {
      await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_ins AFTER INSERT ON ${t} BEGIN INSERT INTO sync_outbox(table_name,record_id,operation,changed_at) VALUES ('${t}',NEW.id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END`);
      await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_del AFTER DELETE ON ${t} BEGIN INSERT OR REPLACE INTO sync_tombstones(table_name,record_id,deleted_at) VALUES ('${t}',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); INSERT INTO sync_outbox(table_name,record_id,operation,changed_at) VALUES ('${t}',OLD.id,'delete',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END`);
      await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_upd AFTER UPDATE ON ${t} WHEN NEW.updated_at=OLD.updated_at BEGIN UPDATE ${t} SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.id; END`);
      await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_upd_queue AFTER UPDATE ON ${t} BEGIN INSERT INTO sync_outbox(table_name,record_id,operation,changed_at) VALUES ('${t}',NEW.id,'upsert',COALESCE(NULLIF(NEW.updated_at,''),strftime('%Y-%m-%dT%H:%M:%fZ','now'))); END`);
    }
    return db;
  });
  return dbPromise;
}

export async function initializeLocalDatabase() { await getDb(); await ensureAdmin(); await ensureSettings(); }

export function nowIso() { return new Date().toISOString(); }
export function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
export function json<T>(value: T | null | undefined, fallback: T): T { try { return value == null || value === '' ? fallback : typeof value === 'string' ? JSON.parse(value) : value as T; } catch { return fallback; } }
export function bool(v: unknown, fallback = false) { return v === undefined || v === null ? fallback : Boolean(Number(v)); }


let snapshotInFlight = false;
let snapshotTimer: number | undefined;
export function scheduleDatabaseSnapshot(delayMs = 1500) {
  if (snapshotTimer) window.clearTimeout(snapshotTimer);
  snapshotTimer = window.setTimeout(() => { void syncDatabaseSnapshot(); }, delayMs);
}
export async function syncDatabaseSnapshot() {
  if (snapshotInFlight) return;
  snapshotInFlight = true;
  try {
    const db = await getDb();
    try { await db.execute('PRAGMA wal_checkpoint(PASSIVE)'); } catch { /* SQLite may not use WAL; safe to continue. */ }
    await mkdir('IFC Academy Data', { baseDir: BaseDirectory.Document, recursive: true });
    let bytes: Uint8Array | null = null;
    // SQL plugin versions have historically resolved sqlite: paths through Tauri's app/config base.
    // Try the current app-data location first, then app-config as a compatibility fallback.
    for (const baseDir of [BaseDirectory.AppData, BaseDirectory.AppConfig, BaseDirectory.Data]) {
      try { bytes = await readFile('ifc_academy.db', { baseDir }); break; } catch { /* try next location */ }
    }
    if (!bytes) throw new Error('لم يتم العثور على ملف قاعدة SQLite الحية.');
    await writeFile('IFC Academy Data/ifc_academy.db', bytes, { baseDir: BaseDirectory.Document });
    const readme = new TextEncoder().encode('IFC Academy - Local SQLite Data\n\nThis folder contains the latest automatic snapshot of ifc_academy.db.\nThe live database is the application database; this copy is for client/developer inspection and backup.\n');
    await writeFile('IFC Academy Data/README_DATA.txt', readme, { baseDir: BaseDirectory.Document });
  } catch (error) {
    console.warn('Automatic local database snapshot failed:', error);
  } finally {
    snapshotInFlight = false;
  }
}

export async function ensureAdmin() {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM admin_credentials WHERE id = 1');
  if (!rows.length) {
    const h = await hashPassword('5555');
    await db.execute('INSERT INTO admin_credentials (id,username,password_hash,password_salt,updated_at) VALUES (1,?,?,?,?)', ['admin', h.hash, h.salt, nowIso()]);
  }
}

export async function ensureSettings() {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM academy_settings WHERE id = 1');
  if (!rows.length) {
    const s = defaultSettings;
    await db.execute(`INSERT INTO academy_settings (id,academy_name,logo_text,phone,email,address,currency,current_season,whatsapp_notifications_enabled,sms_alerts_enabled,custom_logo_url,color_theme,primary_color,background_color,navbar_color,desktop_notifications_enabled,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [1,s.academyName,s.logoText,s.phone,s.email,s.address,s.currency,s.currentSeason,s.whatsappNotificationsEnabled?1:0,s.smsAlertsEnabled?1:0,s.customLogoUrl,s.colorTheme,s.primaryColor,s.backgroundColor,s.navbarColor,s.desktopNotificationsEnabled?1:0,nowIso()]);
  }
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  const bytes = new Uint8Array(bits);
  const hex = (a: Uint8Array) => Array.from(a).map(x => x.toString(16).padStart(2,'0')).join('');
  return { hash: hex(bytes), salt: hex(salt) };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string) {
  const salt = new Uint8Array(storedSalt.match(/.{1,2}/g)?.map(x => parseInt(x,16)) || []);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  const actual = Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2,'0')).join('');
  return actual === storedHash;
}
