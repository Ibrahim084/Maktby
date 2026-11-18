import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Download,
  FileArchive,
  FileText,
  Layers,
  RotateCcw,
  Upload,
  Users,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  cleanupOrphanedAttachmentGenerations,
  createInitialGiftedCoordinatorRecord,
  exportGiftedFullBackupZip,
  getActiveGenerationAttachmentsForRecord,
  getDefaultGiftedAttachmentRepository,
  getGiftedGenderedTerms,
  GIFTED_PRE_V4_BACKUP_STORAGE_KEY,
  GiftedCoordinatorRecord,
  GiftedMainEngineId,
  importAndRestoreGiftedFullBackupZip,
  loadGiftedRecordFromStorage,
  resolveGiftedBasicInfo,
  runSafeGiftedV4Migration,
  saveGiftedRecordToStorage,
} from '../../utils/giftedRecordEngine';
import { normalizeApprovedSemester } from '../../utils/settingsStorage';
import { GiftedCoordinatorWorksEngine } from './GiftedCoordinatorWorksEngine';
import { GiftedProgramsLibrarySection } from './GiftedProgramsLibrarySection';
import { GiftedReportsEngine } from './GiftedReportsEngine';
import { GiftedStudentsRegistrySection } from './GiftedStudentsRegistrySection';

interface HubSectionTab {
  id: GiftedMainEngineId;
  code: '01' | '02' | '03' | '04';
  title: string;
  icon: React.ReactNode;
}

const APPROVED_HUB_SECTIONS: HubSectionTab[] = [
  {
    id: 'students',
    code: '01',
    title: 'الطلاب والطالبات',
    icon: <Users className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'programs',
    code: '02',
    title: 'البرامج والتقارير والمبادرات',
    icon: <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'coordinator_works',
    code: '03',
    title: 'نماذج أخرى',
    icon: <Briefcase className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: 'reports',
    code: '04',
    title: 'التقارير',
    icon: <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />,
  },
];

export const GiftedCoordinatorHub: React.FC = () => {
  const { settings } = useSettings();
  const gender = settings.gender === 'female' ? 'female' : 'male';
  const terms = useMemo(() => getGiftedGenderedTerms(gender), [gender]);

  const [record, setRecord] = useState<GiftedCoordinatorRecord>(() =>
    loadGiftedRecordFromStorage(undefined, settings)
  );
  const [activeEngine, setActiveEngine] =
    useState<GiftedMainEngineId>('students');

  const [backupBanner, setBackupBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const zipInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedInfo = useMemo(
    () => resolveGiftedBasicInfo(record, settings),
    [record, settings]
  );
  const centralSemesterLabel = normalizeApprovedSemester(settings.semester);

  const updateRecord = (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => {
    setRecord((prev) => {
      const next = {
        ...updater(prev),
        updatedAt: new Date().toISOString(),
      };
      saveGiftedRecordToStorage(next);
      return next;
    });
  };

  const refreshAttachmentList = async (
    targetRecord?: GiftedCoordinatorRecord
  ) => {
    try {
      const repo = getDefaultGiftedAttachmentRepository();
      const list = await repo.listAttachments();
      const activeRec = targetRecord ?? record;
      getActiveGenerationAttachmentsForRecord(activeRec, list);
    } catch {
      // Ignore in environments without IndexedDB
    }
  };

  useEffect(() => {
    const initAttachments = async () => {
      try {
        await cleanupOrphanedAttachmentGenerations({ activeRecord: record });
      } catch {
        // Ignore cleanup errors safely
      }
      await refreshAttachmentList(record);
    };
    void initAttachments();
  }, []);

  const handleExportZipBackup = async () => {
    setIsExportingZip(true);
    setBackupBanner(null);
    try {
      const repo = getDefaultGiftedAttachmentRepository();
      const { zipBytes, filename, manifest } = await exportGiftedFullBackupZip(
        record,
        {
          attachmentRepo: repo,
          settings,
        }
      );

      const blob = new Blob([new Uint8Array(zipBytes)], {
        type: 'application/zip',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      setBackupBanner({
        type: 'success',
        message: `تم تصدير النسخة الاحتياطية (${filename}) بنجاح (عدد المرفقات: ${manifest.attachmentsCount}).`,
      });
    } catch (error) {
      setBackupBanner({
        type: 'error',
        message:
          error instanceof Error
            ? `تعذر تصدير النسخة الاحتياطية: ${error.message}`
            : 'حدث خطأ غير متوقع أثناء تصدير ملف ZIP.',
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleImportZipFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingZip(true);
    setBackupBanner(null);
    try {
      const buffer = await file.arrayBuffer();
      const zipBytes = new Uint8Array(buffer);
      const repo = getDefaultGiftedAttachmentRepository();
      const result = await importAndRestoreGiftedFullBackupZip(zipBytes, {
        attachmentRepo: repo,
        replaceExistingAttachments: true,
      });
      setRecord(result.record);
      await refreshAttachmentList(result.record);
      setBackupBanner({
        type: 'success',
        message: `تمت استعادة السجل بنجاح من ملف (${file.name}) مع (${result.restoredAttachmentsCount}) مرفق.`,
      });
    } catch (error) {
      setBackupBanner({
        type: 'error',
        message:
          error instanceof Error
            ? `فشلت استعادة النسخة الاحتياطية: ${error.message}`
            : 'ملف النسخة الاحتياطية غير صالح أو تالف.',
      });
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) {
        zipInputRef.current.value = '';
      }
    }
  };

  const handleResetRecord = async () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(GIFTED_PRE_V4_BACKUP_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
    const fresh = createInitialGiftedCoordinatorRecord(
      record.basicInfo.schoolStage,
      undefined,
      settings
    );
    const migrated = runSafeGiftedV4Migration(fresh).record;
    saveGiftedRecordToStorage(migrated);
    setRecord(migrated);
    try {
      const repo = getDefaultGiftedAttachmentRepository();
      await repo.clearAll();
      await refreshAttachmentList(migrated);
    } catch {
      // ignore
    }
    setConfirmResetOpen(false);
    setBackupBanner({
      type: 'info',
      message: `تمت إعادة ضبط سجل ${terms.coordinatorSingular} وفق الإعدادات المركزية الحالية.`,
    });
  };

  return (
    <div
      dir="rtl"
      data-testid="gifted-coordinator-hub"
      className="space-y-6 text-[#26323B]"
    >
      {/* الرأس الرئيسي وشريط الحفظ والنسخ الاحتياطي وإعادة الضبط */}
      <section className="rounded-2xl overflow-hidden border border-[#E6C7D0] bg-white shadow-xs print:hidden">
        <div className="bg-gradient-to-l from-[#26323B] via-[#312332] to-[#7F1D3F] text-white px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-white">
              سجل {terms.coordinatorSingular}
            </h2>
            <p className="text-xs sm:text-sm text-stone-200">
              العام الدراسي: {resolvedInfo.academicYear} — الفصل الدراسي:{' '}
              {centralSemesterLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={handleImportZipFile}
              className="hidden"
              data-testid="zip-restore-file-input"
            />

            <button
              type="button"
              data-testid="export-gifted-zip-btn"
              disabled={isExportingZip}
              onClick={handleExportZipBackup}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#7F1D3F] hover:bg-[#641631] border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isExportingZip
                  ? 'جاري التصدير...'
                  : 'تصدير نسخة احتياطية (ZIP)'}
              </span>
            </button>

            <button
              type="button"
              data-testid="import-gifted-zip-btn"
              disabled={isImportingZip}
              onClick={() => zipInputRef.current?.click()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isImportingZip ? 'جاري الاستعادة...' : 'استعادة من ملف (ZIP)'}
              </span>
            </button>

            {!confirmResetOpen ? (
              <button
                type="button"
                data-testid="reset-gifted-record-btn"
                onClick={() => setConfirmResetOpen(true)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white text-[#26323B] hover:bg-stone-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إعادة ضبط</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                <span className="text-xs font-semibold text-red-800">
                  تأكيد إعادة الضبط؟
                </span>
                <button
                  type="button"
                  data-testid="confirm-reset-gifted-record-btn"
                  onClick={handleResetRecord}
                  className="px-2 py-1 rounded bg-red-700 text-white text-xs font-bold cursor-pointer"
                >
                  نعم
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="px-2 py-1 rounded bg-white text-stone-700 border border-stone-300 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>

        {backupBanner && (
          <div
            data-testid="backup-status-banner"
            className={`px-6 py-3 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 border-t ${
              backupBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : backupBanner.type === 'error'
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : 'bg-[#F9EFF2] text-[#7F1D3F] border-[#E6C7D0]'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{backupBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBackupBanner(null)}
              className="text-xs underline cursor-pointer shrink-0"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* شريط التنقل المباشر بين الأقسام الأربعة المعتمدة فقط */}
        <nav
          aria-label="أقسام سجل منسق الموهوبين"
          data-testid="gifted-four-engines-nav"
          className="bg-[#FAF7F5] px-4 sm:px-6 py-3.5 border-t border-[#E6C7D0]/70"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {APPROVED_HUB_SECTIONS.map((sec) => {
              const isActive = activeEngine === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  data-testid={`gifted-engine-btn-${sec.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveEngine(sec.id)}
                  className={`min-h-[48px] px-4 py-3 rounded-xl border-2 text-right transition-all flex items-center gap-3 cursor-pointer ${
                    isActive
                      ? 'bg-[#7F1D3F] text-white border-[#7F1D3F] shadow-xs'
                      : 'bg-white text-[#26323B] border-stone-200 hover:border-[#E6C7D0] hover:bg-white/90'
                  }`}
                >
                  <span
                    data-testid={`gifted-engine-code-${sec.id}`}
                    className={`w-8 h-8 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#F9EFF2] text-[#7F1D3F]'
                    }`}
                  >
                    {sec.code}
                  </span>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold leading-snug">
                    {sec.icon}
                    <span>{sec.title}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
      </section>

      {/* القسم الأول: الطلاب والطالبات */}
      {activeEngine === 'students' && (
        <GiftedStudentsRegistrySection
          record={record}
          updateRecord={updateRecord}
          gender={gender}
        />
      )}

      {/* القسم الثاني: البرامج والتقارير والمبادرات */}
      {activeEngine === 'programs' && (
        <GiftedProgramsLibrarySection
          record={record}
          updateRecord={updateRecord}
          gender={gender}
          onRefreshAttachments={refreshAttachmentList}
        />
      )}

      {/* القسم الثالث: نماذج أخرى */}
      {activeEngine === 'coordinator_works' && (
        <GiftedCoordinatorWorksEngine
          record={record}
          settings={settings}
          updateRecord={updateRecord}
        />
      )}

      {/* القسم الرابع: التقارير */}
      {activeEngine === 'reports' && (
        <GiftedReportsEngine
          record={record}
          settings={settings}
          updateRecord={updateRecord}
        />
      )}
    </div>
  );
};
