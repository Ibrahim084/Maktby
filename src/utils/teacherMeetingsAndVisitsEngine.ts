import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import {
  TeacherReportAttendanceRow,
  TeacherReportBasicField,
  TeacherReportContentSection,
  TeacherReportDocument,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from './teacherPdfEngine';

export type TeacherMeetingAndVisitGroupId =
  | 'meetings-and-committees'
  | 'peer-visits-and-exchange';

export type TeacherMeetingAndVisitFormId =
  | 'meeting-minutes'
  | 'peer-visit-report';

export interface TeacherMeetingAndVisitGroupMeta {
  id: TeacherMeetingAndVisitGroupId;
  title: string;
  badge: string;
  description: string;
  summaryHighlight: string;
  formId: TeacherMeetingAndVisitFormId;
}

export interface TeacherMeetingAndVisitCatalogItem {
  id: TeacherMeetingAndVisitFormId;
  groupId: TeacherMeetingAndVisitGroupId;
  title: string;
  shortTitle: string;
  reportTypeLabel: string;
  badge: string;
  description: string;
  highlights: string[];
}

export const TEACHER_MEETINGS_GROUP: TeacherMeetingAndVisitGroupMeta = {
  id: 'meetings-and-committees',
  title: 'الاجتماعات واللجان',
  badge: 'نموذج معتمد',
  description:
    'توثيق محاضر الاجتماعات المدرسية واللجان وفرق العمل التربوية، مع تنظيم المحاور والقرارات والتوصيات وجدول الحضور والتوقيعات الاختياري المستقل.',
  summaryHighlight:
    'تشتمل على نموذج «محضر اجتماع» لتوثيق محاور النقاش والقرارات والتوصيات وجدول الحضور والتوقيعات المستقل عند الحاجة',
  formId: 'meeting-minutes',
};

export const TEACHER_PEER_VISITS_GROUP: TeacherMeetingAndVisitGroupMeta = {
  id: 'peer-visits-and-exchange',
  title: 'الزيارات والتبادل المهني',
  badge: 'نموذج معتمد',
  description:
    'توثيق الزيارات التبادلية بين المعلمين لتبادل الخبرات والممارسات التدريسية المتميزة داخل التخصص أو بين التخصصات المختلفة.',
  summaryHighlight:
    'تشتمل على نموذج «تقرير زيارة تبادلية بين المعلمين» لتوثيق الممارسات المشاهَدة وخلاصة الاستفادة والشواهد',
  formId: 'peer-visit-report',
};

export const TEACHER_MEETINGS_AND_VISITS_CATALOG: TeacherMeetingAndVisitCatalogItem[] =
  [
    {
      id: 'meeting-minutes',
      groupId: 'meetings-and-committees',
      title: 'محضر اجتماع',
      shortTitle: 'محضر اجتماع',
      reportTypeLabel: 'محضر اجتماع',
      badge: 'الاجتماعات واللجان',
      description:
        'نموذج متكامل لتوثيق بيانات الاجتماع وصفة المنفذ أو المنظم ومحاور النقاش والقرارات والتوصيات الختامية، مع إمكانية إرفاق جدول حضور وتوقيعات منظم في صفحة مستقلة.',
      highlights: [
        'تحديد نوع الاجتماع وصفة المنفذ (منفّذ / منظّم / صفة أخرى) بصيغة تلقائية معتمدة',
        'إضافة محاور متعددة مع مساحة مناقشة مستقلة لكل محور وقسم ختامي موحد للقرارات والتوصيات',
        'جدول حضور وتوقيعات اختياري في صفحة مستقلة (م. | الاسم | التوقيع) يدعم الإدخال اليدوي أو لصق الأسماء دفعة واحدة حتى ٣٠ اسماً',
      ],
    },
    {
      id: 'peer-visit-report',
      groupId: 'peer-visits-and-exchange',
      title: 'تقرير زيارة تبادلية بين المعلمين',
      shortTitle: 'تقرير زيارة تبادلية',
      reportTypeLabel: 'تقرير زيارة تبادلية بين المعلمين',
      badge: 'الزيارات والتبادل المهني',
      description:
        'نموذج لتوثيق التعلّم وتبادل الخبرات المهنية بين الزملاء (داخل التخصص أو بين تخصصات مختلفة)، وتدوين الممارسة المشاهَدة وأبرز الفوائد المكتسبة.',
      highlights: [
        'تحديد نطاق الزيارة وموضوعها وبيانات المعلم الزائر والمعلم المستضيف',
        'توثيق الممارسة التعليمية المشاهَدة وأبرز ما استفاد منه المعلم الزائر والممارسة التي يرغب في تطبيقها',
        'دعم الشواهد المصورة الاختيارية (شاهد واحد أو شاهدان) مع اعتماد مدير المدرسة في التذييل',
      ],
    },
  ];

// ============================================================================
// النموذج الأول: محضر اجتماع (Meeting Minutes)
// ============================================================================

export const MAX_MEETING_ATTENDEES = 30;

export type MeetingTypeOption =
  | 'اجتماع معلمي المدرسة'
  | 'اجتماع تخصص أو قسم'
  | 'اجتماع لجنة'
  | 'اجتماع فريق عمل'
  | 'اجتماع تربوي مع أولياء الأمور'
  | 'نوع آخر';

export const MEETING_TYPE_OPTIONS: MeetingTypeOption[] = [
  'اجتماع معلمي المدرسة',
  'اجتماع تخصص أو قسم',
  'اجتماع لجنة',
  'اجتماع فريق عمل',
  'اجتماع تربوي مع أولياء الأمور',
  'نوع آخر',
];

export type MeetingExecutorRoleType = 'منفّذ' | 'منظّم' | 'صفة أخرى';

export const MEETING_EXECUTOR_ROLE_OPTIONS: MeetingExecutorRoleType[] = [
  'منفّذ',
  'منظّم',
  'صفة أخرى',
];

export const MEETING_AGENDA_PRESETS: string[] = [
  'مناقشة خطة العمل وتوزيع المهام خلال الفترة القادمة',
  'مراجعة مستوى التحصيل الدراسي للطلاب وسبل التحسين',
  'متابعة تنفيذ البرامج والمبادرات التعليمية المعتمدة',
  'مناقشة آليات التقويم المستمر وتحليل نتائج الاختبارات',
  'تبادل الخبرات حول استراتيجيات التدريس الفعالة وإدارة الصف',
  'مناقشة سبل تعزيز الانضباط المدرسي والتواصل مع أولياء الأمور',
  'تحديد الاحتياجات التدريبية والمهنية لأعضاء الفريق أو القسم',
  '+ إضافة بند',
];

export const MEETING_DECISION_PRESETS: string[] = [
  'اعتماد خطة العمل الزمنية وتوزيع الأدوار وفق المهام المحددة',
  'تنفيذ خطط دعم وعلاج مركزة للطلاب المتعثرين ومتابعة تقدمهم',
  'تفعيل تبادل الزيارات الصفية والخبرات المهنية بين المعلمين',
  'توثيق الشواهد والتقارير الدورية ورفعها في الموعد المحدد',
  'التواصل الدوري مع أولياء الأمور لمتابعة التحصيل والانضباط',
  'عقد اجتماع متابعة دوري لقياس مدى تحقق التوصيات المعتمدة',
  '+ إضافة بند',
];

export interface MeetingAgendaItem {
  id: string;
  selectedPreset: string;
  customTitle: string;
  discussion: string;
}

export interface MeetingDecisionItem {
  id: string;
  selectedPreset: string;
  customDecisionText: string;
  responsiblePerson: string;
  executionDeadline: string;
}

export interface MeetingAttendeeItem {
  id: string;
  attendeeName: string;
}

export interface MeetingMinutesFormState {
  formId: 'meeting-minutes';
  // 1. بيانات الاجتماع
  meetingTitle: string;
  meetingType: MeetingTypeOption;
  customMeetingType: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  // 2. صفة المنفذ
  executorRoleType: MeetingExecutorRoleType;
  customExecutorRole: string;
  executorName: string;
  // 3. محاور الاجتماع
  agendaItems: MeetingAgendaItem[];
  // 4. القرارات والتوصيات
  decisions: MeetingDecisionItem[];
  // 5. بيانات ختامية
  closingNote: string;
  recorderName: string;
  // 6. الشواهد والروابط (اختيارية بالكامل ومستقلة)
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
  // 7. كشف الحضور والتوقيعات (اختياري بالكامل — جدول من 3 أعمدة: م. | الاسم | التوقيع)
  enableAttendanceSheet: boolean;
  attendees: MeetingAttendeeItem[];
}

// ============================================================================
// النموذج الثاني: تقرير زيارة تبادلية بين المعلمين (Peer Visit Report)
// ============================================================================

export type PeerVisitScopeOption =
  | 'بين معلمي التخصص نفسه'
  | 'بين معلمي المدرسة من تخصصات مختلفة';

export const PEER_VISIT_SCOPE_OPTIONS: PeerVisitScopeOption[] = [
  'بين معلمي التخصص نفسه',
  'بين معلمي المدرسة من تخصصات مختلفة',
];

export type PeerVisitTopicOption =
  | 'استراتيجيات التدريس'
  | 'إدارة الصف'
  | 'توظيف التقنية والأدوات الرقمية'
  | 'التقويم وأساليب قياس التعلم'
  | 'تنويع الأنشطة التعليمية'
  | 'تحفيز الطلاب ومشاركتهم'
  | 'موضوع آخر';

export const PEER_VISIT_TOPIC_OPTIONS: PeerVisitTopicOption[] = [
  'استراتيجيات التدريس',
  'إدارة الصف',
  'توظيف التقنية والأدوات الرقمية',
  'التقويم وأساليب قياس التعلم',
  'تنويع الأنشطة التعليمية',
  'تحفيز الطلاب ومشاركتهم',
  'موضوع آخر',
];

export const PEER_VISIT_TAKEAWAY_PRESETS: string[] = [
  'آلية تنظيم المجموعات التعاونية وتوزيع الأدوار بفاعلية عالية بين الطلاب',
  'توظيف الأسئلة السابرة والتقويم التكويني اللحظي للتأكد من استيعاب المفاهيم',
  'استخدام الأدوات الرقمية التفاعلية لجذب انتباه الطلاب وتبسيط المحتوى',
  'الإدارة الفاعلة لوقت الحصة والتدرج السلس بين أنشطة التمهيد والتطبيق والغلق',
  'أساليب التعزيز الإيجابي وتحفيز الطلاب على المشاركة الفاعلة',
  '+ إضافة بند',
];

export const PEER_VISIT_PRACTICE_TO_APPLY_PRESETS: string[] = [
  'تطبيق استراتيجية التعلم التعاوني المنظم ببطاقات الأدوار في الحصص القادمة',
  'تفعيل أدوات التقويم التكويني السريع (بطاقات الخروج) في نهاية كل درس',
  'دمج الأنشطة التفاعلية الرقمية في شرح المفاهيم الأساسية للوحدة القادمة',
  'تنويع مستويات الأنشطة الصفية لمراعاة الفروق الفردية بين الطلاب',
  'تطبيق أسلوب التغذية الراجعة الفورية الداعمة لتقدم الطلاب',
  '+ إضافة بند',
];

export interface PeerVisitReportFormState {
  formId: 'peer-visit-report';
  // 1. نطاق الزيارة
  visitScope: PeerVisitScopeOption;
  // 2. بيانات المعلمين
  visitingTeacherName: string;
  hostTeacherName: string;
  specialization: string; // اختياري
  gradeOrStage: string; // اختياري
  // 3. موضوع الزيارة
  visitTopic: PeerVisitTopicOption;
  customVisitTopic: string;
  // 4. بيانات الزيارة
  visitDate: string;
  observedPracticeTitle: string;
  observedPracticeDescription: string;
  additionalVisitDetails: string; // اختياري
  // 5. خلاصة الاستفادة
  selectedTakeawayPreset: string;
  keyTakeaways: string;
  selectedPracticeToApplyPreset: string;
  practiceToApply: string;
  // 6. أسماء المعلمين والتوقيعات (قسم اختياري مستقل في نهاية التقرير)
  enableTeacherSignatures: boolean;
  // 7. الشواهد والروابط (اختيارية بالكامل ومستقلة)
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
}

export type AnyTeacherMeetingOrVisitFormState =
  | MeetingMinutesFormState
  | PeerVisitReportFormState;

// ============================================================================
// Helpers for Executor Label, Bulk Paste & Resolved Values
// ============================================================================

export function resolveMeetingExecutorLabel(
  roleType: MeetingExecutorRoleType,
  customRole: string
): string {
  if (roleType === 'منفّذ') {
    return 'منفّذ الاجتماع';
  }
  if (roleType === 'منظّم') {
    return 'منظّم الاجتماع';
  }
  const trimmedCustom = customRole.trim();
  return trimmedCustom || 'صفة المنفذ';
}

export function resolveMeetingTypeText(
  meetingType: MeetingTypeOption,
  customMeetingType: string
): string {
  if (meetingType === 'نوع آخر') {
    return customMeetingType.trim() || 'نوع آخر';
  }
  return meetingType;
}

export function resolveAgendaItemTitle(item: MeetingAgendaItem): string {
  if (item.selectedPreset === '+ إضافة بند') {
    return item.customTitle.trim();
  }
  return item.selectedPreset.trim();
}

export function resolveDecisionItemText(item: MeetingDecisionItem): string {
  if (item.selectedPreset === '+ إضافة بند') {
    return item.customDecisionText.trim();
  }
  return item.selectedPreset.trim();
}

export function resolvePeerVisitTopicText(
  topic: PeerVisitTopicOption,
  customTopic: string
): string {
  if (topic === 'موضوع آخر') {
    return customTopic.trim() || 'موضوع آخر';
  }
  return topic;
}

/**
 * Parses a multi-line pasted list of names into clean individual attendee names (up to 30).
 * Automatically strips optional leading numbering/bullets (e.g. "1-", "1.", "1|", "١-", "•").
 */
export function parseBulkAttendeeNames(
  rawText: string,
  maxCount = MAX_MEETING_ATTENDEES
): string[] {
  if (!rawText || !rawText.trim()) return [];
  return rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[\d٠-٩]+\s*[-.|)|:]|[•*-])\s*/, '')
        .replace(/\|.*$/, '')
        .trim()
    )
    .filter((name) => name.length > 0 && name !== 'الاسم' && name !== 'م.')
    .slice(0, maxCount);
}

// ============================================================================
// Initial & Sample States
// ============================================================================

export function createInitialAgendaItem(index = 1): MeetingAgendaItem {
  return {
    id: `agenda-${Date.now()}-${index}`,
    selectedPreset:
      MEETING_AGENDA_PRESETS[
        (index - 1) % (MEETING_AGENDA_PRESETS.length - 1)
      ] || MEETING_AGENDA_PRESETS[0],
    customTitle: '',
    discussion: '',
  };
}

export function createInitialDecisionItem(index = 1): MeetingDecisionItem {
  return {
    id: `decision-${Date.now()}-${index}`,
    selectedPreset:
      MEETING_DECISION_PRESETS[
        (index - 1) % (MEETING_DECISION_PRESETS.length - 1)
      ] || MEETING_DECISION_PRESETS[0],
    customDecisionText: '',
    responsiblePerson: '',
    executionDeadline: '',
  };
}

export function createInitialAttendeeItem(
  index = 1,
  attendeeName = ''
): MeetingAttendeeItem {
  return {
    id: `attendee-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    attendeeName,
  };
}

export function createInitialMeetingOrVisitState(
  formId: TeacherMeetingAndVisitFormId,
  settings: SchoolSettings
): AnyTeacherMeetingOrVisitFormState {
  const defaultTeacherName = settings.userName?.trim() || '';
  const defaultSubject =
    settings.roles?.teacher?.replace(/^معلم(?:ة)?\s+/, '').trim() || '';

  if (formId === 'meeting-minutes') {
    return {
      formId: 'meeting-minutes',
      meetingTitle: '',
      meetingType: 'اجتماع تخصص أو قسم',
      customMeetingType: '',
      meetingDate: '',
      meetingTime: '',
      meetingLocation: '',
      executorRoleType: 'منظّم',
      customExecutorRole: '',
      executorName: defaultTeacherName,
      agendaItems: [createInitialAgendaItem(1)],
      decisions: [createInitialDecisionItem(1)],
      closingNote: '',
      recorderName: '',
      evidencePhotos: [],
      evidenceLinks: [],
      enableAttendanceSheet: false,
      attendees: [
        createInitialAttendeeItem(1),
        createInitialAttendeeItem(2),
        createInitialAttendeeItem(3),
      ],
    };
  }

  return {
    formId: 'peer-visit-report',
    visitScope: 'بين معلمي التخصص نفسه',
    visitingTeacherName: defaultTeacherName,
    hostTeacherName: '',
    specialization: defaultSubject,
    gradeOrStage: '',
    visitTopic: 'استراتيجيات التدريس',
    customVisitTopic: '',
    visitDate: '',
    observedPracticeTitle: '',
    observedPracticeDescription: '',
    additionalVisitDetails: '',
    selectedTakeawayPreset: PEER_VISIT_TAKEAWAY_PRESETS[0],
    keyTakeaways: '',
    selectedPracticeToApplyPreset: PEER_VISIT_PRACTICE_TO_APPLY_PRESETS[0],
    practiceToApply: '',
    enableTeacherSignatures: false,
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

export function createSampleMeetingOrVisitState(
  formId: TeacherMeetingAndVisitFormId,
  settings: SchoolSettings
): AnyTeacherMeetingOrVisitFormState {
  const defaultTeacherName =
    settings.userName?.trim() || 'أحمد بن محمد العتيبي';
  const defaultSubject =
    settings.roles?.teacher?.replace(/^معلم(?:ة)?\s+/, '').trim() || 'الرياضيات';

  if (formId === 'meeting-minutes') {
    return {
      formId: 'meeting-minutes',
      meetingTitle: `الاجتماع التنسيقي لمعلمي تخصص ${defaultSubject} للفصل الدراسي الثاني`,
      meetingType: 'اجتماع تخصص أو قسم',
      customMeetingType: '',
      meetingDate: '١٤٤٧/٠٨/٢٤هـ',
      meetingTime: '١٠:٠٠ صباحاً',
      meetingLocation: 'قاعة مصادر التعلم',
      executorRoleType: 'منظّم',
      customExecutorRole: '',
      executorName: defaultTeacherName,
      agendaItems: [
        {
          id: 'sample-agenda-1',
          selectedPreset:
            'مراجعة مستوى التحصيل الدراسي للطلاب وسبل التحسين',
          customTitle: '',
          discussion:
            'تم استعراض نتائج التقويمات القصيرة للفترة الأولى وتحديد المهارات الأساسية التي تحتاج إلى تعزيز جماعي وفردي خلال الأسبوعين القادمين.',
        },
        {
          id: 'sample-agenda-2',
          selectedPreset:
            'تبادل الخبرات حول استراتيجيات التدريس الفعالة وإدارة الصف',
          customTitle: '',
          discussion:
            'طرح المعلمون تجاربهم في توظيف الأنشطة التعاونية القصيرة وأوراق العمل التفاعلية لرفع دافعية الطلاب ومشاركتهم الصفية.',
        },
      ],
      decisions: [
        {
          id: 'sample-decision-1',
          selectedPreset:
            'تنفيذ خطط دعم وعلاج مركزة للطلاب المتعثرين ومتابعة تقدمهم',
          customDecisionText: '',
          responsiblePerson: 'جميع معلمي القسم',
          executionDeadline: 'نهاية الأسبوع الرابع',
        },
        {
          id: 'sample-decision-2',
          selectedPreset:
            'تفعيل تبادل الزيارات الصفية والخبرات المهنية بين المعلمين',
          customDecisionText: '',
          responsiblePerson: 'منسق التخصص',
          executionDeadline: 'خلال شهر شعبان',
        },
      ],
      closingNote:
        'اختُتم الاجتماع بشكر جميع الزملاء على تفاعلهم المثمر وحرصهم على الارتقاء بمستوى نواتج التعلم.',
      recorderName: defaultTeacherName,
      evidencePhotos: [],
      evidenceLinks: [],
      enableAttendanceSheet: true,
      attendees: [
        {
          id: 'sample-att-1',
          attendeeName: 'إبراهيم غرم الله الغامدي',
        },
        {
          id: 'sample-att-2',
          attendeeName: 'خالد بن سعد الدوسري',
        },
        {
          id: 'sample-att-3',
          attendeeName: 'فهد بن عبدالله الحربي',
        },
      ],
    };
  }

  return {
    formId: 'peer-visit-report',
    visitScope: 'بين معلمي التخصص نفسه',
    visitingTeacherName: defaultTeacherName,
    hostTeacherName: 'خالد بن سعد الدوسري',
    specialization: defaultSubject,
    gradeOrStage: 'الصف الثاني المتوسط',
    visitTopic: 'استراتيجيات التدريس',
    customVisitTopic: '',
    visitDate: '١٤٤٧/٠٨/٢٤هـ',
    observedPracticeTitle:
      'توظيف استراتيجية المحطات التعليمية التفاعلية في تبسيط المفاهيم الرياضية',
    observedPracticeDescription:
      'قسّم المعلم المستضيف الطلاب إلى أربع محطات تعليمية متدرجة المستوى، بحيث تنتقل كل مجموعة بين المحطات وفق توقيت منضبط مع بطاقات مهام واضحة وتغذية راجعة فورية.',
    additionalVisitDetails:
      'أظهر الطلاب تفاعلاً عالياً وانضباطاً ذاتياً أثناء الانتقال بين المحطات مع تحسن ملحوظ في سرعة إنجاز التدريبات التطبيقية.',
    selectedTakeawayPreset: PEER_VISIT_TAKEAWAY_PRESETS[0],
    keyTakeaways:
      'آلية تنظيم المجموعات التعاونية وتوزيع الأدوار بفاعلية عالية بين الطلاب، وربط كل محطة بهدف مهاري محدد قابل للقياس السريع.',
    selectedPracticeToApplyPreset: PEER_VISIT_PRACTICE_TO_APPLY_PRESETS[0],
    practiceToApply:
      'تطبيق استراتيجية المحطات التعليمية المنظمة ببطاقات الأدوار في دروس الوحدة القادمة مع تفعيل بطاقات الخروج السريعة.',
    enableTeacherSignatures: false,
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

// ============================================================================
// Validation
// ============================================================================

export function validateMeetingOrVisitState(
  state: AnyTeacherMeetingOrVisitFormState
): string[] {
  const errors: string[] = [];

  if (state.formId === 'meeting-minutes') {
    if (!state.meetingTitle.trim()) {
      errors.push('يرجى إدخال عنوان الاجتماع.');
    }
    if (
      state.meetingType === 'نوع آخر' &&
      !state.customMeetingType.trim()
    ) {
      errors.push('يرجى تحديد نوع الاجتماع المخصص.');
    }
    if (!state.meetingDate.trim()) {
      errors.push('يرجى إدخال تاريخ الاجتماع.');
    }
    if (!state.meetingTime.trim()) {
      errors.push('يرجى إدخال وقت الاجتماع.');
    }
    if (!state.meetingLocation.trim()) {
      errors.push('يرجى إدخال مكان الاجتماع.');
    }
    if (
      state.executorRoleType === 'صفة أخرى' &&
      !state.customExecutorRole.trim()
    ) {
      errors.push('يرجى كتابة المسمى المخصص لصفة المنفذ.');
    }
    if (!state.executorName.trim()) {
      errors.push('يرجى إدخال اسم منفذ أو منظم الاجتماع.');
    }

    const validAgendas = state.agendaItems.filter((item) => {
      const title = resolveAgendaItemTitle(item);
      return Boolean(title && item.discussion.trim());
    });
    if (validAgendas.length === 0) {
      errors.push(
        'يرجى إضافة محور واحد على الأقل مع كتابة ملخص مناقشته.'
      );
    }

    const validDecisions = state.decisions.filter((item) =>
      Boolean(resolveDecisionItemText(item))
    );
    if (validDecisions.length === 0) {
      errors.push('يرجى إضافة قرار أو توصية واحدة على الأقل.');
    }

    if (state.enableAttendanceSheet) {
      const validAttendees = state.attendees.filter((a) =>
        Boolean(a.attendeeName.trim())
      );
      if (validAttendees.length === 0) {
        errors.push(
          'عند تفعيل كشف الحضور والتوقيعات، يرجى إدخال اسم واحد على الأقل.'
        );
      }
      if (validAttendees.length > MAX_MEETING_ATTENDEES) {
        errors.push(
          `الحد الأقصى لعدد الأسماء في كشف الحضور هو ${MAX_MEETING_ATTENDEES} اسماً.`
        );
      }
    }

    return errors;
  }

  // peer-visit-report validation
  if (!state.visitingTeacherName.trim()) {
    errors.push('يرجى إدخال اسم المعلم الزائر.');
  }
  if (!state.hostTeacherName.trim()) {
    errors.push('يرجى إدخال اسم المعلم المستضيف.');
  }
  if (
    state.visitTopic === 'موضوع آخر' &&
    !state.customVisitTopic.trim()
  ) {
    errors.push('يرجى كتابة موضوع الزيارة المخصص.');
  }
  if (!state.visitDate.trim()) {
    errors.push('يرجى إدخال تاريخ الزيارة.');
  }
  if (!state.observedPracticeTitle.trim()) {
    errors.push('يرجى إدخال موضوع الممارسة التعليمية التي تمت مشاهدتها.');
  }
  if (!state.observedPracticeDescription.trim()) {
    errors.push('يرجى إدخال وصف مختصر للممارسة أو الإجراء الذي تمت ملاحظته.');
  }
  if (!state.keyTakeaways.trim()) {
    errors.push('يرجى تدوين أبرز ما استفاد منه المعلم الزائر.');
  }
  if (!state.practiceToApply.trim()) {
    errors.push('يرجى تدوين الممارسة التي يرغب المعلم الزائر في تطبيقها.');
  }

  return errors;
}

// ============================================================================
// Draft Persistence (localStorage)
// ============================================================================

const DRAFT_STORAGE_PREFIX = 'maktabi_teacher_meeting_visit_draft_v2_';

export function loadMeetingOrVisitDraft(
  formId: TeacherMeetingAndVisitFormId,
  settings: SchoolSettings
): AnyTeacherMeetingOrVisitFormState {
  const fallback = createInitialMeetingOrVisitState(formId, settings);
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

export function saveMeetingOrVisitDraft(
  state: AnyTeacherMeetingOrVisitFormState
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

export function clearMeetingOrVisitDraft(
  formId: TeacherMeetingAndVisitFormId
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

export function buildTeacherMeetingOrVisitDocument(
  state: AnyTeacherMeetingOrVisitFormState,
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

  if (state.formId === 'meeting-minutes') {
    const resolvedType = resolveMeetingTypeText(
      state.meetingType,
      state.customMeetingType
    );
    const executorLabel = resolveMeetingExecutorLabel(
      state.executorRoleType,
      state.customExecutorRole
    );
    const executorVal = state.executorName.trim() || 'غير محدد';

    const basicFields: TeacherReportBasicField[] = [
      {
        id: 'mm-type',
        label: 'نوع الاجتماع',
        value: resolvedType,
        width: 'half',
      },
      {
        id: 'mm-executor',
        label: executorLabel,
        value: executorVal,
        width: 'half',
      },
      {
        id: 'mm-date',
        label: 'تاريخ الاجتماع',
        value: state.meetingDate.trim() || 'غير محدد',
        width: 'third',
      },
      {
        id: 'mm-time',
        label: 'وقت الاجتماع',
        value: state.meetingTime.trim() || 'غير محدد',
        width: 'third',
      },
      {
        id: 'mm-location',
        label: 'مكان الاجتماع',
        value: state.meetingLocation.trim() || 'غير محدد',
        width: 'third',
      },
    ];

    const sections: TeacherReportContentSection[] = [];

    // 3. محاور الاجتماع (كل محور بمساحة مناقشة مستقلة دون تكرار القرارات والتوصيات تحت كل محور)
    const validAgendas = state.agendaItems.filter((item) => {
      const title = resolveAgendaItemTitle(item);
      return Boolean(title || item.discussion.trim());
    });

    if (validAgendas.length > 0) {
      const agendaFields: TeacherReportBasicField[] = validAgendas.map(
        (item, index) => {
          const title = resolveAgendaItemTitle(item) || `المحور ${index + 1}`;
          const discussion =
            item.discussion.trim() ||
            'تمت مناقشة المحور والاتفاق على ما ورد فيه.';
          return {
            id: `agenda-field-${index + 1}`,
            label: `المحور (${index + 1}): ${title}`,
            value: discussion,
            width: 'full',
            isLongText: true,
          };
        }
      );

      sections.push({
        id: 'mm-agenda-section',
        title: 'محاور الاجتماع وموجز المناقشات',
        type: 'fields',
        fields: agendaFields,
      });
    }

    // 4. القرارات والتوصيات (قسم ختامي واحد مختصر يجمع القرارات والتوصيات)
    const validDecisions = state.decisions.filter((item) =>
      Boolean(resolveDecisionItemText(item))
    );

    if (validDecisions.length > 0) {
      const decisionItems = validDecisions.map((item) => {
        const mainText = resolveDecisionItemText(item);
        const metaParts: string[] = [];
        if (item.responsiblePerson.trim()) {
          metaParts.push(
            `المسؤول عن المتابعة/التنفيذ: ${item.responsiblePerson.trim()}`
          );
        }
        if (item.executionDeadline.trim()) {
          metaParts.push(`موعد التنفيذ: ${item.executionDeadline.trim()}`);
        }
        if (metaParts.length > 0) {
          return `${mainText} (${metaParts.join(' — ')})`;
        }
        return mainText;
      });

      sections.push({
        id: 'mm-decisions-section',
        title: 'القرارات والتوصيات',
        type: 'list',
        items: decisionItems,
      });
    }

    // 5. بيانات ختامية:
    // - ملاحظة ختامية اختيارية: إذا تُركت فارغة لا يظهر عنوانها ولا مساحتها في PDF
    // - اسم مُعدّ المحضر: حقل مستقل اختياري، لا يُفترض أنه مدير المدرسة، وإذا تُرك فارغًا لا يظهر في PDF
    const trimmedClosingNote = state.closingNote.trim();
    const trimmedRecorderName = state.recorderName.trim();

    if (trimmedClosingNote && trimmedRecorderName) {
      sections.push({
        id: 'mm-closing-section',
        title: 'بيانات ختامية',
        type: 'fields',
        fields: [
          {
            id: 'mm-closing-note',
            label: 'ملاحظة ختامية',
            value: trimmedClosingNote,
            width: 'full',
            isLongText: true,
          },
          {
            id: 'mm-recorder-name',
            label: 'مُعدّ المحضر',
            value: trimmedRecorderName,
            width: 'full',
          },
        ],
      });
    } else if (trimmedClosingNote) {
      sections.push({
        id: 'mm-closing-note-only',
        title: 'ملاحظة ختامية',
        type: 'text',
        content: trimmedClosingNote,
      });
    } else if (trimmedRecorderName) {
      sections.push({
        id: 'mm-recorder-only',
        title: 'إعداد المحضر',
        type: 'fields',
        fields: [
          {
            id: 'mm-recorder-name',
            label: 'مُعدّ المحضر',
            value: trimmedRecorderName,
            width: 'full',
          },
        ],
      });
    }

    // 7. كشف الحضور والتوقيعات (اختياري بالكامل — جدول فعلي من 3 أعمدة: م. | الاسم | التوقيع)
    if (state.enableAttendanceSheet) {
      const validAttendees = state.attendees
        .map((a) => a.attendeeName.trim())
        .filter((name) => Boolean(name))
        .slice(0, MAX_MEETING_ATTENDEES);

      if (validAttendees.length > 0) {
        const attendanceRows: TeacherReportAttendanceRow[] = validAttendees.map(
          (name, idx) => ({
            index: idx + 1,
            name,
          })
        );

        sections.push({
          id: 'mm-attendance-sheet-section',
          title: 'كشف الحضور والتوقيعات',
          type: 'attendance-table',
          attendanceRows,
          forceNewPage: true,
        });
      }
    }

    const validMeetingPhotos = (state.evidencePhotos || [])
      .filter((p) => Boolean(p && p.imageDataUrl && p.imageDataUrl.trim()))
      .slice(0, 2);
    const validMeetingLinks = (state.evidenceLinks || [])
      .filter((l) => Boolean(l && l.url && l.url.trim()))
      .slice(0, 2);

    return {
      reportTypeLabel: 'محضر اجتماع',
      reportMainTitle: state.meetingTitle.trim() || 'محضر اجتماع',
      templateStyle,
      colorSystem,
      basicFields,
      sections,
      evidencePhotos: validMeetingPhotos,
      evidenceLinks: validMeetingLinks,
      executorName: '',
      nationalId: '',
      signatureDataUrl: '',
      principalName,
      includePrincipalSignoff: true,
      // Ensures Principal approval & evidence stay on the main minutes page(s), before the independent attendance sheet
      signoffBeforeNewPageSections: true,
    };
  }

  // ============================================================================
  // النموذج الثاني: تقرير زيارة تبادلية بين المعلمين (Peer Visit Report)
  // ============================================================================
  const resolvedTopic = resolvePeerVisitTopicText(
    state.visitTopic,
    state.customVisitTopic
  );

  const basicFields: TeacherReportBasicField[] = [
    {
      id: 'pv-visiting-teacher',
      label: 'المعلم الزائر',
      value: state.visitingTeacherName.trim() || 'غير محدد',
      width: 'half',
    },
    {
      id: 'pv-host-teacher',
      label: 'المعلم المستضيف',
      value: state.hostTeacherName.trim() || 'غير محدد',
      width: 'half',
    },
    {
      id: 'pv-scope',
      label: 'نطاق الزيارة',
      value: state.visitScope,
      width: 'half',
    },
    {
      id: 'pv-topic',
      label: 'موضوع الزيارة',
      value: resolvedTopic,
      width: 'half',
    },
  ];

  // التخصص والصف/المرحلة عند الحاجة (لا تترك مساحة فارغة إن لم تُدخل)
  const hasSpec = Boolean(state.specialization.trim());
  const hasGrade = Boolean(state.gradeOrStage.trim());

  if (hasSpec && hasGrade) {
    basicFields.push(
      {
        id: 'pv-date',
        label: 'تاريخ الزيارة',
        value: state.visitDate.trim() || 'غير محدد',
        width: 'third',
      },
      {
        id: 'pv-spec',
        label: 'التخصص',
        value: state.specialization.trim(),
        width: 'third',
      },
      {
        id: 'pv-grade',
        label: 'الصف / المرحلة',
        value: state.gradeOrStage.trim(),
        width: 'third',
      }
    );
  } else if (hasSpec) {
    basicFields.push(
      {
        id: 'pv-date',
        label: 'تاريخ الزيارة',
        value: state.visitDate.trim() || 'غير محدد',
        width: 'half',
      },
      {
        id: 'pv-spec',
        label: 'التخصص',
        value: state.specialization.trim(),
        width: 'half',
      }
    );
  } else if (hasGrade) {
    basicFields.push(
      {
        id: 'pv-date',
        label: 'تاريخ الزيارة',
        value: state.visitDate.trim() || 'غير محدد',
        width: 'half',
      },
      {
        id: 'pv-grade',
        label: 'الصف / المرحلة',
        value: state.gradeOrStage.trim(),
        width: 'half',
      }
    );
  } else {
    basicFields.push({
      id: 'pv-date',
      label: 'تاريخ الزيارة',
      value: state.visitDate.trim() || 'غير محدد',
      width: 'full',
    });
  }

  const visitDataFields: TeacherReportBasicField[] = [
    {
      id: 'pv-practice-title',
      label: 'موضوع الممارسة التعليمية التي تمت مشاهدتها',
      value: state.observedPracticeTitle.trim() || 'غير محدد',
      width: 'full',
      isLongText: true,
    },
    {
      id: 'pv-practice-desc',
      label: 'وصف مختصر للممارسة أو الإجراء الذي تمت ملاحظته',
      value: state.observedPracticeDescription.trim() || 'غير محدد',
      width: 'full',
      isLongText: true,
    },
  ];

  if (state.additionalVisitDetails.trim()) {
    visitDataFields.push({
      id: 'pv-additional-details',
      label: 'تفاصيل إضافية لتوثيق الزيارة',
      value: state.additionalVisitDetails.trim(),
      width: 'full',
      isLongText: true,
    });
  }

  const sections: TeacherReportContentSection[] = [
    {
      id: 'pv-visit-details-section',
      title: 'بيانات الممارسة التعليمية المشاهَدة',
      type: 'fields',
      fields: visitDataFields,
    },
    {
      id: 'pv-takeaways-section',
      title: 'خلاصة الاستفادة والتطبيق المهني',
      type: 'fields',
      fields: [
        {
          id: 'pv-key-takeaways',
          label: 'أبرز ما استفاد منه المعلم الزائر',
          value: state.keyTakeaways.trim() || 'غير محدد',
          width: 'full',
          isLongText: true,
        },
        {
          id: 'pv-practice-to-apply',
          label: 'الممارسة التي يرغب في تطبيقها',
          value: state.practiceToApply.trim() || 'غير محدد',
          width: 'full',
          isLongText: true,
        },
      ],
    },
  ];

  // قسم اختياري مستقل في نهاية التقرير لتوثيق أسماء المعلمين والتوقيع عليهما بعد الطباعة
  if (state.enableTeacherSignatures) {
    sections.push({
      id: 'pv-teacher-signatures-section',
      title: 'أسماء المعلمين والتوقيعات',
      type: 'fields',
      placeAfterEvidence: true,
      fields: [
        {
          id: 'pv-sig-visiting-name',
          label: 'المعلم الزائر',
          value: state.visitingTeacherName.trim() || 'غير محدد',
          width: 'half',
        },
        {
          id: 'pv-sig-visiting-space',
          label: 'توقيع المعلم الزائر',
          value: '',
          width: 'half',
          isSignatureSpace: true,
        },
        {
          id: 'pv-sig-host-name',
          label: 'المعلم المستضيف',
          value: state.hostTeacherName.trim() || 'غير محدد',
          width: 'half',
        },
        {
          id: 'pv-sig-host-space',
          label: 'توقيع المعلم المستضيف',
          value: '',
          width: 'half',
          isSignatureSpace: true,
        },
      ],
    });
  }

  const validPeerPhotos = (state.evidencePhotos || [])
    .filter((p) => Boolean(p && p.imageDataUrl && p.imageDataUrl.trim()))
    .slice(0, 2);
  const validPeerLinks = (state.evidenceLinks || [])
    .filter((l) => Boolean(l && l.url && l.url.trim()))
    .slice(0, 2);

  return {
    reportTypeLabel: 'تقرير زيارة تبادلية بين المعلمين',
    reportMainTitle:
      state.observedPracticeTitle.trim() ||
      `زيارة تبادلية في ${resolvedTopic}`,
    templateStyle,
    colorSystem,
    basicFields,
    sections,
    evidencePhotos: validPeerPhotos,
    evidenceLinks: validPeerLinks,
    executorName: '',
    nationalId: '',
    signatureDataUrl: '',
    principalName,
    includePrincipalSignoff: true,
  };
}
