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
  createInitialMeetingOrVisitState,
  PEER_VISIT_PRACTICE_TO_APPLY_PRESETS,
  PEER_VISIT_TAKEAWAY_PRESETS,
  PeerVisitReportFormState,
  resolvePeerVisitTopicText,
} from './teacherMeetingsAndVisitsEngine';

export const TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_peer_visits_archive_v1';

export const PEER_VISIT_LEGACY_DRAFT_KEY =
  'maktabi_teacher_meeting_visit_draft_v2_peer-visit-report';

const EXTERNAL_ARCHIVE_KEYS = [
  'maktabi_teacher_reports_archive_v1',
  'maktabi_teacher_plans_archive_v1',
  'maktabi_teacher_meetings_archive_v1',
] as const;

const CROSS_GROUP_ARCHIVE_KEYS = [
  ...EXTERNAL_ARCHIVE_KEYS,
  TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
] as const;

export type TeacherPeerVisitsArchiveStore =
  TeacherGroupArchiveStore<PeerVisitReportFormState>;

export type TeacherPeerVisitArchiveRecord =
  TeacherArchiveRecord<PeerVisitReportFormState>;

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

export function loadLegacyPeerVisitDraft(
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): PeerVisitReportFormState {
  const full = resolveFullSettings(settings);
  const fallback = createInitialMeetingOrVisitState(
    'peer-visit-report',
    full
  ) as PeerVisitReportFormState;
  const store = resolveStorageSafe(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(PEER_VISIT_LEGACY_DRAFT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PeerVisitReportFormState>;
    if (!parsed || parsed.formId !== 'peer-visit-report') return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveLegacyPeerVisitDraft(
  data: PeerVisitReportFormState,
  storage?: StorageLike
): void {
  const store = resolveStorageSafe(storage);
  if (!store) return;
  try {
    store.setItem(PEER_VISIT_LEGACY_DRAFT_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// ============================================================================
// Metadata & Sanitization Helpers for Peer Visit Report (`peer-visit-report`)
// ============================================================================
export function getTeacherPeerVisitRecordTitle(
  data: Partial<PeerVisitReportFormState>
): string {
  const practiceTitle = (data.observedPracticeTitle || '').trim();
  if (practiceTitle) return practiceTitle;

  const topicText = data.visitTopic
    ? resolvePeerVisitTopicText(data.visitTopic, data.customVisitTopic || '')
    : '';
  const host = (data.hostTeacherName || '').trim();
  if (topicText && host) {
    return `زيارة تبادلية: ${topicText} (${host})`;
  }
  if (topicText) {
    return `زيارة تبادلية: ${topicText}`;
  }
  return 'تقرير زيارة تبادلية بين المعلمين';
}

export function getTeacherPeerVisitEventDate(
  data: Partial<PeerVisitReportFormState>
): string {
  return (data.visitDate || '').trim();
}

export function getTeacherPeerVisitRecordSummary(
  data: Partial<PeerVisitReportFormState>
): string {
  const parts: string[] = [];
  if (data.visitScope) parts.push(data.visitScope);
  if (data.visitTopic) {
    const topicText = resolvePeerVisitTopicText(
      data.visitTopic,
      data.customVisitTopic || ''
    );
    if (topicText) parts.push(topicText);
  }
  if (data.hostTeacherName?.trim()) {
    parts.push(`المستضيف: ${data.hostTeacherName.trim()}`);
  }
  if (data.visitDate?.trim()) {
    parts.push(data.visitDate.trim());
  }
  return Array.from(new Set(parts)).join(' · ');
}

export function stripBase64PhotosFromPeerVisitPayload(
  data: PeerVisitReportFormState
): PeerVisitReportFormState {
  return {
    ...data,
    evidencePhotos: [],
  };
}

/**
 * Determines whether a legacy stored peer-visit-report object has zero meaningful
 * user-entered data (only factory defaults / settings-derived teacher name & specialization).
 */
export function isLegacyPeerVisitEmpty(
  rawData: Partial<PeerVisitReportFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  if (!rawData || typeof rawData !== 'object') return true;
  if (rawData.formId && rawData.formId !== 'peer-visit-report') return true;

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
      rawData.hostTeacherName,
      rawData.gradeOrStage,
      rawData.customVisitTopic,
      rawData.visitDate,
      rawData.observedPracticeTitle,
      rawData.observedPracticeDescription,
      rawData.additionalVisitDetails,
      rawData.keyTakeaways,
      rawData.practiceToApply
    )
  ) {
    return false;
  }

  if (
    rawData.visitScope &&
    rawData.visitScope !== 'بين معلمي التخصص نفسه'
  ) {
    return false;
  }

  if (rawData.visitTopic && rawData.visitTopic !== 'استراتيجيات التدريس') {
    return false;
  }

  if (
    rawData.selectedTakeawayPreset &&
    rawData.selectedTakeawayPreset !== PEER_VISIT_TAKEAWAY_PRESETS[0]
  ) {
    return false;
  }

  if (
    rawData.selectedPracticeToApplyPreset &&
    rawData.selectedPracticeToApplyPreset !==
      PEER_VISIT_PRACTICE_TO_APPLY_PRESETS[0]
  ) {
    return false;
  }

  if (rawData.enableTeacherSignatures === true) {
    return false;
  }

  const settingsTeacher = (settings?.userName || '').trim();
  const draftVisitingTeacher = (rawData.visitingTeacherName || '').trim();
  if (
    Boolean(draftVisitingTeacher) &&
    draftVisitingTeacher !== settingsTeacher
  ) {
    return false;
  }

  const defaultSubject =
    settings?.roles?.teacher?.replace(/^معلم(?:ة)?\s+/, '').trim() || '';
  const draftSpec = (rawData.specialization || '').trim();
  if (Boolean(draftSpec) && draftSpec !== defaultSubject) {
    return false;
  }

  return true;
}

// ============================================================================
// Group 4 Migration & Rollback for Peer Visit Reports (`peer-visit-report`)
// ============================================================================
export async function migratePeerVisitsToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  return runIdempotentGroupMigration<
    PeerVisitReportFormState,
    PeerVisitReportFormState
  >({
    groupId: 'peer-visits',
    legacyStorageKey: PEER_VISIT_LEGACY_DRAFT_KEY,
    archiveStorageKey: TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];

      let parsed: Partial<PeerVisitReportFormState> | undefined;
      try {
        const raw = storage.getItem(PEER_VISIT_LEGACY_DRAFT_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (
            obj &&
            typeof obj === 'object' &&
            obj.formId === 'peer-visit-report'
          ) {
            parsed = obj as Partial<PeerVisitReportFormState>;
          }
        }
      } catch {
        parsed = undefined;
      }

      if (!parsed) return [];

      const merged = {
        ...(createInitialMeetingOrVisitState(
          'peer-visit-report',
          resolveFullSettings(opts?.settings)
        ) as PeerVisitReportFormState),
        ...parsed,
        formId: 'peer-visit-report' as const,
      };

      const isEmpty = isLegacyPeerVisitEmpty(parsed, opts?.settings);

      const candidate: LegacyMigrationCandidate<PeerVisitReportFormState> = {
        sourceKey: 'legacy_peer_visit_draft:peer-visit-report',
        formId: 'peer-visit-report',
        title: getTeacherPeerVisitRecordTitle(merged),
        summary: getTeacherPeerVisitRecordSummary(merged),
        academicYear: opts?.settings?.academicYear || '',
        semester: opts?.settings?.semester || '',
        eventDate: getTeacherPeerVisitEventDate(merged),
        isEmpty,
        // Architectural invariant: legacy draft stays non-eligible draft until explicitly saved
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
        sanitizedPayload: stripBase64PhotosFromPeerVisitPayload(legacyData),
        mediaRefs,
        newlyCreatedBlobKeys,
      };
    },
  });
}

export async function rollbackPeerVisitsMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'peer-visits',
    archiveStorageKey: TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
  });
}

// ============================================================================
// Archive Store Operations for Peer Visit Report UI & Unit Tests
// ============================================================================
export function loadPeerVisitsArchiveStore(
  storage?: StorageLike
): TeacherPeerVisitsArchiveStore {
  return loadGroupArchiveStore<PeerVisitReportFormState>(
    TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
    'peer-visits',
    storage
  );
}

export function listSavedPeerVisits(
  storage?: StorageLike
): TeacherPeerVisitArchiveRecord[] {
  const store = loadPeerVisitsArchiveStore(storage);
  return listArchivedRecords(store, 'peer-visit-report');
}

export async function loadActivePeerVisitDraftWithMedia(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  draftRecord: TeacherPeerVisitArchiveRecord | null;
  formData: PeerVisitReportFormState;
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
}> {
  const store = loadPeerVisitsArchiveStore(opts?.storage);
  const draftRecord =
    store.activeDraftByFormId?.['peer-visit-report'] ?? null;
  const initial = createInitialMeetingOrVisitState(
    'peer-visit-report',
    resolveFullSettings(opts?.settings)
  ) as PeerVisitReportFormState;

  if (draftRecord && draftRecord.formId === 'peer-visit-report') {
    const hydrated = await hydrateEvidencePhotosFromMediaRepo(
      draftRecord.mediaRefs,
      draftRecord.payload?.evidencePhotos,
      opts?.mediaRepo
    );
    const merged: PeerVisitReportFormState = {
      ...initial,
      ...draftRecord.payload,
      formId: 'peer-visit-report',
      evidencePhotos: hydrated.photos,
    };
    if (
      !merged.visitingTeacherName?.trim() &&
      opts?.settings?.userName?.trim()
    ) {
      merged.visitingTeacherName = opts.settings.userName.trim();
    }
    return {
      draftRecord,
      formData: merged,
      mediaRefs: draftRecord.mediaRefs || [],
      integrityWarnings: hydrated.integrityWarnings,
    };
  }

  const legacyData = loadLegacyPeerVisitDraft(opts?.settings, opts?.storage);
  return {
    draftRecord: null,
    formData: legacyData,
    mediaRefs: [],
    integrityWarnings: [],
  };
}

export async function loadArchivedPeerVisitWithMedia(
  recordId: string,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  record: TeacherPeerVisitArchiveRecord;
  formData: PeerVisitReportFormState;
  integrityWarnings: string[];
} | null> {
  const store = loadPeerVisitsArchiveStore(opts?.storage);
  const record = store.records?.[recordId];
  if (!record || record.formId !== 'peer-visit-report') return null;

  const initial = createInitialMeetingOrVisitState(
    'peer-visit-report',
    resolveFullSettings(opts?.settings)
  ) as PeerVisitReportFormState;

  const hydrated = await hydrateEvidencePhotosFromMediaRepo(
    record.mediaRefs,
    record.payload?.evidencePhotos,
    opts?.mediaRepo
  );

  const formData: PeerVisitReportFormState = {
    ...initial,
    ...record.payload,
    formId: 'peer-visit-report',
    evidencePhotos: hydrated.photos,
  };

  return {
    record,
    formData,
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export async function saveActivePeerVisitDraftWithMedia(
  data: PeerVisitReportFormState,
  opts?: {
    draftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherPeerVisitsArchiveStore;
  draftRecord: TeacherPeerVisitArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadPeerVisitsArchiveStore(opts?.storage);
  const previousDraftRefs =
    opts?.existingMediaRefs ??
    currentStore.activeDraftByFormId?.['peer-visit-report']?.mediaRefs ??
    [];

  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    previousDraftRefs,
    mediaRepo,
    'upload'
  );

  // Keep legacy key continuously synchronized without breaking backward continuity
  saveLegacyPeerVisitDraft(data, opts?.storage);

  const { nextStore, draftRecord } = upsertDraftRecord(currentStore, {
    id: opts?.draftId,
    formId: 'peer-visit-report',
    title: getTeacherPeerVisitRecordTitle(data),
    summary: getTeacherPeerVisitRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherPeerVisitEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromPeerVisitPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // Clean up any blob keys removed from this draft ONLY if globally unreferenced
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

export async function savePeerVisitToArchive(
  data: PeerVisitReportFormState,
  opts?: {
    recordId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherPeerVisitsArchiveStore;
  record: TeacherPeerVisitArchiveRecord;
  isNew: boolean;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadPeerVisitsArchiveStore(opts?.storage);
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
    formId: 'peer-visit-report',
    title: getTeacherPeerVisitRecordTitle(data),
    summary: getTeacherPeerVisitRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherPeerVisitEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromPeerVisitPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // Clean up replaced/removed attachments only when unreferenced globally across all groups
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

export function createNewBlankPeerVisitInArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
}): {
  store: TeacherPeerVisitsArchiveStore;
  draftRecord: TeacherPeerVisitArchiveRecord;
  formData: PeerVisitReportFormState;
} {
  const freshData = createInitialMeetingOrVisitState(
    'peer-visit-report',
    resolveFullSettings(opts?.settings)
  ) as PeerVisitReportFormState;
  const currentStore = loadPeerVisitsArchiveStore(opts?.storage);

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId: 'peer-visit-report',
    title: 'مسودة تقرير زيارة تبادلية جديد',
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromPeerVisitPayload(freshData),
  });

  saveGroupArchiveStore(
    TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
  };
}

export function inspectArchivedPeerVisitDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): RecordDeletionImpact {
  const store = loadPeerVisitsArchiveStore(opts?.storage);
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

  // Scan external archive stores (Group 1, Group 2, Group 3) for cross-group ref-counting
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

export async function deleteArchivedPeerVisitRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherPeerVisitsArchiveStore;
  result: SafeDeleteRecordResult;
}> {
  const store = loadPeerVisitsArchiveStore(opts?.storage);
  return deleteArchivedRecordSafely(
    TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
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
