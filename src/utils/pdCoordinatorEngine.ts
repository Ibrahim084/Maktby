import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { ApprovedSchoolSemester, SchoolSettings, UserGender } from '../types';
import {
  getGenderedLabels,
  getRoleForSection,
  normalizeApprovedSemester,
} from './settingsStorage';
import { createZipArchiveBytes, sanitizeFilenameSegment } from './zipBuilder';

// ============================================================================
// Unified Gendered Terminology for PD Unit (Driven strictly by settings.gender)
// ============================================================================

export interface PdGenderedTerms {
  gender: UserGender;
  coordinatorDefaultTitle: string;
  principalTitle: string;
  teachersCountLabel: string;
  participatingTeachersCountLabel: string;
  trainersSectionHeading: string;
  addTrainerLabel: string;
  trainerNameLabel: string;
  trainerAriaNoun: string;
  trainerPossessivePrefix: string;
  traineesCountLabel: string;
  trainerExecutorLabel: string;
  beneficiariesTitle: string;
  beneficiariesWithEvidenceLabel: string;
  beneficiariesListHeading: string;
  beneficiarySingular: string;
  beneficiaryDefinite: string;
  addBeneficiaryLabel: string;
  addExtraBeneficiaryLabel: string;
  beneficiariesExtraHeading: string;
  beneficiariesBatchLabel: string;
  beneficiariesBatchPlaceholder: string;
  targetAudiencePlaceholder: string;
  targetAudienceLabel: string;
  targetCountLabel: string;
  traineesDefinitePlural: string;
  traineeSingular: string;
  traineeDefiniteSingular: string;
  createEvaluationForTraineeLabel: string;
  evaluationSubtitle: string;
  evaluationTraineeFieldLabel: string;
  evaluationTraineePlaceholder: string;
  beneficiariesCountLabel: string;
  schoolStaffDative: string;
  executionSubtitle: string;
  beneficiariesEvidenceHint: string;
  quarterlyHelperText: string;
  quarterlyBeneficiariesHint: string;
  quarterlyEmptyBeneficiaries: string;
  beneficiaryFallbackName: string;
  certificateTrainerLinkDesc: string;
}

export function getPdGenderedTerms(gender?: UserGender): PdGenderedTerms {
  const isFemale = gender === 'female';
  return {
    gender: isFemale ? 'female' : 'male',
    coordinatorDefaultTitle: isFemale
      ? 'منسقة التطوير المهني'
      : 'منسق التطوير المهني',
    principalTitle: isFemale ? 'مديرة المدرسة' : 'مدير المدرسة',
    teachersCountLabel: isFemale ? 'عدد المعلمات' : 'عدد المعلمين',
    participatingTeachersCountLabel: isFemale
      ? 'عدد المعلمات المشاركات في برامج التطوير المهني'
      : 'عدد المعلمين المشاركين في برامج التطوير المهني',
    trainersSectionHeading: isFemale
      ? 'ثانياً- بيانات المدربات:'
      : 'ثانياً- بيانات المدربين:',
    addTrainerLabel: isFemale ? 'إضافة مدربة' : 'إضافة مدرب',
    trainerNameLabel: isFemale ? 'اسم المدربة' : 'اسم المدرب',
    trainerAriaNoun: isFemale ? 'المدربة' : 'المدرب',
    trainerPossessivePrefix: isFemale ? 'للمدربة' : 'للمدرب',
    traineesCountLabel: isFemale ? 'عدد المتدربات' : 'عدد المتدربين',
    trainerExecutorLabel: isFemale ? 'منفذة التدريب' : 'منفذ التدريب',
    beneficiariesTitle: isFemale ? 'المستفيدات' : 'المستفيدين',
    beneficiariesWithEvidenceLabel: isFemale
      ? 'المستفيدات والشواهد'
      : 'المستفيدون والشواهد',
    beneficiariesListHeading: isFemale
      ? 'قائمة المستفيدات والمتدربات المسجلات للبرنامج'
      : 'قائمة المستفيدين والمتدربين المسجلين للبرنامج',
    beneficiarySingular: isFemale ? 'مستفيدة' : 'مستفيد',
    beneficiaryDefinite: isFemale ? 'المستفيدة' : 'المستفيد',
    addBeneficiaryLabel: isFemale ? 'إضافة مستفيدة' : 'إضافة مستفيد',
    addExtraBeneficiaryLabel: isFemale
      ? 'إضافة مستفيدة إضافية'
      : 'إضافة مستفيد إضافي',
    beneficiariesExtraHeading: isFemale
      ? 'المستفيدات المضافات مباشرة للتقرير الفصلي:'
      : 'المستفيدون المضافون مباشرة للتقرير الفصلي:',
    beneficiariesBatchLabel: isFemale
      ? 'إضافة دفعة مستفيدات نصياً (كل سطر: الاسم - الهوية الوطنية):'
      : 'إضافة دفعة مستفيدين نصياً (كل سطر: الاسم - الهوية الوطنية):',
    beneficiariesBatchPlaceholder: isFemale
      ? 'نورة عبدالله الغامدي - 1045678912\nسارة علي الزهراني - 1098765432'
      : 'محمد عبدالله الغامدي - 1045678912\nسعيد علي الزهراني - 1098765432',
    targetAudiencePlaceholder: isFemale
      ? 'مثال: معلمات العلوم والرياضيات'
      : 'مثال: معلمو العلوم والرياضيات',
    targetAudienceLabel: isFemale ? 'المستهدفات' : 'المستهدفين',
    targetCountLabel: isFemale ? 'عدد المستهدفات' : 'عدد المستهدفين',
    traineesDefinitePlural: isFemale ? 'المتدربات' : 'المتدربين',
    traineeSingular: isFemale ? 'متدربة' : 'متدرب',
    traineeDefiniteSingular: isFemale ? 'المتدربة' : 'المتدرب',
    createEvaluationForTraineeLabel: isFemale
      ? 'إنشاء استمارة تقييم لمتدربة'
      : 'إنشاء استمارة تقييم لمتدرب',
    evaluationSubtitle: isFemale
      ? 'نموذج مستقل لكل متدربة ببنوده الـ ١٥ وخياراته الأربعة حرفياً، دون أي مؤشرات أو نسب إضافية غير واردة في النموذج.'
      : 'نموذج مستقل لكل متدرب ببنوده الـ ١٥ وخياراته الأربعة حرفياً، دون أي مؤشرات أو نسب إضافية غير واردة في النموذج.',
    evaluationTraineeFieldLabel: isFemale
      ? 'اسم أو رمز المتدربة المقيمة (اختياري لفرز الاستمارات إدارياً):'
      : 'اسم أو رمز المتدرب المقيم (اختياري لفرز الاستمارات إدارياً):',
    evaluationTraineePlaceholder: isFemale ? 'مثال: المتدربة ١' : 'مثال: المتدرب ١',
    beneficiariesCountLabel: isFemale ? 'عدد المستفيدات' : 'عدد المستفيدين',
    schoolStaffDative: isFemale ? 'لمنسوبات المدرسة' : 'لمنسوبي المدرسة',
    executionSubtitle: isFemale
      ? 'مطابق لنموذج الصفحة ٤ مع إزالة حد الـ ٤ صفوف، وإضافة أسماء المستفيدات وشواهد التنفيذ لتغذية التقييم والتقرير الفصلي تلقائياً.'
      : 'مطابق لنموذج الصفحة ٤ مع إزالة حد الـ ٤ صفوف، وإضافة أسماء المستفيدين وشواهد التنفيذ لتغذية التقييم والتقرير الفصلي تلقائياً.',
    beneficiariesEvidenceHint: isFemale
      ? 'اضغط على «المستفيدات والشواهد» داخل أي صف لربط قائمة المتدربات والهويات الوطنية وصور التنفيذ (تغذي التقييم والتقرير الفصلي تلقائياً).'
      : 'اضغط على «المستفيدون والشواهد» داخل أي صف لربط قائمة المتدربين والهويات الوطنية وصور التنفيذ (تغذي التقييم والتقرير الفصلي تلقائياً).',
    quarterlyHelperText: isFemale
      ? 'تُستخلص الأوعية المنفذة وساعات المستفيدات تلقائياً من تقارير التنفيذ والخطة العامة للفصل المحدد دون تكرار إدخال.'
      : 'تُستخلص الأوعية المنفذة وساعات المستفيدين تلقائياً من تقارير التنفيذ والخطة العامة للفصل المحدد دون تكرار إدخال.',
    quarterlyBeneficiariesHint: isFemale
      ? 'مجموع ساعات كل مستفيدة عبر البرامج المسجلة، مع دعم الطباعة التلقائية لأكثر من ١٥ صفاً في ملف PDF.'
      : 'مجموع ساعات كل مستفيد عبر البرامج المسجلة، مع دعم الطباعة التلقائية لأكثر من ١٥ صفاً في ملف PDF.',
    quarterlyEmptyBeneficiaries: isFemale
      ? 'لا توجد أسماء مستفيدات مسجلة بعد. أضف قائمة المتدربات داخل «02 تقرير تنفيذ البرامج» لتظهر هنا تلقائياً.'
      : 'لا توجد أسماء مستفيدين مسجلة بعد. أضف قائمة المتدربين داخل «02 تقرير تنفيذ البرامج» لتظهر هنا تلقائياً.',
    beneficiaryFallbackName: isFemale ? 'مستفيدة' : 'مستفيد',
    certificateTrainerLinkDesc: isFemale
      ? 'إصدار شهادة شكر وتقدير رسمية (A4 أفقي) لمنفذة البرنامج التدريبي مرتبطة بسجل الدورات وإعدادات المدرسة.'
      : 'إصدار شهادة شكر وتقدير رسمية (A4 أفقي) لمنفذ البرنامج التدريبي مرتبطة بسجل الدورات وإعدادات المدرسة.',
  };
}

// ============================================================================
// Constants & Storage Keys (Scoped strictly to Professional Development Unit)
// ============================================================================

export const PD_UNIT_STORAGE_KEY = 'maktabi_pd_unit_store_v1';
export const PD_EVIDENCE_DB_NAME = 'maktabi_pd_evidence_db_v1';
export const PD_EVIDENCE_OBJECT_STORE = 'pd_attachments_v1';

export type PdMainTabId =
  | 'general-plan'
  | 'execution-report'
  | 'evaluation'
  | 'quarterly-hours'
  | 'certificates';

export type SchoolStageCode = 'ب' | 'م' | 'ث';
export const SCHOOL_STAGE_CODES: SchoolStageCode[] = ['ب', 'م', 'ث'];

export const SCHOOL_STAGE_LABELS: Record<SchoolStageCode, string> = {
  ب: 'ابتدائي (ب)',
  م: 'متوسط (م)',
  ث: 'ثانوي (ث)',
};

export const DEFAULT_PD_ACADEMIC_YEAR = '1448هـ';

export function normalizeAcademicYearKey(yearRaw?: string): string {
  const cleaned = (yearRaw || '').trim();
  if (!cleaned) return DEFAULT_PD_ACADEMIC_YEAR;
  return cleaned;
}

// ============================================================================
// 2. Engine 01: General PD Plan (Page 3)
// ============================================================================

export type PlanExecutionStatus = 'pending' | 'executed' | 'not_executed';

export interface PdPlanTopicRow {
  id: string;
  topic: string;
  presenterName: string;
  specialization: string;
  executionDate: string;
  hoursCount: string;
  executionLocation: string;
  executionStatus: PlanExecutionStatus;
  notExecutedReason: string;
}

export interface PdPlanVessel {
  id: string;
  vesselName: string; // Starts EMPTY ('') by default as requested
  rows: PdPlanTopicRow[];
}

export interface PdGeneralPlanData {
  vessels: PdPlanVessel[];
  coordinatorAuthName: string;
  principalAuthName: string;
}

export function createEmptyPlanTopicRow(id?: string): PdPlanTopicRow {
  return {
    id: id || createEntityId('plan_row'),
    topic: '',
    presenterName: '',
    specialization: '',
    executionDate: '',
    hoursCount: '',
    executionLocation: '',
    executionStatus: 'pending',
    notExecutedReason: '',
  };
}

export function createPlanVessel(
  vesselName = '',
  initialRowsCount = 5,
  id?: string
): PdPlanVessel {
  return {
    id: id || createEntityId('vessel'),
    vesselName,
    rows: Array.from({ length: Math.max(1, initialRowsCount) }, (_, idx) =>
      createEmptyPlanTopicRow(`row_${idx + 1}_${Math.random().toString(36).slice(2, 7)}`)
    ),
  };
}

export function createDefaultGeneralPlanData(): PdGeneralPlanData {
  // 3 default vessels with EMPTY titles so the user types vessel names directly
  return {
    vessels: [
      createPlanVessel('', 5, 'vessel_default_1'),
      createPlanVessel('', 5, 'vessel_default_2'),
      createPlanVessel('', 5, 'vessel_default_3'),
    ],
    coordinatorAuthName: '',
    principalAuthName: '',
  };
}

export function parsePositiveHours(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }
  if (typeof raw !== 'string') return 0;
  const normalizedDigits = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(',', '.');
  const num = Number.parseFloat(normalizedDigits);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function calculatePlanExecutedHours(plan: PdGeneralPlanData): number {
  let total = 0;
  for (const vessel of plan.vessels) {
    for (const row of vessel.rows) {
      if (row.executionStatus === 'executed') {
        total += parsePositiveHours(row.hoursCount);
      }
    }
  }
  return Math.round(total * 100) / 100;
}

// ============================================================================
// 3. Engine 02: Training Program Execution Report (Page 4)
// ============================================================================

export interface PdTrainerEntry {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  qualification: string;
}

export interface PdBeneficiaryParticipant {
  id: string;
  name: string;
  nationalId: string;
  hoursCount?: string;
}

export interface PdEvidencePhotoRef {
  id: string;
  blobKey: string;
  title: string;
  mimeType: string;
  createdAt: string;
}

export interface PdExecutedProgramEntry {
  id: string;
  programName: string;
  daysCount: string;
  hoursCount: string;
  traineesCount: string;
  trainerName: string;
  // Operational metadata shared with Engine 03 & Engine 04 without duplicate entry
  vesselType: string;
  executionDate: string;
  executionLocation: string;
  targetAudience: string;
  beneficiaries: PdBeneficiaryParticipant[];
  evidencePhotos: PdEvidencePhotoRef[];
}

export interface PdExecutionReportData {
  stageLabel: string;
  totalTeachersCount: string;
  participatingTeachersCount: string;
  trainers: PdTrainerEntry[];
  programs: PdExecutedProgramEntry[];
  coordinatorAuthName: string;
  principalAuthName: string;
}

export function createEmptyTrainerEntry(id?: string): PdTrainerEntry {
  return {
    id: id || createEntityId('trainer'),
    name: '',
    nationalId: '',
    mobile: '',
    qualification: '',
  };
}

export function createEmptyExecutedProgramEntry(
  id?: string
): PdExecutedProgramEntry {
  return {
    id: id || createEntityId('exec_prog'),
    programName: '',
    daysCount: '',
    hoursCount: '',
    traineesCount: '',
    trainerName: '',
    vesselType: '',
    executionDate: '',
    executionLocation: '',
    targetAudience: '',
    beneficiaries: [],
    evidencePhotos: [],
  };
}

export function createDefaultExecutionReportData(): PdExecutionReportData {
  return {
    stageLabel: '',
    totalTeachersCount: '',
    participatingTeachersCount: '',
    trainers: [
      createEmptyTrainerEntry('trainer_1'),
      createEmptyTrainerEntry('trainer_2'),
      createEmptyTrainerEntry('trainer_3'),
      createEmptyTrainerEntry('trainer_4'),
    ],
    programs: [
      createEmptyExecutedProgramEntry('prog_1'),
      createEmptyExecutedProgramEntry('prog_2'),
      createEmptyExecutedProgramEntry('prog_3'),
      createEmptyExecutedProgramEntry('prog_4'),
    ],
    coordinatorAuthName: '',
    principalAuthName: '',
  };
}

/**
 * Parses lines like:
 * "أحمد محمد الزهراني - 1012345678"
 * "أحمد محمد الزهراني, 1012345678, 10"
 * "أحمد محمد الزهراني"
 */
export function parseBatchBeneficiaryLines(
  rawText: string
): PdBeneficiaryParticipant[] {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line, idx) => {
    const parts = line
      .split(/[-|،,;\t]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const name = parts[0] || line;
    const rawId = parts[1] || '';
    const nationalId = rawId.replace(/[٠-٩]/g, (d) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    );
    const hoursCount = parts[2] || '';
    return {
      id: createEntityId(`ben_${idx + 1}`),
      name,
      nationalId,
      hoursCount,
    };
  });
}

// ============================================================================
// 4. Engine 03: Program Evaluation Form (Page 5 — LITERAL & ZERO EXTRA STATS)
// ============================================================================

export type PdEvaluationRating = 'high' | 'medium' | 'low' | 'disagree' | '';

export interface PdEvaluationItemMeta {
  index: number;
  id: string;
  label: string;
}

export function getPdEvaluationItems(
  gender?: UserGender
): PdEvaluationItemMeta[] {
  const traineesNoun = gender === 'female' ? 'المتدربات' : 'المتدربين';
  return [
    { index: 1, id: 'item_1', label: 'وضوح أهداف البرنامج' },
    { index: 2, id: 'item_2', label: 'شمولية المادة العلمية للبرنامج' },
    { index: 3, id: 'item_3', label: 'مناسبة الوقت المخصص للبرنامج' },
    { index: 4, id: 'item_4', label: 'مناسبة الأساليب لمحتوى البرنامج' },
    { index: 5, id: 'item_5', label: 'تنوع أساليب التدريب' },
    { index: 6, id: 'item_6', label: 'تنوع النشاطات بين النظري والعملي' },
    { index: 7, id: 'item_7', label: `ارتباط التطبيقات بطبيعة عمل ${traineesNoun}` },
    { index: 8, id: 'item_8', label: 'تنوع أساليب التقويم' },
    { index: 9, id: 'item_9', label: 'التمكن من المادة العلمية' },
    { index: 10, id: 'item_10', label: 'القدرة على توصيل المعلومات' },
    { index: 11, id: 'item_11', label: 'توفير عنصر التشويق في العرض' },
    { index: 12, id: 'item_12', label: 'القدرة على الحوار وإدارة النقاش' },
    { index: 13, id: 'item_13', label: 'مناسبة توقيت عقد البرنامج التدريبي' },
    { index: 14, id: 'item_14', label: 'توفر الوسائل التدريبية المناسبة' },
    {
      index: 15,
      id: 'item_15',
      label: 'توفر الشروط الصحية الملائمة في قاعة التدريب (كالتهيئة والإضاءة.....)',
    },
  ];
}

export const PD_EVALUATION_ITEMS: PdEvaluationItemMeta[] =
  getPdEvaluationItems('male');

export const PD_EVALUATION_OPTIONS: Array<{
  value: Exclude<PdEvaluationRating, ''>;
  shortLabel: string;
  fullLabel: string;
}> = [
  { value: 'high', shortLabel: 'عالية', fullLabel: 'أوافق بدرجة عالية' },
  { value: 'medium', shortLabel: 'متوسطة', fullLabel: 'أوافق بدرجة متوسطة' },
  { value: 'low', shortLabel: 'منخفضة', fullLabel: 'أوافق بدرجة منخفضة' },
  { value: 'disagree', shortLabel: 'لا أوافق', fullLabel: 'لا أوافق' },
];

export interface PdEvaluationItemAnswer {
  itemId: string;
  rating: PdEvaluationRating;
  disagreeReason: string;
}

export interface PdProgramEvaluationRecord {
  id: string;
  sourceProgramId?: string;
  programName: string;
  targetAudience: string;
  targetCount: string;
  executionDate: string;
  executionLocation: string;
  trainerName: string;
  traineeLabel: string; // Optional administrative identifier for which trainee submitted
  responses: PdEvaluationItemAnswer[];
  positives: string; // أبرز الإيجابيات
  challenges: string; // أبرز التحديات
  createdAt: string;
  updatedAt: string;
}

export function createEmptyEvaluationResponses(): PdEvaluationItemAnswer[] {
  return PD_EVALUATION_ITEMS.map((item) => ({
    itemId: item.id,
    rating: '',
    disagreeReason: '',
  }));
}

export function createProgramEvaluationRecord(
  partial?: Partial<PdProgramEvaluationRecord>
): PdProgramEvaluationRecord {
  const now = new Date().toISOString();
  const baseResponses = createEmptyEvaluationResponses();
  if (partial?.responses && Array.isArray(partial.responses)) {
    const byId = new Map(partial.responses.map((r) => [r.itemId, r]));
    for (let i = 0; i < baseResponses.length; i++) {
      const hit = byId.get(baseResponses[i].itemId);
      if (hit) {
        baseResponses[i] = {
          itemId: baseResponses[i].itemId,
          rating: hit.rating || '',
          disagreeReason: hit.disagreeReason || '',
        };
      }
    }
  }

  return {
    id: partial?.id || createEntityId('eval'),
    sourceProgramId: partial?.sourceProgramId,
    programName: partial?.programName || '',
    targetAudience: partial?.targetAudience || '',
    targetCount: partial?.targetCount || '',
    executionDate: partial?.executionDate || '',
    executionLocation: partial?.executionLocation || '',
    trainerName: partial?.trainerName || '',
    traineeLabel: partial?.traineeLabel || '',
    responses: baseResponses,
    positives: partial?.positives || '',
    challenges: partial?.challenges || '',
    createdAt: partial?.createdAt || now,
    updatedAt: partial?.updatedAt || now,
  };
}

export function createEvaluationFromExecutedProgram(
  program: PdExecutedProgramEntry,
  traineeLabel = ''
): PdProgramEvaluationRecord {
  return createProgramEvaluationRecord({
    sourceProgramId: program.id,
    programName: program.programName,
    targetAudience: program.targetAudience,
    targetCount:
      program.traineesCount ||
      (program.beneficiaries.length > 0
        ? String(program.beneficiaries.length)
        : ''),
    executionDate: program.executionDate,
    executionLocation: program.executionLocation,
    trainerName: program.trainerName,
    traineeLabel,
  });
}

// ============================================================================
// 5. Engine 04: Quarterly School PD Hours Report (Page 6 — AUTO-DERIVED)
// ============================================================================

export interface PdQuarterlyVesselSummaryRow {
  id: string;
  vesselTypeLabel: string;
  programTitle: string;
  executionDate: string;
  beneficiariesCount: number;
  hoursCount: number;
  source: 'execution-report' | 'general-plan';
}

export interface PdQuarterlyBeneficiarySummaryRow {
  id: string;
  name: string;
  nationalId: string;
  totalHours: number;
}

export interface PdQuarterlyHoursManualBeneficiary {
  id: string;
  name: string;
  nationalId: string;
  hoursCount: string;
}

export interface PdQuarterlyHoursConfig {
  manualExtraBeneficiaries: PdQuarterlyHoursManualBeneficiary[];
}

export interface PdQuarterlyHoursDerivedReport {
  vesselRows: PdQuarterlyVesselSummaryRow[];
  beneficiaryRows: PdQuarterlyBeneficiarySummaryRow[];
  totalSchoolHours: number;
}

function normalizeLookupText(val: string): string {
  return (val || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeNationalIdDigits(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D+/g, '');
}

/**
 * Automatically derives the Page 6 Quarterly Hours Report from:
 * - Engine 02 (`executionReport.programs` + registered beneficiaries)
 * - Engine 01 (`generalPlan.vessels` rows marked 'executed' not already represented in Engine 02)
 * - Optional extra manual beneficiary entries configured on the period
 * Zero duplicate entry required.
 */
export function deriveQuarterlyHoursReport(
  period: PdAcademicPeriodRecord,
  gender?: UserGender
): PdQuarterlyHoursDerivedReport {
  const vesselRows: PdQuarterlyVesselSummaryRow[] = [];
  const seenProgramKeys = new Set<string>();
  const fallbackBeneficiaryName = gender === 'female' ? 'مستفيدة' : 'مستفيد';

  // Beneficiary map keyed by normalized nationalId (if >= 5 digits) or normalized name
  const beneficiaryTotals = new Map<
    string,
    { name: string; nationalId: string; totalHours: number }
  >();

  const addBeneficiaryHours = (
    nameRaw: string,
    idRaw: string,
    hoursToAdd: number
  ) => {
    const cleanName = (nameRaw || '').trim();
    const cleanId = normalizeNationalIdDigits(idRaw);
    if (!cleanName && !cleanId) return;

    const mapKey =
      cleanId.length >= 5
        ? `id:${cleanId}`
        : `name:${normalizeLookupText(cleanName)}`;

    const existing = beneficiaryTotals.get(mapKey);
    if (existing) {
      if (!existing.name && cleanName) existing.name = cleanName;
      if (!existing.nationalId && cleanId) existing.nationalId = cleanId;
      existing.totalHours =
        Math.round((existing.totalHours + hoursToAdd) * 100) / 100;
    } else {
      beneficiaryTotals.set(mapKey, {
        name: cleanName || fallbackBeneficiaryName,
        nationalId: cleanId,
        totalHours: Math.round(hoursToAdd * 100) / 100,
      });
    }
  };

  // 1. Executed Programs from Engine 02
  for (const prog of period.executionReport.programs) {
    const title = prog.programName.trim();
    const vessel = prog.vesselType.trim();
    const date = prog.executionDate.trim();
    const hrs = parsePositiveHours(prog.hoursCount);
    const registeredBenCount = prog.beneficiaries.filter(
      (b) => b.name.trim() || b.nationalId.trim()
    ).length;
    const numericTrainees = Math.round(parsePositiveHours(prog.traineesCount));
    const benCount =
      registeredBenCount > 0 ? registeredBenCount : numericTrainees;

    const hasAnyContent = Boolean(title || vessel || date || hrs > 0 || benCount > 0);
    if (!hasAnyContent) continue;

    if (title) {
      seenProgramKeys.add(normalizeLookupText(title));
    }

    vesselRows.push({
      id: `qr_exec_${prog.id}`,
      vesselTypeLabel: vessel || title || 'برنامج تطوير مهني',
      programTitle: title,
      executionDate: date,
      beneficiariesCount: benCount,
      hoursCount: hrs,
      source: 'execution-report',
    });

    for (const ben of prog.beneficiaries) {
      if (!ben.name.trim() && !ben.nationalId.trim()) continue;
      const customHrs = parsePositiveHours(ben.hoursCount);
      const effectiveHrs = customHrs > 0 ? customHrs : hrs;
      addBeneficiaryHours(ben.name, ben.nationalId, effectiveHrs);
    }
  }

  // 2. Executed rows from Engine 01 not duplicated in Engine 02
  for (const vessel of period.generalPlan.vessels) {
    const vName = vessel.vesselName.trim();
    for (const row of vessel.rows) {
      if (row.executionStatus !== 'executed') continue;
      const topic = row.topic.trim();
      const hrs = parsePositiveHours(row.hoursCount);
      const date = row.executionDate.trim();
      if (!topic && hrs <= 0) continue;

      if (topic && seenProgramKeys.has(normalizeLookupText(topic))) {
        continue;
      }

      vesselRows.push({
        id: `qr_plan_${row.id}`,
        vesselTypeLabel: vName || topic || 'نشاط تطوير مهني',
        programTitle: topic,
        executionDate: date,
        beneficiariesCount: 0,
        hoursCount: hrs,
        source: 'general-plan',
      });
    }
  }

  // 3. Optional extra manual beneficiary entries
  for (const extra of period.quarterlyConfig.manualExtraBeneficiaries) {
    const hrs = parsePositiveHours(extra.hoursCount);
    if (!extra.name.trim() && !extra.nationalId.trim()) continue;
    addBeneficiaryHours(extra.name, extra.nationalId, hrs);
  }

  const beneficiaryRows: PdQuarterlyBeneficiarySummaryRow[] = Array.from(
    beneficiaryTotals.entries()
  ).map(([key, item]) => ({
    id: key,
    name: item.name,
    nationalId: item.nationalId,
    totalHours: item.totalHours,
  }));

  const vesselsHoursSum = vesselRows.reduce((s, r) => s + r.hoursCount, 0);
  const beneficiariesHoursSum = beneficiaryRows.reduce(
    (s, r) => s + r.totalHours,
    0
  );

  // Total PD hours achieved by school staff is the sum of beneficiary hours if beneficiaries are recorded,
  // or sum of executed vessel hours when only vessel summaries were entered.
  const totalSchoolHours =
    Math.round(
      (beneficiaryRows.length > 0 ? beneficiariesHoursSum : vesselsHoursSum) * 100
    ) / 100;

  return {
    vesselRows,
    beneficiaryRows,
    totalSchoolHours,
  };
}

// ============================================================================
// 6. Period Store & Historical Archive Support (Isolated from Central Settings)
// ============================================================================

export interface PdAcademicPeriodRecord {
  periodKey: string; // `${academicYear}::${semester}`
  academicYear: string;
  semester: ApprovedSchoolSemester; // 'الفصل الدراسي الأول' | 'الفصل الدراسي الثاني'
  schoolStages: SchoolStageCode[];
  generalPlan: PdGeneralPlanData;
  executionReport: PdExecutionReportData;
  evaluations: PdProgramEvaluationRecord[];
  quarterlyConfig: PdQuarterlyHoursConfig;
  updatedAt: string;
}

export interface PdUnitStore {
  version: number;
  activeAcademicYear: string;
  activeSemester: ApprovedSchoolSemester;
  periods: Record<string, PdAcademicPeriodRecord>;
  updatedAt: string;
}

export function createEntityId(prefix = 'pd'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function buildPdPeriodKey(
  academicYear: string,
  semester: ApprovedSchoolSemester
): string {
  return `${normalizeAcademicYearKey(academicYear)}::${normalizeApprovedSemester(semester)}`;
}

export function createPdAcademicPeriodRecord(
  academicYear: string,
  semester: ApprovedSchoolSemester
): PdAcademicPeriodRecord {
  const cleanYear = normalizeAcademicYearKey(academicYear);
  const cleanSemester = normalizeApprovedSemester(semester);
  return {
    periodKey: buildPdPeriodKey(cleanYear, cleanSemester),
    academicYear: cleanYear,
    semester: cleanSemester,
    schoolStages: [],
    generalPlan: createDefaultGeneralPlanData(),
    executionReport: createDefaultExecutionReportData(),
    evaluations: [],
    quarterlyConfig: { manualExtraBeneficiaries: [] },
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialPdUnitStore(
  centralSettings?: Partial<SchoolSettings>
): PdUnitStore {
  const initialYear = normalizeAcademicYearKey(
    centralSettings?.academicYear || DEFAULT_PD_ACADEMIC_YEAR
  );
  const initialSemester = normalizeApprovedSemester(
    centralSettings?.semester || DEFAULT_SCHOOL_SETTINGS.semester
  );

  const initialPeriod = createPdAcademicPeriodRecord(
    initialYear,
    initialSemester
  );

  return {
    version: 1,
    activeAcademicYear: initialYear,
    activeSemester: initialSemester,
    periods: {
      [initialPeriod.periodKey]: initialPeriod,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function getOrCreatePeriodRecord(
  store: PdUnitStore,
  academicYear: string,
  semester: ApprovedSchoolSemester
): { store: PdUnitStore; period: PdAcademicPeriodRecord } {
  const cleanYear = normalizeAcademicYearKey(academicYear);
  const cleanSem = normalizeApprovedSemester(semester);
  const key = buildPdPeriodKey(cleanYear, cleanSem);
  const existing = store.periods[key];
  if (existing) {
    return { store, period: existing };
  }
  const created = createPdAcademicPeriodRecord(cleanYear, cleanSem);
  const nextStore: PdUnitStore = {
    ...store,
    periods: {
      ...store.periods,
      [key]: created,
    },
    updatedAt: new Date().toISOString(),
  };
  return { store: nextStore, period: created };
}

export function switchPdActivePeriod(
  store: PdUnitStore,
  academicYear: string,
  semester: ApprovedSchoolSemester
): PdUnitStore {
  const cleanYear = normalizeAcademicYearKey(academicYear);
  const cleanSem = normalizeApprovedSemester(semester);
  const { store: ensured } = getOrCreatePeriodRecord(store, cleanYear, cleanSem);
  return {
    ...ensured,
    activeAcademicYear: cleanYear,
    activeSemester: cleanSem,
    updatedAt: new Date().toISOString(),
  };
}

export function updatePeriodRecord(
  store: PdUnitStore,
  academicYear: string,
  semester: ApprovedSchoolSemester,
  updater: (prev: PdAcademicPeriodRecord) => PdAcademicPeriodRecord
): PdUnitStore {
  const cleanYear = normalizeAcademicYearKey(academicYear);
  const cleanSem = normalizeApprovedSemester(semester);
  const { store: ensured, period } = getOrCreatePeriodRecord(
    store,
    cleanYear,
    cleanSem
  );
  const nextPeriod: PdAcademicPeriodRecord = {
    ...updater(period),
    periodKey: buildPdPeriodKey(cleanYear, cleanSem),
    academicYear: cleanYear,
    semester: cleanSem,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...ensured,
    periods: {
      ...ensured.periods,
      [nextPeriod.periodKey]: nextPeriod,
    },
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 7. Sanitization & LocalStorage Persistence
// ============================================================================

function sanitizeString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function sanitizePeriodRecord(
  raw: unknown,
  fallbackYear: string,
  fallbackSem: ApprovedSchoolSemester
): PdAcademicPeriodRecord {
  const base = createPdAcademicPeriodRecord(fallbackYear, fallbackSem);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  const year = sanitizeString(obj.academicYear) || fallbackYear;
  const sem = normalizeApprovedSemester(
    typeof obj.semester === 'string' ? obj.semester : fallbackSem
  );

  const stagesRaw = Array.isArray(obj.schoolStages) ? obj.schoolStages : [];
  const schoolStages = stagesRaw.filter(
    (s): s is SchoolStageCode => s === 'ب' || s === 'م' || s === 'ث'
  );

  // Sanitize Engine 01
  const gpRaw =
    obj.generalPlan && typeof obj.generalPlan === 'object'
      ? (obj.generalPlan as Record<string, unknown>)
      : {};
  const vesselsRaw = Array.isArray(gpRaw.vessels) ? gpRaw.vessels : [];
  const vessels: PdPlanVessel[] =
    vesselsRaw.length > 0
      ? vesselsRaw.map((v, vIdx) => {
          const vo = (v && typeof v === 'object' ? v : {}) as Record<
            string,
            unknown
          >;
          const rowsRaw = Array.isArray(vo.rows) ? vo.rows : [];
          const rows: PdPlanTopicRow[] =
            rowsRaw.length > 0
              ? rowsRaw.map((r, rIdx) => {
                  const ro = (r && typeof r === 'object' ? r : {}) as Record<
                    string,
                    unknown
                  >;
                  const statusRaw = ro.executionStatus;
                  const executionStatus: PlanExecutionStatus =
                    statusRaw === 'executed' || statusRaw === 'not_executed'
                      ? statusRaw
                      : 'pending';
                  return {
                    id: sanitizeString(ro.id) || `row_${vIdx + 1}_${rIdx + 1}`,
                    topic: sanitizeString(ro.topic),
                    presenterName: sanitizeString(ro.presenterName),
                    specialization: sanitizeString(ro.specialization),
                    executionDate: sanitizeString(ro.executionDate),
                    hoursCount: sanitizeString(ro.hoursCount),
                    executionLocation: sanitizeString(ro.executionLocation),
                    executionStatus,
                    notExecutedReason: sanitizeString(ro.notExecutedReason),
                  };
                })
              : [createEmptyPlanTopicRow()];
          return {
            id: sanitizeString(vo.id) || `vessel_${vIdx + 1}`,
            vesselName: sanitizeString(vo.vesselName),
            rows,
          };
        })
      : base.generalPlan.vessels;

  // Sanitize Engine 02
  const erRaw =
    obj.executionReport && typeof obj.executionReport === 'object'
      ? (obj.executionReport as Record<string, unknown>)
      : {};
  const trainersRaw = Array.isArray(erRaw.trainers) ? erRaw.trainers : [];
  const trainers: PdTrainerEntry[] =
    trainersRaw.length > 0
      ? trainersRaw.map((t, idx) => {
          const to = (t && typeof t === 'object' ? t : {}) as Record<
            string,
            unknown
          >;
          return {
            id: sanitizeString(to.id) || `trainer_${idx + 1}`,
            name: sanitizeString(to.name),
            nationalId: sanitizeString(to.nationalId),
            mobile: sanitizeString(to.mobile),
            qualification: sanitizeString(to.qualification),
          };
        })
      : base.executionReport.trainers;

  const programsRaw = Array.isArray(erRaw.programs) ? erRaw.programs : [];
  const programs: PdExecutedProgramEntry[] =
    programsRaw.length > 0
      ? programsRaw.map((p, idx) => {
          const po = (p && typeof p === 'object' ? p : {}) as Record<
            string,
            unknown
          >;
          const bensRaw = Array.isArray(po.beneficiaries)
            ? po.beneficiaries
            : [];
          const beneficiaries: PdBeneficiaryParticipant[] = bensRaw.map(
            (b, bIdx) => {
              const bo = (b && typeof b === 'object' ? b : {}) as Record<
                string,
                unknown
              >;
              return {
                id: sanitizeString(bo.id) || `ben_${idx + 1}_${bIdx + 1}`,
                name: sanitizeString(bo.name),
                nationalId: sanitizeString(bo.nationalId),
                hoursCount: sanitizeString(bo.hoursCount),
              };
            }
          );
          const photosRaw = Array.isArray(po.evidencePhotos)
            ? po.evidencePhotos
            : [];
          const evidencePhotos: PdEvidencePhotoRef[] = photosRaw
            .map((ph, phIdx) => {
              const pho = (ph && typeof ph === 'object' ? ph : {}) as Record<
                string,
                unknown
              >;
              const blobKey = sanitizeString(pho.blobKey);
              if (!blobKey) return null;
              return {
                id: sanitizeString(pho.id) || `photo_${idx + 1}_${phIdx + 1}`,
                blobKey,
                title: sanitizeString(pho.title) || `شاهد تنفيذ ${phIdx + 1}`,
                mimeType: sanitizeString(pho.mimeType) || 'image/jpeg',
                createdAt:
                  sanitizeString(pho.createdAt) || new Date().toISOString(),
              };
            })
            .filter((x): x is PdEvidencePhotoRef => Boolean(x));

          return {
            id: sanitizeString(po.id) || `prog_${idx + 1}`,
            programName: sanitizeString(po.programName),
            daysCount: sanitizeString(po.daysCount),
            hoursCount: sanitizeString(po.hoursCount),
            traineesCount: sanitizeString(po.traineesCount),
            trainerName: sanitizeString(po.trainerName),
            vesselType: sanitizeString(po.vesselType),
            executionDate: sanitizeString(po.executionDate),
            executionLocation: sanitizeString(po.executionLocation),
            targetAudience: sanitizeString(po.targetAudience),
            beneficiaries,
            evidencePhotos,
          };
        })
      : base.executionReport.programs;

  // Sanitize Engine 03
  const evalsRaw = Array.isArray(obj.evaluations) ? obj.evaluations : [];
  const evaluations: PdProgramEvaluationRecord[] = evalsRaw.map((ev) => {
    const eo = (ev && typeof ev === 'object' ? ev : {}) as Record<
      string,
      unknown
    >;
    const respRaw = Array.isArray(eo.responses) ? eo.responses : [];
    const responses: PdEvaluationItemAnswer[] = respRaw.map((r) => {
      const ro = (r && typeof r === 'object' ? r : {}) as Record<
        string,
        unknown
      >;
      const rat = ro.rating;
      const rating: PdEvaluationRating =
        rat === 'high' ||
        rat === 'medium' ||
        rat === 'low' ||
        rat === 'disagree'
          ? rat
          : '';
      return {
        itemId: sanitizeString(ro.itemId),
        rating,
        disagreeReason: sanitizeString(ro.disagreeReason),
      };
    });
    return createProgramEvaluationRecord({
      id: sanitizeString(eo.id) || undefined,
      sourceProgramId: sanitizeString(eo.sourceProgramId) || undefined,
      programName: sanitizeString(eo.programName),
      targetAudience: sanitizeString(eo.targetAudience),
      targetCount: sanitizeString(eo.targetCount),
      executionDate: sanitizeString(eo.executionDate),
      executionLocation: sanitizeString(eo.executionLocation),
      trainerName: sanitizeString(eo.trainerName),
      traineeLabel: sanitizeString(eo.traineeLabel),
      responses,
      positives: sanitizeString(eo.positives),
      challenges: sanitizeString(eo.challenges),
      createdAt: sanitizeString(eo.createdAt) || undefined,
      updatedAt: sanitizeString(eo.updatedAt) || undefined,
    });
  });

  // Sanitize Quarterly manual extra beneficiaries
  const qcRaw =
    obj.quarterlyConfig && typeof obj.quarterlyConfig === 'object'
      ? (obj.quarterlyConfig as Record<string, unknown>)
      : {};
  const extraRaw = Array.isArray(qcRaw.manualExtraBeneficiaries)
    ? qcRaw.manualExtraBeneficiaries
    : [];
  const manualExtraBeneficiaries: PdQuarterlyHoursManualBeneficiary[] =
    extraRaw.map((m, idx) => {
      const mo = (m && typeof m === 'object' ? m : {}) as Record<
        string,
        unknown
      >;
      return {
        id: sanitizeString(mo.id) || `extra_ben_${idx + 1}`,
        name: sanitizeString(mo.name),
        nationalId: sanitizeString(mo.nationalId),
        hoursCount: sanitizeString(mo.hoursCount),
      };
    });

  return {
    periodKey: buildPdPeriodKey(year, sem),
    academicYear: year,
    semester: sem,
    schoolStages,
    generalPlan: {
      vessels,
      coordinatorAuthName: sanitizeString(gpRaw.coordinatorAuthName),
      principalAuthName: sanitizeString(gpRaw.principalAuthName),
    },
    executionReport: {
      stageLabel: sanitizeString(erRaw.stageLabel),
      totalTeachersCount: sanitizeString(erRaw.totalTeachersCount),
      participatingTeachersCount: sanitizeString(
        erRaw.participatingTeachersCount
      ),
      trainers,
      programs,
      coordinatorAuthName: sanitizeString(erRaw.coordinatorAuthName),
      principalAuthName: sanitizeString(erRaw.principalAuthName),
    },
    evaluations,
    quarterlyConfig: { manualExtraBeneficiaries },
    updatedAt: sanitizeString(obj.updatedAt) || base.updatedAt,
  };
}

export function sanitizePdStore(
  raw: unknown,
  centralSettings?: Partial<SchoolSettings>
): PdUnitStore {
  const initial = createInitialPdUnitStore(centralSettings);
  if (!raw || typeof raw !== 'object') return initial;
  const obj = raw as Record<string, unknown>;

  const activeAcademicYear = normalizeAcademicYearKey(
    typeof obj.activeAcademicYear === 'string'
      ? obj.activeAcademicYear
      : initial.activeAcademicYear
  );
  const activeSemester = normalizeApprovedSemester(
    typeof obj.activeSemester === 'string'
      ? obj.activeSemester
      : initial.activeSemester
  );

  const periods: Record<string, PdAcademicPeriodRecord> = {};
  if (obj.periods && typeof obj.periods === 'object') {
    for (const [key, val] of Object.entries(
      obj.periods as Record<string, unknown>
    )) {
      const parts = key.split('::');
      const y = normalizeAcademicYearKey(parts[0] || activeAcademicYear);
      const s = normalizeApprovedSemester(parts[1] || activeSemester);
      const p = sanitizePeriodRecord(val, y, s);
      periods[p.periodKey] = p;
    }
  }

  const activeKey = buildPdPeriodKey(activeAcademicYear, activeSemester);
  if (!periods[activeKey]) {
    periods[activeKey] = createPdAcademicPeriodRecord(
      activeAcademicYear,
      activeSemester
    );
  }

  return {
    version: 1,
    activeAcademicYear,
    activeSemester,
    periods,
    updatedAt: sanitizeString(obj.updatedAt) || new Date().toISOString(),
  };
}

export interface PdStorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function loadPdUnitStore(
  storage?: PdStorageAdapter | null,
  centralSettings?: Partial<SchoolSettings>
): PdUnitStore {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : null;

  if (!targetStorage) return createInitialPdUnitStore(centralSettings);
  try {
    const raw = targetStorage.getItem(PD_UNIT_STORAGE_KEY);
    if (!raw) return createInitialPdUnitStore(centralSettings);
    const parsed = JSON.parse(raw);
    return sanitizePdStore(parsed, centralSettings);
  } catch {
    return createInitialPdUnitStore(centralSettings);
  }
}

export function savePdUnitStore(
  store: PdUnitStore,
  storage?: PdStorageAdapter | null
): void {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : null;
  if (!targetStorage) return;
  try {
    targetStorage.setItem(PD_UNIT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors safely
  }
}

// ============================================================================
// 8. IndexedDB Attachment Repository (Execution Photos in Engine 02)
// ============================================================================

export interface PdStoredAttachment {
  blobKey: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt: string;
}

export interface PdAttachmentRepository {
  saveAttachment: (item: PdStoredAttachment) => Promise<void>;
  getAttachment: (blobKey: string) => Promise<PdStoredAttachment | null>;
  deleteAttachment: (blobKey: string) => Promise<void>;
  listAttachments: () => Promise<PdStoredAttachment[]>;
  clearAll: () => Promise<void>;
}

export function createMemoryPdAttachmentRepository(): PdAttachmentRepository {
  const map = new Map<string, PdStoredAttachment>();
  return {
    async saveAttachment(item) {
      map.set(item.blobKey, {
        ...item,
        bytes: new Uint8Array(item.bytes),
      });
    },
    async getAttachment(blobKey) {
      const hit = map.get(blobKey);
      return hit
        ? { ...hit, bytes: new Uint8Array(hit.bytes) }
        : null;
    },
    async deleteAttachment(blobKey) {
      map.delete(blobKey);
    },
    async listAttachments() {
      return Array.from(map.values()).map((a) => ({
        ...a,
        bytes: new Uint8Array(a.bytes),
      }));
    },
    async clearAll() {
      map.clear();
    },
  };
}

let cachedIndexedDbRepo: PdAttachmentRepository | null = null;
const memoryFallbackRepo = createMemoryPdAttachmentRepository();

function openPdIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(PD_EVIDENCE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PD_EVIDENCE_OBJECT_STORE)) {
        db.createObjectStore(PD_EVIDENCE_OBJECT_STORE, { keyPath: 'blobKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export function getDefaultPdAttachmentRepository(): PdAttachmentRepository {
  if (typeof indexedDB === 'undefined') {
    return memoryFallbackRepo;
  }
  if (cachedIndexedDbRepo) return cachedIndexedDbRepo;

  cachedIndexedDbRepo = {
    async saveAttachment(item) {
      try {
        const db = await openPdIndexedDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(PD_EVIDENCE_OBJECT_STORE, 'readwrite');
          tx.objectStore(PD_EVIDENCE_OBJECT_STORE).put({
            blobKey: item.blobKey,
            mimeType: item.mimeType,
            bytes: item.bytes.buffer.slice(
              item.bytes.byteOffset,
              item.bytes.byteOffset + item.bytes.byteLength
            ),
            createdAt: item.createdAt,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        await memoryFallbackRepo.saveAttachment(item);
      }
    },
    async getAttachment(blobKey) {
      try {
        const db = await openPdIndexedDb();
        const raw = await new Promise<Record<string, unknown> | undefined>(
          (resolve, reject) => {
            const tx = db.transaction(PD_EVIDENCE_OBJECT_STORE, 'readonly');
            const req = tx.objectStore(PD_EVIDENCE_OBJECT_STORE).get(blobKey);
            req.onsuccess = () =>
              resolve(req.result as Record<string, unknown> | undefined);
            req.onerror = () => reject(req.error);
          }
        );
        if (!raw) return await memoryFallbackRepo.getAttachment(blobKey);
        const buf = raw.bytes;
        const bytes =
          buf instanceof ArrayBuffer
            ? new Uint8Array(buf)
            : buf instanceof Uint8Array
            ? new Uint8Array(buf)
            : new Uint8Array(0);
        return {
          blobKey: String(raw.blobKey || blobKey),
          mimeType: String(raw.mimeType || 'image/jpeg'),
          bytes,
          createdAt: String(raw.createdAt || ''),
        };
      } catch {
        return await memoryFallbackRepo.getAttachment(blobKey);
      }
    },
    async deleteAttachment(blobKey) {
      try {
        const db = await openPdIndexedDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(PD_EVIDENCE_OBJECT_STORE, 'readwrite');
          tx.objectStore(PD_EVIDENCE_OBJECT_STORE).delete(blobKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // ignore
      }
      await memoryFallbackRepo.deleteAttachment(blobKey);
    },
    async listAttachments() {
      try {
        const db = await openPdIndexedDb();
        const rows = await new Promise<Record<string, unknown>[]>(
          (resolve, reject) => {
            const tx = db.transaction(PD_EVIDENCE_OBJECT_STORE, 'readonly');
            const req = tx.objectStore(PD_EVIDENCE_OBJECT_STORE).getAll();
            req.onsuccess = () =>
              resolve((req.result as Record<string, unknown>[]) || []);
            req.onerror = () => reject(req.error);
          }
        );
        return rows.map((raw) => {
          const buf = raw.bytes;
          const bytes =
            buf instanceof ArrayBuffer
              ? new Uint8Array(buf)
              : buf instanceof Uint8Array
              ? new Uint8Array(buf)
              : new Uint8Array(0);
          return {
            blobKey: String(raw.blobKey || ''),
            mimeType: String(raw.mimeType || 'image/jpeg'),
            bytes,
            createdAt: String(raw.createdAt || ''),
          };
        });
      } catch {
        return await memoryFallbackRepo.listAttachments();
      }
    },
    async clearAll() {
      try {
        const db = await openPdIndexedDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(PD_EVIDENCE_OBJECT_STORE, 'readwrite');
          tx.objectStore(PD_EVIDENCE_OBJECT_STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // ignore
      }
      await memoryFallbackRepo.clearAll();
    },
  };
  return cachedIndexedDbRepo;
}

// ============================================================================
// 9. Full ZIP Backup & Restore for PD Unit (Data + Archives + Photos)
// ============================================================================

interface PdBackupManifest {
  format: 'maktabi-pd-unit-backup-v1';
  exportedAt: string;
  attachments: Array<{
    blobKey: string;
    mimeType: string;
    filename: string;
    createdAt: string;
  }>;
}

function extensionFromMimeType(mime: string): string {
  const lower = (mime || '').toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  return 'jpg';
}

export async function exportPdFullBackupZip(
  store: PdUnitStore,
  attachmentRepo: PdAttachmentRepository
): Promise<{ zipBytes: Uint8Array; filename: string; attachmentsCount: number }> {
  const attachments = await attachmentRepo.listAttachments();
  const manifestAttachments: PdBackupManifest['attachments'] = [];
  const entries: Array<{ filename: string; content: Uint8Array | string }> = [
    {
      filename: 'pd-store.json',
      content: JSON.stringify(store, null, 2),
    },
  ];

  attachments.forEach((att, idx) => {
    const ext = extensionFromMimeType(att.mimeType);
    const safeKey = sanitizeFilenameSegment(att.blobKey) || `att_${idx + 1}`;
    const entryName = `attachments/${safeKey}.${ext}`;
    manifestAttachments.push({
      blobKey: att.blobKey,
      mimeType: att.mimeType,
      filename: entryName,
      createdAt: att.createdAt,
    });
    entries.push({
      filename: entryName,
      content: att.bytes,
    });
  });

  const manifest: PdBackupManifest = {
    format: 'maktabi-pd-unit-backup-v1',
    exportedAt: new Date().toISOString(),
    attachments: manifestAttachments,
  };
  entries.unshift({
    filename: 'manifest.json',
    content: JSON.stringify(manifest, null, 2),
  });

  const zipBytes = createZipArchiveBytes(entries);
  const yearSeg = sanitizeFilenameSegment(store.activeAcademicYear) || 'pd';
  const filename = `نسخة_احتياطية_وحدة_التطوير_المهني_${yearSeg}.zip`;
  return { zipBytes, filename, attachmentsCount: manifestAttachments.length };
}

/**
 * Minimal PKZIP STORE reader for restoring PD unit backup archives.
 */
function parseStoreZipEntries(
  zipBytes: Uint8Array
): Map<string, Uint8Array> {
  const view = new DataView(
    zipBytes.buffer,
    zipBytes.byteOffset,
    zipBytes.byteLength
  );
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();

  let offset = 0;
  while (offset + 30 <= zipBytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > zipBytes.length) break;
    const name = decoder.decode(zipBytes.subarray(nameStart, nameEnd));
    files.set(name, zipBytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }
  return files;
}

export async function importAndRestorePdFullBackupZip(
  zipBytes: Uint8Array,
  attachmentRepo: PdAttachmentRepository,
  centralSettings?: Partial<SchoolSettings>
): Promise<{ store: PdUnitStore; restoredAttachmentsCount: number }> {
  const files = parseStoreZipEntries(zipBytes);
  const storeRawBytes = files.get('pd-store.json');
  if (!storeRawBytes) {
    throw new Error('ملف النسخة الاحتياطية لا يحتوي على بيانات وحدة التطوير المهني (pd-store.json).');
  }

  const decoder = new TextDecoder();
  const parsedStore = JSON.parse(decoder.decode(storeRawBytes));
  const sanitizedStore = sanitizePdStore(parsedStore, centralSettings);

  let restoredAttachmentsCount = 0;
  const manifestBytes = files.get('manifest.json');
  if (manifestBytes) {
    try {
      const manifest = JSON.parse(
        decoder.decode(manifestBytes)
      ) as PdBackupManifest;
      if (Array.isArray(manifest.attachments)) {
        await attachmentRepo.clearAll();
        for (const meta of manifest.attachments) {
          const content = files.get(meta.filename);
          if (content && meta.blobKey) {
            await attachmentRepo.saveAttachment({
              blobKey: meta.blobKey,
              mimeType: meta.mimeType || 'image/jpeg',
              bytes: content,
              createdAt: meta.createdAt || new Date().toISOString(),
            });
            restoredAttachmentsCount++;
          }
        }
      }
    } catch {
      // Ignore malformed attachment metadata safely while keeping store
    }
  }

  return { store: sanitizedStore, restoredAttachmentsCount };
}

// ============================================================================
// 10. Resolved Official Identity Helper (Reads Central Settings Safely)
// ============================================================================

export interface PdResolvedOfficialHeader {
  schoolName: string;
  educationDepartment: string;
  coordinatorTitle: string;
  coordinatorName: string;
  principalTitle: string;
  principalName: string;
  academicYear: string;
  semester: ApprovedSchoolSemester;
}

export function resolvePdOfficialHeader(
  period: PdAcademicPeriodRecord,
  settings: SchoolSettings
): PdResolvedOfficialHeader {
  const gendered = getGenderedLabels(settings.gender);
  const pdTerms = getPdGenderedTerms(settings.gender);
  const customRole = getRoleForSection(settings, 'professional-development');
  return {
    schoolName: settings.schoolName?.trim() || '................................',
    educationDepartment:
      settings.educationDepartment?.trim() || 'الإدارة العامة للتعليم',
    coordinatorTitle: customRole || pdTerms.coordinatorDefaultTitle,
    coordinatorName:
      settings.userName?.trim() || '................................',
    principalTitle: gendered.principalTitle,
    principalName:
      settings.principalName?.trim() || '................................',
    academicYear: period.academicYear || DEFAULT_PD_ACADEMIC_YEAR,
    semester: period.semester,
  };
}
