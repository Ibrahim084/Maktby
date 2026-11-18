import { PLC_SECTION_THEME } from '../data/sections';
import { SchoolSettings } from '../types';
import {
  decodeQrMatrix,
  generateQrMatrix,
  generateQrSvgDataUrl,
} from './qrCodeGenerator';

// ============================================================================
// ١. الأنواع الأساسية لبنية بيانات مجتمعات التعلّم المهنية والعلاقات الترابطية
// ============================================================================

export type PlcSemester = 'first' | 'second' | 'full_year';

export type PlcCommunityStatus = 'active' | 'paused' | 'completed';

export type PlcMemberRole =
  | 'leader' // رئيس المجتمع
  | 'coordinator' // منسق
  | 'rapporteur' // مقرر
  | 'member' // عضو
  | 'followup'; // مسؤول متابعة

export type PlcNeedSource =
  | 'student_results' // نتائج الطلاب
  | 'classroom_observation' // الملاحظة الصفية
  | 'performance_analysis' // تحليل الأداء
  | 'survey' // الاستبانة
  | 'other'; // أخرى

export type PlcPriorityLevel = 'high' | 'medium' | 'low';

export type PlcActionExecutionStatus =
  | 'not_started' // لم يبدأ
  | 'in_progress' // قيد التنفيذ
  | 'completed' // منفذ
  | 'stalled' // متعثر
  | 'cancelled'; // ملغى

export type PlcActivityRecordType =
  | 'program' // برنامج
  | 'activity' // نشاط
  | 'mutual_visit' // زيارة متبادلة
  | 'community_partnership'; // شراكة مجتمعية

export type PlcActivityRecordStatus =
  | 'planned' // مخطط له
  | 'in_progress' // قيد التنفيذ
  | 'completed' // منفذ
  | 'cancelled'; // ملغى

export type PlcFollowupStatus =
  | 'not_started' // لم يبدأ
  | 'in_progress' // قيد التنفيذ
  | 'pending' // قيد المتابعة
  | 'completed' // تم التنفيذ
  | 'delayed' // متأخر
  | 'cancelled'; // ملغى

export type PlcFormNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// ----------------------------------------------------------------------------
// النموذج الأول: بيانات المجتمع وأعضاؤه
// (يُسجل رئيس المجتمع ضمن جدول الأعضاء نفسه، وتُستخرج بياناته تلقائياً من العضوية)
// ----------------------------------------------------------------------------
export interface PlcMember {
  id: string;
  name: string;
  specialty: string;
  jobRole: string; // الدور الوظيفي (مثل: معلم أول، معلم، وكيل...)
  roles: PlcMemberRole[]; // يسمح للعضو الواحد بأكثر من مسؤولية داخل المجتمع
  email?: string;
  phone?: string;
  notes?: string;
}

// ----------------------------------------------------------------------------
// النموذج الثاني: التعريف بالمجتمع (الرؤية، الرسالة، الأهداف، القيم، المبادئ)
// ----------------------------------------------------------------------------
export interface PlcIdentityListItem {
  id: string;
  text: string;
  order: number;
}

export interface PlcCommunityIdentity {
  vision: string;
  mission: string;
  goals: PlcIdentityListItem[];
  values: PlcIdentityListItem[];
  principles: PlcIdentityListItem[];
}

// ----------------------------------------------------------------------------
// النموذج الثالث: الاحتياجات والأولويات (يرتبط بالأهداف والخطة التشغيلية)
// ----------------------------------------------------------------------------
export interface PlcNeedItem {
  id: string;
  description: string;
  source: PlcNeedSource;
  customSource?: string;
  justification: string;
  priority: PlcPriorityLevel;
  proposedAction: string;
  linkedGoalIds: string[]; // علاقة ترابطية داخلية
  notes?: string;
}

// ----------------------------------------------------------------------------
// النموذج الرابع: الخطة التشغيلية
// (العلاقة القابلة للتتبع: الاحتياج ← الهدف ← الإجراء ← المؤشر ← النتيجة)
// ----------------------------------------------------------------------------
export interface PlcPlanActionItem {
  id: string;
  goalId: string; // معرف الهدف المرتبط
  needId: string; // معرف الاحتياج الأساسي الذي يعالجه الإجراء
  needIds?: string[]; // دعم ربط الإجراء باحتياج واحد أو أكثر بمعرفاتها الثابتة
  title: string; // الإجراء أو النشاط
  responsibleMemberId: string; // معرف العضو المسؤول من جدول الأعضاء
  responsibleName: string; // اسم الشخص المسؤول
  startDate: string;
  endDate: string;
  resources: string;
  indicatorId?: string; // معرف مؤشر الأداء المرتبط
  indicatorText: string; // مؤشر الإنجاز
  status: PlcActionExecutionStatus;
  completionPercentage?: number | null; // نسبة الإنجاز الفعلية بناءً على بيانات التنفيذ فقط دون اختلاق
  notes?: string;
}

// ----------------------------------------------------------------------------
// النموذج الخامس: الاجتماعات ومحاضرها
// ----------------------------------------------------------------------------
export interface PlcMeetingRecommendation {
  id: string;
  text: string;
  responsibleMemberId?: string; // معرف العضو المسؤول من النموذج الأول
  responsibleName: string; // يُستخدم فقط في حال عدم ربط عضو بمعرفه
  targetDate: string;
  followupStatus: PlcFollowupStatus;
  followupNotes?: string; // ملاحظات المتابعة
  linkedActionId?: string; // ربط التوصية بإجراء في الخطة التشغيلية عبر معرفه الثابت
}

export interface PlcMeetingAttendanceEntry {
  memberId: string; // معرف العضو من النموذج الأول (المصدر الوحيد لاسم العضو)
  memberName?: string; // اختياري للتوافق فقط؛ يُستخرج الاسم الفعلي حياً من جدول الأعضاء
  present: boolean; // true = حاضر، false = غائب
  absenceNote?: string; // ملاحظة اختيارية للغياب
}

export interface PlcMeetingRecord {
  id: string;
  meetingNumber: number;
  date: string;
  meetingType: string;
  venue: string;
  attendance: PlcMeetingAttendanceEntry[];
  agenda: string[];
  discussionSummary: string;
  recommendations: PlcMeetingRecommendation[];
  evidenceIds?: string[]; // بحد أقصى ٤ شواهد اختيارية مرتبطة بالاجتماع
  qrCodeToken?: string; // معرف آمن خاص بالاجتماع لتوليد رمز QR مستقل
}

// ----------------------------------------------------------------------------
// النموذج السادس: البرامج والأنشطة والزيارات والشراكات
// ----------------------------------------------------------------------------
export interface PlcActivityRecord {
  id: string;
  title: string;
  type: PlcActivityRecordType;
  goalId?: string; // مرتبط بهدف عبر معرفه الثابت
  needId?: string; // مرتبط باحتياج عبر معرفه الثابت
  actionId?: string; // مرتبط بإجراء في الخطة التشغيلية عبر معرفه الثابت
  objectiveText: string; // الهدف النصي (أو يُعرض تلقائياً من الهدف المرتبط)
  targetAudience: string;
  executionDateOrPeriod: string;
  responsibleMemberIds?: string[]; // معرفات الأعضاء المسؤولين من النموذج الأول دون تكرار كتابة الأسماء
  responsibleNames: string; // أسماء إضافية اختيارية عند عدم اختيار عضو مسجل
  actualExecutionDescription: string; // وصف التنفيذ الفعلي (عند التنفيذ)
  results: string; // النتائج الفعلية
  status: PlcActivityRecordStatus;
  // حقول خاصة بالزيارة المتبادلة (تظهر فقط عند اختيار mutual_visit)
  hostOrVisitingEntity?: string; // الجهة المستضيفة أو الزائرة
  participantsText?: string; // المشاركون في الزيارة
  keyObservations?: string; // أبرز ما تمت ملاحظته
  lessonsLearned?: string; // الممارسات المستفادة
  // حقول خاصة بالشراكة المجتمعية (تظهر فقط عند اختيار community_partnership)
  partnerEntity?: string; // الجهة الشريكة
  partnershipType?: string; // نوع الشراكة
  evidenceIds: string[]; // بحد أقصى ٤ شواهد مرتبطة من مستودع الشواهد
  qrCodeToken: string; // معرف آمن خاص بالسجل لتوليد رمز QR
}

// ----------------------------------------------------------------------------
// النموذج السابع: التقويم ومؤشرات الأداء وقياس الأثر
// ----------------------------------------------------------------------------
export type PlcExecutionEvalTargetKind = 'plan_action' | 'activity';

export interface PlcExecutionEvaluationItem {
  id: string;
  targetKind?: PlcExecutionEvalTargetKind;
  actionOrActivityId: string; // مرتبط بإجراء أو نشاط بالمعرف الثابت
  actionOrActivityTitle: string;
  executionLevel: string;
  notes: string;
  strengths: string;
  improvements: string;
}

export type PlcKpiDirectionType =
  | 'higher_is_better'
  | 'lower_is_better'
  | 'exact_target'
  | 'not_applicable';

export interface PlcKpiIndicatorItem {
  id: string;
  name: string;
  description: string;
  linkedGoalId?: string; // الهدف المرتبط به
  linkedNeedId?: string; // الاحتياج المرتبط به، إن وجد
  linkedActionId?: string; // الإجراء المرتبط به، إن وجد
  linkedActivityId?: string; // البرنامج/النشاط المرتبط به، إن وجد
  baselineValue?: number | null; // خط الأساس Baseline
  targetValue: number | null; // المستهدف Target
  achievedValue: number | null; // القيمة الفعلية Actual
  unit: string; // وحدة القياس
  customUnit?: string; // وحدة قياس مخصصة عند اختيار «أخرى»
  targetUnit?: string; // للتحقق من توافق وحدة المستهدف مع الفعلي
  actualUnit?: string; // للتحقق من توافق وحدة الفعلي مع المستهدف
  indicatorType?: PlcKpiDirectionType; // اتجاه/طبيعة المؤشر لحساب نسبة الإنجاز
  dataSource: string; // مصدر البيانات
  measurementPeriod: string; // فترة القياس
  periodStartDate?: string; // تاريخ بداية فترة القياس (اختياري)
  periodEndDate?: string; // تاريخ نهاية فترة القياس (اختياري)
  measurementDate?: string; // تاريخ القياس
  calculationMethod?: string; // طريقة الحساب (نص قابل للتحرير)
  notes?: string; // ملاحظات
}

export type PlcImpactMeasurementMethod =
  | 'pre_post_comparison'
  | 'student_results_analysis'
  | 'classroom_observation'
  | 'survey'
  | 'interview'
  | 'performance_analysis'
  | 'work_products_analysis'
  | 'quantitative_indicator'
  | 'qualitative_indicator'
  | 'other';

export type PlcImprovementDecisionType =
  | 'continue'
  | 'expand'
  | 'modify'
  | 're_execute'
  | 'stop_action'
  | 'add_new_action'
  | 'other';

export interface PlcImpactMeasurementItem {
  id: string;
  linkedGoalId?: string; // الهدف المرتبط
  linkedNeedId?: string; // الاحتياج المرتبط، إن وجد
  linkedActionId?: string; // الإجراء المرتبط
  linkedActivityId?: string; // البرنامج/النشاط المرتبط، إن وجد
  beneficiaryCategory: string; // الفئة المستهدفة
  measurementMethod: string; // طريقة القياس
  customMeasurementMethod?: string; // طريقة قياس مخصصة عند اختيار «أخرى»
  measurementDate: string; // تاريخ القياس
  baselineDate?: string; // تاريخ خط الأساس (اختياري)
  measurementTool?: string; // أداة القياس
  baselineValue?: number | null; // خط الأساس
  targetValue?: number | null; // المستهدف
  actualValue?: number | null; // النتيجة الفعلية
  unit?: string; // وحدة القياس
  customUnit?: string; // وحدة مخصصة عند اختيار «أخرى»
  targetUnit?: string;
  actualUnit?: string;
  measurementResults: string; // وصف النتائج
  observedChangeDescription: string; // وصف الأثر
  supportingEvidenceIds: string[]; // الشواهد المرتبطة بالـID
  improvementDecision?: string; // قرار التحسين
  customImprovementDecision?: string; // قرار تحسين مخصص عند اختيار «أخرى»
  improvementOpportunities: string; // تفاصيل قرار التحسين / فرص التحسين
  notes?: string; // ملاحظات
}

export interface PlcEvaluationSection {
  executionEvaluations: PlcExecutionEvaluationItem[];
  kpiIndicators: PlcKpiIndicatorItem[];
  impactMeasurements: PlcImpactMeasurementItem[];
}

// ----------------------------------------------------------------------------
// النموذج الثامن: مستودع الشواهد والمرفقات الموحد
// ----------------------------------------------------------------------------
export type PlcEvidenceType =
  | 'pdf'
  | 'image'
  | 'document'
  | 'presentation'
  | 'spreadsheet'
  | 'link'
  | 'other';

export type PlcEvidenceLinkTargetType =
  | 'need'
  | 'goal'
  | 'operational_plan'
  | 'plan_action'
  | 'meeting'
  | 'program'
  | 'activity'
  | 'mutual_visit'
  | 'community_partnership'
  | 'kpi'
  | 'impact'
  | 'final_report';

export interface PlcEvidenceLinkRef {
  targetType: PlcEvidenceLinkTargetType;
  targetId: string;
}

export interface PlcEvidenceItem {
  id: string;
  title: string; // اسم الشاهد
  evidenceType?: PlcEvidenceType; // نوع الشاهد
  customEvidenceType?: string; // نوع مخصص عند اختيار «أخرى»
  category: string; // تصنيف الشاهد
  description: string; // وصف الشاهد
  evidenceDate?: string; // تاريخ الشاهد
  sourceOrEntity?: string; // مصدر/جهة الشاهد، إن وجد
  fileDataUrl?: string; // الملف أو المرفق
  fileName?: string; // اسم الملف
  mimeType?: string; // نوع الملف MIME
  externalUrl?: string; // الرابط الخارجي
  notes?: string; // ملاحظات
  createdAt: string; // تاريخ الإضافة
  qrCodeToken?: string; // رمز التحقق لـ QR متوافق مع الدفعة الثالثة
  links: PlcEvidenceLinkRef[]; // العلاقات المرتبطة بالـID فقط
}

// ----------------------------------------------------------------------------
// النموذج التاسع: التقرير الختامي التلقائي (ملاحظات ختامية اختيارية قابلة للتعديل)
// ----------------------------------------------------------------------------
export interface PlcFinalReportCustomization {
  customExecutiveNotes: string;
  customClosingNotes: string;
  lastGeneratedAt?: string;
}

// ----------------------------------------------------------------------------
// السجل الكامل المستقل لمجتمع التعلّم المهني الواحد
// ----------------------------------------------------------------------------
export interface PlcCommunityRecord {
  id: string;
  createdAt: string;
  updatedAt: string;

  // النموذج الأول: بيانات المجتمع وأعضاؤه
  name: string;
  specialty: string;
  academicYear: string;
  semester: PlcSemester;
  venue: string; // اختياري
  foundationDate: string;
  status: PlcCommunityStatus;
  members: PlcMember[];

  // النموذج الثاني: التعريف بالمجتمع
  identity: PlcCommunityIdentity;

  // النموذج الثالث: الاحتياجات والأولويات
  needs: PlcNeedItem[];

  // النموذج الرابع: الخطة التشغيلية
  operationalPlan: PlcPlanActionItem[];

  // النموذج الخامس: الاجتماعات ومحاضرها
  meetings: PlcMeetingRecord[];

  // النموذج السادس: البرامج والأنشطة والزيارات والشراكات
  activities: PlcActivityRecord[];

  // النموذج السابع: التقويم ومؤشرات الأداء وقياس الأثر
  evaluation: PlcEvaluationSection;

  // النموذج الثامن: الشواهد والمرفقات (المستودع الموحد)
  evidenceRepository: PlcEvidenceItem[];

  // النموذج التاسع: تخصيص التقرير الختامي
  finalReportCustomization: PlcFinalReportCustomization;
}

// ============================================================================
// ٢. الثوابت والتسميات العربية المعتمدة للنماذج التسعة والحالات
// ============================================================================

export interface PlcFormCatalogEntry {
  formNumber: PlcFormNumber;
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  batchNumber: number;
}

export const PLC_FORMS_CATALOG: PlcFormCatalogEntry[] = [
  {
    formNumber: 1,
    id: 'community-info-members',
    title: 'النموذج الأول: بيانات المجتمع وأعضاؤه',
    shortTitle: '١. بيانات المجتمع والأعضاء',
    description:
      'البيانات التأسيسية للمجتمع، وتحديد رئيس المجتمع وجدول الأعضاء والمسؤوليات.',
    batchNumber: 2,
  },
  {
    formNumber: 2,
    id: 'community-identity',
    title: 'النموذج الثاني: التعريف بالمجتمع',
    shortTitle: '٢. التعريف بالمجتمع',
    description:
      'الرؤية، الرسالة، الأهداف، القيم، والمبادئ المهنية الحاكمة لعمل المجتمع.',
    batchNumber: 2,
  },
  {
    formNumber: 3,
    id: 'needs-and-priorities',
    title: 'النموذج الثالث: الاحتياجات والأولويات',
    shortTitle: '٣. الاحتياجات والأولويات',
    description:
      'تحديد الاحتياجات المهنية ومصادرها ومبرراتها وترتيبها حسب الأولوية وربطها بالخطة.',
    batchNumber: 2,
  },
  {
    formNumber: 4,
    id: 'operational-plan',
    title: 'النموذج الرابع: الخطة التشغيلية',
    shortTitle: '٤. الخطة التشغيلية',
    description:
      'جدول الإجراءات والأنشطة المرتبطة بالأهداف والاحتياجات ومؤشرات الإنجاز وحالة التنفيذ.',
    batchNumber: 2,
  },
  {
    formNumber: 5,
    id: 'meetings-and-minutes',
    title: 'النموذج الخامس: الاجتماعات ومحاضرها',
    shortTitle: '٥. الاجتماعات ومحاضرها',
    description:
      'توثيق الاجتماعات الدورية، الحضور والغياب، جدول الأعمال، والقرارات والتوصيات المرتبطة بالخطة.',
    batchNumber: 3,
  },
  {
    formNumber: 6,
    id: 'programs-activities-visits',
    title: 'النموذج السادس: البرامج والأنشطة والزيارات والشراكات',
    shortTitle: '٦. البرامج والأنشطة والزيارات',
    description:
      'توثيق البرامج والأنشطة والزيارات المتبادلة والشراكات المجتمعية مع الشواهد ورمز QR.',
    batchNumber: 3,
  },
  {
    formNumber: 7,
    id: 'evaluation-kpis-impact',
    title: 'النموذج السابع: التقويم ومؤشرات الأداء وقياس الأثر',
    shortTitle: '٧. التقويم ومؤشرات الأداء والأثر',
    description:
      'تقويم التنفيذ، وحساب مؤشرات الأداء من البيانات الفعلية، وقياس الأثر التعليمي والمهني.',
    batchNumber: 4,
  },
  {
    formNumber: 8,
    id: 'evidence-repository',
    title: 'النموذج الثامن: الشواهد والمرفقات',
    shortTitle: '٨. مستودع الشواهد والمرفقات',
    description:
      'مستودع شواهد موحد للمجتمع يتيح ربط الشاهد بأكثر من موضع دون تكرار رفعه.',
    batchNumber: 4,
  },
  {
    formNumber: 9,
    id: 'automatic-final-report',
    title: 'النموذج التاسع: التقرير الختامي التلقائي',
    shortTitle: '٩. التقرير الختامي التلقائي',
    description:
      'توليد التقرير الختامي الشامل والجداول الإحصائية والرسوم البيانية تلقائياً من البيانات المسجلة.',
    batchNumber: 5,
  },
];

export const PLC_SEMESTER_LABELS: Record<PlcSemester, string> = {
  first: 'الفصل الدراسي الأول',
  second: 'الفصل الدراسي الثاني',
  full_year: 'العام الدراسي كاملًا',
};

export const PLC_STATUS_LABELS: Record<PlcCommunityStatus, string> = {
  active: 'نشط',
  paused: 'متوقف مؤقتًا',
  completed: 'مكتمل',
};

export const PLC_MEMBER_ROLE_LABELS: Record<PlcMemberRole, string> = {
  leader: 'رئيس المجتمع',
  coordinator: 'منسق',
  rapporteur: 'مقرر',
  member: 'عضو',
  followup: 'مسؤول متابعة',
};

export const PLC_PRIORITY_LABELS: Record<PlcPriorityLevel, string> = {
  high: 'مرتفع',
  medium: 'متوسط',
  low: 'منخفض',
};

export const PLC_NEED_SOURCE_LABELS: Record<PlcNeedSource, string> = {
  student_results: 'نتائج الطلاب',
  classroom_observation: 'الملاحظة الصفية',
  performance_analysis: 'تحليل الأداء',
  survey: 'الاستبانة',
  other: 'أخرى',
};

export const PLC_ACTION_STATUS_LABELS: Record<PlcActionExecutionStatus, string> =
  {
    not_started: 'لم يبدأ',
    in_progress: 'قيد التنفيذ',
    completed: 'منفذ',
    stalled: 'متعثر',
    cancelled: 'ملغى',
  };

export const PLC_FOLLOWUP_STATUS_LABELS: Record<PlcFollowupStatus, string> = {
  not_started: 'لم يبدأ',
  in_progress: 'قيد التنفيذ',
  pending: 'قيد المتابعة',
  completed: 'تم التنفيذ',
  delayed: 'متأخر',
  cancelled: 'ملغى',
};

export const PLC_ACTIVITY_TYPE_LABELS: Record<PlcActivityRecordType, string> = {
  program: 'برنامج',
  activity: 'نشاط',
  mutual_visit: 'زيارة متبادلة',
  community_partnership: 'شراكة مجتمعية',
};

export const PLC_ACTIVITY_STATUS_LABELS: Record<
  PlcActivityRecordStatus,
  string
> = {
  planned: 'مخطط له',
  in_progress: 'قيد التنفيذ',
  completed: 'منفذ',
  cancelled: 'ملغى',
};

export const PLC_MAX_EVIDENCES_PER_RECORD = 4;

// ============================================================================
// ٣. توليد المعرفات الثابتة واستخراج رئيس المجتمع من جدول الأعضاء
// ============================================================================

let idCounter = 0;

export function generatePlcEntityId(prefix = 'plc'): string {
  idCounter += 1;
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${idCounter}_${randomPart}`;
}

/**
 * يستخرج بيانات رئيس المجتمع تلقائياً من جدول الأعضاء دون إنشاء سجل مكرر.
 */
export function getPlcCommunityLeader(
  community: Pick<PlcCommunityRecord, 'members'>
): PlcMember | null {
  if (!Array.isArray(community.members)) return null;
  return (
    community.members.find(
      (m) => Array.isArray(m.roles) && m.roles.includes('leader')
    ) ?? null
  );
}

/**
 * يعين عضواً محدداً رئيساً للمجتمع داخل جدول الأعضاء نفسه، أو يضيفه إذا لم يكن موجوداً،
 * مع ضمان عدم تكرار سجل الرئيس.
 */
export function assignPlcLeaderInMembers(
  members: PlcMember[],
  leaderData: {
    memberId?: string;
    name: string;
    specialty: string;
    jobRole: string;
    email?: string;
    phone?: string;
    additionalRoles?: PlcMemberRole[];
    notes?: string;
  }
): PlcMember[] {
  const cleanName = leaderData.name.trim();
  const cloned: PlcMember[] = members.map((m) => ({
    ...m,
    roles: m.roles.filter((r): r is PlcMemberRole => r !== 'leader'),
  }));

  if (!cleanName) {
    return cloned;
  }

  const targetIdx = leaderData.memberId
    ? cloned.findIndex((m) => m.id === leaderData.memberId)
    : cloned.findIndex(
        (m) =>
          m.name.trim().toLowerCase() === cleanName.toLowerCase() ||
          members
            .find((orig) => orig.id === m.id)
            ?.roles.includes('leader')
      );

  const combinedRoles: PlcMemberRole[] = Array.from(
    new Set<PlcMemberRole>(['leader', ...(leaderData.additionalRoles ?? [])])
  );

  if (targetIdx >= 0) {
    const existing = cloned[targetIdx];
    const preservedRoles = existing.roles.filter(
      (r): r is PlcMemberRole => r !== 'leader'
    );
    cloned[targetIdx] = {
      ...existing,
      name: cleanName,
      specialty: leaderData.specialty.trim() || existing.specialty,
      jobRole: leaderData.jobRole.trim() || existing.jobRole,
      email:
        leaderData.email !== undefined
          ? leaderData.email.trim()
          : existing.email,
      phone:
        leaderData.phone !== undefined
          ? leaderData.phone.trim()
          : existing.phone,
      notes:
        leaderData.notes !== undefined
          ? leaderData.notes.trim()
          : existing.notes,
      roles: Array.from(new Set<PlcMemberRole>(['leader', ...preservedRoles])),
    };
    return cloned;
  }

  const newLeaderMember: PlcMember = {
    id: generatePlcEntityId('mbr'),
    name: cleanName,
    specialty: leaderData.specialty.trim(),
    jobRole: leaderData.jobRole.trim() || 'معلم',
    roles: combinedRoles,
    email: leaderData.email?.trim() || '',
    phone: leaderData.phone?.trim() || '',
    notes: leaderData.notes?.trim() || '',
  };

  return [newLeaderMember, ...cloned];
}

// ============================================================================
// ٤. إنشاء سجل مجتمع جديد مستقل تماماً
// ============================================================================

export interface CreatePlcCommunityInput {
  name: string;
  specialty: string;
  academicYear?: string;
  semester?: PlcSemester;
  venue?: string;
  foundationDate?: string;
  status?: PlcCommunityStatus;
  leader?: {
    name: string;
    specialty?: string;
    jobRole?: string;
    email?: string;
    phone?: string;
  };
}

export function createNewPlcCommunityRecord(
  input: CreatePlcCommunityInput,
  schoolSettings?: Pick<SchoolSettings, 'academicYear'>
): PlcCommunityRecord {
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);

  const defaultAcademicYear =
    input.academicYear?.trim() ||
    schoolSettings?.academicYear?.trim() ||
    '١٤٤٧هـ';

  let initialMembers: PlcMember[] = [];
  if (input.leader && input.leader.name.trim()) {
    initialMembers = assignPlcLeaderInMembers([], {
      name: input.leader.name.trim(),
      specialty: input.leader.specialty?.trim() || input.specialty.trim(),
      jobRole: input.leader.jobRole?.trim() || 'رئيس مجتمع التعلم المهني',
      email: input.leader.email?.trim() || '',
      phone: input.leader.phone?.trim() || '',
    });
  }

  return {
    id: generatePlcEntityId('plc'),
    createdAt: nowIso,
    updatedAt: nowIso,
    name: input.name.trim(),
    specialty: input.specialty.trim(),
    academicYear: defaultAcademicYear,
    semester: input.semester ?? 'full_year',
    venue: input.venue?.trim() || '',
    foundationDate: input.foundationDate?.trim() || todayDate,
    status: input.status ?? 'active',
    members: initialMembers,
    identity: {
      vision: '',
      mission: '',
      goals: [],
      values: [],
      principles: [],
    },
    needs: [],
    operationalPlan: [],
    meetings: [],
    activities: [],
    evaluation: {
      executionEvaluations: [],
      kpiIndicators: [],
      impactMeasurements: [],
    },
    evidenceRepository: [],
    finalReportCustomization: {
      customExecutiveNotes: '',
      customClosingNotes: '',
    },
  };
}

// ============================================================================
// ٥. التخزين الدائم في LocalStorage مع الفصل التام بين سجلات المجتمعات
// ============================================================================

export const PLC_STORAGE_KEY = 'maktabi_plc_communities_v1';

function deepCloneCommunity<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function sanitizePlcCommunityRecord(
  raw: unknown
): PlcCommunityRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<PlcCommunityRecord>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;

  const nowIso = new Date().toISOString();
  const semester: PlcSemester =
    candidate.semester === 'first' ||
    candidate.semester === 'second' ||
    candidate.semester === 'full_year'
      ? candidate.semester
      : 'full_year';

  const status: PlcCommunityStatus =
    candidate.status === 'active' ||
    candidate.status === 'paused' ||
    candidate.status === 'completed'
      ? candidate.status
      : 'active';

  return deepCloneCommunity({
    id: candidate.id.trim(),
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt
        ? candidate.createdAt
        : nowIso,
    updatedAt:
      typeof candidate.updatedAt === 'string' && candidate.updatedAt
        ? candidate.updatedAt
        : nowIso,
    name: candidate.name.trim(),
    specialty:
      typeof candidate.specialty === 'string' ? candidate.specialty.trim() : '',
    academicYear:
      typeof candidate.academicYear === 'string'
        ? candidate.academicYear.trim()
        : '',
    semester,
    venue: typeof candidate.venue === 'string' ? candidate.venue.trim() : '',
    foundationDate:
      typeof candidate.foundationDate === 'string'
        ? candidate.foundationDate.trim()
        : '',
    status,
    members: Array.isArray(candidate.members) ? candidate.members : [],
    identity:
      candidate.identity && typeof candidate.identity === 'object'
        ? {
            vision:
              typeof candidate.identity.vision === 'string'
                ? candidate.identity.vision
                : '',
            mission:
              typeof candidate.identity.mission === 'string'
                ? candidate.identity.mission
                : '',
            goals: Array.isArray(candidate.identity.goals)
              ? candidate.identity.goals
              : [],
            values: Array.isArray(candidate.identity.values)
              ? candidate.identity.values
              : [],
            principles: Array.isArray(candidate.identity.principles)
              ? candidate.identity.principles
              : [],
          }
        : {
            vision: '',
            mission: '',
            goals: [],
            values: [],
            principles: [],
          },
    needs: Array.isArray(candidate.needs) ? candidate.needs : [],
    operationalPlan: Array.isArray(candidate.operationalPlan)
      ? candidate.operationalPlan
      : [],
    meetings: Array.isArray(candidate.meetings) ? candidate.meetings : [],
    activities: Array.isArray(candidate.activities) ? candidate.activities : [],
    evaluation:
      candidate.evaluation && typeof candidate.evaluation === 'object'
        ? {
            executionEvaluations: Array.isArray(
              candidate.evaluation.executionEvaluations
            )
              ? candidate.evaluation.executionEvaluations
              : [],
            kpiIndicators: Array.isArray(candidate.evaluation.kpiIndicators)
              ? candidate.evaluation.kpiIndicators
              : [],
            impactMeasurements: Array.isArray(
              candidate.evaluation.impactMeasurements
            )
              ? candidate.evaluation.impactMeasurements
              : [],
          }
        : {
            executionEvaluations: [],
            kpiIndicators: [],
            impactMeasurements: [],
          },
    evidenceRepository: Array.isArray(candidate.evidenceRepository)
      ? candidate.evidenceRepository
      : [],
    finalReportCustomization:
      candidate.finalReportCustomization &&
      typeof candidate.finalReportCustomization === 'object'
        ? {
            customExecutiveNotes:
              typeof candidate.finalReportCustomization.customExecutiveNotes ===
              'string'
                ? candidate.finalReportCustomization.customExecutiveNotes
                : '',
            customClosingNotes:
              typeof candidate.finalReportCustomization.customClosingNotes ===
              'string'
                ? candidate.finalReportCustomization.customClosingNotes
                : '',
            lastGeneratedAt:
              typeof candidate.finalReportCustomization.lastGeneratedAt ===
              'string'
                ? candidate.finalReportCustomization.lastGeneratedAt
                : undefined,
          }
        : {
            customExecutiveNotes: '',
            customClosingNotes: '',
          },
  });
}

export function loadPlcCommunitiesFromStorage(
  storage?: Pick<Storage, 'getItem'>
): PlcCommunityRecord[] {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return [];
    const raw = store.getItem(PLC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: PlcCommunityRecord[] = [];
    for (const item of parsed) {
      const sanitized = sanitizePlcCommunityRecord(item);
      if (sanitized && !sanitized.id.startsWith('plc_demo_preview_')) {
        valid.push(sanitized);
      }
    }
    return valid;
  } catch {
    return [];
  }
}

export function savePlcCommunitiesToStorage(
  communities: PlcCommunityRecord[],
  storage?: Pick<Storage, 'setItem'>
): boolean {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;
    const cloned = communities
      .map((c) => sanitizePlcCommunityRecord(c))
      .filter(
        (c): c is PlcCommunityRecord =>
          c !== null && !c.id.startsWith('plc_demo_preview_')
      );
    store.setItem(PLC_STORAGE_KEY, JSON.stringify(cloned));
    return true;
  } catch {
    return false;
  }
}

/**
 * يضيف مجتمعاً جديداً مع الحفاظ الكامل على المجتمعات الأخرى دون أي تداخل.
 * يمنع إضافة أي سجل خاص بالمعاينة التجريبية إلى قائمة المجتمعات الحقيقية.
 */
export function addPlcCommunityToList(
  communities: PlcCommunityRecord[],
  newCommunity: PlcCommunityRecord
): PlcCommunityRecord[] {
  const sanitized = sanitizePlcCommunityRecord(newCommunity);
  if (!sanitized || sanitized.id.startsWith('plc_demo_preview_')) {
    return deepCloneCommunity(
      communities.filter((c) => !c.id.startsWith('plc_demo_preview_'))
    );
  }
  return [
    sanitized,
    ...deepCloneCommunity(
      communities.filter((c) => !c.id.startsWith('plc_demo_preview_'))
    ),
  ];
}

/**
 * يحدث بيانات مجتمع محدد بمعرفه الثابت دون المساس بأي مجتمع آخر إطلاقاً.
 */
export function updatePlcCommunityInList(
  communities: PlcCommunityRecord[],
  communityId: string,
  updater: (current: PlcCommunityRecord) => PlcCommunityRecord
): PlcCommunityRecord[] {
  return communities.map((item) => {
    if (item.id !== communityId) {
      return deepCloneCommunity(item);
    }
    const updated = updater(deepCloneCommunity(item));
    const sanitized = sanitizePlcCommunityRecord({
      ...updated,
      id: item.id, // منع تغيير المعرف الثابت للسجل
      updatedAt: new Date().toISOString(),
    });
    return sanitized ?? deepCloneCommunity(item);
  });
}

/**
 * يحذف مجتمعاً محدداً بمعرفه الثابت دون التأثير على بقية المجتمعات.
 */
export function deletePlcCommunityFromList(
  communities: PlcCommunityRecord[],
  communityId: string
): PlcCommunityRecord[] {
  return deepCloneCommunity(
    communities.filter((item) => item.id !== communityId)
  );
}

// ============================================================================
// ٦. البحث والفرز والتصفية في قائمة المجتمعات
// ============================================================================

export type PlcSortCriterion =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'academic_year';

export interface PlcFilterAndSortOptions {
  searchQuery?: string;
  statusFilter?: PlcCommunityStatus | 'all';
  semesterFilter?: PlcSemester | 'all';
  academicYearFilter?: string | 'all';
  sortBy?: PlcSortCriterion;
}

export function filterAndSortPlcCommunities(
  communities: PlcCommunityRecord[],
  options: PlcFilterAndSortOptions
): PlcCommunityRecord[] {
  const query = (options.searchQuery ?? '').trim().toLowerCase();
  const statusFilter = options.statusFilter ?? 'all';
  const semesterFilter = options.semesterFilter ?? 'all';
  const yearFilter = options.academicYearFilter ?? 'all';
  const sortBy = options.sortBy ?? 'newest';

  const filtered = communities.filter((community) => {
    if (community.id.startsWith('plc_demo_preview_')) {
      return false;
    }
    if (statusFilter !== 'all' && community.status !== statusFilter) {
      return false;
    }
    if (semesterFilter !== 'all' && community.semester !== semesterFilter) {
      return false;
    }
    if (
      yearFilter !== 'all' &&
      yearFilter.trim() !== '' &&
      community.academicYear.trim() !== yearFilter.trim()
    ) {
      return false;
    }

    if (query) {
      const leader = getPlcCommunityLeader(community);
      const haystack = [
        community.name,
        community.specialty,
        community.academicYear,
        community.venue,
        leader?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name, 'ar');
    }
    if (sortBy === 'academic_year') {
      return b.academicYear.localeCompare(a.academicYear, 'ar');
    }
    if (sortBy === 'oldest') {
      return a.createdAt.localeCompare(b.createdAt);
    }
    // newest
    return b.createdAt.localeCompare(a.createdAt);
  });

  return sorted;
}

// ============================================================================
// ٧. حساب حالة اكتمال كل نموذج من النماذج التسعة بناءً على البيانات الفعلية فقط
// ============================================================================

export type PlcFormCompletionState = 'completed' | 'in_progress' | 'empty';

export interface PlcFormCompletionInfo {
  formNumber: PlcFormNumber;
  title: string;
  shortTitle: string;
  state: PlcFormCompletionState;
  summaryText: string;
}

export interface PlcCommunityCompletionOverview {
  forms: Record<PlcFormNumber, PlcFormCompletionInfo>;
  completedFormsCount: number;
  inProgressFormsCount: number;
  totalFormsCount: 9;
  overallCompletionPercentage: number;
}

export function computePlcFormsCompletionStatus(
  community: PlcCommunityRecord
): PlcCommunityCompletionOverview {
  const leader = getPlcCommunityLeader(community);

  // النموذج ١: بيانات المجتمع وأعضاؤه
  const hasBasicInfo = Boolean(
    community.name.trim() &&
      community.specialty.trim() &&
      community.academicYear.trim() &&
      community.foundationDate.trim()
  );
  const hasLeaderAndMembers = Boolean(leader && community.members.length >= 1);
  const form1State: PlcFormCompletionState =
    hasBasicInfo && hasLeaderAndMembers
      ? 'completed'
      : hasBasicInfo || community.members.length > 0
        ? 'in_progress'
        : 'empty';

  // النموذج ٢: التعريف بالمجتمع
  const iden = community.identity;
  const idenCount =
    (iden.vision.trim() ? 1 : 0) +
    (iden.mission.trim() ? 1 : 0) +
    (iden.goals.length > 0 ? 1 : 0) +
    (iden.values.length > 0 ? 1 : 0) +
    (iden.principles.length > 0 ? 1 : 0);
  const form2State: PlcFormCompletionState =
    idenCount === 5 ? 'completed' : idenCount > 0 ? 'in_progress' : 'empty';

  // النموذج ٣: الاحتياجات والأولويات
  const form3State: PlcFormCompletionState =
    community.needs.length > 0 ? 'completed' : 'empty';

  // النموذج ٤: الخطة التشغيلية
  const form4State: PlcFormCompletionState =
    community.operationalPlan.length > 0 ? 'completed' : 'empty';

  // النموذج ٥: الاجتماعات ومحاضرها
  const form5State: PlcFormCompletionState =
    community.meetings.length > 0 ? 'completed' : 'empty';

  // النموذج ٦: البرامج والأنشطة والزيارات والشراكات (لا يُحتسب مكتمل التنفيذ إلا إذا تضمن سجلاً واحداً على الأقل بحالة «منفذ»)
  const hasExecutedActivity = community.activities.some(
    (act) => act.status === 'completed'
  );
  const form6State: PlcFormCompletionState =
    community.activities.length === 0
      ? 'empty'
      : hasExecutedActivity
        ? 'completed'
        : 'in_progress';

  // النموذج ٧: التقويم ومؤشرات الأداء وقياس الأثر
  const evalSec = community.evaluation;
  const hasExecSummaryOrEval =
    evalSec.executionEvaluations.length > 0 ||
    community.operationalPlan.length > 0 ||
    community.activities.length > 0;
  const evalParts =
    (hasExecSummaryOrEval &&
    (evalSec.kpiIndicators.length > 0 ||
      evalSec.impactMeasurements.length > 0 ||
      evalSec.executionEvaluations.length > 0)
      ? 1
      : 0) +
    (evalSec.kpiIndicators.length > 0 ? 1 : 0) +
    (evalSec.impactMeasurements.length > 0 ? 1 : 0);
  const form7State: PlcFormCompletionState =
    evalParts === 3 ? 'completed' : evalParts > 0 ? 'in_progress' : 'empty';

  // النموذج الثامن: الشواهد والمرفقات
  const form8State: PlcFormCompletionState =
    community.evidenceRepository.length > 0 ? 'completed' : 'empty';

  // النموذج التاسع: التقرير الختامي التلقائي (جاهز للتوليد متى توفرت بيانات المجتمع الأساسية)
  const readyForFinalReport =
    form1State === 'completed' &&
    (form3State === 'completed' ||
      form4State === 'completed' ||
      form5State === 'completed' ||
      form6State === 'completed');
  const form9State: PlcFormCompletionState = readyForFinalReport
    ? 'completed'
    : hasBasicInfo
      ? 'in_progress'
      : 'empty';

  const statesMap: Record<
    PlcFormNumber,
    { state: PlcFormCompletionState; summaryText: string }
  > = {
    1: {
      state: form1State,
      summaryText: `${community.members.length} عضو مسجل${
        leader ? ` • الرئيس: ${leader.name}` : ' • لم يحدد رئيس المجتمع بعد'
      }`,
    },
    2: {
      state: form2State,
      summaryText: `${iden.goals.length} أهداف • ${iden.values.length} قيم • ${iden.principles.length} مبادئ`,
    },
    3: {
      state: form3State,
      summaryText: `${community.needs.length} احتياج مهني مسجل`,
    },
    4: {
      state: form4State,
      summaryText: `${community.operationalPlan.length} إجراء في الخطة التشغيلية`,
    },
    5: {
      state: form5State,
      summaryText: `${community.meetings.length} اجتماع ومحضر مسجل`,
    },
    6: {
      state: form6State,
      summaryText: `${community.activities.length} سجل (برامج / أنشطة / زيارات / شراكات)`,
    },
    7: {
      state: form7State,
      summaryText: `${evalSec.kpiIndicators.length} مؤشر أداء • ${evalSec.impactMeasurements.length} قياس أثر`,
    },
    8: {
      state: form8State,
      summaryText: `${community.evidenceRepository.length} شاهد في المستودع الموحد`,
    },
    9: {
      state: form9State,
      summaryText: readyForFinalReport
        ? 'جاهز لتوليد التقرير الختامي من البيانات المسجلة'
        : 'بانتظار استكمال نماذج التخطيط والتنفيذ',
    },
  };

  const formsRecord = {} as Record<PlcFormNumber, PlcFormCompletionInfo>;
  let completedFormsCount = 0;
  let inProgressFormsCount = 0;

  for (const catalogItem of PLC_FORMS_CATALOG) {
    const num = catalogItem.formNumber;
    const itemStatus = statesMap[num];
    if (itemStatus.state === 'completed') completedFormsCount += 1;
    if (itemStatus.state === 'in_progress') inProgressFormsCount += 1;
    formsRecord[num] = {
      formNumber: num,
      title: catalogItem.title,
      shortTitle: catalogItem.shortTitle,
      state: itemStatus.state,
      summaryText: itemStatus.summaryText,
    };
  }

  const overallCompletionPercentage = Math.round(
    ((completedFormsCount + inProgressFormsCount * 0.4) / 9) * 100
  );

  return {
    forms: formsRecord,
    completedFormsCount,
    inProgressFormsCount,
    totalFormsCount: 9,
    overallCompletionPercentage,
  };
}

// ============================================================================
// ٨. ملخص إحصائي إجمالي للمدرسة للمجتمعات المحددة (بدون اختلاق أي أرقام)
// ============================================================================

export interface PlcSchoolAggregateSummary {
  selectedCommunitiesCount: number;
  activeCount: number;
  pausedCount: number;
  completedCount: number;
  totalMembersCount: number;
  totalNeedsCount: number;
  totalPlanActionsCount: number;
  completedPlanActionsCount: number;
  planExecutionPercentage: number | null; // null إذا لم تكن هناك إجراءات مسجلة
  totalMeetingsCount: number;
  totalActivitiesCount: number;
  totalEvidencesCount: number;
  communitiesBreakdown: Array<{
    id: string;
    name: string;
    specialty: string;
    academicYear: string;
    semesterLabel: string;
    statusLabel: string;
    leaderName: string;
    membersCount: number;
    needsCount: number;
    actionsCount: number;
    meetingsCount: number;
    activitiesCount: number;
  }>;
}

export function computePlcSchoolAggregateSummary(
  communities: PlcCommunityRecord[],
  selectedCommunityIds?: string[]
): PlcSchoolAggregateSummary {
  const realCommunities = communities.filter(
    (c) => !c.id.startsWith('plc_demo_preview_')
  );
  const targetList =
    selectedCommunityIds && selectedCommunityIds.length > 0
      ? realCommunities.filter((c) => selectedCommunityIds.includes(c.id))
      : realCommunities;

  let activeCount = 0;
  let pausedCount = 0;
  let completedCount = 0;
  let totalMembersCount = 0;
  let totalNeedsCount = 0;
  let totalPlanActionsCount = 0;
  let completedPlanActionsCount = 0;
  let totalMeetingsCount = 0;
  let totalActivitiesCount = 0;
  let totalEvidencesCount = 0;

  const communitiesBreakdown = targetList.map((c) => {
    if (c.status === 'active') activeCount += 1;
    else if (c.status === 'paused') pausedCount += 1;
    else if (c.status === 'completed') completedCount += 1;

    const nonCancelledActions = c.operationalPlan.filter(
      (a) => a.status !== 'cancelled'
    );
    const doneActions = nonCancelledActions.filter(
      (a) => a.status === 'completed'
    );

    totalMembersCount += c.members.length;
    totalNeedsCount += c.needs.length;
    totalPlanActionsCount += nonCancelledActions.length;
    completedPlanActionsCount += doneActions.length;
    totalMeetingsCount += c.meetings.length;
    totalActivitiesCount += c.activities.length;
    totalEvidencesCount += c.evidenceRepository.length;

    const leader = getPlcCommunityLeader(c);

    return {
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      academicYear: c.academicYear,
      semesterLabel: PLC_SEMESTER_LABELS[c.semester],
      statusLabel: PLC_STATUS_LABELS[c.status],
      leaderName: leader?.name || 'غير محدد',
      membersCount: c.members.length,
      needsCount: c.needs.length,
      actionsCount: c.operationalPlan.length,
      meetingsCount: c.meetings.length,
      activitiesCount: c.activities.length,
    };
  });

  // قاعدة النزاهة: لا تُحسب نسبة تنفيذ الخطة إذا لم تكن هناك إجراءات مسجلة فعلياً
  const planExecutionPercentage =
    totalPlanActionsCount > 0
      ? Math.round((completedPlanActionsCount / totalPlanActionsCount) * 100)
      : null;

  return {
    selectedCommunitiesCount: targetList.length,
    activeCount,
    pausedCount,
    completedCount,
    totalMembersCount,
    totalNeedsCount,
    totalPlanActionsCount,
    completedPlanActionsCount,
    planExecutionPercentage,
    totalMeetingsCount,
    totalActivitiesCount,
    totalEvidencesCount,
    communitiesBreakdown,
  };
}

// ============================================================================
// ٩. الدفعة الثانية: عمليات النماذج الأربعة الأولى (البيانات والتخطيط)
// ============================================================================

// ----------------------------------------------------------------------------
// أ) النموذج الأول: إدارة جدول الأعضاء وتحديد رئيس المجتمع دون تكرار السجل
// ----------------------------------------------------------------------------

export interface PlcMemberInput {
  name: string;
  specialty: string;
  jobRole?: string;
  roles: PlcMemberRole[];
  email?: string;
  phone?: string;
  notes?: string;
}

/**
 * يضيف عضواً جديداً إلى جدول الأعضاء.
 * إذا كانت أدواره تتضمن 'leader' (رئيس المجتمع)، تُزال صفة 'leader' تلقائياً من أي عضو سابق
 * لضمان وجود رئيس واحد فقط للمجتمع دون أي تكرار في السجلات.
 */
export function addPlcMember(
  members: PlcMember[],
  input: PlcMemberInput
): PlcMember[] {
  const cleanName = input.name.trim();
  if (!cleanName) return deepCloneCommunity(members);

  const normalizedRoles: PlcMemberRole[] =
    Array.isArray(input.roles) && input.roles.length > 0
      ? Array.from(new Set<PlcMemberRole>(input.roles))
      : ['member'];

  const isNewLeader = normalizedRoles.includes('leader');

  const updatedExisting: PlcMember[] = members.map((m) => {
    if (!isNewLeader) return deepCloneCommunity(m);
    const remainingRoles = m.roles.filter(
      (r): r is PlcMemberRole => r !== 'leader'
    );
    return {
      ...deepCloneCommunity(m),
      roles: remainingRoles.length > 0 ? remainingRoles : ['member'],
    };
  });

  const newMember: PlcMember = {
    id: generatePlcEntityId('mbr'),
    name: cleanName,
    specialty: input.specialty.trim(),
    jobRole: input.jobRole?.trim() || 'معلم',
    roles: normalizedRoles,
    email: input.email?.trim() || '',
    phone: input.phone?.trim() || '',
    notes: input.notes?.trim() || '',
  };

  return [...updatedExisting, newMember];
}

/**
 * يعدل بيانات عضو موجود في جدول الأعضاء بمعرفه الثابت.
 * إذا أُضيفت له صفة 'leader'، تُزال تلقائياً من أي عضو آخر.
 */
export function updatePlcMember(
  members: PlcMember[],
  memberId: string,
  updates: Partial<PlcMemberInput>
): PlcMember[] {
  const targetExists = members.some((m) => m.id === memberId);
  if (!targetExists) return deepCloneCommunity(members);

  const nextRolesForTarget: PlcMemberRole[] | undefined =
    updates.roles !== undefined
      ? updates.roles.length > 0
        ? Array.from(new Set<PlcMemberRole>(updates.roles))
        : ['member']
      : undefined;

  const targetBecomesLeader = Boolean(
    nextRolesForTarget && nextRolesForTarget.includes('leader')
  );

  return members.map((m) => {
    if (m.id === memberId) {
      return {
        ...deepCloneCommunity(m),
        name:
          updates.name !== undefined && updates.name.trim()
            ? updates.name.trim()
            : m.name,
        specialty:
          updates.specialty !== undefined
            ? updates.specialty.trim()
            : m.specialty,
        jobRole:
          updates.jobRole !== undefined
            ? updates.jobRole.trim() || 'معلم'
            : m.jobRole,
        roles: nextRolesForTarget ?? m.roles,
        email:
          updates.email !== undefined ? updates.email.trim() : m.email ?? '',
        phone:
          updates.phone !== undefined ? updates.phone.trim() : m.phone ?? '',
        notes:
          updates.notes !== undefined ? updates.notes.trim() : m.notes ?? '',
      };
    }

    if (targetBecomesLeader && m.roles.includes('leader')) {
      const remaining = m.roles.filter(
        (r): r is PlcMemberRole => r !== 'leader'
      );
      return {
        ...deepCloneCommunity(m),
        roles: remaining.length > 0 ? remaining : ['member'],
      };
    }

    return deepCloneCommunity(m);
  });
}

/**
 * يحذف عضواً من جدول الأعضاء بمعرفه الثابت.
 */
export function deletePlcMember(
  members: PlcMember[],
  memberId: string
): PlcMember[] {
  return deepCloneCommunity(members.filter((m) => m.id !== memberId));
}

/**
 * يحدد عضواً موجوداً من جدول الأعضاء ليكون رئيس المجتمع مباشرة،
 * دون إنشاء سجل مكرر، مع الحفاظ على مسؤولياته الإضافية.
 */
export function setPlcMemberAsLeader(
  members: PlcMember[],
  memberId: string
): PlcMember[] {
  const exists = members.some((m) => m.id === memberId);
  if (!exists) return deepCloneCommunity(members);

  return members.map((m) => {
    if (m.id === memberId) {
      const mergedRoles = Array.from(
        new Set<PlcMemberRole>(['leader', ...m.roles])
      );
      return {
        ...deepCloneCommunity(m),
        roles: mergedRoles,
      };
    }
    const withoutLeader = m.roles.filter(
      (r): r is PlcMemberRole => r !== 'leader'
    );
    return {
      ...deepCloneCommunity(m),
      roles: withoutLeader.length > 0 ? withoutLeader : ['member'],
    };
  });
}

// ----------------------------------------------------------------------------
// ب) النموذج الثاني: التعريف بالمجتمع (الرؤية، الرسالة، الأهداف، القيم، المبادئ)
// ----------------------------------------------------------------------------

export type PlcIdentityListField = 'goals' | 'values' | 'principles';

/**
 * صياغات استرشادية اختيارية غير ملزمة للمستخدم (يُدرجها المستخدم بنقرة اختيارية إذا رغب،
 * ولا تُفرض أبداً كبيانات مسبقة داخل سجله).
 */
export const PLC_IDENTITY_SUGGESTIONS = {
  vision: [
    'بناء مجتمع تعلّم مهني تشاركي رائد يسهم في تجويد الممارسات التدريسية ورفع مستوى التحصيل الدراسي للطلاب.',
    'الريادة في التطوير المهني المستدام القائم على البحث الإجرائي وتبادل الخبرات التربوية داخل المدرسة.',
  ],
  mission: [
    'تمكين أعضاء المجتمع المهني من التخطيط التشاركي، وتحليل نتائج المتعلمين، وتطبيق استراتيجيات تدريسية وتقويمية فاعلة قائمة على الدليل والشواهد.',
    'تعزيز ثقافة الحوار المهني البنّاء والزيارات التبادلية لمعالجة الاحتياجات التعليمية الفعلية وتحقيق أثر مستدام في تعلم الطلاب.',
  ],
  goals: [
    'تطوير ممارسات التقويم التكويني وتحليل نتائج الطلاب بصورة دورية لبناء خطط علاجية وإثرائية دقيقة.',
    'تفعيل الزيارات التبادلية والملاحظة الصفية المهنية لتبادل الخبرات التدريسية النوعية بين أعضاء المجتمع.',
    'تصميم وتنفيذ مبادرات صفية وأنشطة تطبيقية تركز على رفع نواتج التعلم في المهارات الأساسية.',
    'توظيف التقنيات الرقمية والموارد التعليمية التفاعلية لرفع دافعية الطلاب ومشاركتهم الفاعلة.',
  ],
  values: [
    'التشاركية والتعاون المهني',
    'المسؤولية الجماعية تجاه تعلم الطلاب',
    'الشفافية والموضوعية في تحليل الأداء',
    'الالتزام والإتقان المهني',
    'التطوير والتعلم المستمر',
  ],
  principles: [
    'التركيز المستمر على تعلم الطلاب ونواتج التعلم الفعلية بدلاً من الاكتفاء بتنفيذ الأنشطة الشكلية.',
    'اتخاذ القرارات التربوية بناءً على البيانات والشواهد الواقعية ونتائج التقويم.',
    'الاحترام المتبادل وتقبّل التغذية الراجعة المهنية بوصفها أداة للنمو والتطوير.',
    'ربط كل نشاط أو اجتماع باحتياج مهني واضح وهدف محدد قابل للقياس والتتبع.',
  ],
};

function normalizeIdentityListOrder(
  list: PlcIdentityListItem[]
): PlcIdentityListItem[] {
  return list.map((item, idx) => ({
    ...item,
    order: idx + 1,
  }));
}

/**
 * يضيف عنصراً جديداً إلى قائمة (الأهداف أو القيم أو المبادئ المهنية) بمعرف ثابت وترتيب تسلسلي.
 */
export function addPlcIdentityListItem(
  list: PlcIdentityListItem[],
  text: string,
  prefix = 'idn'
): PlcIdentityListItem[] {
  const cleanText = text.trim();
  if (!cleanText) return normalizeIdentityListOrder(deepCloneCommunity(list));

  const nextItem: PlcIdentityListItem = {
    id: generatePlcEntityId(prefix),
    text: cleanText,
    order: list.length + 1,
  };
  return normalizeIdentityListOrder([...deepCloneCommunity(list), nextItem]);
}

/**
 * يعدل نص عنصر موجود داخل قائمة (الأهداف أو القيم أو المبادئ المهنية) مع الحفاظ على معرفه الثابت.
 */
export function updatePlcIdentityListItem(
  list: PlcIdentityListItem[],
  itemId: string,
  newText: string
): PlcIdentityListItem[] {
  const cleanText = newText.trim();
  if (!cleanText) return normalizeIdentityListOrder(deepCloneCommunity(list));

  return normalizeIdentityListOrder(
    list.map((item) =>
      item.id === itemId
        ? { ...deepCloneCommunity(item), text: cleanText }
        : deepCloneCommunity(item)
    )
  );
}

/**
 * يحذف عنصراً من قائمة (الأهداف أو القيم أو المبادئ المهنية) ويعيد ترقيم الترتيب.
 */
export function deletePlcIdentityListItem(
  list: PlcIdentityListItem[],
  itemId: string
): PlcIdentityListItem[] {
  return normalizeIdentityListOrder(
    deepCloneCommunity(list.filter((item) => item.id !== itemId))
  );
}

/**
 * يعيد ترتيب عنصر داخل قائمة (الأهداف أو القيم أو المبادئ المهنية) للأعلى أو للأسفل.
 */
export function reorderPlcIdentityListItem(
  list: PlcIdentityListItem[],
  itemId: string,
  direction: 'up' | 'down'
): PlcIdentityListItem[] {
  const cloned = deepCloneCommunity(list);
  const idx = cloned.findIndex((item) => item.id === itemId);
  if (idx < 0) return normalizeIdentityListOrder(cloned);

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= cloned.length) {
    return normalizeIdentityListOrder(cloned);
  }

  const temp = cloned[idx];
  cloned[idx] = cloned[targetIdx];
  cloned[targetIdx] = temp;

  return normalizeIdentityListOrder(cloned);
}

// ----------------------------------------------------------------------------
// ج) النموذج الثالث: الاحتياجات والأولويات
// ----------------------------------------------------------------------------

export interface PlcNeedInput {
  description: string;
  source: PlcNeedSource;
  customSource?: string;
  justification: string;
  priority: PlcPriorityLevel;
  proposedAction: string;
  linkedGoalIds?: string[];
  notes?: string;
}

const PRIORITY_WEIGHTS: Record<PlcPriorityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * يرتب الاحتياجات المهنية تنازلياً حسب مستوى الأولوية (مرتفع ← متوسط ← منخفض).
 */
export function sortPlcNeedsByPriority(needs: PlcNeedItem[]): PlcNeedItem[] {
  return [...deepCloneCommunity(needs)].sort((a, b) => {
    const weightA = PRIORITY_WEIGHTS[a.priority] ?? 0;
    const weightB = PRIORITY_WEIGHTS[b.priority] ?? 0;
    return weightB - weightA;
  });
}

/**
 * يضيف احتياجاً مهنياً جديداً بمعرف ثابت، مع دعم الترتيب حسب الأولوية.
 */
export function addPlcNeedItem(
  needs: PlcNeedItem[],
  input: PlcNeedInput,
  autoSortByPriority = true
): PlcNeedItem[] {
  const cleanDesc = input.description.trim();
  if (!cleanDesc) return deepCloneCommunity(needs);

  const newNeed: PlcNeedItem = {
    id: generatePlcEntityId('need'),
    description: cleanDesc,
    source: input.source,
    customSource:
      input.source === 'other' ? input.customSource?.trim() || '' : '',
    justification: input.justification.trim(),
    priority: input.priority,
    proposedAction: input.proposedAction.trim(),
    linkedGoalIds: Array.isArray(input.linkedGoalIds)
      ? Array.from(new Set(input.linkedGoalIds.filter(Boolean)))
      : [],
    notes: input.notes?.trim() || '',
  };

  const nextList = [...deepCloneCommunity(needs), newNeed];
  return autoSortByPriority ? sortPlcNeedsByPriority(nextList) : nextList;
}

/**
 * يعدل بيانات احتياج مهني مسجل مع الحفاظ الكامل على معرفه الثابت (`id`)
 * بحيث ينعكس التعديل تلقائياً في الخطة التشغيلية المرتبطة به.
 */
export function updatePlcNeedItem(
  needs: PlcNeedItem[],
  needId: string,
  updates: Partial<PlcNeedInput>,
  autoSortByPriority = true
): PlcNeedItem[] {
  const updated = needs.map((item) => {
    if (item.id !== needId) return deepCloneCommunity(item);
    const nextSource = updates.source ?? item.source;
    return {
      ...deepCloneCommunity(item),
      description:
        updates.description !== undefined && updates.description.trim()
          ? updates.description.trim()
          : item.description,
      source: nextSource,
      customSource:
        nextSource === 'other'
          ? updates.customSource !== undefined
            ? updates.customSource.trim()
            : item.customSource ?? ''
          : '',
      justification:
        updates.justification !== undefined
          ? updates.justification.trim()
          : item.justification,
      priority: updates.priority ?? item.priority,
      proposedAction:
        updates.proposedAction !== undefined
          ? updates.proposedAction.trim()
          : item.proposedAction,
      linkedGoalIds:
        updates.linkedGoalIds !== undefined
          ? Array.from(new Set(updates.linkedGoalIds.filter(Boolean)))
          : item.linkedGoalIds,
      notes:
        updates.notes !== undefined ? updates.notes.trim() : item.notes ?? '',
    };
  });

  return autoSortByPriority ? sortPlcNeedsByPriority(updated) : updated;
}

/**
 * يحذف احتياجاً مهنياً بمعرفه الثابت.
 */
export function deletePlcNeedItem(
  needs: PlcNeedItem[],
  needId: string
): PlcNeedItem[] {
  return deepCloneCommunity(needs.filter((item) => item.id !== needId));
}

export interface PlcNeedsFilterOptions {
  searchQuery?: string;
  priorityFilter?: PlcPriorityLevel | 'all';
  sourceFilter?: PlcNeedSource | 'all';
  sortByPriority?: boolean;
}

/**
 * يبحث ويصفي ويرتب جدول الاحتياجات والأولويات.
 */
export function filterAndSortPlcNeeds(
  needs: PlcNeedItem[],
  options: PlcNeedsFilterOptions = {}
): PlcNeedItem[] {
  const query = (options.searchQuery ?? '').trim().toLowerCase();
  const priorityFilter = options.priorityFilter ?? 'all';
  const sourceFilter = options.sourceFilter ?? 'all';
  const shouldSort = options.sortByPriority ?? true;

  const filtered = needs.filter((need) => {
    if (priorityFilter !== 'all' && need.priority !== priorityFilter) {
      return false;
    }
    if (sourceFilter !== 'all' && need.source !== sourceFilter) {
      return false;
    }
    if (query) {
      const sourceLabel =
        need.source === 'other' && need.customSource?.trim()
          ? need.customSource.trim()
          : PLC_NEED_SOURCE_LABELS[need.source];
      const haystack = [
        need.description,
        need.justification,
        need.proposedAction,
        need.notes ?? '',
        sourceLabel,
        PLC_PRIORITY_LABELS[need.priority],
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return shouldSort
    ? sortPlcNeedsByPriority(filtered)
    : deepCloneCommunity(filtered);
}

/**
 * يستخرج تسمية مصدر تحديد الاحتياج للعرض في الجداول والتقارير.
 */
export function getPlcNeedSourceDisplayLabel(need: PlcNeedItem): string {
  if (need.source === 'other' && need.customSource?.trim()) {
    return `أخرى (${need.customSource.trim()})`;
  }
  return PLC_NEED_SOURCE_LABELS[need.source] ?? 'غير محدد';
}

// ----------------------------------------------------------------------------
// د) النموذج الرابع: الخطة التشغيلية والربط بالمعرفات الثابتة
// ----------------------------------------------------------------------------

export interface PlcPlanActionInput {
  goalId: string;
  needId?: string;
  needIds?: string[];
  title: string;
  responsibleMemberId?: string;
  responsibleName: string;
  startDate: string;
  endDate: string;
  resources: string;
  indicatorId?: string;
  indicatorText: string;
  status?: PlcActionExecutionStatus;
  completionPercentage?: number | null;
  notes?: string;
}

/**
 * يستخرج قائمة معرفات الاحتياجات المرتبطة بالإجراء بشكل موحد (سواء حُفظت في needId أو needIds).
 */
export function getPlcActionNeedIds(action: PlcPlanActionItem): string[] {
  const combined: string[] = [];
  if (Array.isArray(action.needIds)) {
    for (const id of action.needIds) {
      if (typeof id === 'string' && id.trim()) {
        combined.push(id.trim());
      }
    }
  }
  if (typeof action.needId === 'string' && action.needId.trim()) {
    combined.push(action.needId.trim());
  }
  return Array.from(new Set(combined));
}

function clampCompletionPercentage(
  val: number | null | undefined
): number | null {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return null;
  }
  const rounded = Math.round(Number(val));
  return Math.max(0, Math.min(100, rounded));
}

/**
 * يضيف إجراءً أو نشاطاً جديداً إلى الخطة التشغيلية مع ربطه بالهدف والاحتياجات والأعضاء بمعرفات ثابتة،
 * وعدم افتراض أي نسبة إنجاز وهمية.
 */
export function addPlcPlanActionItem(
  plan: PlcPlanActionItem[],
  input: PlcPlanActionInput
): PlcPlanActionItem[] {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return deepCloneCommunity(plan);

  const normalizedNeedIds = Array.from(
    new Set(
      [
        ...(Array.isArray(input.needIds) ? input.needIds : []),
        input.needId ?? '',
      ]
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

  const primaryNeedId = normalizedNeedIds[0] ?? '';

  const newAction: PlcPlanActionItem = {
    id: generatePlcEntityId('act'),
    goalId: input.goalId.trim(),
    needId: primaryNeedId,
    needIds: normalizedNeedIds,
    title: cleanTitle,
    responsibleMemberId: input.responsibleMemberId?.trim() || '',
    responsibleName: input.responsibleName.trim(),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    resources: input.resources.trim(),
    indicatorId: input.indicatorId?.trim() || '',
    indicatorText: input.indicatorText.trim(),
    status: input.status ?? 'not_started',
    completionPercentage: clampCompletionPercentage(input.completionPercentage),
    notes: input.notes?.trim() || '',
  };

  return [...deepCloneCommunity(plan), newAction];
}

/**
 * يعدل إجراءً موجوداً في الخطة التشغيلية بمعرفه الثابت.
 */
export function updatePlcPlanActionItem(
  plan: PlcPlanActionItem[],
  actionId: string,
  updates: Partial<PlcPlanActionInput>
): PlcPlanActionItem[] {
  return plan.map((item) => {
    if (item.id !== actionId) return deepCloneCommunity(item);

    let nextNeedIds = getPlcActionNeedIds(item);
    if (updates.needIds !== undefined || updates.needId !== undefined) {
      const candidateIds =
        updates.needIds !== undefined
          ? updates.needIds
          : updates.needId
            ? [updates.needId]
            : [];
      nextNeedIds = Array.from(
        new Set(candidateIds.map((id) => id.trim()).filter(Boolean))
      );
    }

    return {
      ...deepCloneCommunity(item),
      goalId:
        updates.goalId !== undefined ? updates.goalId.trim() : item.goalId,
      needId: nextNeedIds[0] ?? '',
      needIds: nextNeedIds,
      title:
        updates.title !== undefined && updates.title.trim()
          ? updates.title.trim()
          : item.title,
      responsibleMemberId:
        updates.responsibleMemberId !== undefined
          ? updates.responsibleMemberId.trim()
          : item.responsibleMemberId,
      responsibleName:
        updates.responsibleName !== undefined
          ? updates.responsibleName.trim()
          : item.responsibleName,
      startDate:
        updates.startDate !== undefined
          ? updates.startDate.trim()
          : item.startDate,
      endDate:
        updates.endDate !== undefined ? updates.endDate.trim() : item.endDate,
      resources:
        updates.resources !== undefined
          ? updates.resources.trim()
          : item.resources,
      indicatorId:
        updates.indicatorId !== undefined
          ? updates.indicatorId.trim()
          : item.indicatorId,
      indicatorText:
        updates.indicatorText !== undefined
          ? updates.indicatorText.trim()
          : item.indicatorText,
      status: updates.status ?? item.status,
      completionPercentage:
        updates.completionPercentage !== undefined
          ? clampCompletionPercentage(updates.completionPercentage)
          : item.completionPercentage ?? null,
      notes:
        updates.notes !== undefined ? updates.notes.trim() : item.notes ?? '',
    };
  });
}

/**
 * يحذف إجراءً من الخطة التشغيلية بمعرفه الثابت.
 */
export function deletePlcPlanActionItem(
  plan: PlcPlanActionItem[],
  actionId: string
): PlcPlanActionItem[] {
  return deepCloneCommunity(plan.filter((item) => item.id !== actionId));
}

export interface ResolvedPlcPlanActionLinks {
  goal: PlcIdentityListItem | null;
  goalText: string;
  linkedNeeds: Array<{
    need: PlcNeedItem;
    priorityLabel: string;
    sourceLabel: string;
  }>;
  responsibleMember: PlcMember | null;
  responsibleDisplayName: string;
}

/**
 * يسترجع تفاصيل الهدف والاحتياجات المهنية والعضو المسؤول المرتبطة بإجراء الخطة التشغيلية
 * عبر معرفاتها الثابتة (`ID`)، مما يضمن أن أي تعديل في الهدف أو الاحتياج أو العضو
 * ينعكس فوراً وتلقائياً في الخطة التشغيلية دون تكرار أو انفصال للبيانات.
 */
export function resolvePlcPlanActionLinks(
  action: PlcPlanActionItem,
  community: Pick<PlcCommunityRecord, 'identity' | 'needs' | 'members'>
): ResolvedPlcPlanActionLinks {
  const goal =
    community.identity.goals.find((g) => g.id === action.goalId) ?? null;

  const needIds = getPlcActionNeedIds(action);
  const linkedNeeds = needIds
    .map((nId) => community.needs.find((n) => n.id === nId))
    .filter((n): n is PlcNeedItem => Boolean(n))
    .map((need) => ({
      need,
      priorityLabel: PLC_PRIORITY_LABELS[need.priority],
      sourceLabel: getPlcNeedSourceDisplayLabel(need),
    }));

  const responsibleMember = action.responsibleMemberId
    ? community.members.find((m) => m.id === action.responsibleMemberId) ?? null
    : null;

  const responsibleDisplayName = action.responsibleMemberId
    ? responsibleMember?.name || 'غير محدد'
    : action.responsibleName?.trim() || 'غير محدد';

  return {
    goal,
    goalText: goal?.text || 'غير مرتبط بهدف محدد',
    linkedNeeds,
    responsibleMember,
    responsibleDisplayName,
  };
}

// ============================================================================
// ١٠. الدفعة الثالثة: الاجتماعات والتنفيذ والتوثيق (النموذجان ٥ و ٦ + الشواهد + QR)
// ============================================================================

// ----------------------------------------------------------------------------
// أ) رمز الاستجابة السريعة (QR Code) الآمن لكل سجل دون بيانات شخصية حساسة
// ----------------------------------------------------------------------------

export type PlcQrRecordKind = 'meeting' | 'activity';

export interface ParsedPlcRecordQrPayload {
  communityId: string;
  recordKind: PlcQrRecordKind;
  recordId: string;
  token: string;
}

/**
 * ينشئ المسار الداخلي الآمن (Internal Deep Link) الخاص برمز QR للسجل.
 * يحتوي حصرياً على معرف المجتمع ومعرف السجل ورمز التحقق الداخلي،
 * ولا يضع أي بيانات شخصية للمعلمين أو محتوى الشواهد داخل رمز QR.
 */
export function buildPlcRecordQrPayload(
  communityId: string,
  recordKind: PlcQrRecordKind,
  recordId: string,
  qrCodeToken?: string
): string {
  const safeCommId = encodeURIComponent(communityId.trim());
  const safeRecId = encodeURIComponent(recordId.trim());
  const safeToken = encodeURIComponent((qrCodeToken || recordId).trim());
  return `plc://community/${safeCommId}/${recordKind}/${safeRecId}?token=${safeToken}`;
}

/**
 * يفكك المسار الداخلي لرمز QR عند مسحه لفتح السجل الصحيح داخل التطبيق المحمي.
 */
export function parsePlcRecordQrPayload(
  payload: string
): ParsedPlcRecordQrPayload | null {
  if (!payload || typeof payload !== 'string') return null;
  const trimmed = payload.trim();
  const match = /^plc:\/\/community\/([^/]+)\/(meeting|activity)\/([^?]+)(?:\?token=(.+))?$/.exec(
    trimmed
  );
  if (!match) return null;
  return {
    communityId: decodeURIComponent(match[1]),
    recordKind: match[2] as PlcQrRecordKind,
    recordId: decodeURIComponent(match[3]),
    token: match[4] ? decodeURIComponent(match[4]) : '',
  };
}

/**
 * يولد مصفوفة QR القياسية (ISO/IEC 18004) للسجل (قابلة للفحص والتضمين في PDF).
 */
export function generatePlcRecordQrMatrix(
  communityId: string,
  recordKind: PlcQrRecordKind,
  recordId: string,
  qrCodeToken?: string,
  quietZone = 3
): boolean[][] {
  const payload = buildPlcRecordQrPayload(
    communityId,
    recordKind,
    recordId,
    qrCodeToken
  );
  return generateQrMatrix(payload, quietZone);
}

/**
 * يتحقق من قراءة رمز QR للسجل واستخراج المسار الداخلي منه.
 */
export function verifyPlcRecordQrMatrix(
  matrix: boolean[][],
  quietZone = 3
): ParsedPlcRecordQrPayload | null {
  const decoded = decodeQrMatrix(matrix, quietZone);
  return parsePlcRecordQrPayload(decoded);
}

/**
 * يولد صورة SVG Data URL لرمز QR لعرضها في واجهة المستخدم والتقارير.
 */
export function generatePlcRecordQrSvgDataUrl(
  communityId: string,
  recordKind: PlcQrRecordKind,
  recordId: string,
  qrCodeToken?: string
): string {
  const payload = buildPlcRecordQrPayload(
    communityId,
    recordKind,
    recordId,
    qrCodeToken
  );
  return generateQrSvgDataUrl(payload, PLC_SECTION_THEME.primaryHex, '#FFFFFF', 3);
}

// ----------------------------------------------------------------------------
// ب) النموذج الخامس: الاجتماعات ومحاضرها (الحضور والغياب والتوصيات والربط بالخطة)
// ----------------------------------------------------------------------------

export interface PlcMeetingInput {
  meetingNumber?: number;
  date: string;
  meetingType: string;
  venue?: string;
  attendance?: PlcMeetingAttendanceEntry[];
  agenda?: string[];
  discussionSummary?: string;
  recommendations?: PlcMeetingRecommendation[];
  evidenceIds?: string[];
}

/**
 * يبني قائمة الحضور والغياب الابتدائية بالاعتماد المباشر على معرفات أعضاء المجتمع المسجلين في النموذج الأول،
 * دون إعادة كتابة أسمائهم يدوياً.
 */
export function buildInitialMeetingAttendanceFromMembers(
  members: PlcMember[]
): PlcMeetingAttendanceEntry[] {
  return members.map((m) => ({
    memberId: m.id,
    present: true,
    absenceNote: '',
  }));
}

/**
 * يضيف اجتماعاً جديداً كسجل مستقل تماماً دون استبدال الاجتماعات السابقة،
 * مع توليد معرف ثابت ورمز QR مستقل.
 */
export function addPlcMeetingRecord(
  meetings: PlcMeetingRecord[],
  input: PlcMeetingInput,
  communityMembers: PlcMember[] = [],
  defaultVenue = ''
): PlcMeetingRecord[] {
  const nextNumber =
    input.meetingNumber && input.meetingNumber > 0
      ? input.meetingNumber
      : meetings.reduce((max, m) => Math.max(max, m.meetingNumber || 0), 0) + 1;

  const attendanceList: PlcMeetingAttendanceEntry[] =
    Array.isArray(input.attendance) && input.attendance.length > 0
      ? input.attendance.map((a) => ({
          memberId: a.memberId,
          present: Boolean(a.present),
          absenceNote: a.present ? '' : a.absenceNote?.trim() || '',
        }))
      : buildInitialMeetingAttendanceFromMembers(communityMembers);

  const newMeeting: PlcMeetingRecord = {
    id: generatePlcEntityId('mtg'),
    meetingNumber: nextNumber,
    date: input.date.trim() || new Date().toISOString().slice(0, 10),
    meetingType: input.meetingType.trim() || 'اجتماع دوري',
    venue: input.venue?.trim() || defaultVenue.trim() || '',
    attendance: attendanceList,
    agenda: Array.isArray(input.agenda)
      ? input.agenda.map((item) => item.trim()).filter(Boolean)
      : [],
    discussionSummary: input.discussionSummary?.trim() || '',
    recommendations: Array.isArray(input.recommendations)
      ? input.recommendations.map((rec) => ({
          id: rec.id || generatePlcEntityId('rec'),
          text: rec.text.trim(),
          responsibleMemberId: rec.responsibleMemberId?.trim() || '',
          responsibleName: rec.responsibleMemberId
            ? ''
            : rec.responsibleName?.trim() || '',
          targetDate: rec.targetDate?.trim() || '',
          followupStatus: rec.followupStatus || 'not_started',
          followupNotes: rec.followupNotes?.trim() || '',
          linkedActionId: rec.linkedActionId?.trim() || '',
        }))
      : [],
    evidenceIds: Array.isArray(input.evidenceIds)
      ? input.evidenceIds.slice(0, PLC_MAX_EVIDENCES_PER_RECORD)
      : [],
    qrCodeToken: generatePlcEntityId('qrmtg'),
  };

  return [...deepCloneCommunity(meetings), newMeeting];
}

/**
 * يعدل بيانات اجتماع محدد بمعرفه الثابت دون المساس ببقية الاجتماعات.
 */
export function updatePlcMeetingRecord(
  meetings: PlcMeetingRecord[],
  meetingId: string,
  updates: Partial<PlcMeetingInput>
): PlcMeetingRecord[] {
  return meetings.map((mtg) => {
    if (mtg.id !== meetingId) return deepCloneCommunity(mtg);

    return {
      ...deepCloneCommunity(mtg),
      meetingNumber:
        updates.meetingNumber !== undefined && updates.meetingNumber > 0
          ? updates.meetingNumber
          : mtg.meetingNumber,
      date: updates.date !== undefined ? updates.date.trim() : mtg.date,
      meetingType:
        updates.meetingType !== undefined && updates.meetingType.trim()
          ? updates.meetingType.trim()
          : mtg.meetingType,
      venue: updates.venue !== undefined ? updates.venue.trim() : mtg.venue,
      attendance:
        updates.attendance !== undefined
          ? updates.attendance.map((a) => ({
              memberId: a.memberId,
              present: Boolean(a.present),
              absenceNote: a.present ? '' : a.absenceNote?.trim() || '',
            }))
          : mtg.attendance,
      agenda:
        updates.agenda !== undefined
          ? updates.agenda.map((item) => item.trim()).filter(Boolean)
          : mtg.agenda,
      discussionSummary:
        updates.discussionSummary !== undefined
          ? updates.discussionSummary.trim()
          : mtg.discussionSummary,
      recommendations:
        updates.recommendations !== undefined
          ? updates.recommendations.map((rec) => ({
              id: rec.id || generatePlcEntityId('rec'),
              text: rec.text.trim(),
              responsibleMemberId: rec.responsibleMemberId?.trim() || '',
              responsibleName: rec.responsibleMemberId
                ? ''
                : rec.responsibleName?.trim() || '',
              targetDate: rec.targetDate?.trim() || '',
              followupStatus: rec.followupStatus || 'not_started',
              followupNotes: rec.followupNotes?.trim() || '',
              linkedActionId: rec.linkedActionId?.trim() || '',
            }))
          : mtg.recommendations,
      evidenceIds:
        updates.evidenceIds !== undefined
          ? updates.evidenceIds.slice(0, PLC_MAX_EVIDENCES_PER_RECORD)
          : mtg.evidenceIds ?? [],
      qrCodeToken: mtg.qrCodeToken || generatePlcEntityId('qrmtg'),
    };
  });
}

/**
 * يحذف اجتماعاً محدداً فقط دون حذف أعضاء المجتمع أو الخطة أو الإجراءات المرتبطة به.
 */
export function deletePlcMeetingRecord(
  meetings: PlcMeetingRecord[],
  meetingId: string
): PlcMeetingRecord[] {
  return deepCloneCommunity(meetings.filter((mtg) => mtg.id !== meetingId));
}

export interface ResolvedPlcMeetingAttendanceItem {
  memberId: string;
  member: PlcMember | null;
  displayName: string;
  specialty: string;
  rolesLabels: string[];
  present: boolean;
  absenceNote: string;
  isDeletedMember: boolean;
}

/**
 * يسترجع قائمة الحضور والغياب للاجتماع بالاعتماد المباشر على معرفات الأعضاء في النموذج الأول؛
 * بحيث ينعكس تعديل اسم العضو أو تخصصه في النموذج الأول تلقائياً في جميع الاجتماعات دون نسخ نصي منفصل.
 */
export function resolvePlcMeetingAttendance(
  meeting: PlcMeetingRecord,
  community: Pick<PlcCommunityRecord, 'members'>
): ResolvedPlcMeetingAttendanceItem[] {
  return meeting.attendance.map((entry) => {
    const foundMember =
      community.members.find((m) => m.id === entry.memberId) ?? null;

    return {
      memberId: entry.memberId,
      member: foundMember,
      displayName: foundMember ? foundMember.name : 'عضو غير محدد أو محذوف',
      specialty: foundMember?.specialty || '',
      rolesLabels: foundMember
        ? foundMember.roles.map((r) => PLC_MEMBER_ROLE_LABELS[r])
        : [],
      present: Boolean(entry.present),
      absenceNote: entry.absenceNote || '',
      isDeletedMember: !foundMember,
    };
  });
}

export interface ResolvedPlcMeetingRecommendation {
  recommendation: PlcMeetingRecommendation;
  responsibleMember: PlcMember | null;
  responsibleDisplayName: string;
  linkedAction: PlcPlanActionItem | null;
  linkedActionDisplayTitle: string;
  isLinkedActionDeleted: boolean;
  followupStatusLabel: string;
}

/**
 * يسترجع تفاصيل التوصية وعلاقتها بالعضو المسؤول وبإجراء الخطة التشغيلية عبر المعرفات الثابتة (`IDs`).
 * - إذا عُدل اسم العضو في النموذج الأول، يظهر الاسم المحدث تلقائياً.
 * - إذا عُدل عنوان الإجراء في الخطة التشغيلية، يظهر العنوان المحدث تلقائياً.
 * - إذا حُذف الإجراء المرتبط من الخطة، تبقى التوصية محفوظة ويظهر الارتباط بأنه «إجراء محذوف أو غير محدد» دون اختلاق إجراء بديل أو إظهار نص قديم.
 */
export function resolvePlcMeetingRecommendationLinks(
  recommendation: PlcMeetingRecommendation,
  community: Pick<PlcCommunityRecord, 'members' | 'operationalPlan'>
): ResolvedPlcMeetingRecommendation {
  const responsibleMember = recommendation.responsibleMemberId
    ? community.members.find(
        (m) => m.id === recommendation.responsibleMemberId
      ) ?? null
    : null;

  const responsibleDisplayName = recommendation.responsibleMemberId
    ? responsibleMember?.name || 'غير محدد'
    : recommendation.responsibleName?.trim() || 'غير محدد';

  const hasLinkedActionId = Boolean(
    recommendation.linkedActionId && recommendation.linkedActionId.trim()
  );

  const linkedAction = hasLinkedActionId
    ? community.operationalPlan.find(
        (a) => a.id === recommendation.linkedActionId
      ) ?? null
    : null;

  const isLinkedActionDeleted = hasLinkedActionId && !linkedAction;

  const linkedActionDisplayTitle = !hasLinkedActionId
    ? 'غير مرتبط بإجراء في الخطة'
    : linkedAction
      ? linkedAction.title
      : 'إجراء محذوف أو غير محدد';

  return {
    recommendation,
    responsibleMember,
    responsibleDisplayName,
    linkedAction,
    linkedActionDisplayTitle,
    isLinkedActionDeleted,
    followupStatusLabel:
      PLC_FOLLOWUP_STATUS_LABELS[recommendation.followupStatus] ?? 'لم يبدأ',
  };
}

export interface PlcMeetingsFilterOptions {
  searchQuery?: string;
  sortBy?: 'number_asc' | 'number_desc' | 'date_desc' | 'date_asc';
}

export function filterAndSortPlcMeetings(
  meetings: PlcMeetingRecord[],
  community: Pick<PlcCommunityRecord, 'members' | 'operationalPlan'>,
  options: PlcMeetingsFilterOptions = {}
): PlcMeetingRecord[] {
  const q = (options.searchQuery ?? '').trim().toLowerCase();
  const sortBy = options.sortBy ?? 'number_asc';

  const filtered = meetings.filter((mtg) => {
    if (!q) return true;
    const resolvedRecs = mtg.recommendations.map((r) =>
      resolvePlcMeetingRecommendationLinks(r, community)
    );
    const haystack = [
      String(mtg.meetingNumber),
      mtg.date,
      mtg.meetingType,
      mtg.venue,
      mtg.discussionSummary,
      ...mtg.agenda,
      ...resolvedRecs.map(
        (rr) =>
          `${rr.recommendation.text} ${rr.responsibleDisplayName} ${rr.linkedActionDisplayTitle}`
      ),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  return [...deepCloneCommunity(filtered)].sort((a, b) => {
    if (sortBy === 'number_desc') return b.meetingNumber - a.meetingNumber;
    if (sortBy === 'date_desc') return b.date.localeCompare(a.date);
    if (sortBy === 'date_asc') return a.date.localeCompare(b.date);
    return a.meetingNumber - b.meetingNumber;
  });
}

export interface PlcMeetingsOverviewSummary {
  totalMeetingsCount: number;
  latestMeeting: PlcMeetingRecord | null;
  totalRecommendationsCount: number;
  completedRecommendationsCount: number;
  inProgressRecommendationsCount: number;
  delayedRecommendationsCount: number;
  notStartedRecommendationsCount: number;
}

export function computePlcMeetingsOverview(
  community: Pick<PlcCommunityRecord, 'meetings'>
): PlcMeetingsOverviewSummary {
  const sortedByDateDesc = [...community.meetings].sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    return b.meetingNumber - a.meetingNumber;
  });

  let totalRecommendationsCount = 0;
  let completedRecommendationsCount = 0;
  let inProgressRecommendationsCount = 0;
  let delayedRecommendationsCount = 0;
  let notStartedRecommendationsCount = 0;

  for (const mtg of community.meetings) {
    for (const rec of mtg.recommendations) {
      totalRecommendationsCount += 1;
      if (rec.followupStatus === 'completed') {
        completedRecommendationsCount += 1;
      } else if (
        rec.followupStatus === 'in_progress' ||
        rec.followupStatus === 'pending'
      ) {
        inProgressRecommendationsCount += 1;
      } else if (rec.followupStatus === 'delayed') {
        delayedRecommendationsCount += 1;
      } else if (rec.followupStatus === 'not_started') {
        notStartedRecommendationsCount += 1;
      }
    }
  }

  return {
    totalMeetingsCount: community.meetings.length,
    latestMeeting: sortedByDateDesc[0] ?? null,
    totalRecommendationsCount,
    completedRecommendationsCount,
    inProgressRecommendationsCount,
    delayedRecommendationsCount,
    notStartedRecommendationsCount,
  };
}

// ----------------------------------------------------------------------------
// ج) النموذج السادس: البرامج والأنشطة والزيارات والشراكات
// ----------------------------------------------------------------------------

export interface PlcActivityRecordInput {
  title: string;
  type: PlcActivityRecordType;
  goalId?: string;
  needId?: string;
  actionId?: string;
  objectiveText?: string;
  targetAudience: string;
  executionDateOrPeriod: string;
  responsibleMemberIds?: string[];
  responsibleNames?: string;
  actualExecutionDescription?: string;
  results?: string;
  status?: PlcActivityRecordStatus;
  hostOrVisitingEntity?: string;
  participantsText?: string;
  keyObservations?: string;
  lessonsLearned?: string;
  partnerEntity?: string;
  partnershipType?: string;
  evidenceIds?: string[];
}

/**
 * ينشئ سجل تنفيذ جديداً (برنامج / نشاط / زيارة متبادلة / شراكة مجتمعية) بمعرف ثابت وفريد ورمز QR مستقل.
 * ملاحظة منهجية: لا يحول السجل تلقائياً من «مخطط له» إلى «منفذ»، بل يلتزم بالحالة التي يحددها المستخدم.
 */
export function addPlcActivityRecord(
  activities: PlcActivityRecord[],
  input: PlcActivityRecordInput
): PlcActivityRecord[] {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) return deepCloneCommunity(activities);

  const memberIds = Array.isArray(input.responsibleMemberIds)
    ? Array.from(
        new Set(input.responsibleMemberIds.map((id) => id.trim()).filter(Boolean))
      )
    : [];

  const newRecord: PlcActivityRecord = {
    id: generatePlcEntityId('actv'),
    title: cleanTitle,
    type: input.type,
    goalId: input.goalId?.trim() || '',
    needId: input.needId?.trim() || '',
    actionId: input.actionId?.trim() || '',
    // إذا كان مرتبطاً بهدف مسجل بالمعرف ولم يدخل المستخدم نصاً مخصصاً، يبقى النص المخصص فارغاً ليُعرض نص الهدف المرتبط حياً دون تكرار
    objectiveText: input.objectiveText?.trim() || '',
    targetAudience: input.targetAudience.trim(),
    executionDateOrPeriod: input.executionDateOrPeriod.trim(),
    responsibleMemberIds: memberIds,
    responsibleNames:
      memberIds.length > 0 ? '' : input.responsibleNames?.trim() || '',
    actualExecutionDescription:
      input.actualExecutionDescription?.trim() || '',
    results: input.results?.trim() || '',
    status: input.status ?? 'planned',
    hostOrVisitingEntity:
      input.type === 'mutual_visit'
        ? input.hostOrVisitingEntity?.trim() || ''
        : '',
    participantsText:
      input.type === 'mutual_visit' ? input.participantsText?.trim() || '' : '',
    keyObservations:
      input.type === 'mutual_visit' ? input.keyObservations?.trim() || '' : '',
    lessonsLearned:
      input.type === 'mutual_visit' ? input.lessonsLearned?.trim() || '' : '',
    partnerEntity:
      input.type === 'community_partnership'
        ? input.partnerEntity?.trim() || ''
        : '',
    partnershipType:
      input.type === 'community_partnership'
        ? input.partnershipType?.trim() || ''
        : '',
    evidenceIds: Array.isArray(input.evidenceIds)
      ? input.evidenceIds.slice(0, PLC_MAX_EVIDENCES_PER_RECORD)
      : [],
    qrCodeToken: generatePlcEntityId('qractv'),
  };

  return [...deepCloneCommunity(activities), newRecord];
}

/**
 * يعدل سجل تنفيذ قائماً بمعرفه الثابت دون المساس ببقية السجلات.
 */
export function updatePlcActivityRecord(
  activities: PlcActivityRecord[],
  recordId: string,
  updates: Partial<PlcActivityRecordInput>
): PlcActivityRecord[] {
  return activities.map((rec) => {
    if (rec.id !== recordId) return deepCloneCommunity(rec);

    const nextType = updates.type ?? rec.type;
    const nextMemberIds =
      updates.responsibleMemberIds !== undefined
        ? Array.from(
            new Set(
              updates.responsibleMemberIds.map((id) => id.trim()).filter(Boolean)
            )
          )
        : rec.responsibleMemberIds ?? [];

    return {
      ...deepCloneCommunity(rec),
      title:
        updates.title !== undefined && updates.title.trim()
          ? updates.title.trim()
          : rec.title,
      type: nextType,
      goalId:
        updates.goalId !== undefined ? updates.goalId.trim() : rec.goalId ?? '',
      needId:
        updates.needId !== undefined ? updates.needId.trim() : rec.needId ?? '',
      actionId:
        updates.actionId !== undefined
          ? updates.actionId.trim()
          : rec.actionId ?? '',
      objectiveText:
        updates.objectiveText !== undefined
          ? updates.objectiveText.trim()
          : rec.objectiveText,
      targetAudience:
        updates.targetAudience !== undefined
          ? updates.targetAudience.trim()
          : rec.targetAudience,
      executionDateOrPeriod:
        updates.executionDateOrPeriod !== undefined
          ? updates.executionDateOrPeriod.trim()
          : rec.executionDateOrPeriod,
      responsibleMemberIds: nextMemberIds,
      responsibleNames:
        nextMemberIds.length > 0
          ? ''
          : updates.responsibleNames !== undefined
            ? updates.responsibleNames.trim()
            : rec.responsibleNames,
      actualExecutionDescription:
        updates.actualExecutionDescription !== undefined
          ? updates.actualExecutionDescription.trim()
          : rec.actualExecutionDescription,
      results:
        updates.results !== undefined ? updates.results.trim() : rec.results,
      status: updates.status ?? rec.status,
      hostOrVisitingEntity:
        nextType === 'mutual_visit'
          ? updates.hostOrVisitingEntity !== undefined
            ? updates.hostOrVisitingEntity.trim()
            : rec.hostOrVisitingEntity ?? ''
          : '',
      participantsText:
        nextType === 'mutual_visit'
          ? updates.participantsText !== undefined
            ? updates.participantsText.trim()
            : rec.participantsText ?? ''
          : '',
      keyObservations:
        nextType === 'mutual_visit'
          ? updates.keyObservations !== undefined
            ? updates.keyObservations.trim()
            : rec.keyObservations ?? ''
          : '',
      lessonsLearned:
        nextType === 'mutual_visit'
          ? updates.lessonsLearned !== undefined
            ? updates.lessonsLearned.trim()
            : rec.lessonsLearned ?? ''
          : '',
      partnerEntity:
        nextType === 'community_partnership'
          ? updates.partnerEntity !== undefined
            ? updates.partnerEntity.trim()
            : rec.partnerEntity ?? ''
          : '',
      partnershipType:
        nextType === 'community_partnership'
          ? updates.partnershipType !== undefined
            ? updates.partnershipType.trim()
            : rec.partnershipType ?? ''
          : '',
      evidenceIds:
        updates.evidenceIds !== undefined
          ? updates.evidenceIds.slice(0, PLC_MAX_EVIDENCES_PER_RECORD)
          : rec.evidenceIds ?? [],
      qrCodeToken: rec.qrCodeToken || generatePlcEntityId('qractv'),
    };
  });
}

/**
 * يحذف سجل التنفيذ فقط دون حذف الهدف أو الاحتياج أو الإجراء المرتبط به.
 */
export function deletePlcActivityRecord(
  activities: PlcActivityRecord[],
  recordId: string
): PlcActivityRecord[] {
  return deepCloneCommunity(activities.filter((rec) => rec.id !== recordId));
}

export interface ResolvedPlcActivityRecordLinks {
  linkedNeed: PlcNeedItem | null;
  linkedNeedDisplay: string;
  isNeedDeleted: boolean;
  linkedGoal: PlcIdentityListItem | null;
  linkedGoalDisplay: string;
  isGoalDeleted: boolean;
  linkedAction: PlcPlanActionItem | null;
  linkedActionDisplay: string;
  isActionDeleted: boolean;
  resolvedObjectiveText: string;
  responsibleMembers: PlcMember[];
  responsibleDisplayText: string;
  isPlannedOnly: boolean;
  isExecuted: boolean;
}

/**
 * يسترجع بيانات الاحتياج والهدف والإجراء والأعضاء المسؤولين المرتبطة بسجل التنفيذ عبر المعرفات الثابتة (`IDs`)،
 * دون تكرار تخزين النصوص، مع التمييز الصارم بين السجل «المخطط له» والسجل «المنفذ».
 */
export function resolvePlcActivityRecordLinks(
  record: PlcActivityRecord,
  community: Pick<
    PlcCommunityRecord,
    'identity' | 'needs' | 'operationalPlan' | 'members'
  >
): ResolvedPlcActivityRecordLinks {
  const hasNeedId = Boolean(record.needId && record.needId.trim());
  const linkedNeed = hasNeedId
    ? community.needs.find((n) => n.id === record.needId) ?? null
    : null;
  const isNeedDeleted = hasNeedId && !linkedNeed;
  const linkedNeedDisplay = !hasNeedId
    ? 'غير مرتبط باحتياج محدد'
    : linkedNeed
      ? `${linkedNeed.description} (أولوية: ${PLC_PRIORITY_LABELS[linkedNeed.priority]})`
      : 'احتياج محذوف أو غير محدد';

  const hasGoalId = Boolean(record.goalId && record.goalId.trim());
  const linkedGoal = hasGoalId
    ? community.identity.goals.find((g) => g.id === record.goalId) ?? null
    : null;
  const isGoalDeleted = hasGoalId && !linkedGoal;
  const linkedGoalDisplay = !hasGoalId
    ? 'غير مرتبط بهدف محدد'
    : linkedGoal
      ? linkedGoal.text
      : 'هدف محذوف أو غير محدد';

  const hasActionId = Boolean(record.actionId && record.actionId.trim());
  const linkedAction = hasActionId
    ? community.operationalPlan.find((a) => a.id === record.actionId) ?? null
    : null;
  const isActionDeleted = hasActionId && !linkedAction;
  const linkedActionDisplay = !hasActionId
    ? 'غير مرتبط بإجراء في الخطة'
    : linkedAction
      ? linkedAction.title
      : 'إجراء محذوف أو غير محدد';

  const resolvedObjectiveText =
    record.objectiveText?.trim() ||
    linkedGoal?.text ||
    linkedAction?.title ||
    'غير محدد';

  const memberIds = Array.isArray(record.responsibleMemberIds)
    ? record.responsibleMemberIds
    : [];
  const responsibleMembers = memberIds
    .map((mId) => community.members.find((m) => m.id === mId))
    .filter((m): m is PlcMember => Boolean(m));

  const responsibleDisplayText =
    memberIds.length > 0
      ? responsibleMembers.length > 0
        ? responsibleMembers.map((m) => m.name).join('، ')
        : 'غير محدد'
      : record.responsibleNames?.trim() || 'غير محدد';

  return {
    linkedNeed,
    linkedNeedDisplay,
    isNeedDeleted,
    linkedGoal,
    linkedGoalDisplay,
    isGoalDeleted,
    linkedAction,
    linkedActionDisplay,
    isActionDeleted,
    resolvedObjectiveText,
    responsibleMembers,
    responsibleDisplayText,
    isPlannedOnly: record.status === 'planned',
    isExecuted: record.status === 'completed',
  };
}

export interface PlcActivitiesFilterOptions {
  searchQuery?: string;
  typeFilter?: PlcActivityRecordType | 'all';
  statusFilter?: PlcActivityRecordStatus | 'all';
}

export function filterAndSortPlcActivities(
  activities: PlcActivityRecord[],
  community: Pick<
    PlcCommunityRecord,
    'identity' | 'needs' | 'operationalPlan' | 'members'
  >,
  options: PlcActivitiesFilterOptions = {}
): PlcActivityRecord[] {
  const q = (options.searchQuery ?? '').trim().toLowerCase();
  const typeFilter = options.typeFilter ?? 'all';
  const statusFilter = options.statusFilter ?? 'all';

  return deepCloneCommunity(
    activities.filter((act) => {
      if (typeFilter !== 'all' && act.type !== typeFilter) return false;
      if (statusFilter !== 'all' && act.status !== statusFilter) return false;
      if (q) {
        const resolved = resolvePlcActivityRecordLinks(act, community);
        const haystack = [
          act.title,
          PLC_ACTIVITY_TYPE_LABELS[act.type],
          PLC_ACTIVITY_STATUS_LABELS[act.status],
          act.targetAudience,
          act.executionDateOrPeriod,
          act.actualExecutionDescription,
          act.results,
          act.hostOrVisitingEntity ?? '',
          act.partnerEntity ?? '',
          resolved.resolvedObjectiveText,
          resolved.responsibleDisplayText,
          resolved.linkedGoalDisplay,
          resolved.linkedNeedDisplay,
          resolved.linkedActionDisplay,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
  );
}

export interface PlcExecutionOverviewSummary {
  totalRecordsCount: number;
  programsCount: number;
  activitiesCount: number;
  mutualVisitsCount: number;
  partnershipsCount: number;
  plannedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
}

export function computePlcExecutionOverview(
  community: Pick<PlcCommunityRecord, 'activities'>
): PlcExecutionOverviewSummary {
  let programsCount = 0;
  let activitiesCount = 0;
  let mutualVisitsCount = 0;
  let partnershipsCount = 0;
  let plannedCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;

  for (const rec of community.activities) {
    if (rec.type === 'program') programsCount += 1;
    else if (rec.type === 'activity') activitiesCount += 1;
    else if (rec.type === 'mutual_visit') mutualVisitsCount += 1;
    else if (rec.type === 'community_partnership') partnershipsCount += 1;

    if (rec.status === 'planned') plannedCount += 1;
    else if (rec.status === 'in_progress') inProgressCount += 1;
    else if (rec.status === 'completed') completedCount += 1;
    else if (rec.status === 'cancelled') cancelledCount += 1;
  }

  return {
    totalRecordsCount: community.activities.length,
    programsCount,
    activitiesCount,
    mutualVisitsCount,
    partnershipsCount,
    plannedCount,
    inProgressCount,
    completedCount,
    cancelledCount,
  };
}

// ----------------------------------------------------------------------------
// د) إدارة الشواهد والمرفقات الاختيارية المرتبطة بسجلات التنفيذ والاجتماعات (بحد أقصى ٤ شواهد للسجل)
// ----------------------------------------------------------------------------

export interface PlcEvidenceUploadInput {
  existingEvidenceId?: string; // لربط شاهد موجود مسبقاً في مستودع الشواهد دون تكرار رفعه
  title?: string;
  category?: string;
  description?: string;
  fileName: string;
  mimeType: string;
  fileDataUrl?: string;
  externalUrl?: string;
}

export interface PlcEvidenceOperationResult {
  ok: boolean;
  error?: string;
  evidence?: PlcEvidenceItem;
  community: PlcCommunityRecord;
}

/**
 * يسترجع الشواهد المرتبطة بسجل معين من مستودع الشواهد الموحد للمجتمع.
 */
export function getPlcRecordEvidences(
  community: Pick<PlcCommunityRecord, 'evidenceRepository'>,
  evidenceIds?: string[]
): PlcEvidenceItem[] {
  if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) return [];
  return evidenceIds
    .map((id) => community.evidenceRepository.find((ev) => ev.id === id))
    .filter((ev): ev is PlcEvidenceItem => Boolean(ev));
}

/**
 * يرفق شاهداً بسجل تنفيذ أو اجتماع مع التحقق الصارم من الحد الأقصى (٤ شواهد لكل سجل)،
 * ومنع تكرار رفع الشاهد إذا كان موجوداً أصلاً في مستودع الشواهد الموحد للمجتمع.
 */
export function attachPlcEvidenceToRecord(
  community: PlcCommunityRecord,
  targetType: 'activity' | 'meeting',
  targetId: string,
  input: PlcEvidenceUploadInput
): PlcEvidenceOperationResult {
  const cloned = deepCloneCommunity(community);

  const currentEvidenceIds: string[] =
    targetType === 'activity'
      ? cloned.activities.find((a) => a.id === targetId)?.evidenceIds ?? []
      : cloned.meetings.find((m) => m.id === targetId)?.evidenceIds ?? [];

  if (currentEvidenceIds.length >= PLC_MAX_EVIDENCES_PER_RECORD) {
    return {
      ok: false,
      error: `لا يمكن إرفاق أكثر من ${PLC_MAX_EVIDENCES_PER_RECORD} شواهد للسجل الواحد (الحد الأقصى ٤ مرفقات).`,
      community: cloned,
    };
  }

  // التحقق مما إذا كان الشاهد موجوداً مسبقاً في المستودع (بمعرفه أو بتطابق اسم الملف والمحتوى) لمنع تكرار رفعه
  let targetEvidence = input.existingEvidenceId
    ? cloned.evidenceRepository.find((e) => e.id === input.existingEvidenceId)
    : cloned.evidenceRepository.find(
        (e) =>
          e.fileName === input.fileName.trim() &&
          Boolean(input.fileDataUrl) &&
          e.fileDataUrl === input.fileDataUrl
      );

  if (targetEvidence) {
    if (currentEvidenceIds.includes(targetEvidence.id)) {
      return {
        ok: false,
        error: 'هذا الشاهد مرتبط بالفعل بهذا السجل.',
        community: cloned,
      };
    }
    const hasLink = targetEvidence.links.some(
      (l) => l.targetType === targetType && l.targetId === targetId
    );
    if (!hasLink) {
      targetEvidence.links.push({ targetType, targetId });
    }
  } else {
    targetEvidence = {
      id: generatePlcEntityId('evd'),
      title: input.title?.trim() || input.fileName.trim() || 'شاهد توثيقي',
      category:
        input.category?.trim() ||
        (targetType === 'activity' ? 'شاهد تنفيذ' : 'شاهد اجتماع'),
      description: input.description?.trim() || '',
      fileName: input.fileName.trim(),
      mimeType: input.mimeType.trim() || 'application/octet-stream',
      fileDataUrl: input.fileDataUrl || '',
      externalUrl: input.externalUrl?.trim() || '',
      createdAt: new Date().toISOString(),
      links: [{ targetType, targetId }],
    };
    cloned.evidenceRepository.push(targetEvidence);
  }

  const nextEvidenceIds = [...currentEvidenceIds, targetEvidence.id];

  if (targetType === 'activity') {
    cloned.activities = cloned.activities.map((a) =>
      a.id === targetId ? { ...a, evidenceIds: nextEvidenceIds } : a
    );
  } else {
    cloned.meetings = cloned.meetings.map((m) =>
      m.id === targetId ? { ...m, evidenceIds: nextEvidenceIds } : m
    );
  }

  return {
    ok: true,
    evidence: targetEvidence,
    community: cloned,
  };
}

/**
 * يستبدل شاهداً مرتبطاً بسجل تنفيذ أو اجتماع بشاهد جديد مع الحفاظ على الحد الأقصى (٤ مرفقات).
 */
export function replacePlcEvidenceOnRecord(
  community: PlcCommunityRecord,
  targetType: 'activity' | 'meeting',
  targetId: string,
  oldEvidenceId: string,
  newInput: PlcEvidenceUploadInput
): PlcEvidenceOperationResult {
  const cloned = deepCloneCommunity(community);

  const newEvd: PlcEvidenceItem = {
    id: generatePlcEntityId('evd'),
    title: newInput.title?.trim() || newInput.fileName.trim() || 'شاهد توثيقي',
    category:
      newInput.category?.trim() ||
      (targetType === 'activity' ? 'شاهد تنفيذ' : 'شاهد اجتماع'),
    description: newInput.description?.trim() || '',
    fileName: newInput.fileName.trim(),
    mimeType: newInput.mimeType.trim() || 'application/octet-stream',
    fileDataUrl: newInput.fileDataUrl || '',
    externalUrl: newInput.externalUrl?.trim() || '',
    createdAt: new Date().toISOString(),
    links: [{ targetType, targetId }],
  };

  cloned.evidenceRepository = cloned.evidenceRepository
    .map((ev) => {
      if (ev.id !== oldEvidenceId) return ev;
      return {
        ...ev,
        links: ev.links.filter(
          (l) => !(l.targetType === targetType && l.targetId === targetId)
        ),
      };
    })
    .filter((ev) => ev.links.length > 0);

  cloned.evidenceRepository.push(newEvd);

  if (targetType === 'activity') {
    cloned.activities = cloned.activities.map((a) =>
      a.id === targetId
        ? {
            ...a,
            evidenceIds: (a.evidenceIds ?? []).map((id) =>
              id === oldEvidenceId ? newEvd.id : id
            ),
          }
        : a
    );
  } else {
    cloned.meetings = cloned.meetings.map((m) =>
      m.id === targetId
        ? {
            ...m,
            evidenceIds: (m.evidenceIds ?? []).map((id) =>
              id === oldEvidenceId ? newEvd.id : id
            ),
          }
        : m
    );
  }

  return {
    ok: true,
    evidence: newEvd,
    community: cloned,
  };
}

/**
 * يحذف المرفق (الشاهد) المرتبط بذلك السجل فقط، دون حذف السجل نفسه.
 */
export function removePlcEvidenceFromRecord(
  community: PlcCommunityRecord,
  targetType: 'activity' | 'meeting',
  targetId: string,
  evidenceId: string
): PlcCommunityRecord {
  const cloned = deepCloneCommunity(community);

  if (targetType === 'activity') {
    cloned.activities = cloned.activities.map((a) =>
      a.id === targetId
        ? {
            ...a,
            evidenceIds: (a.evidenceIds ?? []).filter((id) => id !== evidenceId),
          }
        : a
    );
  } else {
    cloned.meetings = cloned.meetings.map((m) =>
      m.id === targetId
        ? {
            ...m,
            evidenceIds: (m.evidenceIds ?? []).filter((id) => id !== evidenceId),
          }
        : m
    );
  }

  cloned.evidenceRepository = cloned.evidenceRepository.map((ev) => {
    if (ev.id !== evidenceId) return ev;
    return {
      ...ev,
      links: ev.links.filter(
        (l) => !(l.targetType === targetType && l.targetId === targetId)
      ),
    };
  });

  return cloned;
}

// ============================================================================
// ١٢. الدفعة الرابعة: التقويم ومؤشرات الأداء وقياس الأثر (النموذج ٧)
//     ومستودع الشواهد والمرفقات الموحد (النموذج ٨)
// ============================================================================

export const PLC_KPI_DIRECTION_LABELS: Record<PlcKpiDirectionType, string> = {
  higher_is_better: 'كلما زادت القيمة كان أفضل',
  lower_is_better: 'كلما قلت القيمة كان أفضل',
  exact_target: 'الهدف قيمة محددة',
  not_applicable: 'لا ينطبق',
};

export const PLC_KPI_UNIT_OPTIONS: string[] = [
  'عدد',
  'نسبة مئوية',
  'درجة',
  'متوسط',
  'معدل',
  'ساعات',
  'أيام',
  'أخرى',
];

export const PLC_IMPACT_METHOD_LABELS: Record<
  PlcImpactMeasurementMethod,
  string
> = {
  pre_post_comparison: 'مقارنة قبل وبعد',
  student_results_analysis: 'تحليل نتائج الطلاب',
  classroom_observation: 'ملاحظة صفية',
  survey: 'استبانة',
  interview: 'مقابلة',
  performance_analysis: 'تحليل أداء',
  work_products_analysis: 'تحليل أعمال/منتجات',
  quantitative_indicator: 'مؤشر كمي',
  qualitative_indicator: 'مؤشر نوعي',
  other: 'أخرى',
};

export const PLC_IMPROVEMENT_DECISION_LABELS: Record<
  PlcImprovementDecisionType,
  string
> = {
  continue: 'الاستمرار',
  expand: 'التوسع',
  modify: 'التعديل',
  re_execute: 'إعادة التنفيذ',
  stop_action: 'إيقاف الإجراء',
  add_new_action: 'إضافة إجراء جديد',
  other: 'أخرى',
};

export const PLC_EVIDENCE_TYPE_LABELS: Record<PlcEvidenceType, string> = {
  pdf: 'PDF',
  image: 'صورة',
  document: 'مستند',
  presentation: 'عرض تقديمي',
  spreadsheet: 'جدول',
  link: 'رابط',
  other: 'أخرى',
};

export const PLC_EVIDENCE_TARGET_TYPE_LABELS: Record<
  PlcEvidenceLinkTargetType,
  string
> = {
  need: 'الاحتياج المهني',
  goal: 'الهدف',
  operational_plan: 'الخطة التشغيلية',
  plan_action: 'الإجراء التشغيلي',
  meeting: 'الاجتماع',
  program: 'البرنامج',
  activity: 'النشاط',
  mutual_visit: 'الزيارة المتبادلة',
  community_partnership: 'الشراكة المجتمعية',
  kpi: 'مؤشر الأداء',
  impact: 'قياس الأثر',
  final_report: 'التقرير الختامي',
};

// ----------------------------------------------------------------------------
// ٧.١ تقويم التنفيذ (مشتق تلقائياً من النموذج ٤ والنموذج ٦ دون اختلاق أرقام)
// ----------------------------------------------------------------------------

export interface PlcActivityTypeBreakdown {
  total: number;
  planned: number;
  inProgress: number;
  executed: number;
  cancelled: number;
}

export interface PlcDerivedExecutionEvaluationSummary {
  hasSufficientData: boolean;
  hasPlanData: boolean;
  hasActivitiesData: boolean;
  statusMessage: string;

  // إحصاءات الخطة التشغيلية (النموذج 4)
  plannedActionsTotalCount: number;
  executedActionsCount: number;
  inProgressActionsCount: number;
  notStartedActionsCount: number;
  stalledActionsCount: number;
  cancelledActionsCount: number;
  actualPlanCompletionPercentage: number | null;
  actualPlanCompletionDisplay: string;

  // إحصاءات البرامج والأنشطة والزيارات والشراكات (النموذج 6)
  totalExecutionRecordsCount: number;
  plannedExecutionRecordsCount: number;
  inProgressExecutionRecordsCount: number;
  executedExecutionRecordsCount: number;
  cancelledExecutionRecordsCount: number;
  actualActivitiesExecutionPercentage: number | null;
  actualActivitiesExecutionDisplay: string;

  // تفصيل حسب نوع السجل في النموذج 6
  byRecordType: {
    program: PlcActivityTypeBreakdown;
    activity: PlcActivityTypeBreakdown;
    mutual_visit: PlcActivityTypeBreakdown;
    community_partnership: PlcActivityTypeBreakdown;
  };
}

/**
 * يحسب ملخص تقويم التنفيذ آلياً من بيانات الخطة التشغيلية (النموذج 4) وسجلات التنفيذ (النموذج 6).
 * قاعدة صارمة: إذا لم توجد بيانات كافية للحساب، لا يعرض صفراً كنتيجة بل يعرض «لا توجد بيانات كافية للحساب».
 */
export function computePlcExecutionEvaluationSummary(
  community: Pick<PlcCommunityRecord, 'operationalPlan' | 'activities'>
): PlcDerivedExecutionEvaluationSummary {
  const plan = community.operationalPlan ?? [];
  const activities = community.activities ?? [];

  const hasPlanData = plan.length > 0;
  const hasActivitiesData = activities.length > 0;
  const hasSufficientData = hasPlanData || hasActivitiesData;

  let executedActionsCount = 0;
  let inProgressActionsCount = 0;
  let notStartedActionsCount = 0;
  let stalledActionsCount = 0;
  let cancelledActionsCount = 0;

  for (const act of plan) {
    if (act.status === 'completed') executedActionsCount += 1;
    else if (act.status === 'in_progress') inProgressActionsCount += 1;
    else if (act.status === 'not_started') notStartedActionsCount += 1;
    else if (act.status === 'stalled') stalledActionsCount += 1;
    else if (act.status === 'cancelled') cancelledActionsCount += 1;
  }

  const activePlanActions = plan.filter((a) => a.status !== 'cancelled');
  let actualPlanCompletionPercentage: number | null = null;
  let actualPlanCompletionDisplay = 'لا توجد بيانات كافية للحساب';

  if (activePlanActions.length > 0) {
    const hasAnyMeasuredOrExecuted = activePlanActions.some(
      (a) =>
        (a.completionPercentage !== null &&
          a.completionPercentage !== undefined &&
          !Number.isNaN(Number(a.completionPercentage))) ||
        a.status === 'completed' ||
        a.status === 'in_progress' ||
        a.status === 'stalled'
    );

    if (hasAnyMeasuredOrExecuted) {
      const sumPercentages = activePlanActions.reduce((acc, a) => {
        if (
          a.completionPercentage !== null &&
          a.completionPercentage !== undefined &&
          !Number.isNaN(Number(a.completionPercentage))
        ) {
          return acc + Math.max(0, Math.min(100, Number(a.completionPercentage)));
        }
        return acc + (a.status === 'completed' ? 100 : 0);
      }, 0);

      actualPlanCompletionPercentage =
        Math.round((sumPercentages / activePlanActions.length) * 10) / 10;
      actualPlanCompletionDisplay = `${actualPlanCompletionPercentage}%`;
    } else {
      actualPlanCompletionPercentage = null;
      actualPlanCompletionDisplay = 'لا توجد بيانات كافية للحساب';
    }
  }

  const createEmptyBreakdown = (): PlcActivityTypeBreakdown => ({
    total: 0,
    planned: 0,
    inProgress: 0,
    executed: 0,
    cancelled: 0,
  });

  const byRecordType = {
    program: createEmptyBreakdown(),
    activity: createEmptyBreakdown(),
    mutual_visit: createEmptyBreakdown(),
    community_partnership: createEmptyBreakdown(),
  };

  let plannedExecutionRecordsCount = 0;
  let inProgressExecutionRecordsCount = 0;
  let executedExecutionRecordsCount = 0;
  let cancelledExecutionRecordsCount = 0;

  for (const rec of activities) {
    const bucket = byRecordType[rec.type] ?? byRecordType.activity;
    bucket.total += 1;

    if (rec.status === 'planned') {
      plannedExecutionRecordsCount += 1;
      bucket.planned += 1;
    } else if (rec.status === 'in_progress') {
      inProgressExecutionRecordsCount += 1;
      bucket.inProgress += 1;
    } else if (rec.status === 'completed') {
      executedExecutionRecordsCount += 1;
      bucket.executed += 1;
    } else if (rec.status === 'cancelled') {
      cancelledExecutionRecordsCount += 1;
      bucket.cancelled += 1;
    }
  }

  const activeExecutionRecords = activities.filter(
    (r) => r.status !== 'cancelled'
  );
  let actualActivitiesExecutionPercentage: number | null = null;
  let actualActivitiesExecutionDisplay = 'لا توجد بيانات كافية للحساب';

  if (activeExecutionRecords.length > 0) {
    actualActivitiesExecutionPercentage =
      Math.round(
        (executedExecutionRecordsCount / activeExecutionRecords.length) *
          100 *
          10
      ) / 10;
    actualActivitiesExecutionDisplay = `${actualActivitiesExecutionPercentage}%`;
  }

  return {
    hasSufficientData,
    hasPlanData,
    hasActivitiesData,
    statusMessage: hasSufficientData
      ? 'البيانات مشتقة تلقائياً من الخطة التشغيلية وسجلات التنفيذ الفعلية'
      : 'لا توجد بيانات كافية للحساب',
    plannedActionsTotalCount: plan.length,
    executedActionsCount,
    inProgressActionsCount,
    notStartedActionsCount,
    stalledActionsCount,
    cancelledActionsCount,
    actualPlanCompletionPercentage,
    actualPlanCompletionDisplay,
    totalExecutionRecordsCount: activities.length,
    plannedExecutionRecordsCount,
    inProgressExecutionRecordsCount,
    executedExecutionRecordsCount,
    cancelledExecutionRecordsCount,
    actualActivitiesExecutionPercentage,
    actualActivitiesExecutionDisplay,
    byRecordType,
  };
}

export interface PlcExecutionEvaluationInput {
  targetKind?: PlcExecutionEvalTargetKind;
  actionOrActivityId: string;
  executionLevel: string;
  notes?: string;
  strengths?: string;
  improvements?: string;
}

export function addPlcExecutionEvaluationItem(
  items: PlcExecutionEvaluationItem[],
  input: PlcExecutionEvaluationInput
): PlcExecutionEvaluationItem[] {
  if (!input.actionOrActivityId.trim()) return deepCloneCommunity(items);

  const newItem: PlcExecutionEvaluationItem = {
    id: generatePlcEntityId('exeval'),
    targetKind: input.targetKind ?? 'plan_action',
    actionOrActivityId: input.actionOrActivityId.trim(),
    actionOrActivityTitle: '',
    executionLevel: input.executionLevel.trim() || 'منفذ وفق الخطة',
    notes: input.notes?.trim() || '',
    strengths: input.strengths?.trim() || '',
    improvements: input.improvements?.trim() || '',
  };

  return [...deepCloneCommunity(items), newItem];
}

export function updatePlcExecutionEvaluationItem(
  items: PlcExecutionEvaluationItem[],
  itemId: string,
  updates: Partial<PlcExecutionEvaluationInput>
): PlcExecutionEvaluationItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return deepCloneCommunity(item);
    return {
      ...deepCloneCommunity(item),
      targetKind: updates.targetKind ?? item.targetKind ?? 'plan_action',
      actionOrActivityId:
        updates.actionOrActivityId !== undefined
          ? updates.actionOrActivityId.trim()
          : item.actionOrActivityId,
      executionLevel:
        updates.executionLevel !== undefined
          ? updates.executionLevel.trim()
          : item.executionLevel,
      notes: updates.notes !== undefined ? updates.notes.trim() : item.notes,
      strengths:
        updates.strengths !== undefined
          ? updates.strengths.trim()
          : item.strengths,
      improvements:
        updates.improvements !== undefined
          ? updates.improvements.trim()
          : item.improvements,
    };
  });
}

export function deletePlcExecutionEvaluationItem(
  items: PlcExecutionEvaluationItem[],
  itemId: string
): PlcExecutionEvaluationItem[] {
  return deepCloneCommunity(items.filter((i) => i.id !== itemId));
}

export function resolvePlcExecutionEvaluationLinks(
  item: PlcExecutionEvaluationItem,
  community: Pick<PlcCommunityRecord, 'operationalPlan' | 'activities'>
): {
  targetDisplayTitle: string;
  targetTypeLabel: string;
  targetStatusLabel: string;
  isDeleted: boolean;
} {
  const planMatch = community.operationalPlan.find(
    (a) => a.id === item.actionOrActivityId
  );
  if (planMatch) {
    return {
      targetDisplayTitle: planMatch.title,
      targetTypeLabel: 'إجراء في الخطة التشغيلية',
      targetStatusLabel: PLC_ACTION_STATUS_LABELS[planMatch.status],
      isDeleted: false,
    };
  }

  const activityMatch = community.activities.find(
    (a) => a.id === item.actionOrActivityId
  );
  if (activityMatch) {
    return {
      targetDisplayTitle: activityMatch.title,
      targetTypeLabel: PLC_ACTIVITY_TYPE_LABELS[activityMatch.type],
      targetStatusLabel: PLC_ACTIVITY_STATUS_LABELS[activityMatch.status],
      isDeleted: false,
    };
  }

  return {
    targetDisplayTitle: 'سجل محذوف أو غير متوفر',
    targetTypeLabel: 'غير متوفر',
    targetStatusLabel: 'غير متوفر',
    isDeleted: true,
  };
}

// ----------------------------------------------------------------------------
// ٧.٢ مؤشرات الأداء (KPIs — الجدول الديناميكي والحساب الآلي الذكي والتحقق)
// ----------------------------------------------------------------------------

export interface PlcKpiIndicatorInput {
  name: string;
  description?: string;
  linkedGoalId?: string;
  linkedNeedId?: string;
  linkedActionId?: string;
  linkedActivityId?: string;
  baselineValue?: number | null;
  targetValue?: number | null;
  achievedValue?: number | null;
  actualValue?: number | null; // مرادف اختياري للقيمة الفعلية
  unit?: string;
  customUnit?: string;
  targetUnit?: string;
  actualUnit?: string;
  indicatorType?: PlcKpiDirectionType;
  dataSource?: string;
  measurementPeriod?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  measurementDate?: string;
  calculationMethod?: string;
  notes?: string;
}

export interface PlcValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * يتحقق من صحة بيانات مؤشر الأداء قبل حفظه أو تعديله.
 */
export function validatePlcKpiIndicatorInput(
  input: Partial<PlcKpiIndicatorInput>
): PlcValidationResult {
  const cleanName = (input.name ?? '').trim();
  if (!cleanName) {
    return {
      valid: false,
      error: 'لا يمكن تسجيل مؤشر أداء بدون اسم المؤشر.',
    };
  }

  if (
    input.targetUnit &&
    input.actualUnit &&
    input.targetUnit.trim() !== input.actualUnit.trim()
  ) {
    return {
      valid: false,
      error:
        'لا يمكن تسجيل نتيجة فعلية بوحدة قياس مختلفة عن وحدة المستهدف.',
    };
  }

  const unitLabel = (input.unit ?? '').trim();
  const isPercentageUnit =
    unitLabel === 'نسبة مئوية' ||
    unitLabel === '%' ||
    unitLabel.toLowerCase() === 'percentage';

  const actualVal =
    input.achievedValue !== undefined ? input.achievedValue : input.actualValue;

  if (isPercentageUnit) {
    const valuesToCheck = [
      input.baselineValue,
      input.targetValue,
      actualVal,
    ].filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v));

    for (const val of valuesToCheck) {
      if (val < 0 || val > 100) {
        return {
          valid: false,
          error:
            'لا تقبل قيم غير منطقية (أقل من 0% أو أكبر من 100%) عندما تكون وحدة القياس «نسبة مئوية».',
        };
      }
    }
  }

  if (
    input.periodStartDate &&
    input.periodEndDate &&
    input.periodStartDate.trim() &&
    input.periodEndDate.trim() &&
    input.periodStartDate.trim() > input.periodEndDate.trim()
  ) {
    return {
      valid: false,
      error: 'تاريخ بداية فترة القياس لا يمكن أن يكون بعد تاريخ النهاية.',
    };
  }

  return { valid: true };
}

export interface PlcKpiAchievementCalculation {
  percentage: number | null;
  statusText: string;
  isCalculated: boolean;
  baselineDisplay: string;
  targetDisplay: string;
  actualDisplay: string;
  unitDisplay: string;
}

/**
 * يحسب نسبة إنجاز مؤشر الأداء آلياً بحسب اتجاه المؤشر (كلما زادت / كلما قلت / قيمة محددة / لا ينطبق).
 * إذا كانت البيانات غير مكتملة أو طبيعة المؤشر لا تسمح بحساب آلي موثوق، يعرض «لم يتم احتساب نسبة الإنجاز آليًا».
 */
export function computePlcKpiAchievement(
  kpi: PlcKpiIndicatorItem
): PlcKpiAchievementCalculation {
  const unitDisplay =
    kpi.unit === 'أخرى' && kpi.customUnit?.trim()
      ? kpi.customUnit.trim()
      : kpi.unit?.trim() || 'غير متوفر';

  const baseline =
    kpi.baselineValue !== null &&
    kpi.baselineValue !== undefined &&
    !Number.isNaN(Number(kpi.baselineValue))
      ? Number(kpi.baselineValue)
      : null;

  const target =
    kpi.targetValue !== null &&
    kpi.targetValue !== undefined &&
    !Number.isNaN(Number(kpi.targetValue))
      ? Number(kpi.targetValue)
      : null;

  const actual =
    kpi.achievedValue !== null &&
    kpi.achievedValue !== undefined &&
    !Number.isNaN(Number(kpi.achievedValue))
      ? Number(kpi.achievedValue)
      : null;

  const baselineDisplay =
    baseline !== null ? `${baseline} ${unitDisplay}`.trim() : 'غير متوفر';
  const targetDisplay =
    target !== null ? `${target} ${unitDisplay}`.trim() : 'غير متوفر';
  const actualDisplay =
    actual !== null ? `${actual} ${unitDisplay}`.trim() : 'لم يتم القياس';

  const direction: PlcKpiDirectionType =
    kpi.indicatorType ?? 'higher_is_better';

  if (direction === 'not_applicable') {
    return {
      percentage: null,
      statusText: 'لم يتم احتساب نسبة الإنجاز آليًا',
      isCalculated: false,
      baselineDisplay,
      targetDisplay,
      actualDisplay,
      unitDisplay,
    };
  }

  if (target === null || actual === null) {
    return {
      percentage: null,
      statusText: 'لم يتم احتساب نسبة الإنجاز آليًا',
      isCalculated: false,
      baselineDisplay,
      targetDisplay,
      actualDisplay,
      unitDisplay,
    };
  }

  if (direction === 'higher_is_better') {
    if (baseline !== null && baseline > 0) {
      if (target <= baseline) {
        return {
          percentage: null,
          statusText: 'لم يتم احتساب نسبة الإنجاز آليًا',
          isCalculated: false,
          baselineDisplay,
          targetDisplay,
          actualDisplay,
          unitDisplay,
        };
      }
      const rawPct = ((actual - baseline) / (target - baseline)) * 100;
      const clamped = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
      return {
        percentage: clamped,
        statusText: `${clamped}%`,
        isCalculated: true,
        baselineDisplay,
        targetDisplay,
        actualDisplay,
        unitDisplay,
      };
    }

    if (target <= 0) {
      return {
        percentage: null,
        statusText: 'لم يتم احتساب نسبة الإنجاز آليًا',
        isCalculated: false,
        baselineDisplay,
        targetDisplay,
        actualDisplay,
        unitDisplay,
      };
    }

    const rawPct = (actual / target) * 100;
    const clamped = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
    return {
      percentage: clamped,
      statusText: `${clamped}%`,
      isCalculated: true,
      baselineDisplay,
      targetDisplay,
      actualDisplay,
      unitDisplay,
    };
  }

  if (direction === 'lower_is_better') {
    // في مؤشرات الخفض (مثل تقليل نسبة الغياب أو الضعف) يلزم وجود خط أساس أعلى من المستهدف لحساب نسبة التحسن بدقة
    if (baseline === null || baseline <= target) {
      return {
        percentage: null,
        statusText: 'لم يتم احتساب نسبة الإنجاز آليًا',
        isCalculated: false,
        baselineDisplay,
        targetDisplay,
        actualDisplay,
        unitDisplay,
      };
    }

    const rawPct = ((baseline - actual) / (baseline - target)) * 100;
    const clamped = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
    return {
      percentage: clamped,
      statusText: `${clamped}%`,
      isCalculated: true,
      baselineDisplay,
      targetDisplay,
      actualDisplay,
      unitDisplay,
    };
  }

  if (direction === 'exact_target') {
    if (actual === target) {
      return {
        percentage: 100,
        statusText: '100%',
        isCalculated: true,
        baselineDisplay,
        targetDisplay,
        actualDisplay,
        unitDisplay,
      };
    }
    if (baseline !== null && baseline !== target) {
      const rawPct =
        (1 - Math.abs(target - actual) / Math.abs(target - baseline)) * 100;
      const clamped = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
      return {
        percentage: clamped,
        statusText: `${clamped}%`,
        isCalculated: true,
        baselineDisplay,
        targetDisplay,
        actualDisplay,
        unitDisplay,
      };
    }
    if (target !== 0) {
      const rawPct = (1 - Math.abs(target - actual) / Math.abs(target)) * 100;
      const clamped = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
      return {
        percentage: clamped,
        statusText: `${clamped}%`,
        isCalculated: true,
        baselineDisplay,
        targetDisplay,
        actualDisplay,
        unitDisplay,
      };
    }
  }

  return {
    percentage: null,
    statusText: 'لم يتم احتساب نسبة الإنجاز آليًا',
    isCalculated: false,
    baselineDisplay,
    targetDisplay,
    actualDisplay,
    unitDisplay,
  };
}

/**
 * يضيف مؤشر أداء جديداً بمعرف ثابت (ID) بعد التحقق من صحة المدخلات.
 */
export function addPlcKpiIndicator(
  indicators: PlcKpiIndicatorItem[],
  input: PlcKpiIndicatorInput
): PlcKpiIndicatorItem[] {
  const validation = validatePlcKpiIndicatorInput(input);
  if (!validation.valid) {
    return deepCloneCommunity(indicators);
  }

  const actualVal =
    input.achievedValue !== undefined ? input.achievedValue : input.actualValue;

  const newIndicator: PlcKpiIndicatorItem = {
    id: generatePlcEntityId('kpi'),
    name: input.name.trim(),
    description: input.description?.trim() || '',
    linkedGoalId: input.linkedGoalId?.trim() || '',
    linkedNeedId: input.linkedNeedId?.trim() || '',
    linkedActionId: input.linkedActionId?.trim() || '',
    linkedActivityId: input.linkedActivityId?.trim() || '',
    baselineValue:
      input.baselineValue !== undefined && input.baselineValue !== null
        ? Number(input.baselineValue)
        : null,
    targetValue:
      input.targetValue !== undefined && input.targetValue !== null
        ? Number(input.targetValue)
        : null,
    achievedValue:
      actualVal !== undefined && actualVal !== null ? Number(actualVal) : null,
    unit: input.unit?.trim() || 'عدد',
    customUnit: input.customUnit?.trim() || '',
    indicatorType: input.indicatorType ?? 'higher_is_better',
    dataSource: input.dataSource?.trim() || '',
    measurementPeriod: input.measurementPeriod?.trim() || '',
    periodStartDate: input.periodStartDate?.trim() || '',
    periodEndDate: input.periodEndDate?.trim() || '',
    measurementDate: input.measurementDate?.trim() || '',
    calculationMethod: input.calculationMethod?.trim() || '',
    notes: input.notes?.trim() || '',
  };

  return [...deepCloneCommunity(indicators), newIndicator];
}

/**
 * يعدل مؤشر أداء قائماً مع الحفاظ التام على معرفه الثابت (ID).
 */
export function updatePlcKpiIndicator(
  indicators: PlcKpiIndicatorItem[],
  indicatorId: string,
  updates: Partial<PlcKpiIndicatorInput>
): PlcKpiIndicatorItem[] {
  return indicators.map((item) => {
    if (item.id !== indicatorId) return deepCloneCommunity(item);

    const nextActual =
      updates.achievedValue !== undefined
        ? updates.achievedValue
        : updates.actualValue !== undefined
          ? updates.actualValue
          : item.achievedValue;

    const mergedCandidate: PlcKpiIndicatorInput = {
      name: updates.name !== undefined ? updates.name : item.name,
      unit: updates.unit !== undefined ? updates.unit : item.unit,
      targetUnit: updates.targetUnit,
      actualUnit: updates.actualUnit,
      baselineValue:
        updates.baselineValue !== undefined
          ? updates.baselineValue
          : item.baselineValue,
      targetValue:
        updates.targetValue !== undefined
          ? updates.targetValue
          : item.targetValue,
      achievedValue: nextActual,
      periodStartDate:
        updates.periodStartDate !== undefined
          ? updates.periodStartDate
          : item.periodStartDate,
      periodEndDate:
        updates.periodEndDate !== undefined
          ? updates.periodEndDate
          : item.periodEndDate,
    };

    const validation = validatePlcKpiIndicatorInput(mergedCandidate);
    if (!validation.valid) {
      return deepCloneCommunity(item);
    }

    return {
      ...deepCloneCommunity(item),
      id: item.id, // الحفاظ الصارم على المعرف الثابت
      name:
        updates.name !== undefined && updates.name.trim()
          ? updates.name.trim()
          : item.name,
      description:
        updates.description !== undefined
          ? updates.description.trim()
          : item.description,
      linkedGoalId:
        updates.linkedGoalId !== undefined
          ? updates.linkedGoalId.trim()
          : item.linkedGoalId ?? '',
      linkedNeedId:
        updates.linkedNeedId !== undefined
          ? updates.linkedNeedId.trim()
          : item.linkedNeedId ?? '',
      linkedActionId:
        updates.linkedActionId !== undefined
          ? updates.linkedActionId.trim()
          : item.linkedActionId ?? '',
      linkedActivityId:
        updates.linkedActivityId !== undefined
          ? updates.linkedActivityId.trim()
          : item.linkedActivityId ?? '',
      baselineValue:
        updates.baselineValue !== undefined
          ? updates.baselineValue !== null
            ? Number(updates.baselineValue)
            : null
          : item.baselineValue ?? null,
      targetValue:
        updates.targetValue !== undefined
          ? updates.targetValue !== null
            ? Number(updates.targetValue)
            : null
          : item.targetValue,
      achievedValue:
        nextActual !== undefined
          ? nextActual !== null
            ? Number(nextActual)
            : null
          : item.achievedValue,
      unit: updates.unit !== undefined ? updates.unit.trim() : item.unit,
      customUnit:
        updates.customUnit !== undefined
          ? updates.customUnit.trim()
          : item.customUnit ?? '',
      indicatorType:
        updates.indicatorType !== undefined
          ? updates.indicatorType
          : item.indicatorType ?? 'higher_is_better',
      dataSource:
        updates.dataSource !== undefined
          ? updates.dataSource.trim()
          : item.dataSource,
      measurementPeriod:
        updates.measurementPeriod !== undefined
          ? updates.measurementPeriod.trim()
          : item.measurementPeriod,
      periodStartDate:
        updates.periodStartDate !== undefined
          ? updates.periodStartDate.trim()
          : item.periodStartDate ?? '',
      periodEndDate:
        updates.periodEndDate !== undefined
          ? updates.periodEndDate.trim()
          : item.periodEndDate ?? '',
      measurementDate:
        updates.measurementDate !== undefined
          ? updates.measurementDate.trim()
          : item.measurementDate ?? '',
      calculationMethod:
        updates.calculationMethod !== undefined
          ? updates.calculationMethod.trim()
          : item.calculationMethod ?? '',
      notes:
        updates.notes !== undefined ? updates.notes.trim() : item.notes ?? '',
    };
  });
}

export function deletePlcKpiIndicator(
  indicators: PlcKpiIndicatorItem[],
  indicatorId: string
): PlcKpiIndicatorItem[] {
  return deepCloneCommunity(indicators.filter((i) => i.id !== indicatorId));
}

export interface ResolvedPlcKpiIndicatorLinks {
  indicator: PlcKpiIndicatorItem;
  linkedGoal: PlcIdentityListItem | null;
  linkedGoalDisplay: string;
  linkedNeed: PlcNeedItem | null;
  linkedNeedDisplay: string;
  linkedAction: PlcPlanActionItem | null;
  linkedActionDisplay: string;
  linkedActivity: PlcActivityRecord | null;
  linkedActivityDisplay: string;
  indicatorTypeLabel: string;
  achievement: PlcKpiAchievementCalculation;
  linkedEvidences: PlcEvidenceItem[];
}

/**
 * يسترجع العلاقات الحية لمؤشر الأداء بالمعرفات الثابتة (الهدف ← المؤشر، الاحتياج ← المؤشر، الإجراء ← المؤشر، النشاط ← المؤشر).
 * أي تغيير في اسم الهدف أو الاحتياج أو الإجراء أو النشاط ينعكس تلقائياً دون نسخ النصوص القديمة.
 */
export function resolvePlcKpiIndicatorLinks(
  indicator: PlcKpiIndicatorItem,
  community: Pick<
    PlcCommunityRecord,
    | 'identity'
    | 'needs'
    | 'operationalPlan'
    | 'activities'
    | 'evidenceRepository'
  >
): ResolvedPlcKpiIndicatorLinks {
  const hasGoalId = Boolean(indicator.linkedGoalId?.trim());
  const linkedGoal = hasGoalId
    ? community.identity.goals.find((g) => g.id === indicator.linkedGoalId) ??
      null
    : null;
  const linkedGoalDisplay = !hasGoalId
    ? 'غير متوفر'
    : linkedGoal
      ? linkedGoal.text
      : 'هدف محذوف أو غير متوفر';

  const hasNeedId = Boolean(indicator.linkedNeedId?.trim());
  const linkedNeed = hasNeedId
    ? community.needs.find((n) => n.id === indicator.linkedNeedId) ?? null
    : null;
  const linkedNeedDisplay = !hasNeedId
    ? 'غير متوفر'
    : linkedNeed
      ? linkedNeed.description
      : 'احتياج محذوف أو غير متوفر';

  const hasActionId = Boolean(indicator.linkedActionId?.trim());
  const linkedAction = hasActionId
    ? community.operationalPlan.find(
        (a) => a.id === indicator.linkedActionId
      ) ?? null
    : null;
  const linkedActionDisplay = !hasActionId
    ? 'غير متوفر'
    : linkedAction
      ? linkedAction.title
      : 'إجراء محذوف أو غير متوفر';

  const hasActivityId = Boolean(indicator.linkedActivityId?.trim());
  const linkedActivity = hasActivityId
    ? community.activities.find((a) => a.id === indicator.linkedActivityId) ??
      null
    : null;
  const linkedActivityDisplay = !hasActivityId
    ? 'غير متوفر'
    : linkedActivity
      ? `${linkedActivity.title} (${PLC_ACTIVITY_TYPE_LABELS[linkedActivity.type]})`
      : 'نشاط محذوف أو غير متوفر';

  const linkedEvidences = (community.evidenceRepository ?? []).filter((ev) =>
    ev.links.some((l) => l.targetType === 'kpi' && l.targetId === indicator.id)
  );

  return {
    indicator,
    linkedGoal,
    linkedGoalDisplay,
    linkedNeed,
    linkedNeedDisplay,
    linkedAction,
    linkedActionDisplay,
    linkedActivity,
    linkedActivityDisplay,
    indicatorTypeLabel:
      PLC_KPI_DIRECTION_LABELS[
        indicator.indicatorType ?? 'higher_is_better'
      ] ?? 'كلما زادت القيمة كان أفضل',
    achievement: computePlcKpiAchievement(indicator),
    linkedEvidences,
  };
}

// ----------------------------------------------------------------------------
// ٧.٣ قياس الأثر (منفصل تماماً عن تنفيذ النشاط: تنفيذ النشاط ≠ تحقق الأثر)
// ----------------------------------------------------------------------------

export interface PlcImpactMeasurementInput {
  linkedGoalId?: string;
  linkedNeedId?: string;
  linkedActionId?: string;
  linkedActivityId?: string;
  beneficiaryCategory?: string;
  measurementMethod?: string;
  customMeasurementMethod?: string;
  measurementDate?: string;
  baselineDate?: string;
  measurementTool?: string;
  baselineValue?: number | null;
  targetValue?: number | null;
  actualValue?: number | null;
  unit?: string;
  customUnit?: string;
  targetUnit?: string;
  actualUnit?: string;
  measurementResults?: string;
  observedChangeDescription?: string;
  supportingEvidenceIds?: string[];
  improvementDecision?: string;
  customImprovementDecision?: string;
  improvementOpportunities?: string;
  notes?: string;
  allowUnlinkedGeneralImpact?: boolean;
}

/**
 * يتحقق من صحة بيانات سجل قياس الأثر قبل حفظه أو تعديله.
 */
export function validatePlcImpactMeasurementInput(
  input: Partial<PlcImpactMeasurementInput>
): PlcValidationResult {
  const hasAnyLink = Boolean(
    input.linkedGoalId?.trim() ||
      input.linkedNeedId?.trim() ||
      input.linkedActionId?.trim() ||
      input.linkedActivityId?.trim()
  );

  if (!hasAnyLink && !input.allowUnlinkedGeneralImpact) {
    return {
      valid: false,
      error:
        'لا يمكن تسجيل قياس أثر بدون ربطه بهدف أو إجراء أو نشاط أو احتياج مرتبط.',
    };
  }

  if (
    input.targetUnit &&
    input.actualUnit &&
    input.targetUnit.trim() !== input.actualUnit.trim()
  ) {
    return {
      valid: false,
      error:
        'لا يمكن تسجيل نتيجة فعلية بوحدة قياس مختلفة عن وحدة المستهدف.',
    };
  }

  const unitLabel = (input.unit ?? '').trim();
  const isPercentageUnit =
    unitLabel === 'نسبة مئوية' ||
    unitLabel === '%' ||
    unitLabel.toLowerCase() === 'percentage';

  if (isPercentageUnit) {
    const vals = [input.baselineValue, input.targetValue, input.actualValue].filter(
      (v): v is number => v !== null && v !== undefined && !Number.isNaN(v)
    );
    for (const v of vals) {
      if (v < 0 || v > 100) {
        return {
          valid: false,
          error:
            'لا تقبل قيم غير منطقية (أقل من 0% أو أكبر من 100%) عندما تكون وحدة القياس «نسبة مئوية».',
        };
      }
    }
  }

  if (
    input.baselineDate &&
    input.measurementDate &&
    input.baselineDate.trim() &&
    input.measurementDate.trim() &&
    input.baselineDate.trim() > input.measurementDate.trim()
  ) {
    return {
      valid: false,
      error: 'تاريخ القياس البعدي لا يمكن أن يكون قبل تاريخ خط الأساس.',
    };
  }

  return { valid: true };
}

export function getPlcImpactMethodDisplayLabel(
  method: string,
  customMethod?: string
): string {
  const trimmed = (method || '').trim();
  if (!trimmed) return 'غير متوفر';
  if (trimmed === 'other' || trimmed === 'أخرى') {
    return customMethod?.trim() ? `أخرى: ${customMethod.trim()}` : 'أخرى';
  }
  if (trimmed in PLC_IMPACT_METHOD_LABELS) {
    return PLC_IMPACT_METHOD_LABELS[trimmed as PlcImpactMeasurementMethod];
  }
  return trimmed;
}

export function getPlcImprovementDecisionDisplayLabel(
  decision?: string,
  customDecision?: string
): string {
  const trimmed = (decision || '').trim();
  if (!trimmed) return 'لم يتم القياس';
  if (trimmed === 'other' || trimmed === 'أخرى') {
    return customDecision?.trim() ? `أخرى: ${customDecision.trim()}` : 'أخرى';
  }
  if (trimmed in PLC_IMPROVEMENT_DECISION_LABELS) {
    return PLC_IMPROVEMENT_DECISION_LABELS[
      trimmed as PlcImprovementDecisionType
    ];
  }
  return trimmed;
}

/**
 * يضيف سجل قياس أثر جديداً بمعرف ثابت (ID).
 */
export function addPlcImpactMeasurement(
  impacts: PlcImpactMeasurementItem[],
  input: PlcImpactMeasurementInput
): PlcImpactMeasurementItem[] {
  const validation = validatePlcImpactMeasurementInput(input);
  if (!validation.valid) {
    return deepCloneCommunity(impacts);
  }

  const evidenceIds = Array.isArray(input.supportingEvidenceIds)
    ? Array.from(
        new Set(
          input.supportingEvidenceIds.map((id) => id.trim()).filter(Boolean)
        )
      )
    : [];

  const newImpact: PlcImpactMeasurementItem = {
    id: generatePlcEntityId('imp'),
    linkedGoalId: input.linkedGoalId?.trim() || '',
    linkedNeedId: input.linkedNeedId?.trim() || '',
    linkedActionId: input.linkedActionId?.trim() || '',
    linkedActivityId: input.linkedActivityId?.trim() || '',
    beneficiaryCategory: input.beneficiaryCategory?.trim() || 'المعلمون والطلاب',
    measurementMethod: input.measurementMethod?.trim() || 'pre_post_comparison',
    customMeasurementMethod: input.customMeasurementMethod?.trim() || '',
    measurementDate: input.measurementDate?.trim() || '',
    baselineDate: input.baselineDate?.trim() || '',
    measurementTool: input.measurementTool?.trim() || '',
    baselineValue:
      input.baselineValue !== undefined && input.baselineValue !== null
        ? Number(input.baselineValue)
        : null,
    targetValue:
      input.targetValue !== undefined && input.targetValue !== null
        ? Number(input.targetValue)
        : null,
    actualValue:
      input.actualValue !== undefined && input.actualValue !== null
        ? Number(input.actualValue)
        : null,
    unit: input.unit?.trim() || '',
    customUnit: input.customUnit?.trim() || '',
    measurementResults: input.measurementResults?.trim() || '',
    observedChangeDescription: input.observedChangeDescription?.trim() || '',
    supportingEvidenceIds: evidenceIds,
    improvementDecision: input.improvementDecision?.trim() || '',
    customImprovementDecision: input.customImprovementDecision?.trim() || '',
    improvementOpportunities: input.improvementOpportunities?.trim() || '',
    notes: input.notes?.trim() || '',
  };

  return [...deepCloneCommunity(impacts), newImpact];
}

/**
 * يعدل سجل قياس أثر قائماً مع الحفاظ التام على معرفه الثابت (ID).
 */
export function updatePlcImpactMeasurement(
  impacts: PlcImpactMeasurementItem[],
  impactId: string,
  updates: Partial<PlcImpactMeasurementInput>
): PlcImpactMeasurementItem[] {
  return impacts.map((item) => {
    if (item.id !== impactId) return deepCloneCommunity(item);

    const mergedCandidate: PlcImpactMeasurementInput = {
      linkedGoalId:
        updates.linkedGoalId !== undefined
          ? updates.linkedGoalId
          : item.linkedGoalId,
      linkedNeedId:
        updates.linkedNeedId !== undefined
          ? updates.linkedNeedId
          : item.linkedNeedId,
      linkedActionId:
        updates.linkedActionId !== undefined
          ? updates.linkedActionId
          : item.linkedActionId,
      linkedActivityId:
        updates.linkedActivityId !== undefined
          ? updates.linkedActivityId
          : item.linkedActivityId,
      unit: updates.unit !== undefined ? updates.unit : item.unit,
      targetUnit: updates.targetUnit,
      actualUnit: updates.actualUnit,
      baselineValue:
        updates.baselineValue !== undefined
          ? updates.baselineValue
          : item.baselineValue,
      targetValue:
        updates.targetValue !== undefined
          ? updates.targetValue
          : item.targetValue,
      actualValue:
        updates.actualValue !== undefined
          ? updates.actualValue
          : item.actualValue,
      baselineDate:
        updates.baselineDate !== undefined
          ? updates.baselineDate
          : item.baselineDate,
      measurementDate:
        updates.measurementDate !== undefined
          ? updates.measurementDate
          : item.measurementDate,
      allowUnlinkedGeneralImpact: updates.allowUnlinkedGeneralImpact,
    };

    const validation = validatePlcImpactMeasurementInput(mergedCandidate);
    if (!validation.valid) {
      return deepCloneCommunity(item);
    }

    const nextEvidenceIds =
      updates.supportingEvidenceIds !== undefined
        ? Array.from(
            new Set(
              updates.supportingEvidenceIds
                .map((id) => id.trim())
                .filter(Boolean)
            )
          )
        : item.supportingEvidenceIds ?? [];

    return {
      ...deepCloneCommunity(item),
      id: item.id, // الحفاظ الصارم على المعرف الثابت
      linkedGoalId:
        updates.linkedGoalId !== undefined
          ? updates.linkedGoalId.trim()
          : item.linkedGoalId ?? '',
      linkedNeedId:
        updates.linkedNeedId !== undefined
          ? updates.linkedNeedId.trim()
          : item.linkedNeedId ?? '',
      linkedActionId:
        updates.linkedActionId !== undefined
          ? updates.linkedActionId.trim()
          : item.linkedActionId ?? '',
      linkedActivityId:
        updates.linkedActivityId !== undefined
          ? updates.linkedActivityId.trim()
          : item.linkedActivityId ?? '',
      beneficiaryCategory:
        updates.beneficiaryCategory !== undefined
          ? updates.beneficiaryCategory.trim()
          : item.beneficiaryCategory,
      measurementMethod:
        updates.measurementMethod !== undefined
          ? updates.measurementMethod.trim()
          : item.measurementMethod,
      customMeasurementMethod:
        updates.customMeasurementMethod !== undefined
          ? updates.customMeasurementMethod.trim()
          : item.customMeasurementMethod ?? '',
      measurementDate:
        updates.measurementDate !== undefined
          ? updates.measurementDate.trim()
          : item.measurementDate,
      baselineDate:
        updates.baselineDate !== undefined
          ? updates.baselineDate.trim()
          : item.baselineDate ?? '',
      measurementTool:
        updates.measurementTool !== undefined
          ? updates.measurementTool.trim()
          : item.measurementTool ?? '',
      baselineValue:
        updates.baselineValue !== undefined
          ? updates.baselineValue !== null
            ? Number(updates.baselineValue)
            : null
          : item.baselineValue ?? null,
      targetValue:
        updates.targetValue !== undefined
          ? updates.targetValue !== null
            ? Number(updates.targetValue)
            : null
          : item.targetValue ?? null,
      actualValue:
        updates.actualValue !== undefined
          ? updates.actualValue !== null
            ? Number(updates.actualValue)
            : null
          : item.actualValue ?? null,
      unit: updates.unit !== undefined ? updates.unit.trim() : item.unit ?? '',
      customUnit:
        updates.customUnit !== undefined
          ? updates.customUnit.trim()
          : item.customUnit ?? '',
      measurementResults:
        updates.measurementResults !== undefined
          ? updates.measurementResults.trim()
          : item.measurementResults,
      observedChangeDescription:
        updates.observedChangeDescription !== undefined
          ? updates.observedChangeDescription.trim()
          : item.observedChangeDescription,
      supportingEvidenceIds: nextEvidenceIds,
      improvementDecision:
        updates.improvementDecision !== undefined
          ? updates.improvementDecision.trim()
          : item.improvementDecision ?? '',
      customImprovementDecision:
        updates.customImprovementDecision !== undefined
          ? updates.customImprovementDecision.trim()
          : item.customImprovementDecision ?? '',
      improvementOpportunities:
        updates.improvementOpportunities !== undefined
          ? updates.improvementOpportunities.trim()
          : item.improvementOpportunities,
      notes:
        updates.notes !== undefined ? updates.notes.trim() : item.notes ?? '',
    };
  });
}

export function deletePlcImpactMeasurement(
  impacts: PlcImpactMeasurementItem[],
  impactId: string
): PlcImpactMeasurementItem[] {
  return deepCloneCommunity(impacts.filter((i) => i.id !== impactId));
}

/**
 * يزامن روابط الشواهد في المستودع الموحد مع الشواهد المرتبطة بسجلات قياس الأثر،
 * بحيث يظهر ارتباط الشاهد بقياس الأثر تلقائياً في النموذجين السابع والثامن دون تكرار الملف.
 */
export function syncCommunityImpactEvidenceLinks(
  community: PlcCommunityRecord
): PlcCommunityRecord {
  const cloned = deepCloneCommunity(community);
  const impacts = cloned.evaluation.impactMeasurements ?? [];

  cloned.evidenceRepository = cloned.evidenceRepository.map((ev) => {
    const nonImpactLinks = ev.links.filter((l) => l.targetType !== 'impact');
    const matchingImpactLinks: PlcEvidenceLinkRef[] = impacts
      .filter((imp) => (imp.supportingEvidenceIds ?? []).includes(ev.id))
      .map((imp) => ({ targetType: 'impact', targetId: imp.id }));

    return {
      ...ev,
      links: [...nonImpactLinks, ...matchingImpactLinks],
    };
  });

  return cloned;
}

export interface ResolvedPlcImpactMeasurementLinks {
  impact: PlcImpactMeasurementItem;
  linkedGoal: PlcIdentityListItem | null;
  linkedGoalDisplay: string;
  linkedNeed: PlcNeedItem | null;
  linkedNeedDisplay: string;
  linkedAction: PlcPlanActionItem | null;
  linkedActionDisplay: string;
  linkedActivity: PlcActivityRecord | null;
  linkedActivityDisplay: string;
  methodDisplay: string;
  decisionDisplay: string;
  supportingEvidences: PlcEvidenceItem[];
  baselineDisplay: string;
  targetDisplay: string;
  actualDisplay: string;
  unitDisplay: string;
}

/**
 * يسترجع العلاقات الحية لسجل قياس الأثر بالمعرفات الثابتة (الهدف، الاحتياج، الإجراء، النشاط، الشاهد).
 */
export function resolvePlcImpactMeasurementLinks(
  impact: PlcImpactMeasurementItem,
  community: Pick<
    PlcCommunityRecord,
    | 'identity'
    | 'needs'
    | 'operationalPlan'
    | 'activities'
    | 'evidenceRepository'
  >
): ResolvedPlcImpactMeasurementLinks {
  const hasGoalId = Boolean(impact.linkedGoalId?.trim());
  const linkedGoal = hasGoalId
    ? community.identity.goals.find((g) => g.id === impact.linkedGoalId) ?? null
    : null;
  const linkedGoalDisplay = !hasGoalId
    ? 'غير متوفر'
    : linkedGoal
      ? linkedGoal.text
      : 'هدف محذوف أو غير متوفر';

  const hasNeedId = Boolean(impact.linkedNeedId?.trim());
  const linkedNeed = hasNeedId
    ? community.needs.find((n) => n.id === impact.linkedNeedId) ?? null
    : null;
  const linkedNeedDisplay = !hasNeedId
    ? 'غير متوفر'
    : linkedNeed
      ? linkedNeed.description
      : 'احتياج محذوف أو غير متوفر';

  const hasActionId = Boolean(impact.linkedActionId?.trim());
  const linkedAction = hasActionId
    ? community.operationalPlan.find((a) => a.id === impact.linkedActionId) ??
      null
    : null;
  const linkedActionDisplay = !hasActionId
    ? 'غير متوفر'
    : linkedAction
      ? linkedAction.title
      : 'إجراء محذوف أو غير متوفر';

  const hasActivityId = Boolean(impact.linkedActivityId?.trim());
  const linkedActivity = hasActivityId
    ? community.activities.find((a) => a.id === impact.linkedActivityId) ?? null
    : null;
  const linkedActivityDisplay = !hasActivityId
    ? 'غير متوفر'
    : linkedActivity
      ? `${linkedActivity.title} (${PLC_ACTIVITY_TYPE_LABELS[linkedActivity.type]})`
      : 'نشاط محذوف أو غير متوفر';

  const evidenceIdsFromRecord = Array.isArray(impact.supportingEvidenceIds)
    ? impact.supportingEvidenceIds
    : [];
  const supportingEvidences = (community.evidenceRepository ?? []).filter(
    (ev) =>
      evidenceIdsFromRecord.includes(ev.id) ||
      ev.links.some((l) => l.targetType === 'impact' && l.targetId === impact.id)
  );

  const unitDisplay =
    impact.unit === 'أخرى' && impact.customUnit?.trim()
      ? impact.customUnit.trim()
      : impact.unit?.trim() || '';

  const baselineDisplay =
    impact.baselineValue !== null &&
    impact.baselineValue !== undefined &&
    !Number.isNaN(Number(impact.baselineValue))
      ? `${impact.baselineValue} ${unitDisplay}`.trim()
      : 'غير متوفر';

  const targetDisplay =
    impact.targetValue !== null &&
    impact.targetValue !== undefined &&
    !Number.isNaN(Number(impact.targetValue))
      ? `${impact.targetValue} ${unitDisplay}`.trim()
      : 'غير متوفر';

  const actualDisplay =
    impact.actualValue !== null &&
    impact.actualValue !== undefined &&
    !Number.isNaN(Number(impact.actualValue))
      ? `${impact.actualValue} ${unitDisplay}`.trim()
      : 'لم يتم القياس';

  return {
    impact,
    linkedGoal,
    linkedGoalDisplay,
    linkedNeed,
    linkedNeedDisplay,
    linkedAction,
    linkedActionDisplay,
    linkedActivity,
    linkedActivityDisplay,
    methodDisplay: getPlcImpactMethodDisplayLabel(
      impact.measurementMethod,
      impact.customMeasurementMethod
    ),
    decisionDisplay: getPlcImprovementDecisionDisplayLabel(
      impact.improvementDecision || impact.improvementOpportunities,
      impact.customImprovementDecision
    ),
    supportingEvidences,
    baselineDisplay,
    targetDisplay,
    actualDisplay,
    unitDisplay: unitDisplay || 'غير متوفر',
  };
}

// ----------------------------------------------------------------------------
// النموذج الثامن: مستودع الشواهد والمرفقات الموحد
// ----------------------------------------------------------------------------

/**
 * يستنتج نوع الشاهد من نوع الملف MIME أو اسم الملف أو الرابط.
 */
export function inferPlcEvidenceTypeFromMimeOrUrl(
  mimeType?: string,
  fileName?: string,
  externalUrl?: string
): PlcEvidenceType {
  const mime = (mimeType ?? '').toLowerCase();
  const name = (fileName ?? '').toLowerCase();

  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (
    mime.startsWith('image/') ||
    /\.(png|jpg|jpeg|webp|gif|svg)$/.test(name)
  ) {
    return 'image';
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    /\.(ppt|pptx)$/.test(name)
  ) {
    return 'presentation';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    /\.(xls|xlsx|csv)$/.test(name)
  ) {
    return 'spreadsheet';
  }
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('text/') ||
    /\.(doc|docx|txt|rtf)$/.test(name)
  ) {
    return 'document';
  }
  if (externalUrl && externalUrl.trim() && !fileName?.trim()) {
    return 'link';
  }
  return 'other';
}

export interface PlcEvidenceRepositoryInput {
  title: string;
  evidenceType?: PlcEvidenceType;
  customEvidenceType?: string;
  category?: string;
  description?: string;
  evidenceDate?: string;
  sourceOrEntity?: string;
  fileDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  externalUrl?: string;
  notes?: string;
  initialLinks?: PlcEvidenceLinkRef[];
}

export function validatePlcEvidenceRepositoryInput(
  input: Partial<PlcEvidenceRepositoryInput>
): PlcValidationResult {
  const cleanTitle = (input.title ?? '').trim();
  if (!cleanTitle) {
    return {
      valid: false,
      error: 'لا يمكن تسجيل شاهد في المستودع بدون اسم الشاهد.',
    };
  }
  return { valid: true };
}

/**
 * يضيف شاهداً جديداً إلى مستودع الشواهد الموحد للمجتمع (أو يعيد استخدام الشاهد الموجود إذا تطابق الملف لمنع التكرار)،
 * مع إمكانية ربطه مباشرة بواحد أو أكثر من السجلات بالـID.
 */
export function addPlcEvidenceToRepository(
  community: PlcCommunityRecord,
  input: PlcEvidenceRepositoryInput
): PlcEvidenceOperationResult {
  const validation = validatePlcEvidenceRepositoryInput(input);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error,
      community: deepCloneCommunity(community),
    };
  }

  let cloned = deepCloneCommunity(community);
  const cleanFileName = input.fileName?.trim() || '';
  const cleanDataUrl = input.fileDataUrl || '';

  // منع تكرار الملف في المستودع إذا كان مرفوعاً مسبقاً بنفس اسم الملف ومحتواه داخل نفس المجتمع
  let existingItem =
    cleanFileName && cleanDataUrl
      ? cloned.evidenceRepository.find(
          (ev) =>
            ev.fileName === cleanFileName && ev.fileDataUrl === cleanDataUrl
        )
      : undefined;

  const inferredType =
    input.evidenceType ??
    inferPlcEvidenceTypeFromMimeOrUrl(
      input.mimeType,
      cleanFileName,
      input.externalUrl
    );

  if (!existingItem) {
    const newItem: PlcEvidenceItem = {
      id: generatePlcEntityId('evd'),
      title: input.title.trim(),
      evidenceType: inferredType,
      customEvidenceType: input.customEvidenceType?.trim() || '',
      category:
        input.category?.trim() ||
        PLC_EVIDENCE_TYPE_LABELS[inferredType] ||
        'شاهد توثيقي',
      description: input.description?.trim() || '',
      evidenceDate:
        input.evidenceDate?.trim() || new Date().toISOString().slice(0, 10),
      sourceOrEntity: input.sourceOrEntity?.trim() || '',
      fileName: cleanFileName,
      mimeType: input.mimeType?.trim() || '',
      fileDataUrl: cleanDataUrl,
      externalUrl: input.externalUrl?.trim() || '',
      notes: input.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      qrCodeToken: generatePlcEntityId('qrevd'),
      links: [],
    };
    cloned.evidenceRepository.push(newItem);
    existingItem = newItem;
  }

  const targetEvdId = existingItem.id;

  if (Array.isArray(input.initialLinks)) {
    for (const link of input.initialLinks) {
      if (link.targetId && link.targetId.trim()) {
        const linkRes = linkPlcEvidenceToTarget(
          cloned,
          targetEvdId,
          link.targetType,
          link.targetId.trim()
        );
        if (linkRes.ok) {
          cloned = linkRes.community;
        }
      }
    }
  }

  const finalEvidence = cloned.evidenceRepository.find(
    (e) => e.id === targetEvdId
  );

  return {
    ok: true,
    evidence: finalEvidence,
    community: cloned,
  };
}

/**
 * يعدل بيانات الشاهد في المستودع الموحد مع الحفاظ على معرفه الثابت (ID) وجميع ارتباطاته.
 */
export function updatePlcEvidenceInRepository(
  community: PlcCommunityRecord,
  evidenceId: string,
  updates: Partial<PlcEvidenceRepositoryInput>
): PlcEvidenceOperationResult {
  const cloned = deepCloneCommunity(community);
  const existing = cloned.evidenceRepository.find((e) => e.id === evidenceId);
  if (!existing) {
    return {
      ok: false,
      error: 'الشاهد المطلوب تعديله غير موجود في المستودع.',
      community: cloned,
    };
  }

  const nextTitle =
    updates.title !== undefined ? updates.title.trim() : existing.title;
  if (!nextTitle) {
    return {
      ok: false,
      error: 'لا يمكن ترك اسم الشاهد فارغاً.',
      community: cloned,
    };
  }

  cloned.evidenceRepository = cloned.evidenceRepository.map((ev) => {
    if (ev.id !== evidenceId) return ev;
    const nextType =
      updates.evidenceType ??
      ev.evidenceType ??
      inferPlcEvidenceTypeFromMimeOrUrl(
        updates.mimeType ?? ev.mimeType,
        updates.fileName ?? ev.fileName,
        updates.externalUrl ?? ev.externalUrl
      );

    return {
      ...ev,
      id: ev.id,
      title: nextTitle,
      evidenceType: nextType,
      customEvidenceType:
        updates.customEvidenceType !== undefined
          ? updates.customEvidenceType.trim()
          : ev.customEvidenceType ?? '',
      category:
        updates.category !== undefined
          ? updates.category.trim()
          : ev.category || PLC_EVIDENCE_TYPE_LABELS[nextType],
      description:
        updates.description !== undefined
          ? updates.description.trim()
          : ev.description,
      evidenceDate:
        updates.evidenceDate !== undefined
          ? updates.evidenceDate.trim()
          : ev.evidenceDate ?? '',
      sourceOrEntity:
        updates.sourceOrEntity !== undefined
          ? updates.sourceOrEntity.trim()
          : ev.sourceOrEntity ?? '',
      fileName:
        updates.fileName !== undefined
          ? updates.fileName.trim()
          : ev.fileName ?? '',
      mimeType:
        updates.mimeType !== undefined
          ? updates.mimeType.trim()
          : ev.mimeType ?? '',
      fileDataUrl:
        updates.fileDataUrl !== undefined
          ? updates.fileDataUrl
          : ev.fileDataUrl ?? '',
      externalUrl:
        updates.externalUrl !== undefined
          ? updates.externalUrl.trim()
          : ev.externalUrl ?? '',
      notes:
        updates.notes !== undefined ? updates.notes.trim() : ev.notes ?? '',
    };
  });

  return {
    ok: true,
    evidence: cloned.evidenceRepository.find((e) => e.id === evidenceId),
    community: cloned,
  };
}

/**
 * يربط شاهداً موجوداً في المستودع بأي سجل داخل المجتمع بالـID فقط دون إنشاء نسخة مكررة من الشاهد.
 * يراعي الحد الأقصى (4 شواهد) لسجلات الاجتماعات وسجلات التنفيذ المعتمدة في الدفعة الثالثة.
 */
export function linkPlcEvidenceToTarget(
  community: PlcCommunityRecord,
  evidenceId: string,
  targetType: PlcEvidenceLinkTargetType,
  targetId: string
): PlcEvidenceOperationResult {
  const cloned = deepCloneCommunity(community);
  const cleanTargetId = targetId.trim();
  const evidence = cloned.evidenceRepository.find((e) => e.id === evidenceId);

  if (!evidence || !cleanTargetId) {
    return {
      ok: false,
      error: 'الشاهد أو السجل المراد الربط به غير موجود.',
      community: cloned,
    };
  }

  const isActivityKind =
    targetType === 'activity' ||
    targetType === 'program' ||
    targetType === 'mutual_visit' ||
    targetType === 'community_partnership';

  if (targetType === 'meeting') {
    const mtg = cloned.meetings.find((m) => m.id === cleanTargetId);
    if (mtg) {
      const currentIds = mtg.evidenceIds ?? [];
      if (
        !currentIds.includes(evidenceId) &&
        currentIds.length >= PLC_MAX_EVIDENCES_PER_RECORD
      ) {
        return {
          ok: false,
          error: `لا يمكن إرفاق أكثر من ${PLC_MAX_EVIDENCES_PER_RECORD} شواهد للاجتماع الواحد.`,
          community: cloned,
        };
      }
      if (!currentIds.includes(evidenceId)) {
        mtg.evidenceIds = [...currentIds, evidenceId];
      }
    }
  } else if (isActivityKind) {
    const act = cloned.activities.find((a) => a.id === cleanTargetId);
    if (act) {
      const currentIds = act.evidenceIds ?? [];
      if (
        !currentIds.includes(evidenceId) &&
        currentIds.length >= PLC_MAX_EVIDENCES_PER_RECORD
      ) {
        return {
          ok: false,
          error: `لا يمكن إرفاق أكثر من ${PLC_MAX_EVIDENCES_PER_RECORD} شواهد لسجل التنفيذ الواحد.`,
          community: cloned,
        };
      }
      if (!currentIds.includes(evidenceId)) {
        act.evidenceIds = [...currentIds, evidenceId];
      }
    }
  } else if (targetType === 'impact') {
    cloned.evaluation.impactMeasurements =
      cloned.evaluation.impactMeasurements.map((imp) => {
        if (imp.id !== cleanTargetId) return imp;
        const curr = imp.supportingEvidenceIds ?? [];
        return curr.includes(evidenceId)
          ? imp
          : { ...imp, supportingEvidenceIds: [...curr, evidenceId] };
      });
  }

  const normalizedTargetType: PlcEvidenceLinkTargetType = isActivityKind
    ? (cloned.activities.find((a) => a.id === cleanTargetId)?.type ??
        targetType)
    : targetType;

  const alreadyLinked = evidence.links.some(
    (l) =>
      (l.targetType === normalizedTargetType ||
        (isActivityKind &&
          (l.targetType === 'activity' ||
            l.targetType === 'program' ||
            l.targetType === 'mutual_visit' ||
            l.targetType === 'community_partnership'))) &&
      l.targetId === cleanTargetId
  );

  if (!alreadyLinked) {
    evidence.links.push({
      targetType: normalizedTargetType,
      targetId: cleanTargetId,
    });
  }

  return {
    ok: true,
    evidence,
    community: cloned,
  };
}

/**
 * يفك ارتباط الشاهد بسجل معين دون حذف الشاهد نفسه من المستودع الموحد.
 */
export function unlinkPlcEvidenceFromTarget(
  community: PlcCommunityRecord,
  evidenceId: string,
  targetType: PlcEvidenceLinkTargetType,
  targetId: string
): PlcCommunityRecord {
  const cloned = deepCloneCommunity(community);
  const cleanTargetId = targetId.trim();

  const isActivityKind =
    targetType === 'activity' ||
    targetType === 'program' ||
    targetType === 'mutual_visit' ||
    targetType === 'community_partnership';

  cloned.evidenceRepository = cloned.evidenceRepository.map((ev) => {
    if (ev.id !== evidenceId) return ev;
    return {
      ...ev,
      links: ev.links.filter((l) => {
        if (l.targetId !== cleanTargetId) return true;
        if (isActivityKind) {
          return !(
            l.targetType === 'activity' ||
            l.targetType === 'program' ||
            l.targetType === 'mutual_visit' ||
            l.targetType === 'community_partnership'
          );
        }
        return l.targetType !== targetType;
      }),
    };
  });

  if (targetType === 'meeting') {
    cloned.meetings = cloned.meetings.map((m) =>
      m.id === cleanTargetId
        ? {
            ...m,
            evidenceIds: (m.evidenceIds ?? []).filter((id) => id !== evidenceId),
          }
        : m
    );
  } else if (isActivityKind) {
    cloned.activities = cloned.activities.map((a) =>
      a.id === cleanTargetId
        ? {
            ...a,
            evidenceIds: (a.evidenceIds ?? []).filter((id) => id !== evidenceId),
          }
        : a
    );
  } else if (targetType === 'impact') {
    cloned.evaluation.impactMeasurements =
      cloned.evaluation.impactMeasurements.map((imp) =>
        imp.id === cleanTargetId
          ? {
              ...imp,
              supportingEvidenceIds: (imp.supportingEvidenceIds ?? []).filter(
                (id) => id !== evidenceId
              ),
            }
          : imp
      );
  }

  return cloned;
}

export interface ResolvedPlcEvidenceRelation {
  targetType: PlcEvidenceLinkTargetType;
  targetTypeLabel: string;
  targetId: string;
  targetDisplayTitle: string;
  isTargetDeleted: boolean;
}

/**
 * يسترجع جميع العلاقات المرتبطة بالشاهد من مختلف نماذج المجتمع بالـIDs مع أسمائها الحية.
 */
export function resolvePlcEvidenceLinks(
  evidence: PlcEvidenceItem,
  community: Pick<
    PlcCommunityRecord,
    | 'id'
    | 'name'
    | 'identity'
    | 'needs'
    | 'operationalPlan'
    | 'meetings'
    | 'activities'
    | 'evaluation'
  >
): ResolvedPlcEvidenceRelation[] {
  const combinedRefs: PlcEvidenceLinkRef[] = [...(evidence.links ?? [])];

  const ensureRef = (
    targetType: PlcEvidenceLinkTargetType,
    targetId: string
  ) => {
    const isAct =
      targetType === 'activity' ||
      targetType === 'program' ||
      targetType === 'mutual_visit' ||
      targetType === 'community_partnership';
    const exists = combinedRefs.some((r) => {
      if (r.targetId !== targetId) return false;
      if (isAct) {
        return (
          r.targetType === 'activity' ||
          r.targetType === 'program' ||
          r.targetType === 'mutual_visit' ||
          r.targetType === 'community_partnership'
        );
      }
      return r.targetType === targetType;
    });
    if (!exists) {
      combinedRefs.push({ targetType, targetId });
    }
  };

  for (const mtg of community.meetings ?? []) {
    if ((mtg.evidenceIds ?? []).includes(evidence.id)) {
      ensureRef('meeting', mtg.id);
    }
  }
  for (const act of community.activities ?? []) {
    if ((act.evidenceIds ?? []).includes(evidence.id)) {
      ensureRef(act.type, act.id);
    }
  }
  for (const imp of community.evaluation?.impactMeasurements ?? []) {
    if ((imp.supportingEvidenceIds ?? []).includes(evidence.id)) {
      ensureRef('impact', imp.id);
    }
  }

  return combinedRefs.map((ref) => {
    if (ref.targetType === 'need') {
      const found = community.needs.find((n) => n.id === ref.targetId);
      return {
        targetType: 'need',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.need,
        targetId: ref.targetId,
        targetDisplayTitle: found
          ? found.description
          : 'احتياج محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    if (ref.targetType === 'goal') {
      const found = community.identity.goals.find((g) => g.id === ref.targetId);
      return {
        targetType: 'goal',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.goal,
        targetId: ref.targetId,
        targetDisplayTitle: found ? found.text : 'هدف محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    if (ref.targetType === 'operational_plan') {
      return {
        targetType: 'operational_plan',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.operational_plan,
        targetId: ref.targetId,
        targetDisplayTitle: `الخطة التشغيلية للمجتمع (${community.name})`,
        isTargetDeleted: false,
      };
    }

    if (ref.targetType === 'plan_action') {
      const found = community.operationalPlan.find(
        (a) => a.id === ref.targetId
      );
      return {
        targetType: 'plan_action',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.plan_action,
        targetId: ref.targetId,
        targetDisplayTitle: found ? found.title : 'إجراء محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    if (ref.targetType === 'meeting') {
      const found = community.meetings.find((m) => m.id === ref.targetId);
      return {
        targetType: 'meeting',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.meeting,
        targetId: ref.targetId,
        targetDisplayTitle: found
          ? `الاجتماع (${found.meetingNumber}) — ${found.meetingType}`
          : 'اجتماع محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    if (
      ref.targetType === 'activity' ||
      ref.targetType === 'program' ||
      ref.targetType === 'mutual_visit' ||
      ref.targetType === 'community_partnership'
    ) {
      const found = community.activities.find((a) => a.id === ref.targetId);
      const specificType: PlcEvidenceLinkTargetType = found
        ? found.type
        : ref.targetType;
      return {
        targetType: specificType,
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS[specificType],
        targetId: ref.targetId,
        targetDisplayTitle: found
          ? found.title
          : 'سجل تنفيذ محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    if (ref.targetType === 'kpi') {
      const found = community.evaluation.kpiIndicators.find(
        (k) => k.id === ref.targetId
      );
      return {
        targetType: 'kpi',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.kpi,
        targetId: ref.targetId,
        targetDisplayTitle: found
          ? found.name
          : 'مؤشر أداء محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    if (ref.targetType === 'impact') {
      const found = community.evaluation.impactMeasurements.find(
        (imp) => imp.id === ref.targetId
      );
      return {
        targetType: 'impact',
        targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.impact,
        targetId: ref.targetId,
        targetDisplayTitle: found
          ? found.observedChangeDescription ||
            found.measurementResults ||
            `قياس أثر (${found.beneficiaryCategory})`
          : 'قياس أثر محذوف أو غير متوفر',
        isTargetDeleted: !found,
      };
    }

    return {
      targetType: 'final_report',
      targetTypeLabel: PLC_EVIDENCE_TARGET_TYPE_LABELS.final_report,
      targetId: ref.targetId,
      targetDisplayTitle: `التقرير الختامي للمجتمع (${community.name})`,
      isTargetDeleted: false,
    };
  });
}

export interface PlcDeleteEvidenceResult {
  ok: boolean;
  requiresConfirmation: boolean;
  linkedRelationsCount: number;
  warningMessage?: string;
  community: PlcCommunityRecord;
}

/**
 * يحذف الشاهد من المستودع الموحد بأمان:
 * - إذا كان الشاهد غير مرتبط بأي سجل، يحذفه مباشرة.
 * - إذا كان مرتبطاً بسجلات أخرى ولم يُمرر `forceRemoveLinks: true`، يمنع الحذف الصامت ويعيد رسالة التحذير الرسمية:
 *   «هذا الشاهد مرتبط بسجلات أخرى. هل تريد حذف الشاهد وإزالة ارتباطاته؟»
 * - عند التأكيد (`forceRemoveLinks: true`)، يحذف الشاهد ويزيل جميع ارتباطاته من الاجتماعات والأنشطة وقياس الأثر حتى لا تبقى أي روابط مكسورة.
 */
export function deletePlcEvidenceFromRepository(
  community: PlcCommunityRecord,
  evidenceId: string,
  options: { forceRemoveLinks?: boolean } = {}
): PlcDeleteEvidenceResult {
  const cloned = deepCloneCommunity(community);
  const target = cloned.evidenceRepository.find((e) => e.id === evidenceId);

  if (!target) {
    return {
      ok: false,
      requiresConfirmation: false,
      linkedRelationsCount: 0,
      warningMessage: 'الشاهد غير موجود في المستودع.',
      community: cloned,
    };
  }

  const activeRelations = resolvePlcEvidenceLinks(target, cloned).filter(
    (r) => !r.isTargetDeleted
  );

  if (activeRelations.length > 0 && !options.forceRemoveLinks) {
    return {
      ok: false,
      requiresConfirmation: true,
      linkedRelationsCount: activeRelations.length,
      warningMessage:
        'هذا الشاهد مرتبط بسجلات أخرى. هل تريد حذف الشاهد وإزالة ارتباطاته؟',
      community: cloned,
    };
  }

  // إزالة الشاهد من المستودع وتنظيف جميع الإشارات إليه في الاجتماعات وسجلات التنفيذ وقياس الأثر
  cloned.evidenceRepository = cloned.evidenceRepository.filter(
    (e) => e.id !== evidenceId
  );

  cloned.meetings = cloned.meetings.map((m) => ({
    ...m,
    evidenceIds: (m.evidenceIds ?? []).filter((id) => id !== evidenceId),
  }));

  cloned.activities = cloned.activities.map((a) => ({
    ...a,
    evidenceIds: (a.evidenceIds ?? []).filter((id) => id !== evidenceId),
  }));

  cloned.evaluation.impactMeasurements =
    cloned.evaluation.impactMeasurements.map((imp) => ({
      ...imp,
      supportingEvidenceIds: (imp.supportingEvidenceIds ?? []).filter(
        (id) => id !== evidenceId
      ),
    }));

  return {
    ok: true,
    requiresConfirmation: false,
    linkedRelationsCount: activeRelations.length,
    community: cloned,
  };
}

export interface PlcEvidenceRepositoryFilterOptions {
  searchQuery?: string;
  evidenceTypeFilter?: PlcEvidenceType | 'all';
  linkedTargetTypeFilter?: PlcEvidenceLinkTargetType | 'all' | 'unlinked';
  dateFilter?: string;
  sortBy?: 'newest' | 'oldest';
}

/**
 * يبحث ويصفي ويرتب الشواهد في المستودع الموحد للمجتمع حسب الاسم والنوع ونوع السجل المرتبط والتاريخ والأحدث/الأقدم.
 */
export function filterAndSortPlcEvidenceRepository(
  evidenceRepository: PlcEvidenceItem[],
  community: Pick<
    PlcCommunityRecord,
    | 'id'
    | 'name'
    | 'identity'
    | 'needs'
    | 'operationalPlan'
    | 'meetings'
    | 'activities'
    | 'evaluation'
  >,
  options: PlcEvidenceRepositoryFilterOptions = {}
): PlcEvidenceItem[] {
  const q = (options.searchQuery ?? '').trim().toLowerCase();
  const typeFilter = options.evidenceTypeFilter ?? 'all';
  const targetFilter = options.linkedTargetTypeFilter ?? 'all';
  const dateFilter = (options.dateFilter ?? '').trim();
  const sortBy = options.sortBy ?? 'newest';

  const filtered = (evidenceRepository ?? []).filter((ev) => {
    const effectiveType =
      ev.evidenceType ??
      inferPlcEvidenceTypeFromMimeOrUrl(
        ev.mimeType,
        ev.fileName,
        ev.externalUrl
      );

    if (typeFilter !== 'all' && effectiveType !== typeFilter) {
      return false;
    }

    const relations = resolvePlcEvidenceLinks(ev, community);

    if (targetFilter === 'unlinked') {
      if (relations.length > 0) return false;
    } else if (targetFilter !== 'all') {
      const matchesTarget = relations.some((r) => {
        if (r.targetType === targetFilter) return true;
        if (
          targetFilter === 'activity' &&
          (r.targetType === 'program' ||
            r.targetType === 'activity' ||
            r.targetType === 'mutual_visit' ||
            r.targetType === 'community_partnership')
        ) {
          return true;
        }
        return false;
      });
      if (!matchesTarget) return false;
    }

    if (dateFilter) {
      const itemDate = ev.evidenceDate || ev.createdAt.slice(0, 10);
      if (!itemDate.startsWith(dateFilter)) return false;
    }

    if (q) {
      const haystack = [
        ev.title,
        ev.description,
        ev.category,
        ev.fileName ?? '',
        ev.sourceOrEntity ?? '',
        ev.notes ?? '',
        ...relations.map((r) => `${r.targetTypeLabel} ${r.targetDisplayTitle}`),
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  return [...deepCloneCommunity(filtered)].sort((a, b) => {
    const dateA = a.evidenceDate || a.createdAt;
    const dateB = b.evidenceDate || b.createdAt;
    if (sortBy === 'oldest') {
      const cmp = dateA.localeCompare(dateB);
      return cmp !== 0 ? cmp : a.createdAt.localeCompare(b.createdAt);
    }
    const cmp = dateB.localeCompare(dateA);
    return cmp !== 0 ? cmp : b.createdAt.localeCompare(a.createdAt);
  });
}

// ============================================================================
// ١٢. الدفعة الخامسة (Batch 5): النموذج التاسع — التقرير الختامي لمجتمع التعلّم المهني
// يُبنى آليًا بالكامل من البيانات المخزنة في المجتمع دون إعادة إدخال أو اختلاق بيانات
// ============================================================================

export interface PlcReportSectionCompletenessItem {
  id:
    | 'communityInfo'
    | 'goals'
    | 'needs'
    | 'operationalPlan'
    | 'meetings'
    | 'activities'
    | 'kpis'
    | 'impact'
    | 'evidences';
  label: string;
  isComplete: boolean;
  statusText: string;
  detailsText: string;
}

export interface PlcFinalReportCompleteness {
  sections: PlcReportSectionCompletenessItem[];
  completedSectionsCount: number;
  incompleteSectionsCount: number;
  totalSectionsCount: number;
  allComplete: boolean;
  overallSummaryText: string;
}

/**
 * مؤشر اكتمال البيانات للنموذج التاسع:
 * يفحص الأقسام التسعة للتقرير، وإذا كان أي قسم فارغاً أو غير مكتمل لا يعتبره صفراً،
 * بل يعرض النص الرسمي: «بيانات هذا القسم غير مكتملة.»
 */
export function computePlcFinalReportCompleteness(
  community: PlcCommunityRecord
): PlcFinalReportCompleteness {
  const leader = getPlcCommunityLeader(community);
  const hasCommunityBasic = Boolean(
    community.name.trim() &&
      community.specialty.trim() &&
      community.academicYear.trim() &&
      community.foundationDate.trim() &&
      leader &&
      community.members.length > 0
  );

  const hasGoalsAndIdentity = Boolean(
    community.identity.goals.length > 0 &&
      (community.identity.vision.trim() || community.identity.mission.trim())
  );

  const hasNeeds = community.needs.length > 0;
  const hasPlan = community.operationalPlan.length > 0;
  const hasMeetings = community.meetings.length > 0;
  const hasActivities = community.activities.length > 0;
  const hasKpis = community.evaluation.kpiIndicators.length > 0;
  const hasImpact = community.evaluation.impactMeasurements.length > 0;
  const hasEvidences = community.evidenceRepository.length > 0;

  const sections: PlcReportSectionCompletenessItem[] = [
    {
      id: 'communityInfo',
      label: 'بيانات المجتمع',
      isComplete: hasCommunityBasic,
      statusText: hasCommunityBasic
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasCommunityBasic
        ? `${community.members.length} عضو مسجل • رئيس المجتمع: ${leader?.name ?? 'غير محدد'}`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'goals',
      label: 'الأهداف والتعريف بالمجتمع',
      isComplete: hasGoalsAndIdentity,
      statusText: hasGoalsAndIdentity
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText:
        community.identity.goals.length > 0
          ? `${community.identity.goals.length} أهداف مسجلة`
          : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'needs',
      label: 'الاحتياجات والأولويات',
      isComplete: hasNeeds,
      statusText: hasNeeds
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasNeeds
        ? `${community.needs.length} احتياج مسجل`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'operationalPlan',
      label: 'الخطة التشغيلية',
      isComplete: hasPlan,
      statusText: hasPlan
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasPlan
        ? `${community.operationalPlan.length} إجراء مسجل في الخطة`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'meetings',
      label: 'الاجتماعات ومحاضرها',
      isComplete: hasMeetings,
      statusText: hasMeetings
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasMeetings
        ? `${community.meetings.length} اجتماع موثق`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'activities',
      label: 'البرامج والأنشطة والزيارات والشراكات',
      isComplete: hasActivities,
      statusText: hasActivities
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasActivities
        ? `${community.activities.length} سجل تنفيذ`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'kpis',
      label: 'مؤشرات الأداء',
      isComplete: hasKpis,
      statusText: hasKpis
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasKpis
        ? `${community.evaluation.kpiIndicators.length} مؤشر أداء`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'impact',
      label: 'قياس الأثر',
      isComplete: hasImpact,
      statusText: hasImpact
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasImpact
        ? `${community.evaluation.impactMeasurements.length} سجل قياس أثر`
        : 'بيانات هذا القسم غير مكتملة.',
    },
    {
      id: 'evidences',
      label: 'الشواهد والمرفقات',
      isComplete: hasEvidences,
      statusText: hasEvidences
        ? 'بيانات هذا القسم مكتملة.'
        : 'بيانات هذا القسم غير مكتملة.',
      detailsText: hasEvidences
        ? `${community.evidenceRepository.length} شاهد في المستودع الموحد`
        : 'بيانات هذا القسم غير مكتملة.',
    },
  ];

  const completedSectionsCount = sections.filter((s) => s.isComplete).length;
  const incompleteSectionsCount = sections.length - completedSectionsCount;

  return {
    sections,
    completedSectionsCount,
    incompleteSectionsCount,
    totalSectionsCount: sections.length,
    allComplete: incompleteSectionsCount === 0,
    overallSummaryText:
      incompleteSectionsCount === 0
        ? 'جميع أقسام التقرير التسعة مكتملة البيانات.'
        : `اكتملت بيانات ${completedSectionsCount} من أصل ${sections.length} أقسام، وتوجد ${incompleteSectionsCount} أقسام بياناتها غير مكتملة.`,
  };
}

// ----------------------------------------------------------------------------
// هياكل الأقسام 9.1 إلى 9.13 للتقرير الختامي التلقائي
// ----------------------------------------------------------------------------

export interface PlcFinalReportSection9_1 {
  communityId: string;
  name: string;
  specialty: string;
  academicYear: string;
  semester: PlcSemester;
  semesterLabel: string;
  venueDisplay: string;
  foundationDateDisplay: string;
  status: PlcCommunityStatus;
  statusLabel: string;
  leaderMember: PlcMember | null;
  leaderNameDisplay: string;
  leaderSpecialtyDisplay: string;
  membersCount: number;
  members: Array<{
    id: string;
    name: string;
    specialty: string;
    jobRoleDisplay: string;
    rolesLabels: string[];
  }>;
}

export interface PlcFinalReportSection9_2 {
  visionDisplay: string;
  missionDisplay: string;
  goals: PlcIdentityListItem[];
  values: PlcIdentityListItem[];
  principles: PlcIdentityListItem[];
  hasIdentityData: boolean;
}

export interface PlcFinalReportNeedRow {
  needId: string;
  needDescription: string;
  priority: PlcPriorityLevel;
  priorityLabel: string;
  sourceLabel: string;
  justificationDisplay: string;
  proposedActionDisplay: string;
  linkedGoalsDisplay: string;
  linkedActionsDisplay: string;
  statusDisplay: string;
}

export interface PlcFinalReportSection9_3 {
  totalNeedsCount: number;
  priorityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  sourcesBreakdown: Array<{ sourceLabel: string; count: number }>;
  proposedActionsList: string[];
  traceabilitySummary: string;
  rows: PlcFinalReportNeedRow[];
}

export interface PlcFinalReportPlanActionRow {
  actionId: string;
  goalDisplay: string;
  needsDisplay: string;
  actionTitle: string;
  responsibleDisplay: string;
  periodDisplay: string;
  resourcesDisplay: string;
  indicatorDisplay: string;
  status: PlcActionExecutionStatus;
  statusLabel: string;
  completionPercentage: number | null;
  completionDisplay: string;
}

export interface PlcFinalReportSection9_4 {
  totalActionsCount: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  stalledCount: number;
  cancelledCount: number;
  completionPercentage: number | null;
  completionDisplay: string;
  rows: PlcFinalReportPlanActionRow[];
}

export interface PlcFinalReportRecommendationRow {
  recommendationId: string;
  meetingId: string;
  meetingNumber: number;
  meetingDate: string;
  recommendationText: string;
  responsibleDisplay: string;
  targetDateDisplay: string;
  followupStatus: PlcFollowupStatus;
  followupStatusLabel: string;
  linkedActionDisplay: string;
  linkedActionId: string;
}

export interface PlcFinalReportMeetingItemSummary {
  meetingId: string;
  meetingNumber: number;
  date: string;
  meetingType: string;
  venueDisplay: string;
  presentCount: number;
  absentCount: number;
  presentNames: string[];
  absentNames: string[];
  agenda: string[];
  discussionSummaryDisplay: string;
  recommendationsCount: number;
}

export interface PlcFinalReportSection9_5 {
  totalMeetingsCount: number;
  meetingsByType: Array<{ meetingType: string; count: number }>;
  totalPresentEntries: number;
  totalAbsentEntries: number;
  keyTopics: string[];
  meetingsList: PlcFinalReportMeetingItemSummary[];
  recommendationsRows: PlcFinalReportRecommendationRow[];
}

export interface PlcFinalReportActivityRow {
  recordId: string;
  title: string;
  type: PlcActivityRecordType;
  typeLabel: string;
  goalOrObjectiveDisplay: string;
  needDisplay: string;
  actionDisplay: string;
  targetAudienceDisplay: string;
  periodDisplay: string;
  responsibleDisplay: string;
  status: PlcActivityRecordStatus;
  statusLabel: string;
  executiveResultsDisplay: string;
}

export interface PlcFinalReportSection9_6 {
  totalRecordsCount: number;
  byType: {
    program: PlcActivityTypeBreakdown;
    activity: PlcActivityTypeBreakdown;
    mutual_visit: PlcActivityTypeBreakdown;
    community_partnership: PlcActivityTypeBreakdown;
  };
  executiveResultsNote: string;
  rows: PlcFinalReportActivityRow[];
}

export interface PlcFinalReportKpiRow {
  kpiId: string;
  indicatorName: string;
  goalDisplay: string;
  needDisplay: string;
  actionDisplay: string;
  activityDisplay: string;
  baselineDisplay: string;
  targetDisplay: string;
  actualDisplay: string;
  unitDisplay: string;
  direction: PlcKpiDirectionType;
  directionLabel: string;
  achievementPercentage: number | null;
  achievementDisplay: string;
  isCalculated: boolean;
  descriptiveComparison: string;
}

export interface PlcFinalReportSection9_7 {
  executionEvaluation: PlcDerivedExecutionEvaluationSummary;
  qualitativeEvaluations: Array<{
    id: string;
    targetTitle: string;
    targetTypeLabel: string;
    executionLevel: string;
    strengths: string;
    improvements: string;
    notes: string;
  }>;
  kpiRows: PlcFinalReportKpiRow[];
  kpiDescriptiveAnalysis: string[];
}

export type PlcImpactEvidenceClassification =
  | 'verified_impact'
  | 'described_outcome'
  | 'no_impact_data';

export interface PlcFinalReportImpactRow {
  impactId: string;
  goalDisplay: string;
  needDisplay: string;
  actionDisplay: string;
  activityDisplay: string;
  beneficiaryCategoryDisplay: string;
  measurementMethodDisplay: string;
  measurementToolDisplay: string;
  measurementDateDisplay: string;
  baselineDisplay: string;
  targetDisplay: string;
  actualResultDisplay: string;
  resultsDescriptionDisplay: string;
  impactDescriptionDisplay: string;
  improvementDecisionDisplay: string;
  improvementOpportunitiesDisplay: string;
  supportingEvidencesTitles: string[];
  classification: PlcImpactEvidenceClassification;
  classificationLabel: string;
  objectiveAnalysisLine: string;
}

export interface PlcFinalReportSection9_8 {
  totalImpactRecordsCount: number;
  verifiedImpactsCount: number;
  describedOutcomesCount: number;
  overallClassification: PlcImpactEvidenceClassification;
  overallClassificationLabel: string;
  rows: PlcFinalReportImpactRow[];
  impactAnalysisParagraphs: string[];
}

export interface PlcFinalReportEvidenceRow {
  evidenceId: string;
  title: string;
  evidenceType: PlcEvidenceType;
  evidenceTypeLabel: string;
  dateDisplay: string;
  sourceDisplay: string;
  descriptionDisplay: string;
  linkedRecordsDisplay: string[];
  linkedRecordsCount: number;
  qrCodeToken?: string;
  qrPayload?: string;
  hasValidQr?: boolean;
  whatItProvesSummary?: string;
}

export interface PlcFinalReportSection9_9 {
  totalEvidencesCount: number;
  byEvidenceType: Array<{
    type: PlcEvidenceType;
    label: string;
    count: number;
  }>;
  linkedEvidencesCount: number;
  unlinkedEvidencesCount: number;
  impactLinkedEvidencesCount: number;
  kpiLinkedEvidencesCount: number;
  meetingsAndActivitiesLinkedEvidencesCount: number;
  rows: PlcFinalReportEvidenceRow[];
}

export interface PlcFinalReportAchievementItem {
  id: string;
  statement: string;
  source: string;
  category:
    | 'operational_plan'
    | 'meetings'
    | 'activities'
    | 'kpis'
    | 'impact'
    | 'evidences';
}

export interface PlcFinalReportSection9_10 {
  items: PlcFinalReportAchievementItem[];
  emptyMessage: string;
}

export interface PlcFinalReportChallengeItem {
  id: string;
  statement: string;
  source: string;
  recordedNote?: string;
}

export interface PlcFinalReportSection9_11 {
  items: PlcFinalReportChallengeItem[];
  emptyMessage: string;
}

export interface PlcFinalReportExtractedRecommendationItem {
  id: string;
  statement: string;
  source: string;
  responsibleOrDecision?: string;
  statusOrDate?: string;
}

export interface PlcFinalReportSection9_12 {
  extractedRecommendations: PlcFinalReportExtractedRecommendationItem[];
  customExecutiveNotes: string;
  customClosingNotes: string;
  hasAnyRecommendations: boolean;
}

export interface PlcChartBarItem {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  secondaryLabel?: string;
  unit?: string;
  colorHex: string;
  secondaryColorHex?: string;
}

export interface PlcFinalReportChartModel {
  id:
    | 'operational_plan_status'
    | 'kpi_target_vs_actual'
    | 'activities_by_status'
    | 'needs_by_priority'
    | 'impact_measurement';
  title: string;
  subtitle: string;
  chartKind: 'single_bar' | 'paired_bar';
  hasSufficientData: boolean;
  emptyMessage: string;
  items: PlcChartBarItem[];
}

export interface PlcFinalReportSection9_13 {
  operationalPlanStatusChart: PlcFinalReportChartModel;
  kpiTargetVsActualChart: PlcFinalReportChartModel;
  activitiesByStatusChart: PlcFinalReportChartModel;
  needsByPriorityChart: PlcFinalReportChartModel;
  impactMeasurementChart: PlcFinalReportChartModel;
  allCharts: PlcFinalReportChartModel[];
}

export interface PlcFinalReportGeneralAnalysis {
  planExecutionLevelText: string;
  activitiesExecutionLevelText: string;
  kpisStatusText: string;
  impactPresenceText: string;
  keyAchievementsSummaryText: string;
  keyChallengesSummaryText: string;
  improvementDecisionsSummaryText: string;
  paragraphs: string[];
}

export interface PlcGeneratedFinalReport {
  communityId: string;
  communityName: string;
  generatedAtIso: string;
  generatedDateDisplay: string;
  completeness: PlcFinalReportCompleteness;
  section9_1: PlcFinalReportSection9_1;
  section9_2: PlcFinalReportSection9_2;
  section9_3: PlcFinalReportSection9_3;
  section9_4: PlcFinalReportSection9_4;
  section9_5: PlcFinalReportSection9_5;
  section9_6: PlcFinalReportSection9_6;
  section9_7: PlcFinalReportSection9_7;
  section9_8: PlcFinalReportSection9_8;
  section9_9: PlcFinalReportSection9_9;
  section9_10: PlcFinalReportSection9_10;
  section9_11: PlcFinalReportSection9_11;
  section9_12: PlcFinalReportSection9_12;
  section9_13: PlcFinalReportSection9_13;
  generalAnalysis: PlcFinalReportGeneralAnalysis;
}

/**
 * يصنف سجل قياس الأثر إلى (أثر مثبت) أو (نتيجة موصوفة) بناءً على البيانات الفعلية المدخلة فقط.
 */
export function classifyPlcImpactMeasurementRecord(
  impact: PlcImpactMeasurementItem
): {
  classification: PlcImpactEvidenceClassification;
  classificationLabel: string;
  objectiveAnalysisLine: string;
} {
  const hasActualNumber =
    impact.actualValue !== null &&
    impact.actualValue !== undefined &&
    !Number.isNaN(Number(impact.actualValue));
  const hasBaselineNumber =
    impact.baselineValue !== null &&
    impact.baselineValue !== undefined &&
    !Number.isNaN(Number(impact.baselineValue));
  const hasTargetNumber =
    impact.targetValue !== null &&
    impact.targetValue !== undefined &&
    !Number.isNaN(Number(impact.targetValue));

  const unitLabel =
    impact.unit === 'أخرى' && impact.customUnit?.trim()
      ? impact.customUnit.trim()
      : impact.unit?.trim() || '';

  const beneficiary = impact.beneficiaryCategory?.trim() || 'الفئة المستهدفة';

  if (hasActualNumber && (hasBaselineNumber || hasTargetNumber)) {
    const actualNum = Number(impact.actualValue);
    let comparisonPhrase = `النتيجة الفعلية المسجلة (${actualNum}${unitLabel ? ` ${unitLabel}` : ''})`;

    if (hasBaselineNumber && hasTargetNumber) {
      const baseNum = Number(impact.baselineValue);
      const targetNum = Number(impact.targetValue);
      if (actualNum > baseNum) {
        comparisonPhrase = `تشير البيانات المدخلة إلى تحسن من خط الأساس (${baseNum}${unitLabel ? ` ${unitLabel}` : ''}) إلى النتيجة الفعلية (${actualNum}${unitLabel ? ` ${unitLabel}` : ''}) مقابل المستهدف (${targetNum}${unitLabel ? ` ${unitLabel}` : ''})`;
      } else if (actualNum < baseNum) {
        comparisonPhrase = `تشير البيانات المدخلة إلى تغير القيمة من خط الأساس (${baseNum}${unitLabel ? ` ${unitLabel}` : ''}) إلى النتيجة الفعلية (${actualNum}${unitLabel ? ` ${unitLabel}` : ''}) مقابل المستهدف (${targetNum}${unitLabel ? ` ${unitLabel}` : ''})`;
      } else {
        comparisonPhrase = `تشير البيانات المدخلة إلى ثبات القيمة عند (${actualNum}${unitLabel ? ` ${unitLabel}` : ''}) مقارنة بخط الأساس (${baseNum}${unitLabel ? ` ${unitLabel}` : ''}) والمستهدف (${targetNum}${unitLabel ? ` ${unitLabel}` : ''})`;
      }
    } else if (hasBaselineNumber) {
      const baseNum = Number(impact.baselineValue);
      if (actualNum > baseNum) {
        comparisonPhrase = `تشير البيانات المدخلة إلى تحسن من خط الأساس (${baseNum}${unitLabel ? ` ${unitLabel}` : ''}) إلى (${actualNum}${unitLabel ? ` ${unitLabel}` : ''})`;
      } else if (actualNum < baseNum) {
        comparisonPhrase = `تشير البيانات المدخلة إلى تغير من خط الأساس (${baseNum}${unitLabel ? ` ${unitLabel}` : ''}) إلى (${actualNum}${unitLabel ? ` ${unitLabel}` : ''})`;
      } else {
        comparisonPhrase = `تشير البيانات المدخلة إلى استقرار القيمة عند (${actualNum}${unitLabel ? ` ${unitLabel}` : ''}) مقارنة بخط الأساس`;
      }
    } else if (hasTargetNumber) {
      const targetNum = Number(impact.targetValue);
      comparisonPhrase = `تشير البيانات المدخلة إلى تسجيل نتيجة فعلية (${actualNum}${unitLabel ? ` ${unitLabel}` : ''}) مقابل المستهدف (${targetNum}${unitLabel ? ` ${unitLabel}` : ''})`;
    }

    return {
      classification: 'verified_impact',
      classificationLabel: 'أثر مثبت ببيانات قياس',
      objectiveAnalysisLine: `تم تسجيل قياس أثر للفئة المستهدفة (${beneficiary})؛ ${comparisonPhrase}.`,
    };
  }

  const hasQualitativeText = Boolean(
    impact.observedChangeDescription?.trim() ||
      impact.measurementResults?.trim()
  );

  if (hasQualitativeText || hasActualNumber) {
    const descSnippet =
      impact.observedChangeDescription?.trim() ||
      impact.measurementResults?.trim() ||
      `قيمة مسجلة (${impact.actualValue})`;
    return {
      classification: 'described_outcome',
      classificationLabel: 'نتيجة موصوفة (دون قياس كمي مقارن)',
      objectiveAnalysisLine: `تم تسجيل وصف نوعي للنتيجة للفئة المستهدفة (${beneficiary}): «${descSnippet}» دون توفر قياس كمي مقارن (خط أساس/مستهدف وفعلي)، وتُصنف كنتيجة موصوفة.`,
    };
  }

  return {
    classification: 'no_impact_data',
    classificationLabel: 'لا توجد بيانات أثر كافية',
    objectiveAnalysisLine: `لم تتوفر بيانات كافية للحكم على الأثر في هذا السجل للفئة المستهدفة (${beneficiary}).`,
  };
}

/**
 * يبني التقرير الختامي الكامل لمجتمع التعلّم المهني (الأقسام 9.1 إلى 9.13 + التحليل العام + مؤشر اكتمال البيانات)
 * آلياً بالكامل من البيانات المخزنة في المجتمع وعلاقاته بالـID دون أي اختلاق أو تكرار.
 */
export function buildPlcFinalReport(
  community: PlcCommunityRecord,
  generatedAtOverride?: string
): PlcGeneratedFinalReport {
  const generatedAtIso =
    generatedAtOverride ||
    community.finalReportCustomization?.lastGeneratedAt ||
    new Date().toISOString();
  const generatedDateDisplay = generatedAtIso.slice(0, 10);

  const completeness = computePlcFinalReportCompleteness(community);

  // ==========================================================================
  // القسم 9.1 — بيانات المجتمع (رئيس المجتمع يأتي حصراً من عضوية المجتمع)
  // ==========================================================================
  const leaderMember = getPlcCommunityLeader(community);
  const section9_1: PlcFinalReportSection9_1 = {
    communityId: community.id,
    name: community.name.trim() || 'غير متوفر',
    specialty: community.specialty.trim() || 'غير متوفر',
    academicYear: community.academicYear.trim() || 'غير متوفر',
    semester: community.semester,
    semesterLabel: PLC_SEMESTER_LABELS[community.semester] ?? 'غير متوفر',
    venueDisplay: community.venue.trim() || 'غير متوفر',
    foundationDateDisplay: community.foundationDate.trim() || 'غير متوفر',
    status: community.status,
    statusLabel: PLC_STATUS_LABELS[community.status] ?? 'غير متوفر',
    leaderMember,
    leaderNameDisplay: leaderMember ? leaderMember.name : 'غير محدد في العضوية',
    leaderSpecialtyDisplay: leaderMember?.specialty || 'غير متوفر',
    membersCount: community.members.length,
    members: community.members.map((m) => ({
      id: m.id,
      name: m.name,
      specialty: m.specialty || 'غير متوفر',
      jobRoleDisplay: m.jobRole?.trim() || 'معلم',
      rolesLabels: m.roles.map((r) => PLC_MEMBER_ROLE_LABELS[r]),
    })),
  };

  // ==========================================================================
  // القسم 9.2 — التعريف بالمجتمع (من النموذج 2 كما هي مخزنة)
  // ==========================================================================
  const iden = community.identity;
  const hasIdentityData = Boolean(
    iden.vision.trim() ||
      iden.mission.trim() ||
      iden.goals.length > 0 ||
      iden.values.length > 0 ||
      iden.principles.length > 0
  );
  const section9_2: PlcFinalReportSection9_2 = {
    visionDisplay: iden.vision.trim() || 'بيانات هذا القسم غير مكتملة.',
    missionDisplay: iden.mission.trim() || 'بيانات هذا القسم غير مكتملة.',
    goals: [...iden.goals].sort((a, b) => a.order - b.order),
    values: [...iden.values].sort((a, b) => a.order - b.order),
    principles: [...iden.principles].sort((a, b) => a.order - b.order),
    hasIdentityData,
  };

  // ==========================================================================
  // القسم 9.3 — الاحتياجات والأولويات وعلاقتها بالأهداف والإجراءات بالـID
  // ==========================================================================
  const priorityDistribution = {
    high: community.needs.filter((n) => n.priority === 'high').length,
    medium: community.needs.filter((n) => n.priority === 'medium').length,
    low: community.needs.filter((n) => n.priority === 'low').length,
  };

  const sourceCountsMap = new Map<string, number>();
  for (const need of community.needs) {
    const label = getPlcNeedSourceDisplayLabel(need);
    sourceCountsMap.set(label, (sourceCountsMap.get(label) ?? 0) + 1);
  }
  const sourcesBreakdown = Array.from(sourceCountsMap.entries()).map(
    ([sourceLabel, count]) => ({ sourceLabel, count })
  );

  const proposedActionsList = community.needs
    .map((n) => n.proposedAction.trim())
    .filter(Boolean);

  const needRows: PlcFinalReportNeedRow[] = community.needs.map((need) => {
    // الأهداف المرتبطة بالاحتياج مباشرة أو عبر إجراءات الخطة التشغيلية
    const directGoalIds = Array.isArray(need.linkedGoalIds)
      ? need.linkedGoalIds
      : [];
    const actionsLinkedToNeed = community.operationalPlan.filter((act) =>
      getPlcActionNeedIds(act).includes(need.id)
    );
    const actionGoalIds = actionsLinkedToNeed
      .map((a) => a.goalId)
      .filter(Boolean);
    const allGoalIds = Array.from(
      new Set([...directGoalIds, ...actionGoalIds])
    );

    const linkedGoalTexts = allGoalIds
      .map((gid) => community.identity.goals.find((g) => g.id === gid)?.text)
      .filter((t): t is string => Boolean(t));

    const linkedActionsTitles = actionsLinkedToNeed.map((a) => a.title);

    let statusDisplay = 'لم يدرج في الخطة التشغيلية بعد';
    if (actionsLinkedToNeed.length > 0) {
      const statuses = Array.from(
        new Set(
          actionsLinkedToNeed.map((a) => PLC_ACTION_STATUS_LABELS[a.status])
        )
      );
      statusDisplay = statuses.join(' / ');
    }

    return {
      needId: need.id,
      needDescription: need.description,
      priority: need.priority,
      priorityLabel: PLC_PRIORITY_LABELS[need.priority],
      sourceLabel: getPlcNeedSourceDisplayLabel(need),
      justificationDisplay: need.justification.trim() || 'غير متوفر',
      proposedActionDisplay: need.proposedAction.trim() || 'غير متوفر',
      linkedGoalsDisplay:
        linkedGoalTexts.length > 0
          ? linkedGoalTexts.join(' ، ')
          : 'غير مرتبط بهدف محدد',
      linkedActionsDisplay:
        linkedActionsTitles.length > 0
          ? linkedActionsTitles.join(' ، ')
          : 'غير مرتبط بإجراء في الخطة',
      statusDisplay,
    };
  });

  const linkedNeedsCount = needRows.filter(
    (r) => r.linkedActionsDisplay !== 'غير مرتبط بإجراء في الخطة'
  ).length;
  const traceabilitySummary =
    community.needs.length === 0
      ? 'لم يتم تسجيل احتياجات مهنية بعد.'
      : `تم ربط ${linkedNeedsCount} من أصل ${community.needs.length} احتياجات بإجراءات فعلية في الخطة التشغيلية وفق مسار التتبع (الاحتياج ← الهدف ← الإجراء).`;

  const section9_3: PlcFinalReportSection9_3 = {
    totalNeedsCount: community.needs.length,
    priorityDistribution,
    sourcesBreakdown,
    proposedActionsList,
    traceabilitySummary,
    rows: needRows,
  };

  // ==========================================================================
  // القسم 9.4 — الخطة التشغيلية (دون اختراع نسب إنجاز)
  // ==========================================================================
  const execSummary = computePlcExecutionEvaluationSummary(community);

  const planRows: PlcFinalReportPlanActionRow[] = community.operationalPlan.map(
    (action) => {
      const resolved = resolvePlcPlanActionLinks(action, community);
      const hasNumericPct =
        action.completionPercentage !== null &&
        action.completionPercentage !== undefined &&
        !Number.isNaN(Number(action.completionPercentage));

      const pctValue = hasNumericPct
        ? Math.max(0, Math.min(100, Number(action.completionPercentage)))
        : null;

      const completionDisplay =
        pctValue !== null
          ? `${pctValue}%`
          : action.status === 'completed'
            ? '100% (مكتمل)'
            : 'غير متوفر (لم تُسجل نسبة)';

      const periodDisplay =
        action.startDate && action.endDate
          ? `${action.startDate} إلى ${action.endDate}`
          : action.startDate || action.endDate || 'غير متوفر';

      const needsText =
        resolved.linkedNeeds.length > 0
          ? resolved.linkedNeeds.map((ln) => ln.need.description).join(' ، ')
          : 'غير مرتبط باحتياج محدد';

      return {
        actionId: action.id,
        goalDisplay: resolved.goalText || 'غير مرتبط بهدف محدد',
        needsDisplay: needsText,
        actionTitle: action.title,
        responsibleDisplay: resolved.responsibleDisplayName || 'غير محدد',
        periodDisplay,
        resourcesDisplay: action.resources.trim() || 'غير متوفر',
        indicatorDisplay: action.indicatorText.trim() || 'غير متوفر',
        status: action.status,
        statusLabel: PLC_ACTION_STATUS_LABELS[action.status],
        completionPercentage: pctValue,
        completionDisplay,
      };
    }
  );

  const section9_4: PlcFinalReportSection9_4 = {
    totalActionsCount: execSummary.plannedActionsTotalCount,
    notStartedCount: execSummary.notStartedActionsCount,
    inProgressCount: execSummary.inProgressActionsCount,
    completedCount: execSummary.executedActionsCount,
    stalledCount: execSummary.stalledActionsCount,
    cancelledCount: execSummary.cancelledActionsCount,
    completionPercentage: execSummary.actualPlanCompletionPercentage,
    completionDisplay: execSummary.actualPlanCompletionDisplay,
    rows: planRows,
  };

  // ==========================================================================
  // القسم 9.5 — الاجتماعات ومحاضرها وجدول التوصيات المرتبطة بالـID
  // ==========================================================================
  const meetingTypeMap = new Map<string, number>();
  let totalPresentEntries = 0;
  let totalAbsentEntries = 0;
  const keyTopicsSet = new Set<string>();
  const recommendationsRows: PlcFinalReportRecommendationRow[] = [];

  const meetingsList: PlcFinalReportMeetingItemSummary[] = [
    ...community.meetings,
  ]
    .sort((a, b) => a.meetingNumber - b.meetingNumber)
    .map((mtg) => {
      const mType = mtg.meetingType.trim() || 'اجتماع دوري';
      meetingTypeMap.set(mType, (meetingTypeMap.get(mType) ?? 0) + 1);

      const resolvedAttendance = resolvePlcMeetingAttendance(mtg, community);
      const presentMembers = resolvedAttendance.filter((a) => a.present);
      const absentMembers = resolvedAttendance.filter((a) => !a.present);
      totalPresentEntries += presentMembers.length;
      totalAbsentEntries += absentMembers.length;

      for (const topic of mtg.agenda) {
        if (topic.trim()) keyTopicsSet.add(topic.trim());
      }
      if (mtg.discussionSummary.trim() && mtg.agenda.length === 0) {
        keyTopicsSet.add(mtg.discussionSummary.trim());
      }

      for (const rec of mtg.recommendations) {
        const resolvedRec = resolvePlcMeetingRecommendationLinks(
          rec,
          community
        );
        recommendationsRows.push({
          recommendationId: rec.id,
          meetingId: mtg.id,
          meetingNumber: mtg.meetingNumber,
          meetingDate: mtg.date,
          recommendationText: rec.text,
          responsibleDisplay: resolvedRec.responsibleDisplayName,
          targetDateDisplay: rec.targetDate.trim() || 'غير متوفر',
          followupStatus: rec.followupStatus,
          followupStatusLabel: resolvedRec.followupStatusLabel,
          linkedActionDisplay: resolvedRec.linkedActionDisplayTitle,
          linkedActionId: rec.linkedActionId || '',
        });
      }

      return {
        meetingId: mtg.id,
        meetingNumber: mtg.meetingNumber,
        date: mtg.date,
        meetingType: mType,
        venueDisplay: mtg.venue.trim() || community.venue.trim() || 'غير متوفر',
        presentCount: presentMembers.length,
        absentCount: absentMembers.length,
        presentNames: presentMembers.map((p) => p.displayName),
        absentNames: absentMembers.map((a) => a.displayName),
        agenda: mtg.agenda,
        discussionSummaryDisplay: mtg.discussionSummary.trim() || 'غير متوفر',
        recommendationsCount: mtg.recommendations.length,
      };
    });

  const section9_5: PlcFinalReportSection9_5 = {
    totalMeetingsCount: community.meetings.length,
    meetingsByType: Array.from(meetingTypeMap.entries()).map(
      ([meetingType, count]) => ({ meetingType, count })
    ),
    totalPresentEntries,
    totalAbsentEntries,
    keyTopics: Array.from(keyTopicsSet),
    meetingsList,
    recommendationsRows,
  };

  // ==========================================================================
  // القسم 9.6 — البرامج والأنشطة والزيارات والشراكات (مع التفريق الصارم بين النتائج التنفيذية والأثر)
  // ==========================================================================
  const activityRows: PlcFinalReportActivityRow[] = community.activities.map(
    (rec) => {
      const resolved = resolvePlcActivityRecordLinks(rec, community);
      let executiveResultsDisplay = 'لم يُنفذ بعد (مخطط له)';
      if (rec.status === 'cancelled') {
        executiveResultsDisplay = 'ملغى';
      } else if (rec.status === 'in_progress') {
        executiveResultsDisplay =
          rec.results.trim() ||
          rec.actualExecutionDescription.trim() ||
          'قيد التنفيذ (لم تُرصد نتائج تنفيذية نهائية بعد)';
      } else if (rec.status === 'completed') {
        executiveResultsDisplay =
          rec.results.trim() ||
          rec.actualExecutionDescription.trim() ||
          'تم التنفيذ (لم يُسجل وصف للنتيجة التنفيذية)';
      }

      return {
        recordId: rec.id,
        title: rec.title,
        type: rec.type,
        typeLabel: PLC_ACTIVITY_TYPE_LABELS[rec.type],
        goalOrObjectiveDisplay: resolved.resolvedObjectiveText,
        needDisplay: resolved.linkedNeedDisplay,
        actionDisplay: resolved.linkedActionDisplay,
        targetAudienceDisplay: rec.targetAudience.trim() || 'غير متوفر',
        periodDisplay: rec.executionDateOrPeriod.trim() || 'غير متوفر',
        responsibleDisplay: resolved.responsibleDisplayText,
        status: rec.status,
        statusLabel: PLC_ACTIVITY_STATUS_LABELS[rec.status],
        executiveResultsDisplay,
      };
    }
  );

  const section9_6: PlcFinalReportSection9_6 = {
    totalRecordsCount: community.activities.length,
    byType: execSummary.byRecordType,
    executiveResultsNote:
      'النتائج المعروضة في هذا القسم تمثل نتائج تنفيذية فقط (ما تم تنفيذه من برامج وأنشطة وزيارات وشراكات)، ولا تُعد بحد ذاتها أثرًا؛ إذ يُعرض قياس الأثر المستقل في القسم (9.8).',
    rows: activityRows,
  };

  // ==========================================================================
  // القسم 9.7 — التقويم ومؤشرات الأداء والتحليل الوصفي الموضوعي للمؤشرات
  // ==========================================================================
  const qualitativeEvaluations = community.evaluation.executionEvaluations.map(
    (item) => {
      const resolved = resolvePlcExecutionEvaluationLinks(item, community);
      return {
        id: item.id,
        targetTitle: resolved.targetDisplayTitle,
        targetTypeLabel: resolved.targetTypeLabel,
        executionLevel: item.executionLevel,
        strengths: item.strengths || 'غير متوفر',
        improvements: item.improvements || 'غير متوفر',
        notes: item.notes || 'غير متوفر',
      };
    }
  );

  const kpiDescriptiveAnalysis: string[] = [];
  const kpiRows: PlcFinalReportKpiRow[] =
    community.evaluation.kpiIndicators.map((kpi) => {
      const resolved = resolvePlcKpiIndicatorLinks(kpi, community);
      const calc = resolved.achievement;
      const direction: PlcKpiDirectionType =
        kpi.indicatorType ?? 'higher_is_better';

      let descriptiveComparison =
        'بيانات القياس غير مكتملة للمقارنة بين المستهدف والفعلي.';
      const targetNum =
        kpi.targetValue !== null &&
        kpi.targetValue !== undefined &&
        !Number.isNaN(Number(kpi.targetValue))
          ? Number(kpi.targetValue)
          : null;
      const actualNum =
        kpi.achievedValue !== null &&
        kpi.achievedValue !== undefined &&
        !Number.isNaN(Number(kpi.achievedValue))
          ? Number(kpi.achievedValue)
          : null;

      if (targetNum !== null && actualNum !== null) {
        if (direction === 'higher_is_better') {
          if (actualNum > targetNum) {
            descriptiveComparison = `المؤشر «${kpi.name}»: القيمة الفعلية (${actualNum} ${calc.unitDisplay}) تجاوزت القيمة المستهدفة (${targetNum} ${calc.unitDisplay}).`;
          } else if (actualNum === targetNum) {
            descriptiveComparison = `المؤشر «${kpi.name}»: القيمة الفعلية (${actualNum} ${calc.unitDisplay}) ساوت القيمة المستهدفة (${targetNum} ${calc.unitDisplay}).`;
          } else {
            descriptiveComparison = `المؤشر «${kpi.name}»: القيمة الفعلية (${actualNum} ${calc.unitDisplay}) أقل من القيمة المستهدفة (${targetNum} ${calc.unitDisplay}).`;
          }
        } else if (direction === 'lower_is_better') {
          if (actualNum < targetNum) {
            descriptiveComparison = `المؤشر «${kpi.name}» (اتجاه عكسي - الأقل أفضل): القيمة الفعلية (${actualNum} ${calc.unitDisplay}) أفضل من المستهدف (${targetNum} ${calc.unitDisplay}).`;
          } else if (actualNum === targetNum) {
            descriptiveComparison = `المؤشر «${kpi.name}» (اتجاه عكسي - الأقل أفضل): القيمة الفعلية (${actualNum} ${calc.unitDisplay}) حققت المستهدف (${targetNum} ${calc.unitDisplay}).`;
          } else {
            descriptiveComparison = `المؤشر «${kpi.name}» (اتجاه عكسي - الأقل أفضل): القيمة الفعلية (${actualNum} ${calc.unitDisplay}) أعلى من الحد المستهدف (${targetNum} ${calc.unitDisplay}) ولم تصل للخفض المطلوب.`;
          }
        } else if (direction === 'exact_target') {
          if (actualNum === targetNum) {
            descriptiveComparison = `المؤشر «${kpi.name}»: القيمة الفعلية (${actualNum} ${calc.unitDisplay}) طابقت الهدف المحدد (${targetNum} ${calc.unitDisplay}).`;
          } else {
            descriptiveComparison = `المؤشر «${kpi.name}»: القيمة الفعلية (${actualNum} ${calc.unitDisplay}) تختلف عن القيمة المحددة المستهدفة (${targetNum} ${calc.unitDisplay}).`;
          }
        } else {
          descriptiveComparison = `المؤشر «${kpi.name}»: سُجلت القيمة الفعلية (${actualNum} ${calc.unitDisplay}) مقابل المستهدف (${targetNum} ${calc.unitDisplay})، واتجاه المؤشر محدد بـ «لا ينطبق» للحساب الآلي.`;
        }
      } else {
        descriptiveComparison = `المؤشر «${kpi.name}»: لم تتوفر قراءتا المستهدف والفعلي معاً، لذا لم يتم احتساب نسبة الإنجاز آليًا.`;
      }

      kpiDescriptiveAnalysis.push(descriptiveComparison);

      return {
        kpiId: kpi.id,
        indicatorName: kpi.name,
        goalDisplay: resolved.linkedGoalDisplay,
        needDisplay: resolved.linkedNeedDisplay,
        actionDisplay: resolved.linkedActionDisplay,
        activityDisplay: resolved.linkedActivityDisplay,
        baselineDisplay: calc.baselineDisplay,
        targetDisplay: calc.targetDisplay,
        actualDisplay: calc.actualDisplay,
        unitDisplay: calc.unitDisplay,
        direction,
        directionLabel: resolved.indicatorTypeLabel,
        achievementPercentage: calc.percentage,
        achievementDisplay: calc.isCalculated
          ? `${calc.percentage}%`
          : 'لم يتم احتساب نسبة الإنجاز آليًا',
        isCalculated: calc.isCalculated,
        descriptiveComparison,
      };
    });

  if (kpiRows.length === 0) {
    kpiDescriptiveAnalysis.push('لم يتم تسجيل مؤشرات أداء في هذا المجتمع.');
  }

  const section9_7: PlcFinalReportSection9_7 = {
    executionEvaluation: execSummary,
    qualitativeEvaluations,
    kpiRows,
    kpiDescriptiveAnalysis,
  };

  // ==========================================================================
  // القسم 9.8 — قياس الأثر وتحليله الصارم (أثر مثبت / نتيجة موصوفة / لا توجد بيانات أثر)
  // ==========================================================================
  const impactRows: PlcFinalReportImpactRow[] =
    community.evaluation.impactMeasurements.map((imp) => {
      const resolved = resolvePlcImpactMeasurementLinks(imp, community);
      const classInfo = classifyPlcImpactMeasurementRecord(imp);

      return {
        impactId: imp.id,
        goalDisplay: resolved.linkedGoalDisplay,
        needDisplay: resolved.linkedNeedDisplay,
        actionDisplay: resolved.linkedActionDisplay,
        activityDisplay: resolved.linkedActivityDisplay,
        beneficiaryCategoryDisplay:
          imp.beneficiaryCategory.trim() || 'غير متوفر',
        measurementMethodDisplay: resolved.methodDisplay,
        measurementToolDisplay: imp.measurementTool?.trim() || 'غير متوفر',
        measurementDateDisplay: imp.measurementDate.trim() || 'غير متوفر',
        baselineDisplay: resolved.baselineDisplay,
        targetDisplay: resolved.targetDisplay,
        actualResultDisplay: resolved.actualDisplay,
        resultsDescriptionDisplay: imp.measurementResults.trim() || 'غير متوفر',
        impactDescriptionDisplay:
          imp.observedChangeDescription.trim() || 'غير متوفر',
        improvementDecisionDisplay: resolved.decisionDisplay,
        improvementOpportunitiesDisplay:
          imp.improvementOpportunities.trim() || 'غير متوفر',
        supportingEvidencesTitles: resolved.supportingEvidences.map(
          (ev) => ev.title
        ),
        classification: classInfo.classification,
        classificationLabel: classInfo.classificationLabel,
        objectiveAnalysisLine: classInfo.objectiveAnalysisLine,
      };
    });

  const verifiedImpactsCount = impactRows.filter(
    (r) => r.classification === 'verified_impact'
  ).length;
  const describedOutcomesCount = impactRows.filter(
    (r) => r.classification === 'described_outcome'
  ).length;

  let overallClassification: PlcImpactEvidenceClassification = 'no_impact_data';
  let overallClassificationLabel = 'لا توجد بيانات أثر';
  if (verifiedImpactsCount > 0) {
    overallClassification = 'verified_impact';
    overallClassificationLabel = 'أثر مثبت';
  } else if (describedOutcomesCount > 0) {
    overallClassification = 'described_outcome';
    overallClassificationLabel = 'نتيجة موصوفة';
  }

  const impactAnalysisParagraphs: string[] = [];
  if (impactRows.length === 0) {
    impactAnalysisParagraphs.push(
      'لم تتوفر بيانات كافية للحكم على الأثر؛ حيث لم يتم تسجيل أي سجل في قسم قياس الأثر حتى تاريخ توليد هذا التقرير.'
    );
    if (
      execSummary.executedActionsCount > 0 ||
      execSummary.executedExecutionRecordsCount > 0
    ) {
      impactAnalysisParagraphs.push(
        'ملاحظة منهجية: توجد إجراءات أو أنشطة منفذة في المجتمع، إلا أن تنفيذ النشاط يُعد نتيجة تنفيذية ولا يُصنف أثرًا ما لم يُرفق بقياس أثر فعلي مستقل.'
      );
    }
  } else {
    impactAnalysisParagraphs.push(
      `تم تسجيل قياس أثر بعدد (${impactRows.length}) سجل/سجلات في المجتمع (منها ${verifiedImpactsCount} أثر مثبت ببيانات قياس كمية، و${describedOutcomesCount} نتيجة موصوفة).`
    );
    for (const row of impactRows) {
      impactAnalysisParagraphs.push(row.objectiveAnalysisLine);
    }
  }

  const section9_8: PlcFinalReportSection9_8 = {
    totalImpactRecordsCount: impactRows.length,
    verifiedImpactsCount,
    describedOutcomesCount,
    overallClassification,
    overallClassificationLabel,
    rows: impactRows,
    impactAnalysisParagraphs,
  };

  // ==========================================================================
  // القسم 9.9 — الشواهد والمرفقات (دون تكرار الملفات مع عرض العلاقات الحية)
  // ==========================================================================
  const evidenceTypeCountMap = new Map<PlcEvidenceType, number>();
  let linkedEvidencesCount = 0;
  let impactLinkedEvidencesCount = 0;
  let kpiLinkedEvidencesCount = 0;
  let meetingsAndActivitiesLinkedEvidencesCount = 0;

  const evidenceRows: PlcFinalReportEvidenceRow[] =
    community.evidenceRepository.map((ev) => {
      const effectiveType =
        ev.evidenceType ??
        inferPlcEvidenceTypeFromMimeOrUrl(
          ev.mimeType,
          ev.fileName,
          ev.externalUrl
        );
      evidenceTypeCountMap.set(
        effectiveType,
        (evidenceTypeCountMap.get(effectiveType) ?? 0) + 1
      );

      const relations = resolvePlcEvidenceLinks(ev, community).filter(
        (r) => !r.isTargetDeleted
      );
      if (relations.length > 0) linkedEvidencesCount += 1;

      if (relations.some((r) => r.targetType === 'impact')) {
        impactLinkedEvidencesCount += 1;
      }
      if (relations.some((r) => r.targetType === 'kpi')) {
        kpiLinkedEvidencesCount += 1;
      }
      if (
        relations.some(
          (r) =>
            r.targetType === 'meeting' ||
            r.targetType === 'program' ||
            r.targetType === 'activity' ||
            r.targetType === 'mutual_visit' ||
            r.targetType === 'community_partnership'
        )
      ) {
        meetingsAndActivitiesLinkedEvidencesCount += 1;
      }

      // بناء رمز QR صالح ومرتبط بسجل فعلي فقط (دون عرض QR غير صالح أو غير مرتبط)
      let validQrPayload = '';
      const cleanEvToken = ev.qrCodeToken?.trim() || '';
      const linkedMeetingRelation = relations.find((r) => r.targetType === 'meeting');
      const linkedActivityRelation = relations.find(
        (r) =>
          r.targetType === 'program' ||
          r.targetType === 'activity' ||
          r.targetType === 'mutual_visit' ||
          r.targetType === 'community_partnership'
      );

      if (linkedActivityRelation) {
        const actObj = community.activities.find(
          (a) => a.id === linkedActivityRelation.targetId
        );
        if (actObj && actObj.qrCodeToken?.trim()) {
          validQrPayload = buildPlcRecordQrPayload(
            community.id,
            'activity',
            actObj.id,
            actObj.qrCodeToken
          );
        }
      } else if (linkedMeetingRelation) {
        const mtgObj = community.meetings.find(
          (m) => m.id === linkedMeetingRelation.targetId
        );
        if (mtgObj && mtgObj.qrCodeToken?.trim()) {
          validQrPayload = buildPlcRecordQrPayload(
            community.id,
            'meeting',
            mtgObj.id,
            mtgObj.qrCodeToken
          );
        }
      } else if (relations.length > 0 && cleanEvToken && ev.id.trim()) {
        validQrPayload = `plc://community/${encodeURIComponent(
          community.id.trim()
        )}/evidence/${encodeURIComponent(ev.id.trim())}?token=${encodeURIComponent(
          cleanEvToken
        )}`;
      }

      const primaryProofTarget =
        relations.find((r) => r.targetType === 'impact') ||
        relations.find((r) => r.targetType === 'kpi') ||
        relations[0];

      const whatItProvesSummary = ev.description.trim()
        ? ev.description.trim()
        : primaryProofTarget
        ? `يوثق ويُثبت: ${primaryProofTarget.targetTypeLabel} (${primaryProofTarget.targetDisplayTitle})`
        : 'شاهد توثيقي مسجل في مستودع المجتمع';

      return {
        evidenceId: ev.id,
        title: ev.title,
        evidenceType: effectiveType,
        evidenceTypeLabel:
          effectiveType === 'other' && ev.customEvidenceType?.trim()
            ? `أخرى (${ev.customEvidenceType.trim()})`
            : PLC_EVIDENCE_TYPE_LABELS[effectiveType],
        dateDisplay: ev.evidenceDate?.trim() || ev.createdAt.slice(0, 10),
        sourceDisplay: ev.sourceOrEntity?.trim() || 'غير متوفر',
        descriptionDisplay: ev.description.trim() || 'غير متوفر',
        linkedRecordsDisplay:
          relations.length > 0
            ? relations.map(
                (r) => `${r.targetTypeLabel}: ${r.targetDisplayTitle}`
              )
            : ['غير مرتبط بسجل محدد'],
        linkedRecordsCount: relations.length,
        qrCodeToken: cleanEvToken || undefined,
        qrPayload: validQrPayload || undefined,
        hasValidQr: Boolean(validQrPayload && relations.length > 0),
        whatItProvesSummary,
      };
    });

  const byEvidenceType = Array.from(evidenceTypeCountMap.entries()).map(
    ([type, count]) => ({
      type,
      label: PLC_EVIDENCE_TYPE_LABELS[type],
      count,
    })
  );

  const section9_9: PlcFinalReportSection9_9 = {
    totalEvidencesCount: community.evidenceRepository.length,
    byEvidenceType,
    linkedEvidencesCount,
    unlinkedEvidencesCount:
      community.evidenceRepository.length - linkedEvidencesCount,
    impactLinkedEvidencesCount,
    kpiLinkedEvidencesCount,
    meetingsAndActivitiesLinkedEvidencesCount,
    rows: evidenceRows,
  };

  // ==========================================================================
  // القسم 9.10 — الإنجازات (مبنية حصراً على بيانات فعلية مع ذكر المصدر)
  // ==========================================================================
  const achievements: PlcFinalReportAchievementItem[] = [];

  if (execSummary.executedActionsCount > 0) {
    achievements.push({
      id: 'ach_plan_executed',
      statement: `تم تنفيذ ${execSummary.executedActionsCount} إجراءات من أصل ${execSummary.plannedActionsTotalCount} إجراءات مخططة في الخطة التشغيلية.`,
      source: 'الخطة التشغيلية (النموذج 4)',
      category: 'operational_plan',
    });
  }

  if (community.meetings.length > 0) {
    const completedRecs = recommendationsRows.filter(
      (r) => r.followupStatus === 'completed'
    ).length;
    achievements.push({
      id: 'ach_meetings_held',
      statement: `تم عقد وتوثيق ${community.meetings.length} اجتماعات لمجتمع التعلّم المهني${
        completedRecs > 0
          ? `، وإنجاز ${completedRecs} توصيات من توصيات الاجتماعات`
          : ''
      }.`,
      source: 'الاجتماعات ومحاضرها (النموذج 5)',
      category: 'meetings',
    });
  }

  if (execSummary.byRecordType.program.executed > 0) {
    achievements.push({
      id: 'ach_programs_executed',
      statement: `تم تنفيذ ${execSummary.byRecordType.program.executed} برامج مهنية من أصل ${execSummary.byRecordType.program.total} برامج مسجلة.`,
      source: 'البرامج والأنشطة والزيارات والشراكات (النموذج 6)',
      category: 'activities',
    });
  }

  if (execSummary.byRecordType.activity.executed > 0) {
    achievements.push({
      id: 'ach_activities_executed',
      statement: `تم تنفيذ ${execSummary.byRecordType.activity.executed} أنشطة مهنية من أصل ${execSummary.byRecordType.activity.total} أنشطة مسجلة.`,
      source: 'البرامج والأنشطة والزيارات والشراكات (النموذج 6)',
      category: 'activities',
    });
  }

  if (execSummary.byRecordType.mutual_visit.executed > 0) {
    achievements.push({
      id: 'ach_visits_executed',
      statement: `تم تنفيذ ${execSummary.byRecordType.mutual_visit.executed} زيارات متبادلة بين الأقران.`,
      source: 'البرامج والأنشطة والزيارات والشراكات (النموذج 6)',
      category: 'activities',
    });
  }

  if (execSummary.byRecordType.community_partnership.executed > 0) {
    achievements.push({
      id: 'ach_partnerships_executed',
      statement: `تم تنفيذ ${execSummary.byRecordType.community_partnership.executed} شراكات مجتمعية موثقة.`,
      source: 'البرامج والأنشطة والزيارات والشراكات (النموذج 6)',
      category: 'activities',
    });
  }

  for (const kpi of community.evaluation.kpiIndicators) {
    const targetNum =
      kpi.targetValue !== null &&
      kpi.targetValue !== undefined &&
      !Number.isNaN(Number(kpi.targetValue))
        ? Number(kpi.targetValue)
        : null;
    const actualNum =
      kpi.achievedValue !== null &&
      kpi.achievedValue !== undefined &&
      !Number.isNaN(Number(kpi.achievedValue))
        ? Number(kpi.achievedValue)
        : null;
    if (targetNum === null || actualNum === null) continue;

    const dir = kpi.indicatorType ?? 'higher_is_better';
    const metTarget =
      (dir === 'higher_is_better' && actualNum >= targetNum) ||
      (dir === 'lower_is_better' && actualNum <= targetNum) ||
      (dir === 'exact_target' && actualNum === targetNum);

    if (metTarget) {
      achievements.push({
        id: `ach_kpi_${kpi.id}`,
        statement: `حقق مؤشر الأداء «${kpi.name}» القيمة المستهدفة (المستهدف: ${targetNum}، الفعلي: ${actualNum}).`,
        source: 'مؤشرات الأداء (النموذج 7)',
        category: 'kpis',
      });
    }
  }

  for (const impRow of impactRows) {
    if (impRow.classification === 'verified_impact') {
      achievements.push({
        id: `ach_impact_${impRow.impactId}`,
        statement: `تم قياس وتوثيق أثر مثبت للفئة المستهدفة (${impRow.beneficiaryCategoryDisplay}) — النتيجة الفعلية: ${impRow.actualResultDisplay}.`,
        source: 'قياس الأثر (النموذج 7)',
        category: 'impact',
      });
    }
  }

  if (community.evidenceRepository.length > 0) {
    achievements.push({
      id: 'ach_evidences_documented',
      statement: `تم توثيق ${community.evidenceRepository.length} شواهد ومرفقات في المستودع الموحد للمجتمع (منها ${linkedEvidencesCount} شواهد مرتبطة بالسجلات).`,
      source: 'مستودع الشواهد والمرفقات (النموذج 8)',
      category: 'evidences',
    });
  }

  const section9_10: PlcFinalReportSection9_10 = {
    items: achievements,
    emptyMessage:
      'لا توجد إنجازات مسجلة حتى الآن بناءً على البيانات الفعلية للمجتمع.',
  };

  // ==========================================================================
  // القسم 9.11 — التحديات (مبنية حصراً على بيانات فعلية دون اختلاق أسباب غير مدخلة)
  // ==========================================================================
  const challenges: PlcFinalReportChallengeItem[] = [];

  for (const act of community.operationalPlan) {
    if (act.status === 'stalled') {
      challenges.push({
        id: `chal_stalled_${act.id}`,
        statement: `يوجد إجراء في الخطة التشغيلية بحالة متعثر: «${act.title}».`,
        source: 'الخطة التشغيلية (النموذج 4)',
        recordedNote: act.notes?.trim() || undefined,
      });
    } else if (act.status === 'cancelled') {
      challenges.push({
        id: `chal_cancelled_${act.id}`,
        statement: `يوجد إجراء في الخطة التشغيلية بحالة ملغى: «${act.title}».`,
        source: 'الخطة التشغيلية (النموذج 4)',
        recordedNote: act.notes?.trim() || undefined,
      });
    }
  }

  for (const actRec of community.activities) {
    if (actRec.status === 'cancelled') {
      challenges.push({
        id: `chal_act_cancelled_${actRec.id}`,
        statement: `يوجد سجل ${PLC_ACTIVITY_TYPE_LABELS[actRec.type]} بحالة ملغى: «${actRec.title}».`,
        source: 'البرامج والأنشطة والزيارات والشراكات (النموذج 6)',
      });
    }
  }

  for (const recRow of recommendationsRows) {
    if (recRow.followupStatus === 'delayed') {
      challenges.push({
        id: `chal_rec_delayed_${recRow.recommendationId}`,
        statement: `توجد توصية اجتماع بحالة متأخر في الاجتماع (${recRow.meetingNumber}): «${recRow.recommendationText}».`,
        source: 'الاجتماعات ومحاضرها (النموذج 5)',
      });
    }
  }

  for (const evalItem of community.evaluation.executionEvaluations) {
    if (evalItem.improvements.trim()) {
      const resolved = resolvePlcExecutionEvaluationLinks(evalItem, community);
      challenges.push({
        id: `chal_exeval_${evalItem.id}`,
        statement: `ملاحظة تحسين مسجلة على «${resolved.targetDisplayTitle}»: ${evalItem.improvements.trim()}`,
        source: 'تقويم التنفيذ (النموذج 7)',
        recordedNote: evalItem.notes.trim() || undefined,
      });
    }
  }

  for (const kpi of community.evaluation.kpiIndicators) {
    const targetNum =
      kpi.targetValue !== null &&
      kpi.targetValue !== undefined &&
      !Number.isNaN(Number(kpi.targetValue))
        ? Number(kpi.targetValue)
        : null;
    const actualNum =
      kpi.achievedValue !== null &&
      kpi.achievedValue !== undefined &&
      !Number.isNaN(Number(kpi.achievedValue))
        ? Number(kpi.achievedValue)
        : null;

    if (targetNum !== null && actualNum !== null) {
      const dir = kpi.indicatorType ?? 'higher_is_better';
      const belowTarget =
        (dir === 'higher_is_better' && actualNum < targetNum) ||
        (dir === 'lower_is_better' && actualNum > targetNum) ||
        (dir === 'exact_target' && actualNum !== targetNum);

      if (belowTarget) {
        challenges.push({
          id: `chal_kpi_below_${kpi.id}`,
          statement: `انخفاض مؤشر الأداء «${kpi.name}» عن المستهدف (المستهدف: ${targetNum}، الفعلي: ${actualNum}).`,
          source: 'مؤشرات الأداء (النموذج 7)',
          recordedNote: kpi.notes?.trim() || undefined,
        });
      }
    } else {
      challenges.push({
        id: `chal_kpi_incomplete_${kpi.id}`,
        statement: `نقص بيانات القياس في مؤشر الأداء «${kpi.name}» (لم تُستكمل قراءتا المستهدف والفعلي).`,
        source: 'مؤشرات الأداء (النموذج 7)',
      });
    }
  }

  for (const imp of community.evaluation.impactMeasurements) {
    const dec = imp.improvementDecision?.trim();
    if (dec === 'modify' || dec === 're_execute' || dec === 'stop_action') {
      const decLabel = getPlcImprovementDecisionDisplayLabel(
        dec,
        imp.customImprovementDecision
      );
      challenges.push({
        id: `chal_imp_decision_${imp.id}`,
        statement: `قرار تحسين مرتبط بقياس الأثر للفئة (${imp.beneficiaryCategory}): «${decLabel}».`,
        source: 'قياس الأثر (النموذج 7)',
        recordedNote:
          imp.improvementOpportunities.trim() || imp.notes?.trim() || undefined,
      });
    }
  }

  if (
    community.evaluation.impactMeasurements.length === 0 &&
    (execSummary.executedActionsCount > 0 ||
      execSummary.executedExecutionRecordsCount > 0)
  ) {
    challenges.push({
      id: 'chal_missing_impact_data',
      statement:
        'نقص بيانات قياس الأثر بعد تنفيذ الإجراءات أو الأنشطة (لم يُسجل قياس أثر فعلي حتى الآن).',
      source: 'قياس الأثر (النموذج 7)',
    });
  }

  const section9_11: PlcFinalReportSection9_11 = {
    items: challenges,
    emptyMessage: 'لا توجد تحديات أو حالات تعثر مسجلة في البيانات الحالية.',
  };

  // ==========================================================================
  // القسم 9.12 — التوصيات (مستخرجة آلياً من المصادر الفعلية + الملاحظات الختامية اليدوية فقط)
  // ==========================================================================
  const extractedRecommendations: PlcFinalReportExtractedRecommendationItem[] =
    [];

  for (const recRow of recommendationsRows) {
    extractedRecommendations.push({
      id: `rec_mtg_${recRow.recommendationId}`,
      statement: recRow.recommendationText,
      source: `توصيات الاجتماع (${recRow.meetingNumber}) — ${recRow.meetingDate}`,
      responsibleOrDecision: `المسؤول: ${recRow.responsibleDisplay}`,
      statusOrDate: `الحالة: ${recRow.followupStatusLabel}${
        recRow.targetDateDisplay !== 'غير متوفر'
          ? ` • الاستحقاق: ${recRow.targetDateDisplay}`
          : ''
      }`,
    });
  }

  for (const imp of community.evaluation.impactMeasurements) {
    const decLabel = getPlcImprovementDecisionDisplayLabel(
      imp.improvementDecision || imp.improvementOpportunities,
      imp.customImprovementDecision
    );
    if (decLabel && decLabel !== 'لم يتم القياس') {
      extractedRecommendations.push({
        id: `rec_imp_${imp.id}`,
        statement: imp.improvementOpportunities.trim()
          ? `${decLabel} — ${imp.improvementOpportunities.trim()}`
          : `قرار التحسين المبني على قياس الأثر للفئة (${imp.beneficiaryCategory}): ${decLabel}`,
        source: 'قرارات التحسين في قياس الأثر (النموذج 7)',
        responsibleOrDecision: `قرار التحسين: ${decLabel}`,
        statusOrDate: imp.measurementDate || undefined,
      });
    }
  }

  for (const act of community.operationalPlan) {
    if (act.status === 'stalled') {
      extractedRecommendations.push({
        id: `rec_stalled_${act.id}`,
        statement: `متابعة معالجة الإجراء المتعثر في الخطة التشغيلية: «${act.title}»${
          act.notes?.trim() ? ` (${act.notes.trim()})` : ''
        }.`,
        source: 'الإجراءات المتعثرة في الخطة التشغيلية (النموذج 4)',
        responsibleOrDecision: act.responsibleName || undefined,
      });
    }
  }

  for (const kpiRow of kpiRows) {
    if (
      kpiRow.achievementPercentage !== null &&
      kpiRow.achievementPercentage < 100
    ) {
      extractedRecommendations.push({
        id: `rec_kpi_${kpiRow.kpiId}`,
        statement: `استكمال تحقيق المستهدف لمؤشر الأداء «${kpiRow.indicatorName}» (المستهدف: ${kpiRow.targetDisplay}، الفعلي: ${kpiRow.actualDisplay}).`,
        source: 'مؤشرات الأداء التي لم تحقق المستهدف (النموذج 7)',
      });
    }
  }

  const customExecutiveNotes =
    community.finalReportCustomization?.customExecutiveNotes?.trim() || '';
  const customClosingNotes =
    community.finalReportCustomization?.customClosingNotes?.trim() || '';

  const section9_12: PlcFinalReportSection9_12 = {
    extractedRecommendations,
    customExecutiveNotes,
    customClosingNotes,
    hasAnyRecommendations:
      extractedRecommendations.length > 0 ||
      Boolean(customExecutiveNotes) ||
      Boolean(customClosingNotes),
  };

  // ==========================================================================
  // القسم 9.13 — الرسوم البيانية والجداول (تُنشأ فقط عند توفر بيانات كافية)
  // ==========================================================================
  const EMPTY_CHART_MSG = 'لا توجد بيانات كافية لإنشاء الرسم البياني.';

  const operationalPlanStatusChart: PlcFinalReportChartModel = {
    id: 'operational_plan_status',
    title: 'توزيع حالات الخطة التشغيلية',
    subtitle:
      'توزيع إجراءات الخطة حسب الحالة (لم يبدأ / قيد التنفيذ / منفذ / متعثر / ملغى)',
    chartKind: 'single_bar',
    hasSufficientData: community.operationalPlan.length > 0,
    emptyMessage: EMPTY_CHART_MSG,
    items:
      community.operationalPlan.length > 0
        ? [
            {
              id: 'not_started',
              label: 'لم يبدأ',
              value: execSummary.notStartedActionsCount,
              colorHex: '#78716C',
            },
            {
              id: 'in_progress',
              label: 'قيد التنفيذ',
              value: execSummary.inProgressActionsCount,
              colorHex: '#D97706',
            },
            {
              id: 'completed',
              label: 'منفذ',
              value: execSummary.executedActionsCount,
              colorHex: '#059669',
            },
            {
              id: 'stalled',
              label: 'متعثر',
              value: execSummary.stalledActionsCount,
              colorHex: '#DC2626',
            },
            {
              id: 'cancelled',
              label: 'ملغى',
              value: execSummary.cancelledActionsCount,
              colorHex: '#57534E',
            },
          ]
        : [],
  };

  const validKpisForChart = community.evaluation.kpiIndicators.filter(
    (k) =>
      k.targetValue !== null &&
      k.targetValue !== undefined &&
      !Number.isNaN(Number(k.targetValue)) &&
      k.achievedValue !== null &&
      k.achievedValue !== undefined &&
      !Number.isNaN(Number(k.achievedValue))
  );

  const kpiTargetVsActualChart: PlcFinalReportChartModel = {
    id: 'kpi_target_vs_actual',
    title: 'مؤشرات الأداء: مقارنة المستهدف مقابل الفعلي',
    subtitle: 'يعرض المؤشرات التي تتوفر لها قيمتا المستهدف والفعلي معاً',
    chartKind: 'paired_bar',
    hasSufficientData: validKpisForChart.length > 0,
    emptyMessage: EMPTY_CHART_MSG,
    items: validKpisForChart.map((k) => ({
      id: k.id,
      label: k.name,
      value: Number(k.targetValue),
      secondaryValue: Number(k.achievedValue),
      secondaryLabel: 'الفعلي',
      unit: k.unit === 'أخرى' && k.customUnit ? k.customUnit : k.unit,
      colorHex: PLC_SECTION_THEME.primaryHex,
      secondaryColorHex: '#059669',
    })),
  };

  const activitiesByStatusChart: PlcFinalReportChartModel = {
    id: 'activities_by_status',
    title: 'البرامج والأنشطة والزيارات والشراكات حسب الحالة',
    subtitle: 'توزيع سجلات التنفيذ (مخطط له / قيد التنفيذ / منفذ / ملغى)',
    chartKind: 'single_bar',
    hasSufficientData: community.activities.length > 0,
    emptyMessage: EMPTY_CHART_MSG,
    items:
      community.activities.length > 0
        ? [
            {
              id: 'planned',
              label: 'مخطط له',
              value: execSummary.plannedExecutionRecordsCount,
              colorHex: '#78716C',
            },
            {
              id: 'in_progress',
              label: 'قيد التنفيذ',
              value: execSummary.inProgressExecutionRecordsCount,
              colorHex: '#D97706',
            },
            {
              id: 'executed',
              label: 'منفذ',
              value: execSummary.executedExecutionRecordsCount,
              colorHex: '#059669',
            },
            {
              id: 'cancelled',
              label: 'ملغى',
              value: execSummary.cancelledExecutionRecordsCount,
              colorHex: '#57534E',
            },
          ]
        : [],
  };

  const needsByPriorityChart: PlcFinalReportChartModel = {
    id: 'needs_by_priority',
    title: 'توزيع الاحتياجات المهنية حسب الأولوية',
    subtitle: 'مرتفع / متوسط / منخفض',
    chartKind: 'single_bar',
    hasSufficientData: community.needs.length > 0,
    emptyMessage: EMPTY_CHART_MSG,
    items:
      community.needs.length > 0
        ? [
            {
              id: 'high',
              label: 'أولوية مرتفعة',
              value: priorityDistribution.high,
              colorHex: '#B91C1C',
            },
            {
              id: 'medium',
              label: 'أولوية متوسطة',
              value: priorityDistribution.medium,
              colorHex: '#D97706',
            },
            {
              id: 'low',
              label: 'أولوية منخفضة',
              value: priorityDistribution.low,
              colorHex: '#0284C7',
            },
          ]
        : [],
  };

  const validImpactsForChart = community.evaluation.impactMeasurements.filter(
    (imp) =>
      imp.actualValue !== null &&
      imp.actualValue !== undefined &&
      !Number.isNaN(Number(imp.actualValue)) &&
      ((imp.baselineValue !== null &&
        imp.baselineValue !== undefined &&
        !Number.isNaN(Number(imp.baselineValue))) ||
        (imp.targetValue !== null &&
          imp.targetValue !== undefined &&
          !Number.isNaN(Number(imp.targetValue))))
  );

  const impactMeasurementChart: PlcFinalReportChartModel = {
    id: 'impact_measurement',
    title: 'قياس الأثر الكمي (قبل / المستهدف مقابل النتيجة الفعلية)',
    subtitle: 'يعرض سجلات قياس الأثر التي تتضمن قراءات كمية قابلة للمقارنة',
    chartKind: 'paired_bar',
    hasSufficientData: validImpactsForChart.length > 0,
    emptyMessage: EMPTY_CHART_MSG,
    items: validImpactsForChart.map((imp) => {
      const refVal =
        imp.baselineValue !== null && imp.baselineValue !== undefined
          ? Number(imp.baselineValue)
          : Number(imp.targetValue);
      return {
        id: imp.id,
        label: imp.beneficiaryCategory || 'قياس أثر',
        value: refVal,
        secondaryValue: Number(imp.actualValue),
        secondaryLabel: 'النتيجة الفعلية',
        unit: imp.unit === 'أخرى' && imp.customUnit ? imp.customUnit : imp.unit,
        colorHex: '#64748B',
        secondaryColorHex: '#0D9488',
      };
    }),
  };

  const section9_13: PlcFinalReportSection9_13 = {
    operationalPlanStatusChart,
    kpiTargetVsActualChart,
    activitiesByStatusChart,
    needsByPriorityChart,
    impactMeasurementChart,
    allCharts: [
      operationalPlanStatusChart,
      kpiTargetVsActualChart,
      activitiesByStatusChart,
      needsByPriorityChart,
      impactMeasurementChart,
    ],
  };

  // ==========================================================================
  // التحليل التلقائي العام للمجتمع (موضوعي ومبني على البيانات الفعلية فقط)
  // ==========================================================================
  const planExecutionLevelText =
    community.operationalPlan.length === 0
      ? 'مستوى تنفيذ الخطة التشغيلية: لم يتم إدراج إجراءات في الخطة التشغيلية حتى الآن.'
      : `مستوى تنفيذ الخطة التشغيلية: إجمالي الإجراءات المخططة (${execSummary.plannedActionsTotalCount})، المنفذ منها (${execSummary.executedActionsCount})، وقيد التنفيذ (${execSummary.inProgressActionsCount})، والمتعثر (${execSummary.stalledActionsCount})، والملغى (${execSummary.cancelledActionsCount})، ونسبة الإنجاز المحسوبة: (${execSummary.actualPlanCompletionDisplay}).`;

  const activitiesExecutionLevelText =
    community.activities.length === 0
      ? 'مستوى تنفيذ البرامج والأنشطة: لم يتم تسجيل برامج أو أنشطة أو زيارات أو شراكات حتى الآن.'
      : `مستوى تنفيذ البرامج والأنشطة: إجمالي السجلات (${execSummary.totalExecutionRecordsCount})، المنفذ منها فعلياً (${execSummary.executedExecutionRecordsCount})، وقيد التنفيذ (${execSummary.inProgressExecutionRecordsCount})، والمخطط له غير المنفذ (${execSummary.plannedExecutionRecordsCount})، والملغى (${execSummary.cancelledExecutionRecordsCount}).`;

  const calculatedKpisCount = kpiRows.filter((k) => k.isCalculated).length;
  const kpisStatusText =
    kpiRows.length === 0
      ? 'حالة مؤشرات الأداء: لم يتم تسجيل مؤشرات أداء في هذا المجتمع.'
      : `حالة مؤشرات الأداء: إجمالي المؤشرات المسجلة (${kpiRows.length})، تم احتساب نسبة الإنجاز آلياً لعدد (${calculatedKpisCount}) مؤشر/مؤشرات لتوفر بياناتها، في حين تعذر الحساب الآلي لعدد (${kpiRows.length - calculatedKpisCount}) مؤشر لنقص القراءات أو لكون اتجاه المؤشر لا ينطبق.`;

  const impactPresenceText =
    impactRows.length === 0
      ? 'قياس الأثر: لا توجد سجلات قياس أثر مدخلة؛ ولا يُعد تنفيذ الأنشطة دليلاً على تحقق الأثر.'
      : `قياس الأثر: يوجد (${impactRows.length}) سجل قياس أثر مسجل، منها (${verifiedImpactsCount}) أثر مثبت ببيانات قياس كمية، و(${describedOutcomesCount}) نتيجة موصوفة نوعياً.`;

  const keyAchievementsSummaryText =
    achievements.length === 0
      ? 'أهم الإنجازات: لا توجد إنجازات موثقة بعد في البيانات الحالية.'
      : `أهم الإنجازات: تم رصد (${achievements.length}) بنداً من الإنجازات المدعومة بالسجلات الفعلية في الخطة والاجتماعات والأنشطة والمؤشرات والشواهد.`;

  const keyChallengesSummaryText =
    challenges.length === 0
      ? 'أهم التحديات: لم تُرصد حالات تعثر أو انخفاض عن المستهدفات في البيانات المسجلة.'
      : `أهم التحديات: تم رصد (${challenges.length}) تحدياً/ملاحظة مستخلصة من الإجراءات المتعثرة أو المؤشرات دون المستهدف أو نقص القياس.`;

  const decisionsList = impactRows
    .map((r) => r.improvementDecisionDisplay)
    .filter((d) => d && d !== 'لم يتم القياس');
  const improvementDecisionsSummaryText =
    decisionsList.length === 0
      ? 'قرارات التحسين: لم تُسجل قرارات تحسين مبنية على قياس الأثر حتى الآن.'
      : `قرارات التحسين المسجلة: (${Array.from(new Set(decisionsList)).join(' ، ')}).`;

  const generalAnalysis: PlcFinalReportGeneralAnalysis = {
    planExecutionLevelText,
    activitiesExecutionLevelText,
    kpisStatusText,
    impactPresenceText,
    keyAchievementsSummaryText,
    keyChallengesSummaryText,
    improvementDecisionsSummaryText,
    paragraphs: [
      planExecutionLevelText,
      activitiesExecutionLevelText,
      kpisStatusText,
      impactPresenceText,
      keyAchievementsSummaryText,
      keyChallengesSummaryText,
      improvementDecisionsSummaryText,
    ],
  };

  return {
    communityId: community.id,
    communityName: community.name,
    generatedAtIso,
    generatedDateDisplay,
    completeness,
    section9_1,
    section9_2,
    section9_3,
    section9_4,
    section9_5,
    section9_6,
    section9_7,
    section9_8,
    section9_9,
    section9_10,
    section9_11,
    section9_12,
    section9_13,
    generalAnalysis,
  };
}

/**
 * يحدث الملاحظات والتوصيات الختامية فقط في النموذج التاسع دون المساس بأي بيانات أصلية في النماذج (1-8).
 */
export function updatePlcFinalReportNotes(
  community: PlcCommunityRecord,
  notes: {
    customExecutiveNotes?: string;
    customClosingNotes?: string;
  }
): PlcCommunityRecord {
  const cloned = deepCloneCommunity(community);
  const currentCustom = cloned.finalReportCustomization ?? {
    customExecutiveNotes: '',
    customClosingNotes: '',
  };

  cloned.finalReportCustomization = {
    ...currentCustom,
    customExecutiveNotes:
      notes.customExecutiveNotes !== undefined
        ? notes.customExecutiveNotes
        : currentCustom.customExecutiveNotes,
    customClosingNotes:
      notes.customClosingNotes !== undefined
        ? notes.customClosingNotes
        : currentCustom.customClosingNotes,
  };
  cloned.updatedAt = new Date().toISOString();
  return cloned;
}

/**
 * يعيد توليد التقرير الختامي من البيانات الحالية للمجتمع مع الحفاظ التام على الملاحظات الختامية
 * التي أدخلها المستخدم لنفس المجتمع.
 */
export function regeneratePlcFinalReport(
  community: PlcCommunityRecord,
  timestampIso = new Date().toISOString()
): {
  community: PlcCommunityRecord;
  report: PlcGeneratedFinalReport;
} {
  const cloned = deepCloneCommunity(community);
  cloned.finalReportCustomization = {
    customExecutiveNotes:
      cloned.finalReportCustomization?.customExecutiveNotes ?? '',
    customClosingNotes:
      cloned.finalReportCustomization?.customClosingNotes ?? '',
    lastGeneratedAt: timestampIso,
  };
  cloned.updatedAt = timestampIso;

  const report = buildPlcFinalReport(cloned, timestampIso);
  return {
    community: cloned,
    report,
  };
}

// ============================================================================
// ١٣. تهيئة البنية البرمجية للتقرير المدرسي الشامل مستقبلاً (دون تنفيذ واجهة Batch 6)
// يدعم اختيار: مجتمع واحد (single) | عدة مجتمعات (multiple) | جميع المجتمعات (all)
// ============================================================================

export type PlcSchoolWideSelectionMode = 'single' | 'multiple' | 'all';

export interface PlcSchoolWideReportDataPayload {
  selectionMode: PlcSchoolWideSelectionMode;
  selectedCommunityIds: string[];
  generatedAtIso: string;
  aggregateSummary: PlcSchoolAggregateSummary;
  individualCommunityReports: PlcGeneratedFinalReport[];
}

/**
 * يجهز البنية البرمجية لتجميع تقارير مجتمع واحد أو عدة مجتمعات أو جميع المجتمعات على مستوى المدرسة
 * مع ضمان عزل كل مجتمع في تقريره الفردي، وذلك استعداداً لأي توسع مستقبلي دون إعادة بناء النظام.
 */
export function buildPlcSchoolWideReportDataPayload(
  allCommunities: PlcCommunityRecord[],
  options: {
    selectionMode: PlcSchoolWideSelectionMode;
    selectedCommunityIds?: string[];
    generatedAtIso?: string;
  }
): PlcSchoolWideReportDataPayload {
  const generatedAtIso = options.generatedAtIso || new Date().toISOString();
  let targetCommunities: PlcCommunityRecord[] = [];

  if (options.selectionMode === 'all') {
    targetCommunities = allCommunities;
  } else if (options.selectionMode === 'single') {
    const firstId = options.selectedCommunityIds?.[0] ?? '';
    targetCommunities = allCommunities.filter((c) => c.id === firstId);
  } else {
    const idsSet = new Set(options.selectedCommunityIds ?? []);
    targetCommunities = allCommunities.filter((c) => idsSet.has(c.id));
  }

  const aggregateSummary = computePlcSchoolAggregateSummary(
    allCommunities,
    targetCommunities.map((c) => c.id)
  );

  const individualCommunityReports = targetCommunities.map((c) =>
    buildPlcFinalReport(c, generatedAtIso)
  );

  return {
    selectionMode: options.selectionMode,
    selectedCommunityIds: targetCommunities.map((c) => c.id),
    generatedAtIso,
    aggregateSummary,
    individualCommunityReports,
  };
}




