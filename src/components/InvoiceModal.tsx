import React, { useState } from 'react';
import { notifyToast } from '../utils/toast';
import { X, Printer, ShieldCheck, Download, CheckCircle, Calendar, CreditCard, User, Award, Image as ImageIcon, FileDown, Loader2 } from 'lucide-react';
import { PaymentRecord } from '../types';
import { formatDateTimeArabic } from '../utils/dateUtils';
import { IFCLogo } from './IFCLogo';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceModalProps {
  payment: PaymentRecord | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ payment, onClose }) => {
  if (!payment) return null;

  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'image' | 'pdf' | null>(null);

  const isSalary = payment.type === 'راتب مدرب';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    const el = document.getElementById('printable-invoice');
    if (!el) return;
    setIsExporting(true);
    setExportType('image');
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        backgroundColor: '#090d16',
        useCORS: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `إيصال_${payment.invoiceNumber}_${payment.playerName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download invoice image:', err);
      notifyToast('error', 'تنبيه النظام', 'تعذر إنشاء صورة الإيصال. يرجى استخدام زر الطباعة.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('printable-invoice');
    if (!el) return;
    setIsExporting(true);
    setExportType('pdf');
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        backgroundColor: '#090d16',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 16;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 8, 12, imgWidth, imgHeight);
      pdf.save(`إيصال_${payment.invoiceNumber}_${payment.playerName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to download invoice PDF:', err);
      notifyToast('error', 'تنبيه النظام', 'تعذر إنشاء ملف PDF. يمكنك استخدام زر الطباعة والحفظ كـ PDF.');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-slate-200 animate-scaleUp my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Printable Receipt Container */}
        <div id="printable-invoice" className="p-6 bg-slate-950/70 border border-white/10 rounded-xl backdrop-blur-md text-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <IFCLogo size="md" withGlow />
              <div>
                <h3 className="font-black text-lg text-white tracking-wider font-sans uppercase">
                  IFC <span className={isSalary ? 'text-purple-400' : 'text-yellow-400'}>ACADEMY</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isSalary
                    ? 'سند صرف راتب مدرب كيك بوكسينغ رسمي'
                    : 'إيصال سداد اشتراك كيك بوكسينغ معتمد • IFC Fight Club'}
                </p>
              </div>
            </div>
            <div className="text-left">
              <span
                className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${
                  isSalary
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isSalary ? 'تم الصرف بنجاح' : 'سداد مؤكد'}
              </span>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">{payment.invoiceNumber}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
              <span className="text-slate-400 block mb-1">
                {isSalary ? 'اسم المدرب' : 'اسم اللاعب'}
              </span>
              <span className="font-bold text-white text-sm">{payment.playerName}</span>
            </div>

            {payment.memberNumber ? (
              <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
                <span className="text-slate-400 block mb-1">كود العضوية</span>
                <span className="font-bold font-mono text-blue-400 text-sm">
                  #{payment.memberNumber}
                </span>
              </div>
            ) : (
              <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
                <span className="text-slate-400 block mb-1">نوع المعاملة</span>
                <span className="font-bold text-purple-300 text-sm">رواتب الجهاز الفني</span>
              </div>
            )}

            <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
              <span className="text-slate-400 block mb-1">
                {isSalary ? 'المجموعات المشرف عليها' : 'المجموعة / الفرقة'}
              </span>
              <span className="font-semibold text-slate-200">
                {payment.team || 'كافة مجموعات الكيك بوكس'}
              </span>
            </div>

            <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
              <span className="text-slate-400 block mb-1">عن شهر</span>
              <span className="font-semibold text-slate-200">{payment.periodMonth}</span>
            </div>

            <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
              <span className="text-slate-400 block mb-1">طريقة الصرف / السداد</span>
              <span className="font-semibold text-cyan-300">{payment.method}</span>
            </div>

            <div className="bg-white/[0.03] p-3 rounded-lg border border-white/10 backdrop-blur-md">
              <span className="text-slate-400 block mb-1">تاريخ المعاملة</span>
              <span className="font-semibold text-slate-300 font-mono">{formatDateTimeArabic(payment.createdAt || payment.date)}</span>
            </div>
          </div>

          {/* Amount Box */}
          <div
            className={`border rounded-xl p-3.5 flex items-center justify-between mb-4 backdrop-blur-md ${
              isSalary
                ? 'bg-purple-600/15 border-purple-500/30'
                : 'bg-blue-600/15 border-blue-500/30'
            }`}
          >
            <div>
              <span className="text-xs text-slate-300">
                {isSalary ? 'المبلغ المنصرف للمدرب:' : 'المبلغ الإجمالي المدفوع:'}
              </span>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {payment.notes ||
                  (isSalary
                    ? 'صرف راتب شهر تدريبي معتمد'
                    : 'سداد قيمة الاشتراك الرياضي بالكامل')}
              </div>
            </div>
            <div
              className={`text-2xl font-black font-mono ${
                isSalary ? 'text-purple-300' : 'text-emerald-400'
              }`}
            >
              {payment.amount.toLocaleString()}{' '}
              <span className="text-xs text-slate-300 font-normal">ج.م</span>
            </div>
          </div>

          {/* Footer of receipt */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-3">
            <div>
              المسؤول عن الصرف:{' '}
              <span className="text-slate-200 font-semibold">{payment.collectedBy}</span>
            </div>
            <div className="text-slate-500 font-mono">أكاديمية IFC كيك بوكسينغ • معتمد إلكترونياً</div>
          </div>
        </div>

        {/* Action Buttons: Image, PDF, Print, Close */}
        <div className="flex items-center justify-between gap-2 mt-5 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/10 transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Download Image */}
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadImage}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="تحميل الإيصال كصورة عالية الجودة PNG"
            >
              {isExporting && exportType === 'image' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
              )}
              <span>تحميل صورة</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="تحميل الإيصال كملف PDF"
            >
              {isExporting && exportType === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span>تحميل PDF</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                isSalary
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/25'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فورية</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
