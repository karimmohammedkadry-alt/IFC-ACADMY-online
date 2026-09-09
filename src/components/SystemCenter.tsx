import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw, Trash2, RotateCcw, XCircle, CheckCircle2, History } from 'lucide-react';
import { fetchSystemHealth, fetchTrash, restoreTrashItem, permanentlyDeleteTrashItem, fetchAuditLog, getOfflineSyncStatus, syncOfflineChanges } from '../services/api';

export const SystemCenter: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [trash, setTrash] = useState<any>({ players: [], coaches: [], payments: [], expenses: [], archives: [] });
  const [audit, setAudit] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sync, setSync] = useState({ pending: 0, online: true });

  const refresh = async () => {
    setBusy(true); setMessage('');
    try {
      const [h, t, a, s] = await Promise.all([fetchSystemHealth(), fetchTrash(), fetchAuditLog(30), getOfflineSyncStatus()]);
      setHealth(h); setTrash(t); setAudit(a); setSync(s);
    } catch (e: any) { setMessage(e?.message || 'تعذر تحديث مركز النظام'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const restore = async (entity: string, id: string) => {
    setBusy(true);
    try { await restoreTrashItem(entity, id); await refresh(); }
    catch (e: any) { setMessage(e?.message || 'تعذر الاسترجاع'); setBusy(false); }
  };
  const permanent = async (entity: string, id: string) => {
    if (!window.confirm('سيتم حذف العنصر نهائيًا ولا يمكن استرجاعه. هل أنت متأكد؟')) return;
    setBusy(true);
    try { await permanentlyDeleteTrashItem(entity, id); await refresh(); }
    catch (e: any) { setMessage(e?.message || 'تعذر الحذف النهائي'); setBusy(false); }
  };

  const items = Object.entries(trash).flatMap(([entityKey, rows]: any) => (rows || []).map((x: any) => {
    const entity = ({ players: 'player', coaches: 'coach', payments: 'payment', expenses: 'expense', archives: 'archive' } as Record<string,string>)[entityKey] || entityKey;
    return {
      ...x,
      entity,
      label: entity === 'player' ? `${x.name} (#${x.member_number})` :
        entity === 'coach' ? x.name : entity === 'payment' ? `دفعة ${x.invoice_number || x.id}` :
        entity === 'expense' ? x.title : `أرشيف ${x.month_label || x.month_key || x.id}`
    };
  }));

  return <div className="mt-5 space-y-4">
    <div className="flex items-center justify-between gap-2">
      <div>
        <h3 className="font-black text-white flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> مركز صحة النظام</h3>
        <p className="text-xs text-slate-400 mt-1">فحص الاتصال وقاعدة البيانات وسجل العمليات وسلة المحذوفات.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={busy} className="btn-blue"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> تحديث</button>
    </div>
    {message && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200">{message}</div>}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="text-[11px] text-slate-400">حالة Supabase</div>
        <div className="mt-2 flex items-center gap-2 font-bold text-white">{health?.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}{health?.status === 'ok' ? 'متصل' : 'غير متاح'}</div>
        <div className="text-[10px] text-slate-500 mt-1">{health?.latencyMs != null ? `${health.latencyMs} ms` : '—'}</div>
      </div>
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="text-[11px] text-slate-400">سلة المحذوفات</div>
        <div className="mt-2 font-bold text-white">{items.length} عنصر</div>
      </div>
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="text-[11px] text-slate-400">المزامنة</div>
        <div className="mt-2 font-bold text-white">{sync.online ? 'متصل' : 'بدون إنترنت'} — {sync.pending} معلقة</div>
        <button type="button" onClick={async()=>{await syncOfflineChanges(); await refresh();}} className="mt-2 text-[10px] text-cyan-300">مزامنة الآن</button>
      </div>
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div className="text-[11px] text-slate-400">سجل العمليات</div>
        <div className="mt-2 font-bold text-white">{audit.length} آخر عملية</div>
      </div>
    </div>
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="font-bold text-white flex items-center gap-2 mb-3"><Trash2 className="w-4 h-4 text-rose-400" /> سلة المحذوفات</div>
      {items.length === 0 ? <div className="text-xs text-slate-500">السلة فارغة.</div> :
        <div className="space-y-2 max-h-80 overflow-auto">{items.map((x: any) => <div key={`${x.entity}-${x.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20">
          <div className="min-w-0"><div className="text-xs text-white truncate">{x.label}</div><div className="text-[10px] text-slate-500">{x.deleted_at ? new Date(x.deleted_at).toLocaleString('ar-EG') : ''}</div></div>
          <div className="flex gap-1 shrink-0"><button type="button" onClick={() => void restore(x.entity, x.id)} className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] flex items-center gap-1"><RotateCcw className="w-3 h-3"/> استرجاع</button><button type="button" onClick={() => void permanent(x.entity, x.id)} className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[10px] flex items-center gap-1"><Trash2 className="w-3 h-3"/> نهائي</button></div>
        </div>)}</div>}
    </div>
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="font-bold text-white flex items-center gap-2 mb-3"><History className="w-4 h-4 text-blue-400" /> آخر العمليات</div>
      <div className="space-y-1 max-h-52 overflow-auto">{audit.map((x:any)=><div key={x.id} className="text-[10px] text-slate-400 border-b border-white/5 py-1"><span className="text-white">{x.action}</span> — {x.route} — HTTP {x.status} — {x.created_at ? new Date(x.created_at).toLocaleString('ar-EG') : ''}</div>)}</div>
    </div>
  </div>;
};
