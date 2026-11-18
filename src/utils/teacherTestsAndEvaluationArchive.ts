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
  AnyTeacherTestOrEvaluationFormState,
  calculateRemainingStudentsCount,
  createInitialTestOrEvaluationState,
  InternalTestExecutionFormState,
  parseFlexibleScore,
  PerformanceTaskExecutionFormState,
  resolveInternalTestCategoryText,
  resolvePerformanceTaskTypeText,
  TEACHER_TESTS_AND_EVALUATION_CATALOG,
  TeacherTestsAndEvaluationFormId,
} from './teacherTestsAndEvaluationEngine';

export const TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_tests_eval_archive_v1';

export const TESTS_EVAL_LEGACY_DRAFT_PREFIX =
  'maktabi_teacher_tests_eval_draft_v1_';

const EXTERNAL_ARCHIVE_KEYS = [
  'maktabi_teacher_reports_archive_v1',
  'maktabi_teacher_plans_archive_v1',
  'maktabi_teacher_meetings_archive_v1',
  'maktabi_teacher_peer_visits_archive_v1',
] as const;

const CROSS_GROUP_ARCHIVE_KEYS = [
  ...EXTERNAL_ARCHIVE_KEYS,
  TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
] as const;

export type TeacherTestsEvalArchiveStore =
  TeacherGroupArchiveStore<AnyTeacherTestOrEvaluationFormState>;

export type TeacherTestEvalArchiveRecord =
  TeacherArchiveRecord<AnyTeacherTestOrEvaluationFormState>;

const LEGACY_TEST_EVAL_FORM_IDS: readonly TeacherTestsAndEvaluationFormId[] = [
  'internal-test-execution',
  'performance-task-execution',
];

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

export function loadLegacyTestEvalDraft<
  K extends TeacherTestsAndEvaluationFormId,
>(
  formId: K,
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): Extract<AnyTeacherTestOrEvaluationFormState, { formId: K }> {
  const full = resolveFullSettings(settings);
  const fallback = createInitialTestOrEvaluationState(formId, full) as Extract<
    AnyTeacherTestOrEvaluationFormState,
    { formId: K }
  >;
  const store = resolveStorageSafe(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(`${TESTS_EVAL_LEGACY_DRAFT_PREFIX}${formId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<
      AnyTeacherTestOrEvaluationFormState
    >;
    if (!parsed || parsed.formId !== formId) return fallback;
    return {
      ...fallback,
      ...parsed,
      formId,
    } as Extract<AnyTeacherTestOrEvaluationFormState, { formId: K }>;
  } catch {
    return fallback;
  }
}

export function saveLegacyTestEvalDraft(
  data: AnyTeacherTestOrEvaluationFormState,
  storage?: StorageLike
): void {
  const store = resolveStorageSafe(storage);
  if (!store) return;
  try {
    store.setItem(
      `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}${data.formId}`,
      JSON.stringify(data)
    );
  } catch {
    // Ignore storage quota errors
  }
}

// ============================================================================
// Metadata & Sanitization Helpers for Tests & Evaluation (Group 5)
// ============================================================================
export function getTeacherTestEvalRecordTitle(
  formId: TeacherTestsAndEvaluationFormId,
  data: Partial<AnyTeacherTestOrEvaluationFormState>
): string {
  if (formId === 'internal-test-execution') {
    const d = data as Partial<InternalTestExecutionFormState>;
    const testName = (d.testName || '').trim();
    if (testName) return testName;
    const category = d.testCategory
      ? resolveInternalTestCategoryText(
          d.testCategory,
          d.customTestCategory || ''
        )
      : '';
    const subject = (d.subject || '').trim();
    if (category && subject) {
      return `${category} — ${subject}`;
    }
    return subject
      ? `تقرير تنفيذ اختبار داخلي (${subject})`
      : 'تقرير تنفيذ اختبار داخلي';
  }

  const d = data as Partial<PerformanceTaskExecutionFormState>;
  const taskName = (d.taskName || '').trim();
  if (taskName) return taskName;
  const taskType = d.taskType
    ? resolvePerformanceTaskTypeText(d.taskType, d.customTaskType || '')
    : '';
  const subject = (d.subject || '').trim();
  if (taskType && subject) {
    return `مهمة أدائية (${taskType}) — ${subject}`;
  }
  return subject
    ? `تقرير تنفيذ مهمة أدائية (${subject})`
    : 'تقرير تنفيذ مهمة أدائية';
}

export function getTeacherTestEvalEventDate(
  formId: TeacherTestsAndEvaluationFormId,
  data: Partial<AnyTeacherTestOrEvaluationFormState>
): string {
  if (formId === 'internal-test-execution') {
    return ((data as Partial<InternalTestExecutionFormState>).executionDate || '').trim();
  }
  return (
    (data as Partial<PerformanceTaskExecutionFormState>).executionDateOrPeriod || ''
  ).trim();
}

export function getTeacherTestEvalRecordSummary(
  formId: TeacherTestsAndEvaluationFormId,
  data: Partial<AnyTeacherTestOrEvaluationFormState>
): string {
  const parts: string[] = [];

  if (formId === 'internal-test-execution') {
    const d = data as Partial<InternalTestExecutionFormState>;
    if (d.subject?.trim()) parts.push(d.subject.trim());
    if (d.grade?.trim()) parts.push(d.grade.trim());
    if (d.testCategory) {
      parts.push(
        resolveInternalTestCategoryText(
          d.testCategory,
          d.customTestCategory || ''
        )
      );
    }
    const parsedScore = parseFlexibleScore(d.maxScore || '');
    if (parsedScore !== null && parsedScore > 0) {
      parts.push(`الدرجة: ${parsedScore}`);
    }
    const calc = calculateRemainingStudentsCount(
      d.targetStudentsCount || '',
      d.performedStudentsCount || '',
      'المؤدين'
    );
    if (calc.isValid && calc.remainingCount !== null) {
      parts.push(
        `المؤدون: ${calc.completedOrPerformedCount}/${calc.targetCount} (الغائبون: ${calc.remainingCount})`
      );
    }
    if (d.executionDate?.trim()) parts.push(d.executionDate.trim());
    return Array.from(new Set(parts)).join(' · ');
  }

  const d = data as Partial<PerformanceTaskExecutionFormState>;
  if (d.subject?.trim()) parts.push(d.subject.trim());
  if (d.grade?.trim()) parts.push(d.grade.trim());
  if (d.taskType) {
    parts.push(
      resolvePerformanceTaskTypeText(d.taskType, d.customTaskType || '')
    );
  }
  const calc = calculateRemainingStudentsCount(
    d.targetStudentsCount || '',
    d.completedStudentsCount || '',
    'المنجزين'
  );
  if (calc.isValid && calc.remainingCount !== null) {
    parts.push(
      `المنجزون: ${calc.completedOrPerformedCount}/${calc.targetCount} (لم ينجزوها: ${calc.remainingCount})`
    );
  }
  if (d.executionDateOrPeriod?.trim()) parts.push(d.executionDateOrPeriod.trim());
  return Array.from(new Set(parts)).join(' · ');
}

export function stripBase64PhotosFromTestEvalPayload<
  T extends AnyTeacherTestOrEvaluationFormState,
>(data: T): T {
  return {
    ...data,
    evidencePhotos: [],
  };
}

/**
 * Determines whether a legacy stored Tests & Evaluation draft object has zero
 * meaningful user-entered data (only factory defaults / settings-derived subject).
 */
export function isLegacyTestEvalEmpty(
  formId: TeacherTestsAndEvaluationFormId,
  rawData: Partial<AnyTeacherTestOrEvaluationFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  if (!rawData || typeof rawData !== 'object') return true;
  if (rawData.formId && rawData.formId !== formId) return true;

  const hasPhotos =
    Array.isArray(rawData.evidencePhotos) && rawData.evidencePhotos.length > 0;
  const hasLinks =
    Array.isArray(rawData.evidenceLinks) &&
    rawData.evidenceLinks.some((l) => Boolean(l?.url?.trim()));
  if (hasPhotos || hasLinks) return false;

  const hasNonEmpty = (...vals: Array<string | undefined | null>) =>
    vals.some((v) => Boolean(v && String(v).trim()));

  const defaultSubject =
    settings?.roles?.teacher?.replace(/^معلم(?:ة)?\s+/, '').trim() || '';
  const draftSubject = (rawData.subject || '').trim();
  if (Boolean(draftSubject) && draftSubject !== defaultSubject) {
    return false;
  }

  const draftStage = (rawData.stage || '').trim();
  if (Boolean(draftStage) && draftStage !== 'المرحلة المتوسطة') {
    return false;
  }

  if (formId === 'internal-test-execution') {
    const d = rawData as Partial<InternalTestExecutionFormState>;
    if (
      hasNonEmpty(
        d.testName,
        d.grade,
        d.customTestCategory,
        d.executionDate,
        d.maxScore,
        d.targetStudentsCount,
        d.performedStudentsCount,
        d.additionalNotes
      )
    ) {
      return false;
    }
    if (
      d.testCategory &&
      d.testCategory !== 'اختبار تقويمي خلال الفترة الدراسية'
    ) {
      return false;
    }
    if (d.executionMethod && d.executionMethod !== 'ورقي') {
      return false;
    }
    return true;
  }

  const d = rawData as Partial<PerformanceTaskExecutionFormState>;
  if (
    hasNonEmpty(
      d.taskName,
      d.grade,
      d.executionDateOrPeriod,
      d.customTaskType,
      d.targetStudentsCount,
      d.completedStudentsCount,
      d.taskGoal,
      d.taskDescriptionAndMechanism,
      d.evaluationMethod,
      d.additionalNotes
    )
  ) {
    return false;
  }
  if (d.taskType && d.taskType !== 'مشروع') {
    return false;
  }
  return true;
}

export function filterTestEvalArchiveRecords(
  records: TeacherTestEvalArchiveRecord[],
  opts?: {
    formIdFilter?: TeacherTestsAndEvaluationFormId | 'all';
    searchQuery?: string;
  }
): TeacherTestEvalArchiveRecord[] {
  const formFilter = opts?.formIdFilter ?? 'all';
  const query = (opts?.searchQuery || '').trim().toLowerCase();

  return records.filter((rec) => {
    if (formFilter !== 'all' && rec.formId !== formFilter) {
      return false;
    }
    if (!query) return true;
    const p = rec.payload;
    const modelSpecificFields =
      p?.formId === 'internal-test-execution'
        ? [p.testCategory, p.customTestCategory]
        : p?.formId === 'performance-task-execution'
          ? [p.taskType, p.customTaskType]
          : [];
    const haystack = [
      rec.id,
      rec.title,
      rec.summary,
      rec.eventDate,
      p?.subject,
      p?.grade,
      p?.stage,
      ...modelSpecificFields,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

// ============================================================================
// Group 5 Migration & Rollback (`tests-evaluation`)
// ============================================================================
export async function migrateTestsAndEvaluationToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  return runIdempotentGroupMigration<
    AnyTeacherTestOrEvaluationFormState,
    AnyTeacherTestOrEvaluationFormState
  >({
    groupId: 'tests-evaluation',
    legacyStorageKey: `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}internal-test-execution`,
    archiveStorageKey: TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];

      const candidates: LegacyMigrationCandidate<AnyTeacherTestOrEvaluationFormState>[] =
        [];

      for (const formId of LEGACY_TEST_EVAL_FORM_IDS) {
        let parsed: Partial<AnyTeacherTestOrEvaluationFormState> | undefined;
        try {
          const raw = storage.getItem(
            `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}${formId}`
          );
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object' && obj.formId === formId) {
              parsed = obj as Partial<AnyTeacherTestOrEvaluationFormState>;
            }
          }
        } catch {
          parsed = undefined;
        }

        if (!parsed) continue;

        const merged = {
          ...createInitialTestOrEvaluationState(
            formId,
            resolveFullSettings(opts?.settings)
          ),
          ...parsed,
          formId,
        } as AnyTeacherTestOrEvaluationFormState;

        const isEmpty = isLegacyTestEvalEmpty(formId, parsed, opts?.settings);

        candidates.push({
          sourceKey: `legacy_test_eval_draft:${formId}`,
          formId,
          title: getTeacherTestEvalRecordTitle(formId, merged),
          summary: getTeacherTestEvalRecordSummary(formId, merged),
          academicYear: opts?.settings?.academicYear || '',
          semester: opts?.settings?.semester || '',
          eventDate: getTeacherTestEvalEventDate(formId, merged),
          isEmpty,
          // Architectural invariant: legacy drafts remain drafts & non-eligible until saved explicitly
          targetState: 'draft',
          legacyData: merged,
        });
      }

      return candidates;
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
        sanitizedPayload: stripBase64PhotosFromTestEvalPayload(legacyData),
        mediaRefs,
        newlyCreatedBlobKeys,
      };
    },
  });
}

export async function rollbackTestsAndEvaluationMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'tests-evaluation',
    archiveStorageKey: TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
  });
}

// ============================================================================
// Archive Store Operations for Tests & Evaluation UI & Unit Tests
// ============================================================================
export function loadTestsEvalArchiveStore(
  storage?: StorageLike
): TeacherTestsEvalArchiveStore {
  return loadGroupArchiveStore<AnyTeacherTestOrEvaluationFormState>(
    TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
    'tests-evaluation',
    storage
  );
}

export function listSavedTestsAndEvaluations(
  formId?: TeacherTestsAndEvaluationFormId,
  storage?: StorageLike
): TeacherTestEvalArchiveRecord[] {
  const store = loadTestsEvalArchiveStore(storage);
  return listArchivedRecords(store, formId);
}

export async function loadActiveTestEvalDraftWithMedia<
  K extends TeacherTestsAndEvaluationFormId,
>(
  formId: K,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  draftRecord: TeacherTestEvalArchiveRecord | null;
  formData: Extract<AnyTeacherTestOrEvaluationFormState, { formId: K }>;
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
}> {
  const store = loadTestsEvalArchiveStore(opts?.storage);
  const draftRecord = store.activeDraftByFormId?.[formId] ?? null;
  const initial = createInitialTestOrEvaluationState(
    formId,
    resolveFullSettings(opts?.settings)
  );

  if (draftRecord && draftRecord.formId === formId) {
    const hydrated = await hydrateEvidencePhotosFromMediaRepo(
      draftRecord.mediaRefs,
      draftRecord.payload?.evidencePhotos,
      opts?.mediaRepo
    );
    const merged = {
      ...initial,
      ...draftRecord.payload,
      formId,
      evidencePhotos: hydrated.photos,
    } as Extract<AnyTeacherTestOrEvaluationFormState, { formId: K }>;

    return {
      draftRecord,
      formData: merged,
      mediaRefs: draftRecord.mediaRefs || [],
      integrityWarnings: hydrated.integrityWarnings,
    };
  }

  const legacyData = loadLegacyTestEvalDraft(
    formId,
    opts?.settings,
    opts?.storage
  );
  return {
    draftRecord: null,
    formData: legacyData,
    mediaRefs: [],
    integrityWarnings: [],
  };
}

export async function loadArchivedTestEvalWithMedia<
  K extends TeacherTestsAndEvaluationFormId,
>(
  recordId: string,
  opts?: {
    formId?: K;
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  record: TeacherTestEvalArchiveRecord;
  formData: AnyTeacherTestOrEvaluationFormState;
  integrityWarnings: string[];
} | null> {
  const store = loadTestsEvalArchiveStore(opts?.storage);
  const record = store.records?.[recordId];
  if (!record) return null;

  const targetFormId = (opts?.formId ||
    record.formId) as TeacherTestsAndEvaluationFormId;
  if (record.formId !== targetFormId) return null;

  const initial = createInitialTestOrEvaluationState(
    targetFormId,
    resolveFullSettings(opts?.settings)
  );
  const hydrated = await hydrateEvidencePhotosFromMediaRepo(
    record.mediaRefs,
    record.payload?.evidencePhotos,
    opts?.mediaRepo
  );

  const formData = {
    ...initial,
    ...record.payload,
    formId: targetFormId,
    evidencePhotos: hydrated.photos,
  } as AnyTeacherTestOrEvaluationFormState;

  return {
    record,
    formData,
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export async function saveActiveTestEvalDraftWithMedia(
  data: AnyTeacherTestOrEvaluationFormState,
  opts?: {
    draftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherTestsEvalArchiveStore;
  draftRecord: TeacherTestEvalArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadTestsEvalArchiveStore(opts?.storage);
  const previousDraftRefs =
    opts?.existingMediaRefs ??
    currentStore.activeDraftByFormId?.[data.formId]?.mediaRefs ??
    [];

  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    previousDraftRefs,
    mediaRepo,
    'upload'
  );

  // Keep legacy key continuously synchronized for zero-breakage fallback continuity
  saveLegacyTestEvalDraft(data, opts?.storage);

  const { nextStore, draftRecord } = upsertDraftRecord(currentStore, {
    id: opts?.draftId,
    formId: data.formId,
    title: getTeacherTestEvalRecordTitle(data.formId, data),
    summary: getTeacherTestEvalRecordSummary(data.formId, data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherTestEvalEventDate(data.formId, data),
    mediaRefs,
    payload: stripBase64PhotosFromTestEvalPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // Clean up removed blobs only if globally unreferenced across Groups 1-5
  const newBlobKeySet = new Set(mediaRefs.map((r) => r.blobKey));
  for (const prevRef of previousDraftRefs) {
    if (!newBlobKeySet.has(prevRef.blobKey)) {
      await deleteBlobIfUnreferenced(prevRef.blobKey, {
        storage: opts?.storage,
        extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
        repo: mediaRepo,
      });
    }
  }

  return { store: nextStore, draftRecord, mediaRefs };
}

export async function saveTestEvalToArchive(
  data: AnyTeacherTestOrEvaluationFormState,
  opts?: {
    recordId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherTestsEvalArchiveStore;
  record: TeacherTestEvalArchiveRecord;
  isNew: boolean;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadTestsEvalArchiveStore(opts?.storage);
  const previousRecord = opts?.recordId
    ? currentStore.records?.[opts.recordId]
    : undefined;
  const previousRefs =
    opts?.existingMediaRefs ?? previousRecord?.mediaRefs ?? [];

  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    previousRefs,
    mediaRepo,
    'upload'
  );

  const { nextStore, record, isNew } = upsertArchivedRecord(currentStore, {
    id: opts?.recordId,
    formId: data.formId,
    title: getTeacherTestEvalRecordTitle(data.formId, data),
    summary: getTeacherTestEvalRecordSummary(data.formId, data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherTestEvalEventDate(data.formId, data),
    mediaRefs,
    payload: stripBase64PhotosFromTestEvalPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // Clean up replaced/removed blobs only if globally unreferenced across Groups 1-5
  if (previousRecord) {
    const newBlobKeySet = new Set(mediaRefs.map((r) => r.blobKey));
    for (const prevRef of previousRefs) {
      if (!newBlobKeySet.has(prevRef.blobKey)) {
        await deleteBlobIfUnreferenced(prevRef.blobKey, {
          storage: opts?.storage,
          extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
          repo: mediaRepo,
        });
      }
    }
  }

  return {
    store: nextStore,
    record,
    isNew,
    mediaRefs,
  };
}

export function createNewBlankTestEvalInArchive<
  K extends TeacherTestsAndEvaluationFormId,
>(
  formId: K,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): {
  store: TeacherTestsEvalArchiveStore;
  draftRecord: TeacherTestEvalArchiveRecord;
  formData: Extract<AnyTeacherTestOrEvaluationFormState, { formId: K }>;
} {
  const freshData = createInitialTestOrEvaluationState(
    formId,
    resolveFullSettings(opts?.settings)
  ) as Extract<AnyTeacherTestOrEvaluationFormState, { formId: K }>;
  const currentStore = loadTestsEvalArchiveStore(opts?.storage);
  const meta = TEACHER_TESTS_AND_EVALUATION_CATALOG.find(
    (item) => item.id === formId
  );

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId,
    title: `مسودة ${meta?.shortTitle || 'اختبار أو تقويم'} جديدة`,
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromTestEvalPayload(freshData),
  });

  saveGroupArchiveStore(
    TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
  };
}

export function inspectArchivedTestEvalDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): RecordDeletionImpact {
  const store = loadTestsEvalArchiveStore(opts?.storage);
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

  // Scan external archive stores (Groups 1–4) for accurate cross-group ref-counting
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

export async function deleteArchivedTestEvalRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherTestsEvalArchiveStore;
  result: SafeDeleteRecordResult;
}> {
  const store = loadTestsEvalArchiveStore(opts?.storage);
  return deleteArchivedRecordSafely(
    TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
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
