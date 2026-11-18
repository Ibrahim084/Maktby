import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { SchoolSettings } from '../types';
import {
  buildDefaultCertificateTexts,
  CertificateCategoryType,
  CertificateFormState,
  createInitialCertificateFormState,
  parseCertificateBeneficiaryNames,
} from './certificatesEngine';
import {
  deleteArchivedRecordSafely,
  inspectRecordDeletionImpact,
  LegacyMigrationCandidate,
  listArchivedRecords,
  loadGroupArchiveStore,
  RecordDeletionImpact,
  rollbackGroupMigration,
  runIdempotentGroupMigration,
  RunGroupMigrationSummary,
  SafeDeleteRecordResult,
  startNewBlankDraftInStore,
  StorageLike,
  TeacherArchiveRecord,
  TeacherGroupArchiveStore,
  upsertArchivedRecord,
  upsertDraftRecord,
} from './teacherArchiveEngine';
import {
  deleteBlobIfUnreferenced,
  getDefaultTeacherMediaRepository,
  TeacherMediaRepository,
  UnifiedMediaRef,
} from './teacherMediaStorage';

export const TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_certificates_archive_v1';

export const CERTIFICATES_LEGACY_DRAFT_KEY =
  'maktabi_certificates_section_draft_v1';

export const SCHOOL_CERTIFICATES_FORM_ID = 'school-certificates' as const;
export type TeacherCertificatesFormId = typeof SCHOOL_CERTIFICATES_FORM_ID;

const EXTERNAL_ARCHIVE_KEYS = [
  'maktabi_teacher_reports_archive_v1',
  'maktabi_teacher_plans_archive_v1',
  'maktabi_teacher_meetings_archive_v1',
  'maktabi_teacher_peer_visits_archive_v1',
  'maktabi_teacher_tests_eval_archive_v1',
  'maktabi_teacher_programs_activities_archive_v1',
] as const;

const CROSS_GROUP_ARCHIVE_KEYS = [
  ...EXTERNAL_ARCHIVE_KEYS,
  TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
] as const;

export type TeacherCertificatesArchiveStore =
  TeacherGroupArchiveStore<CertificateFormState>;

export type TeacherCertificateArchiveRecord =
  TeacherArchiveRecord<CertificateFormState>;

function resolveFullSettings(
  settings?: Partial<SchoolSettings>
): SchoolSettings {
  return {
    ...DEFAULT_SCHOOL_SETTINGS,
    ...settings,
    roles: {
      ...DEFAULT_SCHOOL_SETTINGS.roles,
      ...(settings?.roles || {}),
    },
  };
}

function resolveStorageSafe(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function normalizeCertificateFormState(
  raw: Partial<CertificateFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): CertificateFormState {
  const full = resolveFullSettings(settings);
  const fallback = createInitialCertificateFormState(full);
  if (!raw || typeof raw !== 'object') return fallback;

  const validTypes: readonly CertificateCategoryType[] = [
    'appreciation',
    'excellence',
    'graduation',
  ];
  const certificateType: CertificateCategoryType = validTypes.includes(
    raw.certificateType as CertificateCategoryType
  )
    ? (raw.certificateType as CertificateCategoryType)
    : fallback.certificateType;

  return {
    ...fallback,
    ...raw,
    certificateType,
    appreciationRole:
      raw.appreciationRole === 'teacher' ||
      raw.appreciationRole === 'admin' ||
      raw.appreciationRole === 'student'
        ? raw.appreciationRole
        : fallback.appreciationRole,
    excellenceVariant:
      raw.excellenceVariant === 'school-administration' ||
      raw.excellenceVariant === 'teacher'
        ? raw.excellenceVariant
        : fallback.excellenceVariant,
    language:
      raw.language === 'ar' || raw.language === 'en'
        ? raw.language
        : fallback.language,
    templateId:
      raw.templateId === '1' || raw.templateId === '2' || raw.templateId === '3'
        ? raw.templateId
        : fallback.templateId,
    colorSystemId:
      raw.colorSystemId === '1' ||
      raw.colorSystemId === '2' ||
      raw.colorSystemId === '3' ||
      raw.colorSystemId === '4'
        ? raw.colorSystemId
        : fallback.colorSystemId,
    recipientGender:
      raw.recipientGender === 'male' || raw.recipientGender === 'female'
        ? raw.recipientGender
        : fallback.recipientGender,
    educationDepartment: String(
      raw.educationDepartment ?? fallback.educationDepartment
    ),
    schoolName: String(raw.schoolName ?? fallback.schoolName),
    gradeName: String(raw.gradeName ?? fallback.gradeName),
    academicStage: String(raw.academicStage ?? fallback.academicStage),
    academicYear: String(raw.academicYear ?? fallback.academicYear),
    certificateTitle: String(raw.certificateTitle ?? fallback.certificateTitle),
    openingText: String(raw.openingText ?? fallback.openingText),
    beneficiariesInput: String(raw.beneficiariesInput ?? ''),
    mainText: String(raw.mainText ?? fallback.mainText),
    additionalText: String(raw.additionalText ?? fallback.additionalText),
    presenterTitle: String(raw.presenterTitle ?? fallback.presenterTitle),
    presenterName: String(raw.presenterName ?? ''),
    principalTitle: String(raw.principalTitle ?? fallback.principalTitle),
    principalName: String(raw.principalName ?? fallback.principalName),
    isPresenterSameAsPrincipal: Boolean(
      raw.isPresenterSameAsPrincipal ?? fallback.isPresenterSameAsPrincipal
    ),
  };
}

export function loadLegacyCertificateDraft(
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): CertificateFormState {
  const full = resolveFullSettings(settings);
  const fallback = createInitialCertificateFormState(full);
  const store = resolveStorageSafe(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(CERTIFICATES_LEGACY_DRAFT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CertificateFormState>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }
    return normalizeCertificateFormState(parsed, settings);
  } catch {
    return fallback;
  }
}

export interface CertificateDualStoreSyncErrorDetails {
  failedStore: 'archive' | 'legacy' | 'both' | 'divergence';
  rolledBackBoth: boolean;
  archiveRestored: boolean;
  legacyRestored: boolean;
  diverged: boolean;
  rollbackErrors?: string[];
}

export class CertificateDualStoreSyncError extends Error {
  readonly failedStore: 'archive' | 'legacy' | 'both' | 'divergence';
  readonly rolledBackBoth: boolean;
  readonly archiveRestored: boolean;
  readonly legacyRestored: boolean;
  readonly diverged: boolean;
  readonly rollbackErrors: string[];

  constructor(
    message: string,
    failedStoreOrDetails:
      | 'archive'
      | 'legacy'
      | 'both'
      | 'divergence'
      | CertificateDualStoreSyncErrorDetails,
    rolledBackBothFallback?: boolean
  ) {
    super(message);
    this.name = 'CertificateDualStoreSyncError';
    if (typeof failedStoreOrDetails === 'string') {
      const rb = Boolean(rolledBackBothFallback);
      this.failedStore = failedStoreOrDetails;
      this.rolledBackBoth = rb;
      this.archiveRestored = rb;
      this.legacyRestored = rb;
      this.diverged = !rb;
      this.rollbackErrors = [];
    } else {
      this.failedStore = failedStoreOrDetails.failedStore;
      this.rolledBackBoth = failedStoreOrDetails.rolledBackBoth;
      this.archiveRestored = failedStoreOrDetails.archiveRestored;
      this.legacyRestored = failedStoreOrDetails.legacyRestored;
      this.diverged = failedStoreOrDetails.diverged;
      this.rollbackErrors = failedStoreOrDetails.rollbackErrors ?? [];
    }
  }
}

function safeReadStorageKey(
  store: StorageLike,
  key: string
): { ok: boolean; value: string | null; error?: string } {
  try {
    return { ok: true, value: store.getItem(key) };
  } catch (err) {
    return {
      ok: false,
      value: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function restoreStorageKeyAndVerify(
  store: StorageLike,
  key: string,
  expectedPrevRaw: string | null
): { restored: boolean; error?: string } {
  let writeError: string | undefined;
  try {
    const current = store.getItem(key);
    if (current !== expectedPrevRaw) {
      if (expectedPrevRaw === null) {
        store.removeItem(key);
      } else {
        store.setItem(key, expectedPrevRaw);
      }
    }
  } catch (err) {
    writeError = err instanceof Error ? err.message : String(err);
  }

  const verified = safeReadStorageKey(store, key);
  if (!verified.ok) {
    return {
      restored: false,
      error:
        writeError ||
        verified.error ||
        `تعذر التحقق من استعادة المفتاح (${key})`,
    };
  }
  const matches = verified.value === expectedPrevRaw;
  if (!matches) {
    return {
      restored: false,
      error:
        writeError ||
        `القيمة المقروءة بعد التراجع في (${key}) لا تطابق النسخة السابقة.`,
    };
  }
  return { restored: true };
}

/**
 * Two-phase dual-store synchronization between the unified Group 7 archive store
 * and the legacy draft key with verified rollback reporting.
 * Note: Browser localStorage does NOT provide cross-key native atomicity;
 * if rollback itself fails, this helper explicitly marks `rolledBackBoth: false`
 * and `diverged: true` rather than claiming full atomicity or hiding mismatch.
 */
export function writeBothCertificateDraftStoresTransactionally(
  nextArchiveStore: TeacherCertificatesArchiveStore,
  legacyDraftData: CertificateFormState,
  storage?: StorageLike
): void {
  const store = resolveStorageSafe(storage);
  if (!store) return;

  const prevArchiveRaw = store.getItem(
    TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY
  );
  const prevLegacyRaw = store.getItem(CERTIFICATES_LEGACY_DRAFT_KEY);

  const nextArchiveJson = JSON.stringify({
    ...nextArchiveStore,
    updatedAt: new Date().toISOString(),
  });
  const nextLegacyJson = JSON.stringify(legacyDraftData);

  try {
    store.setItem(TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY, nextArchiveJson);
  } catch {
    const archiveCheck = restoreStorageKeyAndVerify(
      store,
      TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
      prevArchiveRaw
    );
    const legacyCheck = restoreStorageKeyAndVerify(
      store,
      CERTIFICATES_LEGACY_DRAFT_KEY,
      prevLegacyRaw
    );
    const rolledBackBoth = archiveCheck.restored && legacyCheck.restored;
    const rollbackErrors = [archiveCheck.error, legacyCheck.error].filter(
      (e): e is string => Boolean(e)
    );
    throw new CertificateDualStoreSyncError(
      rolledBackBoth
        ? 'تعذر حفظ بيانات الشهادة في مخزن الأرشيف الموحد؛ تم التراجع والتحقق من بقاء المخزنين على الحالة السابقة.'
        : 'تعذر حفظ بيانات الشهادة في مخزن الأرشيف الموحد وفشل التحقق من التراجع؛ يرجى مراجعة تنبيه تباين المخزنين.',
      {
        failedStore: 'archive',
        rolledBackBoth,
        archiveRestored: archiveCheck.restored,
        legacyRestored: legacyCheck.restored,
        diverged: !rolledBackBoth,
        rollbackErrors,
      }
    );
  }

  try {
    store.setItem(CERTIFICATES_LEGACY_DRAFT_KEY, nextLegacyJson);
  } catch {
    const archiveCheck = restoreStorageKeyAndVerify(
      store,
      TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
      prevArchiveRaw
    );
    const legacyCheck = restoreStorageKeyAndVerify(
      store,
      CERTIFICATES_LEGACY_DRAFT_KEY,
      prevLegacyRaw
    );
    const rolledBackBoth = archiveCheck.restored && legacyCheck.restored;
    const rollbackErrors = [archiveCheck.error, legacyCheck.error].filter(
      (e): e is string => Boolean(e)
    );
    throw new CertificateDualStoreSyncError(
      rolledBackBoth
        ? 'تعذر مزامنة مسودة الشهادة مع المفتاح التوافقي القديم؛ تم التراجع في المخزنين والتحقق من تطابق النسختين على الحالة السابقة.'
        : 'تعذر مزامنة مسودة الشهادة مع المفتاح التوافقي القديم كما تعذر التراجع في مخزن الأرشيف؛ تم تفعيل حماية عدم التطابق لمنع فقدان البيانات.',
      {
        failedStore: 'legacy',
        rolledBackBoth,
        archiveRestored: archiveCheck.restored,
        legacyRestored: legacyCheck.restored,
        diverged: !rolledBackBoth,
        rollbackErrors,
      }
    );
  }
}

// ============================================================================
// Beneficiary Parsing, Archive Validation & Factory-Empty Detection
// ============================================================================

export function isPlaceholderBeneficiaryName(name: string): boolean {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return true;
  if (trimmed === '—' || trimmed === '-') return true;
  if (/\.{2,}/.test(trimmed)) return true;
  if (trimmed.toLowerCase() === 'student name') return true;
  return false;
}

export function extractValidCertificateBeneficiaryNames(
  rawInput: string
): string[] {
  return parseCertificateBeneficiaryNames(rawInput)
    .map((n) => n.trim())
    .filter((n) => !isPlaceholderBeneficiaryName(n));
}

export function validateCertificateForArchive(
  state: Partial<CertificateFormState> | null | undefined
): string[] {
  const errors: string[] = [];
  if (!state) {
    return ['بيانات الشهادة غير متوفرة للحفظ في الأرشيف.'];
  }

  const validBeneficiaries = extractValidCertificateBeneficiaryNames(
    state.beneficiariesInput || ''
  );
  if (validBeneficiaries.length === 0) {
    errors.push(
      'يرجى إدخال اسم مستفيد حقيقي واحد على الأقل قبل حفظ الشهادة في الأرشيف.'
    );
  }

  if (!String(state.certificateTitle ?? '').trim()) {
    errors.push('يرجى إدخال عنوان الشهادة قبل الحفظ في الأرشيف.');
  }

  if (!String(state.mainText ?? '').trim()) {
    errors.push('يرجى إدخال النص الرئيسي للشهادة قبل الحفظ في الأرشيف.');
  }

  return errors;
}

export function isLegacyCertificateDraftEmpty(
  data: Partial<CertificateFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  if (!data || typeof data !== 'object') return true;
  const full = resolveFullSettings(settings);
  const normalized = normalizeCertificateFormState(data, full);

  const validBeneficiaries = extractValidCertificateBeneficiaryNames(
    normalized.beneficiariesInput
  );
  if (validBeneficiaries.length > 0) {
    return false;
  }

  if (normalized.presenterName.trim().length > 0) {
    return false;
  }

  const presenterGender = full.gender === 'female' ? 'female' : 'male';
  const expectedDefaults = buildDefaultCertificateTexts({
    certificateType: normalized.certificateType,
    appreciationRole: normalized.appreciationRole,
    excellenceVariant: normalized.excellenceVariant,
    language: normalized.language,
    recipientGender: normalized.recipientGender,
    presenterGender,
    schoolName: normalized.schoolName,
    gradeName: normalized.gradeName,
    academicStage: normalized.academicStage,
    academicYear: normalized.academicYear,
  });

  if (
    normalized.certificateTitle.trim() !==
    expectedDefaults.certificateTitle.trim()
  ) {
    return false;
  }
  if (normalized.openingText.trim() !== expectedDefaults.openingText.trim()) {
    return false;
  }
  if (normalized.mainText.trim() !== expectedDefaults.mainText.trim()) {
    return false;
  }
  if (
    normalized.additionalText.trim() !== expectedDefaults.additionalText.trim()
  ) {
    return false;
  }

  return true;
}

export function hasMeaningfulCertificateDraftData(
  data: Partial<CertificateFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  return !isLegacyCertificateDraftEmpty(data, settings);
}

// ============================================================================
// Titles, Subtypes & Summaries for Archive Cards
// ============================================================================

export function getCertificateTypeArabicLabel(
  certificateType: CertificateCategoryType
): string {
  if (certificateType === 'excellence') return 'شهادة تفوق';
  if (certificateType === 'graduation') return 'شهادة تخرج';
  return 'شهادة شكر وتقدير';
}

export function getCertificateSubtypeArabicLabel(
  data: Pick<
    CertificateFormState,
    'certificateType' | 'appreciationRole' | 'excellenceVariant'
  >
): string {
  if (data.certificateType === 'appreciation') {
    if (data.appreciationRole === 'teacher') return 'فئة المستفيد: معلم';
    if (data.appreciationRole === 'admin') return 'فئة المستفيد: إداري';
    return 'فئة المستفيد: طالب';
  }
  if (data.certificateType === 'excellence') {
    return data.excellenceVariant === 'teacher'
      ? 'مقدمة من المعلم / المعلمة'
      : 'مقدمة من إدارة المدرسة';
  }
  return 'شهادة تخرج طلابية';
}

export function getTeacherCertificateRecordTitle(
  data?: Partial<CertificateFormState>
): string {
  const typeLabel = getCertificateTypeArabicLabel(
    data?.certificateType || 'appreciation'
  );
  const customTitle = String(data?.certificateTitle ?? '').trim();
  const baseTitle = customTitle || typeLabel;
  const validBeneficiaries = extractValidCertificateBeneficiaryNames(
    data?.beneficiariesInput || ''
  );

  if (validBeneficiaries.length === 1) {
    return `${baseTitle} — ${validBeneficiaries[0]}`;
  }
  if (validBeneficiaries.length > 1) {
    return `${baseTitle} — ${validBeneficiaries[0]} (+${validBeneficiaries.length - 1} مستفيدين)`;
  }
  return baseTitle;
}

export function getTeacherCertificateRecordSummary(
  data?: Partial<CertificateFormState>
): string {
  if (!data) return '';
  const typeLabel = getCertificateTypeArabicLabel(
    data.certificateType || 'appreciation'
  );
  const subtypeLabel = getCertificateSubtypeArabicLabel({
    certificateType: data.certificateType || 'appreciation',
    appreciationRole: data.appreciationRole || 'teacher',
    excellenceVariant: data.excellenceVariant || 'school-administration',
  });
  const validBeneficiaries = extractValidCertificateBeneficiaryNames(
    data.beneficiariesInput || ''
  );
  const countLabel =
    validBeneficiaries.length > 1
      ? `دفعة (${validBeneficiaries.length} مستفيدين)`
      : validBeneficiaries.length === 1
        ? `مستفيد مفرد (${validBeneficiaries[0]})`
        : 'بدون مستفيد محدد';
  const langLabel = data.language === 'en' ? 'الإنجليزية' : 'العربية';
  const tplLabel = `قالب ${data.templateId || '1'} · لون ${data.colorSystemId || '1'}`;

  return [typeLabel, subtypeLabel, countLabel, langLabel, tplLabel]
    .filter(Boolean)
    .join(' · ');
}

// ============================================================================
// Group 7 Migration & Rollback (`certificates`)
// ============================================================================

export async function migrateCertificatesToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  const existingStoreBeforeMigration = loadCertificatesArchiveStore(
    opts?.storage
  );
  const existingArchiveDraft =
    existingStoreBeforeMigration.activeDraftByFormId?.[
      SCHOOL_CERTIFICATES_FORM_ID
    ];
  const existingConsistency = inspectCertificateDualStoreConsistency(
    opts?.settings,
    opts?.storage
  );

  return runIdempotentGroupMigration<
    CertificateFormState,
    CertificateFormState
  >({
    groupId: 'certificates',
    legacyStorageKey: CERTIFICATES_LEGACY_DRAFT_KEY,
    archiveStorageKey: TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];
      // Preserve unified archive drafts created directly or currently diverged from legacy
      if (
        existingArchiveDraft &&
        (!existingArchiveDraft.migratedFromLegacyKey ||
          existingConsistency.diverged)
      ) {
        return [];
      }

      let parsed: Partial<CertificateFormState> | undefined;
      try {
        const raw = storage.getItem(CERTIFICATES_LEGACY_DRAFT_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            parsed = obj as Partial<CertificateFormState>;
          }
        }
      } catch {
        parsed = undefined;
      }

      if (!parsed) return [];

      const merged = normalizeCertificateFormState(parsed, opts?.settings);
      const isEmpty = isLegacyCertificateDraftEmpty(merged, opts?.settings);

      const candidate: LegacyMigrationCandidate<CertificateFormState> = {
        sourceKey: `legacy_certificate_draft:${SCHOOL_CERTIFICATES_FORM_ID}`,
        formId: SCHOOL_CERTIFICATES_FORM_ID,
        title: getTeacherCertificateRecordTitle(merged),
        summary: getTeacherCertificateRecordSummary(merged),
        academicYear:
          merged.academicYear || opts?.settings?.academicYear || '',
        semester: opts?.settings?.semester || '',
        eventDate: '',
        isEmpty,
        // Architectural invariant: migrated legacy drafts remain drafts & non-eligible until saved explicitly
        targetState: 'draft',
        legacyData: merged,
      };

      return [candidate];
    },
    sanitizeAndExtractMedia: async (legacyData) => {
      return {
        sanitizedPayload: normalizeCertificateFormState(
          legacyData,
          opts?.settings
        ),
        mediaRefs: [],
        newlyCreatedBlobKeys: [],
      };
    },
  });
}

export async function rollbackCertificatesMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'certificates',
    archiveStorageKey: TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
  });
}

// ============================================================================
// Archive Store Operations, Signatures & Dual-Store Consistency
// ============================================================================

export function loadCertificatesArchiveStore(
  storage?: StorageLike
): TeacherCertificatesArchiveStore {
  return loadGroupArchiveStore<CertificateFormState>(
    TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
    'certificates',
    storage
  );
}

export function listSavedCertificates(
  storage?: StorageLike
): TeacherCertificateArchiveRecord[] {
  const store = loadCertificatesArchiveStore(storage);
  return listArchivedRecords(store, SCHOOL_CERTIFICATES_FORM_ID);
}

export interface CertificateDualStoreDivergenceInfo {
  diverged: boolean;
  reason?:
    | 'payload-mismatch'
    | 'legacy-corrupted'
    | 'missing-legacy-for-populated-draft';
  message: string;
  archiveTitle: string;
  legacyTitle: string;
  archiveUpdatedAt?: string;
  archiveDraft: TeacherCertificateArchiveRecord | null;
  legacyData: CertificateFormState | null;
}

export function computeCertificateDraftSignature(
  data: Partial<CertificateFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): string {
  const n = normalizeCertificateFormState(data, settings);
  return JSON.stringify({
    formId: SCHOOL_CERTIFICATES_FORM_ID,
    certificateType: n.certificateType,
    appreciationRole: n.appreciationRole,
    excellenceVariant: n.excellenceVariant,
    language: n.language,
    templateId: n.templateId,
    colorSystemId: n.colorSystemId,
    recipientGender: n.recipientGender,
    educationDepartment: n.educationDepartment,
    schoolName: n.schoolName,
    gradeName: n.gradeName,
    academicStage: n.academicStage,
    academicYear: n.academicYear,
    certificateTitle: n.certificateTitle,
    openingText: n.openingText,
    beneficiariesInput: n.beneficiariesInput,
    mainText: n.mainText,
    additionalText: n.additionalText,
    presenterTitle: n.presenterTitle,
    presenterName: n.presenterName,
    principalTitle: n.principalTitle,
    principalName: n.principalName,
    isPresenterSameAsPrincipal: n.isPresenterSameAsPrincipal,
  });
}

export function inspectCertificateDualStoreConsistency(
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): CertificateDualStoreDivergenceInfo {
  const resolvedStorage = resolveStorageSafe(storage);
  if (!resolvedStorage) {
    return {
      diverged: false,
      message: '',
      archiveTitle: '',
      legacyTitle: '',
      archiveDraft: null,
      legacyData: null,
    };
  }

  const store = loadCertificatesArchiveStore(resolvedStorage);
  const archiveDraft =
    store.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID] ?? null;
  const legacyRaw = resolvedStorage.getItem(CERTIFICATES_LEGACY_DRAFT_KEY);

  let legacyParsed: Partial<CertificateFormState> | null = null;
  let legacyCorrupted = false;
  if (legacyRaw !== null) {
    try {
      const obj = JSON.parse(legacyRaw);
      if (
        obj &&
        typeof obj === 'object' &&
        !Array.isArray(obj) &&
        typeof obj.certificateType === 'string'
      ) {
        legacyParsed = obj as Partial<CertificateFormState>;
      } else {
        legacyCorrupted = true;
      }
    } catch {
      legacyCorrupted = true;
    }
  }

  const legacyFull: CertificateFormState | null = legacyParsed
    ? normalizeCertificateFormState(legacyParsed, settings)
    : null;

  const archiveTitle = archiveDraft
    ? getTeacherCertificateRecordTitle(archiveDraft.payload)
    : '';
  const legacyTitle = legacyFull
    ? getTeacherCertificateRecordTitle(legacyFull)
    : '';

  if (archiveDraft && legacyCorrupted) {
    return {
      diverged: true,
      reason: 'legacy-corrupted',
      message:
        'تنبيه تباين البيانات: تعذر قراءة نسخة المسودة في المفتاح التوافقي القديم بينما توجد مسودة في مخزن أرشيف الشهادات. لم يتم استبدال أي نسخة؛ اختر النسخة المعتمدة للمتابعة.',
      archiveTitle,
      legacyTitle: 'بيانات تالفة في المفتاح القديم',
      archiveUpdatedAt: archiveDraft.updatedAt,
      archiveDraft,
      legacyData: null,
    };
  }

  if (archiveDraft && legacyFull) {
    const archiveSig = computeCertificateDraftSignature(
      archiveDraft.payload,
      settings
    );
    const legacySig = computeCertificateDraftSignature(legacyFull, settings);
    if (archiveSig !== legacySig) {
      return {
        diverged: true,
        reason: 'payload-mismatch',
        message: `تم اكتشاف اختلاف بين مسودة مخزن الأرشيف («${archiveTitle}») ومسودة المفتاح التوافقي القديم («${legacyTitle}»). لم يتم استبدال أي نسخة تلقائيًا منعًا لفقدان البيانات؛ اختر النسخة التي تريد اعتمادها.`,
        archiveTitle,
        legacyTitle,
        archiveUpdatedAt: archiveDraft.updatedAt,
        archiveDraft,
        legacyData: legacyFull,
      };
    }

    return {
      diverged: false,
      message: '',
      archiveTitle,
      legacyTitle,
      archiveUpdatedAt: archiveDraft.updatedAt,
      archiveDraft,
      legacyData: legacyFull,
    };
  }

  if (
    archiveDraft &&
    legacyRaw === null &&
    hasMeaningfulCertificateDraftData(archiveDraft.payload, settings)
  ) {
    return {
      diverged: true,
      reason: 'missing-legacy-for-populated-draft',
      message: `توجد مسودة شهادة نشطة في مخزن الأرشيف («${archiveTitle}») لكن المفتاح التوافقي القديم مفقود. اختر مزامنة نسخة الأرشيف قبل المتابعة.`,
      archiveTitle,
      legacyTitle: 'غير موجود',
      archiveUpdatedAt: archiveDraft.updatedAt,
      archiveDraft,
      legacyData: null,
    };
  }

  return {
    diverged: false,
    message: '',
    archiveTitle,
    legacyTitle,
    archiveUpdatedAt: archiveDraft?.updatedAt,
    archiveDraft,
    legacyData: legacyFull,
  };
}

export async function resolveCertificateDualStoreDivergence(
  choice: 'keep-archive' | 'keep-legacy',
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): Promise<{
  store: TeacherCertificatesArchiveStore;
  draftRecord: TeacherCertificateArchiveRecord;
  formData: CertificateFormState;
}> {
  const consistency = inspectCertificateDualStoreConsistency(
    opts?.settings,
    opts?.storage
  );

  if (choice === 'keep-archive') {
    const archiveDraft = consistency.archiveDraft;
    if (!archiveDraft) {
      return createNewBlankCertificateInArchive({
        settings: opts?.settings,
        storage: opts?.storage,
      });
    }
    const fullData = normalizeCertificateFormState(
      archiveDraft.payload,
      opts?.settings
    );
    const latestStore = loadCertificatesArchiveStore(opts?.storage);
    const { nextStore, draftRecord } = upsertDraftRecord(latestStore, {
      id: archiveDraft.id,
      formId: SCHOOL_CERTIFICATES_FORM_ID,
      title: getTeacherCertificateRecordTitle(fullData),
      summary: getTeacherCertificateRecordSummary(fullData),
      academicYear: fullData.academicYear || opts?.settings?.academicYear || '',
      semester: opts?.settings?.semester || '',
      eventDate: '',
      mediaRefs: [],
      payload: fullData,
    });

    writeBothCertificateDraftStoresTransactionally(
      nextStore,
      fullData,
      opts?.storage
    );

    return {
      store: nextStore,
      draftRecord,
      formData: fullData,
    };
  }

  // choice === 'keep-legacy'
  const legacyData =
    consistency.legacyData ??
    loadLegacyCertificateDraft(opts?.settings, opts?.storage);
  const res = syncActiveCertificateDraftToBothStores(legacyData, {
    draftId: consistency.archiveDraft?.id,
    settings: opts?.settings,
    storage: opts?.storage,
  });
  return {
    store: res.store,
    draftRecord: res.draftRecord,
    formData: legacyData,
  };
}

export async function loadActiveCertificateDraft(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
}): Promise<{
  draftRecord: TeacherCertificateArchiveRecord | null;
  formData: CertificateFormState;
  divergence: CertificateDualStoreDivergenceInfo;
}> {
  const divergence = inspectCertificateDualStoreConsistency(
    opts?.settings,
    opts?.storage
  );
  const store = loadCertificatesArchiveStore(opts?.storage);
  const draftRecord =
    store.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID] ?? null;

  if (draftRecord && draftRecord.formId === SCHOOL_CERTIFICATES_FORM_ID) {
    const merged = normalizeCertificateFormState(
      draftRecord.payload,
      opts?.settings
    );
    return {
      draftRecord,
      formData: merged,
      divergence,
    };
  }

  const legacyFallback = loadLegacyCertificateDraft(
    opts?.settings,
    opts?.storage
  );
  return {
    draftRecord: null,
    formData: legacyFallback,
    divergence,
  };
}

export function syncActiveCertificateDraftToBothStores(
  formData: CertificateFormState,
  opts?: {
    draftId?: string;
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): {
  store: TeacherCertificatesArchiveStore;
  draftRecord: TeacherCertificateArchiveRecord;
} {
  const normalized = normalizeCertificateFormState(formData, opts?.settings);
  const store = loadCertificatesArchiveStore(opts?.storage);
  const existingDraft =
    store.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID];
  const { nextStore, draftRecord } = upsertDraftRecord(store, {
    id: opts?.draftId ?? existingDraft?.id,
    formId: SCHOOL_CERTIFICATES_FORM_ID,
    title: getTeacherCertificateRecordTitle(normalized),
    summary: getTeacherCertificateRecordSummary(normalized),
    academicYear:
      normalized.academicYear || opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: '',
    mediaRefs: [],
    payload: normalized,
  });

  writeBothCertificateDraftStoresTransactionally(
    nextStore,
    normalized,
    opts?.storage
  );

  return { store: nextStore, draftRecord };
}

export async function saveCertificateToArchive(
  formData: CertificateFormState,
  opts?: {
    recordId?: string;
    resetActiveDraftAfterSave?: boolean;
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): Promise<{
  store: TeacherCertificatesArchiveStore;
  record: TeacherCertificateArchiveRecord;
  isNew: boolean;
  newDraftRecord?: TeacherCertificateArchiveRecord;
  newDraftFormData?: CertificateFormState;
}> {
  const normalized = normalizeCertificateFormState(formData, opts?.settings);
  const validationErrors = validateCertificateForArchive(normalized);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  const store = loadCertificatesArchiveStore(opts?.storage);
  const { nextStore, record, isNew } = upsertArchivedRecord(store, {
    id: opts?.recordId,
    formId: SCHOOL_CERTIFICATES_FORM_ID,
    title: getTeacherCertificateRecordTitle(normalized),
    summary: getTeacherCertificateRecordSummary(normalized),
    academicYear:
      normalized.academicYear || opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: '',
    mediaRefs: [],
    payload: normalized,
  });

  let finalNextStore = nextStore;
  let newDraftRecord: TeacherCertificateArchiveRecord | undefined;
  let newDraftFormData: CertificateFormState | undefined;
  let legacyTargetData: CertificateFormState = normalized;

  if (opts?.resetActiveDraftAfterSave) {
    const freshData = createInitialCertificateFormState(
      resolveFullSettings(opts?.settings)
    );
    const blankRes = startNewBlankDraftInStore(nextStore, {
      formId: SCHOOL_CERTIFICATES_FORM_ID,
      title: getTeacherCertificateRecordTitle(freshData),
      academicYear:
        freshData.academicYear || opts?.settings?.academicYear || '',
      semester: opts?.settings?.semester || '',
      payload: freshData,
    });
    finalNextStore = blankRes.nextStore;
    newDraftRecord = blankRes.draftRecord;
    newDraftFormData = freshData;
    legacyTargetData = freshData;
  }

  writeBothCertificateDraftStoresTransactionally(
    finalNextStore,
    legacyTargetData,
    opts?.storage
  );

  return {
    store: finalNextStore,
    record,
    isNew,
    newDraftRecord,
    newDraftFormData,
  };
}

export async function loadArchivedCertificateById(
  recordId: string,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): Promise<{
  record: TeacherCertificateArchiveRecord | null;
  formData: CertificateFormState | null;
}> {
  const store = loadCertificatesArchiveStore(opts?.storage);
  const record = store.records[recordId] ?? null;
  if (!record || record.recordState !== 'archived_saved') {
    return {
      record: null,
      formData: null,
    };
  }

  const merged = normalizeCertificateFormState(record.payload, opts?.settings);
  return {
    record,
    formData: merged,
  };
}

export function createNewBlankCertificateInArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
}): {
  store: TeacherCertificatesArchiveStore;
  draftRecord: TeacherCertificateArchiveRecord;
  formData: CertificateFormState;
} {
  const full = resolveFullSettings(opts?.settings);
  const freshData = createInitialCertificateFormState(full);
  const store = loadCertificatesArchiveStore(opts?.storage);

  const { nextStore, draftRecord } = startNewBlankDraftInStore(store, {
    formId: SCHOOL_CERTIFICATES_FORM_ID,
    title: getTeacherCertificateRecordTitle(freshData),
    academicYear: freshData.academicYear || opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: freshData,
  });

  writeBothCertificateDraftStoresTransactionally(
    nextStore,
    freshData,
    opts?.storage
  );

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
  };
}

/**
 * Explicitly abandons the current unsaved active draft, creates a new blank draft,
 * and cleans up any unreferenced media blobs.
 * Never touches saved archive records (`records[trec_*]`).
 */
export async function abandonActiveDraftAndCreateNewCertificate(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  store: TeacherCertificatesArchiveStore;
  draftRecord: TeacherCertificateArchiveRecord;
  formData: CertificateFormState;
  removedBlobKeys: string[];
  preservedSharedBlobKeys: string[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const prevStore = loadCertificatesArchiveStore(opts?.storage);
  const prevDraft =
    prevStore.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID];
  const prevBlobKeys = Array.from(
    new Set(
      (prevDraft?.mediaRefs || [])
        .map((r: UnifiedMediaRef) => r.blobKey)
        .filter(Boolean)
    )
  );

  const created = createNewBlankCertificateInArchive({
    settings: opts?.settings,
    storage: opts?.storage,
  });

  const removedBlobKeys: string[] = [];
  const preservedSharedBlobKeys: string[] = [];

  for (const blobKey of prevBlobKeys) {
    const del = await deleteBlobIfUnreferenced(blobKey, {
      storage: opts?.storage,
      extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
      repo: mediaRepo,
    });
    if (del.deleted) {
      removedBlobKeys.push(blobKey);
    } else if (del.remainingRefs > 0) {
      preservedSharedBlobKeys.push(blobKey);
    }
  }

  return {
    ...created,
    removedBlobKeys,
    preservedSharedBlobKeys,
  };
}

/**
 * Validates and saves the current active draft as an immutable archived record (`trec_...`),
 * and opens a fresh blank draft in a SINGLE combined store transition.
 * If validation fails, returns `{ ok: false, validationErrors }` and leaves the active draft 100% intact.
 * If storage fails, rolls back both stores so the user is never left with a saved record AND an un-cleared old draft.
 */
export async function saveDraftToArchiveAndCreateNewCertificate(
  formData: CertificateFormState,
  opts?: {
    recordId?: string;
    expectedDraftId?: string;
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): Promise<
  | {
      ok: true;
      savedRecord: TeacherCertificateArchiveRecord;
      newDraftRecord: TeacherCertificateArchiveRecord;
      newFormData: CertificateFormState;
      store: TeacherCertificatesArchiveStore;
    }
  | {
      ok: false;
      validationErrors: string[];
    }
> {
  const normalized = normalizeCertificateFormState(formData, opts?.settings);
  const validationErrors = validateCertificateForArchive(normalized);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      validationErrors,
    };
  }

  const latestStore = loadCertificatesArchiveStore(opts?.storage);
  if (opts?.expectedDraftId) {
    const currentDraft =
      latestStore.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID];
    if (currentDraft && currentDraft.id !== opts.expectedDraftId) {
      throw new CertificateDualStoreSyncError(
        'تغيرت المسودة النشطة أثناء الحفظ؛ تم إيقاف الانتقال المزدوج لحماية السجل والمسودة من الكتابة المتداخلة.',
        {
          failedStore: 'both',
          rolledBackBoth: true,
          archiveRestored: true,
          legacyRestored: true,
          diverged: false,
          rollbackErrors: [],
        }
      );
    }
  }

  const fullSettings = resolveFullSettings(opts?.settings);
  const freshData = createInitialCertificateFormState(fullSettings);

  // Stage BOTH transitions in memory first, then write once to both stores
  const { nextStore: storeWithSavedRecord, record: savedRecord } =
    upsertArchivedRecord(latestStore, {
      id: opts?.recordId,
      formId: SCHOOL_CERTIFICATES_FORM_ID,
      title: getTeacherCertificateRecordTitle(normalized),
      summary: getTeacherCertificateRecordSummary(normalized),
      academicYear:
        normalized.academicYear || opts?.settings?.academicYear || '',
      semester: opts?.settings?.semester || '',
      eventDate: '',
      mediaRefs: [],
      payload: normalized,
    });

  const { nextStore: finalNextStore, draftRecord: newDraftRecord } =
    startNewBlankDraftInStore(storeWithSavedRecord, {
      formId: SCHOOL_CERTIFICATES_FORM_ID,
      title: getTeacherCertificateRecordTitle(freshData),
      academicYear:
        freshData.academicYear || opts?.settings?.academicYear || '',
      semester: opts?.settings?.semester || '',
      payload: freshData,
    });

  writeBothCertificateDraftStoresTransactionally(
    finalNextStore,
    freshData,
    opts?.storage
  );

  return {
    ok: true,
    savedRecord,
    newDraftRecord,
    newFormData: freshData,
    store: finalNextStore,
  };
}

export function inspectArchivedCertificateDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
  }
): RecordDeletionImpact {
  const store = loadCertificatesArchiveStore(opts?.storage);
  return inspectRecordDeletionImpact(store, recordId, {
    storage: opts?.storage,
  });
}

export async function deleteArchivedCertificateRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlinkPortfolio?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<
  SafeDeleteRecordResult & { store: TeacherCertificatesArchiveStore }
> {
  const store = loadCertificatesArchiveStore(opts?.storage);
  const res = await deleteArchivedRecordSafely(
    TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
    store,
    recordId,
    {
      confirmUnlink: opts?.confirmUnlinkPortfolio,
      storage: opts?.storage,
      mediaRepo: opts?.mediaRepo,
      extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
    }
  );

  return {
    ...res.result,
    store: res.nextStore,
  };
}

export function filterCertificateArchiveRecords(
  records: TeacherCertificateArchiveRecord[],
  opts?: {
    searchQuery?: string;
    certificateType?: CertificateCategoryType | 'all';
  }
): TeacherCertificateArchiveRecord[] {
  const q = (opts?.searchQuery || '').trim().toLowerCase();
  const typeFilter = opts?.certificateType || 'all';

  return records.filter((rec) => {
    const p = rec.payload;
    if (typeFilter !== 'all' && p?.certificateType !== typeFilter) {
      return false;
    }

    if (!q) return true;

    const beneficiariesText = parseCertificateBeneficiaryNames(
      p?.beneficiariesInput || ''
    ).join(' ');

    const haystack = [
      rec.title,
      rec.summary,
      rec.id,
      p?.certificateTitle,
      getCertificateTypeArabicLabel(p?.certificateType || 'appreciation'),
      getCertificateSubtypeArabicLabel({
        certificateType: p?.certificateType || 'appreciation',
        appreciationRole: p?.appreciationRole || 'teacher',
        excellenceVariant: p?.excellenceVariant || 'school-administration',
      }),
      beneficiariesText,
      p?.schoolName,
      p?.educationDepartment,
      p?.gradeName,
      p?.academicStage,
      p?.academicYear,
      p?.presenterName,
      p?.principalName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}
