import React, { useRef, useState } from 'react';
import { notifyToast } from '../utils/toast';
import { Download, Upload, Loader2 } from 'lucide-react';

interface ImportExportToolbarProps {
  onExport: () => void;
  onImport?: (rows: any) => void | Promise<void>;
  exportLabel?: string;
  importLabel?: string;
  exportTitle?: string;
  importTitle?: string;
  className?: string;
  preferredSheets?: string[];
}

export const ImportExportToolbar: React.FC<ImportExportToolbarProps> = ({
  onExport,
  onImport,
  exportLabel = 'تصدير البيانات (Excel)',
  importLabel = 'استيراد ملف Excel',
  exportTitle = 'تصدير ملف البيانات إلى جهازك بصيغة إكسيل عربية',
  importTitle = 'استيراد بيانات من Excel أو CSV (.xlsx, .xls, .xlsm, .csv)',
  className = '',
  preferredSheets = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsm') && !lowerName.endsWith('.csv')) {
      notifyToast('error', 'صيغة غير مدعومة', 'الاستيراد متاح لملفات Excel وCSV (.xlsx و.xls و.xlsm و.csv).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setBusy(true);
    window.dispatchEvent(new CustomEvent('ifc-import-start', { detail: { name: file.name } }));
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) throw new Error('تعذر قراءة الملف.');
        // Parse Excel away from React's main thread so the page remains clickable during large imports.
        const worker = new Worker(new URL('../workers/excelImport.worker.ts', import.meta.url), { type: 'module' });
        const cleanup = () => worker.terminate();
        worker.onmessage = async (message: MessageEvent) => {
          try {
            const result = message.data;
            if (!result?.ok) throw new Error(result?.error || 'تعذر قراءة ملف Excel.');
            if (onImport) await onImport(result.rows);
          } catch (err) {
            console.error('Excel import error:', err);
            notifyToast('error', 'تعذر الاستيراد', err instanceof Error ? err.message : 'تعذر قراءة أو حفظ بيانات ملف Excel.');
          } finally {
            cleanup();
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };
        worker.onerror = (err) => {
          console.error('Excel worker error:', err);
          cleanup();
          setBusy(false);
          notifyToast('error', 'تعذر قراءة Excel', 'حدث خطأ أثناء تجهيز الملف. حاول مرة أخرى.');
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        worker.postMessage({ buffer, preferredSheets }, [buffer]);
      } catch (err) {
        console.error('Excel import setup error:', err);
        setBusy(false);
        notifyToast('error', 'تعذر الاستيراد', err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الملف.');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setBusy(false);
      notifyToast('error', 'تعذر قراءة الملف', 'لم يتمكن المتصفح من قراءة ملف Excel.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} dir="rtl">
      <input type="file" ref={fileInputRef} onChange={handleFileChange}
        accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/octet-stream,*/*" className="hidden" />
      <button type="button" onClick={onExport} title={exportTitle}
        className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer shadow-xs">
        <Download className="w-3.5 h-3.5 text-emerald-400" /><span>{exportLabel}</span>
      </button>
      {onImport && (
        <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} title={importTitle}
          className="px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-60 disabled:cursor-wait text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer shadow-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-blue-400" />}
          <span>{busy ? 'جاري الاستيراد...' : importLabel}</span>
        </button>
      )}
    </div>
  );
};
