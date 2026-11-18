import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { SchoolSettings } from '../types';
import {
  deleteArchivedRecordSafely,
  extractEvidencePhotosToMediaRepo,
  hydrateEvidencePhotosFromMediaRepo,
  inspectRecordDeletionImpact,
  LegacyMigrationCandidate,
  listArchivedRecords,
  loadGroupArchiveStore,
  RecordDeletionImpact,
  rollbackGroupMigration,
  runIdempotentGroupMigration,
  RunGroupMigrationSummary,
  SafeDeleteRecordResult,
  saveGroupArchiveStore,
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
import {
  createInitialEducationalInitiativeState,
  EducationalInitiativeFormState,
  InitiativeExecutionNatureOption,
  resolveBeneficiariesDisplayValue,
  resolveInitiativeTypeDisplayValue,
  TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG,
  TeacherProgramsAndActivitiesFormId,
  validateEducationalInitiativeState,
} from './teacherProgramsAndActivitiesEngine';

export const TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_programs_activities_archive_v1';

export const PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY =
  'maktabi_teacher_program_activity_draft_v1_educational-initiative-documentation';

const EXTERNAL_ARCHIVE_KEYS = [
  'maktabi_teacher_reports_archive_v1',
  'maktabi_teacher_plans_archive_v1',
  'maktabi_teacher_meetings_archive_v1',
  'maktabi_teacher_peer_visits_archive_v1',
  'maktabi_teacher_tests_eval_archive_v1',
] as const;

const CROSS_GROUP_ARCHIVE_KEYS = [
  ...EXTERNAL_ARCHIVE_KEYS,
  TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
] as const;

export type TeacherProgramsActivitiesArchiveStore =
  TeacherGroupArchiveStore<EducationalInitiativeFormState>;

export type TeacherProgramActivityArchiveRecord =
  TeacherArchiveRecord<EducationalInitiativeFormState>;

const TARGET_FORM_ID: TeacherProgramsAndActivitiesFormId =
  'educational-initiative-documentation';

function resolveFullSettings(partial?: Partial<SchoolSettings>): SchoolSettings {
  return { ...DEFAULT_SCHOOL_SETTINGS, ...(partial || {}) };
}

function resolveStorageSafe(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function loadLegacyProgramActivityDraft(
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): EducationalInitiativeFormState {
  const full = resolveFullSettings(settings);
  const fallback = createInitialEducationalInitiativeState(full);
  const store = resolveStorageSafe(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<EducationalInitiativeFormState>;
    if (!parsed || parsed.formId !== TARGET_FORM_ID) return fallback;
    return {
      ...fallback,
      ...parsed,
      formId: TARGET_FORM_ID,
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

export interface ProgramActivityDualStoreSyncErrorDetails {
  failedStore: 'archive' | 'legacy' | 'both' | 'divergence';
  rolledBackBoth: boolean;
  archiveRestored: boolean;
  legacyRestored: boolean;
  diverged: boolean;
  rollbackErrors?: string[];
}

export class ProgramActivityDualStoreSyncError extends Error {
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
      | ProgramActivityDualStoreSyncErrorDetails,
    rolledBackBothFallback?: boolean
  ) {
    super(message);
    this.name = 'ProgramActivityDualStoreSyncError';
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
      error: writeError || verified.error || `تعذر التحقق من استعادة المفتاح (${key})`,
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
 * Two-phase dual-store synchronization between the unified Group 6 archive store
 * and the legacy draft key with verified rollback reporting.
 * Note: Browser localStorage does NOT provide cross-key native atomicity;
 * if rollback itself fails, this helper explicitly marks `rolledBackBoth: false`
 * and `diverged: true` rather than claiming full atomicity or hiding mismatch.
 */
export function writeBothProgramActivityDraftStoresTransactionally(
  nextArchiveStore: TeacherProgramsActivitiesArchiveStore,
  legacyDraftData: EducationalInitiativeFormState,
  storage?: StorageLike
): void {
  const store = resolveStorageSafe(storage);
  if (!store) return;

  const prevArchiveRaw = store.getItem(
    TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY
  );
  const prevLegacyRaw = store.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY);

  const normalizedArchiveStore: TeacherProgramsActivitiesArchiveStore = {
    ...nextArchiveStore,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  const nextArchiveJson = JSON.stringify(normalizedArchiveStore);
  const nextLegacyJson = JSON.stringify(legacyDraftData);

  const rollbackAndVerifyBoth = (): {
    archiveRestored: boolean;
    legacyRestored: boolean;
    rolledBackBoth: boolean;
    diverged: boolean;
    rollbackErrors: string[];
  } => {
    const rollbackErrors: string[] = [];
    const archResult = restoreStorageKeyAndVerify(
      store,
      TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
      prevArchiveRaw
    );
    if (!archResult.restored && archResult.error) {
      rollbackErrors.push(`مخزن الأرشيف: ${archResult.error}`);
    }

    const legResult = restoreStorageKeyAndVerify(
      store,
      PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
      prevLegacyRaw
    );
    if (!legResult.restored && legResult.error) {
      rollbackErrors.push(`المفتاح التوافقي القديم: ${legResult.error}`);
    }

    const rolledBackBoth = archResult.restored && legResult.restored;
    return {
      archiveRestored: archResult.restored,
      legacyRestored: legResult.restored,
      rolledBackBoth,
      diverged: !rolledBackBoth,
      rollbackErrors,
    };
  };

  try {
    store.setItem(
      TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
      nextArchiveJson
    );
  } catch (err) {
    const writeErrMsg = err instanceof Error ? err.message : String(err);
    const rb = rollbackAndVerifyBoth();
    throw new ProgramActivityDualStoreSyncError(
      rb.rolledBackBoth
        ? 'تعذر حفظ المسودة في مخزن الأرشيف الموحد؛ تم التحقق من بقاء النسختين متطابقتين على الحالة السابقة دون تعديل.'
        : `تعذر حفظ المسودة في مخزن الأرشيف الموحد وفشل التحقق من التراجع (${rb.rollbackErrors.join(' | ') || writeErrMsg})؛ قد يختلف المخزنان وتلزم المراجعة قبل المتابعة.`,
      {
        failedStore: 'archive',
        rolledBackBoth: rb.rolledBackBoth,
        archiveRestored: rb.archiveRestored,
        legacyRestored: rb.legacyRestored,
        diverged: rb.diverged,
        rollbackErrors: rb.rollbackErrors,
      }
    );
  }

  try {
    store.setItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY, nextLegacyJson);
  } catch (err) {
    const writeErrMsg = err instanceof Error ? err.message : String(err);
    const rb = rollbackAndVerifyBoth();
    throw new ProgramActivityDualStoreSyncError(
      rb.rolledBackBoth
        ? 'تعذر مزامنة المسودة مع المفتاح التوافقي القديم؛ تم التراجع في المخزنين والتحقق من تطابق النسختين على الحالة السابقة.'
        : `تعذر مزامنة المفتاح التوافقي القديم وفشل التراجع الكامل في المخزنين (${rb.rollbackErrors.join(' | ') || writeErrMsg})؛ المخزنان الآن بحالتين مختلفتين ولا يمكن المتابعة بصمت.`,
      {
        failedStore: rb.diverged ? 'both' : 'legacy',
        rolledBackBoth: rb.rolledBackBoth,
        archiveRestored: rb.archiveRestored,
        legacyRestored: rb.legacyRestored,
        diverged: rb.diverged,
        rollbackErrors: rb.rollbackErrors,
      }
    );
  }
}

export function saveLegacyProgramActivityDraft(
  data: EducationalInitiativeFormState,
  storage?: StorageLike
): void {
  const store = resolveStorageSafe(storage);
  if (!store) return;
  try {
    store.setItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY, JSON.stringify(data));
  } catch (err) {
    throw new ProgramActivityDualStoreSyncError(
      err instanceof Error && err.message
        ? err.message
        : 'تعذر الحفظ في المفتاح التوافقي القديم.',
      {
        failedStore: 'legacy',
        rolledBackBoth: false,
        archiveRestored: true,
        legacyRestored: false,
        diverged: true,
      }
    );
  }
}

// ============================================================================
// Metadata & Sanitization Helpers for Programs & Activities (Group 6)
// ============================================================================
export function getTeacherProgramActivityRecordTitle(
  data: Partial<EducationalInitiativeFormState>
): string {
  const name = (data.initiativeName || '').trim();
  if (name) return name;
  const typeText = data.initiativeType
    ? resolveInitiativeTypeDisplayValue({
        ...(data as EducationalInitiativeFormState),
      })
    : '';
  const scopeText = (data.initiativeScope || '').trim();
  if (typeText && scopeText) {
    return `مبادرة ${typeText} (${scopeText})`;
  }
  return 'توثيق مبادرة تعليمية';
}

export function getTeacherProgramActivityEventDate(
  data: Partial<EducationalInitiativeFormState>
): string {
  return (data.executionDateOrPeriod || '').trim();
}

export function getTeacherProgramActivityRecordSummary(
  data: Partial<EducationalInitiativeFormState>
): string {
  const parts: string[] = [];
  if (data.initiativeScope?.trim()) parts.push(data.initiativeScope.trim());
  if (data.initiativeType) {
    parts.push(
      resolveInitiativeTypeDisplayValue(
        data as EducationalInitiativeFormState
      )
    );
  }
  if (data.beneficiaries) {
    parts.push(
      resolveBeneficiariesDisplayValue(data as EducationalInitiativeFormState)
    );
  }
  if (data.executionNature === 'مبادرة جماعية') {
    const validCount = (data.participants || []).filter((p) =>
      p?.name?.trim()
    ).length;
    parts.push(
      validCount > 0
        ? `مبادرة جماعية (${validCount} مشاركين)`
        : 'مبادرة جماعية'
    );
  } else if (data.executionNature === 'مبادرة فردية') {
    const exec = (data.executorName || '').trim();
    parts.push(exec ? `مبادرة فردية — ${exec}` : 'مبادرة فردية');
  }
  if (data.executionPlace?.trim()) parts.push(data.executionPlace.trim());
  if (data.executionDateOrPeriod?.trim()) {
    parts.push(data.executionDateOrPeriod.trim());
  }
  return Array.from(new Set(parts)).join(' · ');
}

export function stripBase64PhotosFromProgramActivityPayload(
  data: EducationalInitiativeFormState
): EducationalInitiativeFormState {
  return {
    ...data,
    evidencePhotos: [],
  };
}

/**
 * Determines whether a legacy stored Programs & Activities draft contains only
 * untouched factory defaults (including settings-derived default userName).
 */
export function isLegacyProgramActivityEmpty(
  rawData: Partial<EducationalInitiativeFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  if (!rawData || typeof rawData !== 'object') return true;
  if (rawData.formId && rawData.formId !== TARGET_FORM_ID) return true;

  const hasPhotos =
    Array.isArray(rawData.evidencePhotos) && rawData.evidencePhotos.length > 0;
  const hasLinks =
    Array.isArray(rawData.evidenceLinks) &&
    rawData.evidenceLinks.some((l) => Boolean(l?.url?.trim()));
  if (hasPhotos || hasLinks) return false;

  const hasNonEmpty = (...vals: Array<string | undefined | null>) =>
    vals.some((v) => Boolean(v && String(v).trim()));

  if (
    hasNonEmpty(
      rawData.initiativeName,
      rawData.targetGradeOrGrades,
      rawData.customBeneficiaries,
      rawData.customInitiativeType,
      rawData.executionDateOrPeriod,
      rawData.executionPlace,
      rawData.initiativeGoal,
      rawData.initiativeDescription,
      rawData.executionMechanism,
      rawData.keyResultsOrImpact,
      rawData.additionalNotes
    )
  ) {
    return false;
  }

  if (rawData.initiativeScope && rawData.initiativeScope !== 'صفية') {
    return false;
  }
  if (rawData.beneficiaries && rawData.beneficiaries !== 'طلاب صف محدد') {
    return false;
  }
  if (rawData.initiativeType && rawData.initiativeType !== 'تعليمية') {
    return false;
  }
  if (
    rawData.executionNature &&
    rawData.executionNature !== 'مبادرة فردية'
  ) {
    return false;
  }

  const defaultUser = settings?.userName?.trim() || '';
  const execName = (rawData.executorName || '').trim();
  if (execName && execName !== defaultUser) {
    return false;
  }

  const extraParticipants = (rawData.participants || []).filter((p, idx) => {
    const n = (p?.name || '').trim();
    if (!n) return false;
    if (idx === 0 && n === defaultUser) return false;
    return true;
  });
  if (extraParticipants.length > 0) {
    return false;
  }

  return true;
}

export function filterProgramActivityArchiveRecords(
  records: TeacherProgramActivityArchiveRecord[],
  opts?: {
    executionNatureFilter?: InitiativeExecutionNatureOption | 'all';
    searchQuery?: string;
  }
): TeacherProgramActivityArchiveRecord[] {
  const natureFilter = opts?.executionNatureFilter ?? 'all';
  const query = (opts?.searchQuery || '').trim().toLowerCase();

  return records.filter((rec) => {
    const p = rec.payload;
    if (
      natureFilter !== 'all' &&
      p?.executionNature !== natureFilter
    ) {
      return false;
    }
    if (!query) return true;

    const participantNames = (p?.participants || [])
      .map((part) => part?.name)
      .filter(Boolean);

    const haystack = [
      rec.id,
      rec.title,
      rec.summary,
      rec.eventDate,
      p?.initiativeName,
      p?.initiativeScope,
      p?.initiativeType,
      p?.customInitiativeType,
      p?.beneficiaries,
      p?.customBeneficiaries,
      p?.targetGradeOrGrades,
      p?.executionPlace,
      p?.executionNature,
      p?.executorName,
      ...participantNames,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

// ============================================================================
// Group 6 Migration & Rollback (`programs-activities`)
// ============================================================================
export async function migrateProgramsAndActivitiesToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  const existingStoreBeforeMigration = loadProgramsActivitiesArchiveStore(
    opts?.storage
  );
  const existingArchiveDraft =
    existingStoreBeforeMigration.activeDraftByFormId?.[TARGET_FORM_ID];
  const existingConsistency = inspectProgramActivityDualStoreConsistency(
    opts?.settings,
    opts?.storage
  );

  return runIdempotentGroupMigration<
    EducationalInitiativeFormState,
    EducationalInitiativeFormState
  >({
    groupId: 'programs-activities',
    legacyStorageKey: PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
    archiveStorageKey: TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];
      // Preserve unified archive drafts created directly or currently diverged from legacy
      // so startup migration never silently clobbers them with stale legacy data.
      if (
        existingArchiveDraft &&
        (!existingArchiveDraft.migratedFromLegacyKey ||
          existingConsistency.diverged)
      ) {
        return [];
      }

      let parsed: Partial<EducationalInitiativeFormState> | undefined;
      try {
        const raw = storage.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object' && obj.formId === TARGET_FORM_ID) {
            parsed = obj as Partial<EducationalInitiativeFormState>;
          }
        }
      } catch {
        parsed = undefined;
      }

      if (!parsed) return [];

      const initial = createInitialEducationalInitiativeState(
        resolveFullSettings(opts?.settings)
      );
      const merged: EducationalInitiativeFormState = {
        ...initial,
        ...parsed,
        formId: TARGET_FORM_ID,
        participants: Array.isArray(parsed.participants)
          ? parsed.participants
          : initial.participants,
        evidencePhotos: Array.isArray(parsed.evidencePhotos)
          ? parsed.evidencePhotos
          : [],
        evidenceLinks: Array.isArray(parsed.evidenceLinks)
          ? parsed.evidenceLinks
          : [],
      };

      const isEmpty = isLegacyProgramActivityEmpty(parsed, opts?.settings);

      const candidate: LegacyMigrationCandidate<EducationalInitiativeFormState> =
        {
          sourceKey: `legacy_program_activity_draft:${TARGET_FORM_ID}`,
          formId: TARGET_FORM_ID,
          title: getTeacherProgramActivityRecordTitle(merged),
          summary: getTeacherProgramActivityRecordSummary(merged),
          academicYear: opts?.settings?.academicYear || '',
          semester: opts?.settings?.semester || '',
          eventDate: getTeacherProgramActivityEventDate(merged),
          isEmpty,
          // Architectural invariant: migrated legacy drafts remain drafts & non-eligible until saved explicitly
          targetState: 'draft',
          legacyData: merged,
        };

      return [candidate];
    },
    sanitizeAndExtractMedia: async (legacyData, mediaRepo) => {
      const { mediaRefs, newlyCreatedBlobKeys } =
        await extractEvidencePhotosToMediaRepo(
          legacyData.evidencePhotos,
          [],
          mediaRepo,
          'legacy-migration'
        );
      return {
        sanitizedPayload:
          stripBase64PhotosFromProgramActivityPayload(legacyData),
        mediaRefs,
        newlyCreatedBlobKeys,
      };
    },
  });
}

export async function rollbackProgramsAndActivitiesMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'programs-activities',
    archiveStorageKey: TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
  });
}

// ============================================================================
// Archive Store Operations for Programs & Activities UI & Unit Tests
// ============================================================================
export function loadProgramsActivitiesArchiveStore(
  storage?: StorageLike
): TeacherProgramsActivitiesArchiveStore {
  return loadGroupArchiveStore<EducationalInitiativeFormState>(
    TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
    'programs-activities',
    storage
  );
}

export function listSavedProgramsAndActivities(
  formId: TeacherProgramsAndActivitiesFormId = TARGET_FORM_ID,
  storage?: StorageLike
): TeacherProgramActivityArchiveRecord[] {
  const store = loadProgramsActivitiesArchiveStore(storage);
  return listArchivedRecords(store, formId);
}

export interface ProgramActivityDualStoreDivergenceInfo {
  diverged: boolean;
  reason?:
    | 'payload-mismatch'
    | 'media-mismatch'
    | 'legacy-corrupted'
    | 'missing-legacy-for-populated-draft'
    | 'missing-archive-for-populated-draft';
  message: string;
  archiveTitle: string;
  legacyTitle: string;
  archiveUpdatedAt?: string;
  archiveDraft: TeacherProgramActivityArchiveRecord | null;
  legacyData: EducationalInitiativeFormState | null;
}

export function computeProgramActivityDraftSignature(
  data: Partial<EducationalInitiativeFormState> | null | undefined,
  mediaRefsOrPhotoIds?: UnifiedMediaRef[] | string[],
  settings?: Partial<SchoolSettings>
): string {
  const fallback = createInitialEducationalInitiativeState(
    resolveFullSettings(settings)
  );
  const d = data || {};
  const normalizedParticipants = Array.isArray(d.participants)
    ? d.participants.map((p) => ({
        id: String(p?.id || ''),
        name: String(p?.name || ''),
      }))
    : fallback.participants.map((p) => ({
        id: String(p?.id || ''),
        name: String(p?.name || ''),
      }));
  const normalizedLinks = Array.isArray(d.evidenceLinks)
    ? d.evidenceLinks.map((l) => ({
        id: String(l?.id || ''),
        url: String(l?.url || ''),
      }))
    : [];
  const photoTokens = Array.isArray(mediaRefsOrPhotoIds)
    ? mediaRefsOrPhotoIds.map((item) =>
        typeof item === 'string' ? item : String(item?.id || '')
      )
    : Array.isArray(d.evidencePhotos)
      ? d.evidencePhotos.map((p) => String(p?.id || ''))
      : [];

  return JSON.stringify({
    formId: TARGET_FORM_ID,
    initiativeName: String(d.initiativeName ?? ''),
    initiativeScope: String(d.initiativeScope ?? fallback.initiativeScope),
    initiativeType: String(d.initiativeType ?? fallback.initiativeType),
    customInitiativeType: String(d.customInitiativeType ?? ''),
    beneficiaries: String(d.beneficiaries ?? fallback.beneficiaries),
    targetGradeOrGrades: String(d.targetGradeOrGrades ?? ''),
    customBeneficiaries: String(d.customBeneficiaries ?? ''),
    executionDateOrPeriod: String(d.executionDateOrPeriod ?? ''),
    executionPlace: String(d.executionPlace ?? ''),
    executionNature: String(d.executionNature ?? fallback.executionNature),
    executorName: String(d.executorName ?? fallback.executorName),
    participants: normalizedParticipants,
    initiativeGoal: String(d.initiativeGoal ?? ''),
    initiativeDescription: String(d.initiativeDescription ?? ''),
    executionMechanism: String(d.executionMechanism ?? ''),
    keyResultsOrImpact: String(d.keyResultsOrImpact ?? ''),
    additionalNotes: String(d.additionalNotes ?? ''),
    evidenceLinks: normalizedLinks,
    photoIds: photoTokens,
  });
}

export function inspectProgramActivityDualStoreConsistency(
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): ProgramActivityDualStoreDivergenceInfo {
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

  const initial = createInitialEducationalInitiativeState(
    resolveFullSettings(settings)
  );
  const store = loadProgramsActivitiesArchiveStore(resolvedStorage);
  const archiveDraft = store.activeDraftByFormId?.[TARGET_FORM_ID] ?? null;
  const legacyRaw = resolvedStorage.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY);

  let legacyParsed: Partial<EducationalInitiativeFormState> | null = null;
  let legacyCorrupted = false;
  if (legacyRaw !== null) {
    try {
      const obj = JSON.parse(legacyRaw);
      if (obj && typeof obj === 'object' && obj.formId === TARGET_FORM_ID) {
        legacyParsed = obj as Partial<EducationalInitiativeFormState>;
      } else {
        legacyCorrupted = true;
      }
    } catch {
      legacyCorrupted = true;
    }
  }

  const legacyFull: EducationalInitiativeFormState | null = legacyParsed
    ? {
        ...initial,
        ...legacyParsed,
        formId: TARGET_FORM_ID,
        participants: Array.isArray(legacyParsed.participants)
          ? legacyParsed.participants
          : initial.participants,
        evidencePhotos: Array.isArray(legacyParsed.evidencePhotos)
          ? legacyParsed.evidencePhotos
          : [],
        evidenceLinks: Array.isArray(legacyParsed.evidenceLinks)
          ? legacyParsed.evidenceLinks
          : [],
      }
    : null;

  const archiveTitle = archiveDraft
    ? getTeacherProgramActivityRecordTitle(archiveDraft.payload)
    : '';
  const legacyTitle = legacyFull
    ? getTeacherProgramActivityRecordTitle(legacyFull)
    : '';

  if (archiveDraft && legacyCorrupted) {
    return {
      diverged: true,
      reason: 'legacy-corrupted',
      message:
        'تنبيه تباين البيانات: تعذر قراءة نسخة المسودة في المفتاح التوافقي القديم بينما توجد مسودة في مخزن الأرشيف. لم يتم استبدال أي نسخة؛ اختر النسخة المعتمدة للمتابعة.',
      archiveTitle,
      legacyTitle: 'بيانات تالفة في المفتاح القديم',
      archiveUpdatedAt: archiveDraft.updatedAt,
      archiveDraft,
      legacyData: null,
    };
  }

  if (archiveDraft && legacyFull) {
    const archiveFieldSig = computeProgramActivityDraftSignature(
      archiveDraft.payload,
      [],
      settings
    );
    const legacyFieldSig = computeProgramActivityDraftSignature(
      legacyFull,
      [],
      settings
    );
    if (archiveFieldSig !== legacyFieldSig) {
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

    const archivePhotoIds = JSON.stringify(
      (archiveDraft.mediaRefs || []).map((r) => String(r.id || ''))
    );
    const legacyPhotoIds = JSON.stringify(
      (legacyFull.evidencePhotos || []).map((p) => String(p.id || ''))
    );
    if (archivePhotoIds !== legacyPhotoIds) {
      return {
        diverged: true,
        reason: 'media-mismatch',
        message: `تم اكتشاف اختلاف في قائمة الصور المرفقة بين مخزن الأرشيف (${(archiveDraft.mediaRefs || []).length}) والمفتاح التوافقي القديم (${(legacyFull.evidencePhotos || []).length}). لم يتم استبدال أي نسخة تلقائيًا؛ اختر النسخة التي تريد اعتمادها.`,
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
    hasMeaningfulProgramActivityDraftData(
      {
        ...archiveDraft.payload,
        evidencePhotos: (archiveDraft.mediaRefs || []).map((r) => ({
          id: r.id,
          imageDataUrl: r.blobKey,
        })),
      },
      settings
    )
  ) {
    return {
      diverged: true,
      reason: 'missing-legacy-for-populated-draft',
      message: `توجد مسودة نشطة في مخزن الأرشيف («${archiveTitle}») لكن المفتاح التوافقي القديم مفقود. اختر مزامنة نسخة الأرشيف أو معالجة التباين قبل المتابعة.`,
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

export async function cleanupUnreferencedProgramActivityBlobs(
  blobKeys: Iterable<string>,
  opts?: {
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{ removedBlobKeys: string[]; preservedSharedBlobKeys: string[] }> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const uniqueKeys = Array.from(new Set(blobKeys)).filter(Boolean);
  const removedBlobKeys: string[] = [];
  const preservedSharedBlobKeys: string[] = [];

  for (const blobKey of uniqueKeys) {
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

  return { removedBlobKeys, preservedSharedBlobKeys };
}

export async function resolveProgramActivityDualStoreDivergence(
  choice: 'keep-archive' | 'keep-legacy',
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherProgramsActivitiesArchiveStore;
  draftRecord: TeacherProgramActivityArchiveRecord;
  formData: EducationalInitiativeFormState;
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const consistency = inspectProgramActivityDualStoreConsistency(
    opts?.settings,
    opts?.storage
  );
  const initial = createInitialEducationalInitiativeState(
    resolveFullSettings(opts?.settings)
  );

  if (choice === 'keep-archive') {
    const archiveDraft = consistency.archiveDraft;
    if (!archiveDraft) {
      const created = createNewBlankProgramActivityInArchive({
        settings: opts?.settings,
        storage: opts?.storage,
      });
      return {
        ...created,
        mediaRefs: [],
        integrityWarnings: [],
      };
    }

    const hydrated = await hydrateEvidencePhotosFromMediaRepo(
      archiveDraft.mediaRefs,
      archiveDraft.payload?.evidencePhotos,
      mediaRepo
    );
    const fullData: EducationalInitiativeFormState = {
      ...initial,
      ...archiveDraft.payload,
      formId: TARGET_FORM_ID,
      participants: Array.isArray(archiveDraft.payload?.participants)
        ? archiveDraft.payload.participants
        : initial.participants,
      evidencePhotos: hydrated.photos,
      evidenceLinks: Array.isArray(archiveDraft.payload?.evidenceLinks)
        ? archiveDraft.payload.evidenceLinks
        : [],
    };
    const latestStore = loadProgramsActivitiesArchiveStore(opts?.storage);
    const { nextStore, draftRecord } = upsertDraftRecord(latestStore, {
      id: archiveDraft.id,
      formId: TARGET_FORM_ID,
      title: getTeacherProgramActivityRecordTitle(fullData),
      summary: getTeacherProgramActivityRecordSummary(fullData),
      academicYear: opts?.settings?.academicYear || '',
      semester: opts?.settings?.semester || '',
      eventDate: getTeacherProgramActivityEventDate(fullData),
      mediaRefs: archiveDraft.mediaRefs || [],
      payload: stripBase64PhotosFromProgramActivityPayload(fullData),
    });

    writeBothProgramActivityDraftStoresTransactionally(
      nextStore,
      fullData,
      opts?.storage
    );

    return {
      store: nextStore,
      draftRecord,
      formData: fullData,
      mediaRefs: archiveDraft.mediaRefs || [],
      integrityWarnings: hydrated.integrityWarnings,
    };
  }

  // choice === 'keep-legacy'
  const legacyData =
    consistency.legacyData ??
    loadLegacyProgramActivityDraft(opts?.settings, opts?.storage);
  const res = await saveActiveProgramActivityDraftWithMedia(legacyData, {
    draftId: consistency.archiveDraft?.id,
    settings: opts?.settings,
    storage: opts?.storage,
    mediaRepo,
  });
  return {
    store: res.store,
    draftRecord: res.draftRecord,
    formData: legacyData,
    mediaRefs: res.mediaRefs,
    integrityWarnings: [],
  };
}

export async function loadActiveProgramActivityDraftWithMedia(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  draftRecord: TeacherProgramActivityArchiveRecord | null;
  formData: EducationalInitiativeFormState;
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
  divergence: ProgramActivityDualStoreDivergenceInfo;
}> {
  const divergence = inspectProgramActivityDualStoreConsistency(
    opts?.settings,
    opts?.storage
  );
  const store = loadProgramsActivitiesArchiveStore(opts?.storage);
  const draftRecord = store.activeDraftByFormId?.[TARGET_FORM_ID] ?? null;
  const initial = createInitialEducationalInitiativeState(
    resolveFullSettings(opts?.settings)
  );

  if (draftRecord && draftRecord.formId === TARGET_FORM_ID) {
    const hydrated = await hydrateEvidencePhotosFromMediaRepo(
      draftRecord.mediaRefs,
      draftRecord.payload?.evidencePhotos,
      opts?.mediaRepo
    );
    const merged: EducationalInitiativeFormState = {
      ...initial,
      ...draftRecord.payload,
      formId: TARGET_FORM_ID,
      participants: Array.isArray(draftRecord.payload?.participants)
        ? draftRecord.payload.participants
        : initial.participants,
      evidencePhotos: hydrated.photos,
      evidenceLinks: Array.isArray(draftRecord.payload?.evidenceLinks)
        ? draftRecord.payload.evidenceLinks
        : [],
    };

    const integrityWarnings = divergence.diverged
      ? [divergence.message, ...hydrated.integrityWarnings]
      : hydrated.integrityWarnings;

    return {
      draftRecord,
      formData: merged,
      mediaRefs: draftRecord.mediaRefs || [],
      integrityWarnings,
      divergence,
    };
  }

  const legacyData = loadLegacyProgramActivityDraft(
    opts?.settings,
    opts?.storage
  );
  return {
    draftRecord: null,
    formData: legacyData,
    mediaRefs: [],
    integrityWarnings: divergence.diverged ? [divergence.message] : [],
    divergence,
  };
}

export async function loadArchivedProgramActivityWithMedia(
  recordId: string,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  record: TeacherProgramActivityArchiveRecord;
  formData: EducationalInitiativeFormState;
  integrityWarnings: string[];
} | null> {
  const store = loadProgramsActivitiesArchiveStore(opts?.storage);
  const record = store.records?.[recordId];
  if (!record || record.formId !== TARGET_FORM_ID) return null;

  const initial = createInitialEducationalInitiativeState(
    resolveFullSettings(opts?.settings)
  );
  const hydrated = await hydrateEvidencePhotosFromMediaRepo(
    record.mediaRefs,
    record.payload?.evidencePhotos,
    opts?.mediaRepo
  );

  const formData: EducationalInitiativeFormState = {
    ...initial,
    ...record.payload,
    formId: TARGET_FORM_ID,
    participants: Array.isArray(record.payload?.participants)
      ? record.payload.participants
      : initial.participants,
    evidencePhotos: hydrated.photos,
    evidenceLinks: Array.isArray(record.payload?.evidenceLinks)
      ? record.payload.evidenceLinks
      : [],
  };

  return {
    record,
    formData,
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export function hasMeaningfulProgramActivityDraftData(
  data: Partial<EducationalInitiativeFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  return !isLegacyProgramActivityEmpty(data, settings);
}

export function syncActiveProgramActivityDraftToBothStores(
  data: EducationalInitiativeFormState,
  opts?: {
    draftId?: string;
    knownMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): {
  store: TeacherProgramsActivitiesArchiveStore;
  draftRecord: TeacherProgramActivityArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
} {
  const currentStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const existingDraft = currentStore.activeDraftByFormId?.[data.formId];
  const refLookup = new Map<string, UnifiedMediaRef>();
  for (const r of existingDraft?.mediaRefs || []) {
    refLookup.set(r.id, r);
  }
  for (const r of opts?.knownMediaRefs || []) {
    refLookup.set(r.id, r);
  }

  const resolvedMediaRefs: UnifiedMediaRef[] = [];
  for (const photo of data.evidencePhotos || []) {
    const matched = refLookup.get(photo.id);
    if (matched) {
      resolvedMediaRefs.push(matched);
    }
  }

  const { nextStore, draftRecord } = upsertDraftRecord(currentStore, {
    id: opts?.draftId,
    formId: data.formId,
    title: getTeacherProgramActivityRecordTitle(data),
    summary: getTeacherProgramActivityRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherProgramActivityEventDate(data),
    mediaRefs: resolvedMediaRefs,
    payload: stripBase64PhotosFromProgramActivityPayload(data),
  });

  writeBothProgramActivityDraftStoresTransactionally(
    nextStore,
    data,
    opts?.storage
  );

  return { store: nextStore, draftRecord, mediaRefs: resolvedMediaRefs };
}

export async function saveActiveProgramActivityDraftWithMedia(
  data: EducationalInitiativeFormState,
  opts?: {
    draftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    shouldCommit?: () => boolean;
  }
): Promise<{
  store: TeacherProgramsActivitiesArchiveStore;
  draftRecord: TeacherProgramActivityArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
  aborted?: boolean;
  abortReason?: 'cancelled' | 'draft-replaced' | 'stale-write';
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const initialStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const initialDraft = initialStore.activeDraftByFormId?.[data.formId];
  const expectedDraftId = opts?.draftId ?? initialDraft?.id;
  const initialDraftUpdatedAt = initialDraft?.updatedAt;
  const previousDraftRefs =
    opts?.existingMediaRefs ?? initialDraft?.mediaRefs ?? [];

  const { mediaRefs, newlyCreatedBlobKeys } =
    await extractEvidencePhotosToMediaRepo(
      data.evidencePhotos,
      previousDraftRefs,
      mediaRepo,
      'upload'
    );

  // Re-read latest store AFTER async media extraction to prevent stale overwrites or racing state transitions
  const latestStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const latestDraft = latestStore.activeDraftByFormId?.[data.formId];

  const cleanNewlyCreatedAndAbort = async (
    reason: 'cancelled' | 'draft-replaced' | 'stale-write'
  ) => {
    await cleanupUnreferencedProgramActivityBlobs(newlyCreatedBlobKeys, {
      storage: opts?.storage,
      mediaRepo,
    });
    return {
      store: latestStore,
      draftRecord: (latestDraft ?? initialDraft)!,
      mediaRefs: latestDraft?.mediaRefs ?? [],
      aborted: true as const,
      abortReason: reason,
    };
  };

  if (opts?.shouldCommit && !opts.shouldCommit()) {
    return cleanNewlyCreatedAndAbort('cancelled');
  }
  if (
    expectedDraftId &&
    latestDraft &&
    latestDraft.id !== expectedDraftId
  ) {
    return cleanNewlyCreatedAndAbort('draft-replaced');
  }
  if (
    latestDraft &&
    initialDraftUpdatedAt &&
    latestDraft.updatedAt > initialDraftUpdatedAt
  ) {
    return cleanNewlyCreatedAndAbort('stale-write');
  }

  const latestPreviousRefs = latestDraft?.mediaRefs ?? previousDraftRefs;
  const { nextStore, draftRecord } = upsertDraftRecord(latestStore, {
    id: opts?.draftId ?? latestDraft?.id,
    formId: data.formId,
    title: getTeacherProgramActivityRecordTitle(data),
    summary: getTeacherProgramActivityRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherProgramActivityEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromProgramActivityPayload(data),
  });

  try {
    writeBothProgramActivityDraftStoresTransactionally(
      nextStore,
      data,
      opts?.storage
    );
  } catch (err) {
    await cleanupUnreferencedProgramActivityBlobs(newlyCreatedBlobKeys, {
      storage: opts?.storage,
      mediaRepo,
    });
    throw err;
  }

  // Clean up removed blobs only AFTER dual-store commit succeeded and only if globally unreferenced
  const newBlobKeySet = new Set(mediaRefs.map((r) => r.blobKey));
  const removedOldKeys = latestPreviousRefs
    .filter((prevRef) => !newBlobKeySet.has(prevRef.blobKey))
    .map((prevRef) => prevRef.blobKey);
  if (removedOldKeys.length > 0) {
    await cleanupUnreferencedProgramActivityBlobs(removedOldKeys, {
      storage: opts?.storage,
      mediaRepo,
    });
  }

  return { store: nextStore, draftRecord, mediaRefs, aborted: false };
}

export async function saveProgramActivityToArchive(
  data: EducationalInitiativeFormState,
  opts?: {
    recordId?: string;
    resetActiveDraftAfterSave?: boolean;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherProgramsActivitiesArchiveStore;
  record: TeacherProgramActivityArchiveRecord;
  isNew: boolean;
  mediaRefs: UnifiedMediaRef[];
  newDraftRecord?: TeacherProgramActivityArchiveRecord;
  newDraftFormData?: EducationalInitiativeFormState;
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const initialStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const previousRecord = opts?.recordId
    ? initialStore.records?.[opts.recordId]
    : undefined;
  const previousRefs =
    opts?.existingMediaRefs ??
    previousRecord?.mediaRefs ??
    (opts?.resetActiveDraftAfterSave
      ? initialStore.activeDraftByFormId?.[data.formId]?.mediaRefs ?? []
      : []);

  const { mediaRefs, newlyCreatedBlobKeys } =
    await extractEvidencePhotosToMediaRepo(
      data.evidencePhotos,
      previousRefs,
      mediaRepo,
      'upload'
    );

  // Re-read store after async IndexedDB extraction
  const currentStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const currentPreviousDraftRefs =
    opts?.resetActiveDraftAfterSave
      ? currentStore.activeDraftByFormId?.[data.formId]?.mediaRefs ?? []
      : [];

  const archivedStep = upsertArchivedRecord(currentStore, {
    id: opts?.recordId,
    formId: data.formId,
    title: getTeacherProgramActivityRecordTitle(data),
    summary: getTeacherProgramActivityRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherProgramActivityEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromProgramActivityPayload(data),
  });

  let finalNextStore = archivedStep.nextStore;
  let newDraftRecord: TeacherProgramActivityArchiveRecord | undefined;
  let newDraftFormData: EducationalInitiativeFormState | undefined;

  if (opts?.resetActiveDraftAfterSave) {
    const freshData = createInitialEducationalInitiativeState(
      resolveFullSettings(opts?.settings)
    );
    const meta = TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.find(
      (item) => item.id === TARGET_FORM_ID
    );
    const blankStep = startNewBlankDraftInStore(archivedStep.nextStore, {
      formId: TARGET_FORM_ID,
      title: `مسودة ${meta?.shortTitle || 'مبادرة تعليمية'} جديدة`,
      academicYear: opts?.settings?.academicYear || '',
      semester: opts?.settings?.semester || '',
      payload: stripBase64PhotosFromProgramActivityPayload(freshData),
    });
    finalNextStore = blankStep.nextStore;
    newDraftRecord = blankStep.draftRecord;
    newDraftFormData = freshData;

    try {
      writeBothProgramActivityDraftStoresTransactionally(
        finalNextStore,
        freshData,
        opts?.storage
      );
    } catch (err) {
      await cleanupUnreferencedProgramActivityBlobs(newlyCreatedBlobKeys, {
        storage: opts?.storage,
        mediaRepo,
      });
      throw err;
    }
  } else {
    const savedOk = saveGroupArchiveStore(
      TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
      finalNextStore,
      opts?.storage
    );
    if (resolveStorageSafe(opts?.storage) && !savedOk) {
      await cleanupUnreferencedProgramActivityBlobs(newlyCreatedBlobKeys, {
        storage: opts?.storage,
        mediaRepo,
      });
      throw new ProgramActivityDualStoreSyncError(
        'تعذر حفظ السجل في مخزن الأرشيف الموحد؛ لم يتم تطبيق التغيير.',
        {
          failedStore: 'archive',
          rolledBackBoth: true,
          archiveRestored: true,
          legacyRestored: true,
          diverged: false,
        }
      );
    }
  }

  // Clean up replaced/removed blobs only AFTER storage commit succeeded
  const newBlobKeySet = new Set(mediaRefs.map((r) => r.blobKey));
  const candidateRemoved = [
    ...(previousRecord ? previousRefs : []),
    ...currentPreviousDraftRefs,
  ]
    .filter((prevRef) => !newBlobKeySet.has(prevRef.blobKey))
    .map((prevRef) => prevRef.blobKey);

  if (candidateRemoved.length > 0) {
    await cleanupUnreferencedProgramActivityBlobs(candidateRemoved, {
      storage: opts?.storage,
      mediaRepo,
    });
  }

  return {
    store: finalNextStore,
    record: archivedStep.record,
    isNew: archivedStep.isNew,
    mediaRefs,
    newDraftRecord,
    newDraftFormData,
  };
}

export function createNewBlankProgramActivityInArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
}): {
  store: TeacherProgramsActivitiesArchiveStore;
  draftRecord: TeacherProgramActivityArchiveRecord;
  formData: EducationalInitiativeFormState;
} {
  const freshData = createInitialEducationalInitiativeState(
    resolveFullSettings(opts?.settings)
  );
  const currentStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const meta = TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.find(
    (item) => item.id === TARGET_FORM_ID
  );

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId: TARGET_FORM_ID,
    title: `مسودة ${meta?.shortTitle || 'مبادرة تعليمية'} جديدة`,
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromProgramActivityPayload(freshData),
  });

  writeBothProgramActivityDraftStoresTransactionally(
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

export async function saveDraftToArchiveAndCreateNewProgramActivity(
  data: EducationalInitiativeFormState,
  opts?: {
    recordId?: string;
    expectedDraftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<
  | {
      ok: false;
      validationErrors: string[];
    }
  | {
      ok: true;
      savedRecord: TeacherProgramActivityArchiveRecord;
      isNew: boolean;
      newDraftRecord: TeacherProgramActivityArchiveRecord;
      newFormData: EducationalInitiativeFormState;
      store: TeacherProgramsActivitiesArchiveStore;
    }
> {
  const validationErrors = validateEducationalInitiativeState(data);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      validationErrors,
    };
  }

  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const initialStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const previousRecord = opts?.recordId
    ? initialStore.records?.[opts.recordId]
    : undefined;
  const previousActiveDraftRefs =
    initialStore.activeDraftByFormId?.[TARGET_FORM_ID]?.mediaRefs ?? [];
  const previousRefs =
    opts?.existingMediaRefs ??
    previousRecord?.mediaRefs ??
    previousActiveDraftRefs;

  const { mediaRefs, newlyCreatedBlobKeys } =
    await extractEvidencePhotosToMediaRepo(
      data.evidencePhotos,
      previousRefs,
      mediaRepo,
      'upload'
    );

  // Re-read store after async IndexedDB extraction so concurrent record saves/edits are preserved
  const latestStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const latestActiveDraft = latestStore.activeDraftByFormId?.[TARGET_FORM_ID];
  if (
    opts?.expectedDraftId &&
    latestActiveDraft &&
    latestActiveDraft.id !== opts.expectedDraftId
  ) {
    await cleanupUnreferencedProgramActivityBlobs(newlyCreatedBlobKeys, {
      storage: opts?.storage,
      mediaRepo,
    });
    throw new ProgramActivityDualStoreSyncError(
      'تغيرت حالة المسودة النشطة أثناء تجهيز المرفقات؛ تم إلغاء العملية دون تعديل المخزنين لحماية أحدث بياناتك.',
      {
        failedStore: 'archive',
        rolledBackBoth: true,
        archiveRestored: true,
        legacyRestored: true,
        diverged: false,
      }
    );
  }

  const archivedStep = upsertArchivedRecord(latestStore, {
    id: opts?.recordId,
    formId: data.formId,
    title: getTeacherProgramActivityRecordTitle(data),
    summary: getTeacherProgramActivityRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherProgramActivityEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromProgramActivityPayload(data),
  });

  const freshData = createInitialEducationalInitiativeState(
    resolveFullSettings(opts?.settings)
  );
  const meta = TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.find(
    (item) => item.id === TARGET_FORM_ID
  );

  const blankStep = startNewBlankDraftInStore(archivedStep.nextStore, {
    formId: TARGET_FORM_ID,
    title: `مسودة ${meta?.shortTitle || 'مبادرة تعليمية'} جديدة`,
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromProgramActivityPayload(freshData),
  });

  // Single unified store transition written once to both stores; rollback cleans up or reports divergence honestly
  try {
    writeBothProgramActivityDraftStoresTransactionally(
      blankStep.nextStore,
      freshData,
      opts?.storage
    );
  } catch (err) {
    await cleanupUnreferencedProgramActivityBlobs(newlyCreatedBlobKeys, {
      storage: opts?.storage,
      mediaRepo,
    });
    throw err;
  }

  // Clean up any replaced blobs only after the unified write succeeds
  const newBlobKeySet = new Set(mediaRefs.map((r) => r.blobKey));
  const staleOldKeys = previousRefs
    .filter((prevRef) => !newBlobKeySet.has(prevRef.blobKey))
    .map((prevRef) => prevRef.blobKey);
  if (staleOldKeys.length > 0) {
    await cleanupUnreferencedProgramActivityBlobs(staleOldKeys, {
      storage: opts?.storage,
      mediaRepo,
    });
  }

  return {
    ok: true,
    savedRecord: archivedStep.record,
    isNew: archivedStep.isNew,
    newDraftRecord: blankStep.draftRecord,
    newFormData: freshData,
    store: blankStep.nextStore,
  };
}

export async function abandonActiveDraftAndCreateNewProgramActivity(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  store: TeacherProgramsActivitiesArchiveStore;
  draftRecord: TeacherProgramActivityArchiveRecord;
  formData: EducationalInitiativeFormState;
  removedBlobKeys: string[];
  preservedSharedBlobKeys: string[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadProgramsActivitiesArchiveStore(opts?.storage);
  const abandonedRefs =
    currentStore.activeDraftByFormId?.[TARGET_FORM_ID]?.mediaRefs ?? [];

  const freshData = createInitialEducationalInitiativeState(
    resolveFullSettings(opts?.settings)
  );
  const meta = TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.find(
    (item) => item.id === TARGET_FORM_ID
  );

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId: TARGET_FORM_ID,
    title: `مسودة ${meta?.shortTitle || 'مبادرة تعليمية'} جديدة`,
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromProgramActivityPayload(freshData),
  });

  writeBothProgramActivityDraftStoresTransactionally(
    nextStore,
    freshData,
    opts?.storage
  );

  // Safely reclaim only blobs that are completely unreferenced across Groups 1–6
  const removedBlobKeys: string[] = [];
  const preservedSharedBlobKeys: string[] = [];
  for (const prevRef of abandonedRefs) {
    const del = await deleteBlobIfUnreferenced(prevRef.blobKey, {
      storage: opts?.storage,
      extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
      repo: mediaRepo,
    });
    if (del.deleted) {
      removedBlobKeys.push(prevRef.blobKey);
    } else if (del.remainingRefs > 0) {
      preservedSharedBlobKeys.push(prevRef.blobKey);
    }
  }

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
    removedBlobKeys,
    preservedSharedBlobKeys,
  };
}

export function inspectArchivedProgramActivityDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): RecordDeletionImpact {
  const store = loadProgramsActivitiesArchiveStore(opts?.storage);
  const activeKeys = opts?.activeUiDraftMediaRefs
    ? Array.from(opts.activeUiDraftMediaRefs).map((r) => r.blobKey)
    : [];
  const baseImpact = inspectRecordDeletionImpact(store, recordId, {
    storage: opts?.storage,
    activeUiDraftBlobKeys: activeKeys,
  });

  if (baseImpact.recordBlobKeys.length === 0) {
    return baseImpact;
  }

  const resolvedStorage = resolveStorageSafe(opts?.storage);
  if (!resolvedStorage) return baseImpact;

  // Scan external archive stores (Groups 1–5) for accurate cross-group ref-counting
  const externalKeys = new Set<string>();
  for (const extStorageKey of EXTERNAL_ARCHIVE_KEYS) {
    try {
      const raw = resolvedStorage.getItem(extStorageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        records?: Record<string, { mediaRefs?: UnifiedMediaRef[] }>;
        activeDraftByFormId?: Record<string, { mediaRefs?: UnifiedMediaRef[] }>;
      };
      for (const r of Object.values(parsed.records || {})) {
        for (const ref of r?.mediaRefs || []) externalKeys.add(ref.blobKey);
      }
      for (const d of Object.values(parsed.activeDraftByFormId || {})) {
        for (const ref of d?.mediaRefs || []) externalKeys.add(ref.blobKey);
      }
    } catch {
      // Ignore malformed external store
    }
  }

  const sharedSet = new Set(baseImpact.sharedBlobKeys);
  for (const k of baseImpact.recordBlobKeys) {
    if (externalKeys.has(k)) {
      sharedSet.add(k);
    }
  }
  const sharedBlobKeys = Array.from(sharedSet);
  const exclusiveBlobKeys = baseImpact.recordBlobKeys.filter(
    (k) => !sharedSet.has(k)
  );
  let warningMessage = baseImpact.warningMessage;
  if (!warningMessage && sharedBlobKeys.length > 0) {
    warningMessage =
      'سيتم حذف السجل من الأرشيف مع الإبقاء على المرفقات المشتركة المستخدمة في سجلات أخرى.';
  }

  return {
    ...baseImpact,
    sharedBlobKeys,
    exclusiveBlobKeys,
    warningMessage,
  };
}

export async function deleteArchivedProgramActivityRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherProgramsActivitiesArchiveStore;
  result: SafeDeleteRecordResult;
}> {
  const store = loadProgramsActivitiesArchiveStore(opts?.storage);
  return deleteArchivedRecordSafely(
    TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
    store,
    recordId,
    {
      confirmUnlink: opts?.confirmUnlink,
      storage: opts?.storage,
      mediaRepo: opts?.mediaRepo,
      extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
      activeUiDraftMediaRefs: opts?.activeUiDraftMediaRefs,
    }
  );
}
