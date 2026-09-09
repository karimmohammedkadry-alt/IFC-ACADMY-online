import { supabaseServer } from '../lib/supabase-server.ts';
import {
  Player,
  SessionRecord,
  PaymentRecord,
  ExpenseRecord,
  Coach,
  AcademySettings,
  MonthlyArchiveRecord,
} from '../types.ts';

function fail(label: string, error: any): never {
  console.error(`Supabase query failed in ${label}:`, error);
  throw new Error(`${label} failed: ${error?.message || 'Supabase error'}`, { cause: error });
}

async function single<T>(table: string, id = 1): Promise<T | null> {
  const { data, error } = await supabaseServer.from(table).select('*').eq('id', id).maybeSingle();
  if (error) fail(`read ${table}`, error);
  return (data as T | null) ?? null;
}

// ----------------- ADMIN PROFILE / SUPABASE AUTH -----------------
export async function getAdminCredentials() {
  return single<any>('admin_credentials', 1);
}

export async function saveAdminCredentials(data: {
  username: string;
  authUserId?: string | null;
  authEmail?: string | null;
}) {
  const { error } = await supabaseServer.from('admin_credentials').upsert({
    id: 1,
    username: data.username,
    auth_user_id: data.authUserId ?? null,
    auth_email: data.authEmail ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) fail('save admin profile', error);
}

export async function updateAdminProfile(username: string, authUserId: string, authEmail: string) {
  const { error } = await supabaseServer.from('admin_credentials').update({
    username,
    auth_user_id: authUserId,
    auth_email: authEmail,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) fail('update admin profile', error);
}

// ----------------- PLAYERS -----------------
function mapSession(s: any): SessionRecord {
  return {
    id: s.id,
    sessionNumber: s.session_number,
    date: s.date,
    dayName: s.day_name,
    time: s.time,
    status: s.status || 'غائب',
    notes: s.notes || '',
  };
}

function mapPlayer(p: any, sessions: SessionRecord[]): Player {
  return {
    id: p.id,
    memberNumber: p.member_number,
    name: p.name,
    nationalId: p.national_id || '',
    paymentMethod: p.payment_method || 'كاش',
    birthDate: p.birth_date || '',
    notes: p.notes || '',
    avatarUrl: p.avatar_url || '',
    team: p.team,
    sport: p.sport || 'كيك بوكسينغ',
    trainingSchedule: p.training_schedule || [],
    subscriptionStartDate: p.subscription_start_date,
    subscriptionEndDate: p.subscription_end_date,
    totalSessions: p.total_sessions ?? 8,
    attendedSessions: p.attended_sessions ?? 0,
    absentSessions: p.absent_sessions ?? 0,
    attendanceRate: p.attendance_rate ?? 0,
    sessions,
    phone: p.phone || '',
    parentPhone: p.parent_phone || '',
    subscriptionPlan: p.subscription_plan || 'شهري',
    monthlyFee: p.monthly_fee ?? 500,
    subscriptionExpiry: p.subscription_expiry,
    status: p.status || 'نشط',
    joinDate: p.join_date,
  };
}

export async function getPlayers(): Promise<Player[]> {
  const [{ data: ps, error: pe }, { data: ss, error: se }] = await Promise.all([
    supabaseServer.from('players').select('*').order('member_number', { ascending: true }),
    supabaseServer.from('player_sessions').select('*').order('session_number', { ascending: true }),
  ]);
  if (pe) fail('get players', pe);
  if (se) fail('get player sessions', se);
  const byPlayer = new Map<string, SessionRecord[]>();
  for (const s of (ss || [])) {
    const list = byPlayer.get(s.player_id) || [];
    list.push(mapSession(s));
    byPlayer.set(s.player_id, list);
  }
  return (ps || []).map((p) => mapPlayer(p, byPlayer.get(p.id) || []));
}

async function getNextMemberNumber(): Promise<string> {
  const { data, error } = await supabaseServer.from('players').select('member_number');
  if (error) fail('generate member number', error);
  let max = 0;
  for (const row of data || []) {
    const value = String(row.member_number || '').trim();
    const match = value.match(/^IFC-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
    else if (/^\d+$/.test(value)) max = Math.max(max, Number(value));
  }
  return `IFC-${String(max + 1).padStart(3, '0')}`;
}

export async function createPlayer(playerData: Player): Promise<Player> {
  let isExistingId = Boolean(playerData.id);
  let id = playerData.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let memberNumber = String(playerData.memberNumber || '').trim();

  // Excel/manual imports often contain the member number but no internal UUID.
  // Resolve that member first so importing the same row updates the existing player
  // instead of creating a duplicate player with a new member number.
  if (!isExistingId && memberNumber) {
    const { data: existingByMember, error: memberLookupError } = await supabaseServer
      .from('players').select('id').eq('member_number', memberNumber).maybeSingle();
    if (memberLookupError) fail('find player by member number', memberLookupError);
    if (existingByMember?.id) {
      id = existingByMember.id;
      isExistingId = true;
    }
  }

  if (!memberNumber) memberNumber = await getNextMemberNumber();

  // Some older IFC databases were created before the optional birth_date column existed.
  // Do not let that legacy schema break player creation/import: try the full payload first,
  // then retry without birth_date only when PostgREST explicitly reports that column missing.
  let includeBirthDate = Boolean(playerData.birthDate);
  const payload = () => {
    const base: any = {
      id, member_number: memberNumber, name: playerData.name, national_id: playerData.nationalId || '',
      payment_method: playerData.paymentMethod || 'كاش', notes: playerData.notes || '',
      avatar_url: playerData.avatarUrl || '', team: playerData.team, sport: playerData.sport || 'كيك بوكسينغ',
      training_schedule: playerData.trainingSchedule || [], subscription_start_date: playerData.subscriptionStartDate,
      subscription_end_date: playerData.subscriptionEndDate, total_sessions: playerData.totalSessions ?? 8,
      attended_sessions: playerData.attendedSessions ?? 0, absent_sessions: playerData.absentSessions ?? 0,
      attendance_rate: playerData.attendanceRate ?? 0, phone: playerData.phone || '', parent_phone: playerData.parentPhone || '',
      subscription_plan: playerData.subscriptionPlan || 'شهري', monthly_fee: playerData.monthlyFee ?? 500,
      subscription_expiry: playerData.subscriptionExpiry, status: playerData.status || 'نشط', join_date: playerData.joinDate,
      updated_at: new Date().toISOString(),
    };
    if (includeBirthDate) base.birth_date = playerData.birthDate;
    return base;
  };

  let data: any = null;
  for (let attempt = 0; attempt < 7; attempt++) {
    const result = isExistingId
      ? await supabaseServer.from('players').upsert(payload(), { onConflict: 'id' }).select('*').single()
      : await supabaseServer.from('players').insert(payload()).select('*').single();
    if (!result.error) { data = result.data; break; }
    const code = result.error.code;
    const message = String(result.error.message || '').toLowerCase();
    // PGRST204 means PostgREST's schema cache cannot find the requested column.
    // The deployed legacy database is missing birth_date, so retry the same write without it.
    if (code === 'PGRST204' && message.includes('birth_date') && includeBirthDate) {
      includeBirthDate = false;
      continue;
    }
    if (code !== '23505') fail('create player', result.error);
    if (message.includes('member_number') || message.includes('players_member_number')) {
      memberNumber = await getNextMemberNumber();
    } else if (!isExistingId && (message.includes('players_pkey') || message.includes('duplicate key'))) {
      id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    } else {
      fail('create player', result.error);
    }
  }
  if (!data) throw new Error('تعذر حفظ اللاعب بعد عدة محاولات.');

  if (playerData.sessions?.length) {
    if (isExistingId) {
      const { error: de } = await supabaseServer.from('player_sessions').delete().eq('player_id', data.id);
      if (de) fail('replace imported player sessions', de);
    }
    const { error: se } = await supabaseServer.from('player_sessions').upsert(
      playerData.sessions.map((session) => ({
        id: session.id, player_id: data.id, session_number: session.sessionNumber, date: session.date,
        day_name: session.dayName, time: session.time, status: session.status, notes: session.notes || '',
      })), { onConflict: 'id' },
    );
    if (se) {
      if (!isExistingId) await supabaseServer.from('players').delete().eq('id', data.id);
      fail('save player sessions', se);
    }
  }
  return mapPlayer(data, playerData.sessions || []);
}

export async function updatePlayer(id: string, updates: Partial<Player>): Promise<void> {
  const payload: any = {};
  const map: Record<string, keyof Player> = {
    name: 'name', member_number: 'memberNumber', national_id: 'nationalId', payment_method: 'paymentMethod',
    notes: 'notes', avatar_url: 'avatarUrl', team: 'team', sport: 'sport',
    training_schedule: 'trainingSchedule', subscription_start_date: 'subscriptionStartDate', subscription_end_date: 'subscriptionEndDate',
    total_sessions: 'totalSessions', attended_sessions: 'attendedSessions', absent_sessions: 'absentSessions', attendance_rate: 'attendanceRate',
    phone: 'phone', parent_phone: 'parentPhone', subscription_plan: 'subscriptionPlan', monthly_fee: 'monthlyFee',
    subscription_expiry: 'subscriptionExpiry', status: 'status', join_date: 'joinDate',
  };
  for (const [column, key] of Object.entries(map)) {
    if ((updates as any)[key] !== undefined) payload[column] = column === 'member_number' ? String((updates as any)[key]) : (updates as any)[key];
  }
  payload.updated_at = new Date().toISOString();

  let oldSessions: any[] | null = null;
  if (updates.sessions) {
    const { data, error } = await supabaseServer.from('player_sessions').select('*').eq('player_id', id);
    if (error) fail('backup player sessions', error);
    oldSessions = data || [];
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabaseServer.from('players').update(payload).eq('id', id);
    if (!error) break;
    if (error.code === '23505' && String(error.message || '').toLowerCase().includes('member_number')) {
      payload.member_number = await getNextMemberNumber();
      continue;
    }
    fail('update player', error);
  }

  if (updates.sessions) {
    const { error: de } = await supabaseServer.from('player_sessions').delete().eq('player_id', id);
    if (de) fail('replace player sessions', de);
    if (updates.sessions.length) {
      const { error: ie } = await supabaseServer.from('player_sessions').insert(updates.sessions.map((s) => ({
        id: s.id, player_id: id, session_number: s.sessionNumber, date: s.date, day_name: s.dayName,
        time: s.time, status: s.status, notes: s.notes || '',
      })));
      if (ie) {
        await supabaseServer.from('player_sessions').delete().eq('player_id', id);
        if (oldSessions?.length) await supabaseServer.from('player_sessions').insert(oldSessions);
        fail('replace player sessions', ie);
      }
    }
  }
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabaseServer.from('players').delete().eq('id', id);
  if (error) fail('delete player', error);
}

export async function updateSessionAttendance(sessionId: string, playerId: string, status: 'حاضر' | 'غائب' | 'بعذر', notes?: string, sessionDate?: string): Promise<void> {
  const date = sessionDate || new Date().toISOString().split('T')[0];
  const { data: existing, error: readError } = await supabaseServer
    .from('player_sessions').select('session_number').eq('id', sessionId).eq('player_id', playerId).maybeSingle();
  if (readError) fail('check attendance session', readError);

  let sessionNumber = Number(existing?.session_number || 0);
  if (!sessionNumber) {
    const { data: lastSession, error: lastError } = await supabaseServer.from('player_sessions')
      .select('session_number').eq('player_id', playerId).order('session_number', { ascending: false }).limit(1).maybeSingle();
    if (lastError) fail('get attendance session number', lastError);
    sessionNumber = Number(lastSession?.session_number || 0) + 1;
  }

  // Atomic/idempotent by session id: two devices can submit the same attendance
  // simultaneously without one request failing on a duplicate primary key.
  const { error } = await supabaseServer.from('player_sessions').upsert({
    id: sessionId, player_id: playerId, session_number: sessionNumber, date,
    day_name: new Date(`${date}T00:00:00`).toLocaleDateString('ar-EG', { weekday: 'long' }),
    time: '5:00 م - 6:30 م', status, notes: notes || '', updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) fail('save attendance', error);
}

export async function bulkImportPlayers(players: Player[], collectedBy = 'مسؤول الخزينة', registerSubscriptions = true) {
  if (!players.length) return { saved: 0, updated: 0, payments: 0 };
  const clean = players.map((p) => ({ ...p, memberNumber: String(p.memberNumber || '').trim() }));
  const suppliedMembers = clean.map((p) => p.memberNumber).filter(Boolean);
  const existingMap = new Map<string, string>();
  if (suppliedMembers.length) {
    for (let i = 0; i < suppliedMembers.length; i += 200) {
      const batch = suppliedMembers.slice(i, i + 200);
      const { data, error } = await supabaseServer.from('players').select('id,member_number').in('member_number', batch);
      if (error) fail('bulk find players', error);
      for (const row of data || []) existingMap.set(String(row.member_number), String(row.id));
    }
  }

  // Generate missing member numbers in one pass.
  if (clean.some((p) => !p.memberNumber)) {
    const { data, error } = await supabaseServer.from('players').select('member_number');
    if (error) fail('bulk generate member numbers', error);
    let max = 0;
    for (const row of data || []) {
      const v = String(row.member_number || '');
      const m = v.match(/^IFC-(\d+)$/i) || v.match(/^(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    for (const p of clean) if (!p.memberNumber) p.memberNumber = `IFC-${String(++max).padStart(3, '0')}`;
  }

  const rows = clean.map((p) => {
    const member = String(p.memberNumber);
    const id = existingMap.get(member) || p.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return {
      id,
      member_number: member,
      name: p.name,
      national_id: p.nationalId || '',
      payment_method: p.paymentMethod || 'كاش',
      notes: p.notes || '',
      avatar_url: p.avatarUrl || '',
      team: p.team || 'براعم U-10',
      sport: p.sport || 'كيك بوكسينغ',
      training_schedule: p.trainingSchedule || [],
      subscription_start_date: p.subscriptionStartDate,
      subscription_end_date: p.subscriptionEndDate,
      total_sessions: p.totalSessions ?? 8,
      attended_sessions: p.attendedSessions ?? 0,
      absent_sessions: p.absentSessions ?? 0,
      attendance_rate: p.attendanceRate ?? 0,
      phone: p.phone || '',
      parent_phone: p.parentPhone || '',
      subscription_plan: p.subscriptionPlan || 'شهري',
      monthly_fee: p.monthlyFee ?? 500,
      subscription_expiry: p.subscriptionExpiry,
      status: p.status || 'نشط',
      join_date: p.joinDate,
      ...(p.birthDate ? { birth_date: p.birthDate } : {}),
      updated_at: new Date().toISOString(),
    };
  });

  // Supabase/PostgREST handles array upserts far more efficiently than N individual requests.
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabaseServer.from('players').upsert(chunk, { onConflict: 'member_number' });
    if (error) {
      // Legacy DBs may not have birth_date. Retry the whole chunk without it.
      if (error.code === 'PGRST204' && String(error.message || '').toLowerCase().includes('birth_date')) {
        const fallback = chunk.map(({ birth_date, ...row }) => row);
        const retry = await supabaseServer.from('players').upsert(fallback, { onConflict: 'member_number' });
        if (retry.error) fail('bulk import players', retry.error);
      } else fail('bulk import players', error);
    }
  }

  let paymentCount = 0;
  if (registerSubscriptions) {
    const newRows = clean.filter((p) => !existingMap.has(String(p.memberNumber)) && Number(p.monthlyFee || 0) > 0);
    const payments = newRows.map((p) => {
      const row = rows.find((r) => r.member_number === String(p.memberNumber))!;
      const now = new Date().toISOString();
      return {
        id: `pay-auto-import-${row.id}-${String(p.subscriptionStartDate || now.slice(0,10))}`.replace(/[^A-Za-z0-9_-]/g, '-'),
        invoice_number: `IMP-${row.id}-${String(p.subscriptionStartDate || now.slice(0,10)).replace(/-/g,'')}`,
        type: 'اشتراك لاعب', player_id: row.id, player_name: p.name,
        member_number: String(p.memberNumber), team: p.team || '', coach_id: null,
        amount: Number(p.monthlyFee || 0), method: p.paymentMethod || 'كاش',
        date: p.subscriptionStartDate || now.slice(0, 10), created_at: now,
        period_month: `اشتراك ${p.subscriptionStartDate || now.slice(0, 7)}`,
        status: 'مدفوع', notes: 'سداد اشتراك إضافة لاعب من Excel تلقائي', collected_by: collectedBy,
      };
    });
    for (let i = 0; i < payments.length; i += 100) {
      const { error } = await supabaseServer.from('payments').upsert(payments.slice(i, i + 100), { onConflict: 'id' });
      if (error) fail('bulk import player payments', error);
      paymentCount += Math.min(100, payments.length - i);
    }
  }
  return { saved: clean.length - existingMap.size + Math.min(existingMap.size, clean.length), updated: existingMap.size, payments: paymentCount };
}

export async function bulkImportCoaches(coaches: Coach[]) {
  if (!coaches.length) return { saved: 0 };
  const rows = coaches.map((c) => ({
    id: c.id || `coach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: c.name, avatar_url: c.avatarUrl || '', role: c.role || 'مدرب', sport: c.sport || 'كيك بوكسينغ',
    teams: c.teams || [], phone: c.phone || '', monthly_salary: c.monthlySalary ?? 4000,
    join_date: c.joinDate, status: c.status || 'نشط', sessions_count_this_month: c.sessionsCountThisMonth ?? 0,
    last_salary_paid_month: c.lastSalaryPaidMonth || null,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabaseServer.from('coaches').upsert(rows.slice(i, i + 100), { onConflict: 'id' });
    if (error) fail('bulk import coaches', error);
  }
  return { saved: rows.length };
}

// ----------------- PAYMENTS -----------------
export async function getPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabaseServer.from('payments').select('*').order('created_at', { ascending: false });
  if (error) fail('get payments', error);
  return (data || []).map((p) => ({
    id: p.id, invoiceNumber: p.invoice_number, type: p.type || 'اشتراك لاعب', playerId: p.player_id || undefined,
    playerName: p.player_name, memberNumber: p.member_number || undefined, team: p.team || undefined, coachId: p.coach_id || undefined,
    amount: p.amount, method: p.method || 'كاش', date: p.date, createdAt: p.created_at || (p.date ? `${p.date}T00:00:00` : undefined), periodMonth: p.period_month, status: p.status || 'مدفوع', notes: p.notes || '', collectedBy: p.collected_by || 'مسؤول الخزينة',
  }));
}
export async function createPayment(pay: PaymentRecord): Promise<PaymentRecord> {
  let invoiceNumber = String(pay.invoiceNumber || `INV-${Date.now()}`);
  const payload = () => ({
    id: pay.id, invoice_number: invoiceNumber, type: pay.type || 'اشتراك لاعب', player_id: pay.playerId || null,
    player_name: pay.playerName, member_number: pay.memberNumber ? String(pay.memberNumber) : null, team: pay.team || '', coach_id: pay.coachId || null,
    amount: pay.amount, method: pay.method, date: pay.date, created_at: pay.createdAt || new Date().toISOString(), period_month: pay.periodMonth, status: pay.status || 'مدفوع', notes: pay.notes || '', collected_by: pay.collectedBy || 'مسؤول الخزينة', updated_at: new Date().toISOString(),
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabaseServer.from('payments').upsert(payload(), { onConflict: 'id' });
    if (!error) return { ...pay, invoiceNumber };
    const message = String(error.message || '').toLowerCase();
    if (error.code === '23505' && (message.includes('invoice_number') || message.includes('payments_invoice_number'))) {
      invoiceNumber = `${pay.type === 'راتب مدرب' ? 'SAL' : 'INV'}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      continue;
    }
    fail('create payment', error);
  }
  throw new Error('تعذر إنشاء رقم إيصال فريد بعد عدة محاولات.');
}
export async function deletePayment(id: string): Promise<void> { const { error } = await supabaseServer.from('payments').delete().eq('id', id); if (error) fail('delete payment', error); }

// ----------------- EXPENSES -----------------
export async function getExpenses(): Promise<ExpenseRecord[]> {
  const { data, error } = await supabaseServer.from('expenses').select('*').order('created_at', { ascending: false });
  if (error) fail('get expenses', error);
  return (data || []).map((e) => ({ id: e.id, title: e.title, category: e.category || 'أخرى', amount: e.amount, date: e.date, paidTo: e.paid_to, coachId: e.coach_id || undefined, method: e.method || 'كاش', notes: e.notes || '' }));
}
export async function createExpense(exp: ExpenseRecord): Promise<ExpenseRecord> {
  let id = exp.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const row = () => ({ id, title: exp.title, category: exp.category, amount: exp.amount, date: exp.date, paid_to: exp.paidTo, coach_id: exp.coachId || null, method: exp.method, notes: exp.notes || '', updated_at: new Date().toISOString() });
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabaseServer.from('expenses').upsert(row(), { onConflict: 'id' });
    if (!error) return { ...exp, id };
    if (error.code === '23505') { id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; continue; }
    fail('create expense', error);
  }
  throw new Error('تعذر إنشاء رقم مصروف فريد بعد عدة محاولات.');
}
export async function deleteExpense(id: string): Promise<void> { const { error } = await supabaseServer.from('expenses').delete().eq('id', id); if (error) fail('delete expense', error); }

// ----------------- COACHES -----------------
export async function getCoaches(): Promise<Coach[]> {
  const { data, error } = await supabaseServer.from('coaches').select('*').order('name', { ascending: true });
  if (error) fail('get coaches', error);
  return (data || []).map((c) => ({ id: c.id, name: c.name, avatarUrl: c.avatar_url || '', role: c.role, sport: c.sport || 'كيك بوكسينغ', teams: c.teams || [], phone: c.phone || '', monthlySalary: c.monthly_salary ?? 4000, joinDate: c.join_date, status: c.status || 'نشط', sessionsCountThisMonth: c.sessions_count_this_month ?? 0, lastSalaryPaidMonth: c.last_salary_paid_month || undefined }));
}
export async function createCoach(c: Coach): Promise<Coach> {
  let id = c.id || `coach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const row = () => ({ id, name: c.name, avatar_url: c.avatarUrl || '', role: c.role, sport: c.sport || 'كيك بوكسينغ', teams: c.teams || [], phone: c.phone || '', monthly_salary: c.monthlySalary ?? 4000, join_date: c.joinDate, status: c.status || 'نشط', sessions_count_this_month: c.sessionsCountThisMonth ?? 0, last_salary_paid_month: c.lastSalaryPaidMonth || null, updated_at: new Date().toISOString() });
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabaseServer.from('coaches').upsert(row(), { onConflict: 'id' });
    if (!error) return { ...c, id };
    if (error.code === '23505') { id = `coach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; continue; }
    fail('create coach', error);
  }
  throw new Error('تعذر إنشاء معرف مدرب فريد بعد عدة محاولات.');
}
export async function updateCoach(id: string, u: Partial<Coach>): Promise<void> {
  const p: any = {}; if (u.name !== undefined) p.name = u.name; if (u.avatarUrl !== undefined) p.avatar_url = u.avatarUrl; if (u.role !== undefined) p.role = u.role; if (u.sport !== undefined) p.sport = u.sport; if (u.phone !== undefined) p.phone = u.phone; if (u.monthlySalary !== undefined) p.monthly_salary = u.monthlySalary; if (u.joinDate !== undefined) p.join_date = u.joinDate; if (u.status !== undefined) p.status = u.status; if (u.teams !== undefined) p.teams = u.teams; if (u.sessionsCountThisMonth !== undefined) p.sessions_count_this_month = u.sessionsCountThisMonth; if (u.lastSalaryPaidMonth !== undefined) p.last_salary_paid_month = u.lastSalaryPaidMonth; p.updated_at = new Date().toISOString();
  const { error } = await supabaseServer.from('coaches').update(p).eq('id', id); if (error) fail('update coach', error);
}
export async function deleteCoach(id: string): Promise<void> { const { error } = await supabaseServer.from('coaches').delete().eq('id', id); if (error) fail('delete coach', error); }


export async function getAcademyDataEpoch(): Promise<number> {
  const { data, error } = await supabaseServer.rpc('academy_data_epoch');
  if (error) fail('get academy data epoch', error);
  return Number(data || 1);
}

export async function getAcademySyncFingerprint(): Promise<string> {
  const { data, error } = await supabaseServer.rpc('academy_sync_fingerprint');
  if (error) fail('get academy sync fingerprint', error);
  return String(data || '');
}

export async function resetAcademyData(): Promise<{ success: boolean; deleted: Record<string, number> }> {
  const { data, error } = await supabaseServer.rpc('reset_academy_data');
  if (error) fail('reset academy data', error);
  return (data || { success: true, deleted: {} }) as { success: boolean; deleted: Record<string, number> };
}

// ----------------- SETTINGS -----------------
const defaultSettings: AcademySettings = {
  academyName: 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ', logoText: 'IFC ACADEMY', phone: '+20 100 123 4567', email: 'info@ifc-academy.com', address: 'القاهرة الجديدة، التجمع الخامس - صالة النصر الأولمبية', currency: 'ج.م', currentSeason: 'موسم 2024 / 2025', whatsappNotificationsEnabled: true, smsAlertsEnabled: false, customLogoUrl: '', colorTheme: 'classic-blue', primaryColor: '#2563eb', backgroundColor: '#020617', navbarColor: '#0b1120', desktopNotificationsEnabled: true,
};
function mapSettings(s: any): AcademySettings { return { academyName: s.academy_name || defaultSettings.academyName, logoText: s.logo_text || defaultSettings.logoText, phone: s.phone || defaultSettings.phone, email: s.email || defaultSettings.email, address: s.address || defaultSettings.address, currency: s.currency || defaultSettings.currency, currentSeason: s.current_season || defaultSettings.currentSeason, whatsappNotificationsEnabled: s.whatsapp_notifications_enabled ?? true, smsAlertsEnabled: s.sms_alerts_enabled ?? false, customLogoUrl: s.custom_logo_url || '', colorTheme: s.color_theme || 'classic-blue', primaryColor: s.primary_color || '#2563eb', backgroundColor: s.background_color || '#020617', navbarColor: s.navbar_color || '#0b1120', desktopNotificationsEnabled: s.desktop_notifications_enabled ?? true }; }
export async function getSettings(): Promise<AcademySettings> {
  const row = await single<any>('academy_settings', 1);
  if (row) return mapSettings(row);
  const { error } = await supabaseServer.from('academy_settings').insert({ id: 1, academy_name: defaultSettings.academyName, logo_text: defaultSettings.logoText, phone: defaultSettings.phone, email: defaultSettings.email, address: defaultSettings.address, currency: defaultSettings.currency, current_season: defaultSettings.currentSeason, whatsapp_notifications_enabled: true, sms_alerts_enabled: false, custom_logo_url: '', color_theme: 'classic-blue', primary_color: '#2563eb', background_color: '#020617', navbar_color: '#0b1120', desktop_notifications_enabled: true });
  if (error) fail('create default settings', error); return defaultSettings;
}
export async function updateSettings(s: AcademySettings): Promise<AcademySettings> {
  const { error } = await supabaseServer.from('academy_settings').upsert({ id: 1, academy_name: s.academyName, logo_text: s.logoText, phone: s.phone, email: s.email, address: s.address, currency: s.currency, current_season: s.currentSeason, whatsapp_notifications_enabled: s.whatsappNotificationsEnabled, sms_alerts_enabled: s.smsAlertsEnabled, custom_logo_url: s.customLogoUrl || '', color_theme: s.colorTheme || 'classic-blue', primary_color: s.primaryColor || '#2563eb', background_color: s.backgroundColor || '#020617', navbar_color: s.navbarColor || '#0b1120', desktop_notifications_enabled: s.desktopNotificationsEnabled ?? true, updated_at: new Date().toISOString() });
  if (error) fail('update settings', error); return s;
}

// ----------------- MONTHLY ARCHIVES -----------------
export async function getMonthlyArchives(): Promise<MonthlyArchiveRecord[]> {
  const { data, error } = await supabaseServer.from('monthly_archives').select('*').order('month_key', { ascending: false });
  if (error) fail('get monthly archives', error);
  return (data || []).map((a) => ({
    id: a.id,
    monthKey: a.month_key,
    monthLabel: a.month_label,
    archivedAt: a.archived_at,
    archivedBy: a.archived_by || 'المدير العام (Admin)',
    totalIncome: a.total_income,
    totalExpenses: a.total_expenses,
    netProfit: a.net_profit,
    paymentsCount: a.payments_count,
    expensesCount: a.expenses_count,
    activePlayersCount: a.active_players_count ?? 0,
    overduePlayersCount: a.overdue_players_count ?? 0,
    payments: a.payments || [],
    expenses: a.expenses || [],
    notes: a.notes || '',
  }));
}
export async function createMonthlyArchive(a: MonthlyArchiveRecord): Promise<MonthlyArchiveRecord> {
  const { error } = await supabaseServer.from('monthly_archives').upsert({
    id: a.id,
    month_key: a.monthKey,
    month_label: a.monthLabel,
    archived_at: a.archivedAt,
    archived_by: a.archivedBy || 'المدير العام (Admin)',
    total_income: a.totalIncome || 0,
    total_expenses: a.totalExpenses || 0,
    net_profit: a.netProfit || 0,
    payments_count: a.paymentsCount || 0,
    expenses_count: a.expensesCount || 0,
    active_players_count: a.activePlayersCount || 0,
    overdue_players_count: a.overduePlayersCount || 0,
    payments: a.payments || [],
    expenses: a.expenses || [],
    notes: a.notes || '',
  }, { onConflict: 'month_key' });
  if (error) fail('create monthly archive', error); return a;
}
export async function deleteMonthlyArchive(id: string): Promise<void> { const { error } = await supabaseServer.from('monthly_archives').delete().eq('id', id); if (error) fail('delete monthly archive', error); }
