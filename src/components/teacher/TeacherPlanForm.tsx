import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookmarkCheck,
  CalendarRange,
  CheckCircle2,
  Eye,
  FileDown,
  FilePlus2,
  FolderOpen,
  Palette,
  Plus,
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
  createNewBlankPlanInArchive,
  deleteArchivedPlanRecordSafely,
  inspectArchivedPlanDeletionImpact,
  listSavedPlansForForm,
  loadActivePlanDraftWithMedia,
  loadArchivedPlanWithMedia,
  migrateTeacherPlansToArchive,
  saveActivePlanDraftWithMedia,
  savePlanToArchive,
  TeacherPlanArchiveRecord,
} from '../../utils/teacherPlansArchive';
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
  buildTeacherPlanDocumentFromForm,
  clearTeacherPlanDraftInStorage,
  createEmptyEnrichmentActivity,
  createEmptyGroupRemedialSkill,
  createEmptyIndividualRemedialGoal,
  createEmptyProfessionalDevGoal,
  createEmptyStudentProduct,
  createEmptyWeeklyLesson,
  createInitialTeacherPlanData,
  createSampleTeacherPlanFormData,
  ENRICHMENT_BENEFICIARIES_SCOPE_OPTIONS,
  ENRICHMENT_TYPES_OPTIONS,
  EnrichmentActivityItem,
  EnrichmentPlanData,
  FIVE_POINT_RATING_SCALE,
  FOLLOW_UP_PERIOD_OPTIONS,
  GROUP_REMEDIAL_SCOPE_OPTIONS,
  GroupRemedialPlanData,
  GroupRemedialSkillItem,
  IndividualRemedialGoalItem,
  IndividualRemedialPlanData,
  loadTeacherPlanDraftFromStorage,
  NEED_DIAGNOSIS_OPTIONS,
  PLAN_STATUS_OPTIONS,
  PLAN_TYPE_OPTIONS,
  ProfessionalDevelopmentPlanData,
  ProfessionalDevGoalItem,
  saveTeacherPlanDraftToStorage,
  StudentProductItem,
  TEACHER_PLANS_CATALOG,
  TeacherPlanFormId,
  TeacherPlanFormMap,
  validateTeacherPlanForm,
  WEAKNESS_SOURCE_OPTIONS,
  WeaknessSourceType,
  WeeklyLessonItem,
  WeeklyTeacherPlanData,
} from '../../utils/teacherPlansEngine';
import { TeacherEvidenceSection } from './TeacherEvidenceSection';

interface TeacherPlanFormProps {
  formId: TeacherPlanFormId;
  onBackToPath: () => void;
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

export const TeacherPlanForm: React.FC<TeacherPlanFormProps> = ({
  formId,
  onBackToPath,
  onBackToTeacherHub,
}) => {
  const { settings, updateSettings } = useSettings();
  const gendered = getGenderedLabels(settings.gender);
  const teacherLabel =
    gendered.gender === 'female' ? 'اسم المعلمة' : 'اسم المعلم';

  const metadata = useMemo(
    () => TEACHER_PLANS_CATALOG.find((item) => item.id === formId)!,
    [formId]
  );

  const pathLabel =
    metadata.pathId === 'teacher-plans'
      ? 'خطط المعلم'
      : 'خطط المعلم للطلاب';

  const templateStyle: TeacherPdfTemplateStyle =
    settings.teacherPdfTemplate ?? 'waves';
  const colorSystem: TeacherPdfColorSystem =
    settings.teacherPdfColorSystem ?? 'green';
  const palette = getTeacherColorPalette(colorSystem);
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];

  const [formData, setFormData] = useState<
    TeacherPlanFormMap[TeacherPlanFormId]
  >(() => loadTeacherPlanDraftFromStorage(formId, settings));

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

  // Unified Archive State (Group 2: 5 Teacher Plans)
  const [activeArchivedRecordId, setActiveArchivedRecordId] = useState<
    string | null
  >(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    undefined
  );
  const [savedRecords, setSavedRecords] = useState<
    TeacherPlanArchiveRecord[]
  >(() => listSavedPlansForForm(formId));
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isSavingArchive, setIsSavingArchive] = useState<boolean>(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    record: TeacherPlanArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);
  const isHydratingRef = useRef<boolean>(true);

  const refreshSavedRecords = () => {
    setSavedRecords(listSavedPlansForForm(formId));
  };

  // Run idempotent Group 2 migration once and hydrate active draft + IndexedDB photos
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
        await migrateTeacherPlansToArchive({ settings });
        const hydrated = await loadActivePlanDraftWithMedia(formId, {
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
          setFormData(loadTeacherPlanDraftFromStorage(formId, settings));
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
      // Editing an existing archived plan commits on explicit "حفظ التعديلات في الأرشيف"
      return;
    }

    let cancelled = false;
    const persistDraft = async () => {
      try {
        const res = await saveActivePlanDraftWithMedia(
          formId,
          formData as TeacherPlanFormMap[typeof formId],
          {
            draftId: activeDraftId,
            settings,
          }
        );
        if (
          !cancelled &&
          res.draftRecord?.id &&
          res.draftRecord.id !== activeDraftId
        ) {
          setActiveDraftId(res.draftRecord.id);
        }
      } catch {
        saveTeacherPlanDraftToStorage(
          formId,
          formData as TeacherPlanFormMap[typeof formId]
        );
      }
    };

    persistDraft();
    return () => {
      cancelled = true;
    };
  }, [formId, formData, activeArchivedRecordId]);

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
    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setStatusBanner(null);
  };

  const handleFillSampleData = () => {
    const sample = createSampleTeacherPlanFormData(formId, settings);
    setFormData(sample);
    setValidationErrors({});
    setStatusBanner({
      type: 'info',
      text: 'تمت تعبئة الخطة ببيانات نموذجية واقعية وحفظها محليًا — يمكنك تعديلها أو حفظها في الأرشيف أو معاينتها وتصديرها بصيغة PDF.',
    });
  };

  const handleResetForm = () => {
    clearTeacherPlanDraftInStorage(formId);
    const fresh = createInitialTeacherPlanData(formId, settings);
    setFormData(fresh);
    setActiveArchivedRecordId(null);
    setValidationErrors({});
    setStatusBanner({
      type: 'info',
      text: 'تم تفريغ حقول الخطة وإعادة تعيين المسودة الحالية.',
    });
  };

  const handleSaveToArchive = async () => {
    const check = validateTeacherPlanForm(
      formId,
      formData as TeacherPlanFormMap[typeof formId]
    );
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل حفظ الخطة في الأرشيف.',
      });
      return;
    }

    try {
      setIsSavingArchive(true);
      const saved = await savePlanToArchive(
        formId,
        formData as TeacherPlanFormMap[typeof formId],
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
          ? `تم حفظ الخطة سجلًا مستقلًا في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث سجل الخطة المحفوظ في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'تعذر حفظ الخطة في الأرشيف. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsSavingArchive(false);
    }
  };

  const handleCreateNewPlan = () => {
    isHydratingRef.current = true;
    const created = createNewBlankPlanInArchive(formId, { settings });
    setActiveArchivedRecordId(null);
    setActiveDraftId(created.draftRecord.id);
    setFormData(created.formData);
    setValidationErrors({});
    setActiveTab('edit');
    setStatusBanner({
      type: 'info',
      text: 'تم فتح مسودة خطة جديدة فارغة مع الإبقاء على جميع السجلات المحفوظة في الأرشيف دون تعديل.',
    });
    setTimeout(() => {
      isHydratingRef.current = false;
    }, 0);
  };

  const handleOpenArchivedPlan = async (record: TeacherPlanArchiveRecord) => {
    try {
      isHydratingRef.current = true;
      const loaded = await loadArchivedPlanWithMedia(record.id, {
        formId,
        settings,
      });
      if (!loaded) {
        setStatusBanner({
          type: 'error',
          text: 'تعذر العثور على سجل الخطة المطلوب في الأرشيف.',
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
              text: `تم فتح الخطة المحفوظة (${loaded.record.title}) للتعديل بالمعرف الثابت ${loaded.record.id}.`,
            }
      );
    } finally {
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    }
  };

  const handleRequestDeleteArchivedPlan = (
    record: TeacherPlanArchiveRecord
  ) => {
    const impact = inspectArchivedPlanDeletionImpact(record.id);
    setPendingDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedPlan = async () => {
    if (!pendingDeleteTarget) return;
    const { record } = pendingDeleteTarget;
    const outcome = await deleteArchivedPlanRecordSafely(record.id, {
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
        text: `تم حذف الخطة «${record.title}» من الأرشيف بأمان${unlinkedNote}${sharedNote}`,
      });
    }
  };

  const planDoc = useMemo(
    () =>
      buildTeacherPlanDocumentFromForm(
        formId,
        formData as TeacherPlanFormMap[typeof formId],
        settings,
        {
          templateStyle,
          colorSystem,
        }
      ),
    [formId, formData, settings, templateStyle, colorSystem]
  );

  const paginatedPages = useMemo(
    () => paginateTeacherReportBlocks(planDoc, settings),
    [planDoc, settings]
  );

  useEffect(() => {
    let cancelled = false;
    renderTeacherReportPagesToCanvases(planDoc, settings)
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
  }, [planDoc, settings]);

  const handleSwitchToPreview = () => {
    const check = validateTeacherPlanForm(
      formId,
      formData as TeacherPlanFormMap[typeof formId]
    );
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل معاينة الخطة.',
      });
      return;
    }
    setStatusBanner(null);
    setActiveTab('preview');
  };

  const handleExportPdf = async () => {
    const check = validateTeacherPlanForm(
      formId,
      formData as TeacherPlanFormMap[typeof formId]
    );
    setValidationErrors(check.errors);
    if (!check.valid) {
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل تصدير الخطة بصيغة PDF.',
      });
      return;
    }

    try {
      setIsExporting(true);
      setStatusBanner(null);
      const result = await generateTeacherReportPdf(planDoc, settings);
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
        text: `تم تصدير الخطة بصيغة PDF بنجاح (${result.pageCount} ${
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
  // 1. خطة التطوير المهني وتحسين الأداء التدريسي
  // =========================================================================
  const renderProfessionalDevelopmentPlanFields = (
    d: ProfessionalDevelopmentPlanData
  ) => {
    const updateGoal = (
      idx: number,
      field: keyof ProfessionalDevGoalItem,
      val: string
    ) => {
      const next = d.goals.map((g, i) =>
        i === idx ? { ...g, [field]: val } : g
      );
      updateField('goals', next);
    };

    const addGoal = () => {
      updateField('goals', [
        ...d.goals,
        createEmptyProfessionalDevGoal(d.goals.length + 1),
      ]);
    };

    const removeGoal = (idx: number) => {
      if (d.goals.length <= 1) return;
      updateField(
        'goals',
        d.goals.filter((_, i) => i !== idx)
      );
    };

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ١. البيانات الأساسية ونوع وحالة الخطة وتشخيص الاحتياج
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عنوان الخطة <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-planTitle"
                value={d.planTitle}
                onChange={(e) => updateField('planTitle', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.planTitle && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.planTitle}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                نوع الخطة <span className="text-red-600">*</span>
              </label>
              <select
                data-testid="select-planType"
                value={d.planType}
                onChange={(e) =>
                  updateField(
                    'planType',
                    e.target.value as 'سنوية' | 'قصيرة المدى'
                  )
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              >
                {PLAN_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                حالة الخطة <span className="text-red-600">*</span>
              </label>
              <select
                data-testid="select-planStatus"
                value={d.planStatus}
                onChange={(e) =>
                  updateField(
                    'planStatus',
                    e.target.value as 'قيد التنفيذ' | 'مكتملة'
                  )
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              >
                {PLAN_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                التخصص / المادة الدراسية (اختياري)
              </label>
              <input
                type="text"
                data-testid="input-subject"
                value={d.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="مثال: الرياضيات / العلوم / لغتي"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                المرحلة / الصف الدراسي (اختياري)
              </label>
              <input
                type="text"
                data-testid="input-stageAndGrade"
                value={d.stageAndGrade}
                onChange={(e) => updateField('stageAndGrade', e.target.value)}
                placeholder="مثال: المرحلة المتوسطة — الثاني المتوسط"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الفترة / العام الدراسي
              </label>
              <input
                type="text"
                data-testid="input-academicPeriod"
                value={d.academicPeriod}
                onChange={(e) => updateField('academicPeriod', e.target.value)}
                placeholder="مثال: ١٤٤٧هـ — الفصل الدراسي الأول"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تشخيص الاحتياج التطويري <span className="text-red-600">*</span>
              </label>
              <select
                data-testid="select-needDiagnosisCategory"
                value={d.needDiagnosisCategory}
                onChange={(e) =>
                  updateField('needDiagnosisCategory', e.target.value)
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              >
                {NEED_DIAGNOSIS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {validationErrors.needDiagnosisCategory && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.needDiagnosisCategory}
                </p>
              )}
            </div>

            {d.needDiagnosisCategory === 'احتياج آخر' && (
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  تحديد الاحتياج التطويري الآخر{' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  data-testid="input-customNeedDiagnosis"
                  value={d.customNeedDiagnosis}
                  onChange={(e) =>
                    updateField('customNeedDiagnosis', e.target.value)
                  }
                  placeholder="اكتب الاحتياج التطويري الآخر هنا..."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
                />
                {validationErrors.customNeedDiagnosis && (
                  <p className="text-xs text-red-600 mt-1">
                    {validationErrors.customNeedDiagnosis}
                  </p>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                وصف تفصيلي لتشخيص الاحتياج ومبررات الخطة (اختياري)
              </label>
              <textarea
                rows={2}
                data-testid="input-needDiagnosisDetails"
                value={d.needDiagnosisDetails}
                onChange={(e) =>
                  updateField('needDiagnosisDetails', e.target.value)
                }
                placeholder="وضح معطيات تشخيص الاحتياج التطويري..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
            </div>
          </div>
        </section>

        {/* Dynamic Developmental Goals */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٢. الأهداف التطويرية وسجلات التنفيذ ({d.goals.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                يمكنك إضافة هدف تطويري واحد أو عدة أهداف؛ لكل هدف سجل مستقل يتضمن المستوى الحالي والمستهدف والإجراءات والموارد والمؤشرات والنتيجة.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-pd-goal-btn"
              onClick={addGoal}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة هدف تطويري جديد</span>
            </button>
          </div>

          {validationErrors.goals && (
            <p className="text-xs text-red-600 font-bold">
              {validationErrors.goals}
            </p>
          )}

          <div className="space-y-4">
            {d.goals.map((goal, idx) => (
              <div
                key={goal.id}
                data-testid={`pd-goal-item-${idx}`}
                className="rounded-2xl border border-[#E2E5E6] bg-[#DCEAF5]/40 p-4 sm:p-5 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E5E6]/60 pb-2.5">
                  <span className="text-xs sm:text-sm font-extrabold text-[#416B91]">
                    الهدف التطويري ({idx + 1})
                  </span>
                  {d.goals.length > 1 && (
                    <button
                      type="button"
                      data-testid={`remove-pd-goal-${idx}`}
                      onClick={() => removeGoal(idx)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف الهدف</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      عنوان / نص الهدف التطويري <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid={`input-goalTitle-${idx}`}
                      value={goal.goalTitle}
                      onChange={(e) =>
                        updateGoal(idx, 'goalTitle', e.target.value)
                      }
                      placeholder="اكتب الهدف التطويري..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      مستوى الأداء الحالي
                    </label>
                    <input
                      type="text"
                      data-testid={`input-goalCurrentLevel-${idx}`}
                      value={goal.currentLevel}
                      onChange={(e) =>
                        updateGoal(idx, 'currentLevel', e.target.value)
                      }
                      placeholder="وصف مستوى الأداء الحالي قبل التنفيذ..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      المستوى المستهدف
                    </label>
                    <input
                      type="text"
                      data-testid={`input-goalTargetLevel-${idx}`}
                      value={goal.targetLevel}
                      onChange={(e) =>
                        updateGoal(idx, 'targetLevel', e.target.value)
                      }
                      placeholder="المستوى المأمول تحقيقه..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      الإجراءات التنفيذية
                    </label>
                    <textarea
                      rows={2}
                      data-testid={`input-goalActions-${idx}`}
                      value={goal.actions}
                      onChange={(e) =>
                        updateGoal(idx, 'actions', e.target.value)
                      }
                      placeholder="الإجراءات والأنشطة لتحقيق الهدف..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      الموارد والوسائل الداعمة
                    </label>
                    <input
                      type="text"
                      data-testid={`input-goalResources-${idx}`}
                      value={goal.resources}
                      onChange={(e) =>
                        updateGoal(idx, 'resources', e.target.value)
                      }
                      placeholder="الحقائب، الأدوات، المجتمعات المهنية..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      مؤشرات القياس والتحقق
                    </label>
                    <input
                      type="text"
                      data-testid={`input-goalIndicators-${idx}`}
                      value={goal.indicators}
                      onChange={(e) =>
                        updateGoal(idx, 'indicators', e.target.value)
                      }
                      placeholder="معايير ومؤشرات قياس تحقق الهدف..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      النتيجة المتحققة
                    </label>
                    <input
                      type="text"
                      data-testid={`input-goalResult-${idx}`}
                      value={goal.result}
                      onChange={(e) =>
                        updateGoal(idx, 'result', e.target.value)
                      }
                      placeholder="ما تحقق فعليًا من هذا الهدف..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Follow-up, Impact Evaluation, and Optional Principal Notes */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ٣. المتابعة وتقويم أثر الخطة وملاحظات المدير
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                دورية المتابعة (شهرية افتراضيًا وقابلة للتعديل){' '}
                <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                list="follow-up-period-suggestions"
                data-testid="input-followUpFrequency"
                value={d.followUpFrequency}
                onChange={(e) =>
                  updateField('followUpFrequency', e.target.value)
                }
                placeholder="شهرية"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
              <datalist id="follow-up-period-suggestions">
                {FOLLOW_UP_PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                بيانات / آلية المتابعة الدورية (اختياري)
              </label>
              <input
                type="text"
                data-testid="input-followUpNotes"
                value={d.followUpNotes}
                onChange={(e) => updateField('followUpNotes', e.target.value)}
                placeholder="ملاحظات المتابعة الشهرية أو المرحلية..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تقويم أثر الخطة <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                data-testid="input-impactEvaluation"
                value={d.impactEvaluation}
                onChange={(e) =>
                  updateField('impactEvaluation', e.target.value)
                }
                placeholder="وضح أثر الخطة على تحسين الممارسات التدريسية وتحصيل الطلاب..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
              {validationErrors.impactEvaluation && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.impactEvaluation}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                ملاحظات {gendered.principalTitle} (اختياري — لا تظهر في PDF إن تُركت فارغة)
              </label>
              <textarea
                rows={2}
                data-testid="input-principalNotes"
                value={d.principalNotes}
                onChange={(e) => updateField('principalNotes', e.target.value)}
                placeholder={`ملاحظات وتوجيهات ${gendered.principalTitle}...`}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
              />
            </div>

            <div className="md:col-span-2 pt-1">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="checkbox-includePrincipalApproval"
                  checked={d.includePrincipalApproval}
                  onChange={(e) =>
                    updateField('includePrincipalApproval', e.target.checked)
                  }
                  className="w-4 h-4 rounded border-stone-300 text-[#416B91] focus:ring-[#416B91]"
                />
                <span className="text-xs sm:text-sm font-bold text-stone-800">
                  إظهار اعتماد {gendered.principalTitle} في أسفل الصفحة الأخيرة من ملف PDF (اختياري)
                </span>
              </label>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // =========================================================================
  // 2. الخطة الأسبوعية للمعلم
  // =========================================================================
  const renderWeeklyTeacherPlanFields = (d: WeeklyTeacherPlanData) => {
    const updateLesson = (
      idx: number,
      field: keyof WeeklyLessonItem,
      val: string
    ) => {
      const next = d.lessons.map((l, i) =>
        i === idx ? { ...l, [field]: val } : l
      );
      updateField('lessons', next);
    };

    const addLesson = () => {
      updateField('lessons', [
        ...d.lessons,
        createEmptyWeeklyLesson(d.lessons.length + 1),
      ]);
    };

    const removeLesson = (idx: number) => {
      if (d.lessons.length <= 1) return;
      updateField(
        'lessons',
        d.lessons.filter((_, i) => i !== idx)
      );
    };

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ١. بيانات الأسبوع والمادة والصف
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عنوان الخطة <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-planTitle"
                value={d.planTitle}
                onChange={(e) => updateField('planTitle', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الأسبوع الدراسي <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-weekLabel"
                value={d.weekLabel}
                onChange={(e) => updateField('weekLabel', e.target.value)}
                placeholder="مثال: الأسبوع السادس"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.weekLabel && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.weekLabel}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                التاريخ <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                data-testid="input-weekDate"
                value={d.weekDate}
                onChange={(e) => updateField('weekDate', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.weekDate && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.weekDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                المادة الدراسية <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-subject"
                value={d.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="مثال: العلوم / الرياضيات"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.subject && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.subject}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الصف الدراسي <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-grade"
                value={d.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                placeholder="مثال: الثالث المتوسط"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.grade && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.grade}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Dynamic Weekly Lessons */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٢. الدروس والموضوعات الأسبوعية ({d.lessons.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                أضف درسًا واحدًا أو عدة دروس؛ لكل درس: نواتج التعلم، الاستراتيجيات والأنشطة، الوسائل والمصادر، أساليب التقويم، والواجبات أو المهام.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-weekly-lesson-btn"
              onClick={addLesson}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة درس / موضوع جديد</span>
            </button>
          </div>

          {validationErrors.lessons && (
            <p className="text-xs text-red-600 font-bold">
              {validationErrors.lessons}
            </p>
          )}

          <div className="space-y-4">
            {d.lessons.map((lesson, idx) => (
              <div
                key={lesson.id}
                data-testid={`weekly-lesson-item-${idx}`}
                className="rounded-2xl border border-[#E2E5E6] bg-[#DCEAF5]/40 p-4 sm:p-5 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E5E6]/60 pb-2.5">
                  <span className="text-xs sm:text-sm font-extrabold text-[#416B91]">
                    الدرس / الموضوع ({idx + 1})
                  </span>
                  {d.lessons.length > 1 && (
                    <button
                      type="button"
                      data-testid={`remove-weekly-lesson-${idx}`}
                      onClick={() => removeLesson(idx)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف الدرس</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      عنوان الدرس / الموضوع <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid={`input-lessonTitle-${idx}`}
                      value={lesson.lessonTitle}
                      onChange={(e) =>
                        updateLesson(idx, 'lessonTitle', e.target.value)
                      }
                      placeholder="اكتب عنوان الدرس أو الموضوع..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      نواتج التعلم
                    </label>
                    <textarea
                      rows={2}
                      data-testid={`input-learningOutcomes-${idx}`}
                      value={lesson.learningOutcomes}
                      onChange={(e) =>
                        updateLesson(idx, 'learningOutcomes', e.target.value)
                      }
                      placeholder="نواتج التعلم المستهدفة في الدرس..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      الاستراتيجيات والأنشطة
                    </label>
                    <input
                      type="text"
                      data-testid={`input-strategiesAndActivities-${idx}`}
                      value={lesson.strategiesAndActivities}
                      onChange={(e) =>
                        updateLesson(
                          idx,
                          'strategiesAndActivities',
                          e.target.value
                        )
                      }
                      placeholder="استراتيجيات التدريس والأنشطة الصفية..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      الوسائل والمصادر التعليمية
                    </label>
                    <input
                      type="text"
                      data-testid={`input-toolsAndResources-${idx}`}
                      value={lesson.toolsAndResources}
                      onChange={(e) =>
                        updateLesson(idx, 'toolsAndResources', e.target.value)
                      }
                      placeholder="الوسائل، العروض، الأدوات المخبرية..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      أساليب التقويم
                    </label>
                    <input
                      type="text"
                      data-testid={`input-assessmentMethods-${idx}`}
                      value={lesson.assessmentMethods}
                      onChange={(e) =>
                        updateLesson(idx, 'assessmentMethods', e.target.value)
                      }
                      placeholder="الأسئلة الصفية، أوراق العمل، الاختبارات القصيرة..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      الواجبات أو المهام الأدائية
                    </label>
                    <input
                      type="text"
                      data-testid={`input-homeworkOrTasks-${idx}`}
                      value={lesson.homeworkOrTasks}
                      onChange={(e) =>
                        updateLesson(idx, 'homeworkOrTasks', e.target.value)
                      }
                      placeholder="الواجبات المنزلية أو المهام المطلوبة..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Optional Teacher Notes */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-3">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2">
            ٣. ملاحظات {gendered.gender === 'female' ? 'المعلمة' : 'المعلم'} (اختياري)
          </h3>
          <textarea
            rows={2}
            data-testid="input-teacherNotes"
            value={d.teacherNotes}
            onChange={(e) => updateField('teacherNotes', e.target.value)}
            placeholder="أي ملاحظات أو توجيهات إضافية للأسبوع الدراسي (اختياري)..."
            className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
          />
        </section>
      </div>
    );
  };

  // =========================================================================
  // 3. الخطة العلاجية الفردية
  // =========================================================================
  const renderIndividualRemedialPlanFields = (
    d: IndividualRemedialPlanData
  ) => {
    const updateGoal = (
      idx: number,
      field: keyof IndividualRemedialGoalItem,
      val: string
    ) => {
      const next = d.goals.map((g, i) =>
        i === idx ? { ...g, [field]: val } : g
      );
      updateField('goals', next);
    };

    const addGoal = () => {
      updateField('goals', [
        ...d.goals,
        createEmptyIndividualRemedialGoal(d.goals.length + 1),
      ]);
    };

    const removeGoal = (idx: number) => {
      if (d.goals.length <= 1) return;
      updateField(
        'goals',
        d.goals.filter((_, i) => i !== idx)
      );
    };

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <h3 className="text-base font-bold font-display text-stone-900">
              ١. بيانات الطالب ومصدر الضعف والاختبار التشخيصي
            </h3>
            <span className="px-3 py-1 rounded-full bg-[#EEF5EE] border border-[#C5DCC7] text-[#2F6846] text-xs font-bold">
              صفحة واحدة مستهدفة · حد أقصى صفحتان
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                اسم الطالب المستهدف <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-studentName"
                value={d.studentName}
                onChange={(e) => updateField('studentName', e.target.value)}
                placeholder="الاسم الثلاثي للطالب..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.studentName && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.studentName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                المادة الدراسية <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-subject"
                value={d.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="مثال: الرياضيات / لغتي"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.subject && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.subject}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الصف / الفصل <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-grade"
                value={d.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                placeholder="مثال: الأول المتوسط ١/أ"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.grade && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.grade}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تاريخ بداية الخطة
              </label>
              <input
                type="date"
                data-testid="input-planDate"
                value={d.planDate}
                onChange={(e) => updateField('planDate', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                مصدر تحديد الضعف <span className="text-red-600">*</span>
              </label>
              <select
                data-testid="select-weaknessSource"
                value={d.weaknessSource}
                onChange={(e) =>
                  updateField(
                    'weaknessSource',
                    e.target.value as WeaknessSourceType
                  )
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              >
                {WEAKNESS_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Conditional field based on weaknessSource */}
            <div className="md:col-span-2">
              {d.weaknessSource === 'مادة دراسية' && (
                <>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    الوحدات أو الموضوعات التي يظهر فيها الضعف في المادة{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="input-subjectWeaknessTopics"
                    value={d.subjectWeaknessTopics}
                    onChange={(e) =>
                      updateField('subjectWeaknessTopics', e.target.value)
                    }
                    placeholder="حدد الوحدات أو الموضوعات ومظهر الضعف..."
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  />
                  {validationErrors.subjectWeaknessTopics && (
                    <p className="text-xs text-red-600 mt-1">
                      {validationErrors.subjectWeaknessTopics}
                    </p>
                  )}
                </>
              )}

              {d.weaknessSource === 'مهارة' && (
                <>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    اسم المهارة المستهدفة وتوصيف الضعف فيها{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="input-skillWeaknessName"
                    value={d.skillWeaknessName}
                    onChange={(e) =>
                      updateField('skillWeaknessName', e.target.value)
                    }
                    placeholder="مثال: مهارة القسمة المطولة / رسم الهمزة..."
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  />
                  {validationErrors.skillWeaknessName && (
                    <p className="text-xs text-red-600 mt-1">
                      {validationErrors.skillWeaknessName}
                    </p>
                  )}
                </>
              )}

              {d.weaknessSource === 'اختبار فترة' && (
                <>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    بيانات اختبار الفترة والدرجة ومواطن الضعف{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="input-periodExamNameAndScore"
                    value={d.periodExamNameAndScore}
                    onChange={(e) =>
                      updateField('periodExamNameAndScore', e.target.value)
                    }
                    placeholder="مثال: اختبار الفترة الأولى — الدرجة ٨ من ٢٠..."
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  />
                  {validationErrors.periodExamNameAndScore && (
                    <p className="text-xs text-red-600 mt-1">
                      {validationErrors.periodExamNameAndScore}
                    </p>
                  )}
                </>
              )}

              {d.weaknessSource === 'اختبار فصلي' && (
                <>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    بيانات الاختبار الفصلي والدرجة ومواضع الإخفاق{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="input-semesterExamScoreAndGaps"
                    value={d.semesterExamScoreAndGaps}
                    onChange={(e) =>
                      updateField('semesterExamScoreAndGaps', e.target.value)
                    }
                    placeholder="مثال: اختبار نهاية الفصل الأول — الدرجة ١٨ من ٤٠..."
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  />
                  {validationErrors.semesterExamScoreAndGaps && (
                    <p className="text-xs text-red-600 mt-1">
                      {validationErrors.semesterExamScoreAndGaps}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Diagnostic Test Conditional Question */}
          <div className="pt-3 border-t border-stone-100 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs sm:text-sm font-bold text-stone-900">
                هل تم إجراء اختبار تشخيصي؟
              </span>
              <div className="inline-flex rounded-xl border border-stone-300 p-1 bg-stone-50">
                {(['نعم', 'لا'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    data-testid={`btn-hasDiagnosticTest-${choice}`}
                    onClick={() => updateField('hasDiagnosticTest', choice)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      d.hasDiagnosticTest === choice
                        ? 'bg-[#376B70] text-white'
                        : 'text-stone-700 hover:bg-stone-200/60'
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>

            {d.hasDiagnosticTest === 'نعم' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5]/50 p-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    بيانات / اسم الاختبار التشخيصي
                  </label>
                  <input
                    type="text"
                    data-testid="input-diagnosticTestName"
                    value={d.diagnosticTestName}
                    onChange={(e) =>
                      updateField('diagnosticTestName', e.target.value)
                    }
                    placeholder="مثال: اختبار تشخيصي في مهارات الأساس..."
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    نتيجة الاختبار التشخيصي وخلاصة التشخيص{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="input-diagnosticTestResult"
                    value={d.diagnosticTestResult}
                    onChange={(e) =>
                      updateField('diagnosticTestResult', e.target.value)
                    }
                    placeholder="الدرجة / نسبة الإتقان وأبرز الفجوات..."
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  />
                  {validationErrors.diagnosticTestResult && (
                    <p className="text-xs text-red-600 mt-1">
                      {validationErrors.diagnosticTestResult}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Dynamic Remedial Goals with 5-point scale */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٢. الأهداف العلاجية وسلم التقدير الخماسي ({d.goals.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                حدد لكل هدف علاجي مستوى الطالب على سلم التقدير الخماسي (قبل التدخل، المستهدف، وبعد التدخل) مع الإجراءات والمدة.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-individual-goal-btn"
              onClick={addGoal}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة هدف علاجي</span>
            </button>
          </div>

          {validationErrors.goals && (
            <p className="text-xs text-red-600 font-bold">
              {validationErrors.goals}
            </p>
          )}

          <div className="space-y-4">
            {d.goals.map((goal, idx) => (
              <div
                key={goal.id}
                data-testid={`ind-goal-item-${idx}`}
                className="rounded-2xl border border-[#E2E5E6] bg-[#DCEAF5]/40 p-4 sm:p-5 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E5E6]/60 pb-2">
                  <span className="text-xs sm:text-sm font-extrabold text-[#416B91]">
                    الهدف العلاجي ({idx + 1})
                  </span>
                  {d.goals.length > 1 && (
                    <button
                      type="button"
                      data-testid={`remove-ind-goal-${idx}`}
                      onClick={() => removeGoal(idx)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      نص الهدف العلاجي <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid={`input-indGoalText-${idx}`}
                      value={goal.goalText}
                      onChange={(e) =>
                        updateGoal(idx, 'goalText', e.target.value)
                      }
                      placeholder="المهارة أو الهدف المراد إتقانه..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      المدة الإجمالية للهدف
                    </label>
                    <input
                      type="text"
                      data-testid={`input-indGoalDuration-${idx}`}
                      value={goal.duration}
                      onChange={(e) =>
                        updateGoal(idx, 'duration', e.target.value)
                      }
                      placeholder="مثال: أسبوعان (٤ حصص)"
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      التقدير قبل التدخل (سلم خماسي)
                    </label>
                    <select
                      data-testid={`select-indGoalPre-${idx}`}
                      value={goal.preLevel}
                      onChange={(e) =>
                        updateGoal(idx, 'preLevel', e.target.value)
                      }
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    >
                      {FIVE_POINT_RATING_SCALE.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      المستوى المستهدف (سلم خماسي)
                    </label>
                    <select
                      data-testid={`select-indGoalTarget-${idx}`}
                      value={goal.targetLevel}
                      onChange={(e) =>
                        updateGoal(idx, 'targetLevel', e.target.value)
                      }
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    >
                      {FIVE_POINT_RATING_SCALE.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      التقدير بعد التدخل (سلم خماسي)
                    </label>
                    <select
                      data-testid={`select-indGoalPost-${idx}`}
                      value={goal.postLevel}
                      onChange={(e) =>
                        updateGoal(idx, 'postLevel', e.target.value)
                      }
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    >
                      {FIVE_POINT_RATING_SCALE.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      إجراءات علاجية مختصرة
                    </label>
                    <input
                      type="text"
                      data-testid={`input-indGoalActions-${idx}`}
                      value={goal.remedialActions}
                      onChange={(e) =>
                        updateGoal(idx, 'remedialActions', e.target.value)
                      }
                      placeholder="أوراق عمل، تدريب فردي، تعلم بالأقران..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Short Follow-up & Results */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-3">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2">
            ٣. المتابعة والنتائج المختصرة <span className="text-red-600">*</span>
          </h3>
          <textarea
            rows={2}
            data-testid="input-followUpAndResults"
            value={d.followUpAndResults}
            onChange={(e) => updateField('followUpAndResults', e.target.value)}
            placeholder="ملخص متابعة تقدم الطالب ونتيجة التحسن بعد تطبيق الخطة..."
            className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
          />
          {validationErrors.followUpAndResults && (
            <p className="text-xs text-red-600 mt-1">
              {validationErrors.followUpAndResults}
            </p>
          )}
        </section>
      </div>
    );
  };

  // =========================================================================
  // 4. الخطة العلاجية الجماعية
  // =========================================================================
  const renderGroupRemedialPlanFields = (d: GroupRemedialPlanData) => {
    const updateSkill = (
      idx: number,
      field: keyof GroupRemedialSkillItem,
      val: string
    ) => {
      const next = d.skills.map((s, i) =>
        i === idx ? { ...s, [field]: val } : s
      );
      updateField('skills', next);
    };

    const addSkill = () => {
      updateField('skills', [
        ...d.skills,
        createEmptyGroupRemedialSkill(d.skills.length + 1),
      ]);
    };

    const removeSkill = (idx: number) => {
      if (d.skills.length <= 1) return;
      updateField(
        'skills',
        d.skills.filter((_, i) => i !== idx)
      );
    };

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <h3 className="text-base font-bold font-display text-stone-900">
              ١. نطاق المستفيدين وبيانات الصف والجدول الزمني
            </h3>
            <span className="px-3 py-1 rounded-full bg-[#EEF5EE] border border-[#C5DCC7] text-[#2F6846] text-xs font-bold">
              حد أقصى ٣ صفحات
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                نطاق المستفيدين <span className="text-red-600">*</span>
              </label>
              <select
                data-testid="select-beneficiariesScope"
                value={d.beneficiariesScope}
                onChange={(e) =>
                  updateField(
                    'beneficiariesScope',
                    e.target.value as
                      | 'طلاب محددون'
                      | 'مجموعة'
                      | 'الفصل كاملًا'
                  )
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              >
                {GROUP_REMEDIAL_SCOPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عدد الطلاب المستفيدين <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-studentsCount"
                value={d.studentsCount}
                onChange={(e) => updateField('studentsCount', e.target.value)}
                placeholder="مثال: ٦ طلاب"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.studentsCount && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.studentsCount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                المادة الدراسية <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-subject"
                value={d.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="مثال: لغتي الخالدة"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.subject && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.subject}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الصف والشعبة <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  data-testid="input-grade"
                  value={d.grade}
                  onChange={(e) => updateField('grade', e.target.value)}
                  placeholder="الصف"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                />
                <input
                  type="text"
                  data-testid="input-classSection"
                  value={d.classSection}
                  onChange={(e) => updateField('classSection', e.target.value)}
                  placeholder="الشعبة (٢/ب)"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                />
              </div>
              {validationErrors.grade && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.grade}
                </p>
              )}
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                أسماء الطلاب المستفيدين (عند الحاجة — اختياري)
              </label>
              <input
                type="text"
                data-testid="input-studentNames"
                value={d.studentNames}
                onChange={(e) => updateField('studentNames', e.target.value)}
                placeholder="اكتب أسماء الطلاب المستفيدين مفصولة بفواصل..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تاريخ البداية <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                data-testid="input-startDate"
                value={d.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.startDate && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.startDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تاريخ النهاية <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                data-testid="input-endDate"
                value={d.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.endDate && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.endDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عدد مرات المعالجة أسبوعيًا <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-weeklyFrequency"
                value={d.weeklyFrequency}
                onChange={(e) => updateField('weeklyFrequency', e.target.value)}
                placeholder="مثال: مرتان أسبوعيًا"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.weeklyFrequency && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.weeklyFrequency}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                مدة الحصة / الجلسة (اختيارية)
              </label>
              <input
                type="text"
                data-testid="input-sessionDuration"
                value={d.sessionDuration}
                onChange={(e) => updateField('sessionDuration', e.target.value)}
                placeholder="مثال: ٣٠ دقيقة"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>
          </div>
        </section>

        {/* Dynamic Skills & Descriptive Evaluation */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٢. المهارات المستهدفة والتقييم الوصفي المستقل ({d.skills.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                أضف مهارة واحدة أو عدة مهارات؛ لكل مهارة تقييم وصفي مستقل قبل المعالجة وبعدها.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-group-skill-btn"
              onClick={addSkill}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة مهارة مستهدفة</span>
            </button>
          </div>

          {validationErrors.skills && (
            <p className="text-xs text-red-600 font-bold">
              {validationErrors.skills}
            </p>
          )}

          <div className="space-y-4">
            {d.skills.map((skill, idx) => (
              <div
                key={skill.id}
                data-testid={`group-skill-item-${idx}`}
                className="rounded-2xl border border-[#E2E5E6] bg-[#DCEAF5]/40 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E5E6]/60 pb-2">
                  <span className="text-xs sm:text-sm font-extrabold text-[#416B91]">
                    المهارة المستهدفة ({idx + 1})
                  </span>
                  {d.skills.length > 1 && (
                    <button
                      type="button"
                      data-testid={`remove-group-skill-${idx}`}
                      onClick={() => removeSkill(idx)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      اسم / توصيف المهارة <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid={`input-skillName-${idx}`}
                      value={skill.skillName}
                      onChange={(e) =>
                        updateSkill(idx, 'skillName', e.target.value)
                      }
                      placeholder="اكتب اسم المهارة التي يظهر فيها الضعف..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      التقييم الوصفي قبل المعالجة
                    </label>
                    <input
                      type="text"
                      data-testid={`input-skillPreAssessment-${idx}`}
                      value={skill.preAssessment}
                      onChange={(e) =>
                        updateSkill(idx, 'preAssessment', e.target.value)
                      }
                      placeholder="وصف مستوى الطلاب في المهارة قبل التدخل..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      التقييم الوصفي بعد المعالجة
                    </label>
                    <input
                      type="text"
                      data-testid={`input-skillPostAssessment-${idx}`}
                      value={skill.postAssessment}
                      onChange={(e) =>
                        updateSkill(idx, 'postAssessment', e.target.value)
                      }
                      placeholder="وصف مستوى التحسن في المهارة بعد المعالجة..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions & Impact Measurement */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ٣. الإجراءات العلاجية وقياس الأثر والتوصيات
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الإجراءات العلاجية الجماعية <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={2}
                data-testid="input-groupActions"
                value={d.groupActions}
                onChange={(e) => updateField('groupActions', e.target.value)}
                placeholder="الإجراءات والأنشطة العلاجية المنفذة للمجموعة..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.groupActions && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.groupActions}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تخصيص إجراء علاجي لبعض الطلاب (اختياري)
              </label>
              <input
                type="text"
                data-testid="input-customizedActionsForStudents"
                value={d.customizedActionsForStudents}
                onChange={(e) =>
                  updateField('customizedActionsForStudents', e.target.value)
                }
                placeholder="إجراءات مخصصة لطلاب محددين داخل المجموعة عند الحاجة..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عدد الطلاب المتحسنين <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-improvedStudentsCount"
                value={d.improvedStudentsCount}
                onChange={(e) =>
                  updateField('improvedStudentsCount', e.target.value)
                }
                placeholder="مثال: ٥ طلاب"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.improvedStudentsCount && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.improvedStudentsCount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عدد من لم يتحسنوا بما يكفي
              </label>
              <input
                type="text"
                data-testid="input-notEnoughImprovedCount"
                value={d.notEnoughImprovedCount}
                onChange={(e) =>
                  updateField('notEnoughImprovedCount', e.target.value)
                }
                placeholder="مثال: طالب واحد / ٠"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                وصف التحسن لكل مهارة <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={2}
                data-testid="input-skillsImprovementDescription"
                value={d.skillsImprovementDescription}
                onChange={(e) =>
                  updateField('skillsImprovementDescription', e.target.value)
                }
                placeholder="وصف قياس الأثر ونسبة التحسن في المهارات المستهدفة..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.skillsImprovementDescription && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.skillsImprovementDescription}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                التوصيات
              </label>
              <textarea
                rows={2}
                data-testid="input-recommendations"
                value={d.recommendations}
                onChange={(e) => updateField('recommendations', e.target.value)}
                placeholder="التوصيات والخطوات اللاحقة..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>
          </div>
        </section>
      </div>
    );
  };

  // =========================================================================
  // 5. الخطة الإثرائية
  // =========================================================================
  const renderEnrichmentPlanFields = (d: EnrichmentPlanData) => {
    const toggleEnrichmentType = (typeVal: string) => {
      const exists = d.enrichmentTypes.includes(typeVal);
      const next = exists
        ? d.enrichmentTypes.filter((t) => t !== typeVal)
        : [...d.enrichmentTypes, typeVal];
      updateField('enrichmentTypes', next);
    };

    const updateActivity = (
      idx: number,
      field: keyof EnrichmentActivityItem,
      val: string
    ) => {
      const next = d.activities.map((a, i) =>
        i === idx ? { ...a, [field]: val } : a
      );
      updateField('activities', next);
    };

    const addActivity = () => {
      updateField('activities', [
        ...d.activities,
        createEmptyEnrichmentActivity(d.activities.length + 1),
      ]);
    };

    const removeActivity = (idx: number) => {
      if (d.activities.length <= 1) return;
      updateField(
        'activities',
        d.activities.filter((_, i) => i !== idx)
      );
    };

    const updateProduct = (
      idx: number,
      field: keyof StudentProductItem,
      val: string
    ) => {
      const next = d.studentProducts.map((p, i) =>
        i === idx ? { ...p, [field]: val } : p
      );
      updateField('studentProducts', next);
    };

    const addProduct = () => {
      updateField('studentProducts', [
        ...d.studentProducts,
        createEmptyStudentProduct(d.studentProducts.length + 1),
      ]);
    };

    const removeProduct = (idx: number) => {
      if (d.studentProducts.length <= 1) return;
      updateField(
        'studentProducts',
        d.studentProducts.filter((_, i) => i !== idx)
      );
    };

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <h3 className="text-base font-bold font-display text-stone-900">
              ١. المستفيدون وسبب الترشيح وأنواع الإثراء والجدول الزمني
            </h3>
            <span className="px-3 py-1 rounded-full bg-[#EEF5EE] border border-[#C5DCC7] text-[#2F6846] text-xs font-bold">
              حد أقصى ٣ صفحات
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                المستفيدون <span className="text-red-600">*</span>
              </label>
              <select
                data-testid="select-beneficiariesScope"
                value={d.beneficiariesScope}
                onChange={(e) =>
                  updateField(
                    'beneficiariesScope',
                    e.target.value as 'طالب واحد' | 'مجموعة' | 'الفصل كاملًا'
                  )
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              >
                {ENRICHMENT_BENEFICIARIES_SCOPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عدد الطلاب المستفيدين
              </label>
              <input
                type="text"
                data-testid="input-studentsCount"
                value={d.studentsCount}
                onChange={(e) => updateField('studentsCount', e.target.value)}
                placeholder="مثال: ٥ طلاب"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                المادة / المجال <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-subject"
                value={d.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="مثال: العلوم والابتكار"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.subject && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.subject}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                الصف الدراسي <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-grade"
                value={d.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                placeholder="مثال: الثالث المتوسط ٣/أ"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.grade && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.grade}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                أسماء الطلاب المرشحين (اختياري)
              </label>
              <input
                type="text"
                data-testid="input-studentNames"
                value={d.studentNames}
                onChange={(e) => updateField('studentNames', e.target.value)}
                placeholder="أسماء الطلاب المستفيدين من الخطة الإثرائية..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                سبب الترشيح <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-nominationReason"
                value={d.nominationReason}
                onChange={(e) =>
                  updateField('nominationReason', e.target.value)
                }
                placeholder="التفوق الدراسي، إتمام المهارات مبكرًا، التميز في المسابقات..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.nominationReason && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.nominationReason}
                </p>
              )}
            </div>
          </div>

          {/* Multi-select Enrichment Types */}
          <div className="pt-2 border-t border-stone-100 space-y-2.5">
            <label className="block text-xs font-bold text-stone-800">
              أنواع الإثراء (متعددة الاختيار) <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ENRICHMENT_TYPES_OPTIONS.map((typeOpt) => {
                const checked = d.enrichmentTypes.includes(typeOpt);
                return (
                  <label
                    key={typeOpt}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-colors ${
                      checked
                        ? 'border-[#416B91] bg-[#DCEAF5] text-[#416B91]'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      data-testid={`checkbox-enrichmentType-${typeOpt}`}
                      checked={checked}
                      onChange={() => toggleEnrichmentType(typeOpt)}
                      className="w-4 h-4 rounded border-stone-300 text-[#416B91]"
                    />
                    <span>{typeOpt}</span>
                  </label>
                );
              })}
            </div>
            {validationErrors.enrichmentTypes && (
              <p className="text-xs text-red-600 mt-1">
                {validationErrors.enrichmentTypes}
              </p>
            )}

            {d.enrichmentTypes.includes('نوع آخر') && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  تحديد نوع الإثراء الآخر <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  data-testid="input-customEnrichmentType"
                  value={d.customEnrichmentType}
                  onChange={(e) =>
                    updateField('customEnrichmentType', e.target.value)
                  }
                  placeholder="اكتب نوع الإثراء الآخر هنا..."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                />
                {validationErrors.customEnrichmentType && (
                  <p className="text-xs text-red-600 mt-1">
                    {validationErrors.customEnrichmentType}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تاريخ البداية <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                data-testid="input-startDate"
                value={d.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.startDate && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.startDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                تاريخ النهاية <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                data-testid="input-endDate"
                value={d.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.endDate && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.endDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                عدد مرات التنفيذ أسبوعيًا <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                data-testid="input-weeklyFrequency"
                value={d.weeklyFrequency}
                onChange={(e) => updateField('weeklyFrequency', e.target.value)}
                placeholder="مثال: مرتان أسبوعيًا"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.weeklyFrequency && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.weeklyFrequency}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                مدة النشاط (اختيارية)
              </label>
              <input
                type="text"
                data-testid="input-activityDuration"
                value={d.activityDuration}
                onChange={(e) =>
                  updateField('activityDuration', e.target.value)
                }
                placeholder="مثال: ٤٥ دقيقة"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>
          </div>
        </section>

        {/* Dynamic Enrichment Activities */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٢. الأنشطة الإثرائية ({d.activities.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                أضف نشاطًا إثرائيًا واحدًا أو عدة أنشطة؛ لكل نشاط وصف وطريقة تنفيذ.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-enrichment-activity-btn"
              onClick={addActivity}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة نشاط إثرائي</span>
            </button>
          </div>

          {validationErrors.activities && (
            <p className="text-xs text-red-600 font-bold">
              {validationErrors.activities}
            </p>
          )}

          <div className="space-y-4">
            {d.activities.map((act, idx) => (
              <div
                key={act.id}
                data-testid={`enrichment-activity-item-${idx}`}
                className="rounded-2xl border border-[#E2E5E6] bg-[#DCEAF5]/40 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E5E6]/60 pb-2">
                  <span className="text-xs sm:text-sm font-extrabold text-[#416B91]">
                    النشاط الإثرائي ({idx + 1})
                  </span>
                  {d.activities.length > 1 && (
                    <button
                      type="button"
                      data-testid={`remove-enrichment-activity-${idx}`}
                      onClick={() => removeActivity(idx)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      عنوان النشاط <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid={`input-activityTitle-${idx}`}
                      value={act.activityTitle}
                      onChange={(e) =>
                        updateActivity(idx, 'activityTitle', e.target.value)
                      }
                      placeholder="اسم النشاط أو المشروع الإثرائي..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      وصف النشاط
                    </label>
                    <input
                      type="text"
                      data-testid={`input-activityDescription-${idx}`}
                      value={act.activityDescription}
                      onChange={(e) =>
                        updateActivity(
                          idx,
                          'activityDescription',
                          e.target.value
                        )
                      }
                      placeholder="وصف فكرة ومضمون النشاط..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      طريقة التنفيذ
                    </label>
                    <input
                      type="text"
                      data-testid={`input-executionMethod-${idx}`}
                      value={act.executionMethod}
                      onChange={(e) =>
                        updateActivity(idx, 'executionMethod', e.target.value)
                      }
                      placeholder="آلية التطبيق العملي أو البحثي..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Independent Section: منتجات الطلاب وإنجازاتهم */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-stone-900">
                ٣. منتجات الطلاب وإنجازاتهم ({d.studentProducts.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                قسم مستقل لتوثيق اسم المنتج ونوعه ووصفه والطلاب المشاركين فيه.
              </p>
            </div>
            <button
              type="button"
              data-testid="add-student-product-btn"
              onClick={addProduct}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة منتج طلابي</span>
            </button>
          </div>

          <div className="space-y-4">
            {d.studentProducts.map((prod, idx) => (
              <div
                key={prod.id}
                data-testid={`student-product-item-${idx}`}
                className="rounded-2xl border border-[#E2E5E6] bg-[#DCEAF5]/40 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E5E6]/60 pb-2">
                  <span className="text-xs sm:text-sm font-extrabold text-[#416B91]">
                    المنتج / الإنجاز الطلابي ({idx + 1})
                  </span>
                  {d.studentProducts.length > 1 && (
                    <button
                      type="button"
                      data-testid={`remove-student-product-${idx}`}
                      onClick={() => removeProduct(idx)}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      data-testid={`input-productName-${idx}`}
                      value={prod.productName}
                      onChange={(e) =>
                        updateProduct(idx, 'productName', e.target.value)
                      }
                      placeholder="مثال: نموذج المتتبع الشمسي الذكي"
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      نوع المنتج
                    </label>
                    <input
                      type="text"
                      data-testid={`input-productType-${idx}`}
                      value={prod.productType}
                      onChange={(e) =>
                        updateProduct(idx, 'productType', e.target.value)
                      }
                      placeholder="مثال: ابتكار عملي / بحث علمي / برمجية"
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      وصف المنتج
                    </label>
                    <input
                      type="text"
                      data-testid={`input-productDescription-${idx}`}
                      value={prod.productDescription}
                      onChange={(e) =>
                        updateProduct(idx, 'productDescription', e.target.value)
                      }
                      placeholder="وصف مختصر للمنتج وأهميته..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      الطلاب المشاركون
                    </label>
                    <input
                      type="text"
                      data-testid={`input-participatingStudents-${idx}`}
                      value={prod.participatingStudents}
                      onChange={(e) =>
                        updateProduct(
                          idx,
                          'participatingStudents',
                          e.target.value
                        )
                      }
                      placeholder="أسماء الطلاب المشاركين في إنتاج العمل..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Descriptive Impact Measurement */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold font-display text-stone-900 border-b border-stone-100 pb-2.5">
            ٤. قياس الأثر الوصفي والتوصيات
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                القدرات والمهارات المتطورة <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={2}
                data-testid="input-developedCapabilities"
                value={d.developedCapabilities}
                onChange={(e) =>
                  updateField('developedCapabilities', e.target.value)
                }
                placeholder="المهارات العليا والقدرات التي تطورت لدى الطلاب..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
              {validationErrors.developedCapabilities && (
                <p className="text-xs text-red-600 mt-1">
                  {validationErrors.developedCapabilities}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                مخرجات الأنشطة
              </label>
              <textarea
                rows={2}
                data-testid="input-activitiesOutputs"
                value={d.activitiesOutputs}
                onChange={(e) =>
                  updateField('activitiesOutputs', e.target.value)
                }
                placeholder="أبرز المخرجات العلمية والعملية..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                مدى تحقق الأهداف
              </label>
              <input
                type="text"
                data-testid="input-goalsAchievementExtent"
                value={d.goalsAchievementExtent}
                onChange={(e) =>
                  updateField('goalsAchievementExtent', e.target.value)
                }
                placeholder="نسبة ووصف تحقق أهداف الخطة الإثرائية..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                التوصيات
              </label>
              <input
                type="text"
                data-testid="input-recommendations"
                value={d.recommendations}
                onChange={(e) => updateField('recommendations', e.target.value)}
                placeholder="توصيات الاستمرار والمشاركة في المسابقات..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              />
            </div>
          </div>
        </section>
      </div>
    );
  };

  const renderPlanSpecificFields = () => {
    switch (formId) {
      case 'professional-development-plan':
        return renderProfessionalDevelopmentPlanFields(
          formData as ProfessionalDevelopmentPlanData
        );
      case 'weekly-teacher-plan':
        return renderWeeklyTeacherPlanFields(formData as WeeklyTeacherPlanData);
      case 'individual-remedial-plan':
        return renderIndividualRemedialPlanFields(
          formData as IndividualRemedialPlanData
        );
      case 'group-remedial-plan':
        return renderGroupRemedialPlanFields(formData as GroupRemedialPlanData);
      case 'enrichment-plan':
        return renderEnrichmentPlanFields(formData as EnrichmentPlanData);
    }
  };

  return (
    <div data-testid={`teacher-plan-form-${formId}`} className="space-y-6">
      {/* Top Bar: Navigation + Title + Mode Tabs + PDF Export */}
      <section className="bg-white rounded-2xl border border-[#E2E5E6] p-5 sm:p-6 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-plan-path-btn"
              onClick={onBackToPath}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>العودة إلى {pathLabel}</span>
            </button>

            <button
              type="button"
              data-testid="back-to-teacher-hub-from-plan-form-btn"
              onClick={onBackToTeacherHub}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>العودة لقسم المعلم</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-plans-archive-btn"
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
              data-testid="create-new-plan-btn"
              onClick={handleCreateNewPlan}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إنشاء خطة جديدة</span>
            </button>

            <button
              type="button"
              data-testid="save-plan-to-archive-btn"
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
              data-testid="fill-sample-plan-data-btn"
              onClick={handleFillSampleData}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#416B91] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wand2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تعبئة بيانات نموذجية للتجربة</span>
            </button>

            <button
              type="button"
              data-testid="reset-plan-form-btn"
              onClick={handleResetForm}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>إفراغ الحقول</span>
            </button>
          </div>
        </div>

        {/* Active Plan Record Context Bar */}
        <div
          data-testid="plan-record-state-bar"
          className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
            <span>حالة الخطة الحالية:</span>
            {activeArchivedRecordId ? (
              <span
                data-testid="plan-active-record-status-text"
                className="text-[#2F6846]"
              >
                سجل محفوظ في الأرشيف (المعرف الثابت: {activeArchivedRecordId})
              </span>
            ) : (
              <span
                data-testid="plan-active-record-status-text"
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

        {/* Multi-Record Archive Panel (Group 2: Teacher Plans) */}
        {isArchiveOpen && (
          <div
            data-testid="plans-archive-panel"
            className="rounded-2xl border border-[#E2E5E6] bg-[#FBFBF9] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات الأرشيف المحفوظة — {metadata.title}
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  كل خطة محفوظة تحتفظ بمعرف ثابت مستقل ويمكن فتحها وتعديلها أو حذفها بأمان دون التأثير على المسودات أو بقية السجلات.
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
                aria-labelledby="confirm-delete-plan-archive-heading"
                data-testid="delete-plan-archive-confirm-panel"
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
                      id="confirm-delete-plan-archive-heading"
                      className="font-extrabold"
                    >
                      تأكيد حذف السجل «{pendingDeleteTarget.record.title}»
                    </div>
                    <p className="leading-relaxed">
                      {pendingDeleteTarget.impact.warningMessage ||
                        'سيؤدي هذا الإجراء إلى حذف سجل الخطة المحفوظ من الأرشيف وإزالة المرفقات غير المستخدمة في أي سجل آخر.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    data-testid="cancel-delete-plan-archive-record-btn"
                    onClick={() => setPendingDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-plan-archive-record-btn"
                    onClick={handleConfirmDeleteArchivedPlan}
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
                data-testid="plans-archive-empty"
                className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs sm:text-sm text-stone-600"
              >
                لا توجد خطط محفوظة لهذا النموذج حتى الآن. استكمل البيانات واضغط «حفظ في الأرشيف» لحفظ السجل بمعرف مستقل.
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedRecords.map((rec) => {
                  const isCurrent = activeArchivedRecordId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      data-testid={`plan-archive-record-item-${rec.id}`}
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
                          data-testid={`open-plan-archive-record-${rec.id}`}
                          onClick={() => handleOpenArchivedPlan(rec)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#294660] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-plan-archive-record-${rec.id}`}
                          aria-label={`حذف السجل ${rec.title}`}
                          onClick={() => handleRequestDeleteArchivedPlan(rec)}
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
              <CalendarRange className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                الخطط · {pathLabel} · {metadata.badge}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
              {metadata.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              {metadata.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="tab-edit-plan"
              onClick={() => setActiveTab('edit')}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-[#376B70] text-white border-[#416B91]'
                  : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>١. إدخال البيانات</span>
            </button>

            <button
              type="button"
              data-testid="tab-preview-plan"
              onClick={handleSwitchToPreview}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 border transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-[#376B70] text-white border-[#416B91]'
                  : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>
                ٢. معاينة الخطة ({paginatedPages.length}{' '}
                {paginatedPages.length === 1 ? 'صفحة' : 'صفحات'}
                {metadata.maxPages ? ` / حد أقصى ${metadata.maxPages}` : ''})
              </span>
            </button>

            <button
              type="button"
              data-testid="export-teacher-plan-pdf-btn"
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
              <Palette className="w-4 h-4 text-[#416B91]" aria-hidden="true" />
              <span>قالب PDF المعتمد:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_TEMPLATES.map((tplId) => {
                const def = TEACHER_TEMPLATE_DEFINITIONS[tplId];
                const isSelected = templateStyle === tplId;
                return (
                  <button
                    key={tplId}
                    type="button"
                    data-testid={`plan-select-template-${tplId}`}
                    onClick={() => handleSelectTemplate(tplId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#376B70] text-white border-[#416B91]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {def.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-[#2F6846]" aria-hidden="true" />
              <span>النظام اللوني:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_COLOR_SYSTEMS.map((colId) => {
                const pal = TEACHER_COLOR_PALETTES[colId];
                const isSelected = colorSystem === colId;
                return (
                  <button
                    key={colId}
                    type="button"
                    data-testid={`plan-select-color-${colId}`}
                    onClick={() => handleSelectColorSystem(colId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: pal.primaryHex }}
                    />
                    <span>{pal.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {statusBanner && (
          <div
            role="status"
            data-testid="teacher-plan-status-banner"
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
          {renderPlanSpecificFields()}

          {/* Independent Evidence Section at the end of the report */}
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
              بيانات مُعدّ الخطة والاعتماد
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  {teacherLabel} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  data-testid="input-teacherName"
                  value={formData.teacherName}
                  onChange={(e) => updateField('teacherName', e.target.value)}
                  placeholder={`أدخل ${teacherLabel}...`}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#416B91]"
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
                data-testid="bottom-preview-plan-btn"
                onClick={handleSwitchToPreview}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>معاينة الخطة قبل التصدير</span>
              </button>

              <button
                type="button"
                data-testid="bottom-export-plan-pdf-btn"
                disabled={isExporting}
                onClick={handleExportPdf}
                className="min-h-[46px] px-6 py-2.5 rounded-xl text-white text-sm font-bold inline-flex items-center gap-2 transition-opacity cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: palette.primaryHex }}
              >
                <FileDown className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isExporting ? 'جاري التصدير...' : 'تصدير الخطة PDF مباشرة'}
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
                {renderedPages.length}
                {metadata.maxPages ? ` من أصل حد أقصى ${metadata.maxPages}` : ''})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="return-to-edit-plan-btn"
                onClick={() => setActiveTab('edit')}
                className="min-h-[40px] px-4 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 cursor-pointer"
              >
                العودة لتعديل البيانات
              </button>
              <button
                type="button"
                data-testid="preview-export-plan-pdf-btn"
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
                data-testid={`plan-preview-page-${pageIdx}`}
                data-template-style={templateStyle}
                data-color-system={colorSystem}
                data-links-count={pageData.links.length}
                className="relative bg-white mx-auto border border-stone-200 rounded-xl shadow-xs overflow-hidden max-w-[210mm] aspect-[1240/1754]"
              >
                {pageData.dataUrl ? (
                  <img
                    src={pageData.dataUrl}
                    alt={`${metadata.title} — صفحة ${pageIdx + 1}`}
                    className="w-full h-full object-contain block"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">
                    جاري تحضير المعاينة...
                  </div>
                )}

                {pageData.links.map((lnk, lIdx) => (
                  <a
                    key={lIdx}
                    href={lnk.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={lnk.url}
                    style={{
                      position: 'absolute',
                      left: `${(lnk.xPx / pageData.pixelWidth) * 100}%`,
                      top: `${(lnk.yPx / pageData.pixelHeight) * 100}%`,
                      width: `${(lnk.wPx / pageData.pixelWidth) * 100}%`,
                      height: `${(lnk.hPx / pageData.pixelHeight) * 100}%`,
                    }}
                    className="block hover:ring-2 hover:ring-[#416B91]/40 rounded-lg transition-all"
                  >
                    <span className="sr-only">فتح الرابط الإلكتروني</span>
                  </a>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
