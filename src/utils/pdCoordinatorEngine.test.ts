import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  calculatePlanExecutedHours,
  createDefaultExecutionReportData,
  createEmptyExecutedProgramEntry,
  createEmptyPlanTopicRow,
  createEmptyTrainerEntry,
  createEvaluationFromExecutedProgram,
  createInitialPdUnitStore,
  createMemoryPdAttachmentRepository,
  createPlanVessel,
  createProgramEvaluationRecord,
  deriveQuarterlyHoursReport,
  exportPdFullBackupZip,
  getOrCreatePeriodRecord,
  getPdEvaluationItems,
  getPdGenderedTerms,
  importAndRestorePdFullBackupZip,
  loadPdUnitStore,
  parseBatchBeneficiaryLines,
  PD_EVALUATION_ITEMS,
  PD_EVALUATION_OPTIONS,
  PD_UNIT_STORAGE_KEY,
  resolvePdOfficialHeader,
  savePdUnitStore,
  switchPdActivePeriod,
  updatePeriodRecord,
} from './pdCoordinatorEngine';
import {
  generatePdEvaluationPdfBytes,
  generatePdExecutionReportPdfBytes,
  generatePdGeneralPlanPdfBytes,
  generatePdQuarterlyHoursReportPdfBytes,
} from './pdReportPdfGenerator';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('store excludes circular state and safely migrates legacy stored JSON containing circularsByYear without losing periods', () => {
  const freshStore = createInitialPdUnitStore({
    ...DEFAULT_SCHOOL_SETTINGS,
    academicYear: '1448هـ',
  });
  assert.equal('circularsByYear' in freshStore, false);

  const storage = createMemoryStorage();
  const legacyPayload = {
    version: 1,
    activeAcademicYear: '1447هـ',
    activeSemester: 'الفصل الدراسي الثاني',
    circularsByYear: {
      '1447هـ': { transactionNumber: '4700001111', regulations: [] },
    },
    periods: {
      '1447هـ::الفصل الدراسي الثاني': {
        periodKey: '1447هـ::الفصل الدراسي الثاني',
        academicYear: '1447هـ',
        semester: 'الفصل الدراسي الثاني',
        schoolStages: ['ب'],
        generalPlan: {
          vessels: [
            {
              id: 'v1',
              vesselName: 'ورش العمل',
              rows: [
                {
                  id: 'r1',
                  topic: 'ورشة محفوظة سابقاً',
                  presenterName: 'أحمد',
                  specialization: 'علوم',
                  executionDate: '1447/6/1',
                  hoursCount: '4',
                  executionLocation: 'المدرسة',
                  executionStatus: 'executed',
                  notExecutedReason: '',
                },
              ],
            },
          ],
          coordinatorAuthName: 'منسق',
          principalAuthName: 'مدير',
        },
      },
    },
  };
  storage.setItem(PD_UNIT_STORAGE_KEY, JSON.stringify(legacyPayload));

  const migrated = loadPdUnitStore(storage, DEFAULT_SCHOOL_SETTINGS);
  assert.equal('circularsByYear' in migrated, false);
  assert.equal(migrated.activeAcademicYear, '1447هـ');
  assert.equal(migrated.activeSemester, 'الفصل الدراسي الثاني');
  const preservedPeriod = getOrCreatePeriodRecord(
    migrated,
    '1447هـ',
    'الفصل الدراسي الثاني'
  ).period;
  assert.equal(calculatePlanExecutedHours(preservedPeriod.generalPlan), 4);
  assert.equal(preservedPeriod.generalPlan.vessels[0].vesselName, 'ورش العمل');
});

test('period switcher isolates First vs Second semester & historical years without touching central settings', () => {
  const centralSettings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    academicYear: '1448هـ',
    semester: 'الفصل الدراسي الأول' as const,
  };
  let store = createInitialPdUnitStore(centralSettings);

  // Add executed hours in 1448 Sem 1
  store = updatePeriodRecord(store, '1448هـ', 'الفصل الدراسي الأول', (p) => {
    const vessels = p.generalPlan.vessels.map((v, idx) =>
      idx === 0
        ? {
            ...v,
            vesselName: 'ورش العمل',
            rows: v.rows.map((r, rIdx) =>
              rIdx === 0
                ? {
                    ...r,
                    topic: 'استراتيجيات التدريس الحديثة',
                    hoursCount: '6',
                    executionStatus: 'executed' as const,
                  }
                : r
            ),
          }
        : v
    );
    return {
      ...p,
      generalPlan: { ...p.generalPlan, vessels },
    };
  });

  // Switch inside PD unit to 1447 Sem 2
  store = switchPdActivePeriod(store, '1447هـ', 'الفصل الدراسي الثاني');
  assert.equal(store.activeAcademicYear, '1447هـ');
  assert.equal(store.activeSemester, 'الفصل الدراسي الثاني');

  // Verify central settings object was NOT mutated
  assert.equal(centralSettings.academicYear, '1448هـ');
  assert.equal(centralSettings.semester, 'الفصل الدراسي الأول');

  const p1448S1 = getOrCreatePeriodRecord(
    store,
    '1448هـ',
    'الفصل الدراسي الأول'
  ).period;
  const p1447S2 = getOrCreatePeriodRecord(
    store,
    '1447هـ',
    'الفصل الدراسي الثاني'
  ).period;

  assert.equal(calculatePlanExecutedHours(p1448S1.generalPlan), 6);
  assert.equal(calculatePlanExecutedHours(p1447S2.generalPlan), 0);
});

test('Engine 01 initializes 3 empty-titled vessels, supports unlimited vessels/rows, and sums executed hours accurately', () => {
  const store = createInitialPdUnitStore();
  const { period } = getOrCreatePeriodRecord(
    store,
    store.activeAcademicYear,
    store.activeSemester
  );

  // Default 3 vessels with EMPTY titles & 5 rows each
  assert.equal(period.generalPlan.vessels.length, 3);
  for (const v of period.generalPlan.vessels) {
    assert.equal(v.vesselName, '');
    assert.equal(v.rows.length, 5);
  }

  // Test unlimited vessels (>3) and free hours without regulatory restrictions
  const customPlan = {
    ...period.generalPlan,
    vessels: [
      {
        ...createPlanVessel('البرامج التدريبية', 4),
        rows: [
          {
            ...createEmptyPlanTopicRow(),
            topic: 'برنامج 1',
            executionDate: '1448/4/15',
            hoursCount: '8',
            executionStatus: 'executed' as const,
          },
          {
            ...createEmptyPlanTopicRow(),
            topic: 'برنامج 2',
            executionDate: '1448/4/15',
            hoursCount: '10',
            executionStatus: 'executed' as const,
          },
          {
            ...createEmptyPlanTopicRow(),
            topic: 'برنامج 3',
            executionDate: '1448/4/20',
            hoursCount: '12',
            executionStatus: 'not_executed' as const,
            notExecutedReason: 'تأجيل',
          },
          {
            ...createEmptyPlanTopicRow(),
            topic: 'برنامج 4',
            executionDate: '1448/4/25',
            hoursCount: '10',
            executionStatus: 'pending' as const,
          },
        ],
      },
      createPlanVessel('ورش العمل', 6),
      createPlanVessel('بحث الدرس', 2),
      createPlanVessel('الزيارات التبادلية', 2),
    ],
  };

  // Only executed rows count (8 + 10 = 18; not_executed 12 & pending 10 excluded)
  assert.equal(calculatePlanExecutedHours(customPlan), 18);
});

test('Engine 02 supports >4 trainers/programs, batch beneficiaries parsing, Engine 03 literal 15 items (no stats), and Engine 04 auto-derivation', () => {
  const store = createInitialPdUnitStore();
  const parsedBatch = parseBatchBeneficiaryLines(
    'أحمد سعيد الزهراني - ١٠١٢٣٤٥٦٧٨\nخالد محمد الغامدي, 1098765432, 5\nعبدالله علي'
  );
  assert.equal(parsedBatch.length, 3);
  assert.equal(parsedBatch[0].name, 'أحمد سعيد الزهراني');
  assert.equal(parsedBatch[0].nationalId, '1012345678');
  assert.equal(parsedBatch[1].hoursCount, '5');

  const updated = updatePeriodRecord(
    store,
    store.activeAcademicYear,
    store.activeSemester,
    (p) => ({
      ...p,
      schoolStages: ['ب', 'م'],
      executionReport: {
        ...p.executionReport,
        trainers: Array.from({ length: 6 }, (_, i) => ({
          ...createEmptyTrainerEntry(),
          name: `مدرب ${i + 1}`,
        })),
        programs: [
          {
            ...createEmptyExecutedProgramEntry(),
            id: 'prog_a',
            programName: 'التقويم التكويني',
            vesselType: 'برنامج تدريبي',
            executionDate: '1448/5/1',
            executionLocation: 'مركز المصادر',
            targetAudience: 'المعلمون',
            daysCount: '2',
            hoursCount: '10',
            traineesCount: '2',
            trainerName: 'مدرب 1',
            beneficiaries: [
              { id: 'b1', name: 'أحمد سعيد', nationalId: '1012345678' },
              { id: 'b2', name: 'خالد محمد', nationalId: '1098765432' },
            ],
          },
          {
            ...createEmptyExecutedProgramEntry(),
            id: 'prog_b',
            programName: 'مجتمعات التعلم',
            vesselType: 'ورشة عمل',
            executionDate: '1448/5/8',
            hoursCount: '4',
            traineesCount: '1',
            trainerName: 'مدرب 2',
            beneficiaries: [
              { id: 'b3', name: 'أحمد سعيد', nationalId: '1012345678' },
            ],
          },
          createEmptyExecutedProgramEntry(),
          createEmptyExecutedProgramEntry(),
          createEmptyExecutedProgramEntry(),
          createEmptyExecutedProgramEntry(),
        ],
      },
      generalPlan: {
        ...p.generalPlan,
        vessels: [
          {
            id: 'v1',
            vesselName: 'بحث الدرس',
            rows: [
              {
                ...createEmptyPlanTopicRow(),
                topic: 'تطوير درس العلوم',
                executionDate: '1448/5/12',
                hoursCount: '3',
                executionStatus: 'executed',
              },
              {
                ...createEmptyPlanTopicRow(),
                topic: 'التقويم التكويني', // Duplicate name as prog_a -> should NOT double-count in Table 1
                executionDate: '1448/5/1',
                hoursCount: '10',
                executionStatus: 'executed',
              },
            ],
          },
        ],
      },
    })
  );

  const period = getOrCreatePeriodRecord(
    updated,
    updated.activeAcademicYear,
    updated.activeSemester
  ).period;

  // Verify >4 paper cap removed
  assert.equal(period.executionReport.trainers.length, 6);
  assert.equal(period.executionReport.programs.length, 6);

  // Verify Engine 03 literal 15 items & 4 options, zero extra metrics
  assert.equal(PD_EVALUATION_ITEMS.length, 15);
  assert.equal(PD_EVALUATION_ITEMS[0].label, 'وضوح أهداف البرنامج');
  assert.equal(
    PD_EVALUATION_ITEMS[14].label,
    'توفر الشروط الصحية الملائمة في قاعة التدريب (كالتهيئة والإضاءة.....)'
  );
  assert.deepEqual(
    PD_EVALUATION_OPTIONS.map((o) => o.shortLabel),
    ['عالية', 'متوسطة', 'منخفضة', 'لا أوافق']
  );

  const eval1 = createEvaluationFromExecutedProgram(
    period.executionReport.programs[0],
    'متدرب 1'
  );
  const eval2 = createProgramEvaluationRecord({
    programName: period.executionReport.programs[0].programName,
    traineeLabel: 'متدرب 2',
  });
  assert.equal(eval1.responses.length, 15);
  assert.notEqual(eval1.id, eval2.id);

  // Verify Engine 04 auto-derivation (2 executed from 02 + 1 unique executed from 01 = 3 vessel rows)
  const quarterly = deriveQuarterlyHoursReport(period);
  assert.equal(quarterly.vesselRows.length, 3);
  assert.equal(quarterly.beneficiaryRows.length, 2);

  // Ahmed appeared in prog_a (10h) + prog_b (4h) -> summed to 14h
  const ahmed = quarterly.beneficiaryRows.find(
    (b) => b.nationalId === '1012345678'
  );
  const khaled = quarterly.beneficiaryRows.find(
    (b) => b.nationalId === '1098765432'
  );
  assert.equal(ahmed?.totalHours, 14);
  assert.equal(khaled?.totalHours, 10);
  assert.equal(quarterly.totalSchoolHours, 24);
});

test('persistence roundtrip, IndexedDB memory attachment & ZIP backup/restore, and headless PDF output work cleanly', async () => {
  const storage = createMemoryStorage();
  const repo = createMemoryPdAttachmentRepository();

  let store = createInitialPdUnitStore(DEFAULT_SCHOOL_SETTINGS);
  store = updatePeriodRecord(
    store,
    store.activeAcademicYear,
    store.activeSemester,
    (p) => ({
      ...p,
      executionReport: {
        ...p.executionReport,
        programs: [
          {
            ...createEmptyExecutedProgramEntry('prog_with_photo'),
            programName: 'برنامج التطوير المهني',
            hoursCount: '10',
            beneficiaries: Array.from({ length: 18 }, (_, i) => ({
              id: `b_${i + 1}`,
              name: `معلم ${i + 1}`,
              nationalId: String(1000000000 + i),
            })),
            evidencePhotos: [
              {
                id: 'ev1',
                blobKey: 'photo_key_1',
                title: 'صورة ورشة عمل',
                mimeType: 'image/png',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
    })
  );

  await repo.saveAttachment({
    blobKey: 'photo_key_1',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
    createdAt: new Date().toISOString(),
  });

  savePdUnitStore(store, storage);
  const loaded = loadPdUnitStore(storage, DEFAULT_SCHOOL_SETTINGS);
  assert.equal(
    loaded.periods[Object.keys(loaded.periods)[0]].executionReport.programs[0]
      .beneficiaries.length,
    18
  );

  // ZIP full backup & restore
  const { zipBytes, attachmentsCount } = await exportPdFullBackupZip(loaded, repo);
  assert.equal(attachmentsCount, 1);
  assert.ok(zipBytes.length > 100);

  const repoRestored = createMemoryPdAttachmentRepository();
  const restored = await importAndRestorePdFullBackupZip(
    zipBytes,
    repoRestored,
    DEFAULT_SCHOOL_SETTINGS
  );
  assert.equal(restored.restoredAttachmentsCount, 1);
  const restoredPhoto = await repoRestored.getAttachment('photo_key_1');
  assert.ok(restoredPhoto && restoredPhoto.bytes.length === 7);

  // Verify PDF generation headers and multi-page support (>15 beneficiaries in Quarterly Report)
  const period = getOrCreatePeriodRecord(
    loaded,
    loaded.activeAcademicYear,
    loaded.activeSemester
  ).period;

  const pdf1 = await generatePdGeneralPlanPdfBytes(period, DEFAULT_SCHOOL_SETTINGS);
  const pdf2 = await generatePdExecutionReportPdfBytes(period, DEFAULT_SCHOOL_SETTINGS, repo);
  const pdf3 = await generatePdEvaluationPdfBytes([], period, DEFAULT_SCHOOL_SETTINGS, true);
  const pdf4 = await generatePdQuarterlyHoursReportPdfBytes(period, DEFAULT_SCHOOL_SETTINGS);

  for (const res of [pdf1, pdf2, pdf3, pdf4]) {
    const headerStr = new TextDecoder().decode(res.pdfBytes.subarray(0, 8));
    assert.ok(headerStr.startsWith('%PDF-1.4'));
  }

  // Verify Form 01 PDF is A4 Landscape (841.89 x 595.28 pt) while Forms 02, 03, 04 remain A4 Portrait (595.28 x 841.89 pt)
  const pdf1Text = new TextDecoder('latin1').decode(pdf1.pdfBytes);
  assert.ok(
    pdf1Text.includes('/MediaBox [0 0 841.89 595.28]'),
    'Form 01 General Plan PDF must use A4 Landscape MediaBox [0 0 841.89 595.28]'
  );
  for (const [idx, res] of [
    ['02', pdf2],
    ['03', pdf3],
    ['04', pdf4],
  ] as const) {
    const txt = new TextDecoder('latin1').decode(res.pdfBytes);
    assert.ok(
      txt.includes('/MediaBox [0 0 595.28 841.89]'),
      `Form ${idx} PDF must remain A4 Portrait MediaBox [0 0 595.28 841.89]`
    );
  }
  assert.equal(pdf4.pageCount, 2); // 18 beneficiaries -> 2 pages
});

test('central gender adaptation removes dual slashes and adapts PD forms, roles, evaluation items, and quarterly fallback', () => {
  const maleTerms = getPdGenderedTerms('male');
  const femaleTerms = getPdGenderedTerms('female');

  assert.equal(maleTerms.coordinatorDefaultTitle, 'منسق التطوير المهني');
  assert.equal(femaleTerms.coordinatorDefaultTitle, 'منسقة التطوير المهني');
  assert.equal(maleTerms.teachersCountLabel, 'عدد المعلمين');
  assert.equal(femaleTerms.teachersCountLabel, 'عدد المعلمات');
  assert.equal(maleTerms.trainerNameLabel, 'اسم المدرب');
  assert.equal(femaleTerms.trainerNameLabel, 'اسم المدربة');
  assert.equal(maleTerms.trainerExecutorLabel, 'منفذ التدريب');
  assert.equal(femaleTerms.trainerExecutorLabel, 'منفذة التدريب');
  assert.equal(maleTerms.traineesCountLabel, 'عدد المتدربين');
  assert.equal(femaleTerms.traineesCountLabel, 'عدد المتدربات');
  assert.equal(maleTerms.beneficiariesCountLabel, 'عدد المستفيدين');
  assert.equal(femaleTerms.beneficiariesCountLabel, 'عدد المستفيدات');
  assert.equal(maleTerms.schoolStaffDative, 'لمنسوبي المدرسة');
  assert.equal(femaleTerms.schoolStaffDative, 'لمنسوبات المدرسة');

  for (const [key, value] of [
    ...Object.entries(maleTerms),
    ...Object.entries(femaleTerms),
  ]) {
    if (typeof value === 'string') {
      assert.equal(
        /\/|ـة|ــة/.test(value),
        false,
        `Unexpected dual-gender token in ${key}: ${value}`
      );
    }
  }

  const maleEvalItems = getPdEvaluationItems('male');
  const femaleEvalItems = getPdEvaluationItems('female');
  assert.equal(maleEvalItems.length, 15);
  assert.equal(femaleEvalItems.length, 15);
  assert.equal(maleEvalItems[6].label, 'ارتباط التطبيقات بطبيعة عمل المتدربين');
  assert.equal(femaleEvalItems[6].label, 'ارتباط التطبيقات بطبيعة عمل المتدربات');
  for (const item of [...maleEvalItems, ...femaleEvalItems]) {
    assert.equal(item.label.includes('/'), false);
  }

  const store = createInitialPdUnitStore(DEFAULT_SCHOOL_SETTINGS);
  const { period } = getOrCreatePeriodRecord(
    store,
    store.activeAcademicYear,
    store.activeSemester
  );

  const maleHeader = resolvePdOfficialHeader(period, {
    ...DEFAULT_SCHOOL_SETTINGS,
    gender: 'male',
  });
  const femaleHeader = resolvePdOfficialHeader(period, {
    ...DEFAULT_SCHOOL_SETTINGS,
    gender: 'female',
  });
  assert.equal(maleHeader.coordinatorTitle, 'منسق التطوير المهني');
  assert.equal(femaleHeader.coordinatorTitle, 'منسقة التطوير المهني');
  assert.equal(maleHeader.principalTitle, 'مدير المدرسة');
  assert.equal(femaleHeader.principalTitle, 'مديرة المدرسة');

  const execDefaults = createDefaultExecutionReportData();
  assert.equal('stampLabel' in execDefaults, false);

  // Verify quarterly fallback uses feminine noun when school settings gender is female
  const periodWithNamelessBen = {
    ...period,
    executionReport: {
      ...period.executionReport,
      programs: [
        {
          ...createEmptyExecutedProgramEntry('p1'),
          programName: 'برنامج تجريبي',
          hoursCount: '3',
          beneficiaries: [{ id: 'b_x', name: '', nationalId: '1011111111' }],
        },
      ],
    },
  };
  const femaleQuarterly = deriveQuarterlyHoursReport(periodWithNamelessBen, 'female');
  assert.equal(femaleQuarterly.beneficiaryRows[0].name, 'مستفيدة');
});

test('PD unit files contain zero deprecated labels (التطوير المهني التعليمي, المصادقة على البيانات, الختم, old closing notes)', () => {
  const filesToAudit = [
    'src/utils/pdReportPdfGenerator.ts',
    'src/components/pd/PdGeneralPlanEngine.tsx',
    'src/components/pd/PdExecutionReportEngine.tsx',
    'src/components/pd/PdEvaluationEngine.tsx',
    'src/components/pd/PdQuarterlyHoursReportEngine.tsx',
    'src/components/pd/PdSectionHub.tsx',
  ];
  const forbiddenPhrases = [
    'التطوير المهني التعليمي',
    'المصادقة على البيانات',
    'ملاحظة: يتم تدعيم التقارير',
    'هذا النموذج يسلم لكل متدرب',
    'لمنفذ أو منفذة',
    'بسم الله الرحمن الرحيم',
  ];

  for (const rel of filesToAudit) {
    const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    for (const phrase of forbiddenPhrases) {
      assert.equal(
        content.includes(phrase),
        false,
        `Found forbidden phrase "${phrase}" in ${rel}`
      );
    }
    assert.equal(
      content.includes('الختم'),
      false,
      `Found stamp text "الختم" in ${rel}`
    );
  }
});
