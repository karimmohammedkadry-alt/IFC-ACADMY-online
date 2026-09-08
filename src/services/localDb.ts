type Row = Record<string, any>;
type DbLike = {
  select<T = Row[]>(sql: string, params?: any[]): Promise<T>;
  execute(sql: string, params?: any[]): Promise<void>;
};

const schema = [
  `CREATE TABLE IF NOT EXISTS admin_credentials (id INTEGER PRIMARY KEY CHECK (id = 1), username TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, member_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, national_id TEXT DEFAULT '', payment_method TEXT DEFAULT 'كاش', birth_date TEXT DEFAULT '', notes TEXT DEFAULT '', avatar_url TEXT DEFAULT '', team TEXT NOT NULL, sport TEXT DEFAULT 'كيك بوكسينغ', training_schedule TEXT DEFAULT '[]', subscription_start_date TEXT NOT NULL, subscription_end_date TEXT NOT NULL, total_sessions INTEGER DEFAULT 8, attended_sessions INTEGER DEFAULT 0, absent_sessions INTEGER DEFAULT 0, attendance_rate REAL DEFAULT 0, phone TEXT DEFAULT '', parent_phone TEXT DEFAULT '', subscription_plan TEXT DEFAULT 'شهري (3 أيام/أسبوع)', monthly_fee INTEGER DEFAULT 500, subscription_expiry TEXT NOT NULL, status TEXT DEFAULT 'نشط', join_date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS player_sessions (id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, session_number INTEGER NOT NULL, date TEXT NOT NULL, day_name TEXT NOT NULL, time TEXT NOT NULL, status TEXT DEFAULT 'غائب', notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, type TEXT DEFAULT 'اشتراك لاعب', player_id TEXT, player_name TEXT NOT NULL, member_number TEXT, team TEXT DEFAULT '', coach_id TEXT, amount INTEGER NOT NULL CHECK(amount > 0), method TEXT NOT NULL, date TEXT NOT NULL, period_month TEXT NOT NULL, coverage_start TEXT, coverage_end TEXT, duration_months INTEGER DEFAULT 1, due_amount INTEGER DEFAULT 0, remaining_amount INTEGER DEFAULT 0, status TEXT DEFAULT 'مدفوع', notes TEXT DEFAULT '', collected_by TEXT DEFAULT 'مسؤول الخزينة', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), date TEXT NOT NULL, paid_to TEXT NOT NULL, coach_id TEXT, method TEXT NOT NULL, notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS coaches (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_url TEXT DEFAULT '', role TEXT NOT NULL, sport TEXT DEFAULT 'كيك بوكسينغ', teams TEXT DEFAULT '[]', phone TEXT DEFAULT '', monthly_salary INTEGER DEFAULT 4000, join_date TEXT NOT NULL, status TEXT DEFAULT 'نشط', sessions_count_this_month INTEGER DEFAULT 0, last_salary_paid_month TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS academy_settings (id INTEGER PRIMARY KEY CHECK (id = 1), academy_name TEXT NOT NULL, logo_text TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL, currency TEXT NOT NULL, current_season TEXT NOT NULL, whatsapp_notifications_enabled INTEGER DEFAULT 1, sms_alerts_enabled INTEGER DEFAULT 0, custom_logo_url TEXT DEFAULT '', color_theme TEXT DEFAULT 'classic-blue', primary_color TEXT DEFAULT '#2563eb', background_color TEXT DEFAULT '#020617', navbar_color TEXT DEFAULT '#0b1120', desktop_notifications_enabled INTEGER DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS monthly_archives (id TEXT PRIMARY KEY, month_key TEXT NOT NULL UNIQUE, month_label TEXT NOT NULL, archived_at TEXT NOT NULL, archived_by TEXT DEFAULT 'المدير العام (Admin)', total_income INTEGER NOT NULL DEFAULT 0, total_expenses INTEGER NOT NULL DEFAULT 0, net_profit INTEGER NOT NULL DEFAULT 0, payments_count INTEGER NOT NULL DEFAULT 0, expenses_count INTEGER NOT NULL DEFAULT 0, active_players_count INTEGER NOT NULL DEFAULT 0, overdue_players_count INTEGER NOT NULL DEFAULT 0, payments TEXT DEFAULT '[]', expenses TEXT DEFAULT '[]', attendance TEXT DEFAULT '[]', attendance_count INTEGER DEFAULT 0, present_count INTEGER DEFAULT 0, absent_count INTEGER DEFAULT 0, excused_count INTEGER DEFAULT 0, notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS sync_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT NOT NULL, operation TEXT NOT NULL, changed_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sync_tombstones (table_name TEXT NOT NULL, record_id TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY(table_name,record_id))`,
  `CREATE TABLE IF NOT EXISTS pending_password_change (id INTEGER PRIMARY KEY CHECK(id=1), old_secret TEXT NOT NULL, new_secret TEXT NOT NULL, created_at TEXT NOT NULL, new_username TEXT DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS system_backups (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, created_by TEXT, backup_type TEXT NOT NULL DEFAULT 'local', note TEXT)`,
  `CREATE TABLE IF NOT EXISTS app_notifications (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, timestamp TEXT NOT NULL, read INTEGER DEFAULT 0, category TEXT NOT NULL, meta TEXT DEFAULT '{}', is_trash INTEGER DEFAULT 0, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS recycle_bin (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, record_id TEXT NOT NULL, label TEXT NOT NULL, deleted_at TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}', related TEXT DEFAULT '{}', deleted_by TEXT DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS sync_meta (id INTEGER PRIMARY KEY CHECK(id=1), last_local_hash TEXT DEFAULT '', last_remote_updated_at TEXT DEFAULT '', last_sync_at TEXT DEFAULT '', last_status TEXT DEFAULT 'never')`,
];

export const defaultSettings = {
  academyName: 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ', logoText: 'IFC ACADEMY', phone: '+20 100 123 4567', email: 'info@ifc-academy.com', address: 'القاهرة الجديدة، التجمع الخامس - صالة النصر الأولمبية', currency: 'ج.م', currentSeason: 'موسم 2024 / 2025', whatsappNotificationsEnabled: true, smsAlertsEnabled: false, customLogoUrl: '', colorTheme: 'classic-blue', primaryColor: '#2563eb', backgroundColor: '#020617', navbarColor: '#0b1120', desktopNotificationsEnabled: true,
};

const TABLES = ['admin_credentials','players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','recycle_bin','sync_outbox','sync_tombstones','pending_password_change','system_backups','app_notifications','sync_meta'];
const IDB_NAME = 'ifc-academy-local-v3';
const IDB_STORE = 'state';
const SYNC_TABLES = new Set(['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','recycle_bin','app_notifications']);
let dbPromise: Promise<DbLike> | null = null;

const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v));
const sleep = (ms:number) => new Promise(r => setTimeout(r, ms));
export function isDesktopApp(){ return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__); }
function splitTopLevel(text:string, delimiter=','){
  const out:string[]=[]; let start=0, depth=0, quote='';
  for(let i=0;i<text.length;i++){ const ch=text[i]; if(quote){ if(ch===quote && text[i-1]!== '\\') quote=''; continue; } if(ch==='"'||ch==="'"){quote=ch;continue;} if(ch==='(')depth++; else if(ch===')')depth--; else if(depth===0 && ch===delimiter){out.push(text.slice(start,i).trim());start=i+1;} }
  out.push(text.slice(start).trim()); return out.filter(Boolean);
}
function bindPlaceholders(value:string, params:any[], state:{i:number}){ return value.replace(/\?/g,()=>JSON.stringify(params[state.i++])); }
function parseLiteral(raw:string, params:any[], state:{i:number}, row:Row={}):any{
  const v=raw.trim();
  if(v==='?') return params[state.i++];
  if(/^NULL$/i.test(v)) return null;
  if(/^strftime\(/i.test(v)) return new Date().toISOString();
  const nullif=v.match(/^NULLIF\(([^,]+),\s*(['"].*['"])\)$/i); if(nullif){const a=parseLiteral(nullif[1],params,state,row),b=parseLiteral(nullif[2],params,state,row);return a===b?null:a;}
  const coalesce=v.match(/^COALESCE\((.*)\)$/i); if(coalesce){for(const p of splitTopLevel(coalesce[1])){const x=parseLiteral(p,params,state,row);if(x!==null&&x!==undefined&&x!=='')return x;}return null;}
  if(/^['"].*['"]$/s.test(v)) return v.slice(1,-1).replace(/''/g,"'");
  if(/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if(/^true$/i.test(v)) return 1; if(/^false$/i.test(v)) return 0;
  if(/^NEW\./i.test(v)||/^OLD\./i.test(v)) return row[v.slice(4)];
  if(/^excluded\./i.test(v)) return row[`__excluded_${v.slice(9)}`];
  if(Object.prototype.hasOwnProperty.call(row,v)) return row[v];
  return v;
}
function matchWhere(row:Row, clause:string, params:any[]):boolean{
  const normalized=clause.trim().replace(/^\(|\)$/g,'');
  const ors=splitByWord(normalized,'OR'); if(ors.length>1)return ors.some(x=>matchWhere(row,x,params));
  const ands=splitByWord(normalized,'AND'); if(ands.length>1){let offset=0; return ands.every(x=>{const nparams=params.slice(offset);const before=countQ(x);offset+=before;return matchWhere(row,x,nparams);});}
  const c=normalized.replace(/^\(|\)$/g,'').trim();
  const func=c.match(/^substr\((\w+),\s*1,\s*7\)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/i);
  if(func){const st={i:0};const expected=parseLiteral(func[3],params,st,row);const actual=String(row[func[1]]??'').slice(0,7);switch(func[2]){case '=':return actual===String(expected??'');case '!=':case '<>':return actual!==String(expected??'');case '>':return actual>String(expected??'');case '<':return actual<String(expected??'');case '>=':return actual>=String(expected??'');case '<=':return actual<=String(expected??'');}}
  let m=c.match(/^([\w]+)\s+IS\s+(NOT\s+)?NULL$/i); if(m)return m[2]?row[m[1]]!==null&&row[m[1]]!==undefined:row[m[1]]===null||row[m[1]]===undefined;
  m=c.match(/^([\w]+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/s); if(!m)return true;
  const st={i:0}; const expected=parseLiteral(m[3],params,st,row); const actual=row[m[1]];
  switch(m[2]){case '=':return String(actual??'')===String(expected??'');case '!=':case '<>':return String(actual??'')!==String(expected??'');case '>':return actual>expected;case '<':return actual<expected;case '>=':return actual>=expected;case '<=':return actual<=expected;default:return true;}
}
function splitByWord(text:string, word:string){const out:string[]=[];let start=0,depth=0,quote='';const re=new RegExp(`\\s${word}\\s`,'gi');let m;while((m=re.exec(text))){for(let i=start;i<m.index;i++){const ch=text[i];if(quote){if(ch===quote&&text[i-1]!== '\\')quote='';}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='(')depth++;else if(ch===')')depth--;}if(depth===0){out.push(text.slice(start,m.index));start=m.index+m[0].length;}}out.push(text.slice(start));return out;}
function countQ(s:string){return (s.match(/\?/g)||[]).length;}
function extractCreateColumns(sql:string){const m=sql.match(/^CREATE TABLE IF NOT EXISTS\s+([\w]+)\s*\((.*)\)$/is);if(!m)return null;const defs=splitTopLevel(m[2]);const cols:string[]=[];for(const d of defs){const name=d.trim().split(/\s+/)[0];if(name&&!/^(PRIMARY|UNIQUE|CHECK|FOREIGN)$/i.test(name))cols.push(name);}return{table:m[1],cols};}

class WebDb implements DbLike{
  private state:Record<string,Row[]> = {};
  private columns:Record<string,string[]> = {};
  private loaded=false;
  private txBackup:Record<string,Row[]>|null=null;
  private async open(){
    const idb=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(IDB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(IDB_STORE))r.result.createObjectStore(IDB_STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const value=await new Promise<any>((resolve,reject)=>{const r=idb.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).get('database');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    this.state=value||{}; for(const t of TABLES)if(!this.state[t])this.state[t]=[];this.loaded=true;return idb;
  }
  private async persist(){const idb=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(IDB_NAME,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=idb.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).put(this.state,'database');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  private async ensureLoaded(){if(!this.loaded)await this.open();}
  async execute(sql:string, params:any[]=[]){await this.ensureLoaded();const s=sql.trim().replace(/;$/,'');if(!s)return;
    if(/^PRAGMA\b/i.test(s)||/^CREATE\s+(INDEX|TRIGGER)\b/i.test(s))return;
    if(/^BEGIN$/i.test(s)){this.txBackup=clone(this.state);return;}
    if(/^COMMIT$/i.test(s)){this.txBackup=null;if(!this.txBackup)await this.persist();return;}
    if(/^ROLLBACK$/i.test(s)){if(this.txBackup)this.state=this.txBackup;this.txBackup=null;if(!this.txBackup)await this.persist();return;}
    const create=extractCreateColumns(s);if(create){if(!this.state[create.table])this.state[create.table]=[];this.columns[create.table]=create.cols;return;}
    const alter=s.match(/^ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)\s+(.+)$/i);if(alter){const [,,col,def]=alter;this.columns[alter[1]]=[...(this.columns[alter[1]]||[]),col];const d=parseLiteral(def.split(/\s+/).slice(1).join(' '),[],{i:0},{});for(const r of this.state[alter[1]]||[])if(!(col in r))r[col]=d;if(!this.txBackup)await this.persist();return;}
    const ins=s.match(/^INSERT\s+(OR\s+REPLACE\s+)?INTO\s+(\w+)\s*(?:\(([^)]*)\))?\s*VALUES\s*\((.*)\)(?:\s+ON\s+CONFLICT\s*\(([^)]*)\)\s+DO\s+UPDATE\s+SET\s+(.+))?$/is);
    if(ins){const table=ins[2], cols=ins[3]?splitTopLevel(ins[3]):(this.columns[table]||Object.keys(this.state[table]?.[0]||{}));const vals=splitTopLevel(ins[4]);const state={i:0};const row:Row={};cols.forEach((c,i)=>row[c.trim()]=parseLiteral(vals[i]||'NULL',params,state,row));const rows=this.state[table]||(this.state[table]=[]);const conflictCols=ins[5]?splitTopLevel(ins[5]).map(x=>x.trim()):(table==='sync_tombstones'?['table_name','record_id']:['id']);let idx=rows.findIndex(r=>conflictCols.every(c=>String(r[c]??'')===String(row[c]??'')));
      if(idx>=0){if(ins[1])rows[idx]={...row};else if(ins[6]){const ex=rows[idx];const merged={...ex};for(const a of splitTopLevel(ins[6])){const mm=a.match(/^(\w+)\s*=\s*(.+)$/s);if(mm){const valueExpr=mm[2].trim().replace(/\bexcluded\.(\w+)\b/g,(_,k)=>JSON.stringify(row[k]));merged[mm[1]]=parseLiteral(valueExpr,[],{i:0},{...ex,...Object.fromEntries(Object.entries(row).map(([k,v])=>[`__excluded_${k}`,v]))});}}rows[idx]=merged;if(SYNC_TABLES.has(table)&&this.columns[table]?.includes('updated_at'))rows[idx].updated_at=new Date().toISOString();} }
      else {if(SYNC_TABLES.has(table)&&this.columns[table]?.includes('updated_at')&&!row.updated_at&&this.columns[table].includes('updated_at'))row.updated_at=new Date().toISOString();rows.push(row);}if(!this.txBackup)await this.persist();return;}
    const upd=s.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/is);if(upd){const table=upd[1], assignments=splitTopLevel(upd[2]), setParamCount=countQ(upd[2]), setParams=params.slice(0,setParamCount), whereParams=params.slice(setParamCount);for(const r of this.state[table]||[]){if(matchWhere(r,upd[3],whereParams)){const local={i:0};for(const a of assignments){const m=a.match(/^(\w+)\s*=\s*(.+)$/s);if(!m)continue;r[m[1]]=parseLiteral(m[2],setParams,local,r);}}}if(SYNC_TABLES.has(table)&&this.state[table]&&!/\bupdated_at\s*=/i.test(upd[2]))for(const r of this.state[table])if(matchWhere(r,upd[3],whereParams)&&'updated_at' in r)r.updated_at=new Date().toISOString();if(!this.txBackup)await this.persist();return;}
    const del=s.match(/^DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/is);if(del){const table=del[1],where=del[2];const old=this.state[table]||[];const victims=where?old.filter(r=>matchWhere(r,where,params)):old.slice();if(table!=='sync_tombstones'&&table!=='sync_outbox'&&table!=='pending_password_change'&&table!=='sync_meta'){const tomb=this.state.sync_tombstones||(this.state.sync_tombstones=[]);for(const r of victims){if(r.id!=null){const exists=tomb.find(x=>x.table_name===table&&String(x.record_id)===String(r.id));if(exists)exists.deleted_at=new Date().toISOString();else tomb.push({table_name:table,record_id:String(r.id),deleted_at:new Date().toISOString()});}}}this.state[table]=where?old.filter(r=>!victims.includes(r)):[];if(!this.txBackup)await this.persist();return;}
    throw new Error(`Web local database: unsupported SQL: ${s.slice(0,120)}`);
  }
  async select<T=Row[]>(sql:string, params:any[]=[]):Promise<T>{await this.ensureLoaded();const s=sql.trim().replace(/;$/,'');
    const pragma=s.match(/^PRAGMA\s+table_info\((\w+)\)/i);if(pragma){const cols=this.columns[pragma[1]]||Object.keys(this.state[pragma[1]]?.[0]||{});return cols.map((name,i)=>({cid:i,name,type:'TEXT',notnull:0,dflt_value:null,pk:name==='id'?1:0})) as any;}
    const m=s.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+GROUP BY\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/is);if(!m)throw new Error(`Web local database: unsupported SELECT: ${s.slice(0,120)}`);
    let rows=(this.state[m[2]]||[]).map(clone);if(m[3])rows=rows.filter(r=>matchWhere(r,m[3],params));
    if(m[4]){const groups=m[4].split(',').map(x=>x.trim());const map=new Map<string,Row>();for(const r of rows){const k=JSON.stringify(groups.map(g=>r[g]));const existing=map.get(k);if(existing){for(const col of splitTopLevel(m[1])){const cm=col.match(/^COUNT\(\*\)\s+(?:AS\s+)?(\w+)$/i);if(cm)existing[cm[1]]=(existing[cm[1]]||0)+1;}}else{const o:Row={};groups.forEach(g=>o[g]=r[g]);const cm=splitTopLevel(m[1]).find(x=>/^COUNT\(\*\)/i.test(x));if(cm){const alias=cm.match(/^COUNT\(\*\)\s+(?:AS\s+)?(\w+)$/i)?.[1]||'c';o[alias]=1;}map.set(k,o);}}rows=[...map.values()];}
    const selectPart=m[1].trim();if(selectPart!=='*'&&!/COUNT\(\*\)/i.test(selectPart)){const cols=splitTopLevel(selectPart).map(x=>x.trim().replace(/\s+AS\s+\w+$/i,''));rows=rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));}else if(/^COUNT\(\*\)/i.test(selectPart)){const alias=selectPart.match(/COUNT\(\*\)\s+(?:AS\s+)?(\w+)/i)?.[1]||'c';rows=[{[alias]:rows.length}];}
    if(m[5]){const order=splitTopLevel(m[5])[0].trim();const om=order.match(/^(?:datetime\()?([\w]+)\)?(?:\s+COLLATE\s+NOCASE)?(?:\s+(ASC|DESC))?/i);if(om){const col=om[1],desc=(om[2]||'ASC').toUpperCase()==='DESC';rows.sort((a,b)=>{const av=a[col],bv=b[col];const aa=String(av??''),bb=String(bv??'');const an=Date.parse(aa),bn=Date.parse(bb);const cmp=Number.isNaN(an)||Number.isNaN(bn)?aa.localeCompare(bb,undefined,{numeric:true,sensitivity:'base'}):an-bn;return desc?-cmp:cmp;});}}
    if(m[6])rows=rows.slice(0,Number(m[6]));return rows as any;
  }
}

class TauriDb implements DbLike{
  private db:any;
  async init(){
    // Ensure a real SQLite file exists in the app data directory. The bundled
    // data/ifc_academy.db is only a clean template and is copied once; an existing
    // live database is NEVER overwritten.
    try{
      const fs=await import('@tauri-apps/plugin-fs');
      try{await fs.mkdir('.', {baseDir:fs.BaseDirectory.AppData, recursive:true});}catch{}
      let exists=false;
      try{await fs.stat('ifc_academy.db',{baseDir:fs.BaseDirectory.AppData});exists=true;}catch{}
      if(!exists){
        try{
          const seed=await fs.readFile('data/ifc_academy.db',{baseDir:fs.BaseDirectory.Resource});
          await fs.writeFile('ifc_academy.db',seed,{baseDir:fs.BaseDirectory.AppData});
        }catch(e){console.warn('Bundled local SQLite template was not copied; SQLite will create a fresh database.',e);}
      }
    }catch(e){console.warn('Local SQLite bootstrap skipped:',e);}
    const mod=await import('@tauri-apps/plugin-sql');
    this.db=await mod.default.load('sqlite:ifc_academy.db');
    return this;
  }
  select<T=Row[]>(sql:string,params?:any[]){return this.db.select(sql,params||[]) as Promise<T>;}
  execute(sql:string,params?:any[]){return this.db.execute(sql,params||[]).then(()=>undefined);}
}

async function ensureColumn(db:DbLike, table:string, column:string, definition:string){const columns=await db.select<any[]>(`PRAGMA table_info(${table})`);if(!columns.some(c=>c.name===column))await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);}
async function initializeSchema(db:DbLike){for(const statement of schema)await db.execute(statement);for(const [table,column,definition] of [['payments','coverage_start','TEXT'],['payments','coverage_end','TEXT'],['payments','duration_months','INTEGER DEFAULT 1'],['payments','due_amount','INTEGER DEFAULT 0'],['payments','remaining_amount','INTEGER DEFAULT 0'],['app_notifications','is_trash','INTEGER DEFAULT 0'],['player_sessions','updated_at',"TEXT DEFAULT ''"],['payments','updated_at',"TEXT DEFAULT ''"],['expenses','updated_at',"TEXT DEFAULT ''"],['coaches','updated_at',"TEXT DEFAULT ''"],['monthly_archives','updated_at',"TEXT DEFAULT ''"],['monthly_archives','attendance',"TEXT DEFAULT '[]'"],['monthly_archives','attendance_count','INTEGER DEFAULT 0'],['monthly_archives','present_count','INTEGER DEFAULT 0'],['monthly_archives','absent_count','INTEGER DEFAULT 0'],['monthly_archives','excused_count','INTEGER DEFAULT 0'],['app_notifications','updated_at',"TEXT DEFAULT ''"],['pending_password_change','new_username',"TEXT DEFAULT ''"]] as const)await ensureColumn(db,table,column,definition);for(const t of ['players','player_sessions','payments','expenses','coaches','monthly_archives','app_notifications'])await db.execute(`UPDATE ${t} SET updated_at=COALESCE(NULLIF(updated_at,''),created_at) WHERE updated_at IS NULL OR updated_at=''`);for(const t of ['players','player_sessions','payments','expenses','coaches','academy_settings','monthly_archives','app_notifications']){await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_ins AFTER INSERT ON ${t} BEGIN INSERT INTO sync_outbox(table_name,record_id,operation,changed_at) VALUES ('${t}',NEW.id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END`);await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_del AFTER DELETE ON ${t} BEGIN INSERT OR REPLACE INTO sync_tombstones(table_name,record_id,deleted_at) VALUES ('${t}',OLD.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')); INSERT INTO sync_outbox(table_name,record_id,operation,changed_at) VALUES ('${t}',OLD.id,'delete',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END`);await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_upd AFTER UPDATE ON ${t} WHEN NEW.updated_at=OLD.updated_at BEGIN UPDATE ${t} SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.id; END`);await db.execute(`CREATE TRIGGER IF NOT EXISTS trg_sync_${t}_upd_queue AFTER UPDATE ON ${t} BEGIN INSERT INTO sync_outbox(table_name,record_id,operation,changed_at) VALUES ('${t}',NEW.id,'upsert',COALESCE(NULLIF(NEW.updated_at,''),strftime('%Y-%m-%dT%H:%M:%fZ','now'))); END`);}}
export async function getDb():Promise<DbLike>{if(dbPromise)return dbPromise;if(typeof window==='undefined')throw new Error('قاعدة البيانات تحتاج بيئة متصفح.');dbPromise=(async()=>{const db=isDesktopApp()?await new TauriDb().init():new WebDb();await initializeSchema(db);return db;})();return dbPromise;}

export function nowIso(){return new Date().toISOString();}
export function id(prefix:string){return `${prefix}-${crypto.randomUUID()}`;}
export function json<T>(value:any,fallback:T):T{try{return typeof value==='string'?JSON.parse(value):value??fallback}catch{return fallback;}}
export function bool(value:any,fallback=false){if(value===undefined||value===null)return fallback;return Boolean(Number(value));}

export async function initializeLocalDatabase(){await getDb();await ensureAdmin();await ensureSettings();}

export async function ensureAdmin(){const db=await getDb();const rows=await db.select<any[]>('SELECT * FROM admin_credentials WHERE id = 1');if(!rows.length){const h=await hashPassword('1234567');await db.execute('INSERT INTO admin_credentials (id,username,password_hash,password_salt,updated_at) VALUES (1,?,?,?,?)',['admin',h.hash,h.salt,nowIso()]);}}
export async function ensureSettings(){const db=await getDb();const rows=await db.select<any[]>('SELECT * FROM academy_settings WHERE id = 1');if(!rows.length){const s=defaultSettings;await db.execute(`INSERT INTO academy_settings (id,academy_name,logo_text,phone,email,address,currency,current_season,whatsapp_notifications_enabled,sms_alerts_enabled,custom_logo_url,color_theme,primary_color,background_color,navbar_color,desktop_notifications_enabled,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[1,s.academyName,s.logoText,s.phone,s.email,s.address,s.currency,s.currentSeason,s.whatsappNotificationsEnabled?1:0,s.smsAlertsEnabled?1:0,s.customLogoUrl,s.colorTheme,s.primaryColor,s.backgroundColor,s.navbarColor,s.desktopNotificationsEnabled?1:0,nowIso()]);}}

export async function hashPassword(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256);const hex=(a:Uint8Array)=>Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('');return{hash:hex(new Uint8Array(bits)),salt:hex(salt)};}
export async function verifyPassword(password:string,storedHash:string,storedSalt:string){const salt=new Uint8Array(storedSalt.match(/.{1,2}/g)?.map(x=>parseInt(x,16))||[]);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256);const actual=Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');return actual===storedHash;}

let snapshotInFlight=false;let snapshotTimer:number|undefined;
export function scheduleDatabaseSnapshot(delayMs=1500){if(snapshotTimer)window.clearTimeout(snapshotTimer);snapshotTimer=window.setTimeout(()=>{void syncDatabaseSnapshot();},delayMs);}
export async function syncDatabaseSnapshot(){if(!isDesktopApp())return;if(snapshotInFlight)return;snapshotInFlight=true;try{const db=await getDb();try{await db.execute('PRAGMA wal_checkpoint(PASSIVE)');}catch{}const fs=await import('@tauri-apps/plugin-fs');await fs.mkdir('IFC Academy Data',{baseDir:fs.BaseDirectory.Document,recursive:true});let bytes:Uint8Array|null=null;for(const baseDir of [fs.BaseDirectory.AppData,fs.BaseDirectory.AppConfig,fs.BaseDirectory.Data]){try{bytes=await fs.readFile('ifc_academy.db',{baseDir});break;}catch{}}if(!bytes)throw new Error('لم يتم العثور على ملف قاعدة SQLite الحية.');await fs.writeFile('IFC Academy Data/ifc_academy.db',bytes,{baseDir:fs.BaseDirectory.Document});await fs.writeFile('IFC Academy Data/README_DATA.txt',new TextEncoder().encode('IFC Academy - Local SQLite Data\n\nAutomatic snapshot of the live local database.\n'),{baseDir:fs.BaseDirectory.Document});}catch(e){console.warn('Automatic local database snapshot failed:',e);}finally{snapshotInFlight=false;}}
