import { Player, PaymentRecord, ExpenseRecord, Coach, AcademySettings, MonthlyArchiveRecord, SessionRecord, AppNotification } from '../types';
import { getDb, ensureAdmin, ensureSettings, defaultSettings, nowIso, id, json, bool, hashPassword, verifyPassword } from './localDb';
import { changeCloudPassword, cloudLogin, cloudLogout, getCloudAuthUser, updateCloudUsername, isCloudSyncConfigured, isNetworkError } from './supabaseCloud';

const AUTH_TOKEN_KEY = 'ifc_admin_session_token';
const AUTH_SESSION_KEY = 'ifc_auth_session_v2';
const DEFAULT_USER = { name:'المدير العام (Admin)', role:'مدير أكاديمية IFC', avatar:'', username:'admin', id:'local-admin' };

function saveLocalSession(user: any) { const token = crypto.randomUUID(); localStorage.setItem(AUTH_TOKEN_KEY, token); localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ authenticated:true, user, expiresAt:Date.now()+1000*60*60*24*30 })); return token; }
function getSessionUser() { try { const s=JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)||'null'); return s?.authenticated ? s.user : null; } catch { return null; } }
function requireSession() { if (!localStorage.getItem(AUTH_TOKEN_KEY) || !getSessionUser()) throw new Error('يرجى تسجيل الدخول أولاً.'); }
function validAmount(value: unknown) { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error('المبلغ يجب أن يكون رقمًا أكبر من صفر.'); return Math.round(n); }

const mapSession=(s:any):SessionRecord=>({id:s.id,sessionNumber:s.session_number,date:s.date,dayName:s.day_name||'',time:s.time||'',status:s.status||'غائب',notes:s.notes||''});
const mapPlayer=(p:any,sessions:SessionRecord[]):Player=>({id:p.id,memberNumber:p.member_number,name:p.name,nationalId:p.national_id||'',paymentMethod:p.payment_method||'كاش',birthDate:p.birth_date||'',notes:p.notes||'',avatarUrl:p.avatar_url||'',team:p.team,sport:p.sport||'كيك بوكسينغ',trainingSchedule:json<string[]>(p.training_schedule,[]),subscriptionStartDate:p.subscription_start_date,subscriptionEndDate:p.subscription_end_date,totalSessions:p.total_sessions??8,attendedSessions:p.attended_sessions??0,absentSessions:p.absent_sessions??0,attendanceRate:p.attendance_rate??0,sessions,phone:p.phone||'',parentPhone:p.parent_phone||'',subscriptionPlan:p.subscription_plan||'شهري',monthlyFee:p.monthly_fee??500,subscriptionExpiry:p.subscription_expiry,status:p.status||'نشط',joinDate:p.join_date});
const mapSettings=(s:any):AcademySettings=>({academyName:s.academy_name||defaultSettings.academyName,logoText:s.logo_text||defaultSettings.logoText,phone:s.phone||defaultSettings.phone,email:s.email||defaultSettings.email,address:s.address||defaultSettings.address,currency:s.currency||defaultSettings.currency,currentSeason:s.current_season||defaultSettings.currentSeason,whatsappNotificationsEnabled:bool(s.whatsapp_notifications_enabled,true),smsAlertsEnabled:bool(s.sms_alerts_enabled,false),customLogoUrl:s.custom_logo_url||'',colorTheme:s.color_theme||'classic-blue',primaryColor:s.primary_color||'#2563eb',backgroundColor:s.background_color||'#020617',navbarColor:s.navbar_color||'#0b1120',desktopNotificationsEnabled:bool(s.desktop_notifications_enabled,true)});
const mapNotification=(n:any):AppNotification=>({id:n.id,type:n.type,title:n.title,message:n.message,timestamp:n.timestamp,read:Boolean(Number(n.read)),category:n.category,meta:json(n.meta,{})});

export async function loginAdmin(username:string,password:string){
  await ensureAdmin();
  const db=await getDb();
  const local=(await db.select<any[]>('SELECT * FROM admin_credentials WHERE id=1'))[0];
  const entered=username.trim().toLowerCase();
  if(!entered||!password)throw new Error('اكتب اسم المستخدم وكلمة المرور.');
  const online=Boolean(navigator.onLine&&isCloudSyncConfigured());
  if(online){
    try{
      const session=await cloudLogin(password);
      const hadCloudUsername=Boolean(session?.user?.user_metadata?.username);
      const cloudUsername=String(session?.user?.user_metadata?.username||local?.username||'admin');
      if(entered!==cloudUsername.trim().toLowerCase()){
        await cloudLogout();
        throw new Error('اسم المستخدم غير صحيح.');
      }
      if(!hadCloudUsername){try{await updateCloudUsername(cloudUsername);}catch{}}
      const h=await hashPassword(password);
      await db.execute('UPDATE admin_credentials SET username=?,password_hash=?,password_salt=?,updated_at=? WHERE id=1',[cloudUsername,h.hash,h.salt,nowIso()]);
      const user={...DEFAULT_USER,username:cloudUsername};
      return {token:session.access_token,access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,user};
    }catch(error:any){
      if(!isNetworkError(error)){
        const msg=String(error?.message||'').toLowerCase();
        if(msg.includes('invalid login credentials')){
          throw new Error('Supabase Auth رفض بيانات الدخول. تأكد من وجود المستخدم admin@ifc.academy في Authentication > Users وأن كلمة المرور السحابية مطابقة لكلمة المرور الحالية. لا يتم الرجوع للقاعدة المحلية أثناء وجود اتصال حتى لا يتجاوز الدخول السحابي.');
        }
        if(msg.includes('email not confirmed')){
          throw new Error('حساب Supabase Auth غير مؤكد. افتح Authentication > Users ثم أكّد مستخدم admin@ifc.academy أو عطّل تأكيد البريد لهذا المستخدم.');
        }
        throw new Error(error?.message||'تعذر تسجيل الدخول إلى Supabase Auth.');
      }
    }
  }
  if(!local||entered!==String(local.username).toLowerCase()||!(await verifyPassword(password,local.password_hash,local.password_salt)))throw new Error('بيانات الدخول غير صحيحة');
  const user={...DEFAULT_USER,username:local.username};const token=saveLocalSession(user);return {token,access_token:token,refresh_token:token,expires_at:Math.floor(Date.now()/1000)+60*60*24*30,user};
}
export async function validateAdminSession(token:string){
  const cached=getSessionUser();
  if(navigator.onLine&&isCloudSyncConfigured()){
    try{const user=await (await import('./supabaseCloud')).getCloudAuthUser();if(!user)return{authenticated:false,networkError:false};const merged={...DEFAULT_USER,...cached,username:user.user_metadata?.username||cached?.username||'admin'};return{authenticated:true,user:merged,offline:false};}
    catch(e){if(!isNetworkError(e))return{authenticated:false,networkError:false};}
  }
  const valid=Boolean(token&&localStorage.getItem(AUTH_TOKEN_KEY)===token&&cached);return valid?{authenticated:true,user:cached,offline:true}:{authenticated:false,networkError:false};
}
export async function refreshAdminSession(refreshToken:string){
  const u=getSessionUser();
  if(!u||!refreshToken)throw new Error('جلسة الدخول غير صالحة');
  if(navigator.onLine&&isCloudSyncConfigured()){
    const cloud=await import('./supabaseCloud');
    const session=(await cloud.getCloudSession()).session;
    if(!session)throw new Error('جلسة Supabase غير موجودة.');
    return{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,user:u};
  }
  const token=localStorage.getItem(AUTH_TOKEN_KEY)||crypto.randomUUID();
  localStorage.setItem(AUTH_TOKEN_KEY,token);
  return{access_token:token,refresh_token:token,expires_at:Math.floor(Date.now()/1000)+60*60*24*30,user:u};
}
export async function logoutAdmin(_token:string){try{await cloudLogout();}catch{}localStorage.removeItem(AUTH_TOKEN_KEY);localStorage.removeItem(AUTH_SESSION_KEY);localStorage.removeItem('ifc_admin_refresh_token');}
export async function updateAdminCredentials(username:string,newPassword:string,currentPassword=''){requireSession();if(!username.trim())throw new Error('اسم المستخدم مطلوب');if(newPassword.length<6)throw new Error('كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل');if(isCloudSyncConfigured()&&!currentPassword)throw new Error('اكتب كلمة المرور الحالية حتى يمكن مزامنة تغيير الباسورد بأمان.');if(isCloudSyncConfigured())await changeCloudPassword(currentPassword,newPassword,username.trim(),true);const db=await getDb();const h=await hashPassword(newPassword);await db.execute('UPDATE admin_credentials SET username=?,password_hash=?,password_salt=?,updated_at=? WHERE id=1',[username.trim(),h.hash,h.salt,nowIso()]);const user={...DEFAULT_USER,username:username.trim()};saveLocalSession(user);return{success:true,user,username:user.username};}
export async function checkDatabaseStatus(){ requireSession(); await ensureSettings(); const db=await getDb(); const r=await db.select<any[]>('SELECT COUNT(*) AS c FROM players'); return {connected:true,type:'SQLite (Local)',academyName:(await fetchSettings()).academyName,playerCount:r[0]?.c||0}; }

export async function fetchPlayers(){ requireSession(); const db=await getDb(); const ps=await db.select<any[]>('SELECT * FROM players ORDER BY member_number COLLATE NOCASE'); const ss=await db.select<any[]>('SELECT * FROM player_sessions ORDER BY date DESC, session_number ASC'); const map=new Map<string,SessionRecord[]>(); ss.forEach(s=>{const a=map.get(s.player_id)||[];a.push(mapSession(s));map.set(s.player_id,a)}); return ps.map(p=>mapPlayer(p,map.get(p.id)||[])); }
async function nextMember(){ const db=await getDb(); const rows=await db.select<any[]>('SELECT member_number FROM players'); let max=0; for(const r of rows){const m=String(r.member_number||'').match(/^IFC-(\d+)$/i); if(m)max=Math.max(max,+m[1]); else if(/^\d+$/.test(String(r.member_number||'')))max=Math.max(max,+r.member_number);} return `IFC-${String(max+1).padStart(3,'0')}`; }
function playerRow(p:Player,idv:string,member:string){return [idv,member,p.name,p.nationalId||'',p.paymentMethod||'كاش',p.birthDate||'',p.notes||'',p.avatarUrl||'',p.team,p.sport||'كيك بوكسينغ',JSON.stringify(p.trainingSchedule||[]),p.subscriptionStartDate,p.subscriptionEndDate,p.totalSessions??8,p.attendedSessions??0,p.absentSessions??0,p.attendanceRate??0,p.phone||'',p.parentPhone||'',p.subscriptionPlan||'شهري',p.monthlyFee??500,p.subscriptionExpiry,p.status||'نشط',p.joinDate||new Date().toISOString().slice(0,10),nowIso(),nowIso()];}
async function upsertSessions(db:any,p:Player){ await db.execute('DELETE FROM player_sessions WHERE player_id=?',[p.id]); for(const s of p.sessions||[]) await db.execute('INSERT INTO player_sessions (id,player_id,session_number,date,day_name,time,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[s.id||id('session'),p.id,s.sessionNumber,s.date,s.dayName||'',s.time||'',s.status,s.notes||'',nowIso()]); }
export async function createPlayerApi(p:Player){requireSession(); const db=await getDb(); let member=String(p.memberNumber||'').trim(); if(!member) member=await nextMember(); let pid=p.id||id('player'); const existing=await db.select<any[]>('SELECT id FROM players WHERE member_number=?',[member]); if(existing[0] && !p.id) pid=existing[0].id; const vals=playerRow(p,pid,member); await db.execute(`INSERT INTO players (id,member_number,name,national_id,payment_method,birth_date,notes,avatar_url,team,sport,training_schedule,subscription_start_date,subscription_end_date,total_sessions,attended_sessions,absent_sessions,attendance_rate,phone,parent_phone,subscription_plan,monthly_fee,subscription_expiry,status,join_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET member_number=excluded.member_number,name=excluded.name,national_id=excluded.national_id,payment_method=excluded.payment_method,birth_date=excluded.birth_date,notes=excluded.notes,avatar_url=excluded.avatar_url,team=excluded.team,sport=excluded.sport,training_schedule=excluded.training_schedule,subscription_start_date=excluded.subscription_start_date,subscription_end_date=excluded.subscription_end_date,total_sessions=excluded.total_sessions,attended_sessions=excluded.attended_sessions,absent_sessions=excluded.absent_sessions,attendance_rate=excluded.attendance_rate,phone=excluded.phone,parent_phone=excluded.parent_phone,subscription_plan=excluded.subscription_plan,monthly_fee=excluded.monthly_fee,subscription_expiry=excluded.subscription_expiry,status=excluded.status,join_date=excluded.join_date,updated_at=excluded.updated_at`,vals); const saved={...p,id:pid,memberNumber:member}; if(p.sessions) await upsertSessions(db,saved); return saved; }
export async function updatePlayerApi(idv:string,u:Partial<Player>){ requireSession(); const db=await getDb(); const cur=(await db.select<any[]>('SELECT * FROM players WHERE id=?',[idv]))[0]; if(!cur) throw new Error('اللاعب غير موجود'); const data:any={memberNumber:u.memberNumber??cur.member_number,name:u.name??cur.name,nationalId:u.nationalId??cur.national_id,paymentMethod:u.paymentMethod??cur.payment_method,birthDate:u.birthDate??cur.birth_date,notes:u.notes??cur.notes,avatarUrl:u.avatarUrl??cur.avatar_url,team:u.team??cur.team,sport:u.sport??cur.sport,trainingSchedule:u.trainingSchedule??json(cur.training_schedule,[]),subscriptionStartDate:u.subscriptionStartDate??cur.subscription_start_date,subscriptionEndDate:u.subscriptionEndDate??cur.subscription_end_date,totalSessions:u.totalSessions??cur.total_sessions,attendedSessions:u.attendedSessions??cur.attended_sessions,absentSessions:u.absentSessions??cur.absent_sessions,attendanceRate:u.attendanceRate??cur.attendance_rate,phone:u.phone??cur.phone,parentPhone:u.parentPhone??cur.parent_phone,subscriptionPlan:u.subscriptionPlan??cur.subscription_plan,monthlyFee:u.monthlyFee??cur.monthly_fee,subscriptionExpiry:u.subscriptionExpiry??cur.subscription_expiry,status:u.status??cur.status,joinDate:u.joinDate??cur.join_date}; await db.execute(`UPDATE players SET member_number=?,name=?,national_id=?,payment_method=?,birth_date=?,notes=?,avatar_url=?,team=?,sport=?,training_schedule=?,subscription_start_date=?,subscription_end_date=?,total_sessions=?,attended_sessions=?,absent_sessions=?,attendance_rate=?,phone=?,parent_phone=?,subscription_plan=?,monthly_fee=?,subscription_expiry=?,status=?,join_date=?,updated_at=? WHERE id=?`,[String(data.memberNumber),data.name,data.nationalId||'',data.paymentMethod||'كاش',data.birthDate||'',data.notes||'',data.avatarUrl||'',data.team,data.sport||'كيك بوكسينغ',JSON.stringify(data.trainingSchedule||[]),data.subscriptionStartDate,data.subscriptionEndDate,data.totalSessions??8,data.attendedSessions??0,data.absentSessions??0,data.attendanceRate??0,data.phone||'',data.parentPhone||'',data.subscriptionPlan||'شهري',data.monthlyFee??500,data.subscriptionExpiry,data.status||'نشط',data.joinDate,nowIso(),idv]); if(u.sessions) await upsertSessions(db,{...data,id:idv,sessions:u.sessions} as Player); return {...data,id:idv,memberNumber:String(data.memberNumber)} as Player; }
async function putInRecycleBin(entityType:string, recordId:string, label:string, payload:any, related:any={}, deletedBy='المدير العام (Admin)'){
  const db=await getDb();
  await db.execute(`INSERT OR REPLACE INTO recycle_bin (id,entity_type,record_id,label,deleted_at,payload,related,deleted_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,[
    `trash-${entityType}-${recordId}`,entityType,recordId,label,nowIso(),JSON.stringify(payload||{}),JSON.stringify(related||{}),deletedBy,nowIso()
  ]);
}
async function recycleRecord(entityType:string, table:string, idv:string, label:string, deletedBy='المدير العام (Admin)', hardDelete=false){
  requireSession();
  const db=await getDb();
  const row=(await db.select<any[]>(`SELECT * FROM ${table} WHERE id=?`,[idv]))[0];
  if(!row)throw new Error('العنصر غير موجود.');
  const related:any={};
  if(table==='players'){
    related.sessions=await db.select<any[]>('SELECT * FROM player_sessions WHERE player_id=?',[idv]);
    related.payments=await db.select<any[]>('SELECT * FROM payments WHERE player_id=?',[idv]);
  }
  if(table==='coaches'){
    related.salaryPayments=await db.select<any[]>('SELECT * FROM payments WHERE coach_id=?',[idv]);
    related.expenses=await db.select<any[]>('SELECT * FROM expenses WHERE coach_id=?',[idv]);
  }
  if(!hardDelete) await putInRecycleBin(entityType,idv,label,row,related,deletedBy);
  await db.execute('BEGIN');
  try{
    if(table==='players'){
      await db.execute('DELETE FROM payments WHERE player_id=?',[idv]);
      await db.execute('DELETE FROM player_sessions WHERE player_id=?',[idv]);
    }
    if(table==='coaches'){
      await db.execute('DELETE FROM payments WHERE coach_id=?',[idv]);
      await db.execute('DELETE FROM expenses WHERE coach_id=?',[idv]);
    }
    await db.execute(`DELETE FROM ${table} WHERE id=?`,[idv]);
    await db.execute('COMMIT');
  }catch(e){
    try{await db.execute('ROLLBACK')}catch{}
    if(!hardDelete){try{await db.execute('DELETE FROM recycle_bin WHERE id=?',[`trash-${entityType}-${idv}`])}catch{}}
    throw e;
  }
}
async function hardDeleteRecord(table:string,idv:string){
  requireSession();
  const db=await getDb();
  await db.execute('BEGIN');
  try{
    if(table==='players'){
      await db.execute('DELETE FROM payments WHERE player_id=?',[idv]);
      await db.execute('DELETE FROM player_sessions WHERE player_id=?',[idv]);
    }
    if(table==='coaches'){
      await db.execute('DELETE FROM payments WHERE coach_id=?',[idv]);
      await db.execute('DELETE FROM expenses WHERE coach_id=?',[idv]);
    }
    await db.execute(`DELETE FROM ${table} WHERE id=?`,[idv]);
    await db.execute('COMMIT');
  }catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}
}
export async function fetchRecycleBin(){requireSession();const rows=await (await getDb()).select<any[]>('SELECT * FROM recycle_bin ORDER BY datetime(deleted_at) DESC');return rows.map(r=>({id:r.id,entityType:r.entity_type,recordId:r.record_id,label:r.label,deletedAt:r.deleted_at,payload:json<any>(r.payload,{}),related:json<any>(r.related,{})}));}
export async function restoreRecycleBinItem(idv:string){
  requireSession();
  const db=await getDb();
  const item=(await db.select<any[]>('SELECT * FROM recycle_bin WHERE id=?',[idv]))[0];
  if(!item)throw new Error('عنصر سلة المهملات غير موجود.');
  const payload=json<any>(item.payload,{}),related=json<any>(item.related,{}),table=String(item.entity_type);
  if(table==='academy_reset'){
    const tables=['app_notifications','player_sessions','players','payments','expenses','coaches','monthly_archives'];
    await db.execute('BEGIN');
    try{
      for(const t of tables) for(const row of payload[t]||[]){
        const copy={...row}; if('updated_at' in copy)copy.updated_at=nowIso();
        const cols=Object.keys(copy);
        await db.execute(`INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,cols.map(c=>copy[c]));
      }
      await db.execute('COMMIT');
    }catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}
    await db.execute('DELETE FROM recycle_bin WHERE id=?',[idv]);
    return{success:true,entityType:table,recordId:item.record_id};
  }
  const allowed=new Set(['players','payments','expenses','coaches','monthly_archives']);
  if(!allowed.has(table))throw new Error('هذا النوع لا يدعم الاسترجاع من السلة.');
  const cols=Object.keys(payload); if(!cols.length)throw new Error('بيانات العنصر المحذوف غير متاحة.');
  await db.execute('BEGIN');
  try{
    const copy={...payload}; if('updated_at' in copy)copy.updated_at=nowIso();
    await db.execute(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,cols.map(c=>copy[c]));
    if(table==='players'){
      for(const session of related.sessions||[]){
        const x={...session};if('updated_at' in x)x.updated_at=nowIso();const c=Object.keys(x);
        await db.execute(`INSERT OR REPLACE INTO player_sessions (${c.join(',')}) VALUES (${c.map(()=>'?').join(',')})`,c.map(k=>x[k]));
      }
      for(const payment of related.payments||[]){
        const x={...payment};if('updated_at' in x)x.updated_at=nowIso();const c=Object.keys(x);
        await db.execute(`INSERT OR REPLACE INTO payments (${c.join(',')}) VALUES (${c.map(()=>'?').join(',')})`,c.map(k=>x[k]));
      }
    }
    if(table==='coaches'){
      for(const payment of related.salaryPayments||[]){
        const x={...payment};if('updated_at' in x)x.updated_at=nowIso();const c=Object.keys(x);
        await db.execute(`INSERT OR REPLACE INTO payments (${c.join(',')}) VALUES (${c.map(()=>'?').join(',')})`,c.map(k=>x[k]));
      }
      for(const expense of related.expenses||[]){
        const x={...expense};if('updated_at' in x)x.updated_at=nowIso();const c=Object.keys(x);
        await db.execute(`INSERT OR REPLACE INTO expenses (${c.join(',')}) VALUES (${c.map(()=>'?').join(',')})`,c.map(k=>x[k]));
      }
    }
    await db.execute('DELETE FROM sync_tombstones WHERE table_name=? AND record_id=?',[table,item.record_id]);
    if(table==='players'){
      for(const session of related.sessions||[])await db.execute('DELETE FROM sync_tombstones WHERE table_name=? AND record_id=?',['player_sessions',session.id]);
      for(const payment of related.payments||[])await db.execute('DELETE FROM sync_tombstones WHERE table_name=? AND record_id=?',['payments',payment.id]);
    }
    if(table==='coaches'){
      for(const payment of related.salaryPayments||[])await db.execute('DELETE FROM sync_tombstones WHERE table_name=? AND record_id=?',['payments',payment.id]);
      for(const expense of related.expenses||[])await db.execute('DELETE FROM sync_tombstones WHERE table_name=? AND record_id=?',['expenses',expense.id]);
    }
    await db.execute('DELETE FROM recycle_bin WHERE id=?',[idv]);
    await db.execute('COMMIT');
    return{success:true,entityType:table,recordId:item.record_id};
  }catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}
}
export async function permanentlyDeleteRecycleBinItem(idv:string){requireSession();const db=await getDb();const item=(await db.select<any[]>('SELECT id FROM recycle_bin WHERE id=?',[idv]))[0];if(!item)throw new Error('العنصر غير موجود.');await db.execute('DELETE FROM recycle_bin WHERE id=?',[idv]);return{success:true};}
export async function emptyRecycleBin(){requireSession();const db=await getDb();await db.execute('DELETE FROM recycle_bin');return{success:true};}

export async function deletePlayerApi(idv:string, hardDelete=false){await recycleRecord('players','players',idv,'لاعب',getSessionUser()?.username||'المدير العام (Admin)',hardDelete);}
export async function updateSessionAttendanceApi(playerId:string,sessionId:string,status:'حاضر'|'غائب'|'بعذر',notes?:string,date?:string){ requireSession(); const db=await getDb(); const found=await db.select<any[]>('SELECT * FROM player_sessions WHERE id=? AND player_id=?',[sessionId,playerId]); if(found[0]) await db.execute('UPDATE player_sessions SET status=?,notes=?,date=? WHERE id=? AND player_id=?',[status,notes??found[0].notes,date??found[0].date,sessionId,playerId]); else await db.execute('INSERT INTO player_sessions (id,player_id,session_number,date,day_name,time,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[sessionId,playerId,1,date||new Date().toISOString().slice(0,10),'','',status,notes||'',nowIso()]); const counts=await db.select<any[]>('SELECT status,COUNT(*) c FROM player_sessions WHERE player_id=? GROUP BY status',[playerId]); let attended=0,absent=0; counts.forEach(r=>{if(r.status==='حاضر')attended=Number(r.c);if(r.status==='غائب')absent=Number(r.c)}); const total=Number((await db.select<any[]>('SELECT total_sessions FROM players WHERE id=?',[playerId]))[0]?.total_sessions)||Math.max(attended+absent,1); await db.execute('UPDATE players SET attended_sessions=?,absent_sessions=?,attendance_rate=?,updated_at=? WHERE id=?',[attended,absent,Math.round(attended/total*100),nowIso(),playerId]); }
export async function bulkImportPlayersApi(players:Player[], _collectedBy?:string){requireSession();const db=await getDb();let saved=0,updated=0;await db.execute('BEGIN');try{for(const p of players){const existing=(await db.select<any[]>('SELECT id FROM players WHERE member_number=?',[String(p.memberNumber)]))[0];await createPlayerApi(p);if(existing)updated++;else saved++;}await db.execute('COMMIT');return{saved,updated,payments:0};}catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}}

export async function fetchPayments(){ requireSession(); const rows=await (await getDb()).select<any[]>('SELECT * FROM payments ORDER BY datetime(created_at) DESC'); return rows.map(p=>({id:p.id,invoiceNumber:p.invoice_number,type:p.type||'اشتراك لاعب',playerId:p.player_id||undefined,playerName:p.player_name,memberNumber:p.member_number||undefined,team:p.team||undefined,coachId:p.coach_id||undefined,amount:Number(p.amount),method:p.method,date:p.date,createdAt:p.created_at,periodMonth:p.period_month,coverageStart:p.coverage_start||undefined,coverageEnd:p.coverage_end||undefined,durationMonths:Number(p.duration_months||1),dueAmount:Number(p.due_amount||p.amount),remainingAmount:Number(p.remaining_amount||0),status:p.status||'مدفوع',notes:p.notes||'',collectedBy:p.collected_by||'مسؤول الخزينة'} as PaymentRecord)); }
export async function createPaymentApi(p:PaymentRecord){ requireSession(); const db=await getDb(); const amount=validAmount(p.amount); if(!p.playerId && p.type!=='راتب مدرب') throw new Error('لا يمكن تسجيل اشتراك بدون ربطه بلاعب.'); if(!p.playerName?.trim()) throw new Error('اسم المستفيد مطلوب.'); const pid=p.id||id('pay'); let inv=(p.invoiceNumber||`${p.type==='راتب مدرب'?'SAL':'INV'}-${Date.now()}`).trim(); const exists=await db.select<any[]>('SELECT id FROM payments WHERE invoice_number=?',[inv]); if(exists[0]&&exists[0].id!==pid) throw new Error(`رقم الإيصال ${inv} مستخدم بالفعل. استخدم رقمًا مختلفًا.`); const due=validAmount(p.dueAmount ?? amount); const remaining=Math.max(0, due-amount); const duration=Math.max(1,Number(p.durationMonths||1)); await db.execute(`INSERT INTO payments (id,invoice_number,type,player_id,player_name,member_number,team,coach_id,amount,method,date,period_month,coverage_start,coverage_end,duration_months,due_amount,remaining_amount,status,notes,collected_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET invoice_number=excluded.invoice_number,type=excluded.type,player_id=excluded.player_id,player_name=excluded.player_name,member_number=excluded.member_number,team=excluded.team,coach_id=excluded.coach_id,amount=excluded.amount,method=excluded.method,date=excluded.date,period_month=excluded.period_month,coverage_start=excluded.coverage_start,coverage_end=excluded.coverage_end,duration_months=excluded.duration_months,due_amount=excluded.due_amount,remaining_amount=excluded.remaining_amount,status=excluded.status,notes=excluded.notes,collected_by=excluded.collected_by`,[pid,inv,p.type||'اشتراك لاعب',p.playerId||null,p.playerName.trim(),p.memberNumber?String(p.memberNumber):'',p.team||'',p.coachId||null,amount,p.method,p.date,p.periodMonth||'',p.coverageStart||null,p.coverageEnd||null,duration,due,remaining,p.status||'مدفوع',p.notes||'',p.collectedBy||'مسؤول الخزينة',p.createdAt||nowIso()]); return {...p,id:pid,invoiceNumber:inv,amount,dueAmount:due,remainingAmount:remaining,durationMonths:duration}; }
export async function deletePaymentApi(idv:string, hardDelete=false){const row=(await (await getDb()).select<any[]>('SELECT * FROM payments WHERE id=?',[idv]))[0];await recycleRecord('payments','payments',idv,row?.player_name||row?.invoice_number||'مدفوعات',getSessionUser()?.username||'المدير العام (Admin)',hardDelete);}

export async function fetchExpenses(){requireSession(); const rows=await (await getDb()).select<any[]>('SELECT * FROM expenses ORDER BY datetime(created_at) DESC'); return rows.map(e=>({id:e.id,title:e.title,category:e.category,amount:Number(e.amount),date:e.date,paidTo:e.paid_to,coachId:e.coach_id||undefined,method:e.method,notes:e.notes||'',receiptNumber:e.id,paymentMethod:e.method,recordedBy:'المدير العام'} as ExpenseRecord)); }
export async function createExpenseApi(e:ExpenseRecord){requireSession(); const db=await getDb(); const amount=validAmount(e.amount); const eid=e.id||id('exp'); await db.execute(`INSERT INTO expenses (id,title,category,amount,date,paid_to,coach_id,method,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,amount=excluded.amount,date=excluded.date,paid_to=excluded.paid_to,coach_id=excluded.coach_id,method=excluded.method,notes=excluded.notes`,[eid,e.title,e.category,amount,e.date,e.paidTo,e.coachId||null,e.method,e.notes||'',nowIso()]); return {...e,id:eid,amount}; }
export async function deleteExpenseApi(idv:string, hardDelete=false){const row=(await (await getDb()).select<any[]>('SELECT * FROM expenses WHERE id=?',[idv]))[0];await recycleRecord('expenses','expenses',idv,row?.title||'مصروف',getSessionUser()?.username||'المدير العام (Admin)',hardDelete);}

export async function fetchCoaches(){requireSession();const rows=await (await getDb()).select<any[]>('SELECT * FROM coaches ORDER BY name COLLATE NOCASE');return rows.map(c=>({id:c.id,name:c.name,avatarUrl:c.avatar_url||'',role:c.role,sport:c.sport||'كيك بوكسينغ',teams:json<string[]>(c.teams,[]),phone:c.phone||'',monthlySalary:Number(c.monthly_salary??4000),joinDate:c.join_date,status:c.status||'نشط',sessionsCountThisMonth:Number(c.sessions_count_this_month??0),lastSalaryPaidMonth:c.last_salary_paid_month||undefined} as Coach));}
export async function createCoachApi(c:Coach){requireSession();const db=await getDb();const salary=validAmount(c.monthlySalary||0);const cid=c.id||id('coach');await db.execute(`INSERT INTO coaches (id,name,avatar_url,role,sport,teams,phone,monthly_salary,join_date,status,sessions_count_this_month,last_salary_paid_month,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,avatar_url=excluded.avatar_url,role=excluded.role,sport=excluded.sport,teams=excluded.teams,phone=excluded.phone,monthly_salary=excluded.monthly_salary,join_date=excluded.join_date,status=excluded.status,sessions_count_this_month=excluded.sessions_count_this_month,last_salary_paid_month=excluded.last_salary_paid_month`,[cid,c.name,c.avatarUrl||'',c.role,c.sport||'كيك بوكسينغ',JSON.stringify(c.teams||[]),c.phone||'',salary,c.joinDate,c.status||'نشط',c.sessionsCountThisMonth??0,c.lastSalaryPaidMonth||null,nowIso()]);return{...c,id:cid,monthlySalary:salary};}
export async function bulkImportCoachesApi(coaches:Coach[]){requireSession();const db=await getDb();await db.execute('BEGIN');try{for(const c of coaches)await createCoachApi(c);await db.execute('COMMIT');return{saved:coaches.length};}catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}}
export async function updateCoachApi(idv:string,u:Partial<Coach>){const current=(await fetchCoaches()).find(c=>c.id===idv);if(!current)throw new Error('المدرب غير موجود');return createCoachApi({...current,...u,id:idv});}
export async function deleteCoachApi(idv:string, hardDelete=false){const row=(await (await getDb()).select<any[]>('SELECT * FROM coaches WHERE id=?',[idv]))[0];await recycleRecord('coaches','coaches',idv,row?.name||'مدرب',getSessionUser()?.username||'المدير العام (Admin)',hardDelete);}

export async function fetchSettings(){requireSession();await ensureSettings();const r=(await (await getDb()).select<any[]>('SELECT * FROM academy_settings WHERE id=1'))[0];return mapSettings(r);}
export async function updateSettingsApi(s:AcademySettings){requireSession();const db=await getDb();await db.execute(`UPDATE academy_settings SET academy_name=?,logo_text=?,phone=?,email=?,address=?,currency=?,current_season=?,whatsapp_notifications_enabled=?,sms_alerts_enabled=?,custom_logo_url=?,color_theme=?,primary_color=?,background_color=?,navbar_color=?,desktop_notifications_enabled=?,updated_at=? WHERE id=1`,[s.academyName,s.logoText,s.phone,s.email,s.address,s.currency,s.currentSeason,s.whatsappNotificationsEnabled?1:0,s.smsAlertsEnabled?1:0,s.customLogoUrl||'',s.colorTheme||'classic-blue',s.primaryColor||'#2563eb',s.backgroundColor||'#020617',s.navbarColor||'#0b1120',s.desktopNotificationsEnabled===false?0:1,nowIso()]);return s;}
export async function resetAcademyDataApi(){requireSession();const db=await getDb();const tables=['app_notifications','player_sessions','players','payments','expenses','coaches','monthly_archives'];const snapshot:any={};const deleted:any={};for(const t of tables){snapshot[t]=await db.select<any[]>(`SELECT * FROM ${t}`);deleted[t]=snapshot[t].length;}if(tables.some(t=>snapshot[t].length)){await putInRecycleBin('academy_reset',`reset-${Date.now()}`,'إعادة ضبط بيانات الأكاديمية',snapshot,{},getSessionUser()?.username||'المدير العام (Admin)');}await db.execute('BEGIN');try{for(const t of tables)await db.execute(`DELETE FROM ${t}`);await db.execute('COMMIT');}catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}return{success:true,deleted};}
export async function fetchMonthlyArchives(){requireSession();const rows=await (await getDb()).select<any[]>('SELECT * FROM monthly_archives ORDER BY month_key DESC');return rows.map(a=>({id:a.id,monthKey:a.month_key,monthLabel:a.month_label,archivedAt:a.archived_at,archivedBy:a.archived_by||'المدير العام (Admin)',totalIncome:Number(a.total_income||0),totalExpenses:Number(a.total_expenses||0),netProfit:Number(a.net_profit||0),paymentsCount:Number(a.payments_count||0),expensesCount:Number(a.expenses_count||0),activePlayersCount:Number(a.active_players_count||0),overduePlayersCount:Number(a.overdue_players_count||0),payments:json<PaymentRecord[]>(a.payments,[]),expenses:json<ExpenseRecord[]>(a.expenses,[]),attendance:json<any[]>(a.attendance,[]),attendanceCount:Number(a.attendance_count||0),presentCount:Number(a.present_count||0),absentCount:Number(a.absent_count||0),excusedCount:Number(a.excused_count||0),notes:a.notes||''}));}
export async function createMonthlyArchiveApi(a:MonthlyArchiveRecord){requireSession();const db=await getDb();await db.execute(`INSERT INTO monthly_archives (id,month_key,month_label,archived_at,archived_by,total_income,total_expenses,net_profit,payments_count,expenses_count,active_players_count,overdue_players_count,payments,expenses,attendance,attendance_count,present_count,absent_count,excused_count,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET month_key=excluded.month_key,month_label=excluded.month_label,archived_at=excluded.archived_at,archived_by=excluded.archived_by,total_income=excluded.total_income,total_expenses=excluded.total_expenses,net_profit=excluded.net_profit,payments_count=excluded.payments_count,expenses_count=excluded.expenses_count,active_players_count=excluded.active_players_count,overdue_players_count=excluded.overdue_players_count,payments=excluded.payments,expenses=excluded.expenses,attendance=excluded.attendance,attendance_count=excluded.attendance_count,present_count=excluded.present_count,absent_count=excluded.absent_count,excused_count=excluded.excused_count,notes=excluded.notes,updated_at=excluded.updated_at`,[a.id||id('archive'),a.monthKey,a.monthLabel,a.archivedAt,a.archivedBy||'المدير العام (Admin)',a.totalIncome,a.totalExpenses,a.netProfit,a.paymentsCount,a.expensesCount,a.activePlayersCount||0,a.overduePlayersCount||0,JSON.stringify(a.payments||[]),JSON.stringify(a.expenses||[]),JSON.stringify(a.attendance||[]),a.attendanceCount||0,a.presentCount||0,a.absentCount||0,a.excusedCount||0,a.notes||'',nowIso(),nowIso()]);return a;}
export async function appendHistoricalArchiveRecordsApi(monthKey:string, payments:PaymentRecord[]=[], expenses:ExpenseRecord[]=[], attendance:any[]=[]){
  requireSession();
  if(!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error('شهر الأرشيف غير صالح.');
  const db=await getDb();
  const row=(await db.select<any[]>('SELECT * FROM monthly_archives WHERE month_key=? LIMIT 1',[monthKey]))[0];
  const oldPayments=json<PaymentRecord[]>(row?.payments,[]), oldExpenses=json<ExpenseRecord[]>(row?.expenses,[]), oldAttendance=json<any[]>(row?.attendance,[]);
  const mergeById=(old:any[], incoming:any[])=>{const m=new Map(old.map(x=>[String(x.id),x]));for(const x of incoming){if(x?.id)m.set(String(x.id),x);else m.set(`generated-${Math.random()}`,x);}return [...m.values()];};
  const mergedPayments=mergeById(oldPayments,payments), mergedExpenses=mergeById(oldExpenses,expenses), mergedAttendance=mergeById(oldAttendance,attendance);
  const totalIncome=mergedPayments.reduce((n,p)=>n+Number(p.amount||0),0);
  const totalExpenses=mergedExpenses.reduce((n,e)=>n+Number(e.amount||0),0);
  const presentCount=mergedAttendance.filter(a=>a.status==='حاضر').length;
  const absentCount=mergedAttendance.filter(a=>a.status==='غائب').length;
  const excusedCount=mergedAttendance.filter(a=>a.status==='بعذر').length;
  const playersRows=await db.select<any[]>('SELECT status FROM players');
  const activePlayersCount=playersRows.filter(p=>p.status==='نشط').length;
  const overduePlayersCount=playersRows.filter(p=>p.status==='متأخر'||p.status==='منتهي').length;
  const now=nowIso();
  const archive:MonthlyArchiveRecord={
    id:row?.id||`arch-${monthKey}`,monthKey,monthLabel:new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('ar-EG',{month:'long',year:'numeric'}),
    archivedAt:row?.archived_at||now,archivedBy:row?.archived_by||getSessionUser()?.username||'المدير العام (Admin)',
    totalIncome,totalExpenses,netProfit:totalIncome-totalExpenses,paymentsCount:mergedPayments.length,expensesCount:mergedExpenses.length,
    activePlayersCount,overduePlayersCount,payments:mergedPayments,expenses:mergedExpenses,attendance:mergedAttendance,
    attendanceCount:mergedAttendance.length,presentCount,absentCount,excusedCount,notes:row?.notes||''
  };
  return createMonthlyArchiveApi(archive);
}

export async function finalizeMonthlyRollover(monthKeys:string[]){requireSession();const keys=[...new Set(monthKeys.filter(Boolean))];if(!keys.length)return{success:true};const db=await getDb();const marks=keys.map(()=>'?').join(',');await db.execute('BEGIN');try{await db.execute(`DELETE FROM payments WHERE substr(date,1,7) IN (${marks})`,keys);await db.execute(`DELETE FROM expenses WHERE substr(date,1,7) IN (${marks})`,keys);await db.execute(`DELETE FROM player_sessions WHERE substr(date,1,7) IN (${marks})`,keys);const players=await db.select<any[]>('SELECT id FROM players');for(const p of players){const counts=await db.select<any[]>('SELECT status,COUNT(*) c FROM player_sessions WHERE player_id=? GROUP BY status',[p.id]);let attended=0,absent=0;counts.forEach(r=>{if(r.status==='حاضر')attended=Number(r.c);if(r.status==='غائب')absent=Number(r.c)});const total=Number((await db.select<any[]>('SELECT total_sessions FROM players WHERE id=?',[p.id]))[0]?.total_sessions)||Math.max(attended+absent,1);await db.execute('UPDATE players SET attended_sessions=?,absent_sessions=?,attendance_rate=?,updated_at=? WHERE id=?',[attended,absent,Math.round(attended/total*100),nowIso(),p.id]);}await db.execute('UPDATE coaches SET sessions_count_this_month=0,updated_at=?',[nowIso()]);await db.execute('COMMIT');return{success:true,clearedMonths:keys};}catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}}
export async function deleteMonthlyArchiveApi(idv:string, hardDelete=false){const row=(await (await getDb()).select<any[]>('SELECT * FROM monthly_archives WHERE id=?',[idv]))[0];await recycleRecord('monthly_archives','monthly_archives',idv,row?.month_label||'أرشيف شهر',getSessionUser()?.username||'المدير العام (Admin)',hardDelete);}

// Notifications are now stored in SQLite, not only localStorage.
export async function fetchNotifications(){requireSession();const rows=await (await getDb()).select<any[]>('SELECT * FROM app_notifications WHERE is_trash=0 ORDER BY datetime(timestamp) DESC LIMIT 300');return rows.map(mapNotification);}
export async function fetchNotificationTrash(){requireSession();const rows=await (await getDb()).select<any[]>('SELECT * FROM app_notifications WHERE is_trash=1 ORDER BY datetime(timestamp) DESC LIMIT 300');return rows.map(mapNotification);}
export async function upsertNotificationApi(n:AppNotification,isTrash=false){requireSession();const db=await getDb();await db.execute(`INSERT INTO app_notifications (id,type,title,message,timestamp,read,category,meta,is_trash) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,message=excluded.message,timestamp=excluded.timestamp,read=excluded.read,category=excluded.category,meta=excluded.meta,is_trash=excluded.is_trash`,[n.id,n.type,n.title,n.message,n.timestamp,n.read?1:0,n.category,JSON.stringify(n.meta||{}),isTrash?1:0]);return n;}
export async function markNotificationReadApi(idv:string){requireSession();await (await getDb()).execute('UPDATE app_notifications SET read=1 WHERE id=?',[idv]);}
export async function markAllNotificationsReadApi(){requireSession();await (await getDb()).execute('UPDATE app_notifications SET read=1 WHERE is_trash=0');}
export async function moveNotificationToTrashApi(idv:string){requireSession();await (await getDb()).execute('UPDATE app_notifications SET is_trash=1 WHERE id=?',[idv]);}
export async function restoreNotificationApi(idv:string){requireSession();await (await getDb()).execute('UPDATE app_notifications SET is_trash=0 WHERE id=?',[idv]);}
export async function deleteNotificationPermanentlyApi(idv:string){requireSession();await (await getDb()).execute('DELETE FROM app_notifications WHERE id=?',[idv]);}
export async function clearNotificationsApi(){requireSession();await (await getDb()).execute('DELETE FROM app_notifications WHERE is_trash=0');}
export async function emptyNotificationTrash(){requireSession();await (await getDb()).execute('DELETE FROM app_notifications WHERE is_trash=1');return{success:true};}
