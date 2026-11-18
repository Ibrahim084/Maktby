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
  createInitialTeacherPlanData,
  EnrichmentPlanData,
  GroupRemedialPlanData,
  IndividualRemedialPlanData,
  loadTeacherPlanDraftFromStorage,
  NEED_DIAGNOSIS_OPTIONS,
  ProfessionalDevelopmentPlanData,
  saveTeacherPlanDraftToStorage,
  TEACHER_PLANS_CATALOG,
  TEACHER_PLANS_STORAGE_KEY,
  TeacherPlanFormId,
  TeacherPlanFormMap,
  WeeklyTeacherPlanData,
} from './teacherPlansEngine';

export const TEACHER_PLANS_ARCHIVE_STORAGE_KEY =
  'maktabi_teacher_plans_archive_v1';

const CROSS_GROUP_ARCHIVE_KEYS = [
  'maktabi_teacher_reports_archive_v1',
  TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
] as const;

export type AnyTeacherPlanData = TeacherPlanFormMap[TeacherPlanFormId];

export type TeacherPlansArchiveStore =
  TeacherGroupArchiveStore<AnyTeacherPlanData>;

export type TeacherPlanArchiveRecord =
  TeacherArchiveRecord<AnyTeacherPlanData>;

const DEFAULT_PLAN_TITLES: Record<TeacherPlanFormId, string> = {
  'professional-development-plan': 'خطة التطوير المهني وتحسين الأداء التدريسي',
  'weekly-teacher-plan': 'الخطة الأسبوعية للمعلم',
  'individual-remedial-plan': 'الخطة العلاجية الفردية',
  'group-remedial-plan': 'الخطة العلاجية الجماعية',
  'enrichment-plan': 'الخطة الإثرائية للطلاب المتميزين',
};

const DEFAULT_ENRICHMENT_TYPES = [
  'إثراء معرفي وتوسيع المحتوى',
  'مشروعات بحثية',
];

function resolveFullSettings(
  partial?: Partial<SchoolSettings>
): SchoolSettings | undefined {
  return partial ? { ...DEFAULT_SCHOOL_SETTINGS, ...partial } : undefined;
}

// ============================================================================
// Metadata & Sanitization Helpers for the 5 Teacher Plan Models
// ============================================================================
export function getTeacherPlanRecordTitle(
  formId: TeacherPlanFormId,
  data: AnyTeacherPlanData
): string {
  const rawTitle = (data.planTitle || '').trim();
  const hasCustomTitle =
    Boolean(rawTitle) && rawTitle !== DEFAULT_PLAN_TITLES[formId];
  if (hasCustomTitle) {
    return rawTitle;
  }

  switch (formId) {
    case 'professional-development-plan': {
      const d = data as ProfessionalDevelopmentPlanData;
      const firstGoalTitle = (d.goals || []).find((g) => g?.goalTitle?.trim())
        ?.goalTitle?.trim();
      if (firstGoalTitle) {
        return firstGoalTitle;
      }
      const needTitle =
        d.needDiagnosisCategory === 'احتياج آخر'
          ? d.customNeedDiagnosis?.trim()
          : d.needDiagnosisCategory?.trim();
      if (needTitle && needTitle !== NEED_DIAGNOSIS_OPTIONS[0]) {
        return d.subject?.trim()
          ? `${needTitle} — ${d.subject.trim()}`
          : needTitle;
      }
      if (d.subject?.trim()) {
        return `خطة التطوير المهني — ${d.subject.trim()}`;
      }
      return DEFAULT_PLAN_TITLES['professional-development-plan'];
    }
    case 'weekly-teacher-plan': {
      const d = data as WeeklyTeacherPlanData;
      const parts = [
        d.weekLabel?.trim(),
        d.subject?.trim(),
        d.grade?.trim(),
      ].filter(Boolean);
      return parts.length > 0
        ? `الخطة الأسبوعية — ${parts.join(' / ')}`
        : DEFAULT_PLAN_TITLES['weekly-teacher-plan'];
    }
    case 'individual-remedial-plan': {
      const d = data as IndividualRemedialPlanData;
      if (d.studentName?.trim()) {
        return d.subject?.trim()
          ? `خطة علاجية فردية — ${d.studentName.trim()} (${d.subject.trim()})`
          : `خطة علاجية فردية — ${d.studentName.trim()}`;
      }
      if (d.subject?.trim()) {
        return `الخطة العلاجية الفردية — ${d.subject.trim()}`;
      }
      return DEFAULT_PLAN_TITLES['individual-remedial-plan'];
    }
    case 'group-remedial-plan': {
      const d = data as GroupRemedialPlanData;
      const parts = [d.subject?.trim(), d.grade?.trim()].filter(Boolean);
      return parts.length > 0
        ? `خطة علاجية جماعية — ${parts.join(' / ')}`
        : DEFAULT_PLAN_TITLES['group-remedial-plan'];
    }
    case 'enrichment-plan': {
      const d = data as EnrichmentPlanData;
      const parts = [d.subject?.trim(), d.grade?.trim()].filter(Boolean);
      return parts.length > 0
        ? `خطة إثرائية — ${parts.join(' / ')}`
        : 'الخطة الإثرائية';
    }
  }
}

export function getTeacherPlanEventDate(
  formId: TeacherPlanFormId,
  data: AnyTeacherPlanData
): string {
  switch (formId) {
    case 'professional-development-plan': {
      const d = data as ProfessionalDevelopmentPlanData;
      return (d.academicPeriod || '').trim();
    }
    case 'weekly-teacher-plan': {
      const d = data as WeeklyTeacherPlanData;
      return (d.weekDate || '').trim();
    }
    case 'individual-remedial-plan': {
      const d = data as IndividualRemedialPlanData;
      return (d.planDate || '').trim();
    }
    case 'group-remedial-plan': {
      const d = data as GroupRemedialPlanData;
      return (d.startDate || d.endDate || '').trim();
    }
    case 'enrichment-plan': {
      const d = data as EnrichmentPlanData;
      return (d.startDate || d.endDate || '').trim();
    }
  }
}

export function getTeacherPlanRecordSummary(
  formId: TeacherPlanFormId,
  data: AnyTeacherPlanData
): string {
  const parts: string[] = [];
  if ('subject' in data && data.subject?.trim()) {
    parts.push(data.subject.trim());
  }
  if ('grade' in data && data.grade?.trim()) {
    parts.push(data.grade.trim());
  } else if ('stageAndGrade' in data && data.stageAndGrade?.trim()) {
    parts.push(data.stageAndGrade.trim());
  }
  if (formId === 'individual-remedial-plan') {
    const d = data as IndividualRemedialPlanData;
    if (d.studentName?.trim()) parts.push(d.studentName.trim());
  } else if (formId === 'weekly-teacher-plan') {
    const d = data as WeeklyTeacherPlanData;
    if (d.weekLabel?.trim()) parts.push(d.weekLabel.trim());
  } else if (
    formId === 'group-remedial-plan' ||
    formId === 'enrichment-plan'
  ) {
    const d = data as GroupRemedialPlanData | EnrichmentPlanData;
    if (d.beneficiariesScope?.trim()) parts.push(d.beneficiariesScope.trim());
  }

  const eventDate = getTeacherPlanEventDate(formId, data);
  if (eventDate && !parts.includes(eventDate)) {
    parts.push(eventDate);
  }
  return Array.from(new Set(parts)).join(' · ');
}

export function stripBase64PhotosFromPlanPayload<T extends AnyTeacherPlanData>(
  data: T
): T {
  return {
    ...data,
    evidencePhotos: [],
  };
}

/**
 * Determines whether a legacy stored plan object has zero meaningful user-entered data
 * (only factory defaults / auto-filled teacherName or academicYear).
 */
export function isLegacyPlanDraftEmpty(
  formId: TeacherPlanFormId,
  rawData: Partial<AnyTeacherPlanData> | null | undefined,
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
  if (Boolean(draftTeacher) && draftTeacher !== settingsTeacher) {
    return false;
  }

  const rawTitle = (rawData.planTitle || '').trim();
  if (Boolean(rawTitle) && rawTitle !== DEFAULT_PLAN_TITLES[formId]) {
    return false;
  }

  const hasNonEmpty = (...vals: Array<string | undefined | null>) =>
    vals.some((v) => Boolean(v && String(v).trim()));

  switch (formId) {
    case 'professional-development-plan': {
      const d = rawData as Partial<ProfessionalDevelopmentPlanData>;
      const defaultAcademicPeriod =
        settings?.academicYear?.trim() || '١٤٤٧هـ';
      const customPeriod =
        Boolean(d.academicPeriod?.trim()) &&
        d.academicPeriod?.trim() !== defaultAcademicPeriod;
      const customType = Boolean(d.planType && d.planType !== 'سنوية');
      const customStatus = Boolean(
        d.planStatus && d.planStatus !== 'قيد التنفيذ'
      );
      const customNeedCat = Boolean(
        d.needDiagnosisCategory &&
          d.needDiagnosisCategory !== NEED_DIAGNOSIS_OPTIONS[0]
      );
      const customFollowUp = Boolean(
        d.followUpFrequency && d.followUpFrequency !== 'شهرية'
      );
      const hasGoalInput = (d.goals || []).some((g) =>
        hasNonEmpty(
          g?.goalTitle,
          g?.currentLevel,
          g?.targetLevel,
          g?.actions,
          g?.resources,
          g?.indicators,
          g?.result
        )
      );
      return !(
        customPeriod ||
        customType ||
        customStatus ||
        customNeedCat ||
        customFollowUp ||
        hasGoalInput ||
        hasNonEmpty(
          d.subject,
          d.stageAndGrade,
          d.customNeedDiagnosis,
          d.needDiagnosisDetails,
          d.followUpNotes,
          d.impactEvaluation,
          d.principalNotes
        )
      );
    }

    case 'weekly-teacher-plan': {
      const d = rawData as Partial<WeeklyTeacherPlanData>;
      const hasLessonInput = (d.lessons || []).some((l) =>
        hasNonEmpty(
          l?.lessonTitle,
          l?.learningOutcomes,
          l?.strategiesAndActivities,
          l?.toolsAndResources,
          l?.assessmentMethods,
          l?.homeworkOrTasks
        )
      );
      return !(
        hasLessonInput ||
        hasNonEmpty(d.weekLabel, d.weekDate, d.subject, d.grade, d.teacherNotes)
      );
    }

    case 'individual-remedial-plan': {
      const d = rawData as Partial<IndividualRemedialPlanData>;
      const customWeaknessSource = Boolean(
        d.weaknessSource && d.weaknessSource !== 'مهارة'
      );
      const customDiagnosticFlag = Boolean(
        d.hasDiagnosticTest && d.hasDiagnosticTest !== 'نعم'
      );
      const hasGoalInput = (d.goals || []).some(
        (g) =>
          hasNonEmpty(g?.goalText, g?.remedialActions, g?.duration) ||
          (g?.preLevel && g.preLevel !== '٢ - ضعيف') ||
          (g?.targetLevel && g.targetLevel !== '٤ - جيد') ||
          (g?.postLevel && g.postLevel !== '٤ - جيد')
      );
      return !(
        customWeaknessSource ||
        customDiagnosticFlag ||
        hasGoalInput ||
        hasNonEmpty(
          d.studentName,
          d.subject,
          d.grade,
          d.planDate,
          d.subjectWeaknessTopics,
          d.skillWeaknessName,
          d.periodExamNameAndScore,
          d.semesterExamScoreAndGaps,
          d.diagnosticTestName,
          d.diagnosticTestResult,
          d.followUpAndResults
        )
      );
    }

    case 'group-remedial-plan': {
      const d = rawData as Partial<GroupRemedialPlanData>;
      const customScope = Boolean(
        d.beneficiariesScope && d.beneficiariesScope !== 'مجموعة'
      );
      const hasSkillInput = (d.skills || []).some((s) =>
        hasNonEmpty(s?.skillName, s?.preAssessment, s?.postAssessment)
      );
      return !(
        customScope ||
        hasSkillInput ||
        hasNonEmpty(
          d.subject,
          d.grade,
          d.classSection,
          d.studentsCount,
          d.studentNames,
          d.groupActions,
          d.customizedActionsForStudents,
          d.startDate,
          d.endDate,
          d.weeklyFrequency,
          d.sessionDuration,
          d.improvedStudentsCount,
          d.notEnoughImprovedCount,
          d.skillsImprovementDescription,
          d.recommendations
        )
      );
    }

    case 'enrichment-plan': {
      const d = rawData as Partial<EnrichmentPlanData>;
      const customScope = Boolean(
        d.beneficiariesScope && d.beneficiariesScope !== 'مجموعة'
      );
      const typesArr = Array.isArray(d.enrichmentTypes)
        ? d.enrichmentTypes
        : DEFAULT_ENRICHMENT_TYPES;
      const customEnrichmentTypes =
        typesArr.length !== DEFAULT_ENRICHMENT_TYPES.length ||
        typesArr.some((t, i) => t !== DEFAULT_ENRICHMENT_TYPES[i]);
      const hasActivityInput = (d.activities || []).some((a) =>
        hasNonEmpty(a?.activityTitle, a?.activityDescription, a?.executionMethod)
      );
      const hasProductInput = (d.studentProducts || []).some((p) =>
        hasNonEmpty(
          p?.productName,
          p?.productType,
          p?.productDescription,
          p?.participatingStudents
        )
      );
      return !(
        customScope ||
        customEnrichmentTypes ||
        hasActivityInput ||
        hasProductInput ||
        hasNonEmpty(
          d.subject,
          d.grade,
          d.studentsCount,
          d.studentNames,
          d.nominationReason,
          d.customEnrichmentType,
          d.startDate,
          d.endDate,
          d.weeklyFrequency,
          d.activityDuration,
          d.developedCapabilities,
          d.activitiesOutputs,
          d.goalsAchievementExtent,
          d.recommendations
        )
      );
    }
  }
}

// ============================================================================
// Group 2 Migration & Rollback for the 5 Teacher Plan Models ONLY
// ============================================================================
export async function migrateTeacherPlansToArchive(opts?: {
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<RunGroupMigrationSummary> {
  return runIdempotentGroupMigration<AnyTeacherPlanData, AnyTeacherPlanData>({
    groupId: 'plans',
    legacyStorageKey: TEACHER_PLANS_STORAGE_KEY,
    archiveStorageKey: TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    readLegacyCandidates: (storage) => {
      if (!storage) return [];

      // Legacy map fallback (in case older consolidated map exists under base key)
      let parsedMap: Record<string, unknown> = {};
      try {
        const mapRaw = storage.getItem(TEACHER_PLANS_STORAGE_KEY);
        if (mapRaw) {
          const parsed = JSON.parse(mapRaw);
          if (parsed && typeof parsed === 'object') {
            parsedMap = parsed as Record<string, unknown>;
          }
        }
      } catch {
        parsedMap = {};
      }

      const candidates: LegacyMigrationCandidate<AnyTeacherPlanData>[] = [];
      for (const meta of TEACHER_PLANS_CATALOG) {
        let entry: Partial<AnyTeacherPlanData> | undefined;

        // Primary legacy key used by teacherPlansEngine.ts: `${TEACHER_PLANS_STORAGE_KEY}_${formId}`
        try {
          const perFormRaw = storage.getItem(
            `${TEACHER_PLANS_STORAGE_KEY}_${meta.id}`
          );
          if (perFormRaw) {
            const parsedEntry = JSON.parse(perFormRaw);
            if (parsedEntry && typeof parsedEntry === 'object') {
              entry = parsedEntry as Partial<AnyTeacherPlanData>;
            }
          }
        } catch {
          entry = undefined;
        }

        if (!entry) {
          const mapCandidate = parsedMap[meta.id];
          if (mapCandidate && typeof mapCandidate === 'object') {
            entry = mapCandidate as Partial<AnyTeacherPlanData>;
          }
        }

        if (!entry || typeof entry !== 'object') continue;

        const merged = {
          ...createInitialTeacherPlanData(
            meta.id,
            resolveFullSettings(opts?.settings)
          ),
          ...entry,
        } as AnyTeacherPlanData;

        const isEmpty = isLegacyPlanDraftEmpty(
          meta.id,
          entry,
          opts?.settings
        );

        candidates.push({
          sourceKey: `legacy_plan_draft:${meta.id}`,
          formId: meta.id,
          title: getTeacherPlanRecordTitle(meta.id, merged),
          summary: getTeacherPlanRecordSummary(meta.id, merged),
          academicYear: opts?.settings?.academicYear || '',
          semester: opts?.settings?.semester || '',
          eventDate: getTeacherPlanEventDate(meta.id, merged),
          isEmpty,
          // Architectural invariant: legacy drafts stay drafts & non-eligible until saved explicitly
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
        sanitizedPayload: stripBase64PhotosFromPlanPayload(legacyData),
        mediaRefs,
        newlyCreatedBlobKeys,
      };
    },
  });
}

export async function rollbackTeacherPlansMigration(opts?: {
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}) {
  return rollbackGroupMigration({
    groupId: 'plans',
    archiveStorageKey: TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    storage: opts?.storage,
    mediaRepo: opts?.mediaRepo,
    extraStorageKeys: CROSS_GROUP_ARCHIVE_KEYS,
  });
}

// ============================================================================
// Archive Store Operations for Plans UI & Unit Tests
// ============================================================================
export function loadPlansArchiveStore(
  storage?: StorageLike
): TeacherPlansArchiveStore {
  return loadGroupArchiveStore<AnyTeacherPlanData>(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    'plans',
    storage
  );
}

export function listSavedPlansForForm(
  formId?: TeacherPlanFormId,
  storage?: StorageLike
): TeacherPlanArchiveRecord[] {
  const store = loadPlansArchiveStore(storage);
  return listArchivedRecords(store, formId);
}

export async function loadActivePlanDraftWithMedia<
  K extends TeacherPlanFormId,
>(
  formId: K,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  draftRecord: TeacherPlanArchiveRecord | null;
  formData: TeacherPlanFormMap[K];
  mediaRefs: UnifiedMediaRef[];
  integrityWarnings: string[];
}> {
  const store = loadPlansArchiveStore(opts?.storage);
  const draftRecord = store.activeDraftByFormId?.[formId] ?? null;

  if (draftRecord && draftRecord.formId === formId) {
    const initial = createInitialTeacherPlanData(
      formId,
      resolveFullSettings(opts?.settings)
    );
    const hydrated = await hydrateEvidencePhotosFromMediaRepo(
      draftRecord.mediaRefs,
      draftRecord.payload?.evidencePhotos,
      opts?.mediaRepo
    );
    const merged = {
      ...initial,
      ...draftRecord.payload,
      evidencePhotos: hydrated.photos,
    } as TeacherPlanFormMap[K];
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

  const legacyData = loadTeacherPlanDraftFromStorage(
    formId,
    opts?.settings as SchoolSettings | undefined,
    opts?.storage
  );
  return {
    draftRecord: null,
    formData: legacyData,
    mediaRefs: [],
    integrityWarnings: [],
  };
}

export async function loadArchivedPlanWithMedia<K extends TeacherPlanFormId>(
  recordId: string,
  opts?: {
    formId?: K;
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  record: TeacherPlanArchiveRecord;
  formData: TeacherPlanFormMap[K];
  integrityWarnings: string[];
} | null> {
  const store = loadPlansArchiveStore(opts?.storage);
  const record = store.records?.[recordId];
  if (!record) return null;

  const targetFormId = (opts?.formId || record.formId) as TeacherPlanFormId;
  const initial = createInitialTeacherPlanData(
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
    evidencePhotos: hydrated.photos,
  } as TeacherPlanFormMap[K];

  return {
    record,
    formData,
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export async function saveActivePlanDraftWithMedia<K extends TeacherPlanFormId>(
  formId: K,
  data: TeacherPlanFormMap[K],
  opts?: {
    draftId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherPlansArchiveStore;
  draftRecord: TeacherPlanArchiveRecord;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadPlansArchiveStore(opts?.storage);
  const previousDraftRefs =
    opts?.existingMediaRefs ??
    currentStore.activeDraftByFormId?.[formId]?.mediaRefs ??
    [];

  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    data.evidencePhotos,
    previousDraftRefs,
    mediaRepo,
    'upload'
  );

  // Keep legacy key continuously synchronized without stripping user continuity
  saveTeacherPlanDraftToStorage(formId, data, opts?.storage);

  const { nextStore, draftRecord } = upsertDraftRecord(currentStore, {
    id: opts?.draftId,
    formId,
    title: getTeacherPlanRecordTitle(formId, data),
    summary: getTeacherPlanRecordSummary(formId, data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherPlanEventDate(formId, data),
    mediaRefs,
    payload: stripBase64PhotosFromPlanPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // Clean up any blob keys removed from this draft ONLY if completely unreferenced globally
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

export async function savePlanToArchive<K extends TeacherPlanFormId>(
  formId: K,
  data: TeacherPlanFormMap[K],
  opts?: {
    recordId?: string;
    existingMediaRefs?: UnifiedMediaRef[];
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<{
  store: TeacherPlansArchiveStore;
  record: TeacherPlanArchiveRecord;
  isNew: boolean;
  mediaRefs: UnifiedMediaRef[];
}> {
  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  const currentStore = loadPlansArchiveStore(opts?.storage);
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
    formId,
    title: getTeacherPlanRecordTitle(formId, data),
    summary: getTeacherPlanRecordSummary(formId, data),
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    eventDate: getTeacherPlanEventDate(formId, data),
    mediaRefs,
    payload: stripBase64PhotosFromPlanPayload(data),
  });

  saveGroupArchiveStore(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  // When editing an archived plan and replacing/removing attachments, safely check ref-counts
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

export function createNewBlankPlanInArchive<K extends TeacherPlanFormId>(
  formId: K,
  opts?: {
    settings?: Partial<SchoolSettings>;
    storage?: StorageLike;
  }
): {
  store: TeacherPlansArchiveStore;
  draftRecord: TeacherPlanArchiveRecord;
  formData: TeacherPlanFormMap[K];
} {
  const freshData = createInitialTeacherPlanData(
    formId,
    opts?.settings as SchoolSettings | undefined
  );
  const currentStore = loadPlansArchiveStore(opts?.storage);
  const meta = TEACHER_PLANS_CATALOG.find((item) => item.id === formId);

  const { nextStore, draftRecord } = startNewBlankDraftInStore(currentStore, {
    formId,
    title: meta?.title || 'مسودة خطة جديدة',
    academicYear: opts?.settings?.academicYear || '',
    semester: opts?.settings?.semester || '',
    payload: stripBase64PhotosFromPlanPayload(freshData),
  });

  saveGroupArchiveStore(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    nextStore,
    opts?.storage
  );

  return {
    store: nextStore,
    draftRecord,
    formData: freshData,
  };
}

export function inspectArchivedPlanDeletionImpact(
  recordId: string,
  opts?: {
    storage?: StorageLike;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): RecordDeletionImpact {
  const store = loadPlansArchiveStore(opts?.storage);
  const activeKeys = opts?.activeUiDraftMediaRefs
    ? Array.from(opts.activeUiDraftMediaRefs).map((r) => r.blobKey)
    : [];
  const baseImpact = inspectRecordDeletionImpact(store, recordId, {
    storage: opts?.storage,
    activeUiDraftBlobKeys: activeKeys,
  });

  // Also check cross-group references (e.g. Group 1 reports) so sharedBlobKeys reflects reality
  const reportsStoreRaw =
    opts?.storage?.getItem('maktabi_teacher_reports_archive_v1') ??
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('maktabi_teacher_reports_archive_v1')
      : null);

  if (reportsStoreRaw && baseImpact.recordBlobKeys.length > 0) {
    try {
      const parsed = JSON.parse(reportsStoreRaw) as {
        records?: Record<string, { mediaRefs?: UnifiedMediaRef[] }>;
        activeDraftByFormId?: Record<string, { mediaRefs?: UnifiedMediaRef[] }>;
      };
      const externalKeys = new Set<string>();
      for (const r of Object.values(parsed.records || {})) {
        for (const ref of r?.mediaRefs || []) externalKeys.add(ref.blobKey);
      }
      for (const d of Object.values(parsed.activeDraftByFormId || {})) {
        for (const ref of d?.mediaRefs || []) externalKeys.add(ref.blobKey);
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
    } catch {
      // Ignore malformed external store
    }
  }

  return baseImpact;
}

export async function deleteArchivedPlanRecordSafely(
  recordId: string,
  opts?: {
    confirmUnlink?: boolean;
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
    activeUiDraftMediaRefs?: Iterable<UnifiedMediaRef>;
  }
): Promise<{
  nextStore: TeacherPlansArchiveStore;
  result: SafeDeleteRecordResult;
}> {
  const store = loadPlansArchiveStore(opts?.storage);
  return deleteArchivedRecordSafely(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
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
