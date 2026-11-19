import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileCheck2,
  Plus,
  Upload,
} from 'lucide-react';
import {
  EvidenceLineIcon,
  FormsLineIcon,
  PlansLineIcon,
  ReportsLineIcon,
  ResultsLineIcon,
} from '../brand/MaktbyIcons';
import { useSettings } from '../../context/SettingsContext';
import {
  APPROVED_SCHOOL_SEMESTERS,
  ApprovedSchoolSemester,
} from '../../types';
import {
  exportPdFullBackupZip,
  getDefaultPdAttachmentRepository,
  getOrCreatePeriodRecord,
  getPdGenderedTerms,
  importAndRestorePdFullBackupZip,
  loadPdUnitStore,
  PdMainTabId,
  PdUnitStore,
  savePdUnitStore,
  SCHOOL_STAGE_CODES,
  SchoolStageCode,
  switchPdActivePeriod,
  updatePeriodRecord,
} from '../../utils/pdCoordinatorEngine';
import { PdEvaluationEngine } from './PdEvaluationEngine';
import { PdExecutionReportEngine } from './PdExecutionReportEngine';
import { PdGeneralPlanEngine } from './PdGeneralPlanEngine';
import { PdQuarterlyHoursReportEngine } from './PdQuarterlyHoursReportEngine';

interface PdSectionHubProps {
  onOpenCertificateForm: (
    formId: 'pd-trainer-certificate' | 'pd-trainee-certificate'
  ) => void;
}

const PD_HUB_TABS: Array<{
  id: PdMainTabId;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'general-plan',
    label: '01. الخطة العامة',
    icon: <PlansLineIcon className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'execution-report',
    label: '02. تقرير تنفيذ البرامج',
    icon: <ReportsLineIcon className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'evaluation',
    label: '03. نموذج تقييم برنامج',
    icon: <FormsLineIcon className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'quarterly-hours',
    label: '04. التقرير الفصلي للساعات',
    icon: <ResultsLineIcon className="w-4 h-4 shrink-0" />,
  },
  {
    id: 'certificates',
    label: 'الشهادات المعتمدة',
    icon: <EvidenceLineIcon className="w-4 h-4 shrink-0" />,
  },
];

export const PdSectionHub: React.FC<PdSectionHubProps> = ({
  onOpenCertificateForm,
}) => {
  const { settings } = useSettings();
  const [store, setStore] = useState<PdUnitStore>(() =>
    loadPdUnitStore(undefined, settings)
  );
  const [activeTab, setActiveTab] = useState<PdMainTabId>('general-plan');
  const [customYearInput, setCustomYearInput] = useState('');
  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const zipInputRef = useRef<HTMLInputElement | null>(null);

  const commitStore = (updater: (prev: PdUnitStore) => PdUnitStore) => {
    setStore((prev) => {
      const next = updater(prev);
      savePdUnitStore(next);
      return next;
    });
  };

  const activeYear = store.activeAcademicYear;
  const activeSemester = store.activeSemester;

  const { period: activePeriod } = useMemo(
    () => getOrCreatePeriodRecord(store, activeYear, activeSemester),
    [store, activeYear, activeSemester]
  );

  const availableYears = useMemo(() => {
    const set = new Set<string>([activeYear]);
    for (const p of Object.values(store.periods)) {
      set.add(p.academicYear);
    }
    return Array.from(set).sort().reverse();
  }, [activeYear, store.periods]);

  const handleSelectPeriod = (year: string, semester: ApprovedSchoolSemester) => {
    commitStore((prev) => switchPdActivePeriod(prev, year, semester));
  };

  const handleAddOrOpenPeriodYear = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customYearInput.trim();
    if (!cleaned) return;
    handleSelectPeriod(cleaned, activeSemester);
    setCustomYearInput('');
  };

  const handleToggleStage = (stage: SchoolStageCode) => {
    commitStore((prev) =>
      updatePeriodRecord(prev, activeYear, activeSemester, (p) => {
        const exists = p.schoolStages.includes(stage);
        const nextStages = exists
          ? p.schoolStages.filter((s) => s !== stage)
          : [...p.schoolStages, stage];
        return { ...p, schoolStages: nextStages };
      })
    );
  };

  const handleExportZip = async () => {
    setIsExportingZip(true);
    setBackupNotice(null);
    try {
      const repo = getDefaultPdAttachmentRepository();
      const { zipBytes, filename, attachmentsCount } =
        await exportPdFullBackupZip(store, repo);
      const blob = new Blob([new Uint8Array(zipBytes)], {
        type: 'application/zip',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setBackupNotice({
        type: 'success',
        message: `تم تصدير النسخة الاحتياطية الكاملة لوحدة التطوير المهني (${filename}) مع (${attachmentsCount}) شاهد مصور.`,
      });
    } catch (err) {
      setBackupNotice({
        type: 'error',
        message:
          err instanceof Error
            ? `تعذر التصدير: ${err.message}`
            : 'حدث خطأ أثناء إنشاء النسخة الاحتياطية.',
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingZip(true);
    setBackupNotice(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const repo = getDefaultPdAttachmentRepository();
      const { store: restored, restoredAttachmentsCount } =
        await importAndRestorePdFullBackupZip(buf, repo, settings);
      savePdUnitStore(restored);
      setStore(restored);
      setBackupNotice({
        type: 'success',
        message: `تمت استعادة سجلات وحدة التطوير المهني بنجاح (${restoredAttachmentsCount} مرفق).`,
      });
    } catch (err) {
      setBackupNotice({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'تعذر قراءة ملف النسخة الاحتياطية.',
      });
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  return (
    <div dir="rtl" data-testid="pd-section-hub" className="space-y-5">
      {/* Period Selector & Backup Controls (Completely Isolated from Central Settings) */}
      <section className="rounded-2xl border border-[#E2E5E6] bg-white p-5 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold font-display text-stone-900">
              إدارة العام والفصل الدراسي وسجلات وحدة التطوير المهني
            </h2>
            <p className="text-xs text-stone-500">
              اختيار العام والفصل هنا مستقل عن إعدادات «مكتبي» المركزية، ويتيح استعراض الأعوام السابقة وفصل النماذج الأربعة بين الفصلين الأول والثاني.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleExportZip()}
              disabled={isExportingZip}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#477B59]" aria-hidden="true" />
              <span>
                {isExportingZip ? 'جاري التصدير...' : 'تصدير نسخة احتياطية ZIP'}
              </span>
            </button>

            <label className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-[#477B59]" aria-hidden="true" />
              <span>{isImportingZip ? 'جاري الاستعادة...' : 'استعادة نسخة ZIP'}</span>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(e) => void handleImportZip(e)}
              />
            </label>
          </div>
        </div>

        {backupNotice && (
          <div
            role="status"
            className={`rounded-lg border px-3.5 py-2.5 text-xs font-semibold ${
              backupNotice.type === 'success'
                ? 'border-[#C5DCC7] bg-[#EEF5EE] text-[#2F6846]'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {backupNotice.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Year Switcher + Historical Year Creation */}
          <div className="lg:col-span-5 min-w-0 space-y-1.5">
            <label
              htmlFor="pd-period-year-select"
              className="block text-xs font-bold text-stone-700"
            >
              العام الدراسي للسجل (أو الأرشيف):
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
              <select
                id="pd-period-year-select"
                value={activeYear}
                onChange={(e) => handleSelectPeriod(e.target.value, activeSemester)}
                className="shrink-0 min-h-[40px] px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <form
                onSubmit={handleAddOrOpenPeriodYear}
                className="flex flex-1 min-w-[160px] items-center gap-1.5"
              >
                <label htmlFor="pd-custom-year-input" className="sr-only">
                  إضافة أو فتح عام دراسي سابق أو جديد
                </label>
                <input
                  id="pd-custom-year-input"
                  type="text"
                  value={customYearInput}
                  onChange={(e) => setCustomYearInput(e.target.value)}
                  placeholder="أضف عاماً (مثل 1447هـ)"
                  className="w-full flex-1 min-w-0 min-h-[40px] px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 tabular-nums focus:outline-none focus:border-[#477B59]"
                />
                <button
                  type="submit"
                  aria-label="فتح العام الدراسي"
                  className="shrink-0 min-h-[40px] px-3 rounded-lg border border-[#477B59] text-[#477B59] hover:bg-[#E1EFE5] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>فتح</span>
                </button>
              </form>
            </div>
          </div>

          {/* Semester Segmented Toggle (First / Second only) */}
          <div className="lg:col-span-4 min-w-0 space-y-1.5">
            <span className="block text-xs font-bold text-stone-700">
              الفصل الدراسي (خطة وتقارير مستقلة):
            </span>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-stone-100 rounded-lg border border-stone-200 min-w-0">
              {APPROVED_SCHOOL_SEMESTERS.map((sem) => {
                const selected = activeSemester === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSelectPeriod(activeYear, sem)}
                    className={`flex-1 min-h-[34px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'bg-[#477B59] text-white'
                        : 'text-stone-700 hover:text-stone-900 hover:bg-white'
                    }`}
                  >
                    {sem}
                  </button>
                );
              })}
            </div>
          </div>

          {/* School Stage Checkboxes (ب / م / ث) */}
          <div className="lg:col-span-3 min-w-0 space-y-1.5">
            <span className="block text-xs font-bold text-stone-700">
              المرحلة الدراسية المعتمدة بالخطة والتقرير الفصلي:
            </span>
            <div className="flex flex-wrap items-center gap-3 min-h-[42px] px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50">
              {SCHOOL_STAGE_CODES.map((stage) => {
                const checked = activePeriod.schoolStages.includes(stage);
                return (
                  <label
                    key={stage}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleStage(stage)}
                      className="w-4 h-4 accent-[#477B59] cursor-pointer"
                    />
                    <span>{stage}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          aria-label="أقسام وحدة التطوير المهني"
          className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100"
        >
          {PD_HUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#477B59] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      {/* Active Sub-Engine Content */}
      {activeTab === 'general-plan' && (
        <PdGeneralPlanEngine
          period={activePeriod}
          settings={settings}
          onUpdatePlan={(updater) =>
            commitStore((prev) =>
              updatePeriodRecord(prev, activeYear, activeSemester, (p) => ({
                ...p,
                generalPlan: updater(p.generalPlan),
              }))
            )
          }
        />
      )}

      {activeTab === 'execution-report' && (
        <PdExecutionReportEngine
          period={activePeriod}
          settings={settings}
          onUpdateExecution={(updater) =>
            commitStore((prev) =>
              updatePeriodRecord(prev, activeYear, activeSemester, (p) => ({
                ...p,
                executionReport: updater(p.executionReport),
              }))
            )
          }
        />
      )}

      {activeTab === 'evaluation' && (
        <PdEvaluationEngine
          period={activePeriod}
          settings={settings}
          onUpdateEvaluations={(updater) =>
            commitStore((prev) =>
              updatePeriodRecord(prev, activeYear, activeSemester, (p) => ({
                ...p,
                evaluations: updater(p.evaluations),
              }))
            )
          }
        />
      )}

      {activeTab === 'quarterly-hours' && (
        <PdQuarterlyHoursReportEngine
          period={activePeriod}
          settings={settings}
          onUpdateQuarterlyConfig={(updater) =>
            commitStore((prev) =>
              updatePeriodRecord(prev, activeYear, activeSemester, (p) => ({
                ...p,
                quarterlyConfig: updater(p.quarterlyConfig),
              }))
            )
          }
        />
      )}

      {activeTab === 'certificates' && (
        <section
          className="rounded-2xl border border-[#E2E5E6] bg-white p-6 space-y-5"
          data-testid="pd-certificates-panel"
        >
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold font-display text-stone-900">
                الشهادات المعتمدة (شهادة مدرب · شهادة متدرب)
              </h3>
              <p className="text-xs sm:text-sm text-stone-600">
                تفتح نماذج شهادات المدربين والمتدربين المعتمدة بنفس تصميمها وخصائصها الأصلية وتصدير PDF / ZIP الكامل دون أي تغيير.
              </p>
            </div>
            <FileCheck2 className="w-6 h-6 text-[#477B59] shrink-0" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="rounded-xl border border-[#E2E5E6] p-5 flex flex-col justify-between gap-4 bg-white">
              <div className="space-y-1.5">
                <h4 className="text-base sm:text-lg font-bold font-display text-stone-900">
                  شهادة شكر وتقدير لمدرب / منفذ برنامج
                </h4>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {getPdGenderedTerms(settings.gender).certificateTrainerLinkDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenCertificateForm('pd-trainer-certificate')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>فتح نموذج شهادة المدرب</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>

            <article className="rounded-xl border border-[#E2E5E6] p-5 flex flex-col justify-between gap-4 bg-white">
              <div className="space-y-1.5">
                <h4 className="text-base sm:text-lg font-bold font-display text-stone-900">
                  شهادة حضور وإتمام لمتدرب (دفعات ZIP)
                </h4>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  إصدار شهادات حضور رسمية (A4 أفقي) بصيغة PDF منفردة أو مجمعة لمتعددي المتدربين دفعة واحدة في ملف ZIP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenCertificateForm('pd-trainee-certificate')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>فتح نموذج شهادة المتدرب</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          </div>
        </section>
      )}
    </div>
  );
};
