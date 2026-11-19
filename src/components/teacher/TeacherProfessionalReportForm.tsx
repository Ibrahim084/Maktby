import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Palette,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../../types';
import { getGenderedLabels } from '../../utils/settingsStorage';
import { RecordDeletionImpact } from '../../utils/teacherArchiveEngine';
import {
  generateTeacherReportPdf,
  getTeacherColorPalette,
  paginateTeacherReportBlocks,
  renderTeacherReportPagesToCanvases,
  TEACHER_COLOR_PALETTES,
  TEACHER_TEMPLATE_DEFINITIONS,
  TeacherPageJpegWithLinks,
} from '../../utils/teacherPdfEngine';
import {
  createNewBlankReportInArchive,
  deleteArchivedReportRecordSafely,
  inspectArchivedReportDeletionImpact,
  listSavedReportsForForm,
  loadActiveReportDraftWithMedia,
  loadArchivedReportWithMedia,
  migrateProfessionalReportsToArchive,
  saveActiveReportDraftWithMedia,
  saveReportToArchive,
  TeacherReportArchiveRecord,
} from '../../utils/teacherReportsArchive';
import {
  buildTeacherReportDocumentFromForm,
  clearTeacherReportDraftInStorage,
  computeLearningLevelsDistribution,
  createSampleTeacherReportFormData,
  DistinguishedPracticeReportData,
  EducationalProblemRemediationReportData,
  LearningOutcomesAnalysisReportData,
  loadTeacherReportDraftFromStorage,
  PRACTICE_SUSTAINABILITY_OPTIONS,
  PROBLEM_TARGET_CATEGORIES,
  PROFESSIONAL_ACHIEVEMENT_TYPES,
  ProfessionalAchievementReportData,
  saveTeacherReportDraftToStorage,
  SEMESTER_ASSESSMENT_METHODS_OPTIONS,
  SEMESTER_OPTIONS,
  STAGE_OPTIONS,
  StrategyImplementationReportData,
  TEACHER_PROFESSIONAL_REPORTS_CATALOG,
  TeacherProfessionalReportId,
  TeacherReportFormMap,
  validateTeacherProfessionalReport,
} from '../../utils/teacherReportsEngine';
import { TeacherEvidenceSection } from './TeacherEvidenceSection';

interface TeacherProfessionalReportFormProps {
  formId: TeacherProfessionalReportId;
  onBackToCatalog: () => void;
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

export const TeacherProfessionalReportForm: React.FC<
  TeacherProfessionalReportFormProps
> = ({ formId, onBackToCatalog }) => {
  const { settings, updateSettings } = useSettings();
  const gendered = getGenderedLabels(settings.gender);
  const teacherLabel =
    gendered.gender === 'female' ? 'اسم المعلمة' : 'اسم المعلم';

  const metadata = useMemo(
    () =>
      TEACHER_PROFESSIONAL_REPORTS_CATALOG.find((item) => item.id === formId)!,
    [formId]
  );

  const templateStyle: TeacherPdfTemplateStyle =
    settings.teacherPdfTemplate ?? 'waves';
  const colorSystem: TeacherPdfColorSystem =
    settings.teacherPdfColorSystem ?? 'green';
  const palette = getTeacherColorPalette(colorSystem);
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];

  const [formData, setFormData] = useState<
    TeacherReportFormMap[TeacherProfessionalReportId]
  >(() => loadTeacherReportDraftFromStorage(formId, settings));

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [renderedPages, setRenderedPages] = useState<
    TeacherPageJpegWithLinks[]
  >([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Unified Archive State (Pilot Group 1)
  const [activeArchivedRecordId, setActiveArchivedRecordId] = useState<
    string | null
  >(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    undefined
  );
  const [savedRecords, setSavedRecords] = useState<
    TeacherReportArchiveRecord[]
  >(() => listSavedReportsForForm(formId));
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isSavingArchive, setIsSavingArchive] = useState<boolean>(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    record: TeacherReportArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);
  const isHydratingRef = useRef<boolean>(true);

  const refreshSavedRecords = () => {
    setSavedRecords(listSavedReportsForForm(formId));
  };

  // Run idempotent pilot migration once and hydrate draft + IndexedDB photos
  useEffect(() => {
    let cancelled = false;
    isHydratingRef.current = true;
    setActiveArchivedRecordId(null);
    setPendingDeleteTarget(null);
    setValidationErrors({});
    setStatusBanner(null);
    setActiveTab('edit');

    const initArchiveAndDraft = async () => {
      try {
        await migrateProfessionalReportsToArchive({ settings });
        const hydrated = await loadActiveReportDraftWithMedia(formId, {
          settings,
        });
        if (cancelled) return;
        setFormData(hydrated.formData);
        setActiveDraftId(hydrated.draftRecord?.id);
        refreshSavedRecords();
        if (hydrated.integrityWarnings.length > 0) {
          setStatusBanner({
            type: 'error',
            text: hydrated.integrityWarnings[0],
          });
        }
      } catch {
        if (!cancelled) {
          setFormData(loadTeacherReportDraftFromStorage(formId, settings));
          refreshSavedRecords();
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
    if (activeArchivedRecordId) {
      // Editing an existing archived record commits on explicit "حفظ التعديلات في الأرشيف"
      return;
    }

    let cancelled = false;
    const persistDraft = async () => {
      try {
        const res = await saveActiveReportDraftWithMedia(
          formId,
          formData as TeacherReportFormMap[typeof formId],
          {
            draftId: activeDraftId,
            settings,
          }
        );
        if (!cancelled && res.draftRecord?.id && res.draftRecord.id !== activeDraftId) {
          setActiveDraftId(res.draftRecord.id);
        }
      } catch {
        saveTeacherReportDraftToStorage(
          formId,
          formData as TeacherReportFormMap[typeof formId]
        );
      }
    };

    persistDraft();
    return () => {
      cancelled = true;
    };
  }, [formId, formData, activeArchivedRecordId]);

  // Sync teacherName with settings.userName if teacherName is empty
  useEffect(() => {
    if (!formData.teacherName?.trim() && settings.userName?.trim()) {
      setFormData((prev) => ({
        ...prev,
        teacherName: settings.userName.trim(),
      }));
    }
  }, [settings.userName]);

  const handleSelectTemplate = (nextTemplate: TeacherPdfTemplateStyle) => {
    updateSettings({
      ...settings,
      teacherPdfTemplate: nextTemplate,
    });
  };

  const handleSelectColorSystem = (nextColor: TeacherPdfColorSystem) => {
    updateSettings({
      ...settings,
      teacherPdfColorSystem: nextColor,
    });
  };

  const updateField = <K extends string>(key: K, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (validationErrors[key] || validationErrors.levelsDistribution) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        delete next.levelsDistribution;
        return next;
      });
    }
    setStatusBanner(null);
  };

  const handleFillSampleData = () => {
    const sample = createSampleTeacherReportFormData(formId, settings);
    setFormData(sample);
    setValidationErrors({});
    setStatusBanner({
      type: 'info',
      text: 'تمت تعبئة النموذج ببيانات نموذجية واقعية وحفظها محليًا — يمكنك تعديلها أو حفظها في الأرشيف أو معاينتها وتصديرها.',
    });
  };

  const handleResetForm = () => {
    const fresh = clearTeacherReportDraftInStorage(formId, settings);
    setFormData(fresh);
    setActiveArchivedRecordId(null);
    setValidationErrors({});
    setStatusBanner({
      type: 'info',
      text: 'تم تفريغ حقول النموذج وإعادة تعيين المسودة الحالية.',
    });
  };

  const handleSaveToArchive = async () => {
    const check = validateTeacherProfessionalReport(formData);
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول المطلوبة قبل حفظ التقرير في الأرشيف.',
      });
      return;
    }

    try {
      setIsSavingArchive(true);
      const saved = await saveReportToArchive(
        formId,
        formData as TeacherReportFormMap[typeof formId],
        {
          recordId: activeArchivedRecordId ?? undefined,
          settings,
        }
      );
      setActiveArchivedRecordId(saved.record.id);
      refreshSavedRecords();
      setStatusBanner({
        type: 'success',
        text: saved.isNew
          ? `تم حفظ التقرير سجلًا مستقلًا في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث السجل المحفوظ في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
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

  const handleCreateNewReport = () => {
    isHydratingRef.current = true;
    const created = createNewBlankReportInArchive(formId, { settings });
    setActiveArchivedRecordId(null);
    setActiveDraftId(created.draftRecord.id);
    setFormData(created.formData);
    setValidationErrors({});
    setActiveTab('edit');
    setStatusBanner({
      type: 'info',
      text: 'تم فتح مسودة تقرير جديد فارغة مع الإبقاء على جميع السجلات المحفوظة في الأرشيف دون تعديل.',
    });
    setTimeout(() => {
      isHydratingRef.current = false;
    }, 0);
  };

  const handleOpenArchivedRecord = async (record: TeacherReportArchiveRecord) => {
    try {
      isHydratingRef.current = true;
      const loaded = await loadArchivedReportWithMedia(record.id, {
        formId,
        settings,
      });
      if (!loaded) {
        setStatusBanner({
          type: 'error',
          text: 'تعذر العثور على السجل المطلوب في الأرشيف.',
        });
        return;
      }
      setActiveArchivedRecordId(loaded.record.id);
      setFormData(loaded.formData);
      setValidationErrors({});
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
    record: TeacherReportArchiveRecord
  ) => {
    const impact = inspectArchivedReportDeletionImpact(record.id);
    setPendingDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedRecord = async () => {
    if (!pendingDeleteTarget) return;
    const { record } = pendingDeleteTarget;
    const outcome = await deleteArchivedReportRecordSafely(record.id, {
      confirmUnlink: true,
    });
    setPendingDeleteTarget(null);
    refreshSavedRecords();
    if (activeArchivedRecordId === record.id) {
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
        text: `تم حذف التقرير «${record.title}» من الأرشيف بأمان${unlinkedNote}${sharedNote}`,
      });
    }
  };

  const reportDoc = useMemo(
    () =>
      buildTeacherReportDocumentFromForm(formData, settings, {
        templateStyle,
        colorSystem,
      }),
    [formData, settings, templateStyle, colorSystem]
  );

  const paginatedPages = useMemo(
    () => paginateTeacherReportBlocks(reportDoc, settings),
    [reportDoc, settings]
  );

  // Live render A4 pages onto high-DPI canvases
  useEffect(() => {
    let cancelled = false;
    renderTeacherReportPagesToCanvases(reportDoc, settings)
      .then((pages) => {
        if (!cancelled) {
          setRenderedPages(pages);
        }
      })
      .catch(() => {
        // Ignore transient canvas errors
      });
    return () => {
      cancelled = true;
    };
  }, [reportDoc, settings]);

  const handleSwitchToPreview = () => {
    const check = validateTeacherProfessionalReport(formData);
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة أو مراجعة مجموع مستويات الأداء قبل اعتماد التقرير.',
      });
      return;
    }
    setStatusBanner(null);
    setActiveTab('preview');
  };

  const handleExportPdf = async () => {
    const check = validateTeacherProfessionalReport(formData);
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل تصدير ملف PDF.',
      });
      return;
    }

    try {
      setIsExporting(true);
      setStatusBanner(null);
      const result = await generateTeacherReportPdf(reportDoc, settings);
      const blob = new Blob([new Uint8Array(result.pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatusBanner({
        type: 'success',
        text: `تم تصدير التقرير بصيغة PDF بنجاح (${result.pageCount} ${
          result.pageCount === 1 ? 'صفحة' : 'صفحات'
        }) وفق ${activeTemplateDef.name} و${palette.name}.`,
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'تعذر تصدير ملف PDF، يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // Render Specialized Fields per Form ID
  // =========================================================================
  const renderFormSpecificFields = () => {
    switch (formData.formId) {
      case 'strategy-implementation':
        return renderStrategyImplementationFields(formData);
      case 'problem-remediation':
        return renderProblemRemediationFields(formData);
      case 'learning-outcomes-analysis':
        return renderLearningOutcomesAnalysisFields(formData);
      case 'distinguished-practice':
        return renderDistinguishedPracticeFields(formData);
      case 'professional-achievement':
        return renderProfessionalAchievementFields(formData);
    }
  };

  // -------------------------------------------------------------------------
  // Form 1: تقرير تنفيذ استراتيجية تعليمية
  // -------------------------------------------------------------------------
  const renderStrategyImplementationFields = (
    data: StrategyImplementationReportData
  ) => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ١. البيانات الأساسية للاستراتيجية والحصة الدراسية
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="f1-reportTitle"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              اسم التقرير <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-reportTitle"
              type="text"
              data-testid="input-reportTitle"
              value={data.reportTitle}
              onChange={(e) => updateField('reportTitle', e.target.value)}
              placeholder="تقرير تنفيذ استراتيجية تعليمية"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.reportTitle && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.reportTitle}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="f1-strategyName"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              اسم الاستراتيجية <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-strategyName"
              type="text"
              data-testid="input-strategyName"
              value={data.strategyName}
              onChange={(e) => updateField('strategyName', e.target.value)}
              placeholder="مثال: التعلم التعاوني (Jigsaw) / الفصل المقلوب / فكر-زاوج-شارك"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.strategyName && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.strategyName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-subject"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المادة الدراسية <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-subject"
              type="text"
              data-testid="input-subject"
              value={data.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="مثال: العلوم / الرياضيات / لغتي"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.subject && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.subject}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-executionDate"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              التاريخ <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-executionDate"
              type="date"
              data-testid="input-executionDate"
              value={data.executionDate}
              onChange={(e) => updateField('executionDate', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.executionDate && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.executionDate}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-stage"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المرحلة الدراسية <span className="text-red-600">*</span>
            </label>
            <select
              id="f1-stage"
              data-testid="input-stage"
              value={data.stage}
              onChange={(e) => updateField('stage', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            >
              <option value="">اختر المرحلة الدراسية...</option>
              {STAGE_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {validationErrors.stage && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.stage}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-grade"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الصف <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-grade"
              type="text"
              data-testid="input-grade"
              value={data.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              placeholder="مثال: الثاني المتوسط"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.grade && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.grade}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-studentsCount"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              عدد الطلاب <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-studentsCount"
              type="text"
              inputMode="numeric"
              data-testid="input-studentsCount"
              value={data.studentsCount}
              onChange={(e) => updateField('studentsCount', e.target.value)}
              placeholder="مثال: 28"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.studentsCount && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.studentsCount}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-lessonTopic"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الدرس <span className="text-red-600">*</span>
            </label>
            <input
              id="f1-lessonTopic"
              type="text"
              data-testid="input-lessonTopic"
              value={data.lessonTopic}
              onChange={(e) => updateField('lessonTopic', e.target.value)}
              placeholder="عنوان الدرس المنفذ"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.lessonTopic && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.lessonTopic}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ٢. أهداف الاستراتيجية والأدوات وآلية التنفيذ
        </h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="f1-strategyObjectives"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              أهداف الاستراتيجية <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f1-strategyObjectives"
              rows={3}
              data-testid="input-strategyObjectives"
              value={data.strategyObjectives}
              onChange={(e) =>
                updateField('strategyObjectives', e.target.value)
              }
              placeholder="اكتب أهداف تطبيق الاستراتيجية (يمكن كتابة كل هدف في سطر مستقل)..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.strategyObjectives && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.strategyObjectives}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-educationalTools"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الأدوات والوسائل التعليمية <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f1-educationalTools"
              rows={2}
              data-testid="input-educationalTools"
              value={data.educationalTools}
              onChange={(e) => updateField('educationalTools', e.target.value)}
              placeholder="الوسائل والأدوات الموظفة أثناء تنفيذ الاستراتيجية..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.educationalTools && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.educationalTools}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f1-classroomMechanism"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              آلية تنفيذ الاستراتيجية داخل الحصة{' '}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f1-classroomMechanism"
              rows={4}
              data-testid="input-classroomMechanism"
              value={data.classroomMechanism}
              onChange={(e) =>
                updateField('classroomMechanism', e.target.value)
              }
              placeholder="صف خطوات وآلية تنفيذ الاستراتيجية مع الطلاب داخل الحصة الدراسية..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.classroomMechanism && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.classroomMechanism}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Form 2: تقرير معالجة مشكلة تعليمية
  // -------------------------------------------------------------------------
  const renderProblemRemediationFields = (
    data: EducationalProblemRemediationReportData
  ) => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ١. البيانات الأساسية
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="f2-subject"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المادة الدراسية <span className="text-red-600">*</span>
            </label>
            <input
              id="f2-subject"
              type="text"
              data-testid="input-subject"
              value={data.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="مثال: الرياضيات"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.subject && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.subject}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-grade"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الصف <span className="text-red-600">*</span>
            </label>
            <input
              id="f2-grade"
              type="text"
              data-testid="input-grade"
              value={data.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              placeholder="مثال: الأول المتوسط"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.grade && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.grade}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-targetCategory"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الفئة المستهدفة <span className="text-red-600">*</span>
            </label>
            <select
              id="f2-targetCategory"
              data-testid="input-targetCategory"
              value={data.targetCategory}
              onChange={(e) => updateField('targetCategory', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            >
              {PROBLEM_TARGET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="f2-remediationTopic"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              موضوع المعالجة <span className="text-red-600">*</span>
            </label>
            <input
              id="f2-remediationTopic"
              type="text"
              data-testid="input-remediationTopic"
              value={data.remediationTopic}
              onChange={(e) => updateField('remediationTopic', e.target.value)}
              placeholder="مثال: معالجة ضعف مهارة العمليات على الكسور الاعتيادية"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.remediationTopic && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.remediationTopic}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-executionLocation"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              مكان التنفيذ <span className="text-red-600">*</span>
            </label>
            <input
              id="f2-executionLocation"
              type="text"
              data-testid="input-executionLocation"
              value={data.executionLocation}
              onChange={(e) => updateField('executionLocation', e.target.value)}
              placeholder="مثال: الصف الدراسي / مصادر التعلم"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.executionLocation && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.executionLocation}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-executionDate"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              تاريخ التنفيذ <span className="text-red-600">*</span>
            </label>
            <input
              id="f2-executionDate"
              type="date"
              data-testid="input-executionDate"
              value={data.executionDate}
              onChange={(e) => updateField('executionDate', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.executionDate && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.executionDate}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-executionDuration"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              مدة التنفيذ <span className="text-red-600">*</span>
            </label>
            <input
              id="f2-executionDuration"
              type="text"
              data-testid="input-executionDuration"
              value={data.executionDuration}
              onChange={(e) => updateField('executionDuration', e.target.value)}
              placeholder="مثال: أسبوعان (٤ حصص مساندة)"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.executionDuration && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.executionDuration}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ٢. تشخيص المشكلة
        </h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="f2-problemDescription"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              وصف المشكلة التعليمية <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-problemDescription"
              rows={3}
              data-testid="input-problemDescription"
              value={data.problemDescription}
              onChange={(e) =>
                updateField('problemDescription', e.target.value)
              }
              placeholder="وصّف المشكلة التعليمية المرصودة بدقة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.problemDescription && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.problemDescription}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-probableCauses"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              أسباب المشكلة المحتملة <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-probableCauses"
              rows={3}
              data-testid="input-probableCauses"
              value={data.probableCauses}
              onChange={(e) => updateField('probableCauses', e.target.value)}
              placeholder="اذكر الأسباب المحتملة للمشكلة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.probableCauses && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.probableCauses}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-preRemediationLevel"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              مستوى الطالب أو الطلاب قبل المعالجة{' '}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-preRemediationLevel"
              rows={2}
              data-testid="input-preRemediationLevel"
              value={data.preRemediationLevel}
              onChange={(e) =>
                updateField('preRemediationLevel', e.target.value)
              }
              placeholder="وضح مستوى الأداء القبلي أو نتائج التقويم التشخيصي..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.preRemediationLevel && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.preRemediationLevel}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ٣. خطة المعالجة والنتائج والتوصيات
        </h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="f2-objectives"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الأهداف <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-objectives"
              rows={2}
              data-testid="input-objectives"
              value={data.objectives}
              onChange={(e) => updateField('objectives', e.target.value)}
              placeholder="أهداف خطة المعالجة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.objectives && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.objectives}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-executionSteps"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              خطوات التنفيذ <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-executionSteps"
              rows={3}
              data-testid="input-executionSteps"
              value={data.executionSteps}
              onChange={(e) => updateField('executionSteps', e.target.value)}
              placeholder="الإجراءات والخطوات العملية المنفذة لمعالجة المشكلة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.executionSteps && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.executionSteps}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-postRemediationLevel"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              مستوى الطالب أو الطلاب بعد المعالجة{' '}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-postRemediationLevel"
              rows={2}
              data-testid="input-postRemediationLevel"
              value={data.postRemediationLevel}
              onChange={(e) =>
                updateField('postRemediationLevel', e.target.value)
              }
              placeholder="نتائج التقويم البعدي ومستوى التحسن المتحقق..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.postRemediationLevel && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.postRemediationLevel}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f2-recommendations"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              التوصيات <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f2-recommendations"
              rows={2}
              data-testid="input-recommendations"
              value={data.recommendations}
              onChange={(e) => updateField('recommendations', e.target.value)}
              placeholder="التوصيات المقترحة لاستدامة التحسن..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.recommendations && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.recommendations}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Form 3: تقرير تحليل نتائج التعلم
  // -------------------------------------------------------------------------
  const renderLearningOutcomesAnalysisFields = (
    data: LearningOutcomesAnalysisReportData
  ) => {
    const dist = computeLearningLevelsDistribution(data);

    const toggleSemesterTool = (tool: string) => {
      const current = Array.isArray(data.semesterAssessmentTools)
        ? data.semesterAssessmentTools
        : [];
      const exists = current.includes(tool);
      const next = exists
        ? current.filter((t) => t !== tool)
        : [...current, tool];
      updateField('semesterAssessmentTools', next);
    };

    return (
      <div className="space-y-6">
        {/* 1. Scope Selection */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ١. اختيار نطاق التحليل والبيانات الأساسية
          </h3>

          <div
            role="radiogroup"
            aria-label="نطاق تحليل نتائج التعلم"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <button
              type="button"
              role="radio"
              aria-checked={data.analysisScope === 'single-exam'}
              data-testid="scope-single-exam"
              onClick={() => updateField('analysisScope', 'single-exam')}
              className={`min-h-[54px] p-3.5 rounded-xl border text-right transition-colors cursor-pointer flex items-center justify-between ${
                data.analysisScope === 'single-exam'
                  ? 'border-[#416B91] bg-[#DCEAF5] text-stone-950 font-bold'
                  : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:bg-white'
              }`}
            >
              <div>
                <div className="text-sm font-bold">اختبار واحد</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  تحليل نتائج اختبار فتري أو تقويم محدد بتاريخ تطبيقه
                </div>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  data.analysisScope === 'single-exam'
                    ? 'border-[#416B91] bg-[#376B70]'
                    : 'border-stone-400'
                }`}
              >
                {data.analysisScope === 'single-exam' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={data.analysisScope === 'full-semester'}
              data-testid="scope-full-semester"
              onClick={() => updateField('analysisScope', 'full-semester')}
              className={`min-h-[54px] p-3.5 rounded-xl border text-right transition-colors cursor-pointer flex items-center justify-between ${
                data.analysisScope === 'full-semester'
                  ? 'border-[#416B91] bg-[#DCEAF5] text-stone-950 font-bold'
                  : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:bg-white'
              }`}
            >
              <div>
                <div className="text-sm font-bold">فصل دراسي كامل</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  تحليل المحصلة الختامية للطلاب خلال الفصل دون تكرار احتساب الطالب
                </div>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  data.analysisScope === 'full-semester'
                    ? 'border-[#416B91] bg-[#376B70]'
                    : 'border-stone-400'
                }`}
              >
                {data.analysisScope === 'full-semester' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div>
              <label
                htmlFor="f3-subject"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                المادة الدراسية <span className="text-red-600">*</span>
              </label>
              <input
                id="f3-subject"
                type="text"
                data-testid="input-subject"
                value={data.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="مثال: لغتي الخالدة / الرياضيات"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.subject && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.subject}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="f3-stage"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                المرحلة الدراسية <span className="text-red-600">*</span>
              </label>
              <select
                id="f3-stage"
                data-testid="input-stage"
                value={data.stage}
                onChange={(e) => updateField('stage', e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              >
                <option value="">اختر المرحلة الدراسية...</option>
                {STAGE_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {validationErrors.stage && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.stage}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="f3-grade"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                الصف <span className="text-red-600">*</span>
              </label>
              <input
                id="f3-grade"
                type="text"
                data-testid="input-grade"
                value={data.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                placeholder="مثال: الثالث المتوسط"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.grade && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.grade}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="f3-semester"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                الفصل الدراسي <span className="text-red-600">*</span>
              </label>
              <select
                id="f3-semester"
                data-testid="input-semester"
                value={data.semester}
                onChange={(e) => updateField('semester', e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              >
                {SEMESTER_OPTIONS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="f3-totalStudentsCount"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                عدد الطلاب الإجمالي <span className="text-red-600">*</span>
              </label>
              <input
                id="f3-totalStudentsCount"
                type="text"
                inputMode="numeric"
                data-testid="input-totalStudentsCount"
                value={data.totalStudentsCount}
                onChange={(e) =>
                  updateField('totalStudentsCount', e.target.value)
                }
                placeholder="مثال: 30"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.totalStudentsCount && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.totalStudentsCount}
                </p>
              )}
            </div>
          </div>

          {/* Conditional Fields: Single Exam vs Full Semester */}
          {data.analysisScope === 'single-exam' ? (
            <div
              data-testid="conditional-single-exam-section"
              className="rounded-xl border border-[#E2E5E6] bg-[#DCEAF5]/60 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label
                  htmlFor="f3-examName"
                  className="block text-xs font-bold text-stone-800 mb-1.5"
                >
                  اسم الاختبار أو التقويم <span className="text-red-600">*</span>
                </label>
                <input
                  id="f3-examName"
                  type="text"
                  data-testid="input-examName"
                  value={data.examName}
                  onChange={(e) => updateField('examName', e.target.value)}
                  placeholder="مثال: اختبار الفترة الأولى / التقويم البنائي للوحدة الثانية"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
                {validationErrors.examName && (
                  <p className="text-xs text-red-600 mt-1">
                    {validationErrors.examName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="f3-applicationDate"
                  className="block text-xs font-bold text-stone-800 mb-1.5"
                >
                  تاريخ التطبيق <span className="text-red-600">*</span>
                </label>
                <input
                  id="f3-applicationDate"
                  type="date"
                  data-testid="input-applicationDate"
                  value={data.applicationDate}
                  onChange={(e) =>
                    updateField('applicationDate', e.target.value)
                  }
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
                {validationErrors.applicationDate && (
                  <p className="text-xs text-red-600 mt-1">
                    {validationErrors.applicationDate}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              data-testid="conditional-full-semester-section"
              className="rounded-xl border border-[#E2E5E6] bg-[#DCEAF5]/60 p-4 space-y-4"
            >
              <div className="text-xs font-bold text-[#416B91]">
                آلية إدخال نتائج التقويمات خلال الفصل الدراسي الكامل (يصنف كل طالب في مستوى أداء واحد وفق محصلته الفصلية الموحدة دون تكرار احتساب الطالب عبر اختبارات متعددة):
              </div>

              <div>
                <span className="block text-xs font-bold text-stone-800 mb-2">
                  أدوات التقويم المشمولة في المحصلة الفصلية:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SEMESTER_ASSESSMENT_METHODS_OPTIONS.map((tool) => {
                    const checked =
                      Array.isArray(data.semesterAssessmentTools) &&
                      data.semesterAssessmentTools.includes(tool);
                    return (
                      <label
                        key={tool}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#416B91] bg-white text-[#416B91]'
                            : 'border-stone-200 bg-white/70 text-stone-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSemesterTool(tool)}
                          className="w-3.5 h-3.5 accent-[#416B91]"
                        />
                        <span>{tool}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="f3-semesterCalculationMethod"
                  className="block text-xs font-bold text-stone-800 mb-1.5"
                >
                  آلية احتساب نتائج التقويمات خلال الفصل{' '}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="f3-semesterCalculationMethod"
                  rows={2}
                  data-testid="input-semesterCalculationMethod"
                  value={data.semesterCalculationMethod}
                  onChange={(e) =>
                    updateField('semesterCalculationMethod', e.target.value)
                  }
                  placeholder="وضح آلية احتساب المحصلة الختامية للطلاب خلال الفصل..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
                {validationErrors.semesterCalculationMethod && (
                  <p className="text-xs text-red-600 mt-1">
                    {validationErrors.semesterCalculationMethod}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="f3-semesterAssessmentsSummary"
                  className="block text-xs font-bold text-stone-800 mb-1.5"
                >
                  ملخص التقويمات المنفذة خلال الفصل (اختياري)
                </label>
                <textarea
                  id="f3-semesterAssessmentsSummary"
                  rows={2}
                  data-testid="input-semesterAssessmentsSummary"
                  value={data.semesterAssessmentsSummary}
                  onChange={(e) =>
                    updateField('semesterAssessmentsSummary', e.target.value)
                  }
                  placeholder="مثال: اختباران فترتان + مهمتان أدائيتان + التقويم المستمر + الاختبار النهائي..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. Automatic Performance Levels Distribution */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٢. توزيع مستويات الأداء (حساب آلي للنسب والتحقق من المجموع)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                أدخل عدد الطلاب في كل مستوى، وسيحسب النظام النسب المئوية تلقائيًا ويتحقق من مطابقة المجموع لإجمالي الطلاب.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                fieldKey: 'excellentCount' as const,
                levelIdx: 0,
                label: 'ممتاز',
              },
              {
                fieldKey: 'veryGoodCount' as const,
                levelIdx: 1,
                label: 'جيد جدًا',
              },
              {
                fieldKey: 'goodCount' as const,
                levelIdx: 2,
                label: 'جيد',
              },
              {
                fieldKey: 'acceptableCount' as const,
                levelIdx: 3,
                label: 'مقبول',
              },
              {
                fieldKey: 'weakCount' as const,
                levelIdx: 4,
                label: 'ضعيف',
              },
            ].map((item) => {
              const summary = dist.levels[item.levelIdx];
              return (
                <div
                  key={item.fieldKey}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor={`f3-${item.fieldKey}`}
                      className="text-xs font-extrabold text-stone-900"
                    >
                      {item.label}
                    </label>
                    <span
                      data-testid={`pct-${item.fieldKey}`}
                      className="text-xs font-extrabold text-[#416B91] bg-[#DCEAF5] px-2 py-0.5 rounded-md border border-[#E2E5E6] tabular-nums"
                    >
                      {summary.formattedPercentage}
                    </span>
                  </div>

                  <input
                    id={`f3-${item.fieldKey}`}
                    type="text"
                    inputMode="numeric"
                    data-testid={`input-${item.fieldKey}`}
                    value={data[item.fieldKey]}
                    onChange={(e) =>
                      updateField(item.fieldKey, e.target.value)
                    }
                    placeholder="عدد الطلاب"
                    className="w-full min-h-[38px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-sm font-bold text-center text-stone-900 focus:outline-none focus:border-[#416B91] tabular-nums"
                  />
                </div>
              );
            })}
          </div>

          <div
            data-testid="levels-distribution-status"
            data-is-matched={String(dist.isMatched)}
            className={`rounded-xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${
              dist.isMatched
                ? 'border-[#C5DCC7] bg-[#EEF5EE] text-[#2F6846]'
                : validationErrors.levelsDistribution ||
                    (dist.hasAnyLevelInput &&
                      dist.totalStudents !== null &&
                      !dist.isMatched)
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-stone-200 bg-stone-50 text-stone-700'
            }`}
          >
            {dist.isMatched ? (
              <CheckCircle2
                className="w-4 h-4 text-[#2F6846] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="w-4 h-4 text-[#9A4A2E] shrink-0"
                aria-hidden="true"
              />
            )}
            <span>
              {validationErrors.levelsDistribution || dist.statusMessage}
            </span>
          </div>
        </div>

        {/* 3. Analysis & Recommendations */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ٣. تحليل النتائج والإجراءات والتوصيات
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="f3-strengths"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                جوانب القوة <span className="text-red-600">*</span>
              </label>
              <textarea
                id="f3-strengths"
                rows={3}
                data-testid="input-strengths"
                value={data.strengths}
                onChange={(e) => updateField('strengths', e.target.value)}
                placeholder="أبرز المهارات والمعايير التي أتقنها الطلاب..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.strengths && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.strengths}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="f3-weaknesses"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                جوانب الضعف <span className="text-red-600">*</span>
              </label>
              <textarea
                id="f3-weaknesses"
                rows={3}
                data-testid="input-weaknesses"
                value={data.weaknesses}
                onChange={(e) => updateField('weaknesses', e.target.value)}
                placeholder="المهارات التي تحتاج إلى تعزيز أو معالجة..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.weaknesses && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.weaknesses}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="f3-keyObservations"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                أبرز الملاحظات <span className="text-red-600">*</span>
              </label>
              <textarea
                id="f3-keyObservations"
                rows={3}
                data-testid="input-keyObservations"
                value={data.keyObservations}
                onChange={(e) => updateField('keyObservations', e.target.value)}
                placeholder="ملاحظات عامة حول مستوى التحصيل وتفاعل الطلاب..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.keyObservations && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.keyObservations}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="f3-actionsAndRecommendations"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                الإجراءات والتوصيات <span className="text-red-600">*</span>
              </label>
              <textarea
                id="f3-actionsAndRecommendations"
                rows={3}
                data-testid="input-actionsAndRecommendations"
                value={data.actionsAndRecommendations}
                onChange={(e) =>
                  updateField('actionsAndRecommendations', e.target.value)
                }
                placeholder="الخطط العلاجية والإثرائية والتوصيات المقترحة..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.actionsAndRecommendations && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.actionsAndRecommendations}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Form 4: تقرير ممارسة تعليمية متميزة
  // -------------------------------------------------------------------------
  const renderDistinguishedPracticeFields = (
    data: DistinguishedPracticeReportData
  ) => (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] px-4 py-3 text-xs font-bold text-[#416B91] flex items-center gap-2">
        <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          هذا التقرير مخصص لتوثيق ممارسة تعليمية متميزة نُفذت بالفعل في الميدان التربوي، وليس لفكرة مستقبلية لم تطبق.
        </span>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ١. البيانات الأساسية للممارسة المنفذة
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="f4-practiceName"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              اسم الممارسة <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-practiceName"
              type="text"
              data-testid="input-practiceName"
              value={data.practiceName}
              onChange={(e) => updateField('practiceName', e.target.value)}
              placeholder="مثال: مختبر التحديات الرقمية التفاعلية في مطلع الحصة"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.practiceName && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.practiceName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-subject"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المادة الدراسية <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-subject"
              type="text"
              data-testid="input-subject"
              value={data.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="مثال: الحاسب وتقنية المعلومات"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.subject && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.subject}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-stage"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المرحلة الدراسية <span className="text-red-600">*</span>
            </label>
            <select
              id="f4-stage"
              data-testid="input-stage"
              value={data.stage}
              onChange={(e) => updateField('stage', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            >
              <option value="">اختر المرحلة الدراسية...</option>
              {STAGE_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {validationErrors.stage && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.stage}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-grade"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الصف <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-grade"
              type="text"
              data-testid="input-grade"
              value={data.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              placeholder="مثال: الأول الثانوي"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.grade && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.grade}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-applicationDuration"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              مدة التطبيق <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-applicationDuration"
              type="text"
              data-testid="input-applicationDuration"
              value={data.applicationDuration}
              onChange={(e) =>
                updateField('applicationDuration', e.target.value)
              }
              placeholder="مثال: ٨ أسابيع دراسية"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.applicationDuration && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.applicationDuration}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-applicationDate"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              تاريخ التطبيق <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-applicationDate"
              type="date"
              data-testid="input-applicationDate"
              value={data.applicationDate}
              onChange={(e) => updateField('applicationDate', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.applicationDate && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.applicationDate}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-targetGroup"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الفئة المستهدفة <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-targetGroup"
              type="text"
              data-testid="input-targetGroup"
              value={data.targetGroup}
              onChange={(e) => updateField('targetGroup', e.target.value)}
              placeholder="مثال: طلاب الصف الأول الثانوي"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.targetGroup && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.targetGroup}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-applicationLocation"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              مكان التطبيق <span className="text-red-600">*</span>
            </label>
            <input
              id="f4-applicationLocation"
              type="text"
              data-testid="input-applicationLocation"
              value={data.applicationLocation}
              onChange={(e) =>
                updateField('applicationLocation', e.target.value)
              }
              placeholder="مثال: معمل الحاسب الآلي / الصف الدراسي"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.applicationLocation && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.applicationLocation}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ٢. وصف الممارسة
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="f4-practiceIdea"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              فكرة الممارسة <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-practiceIdea"
              rows={2}
              data-testid="input-practiceIdea"
              value={data.practiceIdea}
              onChange={(e) => updateField('practiceIdea', e.target.value)}
              placeholder="لخص فكرة الممارسة التعليمية..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.practiceIdea && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.practiceIdea}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-applicationMotives"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              دوافع تطبيقها <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-applicationMotives"
              rows={2}
              data-testid="input-applicationMotives"
              value={data.applicationMotives}
              onChange={(e) =>
                updateField('applicationMotives', e.target.value)
              }
              placeholder="ما الدوافع التربوية لتطبيق هذه الممارسة؟"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.applicationMotives && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.applicationMotives}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-addressedChallenge"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              التحدي الذي عالجته <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-addressedChallenge"
              rows={2}
              data-testid="input-addressedChallenge"
              value={data.addressedChallenge}
              onChange={(e) =>
                updateField('addressedChallenge', e.target.value)
              }
              placeholder="ما التحدي التعليمي الذي أسهمت الممارسة في معالجته؟"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.addressedChallenge && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.addressedChallenge}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-objectives"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الأهداف <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-objectives"
              rows={2}
              data-testid="input-objectives"
              value={data.objectives}
              onChange={(e) => updateField('objectives', e.target.value)}
              placeholder="الأهداف التعليمية والتربوية للممارسة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.objectives && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.objectives}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-executionMechanism"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              آلية التنفيذ <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-executionMechanism"
              rows={3}
              data-testid="input-executionMechanism"
              value={data.executionMechanism}
              onChange={(e) =>
                updateField('executionMechanism', e.target.value)
              }
              placeholder="خطوات وآلية التنفيذ الفعلي..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.executionMechanism && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.executionMechanism}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-toolsAndMeans"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الأدوات والوسائل <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-toolsAndMeans"
              rows={3}
              data-testid="input-toolsAndMeans"
              value={data.toolsAndMeans}
              onChange={(e) => updateField('toolsAndMeans', e.target.value)}
              placeholder="الأدوات والوسائل التقنية والتعليمية المستخدمة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.toolsAndMeans && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.toolsAndMeans}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ٣. الأثر والنتائج والتوصيات
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="f4-achievedResults"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              النتائج المحققة <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-achievedResults"
              rows={2}
              data-testid="input-achievedResults"
              value={data.achievedResults}
              onChange={(e) => updateField('achievedResults', e.target.value)}
              placeholder="النتائج الملموسة التي تحققت بعد تطبيق الممارسة..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.achievedResults && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.achievedResults}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-impactOnStudentLearning"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              أثر الممارسة على تعلم الطلاب{' '}
              <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-impactOnStudentLearning"
              rows={2}
              data-testid="input-impactOnStudentLearning"
              value={data.impactOnStudentLearning}
              onChange={(e) =>
                updateField('impactOnStudentLearning', e.target.value)
              }
              placeholder="الأثر التربوي والتحصيلي على تعلم الطلاب..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.impactOnStudentLearning && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.impactOnStudentLearning}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f4-sustainabilityOption"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              إمكانية الاستمرار أو التعميم <span className="text-red-600">*</span>
            </label>
            <select
              id="f4-sustainabilityOption"
              data-testid="input-sustainabilityOption"
              value={data.sustainabilityOption}
              onChange={(e) =>
                updateField('sustainabilityOption', e.target.value)
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            >
              {PRACTICE_SUSTAINABILITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="f4-recommendations"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              التوصيات <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f4-recommendations"
              rows={2}
              data-testid="input-recommendations"
              value={data.recommendations}
              onChange={(e) => updateField('recommendations', e.target.value)}
              placeholder="التوصيات المقترحة لتطوير الممارسة أو تعميمها..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.recommendations && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.recommendations}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Form 5: تقرير إنجاز مهني
  // -------------------------------------------------------------------------
  const renderProfessionalAchievementFields = (
    data: ProfessionalAchievementReportData
  ) => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ١. البيانات الأساسية للإنجاز المهني
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="f5-achievementName"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              اسم الإنجاز <span className="text-red-600">*</span>
            </label>
            <input
              id="f5-achievementName"
              type="text"
              data-testid="input-achievementName"
              value={data.achievementName}
              onChange={(e) => updateField('achievementName', e.target.value)}
              placeholder="مثال: حقيبة الأنشطة التفاعلية وأدوات التقويم البنائي الرقمية"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.achievementName && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.achievementName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f5-achievementType"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              نوع الإنجاز <span className="text-red-600">*</span>
            </label>
            <select
              id="f5-achievementType"
              data-testid="input-achievementType"
              value={data.achievementType}
              onChange={(e) => updateField('achievementType', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            >
              {PROFESSIONAL_ACHIEVEMENT_TYPES.map((typeOpt) => (
                <option key={typeOpt} value={typeOpt}>
                  {typeOpt}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional field when 'إنجاز آخر' is selected */}
          {data.achievementType === 'إنجاز آخر' && (
            <div
              data-testid="conditional-custom-achievement-type"
              className="sm:col-span-3 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5]/60 p-3.5"
            >
              <label
                htmlFor="f5-customAchievementType"
                className="block text-xs font-bold text-stone-800 mb-1.5"
              >
                تحديد نوع الإنجاز الآخر <span className="text-red-600">*</span>
              </label>
              <input
                id="f5-customAchievementType"
                type="text"
                data-testid="input-customAchievementType"
                value={data.customAchievementType}
                onChange={(e) =>
                  updateField('customAchievementType', e.target.value)
                }
                placeholder="اكتب نوع الإنجاز المهني..."
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.customAchievementType && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.customAchievementType}
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="f5-subject"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المادة الدراسية <span className="text-stone-400">(اختياري)</span>
            </label>
            <input
              id="f5-subject"
              type="text"
              data-testid="input-subject"
              value={data.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="اختياري — يترك فارغًا إن لم يرتبط بمادة محددة"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
          </div>

          <div>
            <label
              htmlFor="f5-stage"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              المرحلة الدراسية <span className="text-stone-400">(اختياري)</span>
            </label>
            <select
              id="f5-stage"
              data-testid="input-stage"
              value={data.stage}
              onChange={(e) => updateField('stage', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            >
              <option value="">غير محدد (اختياري)</option>
              {STAGE_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="f5-grade"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الصف <span className="text-stone-400">(اختياري)</span>
            </label>
            <input
              id="f5-grade"
              type="text"
              data-testid="input-grade"
              value={data.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              placeholder="اختياري — يترك فارغًا إن لم يرتبط بصف محدد"
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
          </div>

          <div>
            <label
              htmlFor="f5-achievementDate"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              تاريخ الإنجاز <span className="text-red-600">*</span>
            </label>
            <input
              id="f5-achievementDate"
              type="date"
              data-testid="input-achievementDate"
              value={data.achievementDate}
              onChange={(e) => updateField('achievementDate', e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.achievementDate && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.achievementDate}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
          ٢. تفاصيل الإنجاز المهني والأثر
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="f5-achievementDescription"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              وصف الإنجاز <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f5-achievementDescription"
              rows={3}
              data-testid="input-achievementDescription"
              value={data.achievementDescription}
              onChange={(e) =>
                updateField('achievementDescription', e.target.value)
              }
              placeholder="وصّف الإنجاز المهني ومكوناته..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.achievementDescription && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.achievementDescription}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f5-achievementObjective"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الهدف منه <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f5-achievementObjective"
              rows={3}
              data-testid="input-achievementObjective"
              value={data.achievementObjective}
              onChange={(e) =>
                updateField('achievementObjective', e.target.value)
              }
              placeholder="الهدف التربوي أو المهني من هذا الإنجاز..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.achievementObjective && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.achievementObjective}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="f5-beneficiaryGroup"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              الفئة المستفيدة <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f5-beneficiaryGroup"
              rows={3}
              data-testid="input-beneficiaryGroup"
              value={data.beneficiaryGroup}
              onChange={(e) => updateField('beneficiaryGroup', e.target.value)}
              placeholder="مثال: طلاب المرحلة المتوسطة / معلمو التخصص..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.beneficiaryGroup && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.beneficiaryGroup}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="f5-resultsAndImpact"
              className="block text-xs font-bold text-stone-800 mb-1.5"
            >
              النتائج والأثر <span className="text-red-600">*</span>
            </label>
            <textarea
              id="f5-resultsAndImpact"
              rows={3}
              data-testid="input-resultsAndImpact"
              value={data.resultsAndImpact}
              onChange={(e) => updateField('resultsAndImpact', e.target.value)}
              placeholder="النتائج المتحققة وأثر الإنجاز على تجويد العملية التعليمية..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
            />
            {validationErrors.resultsAndImpact && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.resultsAndImpact}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-testid={`teacher-report-form-${formId}`}
      className="space-y-6"
    >
      {/* Top Bar: Back to Reports Group + Form Header + Quick Actions */}
      <section className="bg-white rounded-2xl border border-[#E2E5E6] p-5 sm:p-6 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            data-testid="back-to-teacher-reports-btn"
            onClick={onBackToCatalog}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قائمة التقارير المهنية والتعليمية</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-reports-archive-btn"
              onClick={() => setIsArchiveOpen((prev) => !prev)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
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
              data-testid="create-new-report-btn"
              onClick={handleCreateNewReport}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إنشاء تقرير جديد</span>
            </button>

            <button
              type="button"
              data-testid="save-report-to-archive-btn"
              disabled={isSavingArchive}
              onClick={handleSaveToArchive}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
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
              data-testid="fill-sample-report-data-btn"
              onClick={handleFillSampleData}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#416B91] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wand2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تعبئة بيانات نموذجية للتجربة</span>
            </button>

            <button
              type="button"
              data-testid="reset-report-form-btn"
              onClick={handleResetForm}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>إفراغ الحقول</span>
            </button>
          </div>
        </div>

        {/* Active Record Context Bar */}
        <div
          data-testid="report-record-state-bar"
          className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
            <span>حالة التقرير الحالي:</span>
            {activeArchivedRecordId ? (
              <span
                data-testid="active-record-status-text"
                className="text-[#2F6846]"
              >
                سجل محفوظ في الأرشيف (المعرف الثابت: {activeArchivedRecordId})
              </span>
            ) : (
              <span
                data-testid="active-record-status-text"
                className="text-[#416B91]"
              >
                مسودة قيد التحرير (لا تُحتسب شاهدًا إلا بعد الحفظ في الأرشيف)
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

        {/* Multi-Record Archive Panel (Pilot Group 1) */}
        {isArchiveOpen && (
          <div
            data-testid="reports-archive-panel"
            className="rounded-2xl border border-[#E2E5E6] bg-[#FBFBF9] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات الأرشيف المحفوظة — {metadata.title}
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  كل تقرير محفوظ يحتفظ بمعرف ثابت مستقل ويمكن فتحه وتعديله أو حذفه بأمان دون التأثير على المسودات أو بقية السجلات.
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

            {pendingDeleteTarget && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-delete-archive-heading"
                data-testid="delete-archive-confirm-panel"
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
                      id="confirm-delete-archive-heading"
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
                    data-testid="cancel-delete-archive-record-btn"
                    onClick={() => setPendingDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-archive-record-btn"
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

            {savedRecords.length === 0 ? (
              <div
                data-testid="reports-archive-empty"
                className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs sm:text-sm text-stone-600"
              >
                لا توجد سجلات محفوظة لهذا التقرير حتى الآن. استكمل البيانات واضغط «حفظ في الأرشيف» لحفظ السجل بمعرف مستقل.
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedRecords.map((rec) => {
                  const isCurrent = activeArchivedRecordId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      data-testid={`archive-record-item-${rec.id}`}
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
                          data-testid={`open-archive-record-${rec.id}`}
                          onClick={() => handleOpenArchivedRecord(rec)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#294660] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-archive-record-${rec.id}`}
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
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-t border-stone-100 pt-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCEAF5] border border-[#E2E5E6] text-[#416B91] text-xs font-bold">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>التقارير المهنية والتعليمية · {metadata.badge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
              {metadata.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              {metadata.description}
            </p>
          </div>

          {/* Mode Tabs (Edit vs Preview) + Direct PDF Export */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="tab-edit-form"
              onClick={() => setActiveTab('edit')}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-[#376B70] text-white border-[#416B91]'
                  : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>١. إدخال البيانات</span>
            </button>

            <button
              type="button"
              data-testid="tab-preview-report"
              onClick={handleSwitchToPreview}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-[#376B70] text-white border-[#416B91]'
                  : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>٢. معاينة التقرير ({paginatedPages.length} صفحة)</span>
            </button>

            <button
              type="button"
              data-testid="export-teacher-report-pdf-btn"
              disabled={isExporting}
              onClick={handleExportPdf}
              className="min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white inline-flex items-center gap-2 shadow-xs transition-opacity cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: palette.primaryHex }}
            >
              <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isExporting ? 'جاري التصدير...' : 'تصدير PDF (A4)'}
              </span>
            </button>
          </div>
        </div>

        {/* Template & Color System Selector Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-stone-100">
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Sparkles
                className="w-3.5 h-3.5 text-[#416B91]"
                aria-hidden="true"
              />
              <span>قالب PDF المعتمد:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_TEMPLATES.map((tplId) => {
                const tpl = TEACHER_TEMPLATE_DEFINITIONS[tplId];
                const isSelected = templateStyle === tplId;
                return (
                  <button
                    key={tplId}
                    type="button"
                    data-testid={`report-template-${tplId}`}
                    onClick={() => handleSelectTemplate(tplId)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#416B91] bg-[#376B70] text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {tpl.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Palette
                className="w-3.5 h-3.5 text-[#416B91]"
                aria-hidden="true"
              />
              <span>النظام اللوني:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_COLOR_SYSTEMS.map((colId) => {
                const sys = TEACHER_COLOR_PALETTES[colId];
                const isSelected = colorSystem === colId;
                return (
                  <button
                    key={colId}
                    type="button"
                    data-testid={`report-color-${colId}`}
                    onClick={() => handleSelectColorSystem(colId)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#416B91] bg-white text-stone-950 shadow-2xs'
                        : 'border-stone-200 bg-white/80 text-stone-700 hover:bg-white'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/10"
                      style={{ backgroundColor: sys.primaryHex }}
                    />
                    <span>{sys.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {statusBanner && (
          <div
            role="status"
            data-testid="teacher-report-status-banner"
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 ${
              statusBanner.type === 'success'
                ? 'border-[#C5DCC7] bg-[#EEF5EE] text-[#2F6846]'
                : statusBanner.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-[#E2E5E6] bg-[#DCEAF5] text-[#416B91]'
            }`}
          >
            {statusBanner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}
      </section>

      {activeTab === 'edit' ? (
        <div className="space-y-6">
          {/* Form-Specific Fields */}
          {renderFormSpecificFields()}

          {/* Independent Evidence Section (Max 2 Photos in IndexedDB + Max 2 Links with QR) */}
          <TeacherEvidenceSection
            photos={formData.evidencePhotos}
            links={formData.evidenceLinks}
            colorSystem={colorSystem}
            enableMediaStore={true}
            onChangePhotos={(nextPhotos) =>
              updateField('evidencePhotos', nextPhotos)
            }
            onChangeLinks={(nextLinks) =>
              updateField('evidenceLinks', nextLinks)
            }
          />

          {/* Teacher Name & Principal Signoff Info */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
              بيانات مُعدّ التقرير والاعتماد
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div>
                <label
                  htmlFor="common-teacherName"
                  className="block text-xs font-bold text-stone-800 mb-1.5"
                >
                  {teacherLabel} <span className="text-red-600">*</span>
                </label>
                <input
                  id="common-teacherName"
                  type="text"
                  data-testid="input-teacherName"
                  value={formData.teacherName}
                  onChange={(e) => updateField('teacherName', e.target.value)}
                  placeholder={`أدخل ${teacherLabel}...`}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                />
                {validationErrors.teacherName && (
                  <p className="text-xs text-red-600 mt-1">
                    {validationErrors.teacherName}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900">
                  اعتماد {gendered.principalTitle} في نهاية التقرير:
                </div>
                <div>
                  {settings.principalName?.trim() ? (
                    <span>
                      يظهر في أسفل الصفحة الأخيرة فقط بصيغة:{' '}
                      <strong className="text-stone-900">
                        «{gendered.principalTitle}: {settings.principalName.trim()}»
                      </strong>
                    </span>
                  ) : (
                    <span>
                      اسم {gendered.principalTitle} غير مضاف في الإعدادات حاليًا — لن يظهر التذييل ولن تُحجز له مساحة في ملف PDF.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                data-testid="bottom-preview-report-btn"
                onClick={handleSwitchToPreview}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>معاينة التقرير قبل التصدير</span>
              </button>

              <button
                type="button"
                data-testid="bottom-export-pdf-btn"
                disabled={isExporting}
                onClick={handleExportPdf}
                className="min-h-[46px] px-6 py-2.5 rounded-xl text-white text-sm font-bold inline-flex items-center gap-2 transition-opacity cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: palette.primaryHex }}
              >
                <FileDown className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isExporting ? 'جاري التصدير...' : 'تصدير التقرير PDF مباشرة'}
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : (
        /* Live A4 Portrait Preview (100% Identical to Exported PDF) */
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-stone-800">
              <Eye className="w-4 h-4 text-[#416B91]" aria-hidden="true" />
              <span>
                المعاينة الحية المطابقة ١٠٠٪ لملف PDF ({metadata.title} ·{' '}
                {activeTemplateDef.name} · {palette.name} · عدد الصفحات:{' '}
                {renderedPages.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="return-to-edit-btn"
                onClick={() => setActiveTab('edit')}
                className="min-h-[40px] px-4 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 cursor-pointer"
              >
                العودة لتعديل البيانات
              </button>
              <button
                type="button"
                data-testid="preview-export-pdf-btn"
                disabled={isExporting}
                onClick={handleExportPdf}
                className="min-h-[40px] px-4 py-1.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: palette.primaryHex }}
              >
                <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تحميل ملف PDF (A4)</span>
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {renderedPages.map((pageData, pageIdx) => (
              <article
                key={pageIdx}
                dir="rtl"
                data-testid={`report-preview-page-${pageIdx}`}
                data-template-style={templateStyle}
                data-color-system={colorSystem}
                data-links-count={pageData.links.length}
                className="relative bg-white mx-auto border border-stone-200 rounded-xl shadow-xs overflow-hidden max-w-[210mm] aspect-[1240/1754]"
              >
                {pageData.dataUrl ? (
                  <img
                    src={pageData.dataUrl}
                    alt={`معاينة صفحة ${pageIdx + 1} من ${metadata.title}`}
                    data-testid={`report-preview-img-${pageIdx}`}
                    className="w-full h-full object-contain block select-none"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-stone-400">
                    جاري تجهيز صفحة التقرير...
                  </div>
                )}

                {pageData.links.map((link, lIdx) => {
                  const leftPct = (link.xPx / pageData.pixelWidth) * 100;
                  const topPct = (link.yPx / pageData.pixelHeight) * 100;
                  const widthPct = (link.wPx / pageData.pixelWidth) * 100;
                  const heightPct = (link.hPx / pageData.pixelHeight) * 100;

                  return (
                    <a
                      key={lIdx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`report-qr-link-${lIdx + 1}`}
                      aria-label={`فتح رابط الشاهد الإلكتروني ${lIdx + 1}`}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className="absolute block rounded-lg ring-2 ring-transparent hover:ring-[#2F6846] hover:bg-black/5 transition-all cursor-pointer"
                    />
                  );
                })}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
