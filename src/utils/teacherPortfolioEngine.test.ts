import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  createEmptyGroupArchiveStore,
  deleteArchivedRecordSafely,
  inspectRecordDeletionImpact,
  loadGroupArchiveStore,
  saveGroupArchiveStore,
  StorageLike,
  TEACHER_PORTFOLIO_STORAGE_KEY,
  TeacherArchiveGroupId,
  upsertArchivedRecord,
  upsertDraftRecord,
} from './teacherArchiveEngine';
import {
  createMemoryTeacherMediaRepository,
  loadMediaBlobWithIntegrityCheck,
  saveMediaDataUrl,
  UnifiedMediaRef,
} from './teacherMediaStorage';
import {
  cleanupAllMissingPortfolioReferences,
  cleanupUnreferencedStagedPhotoDataUrls,
  collectDeduplicatedPortfolioAttachments,
  createEmptyStandaloneEvidenceInput,
  deleteStandaloneEvidenceFromElement,
  generateTeacherPortfolioPdf,
  hydrateLinkedRecordPhotosFromMediaRepo,
  initializeOrMigratePortfolioStore,
  inspectPortfolioStorageState,
  linkRecordToPortfolioElement,
  listEligibleSourceRecords,
  loadPortfolioStore,
  loadStandaloneEvidenceWithMedia,
  resolveFullPortfolioOverview,
  rollbackPortfolioFromBackup,
  savePortfolioStoreSafely,
  saveStandaloneEvidenceToElement,
  TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY,
  TEACHER_PORTFOLIO_ELEMENTS_CATALOG,
  TEACHER_PORTFOLIO_SOURCE_GROUPS,
  unlinkRecordFromPortfolioElement,
  updatePortfolioLinkNote,
  validateStandalonePortfolioEvidence,
} from './teacherPortfolioEngine';

function createMemoryStorage(
  initial: Record<string, string> = {}
): StorageLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

function seedSavedRecordInGroup(
  storage: StorageLike,
  groupId: TeacherArchiveGroupId,
  input: {
    id: string;
    formId: string;
    title: string;
    summary?: string;
    eventDate?: string;
    payload?: Record<string, unknown>;
    mediaRefs?: UnifiedMediaRef[];
  }
) {
  const groupMeta = TEACHER_PORTFOLIO_SOURCE_GROUPS.find(
    (g) => g.groupId === groupId
  )!;
  const current = loadGroupArchiveStore(groupMeta.storageKey, groupId, storage);
  const { nextStore, record } = upsertArchivedRecord(current, {
    id: input.id,
    formId: input.formId,
    title: input.title,
    summary: input.summary,
    academicYear: '1447هـ',
    semester: 'الفصل الدراسي الأول',
    eventDate: input.eventDate || '1447/03/15',
    mediaRefs: input.mediaRefs || [],
    payload: input.payload || { objectives: 'هدف توثيقي' },
  });
  saveGroupArchiveStore(groupMeta.storageKey, nextStore, storage);
  return { storageKey: groupMeta.storageKey, nextStore, record };
}

test('1. initializes the exact 11 official performance elements with approved Arabic titles and preserves pre-existing links', () => {
  const expectedTitles = [
    'أداء الواجبات الوظيفية.',
    'التفاعل مع المجتمع المهني.',
    'التفاعل مع أولياء الأمور.',
    'التنوع في استراتيجيات التدريس.',
    'تحسين نتائج المتعلمين.',
    'إعداد وتنفيذ خطة التعلم.',
    'توظيف تقنيات ووسائل التعلم المناسبة.',
    'تهيئة البيئة التعليمية.',
    'الإدارة الصفية.',
    'تحليل نتائج المتعلمين وتشخيص مستوياتهم.',
    'تنوع أساليب التقويم.',
  ];

  assert.equal(TEACHER_PORTFOLIO_ELEMENTS_CATALOG.length, 11);
  assert.deepEqual(
    TEACHER_PORTFOLIO_ELEMENTS_CATALOG.map((e) => e.title),
    expectedTitles
  );

  // Pre-populate legacy/existing data in maktabi_teacher_portfolio_v1 (using both el-1 alias and element-4)
  const storage = createMemoryStorage({
    [TEACHER_PORTFOLIO_STORAGE_KEY]: JSON.stringify({
      elements: {
        'el-1': {
          title: 'عنوان قديم',
          linkedRecords: [
            {
              sourceGroupId: 'professional-reports',
              sourceRecordId: 'trec_rep_1',
              linkedAt: '2026-01-01T00:00:00.000Z',
              note: 'ملاحظة سابقة محفوظة',
            },
          ],
        },
        'element-4': {
          title: 'التنوع في استراتيجيات التدريس.',
          evidences: [
            {
              sourceGroupId: 'plans',
              sourceRecordId: 'trec_plan_1',
            },
          ],
        },
      },
      sourceDeletionAuditLog: [
        {
          id: 'audit_old_1',
          deletedGroupId: 'meetings-visits',
          deletedRecordId: 'trec_meet_old',
          deletedRecordTitle: 'اجتماع سابق',
          unlinkedElementIds: ['element-2'],
          deletedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    }),
  });

  const initRes1 = initializeOrMigratePortfolioStore({ storage });
  assert.equal(initRes1.ok, true);
  assert.equal(initRes1.migrated, true);
  assert.equal(initRes1.backedUpPreviousRaw, true);

  // Verify all 11 elements exist with exact titles and preserved links
  for (let i = 0; i < 11; i++) {
    const elId = `element-${i + 1}`;
    assert.equal(initRes1.store.elements[elId].title, expectedTitles[i]);
  }
  assert.equal(initRes1.store.elements['element-1'].linkedRecords.length, 1);
  assert.equal(
    initRes1.store.elements['element-1'].linkedRecords[0].sourceRecordId,
    'trec_rep_1'
  );
  assert.equal(
    initRes1.store.elements['element-1'].linkedRecords[0].note,
    'ملاحظة سابقة محفوظة'
  );
  assert.equal(initRes1.store.elements['element-4'].linkedRecords.length, 1);
  assert.equal(
    initRes1.store.elements['element-4'].linkedRecords[0].sourceRecordId,
    'trec_plan_1'
  );
  assert.equal(initRes1.store.sourceDeletionAuditLog.length, 1);

  // Idempotent re-run must not duplicate links or re-migrate
  const initRes2 = initializeOrMigratePortfolioStore({ storage });
  assert.equal(initRes2.ok, true);
  assert.equal(initRes2.migrated, false);
  assert.equal(initRes2.store.elements['element-1'].linkedRecords.length, 1);
  assert.equal(initRes2.store.elements['element-4'].linkedRecords.length, 1);
});

test('2. reads eligible saved records across all 7 approved groups and filters by group and title search', () => {
  const storage = createMemoryStorage();

  // Seed 1 saved record in each of the 7 groups
  for (const grp of TEACHER_PORTFOLIO_SOURCE_GROUPS) {
    seedSavedRecordInGroup(storage, grp.groupId, {
      id: `trec_${grp.groupId}_1`,
      formId: 'test-form',
      title: `سجل معتمد في ${grp.title}`,
    });
  }

  const allEligible = listEligibleSourceRecords({ storage });
  assert.equal(allEligible.length, 7);

  // Filter by groupId: certificates
  const certOnly = listEligibleSourceRecords({
    storage,
    groupId: 'certificates',
  });
  assert.equal(certOnly.length, 1);
  assert.equal(certOnly[0].groupId, 'certificates');
  assert.equal(certOnly[0].record.id, 'trec_certificates_1');

  // Filter by searchQuery
  const searched = listEligibleSourceRecords({
    storage,
    searchQuery: 'الزيارات والتبادل',
  });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].groupId, 'peer-visits');
});

test('3. rejects linking drafts and non-eligible records strictly', () => {
  const storage = createMemoryStorage();
  initializeOrMigratePortfolioStore({ storage });

  const reportsMeta = TEACHER_PORTFOLIO_SOURCE_GROUPS.find(
    (g) => g.groupId === 'professional-reports'
  )!;
  let store = createEmptyGroupArchiveStore('professional-reports');

  // 1. Add a draft in activeDraftByFormId
  const draftRes = upsertDraftRecord(store, {
    id: 'tdraft_rep_1',
    formId: 'strategy-implementation',
    title: 'مسودة تقرير غير محفوظة',
    payload: {},
  });
  store = draftRes.nextStore;

  // 2. Add a corrupted/ineligible record in records with isPortfolioEligible = false
  store.records['trec_ineligible_1'] = {
    id: 'trec_ineligible_1',
    groupId: 'professional-reports',
    formId: 'strategy-implementation',
    title: 'سجل غير مؤهل',
    recordState: 'archived_saved',
    isPortfolioEligible: false,
    academicYear: '1447هـ',
    semester: 'الأول',
    eventDate: '1447/02/10',
    mediaRefs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payload: {},
  };
  saveGroupArchiveStore(reportsMeta.storageKey, store, storage);

  // Verify neither appears in listEligibleSourceRecords
  const eligible = listEligibleSourceRecords({ storage });
  assert.equal(eligible.length, 0);

  // Attempt to link draft -> rejected
  const linkDraft = linkRecordToPortfolioElement({
    elementId: 'element-1',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'tdraft_rep_1',
    storage,
  });
  assert.equal(linkDraft.ok, false);
  assert.equal(linkDraft.reason, 'record-is-draft');

  // Attempt to link ineligible record -> rejected
  const linkIneligible = linkRecordToPortfolioElement({
    elementId: 'element-1',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_ineligible_1',
    storage,
  });
  assert.equal(linkIneligible.ok, false);
  assert.equal(linkIneligible.reason, 'record-not-eligible');
});

test('4. links a saved record to multiple elements, prevents duplicate links in the same element, saves/updates notes, and unlinks without modifying source record', () => {
  const storage = createMemoryStorage();
  initializeOrMigratePortfolioStore({ storage });

  seedSavedRecordInGroup(storage, 'plans', {
    id: 'trec_plan_weekly_1',
    formId: 'weekly-teacher-plan',
    title: 'الخطة الأسبوعية للصف السادس',
    payload: { subject: 'الرياضيات', objectives: 'إتقان الكسور العشرية' },
  });

  // Link to element-6 with a documentation note
  const link1 = linkRecordToPortfolioElement({
    elementId: 'element-6',
    sourceGroupId: 'plans',
    sourceRecordId: 'trec_plan_weekly_1',
    note: 'توثيق إعداد خطة التعلم الأسبوعية لمادة الرياضيات',
    storage,
  });
  assert.equal(link1.ok, true);

  // Attempt duplicate link in element-6 -> rejected
  const linkDup = linkRecordToPortfolioElement({
    elementId: 'element-6',
    sourceGroupId: 'plans',
    sourceRecordId: 'trec_plan_weekly_1',
    storage,
  });
  assert.equal(linkDup.ok, false);
  assert.equal(linkDup.reason, 'already-linked');

  // Link the SAME record to element-1 -> allowed
  const link2 = linkRecordToPortfolioElement({
    elementId: 'element-1',
    sourceGroupId: 'plans',
    sourceRecordId: 'trec_plan_weekly_1',
    note: 'التزام المعلم بإعداد الخطط ضمن الواجبات الوظيفية',
    storage,
  });
  assert.equal(link2.ok, true);

  // Update note on element-6
  const updateNoteRes = updatePortfolioLinkNote({
    elementId: 'element-6',
    sourceGroupId: 'plans',
    sourceRecordId: 'trec_plan_weekly_1',
    note: 'ملاحظة توثيقية محدثة بعد المراجعة',
    storage,
  });
  assert.equal(updateNoteRes.ok, true);

  // Verify persistence across reload (re-reading from storage)
  const reloadedOverview = resolveFullPortfolioOverview({ storage });
  assert.equal(reloadedOverview.elementsWithRecordsCount, 2);
  assert.equal(reloadedOverview.totalResolvedReferencesCount, 2);
  assert.equal(reloadedOverview.uniqueLinkedSourceRecordsCount, 1);

  const el6 = reloadedOverview.elements.find((e) => e.id === 'element-6')!;
  assert.equal(el6.items[0].ref.note, 'ملاحظة توثيقية محدثة بعد المراجعة');

  // Verify zero payload duplication inside maktabi_teacher_portfolio_v1
  const rawPortfolioJson = storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!;
  assert.equal(rawPortfolioJson.includes('إتقان الكسور العشرية'), false);
  assert.equal(rawPortfolioJson.includes('الخطة الأسبوعية للصف السادس'), false);

  // Unlink from element-1 -> source record must remain intact in plans archive
  const unlinkRes = unlinkRecordFromPortfolioElement({
    elementId: 'element-1',
    sourceGroupId: 'plans',
    sourceRecordId: 'trec_plan_weekly_1',
    storage,
  });
  assert.equal(unlinkRes.ok, true);
  assert.equal(unlinkRes.unlinked, true);

  const afterUnlink = resolveFullPortfolioOverview({ storage });
  assert.equal(afterUnlink.elementsWithRecordsCount, 1);
  assert.equal(afterUnlink.totalResolvedReferencesCount, 1);

  // Source record is still in eligible records list
  const stillInArchive = listEligibleSourceRecords({
    storage,
    groupId: 'plans',
  });
  assert.equal(stillInArchive.length, 1);
  assert.equal(stillInArchive[0].record.title, 'الخطة الأسبوعية للصف السادس');
});

test('5. reflects live source record updates automatically and handles missing/deleted records + deletion audit log safely', async () => {
  const storage = createMemoryStorage();
  initializeOrMigratePortfolioStore({ storage });

  const seeded = seedSavedRecordInGroup(storage, 'programs-activities', {
    id: 'trec_init_1',
    formId: 'educational-initiative-execution',
    title: 'مبادرة القراءة الإثرائية (النسخة الأولى)',
    payload: { objectives: 'رفع طلاقة القراءة' },
  });

  linkRecordToPortfolioElement({
    elementId: 'element-5',
    sourceGroupId: 'programs-activities',
    sourceRecordId: 'trec_init_1',
    note: 'مبادرة لتحسين نتائج الطلاب في القراءة',
    storage,
  });

  // Update the source record in its original group store
  const updatedGroupStore = upsertArchivedRecord(seeded.nextStore, {
    id: 'trec_init_1',
    formId: 'educational-initiative-execution',
    title: 'مبادرة القراءة الإثرائية (النسخة المحدثة)',
    payload: { objectives: 'رفع طلاقة القراءة والفهم القرائي بنسبة 95%' },
  });
  saveGroupArchiveStore(
    seeded.storageKey,
    updatedGroupStore.nextStore,
    storage
  );

  // Portfolio immediately resolves the updated title & payload without re-linking
  const overviewAfterUpdate = resolveFullPortfolioOverview({ storage });
  const el5 = overviewAfterUpdate.elements.find((e) => e.id === 'element-5')!;
  assert.equal(
    el5.items[0].sourceRecord?.title,
    'مبادرة القراءة الإثرائية (النسخة المحدثة)'
  );

  // Test inspectRecordDeletionImpact and deleteArchivedRecordSafely compatibility
  const impact = inspectRecordDeletionImpact(
    updatedGroupStore.nextStore,
    'trec_init_1',
    { storage }
  );
  assert.equal(impact.isLinked, true);
  assert.equal(impact.linkedElements.length, 1);
  assert.equal(impact.linkedElements[0].elementId, 'element-5');
  assert.equal(
    impact.linkedElements[0].elementTitle,
    'تحسين نتائج المتعلمين.'
  );

  // Delete without confirmUnlink -> blocked
  const blockedDelete = await deleteArchivedRecordSafely(
    seeded.storageKey,
    updatedGroupStore.nextStore,
    'trec_init_1',
    { storage, confirmUnlink: false }
  );
  assert.equal(blockedDelete.result.deleted, false);
  assert.equal(blockedDelete.result.requiresConfirmation, true);

  // Delete with confirmUnlink: true -> unlinks from portfolio and appends audit log
  const confirmedDelete = await deleteArchivedRecordSafely(
    seeded.storageKey,
    updatedGroupStore.nextStore,
    'trec_init_1',
    { storage, confirmUnlink: true }
  );
  assert.equal(confirmedDelete.result.deleted, true);
  assert.deepEqual(confirmedDelete.result.unlinkedElementIds, ['element-5']);

  const overviewAfterDelete = resolveFullPortfolioOverview({ storage });
  assert.equal(overviewAfterDelete.totalResolvedReferencesCount, 0);
  assert.equal(overviewAfterDelete.deletionAuditLog.length, 1);
  assert.equal(
    overviewAfterDelete.deletionAuditLog[0].deletedRecordId,
    'trec_init_1'
  );

  // Also test orphan/missing reference when a source store loses a record externally
  const rawStore = loadPortfolioStore(storage);
  rawStore.elements['element-8'].linkedRecords.push({
    sourceGroupId: 'tests-evaluation',
    sourceRecordId: 'trec_missing_ghost_99',
    linkedAt: new Date().toISOString(),
  });
  savePortfolioStoreSafely(rawStore, storage);

  const overviewWithGhost = resolveFullPortfolioOverview({ storage });
  assert.equal(overviewWithGhost.totalMissingReferencesCount, 1);
  const el8 = overviewWithGhost.elements.find((e) => e.id === 'element-8')!;
  assert.equal(el8.items[0].status, 'missing');

  // Cleanup missing references safely
  const cleanupRes = cleanupAllMissingPortfolioReferences({ storage });
  assert.equal(cleanupRes.ok, true);
  assert.equal(cleanupRes.removedCount, 1);
  assert.equal(
    resolveFullPortfolioOverview({ storage }).totalMissingReferencesCount,
    0
  );
});

test('6. handles storage failure and rollback accurately without claiming false success, and backs up corrupted JSON', () => {
  const baseStorage = createMemoryStorage();
  initializeOrMigratePortfolioStore({ storage: baseStorage });

  seedSavedRecordInGroup(baseStorage, 'meetings-visits', {
    id: 'trec_meet_1',
    formId: 'meeting-minutes',
    title: 'محضر اجتماع لجنة التوجيه',
  });

  const okLink = linkRecordToPortfolioElement({
    elementId: 'element-2',
    sourceGroupId: 'meetings-visits',
    sourceRecordId: 'trec_meet_1',
    storage: baseStorage,
  });
  assert.equal(okLink.ok, true);

  const snapshotBeforeFailure = baseStorage.getItem(
    TEACHER_PORTFOLIO_STORAGE_KEY
  )!;

  // Create a storage wrapper that fails on the next write to TEACHER_PORTFOLIO_STORAGE_KEY
  let failWrites = true;
  const failingStorage: StorageLike = {
    getItem(k) {
      return baseStorage.getItem(k);
    },
    setItem(k, v) {
      if (k === TEACHER_PORTFOLIO_STORAGE_KEY && failWrites) {
        throw new Error('QuotaExceededError: simulated storage full');
      }
      baseStorage.setItem(k, v);
    },
    removeItem(k) {
      baseStorage.removeItem(k);
    },
  };

  const failedNoteUpdate = updatePortfolioLinkNote({
    elementId: 'element-2',
    sourceGroupId: 'meetings-visits',
    sourceRecordId: 'trec_meet_1',
    note: 'ملاحظة لن تُحفظ بسبب امتلاء المخزن',
    storage: failingStorage,
  });

  // Must NOT claim success
  assert.equal(failedNoteUpdate.ok, false);
  assert.ok(failedNoteUpdate.errorMessage?.includes('QuotaExceededError'));
  assert.equal(
    baseStorage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY),
    snapshotBeforeFailure
  );

  // Test corrupted JSON protection & backup recovery
  const corruptedStorage = createMemoryStorage({
    [TEACHER_PORTFOLIO_STORAGE_KEY]: '{invalid-json-payload',
  });
  const corruptedInspection = inspectPortfolioStorageState(corruptedStorage);
  assert.equal(corruptedInspection.exists, true);
  assert.equal(corruptedInspection.isValidJson, false);

  const corruptedInit = initializeOrMigratePortfolioStore({
    storage: corruptedStorage,
  });
  assert.equal(corruptedInit.ok, false);
  assert.equal(corruptedInit.backedUpPreviousRaw, true);
  assert.equal(
    corruptedStorage.getItem(TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY),
    '{invalid-json-payload'
  );
  // Original corrupted key was NOT silently overwritten
  assert.equal(
    corruptedStorage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY),
    '{invalid-json-payload'
  );

  // Test rollbackPortfolioFromBackup
  const rollbackStorage = createMemoryStorage({
    [TEACHER_PORTFOLIO_BACKUP_STORAGE_KEY]: snapshotBeforeFailure,
  });
  const rbRes = rollbackPortfolioFromBackup({ storage: rollbackStorage });
  assert.equal(rbRes.ok, true);
  assert.equal(rbRes.restored, true);
  assert.equal(
    rbRes.store.elements['element-2'].linkedRecords[0].sourceRecordId,
    'trec_meet_1'
  );
});

test('7. hydrates photos from IndexedDB without duplicating blobs and exports a real multi-page Unified Portfolio PDF', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  // Save a real dataUrl photo once in mediaRepo
  const sampleSvgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#2563EB"/></svg>'
  )}`;
  const savedMedia = await saveMediaDataUrl(
    {
      id: 'photo-1',
      dataUrl: sampleSvgDataUrl,
      fileName: 'evidence-1.svg',
      sourceTag: 'upload',
    },
    mediaRepo
  );

  const seededReport = seedSavedRecordInGroup(storage, 'professional-reports', {
    id: 'trec_rep_media_1',
    formId: 'strategy-implementation',
    title: 'تقرير تطبيق استراتيجية التعلم التعاوني',
    mediaRefs: [savedMedia.mediaRef],
    payload: {
      subject: 'العلوم',
      objectives: 'تنمية مهارات الاستقصاء العلمي',
      evidenceLinks: [
        { id: 'lnk-1', url: 'https://moe.gov.sa/ar/Pages/default.aspx' },
      ],
    },
  });

  // Link the same record to TWO different performance elements (element-4 and element-7)
  linkRecordToPortfolioElement({
    elementId: 'element-4',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_rep_media_1',
    note: 'تطبيق استراتيجية التعلم التعاوني في مختبر العلوم',
    storage,
  });
  linkRecordToPortfolioElement({
    elementId: 'element-7',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_rep_media_1',
    note: 'توظيف الوسائل المخبرية الرقمية أثناء التنفيذ',
    storage,
  });

  // 1. Hydrate photos for preview -> retrieves from mediaRepo without creating new blobs
  const hydrated = await hydrateLinkedRecordPhotosFromMediaRepo(
    seededReport.record,
    mediaRepo
  );
  assert.equal(hydrated.photos.length, 1);
  assert.equal(hydrated.photos[0].blobKey, savedMedia.mediaRef.blobKey);
  const allBlobKeysInRepo = await mediaRepo.listBlobKeys();
  assert.equal(allBlobKeysInRepo.length, 1);

  // 2. Verify deduplicated appendix collection -> 1 unique attachment referenced by 2 elements
  const overview = resolveFullPortfolioOverview({ storage });
  const appendix = await collectDeduplicatedPortfolioAttachments(
    overview,
    mediaRepo
  );
  assert.equal(appendix.attachments.length, 1);
  assert.deepEqual(
    appendix.attachments[0].referencedByElements.map((e) => e.number),
    [4, 7]
  );
  assert.equal(appendix.electronicLinks.length, 1);

  // 3. Generate real Unified Portfolio PDF and verify structure & page count
  const pdfResult = await generateTeacherPortfolioPdf({
    settings: {
      ...DEFAULT_SCHOOL_SETTINGS,
      userName: 'أ. محمد بن عبدالله الغامدي',
      schoolName: 'ثانوية الرواد النموذجية',
      educationDepartment: 'إدارة تعليم الرياض',
      principalName: 'أ. خالد السبيعي',
    },
    storage,
    mediaRepo,
  });

  // Must include Cover (Page 1) + Index (Page 2) + Element pages + Appendix page (>= 4 pages)
  assert.ok(pdfResult.pageCount >= 4);
  assert.equal(pdfResult.pageDescriptors[0].kind, 'cover');
  assert.equal(pdfResult.pageDescriptors[1].kind, 'index');
  assert.deepEqual(
    pdfResult.pageDescriptors[1].elementNumbersOnPage,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  );
  assert.equal(
    pdfResult.pageDescriptors[pdfResult.pageDescriptors.length - 1].kind,
    'appendix'
  );
  assert.equal(pdfResult.deduplicatedAttachmentsCount, 1);
  assert.equal(pdfResult.deduplicatedLinksCount, 1);
  assert.equal(pdfResult.linkAnnotationsCount, 1);

  // Verify valid PDF 1.4 header and EOF trailer
  const pdfHeader = new TextDecoder().decode(pdfResult.pdfBytes.slice(0, 8));
  assert.equal(pdfHeader.startsWith('%PDF-1.4'), true);
  const pdfTail = new TextDecoder().decode(
    pdfResult.pdfBytes.slice(pdfResult.pdfBytes.length - 32)
  );
  assert.equal(pdfTail.includes('%%EOF'), true);
});

test('8. creates multiple standalone evidences inside elements with zero records in Groups 1-7 and enforces validation only on final save', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  // Confirm Groups 1-7 have zero records
  assert.equal(listEligibleSourceRecords({ storage }).length, 0);

  // Validation rejects missing title / description on final save
  const emptyInput = createEmptyStandaloneEvidenceInput(DEFAULT_SCHOOL_SETTINGS);
  const checkEmpty = validateStandalonePortfolioEvidence(emptyInput);
  assert.equal(checkEmpty.valid, false);
  assert.ok(checkEmpty.errors.title);
  assert.ok(checkEmpty.errors.description);

  const failedSave = await saveStandaloneEvidenceToElement({
    elementId: 'element-3',
    formData: emptyInput,
    storage,
    mediaRepo,
  });
  assert.equal(failedSave.ok, false);
  assert.ok(failedSave.validationErrors?.title);
  assert.ok(failedSave.validationErrors?.description);

  // Optional fields (executionDate, targetAudience, impact, photos, links) may remain empty
  const saveMinimal = await saveStandaloneEvidenceToElement({
    elementId: 'element-3',
    formData: {
      ...emptyInput,
      evidenceType: 'communication',
      title: 'لقاء فردي مع ولي أمر طالب',
      description: 'تم التواصل ومناقشة خطة رفع التحصيل الدراسي للطالب.',
    },
    storage,
    mediaRepo,
  });
  assert.equal(saveMinimal.ok, true);
  assert.equal(saveMinimal.isNew, true);
  assert.ok(saveMinimal.evidence?.id);

  // Add a second full standalone evidence inside the SAME element-3
  const saveSecond = await saveStandaloneEvidenceToElement({
    elementId: 'element-3',
    formData: {
      ...emptyInput,
      evidenceType: 'report',
      title: 'تقرير إرسال الخطط الأسبوعية لأولياء الأمور',
      executionDate: '1447/04/10',
      targetAudience: 'أولياء أمور الصف الرابع',
      description: 'إشعار أولياء الأمور أسبوعيًا بالواجبات والاختبارات القصيرة.',
      impact: 'ارتفاع متابعة الواجبات المنزلية بنسبة ملحوظة.',
      evidenceLinks: [
        { id: 'lnk-st-1', url: 'https://madrasati.sa/parent-portal' },
      ],
    },
    storage,
    mediaRepo,
  });
  assert.equal(saveSecond.ok, true);

  // Add another standalone evidence to element-9
  const saveEl9 = await saveStandaloneEvidenceToElement({
    elementId: 'element-9',
    formData: {
      ...emptyInput,
      evidenceType: 'practice',
      title: 'ميثاق القواعد الصفية التشاركي',
      description: 'بناء قواعد الانضباط الصفي بمشاركة الطلاب في الأسبوع الأول.',
    },
    storage,
    mediaRepo,
  });
  assert.equal(saveEl9.ok, true);

  // Reload overview cleanly from storage
  const overview = resolveFullPortfolioOverview({ storage });
  assert.equal(overview.elementsWithRecordsCount, 2);
  assert.equal(overview.totalResolvedReferencesCount, 0);
  assert.equal(overview.totalStandaloneEvidencesCount, 3);
  assert.equal(overview.totalCombinedEvidencesCount, 3);

  const el3 = overview.elements.find((e) => e.id === 'element-3')!;
  assert.equal(el3.hasAnyEvidences, true);
  assert.equal(el3.standaloneEvidencesCount, 2);
  assert.equal(el3.totalEvidencesCount, 2);
  assert.equal(el3.organizationalStatusLabel, 'توجد شواهد موثقة');
});

test('9. eliminates standalone drafts completely while preserving Group 8 data, supports in-place editing with immutable id/createdAt, and cleans staged blobs on exit', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  // Seed legacy Group 8 record & a legacy pre-closure store that happened to have standaloneDraftsByElementId
  seedSavedRecordInGroup(storage, 'professional-reports', {
    id: 'trec_grp8_keep',
    formId: 'strategy-implementation',
    title: 'سجل مجموعة ٨ المعتمد',
  });

  const legacyStoreWithDraft = {
    schemaVersion: 1,
    elements: {
      'element-1': {
        id: 'element-1',
        number: 1,
        title: 'أداء الواجبات الوظيفية.',
        linkedRecords: [
          {
            sourceGroupId: 'professional-reports',
            sourceRecordId: 'trec_grp8_keep',
            note: 'ملاحظة مجموعة ٨',
            linkedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        standaloneEvidences: [],
      },
    },
    standaloneDraftsByElementId: {
      'element-8': {
        elementId: 'element-8',
        evidenceType: 'activity',
        title: 'مسودة قديمة مهجورة',
        executionDate: '',
        targetAudience: '',
        description: '',
        impact: '',
        academicYear: '1447هـ',
        semester: 'الأول',
        mediaRefs: [],
        evidenceLinks: [],
        recordState: 'draft',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    },
    sourceDeletionAuditLog: [],
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
  storage.setItem(
    TEACHER_PORTFOLIO_STORAGE_KEY,
    JSON.stringify(legacyStoreWithDraft)
  );

  // Initialize/migrate: removes standaloneDraftsByElementId while keeping Group 8 linkedRecords intact
  const initRes = initializeOrMigratePortfolioStore({ storage });
  assert.equal(initRes.ok, true);
  const rawAfter = JSON.parse(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!);
  assert.equal('standaloneDraftsByElementId' in rawAfter, false);

  const overviewMigrated = resolveFullPortfolioOverview({ storage });
  assert.equal(overviewMigrated.totalResolvedReferencesCount, 1);
  assert.equal(
    overviewMigrated.elements[0].items[0].ref.note,
    'ملاحظة مجموعة ٨'
  );
  assert.equal(overviewMigrated.totalStandaloneEvidencesCount, 0);

  // Create standalone evidence with photo A, then edit in-place swapping photo A -> photo B
  const svgA = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#0F766E"/></svg>'
  )}`;
  const svgB = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#1D4ED8"/></svg>'
  )}`;
  const svgStagedAbandoned = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#B45309"/></svg>'
  )}`;

  const created = await saveStandaloneEvidenceToElement({
    elementId: 'element-8',
    formData: {
      evidenceType: 'activity',
      title: 'تهيئة ركن القراءة الصفي',
      executionDate: '1447/05/01',
      targetAudience: 'طلاب الصف الثالث',
      description: 'ترتيب الركن وتزويده بقصص مناسبة للمرحلة.',
      impact: 'إقبال الطلاب على القراءة الحرة.',
      evidencePhotos: [{ id: 'p-a', imageDataUrl: svgA }],
      evidenceLinks: [{ id: 'l-1', url: 'https://example.org/v1' }],
    },
    storage,
    mediaRepo,
  });
  assert.equal(created.ok, true);
  assert.equal(created.isNew, true);
  const originalId = created.evidence!.id;
  const originalCreatedAt = created.evidence!.createdAt;
  assert.equal((await mediaRepo.listBlobKeys()).length, 1);

  // Edit the SAME evidence explicitly via editingEvidenceId and swap photo A -> photo B
  const loadedForEdit = await loadStandaloneEvidenceWithMedia({
    elementId: 'element-8',
    evidenceId: originalId,
    storage,
    mediaRepo,
  });
  assert.ok(loadedForEdit);

  const edited = await saveStandaloneEvidenceToElement({
    elementId: 'element-8',
    editingEvidenceId: originalId,
    formData: {
      ...loadedForEdit.formData,
      title: 'تهيئة ركن القراءة الصفي (نسخة محدثة)',
      description: 'تحديث وتوسيع ركن القراءة وإضافة سجل متابعة أسبوعي.',
      evidencePhotos: [{ id: 'p-b', imageDataUrl: svgB }],
      evidenceLinks: [{ id: 'l-1', url: 'https://example.org/v2' }],
    },
    storage,
    mediaRepo,
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.isNew, false);
  // Strict in-place update: immutable ID & createdAt, zero duplicate copy
  assert.equal(edited.evidence!.id, originalId);
  assert.equal(edited.evidence!.createdAt, originalCreatedAt);

  const el8After = resolveFullPortfolioOverview({ storage }).elements.find(
    (e) => e.id === 'element-8'
  )!;
  assert.equal(el8After.standaloneEvidencesCount, 1);
  assert.equal(
    el8After.standaloneEvidences[0].evidence.title,
    'تهيئة ركن القراءة الصفي (نسخة محدثة)'
  );
  // Old unreferenced photo A blob was deleted when replaced by photo B -> still 1 blob in repo
  assert.equal((await mediaRepo.listBlobKeys()).length, 1);

  // Staged photo from an abandoned unsaved form is cleaned up safely if unreferenced, while saved photo B remains
  const savedStaged = await saveMediaDataUrl(
    { dataUrl: svgStagedAbandoned, fileName: 'abandoned.svg' },
    mediaRepo
  );
  assert.equal((await mediaRepo.listBlobKeys()).length, 2);
  const cleaned = await cleanupUnreferencedStagedPhotoDataUrls(
    [svgStagedAbandoned, svgB],
    { storage, mediaRepo }
  );
  assert.equal(cleaned.includes(savedStaged.mediaRef.blobKey), true);
  assert.equal((await mediaRepo.listBlobKeys()).length, 1);
});

test('10. combines linked Group 1-7 records and standalone evidences cleanly, supports note editing, unlinking without touching source archive, and safe deletion', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  seedSavedRecordInGroup(storage, 'professional-reports', {
    id: 'trec_mix_1',
    formId: 'strategy-implementation',
    title: 'تقرير استراتيجية الصف المقلوب',
  });
  linkRecordToPortfolioElement({
    elementId: 'element-4',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_mix_1',
    note: 'تطبيق عملي في مادة العلوم',
    storage,
  });

  const noteUpd = updatePortfolioLinkNote({
    elementId: 'element-4',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_mix_1',
    note: 'ملاحظة محدثة لاستراتيجية الصف المقلوب',
    storage,
  });
  assert.equal(noteUpd.ok, true);

  const savedSt = await saveStandaloneEvidenceToElement({
    elementId: 'element-4',
    formData: {
      evidenceType: 'practice',
      title: 'ورقة عمل تفاعلية قبل التعديل',
      executionDate: '1447/04/18',
      targetAudience: 'الصف الخامس',
      description: 'تنفيذ تعلم بالمحطات العلمية.',
      impact: 'مشاركة 90% من الطلاب.',
      evidencePhotos: [],
      evidenceLinks: [],
    },
    storage,
    mediaRepo,
  });
  assert.equal(savedSt.ok, true);

  const mixedOverview = resolveFullPortfolioOverview({ storage });
  const el4 = mixedOverview.elements.find((e) => e.id === 'element-4')!;
  assert.equal(el4.resolvedLinksCount, 1);
  assert.equal(el4.standaloneEvidencesCount, 1);
  assert.equal(el4.totalEvidencesCount, 2);
  assert.equal(el4.items[0].ref.note, 'ملاحظة محدثة لاستراتيجية الصف المقلوب');

  // Delete standalone evidence safely -> linked record & Group 1 archive remain intact
  const delRes = await deleteStandaloneEvidenceFromElement({
    elementId: 'element-4',
    evidenceId: savedSt.evidence!.id,
    storage,
    mediaRepo,
  });
  assert.equal(delRes.ok, true);
  assert.equal(delRes.deleted, true);

  // Unlink Group 1 record -> source record remains intact in Group 1
  const unlinkRes = unlinkRecordFromPortfolioElement({
    elementId: 'element-4',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_mix_1',
    storage,
  });
  assert.equal(unlinkRes.ok, true);
  assert.equal(listEligibleSourceRecords({ storage }).length, 1);
});

test('11. verifies full shared-image SHA-256 lifecycle across Group 1-7 record deletion and subsequent Group 9 standalone deletion', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  const sharedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#1D4ED8"/></svg>'
  )}`;

  const savedMedia = await saveMediaDataUrl(
    {
      id: 'shared-1',
      dataUrl: sharedSvg,
      fileName: 'shared-photo.svg',
      sourceTag: 'upload',
    },
    mediaRepo
  );

  // 1. Seed Group 1 record with the photo
  const grp1 = seedSavedRecordInGroup(storage, 'professional-reports', {
    id: 'trec_shared_grp1',
    formId: 'strategy-implementation',
    title: 'سجل مجموعة ١ بصورة مشتركة',
    mediaRefs: [savedMedia.mediaRef],
  });

  // 2. Save Group 9 standalone evidence in element-7 using the EXACT SAME photo
  const stRes = await saveStandaloneEvidenceToElement({
    elementId: 'element-7',
    formData: {
      evidenceType: 'practice',
      title: 'شاهد تقني بصورة مشتركة',
      executionDate: '',
      targetAudience: '',
      description: 'توظيف السبورة التفاعلية.',
      impact: '',
      evidencePhotos: [{ id: 'st-p1', imageDataUrl: sharedSvg }],
      evidenceLinks: [],
    },
    storage,
    mediaRepo,
  });
  assert.equal(stRes.ok, true);

  // Identical SHA-256 -> stored ONCE in IndexedDB
  assert.equal(
    stRes.evidence!.mediaRefs[0].contentSha256,
    savedMedia.mediaRef.contentSha256
  );
  assert.equal(stRes.evidence!.mediaRefs[0].blobKey, savedMedia.mediaRef.blobKey);
  assert.equal((await mediaRepo.listBlobKeys()).length, 1);

  // 3. Delete original Group 1 record safely -> blob MUST BE PRESERVED for Group 9 standalone evidence
  const grp1Del = await deleteArchivedRecordSafely(
    grp1.storageKey,
    grp1.nextStore,
    'trec_shared_grp1',
    {
      storage,
      mediaRepo,
      confirmUnlink: true,
    }
  );
  assert.equal(grp1Del.result.deleted, true);
  assert.equal(
    grp1Del.result.preservedSharedBlobKeys.includes(savedMedia.mediaRef.blobKey),
    true
  );
  assert.equal((await mediaRepo.listBlobKeys()).length, 1);

  // 4. Verify image remains valid & displayable inside the standalone evidence
  const blobCheck = await loadMediaBlobWithIntegrityCheck(
    savedMedia.mediaRef.blobKey,
    stRes.evidence!.mediaRefs[0],
    mediaRepo
  );
  assert.equal(blobCheck.ok, true);
  const reloadedStandalone = await loadStandaloneEvidenceWithMedia({
    elementId: 'element-7',
    evidenceId: stRes.evidence!.id,
    storage,
    mediaRepo,
  });
  assert.ok(reloadedStandalone);
  assert.equal(reloadedStandalone.integrityWarnings.length, 0);
  assert.equal(reloadedStandalone.photos.length, 1);
  assert.equal(
    reloadedStandalone.photos[0].blobKey,
    savedMedia.mediaRef.blobKey
  );

  // 5. Delete Group 9 standalone evidence -> zero refs remain globally -> blob deleted cleanly
  const stDel = await deleteStandaloneEvidenceFromElement({
    elementId: 'element-7',
    evidenceId: stRes.evidence!.id,
    storage,
    mediaRepo,
  });
  assert.equal(stDel.ok, true);
  assert.equal(
    stDel.removedBlobKeys.includes(savedMedia.mediaRef.blobKey),
    true
  );
  assert.equal((await mediaRepo.listBlobKeys()).length, 0);
});

test('12. generates dense mixed PDF with multiple groups, standalone evidences, shared deduplicated photos, long texts, multi-page overflow, and atomic QuotaExceededError rollback', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  const sharedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#0F766E"/></svg>'
  )}`;
  const standaloneOnlySvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#2563EB"/></svg>'
  )}`;
  const sharedSaved = await saveMediaDataUrl(
    { id: 'dense-shared', dataUrl: sharedSvg, fileName: 'shared.svg' },
    mediaRepo
  );

  // Seed linked records from Group 1 (professional-reports) AND Group 3 (meetings)
  for (let i = 1; i <= 2; i++) {
    seedSavedRecordInGroup(storage, 'professional-reports', {
      id: `trec_dense_${i}`,
      formId: 'strategy-implementation',
      title: `سجل مرتبط رقم ${i} لتنوع استراتيجيات التدريس الحديثة`,
      mediaRefs: i === 1 ? [sharedSaved.mediaRef] : [],
      payload: {
        subject: 'لغتي الجميلة',
        objectives:
          'تطبيق استراتيجيات التعلم النشط والتعلم التعاوني بفاعلية مع مراعاة الفروق الفردية بين المتعلمين داخل الصف.',
        results: 'ارتفاع دافعية المتعلمين وتحسن نواتج التعلم الصفية بصورة مستمرة.',
        evidenceLinks: [{ id: `gl-${i}`, url: `https://example.com/linked-${i}` }],
      },
    });
    linkRecordToPortfolioElement({
      elementId: 'element-4',
      sourceGroupId: 'professional-reports',
      sourceRecordId: `trec_dense_${i}`,
      note: 'شاهد مرتبط من التقارير المهنية في عنصر ٤',
      storage,
    });
  }

  seedSavedRecordInGroup(storage, 'meetings-visits', {
    id: 'trec_dense_meeting_1',
    formId: 'meeting-minutes',
    title: 'محضر اجتماع لجنة التطوير التربوي ومراجعة خطط التعلم',
    payload: {
      meetingTitle: 'اجتماع الفريق التعليمي الأول',
      summary: 'مناقشة آليات رفع التحصيل الدراسي وبرامج الدعم.',
    },
  });
  linkRecordToPortfolioElement({
    elementId: 'element-1',
    sourceGroupId: 'meetings-visits',
    sourceRecordId: 'trec_dense_meeting_1',
    note: 'محضر مرتبط بعنصر أداء الواجبات الوظيفية',
    storage,
  });

  // Add 8 standalone evidences inside element-4 (long Arabic texts + shared photo + standalone photo + QR links)
  for (let j = 1; j <= 8; j++) {
    await saveStandaloneEvidenceToElement({
      elementId: 'element-4',
      formData: {
        evidenceType: j % 2 === 0 ? 'report' : 'practice',
        title: `شاهد مستقل رقم ${j} حول تنوع استراتيجيات التدريس النشط والتعلم التعاوني الصفي`,
        executionDate: `1447/05/0${j}`,
        targetAudience: 'طلاب الصف السادس الابتدائي',
        description:
          'تم تنفيذ سلسلة من الأنشطة الصفية التفاعلية عبر تقسيم الطلاب إلى مجموعات متباينة القدرات، وتوظيف بطاقات التفكير الناقد والاستقصاء الموجه مع متابعة فورية لإتقان المهارات الأساسية وتقديم التغذية الراجعة الفردية لكل متعلم.',
        impact:
          'تحسن ملموس في إتقان المهارات الأساسية ومشاركة جميع الطلاب في الأنشطة الصفية ورفع مستوى الدافعية نحو التعلم الذاتي.',
        evidencePhotos:
          j === 1
            ? [{ id: 'st-shared-1', imageDataUrl: sharedSvg }]
            : j === 2
              ? [{ id: 'st-uniq-2', imageDataUrl: standaloneOnlySvg }]
              : [],
        evidenceLinks:
          j <= 6
            ? [{ id: `sl-${j}`, url: `https://example.com/standalone-${j}` }]
            : [],
      },
      storage,
      mediaRepo,
    });
  }

  const overview = resolveFullPortfolioOverview({ storage });
  assert.equal(overview.totalResolvedReferencesCount, 3);
  assert.equal(overview.totalStandaloneEvidencesCount, 8);
  assert.equal(overview.totalCombinedEvidencesCount, 11);

  // Verify shared image deduplication in Appendix (2 unique photos total: sharedSvg + standaloneOnlySvg)
  const appendixCheck = await collectDeduplicatedPortfolioAttachments(
    overview,
    mediaRepo
  );
  assert.equal(appendixCheck.attachments.length, 2);
  const sharedAtt = appendixCheck.attachments.find(
    (a) => a.blobKey === sharedSaved.mediaRef.blobKey
  );
  assert.ok(sharedAtt);
  // Referenced by both Group 1 record and Group 9 standalone evidence, yet included ONCE
  assert.equal(sharedAtt.sourceRecordTitles.length >= 2, true);

  const pdfRes = await generateTeacherPortfolioPdf({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Verify element-4 spans >=2 pages cleanly
  const elementPagesWithEl4 = pdfRes.pageDescriptors.filter(
    (d) => d.kind === 'elements' && d.elementNumbersOnPage.includes(4)
  );
  assert.ok(
    elementPagesWithEl4.length >= 2,
    `Expected element-4 to span >=2 pages, got ${elementPagesWithEl4.length}`
  );

  // Verify all 8 links (2 linked + 6 standalone) were paginated cleanly across 2 appendix pages
  assert.equal(pdfRes.deduplicatedAttachmentsCount, 2);
  assert.equal(pdfRes.deduplicatedLinksCount, 8);
  assert.equal(pdfRes.linkAnnotationsCount, 8);
  const appendixPages = pdfRes.pageDescriptors.filter(
    (d) => d.kind === 'appendix'
  );
  assert.equal(appendixPages.length, 2);

  // Verify valid PDF header + %%EOF trailer
  const pdfHeader = new TextDecoder().decode(pdfRes.pdfBytes.slice(0, 8));
  const pdfTail = new TextDecoder().decode(pdfRes.pdfBytes.slice(-64));
  assert.equal(pdfHeader.startsWith('%PDF-1.4'), true);
  assert.equal(pdfTail.includes('%%EOF'), true);

  // Verify QuotaExceededError rollback on standalone save
  const snapshotBefore = storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!;
  const failingStorage: StorageLike = {
    getItem: (k) => storage.getItem(k),
    setItem: (k, v) => {
      if (k === TEACHER_PORTFOLIO_STORAGE_KEY) {
        throw new Error('QuotaExceededError: full');
      }
      storage.setItem(k, v);
    },
    removeItem: (k) => storage.removeItem(k),
  };

  const failedQuota = await saveStandaloneEvidenceToElement({
    elementId: 'element-1',
    formData: {
      evidenceType: 'general',
      title: 'شاهد لن يحفظ',
      executionDate: '',
      targetAudience: '',
      description: 'وصف اختبار امتلاء المخزن.',
      impact: '',
      evidencePhotos: [],
      evidenceLinks: [],
    },
    storage: failingStorage,
    mediaRepo,
  });
  assert.equal(failedQuota.ok, false);
  assert.equal(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY), snapshotBefore);
});

const SAMPLE_OFFICIAL_SETTINGS = {
  ...DEFAULT_SCHOOL_SETTINGS,
  educationDepartment: 'الإدارة العامة للتعليم بمنطقة الباحة',
  schoolName: 'متوسطة الملك عبدالعزيز بقلوة',
  userName: 'إبراهيم غرم الله الغامدي',
  principalName: 'سعدالله سعيد الزهراني',
  academicYear: '1448-1449',
};

test('13. enforces official MOE weights (total 100%) and generates strictly 2 pages for an empty portfolio with zero forbidden terms or footers', async () => {
  // Verify official 11 MOE weights
  assert.equal(TEACHER_PORTFOLIO_ELEMENTS_CATALOG.length, 11);
  const totalWeight = TEACHER_PORTFOLIO_ELEMENTS_CATALOG.reduce(
    (sum, el) => sum + el.weightPercent,
    0
  );
  assert.equal(totalWeight, 100);
  assert.equal(
    TEACHER_PORTFOLIO_ELEMENTS_CATALOG.find((e) => e.number === 8)
      ?.weightPercent,
    5
  );
  assert.equal(
    TEACHER_PORTFOLIO_ELEMENTS_CATALOG.find((e) => e.number === 9)
      ?.weightPercent,
    5
  );
  for (const num of [1, 2, 3, 4, 5, 6, 7, 10, 11]) {
    assert.equal(
      TEACHER_PORTFOLIO_ELEMENTS_CATALOG.find((e) => e.number === num)
        ?.weightPercent,
      10
    );
  }

  // Case 1: Completely empty portfolio -> strictly 2 pages (Cover + Evaluation Card)
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  const pdfRes = await generateTeacherPortfolioPdf({
    settings: SAMPLE_OFFICIAL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(pdfRes.pageCount, 2);
  assert.equal(pdfRes.pageDescriptors.length, 2);
  assert.equal(pdfRes.pageDescriptors[0].kind, 'cover');
  assert.equal(pdfRes.pageDescriptors[1].kind, 'index');
  assert.equal(
    pdfRes.pageDescriptors[1].title,
    'بطاقة تقييم عناصر الأداء الوظيفي'
  );
  assert.equal(
    pdfRes.pageDescriptors.some((d) => d.kind === 'elements'),
    false
  );
  assert.equal(
    pdfRes.pageDescriptors.some((d) => d.kind === 'appendix'),
    false
  );

  // Verify Cover Page text contains ONLY required identity fields and NO forbidden clutter
  const coverText = pdfRes.renderedTextsByPage[0];
  assert.ok(coverText.includes('ملف شواهد أداء المعلم الموحد'));
  assert.ok(coverText.includes('العام الدراسي'));
  assert.ok(coverText.includes('1448-1449'));
  assert.ok(coverText.includes('المعلم'));
  assert.ok(coverText.includes('إبراهيم غرم الله الغامدي'));
  assert.ok(coverText.includes('اسم المدرسة'));
  assert.ok(coverText.includes('متوسطة الملك عبدالعزيز بقلوة'));
  assert.ok(coverText.includes('مدير المدرسة'));
  assert.ok(coverText.includes('سعدالله سعيد الزهراني'));
  assert.equal(coverText.includes('اسم المعلم'), false);
  assert.equal(coverText.includes('اسم مدير المدرسة'), false);
  assert.equal(coverText.includes('التوقيع'), false);
  assert.equal(coverText.includes('تاريخ إصدار'), false);
  assert.equal(coverText.includes('إجمالي الشواهد'), false);

  // Verify female gender mode renders «المعلمة» and «مديرة المدرسة» without «اسم»
  const femalePdfRes = await generateTeacherPortfolioPdf({
    settings: {
      ...SAMPLE_OFFICIAL_SETTINGS,
      gender: 'female',
      userName: 'نورة عبدالله الغامدي',
      principalName: 'سارة محمد الزهراني',
    },
    storage,
    mediaRepo,
  });
  const femaleCoverText = femalePdfRes.renderedTextsByPage[0];
  assert.ok(femaleCoverText.includes('المعلمة'));
  assert.ok(femaleCoverText.includes('نورة عبدالله الغامدي'));
  assert.ok(femaleCoverText.includes('اسم المدرسة'));
  assert.ok(femaleCoverText.includes('مديرة المدرسة'));
  assert.ok(femaleCoverText.includes('سارة محمد الزهراني'));
  assert.equal(femaleCoverText.includes('اسم المعلمة'), false);
  assert.equal(femaleCoverText.includes('اسم مديرة المدرسة'), false);

  // Verify Page 2 contains Evaluation Card title, 3 columns, all 11 elements, and 100% total
  const evalCardText = pdfRes.renderedTextsByPage[1];
  assert.ok(evalCardText.includes('بطاقة تقييم عناصر الأداء الوظيفي'));
  assert.ok(evalCardText.includes('اسم العنصر'));
  assert.ok(evalCardText.includes('الوزن'));
  assert.ok(evalCardText.includes('10%'));
  assert.ok(evalCardText.includes('5%'));
  assert.ok(evalCardText.includes('100%'));
  assert.equal(evalCardText.includes('عدد الشواهد'), false);
  assert.equal(evalCardText.includes('الحالة التنظيمية'), false);

  // Strict forbidden terms & zero-footer check across ALL pages
  const allText = pdfRes.renderedTextsByPage.join('\n');
  assert.equal(/مرتبط/.test(allText), false);
  assert.equal(/مستقل/.test(allText), false);
  assert.equal(allText.includes('لا توجد شواهد'), false);
  assert.equal(allText.includes('صفحة'), false);

  // Valid PDF binary
  const pdfHeader = new TextDecoder().decode(pdfRes.pdfBytes.slice(0, 8));
  const pdfTail = new TextDecoder().decode(pdfRes.pdfBytes.slice(-32));
  assert.equal(pdfHeader.startsWith('%PDF-1.4'), true);
  assert.equal(pdfTail.includes('%%EOF'), true);
});

test('14. generates strictly 3 pages for a single evidence without media or links and skips all 10 empty elements', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  const saveRes = await saveStandaloneEvidenceToElement({
    elementId: 'element-6',
    formData: {
      evidenceType: 'practice',
      title: 'توثيق تنفيذ الخطة الفصلية لمادة الرياضيات',
      executionDate: '1448/02/14',
      targetAudience: 'طلاب الصف الثاني المتوسط',
      description:
        'إعداد الخطة الفصلية وفق توزيع المنهج المعتمد ومتابعة إنجاز الدروس أسبوعياً مع توثيق الفاقد التعليمي.',
      impact: 'انتظام سير الخطة الدراسية بنسبة 100% وتحسن أداء الطلاب.',
      evidencePhotos: [],
      evidenceLinks: [],
    },
    storage,
    mediaRepo,
  });
  assert.equal(saveRes.ok, true);

  const pdfRes = await generateTeacherPortfolioPdf({
    settings: SAMPLE_OFFICIAL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(pdfRes.pageCount, 3);
  assert.deepEqual(
    pdfRes.pageDescriptors.map((d) => d.kind),
    ['cover', 'index', 'elements']
  );
  assert.deepEqual(pdfRes.pageDescriptors[2].elementNumbersOnPage, [6]);

  const allText = pdfRes.renderedTextsByPage.join('\n');
  assert.ok(allText.includes('العنصر (6): إعداد وتنفيذ خطة التعلم'));
  assert.ok(allText.includes('توثيق تنفيذ الخطة الفصلية لمادة الرياضيات'));
  assert.equal(/مرتبط/.test(allText), false);
  assert.equal(/مستقل/.test(allText), false);
  assert.equal(allText.includes('لا توجد شواهد'), false);
  assert.equal(allText.includes('صفحة'), false);
});

test('15. auto-flows evidences across multiple elements (1, 4, 10) in exact order while skipping all empty elements', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  seedSavedRecordInGroup(storage, 'professional-reports', {
    id: 'trec_multi_1',
    formId: 'strategy-implementation',
    title: 'تقرير تطبيق استراتيجية التعلم النشط',
    payload: {
      subject: 'العلوم',
      objectives: 'تعزيز الاستقصاء العلمي والتفكير الناقد لدى الطلاب.',
    },
  });
  linkRecordToPortfolioElement({
    elementId: 'element-4',
    sourceGroupId: 'professional-reports',
    sourceRecordId: 'trec_multi_1',
    note: 'تم التنفيذ في مختبر العلوم بمشاركة كاملة.',
    storage,
  });

  await saveStandaloneEvidenceToElement({
    elementId: 'element-1',
    formData: {
      evidenceType: 'report',
      title: 'الالتزام بالحضور والمناوبة المدرسية',
      executionDate: '1448/01/20',
      targetAudience: 'المجتمع المدرسي',
      description: 'الالتزام بالحضور المبكر وتنفيذ مهام الإشراف اليومي بدقة.',
      impact: 'انضباط بيئة المدرسة وسلامة الطلاب.',
      evidencePhotos: [],
      evidenceLinks: [],
    },
    storage,
    mediaRepo,
  });

  await saveStandaloneEvidenceToElement({
    elementId: 'element-10',
    formData: {
      evidenceType: 'evaluation',
      title: 'تحليل نتائج الاختبار التشخيصي للفصل الأول',
      executionDate: '1448/02/05',
      targetAudience: 'طلاب الصف الأول المتوسط',
      description: 'تحليل إجابات الطلاب وتصنيف مستويات الإتقان وبناء خطة علاجية.',
      impact: 'رفع متوسط درجات الفئة المستهدفة في الاختبار البعدي.',
      evidencePhotos: [],
      evidenceLinks: [],
    },
    storage,
    mediaRepo,
  });

  const pdfRes = await generateTeacherPortfolioPdf({
    settings: SAMPLE_OFFICIAL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Compact evidences across 3 elements flow smoothly without creating 1 page per element or appendix
  const elementPages = pdfRes.pageDescriptors.filter(
    (d) => d.kind === 'elements'
  );
  assert.ok(elementPages.length >= 1);
  assert.equal(
    pdfRes.pageDescriptors.some((d) => d.kind === 'appendix'),
    false
  );

  const renderedElementsOrder = elementPages.flatMap(
    (p) => p.elementNumbersOnPage
  );
  const uniqueRenderedOrder = Array.from(new Set(renderedElementsOrder));
  assert.deepEqual(uniqueRenderedOrder, [1, 4, 10]);

  const allText = pdfRes.renderedTextsByPage.join('\n');
  assert.equal(/مرتبط/.test(allText), false);
  assert.equal(/مستقل/.test(allText), false);
  assert.equal(allText.includes('لا توجد شواهد'), false);
  assert.equal(allText.includes('صفحة'), false);
});

test('16. builds deduplicated appendix ONLY when photos or links exist with clean captions free of forbidden words', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  const landscapeSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#16445B"/></svg>'
  )}`;
  const portraitSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="750"><rect width="400" height="750" fill="#2E9398"/></svg>'
  )}`;
  const squareSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="#38A098"/></svg>'
  )}`;

  const savedLandscape = await saveMediaDataUrl(
    { id: 'img-land', dataUrl: landscapeSvg, fileName: 'landscape.svg' },
    mediaRepo
  );
  const savedSquare = await saveMediaDataUrl(
    { id: 'img-sq', dataUrl: squareSvg, fileName: 'square.svg' },
    mediaRepo
  );

  seedSavedRecordInGroup(storage, 'programs-activities', {
    id: 'trec_prog_photos',
    formId: 'educational-initiative-execution',
    title: 'برنامج التميز القرائي',
    mediaRefs: [savedLandscape.mediaRef, savedSquare.mediaRef],
    payload: {
      objectives: 'رفع مستوى الفهم القرائي لدى الطلاب.',
      evidenceLinks: [{ id: 'lnk-p1', url: 'https://moe.gov.sa/reading' }],
    },
  });
  linkRecordToPortfolioElement({
    elementId: 'element-5',
    sourceGroupId: 'programs-activities',
    sourceRecordId: 'trec_prog_photos',
    storage,
  });

  await saveStandaloneEvidenceToElement({
    elementId: 'element-7',
    formData: {
      evidenceType: 'activity',
      title: 'توظيف المنصة الرقمية في المعمل',
      executionDate: '1448/03/10',
      targetAudience: 'الصف الثالث المتوسط',
      description: 'استخدام الوسائل الرقمية التفاعلية في عرض الدروس العملية.',
      impact: 'تفاعل مرتفع وإتقان سريع للمفاهيم العلمية.',
      evidencePhotos: [
        { id: 'p-dup', imageDataUrl: landscapeSvg },
        { id: 'p-port', imageDataUrl: portraitSvg },
      ],
      evidenceLinks: [{ id: 'lnk-p2', url: 'https://madrasati.sa/lab-guide' }],
    },
    storage,
    mediaRepo,
  });

  const pdfRes = await generateTeacherPortfolioPdf({
    settings: SAMPLE_OFFICIAL_SETTINGS,
    storage,
    mediaRepo,
  });

  // 3 unique photos (landscapeSvg deduplicated across element 5 & 7, plus squareSvg & portraitSvg) + 2 unique links
  assert.equal(pdfRes.deduplicatedAttachmentsCount, 3);
  assert.equal(pdfRes.deduplicatedLinksCount, 2);
  assert.equal(pdfRes.linkAnnotationsCount, 2);

  const appendixPages = pdfRes.pageDescriptors.filter(
    (d) => d.kind === 'appendix'
  );
  assert.ok(appendixPages.length >= 1);

  const allText = pdfRes.renderedTextsByPage.join('\n');
  assert.ok(allText.includes('ملحق الصور والمرفقات'));
  assert.ok(allText.includes('العناصر المشمولة'));
  assert.equal(/مرتبط/.test(allText), false);
  assert.equal(/مستقل/.test(allText), false);
  assert.equal(allText.includes('معرف المرفق الفريد'), false);
  assert.equal(allText.includes('صفحة'), false);
});

test('17. preserves ultra-long Arabic evidence descriptions completely across continuation cards without truncation', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  initializeOrMigratePortfolioStore({ storage });

  const repeatedParagraph =
    'تم تخطيط وتنفيذ سلسلة متكاملة من الدروس التطبيقية المتنوعة التي تجمع بين التعلم التعاوني والتعلم القائم على المشاريع وحل المشكلات الواقعية، مع توثيق مستمر لنواتج التعلم ومراعاة الفروق الفردية بين جميع الطلاب وتقديم تغذية راجعة فورية.';
  const endingMarker = 'خاتمة التوثيق النهائية المعتمدة دون أي قص أو بتر للنص.';
  const ultraLongDescription =
    Array.from({ length: 24 }, (_, idx) => `(${idx + 1}) ${repeatedParagraph}`).join('\n') +
    `\n${endingMarker}`;

  await saveStandaloneEvidenceToElement({
    elementId: 'element-4',
    formData: {
      evidenceType: 'report',
      title: 'توثيق تفصيلي شامل لتنوع استراتيجيات التدريس طوال الفصل',
      executionDate: '1448/04/01',
      targetAudience: 'جميع فصول المرحلة المتوسطة',
      description: ultraLongDescription,
      impact: 'تحسن نوعي ومستدام في مستوى إتقان المهارات الأساسية طوال العام.',
      evidencePhotos: [],
      evidenceLinks: [],
    },
    storage,
    mediaRepo,
  });

  const pdfRes = await generateTeacherPortfolioPdf({
    settings: SAMPLE_OFFICIAL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Ultra-long single evidence must span multiple element pages cleanly and retain endingMarker intact
  const elementPages = pdfRes.pageDescriptors.filter(
    (d) => d.kind === 'elements'
  );
  assert.ok(
    elementPages.length >= 2,
    `Expected ultra-long description to span >= 2 pages, got ${elementPages.length}`
  );

  const allText = pdfRes.renderedTextsByPage.join('\n');
  assert.ok(
    allText.includes(endingMarker),
    'Ending marker of ultra-long description was truncated!'
  );
  assert.equal(/مرتبط/.test(allText), false);
  assert.equal(/مستقل/.test(allText), false);
  assert.equal(allText.includes('صفحة'), false);
});


