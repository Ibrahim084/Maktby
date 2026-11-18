import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { SchoolSettings } from '../types';
import { decodeQrMatrix, generateQrMatrix } from './qrCodeGenerator';
import {
  loadMigrationState,
  TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY,
} from './teacherArchiveEngine';
import {
  computeSha256HexSync,
  countBlobReferences,
  createMemoryTeacherMediaRepository,
  TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS,
} from './teacherMediaStorage';
import {
  generateTeacherReportPdf,
  paginateTeacherReportBlocks,
} from './teacherPdfEngine';
import {
  buildTeacherEducationalInitiativeDocument,
  createInitialEducationalInitiativeState,
  createSampleEducationalInitiativeState,
  EducationalInitiativeFormState,
  validateEducationalInitiativeState,
} from './teacherProgramsAndActivitiesEngine';
import {
  abandonActiveDraftAndCreateNewProgramActivity,
  cleanupUnreferencedProgramActivityBlobs,
  computeProgramActivityDraftSignature,
  createNewBlankProgramActivityInArchive,
  deleteArchivedProgramActivityRecordSafely,
  filterProgramActivityArchiveRecords,
  hasMeaningfulProgramActivityDraftData,
  inspectArchivedProgramActivityDeletionImpact,
  inspectProgramActivityDualStoreConsistency,
  isLegacyProgramActivityEmpty,
  listSavedProgramsAndActivities,
  loadActiveProgramActivityDraftWithMedia,
  loadArchivedProgramActivityWithMedia,
  loadLegacyProgramActivityDraft,
  loadProgramsActivitiesArchiveStore,
  migrateProgramsAndActivitiesToArchive,
  ProgramActivityDualStoreSyncError,
  PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
  resolveProgramActivityDualStoreDivergence,
  rollbackProgramsAndActivitiesMigration,
  saveActiveProgramActivityDraftWithMedia,
  saveDraftToArchiveAndCreateNewProgramActivity,
  saveProgramActivityToArchive,
  syncActiveProgramActivityDraftToBothStores,
  TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY,
} from './teacherProgramsAndActivitiesArchive';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

const mockSettings: SchoolSettings = {
  ...DEFAULT_SCHOOL_SETTINGS,
  educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
  schoolName: 'متوسطة الفيصلية النموذجية',
  userName: 'أ. عبدالرحمن بن خالد الغامدي',
  principalName: 'أ. فهد بن عبدالله السالم',
  academicYear: '١٤٤٧هـ',
  semester: 'الفصل الدراسي الثاني',
  roles: {
    ...DEFAULT_SCHOOL_SETTINGS.roles,
    teacher: 'معلم الرياضيات',
  },
};

const PNG_1PX_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const SVG_DATA_URL_ALT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#1E4D8C"/></svg>'
  );

test('Group 6 registration, factory empty detection, and 3x idempotent migration with zero Base64 in JSON', async () => {
  assert.ok(
    TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS.includes(
      TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY
    ),
    'Group 6 storage key must be registered in global media reference keys'
  );

  // Untouched factory state (with settings userName prefilled) must count as empty
  const emptyFactory = createInitialEducationalInitiativeState(mockSettings);
  assert.equal(isLegacyProgramActivityEmpty(emptyFactory, mockSettings), true);

  // Empty legacy draft should be skipped without creating an archive draft
  const emptyStorage = createMemoryStorage();
  const emptyRepo = createMemoryTeacherMediaRepository();
  emptyStorage.setItem(
    PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
    JSON.stringify(emptyFactory)
  );
  const emptyRun = await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage: emptyStorage,
    mediaRepo: emptyRepo,
  });
  assert.equal(emptyRun.migratedCount, 0);
  assert.equal(emptyRun.skippedEmptyCount, 1);

  // Populated legacy draft with Base64 photo & link
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const legacyPopulated: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings, {
      executionNature: 'مبادرة جماعية',
    }),
    initiativeName: 'مبادرة سفراء القراءة الرياضية',
    evidencePhotos: [{ id: 'leg-p1', imageDataUrl: PNG_1PX_DATA_URL }],
    evidenceLinks: [
      { id: 'leg-l1', url: 'https://madrasati.sa/initiatives/math-ambassadors' },
    ],
  };
  storage.setItem(
    PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
    JSON.stringify(legacyPopulated)
  );

  // Run migration 3 consecutive times -> strictly idempotent
  const run1 = await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  const run2 = await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  const run3 = await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  assert.equal(run1.migratedCount, 1);
  assert.equal(run1.skippedEmptyCount, 0);
  assert.equal(run2.alreadyCompleted, true);
  assert.equal(run3.alreadyCompleted, true);
  assert.equal(run2.migratedCount, 0);
  assert.equal(run3.migratedCount, 0);

  // Snapshot & migration metadata recorded under Group 6 key
  const migState = loadMigrationState(storage);
  assert.ok(storage.getItem(TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY) !== null);
  assert.ok(migState.groups['programs-activities'] !== undefined);
  assert.equal(
    migState.groups['programs-activities']?.preMigrationArchiveRaw,
    null
  );

  // Legacy key kept intact & zero auto-link in portfolio
  assert.ok(storage.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY) !== null);
  assert.equal(storage.getItem('maktabi_teacher_portfolio_v1'), null);

  // Zero Base64 stored inside archive JSON; draft remains non-eligible
  const rawArchiveJson =
    storage.getItem(TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY) || '';
  assert.equal(rawArchiveJson.includes('data:image/'), false);
  assert.equal(rawArchiveJson.includes('iVBORw0KGgo'), false);

  const store = loadProgramsActivitiesArchiveStore(storage);
  assert.equal(Object.keys(store.records).length, 0);
  const migratedDraft =
    store.activeDraftByFormId['educational-initiative-documentation'];
  assert.ok(migratedDraft);
  assert.equal(migratedDraft.recordState, 'draft');
  assert.equal(migratedDraft.isPortfolioEligible, false);
  assert.equal(migratedDraft.mediaRefs.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 1);

  // Hydrate draft back with photo & verify participants + links preserved
  const hydrated = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(hydrated.integrityWarnings.length, 0);
  assert.equal(hydrated.formData.initiativeName, 'مبادرة سفراء القراءة الرياضية');
  assert.equal(hydrated.formData.executionNature, 'مبادرة جماعية');
  assert.equal(hydrated.formData.participants.length, 3);
  assert.equal(hydrated.formData.evidencePhotos.length, 1);
  assert.ok(
    hydrated.formData.evidencePhotos[0].imageDataUrl.startsWith(
      'data:image/png;base64,'
    )
  );
  assert.equal(hydrated.formData.evidenceLinks.length, 1);
});

test('Multi-record CRUD (individual & group), immutable IDs, search/filter, PDF/QR parity, and no portfolio auto-link', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const url1 = 'https://madrasati.sa/initiatives/morning-1447';
  const init1: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings, {
      executionNature: 'مبادرة فردية',
    }),
    initiativeName: 'مبادرة التحدي الصباحي للرياضيات',
    initiativeScope: 'صفية',
    evidencePhotos: [{ id: 'p1', imageDataUrl: PNG_1PX_DATA_URL }],
    evidenceLinks: [{ id: 'l1', url: url1 }],
  };

  const saved1 = await saveProgramActivityToArchive(init1, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(saved1.isNew, true);
  assert.equal(saved1.record.recordState, 'archived_saved');
  assert.equal(saved1.record.isPortfolioEligible, true);

  // Create blank new draft -> must not overwrite saved1
  const blank = createNewBlankProgramActivityInArchive({
    settings: mockSettings,
    storage,
  });
  assert.equal(blank.formData.initiativeName, '');
  assert.equal(
    listSavedProgramsAndActivities(
      'educational-initiative-documentation',
      storage
    ).length,
    1
  );

  // Save second independent record (group initiative with custom participants)
  const url2 = 'https://moe.gov.sa/ar/education/reading-club';
  const init2: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings, {
      executionNature: 'مبادرة جماعية',
    }),
    initiativeName: 'مبادرة نادي القراءة والابتكار',
    initiativeScope: 'على مستوى المدرسة',
    initiativeType: 'قرائية',
    participants: [
      { id: 'pt-1', name: 'أ. عبدالرحمن بن خالد الغامدي' },
      { id: 'pt-2', name: 'أ. ماجد الحربي' },
    ],
    evidencePhotos: [{ id: 'p2', imageDataUrl: SVG_DATA_URL_ALT }],
    evidenceLinks: [{ id: 'l2', url: url2 }],
  };

  const saved2 = await saveProgramActivityToArchive(init2, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(saved2.isNew, true);
  assert.notEqual(saved1.record.id, saved2.record.id);

  // Edit saved1 while keeping its immutable ID
  const edited1: EducationalInitiativeFormState = {
    ...init1,
    additionalNotes: 'تم تعميم المبادرة على الصفوف العليا بنجاح.',
  };
  const updated1 = await saveProgramActivityToArchive(edited1, {
    recordId: saved1.record.id,
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(updated1.isNew, false);
  assert.equal(updated1.record.id, saved1.record.id);

  // Reopen saved1 & saved2 and verify validation, QR scannability, PDF pagination & generation
  const reopened1 = await loadArchivedProgramActivityWithMedia(saved1.record.id, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.ok(reopened1);
  assert.equal(reopened1.integrityWarnings.length, 0);
  assert.equal(validateEducationalInitiativeState(reopened1.formData).length, 0);
  assert.equal(decodeQrMatrix(generateQrMatrix(url1, 2), 2), url1);

  const doc1 = buildTeacherEducationalInitiativeDocument(
    reopened1.formData,
    mockSettings
  );
  assert.ok(paginateTeacherReportBlocks(doc1, mockSettings).length >= 1);
  const pdf1 = await generateTeacherReportPdf(doc1, mockSettings);
  assert.equal(pdf1.linkAnnotationsCount, 1);
  assert.ok(new TextDecoder('latin1').decode(pdf1.pdfBytes).includes(`/URI (${url1})`));

  const reopened2 = await loadArchivedProgramActivityWithMedia(saved2.record.id, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.ok(reopened2);
  assert.equal(reopened2.formData.participants.length, 2);
  assert.equal(reopened2.formData.participants[1].name, 'أ. ماجد الحربي');

  // Search by participant name & filter by execution nature
  const allSaved = listSavedProgramsAndActivities(
    'educational-initiative-documentation',
    storage
  );
  assert.equal(allSaved.length, 2);
  assert.equal(
    filterProgramActivityArchiveRecords(allSaved, {
      executionNatureFilter: 'مبادرة فردية',
    }).length,
    1
  );
  assert.equal(
    filterProgramActivityArchiveRecords(allSaved, {
      executionNatureFilter: 'مبادرة جماعية',
      searchQuery: 'ماجد الحربي',
    })[0]?.id,
    saved2.record.id
  );

  // Never auto-linked to teacher portfolio
  assert.equal(storage.getItem('maktabi_teacher_portfolio_v1'), null);
});

test('SHA-256 deduplication, CRC-32 corruption warning, 6-group ref-counting, delete guard & rollback isolation', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const sharedBytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const sharedHash = computeSha256HexSync(sharedBytes);
  const sharedKey = `sha256:${sharedHash}`;

  // Seed Group 1 and Group 5 stores to confirm rollback never touches earlier groups
  storage.setItem(
    'maktabi_teacher_reports_archive_v1',
    JSON.stringify({
      schemaVersion: 1,
      groupId: 'professional-reports',
      records: {
        rep_1: {
          id: 'rep_1',
          groupId: 'professional-reports',
          formId: 'strategy-implementation',
          mediaRefs: [
            {
              id: 'm-rep',
              blobKey: sharedKey,
              contentSha256: sharedHash,
              crc32: 111,
              fileName: 'shared-across-groups.png',
              mimeType: 'image/png',
              byteLength: sharedBytes.byteLength,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
      activeDraftByFormId: {},
      updatedAt: new Date().toISOString(),
    })
  );
  storage.setItem(
    'maktabi_teacher_tests_eval_archive_v1',
    JSON.stringify({
      schemaVersion: 1,
      groupId: 'tests-evaluation',
      records: { te_1: { id: 'te_1' } },
      activeDraftByFormId: {},
      updatedAt: new Date().toISOString(),
    })
  );

  // Save two Group 6 records sharing identical PNG_1PX_DATA_URL (dedup) + exclusive SVG_DATA_URL_ALT
  const recA = await saveProgramActivityToArchive(
    {
      ...createSampleEducationalInitiativeState(mockSettings),
      initiativeName: 'مبادرة أ — مرفق مشترك ومرفق حصري',
      evidencePhotos: [
        { id: 'a1', imageDataUrl: PNG_1PX_DATA_URL },
        { id: 'a2', imageDataUrl: SVG_DATA_URL_ALT },
      ],
    },
    { settings: mockSettings, storage, mediaRepo }
  );

  const recB = await saveProgramActivityToArchive(
    {
      ...createSampleEducationalInitiativeState(mockSettings, {
        executionNature: 'مبادرة جماعية',
      }),
      initiativeName: 'مبادرة ب — مرفق متطابق البصمة SHA-256',
      evidencePhotos: [{ id: 'b1', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    { settings: mockSettings, storage, mediaRepo }
  );

  assert.equal(recA.mediaRefs[0].blobKey, recB.mediaRefs[0].blobKey);
  assert.equal(await mediaRepo.countBlobs(), 2);

  // Global ref-counting includes Group 6
  assert.equal(
    countBlobReferences(recA.mediaRefs[0].blobKey, { storage }),
    2
  );

  // Link recB to teacher portfolio -> unconfirmed delete must block, confirmed delete must unlink + audit + preserve shared PNG
  storage.setItem(
    'maktabi_teacher_portfolio_v1',
    JSON.stringify({
      schemaVersion: 1,
      teacherName: mockSettings.userName,
      updatedAt: new Date().toISOString(),
      elements: {
        'elem-6': {
          title: 'توظيف تقنيات ووسائل التعلم والمبادرات',
          linkedRecords: [
            {
              sourceRecordId: recB.record.id,
              sourceGroupId: 'programs-activities',
              formId: 'educational-initiative-documentation',
              title: recB.record.title,
            },
          ],
        },
      },
      sourceDeletionAuditLog: [],
    })
  );

  const impact = inspectArchivedProgramActivityDeletionImpact(recB.record.id, {
    storage,
  });
  assert.equal(impact.isLinked, true);
  assert.equal(impact.sharedBlobKeys.includes(recB.mediaRefs[0].blobKey), true);

  const blocked = await deleteArchivedProgramActivityRecordSafely(recB.record.id, {
    confirmUnlink: false,
    storage,
    mediaRepo,
  });
  assert.equal(blocked.result.requiresConfirmation, true);
  assert.equal(blocked.result.deleted, false);

  const confirmed = await deleteArchivedProgramActivityRecordSafely(
    recB.record.id,
    {
      confirmUnlink: true,
      storage,
      mediaRepo,
    }
  );
  assert.equal(confirmed.result.deleted, true);
  assert.deepEqual(confirmed.result.unlinkedElementIds, ['elem-6']);
  assert.equal(
    confirmed.result.preservedSharedBlobKeys.includes(recB.mediaRefs[0].blobKey),
    true
  );
  assert.equal(await mediaRepo.countBlobs(), 2);

  const updatedPortfolio = JSON.parse(
    storage.getItem('maktabi_teacher_portfolio_v1') || '{}'
  );
  assert.equal(updatedPortfolio.elements['elem-6'].linkedRecords.length, 0);
  assert.equal(updatedPortfolio.sourceDeletionAuditLog.length, 1);

  // Corrupt SVG blob inside mediaRepo -> verify CRC-32 / SHA-256 warning triggers on reopen
  const svgBlobKey = recA.mediaRefs[1].blobKey;
  const rawSvgBlob = await mediaRepo.getBlob(svgBlobKey);
  assert.ok(rawSvgBlob);
  await mediaRepo.putBlob({
    ...rawSvgBlob,
    bytes: new Uint8Array([7, 7, 7, 7]),
  });

  const hydratedCorrupted = await loadArchivedProgramActivityWithMedia(
    recA.record.id,
    {
      settings: mockSettings,
      storage,
      mediaRepo,
    }
  );
  assert.ok(hydratedCorrupted);
  assert.ok(hydratedCorrupted.integrityWarnings.length >= 1);

  // Run migration & independent rollback for Group 6 -> Group 1 & Group 5 & legacy key must remain untouched
  storage.removeItem(TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY);
  const rbLegacy: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings),
    initiativeName: 'مبادرة اختبار التراجع المستقل',
    evidencePhotos: [{ id: 'rb-p', imageDataUrl: PNG_1PX_DATA_URL }],
  };
  storage.setItem(
    PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
    JSON.stringify(rbLegacy)
  );

  const rbMig = await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(rbMig.migratedCount, 1);
  assert.ok(
    storage.getItem(TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY) !== null
  );

  const rbOutcome = await rollbackProgramsAndActivitiesMigration({
    storage,
    mediaRepo,
  });
  assert.equal(rbOutcome.rolledBack, true);
  assert.equal(
    storage.getItem(TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY),
    null
  );
  assert.ok(storage.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY) !== null);
  assert.ok(storage.getItem('maktabi_teacher_reports_archive_v1') !== null);
  assert.ok(storage.getItem('maktabi_teacher_tests_eval_archive_v1') !== null);
});

test('Draft loss prevention: detect non-empty draft, save-then-create-new, validation guard, abandon with ref-counting, and reload parity', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  // 1. Seed a previously saved archived record sharing PNG_1PX_DATA_URL
  const archivedPrior = await saveProgramActivityToArchive(
    {
      ...createSampleEducationalInitiativeState(mockSettings),
      initiativeName: 'مبادرة سابقة محفوظة بالأرشيف',
      evidencePhotos: [{ id: 'prior-p1', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    { settings: mockSettings, storage, mediaRepo }
  );
  assert.equal(await mediaRepo.countBlobs(), 1);

  // Empty factory draft must NOT report meaningful data
  const factoryDraft = createInitialEducationalInitiativeState(mockSettings);
  assert.equal(hasMeaningfulProgramActivityDraftData(factoryDraft, mockSettings), false);

  // 2. User edits an unsaved active draft with a shared photo + an exclusive photo
  const incompleteDraft: EducationalInitiativeFormState = {
    ...factoryDraft,
    initiativeName: 'مسودة غير مكتملة لاختبار الحفظ والانتقال',
    evidencePhotos: [
      { id: 'draft-shared-p', imageDataUrl: PNG_1PX_DATA_URL },
      { id: 'draft-excl-p', imageDataUrl: SVG_DATA_URL_ALT },
    ],
  };
  assert.equal(hasMeaningfulProgramActivityDraftData(incompleteDraft, mockSettings), true);

  const savedDraftRes = await saveActiveProgramActivityDraftWithMedia(incompleteDraft, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 2);

  // Reload simulation -> draft & both photos hydrate cleanly and both stores agree
  const reloadedIncomplete = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(
    reloadedIncomplete.formData.initiativeName,
    'مسودة غير مكتملة لاختبار الحفظ والانتقال'
  );
  assert.equal(reloadedIncomplete.formData.evidencePhotos.length, 2);
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'مسودة غير مكتملة لاختبار الحفظ والانتقال'
  );

  // Trying "save draft then create new" while required fields are missing must abort cleanly without wiping draft or photos
  const failedSaveAndNew = await saveDraftToArchiveAndCreateNewProgramActivity(
    reloadedIncomplete.formData,
    { settings: mockSettings, storage, mediaRepo }
  );
  assert.equal(failedSaveAndNew.ok, false);
  const afterFailedAttempt = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(
    afterFailedAttempt.formData.initiativeName,
    'مسودة غير مكتملة لاختبار الحفظ والانتقال'
  );
  assert.equal(afterFailedAttempt.formData.evidencePhotos.length, 2);
  assert.equal(await mediaRepo.countBlobs(), 2);

  // 3. Complete required fields, save-to-archive + create-new -> archives old draft under fixed trec_, clears active draft + legacy key, preserves blobs
  const completeDraft: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings),
    initiativeName: 'مسودة مكتملة تُحفظ قبل إنشاء مبادرة جديدة',
    evidencePhotos: [
      { id: 'draft-shared-p', imageDataUrl: PNG_1PX_DATA_URL },
      { id: 'draft-excl-p', imageDataUrl: SVG_DATA_URL_ALT },
    ],
  };
  await saveActiveProgramActivityDraftWithMedia(completeDraft, {
    draftId: savedDraftRes.draftRecord.id,
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  const savedAndNew = await saveDraftToArchiveAndCreateNewProgramActivity(completeDraft, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(savedAndNew.ok, true);
  if (savedAndNew.ok) {
    assert.ok(savedAndNew.savedRecord.id.startsWith('trec_'));
    assert.notEqual(savedAndNew.savedRecord.id, archivedPrior.record.id);
    assert.equal(savedAndNew.newFormData.initiativeName, '');
  }

  // After reload: both archived records intact (2 total), active draft & legacy key both cleanly blank, both blobs preserved
  const allSavedAfterSaveAndNew = listSavedProgramsAndActivities(
    'educational-initiative-documentation',
    storage
  );
  assert.equal(allSavedAfterSaveAndNew.length, 2);
  assert.equal(await mediaRepo.countBlobs(), 2);
  const reloadedAfterSaveAndNew = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(reloadedAfterSaveAndNew.formData.initiativeName, '');
  assert.equal(loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName, '');

  // 4. Abandon non-empty draft -> removes unreferenced exclusive blob while preserving shared blob used by prior archived record
  const exclusiveThirdPng =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#B91C1C"/></svg>'
    );
  const secondDraft: EducationalInitiativeFormState = {
    ...factoryDraft,
    initiativeName: 'مسودة مؤقتة سيتم تأكيد التخلي عنها',
    evidencePhotos: [
      { id: 'ab-shared', imageDataUrl: PNG_1PX_DATA_URL },
      { id: 'ab-excl', imageDataUrl: exclusiveThirdPng },
    ],
  };
  await saveActiveProgramActivityDraftWithMedia(secondDraft, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 3);

  const abandoned = await abandonActiveDraftAndCreateNewProgramActivity({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(abandoned.formData.initiativeName, '');
  assert.equal(abandoned.removedBlobKeys.length, 1);
  assert.equal(abandoned.preservedSharedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 2);
  assert.equal(
    listSavedProgramsAndActivities('educational-initiative-documentation', storage)
      .length,
    2
  );
  assert.equal(loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName, '');
});

test('Transactional dual-store sync rolls back both archive and legacy stores on single-store write failure (no silent divergence)', async () => {
  const backing = createMemoryStorage();
  let failKey: string | null = null;
  const storage = {
    getItem: (key: string) => backing.getItem(key),
    setItem: (key: string, val: string) => {
      if (failKey === key) {
        throw new Error(`Simulated quota/write error on ${key}`);
      }
      backing.setItem(key, val);
    },
    removeItem: (key: string) => backing.removeItem(key),
  };
  const mediaRepo = createMemoryTeacherMediaRepository();

  const initialSynced: EducationalInitiativeFormState = {
    ...createInitialEducationalInitiativeState(mockSettings),
    initiativeName: 'نسخة متزامنة مستقرة قبل الخطأ',
  };
  await saveActiveProgramActivityDraftWithMedia(initialSynced, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  // Case A: legacy key write throws AFTER archive key write succeeds -> MUST roll back archive store too
  failKey = PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY;
  const attemptedEditA: EducationalInitiativeFormState = {
    ...initialSynced,
    initiativeName: 'تعديل سيفشل في المفتاح التوافقي القديم',
  };
  assert.throws(
    () =>
      syncActiveProgramActivityDraftToBothStores(attemptedEditA, {
        settings: mockSettings,
        storage,
      }),
    (err: unknown) =>
      err instanceof ProgramActivityDualStoreSyncError &&
      err.failedStore === 'legacy' &&
      err.rolledBackBoth === true
  );
  // Both stores MUST still match the stable pre-failure title
  assert.equal(
    loadProgramsActivitiesArchiveStore(storage).activeDraftByFormId?.[
      'educational-initiative-documentation'
    ]?.payload?.initiativeName,
    'نسخة متزامنة مستقرة قبل الخطأ'
  );
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'نسخة متزامنة مستقرة قبل الخطأ'
  );

  // Case B: archive key write throws -> MUST leave legacy key untouched & throw explicitly
  failKey = TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY;
  const attemptedEditB: EducationalInitiativeFormState = {
    ...initialSynced,
    initiativeName: 'تعديل سيفشل في مخزن الأرشيف',
  };
  assert.throws(
    () =>
      syncActiveProgramActivityDraftToBothStores(attemptedEditB, {
        settings: mockSettings,
        storage,
      }),
    (err: unknown) =>
      err instanceof ProgramActivityDualStoreSyncError &&
      err.failedStore === 'archive' &&
      err.rolledBackBoth === true
  );
  assert.equal(
    loadProgramsActivitiesArchiveStore(storage).activeDraftByFormId?.[
      'educational-initiative-documentation'
    ]?.payload?.initiativeName,
    'نسخة متزامنة مستقرة قبل الخطأ'
  );
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'نسخة متزامنة مستقرة قبل الخطأ'
  );

  failKey = null;
});

test('Rollback failure itself is never swallowed: reports rolledBackBoth=false, detects divergence on reload without data loss, and reconciles cleanly', async () => {
  const backing = createMemoryStorage();
  let mode: 'ok' | 'fail-with-rollback-fail' = 'ok';
  let archiveWritesInFailMode = 0;

  const storage = {
    getItem: (key: string) => backing.getItem(key),
    setItem: (key: string, val: string) => {
      if (mode === 'fail-with-rollback-fail') {
        if (key === TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY) {
          archiveWritesInFailMode += 1;
          // 1st write (new archive) succeeds; 2nd write (rollback restore) FAILS!
          if (archiveWritesInFailMode === 2) {
            throw new Error('Simulated rollback write failure on archive store');
          }
        }
        if (key === PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY) {
          throw new Error('Simulated write failure on legacy store');
        }
      }
      backing.setItem(key, val);
    },
    removeItem: (key: string) => backing.removeItem(key),
  };
  const mediaRepo = createMemoryTeacherMediaRepository();

  const stableV1: EducationalInitiativeFormState = {
    ...createInitialEducationalInitiativeState(mockSettings),
    initiativeName: 'نسخة مستقرة V1 قبل فشل التراجع',
  };
  await saveActiveProgramActivityDraftWithMedia(stableV1, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  mode = 'fail-with-rollback-fail';
  const attemptedV2: EducationalInitiativeFormState = {
    ...stableV1,
    initiativeName: 'نسخة V2 أدت إلى فشل التراجع',
  };

  assert.throws(
    () =>
      syncActiveProgramActivityDraftToBothStores(attemptedV2, {
        settings: mockSettings,
        storage,
      }),
    (err: unknown) =>
      err instanceof ProgramActivityDualStoreSyncError &&
      err.rolledBackBoth === false &&
      err.archiveRestored === false &&
      err.legacyRestored === true &&
      err.diverged === true &&
      err.rollbackErrors.length >= 1
  );

  // Stop failing so next reload inspects real diverged state
  mode = 'ok';

  // Subsequent load MUST detect divergence explicitly and NOT overwrite either copy silently
  const inspected = inspectProgramActivityDualStoreConsistency(
    mockSettings,
    storage
  );
  assert.equal(inspected.diverged, true);
  assert.equal(inspected.reason, 'payload-mismatch');
  assert.equal(inspected.archiveTitle, 'نسخة V2 أدت إلى فشل التراجع');
  assert.equal(inspected.legacyTitle, 'نسخة مستقرة V1 قبل فشل التراجع');

  const reloaded = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(reloaded.divergence.diverged, true);
  assert.ok(reloaded.integrityWarnings.length >= 1);
  // Legacy copy MUST still remain untouched until user resolves!
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'نسخة مستقرة V1 قبل فشل التراجع'
  );

  // Resolve by choosing legacy copy -> reconciles both stores cleanly and persists across reload
  await resolveProgramActivityDualStoreDivergence('keep-legacy', {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  const afterResolve = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(afterResolve.divergence.diverged, false);
  assert.equal(
    afterResolve.formData.initiativeName,
    'نسخة مستقرة V1 قبل فشل التراجع'
  );
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'نسخة مستقرة V1 قبل فشل التراجع'
  );

  // Also test corrupted legacy JSON divergence detection
  backing.setItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY, '{corrupted_json');
  const corruptedCheck = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(corruptedCheck.divergence.diverged, true);
  assert.equal(corruptedCheck.divergence.reason, 'legacy-corrupted');

  await resolveProgramActivityDualStoreDivergence('keep-archive', {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  const afterArchiveRepair = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(afterArchiveRepair.divergence.diverged, false);
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'نسخة مستقرة V1 قبل فشل التراجع'
  );
});

test('Orphan blob prevention & shared blob preservation when storage fails after IndexedDB write', async () => {
  const backing = createMemoryStorage();
  let failStorageKey: string | null = null;
  const storage = {
    getItem: (k: string) => backing.getItem(k),
    setItem: (k: string, v: string) => {
      if (failStorageKey === k) {
        throw new Error(`Simulated quota error on ${k}`);
      }
      backing.setItem(k, v);
    },
    removeItem: (k: string) => backing.removeItem(k),
  };
  const mediaRepo = createMemoryTeacherMediaRepository();

  // Case 1: Exclusive photo uploaded into IndexedDB then localStorage fails -> MUST delete orphan blob
  failStorageKey = PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY;
  const exclusiveDraft: EducationalInitiativeFormState = {
    ...createInitialEducationalInitiativeState(mockSettings),
    initiativeName: 'مسودة بصورة حصرية سيفشل حفظها محليًا',
    evidencePhotos: [{ id: 'excl-p1', imageDataUrl: PNG_1PX_DATA_URL }],
  };
  await assert.rejects(
    () =>
      saveActiveProgramActivityDraftWithMedia(exclusiveDraft, {
        settings: mockSettings,
        storage,
        mediaRepo,
      }),
    (err: unknown) => err instanceof ProgramActivityDualStoreSyncError
  );
  assert.equal(await mediaRepo.countBlobs(), 0);
  const afterFailStore = loadProgramsActivitiesArchiveStore(storage);
  assert.equal(
    afterFailStore.activeDraftByFormId['educational-initiative-documentation'],
    undefined
  );

  // Case 2: Archive save failure after IndexedDB write -> MUST delete exclusive orphan blob too
  failStorageKey = TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY;
  const archiveFailItem: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings),
    initiativeName: 'مبادرة سيفشل حفظ سجلها في الأرشيف',
    evidencePhotos: [{ id: 'excl-p2', imageDataUrl: SVG_DATA_URL_ALT }],
  };
  await assert.rejects(
    () =>
      saveProgramActivityToArchive(archiveFailItem, {
        settings: mockSettings,
        storage,
        mediaRepo,
      }),
    (err: unknown) => err instanceof ProgramActivityDualStoreSyncError
  );
  assert.equal(await mediaRepo.countBlobs(), 0);

  // Case 3: Shared blob MUST be preserved if another record references it even when draft write fails
  failStorageKey = null;
  const sharedSaved = await saveProgramActivityToArchive(
    {
      ...createSampleEducationalInitiativeState(mockSettings),
      initiativeName: 'سجل محفوظ بمرفق مشترك',
      evidencePhotos: [{ id: 'shared-1', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    { settings: mockSettings, storage, mediaRepo }
  );
  const sharedBlobKey = sharedSaved.mediaRefs[0].blobKey;
  assert.equal(await mediaRepo.countBlobs(), 1);
  assert.equal(countBlobReferences(sharedBlobKey, { storage }), 1);

  // Attempt draft save with BOTH shared PNG and exclusive SVG while legacy key fails
  failStorageKey = PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY;
  const mixedDraft: EducationalInitiativeFormState = {
    ...createInitialEducationalInitiativeState(mockSettings),
    initiativeName: 'مسودة بمرفق مشترك وآخر حصري',
    evidencePhotos: [
      { id: 'draft-shared', imageDataUrl: PNG_1PX_DATA_URL },
      { id: 'draft-excl', imageDataUrl: SVG_DATA_URL_ALT },
    ],
  };
  await assert.rejects(
    () =>
      saveActiveProgramActivityDraftWithMedia(mixedDraft, {
        settings: mockSettings,
        storage,
        mediaRepo,
      }),
    (err: unknown) => err instanceof ProgramActivityDualStoreSyncError
  );

  // Exclusive SVG MUST be cleaned up, while shared PNG MUST remain intact!
  assert.equal(await mediaRepo.countBlobs(), 1);
  assert.ok((await mediaRepo.getBlob(sharedBlobKey)) !== null);
  assert.equal(countBlobReferences(sharedBlobKey, { storage }), 1);

  // Direct cleanup helper must also respect cross-group shared blobs
  const crossCleanup = await cleanupUnreferencedProgramActivityBlobs(
    [sharedBlobKey],
    { storage, mediaRepo }
  );
  assert.deepEqual(crossCleanup.removedBlobKeys, []);
  assert.deepEqual(crossCleanup.preservedSharedBlobKeys, [sharedBlobKey]);
  assert.equal(await mediaRepo.countBlobs(), 1);
});

test('Single-transition saveDraftToArchiveAndCreateNewProgramActivity prevents partial commit across all failure points', async () => {
  const backing = createMemoryStorage();
  let failMode: 'none' | 'archive' | 'legacy' | 'rollback' = 'none';
  let archiveFailWrites = 0;
  const storage = {
    getItem: (k: string) => backing.getItem(k),
    setItem: (k: string, v: string) => {
      if (
        failMode === 'archive' &&
        k === TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY
      ) {
        throw new Error('Simulated archive write failure');
      }
      if (
        failMode === 'legacy' &&
        k === PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY
      ) {
        throw new Error('Simulated legacy write failure');
      }
      if (failMode === 'rollback') {
        if (k === TEACHER_PROGRAMS_ACTIVITIES_ARCHIVE_STORAGE_KEY) {
          archiveFailWrites += 1;
          if (archiveFailWrites === 2) {
            throw new Error('Simulated rollback restore failure');
          }
        }
        if (k === PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY) {
          throw new Error('Simulated legacy failure before rollback failure');
        }
      }
      backing.setItem(k, v);
    },
    removeItem: (k: string) => backing.removeItem(k),
  };
  const mediaRepo = createMemoryTeacherMediaRepository();

  // Save a shared archived record first (reusing PNG_1PX_DATA_URL)
  await saveProgramActivityToArchive(
    {
      ...createSampleEducationalInitiativeState(mockSettings),
      initiativeName: 'سجل محفوظ مسبقًا',
      evidencePhotos: [{ id: 'base-p', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    { settings: mockSettings, storage, mediaRepo }
  );

  // Active draft only persisted with shared PNG; now user attaches new exclusive SVG inline right before save-and-new
  const activeDraftBase: EducationalInitiativeFormState = {
    ...createSampleEducationalInitiativeState(mockSettings),
    initiativeName: 'مسودة نشطة لاختبار منع الفشل الجزئي',
    evidencePhotos: [{ id: 'd-p1', imageDataUrl: PNG_1PX_DATA_URL }],
  };
  await saveActiveProgramActivityDraftWithMedia(activeDraftBase, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  const draftWithNewExclPhoto: EducationalInitiativeFormState = {
    ...activeDraftBase,
    evidencePhotos: [
      { id: 'd-p1', imageDataUrl: PNG_1PX_DATA_URL },
      { id: 'd-p2-new', imageDataUrl: SVG_DATA_URL_ALT },
    ],
  };

  // Failure Stage A: Archive store fails -> record NOT archived, old active draft intact, exclusive blob deleted, shared kept
  failMode = 'archive';
  await assert.rejects(
    () =>
      saveDraftToArchiveAndCreateNewProgramActivity(draftWithNewExclPhoto, {
        settings: mockSettings,
        storage,
        mediaRepo,
      }),
    (err: unknown) =>
      err instanceof ProgramActivityDualStoreSyncError &&
      err.rolledBackBoth === true
  );
  assert.equal(
    listSavedProgramsAndActivities(
      'educational-initiative-documentation',
      storage
    ).length,
    1
  );
  assert.equal(
    loadLegacyProgramActivityDraft(mockSettings, storage).initiativeName,
    'مسودة نشطة لاختبار منع الفشل الجزئي'
  );
  assert.equal(await mediaRepo.countBlobs(), 1);

  // Failure Stage B: Legacy store fails AFTER archive write -> MUST roll back archive too (NO archived record created & old draft preserved!)
  failMode = 'legacy';
  await assert.rejects(
    () =>
      saveDraftToArchiveAndCreateNewProgramActivity(draftWithNewExclPhoto, {
        settings: mockSettings,
        storage,
        mediaRepo,
      }),
    (err: unknown) =>
      err instanceof ProgramActivityDualStoreSyncError &&
      err.rolledBackBoth === true &&
      err.diverged === false
  );
  assert.equal(
    listSavedProgramsAndActivities(
      'educational-initiative-documentation',
      storage
    ).length,
    1
  );
  const afterStageBReload = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(afterStageBReload.divergence.diverged, false);
  assert.equal(
    afterStageBReload.formData.initiativeName,
    'مسودة نشطة لاختبار منع الفشل الجزئي'
  );
  assert.equal(await mediaRepo.countBlobs(), 1);

  // Failure Stage C: Rollback itself fails -> explicitly reports rolledBackBoth=false, diverged=true, and detects on reload
  failMode = 'rollback';
  archiveFailWrites = 0;
  await assert.rejects(
    () =>
      saveDraftToArchiveAndCreateNewProgramActivity(draftWithNewExclPhoto, {
        settings: mockSettings,
        storage,
        mediaRepo,
      }),
    (err: unknown) =>
      err instanceof ProgramActivityDualStoreSyncError &&
      err.rolledBackBoth === false &&
      err.diverged === true
  );
  failMode = 'none';
  const stageCReload = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(stageCReload.divergence.diverged, true);
});

test('Async race guard: delayed media extraction aborts cleanly if draft is abandoned/replaced or overwritten, and preserves concurrent archived records', async () => {
  const storage = createMemoryStorage();
  const baseRepo = createMemoryTeacherMediaRepository();

  let releasePutGate: (() => void) | null = null;
  const triggerPutGate = () => {
    const fn = releasePutGate;
    releasePutGate = null;
    if (fn) fn();
  };
  let delayNextPut = false;
  const delayedRepo = {
    getBlob: baseRepo.getBlob.bind(baseRepo),
    deleteBlob: baseRepo.deleteBlob.bind(baseRepo),
    listBlobKeys: baseRepo.listBlobKeys.bind(baseRepo),
    countBlobs: baseRepo.countBlobs.bind(baseRepo),
    putBlob: async (rec: Parameters<typeof baseRepo.putBlob>[0]) => {
      if (delayNextPut) {
        await new Promise<void>((resolve) => {
          releasePutGate = resolve;
        });
      }
      return baseRepo.putBlob(rec);
    },
  };

  // Race A: Draft A starts slow media save; user abandons & starts blank draft B while await is pending
  const draftA: EducationalInitiativeFormState = {
    ...createInitialEducationalInitiativeState(mockSettings),
    initiativeName: 'مسودة أ قبل التخلي السريع',
  };
  const seededA = await saveActiveProgramActivityDraftWithMedia(draftA, {
    settings: mockSettings,
    storage,
    mediaRepo: delayedRepo,
  });

  delayNextPut = true;
  const pendingSlowSaveA = saveActiveProgramActivityDraftWithMedia(
    {
      ...draftA,
      evidencePhotos: [{ id: 'slow-p1', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    {
      draftId: seededA.draftRecord.id,
      settings: mockSettings,
      storage,
      mediaRepo: delayedRepo,
    }
  );

  // Give microtask queue a tick so pendingSlowSaveA reaches putBlob gate
  await new Promise((r) => setTimeout(r, 10));
  await abandonActiveDraftAndCreateNewProgramActivity({
    settings: mockSettings,
    storage,
    mediaRepo: delayedRepo,
  });
  delayNextPut = false;
  triggerPutGate();

  const slowOutcomeA = await pendingSlowSaveA;
  assert.equal(slowOutcomeA.aborted, true);
  assert.equal(slowOutcomeA.abortReason, 'draft-replaced');
  assert.equal(await delayedRepo.countBlobs(), 0);
  assert.equal(
    (
      await loadActiveProgramActivityDraftWithMedia({
        settings: mockSettings,
        storage,
        mediaRepo: delayedRepo,
      })
    ).formData.initiativeName,
    ''
  );

  // Race B: Synchronous edit advances draft timestamp while slow media save is awaiting -> aborts stale write & cleans orphan
  const draftB: EducationalInitiativeFormState = {
    ...createInitialEducationalInitiativeState(mockSettings),
    initiativeName: 'نسخة ب1',
  };
  const seededB = await saveActiveProgramActivityDraftWithMedia(draftB, {
    settings: mockSettings,
    storage,
    mediaRepo: delayedRepo,
  });

  delayNextPut = true;
  const pendingSlowSaveB = saveActiveProgramActivityDraftWithMedia(
    {
      ...draftB,
      evidencePhotos: [{ id: 'slow-p2', imageDataUrl: SVG_DATA_URL_ALT }],
    },
    {
      draftId: seededB.draftRecord.id,
      settings: mockSettings,
      storage,
      mediaRepo: delayedRepo,
    }
  );
  await new Promise((r) => setTimeout(r, 10));
  // Ensure timestamp advances >= 2ms cleanly
  await new Promise((r) => setTimeout(r, 5));
  syncActiveProgramActivityDraftToBothStores(
    { ...draftB, initiativeName: 'نسخة ب2 الأحدث المتزامنة' },
    { draftId: seededB.draftRecord.id, settings: mockSettings, storage }
  );
  delayNextPut = false;
  triggerPutGate();

  const slowOutcomeB = await pendingSlowSaveB;
  assert.equal(slowOutcomeB.aborted, true);
  assert.equal(slowOutcomeB.abortReason, 'stale-write');
  assert.equal(await delayedRepo.countBlobs(), 0);
  assert.equal(
    (
      await loadActiveProgramActivityDraftWithMedia({
        settings: mockSettings,
        storage,
        mediaRepo: delayedRepo,
      })
    ).formData.initiativeName,
    'نسخة ب2 الأحدث المتزامنة'
  );

  // Race C: Concurrent archived record saved while SAME draft extracts media -> re-read latestStore MUST keep archived record!
  delayNextPut = true;
  const pendingSlowSaveC = saveActiveProgramActivityDraftWithMedia(
    {
      ...draftB,
      initiativeName: 'نسخة ب2 الأحدث المتزامنة',
      evidencePhotos: [{ id: 'slow-p3', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    {
      draftId: seededB.draftRecord.id,
      settings: mockSettings,
      storage,
      mediaRepo: delayedRepo,
    }
  );
  await new Promise((r) => setTimeout(r, 10));
  delayNextPut = false;
  const concurrentArchived = await saveProgramActivityToArchive(
    {
      ...createSampleEducationalInitiativeState(mockSettings),
      initiativeName: 'سجل أرشيفي متزامن أثناء استخراج صورة',
    },
    { settings: mockSettings, storage, mediaRepo: baseRepo }
  );
  triggerPutGate();

  const slowOutcomeC = await pendingSlowSaveC;
  assert.equal(slowOutcomeC.aborted, false);
  const savedIds = listSavedProgramsAndActivities(
    'educational-initiative-documentation',
    storage
  ).map((r) => r.id);
  assert.equal(savedIds.includes(concurrentArchived.record.id), true);
  const finalReload = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo: delayedRepo,
  });
  assert.equal(finalReload.formData.evidencePhotos.length, 1);
  assert.equal(finalReload.integrityWarnings.length, 0);
});

test('Deterministic draft sync signature avoids duplicate writes when state is unchanged', () => {
  const base = createInitialEducationalInitiativeState(mockSettings);
  const sig1 = computeProgramActivityDraftSignature(base, [], mockSettings);
  const sig2 = computeProgramActivityDraftSignature(
    { ...base },
    [],
    mockSettings
  );
  assert.equal(sig1, sig2);

  const sigEdited = computeProgramActivityDraftSignature(
    { ...base, initiativeName: 'عنوان محدث' },
    [],
    mockSettings
  );
  assert.notEqual(sig1, sigEdited);

  const sigPhoto = computeProgramActivityDraftSignature(
    { ...base, initiativeName: 'عنوان محدث' },
    ['photo-id-1'],
    mockSettings
  );
  assert.notEqual(sigEdited, sigPhoto);
});

test('Startup migration after clean session preserves dual-store divergence instead of overwriting archive with legacy', async () => {
  const storage = createMemoryStorage();
  const repo = createMemoryTeacherMediaRepository();

  // First clean open (legacy is blank -> completedSources stays empty)
  await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage,
    mediaRepo: repo,
  });

  // User creates a real draft saved to both stores
  await saveActiveProgramActivityDraftWithMedia(
    {
      ...createInitialEducationalInitiativeState(mockSettings),
      initiativeName: 'مسودة الأرشيف المحدثة',
    },
    { settings: mockSettings, storage, mediaRepo: repo }
  );

  // Inject divergence in legacy key only
  const legacyObj = JSON.parse(
    storage.getItem(PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY)!
  );
  legacyObj.initiativeName = 'مسودة المفتاح التوافقي القديم';
  storage.setItem(
    PROGRAMS_ACTIVITIES_LEGACY_DRAFT_KEY,
    JSON.stringify(legacyObj)
  );

  // Subsequent reload calls migrateProgramsAndActivitiesToArchive before loadActiveProgramActivityDraftWithMedia
  await migrateProgramsAndActivitiesToArchive({
    settings: mockSettings,
    storage,
    mediaRepo: repo,
  });

  const loaded = await loadActiveProgramActivityDraftWithMedia({
    settings: mockSettings,
    storage,
    mediaRepo: repo,
  });
  assert.equal(loaded.divergence.diverged, true);
  assert.equal(loaded.divergence.reason, 'payload-mismatch');
  assert.equal(loaded.divergence.archiveTitle, 'مسودة الأرشيف المحدثة');
  assert.equal(loaded.divergence.legacyTitle, 'مسودة المفتاح التوافقي القديم');
});


