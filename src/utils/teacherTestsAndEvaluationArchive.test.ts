import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { SchoolSettings } from '../types';
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
import { paginateTeacherReportBlocks } from './teacherPdfEngine';
import {
  buildTeacherTestOrEvaluationDocument,
  calculateRemainingStudentsCount,
  createInitialTestOrEvaluationState,
  createSampleTestOrEvaluationState,
  InternalTestExecutionFormState,
  parseFlexibleScore,
  PerformanceTaskExecutionFormState,
  validateTestOrEvaluationState,
} from './teacherTestsAndEvaluationEngine';
import {
  createNewBlankTestEvalInArchive,
  deleteArchivedTestEvalRecordSafely,
  filterTestEvalArchiveRecords,
  inspectArchivedTestEvalDeletionImpact,
  isLegacyTestEvalEmpty,
  listSavedTestsAndEvaluations,
  loadActiveTestEvalDraftWithMedia,
  loadArchivedTestEvalWithMedia,
  loadTestsEvalArchiveStore,
  migrateTestsAndEvaluationToArchive,
  rollbackTestsAndEvaluationMigration,
  saveActiveTestEvalDraftWithMedia,
  saveTestEvalToArchive,
  TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY,
  TESTS_EVAL_LEGACY_DRAFT_PREFIX,
} from './teacherTestsAndEvaluationArchive';

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
  userName: 'أ. فيصل بن سعد العتيبي',
  principalName: 'أ. خالد الحربي',
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
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2563EB"/></svg>'
  );

test('Group 5 registration, legacy empty detection, and 3x idempotent migration for both models', async () => {
  assert.ok(
    TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS.includes(
      TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY
    ),
    'Group 5 storage key must be registered in global media reference keys'
  );

  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  // Factory defaults with only settings subject/stage should be treated as empty
  const emptyInternal = createInitialTestOrEvaluationState(
    'internal-test-execution',
    mockSettings
  );
  const emptyTask = createInitialTestOrEvaluationState(
    'performance-task-execution',
    mockSettings
  );
  assert.equal(
    isLegacyTestEvalEmpty(
      'internal-test-execution',
      emptyInternal,
      mockSettings
    ),
    true
  );
  assert.equal(
    isLegacyTestEvalEmpty(
      'performance-task-execution',
      emptyTask,
      mockSettings
    ),
    true
  );

  // Seed legacy keys: internal-test-execution populated + Photo, performance-task-execution factory empty
  const populatedInternal: InternalTestExecutionFormState = {
    ...(createSampleTestOrEvaluationState(
      'internal-test-execution',
      mockSettings
    ) as InternalTestExecutionFormState),
    testName: 'الاختبار التشخيصي لوحدة الهندسة',
    maxScore: '25',
    targetStudentsCount: '32',
    performedStudentsCount: '29',
    evidencePhotos: [{ id: 'legacy-ite-photo-1', imageDataUrl: PNG_1PX_DATA_URL }],
  };

  storage.setItem(
    `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}internal-test-execution`,
    JSON.stringify(populatedInternal)
  );
  storage.setItem(
    `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}performance-task-execution`,
    JSON.stringify(emptyTask)
  );

  // Run migration 3 times to verify strict idempotency
  const run1 = await migrateTestsAndEvaluationToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  const run2 = await migrateTestsAndEvaluationToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  const run3 = await migrateTestsAndEvaluationToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  assert.equal(run1.migratedCount, 1);
  assert.equal(run1.skippedEmptyCount, 1);
  assert.equal(run2.alreadyCompleted, true);
  assert.equal(run3.alreadyCompleted, true);
  assert.equal(run2.migratedCount, 0);
  assert.equal(run3.migratedCount, 0);

  // Migration state & preMigrationArchiveRaw snapshot must exist for tests-evaluation
  const migState = loadMigrationState(storage);
  assert.ok(storage.getItem(TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY) !== null);
  assert.ok(migState.groups['tests-evaluation'] !== undefined);
  assert.equal(
    migState.groups['tests-evaluation']?.preMigrationArchiveRaw,
    null
  );

  // Legacy keys must remain intact
  assert.ok(
    storage.getItem(
      `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}internal-test-execution`
    ) !== null
  );

  // No auto-link to teacher portfolio
  assert.equal(storage.getItem('maktabi_teacher_portfolio_v1'), null);

  // Migrated draft must live under activeDraftByFormId (not archived_saved), zero Base64 inside JSON
  const rawArchiveJson =
    storage.getItem(TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY) || '';
  assert.equal(rawArchiveJson.includes('data:image/'), false);
  assert.equal(rawArchiveJson.includes('iVBORw0KGgo'), false);

  const store = loadTestsEvalArchiveStore(storage);
  assert.equal(Object.keys(store.records).length, 0);
  const migratedDraft = store.activeDraftByFormId['internal-test-execution'];
  assert.ok(migratedDraft);
  assert.equal(migratedDraft.recordState, 'draft');
  assert.equal(migratedDraft.isPortfolioEligible, false);
  assert.equal(migratedDraft.mediaRefs.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 1);

  // Hydrate back active draft with photo and verify math parity
  const hydrated = await loadActiveTestEvalDraftWithMedia(
    'internal-test-execution',
    {
      settings: mockSettings,
      storage,
      mediaRepo,
    }
  );
  assert.equal(hydrated.integrityWarnings.length, 0);
  assert.equal(hydrated.formData.formId, 'internal-test-execution');
  assert.equal(hydrated.formData.testName, 'الاختبار التشخيصي لوحدة الهندسة');
  assert.equal(hydrated.formData.evidencePhotos.length, 1);
  assert.ok(
    hydrated.formData.evidencePhotos[0].imageDataUrl.startsWith('data:image/png;base64,')
  );
});

test('Multi-record CRUD, immutable IDs, calculation/analysis parity, search/filter, and no portfolio auto-link', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  // Save 2 internal-test-execution records + 1 performance-task-execution record
  const test1: InternalTestExecutionFormState = {
    ...(createSampleTestOrEvaluationState(
      'internal-test-execution',
      mockSettings
    ) as InternalTestExecutionFormState),
    testName: 'اختبار الفترة الأولى — الكسور',
    grade: 'الصف الأول المتوسط',
    maxScore: '25.5',
    targetStudentsCount: '٣٥',
    performedStudentsCount: '٣٠',
    evidencePhotos: [{ id: 'p1', imageDataUrl: PNG_1PX_DATA_URL }],
    evidenceLinks: [{ id: 'l1', url: 'https://madrasati.sa/test/1' }],
  };

  const savedTest1 = await saveTestEvalToArchive(test1, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(savedTest1.isNew, true);
  assert.equal(savedTest1.record.recordState, 'archived_saved');
  assert.equal(savedTest1.record.isPortfolioEligible, true);

  // Create new blank draft -> must not touch savedTest1
  const blank = createNewBlankTestEvalInArchive('internal-test-execution', {
    settings: mockSettings,
    storage,
  });
  assert.equal(blank.formData.testName, '');
  assert.equal(
    listSavedTestsAndEvaluations('internal-test-execution', storage).length,
    1
  );

  // Save second independent internal test
  const test2: InternalTestExecutionFormState = {
    ...(createSampleTestOrEvaluationState(
      'internal-test-execution',
      mockSettings
    ) as InternalTestExecutionFormState),
    testName: 'اختبار نهاية الوحدة الثانية — النسبة والتناسب',
    grade: 'الصف الثاني المتوسط',
    testCategory: 'تصنيف آخر',
    customTestCategory: 'اختبار قصير تطبيقي',
    maxScore: '15',
    targetStudentsCount: '28',
    performedStudentsCount: '26',
    executionMethod: 'إلكتروني',
  };
  const savedTest2 = await saveTestEvalToArchive(test2, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(savedTest2.isNew, true);
  assert.notEqual(savedTest1.record.id, savedTest2.record.id);

  // Save performance task record
  const task1: PerformanceTaskExecutionFormState = {
    ...(createSampleTestOrEvaluationState(
      'performance-task-execution',
      mockSettings
    ) as PerformanceTaskExecutionFormState),
    taskName: 'مشروع مجسمات الأشكال الثلاثية',
    grade: 'الصف الثالث المتوسط',
    targetStudentsCount: '30',
    completedStudentsCount: '27',
    evidencePhotos: [{ id: 'tp1', imageDataUrl: SVG_DATA_URL_ALT }],
  };
  const savedTask1 = await saveTestEvalToArchive(task1, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(savedTask1.isNew, true);

  // Edit test1 while keeping its immutable ID
  const editedTest1Payload: InternalTestExecutionFormState = {
    ...test1,
    additionalNotes: 'تمت مراجعة ورصد الحضور بنجاح.',
  };
  const updatedTest1 = await saveTestEvalToArchive(editedTest1Payload, {
    recordId: savedTest1.record.id,
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(updatedTest1.isNew, false);
  assert.equal(updatedTest1.record.id, savedTest1.record.id);

  // Reopen savedTest1 and verify 100% numeric calculation, validation, and PDF doc parity
  const reopenedTest1 = await loadArchivedTestEvalWithMedia(
    savedTest1.record.id,
    {
      formId: 'internal-test-execution',
      settings: mockSettings,
      storage,
      mediaRepo,
    }
  );
  assert.ok(reopenedTest1);
  assert.equal(reopenedTest1.integrityWarnings.length, 0);
  const loadedIte = reopenedTest1.formData as InternalTestExecutionFormState;
  assert.equal(validateTestOrEvaluationState(loadedIte).length, 0);
  assert.equal(parseFlexibleScore(loadedIte.maxScore), 25.5);
  const iteCountCalc = calculateRemainingStudentsCount(
    loadedIte.targetStudentsCount,
    loadedIte.performedStudentsCount,
    'المؤدين'
  );
  assert.equal(iteCountCalc.isValid, true);
  assert.equal(iteCountCalc.remainingCount, 5); // ٣٥ - ٣٠ = ٥
  const doc1 = buildTeacherTestOrEvaluationDocument(loadedIte, mockSettings);
  assert.ok(paginateTeacherReportBlocks(doc1, mockSettings).length >= 1);

  // Reopen savedTask1 and verify parity
  const reopenedTask1 = await loadArchivedTestEvalWithMedia(
    savedTask1.record.id,
    {
      formId: 'performance-task-execution',
      settings: mockSettings,
      storage,
      mediaRepo,
    }
  );
  assert.ok(reopenedTask1);
  const loadedPte = reopenedTask1.formData as PerformanceTaskExecutionFormState;
  const pteCountCalc = calculateRemainingStudentsCount(
    loadedPte.targetStudentsCount,
    loadedPte.completedStudentsCount,
    'المنجزين'
  );
  assert.equal(pteCountCalc.isValid, true);
  assert.equal(pteCountCalc.remainingCount, 3); // 30 - 27 = 3

  // Verify filter & search across archive records
  const allSaved = listSavedTestsAndEvaluations(undefined, storage);
  assert.equal(allSaved.length, 3);
  assert.equal(
    filterTestEvalArchiveRecords(allSaved, {
      formIdFilter: 'internal-test-execution',
    }).length,
    2
  );
  assert.equal(
    filterTestEvalArchiveRecords(allSaved, {
      formIdFilter: 'performance-task-execution',
      searchQuery: 'الثلاثية',
    }).length,
    1
  );
  assert.equal(
    filterTestEvalArchiveRecords(allSaved, {
      formIdFilter: 'internal-test-execution',
      searchQuery: 'الكسور',
    })[0]?.id,
    savedTest1.record.id
  );

  // Never auto-linked to portfolio
  assert.equal(storage.getItem('maktabi_teacher_portfolio_v1'), null);
});

test('SHA-256 deduplication, CRC-32 integrity detection, 5-group cross-archive ref-counting, delete guard & rollback isolation', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const sharedBytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13,
  ]);
  const sharedHash = computeSha256HexSync(sharedBytes);
  const sharedBlobKey = `sha256:${sharedHash}`;

  // Seed Group 4 (peer visits) referencing sharedBlobKey to verify 5-group ref counting
  storage.setItem(
    'maktabi_teacher_peer_visits_archive_v1',
    JSON.stringify({
      schemaVersion: 1,
      groupId: 'peer-visits',
      records: {
        pv_rec_1: {
          id: 'pv_rec_1',
          groupId: 'peer-visits',
          formId: 'peer-visit-report',
          mediaRefs: [
            {
              id: 'm1',
              blobKey: sharedBlobKey,
              contentSha256: sharedHash,
              crc32: 123,
              fileName: 'shared.png',
              mimeType: 'image/png',
              byteLength: sharedBytes.byteLength,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
      activeDraftByFormId: {},
      migrationState: { completed: true },
    })
  );

  // Seed Group 1 (reports) with a distinct record so we prove rollback leaves Group 1 & 4 intact
  storage.setItem(
    'maktabi_teacher_reports_archive_v1',
    JSON.stringify({
      schemaVersion: 1,
      groupId: 'reports',
      records: { rep_1: { id: 'rep_1' } },
      activeDraftByFormId: {},
      migrationState: { completed: true },
    })
  );

  // Save two Group 5 records using the exact same PNG_1PX_DATA_URL (dedup) and another using SVG_DATA_URL_ALT (exclusive)
  const testWithSharedWithG4: InternalTestExecutionFormState = {
    ...(createSampleTestOrEvaluationState(
      'internal-test-execution',
      mockSettings
    ) as InternalTestExecutionFormState),
    testName: 'اختبار بمرفق مشترك مع الزيارات التبادلية',
    evidencePhotos: [
      { id: 'img-shared', imageDataUrl: PNG_1PX_DATA_URL },
      { id: 'img-exclusive', imageDataUrl: SVG_DATA_URL_ALT },
    ],
  };

  const savedA = await saveTestEvalToArchive(testWithSharedWithG4, {
    settings: mockSettings,
    storage,
    mediaRepo,
  });

  // Also test dedup when saving second record with identical PNG_1PX_DATA_URL
  const savedB = await saveTestEvalToArchive(
    {
      ...(createSampleTestOrEvaluationState(
        'performance-task-execution',
        mockSettings
      ) as PerformanceTaskExecutionFormState),
      taskName: 'مهمة بمرفق متطابق SHA-256',
      evidencePhotos: [{ id: 'img-dup', imageDataUrl: PNG_1PX_DATA_URL }],
    },
    { settings: mockSettings, storage, mediaRepo }
  );

  assert.equal(savedA.mediaRefs[0].blobKey, savedB.mediaRefs[0].blobKey);
  assert.equal(await mediaRepo.countBlobs(), 2); // PNG + SVG only (no duplicate)

  // Verify countBlobReferences spans Group 5 store
  const refCountPng = countBlobReferences(savedA.mediaRefs[0].blobKey, {
    storage,
  });
  assert.equal(refCountPng, 2); // savedA + savedB

  // Link savedB to teacher portfolio and verify Delete Guard blocks unconfirmed delete
  storage.setItem(
    'maktabi_teacher_portfolio_v1',
    JSON.stringify({
      schemaVersion: 1,
      teacherName: mockSettings.userName,
      updatedAt: new Date().toISOString(),
      elements: {
        'elem-1': {
          title: 'عنصر التقويم التكويني والاختبارات',
          linkedRecords: [
            {
              sourceRecordId: savedB.record.id,
              sourceGroupId: 'tests-evaluation',
              formId: 'performance-task-execution',
              title: savedB.record.title,
            },
          ],
        },
      },
      sourceDeletionAuditLog: [],
    })
  );

  const impact = inspectArchivedTestEvalDeletionImpact(savedB.record.id, {
    storage,
  });
  assert.equal(impact.isLinked, true);
  assert.equal(impact.sharedBlobKeys.includes(savedB.mediaRefs[0].blobKey), true);

  const blocked = await deleteArchivedTestEvalRecordSafely(savedB.record.id, {
    confirmUnlink: false,
    storage,
    mediaRepo,
  });
  assert.equal(blocked.result.requiresConfirmation, true);
  assert.equal(blocked.result.deleted, false);

  // Confirm delete -> must unlink portfolio, append audit log, delete savedB, and KEEP shared PNG blob (still used by savedA)
  const confirmed = await deleteArchivedTestEvalRecordSafely(savedB.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(confirmed.result.deleted, true);
  assert.deepEqual(confirmed.result.unlinkedElementIds, ['elem-1']);
  assert.equal(
    confirmed.result.preservedSharedBlobKeys.includes(
      savedB.mediaRefs[0].blobKey
    ),
    true
  );
  assert.equal(await mediaRepo.countBlobs(), 2);

  const updatedPortfolio = JSON.parse(
    storage.getItem('maktabi_teacher_portfolio_v1') || '{}'
  );
  assert.equal(updatedPortfolio.elements['elem-1'].linkedRecords.length, 0);
  assert.equal(updatedPortfolio.sourceDeletionAuditLog.length, 1);

  // Corrupt SVG blob inside mediaRepo -> verify CRC-32 / SHA-256 detection triggers warning
  const svgBlobKey = savedA.mediaRefs[1].blobKey;
  const rawSvgBlob = await mediaRepo.getBlob(svgBlobKey);
  assert.ok(rawSvgBlob);
  await mediaRepo.putBlob({
    ...rawSvgBlob,
    bytes: new Uint8Array([9, 9, 9, 9]),
  });

  const hydratedCorrupted = await loadArchivedTestEvalWithMedia(
    savedA.record.id,
    {
      settings: mockSettings,
      storage,
      mediaRepo,
    }
  );
  assert.ok(hydratedCorrupted);
  assert.ok(hydratedCorrupted.integrityWarnings.length >= 1);

  // Seed a Group 5 legacy draft, run migration on a fresh Group 5 key while keeping pre-existing Group 1 & 4 stores,
  // then verify rollback restores pre-migration Group 5 state & preserves Groups 1 & 4 + shared media
  const rbLegacy: InternalTestExecutionFormState = {
    ...(createSampleTestOrEvaluationState(
      'internal-test-execution',
      mockSettings
    ) as InternalTestExecutionFormState),
    testName: 'اختبار قبل التراجع عن الترحيل',
    evidencePhotos: [{ id: 'rb-p', imageDataUrl: PNG_1PX_DATA_URL }],
  };
  storage.removeItem(TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY);
  storage.setItem(
    `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}internal-test-execution`,
    JSON.stringify(rbLegacy)
  );
  const rbMig = await migrateTestsAndEvaluationToArchive({
    settings: mockSettings,
    storage,
    mediaRepo,
  });
  assert.equal(rbMig.migratedCount, 1);
  assert.ok(storage.getItem(TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY) !== null);

  const rbOutcome = await rollbackTestsAndEvaluationMigration({
    storage,
    mediaRepo,
  });
  assert.equal(rbOutcome.rolledBack, true);
  assert.equal(storage.getItem(TEACHER_TESTS_EVAL_ARCHIVE_STORAGE_KEY), null);
  assert.ok(
    storage.getItem(
      `${TESTS_EVAL_LEGACY_DRAFT_PREFIX}internal-test-execution`
    ) !== null
  );
  assert.ok(storage.getItem('maktabi_teacher_reports_archive_v1') !== null);
  assert.ok(storage.getItem('maktabi_teacher_peer_visits_archive_v1') !== null);
});
