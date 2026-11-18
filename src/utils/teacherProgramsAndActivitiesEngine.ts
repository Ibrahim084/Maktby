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
import {
  isValidElectronicUrl,
  validateElectronicLinks,
} from './teacherTestsAndEvaluationEngine';

export { isValidElectronicUrl, validateElectronicLinks };

// ============================================================================
// المجموعة السادسة: البرامج والأنشطة التعليمية (Educational Programs & Activities)
// ============================================================================

export type TeacherProgramsAndActivitiesGroupId = 'programs-and-activities';

export type TeacherProgramsAndActivitiesFormId =
  | 'educational-initiative-documentation';

export interface TeacherProgramsAndActivitiesGroupMetadata {
  id: TeacherProgramsAndActivitiesGroupId;
  title: string;
  badge: string;
  description: string;
  summaryHighlight: string;
}

export interface TeacherProgramsAndActivitiesModelMetadata {
  id: TeacherProgramsAndActivitiesFormId;
  groupId: TeacherProgramsAndActivitiesGroupId;
  title: string;
  shortTitle: string;
  reportTypeLabel: string;
  badge: string;
  description: string;
  highlights: string[];
}

export const TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP: TeacherProgramsAndActivitiesGroupMetadata =
  {
    id: 'programs-and-activities',
    title: 'البرامج والأنشطة التعليمية',
    badge: 'نموذج معتمد',
    description:
      'توثيق البرامج والمبادرات والأنشطة التعليمية التي ينفذها المعلم بصورة فردية أو جماعية داخل الصف أو على مستوى المدرسة أو في نطاق أوسع، مع إبراز فكرتها وأهدافها وآلية تنفيذها وأثرها التربوي.',
    summaryHighlight:
      'تشتمل على نموذج «توثيق مبادرة تعليمية» لدعم المبادرات الفردية والجماعية مع الشواهد ورموز QR الاختيارية',
  };

export const TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG: TeacherProgramsAndActivitiesModelMetadata[] =
  [
    {
      id: 'educational-initiative-documentation',
      groupId: 'programs-and-activities',
      title: 'توثيق مبادرة تعليمية',
      shortTitle: 'توثيق مبادرة تعليمية',
      reportTypeLabel: 'توثيق مبادرة تعليمية',
      badge: 'المبادرات التعليمية',
      description:
        'توثيق مبادرة تعليمية ينفذها المعلم بصورة فردية أو جماعية، سواء داخل الصف أو على مستوى المدرسة أو في نطاق أوسع، مع توضيح فكرتها وأهدافها وتنفيذها وأثرها.',
      highlights: [
        'تحديد نطاق المبادرة (صفية، على مستوى المدرسة، عامة) والمستفيدين ونوع المبادرة بمرونة كاملة',
        'دعم المبادرات الفردية (اسم المنفذ) والمبادرات الجماعية (إضافة وتنظيم أسماء المشاركين)',
        'توثيق فكرة المبادرة والهدف وآلية التنفيذ وأبرز النتائج والأثر مع شواهد مصورة وروابط QR اختيارية',
      ],
    },
  ];

// ============================================================================
// الخيارات المعتمدة لنموذج «توثيق مبادرة تعليمية»
// ============================================================================

export type InitiativeScopeOption = 'صفية' | 'على مستوى المدرسة' | 'عامة';

export const INITIATIVE_SCOPE_OPTIONS: InitiativeScopeOption[] = [
  'صفية',
  'على مستوى المدرسة',
  'عامة',
];

export type InitiativeBeneficiariesOption =
  | 'طلاب صف محدد'
  | 'عدة صفوف'
  | 'طلاب المدرسة'
  | 'المعلمون'
  | 'طلاب ومعلمو المدرسة'
  | 'فئة أخرى';

export const INITIATIVE_BENEFICIARIES_OPTIONS: InitiativeBeneficiariesOption[] =
  [
    'طلاب صف محدد',
    'عدة صفوف',
    'طلاب المدرسة',
    'المعلمون',
    'طلاب ومعلمو المدرسة',
    'فئة أخرى',
  ];

export type InitiativeTypeOption =
  | 'تعليمية'
  | 'علاجية'
  | 'إثرائية'
  | 'تقنية ورقمية'
  | 'قرائية'
  | 'مهارية'
  | 'تحفيزية'
  | 'نوع آخر';

export const INITIATIVE_TYPE_OPTIONS: InitiativeTypeOption[] = [
  'تعليمية',
  'علاجية',
  'إثرائية',
  'تقنية ورقمية',
  'قرائية',
  'مهارية',
  'تحفيزية',
  'نوع آخر',
];

export type InitiativeExecutionNatureOption = 'مبادرة فردية' | 'مبادرة جماعية';

export const INITIATIVE_EXECUTION_NATURE_OPTIONS: InitiativeExecutionNatureOption[] =
  ['مبادرة فردية', 'مبادرة جماعية'];

export interface InitiativeParticipant {
  id: string;
  name: string;
}

export interface EducationalInitiativeFormState {
  formId: 'educational-initiative-documentation';
  initiativeName: string;
  initiativeScope: InitiativeScopeOption;
  beneficiaries: InitiativeBeneficiariesOption;
  targetGradeOrGrades: string; // يظهر عند اختيار «طلاب صف محدد» أو «عدة صفوف»
  customBeneficiaries: string; // يظهر عند اختيار «فئة أخرى»
  initiativeType: InitiativeTypeOption;
  customInitiativeType: string; // يظهر عند اختيار «نوع آخر»
  executionDateOrPeriod: string;
  executionPlace: string;
  executionNature: InitiativeExecutionNatureOption;
  executorName: string; // يظهر عند اختيار «مبادرة فردية»
  participants: InitiativeParticipant[]; // يظهر عند اختيار «مبادرة جماعية»
  initiativeGoal: string;
  initiativeDescription: string;
  executionMechanism: string;
  keyResultsOrImpact: string;
  additionalNotes: string; // اختياري
  evidencePhotos: TeacherReportEvidencePhoto[]; // اختياري (0..2)
  evidenceLinks: TeacherReportEvidenceLink[]; // اختياري (0..2)
}

export type AnyTeacherProgramOrActivityFormState =
  EducationalInitiativeFormState;

// ============================================================================
// دوال مساعدة (Helper Functions)
// ============================================================================

export function doesBeneficiariesRequireGrades(
  beneficiaries: InitiativeBeneficiariesOption
): boolean {
  return beneficiaries === 'طلاب صف محدد' || beneficiaries === 'عدة صفوف';
}

export function resolveBeneficiariesDisplayValue(
  state: EducationalInitiativeFormState
): string {
  if (state.beneficiaries === 'فئة أخرى') {
    return state.customBeneficiaries.trim() || 'فئة أخرى';
  }
  return state.beneficiaries;
}

export function resolveInitiativeTypeDisplayValue(
  state: EducationalInitiativeFormState
): string {
  if (state.initiativeType === 'نوع آخر') {
    return state.customInitiativeType.trim() || 'نوع آخر';
  }
  return state.initiativeType;
}

// ============================================================================
// الحالة الابتدائية والبيانات النموذجية (Initial & Sample State)
// ============================================================================

export function createInitialEducationalInitiativeState(
  settings: SchoolSettings
): EducationalInitiativeFormState {
  return {
    formId: 'educational-initiative-documentation',
    initiativeName: '',
    initiativeScope: 'صفية',
    beneficiaries: 'طلاب صف محدد',
    targetGradeOrGrades: '',
    customBeneficiaries: '',
    initiativeType: 'تعليمية',
    customInitiativeType: '',
    executionDateOrPeriod: '',
    executionPlace: '',
    executionNature: 'مبادرة فردية',
    executorName: settings.userName?.trim() || '',
    participants: [
      { id: 'part-1', name: settings.userName?.trim() || '' },
      { id: 'part-2', name: '' },
    ],
    initiativeGoal: '',
    initiativeDescription: '',
    executionMechanism: '',
    keyResultsOrImpact: '',
    additionalNotes: '',
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

export function createSampleEducationalInitiativeState(
  settings: SchoolSettings,
  options?: { executionNature?: InitiativeExecutionNatureOption }
): EducationalInitiativeFormState {
  const nature = options?.executionNature ?? 'مبادرة فردية';
  const defaultExecutor =
    settings.userName?.trim() || 'أ. عبدالرحمن بن خالد الغامدي';

  return {
    formId: 'educational-initiative-documentation',
    initiativeName:
      'مبادرة «تحدي الإتقان الصباحي» لتعزيز المفاهيم الأساسية ومهارات التفكير المنطقي',
    initiativeScope: nature === 'مبادرة جماعية' ? 'على مستوى المدرسة' : 'صفية',
    beneficiaries: nature === 'مبادرة جماعية' ? 'عدة صفوف' : 'طلاب صف محدد',
    targetGradeOrGrades:
      nature === 'مبادرة جماعية'
        ? 'صفوف المرحلة المتوسطة (الأول والثاني والثالث المتوسط)'
        : 'الصف الثاني المتوسط (٢/أ)',
    customBeneficiaries: '',
    initiativeType: 'تعليمية',
    customInitiativeType: '',
    executionDateOrPeriod: 'الفصل الدراسي الثاني ١٤٤٧هـ — لمدة أربعة أسابيع',
    executionPlace:
      nature === 'مبادرة جماعية'
        ? 'الفصول الدراسية ومركز مصادر التعلم بالمدرسة'
        : 'القاعة الصفية ومعمل الرياضيات',
    executionNature: nature,
    executorName: defaultExecutor,
    participants: [
      { id: 'part-1', name: defaultExecutor },
      { id: 'part-2', name: 'أ. خالد بن سعد الدوسري' },
      { id: 'part-3', name: 'أ. محمد بن عبدالله الشهري' },
    ],
    initiativeGoal:
      'رفع مستوى الجاهزية الذهنية للطلاب في بداية اليوم الدراسي، وتمكينهم من إتقان المهارات الأساسية التراكمية وتوظيفها في حل المشكلات التطبيقية بثقة واستقلالية.',
    initiativeDescription:
      'مبادرة تربوية تطبيقية تقوم على تقديم بطاقات تحدٍ قصيرة ومتدرجة الصعوبة في مطلع الحصة الدراسية لمدة خمس دقائق، تركز على مهارة محورية واحدة كل أسبوع مع تغذية راجعة فورية وتحفيز مستمر للطلاب المتميزين والمتحسنين.',
    executionMechanism:
      'تم إعداد بنك بطاقات مصنفة وفق المهارات المستهدفة، وتوزيعها في بداية الحصص المحددة، ثم مناقشة الحلول النموذجية جماعياً خلال دقيقتين، وتوثيق تقدم الطلاب في لوحة الإتقان الأسبوعية داخل الصف.',
    keyResultsOrImpact:
      'تحسن ملموس في سرعة استحضار الطلاب للمفاهيم السابقة، وارتفاع مستوى التفاعل الإيجابي والمبادرة الذاتية للمشاركة الصفية، وانخفاض الأخطاء المتكررة في المهارات الأساسية المستهدفة.',
    additionalNotes:
      'لاقت المبادرة استحسان الطلاب وأولياء الأمور، وتمت التوصية بتعميم فكرتها على بقية الفصول الدراسية.',
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

// ============================================================================
// التحقق من صحة الحقول (Validation)
// ============================================================================

export function validateEducationalInitiativeState(
  state: EducationalInitiativeFormState
): string[] {
  const errors: string[] = [];

  if (!state.initiativeName.trim()) {
    errors.push('يرجى إدخال اسم المبادرة.');
  }

  if (
    doesBeneficiariesRequireGrades(state.beneficiaries) &&
    !state.targetGradeOrGrades.trim()
  ) {
    errors.push(
      state.beneficiaries === 'طلاب صف محدد'
        ? 'يرجى تحديد الصف المستفيد من المبادرة.'
        : 'يرجى تحديد الصفوف المستفيدة من المبادرة.'
    );
  }

  if (state.beneficiaries === 'فئة أخرى' && !state.customBeneficiaries.trim()) {
    errors.push('يرجى كتابة الفئة المستفيدة من المبادرة.');
  }

  if (state.initiativeType === 'نوع آخر' && !state.customInitiativeType.trim()) {
    errors.push('يرجى كتابة نوع المبادرة المخصص.');
  }

  if (!state.executionDateOrPeriod.trim()) {
    errors.push('يرجى إدخال تاريخ التنفيذ أو الفترة الزمنية.');
  }

  if (!state.executionPlace.trim()) {
    errors.push('يرجى إدخال مكان التنفيذ.');
  }

  if (state.executionNature === 'مبادرة فردية') {
    if (!state.executorName.trim()) {
      errors.push('يرجى إدخال اسم منفذ المبادرة.');
    }
  } else {
    const validParticipants = (state.participants || []).filter((p) =>
      p.name.trim()
    );
    if (validParticipants.length === 0) {
      errors.push(
        'يرجى إضافة اسم مشارك واحد على الأقل في المبادرة الجماعية.'
      );
    }
  }

  if (!state.initiativeGoal.trim()) {
    errors.push('يرجى إدخال الهدف من المبادرة.');
  }

  if (!state.initiativeDescription.trim()) {
    errors.push('يرجى إدخال وصف المبادرة وفكرتها.');
  }

  if (!state.executionMechanism.trim()) {
    errors.push('يرجى إدخال آلية التنفيذ.');
  }

  if (!state.keyResultsOrImpact.trim()) {
    errors.push('يرجى إدخال أبرز النتائج أو الأثر.');
  }

  errors.push(...validateElectronicLinks(state.evidenceLinks || []));

  return errors;
}

// ============================================================================
// حفظ واسترجاع المسودات محلياً (LocalStorage Draft Persistence)
// ============================================================================

const DRAFT_STORAGE_KEY =
  'maktabi_teacher_program_activity_draft_v1_educational-initiative-documentation';

export function loadEducationalInitiativeDraft(
  settings: SchoolSettings
): EducationalInitiativeFormState {
  const fallback = createInitialEducationalInitiativeState(settings);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.formId !== 'educational-initiative-documentation'
    ) {
      return fallback;
    }
    return {
      ...fallback,
      ...parsed,
      participants: Array.isArray(parsed.participants)
        ? parsed.participants
        : fallback.participants,
      evidencePhotos: Array.isArray(parsed.evidencePhotos)
        ? parsed.evidencePhotos
        : [],
      evidenceLinks: Array.isArray(parsed.evidenceLinks)
        ? parsed.evidenceLinks
        : [],
    };
  } catch {
    return fallback;
  }
}

export function saveEducationalInitiativeDraft(
  state: EducationalInitiativeFormState
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearEducationalInitiativeDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// تحويل بيانات المبادرة إلى وثيقة PDF الموحدة (Build TeacherReportDocument)
// ============================================================================

export function buildTeacherEducationalInitiativeDocument(
  state: EducationalInitiativeFormState,
  settings: SchoolSettings,
  overrides?: {
    templateStyle?: TeacherPdfTemplateStyle;
    colorSystem?: TeacherPdfColorSystem;
  }
): TeacherReportDocument {
  const templateStyle =
    overrides?.templateStyle ?? settings.teacherPdfTemplate ?? 'waves';
  const colorSystem =
    overrides?.colorSystem ?? settings.teacherPdfColorSystem ?? 'green';
  const principalName = settings.principalName?.trim() || '';

  const beneficiariesText = resolveBeneficiariesDisplayValue(state);
  const initiativeTypeText = resolveInitiativeTypeDisplayValue(state);

  const basicFields: TeacherReportBasicField[] = [
    {
      id: 'bf-scope',
      label: 'نطاق المبادرة',
      value: state.initiativeScope || '—',
    },
    {
      id: 'bf-type',
      label: 'نوع المبادرة',
      value: initiativeTypeText || '—',
    },
    {
      id: 'bf-beneficiaries',
      label: 'المستفيدون من المبادرة',
      value: beneficiariesText || '—',
    },
  ];

  if (
    doesBeneficiariesRequireGrades(state.beneficiaries) &&
    state.targetGradeOrGrades.trim()
  ) {
    basicFields.push({
      id: 'bf-target-grades',
      label:
        state.beneficiaries === 'طلاب صف محدد'
          ? 'الصف المستفيد'
          : 'الصفوف المستفيدة',
      value: state.targetGradeOrGrades.trim(),
    });
  }

  basicFields.push(
    {
      id: 'bf-date-period',
      label: 'تاريخ التنفيذ أو الفترة الزمنية',
      value: state.executionDateOrPeriod.trim() || '—',
    },
    {
      id: 'bf-place',
      label: 'مكان التنفيذ',
      value: state.executionPlace.trim() || '—',
    }
  );

  const sections: TeacherReportContentSection[] = [];

  // 1. قسم طبيعة تنفيذ المبادرة والمنفذين / المشاركين
  if (state.executionNature === 'مبادرة فردية') {
    const executor =
      state.executorName.trim() || settings.userName?.trim() || '—';
    sections.push({
      id: 'sec-execution-nature',
      title: 'طبيعة تنفيذ المبادرة والمنفذ',
      type: 'fields',
      fields: [
        {
          id: 'ef-nature',
          label: 'طبيعة تنفيذ المبادرة',
          value: 'مبادرة فردية',
          width: 'half',
        },
        {
          id: 'ef-executor',
          label: 'اسم منفذ المبادرة',
          value: executor,
          width: 'half',
        },
      ],
    });
  } else {
    const validParticipants = (state.participants || [])
      .map((p) => p.name.trim())
      .filter(Boolean);

    const participantFields: TeacherReportContentSection['fields'] = [
      {
        id: 'ef-nature',
        label: 'طبيعة تنفيذ المبادرة',
        value: 'مبادرة جماعية',
        width: 'full',
      },
    ];

    validParticipants.forEach((participantName, index) => {
      const isLastOdd =
        validParticipants.length % 2 === 1 &&
        index === validParticipants.length - 1;
      participantFields.push({
        id: `ef-participant-${index + 1}`,
        label: `المشارك (${index + 1})`,
        value: participantName,
        width: isLastOdd ? 'full' : 'half',
      });
    });

    sections.push({
      id: 'sec-execution-nature',
      title: 'طبيعة تنفيذ المبادرة وأسماء المشاركين',
      type: 'fields',
      fields: participantFields,
    });
  }

  // 2. قسم تفاصيل المبادرة وفكرتها وآلية تنفيذها وأثرها
  sections.push({
    id: 'sec-initiative-details',
    title: 'تفاصيل المبادرة التعليمية وآلية تنفيذها وأثرها',
    type: 'fields',
    fields: [
      {
        id: 'df-goal',
        label: 'الهدف من المبادرة',
        value: state.initiativeGoal.trim() || '—',
        width: 'full',
        isLongText: true,
      },
      {
        id: 'df-description',
        label: 'وصف المبادرة وفكرتها',
        value: state.initiativeDescription.trim() || '—',
        width: 'full',
        isLongText: true,
      },
      {
        id: 'df-mechanism',
        label: 'آلية التنفيذ',
        value: state.executionMechanism.trim() || '—',
        width: 'full',
        isLongText: true,
      },
      {
        id: 'df-impact',
        label: 'أبرز النتائج أو الأثر',
        value: state.keyResultsOrImpact.trim() || '—',
        width: 'full',
        isLongText: true,
      },
    ],
  });

  // 3. قسم الملاحظات الإضافية (اختياري — يُخفى تماماً عند تركه فارغاً)
  if (state.additionalNotes.trim()) {
    sections.push({
      id: 'sec-additional-notes',
      title: 'ملاحظات إضافية',
      type: 'text',
      content: state.additionalNotes.trim(),
    });
  }

  // الشواهد المصورة (0..2) والروابط الإلكترونية (0..2)
  const validPhotos = (state.evidencePhotos || [])
    .filter((p) => p && p.imageDataUrl && p.imageDataUrl.trim().length > 0)
    .slice(0, 2);

  const validLinks = (state.evidenceLinks || [])
    .filter((l) => l && isValidElectronicUrl(l.url))
    .map((l) => ({ ...l, url: l.url.trim() }))
    .slice(0, 2);

  const executorForFooter =
    state.executionNature === 'مبادرة فردية'
      ? state.executorName.trim() || settings.userName?.trim() || ''
      : settings.userName?.trim() ||
        (state.participants || [])
          .map((p) => p.name.trim())
          .filter(Boolean)[0] ||
        '';

  return {
    reportTypeLabel: 'توثيق مبادرة تعليمية',
    reportMainTitle: state.initiativeName.trim() || 'توثيق مبادرة تعليمية',
    templateStyle,
    colorSystem,
    basicFields,
    sections,
    evidencePhotos: validPhotos,
    evidenceLinks: validLinks,
    executorName: executorForFooter,
    nationalId: '',
    signatureDataUrl: '',
    principalName,
    includePrincipalSignoff: Boolean(principalName),
  };
}
