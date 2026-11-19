import assert from 'node:assert/strict';
import test from 'node:test';
import { SECTIONS } from '../data/sections';
import {
  addEvidenceLinkToTargetInRecord,
  addEvidencePhotoToTargetInRecord,
  addOrUpdateCoordinatorAdditionalWorkInRecord,
  addOrUpdateGiftedProgramTemplateInRecord,
  addOrUpdateGiftedStudentInRecord,
  addOrUpdateGiftedStudentParticipationInRecord,
  buildGiftedComprehensiveFinalReportModel,
  buildGiftedFinalRecordReportModel,
  buildGiftedInnovationSpaceProgressReportModel,
  buildGiftedPeriodicReportModel,
  buildGiftedProgramOrEventReportModel,
  buildGiftedStatisticalReportModel,
  buildGiftedUnifiedProgramReportModel,
  buildRestoreGenBlobKey,
  checkGiftedStudentDeletionSafety,
  checkGiftedStudentDuplicateOrSimilarity,
  cleanupOrphanedAttachmentGenerations,
  computeGiftedCompletionMetrics,
  computeGiftedStudentsAndAchievementsSummary,
  createInitialGiftedCoordinatorRecord,
  createMemoryAttachmentRepository,
  createProgramExecutionFromTemplate,
  deleteCoordinatorAdditionalWorkFromRecord,
  deleteEvidenceLinkFromTargetInRecord,
  deleteEvidencePhotoFromTargetInRecord,
  deleteGiftedStudentFromRecord,
  exportGiftedFullBackupZip,
  extractZipArchiveEntries,
  filterAndSearchGiftedProgramTemplates,
  filterAndSearchGiftedStudents,
  filterValidActiveGenerationPhotosForReport,
  formatGregorianToHijriDate,
  getApprovedGradesForStage,
  getEvidenceBundleForTarget,
  getGiftedEvidenceTargetsCatalog,
  getGiftedFourEnginesCatalog,
  getGiftedNonExecutedItemsSummary,
  getGiftedProgramTemplatesFromRecord,
  getOrCreateExecutionForProgramTemplate,
  getUnifiedExecutionActionsCatalog,
  getUnifiedTargetAndScheduleRows,
  GIFTED_ACADEMIC_WEEKS_LIST,
  GIFTED_COORDINATOR_DUTIES,
  GIFTED_GENERAL_OBJECTIVES,
  GIFTED_PRE_V4_BACKUP_STORAGE_KEY,
  GIFTED_RECORD_STORAGE_KEY,
  GIFTED_SCHOOL_OBJECTIVES,
  GIFTED_SECTIONS_CATALOG,
  GIFTED_STANDARD_PROGRAM_ACTIONS,
  GIFTED_STRATEGIC_PILLARS,
  GIFTED_UNRECORDED_LABEL,
  GIFTED_VISUAL_IDENTITY,
  GiftedAttachmentRecord,
  GiftedAttachmentRepository,
  importAndRestoreGiftedFullBackupZip,
  isProgramSupportedInSchoolStage,
  loadGiftedRecordFromStorage,
  MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS,
  MAX_GIFTED_EVIDENCE_LINKS,
  MAX_GIFTED_EVIDENCE_PHOTOS,
  normalizeGiftedGradeLabel,
  registerAttachmentBlobKeyInRecord,
  resolveGiftedBasicInfo,
  resolveStudentParticipationsWithStudentInfo,
  runSafeGiftedV4Migration,
  safeDeleteGiftedStudentFromRecord,
  sanitizeGiftedCoordinatorRecord,
  saveGiftedRecordToStorage,
  setTargetShowEvidencesInReportInRecord,
  stripRestoreGenPrefix,
  toggleGiftedProgramTemplateActiveInRecord,
  updateEvidenceLinkInTargetInRecord,
  updateEvidencePhotoInTargetInRecord,
  updateGiftedEvaluationSummaryInRecord,
  updateInnovationProgressReportOverridesInRecord,
  updateProgramActionInRecord,
  updateProgramEventReportOverridesInRecord,
  updateSchoolStageInRecord,
  updateUnifiedTargetAndScheduleRow,
  upsertProgramExecutionInRecord,
} from './giftedRecordEngine';
import {
  generateGiftedComprehensiveFinalReportPdf,
  generateGiftedFinalRecordPdf,
  generateGiftedInnovationSpaceProgressReportPdf,
  generateGiftedPeriodicReportPdf,
  generateGiftedProgramOrEventReportPdf,
  generateGiftedStatisticalReportPdf,
  generateGiftedUnifiedProgramReportPdf,
} from './giftedReportPdfGenerator';
import { SchoolSettings } from '../types';

test('Visual Identity: Each section adopts its own calm, harmonious web palette while preserving Gifted PDF report identity', () => {
  assert.equal(GIFTED_VISUAL_IDENTITY.primaryBurgundyHex, '#7F1D3F');
  assert.equal(GIFTED_VISUAL_IDENTITY.charcoalHex, '#26323B');
  assert.equal(GIFTED_VISUAL_IDENTITY.whiteHex, '#FFFFFF');

  // Distinct calm per-section web identities (no brown, no purple/pink, no single uniform color)
  assert.equal(SECTIONS.gifted.primaryHex, '#956C2E');
  assert.ok(SECTIONS.gifted.accentSoftBgClass.includes('#F7EBD5'));
  assert.ok(SECTIONS.gifted.accentBorderClass.includes('#E5CFA7'));

  assert.equal(SECTIONS['professional-development'].primaryHex, '#477B59');
  assert.equal(SECTIONS.teacher.primaryHex, '#416B91');
});

test('Phase 1 Catalog: 10 sections in exact order with Sections 1-4 active in Phase 1', () => {
  assert.equal(GIFTED_SECTIONS_CATALOG.length, 10);
  const numbers = GIFTED_SECTIONS_CATALOG.map((s) => s.sectionNumber);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const phase1Active = GIFTED_SECTIONS_CATALOG.filter(
    (s) => s.implementationPhase === 1
  );
  assert.equal(phase1Active.length, 4);
  assert.deepEqual(
    phase1Active.map((s) => s.sectionNumber),
    [1, 2, 3, 4]
  );
});

test('Section 1 & Reference Data: No coordinator phone/email, no "قيمنا", coordinator-only duties', () => {
  const record = createInitialGiftedCoordinatorRecord('combined');
  const basicInfoKeys = Object.keys(record.basicInfo);
  assert.ok(!basicInfoKeys.includes('phone'));
  assert.ok(!basicInfoKeys.includes('mobile'));
  assert.ok(!basicInfoKeys.includes('email'));

  assert.equal(GIFTED_GENERAL_OBJECTIVES.length, 12);
  assert.equal(GIFTED_SCHOOL_OBJECTIVES.length, 5);
  assert.equal(GIFTED_STRATEGIC_PILLARS.length, 4);
  assert.equal(GIFTED_COORDINATOR_DUTIES.length, 13);

  // Verify no principal or counselor duty headers exist in coordinator duties
  for (const duty of GIFTED_COORDINATOR_DUTIES) {
    assert.ok(!duty.includes('مهام مدير المدرسة'));
    assert.ok(!duty.includes('مهام الموجه الطلابي'));
  }
});

test('Section 3 Ministerial Programs: Preserves all 7 programs with independent verbatim action counts (3, 7, 8, 7, 10, 4, 7)', () => {
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.awareness.length, 3);
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.national_identification.length, 7);
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.olympiad_research.length, 8);
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.olympiad_scientific.length, 7);
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.innovation_space.length, 10);
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.gulf_week.length, 4);
  assert.equal(GIFTED_STANDARD_PROGRAM_ACTIONS.acceleration.length, 7);

  const record = createInitialGiftedCoordinatorRecord('combined');
  assert.equal(record.ministerialPrograms.length, 7);

  const researchOlympiad = record.ministerialPrograms.find(
    (p) => p.code === 'olympiad_research'
  );
  const scientificOlympiad = record.ministerialPrograms.find(
    (p) => p.code === 'olympiad_scientific'
  );
  assert.ok(researchOlympiad);
  assert.ok(scientificOlympiad);
  assert.equal(researchOlympiad.actions.length, 8);
  assert.equal(scientificOlympiad.actions.length, 7);
  assert.notDeepEqual(
    researchOlympiad.actions.map((a) => a.actionText),
    scientificOlympiad.actions.map((a) => a.actionText)
  );
});

test('Completion Metrics Engine: Computes (executed / totalActive * 100), separates Executive Plan vs Program Actions, and excludes non-applicable programs', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // Default executivePlan has 9 items (7 ministerial programs + 2 competitions)
  assert.equal(record.executivePlan.length, 9);

  // Set specific statuses on executivePlan: 3 executed, 4 pending, 2 not_executed
  record.executivePlan = record.executivePlan.map((item, idx) => ({
    ...item,
    status: idx < 3 ? 'executed' : idx < 7 ? 'pending' : 'not_executed',
  }));

  let metrics = computeGiftedCompletionMetrics(record);
  assert.equal(metrics.executivePlanMetrics.totalActive, 9);
  assert.equal(metrics.executivePlanMetrics.executed, 3);
  assert.equal(metrics.executivePlanMetrics.pending, 4);
  assert.equal(metrics.executivePlanMetrics.notExecuted, 2);
  assert.equal(metrics.executivePlanMetrics.completionPercentage, 33);

  // Switch school stage to 'elementary' -> olympiad_research & olympiad_scientific become non-applicable
  assert.equal(
    isProgramSupportedInSchoolStage(['middle', 'high', 'combined'], 'elementary'),
    false
  );
  assert.equal(
    isProgramSupportedInSchoolStage(
      ['elementary', 'middle', 'high', 'combined'],
      'elementary'
    ),
    true
  );

  record = updateSchoolStageInRecord(record, 'elementary', true);
  metrics = computeGiftedCompletionMetrics(record);

  assert.equal(metrics.applicableProgramsCount, 5);
  assert.equal(metrics.excludedProgramsCount, 2);
  // Active executive plan items drop from 9 to 7 (excluding the 2 middle/high olympiads)
  assert.equal(metrics.executivePlanMetrics.totalActive, 7);
  // Program actions totalActive drops from 46 (3+7+8+7+10+4+7) to 31 (46 - 8 - 7)
  assert.equal(metrics.programActionsMetrics.totalActive, 31);
});

test('Section 4 Unified Schedule: Syncs edits by ID across Ministerial Programs, Custom Initiatives, Competitions, and Executive Plan', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');
  const initialRows = getUnifiedTargetAndScheduleRows(record);

  // 7 ministerial + 2 default competitions = 9 unified rows
  assert.equal(initialRows.length, 9);

  // Update 'prog-awareness' program via Section 4 unified schedule
  record = updateUnifiedTargetAndScheduleRow(
    record,
    'ministerial',
    'prog-awareness',
    {
      targetAudience: 'جميع طلاب ومعلمي المدرسة وأولياء الأمور',
      scheduledPeriod: 'الأسبوع الأول والثاني من الفصل الأول',
      weekLabel: 'الأسبوع ٢',
    }
  );

  const updatedProgram = record.ministerialPrograms.find(
    (p) => p.id === 'prog-awareness'
  );
  assert.equal(
    updatedProgram?.targetAudience,
    'جميع طلاب ومعلمي المدرسة وأولياء الأمور'
  );
  assert.equal(
    updatedProgram?.scheduledPeriod,
    'الأسبوع الأول والثاني من الفصل الأول'
  );
  assert.equal(updatedProgram?.weekLabel, 'الأسبوع ٢');

  // Verify linked executive plan row also updated automatically
  const linkedPlanRow = record.executivePlan.find(
    (item) => item.linkedProgramId === 'prog-awareness'
  );
  assert.equal(
    linkedPlanRow?.targetAudience,
    'جميع طلاب ومعلمي المدرسة وأولياء الأمور'
  );
  assert.equal(
    linkedPlanRow?.executionDate,
    'الأسبوع الأول والثاني من الفصل الأول'
  );
  assert.equal(linkedPlanRow?.weekLabel, 'الأسبوع ٢');
});

test('Student Sanitization: Keeps optional civilId and strips any student phone fields', () => {
  const raw = createInitialGiftedCoordinatorRecord(
    'middle'
  ) as unknown as Record<string, unknown>;
  raw.students = [
    {
      id: 'stu-1',
      name: 'عبدالله محمد الغامدي',
      civilId: '1122334455',
      grade: 'ثالث متوسط / ١',
      level: 'المستوى الأول',
      talentDomain: 'موهبة علمية ورياضية',
      score: '1650',
      classification: 'exceptional_gifted',
      notes: '',
      phone: '0500000000',
      studentPhone: '0500000000',
    },
    {
      id: 'stu-2',
      name: 'سلمان فهد الزهراني',
      grade: 'أول متوسط / ٢',
      level: 'المستوى الثاني',
      talentDomain: 'ابتكار تقني',
      score: '1480',
      classification: 'gifted',
      notes: '',
    },
  ];

  const sanitized = sanitizeGiftedCoordinatorRecord(raw);
  assert.equal(sanitized.students.length, 2);
  assert.equal(sanitized.students[0].civilId, '1122334455');
  assert.equal(sanitized.students[1].civilId, undefined);
  assert.ok(!('phone' in sanitized.students[0]));
  assert.ok(!('studentPhone' in sanitized.students[0]));
});

test('Full ZIP Backup & Restore Engine: Exports and restores record.json + IndexedDB binary attachments across clean repositories with CRC-32 validation', async () => {
  // 1. Prepare customized record
  const sourceRecord = createInitialGiftedCoordinatorRecord('high', 'second');
  sourceRecord.customInitiatives.push({
    id: 'init-robotics-lab',
    title: 'معمل الروبوت والذكاء الاصطناعي للموهوبين',
    initiativeType: 'مبادرة',
    objective: 'تأهيل الطلاب للمنافسات البحثية',
    executedTasks: 'تدريب ١٥ طالباً موهوباً على برمجة الحساسات',
    stage: 'المرحلة الثانوية',
    targetAudience: 'طلاب الصف الأول والثاني ثانوي',
    executionDate: '١٤٤٧/٠٦/١٥ هـ',
    semester: 'second',
    weekLabel: 'الأسبوع ٧',
    status: 'executed',
    nonExecutionReason: '',
    achievementIndicator: 'إنجاز ٥ مشاريع ابتكارية قابلة للمشاركة في إبداع',
    notes: '',
  });

  // 2. Populate source attachment repository with 2 binary files (simulated PDF & PNG)
  const sourceRepo = createMemoryAttachmentRepository();
  const pdfBytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x99, 0xab,
  ]);
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22, 0x33, 0x44,
  ]);

  await sourceRepo.putAttachment({
    blobKey: 'att-evidence-pdf-1',
    filename: 'تقرير_الأولمبياد_الوطني.pdf',
    mimeType: 'application/pdf',
    bytes: pdfBytes,
    createdAt: '2026-11-12T10:00:00.000Z',
  });

  await sourceRepo.putAttachment({
    blobKey: 'att-evidence-png-2',
    filename: 'شاهد_معرض_الابتكار.png',
    mimeType: 'image/png',
    bytes: pngBytes,
    createdAt: '2026-11-12T11:00:00.000Z',
  });

  // 3. Export full ZIP archive
  const { zipBytes, filename, manifest } = await exportGiftedFullBackupZip(
    sourceRecord,
    {
      attachmentRepo: sourceRepo,
    }
  );

  assert.ok(zipBytes.byteLength > 200);
  assert.ok(filename.endsWith('.zip'));
  assert.equal(manifest.attachmentsCount, 2);

  // Verify internal ZIP structure contains manifest.json, record.json, and both binary files
  const entries = extractZipArchiveEntries(zipBytes);
  assert.ok(entries.some((e) => e.filename === 'manifest.json'));
  assert.ok(entries.some((e) => e.filename === 'record.json'));
  assert.equal(entries.length, 4);

  // 4. Restore into a completely empty destination repository (simulating another browser/device)
  const destinationRepo = createMemoryAttachmentRepository();
  const restoreResult = await importAndRestoreGiftedFullBackupZip(zipBytes, {
    attachmentRepo: destinationRepo,
    replaceExistingAttachments: true,
  });

  assert.equal(restoreResult.restoredAttachmentsCount, 2);
  assert.equal(restoreResult.record.basicInfo.schoolStage, 'high');
  assert.equal(restoreResult.record.basicInfo.semester, 'second');
  assert.ok(
    restoreResult.record.customInitiatives.some(
      (i) => i.id === 'init-robotics-lab'
    )
  );

  // Verify binary attachments in destination repository match byte-for-byte under generation-scoped keys
  const restoredAttachments = await destinationRepo.listAttachments();
  assert.equal(restoredAttachments.length, 2);
  assert.ok(restoreResult.restoreGenId.startsWith('rgen-'));
  assert.equal(restoreResult.record.activeRestoreGenId, restoreResult.restoreGenId);

  const expectedPdfKey = buildRestoreGenBlobKey(
    restoreResult.restoreGenId,
    'att-evidence-pdf-1'
  );
  const expectedPngKey = buildRestoreGenBlobKey(
    restoreResult.restoreGenId,
    'att-evidence-png-2'
  );

  const restoredPdf = restoredAttachments.find(
    (a) => a.blobKey === expectedPdfKey
  );
  const restoredPng = restoredAttachments.find(
    (a) => a.blobKey === expectedPngKey
  );

  assert.ok(restoredPdf);
  assert.ok(restoredPng);
  assert.equal(stripRestoreGenPrefix(restoredPdf.blobKey), 'att-evidence-pdf-1');
  assert.equal(restoredPdf.filename, 'تقرير_الأولمبياد_الوطني.pdf');
  assert.deepEqual(Array.from(restoredPdf.bytes), Array.from(pdfBytes));
  assert.deepEqual(Array.from(restoredPng.bytes), Array.from(pngBytes));
});

test('Full ZIP Restore Integrity Check: Rejects corrupted binary attachment bytes via CRC-32 verification', async () => {
  const record = createInitialGiftedCoordinatorRecord('combined');
  const repo = createMemoryAttachmentRepository();
  await repo.putAttachment({
    blobKey: 'att-crc-check',
    filename: 'evidence.bin',
    mimeType: 'application/octet-stream',
    bytes: new Uint8Array([10, 20, 30, 40, 50, 60]),
    createdAt: '2026-11-12T10:00:00.000Z',
  });

  const { zipBytes } = await exportGiftedFullBackupZip(record, {
    attachmentRepo: repo,
  });

  // Corrupt a byte inside the stored file payload
  const corruptedZip = new Uint8Array(zipBytes);
  for (let i = 0; i < corruptedZip.length - 6; i++) {
    if (
      corruptedZip[i] === 10 &&
      corruptedZip[i + 1] === 20 &&
      corruptedZip[i + 2] === 30 &&
      corruptedZip[i + 3] === 40
    ) {
      corruptedZip[i + 2] = 99;
      break;
    }
  }

  const destRepo = createMemoryAttachmentRepository();
  await assert.rejects(
    async () => {
      await importAndRestoreGiftedFullBackupZip(corruptedZip, {
        attachmentRepo: destRepo,
      });
    },
    /فشل التحقق من سلامة|CRC-32/
  );
});

test('Phase 2 Section 6 Unified Action Engine: Strictly enforces the 46 standard actions (8 Research, 7 Scientific), individual updates only, and prevents denominator tampering', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // All 46 standard actions are returned across the 7 ministerial programs
  const allActions = getUnifiedExecutionActionsCatalog(record);
  assert.equal(allActions.length, 46);

  // Filter by Research Olympiad -> 8 independent actions
  const researchActions = getUnifiedExecutionActionsCatalog(record, {
    programId: 'prog-olympiad-research',
  });
  assert.equal(researchActions.length, 8);

  // Filter by Scientific Olympiad -> 7 independent actions
  const scientificActions = getUnifiedExecutionActionsCatalog(record, {
    programId: 'prog-olympiad-scientific',
  });
  assert.equal(scientificActions.length, 7);

  // Individual updates only: Update 2 actions in Awareness to 'executed' and 1 to 'not_executed'
  record = updateProgramActionInRecord(record, 'prog-awareness', 'act-awareness-1', {
    status: 'executed',
    executionDate: '١٤٤٧/٠٣/١٠ هـ',
    weekLabel: 'الأسبوع ٢',
  });
  record = updateProgramActionInRecord(record, 'prog-awareness', 'act-awareness-2', {
    status: 'executed',
    executionDate: '١٤٤٧/٠٣/١٢ هـ',
  });
  record = updateProgramActionInRecord(record, 'prog-awareness', 'act-awareness-3', {
    status: 'not_executed',
    nonExecutionReason: 'تعارض مع الاختبارات القصيرة',
  });

  // Update 8 Research Olympiad actions individually to 'executed'
  for (let i = 1; i <= 8; i++) {
    record = updateProgramActionInRecord(
      record,
      'prog-olympiad-research',
      `act-olympiad_research-${i}`,
      {
        status: 'executed',
        executionDate: '١٤٤٧/٠٤/٠١ هـ',
      }
    );
  }

  // Verify Section 5 indicators reflect exact weighted sum: (2 + 8) / 46 * 100 = 10 / 46 * 100 = 22%
  const metrics = computeGiftedCompletionMetrics(record);
  assert.equal(metrics.programActionsMetrics.executed, 10);
  assert.equal(metrics.programActionsMetrics.notExecuted, 1);
  assert.equal(metrics.programActionsMetrics.pending, 35);
  assert.equal(metrics.programActionsMetrics.totalActive, 46);
  assert.equal(metrics.programActionsMetrics.completionPercentage, 22);

  // Verify external/injected actions in raw JSON cannot alter the 46 standard actions or their verbatim texts
  const tamperedRaw = JSON.parse(JSON.stringify(record));
  tamperedRaw.ministerialPrograms[0].actions[0].actionText = 'نص محرف غير معتمد';
  tamperedRaw.ministerialPrograms[0].actions.push({
    id: 'act-extra-99',
    order: 99,
    actionText: 'إجراء خارجي غير مصرح به',
    status: 'executed',
  });
  const sanitized = sanitizeGiftedCoordinatorRecord(tamperedRaw);
  assert.equal(sanitized.ministerialPrograms[0].actions.length, 3);
  assert.equal(
    sanitized.ministerialPrograms[0].actions[0].actionText,
    GIFTED_STANDARD_PROGRAM_ACTIONS.awareness[0]
  );
  assert.equal(getUnifiedExecutionActionsCatalog(sanitized).length, 46);
});

test('Phase 2 High School (المرحلة الثانوية) Indicator Calculation: 29 active actions across 5 applicable programs (excluding Innovation Space 10 and Acceleration 7)', () => {
  let hsRecord = createInitialGiftedCoordinatorRecord('high');

  const initialMetrics = computeGiftedCompletionMetrics(hsRecord);
  // 5 applicable programs (3 + 7 + 8 + 7 + 4 = 29 active actions), 2 excluded (10 + 7 = 17)
  assert.equal(initialMetrics.applicableProgramsCount, 5);
  assert.equal(initialMetrics.excludedProgramsCount, 2);
  assert.equal(initialMetrics.programActionsMetrics.totalActive, 29);
  assert.equal(initialMetrics.programActionsMetrics.executed, 0);
  assert.equal(initialMetrics.programActionsMetrics.completionPercentage, 0);

  // Execute 3 in Awareness + 8 in Research Olympiad + 4 in Gulf Week = 15 executed out of 29 active
  for (let i = 1; i <= 3; i++) {
    hsRecord = updateProgramActionInRecord(
      hsRecord,
      'prog-awareness',
      `act-awareness-${i}`,
      { status: 'executed' }
    );
  }
  for (let i = 1; i <= 8; i++) {
    hsRecord = updateProgramActionInRecord(
      hsRecord,
      'prog-olympiad-research',
      `act-olympiad_research-${i}`,
      { status: 'executed' }
    );
  }
  for (let i = 1; i <= 4; i++) {
    hsRecord = updateProgramActionInRecord(
      hsRecord,
      'prog-gulf-week',
      `act-gulf_week-${i}`,
      { status: 'executed' }
    );
  }

  // Even if an excluded program (e.g. acceleration) has an action marked 'executed', it must NOT enter numerator or denominator
  hsRecord = updateProgramActionInRecord(
    hsRecord,
    'prog-acceleration',
    'act-acceleration-1',
    { status: 'executed' }
  );

  const updatedMetrics = computeGiftedCompletionMetrics(hsRecord);
  // Numerator = 15, Denominator = 29, Percentage = Math.round(15 / 29 * 100) = 52%
  assert.equal(updatedMetrics.programActionsMetrics.executed, 15);
  assert.equal(updatedMetrics.programActionsMetrics.pending, 14);
  assert.equal(updatedMetrics.programActionsMetrics.notExecuted, 0);
  assert.equal(updatedMetrics.programActionsMetrics.totalActive, 29);
  assert.equal(updatedMetrics.programActionsMetrics.completionPercentage, 52);
});

test('Phase 2 Section 7 Students, Participations, Qualifications & Achievements: Links by studentId without duplication, strips phone numbers, and summarizes metrics', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // 1. Add 2 gifted students (one with optional civilId, one without)
  const res1 = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-gifted-1',
    name: 'فيصل بن خالد الغامدي',
    grade: 'الأول الثانوي / ١',
    level: 'المستوى الأول',
    civilId: '1100223344',
    talentDomain: 'العلوم والبحث العلمي',
    score: '1690',
    classification: 'exceptional_gifted',
    notes: 'مجتاز مقياس موهبة بتفوق استثنائي',
  });
  record = res1.record;

  const res2 = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-gifted-2',
    name: 'عمر بن سعيد الزهراني',
    grade: 'الثالث المتوسط / ٢',
    level: 'المستوى الثاني',
    talentDomain: 'الرياضيات والمعلوماتية',
    score: '1520',
    classification: 'gifted',
  });
  record = res2.record;

  assert.equal(record.students.length, 2);
  assert.equal(record.students[0].civilId, '1100223344');
  assert.equal(record.students[1].civilId, undefined);

  // 2. Link student 1 to Research Olympiad (qualified to Stage 2) and National Identification
  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    id: 'part-res-1',
    studentId: 'stu-gifted-1',
    category: 'olympiad_research',
    projectTitle: 'توظيف الذكاء الاصطناعي في ترشيد استهلاك المياه الزراعية',
    projectField: 'الاستدامة البيئية والطاقة',
    qualifiedToNextStage: true,
    achievementText: 'التأهل للمرحلة الثانية على مستوى الإدارة التعليمية',
    notes: 'مشروع بحثي محكم',
  });

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    id: 'part-nat-1',
    studentId: 'stu-gifted-1',
    category: 'national_identification',
    nominationType: 'supported',
    score: '1690',
    classificationResult: 'موهبة استثنائية',
    qualifiedToNextStage: true,
    achievementText: 'اجتياز المقياس ضمن الفئة الاستثنائية',
  });

  // 3. Link student 2 to Scientific Olympiad (Finalist) and Kangaroo Competition
  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    id: 'part-sci-1',
    studentId: 'stu-gifted-2',
    category: 'olympiad_scientific',
    scientificTrack: 'الرياضيات',
    qualifiedToNextStage: true,
    achievementText: 'التأهل للتصفيات النهائية في مسار الرياضيات',
  });

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    id: 'part-comp-1',
    studentId: 'stu-gifted-2',
    category: 'scientific_competition',
    linkedProgramOrCompetitionId: 'comp-kangaroo',
    competitionTitle: 'مسابقة الكانجارو للرياضيات',
    qualifiedToNextStage: false,
    achievementText: 'تحقيق الميدالية الفضية',
  });

  // 4. Verify resolved participations automatically inherit student name, grade, and optional civilId
  const resolvedResearch = resolveStudentParticipationsWithStudentInfo(record, {
    category: 'olympiad_research',
    onlyQualified: true,
  });
  assert.equal(resolvedResearch.length, 1);
  assert.equal(resolvedResearch[0].studentName, 'فيصل بن خالد الغامدي');
  assert.equal(resolvedResearch[0].studentGrade, 'الأول الثانوي / ١');
  assert.equal(resolvedResearch[0].studentCivilId, '1100223344');

  // 5. Verify updating student's grade in master registry immediately reflects in all linked participations
  record = addOrUpdateGiftedStudentInRecord(record, {
    ...record.students[0],
    grade: 'الثاني الثانوي / مسار عام',
  }).record;
  const resolvedAfterGradeUpdate = resolveStudentParticipationsWithStudentInfo(
    record,
    { studentId: 'stu-gifted-1' }
  );
  assert.equal(resolvedAfterGradeUpdate.length, 2);
  assert.equal(
    resolvedAfterGradeUpdate[0].studentGrade,
    'الثاني الثانوي / مسار عام'
  );

  // 6. Verify summary counts
  const summary = computeGiftedStudentsAndAchievementsSummary(record);
  assert.equal(summary.totalStudents, 2);
  assert.equal(summary.exceptionalGiftedCount, 1);
  assert.equal(summary.giftedCount, 1);
  assert.equal(summary.totalParticipations, 4);
  assert.equal(summary.qualifiedStudentsCount, 3);
  assert.equal(summary.qualifiedResearchOlympiadCount, 1);
  assert.equal(summary.qualifiedScientificOlympiadCount, 1);
  assert.equal(summary.documentedAchievementsCount, 4);

  // 7. Deleting a student cleans up their linked participations
  record = deleteGiftedStudentFromRecord(record, 'stu-gifted-2');
  assert.equal(record.students.length, 1);
  assert.equal(record.studentParticipations.length, 2);
});

const MOCK_SETTINGS_FOR_REPORTS: SchoolSettings = {
  schoolName: 'ثانوية الفيصل للموهوبين',
  userName: 'أ. عبدالرحمن بن محمد العتيبي',
  principalName: 'أ. فهد بن عبدالله القحطاني',
  educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
  academicYear: '١٤٤٨هـ',
  gender: 'male',
  roles: {
    professionalDevelopment: '',
    gifted: 'منسق الموهوبين',
    teacher: '',
  },
};

test('Phase 3 Section 8 Evidence Repository: Strictly limited to programs, initiatives, and competitions with max 4 photos & 4 links per target and full ZIP backup roundtrip', async () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // Add a custom initiative to verify catalog includes 7 ministerial + 1 initiative + 2 competitions
  record = {
    ...record,
    customInitiatives: [
      {
        id: 'init-robotics',
        title: 'حاضنة الروبوت والذكاء الاصطناعي',
        initiativeType: 'مبادرة',
        objective: 'تمكين الطلاب من بناء نماذج روبوتية ذكية',
        executedTasks: 'تنفيذ ٤ ورش عملية وتحكيم المشاريع',
        stage: 'الثانوية',
        targetAudience: 'الطلبة الموهوبون',
        executionDate: '١٤٤٨/٠٥/١٢هـ',
        semester: 'first',
        weekLabel: 'الأسبوع السادس',
        status: 'executed',
        nonExecutionReason: '',
        achievementIndicator: 'إنجاز ١٠ مشاريع طلابية',
        notes: '',
      },
    ],
  };

  const catalog = getGiftedEvidenceTargetsCatalog(record);
  assert.equal(catalog.length, 10); // 7 ministerial + 1 initiative + 2 competitions
  assert.ok(
    catalog.every(
      (c) =>
        c.category === 'ministerial_program' ||
        c.category === 'custom_initiative' ||
        c.category === 'scientific_competition'
    )
  );

  // Add 4 photos to 'prog-awareness' and verify 5th throws
  const attachmentRepo = createMemoryAttachmentRepository();
  for (let i = 1; i <= MAX_GIFTED_EVIDENCE_PHOTOS; i++) {
    const blobKey = `blob-awareness-photo-${i}`;
    await attachmentRepo.putAttachment({
      blobKey,
      filename: `photo-${i}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([137, 80, 78, 71, i]),
      createdAt: new Date().toISOString(),
    });
    record = addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
      id: `ph-${i}`,
      blobKey,
      title: `صورة توثيق ${i}`,
      selectedForProgramReport: i <= 2,
      selectedForFinalRecord: i === 1,
    });
  }

  assert.equal(
    getEvidenceBundleForTarget(record, 'prog-awareness').photos.length,
    4
  );
  assert.throws(() => {
    addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
      blobKey: 'blob-awareness-photo-5',
      title: 'صورة خامسة تتجاوز الحد',
    });
  }, /الحد الأقصى للشواهد المصورة/);

  // Add 4 links to 'prog-awareness' and verify 5th throws
  for (let i = 1; i <= MAX_GIFTED_EVIDENCE_LINKS; i++) {
    record = addEvidenceLinkToTargetInRecord(record, 'prog-awareness', {
      id: `lnk-${i}`,
      title: `رابط شاهد ${i}`,
      url: `https://example.edu.sa/evidence/${i}`,
      selectedForProgramReport: i === 1,
      selectedForFinalRecord: i <= 2,
    });
  }

  assert.equal(
    getEvidenceBundleForTarget(record, 'prog-awareness').links.length,
    4
  );
  assert.throws(() => {
    addEvidenceLinkToTargetInRecord(record, 'prog-awareness', {
      title: 'رابط خامس يتجاوز الحد',
      url: 'https://example.edu.sa/evidence/5',
    });
  }, /الحد الأقصى للروابط الإلكترونية/);

  // Toggle selection flags and delete 1 photo & 1 link
  record = updateEvidencePhotoInTargetInRecord(
    record,
    'prog-awareness',
    'ph-3',
    { selectedForFinalRecord: true }
  );
  record = updateEvidenceLinkInTargetInRecord(
    record,
    'prog-awareness',
    'lnk-3',
    { selectedForProgramReport: true }
  );
  record = deleteEvidencePhotoFromTargetInRecord(
    record,
    'prog-awareness',
    'ph-4'
  );
  record = deleteEvidenceLinkFromTargetInRecord(
    record,
    'prog-awareness',
    'lnk-4'
  );

  const updatedBundle = getEvidenceBundleForTarget(record, 'prog-awareness');
  assert.equal(updatedBundle.photos.length, 3);
  assert.equal(updatedBundle.links.length, 3);

  // Verify full ZIP export and restore preserves evidenceBundles and IndexedDB attachments
  const exported = await exportGiftedFullBackupZip(record, {
    attachmentRepo,
    settings: MOCK_SETTINGS_FOR_REPORTS,
  });
  assert.equal(exported.manifest.attachmentsCount, 4);

  const targetRepo = createMemoryAttachmentRepository();
  const restored = await importAndRestoreGiftedFullBackupZip(exported.zipBytes, {
    attachmentRepo: targetRepo,
  });
  assert.equal(restored.restoredAttachmentsCount, 4);
  const restoredBundle = getEvidenceBundleForTarget(
    restored.record,
    'prog-awareness'
  );
  assert.equal(restoredBundle.photos.length, 3);
  assert.equal(restoredBundle.links.length, 3);
  assert.equal(restoredBundle.photos[2].selectedForFinalRecord, true);
  assert.equal(restoredBundle.links[2].selectedForProgramReport, true);
});

test('Phase 3 Section 9 Follow-up & Evaluation: Automatically aggregates non_executed items with reasons and strictly maintains the 4 evaluation fields without caseFollowups', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // Verify caseFollowups does NOT exist on evaluation
  assert.deepEqual(Object.keys(record.evaluation).sort(), [
    'challenges',
    'improvementProposals',
    'strengths',
    'supportingEntities',
  ]);
  assert.equal('caseFollowups' in record.evaluation, false);

  // Mark 1 Executive Plan item, 1 Standard Action, 1 Custom Initiative, and 1 Competition as not_executed
  record = {
    ...record,
    executivePlan: record.executivePlan.map((item, idx) =>
      idx === 0
        ? {
            ...item,
            status: 'not_executed',
            nonExecutionReason: 'تأجيل الموعد لتعارضه مع الاختبارات الفترية',
          }
        : item
    ),
    customInitiatives: [
      {
        id: 'init-1',
        title: 'ملتقى الخوارزمي الصغير',
        initiativeType: 'فعالية',
        objective: 'تنمية الحساب الذهني',
        executedTasks: '',
        stage: 'الابتدائية',
        targetAudience: 'طلاب الصفوف العليا',
        executionDate: '١٤٤٨/٠٦/٠١هـ',
        semester: 'first',
        weekLabel: '',
        status: 'not_executed',
        nonExecutionReason: 'بانتظار اعتماد الميزانية التشغيلية للفعالية',
        achievementIndicator: '',
        notes: '',
      },
    ],
    scientificCompetitions: record.scientificCompetitions.map((comp, idx) =>
      idx === 1
        ? {
            ...comp,
            status: 'not_executed',
            nonExecutionReason: 'لم يفتح باب التسجيل الرسمي خلال الفصل الحالي',
          }
        : comp
    ),
  };

  record = updateProgramActionInRecord(
    record,
    'prog-olympiad-research',
    'act-olympiad_research-8',
    {
      status: 'not_executed',
      nonExecutionReason: 'لم تعلن قائمة المتأهلين للمرحلة النهائية بعد',
    }
  );

  const nonExecuted = getGiftedNonExecutedItemsSummary(record);
  assert.equal(nonExecuted.length, 4);
  assert.equal(nonExecuted[0].sourceType, 'executive_plan');
  assert.equal(
    nonExecuted[0].nonExecutionReason,
    'تأجيل الموعد لتعارضه مع الاختبارات الفترية'
  );
  assert.equal(nonExecuted[1].sourceType, 'ministerial_action');
  assert.equal(
    nonExecuted[1].nonExecutionReason,
    'لم تعلن قائمة المتأهلين للمرحلة النهائية بعد'
  );
  assert.equal(nonExecuted[2].sourceType, 'custom_initiative');
  assert.equal(nonExecuted[3].sourceType, 'scientific_competition');

  // Update the 4 evaluation fields
  record = updateGiftedEvaluationSummaryInRecord(record, {
    strengths: 'تفاعل متميز من الطلبة الموهوبين وأولياء أمورهم',
    challenges: 'ضيق الوقت المخصص للأنشطة اللاصفية',
    supportingEntities: 'قسم الموهوبين وإدارة المدرسة',
    improvementProposals: 'تخصيص حصة إثرائية أسبوعية ثابتة',
  });

  const sanitized = sanitizeGiftedCoordinatorRecord(record);
  assert.equal(
    sanitized.evaluation.strengths,
    'تفاعل متميز من الطلبة الموهوبين وأولياء أمورهم'
  );
  assert.equal(
    sanitized.evaluation.improvementProposals,
    'تخصيص حصة إثرائية أسبوعية ثابتة'
  );
  assert.equal('caseFollowups' in sanitized.evaluation, false);
});

test('Phase 3 Section 10 Reports & PDF Generation: Auto-aggregates data for all 3 approved reports, respects coordinator evidence selection, and generates valid PDFs', async () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // Execute actions in Innovation Space & Awareness
  record = updateProgramActionInRecord(
    record,
    'prog-awareness',
    'act-awareness-1',
    {
      status: 'executed',
      executionDate: '١٤٤٨/٠٣/١٠هـ',
    }
  );
  record = updateProgramActionInRecord(
    record,
    'prog-innovation-space',
    'act-innovation_space-1',
    {
      status: 'executed',
      executionDate: '١٤٤٨/٠٤/٠٥هـ',
    }
  );

  // Add student & innovation_space participation
  const stuRes = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-innov-1',
    name: 'سلمان بن فهد الدوسري',
    grade: 'الأول المتوسط',
    level: 'المستوى الأول',
    talentDomain: 'الابتكار الهندسي',
    score: '1610',
    classification: 'exceptional_gifted',
  });
  record = stuRes.record;

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    id: 'part-innov-1',
    studentId: 'stu-innov-1',
    category: 'innovation_space',
    enrichmentUnit: 'وحدة الأنظمة الذكية والروبوت',
    qualifiedToNextStage: true,
    achievementText: 'تصميم نموذج ذكي لفرز النفايات بالرؤية الحاسوبية',
  });

  // Add 1 photo & 1 link to 'prog-awareness'
  record = addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
    id: 'ph-aw-1',
    blobKey: 'blob-aw-1',
    title: 'صورة البرنامج التعريفي',
    selectedForProgramReport: true,
    selectedForFinalRecord: true,
  });
  record = addEvidenceLinkToTargetInRecord(record, 'prog-awareness', {
    id: 'lnk-aw-1',
    title: 'رابط شواهد التوعية',
    url: 'https://example.edu.sa/awareness',
    selectedForProgramReport: true,
    selectedForFinalRecord: true,
  });

  // 1. Verify Program/Event Report Model (Pages 11 & 24)
  record = updateProgramEventReportOverridesInRecord(record, 'prog-awareness', {
    dayLabel: 'الأحد',
    durationLabel: 'أسبوع كامل',
  });

  const progReport = buildGiftedProgramOrEventReportModel(
    record,
    MOCK_SETTINGS_FOR_REPORTS,
    'prog-awareness'
  );
  assert.equal(progReport.generalInfo.eventName, 'التوعية والتعريف بالموهبة والموهوبين');
  assert.equal(progReport.generalInfo.dayLabel, 'الأحد');
  assert.equal(progReport.generalInfo.executionDate, '١٤٤٨/٠٣/١٠هـ');
  assert.equal(progReport.generalInfo.durationLabel, 'أسبوع كامل');
  assert.equal(progReport.eventData.showEvidences, true);
  assert.equal(progReport.eventData.selectedPhotos.length, 1);
  assert.equal(progReport.eventData.selectedLinks.length, 1);

  // Verify disabling showEvidencesInReport hides evidences from report
  const recordHiddenEv = setTargetShowEvidencesInReportInRecord(
    record,
    'prog-awareness',
    false
  );
  const progReportHidden = buildGiftedProgramOrEventReportModel(
    recordHiddenEv,
    MOCK_SETTINGS_FOR_REPORTS,
    'prog-awareness'
  );
  assert.equal(progReportHidden.eventData.showEvidences, false);
  assert.equal(progReportHidden.eventData.selectedPhotos.length, 0);
  assert.equal(progReportHidden.eventData.selectedLinks.length, 0);

  // 2. Verify Innovation Space Progress Report Model (Page 21)
  record = updateInnovationProgressReportOverridesInRecord(record, {
    outputsCount: '4',
    distinguishedOutputsCount: '2',
  });
  const innovReport = buildGiftedInnovationSpaceProgressReportModel(
    record,
    MOCK_SETTINGS_FOR_REPORTS
  );
  assert.equal(
    innovReport.basicData.educationDepartment,
    'الإدارة العامة للتعليم بمنطقة الرياض'
  );
  assert.equal(innovReport.basicData.schoolName, 'ثانوية الفيصل للموهوبين');
  assert.equal(
    innovReport.executionData.enrichmentUnit,
    'وحدة الأنظمة الذكية والروبوت'
  );
  assert.equal(innovReport.executionData.beneficiariesCount, '1');
  assert.equal(innovReport.executionData.outputsCount, '4');
  assert.equal(innovReport.executionData.distinguishedOutputsCount, '2');
  assert.ok(
    innovReport.executionData.distinguishedOutputsSummary.includes(
      'سلمان بن فهد الدوسري'
    )
  );

  // 3. Verify Final Administrative Report Model (Concise vs Detailed)
  const finalConcise = buildGiftedFinalRecordReportModel(
    record,
    MOCK_SETTINGS_FOR_REPORTS
  );
  assert.equal(finalConcise.mode, 'concise');
  assert.equal(finalConcise.selectedEvidenceGroups.length, 1);
  assert.equal(finalConcise.studentsSummary.totalStudents, 1);

  const finalDetailed = buildGiftedFinalRecordReportModel(
    record,
    MOCK_SETTINGS_FOR_REPORTS,
    { mode: 'detailed' }
  );
  assert.equal(finalDetailed.mode, 'detailed');

  // 4. Verify PDF binary generation for all 3 reports
  const pdf1 = await generateGiftedProgramOrEventReportPdf(progReport);
  const pdf2 = await generateGiftedInnovationSpaceProgressReportPdf(innovReport);
  const pdf3 = await generateGiftedFinalRecordPdf(finalConcise);

  const headerDecoder = new TextDecoder('ascii');
  assert.ok(headerDecoder.decode(pdf1.subarray(0, 8)).startsWith('%PDF-1.4'));
  assert.ok(headerDecoder.decode(pdf2.subarray(0, 8)).startsWith('%PDF-1.4'));
  assert.ok(headerDecoder.decode(pdf3.subarray(0, 8)).startsWith('%PDF-1.4'));
});

test('Central Student Registry (Task 1): Add 3 students, edit without changing ID, duplicate/similarity detection, search/grade filter, and safe deletion check', () => {
  let record = createInitialGiftedCoordinatorRecord('high');
  const highGrades = getApprovedGradesForStage('high');
  assert.deepEqual(highGrades, [
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
  ]);

  // 1. Add 3 students (with and without optional civilId)
  const add1 = addOrUpdateGiftedStudentInRecord(record, {
    name: 'أحمد بن محمد القحطاني',
    grade: 'الصف الأول الثانوي',
    classification: 'exceptional_gifted',
    talentDomain: 'العلوم والبحث العلمي',
    civilId: '1099887766',
  });
  record = add1.record;
  const id1 = add1.student.id;

  const add2 = addOrUpdateGiftedStudentInRecord(record, {
    name: 'سعود بن فهد الشمري',
    grade: 'الصف الثاني الثانوي',
    classification: 'gifted',
    talentDomain: 'الرياضيات والمعلوماتية',
  });
  record = add2.record;
  const id2 = add2.student.id;

  const add3 = addOrUpdateGiftedStudentInRecord(record, {
    name: 'خالد بن عبدالله العتيبي',
    grade: 'الصف الثالث الثانوي',
    classification: 'promising',
    talentDomain: 'الذكاء الاصطناعي والبرمجة',
  });
  record = add3.record;
  const id3 = add3.student.id;

  assert.equal(record.students.length, 3);
  assert.ok(id1.startsWith('stu-'));
  assert.ok(id2.startsWith('stu-'));
  assert.ok(id3.startsWith('stu-'));
  assert.notEqual(id1, id2);
  assert.notEqual(id2, id3);
  assert.equal(record.students[1].civilId, undefined);

  // 2. Prevent exact duplicate (normalized Arabic name or same Civil ID) and warn on similarity
  const dupByName = checkGiftedStudentDuplicateOrSimilarity(record, {
    name: 'احمد بن محمد القحطاني', // بدون همزة
    grade: 'الصف الأول الثانوي',
  });
  assert.equal(dupByName.status, 'duplicate_blocked');
  assert.equal(dupByName.matchedStudent?.id, id1);

  const dupByCivilId = checkGiftedStudentDuplicateOrSimilarity(record, {
    name: 'طالب آخر مختلف',
    civilId: '1099887766',
  });
  assert.equal(dupByCivilId.status, 'duplicate_blocked');
  assert.equal(dupByCivilId.matchedStudent?.id, id1);

  const similarName = checkGiftedStudentDuplicateOrSimilarity(record, {
    name: 'أحمد بن محمد الدوسري', // يشترك في الاسم الأول واسم الأب
    grade: 'الصف الأول الثانوي',
  });
  assert.equal(similarName.status, 'similar_warning');
  assert.equal(similarName.matchedStudent?.id, id1);

  // 3. Edit student 2 and verify internal ID remains 100% immutable
  const edit2 = addOrUpdateGiftedStudentInRecord(record, {
    id: id2,
    name: 'سعود بن فهد بن عبدالعزيز الشمري',
    grade: 'الصف الثالث الثانوي',
    classification: 'exceptional_gifted',
    talentDomain: 'الهندسة والابتكار التقني',
    civilId: '1055443322',
  });
  record = edit2.record;
  assert.equal(edit2.student.id, id2);
  assert.equal(record.students.length, 3);
  assert.equal(record.students[1].id, id2);
  assert.equal(record.students[1].name, 'سعود بن فهد بن عبدالعزيز الشمري');
  assert.equal(record.students[1].grade, 'الصف الثالث الثانوي');
  assert.equal(record.students[1].classification, 'exceptional_gifted');
  assert.equal(record.students[1].civilId, '1055443322');

  // 4. Search by name (normalized) and filter by grade
  const searchResult = filterAndSearchGiftedStudents(record.students, {
    searchQuery: 'احمد',
  });
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].id, id1);

  const grade3Result = filterAndSearchGiftedStudents(record.students, {
    gradeFilter: 'الصف الثالث الثانوي',
  });
  assert.equal(grade3Result.length, 2); // student 2 (edited to grade 3) and student 3

  // 5. Safe Deletion Check: Link student 1 to a program participation -> deletion must be blocked!
  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    studentId: id1,
    category: 'olympiad_research',
    projectTitle: 'مشروع الطاقة المتجددة',
    qualifiedToNextStage: true,
    achievementText: 'متأهل',
  });

  const safety1 = checkGiftedStudentDeletionSafety(record, id1);
  assert.equal(safety1.canDelete, false);
  assert.equal(safety1.linkedParticipationsCount, 1);

  const attemptedDelete1 = safeDeleteGiftedStudentFromRecord(record, id1);
  assert.equal(attemptedDelete1.deleted, false);
  assert.equal(attemptedDelete1.record.students.length, 3);
  assert.equal(attemptedDelete1.record.studentParticipations.length, 1);

  // Student 3 has no linked participations -> safeDelete succeeds cleanly
  const attemptedDelete3 = safeDeleteGiftedStudentFromRecord(record, id3);
  assert.equal(attemptedDelete3.deleted, true);
  record = attemptedDelete3.record;
  assert.equal(record.students.length, 2);
  assert.equal(record.studentParticipations.length, 1);
});

test('Program Templates Library (Task 2): Official programs & 46 PDF requirements preserved, add/edit template with immutable ID, non-retroactive execution snapshots, active toggle, search/filter, and 19 weeks list', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // 1. Verify 19 academic weeks list (الأسبوع الأول .. الأسبوع التاسع عشر)
  assert.equal(GIFTED_ACADEMIC_WEEKS_LIST.length, 19);
  assert.equal(GIFTED_ACADEMIC_WEEKS_LIST[0], 'الأسبوع الأول');
  assert.equal(GIFTED_ACADEMIC_WEEKS_LIST[18], 'الأسبوع التاسع عشر');

  // 2. Verify all 7 official Ministerial Programs + 2 Scientific Competitions are seeded with their exact requirements
  const initialTemplates = getGiftedProgramTemplatesFromRecord(record);
  assert.equal(initialTemplates.length, 9);

  const awarenessTpl = initialTemplates.find(
    (t) => t.id === 'tpl-prog-awareness'
  );
  assert.ok(awarenessTpl);
  assert.equal(awarenessTpl.requirementsAndActions.length, 3);
  assert.equal(awarenessTpl.isOfficialReference, true);

  const innovationTpl = initialTemplates.find(
    (t) => t.id === 'tpl-prog-innovation-space'
  );
  assert.ok(innovationTpl);
  assert.equal(innovationTpl.requirementsAndActions.length, 10);

  const kangarooTpl = initialTemplates.find(
    (t) => t.id === 'tpl-comp-kangaroo'
  );
  assert.ok(kangarooTpl);
  assert.equal(kangarooTpl.category, 'competition');
  assert.ok(kangarooTpl.requirementsAndActions.length >= 4);

  // 3. Add a new Program Template
  const addedResult = addOrUpdateGiftedProgramTemplateInRecord(record, {
    title: 'ملتقى رواد الذكاء الاصطناعي والبحث العلمي',
    category: 'enrichment_initiative',
    shortDescription: 'برنامج إثرائي لتدريب الطلاب على تطبيقات الذكاء الاصطناعي.',
    objectives: 'تمكين الطلبة الموهوبين من بناء نماذج أولية ذكية ومبتكرة.',
    targetAudience: 'طلبة المرحلة الثانوية الموهوبون',
    stageLabel: 'المرحلة الثانوية',
    requirementsAndActions: [
      'إعداد المادة التدريبية وتجهيز معمل الابتكار.',
      'ترشيح الطلبة الموهوبين من السجل المركزي.',
      'تنفيذ الورش العملية وتقييم المشاريع المنجزة.',
    ],
    coordinatorInstructions: 'يوثق المنسق صور المشاريع وروابط العروض التقديمية.',
    isActive: true,
  });
  record = addedResult.record;
  const customTplId = addedResult.template.id;
  assert.ok(customTplId.startsWith('tpl-custom-'));
  assert.equal(getGiftedProgramTemplatesFromRecord(record).length, 10);

  // 4. Create an execution snapshot from the custom template BEFORE editing the template
  const execResult = createProgramExecutionFromTemplate(record, {
    templateId: customTplId,
    executionStartDate: '2026-10-15',
    selectedWeeks: ['الأسبوع الخامس', 'الأسبوع السادس', 'أسبوع غير معتمد 99'],
    notes: 'الدفعة الأولى من البرنامج',
  });
  record = execResult.record;
  assert.equal(record.programExecutions?.length, 1);
  // Free-text invalid week 'أسبوع غير معتمد 99' is automatically stripped
  assert.deepEqual(execResult.execution.selectedWeeks, [
    'الأسبوع الخامس',
    'الأسبوع السادس',
  ]);
  assert.equal(
    execResult.execution.templateTitleSnapshot,
    'ملتقى رواد الذكاء الاصطناعي والبحث العلمي'
  );
  assert.equal(execResult.execution.actionsSnapshot.length, 3);

  // 5. Edit the existing Program Template -> verify ID is immutable AND past execution snapshot is NOT retroactively changed
  const editedResult = addOrUpdateGiftedProgramTemplateInRecord(record, {
    id: customTplId,
    title: 'ملتقى رواد الذكاء الاصطناعي المتقدم (نسخة محدثة)',
    category: 'school_event',
    shortDescription: 'وصف محدث للعام القادم',
    objectives: 'أهداف محدثة وموسعة للنسخة الجديدة',
    targetAudience: 'جميع المراحل',
    stageLabel: 'جميع المراحل',
    requirementsAndActions: [
      'إجراء محدث ١',
      'إجراء محدث ٢',
      'إجراء محدث ٣',
      'إجراء محدث ٤',
    ],
    coordinatorInstructions: 'تعليمات محدثة للمنسق',
  });
  record = editedResult.record;

  // Template ID stays identical
  assert.equal(editedResult.template.id, customTplId);
  assert.equal(
    editedResult.template.title,
    'ملتقى رواد الذكاء الاصطناعي المتقدم (نسخة محدثة)'
  );
  assert.equal(editedResult.template.requirementsAndActions.length, 4);

  // Old execution snapshot remains 100% untouched (no retroactive mutation!)
  const preservedExecution = record.programExecutions![0];
  assert.equal(preservedExecution.templateId, customTplId);
  assert.equal(
    preservedExecution.templateTitleSnapshot,
    'ملتقى رواد الذكاء الاصطناعي والبحث العلمي'
  );
  assert.equal(
    preservedExecution.objectivesSnapshot,
    'تمكين الطلبة الموهوبين من بناء نماذج أولية ذكية ومبتكرة.'
  );
  assert.equal(preservedExecution.actionsSnapshot.length, 3);

  // 6. Toggle template active/inactive without deleting the template or past executions
  const toggledOff = toggleGiftedProgramTemplateActiveInRecord(
    record,
    customTplId
  );
  record = toggledOff.record;
  assert.equal(toggledOff.template?.isActive, false);
  assert.equal(getGiftedProgramTemplatesFromRecord(record).length, 10);
  assert.equal(record.programExecutions?.length, 1);

  // 7. Search and filter templates by name, category, and active status
  const allTemplatesAfterToggle = getGiftedProgramTemplatesFromRecord(record);
  const inactiveOnly = filterAndSearchGiftedProgramTemplates(
    allTemplatesAfterToggle,
    { statusFilter: 'inactive' }
  );
  assert.equal(inactiveOnly.length, 1);
  assert.equal(inactiveOnly[0].id, customTplId);

  const competitionsOnly = filterAndSearchGiftedProgramTemplates(
    allTemplatesAfterToggle,
    { categoryFilter: 'competition' }
  );
  assert.equal(competitionsOnly.length, 2);

  const searchByKeyword = filterAndSearchGiftedProgramTemplates(
    allTemplatesAfterToggle,
    { searchQuery: 'الكانجارو' }
  );
  assert.equal(searchByKeyword.length, 1);
  assert.equal(searchByKeyword[0].id, 'tpl-comp-kangaroo');

  // Re-activate template and verify sanitization roundtrip
  const toggledOn = toggleGiftedProgramTemplateActiveInRecord(
    record,
    customTplId
  );
  record = toggledOn.record;
  assert.equal(toggledOn.template?.isActive, true);

  const sanitized = sanitizeGiftedCoordinatorRecord(
    JSON.parse(JSON.stringify(record))
  );
  assert.equal(sanitized.programTemplates?.length, 10);
  assert.equal(sanitized.programExecutions?.length, 1);
});

test('Stage 1 Four Engines: Safe V4 migration creates pre-backup, verifies dry-run audit counts, and is 100% idempotent without duplicate executions', () => {
  const memStorageMap = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => memStorageMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStorageMap.set(k, v);
    },
  };

  let base = createInitialGiftedCoordinatorRecord('combined');
  base = addOrUpdateGiftedStudentInRecord(base, {
    id: 'stu-mig-1',
    name: 'سلطان بن فهد العتيبي',
    grade: 'الصف الأول الثانوي',
    classification: 'gifted',
    talentDomain: 'العلوم والبحث العلمي',
  }).record;

  base = addOrUpdateGiftedStudentParticipationInRecord(base, {
    id: 'part-mig-1',
    studentId: 'stu-mig-1',
    category: 'olympiad_research',
    linkedProgramOrCompetitionId: 'prog-olympiad-research',
    classificationResult: 'المركز الأول على مستوى الإدارة',
    qualifiedToNextStage: true,
    achievementText: 'بحث علمي محكم في الطاقة المتجددة',
  });

  base = addEvidenceLinkToTargetInRecord(base, 'prog-olympiad-research', {
    title: 'رابط التوثيق الرسمي',
    url: 'https://drive.google.com/olympiad-doc',
  });

  // 1st migration run
  const run1 = runSafeGiftedV4Migration(base, mockStorage);
  assert.equal(run1.audit.passed, true);
  assert.equal(run1.audit.preBackupCreated, true);
  assert.equal(run1.audit.dryRunVerified, true);
  assert.ok(memStorageMap.has(GIFTED_PRE_V4_BACKUP_STORAGE_KEY));

  // Verify counts before and after match 100%
  assert.equal(run1.audit.countsBefore.students, run1.audit.countsAfter.students);
  assert.equal(
    run1.audit.countsBefore.ministerialPrograms,
    run1.audit.countsAfter.ministerialPrograms
  );
  assert.equal(
    run1.audit.countsBefore.scientificCompetitions,
    run1.audit.countsAfter.scientificCompetitions
  );
  assert.equal(
    run1.audit.countsBefore.participations,
    run1.audit.countsAfter.participations
  );
  assert.equal(
    run1.audit.countsBefore.evidenceLinks,
    run1.audit.countsAfter.evidenceLinks
  );

  const execCountAfterRun1 = (run1.record.programExecutions || []).length;
  assert.equal(execCountAfterRun1, 9); // 7 ministerial + 2 competitions

  // 2nd and 3rd migration runs -> strictly idempotent (zero duplicate executions)
  const run2 = runSafeGiftedV4Migration(run1.record, mockStorage);
  const run3 = runSafeGiftedV4Migration(run2.record, mockStorage);
  assert.equal((run2.record.programExecutions || []).length, execCountAfterRun1);
  assert.equal((run3.record.programExecutions || []).length, execCountAfterRun1);
  assert.equal(run3.audit.passed, true);
});

test('Stage 1 Historical Student Snapshot: Updating student current grade in central profile preserves historical grade on past participations', () => {
  let record = createInitialGiftedCoordinatorRecord('combined');

  // Add student in 1st High School Grade
  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-hist-1',
    name: 'فيصل بن خالد الدوسري',
    grade: 'الصف الأول الثانوي',
    classification: 'gifted',
    talentDomain: 'الرياضيات والمعلوماتية',
  }).record;

  // Record participation while student is in الصف الأول الثانوي
  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    id: 'part-hist-2025',
    studentId: 'stu-hist-1',
    category: 'scientific_competition',
    competitionTitle: 'مسابقة الكانجارو للرياضيات',
    classificationResult: 'الميدالية الذهبية',
    qualifiedToNextStage: true,
    achievementText: 'تحقيق المركز الأول',
  });

  // Later promote student in central registry to الصف الثاني الثانوي and exceptional_gifted
  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-hist-1',
    name: 'فيصل بن خالد الدوسري',
    grade: 'الصف الثاني الثانوي',
    classification: 'exceptional_gifted',
    talentDomain: 'الرياضيات والمعلوماتية',
  }).record;

  const resolved = resolveStudentParticipationsWithStudentInfo(record, {
    studentId: 'stu-hist-1',
  });
  assert.equal(resolved.length, 1);

  // Current grade in central profile is الصف الثاني الثانوي
  assert.equal(resolved[0].studentGrade, 'الصف الثاني الثانوي');
  // Historical grade at participation time remains frozen at الصف الأول الثانوي
  assert.equal(resolved[0].historicalGrade, 'الصف الأول الثانوي');
  assert.equal(resolved[0].studentGradeAtParticipation, 'الصف الأول الثانوي');
  assert.equal(resolved[0].historicalClassification, 'gifted');
});

test('Stage 1 Engines Catalog, Hijri Date Conversion, Program Execution Upsert & Coordinator 6-Row Cap', () => {
  // 1. Gender-aware 4 Engines Catalog
  const maleEngines = getGiftedFourEnginesCatalog('male');
  const femaleEngines = getGiftedFourEnginesCatalog('female');
  assert.equal(maleEngines.length, 4);
  assert.equal(maleEngines[0].code, '01');
  assert.equal(maleEngines[0].title, 'الطلاب');
  assert.equal(maleEngines[2].title, 'أعمال المنسق');
  assert.equal(femaleEngines[0].title, 'الطالبات');
  assert.equal(femaleEngines[2].title, 'أعمال المنسقة');

  // 2. Gregorian to Hijri automatic conversion
  const hijri = formatGregorianToHijriDate('2025-09-15');
  assert.ok(hijri.length > 0);
  assert.ok(hijri.includes('هـ'));

  // 3. Upsert program execution with direct coordinator status & independent action completion
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('combined')
  ).record;

  const execBefore = getOrCreateExecutionForProgramTemplate(
    record,
    'tpl-prog-awareness'
  );
  const partialActions = execBefore.actionsSnapshot.map((a, idx) => ({
    ...a,
    completed: idx === 0, // only 1 of 4 actions completed (25%)
  }));

  const upserted = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed', // coordinator directly sets program status to 'executed'
    executionStartDate: '2025-10-01',
    selectedWeeks: ['الأسبوع الثالث', 'الأسبوع الرابع', 'أسبوع غير معتمد'],
    participatingStudentIds: ['stu-1'],
    actionsSnapshot: partialActions,
    resultsSummary: 'تم تنفيذ الإذاعة المدرسية واللقاء التعريفي بنجاح.',
  });
  record = upserted.record;

  assert.equal(upserted.execution.status, 'executed');
  assert.ok(upserted.execution.executionHijriDate?.includes('هـ'));
  assert.deepEqual(upserted.execution.selectedWeeks, [
    'الأسبوع الثالث',
    'الأسبوع الرابع',
  ]);
  assert.equal(
    upserted.execution.actionsSnapshot.filter((a) => a.completed).length,
    1
  );

  // 4. Coordinator Additional Works strictly capped at 6 rows
  for (let i = 1; i <= MAX_GIFTED_COORDINATOR_ADDITIONAL_WORKS; i += 1) {
    record = addOrUpdateCoordinatorAdditionalWorkInRecord(record, {
      id: `work-test-${i}`,
      workKind: i === 1 ? 'committee_meeting' : 'teacher_communication',
      meetingNumber: i === 1 ? 'الاجتماع الأول' : undefined,
      executionDate: '2025-09-20',
      weekLabel: 'الأسبوع الثاني',
      summary: `عمل إضافي رقم ${i}`,
    });
  }
  assert.equal(record.coordinatorAdditionalWorks?.length, 6);
  assert.ok(record.coordinatorAdditionalWorks?.[0].hijriDate?.includes('هـ'));

  // Attempting to add a 7th row throws a clear validation error
  assert.throws(() => {
    addOrUpdateCoordinatorAdditionalWorkInRecord(record, {
      workKind: 'other_work',
      summary: 'العمل السابع الزائد عن الحد',
    });
  }, /الحد الأقصى/);

  // Deleting a row reduces the count
  record = deleteCoordinatorAdditionalWorkFromRecord(record, 'work-test-6');
  assert.equal(record.coordinatorAdditionalWorks?.length, 5);
});

function createTestStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

function readRecordFromTestStorage(storage: ReturnType<typeof createTestStorage>) {
  const raw = storage.getItem(GIFTED_RECORD_STORAGE_KEY);
  assert.ok(raw, 'Expected GIFTED_RECORD_STORAGE_KEY in test storage');
  return sanitizeGiftedCoordinatorRecord(JSON.parse(raw));
}

test('Restore Safety Test 1: Mid-stream attachment write failure during staging leaves old record & old attachments untouched and rolls back staged keys', async () => {
  const storage = createTestStorage();
  const repo = createMemoryAttachmentRepository();

  // Seed existing active record & attachment in storage/repo
  let oldRecord = createInitialGiftedCoordinatorRecord('high', 'first');
  oldRecord.evaluation.strengths = 'مدرسة البيانات القديمة المحمية';
  oldRecord = addEvidencePhotoToTargetInRecord(oldRecord, 'tpl-prog-awareness', {
    id: 'photo-old-1',
    title: 'old.jpg',
    blobKey: 'att-old-protected-1',
  });
  saveGiftedRecordToStorage(oldRecord, storage);
  await repo.putAttachment({
    blobKey: 'att-old-protected-1',
    filename: 'old.jpg',
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([10, 20, 30, 40]),
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  // Build valid backup ZIP with 3 attachments from a clean source repo
  const backupSourceRepo = createMemoryAttachmentRepository();
  let backupRecord = createInitialGiftedCoordinatorRecord('high', 'second');
  backupRecord.evaluation.strengths = 'مدرسة النسخة الجديدة';
  for (let i = 1; i <= 3; i += 1) {
    const key = `att-new-${i}`;
    backupRecord = addEvidencePhotoToTargetInRecord(backupRecord, 'tpl-prog-awareness', {
      id: `photo-new-${i}`,
      title: `new-${i}.png`,
      blobKey: key,
    });
    await backupSourceRepo.putAttachment({
      blobKey: key,
      filename: `new-${i}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([i, i + 1, i + 2, i + 3]),
      createdAt: '2026-02-01T00:00:00.000Z',
    });
  }
  const exportedZip = await exportGiftedFullBackupZip(backupRecord, {
    attachmentRepo: backupSourceRepo,
  });

  // Wrap target repo so the 2nd putAttachment call fails during restore staging
  let putCount = 0;
  const failingRepo: GiftedAttachmentRepository = {
    ...repo,
    async putAttachment(recordItem) {
      putCount += 1;
      if (putCount === 2) {
        throw new Error('IndexedDB QuotaExceededError simulated on attachment #2');
      }
      return repo.putAttachment(recordItem);
    },
  };

  await assert.rejects(
    async () => {
      await importAndRestoreGiftedFullBackupZip(exportedZip.zipBytes, {
        attachmentRepo: failingRepo,
        storage,
        replaceExistingAttachments: true,
      });
    },
    /QuotaExceededError/
  );

  // Verify old record in localStorage is 100% untouched
  const activeAfterFail = readRecordFromTestStorage(storage);
  assert.equal(activeAfterFail.evaluation.strengths, 'مدرسة البيانات القديمة المحمية');
  assert.equal(
    activeAfterFail.evidenceBundles['tpl-prog-awareness']?.photos[0]?.blobKey,
    'att-old-protected-1'
  );

  // Verify old attachment is still intact and staged attachment #1 was rolled back
  const remainingAttachments = await repo.listAttachments();
  assert.equal(remainingAttachments.length, 1);
  assert.equal(remainingAttachments[0].blobKey, 'att-old-protected-1');
  assert.deepEqual(Array.from(remainingAttachments[0].bytes), [10, 20, 30, 40]);
});

test('Restore Safety Test 2: Failure to save record to localStorage at Commit Point rolls back staged IndexedDB generation keys and preserves old state', async () => {
  const baseStorage = createTestStorage();
  const repo = createMemoryAttachmentRepository();

  let oldRecord = createInitialGiftedCoordinatorRecord('middle', 'first');
  oldRecord.evaluation.strengths = 'مدرسة قبل فشل التخزين المحلي';
  oldRecord = registerAttachmentBlobKeyInRecord(oldRecord, 'att-existing-standalone');
  saveGiftedRecordToStorage(oldRecord, baseStorage);
  await repo.putAttachment({
    blobKey: 'att-existing-standalone',
    filename: 'doc.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([99, 98, 97]),
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  // Prepare backup ZIP
  const backupSourceRepo = createMemoryAttachmentRepository();
  let backupRecord = createInitialGiftedCoordinatorRecord('high', 'second');
  backupRecord.evaluation.strengths = 'مدرسة لن يكتمل حفظها';
  backupRecord = addEvidencePhotoToTargetInRecord(backupRecord, 'tpl-prog-awareness', {
    id: 'p-1',
    title: 'staged.png',
    blobKey: 'att-staged-1',
  });
  await backupSourceRepo.putAttachment({
    blobKey: 'att-staged-1',
    filename: 'staged.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([1, 2, 3, 4]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  const exportedZip = await exportGiftedFullBackupZip(backupRecord, {
    attachmentRepo: backupSourceRepo,
  });

  // Create storage wrapper that fails when committing GIFTED_RECORD_STORAGE_KEY
  const failingCommitStorage = {
    getItem: (k: string) => baseStorage.getItem(k),
    removeItem: (k: string) => baseStorage.removeItem(k),
    setItem: (k: string, v: string) => {
      if (k === GIFTED_RECORD_STORAGE_KEY) {
        throw new Error('Simulated localStorage QuotaExceeded at Commit Point');
      }
      baseStorage.setItem(k, v);
    },
  };

  await assert.rejects(
    async () => {
      await importAndRestoreGiftedFullBackupZip(exportedZip.zipBytes, {
        attachmentRepo: repo,
        storage: failingCommitStorage,
        replaceExistingAttachments: true,
      });
    },
    /تعذر حفظ السجل المستعاد في التخزين المحلي/
  );

  // Old record and old attachment must still be intact, and new generation keys rolled back
  const activeRecord = readRecordFromTestStorage(baseStorage);
  assert.equal(activeRecord.evaluation.strengths, 'مدرسة قبل فشل التخزين المحلي');
  const allAttachments = await repo.listAttachments();
  assert.equal(allAttachments.length, 1);
  assert.equal(allAttachments[0].blobKey, 'att-existing-standalone');
});

test('Restore Safety Test 3: Simulated app termination before Commit Point leaves old state usable and fail-safe orphan cleanup removes only aborted generations', async () => {
  const storage = createTestStorage();
  const repo = createMemoryAttachmentRepository();

  // Active record belongs to generation "gen-active-100"
  const activeGenId = 'gen-active-100';
  const activePhotoKey = buildRestoreGenBlobKey(activeGenId, 'att-photo-1');
  let activeRecord = createInitialGiftedCoordinatorRecord('high', 'first');
  activeRecord.evaluation.strengths = 'مدرسة الجيل النشط';
  activeRecord.activeRestoreGenId = activeGenId;
  activeRecord = addEvidencePhotoToTargetInRecord(activeRecord, 'tpl-prog-awareness', {
    id: 'ph-active',
    title: 'active.jpg',
    blobKey: activePhotoKey,
  });
  saveGiftedRecordToStorage(activeRecord, storage);

  await repo.putAttachment({
    blobKey: activePhotoKey,
    filename: 'active.jpg',
    mimeType: 'image/jpeg',
    bytes: new Uint8Array([7, 8, 9]),
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  // Simulate an interrupted restore ("gen-crashed-200") that wrote attachments to IndexedDB
  // before the browser tab closed prior to Commit Point
  const crashedKey1 = buildRestoreGenBlobKey('gen-crashed-200', 'att-crashed-1');
  const crashedKey2 = buildRestoreGenBlobKey('gen-crashed-200', 'att-crashed-2');
  await repo.putAttachment({
    blobKey: crashedKey1,
    filename: 'crashed1.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([1, 2]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  await repo.putAttachment({
    blobKey: crashedKey2,
    filename: 'crashed2.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([3, 4]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });

  // Sub-check A: Fail-safe guarantee — if storage is missing or unreadable, cleanup MUST NOT delete anything
  const emptyStorage = createTestStorage();
  const unsafeCleanup = await cleanupOrphanedAttachmentGenerations({
    attachmentRepo: repo,
    storage: emptyStorage,
  });
  assert.equal(unsafeCleanup.skippedReason, 'missing_active_record_in_storage');
  assert.equal(unsafeCleanup.deletedKeys.length, 0);
  assert.equal((await repo.listAttachments()).length, 3);

  const corruptedStorage = createTestStorage();
  corruptedStorage.setItem(GIFTED_RECORD_STORAGE_KEY, '{corrupted-json');
  const corruptedCleanup = await cleanupOrphanedAttachmentGenerations({
    attachmentRepo: repo,
    storage: corruptedStorage,
  });
  assert.equal(corruptedCleanup.skippedReason, 'failed_to_parse_or_verify_active_record');
  assert.equal(corruptedCleanup.deletedKeys.length, 0);
  assert.equal((await repo.listAttachments()).length, 3);

  // Sub-check B: With verified active storage, cleanup removes only the crashed generation keys
  const validCleanup = await cleanupOrphanedAttachmentGenerations({
    attachmentRepo: repo,
    storage,
  });
  assert.equal(validCleanup.skippedReason, undefined);
  assert.equal(validCleanup.deletedKeys.length, 2);
  assert.ok(validCleanup.deletedKeys.includes(crashedKey1));
  assert.ok(validCleanup.deletedKeys.includes(crashedKey2));

  const remaining = await repo.listAttachments();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].blobKey, activePhotoKey);
});

test('Restore Safety Test 4: Successful switch keeps old record & old attachments untouched right up to Commit Point and remaps all blobKey references', async () => {
  const baseStorage = createTestStorage();
  const repo = createMemoryAttachmentRepository();

  let oldRecord = createInitialGiftedCoordinatorRecord('high', 'first');
  oldRecord.evaluation.strengths = 'مدرسة النسخة السابقة';
  oldRecord = addEvidencePhotoToTargetInRecord(oldRecord, 'tpl-prog-awareness', {
    id: 'ph-old',
    title: 'old.png',
    blobKey: 'att-old-key',
  });
  saveGiftedRecordToStorage(oldRecord, baseStorage);
  await repo.putAttachment({
    blobKey: 'att-old-key',
    filename: 'old.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([11, 22, 33]),
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  // Create backup with both an evidence photo blobKey and a standalone activeAttachmentBlobKeys entry
  const backupSourceRepo = createMemoryAttachmentRepository();
  let backupRecord = createInitialGiftedCoordinatorRecord('high', 'second');
  backupRecord.evaluation.strengths = 'مدرسة النسخة المستعادة';
  backupRecord = addEvidencePhotoToTargetInRecord(backupRecord, 'tpl-prog-awareness', {
    id: 'ph-new',
    title: 'new-evidence.png',
    blobKey: 'att-new-evidence',
  });
  backupRecord = registerAttachmentBlobKeyInRecord(backupRecord, 'att-new-standalone');
  await backupSourceRepo.putAttachment({
    blobKey: 'att-new-evidence',
    filename: 'new-evidence.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([1, 2, 3, 4]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  await backupSourceRepo.putAttachment({
    blobKey: 'att-new-standalone',
    filename: 'standalone.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([5, 6, 7, 8]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  const exportedZip = await exportGiftedFullBackupZip(backupRecord, {
    attachmentRepo: backupSourceRepo,
  });

  // Intercept at exact moment of Commit Point (storage.setItem for GIFTED_RECORD_STORAGE_KEY)
  let oldAttachmentExistedAtCommitPoint = false;
  let newAttachmentsVerifiedAtCommitPoint = false;
  let oldRecordExistedBeforeCommitSet = false;

  const observingStorage = {
    getItem: (k: string) => baseStorage.getItem(k),
    removeItem: (k: string) => baseStorage.removeItem(k),
    setItem: (k: string, v: string) => {
      if (k === GIFTED_RECORD_STORAGE_KEY) {
        const currentBeforeWrite = readRecordFromTestStorage(baseStorage);
        oldRecordExistedBeforeCommitSet =
          currentBeforeWrite.evaluation.strengths === 'مدرسة النسخة السابقة';
      }
      baseStorage.setItem(k, v);
    },
  };

  // Also observe repo deletions to verify deleteAttachment is NEVER called before Commit Point
  let deleteCalledBeforeCommit = false;
  let committedToStorage = false;
  const observingRepo: GiftedAttachmentRepository = {
    ...repo,
    async deleteAttachment(key: string) {
      if (!committedToStorage && oldRecordExistedBeforeCommitSet === false) {
        deleteCalledBeforeCommit = true;
      }
      return repo.deleteAttachment(key);
    },
    async getAttachment(key: string) {
      const res = await repo.getAttachment(key);
      if (key.startsWith('rgen:')) {
        newAttachmentsVerifiedAtCommitPoint = true;
        const oldCheck = await repo.getAttachment('att-old-key');
        if (oldCheck && oldCheck.bytes.length === 3) {
          oldAttachmentExistedAtCommitPoint = true;
        }
      }
      return res;
    },
  };

  const restoreResult = await importAndRestoreGiftedFullBackupZip(exportedZip.zipBytes, {
    attachmentRepo: observingRepo,
    storage: observingStorage,
    replaceExistingAttachments: true,
  });
  committedToStorage = true;

  assert.equal(deleteCalledBeforeCommit, false);
  assert.equal(oldRecordExistedBeforeCommitSet, true);
  assert.equal(oldAttachmentExistedAtCommitPoint, true);
  assert.equal(newAttachmentsVerifiedAtCommitPoint, true);

  // Check remapped blobKeys in restoredRecord
  const genId = restoreResult.restoreGenId;
  assert.ok(genId && genId.length > 0);
  const remappedPhotoKey =
    restoreResult.record.evidenceBundles['tpl-prog-awareness']?.photos[0]?.blobKey;
  assert.equal(remappedPhotoKey, buildRestoreGenBlobKey(genId, 'att-new-evidence'));
  assert.ok(
    restoreResult.record.activeAttachmentBlobKeys?.includes(
      buildRestoreGenBlobKey(genId, 'att-new-standalone')
    )
  );
});

test('Restore Safety Test 5: Post-commit cleanup respects replaceExistingAttachments=false and cleanup errors never invalidate a committed restore', async () => {
  const storage = createTestStorage();
  const repo = createMemoryAttachmentRepository();

  // Seed legacy attachment
  await repo.putAttachment({
    blobKey: 'att-legacy-keep',
    filename: 'keep.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([4, 5, 6]),
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  const backupSourceRepo = createMemoryAttachmentRepository();
  let backupRecord = createInitialGiftedCoordinatorRecord('high', 'second');
  backupRecord.evaluation.strengths = 'مدرسة مع الإبقاء على المرفقات القديمة';
  backupRecord = addEvidencePhotoToTargetInRecord(backupRecord, 'tpl-prog-awareness', {
    id: 'ph-1',
    title: 'restored.png',
    blobKey: 'att-restored-1',
  });
  await backupSourceRepo.putAttachment({
    blobKey: 'att-restored-1',
    filename: 'restored.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([9, 8, 7, 6]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  const exportedZip = await exportGiftedFullBackupZip(backupRecord, {
    attachmentRepo: backupSourceRepo,
  });

  // Case A: replaceExistingAttachments = false -> old attachment MUST NOT be deleted
  const resKeep = await importAndRestoreGiftedFullBackupZip(exportedZip.zipBytes, {
    attachmentRepo: repo,
    storage,
    replaceExistingAttachments: false,
  });
  assert.equal(resKeep.restoredAttachmentsCount, 1);
  const keysAfterKeep = (await repo.listAttachments()).map((a) => a.blobKey);
  assert.ok(keysAfterKeep.includes('att-legacy-keep'));
  assert.equal(keysAfterKeep.length, 2);

  // Case B: replaceExistingAttachments = true, even if deleteAttachment throws during post-commit cleanup, restore still succeeds!
  const repoWithFailingDelete: GiftedAttachmentRepository = {
    ...repo,
    async deleteAttachment() {
      throw new Error('Simulated IndexedDB delete failure during post-commit cleanup');
    },
  };

  const resWithDeleteError = await importAndRestoreGiftedFullBackupZip(exportedZip.zipBytes, {
    attachmentRepo: repoWithFailingDelete,
    storage,
    replaceExistingAttachments: true,
  });
  assert.equal(resWithDeleteError.restoredAttachmentsCount, 1);
  assert.equal(
    readRecordFromTestStorage(storage).evaluation.strengths,
    'مدرسة مع الإبقاء على المرفقات القديمة'
  );
});

test('Restore Safety Test 6: Exporting ZIP after restore includes all active generation attachments ONLY and excludes uncleaned legacy/orphan attachments', async () => {
  const storage = createTestStorage();
  const repo = createMemoryAttachmentRepository();

  // Seed an unreferenced orphan attachment and a previous generation attachment in repo
  await repo.putAttachment({
    blobKey: 'att-uncleaned-legacy',
    filename: 'legacy.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([91, 92, 93]),
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  await repo.putAttachment({
    blobKey: buildRestoreGenBlobKey('old-gen-999', 'att-old-gen'),
    filename: 'oldgen.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([81, 82, 83]),
    createdAt: '2026-01-02T00:00:00.000Z',
  });

  // Build a backup with 2 active attachments (1 evidence photo + 1 standalone)
  const sourceRepo = createMemoryAttachmentRepository();
  let sourceRecord = createInitialGiftedCoordinatorRecord('high', 'second');
  sourceRecord.evaluation.strengths = 'مدرسة اختبار التصدير بعد الاستعادة';
  sourceRecord = addEvidencePhotoToTargetInRecord(sourceRecord, 'tpl-prog-awareness', {
    id: 'ph-active-exp',
    title: 'active-photo.png',
    blobKey: 'att-active-photo',
  });
  sourceRecord = registerAttachmentBlobKeyInRecord(sourceRecord, 'att-active-standalone');
  await sourceRepo.putAttachment({
    blobKey: 'att-active-photo',
    filename: 'active-photo.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([1, 2, 3, 4]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  await sourceRepo.putAttachment({
    blobKey: 'att-active-standalone',
    filename: 'active-standalone.pdf',
    mimeType: 'application/pdf',
    bytes: new Uint8Array([5, 6, 7, 8]),
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  const firstZip = await exportGiftedFullBackupZip(sourceRecord, {
    attachmentRepo: sourceRepo,
  });

  // Restore with replaceExistingAttachments: false so the 2 legacy/orphan attachments remain in IndexedDB
  const restoreRes = await importAndRestoreGiftedFullBackupZip(firstZip.zipBytes, {
    attachmentRepo: repo,
    storage,
    replaceExistingAttachments: false,
  });

  // Total attachments in IndexedDB is now 4 (2 legacy/orphan + 2 active generation)
  assert.equal((await repo.listAttachments()).length, 4);

  // Export a new ZIP from the restored record and repo
  const secondZip = await exportGiftedFullBackupZip(restoreRes.record, {
    attachmentRepo: repo,
  });

  // The exported ZIP must include ONLY the 2 active generation attachments!
  assert.equal(secondZip.manifest.attachmentsCount, 2);
  const exportedBaseKeys = secondZip.manifest.attachments
    .map((a) => stripRestoreGenPrefix(a.blobKey))
    .sort();
  assert.deepEqual(exportedBaseKeys, ['att-active-photo', 'att-active-standalone']);
});

// ============================================================================
// اختبارات المرحلة الثانية (Stage 2 Reports Engine — 15 Unit Tests)
// ============================================================================

function createStage2SampleSettings(
  gender: 'male' | 'female' = 'male'
): SchoolSettings {
  const coordinatorName =
    gender === 'female' ? 'أ. نورة بنت سعد' : 'أ. سلطان بن محمد العتيبي';
  return {
    educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
    schoolName: 'ثانوية الرواد للموهوبين',
    userName: coordinatorName,
    principalName: 'أ. فهد بن عبدالله السالم',
    academicYear: '1447-1448 هـ',
    gender,
    roles: {
      professionalDevelopment: 'رائد التطوير المهني',
      gifted: coordinatorName,
      teacher: 'معلم',
    },
  };
}

test('Stage 2 Test 1: Program report builds directly from actual student, program, execution, and evidence data', async () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  // Add student in Engine 01
  const s1 = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-s2-1',
    name: 'عبدالرحمن بن خالد القحطاني',
    grade: 'الصف الأول الثانوي',
    talentDomain: 'الذكاء الاصطناعي والبرمجة',
    classification: 'exceptional_gifted',
  });
  record = s1.record;

  // Execute program in Engine 02 (National Identification has 7 standard actions)
  const execPre = getOrCreateExecutionForProgramTemplate(
    record,
    'tpl-prog-national-identification'
  );
  const updatedActions = execPre.actionsSnapshot.map((a, idx) => ({
    ...a,
    completed: idx < 4, // 4 of 7 completed
  }));

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-national-identification',
    status: 'executed',
    executionStartDate: '2026-09-15',
    selectedWeeks: ['الأسبوع الثالث', 'الأسبوع الرابع'],
    participatingStudentIds: ['stu-s2-1'],
    actionsSnapshot: updatedActions,
    resultsSummary: 'نشر ثقافة الموهبة وتوعية 120 طالباً ومعلميهن.',
    challenges: 'ضيق وقت الحصة الإثرائية الأولى.',
    recommendations: 'تخصيص إذاعة صباحية أسبوعية للموهوبين.',
    notes: 'تم توثيق اللقاء في قاعة مصادر التعلم.',
  }).record;

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    studentId: 'stu-s2-1',
    category: 'national_identification',
    linkedProgramOrCompetitionId: 'prog-national-identification',
    studentGradeAtParticipation: 'الصف الثالث المتوسط',
    classificationResult: 'مشارك متميز',
    achievementText: 'تقديم عرض تعريفي عن برامج موهبة',
    qualifiedToNextStage: true,
  });

  const model = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-national-identification'
  );

  assert.equal(model.reportType, 'unified_program_report');
  assert.ok(model.programTitle.includes('البرنامج الوطني للكشف عن الموهوبين'));
  assert.equal(model.executionStatus, 'executed');
  assert.equal(model.executionStatusLabel, 'نفذ');
  assert.equal(model.completedActionsCount, 4);
  assert.equal(model.totalActionsCount, 7);
  assert.equal(model.actionCompletionPercentage, Math.round((4 / 7) * 100));
  assert.ok(model.executionDate.includes('2026-09-15'));
  assert.equal(model.weekLabel, 'الأسبوع الثالث، الأسبوع الرابع');
  assert.equal(model.participatingStudentsCount, 1);
  assert.equal(
    model.participatingStudents[0].studentName,
    'عبدالرحمن بن خالد القحطاني'
  );
  // Historical grade preserved and normalized to unified middle school format!
  assert.equal(
    model.participatingStudents[0].historicalGrade,
    'الثالث المتوسط'
  );
  assert.equal(
    model.results,
    'نشر ثقافة الموهبة وتوعية 120 طالباً ومعلميهن.'
  );
  assert.ok(
    model.achievementsOrOutputs.includes('تقديم عرض تعريفي عن برامج موهبة')
  );
  assert.equal(model.challenges, 'ضيق وقت الحصة الإثرائية الأولى.');
  assert.equal(
    model.recommendations,
    'تخصيص إذاعة صباحية أسبوعية للموهوبين.'
  );
  assert.equal(model.notes, 'تم توثيق اللقاء في قاعة مصادر التعلم.');

  const pdfBytes = await generateGiftedUnifiedProgramReportPdf(model);
  assert.ok(pdfBytes.length > 100);
});

test('Stage 2 Test 2: Periodic report aggregates accurately across multiple programs and filters by weeks or date range', async () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-p1',
    name: 'فيصل بن تركي',
    grade: 'الصف الثاني الثانوي',
    talentDomain: 'العلوم والبحث العلمي',
    classification: 'gifted',
  }).record;
  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-p2',
    name: 'سلمان بن فهد',
    grade: 'الصف الثالث الثانوي',
    talentDomain: 'الرياضيات والمعلوماتية',
    classification: 'exceptional_gifted',
  }).record;

  // Program 1: executed in Week 2
  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed',
    executionStartDate: '2026-09-10',
    selectedWeeks: ['الأسبوع الثاني'],
    participatingStudentIds: ['stu-p1'],
    resultsSummary: 'نتيجة البرنامج الأول',
  }).record;

  // Program 2: pending in Week 5
  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-national-identification',
    status: 'pending',
    executionStartDate: '2026-10-05',
    selectedWeeks: ['الأسبوع الخامس'],
    participatingStudentIds: ['stu-p1', 'stu-p2'],
  }).record;

  // Program 3: not_executed in Week 2
  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-gulf-week',
    status: 'not_executed',
    nonExecutionReason: 'تأجيل الموعد الوزاري',
    selectedWeeks: ['الأسبوع الثاني'],
  }).record;

  // Add Coordinator Work in Week 2
  record = addOrUpdateCoordinatorAdditionalWorkInRecord(record, {
    workKind: 'committee_meeting',
    meetingNumber: '1',
    executionDate: '2026-09-11',
    weekLabel: 'الأسبوع الثاني',
    summary: 'اجتماع لجنة الموهوبين الأول',
  });

  // Periodic Report filtered to Week 2 ONLY
  const week2Report = buildGiftedPeriodicReportModel(record, settings, {
    filterMode: 'weeks',
    selectedWeeks: ['الأسبوع الثاني'],
  });

  assert.equal(week2Report.totalProgramsCount, 2);
  assert.equal(week2Report.executedProgramsCount, 1);
  assert.equal(week2Report.pendingProgramsCount, 0);
  assert.equal(week2Report.notExecutedProgramsCount, 1);
  assert.equal(week2Report.programCompletionPercentage, 50);
  assert.equal(week2Report.beneficiaryStudentsCount, 1);
  assert.equal(week2Report.coordinatorWorksCount, 1);
  assert.ok(week2Report.topResultsText.includes('نتيجة البرنامج الأول'));
  assert.ok(week2Report.topChallengesText.includes('تأجيل الموعد الوزاري'));

  const pdfBytes = await generateGiftedPeriodicReportPdf(week2Report);
  assert.ok(pdfBytes.length > 100);
});

test('Stage 2 Test 3: Final report builds complete model with cover page metadata and all sections from full record', async () => {
  const settings = createStage2SampleSettings('female');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-f1',
    name: 'سارة بنت عبدالله',
    grade: 'الصف الأول الثانوي',
    talentDomain: 'الهندسة والابتكار التقني',
    classification: 'exceptional_gifted',
  }).record;

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    studentId: 'stu-f1',
    category: 'olympiad_research',
    linkedProgramOrCompetitionId: 'prog-olympiad-research',
    qualifiedToNextStage: true,
    achievementText: 'تأهل البحث العلمي للمعرض المركزي',
  });

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-olympiad-research',
    status: 'executed',
    executionStartDate: '2026-10-12',
    selectedWeeks: ['الأسبوع السادس'],
    participatingStudentIds: ['stu-f1'],
    resultsSummary: 'تحكيم 8 أبحاث علمية للطالبات.',
    recommendations: 'توسيع الشراكة مع الجامعات.',
  }).record;

  record = addOrUpdateCoordinatorAdditionalWorkInRecord(record, {
    workKind: 'parent_communication',
    executionDate: '2026-10-14',
    weekLabel: 'الأسبوع السادس',
    summary: 'التواصل مع أولياء أمور الطالبات المتأهلات في إبداع.',
  });

  const finalModel = buildGiftedComprehensiveFinalReportModel(record, settings);

  // Verify Cover Page fields
  assert.equal(
    finalModel.coverPage.ministryHeader,
    'المملكة العربية السعودية — وزارة التعليم'
  );
  assert.equal(
    finalModel.coverPage.educationDepartment,
    'الإدارة العامة للتعليم بمنطقة الرياض'
  );
  assert.equal(finalModel.coverPage.schoolName, 'ثانوية الرواد للموهوبين');
  assert.equal(finalModel.coverPage.recordTitle, 'سجل منسقة الموهوبات');
  assert.equal(finalModel.coverPage.academicYear, '1447-1448 هـ');
  assert.equal(finalModel.coverPage.coordinatorName, 'أ. نورة بنت سعد');
  assert.equal(finalModel.coverPage.coordinatorTitle, 'منسقة الموهوبين');

  // Verify Body Sections
  assert.equal(finalModel.studentStats.totalStudents, 1);
  assert.equal(finalModel.studentStats.exceptionalGiftedCount, 1);
  assert.equal(finalModel.participationsAndAchievements.totalParticipations, 1);
  assert.equal(
    finalModel.participationsAndAchievements.qualifiedStudentsCount,
    1
  );
  assert.ok(
    finalModel.participationsAndAchievements.achievementsText.includes(
      'تأهل البحث العلمي للمعرض المركزي'
    )
  );
  assert.equal(finalModel.coordinatorWorks.length, 1);
  assert.ok(finalModel.keyResultsText.includes('تحكيم 8 أبحاث علمية للطالبات.'));
  assert.ok(
    finalModel.recommendationsText.includes('توسيع الشراكة مع الجامعات.')
  );

  const pdfBytes = await generateGiftedComprehensiveFinalReportPdf(finalModel);
  assert.ok(pdfBytes.length > 100);
});

test('Stage 2 Test 4: Statistical report builds accurate distributions by status, category, week, and classification', async () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-stat-1',
    name: 'طالب استثنائي',
    grade: 'الصف الأول الثانوي',
    talentDomain: 'العلوم والبحث العلمي',
    classification: 'exceptional_gifted',
  }).record;
  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-stat-2',
    name: 'طالب واعد',
    grade: 'الصف الثاني الثانوي',
    talentDomain: 'الرياضيات والمعلوماتية',
    classification: 'promising',
  }).record;

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed',
    selectedWeeks: ['الأسبوع الأول'],
    participatingStudentIds: ['stu-stat-1'],
  }).record;

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-comp-kangaroo',
    status: 'not_executed',
    nonExecutionReason: 'لم يبدأ التسجيل',
    selectedWeeks: ['الأسبوع الثالث'],
  }).record;

  const statModel = buildGiftedStatisticalReportModel(record, settings);

  assert.equal(statModel.totalStudents, 2);
  assert.equal(statModel.uniqueBeneficiaryStudentsCount, 1);
  assert.ok(statModel.totalPrograms > 0);
  assert.equal(statModel.executedProgramsCount, 1);
  assert.equal(statModel.notExecutedProgramsCount, 1);
  assert.equal(
    statModel.executedProgramsCount +
      statModel.pendingProgramsCount +
      statModel.notExecutedProgramsCount,
    statModel.totalPrograms
  );
  assert.equal(statModel.distributionByStatus.length, 3);
  assert.ok(statModel.distributionByCategory.length >= 2);
  assert.equal(statModel.distributionByWeek.length, 2);

  const pdfBytes = await generateGiftedStatisticalReportPdf(statModel);
  assert.ok(pdfBytes.length > 100);
});

test('Stage 2 Test 5: Never invents fake data when fields are missing — returns "غير مسجل"', () => {
  const settings = createStage2SampleSettings('male');
  const freshRecord = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  const progReport = buildGiftedUnifiedProgramReportModel(
    freshRecord,
    settings,
    'tpl-prog-awareness'
  );
  assert.equal(progReport.executionDate, GIFTED_UNRECORDED_LABEL);
  assert.equal(progReport.weekLabel, GIFTED_UNRECORDED_LABEL);
  assert.equal(progReport.results, GIFTED_UNRECORDED_LABEL);
  assert.equal(progReport.achievementsOrOutputs, GIFTED_UNRECORDED_LABEL);
  assert.equal(progReport.notes, GIFTED_UNRECORDED_LABEL);
  assert.equal(progReport.challenges, GIFTED_UNRECORDED_LABEL);
  assert.equal(progReport.recommendations, GIFTED_UNRECORDED_LABEL);

  const periodicReport = buildGiftedPeriodicReportModel(freshRecord, settings);
  assert.equal(periodicReport.coordinatorWorksText, GIFTED_UNRECORDED_LABEL);
  assert.equal(periodicReport.topResultsText, GIFTED_UNRECORDED_LABEL);
  assert.equal(periodicReport.topChallengesText, GIFTED_UNRECORDED_LABEL);
  assert.equal(periodicReport.recommendationsText, GIFTED_UNRECORDED_LABEL);

  const finalReport = buildGiftedComprehensiveFinalReportModel(
    freshRecord,
    settings
  );
  assert.equal(
    finalReport.participationsAndAchievements.achievementsText,
    GIFTED_UNRECORDED_LABEL
  );
  assert.equal(finalReport.coordinatorWorksText, GIFTED_UNRECORDED_LABEL);
  assert.equal(finalReport.keyResultsText, GIFTED_UNRECORDED_LABEL);
  assert.equal(finalReport.challengesText, GIFTED_UNRECORDED_LABEL);
  assert.equal(finalReport.recommendationsText, GIFTED_UNRECORDED_LABEL);
  assert.equal(finalReport.supportingEntitiesText, GIFTED_UNRECORDED_LABEL);
});

test('Stage 2 Test 6: Accuracy of indicator calculations across Periodic, Final, and Statistical reports', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  // Keep only 4 active templates so exact percentages are crystal-clear
  const allTemplates = getGiftedProgramTemplatesFromRecord(record);
  for (let i = 4; i < allTemplates.length; i++) {
    record = toggleGiftedProgramTemplateActiveInRecord(
      record,
      allTemplates[i].id,
      false
    ).record;
  }

  const activeFour = getGiftedProgramTemplatesFromRecord(record).filter(
    (t) => t.isActive
  );
  assert.equal(activeFour.length, 4);

  // Set 2 executed, 1 pending, 1 not_executed -> Program completion = 2/4 = 50%
  record = upsertProgramExecutionInRecord(record, {
    templateId: activeFour[0].id,
    status: 'executed',
  }).record;
  record = upsertProgramExecutionInRecord(record, {
    templateId: activeFour[1].id,
    status: 'executed',
  }).record;
  record = upsertProgramExecutionInRecord(record, {
    templateId: activeFour[2].id,
    status: 'pending',
  }).record;
  record = upsertProgramExecutionInRecord(record, {
    templateId: activeFour[3].id,
    status: 'not_executed',
    nonExecutionReason: 'سبب اختباري',
  }).record;

  const periodic = buildGiftedPeriodicReportModel(record, settings);
  const finalRep = buildGiftedComprehensiveFinalReportModel(record, settings);
  const statRep = buildGiftedStatisticalReportModel(record, settings);

  assert.equal(periodic.totalProgramsCount, 4);
  assert.equal(periodic.executedProgramsCount, 2);
  assert.equal(periodic.pendingProgramsCount, 1);
  assert.equal(periodic.notExecutedProgramsCount, 1);
  assert.equal(periodic.programCompletionPercentage, 50);

  assert.equal(finalRep.programStats.totalActivePrograms, 4);
  assert.equal(finalRep.programStats.programCompletionPercentage, 50);
  assert.equal(statRep.programCompletionPercentage, 50);
});

test('Stage 2 Test 7: Separates coordinator-selected program status from calculated action completion percentage', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  const exec = getOrCreateExecutionForProgramTemplate(
    record,
    'tpl-prog-national-identification'
  );
  // Complete only 2 out of 7 actions (29%), while coordinator marks status as 'executed'
  const partialActions = exec.actionsSnapshot.map((act, idx) => ({
    ...act,
    completed: idx < 2,
  }));

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-national-identification',
    status: 'executed',
    actionsSnapshot: partialActions,
  }).record;

  const progModel = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-national-identification'
  );

  // Coordinator status is 'executed' ('نفذ'), while action completion is 29% (2/7)
  assert.equal(progModel.executionStatus, 'executed');
  assert.equal(progModel.executionStatusLabel, 'نفذ');
  assert.equal(progModel.completedActionsCount, 2);
  assert.equal(progModel.totalActionsCount, 7);
  assert.equal(progModel.actionCompletionPercentage, 29);
});

test('Stage 2 Test 8: Participating students count deduplicates students across execution list and participation records', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-dup-1',
    name: 'طالب مشارك واحد',
    grade: 'الصف الأول الثانوي',
    talentDomain: 'العلوم والبحث العلمي',
    classification: 'gifted',
  }).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-dup-2',
    name: 'طالب مشارك ثان',
    grade: 'الصف الثاني الثانوي',
    talentDomain: 'الرياضيات والمعلوماتية',
    classification: 'exceptional_gifted',
  }).record;

  // Link stu-dup-1 in both participatingStudentIds AND studentParticipations
  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed',
    participatingStudentIds: ['stu-dup-1', 'stu-dup-1'],
  }).record;

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    studentId: 'stu-dup-1',
    category: 'national_identification',
    linkedProgramOrCompetitionId: 'prog-awareness',
  });
  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    studentId: 'stu-dup-2',
    category: 'national_identification',
    linkedProgramOrCompetitionId: 'prog-awareness',
  });

  const progModel = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-awareness'
  );
  assert.equal(progModel.participatingStudentsCount, 2);
  assert.equal(progModel.participatingStudents.length, 2);

  const periodicModel = buildGiftedPeriodicReportModel(record, settings);
  assert.equal(periodicModel.beneficiaryStudentsCount, 2);
});

test('Stage 2 Test 9: Includes valid selected evidences (photos & QR links) when enabled and respects selection toggles', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
    id: 'ph-valid-1',
    blobKey: 'blob-valid-1',
    title: 'صورة تنفيذ اللقاء التعريفي',
    selectedForProgramReport: true,
    selectedForFinalRecord: true,
  });
  record = addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
    id: 'ph-unselected-2',
    blobKey: 'blob-unselected-2',
    title: 'صورة غير مختارة للتقرير',
    selectedForProgramReport: false,
    selectedForFinalRecord: false,
  });
  record = addEvidenceLinkToTargetInRecord(record, 'prog-awareness', {
    id: 'lnk-valid-1',
    title: 'رابط مجلد الشواهد',
    url: 'https://drive.google.com/example-awareness',
    selectedForProgramReport: true,
    selectedForFinalRecord: true,
  });

  const progModel = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-awareness'
  );
  assert.equal(progModel.showEvidences, true);
  assert.equal(progModel.selectedPhotos.length, 1);
  assert.equal(progModel.selectedPhotos[0].blobKey, 'blob-valid-1');
  assert.equal(progModel.selectedLinks.length, 1);
  assert.equal(
    progModel.selectedLinks[0].url,
    'https://drive.google.com/example-awareness'
  );
});

test('Stage 2 Test 10: Excludes orphan attachments that are in IndexedDB but not referenced in active record', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
    id: 'ph-active-1',
    blobKey: 'blob-referenced-active',
    title: 'صورة مرتبطة بالسجل',
    selectedForProgramReport: true,
  });

  const allRepoAttachments: GiftedAttachmentRecord[] = [
    {
      blobKey: 'blob-referenced-active',
      filename: 'active.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([1, 2, 3, 4]),
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      blobKey: 'blob-orphan-unreferenced',
      filename: 'orphan.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([9, 9, 9]),
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  // Even if someone passes an orphan photo ref not in record, or if repo has orphan blobs, only referenced active photo is included
  const filtered = filterValidActiveGenerationPhotosForReport(
    record,
    [
      ...(record.evidenceBundles['prog-awareness']?.photos || []),
      {
        id: 'ph-orphan',
        blobKey: 'blob-orphan-unreferenced',
        title: 'صورة يتيمة غير مسجلة',
        selectedForProgramReport: true,
        selectedForFinalRecord: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    { availableAttachments: allRepoAttachments, selectionMode: 'program' }
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].blobKey, 'blob-referenced-active');

  const progModel = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-awareness',
    { availableAttachments: allRepoAttachments }
  );
  assert.equal(progModel.selectedPhotos.length, 1);
  assert.equal(progModel.selectedPhotos[0].blobKey, 'blob-referenced-active');
});

test('Stage 2 Test 11: Uses active generation attachments ONLY (activeRestoreGenId) and excludes stale generations', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  const activeGen = 'rgen-active-777';
  const staleGen = 'rgen-stale-111';
  const activeKey = buildRestoreGenBlobKey(activeGen, 'img-1');
  const staleKey = buildRestoreGenBlobKey(staleGen, 'img-2');

  record.activeRestoreGenId = activeGen;
  record.activeAttachmentBlobKeys = [activeKey];
  record.evidenceBundles['prog-awareness'] = {
    targetId: 'prog-awareness',
    showEvidencesInReport: true,
    photos: [
      {
        id: 'p-active',
        blobKey: activeKey,
        title: 'شاهد الجيل النشط',
        selectedForProgramReport: true,
        selectedForFinalRecord: true,
        createdAt: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'p-stale',
        blobKey: staleKey,
        title: 'شاهد جيل قديم يتيم',
        selectedForProgramReport: true,
        selectedForFinalRecord: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    links: [],
  };

  const repoAttachments: GiftedAttachmentRecord[] = [
    {
      blobKey: activeKey,
      filename: 'active.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([10, 20, 30]),
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      blobKey: staleKey,
      filename: 'stale.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([40, 50, 60]),
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const progModel = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-awareness',
    { availableAttachments: repoAttachments }
  );
  assert.equal(progModel.selectedPhotos.length, 1);
  assert.equal(progModel.selectedPhotos[0].blobKey, activeKey);

  const finalModel = buildGiftedComprehensiveFinalReportModel(
    record,
    settings,
    { availableAttachments: repoAttachments }
  );
  assert.equal(finalModel.selectedEvidenceGroups.length, 1);
  assert.equal(finalModel.selectedEvidenceGroups[0].photos.length, 1);
  assert.equal(
    finalModel.selectedEvidenceGroups[0].photos[0].blobKey,
    activeKey
  );
});

test('Stage 2 Test 12: Reports persist accurately after saving to storage and reloading', () => {
  const storage = createTestStorage();
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-persist-1',
    name: 'خالد بن وليد الدوسري',
    grade: 'الصف الثالث الثانوي',
    talentDomain: 'الفيزياء والعلوم التطبيقية',
    classification: 'exceptional_gifted',
  }).record;

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed',
    executionStartDate: '2026-09-22',
    selectedWeeks: ['الأسبوع الرابع'],
    participatingStudentIds: ['stu-persist-1'],
    resultsSummary: 'نتائج محفوظة بعد إعادة التحميل',
    recommendations: 'توصيات محفوظة بعد إعادة التحميل',
  }).record;

  saveGiftedRecordToStorage(record, storage);

  // Simulate full app reload from localStorage
  const reloadedRecord = loadGiftedRecordFromStorage(storage);

  const progAfterReload = buildGiftedUnifiedProgramReportModel(
    reloadedRecord,
    settings,
    'tpl-prog-awareness'
  );
  assert.equal(progAfterReload.executionStatus, 'executed');
  assert.equal(progAfterReload.results, 'نتائج محفوظة بعد إعادة التحميل');
  assert.equal(
    progAfterReload.recommendations,
    'توصيات محفوظة بعد إعادة التحميل'
  );
  assert.equal(progAfterReload.participatingStudentsCount, 1);
  assert.equal(
    progAfterReload.participatingStudents[0].studentName,
    'خالد بن وليد الدوسري'
  );
});

test('Stage 2 Test 13: Generating all 5 report models does not mutate or break any data in Engines 01, 02, or 03', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-immut-1',
    name: 'ماجد بن عبدالعزيز',
    grade: 'الصف الأول الثانوي',
    talentDomain: 'الذكاء الاصطناعي والبرمجة',
    classification: 'gifted',
  }).record;

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed',
    executionStartDate: '2026-09-18',
    selectedWeeks: ['الأسبوع الثالث'],
    participatingStudentIds: ['stu-immut-1'],
    resultsSummary: 'نتيجة ثابتة',
  }).record;

  record = addOrUpdateCoordinatorAdditionalWorkInRecord(record, {
    workKind: 'teacher_communication',
    executionDate: '2026-09-19',
    weekLabel: 'الأسبوع الثالث',
    summary: 'تنسيق مع معلمي العلوم والرياضيات',
  });

  const snapshotBefore = JSON.stringify(record);

  // Generate all reports
  buildGiftedUnifiedProgramReportModel(record, settings, 'tpl-prog-awareness');
  buildGiftedPeriodicReportModel(record, settings, { filterMode: 'all' });
  buildGiftedComprehensiveFinalReportModel(record, settings);
  buildGiftedStatisticalReportModel(record, settings);
  buildGiftedInnovationSpaceProgressReportModel(record, settings);

  const snapshotAfter = JSON.stringify(record);
  assert.equal(snapshotAfter, snapshotBefore);
});

test('Stage 2 Test 14: ZIP Backup & Restore remains 100% intact and restores all data feeding the Stage 2 reports', async () => {
  const storage = createTestStorage();
  const sourceRepo = createMemoryAttachmentRepository();
  const targetRepo = createMemoryAttachmentRepository();
  const settings = createStage2SampleSettings('male');

  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-zip-s2',
    name: 'نواف بن بندر الشهري',
    grade: 'الصف الثاني الثانوي',
    talentDomain: 'الهندسة والابتكار التقني',
    classification: 'exceptional_gifted',
  }).record;

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-awareness',
    status: 'executed',
    executionStartDate: '2026-10-01',
    selectedWeeks: ['الأسبوع الخامس'],
    participatingStudentIds: ['stu-zip-s2'],
    resultsSummary: 'نتائج برنامج مستعادة من ZIP',
  }).record;

  record = addEvidencePhotoToTargetInRecord(record, 'prog-awareness', {
    id: 'ph-zip-s2',
    blobKey: 'att-zip-s2-photo',
    title: 'صورة شاهد مستعادة للتقرير',
    selectedForProgramReport: true,
    selectedForFinalRecord: true,
  });

  await sourceRepo.putAttachment({
    blobKey: 'att-zip-s2-photo',
    filename: 'evidence.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    createdAt: '2026-10-01T00:00:00.000Z',
  });

  const zipExport = await exportGiftedFullBackupZip(record, {
    attachmentRepo: sourceRepo,
    settings,
  });

  const restored = await importAndRestoreGiftedFullBackupZip(
    zipExport.zipBytes,
    {
      attachmentRepo: targetRepo,
      storage,
      replaceExistingAttachments: true,
    }
  );

  const targetAttachments = await targetRepo.listAttachments();
  const progReport = buildGiftedUnifiedProgramReportModel(
    restored.record,
    settings,
    'tpl-prog-awareness',
    { availableAttachments: targetAttachments }
  );

  assert.equal(progReport.results, 'نتائج برنامج مستعادة من ZIP');
  assert.equal(progReport.participatingStudentsCount, 1);
  assert.equal(
    progReport.participatingStudents[0].studentName,
    'نواف بن بندر الشهري'
  );
  assert.equal(progReport.selectedPhotos.length, 1);
  assert.equal(
    progReport.selectedPhotos[0].blobKey,
    buildRestoreGenBlobKey(restored.restoreGenId, 'att-zip-s2-photo')
  );
});

test('Stage 2 Test 15: Innovation Space Progress Report works intact under Additional Templates after Stage 2 upgrade', async () => {
  const settings = createStage2SampleSettings('female');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('high', 'first')
  ).record;

  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-innov-s2',
    name: 'ريم بنت خالد',
    grade: 'الصف الثاني الثانوي',
    talentDomain: 'الهندسة والابتكار التقني',
    classification: 'exceptional_gifted',
  }).record;

  record = addOrUpdateGiftedStudentParticipationInRecord(record, {
    studentId: 'stu-innov-s2',
    category: 'innovation_space',
    enrichmentUnit: 'وحدة إنترنت الأشياء والمدن الذكية',
    achievementText: 'نموذج أولي لنظام ري ذكي بالطاقة الشمسية',
    qualifiedToNextStage: true,
  });

  record = updateInnovationProgressReportOverridesInRecord(record, {
    innovationTeacherName: 'أ. هند بنت عبدالعزيز',
    outputsCount: '6',
    distinguishedOutputsCount: '2',
  });

  const innovModel = buildGiftedInnovationSpaceProgressReportModel(
    record,
    settings
  );

  assert.equal(innovModel.reportType, 'innovation_space_progress');
  assert.equal(
    innovModel.basicData.innovationTeacherName,
    'أ. هند بنت عبدالعزيز'
  );
  assert.equal(
    innovModel.basicData.innovationTeacherTitle,
    'معلمة مساحة الابتكار'
  );
  assert.ok(
    innovModel.executionData.enrichmentUnit.includes(
      'وحدة إنترنت الأشياء والمدن الذكية'
    )
  );
  assert.equal(innovModel.executionData.outputsCount, '6');
  assert.equal(innovModel.executionData.distinguishedOutputsCount, '2');
  assert.ok(
    innovModel.executionData.distinguishedOutputsSummary.includes(
      'نموذج أولي لنظام ري ذكي بالطاقة الشمسية'
    )
  );

  const pdfBytes = await generateGiftedInnovationSpaceProgressReportPdf(
    innovModel
  );
  assert.ok(pdfBytes.length > 100);
});

test('Stage 2 Test 16: Middle school grade options are strictly limited to the 3 approved options without duplicates or conflicting lists', () => {
  const middleGrades = getApprovedGradesForStage('middle');
  assert.deepEqual(middleGrades, [
    'الأول المتوسط',
    'الثاني المتوسط',
    'الثالث المتوسط',
  ]);
  assert.equal(middleGrades.length, 3);
  assert.equal(new Set(middleGrades).size, 3);

  // Normalization unifies legacy "الصف ... المتوسط" strings to the 3 canonical middle school grades
  assert.equal(normalizeGiftedGradeLabel('الصف الأول المتوسط'), 'الأول المتوسط');
  assert.equal(normalizeGiftedGradeLabel('الصف الثاني المتوسط'), 'الثاني المتوسط');
  assert.equal(normalizeGiftedGradeLabel('الصف الثالث المتوسط'), 'الثالث المتوسط');

  let record = createInitialGiftedCoordinatorRecord('middle', 'first');
  record = addOrUpdateGiftedStudentInRecord(record, {
    id: 'stu-mid-1',
    name: 'خالد بن وليد الدوسري',
    grade: 'الصف الثاني المتوسط',
    talentDomain: 'العلوم والبحث العلمي',
    classification: 'gifted',
  }).record;

  assert.equal(record.students[0].grade, 'الثاني المتوسط');
});

test('Stage 2 Test 17: Unlinked student IDs or orphaned participations never leak into reports, and empty Innovation Space fields show unrecorded labels', () => {
  const settings = createStage2SampleSettings('male');
  let record = runSafeGiftedV4Migration(
    createInitialGiftedCoordinatorRecord('middle', 'first')
  ).record;

  // Inject an orphaned participation and an unlinked studentId in execution without adding any student to record.students
  record = {
    ...record,
    studentParticipations: [
      {
        id: 'orphan-part-1',
        studentId: 'stu-non-existent-demo',
        category: 'national_identification',
        linkedProgramOrCompetitionId: 'prog-national-identification',
        qualifiedToNextStage: true,
        achievementText: 'إنجاز وهمي غير مرتبط بطالب',
        notes: '',
      },
    ],
  };

  record = upsertProgramExecutionInRecord(record, {
    templateId: 'tpl-prog-national-identification',
    status: 'executed',
    participatingStudentIds: ['stu-non-existent-demo'],
  }).record;

  const summary = computeGiftedStudentsAndAchievementsSummary(record);
  assert.equal(summary.totalStudents, 0);
  assert.equal(summary.totalParticipations, 0);
  assert.equal(summary.qualifiedStudentsCount, 0);
  assert.equal(summary.documentedAchievementsCount, 0);

  const progModel = buildGiftedUnifiedProgramReportModel(
    record,
    settings,
    'tpl-prog-national-identification'
  );
  assert.equal(progModel.participatingStudentsCount, 0);
  assert.equal(progModel.participatingStudents.length, 0);
  assert.equal(progModel.achievementsOrOutputs, 'غير مسجل');

  const innovEmpty = buildGiftedInnovationSpaceProgressReportModel(
    record,
    settings
  );
  assert.equal(
    innovEmpty.executionData.distinguishedOutputsSummary,
    'لا توجد بيانات مسجلة'
  );
  assert.equal(innovEmpty.executionData.enrichmentUnit, 'غير مسجل');
  assert.equal(innovEmpty.executionData.supportingEntities, 'غير مسجل');
  assert.equal(innovEmpty.executionData.strengths, 'غير مسجل');
  assert.equal(innovEmpty.executionData.challenges, 'غير مسجل');
  assert.equal(innovEmpty.executionData.improvementProposals, 'غير مسجل');
});

test('Central Semester Integration: createInitialGiftedCoordinatorRecord, loadGiftedRecordFromStorage, reset behavior, and historical records preservation', () => {
  const settingsFirst = {
    ...MOCK_SETTINGS_FOR_REPORTS,
    semester: 'الفصل الدراسي الأول' as const,
  };
  const settingsSecond = {
    ...MOCK_SETTINGS_FOR_REPORTS,
    semester: 'الفصل الدراسي الثاني' as const,
  };

  // 1. Calling createInitialGiftedCoordinatorRecord without semester and without settings returns 'first'
  const recDefault = createInitialGiftedCoordinatorRecord('combined');
  assert.equal(recDefault.basicInfo.semester, 'first');

  // 2. Passing 2nd-semester settings without explicit semester returns 'second'
  const recFromSettingsSecond = createInitialGiftedCoordinatorRecord(
    'combined',
    undefined,
    settingsSecond
  );
  assert.equal(recFromSettingsSecond.basicInfo.semester, 'second');

  // 3. Passing semester explicitly preserves it even if settings has a different semester
  const recExplicitFirst = createInitialGiftedCoordinatorRecord(
    'high',
    'first',
    settingsSecond
  );
  assert.equal(recExplicitFirst.basicInfo.semester, 'first');

  const recExplicitSecond = createInitialGiftedCoordinatorRecord(
    'middle',
    'second',
    settingsFirst
  );
  assert.equal(recExplicitSecond.basicInfo.semester, 'second');

  const recExplicitFullYear = createInitialGiftedCoordinatorRecord(
    'high',
    'full_year',
    settingsSecond
  );
  assert.equal(recExplicitFullYear.basicInfo.semester, 'full_year');

  // 4. Creating a new record via loadGiftedRecordFromStorage takes the current central semester
  const emptyMap = new Map<string, string>();
  const emptyStorage = {
    getItem: (k: string) => emptyMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      emptyMap.set(k, v);
    },
  };
  const loadedFreshSecond = loadGiftedRecordFromStorage(
    emptyStorage,
    settingsSecond
  );
  assert.equal(loadedFreshSecond.basicInfo.semester, 'second');

  // 5. Resetting the record takes the current central semester while preserving schoolStage
  const existingMiddleFirst = createInitialGiftedCoordinatorRecord(
    'middle',
    'first'
  );
  const resetRecord = createInitialGiftedCoordinatorRecord(
    existingMiddleFirst.basicInfo.schoolStage,
    undefined,
    settingsSecond
  );
  assert.equal(resetRecord.basicInfo.schoolStage, 'middle');
  assert.equal(resetRecord.basicInfo.semester, 'second');

  // 6. Saved historical records do not change when loaded or resolved against different central settings
  const historicalStoreMap = new Map<string, string>();
  const historicalStorage = {
    getItem: (k: string) => historicalStoreMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      historicalStoreMap.set(k, v);
    },
  };
  const historicalSecondRecord = createInitialGiftedCoordinatorRecord(
    'high',
    'second'
  );
  saveGiftedRecordToStorage(historicalSecondRecord, historicalStorage);

  const reloadedHistorical = loadGiftedRecordFromStorage(
    historicalStorage,
    settingsFirst
  );
  assert.equal(reloadedHistorical.basicInfo.schoolStage, 'high');
  assert.equal(reloadedHistorical.basicInfo.semester, 'second');

  const resolvedHistoricalSecond = resolveGiftedBasicInfo(
    reloadedHistorical,
    settingsFirst
  );
  assert.equal(resolvedHistoricalSecond.semester, 'second');

  const resolvedHistoricalFullYear = resolveGiftedBasicInfo(
    recExplicitFullYear,
    settingsFirst
  );
  assert.equal(resolvedHistoricalFullYear.semester, 'full_year');
});

