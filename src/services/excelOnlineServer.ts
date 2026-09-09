import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { supabaseServer } from '../lib/supabase-server.ts';
import { getPlayers, getPayments, getExpenses, getCoaches, getSettings, getMonthlyArchives } from '../db/queries.ts';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const TENANT = process.env.MICROSOFT_TENANT_ID || 'common';
const APP_URL = process.env.APP_URL || '';
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${APP_URL.replace(/\/$/, '')}/api/excel/callback`;
const STATE_SECRET = process.env.EXCEL_OAUTH_STATE_SECRET || process.env.SUPABASE_SECRET_KEY || 'ifc-excel-state-secret';
const ENC_SECRET = process.env.EXCEL_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY || 'ifc-excel-token-secret';
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Files.ReadWrite'];

function requireConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !/^https?:\/\//i.test(REDIRECT_URI)) {
    throw new Error('تكامل Excel Online غير مكتمل على الخادم. أضف MICROSOFT_CLIENT_ID و MICROSOFT_CLIENT_SECRET و MICROSOFT_REDIRECT_URI و EXCEL_TOKEN_ENCRYPTION_KEY إلى متغيرات Railway.');
  }
}

function keyBytes() { return crypto.createHash('sha256').update(ENC_SECRET).digest(); }
function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}
function decrypt(value: string) {
  const [ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('تعذر قراءة مفتاح Excel المحفوظ.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createOAuthState(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60_000, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifyOAuthState(state: string) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('جلسة ربط Excel غير صالحة.');
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('جلسة ربط Excel غير صالحة.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.userId || Number(parsed.exp) < Date.now()) throw new Error('انتهت مهلة ربط Excel. اضغط ربط مرة أخرى.');
  return String(parsed.userId);
}

export function getMicrosoftLoginUrl(userId: string, email?: string) {
  requireConfigured();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state: createOAuthState(userId),
    prompt: 'select_account',
  });
  if (email?.trim()) params.set('login_hint', email.trim());
  return `https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams) {
  requireConfigured();
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(TENANT)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.error_description || 'تعذر الحصول على صلاحية Microsoft.');
  return data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

export async function exchangeCode(code: string) {
  return tokenRequest(new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code', scope: SCOPES.join(' ') }));
}

async function getConnection(userId: string) {
  const { data, error } = await supabaseServer.from('excel_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveConnection(userId: string, patch: Record<string, any>) {
  const { data, error } = await supabaseServer.from('excel_connections').upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('*').single();
  if (error) throw error;
  return data;
}

export async function saveMicrosoftConnection(userId: string, token: { access_token: string; refresh_token?: string }, email: string) {
  const old = await getConnection(userId);
  const refresh = token.refresh_token || (old?.refresh_token_enc ? decrypt(old.refresh_token_enc) : '');
  if (!refresh) throw new Error('Microsoft لم يرجع Refresh Token. تأكد من تفعيل offline_access في صلاحيات التطبيق.');
  return saveConnection(userId, { microsoft_email: email, refresh_token_enc: encrypt(refresh), drive_id: null, item_id: null, item_name: null, item_web_url: null, sync_hash: null, last_synced_at: null, last_sync_direction: null });
}

async function getAccessToken(userId: string) {
  const connection = await getConnection(userId);
  if (!connection) throw new Error('لم يتم ربط حساب Excel Online بعد.');
  const refresh = decrypt(connection.refresh_token_enc);
  const token = await tokenRequest(new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token', scope: SCOPES.join(' ') }));
  if (token.refresh_token && token.refresh_token !== refresh) await saveConnection(userId, { refresh_token_enc: encrypt(token.refresh_token) });
  return { token: token.access_token, connection };
}

async function graph(userId: string, path: string, init: RequestInit = {}) {
  const { token } = await getAccessToken(userId);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${GRAPH}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try { message = JSON.parse(body)?.error?.message || message; } catch {}
    throw new Error(`Microsoft Graph: ${message}`);
  }
  return res;
}

export async function getExcelConnectionStatus(userId: string) {
  const c = await getConnection(userId);
  if (!c) return { connected: false };
  return { connected: true, email: c.microsoft_email, workbook: c.item_id ? { id: c.item_id, name: c.item_name, webUrl: c.item_web_url, driveId: c.drive_id } : null, lastSyncedAt: c.last_synced_at, lastDirection: c.last_sync_direction, configured: Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI) };
}

export async function handleOAuthCallback(userId: string, code: string) {
  const token = await exchangeCode(code);
  const me = await (async () => {
    const res = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${token.access_token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'تعذر قراءة حساب Microsoft.');
    return data;
  })();
  const email = String(me.mail || me.userPrincipalName || '').trim();
  await saveMicrosoftConnection(userId, token, email);
  return { email };
}

export async function listWorkbooks(userId: string) {
  const res = await graph(userId, '/me/drive/root/children?$select=id,name,webUrl,file,folder,lastModifiedDateTime,size&$top=200');
  const data = await res.json();
  return (data.value || []).filter((item: any) => item.file?.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || String(item.name || '').toLowerCase().endsWith('.xlsx'));
}

export async function selectWorkbook(userId: string, itemId: string) {
  const res = await graph(userId, `/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,webUrl,parentReference,file,lastModifiedDateTime,size`);
  const item = await res.json();
  if (!item.file || !String(item.name || '').toLowerCase().endsWith('.xlsx')) throw new Error('اختر ملف Excel بصيغة .xlsx.');
  const driveId = item.parentReference?.driveId || 'me';
  return saveConnection(userId, { drive_id: driveId, item_id: item.id, item_name: item.name, item_web_url: item.webUrl || null, sync_hash: null, last_synced_at: null, last_sync_direction: null });
}

function normalizeRows(rows: any[]) {
  return (rows || []).map((row) => {
    const out: Record<string, any> = {};
    Object.keys(row || {}).forEach((k) => { out[k] = row[k] instanceof Date ? row[k].toISOString() : row[k]; });
    return out;
  });
}

async function buildWorkbookForAcademy() {
  const [players, payments, expenses, coaches, settings, archives] = await Promise.all([getPlayers(), getPayments(), getExpenses(), getCoaches(), getSettings(), getMonthlyArchives()]);
  const wb = XLSX.utils.book_new();
  const add = (rows: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(normalizeRows(rows || []));
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(players, 'اللاعبين'); add(payments, 'المدفوعات'); add(expenses, 'المصروفات'); add(coaches, 'المدربين'); add([], 'الحضور'); add([settings], 'الإعدادات'); add(archives, 'الأرشيف');
  return wb;
}

function workbookToSheets(buffer: ArrayBuffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, raw: true });
  const sheets: Record<string, any[]> = {};
  wb.SheetNames.forEach((name) => { sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true }); });
  return sheets;
}

async function downloadWorkbook(userId: string) {
  const c = await getConnection(userId);
  if (!c?.item_id) throw new Error('اختر ملف Excel أولاً.');
  const res = await graph(userId, `/me/drive/items/${encodeURIComponent(c.item_id)}/content`);
  return { buffer: await res.arrayBuffer(), connection: c };
}

async function uploadWorkbook(userId: string, wb: XLSX.WorkBook) {
  const c = await getConnection(userId);
  if (!c?.item_id) throw new Error('اختر ملف Excel أولاً.');
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  const res = await graph(userId, `/me/drive/items/${encodeURIComponent(c.item_id)}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: bytes });
  return res.json();
}

async function sha256(data: ArrayBuffer | Buffer) { return crypto.createHash('sha256').update(Buffer.from(data as any)).digest('hex'); }

export async function syncExcelOnline(userId: string, direction: 'system_to_excel' | 'excel_to_system' | 'auto' = 'auto') {
  const c = await getConnection(userId);
  if (!c?.item_id) throw new Error('اربط حساب Microsoft ثم اختر ملف Excel.');
  const current = await downloadWorkbook(userId);
  const currentHash = await sha256(current.buffer);
  if (direction === 'excel_to_system') {
    const sheets = workbookToSheets(current.buffer);
    await saveConnection(userId, { sync_hash: currentHash, last_synced_at: new Date().toISOString(), last_sync_direction: 'excel_to_system' });
    return { direction, hash: currentHash, sheets };
  }
  const wb = await buildWorkbookForAcademy();
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  const newHash = await sha256(bytes);
  if (direction === 'auto' && c.sync_hash) {
    const excelChanged = currentHash !== c.sync_hash;
    const systemChanged = newHash !== c.sync_hash;
    if (excelChanged && systemChanged) {
      return { direction: 'conflict', hash: currentHash, message: 'تم تعديل النظام وملف Excel معاً منذ آخر مزامنة. لم يتم استبدال أي طرف تلقائياً للحماية.' };
    }
    if (excelChanged && !systemChanged) {
      const sheets = workbookToSheets(current.buffer);
      await saveConnection(userId, { sync_hash: currentHash, last_synced_at: new Date().toISOString(), last_sync_direction: 'excel_to_system' });
      return { direction: 'excel_to_system', hash: currentHash, sheets };
    }
  }
  if (currentHash === newHash) {
    await saveConnection(userId, { sync_hash: currentHash, last_synced_at: new Date().toISOString(), last_sync_direction: 'none' });
    return { direction: 'none', hash: currentHash };
  }
  await graph(userId, `/me/drive/items/${encodeURIComponent(c.item_id)}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: bytes });
  await saveConnection(userId, { sync_hash: newHash, last_synced_at: new Date().toISOString(), last_sync_direction: 'system_to_excel' });
  return { direction: 'system_to_excel', hash: newHash };
}

export async function createWorkbook(userId: string, name = 'IFC_Academy.xlsx') {
  const safe = name.toLowerCase().endsWith('.xlsx') ? name : `${name}.xlsx`;
  const wb = await buildWorkbookForAcademy();
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  const res = await graph(userId, `/me/drive/root:/${encodeURIComponent(safe)}:/content`, { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: bytes });
  const item = await res.json();
  await saveConnection(userId, { drive_id: item.parentReference?.driveId || null, item_id: item.id, item_name: item.name, item_web_url: item.webUrl || null, sync_hash: await sha256(bytes), last_synced_at: new Date().toISOString(), last_sync_direction: 'system_to_excel' });
  return item;
}

export async function downloadExcelFile(userId: string) {
  const current = await downloadWorkbook(userId);
  return { buffer: current.buffer, name: current.connection.item_name || 'IFC_Academy.xlsx' };
}

export async function uploadExcelFile(userId: string, buffer: Buffer) {
  const c = await getConnection(userId);
  if (!c?.item_id) throw new Error('اختر ملف Excel أولاً.');
  const hash = await sha256(buffer);
  await graph(userId, `/me/drive/items/${encodeURIComponent(c.item_id)}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, body: buffer });
  await saveConnection(userId, { sync_hash: hash, last_synced_at: new Date().toISOString(), last_sync_direction: 'device_to_excel' });
  return { hash, name: c.item_name };
}

export async function disconnectExcel(userId: string) {
  const { error } = await supabaseServer.from('excel_connections').delete().eq('user_id', userId);
  if (error) throw error;
}
