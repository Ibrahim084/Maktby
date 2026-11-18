import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import {
  CertificateCategoryType,
  CertificateFormState,
} from './certificatesEngine';
import { generateQrMatrix } from './qrCodeGenerator';
import { getGenderedLabels } from './settingsStorage';
import {
  extractEvidencePhotosToMediaRepo,
  generateImmutableRecordId,
  hydrateEvidencePhotosFromMediaRepo,
  loadGroupArchiveStore,
  StorageLike,
  TEACHER_PORTFOLIO_STORAGE_KEY,
  TeacherArchiveGroupId,
  TeacherArchiveRecord,
  TeacherGroupArchiveStore,
} from './teacherArchiveEngine';
import {
  TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
} from './teacherCertificatesArchive';
import {
  computeSha256Hex,
  dataUrlToBytes,
  deleteBlobIfUnreferenced,
  getDefaultTeacherMediaRepository,
  TeacherMediaRepository,
  UnifiedMediaRef,
} from './teacherMediaStorage';
import {
  TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
} from './teacherMeetingsArchive';
import {
  TEACHER_MEETINGS_AND_VISITS_CATALOG,
} from './teacherMeetingsAndVisitsEngine';
import {
  buildTeacherPdfBinaryWithLinks,
  PdfLinkAnnotation,
  TeacherPageJpegWithLinks,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from './teacherPdfEngine';
import { wrapCanvasLines } from './teacherPdfTemplates';
import {
  TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
} from './teacherPeerVisitsArchive';
import {
  TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
} from './teacherPlansArchive';
import {
  TEACHER_PLANS_CATALOG,
} from './teacherPlansEngine';
import {
  TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
} from './teacherProgramsAndActivitiesArchive';
import {
  TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG,
} from './teacherProgramsAndActivitiesEngine';
import {
  TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
} from './teacherReportsArchive';
import {
  TEACHER_PROFESSIONAL_REPORTS_CATALOG,
} from './teacherReportsEngine';
import {
  TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
} from './teacherTestsAndEvaluationArchive';
import {
  TEACHER_TESTS_AND_EVALUATION_CATALOG,
} from './teacherTestsAndEvaluationEngine';
import { sanitizeFilenameSegment } from './zipBuilder';

// ============================================================================
// Constants & Approved 11 Performance Elements
// ============================================================================
export { TEACHER_PORTFOLIO_STORAGE_KEY };

export const TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY =
  'maktabi_teacher_portfolio_backup_v1';

export type TeacherPortfolioElementId =
  | 'element-1'
  | 'element-2'
  | 'element-3'
  | 'element-4'
  | 'element-5'
  | 'element-6'
  | 'element-7'
  | 'element-8'
  | 'element-9'
  | 'element-10'
  | 'element-11';

export interface TeacherPortfolioElementDefinition {
  id: TeacherPortfolioElementId;
  number: number;
  /** Exact approved Arabic title with trailing period per Group 8 specification */
  title: string;
  /** Official Ministry of Education weight percentage (total across all 11 elements = 100) */
  weightPercent: number;
}

/**
 * The 11 official Teacher Performance Elements with exact approved titles and official MOE weights.
 */
export const TEACHER_PORTFOLIO_ELEMENTS_CATALOG: readonly TeacherPortfolioElementDefinition[] =
  [
    {
      id: 'element-1',
      number: 1,
      title: 'أداء الواجبات الوظيفية.',
      weightPercent: 10,
    },
    {
      id: 'element-2',
      number: 2,
      title: 'التفاعل مع المجتمع المهني.',
      weightPercent: 10,
    },
    {
      id: 'element-3',
      number: 3,
      title: 'التفاعل مع أولياء الأمور.',
      weightPercent: 10,
    },
    {
      id: 'element-4',
      number: 4,
      title: 'التنوع في استراتيجيات التدريس.',
      weightPercent: 10,
    },
    {
      id: 'element-5',
      number: 5,
      title: 'تحسين نتائج المتعلمين.',
      weightPercent: 10,
    },
    {
      id: 'element-6',
      number: 6,
      title: 'إعداد وتنفيذ خطة التعلم.',
      weightPercent: 10,
    },
    {
      id: 'element-7',
      number: 7,
      title: 'توظيف تقنيات ووسائل التعلم المناسبة.',
      weightPercent: 10,
    },
    {
      id: 'element-8',
      number: 8,
      title: 'تهيئة البيئة التعليمية.',
      weightPercent: 5,
    },
    {
      id: 'element-9',
      number: 9,
      title: 'الإدارة الصفية.',
      weightPercent: 5,
    },
    {
      id: 'element-10',
      number: 10,
      title: 'تحليل نتائج المتعلمين وتشخيص مستوياتهم.',
      weightPercent: 10,
    },
    {
      id: 'element-11',
      number: 11,
      title: 'تنوع أساليب التقويم.',
      weightPercent: 10,
    },
  ] as const;

export interface TeacherPortfolioSourceGroupMeta {
  groupId: TeacherArchiveGroupId;
  storageKey: string;
  groupNumber: number;
  title: string;
  shortTitle: string;
}

export const TEACHER_PORTFOLIO_SOURCE_GROUPS: readonly TeacherPortfolioSourceGroupMeta[] =
  [
    {
      groupId: 'professional-reports',
      storageKey: TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
      groupNumber: 1,
      title: 'التقارير المهنية والتعليمية',
      shortTitle: 'التقارير المهنية',
    },
    {
      groupId: 'plans',
      storageKey: TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
      groupNumber: 2,
      title: 'الخطط',
      shortTitle: 'الخطط',
    },
    {
      groupId: 'meetings-visits',
      storageKey: TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
      groupNumber: 3,
      title: 'الاجتماعات واللجان',
      shortTitle: 'الاجتماعات واللجان',
    },
    {
      groupId: 'peer-visits',
      storageKey: TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
      groupNumber: 4,
      title: 'الزيارات والتبادل المهني',
      shortTitle: 'الزيارات التبادلية',
    },
    {
      groupId: 'tests-evaluation',
      storageKey: TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
      groupNumber: 5,
      title: 'الاختبارات والتقويم',
      shortTitle: 'الاختبارات والتقويم',
    },
    {
      groupId: 'programs-activities',
      storageKey: TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
      groupNumber: 6,
      title: 'البرامج والأنشطة التعليمية',
      shortTitle: 'البرامج والمبادرات',
    },
    {
      groupId: 'certificates',
      storageKey: TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
      groupNumber: 7,
      title: 'الشهادات',
      shortTitle: 'الشهادات',
    },
  ] as const;

// ============================================================================
// Portfolio Store Contracts (100% compatible with teacherArchiveEngine.ts)
// ============================================================================
export interface TeacherPortfolioLinkedRecordRef {
  sourceGroupId: TeacherArchiveGroupId;
  sourceRecordId: string;
  linkedAt: string;
  note?: string;
}

export type TeacherStandaloneEvidenceType =
  | 'practice'
  | 'report'
  | 'activity'
  | 'evaluation'
  | 'communication'
  | 'general';

export interface TeacherStandaloneEvidenceTypeOption {
  id: TeacherStandaloneEvidenceType;
  label: string;
}

export const TEACHER_STANDALONE_EVIDENCE_TYPES: readonly TeacherStandaloneEvidenceTypeOption[] =
  [
    { id: 'practice', label: 'توثيق ممارسة تعليمية' },
    { id: 'report', label: 'تقرير مهني مختصر' },
    { id: 'activity', label: 'برنامج أو نشاط تعليمي' },
    { id: 'evaluation', label: 'شاهد تقويم أو قياس تعلم' },
    { id: 'communication', label: 'شاهد تفاعل مهني أو أسري' },
    { id: 'general', label: 'شاهد أداء وظيفي عام' },
  ] as const;

export function getStandaloneEvidenceTypeLabel(
  type: TeacherStandaloneEvidenceType | string | undefined
): string {
  const found = TEACHER_STANDALONE_EVIDENCE_TYPES.find((t) => t.id === type);
  return found?.label || 'شاهد أداء وظيفي';
}

export interface TeacherPortfolioStandaloneEvidence {
  id: string;
  elementId: string;
  evidenceType: TeacherStandaloneEvidenceType;
  title: string;
  executionDate: string;
  targetAudience: string;
  description: string;
  impact: string;
  academicYear: string;
  semester: string;
  mediaRefs: UnifiedMediaRef[];
  evidenceLinks: TeacherReportEvidenceLink[];
  recordState: 'archived_saved';
  createdAt: string;
  updatedAt: string;
}

export interface TeacherPortfolioStandaloneFormInput {
  id?: string;
  evidenceType: TeacherStandaloneEvidenceType;
  title: string;
  executionDate: string;
  targetAudience: string;
  description: string;
  impact: string;
  academicYear?: string;
  semester?: string;
  evidencePhotos: TeacherReportEvidencePhoto[];
  evidenceLinks: TeacherReportEvidenceLink[];
}

export interface TeacherPortfolioElementRecord {
  id: string;
  number: number;
  title: string;
  linkedRecords: TeacherPortfolioLinkedRecordRef[];
  standaloneEvidences: TeacherPortfolioStandaloneEvidence[];
}

export interface TeacherPortfolioDeletionAuditEntry {
  id: string;
  deletedGroupId: TeacherArchiveGroupId;
  deletedRecordId: string;
  deletedRecordTitle?: string;
  unlinkedElementIds: string[];
  deletedAt: string;
  note?: string;
}

export interface TeacherPortfolioStore {
  schemaVersion: 1;
  elements: Record<string, TeacherPortfolioElementRecord>;
  sourceDeletionAuditLog: TeacherPortfolioDeletionAuditEntry[];
  updatedAt: string;
}

export interface PortfolioStorageInspectionResult {
  exists: boolean;
  isValidJson: boolean;
  hasAllCanonicalElements: boolean;
  existingElementKeys: string[];
  totalLinkedRefsCount: number;
  auditLogCount: number;
  needsInitializationOrMigration: boolean;
  rawContent: string | null;
}

export interface SavePortfolioStoreResult {
  ok: boolean;
  store: TeacherPortfolioStore;
  rolledBack: boolean;
  error?: string;
}

export interface InitializePortfolioStoreResult {
  ok: boolean;
  store: TeacherPortfolioStore;
  migrated: boolean;
  backedUpPreviousRaw: boolean;
  rolledBack: boolean;
  error?: string;
}

// ============================================================================
// Internal Helpers
// ============================================================================
function resolveStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

function isValidSourceGroupId(val: unknown): val is TeacherArchiveGroupId {
  return (
    typeof val === 'string' &&
    TEACHER_PORTFOLIO_SOURCE_GROUPS.some((g) => g.groupId === val)
  );
}

export function getSourceGroupMeta(
  groupId: TeacherArchiveGroupId
): TeacherPortfolioSourceGroupMeta {
  const found = TEACHER_PORTFOLIO_SOURCE_GROUPS.find(
    (g) => g.groupId === groupId
  );
  return (
    found || {
      groupId,
      storageKey: '',
      groupNumber: 0,
      title: groupId,
      shortTitle: groupId,
    }
  );
}

export function resolveSourceFormTitle(
  groupId: TeacherArchiveGroupId,
  formId: string,
  payload?: Record<string, unknown>
): string {
  switch (groupId) {
    case 'professional-reports': {
      const item = TEACHER_PROFESSIONAL_REPORTS_CATALOG.find(
        (r) => r.id === formId
      );
      return item?.title || 'تقرير مهني وتعليمي';
    }
    case 'plans': {
      const item = TEACHER_PLANS_CATALOG.find((p) => p.id === formId);
      return item?.title || 'خطة تعليمية أو مهنية';
    }
    case 'meetings-visits':
    case 'peer-visits': {
      const item = TEACHER_MEETINGS_AND_VISITS_CATALOG.find(
        (m) => m.id === formId
      );
      return (
        item?.title ||
        (groupId === 'meetings-visits' ? 'محضر اجتماع' : 'زيارة تبادلية')
      );
    }
    case 'tests-evaluation': {
      const item = TEACHER_TESTS_AND_EVALUATION_CATALOG.find(
        (t) => t.id === formId
      );
      return item?.title || 'نموذج اختبار وتقويم';
    }
    case 'programs-activities': {
      const item = TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.find(
        (p) => p.id === formId
      );
      return item?.title || 'مبادرة تربوية أو برنامج تعليمي';
    }
    case 'certificates': {
      const certType = payload?.certificateType as
        | CertificateCategoryType
        | undefined;
      if (certType === 'appreciation') return 'شهادة شكر وتقدير';
      if (certType === 'excellence') return 'شهادة تفوق';
      if (certType === 'graduation') return 'شهادة تخرج';
      return 'شهادات مدرسية';
    }
  }
}

/**
 * Extracts normalized reference objects from an untrusted element object,
 * deduplicating by `sourceGroupId::sourceRecordId` while preserving order and notes.
 */
function extractNormalizedLinksFromRawElement(
  elObj: Record<string, unknown>
): TeacherPortfolioLinkedRecordRef[] {
  const seen = new Set<string>();
  const normalized: TeacherPortfolioLinkedRecordRef[] = [];
  const candidateLists = [elObj.linkedRecords, elObj.evidences, elObj.links];

  for (const list of candidateLists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const rawItem = item as Record<string, unknown>;
      const rawRecordId =
        typeof rawItem.sourceRecordId === 'string' &&
        rawItem.sourceRecordId.trim()
          ? rawItem.sourceRecordId.trim()
          : typeof rawItem.recordId === 'string' && rawItem.recordId.trim()
            ? rawItem.recordId.trim()
            : '';
      const rawGroupId = rawItem.sourceGroupId;
      if (!rawRecordId || !isValidSourceGroupId(rawGroupId)) continue;

      const dedupeKey = `${rawGroupId}::${rawRecordId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const linkedAt =
        typeof rawItem.linkedAt === 'string' && rawItem.linkedAt.trim()
          ? rawItem.linkedAt.trim()
          : new Date().toISOString();
      const note =
        typeof rawItem.note === 'string' && rawItem.note.trim()
          ? rawItem.note.trim()
          : undefined;

      normalized.push({
        sourceGroupId: rawGroupId,
        sourceRecordId: rawRecordId,
        linkedAt,
        ...(note ? { note } : {}),
      });
    }
  }

  return normalized;
}

/**
 * Maps legacy or variant element keys (e.g. `el-1`, `1`, `element_1`) to canonical `element-1`..`element-11`
 * when applicable. Returns `null` if it is a custom non-standard key.
 */
function resolveCanonicalElementId(
  rawKey: string
): TeacherPortfolioElementId | null {
  const trimmed = rawKey.trim();
  const directMatch = TEACHER_PORTFOLIO_ELEMENTS_CATALOG.find(
    (e) => e.id === trimmed
  );
  if (directMatch) return directMatch.id;

  const match = /^(?:element[-_]?|el[-_]?|item[-_]?)?(\d{1,2})$/i.exec(trimmed);
  if (match) {
    const num = Number(match[1]);
    const byNum = TEACHER_PORTFOLIO_ELEMENTS_CATALOG.find(
      (e) => e.number === num
    );
    if (byNum) return byNum.id;
  }
  return null;
}

function isValidStandaloneEvidenceType(
  val: unknown
): val is TeacherStandaloneEvidenceType {
  return (
    typeof val === 'string' &&
    TEACHER_STANDALONE_EVIDENCE_TYPES.some((t) => t.id === val)
  );
}

function normalizeEvidenceLinksArray(
  raw: unknown
): TeacherReportEvidenceLink[] {
  if (!Array.isArray(raw)) return [];
  const seenUrls = new Set<string>();
  const out: TeacherReportEvidenceLink[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    out.push({
      id:
        typeof obj.id === 'string' && obj.id.trim()
          ? obj.id.trim()
          : `link-${i + 1}`,
      url,
    });
    if (out.length >= 2) break;
  }
  return out;
}

function normalizeMediaRefsArray(raw: unknown): UnifiedMediaRef[] {
  if (!Array.isArray(raw)) return [];
  const out: UnifiedMediaRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.blobKey !== 'string' || !obj.blobKey.startsWith('sha256:')) {
      continue;
    }
    out.push({
      id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `mref-${out.length + 1}`,
      blobKey: obj.blobKey,
      contentSha256:
        typeof obj.contentSha256 === 'string'
          ? obj.contentSha256
          : obj.blobKey.slice(7),
      crc32: typeof obj.crc32 === 'number' ? obj.crc32 >>> 0 : 0,
      fileName:
        typeof obj.fileName === 'string' && obj.fileName.trim()
          ? obj.fileName.trim()
          : `evidence-${out.length + 1}.png`,
      mimeType:
        typeof obj.mimeType === 'string' && obj.mimeType.trim()
          ? obj.mimeType.trim()
          : 'image/png',
      byteLength:
        typeof obj.byteLength === 'number' && Number.isFinite(obj.byteLength)
          ? obj.byteLength
          : 0,
      createdAt:
        typeof obj.createdAt === 'string' && obj.createdAt.trim()
          ? obj.createdAt.trim()
          : new Date().toISOString(),
      sourceTag:
        obj.sourceTag === 'upload' ||
        obj.sourceTag === 'legacy-migration' ||
        obj.sourceTag === 'sample'
          ? obj.sourceTag
          : 'upload',
    });
    if (out.length >= 2) break;
  }
  return out;
}

function extractNormalizedStandaloneEvidencesFromRawElement(
  elObj: Record<string, unknown>,
  fallbackElementId: string
): TeacherPortfolioStandaloneEvidence[] {
  const rawList = elObj.standaloneEvidences;
  if (!Array.isArray(rawList)) return [];

  const seenIds = new Set<string>();
  const out: TeacherPortfolioStandaloneEvidence[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : '';
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const description =
      typeof obj.description === 'string' ? obj.description.trim() : '';
    if (!id || !title || !description || seenIds.has(id)) continue;
    // Never treat a draft state as a saved standalone evidence
    if (obj.recordState === 'draft') continue;
    seenIds.add(id);

    const nowIso = new Date().toISOString();
    out.push({
      id,
      elementId:
        typeof obj.elementId === 'string' && obj.elementId.trim()
          ? obj.elementId.trim()
          : fallbackElementId,
      evidenceType: isValidStandaloneEvidenceType(obj.evidenceType)
        ? obj.evidenceType
        : 'practice',
      title,
      executionDate:
        typeof obj.executionDate === 'string' ? obj.executionDate.trim() : '',
      targetAudience:
        typeof obj.targetAudience === 'string' ? obj.targetAudience.trim() : '',
      description,
      impact: typeof obj.impact === 'string' ? obj.impact.trim() : '',
      academicYear:
        typeof obj.academicYear === 'string' ? obj.academicYear.trim() : '',
      semester: typeof obj.semester === 'string' ? obj.semester.trim() : '',
      mediaRefs: normalizeMediaRefsArray(obj.mediaRefs),
      evidenceLinks: normalizeEvidenceLinksArray(obj.evidenceLinks),
      recordState: 'archived_saved',
      createdAt:
        typeof obj.createdAt === 'string' && obj.createdAt.trim()
          ? obj.createdAt.trim()
          : nowIso,
      updatedAt:
        typeof obj.updatedAt === 'string' && obj.updatedAt.trim()
          ? obj.updatedAt.trim()
          : nowIso,
    });
  }

  return out;
}

// ============================================================================
// Storage Inspection, Safe Initialization, Migration & Rollback
// ============================================================================
export function createInitialPortfolioStore(): TeacherPortfolioStore {
  const nowIso = new Date().toISOString();
  const elements: Record<string, TeacherPortfolioElementRecord> = {};

  for (const def of TEACHER_PORTFOLIO_ELEMENTS_CATALOG) {
    elements[def.id] = {
      id: def.id,
      number: def.number,
      title: def.title,
      linkedRecords: [],
      standaloneEvidences: [],
    };
  }

  return {
    schemaVersion: 1,
    elements,
    sourceDeletionAuditLog: [],
    updatedAt: nowIso,
  };
}

export function inspectPortfolioStorageState(
  storage?: StorageLike
): PortfolioStorageInspectionResult {
  const store = resolveStorage(storage);
  if (!store) {
    return {
      exists: false,
      isValidJson: true,
      hasAllCanonicalElements: false,
      existingElementKeys: [],
      totalLinkedRefsCount: 0,
      auditLogCount: 0,
      needsInitializationOrMigration: true,
      rawContent: null,
    };
  }

  let raw: string | null = null;
  try {
    raw = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY);
  } catch {
    return {
      exists: false,
      isValidJson: false,
      hasAllCanonicalElements: false,
      existingElementKeys: [],
      totalLinkedRefsCount: 0,
      auditLogCount: 0,
      needsInitializationOrMigration: true,
      rawContent: null,
    };
  }

  if (!raw) {
    return {
      exists: false,
      isValidJson: true,
      hasAllCanonicalElements: false,
      existingElementKeys: [],
      totalLinkedRefsCount: 0,
      auditLogCount: 0,
      needsInitializationOrMigration: true,
      rawContent: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        exists: true,
        isValidJson: false,
        hasAllCanonicalElements: false,
        existingElementKeys: [],
        totalLinkedRefsCount: 0,
        auditLogCount: 0,
        needsInitializationOrMigration: true,
        rawContent: raw,
      };
    }

    const rawElements =
      parsed.elements && typeof parsed.elements === 'object'
        ? (parsed.elements as Record<string, unknown>)
        : {};
    const existingElementKeys = Object.keys(rawElements);

    let totalLinkedRefsCount = 0;
    for (const val of Object.values(rawElements)) {
      if (val && typeof val === 'object') {
        totalLinkedRefsCount += extractNormalizedLinksFromRawElement(
          val as Record<string, unknown>
        ).length;
      }
    }

    const hasAllCanonicalElements = TEACHER_PORTFOLIO_ELEMENTS_CATALOG.every(
      (def) => {
        const el = rawElements[def.id] as Record<string, unknown> | undefined;
        return (
          Boolean(el) &&
          typeof el === 'object' &&
          el?.title === def.title &&
          Array.isArray(el?.linkedRecords) &&
          (el?.standaloneEvidences === undefined ||
            Array.isArray(el?.standaloneEvidences))
        );
      }
    );

    const hasLegacyAliasKeys = existingElementKeys.some((k) => {
      const canonical = resolveCanonicalElementId(k);
      return canonical !== null && canonical !== k;
    });

    const auditLogCount = Array.isArray(parsed.sourceDeletionAuditLog)
      ? parsed.sourceDeletionAuditLog.length
      : 0;

    return {
      exists: true,
      isValidJson: true,
      hasAllCanonicalElements,
      existingElementKeys,
      totalLinkedRefsCount,
      auditLogCount,
      needsInitializationOrMigration:
        !hasAllCanonicalElements ||
        hasLegacyAliasKeys ||
        parsed.schemaVersion !== 1 ||
        parsed.standaloneDraftsByElementId !== undefined,
      rawContent: raw,
    };
  } catch {
    return {
      exists: true,
      isValidJson: false,
      hasAllCanonicalElements: false,
      existingElementKeys: [],
      totalLinkedRefsCount: 0,
      auditLogCount: 0,
      needsInitializationOrMigration: true,
      rawContent: raw,
    };
  }
}

/**
 * Normalizes any existing raw portfolio object into a canonical `TeacherPortfolioStore`
 * without losing any existing links, standalone evidences, drafts, or deletion audit log entries.
 */
export function normalizePortfolioStoreData(
  rawParsed: Record<string, unknown> | null | undefined
): TeacherPortfolioStore {
  const base = createInitialPortfolioStore();
  if (!rawParsed || typeof rawParsed !== 'object' || Array.isArray(rawParsed)) {
    return base;
  }

  const rawElements =
    rawParsed.elements && typeof rawParsed.elements === 'object'
      ? (rawParsed.elements as Record<string, unknown>)
      : {};

  // 1. Merge links & standalone evidences for canonical elements and their numbered aliases (`el-1` -> `element-1`)
  for (const [rawKey, rawVal] of Object.entries(rawElements)) {
    if (!rawVal || typeof rawVal !== 'object') continue;
    const elObj = rawVal as Record<string, unknown>;
    const extractedLinks = extractNormalizedLinksFromRawElement(elObj);
    const canonicalId = resolveCanonicalElementId(rawKey);
    const extractedStandalone =
      extractNormalizedStandaloneEvidencesFromRawElement(
        elObj,
        canonicalId || rawKey
      );

    if (canonicalId) {
      const targetEl = base.elements[canonicalId];
      const existingKeys = new Set(
        targetEl.linkedRecords.map(
          (r) => `${r.sourceGroupId}::${r.sourceRecordId}`
        )
      );
      for (const link of extractedLinks) {
        const k = `${link.sourceGroupId}::${link.sourceRecordId}`;
        if (!existingKeys.has(k)) {
          existingKeys.add(k);
          targetEl.linkedRecords.push(link);
        }
      }

      const existingStandaloneIds = new Set(
        targetEl.standaloneEvidences.map((s) => s.id)
      );
      for (const st of extractedStandalone) {
        if (!existingStandaloneIds.has(st.id)) {
          existingStandaloneIds.add(st.id);
          targetEl.standaloneEvidences.push({
            ...st,
            elementId: canonicalId,
          });
        }
      }
    } else {
      // Preserve any custom non-numbered element key so zero user/test data is ever lost
      const customTitle =
        typeof elObj.title === 'string' && elObj.title.trim()
          ? elObj.title.trim()
          : `عنصر الأداء (${rawKey})`;
      base.elements[rawKey] = {
        id: rawKey,
        number:
          typeof elObj.number === 'number' && Number.isFinite(elObj.number)
            ? elObj.number
            : 0,
        title: customTitle,
        linkedRecords: extractedLinks,
        standaloneEvidences: extractedStandalone,
      };
    }
  }

  // 2. Preserve sourceDeletionAuditLog entries (no standalone drafts stored)
  if (Array.isArray(rawParsed.sourceDeletionAuditLog)) {
    const seenAudit = new Set<string>();
    const normalizedAudit: TeacherPortfolioDeletionAuditEntry[] = [];
    for (const item of rawParsed.sourceDeletionAuditLog) {
      if (!item || typeof item !== 'object') continue;
      const aObj = item as Record<string, unknown>;
      const deletedRecordId =
        typeof aObj.deletedRecordId === 'string' ? aObj.deletedRecordId : '';
      const deletedGroupId = aObj.deletedGroupId;
      if (!deletedRecordId || !isValidSourceGroupId(deletedGroupId)) continue;

      const id =
        typeof aObj.id === 'string' && aObj.id.trim()
          ? aObj.id.trim()
          : `audit_${deletedGroupId}_${deletedRecordId}`;
      const dedupeKey = `${id}::${deletedGroupId}::${deletedRecordId}::${String(aObj.deletedAt || '')}`;
      if (seenAudit.has(dedupeKey)) continue;
      seenAudit.add(dedupeKey);

      normalizedAudit.push({
        id,
        deletedGroupId,
        deletedRecordId,
        deletedRecordTitle:
          typeof aObj.deletedRecordTitle === 'string'
            ? aObj.deletedRecordTitle
            : undefined,
        unlinkedElementIds: Array.isArray(aObj.unlinkedElementIds)
          ? aObj.unlinkedElementIds.filter(
              (x): x is string => typeof x === 'string'
            )
          : [],
        deletedAt:
          typeof aObj.deletedAt === 'string' && aObj.deletedAt.trim()
            ? aObj.deletedAt
            : new Date().toISOString(),
        note: typeof aObj.note === 'string' ? aObj.note : undefined,
      });
    }
    base.sourceDeletionAuditLog = normalizedAudit;
  }

  if (typeof rawParsed.updatedAt === 'string' && rawParsed.updatedAt.trim()) {
    base.updatedAt = rawParsed.updatedAt;
  }

  return base;
}

/**
 * Loads the current `TeacherPortfolioStore` in memory (read-only) without mutating storage.
 */
export function loadPortfolioStore(
  storage?: StorageLike
): TeacherPortfolioStore {
  const store = resolveStorage(storage);
  if (!store) return createInitialPortfolioStore();

  try {
    const raw = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY);
    if (!raw) return createInitialPortfolioStore();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizePortfolioStoreData(parsed);
  } catch {
    return createInitialPortfolioStore();
  }
}

/**
 * Saves the portfolio store with write verification and automatic rollback on failure.
 * Never claims success if `setItem` throws or fails verification.
 */
export function savePortfolioStoreSafely(
  portfolioStore: TeacherPortfolioStore,
  storage?: StorageLike
): SavePortfolioStoreResult {
  const store = resolveStorage(storage);
  if (!store) {
    return {
      ok: false,
      store: portfolioStore,
      rolledBack: false,
      error: 'مخزن المتصفح المحلي (localStorage) غير متاح حاليًا.',
    };
  }

  let previousRaw: string | null = null;
  try {
    previousRaw = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY);
  } catch {
    previousRaw = null;
  }

  const nextStore: TeacherPortfolioStore = {
    ...portfolioStore,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(nextStore);

  try {
    store.setItem(TEACHER_PORTFOLIO_STORAGE_KEY, serialized);
    const readBack = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY);
    if (readBack !== serialized) {
      throw new Error('فشل التحقق من مطابقة البيانات المكتوبة في مخزن ملف الشواهد.');
    }
    return {
      ok: true,
      store: nextStore,
      rolledBack: false,
    };
  } catch (err) {
    let rolledBack = false;
    try {
      if (previousRaw === null) {
        store.removeItem(TEACHER_PORTFOLIO_STORAGE_KEY);
        rolledBack = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY) === null;
      } else {
        store.setItem(TEACHER_PORTFOLIO_STORAGE_KEY, previousRaw);
        rolledBack =
          store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY) === previousRaw;
      }
    } catch {
      rolledBack = false;
    }

    const previousStore = loadPortfolioStore(store);
    const errMsg =
      err instanceof Error
        ? err.message
        : 'تعذر حفظ التغييرات في مخزن ملف شواهد الأداء.';
    return {
      ok: false,
      store: previousStore,
      rolledBack,
      error: `فشل حفظ ملف شواهد الأداء: ${errMsg}`,
    };
  }
}

/**
 * Safely initializes or migrates `maktabi_teacher_portfolio_v1` idempotently.
 * - Preserves all existing links and deletion audit logs.
 * - Refuses to overwrite corrupted non-JSON data unless `recoverFromBackupOrReset` is requested,
 *   or backs up previous raw string in `TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY` before normalizing.
 */
export function initializeOrMigratePortfolioStore(opts?: {
  storage?: StorageLike;
}): InitializePortfolioStoreResult {
  const store = resolveStorage(opts?.storage);
  if (!store) {
    return {
      ok: false,
      store: createInitialPortfolioStore(),
      migrated: false,
      backedUpPreviousRaw: false,
      rolledBack: false,
      error: 'مخزن المتصفح المحلي غير متاح.',
    };
  }

  const inspection = inspectPortfolioStorageState(store);

  // If corrupted JSON exists in storage, back it up and report clearly without silent data loss
  if (inspection.exists && !inspection.isValidJson) {
    let backedUp = false;
    try {
      if (inspection.rawContent) {
        store.setItem(
          TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY,
          inspection.rawContent
        );
        backedUp = true;
      }
    } catch {
      backedUp = false;
    }
    return {
      ok: false,
      store: createInitialPortfolioStore(),
      migrated: false,
      backedUpPreviousRaw: backedUp,
      rolledBack: false,
      error:
        'تم اكتشاف بيانات غير صالحة في مخزن ملف شواهد الأداء. تم الاحتفاظ بنسخة احتياطية منها ولم يتم استبدالها صامتًا.',
    };
  }

  // Already canonical and up-to-date -> idempotent no-op
  if (inspection.exists && !inspection.needsInitializationOrMigration) {
    return {
      ok: true,
      store: loadPortfolioStore(store),
      migrated: false,
      backedUpPreviousRaw: false,
      rolledBack: false,
    };
  }

  // Backup existing non-empty raw data before migrating
  let backedUpPreviousRaw = false;
  if (inspection.exists && inspection.rawContent) {
    try {
      store.setItem(
        TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY,
        inspection.rawContent
      );
      backedUpPreviousRaw =
        store.getItem(TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY) ===
        inspection.rawContent;
    } catch {
      backedUpPreviousRaw = false;
    }
  }

  const normalized = loadPortfolioStore(store);
  const saveRes = savePortfolioStoreSafely(normalized, store);

  if (!saveRes.ok) {
    return {
      ok: false,
      store: saveRes.store,
      migrated: false,
      backedUpPreviousRaw,
      rolledBack: saveRes.rolledBack,
      error: saveRes.error,
    };
  }

  return {
    ok: true,
    store: saveRes.store,
    migrated: true,
    backedUpPreviousRaw,
    rolledBack: false,
  };
}

export function rollbackPortfolioFromBackup(opts?: {
  storage?: StorageLike;
}): {
  ok: boolean;
  restored: boolean;
  store: TeacherPortfolioStore;
  error?: string;
} {
  const store = resolveStorage(opts?.storage);
  if (!store) {
    return {
      ok: false,
      restored: false,
      store: createInitialPortfolioStore(),
      error: 'مخزن المتصفح المحلي غير متاح.',
    };
  }

  try {
    const backupRaw = store.getItem(TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY);
    if (backupRaw === null) {
      return {
        ok: false,
        restored: false,
        store: loadPortfolioStore(store),
        error: 'لا توجد نسخة احتياطية محفوظة لاستعادتها.',
      };
    }

    store.setItem(TEACHER_PORTFOLIO_STORAGE_KEY, backupRaw);
    const verified = store.getItem(TEACHER_PORTFOLIO_STORAGE_KEY) === backupRaw;
    if (!verified) {
      return {
        ok: false,
        restored: false,
        store: loadPortfolioStore(store),
        error: 'تعذر التحقق من استعادة النسخة الاحتياطية.',
      };
    }

    return {
      ok: true,
      restored: true,
      store: loadPortfolioStore(store),
    };
  } catch (err) {
    return {
      ok: false,
      restored: false,
      store: loadPortfolioStore(store),
      error:
        err instanceof Error
          ? err.message
          : 'فشل استعادة النسخة الاحتياطية لملف الشواهد.',
    };
  }
}

// ============================================================================
// Reading Eligible Source Records from Approved Groups 1–7 (Read-Only)
// ============================================================================
export interface EligiblePortfolioSourceRecordItem {
  record: TeacherArchiveRecord<Record<string, unknown>>;
  groupId: TeacherArchiveGroupId;
  groupTitle: string;
  groupShortTitle: string;
  formTitle: string;
  attachmentsCount: number;
  electronicLinksCount: number;
}

export function extractElectronicLinksFromPayload(
  payload: Record<string, unknown> | undefined
): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const urls: string[] = [];

  if (Array.isArray(payload.evidenceLinks)) {
    for (const item of payload.evidenceLinks) {
      if (item && typeof item === 'object') {
        const u = (item as Record<string, unknown>).url;
        if (typeof u === 'string' && u.trim()) {
          urls.push(u.trim());
        }
      } else if (typeof item === 'string' && item.trim()) {
        urls.push(item.trim());
      }
    }
  }

  for (const key of ['evidenceLink1', 'evidenceLink2', 'linkUrl'] as const) {
    const val = payload[key];
    if (typeof val === 'string' && val.trim() && !urls.includes(val.trim())) {
      urls.push(val.trim());
    }
  }

  return urls;
}

export function extractFallbackPhotosFromPayload(
  payload: Record<string, unknown> | undefined
): Array<{ id: string; imageDataUrl: string }> {
  if (!payload || typeof payload !== 'object') return [];
  const photos: Array<{ id: string; imageDataUrl: string }> = [];

  if (Array.isArray(payload.evidencePhotos)) {
    for (let i = 0; i < payload.evidencePhotos.length; i++) {
      const p = payload.evidencePhotos[i];
      if (p && typeof p === 'object') {
        const pObj = p as Record<string, unknown>;
        const dataUrl =
          typeof pObj.imageDataUrl === 'string' ? pObj.imageDataUrl.trim() : '';
        if (dataUrl) {
          photos.push({
            id:
              typeof pObj.id === 'string' && pObj.id.trim()
                ? pObj.id.trim()
                : `photo-${i + 1}`,
            imageDataUrl: dataUrl,
          });
        }
      }
    }
  }

  for (const [idx, key] of (
    ['evidenceImage1', 'evidenceImage2'] as const
  ).entries()) {
    const val = payload[key];
    if (
      typeof val === 'string' &&
      val.trim() &&
      !photos.some((p) => p.imageDataUrl === val.trim())
    ) {
      photos.push({
        id: `photo-${idx + 1}`,
        imageDataUrl: val.trim(),
      });
    }
  }

  return photos;
}

export function extractSourceRecordSummaryFields(
  record: TeacherArchiveRecord<Record<string, unknown>>
): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  const p = record.payload || {};

  const pushIf = (label: string, val: unknown) => {
    if (typeof val === 'string' && val.trim()) {
      fields.push({ label, value: val.trim() });
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      fields.push({ label, value: String(val) });
    }
  };

  pushIf('النموذج المصدري', resolveSourceFormTitle(record.groupId, record.formId, p));
  pushIf('العام الدراسي', record.academicYear || p.academicYear);
  pushIf('الفصل الدراسي', record.semester || p.semester);
  pushIf('تاريخ التنفيذ / الإصدار', record.eventDate || p.executionDate || p.eventDate || p.meetingDate || p.visitDate || p.issueDate);
  pushIf('المادة / المقرر', p.subject);
  pushIf('الصف / الفئة المستهدفة', p.grade || p.targetAudience || p.beneficiaries || p.studentName);
  pushIf('الأهداف / المحاور', p.objectives || p.goal || p.strategySteps || p.agendaText);
  pushIf('النتائج / الأثر المتحقق', p.results || p.impactOnLearning || p.outcomesSummary || p.decisionsText || p.keyTakeawaysText);
  pushIf('التوصيات / الإجراءات', p.recommendations || p.followUpActions || p.practiceToApplyText);

  if (record.groupId === 'certificates') {
    const certPayload = p as Partial<CertificateFormState>;
    pushIf('عنوان الشهادة', certPayload.certificateTitle);
    pushIf(
      'المستفيدون',
      certPayload.beneficiariesInput
        ?.split('\n')
        .filter(Boolean)
        .join('، ')
    );
    pushIf('نص الشهادة', certPayload.mainText);
  }

  if (record.summary && record.summary.trim()) {
    const exists = fields.some((f) => f.value === record.summary?.trim());
    if (!exists) {
      fields.push({ label: 'ملخص السجل', value: record.summary.trim() });
    }
  }

  return fields.slice(0, 8);
}

/**
 * Loads a single group's archive store in read-only mode.
 */
export function loadSourceGroupArchiveStoreReadOnly(
  groupId: TeacherArchiveGroupId,
  storage?: StorageLike
): TeacherGroupArchiveStore<Record<string, unknown>> {
  const meta = getSourceGroupMeta(groupId);
  return loadGroupArchiveStore<Record<string, unknown>>(
    meta.storageKey,
    groupId,
    storage
  );
}

/**
 * Lists ONLY saved and portfolio-eligible records (`recordState === 'archived_saved' && isPortfolioEligible === true`)
 * across all 7 approved groups. Never returns drafts (`activeDraftByFormId` or `recordState === 'draft'`).
 */
export function listEligibleSourceRecords(opts?: {
  groupId?: TeacherArchiveGroupId | 'all';
  searchQuery?: string;
  storage?: StorageLike;
}): EligiblePortfolioSourceRecordItem[] {
  const targetGroups =
    opts?.groupId && opts.groupId !== 'all'
      ? TEACHER_PORTFOLIO_SOURCE_GROUPS.filter((g) => g.groupId === opts.groupId)
      : TEACHER_PORTFOLIO_SOURCE_GROUPS;

  const query = opts?.searchQuery?.trim().toLowerCase() || '';
  const items: EligiblePortfolioSourceRecordItem[] = [];

  for (const groupMeta of targetGroups) {
    const archiveStore = loadGroupArchiveStore<Record<string, unknown>>(
      groupMeta.storageKey,
      groupMeta.groupId,
      opts?.storage
    );

    const recordsList = Object.values(archiveStore.records || {});
    for (const rec of recordsList) {
      if (!rec || typeof rec !== 'object') continue;
      // Strict eligibility enforcement: never allow drafts or non-eligible records
      if (rec.recordState !== 'archived_saved') continue;
      if (rec.isPortfolioEligible !== true) continue;
      if (rec.groupId !== groupMeta.groupId) continue;

      const formTitle = resolveSourceFormTitle(
        groupMeta.groupId,
        rec.formId,
        rec.payload
      );

      if (query) {
        const haystack = [
          rec.title || '',
          rec.summary || '',
          formTitle,
          groupMeta.title,
          rec.eventDate || '',
          rec.academicYear || '',
          rec.semester || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      const fallbackPhotos = extractFallbackPhotosFromPayload(rec.payload);
      const attachmentsCount = Math.max(
        Array.isArray(rec.mediaRefs) ? rec.mediaRefs.length : 0,
        fallbackPhotos.length
      );
      const electronicLinksCount = extractElectronicLinksFromPayload(
        rec.payload
      ).length;

      items.push({
        record: rec,
        groupId: groupMeta.groupId,
        groupTitle: groupMeta.title,
        groupShortTitle: groupMeta.shortTitle,
        formTitle,
        attachmentsCount,
        electronicLinksCount,
      });
    }
  }

  return items.sort((a, b) =>
    (b.record.updatedAt || b.record.createdAt || '').localeCompare(
      a.record.updatedAt || a.record.createdAt || ''
    )
  );
}

// ============================================================================
// Reference Linking, Note Management, Unlinking & Missing Reference Cleanup
// ============================================================================
export type LinkRecordFailureReason =
  | 'invalid-element'
  | 'invalid-group'
  | 'record-not-found'
  | 'record-is-draft'
  | 'record-not-eligible'
  | 'already-linked'
  | 'storage-write-failed';

export interface LinkRecordToElementResult {
  ok: boolean;
  reason?: LinkRecordFailureReason;
  errorMessage?: string;
  rolledBack?: boolean;
  store: TeacherPortfolioStore;
  addedRef?: TeacherPortfolioLinkedRecordRef;
}

/**
 * Links an eligible archived record from Groups 1–7 to a portfolio element by reference ONLY
 * (`{ sourceGroupId, sourceRecordId, linkedAt, note? }`).
 * Never copies payload, photos, or PDF binaries into the portfolio store.
 */
export function linkRecordToPortfolioElement(input: {
  elementId: TeacherPortfolioElementId | string;
  sourceGroupId: TeacherArchiveGroupId;
  sourceRecordId: string;
  note?: string;
  storage?: StorageLike;
}): LinkRecordToElementResult {
  const currentStore = loadPortfolioStore(input.storage);
  const targetElement = currentStore.elements[input.elementId];

  if (!targetElement) {
    return {
      ok: false,
      reason: 'invalid-element',
      errorMessage: 'عنصر الأداء الوظيفي المحدد غير موجود في ملف الشواهد.',
      store: currentStore,
    };
  }

  if (!isValidSourceGroupId(input.sourceGroupId)) {
    return {
      ok: false,
      reason: 'invalid-group',
      errorMessage: 'المجموعة المصدرية المحددة غير معتمدة ضمن المجموعات السبع.',
      store: currentStore,
    };
  }

  const recordId = input.sourceRecordId?.trim();
  if (!recordId) {
    return {
      ok: false,
      reason: 'record-not-found',
      errorMessage: 'معرّف السجل المصدري غير صالح.',
      store: currentStore,
    };
  }

  // Inspect source archive store to enforce draft & eligibility guards
  const sourceArchive = loadSourceGroupArchiveStoreReadOnly(
    input.sourceGroupId,
    input.storage
  );

  // Check if it is an active draft
  const matchingDraft = Object.values(
    sourceArchive.activeDraftByFormId || {}
  ).find((d) => d && d.id === recordId);

  const savedRecord = sourceArchive.records?.[recordId];

  if (!savedRecord) {
    if (matchingDraft) {
      return {
        ok: false,
        reason: 'record-is-draft',
        errorMessage:
          'لا يمكن ربط مسودة غير محفوظة بملف شواهد الأداء. يرجى حفظ السجل في الأرشيف أولًا.',
        store: currentStore,
      };
    }
    return {
      ok: false,
      reason: 'record-not-found',
      errorMessage: 'السجل المحدد غير موجود في أرشيف المجموعة المصدرية.',
      store: currentStore,
    };
  }

  if (savedRecord.recordState === 'draft') {
    return {
      ok: false,
      reason: 'record-is-draft',
      errorMessage:
        'لا يُسمح بربط سجل حالته مسودة (draft) بملف شواهد الأداء.',
      store: currentStore,
    };
  }

  if (
    savedRecord.recordState !== 'archived_saved' ||
    savedRecord.isPortfolioEligible !== true
  ) {
    return {
      ok: false,
      reason: 'record-not-eligible',
      errorMessage:
        'هذا السجل غير مؤهل للربط بملف شواهد الأداء (isPortfolioEligible === false).',
      store: currentStore,
    };
  }

  // Prevent duplicate link inside the SAME element
  const alreadyInElement = targetElement.linkedRecords.some(
    (ref) =>
      ref.sourceGroupId === input.sourceGroupId &&
      ref.sourceRecordId === recordId
  );

  if (alreadyInElement) {
    return {
      ok: false,
      reason: 'already-linked',
      errorMessage: 'هذا السجل مرتبط مسبقًا بهذا العنصر ولا يمكن تكراره داخله.',
      store: currentStore,
    };
  }

  const trimmedNote = input.note?.trim();
  const addedRef: TeacherPortfolioLinkedRecordRef = {
    sourceGroupId: input.sourceGroupId,
    sourceRecordId: recordId,
    linkedAt: new Date().toISOString(),
    ...(trimmedNote ? { note: trimmedNote } : {}),
  };

  const nextStore: TeacherPortfolioStore = {
    ...currentStore,
    elements: {
      ...currentStore.elements,
      [input.elementId]: {
        ...targetElement,
        linkedRecords: [...targetElement.linkedRecords, addedRef],
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const saveRes = savePortfolioStoreSafely(nextStore, input.storage);
  if (!saveRes.ok) {
    return {
      ok: false,
      reason: 'storage-write-failed',
      errorMessage: saveRes.error,
      rolledBack: saveRes.rolledBack,
      store: saveRes.store,
    };
  }

  return {
    ok: true,
    store: saveRes.store,
    addedRef,
  };
}

/**
 * Updates or clears the optional documentation note for an existing reference link.
 */
export function updatePortfolioLinkNote(input: {
  elementId: TeacherPortfolioElementId | string;
  sourceGroupId: TeacherArchiveGroupId;
  sourceRecordId: string;
  note: string;
  storage?: StorageLike;
}): {
  ok: boolean;
  errorMessage?: string;
  rolledBack?: boolean;
  store: TeacherPortfolioStore;
} {
  const currentStore = loadPortfolioStore(input.storage);
  const targetElement = currentStore.elements[input.elementId];

  if (!targetElement) {
    return {
      ok: false,
      errorMessage: 'عنصر الأداء المحدد غير موجود.',
      store: currentStore,
    };
  }

  let found = false;
  const trimmedNote = input.note.trim();

  const nextLinkedRecords = targetElement.linkedRecords.map((ref) => {
    if (
      ref.sourceGroupId === input.sourceGroupId &&
      ref.sourceRecordId === input.sourceRecordId
    ) {
      found = true;
      const updated: TeacherPortfolioLinkedRecordRef = {
        sourceGroupId: ref.sourceGroupId,
        sourceRecordId: ref.sourceRecordId,
        linkedAt: ref.linkedAt,
      };
      if (trimmedNote) {
        updated.note = trimmedNote;
      }
      return updated;
    }
    return ref;
  });

  if (!found) {
    return {
      ok: false,
      errorMessage: 'الرابط المرجعي المحدد غير موجود في هذا العنصر.',
      store: currentStore,
    };
  }

  const nextStore: TeacherPortfolioStore = {
    ...currentStore,
    elements: {
      ...currentStore.elements,
      [input.elementId]: {
        ...targetElement,
        linkedRecords: nextLinkedRecords,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const saveRes = savePortfolioStoreSafely(nextStore, input.storage);
  if (!saveRes.ok) {
    return {
      ok: false,
      errorMessage: saveRes.error,
      rolledBack: saveRes.rolledBack,
      store: saveRes.store,
    };
  }

  return {
    ok: true,
    store: saveRes.store,
  };
}

/**
 * Unlinks a record from a specific performance element without deleting or modifying
 * the original record in its source group archive store.
 */
export function unlinkRecordFromPortfolioElement(input: {
  elementId: TeacherPortfolioElementId | string;
  sourceGroupId: TeacherArchiveGroupId;
  sourceRecordId: string;
  storage?: StorageLike;
}): {
  ok: boolean;
  unlinked: boolean;
  errorMessage?: string;
  rolledBack?: boolean;
  store: TeacherPortfolioStore;
} {
  const currentStore = loadPortfolioStore(input.storage);
  const targetElement = currentStore.elements[input.elementId];

  if (!targetElement) {
    return {
      ok: false,
      unlinked: false,
      errorMessage: 'عنصر الأداء المحدد غير موجود.',
      store: currentStore,
    };
  }

  const beforeLen = targetElement.linkedRecords.length;
  const nextLinkedRecords = targetElement.linkedRecords.filter(
    (ref) =>
      !(
        ref.sourceGroupId === input.sourceGroupId &&
        ref.sourceRecordId === input.sourceRecordId
      )
  );

  if (nextLinkedRecords.length === beforeLen) {
    return {
      ok: true,
      unlinked: false,
      store: currentStore,
    };
  }

  const nextStore: TeacherPortfolioStore = {
    ...currentStore,
    elements: {
      ...currentStore.elements,
      [input.elementId]: {
        ...targetElement,
        linkedRecords: nextLinkedRecords,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const saveRes = savePortfolioStoreSafely(nextStore, input.storage);
  if (!saveRes.ok) {
    return {
      ok: false,
      unlinked: false,
      errorMessage: saveRes.error,
      rolledBack: saveRes.rolledBack,
      store: saveRes.store,
    };
  }

  return {
    ok: true,
    unlinked: true,
    store: saveRes.store,
  };
}

/**
 * Removes all missing/orphaned references across all elements whose source records
 * no longer exist in their respective group archive stores.
 */
export function cleanupAllMissingPortfolioReferences(opts?: {
  storage?: StorageLike;
}): {
  ok: boolean;
  removedCount: number;
  store: TeacherPortfolioStore;
  errorMessage?: string;
} {
  const currentStore = loadPortfolioStore(opts?.storage);
  const groupStores = new Map<
    TeacherArchiveGroupId,
    TeacherGroupArchiveStore<Record<string, unknown>>
  >();

  for (const g of TEACHER_PORTFOLIO_SOURCE_GROUPS) {
    groupStores.set(
      g.groupId,
      loadSourceGroupArchiveStoreReadOnly(g.groupId, opts?.storage)
    );
  }

  let removedCount = 0;
  const nextElements: Record<string, TeacherPortfolioElementRecord> = {};

  for (const [elId, el] of Object.entries(currentStore.elements)) {
    const kept = el.linkedRecords.filter((ref) => {
      const grpStore = groupStores.get(ref.sourceGroupId);
      const rec = grpStore?.records?.[ref.sourceRecordId];
      const isPresentAndEligible =
        Boolean(rec) &&
        rec?.recordState === 'archived_saved' &&
        rec?.isPortfolioEligible === true;
      if (!isPresentAndEligible) {
        removedCount += 1;
        return false;
      }
      return true;
    });
    nextElements[elId] = {
      ...el,
      linkedRecords: kept,
    };
  }

  if (removedCount === 0) {
    return {
      ok: true,
      removedCount: 0,
      store: currentStore,
    };
  }

  const nextStore: TeacherPortfolioStore = {
    ...currentStore,
    elements: nextElements,
    updatedAt: new Date().toISOString(),
  };

  const saveRes = savePortfolioStoreSafely(nextStore, opts?.storage);
  if (!saveRes.ok) {
    return {
      ok: false,
      removedCount: 0,
      store: saveRes.store,
      errorMessage: saveRes.error,
    };
  }

  return {
    ok: true,
    removedCount,
    store: saveRes.store,
  };
}

// ============================================================================
// Group 9: Standalone Evidence Creation, In-Place Edit & Safe Delete (No Drafts)
// ============================================================================
export interface StandaloneEvidenceValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function createEmptyStandaloneEvidenceInput(
  settings?: Partial<SchoolSettings>
): TeacherPortfolioStandaloneFormInput {
  return {
    evidenceType: 'practice',
    title: '',
    executionDate: '',
    targetAudience: '',
    description: '',
    impact: '',
    academicYear: settings?.academicYear || '',
    semester: settings?.semester || '',
    evidencePhotos: [],
    evidenceLinks: [],
  };
}

/**
 * Validates standalone evidence before saving inside an element.
 * Optional fields (targetAudience, executionDate, impact, attachments)
 * are never forced if not applicable to the performance element.
 */
export function validateStandalonePortfolioEvidence(
  input: TeacherPortfolioStandaloneFormInput
): StandaloneEvidenceValidationResult {
  const errors: Record<string, string> = {};

  if (!input.title || !input.title.trim()) {
    errors.title = 'يرجى إدخال عنوان الشاهد.';
  }

  if (!input.description || !input.description.trim()) {
    errors.description = 'يرجى إدخال وصف الممارسة أو العمل المنفذ.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Safely deletes staged photo blobs from IndexedDB ONLY if zero references exist
 * anywhere across Groups 1-7 archives and Group 9 standalone evidences.
 */
export async function cleanupUnreferencedStagedPhotoDataUrls(
  dataUrls: string[],
  opts?: {
    storage?: StorageLike;
    mediaRepo?: TeacherMediaRepository;
  }
): Promise<string[]> {
  const removedKeys: string[] = [];
  const uniqueUrls = Array.from(new Set(dataUrls.filter(Boolean)));
  if (uniqueUrls.length === 0) return removedKeys;

  const mediaRepo = opts?.mediaRepo ?? getDefaultTeacherMediaRepository();
  for (const dataUrl of uniqueUrls) {
    try {
      const { bytes } = dataUrlToBytes(dataUrl);
      const shaHex = await computeSha256Hex(bytes);
      const blobKey = `sha256:${shaHex}`;
      const res = await deleteBlobIfUnreferenced(blobKey, {
        storage: opts?.storage,
        repo: mediaRepo,
      });
      if (res.deleted) {
        removedKeys.push(blobKey);
      }
    } catch {
      // Ignore non-DataURL or invalid image strings safely
    }
  }
  return removedKeys;
}

export async function loadStandaloneEvidenceWithMedia(input: {
  elementId: TeacherPortfolioElementId | string;
  evidenceId: string;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  evidence: TeacherPortfolioStandaloneEvidence;
  formData: TeacherPortfolioStandaloneFormInput;
  photos: Array<{ id: string; imageDataUrl: string; blobKey?: string }>;
  integrityWarnings: string[];
} | null> {
  const store = loadPortfolioStore(input.storage);
  const element = store.elements[input.elementId];
  if (!element) return null;
  const evidence = (element.standaloneEvidences || []).find(
    (s) => s.id === input.evidenceId
  );
  if (!evidence) return null;

  const mediaRepo = input.mediaRepo ?? getDefaultTeacherMediaRepository();
  const hydrated = await hydrateEvidencePhotosFromMediaRepo(
    evidence.mediaRefs,
    [],
    mediaRepo
  );

  const blobKeyByPhotoId = new Map<string, string>();
  for (const ref of evidence.mediaRefs || []) {
    blobKeyByPhotoId.set(ref.id, ref.blobKey);
  }

  return {
    evidence,
    formData: {
      id: evidence.id,
      evidenceType: evidence.evidenceType,
      title: evidence.title,
      executionDate: evidence.executionDate,
      targetAudience: evidence.targetAudience,
      description: evidence.description,
      impact: evidence.impact,
      academicYear: evidence.academicYear,
      semester: evidence.semester,
      evidencePhotos: hydrated.photos,
      evidenceLinks: evidence.evidenceLinks || [],
    },
    photos: hydrated.photos.map((p) => ({
      id: p.id,
      imageDataUrl: p.imageDataUrl,
      blobKey: blobKeyByPhotoId.get(p.id),
    })),
    integrityWarnings: hydrated.integrityWarnings,
  };
}

export async function saveStandaloneEvidenceToElement(input: {
  elementId: TeacherPortfolioElementId | string;
  formData: TeacherPortfolioStandaloneFormInput;
  editingEvidenceId?: string;
  settings?: Partial<SchoolSettings>;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  ok: boolean;
  isNew: boolean;
  validationErrors?: Record<string, string>;
  errorMessage?: string;
  rolledBack?: boolean;
  evidence?: TeacherPortfolioStandaloneEvidence;
  store: TeacherPortfolioStore;
}> {
  const currentStore = loadPortfolioStore(input.storage);
  const targetElement = currentStore.elements[input.elementId];

  if (!targetElement) {
    return {
      ok: false,
      isNew: false,
      errorMessage: 'عنصر الأداء الوظيفي المحدد غير موجود في ملف الشواهد.',
      store: currentStore,
    };
  }

  const targetEditId = input.editingEvidenceId || input.formData.id;
  const existingList = targetElement.standaloneEvidences || [];
  const existingItem = targetEditId
    ? existingList.find((s) => s.id === targetEditId)
    : undefined;

  if (targetEditId && !existingItem) {
    return {
      ok: false,
      isNew: false,
      errorMessage: 'تعذر العثور على الشاهد المستقل المطلوب تحديثه.',
      store: currentStore,
    };
  }

  const check = validateStandalonePortfolioEvidence(input.formData);
  if (!check.valid) {
    return {
      ok: false,
      isNew: !existingItem,
      validationErrors: check.errors,
      errorMessage: 'يرجى استكمال الحقول المطلوبة قبل حفظ الشاهد المستقل.',
      store: currentStore,
    };
  }

  const mediaRepo = input.mediaRepo ?? getDefaultTeacherMediaRepository();

  const { mediaRefs } = await extractEvidencePhotosToMediaRepo(
    (input.formData.evidencePhotos || []).slice(0, 2),
    existingItem?.mediaRefs,
    mediaRepo,
    'upload'
  );

  const nowIso = new Date().toISOString();
  const savedItem: TeacherPortfolioStandaloneEvidence = {
    id: existingItem ? existingItem.id : generateImmutableRecordId('tps'),
    elementId: input.elementId,
    evidenceType: isValidStandaloneEvidenceType(input.formData.evidenceType)
      ? input.formData.evidenceType
      : 'practice',
    title: input.formData.title.trim(),
    executionDate: (input.formData.executionDate || '').trim(),
    targetAudience: (input.formData.targetAudience || '').trim(),
    description: input.formData.description.trim(),
    impact: (input.formData.impact || '').trim(),
    academicYear:
      (input.formData.academicYear || '').trim() ||
      existingItem?.academicYear ||
      input.settings?.academicYear ||
      '',
    semester:
      (input.formData.semester || '').trim() ||
      existingItem?.semester ||
      input.settings?.semester ||
      '',
    mediaRefs: mediaRefs.slice(0, 2),
    evidenceLinks: normalizeEvidenceLinksArray(input.formData.evidenceLinks),
    recordState: 'archived_saved',
    createdAt: existingItem?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  // Strict in-place replacement when editing; never creates duplicate copies
  const nextStandaloneList = existingItem
    ? existingList.map((s) => (s.id === existingItem.id ? savedItem : s))
    : [savedItem, ...existingList];

  const nextStore: TeacherPortfolioStore = {
    ...currentStore,
    elements: {
      ...currentStore.elements,
      [input.elementId]: {
        ...targetElement,
        standaloneEvidences: nextStandaloneList,
      },
    },
    updatedAt: nowIso,
  };

  const saveRes = savePortfolioStoreSafely(nextStore, input.storage);
  if (!saveRes.ok) {
    return {
      ok: false,
      isNew: !existingItem,
      errorMessage: saveRes.error,
      rolledBack: saveRes.rolledBack,
      store: saveRes.store,
    };
  }

  // Clean up any replaced photos from previous edit state if unreferenced anywhere globally
  const retainedKeys = new Set(savedItem.mediaRefs.map((r) => r.blobKey));
  for (const oldRef of existingItem?.mediaRefs || []) {
    if (!retainedKeys.has(oldRef.blobKey)) {
      await deleteBlobIfUnreferenced(oldRef.blobKey, {
        storage: input.storage,
        repo: mediaRepo,
      });
    }
  }

  return {
    ok: true,
    isNew: !existingItem,
    evidence: savedItem,
    store: saveRes.store,
  };
}

export async function deleteStandaloneEvidenceFromElement(input: {
  elementId: TeacherPortfolioElementId | string;
  evidenceId: string;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
}): Promise<{
  ok: boolean;
  deleted: boolean;
  errorMessage?: string;
  rolledBack?: boolean;
  removedBlobKeys: string[];
  preservedSharedBlobKeys: string[];
  store: TeacherPortfolioStore;
}> {
  const currentStore = loadPortfolioStore(input.storage);
  const targetElement = currentStore.elements[input.elementId];

  if (!targetElement) {
    return {
      ok: false,
      deleted: false,
      errorMessage: 'عنصر الأداء المحدد غير موجود.',
      removedBlobKeys: [],
      preservedSharedBlobKeys: [],
      store: currentStore,
    };
  }

  const existingList = targetElement.standaloneEvidences || [];
  const target = existingList.find((s) => s.id === input.evidenceId);
  if (!target) {
    return {
      ok: true,
      deleted: false,
      removedBlobKeys: [],
      preservedSharedBlobKeys: [],
      store: currentStore,
    };
  }

  const nextStandaloneList = existingList.filter(
    (s) => s.id !== input.evidenceId
  );

  const nextStore: TeacherPortfolioStore = {
    ...currentStore,
    elements: {
      ...currentStore.elements,
      [input.elementId]: {
        ...targetElement,
        standaloneEvidences: nextStandaloneList,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  const saveRes = savePortfolioStoreSafely(nextStore, input.storage);
  if (!saveRes.ok) {
    return {
      ok: false,
      deleted: false,
      errorMessage: saveRes.error,
      rolledBack: saveRes.rolledBack,
      removedBlobKeys: [],
      preservedSharedBlobKeys: [],
      store: saveRes.store,
    };
  }

  const mediaRepo = input.mediaRepo ?? getDefaultTeacherMediaRepository();
  const removedBlobKeys: string[] = [];
  const preservedSharedBlobKeys: string[] = [];
  const uniqueBlobKeys = Array.from(
    new Set((target.mediaRefs || []).map((r) => r.blobKey))
  );

  for (const blobKey of uniqueBlobKeys) {
    const delRes = await deleteBlobIfUnreferenced(blobKey, {
      storage: input.storage,
      repo: mediaRepo,
    });
    if (delRes.deleted) {
      removedBlobKeys.push(blobKey);
    } else if (delRes.remainingRefs > 0) {
      preservedSharedBlobKeys.push(blobKey);
    }
  }

  return {
    ok: true,
    deleted: true,
    removedBlobKeys,
    preservedSharedBlobKeys,
    store: saveRes.store,
  };
}

// ============================================================================
// Live Resolution of Portfolio Elements (Linked Records + Standalone Evidences)
// ============================================================================
export interface ResolvedPortfolioLinkedItem {
  ref: TeacherPortfolioLinkedRecordRef;
  elementId: string;
  elementTitle: string;
  status: 'resolved' | 'missing';
  groupTitle: string;
  groupShortTitle: string;
  formTitle: string;
  /** Live record from its original group archive when status === 'resolved' */
  sourceRecord: TeacherArchiveRecord<Record<string, unknown>> | null;
  summaryFields: Array<{ label: string; value: string }>;
  attachmentsCount: number;
  electronicLinks: string[];
  matchingDeletionAuditEntry: TeacherPortfolioDeletionAuditEntry | null;
}

export interface ResolvedPortfolioStandaloneItem {
  evidence: TeacherPortfolioStandaloneEvidence;
  elementId: string;
  elementTitle: string;
  typeLabel: string;
  attachmentsCount: number;
  electronicLinks: string[];
}

export interface ResolvedPortfolioElementSummary {
  id: TeacherPortfolioElementId;
  number: number;
  title: string;
  totalLinksCount: number;
  resolvedLinksCount: number;
  missingLinksCount: number;
  standaloneEvidencesCount: number;
  totalEvidencesCount: number;
  /** Organizational indicator only — never a performance evaluation judgment */
  hasLinkedRecords: boolean;
  hasAnyEvidences: boolean;
  organizationalStatusLabel:
    | 'توجد شواهد موثقة'
    | 'لا توجد شواهد موثقة بعد';
  items: ResolvedPortfolioLinkedItem[];
  standaloneEvidences: ResolvedPortfolioStandaloneItem[];
}

export interface ResolvedPortfolioOverview {
  store: TeacherPortfolioStore;
  elements: ResolvedPortfolioElementSummary[];
  totalElementsCount: number;
  elementsWithRecordsCount: number;
  totalLinkedReferencesCount: number;
  totalResolvedReferencesCount: number;
  totalMissingReferencesCount: number;
  totalStandaloneEvidencesCount: number;
  totalCombinedEvidencesCount: number;
  uniqueLinkedSourceRecordsCount: number;
  deletionAuditLog: TeacherPortfolioDeletionAuditEntry[];
}

export function resolveFullPortfolioOverview(opts?: {
  storage?: StorageLike;
}): ResolvedPortfolioOverview {
  const portfolioStore = loadPortfolioStore(opts?.storage);
  const groupStores = new Map<
    TeacherArchiveGroupId,
    TeacherGroupArchiveStore<Record<string, unknown>>
  >();

  for (const g of TEACHER_PORTFOLIO_SOURCE_GROUPS) {
    groupStores.set(
      g.groupId,
      loadSourceGroupArchiveStoreReadOnly(g.groupId, opts?.storage)
    );
  }

  const uniqueSourceRecordKeys = new Set<string>();
  let totalLinkedReferencesCount = 0;
  let totalResolvedReferencesCount = 0;
  let totalMissingReferencesCount = 0;
  let totalStandaloneEvidencesCount = 0;
  let elementsWithRecordsCount = 0;

  const elements: ResolvedPortfolioElementSummary[] =
    TEACHER_PORTFOLIO_ELEMENTS_CATALOG.map((def) => {
      const storedEl = portfolioStore.elements[def.id] || {
        id: def.id,
        number: def.number,
        title: def.title,
        linkedRecords: [],
        standaloneEvidences: [],
      };

      const items: ResolvedPortfolioLinkedItem[] = storedEl.linkedRecords.map(
        (ref) => {
          const groupMeta = getSourceGroupMeta(ref.sourceGroupId);
          const grpStore = groupStores.get(ref.sourceGroupId);
          const liveRec = grpStore?.records?.[ref.sourceRecordId] || null;

          const isValidSavedRecord =
            Boolean(liveRec) &&
            liveRec?.recordState === 'archived_saved' &&
            liveRec?.isPortfolioEligible === true;

          if (isValidSavedRecord && liveRec) {
            uniqueSourceRecordKeys.add(
              `${ref.sourceGroupId}::${ref.sourceRecordId}`
            );
            const fallbackPhotos = extractFallbackPhotosFromPayload(
              liveRec.payload
            );
            const attachmentsCount = Math.max(
              Array.isArray(liveRec.mediaRefs) ? liveRec.mediaRefs.length : 0,
              fallbackPhotos.length
            );
            const electronicLinks = extractElectronicLinksFromPayload(
              liveRec.payload
            );

            return {
              ref,
              elementId: def.id,
              elementTitle: def.title,
              status: 'resolved',
              groupTitle: groupMeta.title,
              groupShortTitle: groupMeta.shortTitle,
              formTitle: resolveSourceFormTitle(
                ref.sourceGroupId,
                liveRec.formId,
                liveRec.payload
              ),
              sourceRecord: liveRec,
              summaryFields: extractSourceRecordSummaryFields(liveRec),
              attachmentsCount,
              electronicLinks,
              matchingDeletionAuditEntry: null,
            };
          }

          const auditMatch =
            portfolioStore.sourceDeletionAuditLog.find(
              (a) =>
                a.deletedGroupId === ref.sourceGroupId &&
                a.deletedRecordId === ref.sourceRecordId
            ) || null;

          return {
            ref,
            elementId: def.id,
            elementTitle: def.title,
            status: 'missing',
            groupTitle: groupMeta.title,
            groupShortTitle: groupMeta.shortTitle,
            formTitle: 'سجل مصدري مفقود أو محذوف',
            sourceRecord: null,
            summaryFields: [],
            attachmentsCount: 0,
            electronicLinks: [],
            matchingDeletionAuditEntry: auditMatch,
          };
        }
      );

      // Strictly include saved standalone evidences (`recordState === 'archived_saved'`); never drafts
      const standaloneEvidences: ResolvedPortfolioStandaloneItem[] = (
        storedEl.standaloneEvidences || []
      )
        .filter((s) => s.recordState === 'archived_saved')
        .map((s) => ({
          evidence: s,
          elementId: def.id,
          elementTitle: def.title,
          typeLabel: getStandaloneEvidenceTypeLabel(s.evidenceType),
          attachmentsCount: Array.isArray(s.mediaRefs) ? s.mediaRefs.length : 0,
          electronicLinks: (s.evidenceLinks || [])
            .map((l) => l.url?.trim() || '')
            .filter(Boolean),
        }));

      const resolvedLinksCount = items.filter(
        (i) => i.status === 'resolved'
      ).length;
      const missingLinksCount = items.filter(
        (i) => i.status === 'missing'
      ).length;
      const totalLinksCount = items.length;
      const standaloneCount = standaloneEvidences.length;
      const totalEvidencesCount = resolvedLinksCount + standaloneCount;
      const hasLinkedRecords = resolvedLinksCount > 0;
      const hasAnyEvidences = totalEvidencesCount > 0;

      totalLinkedReferencesCount += totalLinksCount;
      totalResolvedReferencesCount += resolvedLinksCount;
      totalMissingReferencesCount += missingLinksCount;
      totalStandaloneEvidencesCount += standaloneCount;
      if (hasAnyEvidences) {
        elementsWithRecordsCount += 1;
      }

      return {
        id: def.id,
        number: def.number,
        title: def.title,
        totalLinksCount,
        resolvedLinksCount,
        missingLinksCount,
        standaloneEvidencesCount: standaloneCount,
        totalEvidencesCount,
        hasLinkedRecords,
        hasAnyEvidences,
        organizationalStatusLabel: hasAnyEvidences
          ? 'توجد شواهد موثقة'
          : 'لا توجد شواهد موثقة بعد',
        items,
        standaloneEvidences,
      };
    });

  return {
    store: portfolioStore,
    elements,
    totalElementsCount: TEACHER_PORTFOLIO_ELEMENTS_CATALOG.length,
    elementsWithRecordsCount,
    totalLinkedReferencesCount,
    totalResolvedReferencesCount,
    totalMissingReferencesCount,
    totalStandaloneEvidencesCount,
    totalCombinedEvidencesCount:
      totalResolvedReferencesCount + totalStandaloneEvidencesCount,
    uniqueLinkedSourceRecordsCount: uniqueSourceRecordKeys.size,
    deletionAuditLog: [...portfolioStore.sourceDeletionAuditLog].sort((a, b) =>
      (b.deletedAt || '').localeCompare(a.deletedAt || '')
    ),
  };
}

/**
 * Hydrates photos for a linked source record directly from IndexedDB (`maktabi_teacher_media_db_v1`)
 * via the existing media repository without creating any duplicate blobs.
 */
export async function hydrateLinkedRecordPhotosFromMediaRepo(
  record: TeacherArchiveRecord<Record<string, unknown>>,
  mediaRepo: TeacherMediaRepository = getDefaultTeacherMediaRepository()
): Promise<{
  photos: Array<{ id: string; imageDataUrl: string; blobKey?: string }>;
  integrityWarnings: string[];
}> {
  const fallbackPhotos = extractFallbackPhotosFromPayload(record.payload);
  const hydrated = await hydrateEvidencePhotosFromMediaRepo(
    record.mediaRefs,
    fallbackPhotos,
    mediaRepo
  );

  const blobKeyByPhotoId = new Map<string, string>();
  for (const ref of record.mediaRefs || []) {
    blobKeyByPhotoId.set(ref.id, ref.blobKey);
  }

  return {
    photos: hydrated.photos.map((p) => ({
      id: p.id,
      imageDataUrl: p.imageDataUrl,
      blobKey: blobKeyByPhotoId.get(p.id),
    })),
    integrityWarnings: hydrated.integrityWarnings,
  };
}

// ============================================================================
// Unified Portfolio PDF Appendix Deduplication & Multi-Page PDF Engine
// ============================================================================
export interface DeduplicatedPortfolioAppendixAttachment {
  dedupeKey: string;
  blobKey?: string;
  photoId: string;
  imageDataUrl: string;
  sourceRecordIds: string[];
  sourceRecordTitles: string[];
  sourceGroupTitles: string[];
  referencedByElements: Array<{ number: number; title: string }>;
}

export interface DeduplicatedPortfolioElectronicLink {
  url: string;
  sourceRecordTitles: string[];
  referencedByElements: Array<{ number: number; title: string }>;
}

/**
 * Collects and deduplicates all media attachments and electronic links across all 11 elements
 * (covering BOTH resolved linked records AND saved standalone evidences) so binary photos
 * are NEVER duplicated in the Unified Portfolio PDF. Drafts are strictly excluded.
 */
export async function collectDeduplicatedPortfolioAttachments(
  overview: ResolvedPortfolioOverview,
  mediaRepo: TeacherMediaRepository = getDefaultTeacherMediaRepository()
): Promise<{
  attachments: DeduplicatedPortfolioAppendixAttachment[];
  electronicLinks: DeduplicatedPortfolioElectronicLink[];
}> {
  const hydratedByRecordKey = new Map<
    string,
    Array<{ id: string; imageDataUrl: string; blobKey?: string }>
  >();

  const attachmentMap = new Map<
    string,
    DeduplicatedPortfolioAppendixAttachment
  >();
  const linkMap = new Map<string, DeduplicatedPortfolioElectronicLink>();

  const registerAttachment = (
    photo: { id: string; imageDataUrl: string; blobKey?: string },
    sourceId: string,
    sourceTitle: string,
    sourceCategoryLabel: string,
    elementNumber: number,
    elementTitle: string
  ) => {
    if (!photo.imageDataUrl) return;
    const dedupeKey = photo.blobKey
      ? `blob::${photo.blobKey}`
      : `data::${photo.imageDataUrl}`;

    const existing = attachmentMap.get(dedupeKey);
    if (!existing) {
      attachmentMap.set(dedupeKey, {
        dedupeKey,
        blobKey: photo.blobKey,
        photoId: photo.id,
        imageDataUrl: photo.imageDataUrl,
        sourceRecordIds: [sourceId],
        sourceRecordTitles: [sourceTitle],
        sourceGroupTitles: [sourceCategoryLabel],
        referencedByElements: [{ number: elementNumber, title: elementTitle }],
      });
    } else {
      if (!existing.sourceRecordIds.includes(sourceId)) {
        existing.sourceRecordIds.push(sourceId);
      }
      if (!existing.sourceRecordTitles.includes(sourceTitle)) {
        existing.sourceRecordTitles.push(sourceTitle);
      }
      if (!existing.sourceGroupTitles.includes(sourceCategoryLabel)) {
        existing.sourceGroupTitles.push(sourceCategoryLabel);
      }
      if (
        !existing.referencedByElements.some((e) => e.number === elementNumber)
      ) {
        existing.referencedByElements.push({
          number: elementNumber,
          title: elementTitle,
        });
      }
    }
  };

  const registerLink = (
    rawUrl: string,
    sourceTitle: string,
    elementNumber: number,
    elementTitle: string
  ) => {
    const cleanUrl = rawUrl.trim();
    if (!cleanUrl) return;
    const existingLink = linkMap.get(cleanUrl);
    if (!existingLink) {
      linkMap.set(cleanUrl, {
        url: cleanUrl,
        sourceRecordTitles: [sourceTitle],
        referencedByElements: [{ number: elementNumber, title: elementTitle }],
      });
    } else {
      if (!existingLink.sourceRecordTitles.includes(sourceTitle)) {
        existingLink.sourceRecordTitles.push(sourceTitle);
      }
      if (
        !existingLink.referencedByElements.some(
          (e) => e.number === elementNumber
        )
      ) {
        existingLink.referencedByElements.push({
          number: elementNumber,
          title: elementTitle,
        });
      }
    }
  };

  for (const element of overview.elements) {
    // 1. Linked source records
    for (const item of element.items) {
      if (item.status !== 'resolved' || !item.sourceRecord) continue;
      const rec = item.sourceRecord;
      const recKey = `${item.ref.sourceGroupId}::${rec.id}`;

      let photos = hydratedByRecordKey.get(recKey);
      if (!photos) {
        const res = await hydrateLinkedRecordPhotosFromMediaRepo(
          rec,
          mediaRepo
        );
        photos = res.photos;
        hydratedByRecordKey.set(recKey, photos);
      }

      for (const photo of photos) {
        registerAttachment(
          photo,
          rec.id,
          rec.title,
          item.groupTitle,
          element.number,
          element.title
        );
      }

      for (const url of item.electronicLinks) {
        registerLink(url, rec.title, element.number, element.title);
      }
    }

    // 2. Standalone evidences (strictly archived_saved; never drafts)
    for (const stItem of element.standaloneEvidences) {
      const ev = stItem.evidence;
      if (ev.recordState !== 'archived_saved') continue;

      if (ev.mediaRefs.length > 0) {
        const hydrated = await hydrateEvidencePhotosFromMediaRepo(
          ev.mediaRefs,
          [],
          mediaRepo
        );
        const blobKeyByPhotoId = new Map<string, string>();
        for (const ref of ev.mediaRefs) {
          blobKeyByPhotoId.set(ref.id, ref.blobKey);
        }
        for (const p of hydrated.photos) {
          registerAttachment(
            {
              id: p.id,
              imageDataUrl: p.imageDataUrl,
              blobKey: blobKeyByPhotoId.get(p.id),
            },
            ev.id,
            ev.title,
            stItem.typeLabel,
            element.number,
            element.title
          );
        }
      }

      for (const url of stItem.electronicLinks) {
        registerLink(url, ev.title, element.number, element.title);
      }
    }
  }

  return {
    attachments: Array.from(attachmentMap.values()),
    electronicLinks: Array.from(linkMap.values()),
  };
}

export type PortfolioPdfPageKind =
  | 'cover'
  | 'index'
  | 'elements'
  | 'appendix';

export interface PortfolioPdfPageDescriptor {
  pageNumber: number;
  totalPages: number;
  kind: PortfolioPdfPageKind;
  title: string;
  elementNumbersOnPage: number[];
  attachmentCountOnPage: number;
  electronicLinkCountOnPage: number;
}

export interface GeneratedTeacherPortfolioPdfResult {
  pdfBytes: Uint8Array;
  filename: string;
  pageCount: number;
  pages: TeacherPageJpegWithLinks[];
  pageDescriptors: PortfolioPdfPageDescriptor[];
  deduplicatedAttachmentsCount: number;
  deduplicatedLinksCount: number;
  linkAnnotationsCount: number;
  /** Exact textual content rendered onto each page (Cover, Evaluation Card, Evidences, Appendix) */
  renderedTextsByPage: string[];
}

// Minimal 1x1 white JPEG for Node.js unit-test environment when HTMLCanvasElement is unavailable
const MINIMAL_WHITE_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03,
  0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03,
  0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06, 0x06, 0x05, 0x06, 0x09,
  0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a, 0x0b,
  0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10,
  0x0a, 0x0c, 0x12, 0x13, 0x12, 0x10, 0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0,
  0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
  0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x9f,
  0xff, 0xd9,
]);

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasToJpegAndDataUrl(
  canvas: HTMLCanvasElement,
  quality = 0.94
): { jpegBytes: Uint8Array; dataUrl: string } {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index === -1) {
    return { jpegBytes: MINIMAL_WHITE_JPEG, dataUrl: '' };
  }
  const base64 = dataUrl.slice(base64Index + 8);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { jpegBytes: bytes, dataUrl };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const PORTFOLIO_MODEL_TITLE = 'ملف شواهد أداء المعلم الموحد';

const PORTFOLIO_PDF_PALETTE = {
  headerBg: '#16445B',
  headerTopStrip: '#359AA1',
  accentTurquoise: '#38A098',
  sectionTurquoise: '#2E9398',
  cardBorder: '#7BC0BC',
  subtleBorder: '#CBE6E4',
  softSurface: '#EDF7F6',
  softSurfaceAlt: '#F7FCFB',
  textPrimary: '#163240',
  textSecondary: '#334E5C',
  textMuted: '#57707D',
  white: '#FFFFFF',
} as const;

function stripTrailingPeriod(text: string): string {
  return (text || '').trim().replace(/\.$/, '');
}

/**
 * Crops the official MOE transparent PNG tightly to its visible pixels and tints
 * it pure white (#FFFFFF) for crisp high-contrast presentation on the #16445B header.
 */
function prepareWhiteCroppedLogoCanvas(
  logoImg: HTMLImageElement | null
): HTMLCanvasElement | null {
  if (!logoImg || typeof document === 'undefined') return null;
  const natW = logoImg.naturalWidth || logoImg.width;
  const natH = logoImg.naturalHeight || logoImg.height;
  if (!natW || !natH) return null;

  const sampleSize = 640;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sCtx = sampleCanvas.getContext('2d');
  if (!sCtx) return null;

  const scale = Math.min(sampleSize / natW, sampleSize / natH);
  const drawW = Math.round(natW * scale);
  const drawH = Math.round(natH * scale);
  const offsetX = Math.floor((sampleSize - drawW) / 2);
  const offsetY = Math.floor((sampleSize - drawH) / 2);
  sCtx.drawImage(logoImg, offsetX, offsetY, drawW, drawH);

  let minX = sampleSize;
  let minY = sampleSize;
  let maxX = 0;
  let maxY = 0;

  try {
    const imgData = sCtx.getImageData(0, 0, sampleSize, sampleSize).data;
    for (let y = 0; y < sampleSize; y++) {
      for (let x = 0; x < sampleSize; x++) {
        const alpha = imgData[(y * sampleSize + x) * 4 + 3];
        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } catch {
    minX = offsetX;
    minY = offsetY;
    maxX = offsetX + drawW - 1;
    maxY = offsetY + drawH - 1;
  }

  if (maxX <= minX || maxY <= minY) {
    minX = offsetX;
    minY = offsetY;
    maxX = offsetX + drawW - 1;
    maxY = offsetY + drawH - 1;
  }

  const pad = 4;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(sampleSize - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(sampleSize - cropY, maxY - minY + 1 + pad * 2);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const oCtx = outCanvas.getContext('2d');
  if (!oCtx) return null;

  oCtx.drawImage(
    sampleCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );
  oCtx.globalCompositeOperation = 'source-in';
  oCtx.fillStyle = '#FFFFFF';
  oCtx.fillRect(0, 0, cropW, cropH);
  oCtx.globalCompositeOperation = 'source-over';

  return outCanvas;
}

/**
 * Draws an image or canvas inside (boxX, boxY, boxW, boxH) preserving its exact
 * aspect ratio without any stretching or cropping.
 */
function drawImageContain(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  const srcW =
    source instanceof HTMLCanvasElement
      ? source.width
      : source.naturalWidth || source.width;
  const srcH =
    source instanceof HTMLCanvasElement
      ? source.height
      : source.naturalHeight || source.height;
  if (!srcW || !srcH) return;

  const ratio = Math.min(boxW / srcW, boxH / srcH);
  const drawW = srcW * ratio;
  const drawH = srcH * ratio;
  const drawX = boxX + (boxW - drawW) / 2;
  const drawY = boxY + (boxH - drawH) / 2;
  ctx.drawImage(source, drawX, drawY, drawW, drawH);
}

function getHeaderInfoLines(settings: SchoolSettings): string[] {
  const lines: string[] = ['المملكة العربية السعودية', 'وزارة التعليم'];
  const dept = settings.educationDepartment?.trim();
  const school = settings.schoolName?.trim();
  if (dept) lines.push(dept);
  if (school) lines.push(school);
  return lines;
}

/**
 * Draws the exact unified fixed header inspired by the reference design across ALL pages:
 * - Pure white page background (zero background ornaments, zero footer, zero page numbers)
 * - Dark petrol top banner (#16445B) with thin turquoise top edge (#359AA1) and curved bottom corners
 * - Exact Left-to-Right layout:
 *     1. Far Left (x = 0..275): Completely empty
 *     2. Left of center (center x = 458): Center-aligned 4 official lines (KSA, MOE, Dept, School)
 *     3. Vertical turquoise divider line (x = 648)
 *     4. Right of divider (center x = 790): High-res pure-white cropped official MOE logo
 *     5. Far Right (x = 905..1240): Balanced empty margin
 * - Centered dark petrol overlapping model title rectangle ("ملف شواهد أداء المعلم الموحد")
 *   straddling the lower edge of the header with turquoise border accent.
 */
function drawPortfolioUnifiedHeader(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  settings: SchoolSettings,
  whiteLogoCanvas: HTMLCanvasElement | null,
  pageTexts: string[]
): number {
  ctx.direction = 'rtl';
  ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
  ctx.fillRect(0, 0, pageW, pageH);

  const headerH = 224;
  const topStripH = 9;
  const bottomRadius = 46;

  // Header path with flat top and curved bottom-left / bottom-right corners
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pageW, 0);
  ctx.lineTo(pageW, headerH - bottomRadius);
  ctx.quadraticCurveTo(pageW, headerH, pageW - bottomRadius, headerH);
  ctx.lineTo(bottomRadius, headerH);
  ctx.quadraticCurveTo(0, headerH, 0, headerH - bottomRadius);
  ctx.closePath();
  ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
  ctx.fill();

  // Top turquoise strip clipped cleanly to header
  ctx.clip();
  ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerTopStrip;
  ctx.fillRect(0, 0, pageW, topStripH);
  ctx.restore();

  // Crisp turquoise bottom curve accent stroke
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, headerH - bottomRadius);
  ctx.quadraticCurveTo(0, headerH, bottomRadius, headerH);
  ctx.lineTo(pageW - bottomRadius, headerH);
  ctx.quadraticCurveTo(pageW, headerH, pageW, headerH - bottomRadius);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.accentTurquoise;
  ctx.stroke();
  ctx.restore();

  // --- Header Internal Content (y = 26 .. 170, leaving generous gap above overlapping title box at y = 188) ---
  // Left-to-Right layout:
  // [Far Left EMPTY: 0..290] | [4 centered lines: center x = 468] | [Turquoise divider: x = 648] | [MOE Logo: 668..864] | [Far Right EMPTY: 864..1240]
  const headerLines = getHeaderInfoLines(settings);
  const dataCenterX = 468;
  const dataMaxW = 336;
  const dividerX = 648;
  const contentTopY = 26;
  const contentBottomY = 170;
  const contentMidY = (contentTopY + contentBottomY) / 2;

  // Draw the 4 vertically stacked, center-aligned official lines to the left of the divider
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;

  const lineStep = headerLines.length <= 2 ? 40 : headerLines.length === 3 ? 37 : 33;
  const firstLineY = contentMidY - ((headerLines.length - 1) * lineStep) / 2;

  headerLines.forEach((line, idx) => {
    pageTexts.push(line);
    let fontSize = idx < 2 ? 21 : 19;
    ctx.font = `bold ${fontSize}px Tajawal, Cairo, sans-serif`;
    while (fontSize > 14 && ctx.measureText(line).width > dataMaxW) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px Tajawal, Cairo, sans-serif`;
    }
    ctx.fillText(line, dataCenterX, firstLineY + idx * lineStep);
  });
  ctx.restore();

  // Vertical turquoise divider line right of the data block
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dividerX, 38);
  ctx.lineTo(dividerX, 160);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.accentTurquoise;
  ctx.stroke();
  ctx.restore();

  // Official pure-white cropped Ministry of Education logo right of the divider (symmetric spacing)
  if (whiteLogoCanvas) {
    drawImageContain(ctx, whiteLogoCanvas, 668, 30, 200, 136);
  }

  // --- Overlapping Centered Model Title Rectangle ("ملف شواهد أداء المعلم الموحد") ---
  const titleW = 496;
  const titleH = 72;
  const titleX = (pageW - titleW) / 2;
  const titleY = headerH - titleH / 2; // Straddles bottom edge of header cleanly (y = 188..260)

  ctx.save();
  ctx.shadowColor = 'rgba(22, 68, 91, 0.14)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  drawRoundedRect(ctx, titleX, titleY, titleW, titleH, 14);
  ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
  ctx.fill();
  ctx.restore();

  // Turquoise border & crisp bottom accent rim on overlapping title rectangle
  ctx.save();
  drawRoundedRect(ctx, titleX, titleY, titleW, titleH, 14);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.accentTurquoise;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
  ctx.font = 'bold 26px Tajawal, Cairo, sans-serif';
  ctx.fillText(PORTFOLIO_MODEL_TITLE, pageW / 2, titleY + titleH / 2 + 1);
  ctx.restore();
  pageTexts.push(PORTFOLIO_MODEL_TITLE);

  // Clean body start position below the overlapping title box (zero footer on any page)
  return titleY + titleH + 38;
}

function estimateOrWrapLines(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  maxWidthPx: number,
  approxCharsPerLine = 82,
  fontSizePx = 17,
  isBold = false
): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  if (ctx) {
    return wrapCanvasLines(ctx, clean, maxWidthPx, fontSizePx, isBold);
  }
  const paragraphs = clean.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    let remaining = trimmed;
    while (remaining.length > approxCharsPerLine) {
      let cut = remaining.lastIndexOf(' ', approxCharsPerLine);
      if (cut <= 0) cut = approxCharsPerLine;
      lines.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) lines.push(remaining);
  }
  return lines;
}

type PlannedElementPageBlock =
  | {
      kind: 'element-header';
      element: ResolvedPortfolioElementSummary;
      isContinuation: boolean;
      height: number;
    }
  | {
      kind: 'evidence-card';
      element: ResolvedPortfolioElementSummary;
      indexInElement: number;
      isContinuation: boolean;
      titleLines: string[];
      metaLines: string[];
      bodyLines: string[];
      highlightLines: string[];
      highlightTone: 'note' | 'impact' | 'none';
      height: number;
    };

interface PlannedElementPage {
  blocks: PlannedElementPageBlock[];
  elementNumbers: number[];
}

function computeEvidenceCardHeight(
  titleLinesCount: number,
  metaLinesCount: number,
  bodyLinesCount: number,
  highlightLinesCount: number
): number {
  const topPad = 24;
  const bottomPad = 22;
  const titleH = titleLinesCount * 30;
  const metaH = metaLinesCount > 0 ? 8 + metaLinesCount * 24 : 0;
  const bodyH = bodyLinesCount > 0 ? 12 + bodyLinesCount * 28 : 0;
  const highlightH =
    highlightLinesCount > 0 ? 16 + 22 + highlightLinesCount * 26 : 0;
  return topPad + titleH + metaH + bodyH + highlightH + bottomPad;
}

/**
 * Splits element headers and evidence cards across pages dynamically:
 * - Strictly SKIPS elements with 0 evidences (never prints empty notices or empty pages).
 * - Preserves full long Arabic descriptions without arbitrary truncation.
 * - Keeps normal evidence cards intact; gracefully splits ultra-long single cards into
 *   continuation cards so no text ever clips or overflows page bounds.
 * - Uses clean official Arabic labels with zero occurrences of forbidden terms.
 */
function planElementBlocksToPages(
  elements: ResolvedPortfolioElementSummary[],
  measureCtx: CanvasRenderingContext2D | null,
  contentW: number
): PlannedElementPage[] {
  // PAGE_H = 1754, body start = 298, bottom clean margin = 68 -> usable = 1388px
  const MAX_PAGE_HEIGHT = 1380;
  const ELEMENT_HEADER_H = 74;
  const CARD_GAP = 16;
  const MAX_SINGLE_CARD_H = MAX_PAGE_HEIGHT - ELEMENT_HEADER_H - CARD_GAP;

  const pages: PlannedElementPage[] = [];
  let currentBlocks: PlannedElementPageBlock[] = [];
  let currentUsedH = 0;

  const flushPage = () => {
    if (currentBlocks.length === 0) return;
    const nums = Array.from(
      new Set(currentBlocks.map((b) => b.element.number))
    );
    pages.push({ blocks: currentBlocks, elementNumbers: nums });
    currentBlocks = [];
    currentUsedH = 0;
  };

  const pushBlock = (
    block: PlannedElementPageBlock,
    el: ResolvedPortfolioElementSummary,
    ensureContHeader: boolean
  ) => {
    if (
      currentBlocks.length > 0 &&
      currentUsedH + block.height > MAX_PAGE_HEIGHT
    ) {
      flushPage();
      if (ensureContHeader) {
        const contHeader: PlannedElementPageBlock = {
          kind: 'element-header',
          element: el,
          isContinuation: true,
          height: ELEMENT_HEADER_H,
        };
        currentBlocks.push(contHeader);
        currentUsedH += contHeader.height;
      }
    }
    currentBlocks.push(block);
    currentUsedH += block.height;
  };

  const pushEvidenceWithOverflowSplit = (
    el: ResolvedPortfolioElementSummary,
    indexInElement: number,
    rawTitle: string,
    metaLines: string[],
    allBodyLines: string[],
    allHighlightLines: string[],
    highlightTone: 'note' | 'impact' | 'none'
  ) => {
    const baseTitleLines = estimateOrWrapLines(
      measureCtx,
      `شاهد (${indexInElement}): ${rawTitle}`,
      contentW - 56,
      62,
      20,
      true
    );
    const fullCardH = computeEvidenceCardHeight(
      baseTitleLines.length,
      metaLines.length,
      allBodyLines.length,
      allHighlightLines.length
    );

    if (fullCardH <= MAX_SINGLE_CARD_H) {
      pushBlock(
        {
          kind: 'evidence-card',
          element: el,
          indexInElement,
          isContinuation: false,
          titleLines: baseTitleLines,
          metaLines,
          bodyLines: allBodyLines,
          highlightLines: allHighlightLines,
          highlightTone,
          height: fullCardH + CARD_GAP,
        },
        el,
        true
      );
      return;
    }

    // Ultra-long single evidence: split body/highlight lines cleanly across continuation cards
    let bodyIdx = 0;
    let hlIdx = 0;
    let chunkIndex = 0;

    while (
      chunkIndex === 0 ||
      bodyIdx < allBodyLines.length ||
      hlIdx < allHighlightLines.length
    ) {
      const isCont = chunkIndex > 0;
      const chunkTitleLines = isCont
        ? estimateOrWrapLines(
            measureCtx,
            `شاهد (${indexInElement}): ${rawTitle} (تابع)`,
            contentW - 56,
            62,
            20,
            true
          )
        : baseTitleLines;
      const chunkMetaLines = isCont ? [] : metaLines;

      const chunkBody: string[] = [];
      const chunkHighlight: string[] = [];

      while (bodyIdx < allBodyLines.length) {
        const candidateH = computeEvidenceCardHeight(
          chunkTitleLines.length,
          chunkMetaLines.length,
          chunkBody.length + 1,
          0
        );
        if (candidateH > MAX_SINGLE_CARD_H && chunkBody.length > 0) {
          break;
        }
        chunkBody.push(allBodyLines[bodyIdx]);
        bodyIdx++;
      }

      if (bodyIdx >= allBodyLines.length) {
        while (hlIdx < allHighlightLines.length) {
          const candidateH = computeEvidenceCardHeight(
            chunkTitleLines.length,
            chunkMetaLines.length,
            chunkBody.length,
            chunkHighlight.length + 1
          );
          if (
            candidateH > MAX_SINGLE_CARD_H &&
            (chunkBody.length > 0 || chunkHighlight.length > 0)
          ) {
            break;
          }
          chunkHighlight.push(allHighlightLines[hlIdx]);
          hlIdx++;
        }
      }

      const cardH = computeEvidenceCardHeight(
        chunkTitleLines.length,
        chunkMetaLines.length,
        chunkBody.length,
        chunkHighlight.length
      );

      pushBlock(
        {
          kind: 'evidence-card',
          element: el,
          indexInElement,
          isContinuation: isCont,
          titleLines: chunkTitleLines,
          metaLines: chunkMetaLines,
          bodyLines: chunkBody,
          highlightLines: chunkHighlight,
          highlightTone: chunkHighlight.length > 0 ? highlightTone : 'none',
          height: cardH + CARD_GAP,
        },
        el,
        true
      );
      chunkIndex++;
    }
  };

  for (const el of elements) {
    const resolvedLinked = el.items.filter((i) => i.status === 'resolved');
    const standalone = el.standaloneEvidences || [];

    // Strictly SKIP elements with zero evidences
    if (resolvedLinked.length === 0 && standalone.length === 0) {
      continue;
    }

    // Build normalized evidence entries for this element
    const normalizedEntries: Array<{
      indexInElement: number;
      title: string;
      metaLines: string[];
      bodyLines: string[];
      highlightLines: string[];
      highlightTone: 'note' | 'impact' | 'none';
    }> = [];

    for (let i = 0; i < resolvedLinked.length; i++) {
      const item = resolvedLinked[i];
      const rec = item.sourceRecord!;
      const metaParts: string[] = [`التصنيف: ${item.groupTitle}`];
      if (item.formTitle && item.formTitle !== item.groupTitle) {
        metaParts.push(item.formTitle);
      }
      if (rec.eventDate?.trim()) {
        metaParts.push(`التاريخ: ${rec.eventDate.trim()}`);
      }
      if (item.attachmentsCount > 0) {
        metaParts.push(`الصور المرفقة: ${item.attachmentsCount}`);
      }
      if (item.electronicLinks.length > 0) {
        metaParts.push(`الروابط: ${item.electronicLinks.length}`);
      }

      const metaLines = estimateOrWrapLines(
        measureCtx,
        metaParts.join('  ·  '),
        contentW - 56,
        84,
        15,
        true
      );

      const bodyLines: string[] = [];
      for (const sf of item.summaryFields) {
        const wrapped = estimateOrWrapLines(
          measureCtx,
          `• ${sf.label}: ${sf.value}`,
          contentW - 60,
          82,
          17,
          false
        );
        bodyLines.push(...wrapped);
      }

      const highlightLines =
        item.ref.note && item.ref.note.trim()
          ? estimateOrWrapLines(
              measureCtx,
              `ملاحظة التوثيق: ${item.ref.note.trim()}`,
              contentW - 76,
              78,
              16,
              true
            )
          : [];

      normalizedEntries.push({
        indexInElement: i + 1,
        title: rec.title,
        metaLines,
        bodyLines,
        highlightLines,
        highlightTone: highlightLines.length > 0 ? 'note' : 'none',
      });
    }

    for (let j = 0; j < standalone.length; j++) {
      const stItem = standalone[j];
      const ev = stItem.evidence;
      const metaParts: string[] = [`التصنيف: ${stItem.typeLabel}`];
      if (ev.executionDate.trim()) {
        metaParts.push(`تاريخ التنفيذ: ${ev.executionDate.trim()}`);
      }
      if (ev.targetAudience.trim()) {
        metaParts.push(`الفئة المستهدفة: ${ev.targetAudience.trim()}`);
      }
      if (stItem.attachmentsCount > 0) {
        metaParts.push(`الصور المرفقة: ${stItem.attachmentsCount}`);
      }
      if (stItem.electronicLinks.length > 0) {
        metaParts.push(`الروابط: ${stItem.electronicLinks.length}`);
      }

      const metaLines = estimateOrWrapLines(
        measureCtx,
        metaParts.join('  ·  '),
        contentW - 56,
        84,
        15,
        true
      );

      const bodyLines = estimateOrWrapLines(
        measureCtx,
        `وصف الممارسة: ${ev.description}`,
        contentW - 60,
        82,
        17,
        false
      );

      const highlightLines = ev.impact.trim()
        ? estimateOrWrapLines(
            measureCtx,
            `الأثر المتحقق: ${ev.impact.trim()}`,
            contentW - 76,
            78,
            16,
            true
          )
        : [];

      normalizedEntries.push({
        indexInElement: resolvedLinked.length + j + 1,
        title: ev.title,
        metaLines,
        bodyLines,
        highlightLines,
        highlightTone: highlightLines.length > 0 ? 'impact' : 'none',
      });
    }

    // Estimate first card height so element header always stays attached to its first evidence
    const firstEntry = normalizedEntries[0];
    const firstTitleLines = estimateOrWrapLines(
      measureCtx,
      `شاهد (${firstEntry.indexInElement}): ${firstEntry.title}`,
      contentW - 56,
      62,
      20,
      true
    );
    const firstCardMinPreviewH = Math.min(
      MAX_SINGLE_CARD_H,
      computeEvidenceCardHeight(
        firstTitleLines.length,
        firstEntry.metaLines.length,
        Math.min(firstEntry.bodyLines.length, 6),
        firstEntry.bodyLines.length <= 6
          ? Math.min(firstEntry.highlightLines.length, 3)
          : 0
      ) + CARD_GAP
    );

    if (
      currentBlocks.length > 0 &&
      currentUsedH + ELEMENT_HEADER_H + firstCardMinPreviewH > MAX_PAGE_HEIGHT
    ) {
      flushPage();
    }

    pushBlock(
      {
        kind: 'element-header',
        element: el,
        isContinuation: false,
        height: ELEMENT_HEADER_H,
      },
      el,
      false
    );

    for (const entry of normalizedEntries) {
      pushEvidenceWithOverflowSplit(
        el,
        entry.indexInElement,
        entry.title,
        entry.metaLines,
        entry.bodyLines,
        entry.highlightLines,
        entry.highlightTone
      );
    }

    // Small breathing gap between consecutive non-empty elements
    currentUsedH += 10;
  }

  flushPage();
  return pages;
}

interface PlannedAppendixPage {
  attachments: DeduplicatedPortfolioAppendixAttachment[];
  links: DeduplicatedPortfolioElectronicLink[];
}

function planAppendixPages(
  attachments: DeduplicatedPortfolioAppendixAttachment[],
  links: DeduplicatedPortfolioElectronicLink[]
): PlannedAppendixPage[] {
  if (attachments.length === 0 && links.length === 0) {
    return [];
  }

  const pages: PlannedAppendixPage[] = [];
  const ATTACHMENTS_PER_PAGE = 4;
  let linkCursor = 0;

  for (let i = 0; i < attachments.length; i += ATTACHMENTS_PER_PAGE) {
    const slice = attachments.slice(i, i + ATTACHMENTS_PER_PAGE);
    const isLastAttachmentBatch =
      i + ATTACHMENTS_PER_PAGE >= attachments.length;
    let inlineLinks: DeduplicatedPortfolioElectronicLink[] = [];
    if (isLastAttachmentBatch && slice.length <= 2 && links.length > 0) {
      inlineLinks = links.slice(0, 3);
      linkCursor = inlineLinks.length;
    }
    pages.push({
      attachments: slice,
      links: inlineLinks,
    });
  }

  const LINKS_PER_PAGE = 6;
  while (linkCursor < links.length) {
    pages.push({
      attachments: [],
      links: links.slice(linkCursor, linkCursor + LINKS_PER_PAGE),
    });
    linkCursor += LINKS_PER_PAGE;
  }

  return pages;
}

/**
 * Generates the Unified Teacher Performance Portfolio PDF (`ملف شواهد أداء المعلم الموحد`):
 * 1. Unified fixed header + overlapping model title rectangle across every page, ZERO footer.
 * 2. Page 1: Simple, clean Cover Page containing ONLY model title, academic year, teacher name, school name, principal name.
 * 3. Page 2: Standalone Performance Elements Evaluation Card (3-column table: م | اسم العنصر | الوزن).
 * 4. Pages 3..N (Dynamic): Auto-paginated evidence pages ONLY for elements that contain actual evidences.
 * 5. Final Pages (Dynamic): Photos & Links Appendix ONLY when media attachments or electronic links exist.
 */
export async function generateTeacherPortfolioPdf(opts?: {
  settings?: SchoolSettings;
  storage?: StorageLike;
  mediaRepo?: TeacherMediaRepository;
  templateStyle?: TeacherPdfTemplateStyle;
  colorSystem?: TeacherPdfColorSystem;
}): Promise<GeneratedTeacherPortfolioPdfResult> {
  const settings = opts?.settings || DEFAULT_SCHOOL_SETTINGS;
  const gendered = getGenderedLabels(settings.gender);
  const teacherTitle = settings.gender === 'female' ? 'المعلمة' : 'المعلم';

  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN_X = 64;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const overview = resolveFullPortfolioOverview({ storage: opts?.storage });
  const { attachments, electronicLinks } =
    await collectDeduplicatedPortfolioAttachments(
      overview,
      opts?.mediaRepo || getDefaultTeacherMediaRepository()
    );

  let measureCtx: CanvasRenderingContext2D | null = null;
  if (typeof document !== 'undefined') {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    const scratchCanvas = document.createElement('canvas');
    measureCtx = scratchCanvas.getContext('2d');
  }

  const elementPages = planElementBlocksToPages(
    overview.elements,
    measureCtx,
    CONTENT_W
  );
  // Dynamic Appendix: generated ONLY when real photos or electronic links exist
  const appendixChunks = planAppendixPages(attachments, electronicLinks);

  // Page 1: Cover, Page 2: Evaluation Card, Pages 3..N: Non-empty Element Evidences, Final: Appendix (if non-empty)
  const totalPages = 2 + elementPages.length + appendixChunks.length;

  const pageDescriptors: PortfolioPdfPageDescriptor[] = [];
  pageDescriptors.push({
    pageNumber: 1,
    totalPages,
    kind: 'cover',
    title: 'غلاف ملف شواهد أداء المعلم الموحد',
    elementNumbersOnPage: [],
    attachmentCountOnPage: 0,
    electronicLinkCountOnPage: 0,
  });
  pageDescriptors.push({
    pageNumber: 2,
    totalPages,
    kind: 'index',
    title: 'بطاقة تقييم عناصر الأداء الوظيفي',
    elementNumbersOnPage: OVERVIEW_ELEMENT_NUMBERS,
    attachmentCountOnPage: 0,
    electronicLinkCountOnPage: 0,
  });

  elementPages.forEach((ep, idx) => {
    pageDescriptors.push({
      pageNumber: 3 + idx,
      totalPages,
      kind: 'elements',
      title: `شواهد عناصر الأداء (${ep.elementNumbers.join('، ')})`,
      elementNumbersOnPage: ep.elementNumbers,
      attachmentCountOnPage: 0,
      electronicLinkCountOnPage: 0,
    });
  });

  appendixChunks.forEach((apChunk, idx) => {
    pageDescriptors.push({
      pageNumber: 3 + elementPages.length + idx,
      totalPages,
      kind: 'appendix',
      title:
        idx === 0
          ? 'ملحق الصور والمرفقات'
          : 'ملحق الصور والمرفقات (تابع)',
      elementNumbersOnPage: [],
      attachmentCountOnPage: apChunk.attachments.length,
      electronicLinkCountOnPage: apChunk.links.length,
    });
  });

  const safeTeacherName = sanitizeFilenameSegment(
    settings.userName?.trim() || 'المعلم'
  );
  const filename = `ملف_شواهد_أداء_المعلم_الموحد_${safeTeacherName}.pdf`;

  const coverFields: Array<{ label: string; value: string }> = [
    {
      label: 'العام الدراسي',
      value: settings.academicYear?.trim() || 'غير محدد',
    },
    {
      label: teacherTitle,
      value: settings.userName?.trim() || 'غير محدد',
    },
    {
      label: 'اسم المدرسة',
      value: settings.schoolName?.trim() || 'غير محدد',
    },
    {
      label: gendered.principalTitle,
      value: settings.principalName?.trim() || 'غير محدد',
    },
  ];

  // Helper to build exact logical text strings for a page (used by Node.js headless path)
  const buildPageTextSummary = (pageIdx: number): string => {
    const desc = pageDescriptors[pageIdx];
    const texts: string[] = [
      ...getHeaderInfoLines(settings),
      PORTFOLIO_MODEL_TITLE,
    ];

    if (desc.kind === 'cover') {
      texts.push(PORTFOLIO_MODEL_TITLE);
      for (const f of coverFields) {
        texts.push(f.label, f.value);
      }
    } else if (desc.kind === 'index') {
      texts.push('بطاقة تقييم عناصر الأداء الوظيفي', 'م', 'اسم العنصر', 'الوزن');
      for (const def of TEACHER_PORTFOLIO_ELEMENTS_CATALOG) {
        texts.push(
          String(def.number),
          stripTrailingPeriod(def.title),
          `${def.weightPercent}%`
        );
      }
      const totalWeight = TEACHER_PORTFOLIO_ELEMENTS_CATALOG.reduce(
        (sum, d) => sum + d.weightPercent,
        0
      );
      texts.push('المجموع', `${totalWeight}%`);
    } else if (desc.kind === 'elements') {
      const ep = elementPages[pageIdx - 2];
      if (ep) {
        for (const block of ep.blocks) {
          if (block.kind === 'element-header') {
            const cleanTitle = stripTrailingPeriod(block.element.title);
            texts.push(
              block.isContinuation
                ? `العنصر (${block.element.number}): ${cleanTitle} (تابع)`
                : `العنصر (${block.element.number}): ${cleanTitle}`,
              `${block.element.totalEvidencesCount} شاهد`
            );
          } else {
            texts.push(
              ...block.titleLines,
              ...block.metaLines,
              ...block.bodyLines,
              ...block.highlightLines
            );
          }
        }
      }
    } else if (desc.kind === 'appendix') {
      const apIdx = pageIdx - (2 + elementPages.length);
      const chunk = appendixChunks[apIdx];
      texts.push(
        apIdx === 0 ? 'ملحق الصور والمرفقات' : 'ملحق الصور والمرفقات (تابع)'
      );
      if (chunk) {
        for (const att of chunk.attachments) {
          texts.push(
            `الشاهد: ${att.sourceRecordTitles.join(' ، ')}`,
            `التصنيف: ${att.sourceGroupTitles.join(' ، ')}`,
            `العناصر المشمولة: ${att.referencedByElements.map((e) => `عنصر (${e.number})`).join(' ، ')}`
          );
        }
        if (chunk.links.length > 0) {
          texts.push('الروابط الإلكترونية ورموز الاستجابة السريعة (QR)');
          for (const lnk of chunk.links) {
            texts.push(
              `الشاهد: ${lnk.sourceRecordTitles.join(' ، ')}`,
              `العناصر المشمولة: ${lnk.referencedByElements.map((e) => `عنصر (${e.number})`).join(' ، ')}`,
              lnk.url
            );
          }
        }
      }
    }

    return texts.join('\n');
  };

  // Node.js fallback for headless unit tests where HTMLCanvasElement is unavailable
  if (typeof document === 'undefined') {
    const renderedTextsByPage: string[] = [];
    const fallbackPages: TeacherPageJpegWithLinks[] = pageDescriptors.map(
      (desc, idx) => {
        renderedTextsByPage.push(buildPageTextSummary(idx));
        const pageLinks: PdfLinkAnnotation[] = [];
        if (desc.kind === 'appendix') {
          const apIdx = idx - (2 + elementPages.length);
          const chunk = appendixChunks[apIdx];
          if (chunk) {
            chunk.links.forEach((lnk, lIdx) => {
              generateQrMatrix(lnk.url);
              pageLinks.push({
                xPx: 120 + lIdx * 260,
                yPx: 1320,
                wPx: 112,
                hPx: 112,
                url: lnk.url,
              });
            });
          }
        }
        return {
          jpegBytes: MINIMAL_WHITE_JPEG,
          dataUrl: '',
          pixelWidth: PAGE_W,
          pixelHeight: PAGE_H,
          links: pageLinks,
        };
      }
    );

    const pdfBytes = buildTeacherPdfBinaryWithLinks(
      fallbackPages,
      595.28,
      841.89
    );
    const linkAnnotationsCount = fallbackPages.reduce(
      (s, p) => s + p.links.length,
      0
    );

    return {
      pdfBytes,
      filename,
      pageCount: fallbackPages.length,
      pages: fallbackPages,
      pageDescriptors,
      deduplicatedAttachmentsCount: attachments.length,
      deduplicatedLinksCount: electronicLinks.length,
      linkAnnotationsCount,
      renderedTextsByPage,
    };
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const logoImg = await loadImageElement('./moe-logo.png');
  const whiteLogoCanvas = prepareWhiteCroppedLogoCanvas(logoImg);
  const attachmentImagesMap = new Map<string, HTMLImageElement | null>();
  for (const att of attachments) {
    const imgEl = await loadImageElement(att.imageDataUrl);
    attachmentImagesMap.set(att.dedupeKey, imgEl);
  }

  const renderedPages: TeacherPageJpegWithLinks[] = [];
  const renderedTextsByPage: string[] = [];

  // --------------------------------------------------------------------------
  // Render Page 1: Simple, Official Cover Page (ONLY the 5 required items)
  // --------------------------------------------------------------------------
  {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    const pageTexts: string[] = [];

    const startY = drawPortfolioUnifiedHeader(
      ctx,
      PAGE_W,
      PAGE_H,
      settings,
      whiteLogoCanvas,
      pageTexts
    );

    // Subtle light framed official container on clean white paper
    const frameX = MARGIN_X + 26;
    const frameW = CONTENT_W - 52;
    const frameY = startY + 36;
    const frameH = 1140;

    drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 22);
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
    ctx.stroke();

    // Inner hairline accent frame
    drawRoundedRect(ctx, frameX + 14, frameY + 14, frameW - 28, frameH - 28, 16);
    ctx.lineWidth = 1;
    ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.subtleBorder;
    ctx.stroke();

    // Cover Title Block (centered, dignified, airy)
    const titleBlockY = frameY + 135;
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
    drawRoundedRect(ctx, PAGE_W / 2 - 58, titleBlockY - 46, 116, 6, 3);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
    ctx.font = 'bold 46px Tajawal, Cairo, sans-serif';
    ctx.fillText(PORTFOLIO_MODEL_TITLE, PAGE_W / 2, titleBlockY + 18);
    pageTexts.push(PORTFOLIO_MODEL_TITLE);

    // Subtle turquoise divider below cover title
    ctx.beginPath();
    ctx.moveTo(PAGE_W / 2 - 190, titleBlockY + 78);
    ctx.lineTo(PAGE_W / 2 + 190, titleBlockY + 78);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
    ctx.stroke();

    // 4 Clean Official Metadata Rows (Academic Year, Teacher, School, Principal)
    const rowX = frameX + 76;
    const rowW = frameW - 152;
    const labelW = 264;
    const rowH = 104;
    const rowGap = 32;
    let rowY = titleBlockY + 150;

    for (const field of coverFields) {
      // Full rounded row card
      drawRoundedRect(ctx, rowX, rowY, rowW, rowH, 14);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
      ctx.stroke();

      // Right-side turquoise label panel (RTL)
      const labelX = rowX + rowW - labelW;
      ctx.save();
      drawRoundedRect(ctx, rowX, rowY, rowW, rowH, 14);
      ctx.clip();
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
      ctx.fillRect(labelX, rowY, labelW, rowH);
      ctx.restore();

      // Re-stroke outer border for razor-sharp corners
      drawRoundedRect(ctx, rowX, rowY, rowW, rowH, 14);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
      ctx.stroke();

      // Label text (white bold centered in turquoise right panel)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
      ctx.font = 'bold 23px Tajawal, Cairo, sans-serif';
      ctx.fillText(field.label, labelX + labelW / 2, rowY + rowH / 2 + 1);
      pageTexts.push(field.label);

      // Value text (dark petrol bold centered/right-aligned cleanly in white value panel)
      const valueCenterX = rowX + (rowW - labelW) / 2;
      const valueMaxW = rowW - labelW - 44;
      ctx.textAlign = 'center';
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.textPrimary;
      let valFontSize = 26;
      ctx.font = `bold ${valFontSize}px Tajawal, Cairo, sans-serif`;
      while (valFontSize > 17 && ctx.measureText(field.value).width > valueMaxW) {
        valFontSize -= 1;
        ctx.font = `bold ${valFontSize}px Tajawal, Cairo, sans-serif`;
      }
      ctx.fillText(field.value, valueCenterX, rowY + rowH / 2 + 1);
      pageTexts.push(field.value);

      rowY += rowH + rowGap;
    }

    // Minimal decorative bottom line inside the cover frame
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
    drawRoundedRect(ctx, PAGE_W / 2 - 42, frameY + frameH - 54, 84, 5, 2.5);
    ctx.fill();

    const { jpegBytes, dataUrl } = canvasToJpegAndDataUrl(canvas, 0.94);
    renderedPages.push({
      jpegBytes,
      dataUrl,
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
      links: [],
    });
    renderedTextsByPage.push(pageTexts.join('\n'));
  }

  // --------------------------------------------------------------------------
  // Render Page 2: Standalone Performance Elements Evaluation Card
  // --------------------------------------------------------------------------
  {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    const pageTexts: string[] = [];

    let cursorY = drawPortfolioUnifiedHeader(
      ctx,
      PAGE_W,
      PAGE_H,
      settings,
      whiteLogoCanvas,
      pageTexts
    );

    // Turquoise Section Header Rectangle
    const secH = 62;
    drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, secH, 12);
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
    ctx.font = 'bold 26px Tajawal, Cairo, sans-serif';
    ctx.fillText(
      'بطاقة تقييم عناصر الأداء الوظيفي',
      PAGE_W / 2,
      cursorY + secH / 2 + 1
    );
    pageTexts.push('بطاقة تقييم عناصر الأداء الوظيفي');

    cursorY += secH + 26;

    // Clean 3-column RTL Table ONLY: [الوزن (left)] | [اسم العنصر (middle)] | [م (right)]
    const colNumW = 104;
    const colWeightW = 188;
    const colNameW = CONTENT_W - colNumW - colWeightW;

    const xWeightStart = MARGIN_X;
    const xNameStart = MARGIN_X + colWeightW;
    const xNumStart = MARGIN_X + colWeightW + colNameW;

    const tableHeaderH = 62;
    const rowH = 92;
    const totalRowH = 70;
    const totalTableH =
      tableHeaderH +
      TEACHER_PORTFOLIO_ELEMENTS_CATALOG.length * rowH +
      totalRowH;

    // Table outer container clip & fill
    ctx.save();
    drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, totalTableH, 14);
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
    ctx.fill();
    ctx.clip();

    // Table Header Band (soft turquoise tint with dark petrol bold text)
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurface;
    ctx.fillRect(MARGIN_X, cursorY, CONTENT_W, tableHeaderH);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
    ctx.font = 'bold 21px Tajawal, Cairo, sans-serif';

    ctx.textAlign = 'center';
    ctx.fillText('م', xNumStart + colNumW / 2, cursorY + tableHeaderH / 2 + 1);
    ctx.textAlign = 'right';
    ctx.fillText(
      'اسم العنصر',
      xNumStart - 28,
      cursorY + tableHeaderH / 2 + 1
    );
    ctx.textAlign = 'center';
    ctx.fillText(
      'الوزن',
      xWeightStart + colWeightW / 2,
      cursorY + tableHeaderH / 2 + 1
    );
    pageTexts.push('م', 'اسم العنصر', 'الوزن');

    let rowY = cursorY + tableHeaderH;

    // 11 Official Elements Rows
    TEACHER_PORTFOLIO_ELEMENTS_CATALOG.forEach((def, idx) => {
      if (idx % 2 === 1) {
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurfaceAlt;
        ctx.fillRect(MARGIN_X, rowY, CONTENT_W, rowH);
      }

      // Top horizontal divider
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, rowY);
      ctx.lineTo(MARGIN_X + CONTENT_W, rowY);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.subtleBorder;
      ctx.stroke();

      const midY = rowY + rowH / 2;

      // Sequence number badge
      ctx.beginPath();
      ctx.arc(xNumStart + colNumW / 2, midY, 21, 0, Math.PI * 2);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurface;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
      ctx.font = 'bold 19px Tajawal, Cairo, sans-serif';
      ctx.fillText(String(def.number), xNumStart + colNumW / 2, midY + 1);

      // Clean Element Name (RTL right-aligned)
      const cleanElementName = stripTrailingPeriod(def.title);
      ctx.textAlign = 'right';
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.textPrimary;
      ctx.font = 'bold 21px Tajawal, Cairo, sans-serif';
      ctx.fillText(cleanElementName, xNumStart - 28, midY + 1);

      // Official Weight Percentage
      const weightLabel = `${def.weightPercent}%`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
      ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
      ctx.fillText(weightLabel, xWeightStart + colWeightW / 2, midY + 1);

      pageTexts.push(String(def.number), cleanElementName, weightLabel);
      rowY += rowH;
    });

    // Total Weight Summary Row (100%)
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurface;
    ctx.fillRect(MARGIN_X, rowY, CONTENT_W, totalRowH);

    ctx.beginPath();
    ctx.moveTo(MARGIN_X, rowY);
    ctx.lineTo(MARGIN_X + CONTENT_W, rowY);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
    ctx.stroke();

    const totalWeight = TEACHER_PORTFOLIO_ELEMENTS_CATALOG.reduce(
      (sum, d) => sum + d.weightPercent,
      0
    );
    const totalMidY = rowY + totalRowH / 2 + 1;

    ctx.textBaseline = 'middle';
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
    ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('المجموع', xNumStart - 28, totalMidY);

    ctx.textAlign = 'center';
    ctx.fillText(`${totalWeight}%`, xWeightStart + colWeightW / 2, totalMidY);
    pageTexts.push('المجموع', `${totalWeight}%`);

    // Vertical column dividers across the entire table
    ctx.beginPath();
    ctx.moveTo(xNumStart, cursorY);
    ctx.lineTo(xNumStart, cursorY + totalTableH - totalRowH);
    ctx.moveTo(xNameStart, cursorY);
    ctx.lineTo(xNameStart, cursorY + totalTableH);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.subtleBorder;
    ctx.stroke();

    ctx.restore();

    // Outer table border
    drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, totalTableH, 14);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
    ctx.stroke();

    const { jpegBytes, dataUrl } = canvasToJpegAndDataUrl(canvas, 0.94);
    renderedPages.push({
      jpegBytes,
      dataUrl,
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
      links: [],
    });
    renderedTextsByPage.push(pageTexts.join('\n'));
  }

  // --------------------------------------------------------------------------
  // Render Pages 3..N: Dynamic Evidence Pages (ONLY non-empty elements)
  // --------------------------------------------------------------------------
  for (let pIdx = 0; pIdx < elementPages.length; pIdx++) {
    const pagePlan = elementPages[pIdx];
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    const pageTexts: string[] = [];

    let cursorY = drawPortfolioUnifiedHeader(
      ctx,
      PAGE_W,
      PAGE_H,
      settings,
      whiteLogoCanvas,
      pageTexts
    );

    for (const block of pagePlan.blocks) {
      if (block.kind === 'element-header') {
        const el = block.element;
        const secHeaderH = 60;
        drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, secHeaderH, 12);
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
        ctx.fill();

        const cleanTitle = stripTrailingPeriod(el.title);
        const headingText = block.isContinuation
          ? `العنصر (${el.number}): ${cleanTitle} (تابع)`
          : `العنصر (${el.number}): ${cleanTitle}`;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
        ctx.font = 'bold 22px Tajawal, Cairo, sans-serif';
        ctx.fillText(headingText, PAGE_W - MARGIN_X - 24, cursorY + secHeaderH / 2 + 1);
        pageTexts.push(headingText);

        const countText = `${el.totalEvidencesCount} شاهد`;
        ctx.textAlign = 'left';
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurface;
        ctx.font = 'bold 17px Tajawal, Cairo, sans-serif';
        ctx.fillText(countText, MARGIN_X + 24, cursorY + secHeaderH / 2 + 1);
        pageTexts.push(countText);

        cursorY += block.height;
      } else {
        const cardH = block.height - 16;

        // Calm clean white evidence card with soft turquoise border
        drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, cardH, 14);
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
        ctx.stroke();

        // Subtle right-side turquoise accent bar inside card
        ctx.save();
        drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, cardH, 14);
        ctx.clip();
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
        ctx.fillRect(MARGIN_X + CONTENT_W - 6, cursorY, 6, cardH);
        ctx.restore();

        // Re-stroke card border for crisp edges
        drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, cardH, 14);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
        ctx.stroke();

        const rightTextX = PAGE_W - MARGIN_X - 26;
        let lineY = cursorY + 38;

        // Evidence Title
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
        ctx.font = 'bold 20px Tajawal, Cairo, sans-serif';
        for (const tLine of block.titleLines) {
          ctx.fillText(tLine, rightTextX, lineY);
          pageTexts.push(tLine);
          lineY += 30;
        }

        // Metadata line(s)
        if (block.metaLines.length > 0) {
          lineY += 4;
          ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
          ctx.font = 'bold 15px Tajawal, Cairo, sans-serif';
          for (const mLine of block.metaLines) {
            ctx.fillText(mLine, rightTextX, lineY);
            pageTexts.push(mLine);
            lineY += 24;
          }
        }

        // Body lines (full description / summary fields, zero truncation)
        if (block.bodyLines.length > 0) {
          lineY += 10;
          ctx.fillStyle = PORTFOLIO_PDF_PALETTE.textPrimary;
          ctx.font = '600 17px Tajawal, Cairo, sans-serif';
          for (const bLine of block.bodyLines) {
            ctx.fillText(bLine, rightTextX - 2, lineY);
            pageTexts.push(bLine);
            lineY += 28;
          }
        }

        // Highlight Box (Documentation Note or Achieved Impact)
        if (block.highlightLines.length > 0) {
          const hlBoxY = lineY - 8;
          const hlBoxH = 22 + block.highlightLines.length * 26;
          drawRoundedRect(
            ctx,
            MARGIN_X + 22,
            hlBoxY,
            CONTENT_W - 48,
            hlBoxH,
            10
          );
          ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurface;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.subtleBorder;
          ctx.stroke();

          ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
          ctx.font = 'bold 16px Tajawal, Cairo, sans-serif';
          let hy = hlBoxY + 28;
          for (const hLine of block.highlightLines) {
            ctx.fillText(hLine, PAGE_W - MARGIN_X - 38, hy);
            pageTexts.push(hLine);
            hy += 26;
          }
        }

        cursorY += block.height;
      }
    }

    const { jpegBytes, dataUrl } = canvasToJpegAndDataUrl(canvas, 0.94);
    renderedPages.push({
      jpegBytes,
      dataUrl,
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
      links: [],
    });
    renderedTextsByPage.push(pageTexts.join('\n'));
  }

  // --------------------------------------------------------------------------
  // Render Final Page(s): Dynamic Photos & Links Appendix (ONLY if non-empty)
  // --------------------------------------------------------------------------
  for (let aIdx = 0; aIdx < appendixChunks.length; aIdx++) {
    const apChunk = appendixChunks[aIdx];
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    const pageTexts: string[] = [];
    const pageLinks: PdfLinkAnnotation[] = [];

    let cursorY = drawPortfolioUnifiedHeader(
      ctx,
      PAGE_W,
      PAGE_H,
      settings,
      whiteLogoCanvas,
      pageTexts
    );

    // Turquoise Appendix Section Header Rectangle
    const appHeaderH = 60;
    const appHeaderText =
      aIdx === 0 ? 'ملحق الصور والمرفقات' : 'ملحق الصور والمرفقات (تابع)';
    drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, appHeaderH, 12);
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
    ctx.font = 'bold 24px Tajawal, Cairo, sans-serif';
    ctx.fillText(appHeaderText, PAGE_W / 2, cursorY + appHeaderH / 2 + 1);
    pageTexts.push(appHeaderText);

    cursorY += appHeaderH + 24;

    // 2x2 Photo Grid (aspect ratio strictly preserved via drawImageContain)
    const cardW = (CONTENT_W - 24) / 2;
    const cardH = 472;

    for (let i = 0; i < apChunk.attachments.length; i++) {
      const att = apChunk.attachments[i];
      const col = i % 2; // 0 = right, 1 = left in RTL
      const row = Math.floor(i / 2);
      const cardX = col === 0 ? MARGIN_X + cardW + 24 : MARGIN_X;
      const cardY = cursorY + row * (cardH + 22);

      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
      ctx.stroke();

      // Clean photo container
      const imgX = cardX + 16;
      const imgY = cardY + 16;
      const imgW = cardW - 32;
      const imgH = 290;

      drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 10);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurfaceAlt;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.subtleBorder;
      ctx.stroke();

      const loadedImg = attachmentImagesMap.get(att.dedupeKey);
      if (loadedImg) {
        ctx.save();
        drawRoundedRect(ctx, imgX + 2, imgY + 2, imgW - 4, imgH - 4, 8);
        ctx.clip();
        drawImageContain(
          ctx,
          loadedImg,
          imgX + 8,
          imgY + 8,
          imgW - 16,
          imgH - 16
        );
        ctx.restore();
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.textMuted;
        ctx.font = 'bold 18px Tajawal, Cairo, sans-serif';
        ctx.fillText('صورة شاهد موثقة', imgX + imgW / 2, imgY + imgH / 2);
        pageTexts.push('صورة شاهد موثقة');
      }

      // Clean official Arabic captions with multi-line wrapping (zero mid-sentence clipping)
      const capMaxW = cardW - 36;
      const capRightX = cardX + cardW - 18;
      let capY = imgY + imgH + 28;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';

      const recTitleLine = `الشاهد: ${att.sourceRecordTitles.join(' ، ')}`;
      const wrappedRec = wrapCanvasLines(ctx, recTitleLine, capMaxW, 17, true).slice(0, 2);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
      ctx.font = 'bold 17px Tajawal, Cairo, sans-serif';
      for (const rLine of wrappedRec) {
        ctx.fillText(rLine, capRightX, capY);
        pageTexts.push(rLine);
        capY += 24;
      }

      capY += 4;
      const groupLine = `التصنيف: ${att.sourceGroupTitles.join(' ، ')}`;
      const wrappedGrp = wrapCanvasLines(ctx, groupLine, capMaxW, 15, true).slice(0, 2);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
      ctx.font = 'bold 15px Tajawal, Cairo, sans-serif';
      for (const gLine of wrappedGrp) {
        ctx.fillText(gLine, capRightX, capY);
        pageTexts.push(gLine);
        capY += 22;
      }

      capY += 4;
      const elNums = att.referencedByElements
        .map((e) => `عنصر (${e.number})`)
        .join(' ، ');
      const elLine = `العناصر المشمولة: ${elNums}`;
      const wrappedEls = wrapCanvasLines(ctx, elLine, capMaxW, 14, true).slice(0, 2);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.textSecondary;
      ctx.font = 'bold 14px Tajawal, Cairo, sans-serif';
      for (const eLine of wrappedEls) {
        ctx.fillText(eLine, capRightX, capY);
        pageTexts.push(eLine);
        capY += 20;
      }
    }

    if (apChunk.attachments.length > 0) {
      const rowsUsed = Math.ceil(apChunk.attachments.length / 2);
      cursorY += rowsUsed * (cardH + 22) + 12;
    }

    // Electronic Links & QR Codes Section (if present on this appendix page)
    if (apChunk.links.length > 0) {
      const linkHeaderH = 52;
      drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, linkHeaderH, 10);
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.softSurface;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
      ctx.font = 'bold 19px Tajawal, Cairo, sans-serif';
      const qrSecTitle = 'الروابط الإلكترونية ورموز الاستجابة السريعة (QR)';
      ctx.fillText(
        qrSecTitle,
        PAGE_W - MARGIN_X - 20,
        cursorY + linkHeaderH / 2 + 1
      );
      pageTexts.push(qrSecTitle);
      cursorY += linkHeaderH + 16;

      for (let lIdx = 0; lIdx < apChunk.links.length; lIdx++) {
        const lnk = apChunk.links[lIdx];
        const qrBoxH = 128;
        drawRoundedRect(ctx, MARGIN_X, cursorY, CONTENT_W, qrBoxH, 12);
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = PORTFOLIO_PDF_PALETTE.cardBorder;
        ctx.stroke();

        // Draw crisp QR Matrix on the left
        const qrSize = 96;
        const qrX = MARGIN_X + 20;
        const qrY = cursorY + 16;
        const matrix = generateQrMatrix(lnk.url);
        const n = matrix.length;
        const cell = qrSize / n;
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.white;
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (matrix[r][c]) {
              ctx.fillRect(qrX + c * cell, qrY + r * cell, cell, cell);
            }
          }
        }

        pageLinks.push({
          xPx: qrX,
          yPx: qrY,
          wPx: qrSize,
          hPx: qrSize,
          url: lnk.url,
        });

        const qrTextMaxW = CONTENT_W - 156;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';

        const qrRecordRaw = `الشاهد: ${lnk.sourceRecordTitles.join(' ، ')}`;
        const qrRecordLabel =
          wrapCanvasLines(ctx, qrRecordRaw, qrTextMaxW, 18, true)[0] || qrRecordRaw;
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.headerBg;
        ctx.font = 'bold 18px Tajawal, Cairo, sans-serif';
        ctx.fillText(qrRecordLabel, PAGE_W - MARGIN_X - 22, cursorY + 42);
        pageTexts.push(qrRecordLabel);

        const qrElementsRaw = `العناصر المشمولة: ${lnk.referencedByElements.map((e) => `عنصر (${e.number})`).join(' ، ')}`;
        const qrElementsLabel =
          wrapCanvasLines(ctx, qrElementsRaw, qrTextMaxW, 16, true)[0] || qrElementsRaw;
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.sectionTurquoise;
        ctx.font = 'bold 16px Tajawal, Cairo, sans-serif';
        ctx.fillText(qrElementsLabel, PAGE_W - MARGIN_X - 22, cursorY + 74);
        pageTexts.push(qrElementsLabel);

        const qrUrlLabel =
          wrapCanvasLines(ctx, lnk.url, qrTextMaxW, 15, true)[0] || lnk.url.slice(0, 75);
        ctx.fillStyle = PORTFOLIO_PDF_PALETTE.textSecondary;
        ctx.font = 'bold 15px Tajawal, Cairo, sans-serif';
        ctx.fillText(qrUrlLabel, PAGE_W - MARGIN_X - 22, cursorY + 104);
        pageTexts.push(qrUrlLabel);

        cursorY += qrBoxH + 14;
      }
    }

    const { jpegBytes, dataUrl } = canvasToJpegAndDataUrl(canvas, 0.94);
    renderedPages.push({
      jpegBytes,
      dataUrl,
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
      links: pageLinks,
    });
    renderedTextsByPage.push(pageTexts.join('\n'));
  }

  const pdfBytes = buildTeacherPdfBinaryWithLinks(
    renderedPages,
    595.28,
    841.89
  );
  const linkAnnotationsCount = renderedPages.reduce(
    (sum, p) => sum + p.links.length,
    0
  );

  return {
    pdfBytes,
    filename,
    pageCount: renderedPages.length,
    pages: renderedPages,
    pageDescriptors,
    deduplicatedAttachmentsCount: attachments.length,
    deduplicatedLinksCount: electronicLinks.length,
    linkAnnotationsCount,
    renderedTextsByPage,
  };
}

const OVERVIEW_ELEMENT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
