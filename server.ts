import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getPlayers,
  createPlayer,
  bulkImportPlayers,
  updatePlayer,
  deletePlayer,
  updateSessionAttendance,
  getPayments,
  createPayment,
  deletePayment,
  getExpenses,
  createExpense,
  deleteExpense,
  getCoaches,
  createCoach,
  bulkImportCoaches,
  updateCoach,
  deleteCoach,
  resetAcademyData,
  getAcademySyncFingerprint,
  getAcademyDataEpoch,
  refreshCurrentMonthArchive,
  getSettings,
  updateSettings,
  getMonthlyArchives,
  createMonthlyArchive,
  deleteMonthlyArchive,
  getAdminCredentials,
  saveAdminCredentials,
  updateAdminProfile,
} from './src/db/queries.ts';
import { supabaseServer, supabaseAuth } from './src/lib/supabase-server.ts';
import { getMicrosoftLoginUrl, verifyOAuthState, handleOAuthCallback, getExcelConnectionStatus, listWorkbooks, selectWorkbook, createWorkbook, syncExcelOnline, disconnectExcel, downloadExcelFile, uploadExcelFile } from './src/services/excelOnlineServer.ts';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = '5555';
const ADMIN_AUTH_EMAIL = 'admin@ifc-academy.com';

function getBearerToken(req: express.Request) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function ensureAdminCredentialsTable() {
  try {
    let existing = await getAdminCredentials();
    if (!existing) {
      const { data, error } = await supabaseServer.auth.admin.createUser({
        email: ADMIN_AUTH_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: DEFAULT_ADMIN_USERNAME, role: 'admin' },
      });
      if (error || !data.user) throw error || new Error('Unable to create Supabase Auth admin');
      await saveAdminCredentials({ username: DEFAULT_ADMIN_USERNAME, authUserId: data.user.id, authEmail: ADMIN_AUTH_EMAIL });
      return;
    }

    if (existing.auth_user_id) {
      const { data } = await supabaseServer.auth.admin.getUserById(existing.auth_user_id);
      if (data.user) return;
    }

    const email = existing.auth_email || ADMIN_AUTH_EMAIL;
    const { data: users, error: listError } = await supabaseServer.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (listError) throw listError;
    const existingAuthUser = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingAuthUser) {
      await saveAdminCredentials({ username: existing.username || DEFAULT_ADMIN_USERNAME, authUserId: existingAuthUser.id, authEmail: email });
      return;
    }

    const { data, error } = await supabaseServer.auth.admin.createUser({
      email,
      password: DEFAULT_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { username: existing.username || DEFAULT_ADMIN_USERNAME, role: 'admin' },
    });
    if (error || !data.user) throw error || new Error('Unable to create Supabase Auth admin');
    await saveAdminCredentials({ username: existing.username || DEFAULT_ADMIN_USERNAME, authUserId: data.user.id, authEmail: email });
  } catch (error: any) {
    throw new Error('Supabase Auth is not ready. Run the updated sql/supabase_schema.sql in Supabase SQL Editor.', { cause: error });
  }
}

export async function createApp() {
  const app = express();

  // Do not block the HTTP server from starting if Supabase is temporarily unavailable.
  // Health checks can still pass, while authenticated routes will report the actual issue.
  try {
    await ensureAdminCredentialsTable();
  } catch (error) {
    console.error('Initial Supabase Auth setup failed; authenticated routes may be unavailable until Supabase is ready.', error);
  }
  // Lightweight security/performance middleware: avoid unnecessary framework dependencies.
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  // Bulk Excel imports can legitimately exceed Express' small default JSON limit.
  app.use(express.json({ limit: '25mb' }));

  // ----------------- MICROSOFT EXCEL ONLINE / ONEDRIVE -----------------
  app.get('/api/excel/status', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await getExcelConnectionStatus(req.user!.id)); }
    catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر قراءة حالة Excel Online.' }); }
  });

  app.get('/api/excel/connect', requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = String(req.query.email || '').trim();
      res.redirect(getMicrosoftLoginUrl(req.user!.id, email));
    } catch (error: any) {
      res.status(500).send(`<html dir="rtl"><body style="font-family:Arial;padding:40px"><h2>تعذر بدء ربط Excel Online</h2><p>${String(error?.message || '').replace(/[<>]/g,'')}</p></body></html>`);
    }
  });

  app.get('/api/excel/callback', async (req, res) => {
    try {
      const userId = verifyOAuthState(String(req.query.state || ''));
      const code = String(req.query.code || '');
      if (!code) throw new Error('لم يتم استلام رمز Microsoft.');
      const result = await handleOAuthCallback(userId, code);
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      res.redirect(`${base.replace(/\/$/, '')}/?excel=connected&email=${encodeURIComponent(result.email || '')}`);
    } catch (error: any) {
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      res.redirect(`${base.replace(/\/$/, '')}/?excel=error&message=${encodeURIComponent(error?.message || 'تعذر ربط Microsoft Excel')}`);
    }
  });

  app.get('/api/excel/workbooks', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await listWorkbooks(req.user!.id)); }
    catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر قراءة ملفات Excel من OneDrive.' }); }
  });

  app.post('/api/excel/workbook/select', requireAuth, async (req: AuthRequest, res) => {
    try {
      const itemId = String(req.body?.itemId || '').trim();
      if (!itemId) return res.status(400).json({ error: 'itemId مطلوب.' });
      res.json(await selectWorkbook(req.user!.id, itemId));
    } catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر اختيار ملف Excel.' }); }
  });

  app.post('/api/excel/workbook/create', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await createWorkbook(req.user!.id, String(req.body?.name || 'IFC_Academy.xlsx'))); }
    catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر إنشاء ملف Excel.' }); }
  });

  app.post('/api/excel/sync', requireAuth, async (req: AuthRequest, res) => {
    try { res.json(await syncExcelOnline(req.user!.id, String(req.body?.direction || 'auto') as any)); }
    catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر مزامنة Excel Online.' }); }
  });

  app.get('/api/excel/download', requireAuth, async (req: AuthRequest, res) => {
    try {
      const file = await downloadExcelFile(req.user!.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=\"${encodeURIComponent(file.name)}\"`);
      res.send(Buffer.from(file.buffer));
    } catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر تنزيل ملف Excel.' }); }
  });

  app.post('/api/excel/upload', requireAuth, async (req: AuthRequest, res) => {
    try {
      const raw = String(req.body?.base64 || '');
      if (!raw) return res.status(400).json({ error: 'لم يتم إرسال ملف Excel.' });
      const clean = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      const buffer = Buffer.from(clean, 'base64');
      if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'ملف Excel كبير جداً. الحد الحالي 12MB.' });
      res.json(await uploadExcelFile(req.user!.id, buffer));
    } catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر رفع ملف Excel إلى OneDrive.' }); }
  });

  app.post('/api/excel/disconnect', requireAuth, async (req: AuthRequest, res) => {
    try { await disconnectExcel(req.user!.id); res.json({ success: true }); }
    catch (error: any) { res.status(500).json({ error: error?.message || 'تعذر فصل Excel Online.' }); }
  });

  // ----------------- HEALTH & DB STATUS -----------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: 'Supabase (PostgreSQL)',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/db-status', requireAuth, async (_req, res) => {
    try {
      const settings = await getSettings();
      res.json({
        connected: true,
        type: 'Supabase (PostgreSQL)',
        academyName: settings.academyName,
      });
    } catch (error: any) {
      console.error('Database connection test failed:', error);
      res.status(500).json({
        connected: false,
        error: error.message || 'Database unavailable',
      });
    }
  });


  // ----------------- SUPABASE AUTH -----------------
  app.post('/api/auth/login', async (req, res) => {
    try {
      await ensureAdminCredentialsTable();
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      const credentials = await getAdminCredentials();
      if (!credentials?.auth_email || !credentials?.auth_user_id || username.toLowerCase() !== String(credentials.username || '').toLowerCase()) {
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.' });
      }

      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: credentials.auth_email,
        password,
      });
      if (error || !data.session || !data.user) {
        return res.status(401).json({ error: 'بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.' });
      }

      await supabaseServer.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...(data.user.user_metadata || {}), username: credentials.username, role: 'admin' },
      });

      res.json({
        token: data.session.access_token,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: { name: 'المدير العام (Admin)', role: 'مدير أكاديمية IFC', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', username: credentials.username, id: data.user.id },
      });
    } catch (error: any) {
      console.error('Supabase Auth login failed:', error);
      res.status(500).json({ error: 'تعذر تنفيذ تسجيل الدخول عبر Supabase.' });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    try {
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ authenticated: false });
      const { data, error } = await supabaseServer.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ authenticated: false });
      const credentials = await getAdminCredentials();
      if (!credentials || credentials.auth_user_id !== data.user.id) return res.status(401).json({ authenticated: false });
      res.json({ authenticated: true, user: { name: 'المدير العام (Admin)', role: 'مدير أكاديمية IFC', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', username: credentials.username, id: data.user.id } });
    } catch {
      res.status(401).json({ authenticated: false });
    }
  });

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const refreshToken = String(req.body?.refresh_token || '');
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required.' });
      const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session || !data.user) return res.status(401).json({ error: 'جلسة الدخول انتهت.' });
      const credentials = await getAdminCredentials();
      if (!credentials || credentials.auth_user_id !== data.user.id) return res.status(401).json({ error: 'جلسة الدخول غير صالحة.' });
      res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at, user: { name: 'المدير العام (Admin)', role: 'مدير أكاديمية IFC', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', username: credentials.username, id: data.user.id } });
    } catch (error: any) {
      res.status(401).json({ error: error?.message || 'تعذر تجديد الجلسة.' });
    }
  });

  app.post('/api/auth/logout', async (_req, res) => {
    // Supabase JWTs are stateless. Clearing the browser session is the logout action for this single-admin app.
    res.json({ success: true });
  });

  app.put('/api/auth/credentials', async (req, res) => {
    try {
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ error: 'جلسة الدخول غير صالحة.' });
      const { data: authData, error: authError } = await supabaseServer.auth.getUser(token);
      if (authError || !authData.user) return res.status(401).json({ error: 'جلسة الدخول غير صالحة.' });
      const current = await getAdminCredentials();
      if (!current?.auth_user_id || current.auth_user_id !== authData.user.id) return res.status(401).json({ error: 'ليس لديك صلاحية تغيير بيانات الدخول.' });

      const username = String(req.body?.username || '').trim();
      const newPassword = String(req.body?.newPassword || '');
      if (!username) return res.status(400).json({ error: 'اسم المستخدم مطلوب.' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل.' });

      const { error: updateError } = await supabaseServer.auth.admin.updateUserById(authData.user.id, {
        password: newPassword,
        user_metadata: { ...(authData.user.user_metadata || {}), username, role: 'admin' },
      });
      if (updateError) throw updateError;
      await updateAdminProfile(username, authData.user.id, current.auth_email || ADMIN_AUTH_EMAIL);
      res.json({ success: true, username });
    } catch (error: any) {
      console.error('Failed to update Supabase Auth credentials:', error);
      res.status(500).json({ error: error?.message || 'تعذر حفظ بيانات الدخول.' });
    }
  });

  // All academy data endpoints require a valid Supabase Auth session. Login/health endpoints stay public.
  app.use('/api', requireAuth);

  app.get('/api/sync-fingerprint', async (_req, res) => {
    try {
      res.json({ fingerprint: await getAcademySyncFingerprint(), epoch: await getAcademyDataEpoch() });
    } catch (error: any) {
      console.error('Failed to fetch sync fingerprint:', error);
      res.status(500).json({ error: error.message || 'تعذر فحص حالة المزامنة' });
    }
  });

  app.post('/api/archives/current/sync', async (req: AuthRequest, res) => {
    try {
      const archive = await refreshCurrentMonthArchive(String(req.body?.archivedBy || 'المدير العام (Admin)'));
      res.json(archive);
    } catch (error: any) {
      console.error('Failed to refresh current month archive:', error);
      res.status(500).json({ error: error.message || 'تعذر تحديث أرشيف الشهر الحالي' });
    }
  });

  // ----------------- PLAYERS API -----------------
  app.get('/api/players', async (_req, res) => {
    try {
      const playersList = await getPlayers();
      res.json(playersList);
    } catch (error: any) {
      console.error('Failed to fetch players:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch players' });
    }
  });

  app.post('/api/players/bulk', async (req: AuthRequest, res) => {
    try {
      const players = Array.isArray(req.body?.players) ? req.body.players : [];
      if (!players.length) return res.status(400).json({ error: 'لا توجد بيانات لاعبين للاستيراد.' });
      if (players.length > 5000) return res.status(413).json({ error: 'ملف الاستيراد كبير جدًا. الحد الأقصى 5000 لاعب في العملية الواحدة.' });
      const result = await bulkImportPlayers(players, String(req.body?.collectedBy || 'مسؤول الخزينة'), req.body?.registerSubscriptions !== false);
      let archive = null; try { archive = await refreshCurrentMonthArchive(String(req.body?.collectedBy || 'مسؤول الخزينة')); } catch (e) { console.warn('Archive refresh after player bulk skipped:', e); }
      res.json({ success: true, ...result, archive });
    } catch (error: any) {
      console.error('Failed bulk player import:', error);
      res.status(500).json({ error: error.message || 'تعذر استيراد اللاعبين بالجملة' });
    }
  });

  app.post('/api/players', async (req: AuthRequest, res) => {
    try {
      const newPlayer = await createPlayer(req.body);
      res.status(201).json(newPlayer);
    } catch (error: any) {
      console.error('Failed to create player:', error);
      res.status(500).json({ error: error.message || 'Failed to create player' });
    }
  });

  app.put('/api/players/:id', async (req: AuthRequest, res) => {
    try {
      await updatePlayer(req.params.id, req.body);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to update player:', error);
      res.status(500).json({ error: error.message || 'Failed to update player' });
    }
  });

  app.delete('/api/players/:id', async (req: AuthRequest, res) => {
    try {
      await deletePlayer(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to delete player:', error);
      res.status(500).json({ error: error.message || 'Failed to delete player' });
    }
  });

  app.put('/api/players/:playerId/sessions/:sessionId', async (req: AuthRequest, res) => {
    try {
      const { playerId, sessionId } = req.params;
      const { status, notes } = req.body;
      await updateSessionAttendance(sessionId, playerId, status, notes, req.body?.date);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update session attendance:', error);
      res.status(500).json({ error: error.message || 'Failed to update attendance' });
    }
  });

  // ----------------- PAYMENTS API -----------------
  app.get('/api/payments', async (_req, res) => {
    try {
      const paymentsList = await getPayments();
      res.json(paymentsList);
    } catch (error: any) {
      console.error('Failed to fetch payments:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch payments' });
    }
  });

  app.post('/api/payments', async (req: AuthRequest, res) => {
    try {
      const newPayment = await createPayment(req.body);
      let archive = null; try { archive = await refreshCurrentMonthArchive(String(req.body?.collectedBy || 'مسؤول الخزينة')); } catch (e) { console.warn('Archive refresh after payment skipped:', e); }
      res.status(201).json({ ...newPayment, archive });
    } catch (error: any) {
      console.error('Failed to record payment:', error);
      res.status(500).json({ error: error.message || 'Failed to record payment' });
    }
  });

  app.delete('/api/payments/:id', async (req: AuthRequest, res) => {
    try {
      await deletePayment(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to delete payment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete payment' });
    }
  });

  // ----------------- EXPENSES API -----------------
  app.get('/api/expenses', async (_req, res) => {
    try {
      const expensesList = await getExpenses();
      res.json(expensesList);
    } catch (error: any) {
      console.error('Failed to fetch expenses:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', async (req: AuthRequest, res) => {
    try {
      const newExpense = await createExpense(req.body);
      let archive = null; try { archive = await refreshCurrentMonthArchive(String(req.body?.recordedBy || 'المدير العام (Admin)')); } catch (e) { console.warn('Archive refresh after expense skipped:', e); }
      res.status(201).json({ ...newExpense, archive });
    } catch (error: any) {
      console.error('Failed to record expense:', error);
      res.status(500).json({ error: error.message || 'Failed to record expense' });
    }
  });

  app.delete('/api/expenses/:id', async (req: AuthRequest, res) => {
    try {
      await deleteExpense(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to delete expense:', error);
      res.status(500).json({ error: error.message || 'Failed to delete expense' });
    }
  });

  // ----------------- COACHES API -----------------
  app.get('/api/coaches', async (_req, res) => {
    try {
      const coachesList = await getCoaches();
      res.json(coachesList);
    } catch (error: any) {
      console.error('Failed to fetch coaches:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch coaches' });
    }
  });

  app.post('/api/coaches/bulk', async (req: AuthRequest, res) => {
    try {
      const coaches = Array.isArray(req.body?.coaches) ? req.body.coaches : [];
      if (!coaches.length) return res.status(400).json({ error: 'لا توجد بيانات مدربين للاستيراد.' });
      if (coaches.length > 5000) return res.status(413).json({ error: 'ملف الاستيراد كبير جدًا. الحد الأقصى 5000 مدرب في العملية الواحدة.' });
      const result = await bulkImportCoaches(coaches);
      let archive = null; try { archive = await refreshCurrentMonthArchive('المدير العام (Admin)'); } catch (e) { console.warn('Archive refresh after coach bulk skipped:', e); }
      res.json({ success: true, ...result, archive });
    } catch (error: any) {
      console.error('Failed bulk coach import:', error);
      res.status(500).json({ error: error.message || 'تعذر استيراد المدربين بالجملة' });
    }
  });

  app.post('/api/coaches', async (req: AuthRequest, res) => {
    try {
      const newCoach = await createCoach(req.body);
      let archive = null; try { archive = await refreshCurrentMonthArchive('المدير العام (Admin)'); } catch (e) { console.warn('Archive refresh after coach create skipped:', e); }
      res.status(201).json({ ...newCoach, archive });
    } catch (error: any) {
      console.error('Failed to create coach:', error);
      res.status(500).json({ error: error.message || 'Failed to create coach' });
    }
  });

  app.put('/api/coaches/:id', async (req: AuthRequest, res) => {
    try {
      await updateCoach(req.params.id, req.body);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to update coach:', error);
      res.status(500).json({ error: error.message || 'Failed to update coach' });
    }
  });

  app.delete('/api/coaches/:id', async (req: AuthRequest, res) => {
    try {
      await deleteCoach(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to delete coach:', error);
      res.status(500).json({ error: error.message || 'Failed to delete coach' });
    }
  });

  // ----------------- ACADEMY RESET API -----------------
  // Destructive by design: removes academy operational data but keeps admin credentials and settings.
  app.post('/api/reset-academy-data', async (_req: AuthRequest, res) => {
    try {
      // The SQL function uses a transaction + advisory lock so a reset cannot race
      // with another device's sync/write and partially clear the academy.
      const result = await resetAcademyData();
      res.json(result);
    } catch (error: any) {
      console.error('Failed to reset academy data:', error);
      res.status(500).json({ error: error.message || 'تعذر تصفير بيانات الأكاديمية' });
    }
  });

  // ----------------- SETTINGS API -----------------
  app.get('/api/settings', async (_req, res) => {
    try {
      const settings = await getSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch settings' });
    }
  });

  app.put('/api/settings', async (req: AuthRequest, res) => {
    try {
      const updated = await updateSettings(req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      res.status(500).json({ error: error.message || 'Failed to update settings' });
    }
  });

  // ----------------- MONTHLY ARCHIVES API -----------------
  app.get('/api/archives', async (_req, res) => {
    try {
      try { await refreshCurrentMonthArchive('المدير العام (Admin)'); } catch (archiveRefreshError) { console.warn('Current archive refresh during read skipped:', archiveRefreshError); }
      const list = await getMonthlyArchives();
      res.json(list);
    } catch (error: any) {
      console.error('Failed to fetch monthly archives:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch archives' });
    }
  });

  app.post('/api/archives', async (req: AuthRequest, res) => {
    try {
      const created = await createMonthlyArchive(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create monthly archive:', error);
      res.status(500).json({ error: error.message || 'Failed to create archive' });
    }
  });

  app.delete('/api/archives/:id', async (req: AuthRequest, res) => {
    try {
      await deleteMonthlyArchive(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      console.error('Failed to delete monthly archive:', error);
      res.status(500).json({ error: error.message || 'Failed to delete archive' });
    }
  });

  // ----------------- VITE MIDDLEWARE / STATIC FILES -----------------
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

let appPromise: Promise<express.Express> | undefined;

export function getApp() {
  appPromise ??= createApp();
  return appPromise;
}

// Railway/Render run this file as a long-lived Node server. Vercel imports the
// Express app through api/index.ts and manages the HTTP lifecycle itself.
if (!process.env.VERCEL) {
  getApp().then((app) => {
    const PORT = Number(process.env.PORT || 3000);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT} with Supabase connected.`);
    });
  }).catch((err) => {
    console.error('Failed to start server:', err);
    process.exitCode = 1;
  });
}
