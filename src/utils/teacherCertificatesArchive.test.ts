import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY,
  CERTIFICATES_LEGACY_DRAFT_KEY,
  SCHOOL_CERTIFICATES_FORM_ID,
  loadLegacyCertificateDraft,
  isPlaceholderBeneficiaryName,
  extractValidCertificateBeneficiaryNames,
  validateCertificateForArchive,
  isLegacyCertificateDraftEmpty,
  hasMeaningfulCertificateDraftData,
  CertificateDualStoreSyncError,
  migrateCertificatesToArchive,
  rollbackCertificatesMigration,
  loadCertificatesArchiveStore,
  listSavedCertificates,
  computeCertificateDraftSignature,
  inspectCertificateDualStoreConsistency,
  resolveCertificateDualStoreDivergence,
  loadActiveCertificateDraft,
  syncActiveCertificateDraftToBothStores,
  saveCertificateToArchive,
  loadArchivedCertificateById,
  abandonActiveDraftAndCreateNewCertificate,
  saveDraftToArchiveAndCreateNewCertificate,
  inspectArchivedCertificateDeletionImpact,
  deleteArchivedCertificateRecordSafely,
  filterCertificateArchiveRecords,
} from './teacherCertificatesArchive';
import { TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS } from './teacherMediaStorage';
import { TEACHER_PORTFOLIO_STORAGE_KEY } from './teacherArchiveEngine';
import {
  createInitialCertificateFormState,
  generateCertificatesPdf,
  type CertificateFormState,
} from './certificatesEngine';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import type { SchoolSettings } from '../types';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  public failOnSetKey: string | null = null;
  public failOnSetCount = 0;

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failOnSetKey === key && this.failOnSetCount > 0) {
      this.failOnSetCount -= 1;
      throw new Error(`Simulated storage write failure on ${key}`);
    }
    this.map.set(key, String(value));
  }
}

const mockSettings: SchoolSettings = {
  ...DEFAULT_SCHOOL_SETTINGS,
  schoolName: 'مدرسة الفيصلية الثانوية',
  userName: 'أ. محمد العتيبي',
  principalName: 'أ. خالد السديري',
  educationDepartment: 'إدارة تعليم الرياض',
  academicYear: '1447هـ',
  semester: 'الفصل الدراسي الأول',
  roles: {
    ...DEFAULT_SCHOOL_SETTINGS.roles,
  },
};

describe('Group 7: Teacher Certificates Archive Engine (teacherCertificatesArchive)', () => {
  it('1. registers Group 7 storage key in TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS and accurately detects empty/factory vs meaningful drafts', () => {
    assert.ok(
      TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS.includes(TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY),
      'TEACHER_ARCHIVE_KNOWN_STORAGE_KEYS must include Group 7 archive key'
    );

    const factoryDraft = createInitialCertificateFormState(mockSettings);
    assert.equal(isLegacyCertificateDraftEmpty(factoryDraft, mockSettings), true);
    assert.equal(hasMeaningfulCertificateDraftData(factoryDraft, mockSettings), false);

    // Placeholder beneficiary names must be treated as empty
    const placeholderDraft: CertificateFormState = {
      ...factoryDraft,
      beneficiariesInput: '...\n—\nStudent Name\n   ',
    };
    assert.equal(isPlaceholderBeneficiaryName('...'), true);
    assert.equal(isPlaceholderBeneficiaryName('Student Name'), true);
    assert.equal(isPlaceholderBeneficiaryName('سعد عبدالله القحطاني'), false);
    assert.deepEqual(extractValidCertificateBeneficiaryNames(placeholderDraft.beneficiariesInput), []);
    assert.equal(isLegacyCertificateDraftEmpty(placeholderDraft, mockSettings), true);

    // Meaningful beneficiary name marks draft as non-empty
    const meaningfulDraft: CertificateFormState = {
      ...factoryDraft,
      beneficiariesInput: 'سعد عبدالله القحطاني',
    };
    assert.equal(isLegacyCertificateDraftEmpty(meaningfulDraft, mockSettings), false);
    assert.equal(hasMeaningfulCertificateDraftData(meaningfulDraft, mockSettings), true);
  });

  it('2. migrates legacy certificate draft idempotently (3x) as a draft (isPortfolioEligible: false) and supports isolated rollback without touching Groups 1-6', async () => {
    const storage = new MemoryStorage();

    // Seed a Group 6 key to verify strict isolation
    const group6Key = 'maktabi_teacher_programs_activities_archive_v1';
    storage.setItem(group6Key, JSON.stringify({ schemaVersion: 1, groupId: 'programs-activities', records: {} }));

    const legacyDraft: CertificateFormState = {
      ...createInitialCertificateFormState(mockSettings),
      certificateType: 'excellence',
      excellenceVariant: 'teacher',
      beneficiariesInput: 'فهد بن سلطان العتيبي\nعبدالرحمن بن خالد الدوسري',
      presenterName: 'أ. محمد العتيبي',
    };
    storage.setItem(CERTIFICATES_LEGACY_DRAFT_KEY, JSON.stringify(legacyDraft));

    const firstRun = await migrateCertificatesToArchive({ settings: mockSettings, storage });
    const secondRun = await migrateCertificatesToArchive({ settings: mockSettings, storage });
    const thirdRun = await migrateCertificatesToArchive({ settings: mockSettings, storage });

    assert.equal(firstRun.migratedCount, 1);
    assert.equal(secondRun.migratedCount, 0);
    assert.equal(secondRun.alreadyCompleted, true);
    assert.equal(thirdRun.migratedCount, 0);
    assert.equal(thirdRun.alreadyCompleted, true);

    // Migrated draft must remain in activeDraftByFormId and NOT be converted into a completed archived record
    const storeAfter = loadCertificatesArchiveStore(storage);
    assert.equal(Object.keys(storeAfter.records).length, 0);
    const activeDraft = storeAfter.activeDraftByFormId[SCHOOL_CERTIFICATES_FORM_ID];
    assert.ok(activeDraft, 'Migrated draft must exist in activeDraftByFormId');
    assert.equal(activeDraft.recordState, 'draft');
    assert.equal(activeDraft.isPortfolioEligible, false);
    assert.equal(activeDraft.payload.certificateType, 'excellence');
    assert.equal(activeDraft.payload.excellenceVariant, 'teacher');
    assert.equal(activeDraft.payload.presenterName, 'أ. محمد العتيبي');

    // Rollback must restore legacy draft, remove Group 7 archive key, and leave Group 6 key untouched
    const rbResult = await rollbackCertificatesMigration({ storage });
    assert.equal(rbResult.rolledBack, true);
    assert.equal(storage.getItem(TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY), null);
    assert.ok(storage.getItem(CERTIFICATES_LEGACY_DRAFT_KEY), 'Legacy draft must remain intact after rollback');
    assert.ok(storage.getItem(group6Key), 'Group 6 storage key must not be touched by Group 7 rollback');
  });

  it('3. validates archive save strictly (require >=1 valid beneficiary, title, and mainText) while allowing incomplete drafts in active draft sync', async () => {
    const storage = new MemoryStorage();
    const incompleteDraft: CertificateFormState = {
      ...createInitialCertificateFormState(mockSettings),
      beneficiariesInput: '...', // placeholder only
      presenterName: '',
    };

    // Active draft sync must NEVER block incomplete drafts
    const syncedDraft = syncActiveCertificateDraftToBothStores(incompleteDraft, {
      settings: mockSettings,
      storage,
    });
    assert.equal(syncedDraft.draftRecord.recordState, 'draft');
    assert.equal(loadLegacyCertificateDraft(mockSettings, storage).beneficiariesInput, '...');

    // Validation for archive save must fail when beneficiary is missing/placeholder
    const valNoBeneficiary = validateCertificateForArchive(incompleteDraft);
    assert.equal(valNoBeneficiary.length > 0, true);
    assert.ok(valNoBeneficiary[0].includes('اسم مستفيد حقيقي'));

    await assert.rejects(
      () =>
        saveCertificateToArchive(incompleteDraft, {
          settings: mockSettings,
          storage,
        }),
      /اسم مستفيد حقيقي/
    );

    // Missing certificateTitle must fail archive validation
    const noTitleDraft: CertificateFormState = {
      ...incompleteDraft,
      beneficiariesInput: 'ريان بن ماجد القحطاني',
      certificateTitle: '   ',
    };
    assert.equal(validateCertificateForArchive(noTitleDraft).length > 0, true);

    // Missing mainText must fail archive validation
    const noMainTextDraft: CertificateFormState = {
      ...incompleteDraft,
      beneficiariesInput: 'ريان بن ماجد القحطاني',
      mainText: '   ',
    };
    assert.equal(validateCertificateForArchive(noMainTextDraft).length > 0, true);
  });

  it('4. supports multi-record CRUD across all 3 certificate types and batch beneficiaries, preserves immutable trec_ IDs, filters/searches, exports batch & single A4 Landscape PDFs, and never auto-links to portfolio', async () => {
    const storage = new MemoryStorage();

    // Record 1: Appreciation certificate for a teacher
    const cert1Draft: CertificateFormState = {
      ...createInitialCertificateFormState(mockSettings),
      certificateType: 'appreciation',
      appreciationRole: 'teacher',
      beneficiariesInput: 'الأستاذ أحمد بن علي الغامدي',
      presenterName: 'أ. محمد العتيبي',
    };
    const saved1 = await saveCertificateToArchive(cert1Draft, {
      settings: mockSettings,
      storage,
    });
    assert.ok(saved1.record.id.startsWith('trec_'));
    assert.equal(saved1.record.formId, SCHOOL_CERTIFICATES_FORM_ID);
    assert.equal(saved1.record.payload.certificateType, 'appreciation');
    assert.equal(saved1.record.payload.appreciationRole, 'teacher');
    assert.deepEqual(extractValidCertificateBeneficiaryNames(saved1.record.payload.beneficiariesInput), [
      'الأستاذ أحمد بن علي الغامدي',
    ]);

    // Record 2: Batch graduation certificate for 3 students
    const cert2Draft: CertificateFormState = {
      ...createInitialCertificateFormState(mockSettings),
      certificateType: 'graduation',
      certificateTitle: 'شهادة تخرج الدفعة الثانية عشرة',
      openingText: 'تتقدم إدارة المدرسة بالتهنئة الخالصة للطالب:',
      mainText: 'لتخرجه بنجاح وتفوق في المرحلة الثانوية للعام الدراسي ١٤٤٧هـ.',
      beneficiariesInput: 'سلمان بن فهد الحربي\nعمر بن ياسر الشهري\nنواف بن تركي المطيري',
      presenterName: '', // kept empty by default per Decision 4
    };
    const saved2 = await saveCertificateToArchive(cert2Draft, {
      settings: mockSettings,
      storage,
    });
    assert.notEqual(saved2.record.id, saved1.record.id);
    assert.equal(saved2.record.payload.certificateType, 'graduation');
    assert.deepEqual(extractValidCertificateBeneficiaryNames(saved2.record.payload.beneficiariesInput), [
      'سلمان بن فهد الحربي',
      'عمر بن ياسر الشهري',
      'نواف بن تركي المطيري',
    ]);
    assert.equal(saved2.record.payload.presenterName, '');

    // Reopen Record 1 and update it -> trec_ ID and createdAt must remain immutable
    const loaded1 = await loadArchivedCertificateById(saved1.record.id, {
      settings: mockSettings,
      storage,
    });
    assert.ok(loaded1.record);
    assert.ok(loaded1.formData);
    const updated1 = await saveCertificateToArchive(
      {
        ...loaded1.formData,
        beneficiariesInput: 'الأستاذ أحمد بن علي الغامدي\nالأستاذ سعد بن ناصر الزهراني',
      },
      {
        recordId: saved1.record.id,
        settings: mockSettings,
        storage,
      }
    );
    assert.equal(updated1.record.id, saved1.record.id);
    assert.equal(updated1.record.createdAt, saved1.record.createdAt);
    assert.equal(
      extractValidCertificateBeneficiaryNames(updated1.record.payload.beneficiariesInput).length,
      2
    );

    // Filter by certificateType and search query
    const allSaved = listSavedCertificates(storage);
    assert.equal(allSaved.length, 2);

    const graduationOnly = filterCertificateArchiveRecords(allSaved, {
      certificateType: 'graduation',
    });
    assert.equal(graduationOnly.length, 1);
    assert.equal(graduationOnly[0].id, saved2.record.id);

    const searchByBeneficiary = filterCertificateArchiveRecords(allSaved, {
      searchQuery: 'نواف بن تركي',
      certificateType: 'all',
    });
    assert.equal(searchByBeneficiary.length, 1);
    assert.equal(searchByBeneficiary[0].id, saved2.record.id);

    // Export batch PDF (3 pages) and single-beneficiary PDF (1 page) from the reopened batch record
    const batchPdf = await generateCertificatesPdf(saved2.record.payload);
    assert.equal(batchPdf.pageCount, 3);
    assert.equal(batchPdf.pages.length, 3);
    assert.equal(batchPdf.pages[0].pixelWidth, 2380);
    assert.equal(batchPdf.pages[0].pixelHeight, 1684);
    assert.ok(batchPdf.pdfBytes.byteLength > 1000);

    const singlePdf = await generateCertificatesPdf(saved2.record.payload, { beneficiaryIndex: 1 });
    assert.equal(singlePdf.pageCount, 1);
    assert.equal(singlePdf.pages[0].beneficiaryName, 'عمر بن ياسر الشهري');
    assert.ok(singlePdf.filename.includes('عمر_بن_ياسر_الشهري'));

    // Verify ZERO auto-linking to teacher portfolio
    assert.equal(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY), null);
  });

  it('5. enforces reference-guarded safe deletion when a certificate record is linked to the teacher portfolio', async () => {
    const storage = new MemoryStorage();

    const savedA = await saveCertificateToArchive(
      {
        ...createInitialCertificateFormState(mockSettings),
        beneficiariesInput: 'طالب شهادة أ',
      },
      {
        settings: mockSettings,
        storage,
      }
    );
    const savedB = await saveCertificateToArchive(
      {
        ...createInitialCertificateFormState(mockSettings),
        beneficiariesInput: 'طالب شهادة ب',
      },
      {
        settings: mockSettings,
        storage,
      }
    );

    // Link both records in the portfolio store
    storage.setItem(
      TEACHER_PORTFOLIO_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        elements: {
          'el-certificates': {
            title: 'شواهد التحفيز والشهادات المدرسية',
            linkedRecords: [
              { sourceGroupId: 'certificates', sourceRecordId: savedA.record.id },
              { sourceGroupId: 'certificates', sourceRecordId: savedB.record.id },
            ],
          },
        },
      })
    );

    const impactA = inspectArchivedCertificateDeletionImpact(savedA.record.id, { storage });
    assert.equal(impactA.isLinked, true);
    assert.equal(impactA.linkedElements.length, 1);
    assert.equal(impactA.linkedElements[0].elementId, 'el-certificates');

    // Unconfirmed delete of linked record must require confirmation and NOT delete
    const blockedDelete = await deleteArchivedCertificateRecordSafely(savedA.record.id, {
      confirmUnlinkPortfolio: false,
      storage,
    });
    assert.equal(blockedDelete.deleted, false);
    assert.equal(blockedDelete.requiresConfirmation, true);
    assert.ok(blockedDelete.store.records[savedA.record.id]);

    // Confirmed delete must unlink savedA, record audit log, and preserve savedB link
    const deletedResult = await deleteArchivedCertificateRecordSafely(savedA.record.id, {
      confirmUnlinkPortfolio: true,
      storage,
    });
    assert.equal(deletedResult.deleted, true);
    assert.deepEqual(deletedResult.unlinkedElementIds, ['el-certificates']);
    assert.equal(deletedResult.store.records[savedA.record.id], undefined);
    assert.ok(deletedResult.store.records[savedB.record.id]);

    const portfolioAfter = JSON.parse(storage.getItem(TEACHER_PORTFOLIO_STORAGE_KEY)!);
    assert.equal(portfolioAfter.elements['el-certificates'].linkedRecords.length, 1);
    assert.equal(
      portfolioAfter.elements['el-certificates'].linkedRecords[0].sourceRecordId,
      savedB.record.id
    );
    assert.equal(portfolioAfter.sourceDeletionAuditLog.length, 1);
    assert.equal(portfolioAfter.sourceDeletionAuditLog[0].deletedRecordId, savedA.record.id);
  });

  it('6. prevents draft data loss during create-new transitions and executes saveDraftToArchiveAndCreateNewCertificate in a single store transition without partial commit', async () => {
    const storage = new MemoryStorage();
    const unsavedDraft: CertificateFormState = {
      ...createInitialCertificateFormState(mockSettings),
      certificateType: 'excellence',
      excellenceVariant: 'school-administration',
      beneficiariesInput: 'خالد بن وليد الشمري',
    };
    syncActiveCertificateDraftToBothStores(unsavedDraft, {
      settings: mockSettings,
      storage,
    });

    // Simulate failure on legacy key during saveDraftToArchiveAndCreateNewCertificate:
    // neither archive record nor blank draft should remain committed after rollback
    storage.failOnSetKey = CERTIFICATES_LEGACY_DRAFT_KEY;
    storage.failOnSetCount = 1;

    await assert.rejects(() =>
      saveDraftToArchiveAndCreateNewCertificate(unsavedDraft, {
        settings: mockSettings,
        storage,
      })
    );

    const consistencyAfterRollback = inspectCertificateDualStoreConsistency(mockSettings, storage);
    assert.equal(consistencyAfterRollback.diverged, false);
    assert.equal(Object.keys( loadCertificatesArchiveStore(storage).records).length, 0);
    assert.equal(
      consistencyAfterRollback.archiveDraft?.payload.beneficiariesInput,
      'خالد بن وليد الشمري',
      'Original unsaved draft must remain intact in archive store after rollback'
    );
    assert.equal(
      consistencyAfterRollback.legacyData?.beneficiariesInput,
      'خالد بن وليد الشمري',
      'Original unsaved draft must remain intact in legacy key after rollback'
    );

    // Now succeed in a single transition: archives the draft AND resets active draft to blank
    const successTransition = await saveDraftToArchiveAndCreateNewCertificate(unsavedDraft, {
      settings: mockSettings,
      storage,
    });
    assert.equal(successTransition.ok, true);
    if (successTransition.ok) {
      assert.ok(successTransition.savedRecord.id.startsWith('trec_'));
      assert.equal(Object.keys(successTransition.store.records).length, 1);
      assert.equal(successTransition.newFormData.beneficiariesInput, '');
      assert.equal(loadLegacyCertificateDraft(mockSettings, storage).beneficiariesInput, '');
    }

    // Also test Option 2: abandonActiveDraftAndCreateNewCertificate
    syncActiveCertificateDraftToBothStores(
      {
        ...createInitialCertificateFormState(mockSettings),
        beneficiariesInput: 'مسودة مؤقتة للتخلي عنها',
      },
      {
        settings: mockSettings,
        storage,
      }
    );
    const abandoned = await abandonActiveDraftAndCreateNewCertificate({
      settings: mockSettings,
      storage,
    });
    assert.equal(abandoned.formData.beneficiariesInput, '');
    assert.equal(Object.keys(abandoned.store.records).length, 1);
  });

  it('7. verifies rollback restoration across both stores and detects/reconciles divergence (keep-archive & keep-legacy) without silent overwrite', async () => {
    const storage = new MemoryStorage();
    const initialDraft: CertificateFormState = {
      ...createInitialCertificateFormState(mockSettings),
      beneficiariesInput: 'النسخة الأصلية المتطابقة',
    };
    syncActiveCertificateDraftToBothStores(initialDraft, {
      settings: mockSettings,
      storage,
    });

    // Case A: Fail archive write first -> verify clean rollback
    storage.failOnSetKey = TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY;
    storage.failOnSetCount = 1;
    assert.throws(
      () =>
        syncActiveCertificateDraftToBothStores(
          { ...initialDraft, beneficiariesInput: 'تعديل فاشل ١' },
          {
            settings: mockSettings,
            storage,
          }
        ),
      (err: unknown) => {
        assert.ok(err instanceof CertificateDualStoreSyncError);
        assert.equal(err.rolledBackBoth, true);
        assert.equal(err.diverged, false);
        return true;
      }
    );
    assert.equal(inspectCertificateDualStoreConsistency(mockSettings, storage).diverged, false);

    // Case B: Simulate mismatch between archive and legacy store
    const rawArchiveBefore = storage.getItem(TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY)!;
    const parsedArchive = JSON.parse(rawArchiveBefore);
    parsedArchive.activeDraftByFormId[SCHOOL_CERTIFICATES_FORM_ID].payload.beneficiariesInput =
      'نسخة مخزن الأرشيف الأحدث';
    storage.setItem(TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY, JSON.stringify(parsedArchive));

    // Startup migration MUST NOT overwrite the diverged archive draft with the older legacy key
    const migResult = await migrateCertificatesToArchive({ settings: mockSettings, storage });
    assert.equal(migResult.migratedCount, 0);

    const divergence = inspectCertificateDualStoreConsistency(mockSettings, storage);
    assert.equal(divergence.diverged, true);
    assert.equal(divergence.reason, 'payload-mismatch');

    // loadActiveCertificateDraft must preserve divergence report without overwriting either store
    const loadedDuringDivergence = await loadActiveCertificateDraft({
      settings: mockSettings,
      storage,
    });
    assert.equal(loadedDuringDivergence.divergence.diverged, true);

    // Reconcile with keep-legacy
    const resolvedLegacy = await resolveCertificateDualStoreDivergence('keep-legacy', {
      settings: mockSettings,
      storage,
    });
    assert.equal(resolvedLegacy.formData.beneficiariesInput, 'النسخة الأصلية المتطابقة');
    assert.equal(inspectCertificateDualStoreConsistency(mockSettings, storage).diverged, false);

    // Re-introduce mismatch and reconcile with keep-archive
    parsedArchive.activeDraftByFormId[SCHOOL_CERTIFICATES_FORM_ID].payload.beneficiariesInput =
      'نسخة مخزن الأرشيف المعتمدة';
    storage.setItem(TEACHER_CERTIFICATES_ARCHIVE_STORAGE_KEY, JSON.stringify(parsedArchive));
    assert.equal(inspectCertificateDualStoreConsistency(mockSettings, storage).diverged, true);

    const resolvedArchive = await resolveCertificateDualStoreDivergence('keep-archive', {
      settings: mockSettings,
      storage,
    });
    assert.equal(resolvedArchive.formData.beneficiariesInput, 'نسخة مخزن الأرشيف المعتمدة');
    assert.equal(inspectCertificateDualStoreConsistency(mockSettings, storage).diverged, false);
    assert.equal(
      loadLegacyCertificateDraft(mockSettings, storage).beneficiariesInput,
      'نسخة مخزن الأرشيف المعتمدة'
    );

    // Verify deterministic signature for close-lifecycle deduplication
    const sig1 = computeCertificateDraftSignature(resolvedArchive.formData, mockSettings);
    const sig2 = computeCertificateDraftSignature({ ...resolvedArchive.formData }, mockSettings);
    assert.equal(sig1, sig2);
  });
});
