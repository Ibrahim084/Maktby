import {
  APPROVED_SCHOOL_SEMESTERS,
  ApprovedSchoolSemester,
  SchoolSettings,
} from '../types';
import {
  getGenderedLabels,
  getRoleForSection,
  loadSettingsFromStorage,
  normalizeApprovedSemester,
} from './settingsStorage';
import {
  computeCrc32,
  createZipArchiveBytes,
  sanitizeFilenameSegment,
  ZipFileEntry,
} from './zipBuilder';

// ============================================================================
// ١. الهوية البصرية المعتمدة لسجل منسق الموهوبين
// ============================================================================

export const GIFTED_VISUAL_IDENTITY = {
  primaryBurgundyHex: '#7F1D3F',
  primaryBurgundyHoverHex: '#641631',
  primaryBurgundyActiveHex: '#4E1026',
  charcoalHex: '#26323B',
  charcoalHoverHex: '#1B242B',
  whiteHex: '#FFFFFF',
  softSurfaceHex: '#FAF7F5',
  cardNeutralHex: '#F5F0EE',
  burgundyTintHex: '#F9EFF2',
  burgundyBorderHex: '#E6C7D0',
} as const;

export const GIFTED_RECORD_STORAGE_KEY = 'maktabi_gifted_coordinator_record_v1';
export const GIFTED_EVIDENCE_DB_NAME = 'maktabi_gifted_evidence_db_v1';
export const GIFTED_EVIDENCE_STORE_NAME = 'evidence_blobs';
export const GIFTED_BACKUP_SCHEMA_VERSION = 1;

// ============================================================================
// ٢. كتالوج الأقسام العشرة المعتمدة وبترتيبها الإلزامي
// ============================================================================

export type GiftedSectionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface GiftedSectionCatalogEntry {
  sectionNumber: GiftedSectionNumber;
  code: string;
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  implementationPhase: 1 | 2 | 3;
}

export const GIFTED_SECTIONS_CATALOG: GiftedSectionCatalogEntry[] = [
  {
    sectionNumber: 1,
    code: '01',
    id: 'cover-basic-info',
    title: 'الغلاف والبيانات الأساسية',
    shortTitle: '١. الغلاف والبيانات الأساسية',
    description:
      'تعريف السجل رسمياً، والمرحلة الدراسية، والفصل الدراسي، ومعاينة الغلاف الرسمي المرتبط بالإعدادات المركزية.',
    implementationPhase: 1,
  },
  {
    sectionNumber: 2,
    code: '02',
    id: 'plan-and-objectives',
    title: 'الخطة والأهداف',
    shortTitle: '٢. الخطة والأهداف',
    description:
      'المقدمة والأهداف العامة والمدرسية، ومهام منسق الموهوبين، وجدول الخطة التنفيذية للعام الدراسي.',
    implementationPhase: 1,
  },
  {
    sectionNumber: 3,
    code: '03',
    id: 'programs-and-initiatives',
    title: 'البرامج والمبادرات',
    shortTitle: '٣. البرامج والمبادرات',
    description:
      'البرامج الوزارية المعتمدة، والمبادرات والفعاليات المعدة من منسق الموهوبين، والمسابقات العلمية.',
    implementationPhase: 1,
  },
  {
    sectionNumber: 4,
    code: '04',
    id: 'target-audience-and-schedule',
    title: 'الفئة المستهدفة ومواعيد التنفيذ',
    shortTitle: '٤. الفئة المستهدفة والمواعيد',
    description:
      'تحديد المراحل والفئات المستهدفة ومواعيد التنفيذ والأسبوع الاختياري لجميع البرامج والمبادرات والمسابقات.',
    implementationPhase: 1,
  },
  {
    sectionNumber: 5,
    code: '05',
    id: 'execution-indicators',
    title: 'مؤشرات التنفيذ',
    shortTitle: '٥. مؤشرات التنفيذ',
    description:
      'مؤشرات إنجاز الخطة التنفيذية ومؤشرات إنجاز إجراءات البرامج المفعلة بشكل مستقل.',
    implementationPhase: 2,
  },
  {
    sectionNumber: 6,
    code: '06',
    id: 'execution-log',
    title: 'سجل التنفيذ',
    shortTitle: '٦. سجل التنفيذ',
    description:
      'محرك الإجراءات الموحد لمتابعة تنفيذ الإجراءات الأصلية المستقلة لكل برنامج ومسار.',
    implementationPhase: 2,
  },
  {
    sectionNumber: 7,
    code: '07',
    id: 'students-and-achievements',
    title: 'سجل الطلاب والمشاركات والإنجازات',
    shortTitle: '٧. الطلاب والمشاركات والإنجازات',
    description:
      'حصر الطلبة الموهوبين بالمدرسة وربط مشاركاتهم وترشيحاتهم وتأهلهم في البرامج والمسابقات.',
    implementationPhase: 2,
  },
  {
    sectionNumber: 8,
    code: '08',
    id: 'evidence-repository',
    title: 'مستودع الشواهد',
    shortTitle: '٨. مستودع الشواهد',
    description:
      'الشواهد المصورة والروابط الإلكترونية الاختيارية (بحد أقصى ٤ شواهد و٤ روابط QR لكل برنامج).',
    implementationPhase: 3,
  },
  {
    sectionNumber: 9,
    code: '09',
    id: 'followup-and-evaluation',
    title: 'المتابعة والتقييم',
    shortTitle: '٩. المتابعة والتقييم',
    description:
      'أسباب عدم التنفيذ، ومتابعة الحالات، والإيجابيات والصعوبات والمقترحات التطويرية.',
    implementationPhase: 3,
  },
  {
    sectionNumber: 10,
    code: '10',
    id: 'final-and-periodic-reports',
    title: 'التقارير النهائية والدورية',
    shortTitle: '١٠. التقارير النهائية والدورية',
    description:
      'إصدار التقارير الإدارية المختصرة وتقارير البرامج بصيغة PDF بالهوية العنابية والفحمية المعتمدة.',
    implementationPhase: 3,
  },
];

// ============================================================================
// ٣. النصوص والأهداف والمهام المرجعية المستخرجة من الملف الأصلي (ص 2–5، ص 34)
// (تخص عمل منسق الموهوبين فقط — بدون قيمنا وبدون مهام المدير أو الموجه الطلابي)
// ============================================================================

export const GIFTED_INTRODUCTION_TEXT =
  'يمثل المتفوقون والموهوبون قطاعاً هاماً من القوى والإمكانات الإنسانية لما لهم من ذكاء عالٍ ومواهب خاصة وقدرة على الابتكار والتوجيه والقيادة، وبما أن البيئة المدرسية حاضنة لهذه الفئة فإن للمدرسة مهام متعددة للإسهام في التعرف على الموهوبين واكتشافهم بناءً على السمات المحددة للطلاب الموهوبين وتقديم برامج الرعاية الملائمة لقدراتهم وتهيئة بيئة تعليمية مناسبة لهم، من خلال الأساليب العلمية للتعرف على الموهوبين ورعايتهم وتقديم الخدمات التربوية المناسبة لهم عن طريق التنسيق بين عناصر العملية التربوية والتعليمية وتسخير الإمكانيات المتاحة.';

export const GIFTED_GENERAL_OBJECTIVES: string[] = [
  'تطوير البرنامج في إعداد المقاييس والأساليب والطرق العلمية التي تستخدم في التعرف على الأطفال والتلاميذ الموهوبين والكشف عنهم وتطبيق ذلك عليهم.',
  'تقديم الرعاية العلمية والتعليمية للطلاب الموهوبين على شكل برامج إثرائية إضافية تتميز بخصائص نوعية ملائمة لطبيعة الموهوبين.',
  'التعاون مع أولياء أمور الطلاب الموهوبين وأسرهم ومعلميهم في توعيتهم بقدرات أبنائهم وكيفية التعامل معهم وتوفير الإمكانات التي تساعد على نمو قدراتهم وإبداعاتهم.',
  'تشجيع الطلبة الموهوبين في التعبير عن مواهبهم وإبداعاتهم واختراعاتهم على شكل مسابقات وجوائز مادية ومعنوية تساعد على تحفيزهم.',
  'تقديم الرعاية النفسية والاجتماعية للموهوبين وأسرهم والمساعدة في حل مشاكلهم المتنوعة التي تحد من نمو قدراتهم ومواهبهم.',
  'تشجيع البحوث العلمية في مجال دراسات رعاية الموهوبين.',
  'التعرف على الطلاب الموهوبين والكشف عنهم وتنمية مواهبهم فيما يعود عليهم وعلى أسرهم ومجتمعهم وأمنهم ووطنهم بالنفع والفائدة.',
  'معرفة القدرات والاستعدادات لدى الطلاب الموهوبين وتوجيه مواهبهم التوجيه السليم.',
  'توسيع مدارك الطلاب الموهوبين وتوظيف مواهبهم وتنميتها في ضوء شريعتنا الإسلامية وعادات مجتمعنا السعودي المسلم.',
  'تنمية السلوك الإبداعي والتفكير الإبداعي لدى الطلاب الموهوبين.',
  'إبراز المواهب الكامنة لدى الطلاب الموهوبين وتشجيعهم على الإبداع والتفكير.',
  'غرس الثقة في أنفس الطلاب الموهوبين وتعويدهم الجرأة في إبراز مواهبهم والتخلص من الخوف والخجل والقلق والانطواء.',
];

export const GIFTED_SCHOOL_OBJECTIVES: string[] = [
  'نشر الوعي بأهمية الموهبة ورعايتها.',
  'التعرف على الطلاب الموهوبين بالمدرسة.',
  'رعاية المواهب العلمية والإبداعية للطلاب وتنمية مهارات التفكير لديهم.',
  'توفير خدمات الرعاية النفسية والاجتماعية لهم.',
  'توفير بيئة تربوية مناسبة تتيح لجميع الطلاب اكتشاف مواهبهم وتنميتها.',
];

export interface GiftedStrategicPillar {
  id: string;
  title: string;
  description: string;
}

export const GIFTED_STRATEGIC_PILLARS: GiftedStrategicPillar[] = [
  {
    id: 'discovery',
    title: 'اكتشاف الموهوبين',
    description:
      'تطبيق المقاييس والبرامج الوطنية للكشف عن الطلاب الموهوبين بالتعاون مع الجهات ذات العلاقة.',
  },
  {
    id: 'enrichment',
    title: 'البرامج الإثرائية',
    description:
      'تنفيذ الخطط والبرامج الأكاديمية والبحثية والمهارية، وتوفير بيئة تعليمية آمنة ومحفزة على الابتكار.',
  },
  {
    id: 'competitions',
    title: 'المنافسات المحلية والدولية',
    description:
      'تأهيل الطلبة الموهوبين للمشاركة في المحافل والمسابقات والأولمبيادات المحلية والدولية.',
  },
  {
    id: 'community_partnership',
    title: 'الشراكة المجتمعية',
    description:
      'توعية الأسر والمجتمع بأهمية رعاية الموهوبين وبناء شراكات نوعية لخدمتهم.',
  },
];

export const GIFTED_COORDINATOR_DUTIES: string[] = [
  'تنظيم الفعاليات المناسبة لتوعية المجتمع المدرسي.',
  'التعريف بخصائص وسمات الموهوبين بالمدرسة.',
  'ترشيح الطلبة للمشاريع الوطنية المتخصصة (المشروع الوطني للتعرف على الموهوبين، الأولمبياد الوطني للإبداع العلمي، نظام التسريع).',
  'إتاحة الفرص المناسبة أمام الطلاب للتعبير عن قدراتهم ومواهبهم.',
  'التنسيق مع قسم الموهوبين فيما يتعلق بتطبيق المقاييس ودراسة الحالات والترشيح لبرامج الرعاية.',
  'التفاعل مع مؤسسات المجتمع بما يسهم في دعم رعاية الموهوبين، لتعزيز مفهوم أن رعاية الموهوبين مسؤولية الجميع.',
  'تكريم الطلبة الموهوبين، والإشادة بمواهبهم، وإبراز جهودهم ومنجزاتهم.',
  'تكوين قاعدة بيانات عن الطلبة الموهوبين.',
  'توعية المجتمع المدرسي من خلال الوسائل المتنوعة (الإذاعة الصباحية، المحاضرات، نشرات...) بأهمية التعرف على الموهوبين ورعايتهم والمشاريع الوطنية المختصة بالموهوبين.',
  'متابعة خطة إدارة الموهوبين وتنفيذها.',
  'إشراك الموهوبين في الأنشطة المدرسية والمسابقات داخل المدرسة وخارجها بما يلبي حاجات الموهوبين ويبرز قدراتهم.',
  'التنسيق مع قسم الموهوبين بما يخدم الطلبة الموهوبين.',
  'توثيق الأعمال وتنظيم السجلات والملفات الخاصة بذلك.',
];

// ============================================================================
// ٤. الأنواع الأساسية للأقسام ومبدأ محرك الإجراءات الموحد
// ============================================================================

export type GiftedSchoolStage = 'elementary' | 'middle' | 'high' | 'combined';

export type GiftedSemester = 'first' | 'second' | 'full_year';

export type GiftedExecutionStatus = 'executed' | 'pending' | 'not_executed';

export type GiftedMinisterialProgramCode =
  | 'awareness' // التوعية والتعريف بالموهبة والموهوبين (ص 10 — 3 مهام)
  | 'national_identification' // البرنامج الوطني للكشف عن الموهوبين (ص 12 — 7 إجراءات)
  | 'olympiad_research' // أولمبياد الموهبة الوطني - المسار البحثي (ص 14 — 8 إجراءات مستقلة)
  | 'olympiad_scientific' // أولمبياد الموهبة الوطني - المسار العلمي (ص 17 — 7 إجراءات مستقلة)
  | 'innovation_space' // برنامج مساحة الابتكار الإثرائي (ص 20 — 10 إجراءات)
  | 'gulf_week' // اليوم الخليجي والأسبوع الوطني للموهبة والإبداع (ص 23 — 4 إجراءات)
  | 'acceleration'; // برنامج التسريع (ص 25 — 7 إجراءات)

export const GIFTED_SCHOOL_STAGE_LABELS: Record<GiftedSchoolStage, string> = {
  elementary: 'المرحلة الابتدائية',
  middle: 'المرحلة المتوسطة',
  high: 'المرحلة الثانوية',
  combined: 'مراحل مشتركة (ابتدائي / متوسط / ثانوي)',
};

export const GIFTED_SEMESTER_LABELS: Record<GiftedSemester, string> = {
  first: 'الفصل الدراسي الأول',
  second: 'الفصل الدراسي الثاني',
  full_year: 'العام الدراسي كاملاً',
};

export const GIFTED_EXECUTION_STATUS_LABELS: Record<GiftedExecutionStatus, string> = {
  executed: 'نفذ',
  pending: 'معلق / قيد التنفيذ',
  not_executed: 'لم ينفذ',
};

// ----------------------------------------------------------------------------
// القسم 1: الغلاف والبيانات الأساسية (بعد حذف الجوال والبريد الإلكتروني للمنسق نهائياً)
// ----------------------------------------------------------------------------
export interface GiftedBasicInfo {
  schoolStage: GiftedSchoolStage;
  semester: GiftedSemester;
}

export interface ResolvedGiftedBasicInfo {
  educationDepartment: string;
  schoolName: string;
  coordinatorName: string;
  coordinatorRole: string;
  principalName: string;
  principalTitle: string;
  coordinatorTitle: string;
  academicYear: string;
  schoolStage: GiftedSchoolStage;
  schoolStageLabel: string;
  semester: GiftedSemester;
  semesterLabel: string;
}

// ----------------------------------------------------------------------------
// القسم 2: الخطة التنفيذية لمعلم/ـة الموهوبين للعام الدراسي (ص 8)
// ----------------------------------------------------------------------------
export interface GiftedExecutivePlanItem {
  id: string;
  order: number;
  programTitle: string;
  linkedProgramId?: string; // ربط بمعرف البرنامج أو المبادرة أو المسابقة إن وجد
  stage: string;
  targetAudience: string;
  executionDate: string;
  weekLabel?: string; // اختياري يحدده المنسق عند الحاجة دون تقويم الـ19 أسبوعاً
  status: GiftedExecutionStatus;
  nonExecutionReason?: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// القسم 3 و 4 و 6: البرامج الوزارية، المبادرات، المسابقات، ومحرك الإجراءات الموحد
// ----------------------------------------------------------------------------
export interface GiftedExecutionActionItem {
  id: string;
  order: number;
  actionText: string;
  executionDate: string;
  weekLabel?: string;
  status: GiftedExecutionStatus;
  nonExecutionReason: string;
  isStandard: boolean;
}

export interface GiftedMinisterialProgramRecord {
  id: string;
  code: GiftedMinisterialProgramCode;
  title: string;
  shortTitle: string;
  sourcePageNumber: number;
  supportedStages: GiftedSchoolStage[];
  applicableToSchool: boolean; // تستبعد البرامج غير المطبقة على مرحلة المدرسة من حساب المؤشرات
  stageLabel: string;
  targetAudience: string;
  objective: string;
  scheduledPeriod: string;
  semester: GiftedSemester;
  weekLabel?: string;
  notes: string;
  actions: GiftedExecutionActionItem[];
}

export type GiftedInitiativeKind = 'برنامج' | 'مبادرة' | 'فعالية';

export interface GiftedCustomInitiativeItem {
  id: string;
  title: string;
  initiativeType: GiftedInitiativeKind;
  objective: string;
  executedTasks: string;
  stage: string;
  targetAudience: string;
  executionDate: string;
  semester: GiftedSemester;
  weekLabel?: string;
  status: GiftedExecutionStatus;
  nonExecutionReason: string;
  achievementIndicator: string; // عمود مؤشر الإنجاز الصريح في ص 27
  notes: string;
}

export interface GiftedScientificCompetitionItem {
  id: string;
  title: string;
  stage: string;
  targetAudience: string;
  startDate: string;
  semester: GiftedSemester;
  weekLabel?: string;
  status: GiftedExecutionStatus;
  nonExecutionReason: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// القسم 4: السطر الموحد لجدول الفئة المستهدفة ومواعيد التنفيذ المرتبط بـ IDs
// ----------------------------------------------------------------------------
export type GiftedScheduleEntryKind = 'ministerial' | 'initiative' | 'competition';

export interface GiftedUnifiedScheduleRow {
  entryId: string;
  entryKind: GiftedScheduleEntryKind;
  kindBadgeLabel: string;
  title: string;
  applicableToSchool: boolean;
  stage: string;
  targetAudience: string;
  scheduledPeriod: string;
  semester: GiftedSemester;
  weekLabel: string;
  status: GiftedExecutionStatus;
  notes: string;
}

// ----------------------------------------------------------------------------
// الأقسام 7 و 8 و 9 و 10: هياكل مهيأة في السجل الموحد لضمان ثبات المخطط والنسخ الاحتياطي
// (تُفعّل واجهاتها في المرحلتين الثانية والثالثة وفق الخطة المعتمدة)
// ----------------------------------------------------------------------------
export type GiftedClassificationLevel = 'exceptional_gifted' | 'gifted' | 'promising';

export const GIFTED_CLASSIFICATION_LABELS: Record<GiftedClassificationLevel, string> = {
  exceptional_gifted: 'موهبة استثنائية',
  gifted: 'موهوب',
  promising: 'واعد بالموهبة',
};

export type GiftedStudentGender = 'طالب' | 'طالبة';

export const GIFTED_APPROVED_STUDENT_GENDERS: readonly GiftedStudentGender[] = [
  'طالب',
  'طالبة',
] as const;

export const GIFTED_APPROVED_STUDENT_GRADES = [
  'الثالث الابتدائي',
  'الرابع الابتدائي',
  'الخامس الابتدائي',
  'السادس الابتدائي',
  'الأول المتوسط',
  'الثاني المتوسط',
  'الثالث المتوسط',
  'الأول الثانوي',
  'الثاني الثانوي',
  'الثالث الثانوي',
] as const;

export type GiftedApprovedStudentGrade =
  typeof GIFTED_APPROVED_STUDENT_GRADES[number];

export { APPROVED_SCHOOL_SEMESTERS };
export type { ApprovedSchoolSemester };

export interface GiftedStudentRecord {
  id: string;
  /** ١. الاسم الرباعي الكامل في حقل واحد */
  name: string;
  /** ٢. رقم الهوية الوطنية */
  civilId?: string;
  /** ٣. الجنس (طالب / طالبة) */
  gender?: GiftedStudentGender;
  /** ٤. الصف من الثالث الابتدائي إلى الثالث الثانوي */
  grade: string;
  /** ٥. العام الدراسي (يُسحب افتراضياً من إعدادات مكتبي المركزية) */
  academicYear?: string;
  /** ٦. الفصل الدراسي (الفصل الدراسي الأول / الفصل الدراسي الثاني) */
  semester?: ApprovedSchoolSemester;
  /** ٧. رقم جوال الطالب (اختياري) */
  studentMobile?: string;
  /** ٨. اسم ولي الأمر (اختياري) */
  guardianName?: string;
  // حقول خلفية محفوظة للتوافق الخلفي دون إظهارها أو طلبها في الواجهة الجديدة
  level: string;
  talentDomain: string;
  score: string;
  classification: GiftedClassificationLevel;
  notes: string;
}

export type GiftedParticipationCategory =
  | 'national_identification' // ص 13: البرنامج الوطني للكشف عن الموهوبين
  | 'olympiad_research' // ص 15–16: أولمبياد الموهبة الوطني – المسار البحثي (مشاركون ومتأهلون للمرحلة الثانية)
  | 'olympiad_scientific' // ص 18–19: أولمبياد الموهبة الوطني – المسار العلمي (مشاركون ومتأهلون للنهائي)
  | 'innovation_space' // ص 22: برنامج مساحة الابتكار الإثرائي
  | 'acceleration' // ص 26: الطلبة المرشحون لبرنامج التسريع
  | 'scientific_competition'; // ص 29: الطلاب/الطالبات المشاركون بالمسابقات العلمية

export const GIFTED_PARTICIPATION_CATEGORY_LABELS: Record<
  GiftedParticipationCategory,
  string
> = {
  national_identification: 'البرنامج الوطني للكشف عن الموهوبين',
  olympiad_research: 'أولمبياد الموهبة الوطني – المسار البحثي',
  olympiad_scientific: 'أولمبياد الموهبة الوطني – المسار العلمي',
  innovation_space: 'برنامج مساحة الابتكار الإثرائي',
  acceleration: 'الطلبة المرشحون لبرنامج التسريع',
  scientific_competition: 'المسابقات العلمية',
};

export type GiftedNominationType = 'supported' | 'self';

export const GIFTED_NOMINATION_TYPE_LABELS: Record<GiftedNominationType, string> = {
  supported: 'مدعوم',
  self: 'ذاتي',
};

export type GiftedApprovalStatus = 'approved' | 'pending' | 'rejected';

export const GIFTED_APPROVAL_STATUS_LABELS: Record<GiftedApprovalStatus, string> = {
  approved: 'موافق',
  pending: 'قيد الإجراء',
  rejected: 'غير موافق',
};

export interface GiftedStudentParticipationRecord {
  id: string;
  studentId: string; // ربط مباشر بمعرف الطالب في قاعدة بيانات الموهوبين لمنع تكرار الإدخال
  category: GiftedParticipationCategory;
  linkedProgramOrCompetitionId?: string;
  executionId?: string;
  // لقطة تاريخية لبيانات الطالب وقت المشاركة (تبقى ثابتة ولا تتغير عند ترفيع الطالب أو تعديل بياناته الحالية لاحقاً)
  studentGradeAtParticipation?: string;
  studentLevelAtParticipation?: string;
  studentClassificationAtParticipation?: GiftedClassificationLevel;
  participationDate?: string;
  participationHijriDate?: string;
  // ص 13: البرنامج الوطني للكشف عن الموهوبين
  nominationType?: GiftedNominationType;
  score?: string;
  classificationResult?: string;
  // ص 15–16: أولمبياد الموهبة الوطني – المسار البحثي
  projectTitle?: string;
  projectField?: string;
  // ص 18–19: أولمبياد الموهبة الوطني – المسار العلمي
  scientificTrack?: string;
  // ص 22: برنامج مساحة الابتكار الإثرائي
  enrichmentUnit?: string;
  // ص 26: برنامج التسريع
  approvalStatus?: GiftedApprovalStatus;
  // ص 29: المسابقات العلمية
  competitionTitle?: string;
  // التأهل والإنجازات (ص 16 للمرحلة الثانية للبحثي، ص 19 للنهائي للعلمي، أو الفوز/التأهل في المسابقات)
  qualifiedToNextStage: boolean;
  achievementText: string;
  notes: string;
}

export interface GiftedResolvedStudentParticipation
  extends GiftedStudentParticipationRecord {
  studentName: string;
  studentGrade: string;
  studentLevel: string;
  studentCivilId?: string;
  studentClassification: GiftedClassificationLevel;
  studentTalentDomain: string;
  /** الصف التاريخي المسجل وقت المشاركة (ثابت لا يتأثر بتعديل الصف الحالي) */
  historicalGrade: string;
  /** التصنيف التاريخي المسجل وقت المشاركة */
  historicalClassification: GiftedClassificationLevel;
}

export interface GiftedEvidencePhotoRef {
  id: string;
  blobKey: string; // مفتاح الصورة في IndexedDB
  title: string;
  caption?: string;
  selectedForProgramReport: boolean;
  selectedForFinalRecord: boolean;
  createdAt: string;
}

export interface GiftedEvidenceLinkItem {
  id: string;
  title: string;
  url: string;
  selectedForProgramReport: boolean;
  selectedForFinalRecord: boolean;
}

export interface GiftedProgramEvidenceBundle {
  targetId: string; // معرف البرنامج أو المبادرة أو المسابقة أو التقرير
  showEvidencesInReport: boolean;
  photos: GiftedEvidencePhotoRef[]; // بحد أقصى 4 شواهد
  links: GiftedEvidenceLinkItem[]; // بحد أقصى 4 روابط
}

export interface GiftedEvaluationSummary {
  strengths: string;
  challenges: string;
  supportingEntities: string;
  improvementProposals: string;
}

export interface GiftedProgramEventReportOverrides {
  targetId: string;
  dayLabel?: string;
  executionDateOverride?: string;
  durationLabel?: string;
  executionMechanismOverride?: string;
  beneficiariesCountOverride?: string;
  difficultiesOverride?: string;
  suggestionsOverride?: string;
}

export interface GiftedInnovationProgressReportOverrides {
  innovationTeacherName?: string;
  enrichmentUnitOverride?: string;
  targetGradeOverride?: string;
  beneficiariesCountOverride?: string;
  outputsCount?: string;
  distinguishedOutputsCount?: string;
  distinguishedOutputsSummary?: string;
  supportingEntitiesOverride?: string;
  strengthsOverride?: string;
  challengesOverride?: string;
  improvementProposalsOverride?: string;
}

export type GiftedProgramTemplateCategory =
  | 'ministerial'
  | 'competition'
  | 'enrichment_initiative'
  | 'school_event'
  | 'identification_acceleration';

export const GIFTED_PROGRAM_TEMPLATE_CATEGORY_LABELS: Record<
  GiftedProgramTemplateCategory,
  string
> = {
  ministerial: 'برنامج وزاري معتمد',
  competition: 'مسابقة علمية',
  enrichment_initiative: 'مبادرة إثرائية',
  school_event: 'فعالية مدرسية',
  identification_acceleration: 'برنامج كشف أو تسريع',
};

/**
 * القائمة الرسمية المعتمدة للأسابيع الدراسية (من الأسبوع الأول إلى الأسبوع التاسع عشر)
 * تُستخدم للاختيار المنظم (أسبوع واحد أو عدة أسابيع) وتمنع الكتابة الحرة لأرقام الأسابيع
 */
export const GIFTED_ACADEMIC_WEEKS_LIST: readonly string[] = [
  'الأسبوع الأول',
  'الأسبوع الثاني',
  'الأسبوع الثالث',
  'الأسبوع الرابع',
  'الأسبوع الخامس',
  'الأسبوع السادس',
  'الأسبوع السابع',
  'الأسبوع الثامن',
  'الأسبوع التاسع',
  'الأسبوع العاشر',
  'الأسبوع الحادي عشر',
  'الأسبوع الثاني عشر',
  'الأسبوع الثالث عشر',
  'الأسبوع الرابع عشر',
  'الأسبوع الخامس عشر',
  'الأسبوع السادس عشر',
  'الأسبوع السابع عشر',
  'الأسبوع الثامن عشر',
  'الأسبوع التاسع عشر',
] as const;

/**
 * قالب البرنامج (يُحفظ مرة واحدة في مكتبة البرامج بمعرّف داخلي ثابت)
 * مفصول تماماً عن سجلات التنفيذ الفعلية بحيث لا يغير تعديل القالب بيانات التنفيذات القديمة بأثر رجعي
 */
export interface GiftedProgramTemplateRecord {
  /** معرّف داخلي ثابت لا يتغير عند تعديل اسم البرنامج أو بياناته */
  id: string;
  /** اسم البرنامج */
  title: string;
  /** نوع البرنامج أو تصنيفه */
  category: GiftedProgramTemplateCategory;
  /** وصف مختصر للبرنامج */
  shortDescription: string;
  /** أهداف البرنامج */
  objectives: string;
  /** الفئة المستهدفة */
  targetAudience: string;
  /** المرحلة الدراسية المرتبطة بالقالب */
  stageLabel: string;
  /** الإجراءات والمتطلبات المرتبطة بالقالب (تظهر تلقائياً عند فتح القالب أو إنشاء تنفيذ جديد) */
  requirementsAndActions: string[];
  /** ملاحظات أو تعليمات إرشادية للمنسق عند التنفيذ */
  coordinatorInstructions: string;
  /** حالة تفعيل القالب (إيقاف القالب لا يحذف سجلات التنفيذ السابقة) */
  isActive: boolean;
  /** هل يمثل قالباً مرجعياً رسمياً من الدليل الوزاري */
  isOfficialReference: boolean;
  /** رقم الصفحة في الدليل المرجعي إن وجد */
  sourcePageNumber?: number;
  /** معرّف السجل المرتبط في البرامج الوزارية أو المسابقات للتكامل التام */
  linkedProgramId?: string;
  /** كود البرنامج الوزاري إن كان مرتبطاً بأحد البرامج السبعة */
  linkedMinisterialCode?: GiftedMinisterialProgramCode;
  /** تاريخ آخر تحديث للقالب */
  updatedAt: string;
}

/**
 * سجل تنفيذ فعلي لبرنامج (مرتبط بالقالب عبر templateId مع حفظ نسخة ثابتة Snapshot
 * من بيانات القالب وقت التنفيذ لضمان عدم تغير التنفيذات القديمة بأثر رجعي عند تعديل القالب مستقبلاً)
 */
export interface GiftedProgramExecutionSnapshotRecord {
  id: string;
  /** المعرّف الثابت للقالب المرتبط */
  templateId: string;
  /** معرّف المصدر القديم إن تم ترحيله (مثل prog-... أو comp-... أو init-...) لمنع التكرار عند إعادة التشغيل */
  legacySourceId?: string;
  /** نسخة محفوظة من اسم القالب وقت التنفيذ */
  templateTitleSnapshot: string;
  /** نسخة محفوظة من تصنيف القالب وقت التنفيذ */
  templateCategorySnapshot: GiftedProgramTemplateCategory;
  /** نسخة محفوظة من الأهداف وقت التنفيذ */
  objectivesSnapshot: string;
  /** نسخة محفوظة من الفئة المستهدفة وقت التنفيذ */
  targetAudienceSnapshot: string;
  /** نسخة محفوظة من المرحلة وقت التنفيذ */
  stageLabelSnapshot: string;
  /** حالة التنفيذ العامة للبرنامج (يحددها المنسق مباشرة: منفذ / قيد التنفيذ / لم ينفذ) */
  status?: GiftedExecutionStatus;
  /** سبب عدم التنفيذ (يُحفظ عند اختيار حالة لم ينفذ) */
  nonExecutionReason?: string;
  /** نسخة محفوظة من الإجراءات والمتطلبات وقت التنفيذ (مؤشر استيفاء مستقل) */
  actionsSnapshot: Array<{
    id: string;
    order: number;
    actionText: string;
    completed: boolean;
    executionDate?: string;
    selectedWeeks?: string[];
  }>;
  /** تاريخ التنفيذ الميلادي عبر منتقي التقويم YYYY-MM-DD (يحدده المنسق عند التنفيذ) */
  executionStartDate: string;
  /** التاريخ الهجري المشتق تلقائياً من التاريخ الميلادي */
  executionHijriDate?: string;
  executionEndDate?: string;
  /** الأسابيع المختارة من القائمة المعتمدة (الأسبوع الأول .. الأسبوع التاسع عشر) */
  selectedWeeks: string[];
  /** معرفات الطلاب المشاركين من السجل المركزي */
  participatingStudentIds: string[];
  /** معرفات المشاركات والدرجات والنتائج المرتبطة */
  linkedParticipationIds: string[];
  /** معرف حزمة الشواهد المرتبطة */
  evidenceBundleTargetId?: string;
  /** ملخص النتائج والمخرجات (اختياري) */
  resultsSummary?: string;
  /** التوصيات والمقترحات (اختياري) */
  recommendations?: string;
  /** التحديات والصعوبات (اختياري) */
  challenges?: string;
  /** عدد المستفيدين الإضافي عند الحاجة */
  beneficiariesCountOverride?: string;
  notes: string;
  createdAt: string;
}

export type GiftedCoordinatorWorkKind =
  | 'committee_meeting'
  | 'teacher_communication'
  | 'parent_communication'
  | 'other_work';

export const GIFTED_COORDINATOR_WORK_KIND_LABELS: Record<
  GiftedCoordinatorWorkKind,
  string
> = {
  committee_meeting: 'اجتماع لجنة الموهوبين',
  teacher_communication: 'التواصل مع المعلمين',
  parent_communication: 'التواصل مع أولياء الأمور',
  other_work: 'أعمال تنسيقية أخرى',
};

export const MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS = 6;

export interface GiftedCoordinatorAdditionalWorkItem {
  id: string;
  workKind: GiftedCoordinatorWorkKind;
  /** رقم الاجتماع (مثل: الاجتماع الأول) عند اختيار اجتماع لجنة الموهوبين */
  meetingNumber?: string;
  /** التاريخ الميلادي عبر منتقي التقويم YYYY-MM-DD */
  executionDate: string;
  /** التاريخ الهجري الموافق تلقائياً */
  hijriDate?: string;
  /** الأسبوع الدراسي من القائمة المعتمدة (الأسبوع الأول .. الأسبوع التاسع عشر) */
  weekLabel: string;
  /** ملخص مختصر للعمل في سطر واحد */
  summary: string;
  /** الملاحظات والتوصيات المرتبطة بعمل المنسق (ضمن المتابعة والتقييم في محرك 03) */
  notesAndRecommendations?: string;
}

// ----------------------------------------------------------------------------
// القسم الثاني المعتمد (02 البرامج والتقارير والمبادرات) وفق الوثيقة المرجعية
// ----------------------------------------------------------------------------
export type GiftedSection2RecordType = 'برنامج' | 'تقرير' | 'مبادرة';

export const GIFTED_SECTION2_RECORD_TYPES: readonly GiftedSection2RecordType[] =
  ['برنامج', 'تقرير', 'مبادرة'] as const;

export const GIFTED_APPROVED_DURATION_OPTIONS = [
  'أسبوع',
  'أسبوعان',
  'فصل دراسي',
  'سنة دراسية',
] as const;

export type GiftedApprovedDurationOption =
  typeof GIFTED_APPROVED_DURATION_OPTIONS[number];

export const GIFTED_PROGRAM_EXECUTION_SCOPES = [
  'وزاري',
  'إدارة تعليم',
  'مدرسة',
] as const;

export type GiftedProgramExecutionScope =
  typeof GIFTED_PROGRAM_EXECUTION_SCOPES[number];

export const GIFTED_PARTICIPANT_STATUS_ROLES = [
  'موهوب',
  'مشارك',
  'متأهل لمرحلة من منافسة',
] as const;

export type GiftedParticipantStatusRole =
  typeof GIFTED_PARTICIPANT_STATUS_ROLES[number];

export const MAX_GIFTED_SECTION2_EVIDENCES = 4;
export const MAX_GIFTED_SECTION2_LINKS = 2;

export interface GiftedSection2ParticipantItem {
  studentId: string;
  /** لقطة الصف وقت المشاركة (تُحفظ تلقائياً من سجل الطالب المركزي) */
  studentGradeAtParticipation: string;
  /** ١. الدرجة أو التقييم (اختياري — لا يظهر في التقرير إذا كان فارغاً) */
  scoreOrEvaluation?: string;
  /** ٢. الصفة أو الحالة (اختياري — موهوب / مشارك / متأهل لمرحلة من منافسة) */
  statusRole?: GiftedParticipantStatusRole;
  /** ٣. نوع المشاركة (اختياري — لا يظهر في التقرير إذا كان فارغاً) */
  participationType?: string;
  /** ٤. الإنجاز (اختياري — لا يظهر في التقرير إذا كان فارغاً) */
  achievement?: string;
}

export interface GiftedSection2EvidenceItem {
  id: string;
  blobKey: string;
  filename: string;
  mimeType: string; // image/* أو application/pdf
  title: string;
  caption?: string;
  createdAt: string;
}

export interface GiftedSection2LinkItem {
  id: string;
  title: string;
  url: string;
}

/** حقول نوع «البرنامج» المعتمدة حرفياً في الوثيقة المرجعية */
export interface GiftedSection2ProgramFields {
  executionScope: GiftedProgramExecutionScope;
  programTypeOrField: string;
  objective: string;
  targetAudience: string;
  executingEntity: string;
  results: string;
  notesAndRecommendations: string;
}

/** حقول نوع «التقرير» المعتمدة حرفياً في الوثيقة المرجعية */
export interface GiftedSection2ReportFields {
  reportObjectives: string;
  resultsAndOutputs: string;
  achievementIndicators: string;
  challengesAndDifficulties: string;
  recommendationsAndProposals: string;
  notes: string;
}

/** حقول نوع «المبادرة» المعتمدة حرفياً في الوثيقة المرجعية */
export interface GiftedSection2InitiativeFields {
  initiativeIdea: string;
  initiativeObjectives: string;
  targetAudience: string;
  executionSteps: string;
  resultsAndImpact: string;
  challenges: string;
  recommendations: string;
}

export interface GiftedUnifiedSection2Record {
  id: string;
  recordType: GiftedSection2RecordType;
  /** العنوان */
  title: string;
  /** وصف السجل */
  description: string;
  /** التاريخ الميلادي YYYY-MM-DD (متزامن ثنائياً مع التاريخ الهجري) */
  gregorianDate?: string;
  /** التاريخ الهجري الموافق */
  hijriDate?: string;
  /** المدة المعتمدة عند عدم تحديد تاريخ محدد (أسبوع / أسبوعان / فصل دراسي / سنة دراسية) */
  durationOption?: GiftedApprovedDurationOption;
  /** مكان التنفيذ (اختياري) */
  location?: string;
  /** العام الدراسي (يُسحب افتراضياً من إعدادات مكتبي المركزية) */
  academicYear: string;
  /** الفصل الدراسي (الفصل الدراسي الأول / الفصل الدراسي الثاني) */
  semester: ApprovedSchoolSemester;
  /** الطلاب المشاركون من السجل المركزي (يُسمح بالحفظ مع 0 طلاب) */
  participants: GiftedSection2ParticipantItem[];
  /** الشواهد والمرفقات بحد أقصى 4 (صور image/* أو ملفات application/pdf) */
  evidences: GiftedSection2EvidenceItem[];
  /** الروابط الإلكترونية بحد أقصى 2 (تتحول إلى QR قابلة للنقر) */
  links: GiftedSection2LinkItem[];
  programFields?: GiftedSection2ProgramFields;
  reportFields?: GiftedSection2ReportFields;
  initiativeFields?: GiftedSection2InitiativeFields;
  /** معرف السجل القديم المرحّل لمنع تكرار الترحيل */
  legacySourceId?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// القسم الثالث المعتمد (03 نماذج أخرى): 5 سجلات ثابتة + 4 قوالب جاهزة فقط
// ----------------------------------------------------------------------------
export type GiftedSection3FixedLogKind =
  | 'giftedStudentsLog'
  | 'programParticipantsLog'
  | 'studentAchievementsLog'
  | 'meetingsLog'
  | 'visitsAndPartnershipsLog';

export const GIFTED_SECTION3_FIXED_LOG_LABELS: Record<
  GiftedSection3FixedLogKind,
  string
> = {
  giftedStudentsLog: 'سجل الطلاب الموهوبين',
  programParticipantsLog: 'سجل الطلاب المشاركين في البرامج',
  studentAchievementsLog: 'سجل إنجازات الطلاب',
  meetingsLog: 'سجل الاجتماعات',
  visitsAndPartnershipsLog: 'سجل الزيارات والشراكات',
};

export type GiftedReadyTemplateKind =
  | 'محضر اجتماع'
  | 'خطاب رسمي'
  | 'استمارة ترشيح'
  | 'نماذج أخرى مناسبة';

export const GIFTED_READY_TEMPLATE_KINDS: readonly GiftedReadyTemplateKind[] = [
  'محضر اجتماع',
  'خطاب رسمي',
  'استمارة ترشيح',
  'نماذج أخرى مناسبة',
] as const;

export interface GiftedPersonParticipantRef {
  id: string;
  personType: 'student' | 'staff';
  /** معرف الطالب في السجل المركزي عند اختيار طالب */
  studentId?: string;
  /** اسم الشخص (يُجلب من السجل المركزي للطالب أو يُدخل يدوياً للمعلم/الإداري/عضو اللجنة) */
  name: string;
  /** لقطة الصف للطالب */
  studentGradeSnapshot?: string;
  /** الصفة للمعلمين أو أعضاء اللجان أو الإداريين المضافين يدوياً */
  roleTitle?: string;
}

/** ١. سجل الطلاب الموهوبين: الطالب، الصف، مجال الموهبة، ملاحظات */
export interface GiftedStudentsFixedLogRow {
  id: string;
  studentId: string;
  studentGradeSnapshot?: string;
  talentDomain: string;
  notes: string;
  academicYear?: string;
  semester?: ApprovedSchoolSemester;
  createdAt: string;
}

/** ٢. سجل الطلاب المشاركين في البرامج: الطالب، البرنامج، تاريخ المشاركة، نوع المشاركة */
export interface GiftedProgramParticipantsFixedLogRow {
  id: string;
  studentId: string;
  studentGradeSnapshot?: string;
  programTitle: string;
  linkedRecordId?: string;
  participationDate: string;
  participationHijriDate?: string;
  participationType: string;
  academicYear?: string;
  semester?: ApprovedSchoolSemester;
  createdAt: string;
}

/** ٣. سجل إنجازات الطلاب: الطالب، الإنجاز، الجهة أو المسابقة، التاريخ */
export interface GiftedStudentAchievementsFixedLogRow {
  id: string;
  studentId: string;
  studentGradeSnapshot?: string;
  achievement: string;
  entityOrCompetition: string;
  date: string;
  hijriDate?: string;
  academicYear?: string;
  semester?: ApprovedSchoolSemester;
  createdAt: string;
}

/** ٤. سجل الاجتماعات: التاريخ، موضوع الاجتماع، الحضور، أبرز التوصيات */
export interface GiftedMeetingsFixedLogRow {
  id: string;
  date: string;
  hijriDate?: string;
  topic: string;
  attendees: GiftedPersonParticipantRef[];
  keyRecommendations: string;
  academicYear?: string;
  semester?: ApprovedSchoolSemester;
  createdAt: string;
}

/** ٥. سجل الزيارات والشراكات: الجهة أو المكان، التاريخ، الغرض، أبرز النتائج */
export interface GiftedVisitsAndPartnershipsFixedLogRow {
  id: string;
  entityOrPlace: string;
  date: string;
  hijriDate?: string;
  purpose: string;
  keyResults: string;
  academicYear?: string;
  semester?: ApprovedSchoolSemester;
  createdAt: string;
}

/** القوالب الجاهزة الأربعة (محضر اجتماع، خطاب رسمي، استمارة ترشيح، نماذج أخرى مناسبة) */
export interface GiftedReadyTemplateEntry {
  id: string;
  templateKind: GiftedReadyTemplateKind;
  title: string;
  date: string;
  hijriDate?: string;
  subjectOrPurpose: string;
  bodyContent: string;
  recommendationsOrNotes?: string;
  recipientOrEntity?: string;
  participants: GiftedPersonParticipantRef[];
  academicYear?: string;
  semester?: ApprovedSchoolSemester;
  createdAt: string;
}

export interface GiftedSection3Data {
  giftedStudentsLog: GiftedStudentsFixedLogRow[];
  programParticipantsLog: GiftedProgramParticipantsFixedLogRow[];
  studentAchievementsLog: GiftedStudentAchievementsFixedLogRow[];
  meetingsLog: GiftedMeetingsFixedLogRow[];
  visitsAndPartnershipsLog: GiftedVisitsAndPartnershipsFixedLogRow[];
  readyTemplates: GiftedReadyTemplateEntry[];
}

export interface GiftedCoordinatorRecord {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  basicInfo: GiftedBasicInfo;
  executivePlan: GiftedExecutivePlanItem[];
  ministerialPrograms: GiftedMinisterialProgramRecord[];
  customInitiatives: GiftedCustomInitiativeItem[];
  scientificCompetitions: GiftedScientificCompetitionItem[];
  /** مكتبة قوالب البرامج المعتمدة والمضافة من المنسق */
  programTemplates?: GiftedProgramTemplateRecord[];
  /** سجلات التنفيذ الفعلية المرتبطة بقوالب البرامج عبر المعرّف الثابت */
  programExecutions?: GiftedProgramExecutionSnapshotRecord[];
  /** السجلات الموحدة للقسم الثاني المعتمد (02 البرامج والتقارير والمبادرات) */
  unifiedRecords?: GiftedUnifiedSection2Record[];
  /** السجلات الخمسة الثابتة والقوالب الجاهزة الأربعة للقسم الثالث المعتمد (03 نماذج أخرى) */
  section3Data?: GiftedSection3Data;
  /** أرشيف الأعمال الإضافية السابق للمنسق (يُحفظ في الخلفية كأرشيف مستقل للقراءة فقط دون تصنيف قسري) */
  coordinatorAdditionalWorks?: GiftedCoordinatorAdditionalWorkItem[];
  students: GiftedStudentRecord[];
  studentParticipations: GiftedStudentParticipationRecord[];
  evidenceBundles: Record<string, GiftedProgramEvidenceBundle>;
  /** معرّف الجيل النشط للمرفقات المستعادة (Immutable Generation ID) */
  activeRestoreGenId?: string;
  /** قائمة مفاتيح المرفقات المعتمدة التابعة للجيل النشط في IndexedDB */
  activeAttachmentBlobKeys?: string[];
  evaluation: GiftedEvaluationSummary;
  programReportsOverrides?: Record<string, GiftedProgramEventReportOverrides>;
  innovationProgressReportOverrides?: GiftedInnovationProgressReportOverrides;
}

// ============================================================================
// ٥. القوائم الأصلية المستقلة لإجراءات كل برنامج وزاري كما وردت في PDF نصياً
// ============================================================================

export const GIFTED_STANDARD_PROGRAM_ACTIONS: Record<
  GiftedMinisterialProgramCode,
  string[]
> = {
  // ١. التوعية والتعريف بالموهبة والموهوبين (ص 10 — 3 مهام)
  awareness: [
    'تصميم وتنفيذ برنامج تعريفي توعوي في المدرسة بالتعاون مع التوجيه الطلابي ومعلمي المدرسة يستهدف الطلبة والمعلمين وأولياء الأمور للتعريف بالموهبة والإبداع.',
    'تنفيذ فقرات تعريفية عن الموهوبين والمتميزين من خلال الإذاعة المدرسية ووسائل التواصل الاجتماعي.',
    'التعريف بخصائص وسمات الموهوبين وتوعية المجتمع المدرسي والمحلي حولهم.',
  ],

  // ٢. البرنامج الوطني للكشف عن الموهوبين (ص 12 — 7 إجراءات)
  national_identification: [
    'التوعية والتعريف بالبرنامج الوطني للكشف عن الموهوبين في المدرسة والمجتمع المحلي.',
    'تزويد أولياء الأمور بنشرة البرنامج والمواد الإعلامية الموضحة لخطوات التسجيل.',
    'الترشيح المدعوم للطلبة ورفع الاستمارات لقسم الموهوبين.',
    'متابعة تسجيل طلبة الترشيح الذاتي عبر موقعي موهبة وقياس.',
    'التأكد من سلامة وصحة إجراءات التسجيل وإثبات الهوية للطلبة.',
    'تدريب الطلبة على نماذج مقياس موهبة.',
    'تذكير ومتابعة الطلبة لحضور اختبار مقياس موهبة حسب المواعيد المسجلة لكل طالب/ـة.',
  ],

  // ٣. أولمبياد الموهبة الوطني – المسار البحثي (ص 14 — 8 إجراءات مستقلة)
  olympiad_research: [
    'الاطلاع على الخطة الزمنية والتعاميم الواردة من قسم الموهوبين الخاصة بالأولمبياد.',
    'قراءة وفهم اللوائح والأنظمة الخاصة بأخلاقيات المشاركة في الأولمبياد.',
    'توعية المجتمع المدرسي من خلال قنوات التواصل الاجتماعي بأهمية الأولمبياد الوطني للإبداع العلمي.',
    'التأكيد على الطلبة بالتسجيل والمشاركة في الأولمبياد على موقع موهبة.',
    'تسجيل أسماء الطلبة المشاركين.',
    'إشعار الطلبة باستمرار بالتحديثات المستمرة.',
    'متابعة حضور الطلبة للورش المنفذة من قسم الموهوبين.',
    'متابعة الطلبة المتأهلين والتواصل مع قسم الموهوبين.',
  ],

  // ٤. أولمبياد الموهبة الوطني – المسار العلمي (ص 17 — 7 إجراءات مستقلة)
  olympiad_scientific: [
    'الاطلاع على الخطة الزمنية والتعاميم الواردة من قسم الموهوبين الخاصة بالأولمبياد.',
    'توعية المجتمع المدرسي من خلال قنوات التواصل الاجتماعي بأهمية أولمبياد الموهبة الوطني – المسار العلمي.',
    'التأكيد على الطلبة بالتسجيل والمشاركة في الأولمبياد على موقع موهبة.',
    'تسجيل أسماء الطلبة المشاركين.',
    'إشعار الطلبة باستمرار بالتحديثات المستمرة.',
    'متابعة حضور الطلبة للورش المنفذة من قسم الموهوبين.',
    'متابعة الطلبة المتأهلين والتواصل مع قسم الموهوبين.',
  ],

  // ٥. برنامج مساحة الابتكار الإثرائي (ص 20 — 10 إجراءات)
  innovation_space: [
    'ترشيح الطلبة للبرنامج.',
    'التعريف بموضوع البرنامج.',
    'التمهيد.',
    'أنشطة جماعية.',
    'جلسات تحديد خطط المشاريع واعتمادها.',
    'أنشطة تخصصية حسب خطط المشاريع.',
    'تنفيذ المشاريع.',
    'تسليم المشاريع وتقويمها.',
    'الاستعداد للعرض.',
    'المعرض الختامي.',
  ],

  // ٦. اليوم الخليجي والأسبوع الوطني للموهبة والإبداع (ص 23 — 4 إجراءات)
  gulf_week: [
    'إعداد وتنفيذ برنامج لتفعيل أسبوع الموهبة بالمدرسة يستهدف (الطلبة – المعلمين/ات – أولياء الأمور) ويتضمن (ورش تدريبية – ندوات – مسابقات – إذاعات مدرسية.... إلخ) وذلك للتعريف بالموهبة وجهود المملكة العربية السعودية في دعم الموهبة والموهوبين.',
    'عقد شراكات مع المجتمع المحلي لتنفيذ برامج داعمة للموهوبين.',
    'المشاركة في حضور الملتقيات والبرامج والفعاليات المقامة من قِبل قسم الموهوبين.',
    'تكريم الطلبة الموهوبين بالمدرسة.',
  ],

  // ٧. برنامج التسريع (ص 25 — 7 إجراءات)
  acceleration: [
    'متابعة نتائج مقياس موهبة وحصر الطلبة المحققين لشروط التسريع.',
    'التعريف بالتسريع على مستوى المدرسة والطلبة وأولياء الأمور.',
    'حصر الطلبة المحققين لكافة شروط التسريع.',
    'رفع بيانات واستمارات الطلبة المرشحين لقسم الموهوبين.',
    'التهيئة النفسية والأكاديمية للطلبة المرشحين.',
    'متابعة حضور اختبار نظام التسريع.',
    'ما يستجد من أعمال.',
  ],
};

// ============================================================================
// ٦. إنشاء السجل الأولي والبرامج الوزارية السبعة والخطة الافتراضية
// ============================================================================

export function isProgramSupportedInSchoolStage(
  supportedStages: GiftedSchoolStage[],
  schoolStage: GiftedSchoolStage
): boolean {
  if (schoolStage === 'combined') return true;
  return supportedStages.includes(schoolStage);
}

export function createStandardActionsForProgram(
  code: GiftedMinisterialProgramCode
): GiftedExecutionActionItem[] {
  const texts = GIFTED_STANDARD_PROGRAM_ACTIONS[code] || [];
  return texts.map((text, idx) => ({
    id: `act-${code}-${idx + 1}`,
    order: idx + 1,
    actionText: text,
    executionDate: '',
    weekLabel: '',
    status: 'pending',
    nonExecutionReason: '',
    isStandard: true,
  }));
}

export function createDefaultMinisterialPrograms(
  schoolStage: GiftedSchoolStage = 'combined',
  semester: GiftedSemester = 'first'
): GiftedMinisterialProgramRecord[] {
  const definitions: Array<{
    id: string;
    code: GiftedMinisterialProgramCode;
    title: string;
    shortTitle: string;
    sourcePageNumber: number;
    supportedStages: GiftedSchoolStage[];
    stageLabel: string;
    targetAudience: string;
    objective: string;
    scheduledPeriod: string;
  }> = [
    {
      id: 'prog-awareness',
      code: 'awareness',
      title: 'التوعية والتعريف بالموهبة والموهوبين',
      shortTitle: 'التوعية والتعريف بالموهبة',
      sourcePageNumber: 10,
      supportedStages: ['elementary', 'middle', 'high', 'combined'],
      stageLabel: 'جميع المراحل',
      targetAudience: 'الطلبة، المعلمون/ات، وأولياء الأمور',
      objective:
        'نشر ثقافة الموهبة والإبداع والتعريف بخصائص وسمات الطلبة الموهوبين في المجتمع المدرسي والمحلي.',
      scheduledPeriod: 'مستمر خلال العام الدراسي',
    },
    {
      id: 'prog-national-identification',
      code: 'national_identification',
      title: 'البرنامج الوطني للكشف عن الموهوبين',
      shortTitle: 'البرنامج الوطني للكشف',
      sourcePageNumber: 12,
      supportedStages: ['elementary', 'middle', 'high', 'combined'],
      stageLabel: 'ابتدائي، متوسط، ثانوي (١/ث)',
      targetAudience: 'طلبة الصف الثالث والسادس الابتدائي والثالث المتوسط والأول الثانوي',
      objective:
        'التعرف على الطلبة الموهوبين عبر مقياس موهبة بالشراكة مع مؤسسة موهبة ومركز قياس.',
      scheduledPeriod: 'يبدأ من ١٧ / ٣ ويستمر خلال العام الدراسي',
    },
    {
      id: 'prog-olympiad-research',
      code: 'olympiad_research',
      title: 'أولمبياد الموهبة الوطني – المسار البحثي',
      shortTitle: 'أولمبياد الموهبة – المسار البحثي',
      sourcePageNumber: 14,
      supportedStages: ['middle', 'high', 'combined'],
      stageLabel: 'للمرحلتين المتوسطة والثانوية',
      targetAudience: 'طلبة المرحلتين المتوسطة والثانوية',
      objective:
        'التنافس العلمي عبر تقديم مشاريع بحثية فردية في المجالات العلمية وتحكيمها للتأهل للمنافسات المحلية والعالمية.',
      scheduledPeriod: 'يبدأ من ٧ / ٣ ويستمر خلال العام الدراسي',
    },
    {
      id: 'prog-olympiad-scientific',
      code: 'olympiad_scientific',
      title: 'أولمبياد الموهبة الوطني – المسار العلمي',
      shortTitle: 'أولمبياد الموهبة – المسار العلمي',
      sourcePageNumber: 17,
      supportedStages: ['middle', 'high', 'combined'],
      stageLabel: 'للمرحلتين المتوسطة والثانوية',
      targetAudience: 'الطلبة من الصف الأول المتوسط حتى الأول الثانوي',
      objective:
        'مسابقة وطنية سنوية في تخصصات العلوم والرياضيات والكيمياء والفيزياء والأحياء والمعلوماتية.',
      scheduledPeriod: 'يبدأ من ٧ / ٣ ويستمر خلال العام الدراسي',
    },
    {
      id: 'prog-innovation-space',
      code: 'innovation_space',
      title: 'برنامج مساحة الابتكار الإثرائي',
      shortTitle: 'برنامج مساحة الابتكار الإثرائي',
      sourcePageNumber: 20,
      supportedStages: ['elementary', 'middle', 'combined'],
      stageLabel: 'ابتدائي صفوف عليا – متوسط',
      targetAudience: 'طلبة الصفوف العليا بالمرحلة الابتدائية والمرحلة المتوسطة',
      objective:
        'تنمية مهارات الابتكار من خلال تحفيز الطلاب على بناء وصناعة الأفكار ضمن وحدات إثرائية متنوعة.',
      scheduledPeriod: 'مستمر خلال العام الدراسي',
    },
    {
      id: 'prog-gulf-week',
      code: 'gulf_week',
      title: 'اليوم الخليجي والأسبوع الوطني للموهبة والإبداع',
      shortTitle: 'اليوم الخليجي وأسبوع الموهبة',
      sourcePageNumber: 23,
      supportedStages: ['elementary', 'middle', 'high', 'combined'],
      stageLabel: 'جميع المراحل',
      targetAudience: 'الطلبة، المعلمون/ات، أولياء الأمور، والمجتمع المحلي',
      objective:
        'تفعيل أسبوع الموهبة بالمدرسة للتعريف بالموهبة وجهود المملكة في دعم الموهوبين وتكريمهم.',
      scheduledPeriod: 'وفق الموعد الوزاري المعتمد لأسبوع الموهبة',
    },
    {
      id: 'prog-acceleration',
      code: 'acceleration',
      title: 'برنامج التسريع',
      shortTitle: 'برنامج التسريع',
      sourcePageNumber: 25,
      supportedStages: ['elementary', 'middle', 'combined'],
      stageLabel: 'ابتدائي – متوسط',
      targetAudience: 'الطلبة المحققون لشروط التسريع (فئة الموهبة الاستثنائية)',
      objective:
        'تسريع الطلاب الذين أبدوا تفوقاً غير عادي إلى سنوات دراسية متقدمة وفق الضوابط الوزارية.',
      scheduledPeriod: 'مستمر خلال العام الدراسي',
    },
  ];

  return definitions.map((def) => ({
    id: def.id,
    code: def.code,
    title: def.title,
    shortTitle: def.shortTitle,
    sourcePageNumber: def.sourcePageNumber,
    supportedStages: def.supportedStages,
    applicableToSchool: isProgramSupportedInSchoolStage(
      def.supportedStages,
      schoolStage
    ),
    stageLabel: def.stageLabel,
    targetAudience: def.targetAudience,
    objective: def.objective,
    scheduledPeriod: def.scheduledPeriod,
    semester,
    weekLabel: '',
    notes: '',
    actions: createStandardActionsForProgram(def.code),
  }));
}

export function createDefaultScientificCompetitions(
  semester: GiftedSemester = 'first'
): GiftedScientificCompetitionItem[] {
  return [
    {
      id: 'comp-kangaroo',
      title: 'مسابقة الكانجارو للرياضيات',
      stage: 'جميع المراحل',
      targetAudience: 'الطلبة الموهوبون والمتفوقون في الرياضيات',
      startDate: 'وفق الخطة الزمنية للمسابقة',
      semester,
      weekLabel: '',
      status: 'pending',
      nonExecutionReason: '',
      notes: '',
    },
    {
      id: 'comp-bebras',
      title: 'مسابقة بيبراس موهبة للمعلوماتية',
      stage: 'جميع المراحل',
      targetAudience: 'الطلبة الموهوبون والمتفوقون في التفكير الحاسوبي والمعلوماتية',
      startDate: 'وفق الخطة الزمنية للمسابقة',
      semester,
      weekLabel: '',
      status: 'pending',
      nonExecutionReason: '',
      notes: '',
    },
  ];
}

export function buildDefaultExecutivePlanFromPrograms(
  programs: GiftedMinisterialProgramRecord[],
  competitions: GiftedScientificCompetitionItem[]
): GiftedExecutivePlanItem[] {
  const applicablePrograms = programs.filter((p) => p.applicableToSchool);
  const items: GiftedExecutivePlanItem[] = applicablePrograms.map((p, idx) => ({
    id: `plan-item-${p.id}`,
    order: idx + 1,
    programTitle: p.title,
    linkedProgramId: p.id,
    stage: p.stageLabel,
    targetAudience: p.targetAudience,
    executionDate: p.scheduledPeriod,
    weekLabel: p.weekLabel || '',
    status: 'pending',
    nonExecutionReason: '',
    notes: p.notes || '',
  }));

  competitions.forEach((comp) => {
    items.push({
      id: `plan-item-${comp.id}`,
      order: items.length + 1,
      programTitle: comp.title,
      linkedProgramId: comp.id,
      stage: comp.stage,
      targetAudience: comp.targetAudience,
      executionDate: comp.startDate,
      weekLabel: comp.weekLabel || '',
      status: comp.status,
      nonExecutionReason: comp.nonExecutionReason || '',
      notes: comp.notes || '',
    });
  });

  return items;
}

export function createDefaultProgramTemplates(
  ministerialPrograms: GiftedMinisterialProgramRecord[] = createDefaultMinisterialPrograms(),
  scientificCompetitions: GiftedScientificCompetitionItem[] = createDefaultScientificCompetitions(),
  customInitiatives: GiftedCustomInitiativeItem[] = []
): GiftedProgramTemplateRecord[] {
  const nowIso = new Date().toISOString();

  const ministerialMeta: Record<
    GiftedMinisterialProgramCode,
    {
      category: GiftedProgramTemplateCategory;
      shortDescription: string;
      coordinatorInstructions: string;
    }
  > = {
    awareness: {
      category: 'ministerial',
      shortDescription:
        'برنامج وزاري مستمر لنشر ثقافة الموهبة والإبداع والتعريف بخصائص الطلبة الموهوبين للمجتمع المدرسي والمحلي.',
      coordinatorInstructions:
        'يُنفّذ بالتعاون مع التوجيه الطلابي ومعلمي المدرسة، مع توثيق الفقرات الإذاعية والنشرات التوعوية في مستودع الشواهد.',
    },
    national_identification: {
      category: 'identification_acceleration',
      shortDescription:
        'البرنامج الوطني للتعرف على الطلبة الموهوبين عبر مقياس موهبة بالشراكة مع مؤسسة موهبة ومركز قياس.',
      coordinatorInstructions:
        'متابعة الترشيح المدعوم والترشيح الذاتي، والتحقق من إثبات الهوية وتدريب الطلبة على نماذج المقياس قبل موعد الاختبار.',
    },
    olympiad_research: {
      category: 'ministerial',
      shortDescription:
        'أولمبياد وطني تنافسي يقوم على تقديم مشاريع بحثية علمية فردية وتحكيمها للتأهل للمنافسات المحلية والدولية.',
      coordinatorInstructions:
        'الالتزام بأخلاقيات البحث العلمي، ومتابعة تسجيل الطلبة في موقع موهبة وحضور الورش التدريبية للمسار البحثي.',
    },
    olympiad_scientific: {
      category: 'ministerial',
      shortDescription:
        'مسابقة وطنية سنوية في تخصصات العلوم والرياضيات والفيزياء والكيمياء والأحياء والمعلوماتية.',
      coordinatorInstructions:
        'توعية الطلبة بالتخصصات العلمية المتاحة، ومتابعة تسجيلهم وحضورهم للورش التدريبية وتأهلهم للمراحل المتقدمة.',
    },
    innovation_space: {
      category: 'enrichment_initiative',
      shortDescription:
        'برنامج إثرائي مدرسي لتنمية مهارات الابتكار وبناء المشاريع ضمن وحدات إثرائية تخصصية تنتهي بمعرض ختامي.',
      coordinatorInstructions:
        'يمر البرنامج بعشر محطات متسلسلة تبدأ بترشيح الطلبة والتمهيد وتنتهي بتقويم المشاريع وإقامة المعرض الختامي.',
    },
    gulf_week: {
      category: 'school_event',
      shortDescription:
        'تفعيل اليوم الخليجي والأسبوع الوطني للموهبة والإبداع عبر حزمة فعاليات وورش وشراكات وتكريم للموهوبين.',
      coordinatorInstructions:
        'إعداد خطة متكاملة لفعاليات الأسبوع تشمل الإذاعة والورش والندوات والمعارض وتكريم الطلبة الموهوبين بالمدرسة.',
    },
    acceleration: {
      category: 'identification_acceleration',
      shortDescription:
        'نظام وزاري يتيح للطلبة المحققين لشروط الموهبة الاستثنائية الانتقال إلى صف دراسي أعلى وفق ضوابط محددة.',
      coordinatorInstructions:
        'حصر الطلبة المحققين لشروط التسريع من نتائج مقياس موهبة، واستكمال الاستمارات والتهيئة النفسية والأكاديمية.',
    },
  };

  const templates: GiftedProgramTemplateRecord[] = ministerialPrograms.map(
    (prog) => {
      const meta = ministerialMeta[prog.code] || {
        category: 'ministerial' as GiftedProgramTemplateCategory,
        shortDescription: prog.objective,
        coordinatorInstructions:
          'مراجعة الإجراءات المعتمدة وتحديد تواريخ وأسابيع التنفيذ عند بدء البرنامج.',
      };
      const standardActions = (
        GIFTED_STANDARD_PROGRAM_ACTIONS[prog.code] ||
        prog.actions.map((a) => a.actionText)
      ).slice();

      return {
        id: `tpl-${prog.id}`,
        title: prog.title,
        category: meta.category,
        shortDescription: meta.shortDescription,
        objectives: prog.objective,
        targetAudience: prog.targetAudience,
        stageLabel: prog.stageLabel,
        requirementsAndActions: standardActions,
        coordinatorInstructions: meta.coordinatorInstructions,
        isActive: prog.applicableToSchool !== false,
        isOfficialReference: true,
        sourcePageNumber: prog.sourcePageNumber,
        linkedProgramId: prog.id,
        linkedMinisterialCode: prog.code,
        updatedAt: nowIso,
      };
    }
  );

  for (const comp of scientificCompetitions) {
    const isKangaroo = comp.id === 'comp-kangaroo' || comp.title.includes('الكانجارو');
    const isBebras = comp.id === 'comp-bebras' || comp.title.includes('بيبراس');
    const defaultCompActions = isKangaroo
      ? [
          'الإعلان عن مسابقة الكانجارو للرياضيات وتوعية الطلبة وأولياء الأمور بضوابط التسجيل.',
          'حصر وترشيح الطلبة المتميزين في الرياضيات ومتابعة إتمام تسجيلهم.',
          'تدريب الطلبة المشاركين على نماذج اختبارات الكانجارو السابقة.',
          'متابعة أداء الاختبار ورصد النتائج والشارات المحققة وتكريم الفائزين.',
        ]
      : isBebras
        ? [
            'التعريف بمسابقة بيبراس موهبة للمعلوماتية ومهارات التفكير الحاسوبي والمنطقي.',
            'تسجيل الطلبة المستهدفين والتحقق من جاهزية حساباتهم لأداء المسابقة.',
            'تقديم تدريبات تطبيقية على مسائل التفكير الحاسوبي وحل المشكلات.',
            'متابعة دخول الطلبة للاختبار وتوثيق الدرجات والمراكز المتحققة.',
          ]
        : [
            'الإعلان عن المسابقة العلمية وشروط المشاركة فيها داخل المدرسة.',
            'ترشيح وتسجيل الطلبة الموهوبين والمتميزين علمياً.',
            'تهيئة وتدريب الطلبة المشاركين ومتابعة مراحل التصفيات.',
            'رصد النتائج وتوثيق الإنجازات والشواهد.',
          ];

    templates.push({
      id: `tpl-${comp.id}`,
      title: comp.title,
      category: 'competition',
      shortDescription: isKangaroo
        ? 'مسابقة عالمية رائدة في الرياضيات تستهدف تنمية مهارات التفكير الرياضي وحل المسائل الإبداعية لدى الطلبة.'
        : isBebras
          ? 'مسابقة دولية في المعلوماتية والتفكير الحاسوبي تنمي مهارات التحليل المنطقي والبرمجي لدى الطلبة.'
          : 'مسابقة علمية تنافسية لرعاية الطلبة الموهوبين والمتميزين علمياً.',
      objectives: isKangaroo
        ? 'تعزيز شغف الطلبة بالرياضيات وتطوير قدرتهم على حل المشكلات الرياضية غير النمطية والمنافسة وطنياً ودولياً.'
        : isBebras
          ? 'تنمية مهارات التفكير الحاسوبي والمنطقي وحل المشكلات التقنية لدى الطلبة في مختلف المراحل الدراسية.'
          : `تنمية مهارات التنافس العلمي والتميز في ${comp.title}.`,
      targetAudience: comp.targetAudience,
      stageLabel: comp.stage,
      requirementsAndActions: defaultCompActions,
      coordinatorInstructions:
        'يُحدّد تاريخ التنفيذ الفعلي والأسابيع الدراسية عبر منتقي التقويم عند تسجيل تنفيذ المسابقة واختيار الطلاب المشاركين.',
      isActive: true,
      isOfficialReference: isKangaroo || isBebras,
      sourcePageNumber: 29,
      linkedProgramId: comp.id,
      updatedAt: nowIso,
    });
  }

  for (const init of customInitiatives) {
    const templateId = `tpl-${init.id}`;
    if (templates.some((t) => t.id === templateId)) continue;
    const cat: GiftedProgramTemplateCategory =
      init.initiativeType === 'فعالية' ? 'school_event' : 'enrichment_initiative';
    const tasksList = init.executedTasks
      ? init.executedTasks
          .split(/\r?\n|،|-/)
          .map((s) => s.trim())
          .filter(Boolean)
      : ['إعداد خطة المبادرة وتحديد المستهدفين', 'تنفيذ المبادرة وتوثيق الشواهد'];
    templates.push({
      id: templateId,
      title: init.title,
      category: cat,
      shortDescription: init.objective || 'مبادرة إثرائية مدرسية لرعاية الطلبة الموهوبين.',
      objectives: init.objective || 'تنمية قدرات ومواهب الطلبة المتميزين بالمدرسة.',
      targetAudience: init.targetAudience || 'الطلبة الموهوبون',
      stageLabel: init.stage || 'جميع المراحل',
      requirementsAndActions:
        tasksList.length > 0
          ? tasksList
          : ['تنفيذ المبادرة وتوثيق مخرجاتها وشواهدها'],
      coordinatorInstructions: init.notes || init.achievementIndicator || '',
      isActive: true,
      isOfficialReference: false,
      linkedProgramId: init.id,
      updatedAt: nowIso,
    });
  }

  return templates;
}

export function createEmptySection3Data(): GiftedSection3Data {
  return {
    giftedStudentsLog: [],
    programParticipantsLog: [],
    studentAchievementsLog: [],
    meetingsLog: [],
    visitsAndPartnershipsLog: [],
    readyTemplates: [],
  };
}

export function resolveDefaultAcademicYearAndSemester(
  settings?: SchoolSettings
): {
  academicYear: string;
  semester: ApprovedSchoolSemester;
} {
  const effectiveSettings = settings ?? loadSettingsFromStorage();
  const academicYear = (effectiveSettings?.academicYear || '').trim();
  const semester = normalizeApprovedSemester(effectiveSettings?.semester);
  return { academicYear, semester };
}

export function createInitialGiftedCoordinatorRecord(
  schoolStage: GiftedSchoolStage = 'combined',
  semester?: GiftedSemester,
  settings?: SchoolSettings
): GiftedCoordinatorRecord {
  const effectiveSemester: GiftedSemester =
    semester === 'first' || semester === 'second' || semester === 'full_year'
      ? semester
      : settings
        ? normalizeApprovedSemester(settings.semester) ===
          'الفصل الدراسي الثاني'
          ? 'second'
          : 'first'
        : 'first';
  const nowIso = new Date().toISOString();
  const ministerialPrograms = createDefaultMinisterialPrograms(
    schoolStage,
    effectiveSemester
  );
  const scientificCompetitions =
    createDefaultScientificCompetitions(effectiveSemester);
  const executivePlan = buildDefaultExecutivePlanFromPrograms(
    ministerialPrograms,
    scientificCompetitions
  );
  const programTemplates = createDefaultProgramTemplates(
    ministerialPrograms,
    scientificCompetitions,
    []
  );

  return {
    id: 'gifted-coordinator-record-main',
    schemaVersion: GIFTED_BACKUP_SCHEMA_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    basicInfo: {
      schoolStage,
      semester: effectiveSemester,
    },
    executivePlan,
    ministerialPrograms,
    customInitiatives: [],
    scientificCompetitions,
    programTemplates,
    programExecutions: [],
    unifiedRecords: [],
    section3Data: createEmptySection3Data(),
    students: [],
    studentParticipations: [],
    evidenceBundles: {},
    evaluation: {
      strengths: '',
      challenges: '',
      supportingEntities: '',
      improvementProposals: '',
    },
    programReportsOverrides: {},
    innovationProgressReportOverrides: {},
  };
}

// ============================================================================
// ٧. قراءة البيانات الأساسية من SettingsContext دون تكرار أو حقول جوال/بريد
// ============================================================================

export function resolveGiftedBasicInfo(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings
): ResolvedGiftedBasicInfo {
  const gendered = getGenderedLabels(settings?.gender || 'male');
  const isFemale = settings?.gender === 'female';
  const roleFromSettings = settings?.roles
    ? getRoleForSection(settings, 'gifted').trim()
    : '';
  const defaultCoordinatorTitle = isFemale ? 'منسقة الموهوبين' : 'منسق الموهوبين';

  const storedSemester = record?.basicInfo?.semester;
  const hasStoredSemester =
    storedSemester === 'first' ||
    storedSemester === 'second' ||
    storedSemester === 'full_year';
  const defaultSemesterFromSettings: GiftedSemester =
    settings?.semester === 'الفصل الدراسي الثاني' ? 'second' : 'first';
  const resolvedSemester: GiftedSemester = hasStoredSemester
    ? storedSemester
    : defaultSemesterFromSettings;
  const resolvedSemesterLabel = GIFTED_SEMESTER_LABELS[resolvedSemester];

  return {
    educationDepartment: (settings?.educationDepartment || '').trim() || 'غير محدد',
    schoolName: (settings?.schoolName || '').trim() || 'غير محدد',
    coordinatorName: (settings?.userName || '').trim() || 'غير محدد',
    coordinatorRole: roleFromSettings || defaultCoordinatorTitle,
    principalName: (settings?.principalName || '').trim() || 'غير محدد',
    principalTitle: gendered.principalTitle,
    coordinatorTitle: defaultCoordinatorTitle,
    academicYear: (settings?.academicYear || '').trim() || '١٤٤٨هـ',
    schoolStage: record.basicInfo.schoolStage,
    schoolStageLabel: GIFTED_SCHOOL_STAGE_LABELS[record.basicInfo.schoolStage],
    semester: resolvedSemester,
    semesterLabel: resolvedSemesterLabel,
  };
}

export function updateSchoolStageInRecord(
  record: GiftedCoordinatorRecord,
  nextStage: GiftedSchoolStage,
  autoSyncProgramApplicability = true
): GiftedCoordinatorRecord {
  const updatedPrograms = record.ministerialPrograms.map((prog) => {
    if (!autoSyncProgramApplicability) return prog;
    return {
      ...prog,
      applicableToSchool: isProgramSupportedInSchoolStage(
        prog.supportedStages,
        nextStage
      ),
    };
  });

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    basicInfo: {
      ...record.basicInfo,
      schoolStage: nextStage,
    },
    ministerialPrograms: updatedPrograms,
  };
}

// ============================================================================
// ٨. معادلة احتساب نسب الإنجاز المعتمدة (مع الفصل التام بين الخطة وإجراءات البرامج)
// ============================================================================

export interface GiftedStatusBreakdown {
  executed: number;
  pending: number;
  notExecuted: number;
  totalActive: number;
  completionPercentage: number;
}

export interface GiftedProgramCompletionSummary extends GiftedStatusBreakdown {
  programId: string;
  programCode: GiftedMinisterialProgramCode;
  programTitle: string;
  applicableToSchool: boolean;
}

export interface GiftedCompletionMetricsReport {
  /** مؤشر إنجاز بنود الخطة التنفيذية العامة (القسم 2) */
  executivePlanMetrics: GiftedStatusBreakdown;
  /** مؤشر إنجاز الإجراءات التفصيلية للبرامج الوزارية المطبقة على مرحلة المدرسة فقط (القسم 6) */
  programActionsMetrics: GiftedStatusBreakdown;
  /** عدد البرامج المستبعدة لعدم انطباقها على مرحلة المدرسة */
  excludedProgramsCount: number;
  /** عدد البرامج المطبقة على مرحلة المدرسة */
  applicableProgramsCount: number;
  /** تفاصيل الإنجاز لكل برنامج وزاري على حدة */
  perProgramBreakdown: GiftedProgramCompletionSummary[];
  /** مؤشر إنجاز المبادرات الإضافية المعدة من المنسق */
  customInitiativesMetrics: GiftedStatusBreakdown;
  /** مؤشر إنجاز المسابقات العلمية */
  competitionsMetrics: GiftedStatusBreakdown;
}

function computeBreakdownFromStatuses(
  statuses: GiftedExecutionStatus[]
): GiftedStatusBreakdown {
  let executed = 0;
  let pending = 0;
  let notExecuted = 0;

  for (const st of statuses) {
    if (st === 'executed') executed += 1;
    else if (st === 'not_executed') notExecuted += 1;
    else pending += 1;
  }

  const totalActive = statuses.length;
  // المعادلة المعتمدة: نسبة الإنجاز = عدد الإجراءات المنفذة ÷ إجمالي الإجراءات المفعلة × 100
  const completionPercentage =
    totalActive > 0 ? Math.round((executed / totalActive) * 100) : 0;

  return {
    executed,
    pending,
    notExecuted,
    totalActive,
    completionPercentage,
  };
}

export function computeGiftedCompletionMetrics(
  record: GiftedCoordinatorRecord
): GiftedCompletionMetricsReport {
  // ١. استبعاد بنود الخطة المرتبطة ببرامج غير مطبقة على مرحلة المدرسة
  const nonApplicableProgramIds = new Set(
    record.ministerialPrograms
      .filter((p) => !p.applicableToSchool)
      .map((p) => p.id)
  );

  const activeExecutivePlanStatuses = record.executivePlan
    .filter(
      (item) =>
        !item.linkedProgramId || !nonApplicableProgramIds.has(item.linkedProgramId)
    )
    .map((item) => item.status);

  const executivePlanMetrics = computeBreakdownFromStatuses(
    activeExecutivePlanStatuses
  );

  // ٢. حساب إنجاز إجراءات البرامج الوزارية (يقتصر على البرامج المطبقة على مرحلة المدرسة)
  const perProgramBreakdown: GiftedProgramCompletionSummary[] =
    record.ministerialPrograms.map((prog) => {
      if (!prog.applicableToSchool) {
        return {
          programId: prog.id,
          programCode: prog.code,
          programTitle: prog.title,
          applicableToSchool: false,
          executed: 0,
          pending: 0,
          notExecuted: 0,
          totalActive: 0,
          completionPercentage: 0,
        };
      }
      const standardCount = GIFTED_STANDARD_PROGRAM_ACTIONS[prog.code].length;
      const standardActions = prog.actions
        .filter((a) => a.isStandard !== false)
        .slice(0, standardCount);
      const bd = computeBreakdownFromStatuses(
        standardActions.map((a) => a.status)
      );
      return {
        programId: prog.id,
        programCode: prog.code,
        programTitle: prog.title,
        applicableToSchool: true,
        ...bd,
      };
    });

  const applicablePrograms = record.ministerialPrograms.filter(
    (p) => p.applicableToSchool
  );
  const excludedProgramsCount =
    record.ministerialPrograms.length - applicablePrograms.length;

  const allApplicableActionStatuses = applicablePrograms.flatMap((p) => {
    const standardCount = GIFTED_STANDARD_PROGRAM_ACTIONS[p.code].length;
    return p.actions
      .filter((a) => a.isStandard !== false)
      .slice(0, standardCount)
      .map((a) => a.status);
  });
  const programActionsMetrics = computeBreakdownFromStatuses(
    allApplicableActionStatuses
  );

  const customInitiativesMetrics = computeBreakdownFromStatuses(
    record.customInitiatives.map((i) => i.status)
  );

  const competitionsMetrics = computeBreakdownFromStatuses(
    record.scientificCompetitions.map((c) => c.status)
  );

  return {
    executivePlanMetrics,
    programActionsMetrics,
    excludedProgramsCount,
    applicableProgramsCount: applicablePrograms.length,
    perProgramBreakdown,
    customInitiativesMetrics,
    competitionsMetrics,
  };
}

// ============================================================================
// ٩. القسم الرابع: الجدول الموحد للفئة المستهدفة ومواعيد التنفيذ المرتبط بالمعرفات
// ============================================================================

export function getUnifiedTargetAndScheduleRows(
  record: GiftedCoordinatorRecord
): GiftedUnifiedScheduleRow[] {
  const rows: GiftedUnifiedScheduleRow[] = [];

  for (const prog of record.ministerialPrograms) {
    const bd = computeBreakdownFromStatuses(prog.actions.map((a) => a.status));
    const derivedStatus: GiftedExecutionStatus =
      bd.totalActive > 0 && bd.executed === bd.totalActive
        ? 'executed'
        : bd.notExecuted > 0 && bd.executed === 0
          ? 'not_executed'
          : 'pending';

    rows.push({
      entryId: prog.id,
      entryKind: 'ministerial',
      kindBadgeLabel: 'برنامج وزاري',
      title: prog.title,
      applicableToSchool: prog.applicableToSchool,
      stage: prog.stageLabel,
      targetAudience: prog.targetAudience,
      scheduledPeriod: prog.scheduledPeriod,
      semester: prog.semester,
      weekLabel: prog.weekLabel || '',
      status: derivedStatus,
      notes: prog.notes || '',
    });
  }

  for (const init of record.customInitiatives) {
    rows.push({
      entryId: init.id,
      entryKind: 'initiative',
      kindBadgeLabel: `مبادرة منسق (${init.initiativeType})`,
      title: init.title,
      applicableToSchool: true,
      stage: init.stage,
      targetAudience: init.targetAudience,
      scheduledPeriod: init.executionDate,
      semester: init.semester,
      weekLabel: init.weekLabel || '',
      status: init.status,
      notes: init.notes || '',
    });
  }

  for (const comp of record.scientificCompetitions) {
    rows.push({
      entryId: comp.id,
      entryKind: 'competition',
      kindBadgeLabel: 'مسابقة علمية',
      title: comp.title,
      applicableToSchool: true,
      stage: comp.stage,
      targetAudience: comp.targetAudience,
      scheduledPeriod: comp.startDate,
      semester: comp.semester,
      weekLabel: comp.weekLabel || '',
      status: comp.status,
      notes: comp.notes || '',
    });
  }

  return rows;
}

export interface ScheduleUpdatePatch {
  stage?: string;
  targetAudience?: string;
  scheduledPeriod?: string;
  semester?: GiftedSemester;
  weekLabel?: string;
  notes?: string;
}

export function updateUnifiedTargetAndScheduleRow(
  record: GiftedCoordinatorRecord,
  entryKind: GiftedScheduleEntryKind,
  entryId: string,
  patch: ScheduleUpdatePatch
): GiftedCoordinatorRecord {
  const nextMinisterial =
    entryKind === 'ministerial'
      ? record.ministerialPrograms.map((p) =>
          p.id === entryId
            ? {
                ...p,
                stageLabel: patch.stage ?? p.stageLabel,
                targetAudience: patch.targetAudience ?? p.targetAudience,
                scheduledPeriod: patch.scheduledPeriod ?? p.scheduledPeriod,
                semester: patch.semester ?? p.semester,
                weekLabel: patch.weekLabel ?? p.weekLabel,
                notes: patch.notes ?? p.notes,
              }
            : p
        )
      : record.ministerialPrograms;

  const nextInitiatives =
    entryKind === 'initiative'
      ? record.customInitiatives.map((item) =>
          item.id === entryId
            ? {
                ...item,
                stage: patch.stage ?? item.stage,
                targetAudience: patch.targetAudience ?? item.targetAudience,
                executionDate: patch.scheduledPeriod ?? item.executionDate,
                semester: patch.semester ?? item.semester,
                weekLabel: patch.weekLabel ?? item.weekLabel,
                notes: patch.notes ?? item.notes,
              }
            : item
        )
      : record.customInitiatives;

  const nextCompetitions =
    entryKind === 'competition'
      ? record.scientificCompetitions.map((comp) =>
          comp.id === entryId
            ? {
                ...comp,
                stage: patch.stage ?? comp.stage,
                targetAudience: patch.targetAudience ?? comp.targetAudience,
                startDate: patch.scheduledPeriod ?? comp.startDate,
                semester: patch.semester ?? comp.semester,
                weekLabel: patch.weekLabel ?? comp.weekLabel,
                notes: patch.notes ?? comp.notes,
              }
            : comp
        )
      : record.scientificCompetitions;

  // مزامنة تلقائية مع أي بند مرتبط بنفس المعرف في جدول الخطة التنفيذية (القسم 2) لمنع التكرار أو التضارب
  const nextExecutivePlan = record.executivePlan.map((planItem) => {
    if (planItem.linkedProgramId !== entryId) return planItem;
    return {
      ...planItem,
      stage: patch.stage ?? planItem.stage,
      targetAudience: patch.targetAudience ?? planItem.targetAudience,
      executionDate: patch.scheduledPeriod ?? planItem.executionDate,
      weekLabel: patch.weekLabel ?? planItem.weekLabel,
      notes: patch.notes ?? planItem.notes,
    };
  });

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    ministerialPrograms: nextMinisterial,
    customInitiatives: nextInitiatives,
    scientificCompetitions: nextCompetitions,
    executivePlan: nextExecutivePlan,
  };
}

// ============================================================================
// ١٠. تنقية وفحص وحفظ السجل النصي في localStorage
// ============================================================================

function pickCleanString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.trim() : fallback;
}

function sanitizeStatus(val: unknown): GiftedExecutionStatus {
  if (val === 'executed' || val === 'not_executed' || val === 'pending') {
    return val;
  }
  return 'pending';
}

function sanitizeStage(val: unknown): GiftedSchoolStage {
  if (
    val === 'elementary' ||
    val === 'middle' ||
    val === 'high' ||
    val === 'combined'
  ) {
    return val;
  }
  return 'combined';
}

function sanitizeSemester(val: unknown): GiftedSemester {
  if (val === 'first' || val === 'second' || val === 'full_year') {
    return val;
  }
  return 'first';
}

export function sanitizeGiftedCoordinatorRecord(
  raw: unknown
): GiftedCoordinatorRecord {
  const fallback = createInitialGiftedCoordinatorRecord();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const rawBasic =
    candidate.basicInfo && typeof candidate.basicInfo === 'object'
      ? (candidate.basicInfo as Record<string, unknown>)
      : {};

  const schoolStage = sanitizeStage(rawBasic.schoolStage);
  const semester = sanitizeSemester(rawBasic.semester);

  const defaultPrograms = createDefaultMinisterialPrograms(schoolStage, semester);
  const rawPrograms = Array.isArray(candidate.ministerialPrograms)
    ? (candidate.ministerialPrograms as Array<Record<string, unknown>>)
    : [];

  // نضمن وجود البرامج الوزارية السبعة مع الحفاظ على إجراءات كل برنامج الأصلية المستقلة
  const ministerialPrograms: GiftedMinisterialProgramRecord[] =
    defaultPrograms.map((defProg) => {
      const matched = rawPrograms.find(
        (rp) => rp && (rp.code === defProg.code || rp.id === defProg.id)
      );
      if (!matched) return defProg;

      const rawActions = Array.isArray(matched.actions)
        ? (matched.actions as Array<Record<string, unknown>>)
        : [];

      const sanitizedActions: GiftedExecutionActionItem[] = defProg.actions.map(
        (stdAct, idx) => {
          const matchedRaw =
            rawActions.find((ra) => ra && ra.id === stdAct.id) ||
            rawActions[idx];
          if (!matchedRaw) return stdAct;
          return {
            id: stdAct.id,
            order: stdAct.order,
            actionText: stdAct.actionText,
            executionDate: pickCleanString(matchedRaw.executionDate, ''),
            weekLabel: pickCleanString(matchedRaw.weekLabel, ''),
            status: sanitizeStatus(matchedRaw.status),
            nonExecutionReason: pickCleanString(
              matchedRaw.nonExecutionReason,
              ''
            ),
            isStandard: true,
          };
        }
      );

      return {
        ...defProg,
        applicableToSchool:
          typeof matched.applicableToSchool === 'boolean'
            ? matched.applicableToSchool
            : defProg.applicableToSchool,
        stageLabel: pickCleanString(matched.stageLabel, defProg.stageLabel),
        targetAudience: pickCleanString(
          matched.targetAudience,
          defProg.targetAudience
        ),
        objective: pickCleanString(matched.objective, defProg.objective),
        scheduledPeriod: pickCleanString(
          matched.scheduledPeriod,
          defProg.scheduledPeriod
        ),
        semester: sanitizeSemester(matched.semester ?? semester),
        weekLabel: pickCleanString(matched.weekLabel, ''),
        notes: pickCleanString(matched.notes, ''),
        actions: sanitizedActions,
      };
    });

  const rawInitiatives = Array.isArray(candidate.customInitiatives)
    ? (candidate.customInitiatives as Array<Record<string, unknown>>)
    : [];

  const customInitiatives: GiftedCustomInitiativeItem[] = rawInitiatives
    .map((ri, idx) => {
      const rawType = pickCleanString(ri.initiativeType, 'مبادرة');
      const initiativeType: GiftedInitiativeKind =
        rawType === 'برنامج' || rawType === 'فعالية' ? rawType : 'مبادرة';
      return {
        id: pickCleanString(ri.id, `init-${idx + 1}`),
        title: pickCleanString(ri.title, ''),
        initiativeType,
        objective: pickCleanString(ri.objective, ''),
        executedTasks: pickCleanString(ri.executedTasks, ''),
        stage: pickCleanString(ri.stage, 'جميع المراحل'),
        targetAudience: pickCleanString(ri.targetAudience, 'الطلبة الموهوبون'),
        executionDate: pickCleanString(ri.executionDate, ''),
        semester: sanitizeSemester(ri.semester ?? semester),
        weekLabel: pickCleanString(ri.weekLabel, ''),
        status: sanitizeStatus(ri.status),
        nonExecutionReason: pickCleanString(ri.nonExecutionReason, ''),
        achievementIndicator: pickCleanString(ri.achievementIndicator, ''),
        notes: pickCleanString(ri.notes, ''),
      };
    })
    .filter((item) => item.title.length > 0);

  const rawCompetitions = Array.isArray(candidate.scientificCompetitions)
    ? (candidate.scientificCompetitions as Array<Record<string, unknown>>)
    : null;

  const scientificCompetitions: GiftedScientificCompetitionItem[] =
    rawCompetitions
      ? rawCompetitions
          .map((rc, idx) => ({
            id: pickCleanString(rc.id, `comp-${idx + 1}`),
            title: pickCleanString(rc.title, ''),
            stage: pickCleanString(rc.stage, 'جميع المراحل'),
            targetAudience: pickCleanString(
              rc.targetAudience,
              'الطلبة الموهوبون والمتفوقون'
            ),
            startDate: pickCleanString(rc.startDate, ''),
            semester: sanitizeSemester(rc.semester ?? semester),
            weekLabel: pickCleanString(rc.weekLabel, ''),
            status: sanitizeStatus(rc.status),
            nonExecutionReason: pickCleanString(rc.nonExecutionReason, ''),
            notes: pickCleanString(rc.notes, ''),
          }))
          .filter((c) => c.title.length > 0)
      : createDefaultScientificCompetitions(semester);

  const rawPlan = Array.isArray(candidate.executivePlan)
    ? (candidate.executivePlan as Array<Record<string, unknown>>)
    : null;

  const executivePlan: GiftedExecutivePlanItem[] = rawPlan
    ? rawPlan
        .map((rp, idx) => ({
          id: pickCleanString(rp.id, `plan-${idx + 1}`),
          order: typeof rp.order === 'number' ? rp.order : idx + 1,
          programTitle: pickCleanString(rp.programTitle, ''),
          linkedProgramId: pickCleanString(rp.linkedProgramId, '') || undefined,
          stage: pickCleanString(rp.stage, ''),
          targetAudience: pickCleanString(rp.targetAudience, ''),
          executionDate: pickCleanString(rp.executionDate, ''),
          weekLabel: pickCleanString(rp.weekLabel, ''),
          status: sanitizeStatus(rp.status),
          nonExecutionReason: pickCleanString(rp.nonExecutionReason, ''),
          notes: pickCleanString(rp.notes, ''),
        }))
        .filter((p) => p.programTitle.length > 0)
    : buildDefaultExecutivePlanFromPrograms(
        ministerialPrograms,
        scientificCompetitions
      );

  const rawStudents = Array.isArray(candidate.students)
    ? (candidate.students as Array<Record<string, unknown>>)
    : [];

  // تنقية الطلاب: الحفاظ على الحقول الثمانية المعتمدة حرفياً مع الاحتفاظ بالحقول الخلفية القديمة دون إسقاط أي بيانات
  const students: GiftedStudentRecord[] = rawStudents
    .map((rs, idx) => {
      const civilId = pickCleanString(rs.civilId, '');
      const rawGender = pickCleanString(rs.gender, '');
      const gender: GiftedStudentGender | undefined =
        rawGender === 'طالب' || rawGender === 'طالبة' ? rawGender : undefined;
      const academicYear = pickCleanString(rs.academicYear, '');
      const rawSem = pickCleanString(rs.semester, '');
      const stuSemester: ApprovedSchoolSemester | undefined =
        rawSem === 'الفصل الدراسي الأول' || rawSem === 'الفصل الدراسي الثاني'
          ? rawSem
          : rawSem === 'second'
            ? 'الفصل الدراسي الثاني'
            : rawSem === 'first'
              ? 'الفصل الدراسي الأول'
              : undefined;
      const studentMobile = pickCleanString(rs.studentMobile, '');
      const guardianName = pickCleanString(rs.guardianName, '');
      const clsRaw = pickCleanString(rs.classification, 'gifted');
      const classification: GiftedClassificationLevel =
        clsRaw === 'exceptional_gifted' || clsRaw === 'promising'
          ? clsRaw
          : 'gifted';
      return {
        id: pickCleanString(rs.id, `stu-${idx + 1}`),
        name: pickCleanString(rs.name, ''),
        grade: pickCleanString(rs.grade, ''),
        level: pickCleanString(rs.level, ''),
        ...(civilId ? { civilId } : {}),
        ...(gender ? { gender } : {}),
        ...(academicYear ? { academicYear } : {}),
        ...(stuSemester ? { semester: stuSemester } : {}),
        ...(studentMobile ? { studentMobile } : {}),
        ...(guardianName ? { guardianName } : {}),
        talentDomain: pickCleanString(rs.talentDomain, ''),
        score: pickCleanString(rs.score, ''),
        classification,
        notes: pickCleanString(rs.notes, ''),
      };
    })
    .filter((s) => s.name.length > 0);

  const validStudentIds = new Set(students.map((s) => s.id));
  const rawParticipations = Array.isArray(candidate.studentParticipations)
    ? (candidate.studentParticipations as Array<Record<string, unknown>>)
    : [];

  const validCategories = new Set<GiftedParticipationCategory>([
    'national_identification',
    'olympiad_research',
    'olympiad_scientific',
    'innovation_space',
    'acceleration',
    'scientific_competition',
  ]);

  const studentParticipations: GiftedStudentParticipationRecord[] =
    rawParticipations
      .map((rp, idx) => {
        const studentId = pickCleanString(rp.studentId, '');
        const catRaw = pickCleanString(
          rp.category,
          'national_identification'
        ) as GiftedParticipationCategory;
        const category: GiftedParticipationCategory = validCategories.has(
          catRaw
        )
          ? catRaw
          : 'national_identification';

        const nomRaw = pickCleanString(rp.nominationType, '');
        const nominationType: GiftedNominationType | undefined =
          nomRaw === 'supported' || nomRaw === 'self' ? nomRaw : undefined;

        const appRaw = pickCleanString(rp.approvalStatus, '');
        const approvalStatus: GiftedApprovalStatus | undefined =
          appRaw === 'approved' || appRaw === 'pending' || appRaw === 'rejected'
            ? appRaw
            : undefined;

        const linkedProgramOrCompetitionId =
          pickCleanString(rp.linkedProgramOrCompetitionId, '') || undefined;
        const executionId = pickCleanString(rp.executionId, '') || undefined;
        const matchedStu = students.find((s) => s.id === studentId);
        const studentGradeAtParticipation =
          pickCleanString(rp.studentGradeAtParticipation, '') ||
          matchedStu?.grade ||
          undefined;
        const studentLevelAtParticipation =
          pickCleanString(rp.studentLevelAtParticipation, '') ||
          matchedStu?.level ||
          undefined;
        const rawHistCls = pickCleanString(
          rp.studentClassificationAtParticipation,
          ''
        );
        const studentClassificationAtParticipation:
          | GiftedClassificationLevel
          | undefined =
          rawHistCls === 'exceptional_gifted' ||
          rawHistCls === 'gifted' ||
          rawHistCls === 'promising'
            ? rawHistCls
            : matchedStu?.classification;
        const participationDate =
          pickCleanString(rp.participationDate, '') || undefined;
        const participationHijriDate =
          pickCleanString(rp.participationHijriDate, '') || undefined;

        const score = pickCleanString(rp.score, '') || undefined;
        const classificationResult =
          pickCleanString(rp.classificationResult, '') || undefined;
        const projectTitle = pickCleanString(rp.projectTitle, '') || undefined;
        const projectField = pickCleanString(rp.projectField, '') || undefined;
        const scientificTrack =
          pickCleanString(rp.scientificTrack, '') || undefined;
        const enrichmentUnit =
          pickCleanString(rp.enrichmentUnit, '') || undefined;
        const competitionTitle =
          pickCleanString(rp.competitionTitle, '') || undefined;

        return {
          id: pickCleanString(rp.id, `part-${idx + 1}`),
          studentId,
          category,
          ...(linkedProgramOrCompetitionId
            ? { linkedProgramOrCompetitionId }
            : {}),
          ...(executionId ? { executionId } : {}),
          ...(studentGradeAtParticipation
            ? { studentGradeAtParticipation }
            : {}),
          ...(studentLevelAtParticipation
            ? { studentLevelAtParticipation }
            : {}),
          ...(studentClassificationAtParticipation
            ? { studentClassificationAtParticipation }
            : {}),
          ...(participationDate ? { participationDate } : {}),
          ...(participationHijriDate ? { participationHijriDate } : {}),
          ...(nominationType ? { nominationType } : {}),
          ...(score ? { score } : {}),
          ...(classificationResult ? { classificationResult } : {}),
          ...(projectTitle ? { projectTitle } : {}),
          ...(projectField ? { projectField } : {}),
          ...(scientificTrack ? { scientificTrack } : {}),
          ...(enrichmentUnit ? { enrichmentUnit } : {}),
          ...(approvalStatus ? { approvalStatus } : {}),
          ...(competitionTitle ? { competitionTitle } : {}),
          qualifiedToNextStage: Boolean(rp.qualifiedToNextStage),
          achievementText: pickCleanString(rp.achievementText, ''),
          notes: pickCleanString(rp.notes, ''),
        };
      })
      .filter((p) => p.studentId.length > 0 && validStudentIds.has(p.studentId));

  const sanitizedEvidenceBundles: Record<string, GiftedProgramEvidenceBundle> = {};
  if (candidate.evidenceBundles && typeof candidate.evidenceBundles === 'object') {
    for (const [key, rawBundle] of Object.entries(
      candidate.evidenceBundles as Record<string, unknown>
    )) {
      if (!rawBundle || typeof rawBundle !== 'object') continue;
      const b = rawBundle as Record<string, unknown>;
      const targetId = pickCleanString(b.targetId, key);
      if (!targetId) continue;

      const rawPhotos = Array.isArray(b.photos)
        ? (b.photos as Array<Record<string, unknown>>)
        : [];
      const photos: GiftedEvidencePhotoRef[] = rawPhotos
        .map((rp, idx) => ({
          id: pickCleanString(rp.id, `photo-${targetId}-${idx + 1}`),
          blobKey: pickCleanString(rp.blobKey, ''),
          title: pickCleanString(rp.title, `شاهد مصور ${idx + 1}`),
          ...(pickCleanString(rp.caption, '')
            ? { caption: pickCleanString(rp.caption, '') }
            : {}),
          selectedForProgramReport:
            typeof rp.selectedForProgramReport === 'boolean'
              ? rp.selectedForProgramReport
              : true,
          selectedForFinalRecord:
            typeof rp.selectedForFinalRecord === 'boolean'
              ? rp.selectedForFinalRecord
              : true,
          createdAt: pickCleanString(rp.createdAt, new Date().toISOString()),
        }))
        .filter((p) => p.blobKey.length > 0)
        .slice(0, 4);

      const rawLinks = Array.isArray(b.links)
        ? (b.links as Array<Record<string, unknown>>)
        : [];
      const links: GiftedEvidenceLinkItem[] = rawLinks
        .map((rl, idx) => ({
          id: pickCleanString(rl.id, `link-${targetId}-${idx + 1}`),
          title: pickCleanString(rl.title, `رابط شاهد ${idx + 1}`),
          url: pickCleanString(rl.url, ''),
          selectedForProgramReport:
            typeof rl.selectedForProgramReport === 'boolean'
              ? rl.selectedForProgramReport
              : true,
          selectedForFinalRecord:
            typeof rl.selectedForFinalRecord === 'boolean'
              ? rl.selectedForFinalRecord
              : true,
        }))
        .filter((l) => l.url.length > 0)
        .slice(0, 4);

      sanitizedEvidenceBundles[targetId] = {
        targetId,
        showEvidencesInReport:
          typeof b.showEvidencesInReport === 'boolean'
            ? b.showEvidencesInReport
            : true,
        photos,
        links,
      };
    }
  }

  const sanitizedProgramReportsOverrides: Record<
    string,
    GiftedProgramEventReportOverrides
  > = {};
  if (
    candidate.programReportsOverrides &&
    typeof candidate.programReportsOverrides === 'object'
  ) {
    for (const [key, rawOv] of Object.entries(
      candidate.programReportsOverrides as Record<string, unknown>
    )) {
      if (!rawOv || typeof rawOv !== 'object') continue;
      const ov = rawOv as Record<string, unknown>;
      const targetId = pickCleanString(ov.targetId, key);
      if (!targetId) continue;
      sanitizedProgramReportsOverrides[targetId] = {
        targetId,
        ...(pickCleanString(ov.dayLabel, '')
          ? { dayLabel: pickCleanString(ov.dayLabel, '') }
          : {}),
        ...(pickCleanString(ov.executionDateOverride, '')
          ? { executionDateOverride: pickCleanString(ov.executionDateOverride, '') }
          : {}),
        ...(pickCleanString(ov.durationLabel, '')
          ? { durationLabel: pickCleanString(ov.durationLabel, '') }
          : {}),
        ...(pickCleanString(ov.executionMechanismOverride, '')
          ? {
              executionMechanismOverride: pickCleanString(
                ov.executionMechanismOverride,
                ''
              ),
            }
          : {}),
        ...(pickCleanString(ov.beneficiariesCountOverride, '')
          ? {
              beneficiariesCountOverride: pickCleanString(
                ov.beneficiariesCountOverride,
                ''
              ),
            }
          : {}),
        ...(pickCleanString(ov.difficultiesOverride, '')
          ? { difficultiesOverride: pickCleanString(ov.difficultiesOverride, '') }
          : {}),
        ...(pickCleanString(ov.suggestionsOverride, '')
          ? { suggestionsOverride: pickCleanString(ov.suggestionsOverride, '') }
          : {}),
      };
    }
  }

  let sanitizedInnovationOverrides: GiftedInnovationProgressReportOverrides = {};
  if (
    candidate.innovationProgressReportOverrides &&
    typeof candidate.innovationProgressReportOverrides === 'object'
  ) {
    const io = candidate.innovationProgressReportOverrides as Record<
      string,
      unknown
    >;
    sanitizedInnovationOverrides = {
      ...(pickCleanString(io.innovationTeacherName, '')
        ? { innovationTeacherName: pickCleanString(io.innovationTeacherName, '') }
        : {}),
      ...(pickCleanString(io.enrichmentUnitOverride, '')
        ? { enrichmentUnitOverride: pickCleanString(io.enrichmentUnitOverride, '') }
        : {}),
      ...(pickCleanString(io.targetGradeOverride, '')
        ? { targetGradeOverride: pickCleanString(io.targetGradeOverride, '') }
        : {}),
      ...(pickCleanString(io.beneficiariesCountOverride, '')
        ? {
            beneficiariesCountOverride: pickCleanString(
              io.beneficiariesCountOverride,
              ''
            ),
          }
        : {}),
      ...(pickCleanString(io.outputsCount, '')
        ? { outputsCount: pickCleanString(io.outputsCount, '') }
        : {}),
      ...(pickCleanString(io.distinguishedOutputsCount, '')
        ? {
            distinguishedOutputsCount: pickCleanString(
              io.distinguishedOutputsCount,
              ''
            ),
          }
        : {}),
      ...(pickCleanString(io.distinguishedOutputsSummary, '')
        ? {
            distinguishedOutputsSummary: pickCleanString(
              io.distinguishedOutputsSummary,
              ''
            ),
          }
        : {}),
      ...(pickCleanString(io.supportingEntitiesOverride, '')
        ? {
            supportingEntitiesOverride: pickCleanString(
              io.supportingEntitiesOverride,
              ''
            ),
          }
        : {}),
      ...(pickCleanString(io.strengthsOverride, '')
        ? { strengthsOverride: pickCleanString(io.strengthsOverride, '') }
        : {}),
      ...(pickCleanString(io.challengesOverride, '')
        ? { challengesOverride: pickCleanString(io.challengesOverride, '') }
        : {}),
      ...(pickCleanString(io.improvementProposalsOverride, '')
        ? {
            improvementProposalsOverride: pickCleanString(
              io.improvementProposalsOverride,
              ''
            ),
          }
        : {}),
    };
  }

  const defaultTemplates = createDefaultProgramTemplates(
    ministerialPrograms,
    scientificCompetitions,
    customInitiatives
  );

  const validTemplateCategories = new Set<GiftedProgramTemplateCategory>([
    'ministerial',
    'competition',
    'enrichment_initiative',
    'school_event',
    'identification_acceleration',
  ]);

  const validMinisterialCodes = new Set<GiftedMinisterialProgramCode>([
    'awareness',
    'national_identification',
    'olympiad_research',
    'olympiad_scientific',
    'innovation_space',
    'gulf_week',
    'acceleration',
  ]);

  let programTemplates: GiftedProgramTemplateRecord[] = defaultTemplates;
  if (Array.isArray(candidate.programTemplates)) {
    const rawTemplates = candidate.programTemplates as Array<
      Record<string, unknown>
    >;
    const sanitizedCustomAndEdited: GiftedProgramTemplateRecord[] = rawTemplates
      .map((rt, idx) => {
        if (!rt || typeof rt !== 'object') return null;
        const id = pickCleanString(rt.id, `tpl-custom-${idx + 1}`);
        const title = pickCleanString(rt.title, '');
        if (!title) return null;

        const matchedDefault = defaultTemplates.find(
          (dt) =>
            dt.id === id ||
            (rt.linkedProgramId && dt.linkedProgramId === rt.linkedProgramId)
        );

        const rawCat = pickCleanString(
          rt.category,
          matchedDefault?.category || 'enrichment_initiative'
        ) as GiftedProgramTemplateCategory;
        const category: GiftedProgramTemplateCategory =
          validTemplateCategories.has(rawCat)
            ? rawCat
            : matchedDefault?.category || 'enrichment_initiative';

        const rawActions = Array.isArray(rt.requirementsAndActions)
          ? (rt.requirementsAndActions as unknown[])
              .map((a) => pickCleanString(a, ''))
              .filter((a) => a.length > 0)
          : matchedDefault?.requirementsAndActions || [];

        const rawMinCode = pickCleanString(
          rt.linkedMinisterialCode,
          matchedDefault?.linkedMinisterialCode || ''
        ) as GiftedMinisterialProgramCode;
        const linkedMinisterialCode = validMinisterialCodes.has(rawMinCode)
          ? rawMinCode
          : matchedDefault?.linkedMinisterialCode;

        const linkedProgramId =
          pickCleanString(
            rt.linkedProgramId,
            matchedDefault?.linkedProgramId || ''
          ) || undefined;

        const sourcePageNumber =
          typeof rt.sourcePageNumber === 'number'
            ? rt.sourcePageNumber
            : matchedDefault?.sourcePageNumber;

        return {
          id,
          title,
          category,
          shortDescription: pickCleanString(
            rt.shortDescription,
            matchedDefault?.shortDescription || ''
          ),
          objectives: pickCleanString(
            rt.objectives,
            matchedDefault?.objectives || ''
          ),
          targetAudience: pickCleanString(
            rt.targetAudience,
            matchedDefault?.targetAudience || 'الطلبة الموهوبون'
          ),
          stageLabel: pickCleanString(
            rt.stageLabel,
            matchedDefault?.stageLabel || 'جميع المراحل'
          ),
          requirementsAndActions:
            rawActions.length > 0
              ? rawActions
              : matchedDefault?.requirementsAndActions || [],
          coordinatorInstructions: pickCleanString(
            rt.coordinatorInstructions,
            matchedDefault?.coordinatorInstructions || ''
          ),
          isActive:
            typeof rt.isActive === 'boolean'
              ? rt.isActive
              : matchedDefault
                ? matchedDefault.isActive
                : true,
          isOfficialReference:
            typeof rt.isOfficialReference === 'boolean'
              ? rt.isOfficialReference
              : Boolean(matchedDefault?.isOfficialReference),
          ...(sourcePageNumber !== undefined ? { sourcePageNumber } : {}),
          ...(linkedProgramId ? { linkedProgramId } : {}),
          ...(linkedMinisterialCode ? { linkedMinisterialCode } : {}),
          updatedAt: pickCleanString(rt.updatedAt, new Date().toISOString()),
        } as GiftedProgramTemplateRecord;
      })
      .filter((item): item is GiftedProgramTemplateRecord => item !== null);

    // نضمن عدم ضياع أي قالب مرجعي رسمي من البرامج الوزارية السبعة أو المسابقات المعتمدة
    const existingTemplateIds = new Set(
      sanitizedCustomAndEdited.map((t) => t.id)
    );
    const missingOfficialTemplates = defaultTemplates.filter(
      (dt) => !existingTemplateIds.has(dt.id)
    );
    programTemplates = [
      ...sanitizedCustomAndEdited,
      ...missingOfficialTemplates,
    ];
  }

  const validWeeksSet = new Set<string>(GIFTED_ACADEMIC_WEEKS_LIST);
  const rawExecutions = Array.isArray(candidate.programExecutions)
    ? (candidate.programExecutions as Array<Record<string, unknown>>)
    : [];

  const programExecutions: GiftedProgramExecutionSnapshotRecord[] =
    rawExecutions
      .map((re, idx) => {
        if (!re || typeof re !== 'object') return null;
        const templateId = pickCleanString(re.templateId, '');
        if (!templateId) return null;
        const rawCat = pickCleanString(
          re.templateCategorySnapshot,
          'ministerial'
        ) as GiftedProgramTemplateCategory;
        const templateCategorySnapshot: GiftedProgramTemplateCategory =
          validTemplateCategories.has(rawCat) ? rawCat : 'ministerial';

        const rawSelectedWeeks = Array.isArray(re.selectedWeeks)
          ? (re.selectedWeeks as unknown[])
              .map((w) => pickCleanString(w, ''))
              .filter((w) => validWeeksSet.has(w))
          : [];

        const rawActionsSnap = Array.isArray(re.actionsSnapshot)
          ? (re.actionsSnapshot as Array<Record<string, unknown>>)
          : [];

        const actionsSnapshot = rawActionsSnap
          .map((ra, aIdx) => ({
            id: pickCleanString(ra.id, `exec-act-${idx + 1}-${aIdx + 1}`),
            order: typeof ra.order === 'number' ? ra.order : aIdx + 1,
            actionText: pickCleanString(ra.actionText, ''),
            completed: Boolean(ra.completed),
            ...(pickCleanString(ra.executionDate, '')
              ? { executionDate: pickCleanString(ra.executionDate, '') }
              : {}),
            ...(Array.isArray(ra.selectedWeeks)
              ? {
                  selectedWeeks: (ra.selectedWeeks as unknown[])
                    .map((w) => pickCleanString(w, ''))
                    .filter((w) => validWeeksSet.has(w)),
                }
              : {}),
          }))
          .filter((a) => a.actionText.length > 0);

        const participatingStudentIds = Array.isArray(re.participatingStudentIds)
          ? (re.participatingStudentIds as unknown[])
              .map((sid) => pickCleanString(sid, ''))
              .filter(Boolean)
          : [];

        const linkedParticipationIds = Array.isArray(re.linkedParticipationIds)
          ? (re.linkedParticipationIds as unknown[])
              .map((pid) => pickCleanString(pid, ''))
              .filter(Boolean)
          : [];

        const executionEndDate = pickCleanString(re.executionEndDate, '');
        const executionHijriDate = pickCleanString(re.executionHijriDate, '');
        const legacySourceId = pickCleanString(re.legacySourceId, '');
        const status = sanitizeStatus(re.status);
        const nonExecutionReason = pickCleanString(re.nonExecutionReason, '');
        const resultsSummary = pickCleanString(re.resultsSummary, '');
        const recommendations = pickCleanString(re.recommendations, '');
        const challenges = pickCleanString(re.challenges, '');
        const beneficiariesCountOverride = pickCleanString(
          re.beneficiariesCountOverride,
          ''
        );
        const evidenceBundleTargetId = pickCleanString(
          re.evidenceBundleTargetId,
          ''
        );

        return {
          id: pickCleanString(re.id, `exec-${idx + 1}`),
          templateId,
          ...(legacySourceId ? { legacySourceId } : {}),
          templateTitleSnapshot: pickCleanString(
            re.templateTitleSnapshot,
            'برنامج منفذ'
          ),
          templateCategorySnapshot,
          objectivesSnapshot: pickCleanString(re.objectivesSnapshot, ''),
          targetAudienceSnapshot: pickCleanString(re.targetAudienceSnapshot, ''),
          stageLabelSnapshot: pickCleanString(
            re.stageLabelSnapshot,
            'جميع المراحل'
          ),
          status,
          ...(nonExecutionReason ? { nonExecutionReason } : {}),
          actionsSnapshot,
          executionStartDate: pickCleanString(re.executionStartDate, ''),
          ...(executionHijriDate ? { executionHijriDate } : {}),
          ...(executionEndDate ? { executionEndDate } : {}),
          selectedWeeks: rawSelectedWeeks,
          participatingStudentIds,
          linkedParticipationIds,
          ...(evidenceBundleTargetId ? { evidenceBundleTargetId } : {}),
          ...(resultsSummary ? { resultsSummary } : {}),
          ...(recommendations ? { recommendations } : {}),
          ...(challenges ? { challenges } : {}),
          ...(beneficiariesCountOverride ? { beneficiariesCountOverride } : {}),
          notes: pickCleanString(re.notes, ''),
          createdAt: pickCleanString(re.createdAt, new Date().toISOString()),
        } as GiftedProgramExecutionSnapshotRecord;
      })
      .filter(
        (item): item is GiftedProgramExecutionSnapshotRecord => item !== null
      );

  const validWorkKinds = new Set<GiftedCoordinatorWorkKind>([
    'committee_meeting',
    'teacher_communication',
    'parent_communication',
    'other_work',
  ]);

  const rawAdditionalWorks = Array.isArray(candidate.coordinatorAdditionalWorks)
    ? (candidate.coordinatorAdditionalWorks as Array<Record<string, unknown>>)
    : [];

  const coordinatorAdditionalWorks: GiftedCoordinatorAdditionalWorkItem[] =
    rawAdditionalWorks
      .map((rw, idx) => {
        if (!rw || typeof rw !== 'object') return null;
        const summary = pickCleanString(rw.summary, '');
        if (!summary) return null;
        const rawKind = pickCleanString(
          rw.workKind,
          'other_work'
        ) as GiftedCoordinatorWorkKind;
        const workKind: GiftedCoordinatorWorkKind = validWorkKinds.has(rawKind)
          ? rawKind
          : 'other_work';
        const meetingNumber = pickCleanString(rw.meetingNumber, '');
        const executionDate = pickCleanString(rw.executionDate, '');
        const hijriDate = pickCleanString(rw.hijriDate, '');
        const rawWeek = pickCleanString(rw.weekLabel, '');
        const weekLabel = validWeeksSet.has(rawWeek) ? rawWeek : '';
        const notesAndRecommendations = pickCleanString(
          rw.notesAndRecommendations,
          ''
        );

        return {
          id: pickCleanString(rw.id, `work-${idx + 1}`),
          workKind,
          ...(meetingNumber ? { meetingNumber } : {}),
          executionDate,
          ...(hijriDate ? { hijriDate } : {}),
          weekLabel,
          summary,
          ...(notesAndRecommendations ? { notesAndRecommendations } : {}),
        } as GiftedCoordinatorAdditionalWorkItem;
      })
      .filter(
        (item): item is GiftedCoordinatorAdditionalWorkItem => item !== null
      )
      .slice(0, MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS);

  const rawUnifiedRecords = Array.isArray(candidate.unifiedRecords)
    ? (candidate.unifiedRecords as Array<Record<string, unknown>>)
    : [];

  const validRecordTypes = new Set<GiftedSection2RecordType>(
    GIFTED_SECTION2_RECORD_TYPES
  );
  const validDurationOptions = new Set<GiftedApprovedDurationOption>(
    GIFTED_APPROVED_DURATION_OPTIONS
  );
  const validProgramScopes = new Set<GiftedProgramExecutionScope>(
    GIFTED_PROGRAM_EXECUTION_SCOPES
  );
  const validParticipantRoles = new Set<GiftedParticipantStatusRole>(
    GIFTED_PARTICIPANT_STATUS_ROLES
  );

  const unifiedRecords: GiftedUnifiedSection2Record[] = rawUnifiedRecords
    .map((ru, idx) => {
      if (!ru || typeof ru !== 'object') return null;

      const rawType = pickCleanString(
        ru.recordType,
        'برنامج'
      ) as GiftedSection2RecordType;
      const recordType: GiftedSection2RecordType = validRecordTypes.has(rawType)
        ? rawType
        : 'برنامج';

      const title = pickCleanString(ru.title, '');
      const description = pickCleanString(ru.description, '');
      const gregorianDate = pickCleanString(ru.gregorianDate, '');
      const hijriDate = pickCleanString(ru.hijriDate, '');
      const rawDuration = pickCleanString(
        ru.durationOption,
        ''
      ) as GiftedApprovedDurationOption;
      const durationOption: GiftedApprovedDurationOption | undefined =
        validDurationOptions.has(rawDuration) ? rawDuration : undefined;
      const location = pickCleanString(ru.location, '');
      const academicYear = pickCleanString(ru.academicYear, '');
      const stuOrRecSem = pickCleanString(ru.semester, '');
      const recSemester: ApprovedSchoolSemester =
        stuOrRecSem === 'الفصل الدراسي الثاني' || stuOrRecSem === 'second'
          ? 'الفصل الدراسي الثاني'
          : 'الفصل الدراسي الأول';

      const rawParticipants = Array.isArray(ru.participants)
        ? (ru.participants as Array<Record<string, unknown>>)
        : [];
      const participants: GiftedSection2ParticipantItem[] = rawParticipants
        .map((rp) => {
          if (!rp || typeof rp !== 'object') return null;
          const studentId = pickCleanString(rp.studentId, '');
          if (!studentId) return null;
          const storedHistGrade = pickCleanString(
            rp.studentGradeAtParticipation,
            ''
          );
          const matchedStu = students.find((s) => s.id === studentId);
          const studentGradeAtParticipation =
            storedHistGrade || matchedStu?.grade || '';

          const scoreOrEvaluation = pickCleanString(rp.scoreOrEvaluation, '');
          const rawRole = pickCleanString(
            rp.statusRole,
            ''
          ) as GiftedParticipantStatusRole;
          const statusRole: GiftedParticipantStatusRole | undefined =
            validParticipantRoles.has(rawRole) ? rawRole : undefined;
          const participationType = pickCleanString(rp.participationType, '');
          const achievement = pickCleanString(rp.achievement, '');

          return {
            studentId,
            studentGradeAtParticipation,
            ...(scoreOrEvaluation ? { scoreOrEvaluation } : {}),
            ...(statusRole ? { statusRole } : {}),
            ...(participationType ? { participationType } : {}),
            ...(achievement ? { achievement } : {}),
          } as GiftedSection2ParticipantItem;
        })
        .filter((p): p is GiftedSection2ParticipantItem => p !== null);

      const rawEvidences = Array.isArray(ru.evidences)
        ? (ru.evidences as Array<Record<string, unknown>>)
        : [];
      const evidences: GiftedSection2EvidenceItem[] = rawEvidences
        .map((re, eIdx) => {
          if (!re || typeof re !== 'object') return null;
          const blobKey = pickCleanString(re.blobKey, '');
          if (!blobKey) return null;
          const caption = pickCleanString(re.caption, '');
          return {
            id: pickCleanString(re.id, `ev-${idx + 1}-${eIdx + 1}`),
            blobKey,
            filename: pickCleanString(re.filename, ''),
            mimeType: pickCleanString(re.mimeType, 'application/octet-stream'),
            title: pickCleanString(re.title, ''),
            ...(caption ? { caption } : {}),
            createdAt: pickCleanString(re.createdAt, ''),
          } as GiftedSection2EvidenceItem;
        })
        .filter((e): e is GiftedSection2EvidenceItem => e !== null)
        .slice(0, MAX_GIFTED_SECTION2_EVIDENCES);

      const rawLinks = Array.isArray(ru.links)
        ? (ru.links as Array<Record<string, unknown>>)
        : [];
      const links: GiftedSection2LinkItem[] = rawLinks
        .map((rl, lIdx) => {
          if (!rl || typeof rl !== 'object') return null;
          const url = pickCleanString(rl.url, '');
          if (!url) return null;
          return {
            id: pickCleanString(rl.id, `lnk-${idx + 1}-${lIdx + 1}`),
            title: pickCleanString(rl.title, ''),
            url,
          } as GiftedSection2LinkItem;
        })
        .filter((l): l is GiftedSection2LinkItem => l !== null)
        .slice(0, MAX_GIFTED_SECTION2_LINKS);

      const rawProg =
        ru.programFields && typeof ru.programFields === 'object'
          ? (ru.programFields as Record<string, unknown>)
          : undefined;
      const programFields: GiftedSection2ProgramFields | undefined = rawProg
        ? {
            executionScope: validProgramScopes.has(
              pickCleanString(
                rawProg.executionScope,
                'مدرسة'
              ) as GiftedProgramExecutionScope
            )
              ? (pickCleanString(
                  rawProg.executionScope,
                  'مدرسة'
                ) as GiftedProgramExecutionScope)
              : 'مدرسة',
            programTypeOrField: pickCleanString(rawProg.programTypeOrField, ''),
            objective: pickCleanString(rawProg.objective, ''),
            targetAudience: pickCleanString(rawProg.targetAudience, ''),
            executingEntity: pickCleanString(rawProg.executingEntity, ''),
            results: pickCleanString(rawProg.results, ''),
            notesAndRecommendations: pickCleanString(
              rawProg.notesAndRecommendations,
              ''
            ),
          }
        : undefined;

      const rawRep =
        ru.reportFields && typeof ru.reportFields === 'object'
          ? (ru.reportFields as Record<string, unknown>)
          : undefined;
      const reportFields: GiftedSection2ReportFields | undefined = rawRep
        ? {
            reportObjectives: pickCleanString(rawRep.reportObjectives, ''),
            resultsAndOutputs: pickCleanString(rawRep.resultsAndOutputs, ''),
            achievementIndicators: pickCleanString(
              rawRep.achievementIndicators,
              ''
            ),
            challengesAndDifficulties: pickCleanString(
              rawRep.challengesAndDifficulties,
              ''
            ),
            recommendationsAndProposals: pickCleanString(
              rawRep.recommendationsAndProposals,
              ''
            ),
            notes: pickCleanString(rawRep.notes, ''),
          }
        : undefined;

      const rawInit =
        ru.initiativeFields && typeof ru.initiativeFields === 'object'
          ? (ru.initiativeFields as Record<string, unknown>)
          : undefined;
      const initiativeFields: GiftedSection2InitiativeFields | undefined =
        rawInit
          ? {
              initiativeIdea: pickCleanString(rawInit.initiativeIdea, ''),
              initiativeObjectives: pickCleanString(
                rawInit.initiativeObjectives,
                ''
              ),
              targetAudience: pickCleanString(rawInit.targetAudience, ''),
              executionSteps: pickCleanString(rawInit.executionSteps, ''),
              resultsAndImpact: pickCleanString(rawInit.resultsAndImpact, ''),
              challenges: pickCleanString(rawInit.challenges, ''),
              recommendations: pickCleanString(rawInit.recommendations, ''),
            }
          : undefined;

      const legacySourceId = pickCleanString(ru.legacySourceId, '');

      return {
        id: pickCleanString(ru.id, `uni-${idx + 1}`),
        recordType,
        title,
        description,
        ...(gregorianDate ? { gregorianDate } : {}),
        ...(hijriDate ? { hijriDate } : {}),
        ...(durationOption ? { durationOption } : {}),
        ...(location ? { location } : {}),
        academicYear,
        semester: recSemester,
        participants,
        evidences,
        links,
        ...(programFields ? { programFields } : {}),
        ...(reportFields ? { reportFields } : {}),
        ...(initiativeFields ? { initiativeFields } : {}),
        ...(legacySourceId ? { legacySourceId } : {}),
        createdAt: pickCleanString(ru.createdAt, ''),
        updatedAt: pickCleanString(ru.updatedAt, ''),
      } as GiftedUnifiedSection2Record;
    })
    .filter(
      (item): item is GiftedUnifiedSection2Record =>
        item !== null && item.title.length > 0
    );

  const rawSection3 =
    candidate.section3Data && typeof candidate.section3Data === 'object'
      ? (candidate.section3Data as Record<string, unknown>)
      : {};

  const sanitizeOptionalApprovedSemester = (
    rawSem: unknown
  ): ApprovedSchoolSemester | undefined => {
    const clean = pickCleanString(rawSem, '');
    if (clean === 'الفصل الدراسي الأول' || clean === 'first') {
      return 'الفصل الدراسي الأول';
    }
    if (clean === 'الفصل الدراسي الثاني' || clean === 'second') {
      return 'الفصل الدراسي الثاني';
    }
    return undefined;
  };

  const sanitizePersonParticipantRefs = (
    rawList: unknown
  ): GiftedPersonParticipantRef[] => {
    if (!Array.isArray(rawList)) return [];
    return (rawList as Array<Record<string, unknown>>)
      .map((rp, pIdx) => {
        if (!rp || typeof rp !== 'object') return null;
        const personType: 'student' | 'staff' =
          rp.personType === 'staff' ? 'staff' : 'student';
        const studentId = pickCleanString(rp.studentId, '');
        const name = pickCleanString(rp.name, '');
        const studentGradeSnapshot = pickCleanString(
          rp.studentGradeSnapshot,
          ''
        );
        const roleTitle = pickCleanString(rp.roleTitle, '');

        if (personType === 'student' && !studentId && !name) return null;
        if (personType === 'staff' && !name) return null;

        return {
          id: pickCleanString(rp.id, `person-${pIdx + 1}`),
          personType,
          ...(studentId ? { studentId } : {}),
          name,
          ...(studentGradeSnapshot ? { studentGradeSnapshot } : {}),
          ...(roleTitle ? { roleTitle } : {}),
        } as GiftedPersonParticipantRef;
      })
      .filter((item): item is GiftedPersonParticipantRef => item !== null);
  };

  const rawGiftedStudentsLog = Array.isArray(rawSection3.giftedStudentsLog)
    ? (rawSection3.giftedStudentsLog as Array<Record<string, unknown>>)
    : [];
  const giftedStudentsLog: GiftedStudentsFixedLogRow[] = rawGiftedStudentsLog
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null;
      const studentId = pickCleanString(row.studentId, '');
      if (!studentId) return null;
      const studentGradeSnapshot = pickCleanString(
        row.studentGradeSnapshot,
        ''
      );
      const talentDomain = pickCleanString(row.talentDomain, '');
      const notes = pickCleanString(row.notes, '');
      const academicYear = pickCleanString(row.academicYear, '');
      const rowSemester = sanitizeOptionalApprovedSemester(row.semester);
      const createdAt = pickCleanString(row.createdAt, '');

      return {
        id: pickCleanString(row.id, `gsl-${idx + 1}`),
        studentId,
        ...(studentGradeSnapshot ? { studentGradeSnapshot } : {}),
        talentDomain,
        notes,
        ...(academicYear ? { academicYear } : {}),
        ...(rowSemester ? { semester: rowSemester } : {}),
        createdAt,
      } as GiftedStudentsFixedLogRow;
    })
    .filter((item): item is GiftedStudentsFixedLogRow => item !== null);

  const rawProgramParticipantsLog = Array.isArray(
    rawSection3.programParticipantsLog
  )
    ? (rawSection3.programParticipantsLog as Array<Record<string, unknown>>)
    : [];
  const programParticipantsLog: GiftedProgramParticipantsFixedLogRow[] =
    rawProgramParticipantsLog
      .map((row, idx) => {
        if (!row || typeof row !== 'object') return null;
        const studentId = pickCleanString(row.studentId, '');
        if (!studentId) return null;
        const studentGradeSnapshot = pickCleanString(
          row.studentGradeSnapshot,
          ''
        );
        const programTitle = pickCleanString(row.programTitle, '');
        const linkedRecordId = pickCleanString(row.linkedRecordId, '');
        const participationDate = pickCleanString(row.participationDate, '');
        const participationHijriDate = pickCleanString(
          row.participationHijriDate,
          ''
        );
        const participationType = pickCleanString(row.participationType, '');
        const academicYear = pickCleanString(row.academicYear, '');
        const rowSemester = sanitizeOptionalApprovedSemester(row.semester);
        const createdAt = pickCleanString(row.createdAt, '');

        return {
          id: pickCleanString(row.id, `ppl-${idx + 1}`),
          studentId,
          ...(studentGradeSnapshot ? { studentGradeSnapshot } : {}),
          programTitle,
          ...(linkedRecordId ? { linkedRecordId } : {}),
          participationDate,
          ...(participationHijriDate ? { participationHijriDate } : {}),
          participationType,
          ...(academicYear ? { academicYear } : {}),
          ...(rowSemester ? { semester: rowSemester } : {}),
          createdAt,
        } as GiftedProgramParticipantsFixedLogRow;
      })
      .filter(
        (item): item is GiftedProgramParticipantsFixedLogRow => item !== null
      );

  const rawStudentAchievementsLog = Array.isArray(
    rawSection3.studentAchievementsLog
  )
    ? (rawSection3.studentAchievementsLog as Array<Record<string, unknown>>)
    : [];
  const studentAchievementsLog: GiftedStudentAchievementsFixedLogRow[] =
    rawStudentAchievementsLog
      .map((row, idx) => {
        if (!row || typeof row !== 'object') return null;
        const studentId = pickCleanString(row.studentId, '');
        if (!studentId) return null;
        const studentGradeSnapshot = pickCleanString(
          row.studentGradeSnapshot,
          ''
        );
        const achievement = pickCleanString(row.achievement, '');
        const entityOrCompetition = pickCleanString(
          row.entityOrCompetition,
          ''
        );
        const date = pickCleanString(row.date, '');
        const hijriDate = pickCleanString(row.hijriDate, '');
        const academicYear = pickCleanString(row.academicYear, '');
        const rowSemester = sanitizeOptionalApprovedSemester(row.semester);
        const createdAt = pickCleanString(row.createdAt, '');

        return {
          id: pickCleanString(row.id, `sal-${idx + 1}`),
          studentId,
          ...(studentGradeSnapshot ? { studentGradeSnapshot } : {}),
          achievement,
          entityOrCompetition,
          date,
          ...(hijriDate ? { hijriDate } : {}),
          ...(academicYear ? { academicYear } : {}),
          ...(rowSemester ? { semester: rowSemester } : {}),
          createdAt,
        } as GiftedStudentAchievementsFixedLogRow;
      })
      .filter(
        (item): item is GiftedStudentAchievementsFixedLogRow => item !== null
      );

  const rawMeetingsLog = Array.isArray(rawSection3.meetingsLog)
    ? (rawSection3.meetingsLog as Array<Record<string, unknown>>)
    : [];
  const meetingsLog: GiftedMeetingsFixedLogRow[] = rawMeetingsLog
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null;
      const date = pickCleanString(row.date, '');
      const hijriDate = pickCleanString(row.hijriDate, '');
      const topic = pickCleanString(row.topic, '');
      const attendees = sanitizePersonParticipantRefs(row.attendees);
      const keyRecommendations = pickCleanString(row.keyRecommendations, '');
      const academicYear = pickCleanString(row.academicYear, '');
      const rowSemester = sanitizeOptionalApprovedSemester(row.semester);
      const createdAt = pickCleanString(row.createdAt, '');

      if (!topic && !date && attendees.length === 0 && !keyRecommendations) {
        return null;
      }

      return {
        id: pickCleanString(row.id, `mtg-${idx + 1}`),
        date,
        ...(hijriDate ? { hijriDate } : {}),
        topic,
        attendees,
        keyRecommendations,
        ...(academicYear ? { academicYear } : {}),
        ...(rowSemester ? { semester: rowSemester } : {}),
        createdAt,
      } as GiftedMeetingsFixedLogRow;
    })
    .filter((item): item is GiftedMeetingsFixedLogRow => item !== null);

  const rawVisitsLog = Array.isArray(rawSection3.visitsAndPartnershipsLog)
    ? (rawSection3.visitsAndPartnershipsLog as Array<Record<string, unknown>>)
    : [];
  const visitsAndPartnershipsLog: GiftedVisitsAndPartnershipsFixedLogRow[] =
    rawVisitsLog
      .map((row, idx) => {
        if (!row || typeof row !== 'object') return null;
        const entityOrPlace = pickCleanString(row.entityOrPlace, '');
        const date = pickCleanString(row.date, '');
        const hijriDate = pickCleanString(row.hijriDate, '');
        const purpose = pickCleanString(row.purpose, '');
        const keyResults = pickCleanString(row.keyResults, '');
        const academicYear = pickCleanString(row.academicYear, '');
        const rowSemester = sanitizeOptionalApprovedSemester(row.semester);
        const createdAt = pickCleanString(row.createdAt, '');

        if (!entityOrPlace && !purpose && !date && !keyResults) {
          return null;
        }

        return {
          id: pickCleanString(row.id, `vpl-${idx + 1}`),
          entityOrPlace,
          date,
          ...(hijriDate ? { hijriDate } : {}),
          purpose,
          keyResults,
          ...(academicYear ? { academicYear } : {}),
          ...(rowSemester ? { semester: rowSemester } : {}),
          createdAt,
        } as GiftedVisitsAndPartnershipsFixedLogRow;
      })
      .filter(
        (item): item is GiftedVisitsAndPartnershipsFixedLogRow => item !== null
      );

  const validReadyTemplateKinds = new Set<GiftedReadyTemplateKind>(
    GIFTED_READY_TEMPLATE_KINDS
  );
  const rawReadyTemplates = Array.isArray(rawSection3.readyTemplates)
    ? (rawSection3.readyTemplates as Array<Record<string, unknown>>)
    : [];
  const readyTemplates: GiftedReadyTemplateEntry[] = rawReadyTemplates
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null;
      const rawKind = pickCleanString(
        row.templateKind,
        ''
      ) as GiftedReadyTemplateKind;
      if (!validReadyTemplateKinds.has(rawKind)) return null;

      const title = pickCleanString(row.title, '');
      const date = pickCleanString(row.date, '');
      const hijriDate = pickCleanString(row.hijriDate, '');
      const subjectOrPurpose = pickCleanString(row.subjectOrPurpose, '');
      const bodyContent = pickCleanString(row.bodyContent, '');
      const recommendationsOrNotes = pickCleanString(
        row.recommendationsOrNotes,
        ''
      );
      const recipientOrEntity = pickCleanString(row.recipientOrEntity, '');
      const participants = sanitizePersonParticipantRefs(row.participants);
      const academicYear = pickCleanString(row.academicYear, '');
      const rowSemester = sanitizeOptionalApprovedSemester(row.semester);
      const createdAt = pickCleanString(row.createdAt, '');

      return {
        id: pickCleanString(row.id, `rtpl-${idx + 1}`),
        templateKind: rawKind,
        title,
        date,
        ...(hijriDate ? { hijriDate } : {}),
        subjectOrPurpose,
        bodyContent,
        ...(recommendationsOrNotes ? { recommendationsOrNotes } : {}),
        ...(recipientOrEntity ? { recipientOrEntity } : {}),
        participants,
        ...(academicYear ? { academicYear } : {}),
        ...(rowSemester ? { semester: rowSemester } : {}),
        createdAt,
      } as GiftedReadyTemplateEntry;
    })
    .filter((item): item is GiftedReadyTemplateEntry => item !== null);

  const section3Data: GiftedSection3Data = {
    giftedStudentsLog,
    programParticipantsLog,
    studentAchievementsLog,
    meetingsLog,
    visitsAndPartnershipsLog,
    readyTemplates,
  };

  const activeRestoreGenId = pickCleanString(candidate.activeRestoreGenId, '');
  const activeAttachmentBlobKeys = Array.isArray(
    candidate.activeAttachmentBlobKeys
  )
    ? Array.from(
        new Set(
          (candidate.activeAttachmentBlobKeys as unknown[])
            .map((k) => pickCleanString(k, ''))
            .filter(Boolean)
        )
      )
    : undefined;

  return {
    id: pickCleanString(candidate.id, fallback.id),
    schemaVersion: GIFTED_BACKUP_SCHEMA_VERSION,
    createdAt: pickCleanString(candidate.createdAt, fallback.createdAt),
    updatedAt: pickCleanString(candidate.updatedAt, new Date().toISOString()),
    basicInfo: {
      schoolStage,
      semester,
    },
    executivePlan,
    ministerialPrograms,
    customInitiatives,
    scientificCompetitions,
    programTemplates,
    programExecutions,
    unifiedRecords,
    section3Data,
    coordinatorAdditionalWorks,
    students,
    studentParticipations,
    evidenceBundles: sanitizedEvidenceBundles,
    ...(activeRestoreGenId ? { activeRestoreGenId } : {}),
    ...(activeAttachmentBlobKeys ? { activeAttachmentBlobKeys } : {}),
    evaluation:
      candidate.evaluation && typeof candidate.evaluation === 'object'
        ? {
            strengths: pickCleanString(
              (candidate.evaluation as Record<string, unknown>).strengths,
              ''
            ),
            challenges: pickCleanString(
              (candidate.evaluation as Record<string, unknown>).challenges,
              ''
            ),
            supportingEntities: pickCleanString(
              (candidate.evaluation as Record<string, unknown>)
                .supportingEntities,
              ''
            ),
            improvementProposals: pickCleanString(
              (candidate.evaluation as Record<string, unknown>)
                .improvementProposals,
              ''
            ),
          }
        : fallback.evaluation,
    programReportsOverrides: sanitizedProgramReportsOverrides,
    innovationProgressReportOverrides: sanitizedInnovationOverrides,
  };
}

// ============================================================================
// ١٠-ب. القسم السادس: محرك الإجراءات الموحد (Unified Execution Action Engine)
// ============================================================================

export interface GiftedUnifiedExecutionActionRow {
  programId: string;
  programCode: GiftedMinisterialProgramCode;
  programTitle: string;
  programShortTitle: string;
  sourcePageNumber: number;
  applicableToSchool: boolean;
  actionId: string;
  order: number;
  actionText: string;
  executionDate: string;
  weekLabel: string;
  status: GiftedExecutionStatus;
  nonExecutionReason: string;
}

export interface GiftedExecutionActionsFilter {
  programId?: string | 'all';
  status?: GiftedExecutionStatus | 'all';
  onlyApplicableToSchool?: boolean;
  searchQuery?: string;
}

export function getUnifiedExecutionActionsCatalog(
  record: GiftedCoordinatorRecord,
  filter?: GiftedExecutionActionsFilter
): GiftedUnifiedExecutionActionRow[] {
  const rows: GiftedUnifiedExecutionActionRow[] = [];
  const query = (filter?.searchQuery || '').trim();

  for (const prog of record.ministerialPrograms) {
    if (filter?.onlyApplicableToSchool && !prog.applicableToSchool) {
      continue;
    }
    if (filter?.programId && filter.programId !== 'all' && prog.id !== filter.programId) {
      continue;
    }
    const standardCount = GIFTED_STANDARD_PROGRAM_ACTIONS[prog.code].length;
    const standardActions = prog.actions
      .filter((a) => a.isStandard !== false)
      .slice(0, standardCount);
    for (const act of standardActions) {
      if (filter?.status && filter.status !== 'all' && act.status !== filter.status) {
        continue;
      }
      if (
        query &&
        !act.actionText.includes(query) &&
        !prog.title.includes(query) &&
        !(act.nonExecutionReason || '').includes(query)
      ) {
        continue;
      }
      rows.push({
        programId: prog.id,
        programCode: prog.code,
        programTitle: prog.title,
        programShortTitle: prog.shortTitle,
        sourcePageNumber: prog.sourcePageNumber,
        applicableToSchool: prog.applicableToSchool,
        actionId: act.id,
        order: act.order,
        actionText: act.actionText,
        executionDate: act.executionDate || '',
        weekLabel: act.weekLabel || '',
        status: act.status,
        nonExecutionReason: act.nonExecutionReason || '',
      });
    }
  }

  return rows;
}

export interface ProgramActionUpdatePatch {
  status?: GiftedExecutionStatus;
  executionDate?: string;
  weekLabel?: string;
  nonExecutionReason?: string;
}

export function updateProgramActionInRecord(
  record: GiftedCoordinatorRecord,
  programId: string,
  actionId: string,
  patch: ProgramActionUpdatePatch
): GiftedCoordinatorRecord {
  const nextPrograms = record.ministerialPrograms.map((prog) => {
    if (prog.id !== programId) return prog;
    return {
      ...prog,
      actions: prog.actions.map((act) => {
        if (act.id !== actionId) return act;
        const nextStatus = patch.status ?? act.status;
        const nextReason =
          nextStatus === 'not_executed'
            ? patch.nonExecutionReason ?? act.nonExecutionReason
            : patch.nonExecutionReason !== undefined
              ? patch.nonExecutionReason
              : '';
        return {
          ...act,
          status: nextStatus,
          executionDate: patch.executionDate ?? act.executionDate,
          weekLabel: patch.weekLabel ?? act.weekLabel,
          nonExecutionReason: nextReason,
        };
      }),
    };
  });

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    ministerialPrograms: nextPrograms,
  };
}

// ============================================================================
// ١٠-ج. السجل المركزي للطلاب (قسم الطلاب + القسم السابع):
// إدارة الطلاب، منع التكرار والتشابه، الحذف الآمن، والمشاركات والإنجازات
// ============================================================================

export const GIFTED_APPROVED_GRADES_BY_STAGE: Record<
  GiftedSchoolStage,
  string[]
> = {
  elementary: [
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي',
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
  ],
  middle: [
    'الأول المتوسط',
    'الثاني المتوسط',
    'الثالث المتوسط',
  ],
  high: [
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
  ],
  combined: [
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي',
    'الأول المتوسط',
    'الثاني المتوسط',
    'الثالث المتوسط',
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
  ],
};

export const GIFTED_ALL_APPROVED_GRADES: string[] =
  GIFTED_APPROVED_GRADES_BY_STAGE.combined;

export function normalizeGiftedGradeLabel(rawGrade?: string): string {
  const clean = (rawGrade || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (clean === 'الصف الأول المتوسط') return 'الأول المتوسط';
  if (clean === 'الصف الثاني المتوسط') return 'الثاني المتوسط';
  if (clean === 'الصف الثالث المتوسط') return 'الثالث المتوسط';
  return clean;
}

export function getApprovedGradesForStage(
  stage?: GiftedSchoolStage
): string[] {
  if (!stage || !GIFTED_APPROVED_GRADES_BY_STAGE[stage]) {
    return GIFTED_ALL_APPROVED_GRADES;
  }
  return GIFTED_APPROVED_GRADES_BY_STAGE[stage];
}

export const GIFTED_APPROVED_TALENT_DOMAINS: string[] = [
  'موهبة علمية وإبداعية',
  'العلوم والبحث العلمي',
  'الرياضيات والمعلوماتية',
  'الهندسة والابتكار التقني',
  'الذكاء الاصطناعي والبرمجة',
  'الفيزياء والعلوم التطبيقية',
  'الكيمياء والعلوم الحيوية',
  'المهارات القيادية واللغوية',
];

export const GIFTED_APPROVED_LEVELS: string[] = [
  'المستوى الأول',
  'المستوى الثاني',
  'المستوى الثالث',
];

export function normalizeArabicStudentName(rawName: string): string {
  return (rawName || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function getMeaningfulNameTokens(rawName: string): string[] {
  const normalized = normalizeArabicStudentName(rawName);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== 'بن' && t !== 'بنت');
}

export interface GiftedStudentDuplicateCheckResult {
  status: 'clear' | 'duplicate_blocked' | 'similar_warning';
  reason?: string;
  matchedStudent?: GiftedStudentRecord;
}

export function checkGiftedStudentDuplicateOrSimilarity(
  record: GiftedCoordinatorRecord,
  input: {
    id?: string;
    name: string;
    civilId?: string;
    grade?: string;
  }
): GiftedStudentDuplicateCheckResult {
  const editingId = (input.id || '').trim();
  const cleanCivilId = (input.civilId || '').trim();
  const normalizedInputName = normalizeArabicStudentName(input.name);
  const inputTokens = getMeaningfulNameTokens(input.name);

  if (!normalizedInputName) {
    return { status: 'clear' };
  }

  // ١. فحص التطابق التام في رقم الهوية أو الاسم الكامل المطبّع (منع الإضافة المكررة)
  for (const existing of record.students) {
    if (editingId && existing.id === editingId) continue;

    if (
      cleanCivilId &&
      existing.civilId &&
      existing.civilId.trim() === cleanCivilId
    ) {
      return {
        status: 'duplicate_blocked',
        matchedStudent: existing,
        reason: `لا يمكن تكرار الإضافة: رقم الهوية (${cleanCivilId}) مسجل مسبقاً للطالب «${existing.name}» (${existing.grade}).`,
      };
    }

    const existingNormalizedName = normalizeArabicStudentName(existing.name);
    const existingTokens = getMeaningfulNameTokens(existing.name);

    if (
      existingNormalizedName === normalizedInputName ||
      (inputTokens.length >= 2 &&
        existingTokens.length === inputTokens.length &&
        inputTokens.join(' ') === existingTokens.join(' '))
    ) {
      return {
        status: 'duplicate_blocked',
        matchedStudent: existing,
        reason: `هذا الطالب مسجل مسبقاً في السجل المركزي باسم «${existing.name}» (${existing.grade}). يمكنك تعديل بياناته بدلاً من إضافته مرة أخرى.`,
      };
    }
  }

  // ٢. فحص التشابه القوي في الاسم لتنبيه المنسق قبل الحفظ
  if (inputTokens.length >= 2) {
    for (const existing of record.students) {
      if (editingId && existing.id === editingId) continue;
      const existingTokens = getMeaningfulNameTokens(existing.name);
      if (existingTokens.length < 2) continue;

      const sameFirstAndSecond =
        inputTokens[0] === existingTokens[0] &&
        inputTokens[1] === existingTokens[1];

      const sameFirstAndLast =
        inputTokens.length >= 3 &&
        existingTokens.length >= 3 &&
        inputTokens[0] === existingTokens[0] &&
        inputTokens[inputTokens.length - 1] ===
          existingTokens[existingTokens.length - 1];

      if (sameFirstAndSecond || sameFirstAndLast) {
        return {
          status: 'similar_warning',
          matchedStudent: existing,
          reason: `تنبيه تشابه: يوجد طالب مسجل باسم مشابه «${existing.name}» في (${existing.grade}). يرجى التأكد من عدم تكرار تسجيل الطالب نفسه.`,
        };
      }
    }
  }

  return { status: 'clear' };
}

export interface GiftedStudentInput {
  id?: string;
  name: string;
  grade: string;
  level?: string;
  civilId?: string;
  talentDomain: string;
  score?: string;
  classification: GiftedClassificationLevel;
  notes?: string;
}

export function addOrUpdateGiftedStudentInRecord(
  record: GiftedCoordinatorRecord,
  input: GiftedStudentInput
): { record: GiftedCoordinatorRecord; student: GiftedStudentRecord } {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('اسم الطالب/ـة مطلوب في سجل الموهوبين.');
  }
  const cleanCivilId = (input.civilId || '').trim();
  const existingStudent = input.id?.trim()
    ? record.students.find((s) => s.id === input.id?.trim())
    : undefined;
  const studentId =
    existingStudent?.id ||
    input.id?.trim() ||
    `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const resolvedLevel =
    input.level !== undefined
      ? input.level.trim() || 'المستوى الأول'
      : existingStudent?.level || 'المستوى الأول';
  const resolvedScore =
    input.score !== undefined
      ? input.score.trim()
      : existingStudent?.score || '';
  const resolvedNotes =
    input.notes !== undefined
      ? input.notes.trim()
      : existingStudent?.notes || '';

  const studentObj: GiftedStudentRecord = {
    id: studentId,
    name: cleanName,
    grade: normalizeGiftedGradeLabel(
      input.grade.trim() ||
        existingStudent?.grade ||
        getApprovedGradesForStage(record.basicInfo.schoolStage)[0] ||
        'الصف الأول الثانوي'
    ),
    level: resolvedLevel,
    ...(cleanCivilId ? { civilId: cleanCivilId } : {}),
    talentDomain:
      input.talentDomain.trim() ||
      existingStudent?.talentDomain ||
      'موهبة علمية وإبداعية',
    score: resolvedScore,
    classification: input.classification,
    notes: resolvedNotes,
  };

  const exists = record.students.some((s) => s.id === studentId);
  const nextStudents = exists
    ? record.students.map((s) => (s.id === studentId ? studentObj : s))
    : [...record.students, studentObj];

  return {
    record: {
      ...record,
      updatedAt: new Date().toISOString(),
      students: nextStudents,
    },
    student: studentObj,
  };
}

export interface GiftedStudentDeletionSafetyCheck {
  studentId: string;
  studentName: string;
  canDelete: boolean;
  linkedParticipationsCount: number;
  linkedProgramCategories: string[];
  reason?: string;
}

export function checkGiftedStudentDeletionSafety(
  record: GiftedCoordinatorRecord,
  studentId: string
): GiftedStudentDeletionSafetyCheck {
  const targetStudent = record.students.find((s) => s.id === studentId);
  const studentName = targetStudent?.name || 'الطالب المحدد';
  const linkedParticipations = record.studentParticipations.filter(
    (p) => p.studentId === studentId
  );

  if (linkedParticipations.length > 0) {
    const linkedLabels = Array.from(
      new Set(
        linkedParticipations.map((p) => {
          const baseLabel =
            GIFTED_PARTICIPATION_CATEGORY_LABELS[p.category] || p.category;
          const extra =
            p.competitionTitle?.trim() || p.projectTitle?.trim() || '';
          return extra ? `${baseLabel} (${extra})` : baseLabel;
        })
      )
    );

    return {
      studentId,
      studentName,
      canDelete: false,
      linkedParticipationsCount: linkedParticipations.length,
      linkedProgramCategories: linkedLabels,
      reason: `لا يمكن حذف الطالب «${studentName}» لوجود (${linkedParticipations.length}) مشاركة/ارتباط مسجل له في: ${linkedLabels.join('، ')}. لحماية بيانات البرامج والتقارير من الفقدان، يُمنع حذف الطالب المرتبط ببرامج؛ يمكنك تعديل بياناته مباشرة أو إزالة مشاركاته من سجل المشاركات أولاً.`,
    };
  }

  return {
    studentId,
    studentName,
    canDelete: true,
    linkedParticipationsCount: 0,
    linkedProgramCategories: [],
  };
}

export function safeDeleteGiftedStudentFromRecord(
  record: GiftedCoordinatorRecord,
  studentId: string
): {
  deleted: boolean;
  record: GiftedCoordinatorRecord;
  check: GiftedStudentDeletionSafetyCheck;
} {
  const check = checkGiftedStudentDeletionSafety(record, studentId);
  if (!check.canDelete) {
    return {
      deleted: false,
      record,
      check,
    };
  }

  return {
    deleted: true,
    record: {
      ...record,
      updatedAt: new Date().toISOString(),
      students: record.students.filter((s) => s.id !== studentId),
    },
    check,
  };
}

export function filterAndSearchGiftedStudents(
  students: GiftedStudentRecord[],
  options?: {
    searchQuery?: string;
    gradeFilter?: string;
    classificationFilter?: GiftedClassificationLevel | 'all';
  }
): GiftedStudentRecord[] {
  const rawQuery = (options?.searchQuery || '').trim();
  const normalizedQuery = normalizeArabicStudentName(rawQuery);
  const gradeFilter = (options?.gradeFilter || 'all').trim();
  const classificationFilter = options?.classificationFilter || 'all';

  const normalizedFilter =
    gradeFilter && gradeFilter !== 'all'
      ? normalizeGiftedGradeLabel(gradeFilter)
      : 'all';

  return students.filter((stu) => {
    if (
      normalizedFilter !== 'all' &&
      normalizeGiftedGradeLabel(stu.grade) !== normalizedFilter
    ) {
      return false;
    }

    if (
      classificationFilter !== 'all' &&
      stu.classification !== classificationFilter
    ) {
      return false;
    }

    if (rawQuery) {
      const normalizedStudentName = normalizeArabicStudentName(stu.name);
      const matchesName =
        stu.name.includes(rawQuery) ||
        normalizedStudentName.includes(normalizedQuery);
      const matchesCivilId = (stu.civilId || '').includes(rawQuery);
      const matchesGrade = stu.grade.includes(rawQuery);
      const matchesDomain = stu.talentDomain.includes(rawQuery);
      if (!matchesName && !matchesCivilId && !matchesGrade && !matchesDomain) {
        return false;
      }
    }

    return true;
  });
}

export function deleteGiftedStudentFromRecord(
  record: GiftedCoordinatorRecord,
  studentId: string
): GiftedCoordinatorRecord {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    students: record.students.filter((s) => s.id !== studentId),
    studentParticipations: record.studentParticipations.filter(
      (p) => p.studentId !== studentId
    ),
  };
}

export interface GiftedStudentParticipationInput {
  id?: string;
  studentId: string;
  category: GiftedParticipationCategory;
  linkedProgramOrCompetitionId?: string;
  executionId?: string;
  studentGradeAtParticipation?: string;
  studentLevelAtParticipation?: string;
  studentClassificationAtParticipation?: GiftedClassificationLevel;
  participationDate?: string;
  participationHijriDate?: string;
  nominationType?: GiftedNominationType;
  score?: string;
  classificationResult?: string;
  projectTitle?: string;
  projectField?: string;
  scientificTrack?: string;
  enrichmentUnit?: string;
  approvalStatus?: GiftedApprovalStatus;
  competitionTitle?: string;
  qualifiedToNextStage?: boolean;
  achievementText?: string;
  notes?: string;
}

export function addOrUpdateGiftedStudentParticipationInRecord(
  record: GiftedCoordinatorRecord,
  input: GiftedStudentParticipationInput
): GiftedCoordinatorRecord {
  const matchedStudent = record.students.find((s) => s.id === input.studentId);
  if (!matchedStudent) {
    throw new Error('يجب اختيار طالب/ـة مسجل في قاعدة بيانات الموهوبين.');
  }

  const partId =
    input.id?.trim() ||
    `part-${input.category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const existingPart = record.studentParticipations.find(
    (p) => p.id === partId
  );

  const studentGradeAtParticipation = normalizeGiftedGradeLabel(
    input.studentGradeAtParticipation?.trim() ||
      existingPart?.studentGradeAtParticipation ||
      matchedStudent.grade
  );
  const studentLevelAtParticipation =
    input.studentLevelAtParticipation?.trim() ||
    existingPart?.studentLevelAtParticipation ||
    matchedStudent.level;
  const studentClassificationAtParticipation: GiftedClassificationLevel =
    input.studentClassificationAtParticipation ||
    existingPart?.studentClassificationAtParticipation ||
    matchedStudent.classification;
  const participationDate =
    input.participationDate !== undefined
      ? input.participationDate.trim()
      : existingPart?.participationDate || '';
  const participationHijriDate =
    input.participationHijriDate !== undefined
      ? input.participationHijriDate.trim()
      : participationDate
        ? formatGregorianToHijriDate(participationDate)
        : existingPart?.participationHijriDate || '';

  const cleanPart: GiftedStudentParticipationRecord = {
    id: partId,
    studentId: input.studentId,
    category: input.category,
    ...(input.linkedProgramOrCompetitionId?.trim()
      ? { linkedProgramOrCompetitionId: input.linkedProgramOrCompetitionId.trim() }
      : existingPart?.linkedProgramOrCompetitionId
        ? { linkedProgramOrCompetitionId: existingPart.linkedProgramOrCompetitionId }
        : {}),
    ...(input.executionId?.trim()
      ? { executionId: input.executionId.trim() }
      : existingPart?.executionId
        ? { executionId: existingPart.executionId }
        : {}),
    studentGradeAtParticipation,
    studentLevelAtParticipation,
    studentClassificationAtParticipation,
    ...(participationDate ? { participationDate } : {}),
    ...(participationHijriDate ? { participationHijriDate } : {}),
    ...(input.nominationType ? { nominationType: input.nominationType } : {}),
    ...(input.score?.trim() ? { score: input.score.trim() } : {}),
    ...(input.classificationResult?.trim()
      ? { classificationResult: input.classificationResult.trim() }
      : {}),
    ...(input.projectTitle?.trim()
      ? { projectTitle: input.projectTitle.trim() }
      : {}),
    ...(input.projectField?.trim()
      ? { projectField: input.projectField.trim() }
      : {}),
    ...(input.scientificTrack?.trim()
      ? { scientificTrack: input.scientificTrack.trim() }
      : {}),
    ...(input.enrichmentUnit?.trim()
      ? { enrichmentUnit: input.enrichmentUnit.trim() }
      : {}),
    ...(input.approvalStatus ? { approvalStatus: input.approvalStatus } : {}),
    ...(input.competitionTitle?.trim()
      ? { competitionTitle: input.competitionTitle.trim() }
      : {}),
    qualifiedToNextStage: Boolean(input.qualifiedToNextStage),
    achievementText: (input.achievementText || '').trim(),
    notes: (input.notes || '').trim(),
  };

  const exists = record.studentParticipations.some((p) => p.id === partId);
  const nextParticipations = exists
    ? record.studentParticipations.map((p) => (p.id === partId ? cleanPart : p))
    : [...record.studentParticipations, cleanPart];

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    studentParticipations: nextParticipations,
  };
}

export function deleteGiftedStudentParticipationFromRecord(
  record: GiftedCoordinatorRecord,
  participationId: string
): GiftedCoordinatorRecord {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    studentParticipations: record.studentParticipations.filter(
      (p) => p.id !== participationId
    ),
  };
}

export function resolveStudentParticipationsWithStudentInfo(
  record: GiftedCoordinatorRecord,
  options?: {
    category?: GiftedParticipationCategory | 'all';
    onlyQualified?: boolean;
    studentId?: string;
    linkedProgramOrCompetitionId?: string;
  }
): GiftedResolvedStudentParticipation[] {
  const studentMap = new Map<string, GiftedStudentRecord>(
    record.students.map((s) => [s.id, s])
  );

  const resolved: GiftedResolvedStudentParticipation[] = [];
  for (const part of record.studentParticipations) {
    if (
      options?.category &&
      options.category !== 'all' &&
      part.category !== options.category
    ) {
      continue;
    }
    if (options?.onlyQualified && !part.qualifiedToNextStage) {
      continue;
    }
    if (options?.studentId && part.studentId !== options.studentId) {
      continue;
    }
    if (
      options?.linkedProgramOrCompetitionId &&
      part.linkedProgramOrCompetitionId !== options.linkedProgramOrCompetitionId
    ) {
      continue;
    }
    const stu = studentMap.get(part.studentId);
    if (!stu) continue;

    const normalizedCurrentGrade = normalizeGiftedGradeLabel(stu.grade);
    const historicalGrade = normalizeGiftedGradeLabel(
      part.studentGradeAtParticipation || normalizedCurrentGrade
    );
    const historicalClassification =
      part.studentClassificationAtParticipation || stu.classification;

    resolved.push({
      ...part,
      studentGradeAtParticipation: historicalGrade,
      studentClassificationAtParticipation: historicalClassification,
      studentName: stu.name,
      studentGrade: normalizedCurrentGrade,
      studentLevel: stu.level,
      ...(stu.civilId ? { studentCivilId: stu.civilId } : {}),
      studentClassification: stu.classification,
      studentTalentDomain: stu.talentDomain,
      historicalGrade,
      historicalClassification,
    });
  }

  return resolved;
}

export interface GiftedStudentsAndAchievementsSummary {
  totalStudents: number;
  exceptionalGiftedCount: number;
  giftedCount: number;
  promisingCount: number;
  totalParticipations: number;
  qualifiedStudentsCount: number;
  documentedAchievementsCount: number;
  byCategoryCount: Record<GiftedParticipationCategory, number>;
  qualifiedResearchOlympiadCount: number;
  qualifiedScientificOlympiadCount: number;
}

export function computeGiftedStudentsAndAchievementsSummary(
  record: GiftedCoordinatorRecord
): GiftedStudentsAndAchievementsSummary {
  let exceptionalGiftedCount = 0;
  let giftedCount = 0;
  let promisingCount = 0;

  for (const stu of record.students) {
    if (stu.classification === 'exceptional_gifted') exceptionalGiftedCount += 1;
    else if (stu.classification === 'promising') promisingCount += 1;
    else giftedCount += 1;
  }

  const byCategoryCount: Record<GiftedParticipationCategory, number> = {
    national_identification: 0,
    olympiad_research: 0,
    olympiad_scientific: 0,
    innovation_space: 0,
    acceleration: 0,
    scientific_competition: 0,
  };

  const validStudentIds = new Set(record.students.map((s) => s.id));
  const validParticipations = record.studentParticipations.filter((part) =>
    validStudentIds.has(part.studentId)
  );

  let qualifiedStudentsCount = 0;
  let documentedAchievementsCount = 0;
  let qualifiedResearchOlympiadCount = 0;
  let qualifiedScientificOlympiadCount = 0;

  for (const part of validParticipations) {
    byCategoryCount[part.category] = (byCategoryCount[part.category] || 0) + 1;
    if (part.qualifiedToNextStage) {
      qualifiedStudentsCount += 1;
      if (part.category === 'olympiad_research') {
        qualifiedResearchOlympiadCount += 1;
      } else if (part.category === 'olympiad_scientific') {
        qualifiedScientificOlympiadCount += 1;
      }
    }
    if (part.achievementText && part.achievementText.trim().length > 0) {
      documentedAchievementsCount += 1;
    }
  }

  return {
    totalStudents: record.students.length,
    exceptionalGiftedCount,
    giftedCount,
    promisingCount,
    totalParticipations: validParticipations.length,
    qualifiedStudentsCount,
    documentedAchievementsCount,
    byCategoryCount,
    qualifiedResearchOlympiadCount,
    qualifiedScientificOlympiadCount,
  };
}

// ============================================================================
// ١٠-د. مكتبة البرامج وقوالبها (قسم البرامج المستقل):
// إدارة قوالب البرامج، البحث والتصفية، التفعيل والإيقاف، وضمان عدم الأثر الرجعي
// ============================================================================

export function getGiftedProgramTemplatesFromRecord(
  record: GiftedCoordinatorRecord
): GiftedProgramTemplateRecord[] {
  if (
    Array.isArray(record.programTemplates) &&
    record.programTemplates.length > 0
  ) {
    return record.programTemplates;
  }
  return createDefaultProgramTemplates(
    record.ministerialPrograms,
    record.scientificCompetitions,
    record.customInitiatives
  );
}

export interface GiftedProgramTemplateInput {
  id?: string;
  title: string;
  category: GiftedProgramTemplateCategory;
  shortDescription?: string;
  objectives?: string;
  targetAudience?: string;
  stageLabel?: string;
  requirementsAndActions: string[];
  coordinatorInstructions?: string;
  isActive?: boolean;
}

export function addOrUpdateGiftedProgramTemplateInRecord(
  record: GiftedCoordinatorRecord,
  input: GiftedProgramTemplateInput
): {
  record: GiftedCoordinatorRecord;
  template: GiftedProgramTemplateRecord;
} {
  const cleanTitle = (input.title || '').trim();
  if (!cleanTitle) {
    throw new Error('اسم البرنامج مطلوب لحفظ قالب البرنامج.');
  }

  const currentTemplates = getGiftedProgramTemplatesFromRecord(record);
  const existingTemplate = input.id?.trim()
    ? currentTemplates.find((t) => t.id === input.id?.trim())
    : undefined;

  const templateId =
    existingTemplate?.id ||
    input.id?.trim() ||
    `tpl-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const cleanedActions = (input.requirementsAndActions || [])
    .map((act) => (typeof act === 'string' ? act.trim() : ''))
    .filter((act) => act.length > 0);

  const resolvedActions =
    cleanedActions.length > 0
      ? cleanedActions
      : existingTemplate?.requirementsAndActions?.length
        ? existingTemplate.requirementsAndActions
        : ['إعداد خطة تنفيذ البرنامج وتوثيق الشواهد والمخرجات'];

  const nowIso = new Date().toISOString();

  const updatedTemplate: GiftedProgramTemplateRecord = {
    id: templateId,
    title: cleanTitle,
    category:
      input.category ||
      existingTemplate?.category ||
      'enrichment_initiative',
    shortDescription:
      input.shortDescription !== undefined
        ? input.shortDescription.trim()
        : existingTemplate?.shortDescription || '',
    objectives:
      input.objectives !== undefined
        ? input.objectives.trim()
        : existingTemplate?.objectives || '',
    targetAudience:
      input.targetAudience !== undefined
        ? input.targetAudience.trim() || 'الطلبة الموهوبون'
        : existingTemplate?.targetAudience || 'الطلبة الموهوبون',
    stageLabel:
      input.stageLabel !== undefined
        ? input.stageLabel.trim() || 'جميع المراحل'
        : existingTemplate?.stageLabel || 'جميع المراحل',
    requirementsAndActions: resolvedActions,
    coordinatorInstructions:
      input.coordinatorInstructions !== undefined
        ? input.coordinatorInstructions.trim()
        : existingTemplate?.coordinatorInstructions || '',
    isActive:
      typeof input.isActive === 'boolean'
        ? input.isActive
        : existingTemplate
          ? existingTemplate.isActive
          : true,
    isOfficialReference: Boolean(existingTemplate?.isOfficialReference),
    ...(existingTemplate?.sourcePageNumber !== undefined
      ? { sourcePageNumber: existingTemplate.sourcePageNumber }
      : {}),
    ...(existingTemplate?.linkedProgramId
      ? { linkedProgramId: existingTemplate.linkedProgramId }
      : {}),
    ...(existingTemplate?.linkedMinisterialCode
      ? { linkedMinisterialCode: existingTemplate.linkedMinisterialCode }
      : {}),
    updatedAt: nowIso,
  };

  const exists = currentTemplates.some((t) => t.id === templateId);
  const nextTemplates = exists
    ? currentTemplates.map((t) => (t.id === templateId ? updatedTemplate : t))
    : [...currentTemplates, updatedTemplate];

  // ملاحظة مهمة: تعديل القالب يحدّث تعريف القالب المستقبلي فقط ولا يغير بأثر رجعي
  // بيانات التنفيذات القديمة المحفوظة في programExecutions أو سجلات الإجراءات السابقة
  return {
    record: {
      ...record,
      updatedAt: nowIso,
      programTemplates: nextTemplates,
      programExecutions: record.programExecutions || [],
    },
    template: updatedTemplate,
  };
}

export function toggleGiftedProgramTemplateActiveInRecord(
  record: GiftedCoordinatorRecord,
  templateId: string,
  forceActive?: boolean
): {
  record: GiftedCoordinatorRecord;
  template?: GiftedProgramTemplateRecord;
} {
  const currentTemplates = getGiftedProgramTemplatesFromRecord(record);
  const target = currentTemplates.find((t) => t.id === templateId);
  if (!target) {
    return { record, template: undefined };
  }

  const nowIso = new Date().toISOString();
  const nextIsActive =
    typeof forceActive === 'boolean' ? forceActive : !target.isActive;

  const updatedTemplate: GiftedProgramTemplateRecord = {
    ...target,
    isActive: nextIsActive,
    updatedAt: nowIso,
  };

  const nextTemplates = currentTemplates.map((t) =>
    t.id === templateId ? updatedTemplate : t
  );

  // إيقاف أو تفعيل القالب لا يحذف أي سجل تنفيذ سابق أو شواهد أو مشاركات طلاب
  return {
    record: {
      ...record,
      updatedAt: nowIso,
      programTemplates: nextTemplates,
      programExecutions: record.programExecutions || [],
    },
    template: updatedTemplate,
  };
}

export function filterAndSearchGiftedProgramTemplates(
  templates: GiftedProgramTemplateRecord[],
  options?: {
    searchQuery?: string;
    categoryFilter?: GiftedProgramTemplateCategory | 'all';
    statusFilter?: 'all' | 'active' | 'inactive';
  }
): GiftedProgramTemplateRecord[] {
  const rawQuery = (options?.searchQuery || '').trim();
  const normalizedQuery = normalizeArabicStudentName(rawQuery);
  const categoryFilter = options?.categoryFilter || 'all';
  const statusFilter = options?.statusFilter || 'all';

  return templates.filter((tpl) => {
    if (categoryFilter !== 'all' && tpl.category !== categoryFilter) {
      return false;
    }

    if (statusFilter === 'active' && !tpl.isActive) {
      return false;
    }
    if (statusFilter === 'inactive' && tpl.isActive) {
      return false;
    }

    if (rawQuery) {
      const normalizedTitle = normalizeArabicStudentName(tpl.title);
      const normalizedDesc = normalizeArabicStudentName(tpl.shortDescription);
      const normalizedObj = normalizeArabicStudentName(tpl.objectives);
      const normalizedAud = normalizeArabicStudentName(tpl.targetAudience);
      const matchesTitle =
        tpl.title.includes(rawQuery) ||
        normalizedTitle.includes(normalizedQuery);
      const matchesDesc =
        tpl.shortDescription.includes(rawQuery) ||
        normalizedDesc.includes(normalizedQuery);
      const matchesObj =
        tpl.objectives.includes(rawQuery) ||
        normalizedObj.includes(normalizedQuery);
      const matchesAud =
        tpl.targetAudience.includes(rawQuery) ||
        normalizedAud.includes(normalizedQuery);
      const matchesActions = tpl.requirementsAndActions.some(
        (act) =>
          act.includes(rawQuery) ||
          normalizeArabicStudentName(act).includes(normalizedQuery)
      );

      if (
        !matchesTitle &&
        !matchesDesc &&
        !matchesObj &&
        !matchesAud &&
        !matchesActions
      ) {
        return false;
      }
    }

    return true;
  });
}

export interface CreateProgramExecutionFromTemplateInput {
  id?: string;
  templateId: string;
  executionStartDate: string;
  executionEndDate?: string;
  selectedWeeks?: string[];
  participatingStudentIds?: string[];
  linkedParticipationIds?: string[];
  evidenceBundleTargetId?: string;
  notes?: string;
}

/**
 * إنشاء سجل تنفيذ فعلي مرتبط بقالب برنامج عبر معرّفه الثابت (templateId)
 * يحفظ نسخة مجمدة (Snapshot) من اسم القالب وأهدافه وإجراءاته وقت التنفيذ،
 * بحيث لا يغير تعديل القالب مستقبلاً بيانات التنفيذات القديمة بأثر رجعي.
 */
export function createProgramExecutionFromTemplate(
  record: GiftedCoordinatorRecord,
  input: CreateProgramExecutionFromTemplateInput
): {
  record: GiftedCoordinatorRecord;
  execution: GiftedProgramExecutionSnapshotRecord;
} {
  const templates = getGiftedProgramTemplatesFromRecord(record);
  const template = templates.find((t) => t.id === input.templateId);
  if (!template) {
    throw new Error('لم يتم العثور على قالب البرنامج المحدد في مكتبة البرامج.');
  }

  const validWeeksSet = new Set<string>(GIFTED_ACADEMIC_WEEKS_LIST);
  const cleanWeeks = Array.from(
    new Set(
      (input.selectedWeeks || [])
        .map((w) => w.trim())
        .filter((w) => validWeeksSet.has(w))
    )
  );

  const nowIso = new Date().toISOString();
  const execId =
    input.id?.trim() ||
    `exec-${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const execution: GiftedProgramExecutionSnapshotRecord = {
    id: execId,
    templateId: template.id,
    templateTitleSnapshot: template.title,
    templateCategorySnapshot: template.category,
    objectivesSnapshot: template.objectives,
    targetAudienceSnapshot: template.targetAudience,
    stageLabelSnapshot: template.stageLabel,
    actionsSnapshot: template.requirementsAndActions.map((text, idx) => ({
      id: `${execId}-act-${idx + 1}`,
      order: idx + 1,
      actionText: text,
      completed: false,
    })),
    executionStartDate: (input.executionStartDate || '').trim(),
    ...(input.executionEndDate?.trim()
      ? { executionEndDate: input.executionEndDate.trim() }
      : {}),
    selectedWeeks: cleanWeeks,
    participatingStudentIds: (input.participatingStudentIds || []).slice(),
    linkedParticipationIds: (input.linkedParticipationIds || []).slice(),
    ...(input.evidenceBundleTargetId?.trim()
      ? { evidenceBundleTargetId: input.evidenceBundleTargetId.trim() }
      : {}),
    notes: (input.notes || '').trim(),
    createdAt: nowIso,
  };

  const existingExecutions = record.programExecutions || [];
  return {
    record: {
      ...record,
      updatedAt: nowIso,
      programTemplates: templates,
      programExecutions: [...existingExecutions, execution],
    },
    execution,
  };
}

// ============================================================================
// ١٠-هـ. المرحلة الأولى لإعادة الهيكلة إلى ٤ محركات رئيسية:
// - تحويل التاريخ الميلادي إلى هجري تلقائياً
// - كتالوج المحركات الأربعة المراعي للجنس (الطلاب/الطالبات، أعمال المنسق/المنسقة)
// - الترحيل الآمن غير المكرر (Idempotent) مع النسخة الاحتياطية المسبقة والتدقيق
// - إدارة تنفيذ البرامج (ربط القوالب بالتنفيذ والطلاب والشواهد)
// - سجل الأعمال الإضافية المختصر للمنسق (بحد أقصى 6 أسطر)
// ============================================================================

export const GIFTED_PRE_V4_BACKUP_STORAGE_KEY =
  'maktabi_gifted_coordinator_record_pre_v4_backup';

export type GiftedMainEngineId =
  | 'students'
  | 'programs'
  | 'coordinator_works'
  | 'reports';

export interface GiftedMainEngineDefinition {
  id: GiftedMainEngineId;
  engineNumber: 1 | 2 | 3 | 4;
  code: '01' | '02' | '03' | '04';
  title: string;
  subtitle: string;
  badgeBgHex: string;
  badgeTextHex: string;
}

export function getGiftedFourEnginesCatalog(
  gender: 'male' | 'female' = 'male'
): GiftedMainEngineDefinition[] {
  const isFemale = gender === 'female';
  return [
    {
      id: 'students',
      engineNumber: 1,
      code: '01',
      title: isFemale ? 'الطالبات' : 'الطلاب',
      subtitle: isFemale
        ? 'السجل المركزي وملفات الطالبات وتأهلاتهن'
        : 'السجل المركزي وملفات الطلاب وتأهلاتهم',
      badgeBgHex: '#7F1D3F',
      badgeTextHex: '#FFFFFF',
    },
    {
      id: 'programs',
      engineNumber: 2,
      code: '02',
      title: 'البرامج',
      subtitle: 'تنفيذ البرامج والمسابقات والشواهد ومكتبة القوالب',
      badgeBgHex: '#1E40AF',
      badgeTextHex: '#FFFFFF',
    },
    {
      id: 'coordinator_works',
      engineNumber: 3,
      code: '03',
      title: isFemale ? 'أعمال المنسقة' : 'أعمال المنسق',
      subtitle: 'بيانات الفصل الدراسي وسجل الأعمال المختصر',
      badgeBgHex: '#0F766E',
      badgeTextHex: '#FFFFFF',
    },
    {
      id: 'reports',
      engineNumber: 4,
      code: '04',
      title: 'التقارير',
      subtitle: 'مؤشرات الإنجاز وإصدار التقارير الرسمية (PDF)',
      badgeBgHex: '#26323B',
      badgeTextHex: '#FFFFFF',
    },
  ];
}

export function getGiftedGenderedTerms(gender: 'male' | 'female' = 'male') {
  const isFemale = gender === 'female';
  return {
    studentsTitle: isFemale ? 'الطالبات' : 'الطلاب',
    studentSingular: isFemale ? 'الطالبة' : 'الطالب',
    giftedStudentsLabel: isFemale ? 'الطالبات الموهوبات' : 'الطلاب الموهوبين',
    participatingStudentsLabel: isFemale
      ? 'الطالبات المشاركات'
      : 'الطلاب المشاركون',
    coordinatorWorksTitle: isFemale ? 'أعمال المنسقة' : 'أعمال المنسق',
    coordinatorSingular: isFemale ? 'منسقة الموهوبات' : 'منسق الموهوبين',
    addStudentBtnLabel: isFemale ? 'إضافة طالبة' : 'إضافة طالب',
    studentProfileLabel: isFemale ? 'ملف الطالبة ومشاركاتها' : 'ملف الطالب ومشاركاته',
  };
}

/**
 * تحويل التاريخ الميلادي المختار من منتقي التقويم (YYYY-MM-DD) إلى تاريخ هجري (أم القرى) تلقائياً
 */
export function formatGregorianToHijriDate(isoDate: string): string {
  const clean = (isoDate || '').trim();
  if (!clean) return '';
  // إذا لم يكن بصيغة YYYY-MM-DD نعيده كما هو إن كان نصاً هجرياً قديماً
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!match) {
    return clean.includes('هـ') ? clean : '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  try {
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (Number.isNaN(utcDate.getTime())) return '';

    const formatter = new Intl.DateTimeFormat(
      'ar-SA-u-ca-islamic-umalqura',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }
    );
    const formatted = formatter.format(utcDate).trim();
    return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
  } catch {
    return '';
  }
}

export interface GiftedMigrationAuditReport {
  passed: boolean;
  preBackupCreated: boolean;
  dryRunVerified: boolean;
  countsBefore: {
    students: number;
    ministerialPrograms: number;
    scientificCompetitions: number;
    customInitiatives: number;
    participations: number;
    evidencePhotos: number;
    evidenceLinks: number;
  };
  countsAfter: {
    students: number;
    ministerialPrograms: number;
    scientificCompetitions: number;
    customInitiatives: number;
    programTemplates: number;
    programExecutions: number;
    participations: number;
    evidencePhotos: number;
    evidenceLinks: number;
  };
  discrepancies: string[];
}

function countRecordEvidences(record: GiftedCoordinatorRecord): {
  photos: number;
  links: number;
} {
  let photos = 0;
  let links = 0;
  for (const bundle of Object.values(record.evidenceBundles || {})) {
    photos += (bundle.photos || []).length;
    links += (bundle.links || []).length;
  }
  return { photos, links };
}

export function verifyGiftedMigrationAudit(
  beforeRecord: GiftedCoordinatorRecord,
  afterRecord: GiftedCoordinatorRecord,
  preBackupCreated = true
): GiftedMigrationAuditReport {
  const evBefore = countRecordEvidences(beforeRecord);
  const evAfter = countRecordEvidences(afterRecord);

  const countsBefore = {
    students: beforeRecord.students.length,
    ministerialPrograms: beforeRecord.ministerialPrograms.length,
    scientificCompetitions: beforeRecord.scientificCompetitions.length,
    customInitiatives: beforeRecord.customInitiatives.length,
    participations: beforeRecord.studentParticipations.length,
    evidencePhotos: evBefore.photos,
    evidenceLinks: evBefore.links,
  };

  const countsAfter = {
    students: afterRecord.students.length,
    ministerialPrograms: afterRecord.ministerialPrograms.length,
    scientificCompetitions: afterRecord.scientificCompetitions.length,
    customInitiatives: afterRecord.customInitiatives.length,
    programTemplates: (afterRecord.programTemplates || []).length,
    programExecutions: (afterRecord.programExecutions || []).length,
    participations: afterRecord.studentParticipations.length,
    evidencePhotos: evAfter.photos,
    evidenceLinks: evAfter.links,
  };

  const discrepancies: string[] = [];
  if (countsBefore.students !== countsAfter.students) {
    discrepancies.push('اختلاف في عدد الطلاب بين قبل الترحيل وبعده.');
  }
  if (countsBefore.ministerialPrograms !== countsAfter.ministerialPrograms) {
    discrepancies.push('اختلاف في عدد البرامج الوزارية.');
  }
  if (
    countsBefore.scientificCompetitions !== countsAfter.scientificCompetitions
  ) {
    discrepancies.push('اختلاف في عدد المسابقات العلمية.');
  }
  if (countsBefore.customInitiatives !== countsAfter.customInitiatives) {
    discrepancies.push('اختلاف في عدد المبادرات.');
  }
  if (countsBefore.participations !== countsAfter.participations) {
    discrepancies.push('اختلاف في عدد مشاركات الطلاب.');
  }
  if (countsBefore.evidencePhotos !== countsAfter.evidencePhotos) {
    discrepancies.push('اختلاف في عدد الشواهد المصورة.');
  }
  if (countsBefore.evidenceLinks !== countsAfter.evidenceLinks) {
    discrepancies.push('اختلاف في عدد الروابط الإلكترونية.');
  }

  // التحقق من عدم وجود معرفات تنفيذ مكررة
  const execIds = (afterRecord.programExecutions || []).map((e) => e.id);
  if (new Set(execIds).size !== execIds.length) {
    discrepancies.push('تم رصد تكرار في معرفات سجلات تنفيذ البرامج.');
  }

  return {
    passed: discrepancies.length === 0,
    preBackupCreated,
    dryRunVerified: true,
    countsBefore,
    countsAfter,
    discrepancies,
  };
}

function parseLegacyWeeksToApprovedList(rawWeekLabel?: string): string[] {
  if (!rawWeekLabel) return [];
  const validSet = new Set<string>(GIFTED_ACADEMIC_WEEKS_LIST);
  const parts = rawWeekLabel
    .split(/،|,|\||-/)
    .map((p) => p.trim())
    .filter((p) => validSet.has(p));
  return Array.from(new Set(parts));
}

function performInMemoryV4Migration(
  sourceRecord: GiftedCoordinatorRecord
): GiftedCoordinatorRecord {
  const clone: GiftedCoordinatorRecord = JSON.parse(
    JSON.stringify(sourceRecord)
  );
  const templates = getGiftedProgramTemplatesFromRecord(clone);
  const existingExecutions = Array.isArray(clone.programExecutions)
    ? clone.programExecutions.slice()
    : [];

  const studentMap = new Map<string, GiftedStudentRecord>(
    clone.students.map((s) => [s.id, s])
  );

  // ١. تثبيت اللقطة التاريخية لجميع مشاركات الطلاب السابقة دون المساس ببياناتهم الحالية
  const migratedParticipations = clone.studentParticipations.map((part) => {
    const stu = studentMap.get(part.studentId);
    return {
      ...part,
      studentGradeAtParticipation:
        part.studentGradeAtParticipation || stu?.grade || '',
      studentLevelAtParticipation:
        part.studentLevelAtParticipation || stu?.level || '',
      studentClassificationAtParticipation:
        part.studentClassificationAtParticipation ||
        stu?.classification ||
        'gifted',
    };
  });

  // ٢. ترحيل البرامج الوزارية والمسابقات والمبادرات إلى سجلات تنفيذ مرتبطة بالقوالب بشكل حتمي غير مكرر
  const findExistingExecution = (templateId: string, legacySourceId: string) =>
    existingExecutions.find(
      (ex) =>
        ex.id === `exec-mig-${legacySourceId}` ||
        ex.legacySourceId === legacySourceId ||
        ex.templateId === templateId
    );

  // أ) البرامج الوزارية السبعة
  for (const prog of clone.ministerialPrograms) {
    const tpl =
      templates.find(
        (t) =>
          t.linkedProgramId === prog.id ||
          t.linkedMinisterialCode === prog.code ||
          t.id === `tpl-${prog.id}`
      ) || templates[0];
    if (!tpl) continue;

    const alreadyExists = findExistingExecution(tpl.id, prog.id);
    if (alreadyExists) continue;

    // اشتقاق حالة البرنامج من الخطة التنفيذية أو من إجراءاته القياسية
    const planItem = clone.executivePlan.find(
      (p) => p.linkedProgramId === prog.id
    );
    const executedActionsCount = prog.actions.filter(
      (a) => a.status === 'executed'
    ).length;
    const notExecutedActions = prog.actions.filter(
      (a) => a.status === 'not_executed'
    );

    const derivedStatus: GiftedExecutionStatus = planItem
      ? planItem.status
      : executedActionsCount > 0 && executedActionsCount === prog.actions.length
        ? 'executed'
        : notExecutedActions.length > 0 && executedActionsCount === 0
          ? 'not_executed'
          : 'pending';

    const derivedReason =
      planItem?.nonExecutionReason ||
      notExecutedActions.find((a) => a.nonExecutionReason)?.nonExecutionReason ||
      '';

    const firstActionWithDate = prog.actions.find(
      (a) => a.executionDate && /^\d{4}-\d{2}-\d{2}$/.test(a.executionDate)
    );
    const executionStartDate = firstActionWithDate?.executionDate || '';
    const executionHijriDate = executionStartDate
      ? formatGregorianToHijriDate(executionStartDate)
      : '';

    const weeksFromProg = parseLegacyWeeksToApprovedList(
      prog.weekLabel || planItem?.weekLabel
    );
    const weeksFromActions = prog.actions.flatMap((a) =>
      parseLegacyWeeksToApprovedList(a.weekLabel)
    );
    const selectedWeeks = Array.from(
      new Set([...weeksFromProg, ...weeksFromActions])
    );

    // ربط الطلاب المشاركين في هذه الفئة إن وجدوا
    const matchingCategoryMap: Partial<
      Record<GiftedMinisterialProgramCode, GiftedParticipationCategory>
    > = {
      national_identification: 'national_identification',
      olympiad_research: 'olympiad_research',
      olympiad_scientific: 'olympiad_scientific',
      innovation_space: 'innovation_space',
      acceleration: 'acceleration',
    };
    const partCat = matchingCategoryMap[prog.code];
    const linkedParts = migratedParticipations.filter(
      (p) =>
        p.linkedProgramOrCompetitionId === prog.id ||
        (partCat && p.category === partCat)
    );
    const participatingStudentIds = Array.from(
      new Set(linkedParts.map((p) => p.studentId))
    );
    const linkedParticipationIds = linkedParts.map((p) => p.id);

    const ov = clone.programReportsOverrides?.[prog.id];

    existingExecutions.push({
      id: `exec-mig-${prog.id}`,
      templateId: tpl.id,
      legacySourceId: prog.id,
      templateTitleSnapshot: tpl.title,
      templateCategorySnapshot: tpl.category,
      objectivesSnapshot: tpl.objectives,
      targetAudienceSnapshot: tpl.targetAudience,
      stageLabelSnapshot: tpl.stageLabel,
      status: derivedStatus,
      ...(derivedReason ? { nonExecutionReason: derivedReason } : {}),
      actionsSnapshot: prog.actions.map((act, idx) => ({
        id: act.id || `exec-mig-${prog.id}-act-${idx + 1}`,
        order: act.order || idx + 1,
        actionText: act.actionText,
        completed: act.status === 'executed',
        ...(act.executionDate ? { executionDate: act.executionDate } : {}),
        ...(parseLegacyWeeksToApprovedList(act.weekLabel).length > 0
          ? { selectedWeeks: parseLegacyWeeksToApprovedList(act.weekLabel) }
          : {}),
      })),
      executionStartDate,
      ...(executionHijriDate ? { executionHijriDate } : {}),
      selectedWeeks,
      participatingStudentIds,
      linkedParticipationIds,
      evidenceBundleTargetId: prog.id,
      ...(ov?.executionMechanismOverride
        ? { resultsSummary: ov.executionMechanismOverride }
        : {}),
      ...(ov?.suggestionsOverride
        ? { recommendations: ov.suggestionsOverride }
        : {}),
      ...(ov?.difficultiesOverride
        ? { challenges: ov.difficultiesOverride }
        : {}),
      ...(ov?.beneficiariesCountOverride
        ? { beneficiariesCountOverride: ov.beneficiariesCountOverride }
        : {}),
      notes: prog.notes || '',
      createdAt: clone.createdAt,
    });
  }

  // ب) المسابقات العلمية
  for (const comp of clone.scientificCompetitions) {
    const tpl = templates.find(
      (t) => t.linkedProgramId === comp.id || t.id === `tpl-${comp.id}`
    );
    if (!tpl) continue;
    const alreadyExists = findExistingExecution(tpl.id, comp.id);
    if (alreadyExists) continue;

    const linkedParts = migratedParticipations.filter(
      (p) =>
        p.linkedProgramOrCompetitionId === comp.id ||
        (p.category === 'scientific_competition' &&
          p.competitionTitle &&
          comp.title.includes(p.competitionTitle))
    );
    const participatingStudentIds = Array.from(
      new Set(linkedParts.map((p) => p.studentId))
    );
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(comp.startDate || '');

    existingExecutions.push({
      id: `exec-mig-${comp.id}`,
      templateId: tpl.id,
      legacySourceId: comp.id,
      templateTitleSnapshot: tpl.title,
      templateCategorySnapshot: tpl.category,
      objectivesSnapshot: tpl.objectives,
      targetAudienceSnapshot: tpl.targetAudience,
      stageLabelSnapshot: tpl.stageLabel,
      status: comp.status,
      ...(comp.nonExecutionReason
        ? { nonExecutionReason: comp.nonExecutionReason }
        : {}),
      actionsSnapshot: tpl.requirementsAndActions.map((text, idx) => ({
        id: `exec-mig-${comp.id}-act-${idx + 1}`,
        order: idx + 1,
        actionText: text,
        completed: comp.status === 'executed',
      })),
      executionStartDate: isIsoDate ? comp.startDate : '',
      ...(isIsoDate
        ? { executionHijriDate: formatGregorianToHijriDate(comp.startDate) }
        : {}),
      selectedWeeks: parseLegacyWeeksToApprovedList(comp.weekLabel),
      participatingStudentIds,
      linkedParticipationIds: linkedParts.map((p) => p.id),
      evidenceBundleTargetId: comp.id,
      notes: comp.notes || '',
      createdAt: clone.createdAt,
    });
  }

  // ج) المبادرات الإضافية
  for (const init of clone.customInitiatives) {
    const tpl = templates.find(
      (t) => t.linkedProgramId === init.id || t.id === `tpl-${init.id}`
    );
    if (!tpl) continue;
    const alreadyExists = findExistingExecution(tpl.id, init.id);
    if (alreadyExists) continue;

    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(init.executionDate || '');

    existingExecutions.push({
      id: `exec-mig-${init.id}`,
      templateId: tpl.id,
      legacySourceId: init.id,
      templateTitleSnapshot: tpl.title,
      templateCategorySnapshot: tpl.category,
      objectivesSnapshot: tpl.objectives,
      targetAudienceSnapshot: tpl.targetAudience,
      stageLabelSnapshot: tpl.stageLabel,
      status: init.status,
      ...(init.nonExecutionReason
        ? { nonExecutionReason: init.nonExecutionReason }
        : {}),
      actionsSnapshot: tpl.requirementsAndActions.map((text, idx) => ({
        id: `exec-mig-${init.id}-act-${idx + 1}`,
        order: idx + 1,
        actionText: text,
        completed: init.status === 'executed',
      })),
      executionStartDate: isIsoDate ? init.executionDate : '',
      ...(isIsoDate
        ? { executionHijriDate: formatGregorianToHijriDate(init.executionDate) }
        : {}),
      selectedWeeks: parseLegacyWeeksToApprovedList(init.weekLabel),
      participatingStudentIds: [],
      linkedParticipationIds: [],
      evidenceBundleTargetId: init.id,
      ...(init.achievementIndicator
        ? { resultsSummary: init.achievementIndicator }
        : {}),
      notes: init.notes || '',
      createdAt: clone.createdAt,
    });
  }

  return {
    ...clone,
    programTemplates: templates,
    programExecutions: existingExecutions,
    studentParticipations: migratedParticipations,
    coordinatorAdditionalWorks: clone.coordinatorAdditionalWorks || [],
  };
}

/**
 * تنفيذ الترحيل الآمن على خطوات:
 * 1. حفظ نسخة احتياطية كاملة قبل الترحيل في مفتاح مستقل
 * 2. تنفيذ الترحيل على نسخة اختبارية في الذاكرة (Dry-Run)
 * 3. مطابقة الأعداد والتحقق من عدم التكرار
 * 4. اعتماد النتيجة فقط عند نجاح الفحص بنسبة 100%
 */
export function runSafeGiftedV4Migration(
  record: GiftedCoordinatorRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): {
  record: GiftedCoordinatorRecord;
  audit: GiftedMigrationAuditReport;
} {
  let preBackupCreated = false;
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (store) {
      const existingPreBackup = store.getItem(GIFTED_PRE_V4_BACKUP_STORAGE_KEY);
      if (!existingPreBackup) {
        store.setItem(
          GIFTED_PRE_V4_BACKUP_STORAGE_KEY,
          JSON.stringify(record)
        );
      }
      preBackupCreated = true;
    }
  } catch {
    preBackupCreated = false;
  }

  // تنفيذ الترحيل أولاً على نسخة اختبارية في الذاكرة
  const dryRunCandidate = performInMemoryV4Migration(record);
  const audit = verifyGiftedMigrationAudit(
    record,
    dryRunCandidate,
    preBackupCreated
  );

  if (!audit.passed) {
    // في حال رصد أي عدم تطابق نحتفظ بالسجل الأصلي دون تغيير
    return {
      record,
      audit,
    };
  }

  return {
    record: dryRunCandidate,
    audit,
  };
}

export function getOrCreateExecutionForProgramTemplate(
  record: GiftedCoordinatorRecord,
  templateId: string
): GiftedProgramExecutionSnapshotRecord {
  const templates = getGiftedProgramTemplatesFromRecord(record);
  const tpl = templates.find((t) => t.id === templateId) || templates[0];
  const executions = record.programExecutions || [];

  const existing = executions.find(
    (ex) =>
      ex.templateId === templateId ||
      (tpl?.linkedProgramId && ex.legacySourceId === tpl.linkedProgramId)
  );
  if (existing) {
    return existing;
  }

  const sourceId = tpl?.linkedProgramId || templateId;
  return {
    id: `exec-mig-${sourceId}`,
    templateId: tpl?.id || templateId,
    ...(tpl?.linkedProgramId ? { legacySourceId: tpl.linkedProgramId } : {}),
    templateTitleSnapshot: tpl?.title || 'برنامج',
    templateCategorySnapshot: tpl?.category || 'ministerial',
    objectivesSnapshot: tpl?.objectives || '',
    targetAudienceSnapshot: tpl?.targetAudience || 'الطلبة الموهوبون',
    stageLabelSnapshot: tpl?.stageLabel || 'جميع المراحل',
    status: 'pending',
    actionsSnapshot: (tpl?.requirementsAndActions || []).map((text, idx) => ({
      id: `exec-${sourceId}-act-${idx + 1}`,
      order: idx + 1,
      actionText: text,
      completed: false,
    })),
    executionStartDate: '',
    selectedWeeks: [],
    participatingStudentIds: [],
    linkedParticipationIds: [],
    evidenceBundleTargetId: tpl?.linkedProgramId || templateId,
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

export interface UpsertProgramExecutionPatch {
  templateId: string;
  status?: GiftedExecutionStatus;
  nonExecutionReason?: string;
  executionStartDate?: string;
  selectedWeeks?: string[];
  participatingStudentIds?: string[];
  actionsSnapshot?: GiftedProgramExecutionSnapshotRecord['actionsSnapshot'];
  resultsSummary?: string;
  recommendations?: string;
  challenges?: string;
  beneficiariesCountOverride?: string;
  notes?: string;
}

/**
 * تحديث تنفيذ البرنامج مع مزامنة تلقائية مع السجلات المرجعية المرتبطة (دون تكرار إدخال)
 * بحيث يحدد المنسق حالة البرنامج مباشرة وتبقى نسبة استيفاء الإجراءات مؤشراً مستقلاً
 */
export function upsertProgramExecutionInRecord(
  record: GiftedCoordinatorRecord,
  patch: UpsertProgramExecutionPatch
): {
  record: GiftedCoordinatorRecord;
  execution: GiftedProgramExecutionSnapshotRecord;
} {
  const currentExec = getOrCreateExecutionForProgramTemplate(
    record,
    patch.templateId
  );

  const validWeeksSet = new Set<string>(GIFTED_ACADEMIC_WEEKS_LIST);
  const nextWeeks =
    patch.selectedWeeks !== undefined
      ? Array.from(
          new Set(
            patch.selectedWeeks
              .map((w) => w.trim())
              .filter((w) => validWeeksSet.has(w))
          )
        )
      : currentExec.selectedWeeks;

  const nextStartDate =
    patch.executionStartDate !== undefined
      ? patch.executionStartDate.trim()
      : currentExec.executionStartDate;
  const nextHijriDate = nextStartDate
    ? formatGregorianToHijriDate(nextStartDate)
    : '';

  const nextStatus = patch.status ?? currentExec.status ?? 'pending';
  const nextReason =
    nextStatus === 'not_executed'
      ? (patch.nonExecutionReason ?? currentExec.nonExecutionReason ?? '').trim()
      : '';

  const nextStudentIds =
    patch.participatingStudentIds !== undefined
      ? Array.from(new Set(patch.participatingStudentIds.filter(Boolean)))
      : currentExec.participatingStudentIds;

  const nextActions = patch.actionsSnapshot ?? currentExec.actionsSnapshot;

  const updatedExec: GiftedProgramExecutionSnapshotRecord = {
    ...currentExec,
    status: nextStatus,
    ...(nextReason ? { nonExecutionReason: nextReason } : { nonExecutionReason: '' }),
    executionStartDate: nextStartDate,
    ...(nextHijriDate
      ? { executionHijriDate: nextHijriDate }
      : { executionHijriDate: '' }),
    selectedWeeks: nextWeeks,
    participatingStudentIds: nextStudentIds,
    actionsSnapshot: nextActions,
    resultsSummary:
      patch.resultsSummary !== undefined
        ? patch.resultsSummary.trim()
        : currentExec.resultsSummary || '',
    recommendations:
      patch.recommendations !== undefined
        ? patch.recommendations.trim()
        : currentExec.recommendations || '',
    challenges:
      patch.challenges !== undefined
        ? patch.challenges.trim()
        : currentExec.challenges || '',
    beneficiariesCountOverride:
      patch.beneficiariesCountOverride !== undefined
        ? patch.beneficiariesCountOverride.trim()
        : currentExec.beneficiariesCountOverride || '',
    notes:
      patch.notes !== undefined
        ? patch.notes.trim()
        : currentExec.notes || '',
  };

  const existingExecs = record.programExecutions || [];
  const existsInList = existingExecs.some((e) => e.id === updatedExec.id);
  const nextExecutions = existsInList
    ? existingExecs.map((e) => (e.id === updatedExec.id ? updatedExec : e))
    : [...existingExecs, updatedExec];

  const sourceId =
    updatedExec.legacySourceId || updatedExec.evidenceBundleTargetId || '';
  const joinedWeeks = nextWeeks.join('، ');

  // مزامنة تلقائية مع البرامج الوزارية والمسابقات والمبادرات والخطة التنفيذية لضمان دقة التقارير والمؤشرات
  const nextMinisterial = record.ministerialPrograms.map((prog) => {
    if (prog.id !== sourceId) return prog;
    return {
      ...prog,
      weekLabel: joinedWeeks || prog.weekLabel,
      notes: updatedExec.notes || prog.notes,
      actions: prog.actions.map((act, idx) => {
        const snapAct =
          nextActions.find((sa) => sa.id === act.id) || nextActions[idx];
        if (!snapAct) return act;
        return {
          ...act,
          status: snapAct.completed
            ? ('executed' as GiftedExecutionStatus)
            : nextStatus === 'not_executed'
              ? ('not_executed' as GiftedExecutionStatus)
              : ('pending' as GiftedExecutionStatus),
          executionDate: nextStartDate || act.executionDate,
          weekLabel: joinedWeeks || act.weekLabel,
          nonExecutionReason:
            nextStatus === 'not_executed' ? nextReason : act.nonExecutionReason,
        };
      }),
    };
  });

  const nextCompetitions = record.scientificCompetitions.map((comp) => {
    if (comp.id !== sourceId) return comp;
    return {
      ...comp,
      status: nextStatus,
      nonExecutionReason: nextReason,
      startDate: nextStartDate || comp.startDate,
      weekLabel: joinedWeeks || comp.weekLabel,
      notes: updatedExec.notes || comp.notes,
    };
  });

  const nextInitiatives = record.customInitiatives.map((init) => {
    if (init.id !== sourceId) return init;
    return {
      ...init,
      status: nextStatus,
      nonExecutionReason: nextReason,
      executionDate: nextStartDate || init.executionDate,
      weekLabel: joinedWeeks || init.weekLabel,
      achievementIndicator:
        updatedExec.resultsSummary || init.achievementIndicator,
      notes: updatedExec.notes || init.notes,
    };
  });

  const nextExecutivePlan = record.executivePlan.map((planItem) => {
    if (planItem.linkedProgramId !== sourceId) return planItem;
    return {
      ...planItem,
      status: nextStatus,
      nonExecutionReason: nextReason,
      executionDate: nextStartDate || planItem.executionDate,
      weekLabel: joinedWeeks || planItem.weekLabel,
      notes: updatedExec.notes || planItem.notes,
    };
  });

  const nextReportOverrides = {
    ...(record.programReportsOverrides || {}),
  };
  if (sourceId) {
    nextReportOverrides[sourceId] = {
      ...(nextReportOverrides[sourceId] || { targetId: sourceId }),
      targetId: sourceId,
      ...(nextStartDate ? { executionDateOverride: nextHijriDate || nextStartDate } : {}),
      ...(updatedExec.resultsSummary
        ? { executionMechanismOverride: updatedExec.resultsSummary }
        : {}),
      ...(updatedExec.recommendations
        ? { suggestionsOverride: updatedExec.recommendations }
        : {}),
      ...(updatedExec.challenges
        ? { difficultiesOverride: updatedExec.challenges }
        : {}),
      ...(updatedExec.beneficiariesCountOverride
        ? { beneficiariesCountOverride: updatedExec.beneficiariesCountOverride }
        : {}),
    };
  }

  return {
    record: {
      ...record,
      updatedAt: new Date().toISOString(),
      programExecutions: nextExecutions,
      ministerialPrograms: nextMinisterial,
      scientificCompetitions: nextCompetitions,
      customInitiatives: nextInitiatives,
      executivePlan: nextExecutivePlan,
      programReportsOverrides: nextReportOverrides,
    },
    execution: updatedExec,
  };
}

export interface CoordinatorAdditionalWorkInput {
  id?: string;
  workKind: GiftedCoordinatorWorkKind;
  meetingNumber?: string;
  executionDate?: string;
  weekLabel?: string;
  summary: string;
  notesAndRecommendations?: string;
}

export function addOrUpdateCoordinatorAdditionalWorkInRecord(
  record: GiftedCoordinatorRecord,
  input: CoordinatorAdditionalWorkInput
): GiftedCoordinatorRecord {
  const cleanSummary = (input.summary || '').trim();
  if (!cleanSummary) {
    throw new Error('يرجى كتابة ملخص مختصر للعمل الإضافي.');
  }

  const currentWorks = record.coordinatorAdditionalWorks || [];
  const existingIdx = input.id
    ? currentWorks.findIndex((w) => w.id === input.id)
    : -1;

  if (
    existingIdx === -1 &&
    currentWorks.length >= MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS
  ) {
    throw new Error(
      `الحد الأقصى لسجل الأعمال الإضافية المختصر هو (${MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS}) أسطر فقط.`
    );
  }

  const validWeeksSet = new Set<string>(GIFTED_ACADEMIC_WEEKS_LIST);
  const cleanDate = (input.executionDate || '').trim();
  const hijriDate = cleanDate ? formatGregorianToHijriDate(cleanDate) : '';
  const cleanWeek =
    input.weekLabel && validWeeksSet.has(input.weekLabel.trim())
      ? input.weekLabel.trim()
      : '';
  const cleanNotes = (input.notesAndRecommendations || '').trim();

  const workItem: GiftedCoordinatorAdditionalWorkItem = {
    id:
      input.id?.trim() ||
      `work-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workKind: input.workKind,
    ...(input.workKind === 'committee_meeting' && input.meetingNumber?.trim()
      ? { meetingNumber: input.meetingNumber.trim() }
      : {}),
    executionDate: cleanDate,
    ...(hijriDate ? { hijriDate } : {}),
    weekLabel: cleanWeek,
    summary: cleanSummary,
    ...(cleanNotes ? { notesAndRecommendations: cleanNotes } : {}),
  };

  const nextWorks =
    existingIdx >= 0
      ? currentWorks.map((w, idx) => (idx === existingIdx ? workItem : w))
      : [...currentWorks, workItem];

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    coordinatorAdditionalWorks: nextWorks.slice(
      0,
      MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS
    ),
  };
}

export function deleteCoordinatorAdditionalWorkFromRecord(
  record: GiftedCoordinatorRecord,
  workId: string
): GiftedCoordinatorRecord {
  const nextEvidenceBundles: Record<string, GiftedProgramEvidenceBundle> = {
    ...record.evidenceBundles,
  };
  const removedBundle = nextEvidenceBundles[workId];
  delete nextEvidenceBundles[workId];

  let nextActiveKeys = record.activeAttachmentBlobKeys;
  if (removedBundle && Array.isArray(nextActiveKeys)) {
    const removedBlobKeys = new Set(
      (removedBundle.photos || []).map((p) => p.blobKey).filter(Boolean)
    );
    if (removedBlobKeys.size > 0) {
      const stillUsedKeys = new Set<string>();
      for (const b of Object.values(nextEvidenceBundles)) {
        for (const p of b.photos || []) {
          if (p.blobKey) stillUsedKeys.add(p.blobKey);
        }
      }
      nextActiveKeys = nextActiveKeys.filter(
        (k) => !removedBlobKeys.has(k) || stillUsedKeys.has(k)
      );
    }
  }

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    ...(Array.isArray(nextActiveKeys)
      ? { activeAttachmentBlobKeys: nextActiveKeys }
      : {}),
    evidenceBundles: nextEvidenceBundles,
    coordinatorAdditionalWorks: (record.coordinatorAdditionalWorks || []).filter(
      (w) => w.id !== workId
    ),
  };
}

export function loadGiftedRecordFromStorage(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
  settings?: SchoolSettings
): GiftedCoordinatorRecord {
  const resolveEffectiveSettings = (): SchoolSettings =>
    settings ?? loadSettingsFromStorage();
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) {
      const fresh = createInitialGiftedCoordinatorRecord(
        'combined',
        undefined,
        resolveEffectiveSettings()
      );
      return runSafeGiftedV4Migration(fresh).record;
    }
    const raw = store.getItem(GIFTED_RECORD_STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialGiftedCoordinatorRecord(
        'combined',
        undefined,
        resolveEffectiveSettings()
      );
      return runSafeGiftedV4Migration(fresh, store).record;
    }
    const sanitized = sanitizeGiftedCoordinatorRecord(JSON.parse(raw));
    const migrated = runSafeGiftedV4Migration(sanitized, store);
    return migrated.record;
  } catch {
    const fresh = createInitialGiftedCoordinatorRecord(
      'combined',
      undefined,
      resolveEffectiveSettings()
    );
    return runSafeGiftedV4Migration(fresh).record;
  }
}

export function saveGiftedRecordToStorage(
  record: GiftedCoordinatorRecord,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;
    const sanitized = sanitizeGiftedCoordinatorRecord({
      ...record,
      updatedAt: new Date().toISOString(),
    });
    store.setItem(GIFTED_RECORD_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// ١١. طبقة تخزين المرفقات والشواهد الكبيرة في IndexedDB (مع عزل تام لقسم الموهوبين)
// ============================================================================

export interface GiftedAttachmentRecord {
  blobKey: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt: string;
}

export interface GiftedAttachmentRepository {
  putAttachment(attachment: GiftedAttachmentRecord): Promise<void>;
  getAttachment(blobKey: string): Promise<GiftedAttachmentRecord | null>;
  listAttachments(): Promise<GiftedAttachmentRecord[]>;
  deleteAttachment(blobKey: string): Promise<void>;
  clearAll(): Promise<void>;
}

const fallbackMemoryAttachments = new Map<string, GiftedAttachmentRecord>();

export function createMemoryAttachmentRepository(
  initialMap?: Map<string, GiftedAttachmentRecord>
): GiftedAttachmentRepository {
  const store = initialMap ?? new Map<string, GiftedAttachmentRecord>();
  return {
    async putAttachment(attachment: GiftedAttachmentRecord): Promise<void> {
      store.set(attachment.blobKey, {
        ...attachment,
        bytes: new Uint8Array(attachment.bytes),
      });
    },
    async getAttachment(blobKey: string): Promise<GiftedAttachmentRecord | null> {
      const found = store.get(blobKey);
      if (!found) return null;
      return {
        ...found,
        bytes: new Uint8Array(found.bytes),
      };
    },
    async listAttachments(): Promise<GiftedAttachmentRecord[]> {
      return Array.from(store.values()).map((item) => ({
        ...item,
        bytes: new Uint8Array(item.bytes),
      }));
    },
    async deleteAttachment(blobKey: string): Promise<void> {
      store.delete(blobKey);
    },
    async clearAll(): Promise<void> {
      store.clear();
    },
  };
}

function openBrowserIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = window.indexedDB.open(GIFTED_EVIDENCE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GIFTED_EVIDENCE_STORE_NAME)) {
        db.createObjectStore(GIFTED_EVIDENCE_STORE_NAME, {
          keyPath: 'blobKey',
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export function getDefaultGiftedAttachmentRepository(): GiftedAttachmentRepository {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return createMemoryAttachmentRepository(fallbackMemoryAttachments);
  }

  return {
    async putAttachment(attachment: GiftedAttachmentRecord): Promise<void> {
      const db = await openBrowserIndexedDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GIFTED_EVIDENCE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(GIFTED_EVIDENCE_STORE_NAME);
        store.put({
          blobKey: attachment.blobKey,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          bytes: new Uint8Array(attachment.bytes),
          createdAt: attachment.createdAt,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB put failed'));
        };
      });
    },

    async getAttachment(blobKey: string): Promise<GiftedAttachmentRecord | null> {
      const db = await openBrowserIndexedDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GIFTED_EVIDENCE_STORE_NAME, 'readonly');
        const store = tx.objectStore(GIFTED_EVIDENCE_STORE_NAME);
        const req = store.get(blobKey);
        req.onsuccess = () => {
          db.close();
          const res = req.result;
          if (!res) {
            resolve(null);
            return;
          }
          resolve({
            blobKey: String(res.blobKey),
            filename: String(res.filename || res.blobKey),
            mimeType: String(res.mimeType || 'application/octet-stream'),
            bytes:
              res.bytes instanceof Uint8Array
                ? new Uint8Array(res.bytes)
                : new Uint8Array(res.bytes || []),
            createdAt: String(res.createdAt || new Date().toISOString()),
          });
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('IndexedDB get failed'));
        };
      });
    },

    async listAttachments(): Promise<GiftedAttachmentRecord[]> {
      const db = await openBrowserIndexedDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GIFTED_EVIDENCE_STORE_NAME, 'readonly');
        const store = tx.objectStore(GIFTED_EVIDENCE_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          db.close();
          const rawList = Array.isArray(req.result) ? req.result : [];
          resolve(
            rawList.map((res) => ({
              blobKey: String(res.blobKey),
              filename: String(res.filename || res.blobKey),
              mimeType: String(res.mimeType || 'application/octet-stream'),
              bytes:
                res.bytes instanceof Uint8Array
                  ? new Uint8Array(res.bytes)
                  : new Uint8Array(res.bytes || []),
              createdAt: String(res.createdAt || new Date().toISOString()),
            }))
          );
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('IndexedDB getAll failed'));
        };
      });
    },

    async deleteAttachment(blobKey: string): Promise<void> {
      const db = await openBrowserIndexedDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GIFTED_EVIDENCE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(GIFTED_EVIDENCE_STORE_NAME);
        store.delete(blobKey);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB delete failed'));
        };
      });
    },

    async clearAll(): Promise<void> {
      const db = await openBrowserIndexedDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(GIFTED_EVIDENCE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(GIFTED_EVIDENCE_STORE_NAME);
        store.clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB clear failed'));
        };
      });
    },
  };
}

// ============================================================================
// ١٢. محرك النسخ الاحتياطي الشامل واستعادته بصيغة ZIP (شاملاً JSON + IndexedDB)
// ============================================================================

export interface GiftedBackupAttachmentManifestEntry {
  blobKey: string;
  archivePath: string;
  filename: string;
  mimeType: string;
  byteLength: number;
  crc32: number;
  createdAt: string;
}

export interface GiftedBackupManifest {
  bundleType: 'maktabi_gifted_coordinator_backup';
  schemaVersion: number;
  exportedAt: string;
  recordByteLength: number;
  recordCrc32: number;
  attachmentsCount: number;
  attachments: GiftedBackupAttachmentManifestEntry[];
}

export interface GiftedExtractedZipEntry {
  filename: string;
  bytes: Uint8Array;
  crc32: number;
}

/**
 * قارئ أرشيف PKZIP قياسي (STORE method) يفحص التواقيع ويتحقق من سلامة CRC-32 لكل ملف
 */
export function extractZipArchiveEntries(
  zipBytes: Uint8Array
): GiftedExtractedZipEntry[] {
  const decoder = new TextDecoder('utf-8');
  const view = new DataView(
    zipBytes.buffer,
    zipBytes.byteOffset,
    zipBytes.byteLength
  );
  const entries: GiftedExtractedZipEntry[] = [];
  let offset = 0;

  while (offset + 4 <= zipBytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x04034b50) {
      // Local file header
      if (offset + 30 > zipBytes.length) {
        throw new Error('ملف النسخة الاحتياطية ZIP تالف: ترويسة ملف غير مكتملة.');
      }
      const compressionMethod = view.getUint16(offset + 8, true);
      if (compressionMethod !== 0) {
        throw new Error(
          `طريقة ضغط غير مدعومة (${compressionMethod}) في أرشيف النسخة الاحتياطية.`
        );
      }
      const expectedCrc = view.getUint32(offset + 14, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraFieldLength = view.getUint16(offset + 28, true);

      const nameStart = offset + 30;
      const dataStart = nameStart + fileNameLength + extraFieldLength;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd > zipBytes.length) {
        throw new Error('ملف النسخة الاحتياطية ZIP تالف: حجم البيانات يتجاوز نهاية الملف.');
      }

      const filename = decoder.decode(zipBytes.subarray(nameStart, nameStart + fileNameLength));
      const contentBytes = new Uint8Array(zipBytes.subarray(dataStart, dataEnd));
      const actualCrc = computeCrc32(contentBytes);

      if (actualCrc !== expectedCrc) {
        throw new Error(
          `فشل التحقق من سلامة الملف (${filename}) داخل أرشيف النسخة الاحتياطية (CRC-32 mismatch).`
        );
      }

      entries.push({
        filename,
        bytes: contentBytes,
        crc32: actualCrc,
      });

      offset = dataEnd;
    } else if (signature === 0x02014b50 || signature === 0x06054b50) {
      // وصلنا إلى Central Directory أو End of Central Directory
      break;
    } else {
      throw new Error('ملف النسخة الاحتياطية ليس أرشيف ZIP صالحاً.');
    }
  }

  if (entries.length === 0) {
    throw new Error('أرشيف النسخة الاحتياطية فارغ أو غير صالح.');
  }

  return entries;
}

export function buildGiftedBackupFilename(
  record: GiftedCoordinatorRecord,
  settings?: SchoolSettings
): string {
  const schoolSegment = sanitizeFilenameSegment(
    settings?.schoolName || 'مدرسة'
  );
  const yearSegment = sanitizeFilenameSegment(
    settings?.academicYear || '1448'
  );
  return `نسخة_احتياطية_سجل_منسق_الموهوبين_${schoolSegment}_${yearSegment}.zip`;
}

export const RESTORE_GEN_KEY_PREFIX = 'rgen:';

/**
 * يزيل أي بادئة جيل استعادة سابقة (rgen:<genId>:) لمنع تراكم البادئات عبر دورات التصدير والاستعادة المتعددة
 */
export function stripRestoreGenPrefix(blobKey: string): string {
  let clean = (blobKey || '').trim();
  const pattern = /^rgen:[^:]+:(.+)$/;
  let match = pattern.exec(clean);
  while (match) {
    clean = match[1].trim();
    match = pattern.exec(clean);
  }
  return clean;
}

/**
 * يستخرج معرّف الجيل (restoreGenId) من مفتاح المرفق إن كان يبدأ ببادئة الجيل (rgen:<genId>:...)
 */
export function extractRestoreGenIdFromBlobKey(blobKey: string): string | null {
  const clean = (blobKey || '').trim();
  const match = /^rgen:([^:]+):.+$/i.exec(clean);
  return match ? match[1] : null;
}

/**
 * يبني مفتاحاً نهائياً معزولاً يتضمن restoreGenId دون المساس بأي مفتاح قديم
 */
export function buildRestoreGenBlobKey(
  restoreGenId: string,
  originalBlobKey: string
): string {
  const baseKey = stripRestoreGenPrefix(originalBlobKey) || 'attachment';
  return `${RESTORE_GEN_KEY_PREFIX}${restoreGenId}:${baseKey}`;
}

/**
 * يسجل مفتاح مرفق جديد ضمن مفاتيح الجيل النشط في السجل
 */
export function registerAttachmentBlobKeyInRecord(
  record: GiftedCoordinatorRecord,
  blobKey: string
): GiftedCoordinatorRecord {
  const cleanKey = (blobKey || '').trim();
  if (!cleanKey) return record;
  const existingKeys = record.activeAttachmentBlobKeys || [];
  if (existingKeys.includes(cleanKey)) return record;
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    activeAttachmentBlobKeys: [...existingKeys, cleanKey],
  };
}

/**
 * يجمع كافة مفاتيح المرفقات (blobKey) المشار إليها في جميع مواضع السجل (حزم الشواهد، المفاتيح النشطة، وأي كائن متداخل)
 */
export function getReferencedBlobKeysInRecord(
  record: GiftedCoordinatorRecord
): Set<string> {
  const keys = new Set<string>();

  if (Array.isArray(record.activeAttachmentBlobKeys)) {
    for (const k of record.activeAttachmentBlobKeys) {
      if (typeof k === 'string' && k.trim()) {
        keys.add(k.trim());
      }
    }
  }

  for (const bundle of Object.values(record.evidenceBundles || {})) {
    for (const photo of bundle?.photos || []) {
      if (photo?.blobKey && typeof photo.blobKey === 'string') {
        keys.add(photo.blobKey.trim());
      }
    }
  }

  const walkNested = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walkNested(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    for (const [prop, val] of Object.entries(obj)) {
      if (
        (prop === 'blobKey' || prop === 'attachmentBlobKey') &&
        typeof val === 'string' &&
        val.trim()
      ) {
        keys.add(val.trim());
      } else if (val && typeof val === 'object') {
        walkNested(val);
      }
    }
  };

  walkNested(record);
  return keys;
}

/**
 * يحدّث جميع مراجع blobKey في السجل (evidenceBundles وأي حقول متداخلة أخرى) لتشير إلى مفاتيح الجيل الجديد (restoreGenId)
 */
export function remapAllBlobKeysInRecord(
  record: GiftedCoordinatorRecord,
  blobKeyMap: Map<string, string>,
  restoreGenId: string,
  newGenerationBlobKeys: string[]
): GiftedCoordinatorRecord {
  const resolveMappedKey = (rawKey: string): string => {
    const clean = (rawKey || '').trim();
    if (!clean) return clean;
    if (blobKeyMap.has(clean)) {
      return blobKeyMap.get(clean)!;
    }
    const stripped = stripRestoreGenPrefix(clean);
    if (blobKeyMap.has(stripped)) {
      return blobKeyMap.get(stripped)!;
    }
    return clean;
  };

  const remapNode = <T>(node: T): T => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      return node.map((item) => remapNode(item)) as unknown as T;
    }
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [prop, val] of Object.entries(src)) {
      if (
        (prop === 'blobKey' || prop === 'attachmentBlobKey') &&
        typeof val === 'string'
      ) {
        out[prop] = resolveMappedKey(val);
      } else if (val && typeof val === 'object') {
        out[prop] = remapNode(val);
      } else {
        out[prop] = val;
      }
    }
    return out as T;
  };

  const remappedClone = remapNode(record);

  const remappedEvidenceBundles: Record<string, GiftedProgramEvidenceBundle> =
    {};
  for (const [targetId, bundle] of Object.entries(
    remappedClone.evidenceBundles || {}
  )) {
    remappedEvidenceBundles[targetId] = {
      ...bundle,
      photos: (bundle.photos || []).map((photo) => ({
        ...photo,
        blobKey: resolveMappedKey(photo.blobKey),
      })),
    };
  }

  const allReferencedAfterRemap = new Set<string>(newGenerationBlobKeys);
  for (const bundle of Object.values(remappedEvidenceBundles)) {
    for (const photo of bundle.photos || []) {
      if (photo.blobKey) {
        allReferencedAfterRemap.add(photo.blobKey);
      }
    }
  }

  return {
    ...remappedClone,
    updatedAt: new Date().toISOString(),
    evidenceBundles: remappedEvidenceBundles,
    activeRestoreGenId: restoreGenId,
    activeAttachmentBlobKeys: Array.from(allReferencedAfterRemap),
  };
}

/**
 * يصفّي المرفقات ليرجع فقط المرفقات التابعة للجيل النشط / المشار إليها في السجل النشط دون أي بقايا أجيال يتيمة أو سابقة
 */
export function getActiveGenerationAttachmentsForRecord(
  record: GiftedCoordinatorRecord,
  allAttachments: GiftedAttachmentRecord[]
): GiftedAttachmentRecord[] {
  const referencedKeys = getReferencedBlobKeysInRecord(record);
  const activeGenId = record.activeRestoreGenId?.trim() || null;

  return allAttachments.filter((att) => {
    const key = (att.blobKey || '').trim();
    if (!key) return false;

    if (referencedKeys.has(key)) {
      return true;
    }

    const keyGenId = extractRestoreGenIdFromBlobKey(key);
    if (keyGenId !== null) {
      // مفتاح مرتبط بجيل استعادة: يُقبل فقط إذا كان يطابق الجيل النشط للسجل الحالي
      return activeGenId !== null && keyGenId === activeGenId;
    }

    // مفتاح عادي غير مسبوق ببادئة جيل (rgen:):
    // إذا كان السجل قد تحول إلى جيل استعادة نشط، فلا تُضمّن المفاتيح القديمة غير المشار إليها في السجل النشط
    if (activeGenId !== null) {
      return false;
    }

    return true;
  });
}

/**
 * ينظف مرفقات الأجيال اليتيمة أو السابقة بأمان تام:
 * إذا تعذرت قراءة السجل النشط أو التحقق من سلامته، يتوقف فوراً ولا يحذف أي مرفق على الإطلاق.
 */
export async function cleanupOrphanedAttachmentGenerations(options?: {
  storage?: Pick<Storage, 'getItem'>;
  attachmentRepo?: GiftedAttachmentRepository;
  activeRecord?: GiftedCoordinatorRecord;
}): Promise<{
  cleanedCount: number;
  deletedKeys: string[];
  skippedReason?: string;
}> {
  const repo = options?.attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  let verifiedRecord: GiftedCoordinatorRecord | null = null;

  try {
    if (options?.storage) {
      const raw = options.storage.getItem(GIFTED_RECORD_STORAGE_KEY);
      if (!raw || typeof raw !== 'string' || !raw.trim()) {
        return {
          cleanedCount: 0,
          deletedKeys: [],
          skippedReason: 'missing_active_record_in_storage',
        };
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.id !== 'string' ||
        !parsed.id.trim() ||
        !parsed.evidenceBundles ||
        typeof parsed.evidenceBundles !== 'object' ||
        Array.isArray(parsed.evidenceBundles)
      ) {
        return {
          cleanedCount: 0,
          deletedKeys: [],
          skippedReason: 'corrupted_or_unverified_active_record',
        };
      }
      verifiedRecord = sanitizeGiftedCoordinatorRecord(parsed);
    } else if (options?.activeRecord) {
      const candidate = options.activeRecord as unknown as Record<
        string,
        unknown
      >;
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        typeof candidate.id !== 'string' ||
        !candidate.id.trim() ||
        !candidate.evidenceBundles ||
        typeof candidate.evidenceBundles !== 'object' ||
        Array.isArray(candidate.evidenceBundles)
      ) {
        return {
          cleanedCount: 0,
          deletedKeys: [],
          skippedReason: 'invalid_active_record_argument',
        };
      }
      verifiedRecord = sanitizeGiftedCoordinatorRecord(candidate);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(GIFTED_RECORD_STORAGE_KEY);
      if (!raw || typeof raw !== 'string' || !raw.trim()) {
        return {
          cleanedCount: 0,
          deletedKeys: [],
          skippedReason: 'missing_active_record_in_storage',
        };
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.id !== 'string' ||
        !parsed.id.trim() ||
        !parsed.evidenceBundles ||
        typeof parsed.evidenceBundles !== 'object' ||
        Array.isArray(parsed.evidenceBundles)
      ) {
        return {
          cleanedCount: 0,
          deletedKeys: [],
          skippedReason: 'corrupted_or_unverified_active_record',
        };
      }
      verifiedRecord = sanitizeGiftedCoordinatorRecord(parsed);
    } else {
      return {
        cleanedCount: 0,
        deletedKeys: [],
        skippedReason: 'no_verifiable_active_record_source',
      };
    }
  } catch {
    // إذا فشل تحليل السجل النشط أو التحقق منه، لا نحذف أي مرفق إطلاقاً
    return {
      cleanedCount: 0,
      deletedKeys: [],
      skippedReason: 'failed_to_parse_or_verify_active_record',
    };
  }

  if (!verifiedRecord) {
    return {
      cleanedCount: 0,
      deletedKeys: [],
      skippedReason: 'unverified_active_record',
    };
  }

  let allAttachments: GiftedAttachmentRecord[] = [];
  try {
    allAttachments = await repo.listAttachments();
  } catch {
    return {
      cleanedCount: 0,
      deletedKeys: [],
      skippedReason: 'failed_to_list_attachments',
    };
  }

  const activeAttachments = getActiveGenerationAttachmentsForRecord(
    verifiedRecord,
    allAttachments
  );
  const activeKeysSet = new Set(activeAttachments.map((a) => a.blobKey));
  const deletedKeys: string[] = [];

  for (const att of allAttachments) {
    if (!activeKeysSet.has(att.blobKey)) {
      try {
        await repo.deleteAttachment(att.blobKey);
        deletedKeys.push(att.blobKey);
      } catch {
        // فشل حذف مفتاح يتيم منفرد لا يوقف العملية ولا يؤثر على الجيل النشط
      }
    }
  }

  return {
    cleanedCount: deletedKeys.length,
    deletedKeys,
  };
}

export async function exportGiftedFullBackupZip(
  record: GiftedCoordinatorRecord,
  options?: {
    attachmentRepo?: GiftedAttachmentRepository;
    settings?: SchoolSettings;
  }
): Promise<{
  zipBytes: Uint8Array;
  filename: string;
  manifest: GiftedBackupManifest;
}> {
  const repo = options?.attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const allAttachments = await repo.listAttachments();
  const encoder = new TextEncoder();

  const sanitizedRecord = sanitizeGiftedCoordinatorRecord(record);
  // تصدير مرفقات الجيل النشط / السجل النشط فقط واستبعاد أي بقايا أجيال يتيمة أو سابقة
  const attachments = getActiveGenerationAttachmentsForRecord(
    sanitizedRecord,
    allAttachments
  );

  const recordJsonString = JSON.stringify(sanitizedRecord, null, 2);
  const recordJsonBytes = encoder.encode(recordJsonString);
  const recordCrc32 = computeCrc32(recordJsonBytes);

  const attachmentManifestEntries: GiftedBackupAttachmentManifestEntry[] = [];
  const zipEntries: ZipFileEntry[] = [];

  for (const att of attachments) {
    const safeKey = sanitizeFilenameSegment(att.blobKey) || 'attachment';
    const archivePath = `attachments/${safeKey}`;
    const attCrc = computeCrc32(att.bytes);

    attachmentManifestEntries.push({
      blobKey: att.blobKey,
      archivePath,
      filename: att.filename,
      mimeType: att.mimeType,
      byteLength: att.bytes.length,
      crc32: attCrc,
      createdAt: att.createdAt,
    });

    zipEntries.push({
      filename: archivePath,
      content: att.bytes,
    });
  }

  const manifest: GiftedBackupManifest = {
    bundleType: 'maktabi_gifted_coordinator_backup',
    schemaVersion: GIFTED_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    recordByteLength: recordJsonBytes.length,
    recordCrc32,
    attachmentsCount: attachmentManifestEntries.length,
    attachments: attachmentManifestEntries,
  };

  const manifestBytes = encoder.encode(JSON.stringify(manifest, null, 2));

  const finalEntries: ZipFileEntry[] = [
    { filename: 'manifest.json', content: manifestBytes },
    { filename: 'record.json', content: recordJsonBytes },
    ...zipEntries,
  ];

  const zipBytes = createZipArchiveBytes(finalEntries);
  const filename = buildGiftedBackupFilename(sanitizedRecord, options?.settings);

  return {
    zipBytes,
    filename,
    manifest,
  };
}

export interface GiftedBackupRestoreResult {
  record: GiftedCoordinatorRecord;
  manifest: GiftedBackupManifest;
  restoredAttachmentsCount: number;
  restoreGenId: string;
  blobKeyMap: Record<string, string>;
}

export async function importAndRestoreGiftedFullBackupZip(
  zipBytes: Uint8Array,
  options?: {
    storage?: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>>;
    attachmentRepo?: GiftedAttachmentRepository;
    replaceExistingAttachments?: boolean;
    restoreGenIdOverride?: string;
  }
): Promise<GiftedBackupRestoreResult> {
  // ١. التحقق المسبق الكامل في الذاكرة (Pre-flight Validation) قبل لمس أي مخزن
  const extracted = extractZipArchiveEntries(zipBytes);
  const decoder = new TextDecoder('utf-8');

  const manifestEntry = extracted.find((e) => e.filename === 'manifest.json');
  const recordEntry = extracted.find((e) => e.filename === 'record.json');

  if (!manifestEntry || !recordEntry) {
    throw new Error(
      'ملف النسخة الاحتياطية غير مكتمل: يجب أن يتضمن manifest.json و record.json.'
    );
  }

  const manifest = JSON.parse(
    decoder.decode(manifestEntry.bytes)
  ) as GiftedBackupManifest;

  if (manifest.bundleType !== 'maktabi_gifted_coordinator_backup') {
    throw new Error('هذا الملف ليس نسخة احتياطية خاصة بسجل منسق الموهوبين.');
  }

  if (
    manifest.recordByteLength !== recordEntry.bytes.length ||
    manifest.recordCrc32 !== recordEntry.crc32
  ) {
    throw new Error(
      'فشل التحقق من سلامة بيانات السجل (record.json) مقارنةً ببيانات الإصدار في manifest.json.'
    );
  }

  const rawRecord = JSON.parse(decoder.decode(recordEntry.bytes));
  const baseSanitizedRecord = runSafeGiftedV4Migration(
    sanitizeGiftedCoordinatorRecord(rawRecord)
  ).record;

  const restoreGenId =
    options?.restoreGenIdOverride?.trim() ||
    `rgen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const blobKeyMap = new Map<string, string>();
  const validatedAttachmentsToStage: Array<{
    attMeta: GiftedBackupAttachmentManifestEntry;
    finalBlobKey: string;
    bytes: Uint8Array;
  }> = [];

  for (const attMeta of manifest.attachments || []) {
    const fileEntry = extracted.find((e) => e.filename === attMeta.archivePath);
    if (!fileEntry) {
      throw new Error(
        `المرفق (${attMeta.filename}) المذكور في النسخة الاحتياطية مفقود من الأرشيف.`
      );
    }
    if (
      fileEntry.bytes.length !== attMeta.byteLength ||
      fileEntry.crc32 !== attMeta.crc32
    ) {
      throw new Error(
        `فشل التحقق من سلامة المرفق (${attMeta.filename}) أثناء الاستعادة.`
      );
    }

    const finalBlobKey = buildRestoreGenBlobKey(restoreGenId, attMeta.blobKey);
    blobKeyMap.set(attMeta.blobKey, finalBlobKey);
    blobKeyMap.set(stripRestoreGenPrefix(attMeta.blobKey), finalBlobKey);

    validatedAttachmentsToStage.push({
      attMeta,
      finalBlobKey,
      bytes: new Uint8Array(fileEntry.bytes),
    });
  }

  // ٢. كتابة مرفقات الجيل الجديد في IndexedDB تحت مفاتيح نهائية مستقلة تتضمن restoreGenId دون حذف أو الكتابة فوق أي مفتاح قديم
  const repo = options?.attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const preExistingAttachments = await repo.listAttachments();
  const preExistingKeys = preExistingAttachments.map((a) => a.blobKey);
  const writtenNewGenKeys: string[] = [];

  const rollbackStagedGenerationKeys = async () => {
    for (const stagedKey of writtenNewGenKeys) {
      try {
        await repo.deleteAttachment(stagedKey);
      } catch {
        // ignore rollback delete errors
      }
    }
  };

  try {
    for (const item of validatedAttachmentsToStage) {
      await repo.putAttachment({
        blobKey: item.finalBlobKey,
        filename: item.attMeta.filename,
        mimeType: item.attMeta.mimeType,
        bytes: item.bytes,
        createdAt: item.attMeta.createdAt,
      });
      writtenNewGenKeys.push(item.finalBlobKey);
    }

    // ٣. التحقق الفعلي بالقراءة العكسية (Read-Back Verification) من IndexedDB قبل التحويل
    for (const item of validatedAttachmentsToStage) {
      const readBack = await repo.getAttachment(item.finalBlobKey);
      if (!readBack) {
        throw new Error(
          `تعذر التحقق من كتابة المرفق (${item.attMeta.filename}) في قاعدة IndexedDB قبل التحويل.`
        );
      }
      const readBackCrc = computeCrc32(readBack.bytes);
      if (
        readBack.bytes.length !== item.attMeta.byteLength ||
        readBackCrc !== item.attMeta.crc32
      ) {
        throw new Error(
          `فشل التحقق العكسي (Read-Back CRC-32) للمرفق (${item.attMeta.filename}) في IndexedDB.`
        );
      }
    }
  } catch (stageError) {
    await rollbackStagedGenerationKeys();
    throw stageError;
  }

  // ٤. تحديث جميع مراجع blobKey داخل restoredRecord وحفظه في localStorage ليكون هو Commit Point الوحيد
  const restoredRecord = remapAllBlobKeysInRecord(
    baseSanitizedRecord,
    blobKeyMap,
    restoreGenId,
    writtenNewGenKeys
  );

  const targetStorage =
    options?.storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);

  if (targetStorage) {
    const committed = saveGiftedRecordToStorage(restoredRecord, targetStorage);
    if (!committed) {
      await rollbackStagedGenerationKeys();
      throw new Error(
        'فشل اعتماد الاستعادة (Commit Point): تعذر حفظ السجل المستعاد في التخزين المحلي (localStorage).'
      );
    }
  }

  // ٥. التنظيف اللاحق المستقل للمرفقات القديمة (بعد نجاح Commit Point فقط، ودون السماح لفشل التنظيف بإبطال الاستعادة)
  if (options?.replaceExistingAttachments !== false) {
    const newGenKeysSet = new Set(writtenNewGenKeys);
    for (const oldKey of preExistingKeys) {
      if (!newGenKeysSet.has(oldKey)) {
        try {
          await repo.deleteAttachment(oldKey);
        } catch {
          // لا نسمح لفشل حذف مرفق قديم بإبطال الاستعادة المعتمدة
        }
      }
    }
  }

  const plainBlobKeyMap: Record<string, string> = {};
  blobKeyMap.forEach((v, k) => {
    plainBlobKeyMap[k] = v;
  });

  return {
    record: restoredRecord,
    manifest,
    restoredAttachmentsCount: writtenNewGenKeys.length,
    restoreGenId,
    blobKeyMap: plainBlobKeyMap,
  };
}

// ============================================================================
// ١٣. المرحلة التنفيذية الثالثة — القسم الثامن: مستودع الشواهد (بحد أقصى 4 صور و4 روابط لكل سجل)
// ============================================================================

export const MAX_GIFTED_EVIDENCE_PHOTOS = 4;
export const MAX_GIFTED_EVIDENCE_LINKS = 4;

export type GiftedEvidenceTargetCategory =
  | 'ministerial_program'
  | 'custom_initiative'
  | 'scientific_competition';

export const GIFTED_EVIDENCE_TARGET_CATEGORY_LABELS: Record<
  GiftedEvidenceTargetCategory,
  string
> = {
  ministerial_program: 'برنامج وزاري',
  custom_initiative: 'مبادرة منسق',
  scientific_competition: 'مسابقة علمية',
};

export interface GiftedEvidenceTargetCatalogItem {
  targetId: string;
  category: GiftedEvidenceTargetCategory;
  categoryLabel: string;
  title: string;
  stageLabel: string;
  targetAudience: string;
  scheduledPeriod: string;
  applicableToSchool: boolean;
  showEvidencesInReport: boolean;
  photosCount: number;
  linksCount: number;
  selectedForProgramReportCount: number;
  selectedForFinalRecordCount: number;
}

/**
 * يعيد قائمة السجلات المتاحة لتوثيق الشواهد (البرامج الوزارية + مبادرات المنسق + المسابقات العلمية فقط)
 * دون إضافة أي بطاقات مستقلة لروابط البرامج أو الحقائب التدريبية المرجعية في الصفحتين 38 و39.
 */
export function getGiftedEvidenceTargetsCatalog(
  record: GiftedCoordinatorRecord
): GiftedEvidenceTargetCatalogItem[] {
  const items: GiftedEvidenceTargetCatalogItem[] = [];

  const pushTarget = (
    targetId: string,
    category: GiftedEvidenceTargetCategory,
    title: string,
    stageLabel: string,
    targetAudience: string,
    scheduledPeriod: string,
    applicableToSchool: boolean
  ) => {
    const bundle = getEvidenceBundleForTarget(record, targetId);
    const selectedForProgramReportCount =
      bundle.photos.filter((p) => p.selectedForProgramReport).length +
      bundle.links.filter((l) => l.selectedForProgramReport).length;
    const selectedForFinalRecordCount =
      bundle.photos.filter((p) => p.selectedForFinalRecord).length +
      bundle.links.filter((l) => l.selectedForFinalRecord).length;

    items.push({
      targetId,
      category,
      categoryLabel: GIFTED_EVIDENCE_TARGET_CATEGORY_LABELS[category],
      title,
      stageLabel,
      targetAudience,
      scheduledPeriod,
      applicableToSchool,
      showEvidencesInReport: bundle.showEvidencesInReport,
      photosCount: bundle.photos.length,
      linksCount: bundle.links.length,
      selectedForProgramReportCount,
      selectedForFinalRecordCount,
    });
  };

  for (const prog of record.ministerialPrograms) {
    pushTarget(
      prog.id,
      'ministerial_program',
      prog.title,
      prog.stageLabel,
      prog.targetAudience,
      prog.scheduledPeriod,
      prog.applicableToSchool
    );
  }

  for (const init of record.customInitiatives) {
    pushTarget(
      init.id,
      'custom_initiative',
      init.title,
      init.stage,
      init.targetAudience,
      init.executionDate,
      true
    );
  }

  for (const comp of record.scientificCompetitions) {
    pushTarget(
      comp.id,
      'scientific_competition',
      comp.title,
      comp.stage,
      comp.targetAudience,
      comp.startDate,
      true
    );
  }

  return items;
}

export function getEvidenceBundleForTarget(
  record: GiftedCoordinatorRecord,
  targetId: string
): GiftedProgramEvidenceBundle {
  const existing = record.evidenceBundles[targetId];
  if (!existing) {
    return {
      targetId,
      showEvidencesInReport: true,
      photos: [],
      links: [],
    };
  }
  return {
    targetId: existing.targetId || targetId,
    showEvidencesInReport:
      typeof existing.showEvidencesInReport === 'boolean'
        ? existing.showEvidencesInReport
        : true,
    photos: existing.photos.slice(0, MAX_GIFTED_EVIDENCE_PHOTOS),
    links: existing.links.slice(0, MAX_GIFTED_EVIDENCE_LINKS),
  };
}

export function setTargetShowEvidencesInReportInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  showEvidencesInReport: boolean
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    evidenceBundles: {
      ...record.evidenceBundles,
      [targetId]: {
        ...current,
        showEvidencesInReport,
      },
    },
  };
}

export interface GiftedEvidencePhotoInput {
  id?: string;
  blobKey: string;
  title: string;
  caption?: string;
  selectedForProgramReport?: boolean;
  selectedForFinalRecord?: boolean;
  createdAt?: string;
}

export interface ResolveOrStoreActiveAttachmentResult {
  blobKey: string;
  reusedExisting: boolean;
  attachment: GiftedAttachmentRecord;
}

/**
 * يتحقق مما إذا كان المرفق موجوداً بالفعل ضمن مرفقات الجيل النشط في IndexedDB (بنفس الحجم ومحتوى البايتات/CRC32)
 * لإعادة استخدامه ومنع تكرار رفع نفس الملف في IndexedDB، أو يخزنه بمفتاح جديد متوافق مع activeRestoreGenId.
 */
export async function resolveOrStoreActiveGenerationAttachment(
  record: GiftedCoordinatorRecord,
  input: {
    targetId: string;
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
  },
  repo?: GiftedAttachmentRepository
): Promise<ResolveOrStoreActiveAttachmentResult> {
  const attachmentRepo = repo ?? getDefaultGiftedAttachmentRepository();
  const allAttachments = await attachmentRepo.listAttachments();
  const activeAttachments = getActiveGenerationAttachmentsForRecord(
    record,
    allAttachments
  );

  const incomingCrc = computeCrc32(input.bytes);
  const matchingActive = activeAttachments.find((att) => {
    if (att.bytes.length !== input.bytes.length) return false;
    if (computeCrc32(att.bytes) !== incomingCrc) return false;
    for (let i = 0; i < input.bytes.length; i += 1) {
      if (att.bytes[i] !== input.bytes[i]) return false;
    }
    return true;
  });

  if (matchingActive) {
    return {
      blobKey: matchingActive.blobKey,
      reusedExisting: true,
      attachment: matchingActive,
    };
  }

  const baseKey = `ev-${input.targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const activeGenId = record.activeRestoreGenId?.trim();
  const finalBlobKey = activeGenId
    ? buildRestoreGenBlobKey(activeGenId, baseKey)
    : baseKey;

  const newAttachment: GiftedAttachmentRecord = {
    blobKey: finalBlobKey,
    filename: input.filename.trim() || 'evidence-photo.png',
    mimeType: input.mimeType || 'image/jpeg',
    bytes: input.bytes,
    createdAt: new Date().toISOString(),
  };

  await attachmentRepo.putAttachment(newAttachment);
  return {
    blobKey: finalBlobKey,
    reusedExisting: false,
    attachment: newAttachment,
  };
}

export function addEvidencePhotoToTargetInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  input: GiftedEvidencePhotoInput
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  const cleanBlobKey = input.blobKey.trim();
  if (!cleanBlobKey) {
    throw new Error('مفتاح الصورة (blobKey) مطلوب لحفظ الشاهد المصور.');
  }

  const existingPhotoIdx = current.photos.findIndex(
    (p) => p.blobKey === cleanBlobKey
  );

  if (
    existingPhotoIdx === -1 &&
    current.photos.length >= MAX_GIFTED_EVIDENCE_PHOTOS
  ) {
    throw new Error(
      `الحد الأقصى للشواهد المصورة لكل سجل هو ${MAX_GIFTED_EVIDENCE_PHOTOS} صور فقط.`
    );
  }

  const nextActiveKeys = Array.isArray(record.activeAttachmentBlobKeys)
    ? Array.from(new Set([...record.activeAttachmentBlobKeys, cleanBlobKey]))
    : undefined;

  if (existingPhotoIdx >= 0) {
    const existingPhoto = current.photos[existingPhotoIdx];
    const updatedPhoto: GiftedEvidencePhotoRef = {
      ...existingPhoto,
      title: input.title.trim() || existingPhoto.title,
      ...(input.caption !== undefined
        ? input.caption.trim()
          ? { caption: input.caption.trim() }
          : {}
        : existingPhoto.caption
          ? { caption: existingPhoto.caption }
          : {}),
      selectedForProgramReport:
        typeof input.selectedForProgramReport === 'boolean'
          ? input.selectedForProgramReport
          : existingPhoto.selectedForProgramReport,
      selectedForFinalRecord:
        typeof input.selectedForFinalRecord === 'boolean'
          ? input.selectedForFinalRecord
          : existingPhoto.selectedForFinalRecord,
    };
    if (input.caption !== undefined && !input.caption.trim()) {
      delete updatedPhoto.caption;
    }

    return {
      ...record,
      updatedAt: new Date().toISOString(),
      ...(nextActiveKeys ? { activeAttachmentBlobKeys: nextActiveKeys } : {}),
      evidenceBundles: {
        ...record.evidenceBundles,
        [targetId]: {
          ...current,
          photos: current.photos.map((p, idx) =>
            idx === existingPhotoIdx ? updatedPhoto : p
          ),
        },
      },
    };
  }

  const newPhoto: GiftedEvidencePhotoRef = {
    id:
      input.id?.trim() ||
      `ev-photo-${targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    blobKey: cleanBlobKey,
    title:
      input.title.trim() || `شاهد مصور (${current.photos.length + 1})`,
    ...(input.caption?.trim() ? { caption: input.caption.trim() } : {}),
    selectedForProgramReport:
      typeof input.selectedForProgramReport === 'boolean'
        ? input.selectedForProgramReport
        : true,
    selectedForFinalRecord:
      typeof input.selectedForFinalRecord === 'boolean'
        ? input.selectedForFinalRecord
        : true,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    ...(nextActiveKeys ? { activeAttachmentBlobKeys: nextActiveKeys } : {}),
    evidenceBundles: {
      ...record.evidenceBundles,
      [targetId]: {
        ...current,
        photos: [...current.photos, newPhoto],
      },
    },
  };
}

export function updateEvidencePhotoInTargetInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  photoId: string,
  patch: {
    title?: string;
    caption?: string;
    selectedForProgramReport?: boolean;
    selectedForFinalRecord?: boolean;
  }
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  const nextPhotos = current.photos.map((p) => {
    if (p.id !== photoId) return p;
    const nextCaption =
      patch.caption !== undefined ? patch.caption.trim() : p.caption || '';
    const updated: GiftedEvidencePhotoRef = {
      ...p,
      title: patch.title !== undefined ? patch.title.trim() || p.title : p.title,
      selectedForProgramReport:
        patch.selectedForProgramReport ?? p.selectedForProgramReport,
      selectedForFinalRecord:
        patch.selectedForFinalRecord ?? p.selectedForFinalRecord,
    };
    if (nextCaption) {
      updated.caption = nextCaption;
    } else {
      delete updated.caption;
    }
    return updated;
  });

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    evidenceBundles: {
      ...record.evidenceBundles,
      [targetId]: {
        ...current,
        photos: nextPhotos,
      },
    },
  };
}

export function deleteEvidencePhotoFromTargetInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  photoId: string
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  const removedPhoto = current.photos.find((p) => p.id === photoId);
  const nextEvidenceBundles: Record<string, GiftedProgramEvidenceBundle> = {
    ...record.evidenceBundles,
    [targetId]: {
      ...current,
      photos: current.photos.filter((p) => p.id !== photoId),
    },
  };

  let nextActiveKeys = record.activeAttachmentBlobKeys;
  if (removedPhoto && Array.isArray(nextActiveKeys)) {
    const stillUsedInBundles = Object.values(nextEvidenceBundles).some((b) =>
      (b.photos || []).some((p) => p.blobKey === removedPhoto.blobKey)
    );
    if (!stillUsedInBundles) {
      nextActiveKeys = nextActiveKeys.filter(
        (k) => k !== removedPhoto.blobKey
      );
    }
  }

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    ...(Array.isArray(nextActiveKeys)
      ? { activeAttachmentBlobKeys: nextActiveKeys }
      : {}),
    evidenceBundles: nextEvidenceBundles,
  };
}

export interface GiftedEvidenceLinkInput {
  id?: string;
  title: string;
  url: string;
  selectedForProgramReport?: boolean;
  selectedForFinalRecord?: boolean;
}

export function addEvidenceLinkToTargetInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  input: GiftedEvidenceLinkInput
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  const cleanUrl = input.url.trim();
  if (!cleanUrl) {
    throw new Error('الرابط الإلكتروني مطلوب لإضافة شاهد إلكتروني.');
  }

  const existingLinkIdx = current.links.findIndex(
    (l) => l.url.trim() === cleanUrl
  );

  if (
    existingLinkIdx === -1 &&
    current.links.length >= MAX_GIFTED_EVIDENCE_LINKS
  ) {
    throw new Error(
      `الحد الأقصى للروابط الإلكترونية لكل سجل هو ${MAX_GIFTED_EVIDENCE_LINKS} روابط فقط.`
    );
  }

  if (existingLinkIdx >= 0) {
    const existingLink = current.links[existingLinkIdx];
    const updatedLink: GiftedEvidenceLinkItem = {
      ...existingLink,
      title: input.title.trim() || existingLink.title,
      url: cleanUrl,
      selectedForProgramReport:
        typeof input.selectedForProgramReport === 'boolean'
          ? input.selectedForProgramReport
          : existingLink.selectedForProgramReport,
      selectedForFinalRecord:
        typeof input.selectedForFinalRecord === 'boolean'
          ? input.selectedForFinalRecord
          : existingLink.selectedForFinalRecord,
    };

    return {
      ...record,
      updatedAt: new Date().toISOString(),
      evidenceBundles: {
        ...record.evidenceBundles,
        [targetId]: {
          ...current,
          links: current.links.map((l, idx) =>
            idx === existingLinkIdx ? updatedLink : l
          ),
        },
      },
    };
  }

  const newLink: GiftedEvidenceLinkItem = {
    id:
      input.id?.trim() ||
      `ev-link-${targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title:
      input.title.trim() || `رابط شاهد (${current.links.length + 1})`,
    url: cleanUrl,
    selectedForProgramReport:
      typeof input.selectedForProgramReport === 'boolean'
        ? input.selectedForProgramReport
        : true,
    selectedForFinalRecord:
      typeof input.selectedForFinalRecord === 'boolean'
        ? input.selectedForFinalRecord
        : true,
  };

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    evidenceBundles: {
      ...record.evidenceBundles,
      [targetId]: {
        ...current,
        links: [...current.links, newLink],
      },
    },
  };
}

export function updateEvidenceLinkInTargetInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  linkId: string,
  patch: {
    title?: string;
    url?: string;
    selectedForProgramReport?: boolean;
    selectedForFinalRecord?: boolean;
  }
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  const nextLinks = current.links.map((l) => {
    if (l.id !== linkId) return l;
    return {
      ...l,
      title: patch.title !== undefined ? patch.title.trim() || l.title : l.title,
      url: patch.url !== undefined ? patch.url.trim() || l.url : l.url,
      selectedForProgramReport:
        patch.selectedForProgramReport ?? l.selectedForProgramReport,
      selectedForFinalRecord:
        patch.selectedForFinalRecord ?? l.selectedForFinalRecord,
    };
  });

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    evidenceBundles: {
      ...record.evidenceBundles,
      [targetId]: {
        ...current,
        links: nextLinks,
      },
    },
  };
}

export function deleteEvidenceLinkFromTargetInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  linkId: string
): GiftedCoordinatorRecord {
  const current = getEvidenceBundleForTarget(record, targetId);
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    evidenceBundles: {
      ...record.evidenceBundles,
      [targetId]: {
        ...current,
        links: current.links.filter((l) => l.id !== linkId),
      },
    },
  };
}

// ============================================================================
// ١٤. المرحلة التنفيذية الثالثة — القسم التاسع: المتابعة والتقييم (قراءة تلقائية لغير المنفذ + 4 حقول تقييم فقط)
// ============================================================================

export type GiftedNonExecutedSourceType =
  | 'executive_plan'
  | 'ministerial_action'
  | 'custom_initiative'
  | 'scientific_competition';

export const GIFTED_NON_EXECUTED_SOURCE_LABELS: Record<
  GiftedNonExecutedSourceType,
  string
> = {
  executive_plan: 'الخطة التنفيذية (القسم ٢)',
  ministerial_action: 'إجراء برنامج وزاري (القسم ٦)',
  custom_initiative: 'مبادرة منسق (القسم ٣)',
  scientific_competition: 'مسابقة علمية (القسم ٣)',
};

export interface GiftedNonExecutedItemSummary {
  id: string;
  sourceType: GiftedNonExecutedSourceType;
  sourceTypeLabel: string;
  parentTitle: string;
  itemTitle: string;
  scheduledDateOrPeriod: string;
  nonExecutionReason: string;
  sourceSectionNumber: 2 | 3 | 6;
}

/**
 * يستخرج تلقائياً جميع البرامج والمبادرات والمسابقات والإجراءات التي حالتها «لم ينفذ»
 * مع أسباب عدم التنفيذ المسجلة في الأقسام السابقة دون إعادة إدخال.
 */
export function getGiftedNonExecutedItemsSummary(
  record: GiftedCoordinatorRecord
): GiftedNonExecutedItemSummary[] {
  const items: GiftedNonExecutedItemSummary[] = [];

  const nonApplicableProgramIds = new Set(
    record.ministerialPrograms
      .filter((p) => !p.applicableToSchool)
      .map((p) => p.id)
  );

  // ١. بنود الخطة التنفيذية التي حالتها «لم ينفذ» (القسم 2)
  for (const planItem of record.executivePlan) {
    if (
      planItem.linkedProgramId &&
      nonApplicableProgramIds.has(planItem.linkedProgramId)
    ) {
      continue;
    }
    if (planItem.status === 'not_executed') {
      items.push({
        id: `nonexec-plan-${planItem.id}`,
        sourceType: 'executive_plan',
        sourceTypeLabel: GIFTED_NON_EXECUTED_SOURCE_LABELS.executive_plan,
        parentTitle: 'الخطة التنفيذية العامة',
        itemTitle: planItem.programTitle,
        scheduledDateOrPeriod: planItem.executionDate || 'غير محدد',
        nonExecutionReason:
          (planItem.nonExecutionReason || '').trim() ||
          'لم يُسجّل سبب عدم التنفيذ',
        sourceSectionNumber: 2,
      });
    }
  }

  // ٢. الإجراءات القياسية للبرامج الوزارية المطبقة التي حالتها «لم ينفذ» (القسم 6)
  for (const prog of record.ministerialPrograms) {
    if (!prog.applicableToSchool) continue;
    const standardCount = GIFTED_STANDARD_PROGRAM_ACTIONS[prog.code].length;
    const standardActions = prog.actions
      .filter((a) => a.isStandard !== false)
      .slice(0, standardCount);
    for (const act of standardActions) {
      if (act.status === 'not_executed') {
        items.push({
          id: `nonexec-act-${prog.id}-${act.id}`,
          sourceType: 'ministerial_action',
          sourceTypeLabel: GIFTED_NON_EXECUTED_SOURCE_LABELS.ministerial_action,
          parentTitle: prog.title,
          itemTitle: act.actionText,
          scheduledDateOrPeriod:
            act.executionDate || prog.scheduledPeriod || 'غير محدد',
          nonExecutionReason:
            (act.nonExecutionReason || '').trim() ||
            'لم يُسجّل سبب عدم التنفيذ',
          sourceSectionNumber: 6,
        });
      }
    }
  }

  // ٣. مبادرات المنسق التي حالتها «لم ينفذ» (القسم 3)
  for (const init of record.customInitiatives) {
    if (init.status === 'not_executed') {
      items.push({
        id: `nonexec-init-${init.id}`,
        sourceType: 'custom_initiative',
        sourceTypeLabel: GIFTED_NON_EXECUTED_SOURCE_LABELS.custom_initiative,
        parentTitle: `مبادرة منسق (${init.initiativeType})`,
        itemTitle: init.title,
        scheduledDateOrPeriod: init.executionDate || 'غير محدد',
        nonExecutionReason:
          (init.nonExecutionReason || '').trim() ||
          'لم يُسجّل سبب عدم التنفيذ',
        sourceSectionNumber: 3,
      });
    }
  }

  // ٤. المسابقات العلمية التي حالتها «لم ينفذ» (القسم 3)
  for (const comp of record.scientificCompetitions) {
    if (comp.status === 'not_executed') {
      items.push({
        id: `nonexec-comp-${comp.id}`,
        sourceType: 'scientific_competition',
        sourceTypeLabel: GIFTED_NON_EXECUTED_SOURCE_LABELS.scientific_competition,
        parentTitle: 'المسابقات العلمية',
        itemTitle: comp.title,
        scheduledDateOrPeriod: comp.startDate || 'غير محدد',
        nonExecutionReason:
          (comp.nonExecutionReason || '').trim() ||
          'لم يُسجّل سبب عدم التنفيذ',
        sourceSectionNumber: 3,
      });
    }
  }

  return items;
}

export function updateGiftedEvaluationSummaryInRecord(
  record: GiftedCoordinatorRecord,
  patch: Partial<GiftedEvaluationSummary>
): GiftedCoordinatorRecord {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    evaluation: {
      strengths:
        patch.strengths !== undefined
          ? patch.strengths
          : record.evaluation.strengths,
      challenges:
        patch.challenges !== undefined
          ? patch.challenges
          : record.evaluation.challenges,
      supportingEntities:
        patch.supportingEntities !== undefined
          ? patch.supportingEntities
          : record.evaluation.supportingEntities,
      improvementProposals:
        patch.improvementProposals !== undefined
          ? patch.improvementProposals
          : record.evaluation.improvementProposals,
    },
  };
}

// ============================================================================
// ١٥. المرحلة التنفيذية الثالثة — القسم العاشر: التقارير النهائية والدورية (٣ نماذج معتمدة)
// ============================================================================

export function updateProgramEventReportOverridesInRecord(
  record: GiftedCoordinatorRecord,
  targetId: string,
  patch: Partial<Omit<GiftedProgramEventReportOverrides, 'targetId'>>
): GiftedCoordinatorRecord {
  const existing = record.programReportsOverrides?.[targetId] || { targetId };
  const merged: GiftedProgramEventReportOverrides = {
    ...existing,
    targetId,
    ...patch,
  };
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    programReportsOverrides: {
      ...(record.programReportsOverrides || {}),
      [targetId]: merged,
    },
  };
}

export function updateInnovationProgressReportOverridesInRecord(
  record: GiftedCoordinatorRecord,
  patch: Partial<GiftedInnovationProgressReportOverrides>
): GiftedCoordinatorRecord {
  const existing = record.innovationProgressReportOverrides || {};
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    innovationProgressReportOverrides: {
      ...existing,
      ...patch,
    },
  };
}

/**
 * ١. نموذج «تقرير برنامج أو فعالية» (مطابق لصفحتي 11 و 24 من PDF المرجعي)
 */
export interface GiftedProgramOrEventReportModel {
  reportType: 'program_or_event';
  sourcePagesLabel: 'صفحة ١١ وصفحة ٢٤ من الدليل المرجعي';
  targetId: string;
  targetCategory: GiftedEvidenceTargetCategory;
  targetCategoryLabel: string;
  basicInfo: ResolvedGiftedBasicInfo;
  // أولاً: معلومات عامة
  generalInfo: {
    eventName: string;
    dayLabel: string;
    executionDate: string;
    durationLabel: string;
  };
  // ثانياً: بيانات عن الفعالية
  eventData: {
    objective: string;
    targetAudience: string;
    executionMechanism: string;
    executedActionsList: string[];
    beneficiariesCount: string;
    difficulties: string;
    suggestions: string;
    showEvidences: boolean;
    selectedPhotos: GiftedEvidencePhotoRef[];
    selectedLinks: GiftedEvidenceLinkItem[];
  };
}

const MINISTERIAL_PROGRAM_CODE_TO_PARTICIPATION_CATEGORY: Partial<
  Record<GiftedMinisterialProgramCode, GiftedParticipationCategory>
> = {
  national_identification: 'national_identification',
  olympiad_research: 'olympiad_research',
  olympiad_scientific: 'olympiad_scientific',
  innovation_space: 'innovation_space',
  acceleration: 'acceleration',
};

export function buildGiftedProgramOrEventReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings,
  targetId: string
): GiftedProgramOrEventReportModel {
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const overrides = record.programReportsOverrides?.[targetId] || { targetId };
  const bundle = getEvidenceBundleForTarget(record, targetId);

  const selectedPhotos = bundle.showEvidencesInReport
    ? bundle.photos.filter((p) => p.selectedForProgramReport)
    : [];
  const selectedLinks = bundle.showEvidencesInReport
    ? bundle.links.filter((l) => l.selectedForProgramReport)
    : [];

  // البحث عن السجل في البرامج الوزارية أو مبادرات المنسق أو المسابقات العلمية
  const ministerial = record.ministerialPrograms.find((p) => p.id === targetId);
  if (ministerial) {
    const standardCount = GIFTED_STANDARD_PROGRAM_ACTIONS[ministerial.code].length;
    const standardActions = ministerial.actions
      .filter((a) => a.isStandard !== false)
      .slice(0, standardCount);
    const executedActions = standardActions.filter((a) => a.status === 'executed');
    const nonExecutedActions = standardActions.filter(
      (a) => a.status === 'not_executed'
    );

    const executedDates = Array.from(
      new Set(
        executedActions
          .map((a) => (a.executionDate || '').trim())
          .filter((d) => d.length > 0)
      )
    );

    const autoDate =
      executedDates.length > 0
        ? executedDates.join(' ، ')
        : ministerial.scheduledPeriod;

    const executedActionsList =
      executedActions.length > 0
        ? executedActions.map((a) => a.actionText)
        : standardActions.map((a) => a.actionText);

    const autoMechanism =
      executedActions.length > 0
        ? executedActions.map((a, idx) => `${idx + 1}. ${a.actionText}`).join('\n')
        : `تنفيذ إجراءات البرنامج المعتمدة (${standardActions.length} إجراءات قياسية).`;

    const partCategory =
      MINISTERIAL_PROGRAM_CODE_TO_PARTICIPATION_CATEGORY[ministerial.code];
    const linkedParticipations = record.studentParticipations.filter(
      (p) =>
        p.linkedProgramOrCompetitionId === ministerial.id ||
        (partCategory && p.category === partCategory)
    );

    const uniqueStudentIds = new Set(linkedParticipations.map((p) => p.studentId));
    const autoBeneficiariesCount =
      uniqueStudentIds.size > 0
        ? `${uniqueStudentIds.size} طالب/ـة`
        : record.students.length > 0
          ? `${record.students.length} طالب/ـة`
          : 'جميع الفئة المستهدفة بالمدرسة';

    const nonExecReasons = nonExecutedActions
      .map((a) => (a.nonExecutionReason || '').trim())
      .filter((r) => r.length > 0);
    const autoDifficulties =
      nonExecReasons.length > 0
        ? nonExecReasons.join(' — ')
        : record.evaluation.challenges.trim() || 'لا توجد صعوبات معيقة للتنفيذ';

    const autoSuggestions =
      record.evaluation.improvementProposals.trim() ||
      'الاستمرار في تفعيل البرنامج وتوثيق الشواهد أولاً بأول';

    return {
      reportType: 'program_or_event',
      sourcePagesLabel: 'صفحة ١١ وصفحة ٢٤ من الدليل المرجعي',
      targetId: ministerial.id,
      targetCategory: 'ministerial_program',
      targetCategoryLabel: GIFTED_EVIDENCE_TARGET_CATEGORY_LABELS.ministerial_program,
      basicInfo,
      generalInfo: {
        eventName: ministerial.title,
        dayLabel:
          overrides.dayLabel?.trim() ||
          ministerial.weekLabel?.trim() ||
          'وفق الخطة الزمنية المعتمدة',
        executionDate: overrides.executionDateOverride?.trim() || autoDate,
        durationLabel:
          overrides.durationLabel?.trim() || ministerial.scheduledPeriod,
      },
      eventData: {
        objective: ministerial.objective,
        targetAudience: `${ministerial.targetAudience} (${ministerial.stageLabel})`,
        executionMechanism:
          overrides.executionMechanismOverride?.trim() || autoMechanism,
        executedActionsList,
        beneficiariesCount:
          overrides.beneficiariesCountOverride?.trim() || autoBeneficiariesCount,
        difficulties:
          overrides.difficultiesOverride?.trim() || autoDifficulties,
        suggestions: overrides.suggestionsOverride?.trim() || autoSuggestions,
        showEvidences:
          bundle.showEvidencesInReport &&
          (selectedPhotos.length > 0 || selectedLinks.length > 0),
        selectedPhotos,
        selectedLinks,
      },
    };
  }

  const initiative = record.customInitiatives.find((i) => i.id === targetId);
  if (initiative) {
    const autoDifficulties =
      initiative.status === 'not_executed' &&
      (initiative.nonExecutionReason || '').trim()
        ? (initiative.nonExecutionReason || '').trim()
        : record.evaluation.challenges.trim() || 'لا توجد صعوبات معيقة للتنفيذ';

    return {
      reportType: 'program_or_event',
      sourcePagesLabel: 'صفحة ١١ وصفحة ٢٤ من الدليل المرجعي',
      targetId: initiative.id,
      targetCategory: 'custom_initiative',
      targetCategoryLabel: `${GIFTED_EVIDENCE_TARGET_CATEGORY_LABELS.custom_initiative} (${initiative.initiativeType})`,
      basicInfo,
      generalInfo: {
        eventName: initiative.title,
        dayLabel:
          overrides.dayLabel?.trim() ||
          initiative.weekLabel?.trim() ||
          'خلال الفصل الدراسي',
        executionDate:
          overrides.executionDateOverride?.trim() ||
          initiative.executionDate ||
          'خلال الفصل الدراسي',
        durationLabel:
          overrides.durationLabel?.trim() ||
          initiative.executionDate ||
          'طوال فترة المبادرة',
      },
      eventData: {
        objective: initiative.objective || 'تنمية مواهب وقدرات الطلبة المتميزين',
        targetAudience: `${initiative.targetAudience} (${initiative.stage})`,
        executionMechanism:
          overrides.executionMechanismOverride?.trim() ||
          initiative.executedTasks ||
          'تنفيذ المهام المعتمدة للمبادرة وتوثيق مخرجاتها',
        executedActionsList: initiative.executedTasks
          ? [initiative.executedTasks]
          : [],
        beneficiariesCount:
          overrides.beneficiariesCountOverride?.trim() ||
          (record.students.length > 0
            ? `${record.students.length} طالب/ـة`
            : 'الفئة المستهدفة بالمدرسة'),
        difficulties:
          overrides.difficultiesOverride?.trim() || autoDifficulties,
        suggestions:
          overrides.suggestionsOverride?.trim() ||
          record.evaluation.improvementProposals.trim() ||
          'التوسع في تطبيق المبادرة وتعميم مخرجاتها',
        showEvidences:
          bundle.showEvidencesInReport &&
          (selectedPhotos.length > 0 || selectedLinks.length > 0),
        selectedPhotos,
        selectedLinks,
      },
    };
  }

  const competition = record.scientificCompetitions.find((c) => c.id === targetId);
  const fallbackTitle = competition?.title || 'برنامج / فعالية للموهوبين';
  const linkedCompParticipations = record.studentParticipations.filter(
    (p) =>
      p.category === 'scientific_competition' &&
      (p.linkedProgramOrCompetitionId === targetId ||
        (competition && p.competitionTitle === competition.title))
  );

  return {
    reportType: 'program_or_event',
    sourcePagesLabel: 'صفحة ١١ وصفحة ٢٤ من الدليل المرجعي',
    targetId,
    targetCategory: 'scientific_competition',
    targetCategoryLabel:
      GIFTED_EVIDENCE_TARGET_CATEGORY_LABELS.scientific_competition,
    basicInfo,
    generalInfo: {
      eventName: fallbackTitle,
      dayLabel:
        overrides.dayLabel?.trim() ||
        competition?.weekLabel?.trim() ||
        'وفق الجدول الزمني للمسابقة',
      executionDate:
        overrides.executionDateOverride?.trim() ||
        competition?.startDate ||
        'وفق الخطة الزمنية',
      durationLabel:
        overrides.durationLabel?.trim() ||
        competition?.startDate ||
        'طوال فترة المسابقة',
    },
    eventData: {
      objective:
        'تحفيز الطلبة الموهوبين والمتفوقين للمشاركة في المسابقات العلمية وتحقيق مراكز متقدمة.',
      targetAudience: competition
        ? `${competition.targetAudience} (${competition.stage})`
        : 'الطلبة الموهوبون',
      executionMechanism:
        overrides.executionMechanismOverride?.trim() ||
        competition?.notes?.trim() ||
        'الإعلان عن المسابقة، ترشيح وتدريب الطلبة، ومتابعة مشاركتهم وتوثيق النتائج.',
      executedActionsList: [
        'الإعلان عن المسابقة العلمية وحصر الطلبة المرشحين.',
        'تهيئة وتدريب الطلبة المشاركين ومتابعة مراحل التأهل.',
      ],
      beneficiariesCount:
        overrides.beneficiariesCountOverride?.trim() ||
        (linkedCompParticipations.length > 0
          ? `${linkedCompParticipations.length} طالب/ـة`
          : 'الطلبة المشاركون بالمسابقة'),
      difficulties:
        overrides.difficultiesOverride?.trim() ||
        (competition?.status === 'not_executed' &&
        (competition.nonExecutionReason || '').trim()
          ? (competition.nonExecutionReason || '').trim()
          : record.evaluation.challenges.trim() || 'لا توجد صعوبات معيقة'),
      suggestions:
        overrides.suggestionsOverride?.trim() ||
        record.evaluation.improvementProposals.trim() ||
        'تكثيف التدريب القبلي للطلبة المشاركين في المسابقات العلمية',
      showEvidences:
        bundle.showEvidencesInReport &&
        (selectedPhotos.length > 0 || selectedLinks.length > 0),
      selectedPhotos,
      selectedLinks,
    },
  };
}

/**
 * ٢. نموذج «التقرير المرحلي لبرنامج مساحة الابتكار» (مطابق لصفحة 21 من PDF المرجعي)
 */
export interface GiftedInnovationSpaceProgressReportModel {
  reportType: 'innovation_space_progress';
  sourcePagesLabel: 'صفحة ٢١ من الدليل المرجعي (التقرير المرحلي لبرنامج مساحة الابتكار)';
  basicData: {
    educationDepartment: string;
    semesterLabel: string;
    schoolName: string;
    principalName: string;
    principalTitle: string;
    educationalStage: string;
    innovationTeacherName: string;
    innovationTeacherTitle: string;
  };
  executionData: {
    enrichmentUnit: string;
    targetGrade: string;
    beneficiariesCount: string;
    outputsCount: string;
    distinguishedOutputsCount: string;
    distinguishedOutputsSummary: string;
    supportingEntities: string;
    strengths: string;
    challenges: string;
    improvementProposals: string;
    executedActionsCount: number;
    totalActionsCount: number;
    showEvidences: boolean;
    selectedPhotos: GiftedEvidencePhotoRef[];
    selectedLinks: GiftedEvidenceLinkItem[];
  };
}

export function buildGiftedInnovationSpaceProgressReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings
): GiftedInnovationSpaceProgressReportModel {
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const isFemale = settings.gender === 'female';
  const ov = record.innovationProgressReportOverrides || {};

  const innovationProg = record.ministerialPrograms.find(
    (p) => p.code === 'innovation_space' || p.id === 'prog-innovation-space'
  );
  const innovationParticipations = resolveStudentParticipationsWithStudentInfo(
    record,
    { category: 'innovation_space' }
  );

  const uniqueUnits = Array.from(
    new Set(
      innovationParticipations
        .map((p) => (p.enrichmentUnit || '').trim())
        .filter((u) => u.length > 0)
    )
  );
  const uniqueGrades = Array.from(
    new Set(
      innovationParticipations
        .map((p) => p.studentGrade.trim())
        .filter((g) => g.length > 0)
    )
  );
  const uniqueStudents = new Set(
    innovationParticipations.map((p) => p.studentId)
  );
  const distinguishedParticipations = innovationParticipations.filter(
    (p) => p.qualifiedToNextStage || (p.achievementText || '').trim().length > 0
  );

  const autoDistinguishedSummary =
    distinguishedParticipations.length > 0
      ? distinguishedParticipations
          .map(
            (p) =>
              `${p.studentName}${p.enrichmentUnit ? ` (${p.enrichmentUnit})` : ''}: ${
                p.achievementText.trim() || 'مخرج ابتكاري متميز'
              }`
          )
          .join(' — ')
      : 'لا توجد بيانات مسجلة';

  const standardActions = innovationProg
    ? innovationProg.actions
        .filter((a) => a.isStandard !== false)
        .slice(0, GIFTED_STANDARD_PROGRAM_ACTIONS.innovation_space.length)
    : [];
  const executedActionsCount = standardActions.filter(
    (a) => a.status === 'executed'
  ).length;

  const bundle = getEvidenceBundleForTarget(record, 'prog-innovation-space');
  const selectedPhotos = bundle.showEvidencesInReport
    ? bundle.photos.filter((p) => p.selectedForProgramReport)
    : [];
  const selectedLinks = bundle.showEvidencesInReport
    ? bundle.links.filter((l) => l.selectedForProgramReport)
    : [];

  return {
    reportType: 'innovation_space_progress',
    sourcePagesLabel:
      'صفحة ٢١ من الدليل المرجعي (التقرير المرحلي لبرنامج مساحة الابتكار)',
    basicData: {
      educationDepartment: basicInfo.educationDepartment,
      semesterLabel: basicInfo.semesterLabel,
      schoolName: basicInfo.schoolName,
      principalName: basicInfo.principalName,
      principalTitle: basicInfo.principalTitle,
      educationalStage:
        innovationProg?.stageLabel || basicInfo.schoolStageLabel,
      innovationTeacherName:
        ov.innovationTeacherName?.trim() || basicInfo.coordinatorName,
      innovationTeacherTitle: isFemale
        ? 'معلمة مساحة الابتكار'
        : 'معلم مساحة الابتكار',
    },
    executionData: {
      enrichmentUnit:
        ov.enrichmentUnitOverride?.trim() ||
        (uniqueUnits.length > 0 ? uniqueUnits.join(' ، ') : 'غير مسجل'),
      targetGrade:
        ov.targetGradeOverride?.trim() ||
        (uniqueGrades.length > 0
          ? uniqueGrades.join(' ، ')
          : innovationProg?.targetAudience || basicInfo.schoolStageLabel),
      beneficiariesCount:
        ov.beneficiariesCountOverride?.trim() ||
        String(uniqueStudents.size || innovationParticipations.length || 0),
      outputsCount:
        ov.outputsCount?.trim() || String(innovationParticipations.length || 0),
      distinguishedOutputsCount:
        ov.distinguishedOutputsCount?.trim() ||
        String(distinguishedParticipations.length || 0),
      distinguishedOutputsSummary:
        ov.distinguishedOutputsSummary?.trim() || autoDistinguishedSummary,
      supportingEntities:
        ov.supportingEntitiesOverride?.trim() ||
        record.evaluation.supportingEntities.trim() ||
        'غير مسجل',
      strengths:
        ov.strengthsOverride?.trim() ||
        record.evaluation.strengths.trim() ||
        'غير مسجل',
      challenges:
        ov.challengesOverride?.trim() ||
        record.evaluation.challenges.trim() ||
        'غير مسجل',
      improvementProposals:
        ov.improvementProposalsOverride?.trim() ||
        record.evaluation.improvementProposals.trim() ||
        'غير مسجل',
      executedActionsCount,
      totalActionsCount: standardActions.length || 10,
      showEvidences:
        bundle.showEvidencesInReport &&
        (selectedPhotos.length > 0 || selectedLinks.length > 0),
      selectedPhotos,
      selectedLinks,
    },
  };
}

/**
 * ٣. نموذج «التقرير الإداري الختامي المختصر والشامل» (مختصر افتراضياً مع خيار تضمين التفاصيل دون تكرار)
 */
export type GiftedFinalRecordReportMode = 'concise' | 'detailed';

export interface GiftedFinalReportEvidenceGroup {
  targetId: string;
  targetTitle: string;
  targetCategoryLabel: string;
  photos: GiftedEvidencePhotoRef[];
  links: GiftedEvidenceLinkItem[];
}

export interface GiftedFinalRecordReportModel {
  reportType: 'final_administrative_record';
  mode: GiftedFinalRecordReportMode;
  generatedAt: string;
  basicInfo: ResolvedGiftedBasicInfo;
  completionMetrics: GiftedCompletionMetricsReport;
  studentsSummary: GiftedStudentsAndAchievementsSummary;
  executivePlanItems: GiftedExecutivePlanItem[];
  applicablePrograms: Array<{
    id: string;
    code: GiftedMinisterialProgramCode;
    title: string;
    stageLabel: string;
    targetAudience: string;
    scheduledPeriod: string;
    executedCount: number;
    pendingCount: number;
    notExecutedCount: number;
    totalCount: number;
    completionPercentage: number;
    executedActionsTexts: string[];
  }>;
  customInitiatives: GiftedCustomInitiativeItem[];
  scientificCompetitions: GiftedScientificCompetitionItem[];
  students: GiftedStudentRecord[];
  resolvedParticipations: GiftedResolvedStudentParticipation[];
  qualifiedParticipations: GiftedResolvedStudentParticipation[];
  selectedEvidenceGroups: GiftedFinalReportEvidenceGroup[];
  nonExecutedItems: GiftedNonExecutedItemSummary[];
  evaluation: GiftedEvaluationSummary;
}

export function buildGiftedFinalRecordReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings,
  options?: { mode?: GiftedFinalRecordReportMode }
): GiftedFinalRecordReportModel {
  const mode: GiftedFinalRecordReportMode = options?.mode || 'concise';
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const completionMetrics = computeGiftedCompletionMetrics(record);
  const studentsSummary = computeGiftedStudentsAndAchievementsSummary(record);
  const resolvedParticipations = resolveStudentParticipationsWithStudentInfo(record);
  const qualifiedParticipations = resolvedParticipations.filter(
    (p) => p.qualifiedToNextStage
  );
  const nonExecutedItems = getGiftedNonExecutedItemsSummary(record);

  const nonApplicableIds = new Set(
    record.ministerialPrograms
      .filter((p) => !p.applicableToSchool)
      .map((p) => p.id)
  );
  const activeExecutivePlanItems = record.executivePlan.filter(
    (item) => !item.linkedProgramId || !nonApplicableIds.has(item.linkedProgramId)
  );

  const applicablePrograms = record.ministerialPrograms
    .filter((p) => p.applicableToSchool)
    .map((prog) => {
      const standardCount = GIFTED_STANDARD_PROGRAM_ACTIONS[prog.code].length;
      const stdActions = prog.actions
        .filter((a) => a.isStandard !== false)
        .slice(0, standardCount);
      const bd = computeBreakdownFromStatuses(stdActions.map((a) => a.status));
      const executedActionsTexts = stdActions
        .filter((a) => a.status === 'executed')
        .map((a) => a.actionText);

      return {
        id: prog.id,
        code: prog.code,
        title: prog.title,
        stageLabel: prog.stageLabel,
        targetAudience: prog.targetAudience,
        scheduledPeriod: prog.scheduledPeriod,
        executedCount: bd.executed,
        pendingCount: bd.pending,
        notExecutedCount: bd.notExecuted,
        totalCount: bd.totalActive,
        completionPercentage: bd.completionPercentage,
        executedActionsTexts,
      };
    });

  // تجميع الشواهد المختارة فقط للتقرير الختامي (showEvidencesInReport && selectedForFinalRecord)
  const targetsCatalog = getGiftedEvidenceTargetsCatalog(record);
  const selectedEvidenceGroups: GiftedFinalReportEvidenceGroup[] = [];

  for (const target of targetsCatalog) {
    if (!target.applicableToSchool) continue;
    const bundle = getEvidenceBundleForTarget(record, target.targetId);
    if (!bundle.showEvidencesInReport) continue;

    const photos = bundle.photos.filter((p) => p.selectedForFinalRecord);
    const links = bundle.links.filter((l) => l.selectedForFinalRecord);

    if (photos.length > 0 || links.length > 0) {
      selectedEvidenceGroups.push({
        targetId: target.targetId,
        targetTitle: target.title,
        targetCategoryLabel: target.categoryLabel,
        photos,
        links,
      });
    }
  }

  return {
    reportType: 'final_administrative_record',
    mode,
    generatedAt: new Date().toISOString(),
    basicInfo,
    completionMetrics,
    studentsSummary,
    executivePlanItems: activeExecutivePlanItems,
    applicablePrograms,
    customInitiatives: record.customInitiatives,
    scientificCompetitions: record.scientificCompetitions,
    students: record.students,
    resolvedParticipations,
    qualifiedParticipations,
    selectedEvidenceGroups,
    nonExecutedItems,
    evaluation: record.evaluation,
  };
}

// ============================================================================
// ١٦. المرحلة الثانية: محرك التقارير الذكي المتكامل (Engine 04 — التقارير)
// يقرأ مباشرة من المحركات الثلاثة الأولى (الطلاب، البرامج، أعمال المنسق)
// دون إعادة إدخال البيانات، ودون اختراع نصوص بديلة عند غياب الحقول ("غير مسجل")،
// مع فصل حالة البرنامج عن نسبة إكمال الإجراءات، وتضمين شواهد الجيل النشط فقط.
// ============================================================================

export type GiftedReportsEngineTabId =
  | 'program_report'
  | 'periodic_report'
  | 'final_report'
  | 'statistical_report'
  | 'additional_templates';

export const GIFTED_UNRECORDED_LABEL = 'غير مسجل';
export const GIFTED_STATUS_LABELS = GIFTED_EXECUTION_STATUS_LABELS;

export interface GiftedReportEvidenceFilterOptions {
  availableAttachments?: GiftedAttachmentRecord[];
  selectionMode?: 'program' | 'final';
}

/**
 * يصفي الشواهد المصورة للتقارير بحيث:
 * 1. يلتزم باختيار المنسق (selectedForProgramReport أو selectedForFinalRecord)
 * 2. يستبعد أي مرفق يتيم غير مرتبط بالسجل النشط
 * 3. يستخدم مرفقات الجيل النشط فقط (activeRestoreGenId / activeAttachmentBlobKeys)
 */
export function filterValidActiveGenerationPhotosForReport(
  record: GiftedCoordinatorRecord,
  photos: GiftedEvidencePhotoRef[],
  options?: GiftedReportEvidenceFilterOptions
): GiftedEvidencePhotoRef[] {
  const mode = options?.selectionMode || 'program';
  const activeGenId = record.activeRestoreGenId?.trim() || null;
  const referencedKeys = getReferencedBlobKeysInRecord(record);
  const explicitActiveKeys = Array.isArray(record.activeAttachmentBlobKeys)
    ? new Set(
        record.activeAttachmentBlobKeys
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter(Boolean)
      )
    : null;

  let validRepoKeys: Set<string> | null = null;
  if (Array.isArray(options?.availableAttachments)) {
    const activeAttachments = getActiveGenerationAttachmentsForRecord(
      record,
      options.availableAttachments
    );
    validRepoKeys = new Set(
      activeAttachments
        .filter((att) => att.bytes && att.bytes.length > 0)
        .map((att) => att.blobKey.trim())
    );
  }

  return (photos || []).filter((photo) => {
    if (!photo || typeof photo.blobKey !== 'string') return false;
    const key = photo.blobKey.trim();
    if (!key) return false;

    const isSelected =
      mode === 'final'
        ? photo.selectedForFinalRecord !== false
        : photo.selectedForProgramReport !== false;
    if (!isSelected) return false;

    if (!referencedKeys.has(key)) {
      return false;
    }

    if (explicitActiveKeys && !explicitActiveKeys.has(key)) {
      return false;
    }

    const keyGenId = extractRestoreGenIdFromBlobKey(key);
    if (activeGenId !== null) {
      if (keyGenId !== null && keyGenId !== activeGenId) {
        return false;
      }
      if (
        keyGenId === null &&
        explicitActiveKeys &&
        !explicitActiveKeys.has(key)
      ) {
        return false;
      }
    } else if (keyGenId !== null && explicitActiveKeys && !explicitActiveKeys.has(key)) {
      return false;
    }

    if (validRepoKeys !== null && !validRepoKeys.has(key)) {
      return false;
    }

    return true;
  });
}

function resolveCombinedEvidenceBundleForProgram(
  record: GiftedCoordinatorRecord,
  template: GiftedProgramTemplateRecord,
  execution: GiftedProgramExecutionSnapshotRecord
): GiftedProgramEvidenceBundle {
  const candidateKeys = Array.from(
    new Set(
      [
        execution.evidenceBundleTargetId,
        template.linkedProgramId,
        template.id,
        execution.legacySourceId,
      ]
        .map((k) => (k || '').trim())
        .filter(Boolean)
    )
  );

  let showEvidencesInReport = true;
  const photosMap = new Map<string, GiftedEvidencePhotoRef>();
  const linksMap = new Map<string, GiftedEvidenceLinkItem>();

  for (const key of candidateKeys) {
    const rawBundle = record.evidenceBundles?.[key];
    if (!rawBundle) continue;
    if (rawBundle.showEvidencesInReport === false) {
      showEvidencesInReport = false;
    }
    for (const p of rawBundle.photos || []) {
      if (p && p.blobKey && !photosMap.has(p.blobKey)) {
        photosMap.set(p.blobKey, p);
      }
    }
    for (const l of rawBundle.links || []) {
      if (l && l.url && !linksMap.has(l.url)) {
        linksMap.set(l.url, l);
      }
    }
  }

  return {
    targetId: candidateKeys[0] || template.id,
    showEvidencesInReport,
    photos: Array.from(photosMap.values()).slice(0, MAX_GIFTED_EVIDENCE_PHOTOS),
    links: Array.from(linksMap.values()).slice(0, MAX_GIFTED_EVIDENCE_LINKS),
  };
}

export interface GiftedProgramReportParticipantRow {
  studentId: string;
  studentName: string;
  historicalGrade: string;
  historicalClassification: GiftedClassificationLevel;
  historicalClassificationLabel: string;
  resultOrScore: string;
  achievementText: string;
  qualifiedToNextStage: boolean;
}

export interface GiftedProgramReportActionRow {
  id: string;
  order: number;
  actionText: string;
  completed: boolean;
  statusLabel: string;
}

export interface GiftedUnifiedProgramReportModel {
  reportType: 'unified_program_report';
  generatedAt: string;
  templateId: string;
  targetId: string;
  basicInfo: ResolvedGiftedBasicInfo;
  programTitle: string;
  category: GiftedProgramTemplateCategory;
  categoryLabel: string;
  objective: string;
  targetAudience: string;
  stageLabel: string;
  executionDate: string;
  executionStartDateRaw: string;
  executionHijriDate: string;
  selectedWeeks: string[];
  weekLabel: string;
  executionStatus: GiftedExecutionStatus;
  executionStatusLabel: string;
  completedActionsCount: number;
  totalActionsCount: number;
  actionCompletionPercentage: number;
  participatingStudents: GiftedProgramReportParticipantRow[];
  participatingStudentsCount: number;
  actionsList: GiftedProgramReportActionRow[];
  results: string;
  achievementsOrOutputs: string;
  notes: string;
  challenges: string;
  recommendations: string;
  showEvidences: boolean;
  selectedPhotos: GiftedEvidencePhotoRef[];
  selectedLinks: GiftedEvidenceLinkItem[];
}

/**
 * [01] بناء نموذج «تقرير برنامج» مباشرة من بيانات المحركين 01 و02
 * دون إعادة إدخال بيانات ودون اختراع نصوص افتراضية عند غياب الحقول ("غير مسجل").
 */
export function buildGiftedUnifiedProgramReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings,
  templateOrTargetId: string,
  options?: {
    availableAttachments?: GiftedAttachmentRecord[];
  }
): GiftedUnifiedProgramReportModel {
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const allTemplates = getGiftedProgramTemplatesFromRecord(record);
  const cleanTarget = (templateOrTargetId || '').trim();

  const matchedTemplate =
    allTemplates.find(
      (t) =>
        t.id === cleanTarget ||
        (t.linkedProgramId && t.linkedProgramId === cleanTarget)
    ) || allTemplates[0];

  if (!matchedTemplate) {
    return {
      reportType: 'unified_program_report',
      generatedAt: new Date().toISOString(),
      templateId: cleanTarget || 'unknown',
      targetId: cleanTarget || 'unknown',
      basicInfo,
      programTitle: GIFTED_UNRECORDED_LABEL,
      category: 'ministerial',
      categoryLabel: GIFTED_UNRECORDED_LABEL,
      objective: GIFTED_UNRECORDED_LABEL,
      targetAudience: GIFTED_UNRECORDED_LABEL,
      stageLabel: GIFTED_UNRECORDED_LABEL,
      executionDate: GIFTED_UNRECORDED_LABEL,
      executionStartDateRaw: '',
      executionHijriDate: '',
      selectedWeeks: [],
      weekLabel: GIFTED_UNRECORDED_LABEL,
      executionStatus: 'pending',
      executionStatusLabel: GIFTED_STATUS_LABELS.pending,
      completedActionsCount: 0,
      totalActionsCount: 0,
      actionCompletionPercentage: 0,
      participatingStudents: [],
      participatingStudentsCount: 0,
      actionsList: [],
      results: GIFTED_UNRECORDED_LABEL,
      achievementsOrOutputs: GIFTED_UNRECORDED_LABEL,
      notes: GIFTED_UNRECORDED_LABEL,
      challenges: GIFTED_UNRECORDED_LABEL,
      recommendations: GIFTED_UNRECORDED_LABEL,
      showEvidences: false,
      selectedPhotos: [],
      selectedLinks: [],
    };
  }

  const exec = getOrCreateExecutionForProgramTemplate(
    record,
    matchedTemplate.id
  );
  const targetSourceId =
    matchedTemplate.linkedProgramId ||
    exec.legacySourceId ||
    exec.evidenceBundleTargetId ||
    matchedTemplate.id;

  const actionsList: GiftedProgramReportActionRow[] = (
    exec.actionsSnapshot || []
  ).map((act, idx) => ({
    id: act.id || `act-${idx + 1}`,
    order: act.order || idx + 1,
    actionText: (act.actionText || '').trim() || GIFTED_UNRECORDED_LABEL,
    completed: Boolean(act.completed),
    statusLabel: act.completed ? 'مكتمل' : 'غير مكتمل',
  }));

  const totalActionsCount = actionsList.length;
  const completedActionsCount = actionsList.filter((a) => a.completed).length;
  const actionCompletionPercentage =
    totalActionsCount > 0
      ? Math.round((completedActionsCount / totalActionsCount) * 100)
      : 0;

  const executionStatus: GiftedExecutionStatus = exec.status || 'pending';
  const executionStatusLabel = GIFTED_STATUS_LABELS[executionStatus];

  const startRaw = (exec.executionStartDate || '').trim();
  const hijriRaw =
    (exec.executionHijriDate || '').trim() ||
    (startRaw ? formatGregorianToHijriDate(startRaw) : '');
  const executionDate = startRaw
    ? hijriRaw
      ? `${startRaw} (${hijriRaw})`
      : startRaw
    : GIFTED_UNRECORDED_LABEL;

  const selectedWeeks = Array.isArray(exec.selectedWeeks)
    ? exec.selectedWeeks.filter(Boolean)
    : [];
  const weekLabel =
    selectedWeeks.length > 0
      ? selectedWeeks.join('، ')
      : GIFTED_UNRECORDED_LABEL;

  // استخراج الطلاب المشاركين فعلياً في هذا البرنامج (من participatingStudentIds ومن studentParticipations المرتبطة)
  const linkedParticipations = record.studentParticipations.filter(
    (p) =>
      p.linkedProgramOrCompetitionId === matchedTemplate.id ||
      p.linkedProgramOrCompetitionId === targetSourceId ||
      (p.executionId && p.executionId === exec.id)
  );

  const uniqueStudentIds = Array.from(
    new Set([
      ...(exec.participatingStudentIds || []),
      ...linkedParticipations.map((p) => p.studentId),
    ])
  );

  const studentMap = new Map(record.students.map((s) => [s.id, s]));
  const participatingStudents: GiftedProgramReportParticipantRow[] = [];

  for (const stuId of uniqueStudentIds) {
    const stu = studentMap.get(stuId);
    if (!stu) continue;
    const part = linkedParticipations.find((p) => p.studentId === stuId);
    const historicalGrade =
      normalizeGiftedGradeLabel(
        (part?.studentGradeAtParticipation || '').trim() ||
          (stu.grade || '').trim()
      ) || GIFTED_UNRECORDED_LABEL;
    const historicalClassification: GiftedClassificationLevel =
      part?.studentClassificationAtParticipation ||
      stu.classification ||
      'gifted';
    const resultOrScore =
      (part?.classificationResult || '').trim() ||
      (part?.score || '').trim() ||
      GIFTED_UNRECORDED_LABEL;
    const achievementText =
      (part?.achievementText || '').trim() || GIFTED_UNRECORDED_LABEL;

    participatingStudents.push({
      studentId: stu.id,
      studentName: stu.name,
      historicalGrade,
      historicalClassification,
      historicalClassificationLabel:
        GIFTED_CLASSIFICATION_LABELS[historicalClassification],
      resultOrScore,
      achievementText,
      qualifiedToNextStage: Boolean(part?.qualifiedToNextStage),
    });
  }

  const recordedAchievements = participatingStudents
    .filter(
      (p) =>
        p.qualifiedToNextStage ||
        (p.achievementText && p.achievementText !== GIFTED_UNRECORDED_LABEL)
    )
    .map((p) => {
      const parts: string[] = [p.studentName];
      if (p.qualifiedToNextStage) parts.push('متأهل للمرحلة التالية');
      if (p.achievementText && p.achievementText !== GIFTED_UNRECORDED_LABEL) {
        parts.push(p.achievementText);
      }
      return parts.join(' — ');
    });

  const achievementsOrOutputs =
    recordedAchievements.length > 0
      ? recordedAchievements.join(' | ')
      : GIFTED_UNRECORDED_LABEL;

  const cleanResults = (exec.resultsSummary || '').trim();
  const results = cleanResults || GIFTED_UNRECORDED_LABEL;

  const cleanNotes = (exec.notes || '').trim();
  const notes = cleanNotes || GIFTED_UNRECORDED_LABEL;

  const cleanChallenges =
    (exec.challenges || '').trim() ||
    (executionStatus === 'not_executed'
      ? (exec.nonExecutionReason || '').trim()
      : '');
  const challenges = cleanChallenges || GIFTED_UNRECORDED_LABEL;

  const cleanRecommendations = (exec.recommendations || '').trim();
  const recommendations = cleanRecommendations || GIFTED_UNRECORDED_LABEL;

  const bundle = resolveCombinedEvidenceBundleForProgram(
    record,
    matchedTemplate,
    exec
  );
  const selectedPhotos = bundle.showEvidencesInReport
    ? filterValidActiveGenerationPhotosForReport(record, bundle.photos, {
        availableAttachments: options?.availableAttachments,
        selectionMode: 'program',
      })
    : [];
  const selectedLinks = bundle.showEvidencesInReport
    ? (bundle.links || []).filter((l) => l.selectedForProgramReport !== false)
    : [];

  return {
    reportType: 'unified_program_report',
    generatedAt: new Date().toISOString(),
    templateId: matchedTemplate.id,
    targetId: targetSourceId,
    basicInfo,
    programTitle:
      matchedTemplate.title.trim() ||
      exec.templateTitleSnapshot.trim() ||
      GIFTED_UNRECORDED_LABEL,
    category: matchedTemplate.category,
    categoryLabel:
      GIFTED_PROGRAM_TEMPLATE_CATEGORY_LABELS[matchedTemplate.category] ||
      GIFTED_UNRECORDED_LABEL,
    objective:
      matchedTemplate.objectives.trim() ||
      exec.objectivesSnapshot.trim() ||
      GIFTED_UNRECORDED_LABEL,
    targetAudience:
      matchedTemplate.targetAudience.trim() ||
      exec.targetAudienceSnapshot.trim() ||
      GIFTED_UNRECORDED_LABEL,
    stageLabel:
      matchedTemplate.stageLabel.trim() ||
      exec.stageLabelSnapshot.trim() ||
      GIFTED_UNRECORDED_LABEL,
    executionDate,
    executionStartDateRaw: startRaw,
    executionHijriDate: hijriRaw,
    selectedWeeks,
    weekLabel,
    executionStatus,
    executionStatusLabel,
    completedActionsCount,
    totalActionsCount,
    actionCompletionPercentage,
    participatingStudents,
    participatingStudentsCount: participatingStudents.length,
    actionsList,
    results,
    achievementsOrOutputs,
    notes,
    challenges,
    recommendations,
    showEvidences:
      bundle.showEvidencesInReport &&
      (selectedPhotos.length > 0 || selectedLinks.length > 0),
    selectedPhotos,
    selectedLinks,
  };
}

export type GiftedPeriodicFilterMode =
  | 'all'
  | 'semester'
  | 'weeks'
  | 'date_range';

export interface GiftedPeriodicReportFilterOptions {
  filterMode?: GiftedPeriodicFilterMode;
  semester?: GiftedSemester;
  selectedWeeks?: string[];
  startDate?: string;
  endDate?: string;
}

export interface GiftedPeriodicProgramSummaryItem {
  templateId: string;
  targetId: string;
  title: string;
  category: GiftedProgramTemplateCategory;
  categoryLabel: string;
  executionStatus: GiftedExecutionStatus;
  executionStatusLabel: string;
  completedActionsCount: number;
  totalActionsCount: number;
  actionCompletionPercentage: number;
  executionDate: string;
  weekLabel: string;
  participatingStudentsCount: number;
  results: string;
  challenges: string;
  recommendations: string;
}

export interface GiftedPeriodicReportModel {
  reportType: 'periodic_report';
  generatedAt: string;
  periodLabel: string;
  filterMode: GiftedPeriodicFilterMode;
  basicInfo: ResolvedGiftedBasicInfo;
  totalProgramsCount: number;
  executedProgramsCount: number;
  pendingProgramsCount: number;
  notExecutedProgramsCount: number;
  programCompletionPercentage: number;
  completedActionsCount: number;
  totalActionsCount: number;
  actionCompletionPercentage: number;
  beneficiaryStudentsCount: number;
  participationsCount: number;
  achievementsCount: number;
  coordinatorWorksCount: number;
  coordinatorWorks: GiftedCoordinatorAdditionalWorkItem[];
  coordinatorWorksText: string;
  programsSummaryRows: GiftedPeriodicProgramSummaryItem[];
  topProgramsText: string;
  topResultsList: string[];
  topResultsText: string;
  topChallengesList: string[];
  topChallengesText: string;
  recommendationsList: string[];
  recommendationsText: string;
}

/**
 * [02] بناء نموذج «التقرير الدوري» لفترة محددة (الفصل الدراسي / أسابيع محددة / نطاق تاريخ)
 * يجمع تلقائياً من البرامج المنفذة وقيد التنفيذ وغير المنفذة والطلاب وأعمال المنسق.
 */
export function buildGiftedPeriodicReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings,
  filter?: GiftedPeriodicReportFilterOptions
): GiftedPeriodicReportModel {
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const filterMode: GiftedPeriodicFilterMode = filter?.filterMode || 'all';
  const targetSemester = filter?.semester || record.basicInfo.semester;
  const filterWeeksSet = new Set(
    (filter?.selectedWeeks || []).map((w) => w.trim()).filter(Boolean)
  );
  const startDate = (filter?.startDate || '').trim();
  const endDate = (filter?.endDate || '').trim();

  let periodLabel = `${basicInfo.semesterLabel} — ${basicInfo.academicYear}`;
  if (filterMode === 'semester') {
    periodLabel = `${GIFTED_SEMESTER_LABELS[targetSemester]} — ${basicInfo.academicYear}`;
  } else if (filterMode === 'weeks' && filterWeeksSet.size > 0) {
    periodLabel = `الأسابيع المحددة (${Array.from(filterWeeksSet).join('، ')})`;
  } else if (filterMode === 'date_range' && (startDate || endDate)) {
    periodLabel = `الفترة من ${startDate || 'بداية الفصل'} إلى ${endDate || 'نهاية الفصل'}`;
  }

  const activeTemplates = getGiftedProgramTemplatesFromRecord(record).filter(
    (t) => t.isActive
  );

  const matchesDateRange = (isoDate: string): boolean => {
    const clean = (isoDate || '').trim();
    if (!clean) return false;
    if (startDate && clean < startDate) return false;
    if (endDate && clean > endDate) return false;
    return true;
  };

  const matchedProgramModels: GiftedUnifiedProgramReportModel[] = [];

  for (const tpl of activeTemplates) {
    const progModel = buildGiftedUnifiedProgramReportModel(
      record,
      settings,
      tpl.id
    );

    if (filterMode === 'weeks' && filterWeeksSet.size > 0) {
      const hasMatchingWeek = progModel.selectedWeeks.some((w) =>
        filterWeeksSet.has(w)
      );
      if (!hasMatchingWeek) continue;
    } else if (filterMode === 'date_range' && (startDate || endDate)) {
      if (!matchesDateRange(progModel.executionStartDateRaw)) continue;
    } else if (
      filterMode === 'semester' &&
      targetSemester !== 'full_year' &&
      record.basicInfo.semester !== 'full_year' &&
      targetSemester !== record.basicInfo.semester
    ) {
      // إذا اختار فصلاً دراسياً مختلفاً عن فصل السجل الأساسي نتحقق من البرامج المرتبطة بذلك الفصل فقط
      const linkedMin = record.ministerialPrograms.find(
        (m) => m.id === progModel.targetId
      );
      const linkedComp = record.scientificCompetitions.find(
        (c) => c.id === progModel.targetId
      );
      const linkedInit = record.customInitiatives.find(
        (i) => i.id === progModel.targetId
      );
      const itemSem =
        linkedMin?.semester || linkedComp?.semester || linkedInit?.semester;
      if (itemSem && itemSem !== 'full_year' && itemSem !== targetSemester) {
        continue;
      }
    }

    matchedProgramModels.push(progModel);
  }

  const totalProgramsCount = matchedProgramModels.length;
  let executedProgramsCount = 0;
  let pendingProgramsCount = 0;
  let notExecutedProgramsCount = 0;
  let completedActionsCount = 0;
  let totalActionsCount = 0;

  const uniqueBeneficiaryIds = new Set<string>();
  const matchedTemplateIds = new Set<string>();
  const matchedTargetIds = new Set<string>();
  const topResultsList: string[] = [];
  const topChallengesList: string[] = [];
  const recommendationsList: string[] = [];

  const programsSummaryRows: GiftedPeriodicProgramSummaryItem[] =
    matchedProgramModels.map((pm) => {
      if (pm.executionStatus === 'executed') executedProgramsCount += 1;
      else if (pm.executionStatus === 'not_executed')
        notExecutedProgramsCount += 1;
      else pendingProgramsCount += 1;

      completedActionsCount += pm.completedActionsCount;
      totalActionsCount += pm.totalActionsCount;

      matchedTemplateIds.add(pm.templateId);
      matchedTargetIds.add(pm.targetId);

      for (const stu of pm.participatingStudents) {
        uniqueBeneficiaryIds.add(stu.studentId);
      }

      if (pm.results !== GIFTED_UNRECORDED_LABEL) {
        topResultsList.push(`${pm.programTitle}: ${pm.results}`);
      }
      if (pm.challenges !== GIFTED_UNRECORDED_LABEL) {
        topChallengesList.push(`${pm.programTitle}: ${pm.challenges}`);
      }
      if (pm.recommendations !== GIFTED_UNRECORDED_LABEL) {
        recommendationsList.push(`${pm.programTitle}: ${pm.recommendations}`);
      }

      return {
        templateId: pm.templateId,
        targetId: pm.targetId,
        title: pm.programTitle,
        category: pm.category,
        categoryLabel: pm.categoryLabel,
        executionStatus: pm.executionStatus,
        executionStatusLabel: pm.executionStatusLabel,
        completedActionsCount: pm.completedActionsCount,
        totalActionsCount: pm.totalActionsCount,
        actionCompletionPercentage: pm.actionCompletionPercentage,
        executionDate: pm.executionDate,
        weekLabel: pm.weekLabel,
        participatingStudentsCount: pm.participatingStudentsCount,
        results: pm.results,
        challenges: pm.challenges,
        recommendations: pm.recommendations,
      };
    });

  const programCompletionPercentage =
    totalProgramsCount > 0
      ? Math.round((executedProgramsCount / totalProgramsCount) * 100)
      : 0;
  const actionCompletionPercentage =
    totalActionsCount > 0
      ? Math.round((completedActionsCount / totalActionsCount) * 100)
      : 0;

  // المشاركات والإنجازات المرتبطة بالبرامج المشمولة في الفترة
  const validStudentIds = new Set(record.students.map((s) => s.id));
  const matchedParticipations = record.studentParticipations.filter((part) => {
    if (!validStudentIds.has(part.studentId)) return false;
    if (filterMode === 'date_range' && (startDate || endDate)) {
      if (part.participationDate && matchesDateRange(part.participationDate)) {
        return true;
      }
      return Boolean(
        part.linkedProgramOrCompetitionId &&
          (matchedTargetIds.has(part.linkedProgramOrCompetitionId) ||
            matchedTemplateIds.has(part.linkedProgramOrCompetitionId))
      );
    }
    if (filterMode === 'weeks' && filterWeeksSet.size > 0) {
      return Boolean(
        part.linkedProgramOrCompetitionId &&
          (matchedTargetIds.has(part.linkedProgramOrCompetitionId) ||
            matchedTemplateIds.has(part.linkedProgramOrCompetitionId))
      );
    }
    if (part.linkedProgramOrCompetitionId) {
      return (
        matchedTargetIds.has(part.linkedProgramOrCompetitionId) ||
        matchedTemplateIds.has(part.linkedProgramOrCompetitionId)
      );
    }
    return filterMode === 'all' || filterMode === 'semester';
  });

  for (const part of matchedParticipations) {
    uniqueBeneficiaryIds.add(part.studentId);
  }

  const participationsCount = matchedParticipations.length;
  const achievementsCount = matchedParticipations.filter(
    (p) => p.qualifiedToNextStage || (p.achievementText || '').trim().length > 0
  ).length;

  // أعمال المنسق خلال الفترة
  const allCoordinatorWorks = record.coordinatorAdditionalWorks || [];
  const coordinatorWorks = allCoordinatorWorks.filter((w) => {
    if (filterMode === 'weeks' && filterWeeksSet.size > 0) {
      return Boolean(w.weekLabel && filterWeeksSet.has(w.weekLabel));
    }
    if (filterMode === 'date_range' && (startDate || endDate)) {
      return matchesDateRange(w.executionDate);
    }
    return true;
  });

  for (const w of coordinatorWorks) {
    if (w.notesAndRecommendations && w.notesAndRecommendations.trim()) {
      const kindLabel = GIFTED_COORDINATOR_WORK_KIND_LABELS[w.workKind];
      recommendationsList.push(
        `${kindLabel} (${w.summary}): ${w.notesAndRecommendations.trim()}`
      );
    }
  }

  const coordinatorWorksText =
    coordinatorWorks.length > 0
      ? coordinatorWorks
          .map((w, idx) => {
            const kindLabel = GIFTED_COORDINATOR_WORK_KIND_LABELS[w.workKind];
            const datePart = w.executionDate
              ? w.hijriDate
                ? `${w.executionDate} (${w.hijriDate})`
                : w.executionDate
              : w.weekLabel || '';
            const notesPart = w.notesAndRecommendations?.trim()
              ? ` — ملاحظات وتوصيات: ${w.notesAndRecommendations.trim()}`
              : '';
            return `${idx + 1}. [${kindLabel}] ${w.summary}${datePart ? ` — ${datePart}` : ''}${notesPart}`;
          })
          .join('\n')
      : GIFTED_UNRECORDED_LABEL;

  const topProgramsText =
    programsSummaryRows.length > 0
      ? programsSummaryRows
          .map(
            (r, idx) =>
              `${idx + 1}. ${r.title} (${r.executionStatusLabel} — استيفاء الإجراءات: ${r.actionCompletionPercentage}%)`
          )
          .join('\n')
      : GIFTED_UNRECORDED_LABEL;

  return {
    reportType: 'periodic_report',
    generatedAt: new Date().toISOString(),
    periodLabel,
    filterMode,
    basicInfo,
    totalProgramsCount,
    executedProgramsCount,
    pendingProgramsCount,
    notExecutedProgramsCount,
    programCompletionPercentage,
    completedActionsCount,
    totalActionsCount,
    actionCompletionPercentage,
    beneficiaryStudentsCount: uniqueBeneficiaryIds.size,
    participationsCount,
    achievementsCount,
    coordinatorWorksCount: coordinatorWorks.length,
    coordinatorWorks,
    coordinatorWorksText,
    programsSummaryRows,
    topProgramsText,
    topResultsList,
    topResultsText:
      topResultsList.length > 0
        ? topResultsList.join('\n')
        : GIFTED_UNRECORDED_LABEL,
    topChallengesList,
    topChallengesText:
      topChallengesList.length > 0
        ? topChallengesList.join('\n')
        : GIFTED_UNRECORDED_LABEL,
    recommendationsList,
    recommendationsText:
      recommendationsList.length > 0
        ? recommendationsList.join('\n')
        : GIFTED_UNRECORDED_LABEL,
  };
}

export interface GiftedComprehensiveFinalReportCoverPage {
  ministryHeader: string;
  educationDepartment: string;
  schoolName: string;
  recordTitle: string;
  academicYear: string;
  semesterLabel: string;
  coordinatorTitle: string;
  coordinatorName: string;
  principalTitle: string;
  principalName: string;
}

export interface GiftedComprehensiveFinalReportModel {
  reportType: 'comprehensive_final_report';
  generatedAt: string;
  includeEvidences: boolean;
  basicInfo: ResolvedGiftedBasicInfo;
  coverPage: GiftedComprehensiveFinalReportCoverPage;
  executiveSummaryText: string;
  programStats: {
    totalActivePrograms: number;
    executedCount: number;
    pendingCount: number;
    notExecutedCount: number;
    programCompletionPercentage: number;
    completedActionsCount: number;
    totalActionsCount: number;
    actionCompletionPercentage: number;
  };
  studentStats: {
    totalStudents: number;
    exceptionalGiftedCount: number;
    giftedCount: number;
    promisingCount: number;
    uniqueBeneficiaryStudentsCount: number;
  };
  participationsAndAchievements: {
    totalParticipations: number;
    qualifiedStudentsCount: number;
    documentedAchievementsCount: number;
    achievementsList: string[];
    achievementsText: string;
  };
  coordinatorWorks: GiftedCoordinatorAdditionalWorkItem[];
  coordinatorWorksText: string;
  executionIndicators: GiftedPeriodicProgramSummaryItem[];
  keyProgramsText: string;
  keyResultsText: string;
  challengesText: string;
  recommendationsText: string;
  supportingEntitiesText: string;
  selectedEvidenceGroups: GiftedFinalReportEvidenceGroup[];
  conclusionText: string;
}

/**
 * [03] بناء نموذج «التقرير النهائي» الشامل والمنظم مع بيانات صفحة الغلاف الرسمية
 */
export function buildGiftedComprehensiveFinalReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings,
  options?: {
    includeEvidences?: boolean;
    availableAttachments?: GiftedAttachmentRecord[];
  }
): GiftedComprehensiveFinalReportModel {
  const includeEvidences = options?.includeEvidences !== false;
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const isFemale = settings.gender === 'female';
  const studentsSummary = computeGiftedStudentsAndAchievementsSummary(record);
  const periodicAll = buildGiftedPeriodicReportModel(record, settings, {
    filterMode: 'all',
  });

  const coverPage: GiftedComprehensiveFinalReportCoverPage = {
    ministryHeader: 'المملكة العربية السعودية — وزارة التعليم',
    educationDepartment:
      basicInfo.educationDepartment.trim() || GIFTED_UNRECORDED_LABEL,
    schoolName: basicInfo.schoolName.trim() || GIFTED_UNRECORDED_LABEL,
    recordTitle: isFemale ? 'سجل منسقة الموهوبات' : 'سجل منسق الموهوبين',
    academicYear: basicInfo.academicYear.trim() || GIFTED_UNRECORDED_LABEL,
    semesterLabel: basicInfo.semesterLabel.trim() || GIFTED_UNRECORDED_LABEL,
    coordinatorTitle: basicInfo.coordinatorTitle,
    coordinatorName:
      basicInfo.coordinatorName.trim() || GIFTED_UNRECORDED_LABEL,
    principalTitle: basicInfo.principalTitle,
    principalName: basicInfo.principalName.trim() || GIFTED_UNRECORDED_LABEL,
  };

  const resolvedParticipations = resolveStudentParticipationsWithStudentInfo(
    record
  );
  const achievementsList = resolvedParticipations
    .filter(
      (p) => p.qualifiedToNextStage || (p.achievementText || '').trim().length > 0
    )
    .map((p) => {
      const catLabel = GIFTED_PARTICIPATION_CATEGORY_LABELS[p.category];
      const ach = (p.achievementText || '').trim();
      const qual = p.qualifiedToNextStage ? 'متأهل للمرحلة التالية' : '';
      const details = [qual, ach].filter(Boolean).join(' — ');
      return `${p.studentName} (${p.historicalGrade} • ${catLabel}): ${details}`;
    });

  const combinedResults: string[] = [...periodicAll.topResultsList];
  if (record.evaluation.strengths && record.evaluation.strengths.trim()) {
    combinedResults.push(
      `نقاط القوة العامة: ${record.evaluation.strengths.trim()}`
    );
  }

  const combinedChallenges: string[] = [...periodicAll.topChallengesList];
  if (record.evaluation.challenges && record.evaluation.challenges.trim()) {
    combinedChallenges.push(
      `التحديات العامة: ${record.evaluation.challenges.trim()}`
    );
  }

  const combinedRecommendations: string[] = [
    ...periodicAll.recommendationsList,
  ];
  if (
    record.evaluation.improvementProposals &&
    record.evaluation.improvementProposals.trim()
  ) {
    combinedRecommendations.push(
      `المقترحات التطويرية العامة: ${record.evaluation.improvementProposals.trim()}`
    );
  }

  // الشواهد المختارة للتقرير النهائي من الجيل النشط فقط
  const selectedEvidenceGroups: GiftedFinalReportEvidenceGroup[] = [];
  if (includeEvidences) {
    const activeTemplates = getGiftedProgramTemplatesFromRecord(record).filter(
      (t) => t.isActive
    );
    const seenTargetIds = new Set<string>();

    for (const tpl of activeTemplates) {
      const exec = getOrCreateExecutionForProgramTemplate(record, tpl.id);
      const bundle = resolveCombinedEvidenceBundleForProgram(record, tpl, exec);
      if (seenTargetIds.has(bundle.targetId)) continue;
      seenTargetIds.add(bundle.targetId);

      if (!bundle.showEvidencesInReport) continue;
      const validPhotos = filterValidActiveGenerationPhotosForReport(
        record,
        bundle.photos,
        {
          availableAttachments: options?.availableAttachments,
          selectionMode: 'final',
        }
      );
      const validLinks = (bundle.links || []).filter(
        (l) => l.selectedForFinalRecord !== false
      );

      if (validPhotos.length > 0 || validLinks.length > 0) {
        selectedEvidenceGroups.push({
          targetId: bundle.targetId,
          targetTitle: tpl.title,
          targetCategoryLabel:
            GIFTED_PROGRAM_TEMPLATE_CATEGORY_LABELS[tpl.category],
          photos: validPhotos,
          links: validLinks,
        });
      }
    }

    for (const work of record.coordinatorAdditionalWorks || []) {
      const bundle = getEvidenceBundleForTarget(record, work.id);
      if (seenTargetIds.has(bundle.targetId)) continue;
      seenTargetIds.add(bundle.targetId);

      if (!bundle.showEvidencesInReport) continue;
      const validPhotos = filterValidActiveGenerationPhotosForReport(
        record,
        bundle.photos,
        {
          availableAttachments: options?.availableAttachments,
          selectionMode: 'final',
        }
      );
      const validLinks = (bundle.links || []).filter(
        (l) => l.selectedForFinalRecord !== false
      );

      if (validPhotos.length > 0 || validLinks.length > 0) {
        selectedEvidenceGroups.push({
          targetId: bundle.targetId,
          targetTitle: `${GIFTED_COORDINATOR_WORK_KIND_LABELS[work.workKind]}: ${work.summary}`,
          targetCategoryLabel: 'أعمال المنسق والمتابعة',
          photos: validPhotos,
          links: validLinks,
        });
      }
    }
  }

  const studentWord = isFemale ? 'طالبة' : 'طالب';
  const executiveSummaryText = `يضم ${coverPage.recordTitle} في ${coverPage.schoolName} للعام الدراسي (${coverPage.academicYear} — ${coverPage.semesterLabel}) إجمالي (${studentsSummary.totalStudents}) ${studentWord} في السجل المركزي، وإجمالي (${periodicAll.totalProgramsCount}) برنامجاً نشطاً (منفذ: ${periodicAll.executedProgramsCount} • قيد التنفيذ: ${periodicAll.pendingProgramsCount} • لم ينفذ: ${periodicAll.notExecutedProgramsCount}) بنسبة إنجاز برامج (${periodicAll.programCompletionPercentage}%) ونسبة إكمال إجراءات (${periodicAll.actionCompletionPercentage}%)، مع تسجيل (${studentsSummary.totalParticipations}) مشاركة و(${periodicAll.coordinatorWorksCount}) من أعمال التنسيق والمتابعة.`;

  const conclusionText = `تم إعداد هذا التقرير النهائي آلياً استناداً إلى البيانات الفعلية الموثقة في المحركات الثلاثة (الطلاب/الطالبات، البرامج، وأعمال ${basicInfo.coordinatorTitle}) للعام الدراسي ${coverPage.academicYear}.`;

  return {
    reportType: 'comprehensive_final_report',
    generatedAt: new Date().toISOString(),
    includeEvidences,
    basicInfo,
    coverPage,
    executiveSummaryText,
    programStats: {
      totalActivePrograms: periodicAll.totalProgramsCount,
      executedCount: periodicAll.executedProgramsCount,
      pendingCount: periodicAll.pendingProgramsCount,
      notExecutedCount: periodicAll.notExecutedProgramsCount,
      programCompletionPercentage: periodicAll.programCompletionPercentage,
      completedActionsCount: periodicAll.completedActionsCount,
      totalActionsCount: periodicAll.totalActionsCount,
      actionCompletionPercentage: periodicAll.actionCompletionPercentage,
    },
    studentStats: {
      totalStudents: studentsSummary.totalStudents,
      exceptionalGiftedCount: studentsSummary.exceptionalGiftedCount,
      giftedCount: studentsSummary.giftedCount,
      promisingCount: studentsSummary.promisingCount,
      uniqueBeneficiaryStudentsCount: periodicAll.beneficiaryStudentsCount,
    },
    participationsAndAchievements: {
      totalParticipations: studentsSummary.totalParticipations,
      qualifiedStudentsCount: studentsSummary.qualifiedStudentsCount,
      documentedAchievementsCount: studentsSummary.documentedAchievementsCount,
      achievementsList,
      achievementsText:
        achievementsList.length > 0
          ? achievementsList.join('\n')
          : GIFTED_UNRECORDED_LABEL,
    },
    coordinatorWorks: periodicAll.coordinatorWorks,
    coordinatorWorksText: periodicAll.coordinatorWorksText,
    executionIndicators: periodicAll.programsSummaryRows,
    keyProgramsText: periodicAll.topProgramsText,
    keyResultsText:
      combinedResults.length > 0
        ? combinedResults.join('\n')
        : GIFTED_UNRECORDED_LABEL,
    challengesText:
      combinedChallenges.length > 0
        ? combinedChallenges.join('\n')
        : GIFTED_UNRECORDED_LABEL,
    recommendationsText:
      combinedRecommendations.length > 0
        ? combinedRecommendations.join('\n')
        : GIFTED_UNRECORDED_LABEL,
    supportingEntitiesText:
      (record.evaluation.supportingEntities || '').trim() ||
      GIFTED_UNRECORDED_LABEL,
    selectedEvidenceGroups,
    conclusionText,
  };
}

export interface GiftedStatisticalCategoryDistributionRow {
  category: GiftedProgramTemplateCategory;
  categoryLabel: string;
  totalCount: number;
  executedCount: number;
  pendingCount: number;
  notExecutedCount: number;
  completionPercentage: number;
}

export interface GiftedStatisticalStatusDistributionRow {
  status: GiftedExecutionStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface GiftedStatisticalWeekDistributionRow {
  weekLabel: string;
  programsCount: number;
  coordinatorWorksCount: number;
}

export interface GiftedStatisticalClassificationDistributionRow {
  classification: GiftedClassificationLevel;
  label: string;
  count: number;
  percentage: number;
}

export interface GiftedStatisticalReportModel {
  reportType: 'statistical_report';
  generatedAt: string;
  basicInfo: ResolvedGiftedBasicInfo;
  totalStudents: number;
  uniqueBeneficiaryStudentsCount: number;
  totalPrograms: number;
  executedProgramsCount: number;
  pendingProgramsCount: number;
  notExecutedProgramsCount: number;
  programCompletionPercentage: number;
  completedActionsCount: number;
  totalActionsCount: number;
  actionCompletionPercentage: number;
  totalParticipations: number;
  qualifiedStudentsCount: number;
  totalAchievements: number;
  totalCoordinatorWorks: number;
  distributionByStatus: GiftedStatisticalStatusDistributionRow[];
  distributionByCategory: GiftedStatisticalCategoryDistributionRow[];
  distributionByWeek: GiftedStatisticalWeekDistributionRow[];
  distributionByStudentClassification: GiftedStatisticalClassificationDistributionRow[];
}

/**
 * [04] بناء نموذج «التقرير الإحصائي» المختصر والبصري من أرقام السجل الحقيقية فقط
 */
export function buildGiftedStatisticalReportModel(
  record: GiftedCoordinatorRecord,
  settings: SchoolSettings
): GiftedStatisticalReportModel {
  const basicInfo = resolveGiftedBasicInfo(record, settings);
  const studentsSummary = computeGiftedStudentsAndAchievementsSummary(record);
  const periodicAll = buildGiftedPeriodicReportModel(record, settings, {
    filterMode: 'all',
  });

  const totalPrograms = periodicAll.totalProgramsCount;
  const executedProgramsCount = periodicAll.executedProgramsCount;
  const pendingProgramsCount = periodicAll.pendingProgramsCount;
  const notExecutedProgramsCount = periodicAll.notExecutedProgramsCount;

  const distributionByStatus: GiftedStatisticalStatusDistributionRow[] = [
    {
      status: 'executed',
      label: GIFTED_STATUS_LABELS.executed,
      count: executedProgramsCount,
      percentage:
        totalPrograms > 0
          ? Math.round((executedProgramsCount / totalPrograms) * 100)
          : 0,
    },
    {
      status: 'pending',
      label: GIFTED_STATUS_LABELS.pending,
      count: pendingProgramsCount,
      percentage:
        totalPrograms > 0
          ? Math.round((pendingProgramsCount / totalPrograms) * 100)
          : 0,
    },
    {
      status: 'not_executed',
      label: GIFTED_STATUS_LABELS.not_executed,
      count: notExecutedProgramsCount,
      percentage:
        totalPrograms > 0
          ? Math.round((notExecutedProgramsCount / totalPrograms) * 100)
          : 0,
    },
  ];

  const categoriesOrder: GiftedProgramTemplateCategory[] = [
    'ministerial',
    'competition',
    'enrichment_initiative',
    'school_event',
    'identification_acceleration',
  ];

  const distributionByCategory: GiftedStatisticalCategoryDistributionRow[] =
    categoriesOrder
      .map((cat) => {
        const rows = periodicAll.programsSummaryRows.filter(
          (r) => r.category === cat
        );
        const totalCount = rows.length;
        const executedCount = rows.filter(
          (r) => r.executionStatus === 'executed'
        ).length;
        const pendingCount = rows.filter(
          (r) => r.executionStatus === 'pending'
        ).length;
        const notExecutedCount = rows.filter(
          (r) => r.executionStatus === 'not_executed'
        ).length;
        return {
          category: cat,
          categoryLabel: GIFTED_PROGRAM_TEMPLATE_CATEGORY_LABELS[cat],
          totalCount,
          executedCount,
          pendingCount,
          notExecutedCount,
          completionPercentage:
            totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0,
        };
      })
      .filter((item) => item.totalCount > 0);

  const distributionByWeek: GiftedStatisticalWeekDistributionRow[] = [];
  for (const week of GIFTED_ACADEMIC_WEEKS_LIST) {
    const programsCount = periodicAll.programsSummaryRows.filter((r) =>
      r.weekLabel.split('،').map((s) => s.trim()).includes(week)
    ).length;
    const coordinatorWorksCount = (
      record.coordinatorAdditionalWorks || []
    ).filter((w) => w.weekLabel === week).length;

    if (programsCount > 0 || coordinatorWorksCount > 0) {
      distributionByWeek.push({
        weekLabel: week,
        programsCount,
        coordinatorWorksCount,
      });
    }
  }

  const totalStudents = studentsSummary.totalStudents;
  const distributionByStudentClassification: GiftedStatisticalClassificationDistributionRow[] =
    [
      {
        classification: 'exceptional_gifted',
        label: GIFTED_CLASSIFICATION_LABELS.exceptional_gifted,
        count: studentsSummary.exceptionalGiftedCount,
        percentage:
          totalStudents > 0
            ? Math.round(
                (studentsSummary.exceptionalGiftedCount / totalStudents) * 100
              )
            : 0,
      },
      {
        classification: 'gifted',
        label: GIFTED_CLASSIFICATION_LABELS.gifted,
        count: studentsSummary.giftedCount,
        percentage:
          totalStudents > 0
            ? Math.round((studentsSummary.giftedCount / totalStudents) * 100)
            : 0,
      },
      {
        classification: 'promising',
        label: GIFTED_CLASSIFICATION_LABELS.promising,
        count: studentsSummary.promisingCount,
        percentage:
          totalStudents > 0
            ? Math.round((studentsSummary.promisingCount / totalStudents) * 100)
            : 0,
      },
    ];

  return {
    reportType: 'statistical_report',
    generatedAt: new Date().toISOString(),
    basicInfo,
    totalStudents,
    uniqueBeneficiaryStudentsCount: periodicAll.beneficiaryStudentsCount,
    totalPrograms,
    executedProgramsCount,
    pendingProgramsCount,
    notExecutedProgramsCount,
    programCompletionPercentage: periodicAll.programCompletionPercentage,
    completedActionsCount: periodicAll.completedActionsCount,
    totalActionsCount: periodicAll.totalActionsCount,
    actionCompletionPercentage: periodicAll.actionCompletionPercentage,
    totalParticipations: studentsSummary.totalParticipations,
    qualifiedStudentsCount: studentsSummary.qualifiedStudentsCount,
    totalAchievements: studentsSummary.documentedAchievementsCount,
    totalCoordinatorWorks: periodicAll.coordinatorWorksCount,
    distributionByStatus,
    distributionByCategory,
    distributionByWeek,
    distributionByStudentClassification,
  };
}


