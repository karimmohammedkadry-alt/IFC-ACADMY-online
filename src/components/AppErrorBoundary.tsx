import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, {error:Error|null}> {
  state={error:null as Error|null};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error('IFC Academy UI crash:',error,info);}
  render(){if(!this.state.error)return this.props.children;return <div dir="rtl" className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><div className="max-w-lg w-full rounded-3xl border border-rose-500/20 bg-slate-900 p-7 text-center shadow-2xl"><AlertTriangle className="w-12 h-12 text-rose-400 mx-auto"/><h1 className="text-2xl font-black mt-4">حدث خطأ في واجهة النظام</h1><p className="text-slate-400 mt-2">تم إيقاف الجزء المتعطل بدل ترك الصفحة معلقة. بياناتك المحفوظة لا يتم حذفها بسبب الخطأ.</p><div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-rose-200 text-right break-words">{this.state.error.message||'خطأ غير معروف'}</div><button onClick={()=>window.location.reload()} className="mt-5 px-5 py-3 rounded-xl bg-white/10 border border-white/10 font-bold flex items-center gap-2 mx-auto"><RotateCcw className="w-4 h-4"/>إعادة تشغيل النظام</button></div></div>}
}
