import React, { useState } from 'react';
import {
  Award,
  Plus,
  Phone,
  DollarSign,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Edit,
  AlertTriangle,
  Users,
  ExternalLink,
} from 'lucide-react';
import { Coach } from '../types';
import { exportToExcel } from '../utils/excelExport';
import { DateFilterBar } from '../components/DateFilterBar';
import { ImportExportToolbar } from '../components/ImportExportToolbar';

interface CoachesViewProps {
  coaches: Coach[];
  onAddCoach: (coach: Coach) => void;
  onUpdateCoach: (id: string, updates: Partial<Coach>) => void;
  onDeleteCoach: (id: string) => void;
  onPaySalary: (coachId: string) => void;
  onSelectCoach: (coach: Coach) => void;
  onImportCoaches?: (data: any) => void;
  isAmountsVisible?: boolean;
  onToggleAmountsVisible?: () => void;
}

export const CoachesView: React.FC<CoachesViewProps> = ({
  coaches,
  onAddCoach,
  onUpdateCoach,
  onDeleteCoach,
  onPaySalary,
  onSelectCoach,
  onImportCoaches,
  isAmountsVisible = true,
  onToggleAmountsVisible,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [coachToDelete, setCoachToDelete] = useState<Coach | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['شباب']);

  const availableGroups = ['شباب', 'براعم', 'ناشئين', 'بنات'];

  const handleOpenAdd = () => {
    setEditingCoach(null);
    setName('');
    setPhone('');
    setSalary('');
    setSelectedGroups([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setName(coach.name.replace(/^كابتن\s*\/\s*/, ''));
    setPhone(coach.phone || '');
    setSalary(coach.monthlySalary ? String(coach.monthlySalary) : '');
    setSelectedGroups(coach.teams && coach.teams.length > 0 ? coach.teams : []);
    setIsModalOpen(true);
  };

  const handleGroupToggle = (groupName: string) => {
    if (selectedGroups.includes(groupName)) {
      setSelectedGroups(selectedGroups.filter((g) => g !== groupName));
    } else {
      setSelectedGroups([...selectedGroups, groupName]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const formattedName = name.trim().startsWith('كابتن')
      ? name.trim()
      : `كابتن / ${name.trim()}`;

    if (editingCoach) {
      onUpdateCoach(editingCoach.id, {
        name: formattedName,
        phone: phone.trim(),
        monthlySalary: salary.trim() ? Number(salary) : 0,
        teams: selectedGroups,
      });
    } else {
      const newCoach: Coach = {
        id: `coach-${Date.now()}`,
        name: formattedName,
        avatarUrl: `https://images.unsplash.com/photo-${1560250097 + Math.floor(Math.random() * 500)}?w=150&auto=format&fit=crop&q=80`,
        role: 'مدرب',
        sport: 'كيك بوكسينغ',
        teams: selectedGroups,
        phone: phone.trim(),
        monthlySalary: salary.trim() ? Number(salary) : 0,
        joinDate: new Date().toISOString().split('T')[0],
        status: 'نشط',
        sessionsCountThisMonth: 8,
      };
      onAddCoach(newCoach);
    }

    setIsModalOpen(false);
    setEditingCoach(null);
    setName('');
    setPhone('');
    setSalary('');
    setSelectedGroups([]);
  };

  const handleConfirmDelete = () => {
    if (coachToDelete) {
      onDeleteCoach(coachToDelete.id);
      setCoachToDelete(null);
    }
  };

  const formatMoney = (val: number) => {
    if (!isAmountsVisible) return '•••• ج.م';
    return `${val.toLocaleString()} ج.م`;
  };

  const getCleanPhone = (phoneStr: string) => {
    return phoneStr.replace(/[^0-9]/g, '');
  };

  const handleExportCoachesCsv = () => {
    const headers = ['اسم المدرب', 'المسمى الوظيفي', 'الرياضة', 'المجموعات', 'رقم الهاتف', 'الراتب الشهري', 'تاريخ الانضمام', 'الحالة'];
    const rows = coaches.map((c) => [
      c.name,
      c.role,
      c.sport,
      c.teams.join(' - '),
      c.phone,
      c.monthlySalary,
      c.joinDate,
      c.status,
    ]);
    exportToExcel('قائمة_مدربي_الأكاديمية', headers, rows);
  };

  const filteredCoaches = coaches.filter((c) => {
    if (selectedDate === 'ALL') return true;
    return c.joinDate === selectedDate;
  });

  return (
    <div id="view-coaches" className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 backdrop-blur-md">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة المدربين والجهاز الفني</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              متابعة كباتن الأكاديمية، المجموعات المسندة، وصرف الرواتب الشهرية (اضغط على المدرب لفتح الملف الشخصي)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onToggleAmountsVisible && (
            <button
              onClick={onToggleAmountsVisible}
              className="px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-semibold text-xs rounded-xl flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
              title={isAmountsVisible ? 'إخفاء الرواتب' : 'إظهار الرواتب'}
            >
              {isAmountsVisible ? (
                <>
                  <EyeOff className="w-4 h-4 text-blue-400" />
                  <span>إخفاء الرواتب</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>إظهار الرواتب</span>
                </>
              )}
            </button>
          )}

          {/* Import / Export Toolbar */}
          <ImportExportToolbar
            onExport={handleExportCoachesCsv}
            onImport={onImportCoaches}
            exportLabel="تصدير المدربين (Excel)"
            importLabel="استيراد مدربين"
            preferredSheets={['المدربين', 'Coaches', 'coaches']}
          />

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>إضافة مدرب جديد</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <DateFilterBar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        label="فلترة تاريخ انضمام المدربين بالتقويم:"
      />

      {/* Coaches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {coaches.map((coach) => (
          <div
            key={coach.id}
            onClick={() => onSelectCoach(coach)}
            className="bg-white/[0.04] border border-white/10 hover:border-purple-500/50 hover:bg-white/[0.06] rounded-2xl p-5 shadow-xl shadow-black/20 backdrop-blur-md relative group transition-all flex flex-col justify-between cursor-pointer"
          >
            <div>
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-lg group-hover:scale-105 transition-transform">
                    {coach.name.replace('كابتن / ', '').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors">
                      {coach.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      اضغط لعرض الملف وسجل الرواتب
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {coach.status}
                </span>
              </div>

              {/* Groups tags */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <span className="text-[11px] text-slate-400 block mb-1.5 font-semibold">
                  المجموعات المسندة:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {coach.teams && coach.teams.length > 0 ? (
                    coach.teams.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-xs border border-purple-500/25 backdrop-blur-md font-medium"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">لا توجد مجموعات</span>
                  )}
                </div>
              </div>

              {/* Contact info & salary */}
              <div className="mt-4 space-y-2 bg-white/[0.02] p-3 rounded-xl border border-white/5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <span>رقم الهاتف:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white font-bold">{coach.phone}</span>
                    {coach.phone && (
                      <a
                        href={`https://wa.me/2${getCleanPhone(coach.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                        title="مراسلة عبر واتساب"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>الراتب الشهري:</span>
                  </span>
                  <span className="font-mono font-bold text-purple-300 text-sm">
                    {formatMoney(coach.monthlySalary)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCoach(coach);
                }}
                className="flex-1 min-w-[100px] py-2 px-2.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>الملف الشخصي</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPaySalary(coach.id);
                }}
                className="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="صرف راتب للمدرب"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>الراتب</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(coach);
                }}
                className="py-2 px-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/30 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="تعديل بيانات المدرب"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCoachToDelete(coach);
                }}
                className="py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="حذف المدرب"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Coach Modal (Without Job Title / المسمى الوظيفي) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold backdrop-blur-md">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {editingCoach ? 'تعديل بيانات المدرب' : 'إضافة مدرب جديد'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingCoach ? `تحديث بيانات ${editingCoach.name}` : 'تسجيل بيانات الكابتن والراتب والمجموعات'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingCoach(null);
                }}
                className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اسم الكابتن / المدرب *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-purple-400 backdrop-blur-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  الراتب الشهري (ج.م) *
                </label>
                <input
                  type="text"
                  required
                  value={salary}
                  onChange={(e) => setSalary(e.target.value.replace(/\D/g, ''))}
                  placeholder="مثال: 5000"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-purple-300 font-bold focus:outline-hidden focus:border-purple-400 backdrop-blur-md font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم الهاتف (واتساب)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="01xxxxxxxxx"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-purple-400 backdrop-blur-md font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  المجموعات المسندة للتدريب
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableGroups.map((group) => {
                    const isSelected = selectedGroups.includes(group);
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => handleGroupToggle(group)}
                        className={`p-2 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/25 border-purple-500/50 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{group}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingCoach(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 border border-white/10 hover:bg-white/[0.12] transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 transition-all"
                >
                  {editingCoach ? 'حفظ التعديلات' : 'حفظ المدرب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Safe Delete Confirmation Modal */}
      {coachToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-rose-500/30 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative text-slate-200 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white text-center mb-1">
              تأكيد حذف المدرب
            </h3>
            <p className="text-xs text-slate-300 text-center mb-5">
              هل أنت متأكد من حذف <strong className="text-white">{coachToDelete.name}</strong> من قاعدة البيانات؟
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCoachToDelete(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                نعم، حذف المدرب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
