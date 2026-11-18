import test from 'node:test';
import assert from 'node:assert/strict';
import { SchoolSettings } from '../types';
import {
  TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY,
  TEACHER_PORTFOLIO_STORAGE_KEY,
} from './teacherArchiveEngine';
import {
  bytesToDataUrl,
  createMemoryTeacherMediaRepository,
  loadMediaBlobWithIntegrityCheck,
} from './teacherMediaStorage';
import {
  createNewBlankReportInArchive,
  deleteArchivedReportRecordSafely,
  inspectArchivedReportDeletionImpact,
  listSavedReportsForForm,
  loadActiveReportDraftWithMedia,
  loadArchivedReportWithMedia,
  loadReportsArchiveStore,
  migrateProfessionalReportsToArchive,
  rollbackProfessionalReportsMigration,
  saveReportToArchive,
  TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
} from './teacherReportsArchive';
import {
  createInitialTeacherReportData,
  createSampleTeacherReportFormData,
  TEACHER_PROFESSIONAL_REPORTS_CATALOG,
  TEACHER_REPORTS_STORAGE_KEY,
} from './teacherReportsEngine';

function createMemoryStorage(initial?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial || {}));
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
  };
}

const TEST_SETTINGS: Partial<SchoolSettings> = {
  schoolName: 'متوسطة النور',
  userName: 'أ. صالح العتيبي',
  academicYear: '1447هـ',
  semester: 'الفصل الدراسي الأول',
  gender: 'male',
};

const SAMPLE_PNG_DATA_URL_A = bytesToDataUrl(
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]),
  'image/png'
);

const SAMPLE_PNG_DATA_URL_B = bytesToDataUrl(
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 8, 7, 6, 5]),
  'image/png'
);

test('Pilot Group 1 migration migrates populated legacy drafts safely, preserves legacy key, avoids promoting drafts, and is idempotent', async () => {
  const repo = createMemoryTeacherMediaRepository();

  // Populate 4 non-empty legacy reports (with shared photo) + 1 completely untouched/empty form
  const r1 = createSampleTeacherReportFormData(
    'strategy-implementation',
    TEST_SETTINGS
  );
  r1.evidencePhotos = [{ id: 'p1', imageDataUrl: SAMPLE_PNG_DATA_URL_A }];

  const r2 = createSampleTeacherReportFormData(
    'problem-remediation',
    TEST_SETTINGS
  );
  // Intentionally identical photo bytes as r1 to verify cross-report deduplication!
  r2.evidencePhotos = [{ id: 'p2', imageDataUrl: SAMPLE_PNG_DATA_URL_A }];

  const r3 = createSampleTeacherReportFormData(
    'learning-outcomes-analysis',
    TEST_SETTINGS
  );
  const r4 = createSampleTeacherReportFormData(
    'distinguished-practice',
    TEST_SETTINGS
  );
  const r5Empty = createInitialTeacherReportData(
    'professional-achievement',
    TEST_SETTINGS
  );

  const legacySnapshot = JSON.stringify({
    'strategy-implementation': r1,
    'problem-remediation': r2,
    'learning-outcomes-analysis': r3,
    'distinguished-practice': r4,
    'professional-achievement': r5Empty,
  });

  const storage = createMemoryStorage({
    [TEACHER_REPORTS_STORAGE_KEY]: legacySnapshot,
  });

  // First migration run
  const run1 = await migrateProfessionalReportsToArchive({
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });

  assert.equal(run1.migratedCount, 4);
  assert.equal(run1.skippedEmptyCount, 1);
  assert.equal(run1.alreadyCompleted, false);
  // Deduplication: identical photo across r1 and r2 yielded only 1 blob in IndexedDB
  assert.equal(await repo.countBlobs(), 1);

  // Legacy key MUST remain untouched
  assert.equal(storage.getItem(TEACHER_REPORTS_STORAGE_KEY), legacySnapshot);

  // Verify archive structure: drafts stay as 'draft' with isPortfolioEligible === false, NO Base64 strings stored in archive
  const archiveRaw = storage.getItem(TEACHER_REPORTS_ARCHIVE_STORAGE_KEY)!;
  assert.ok(archiveRaw);
  assert.equal(archiveRaw.includes('data:image/'), false);

  const store = loadReportsArchiveStore(storage);
  assert.equal(Object.keys(store.records).length, 0);
  assert.equal(Object.keys(store.activeDraftByFormId).length, 4);
  assert.equal(
    store.activeDraftByFormId['professional-achievement'],
    undefined
  );

  for (const formId of [
    'strategy-implementation',
    'problem-remediation',
    'learning-outcomes-analysis',
    'distinguished-practice',
  ] as const) {
    const d = store.activeDraftByFormId[formId];
    assert.equal(d.recordState, 'draft');
    assert.equal(d.isPortfolioEligible, false);
    assert.equal(d.academicYear, '1447هـ');
    assert.equal(d.semester, 'الفصل الدراسي الأول');
  }

  // Verify hydrated draft restores evidencePhotos from IndexedDB
  const loadedDraft = await loadActiveReportDraftWithMedia(
    'strategy-implementation',
    { settings: TEST_SETTINGS, storage, mediaRepo: repo }
  );
  assert.equal(loadedDraft.formData.evidencePhotos.length, 1);
  assert.equal(
    loadedDraft.formData.evidencePhotos[0].imageDataUrl,
    SAMPLE_PNG_DATA_URL_A
  );

  // Second and third runs MUST be idempotent (0 new records, 0 duplicate blobs)
  const run2 = await migrateProfessionalReportsToArchive({
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  const run3 = await migrateProfessionalReportsToArchive({
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  assert.equal(run2.migratedCount, 0);
  assert.equal(run2.skippedAlreadyMigratedCount, 4);
  assert.equal(run2.alreadyCompleted, true);
  assert.equal(run3.migratedCount, 0);
  assert.equal(await repo.countBlobs(), 1);
});

test('Multi-record archive preserves immutable IDs on edit, keeps older saved records when creating new blank draft, and hydrates photos on reload', async () => {
  const repo = createMemoryTeacherMediaRepository();
  const storage = createMemoryStorage();

  // Save first report into archive
  const report1 = createSampleTeacherReportFormData(
    'strategy-implementation',
    TEST_SETTINGS
  );
  report1.strategyName = 'التعلم النشط';
  report1.evidencePhotos = [{ id: 'ph-1', imageDataUrl: SAMPLE_PNG_DATA_URL_A }];

  const saved1 = await saveReportToArchive('strategy-implementation', report1, {
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  assert.equal(saved1.isNew, true);
  assert.ok(saved1.record.id.startsWith('trec_'));
  assert.equal(saved1.record.recordState, 'archived_saved');
  assert.equal(saved1.record.isPortfolioEligible, true);

  // Create new blank report -> must NOT overwrite saved1
  const createdBlank = createNewBlankReportInArchive(
    'strategy-implementation',
    { settings: TEST_SETTINGS, storage }
  );
  assert.equal(createdBlank.formData.strategyName, '');
  assert.equal(
    listSavedReportsForForm('strategy-implementation', storage).length,
    1
  );

  // Fill and save second report
  const report2 = createSampleTeacherReportFormData(
    'strategy-implementation',
    TEST_SETTINGS
  );
  report2.strategyName = 'الصف المقلوب';
  report2.evidencePhotos = [{ id: 'ph-2', imageDataUrl: SAMPLE_PNG_DATA_URL_B }];

  const saved2 = await saveReportToArchive('strategy-implementation', report2, {
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  assert.equal(saved2.isNew, true);
  assert.notEqual(saved2.record.id, saved1.record.id);
  assert.equal(
    listSavedReportsForForm('strategy-implementation', storage).length,
    2
  );

  // Re-open report1, edit title, and re-save -> ID MUST stay identical!
  const reopened1 = await loadArchivedReportWithMedia(saved1.record.id, {
    formId: 'strategy-implementation',
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  assert.ok(reopened1);
  assert.equal(
    reopened1.formData.evidencePhotos[0].imageDataUrl,
    SAMPLE_PNG_DATA_URL_A
  );

  reopened1.formData.strategyName = 'التعلم النشط (محدث)';
  const resaved1 = await saveReportToArchive(
    'strategy-implementation',
    reopened1.formData,
    {
      recordId: reopened1.record.id,
      settings: TEST_SETTINGS,
      storage,
      mediaRepo: repo,
    }
  );
  assert.equal(resaved1.isNew, false);
  assert.equal(resaved1.record.id, saved1.record.id);
  assert.equal(
    listSavedReportsForForm('strategy-implementation', storage).length,
    2
  );
});

test('Safe delete blocks unconfirmed portfolio-linked records, shows warning, unlinks + audits on confirm, and preserves shared blobs', async () => {
  const repo = createMemoryTeacherMediaRepository();
  const storage = createMemoryStorage();

  // Save two reports sharing the exact same image blob + report A also has an exclusive image blob
  const reportA = createSampleTeacherReportFormData(
    'distinguished-practice',
    TEST_SETTINGS
  );
  reportA.practiceName = 'ممارسة أ';
  reportA.evidencePhotos = [
    { id: 'shared-1', imageDataUrl: SAMPLE_PNG_DATA_URL_A },
    { id: 'exclusive-1', imageDataUrl: SAMPLE_PNG_DATA_URL_B },
  ];

  const reportB = createSampleTeacherReportFormData(
    'professional-achievement',
    TEST_SETTINGS
  );
  reportB.achievementName = 'إنجاز ب';
  reportB.evidencePhotos = [
    { id: 'shared-2', imageDataUrl: SAMPLE_PNG_DATA_URL_A },
  ];

  const savedA = await saveReportToArchive('distinguished-practice', reportA, {
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  const savedB = await saveReportToArchive(
    'professional-achievement',
    reportB,
    {
      settings: TEST_SETTINGS,
      storage,
      mediaRepo: repo,
    }
  );
  assert.equal(await repo.countBlobs(), 2);

  // Link reportA inside future portfolio structure
  storage.setItem(
    TEACHER_PORTFOLIO_STORAGE_KEY,
    JSON.stringify({
      elements: {
        el_03: {
          title: 'التنويع في استراتيجيات التدريس',
          linkedRecords: [
            {
              sourceGroupId: 'professional-reports',
              sourceRecordId: savedA.record.id,
            },
          ],
        },
      },
      sourceDeletionAuditLog: [],
    })
  );

  // Inspect impact
  const impact = inspectArchivedReportDeletionImpact(savedA.record.id, {
    storage,
  });
  assert.equal(impact.isLinked, true);
  assert.equal(impact.linkedElements.length, 1);
  assert.equal(impact.sharedBlobKeys.length, 1);
  assert.equal(impact.exclusiveBlobKeys.length, 1);
  assert.ok(impact.warningMessage?.includes('التنويع في استراتيجيات التدريس'));

  // Attempt delete WITHOUT confirmation -> MUST refuse
  const blocked = await deleteArchivedReportRecordSafely(savedA.record.id, {
    confirmUnlink: false,
    storage,
    mediaRepo: repo,
  });
  assert.equal(blocked.result.deleted, false);
  assert.equal(blocked.result.requiresConfirmation, true);
  assert.equal(listSavedReportsForForm(undefined, storage).length, 2);

  // Confirm delete -> unlinks portfolio, logs audit, deletes exclusive blob, PRESERVES shared blob used by savedB!
  const confirmed = await deleteArchivedReportRecordSafely(savedA.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo: repo,
  });
  assert.equal(confirmed.result.deleted, true);
  assert.deepEqual(confirmed.result.unlinkedElementIds, ['el_03']);
  assert.equal(confirmed.result.preservedSharedBlobKeys.length, 1);
  assert.equal(confirmed.result.removedBlobKeys.length, 1);
  assert.equal(await repo.countBlobs(), 1);

  const sharedBlobCheck = await loadMediaBlobWithIntegrityCheck(
    savedB.record.mediaRefs[0].blobKey,
    savedB.record.mediaRefs[0],
    repo
  );
  assert.equal(sharedBlobCheck.ok, true);

  // Verify portfolio audit log and unlink
  const updatedPortfolio = JSON.parse(
    storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!
  );
  assert.equal(updatedPortfolio.elements.el_03.linkedRecords.length, 0);
  assert.equal(updatedPortfolio.sourceDeletionAuditLog.length, 1);
  assert.equal(
    updatedPortfolio.sourceDeletionAuditLog[0].deletedRecordId,
    savedA.record.id
  );
});

test('rollbackProfessionalReportsMigration restores pre-migration archive state and cleans newly migrated blobs without touching legacy storage', async () => {
  const repo = createMemoryTeacherMediaRepository();
  const r1 = createSampleTeacherReportFormData(
    'strategy-implementation',
    TEST_SETTINGS
  );
  r1.evidencePhotos = [{ id: 'p1', imageDataUrl: SAMPLE_PNG_DATA_URL_A }];

  const legacyRaw = JSON.stringify({
    'strategy-implementation': r1,
  });
  const storage = createMemoryStorage({
    [TEACHER_REPORTS_STORAGE_KEY]: legacyRaw,
  });

  const mig = await migrateProfessionalReportsToArchive({
    settings: TEST_SETTINGS,
    storage,
    mediaRepo: repo,
  });
  assert.equal(mig.migratedCount, 1);
  assert.equal(await repo.countBlobs(), 1);
  assert.ok(storage.getItem(TEACHER_REPORTS_ARCHIVE_STORAGE_KEY));

  const rb = await rollbackProfessionalReportsMigration({
    storage,
    mediaRepo: repo,
  });
  assert.equal(rb.rolledBack, true);
  assert.equal(rb.restoredArchiveKey, true);
  assert.equal(rb.removedBlobKeys.length, 1);
  assert.equal(await repo.countBlobs(), 0);
  assert.equal(storage.getItem(TEACHER_REPORTS_ARCHIVE_STORAGE_KEY), null);
  assert.equal(storage.getItem(TEACHER_REPORTS_STORAGE_KEY), legacyRaw);

  // Confirm migration state recorded rollback and allows clean re-run later
  const migState = JSON.parse(
    storage.getItem(TEACHER_ARCHIVE_MIGRATION_STORAGE_KEY)!
  );
  assert.ok(migState.groups['professional-reports'].rolledBackAt);
  assert.equal(TEACHER_PROFESSIONAL_REPORTS_CATALOG.length, 5);
});
