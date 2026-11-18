import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import { formatGregorianToUmmAlQuraHijri } from './formEngine';
import { getGenderedLabels } from './settingsStorage';
import {
  TeacherReportBasicField,
  TeacherReportContentSection,
  TeacherReportDocument,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from './teacherPdfEngine';

export const TEACHER_REPORTS_STORAGE_KEY = 'maktabi_teacher_reports_v1';

export type TeacherProfessionalReportId =
  | 'strategy-implementation'
  | 'problem-remediation'
  | 'learning-outcomes-analysis'
  | 'distinguished-practice'
  | 'professional-achievement';

export interface TeacherReportMetadata {
  id: TeacherProfessionalReportId;
  number: number;
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  highlights: string[];
}

export const TEACHER_PROFESSIONAL_REPORTS_GROUP = {
  id: 'professional-educational-reports',
  title: 'التقارير المهنية والتعليمية',
  subtitle: 'مجموعة النماذج المعتمدة لتوثيق الممارسات التدريسية ونواتج التعلم والإنجاز المهني',
  description:
    'خمسة نماذج تخصصية مستقلة مرتبطة بمحرك PDF الموحد لقسم المعلم، تدعم القوالب البصرية الثلاثة وأنظمة الألوان الثلاثة ونظام الشواهد ورموز QR.',
};

export type TeacherPlansPathId = 'teacher-plans' | 'student-plans';

export interface TeacherPlansPathMetadata {
  id: TeacherPlansPathId;
  title: string;
  badge: string;
  description: string;
  highlights: string[];
}

export const TEACHER_PLANS_GROUP = {
  id: 'teacher-plans-group',
  title: 'الخطط',
  subtitle: 'المجموعة المعتمدة لخطط المعلم وخطط الطلاب',
  description:
    'تنظيم وتوثيق خطط التدريس والمناهج والخطط العلاجية والإثرائية للطلاب وفق أطر تخطيطية منظمة.',
};

export const TEACHER_PLANS_PATHS: TeacherPlansPathMetadata[] = [
  {
    id: 'teacher-plans',
    title: 'خطط المعلم',
    badge: 'مسار معتمد',
    description:
      'الخطط الخاصة بأداء المعلم والخطط التدريسية والفصلية والأسبوعية وتوزيع المنهج والدروس والأنشطة.',
    highlights: [
      'خطط المنهج وتوزيع الحصص الدراسية',
      'خطط الأنشطة والدروس التطبيقية',
      'توثيق ومتابعة تنفيذ الخطط المدرسية',
    ],
  },
  {
    id: 'student-plans',
    title: 'خطط المعلم للطلاب',
    badge: 'مسار معتمد',
    description:
      'الخطط الموجهة لدعم الطلاب وتطوير مستوياتهم، وتشمل الخطط العلاجية والإثرائية ومتابعة الفروق الفردية.',
    highlights: [
      'الخطط العلاجية للطلاب منخفضي التحصيل',
      'الخطط الإثرائية للطلاب المتميزين',
      'خطط المتابعة الفردية والجماعية للطلاب',
    ],
  },
];

export const TEACHER_PROFESSIONAL_REPORTS_CATALOG: TeacherReportMetadata[] = [
  {
    id: 'strategy-implementation',
    number: 1,
    title: 'تقرير تنفيذ استراتيجية تعليمية',
    shortTitle: 'تنفيذ استراتيجية تعليمية',
    badge: 'نموذج ١',
    description:
      'توثيق تطبيق استراتيجية تدريسية داخل الحصة، وتحديد المادة والدرس وأهداف الاستراتيجية والوسائل وآلية التنفيذ والشواهد.',
    highlights: [
      'بيانات الاستراتيجية والمادة والمرحلة والصف والدرس',
      'أهداف الاستراتيجية والأدوات والوسائل التعليمية',
      'آلية تنفيذ الاستراتيجية داخل الحصة مع الشواهد',
    ],
  },
  {
    id: 'problem-remediation',
    number: 2,
    title: 'تقرير معالجة مشكلة تعليمية',
    shortTitle: 'معالجة مشكلة تعليمية',
    badge: 'نموذج ٢',
    description:
      'تشخيص مشكلة تعليمية لطالب أو مجموعة طلاب أو الصف كاملًا، وتوثيق أسبابها وخطة المعالجة ومستوى التحسن البعدي والتوصيات.',
    highlights: [
      'تحديد الفئة المستهدفة: طالب واحد / مجموعة / الصف كاملًا',
      'تشخيص المشكلة وأسبابها والمستوى القبلي للطلاب',
      'خطة المعالجة وخطوات التنفيذ والمستوى البعدي والتوصيات',
    ],
  },
  {
    id: 'learning-outcomes-analysis',
    number: 3,
    title: 'تقرير تحليل نتائج التعلم',
    shortTitle: 'تحليل نتائج التعلم',
    badge: 'نموذج ٣',
    description:
      'تحليل نتائج الطلاب في اختبار واحد أو خلال فصل دراسي كامل، مع حساب آلي لنسب مستويات الأداء الخمسة والتحقق من مطابقة المجموع.',
    highlights: [
      'نطاق التحليل: اختبار واحد أو فصل دراسي كامل بحقول شرطية',
      'حساب آلي للنسب المئوية لمستويات الأداء الخمسة والتحقق من المجموع',
      'جوانب القوة والضعف وأبرز الملاحظات والإجراءات والتوصيات',
    ],
  },
  {
    id: 'distinguished-practice',
    number: 4,
    title: 'تقرير ممارسة تعليمية متميزة',
    shortTitle: 'ممارسة تعليمية متميزة',
    badge: 'نموذج ٤',
    description:
      'توثيق ممارسة تعليمية متميزة نُفذت فعليًا، وبيان فكرتها ودوافعها والتحدي الذي عالجته وآلية تنفيذها وأثرها على تعلم الطلاب وإمكانية تعميمها.',
    highlights: [
      'مخصص لممارسة نُفذت بالفعل مع توثيق الفكرة والدوافع والتحدي',
      'الأهداف وآلية التنفيذ والأدوات والنتائج المحققة',
      'أثر الممارسة على تعلم الطلاب وإمكانية الاستمرار أو التعميم',
    ],
  },
  {
    id: 'professional-achievement',
    number: 5,
    title: 'تقرير إنجاز مهني',
    shortTitle: 'إنجاز مهني',
    badge: 'نموذج ٥',
    description:
      'توثيق إنجاز مهني للمعلم (مورد تعليمي، محتوى رقمي، حقيبة، أداة تقويم، أو إنجاز آخر) مع وصفه والهدف منه والفئة المستفيدة وأثره.',
    highlights: [
      'قائمة أنواع الإنجاز المعتمدة مع حقل شرطي عند اختيار «إنجاز آخر»',
      'حقول المادة والمرحلة والصف اختيارية لا تظهر إن تُركت فارغة',
      'وصف الإنجاز والهدف منه والفئة المستفيدة والنتائج والأثر',
    ],
  },
];

// ============================================================================
// 1. تقرير تنفيذ استراتيجية تعليمية
// ============================================================================
export interface StrategyImplementationReportData {
  formId: 'strategy-implementation';
  reportTitle: string;
  strategyName: string;
  subject: string;
  executionDate: string;
  stage: string;
  grade: string;
  studentsCount: string;
  lessonTopic: string;
  strategyObjectives: string;
  educationalTools: string;
  classroomMechanism: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
  teacherName: string;
}

// ============================================================================
// 2. تقرير معالجة مشكلة تعليمية
// ============================================================================
export type ProblemTargetCategory =
  | 'طالب واحد'
  | 'مجموعة من الطلاب'
  | 'الصف كاملًا';

export const PROBLEM_TARGET_CATEGORIES: ProblemTargetCategory[] = [
  'طالب واحد',
  'مجموعة من الطلاب',
  'الصف كاملًا',
];

export interface EducationalProblemRemediationReportData {
  formId: 'problem-remediation';
  subject: string;
  grade: string;
  targetCategory: ProblemTargetCategory;
  remediationTopic: string;
  executionLocation: string;
  executionDate: string;
  executionDuration: string;
  problemDescription: string;
  probableCauses: string;
  preRemediationLevel: string;
  objectives: string;
  executionSteps: string;
  postRemediationLevel: string;
  recommendations: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
  teacherName: string;
}

// ============================================================================
// 3. تقرير تحليل نتائج التعلم
// ============================================================================
export type LearningAnalysisScope = 'single-exam' | 'full-semester';

export const SEMESTER_ASSESSMENT_METHODS_OPTIONS: string[] = [
  'الاختبارات القصيرة الدورية',
  'المهام الأدائية والمشاريع الصفية',
  'التقويم المستمر والمشاركة الصفية',
  'الواجبات وأوراق العمل التطبيقية',
  'الاختبار النهائي للفصل الدراسي',
];

export interface LearningOutcomesAnalysisReportData {
  formId: 'learning-outcomes-analysis';
  analysisScope: LearningAnalysisScope;
  subject: string;
  stage: string;
  grade: string;
  semester: string;
  totalStudentsCount: string;
  // Conditional: when analysisScope === 'single-exam'
  examName: string;
  applicationDate: string;
  // Conditional: when analysisScope === 'full-semester'
  semesterAssessmentTools: string[];
  semesterCalculationMethod: string;
  semesterAssessmentsSummary: string;
  // Performance levels distribution (student counts)
  excellentCount: string;
  veryGoodCount: string;
  goodCount: string;
  acceptableCount: string;
  weakCount: string;
  // Analysis sections
  strengths: string;
  weaknesses: string;
  keyObservations: string;
  actionsAndRecommendations: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
  teacherName: string;
}

// ============================================================================
// 4. تقرير ممارسة تعليمية متميزة
// ============================================================================
export type PracticeSustainabilityOption =
  | 'قابلة للاستمرار'
  | 'قابلة للتعميم على معلمين آخرين'
  | 'قابلة للتطوير'
  | 'لا ينطبق';

export const PRACTICE_SUSTAINABILITY_OPTIONS: PracticeSustainabilityOption[] = [
  'قابلة للاستمرار',
  'قابلة للتعميم على معلمين آخرين',
  'قابلة للتطوير',
  'لا ينطبق',
];

export interface DistinguishedPracticeReportData {
  formId: 'distinguished-practice';
  practiceName: string;
  subject: string;
  stage: string;
  grade: string;
  applicationDuration: string;
  applicationDate: string;
  targetGroup: string;
  applicationLocation: string;
  practiceIdea: string;
  applicationMotives: string;
  addressedChallenge: string;
  objectives: string;
  executionMechanism: string;
  toolsAndMeans: string;
  achievedResults: string;
  impactOnStudentLearning: string;
  sustainabilityOption: PracticeSustainabilityOption;
  recommendations: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
  teacherName: string;
}

// ============================================================================
// 5. تقرير إنجاز مهني
// ============================================================================
export type ProfessionalAchievementType =
  | 'إعداد وسيلة أو مورد تعليمي'
  | 'إنتاج محتوى تعليمي رقمي'
  | 'إعداد أوراق عمل أو حقيبة تعليمية'
  | 'تطوير مادة أو محتوى تعليمي'
  | 'تصميم أداة تقويم أو قياس تعلم'
  | 'إعداد مادة تعليمية تخدم المعلمين أو الطلاب'
  | 'إنجاز آخر';

export const PROFESSIONAL_ACHIEVEMENT_TYPES: ProfessionalAchievementType[] = [
  'إعداد وسيلة أو مورد تعليمي',
  'إنتاج محتوى تعليمي رقمي',
  'إعداد أوراق عمل أو حقيبة تعليمية',
  'تطوير مادة أو محتوى تعليمي',
  'تصميم أداة تقويم أو قياس تعلم',
  'إعداد مادة تعليمية تخدم المعلمين أو الطلاب',
  'إنجاز آخر',
];

export interface ProfessionalAchievementReportData {
  formId: 'professional-achievement';
  achievementName: string;
  achievementType: ProfessionalAchievementType;
  customAchievementType: string; // Conditional: only when achievementType === 'إنجاز آخر'
  subject: string; // Optional
  stage: string; // Optional
  grade: string; // Optional
  achievementDate: string;
  achievementDescription: string;
  achievementObjective: string;
  beneficiaryGroup: string;
  resultsAndImpact: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
  teacherName: string;
}

export type AnyTeacherProfessionalReportData =
  | StrategyImplementationReportData
  | EducationalProblemRemediationReportData
  | LearningOutcomesAnalysisReportData
  | DistinguishedPracticeReportData
  | ProfessionalAchievementReportData;

export interface TeacherReportFormMap {
  'strategy-implementation': StrategyImplementationReportData;
  'problem-remediation': EducationalProblemRemediationReportData;
  'learning-outcomes-analysis': LearningOutcomesAnalysisReportData;
  'distinguished-practice': DistinguishedPracticeReportData;
  'professional-achievement': ProfessionalAchievementReportData;
}

export const STAGE_OPTIONS: string[] = [
  'المرحلة الابتدائية',
  'المرحلة المتوسطة',
  'المرحلة الثانوية',
];

export const SEMESTER_OPTIONS: string[] = [
  'الفصل الدراسي الأول',
  'الفصل الدراسي الثاني',
];

// ============================================================================
// Helper: Parse Arabic-Indic and ASCII non-negative integers
// ============================================================================
export function parseNonNegativeInt(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let str = String(raw).trim();
  if (!str) return null;
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i));
  }
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num < 0) return null;
  return num;
}

export interface LearningLevelItemSummary {
  key: 'excellent' | 'veryGood' | 'good' | 'acceptable' | 'weak';
  label: string;
  rawCount: string;
  count: number;
  percentage: number;
  formattedPercentage: string;
}

export interface LearningLevelsDistributionResult {
  totalStudents: number | null;
  sumOfLevels: number;
  hasAnyLevelInput: boolean;
  allLevelsEntered: boolean;
  isMatched: boolean;
  difference: number;
  statusMessage: string;
  levels: LearningLevelItemSummary[];
}

/**
 * Automatically calculates percentages for the 5 performance levels
 * (`ممتاز`, `جيد جدًا`, `جيد`, `مقبول`, `ضعيف`) and checks whether their sum
 * matches the total number of students (`عدد الطلاب`).
 */
export function computeLearningLevelsDistribution(
  data: Pick<
    LearningOutcomesAnalysisReportData,
    | 'totalStudentsCount'
    | 'excellentCount'
    | 'veryGoodCount'
    | 'goodCount'
    | 'acceptableCount'
    | 'weakCount'
  >
): LearningLevelsDistributionResult {
  const totalParsed = parseNonNegativeInt(data.totalStudentsCount);
  const rawEntries: Array<{
    key: LearningLevelItemSummary['key'];
    label: string;
    raw: string;
  }> = [
    { key: 'excellent', label: 'ممتاز', raw: data.excellentCount },
    { key: 'veryGood', label: 'جيد جدًا', raw: data.veryGoodCount },
    { key: 'good', label: 'جيد', raw: data.goodCount },
    { key: 'acceptable', label: 'مقبول', raw: data.acceptableCount },
    { key: 'weak', label: 'ضعيف', raw: data.weakCount },
  ];

  let sumOfLevels = 0;
  let enteredCount = 0;

  const parsedCounts = rawEntries.map((entry) => {
    const parsed = parseNonNegativeInt(entry.raw);
    if (parsed !== null) {
      sumOfLevels += parsed;
      enteredCount++;
      return parsed;
    }
    return 0;
  });

  const hasAnyLevelInput = enteredCount > 0;
  const allLevelsEntered = enteredCount === rawEntries.length;

  const denominator =
    totalParsed !== null && totalParsed > 0
      ? totalParsed
      : sumOfLevels > 0
        ? sumOfLevels
        : 0;

  const formatPct = (pct: number): string => {
    if ( denominator === 0 ) return '0%';
    const rounded = Math.round(pct * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
  };

  const levels: LearningLevelItemSummary[] = rawEntries.map((entry, idx) => {
    const count = parsedCounts[idx];
    const pct = denominator > 0 ? (count / denominator) * 100 : 0;
    return {
      key: entry.key,
      label: entry.label,
      rawCount: entry.raw,
      count,
      percentage: Math.round(pct * 10) / 10,
      formattedPercentage: formatPct(pct),
    };
  });

  const isMatched =
    totalParsed !== null &&
    totalParsed > 0 &&
    hasAnyLevelInput &&
    sumOfLevels === totalParsed;

  const difference =
    totalParsed !== null ? totalParsed - sumOfLevels : -sumOfLevels;

  let statusMessage = '';
  if (totalParsed === null || totalParsed <= 0) {
    statusMessage = 'أدخل إجمالي عدد الطلاب لحساب النسب المئوية والتحقق من المجموع.';
  } else if (!hasAnyLevelInput) {
    statusMessage = `إجمالي الطلاب (${totalParsed}) — أدخل أعداد الطلاب في المستويات الخمسة.`;
  } else if (sumOfLevels === totalParsed) {
    statusMessage = `مجموع الطلاب في المستويات الخمسة (${sumOfLevels}) مطابق لإجمالي عدد الطلاب (${totalParsed}) — النسبة الإجمالية 100%.`;
  } else if (sumOfLevels < totalParsed) {
    statusMessage = `تنبيه: مجموع الطلاب في المستويات (${sumOfLevels}) أقل من إجمالي عدد الطلاب (${totalParsed}) بفارق (${totalParsed - sumOfLevels}) طالب.`;
  } else {
    statusMessage = `تنبيه: مجموع الطلاب في المستويات (${sumOfLevels}) يتجاوز إجمالي عدد الطلاب (${totalParsed}) بزيادة (${sumOfLevels - totalParsed}) طالب.`;
  }

  return {
    totalStudents: totalParsed,
    sumOfLevels,
    hasAnyLevelInput,
    allLevelsEntered,
    isMatched,
    difference,
    statusMessage,
    levels,
  };
}

// ============================================================================
// Initial Empty Form Values Builders
// ============================================================================
export function createInitialTeacherReportData<
  K extends TeacherProfessionalReportId,
>(formId: K, settings?: Partial<SchoolSettings>): TeacherReportFormMap[K] {
  const defaultTeacherName = settings?.userName?.trim() || '';

  switch (formId) {
    case 'strategy-implementation': {
      const data: StrategyImplementationReportData = {
        formId: 'strategy-implementation',
        reportTitle: 'تقرير تنفيذ استراتيجية تعليمية',
        strategyName: '',
        subject: '',
        executionDate: '',
        stage: '',
        grade: '',
        studentsCount: '',
        lessonTopic: '',
        strategyObjectives: '',
        educationalTools: '',
        classroomMechanism: '',
        evidencePhotos: [],
        evidenceLinks: [],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'problem-remediation': {
      const data: EducationalProblemRemediationReportData = {
        formId: 'problem-remediation',
        subject: '',
        grade: '',
        targetCategory: 'مجموعة من الطلاب',
        remediationTopic: '',
        executionLocation: '',
        executionDate: '',
        executionDuration: '',
        problemDescription: '',
        probableCauses: '',
        preRemediationLevel: '',
        objectives: '',
        executionSteps: '',
        postRemediationLevel: '',
        recommendations: '',
        evidencePhotos: [],
        evidenceLinks: [],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'learning-outcomes-analysis': {
      const data: LearningOutcomesAnalysisReportData = {
        formId: 'learning-outcomes-analysis',
        analysisScope: 'single-exam',
        subject: '',
        stage: '',
        grade: '',
        semester: 'الفصل الدراسي الأول',
        totalStudentsCount: '',
        examName: '',
        applicationDate: '',
        semesterAssessmentTools: [
          'الاختبارات القصيرة الدورية',
          'المهام الأدائية والمشاريع الصفية',
          'الاختبار النهائي للفصل الدراسي',
        ],
        semesterCalculationMethod:
          'احتساب المحصلة الختامية الموزونة لكل طالب في نهاية الفصل الدراسي وتصنيف كل طالب في مستوى أداء واحد فقط دون جمع أعداد الطلاب عبر التقويمات المتعددة.',
        semesterAssessmentsSummary: '',
        excellentCount: '',
        veryGoodCount: '',
        goodCount: '',
        acceptableCount: '',
        weakCount: '',
        strengths: '',
        weaknesses: '',
        keyObservations: '',
        actionsAndRecommendations: '',
        evidencePhotos: [],
        evidenceLinks: [],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'distinguished-practice': {
      const data: DistinguishedPracticeReportData = {
        formId: 'distinguished-practice',
        practiceName: '',
        subject: '',
        stage: '',
        grade: '',
        applicationDuration: '',
        applicationDate: '',
        targetGroup: '',
        applicationLocation: '',
        practiceIdea: '',
        applicationMotives: '',
        addressedChallenge: '',
        objectives: '',
        executionMechanism: '',
        toolsAndMeans: '',
        achievedResults: '',
        impactOnStudentLearning: '',
        sustainabilityOption: 'قابلة للتعميم على معلمين آخرين',
        recommendations: '',
        evidencePhotos: [],
        evidenceLinks: [],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'professional-achievement': {
      const data: ProfessionalAchievementReportData = {
        formId: 'professional-achievement',
        achievementName: '',
        achievementType: 'إنتاج محتوى تعليمي رقمي',
        customAchievementType: '',
        subject: '',
        stage: '',
        grade: '',
        achievementDate: '',
        achievementDescription: '',
        achievementObjective: '',
        beneficiaryGroup: '',
        resultsAndImpact: '',
        evidencePhotos: [],
        evidenceLinks: [],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }
  }
}

// ============================================================================
// Realistic Sample Data Builders (for instant testing & previewing)
// ============================================================================
export function createSampleTeacherReportFormData<
  K extends TeacherProfessionalReportId,
>(formId: K, settings?: Partial<SchoolSettings>): TeacherReportFormMap[K] {
  const defaultTeacherName =
    settings?.userName?.trim() || 'أ. عبدالرحمن بن صالح القحطاني';

  switch (formId) {
    case 'strategy-implementation': {
      const data: StrategyImplementationReportData = {
        formId: 'strategy-implementation',
        reportTitle: 'تقرير تنفيذ استراتيجية تعليمية',
        strategyName: 'التعلم التعاوني (المهام الأدائية)',
        subject: 'العلوم',
        executionDate: '2025-04-24',
        stage: 'المرحلة المتوسطة',
        grade: 'الثاني المتوسط',
        studentsCount: '28',
        lessonTopic: 'تفاعلات المادة وتغيرات الطاقة',
        strategyObjectives:
          'تنمية مهارات الاستقصاء العلمي والعمل التعاوني المنظم بين الطلاب.\nتمكين كل طالب من إتقان جزئية علمية محددة وشرحها لزملائه بدقة.\nرفع مستوى المشاركة الفاعلة داخل الحصة الدراسية.',
        educationalTools:
          'بطاقات المهام التخصصية — العرض التفاعلي — أوراق عمل جماعية — نماذج التجارب المعملية المبسطة.',
        classroomMechanism:
          'تم تقسيم طلاب الصف إلى مجموعات أم ومجموعات خبراء، وتوزيع محاور الدرس على مجموعات الخبراء لدراستها وتحليل التجارب المرتبطة بها خلال ١٢ دقيقة، ثم عاد كل خبير إلى مجموعته الأساسية لشرح محوره وتطبيق ورقة العمل الختامية بإشراف المعلم.',
        evidencePhotos: [],
        evidenceLinks: [
          {
            id: 'link-1',
            url: 'https://moe.gov.sa/ar/education/Pages/default.aspx',
          },
        ],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'problem-remediation': {
      const data: EducationalProblemRemediationReportData = {
        formId: 'problem-remediation',
        subject: 'الرياضيات',
        grade: 'الأول المتوسط',
        targetCategory: 'مجموعة من الطلاب',
        remediationTopic: 'ضعف مهارة العمليات على الكسور',
        executionLocation: 'مصادر التعلم والصف الدراسي',
        executionDate: '2025-04-20',
        executionDuration: 'ثلاثة أسابيع (٦ حصص مساندة)',
        problemDescription:
          'لوحظ تعثر مجموعة مكونة من ٧ طلاب في توحيد المقامات وإجراء عمليات الجمع والطرح والضرب على الكسور الاعتيادية والأعداد النسبية خلال التقويمات التشخيصية.',
        probableCauses:
          'ضعف تأسيس المهارات الحسابية الأساسية في جدول الضرب والمضاعف المشترك الأصغر.\nالحاجة إلى تمثيلات بصرية ومحسوسة تربط المفهوم المجرد بتطبيقاته العملية.',
        preRemediationLevel:
          'متوسط الإتقان في الاختبار التشخيصي القبلي بلغ ٤٢٪ مع أخطاء متكررة في توحيد المقامات.',
        objectives:
          'رفع نسبة إتقان الطلاب المستهدفين لمهارات العمليات على الأعداد النسبية إلى أكثر من ٨٥٪.\nتعزيز ثقة الطلاب بأنفسهم ومشاركتهم في حل التدريبات الصفية.',
        executionSteps:
          'إجراء اختبار تشخيصي دقيق لتحديد الفجوات المهارية لكل طالب.\nتوظيف النماذج البصرية المحسوسة والبطاقات التفاعلية لتوضيح مفهوم الكسور المتكافئة.\nتخصيص تدريبات متدرجة الصعوبة مع تغذية راجعة فورية وأقران مساندين.\nتطبيق تقويم بعدي لقياس مدى التحسن واستقرار المهارة.',
        postRemediationLevel:
          'ارتفع متوسط إتقان المجموعة المستهدفة في الاختبار البعدي إلى ٨٨٪ واجتاز جميع الطلاب المستهدفين معيار الإتقان المعتمد.',
        recommendations:
          'الاستمرار في تقديم تدريبات تنشيطية قصيرة مطلع كل وحدة دراسية.\nتفعيل التعلم بالأقران لمتابعة ثبات المهارات الأساسية لدى الطلاب.',
        evidencePhotos: [],
        evidenceLinks: [
          {
            id: 'link-1',
            url: 'https://ien.edu.sa/',
          },
        ],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'learning-outcomes-analysis': {
      const data: LearningOutcomesAnalysisReportData = {
        formId: 'learning-outcomes-analysis',
        analysisScope: 'single-exam',
        subject: 'لغتي الخالدة',
        stage: 'المرحلة المتوسطة',
        grade: 'الثالث المتوسط',
        semester: 'الفصل الدراسي الأول',
        totalStudentsCount: '30',
        examName: 'اختبار الفترة الأولى',
        applicationDate: '2025-04-18',
        semesterAssessmentTools: [
          'الاختبارات القصيرة الدورية',
          'المهام الأدائية والمشاريع الصفية',
          'الاختبار النهائي للفصل الدراسي',
        ],
        semesterCalculationMethod:
          'احتساب المحصلة الختامية الموزونة لكل طالب في نهاية الفصل الدراسي وتصنيف كل طالب في مستوى أداء واحد فقط دون جمع أعداد الطلاب عبر التقويمات المتعددة.',
        semesterAssessmentsSummary:
          'شمل التقويم الفصلي اختبارين فترتين ومهمتين أدائيتين والتقويم المستمر والاختبار النهائي وفق توزيع الدرجات المعتمد.',
        excellentCount: '12',
        veryGoodCount: '9',
        goodCount: '5',
        acceptableCount: '3',
        weakCount: '1',
        strengths:
          'إتقان متميز لمهارات الفهم القرائي واستخلاص الأفكار الرئيسة بنسبة تجاوزت ٩٠٪.\nتفاعل عالٍ مع أسئلة التحليل اللغوي والوظائف النحوية.',
        weaknesses:
          'حاجة عدد محدود من الطلاب إلى تعزيز مهارة الرسم الإملائي للكلمات المهموزة المتوسطة.',
        keyObservations:
          'حقق ٧٠٪ من طلاب الصف مستويي ممتاز وجيد جدًا، مما يعكس فاعلية الأنشطة التدريبية المنفذة قبل الاختبار.',
        actionsAndRecommendations:
          'تقديم أنشطة إثرائية متقدمة للطلاب الحاصلين على مستوى ممتاز (١٢ طالبًا).\nتنفيذ خطة علاجية مركزة في الرسم الإملائي للطلاب في مستويي مقبول وضعيف (٤ طلاب).',
        evidencePhotos: [],
        evidenceLinks: [
          {
            id: 'link-1',
            url: 'https://moe.gov.sa/ar/education/Pages/default.aspx',
          },
        ],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'distinguished-practice': {
      const data: DistinguishedPracticeReportData = {
        formId: 'distinguished-practice',
        practiceName: 'مختبر التحديات الرقمية التفاعلية',
        subject: 'الحاسب وتقنية المعلومات',
        stage: 'المرحلة الثانوية',
        grade: 'الأول الثانوي',
        applicationDuration: 'فصل دراسي كامل (٨ أسابيع)',
        applicationDate: '2025-04-15',
        targetGroup: 'طلاب الصف الأول الثانوي',
        applicationLocation: 'معمل الحاسب الآلي',
        practiceIdea:
          'تخصيص الدقائق الخمس الأولى من كل حصة لتحدٍ برمجي بصري قصير يربط الدرس السابق بالدرس الجديد ويحفز التفكير المنطقي.',
        applicationMotives:
          'رفع الجاهزية الذهنية للطلاب منذ بداية الحصة وتحويل المراجعة التقليدية إلى نشاط تطبيقي ممتع.',
        addressedChallenge:
          'تفاوت سرعة اندماج الطلاب في بداية الحصة العملية ونسيان بعض المفاهيم البرمجية السابقة.',
        objectives:
          'ترسيخ المفاهيم البرمجية التراكمية بصورة مستمرة.\nتنمية سرعة البديهة واكتشاف الأخطاء المنطقية في الشفرات البرمجية.',
        executionMechanism:
          'عرض بطاقة تحدٍ تحتوي على لغز برمجي قصير على الشاشة التفاعلية فور دخول الطلاب، وحل التحدي ثنائيًا خلال ٣ دقائق، ثم مناقشة الحلول المبتكرة خلال دقيقتين قبل الانطلاق في الدرس الجديد.',
        toolsAndMeans:
          'الشاشة التفاعلية — منصة التحديات البرمجية — بطاقات التقييم الفوري.',
        achievedResults:
          'ارتفاع معدل إنجاز المهام العملية داخل المعمل بنسبة ٣٥٪ وانضباط كامل للطلاب منذ الدقيقة الأولى للحصة.',
        impactOnStudentLearning:
          'تحسن ملموس في قدرة الطلاب على توظيف المهارات السابقة في بناء المشاريع البرمجية الجديدة بثقة واستقلالية.',
        sustainabilityOption: 'قابلة للتعميم على معلمين آخرين',
        recommendations:
          'تعميم نموذج التحديات الاستهلالية القصيرة على معلمي المواد العلمية والعملية في المدرسة.',
        evidencePhotos: [],
        evidenceLinks: [
          {
            id: 'link-1',
            url: 'https://ien.edu.sa/',
          },
        ],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }

    case 'professional-achievement': {
      const data: ProfessionalAchievementReportData = {
        formId: 'professional-achievement',
        achievementName: 'حقيبة الأنشطة وأدوات التقويم الرقمية',
        achievementType: 'إعداد أوراق عمل أو حقيبة تعليمية',
        customAchievementType: '',
        subject: 'العلوم',
        stage: 'المرحلة المتوسطة',
        grade: 'الثاني المتوسط',
        achievementDate: '2025-04-22',
        achievementDescription:
          'تصميم وبناء حقيبة تعليمية متكاملة تضم ٢٤ ورقة عمل تفاعلية و١٢ أداة تقويم بنائي رقمية مرتبطة بمعايير المنهج الدراسي ومزودة بمفاتيح الإجابة والنماذج الإرشادية.',
        achievementObjective:
          'توفير موارد تعليمية وأدوات قياس جاهزة وعالية الجودة تسهم في تجويد الممارسات التقويمية وتوفير وقت وجهد المعلمين والطلاب.',
        beneficiaryGroup: 'معلمو قسم العلوم وطلاب المرحلة المتوسطة بالمدرسة',
        resultsAndImpact:
          'تم اعتماد الحقيبة وتوظيفها في جميع فصول المرحلة المتوسطة، وأسهمت في توحيد معايير التقويم البنائي ورفع جودة التغذية الراجعة المقدمة للطلاب.',
        evidencePhotos: [],
        evidenceLinks: [
          {
            id: 'link-1',
            url: 'https://moe.gov.sa/ar/education/Pages/default.aspx',
          },
        ],
        teacherName: defaultTeacherName,
      };
      return data as TeacherReportFormMap[K];
    }
  }
}

// ============================================================================
// Validation Engine for Each of the 5 Independent Forms
// ============================================================================
export interface TeacherReportValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateTeacherProfessionalReport(
  data: AnyTeacherProfessionalReportData
): TeacherReportValidationResult {
  const errors: Record<string, string> = {};
  const req = (key: string, val: string, label: string) => {
    if (!val || !val.trim()) {
      errors[key] = `حقل «${label}» مطلوب.`;
    }
  };

  switch (data.formId) {
    case 'strategy-implementation': {
      req('reportTitle', data.reportTitle, 'اسم التقرير');
      req('strategyName', data.strategyName, 'اسم الاستراتيجية');
      req('subject', data.subject, 'المادة الدراسية');
      req('executionDate', data.executionDate, 'التاريخ');
      req('stage', data.stage, 'المرحلة الدراسية');
      req('grade', data.grade, 'الصف');
      req('studentsCount', data.studentsCount, 'عدد الطلاب');
      req('lessonTopic', data.lessonTopic, 'الدرس');
      req('strategyObjectives', data.strategyObjectives, 'أهداف الاستراتيجية');
      req('educationalTools', data.educationalTools, 'الأدوات والوسائل التعليمية');
      req(
        'classroomMechanism',
        data.classroomMechanism,
        'آلية تنفيذ الاستراتيجية داخل الحصة'
      );
      req('teacherName', data.teacherName, 'اسم المعلم');
      break;
    }

    case 'problem-remediation': {
      req('subject', data.subject, 'المادة الدراسية');
      req('grade', data.grade, 'الصف');
      req('targetCategory', data.targetCategory, 'الفئة المستهدفة');
      req('remediationTopic', data.remediationTopic, 'موضوع المعالجة');
      req('executionLocation', data.executionLocation, 'مكان التنفيذ');
      req('executionDate', data.executionDate, 'تاريخ التنفيذ');
      req('executionDuration', data.executionDuration, 'مدة التنفيذ');
      req('problemDescription', data.problemDescription, 'وصف المشكلة التعليمية');
      req('probableCauses', data.probableCauses, 'أسباب المشكلة المحتملة');
      req(
        'preRemediationLevel',
        data.preRemediationLevel,
        'مستوى الطالب أو الطلاب قبل المعالجة'
      );
      req('objectives', data.objectives, 'الأهداف');
      req('executionSteps', data.executionSteps, 'خطوات التنفيذ');
      req(
        'postRemediationLevel',
        data.postRemediationLevel,
        'مستوى الطالب أو الطلاب بعد المعالجة'
      );
      req('recommendations', data.recommendations, 'التوصيات');
      req('teacherName', data.teacherName, 'اسم المعلم');
      break;
    }

    case 'learning-outcomes-analysis': {
      req('subject', data.subject, 'المادة الدراسية');
      req('stage', data.stage, 'المرحلة الدراسية');
      req('grade', data.grade, 'الصف');
      req('semester', data.semester, 'الفصل الدراسي');
      req('totalStudentsCount', data.totalStudentsCount, 'عدد الطلاب');

      if (data.analysisScope === 'single-exam') {
        req('examName', data.examName, 'اسم الاختبار أو التقويم');
        req('applicationDate', data.applicationDate, 'تاريخ التطبيق');
      } else {
        req(
          'semesterCalculationMethod',
          data.semesterCalculationMethod,
          'آلية احتساب نتائج التقويمات خلال الفصل'
        );
      }

      const dist = computeLearningLevelsDistribution(data);
      if (dist.totalStudents === null || dist.totalStudents <= 0) {
        errors.totalStudentsCount = 'يرجى إدخال عدد طلاب صحيح أكبر من صفر.';
      } else if (!dist.hasAnyLevelInput) {
        errors.levelsDistribution =
          'يرجى إدخال أعداد الطلاب في مستويات الأداء الخمسة.';
      } else if (!dist.isMatched) {
        errors.levelsDistribution = dist.statusMessage;
      }

      req('strengths', data.strengths, 'جوانب القوة');
      req('weaknesses', data.weaknesses, 'جوانب الضعف');
      req('keyObservations', data.keyObservations, 'أبرز الملاحظات');
      req(
        'actionsAndRecommendations',
        data.actionsAndRecommendations,
        'الإجراءات والتوصيات'
      );
      req('teacherName', data.teacherName, 'اسم المعلم');
      break;
    }

    case 'distinguished-practice': {
      req('practiceName', data.practiceName, 'اسم الممارسة');
      req('subject', data.subject, 'المادة الدراسية');
      req('stage', data.stage, 'المرحلة الدراسية');
      req('grade', data.grade, 'الصف');
      req('applicationDuration', data.applicationDuration, 'مدة التطبيق');
      req('applicationDate', data.applicationDate, 'تاريخ التطبيق');
      req('targetGroup', data.targetGroup, 'الفئة المستهدفة');
      req('applicationLocation', data.applicationLocation, 'مكان التطبيق');
      req('practiceIdea', data.practiceIdea, 'فكرة الممارسة');
      req('applicationMotives', data.applicationMotives, 'دوافع تطبيقها');
      req('addressedChallenge', data.addressedChallenge, 'التحدي الذي عالجته');
      req('objectives', data.objectives, 'الأهداف');
      req('executionMechanism', data.executionMechanism, 'آلية التنفيذ');
      req('toolsAndMeans', data.toolsAndMeans, 'الأدوات والوسائل');
      req('achievedResults', data.achievedResults, 'النتائج المحققة');
      req(
        'impactOnStudentLearning',
        data.impactOnStudentLearning,
        'أثر الممارسة على تعلم الطلاب'
      );
      req('recommendations', data.recommendations, 'التوصيات');
      req('teacherName', data.teacherName, 'اسم المعلم');
      break;
    }

    case 'professional-achievement': {
      req('achievementName', data.achievementName, 'اسم الإنجاز');
      req('achievementType', data.achievementType, 'نوع الإنجاز');
      if (data.achievementType === 'إنجاز آخر') {
        req(
          'customAchievementType',
          data.customAchievementType,
          'تحديد نوع الإنجاز الآخر'
        );
      }
      // Note: subject, stage, and grade are explicitly OPTIONAL in Form 5!
      req('achievementDate', data.achievementDate, 'تاريخ الإنجاز');
      req('achievementDescription', data.achievementDescription, 'وصف الإنجاز');
      req('achievementObjective', data.achievementObjective, 'الهدف منه');
      req('beneficiaryGroup', data.beneficiaryGroup, 'الفئة المستفيدة');
      req('resultsAndImpact', data.resultsAndImpact, 'النتائج والأثر');
      req('teacherName', data.teacherName, 'اسم المعلم');
      break;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// LocalStorage Persistence for the 5 Teacher Reports
// ============================================================================
export function saveTeacherReportDraftToStorage<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  data: TeacherReportFormMap[K],
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): boolean {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;

    const existingRaw = store.getItem(TEACHER_REPORTS_STORAGE_KEY);
    const parsedMap: Record<string, unknown> =
      existingRaw && typeof existingRaw === 'string'
        ? JSON.parse(existingRaw)
        : {};

    parsedMap[formId] = data;

    try {
      store.setItem(TEACHER_REPORTS_STORAGE_KEY, JSON.stringify(parsedMap));
    } catch {
      // Fallback if large base64 photos exceed localStorage quota: save all text/links fields without base64 photos
      parsedMap[formId] = {
        ...data,
        evidencePhotos: [],
      };
      store.setItem(TEACHER_REPORTS_STORAGE_KEY, JSON.stringify(parsedMap));
    }
    return true;
  } catch {
    return false;
  }
}

export function loadTeacherReportDraftFromStorage<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  settings?: Partial<SchoolSettings>,
  storage?: Pick<Storage, 'getItem'>
): TeacherReportFormMap[K] {
  const initial = createInitialTeacherReportData(formId, settings);
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return initial;

    const existingRaw = store.getItem(TEACHER_REPORTS_STORAGE_KEY);
    if (!existingRaw) return initial;

    const parsedMap = JSON.parse(existingRaw);
    if (!parsedMap || typeof parsedMap !== 'object' || !(formId in parsedMap)) {
      return initial;
    }

    const stored = parsedMap[formId];
    if (!stored || typeof stored !== 'object') return initial;

    const merged = {
      ...initial,
      ...stored,
      formId,
    } as TeacherReportFormMap[K];

    // If teacherName is still empty in stored draft and settings has userName, populate it
    if (!merged.teacherName?.trim() && settings?.userName?.trim()) {
      merged.teacherName = settings.userName.trim();
    }

    return merged;
  } catch {
    return initial;
  }
}

export function clearTeacherReportDraftInStorage<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  settings?: Partial<SchoolSettings>,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): TeacherReportFormMap[K] {
  const fresh = createInitialTeacherReportData(formId, settings);
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (store) {
      const existingRaw = store.getItem(TEACHER_REPORTS_STORAGE_KEY);
      if (existingRaw) {
        const parsedMap = JSON.parse(existingRaw);
        if (parsedMap && typeof parsedMap === 'object') {
          delete parsedMap[formId];
          store.setItem(TEACHER_REPORTS_STORAGE_KEY, JSON.stringify(parsedMap));
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return fresh;
}

// ============================================================================
// Adapter: Convert Any of the 5 Independent Form Data Interfaces into
// `TeacherReportDocument` for the Existing Teacher PDF Engine
// ============================================================================
function formatDateWithOptionalHijri(rawDate: string): string {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return '';
  const hijri = formatGregorianToUmmAlQuraHijri(trimmed);
  if (hijri) {
    return `${trimmed.replace(/-/g, ' / ')} (${hijri})`;
  }
  return trimmed;
}

function splitLinesToItems(rawText: string): string[] {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter((line) => line.length > 0);
}

function addTextOrListSection(
  sections: TeacherReportContentSection[],
  id: string,
  title: string,
  rawText: string,
  preferListWhenMultiline = true
): void {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return;
  const lines = splitLinesToItems(trimmed);
  if (preferListWhenMultiline && lines.length > 1) {
    sections.push({
      id,
      title,
      type: 'list',
      items: lines,
    });
  } else {
    sections.push({
      id,
      title,
      type: 'text',
      content: trimmed,
    });
  }
}

function pushNonEmptyField(
  target: TeacherReportBasicField[],
  id: string,
  label: string,
  rawValue: string | undefined | null
): void {
  const val = (rawValue ?? '').trim();
  if (!val) return;
  target.push({
    id,
    label,
    value: val,
    width: 'half',
  });
}

/**
 * Distributes populated basic fields cleanly for the selected template style:
 * - `waves`: all populated basic fields go into `basicFields` (rendered in the unified 2-column table).
 * - `waves-2` (3-cell top bar) & `geometric` (4-cell top bar): the top 3 or 4 fields go into `basicFields`
 *   and any remaining populated basic fields are placed at the start of `sections` as a `fields` card
 *   so no populated field is ever truncated or hidden on any template.
 */
function partitionBasicFieldsForTemplate(
  allBasicFields: TeacherReportBasicField[],
  templateStyle: TeacherPdfTemplateStyle
): {
  topBarFields: TeacherReportBasicField[];
  overflowSection: TeacherReportContentSection | null;
} {
  if (templateStyle === 'waves') {
    return { topBarFields: allBasicFields, overflowSection: null };
  }
  const maxTopCols = templateStyle === 'waves-2' ? 3 : 4;
  if (allBasicFields.length <= maxTopCols) {
    return { topBarFields: allBasicFields, overflowSection: null };
  }
  return {
    topBarFields: allBasicFields.slice(0, maxTopCols),
    overflowSection: {
      id: 'sec-basic-overflow',
      title: 'البيانات الأساسية',
      type: 'fields',
      fields: allBasicFields.slice(maxTopCols),
    },
  };
}

export function buildTeacherReportDocumentFromForm(
  data: AnyTeacherProfessionalReportData,
  settings: SchoolSettings,
  overrides?: Partial<{
    templateStyle: TeacherPdfTemplateStyle;
    colorSystem: TeacherPdfColorSystem;
  }>
): TeacherReportDocument {
  const templateStyle =
    overrides?.templateStyle ?? settings.teacherPdfTemplate ?? 'waves';
  const colorSystem =
    overrides?.colorSystem ?? settings.teacherPdfColorSystem ?? 'green';
  const gendered = getGenderedLabels(settings.gender);
  const teacherFieldLabel =
    gendered.gender === 'female' ? 'اسم المعلمة' : 'اسم المعلم';

  const resolvedTeacherName =
    data.teacherName?.trim() || settings.userName?.trim() || '';
  const resolvedPrincipalName = settings.principalName?.trim() || '';

  const allBasicFields: TeacherReportBasicField[] = [];
  const sections: TeacherReportContentSection[] = [];

  switch (data.formId) {
    case 'strategy-implementation': {
      const reportTypeLabel =
        data.reportTitle?.trim() || 'تقرير تنفيذ استراتيجية تعليمية';
      const reportMainTitle =
        data.strategyName?.trim() || reportTypeLabel;

      pushNonEmptyField(
        allBasicFields,
        'bf-strategy',
        'اسم الاستراتيجية',
        data.strategyName
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-subject',
        'المادة الدراسية',
        data.subject
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-date',
        'التاريخ',
        formatDateWithOptionalHijri(data.executionDate)
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-stage',
        'المرحلة الدراسية',
        data.stage
      );
      pushNonEmptyField(allBasicFields, 'bf-grade', 'الصف', data.grade);
      pushNonEmptyField(
        allBasicFields,
        'bf-students',
        'عدد الطلاب',
        data.studentsCount
      );
      pushNonEmptyField(allBasicFields, 'bf-lesson', 'الدرس', data.lessonTopic);
      pushNonEmptyField(
        allBasicFields,
        'bf-teacher',
        teacherFieldLabel,
        resolvedTeacherName
      );

      addTextOrListSection(
        sections,
        'sec-objectives',
        'أهداف الاستراتيجية',
        data.strategyObjectives,
        true
      );
      addTextOrListSection(
        sections,
        'sec-tools',
        'الأدوات والوسائل التعليمية',
        data.educationalTools,
        true
      );
      addTextOrListSection(
        sections,
        'sec-mechanism',
        'آلية التنفيذ داخل الحصة',
        data.classroomMechanism,
        false
      );

      const { topBarFields, overflowSection } = partitionBasicFieldsForTemplate(
        allBasicFields,
        templateStyle
      );

      return {
        reportTypeLabel,
        reportMainTitle,
        templateStyle,
        colorSystem,
        basicFields: topBarFields,
        sections: overflowSection ? [overflowSection, ...sections] : sections,
        evidencePhotos: data.evidencePhotos,
        evidenceLinks: data.evidenceLinks,
        principalName: resolvedPrincipalName,
        includePrincipalSignoff: Boolean(resolvedPrincipalName),
      };
    }

    case 'problem-remediation': {
      const reportTypeLabel = 'تقرير معالجة مشكلة تعليمية';
      const reportMainTitle =
        data.remediationTopic?.trim() || reportTypeLabel;

      pushNonEmptyField(
        allBasicFields,
        'bf-subject',
        'المادة الدراسية',
        data.subject
      );
      pushNonEmptyField(allBasicFields, 'bf-grade', 'الصف', data.grade);
      pushNonEmptyField(
        allBasicFields,
        'bf-target',
        'الفئة المستهدفة',
        data.targetCategory
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-topic',
        'موضوع المعالجة',
        data.remediationTopic
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-location',
        'مكان التنفيذ',
        data.executionLocation
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-date',
        'تاريخ التنفيذ',
        formatDateWithOptionalHijri(data.executionDate)
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-duration',
        'مدة التنفيذ',
        data.executionDuration
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-teacher',
        teacherFieldLabel,
        resolvedTeacherName
      );

      // تشخيص المشكلة
      addTextOrListSection(
        sections,
        'sec-prob-desc',
        'وصف المشكلة التعليمية',
        data.problemDescription,
        false
      );
      addTextOrListSection(
        sections,
        'sec-prob-causes',
        'أسباب المشكلة المحتملة',
        data.probableCauses,
        true
      );
      addTextOrListSection(
        sections,
        'sec-pre-level',
        'المستوى قبل المعالجة',
        data.preRemediationLevel,
        false
      );

      // خطة المعالجة
      addTextOrListSection(
        sections,
        'sec-plan-obj',
        'أهداف خطة المعالجة',
        data.objectives,
        true
      );
      addTextOrListSection(
        sections,
        'sec-plan-steps',
        'خطوات التنفيذ',
        data.executionSteps,
        true
      );

      // النتائج والتوصيات
      addTextOrListSection(
        sections,
        'sec-post-level',
        'المستوى بعد المعالجة',
        data.postRemediationLevel,
        false
      );
      addTextOrListSection(
        sections,
        'sec-recommendations',
        'التوصيات',
        data.recommendations,
        true
      );

      const { topBarFields, overflowSection } = partitionBasicFieldsForTemplate(
        allBasicFields,
        templateStyle
      );

      return {
        reportTypeLabel,
        reportMainTitle,
        templateStyle,
        colorSystem,
        basicFields: topBarFields,
        sections: overflowSection ? [overflowSection, ...sections] : sections,
        evidencePhotos: data.evidencePhotos,
        evidenceLinks: data.evidenceLinks,
        principalName: resolvedPrincipalName,
        includePrincipalSignoff: Boolean(resolvedPrincipalName),
      };
    }

    case 'learning-outcomes-analysis': {
      const reportTypeLabel = 'تقرير تحليل نتائج التعلم';
      const scopeLabel =
        data.analysisScope === 'single-exam' ? 'اختبار واحد' : 'فصل دراسي كامل';
      const reportMainTitle =
        data.analysisScope === 'single-exam' && data.examName?.trim()
          ? `${data.subject?.trim() ? `${data.subject.trim()} — ` : ''}${data.examName.trim()}`
          : `${data.subject?.trim() || 'تحليل نتائج التعلم'} (${scopeLabel})`;

      pushNonEmptyField(
        allBasicFields,
        'bf-scope',
        'نطاق التحليل',
        scopeLabel
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-subject',
        'المادة الدراسية',
        data.subject
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-stage',
        'المرحلة الدراسية',
        data.stage
      );
      pushNonEmptyField(allBasicFields, 'bf-grade', 'الصف', data.grade);
      pushNonEmptyField(
        allBasicFields,
        'bf-semester',
        'الفصل الدراسي',
        data.semester
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-total-students',
        'عدد الطلاب',
        data.totalStudentsCount
      );

      if (data.analysisScope === 'single-exam') {
        pushNonEmptyField(
          allBasicFields,
          'bf-exam-name',
          'اسم الاختبار أو التقويم',
          data.examName
        );
        pushNonEmptyField(
          allBasicFields,
          'bf-exam-date',
          'تاريخ التطبيق',
          formatDateWithOptionalHijri(data.applicationDate)
        );
      }

      pushNonEmptyField(
        allBasicFields,
        'bf-teacher',
        teacherFieldLabel,
        resolvedTeacherName
      );

      // Conditional full-semester assessment mechanism section
      if (data.analysisScope === 'full-semester') {
        const methodLines: string[] = [];
        if (
          Array.isArray(data.semesterAssessmentTools) &&
          data.semesterAssessmentTools.length > 0
        ) {
          methodLines.push(
            `أدوات التقويم المشمولة: ${data.semesterAssessmentTools.join(' ، ')}.`
          );
        }
        if (data.semesterCalculationMethod?.trim()) {
          methodLines.push(data.semesterCalculationMethod.trim());
        }
        if (data.semesterAssessmentsSummary?.trim()) {
          methodLines.push(data.semesterAssessmentsSummary.trim());
        }
        if (methodLines.length > 0) {
          sections.push({
            id: 'sec-semester-method',
            title: 'آلية تقويم الفصل الدراسي',
            type: 'list',
            items: methodLines,
          });
        }
      }

      // Performance Levels Distribution Section (Fields grid with counts + automatic %)
      const dist = computeLearningLevelsDistribution(data);
      if (dist.hasAnyLevelInput) {
        const levelFields: TeacherReportBasicField[] = dist.levels.map(
          (lvl) => ({
            id: `lvl-${lvl.key}`,
            label: `مستوى ${lvl.label}`,
            value: `${lvl.count} طالب (${lvl.formattedPercentage})`,
            width: 'half',
          })
        );
        levelFields.push({
          id: 'lvl-total-check',
          label: 'مجموع المستويات / الإجمالي',
          value:
            dist.totalStudents !== null
              ? `${dist.sumOfLevels} من ${dist.totalStudents} (${dist.isMatched ? 'مطابق ١٠٠٪' : 'غير مطابق'})`
              : `${dist.sumOfLevels} طالب`,
          width: 'half',
        });

        sections.push({
          id: 'sec-levels-distribution',
          title: 'توزيع مستويات الأداء',
          type: 'fields',
          fields: levelFields,
        });
      }

      addTextOrListSection(
        sections,
        'sec-strengths',
        'جوانب القوة',
        data.strengths,
        true
      );
      addTextOrListSection(
        sections,
        'sec-weaknesses',
        'جوانب الضعف',
        data.weaknesses,
        true
      );
      addTextOrListSection(
        sections,
        'sec-observations',
        'أبرز الملاحظات',
        data.keyObservations,
        true
      );
      addTextOrListSection(
        sections,
        'sec-actions',
        'الإجراءات والتوصيات',
        data.actionsAndRecommendations,
        true
      );

      const { topBarFields, overflowSection } = partitionBasicFieldsForTemplate(
        allBasicFields,
        templateStyle
      );

      return {
        reportTypeLabel,
        reportMainTitle,
        templateStyle,
        colorSystem,
        basicFields: topBarFields,
        sections: overflowSection ? [overflowSection, ...sections] : sections,
        evidencePhotos: data.evidencePhotos,
        evidenceLinks: data.evidenceLinks,
        principalName: resolvedPrincipalName,
        includePrincipalSignoff: Boolean(resolvedPrincipalName),
      };
    }

    case 'distinguished-practice': {
      const reportTypeLabel = 'تقرير ممارسة تعليمية متميزة';
      const reportMainTitle =
        data.practiceName?.trim() || reportTypeLabel;

      pushNonEmptyField(
        allBasicFields,
        'bf-practice-name',
        'اسم الممارسة',
        data.practiceName
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-subject',
        'المادة الدراسية',
        data.subject
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-stage',
        'المرحلة الدراسية',
        data.stage
      );
      pushNonEmptyField(allBasicFields, 'bf-grade', 'الصف', data.grade);
      pushNonEmptyField(
        allBasicFields,
        'bf-duration',
        'مدة التطبيق',
        data.applicationDuration
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-date',
        'تاريخ التطبيق',
        formatDateWithOptionalHijri(data.applicationDate)
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-target',
        'الفئة المستهدفة',
        data.targetGroup
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-location',
        'مكان التطبيق',
        data.applicationLocation
      );
      if (
        data.sustainabilityOption &&
        data.sustainabilityOption !== 'لا ينطبق'
      ) {
        pushNonEmptyField(
          allBasicFields,
          'bf-sustainability',
          'الاستمرار أو التعميم',
          data.sustainabilityOption
        );
      }
      pushNonEmptyField(
        allBasicFields,
        'bf-teacher',
        teacherFieldLabel,
        resolvedTeacherName
      );

      addTextOrListSection(
        sections,
        'sec-idea',
        'فكرة الممارسة ودوافعها',
        [
          data.practiceIdea?.trim()
            ? `فكرة الممارسة: ${data.practiceIdea.trim()}`
            : '',
          data.applicationMotives?.trim()
            ? `دوافع التطبيق: ${data.applicationMotives.trim()}`
            : '',
          data.addressedChallenge?.trim()
            ? `التحدي الذي عالجته: ${data.addressedChallenge.trim()}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        true
      );
      addTextOrListSection(
        sections,
        'sec-objectives',
        'أهداف الممارسة',
        data.objectives,
        true
      );
      addTextOrListSection(
        sections,
        'sec-mechanism',
        'آلية التنفيذ والأدوات',
        [
          data.executionMechanism?.trim(),
          data.toolsAndMeans?.trim()
            ? `الأدوات والوسائل: ${data.toolsAndMeans.trim()}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        false
      );
      addTextOrListSection(
        sections,
        'sec-results',
        'النتائج والأثر على التعلم',
        [
          data.achievedResults?.trim()
            ? `النتائج المحققة: ${data.achievedResults.trim()}`
            : '',
          data.impactOnStudentLearning?.trim()
            ? `الأثر على تعلم الطلاب: ${data.impactOnStudentLearning.trim()}`
            : '',
          data.sustainabilityOption?.trim()
            ? `إمكانية الاستمرار أو التعميم: ${data.sustainabilityOption.trim()}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        true
      );
      addTextOrListSection(
        sections,
        'sec-recommendations',
        'التوصيات',
        data.recommendations,
        true
      );

      const { topBarFields, overflowSection } = partitionBasicFieldsForTemplate(
        allBasicFields,
        templateStyle
      );

      return {
        reportTypeLabel,
        reportMainTitle,
        templateStyle,
        colorSystem,
        basicFields: topBarFields,
        sections: overflowSection ? [overflowSection, ...sections] : sections,
        evidencePhotos: data.evidencePhotos,
        evidenceLinks: data.evidenceLinks,
        principalName: resolvedPrincipalName,
        includePrincipalSignoff: Boolean(resolvedPrincipalName),
      };
    }

    case 'professional-achievement': {
      const reportTypeLabel = 'تقرير إنجاز مهني';
      const reportMainTitle =
        data.achievementName?.trim() || reportTypeLabel;

      const resolvedType =
        data.achievementType === 'إنجاز آخر'
          ? data.customAchievementType?.trim() || 'إنجاز آخر'
          : data.achievementType;

      pushNonEmptyField(
        allBasicFields,
        'bf-achievement-name',
        'اسم الإنجاز',
        data.achievementName
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-achievement-type',
        'نوع الإنجاز',
        resolvedType
      );
      // Optional fields: only pushed if non-empty!
      pushNonEmptyField(
        allBasicFields,
        'bf-subject',
        'المادة الدراسية',
        data.subject
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-stage',
        'المرحلة الدراسية',
        data.stage
      );
      pushNonEmptyField(allBasicFields, 'bf-grade', 'الصف', data.grade);
      pushNonEmptyField(
        allBasicFields,
        'bf-date',
        'تاريخ الإنجاز',
        formatDateWithOptionalHijri(data.achievementDate)
      );
      pushNonEmptyField(
        allBasicFields,
        'bf-teacher',
        teacherFieldLabel,
        resolvedTeacherName
      );

      addTextOrListSection(
        sections,
        'sec-ach-desc',
        'وصف الإنجاز',
        data.achievementDescription,
        false
      );
      addTextOrListSection(
        sections,
        'sec-ach-obj',
        'الهدف من الإنجاز',
        data.achievementObjective,
        true
      );
      addTextOrListSection(
        sections,
        'sec-ach-beneficiaries',
        'الفئة المستفيدة',
        data.beneficiaryGroup,
        false
      );
      addTextOrListSection(
        sections,
        'sec-ach-impact',
        'النتائج والأثر',
        data.resultsAndImpact,
        true
      );

      const { topBarFields, overflowSection } = partitionBasicFieldsForTemplate(
        allBasicFields,
        templateStyle
      );

      return {
        reportTypeLabel,
        reportMainTitle,
        templateStyle,
        colorSystem,
        basicFields: topBarFields,
        sections: overflowSection ? [overflowSection, ...sections] : sections,
        evidencePhotos: data.evidencePhotos,
        evidenceLinks: data.evidenceLinks,
        principalName: resolvedPrincipalName,
        includePrincipalSignoff: Boolean(resolvedPrincipalName),
      };
    }
  }
}
