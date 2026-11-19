import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookmarkCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileCheck2,
  FileDown,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Link2,
  Palette,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../../types';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';
import { RecordDeletionImpact } from '../../utils/teacherArchiveEngine';
import {
  bytesToDataUrl,
  getDefaultTeacherMediaRepository,
  saveMediaBytes,
  saveMediaDataUrl,
} from '../../utils/teacherMediaStorage';
import {
  createNewBlankTestEvalInArchive,
  deleteArchivedTestEvalRecordSafely,
  filterTestEvalArchiveRecords,
  inspectArchivedTestEvalDeletionImpact,
  listSavedTestsAndEvaluations,
  loadActiveTestEvalDraftWithMedia,
  loadArchivedTestEvalWithMedia,
  migrateTestsAndEvaluationToArchive,
  saveActiveTestEvalDraftWithMedia,
  saveTestEvalToArchive,
  TeacherTestEvalArchiveRecord,
} from '../../utils/teacherTestsAndEvaluationArchive';
import {
  AnyTeacherTestOrEvaluationFormState,
  buildTeacherTestOrEvaluationDocument,
  calculateRemainingStudentsCount,
  clearTestOrEvaluationDraft,
  createInitialTestOrEvaluationState,
  createSampleTestOrEvaluationState,
  INTERNAL_TEST_CATEGORY_OPTIONS,
  INTERNAL_TEST_EXECUTION_METHODS,
  InternalTestCategoryOption,
  InternalTestExecutionFormState,
  InternalTestExecutionMethod,
  isValidElectronicUrl,
  loadTestOrEvaluationDraft,
  PERFORMANCE_TASK_TYPE_OPTIONS,
  PerformanceTaskExecutionFormState,
  PerformanceTaskTypeOption,
  saveTestOrEvaluationDraft,
  STAGE_SUGGESTIONS,
  TEACHER_TESTS_AND_EVALUATION_CATALOG,
  TeacherTestsAndEvaluationFormId,
  validateTestOrEvaluationState,
} from '../../utils/teacherTestsAndEvaluationEngine';
import {
  createDefaultSampleEvidencePhotos,
  generateTeacherReportPdf,
  getTeacherColorPalette,
  paginateTeacherReportBlocks,
  renderTeacherReportPagesToCanvases,
  TEACHER_COLOR_PALETTES,
  TEACHER_TEMPLATE_DEFINITIONS,
  TeacherPageJpegWithLinks,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from '../../utils/teacherPdfEngine';

interface TeacherTestsAndEvaluationFormProps {
  formId: TeacherTestsAndEvaluationFormId;
  onBackToGroup: () => void;
  onBackToTeacherHub: () => void;
}

const ALL_TEMPLATES: TeacherPdfTemplateStyle[] = [
  'waves',
  'waves-2',
  'geometric',
];

const ALL_COLOR_SYSTEMS: TeacherPdfColorSystem[] = [
  'green',
  'blue',
  'slate',
];

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file result'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export const TeacherTestsAndEvaluationForm: React.FC<
  TeacherTestsAndEvaluationFormProps
> = ({ formId, onBackToGroup, onBackToTeacherHub }) => {
  const { settings, updateSettings } = useSettings();
  const modelMeta = useMemo(
    () =>
      TEACHER_TESTS_AND_EVALUATION_CATALOG.find((item) => item.id === formId) ||
      TEACHER_TESTS_AND_EVALUATION_CATALOG[0],
    [formId]
  );

  const [formState, setFormState] =
    useState<AnyTeacherTestOrEvaluationFormState>(() =>
      loadTestOrEvaluationDraft(formId, settings)
    );

  const [templateStyle, setTemplateStyle] = useState<TeacherPdfTemplateStyle>(
    settings.teacherPdfTemplate ?? 'waves'
  );
  const [colorSystem, setColorSystem] = useState<TeacherPdfColorSystem>(
    settings.teacherPdfColorSystem ?? 'green'
  );

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [renderedPages, setRenderedPages] = useState<
    TeacherPageJpegWithLinks[]
  >([]);
  const [isExporting, setIsExporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Unified Archive State (Group 5: internal-test-execution & performance-task-execution)
  const [activeArchivedRecordId, setActiveArchivedRecordId] = useState<
    string | null
  >(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    undefined
  );
  const [savedRecords, setSavedRecords] = useState<
    TeacherTestEvalArchiveRecord[]
  >(() => listSavedTestsAndEvaluations(formId));
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [isSavingArchive, setIsSavingArchive] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    record: TeacherTestEvalArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);
  const isHydratingRef = useRef<boolean>(true);

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );

  const refreshSavedRecords = (targetFormId: TeacherTestsAndEvaluationFormId = formId) => {
    setSavedRecords(listSavedTestsAndEvaluations(targetFormId));
  };

  // Run idempotent Group 5 migration once and hydrate active draft + IndexedDB photos
  useEffect(() => {
    let cancelled = false;
    isHydratingRef.current = true;
    setActiveArchivedRecordId(null);
    setPendingDeleteTarget(null);
    setValidationErrors([]);
    setStatusBanner(null);
    setMediaNotice(null);
    setArchiveSearchQuery('');
    setActiveTab('edit');

    const initArchiveAndDraft = async () => {
      try {
        await migrateTestsAndEvaluationToArchive({ settings });
        const hydrated = await loadActiveTestEvalDraftWithMedia(formId, {
          settings,
        });
        if (cancelled) return;
        setFormState(hydrated.formData);
        setActiveDraftId(hydrated.draftRecord?.id);
        refreshSavedRecords(formId);
        if (hydrated.integrityWarnings.length > 0) {
          setStatusBanner({
            type: 'error',
            text: hydrated.integrityWarnings[0],
          });
        }
      } catch {
        if (!cancelled) {
          setFormState(loadTestOrEvaluationDraft(formId, settings));
          refreshSavedRecords(formId);
        }
      } finally {
        if (!cancelled) {
          setTimeout(() => {
            isHydratingRef.current = false;
          }, 0);
        }
      }
    };

    initArchiveAndDraft();
    return () => {
      cancelled = true;
    };
  }, [formId]);

  // Persist active draft edits continuously to archive draft store + IndexedDB + legacy fallback
  useEffect(() => {
    if (isHydratingRef.current) return;
    if (formState.formId !== formId) return;
    if (activeArchivedRecordId) {
      // Edits to an open archived record commit on explicit "حفظ التعديلات في الأرشيف"
      return;
    }

    let cancelled = false;
    const persistDraft = async () => {
      try {
        const res = await saveActiveTestEvalDraftWithMedia(formState, {
          draftId: activeDraftId,
          settings,
        });
        if (
          !cancelled &&
          res.draftRecord?.id &&
          res.draftRecord.id !== activeDraftId
        ) {
          setActiveDraftId(res.draftRecord.id);
        }
      } catch {
        saveTestOrEvaluationDraft(formState);
      }
    };

    persistDraft();
    return () => {
      cancelled = true;
    };
  }, [formId, formState, activeArchivedRecordId]);

  const reportDoc = useMemo(
    () =>
      buildTeacherTestOrEvaluationDocument(formState, settings, {
        templateStyle,
        colorSystem,
      }),
    [formState, settings, templateStyle, colorSystem]
  );

  const paginatedPages = useMemo(
    () => paginateTeacherReportBlocks(reportDoc, settings),
    [reportDoc, settings]
  );

  useEffect(() => {
    let cancelled = false;
    renderTeacherReportPagesToCanvases(reportDoc, settings).then((pages) => {
      if (!cancelled) {
        setRenderedPages(pages);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reportDoc, settings]);

  const handleSelectTemplate = (nextTemplate: TeacherPdfTemplateStyle) => {
    setTemplateStyle(nextTemplate);
    updateSettings({ ...settings, teacherPdfTemplate: nextTemplate });
  };

  const handleSelectColorSystem = (nextColor: TeacherPdfColorSystem) => {
    setColorSystem(nextColor);
    updateSettings({ ...settings, teacherPdfColorSystem: nextColor });
  };

  const handleLoadSample = () => {
    const sample = createSampleTestOrEvaluationState(formId, settings);
    setFormState(sample);
    setValidationErrors([]);
    setMediaNotice(null);
    setStatusBanner({
      type: 'info',
      text: 'تم تعبئة النموذج ببيانات نموذجية جاهزة للمعاينة والتصدير أو الحفظ في الأرشيف.',
    });
  };

  const handleResetForm = () => {
    clearTestOrEvaluationDraft(formId);
    setFormState(createInitialTestOrEvaluationState(formId, settings));
    setActiveArchivedRecordId(null);
    setMediaNotice(null);
    setValidationErrors([]);
    setStatusBanner({
      type: 'info',
      text: 'تمت إعادة تعيين الحقول إلى الوضع الافتراضي.',
    });
  };

  const handleSaveToArchive = async () => {
    const errors = validateTestOrEvaluationState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل حفظ التقرير في الأرشيف.',
      });
      return;
    }

    setValidationErrors([]);
    try {
      setIsSavingArchive(true);
      const saved = await saveTestEvalToArchive(formState, {
        recordId: activeArchivedRecordId ?? undefined,
        settings,
      });
      setActiveArchivedRecordId(saved.record.id);
      refreshSavedRecords(formId);
      setStatusBanner({
        type: 'success',
        text: saved.isNew
          ? `تم حفظ التقرير سجلًا مستقلًا في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث سجل التقرير المحفوظ في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'تعذر حفظ التقرير في الأرشيف. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsSavingArchive(false);
    }
  };

  const handleCreateNewRecord = () => {
    isHydratingRef.current = true;
    const created = createNewBlankTestEvalInArchive(formId, { settings });
    setActiveArchivedRecordId(null);
    setActiveDraftId(created.draftRecord.id);
    setFormState(created.formData);
    setValidationErrors([]);
    setMediaNotice(null);
    setActiveTab('edit');
    setStatusBanner({
      type: 'info',
      text: 'تم فتح مسودة تقرير جديدة فارغة مع الإبقاء على جميع التقارير المحفوظة في الأرشيف دون تعديل.',
    });
    setTimeout(() => {
      isHydratingRef.current = false;
    }, 0);
  };

  const handleOpenArchivedRecord = async (
    record: TeacherTestEvalArchiveRecord
  ) => {
    try {
      isHydratingRef.current = true;
      const loaded = await loadArchivedTestEvalWithMedia(record.id, {
        formId,
        settings,
      });
      if (!loaded) {
        setStatusBanner({
          type: 'error',
          text: 'تعذر العثور على السجل المطلوب في أرشيف الاختبارات والتقويم.',
        });
        return;
      }
      setActiveArchivedRecordId(loaded.record.id);
      setFormState(loaded.formData);
      setValidationErrors([]);
      setMediaNotice(null);
      setActiveTab('edit');
      setStatusBanner(
        loaded.integrityWarnings.length > 0
          ? {
              type: 'error',
              text: loaded.integrityWarnings[0],
            }
          : {
              type: 'info',
              text: `تم فتح السجل المحفوظ (${loaded.record.title}) للتعديل بالمعرف الثابت ${loaded.record.id}.`,
            }
      );
    } finally {
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    }
  };

  const handleRequestDeleteArchivedRecord = (
    record: TeacherTestEvalArchiveRecord
  ) => {
    const impact = inspectArchivedTestEvalDeletionImpact(record.id);
    setPendingDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedRecord = async () => {
    if (!pendingDeleteTarget) return;
    const { record } = pendingDeleteTarget;
    const wasOpenInEditor = activeArchivedRecordId === record.id;
    const outcome = await deleteArchivedTestEvalRecordSafely(record.id, {
      confirmUnlink: true,
    });
    setPendingDeleteTarget(null);
    refreshSavedRecords(formId);
    if (wasOpenInEditor) {
      setActiveArchivedRecordId(null);
    }
    if (outcome.result.deleted) {
      const unlinkedNote =
        outcome.result.unlinkedElementIds.length > 0
          ? ` وتم فك الارتباط في ${outcome.result.unlinkedElementIds.length} عنصر أداء مع تسجيل التدقيق.`
          : '';
      const sharedNote =
        outcome.result.preservedSharedBlobKeys.length > 0
          ? ' مع الإبقاء على المرفقات المشتركة في السجلات الأخرى.'
          : '';
      setStatusBanner({
        type: 'success',
        text: wasOpenInEditor
          ? `تم حذف السجل «${record.title}» من الأرشيف نهائيًا${unlinkedNote}${sharedNote} وأصبح المحتوى الذي لا يزال ظاهرًا في المحرر مسودة مستقلة غير محفوظة في الأرشيف، وليس السجل المحذوف؛ يمكنك حفظه كتقرير جديد أو الضغط على «إنشاء تقرير جديد» لتفريغ المحرر.`
          : `تم حذف السجل «${record.title}» من الأرشيف بأمان${unlinkedNote}${sharedNote}`,
      });
    }
  };

  const handleExportPdf = async () => {
    const errors = validateTestOrEvaluationState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner(null);
      return;
    }

    setValidationErrors([]);
    setIsExporting(true);
    try {
      const { pdfBytes, filename } = await generateTeacherReportPdf(
        reportDoc,
        settings
      );
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatusBanner({
        type: 'success',
        text: `تم تصدير ملف PDF بنجاح (${filename}).`,
      });
    } catch {
      setValidationErrors(['حدث خطأ غير متوقع أثناء توليد ملف PDF.']);
    } finally {
      setIsExporting(false);
    }
  };

  const updateInternalTestState = (
    updater: (prev: InternalTestExecutionFormState) => InternalTestExecutionFormState
  ) => {
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => {
      if (prev.formId !== 'internal-test-execution') return prev;
      return updater(prev);
    });
  };

  const updatePerformanceTaskState = (
    updater: (
      prev: PerformanceTaskExecutionFormState
    ) => PerformanceTaskExecutionFormState
  ) => {
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => {
      if (prev.formId !== 'performance-task-execution') return prev;
      return updater(prev);
    });
  };

  const handleUploadNewPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const currentPhotos = formState.evidencePhotos || [];
      const remainingSlots = Math.max(0, 2 - currentPhotos.length);
      const filesToRead = files.slice(0, Math.max(1, remainingSlots));

      const repo = getDefaultTeacherMediaRepository();
      const savedResults = await Promise.all(
        filesToRead.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const mimeType = file.type || 'image/png';
          const saved = await saveMediaBytes(
            {
              bytes,
              fileName: file.name || `${formState.formId}-evidence-image`,
              mimeType,
              sourceTag: 'upload',
            },
            repo
          );
          return {
            dataUrl: bytesToDataUrl(bytes, mimeType),
            deduplicated: saved.deduplicated,
          };
        })
      );

      const nextPhotos: TeacherReportEvidencePhoto[] = [
        ...currentPhotos,
        ...savedResults.map((item, idx) => ({
          id: `${formState.formId}-photo-${Date.now()}-${idx + 1}`,
          imageDataUrl: item.dataUrl,
        })),
      ].slice(0, 2);

      setFormState((prev) => ({
        ...prev,
        evidencePhotos: nextPhotos,
      }));

      const anyDeduplicated = savedResults.some((r) => r.deduplicated);
      setMediaNotice(
        anyDeduplicated
          ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
          : 'تم حفظ المرفق الثنائي والتحقق من بصمته (SHA-256 / CRC-32) في IndexedDB.'
      );
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleReplacePhotoAt = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const repo = getDefaultTeacherMediaRepository();
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const mimeType = file.type || 'image/png';
      const saved = await saveMediaBytes(
        {
          bytes,
          fileName: file.name || `${formState.formId}-evidence-image`,
          mimeType,
          sourceTag: 'upload',
        },
        repo
      );
      const dataUrl = bytesToDataUrl(bytes, mimeType);
      setFormState((prev) => ({
        ...prev,
        evidencePhotos: (prev.evidencePhotos || []).map((p, idx) =>
          idx === index
            ? {
                id: `${prev.formId}-photo-replaced-${Date.now()}-${index + 1}`,
                imageDataUrl: dataUrl,
              }
            : p
        ),
      }));
      setMediaNotice(
        saved.deduplicated
          ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
          : 'تم تحديث المرفق وحفظه في مستودع المرفقات مع بصمة SHA-256.'
      );
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhotoAt = (index: number) => {
    setMediaNotice(null);
    setFormState((prev) => ({
      ...prev,
      evidencePhotos: (prev.evidencePhotos || []).filter(
        (_, idx) => idx !== index
      ),
    }));
  };

  const handleLoadSamplePhotos = async () => {
    const samples = createDefaultSampleEvidencePhotos(colorSystem);
    const chosen = [samples[0], samples[1]];
    setFormState((prev) => ({
      ...prev,
      evidencePhotos: chosen,
    }));
    const repo = getDefaultTeacherMediaRepository();
    await Promise.all(
      chosen.map((p, idx) =>
        saveMediaDataUrl(
          {
            id: p.id,
            dataUrl: p.imageDataUrl,
            fileName: `${formId}-sample-evidence-${idx + 1}.svg`,
            sourceTag: 'sample',
          },
          repo
        )
      )
    );
    setMediaNotice('تم حفظ الصور التجريبية في مستودع المرفقات الموحد.');
  };

  const handleAddLink = () => {
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => {
      const currentLinks = prev.evidenceLinks || [];
      if (currentLinks.length >= 2) return prev;
      const nextLink: TeacherReportEvidenceLink = {
        id: `${prev.formId}-link-${Date.now()}-${currentLinks.length + 1}`,
        url: '',
      };
      return {
        ...prev,
        evidenceLinks: [...currentLinks, nextLink],
      };
    });
  };

  const handleUpdateLinkUrl = (index: number, url: string) => {
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => ({
      ...prev,
      evidenceLinks: (prev.evidenceLinks || []).map((item, idx) =>
        idx === index ? { ...item, url } : item
      ),
    }));
  };

  const handleDeleteLinkAt = (index: number) => {
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => ({
      ...prev,
      evidenceLinks: (prev.evidenceLinks || []).filter(
        (_, idx) => idx !== index
      ),
    }));
  };

  const handleLoadSampleLinks = () => {
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => ({
      ...prev,
      evidenceLinks: [
        {
          id: `${prev.formId}-sample-link-1`,
          url: 'https://moe.gov.sa/ar/education/Pages/default.aspx',
        },
        {
          id: `${prev.formId}-sample-link-2`,
          url: 'https://ien.edu.sa/',
        },
      ],
    }));
  };

  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];
  const palette = getTeacherColorPalette(colorSystem);

  // Live student count calculation
  const studentCountCalc = useMemo(() => {
    if (formState.formId === 'internal-test-execution') {
      return calculateRemainingStudentsCount(
        formState.targetStudentsCount,
        formState.performedStudentsCount,
        'المؤدين'
      );
    }
    return calculateRemainingStudentsCount(
      formState.targetStudentsCount,
      formState.completedStudentsCount,
      'المنجزين'
    );
  }, [formState]);

  const hasTypedBothCounts =
    formState.formId === 'internal-test-execution'
      ? Boolean(
          formState.targetStudentsCount.trim() ||
            formState.performedStudentsCount.trim()
        )
      : Boolean(
          formState.targetStudentsCount.trim() ||
            formState.completedStudentsCount.trim()
        );

  return (
    <div
      data-testid={`teacher-tests-eval-form-${formId}`}
      className="space-y-6"
    >
      {/* Top Navigation & Template/Color Bar */}
      <div className="bg-white rounded-2xl border border-[#E2E5E6] p-5 sm:p-6 space-y-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-tests-eval-group-btn"
              onClick={onBackToGroup}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>العودة إلى الاختبارات والتقويم</span>
            </button>

            <button
              type="button"
              data-testid="back-to-teacher-hub-from-tests-eval-btn"
              onClick={onBackToTeacherHub}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-xs sm:text-sm font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>العودة لقسم المعلم</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-tests-eval-archive-btn"
              onClick={() => setIsArchiveOpen((prev) => !prev)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isArchiveOpen
                  ? 'border-[#416B91] bg-[#376B70] text-white'
                  : 'border-[#E2E5E6] bg-white hover:bg-[#DCEAF5] text-[#416B91]'
              }`}
            >
              <Archive className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>الأرشيف المحفوظ ({savedRecords.length})</span>
            </button>

            <button
              type="button"
              data-testid="create-new-test-eval-btn"
              onClick={handleCreateNewRecord}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إنشاء تقرير جديد</span>
            </button>

            <button
              type="button"
              data-testid="save-test-eval-to-archive-btn"
              disabled={isSavingArchive}
              onClick={handleSaveToArchive}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isSavingArchive
                  ? 'جاري الحفظ...'
                  : activeArchivedRecordId
                    ? 'حفظ التعديلات في الأرشيف'
                    : 'حفظ في الأرشيف'}
              </span>
            </button>

            <button
              type="button"
              data-testid="load-sample-test-eval-btn"
              onClick={handleLoadSample}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#DCEAF5] hover:bg-[#CCE0F0] border border-[#E2E5E6] text-[#416B91] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wand2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تعبئة نموذجية للتجربة</span>
            </button>

            <button
              type="button"
              data-testid="reset-test-eval-btn"
              onClick={handleResetForm}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>إفراغ الحقول</span>
            </button>
          </div>
        </div>

        {/* Active Record Context Bar (Group 5) */}
        <div
          data-testid="test-eval-record-state-bar"
          className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
            <span>حالة التقرير الحالي:</span>
            {activeArchivedRecordId ? (
              <span
                data-testid="test-eval-active-record-status-text"
                className="text-[#2F6846]"
              >
                سجل محفوظ في الأرشيف (المعرف الثابت: {activeArchivedRecordId})
              </span>
            ) : (
              <span
                data-testid="test-eval-active-record-status-text"
                className="text-[#416B91]"
              >
                مسودة قيد التحرير (لا تُحتسب شاهدًا إلا بعد الحفظ والربط لاحقًا)
              </span>
            )}
          </div>
          {savedRecords.length > 0 && !isArchiveOpen && (
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="text-xs font-bold text-[#416B91] hover:underline cursor-pointer"
            >
              استعراض {savedRecords.length} سجل محفوظ
            </button>
          )}
        </div>

        {/* Multi-Record Archive Panel (Group 5: Tests & Evaluation) */}
        {isArchiveOpen && (
          <div
            data-testid="tests-eval-archive-panel"
            className="rounded-2xl border border-[#E2E5E6] bg-[#FBFBF9] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات الأرشيف المحفوظة — {modelMeta.title}
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  يحتفظ كل سجل محفوظ بمعرف ثابت مستقل، ويمكن البحث فيه وفتحه وتعديله أو حذفه بأمان دون التأثير على المسودات أو بقية السجلات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="min-h-[34px] px-3 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 cursor-pointer"
              >
                إغلاق الأرشيف
              </button>
            </div>

            {savedRecords.length > 0 && (
              <div className="relative">
                <Search
                  className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  data-testid="test-eval-archive-search-input"
                  aria-label="ابحث في الأرشيف بالاسم أو المادة أو الصف أو التصنيف"
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  placeholder="ابحث بالعنوان أو المادة أو الصف أو المعرف..."
                  className="w-full min-h-[38px] pr-9 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
              </div>
            )}

            {pendingDeleteTarget && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-delete-test-eval-archive-heading"
                data-testid="delete-test-eval-archive-confirm-panel"
                className={`rounded-xl border p-4 space-y-3 ${
                  pendingDeleteTarget.impact.isLinked
                    ? 'border-red-300 bg-red-50 text-red-950'
                    : 'border-[#E8C9BA] bg-[#FDF2ED] text-[#9A4A2E]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-5 h-5 shrink-0 mt-0.5 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div
                      id="confirm-delete-test-eval-archive-heading"
                      className="font-extrabold"
                    >
                      تأكيد حذف السجل «{pendingDeleteTarget.record.title}»
                    </div>
                    <p className="leading-relaxed">
                      {pendingDeleteTarget.impact.warningMessage ||
                        'سيؤدي هذا الإجراء إلى حذف السجل المحفوظ من الأرشيف وإزالة المرفقات غير المستخدمة في أي سجل آخر.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    data-testid="cancel-delete-test-eval-archive-record-btn"
                    onClick={() => setPendingDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-test-eval-archive-record-btn"
                    onClick={handleConfirmDeleteArchivedRecord}
                    className="min-h-[36px] px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {pendingDeleteTarget.impact.isLinked
                      ? 'تأكيد الحذف وفك الارتباط'
                      : 'تأكيد الحذف'}
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const filteredRecords = filterTestEvalArchiveRecords(
                savedRecords,
                {
                  formIdFilter: formId,
                  searchQuery: archiveSearchQuery,
                }
              );
              if (savedRecords.length === 0) {
                return (
                  <div
                    data-testid="tests-eval-archive-empty"
                    className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs sm:text-sm text-stone-600"
                  >
                    لا توجد سجلات محفوظة في أرشيف هذا النموذج حتى الآن. استكمل البيانات واضغط «حفظ في الأرشيف» لحفظ السجل بمعرف مستقل.
                  </div>
                );
              }
              if (filteredRecords.length === 0) {
                return (
                  <div
                    data-testid="tests-eval-archive-no-matches"
                    className="rounded-xl border border-dashed border-stone-300 bg-white p-4 text-center text-xs text-stone-600"
                  >
                    لا توجد سجلات مطابقة لعبارة البحث «{archiveSearchQuery}».
                  </div>
                );
              }
              return (
                <div className="space-y-2.5">
                  {filteredRecords.map((rec) => {
                    const isCurrent = activeArchivedRecordId === rec.id;
                    return (
                      <div
                        key={rec.id}
                        data-testid={`test-eval-archive-record-item-${rec.id}`}
                        className={`rounded-xl border bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                          isCurrent
                            ? 'border-[#416B91] ring-1 ring-[#416B91]/20'
                            : 'border-stone-200'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-extrabold text-sm text-stone-900 truncate">
                            {rec.title}
                          </div>
                          <div className="text-xs text-stone-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {rec.summary && <span>{rec.summary}</span>}
                            <span className="tabular-nums text-stone-500">
                              المعرف: {rec.id}
                            </span>
                            <span className="tabular-nums text-stone-500">
                              المرفقات: {rec.mediaRefs.length}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            data-testid={`open-test-eval-archive-record-${rec.id}`}
                            onClick={() => handleOpenArchivedRecord(rec)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#294660] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                          </button>

                          <button
                            type="button"
                            data-testid={`delete-test-eval-archive-record-${rec.id}`}
                            aria-label={`حذف السجل ${rec.title}`}
                            onClick={() => handleRequestDeleteArchivedRecord(rec)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Form Header & Export Action */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCEAF5] border border-[#E2E5E6] text-[#416B91] text-xs font-extrabold">
              {formId === 'internal-test-execution' ? (
                <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>قسم المعلم · الاختبارات والتقويم · {modelMeta.badge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
              {modelMeta.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              {modelMeta.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="toggle-test-eval-preview-tab-btn"
              onClick={() =>
                setActiveTab((prev) => (prev === 'edit' ? 'preview' : 'edit'))
              }
              className="xl:hidden min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] text-[#416B91] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {activeTab === 'edit'
                  ? 'معاينة التقرير (A4)'
                  : 'العودة لتعديل البيانات'}
              </span>
            </button>

            <button
              type="button"
              data-testid="export-test-eval-pdf-btn"
              disabled={isExporting}
              onClick={handleExportPdf}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isExporting
                  ? 'جاري تجهيز ملف PDF...'
                  : 'تصدير التقرير بصيغة PDF'}
              </span>
            </button>
          </div>
        </div>

        {/* Template & Color System Selector Bar */}
        <div className="pt-3 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-stone-700">
              قالب التقرير:
            </span>
            {ALL_TEMPLATES.map((tpl) => {
              const def = TEACHER_TEMPLATE_DEFINITIONS[tpl];
              const isSelected = templateStyle === tpl;
              return (
                <button
                  key={tpl}
                  type="button"
                  data-testid={`te-select-template-${tpl}`}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#376B70] text-white border-[#416B91]'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {def.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-stone-700 inline-flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-[#416B91]" />
              <span>النظام اللوني:</span>
            </span>
            {ALL_COLOR_SYSTEMS.map((col) => {
              const pal = TEACHER_COLOR_PALETTES[col];
              const isSelected = colorSystem === col;
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`te-select-color-${col}`}
                  onClick={() => handleSelectColorSystem(col)}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: pal.primaryHex }}
                  />
                  <span>{pal.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status or Validation Messages */}
        {statusBanner && (
          <div
            data-testid="test-eval-status-banner"
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 ${
              statusBanner.type === 'success'
                ? 'bg-[#EEF5EE] border-[#C5DCC7] text-[#2F6846]'
                : statusBanner.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-[#DCEAF5] border-[#E2E5E6] text-[#294660]'
            }`}
          >
            {statusBanner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${
                  statusBanner.type === 'success'
                    ? 'text-[#2F6846]'
                    : 'text-[#416B91]'
                }`}
              />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div
            data-testid="test-eval-validation-errors"
            className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>يرجى استكمال أو تصحيح الحقول التالية قبل تصدير PDF:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-800 space-y-1 pr-2">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Split Grid: Editor Left/Right + Live A4 Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`xl:col-span-7 space-y-5 ${
            activeTab === 'preview' ? 'hidden xl:block' : ''
          }`}
        >
          {formState.formId === 'internal-test-execution' ? (
            /* ================================================================
               النموذج الأول: تقرير تنفيذ اختبار داخلي
               ================================================================ */
            <>
              {/* 1. البيانات الأساسية للاختبار الداخلي */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ١. البيانات الأساسية للاختبار الداخلي
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    توثيق اختبار داخلي أعدّه المعلم ونفّذه لطلابه داخل المدرسة
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="ite-test-name-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      اسم الاختبار <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="ite-test-name-input"
                      data-testid="ite-test-name-input"
                      type="text"
                      value={formState.testName}
                      onChange={(e) =>
                        updateInternalTestState((prev) => ({
                          ...prev,
                          testName: e.target.value,
                        }))
                      }
                      placeholder="مثال: الاختبار التقويمي الأول لوحدة الجبر والمعادلات..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="ite-subject-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        المادة الدراسية <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="ite-subject-input"
                        data-testid="ite-subject-input"
                        type="text"
                        value={formState.subject}
                        onChange={(e) =>
                          updateInternalTestState((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          }))
                        }
                        placeholder="مثال: الرياضيات"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ite-stage-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        المرحلة الدراسية <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="ite-stage-input"
                        data-testid="ite-stage-input"
                        type="text"
                        list="ite-stage-suggestions"
                        value={formState.stage}
                        onChange={(e) =>
                          updateInternalTestState((prev) => ({
                            ...prev,
                            stage: e.target.value,
                          }))
                        }
                        placeholder="مثال: المرحلة المتوسطة"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                      <datalist id="ite-stage-suggestions">
                        {STAGE_SUGGESTIONS.map((st) => (
                          <option key={st} value={st} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label
                        htmlFor="ite-grade-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        الصف <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="ite-grade-input"
                        data-testid="ite-grade-input"
                        type="text"
                        value={formState.grade}
                        onChange={(e) =>
                          updateInternalTestState((prev) => ({
                            ...prev,
                            grade: e.target.value,
                          }))
                        }
                        placeholder="مثال: الصف الثاني المتوسط"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="ite-category-select"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        تصنيف الاختبار <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="ite-category-select"
                        data-testid="ite-category-select"
                        value={formState.testCategory}
                        onChange={(e) =>
                          updateInternalTestState((prev) => ({
                            ...prev,
                            testCategory:
                              e.target.value as InternalTestCategoryOption,
                          }))
                        }
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      >
                        {INTERNAL_TEST_CATEGORY_OPTIONS.map((catOpt) => (
                          <option key={catOpt} value={catOpt}>
                            {catOpt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="ite-date-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        تاريخ تنفيذ الاختبار{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="ite-date-input"
                        data-testid="ite-date-input"
                        type="text"
                        value={formState.executionDate}
                        onChange={(e) =>
                          updateInternalTestState((prev) => ({
                            ...prev,
                            executionDate: e.target.value,
                          }))
                        }
                        placeholder="١٤٤٧/٠٨/٢٥هـ"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  </div>

                  {formState.testCategory === 'تصنيف آخر' && (
                    <div>
                      <label
                        htmlFor="ite-custom-category-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        كتابة تصنيف الاختبار المخصص{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="ite-custom-category-input"
                        data-testid="ite-custom-category-input"
                        type="text"
                        value={formState.customTestCategory}
                        onChange={(e) =>
                          updateInternalTestState((prev) => ({
                            ...prev,
                            customTestCategory: e.target.value,
                          }))
                        }
                        placeholder="اكتب تصنيف الاختبار..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* 2. بيانات التنفيذ وإحصاءات الطلاب */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٢. الدرجة النهائية وطريقة التنفيذ وإحصاءات الحضور
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    يُحسب عدد الغائبين تلقائيًا من خلال طرح عدد الذين أدوا
                    الاختبار من العدد المستهدف
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="ite-max-score-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      الدرجة النهائية للاختبار (قيمة رقمية مرنة مثل 20 أو 30 أو
                      40) <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="ite-max-score-input"
                      data-testid="ite-max-score-input"
                      type="text"
                      inputMode="decimal"
                      value={formState.maxScore}
                      onChange={(e) =>
                        updateInternalTestState((prev) => ({
                          ...prev,
                          maxScore: e.target.value,
                        }))
                      }
                      placeholder="مثال: 20 أو 30 أو 40"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      طريقة تنفيذ الاختبار{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {INTERNAL_TEST_EXECUTION_METHODS.map((methodOpt) => {
                        const isSelected =
                          formState.executionMethod === methodOpt;
                        return (
                          <button
                            key={methodOpt}
                            type="button"
                            data-testid={`ite-method-${methodOpt}`}
                            onClick={() =>
                              updateInternalTestState((prev) => ({
                                ...prev,
                                executionMethod:
                                  methodOpt as InternalTestExecutionMethod,
                              }))
                            }
                            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#376B70] text-white border-[#416B91]'
                                : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {methodOpt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label
                      htmlFor="ite-target-count-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      عدد الطلاب المستهدفين{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="ite-target-count-input"
                      data-testid="ite-target-count-input"
                      type="text"
                      inputMode="numeric"
                      value={formState.targetStudentsCount}
                      onChange={(e) =>
                        updateInternalTestState((prev) => ({
                          ...prev,
                          targetStudentsCount: e.target.value,
                        }))
                      }
                      placeholder="مثال: 32"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91] tabular-nums"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ite-performed-count-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      عدد الطلاب الذين أدوا الاختبار{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="ite-performed-count-input"
                      data-testid="ite-performed-count-input"
                      type="text"
                      inputMode="numeric"
                      value={formState.performedStudentsCount}
                      onChange={(e) =>
                        updateInternalTestState((prev) => ({
                          ...prev,
                          performedStudentsCount: e.target.value,
                        }))
                      }
                      placeholder="مثال: 30"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      عدد الغائبين (حساب تلقائي)
                    </label>
                    <div
                      data-testid="ite-absent-count-display"
                      className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-sm font-extrabold flex items-center justify-between tabular-nums ${
                        studentCountCalc.isValid
                          ? 'bg-[#DCEAF5] border-[#E2E5E6] text-[#416B91]'
                          : 'bg-stone-100 border-stone-200 text-stone-500'
                      }`}
                    >
                      <span>عدد الغائبين:</span>
                      <span data-testid="ite-absent-count-value">
                        {studentCountCalc.isValid &&
                        studentCountCalc.remainingCount !== null
                          ? studentCountCalc.remainingCount
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {hasTypedBothCounts &&
                  !studentCountCalc.isValid &&
                  studentCountCalc.errorMessage && (
                    <div
                      data-testid="ite-counts-inline-error"
                      className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-800 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{studentCountCalc.errorMessage}</span>
                    </div>
                  )}
              </section>

              {/* 3. ملاحظات إضافية (اختيارية) */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-3">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٣. ملاحظات إضافية (اختياري)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    إذا تُركت فارغة فلن يظهر قسم الملاحظات الإضافية في ملف PDF
                  </p>
                </div>

                <textarea
                  id="ite-notes-textarea"
                  data-testid="ite-notes-textarea"
                  rows={2}
                  value={formState.additionalNotes}
                  onChange={(e) =>
                    updateInternalTestState((prev) => ({
                      ...prev,
                      additionalNotes: e.target.value,
                    }))
                  }
                  placeholder="أضف أي ملاحظات تنظيمية حول تنفيذ الاختبار (اختياري)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
              </section>
            </>
          ) : (
            /* ================================================================
               النموذج الثاني: تقرير تنفيذ مهمة أدائية
               ================================================================ */
            <>
              {/* 1. البيانات الأساسية للمهمة الأدائية */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ١. البيانات الأساسية للمهمة الأدائية
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    توثيق مهمة تعليمية يطبق فيها الطلاب معارفهم ومهاراتهم عمليًا
                    أو ينتجون عملًا يمكن ملاحظته وتقويمه
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="pte-task-name-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      اسم المهمة الأدائية{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pte-task-name-input"
                      data-testid="pte-task-name-input"
                      type="text"
                      value={formState.taskName}
                      onChange={(e) =>
                        updatePerformanceTaskState((prev) => ({
                          ...prev,
                          taskName: e.target.value,
                        }))
                      }
                      placeholder="مثال: تصميم نماذج هندسية تطبيقية لحساب المساحات والحجوم..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="pte-subject-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        المادة الدراسية <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pte-subject-input"
                        data-testid="pte-subject-input"
                        type="text"
                        value={formState.subject}
                        onChange={(e) =>
                          updatePerformanceTaskState((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          }))
                        }
                        placeholder="مثال: الرياضيات"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="pte-stage-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        المرحلة الدراسية <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pte-stage-input"
                        data-testid="pte-stage-input"
                        type="text"
                        list="pte-stage-suggestions"
                        value={formState.stage}
                        onChange={(e) =>
                          updatePerformanceTaskState((prev) => ({
                            ...prev,
                            stage: e.target.value,
                          }))
                        }
                        placeholder="مثال: المرحلة المتوسطة"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                      <datalist id="pte-stage-suggestions">
                        {STAGE_SUGGESTIONS.map((st) => (
                          <option key={st} value={st} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label
                        htmlFor="pte-grade-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        الصف <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pte-grade-input"
                        data-testid="pte-grade-input"
                        type="text"
                        value={formState.grade}
                        onChange={(e) =>
                          updatePerformanceTaskState((prev) => ({
                            ...prev,
                            grade: e.target.value,
                          }))
                        }
                        placeholder="مثال: الصف الثاني المتوسط"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="pte-type-select"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        نوع المهمة <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="pte-type-select"
                        data-testid="pte-type-select"
                        value={formState.taskType}
                        onChange={(e) =>
                          updatePerformanceTaskState((prev) => ({
                            ...prev,
                            taskType: e.target.value as PerformanceTaskTypeOption,
                          }))
                        }
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      >
                        {PERFORMANCE_TASK_TYPE_OPTIONS.map((typeOpt) => (
                          <option key={typeOpt} value={typeOpt}>
                            {typeOpt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="pte-date-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        تاريخ التنفيذ أو الفترة{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pte-date-input"
                        data-testid="pte-date-input"
                        type="text"
                        value={formState.executionDateOrPeriod}
                        onChange={(e) =>
                          updatePerformanceTaskState((prev) => ({
                            ...prev,
                            executionDateOrPeriod: e.target.value,
                          }))
                        }
                        placeholder="مثال: ١٤٤٧/٠٨/٢٥هـ أو الأسبوع الرابع"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  </div>

                  {formState.taskType === 'أخرى' && (
                    <div>
                      <label
                        htmlFor="pte-custom-type-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        كتابة نوع المهمة المخصص{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pte-custom-type-input"
                        data-testid="pte-custom-type-input"
                        type="text"
                        value={formState.customTaskType}
                        onChange={(e) =>
                          updatePerformanceTaskState((prev) => ({
                            ...prev,
                            customTaskType: e.target.value,
                          }))
                        }
                        placeholder="اكتب نوع المهمة الأدائية..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* 2. إحصاءات إنجاز الطلاب */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٢. إحصاءات إنجاز الطلاب للمهمة
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    يُحسب عدد الطلاب الذين لم ينجزوا المهمة تلقائيًا من خلال طرح
                    عدد المنجزين من العدد المستهدف
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="pte-target-count-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      عدد الطلاب المستهدفين{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pte-target-count-input"
                      data-testid="pte-target-count-input"
                      type="text"
                      inputMode="numeric"
                      value={formState.targetStudentsCount}
                      onChange={(e) =>
                        updatePerformanceTaskState((prev) => ({
                          ...prev,
                          targetStudentsCount: e.target.value,
                        }))
                      }
                      placeholder="مثال: 32"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91] tabular-nums"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pte-completed-count-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      عدد الطلاب الذين أنجزوا المهمة{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pte-completed-count-input"
                      data-testid="pte-completed-count-input"
                      type="text"
                      inputMode="numeric"
                      value={formState.completedStudentsCount}
                      onChange={(e) =>
                        updatePerformanceTaskState((prev) => ({
                          ...prev,
                          completedStudentsCount: e.target.value,
                        }))
                      }
                      placeholder="مثال: 29"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91] tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1.5">
                      عدد الطلاب الذين لم ينجزوها (تلقائي)
                    </label>
                    <div
                      data-testid="pte-not-completed-count-display"
                      className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-sm font-extrabold flex items-center justify-between tabular-nums ${
                        studentCountCalc.isValid
                          ? 'bg-[#DCEAF5] border-[#E2E5E6] text-[#416B91]'
                          : 'bg-stone-100 border-stone-200 text-stone-500'
                      }`}
                    >
                      <span>لم ينجزوها:</span>
                      <span data-testid="pte-not-completed-count-value">
                        {studentCountCalc.isValid &&
                        studentCountCalc.remainingCount !== null
                          ? studentCountCalc.remainingCount
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {hasTypedBothCounts &&
                  !studentCountCalc.isValid &&
                  studentCountCalc.errorMessage && (
                    <div
                      data-testid="pte-counts-inline-error"
                      className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-800 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{studentCountCalc.errorMessage}</span>
                    </div>
                  )}
              </section>

              {/* 3. تفاصيل المهمة وطريقة تقويمها */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٣. تفاصيل المهمة الأدائية وطريقة تقويمها
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    توثيق هدف المهمة ووصف تنفيذها وكيفية تقويم أداء الطلاب
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="pte-goal-textarea"
                    className="block text-xs font-bold text-stone-800 mb-1.5"
                  >
                    هدف المهمة: ما الذي يُتوقع من الطلاب تعلمه أو تطبيقه؟{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="pte-goal-textarea"
                    data-testid="pte-goal-textarea"
                    rows={2}
                    value={formState.taskGoal}
                    onChange={(e) =>
                      updatePerformanceTaskState((prev) => ({
                        ...prev,
                        taskGoal: e.target.value,
                      }))
                    }
                    placeholder="وضّح ما يُتوقع من الطلاب تعلمه أو تطبيقه من خلال هذه المهمة الأدائية..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pte-desc-textarea"
                    className="block text-xs font-bold text-stone-800 mb-1.5"
                  >
                    وصف المهمة وآلية تنفيذها{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="pte-desc-textarea"
                    data-testid="pte-desc-textarea"
                    rows={3}
                    value={formState.taskDescriptionAndMechanism}
                    onChange={(e) =>
                      updatePerformanceTaskState((prev) => ({
                        ...prev,
                        taskDescriptionAndMechanism: e.target.value,
                      }))
                    }
                    placeholder="صف خطوات تنفيذ المهمة الأدائية وما قام به الطلاب لإنجازها..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pte-eval-method-textarea"
                    className="block text-xs font-bold text-stone-800 mb-1"
                  >
                    طريقة التقويم <span className="text-red-600">*</span>
                  </label>
                  <p className="text-[11px] text-stone-500 mb-1.5">
                    صف باختصار كيف تم تقويم أداء الطلاب
                  </p>
                  <textarea
                    id="pte-eval-method-textarea"
                    data-testid="pte-eval-method-textarea"
                    rows={2}
                    value={formState.evaluationMethod}
                    onChange={(e) =>
                      updatePerformanceTaskState((prev) => ({
                        ...prev,
                        evaluationMethod: e.target.value,
                      }))
                    }
                    placeholder="صف باختصار كيف تم تقويم أداء الطلاب..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>
              </section>

              {/* 4. ملاحظات إضافية (اختيارية) */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-3">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٤. ملاحظات إضافية (اختياري)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    إذا تُركت فارغة فلن يظهر قسم الملاحظات الإضافية في ملف PDF
                  </p>
                </div>

                <textarea
                  id="pte-notes-textarea"
                  data-testid="pte-notes-textarea"
                  rows={2}
                  value={formState.additionalNotes}
                  onChange={(e) =>
                    updatePerformanceTaskState((prev) => ({
                      ...prev,
                      additionalNotes: e.target.value,
                    }))
                  }
                  placeholder="أضف أي ملاحظات إضافية حول تنفيذ المهمة الأدائية (اختياري)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
              </section>
            </>
          )}

          {/* قسم الشواهد الاختياري المشترك للنموذجين */}
          <section
            data-testid="te-photos-section"
            className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                  <Camera
                    className="w-4 h-4 text-[#416B91]"
                    aria-hidden="true"
                  />
                  <span>
                    {formState.formId === 'internal-test-execution'
                      ? '٤. الشواهد (اختياري — بحد أقصى صورتان)'
                      : '٥. الشواهد (اختياري — بحد أقصى صورتان)'}
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  يدعم رفع الصور من الجهاز مع المعاينة والاستبدال والحذف؛ وعند
                  عدم إرفاق صور لا يظهر قسم الشواهد أو أي إطار فارغ في ملف PDF
                </p>
              </div>

              <span
                data-testid="te-photos-count"
                className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
              >
                {(formState.evidencePhotos || []).length} / 2
              </span>
            </div>

            {mediaNotice && (
              <div
                data-testid="te-media-store-notice"
                className="rounded-xl border border-[#C5DCC7] bg-[#EEF5EE] px-3.5 py-2 text-xs font-bold text-[#2F6846]"
              >
                {mediaNotice}
              </div>
            )}

            <input
              ref={addPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              data-testid="te-upload-photo-input"
              onChange={handleUploadNewPhotos}
              className="hidden"
            />

            {(formState.evidencePhotos || []).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(formState.evidencePhotos || []).map((photo, idx) => (
                  <div
                    key={photo.id}
                    data-testid={`te-photo-card-${idx + 1}`}
                    className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div className="aspect-[16/10] w-full rounded-lg border border-stone-200 bg-white overflow-hidden flex items-center justify-center">
                      <img
                        src={photo.imageDataUrl}
                        alt={`معاينة صورة الشاهد ${idx + 1}`}
                        className="w-full h-full object-contain block"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-700">
                        صورة الشاهد ({idx + 1})
                      </span>

                      <div className="flex items-center gap-1.5">
                        <input
                          ref={(el) => {
                            replacePhotoInputRefs.current[idx] = el;
                          }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          data-testid={`te-replace-photo-input-${idx + 1}`}
                          onChange={(e) => handleReplacePhotoAt(idx, e)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          data-testid={`te-replace-photo-btn-${idx + 1}`}
                          onClick={() =>
                            replacePhotoInputRefs.current[idx]?.click()
                          }
                          className="min-h-[30px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>استبدال</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`te-delete-photo-btn-${idx + 1}`}
                          onClick={() => handleDeletePhotoAt(idx)}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                لم يتم إرفاق أي شاهد مصور حاليًا — لن يظهر قسم الشواهد أو أي
                مساحة فارغة في ملف PDF.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(formState.evidencePhotos || []).length < 2 && (
                <button
                  type="button"
                  data-testid="te-add-photo-btn"
                  onClick={() => addPhotoInputRef.current?.click()}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>رفع صورة من الجهاز (JPG / PNG / WebP)</span>
                </button>
              )}

              {(formState.evidencePhotos || []).length === 0 && (
                <button
                  type="button"
                  data-testid="te-load-sample-photos-btn"
                  onClick={handleLoadSamplePhotos}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>إدراج صورتين تجريبيتين للمعاينة</span>
                </button>
              )}
            </div>
          </section>

          {/* Shared Optional Electronic Links (QR) Section (0..2 links) */}
          <section
            data-testid="te-links-section"
            className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-[#416B91]" />
                  <span>روابط إلكترونية</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  قسم اختياري لإضافة رابط واحد أو رابطين مستقلين؛ يُنشأ لكل رابط
                  رمز QR مستقل قابل للمسح والنقر داخل ملف PDF دون عرض الرابط
                  الطويل كنص، وعند عدم إدخال أي رابط يختفي القسم تمامًا
                </p>
              </div>
              <span
                data-testid="te-links-count"
                className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
              >
                {(formState.evidenceLinks || []).length} / 2
              </span>
            </div>

            {(formState.evidenceLinks || []).length > 0 ? (
              <div className="space-y-3">
                {(formState.evidenceLinks || []).map((linkItem, idx) => {
                  const cleanUrl = (linkItem.url || '').trim();
                  const isUrlValid =
                    Boolean(cleanUrl) && isValidElectronicUrl(cleanUrl);
                  const qrPreviewUrl = isUrlValid
                    ? generateQrSvgDataUrl(cleanUrl, palette.secondaryHex)
                    : '';

                  return (
                    <div
                      key={linkItem.id}
                      data-testid={`te-link-card-${idx + 1}`}
                      className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="w-full flex-1 space-y-1.5">
                        <label
                          htmlFor={`te-link-input-${idx + 1}`}
                          className="block text-xs font-bold text-stone-800"
                        >
                          الرابط الإلكتروني ({idx + 1})
                        </label>
                        <input
                          id={`te-link-input-${idx + 1}`}
                          data-testid={`te-link-input-${idx + 1}`}
                          type="url"
                          dir="ltr"
                          value={linkItem.url}
                          onChange={(e) =>
                            handleUpdateLinkUrl(idx, e.target.value)
                          }
                          placeholder="https://example.com/resource"
                          className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg border bg-white text-xs sm:text-sm text-stone-900 focus:outline-none ${
                            cleanUrl && !isUrlValid
                              ? 'border-red-400 focus:border-red-600'
                              : 'border-stone-300 focus:border-[#416B91]'
                          }`}
                        />
                        {cleanUrl && !isUrlValid && (
                          <p
                            data-testid={`te-link-error-${idx + 1}`}
                            className="text-[11px] font-bold text-red-700"
                          >
                            صيغة الرابط غير صحيحة — يرجى إدخال رابط يبدأ بـ
                            https:// أو http://
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        {qrPreviewUrl && (
                          <div
                            data-testid={`te-link-qr-preview-${idx + 1}`}
                            className="w-12 h-12 rounded-lg border border-stone-200 bg-white p-1 shrink-0 flex items-center justify-center"
                          >
                            <img
                              src={qrPreviewUrl}
                              alt={`معاينة باركود الرابط ${idx + 1}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          data-testid={`te-delete-link-btn-${idx + 1}`}
                          onClick={() => handleDeleteLinkAt(idx)}
                          className="min-h-[34px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                لم يتم إدخال أي رابط إلكتروني حاليًا — لن يظهر قسم الروابط أو أي
                رمز QR أو إطار فارغ في المعاينة أو ملف PDF.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(formState.evidenceLinks || []).length < 2 && (
                <button
                  type="button"
                  data-testid="te-add-link-btn"
                  onClick={handleAddLink}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  <span>إضافة رابط إلكتروني (مع رمز QR مستقل)</span>
                </button>
              )}

              {(formState.evidenceLinks || []).length === 0 && (
                <button
                  type="button"
                  data-testid="te-load-sample-links-btn"
                  onClick={handleLoadSampleLinks}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>إدراج رابطين تجريبيين للمعاينة</span>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Live A4 Canvas Preview Column */}
        <div
          data-testid="test-eval-live-preview-pane"
          className={`xl:col-span-5 space-y-4 xl:sticky xl:top-6 ${
            activeTab === 'edit' ? 'hidden xl:block' : ''
          }`}
        >
          <div className="bg-white rounded-2xl border border-[#E2E5E6] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                  المعاينة الحية للتقرير (A4 عمودي)
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  القالب: {activeTemplateDef.name} · {palette.name}
                </p>
              </div>
              <span
                data-testid="test-eval-page-count-badge"
                className="px-3 py-1 rounded-full bg-[#DCEAF5] border border-[#E2E5E6] text-[#416B91] text-xs font-extrabold tabular-nums"
              >
                عدد الصفحات: {paginatedPages.length}
              </span>
            </div>

            <div className="space-y-5 max-h-[820px] overflow-y-auto pr-1">
              {renderedPages.map((page, idx) => (
                <div
                  key={idx}
                  data-testid={`test-eval-preview-page-${idx + 1}`}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 px-1">
                    <span>
                      الصفحة {idx + 1} من {renderedPages.length}
                    </span>
                  </div>
                  <div className="relative rounded-xl border border-stone-300 bg-stone-100 overflow-hidden shadow-xs">
                    {page.dataUrl ? (
                      <>
                        <img
                          src={page.dataUrl}
                          alt={`معاينة الصفحة ${idx + 1}`}
                          className="w-full h-auto block"
                        />
                        {page.links &&
                          page.links.map((lnk, lIdx) => (
                            <a
                              key={lIdx}
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`test-eval-preview-qr-link-${idx + 1}-${lIdx + 1}`}
                              title={`فتح الرابط الإلكتروني (${lIdx + 1})`}
                              style={{
                                position: 'absolute',
                                left: `${(lnk.xPx / page.pixelWidth) * 100}%`,
                                top: `${(lnk.yPx / page.pixelHeight) * 100}%`,
                                width: `${(lnk.wPx / page.pixelWidth) * 100}%`,
                                height: `${(lnk.hPx / page.pixelHeight) * 100}%`,
                              }}
                              className="block rounded-md hover:ring-2 hover:ring-[#416B91] transition-shadow cursor-pointer"
                            >
                              <span className="sr-only">
                                فتح الرابط الإلكتروني ({lIdx + 1})
                              </span>
                            </a>
                          ))}
                      </>
                    ) : (
                      <div className="aspect-[1/1.414] flex items-center justify-center text-xs text-stone-400">
                        جاري تجهيز المعاينة...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
