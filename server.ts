import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
const supabase = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

type AuthRequest = express.Request & { user?: any };
const SYNC_TABLES = ['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','recycle_bin','app_notifications'];

function bearer(req: express.Request) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
async function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!supabase) return res.status(503).json({ error: 'Supabase server configuration is missing.' });
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'جلسة الدخول غير صالحة.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'جلسة الدخول غير صالحة أو انتهت.' });
    req.user = data.user; next();
  } catch { return res.status(401).json({ error: 'جلسة الدخول غير صالحة أو انتهت.' }); }
}
function rowTime(row: any) {
  const n = new Date(row?.updated_at || row?.archived_at || row?.timestamp || row?.created_at || '1970-01-01').getTime();
  return Number.isFinite(n) ? n : 0;
}
function tombTime(row: any) {
  const n = new Date(row?.deleted_at || 0).getTime();
  return Number.isFinite(n) ? n : 0;
}
function mergeSnapshots(local: any, remote: any, localTombs: any[], remoteTombs: any[]) {
  const tombMap = new Map<string, any>();
  for (const t of [...(remoteTombs || []), ...(localTombs || [])]) {
    const key = `${t.table_name}:${t.record_id}`, old = tombMap.get(key);
    if (!old || tombTime(t) > tombTime(old)) tombMap.set(key, t);
  }
  const merged: Record<string, any[]> = {};
  for (const table of SYNC_TABLES) {
    const lm = new Map((local?.[table] || []).map((r: any) => [String(r.id), r]));
    const rm = new Map((remote?.[table] || []).map((r: any) => [String(r.id), r]));
    const rows: any[] = [];
    for (const id of new Set([...lm.keys(), ...rm.keys()])) {
      const a = lm.get(id), b = rm.get(id);
      const winner = !a ? b : !b ? a : (rowTime(a) >= rowTime(b) ? a : b);
      const tomb = tombMap.get(`${table}:${id}`);
      if (winner && (!tomb || rowTime(winner) > tombTime(tomb))) rows.push(winner);
    }
    merged[table] = rows;
  }
  return { payload: merged, tombstones: [...tombMap.values()] };
}
async function readRemoteSnapshot() {
  if (!supabase) throw new Error('Supabase server configuration is missing.');
  const entries = await Promise.all(SYNC_TABLES.map(async table => {
    const { data, error } = await supabase!.from(table).select('*');
    if (error) throw new Error(`${table}: ${error.message}`);
    return [table, data || []] as const;
  }));
  const { data: tombs, error } = await supabase.from('sync_tombstones').select('table_name,record_id,deleted_at');
  if (error) throw new Error(`sync_tombstones: ${error.message}`);
  return { payload: Object.fromEntries(entries), tombstones: tombs || [] };
}
function cloudRow(table:string,row:any){
 const x={...row};
 const jsonCols:Record<string,string[]>={
  players:['training_schedule'],coaches:['teams'],monthly_archives:['payments','expenses','attendance'],
  recycle_bin:['payload','related'],app_notifications:['meta']
 };
 for(const c of jsonCols[table]||[])if(typeof x[c]==='string'){try{x[c]=JSON.parse(x[c])}catch{}}
 if(table==='academy_settings')for(const c of ['whatsapp_notifications_enabled','sms_alerts_enabled','desktop_notifications_enabled'])if(x[c]!==undefined)x[c]=Boolean(Number(x[c]));
 if(table==='app_notifications')for(const c of ['read','is_trash'])if(x[c]!==undefined)x[c]=Boolean(Number(x[c]));
 return x;
}

async function deleteIds(table: string, ids: string[]) {
  if (!supabase) return;
  for (let i=0;i<ids.length;i+=200) {
    const { error } = await supabase.from(table).delete().in('id', ids.slice(i,i+200));
    if (error) throw new Error(`${table} delete: ${error.message}`);
  }
}
async function applyMerged(remote: any, merged: any, tombstones: any[]) {
  if (!supabase) throw new Error('Supabase server configuration is missing.');
  const deleteOrder = ['app_notifications','recycle_bin','monthly_archives','player_sessions','payments','expenses','coaches','players','academy_settings'];
  for (const table of deleteOrder) {
    const keep = new Set((merged[table] || []).map((r:any)=>String(r.id)));
    const remove = (remote[table] || []).map((r:any)=>String(r.id)).filter((id:string)=>!keep.has(id));
    await deleteIds(table, remove);
  }
  const writeOrder = ['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','recycle_bin','app_notifications'];
  for (const table of writeOrder) {
    const rows = merged[table] || [];
    for (let i=0;i<rows.length;i+=200) {
      const chunk=rows.slice(i,i+200).map((r:any)=>cloudRow(table,r));
      if (!chunk.length) continue;
      const { error } = await supabase.from(table).upsert(chunk,{onConflict:'id'});
      if (error) throw new Error(`${table} upsert: ${error.message}`);
    }
  }
  for (let i=0;i<tombstones.length;i+=200) {
    const chunk=tombstones.slice(i,i+200);
    if (chunk.length) {
      const { error }=await supabase.from('sync_tombstones').upsert(chunk,{onConflict:'table_name,record_id'});
      if(error)throw new Error(`sync_tombstones upsert: ${error.message}`);
    }
  }
}

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'20mb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');next();});
app.get('/api/health',(_req,res)=>res.json({status:'ok',database:supabase?'Supabase (PostgreSQL)':'Supabase configuration missing',timestamp:new Date().toISOString()}));
app.get('/api/db-status',requireAuth,async(_req,res)=>{
  try{if(!supabase)throw new Error('Supabase server configuration is missing.');const {data,error}=await supabase.from('academy_settings').select('academy_name').eq('id',1).maybeSingle();if(error)throw error;res.json({connected:true,type:'Supabase (PostgreSQL)',academyName:data?.academy_name||''});}
  catch(e:any){res.status(500).json({connected:false,error:e?.message||'Database unavailable'});}
});
app.post('/api/sync',requireAuth,async(req:AuthRequest,res)=>{
  try{
    const local=req.body?.payload||{}, localTombs=Array.isArray(req.body?.tombstones)?req.body.tombstones:[];
    const remote=await readRemoteSnapshot();
    const merged=mergeSnapshots(local,remote.payload,localTombs,remote.tombstones);
    await applyMerged(remote.payload,merged.payload,merged.tombstones);
    res.json({success:true,payload:merged.payload,tombstones:merged.tombstones,syncedAt:new Date().toISOString()});
  }catch(e:any){console.error('[IFC] sync failed:',e);res.status(500).json({error:e?.message||'تعذر مزامنة البيانات مع Supabase.'});}
});
if(process.env.NODE_ENV==='production'){
  app.use(express.static(path.join(process.cwd(),'dist')));
  app.get('*',(_req,res)=>res.sendFile(path.join(process.cwd(),'dist','index.html')));
}
const port=Number(process.env.PORT||3000);
app.listen(port,'0.0.0.0',()=>console.log(`[IFC] server listening on ${port}`));
