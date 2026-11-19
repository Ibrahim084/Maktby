import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FilePlus2,
  FileText,
  Filter,
  FolderKanban,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlink,
  Users,
  X,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { TeacherArchiveGroupId } from '../../utils/teacherArchiveEngine';
import {
  getTeacherColorPalette,
  TEACHER_TEMPLATE_DEFINITIONS,
} from '../../utils/teacherPdfEngine';
import {
  cleanupAllMissingPortfolioReferences,
  deleteStandaloneEvidenceFromElement,
  EligiblePortfolioSourceRecordItem,
  GeneratedTeacherPortfolioPdfResult,
  generateTeacherPortfolioPdf,
  hydrateLinkedRecordPhotosFromMediaRepo,
  initializeOrMigratePortfolioStore,
  linkRecordToPortfolioElement,
  listEligibleSourceRecords,
  loadStandaloneEvidenceWithMedia,
  ResolvedPortfolioElementSummary,
  ResolvedPortfolioLinkedItem,
  ResolvedPortfolioStandaloneItem,
  resolveFullPortfolioOverview,
  TEACHER_PORTFOLIO_ELEMENTS_CATALOG,
  TEACHER_PORTFOLIO_SOURCE_GROUPS,
  TeacherPortfolioElementId,
  unlinkRecordFromPortfolioElement,
  updatePortfolioLinkNote,
} from '../../utils/teacherPortfolioEngine';
import { PortfolioStandaloneEvidenceModal } from './PortfolioStandaloneEvidenceModal';

export interface TeacherPortfolioHubProps {
  onBackToTeacherHub: () => void;
  onNavigateToSourceGroup?: (
    groupId: TeacherArchiveGroupId,
    formId?: string
  ) => void;
}

export const TeacherPortfolioHub: React.FC<TeacherPortfolioHubProps> = ({
  onBackToTeacherHub,
  onNavigateToSourceGroup,
}) => {
  const { settings } = useSettings();
  const templateStyle = settings.teacherPdfTemplate ?? 'waves';
  const colorSystem = settings.teacherPdfColorSystem ?? 'green';
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];
  const palette = getTeacherColorPalette(colorSystem);

  const [refreshTick, setRefreshTick] = useState(0);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Selected Element state
  const [selectedElementId, setSelectedElementId] =
    useState<TeacherPortfolioElementId>('element-1');

  // Record Picker Drawer/Modal state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState<
    TeacherArchiveGroupId | 'all'
  >('all');
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerNoteByRecordKey, setPickerNoteByRecordKey] = useState<
    Record<string, string>
  >({});

  // Note editing state inside Element Detail
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Unlink confirmation modal state
  const [pendingUnlinkItem, setPendingUnlinkItem] =
    useState<ResolvedPortfolioLinkedItem | null>(null);

  // Source Record Live Preview modal state
  const [previewedItem, setPreviewedItem] =
    useState<ResolvedPortfolioLinkedItem | null>(null);
  const [previewHydratedPhotos, setPreviewHydratedPhotos] = useState<
    Array<{ id: string; imageDataUrl: string; blobKey?: string }>
  >([]);
  const [isHydratingPhotos, setIsHydratingPhotos] = useState(false);

  // Standalone Evidence Modal state (Create / Edit)
  const [standaloneModalState, setStandaloneModalState] = useState<{
    element: ResolvedPortfolioElementSummary;
    mode: 'create' | 'edit';
    editingEvidenceId?: string;
  } | null>(null);

  // Standalone Evidence Preview Modal state
  const [previewedStandaloneItem, setPreviewedStandaloneItem] =
    useState<ResolvedPortfolioStandaloneItem | null>(null);
  const [previewStandalonePhotos, setPreviewStandalonePhotos] = useState<
    Array<{ id: string; imageDataUrl: string; blobKey?: string }>
  >([]);
  const [isHydratingStandalonePhotos, setIsHydratingStandalonePhotos] =
    useState(false);

  // Standalone Delete Confirmation Modal state
  const [pendingDeleteStandaloneItem, setPendingDeleteStandaloneItem] =
    useState<ResolvedPortfolioStandaloneItem | null>(null);
  const [isDeletingStandalone, setIsDeletingStandalone] = useState(false);

  // Deletion Audit Log modal/panel toggle
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  // Unified PDF Preview & Export state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatedPdfResult, setGeneratedPdfResult] =
    useState<GeneratedTeacherPortfolioPdfResult | null>(null);
  const [activePdfPreviewPage, setActivePdfPreviewPage] = useState(0);

  // Safe idempotent initialization on mount
  useEffect(() => {
    const initRes = initializeOrMigratePortfolioStore();
    if (!initRes.ok && initRes.error) {
      setStorageWarning(initRes.error);
    } else {
      setStorageWarning(null);
    }
    setRefreshTick((t) => t + 1);
  }, []);

  const overview = useMemo(() => {
    void refreshTick;
    return resolveFullPortfolioOverview();
  }, [refreshTick]);

  const activeElement: ResolvedPortfolioElementSummary = useMemo(() => {
    return (
      overview.elements.find((e) => e.id === selectedElementId) ||
      overview.elements[0]
    );
  }, [overview.elements, selectedElementId]);

  const eligibleSourceRecords: EligiblePortfolioSourceRecordItem[] =
    useMemo(() => {
      void refreshTick;
      if (!isPickerOpen) return [];
      return listEligibleSourceRecords({
        groupId: pickerGroupId,
        searchQuery: pickerSearchQuery,
      });
    }, [isPickerOpen, pickerGroupId, pickerSearchQuery, refreshTick]);

  // Hydrate photos from IndexedDB whenever a source record is opened for preview
  useEffect(() => {
    let cancelled = false;
    if (!previewedItem || !previewedItem.sourceRecord) {
      setPreviewHydratedPhotos([]);
      setIsHydratingPhotos(false);
      return;
    }

    setIsHydratingPhotos(true);
    hydrateLinkedRecordPhotosFromMediaRepo(previewedItem.sourceRecord)
      .then((res) => {
        if (!cancelled) {
          setPreviewHydratedPhotos(res.photos);
          setIsHydratingPhotos(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewHydratedPhotos([]);
          setIsHydratingPhotos(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewedItem]);

  // Hydrate photos from IndexedDB whenever a standalone evidence is opened for preview
  useEffect(() => {
    let cancelled = false;
    if (!previewedStandaloneItem) {
      setPreviewStandalonePhotos([]);
      setIsHydratingStandalonePhotos(false);
      return;
    }

    setIsHydratingStandalonePhotos(true);
    loadStandaloneEvidenceWithMedia({
      elementId: previewedStandaloneItem.elementId,
      evidenceId: previewedStandaloneItem.evidence.id,
    })
      .then((res) => {
        if (!cancelled) {
          setPreviewStandalonePhotos(res?.photos || []);
          setIsHydratingStandalonePhotos(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewStandalonePhotos([]);
          setIsHydratingStandalonePhotos(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewedStandaloneItem]);

  const handleOpenPickerForElement = useCallback(
    (elementId: TeacherPortfolioElementId) => {
      setSelectedElementId(elementId);
      setPickerGroupId('all');
      setPickerSearchQuery('');
      setIsPickerOpen(true);
    },
    []
  );

  const handleOpenStandaloneCreate = useCallback(
    (element: ResolvedPortfolioElementSummary) => {
      setSelectedElementId(element.id);
      setStandaloneModalState({
        element,
        mode: 'create',
      });
    },
    []
  );

  const handleOpenStandaloneEdit = useCallback(
    (
      element: ResolvedPortfolioElementSummary,
      item: ResolvedPortfolioStandaloneItem
    ) => {
      setSelectedElementId(element.id);
      setStandaloneModalState({
        element,
        mode: 'edit',
        editingEvidenceId: item.evidence.id,
      });
    },
    []
  );

  const handleConfirmDeleteStandalone = useCallback(async () => {
    if (!pendingDeleteStandaloneItem || isDeletingStandalone) return;
    setIsDeletingStandalone(true);
    try {
      const target = pendingDeleteStandaloneItem;
      const res = await deleteStandaloneEvidenceFromElement({
        elementId: target.elementId,
        evidenceId: target.evidence.id,
      });
      setPendingDeleteStandaloneItem(null);
      if (!res.ok) {
        setFeedbackBanner({
          type: 'error',
          message: res.errorMessage || 'تعذر حذف الشاهد المستقل.',
        });
        return;
      }
      setRefreshTick((t) => t + 1);
      setFeedbackBanner({
        type: 'info',
        message: `تم حذف الشاهد المستقل «${target.evidence.title}» من العنصر بنجاح.`,
      });
    } finally {
      setIsDeletingStandalone(false);
    }
  }, [pendingDeleteStandaloneItem, isDeletingStandalone]);

  const handleLinkRecord = useCallback(
    (item: EligiblePortfolioSourceRecordItem) => {
      const recKey = `${item.groupId}::${item.record.id}`;
      const note = pickerNoteByRecordKey[recKey] || '';

      const res = linkRecordToPortfolioElement({
        elementId: activeElement.id,
        sourceGroupId: item.groupId,
        sourceRecordId: item.record.id,
        note,
      });

      if (!res.ok) {
        setFeedbackBanner({
          type: 'error',
          message:
            res.errorMessage || 'تعذر ربط السجل بعنصر الأداء الوظيفي المحدد.',
        });
        return;
      }

      setPickerNoteByRecordKey((prev) => {
        const next = { ...prev };
        delete next[recKey];
        return next;
      });
      setRefreshTick((t) => t + 1);
      setFeedbackBanner({
        type: 'success',
        message: `تم ربط السجل «${item.record.title}» مرجعيًا بالعنصر (${activeElement.number}): ${activeElement.title}`,
      });
    },
    [activeElement, pickerNoteByRecordKey]
  );

  const handleStartEditNote = useCallback((item: ResolvedPortfolioLinkedItem) => {
    const key = `${item.elementId}::${item.ref.sourceGroupId}::${item.ref.sourceRecordId}`;
    setEditingNoteKey(key);
    setEditingNoteText(item.ref.note || '');
  }, []);

  const handleSaveEditedNote = useCallback(
    (item: ResolvedPortfolioLinkedItem) => {
      const res = updatePortfolioLinkNote({
        elementId: item.elementId,
        sourceGroupId: item.ref.sourceGroupId,
        sourceRecordId: item.ref.sourceRecordId,
        note: editingNoteText,
      });

      if (!res.ok) {
        setFeedbackBanner({
          type: 'error',
          message: res.errorMessage || 'تعذر حفظ الملاحظة التوثيقية.',
        });
        return;
      }

      setEditingNoteKey(null);
      setEditingNoteText('');
      setRefreshTick((t) => t + 1);
      setFeedbackBanner({
        type: 'success',
        message: 'تم حفظ الملاحظة التوثيقية للارتباط بنجاح.',
      });
    },
    [editingNoteText]
  );

  const handleConfirmUnlink = useCallback(() => {
    if (!pendingUnlinkItem) return;
    const target = pendingUnlinkItem;
    const res = unlinkRecordFromPortfolioElement({
      elementId: target.elementId,
      sourceGroupId: target.ref.sourceGroupId,
      sourceRecordId: target.ref.sourceRecordId,
    });

    setPendingUnlinkItem(null);

    if (!res.ok) {
      setFeedbackBanner({
        type: 'error',
        message: res.errorMessage || 'تعذر فك ارتباط الشاهد.',
      });
      return;
    }

    setRefreshTick((t) => t + 1);
    setFeedbackBanner({
      type: 'info',
      message:
        'تم فك ارتباط الشاهد من هذا العنصر مع بقاء السجل الأصلي محفوظًا وسليمًا في مجموعته المصدرية.',
    });
  }, [pendingUnlinkItem]);

  const handleCleanupMissingReferences = useCallback(() => {
    const res = cleanupAllMissingPortfolioReferences();
    if (!res.ok) {
      setFeedbackBanner({
        type: 'error',
        message: res.errorMessage || 'تعذر تنظيف المراجع المفقودة.',
      });
      return;
    }
    setRefreshTick((t) => t + 1);
    setFeedbackBanner({
      type: 'success',
      message: `تمت إزالة ${res.removedCount} مرجع مفقود/يتيم من ملف الشواهد بأمان.`,
    });
  }, []);

  const handleGenerateAndPreviewPdf = useCallback(async () => {
    setIsGeneratingPdf(true);
    setFeedbackBanner(null);
    try {
      const result = await generateTeacherPortfolioPdf({
        settings,
        templateStyle,
        colorSystem,
      });
      setGeneratedPdfResult(result);
      setActivePdfPreviewPage(0);
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        message:
          err instanceof Error
            ? `تعذر توليد ملف PDF الموحد: ${err.message}`
            : 'تعذر توليد ملف PDF الموحد.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [settings, templateStyle, colorSystem]);

  const handleDownloadGeneratedPdf = useCallback(
    (pdfResult: GeneratedTeacherPortfolioPdfResult) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
      }
      const blob = new Blob([new Uint8Array(pdfResult.pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfResult.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    []
  );

  return (
    <section
      aria-labelledby="teacher-portfolio-hub-heading"
      data-testid="teacher-portfolio-hub"
      className="space-y-6"
    >
      {/* Top Navigation & Status Bar */}
      <div className="bg-white rounded-2xl border border-[#E2E5E6] p-4 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <button
            type="button"
            data-testid="back-to-teacher-hub-from-portfolio-btn"
            onClick={onBackToTeacherHub}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قسم المعلم</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-portfolio-audit-log-btn"
              onClick={() => setIsAuditLogOpen((v) => !v)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-700 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-[#416B91]" aria-hidden="true" />
              <span>
                سجل تدقيق الحذف ({overview.deletionAuditLog.length})
              </span>
            </button>

            <button
              type="button"
              data-testid="export-unified-portfolio-pdf-btn"
              disabled={isGeneratingPdf}
              onClick={handleGenerateAndPreviewPdf}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isGeneratingPdf
                  ? 'جاري تجهيز ملف الشواهد PDF...'
                  : 'معاينة وتصدير ملف الشواهد PDF'}
              </span>
            </button>
          </div>
        </div>

        {/* Main Header & Organizational Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCEAF5] border border-[#E2E5E6] text-[#416B91] text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ملف شواهد موحد · ربط السجلات والشواهد المستقلة</span>
            </div>
            <h2
              id="teacher-portfolio-hub-heading"
              className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
            >
              ملف شواهد أداء المعلم الموحد
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              يتيح هذا الملف ربط السجلات المحفوظة في المجموعات السبع المعتمدة
              مرجعيًا دون نسخ بياناتها، أو إنشاء شاهد مستقل مباشرة داخل أي
              عنصر من عناصر الأداء الوظيفي الأحد عشر. تُعرض حالة التغطية
              للأغراض التنظيمية فقط.
            </p>
          </div>

          {/* Summary Counters (Strict Group 8/9 scope: 3 clean summary cards) */}
          <div
            data-testid="portfolio-organizational-summary"
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0"
          >
            <div className="rounded-xl bg-[#DCEAF5]/70 border border-[#E2E5E6] px-4 py-3 text-center">
              <div
                data-testid="portfolio-covered-elements-count"
                className="text-lg sm:text-xl font-extrabold text-[#294660]"
              >
                {overview.elementsWithRecordsCount} / {overview.totalElementsCount}
              </div>
              <div className="text-[11px] font-bold text-stone-600 mt-0.5">
                عناصر موثقة بشواهد (تنظيميًا)
              </div>
            </div>

            <div className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] px-4 py-3 text-center">
              <div
                data-testid="portfolio-total-resolved-links-count"
                className="text-lg sm:text-xl font-extrabold text-[#2F6846]"
              >
                {overview.totalCombinedEvidencesCount}
              </div>
              <div className="text-[11px] font-bold text-stone-600 mt-0.5">
                إجمالي الشواهد ({overview.totalResolvedReferencesCount} مرتبط ·{' '}
                {overview.totalStandaloneEvidencesCount} مستقل)
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-center">
              <div
                data-testid="portfolio-unique-records-count"
                className="text-lg sm:text-xl font-extrabold text-stone-800"
              >
                {overview.uniqueLinkedSourceRecordsCount}
              </div>
              <div className="text-[11px] font-bold text-stone-600 mt-0.5">
                سجلات مصدرية فريدة مرتبطة
              </div>
            </div>
          </div>
        </div>

        {/* Active Template / Color Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-stone-600">
          <div className="inline-flex items-center gap-1.5 font-bold text-stone-600">
            <Info className="w-4 h-4 text-[#416B91] shrink-0" aria-hidden="true" />
            <span>
              مؤشر التغطية معلومة تنظيمية لمتابعة ربط السجلات ولا يعد حكمًا على تحقق الأداء.
            </span>
          </div>
          <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 font-bold">
            هوية التصدير: {activeTemplateDef.name} · {palette.name}
          </span>
        </div>
      </div>

      {/* Storage Warning Banner if any */}
      {storageWarning && (
        <div
          role="alert"
          data-testid="portfolio-storage-warning-banner"
          className="rounded-2xl border border-[#E8C9BA] bg-[#FDF2ED] p-4 flex items-start gap-3 text-[#9A4A2E]"
        >
          <ShieldAlert className="w-5 h-5 text-[#9A4A2E] shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm font-bold leading-relaxed">
            {storageWarning}
          </div>
        </div>
      )}

      {/* Missing / Orphaned References Alert Banner */}
      {overview.totalMissingReferencesCount > 0 && (
        <div
          role="alert"
          data-testid="portfolio-missing-refs-alert"
          className="rounded-2xl border border-[#E8C9BA] bg-[#FDF2ED] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-[#9A4A2E] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-[#9A4A2E]">
                تنبيه مراجع مفقودة أو يتيمة ({overview.totalMissingReferencesCount})
              </h3>
              <p className="text-xs text-[#9A4A2E] leading-relaxed">
                يوجد {overview.totalMissingReferencesCount} رابط مرجعي يشير إلى سجل لم يعد
                موجودًا في أرشيف مجموعته المصدرية. يمكنك مراجعتها داخل العناصر أو تنظيفها
                بأمان دون المساس بأي سجل محفوظ.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="cleanup-all-missing-refs-btn"
            onClick={handleCleanupMissingReferences}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#9A4A2E] hover:bg-[#9A4A2E] text-white text-xs font-extrabold shrink-0 cursor-pointer transition-colors"
          >
            تنظيف المراجع المفقودة ({overview.totalMissingReferencesCount})
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          role="status"
          data-testid="portfolio-feedback-banner"
          className={`rounded-2xl border p-4 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold ${
            feedbackBanner.type === 'success'
              ? 'bg-[#EEF5EE] border-[#C5DCC7] text-[#2F6846]'
              : feedbackBanner.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-[#DCEAF5] border-[#E2E5E6] text-[#416B91]'
          }`}
        >
          <span>{feedbackBanner.message}</span>
          <button
            type="button"
            aria-label="إغلاق التنبيه"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collapsible Deletion Audit Log Panel */}
      {isAuditLogOpen && (
        <div
          data-testid="portfolio-deletion-audit-log-panel"
          className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#416B91]" aria-hidden="true" />
              <h3 className="text-base font-extrabold text-stone-900">
                سجل تدقيق فك الارتباط عند حذف السجلات المصدرية
              </h3>
            </div>
            <button
              type="button"
              data-testid="close-audit-log-panel-btn"
              onClick={() => setIsAuditLogOpen(false)}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              إغلاق السجل
            </button>
          </div>

          {overview.deletionAuditLog.length === 0 ? (
            <p
              data-testid="empty-audit-log-message"
              className="text-xs sm:text-sm text-stone-500 py-3"
            >
              لا توجد عمليات حذف لسجلات مصدرية مرتبطة مسجلة في سجل التدقيق حتى الآن.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {overview.deletionAuditLog.map((entry) => (
                <div
                  key={entry.id}
                  data-testid={`audit-log-entry-${entry.deletedRecordId}`}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-stone-900">
                      السجل المحذوف: {entry.deletedRecordTitle || entry.deletedRecordId}
                    </span>
                    <span className="text-stone-500">
                      {entry.deletedAt.slice(0, 10)}
                    </span>
                  </div>
                  <div className="text-stone-600">
                    المجموعة المصدرية: {entry.deletedGroupId} · العناصر المتأثرة:{' '}
                    {entry.unlinkedElementIds.join('، ')}
                  </div>
                  {entry.note && (
                    <div className="text-stone-500">{entry.note}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Two-Column Responsive Layout: 11 Element Cards + Active Element Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right Column: The 11 Official Elements Grid (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
              عناصر الأداء الوظيفي الأحد عشر
            </h3>
            <span className="text-xs font-bold text-stone-500">
              اختر عنصرًا لاستعراض أو ربط الشواهد
            </span>
          </div>

          <div
            data-testid="portfolio-elements-list"
            className="grid grid-cols-1 gap-3"
          >
            {overview.elements.map((el) => {
              const isSelected = el.id === activeElement.id;
              return (
                <article
                  key={el.id}
                  data-testid={`portfolio-element-card-${el.number}`}
                  onClick={() => setSelectedElementId(el.id)}
                  className={`rounded-2xl border-2 p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#416B91] bg-[#DCEAF5]/60 shadow-xs'
                      : 'border-stone-200 bg-white hover:border-[#B8D2E8]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#376B70] text-white'
                            : el.hasAnyEvidences
                              ? 'bg-[#2F6846] text-white'
                              : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {el.number}
                      </span>
                      <div className="min-w-0">
                        <h4
                          data-testid={`portfolio-element-title-${el.number}`}
                          className="text-sm sm:text-base font-extrabold text-stone-900 leading-snug"
                        >
                          {el.number}. {el.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span
                            data-testid={`portfolio-element-count-${el.number}`}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border ${
                              el.hasAnyEvidences
                                ? 'bg-[#EEF5EE] text-[#2F6846] border-[#C5DCC7]'
                                : 'bg-stone-100 text-stone-600 border-stone-200'
                            }`}
                          >
                            {el.totalEvidencesCount} شواهد
                            {el.totalEvidencesCount > 0 &&
                              ` (${el.resolvedLinksCount} مرتبط · ${el.standaloneEvidencesCount} مستقل)`}
                          </span>

                          <span
                            data-testid={`portfolio-element-status-${el.number}`}
                            className="text-[11px] font-bold text-stone-500"
                          >
                            ({el.organizationalStatusLabel})
                          </span>

                          {el.missingLinksCount > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-[#F9E4DA] text-[#9A4A2E] text-[11px] font-extrabold">
                              {el.missingLinksCount} مرجع مفقود
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-end sm:items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`open-standalone-for-element-${el.number}-btn`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStandaloneCreate(el);
                        }}
                        className="min-h-[34px] px-2.5 py-1 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-[#335675] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>شاهد مستقل</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`open-picker-for-element-${el.number}-btn`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPickerForElement(el.id);
                        }}
                        className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>ربط سجل</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Right/Left Column: Active Element Linked Records, Standalone Evidences & Actions (7 cols on lg) */}
        <div
          data-testid="portfolio-active-element-panel"
          className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E5E6] p-5 sm:p-6 space-y-5 shadow-2xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#416B91]">
                <span>العنصر الوظيفي ({activeElement.number} من ١١)</span>
                <span>·</span>
                <span>
                  {activeElement.organizationalStatusLabel} (معلومة تنظيمية)
                </span>
              </div>
              <h3
                data-testid="active-element-heading"
                className="text-lg sm:text-xl font-extrabold font-display text-stone-900"
              >
                {activeElement.number}. {activeElement.title}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="active-element-create-standalone-btn"
                onClick={() => handleOpenStandaloneCreate(activeElement)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#416B91] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-[#335675] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>إنشاء شاهد مستقل</span>
              </button>

              <button
                type="button"
                data-testid="active-element-link-record-btn"
                onClick={() => handleOpenPickerForElement(activeElement.id)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Link2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>ربط سجل موجود</span>
              </button>
            </div>
          </div>

          {activeElement.items.length === 0 &&
          activeElement.standaloneEvidences.length === 0 ? (
            <div
              data-testid="active-element-empty-state"
              className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 p-8 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#DCEAF5] text-[#416B91] flex items-center justify-center mx-auto">
                <FolderKanban className="w-6 h-6" aria-hidden="true" />
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-stone-800">
                لا توجد شواهد موثقة لهذا العنصر حتى الآن
              </h4>
              <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                يمكنك ربط سجل محفوظ مسبقًا في إحدى المجموعات السبع المعتمدة دون
                تكراره، أو إنشاء شاهد مستقل جديد مباشرة داخل هذا العنصر.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  data-testid="empty-state-create-standalone-btn"
                  onClick={() => handleOpenStandaloneCreate(activeElement)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#416B91] bg-white hover:bg-[#DCEAF5] text-[#335675] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                  <span>إنشاء شاهد مستقل</span>
                </button>

                <button
                  type="button"
                  data-testid="empty-state-open-picker-btn"
                  onClick={() => handleOpenPickerForElement(activeElement.id)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>ربط سجل من المجموعات السبع</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              data-testid="active-element-linked-records-list"
              className="space-y-4"
            >
              {/* Standalone Evidences inside Active Element */}
              {activeElement.standaloneEvidences.map((stItem) => {
                const ev = stItem.evidence;
                return (
                  <article
                    key={ev.id}
                    data-testid={`standalone-evidence-card-${ev.id}`}
                    className="rounded-2xl border border-stone-200 hover:border-[#B8D2E8] bg-white p-4 sm:p-5 space-y-3 transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#DCEAF5] text-[#335675] border border-[#E2E5E6] text-[11px] font-extrabold">
                            شاهد مستقل
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-bold">
                            {stItem.typeLabel}
                          </span>
                          {stItem.attachmentsCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#EEF5EE] text-[#2F6846] border border-[#C5DCC7] text-[11px] font-bold inline-flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" aria-hidden="true" />
                              <span>{stItem.attachmentsCount} صورة</span>
                            </span>
                          )}
                          {stItem.electronicLinks.length > 0 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-bold inline-flex items-center gap-1">
                              <QrCode className="w-3 h-3" aria-hidden="true" />
                              <span>{stItem.electronicLinks.length} رابط QR</span>
                            </span>
                          )}
                        </div>

                        <h4
                          data-testid={`standalone-evidence-title-${ev.id}`}
                          className="text-base font-extrabold text-stone-900"
                        >
                          {ev.title}
                        </h4>

                        {(ev.executionDate || ev.targetAudience) && (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 pt-0.5">
                            {ev.executionDate && (
                              <span className="inline-flex items-center gap-1 font-bold">
                                <Calendar className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
                                <span>تاريخ التنفيذ: {ev.executionDate}</span>
                              </span>
                            )}
                            {ev.targetAudience && (
                              <span className="inline-flex items-center gap-1 font-bold">
                                <Users className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
                                <span>الفئة المستهدفة: {ev.targetAudience}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          data-testid={`preview-standalone-evidence-${ev.id}-btn`}
                          onClick={() => setPreviewedStandaloneItem(stItem)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#416B91] text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#416B91]" />
                          <span>معاينة</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`edit-standalone-evidence-${ev.id}-btn`}
                          onClick={() =>
                            handleOpenStandaloneEdit(activeElement, stItem)
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#416B91] text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#416B91]" />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-standalone-evidence-${ev.id}-btn`}
                          onClick={() => setPendingDeleteStandaloneItem(stItem)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                      {ev.description}
                    </p>

                    {ev.impact && (
                      <div className="rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-2.5 text-xs text-stone-800">
                        <span className="font-extrabold text-[#294660]">
                          الأثر أو النتيجة المتحققة:{' '}
                        </span>
                        <span>{ev.impact}</span>
                      </div>
                    )}
                  </article>
                );
              })}

              {/* Linked Source Records inside Active Element */}
              {activeElement.items.map((item) => {
                const itemKey = `${item.elementId}::${item.ref.sourceGroupId}::${item.ref.sourceRecordId}`;
                const isEditingNote = editingNoteKey === itemKey;

                if (item.status === 'missing' || !item.sourceRecord) {
                  return (
                    <article
                      key={itemKey}
                      data-testid={`missing-linked-record-${item.ref.sourceRecordId}`}
                      className="rounded-2xl border-2 border-[#E8C9BA] bg-[#FDF2ED] p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#F2D3C4] text-[#9A4A2E] text-[11px] font-extrabold">
                            مرجع مفقود أو محذوف من مصدره الأصلي
                          </span>
                          <h4 className="text-sm font-extrabold text-[#9A4A2E]">
                            المجموعة المصدرية: {item.groupTitle} (معرّف السجل:{' '}
                            {item.ref.sourceRecordId})
                          </h4>
                          {item.matchingDeletionAuditEntry && (
                            <p className="text-xs text-[#9A4A2E]">
                              سجل التدقيق:{' '}
                              {item.matchingDeletionAuditEntry.deletedRecordTitle ||
                                ''}{' '}
                              — {item.matchingDeletionAuditEntry.note}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          data-testid={`unlink-missing-record-${item.ref.sourceRecordId}-btn`}
                          onClick={() => setPendingUnlinkItem(item)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#9A4A2E] hover:bg-[#7D3A22] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إزالة المرجع المفقود</span>
                        </button>
                      </div>
                    </article>
                  );
                }

                const rec = item.sourceRecord;
                return (
                  <article
                    key={itemKey}
                    data-testid={`linked-record-card-${rec.id}`}
                    className="rounded-2xl border border-stone-200 hover:border-[#B8D2E8] bg-stone-50/40 p-4 sm:p-5 space-y-4 transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#DCEAF5] text-[#335675] border border-[#E2E5E6] text-[11px] font-extrabold">
                            {item.groupTitle}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-bold">
                            {item.formTitle}
                          </span>
                          {item.attachmentsCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#EEF5EE] text-[#2F6846] border border-[#C5DCC7] text-[11px] font-bold inline-flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" aria-hidden="true" />
                              <span>{item.attachmentsCount} مرفق/صورة</span>
                            </span>
                          )}
                        </div>

                        <h4
                          data-testid={`linked-record-title-${rec.id}`}
                          className="text-base font-extrabold text-stone-900"
                        >
                          {rec.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          data-testid={`preview-linked-record-${rec.id}-btn`}
                          onClick={() => setPreviewedItem(item)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#416B91] text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#416B91]" />
                          <span>معاينة الشاهد</span>
                        </button>

                        {onNavigateToSourceGroup && (
                          <button
                            type="button"
                            data-testid={`goto-source-group-${rec.id}-btn`}
                            onClick={() =>
                              onNavigateToSourceGroup(
                                item.ref.sourceGroupId,
                                rec.formId
                              )
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#416B91] text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#416B91]" />
                            <span>المجموعة الأصلية</span>
                          </button>
                        )}

                        <button
                          type="button"
                          data-testid={`edit-note-btn-${rec.id}`}
                          onClick={() => handleStartEditNote(item)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#416B91] text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#416B91]" />
                          <span>
                            {item.ref.note ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}
                          </span>
                        </button>

                        <button
                          type="button"
                          data-testid={`unlink-record-btn-${rec.id}`}
                          onClick={() => setPendingUnlinkItem(item)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>فك الارتباط</span>
                        </button>
                      </div>
                    </div>

                    {/* Live Summary Fields from Original Group Store */}
                    {item.summaryFields.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {item.summaryFields.slice(0, 4).map((sf, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl bg-white border border-stone-200/80 px-3 py-2 text-xs"
                          >
                            <span className="font-bold text-stone-500">
                              {sf.label}:{' '}
                            </span>
                            <span className="font-bold text-stone-800">
                              {sf.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Documentation Note Display or Inline Editor */}
                    {isEditingNote ? (
                      <div
                        data-testid={`note-editor-${rec.id}`}
                        className="rounded-xl bg-[#DCEAF5]/70 border border-[#E2E5E6] p-3.5 space-y-2.5"
                      >
                        <label
                          htmlFor={`note-input-${rec.id}`}
                          className="block text-xs font-extrabold text-stone-800"
                        >
                          الملاحظة التوثيقية للارتباط بهذا العنصر (اختيارية):
                        </label>
                        <textarea
                          id={`note-input-${rec.id}`}
                          data-testid={`note-textarea-${rec.id}`}
                          rows={2}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          placeholder="اكتب توضيحًا مختصرًا لكيفية ارتباط هذا السجل بعنصر الأداء الوظيفي..."
                          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            data-testid={`cancel-note-btn-${rec.id}`}
                            onClick={() => {
                              setEditingNoteKey(null);
                              setEditingNoteText('');
                            }}
                            className="min-h-[34px] px-3 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-xs font-bold text-stone-800 cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            data-testid={`save-note-btn-${rec.id}`}
                            onClick={() => handleSaveEditedNote(item)}
                            className="min-h-[34px] px-3.5 py-1 rounded-lg bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-extrabold cursor-pointer"
                          >
                            حفظ الملاحظة
                          </button>
                        </div>
                      </div>
                    ) : (
                      item.ref.note && (
                        <div
                          data-testid={`linked-record-note-${rec.id}`}
                          className="rounded-xl bg-[#DCEAF5]/60 border border-[#E2E5E6] px-3.5 py-2.5 text-xs text-stone-800"
                        >
                          <span className="font-extrabold text-[#294660]">
                            الملاحظة التوثيقية:{' '}
                          </span>
                          <span>{item.ref.note}</span>
                        </div>
                      )
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Modal 1: Eligible Source Record Picker from Groups 1–7                 */}
      {/* ===================================================================== */}
      {isPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portfolio-picker-modal-title"
          data-testid="portfolio-record-picker-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-start justify-between gap-3 bg-[#DCEAF5]/50">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-[#416B91]">
                  إضافة شاهد مرجعي إلى العنصر ({activeElement.number})
                </span>
                <h3
                  id="portfolio-picker-modal-title"
                  className="text-base sm:text-lg font-extrabold text-stone-900"
                >
                  {activeElement.number}. {activeElement.title}
                </h3>
                <p className="text-xs text-stone-600">
                  تظهر هنا السجلات المحفوظة فعليًا في الأرشيف من المجموعات السبع
                  المعتمدة فقط (يُستبعد أي سجل في حالة مسودة).
                </p>
              </div>
              <button
                type="button"
                data-testid="close-portfolio-picker-modal-btn"
                aria-label="إغلاق نافذة اختيار الشواهد"
                onClick={() => setIsPickerOpen(false)}
                className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Source Group Filter Bar */}
            <div className="p-4 border-b border-stone-100 bg-stone-50/70 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7 relative">
                  <Search
                    className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="البحث في السجلات المؤهلة بالعنوان"
                    data-testid="portfolio-picker-search-input"
                    value={pickerSearchQuery}
                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                    placeholder="ابحث بعنوان السجل أو نوع النموذج أو التاريخ..."
                    className="w-full min-h-[42px] pr-10 pl-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>

                <div className="sm:col-span-5 relative">
                  <Filter
                    className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <select
                    aria-label="التصفية حسب المجموعة المصدرية"
                    data-testid="portfolio-picker-group-filter"
                    value={pickerGroupId}
                    onChange={(e) =>
                      setPickerGroupId(
                        e.target.value as TeacherArchiveGroupId | 'all'
                      )
                    }
                    className="w-full min-h-[42px] pr-10 pl-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:border-[#416B91]"
                  >
                    <option value="all">
                      جميع المجموعات السبع المعتمدة (١–٧)
                    </option>
                    {TEACHER_PORTFOLIO_SOURCE_GROUPS.map((g) => (
                      <option key={g.groupId} value={g.groupId}>
                        المجموعة {g.groupNumber}: {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Eligible Records List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {eligibleSourceRecords.length === 0 ? (
                <div
                  data-testid="portfolio-picker-empty-state"
                  className="rounded-2xl border border-dashed border-stone-300 p-8 text-center space-y-2"
                >
                  <p className="text-sm font-extrabold text-stone-800">
                    لا توجد سجلات محفوظة مطابقة في الأرشيف حاليًا
                  </p>
                  <p className="text-xs text-stone-500">
                    تأكد من حفظ السجل داخل أرشيف إحدى المجموعات السبع (وليس كمسودة
                    فقط) ليظهر هنا ويكون مؤهلًا للربط.
                  </p>
                </div>
              ) : (
                eligibleSourceRecords.map((item) => {
                  const recKey = `${item.groupId}::${item.record.id}`;
                  const isAlreadyLinkedHere = activeElement.items.some(
                    (linked) =>
                      linked.ref.sourceGroupId === item.groupId &&
                      linked.ref.sourceRecordId === item.record.id
                  );

                  return (
                    <article
                      key={recKey}
                      data-testid={`picker-record-item-${item.record.id}`}
                      className="rounded-2xl border border-stone-200 p-4 space-y-3 bg-white hover:border-[#B8D2E8] transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#DCEAF5] text-[#335675] text-[11px] font-extrabold">
                              {item.groupTitle}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-bold">
                              {item.formTitle}
                            </span>
                            {item.record.eventDate && (
                              <span className="text-[11px] text-stone-500 font-bold">
                                التاريخ: {item.record.eventDate}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
                            {item.record.title}
                          </h4>
                        </div>

                        {isAlreadyLinkedHere ? (
                          <span
                            data-testid={`picker-already-linked-badge-${item.record.id}`}
                            className="px-3 py-1.5 rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] text-[#2F6846] text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>مرتبط بهذا العنصر</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            data-testid={`picker-link-record-btn-${item.record.id}`}
                            onClick={() => handleLinkRecord(item)}
                            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>ربط بالعنصر ({activeElement.number})</span>
                          </button>
                        )}
                      </div>

                      {!isAlreadyLinkedHere && (
                        <div>
                          <input
                            type="text"
                            aria-label={`ملاحظة توثيقية للسجل ${item.record.title}`}
                            data-testid={`picker-note-input-${item.record.id}`}
                            value={pickerNoteByRecordKey[recKey] || ''}
                            onChange={(e) =>
                              setPickerNoteByRecordKey((prev) => ({
                                ...prev,
                                [recKey]: e.target.value,
                              }))
                            }
                            placeholder="ملاحظة توثيقية اختيارية عند الربط (مثال: يوثق تنفيذ استراتيجية التعلم التعاوني للصف الخامس)..."
                            className="w-full min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-800 focus:outline-none focus:bg-white focus:border-[#416B91]"
                          />
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal 2: Unlink Confirmation Dialog                                   */}
      {/* ===================================================================== */}
      {pendingUnlinkItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unlink-confirm-modal-title"
          data-testid="portfolio-unlink-confirm-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Unlink className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3
                id="unlink-confirm-modal-title"
                className="text-base font-extrabold text-stone-900"
              >
                تأكيد فك ارتباط الشاهد من العنصر
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              هل ترغب في فك ارتباط السجل{' '}
              <strong className="text-stone-900">
                «
                {pendingUnlinkItem.sourceRecord?.title ||
                  pendingUnlinkItem.ref.sourceRecordId}
                »
              </strong>{' '}
              من العنصر{' '}
              <strong className="text-stone-900">
                «{pendingUnlinkItem.elementTitle}»
              </strong>
              ؟
            </p>
            <p className="text-xs text-[#2F6846] bg-[#EEF5EE] border border-[#C5DCC7] rounded-xl p-3 font-bold">
              ملاحظة: عملية فك الارتباط تزيل الإشارة المرجعية من هذا العنصر فقط،
              ولا تحذف السجل الأصلي أو تعدله في مجموعته المصدرية.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="cancel-unlink-btn"
                onClick={() => setPendingUnlinkItem(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                data-testid="confirm-unlink-btn"
                onClick={handleConfirmUnlink}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold cursor-pointer"
              >
                تأكيد فك الارتباط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal 3: Live Source Record Preview (with Hydrated IndexedDB Photos)  */}
      {/* ===================================================================== */}
      {previewedItem && previewedItem.sourceRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="source-record-preview-title"
          data-testid="portfolio-source-record-preview-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-start justify-between gap-3 bg-[#DCEAF5]/50">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#376B70] text-white text-[11px] font-extrabold">
                    {previewedItem.groupTitle}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-[11px] font-bold">
                    {previewedItem.formTitle}
                  </span>
                </div>
                <h3
                  id="source-record-preview-title"
                  className="text-base sm:text-lg font-extrabold text-stone-900"
                >
                  {previewedItem.sourceRecord.title}
                </h3>
                <p className="text-xs text-stone-500">
                  تُقرأ هذه البيانات والمرفقات مباشرة من السجل الأصلي في أرشيف
                  مجموعته ومخزن الوسائط (IndexedDB) دون أي نسخ مكرر.
                </p>
              </div>
              <button
                type="button"
                data-testid="close-source-preview-modal-btn"
                aria-label="إغلاق معاينة الشاهد"
                onClick={() => setPreviewedItem(null)}
                className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {previewedItem.ref.note && (
                <div className="rounded-xl bg-[#DCEAF5] border border-[#E2E5E6] p-3.5 text-xs sm:text-sm text-stone-900">
                  <strong className="text-[#294660]">
                    الملاحظة التوثيقية للارتباط:{' '}
                  </strong>
                  <span>{previewedItem.ref.note}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewedItem.summaryFields.map((sf, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs space-y-1"
                  >
                    <div className="font-bold text-stone-500">{sf.label}</div>
                    <div className="font-extrabold text-stone-900 leading-relaxed">
                      {sf.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hydrated Photos from IndexedDB */}
              <div className="space-y-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#416B91]" />
                  <span>
                    المرفقات والصور المسترجعة من المخزن الأصلي (
                    {previewHydratedPhotos.length})
                  </span>
                </h4>

                {isHydratingPhotos ? (
                  <p className="text-xs text-stone-500">
                    جاري استرجاع الصور من مخزن الوسائط...
                  </p>
                ) : previewHydratedPhotos.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    لا توجد صور مرفقة بهذا السجل.
                  </p>
                ) : (
                  <div
                    data-testid="preview-hydrated-photos-grid"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {previewHydratedPhotos.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-stone-200 p-2 bg-stone-50 space-y-1.5"
                      >
                        <img
                          src={p.imageDataUrl}
                          alt="صورة شاهد مسترجعة من السجل الأصلي"
                          className="w-full h-44 object-contain rounded-lg bg-white border border-stone-100"
                        />
                        {p.blobKey && (
                          <div className="text-[11px] text-stone-500 font-mono truncate px-1">
                            {p.blobKey}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50 flex flex-wrap items-center justify-between gap-3">
              {onNavigateToSourceGroup ? (
                <button
                  type="button"
                  data-testid="modal-goto-source-group-btn"
                  onClick={() => {
                    const grp = previewedItem.ref.sourceGroupId;
                    const fId = previewedItem.sourceRecord?.formId;
                    setPreviewedItem(null);
                    onNavigateToSourceGroup(grp, fId);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح السجل في مجموعته الأصلية</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setPreviewedItem(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-xs font-bold text-stone-800 cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal 4: Unified Portfolio PDF Preview & Download Modal               */}
      {/* ===================================================================== */}
      {generatedPdfResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portfolio-pdf-preview-modal-title"
          data-testid="portfolio-pdf-preview-modal"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-[#DCEAF5]/60">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#416B91]">
                  <BookOpenCheck className="w-4 h-4" />
                  <span>
                    جاهز للتنزيل · إجمالي الصفحات: {generatedPdfResult.pageCount} صفحات
                    · المرفقات الفريدة: {generatedPdfResult.deduplicatedAttachmentsCount}
                  </span>
                </div>
                <h3
                  id="portfolio-pdf-preview-modal-title"
                  className="text-base sm:text-lg font-extrabold text-stone-900"
                >
                  معاينة ملف شواهد أداء المعلم الموحد (PDF)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="download-unified-portfolio-pdf-btn"
                  onClick={() => handleDownloadGeneratedPdf(generatedPdfResult)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف PDF ({generatedPdfResult.pageCount} صفحات)</span>
                </button>
                <button
                  type="button"
                  data-testid="close-portfolio-pdf-preview-btn"
                  aria-label="إغلاق معاينة PDF"
                  onClick={() => setGeneratedPdfResult(null)}
                  className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Page Selector Tabs */}
            <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2 overflow-x-auto">
              {generatedPdfResult.pageDescriptors.map((desc, idx) => (
                <button
                  key={desc.pageNumber}
                  type="button"
                  data-testid={`portfolio-pdf-page-tab-${desc.pageNumber}`}
                  onClick={() => setActivePdfPreviewPage(idx)}
                  className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                    activePdfPreviewPage === idx
                      ? 'bg-[#376B70] text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  صفحة {desc.pageNumber}: {desc.title}
                </button>
              ))}
            </div>

            {/* Rendered Page Image Preview */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-stone-100 flex justify-center">
              {generatedPdfResult.pages[activePdfPreviewPage]?.dataUrl ? (
                <img
                  data-testid="portfolio-pdf-page-preview-img"
                  src={generatedPdfResult.pages[activePdfPreviewPage].dataUrl}
                  alt={`معاينة صفحة ${activePdfPreviewPage + 1} من ملف شواهد الأداء`}
                  className="max-w-full h-auto max-h-[68vh] rounded-xl shadow-md border border-stone-200 bg-white"
                />
              ) : (
                <div className="p-8 text-center text-xs font-bold text-stone-600">
                  تم توليد الصفحة رقم {activePdfPreviewPage + 1} بنجاح.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ===================================================================== */}
      {/* Modal 5: Unified Standalone Evidence Creation / Edit Modal            */}
      {/* ===================================================================== */}
      {standaloneModalState && (
        <PortfolioStandaloneEvidenceModal
          element={standaloneModalState.element}
          mode={standaloneModalState.mode}
          editingEvidenceId={standaloneModalState.editingEvidenceId}
          colorSystem={colorSystem}
          onClose={() => {
            setStandaloneModalState(null);
            setRefreshTick((t) => t + 1);
          }}
          onSaved={(savedEvidence, isNew) => {
            const targetEl = standaloneModalState.element;
            setStandaloneModalState(null);
            setRefreshTick((t) => t + 1);
            setFeedbackBanner({
              type: 'success',
              message: isNew
                ? `تم حفظ الشاهد المستقل «${savedEvidence.title}» داخل العنصر (${targetEl.number}): ${targetEl.title}`
                : `تم تحديث الشاهد المستقل «${savedEvidence.title}» بنجاح.`,
            });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* Modal 6: Standalone Evidence Delete Confirmation                      */}
      {/* ===================================================================== */}
      {pendingDeleteStandaloneItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="standalone-delete-modal-title"
          data-testid="portfolio-standalone-delete-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3
                id="standalone-delete-modal-title"
                className="text-base font-extrabold text-stone-900"
              >
                تأكيد حذف الشاهد المستقل
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              هل ترغب في حذف الشاهد المستقل{' '}
              <strong className="text-stone-900">
                «{pendingDeleteStandaloneItem.evidence.title}»
              </strong>{' '}
              من العنصر{' '}
              <strong className="text-stone-900">
                «{pendingDeleteStandaloneItem.elementTitle}»
              </strong>
              ؟
            </p>
            <p className="text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold">
              ملاحظة: سيتم حذف هذا الشاهد المستقل فقط مع الحفاظ على أي مرفقات
              مشتركة مستخدمة في سجلات أو شواهد أخرى دون تأثر.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="cancel-delete-standalone-btn"
                disabled={isDeletingStandalone}
                onClick={() => setPendingDeleteStandaloneItem(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                data-testid="confirm-delete-standalone-btn"
                disabled={isDeletingStandalone}
                onClick={handleConfirmDeleteStandalone}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer"
              >
                {isDeletingStandalone ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal 7: Standalone Evidence Live Preview (Photos & QR Links)         */}
      {/* ===================================================================== */}
      {previewedStandaloneItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="standalone-preview-modal-title"
          data-testid="portfolio-standalone-preview-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-start justify-between gap-3 bg-stone-50/80">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#376B70] text-white text-[11px] font-extrabold">
                    شاهد مستقل داخل العنصر
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-[11px] font-bold">
                    {previewedStandaloneItem.typeLabel}
                  </span>
                </div>
                <h3
                  id="standalone-preview-modal-title"
                  className="text-base sm:text-lg font-extrabold text-stone-900"
                >
                  {previewedStandaloneItem.evidence.title}
                </h3>
                <p className="text-xs text-stone-500">
                  {previewedStandaloneItem.elementTitle}
                </p>
              </div>
              <button
                type="button"
                data-testid="close-standalone-preview-modal-btn"
                aria-label="إغلاق معاينة الشاهد المستقل"
                onClick={() => setPreviewedStandaloneItem(null)}
                className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {(previewedStandaloneItem.evidence.executionDate ||
                previewedStandaloneItem.evidence.targetAudience) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewedStandaloneItem.evidence.executionDate && (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs space-y-1">
                      <div className="font-bold text-stone-500">
                        تاريخ التنفيذ
                      </div>
                      <div className="font-extrabold text-stone-900">
                        {previewedStandaloneItem.evidence.executionDate}
                      </div>
                    </div>
                  )}
                  {previewedStandaloneItem.evidence.targetAudience && (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs space-y-1">
                      <div className="font-bold text-stone-500">
                        الصف أو الفئة المستهدفة
                      </div>
                      <div className="font-extrabold text-stone-900">
                        {previewedStandaloneItem.evidence.targetAudience}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-1.5">
                <div className="text-xs font-extrabold text-stone-500">
                  وصف الممارسة أو العمل المنفذ
                </div>
                <p className="text-xs sm:text-sm text-stone-900 leading-relaxed whitespace-pre-line">
                  {previewedStandaloneItem.evidence.description}
                </p>
              </div>

              {previewedStandaloneItem.evidence.impact && (
                <div className="rounded-xl border border-[#E2E5E6] bg-[#DCEAF5]/60 p-4 space-y-1.5">
                  <div className="text-xs font-extrabold text-[#294660]">
                    الأثر أو النتيجة المتحققة
                  </div>
                  <p className="text-xs sm:text-sm text-stone-900 leading-relaxed whitespace-pre-line">
                    {previewedStandaloneItem.evidence.impact}
                  </p>
                </div>
              )}

              {/* Hydrated Photos */}
              <div className="space-y-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#416B91]" />
                  <span>
                    الصور المرفقة ({previewStandalonePhotos.length})
                  </span>
                </h4>

                {isHydratingStandalonePhotos ? (
                  <p className="text-xs text-stone-500">
                    جاري استرجاع الصور من مخزن الوسائط...
                  </p>
                ) : previewStandalonePhotos.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    لا توجد صور مرفقة بهذا الشاهد.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewStandalonePhotos.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-stone-200 p-2 bg-stone-50 space-y-1.5"
                      >
                        <img
                          src={p.imageDataUrl}
                          alt="صورة شاهد مستقل"
                          className="w-full h-44 object-contain rounded-lg bg-white border border-stone-100"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Electronic Links */}
              {previewedStandaloneItem.electronicLinks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-stone-800 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#416B91]" />
                    <span>
                      الروابط الإلكترونية ({previewedStandaloneItem.electronicLinks.length})
                    </span>
                  </h4>
                  <ul className="space-y-1.5">
                    {previewedStandaloneItem.electronicLinks.map((url, idx) => (
                      <li
                        key={idx}
                        dir="ltr"
                        className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-800 break-all text-left"
                      >
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = previewedStandaloneItem;
                  setPreviewedStandaloneItem(null);
                  const elObj = overview.elements.find(
                    (e) => e.id === target.elementId
                  );
                  if (elObj) {
                    handleOpenStandaloneEdit(elObj, target);
                  }
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>تعديل الشاهد</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewedStandaloneItem(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-xs font-bold text-stone-800 cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
