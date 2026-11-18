import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  loadGroupArchiveStore,
  loadMigrationState,
  TEACHER_PORTFOLIO_STORAGE_KEY,
  upsertArchivedRecord,
} from './teacherArchiveEngine';
import {
  bytesToDataUrl,
  createMemoryTeacherMediaRepository,
  saveMediaDataUrl,
} from './teacherMediaStorage';
import {
  createInitialTeacherPlanData,
  createSampleTeacherPlanFormData,
  saveTeacherPlanDraftToStorage,
  TEACHER_PLANS_CATALOG,
  TEACHER_PLANS_STORAGE_KEY,
  TeacherPlanFormId,
} from './teacherPlansEngine';
import {
  createNewBlankPlanInArchive,
  deleteArchivedPlanRecordSafely,
  inspectArchivedPlanDeletionImpact,
  listSavedPlansForForm,
  loadActivePlanDraftWithMedia,
  loadArchivedPlanWithMedia,
  loadPlansArchiveStore,
  migrateTeacherPlansToArchive,
  rollbackTeacherPlansMigration,
  savePlanToArchive,
  TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
} from './teacherPlansArchive';
import { TEACHER_REPORTS_ARCHIVE_STORAGE_KEY } from './teacherReportsArchive';

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
    snapshotKeys: () => Array.from(map.keys()),
  };
}

function makeSamplePngDataUrl(seedByte: number): string {
  // Minimal valid deterministic binary bytes encoded as image/png data URL
  const bytes = new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    seedByte & 0xff,
    (seedByte * 3) & 0xff,
    (seedByte * 7 + 11) & 0xff,
    42,
    99,
  ]);
  return bytesToDataUrl(bytes, 'image/png');
}

test('1. Saving two archived plans of the same model creates distinct immutable records without overwriting', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const plan1Data = createSampleTeacherPlanFormData(
    'professional-development-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  plan1Data.planTitle = 'خطة التطوير المهني — الفصل الأول';
  plan1Data.subject = 'الرياضيات';

  const saved1 = await savePlanToArchive(
    'professional-development-plan',
    plan1Data,
    {
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    }
  );
  assert.equal(saved1.isNew, true);
  assert.ok(saved1.record.id.startsWith('trec_'));
  assert.equal(saved1.record.recordState, 'archived_saved');
  assert.equal(saved1.record.isPortfolioEligible, true);

  // Create a new blank draft before saving the second plan
  const createdBlank = createNewBlankPlanInArchive(
    'professional-development-plan',
    {
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
    }
  );
  assert.equal(createdBlank.draftRecord.recordState, 'draft');
  assert.equal(createdBlank.draftRecord.isPortfolioEligible, false);

  const plan2Data = createSampleTeacherPlanFormData(
    'professional-development-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  plan2Data.planTitle = 'خطة التطوير المهني — الفصل الثاني';
  plan2Data.subject = 'العلوم';

  const saved2 = await savePlanToArchive(
    'professional-development-plan',
    plan2Data,
    {
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    }
  );
  assert.equal(saved2.isNew, true);
  assert.ok(saved2.record.id.startsWith('trec_'));
  assert.notEqual(saved2.record.id, saved1.record.id);

  const list = listSavedPlansForForm('professional-development-plan', storage);
  assert.equal(list.length, 2);
  const titles = list.map((r) => r.title);
  assert.ok(titles.includes('خطة التطوير المهني — الفصل الأول'));
  assert.ok(titles.includes('خطة التطوير المهني — الفصل الثاني'));
});

test('2. Editing an archived plan preserves its immutable ID and leaves sibling archived plans untouched', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const d1 = createSampleTeacherPlanFormData(
    'weekly-teacher-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  d1.weekLabel = 'الأسبوع الأول';
  const s1 = await savePlanToArchive('weekly-teacher-plan', d1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const d2 = createSampleTeacherPlanFormData(
    'weekly-teacher-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  d2.weekLabel = 'الأسبوع الثاني';
  const s2 = await savePlanToArchive('weekly-teacher-plan', d2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Load s1, edit, save back with its existing recordId
  const loaded1 = await loadArchivedPlanWithMedia(s1.record.id, {
    formId: 'weekly-teacher-plan',
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(loaded1);
  loaded1.formData.subject = 'الفيزياء المتقدمة';

  const updated1 = await savePlanToArchive(
    'weekly-teacher-plan',
    loaded1.formData,
    {
      recordId: s1.record.id,
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    }
  );
  assert.equal(updated1.isNew, false);
  assert.equal(updated1.record.id, s1.record.id);
  assert.equal(updated1.record.payload.subject, 'الفيزياء المتقدمة');

  const list = listSavedPlansForForm('weekly-teacher-plan', storage);
  assert.equal(list.length, 2);
  const untouchedS2 = list.find((r) => r.id === s2.record.id);
  assert.ok(untouchedS2);
  assert.equal(
    (untouchedS2.payload as { weekLabel?: string }).weekLabel,
    'الأسبوع الثاني'
  );
});

test('3. Legacy migration handles all 5 plan models, offloads Base64 to IndexedDB, keeps legacy keys untouched, and leaves drafts as non-eligible', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const planIds: TeacherPlanFormId[] = [
    'professional-development-plan',
    'weekly-teacher-plan',
    'individual-remedial-plan',
    'group-remedial-plan',
    'enrichment-plan',
  ];

  const legacySnapshot = new Map<TeacherPlanFormId, string>();
  planIds.forEach((id, idx) => {
    const sample = createSampleTeacherPlanFormData(id, DEFAULT_SCHOOL_SETTINGS);
    sample.evidencePhotos = [
      { id: `leg-${id}`, imageDataUrl: makeSamplePngDataUrl(10 + idx) },
    ];
    saveTeacherPlanDraftToStorage(id, sample, storage);
    legacySnapshot.set(
      id,
      storage.getItem(`${TEACHER_PLANS_STORAGE_KEY}_${id}`)!
    );
  });

  const summary = await migrateTeacherPlansToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(summary.groupId, 'plans');
  assert.equal(summary.migratedCount, 5);
  assert.equal(summary.skippedEmptyCount, 0);
  assert.equal(summary.newlyCreatedBlobKeys.length, 5);
  assert.equal(await mediaRepo.countBlobs(), 5);

  const archiveStore = loadPlansArchiveStore(storage);
  assert.equal(Object.keys(archiveStore.records).length, 0);
  assert.equal(Object.keys(archiveStore.activeDraftByFormId).length, 5);

  const archiveJson = storage.getItem(TEACHER_PLANS_ARCHIVE_STORAGE_KEY) || '';
  assert.equal(archiveJson.includes('data:image/'), false);

  for (const id of planIds) {
    const draft = archiveStore.activeDraftByFormId[id];
    assert.ok(draft);
    assert.equal(draft.recordState, 'draft');
    assert.equal(draft.isPortfolioEligible, false);
    assert.equal(draft.mediaRefs.length, 1);
    assert.equal(draft.payload.evidencePhotos.length, 0);
    // Legacy storage remains 100% untouched
    assert.equal(
      storage.getItem(`${TEACHER_PLANS_STORAGE_KEY}_${id}`),
      legacySnapshot.get(id)
    );

    const hydrated = await loadActivePlanDraftWithMedia(id, {
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    });
    assert.equal(hydrated.formData.evidencePhotos.length, 1);
    assert.ok(
      hydrated.formData.evidencePhotos[0].imageDataUrl.startsWith('data:image/png;base64,')
    );
  }
});

test('4. Migration skips empty and factory-untouched drafts across all 5 plan models', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  for (const meta of TEACHER_PLANS_CATALOG) {
    const initial = createInitialTeacherPlanData(
      meta.id,
      DEFAULT_SCHOOL_SETTINGS
    );
    saveTeacherPlanDraftToStorage(meta.id, initial, storage);
  }

  const summary = await migrateTeacherPlansToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(summary.migratedCount, 0);
  assert.equal(summary.skippedEmptyCount, 5);
  assert.equal(await mediaRepo.countBlobs(), 0);

  const archiveStore = loadPlansArchiveStore(storage);
  assert.equal(Object.keys(archiveStore.activeDraftByFormId).length, 0);
  assert.equal(Object.keys(archiveStore.records).length, 0);
});

test('5. Re-running migration 3 times is completely idempotent with zero duplicate records or blobs', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const d = createSampleTeacherPlanFormData(
    'individual-remedial-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  d.evidencePhotos = [{ id: 'p1', imageDataUrl: makeSamplePngDataUrl(77) }];
  saveTeacherPlanDraftToStorage('individual-remedial-plan', d, storage);

  const run1 = await migrateTeacherPlansToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  const run2 = await migrateTeacherPlansToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  const run3 = await migrateTeacherPlansToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(run1.migratedCount, 1);
  assert.equal(run2.migratedCount, 0);
  assert.equal(run2.skippedAlreadyMigratedCount, 1);
  assert.equal(run2.alreadyCompleted, true);
  assert.equal(run3.migratedCount, 0);
  assert.equal(run3.skippedAlreadyMigratedCount, 1);
  assert.equal(await mediaRepo.countBlobs(), 1);
});

test('6. Rollback restores pre-migration archive state, removes unreferenced newly migrated blobs, and preserves legacy storage', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const d = createSampleTeacherPlanFormData(
    'group-remedial-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  d.evidencePhotos = [{ id: 'p-rb', imageDataUrl: makeSamplePngDataUrl(91) }];
  saveTeacherPlanDraftToStorage('group-remedial-plan', d, storage);
  const legacyBefore = storage.getItem(
    `${TEACHER_PLANS_STORAGE_KEY}_group-remedial-plan`
  );

  await migrateTeacherPlansToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 1);
  assert.ok(storage.getItem(TEACHER_PLANS_ARCHIVE_STORAGE_KEY));

  const rb = await rollbackTeacherPlansMigration({ storage, mediaRepo });
  assert.equal(rb.rolledBack, true);
  assert.equal(rb.restoredArchiveKey, true);
  assert.equal(rb.removedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);
  assert.equal(storage.getItem(TEACHER_PLANS_ARCHIVE_STORAGE_KEY), null);
  assert.equal(
    storage.getItem(`${TEACHER_PLANS_STORAGE_KEY}_group-remedial-plan`),
    legacyBefore
  );

  const migState = loadMigrationState(storage);
  assert.ok(migState.groups.plans?.rolledBackAt);
});

test('7. Identical evidence photos uploaded in two plans deduplicate via SHA-256 into a single blob', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const identicalUrl = makeSamplePngDataUrl(123);

  const p1 = createSampleTeacherPlanFormData(
    'enrichment-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  p1.planTitle = 'الخطة الإثرائية أ';
  p1.evidencePhotos = [{ id: 'a1', imageDataUrl: identicalUrl }];
  const s1 = await savePlanToArchive('enrichment-plan', p1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const p2 = createSampleTeacherPlanFormData(
    'enrichment-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  p2.planTitle = 'الخطة الإثرائية ب';
  p2.evidencePhotos = [{ id: 'b1', imageDataUrl: identicalUrl }];
  const s2 = await savePlanToArchive('enrichment-plan', p2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(s1.mediaRefs[0].blobKey, s2.mediaRefs[0].blobKey);
  assert.equal(s1.mediaRefs[0].contentSha256, s2.mediaRefs[0].contentSha256);
  assert.equal(await mediaRepo.countBlobs(), 1);
});

test('8. Corrupted IndexedDB attachment fails CRC-32 integrity check cleanly on plan reload', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const p = createSampleTeacherPlanFormData(
    'professional-development-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  p.evidencePhotos = [{ id: 'img-1', imageDataUrl: makeSamplePngDataUrl(55) }];
  const saved = await savePlanToArchive('professional-development-plan', p, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const blobKey = saved.mediaRefs[0].blobKey;
  const stored = await mediaRepo.getBlob(blobKey);
  assert.ok(stored);

  // Flip one byte in stored payload without updating CRC-32 or SHA-256
  const tamperedBytes = new Uint8Array(stored.bytes);
  tamperedBytes[tamperedBytes.length - 1] ^= 0xff;
  await mediaRepo.putBlob({
    ...stored,
    bytes: tamperedBytes,
  });

  const reloaded = await loadArchivedPlanWithMedia(saved.record.id, {
    formId: 'professional-development-plan',
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(reloaded);
  assert.equal(reloaded.formData.evidencePhotos.length, 0);
  assert.equal(reloaded.integrityWarnings.length, 1);
  assert.ok(reloaded.integrityWarnings[0].includes('CRC-32'));
});

test('9. Reference counting protects shared blobs on photo replacement and deletion across plans and Group 1 reports', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const sharedPhotoUrl = makeSamplePngDataUrl(201);
  const replacementPhotoUrl = makeSamplePngDataUrl(202);

  // Seed a Group 1 archived report referencing sharedPhotoUrl
  const savedInRepo = await saveMediaDataUrl(
    { dataUrl: sharedPhotoUrl, id: 'rep-photo', sourceTag: 'upload' },
    mediaRepo
  );
  const emptyReportStore = loadGroupArchiveStore<Record<string, unknown>>(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    'professional-reports',
    storage
  );
  const { nextStore: populatedReportsStore } = upsertArchivedRecord(
    emptyReportStore,
    {
      formId: 'strategy-implementation',
      title: 'تقرير استراتيجية يستخدم نفس الصورة',
      mediaRefs: [savedInRepo.mediaRef],
      payload: {},
    }
  );
  storage.setItem(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(populatedReportsStore)
  );

  // Save a Plan using the exact same sharedPhotoUrl
  const p = createSampleTeacherPlanFormData(
    'weekly-teacher-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  p.evidencePhotos = [{ id: 'plan-photo-1', imageDataUrl: sharedPhotoUrl }];
  const savedPlan = await savePlanToArchive('weekly-teacher-plan', p, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 1);

  // Replace the photo inside the archived plan with replacementPhotoUrl
  const updatedData = {
    ...p,
    evidencePhotos: [
      { id: 'plan-photo-2', imageDataUrl: replacementPhotoUrl },
    ],
  };
  await savePlanToArchive('weekly-teacher-plan', updatedData, {
    recordId: savedPlan.record.id,
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Both blobs exist: sharedPhotoUrl MUST NOT be removed because Group 1 report still references it!
  assert.equal(await mediaRepo.countBlobs(), 2);
  assert.ok(await mediaRepo.getBlob(savedInRepo.mediaRef.blobKey));

  // Verify inspectArchivedPlanDeletionImpact when another plan shares replacementPhotoUrl
  const p2 = createSampleTeacherPlanFormData(
    'enrichment-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  p2.evidencePhotos = [
    { id: 'plan2-photo', imageDataUrl: replacementPhotoUrl },
  ];
  await savePlanToArchive('enrichment-plan', p2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const impact = inspectArchivedPlanDeletionImpact(savedPlan.record.id, {
    storage,
  });
  assert.equal(impact.sharedBlobKeys.length, 1);

  const del = await deleteArchivedPlanRecordSafely(savedPlan.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(del.result.deleted, true);
  assert.equal(del.result.preservedSharedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 2);
});

test('10. Delete guard blocks unconfirmed deletion of portfolio-linked plan, unlinks cleanly & audits on confirm', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const p = createSampleTeacherPlanFormData(
    'individual-remedial-plan',
    DEFAULT_SCHOOL_SETTINGS
  );
  p.evidencePhotos = [{ id: 'p-guard', imageDataUrl: makeSamplePngDataUrl(88) }];
  const saved = await savePlanToArchive('individual-remedial-plan', p, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Link this plan to Element #3 inside maktabi_teacher_portfolio_v1
  storage.setItem(
    TEACHER_PORTFOLIO_STORAGE_KEY,
    JSON.stringify({
      elements: {
        'element-3': {
          title: 'تنوع أساليب التقويم والخطط العلاجية',
          linkedRecords: [
            {
              sourceGroupId: 'plans',
              sourceRecordId: saved.record.id,
              title: saved.record.title,
            },
          ],
        },
      },
      sourceDeletionAuditLog: [],
    })
  );

  // Unconfirmed delete MUST be blocked
  const blocked = await deleteArchivedPlanRecordSafely(saved.record.id, {
    confirmUnlink: false,
    storage,
    mediaRepo,
  });
  assert.equal(blocked.result.deleted, false);
  assert.equal(blocked.result.requiresConfirmation, true);
  assert.equal(blocked.result.impact.isLinked, true);
  assert.ok(blocked.result.impact.warningMessage?.includes('تنبيه'));
  assert.equal(listSavedPlansForForm('individual-remedial-plan', storage).length, 1);

  // Confirmed delete removes record, unlinks portfolio, logs audit, and removes exclusive blob
  const confirmed = await deleteArchivedPlanRecordSafely(saved.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(confirmed.result.deleted, true);
  assert.deepEqual(confirmed.result.unlinkedElementIds, ['element-3']);
  assert.equal(confirmed.result.removedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);
  assert.equal(listSavedPlansForForm('individual-remedial-plan', storage).length, 0);

  const portfolio = JSON.parse(
    storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!
  ) as {
    elements: { 'element-3': { linkedRecords: unknown[] } };
    sourceDeletionAuditLog: Array<{
      deletedGroupId: string;
      deletedRecordId: string;
      unlinkedElementIds: string[];
    }>;
  };
  assert.equal(portfolio.elements['element-3'].linkedRecords.length, 0);
  assert.equal(portfolio.sourceDeletionAuditLog.length, 1);
  assert.equal(portfolio.sourceDeletionAuditLog[0].deletedGroupId, 'plans');
  assert.equal(
    portfolio.sourceDeletionAuditLog[0].deletedRecordId,
    saved.record.id
  );
});

test('11. Archiving or migrating a plan does NOT automatically attach or link it as a portfolio evidence item', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  for (const meta of TEACHER_PLANS_CATALOG) {
    const sample = createSampleTeacherPlanFormData(
      meta.id,
      DEFAULT_SCHOOL_SETTINGS
    );
    await savePlanToArchive(meta.id, sample, {
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    });
  }

  assert.equal(listSavedPlansForForm(undefined, storage).length, 5);
  assert.equal(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY), null);
});
