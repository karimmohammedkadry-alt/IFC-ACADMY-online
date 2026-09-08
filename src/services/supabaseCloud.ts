import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDb, nowIso } from './localDb';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const AUTH_EMAIL = import.meta.env.VITE_SUPABASE_AUTH_EMAIL as string | undefined;
const META_ID = 1;
const TABLES = ['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','recycle_bin','app_notifications'];
let client: SupabaseClient | null = null;
let syncInFlight = false;
let passwordQueuePromise: Promise<void> | null = null;

export type CloudSyncResult = { status:'synced'|'pulled'|'pushed'|'offline'|'not_configured'|'error'; message:string; remoteUpdatedAt?:string };
function configured(){ return Boolean(URL && KEY && AUTH_EMAIL); }
export function isCloudSyncConfigured(){ return configured(); }
export function isNetworkError(error:any){ const status=Number(error?.status||error?.statusCode||0); const msg=String(error?.message||'').toLowerCase(); return !status || /network|fetch|failed to fetch|offline|load failed|timeout|connection/.test(msg); }
function getClient(){ if(!configured()) return null; if(!client)client=createClient(URL!,KEY!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}); return client; }
export async function getCloudAuthUser(){const sb=getClient();if(!sb)return null;const {data,error}=await sb.auth.getUser();if(error)throw error;return data.user||null;}
export async function getCloudSession(){const sb=getClient();if(!sb)return{session:null};const {data,error}=await sb.auth.getSession();if(error)throw error;return{session:data.session};}
export async function cloudLogin(password:string){const sb=getClient();if(!sb||!AUTH_EMAIL)throw new Error('Supabase Auth غير مُعد.');const {data,error}=await sb.auth.signInWithPassword({email:AUTH_EMAIL,password});if(error)throw error;return data.session;}
export async function cloudLogout(){const sb=getClient();if(sb)await sb.auth.signOut();}
export async function updateCloudUsername(username:string){const sb=getClient();if(!sb)return;const {error}=await sb.auth.updateUser({data:{username:username.trim()}});if(error)throw error;}
function deviceId(){const k='ifc_cloud_device_id';let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID();localStorage.setItem(k,v);}return v;}
async function hashText(text:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function ensureMeta(){const db=await getDb();await db.execute(`CREATE TABLE IF NOT EXISTS sync_meta (id INTEGER PRIMARY KEY CHECK(id=1), last_local_hash TEXT DEFAULT '', last_remote_updated_at TEXT DEFAULT '', last_sync_at TEXT DEFAULT '', last_status TEXT DEFAULT 'never')`);return db;}
async function snapshot(){const db=await getDb();const out:Record<string,any[]|any>={};for(const t of TABLES)out[t]=await db.select<any[]>(`SELECT * FROM ${t}`);out._tombstones=await db.select<any[]>('SELECT table_name,record_id,deleted_at FROM sync_tombstones');return out;}
function rowId(_table:string,row:any){return String(row.id);}
function timeOf(row:any){const raw=row.updated_at||row.archived_at||row.timestamp||row.created_at||'1970-01-01';const n=new Date(raw).getTime();return Number.isFinite(n)?n:0;}
function mergePayload(local:any,remote:any){const merged:Record<string,any[]>={};for(const t of TABLES){const lm=new Map((local?.[t]||[]).map((r:any)=>[rowId(t,r),r]));const rm=new Map((remote?.[t]||[]).map((r:any)=>[rowId(t,r),r]));const ids=new Set([...lm.keys(),...rm.keys()]);merged[t]=[];for(const k of ids){const a=lm.get(k),b=rm.get(k);if(!a)merged[t].push(b);else if(!b)merged[t].push(a);else merged[t].push(timeOf(a)>=timeOf(b)?a:b);}}
  const tombMap=new Map<string,any>();for(const x of [...(local?._tombstones||[]),...(remote?._tombstones||[])]){const k=`${x.table_name}:${x.record_id}`,old=tombMap.get(k);if(!old||new Date(x.deleted_at).getTime()>new Date(old.deleted_at).getTime())tombMap.set(k,x);}merged._tombstones=[...tombMap.values()];for(const t of TABLES)merged[t]=merged[t].filter((r:any)=>{const tomb=tombMap.get(`${t}:${rowId(t,r)}`);return !tomb||timeOf(r)>new Date(tomb.deleted_at).getTime();});return merged;}
async function replaceLocalSnapshot(payload:any){const db=await getDb();const clear=['app_notifications','monthly_archives','recycle_bin','player_sessions','players','payments','expenses','coaches'];await db.execute('BEGIN');try{for(const t of clear)await db.execute(`DELETE FROM ${t}`);await db.execute('DELETE FROM academy_settings');for(const t of TABLES){for(const r of payload?.[t]||[]){const cols=Object.keys(r);const marks=cols.map(()=>'?').join(',');await db.execute(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${marks})`,cols.map(c=>r[c]));}}await db.execute('DELETE FROM sync_tombstones');for(const x of payload?._tombstones||[])await db.execute('INSERT OR REPLACE INTO sync_tombstones(table_name,record_id,deleted_at) VALUES (?,?,?)',[x.table_name,x.record_id,x.deleted_at]);await db.execute('DELETE FROM sync_outbox');await db.execute('COMMIT');}catch(e){try{await db.execute('ROLLBACK')}catch{}throw e;}}
async function clearDirty(){const db=await getDb();await db.execute('DELETE FROM sync_outbox');}
async function readCloudState(sb:SupabaseClient){const {data,error}=await sb.from('academy_cloud_state').select('id,payload,updated_at,updated_by,device_id,version').eq('id',META_ID).maybeSingle();if(error)throw new Error(`Cloud read: ${error.message}`);return data;}
async function writeCloudState(sb:SupabaseClient,session:any,payload:any,version:number){
  const row={id:META_ID,payload,updated_at:nowIso(),updated_by:session.user.id,device_id:deviceId(),version};
  // Optimistic locking: never overwrite a newer device snapshot. If another
  // device changed the row first, return a conflict so syncCloud can re-read
  // and merge instead of losing data.
  if(version>1){
    const {data,error}=await sb.from('academy_cloud_state').update(row).eq('id',META_ID).eq('version',version-1).select('id,payload,updated_at,version').maybeSingle();
    if(error)throw new Error(`Cloud upload: ${error.message}`);
    if(!data)throw new Error('CLOUD_VERSION_CONFLICT');
    return data;
  }
  const {data,error}=await sb.from('academy_cloud_state').insert(row).select('id,payload,updated_at,version').maybeSingle();
  if(error){
    // Another device may have created the initial row. Treat that as a sync conflict.
    if(String(error.code||'')==='23505')throw new Error('CLOUD_VERSION_CONFLICT');
    throw new Error(`Cloud upload: ${error.message}`);
  }
  return data;
}

export async function syncCloud(localPassword?:string):Promise<CloudSyncResult>{
  if(!configured())return{status:'not_configured',message:'Supabase غير مُعد بعد.'};
  if(!navigator.onLine)return{status:'offline',message:'لا يوجد اتصال؛ تم حفظ التعديلات محليًا.'};
  if(syncInFlight)return{status:'synced',message:'المزامنة قيد التنفيذ.'};
  syncInFlight=true;
  try{
    const sb=getClient()!;
    let session=(await sb.auth.getSession()).data.session;
    if(!session&&localPassword){try{session=await cloudLogin(localPassword);}catch(e){if(!isNetworkError(e))throw new Error(`Cloud Auth: ${(e as any)?.message||'تعذر تسجيل الدخول للسحابة.'}`);return{status:'offline',message:'تعذر الوصول إلى Supabase؛ سيستمر التطبيق محليًا.'};}}
    if(!session)throw new Error('جلسة Supabase غير موجودة.');
    const db=await ensureMeta();
    const local=await snapshot();
    const localHash=await hashText(JSON.stringify(local));
    const meta=(await db.select<any[]>('SELECT * FROM sync_meta WHERE id=1'))[0]||{};
    const localHasBusiness=TABLES.some(t=>(local?.[t]||[]).length>0);
    let remote=await readCloudState(sb);
    if(!remote){
      try{const saved=await writeCloudState(sb,session,local,1);await clearDirty();await db.execute(`INSERT OR REPLACE INTO sync_meta VALUES (1,?,?,?,?,?)`,[localHash,saved?.updated_at||nowIso(),nowIso(),'pushed']);return{status:'pushed',message:'تم إنشاء النسخة السحابية ورفع البيانات المحلية.'};}
      catch(e:any){if(String(e?.message)==='CLOUD_VERSION_CONFLICT'){remote=await readCloudState(sb);}else throw e;}
    }
    let merged:any=null;let savedRemoteUpdatedAt=remote?.updated_at||nowIso();let status:'synced'|'pulled'|'pushed'='synced';
    for(let attempt=0;attempt<4;attempt++){
      if(!remote)throw new Error('تعذر قراءة حالة Supabase.');
      const remotePayload=remote.payload||{};
      const remoteHasBusiness=TABLES.some(t=>(remotePayload?.[t]||[]).length>0);
      const freshLocal=!localHasBusiness && attempt===0;
      merged=freshLocal&&remoteHasBusiness?remotePayload:mergePayload(local,remotePayload);
      const mergedHash=await hashText(JSON.stringify(merged));
      const remoteHash=await hashText(JSON.stringify(remotePayload));
      const remoteNewer=Boolean(meta.last_remote_updated_at&&new Date(remote.updated_at).getTime()>new Date(meta.last_remote_updated_at).getTime()+500);
      const localDirty=Boolean((await db.select<any[]>('SELECT id FROM sync_outbox LIMIT 1'))[0])||Boolean(meta.last_local_hash&&meta.last_local_hash!==localHash);
      if(mergedHash!==remoteHash){
        try{const saved=await writeCloudState(sb,session,merged,Number(remote.version||0)+1);savedRemoteUpdatedAt=saved.updated_at;status='pushed';}
        catch(e:any){if(String(e?.message)!=='CLOUD_VERSION_CONFLICT')throw e;remote=await readCloudState(sb);continue;}
      }
      if(mergedHash!==localHash)await replaceLocalSnapshot(merged);else await clearDirty();
      if(freshLocal&&remoteHasBusiness)status='pulled';else if(mergedHash===localHash&&!localDirty&&!remoteNewer)status='synced';
      await db.execute(`INSERT OR REPLACE INTO sync_meta VALUES (1,?,?,?,?,?)`,[mergedHash,savedRemoteUpdatedAt,nowIso(),status]);
      return{status,message:status==='pulled'?'تم تنزيل البيانات الموجودة في Supabase إلى القاعدة المحلية.':status==='pushed'?'تم رفع ومزج التعديلات المحلية مع Supabase.':'SQLite وSupabase متزامنان.',remoteUpdatedAt:savedRemoteUpdatedAt};
    }
    throw new Error('تعذر إتمام المزامنة بعد عدة محاولات بسبب تعديلات متزامنة.');
  }catch(e:any){if(isNetworkError(e))return{status:'offline',message:'الاتصال بالسحابة غير متاح؛ البيانات المحلية مستمرة في العمل.'};return{status:'error',message:e?.message||'فشلت المزامنة السحابية.'};}
  finally{syncInFlight=false;}
}

const DB_NAME='ifc-academy-secure';const STORE='keys';
async function keyStore():Promise<IDBDatabase>{return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function getDeviceKey(){const d=await keyStore();return new Promise<CryptoKey>((res,rej)=>{const tx=d.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),g=s.get('password-key');g.onsuccess=async()=>{if(g.result)return res(g.result);try{const k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);s.put(k,'password-key');res(k);}catch(e){rej(e);}};g.onerror=()=>rej(g.error);});}
async function encryptSecret(text:string){const k=await getDeviceKey(),iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text));return{iv:Array.from(iv),data:Array.from(new Uint8Array(data))};}
async function decryptSecret(v:any){const k=await getDeviceKey();const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv)},k,new Uint8Array(v.data));return new TextDecoder().decode(data);}
async function queuePassword(oldPassword:string,newPassword:string,username?:string){const db=await getDb();const oldSecret=await encryptSecret(oldPassword),newSecret=await encryptSecret(newPassword);const current=(await db.select<any[]>('SELECT * FROM pending_password_change WHERE id=1'))[0];await db.execute(`INSERT OR REPLACE INTO pending_password_change (id,old_secret,new_secret,created_at,new_username) VALUES (?,?,?,?,?)`,[1,JSON.stringify(oldSecret),JSON.stringify(newSecret),current?.created_at||nowIso(),username||current?.new_username||'']);}
async function flushPasswordQueue(){if(passwordQueuePromise)return passwordQueuePromise;passwordQueuePromise=(async()=>{const sb=getClient();if(!sb||!navigator.onLine)return;const db=await getDb();try{}catch{}const q=(await db.select<any[]>('SELECT * FROM pending_password_change WHERE id=1'))[0];if(!q)return;const oldP=await decryptSecret(JSON.parse(q.old_secret)),newP=await decryptSecret(JSON.parse(q.new_secret));let session=(await sb.auth.getSession()).data.session;if(!session){try{session=await cloudLogin(oldP);}catch(e){if(isNetworkError(e))return;throw new Error(`Cloud Auth: ${(e as any)?.message||'كلمة المرور القديمة غير صحيحة أو حساب السحابة غير متاح.'}`);}}const {error}=await sb.auth.updateUser({password:newP,data:q.new_username?{username:q.new_username}:undefined});if(error)throw new Error(`Cloud Auth: ${error.message}`);await db.execute('DELETE FROM pending_password_change WHERE id=1');})().finally(()=>{passwordQueuePromise=null;});return passwordQueuePromise;}
export async function changeCloudPassword(oldPassword:string,newPassword:string,username?:string,queueIfOffline=true){const sb=getClient();if(!sb){if(queueIfOffline)await queuePassword(oldPassword,newPassword,username);return;}if(!navigator.onLine){if(queueIfOffline)await queuePassword(oldPassword,newPassword,username);return;}let session=(await sb.auth.getSession()).data.session;if(!session){try{session=await cloudLogin(oldPassword);}catch(e){if(isNetworkError(e)){if(queueIfOffline)await queuePassword(oldPassword,newPassword,username);return;}throw new Error(`Cloud Auth: ${(e as any)?.message||'تعذر التحقق من كلمة المرور الحالية.'}`);}}const {error}=await sb.auth.updateUser({password:newPassword,data:{username:username?.trim()||undefined,passwordChangedAt:nowIso()}});if(error)throw new Error(`Cloud Auth: ${error.message}`);const db=await getDb();await db.execute('DELETE FROM pending_password_change WHERE id=1');}
export async function flushPendingCloudChanges(localPassword?:string){await flushPasswordQueue();return syncCloud(localPassword);}
