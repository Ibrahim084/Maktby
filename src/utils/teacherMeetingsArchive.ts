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
  MEETING_AGENDA_PRESETS,
  MEETING_DECISION_PRESETS,
  MeetingMinutesFormState,
  resolveMeetingTypeText,
} from './teacherMeetingsAndVisitsEngine';

export const TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_meetings_archive_v1';

export const MEETING_MINUTES_LEGACY_DRAFT_KEY =
  'maktabi_teacher_meeting_visit_draft_v2_meeting-minutes';

const EXTERNAL_ARCHIVE_KEYS = [
  'maktabi_teacher_reports_archive_v1',
  'maktabi_teacher_plans_archive_v1',
] as const;

const CROSS_GROUP_ARCHIVE_KEYS = [
  ...EXTERNAL_ARCHIVE_KEYS,
  TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
] as const;

export type TeacherMeetingsArchiveStore =
  TeacherGroupArchiveStore<MeetingMinutesFormState>;

export type TeacherMeetingArchiveRecord =
  TeacherArchiveRecord<MeetingMinutesFormState>;

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

export function loadLegacyMeetingMinutesDraft(
  settings?: Partial<SchoolSettings>,
  storage?: StorageLike
): MeetingMinutesFormState {
  const full = resolveFullSettings(settings);
  const fallback = createInitialMeetingOrVisitState(
    'meeting-minutes',
    full
  ) as MeetingMinutesFormState;
  const store = resolveStorageSafe(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(MEETING_MINUTES_LEGACY_DRAFT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MeetingMinutesFormState>;
    if (!parsed || parsed.formId !== 'meeting-minutes') return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveLegacyMeetingMinutesDraft(
  data: MeetingMinutesFormState,
  storage?: StorageLike
): void {
  const store = resolveStorageSafe(storage);
  if (!store) return;
  try {
    store.setItem(MEETING_MINUTES_LEGACY_DRAFT_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

// ============================================================================
// Metadata & Sanitization Helpers for Meeting Minutes (`meeting-minutes`)
// ============================================================================
export function getTeacherMeetingRecordTitle(
  data: Partial<MeetingMinutesFormState>
): string {
  const title = (data.meetingTitle || '').trim();
  if (title) return title;

  const typeLabel = data.meetingType
    ? resolveMeetingTypeText(data.meetingType, data.customMeetingType || '')
    : '';
  const datePart = (data.meetingDate || '').trim();
  const combined = [typeLabel, datePart].filter(Boolean).join(' — ');
  return combined || 'محضر اجتماع';
}

export function getTeacherMeetingEventDate(
  data: Partial<MeetingMinutesFormState>
): string {
  return (data.meetingDate || '').trim();
}

export function getTeacherMeetingRecordSummary(
  data: Partial<MeetingMinutesFormState>
): string {
  const parts: string[] = [];
  if (data.meetingType) {
    const typeLabel = resolveMeetingTypeText(
      data.meetingType,
      data.customMeetingType || ''
    );
    if (typeLabel) parts.push(typeLabel);
  }
  if (data.meetingLocation?.trim()) {
    parts.push(data.meetingLocation.trim());
  }
  if (data.meetingDate?.trim()) {
    parts.push(data.meetingDate.trim());
  }
  if (data.enableAttendanceSheet && Array.isArray(data.attendees)) {
    const namedCount = data.attendees.filter((a) =>
      Boolean(a?.attendeeName?.trim())
    ).length;
    if (namedCount > 0) {
      parts.push(`الحضور: ${namedCount}`);
    }
  }
  return Array.from(new Set(parts)).join(' · ');
}

export function stripBase64PhotosFromMeetingPayload(
  data: MeetingMinutesFormState
): MeetingMinutesFormState {
  return {
    ...data,
    evidencePhotos: [],
  };
}

/**
 * Determines whether a legacy stored meeting-minutes object has zero meaningful
 * user-entered data (only factory defaults / auto-filled executorName or default presets).
 */
export function isLegacyMeetingMinutesEmpty(
  rawData: Partial<MeetingMinutesFormState> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  if (!rawData || typeof rawData !== 'object') return true;
  if (rawData.formId && rawData.formId !== 'meeting-minutes') return true;

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
      rawData.meetingTitle,
      rawData.customMeetingType,
      rawData.meetingDate,
      rawData.meetingTime,
      rawData.meetingLocation,
      rawData.customExecutorRole,
      rawData.closingNote,
      rawData.recorderName
    )
  ) {
    return false;
  }

  if (
    rawData.meetingType &&
    rawData.meetingType !== 'اجتماع تخصص أو قسم'
  ) {
    return false;
  }

  if (rawData.executorRoleType && rawData.executorRoleType !== 'منظّم') {
    return false;
  }

  const settingsTeacher = (settings?.userName || '').trim();
  const draftExecutor = (rawData.executorName || '').trim();
  if (Boolean(draftExecutor) && draftExecutor !== settingsTeacher) {
    return false;
  }

  if (Array.isArray(rawData.agendaItems)) {
    if (rawData.agendaItems.length > 1) return false;
    const hasAgendaContent = rawData.agendaItems.some(
      (item) =>
        hasNonEmpty(item?.customTitle, item?.discussion) ||
        (Boolean(item?.selectedPreset) &&
          item.selectedPreset !== MEETING_AGENDA_PRESETS[0])
    );
    if (hasAgendaContent) return false;
  }

  if (Array.isArray(rawData.decisions)) {
    if (rawData.decisions.length > 1) return false;
    const hasDecisionContent = rawData.decisions.some(
      (item) =>
        hasNonEmpty(
          item?.customDecisionText,
          item?.responsiblePerson,
          item?.executionDeadline
        ) ||
        (Boolean(item?.selectedPreset) &&
          item.selectedPreset !== MEETING_DECISION_PRESETS[0])
    );
    if (hasDecisionContent) return false;
  }

  if (rawData.enableAttendanceSheet === true) return false;
  if (
    Array.isArray(rawData.attendees) &&
    rawData.attendees.some((a) => Boolean(a?.attendeeName?.trim()))
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// Group 3 Migration & Rollback for Meeting Minutes ONLY (Not Peer Visits)
// ============================================================================
export async function migrateMeetingMinutesToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  return runIdempotentGroupMigration<
    MeetingMinutesFormState,
    MeetingMinutesFormState
  >({
    groupId: 'meetings-visits',
    legacyStorageKey: MEETING_MINUTES_LEGACY_DRAFT_KEY,
    archiveStorageKey: TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];

      let parsed: Partial<MeetingMinutesFormState> | undefined;
      try {
        const raw = storage.getItem(MEETING_MINUTES_LEGACY_DRAFT_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object' && obj.formId === 'meeting-minutes') {
            parsed = obj as Partial<MeetingMinutesFormState>;
          }
        }
      } catch {
        parsed = undefined;
      }

      if (!parsed) return [];

      const merged = {
        ...(createInitialMeetingOrVisitState(
          'meeting-minutes',
          resolveFullSettings(opts?.settings)
        ) as MeetingMinutesFormState),
        ...parsed,
        formId: 'meeting-minutes' as const,
      };

      const isEmpty = isLegacyMeetingMinutesEmpty(parsed, opts?.settings);

      const candidate: LegacyMigrationCandidate<MeetingMinutesFormState> = {
        sourceKey: 'legacy_meeting_minutes_draft:meeting-minutes',
        formId: 'meeting-minutes',
        title: getTeacherMeetingRecordTitle(merged),
        summary: getTeacherMeetingRecordSummary(merged),
        academicYear: opts?.settings?.academicYear || '',
        semester: opts?.settings?.semester || '',
        eventDate: getTeacherMeetingEventDate(merged),
        isEmpty,
        // Architectural invariant: legacy draft stays a non-eligible draft until explicitly saved
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
        sanitizedPayload: stripBase64PhotosFromMeetingPayload(legacyData),
        mediaRefs,
        newlyCreatedBlobKeys,
      };
    },
  });
}

export async function rollbackMeetingMinutesMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'meetings-visits',
    archiveStorageKey: TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
  });
}

// ============================================================================
// Archive Store Operations for Meeting Minutes UI & Unit Tests
// ============================================================================
export function loadMeetingsArchiveStore(
  storage?: StorageLike
): TeacherMeetingsArchiveStore {
  return loadGroupArchiveStore<MeetingMinutesFormState>(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    'meetings-visits',
    storage
  );
}

export function listSavedMeetings(
  storage?: StorageLike
): TeacherMeetingArchiveRecord[] {
  const store = loadMeetingsArchiveStore(storage);
  return listArchivedRecords(store, 'meeting-minutes');
}

export async function loadActiveMeetingDraftWithMedia(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  draftRecord: TeacherMeetingArchiveRecord | null;
  formData: MeetingMinutesFormState;
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
}> {
  const store = loadMeetingsArchiveStore(opts?.storage);
  const draftRecord = store.activeDraftByFormId?.['meeting-minutes'] ?? null;
  const initial = createInitialMeetingOrVisitState(
    'meeting-minutes',
    resolveFullSettings(opts?.settings)
  ) as MeetingMinutesFormState;

  if (draftRecord && draftRecord.formId === 'meeting-minutes') {
    const hydrated = await hydrateEvidencePhotosFromMediaRepo(
      draftRecord.mediaRefs,
      draftRecord.payload?.evidencePhotos,
      opts?.mediaRepo
    );
    const merged: MeetingMinutesFormState = {
      ...initial,
      ...draftRecord.payload,
      formId: 'meeting-minutes',
      evidencePhotos: hydrated.photos,
    };
    if (!merged.executorName?.trim() && opts?.settings?.userName?.trim()) {
      merged.executorName = opts.settings.userName.trim();
    }
    return {
      draftRecord,
      formData: merged,
      mediaRefs: draftRecord.mediaRefs || [],
      integrityWarnings: hydrated.integrityWarnings,
    };
  }

  const legacyData = loadLegacyMeetingMinutesDraft(
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

export async function loadArchivedMeetingWithMedia(
  recordId: string,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  record: TeacherMeetingArchiveRecord;
  formData: MeetingMinutesFormState;
  integrityWarnings: string[];
} | null> {
  const store = loadMeetingsArchiveStore(opts?.storage);
  const record = store.records?.[recordId];
  if (!record || record.formId !== 'meeting-minutes') return null;

  const initial = createInitialMeetingOrVisitState(
    'meeting-minutes',
    resolveFullSettings(opts?.settings)
  ) as MeetingMinutesFormState;

  const hydrated = await hydrateEvidencePhotosFromMediaRepo(
    record.mediaRefs,
    record.payload?.evidencePhotos,
    opts?.mediaRepo
  );

  const formData: MeetingMinutesFormState = {
    ...initial,
    ...record.payload,
    formId: 'meeting-minutes',
    evidencePhotos: hydrated.photos,
  };

  return {
    record,
    formData,
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export async function saveActiveMeetingDraftWithMedia(
  data: MeetingMinutesFormState,
  opts?: {
    draftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherMeetingsArchiveStore;
  draftRecord: TeacherMeetingArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadMeetingsArchiveStore(opts?.storage);
  const previousDraftRefs =
    opts?.existingMediaRefs ??
    currentStore.activeDraftByFormId?.['meeting-minutes']?.mediaRefs ??
    [];

  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    previousDraftRefs,
    mediaRepo,
    'upload'
  );

  // Keep legacy storage key continuously synchronized for backward continuity
  saveLegacyMeetingMinutesDraft(data, opts?.storage);

  const { nextStore, draftRecord } = upsertDraftRecord(currentStore, {
    id: opts?.draftId,
    formId: 'meeting-minutes',
    title: getTeacherMeetingRecordTitle(data),
    summary: getTeacherMeetingRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherMeetingEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromMeetingPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
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

export async function saveMeetingToArchive(
  data: MeetingMinutesFormState,
  opts?: {
    recordId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherMeetingsArchiveStore;
  record: TeacherMeetingArchiveRecord;
  isNew: boolean;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadMeetingsArchiveStore(opts?.storage);
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
    formId: 'meeting-minutes',
    title: getTeacherMeetingRecordTitle(data),
    summary: getTeacherMeetingRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherMeetingEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromMeetingPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // When updating an archived meeting and replacing/removing photos, check global ref counts
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

export function createNewBlankMeetingInArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
}): {
  store: TeacherMeetingsArchiveStore;
  draftRecord: TeacherMeetingArchiveRecord;
  formData: MeetingMinutesFormState;
} {
  const freshData = createInitialMeetingOrVisitState(
    'meeting-minutes',
    resolveFullSettings(opts?.settings)
  ) as MeetingMinutesFormState;
  const currentStore = loadMeetingsArchiveStore(opts?.storage);

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId: 'meeting-minutes',
    title: 'مسودة محضر اجتماع جديد',
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromMeetingPayload(freshData),
  });

  saveGroupArchiveStore(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
  };
}

export function inspectArchivedMeetingDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): RecordDeletionImpact {
  const store = loadMeetingsArchiveStore(opts?.storage);
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

  // Scan cross-group archives (Group 1 reports + Group 2 plans) so sharedBlobKeys reflects reality
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

export async function deleteArchivedMeetingRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherMeetingsArchiveStore;
  result: SafeDeleteRecordResult;
}> {
  const store = loadMeetingsArchiveStore(opts?.storage);
  return deleteArchivedRecordSafely(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
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
