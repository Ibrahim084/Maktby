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
  buildTeacherMeetingOrVisitDocument,
  createInitialMeetingOrVisitState,
  createSampleMeetingOrVisitState,
  MeetingMinutesFormState,
  PEER_VISIT_TOPIC_OPTIONS,
  PeerVisitReportFormState,
  validateMeetingOrVisitState,
} from './teacherMeetingsAndVisitsEngine';
import { TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY } from './teacherMeetingsArchive';
import {
  createNewBlankPeerVisitInArchive,
  deleteArchivedPeerVisitRecordSafely,
  inspectArchivedPeerVisitDeletionImpact,
  listSavedPeerVisits,
  loadActivePeerVisitDraftWithMedia,
  loadArchivedPeerVisitWithMedia,
  loadPeerVisitsArchiveStore,
  migratePeerVisitsToArchive,
  PEER_VISIT_LEGACY_DRAFT_KEY,
  rollbackPeerVisitsMigration,
  saveActivePeerVisitDraftWithMedia,
  saveLegacyPeerVisitDraft,
  savePeerVisitToArchive,
  TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY,
} from './teacherPeerVisitsArchive';
import { TEACHER_PLANS_ARCHIVE_STORAGE_KEY } from './teacherPlansArchive';
import { TEACHER_REPORTS_ARCHIVE_STORAGE_KEY } from './teacherReportsArchive';
import { paginateTeacherReportBlocks } from './teacherPdfEngine';

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

function makeSamplePngDataUrl(seedByte: number): string {
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

test('1. Saving two independent peer visit reports creates distinct immutable records without overwriting', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const v1 = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v1.observedPracticeTitle = 'توظيف التعلم القائم على المشاريع — الزيارة ١';
  v1.hostTeacherName = 'خالد بن سعد الدوسري';

  const s1 = await savePeerVisitToArchive(v1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(s1.isNew, true);
  assert.ok(s1.record.id.startsWith('trec_'));
  assert.equal(s1.record.groupId, 'peer-visits');
  assert.equal(s1.record.recordState, 'archived_saved');
  assert.equal(s1.record.isPortfolioEligible, true);

  // Start new blank visit draft before saving the second visit
  const blank = createNewBlankPeerVisitInArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
  });
  assert.equal(blank.draftRecord.recordState, 'draft');
  assert.equal(blank.draftRecord.isPortfolioEligible, false);

  const v2 = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v2.visitScope = 'بين معلمي المدرسة من تخصصات مختلفة';
  v2.observedPracticeTitle = 'توظيف المنصات التفاعلية في التمهيد — الزيارة ٢';
  v2.hostTeacherName = 'سلمان بن علي الشهري';

  const s2 = await savePeerVisitToArchive(v2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(s2.isNew, true);
  assert.ok(s2.record.id.startsWith('trec_'));
  assert.notEqual(s2.record.id, s1.record.id);

  const list = listSavedPeerVisits(storage);
  assert.equal(list.length, 2);
  const titles = list.map((r) => r.title);
  assert.ok(titles.includes('توظيف التعلم القائم على المشاريع — الزيارة ١'));
  assert.ok(titles.includes('توظيف المنصات التفاعلية في التمهيد — الزيارة ٢'));
});

test('2. Opening and editing an archived peer visit preserves its immutable ID and leaves sibling records untouched', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const v1 = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v1.observedPracticeTitle = 'زيارة استراتيجيات القراءة النشطة';
  const s1 = await savePeerVisitToArchive(v1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const v2 = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v2.observedPracticeTitle = 'زيارة إدارة الصف التفاعلية';
  const s2 = await savePeerVisitToArchive(v2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const loaded1 = await loadArchivedPeerVisitWithMedia(s1.record.id, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(loaded1);
  loaded1.formData.hostTeacherName = 'أ. فهد بن عبدالله القحطاني';
  loaded1.formData.enableTeacherSignatures = true;

  const updated1 = await savePeerVisitToArchive(loaded1.formData, {
    recordId: s1.record.id,
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(updated1.isNew, false);
  assert.equal(updated1.record.id, s1.record.id);
  assert.equal(
    updated1.record.payload.hostTeacherName,
    'أ. فهد بن عبدالله القحطاني'
  );
  assert.equal(updated1.record.payload.enableTeacherSignatures, true);

  const list = listSavedPeerVisits(storage);
  assert.equal(list.length, 2);
  const sibling = list.find((r) => r.id === s2.record.id);
  assert.ok(sibling);
  assert.equal(sibling.title, 'زيارة إدارة الصف التفاعلية');
});

test('3. Legacy migration preserves all peer visit fields and legacy key while keeping Group 3 meeting migration untouched', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const legacyVisit = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  legacyVisit.visitTopic = PEER_VISIT_TOPIC_OPTIONS[6]; // 'موضوع آخر'
  legacyVisit.customVisitTopic = 'توظيف المختبرات الافتراضية';
  legacyVisit.enableTeacherSignatures = true;
  legacyVisit.evidencePhotos = [
    { id: 'pv-leg-1', imageDataUrl: makeSamplePngDataUrl(33) },
  ];
  saveLegacyPeerVisitDraft(legacyVisit, storage);
  const legacyRawBefore = storage.getItem(PEER_VISIT_LEGACY_DRAFT_KEY);

  // Also seed Group 3 meetings archive to ensure Group 4 migration does NOT touch it
  const meetingStoreSeed = loadGroupArchiveStore<MeetingMinutesFormState>(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    'meetings-visits',
    storage
  );
  storage.setItem(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(meetingStoreSeed)
  );
  const meetingsBefore = storage.getItem(TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY);

  const summary = await migratePeerVisitsToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(summary.groupId, 'peer-visits');
  assert.equal(summary.migratedCount, 1);
  assert.equal(await mediaRepo.countBlobs(), 1);

  const archiveStore = loadPeerVisitsArchiveStore(storage);
  assert.equal(Object.keys(archiveStore.records).length, 0);
  const activeDraft = archiveStore.activeDraftByFormId['peer-visit-report'];
  assert.ok(activeDraft);
  assert.equal(activeDraft.recordState, 'draft');
  assert.equal(activeDraft.isPortfolioEligible, false);
  assert.equal(
    activeDraft.payload.customVisitTopic,
    'توظيف المختبرات الافتراضية'
  );
  assert.equal(activeDraft.mediaRefs.length, 1);
  assert.equal(activeDraft.payload.evidencePhotos.length, 0);

  // Legacy key & Group 3 store untouched
  assert.equal(storage.getItem(PEER_VISIT_LEGACY_DRAFT_KEY), legacyRawBefore);
  assert.equal(
    storage.getItem(TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY),
    meetingsBefore
  );

  const hydrated = await loadActivePeerVisitDraftWithMedia({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(hydrated.formData.evidencePhotos.length, 1);
  assert.ok(
    hydrated.formData.evidencePhotos[0].imageDataUrl.startsWith(
      'data:image/png;base64,'
    )
  );
});

test('4. Migration skips empty and factory-untouched peer-visit-report drafts', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const initial = createInitialMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  saveLegacyPeerVisitDraft(initial, storage);

  const summary = await migratePeerVisitsToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(summary.migratedCount, 0);
  assert.equal(summary.skippedEmptyCount, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);

  const store = loadPeerVisitsArchiveStore(storage);
  assert.equal(Object.keys(store.activeDraftByFormId).length, 0);
  assert.equal(Object.keys(store.records).length, 0);
});

test('5. Re-running migration 3 consecutive times is strictly idempotent with zero duplicate records or blobs', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const draft = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  draft.evidencePhotos = [
    { id: 'pv-idem-1', imageDataUrl: makeSamplePngDataUrl(65) },
  ];
  saveLegacyPeerVisitDraft(draft, storage);

  const run1 = await migratePeerVisitsToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  const run2 = await migratePeerVisitsToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  const run3 = await migratePeerVisitsToArchive({
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

test('6. Rollback restores pre-migration archive state, removes unreferenced newly migrated blobs, keeps legacy key intact, and isolates Group 3', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const draft = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  draft.evidencePhotos = [
    { id: 'pv-rb-1', imageDataUrl: makeSamplePngDataUrl(99) },
  ];
  saveLegacyPeerVisitDraft(draft, storage);
  const legacyBefore = storage.getItem(PEER_VISIT_LEGACY_DRAFT_KEY);

  await migratePeerVisitsToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 1);
  assert.ok(storage.getItem(TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY));

  const rb = await rollbackPeerVisitsMigration({ storage, mediaRepo });
  assert.equal(rb.rolledBack, true);
  assert.equal(rb.restoredArchiveKey, true);
  assert.equal(rb.removedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);
  assert.equal(storage.getItem(TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY), null);
  assert.equal(storage.getItem(PEER_VISIT_LEGACY_DRAFT_KEY), legacyBefore);

  const migState = loadMigrationState(storage);
  assert.ok(migState.groups['peer-visits']?.rolledBackAt);
});

test('7. Evidence photos offload to teacherMediaStorage via UnifiedMediaRef with zero Base64 in archive JSON and SHA-256 deduplication across peer visits', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const identicalUrl = makeSamplePngDataUrl(117);

  const v1 = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v1.observedPracticeTitle = 'زيارة تبادلية أ';
  v1.evidencePhotos = [{ id: 'v1-p1', imageDataUrl: identicalUrl }];
  const s1 = await savePeerVisitToArchive(v1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const v2 = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v2.observedPracticeTitle = 'زيارة تبادلية ب';
  v2.evidencePhotos = [{ id: 'v2-p1', imageDataUrl: identicalUrl }];
  const s2 = await savePeerVisitToArchive(v2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const rawJson =
    storage.getItem(TEACHER_PEER_VISITS_ARCHIVE_STORAGE_KEY) || '';
  assert.equal(rawJson.includes('data:image/'), false);
  assert.equal(s1.record.payload.evidencePhotos.length, 0);
  assert.equal(s2.record.payload.evidencePhotos.length, 0);
  assert.equal(s1.mediaRefs[0].blobKey, s2.mediaRefs[0].blobKey);
  assert.equal(s1.mediaRefs[0].contentSha256, s2.mediaRefs[0].contentSha256);
  assert.equal(await mediaRepo.countBlobs(), 1);
});

test('8. Corrupted IndexedDB attachment fails CRC-32 integrity check cleanly on peer visit reload', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const v = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v.evidencePhotos = [
    { id: 'pv-corrupt-1', imageDataUrl: makeSamplePngDataUrl(49) },
  ];
  const saved = await savePeerVisitToArchive(v, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const blobKey = saved.mediaRefs[0].blobKey;
  const stored = await mediaRepo.getBlob(blobKey);
  assert.ok(stored);

  const tampered = new Uint8Array(stored.bytes);
  tampered[tampered.length - 1] ^= 0xff;
  await mediaRepo.putBlob({ ...stored, bytes: tampered });

  const reloaded = await loadArchivedPeerVisitWithMedia(saved.record.id, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(reloaded);
  assert.equal(reloaded.formData.evidencePhotos.length, 0);
  assert.equal(reloaded.integrityWarnings.length, 1);
  assert.ok(reloaded.integrityWarnings[0].includes('CRC-32'));
});

test('9. Cross-group Reference Counting protects shared blobs across Peer Visit, Group 1 Report, Group 2 Plan, and Group 3 Meeting', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const reportSharedUrl = makeSamplePngDataUrl(211);
  const planSharedUrl = makeSamplePngDataUrl(212);
  const meetingSharedUrl = makeSamplePngDataUrl(213);

  // Seed Group 1 report
  const mRep = await saveMediaDataUrl(
    { dataUrl: reportSharedUrl, id: 'g1', sourceTag: 'upload' },
    mediaRepo
  );
  const repStore = loadGroupArchiveStore<Record<string, unknown>>(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    'professional-reports',
    storage
  );
  storage.setItem(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(
      upsertArchivedRecord(repStore, {
        formId: 'strategy-implementation',
        title: 'تقرير ١',
        mediaRefs: [mRep.mediaRef],
        payload: {},
      }).nextStore
    )
  );

  // Seed Group 2 plan
  const mPlan = await saveMediaDataUrl(
    { dataUrl: planSharedUrl, id: 'g2', sourceTag: 'upload' },
    mediaRepo
  );
  const planStore = loadGroupArchiveStore<Record<string, unknown>>(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    'plans',
    storage
  );
  storage.setItem(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(
      upsertArchivedRecord(planStore, {
        formId: 'weekly-teacher-plan',
        title: 'خطة ٢',
        mediaRefs: [mPlan.mediaRef],
        payload: {},
      }).nextStore
    )
  );

  // Seed Group 3 meeting
  const mMeet = await saveMediaDataUrl(
    { dataUrl: meetingSharedUrl, id: 'g3', sourceTag: 'upload' },
    mediaRepo
  );
  const meetStore = loadGroupArchiveStore<Record<string, unknown>>(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    'meetings-visits',
    storage
  );
  storage.setItem(
    TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(
      upsertArchivedRecord(meetStore, {
        formId: 'meeting-minutes',
        title: 'اجتماع ٣',
        mediaRefs: [mMeet.mediaRef],
        payload: {},
      }).nextStore
    )
  );

  // Save Peer Visit referencing reportSharedUrl
  const v = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v.evidencePhotos = [{ id: 'pv-p1', imageDataUrl: reportSharedUrl }];
  const savedVisit = await savePeerVisitToArchive(v, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 3);

  // Replace peer visit photo with meetingSharedUrl (shared with Group 3 meeting)
  await savePeerVisitToArchive(
    { ...v, evidencePhotos: [{ id: 'pv-p2', imageDataUrl: meetingSharedUrl }] },
    {
      recordId: savedVisit.record.id,
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    }
  );
  // Group 1 blob must still be preserved!
  assert.equal(await mediaRepo.countBlobs(), 3);
  assert.ok(await mediaRepo.getBlob(mRep.mediaRef.blobKey));

  // Verify deletion impact detects Group 3 shared reference
  const impact = inspectArchivedPeerVisitDeletionImpact(savedVisit.record.id, {
    storage,
  });
  assert.equal(impact.sharedBlobKeys.length, 1);
  assert.equal(impact.sharedBlobKeys[0], mMeet.mediaRef.blobKey);

  // Deleting the peer visit preserves meetingSharedUrl because Group 3 references it
  const del = await deleteArchivedPeerVisitRecordSafely(savedVisit.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(del.result.deleted, true);
  assert.equal(del.result.preservedSharedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 3);

  // Active draft replacement also preserves shared Group 2 blob
  await saveActivePeerVisitDraftWithMedia(
    { ...v, evidencePhotos: [{ id: 'pv-d', imageDataUrl: planSharedUrl }] },
    { settings: DEFAULT_SCHOOL_SETTINGS, storage, mediaRepo }
  );
  await saveActivePeerVisitDraftWithMedia(
    { ...v, evidencePhotos: [] },
    { settings: DEFAULT_SCHOOL_SETTINGS, storage, mediaRepo }
  );
  assert.ok(await mediaRepo.getBlob(mPlan.mediaRef.blobKey));
});

test('10. Delete guard blocks unconfirmed deletion of portfolio-linked peer visit, unlinks & audits on confirm', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const v = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v.evidencePhotos = [
    { id: 'pv-guard', imageDataUrl: makeSamplePngDataUrl(86) },
  ];
  const saved = await savePeerVisitToArchive(v, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  storage.setItem(
    TEACHER_PORTFOLIO_STORAGE_KEY,
    JSON.stringify({
      elements: {
        'element-2': {
          title: 'التفاعل مع المجتمع المهني',
          linkedRecords: [
            {
              sourceGroupId: 'peer-visits',
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
  const blocked = await deleteArchivedPeerVisitRecordSafely(saved.record.id, {
    confirmUnlink: false,
    storage,
    mediaRepo,
  });
  assert.equal(blocked.result.deleted, false);
  assert.equal(blocked.result.requiresConfirmation, true);
  assert.equal(blocked.result.impact.isLinked, true);
  assert.ok(
    blocked.result.impact.warningMessage?.includes('التفاعل مع المجتمع المهني')
  );
  assert.equal(listSavedPeerVisits(storage).length, 1);

  // Confirm delete unlinks portfolio, logs audit, deletes exclusive blob
  const confirmed = await deleteArchivedPeerVisitRecordSafely(saved.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(confirmed.result.deleted, true);
  assert.deepEqual(confirmed.result.unlinkedElementIds, ['element-2']);
  assert.equal(confirmed.result.removedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);
  assert.equal(listSavedPeerVisits(storage).length, 0);

  const portfolio = JSON.parse(
    storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!
  ) as {
    elements: { 'element-2': { linkedRecords: unknown[] } };
    sourceDeletionAuditLog: Array<{
      deletedGroupId: string;
      deletedRecordId: string;
    }>;
  };
  assert.equal(portfolio.elements['element-2'].linkedRecords.length, 0);
  assert.equal(portfolio.sourceDeletionAuditLog.length, 1);
  assert.equal(portfolio.sourceDeletionAuditLog[0].deletedGroupId, 'peer-visits');
  assert.equal(
    portfolio.sourceDeletionAuditLog[0].deletedRecordId,
    saved.record.id
  );
});

test('11. Validation and PDF document builder/pagination remain 100% functional on archived peer visit records and do NOT auto-link portfolio', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const v = createSampleMeetingOrVisitState(
    'peer-visit-report',
    DEFAULT_SCHOOL_SETTINGS
  ) as PeerVisitReportFormState;
  v.enableTeacherSignatures = true;
  v.evidencePhotos = [
    { id: 'pv-pdf-1', imageDataUrl: makeSamplePngDataUrl(52) },
  ];
  v.evidenceLinks = [{ id: 'pv-lnk-1', url: 'https://ien.edu.sa/' }];

  assert.equal(validateMeetingOrVisitState(v).length, 0);

  const saved = await savePeerVisitToArchive(v, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY), null);

  const loaded = await loadArchivedPeerVisitWithMedia(saved.record.id, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(loaded);

  const doc = buildTeacherMeetingOrVisitDocument(
    loaded.formData,
    DEFAULT_SCHOOL_SETTINGS,
    { templateStyle: 'waves', colorSystem: 'green' }
  );
  assert.equal(doc.reportTypeLabel, 'تقرير زيارة تبادلية بين المعلمين');
  assert.equal(doc.evidencePhotos?.length, 1);
  assert.equal(doc.evidenceLinks?.length, 1);

  const pages = paginateTeacherReportBlocks(doc, DEFAULT_SCHOOL_SETTINGS);
  assert.ok(pages.length >= 1);
});
