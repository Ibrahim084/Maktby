import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { SchoolSettings, TeacherPdfTemplateStyle } from '../types';
import {
  decodeQrMatrix,
  generateQrMatrix,
} from './qrCodeGenerator';
import {
  createDefaultSampleEvidencePhotos,
  generateTeacherReportPdf,
  normalizeTeacherEvidence,
  paginateTeacherReportBlocks,
} from './teacherPdfEngine';
import {
  buildTeacherTestOrEvaluationDocument,
  calculateRemainingStudentsCount,
  createInitialTestOrEvaluationState,
  createSampleTestOrEvaluationState,
  INTERNAL_TEST_CATEGORY_OPTIONS,
  INTERNAL_TEST_EXECUTION_METHODS,
  InternalTestExecutionFormState,
  isValidElectronicUrl,
  normalizeDigitsToAscii,
  parseFlexibleScore,
  parseStudentCount,
  PERFORMANCE_TASK_TYPE_OPTIONS,
  PerformanceTaskExecutionFormState,
  TEACHER_TESTS_AND_EVALUATION_CATALOG,
  TEACHER_TESTS_AND_EVALUATION_GROUP,
  validateElectronicLinks,
  validateTestOrEvaluationState,
} from './teacherTestsAndEvaluationEngine';

const mockSettings: SchoolSettings = {
  ...DEFAULT_SCHOOL_SETTINGS,
  educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
  schoolName: 'مدرسة الفيصلية المتوسطة',
  principalName: 'أ. فهد بن عبدالله السالم',
  userName: 'أ. عبدالرحمن بن خالد الغامدي',
  academicYear: '١٤٤٧هـ',
  roles: {
    ...DEFAULT_SCHOOL_SETTINGS.roles,
    teacher: 'معلم الرياضيات',
  },
  teacherPdfTemplate: 'waves',
  teacherPdfColorSystem: 'green',
};

test('Group metadata and catalog contain only the 2 approved models', () => {
  assert.equal(TEACHER_TESTS_AND_EVALUATION_GROUP.id, 'tests-and-evaluation');
  assert.equal(
    TEACHER_TESTS_AND_EVALUATION_GROUP.title,
    'الاختبارات والتقويم'
  );
  assert.equal(TEACHER_TESTS_AND_EVALUATION_CATALOG.length, 2);
  assert.equal(
    TEACHER_TESTS_AND_EVALUATION_CATALOG[0].id,
    'internal-test-execution'
  );
  assert.equal(
    TEACHER_TESTS_AND_EVALUATION_CATALOG[0].title,
    'تقرير تنفيذ اختبار داخلي'
  );
  assert.equal(
    TEACHER_TESTS_AND_EVALUATION_CATALOG[1].id,
    'performance-task-execution'
  );
  assert.equal(
    TEACHER_TESTS_AND_EVALUATION_CATALOG[1].title,
    'تقرير تنفيذ مهمة أدائية'
  );
});

test('1. Model 1 (Internal Test Execution): Full fields validation and document generation', () => {
  const sample = createSampleTestOrEvaluationState(
    'internal-test-execution',
    mockSettings
  ) as InternalTestExecutionFormState;

  sample.evidencePhotos = createDefaultSampleEvidencePhotos().slice(0, 1);

  const errors = validateTestOrEvaluationState(sample);
  assert.equal(errors.length, 0);

  const doc = buildTeacherTestOrEvaluationDocument(sample, mockSettings);
  assert.equal(doc.reportTypeLabel, 'تقرير تنفيذ اختبار داخلي');
  assert.equal(
    doc.reportMainTitle,
    'الاختبار التقويمي الأول لوحدة الجبر والمعادلات الخطية'
  );

  // Basic fields check
  const fieldLabels = doc.basicFields.map((f) => f.label);
  assert.deepEqual(fieldLabels, [
    'المادة الدراسية',
    'المرحلة الدراسية',
    'الصف',
    'تصنيف الاختبار',
    'تاريخ تنفيذ الاختبار',
  ]);

  // Execution details section check
  assert.equal(doc.sections.length, 2); // execution details + additional notes
  const execFields = doc.sections[0].fields || [];
  const execMap = Object.fromEntries(execFields.map((f) => [f.label, f.value]));
  assert.equal(execMap['الدرجة النهائية للاختبار'], '20');
  assert.equal(execMap['طريقة تنفيذ الاختبار'], 'ورقي');
  assert.equal(execMap['عدد الطلاب المستهدفين'], '32');
  assert.equal(execMap['عدد الطلاب الذين أدوا الاختبار'], '30');
  assert.equal(execMap['عدد الغائبين'], '2');

  // Additional notes and evidence present when provided
  assert.equal(doc.sections[1].title, 'ملاحظات إضافية');
  assert.ok(doc.sections[1].content?.includes('تم تنفيذ الاختبار'));
  assert.equal(doc.evidencePhotos?.length, 1);

  // Ensure prohibited fields do NOT exist anywhere in basicFields or sections
  const allLabels = [
    ...doc.basicFields.map((f) => f.label),
    ...doc.sections.flatMap((s) => [
      s.title,
      ...(s.fields?.map((f) => f.label) || []),
    ]),
  ].join(' | ');
  assert.ok(!allLabels.includes('تاريخ التصحيح'));
  assert.ok(!allLabels.includes('تاريخ إعلان النتائج'));
  assert.ok(!allLabels.includes('عدد الأسئلة'));
  assert.ok(!allLabels.includes('نسبة الإتقان'));
  assert.ok(!allLabels.includes('تحليل الدرجات'));
});

test('2. Model 1 (Internal Test Execution): Empty optional fields (notes & evidence omitted from PDF)', () => {
  const state = createSampleTestOrEvaluationState(
    'internal-test-execution',
    mockSettings
  ) as InternalTestExecutionFormState;
  state.additionalNotes = '   ';
  state.evidencePhotos = [];
  state.maxScore = '35'; // Flexible score (not restricted to 10/20/100)
  state.executionMethod = 'إلكتروني';

  const errors = validateTestOrEvaluationState(state);
  assert.equal(errors.length, 0);

  const doc = buildTeacherTestOrEvaluationDocument(state, mockSettings);
  // Only 1 section should exist (additional notes must be completely omitted)
  assert.equal(doc.sections.length, 1);
  assert.equal(
    doc.sections[0].title,
    'بيانات تنفيذ الاختبار وإحصاءات الحضور'
  );
  assert.equal(doc.evidencePhotos?.length, 0);

  const execFields = doc.sections[0].fields || [];
  const execMap = Object.fromEntries(execFields.map((f) => [f.label, f.value]));
  assert.equal(execMap['الدرجة النهائية للاختبار'], '35');
  assert.equal(execMap['طريقة تنفيذ الاختبار'], 'إلكتروني');
});

test('3. Model 1 (Internal Test Execution): Selecting "تصنيف آخر" requires and renders custom category', () => {
  const state = createSampleTestOrEvaluationState(
    'internal-test-execution',
    mockSettings
  ) as InternalTestExecutionFormState;
  state.testCategory = 'تصنيف آخر';
  state.customTestCategory = '';

  const errorsWhenEmpty = validateTestOrEvaluationState(state);
  assert.ok(
    errorsWhenEmpty.some((e) => e.includes('كتابة التصنيف المخصص للاختبار'))
  );

  state.customTestCategory = 'اختبار قصير تطبيقي للمهارات الأساسية';
  const errorsWhenFilled = validateTestOrEvaluationState(state);
  assert.equal(errorsWhenFilled.length, 0);

  const doc = buildTeacherTestOrEvaluationDocument(state, mockSettings);
  const categoryField = doc.basicFields.find(
    (f) => f.label === 'تصنيف الاختبار'
  );
  assert.equal(
    categoryField?.value,
    'اختبار قصير تطبيقي للمهارات الأساسية'
  );
});

test('4. Model 2 (Performance Task Execution): Full fields validation and document generation', () => {
  const sample = createSampleTestOrEvaluationState(
    'performance-task-execution',
    mockSettings
  ) as PerformanceTaskExecutionFormState;

  sample.evidencePhotos = createDefaultSampleEvidencePhotos().slice(0, 1);

  const errors = validateTestOrEvaluationState(sample);
  assert.equal(errors.length, 0);

  const doc = buildTeacherTestOrEvaluationDocument(sample, mockSettings);
  assert.equal(doc.reportTypeLabel, 'تقرير تنفيذ مهمة أدائية');
  assert.equal(
    doc.reportMainTitle,
    'تصميم نماذج هندسية تطبيقية لحساب المساحات والحجوم في واقع الحياة'
  );

  const basicLabels = doc.basicFields.map((f) => f.label);
  assert.deepEqual(basicLabels, [
    'المادة الدراسية',
    'المرحلة الدراسية',
    'الصف',
    'نوع المهمة',
    'تاريخ التنفيذ أو الفترة',
  ]);

  // 3 sections when notes are filled: counts + details + additional notes
  assert.equal(doc.sections.length, 3);
  const countsFields = doc.sections[0].fields || [];
  const countsMap = Object.fromEntries(
    countsFields.map((f) => [f.label, f.value])
  );
  assert.equal(countsMap['عدد الطلاب المستهدفين'], '32');
  assert.equal(countsMap['عدد الطلاب الذين أنجزوا المهمة'], '29');
  assert.equal(countsMap['عدد الطلاب الذين لم ينجزوها'], '3');

  const detailsFields = doc.sections[1].fields || [];
  const detailsLabels = detailsFields.map((f) => f.label);
  assert.deepEqual(detailsLabels, [
    'هدف المهمة',
    'وصف المهمة وآلية تنفيذها',
    'طريقة التقويم',
  ]);

  assert.equal(doc.sections[2].title, 'ملاحظات إضافية');
  assert.equal(doc.evidencePhotos?.length, 1);
});

test('5. Model 2 (Performance Task Execution): Empty optional fields and custom task type ("أخرى")', () => {
  const state = createSampleTestOrEvaluationState(
    'performance-task-execution',
    mockSettings
  ) as PerformanceTaskExecutionFormState;
  state.additionalNotes = '';
  state.evidencePhotos = [];
  state.taskType = 'أخرى';
  state.customTaskType = '';

  const errorsEmptyCustom = validateTestOrEvaluationState(state);
  assert.ok(
    errorsEmptyCustom.some((e) => e.includes('كتابة نوع المهمة المخصص'))
  );

  state.customTaskType = 'مهمة استقصاء ميداني وتوثيق عملي';
  const errorsValid = validateTestOrEvaluationState(state);
  assert.equal(errorsValid.length, 0);

  const doc = buildTeacherTestOrEvaluationDocument(state, mockSettings);
  // Notes omitted -> only 2 sections
  assert.equal(doc.sections.length, 2);
  assert.equal(doc.evidencePhotos?.length, 0);
  const typeField = doc.basicFields.find((f) => f.label === 'نوع المهمة');
  assert.equal(typeField?.value, 'مهمة استقصاء ميداني وتوثيق عملي');
});

test('6 & 7. Automatic calculation and invalid/boundary numbers validation', () => {
  // Normal calculation with ASCII digits
  const normal = calculateRemainingStudentsCount('30', '27', 'المؤدين');
  assert.equal(normal.isValid, true);
  assert.equal(normal.targetCount, 30);
  assert.equal(normal.completedOrPerformedCount, 27);
  assert.equal(normal.remainingCount, 3);

  // Normal calculation with Arabic-Indic digits (٣٥ - ٣٠ = ٥)
  const arabicDigits = calculateRemainingStudentsCount('٣٥', '٣٠', 'المنجزين');
  assert.equal(arabicDigits.isValid, true);
  assert.equal(arabicDigits.targetCount, 35);
  assert.equal(arabicDigits.completedOrPerformedCount, 30);
  assert.equal(arabicDigits.remainingCount, 5);

  // Boundary: performed == target (0 absent)
  const zeroRemaining = calculateRemainingStudentsCount('28', '28', 'المؤدين');
  assert.equal(zeroRemaining.isValid, true);
  assert.equal(zeroRemaining.remainingCount, 0);

  // Boundary: performed == 0 (all absent)
  const allRemaining = calculateRemainingStudentsCount('28', '0', 'المؤدين');
  assert.equal(allRemaining.isValid, true);
  assert.equal(allRemaining.remainingCount, 28);

  // Invalid: performed > target (must reject and never produce negative remainingCount)
  const exceeds = calculateRemainingStudentsCount('25', '26', 'المؤدين');
  assert.equal(exceeds.isValid, false);
  assert.equal(exceeds.remainingCount, null);
  assert.ok(exceeds.errorMessage?.includes('لا يمكن أن يتجاوز'));

  // Invalid: negative target
  const negativeTarget = calculateRemainingStudentsCount('-10', '5', 'المؤدين');
  assert.equal(negativeTarget.isValid, false);
  assert.equal(negativeTarget.remainingCount, null);
  assert.ok(negativeTarget.errorMessage?.includes('رقماً سالباً'));

  // Invalid: negative performed/completed
  const negativeActual = calculateRemainingStudentsCount('25', '-3', 'المنجزين');
  assert.equal(negativeActual.isValid, false);
  assert.equal(negativeActual.remainingCount, null);
  assert.ok(negativeActual.errorMessage?.includes('رقماً سالباً'));

  // Invalid: target == 0
  const zeroTarget = calculateRemainingStudentsCount('0', '0', 'المؤدين');
  assert.equal(zeroTarget.isValid, false);
  assert.equal(zeroTarget.remainingCount, null);
});

test('8. Shared PDF Engine compatibility across all 3 templates (waves, waves-2, geometric)', () => {
  const templates: TeacherPdfTemplateStyle[] = ['waves', 'waves-2', 'geometric'];
  const s1 = createSampleTestOrEvaluationState(
    'internal-test-execution',
    mockSettings
  );
  const s2 = createSampleTestOrEvaluationState(
    'performance-task-execution',
    mockSettings
  );

  for (const tpl of templates) {
    const doc1 = buildTeacherTestOrEvaluationDocument(s1, mockSettings, {
      templateStyle: tpl,
    });
    const doc2 = buildTeacherTestOrEvaluationDocument(s2, mockSettings, {
      templateStyle: tpl,
    });

    const pages1 = paginateTeacherReportBlocks(doc1, mockSettings);
    const pages2 = paginateTeacherReportBlocks(doc2, mockSettings);

    assert.equal(doc1.templateStyle, tpl);
    assert.equal(doc2.templateStyle, tpl);
    assert.ok(pages1.length >= 1);
    assert.ok(pages2.length >= 1);
  }

  // Verify catalog options match specification
  assert.equal(INTERNAL_TEST_CATEGORY_OPTIONS.length, 7);
  assert.equal(INTERNAL_TEST_EXECUTION_METHODS.length, 2);
  assert.equal(PERFORMANCE_TASK_TYPE_OPTIONS.length, 7);
  assert.equal(normalizeDigitsToAscii('٤٥'), '45');
  assert.equal(parseStudentCount('٣٠'), 30);
  assert.equal(parseFlexibleScore('25.5'), 25.5);
  assert.ok(
    createInitialTestOrEvaluationState('internal-test-execution', mockSettings)
      .formId === 'internal-test-execution'
  );
});

test('9. Optional QR Links (روابط إلكترونية) for both models: 0 links, 1 link, 2 links, URL validation, QR scannability, clickable PDF links, and 3 templates', async () => {
  // URL validation checks
  assert.equal(isValidElectronicUrl('https://madrasati.sa/test/2026'), true);
  assert.equal(isValidElectronicUrl('http://moe.gov.sa/results'), true);
  assert.equal(isValidElectronicUrl(''), false);
  assert.equal(isValidElectronicUrl('   '), false);
  assert.equal(isValidElectronicUrl('not-a-valid-url'), false);
  assert.equal(isValidElectronicUrl('ftp://files.moe.gov.sa'), false);
  assert.equal(isValidElectronicUrl('https://invalid host with spaces.com'), false);

  assert.equal(validateElectronicLinks([]).length, 0);
  assert.ok(
    validateElectronicLinks([{ id: 'l1', url: '' }]).some((e) =>
      e.includes('الرابط الإلكتروني (1) فارغ')
    )
  );
  assert.ok(
    validateElectronicLinks([{ id: 'l1', url: 'madrasati.sa/no-scheme' }]).some(
      (e) => e.includes('صيغة الرابط الإلكتروني (1) غير صحيحة')
    )
  );

  const formIds = [
    'internal-test-execution',
    'performance-task-execution',
  ] as const;
  const templates: TeacherPdfTemplateStyle[] = ['waves', 'waves-2', 'geometric'];

  for (const formId of formIds) {
    // Case 1: 0 links (and 0 photos) -> section completely omitted in preview & PDF
    const state0 = createSampleTestOrEvaluationState(formId, mockSettings);
    state0.evidencePhotos = [];
    state0.evidenceLinks = [];

    assert.equal(validateTestOrEvaluationState(state0).length, 0);
    const doc0 = buildTeacherTestOrEvaluationDocument(state0, mockSettings);
    assert.equal(doc0.evidenceLinks?.length, 0);
    const norm0 = normalizeTeacherEvidence(doc0);
    assert.equal(norm0.links.length, 0);
    assert.equal(norm0.hasAny, false);
    const pages0 = paginateTeacherReportBlocks(doc0, mockSettings);
    assert.equal(
      pages0.some((p) => p.blocks.some((b) => b.kind === 'evidence')),
      false,
      `Evidence/QR block must be completely omitted when 0 links and 0 photos for ${formId}`
    );
    const pdf0 = await generateTeacherReportPdf(doc0, mockSettings);
    assert.equal(pdf0.linkAnnotationsCount, 0);

    // Case 2: 1 link -> 1 QR code generated, scannable, clickable in PDF, no second empty QR
    const url1 =
      formId === 'internal-test-execution'
        ? 'https://madrasati.sa/tests/internal-exam-math-2026'
        : 'https://madrasati.sa/tasks/geometry-project-2026';
    const state1 = createSampleTestOrEvaluationState(formId, mockSettings);
    state1.evidencePhotos = [];
    state1.evidenceLinks = [{ id: 'te-link-1', url: url1 }];

    assert.equal(validateTestOrEvaluationState(state1).length, 0);
    const doc1 = buildTeacherTestOrEvaluationDocument(state1, mockSettings);
    assert.equal(doc1.evidenceLinks?.length, 1);
    assert.equal(doc1.evidenceLinks?.[0].url, url1);
    // Scannability check
    assert.equal(decodeQrMatrix(generateQrMatrix(url1, 2), 2), url1);

    const pdf1 = await generateTeacherReportPdf(doc1, mockSettings);
    assert.equal(pdf1.linkAnnotationsCount, 1);
    const pdfStr1 = new TextDecoder('latin1').decode(pdf1.pdfBytes);
    assert.ok(pdfStr1.includes('/Subtype /Link'));
    assert.ok(pdfStr1.includes(`/URI (${url1})`));

    // Case 3: 2 independent links -> 2 independent QR codes, scannable, clickable across all 3 templates
    const url2 =
      formId === 'internal-test-execution'
        ? 'https://moe.gov.sa/ar/education/assessment-records-1447'
        : 'https://ien.edu.sa/portfolios/student-models-1447';
    const state2 = createSampleTestOrEvaluationState(formId, mockSettings);
    state2.evidencePhotos = [];
    state2.evidenceLinks = [
      { id: 'te-link-1', url: url1 },
      { id: 'te-link-2', url: url2 },
    ];

    assert.equal(validateTestOrEvaluationState(state2).length, 0);
    // Verify each QR code decodes independently to its own URL (never merged)
    const matrix1 = generateQrMatrix(url1, 2);
    const matrix2 = generateQrMatrix(url2, 2);
    assert.equal(decodeQrMatrix(matrix1, 2), url1);
    assert.equal(decodeQrMatrix(matrix2, 2), url2);
    assert.notDeepEqual(matrix1, matrix2);

    for (const tpl of templates) {
      const doc2 = buildTeacherTestOrEvaluationDocument(state2, mockSettings, {
        templateStyle: tpl,
      });
      assert.equal(doc2.evidenceLinks?.length, 2);
      const pdf2 = await generateTeacherReportPdf(doc2, mockSettings);
      assert.equal(
        pdf2.linkAnnotationsCount,
        2,
        `Expected 2 clickable PDF link annotations for ${formId} on template ${tpl}`
      );
      const pdfStr2 = new TextDecoder('latin1').decode(pdf2.pdfBytes);
      assert.ok(pdfStr2.includes(`/URI (${url1})`));
      assert.ok(pdfStr2.includes(`/URI (${url2})`));
    }
  }
});

