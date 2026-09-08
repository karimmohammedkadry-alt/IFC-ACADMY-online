import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDb, nowIso } from './localDb';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const AUTH_EMAIL = import.meta.env.VITE_SUPABASE_AUTH_EMAIL as string | undefined;
const META_ID = 1;
const TABLES = ['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','app_notifications'];
let client: SupabaseClient | null = null;
let syncInFlight = false;

export type CloudSyncResult = { status:'synced'|'pulled'|'pushed'|'offline'|'not_configured'|'error'; message:string; remoteUpdatedAt?:string };
function configured(){ return Boolean(URL && KEY && KEY.startsWith('sb_publishable_') && AUTH_EMAIL); }
export function isCloudSyncConfigured(){ return configured(); }
function getClient(){ if(!configured()) return null; if(!client) client=createClient(URL!,KEY!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}); return client; }
function deviceId(){ const k='ifc_cloud_device_id'; let v=localStorage.getItem(k); if(!v){v=crypto.randomUUID();localStorage.setItem(k,v);} return v; }
async function hashText(text:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function ensureMeta(){const db=await getDb();await db.execute(`CREATE TABLE IF NOT EXISTS sync_meta (id INTEGER PRIMARY KEY CHECK(id=1), last_local_hash TEXT DEFAULT '', last_remote_updated_at TEXT DEFAULT '', last_sync_at TEXT DEFAULT '', last_status TEXT DEFAULT 'never')`);return db;}
async function snapshot(){const db=await getDb();const out:Record<string,any[]|any>={};for(const t of TABLES)out[t]=await db.select<any[]>(`SELECT * FROM ${t}`);const tomb=await db.select<any[]>('SELECT table_name,record_id,deleted_at FROM sync_tombstones');out._tombstones=tomb;return out;}
function rowId(table:string,row:any){return table==='academy_settings'?String(row.id):String(row.id);}
function timeOf(row:any){return new Date(row.updated_at||row.archived_at||row.timestamp||row.created_at||'1970-01-01').getTime();}
function mergePayload(local:any,remote:any){
  const merged:Record<string,any[]>={};
  for(const t of TABLES){
    const lm=new Map((local?.[t]||[]).map((r:any)=>[rowId(t,r),r]));
    const rm=new Map((remote?.[t]||[]).map((r:any)=>[rowId(t,r),r]));
    const ids=new Set([...lm.keys(),...rm.keys()]);
    merged[t]=[];
    for(const id of ids){const a=lm.get(id),b=rm.get(id);if(!a)merged[t].push(b);else if(!b)merged[t].push(a);else merged[t].push(timeOf(a)>=timeOf(b)?a:b);}
  }
  const lt=local?._tombstones||[], rt=remote?._tombstones||[]; const tombMap=new Map<string,any>();
  for(const x of [...lt,...rt]){const k=`${x.table_name}:${x.record_id}`,old=tombMap.get(k);if(!old||new Date(x.deleted_at).getTime()>new Date(old.deleted_at).getTime())tombMap.set(k,x);}
  const tomb=[...tombMap.values()];
  for(const t of TABLES){merged[t]=merged[t].filter((r:any)=>{const x=tombMap.get(`${t}:${rowId(t,r)}`);return !x||timeOf(r)>new Date(x.deleted_at).getTime();});}
  merged._tombstones=tomb; return merged;
}
async function replaceLocalSnapshot(payload:any){
  const db=await getDb(); const clear=['app_notifications','monthly_archives','player_sessions','players','payments','expenses','coaches'];
  await db.execute('BEGIN'); try{
    for(const t of clear)await db.execute(`DELETE FROM ${t}`); await db.execute('DELETE FROM academy_settings');
    for(const t of TABLES){for(const r of (payload?.[t]||[])){const cols=Object.keys(r),marks=cols.map(()=>'?').join(',');await db.execute(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${marks})`,cols.map(c=>r[c]));}}
    await db.execute('DELETE FROM sync_tombstones'); for(const x of payload?._tombstones||[]){await db.execute('INSERT OR REPLACE INTO sync_tombstones(table_name,record_id,deleted_at) VALUES (?,?,?)',[x.table_name,x.record_id,x.deleted_at]);}
    await db.execute('DELETE FROM sync_outbox'); await db.execute('COMMIT');
  }catch(e){try{await db.execute('ROLLBACK')}catch{} throw e;}
}
async function clearDirty(){const db=await getDb();await db.execute('DELETE FROM sync_outbox');}
async function signInCloud(password:string){const sb=getClient();if(!sb||!AUTH_EMAIL)return null;const current=(await sb.auth.getSession()).data.session;if(current?.user)return current;const {data,error}=await sb.auth.signInWithPassword({email:AUTH_EMAIL,password});if(error)throw new Error(`Cloud Auth: ${error.message}`);return data.session;}

export async function syncCloud(localPassword?:string):Promise<CloudSyncResult>{
  if(!configured())return{status:'not_configured',message:'Supabase غير مُعد بعد.'};
  if(!navigator.onLine)return{status:'offline',message:'لا يوجد اتصال؛ تم حفظ كل التعديلات محليًا في انتظار المزامنة.'};
  if(syncInFlight)return{status:'synced',message:'المزامنة قيد التنفيذ.'}; syncInFlight=true;
  try{
    const sb=getClient()!; let session=(await sb.auth.getSession()).data.session; if(!session&&localPassword)session=await signInCloud(localPassword); if(!session)throw new Error('لا توجد جلسة Supabase. سجّل الدخول بحساب السحابة أولًا.');
    const db=await ensureMeta(); const local=await snapshot(); const localHash=await hashText(JSON.stringify(local));
    const meta=(await db.select<any[]>('SELECT * FROM sync_meta WHERE id=1'))[0]||{};
    const {data:remote,error}=await sb.from('academy_cloud_state').select('id,payload,updated_at,updated_by,device_id,version').eq('id',META_ID).maybeSingle(); if(error)throw new Error(`Cloud read: ${error.message}`);
    if(!remote){await sb.from('academy_cloud_state').upsert({id:1,payload:local,updated_at:nowIso(),updated_by:session.user.id,device_id:deviceId(),version:1},{onConflict:'id'});await clearDirty();await db.execute(`INSERT OR REPLACE INTO sync_meta VALUES (1,?,?,?,?,?)`,[localHash,nowIso(),nowIso(),'pushed']);return{status:'pushed',message:'تم إنشاء النسخة السحابية ورفع البيانات المحلية.'};}
    const remotePayload=remote.payload||{}; const merged=mergePayload(local,remotePayload); const mergedHash=await hashText(JSON.stringify(merged)); const remoteHash=await hashText(JSON.stringify(remotePayload));
    const remoteNewer=meta.last_remote_updated_at && new Date(remote.updated_at).getTime()>new Date(meta.last_remote_updated_at).getTime()+500;
    const localDirty=Boolean((await db.select<any[]>('SELECT id FROM sync_outbox LIMIT 1'))[0]) || Boolean(meta.last_local_hash&&meta.last_local_hash!==localHash);
    if(mergedHash!==remoteHash){
      const {error:upErr}=await sb.from('academy_cloud_state').upsert({id:1,payload:merged,updated_at:nowIso(),updated_by:session.user.id,device_id:deviceId(),version:Number(remote.version||0)+1},{onConflict:'id'}); if(upErr)throw new Error(`Cloud upload: ${upErr.message}`);
    }
    if(mergedHash!==localHash){await replaceLocalSnapshot(merged);}else await clearDirty();
    await db.execute(`INSERT OR REPLACE INTO sync_meta VALUES (1,?,?,?,?,?)`,[mergedHash,nowIso(),nowIso(),mergedHash===localHash&&!localDirty&&!remoteNewer?'synced':(remoteNewer&&!localDirty?'pulled':'pushed')]);
    const status=mergedHash===localHash&&!localDirty&&!remoteNewer?'synced':(remoteNewer&&!localDirty?'pulled':'pushed');
    return{status,message:status==='pulled'?'تم تنزيل التغييرات الأحدث من Supabase.':status==='pushed'?'تم رفع ومزج التعديلات المحلية مع Supabase.':'SQLite وSupabase متزامنان.',remoteUpdatedAt:remote.updated_at};
  }catch(e:any){return{status:'error',message:e?.message||'فشلت المزامنة السحابية.'};}finally{syncInFlight=false;}
}

// Password changes: offline changes are applied to SQLite immediately and queued encrypted in the browser profile.
const DB_NAME='ifc-academy-secure'; const STORE='keys';
async function keyStore():Promise<IDBDatabase>{return await new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function getDeviceKey(){const d=await keyStore();return await new Promise<CryptoKey>(async(res,rej)=>{const tx=d.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),g=s.get('password-key');g.onsuccess=async()=>{if(g.result)return res(g.result);try{const k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);s.put(k,'password-key');res(k);}catch(e){rej(e)}};g.onerror=()=>rej(g.error);});}
async function encryptSecret(text:string){const k=await getDeviceKey(),iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(text));return{iv:Array.from(iv),data:Array.from(new Uint8Array(data))};}
async function decryptSecret(v:any){const k=await getDeviceKey();const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv)},k,new Uint8Array(v.data));return new TextDecoder().decode(data);}
async function queuePassword(oldPassword:string,newPassword:string){const db=await getDb();await db.execute(`CREATE TABLE IF NOT EXISTS pending_password_change (id INTEGER PRIMARY KEY CHECK(id=1),old_secret TEXT NOT NULL,new_secret TEXT NOT NULL,created_at TEXT NOT NULL)`);const existing=(await db.select<any[]>('SELECT * FROM pending_password_change WHERE id=1'))[0];const oldC=existing?JSON.parse(existing.old_secret):await encryptSecret(oldPassword);const newC=await encryptSecret(newPassword);await db.execute(`INSERT OR REPLACE INTO pending_password_change VALUES (1,?,?,?)`,[JSON.stringify(oldC),JSON.stringify(newC),existing?.created_at||nowIso()]);}
async function flushPasswordQueue(){const sb=getClient();if(!sb||!navigator.onLine)return false;const db=await getDb();await db.execute(`CREATE TABLE IF NOT EXISTS pending_password_change (id INTEGER PRIMARY KEY CHECK(id=1),old_secret TEXT NOT NULL,new_secret TEXT NOT NULL,created_at TEXT NOT NULL)`);const q=(await db.select<any[]>('SELECT * FROM pending_password_change WHERE id=1'))[0];if(!q)return false;const oldP=await decryptSecret(JSON.parse(q.old_secret)),newP=await decryptSecret(JSON.parse(q.new_secret));let session=(await sb.auth.getSession()).data.session;if(!session)session=await signInCloud(oldP);if(!session)throw new Error('تعذر تسجيل الدخول إلى Supabase بالباسورد القديم لإتمام المزامنة.');const {error}=await sb.auth.updateUser({password:newP});if(error)throw new Error(`Cloud Auth: ${error.message}`);await db.execute('DELETE FROM pending_password_change WHERE id=1');return true;}
export async function changeCloudPassword(oldPassword:string,newPassword:string,queueIfOffline=true){const sb=getClient();if(!sb) return; if(!navigator.onLine){if(queueIfOffline)await queuePassword(oldPassword,newPassword);return;} let session=(await sb.auth.getSession()).data.session;if(!session)session=await signInCloud(oldPassword);if(!session)throw new Error('لا توجد جلسة Supabase فعالة.');const {error}=await sb.auth.updateUser({password:newPassword});if(error)throw new Error(`Cloud Auth: ${error.message}`);const db=await getDb();await db.execute(`CREATE TABLE IF NOT EXISTS pending_password_change (id INTEGER PRIMARY KEY CHECK(id=1),old_secret TEXT NOT NULL,new_secret TEXT NOT NULL,created_at TEXT NOT NULL)`);await db.execute('DELETE FROM pending_password_change WHERE id=1');}
export async function flushPendingCloudChanges(localPassword?:string){await flushPasswordQueue();return syncCloud(localPassword);}
