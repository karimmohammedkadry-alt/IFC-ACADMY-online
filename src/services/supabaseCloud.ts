import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDb, nowIso } from './localDb';

declare const __IFC_SUPABASE_URL__: string;
declare const __IFC_SUPABASE_PUBLISHABLE_KEY__: string;
declare const __IFC_SUPABASE_AUTH_EMAIL__: string;
const URL=__IFC_SUPABASE_URL__||undefined, KEY=__IFC_SUPABASE_PUBLISHABLE_KEY__||undefined, AUTH_EMAIL=__IFC_SUPABASE_AUTH_EMAIL__||undefined;
const TABLES=['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','recycle_bin','app_notifications'];
let client:SupabaseClient|null=null, syncInFlight=false, passwordQueuePromise:Promise<void>|null=null;
export type CloudSyncResult={status:'synced'|'pulled'|'pushed'|'offline'|'not_configured'|'error';message:string;remoteUpdatedAt?:string};
function configured(){return Boolean(URL&&KEY&&AUTH_EMAIL)}
export function isCloudSyncConfigured(){return configured()}
export function getCloudSyncConfigStatus(){return{configured:configured(),hasUrl:Boolean(URL),hasPublishableKey:Boolean(KEY),authEmail:AUTH_EMAIL||''}}
export function isNetworkError(e:any){const s=Number(e?.status||e?.statusCode||0),m=String(e?.message||'').toLowerCase();return !s||/network|fetch|failed to fetch|offline|load failed|timeout|connection/.test(m)}
function getClient(){if(!configured())return null;if(!client)client=createClient(URL!,KEY!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});return client}
export async function getCloudAuthUser(){const sb=getClient();if(!sb)return null;const {data,error}=await sb.auth.getUser();if(error)throw error;return data.user||null}
export async function getCloudSession(){const sb=getClient();if(!sb)return{session:null};const {data,error}=await sb.auth.getSession();if(error)throw error;return{session:data.session}}
export async function cloudLogin(password:string){const sb=getClient();if(!sb||!AUTH_EMAIL)throw new Error('Supabase Auth غير مُعد.');const {data,error}=await sb.auth.signInWithPassword({email:AUTH_EMAIL,password});if(error)throw error;return data.session}
export async function cloudLogout(){const sb=getClient();if(sb)await sb.auth.signOut()}
export async function updateCloudUsername(username:string){const sb=getClient();if(!sb)return;const {error}=await sb.auth.updateUser({data:{username:username.trim()}});if(error)throw error}
async function ensureMeta(){const db=await getDb();await db.execute(`CREATE TABLE IF NOT EXISTS sync_meta (id INTEGER PRIMARY KEY CHECK(id=1), last_local_hash TEXT DEFAULT '', last_remote_updated_at TEXT DEFAULT '', last_sync_at TEXT DEFAULT '', last_status TEXT DEFAULT 'never')`);return db}
async function snapshot(){const db=await getDb();const out:Record<string,any>={};for(const t of TABLES)out[t]=await db.select<any[]>(`SELECT * FROM ${t}`);out._tombstones=await db.select<any[]>('SELECT table_name,record_id,deleted_at FROM sync_tombstones');return out}
async function hashText(text:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function localizeRow(table:string,r:any){
 const x={...r};
 const jsonCols:Record<string,string[]>={
  players:['training_schedule'],coaches:['teams'],monthly_archives:['payments','expenses','attendance'],
  recycle_bin:['payload','related'],app_notifications:['meta']
 };
 for(const c of jsonCols[table]||[])if(x[c]!==undefined&&typeof x[c]!=='string')x[c]=JSON.stringify(x[c]);
 if(table==='academy_settings')for(const c of ['whatsapp_notifications_enabled','sms_alerts_enabled','desktop_notifications_enabled'])if(x[c]!==undefined)x[c]=x[c]?1:0;
 if(table==='app_notifications')for(const c of ['read','is_trash'])if(x[c]!==undefined)x[c]=x[c]?1:0;
 return x;
}
async function replaceLocalSnapshot(payload:any,tombs:any[]){const db=await getDb();const clear=['app_notifications','monthly_archives','recycle_bin','player_sessions','players','payments','expenses','coaches'];await db.execute('BEGIN');try{for(const t of clear)await db.execute(`DELETE FROM ${t}`);await db.execute('DELETE FROM academy_settings');for(const t of TABLES)for(const r of payload?.[t]||[]){const cols=Object.keys(r);await db.execute(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,cols.map(c=>localizeRow(t,r)[c]))}await db.execute('DELETE FROM sync_tombstones');for(const x of tombs||[])await db.execute('INSERT OR REPLACE INTO sync_tombstones(table_name,record_id,deleted_at) VALUES (?,?,?)',[x.table_name,x.record_id,x.deleted_at]);await db.execute('DELETE FROM sync_outbox');await db.execute('COMMIT')}catch(e){try{await db.execute('ROLLBACK')}catch{}throw e}}
async function clearDirty(){await (await getDb()).execute('DELETE FROM sync_outbox')}
export async function syncCloud(localPassword?:string):Promise<CloudSyncResult>{
 if(!configured())return{status:'not_configured',message:'Supabase غير مُعد بعد.'};
 if(!navigator.onLine)return{status:'offline',message:'لا يوجد اتصال؛ تم حفظ التعديلات محليًا.'};
 if(syncInFlight)return{status:'synced',message:'المزامنة قيد التنفيذ.'};
 syncInFlight=true;
 try{
  const sb=getClient()!;let session=(await sb.auth.getSession()).data.session;
  if(!session&&localPassword){try{session=await cloudLogin(localPassword)}catch(e){if(isNetworkError(e))return{status:'offline',message:'تعذر الوصول إلى Supabase؛ سيستمر التطبيق محليًا.'};throw e}}
  if(!session)throw new Error('جلسة Supabase غير موجودة. سجّل الدخول مرة واحدة أثناء الاتصال بالإنترنت.');
  const db=await ensureMeta(), snap=await snapshot(), tombs=snap._tombstones||[];delete snap._tombstones;
  const localHash=await hashText(JSON.stringify({payload:snap,tombstones:tombs}));
  const res=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({payload:snap,tombstones:tombs})});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||`Cloud sync failed (HTTP ${res.status})`);
  const payload=data.payload||{}, remoteTombs=Array.isArray(data.tombstones)?data.tombstones:[], remoteHash=await hashText(JSON.stringify({payload,tombstones:remoteTombs}));
  if(remoteHash!==localHash)await replaceLocalSnapshot(payload,remoteTombs);else await clearDirty();
  await db.execute(`INSERT OR REPLACE INTO sync_meta VALUES (1,?,?,?,?,?)`,[remoteHash,data.syncedAt||nowIso(),nowIso(),remoteHash===localHash?'synced':'pulled']);
  return{status:remoteHash===localHash?'synced':'pulled',message:remoteHash===localHash?'SQLite وSupabase متزامنان.':'تم دمج البيانات مع Supabase وتنزيل الحالة الموحدة محليًا.',remoteUpdatedAt:data.syncedAt};
 }catch(e:any){if(isNetworkError(e))return{status:'offline',message:'الاتصال بالسحابة غير متاح؛ البيانات المحلية مستمرة في العمل.'};return{status:'error',message:e?.message||'فشلت المزامنة السحابية.'}}
 finally{syncInFlight=false}
}
const DB_NAME='ifc-academy-secure',STORE='keys';
async function keyStore():Promise<IDBDatabase>{return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function getDeviceKey(){const d=await keyStore();return new Promise<CryptoKey>((res,rej)=>{const tx=d.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),g=s.get('password-key');g.onsuccess=async()=>{if(g.result)return res(g.result);try{const k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);s.put(k,'password-key');res(k)}catch(e){rej(e)}};g.onerror=()=>rej(g.error)})}
async function encryptSecret(text:string){const k=await getDeviceKey(),iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text));return{iv:Array.from(iv),data:Array.from(new Uint8Array(data))}}
async function decryptSecret(v:any){const k=await getDeviceKey(),data=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv)},k,new Uint8Array(v.data));return new TextDecoder().decode(data)}
async function queuePassword(oldPassword:string,newPassword:string,username?:string){const db=await getDb(),oldSecret=await encryptSecret(oldPassword),newSecret=await encryptSecret(newPassword),current=(await db.select<any[]>('SELECT * FROM pending_password_change WHERE id=1'))[0];await db.execute(`INSERT OR REPLACE INTO pending_password_change (id,old_secret,new_secret,created_at,new_username) VALUES (?,?,?,?,?)`,[1,JSON.stringify(oldSecret),JSON.stringify(newSecret),current?.created_at||nowIso(),username||current?.new_username||''])}
async function flushPasswordQueue(){if(passwordQueuePromise)return passwordQueuePromise;passwordQueuePromise=(async()=>{const sb=getClient();if(!sb||!navigator.onLine)return;const db=await getDb(),q=(await db.select<any[]>('SELECT * FROM pending_password_change WHERE id=1'))[0];if(!q)return;const oldP=await decryptSecret(JSON.parse(q.old_secret)),newP=await decryptSecret(JSON.parse(q.new_secret));let session=(await sb.auth.getSession()).data.session;if(!session){try{session=await cloudLogin(oldP)}catch(e){if(isNetworkError(e))return;throw e}}const {error}=await sb.auth.updateUser({password:newP,data:q.new_username?{username:q.new_username}:undefined});if(error)throw new Error(`Cloud Auth: ${error.message}`);await db.execute('DELETE FROM pending_password_change WHERE id=1')})().finally(()=>{passwordQueuePromise=null});return passwordQueuePromise}
export async function changeCloudPassword(oldPassword:string,newPassword:string,username?:string,queueIfOffline=true){const sb=getClient();if(!sb||!navigator.onLine){if(queueIfOffline)await queuePassword(oldPassword,newPassword,username);return}let session=(await sb.auth.getSession()).data.session;if(!session){try{session=await cloudLogin(oldPassword)}catch(e){if(isNetworkError(e)){if(queueIfOffline)await queuePassword(oldPassword,newPassword,username);return}throw e}}const {error}=await sb.auth.updateUser({password:newPassword,data:{username:username?.trim()||undefined,passwordChangedAt:nowIso()}});if(error)throw new Error(`Cloud Auth: ${error.message}`);await (await getDb()).execute('DELETE FROM pending_password_change WHERE id=1')}
export async function flushPendingCloudChanges(localPassword?:string){await flushPasswordQueue();return syncCloud(localPassword)}
