import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BookmarkCheck,
  CheckCircle2,
  Download,
  Edit2,
  FileBadge,
  FolderSync,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { SECTIONS } from '../../data/sections';
import {
  ExportFormat,
  FormDefinition,
  FormFieldValue,
  FormValidationErrors,
  FormValues,
} from '../../types/forms';
import {
  buildCourseFromExecutionValues,
  convertSavedCoursesToTableRows,
  deleteSavedCourseFromRegistry,
  filterCoursesByAcademicPeriod,
  loadSavedCoursesFromStorage,
  saveCourseToLocalRegistry,
  SavedTrainingCourse,
  updateSavedCourseInRegistry,
} from '../../utils/coursesRegistryStorage';
import {
  downloadBatchCertificatesZipAsync,
  downloadSingleCertificateFile,
  executeReportExport,
} from '../../utils/exportEngine';
import {
  createEmptyTableRow,
  createInitialFormValues,
  formatGregorianToUmmAlQuraHijri,
  isFieldVisible,
  isFormDirty,
  validateFormValues,
} from '../../utils/formEngine';
import {
  buildCertificatePdfFilesAsync,
  parseBatchTraineeNames,
  ZipFileEntry,
} from '../../utils/zipBuilder';
import { FormActions } from './FormActions';
import { FormField } from './FormField';
import { ReportPreview } from './ReportPreview';

interface FormRendererProps {
  form: FormDefinition;
  onClose: () => void;
}

export const FormRenderer: React.FC<FormRendererProps> = ({ form, onClose }) => {
  const { settings } = useSettings();
  const section = SECTIONS[form.sectionId];

  // Local Saved Courses State (for PD Training Execution & Semester Final Report)
  const [savedCourses, setSavedCourses] = useState<SavedTrainingCourse[]>(() =>
    loadSavedCoursesFromStorage()
  );

  // Form state lives in browser memory during the active session
  const [values, setValues] = useState<FormValues>(() => {
    const initial = createInitialFormValues(form);
    const initialStoredCourses = form.enableCourseRecallFromLocalRegistry
      ? loadSavedCoursesFromStorage()
      : [];
    const latestStoredCourse =
      initialStoredCourses.length > 0
        ? initialStoredCourses[initialStoredCourses.length - 1]
        : null;

    if ('academicYearInput' in initial && !initial.academicYearInput) {
      if (settings.academicYear) {
        initial.academicYearInput = settings.academicYear;
      } else if (latestStoredCourse?.academicYear) {
        initial.academicYearInput = latestStoredCourse.academicYear;
      }
    }
    if (
      'schoolNameInput' in initial &&
      settings.schoolName &&
      !initial.schoolNameInput
    ) {
      initial.schoolNameInput = settings.schoolName;
    }
    if (
      'principalNameInput' in initial &&
      settings.principalName &&
      !initial.principalNameInput
    ) {
      initial.principalNameInput = settings.principalName;
    }
    if ('semesterName' in initial && !initial.semesterName) {
      if (
        form.enableCourseRecallFromLocalRegistry &&
        initialStoredCourses.length > 0 &&
        !initialStoredCourses.some((c) => c.semester === 'الفصل الدراسي الأول') &&
        initialStoredCourses.some((c) => c.semester === 'الفصل الدراسي الثاني')
      ) {
        initial.semesterName = 'الفصل الدراسي الثاني';
      } else {
        initial.semesterName = 'الفصل الدراسي الأول';
      }
    }
    return initial;
  });

  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [hasExportedSinceEdit, setHasExportedSinceEdit] =
    useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<'leave' | 'reset' | null>(
    null
  );
  const [lastSavedCourseId, setLastSavedCourseId] = useState<string | null>(
    null
  );
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDraft, setEditingCourseDraft] =
    useState<SavedTrainingCourse | null>(null);

  // Batch Trainee Certificates State
  const [generatedCertFiles, setGeneratedCertFiles] = useState<ZipFileEntry[]>(
    []
  );

  const currentAcademicYear =
    typeof values.academicYearInput === 'string'
      ? values.academicYearInput.trim()
      : settings.academicYear.trim();
  const currentSemester =
    typeof values.semesterName === 'string' && values.semesterName.trim()
      ? values.semesterName.trim()
      : 'الفصل الدراسي الأول';

  const matchingSavedCourses = filterCoursesByAcademicPeriod(
    savedCourses,
    currentAcademicYear,
    currentSemester
  );

  // Display matching courses first, followed by any other saved courses in local storage so no saved course is ever hidden
  const displayedSavedCourses = React.useMemo(() => {
    const matchingIds = new Set(matchingSavedCourses.map((c) => c.id));
    const others = savedCourses.filter((c) => !matchingIds.has(c.id));
    return [...matchingSavedCourses, ...others];
  }, [matchingSavedCourses, savedCourses]);

  // Auto-recall saved courses when opening Semester Final Report or switching semester/year
  useEffect(() => {
    if (!form.enableCourseRecallFromLocalRegistry) return;
    const allStored = loadSavedCoursesFromStorage();
    setSavedCourses(allStored);
    let matching = filterCoursesByAcademicPeriod(
      allStored,
      currentAcademicYear,
      currentSemester
    );
    // Fallback: if strict year+semester matched 0 but there are courses in currentSemester, match them
    if (matching.length === 0 && allStored.length > 0) {
      matching = filterCoursesByAcademicPeriod(allStored, '', currentSemester);
    }
    const ids = matching.map((c) => c.id);
    setSelectedCourseIds(ids);

    if (matching.length > 0) {
      setValues((prev) => ({
        ...prev,
        executedPrograms: convertSavedCoursesToTableRows(matching),
      }));
    } else {
      const programsField = form.fields.find(
        (f) => f.id === 'executedPrograms'
      );
      setValues((prev) => ({
        ...prev,
        executedPrograms: [createEmptyTableRow(programsField?.columns ?? [])],
      }));
    }
  }, [
    form.enableCourseRecallFromLocalRegistry,
    currentAcademicYear,
    currentSemester,
  ]);

  const dirty = isFormDirty(form, values);
  const hasUnexportedChanges = dirty && !hasExportedSinceEdit;

  // Browser tab close/reload warning when form has unexported data
  useEffect(() => {
    if (!hasUnexportedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnexportedChanges]);

  const handleFieldChange = (fieldId: string, newValue: FormFieldValue) => {
    const dependentHijriFields = form.fields.filter(
      (f) => f.autoHijriFromFieldId === fieldId
    );

    setValues((prev) => {
      const next: FormValues = {
        ...prev,
        [fieldId]: newValue,
      };

      if (typeof newValue === 'string' && dependentHijriFields.length > 0) {
        const computedHijri = formatGregorianToUmmAlQuraHijri(newValue);
        for (const hField of dependentHijriFields) {
          next[hField.id] = computedHijri;
        }
      }

      return next;
    });

    setHasExportedSinceEdit(false);
    setFeedbackMessage(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      for (const hField of dependentHijriFields) {
        delete next[hField.id];
      }
      return next;
    });
  };

  // Save course from Training Execution Report to Local Course Registry
  const handleSaveCourseToRegistry = () => {
    const courseData = buildCourseFromExecutionValues(
      values,
      settings.academicYear
    );

    if (!courseData.programName) {
      setErrors((prev) => ({
        ...prev,
        programTitle: 'يرجى إدخال اسم البرنامج التدريبي أولاً قبل حفظ الدورة',
      }));
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى إدخال اسم البرنامج التدريبي أولاً قبل حفظ الدورة في السجل المحلي.',
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const result = saveCourseToLocalRegistry({
      ...courseData,
      id: lastSavedCourseId ?? undefined,
      domain: courseData.domain || 'تطوير الأداء',
      executionDate:
        courseData.executionDate || new Date().toISOString().slice(0, 10),
      location: courseData.location || 'المدرسة',
      beneficiariesCount: courseData.beneficiariesCount || '0',
    });
    setLastSavedCourseId(result.saved.id);
    setSavedCourses(result.allCourses);
    setHasExportedSinceEdit(true);
    setFeedbackMessage({
      type: 'success',
      text: result.updatedExisting
        ? `تم تحديث بيانات دورة «${result.saved.programName}» في السجل المحلي (${result.saved.semester} — ${result.saved.academicYear || 'بدون عام محدد'}) دون تكرارها.`
        : `تم حفظ دورة «${result.saved.programName}» في سجل الدورات التدريبية المحلي (${result.saved.semester} — ${result.saved.academicYear || 'بدون عام محدد'}) لاستدعائها في التقرير الختامي.`,
    });
  };

  const syncSelectedCoursesToTable = (
    nextSelectedIds: string[],
    coursesSource: SavedTrainingCourse[]
  ) => {
    const chosen = coursesSource.filter((c) => nextSelectedIds.includes(c.id));
    const programsField = form.fields.find((f) => f.id === 'executedPrograms');
    setValues((prev) => ({
      ...prev,
      executedPrograms:
        chosen.length > 0
          ? convertSavedCoursesToTableRows(chosen)
          : [createEmptyTableRow(programsField?.columns ?? [])],
    }));
  };

  const handleToggleSelectSavedCourse = (courseId: string) => {
    const nextIds = selectedCourseIds.includes(courseId)
      ? selectedCourseIds.filter((id) => id !== courseId)
      : [...selectedCourseIds, courseId];
    setSelectedCourseIds(nextIds);
    syncSelectedCoursesToTable(nextIds, savedCourses);
  };

  const handleDeleteSavedCourse = (courseId: string) => {
    const nextCourses = deleteSavedCourseFromRegistry(courseId);
    setSavedCourses(nextCourses);
    const nextSelected = selectedCourseIds.filter((id) => id !== courseId);
    setSelectedCourseIds(nextSelected);
    syncSelectedCoursesToTable(nextSelected, nextCourses);
    setFeedbackMessage({
      type: 'success',
      text: 'تم حذف الدورة من السجل المحلي بنجاح.',
    });
  };

  const handleSaveEditedCourse = () => {
    if (!editingCourseId || !editingCourseDraft) return;
    const nextCourses = updateSavedCourseInRegistry(editingCourseId, {
      programName: editingCourseDraft.programName,
      domain: editingCourseDraft.domain,
      executionDate: editingCourseDraft.executionDate,
      location: editingCourseDraft.location,
      beneficiariesCount: editingCourseDraft.beneficiariesCount,
      keyOutputs: editingCourseDraft.keyOutputs,
      semester: editingCourseDraft.semester,
      academicYear: editingCourseDraft.academicYear,
    });
    setSavedCourses(nextCourses);
    setEditingCourseId(null);
    setEditingCourseDraft(null);
    syncSelectedCoursesToTable(selectedCourseIds, nextCourses);
    setFeedbackMessage({
      type: 'success',
      text: 'تم تحديث بيانات الدورة المحفوظة في السجل المحلي.',
    });
  };

  // Generate Batch Trainee Certificates
  const handleGenerateBatchCertificates = async () => {
    const check = validateFormValues(form, values);
    if (!check.valid) {
      setErrors(check.errors);
      setFeedbackMessage({
        type: 'error',
        text: 'يرجى استكمال قائمة أسماء المتدربين وبيانات البرنامج المشتركة أولاً قبل إنشاء الشهادات.',
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const traineeNames = parseBatchTraineeNames(values.beneficiaryName);
    if (traineeNames.length === 0) {
      setErrors({ beneficiaryName: 'يرجى إدخال اسم متدرب واحد على الأقل' });
      return;
    }

    setErrors({});
    const files = await buildCertificatePdfFilesAsync(
      'trainee',
      values,
      settings,
      traineeNames
    );
    setGeneratedCertFiles(files);
    setIsPreviewMode(true);
    setFeedbackMessage({
      type: 'success',
      text: `تم إنشاء (${files.length}) شهادة متدرب مستقلة بصيغة PDF بنجاح. يمكنك معاينتها أو تنزيل كل شهادة منفردة (PDF) أو تنزيلها دفعة واحدة كملف ZIP يحتوي على ملفات PDF فقط.`,
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadAllCertificatesZip = async () => {
    const traineeNames = parseBatchTraineeNames(values.beneficiaryName);
    if (traineeNames.length === 0) return;
    const res = await downloadBatchCertificatesZipAsync(
      traineeNames,
      values,
      settings,
      generatedCertFiles
    );
    setGeneratedCertFiles(res.files);
    setHasExportedSinceEdit(true);
    setFeedbackMessage({
      type: 'success',
      text: `تم تجهيز وتنزيل (${res.count}) شهادة PDF مستقلة في ملف مضغوط (${res.zipFilename}) بنجاح.`,
    });
  };

  const isCertificateForm =
    form.templateLayout === 'certificate-trainer' ||
    form.templateLayout === 'certificate-trainee';

  const handleTogglePreview = async () => {
    if (!isPreviewMode) {
      if (isCertificateForm) {
        const check = validateFormValues(form, values);
        if (!check.valid) {
          setErrors(check.errors);
          setFeedbackMessage({
            type: 'error',
            text: 'يرجى استكمال الحقول الإلزامية المشار إليها باللون الأحمر قبل معاينة أو تصدير التقرير.',
          });
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }
      }
      setErrors({});
      setFeedbackMessage(null);

      if (form.enableBatchCertificateGeneration) {
        const traineeNames = parseBatchTraineeNames(values.beneficiaryName);
        const files = await buildCertificatePdfFilesAsync(
          'trainee',
          values,
          settings,
          traineeNames
        );
        setGeneratedCertFiles(files);
      }
    }
    setIsPreviewMode((prev) => !prev);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (isCertificateForm) {
      const check = validateFormValues(form, values);
      if (!check.valid) {
        setErrors(check.errors);
        setIsPreviewMode(false);
        setFeedbackMessage({
          type: 'error',
          text: 'يرجى استكمال جميع الحقول الإلزامية أولاً قبل تصدير التقرير.',
        });
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
    }

    setErrors({});
    const result = await executeReportExport(format, {
      form,
      values,
      settings,
    });
    if (result.success) {
      setHasExportedSinceEdit(true);
      setFeedbackMessage({
        type: 'success',
        text: result.message,
      });
    }
  };

  const handleRequestReset = () => {
    if (dirty) {
      setConfirmDialog('reset');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      performReset();
    }
  };

  const performReset = () => {
    const initial = createInitialFormValues(form);
    if (
      'academicYearInput' in initial &&
      settings.academicYear &&
      !initial.academicYearInput
    ) {
      initial.academicYearInput = settings.academicYear;
    }
    if (
      'schoolNameInput' in initial &&
      settings.schoolName &&
      !initial.schoolNameInput
    ) {
      initial.schoolNameInput = settings.schoolName;
    }
    if (
      'principalNameInput' in initial &&
      settings.principalName &&
      !initial.principalNameInput
    ) {
      initial.principalNameInput = settings.principalName;
    }
    if ('semesterName' in initial && !initial.semesterName) {
      initial.semesterName = 'الفصل الدراسي الأول';
    }
    setValues(initial);
    setErrors({});
    setGeneratedCertFiles([]);
    setLastSavedCourseId(null);
    setIsPreviewMode(false);
    setHasExportedSinceEdit(false);
    setConfirmDialog(null);
    setFeedbackMessage({
      type: 'success',
      text: 'تم مسح بيانات النموذج والبدء من جديد.',
    });
  };

  const handleRequestBack = () => {
    if (hasUnexportedChanges) {
      setConfirmDialog('leave');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      onClose();
    }
  };

  const visibleFields = form.fields.filter((f) => isFieldVisible(f, values));

  return (
    <div className="space-y-6">
      {/* Form Header Banner */}
      <div
        className={`bg-white rounded-2xl border ${section.accentBorderClass} p-5 sm:p-6 print:hidden`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className={`text-xs font-bold ${section.accentTextClass}`}>
            محرك النماذج والتقارير الموحد · قسم {section.title}
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
          {form.title}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
          {form.description}
        </p>

        {/* Mandatory Prominent Red Privacy Warning in Every Form */}
        <div
          data-testid="general-form-red-warning"
          className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-red-700"
        >
          <ShieldAlert className="w-5 h-5 shrink-0 text-red-700" aria-hidden="true" />
          <span>
            بيانات النموذج والصور لا تُحفظ تلقائياً، وتُعالج محلياً في متصفحك فقط.
          </span>
        </div>
      </div>

      {/* Validation or Export Feedback Banner */}
      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 flex items-center gap-3 text-xs sm:text-sm font-semibold print:hidden ${
            feedbackMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-[#EEF5EE] border-[#C5DCC7] text-[#2F6846]'
          }`}
        >
          {feedbackMessage.type === 'error' ? (
            <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Confirmation Dialog for Leaving with Unexported Data or Resetting */}
      {confirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="rounded-2xl border-2 border-[#E8C9BA] bg-[#FBFBF9] p-5 sm:p-6 space-y-4 print:hidden"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-6 h-6 text-[#9A4A2E] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h3
                id="confirm-dialog-title"
                className="text-base font-bold font-display text-stone-900"
              >
                {confirmDialog === 'leave'
                  ? 'تنبيه: لديك بيانات غير مصدّرة في هذا النموذج'
                  : 'تأكيد مسح بيانات النموذج'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                {confirmDialog === 'leave'
                  ? 'بيانات النماذج والشواهد المصورة تُحفظ في ذاكرة المتصفح المؤقتة أثناء العمل فقط. مغادرة النموذج الآن ستؤدي إلى فقدان البيانات المدخلة غير المصدّرة.'
                  : 'هل أنت متأكد من رغبتك في مسح جميع الحقول والصفوف والشواهد المرفقة والبدء من جديد؟'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={confirmDialog === 'leave' ? onClose : performReset}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              {confirmDialog === 'leave'
                ? 'مغادرة النموذج وتجاهل البيانات'
                : 'نعم، امسح البيانات وابدأ من جديد'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDialog(null)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              البقاء في النموذج ومواصلة العمل
            </button>
          </div>
        </div>
      )}

      {/* Semester Final Report: Local Saved Courses Auto-Recall, Filter, Edit & Delete Panel */}
      {form.enableCourseRecallFromLocalRegistry && !isPreviewMode && (
        <section
          data-testid="saved-courses-recall-panel"
          className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4 print:hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderSync
                className="w-5 h-5 text-[#376B70]"
                aria-hidden="true"
              />
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                سجل الدورات التدريبية المحفوظة محلياً ({currentSemester}
                {currentAcademicYear ? ` · ${currentAcademicYear}` : ''})
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-600 tabular-nums">
              إجمالي الدورات المحفوظة: {savedCourses.length} (المطابقة للفصل الحالي:{' '}
              {matchingSavedCourses.length})
            </span>
          </div>

          <div className="rounded-xl border border-[#E8C9BA] bg-[#FBFBF9] px-4 py-2.5 text-xs sm:text-sm text-stone-800 flex items-center gap-2">
            <AlertTriangle
              className="w-4 h-4 text-[#9A4A2E] shrink-0"
              aria-hidden="true"
            />
            <span>
              <strong>تنبيه:</strong> يُحفظ سجل الدورات محلياً داخل متصفحك فقط لتسهيل إعداد التقرير الختامي. حذف بيانات المتصفح أو تغيير الجهاز قد يؤدي إلى فقدان سجل الدورات.
            </span>
          </div>

          {displayedSavedCourses.length === 0 ? (
            <p className="text-xs sm:text-sm text-stone-500 py-2">
              لا توجد دورات محفوظة محلياً حالياً. يمكنك حفظ الدورات من نموذج «تقرير تنفيذ دورة تدريبية» أو إضافتها يدوياً بالأسفل.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-stone-600">
                حدد الدورات التي ترغب في تضمينها تلقائياً داخل جدول التقرير الختامي، كما يمكنك تعديل بيانات أي دورة أو حذفها من السجل المحلي:
              </p>
              <div className="space-y-2.5">
                {displayedSavedCourses.map((course) => {
                  const isChecked = selectedCourseIds.includes(course.id);
                  const isEditing = editingCourseId === course.id;

                  return (
                    <div
                      key={course.id}
                      data-testid={`saved-course-item-${course.id}`}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        isChecked
                          ? 'border-[#376B70]/50 bg-[#EAF2F1]/40'
                          : 'border-stone-200 bg-stone-50/50'
                      }`}
                    >
                      {isEditing && editingCourseDraft ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                              type="text"
                              aria-label="تعديل اسم البرنامج"
                              value={editingCourseDraft.programName}
                              onChange={(e) =>
                                setEditingCourseDraft({
                                  ...editingCourseDraft,
                                  programName: e.target.value,
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm"
                              placeholder="اسم البرنامج"
                            />
                            <input
                              type="text"
                              aria-label="تعديل المجال"
                              value={editingCourseDraft.domain}
                              onChange={(e) =>
                                setEditingCourseDraft({
                                  ...editingCourseDraft,
                                  domain: e.target.value,
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm"
                              placeholder="المجال"
                            />
                            <input
                              type="date"
                              aria-label="تعديل تاريخ التنفيذ"
                              value={editingCourseDraft.executionDate}
                              onChange={(e) =>
                                setEditingCourseDraft({
                                  ...editingCourseDraft,
                                  executionDate: e.target.value,
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm"
                            />
                            <input
                              type="text"
                              aria-label="تعديل مكان التنفيذ"
                              value={editingCourseDraft.location}
                              onChange={(e) =>
                                setEditingCourseDraft({
                                  ...editingCourseDraft,
                                  location: e.target.value,
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm"
                              placeholder="مكان التنفيذ"
                            />
                            <input
                              type="number"
                              aria-label="تعديل عدد المستفيدين"
                              value={editingCourseDraft.beneficiariesCount}
                              onChange={(e) =>
                                setEditingCourseDraft({
                                  ...editingCourseDraft,
                                  beneficiariesCount: e.target.value,
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm"
                              placeholder="عدد المستفيدين"
                            />
                            <input
                              type="text"
                              aria-label="تعديل أبرز المخرجات"
                              value={editingCourseDraft.keyOutputs}
                              onChange={(e) =>
                                setEditingCourseDraft({
                                  ...editingCourseDraft,
                                  keyOutputs: e.target.value,
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm"
                              placeholder="أبرز المخرجات"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSaveEditedCourse}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#376B70] text-white text-xs font-semibold cursor-pointer"
                            >
                              حفظ التعديلات
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCourseId(null);
                                setEditingCourseDraft(null);
                              }}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-semibold cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                handleToggleSelectSavedCourse(course.id)
                              }
                              className="w-4 h-4 accent-[#376B70] rounded mt-1 sm:mt-0 shrink-0"
                            />
                            <div className="space-y-0.5 text-xs sm:text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-stone-900">
                                  {course.programName}
                                </span>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                                  {course.semester}
                                  {course.academicYear
                                    ? ` · ${course.academicYear}`
                                    : ''}
                                </span>
                              </div>
                              <div className="text-xs text-stone-600">
                                المجال: {course.domain || '—'} · التاريخ:{' '}
                                <span className="tabular-nums">
                                  {course.executionDate ||
                                    course.executionHijriDate ||
                                    '—'}
                                </span>{' '}
                                · المكان: {course.location || '—'} · المستفيدون:{' '}
                                <span className="tabular-nums">
                                  {course.beneficiariesCount || '0'}
                                </span>
                                {course.keyOutputs
                                  ? ` · أبرز المخرجات: ${course.keyOutputs}`
                                  : ''}
                              </div>
                            </div>
                          </label>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCourseId(course.id);
                                setEditingCourseDraft({ ...course });
                              }}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`حذف دورة ${course.programName} من السجل المحلي`}
                              onClick={() => handleDeleteSavedCourse(course.id)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>حذف من السجل</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Batch Trainee Certificates Control & Generated Files List */}
      {form.enableBatchCertificateGeneration &&
        generatedCertFiles.length > 0 && (
          <section
            data-testid="generated-certificates-panel"
            className="bg-white rounded-2xl border border-[#E2E5E6] p-5 sm:p-6 space-y-4 print:hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                  الشهادات المُنشأة الجاهزة للتنزيل ({generatedCertFiles.length}{' '}
                  ملف PDF مستقل)
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  كل شهادة عبارة عن ملف PDF رسمي مستقل بحجم A4 أفقي، ويمكنك تنزيل كل شهادة منفردة أو تنزيلها جميعاً في ملف ZIP واحد يحتوي على ملفات PDF فقط.
                </p>
              </div>

              <button
                type="button"
                data-testid="download-all-certificates-zip-btn"
                onClick={handleDownloadAllCertificatesZip}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Archive className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  تنزيل جميع الشهادات دفعة واحدة (ZIP يحتوي ملفات PDF — {generatedCertFiles.length})
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
              {generatedCertFiles.map((fileEntry, idx) => (
                <div
                  key={fileEntry.filename}
                  data-testid={`generated-cert-file-${idx + 1}`}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <span
                    className="font-semibold text-stone-800 truncate"
                    title={fileEntry.filename}
                  >
                    {idx + 1}. {fileEntry.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadSingleCertificateFile(fileEntry)}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تنزيل PDF</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      {/* Main Dynamic Form Fields & Report Preview (Report is always available for @media print) */}
      <div className={isPreviewMode ? 'block' : 'hidden print:block'}>
        <ReportPreview
          form={form}
          values={values}
          settings={settings}
        />
      </div>

      {!isPreviewMode && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTogglePreview();
          }}
          noValidate
          className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 print:hidden space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleFields.map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                accentColorClass={section.accentTextClass}
                onChange={handleFieldChange}
              />
            ))}
          </div>

          {/* Save Course to Local Registry Bar (Only in Training Execution Report) */}
          {form.enableCourseSaveToLocalRegistry && (
            <div className="pt-4 border-t border-stone-200 space-y-3">
              <div className="rounded-xl border border-[#E2E5E6] bg-[#EAF2F1]/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-[#376B70]">
                      حفظ الدورة في سجل الدورات التدريبية المحلي (للتقرير الختامي)
                    </h4>
                    <span
                      data-testid="saved-courses-count-badge"
                      className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-[#E2E5E6] text-[#376B70] tabular-nums"
                    >
                      الدورات المحفوظة حالياً: {savedCourses.length}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    يتيح لك هذا الخيار حفظ بيانات الدورة الأساسية (دون الصور أو التوقيعات أو السجل المدني) لاستدعائها تلقائياً عند إعداد التقرير الختامي للفصل الدراسي.
                  </p>
                  <p className="text-xs font-semibold text-[#9A4A2E]">
                    تنبيه: حذف بيانات المتصفح أو تغيير الجهاز قد يؤدي إلى فقدان سجل الدورات المحفوظة.
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="save-course-to-local-registry-btn"
                  onClick={handleSaveCourseToRegistry}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>حفظ الدورة في سجل الدورات المحلية</span>
                </button>
              </div>

              {feedbackMessage && (
                <div
                  data-testid="save-course-inline-feedback"
                  className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
                    feedbackMessage.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-[#EEF5EE] border-[#C5DCC7] text-[#2F6846]'
                  }`}
                >
                  {feedbackMessage.type === 'error' ? (
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{feedbackMessage.text}</span>
                </div>
              )}
            </div>
          )}

          {/* Batch Certificate Generation Action Bar (Only in Trainee Certificate Form) */}
          {form.enableBatchCertificateGeneration && (
            <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-stone-600">
                أدخل اسماً واحداً أو الصق قائمة أسماء (10 أو 20 اسماً أو أكثر) ثم اضغط «إنشاء الشهادات» لتوليد شهادة مستقلة لكل متدرب.
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-testid="generate-batch-certificates-btn"
                  onClick={handleGenerateBatchCertificates}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileBadge className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>إنشاء الشهادات</span>
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Bottom Action Bar */}
      <FormActions
        isPreviewMode={isPreviewMode}
        supportedExports={form.supportedExports}
        accentButtonClass={section.buttonBgClass}
        onTogglePreview={handleTogglePreview}
        onExport={handleExport}
        onResetRequest={handleRequestReset}
        onBackRequest={handleRequestBack}
      />
    </div>
  );
};
