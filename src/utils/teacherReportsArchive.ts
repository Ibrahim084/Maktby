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
  getDefaultTeacherMediaRepository,
  TeacherMediaRepository,
  UnifiedMediaRef,
} from './teacherMediaStorage';
import {
  AnyTeacherProfessionalReportData,
  createInitialTeacherReportData,
  DistinguishedPracticeReportData,
  EducationalProblemRemediationReportData,
  LearningOutcomesAnalysisReportData,
  loadTeacherReportDraftFromStorage,
  ProfessionalAchievementReportData,
  saveTeacherReportDraftToStorage,
  StrategyImplementationReportData,
  TEACHER_PROFESSIONAL_REPORTS_CATALOG,
  TEACHER_REPORTS_STORAGE_KEY,
  TeacherProfessionalReportId,
  TeacherReportFormMap,
} from './teacherReportsEngine';

export const TEACHER_REPORTS_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_reports_archive_v1';

export type TeacherReportsArchiveStore =
  TeacherGroupArchiveStore<AnyTeacherProfessionalReportData>;

export type TeacherReportArchiveRecord =
  TeacherArchiveRecord<AnyTeacherProfessionalReportData>;

// ============================================================================
// Metadata & Sanitization Helpers for the 5 Report Models
// ============================================================================
export function getTeacherReportRecordTitle(
  data: AnyTeacherProfessionalReportData
): string {
  switch (data.formId) {
    case 'strategy-implementation':
      return (
        data.strategyName?.trim() ||
        data.lessonTopic?.trim() ||
        data.reportTitle?.trim() ||
        'تقرير تنفيذ استراتيجية تعليمية'
      );
    case 'problem-remediation':
      return (
        data.remediationTopic?.trim() ||
        (data.subject?.trim()
          ? `معالجة مشكلة تعليمية — ${data.subject.trim()}`
          : 'تقرير معالجة مشكلة تعليمية')
      );
    case 'learning-outcomes-analysis': {
      const base =
        data.analysisScope === 'single-exam'
          ? data.examName?.trim() || 'تحليل نتائج اختبار'
          : `تحليل نتائج ${data.semester || 'الفصل الدراسي'}`;
      return data.subject?.trim() ? `${base} — ${data.subject.trim()}` : base;
    }
    case 'distinguished-practice':
      return data.practiceName?.trim() || 'تقرير ممارسة تعليمية متميزة';
    case 'professional-achievement':
      return data.achievementName?.trim() || 'تقرير إنجاز مهني';
  }
}

export function getTeacherReportRecordSummary(
  data: AnyTeacherProfessionalReportData
): string {
  const parts: string[] = [];
  if ('subject' in data && data.subject?.trim()) {
    parts.push(data.subject.trim());
  }
  if ('grade' in data && data.grade?.trim()) {
    parts.push(data.grade.trim());
  }
  const eventDate = getTeacherReportEventDate(data);
  if (eventDate) {
    parts.push(eventDate);
  }
  return parts.join(' · ');
}

export function getTeacherReportEventDate(
  data: AnyTeacherProfessionalReportData
): string {
  switch (data.formId) {
    case 'strategy-implementation':
    case 'problem-remediation':
      return (data.executionDate || '').trim();
    case 'learning-outcomes-analysis':
    case 'distinguished-practice':
      return (data.applicationDate || '').trim();
    case 'professional-achievement':
      return (data.achievementDate || '').trim();
  }
}

export function stripBase64PhotosFromReportPayload<
  T extends AnyTeacherProfessionalReportData,
>(data: T): T {
  return {
    ...data,
    evidencePhotos: [],
  };
}

/**
 * Determines whether a legacy stored object has zero meaningful user-entered data
 * (only default labels/options or auto-filled teacher name). Prevents creating phantom records.
 */
export function isLegacyReportDraftEmpty(
  formId: TeacherProfessionalReportId,
  rawData: Partial<AnyTeacherProfessionalReportData> | null | undefined,
  settings?: Partial<SchoolSettings>
): boolean {
  if (!rawData || typeof rawData !== 'object') return true;
  const hasPhotos =
    Array.isArray(rawData.evidencePhotos) && rawData.evidencePhotos.length > 0;
  const hasLinks =
    Array.isArray(rawData.evidenceLinks) &&
    rawData.evidenceLinks.some((l) => Boolean(l?.url?.trim()));
  if (hasPhotos || hasLinks) return false;

  const settingsTeacher = (settings?.userName || '').trim();
  const draftTeacher = (rawData.teacherName || '').trim();
  const customTeacherEntered =
    Boolean(draftTeacher) && draftTeacher !== settingsTeacher;
  if (customTeacherEntered) return false;

  const hasNonEmpty = (...vals: Array<string | undefined | null>) =>
    vals.some((v) => Boolean(v && String(v).trim()));

  switch (formId) {
    case 'strategy-implementation': {
      const d = rawData as Partial<StrategyImplementationReportData>;
      const customTitle =
        d.reportTitle?.trim() &&
        d.reportTitle.trim() !== 'تقرير تنفيذ استراتيجية تعليمية';
      return (
        !customTitle &&
        !hasNonEmpty(
          d.strategyName,
          d.subject,
          d.executionDate,
          d.stage,
          d.grade,
          d.studentsCount,
          d.lessonTopic,
          d.strategyObjectives,
          d.educationalTools,
          d.classroomMechanism
        )
      );
    }
    case 'problem-remediation': {
      const d = rawData as Partial<EducationalProblemRemediationReportData>;
      return !hasNonEmpty(
        d.subject,
        d.grade,
        d.remediationTopic,
        d.executionLocation,
        d.executionDate,
        d.executionDuration,
        d.problemDescription,
        d.probableCauses,
        d.preRemediationLevel,
        d.objectives,
        d.executionSteps,
        d.postRemediationLevel,
        d.recommendations
      );
    }
    case 'learning-outcomes-analysis': {
      const d = rawData as Partial<LearningOutcomesAnalysisReportData>;
      return !hasNonEmpty(
        d.subject,
        d.stage,
        d.grade,
        d.totalStudentsCount,
        d.examName,
        d.applicationDate,
        d.semesterAssessmentsSummary,
        d.excellentCount,
        d.veryGoodCount,
        d.goodCount,
        d.acceptableCount,
        d.weakCount,
        d.strengths,
        d.weaknesses,
        d.keyObservations,
        d.actionsAndRecommendations
      );
    }
    case 'distinguished-practice': {
      const d = rawData as Partial<DistinguishedPracticeReportData>;
      return !hasNonEmpty(
        d.practiceName,
        d.subject,
        d.stage,
        d.grade,
        d.applicationDuration,
        d.applicationDate,
        d.targetGroup,
        d.applicationLocation,
        d.practiceIdea,
        d.applicationMotives,
        d.addressedChallenge,
        d.objectives,
        d.executionMechanism,
        d.toolsAndMeans,
        d.achievedResults,
        d.impactOnStudentLearning,
        d.recommendations
      );
    }
    case 'professional-achievement': {
      const d = rawData as Partial<ProfessionalAchievementReportData>;
      return !hasNonEmpty(
        d.achievementName,
        d.customAchievementType,
        d.subject,
        d.stage,
        d.grade,
        d.achievementDate,
        d.achievementDescription,
        d.achievementObjective,
        d.beneficiaryGroup,
        d.resultsAndImpact
      );
    }
  }
}

// ============================================================================
// Pilot Migration & Rollback for the 5 Teacher Professional Reports ONLY
// ============================================================================
export async function migrateProfessionalReportsToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  return runIdempotentGroupMigration<
    AnyTeacherProfessionalReportData,
    AnyTeacherProfessionalReportData
  >({
    groupId: 'professional-reports',
    legacyStorageKey: TEACHER_REPORTS_STORAGE_KEY,
    archiveStorageKey: TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];
      const raw = storage.getItem(TEACHER_REPORTS_STORAGE_KEY);
      if (!raw) return [];

      let parsedMap: Record<string, unknown> = {};
      try {
        parsedMap = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return [];
      }
      if (!parsedMap || typeof parsedMap !== 'object') return [];

      const candidates: LegacyMigrationCandidate<AnyTeacherProfessionalReportData>[] =
        [];
      for (const meta of TEACHER_PROFESSIONAL_REPORTS_CATALOG) {
        const entry = parsedMap[meta.id] as
          | Partial<AnyTeacherProfessionalReportData>
          | undefined;
        if (!entry || typeof entry !== 'object') continue;

        const merged = {
          ...createInitialTeacherReportData(meta.id, opts?.settings),
          ...entry,
          formId: meta.id,
        } as AnyTeacherProfessionalReportData;

        const isEmpty = isLegacyReportDraftEmpty(
          meta.id,
          entry,
          opts?.settings
        );

        candidates.push({
          sourceKey: `legacy_report_draft:${meta.id}`,
          formId: meta.id,
          title: getTeacherReportRecordTitle(merged),
          summary: getTeacherReportRecordSummary(merged),
          academicYear: opts?.settings?.academicYear || '',
          semester: opts?.settings?.semester || '',
          eventDate: getTeacherReportEventDate(merged),
          isEmpty,
          // Invariant: legacy un-submitted form drafts stay as drafts, never promoted!
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
        sanitizedPayload: stripBase64PhotosFromReportPayload(legacyData),
        mediaRefs,
        newlyCreatedBlobKeys,
      };
    },
  });
}

export async function rollbackProfessionalReportsMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'professional-reports',
    archiveStorageKey: TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
  });
}

// ============================================================================
// Archive Store Operations for UI & Tests
// ============================================================================
export function loadReportsArchiveStore(
  storage?: StorageLike
): TeacherReportsArchiveStore {
  return loadGroupArchiveStore<AnyTeacherProfessionalReportData>(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    'professional-reports',
    storage
  );
}

export function listSavedReportsForForm(
  formId?: TeacherProfessionalReportId,
  storage?: StorageLike
): TeacherReportArchiveRecord[] {
  const store = loadReportsArchiveStore(storage);
  return listArchivedRecords(store, formId);
}

export async function loadActiveReportDraftWithMedia<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  draftRecord: TeacherReportArchiveRecord | null;
  formData: TeacherReportFormMap[K];
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
}> {
  const store = loadReportsArchiveStore(opts?.storage);
  const draftRecord = store.activeDraftByFormId?.[formId] ?? null;

  if (draftRecord && draftRecord.formId === formId) {
    const initial = createInitialTeacherReportData(formId, opts?.settings);
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
    } as TeacherReportFormMap[K];
    if (!merged.teacherName?.trim() && opts?.settings?.userName?.trim()) {
      merged.teacherName = opts.settings.userName.trim();
    }
    return {
      draftRecord,
      formData: merged,
      mediaRefs: draftRecord.mediaRefs || [],
      integrityWarnings: hydrated.integrityWarnings,
    };
  }

  // Fallback to legacy draft storage directly if not in archive draft store yet
  const legacyData = loadTeacherReportDraftFromStorage(
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

export async function loadArchivedReportWithMedia<
  K extends TeacherProfessionalReportId,
>(
  recordId: string,
  opts?: {
    formId?: K;
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  record: TeacherReportArchiveRecord;
  formData: TeacherReportFormMap[K];
  integrityWarnings: string[];
} | null> {
  const store = loadReportsArchiveStore(opts?.storage);
  const record = store.records?.[recordId];
  if (!record) return null;

  const targetFormId = (opts?.formId ||
    record.formId) as TeacherProfessionalReportId;
  const initial = createInitialTeacherReportData(targetFormId, opts?.settings);
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
  } as TeacherReportFormMap[K];

  return {
    record,
    formData,
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export async function saveActiveReportDraftWithMedia<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  data: TeacherReportFormMap[K],
  opts?: {
    draftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherReportsArchiveStore;
  draftRecord: TeacherReportArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    opts?.existingMediaRefs,
    mediaRepo,
    'upload'
  );

  // Keep legacy key continuously synchronized without stripping user continuity
  saveTeacherReportDraftToStorage(formId, data, opts?.storage);

  const currentStore = loadReportsArchiveStore(opts?.storage);
  const { nextStore, draftRecord } = upsertDraftRecord(currentStore, {
    id: opts?.draftId,
    formId,
    title: getTeacherReportRecordTitle(data),
    summary: getTeacherReportRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherReportEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromReportPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return { store: nextStore, draftRecord, mediaRefs };
}

export async function saveReportToArchive<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  data: TeacherReportFormMap[K],
  opts?: {
    recordId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherReportsArchiveStore;
  record: TeacherReportArchiveRecord;
  isNew: boolean;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    opts?.existingMediaRefs,
    mediaRepo,
    'upload'
  );

  const currentStore = loadReportsArchiveStore(opts?.storage);
  const { nextStore, record, isNew } = upsertArchivedRecord(currentStore, {
    id: opts?.recordId,
    formId,
    title: getTeacherReportRecordTitle(data),
    summary: getTeacherReportRecordSummary(data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherReportEventDate(data),
    mediaRefs,
    payload: stripBase64PhotosFromReportPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return {
    store: nextStore,
    record,
    isNew,
    mediaRefs,
  };
}

export function createNewBlankReportInArchive<
  K extends TeacherProfessionalReportId,
>(
  formId: K,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): {
  store: TeacherReportsArchiveStore;
  draftRecord: TeacherReportArchiveRecord;
  formData: TeacherReportFormMap[K];
} {
  const freshData = createInitialTeacherReportData(formId, opts?.settings);
  const currentStore = loadReportsArchiveStore(opts?.storage);
  const meta = TEACHER_PROFESSIONAL_REPORTS_CATALOG.find(
    (item) => item.id === formId
  );

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId,
    title: meta?.title || 'مسودة تقرير جديد',
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromReportPayload(freshData),
  });

  saveGroupArchiveStore(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
  };
}

export function inspectArchivedReportDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): RecordDeletionImpact {
  const store = loadReportsArchiveStore(opts?.storage);
  const activeKeys = opts?.activeUiDraftMediaRefs
    ? Array.from(opts.activeUiDraftMediaRefs).map((r) => r.blobKey)
    : [];
  return inspectRecordDeletionImpact(store, recordId, {
    storage: opts?.storage,
    activeUiDraftBlobKeys: activeKeys,
  });
}

export async function deleteArchivedReportRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherReportsArchiveStore;
  result: SafeDeleteRecordResult;
}> {
  const store = loadReportsArchiveStore(opts?.storage);
  return deleteArchivedRecordSafely(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    store,
    recordId,
    {
      confirmUnlink: opts?.confirmUnlink,
      storage: opts?.storage,
      mediaRepo: opts?.mediaRepo,
      activeUiDraftMediaRefs: opts?.activeUiDraftMediaRefs,
    }
  );
}
