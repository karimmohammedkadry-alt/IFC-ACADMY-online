import React, { useMemo, useState } from 'react';
import { Trash2, RotateCcw, XCircle, RefreshCw, User, CreditCard, Banknote, Award, Archive, Bell } from 'lucide-react';

export type TrashItem = { id:string; entityType:string; recordId:string; label:string; deletedAt:string; payload:any };
export type NotificationTrashItem = { id:string; title:string; message:string; timestamp:string };

const icons:Record<string,React.ReactNode> = {
  players:<User className="w-4 h-4"/>, payments:<CreditCard className="w-4 h-4"/>, expenses:<Banknote className="w-4 h-4"/>, coaches:<Award className="w-4 h-4"/>, monthly_archives:<Archive className="w-4 h-4"/>, notifications:<Bell className="w-4 h-4"/>
};
const labels:Record<string,string> = {players:'لاعب',payments:'مدفوعات',expenses:'مصروف',coaches:'مدرب',monthly_archives:'أرشيف شهر',notifications:'إشعار'};

export const TrashView:React.FC<{
  items:TrashItem[];
  notificationItems?:NotificationTrashItem[];
  onRestore:(item:TrashItem)=>Promise<void>;
  onPermanentDelete:(item:TrashItem)=>Promise<void>;
  onRestoreNotification?:(id:string)=>Promise<void>;
  onPermanentDeleteNotification?:(id:string)=>Promise<void>;
  onRefresh:()=>Promise<void>;
  onEmpty?:()=>Promise<void>;
}> = ({items,notificationItems=[],onRestore,onPermanentDelete,onRestoreNotification,onPermanentDeleteNotification,onRefresh,onEmpty}) => {
  const [busy,setBusy]=useState<string|null>(null);
  const [filter,setFilter]=useState('all');
  const all = useMemo(()=>[
    ...items.map(x=>({kind:'record' as const,id:x.id,type:x.entityType,item:x})),
    ...notificationItems.map(x=>({kind:'notification' as const,id:x.id,type:'notifications',item:x}))
  ],[items,notificationItems]);
  const visible=all.filter(x=>filter==='all'||x.type===filter);
  const action=async(id:string,fn:()=>Promise<void>)=>{setBusy(id);try{await fn();}finally{setBusy(null);}};
  return <div className="space-y-5" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-black text-white flex items-center gap-2"><Trash2 className="w-6 h-6 text-rose-400"/>سلة المهملات</h1><p className="text-slate-400 text-sm mt-1">كل عنصر حُذف من الموقع يمكن استرجاعه أو حذفه نهائيًا.</p></div>
      <div className="flex items-center gap-2"><button onClick={()=>void action('refresh',onRefresh)} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold flex items-center gap-2"><RefreshCw className="w-4 h-4"/>تحديث</button>{(items.length>0||notificationItems.length>0)&&onEmpty&&<button onClick={()=>void action('empty',onEmpty)} className="px-3 py-2 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs font-bold">إفراغ السلة نهائيًا</button>}</div>
    </div>
    <div className="flex flex-wrap gap-2">
      {[['all','الكل'],['players','اللاعبين'],['payments','المدفوعات'],['expenses','المصروفات'],['coaches','المدربين'],['monthly_archives','الأرشيف'],['notifications','الإشعارات']].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filter===id?'bg-rose-500/15 text-rose-300 border-rose-500/30':'bg-white/5 text-slate-400 border-white/10'}`}>{label}</button>)}
    </div>
    {visible.length===0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-500">سلة المهملات فارغة.</div> : <div className="grid gap-3">{visible.map(entry=>{
      const x:any=entry.item; const label=entry.kind==='notification'?x.title:(x.label||labels[x.entityType]||x.entityType); const date=entry.kind==='notification'?x.timestamp:x.deletedAt;
      return <div key={`${entry.kind}-${entry.id}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 min-w-0"> <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-300 flex items-center justify-center shrink-0">{icons[entry.type]||<Trash2 className="w-4 h-4"/>}</div><div className="min-w-0"><div className="text-white font-bold truncate">{label}</div><div className="text-xs text-slate-500 mt-1">{labels[entry.type]||'إشعار'} • {date?new Date(date).toLocaleString('ar-EG'):''}</div>{entry.kind==='notification'&&<div className="text-xs text-slate-400 mt-1 truncate">{x.message}</div>}</div></div>
        <div className="flex gap-2"><button disabled={busy===entry.id} onClick={()=>void action(entry.id,()=>entry.kind==='notification'?onRestoreNotification?.(entry.id)||Promise.resolve():onRestore(entry.item))} className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><RotateCcw className="w-4 h-4"/>استرجاع</button><button disabled={busy===entry.id} onClick={()=>{if(confirm('سيتم حذف العنصر نهائيًا ولا يمكن استرجاعه. هل أنت متأكد؟'))void action(entry.id,()=>entry.kind==='notification'?onPermanentDeleteNotification?.(entry.id)||Promise.resolve():onPermanentDelete(entry.item));}} className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/25 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><XCircle className="w-4 h-4"/>حذف نهائي</button></div>
      </div>;
    })}</div>}
  </div>;
};
