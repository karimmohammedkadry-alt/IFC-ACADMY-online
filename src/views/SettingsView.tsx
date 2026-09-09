import React, { useEffect, useRef, useState } from 'react';
import {
  Settings as SettingsIcon, Save, ShieldCheck, Bell, Download, RotateCcw,
  CheckCircle, MessageSquare, HardDrive, Volume2, Play, Upload, Palette,
  Monitor, KeyRound, UserRound, Building2, CalendarDays, Gauge, LockKeyhole,
  Database, Trash2, RefreshCw, Clock3, AlertTriangle, Zap, Server, HardDriveDownload
} from 'lucide-react';
import { AcademySettings } from '../types';
import { soundAlertManager } from '../utils/soundAlert';
import * as XLSX from 'xlsx';
import { SystemToast, SystemToastType } from '../components/SystemToast';
import { getDesktopNotificationPermission, requestDesktopNotificationPermission, sendDesktopNotification } from '../utils/desktopNotifier';
import { updateAdminCredentials } from '../services/api';

interface SettingsViewProps {
  settings: AcademySettings;
  onSaveSettings: (settings: AcademySettings) => void;
  onResetData: () => Promise<void>;
  onExportAllData: () => void;
  onImportAllData?: (data: any) => void;
  onStartNewMonth?: () => void;
  isDbConnected?: boolean;
  currentUsername?: string;
  onCredentialsChanged?: (username: string) => void;
}

type SecurityPrefs = {
  autoLockMinutes: number;
  confirmDangerousActions: boolean;
  soundsEnabled: boolean;
  cacheEnabled: boolean;
  autoBackupEnabled: boolean;
  backupRetentionDays: number;
  reducedMotion: boolean;
};

type AcademyPrefs = {
  monthlySessions: number;
  expiryWarningDays: number;
  oneSessionWarning: boolean;
  expiryWarning: boolean;
  expiredWarning: boolean;
};

const readLocal = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings, onSaveSettings, onResetData, onExportAllData, onImportAllData,
  onStartNewMonth, isDbConnected, currentUsername = 'admin', onCredentialsChanged,
}) => {
  const [formData, setFormData] = useState<AcademySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [tab, setTab] = useState<'academy' | 'subscriptions' | 'notifications' | 'appearance' | 'performance' | 'backup'>('academy');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testPhone, setTestPhone] = useState('01000000000');
  const [msgTemplate, setMsgTemplate] = useState(() => localStorage.getItem('ifc_whatsapp_template') || 'مرحباً ولي أمر اللاعب {اسم_اللاعب}، نذكركم بأن الاشتراك بقيمة {المبلغ_المستحق} ج.م يحتاج إلى التجديد.');
  const [desktopPermission, setDesktopPermission] = useState(getDesktopNotificationPermission());
  const [security, setSecurity] = useState<SecurityPrefs>(() => readLocal('ifc_security_prefs', { autoLockMinutes: 30, confirmDangerousActions: true, soundsEnabled: true, cacheEnabled: true, autoBackupEnabled: true, backupRetentionDays: 30, reducedMotion: false }));
  const [academyPrefs, setAcademyPrefs] = useState<AcademyPrefs>(() => readLocal('ifc_academy_prefs', { monthlySessions: 8, expiryWarningDays: 7, oneSessionWarning: true, expiryWarning: true, expiredWarning: true }));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ open: boolean; type: SystemToastType; title: string; message?: string }>({ open: false, type: 'success', title: '' });
  const [loginUsername, setLoginUsername] = useState(currentUsername || 'admin');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);

  useEffect(() => setFormData(settings), [settings]);
  useEffect(() => setLoginUsername(currentUsername || 'admin'), [currentUsername]);
  useEffect(() => localStorage.setItem('ifc_security_prefs', JSON.stringify(security)), [security]);
  useEffect(() => localStorage.setItem('ifc_academy_prefs', JSON.stringify(academyPrefs)), [academyPrefs]);

  const showToast = (type: SystemToastType, title: string, message?: string) => {
    setToast({ open: true, type, title, message });
    window.setTimeout(() => setToast(p => ({ ...p, open: false })), 3500);
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    localStorage.setItem('ifc_whatsapp_template', msgTemplate);
    localStorage.setItem('ifc_security_prefs', JSON.stringify(security));
    localStorage.setItem('ifc_academy_prefs', JSON.stringify(academyPrefs));
    await onSaveSettings(formData);
    setSavedSuccess(true);
    soundAlertManager.playSuccessTone();
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const saveCredentials = async () => {
    const username = loginUsername.trim();
    if (!username) return showToast('error', 'اسم المستخدم مطلوب');
    if (!newPassword) return showToast('error', 'اكتب كلمة المرور الجديدة');
    if (newPassword.length < 6) return showToast('error', 'كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل');
    if (newPassword !== confirmPassword) return showToast('error', 'تأكيد كلمة المرور غير مطابق');
    try {
      setSavingCredentials(true);
      const result = await updateAdminCredentials(username, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onCredentialsChanged?.(result.username || username);
      showToast('success', 'تم تغيير بيانات الدخول', 'تم حفظ اسم المستخدم وتحديث كلمة المرور في Supabase Auth بأمان.');
    } catch (e: any) {
      showToast('error', 'تعذر تغيير بيانات الدخول', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSavingCredentials(false);
    }
  };

  const requestDesktop = async () => {
    const granted = await requestDesktopNotificationPermission();
    setDesktopPermission(getDesktopNotificationPermission());
    if (granted) {
      setFormData(p => ({ ...p, desktopNotificationsEnabled: true }));
      sendDesktopNotification({ title: formData.academyName || 'IFC Academy', body: 'تم تفعيل إشعارات سطح المكتب بنجاح.', playSound: true, soundType: 'success' });
    }
  };

  const testWhatsApp = () => {
    const clean = testPhone.replace(/\D/g, '');
    const phone = clean.startsWith('0') ? `2${clean}` : clean;
    const msg = msgTemplate.replace('{اسم_اللاعب}', 'محمد أحمد').replace('{رقم_العضوية}', '1001').replace('{المبلغ_المستحق}', '500');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { showToast('error', 'استخدم ملف Excel فقط'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const workbook = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array', cellDates: true });
        const sheets: Record<string, any[]> = {};
        workbook.SheetNames.forEach(name => { sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: true }); });
        if (!Object.values(sheets).some(r => r.length)) throw new Error('ملف Excel فارغ.');
        await onImportAllData?.({ __format: 'ifc-excel-v2', ...sheets });
        showToast('success', 'تم إرسال النسخة للاسترجاع', 'سيتم تحديث البيانات بعد اكتمال الاستيراد.');
      } catch (e: any) { showToast('error', 'تعذر استرجاع النسخة', e?.message || 'تأكد من سلامة الملف.'); }
      finally { e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const localBackupPath = 'C:\\IFC_ACADEMY_DATA';
  const tabs = [
    ['academy', 'الأكاديمية', Building2], ['subscriptions', 'الاشتراكات', CalendarDays], ['notifications', 'الإشعارات', Bell],
    ['appearance', 'المظهر', Palette], ['performance', 'الأداء والأمان', Gauge], ['backup', 'النسخ الاحتياطي', HardDrive], ['account', 'بيانات الدخول', KeyRound],
  ] as const;

  return (
    <div id="view-settings" className="space-y-5 animate-fadeIn pb-12 max-w-6xl" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400"><SettingsIcon className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-black text-white">إعدادات الأكاديمية والنظام</h1><p className="text-xs text-slate-400 mt-1">مركز واحد للتحكم في التشغيل، الاشتراكات، الإشعارات، المظهر، الأداء، الأمان والنسخ الاحتياطي.</p></div>
        </div>
        <div className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${isDbConnected ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-300 bg-rose-500/10 border-rose-500/20'}`}>{isDbConnected ? '● قاعدة البيانات متصلة' : '● قاعدة البيانات غير متصلة'}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-2 p-2 rounded-2xl bg-white/[0.03] border border-white/10">
        {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className={`px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${tab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </div>

      <form onSubmit={save} className="space-y-5">
        {tab === 'account' && <>
          <Section title="تغيير اسم المستخدم وكلمة المرور" icon={<KeyRound className="w-4 h-4 text-amber-400" />}>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100 leading-6">
              غيّر بيانات الدخول من هنا. اسم المستخدم يُحفظ في ملف المدير وقاعدة البيانات، وكلمة المرور تُدار بواسطة Supabase Auth ولا يتم حفظها كنص مكشوف أو داخل كود الموقع.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="اسم المستخدم الجديد"><input autoComplete="username" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} /></Field>
              <div />
              <Field label="كلمة المرور الجديدة"><input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="6 أحرف/أرقام على الأقل" /></Field>
              <Field label="تأكيد كلمة المرور"><input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></Field>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setLoginUsername(currentUsername || 'admin'); setNewPassword(''); setConfirmPassword(''); }} className="btn-gray">إلغاء التعديل</button>
              <button type="button" disabled={savingCredentials} onClick={saveCredentials} className="btn-blue disabled:opacity-50">{savingCredentials ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {savingCredentials ? 'جاري الحفظ...' : 'حفظ بيانات الدخول'}</button>
            </div>
          </Section>
        </>}

        {tab === 'academy' && <>
          <Section title="بيانات الأكاديمية" icon={<Building2 className="w-4 h-4 text-blue-400" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="اسم الأكاديمية"><input value={formData.academyName} onChange={e => setFormData({...formData, academyName:e.target.value})} /></Field>
              <Field label="الاسم المختصر / الشعار"><input value={formData.logoText} onChange={e => setFormData({...formData, logoText:e.target.value})} /></Field>
              <Field label="الهاتف"><input value={formData.phone} onChange={e => setFormData({...formData, phone:e.target.value})} /></Field>
              <Field label="البريد الإلكتروني"><input value={formData.email} onChange={e => setFormData({...formData, email:e.target.value})} /></Field>
              <Field label="العنوان"><input value={formData.address} onChange={e => setFormData({...formData, address:e.target.value})} /></Field>
              <Field label="العملة"><input value={formData.currency} onChange={e => setFormData({...formData, currency:e.target.value})} /></Field>
              <Field label="الموسم الحالي"><input value={formData.currentSeason} onChange={e => setFormData({...formData, currentSeason:e.target.value})} /></Field>
            </div>
          </Section>
        </>}

        {tab === 'subscriptions' && <>
          <Section title="إعدادات الاشتراك والحصص" icon={<CalendarDays className="w-4 h-4 text-emerald-400" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField label="عدد حصص الاشتراك الشهري" value={academyPrefs.monthlySessions} min={1} max={31} onChange={v=>setAcademyPrefs(p=>({...p,monthlySessions:v}))} />
              <NumberField label="التنبيه قبل انتهاء الاشتراك (بالأيام)" value={academyPrefs.expiryWarningDays} min={1} max={30} onChange={v=>setAcademyPrefs(p=>({...p,expiryWarningDays:v}))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <Toggle label="تنبيه قرب انتهاء الاشتراك" checked={academyPrefs.expiryWarning} onChange={v=>setAcademyPrefs(p=>({...p,expiryWarning:v}))} />
              <Toggle label="تنبيه عند بقاء حصة واحدة" checked={academyPrefs.oneSessionWarning} onChange={v=>setAcademyPrefs(p=>({...p,oneSessionWarning:v}))} />
              <Toggle label="تنبيه الاشتراك المنتهي" checked={academyPrefs.expiredWarning} onChange={v=>setAcademyPrefs(p=>({...p,expiredWarning:v}))} />
            </div>
            <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">القيمة الحالية للحصص الشهرية: <b>{academyPrefs.monthlySessions}</b> حصص. تم ضبطها افتراضيًا على 8 ويمكن تغييرها من هنا.</div>
          </Section>
        </>}

        {tab === 'notifications' && <>
          <Section title="مركز الإشعارات والرسائل" icon={<Bell className="w-4 h-4 text-amber-400" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Toggle label="إشعارات واتساب" checked={formData.whatsappNotificationsEnabled} onChange={v=>setFormData({...formData, whatsappNotificationsEnabled:v})} />
              <Toggle label="تنبيهات سطح المكتب" checked={formData.desktopNotificationsEnabled !== false} onChange={v=>setFormData({...formData, desktopNotificationsEnabled:v})} />
              <Toggle label="تنبيهات SMS" checked={formData.smsAlertsEnabled} onChange={v=>setFormData({...formData, smsAlertsEnabled:v})} />
            </div>
            <div className="flex gap-2 flex-wrap mt-4">
              {desktopPermission !== 'granted' && <button type="button" onClick={requestDesktop} className="btn-blue"><Bell className="w-4 h-4" /> طلب إذن إشعارات المتصفح</button>}
              <button type="button" onClick={()=>sendDesktopNotification({title:formData.academyName||'IFC Academy',body:'هذا إشعار تجريبي من النظام.',playSound:true,soundType:'warning'})} className="btn-gray"><Play className="w-4 h-4" /> تجربة إشعار</button>
            </div>
          </Section>
          <Section title="قالب رسالة واتساب" icon={<MessageSquare className="w-4 h-4 text-emerald-400" />}>
            <textarea value={msgTemplate} onChange={e=>setMsgTemplate(e.target.value)} rows={5} className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-400" />
            <p className="text-[11px] text-slate-500 mt-2">المتغيرات: {'{اسم_اللاعب}'} — {'{رقم_العضوية}'} — {'{المبلغ_المستحق}'}</p>
            <div className="flex gap-2 mt-3"><input value={testPhone} onChange={e=>setTestPhone(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" placeholder="رقم الاختبار" /><button type="button" onClick={testWhatsApp} className="btn-green"><MessageSquare className="w-4 h-4" /> تجربة واتساب</button></div>
          </Section>
        </>}

        {tab === 'appearance' && <Section title="المظهر والهوية البصرية" icon={<Palette className="w-4 h-4 text-purple-400" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="رابط اللوجو"><input value={formData.customLogoUrl || ''} onChange={e=>setFormData({...formData,customLogoUrl:e.target.value})} placeholder="https://..." /></Field>
            <Field label="الثيم"><select value={formData.colorTheme || 'classic-blue'} onChange={e=>setFormData({...formData,colorTheme:e.target.value as any})}><option value="classic-blue">Classic Blue</option><option value="royal-gold">Royal Gold</option><option value="emerald">Emerald</option><option value="obsidian">Obsidian</option><option value="custom">Custom</option></select></Field>
            <ColorField label="اللون الأساسي" value={formData.primaryColor || '#2563eb'} onChange={v=>setFormData({...formData,primaryColor:v})}/>
            <ColorField label="لون الخلفية" value={formData.backgroundColor || '#020617'} onChange={v=>setFormData({...formData,backgroundColor:v})}/>
            <ColorField label="لون الشريط الجانبي" value={formData.navbarColor || '#0b1120'} onChange={v=>setFormData({...formData,navbarColor:v})}/>
          </div>
        </Section>}

        {tab === 'performance' && <>
          <Section title="الأداء والسرعة" icon={<Gauge className="w-4 h-4 text-cyan-400" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Toggle label="تفعيل التخزين المؤقت الآمن للقراءات" checked={security.cacheEnabled} onChange={v=>setSecurity(p=>({...p,cacheEnabled:v}))} />
              <Toggle label="تفعيل الأصوات والتنبيهات الخفيفة" checked={security.soundsEnabled} onChange={v=>setSecurity(p=>({...p,soundsEnabled:v}))} />
              <Toggle label="تفعيل النسخ الاحتياطي المحلي التلقائي" checked={security.autoBackupEnabled} onChange={v=>setSecurity(p=>({...p,autoBackupEnabled:v}))} />
              <Toggle label="تقليل الحركات والمؤثرات لتحسين السرعة" checked={security.reducedMotion} onChange={v=>setSecurity(p=>({...p,reducedMotion:v}))} />
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Stat icon={<Zap/>} label="السرعة" value="تحميل متوازي + تحديثات جزئية" />
              <Stat icon={<Server/>} label="المزامنة" value="Supabase هي قاعدة البيانات الأساسية" />
              <Stat icon={<HardDriveDownload/>} label="النسخة المحلية" value="مزامنة كل 60 ثانية" />
            </div>
            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 leading-6">النسخ المحلي يعمل من خلال Backup Agent على جهاز Windows ويأخذ نسخة من Supabase كل دقيقة عند وجود تغيير، مع إعادة المحاولة عند انقطاع الاتصال. مسار الحفظ الافتراضي: <b className="text-white font-mono">{localBackupPath}</b></div>
          </Section>
          <Section title="الأمان" icon={<LockKeyhole className="w-4 h-4 text-rose-400" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <NumberField label="قفل الجلسة بعد عدم النشاط (دقيقة)" value={security.autoLockMinutes} min={5} max={240} onChange={v=>setSecurity(p=>({...p,autoLockMinutes:v}))}/>
              <NumberField label="مدة الاحتفاظ بالنسخ الاحتياطية (يوم)" value={security.backupRetentionDays} min={1} max={365} onChange={v=>setSecurity(p=>({...p,backupRetentionDays:v}))}/>
              <Toggle label="طلب تأكيد قبل العمليات الخطرة" checked={security.confirmDangerousActions} onChange={v=>setSecurity(p=>({...p,confirmDangerousActions:v}))}/>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"><Stat icon={<ShieldCheck/>} label="الجلسة" value={`قفل تلقائي بعد ${security.autoLockMinutes} دقيقة`} /><Stat icon={<Gauge/>} label="الأداء" value={security.reducedMotion ? 'حركات مخففة' : 'الوضع العادي'} /><Stat icon={<HardDrive/>} label="النسخ" value={security.autoBackupEnabled ? `تلقائي / ${security.backupRetentionDays} يوم` : 'يدوي'} /></div>
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200">لا يتم عرض كلمات المرور أو مفاتيح Supabase في الواجهة. بيانات الدخول تُرسل للخادم فقط، وتحديث الجلسة يتم عبر مسار المصادقة.</div>
          </Section>
        </>}

        {tab === 'backup' && <>
          <Section title="النسخ الاحتياطي والاسترجاع" icon={<HardDrive className="w-4 h-4 text-blue-400" />}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importBackup}/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button type="button" onClick={onExportAllData} className="p-4 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/25 text-blue-200 font-bold text-xs flex items-center gap-3"><Download className="w-5 h-5"/> تصدير نسخة كاملة Excel</button>
              <button type="button" onClick={()=>fileInputRef.current?.click()} className="p-4 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/25 text-emerald-200 font-bold text-xs flex items-center gap-3"><Upload className="w-5 h-5"/> استرجاع نسخة Excel</button>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs text-slate-300"><Stat icon={<Database/>} label="البيانات" value="لاعبين + مدربين + حضور + مالية"/><Stat icon={<RefreshCw/>} label="المزامنة" value="كل 60 ثانية عند التغيير"/><Stat icon={<HardDrive/>} label="المجلد" value="C:\\IFC_ACADEMY_DATA"/><Stat icon={<ShieldCheck/>} label="الحماية" value="مفتاح Supabase السري محلي فقط"/></div>
            <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 leading-6">ملف Excel يظل خيار الاستيراد والاسترجاع للمستخدم. أما النسخة التلقائية كل دقيقة فتُحفظ محليًا كبيانات تشغيلية داخل <b>Latest</b> مع نسخة يومية داخل <b>Backups</b>.</div>
          </Section>
          <Section title="دورة الشهر" icon={<Clock3 className="w-4 h-4 text-amber-400" />}>
            <p className="text-xs text-slate-400">أرشفة بيانات الشهر وإطلاق دورة شهر جديدة مع الحفاظ على السجل التاريخي.</p>
            <button type="button" onClick={onStartNewMonth} className="btn-amber mt-3"><RefreshCw className="w-4 h-4"/> بدء دورة شهر جديدة</button>
          </Section>
          <Section title="منطقة خطرة" icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}>
            <button type="button" onClick={()=>setIsResetConfirmOpen(true)} className="btn-danger"><Trash2 className="w-4 h-4"/> تصفير بيانات الأكاديمية</button>
          </Section>
        </>}

        <div className="flex items-center justify-end gap-3 pt-1">
          {savedSuccess && <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle className="w-4 h-4"/> تم حفظ الإعدادات</span>}
          <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black shadow-lg shadow-blue-600/20"><Save className="w-4 h-4 inline ml-1"/> حفظ الإعدادات</button>
        </div>
      </form>

      {isResetConfirmOpen && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4"><AlertTriangle className="w-10 h-10 text-rose-400 mx-auto"/><h3 className="text-lg font-black text-white">تأكيد تصفير البيانات</h3><p className="text-xs text-slate-300 leading-6">سيتم حذف بيانات التشغيل من قاعدة البيانات. خذ نسخة احتياطية قبل الاستمرار.</p><div className="flex justify-center gap-2"><button type="button" onClick={()=>setIsResetConfirmOpen(false)} className="btn-gray">إلغاء</button><button type="button" disabled={resetting} onClick={async()=>{setResetting(true);try{await onResetData();setIsResetConfirmOpen(false);showToast('success','تم تصفير البيانات')}catch(e:any){showToast('error','تعذر التصفير',e?.message)}finally{setResetting(false)}}} className="btn-danger">{resetting?'جارٍ التنفيذ...':'تأكيد التصفير'}</button></div></div></div>}
      <SystemToast open={toast.open} type={toast.type} title={toast.title} message={toast.message} onClose={()=>setToast(p=>({...p,open:false}))}/>
      <style>{`.btn-blue,.btn-gray,.btn-green,.btn-amber,.btn-danger{display:inline-flex;align-items:center;gap:.45rem;padding:.65rem .9rem;border-radius:.75rem;font-size:.72rem;font-weight:800;transition:.2s}.btn-blue{background:rgba(37,99,235,.18);color:#bfdbfe;border:1px solid rgba(59,130,246,.3)}.btn-gray{background:rgba(255,255,255,.06);color:#cbd5e1;border:1px solid rgba(255,255,255,.12)}.btn-green{background:rgba(16,185,129,.16);color:#a7f3d0;border:1px solid rgba(16,185,129,.3)}.btn-amber{background:rgba(245,158,11,.15);color:#fde68a;border:1px solid rgba(245,158,11,.3)}.btn-danger{background:rgba(244,63,94,.12);color:#fda4af;border:1px solid rgba(244,63,94,.3)}.btn-blue:hover,.btn-gray:hover,.btn-green:hover,.btn-amber:hover,.btn-danger:hover{filter:brightness(1.15)}input,select{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:.75rem;padding:.7rem .8rem;color:white;outline:none;font-size:.78rem}select option{background:#0f172a;color:white}input:focus,select:focus{border-color:rgba(96,165,250,.7)}`}</style>
    </div>
  );
};

const Section: React.FC<{title:string;icon:React.ReactNode;children:React.ReactNode}> = ({title,icon,children}) => <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 shadow-xl shadow-black/10 space-y-4"><div className="flex items-center gap-2 border-b border-white/10 pb-3"><span>{icon}</span><h3 className="text-sm font-black text-white">{title}</h3></div>{children}</div>;
const Field: React.FC<{label:string;children:React.ReactNode}> = ({label,children}) => <label className="block"><span className="block text-xs text-slate-300 mb-1.5 font-bold">{label}</span>{children}</label>;
const NumberField: React.FC<{label:string;value:number;min:number;max:number;onChange:(v:number)=>void}> = ({label,value,min,max,onChange}) => <Field label={label}><input type="number" min={min} max={max} value={value} onChange={e=>onChange(Math.max(min,Math.min(max,Number(e.target.value)||min)))} /></Field>;
const ColorField: React.FC<{label:string;value:string;onChange:(v:string)=>void}> = ({label,value,onChange}) => <Field label={label}><div className="flex gap-2"><input type="color" value={value} onChange={e=>onChange(e.target.value)} className="!w-12 !p-1 h-10"/><input value={value} onChange={e=>onChange(e.target.value)} /></div></Field>;
const Toggle: React.FC<{label:string;checked:boolean;onChange:(v:boolean)=>void}> = ({label,checked,onChange}) => <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="w-4 h-4"/><span className="text-xs font-bold text-slate-200">{label}</span></label>;
const Stat: React.FC<{icon:React.ReactNode;label:string;value:string}> = ({icon,label,value}) => <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10"><div className="text-blue-400 mb-1">{icon}</div><div className="text-[10px] text-slate-500">{label}</div><div className="text-xs font-bold text-white mt-1">{value}</div></div>;
