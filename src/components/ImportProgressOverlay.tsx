import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

export type ImportProgress = {open:boolean;title:string;total:number;processed:number;saved:number;skipped:number;failed:number;message:string;errors:string[];startedAt:number;lastUpdate:number;done:boolean};
export const emptyImportProgress=():ImportProgress=>({open:false,title:'',total:0,processed:0,saved:0,skipped:0,failed:0,message:'',errors:[],startedAt:0,lastUpdate:0,done:false});

export const ImportProgressOverlay:React.FC<{progress:ImportProgress;onRestart:()=>void}> = ({progress,onRestart})=>{
  const [,setTick]=useState(0);
  useEffect(()=>{if(!progress.open)return;const t=window.setInterval(()=>setTick(x=>x+1),1000);return()=>window.clearInterval(t);},[progress.open]);
  if(!progress.open)return null;
  const pct=progress.total?Math.min(100,Math.round((progress.processed/progress.total)*100)):0;
  const stalled=!progress.done&&progress.lastUpdate>0&&Date.now()-progress.lastUpdate>15000;
  return <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-5" dir="rtl">
    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl p-6">
      <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">{progress.done?<CheckCircle2 className="w-7 h-7 text-emerald-400"/>:<Loader2 className="w-7 h-7 text-slate-300 animate-spin"/>}</div><div><h2 className="text-xl font-black text-white">{progress.done?'اكتمل الاستيراد':progress.title||'جاري استيراد البيانات'}</h2><p className="text-sm text-slate-400 mt-1">{progress.message}</p></div></div>
      <div className="mt-6 h-3 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-slate-300 transition-all duration-300" style={{width:`${pct}%`}}/></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center"><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-white">{progress.processed}</div><div className="text-[11px] text-slate-500">تمت المعالجة</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-emerald-300">{progress.saved}</div><div className="text-[11px] text-slate-500">تم الحفظ</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-amber-300">{progress.skipped}</div><div className="text-[11px] text-slate-500">تم التخطي</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-rose-300">{progress.failed}</div><div className="text-[11px] text-slate-500">أخطاء</div></div></div>
      {(stalled||progress.failed>0)&&<div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="flex gap-2 text-amber-300 font-bold text-sm"><AlertTriangle className="w-4 h-4 shrink-0"/>{stalled?'الاستيراد لا يتقدم منذ فترة. لو التطبيق علق يمكنك إعادة تشغيله بدون إغلاق البيانات المحفوظة.':'تم اكتشاف مشاكل في بعض الصفوف، وتم الاستمرار بدل إيقاف الاستيراد كله.'}</div>{progress.errors.length>0&&<div className="mt-2 max-h-28 overflow-auto text-xs text-slate-400 space-y-1">{progress.errors.slice(-8).map((e,i)=><div key={i}>• {e}</div>)}</div>}</div>}
      <div className="mt-5 flex justify-between items-center gap-3"><span className="text-xs text-slate-500">{progress.total?`${pct}% من ${progress.total} صف`:''}</span>{(stalled||progress.done)&&<button onClick={onRestart} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold flex items-center gap-2"><RotateCcw className="w-4 h-4"/>إعادة تشغيل النظام</button>}</div>
    </div>
  </div>;
};
