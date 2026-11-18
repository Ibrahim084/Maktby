import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import {
  TeacherReportBasicField,
  TeacherReportContentSection,
  TeacherReportDocument,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from './teacherPdfEngine';

export type TeacherTestsAndEvaluationFormId =
  | 'internal-test-execution'
  | 'performance-task-execution';

export interface TeacherTestsAndEvaluationGroupMeta {
  id: 'tests-and-evaluation';
  title: string;
  badge: string;
  description: string;
  summaryHighlight: string;
}

export interface TeacherTestsAndEvaluationCatalogItem {
  id: TeacherTestsAndEvaluationFormId;
  title: string;
  shortTitle: string;
  reportTypeLabel: string;
  badge: string;
  description: string;
  highlights: string[];
}

export const TEACHER_TESTS_AND_EVALUATION_GROUP: TeacherTestsAndEvaluationGroupMeta =
  {
    id: 'tests-and-evaluation',
    title: 'الاختبارات والتقويم',
    badge: 'نموذجان معتمدان',
    description:
      'توثيق تنفيذ الاختبارات الداخلية والمهام الأدائية التي يعدّها المعلم وينفّذها لطلابه داخل المدرسة، مع الحساب التلقائي لأعداد الغياب وعدم الإنجاز وإرفاق الشواهد والروابط الإلكترونية الاختيارية.',
    summaryHighlight:
      'تشتمل على نموذجي «تقرير تنفيذ اختبار داخلي» و«تقرير تنفيذ مهمة أدائية» للتقويم الداخلي الصفي',
  };

export const TEACHER_TESTS_AND_EVALUATION_CATALOG: TeacherTestsAndEvaluationCatalogItem[] =
  [
    {
      id: 'internal-test-execution',
      title: 'تقرير تنفيذ اختبار داخلي',
      shortTitle: 'تقرير تنفيذ اختبار داخلي',
      reportTypeLabel: 'تقرير تنفيذ اختبار داخلي',
      badge: 'الاختبارات الداخلية',
      description:
        'توثيق تنفيذ اختبار داخلي أعدّه المعلم ونفّذه لطلابه داخل المدرسة، مع تحديد تصنيف الاختبار والدرجة النهائية وطريقة التنفيذ والحساب التلقائي لعدد الغائبين.',
      highlights: [
        'تصنيف مرن للاختبار (تشخيصي، قبلي، تقويمي، وحدة دراسية، عدة وحدات، ختامي، أو تصنيف آخر)',
        'درجة نهائية مرنة للاختبار مع حساب تلقائي لعدد الغائبين والتحقق من صحة الأعداد',
        'تحديد طريقة التنفيذ (ورقي / إلكتروني) مع ملاحظات وشواهد مصورة وروابط QR اختيارية',
      ],
    },
    {
      id: 'performance-task-execution',
      title: 'تقرير تنفيذ مهمة أدائية',
      shortTitle: 'تقرير تنفيذ مهمة أدائية',
      reportTypeLabel: 'تقرير تنفيذ مهمة أدائية',
      badge: 'المهام الأدائية',
      description:
        'توثيق مهمة تعليمية يطبق فيها الطلاب معارفهم ومهاراتهم عمليًا أو ينتجون عملًا يمكن ملاحظته وتقويمه، مع توضيح هدف المهمة وآلية تنفيذها وطريقة تقويمها.',
      highlights: [
        'تحديد نوع المهمة الأدائية (مشروع، تجربة عملية، عرض تقديمي، منتج تعليمي، مهمة تطبيقية، نشاط أدائي، أو أخرى)',
        'حساب تلقائي لعدد الطلاب الذين لم ينجزوا المهمة من خلال طرح المنجزين من العدد المستهدف',
        'توثيق هدف المهمة ووصف آلية تنفيذها وطريقة تقويم أداء الطلاب مع شواهد وروابط QR اختيارية',
      ],
    },
  ];

export const STAGE_SUGGESTIONS: string[] = [
  'المرحلة الابتدائية',
  'المرحلة المتوسطة',
  'المرحلة الثانوية',
];

// ============================================================================
// النموذج الأول: تقرير تنفيذ اختبار داخلي (Internal Test Execution Report)
// ============================================================================

export type InternalTestCategoryOption =
  | 'اختبار تشخيصي'
  | 'اختبار تهيئة أو قبلي'
  | 'اختبار تقويمي خلال الفترة الدراسية'
  | 'اختبار وحدة دراسية'
  | 'اختبار عدة وحدات'
  | 'اختبار ختامي للفترة الدراسية'
  | 'تصنيف آخر';

export const INTERNAL_TEST_CATEGORY_OPTIONS: InternalTestCategoryOption[] = [
  'اختبار تشخيصي',
  'اختبار تهيئة أو قبلي',
  'اختبار تقويمي خلال الفترة الدراسية',
  'اختبار وحدة دراسية',
  'اختبار عدة وحدات',
  'اختبار ختامي للفترة الدراسية',
  'تصنيف آخر',
];

export type InternalTestExecutionMethod = 'ورقي' | 'إلكتروني';

export const INTERNAL_TEST_EXECUTION_METHODS: InternalTestExecutionMethod[] = [
  'ورقي',
  'إلكتروني',
];

export interface InternalTestExecutionFormState {
  formId: 'internal-test-execution';
  testName: string;
  subject: string;
  stage: string;
  grade: string;
  testCategory: InternalTestCategoryOption;
  customTestCategory: string;
  executionDate: string;
  maxScore: string;
  targetStudentsCount: string;
  performedStudentsCount: string;
  executionMethod: InternalTestExecutionMethod;
  additionalNotes: string; // اختياري
  evidencePhotos: TeacherReportEvidencePhoto[]; // اختياري (0..2)
  evidenceLinks: TeacherReportEvidenceLink[]; // اختياري (0..2)
}

// ============================================================================
// النموذج الثاني: تقرير تنفيذ مهمة أدائية (Performance Task Execution Report)
// ============================================================================

export type PerformanceTaskTypeOption =
  | 'مشروع'
  | 'تجربة عملية'
  | 'عرض تقديمي'
  | 'منتج تعليمي'
  | 'مهمة تطبيقية'
  | 'نشاط أدائي'
  | 'أخرى';

export const PERFORMANCE_TASK_TYPE_OPTIONS: PerformanceTaskTypeOption[] = [
  'مشروع',
  'تجربة عملية',
  'عرض تقديمي',
  'منتج تعليمي',
  'مهمة تطبيقية',
  'نشاط أدائي',
  'أخرى',
];

export interface PerformanceTaskExecutionFormState {
  formId: 'performance-task-execution';
  taskName: string;
  subject: string;
  stage: string;
  grade: string;
  executionDateOrPeriod: string;
  taskType: PerformanceTaskTypeOption;
  customTaskType: string;
  targetStudentsCount: string;
  completedStudentsCount: string;
  taskGoal: string;
  taskDescriptionAndMechanism: string;
  evaluationMethod: string;
  additionalNotes: string; // اختياري
  evidencePhotos: TeacherReportEvidencePhoto[]; // اختياري (0..2)
  evidenceLinks: TeacherReportEvidenceLink[]; // اختياري (0..2)
}

export type AnyTeacherTestOrEvaluationFormState =
  | InternalTestExecutionFormState
  | PerformanceTaskExecutionFormState;

// ============================================================================
// Numeric, URL & Text Helpers (supports both Arabic-Indic ٠-٩ and ASCII 0-9)
// ============================================================================

export function normalizeDigitsToAscii(raw: string): string {
  return String(raw || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();
}

/**
 * Validates that an electronic link URL is a well-formed http/https URL.
 */
export function isValidElectronicUrl(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname;
    if (!host) return false;
    return host === 'localhost' || host.includes('.');
  } catch {
    return false;
  }
}

/**
 * Validates the optional electronic links array (0..2 links).
 * If a link entry exists in the array, its URL must be non-empty and a valid http/https URL.
 */
export function validateElectronicLinks(
  links: TeacherReportEvidenceLink[]
): string[] {
  const errors: string[] = [];
  const list = Array.isArray(links) ? links.slice(0, 2) : [];
  list.forEach((item, index) => {
    const trimmed = String(item?.url || '').trim();
    if (!trimmed) {
      errors.push(
        `الرابط الإلكتروني (${index + 1}) فارغ — يرجى إدخال رابط إلكتروني صحيح يبدأ بـ https:// أو حذف خانة الرابط.`
      );
    } else if (!isValidElectronicUrl(trimmed)) {
      errors.push(
        `صيغة الرابط الإلكتروني (${index + 1}) غير صحيحة — يرجى إدخال رابط صالح يبدأ بـ https:// أو http://.`
      );
    }
  });
  return errors;
}

/**
 * Parses a non-negative integer string (e.g., student counts).
 * Returns `null` if empty, non-numeric, negative, or non-integer.
 */
export function parseStudentCount(raw: string): number | null {
  const normalized = normalizeDigitsToAscii(raw);
  if (!normalized) return null;
  if (!/^-?\d+$/.test(normalized)) return null;
  const val = Number(normalized);
  if (!Number.isSafeInteger(val)) return null;
  return val;
}

/**
 * Parses a flexible positive numeric score (e.g., 20, 30, 40, 15.5).
 * Returns `null` if empty, non-numeric, or <= 0.
 */
export function parseFlexibleScore(raw: string): number | null {
  const normalized = normalizeDigitsToAscii(raw).replace(',', '.');
  if (!normalized) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const val = Number(normalized);
  if (!Number.isFinite(val)) return null;
  return val;
}

export interface StudentCountCalculationResult {
  targetCount: number | null;
  completedOrPerformedCount: number | null;
  remainingCount: number | null; // الغائبين أو الذين لم ينجزوا المهمة
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Calculates the remaining students count (`target - performedOrCompleted`)
 * and validates that counts are non-negative and `performedOrCompleted <= target`.
 */
export function calculateRemainingStudentsCount(
  targetRaw: string,
  actualRaw: string,
  actualLabel: 'المؤدين' | 'المنجزين'
): StudentCountCalculationResult {
  const target = parseStudentCount(targetRaw);
  const actual = parseStudentCount(actualRaw);

  if (target === null && actual === null) {
    return {
      targetCount: null,
      completedOrPerformedCount: null,
      remainingCount: null,
      isValid: false,
      errorMessage: 'يرجى إدخال عدد الطلاب المستهدفين وعدد الطلاب ' + actualLabel + '.',
    };
  }

  if (target === null) {
    return {
      targetCount: null,
      completedOrPerformedCount: actual,
      remainingCount: null,
      isValid: false,
      errorMessage: 'يرجى إدخال عدد صحيح لعدد الطلاب المستهدفين.',
    };
  }

  if (target < 0) {
    return {
      targetCount: target,
      completedOrPerformedCount: actual,
      remainingCount: null,
      isValid: false,
      errorMessage: 'لا يمكن أن يكون عدد الطلاب المستهدفين رقماً سالباً.',
    };
  }

  if (target === 0) {
    return {
      targetCount: target,
      completedOrPerformedCount: actual,
      remainingCount: null,
      isValid: false,
      errorMessage: 'يجب أن يكون عدد الطلاب المستهدفين أكبر من الصفر.',
    };
  }

  if (actual === null) {
    return {
      targetCount: target,
      completedOrPerformedCount: null,
      remainingCount: null,
      isValid: false,
      errorMessage: `يرجى إدخال عدد صحيح لعدد الطلاب ${actualLabel}.`,
    };
  }

  if (actual < 0) {
    return {
      targetCount: target,
      completedOrPerformedCount: actual,
      remainingCount: null,
      isValid: false,
      errorMessage: `لا يمكن أن يكون عدد الطلاب ${actualLabel} رقماً سالباً.`,
    };
  }

  if (actual > target) {
    return {
      targetCount: target,
      completedOrPerformedCount: actual,
      remainingCount: null,
      isValid: false,
      errorMessage: `لا يمكن أن يتجاوز عدد الطلاب ${actualLabel} (${actual}) عدد الطلاب المستهدفين (${target}).`,
    };
  }

  return {
    targetCount: target,
    completedOrPerformedCount: actual,
    remainingCount: target - actual,
    isValid: true,
  };
}

export function resolveInternalTestCategoryText(
  category: InternalTestCategoryOption,
  customCategory: string
): string {
  if (category === 'تصنيف آخر') {
    return customCategory.trim() || 'تصنيف آخر';
  }
  return category;
}

export function resolvePerformanceTaskTypeText(
  taskType: PerformanceTaskTypeOption,
  customTaskType: string
): string {
  if (taskType === 'أخرى') {
    return customTaskType.trim() || 'أخرى';
  }
  return taskType;
}

// ============================================================================
// Initial & Sample States
// ============================================================================

export function createInitialTestOrEvaluationState(
  formId: TeacherTestsAndEvaluationFormId,
  settings: SchoolSettings
): AnyTeacherTestOrEvaluationFormState {
  const defaultSubject =
    settings.roles?.teacher?.replace(/^معلم(?:ة)?\s+/, '').trim() || '';

  if (formId === 'internal-test-execution') {
    return {
      formId: 'internal-test-execution',
      testName: '',
      subject: defaultSubject,
      stage: 'المرحلة المتوسطة',
      grade: '',
      testCategory: 'اختبار تقويمي خلال الفترة الدراسية',
      customTestCategory: '',
      executionDate: '',
      maxScore: '',
      targetStudentsCount: '',
      performedStudentsCount: '',
      executionMethod: 'ورقي',
      additionalNotes: '',
      evidencePhotos: [],
      evidenceLinks: [],
    };
  }

  return {
    formId: 'performance-task-execution',
    taskName: '',
    subject: defaultSubject,
    stage: 'المرحلة المتوسطة',
    grade: '',
    executionDateOrPeriod: '',
    taskType: 'مشروع',
    customTaskType: '',
    targetStudentsCount: '',
    completedStudentsCount: '',
    taskGoal: '',
    taskDescriptionAndMechanism: '',
    evaluationMethod: '',
    additionalNotes: '',
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

export function createSampleTestOrEvaluationState(
  formId: TeacherTestsAndEvaluationFormId,
  settings: SchoolSettings
): AnyTeacherTestOrEvaluationFormState {
  const defaultSubject =
    settings.roles?.teacher?.replace(/^معلم(?:ة)?\s+/, '').trim() || 'الرياضيات';

  if (formId === 'internal-test-execution') {
    return {
      formId: 'internal-test-execution',
      testName: 'الاختبار التقويمي الأول لوحدة الجبر والمعادلات الخطية',
      subject: defaultSubject,
      stage: 'المرحلة المتوسطة',
      grade: 'الصف الثاني المتوسط',
      testCategory: 'اختبار تقويمي خلال الفترة الدراسية',
      customTestCategory: '',
      executionDate: '١٤٤٧/٠٨/٢٥هـ',
      maxScore: '20',
      targetStudentsCount: '32',
      performedStudentsCount: '30',
      executionMethod: 'ورقي',
      additionalNotes:
        'تم تنفيذ الاختبار داخل الحصة الدراسية في بيئة صفية هادئة ومنظمة مع مراعاة الزمن المخصص للإجابة.',
      evidencePhotos: [],
      evidenceLinks: [],
    };
  }

  return {
    formId: 'performance-task-execution',
    taskName: 'تصميم نماذج هندسية تطبيقية لحساب المساحات والحجوم في واقع الحياة',
    subject: defaultSubject,
    stage: 'المرحلة المتوسطة',
    grade: 'الصف الثاني المتوسط',
    executionDateOrPeriod: 'الأسبوع الرابع — من ١٤٤٧/٠٨/٢١هـ إلى ١٤٤٧/٠٨/٢٥هـ',
    taskType: 'مشروع',
    customTaskType: '',
    targetStudentsCount: '32',
    completedStudentsCount: '29',
    taskGoal:
      'تمكين الطلاب من توظيف قوانين المساحة والحجم عملياً في قياس وتصميم مجسمات هندسية من البيئة المحيطة وربط المفاهيم الرياضية بالتطبيق العملي.',
    taskDescriptionAndMechanism:
      'تم تقسيم الطلاب إلى مجموعات عمل صغيرة، وكُلفت كل مجموعة باختيار مجسم هندسي مركب من واقع الحياة، وأخذ القياسات الفعلية له، ثم بناء نموذج مصغر مرفق ببطاقة توضح خطوات حساب المساحة الكلية والحجم وعرضه أمام الزملاء في الصف.',
    evaluationMethod:
      'تم تقويم أداء الطلاب من خلال ملاحظة دقة القياسات وصحة خطوات التطبيق العملي للقوانين الهندسية وجودة المنتج النهائي ومشاركة أفراد المجموعة أثناء العرض الصفي.',
    additionalNotes:
      'أبدى الطلاب تفاعلاً متميزاً في ربط المفاهيم النظرية بالتطبيقات العملية وتم عرض النماذج المنجزة في ركن المادة بالمدرسة.',
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

// ============================================================================
// Validation
// ============================================================================

export function validateTestOrEvaluationState(
  state: AnyTeacherTestOrEvaluationFormState
): string[] {
  const errors: string[] = [];

  if (state.formId === 'internal-test-execution') {
    if (!state.testName.trim()) {
      errors.push('يرجى إدخال اسم الاختبار.');
    }
    if (!state.subject.trim()) {
      errors.push('يرجى إدخال المادة الدراسية.');
    }
    if (!state.stage.trim()) {
      errors.push('يرجى إدخال المرحلة الدراسية.');
    }
    if (!state.grade.trim()) {
      errors.push('يرجى إدخال الصف الدراسي.');
    }
    if (
      state.testCategory === 'تصنيف آخر' &&
      !state.customTestCategory.trim()
    ) {
      errors.push('يرجى كتابة التصنيف المخصص للاختبار.');
    }
    if (!state.executionDate.trim()) {
      errors.push('يرجى إدخال تاريخ تنفيذ الاختبار.');
    }

    const parsedScore = parseFlexibleScore(state.maxScore);
    if (parsedScore === null || parsedScore <= 0) {
      errors.push(
        'يرجى إدخال قيمة رقمية صحيحة وموجبة للدرجة النهائية للاختبار (مثل 20 أو 30 أو 40).'
      );
    }

    const countCalc = calculateRemainingStudentsCount(
      state.targetStudentsCount,
      state.performedStudentsCount,
      'المؤدين'
    );
    if (!countCalc.isValid && countCalc.errorMessage) {
      errors.push(countCalc.errorMessage);
    }

    errors.push(...validateElectronicLinks(state.evidenceLinks || []));

    return errors;
  }

  // performance-task-execution validation
  if (!state.taskName.trim()) {
    errors.push('يرجى إدخال اسم المهمة الأدائية.');
  }
  if (!state.subject.trim()) {
    errors.push('يرجى إدخال المادة الدراسية.');
  }
  if (!state.stage.trim()) {
    errors.push('يرجى إدخال المرحلة الدراسية.');
  }
  if (!state.grade.trim()) {
    errors.push('يرجى إدخال الصف الدراسي.');
  }
  if (!state.executionDateOrPeriod.trim()) {
    errors.push('يرجى إدخال تاريخ التنفيذ أو الفترة.');
  }
  if (state.taskType === 'أخرى' && !state.customTaskType.trim()) {
    errors.push('يرجى كتابة نوع المهمة المخصص.');
  }

  const countCalc = calculateRemainingStudentsCount(
    state.targetStudentsCount,
    state.completedStudentsCount,
    'المنجزين'
  );
  if (!countCalc.isValid && countCalc.errorMessage) {
    errors.push(countCalc.errorMessage);
  }

  if (!state.taskGoal.trim()) {
    errors.push('يرجى إدخال هدف المهمة الأدائية.');
  }
  if (!state.taskDescriptionAndMechanism.trim()) {
    errors.push('يرجى إدخال وصف المهمة وآلية تنفيذها.');
  }
  if (!state.evaluationMethod.trim()) {
    errors.push('يرجى إدخال طريقة التقويم.');
  }

  errors.push(...validateElectronicLinks(state.evidenceLinks || []));

  return errors;
}

// ============================================================================
// Draft Persistence (localStorage)
// ============================================================================

const DRAFT_STORAGE_PREFIX = 'maktabi_teacher_tests_eval_draft_v1_';

export function loadTestOrEvaluationDraft(
  formId: TeacherTestsAndEvaluationFormId,
  settings: SchoolSettings
): AnyTeacherTestOrEvaluationFormState {
  const fallback = createInitialTestOrEvaluationState(formId, settings);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(
      `${DRAFT_STORAGE_PREFIX}${formId}`
    );
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.formId !== formId) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveTestOrEvaluationDraft(
  state: AnyTeacherTestOrEvaluationFormState
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${DRAFT_STORAGE_PREFIX}${state.formId}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function clearTestOrEvaluationDraft(
  formId: TeacherTestsAndEvaluationFormId
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${formId}`);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Convert Form State to Shared TeacherReportDocument (teacherPdfEngine)
// ============================================================================

export function buildTeacherTestOrEvaluationDocument(
  state: AnyTeacherTestOrEvaluationFormState,
  settings: SchoolSettings,
  overrides?: {
    templateStyle?: TeacherPdfTemplateStyle;
    colorSystem?: TeacherPdfColorSystem;
  }
): TeacherReportDocument {
  const templateStyle: TeacherPdfTemplateStyle =
    overrides?.templateStyle ?? settings.teacherPdfTemplate ?? 'waves';
  const colorSystem: TeacherPdfColorSystem =
    overrides?.colorSystem ?? settings.teacherPdfColorSystem ?? 'green';
  const principalName = settings.principalName?.trim() || '';

  const validPhotos = (state.evidencePhotos || [])
    .filter((p) => Boolean(p && p.imageDataUrl && p.imageDataUrl.trim()))
    .slice(0, 2);

  // Only include non-empty, valid URLs so no empty or invalid QR frame ever appears
  const validLinks: TeacherReportEvidenceLink[] = (state.evidenceLinks || [])
    .filter((l) => Boolean(l && l.url && isValidElectronicUrl(l.url)))
    .slice(0, 2)
    .map((l, idx) => ({
      id: l.id || `${state.formId}-link-${idx + 1}`,
      url: l.url.trim(),
    }));

  if (state.formId === 'internal-test-execution') {
    const resolvedCategory = resolveInternalTestCategoryText(
      state.testCategory,
      state.customTestCategory
    );
    const parsedScore = parseFlexibleScore(state.maxScore);
    const scoreDisplay =
      parsedScore !== null && parsedScore > 0
        ? String(parsedScore)
        : state.maxScore.trim() || 'غير محدد';

    const countCalc = calculateRemainingStudentsCount(
      state.targetStudentsCount,
      state.performedStudentsCount,
      'المؤدين'
    );

    const targetDisplay =
      countCalc.targetCount !== null
        ? String(countCalc.targetCount)
        : state.targetStudentsCount.trim() || 'غير محدد';
    const performedDisplay =
      countCalc.completedOrPerformedCount !== null
        ? String(countCalc.completedOrPerformedCount)
        : state.performedStudentsCount.trim() || 'غير محدد';
    const absentDisplay =
      countCalc.remainingCount !== null
        ? String(countCalc.remainingCount)
        : '0';

    const basicFields: TeacherReportBasicField[] = [
      {
        id: 'ite-subject',
        label: 'المادة الدراسية',
        value: state.subject.trim() || 'غير محدد',
        width: 'third',
      },
      {
        id: 'ite-stage',
        label: 'المرحلة الدراسية',
        value: state.stage.trim() || 'غير محدد',
        width: 'third',
      },
      {
        id: 'ite-grade',
        label: 'الصف',
        value: state.grade.trim() || 'غير محدد',
        width: 'third',
      },
      {
        id: 'ite-category',
        label: 'تصنيف الاختبار',
        value: resolvedCategory,
        width: 'half',
      },
      {
        id: 'ite-date',
        label: 'تاريخ تنفيذ الاختبار',
        value: state.executionDate.trim() || 'غير محدد',
        width: 'half',
      },
    ];

    const sections: TeacherReportContentSection[] = [
      {
        id: 'ite-execution-details-section',
        title: 'بيانات تنفيذ الاختبار وإحصاءات الحضور',
        type: 'fields',
        fields: [
          {
            id: 'ite-max-score',
            label: 'الدرجة النهائية للاختبار',
            value: scoreDisplay,
            width: 'half',
          },
          {
            id: 'ite-method',
            label: 'طريقة تنفيذ الاختبار',
            value: state.executionMethod,
            width: 'half',
          },
          {
            id: 'ite-target-count',
            label: 'عدد الطلاب المستهدفين',
            value: targetDisplay,
            width: 'half',
          },
          {
            id: 'ite-performed-count',
            label: 'عدد الطلاب الذين أدوا الاختبار',
            value: performedDisplay,
            width: 'half',
          },
          {
            id: 'ite-absent-count',
            label: 'عدد الغائبين',
            value: absentDisplay,
            width: 'full',
          },
        ],
      },
    ];

    // لا تعرض الملاحظات الإضافية في ملف PDF إذا تركها المعلم فارغة
    const trimmedNotes = state.additionalNotes.trim();
    if (trimmedNotes) {
      sections.push({
        id: 'ite-additional-notes-section',
        title: 'ملاحظات إضافية',
        type: 'text',
        content: trimmedNotes,
      });
    }

    return {
      reportTypeLabel: 'تقرير تنفيذ اختبار داخلي',
      reportMainTitle: state.testName.trim() || 'تقرير تنفيذ اختبار داخلي',
      templateStyle,
      colorSystem,
      basicFields,
      sections,
      evidencePhotos: validPhotos,
      evidenceLinks: validLinks,
      executorName: settings.userName?.trim() || '',
      nationalId: '',
      signatureDataUrl: '',
      principalName,
      includePrincipalSignoff: Boolean(principalName),
    };
  }

  // ============================================================================
  // النموذج الثاني: تقرير تنفيذ مهمة أدائية (Performance Task Execution Report)
  // ============================================================================
  const resolvedTaskType = resolvePerformanceTaskTypeText(
    state.taskType,
    state.customTaskType
  );

  const countCalc = calculateRemainingStudentsCount(
    state.targetStudentsCount,
    state.completedStudentsCount,
    'المنجزين'
  );

  const targetDisplay =
    countCalc.targetCount !== null
      ? String(countCalc.targetCount)
      : state.targetStudentsCount.trim() || 'غير محدد';
  const completedDisplay =
    countCalc.completedOrPerformedCount !== null
      ? String(countCalc.completedOrPerformedCount)
      : state.completedStudentsCount.trim() || 'غير محدد';
  const notCompletedDisplay =
    countCalc.remainingCount !== null ? String(countCalc.remainingCount) : '0';

  const basicFields: TeacherReportBasicField[] = [
    {
      id: 'pte-subject',
      label: 'المادة الدراسية',
      value: state.subject.trim() || 'غير محدد',
      width: 'third',
    },
    {
      id: 'pte-stage',
      label: 'المرحلة الدراسية',
      value: state.stage.trim() || 'غير محدد',
      width: 'third',
    },
    {
      id: 'pte-grade',
      label: 'الصف',
      value: state.grade.trim() || 'غير محدد',
      width: 'third',
    },
    {
      id: 'pte-type',
      label: 'نوع المهمة',
      value: resolvedTaskType,
      width: 'half',
    },
    {
      id: 'pte-date',
      label: 'تاريخ التنفيذ أو الفترة',
      value: state.executionDateOrPeriod.trim() || 'غير محدد',
      width: 'half',
    },
  ];

  const sections: TeacherReportContentSection[] = [
    {
      id: 'pte-counts-section',
      title: 'إحصاءات تنفيذ المهمة الأدائية',
      type: 'fields',
      fields: [
        {
          id: 'pte-target-count',
          label: 'عدد الطلاب المستهدفين',
          value: targetDisplay,
          width: 'half',
        },
        {
          id: 'pte-completed-count',
          label: 'عدد الطلاب الذين أنجزوا المهمة',
          value: completedDisplay,
          width: 'half',
        },
        {
          id: 'pte-not-completed-count',
          label: 'عدد الطلاب الذين لم ينجزوها',
          value: notCompletedDisplay,
          width: 'full',
        },
      ],
    },
    {
      id: 'pte-details-section',
      title: 'تفاصيل المهمة الأدائية وطريقة تقويمها',
      type: 'fields',
      fields: [
        {
          id: 'pte-goal',
          label: 'هدف المهمة',
          value: state.taskGoal.trim() || 'غير محدد',
          width: 'full',
          isLongText: true,
        },
        {
          id: 'pte-desc',
          label: 'وصف المهمة وآلية تنفيذها',
          value: state.taskDescriptionAndMechanism.trim() || 'غير محدد',
          width: 'full',
          isLongText: true,
        },
        {
          id: 'pte-eval-method',
          label: 'طريقة التقويم',
          value: state.evaluationMethod.trim() || 'غير محدد',
          width: 'full',
          isLongText: true,
        },
      ],
    },
  ];

  // لا تعرض الملاحظات الإضافية في ملف PDF إذا تركها المعلم فارغة
  const trimmedNotes = state.additionalNotes.trim();
  if (trimmedNotes) {
    sections.push({
      id: 'pte-additional-notes-section',
      title: 'ملاحظات إضافية',
      type: 'text',
      content: trimmedNotes,
    });
  }

  return {
    reportTypeLabel: 'تقرير تنفيذ مهمة أدائية',
    reportMainTitle: state.taskName.trim() || 'تقرير تنفيذ مهمة أدائية',
    templateStyle,
    colorSystem,
    basicFields,
    sections,
    evidencePhotos: validPhotos,
    evidenceLinks: validLinks,
    executorName: settings.userName?.trim() || '',
    nationalId: '',
    signatureDataUrl: '',
    principalName,
    includePrincipalSignoff: Boolean(principalName),
  };
}
