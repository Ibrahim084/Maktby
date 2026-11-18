import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import { formatGregorianToUmmAlQuraHijri } from './formEngine';
import { getGenderedLabels } from './settingsStorage';
import {
  paginateTeacherReportBlocks,
  TeacherReportBasicField,
  TeacherReportContentSection,
  TeacherReportDocument,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from './teacherPdfEngine';
import { TeacherPlansPathId } from './teacherReportsEngine';

export const TEACHER_PLANS_STORAGE_KEY = 'maktabi_teacher_plans_v1';

export type TeacherPlanFormId =
  | 'professional-development-plan'
  | 'weekly-teacher-plan'
  | 'individual-remedial-plan'
  | 'group-remedial-plan'
  | 'enrichment-plan';

export interface TeacherPlanMetadata {
  id: TeacherPlanFormId;
  pathId: TeacherPlansPathId;
  number: number;
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  highlights: string[];
  maxPages?: number;
  targetPagesLabel?: string;
}

export const TEACHER_PLANS_CATALOG: TeacherPlanMetadata[] = [
  // المسار الأول: خطط المعلم (teacher-plans)
  {
    id: 'professional-development-plan',
    pathId: 'teacher-plans',
    number: 1,
    title: 'خطة التطوير المهني وتحسين الأداء التدريسي',
    shortTitle: 'خطة التطوير المهني',
    badge: 'خطة معلم ١',
    description:
      'توثيق خطة المعلم السنوية أو قصيرة المدى للتطوير المهني، وتشخيص الاحتياج، والأهداف التطويرية ومؤشرات القياس والمتابعة وتقويم الأثر.',
    highlights: [
      'نوع الخطة (سنوية / قصيرة المدى) وحالتها (قيد التنفيذ / مكتملة)',
      'تشخيص الاحتياج من قائمة معتمدة أو إضافة احتياج آخر',
      'سجل مستقل لكل هدف تطويري مع المتابعة وتقويم الأثر وملاحظات المدير الاختيارية',
    ],
  },
  {
    id: 'weekly-teacher-plan',
    pathId: 'teacher-plans',
    number: 2,
    title: 'الخطة الأسبوعية للمعلم',
    shortTitle: 'الخطة الأسبوعية',
    badge: 'خطة معلم ٢',
    description:
      'تنظيم الخطة التدريسية الأسبوعية للمعلم وتوثيق الدروس ونواتج التعلم والاستراتيجيات والوسائل وأساليب التقويم والواجبات.',
    highlights: [
      'بيانات الأسبوع والتاريخ والمادة الدراسية والصف',
      'إضافة عدة دروس أو موضوعات مع نواتج التعلم والاستراتيجيات والوسائل والتقويم والواجبات',
      'ملاحظات المعلم والشواهد اختيارية بتصميم واضح ومختصر',
    ],
  },

  // المسار الثاني: خطط المعلم للطلاب (student-plans)
  {
    id: 'individual-remedial-plan',
    pathId: 'student-plans',
    number: 1,
    title: 'الخطة العلاجية الفردية',
    shortTitle: 'خطة علاجية فردية',
    badge: 'خطة طلاب ١',
    description:
      'خطة علاجية مخصصة لطالب واحد لمعالجة ضعف محدد في مادة أو مهارة أو اختبار، مع سلم تقدير خماسي للأهداف العلاجية ومتابعة مختصرة.',
    highlights: [
      'تحديد مصدر الضعف (مادة / مهارة / اختبار فترة / اختبار فصلي) وبيانات الاختبار التشخيصي',
      'إضافة عدة أهداف علاجية بسلم تقدير خماسي (قبل التدخل / المستهدف / بعد التدخل)',
      'صفحة واحدة مستهدفة وصفحتان كحد أقصى شاملة الشواهد',
    ],
    maxPages: 2,
    targetPagesLabel: 'صفحة واحدة مستهدفة (حد أقصى صفحتان)',
  },
  {
    id: 'group-remedial-plan',
    pathId: 'student-plans',
    number: 2,
    title: 'الخطة العلاجية الجماعية',
    shortTitle: 'خطة علاجية جماعية',
    badge: 'خطة طلاب ٢',
    description:
      'خطة علاجية مستقلة لمجموعة طلاب أو طلاب محددين أو الفصل كاملًا لمعالجة مهارة أو عدة مهارات مع تقييم وصفي قبلي وبعدي وقياس الأثر.',
    highlights: [
      'نطاق المستفيدين (طلاب محددون / مجموعة / الفصل كاملًا) وعدد الطلاب وأسمائهم',
      'تقييم وصفي مستقل لكل مهارة قبل المعالجة وبعدها وإجراءات جماعية ومخصصة',
      'قياس الأثر (عدد المتحسنين وغير المتحسنين ووصف التحسن والتوصيات) بحد أقصى ٣ صفحات',
    ],
    maxPages: 3,
    targetPagesLabel: 'حد أقصى ٣ صفحات',
  },
  {
    id: 'enrichment-plan',
    pathId: 'student-plans',
    number: 3,
    title: 'الخطة الإثرائية',
    shortTitle: 'خطة إثرائية',
    badge: 'خطة طلاب ٣',
    description:
      'خطة موجهة لتنمية قدرات الطلاب المتميزين وتوسيع تعلمهم عبر أنشطة إثرائية متنوعة وتوثيق منتجات الطلاب وإنجازاتهم وقياس الأثر الوصفي.',
    highlights: [
      'المستفيدون (طالب واحد / مجموعة / الفصل كاملًا) وسبب الترشيح وأنواع الإثراء المتعددة',
      'إضافة عدة أنشطة إثرائية مع قسم مستقل لـ «منتجات الطلاب وإنجازاتهم»',
      'قياس أثر وصفي شامل والشواهد بحد أقصى ٣ صفحات',
    ],
    maxPages: 3,
    targetPagesLabel: 'حد أقصى ٣ صفحات',
  },
];

export function getPlansForPath(
  pathId: TeacherPlansPathId
): TeacherPlanMetadata[] {
  return TEACHER_PLANS_CATALOG.filter((item) => item.pathId === pathId);
}

// ============================================================================
// Constants & Option Lists
// ============================================================================

export const PLAN_TYPE_OPTIONS = ['سنوية', 'قصيرة المدى'] as const;
export const PLAN_STATUS_OPTIONS = ['قيد التنفيذ', 'مكتملة'] as const;

export const NEED_DIAGNOSIS_OPTIONS = [
  'تنويع استراتيجيات التدريس الحديثة والتعلم النشط',
  'توظيف التقنية والمنصات الرقمية في التعليم',
  'بناء أدوات التقويم البديل وتحليل نتائج التعلم',
  'الإدارة الصفية الفاعلة وتهيئة بيئة التعلم',
  'مراعاة الفروق الفردية والتدريس المتمايز',
  'تنمية مهارات التفكير العليا والبحث العلمي لدى الطلاب',
  'احتياج آخر',
] as const;

export const FOLLOW_UP_PERIOD_OPTIONS = [
  'شهرية',
  'نصف شهرية',
  'أسبوعية',
  'فصلية',
] as const;

export const WEAKNESS_SOURCE_OPTIONS = [
  'مادة دراسية',
  'مهارة',
  'اختبار فترة',
  'اختبار فصلي',
] as const;

export type WeaknessSourceType = (typeof WEAKNESS_SOURCE_OPTIONS)[number];

export const FIVE_POINT_RATING_SCALE = [
  '١ - ضعيف جدًا',
  '٢ - ضعيف',
  '٣ - متوسط',
  '٤ - جيد',
  '٥ - متقن / متميز',
] as const;

export const GROUP_REMEDIAL_SCOPE_OPTIONS = [
  'طلاب محددون',
  'مجموعة',
  'الفصل كاملًا',
] as const;

export const ENRICHMENT_BENEFICIARIES_SCOPE_OPTIONS = [
  'طالب واحد',
  'مجموعة',
  'الفصل كاملًا',
] as const;

export const ENRICHMENT_TYPES_OPTIONS = [
  'إثراء معرفي وتوسيع المحتوى',
  'مشروعات بحثية',
  'أنشطة إبداعية وابتكارية',
  'حل المشكلات والتفكير الناقد',
  'تطبيقات عملية ومهام أدائية',
  'مسابقات وتحديات علمية',
  'نوع آخر',
] as const;

// ============================================================================
// Form Data Interfaces
// ============================================================================

export interface BaseTeacherPlanFormData {
  planTitle: string;
  teacherName: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
}

// 1. خطة التطوير المهني وتحسين الأداء التدريسي
export interface ProfessionalDevGoalItem {
  id: string;
  goalTitle: string;
  currentLevel: string;
  targetLevel: string;
  actions: string;
  resources: string;
  indicators: string;
  result: string;
}

export interface ProfessionalDevelopmentPlanData
  extends BaseTeacherPlanFormData {
  planType: 'سنوية' | 'قصيرة المدى';
  planStatus: 'قيد التنفيذ' | 'مكتملة';
  subject: string;
  stageAndGrade: string;
  academicPeriod: string;
  needDiagnosisCategory: string;
  customNeedDiagnosis: string;
  needDiagnosisDetails: string;
  goals: ProfessionalDevGoalItem[];
  followUpFrequency: string;
  followUpNotes: string;
  impactEvaluation: string;
  principalNotes: string;
  includePrincipalApproval: boolean;
}

// 2. الخطة الأسبوعية للمعلم
export interface WeeklyLessonItem {
  id: string;
  lessonTitle: string;
  learningOutcomes: string;
  strategiesAndActivities: string;
  toolsAndResources: string;
  assessmentMethods: string;
  homeworkOrTasks: string;
}

export interface WeeklyTeacherPlanData extends BaseTeacherPlanFormData {
  weekLabel: string;
  weekDate: string;
  subject: string;
  grade: string;
  lessons: WeeklyLessonItem[];
  teacherNotes: string;
}

// 3. الخطة العلاجية الفردية
export interface IndividualRemedialGoalItem {
  id: string;
  goalText: string;
  preLevel: string;
  targetLevel: string;
  postLevel: string;
  remedialActions: string;
  duration: string;
}

export interface IndividualRemedialPlanData extends BaseTeacherPlanFormData {
  studentName: string;
  subject: string;
  grade: string;
  planDate: string;
  weaknessSource: WeaknessSourceType;
  // Conditional details based on weaknessSource
  subjectWeaknessTopics: string;
  skillWeaknessName: string;
  periodExamNameAndScore: string;
  semesterExamScoreAndGaps: string;
  // Diagnostic test conditional
  hasDiagnosticTest: 'نعم' | 'لا';
  diagnosticTestName: string;
  diagnosticTestResult: string;
  goals: IndividualRemedialGoalItem[];
  followUpAndResults: string;
}

// 4. الخطة العلاجية الجماعية
export interface GroupRemedialSkillItem {
  id: string;
  skillName: string;
  preAssessment: string;
  postAssessment: string;
}

export interface GroupRemedialPlanData extends BaseTeacherPlanFormData {
  beneficiariesScope: 'طلاب محددون' | 'مجموعة' | 'الفصل كاملًا';
  subject: string;
  grade: string;
  classSection: string;
  studentsCount: string;
  studentNames: string;
  skills: GroupRemedialSkillItem[];
  groupActions: string;
  customizedActionsForStudents: string;
  startDate: string;
  endDate: string;
  weeklyFrequency: string;
  sessionDuration: string;
  improvedStudentsCount: string;
  notEnoughImprovedCount: string;
  skillsImprovementDescription: string;
  recommendations: string;
}

// 5. الخطة الإثرائية
export interface EnrichmentActivityItem {
  id: string;
  activityTitle: string;
  activityDescription: string;
  executionMethod: string;
}

export interface StudentProductItem {
  id: string;
  productName: string;
  productType: string;
  productDescription: string;
  participatingStudents: string;
}

export interface EnrichmentPlanData extends BaseTeacherPlanFormData {
  beneficiariesScope: 'طالب واحد' | 'مجموعة' | 'الفصل كاملًا';
  subject: string;
  grade: string;
  studentsCount: string;
  studentNames: string;
  nominationReason: string;
  enrichmentTypes: string[];
  customEnrichmentType: string;
  startDate: string;
  endDate: string;
  weeklyFrequency: string;
  activityDuration: string;
  activities: EnrichmentActivityItem[];
  developedCapabilities: string;
  activitiesOutputs: string;
  goalsAchievementExtent: string;
  recommendations: string;
  studentProducts: StudentProductItem[];
}

export interface TeacherPlanFormMap {
  'professional-development-plan': ProfessionalDevelopmentPlanData;
  'weekly-teacher-plan': WeeklyTeacherPlanData;
  'individual-remedial-plan': IndividualRemedialPlanData;
  'group-remedial-plan': GroupRemedialPlanData;
  'enrichment-plan': EnrichmentPlanData;
}

// ============================================================================
// Factory Helpers for Dynamic Items & Initial Data
// ============================================================================

export function createEmptyProfessionalDevGoal(
  index = 1
): ProfessionalDevGoalItem {
  return {
    id: `pd-goal-${Date.now()}-${index}`,
    goalTitle: '',
    currentLevel: '',
    targetLevel: '',
    actions: '',
    resources: '',
    indicators: '',
    result: '',
  };
}

export function createEmptyWeeklyLesson(index = 1): WeeklyLessonItem {
  return {
    id: `weekly-lesson-${Date.now()}-${index}`,
    lessonTitle: '',
    learningOutcomes: '',
    strategiesAndActivities: '',
    toolsAndResources: '',
    assessmentMethods: '',
    homeworkOrTasks: '',
  };
}

export function createEmptyIndividualRemedialGoal(
  index = 1
): IndividualRemedialGoalItem {
  return {
    id: `ind-goal-${Date.now()}-${index}`,
    goalText: '',
    preLevel: '٢ - ضعيف',
    targetLevel: '٤ - جيد',
    postLevel: '٤ - جيد',
    remedialActions: '',
    duration: '',
  };
}

export function createEmptyGroupRemedialSkill(
  index = 1
): GroupRemedialSkillItem {
  return {
    id: `grp-skill-${Date.now()}-${index}`,
    skillName: '',
    preAssessment: '',
    postAssessment: '',
  };
}

export function createEmptyEnrichmentActivity(
  index = 1
): EnrichmentActivityItem {
  return {
    id: `enr-activity-${Date.now()}-${index}`,
    activityTitle: '',
    activityDescription: '',
    executionMethod: '',
  };
}

export function createEmptyStudentProduct(index = 1): StudentProductItem {
  return {
    id: `std-product-${Date.now()}-${index}`,
    productName: '',
    productType: '',
    productDescription: '',
    participatingStudents: '',
  };
}

export function createInitialTeacherPlanData<K extends TeacherPlanFormId>(
  formId: K,
  settings?: SchoolSettings
): TeacherPlanFormMap[K] {
  const defaultTeacher = settings?.userName?.trim() || '';
  const defaultAcademicYear = settings?.academicYear?.trim() || '١٤٤٧هـ';

  switch (formId) {
    case 'professional-development-plan': {
      const data: ProfessionalDevelopmentPlanData = {
        planTitle: 'خطة التطوير المهني وتحسين الأداء التدريسي',
        teacherName: defaultTeacher,
        planType: 'سنوية',
        planStatus: 'قيد التنفيذ',
        subject: '',
        stageAndGrade: '',
        academicPeriod: defaultAcademicYear,
        needDiagnosisCategory: NEED_DIAGNOSIS_OPTIONS[0],
        customNeedDiagnosis: '',
        needDiagnosisDetails: '',
        goals: [createEmptyProfessionalDevGoal(1)],
        followUpFrequency: 'شهرية',
        followUpNotes: '',
        impactEvaluation: '',
        principalNotes: '',
        includePrincipalApproval: true,
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'weekly-teacher-plan': {
      const data: WeeklyTeacherPlanData = {
        planTitle: 'الخطة الأسبوعية للمعلم',
        teacherName: defaultTeacher,
        weekLabel: '',
        weekDate: '',
        subject: '',
        grade: '',
        lessons: [createEmptyWeeklyLesson(1)],
        teacherNotes: '',
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'individual-remedial-plan': {
      const data: IndividualRemedialPlanData = {
        planTitle: 'الخطة العلاجية الفردية',
        teacherName: defaultTeacher,
        studentName: '',
        subject: '',
        grade: '',
        planDate: '',
        weaknessSource: 'مهارة',
        subjectWeaknessTopics: '',
        skillWeaknessName: '',
        periodExamNameAndScore: '',
        semesterExamScoreAndGaps: '',
        hasDiagnosticTest: 'نعم',
        diagnosticTestName: '',
        diagnosticTestResult: '',
        goals: [createEmptyIndividualRemedialGoal(1)],
        followUpAndResults: '',
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'group-remedial-plan': {
      const data: GroupRemedialPlanData = {
        planTitle: 'الخطة العلاجية الجماعية',
        teacherName: defaultTeacher,
        beneficiariesScope: 'مجموعة',
        subject: '',
        grade: '',
        classSection: '',
        studentsCount: '',
        studentNames: '',
        skills: [createEmptyGroupRemedialSkill(1)],
        groupActions: '',
        customizedActionsForStudents: '',
        startDate: '',
        endDate: '',
        weeklyFrequency: '',
        sessionDuration: '',
        improvedStudentsCount: '',
        notEnoughImprovedCount: '',
        skillsImprovementDescription: '',
        recommendations: '',
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'enrichment-plan': {
      const data: EnrichmentPlanData = {
        planTitle: 'الخطة الإثرائية للطلاب المتميزين',
        teacherName: defaultTeacher,
        beneficiariesScope: 'مجموعة',
        subject: '',
        grade: '',
        studentsCount: '',
        studentNames: '',
        nominationReason: '',
        enrichmentTypes: ['إثراء معرفي وتوسيع المحتوى', 'مشروعات بحثية'],
        customEnrichmentType: '',
        startDate: '',
        endDate: '',
        weeklyFrequency: '',
        activityDuration: '',
        activities: [createEmptyEnrichmentActivity(1)],
        developedCapabilities: '',
        activitiesOutputs: '',
        goalsAchievementExtent: '',
        recommendations: '',
        studentProducts: [createEmptyStudentProduct(1)],
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }
  }
}

export function createSampleTeacherPlanFormData<K extends TeacherPlanFormId>(
  formId: K,
  settings?: SchoolSettings
): TeacherPlanFormMap[K] {
  const defaultTeacher =
    settings?.userName?.trim() || 'أ. محمد بن عبدالله الشهري';
  const defaultAcademicYear =
    settings?.academicYear?.trim() || '١٤٤٧هـ — الفصل الدراسي الأول';

  switch (formId) {
    case 'professional-development-plan': {
      const data: ProfessionalDevelopmentPlanData = {
        planTitle: 'خطة التطوير المهني وتحسين الأداء التدريسي',
        teacherName: defaultTeacher,
        planType: 'سنوية',
        planStatus: 'قيد التنفيذ',
        subject: 'الرياضيات',
        stageAndGrade: 'المرحلة المتوسطة — الصف الثاني المتوسط',
        academicPeriod: defaultAcademicYear,
        needDiagnosisCategory:
          'تنويع استراتيجيات التدريس الحديثة والتعلم النشط',
        customNeedDiagnosis: '',
        needDiagnosisDetails:
          'الحاجة إلى تعزيز مشاركة الطلاب الفاعلة داخل الحصة وتوظيف أدوات التقويم التكويني الرقمي لرفع مستوى التحصيل الدراسي.',
        goals: [
          {
            id: 'pd-sample-goal-1',
            goalTitle:
              'تطبيق استراتيجيات التعلم التعاوني والتدريس المتمايز في الحصص الدراسية',
            currentLevel: 'تطبيق جزئي في ٣٠٪ من الحصص',
            targetLevel: 'تطبيق منهجي متكامل في ٨٥٪ من الحصص',
            actions:
              'حضور ورشة تدريبية تخصصية، إعداد بطاقات مهام متدرجة المستويات، وتبادل الزيارات الصفية مع معلمي التخصص.',
            resources:
              'حقيبة استراتيجيات التعلم النشط، أوراق عمل تفاعلية، ومجتمعات التعلم المهنية بالمدرسة.',
            indicators:
              'سجل الملاحظة الصفية، تفاعل الطلاب داخل المجموعات، وارتفاع متوسط إتقان المهارات.',
            result:
              'تحسن ملموس في مشاركة الطلاب وارتفاع نسبة الإتقان إلى ٨٨٪.',
          },
          {
            id: 'pd-sample-goal-2',
            goalTitle: 'توظيف أدوات التقويم التكويني الرقمي لتحليل نتائج الطلاب',
            currentLevel: 'استخدام الاختبارات الورقية التقليدية فقط',
            targetLevel: 'بناء بنوك أسئلة تفاعلية وتحليل فوري عقب كل وحدة',
            actions:
              'تصميم اختبارات قصيرة رقمية، وتحليل الفجوات المهارية مباشرة بعد كل فصل دراسي.',
            resources:
              'المنصة التعليمية المدرسية، نماذج الاختبارات الإلكترونية، ومعمل الحاسب.',
            indicators: 'عدد الاختبارات الرقمية المنفذة وسرعة التدخل العلاجي.',
            result:
              'تنفيذ ٦ اختبارات تشخيصية رقمية ومعالجة فورية لمواطن الضعف.',
          },
        ],
        followUpFrequency: 'شهرية',
        followUpNotes:
          'تتم مراجعة مؤشرات الإنجاز نهاية كل شهر هجري وتحديث شواهد التنفيذ بالتنسيق مع الموجه التربوي.',
        impactEvaluation:
          'أسهمت الخطة في رفع جودة الممارسات التدريسية داخل الصف، وزيادة دافعية الطلاب للتعلم، وتحسن نتائج الاختبارات الدورية بنسبة ١٨٪.',
        principalNotes:
          'جهود مهنية متميزة ومنظمة في تطوير الأداء التدريسي وانعكاس إيجابي واضح على تحصيل الطلاب.',
        includePrincipalApproval: true,
        evidencePhotos: [],
        evidenceLinks: [
          {
            id: 'sample-link-pd-1',
            url: 'https://moe.gov.sa/ar/education/pages/default.aspx',
          },
        ],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'weekly-teacher-plan': {
      const data: WeeklyTeacherPlanData = {
        planTitle: 'الخطة الأسبوعية للمعلم',
        teacherName: defaultTeacher,
        weekLabel: 'الأسبوع السادس',
        weekDate: '2025-10-12',
        subject: 'العلوم',
        grade: 'الثالث المتوسط',
        lessons: [
          {
            id: 'wk-sample-lesson-1',
            lessonTitle: 'الدرس الأول: تركيب الذرة والجدول الدوري',
            learningOutcomes:
              'أن يحدد الطالب مكونات الذرة، ويفسر ترتيب العناصر في الجدول الدوري الحديث بدقة.',
            strategiesAndActivities:
              'التعلم التعاوني، خرائط المفاهيم، ونشاط استقصائي لتصنيف العناصر.',
            toolsAndResources:
              'الكتاب المدرسي، مجسم الذرة، لوحة الجدول الدوري التفاعلية، وعرض مرئي.',
            assessmentMethods:
              'أسئلة شفهية سابرة، بطاقة خروج، وتقويم الأقران للمجموعات.',
            homeworkOrTasks:
              'حل تدريبات تقويم الدرس ص ٤٨ + إعداد بطاقة تعريفية لعنصر كيميائي.',
          },
          {
            id: 'wk-sample-lesson-2',
            lessonTitle: 'الدرس الثاني: الروابط الكيميائية وتكوين المركبات',
            learningOutcomes:
              'أن يقارن الطالب بين الرابطة الأيونية والرابطة التساهمية مع تمثيل التوزيع الإلكتروني.',
            strategiesAndActivities:
              'استراتيجية فكر-زاوج-شارك، والنمذجة الذرية باستخدام الكرات البلاستيكية.',
            toolsAndResources:
              'نماذج الجزيئات، السبورة الذكية، وأوراق عمل تطبيقية.',
            assessmentMethods:
              'اختبار قصير في نهاية الحصة وملاحظة الأداء العملي.',
            homeworkOrTasks:
              'إنجاز المهمة الأدائية في منصة مدرستي حول المركبات الشائعة.',
          },
        ],
        teacherNotes:
          'مراعاة تخصيص ١٠ دقائق في بداية الحصة لمراجعة المفاهيم الأساسية السابقة وربطها بالدرس الجديد.',
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'individual-remedial-plan': {
      const data: IndividualRemedialPlanData = {
        planTitle: 'الخطة العلاجية الفردية',
        teacherName: defaultTeacher,
        studentName: 'عبدالعزيز بن فهد الدوسري',
        subject: 'الرياضيات',
        grade: 'الأول المتوسط — فصل ١/أ',
        planDate: '2025-10-15',
        weaknessSource: 'اختبار فترة',
        subjectWeaknessTopics: '',
        skillWeaknessName: '',
        periodExamNameAndScore:
          'اختبار الفترة الأولى — الدرجة: ٨ من ٢٠ (ضعف في العمليات على الأعداد الصحيحة وترتيب العمليات).',
        semesterExamScoreAndGaps: '',
        hasDiagnosticTest: 'نعم',
        diagnosticTestName: 'اختبار تشخيصي مقنن في مهارات الأعداد الصحيحة',
        diagnosticTestResult:
          'إتقان ٣٥٪ — صعوبة في جمع وطرح الأعداد ذات الإشارات المختلفة.',
        goals: [
          {
            id: 'ind-sample-goal-1',
            goalText: 'إتقان جمع وطرح الأعداد الصحيحة ذات الإشارات المختلفة',
            preLevel: '٢ - ضعيف',
            targetLevel: '٤ - جيد',
            postLevel: '٥ - متقن / متميز',
            remedialActions:
              'تمثيل الأعداد على خط الأعداد + تدريبات متدرجة فردية وأوراق عمل علاجية.',
            duration: 'أسبوعان (٤ حصص علاجية)',
          },
          {
            id: 'ind-sample-goal-2',
            goalText: 'تطبيق أولويات ترتيب العمليات الحسابية بصورة صحيحة',
            preLevel: '١ - ضعيف جدًا',
            targetLevel: '٤ - جيد',
            postLevel: '٤ - جيد',
            remedialActions:
              'خريطة بصرية لتسلسل العمليات + حل أمثلة موجهة مع قرين متميز.',
            duration: 'أسبوع واحد (حصتان)',
          },
        ],
        followUpAndResults:
          'أظهر الطالب التزامًا عاليًا بحل التدريبات العلاجية، وارتفعت درجته في الاختبار البعدي إلى ١٧ من ٢٠ مع إتقان المهارات المستهدفة.',
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'group-remedial-plan': {
      const data: GroupRemedialPlanData = {
        planTitle: 'الخطة العلاجية الجماعية',
        teacherName: defaultTeacher,
        beneficiariesScope: 'مجموعة',
        subject: 'لغتي الخالدة',
        grade: 'الثاني المتوسط',
        classSection: '٢ / ب',
        studentsCount: '٦ طلاب',
        studentNames:
          'ريان الحربي، سلطان العتيبي، نواف القحطاني، فيصل الشمري، طلال الزهراني، بدر المطيري',
        skills: [
          {
            id: 'grp-sample-skill-1',
            skillName: 'رسم الهمزة المتوسطة على الألف والواو والياء رسمًا صحيحًا',
            preAssessment:
              'خلط متكرر بين حركة الهمزة وحركة الحرف الذي قبلها في الإملاء الاختباري.',
            postAssessment:
              'إتقان تطبيق قاعدة أقوى الحركات وكتابة الكلمات المهموزة بدقة عالية.',
          },
          {
            id: 'grp-sample-skill-2',
            skillName: 'التمييز بين الفاعل ونائب الفاعل وضبطهما بالشكل',
            preAssessment:
              'صعوبة في تحديد الفعل المبني للمجهول وتعيين نائب الفاعل في الجمل الفعلية.',
            postAssessment:
              'قدرة واضحة على تحويل الجملة للمبني للمجهول وضبط نائب الفاعل بالحركات.',
          },
        ],
        groupActions:
          'حصص تقوية جماعية باستخدام البطاقات الملونة للحركات، وتدريبات إملائية ونحوية تشاركية في مجموعات صغيرة.',
        customizedActionsForStudents:
          'تخصيص كراسة تدريبات إضافية مبسطة للطالبين (طلال وبدر) مع متابعة فردية يومية لمدة ١٠ دقائق.',
        startDate: '2025-10-05',
        endDate: '2025-10-30',
        weeklyFrequency: 'مرتان أسبوعيًا',
        sessionDuration: '٣٠ دقيقة',
        improvedStudentsCount: '٥ طلاب',
        notEnoughImprovedCount: 'طالب واحد',
        skillsImprovementDescription:
          'تحسن إتقان مهارة الهمزة المتوسطة بنسبة ٨٥٪، ومهارة نائب الفاعل بنسبة ٨٠٪ لدى المجموعة المستهدفة.',
        recommendations:
          'استمرار تعزيز المهارات الإملائية عبر الإملاء المنظور الأسبوعي، وإلحاق الطالب المتبقي بخطة علاجية فردية مركزة.',
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }

    case 'enrichment-plan': {
      const data: EnrichmentPlanData = {
        planTitle: 'الخطة الإثرائية للطلاب المتميزين',
        teacherName: defaultTeacher,
        beneficiariesScope: 'مجموعة',
        subject: 'العلوم والابتكار التقني',
        grade: 'الثالث المتوسط — فصل ٣/أ',
        studentsCount: '٥ طلاب',
        studentNames:
          'أنس الغامدي، عمر السبيعي، زياد المالكي، تميم العلي، خالد اليامي',
        nominationReason:
          'حصول الطلاب على العلامة الكاملة في الاختبارات الدورية وإظهار شغف عالٍ بالبحث العلمي والتفكير الابتكاري.',
        enrichmentTypes: [
          'إثراء معرفي وتوسيع المحتوى',
          'مشروعات بحثية',
          'تطبيقات عملية ومهام أدائية',
          'مسابقات وتحديات علمية',
        ],
        customEnrichmentType: '',
        startDate: '2025-10-01',
        endDate: '2025-11-15',
        weeklyFrequency: 'مرتان أسبوعيًا',
        activityDuration: '٤٥ دقيقة',
        activities: [
          {
            id: 'enr-sample-act-1',
            activityTitle: 'مشروع تصميم نموذج للطاقة المتجددة الذكية',
            activityDescription:
              'بحث علمي تطبيقي حول خلايا الطاقة الشمسية وبناء نموذج مصغر لتتبع الضوء تلقائيًا.',
            executionMethod:
              'العمل في فريق بحثي داخل مختبر العلوم وتجربة الدوائر الإلكترونية وقياس الكفاءة.',
          },
          {
            id: 'enr-sample-act-2',
            activityTitle: 'تحدي حل المشكلات العلمية (أولمبياد العلوم)',
            activityDescription:
              'تدريبات متقدمة على مسائل الاستدلال العلمي والتفكير الناقد خارج نطاق المقررات الاعتيادية.',
            executionMethod:
              'جلسات عصف ذهني وحل أوراق تحديات علمية متدرجة الصعوبة ومناقشة الحلول الإبداعية.',
          },
        ],
        developedCapabilities:
          'تنمية مهارات البحث العلمي، التصميم الهندسي، التفكير الناقد، والعمل الجماعي القيادي.',
        activitiesOutputs:
          'نموذج أولي عامل لمتتبع الطاقة الشمسية + ورقة علمية موثقة وعرض تقديمي أمام طلاب المدرسة.',
        goalsAchievementExtent:
          'تحققت أهداف الخطة الإثرائية بنسبة ٩٥٪ مع جاهزية الطلاب للمشاركة في مسابقات الإبداع العلمي.',
        recommendations:
          'ترشيح الفريق للمشاركة في معرض الأولمبياد الوطني للإبداع العلمي وتعميم تجربتهم في الإذاعة المدرسية.',
        studentProducts: [
          {
            id: 'std-prod-1',
            productName: 'نموذج المتتبع الشمسي الذكي',
            productType: 'ابتكار عملي / نموذج هندسي',
            productDescription:
              'مجسم تفاعلي يوجه الألواح الشمسية نحو مصدر الضوء لزيادة كفاءة توليد الطاقة بنسبة ٣٠٪.',
            participatingStudents: 'أنس الغامدي، عمر السبيعي، زياد المالكي',
          },
          {
            id: 'std-prod-2',
            productName: 'مجلة الفيزياء التطبيقية المدرسية',
            productType: 'إصدار بحثي رقمي',
            productDescription:
              'كتيب رقمي يلخص تجارب الطاقة النظيفة وتطبيقاتها في رؤية المملكة ٢٠٣٠.',
            participatingStudents: 'تميم العلي، خالد اليامي',
          },
        ],
        evidencePhotos: [],
        evidenceLinks: [],
      };
      return data as TeacherPlanFormMap[K];
    }
  }
}

// ============================================================================
// Validation
// ============================================================================

export interface TeacherPlanValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateTeacherPlanForm<K extends TeacherPlanFormId>(
  formId: K,
  data: TeacherPlanFormMap[K]
): TeacherPlanValidationResult {
  const errors: Record<string, string> = {};

  if (!data.planTitle || !data.planTitle.trim()) {
    errors.planTitle = 'يرجى إدخال عنوان الخطة';
  }
  if (!data.teacherName || !data.teacherName.trim()) {
    errors.teacherName = 'يرجى إدخال اسم المعلم';
  }

  switch (formId) {
    case 'professional-development-plan': {
      const d = data as ProfessionalDevelopmentPlanData;
      if (!d.needDiagnosisCategory.trim()) {
        errors.needDiagnosisCategory = 'يرجى اختيار تشخيص الاحتياج';
      }
      if (
        d.needDiagnosisCategory === 'احتياج آخر' &&
        !d.customNeedDiagnosis.trim()
      ) {
        errors.customNeedDiagnosis = 'يرجى كتابة الاحتياج التطويري الآخر';
      }
      if (!d.goals || d.goals.length === 0) {
        errors.goals = 'يرجى إضافة هدف تطويري واحد على الأقل';
      } else {
        const hasValidGoal = d.goals.some((g) => g.goalTitle.trim().length > 0);
        if (!hasValidGoal) {
          errors.goals = 'يرجى تعبئة عنوان الهدف التطويري الأول على الأقل';
        }
      }
      if (!d.followUpFrequency.trim()) {
        errors.followUpFrequency = 'يرجى تحديد دورية المتابعة';
      }
      if (!d.impactEvaluation.trim()) {
        errors.impactEvaluation = 'يرجى إدخال تقويم أثر الخطة';
      }
      break;
    }

    case 'weekly-teacher-plan': {
      const d = data as WeeklyTeacherPlanData;
      if (!d.weekLabel.trim()) errors.weekLabel = 'يرجى إدخال الأسبوع الدراسي';
      if (!d.weekDate.trim()) errors.weekDate = 'يرجى تحديد التاريخ';
      if (!d.subject.trim()) errors.subject = 'يرجى إدخال المادة الدراسية';
      if (!d.grade.trim()) errors.grade = 'يرجى إدخال الصف الدراسي';
      if (!d.lessons || d.lessons.length === 0) {
        errors.lessons = 'يرجى إضافة درس أو موضوع واحد على الأقل';
      } else {
        const hasValidLesson = d.lessons.some(
          (l) => l.lessonTitle.trim().length > 0
        );
        if (!hasValidLesson) {
          errors.lessons = 'يرجى إدخال عنوان الدرس الأول على الأقل';
        }
      }
      break;
    }

    case 'individual-remedial-plan': {
      const d = data as IndividualRemedialPlanData;
      if (!d.studentName.trim()) errors.studentName = 'يرجى إدخال اسم الطالب';
      if (!d.subject.trim()) errors.subject = 'يرجى إدخال المادة الدراسية';
      if (!d.grade.trim()) errors.grade = 'يرجى إدخال الصف';

      if (
        d.weaknessSource === 'مادة دراسية' &&
        !d.subjectWeaknessTopics.trim()
      ) {
        errors.subjectWeaknessTopics =
          'يرجى توضيح موضوعات الضعف في المادة الدراسية';
      }
      if (d.weaknessSource === 'مهارة' && !d.skillWeaknessName.trim()) {
        errors.skillWeaknessName = 'يرجى إدخال اسم المهارة وتوصيف الضعف';
      }
      if (
        d.weaknessSource === 'اختبار فترة' &&
        !d.periodExamNameAndScore.trim()
      ) {
        errors.periodExamNameAndScore =
          'يرجى إدخال بيانات اختبار الفترة ودرجة الطالب';
      }
      if (
        d.weaknessSource === 'اختبار فصلي' &&
        !d.semesterExamScoreAndGaps.trim()
      ) {
        errors.semesterExamScoreAndGaps =
          'يرجى إدخال بيانات الاختبار الفصلي ومواضع الإخفاق';
      }

      if (
        d.hasDiagnosticTest === 'نعم' &&
        !d.diagnosticTestName.trim() &&
        !d.diagnosticTestResult.trim()
      ) {
        errors.diagnosticTestResult =
          'يرجى إدخال بيانات ونتيجة الاختبار التشخيصي';
      }

      if (
        !d.goals ||
        d.goals.length === 0 ||
        !d.goals.some((g) => g.goalText.trim())
      ) {
        errors.goals = 'يرجى إضافة هدف علاجي واحد على الأقل';
      }
      if (!d.followUpAndResults.trim()) {
        errors.followUpAndResults = 'يرجى إدخال المتابعة والنتائج المختصرة';
      }
      break;
    }

    case 'group-remedial-plan': {
      const d = data as GroupRemedialPlanData;
      if (!d.subject.trim()) errors.subject = 'يرجى إدخال المادة الدراسية';
      if (!d.grade.trim()) errors.grade = 'يرجى إدخال الصف الدراسي';
      if (!d.studentsCount.trim())
        errors.studentsCount = 'يرجى إدخال عدد الطلاب المستفيدين';
      if (
        !d.skills ||
        d.skills.length === 0 ||
        !d.skills.some((s) => s.skillName.trim())
      ) {
        errors.skills = 'يرجى إضافة مهارة مستهدفة واحدة على الأقل';
      }
      if (!d.groupActions.trim()) {
        errors.groupActions = 'يرجى إدخال الإجراءات العلاجية الجماعية';
      }
      if (!d.startDate.trim()) errors.startDate = 'يرجى تحديد تاريخ البداية';
      if (!d.endDate.trim()) errors.endDate = 'يرجى تحديد تاريخ النهاية';
      if (!d.weeklyFrequency.trim()) {
        errors.weeklyFrequency = 'يرجى تحديد عدد مرات المعالجة أسبوعيًا';
      }
      if (!d.improvedStudentsCount.trim()) {
        errors.improvedStudentsCount = 'يرجى إدخال عدد الطلاب المتحسنين';
      }
      if (!d.skillsImprovementDescription.trim()) {
        errors.skillsImprovementDescription =
          'يرجى إدخال وصف التحسن للمهارات المستهدفة';
      }
      break;
    }

    case 'enrichment-plan': {
      const d = data as EnrichmentPlanData;
      if (!d.subject.trim()) errors.subject = 'يرجى إدخال المادة / المجال';
      if (!d.grade.trim()) errors.grade = 'يرجى إدخال الصف الدراسي';
      if (!d.nominationReason.trim()) {
        errors.nominationReason = 'يرجى تحديد سبب ترشيح الطلاب للخطة الإثرائية';
      }
      if (!d.enrichmentTypes || d.enrichmentTypes.length === 0) {
        errors.enrichmentTypes = 'يرجى اختيار نوع واحد على الأقل من أنواع الإثراء';
      }
      if (
        d.enrichmentTypes.includes('نوع آخر') &&
        !d.customEnrichmentType.trim()
      ) {
        errors.customEnrichmentType = 'يرجى تحديد نوع الإثراء الآخر';
      }
      if (!d.startDate.trim()) errors.startDate = 'يرجى تحديد تاريخ البداية';
      if (!d.endDate.trim()) errors.endDate = 'يرجى تحديد تاريخ النهاية';
      if (!d.weeklyFrequency.trim()) {
        errors.weeklyFrequency = 'يرجى تحديد عدد مرات التنفيذ أسبوعيًا';
      }
      if (
        !d.activities ||
        d.activities.length === 0 ||
        !d.activities.some((a) => a.activityTitle.trim())
      ) {
        errors.activities = 'يرجى إضافة نشاط إثرائي واحد على الأقل';
      }
      if (!d.developedCapabilities.trim()) {
        errors.developedCapabilities =
          'يرجى توضيح القدرات والمهارات المتطورة لدى الطلاب';
      }
      break;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// LocalStorage Persistence
// ============================================================================

export function loadTeacherPlanDraftFromStorage<K extends TeacherPlanFormId>(
  formId: K,
  settings?: SchoolSettings,
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): TeacherPlanFormMap[K] {
  const fallback = createInitialTeacherPlanData(formId, settings);
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(`${TEACHER_PLANS_STORAGE_KEY}_${formId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    const merged = {
      ...fallback,
      ...parsed,
      teacherName:
        typeof parsed.teacherName === 'string' && parsed.teacherName.trim()
          ? parsed.teacherName
          : fallback.teacherName,
      evidencePhotos: Array.isArray(parsed.evidencePhotos)
        ? parsed.evidencePhotos
        : [],
      evidenceLinks: Array.isArray(parsed.evidenceLinks)
        ? parsed.evidenceLinks
        : [],
    };
    return merged as TeacherPlanFormMap[K];
  } catch {
    return fallback;
  }
}

export function saveTeacherPlanDraftToStorage<K extends TeacherPlanFormId>(
  formId: K,
  data: TeacherPlanFormMap[K],
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): void {
  if (!storage) return;
  try {
    storage.setItem(
      `${TEACHER_PLANS_STORAGE_KEY}_${formId}`,
      JSON.stringify(data)
    );
  } catch {
    // Ignore storage quota errors safely
  }
}

export function clearTeacherPlanDraftInStorage(
  formId: TeacherPlanFormId,
  storage: Pick<Storage, 'removeItem'> | undefined = typeof window !==
  'undefined'
    ? window.localStorage
    : undefined
): void {
  if (!storage) return;
  try {
    storage.removeItem(`${TEACHER_PLANS_STORAGE_KEY}_${formId}`);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Document Builder (Maps Plan Forms -> Unified TeacherReportDocument)
// ============================================================================

function formatDateFieldValue(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const hijri = formatGregorianToUmmAlQuraHijri(trimmed);
    return hijri && hijri !== trimmed ? `${hijri} (${trimmed})` : trimmed;
  }
  return trimmed;
}

function splitLinesToList(text: string): string[] {
  return (text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function makeTextOrListSection(
  id: string,
  title: string,
  rawText: string
): TeacherReportContentSection {
  const lines = splitLinesToList(rawText);
  if (lines.length > 1) {
    return {
      id,
      title,
      type: 'list',
      items: lines,
    };
  }
  return {
    id,
    title,
    type: 'text',
    content: lines[0] || rawText.trim() || '—',
  };
}

/**
 * Ensures a plan document with a strict page ceiling (`maxPages`) does not overflow
 * by progressively consolidating multi-part sections into a more compact layout if needed.
 */
function enforceMaxPagesConstraint(
  doc: TeacherReportDocument,
  settings: SchoolSettings,
  maxPages: number
): TeacherReportDocument {
  const initialPages = paginateTeacherReportBlocks(doc, settings);
  if (initialPages.length <= maxPages) {
    return doc;
  }

  // Stage 1 compaction: merge consecutive field/list sections into compact list sections
  const compactedSections: TeacherReportContentSection[] = [];
  for (const sec of doc.sections) {
    if (sec.type === 'fields' && Array.isArray(sec.fields)) {
      const summaryLine = sec.fields
        .filter((f) => f.value && f.value.trim() && f.value.trim() !== '—')
        .map((f) => `${f.label}: ${f.value.trim()}`)
        .join(' | ');
      if (summaryLine) {
        compactedSections.push({
          id: sec.id,
          title: sec.title,
          type: 'text',
          content: summaryLine,
        });
      }
    } else {
      compactedSections.push(sec);
    }
  }

  const stage1Doc: TeacherReportDocument = {
    ...doc,
    sections: compactedSections,
  };
  if (paginateTeacherReportBlocks(stage1Doc, settings).length <= maxPages) {
    return stage1Doc;
  }

  // Stage 2 compaction: combine multiple sections into consolidated grouped sections
  const mergedItems: string[] = [];
  for (const sec of stage1Doc.sections) {
    if (sec.type === 'list' && sec.items) {
      mergedItems.push(`${sec.title}: ${sec.items.join(' — ')}`);
    } else if (sec.content) {
      mergedItems.push(`${sec.title}: ${sec.content}`);
    }
  }

  const stage2Doc: TeacherReportDocument = {
    ...doc,
    sections: [
      {
        id: 'consolidated-plan-summary',
        title: 'محاور الخطة والإجراءات والنتائج',
        type: 'list',
        items: mergedItems.slice(0, maxPages === 2 ? 8 : 14),
      },
    ],
  };

  return stage2Doc;
}

export function buildTeacherPlanDocumentFromForm<K extends TeacherPlanFormId>(
  formId: K,
  data: TeacherPlanFormMap[K],
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
  const gendered = getGenderedLabels(settings.gender);
  const teacherFieldLabel =
    gendered.gender === 'female' ? 'اسم المعلمة' : 'اسم المعلم';

  const principalName = settings.principalName?.trim() || '';
  const hasPrincipal = Boolean(principalName);

  switch (formId) {
    case 'professional-development-plan': {
      const d = data as ProfessionalDevelopmentPlanData;
      const resolvedDiagnosis =
        d.needDiagnosisCategory === 'احتياج آخر'
          ? d.customNeedDiagnosis.trim() || 'احتياج تطويري آخر'
          : d.needDiagnosisCategory.trim() || '—';

      const basicFields: TeacherReportBasicField[] = [
        {
          id: 'teacherName',
          label: teacherFieldLabel,
          value: d.teacherName.trim() || '—',
          width: 'half',
        },
        {
          id: 'planTypeAndStatus',
          label: 'نوع الخطة وحالتها',
          value: `${d.planType} — ${d.planStatus}`,
          width: 'half',
        },
      ];

      if (d.subject.trim() || d.stageAndGrade.trim()) {
        basicFields.push(
          {
            id: 'subject',
            label: 'التخصص / المادة',
            value: d.subject.trim() || '—',
            width: 'half',
          },
          {
            id: 'stageAndGrade',
            label: 'المرحلة / الصف',
            value: d.stageAndGrade.trim() || '—',
            width: 'half',
          }
        );
      }

      basicFields.push(
        {
          id: 'academicPeriod',
          label: 'الفترة / العام الدراسي',
          value: d.academicPeriod.trim() || '—',
          width: 'half',
        },
        {
          id: 'followUpFrequency',
          label: 'دورية المتابعة',
          value: d.followUpFrequency.trim() || 'شهرية',
          width: 'half',
        },
        {
          id: 'needDiagnosis',
          label: 'تشخيص الاحتياج التطويري',
          value: d.needDiagnosisDetails.trim()
            ? `${resolvedDiagnosis} — ${d.needDiagnosisDetails.trim()}`
            : resolvedDiagnosis,
          width: 'full',
        }
      );

      const sections: TeacherReportContentSection[] = [];

      // Each developmental goal gets an independent structured section
      const activeGoals = (d.goals || []).filter(
        (g) =>
          g.goalTitle.trim() ||
          g.actions.trim() ||
          g.currentLevel.trim() ||
          g.targetLevel.trim()
      );

      if (activeGoals.length === 0) {
        sections.push({
          id: 'goal-empty',
          title: 'الأهداف التطويرية وسجل التنفيذ',
          type: 'text',
          content: '—',
        });
      } else {
        activeGoals.forEach((goal, idx) => {
          const goalNumber = idx + 1;
          sections.push({
            id: `pd-goal-${goalNumber}`,
            title:
              activeGoals.length === 1
                ? `الهدف التطويري: ${goal.goalTitle.trim() || '—'}`
                : `الهدف التطويري (${goalNumber}): ${goal.goalTitle.trim() || '—'}`,
            type: 'fields',
            fields: [
              {
                id: `g-${idx}-current`,
                label: 'مستوى الأداء الحالي',
                value: goal.currentLevel.trim() || '—',
                width: 'half',
              },
              {
                id: `g-${idx}-target`,
                label: 'المستوى المستهدف',
                value: goal.targetLevel.trim() || '—',
                width: 'half',
              },
              {
                id: `g-${idx}-actions`,
                label: 'الإجراءات التنفيذية',
                value: goal.actions.trim() || '—',
                width: 'full',
              },
              {
                id: `g-${idx}-resources`,
                label: 'الموارد والوسائل',
                value: goal.resources.trim() || '—',
                width: 'half',
              },
              {
                id: `g-${idx}-indicators`,
                label: 'مؤشرات القياس',
                value: goal.indicators.trim() || '—',
                width: 'half',
              },
              {
                id: `g-${idx}-result`,
                label: 'النتيجة المتحققة',
                value: goal.result.trim() || '—',
                width: 'full',
              },
            ],
          });
        });
      }

      if (d.followUpNotes.trim()) {
        sections.push(
          makeTextOrListSection(
            'followUpNotes',
            `المتابعة الدورية (${d.followUpFrequency.trim() || 'شهرية'})`,
            d.followUpNotes
          )
        );
      }

      sections.push(
        makeTextOrListSection(
          'impactEvaluation',
          'تقويم أثر الخطة',
          d.impactEvaluation
        )
      );

      if (d.principalNotes.trim()) {
        sections.push(
          makeTextOrListSection(
            'principalNotes',
            `ملاحظات ${gendered.principalTitle}`,
            d.principalNotes
          )
        );
      }

      const allowSignoff = Boolean(d.includePrincipalApproval && hasPrincipal);

      return {
        reportTypeLabel:
          d.planTitle.trim() || 'خطة التطوير المهني وتحسين الأداء التدريسي',
        reportMainTitle: resolvedDiagnosis,
        templateStyle,
        colorSystem,
        basicFields,
        sections,
        evidencePhotos: d.evidencePhotos,
        evidenceLinks: d.evidenceLinks,
        principalName: allowSignoff ? principalName : '',
        includePrincipalSignoff: allowSignoff,
      };
    }

    case 'weekly-teacher-plan': {
      const d = data as WeeklyTeacherPlanData;
      const basicFields: TeacherReportBasicField[] = [
        {
          id: 'teacherName',
          label: teacherFieldLabel,
          value: d.teacherName.trim() || '—',
          width: 'half',
        },
        {
          id: 'weekLabel',
          label: 'الأسبوع الدراسي',
          value: d.weekLabel.trim() || '—',
          width: 'half',
        },
        {
          id: 'weekDate',
          label: 'التاريخ',
          value: formatDateFieldValue(d.weekDate),
          width: 'half',
        },
        {
          id: 'subjectAndGrade',
          label: 'المادة والصف',
          value: `${d.subject.trim() || '—'} — ${d.grade.trim() || '—'}`,
          width: 'half',
        },
      ];

      const sections: TeacherReportContentSection[] = [];
      const activeLessons = (d.lessons || []).filter(
        (l) =>
          l.lessonTitle.trim() ||
          l.learningOutcomes.trim() ||
          l.strategiesAndActivities.trim()
      );

      if (activeLessons.length === 0) {
        sections.push({
          id: 'lesson-empty',
          title: 'الدروس والموضوعات الأسبوعية',
          type: 'text',
          content: '—',
        });
      } else {
        activeLessons.forEach((lesson, idx) => {
          const num = idx + 1;
          sections.push({
            id: `weekly-lesson-${num}`,
            title:
              activeLessons.length === 1
                ? `الدرس / الموضوع: ${lesson.lessonTitle.trim() || '—'}`
                : `الدرس (${num}): ${lesson.lessonTitle.trim() || '—'}`,
            type: 'fields',
            fields: [
              {
                id: `l-${idx}-outcomes`,
                label: 'نواتج التعلم',
                value: lesson.learningOutcomes.trim() || '—',
                width: 'full',
              },
              {
                id: `l-${idx}-strategies`,
                label: 'الاستراتيجيات والأنشطة',
                value: lesson.strategiesAndActivities.trim() || '—',
                width: 'half',
              },
              {
                id: `l-${idx}-tools`,
                label: 'الوسائل والمصادر',
                value: lesson.toolsAndResources.trim() || '—',
                width: 'half',
              },
              {
                id: `l-${idx}-assessment`,
                label: 'أساليب التقويم',
                value: lesson.assessmentMethods.trim() || '—',
                width: 'half',
              },
              {
                id: `l-${idx}-homework`,
                label: 'الواجبات / المهام الأدائية',
                value: lesson.homeworkOrTasks.trim() || '—',
                width: 'half',
              },
            ],
          });
        });
      }

      if (d.teacherNotes.trim()) {
        sections.push(
          makeTextOrListSection(
            'teacherNotes',
            `ملاحظات ${gendered.gender === 'female' ? 'المعلمة' : 'المعلم'}`,
            d.teacherNotes
          )
        );
      }

      return {
        reportTypeLabel: d.planTitle.trim() || 'الخطة الأسبوعية للمعلم',
        reportMainTitle:
          `${d.subject.trim() || ''} — ${d.weekLabel.trim() || ''}`.replace(
            /^\s*—\s*|\s*—\s*$/g,
            ''
          ) || 'الخطة الأسبوعية للمعلم',
        templateStyle,
        colorSystem,
        basicFields,
        sections,
        evidencePhotos: d.evidencePhotos,
        evidenceLinks: d.evidenceLinks,
        principalName: hasPrincipal ? principalName : '',
        includePrincipalSignoff: hasPrincipal,
      };
    }

    case 'individual-remedial-plan': {
      const d = data as IndividualRemedialPlanData;

      let weaknessDetailsValue = '—';
      let weaknessDetailsLabel = 'بيانات موضع الضعف';
      if (d.weaknessSource === 'مادة دراسية') {
        weaknessDetailsLabel = 'موضوعات الضعف في المادة';
        weaknessDetailsValue = d.subjectWeaknessTopics.trim() || '—';
      } else if (d.weaknessSource === 'مهارة') {
        weaknessDetailsLabel = 'المهارة المستهدفة بالمعالجة';
        weaknessDetailsValue = d.skillWeaknessName.trim() || '—';
      } else if (d.weaknessSource === 'اختبار فترة') {
        weaknessDetailsLabel = 'بيانات اختبار الفترة والدرجة';
        weaknessDetailsValue = d.periodExamNameAndScore.trim() || '—';
      } else if (d.weaknessSource === 'اختبار فصلي') {
        weaknessDetailsLabel = 'بيانات الاختبار الفصلي ومواضع الإخفاق';
        weaknessDetailsValue = d.semesterExamScoreAndGaps.trim() || '—';
      }

      const basicFields: TeacherReportBasicField[] = [
        {
          id: 'studentName',
          label: 'اسم الطالب المستهدف',
          value: d.studentName.trim() || '—',
          width: 'half',
        },
        {
          id: 'teacherName',
          label: teacherFieldLabel,
          value: d.teacherName.trim() || '—',
          width: 'half',
        },
        {
          id: 'subjectAndGrade',
          label: 'المادة والصف',
          value: `${d.subject.trim() || '—'} — ${d.grade.trim() || '—'}`,
          width: 'half',
        },
        {
          id: 'planDateAndSource',
          label: 'التاريخ ومصدر الضعف',
          value: `${formatDateFieldValue(d.planDate)} | المصدر: ${d.weaknessSource}`,
          width: 'half',
        },
        {
          id: 'weaknessDetails',
          label: weaknessDetailsLabel,
          value: weaknessDetailsValue,
          width: 'full',
        },
      ];

      if (d.hasDiagnosticTest === 'نعم') {
        basicFields.push({
          id: 'diagnosticTestInfo',
          label: 'الاختبار التشخيصي ونتيجته',
          value:
            [d.diagnosticTestName.trim(), d.diagnosticTestResult.trim()]
              .filter(Boolean)
              .join(' — ') || 'تم إجراء اختبار تشخيصي',
          width: 'full',
        });
      } else {
        basicFields.push({
          id: 'diagnosticTestInfo',
          label: 'هل تم إجراء اختبار تشخيصي؟',
          value: 'لا',
          width: 'full',
        });
      }

      const activeGoals = (d.goals || []).filter(
        (g) => g.goalText.trim() || g.remedialActions.trim()
      );

      const goalItems =
        activeGoals.length > 0
          ? activeGoals.map((g, idx) => {
              const title = g.goalText.trim() || `الهدف ${idx + 1}`;
              const ratings = `[قبل التدخل: ${g.preLevel} | المستهدف: ${g.targetLevel} | بعد التدخل: ${g.postLevel}]`;
              const actions = g.remedialActions.trim()
                ? `الإجراءات: ${g.remedialActions.trim()}`
                : '';
              const duration = g.duration.trim()
                ? `المدة: ${g.duration.trim()}`
                : '';
              return [title, ratings, actions, duration]
                .filter(Boolean)
                .join(' — ');
            })
          : ['—'];

      const sections: TeacherReportContentSection[] = [
        {
          id: 'remedialGoalsList',
          title: 'الأهداف العلاجية وسلم التقدير الخماسي والإجراءات',
          type: 'list',
          items: goalItems,
        },
        makeTextOrListSection(
          'followUpAndResults',
          'المتابعة والنتائج المختصرة',
          d.followUpAndResults
        ),
      ];

      const rawDoc: TeacherReportDocument = {
        reportTypeLabel: d.planTitle.trim() || 'الخطة العلاجية الفردية',
        reportMainTitle: d.studentName.trim()
          ? `الطالب: ${d.studentName.trim()} (${d.subject.trim() || '—'})`
          : 'الخطة العلاجية الفردية',
        templateStyle,
        colorSystem,
        basicFields,
        sections,
        evidencePhotos: d.evidencePhotos,
        evidenceLinks: d.evidenceLinks,
        principalName: hasPrincipal ? principalName : '',
        includePrincipalSignoff: hasPrincipal,
      };

      // Strictly enforce max 2 pages
      return enforceMaxPagesConstraint(rawDoc, settings, 2);
    }

    case 'group-remedial-plan': {
      const d = data as GroupRemedialPlanData;
      const basicFields: TeacherReportBasicField[] = [
        {
          id: 'teacherName',
          label: teacherFieldLabel,
          value: d.teacherName.trim() || '—',
          width: 'half',
        },
        {
          id: 'beneficiariesScope',
          label: 'نطاق المستفيدين وعددهم',
          value: `${d.beneficiariesScope} (${d.studentsCount.trim() || '—'})`,
          width: 'half',
        },
        {
          id: 'subjectAndGrade',
          label: 'المادة والصف والشعبة',
          value: [d.subject.trim(), d.grade.trim(), d.classSection.trim()]
            .filter(Boolean)
            .join(' — ') || '—',
          width: 'half',
        },
        {
          id: 'scheduleInfo',
          label: 'الفترة الزمنية والتكرار الأسبوعي',
          value: [
            `${formatDateFieldValue(d.startDate)} إلى ${formatDateFieldValue(d.endDate)}`,
            d.weeklyFrequency.trim(),
            d.sessionDuration.trim() ? `(${d.sessionDuration.trim()})` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          width: 'half',
        },
      ];

      if (d.studentNames.trim()) {
        basicFields.push({
          id: 'studentNames',
          label: 'أسماء الطلاب المستفيدين',
          value: d.studentNames.trim(),
          width: 'full',
        });
      }

      const activeSkills = (d.skills || []).filter(
        (s) =>
          s.skillName.trim() ||
          s.preAssessment.trim() ||
          s.postAssessment.trim()
      );

      const skillItems =
        activeSkills.length > 0
          ? activeSkills.map((s, idx) => {
              const name = s.skillName.trim() || `مهارة ${idx + 1}`;
              const pre = s.preAssessment.trim() || '—';
              const post = s.postAssessment.trim() || '—';
              return `المهارة (${idx + 1}): ${name} | قبل المعالجة: ${pre} | بعد المعالجة: ${post}`;
            })
          : ['—'];

      const sections: TeacherReportContentSection[] = [
        {
          id: 'skillsEvaluation',
          title: 'المهارات المستهدفة والتقييم الوصفي (قبل المعالجة وبعدها)',
          type: 'list',
          items: skillItems,
        },
        {
          id: 'remedialActionsSection',
          title: 'الإجراءات العلاجية الجماعية والمخصصة',
          type: 'fields',
          fields: [
            {
              id: 'groupActions',
              label: 'الإجراءات العلاجية الجماعية',
              value: d.groupActions.trim() || '—',
              width: 'full',
            },
            ...(d.customizedActionsForStudents.trim()
              ? [
                  {
                    id: 'customActions',
                    label: 'تخصيص إجراء لبعض الطلاب',
                    value: d.customizedActionsForStudents.trim(),
                    width: 'full' as const,
                  },
                ]
              : []),
          ],
        },
        {
          id: 'impactMeasurementSection',
          title: 'قياس الأثر والنتائج والتوصيات',
          type: 'fields',
          fields: [
            {
              id: 'improvedCount',
              label: 'عدد الطلاب المتحسنين',
              value: d.improvedStudentsCount.trim() || '—',
              width: 'half',
            },
            {
              id: 'notImprovedCount',
              label: 'عدد من لم يتحسنوا بما يكفي',
              value: d.notEnoughImprovedCount.trim() || '٠',
              width: 'half',
            },
            {
              id: 'improvementDesc',
              label: 'وصف التحسن لكل مهارة',
              value: d.skillsImprovementDescription.trim() || '—',
              width: 'full',
            },
            ...(d.recommendations.trim()
              ? [
                  {
                    id: 'recommendations',
                    label: 'التوصيات',
                    value: d.recommendations.trim(),
                    width: 'full' as const,
                  },
                ]
              : []),
          ],
        },
      ];

      const rawDoc: TeacherReportDocument = {
        reportTypeLabel: d.planTitle.trim() || 'الخطة العلاجية الجماعية',
        reportMainTitle: `${d.subject.trim() || 'الخطة العلاجية الجماعية'} — ${d.grade.trim() || ''}`.replace(
          /\s*—\s*$/,
          ''
        ),
        templateStyle,
        colorSystem,
        basicFields,
        sections,
        evidencePhotos: d.evidencePhotos,
        evidenceLinks: d.evidenceLinks,
        principalName: hasPrincipal ? principalName : '',
        includePrincipalSignoff: hasPrincipal,
      };

      // Strictly enforce max 3 pages
      return enforceMaxPagesConstraint(rawDoc, settings, 3);
    }

    case 'enrichment-plan': {
      const d = data as EnrichmentPlanData;
      const resolvedTypes = (d.enrichmentTypes || [])
        .map((t) =>
          t === 'نوع آخر'
            ? d.customEnrichmentType.trim() || 'نوع إثرائي آخر'
            : t
        )
        .filter(Boolean)
        .join(' ، ');

      const basicFields: TeacherReportBasicField[] = [
        {
          id: 'teacherName',
          label: teacherFieldLabel,
          value: d.teacherName.trim() || '—',
          width: 'half',
        },
        {
          id: 'beneficiariesScope',
          label: 'المستفيدون وعددهم',
          value: d.studentsCount.trim()
            ? `${d.beneficiariesScope} (${d.studentsCount.trim()})`
            : d.beneficiariesScope,
          width: 'half',
        },
        {
          id: 'subjectAndGrade',
          label: 'المادة والصف',
          value: `${d.subject.trim() || '—'} — ${d.grade.trim() || '—'}`,
          width: 'half',
        },
        {
          id: 'scheduleInfo',
          label: 'الفترة الزمنية والتنفيذ الأسبوعي',
          value: [
            `${formatDateFieldValue(d.startDate)} إلى ${formatDateFieldValue(d.endDate)}`,
            d.weeklyFrequency.trim(),
            d.activityDuration.trim() ? `(${d.activityDuration.trim()})` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          width: 'half',
        },
        {
          id: 'nominationReason',
          label: 'سبب الترشيح للخطة الإثرائية',
          value: d.nominationReason.trim() || '—',
          width: 'full',
        },
        {
          id: 'enrichmentTypes',
          label: 'أنواع الإثراء المعتمدة',
          value: resolvedTypes || '—',
          width: 'full',
        },
      ];

      if (d.studentNames.trim()) {
        basicFields.push({
          id: 'studentNames',
          label: 'أسماء الطلاب المرشحين',
          value: d.studentNames.trim(),
          width: 'full',
        });
      }

      const activeActivities = (d.activities || []).filter(
        (a) =>
          a.activityTitle.trim() ||
          a.activityDescription.trim() ||
          a.executionMethod.trim()
      );
      const activityItems =
        activeActivities.length > 0
          ? activeActivities.map((a, idx) => {
              const title = a.activityTitle.trim() || `نشاط ${idx + 1}`;
              const desc = a.activityDescription.trim()
                ? `الوصف: ${a.activityDescription.trim()}`
                : '';
              const method = a.executionMethod.trim()
                ? `طريقة التنفيذ: ${a.executionMethod.trim()}`
                : '';
              return [`النشاط (${idx + 1}): ${title}`, desc, method]
                .filter(Boolean)
                .join(' — ');
            })
          : ['—'];

      const activeProducts = (d.studentProducts || []).filter(
        (p) =>
          p.productName.trim() ||
          p.productType.trim() ||
          p.productDescription.trim()
      );
      const productItems =
        activeProducts.length > 0
          ? activeProducts.map((p, idx) => {
              const name = p.productName.trim() || `منتج ${idx + 1}`;
              const type = p.productType.trim() ? `(${p.productType.trim()})` : '';
              const desc = p.productDescription.trim()
                ? `الوصف: ${p.productDescription.trim()}`
                : '';
              const students = p.participatingStudents.trim()
                ? `الطلاب المشاركون: ${p.participatingStudents.trim()}`
                : '';
              return [`${name} ${type}`.trim(), desc, students]
                .filter(Boolean)
                .join(' — ');
            })
          : ['—'];

      const sections: TeacherReportContentSection[] = [
        {
          id: 'enrichmentActivities',
          title: 'الأنشطة الإثرائية وطريقة تنفيذها',
          type: 'list',
          items: activityItems,
        },
        {
          id: 'studentProductsSection',
          title: 'منتجات الطلاب وإنجازاتهم',
          type: 'list',
          items: productItems,
        },
        {
          id: 'descriptiveImpactSection',
          title: 'قياس الأثر الوصفي للخطة الإثرائية',
          type: 'fields',
          fields: [
            {
              id: 'developedCapabilities',
              label: 'القدرات والمهارات المتطورة',
              value: d.developedCapabilities.trim() || '—',
              width: 'half',
            },
            {
              id: 'activitiesOutputs',
              label: 'مخرجات الأنشطة',
              value: d.activitiesOutputs.trim() || '—',
              width: 'half',
            },
            {
              id: 'goalsAchievementExtent',
              label: 'مدى تحقق الأهداف',
              value: d.goalsAchievementExtent.trim() || '—',
              width: 'full',
            },
            ...(d.recommendations.trim()
              ? [
                  {
                    id: 'recommendations',
                    label: 'التوصيات',
                    value: d.recommendations.trim(),
                    width: 'full' as const,
                  },
                ]
              : []),
          ],
        },
      ];

      const rawDoc: TeacherReportDocument = {
        reportTypeLabel: d.planTitle.trim() || 'الخطة الإثرائية',
        reportMainTitle: `${d.subject.trim() || 'الخطة الإثرائية'} — ${d.grade.trim() || ''}`.replace(
          /\s*—\s*$/,
          ''
        ),
        templateStyle,
        colorSystem,
        basicFields,
        sections,
        evidencePhotos: d.evidencePhotos,
        evidenceLinks: d.evidenceLinks,
        principalName: hasPrincipal ? principalName : '',
        includePrincipalSignoff: hasPrincipal,
      };

      // Strictly enforce max 3 pages
      return enforceMaxPagesConstraint(rawDoc, settings, 3);
    }
  }
}
