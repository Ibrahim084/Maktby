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
  createInitialMeetingOrVisitState,
  createSampleMeetingOrVisitState,
  MEETING_TYPE_OPTIONS,
  MeetingMinutesFormState,
  PeerVisitReportFormState,
} from './teacherMeetingsAndVisitsEngine';
import {
  createNewBlankMeetingInArchive,
  deleteArchivedMeetingRecordSafely,
  inspectArchivedMeetingDeletionImpact,
  listSavedMeetings,
  loadActiveMeetingDraftWithMedia,
  loadArchivedMeetingWithMedia,
  loadMeetingsArchiveStore,
  MEETING_MINUTES_LEGACY_DRAFT_KEY,
  migrateMeetingMinutesToArchive,
  rollbackMeetingMinutesMigration,
  saveActiveMeetingDraftWithMedia,
  saveLegacyMeetingMinutesDraft,
  saveMeetingToArchive,
  TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY,
} from './teacherMeetingsArchive';
import { TEACHER_PLANS_ARCHIVE_STORAGE_KEY } from './teacherPlansArchive';
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

test('1. Creating 2 independent saved meetings of the same type preserves both records without overwriting', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const m1 = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m1.meetingType = 'اجتماع تربوي مع أولياء الأمور';
  m1.meetingTitle = 'لقاء أولياء أمور طلاب الصف السادس (الفصل الأول)';

  const s1 = await saveMeetingToArchive(m1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(s1.isNew, true);
  assert.ok(s1.record.id.startsWith('trec_'));
  assert.equal(s1.record.recordState, 'archived_saved');
  assert.equal(s1.record.isPortfolioEligible, true);

  // Create new blank draft before saving the second meeting of the same type
  const blank = createNewBlankMeetingInArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
  });
  assert.equal(blank.draftRecord.recordState, 'draft');
  assert.equal(blank.draftRecord.isPortfolioEligible, false);

  const m2 = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m2.meetingType = 'اجتماع تربوي مع أولياء الأمور';
  m2.meetingTitle = 'لقاء أولياء أمور طلاب الصف السادس (الفصل الثاني)';

  const s2 = await saveMeetingToArchive(m2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(s2.isNew, true);
  assert.ok(s2.record.id.startsWith('trec_'));
  assert.notEqual(s2.record.id, s1.record.id);

  const savedList = listSavedMeetings(storage);
  assert.equal(savedList.length, 2);
  const titles = savedList.map((r) => r.title);
  assert.ok(titles.includes('لقاء أولياء أمور طلاب الصف السادس (الفصل الأول)'));
  assert.ok(titles.includes('لقاء أولياء أمور طلاب الصف السادس (الفصل الثاني)'));
});

test('2. Editing an archived meeting preserves its immutable ID and leaves sibling records untouched', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const m1 = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m1.meetingTitle = 'اجتماع لجنة التحصيل الدراسي — ١';
  const s1 = await saveMeetingToArchive(m1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const m2 = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m2.meetingTitle = 'اجتماع لجنة التحصيل الدراسي — ٢';
  const s2 = await saveMeetingToArchive(m2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const loaded1 = await loadArchivedMeetingWithMedia(s1.record.id, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(loaded1);
  loaded1.formData.meetingLocation = 'مركز مصادر التعلم — الدور الثاني';

  const updated1 = await saveMeetingToArchive(loaded1.formData, {
    recordId: s1.record.id,
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(updated1.isNew, false);
  assert.equal(updated1.record.id, s1.record.id);
  assert.equal(
    updated1.record.payload.meetingLocation,
    'مركز مصادر التعلم — الدور الثاني'
  );

  const list = listSavedMeetings(storage);
  assert.equal(list.length, 2);
  const sibling = list.find((r) => r.id === s2.record.id);
  assert.ok(sibling);
  assert.equal(sibling.title, 'اجتماع لجنة التحصيل الدراسي — ٢');
});

test('3. Migration handles all 6 existing meeting types (including parent meetings & custom type) while keeping peer visits completely untouched', async () => {
  assert.equal(MEETING_TYPE_OPTIONS.length, 6);
  assert.ok(MEETING_TYPE_OPTIONS.includes('اجتماع تربوي مع أولياء الأمور'));

  for (let i = 0; i < MEETING_TYPE_OPTIONS.length; i++) {
    const mType = MEETING_TYPE_OPTIONS[i];
    const storage = createMemoryStorage();
    const mediaRepo = createMemoryTeacherMediaRepository();

    // Seed sibling Group 4 peer-visit draft to ensure Group 3 NEVER migrates or alters it
    const peerVisitSeed: PeerVisitReportFormState =
      createSampleMeetingOrVisitState(
        'peer-visit-report',
        DEFAULT_SCHOOL_SETTINGS
      ) as PeerVisitReportFormState;
    const peerKey = 'maktabi_teacher_meeting_visit_draft_v2_peer-visit-report';
    const peerRaw = JSON.stringify(peerVisitSeed);
    storage.setItem(peerKey, peerRaw);

    const draft = createSampleMeetingOrVisitState(
      'meeting-minutes',
      DEFAULT_SCHOOL_SETTINGS
    ) as MeetingMinutesFormState;
    draft.meetingType = mType;
    draft.customMeetingType =
      mType === 'نوع آخر' ? 'اجتماع مجلس التوجيه الطلابي' : '';
    draft.meetingTitle = `محضر: ${draft.customMeetingType || mType}`;
    draft.evidencePhotos = [
      { id: `mig-photo-${i}`, imageDataUrl: makeSamplePngDataUrl(20 + i) },
    ];
    saveLegacyMeetingMinutesDraft(draft, storage);

    const summary = await migrateMeetingMinutesToArchive({
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    });

    assert.equal(summary.groupId, 'meetings-visits');
    assert.equal(summary.migratedCount, 1);
    assert.equal(await mediaRepo.countBlobs(), 1);

    const archiveStore = loadMeetingsArchiveStore(storage);
    assert.equal(Object.keys(archiveStore.records).length, 0);
    const activeDraft = archiveStore.activeDraftByFormId['meeting-minutes'];
    assert.ok(activeDraft);
    assert.equal(activeDraft.recordState, 'draft');
    assert.equal(activeDraft.isPortfolioEligible, false);
    assert.equal(activeDraft.payload.meetingType, mType);
    if (mType === 'نوع آخر') {
      assert.equal(
        activeDraft.payload.customMeetingType,
        'اجتماع مجلس التوجيه الطلابي'
      );
    }
    assert.equal(activeDraft.mediaRefs.length, 1);
    assert.equal(activeDraft.payload.evidencePhotos.length, 0);

    // Ensure zero peer-visit records entered archive and peer-visit legacy key stayed untouched
    assert.equal(archiveStore.activeDraftByFormId['peer-visit-report'], undefined);
    assert.equal(storage.getItem(peerKey), peerRaw);

    // Confirm hydrated draft restores photo cleanly
    const hydrated = await loadActiveMeetingDraftWithMedia({
      settings: DEFAULT_SCHOOL_SETTINGS,
      storage,
      mediaRepo,
    });
    assert.equal(hydrated.formData.evidencePhotos.length, 1);
    assert.equal(hydrated.formData.meetingType, mType);
    assert.ok(
      hydrated.formData.evidencePhotos[0].imageDataUrl.startsWith(
        'data:image/png;base64,'
      )
    );
  }
});

test('4. Migration skips empty and factory-untouched meeting-minutes drafts', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const initial = createInitialMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  saveLegacyMeetingMinutesDraft(initial, storage);

  const summary = await migrateMeetingMinutesToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(summary.migratedCount, 0);
  assert.equal(summary.skippedEmptyCount, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);

  const archiveStore = loadMeetingsArchiveStore(storage);
  assert.equal(Object.keys(archiveStore.activeDraftByFormId).length, 0);
  assert.equal(Object.keys(archiveStore.records).length, 0);
});

test('5. Re-running migration 3 consecutive times is strictly idempotent with zero duplicate records or blobs', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const draft = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  draft.evidencePhotos = [{ id: 'idem-1', imageDataUrl: makeSamplePngDataUrl(61) }];
  saveLegacyMeetingMinutesDraft(draft, storage);

  const run1 = await migrateMeetingMinutesToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  const run2 = await migrateMeetingMinutesToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  const run3 = await migrateMeetingMinutesToArchive({
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

test('6. Legacy storage key maktabi_teacher_meeting_visit_draft_v2_meeting-minutes remains intact after migration', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const draft = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  draft.meetingTitle = 'محضر فريق الجودة والتميز المدرسي';
  draft.evidencePhotos = [
    { id: 'leg-keep', imageDataUrl: makeSamplePngDataUrl(73) },
  ];
  saveLegacyMeetingMinutesDraft(draft, storage);
  const legacyRawBefore = storage.getItem(MEETING_MINUTES_LEGACY_DRAFT_KEY);
  assert.ok(legacyRawBefore);

  await migrateMeetingMinutesToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(
    storage.getItem(MEETING_MINUTES_LEGACY_DRAFT_KEY),
    legacyRawBefore
  );
});

test('7. Rollback restores pre-migration archive state, deletes newly migrated unreferenced blobs, and keeps legacy data intact', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const draft = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  draft.evidencePhotos = [{ id: 'rb-p1', imageDataUrl: makeSamplePngDataUrl(95) }];
  saveLegacyMeetingMinutesDraft(draft, storage);
  const legacyBefore = storage.getItem(MEETING_MINUTES_LEGACY_DRAFT_KEY);

  await migrateMeetingMinutesToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 1);
  assert.ok(storage.getItem(TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY));

  const rb = await rollbackMeetingMinutesMigration({ storage, mediaRepo });
  assert.equal(rb.rolledBack, true);
  assert.equal(rb.restoredArchiveKey, true);
  assert.equal(rb.removedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);
  assert.equal(storage.getItem(TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY), null);
  assert.equal(storage.getItem(MEETING_MINUTES_LEGACY_DRAFT_KEY), legacyBefore);

  const migState = loadMigrationState(storage);
  assert.ok(migState.groups['meetings-visits']?.rolledBackAt);
});

test('8. Evidence photos offload to teacherMediaStorage via UnifiedMediaRef with zero Base64 in archive JSON and SHA-256 deduplication across meetings', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const identicalUrl = makeSamplePngDataUrl(111);

  const m1 = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m1.meetingTitle = 'محضر الاجتماع الأول';
  m1.evidencePhotos = [{ id: 'm1-p1', imageDataUrl: identicalUrl }];
  const s1 = await saveMeetingToArchive(m1, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const m2 = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m2.meetingTitle = 'محضر الاجتماع الثاني';
  m2.evidencePhotos = [{ id: 'm2-p1', imageDataUrl: identicalUrl }];
  const s2 = await saveMeetingToArchive(m2, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const rawJson = storage.getItem(TEACHER_MEETINGS_ARCHIVE_STORAGE_KEY) || '';
  assert.equal(rawJson.includes('data:image/'), false);
  assert.equal(s1.record.payload.evidencePhotos.length, 0);
  assert.equal(s2.record.payload.evidencePhotos.length, 0);
  assert.equal(s1.mediaRefs[0].blobKey, s2.mediaRefs[0].blobKey);
  assert.equal(s1.mediaRefs[0].contentSha256, s2.mediaRefs[0].contentSha256);
  assert.equal(await mediaRepo.countBlobs(), 1);
});

test('9. Corrupted IndexedDB attachment fails CRC-32 integrity check cleanly on meeting reload', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const m = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m.evidencePhotos = [{ id: 'corrupt-1', imageDataUrl: makeSamplePngDataUrl(44) }];
  const saved = await saveMeetingToArchive(m, {
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

  const reloaded = await loadArchivedMeetingWithMedia(saved.record.id, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(reloaded);
  assert.equal(reloaded.formData.evidencePhotos.length, 0);
  assert.equal(reloaded.integrityWarnings.length, 1);
  assert.ok(reloaded.integrityWarnings[0].includes('CRC-32'));
});

test('10. Cross-group Reference Counting protects shared blobs across Meeting, Group 1 Report, and Group 2 Plan on replacement and deletion', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();
  const reportSharedUrl = makeSamplePngDataUrl(201);
  const planSharedUrl = makeSamplePngDataUrl(202);

  // Seed Group 1 report referencing reportSharedUrl
  const savedRepMedia = await saveMediaDataUrl(
    { dataUrl: reportSharedUrl, id: 'g1-photo', sourceTag: 'upload' },
    mediaRepo
  );
  const emptyRepStore = loadGroupArchiveStore<Record<string, unknown>>(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    'professional-reports',
    storage
  );
  const { nextStore: popRepStore } = upsertArchivedRecord(emptyRepStore, {
    formId: 'strategy-implementation',
    title: 'تقرير من المجموعة ١',
    mediaRefs: [savedRepMedia.mediaRef],
    payload: {},
  });
  storage.setItem(
    TEACHER_REPORTS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(popRepStore)
  );

  // Seed Group 2 plan referencing planSharedUrl
  const savedPlanMedia = await saveMediaDataUrl(
    { dataUrl: planSharedUrl, id: 'g2-photo', sourceTag: 'upload' },
    mediaRepo
  );
  const emptyPlanStore = loadGroupArchiveStore<Record<string, unknown>>(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    'plans',
    storage
  );
  const { nextStore: popPlanStore } = upsertArchivedRecord(emptyPlanStore, {
    formId: 'weekly-teacher-plan',
    title: 'خطة من المجموعة ٢',
    mediaRefs: [savedPlanMedia.mediaRef],
    payload: {},
  });
  storage.setItem(
    TEACHER_PLANS_ARCHIVE_STORAGE_KEY,
    JSON.stringify(popPlanStore)
  );

  // Save Meeting referencing reportSharedUrl
  const m = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m.evidencePhotos = [{ id: 'mm-p1', imageDataUrl: reportSharedUrl }];
  const savedMeeting = await saveMeetingToArchive(m, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.equal(await mediaRepo.countBlobs(), 2);

  // Replace meeting photo with planSharedUrl (which is referenced by Group 2 plan)
  const updatedMeeting = {
    ...m,
    evidencePhotos: [{ id: 'mm-p2', imageDataUrl: planSharedUrl }],
  };
  await saveMeetingToArchive(updatedMeeting, {
    recordId: savedMeeting.record.id,
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  // reportSharedUrl MUST remain because Group 1 report still uses it!
  assert.equal(await mediaRepo.countBlobs(), 2);
  assert.ok(await mediaRepo.getBlob(savedRepMedia.mediaRef.blobKey));

  // Verify inspectArchivedMeetingDeletionImpact detects Group 2 cross-group ref
  const impact = inspectArchivedMeetingDeletionImpact(savedMeeting.record.id, {
    storage,
  });
  assert.equal(impact.sharedBlobKeys.length, 1);
  assert.equal(impact.sharedBlobKeys[0], savedPlanMedia.mediaRef.blobKey);

  // Deleting the meeting must preserve planSharedUrl referenced by Group 2 plan
  const del = await deleteArchivedMeetingRecordSafely(savedMeeting.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(del.result.deleted, true);
  assert.equal(del.result.preservedSharedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 2);

  // Active draft replacement also preserves shared blobs
  const mDraft = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  mDraft.evidencePhotos = [{ id: 'd1', imageDataUrl: planSharedUrl }];
  await saveActiveMeetingDraftWithMedia(mDraft, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  mDraft.evidencePhotos = [];
  await saveActiveMeetingDraftWithMedia(mDraft, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });
  assert.ok(await mediaRepo.getBlob(savedPlanMedia.mediaRef.blobKey));
});

test('11. Delete guard blocks unconfirmed deletion of portfolio-linked meeting, returns warning with linked element title, unlinks and audits on confirm', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const m = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  m.evidencePhotos = [{ id: 'mm-guard', imageDataUrl: makeSamplePngDataUrl(84) }];
  const saved = await saveMeetingToArchive(m, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  // Simulate portfolio element link in maktabi_teacher_portfolio_v1
  storage.setItem(
    TEACHER_PORTFOLIO_STORAGE_KEY,
    JSON.stringify({
      elements: {
        'element-1': {
          title: 'أداء الواجبات الوظيفية',
          linkedRecords: [
            {
              sourceGroupId: 'meetings-visits',
              sourceRecordId: saved.record.id,
              title: saved.record.title,
            },
          ],
        },
      },
      sourceDeletionAuditLog: [],
    })
  );

  // Unconfirmed delete MUST be blocked with linked element title warning
  const blocked = await deleteArchivedMeetingRecordSafely(saved.record.id, {
    confirmUnlink: false,
    storage,
    mediaRepo,
  });
  assert.equal(blocked.result.deleted, false);
  assert.equal(blocked.result.requiresConfirmation, true);
  assert.equal(blocked.result.impact.isLinked, true);
  assert.ok(blocked.result.impact.warningMessage?.includes('أداء الواجبات الوظيفية'));
  assert.equal(listSavedMeetings(storage).length, 1);

  // Confirmed delete deletes record, unlinks portfolio, logs audit, and deletes exclusive blob
  const confirmed = await deleteArchivedMeetingRecordSafely(saved.record.id, {
    confirmUnlink: true,
    storage,
    mediaRepo,
  });
  assert.equal(confirmed.result.deleted, true);
  assert.deepEqual(confirmed.result.unlinkedElementIds, ['element-1']);
  assert.equal(confirmed.result.removedBlobKeys.length, 1);
  assert.equal(await mediaRepo.countBlobs(), 0);
  assert.equal(listSavedMeetings(storage).length, 0);

  const portfolio = JSON.parse(
    storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!
  ) as {
    elements: { 'element-1': { linkedRecords: unknown[] } };
    sourceDeletionAuditLog: Array<{
      deletedGroupId: string;
      deletedRecordId: string;
      unlinkedElementIds: string[];
    }>;
  };
  assert.equal(portfolio.elements['element-1'].linkedRecords.length, 0);
  assert.equal(portfolio.sourceDeletionAuditLog.length, 1);
  assert.equal(
    portfolio.sourceDeletionAuditLog[0].deletedGroupId,
    'meetings-visits'
  );
  assert.equal(
    portfolio.sourceDeletionAuditLog[0].deletedRecordId,
    saved.record.id
  );
});

test('12. Archiving or migrating a meeting does NOT automatically add or link any شاهد in portfolio storage', async () => {
  const storage = createMemoryStorage();
  const mediaRepo = createMemoryTeacherMediaRepository();

  const legacyDraft = createSampleMeetingOrVisitState(
    'meeting-minutes',
    DEFAULT_SCHOOL_SETTINGS
  ) as MeetingMinutesFormState;
  saveLegacyMeetingMinutesDraft(legacyDraft, storage);

  await migrateMeetingMinutesToArchive({
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  const saved = await saveMeetingToArchive(legacyDraft, {
    settings: DEFAULT_SCHOOL_SETTINGS,
    storage,
    mediaRepo,
  });

  assert.equal(saved.record.recordState, 'archived_saved');
  assert.equal(listSavedMeetings(storage).length, 1);
  assert.equal(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY), null);
});
