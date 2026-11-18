import {
  deleteBlobIfUnreferenced,
  getDefaultTeacherMediaRepository,
  loadMediaBlobWithIntegrityCheck,
  saveMediaDataUrl,
  TeacherMediaRepository,
  UnifiedMediaRef,
} from './teacherMediaStorage';

// ============================================================================
// Constants & Storage Keys
// ============================================================================
export const TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY =
  'maktabi_teacher_archive_migration_v1';

/**
 * Portfolio storage key checked read/unlink-only during reference-guarded delete.
 * Full Portfolio UI is out of scope for this phase; this ensures safe unlinking works
 * cleanly when portfolio links exist.
 */
export const TEACHER_PORTFOLIO_STORAGE_KEY = 'maktabi_teacher_portfolio_v1';

export type TeacherArchiveGroupId =
  | 'professional-reports'
  | 'plans'
  | 'meetings-visits'
  | 'peer-visits'
  | 'tests-evaluation'
  | 'programs-activities'
  | 'certificates';

export type TeacherArchiveRecordState = 'draft' | 'archived_saved';

export interface TeacherArchiveRecord<TPayload = Record<string, unknown>> {
  id: string;
  groupId: TeacherArchiveGroupId;
  formId: string;
  title: string;
  summary?: string;
  recordState: TeacherArchiveRecordState;
  /** Drafts MUST remain false; only archived_saved records may qualify. */
  isPortfolioEligible: boolean;
  academicYear: string;
  semester: string;
  eventDate: string;
  mediaRefs: UnifiedMediaRef[];
  createdAt: string;
  updatedAt: string;
  migratedFromLegacyKey?: string;
  payload: TPayload;
}

export interface TeacherGroupArchiveStore<TPayload = Record<string, unknown>> {
  schemaVersion: 1;
  groupId: TeacherArchiveGroupId;
  records: Record<string, TeacherArchiveRecord<TPayload>>;
  activeDraftByFormId: Record<string, TeacherArchiveRecord<TPayload>>;
  updatedAt: string;
}

export interface GroupMigrationSourceEntry {
  migratedRecordId: string;
  migratedAt: string;
  recordState: TeacherArchiveRecordState;
}

export interface GroupMigrationLogEntry {
  groupId: TeacherArchiveGroupId;
  legacyStorageKey: string;
  completedSources: Record<string, GroupMigrationSourceEntry>;
  createdRecordIds: string[];
  createdBlobKeys: string[];
  preMigrationArchiveRaw: string | null;
  lastRunAt: string;
  rolledBackAt?: string;
}

export interface TeacherArchiveMigrationState {
  schemaVersion: 1;
  groups: Partial<Record<TeacherArchiveGroupId, GroupMigrationLogEntry>>;
}

export interface PortfolioLinkRef {
  elementId: string;
  elementTitle: string;
}

export interface RecordDeletionImpact {
  recordId: string;
  groupId: TeacherArchiveGroupId;
  isLinked: boolean;
  linkedElements: PortfolioLinkRef[];
  recordBlobKeys: string[];
  sharedBlobKeys: string[];
  exclusiveBlobKeys: string[];
  warningMessage: string | null;
}

export interface SafeDeleteRecordResult {
  deleted: boolean;
  requiresConfirmation?: boolean;
  impact: RecordDeletionImpact;
  unlinkedElementIds: string[];
  removedBlobKeys: string[];
  preservedSharedBlobKeys: string[];
}

// ============================================================================
// Storage Access & ID Generation Helpers
// ============================================================================
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function generateImmutableRecordId(prefix = 'trec'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `${prefix}_${uuid}`;
  }
  const timePart = Date.now().toString(36);
  const randA = Math.floor(Math.random() * 0xffffffff)
    .toString(36)
    .padStart(6, '0');
  const randB = Math.floor(Math.random() * 0xffffffff)
    .toString(36)
    .padStart(6, '0');
  return `${prefix}_${timePart}_${randA}${randB}`;
}

export function createEmptyGroupArchiveStore<TPayload = Record<string, unknown>>(
  groupId: TeacherArchiveGroupId
): TeacherGroupArchiveStore<TPayload> {
  return {
    schemaVersion: 1,
    groupId,
    records: {},
    activeDraftByFormId: {},
    updatedAt: new Date().toISOString(),
  };
}

export function loadGroupArchiveStore<TPayload = Record<string, unknown>>(
  archiveStorageKey: string,
  groupId: TeacherArchiveGroupId,
  storage?: StorageLike
): TeacherGroupArchiveStore<TPayload> {
  const store = resolveStorage(storage);
  const empty = createEmptyGroupArchiveStore<TPayload>(groupId);
  if (!store) return empty;

  try {
    const raw = store.getItem(archiveStorageKey);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<TeacherGroupArchiveStore<TPayload>>;
    if (!parsed || typeof parsed !== 'object') return empty;

    return {
      schemaVersion: 1,
      groupId,
      records:
        parsed.records && typeof parsed.records === 'object'
          ? parsed.records
          : {},
      activeDraftByFormId:
        parsed.activeDraftByFormId &&
        typeof parsed.activeDraftByFormId === 'object'
          ? parsed.activeDraftByFormId
          : {},
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : empty.updatedAt,
    };
  } catch {
    return empty;
  }
}

export function saveGroupArchiveStore<TPayload = Record<string, unknown>>(
  archiveStorageKey: string,
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  storage?: StorageLike
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    const updated: TeacherGroupArchiveStore<TPayload> = {
      ...archiveStore,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    store.setItem(archiveStorageKey, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Multi-Record Archive CRUD (Strict Draft vs Archived_Saved Separation)
// ============================================================================
export function listArchivedRecords<TPayload = Record<string, unknown>>(
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  formId?: string
): TeacherArchiveRecord<TPayload>[] {
  const all = Object.values(archiveStore.records || {});
  const filtered = formId ? all.filter((r) => r.formId === formId) : all;
  return filtered.sort((a, b) =>
    (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
  );
}

export function getArchivedRecordById<TPayload = Record<string, unknown>>(
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  recordId: string
): TeacherArchiveRecord<TPayload> | null {
  return archiveStore.records?.[recordId] ?? null;
}

export function upsertDraftRecord<TPayload = Record<string, unknown>>(
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  input: {
    id?: string;
    formId: string;
    title: string;
    summary?: string;
    academicYear?: string;
    semester?: string;
    eventDate?: string;
    mediaRefs?: UnifiedMediaRef[];
    migratedFromLegacyKey?: string;
    payload: TPayload;
  }
): {
  nextStore: TeacherGroupArchiveStore<TPayload>;
  draftRecord: TeacherArchiveRecord<TPayload>;
} {
  const nowIso = new Date().toISOString();
  const existingDraft = archiveStore.activeDraftByFormId?.[input.formId];
  const preservedId =
    input.id?.trim() ||
    existingDraft?.id ||
    generateImmutableRecordId('tdraft');

  const draftRecord: TeacherArchiveRecord<TPayload> = {
    id: preservedId,
    groupId: archiveStore.groupId,
    formId: input.formId,
    title: input.title,
    summary: input.summary,
    recordState: 'draft',
    // Architectural invariant: drafts can NEVER become eligible portfolio items automatically
    isPortfolioEligible: false,
    academicYear: input.academicYear || existingDraft?.academicYear || '',
    semester: input.semester || existingDraft?.semester || '',
    eventDate: input.eventDate || '',
    mediaRefs: input.mediaRefs ? [...input.mediaRefs] : [],
    createdAt: existingDraft?.createdAt || nowIso,
    updatedAt: nowIso,
    migratedFromLegacyKey:
      input.migratedFromLegacyKey ?? existingDraft?.migratedFromLegacyKey,
    payload: input.payload,
  };

  return {
    nextStore: {
      ...archiveStore,
      activeDraftByFormId: {
        ...archiveStore.activeDraftByFormId,
        [input.formId]: draftRecord,
      },
      updatedAt: nowIso,
    },
    draftRecord,
  };
}

export function upsertArchivedRecord<TPayload = Record<string, unknown>>(
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  input: {
    id?: string;
    formId: string;
    title: string;
    summary?: string;
    academicYear?: string;
    semester?: string;
    eventDate?: string;
    mediaRefs?: UnifiedMediaRef[];
    payload: TPayload;
  }
): {
  nextStore: TeacherGroupArchiveStore<TPayload>;
  record: TeacherArchiveRecord<TPayload>;
  isNew: boolean;
} {
  const nowIso = new Date().toISOString();
  const existing =
    input.id && archiveStore.records?.[input.id]
      ? archiveStore.records[input.id]
      : undefined;

  // Immutable ID: reuse existing archived record ID on update; otherwise mint permanent trec ID
  const immutableId = existing
    ? existing.id
    : input.id && input.id.startsWith('trec_')
      ? input.id
      : generateImmutableRecordId('trec');

  const record: TeacherArchiveRecord<TPayload> = {
    id: immutableId,
    groupId: archiveStore.groupId,
    formId: input.formId,
    title: input.title,
    summary: input.summary,
    recordState: 'archived_saved',
    isPortfolioEligible: true,
    academicYear: input.academicYear || existing?.academicYear || '',
    semester: input.semester || existing?.semester || '',
    eventDate: input.eventDate || '',
    mediaRefs: input.mediaRefs ? [...input.mediaRefs] : [],
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    payload: input.payload,
  };

  return {
    isNew: !existing,
    record,
    nextStore: {
      ...archiveStore,
      records: {
        ...archiveStore.records,
        [immutableId]: record,
      },
      updatedAt: nowIso,
    },
  };
}

export function startNewBlankDraftInStore<TPayload = Record<string, unknown>>(
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  input: {
    formId: string;
    title: string;
    academicYear?: string;
    semester?: string;
    payload: TPayload;
  }
): {
  nextStore: TeacherGroupArchiveStore<TPayload>;
  draftRecord: TeacherArchiveRecord<TPayload>;
} {
  const nowIso = new Date().toISOString();
  const freshDraft: TeacherArchiveRecord<TPayload> = {
    id: generateImmutableRecordId('tdraft'),
    groupId: archiveStore.groupId,
    formId: input.formId,
    title: input.title,
    recordState: 'draft',
    isPortfolioEligible: false,
    academicYear: input.academicYear || '',
    semester: input.semester || '',
    eventDate: '',
    mediaRefs: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    payload: input.payload,
  };

  return {
    draftRecord: freshDraft,
    nextStore: {
      ...archiveStore,
      activeDraftByFormId: {
        ...archiveStore.activeDraftByFormId,
        [input.formId]: freshDraft,
      },
      updatedAt: nowIso,
    },
  };
}

// ============================================================================
// Portfolio Link Lookup, Pre-Delete Impact Check & Reference-Guarded Delete
// ============================================================================
function inspectPortfolioLinksForRecord(
  groupId: TeacherArchiveGroupId,
  recordId: string,
  storage?: StorageLike
): PortfolioLinkRef[] {
  const store = resolveStorage(storage);
  if (!store) return [];

  try {
    const raw = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return [];

    const refs: PortfolioLinkRef[] = [];
    const elements = parsed.elements;
    if (elements && typeof elements === 'object') {
      for (const [elKey, elVal] of Object.entries(
        elements as Record<string, unknown>
      )) {
        if (!elVal || typeof elVal !== 'object') continue;
        const elObj = elVal as Record<string, unknown>;
        const elTitle =
          (typeof elObj.title === 'string' && elObj.title) ||
          `عنصر الأداء (${elKey})`;

        const candidateLists = [
          elObj.linkedRecords,
          elObj.evidences,
          elObj.links,
        ];
        let matched = false;
        for (const list of candidateLists) {
          if (!Array.isArray(list)) continue;
          for (const item of list) {
            if (!item || typeof item !== 'object') continue;
            const itemObj = item as Record<string, unknown>;
            const idMatch =
              itemObj.sourceRecordId === recordId ||
              itemObj.recordId === recordId;
            const groupMatch =
              !itemObj.sourceGroupId || itemObj.sourceGroupId === groupId;
            if (idMatch && groupMatch) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
        if (matched) {
          refs.push({ elementId: elKey, elementTitle: elTitle });
        }
      }
    }
    return refs;
  } catch {
    return [];
  }
}

function unlinkRecordFromPortfolioAndAudit(
  groupId: TeacherArchiveGroupId,
  recordId: string,
  recordTitle: string,
  storage?: StorageLike
): string[] {
  const store = resolveStorage(storage);
  if (!store) return [];

  try {
    const raw = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return [];

    const unlinkedElementIds: string[] = [];
    const elements = parsed.elements as Record<string, unknown> | undefined;
    if (elements && typeof elements === 'object') {
      for (const [elKey, elVal] of Object.entries(elements)) {
        if (!elVal || typeof elVal !== 'object') continue;
        const elObj = elVal as Record<string, unknown>;
        let changedInEl = false;

        for (const listKey of ['linkedRecords', 'evidences', 'links'] as const) {
          const list = elObj[listKey];
          if (!Array.isArray(list)) continue;
          const nextList = list.filter((item) => {
            if (!item || typeof item !== 'object') return true;
            const itemObj = item as Record<string, unknown>;
            const idMatch =
              itemObj.sourceRecordId === recordId ||
              itemObj.recordId === recordId;
            const groupMatch =
              !itemObj.sourceGroupId || itemObj.sourceGroupId === groupId;
            if (idMatch && groupMatch) {
              changedInEl = true;
              return false;
            }
            return true;
          });
          if (changedInEl) {
            elObj[listKey] = nextList;
          }
        }
        if (changedInEl) {
          unlinkedElementIds.push(elKey);
        }
      }
    }

    if (unlinkedElementIds.length > 0) {
      const existingAudit = Array.isArray(parsed.sourceDeletionAuditLog)
        ? parsed.sourceDeletionAuditLog
        : [];
      parsed.sourceDeletionAuditLog = [
        ...existingAudit,
        {
          id: `audit_${Date.now().toString(36)}`,
          deletedGroupId: groupId,
          deletedRecordId: recordId,
          deletedRecordTitle: recordTitle,
          unlinkedElementIds,
          deletedAt: new Date().toISOString(),
          note: 'تم فك ارتباط الشاهد بعد تأكيد حذف السجل الأصلي من الأرشيف.',
        },
      ];
      store.setItem(TEACHER_PORTFOLIO_STORAGE_KEY, JSON.stringify(parsed));
    }

    return unlinkedElementIds;
  } catch {
    return [];
  }
}

export function inspectRecordDeletionImpact<TPayload = Record<string, unknown>>(
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftBlobKeys?: Iterable<string>;
  }
): RecordDeletionImpact {
  const target = archiveStore.records?.[recordId];
  const recordBlobKeys = Array.from(
    new Set((target?.mediaRefs || []).map((r) => r.blobKey))
  );

  // Check if any OTHER archived record or draft in this store (or active UI) holds each blobKey
  const otherBlobKeys = new Set<string>();
  for (const [id, rec] of Object.entries(archiveStore.records || {})) {
    if (id === recordId) continue;
    for (const ref of rec.mediaRefs || []) {
      otherBlobKeys.add(ref.blobKey);
    }
  }
  for (const draft of Object.values(archiveStore.activeDraftByFormId || {})) {
    if (draft.id === recordId) continue;
    for (const ref of draft.mediaRefs || []) {
      otherBlobKeys.add(ref.blobKey);
    }
  }
  if (opts?.activeUiDraftBlobKeys) {
    for (const key of opts.activeUiDraftBlobKeys) {
      otherBlobKeys.add(key);
    }
  }

  const sharedBlobKeys = recordBlobKeys.filter((k) => otherBlobKeys.has(k));
  const exclusiveBlobKeys = recordBlobKeys.filter((k) => !otherBlobKeys.has(k));

  const linkedElements = inspectPortfolioLinksForRecord(
    archiveStore.groupId,
    recordId,
    opts?.storage
  );
  const isLinked = linkedElements.length > 0;

  let warningMessage: string | null = null;
  if (isLinked) {
    const names = linkedElements.map((e) => e.elementTitle).join('، ');
    warningMessage = `تنبيه: هذا السجل مرتبط حاليًا بملف شواهد الأداء (${names}). سيؤدي الحذف إلى إزالة السجل من الأرشيف وفك ارتباطه مع تسجيل العملية في سجل التدقيق.`;
  } else if (sharedBlobKeys.length > 0) {
    warningMessage =
      'سيتم حذف السجل من الأرشيف مع الإبقاء على المرفقات المشتركة المستخدمة في سجلات أخرى.';
  }

  return {
    recordId,
    groupId: archiveStore.groupId,
    isLinked,
    linkedElements,
    recordBlobKeys,
    sharedBlobKeys,
    exclusiveBlobKeys,
    warningMessage,
  };
}

export async function deleteArchivedRecordSafely<
  TPayload = Record<string, unknown>,
>(
  archiveStorageKey: string,
  archiveStore: TeacherGroupArchiveStore<TPayload>,
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    extraStorageKeys?: readonly string[];
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherGroupArchiveStore<TPayload>;
  result: SafeDeleteRecordResult;
}> {
  const activeKeys = opts?.activeUiDraftMediaRefs
    ? Array.from(opts.activeUiDraftMediaRefs).map((r) => r.blobKey)
    : [];
  const impact = inspectRecordDeletionImpact(archiveStore, recordId, {
    storage: opts?.storage,
    activeUiDraftBlobKeys: activeKeys,
  });

  const target = archiveStore.records?.[recordId];
  if (!target) {
    return {
      nextStore: archiveStore,
      result: {
        deleted: false,
        impact,
        unlinkedElementIds: [],
        removedBlobKeys: [],
        preservedSharedBlobKeys: [],
      },
    };
  }

  if (impact.isLinked && !opts?.confirmUnlink) {
    return {
      nextStore: archiveStore,
      result: {
        deleted: false,
        requiresConfirmation: true,
        impact,
        unlinkedElementIds: [],
        removedBlobKeys: [],
        preservedSharedBlobKeys: [],
      },
    };
  }

  // 1. Unlink portfolio references and append audit entry if linked
  const unlinkedElementIds = impact.isLinked
    ? unlinkRecordFromPortfolioAndAudit(
        archiveStore.groupId,
        recordId,
        target.title,
        opts?.storage
      )
    : [];

  // 2. Remove record from archive store and persist store FIRST so ref-counting sees updated store
  const nextRecords = { ...archiveStore.records };
  delete nextRecords[recordId];
  const nextStore: TeacherGroupArchiveStore<TPayload> = {
    ...archiveStore,
    records: nextRecords,
    updatedAt: new Date().toISOString(),
  };
  saveGroupArchiveStore(archiveStorageKey, nextStore, opts?.storage);

  // 3. Global reference-counted cleanup of each blobKey on this record
  const removedBlobKeys: string[] = [];
  const preservedSharedBlobKeys: string[] = [];
  const extraKeys = Array.from(
    new Set([archiveStorageKey, ...(opts?.extraStorageKeys || [])])
  );

  for (const blobKey of impact.recordBlobKeys) {
    const delOutcome = await deleteBlobIfUnreferenced(blobKey, {
      storage: opts?.storage,
      extraStorageKeys: extraKeys,
      extraActiveRefs: opts?.activeUiDraftMediaRefs,
      repo: opts?.mediaRepo,
    });
    if (delOutcome.deleted) {
      removedBlobKeys.push(blobKey);
    } else if (delOutcome.remainingRefs > 0) {
      preservedSharedBlobKeys.push(blobKey);
    }
  }

  return {
    nextStore,
    result: {
      deleted: true,
      impact,
      unlinkedElementIds,
      removedBlobKeys,
      preservedSharedBlobKeys,
    },
  };
}

// ============================================================================
// Migration Tracker & Idempotent Per-Group Pilot Migration + Rollback
// ============================================================================
export function loadMigrationState(
  storage?: StorageLike
): TeacherArchiveMigrationState {
  const store = resolveStorage(storage);
  const empty: TeacherArchiveMigrationState = {
    schemaVersion: 1,
    groups: {},
  };
  if (!store) return empty;
  try {
    const raw = store.getItem(TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<TeacherArchiveMigrationState>;
    if (!parsed || typeof parsed !== 'object') return empty;
    return {
      schemaVersion: 1,
      groups: parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : {},
    };
  } catch {
    return empty;
  }
}

export function saveMigrationState(
  state: TeacherArchiveMigrationState,
  storage?: StorageLike
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export interface LegacyMigrationCandidate<TLegacy> {
  sourceKey: string;
  formId: string;
  title: string;
  summary?: string;
  academicYear?: string;
  semester?: string;
  eventDate?: string;
  isEmpty: boolean;
  targetState: TeacherArchiveRecordState;
  legacyData: TLegacy;
}

export interface RunGroupMigrationOptions<TLegacy, TSanitizedPayload> {
  groupId: TeacherArchiveGroupId;
  legacyStorageKey: string;
  archiveStorageKey: string;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
  readLegacyCandidates: (
    storage: StorageLike | undefined
  ) => LegacyMigrationCandidate<TLegacy>[];
  sanitizeAndExtractMedia: (
    legacyData: TLegacy,
    mediaRepo: TeacherMediaRepository
  ) => Promise<{
    sanitizedPayload: TSanitizedPayload;
    mediaRefs: UnifiedMediaRef[];
    newlyCreatedBlobKeys: string[];
  }>;
}

export interface RunGroupMigrationSummary {
  groupId: TeacherArchiveGroupId;
  migratedCount: number;
  skippedAlreadyMigratedCount: number;
  skippedEmptyCount: number;
  createdRecordIds: string[];
  newlyCreatedBlobKeys: string[];
  alreadyCompleted: boolean;
}

export async function runIdempotentGroupMigration<TLegacy, TSanitizedPayload>(
  options: RunGroupMigrationOptions<TLegacy, TSanitizedPayload>
): Promise<RunGroupMigrationSummary> {
  const store = resolveStorage(options.storage);
  const mediaRepo = options.mediaRepo ?? getDefaultTeacherMediaRepository();
  const migState = loadMigrationState(store);

  const existingEntry: GroupMigrationLogEntry = migState.groups[
    options.groupId
  ] ?? {
    groupId: options.groupId,
    legacyStorageKey: options.legacyStorageKey,
    completedSources: {},
    createdRecordIds: [],
    createdBlobKeys: [],
    preMigrationArchiveRaw: store ? store.getItem(options.archiveStorageKey) : null,
    lastRunAt: new Date().toISOString(),
  };

  // Refresh preMigrationArchiveRaw whenever this group starts from 0 completed sources
  if (Object.keys(existingEntry.completedSources).length === 0) {
    existingEntry.preMigrationArchiveRaw = store
      ? store.getItem(options.archiveStorageKey)
      : null;
  }

  let archiveStore = loadGroupArchiveStore<TSanitizedPayload>(
    options.archiveStorageKey,
    options.groupId,
    store
  );

  const candidates = options.readLegacyCandidates(store);
  let migratedCount = 0;
  let skippedAlreadyMigratedCount = 0;
  let skippedEmptyCount = 0;
  const createdRecordIdsThisRun: string[] = [];
  const createdBlobsThisRun: string[] = [];

  for (const candidate of candidates) {
    if (candidate.isEmpty) {
      skippedEmptyCount += 1;
      continue;
    }

    const doneMeta = existingEntry.completedSources[candidate.sourceKey];
    if (doneMeta) {
      // Double check record or activeDraft still exists before skipping
      const stillInArchive =
        Boolean(archiveStore.records[doneMeta.migratedRecordId]) ||
        archiveStore.activeDraftByFormId[candidate.formId]?.id ===
          doneMeta.migratedRecordId;
      if (stillInArchive) {
        skippedAlreadyMigratedCount += 1;
        continue;
      }
    }

    const { sanitizedPayload, mediaRefs, newlyCreatedBlobKeys } =
      await options.sanitizeAndExtractMedia(candidate.legacyData, mediaRepo);

    const recordId =
      doneMeta?.migratedRecordId ||
      generateImmutableRecordId(
        candidate.targetState === 'archived_saved' ? 'trec' : 'tdraft'
      );

    if (candidate.targetState === 'draft') {
      // Only populate activeDraftByFormId as a draft; NEVER auto-promote to archived_saved
      const { nextStore } = upsertDraftRecord(archiveStore, {
        id: recordId,
        formId: candidate.formId,
        title: candidate.title,
        summary: candidate.summary,
        academicYear: candidate.academicYear,
        semester: candidate.semester,
        eventDate: candidate.eventDate,
        mediaRefs,
        migratedFromLegacyKey: options.legacyStorageKey,
        payload: sanitizedPayload,
      });
      archiveStore = nextStore;
    } else {
      const { nextStore } = upsertArchivedRecord(archiveStore, {
        id: recordId,
        formId: candidate.formId,
        title: candidate.title,
        summary: candidate.summary,
        academicYear: candidate.academicYear,
        semester: candidate.semester,
        eventDate: candidate.eventDate,
        mediaRefs,
        payload: sanitizedPayload,
      });
      archiveStore = nextStore;
    }

    existingEntry.completedSources[candidate.sourceKey] = {
      migratedRecordId: recordId,
      migratedAt: new Date().toISOString(),
      recordState: candidate.targetState,
    };
    if (!existingEntry.createdRecordIds.includes(recordId)) {
      existingEntry.createdRecordIds.push(recordId);
    }
    for (const bk of newlyCreatedBlobKeys) {
      if (!existingEntry.createdBlobKeys.includes(bk)) {
        existingEntry.createdBlobKeys.push(bk);
      }
      if (!createdBlobsThisRun.includes(bk)) {
        createdBlobsThisRun.push(bk);
      }
    }
    createdRecordIdsThisRun.push(recordId);
    migratedCount += 1;
  }

  if (migratedCount > 0) {
    saveGroupArchiveStore(options.archiveStorageKey, archiveStore, store);
  }

  existingEntry.lastRunAt = new Date().toISOString();
  delete existingEntry.rolledBackAt;
  migState.groups[options.groupId] = existingEntry;
  saveMigrationState(migState, store);

  return {
    groupId: options.groupId,
    migratedCount,
    skippedAlreadyMigratedCount,
    skippedEmptyCount,
    createdRecordIds: createdRecordIdsThisRun,
    newlyCreatedBlobKeys: createdBlobsThisRun,
    alreadyCompleted: migratedCount === 0 && skippedAlreadyMigratedCount > 0,
  };
}

export async function rollbackGroupMigration(opts: {
  groupId: TeacherArchiveGroupId;
  archiveStorageKey: string;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
  extraStorageKeys?: readonly string[];
}): Promise<{
  rolledBack: boolean;
  restoredArchiveKey: boolean;
  removedBlobKeys: string[];
  preservedBlobKeys: string[];
}> {
  const store = resolveStorage(opts.storage);
  const mediaRepo = opts.mediaRepo ?? getDefaultTeacherMediaRepository();
  const migState = loadMigrationState(store);
  const entry = migState.groups[opts.groupId];

  if (!entry) {
    return {
      rolledBack: false,
      restoredArchiveKey: false,
      removedBlobKeys: [],
      preservedBlobKeys: [],
    };
  }

  let restoredArchiveKey = false;
  if (store) {
    if (entry.preMigrationArchiveRaw === null) {
      store.removeItem(opts.archiveStorageKey);
    } else {
      store.setItem(opts.archiveStorageKey, entry.preMigrationArchiveRaw);
    }
    restoredArchiveKey = true;
  }

  const removedBlobKeys: string[] = [];
  const preservedBlobKeys: string[] = [];
  const extraKeys = Array.from(
    new Set([opts.archiveStorageKey, ...(opts.extraStorageKeys || [])])
  );

  for (const blobKey of entry.createdBlobKeys) {
    const del = await deleteBlobIfUnreferenced(blobKey, {
      storage: store,
      extraStorageKeys: extraKeys,
      repo: mediaRepo,
    });
    if (del.deleted) {
      removedBlobKeys.push(blobKey);
    } else {
      preservedBlobKeys.push(blobKey);
    }
  }

  entry.completedSources = {};
  entry.createdRecordIds = [];
  entry.createdBlobKeys = [];
  entry.rolledBackAt = new Date().toISOString();
  migState.groups[opts.groupId] = entry;
  saveMigrationState(migState, store);

  return {
    rolledBack: true,
    restoredArchiveKey,
    removedBlobKeys,
    preservedBlobKeys,
  };
}

// ============================================================================
// Media Extraction & Hydration Helpers for Form Evidence Photos
// ============================================================================
export async function extractEvidencePhotosToMediaRepo(
  evidencePhotos: Array<{ id: string; imageDataUrl: string }> | undefined,
  existingMediaRefs: UnifiedMediaRef[] | undefined,
  mediaRepo: TeacherMediaRepository = getDefaultTeacherMediaRepository(),
  sourceTag: UnifiedMediaRef['sourceTag'] = 'upload'
): Promise<{
  mediaRefs: UnifiedMediaRef[];
  newlyCreatedBlobKeys: string[];
}> {
  const refsByPhotoId = new Map<string, UnifiedMediaRef>();
  for (const r of existingMediaRefs || []) {
    refsByPhotoId.set(r.id, r);
  }

  const mediaRefs: UnifiedMediaRef[] = [];
  const newlyCreatedBlobKeys: string[] = [];

  for (let i = 0; i < (evidencePhotos || []).length; i++) {
    const photo = evidencePhotos![i];
    if (!photo) continue;

    if (photo.imageDataUrl && photo.imageDataUrl.startsWith('data:')) {
      const res = await saveMediaDataUrl(
        {
          id: photo.id || `photo-${i + 1}`,
          dataUrl: photo.imageDataUrl,
          fileName: `evidence-photo-${i + 1}`,
          sourceTag,
        },
        mediaRepo
      );
      mediaRefs.push(res.mediaRef);
      if (!res.deduplicated) {
        newlyCreatedBlobKeys.push(res.mediaRef.blobKey);
      }
    } else {
      const existingRef = refsByPhotoId.get(photo.id);
      if (existingRef) {
        mediaRefs.push(existingRef);
      }
    }
  }

  return { mediaRefs, newlyCreatedBlobKeys };
}

export async function hydrateEvidencePhotosFromMediaRepo(
  mediaRefs: UnifiedMediaRef[] | undefined,
  fallbackPhotos: Array<{ id: string; imageDataUrl: string }> | undefined,
  mediaRepo: TeacherMediaRepository = getDefaultTeacherMediaRepository()
): Promise<{
  photos: Array<{ id: string; imageDataUrl: string }>;
  integrityWarnings: string[];
}> {
  const fallbackById = new Map<string, { id: string; imageDataUrl: string }>();
  for (const p of fallbackPhotos || []) {
    if (p && p.imageDataUrl) {
      fallbackById.set(p.id, p);
    }
  }

  if (!mediaRefs || mediaRefs.length === 0) {
    return {
      photos: (fallbackPhotos || []).filter((p) => Boolean(p?.imageDataUrl)),
      integrityWarnings: [],
    };
  }

  const photos: Array<{ id: string; imageDataUrl: string }> = [];
  const integrityWarnings: string[] = [];

  for (const ref of mediaRefs) {
    const loaded = await loadMediaBlobWithIntegrityCheck(
      ref.blobKey,
      ref,
      mediaRepo
    );
    if (loaded.ok && loaded.dataUrl) {
      photos.push({
        id: ref.id,
        imageDataUrl: loaded.dataUrl,
      });
    } else {
      if (loaded.integrityError) {
        integrityWarnings.push(loaded.integrityError);
      }
      const fb = fallbackById.get(ref.id);
      if (fb) {
        photos.push(fb);
      }
    }
  }

  return { photos, integrityWarnings };
}
