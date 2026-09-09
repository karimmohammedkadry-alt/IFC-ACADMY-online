import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(ROOT, 'config.json');
const DEFAULT_CONFIG = {
  supabaseUrl: '',
  supabaseServiceRoleKey: '',
  dataDir: 'C:\\IFC_ACADEMY_DATA',
  intervalSeconds: 60,
  keepDailyBackups: 30
};

async function readConfig() {
  try {
    const c = JSON.parse(await fs.readFile(CONFIG, 'utf8'));
    return { ...DEFAULT_CONFIG, ...c };
  } catch {
    await fs.writeFile(CONFIG, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    throw new Error(`أنشئ إعدادات الاتصال أولاً داخل: ${CONFIG}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const dayKey = () => new Date().toISOString().slice(0, 10);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

async function fetchAll(config, table) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
    url.searchParams.set('select', '*');
    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        Range: `${offset}-${offset + pageSize - 1}`,
        Prefer: 'count=exact'
      }
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} - ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function atomicWrite(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, file);
}

async function pruneDailyBackups(dataDir, keep) {
  const dir = path.join(dataDir, 'Backups');
  const days = (await fs.readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const old of days.slice(Math.max(1, keep))) await fs.rm(path.join(dir, old), { recursive: true, force: true });
}

async function syncOnce(config) {
  const dataDir = path.resolve(config.dataDir);
  const latestDir = path.join(dataDir, 'Latest');
  const backupDir = path.join(dataDir, 'Backups');
  const logsDir = path.join(dataDir, 'Logs');
  await Promise.all([fs.mkdir(latestDir, { recursive: true }), fs.mkdir(backupDir, { recursive: true }), fs.mkdir(logsDir, { recursive: true })]);

  const tables = ['players', 'player_sessions', 'payments', 'expenses', 'coaches', 'academy_settings', 'monthly_archives', 'admin_credentials'];
  const snapshot = {};
  for (const table of tables) snapshot[table] = await fetchAll(config, table);

  // Never write credentials' password hashes/salts/tokens into local backups.
  snapshot.admin_credentials = snapshot.admin_credentials.map(({ password_hash, password_salt, session_token, ...safe }) => safe);

  const payload = JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Supabase', data: snapshot });
  const hash = sha(payload);
  const stateFile = path.join(dataDir, 'sync-state.json');
  let previous = null;
  try { previous = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}

  if (previous?.hash === hash) {
    await atomicWrite(path.join(dataDir, 'last-sync.txt'), new Date().toISOString());
    return { changed: false, hash, counts: Object.fromEntries(tables.map(t => [t, snapshot[t].length])) };
  }

  for (const table of tables) {
    await atomicWrite(path.join(latestDir, `${table}.json`), JSON.stringify(snapshot[table], null, 2));
  }
  await atomicWrite(path.join(latestDir, 'academy-backup.json'), JSON.stringify(snapshot, null, 2));
  await atomicWrite(stateFile, JSON.stringify({ hash, syncedAt: new Date().toISOString(), counts: Object.fromEntries(tables.map(t => [t, snapshot[t].length])) }, null, 2));
  await atomicWrite(path.join(dataDir, 'last-sync.txt'), new Date().toISOString());

  const today = dayKey();
  const dailyDir = path.join(backupDir, today);
  await fs.mkdir(dailyDir, { recursive: true });
  const dailyMarker = path.join(dailyDir, '.daily-created');
  try { await fs.access(dailyMarker); }
  catch {
    await atomicWrite(path.join(dailyDir, `backup-${stamp()}.json`), payload);
    await atomicWrite(dailyMarker, new Date().toISOString());
  }
  await pruneDailyBackups(dataDir, Number(config.keepDailyBackups) || 30);
  return { changed: true, hash, counts: Object.fromEntries(tables.map(t => [t, snapshot[t].length])) };
}

async function log(config, line) {
  const dir = path.resolve(config.dataDir, 'Logs');
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, `sync-${dayKey()}.log`), `[${new Date().toISOString()}] ${line}\n`, 'utf8');
}

async function main() {
  const config = await readConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('ضع supabaseUrl و supabaseServiceRoleKey داخل backup-agent/config.json');
  }
  await log(config, 'IFC sync agent started; interval=60s');
  while (true) {
    try {
      const result = await syncOnce(config);
      await log(config, `${result.changed ? 'SYNCED' : 'NO CHANGE'} ${JSON.stringify(result.counts)}`);
    } catch (error) {
      await log(config, `ERROR ${error?.stack || error}`);
    }
    await sleep(Math.max(15, Number(config.intervalSeconds) || 60) * 1000);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
