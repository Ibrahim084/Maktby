import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import {
  generateTeacherReportPdf,
  paginateTeacherReportBlocks,
} from './teacherPdfEngine';
import {
  buildTeacherReportDocumentFromForm,
  clearTeacherReportDraftInStorage,
  computeLearningLevelsDistribution,
  createInitialTeacherReportData,
  createSampleTeacherReportFormData,
  loadTeacherReportDraftFromStorage,
  PROFESSIONAL_ACHIEVEMENT_TYPES,
  saveTeacherReportDraftToStorage,
  TEACHER_PLANS_GROUP,
  TEACHER_PLANS_PATHS,
  TEACHER_PROFESSIONAL_REPORTS_CATALOG,
  TEACHER_PROFESSIONAL_REPORTS_GROUP,
  TeacherProfessionalReportId,
  validateTeacherProfessionalReport,
} from './teacherReportsEngine';

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

test('Group «التقارير المهنية والتعليمية» defines exactly the 5 approved independent forms', () => {
  assert.equal(
    TEACHER_PROFESSIONAL_REPORTS_GROUP.title,
    'التقارير المهنية والتعليمية'
  );
  assert.equal(TEACHER_PROFESSIONAL_REPORTS_CATALOG.length, 5);

  const titles = TEACHER_PROFESSIONAL_REPORTS_CATALOG.map((item) => item.title);
  assert.deepEqual(titles, [
    'تقرير تنفيذ استراتيجية تعليمية',
    'تقرير معالجة مشكلة تعليمية',
    'تقرير تحليل نتائج التعلم',
    'تقرير ممارسة تعليمية متميزة',
    'تقرير إنجاز مهني',
  ]);
});

test('Group «الخطط» defines exactly the 2 approved paths: خطط المعلم and خطط المعلم للطلاب', () => {
  assert.equal(TEACHER_PLANS_GROUP.title, 'الخطط');
  assert.equal(TEACHER_PLANS_PATHS.length, 2);

  const pathIds = TEACHER_PLANS_PATHS.map((item) => item.id);
  assert.deepEqual(pathIds, ['teacher-plans', 'student-plans']);

  const pathTitles = TEACHER_PLANS_PATHS.map((item) => item.title);
  assert.deepEqual(pathTitles, ['خطط المعلم', 'خطط المعلم للطلاب']);
});

test('Form 3 (تحليل نتائج التعلم): automatic calculation of percentages and sum verification (ASCII & Arabic-Indic digits)', () => {
  // Exact match: 12 + 9 + 5 + 3 + 1 = 30
  const matched = computeLearningLevelsDistribution({
    totalStudentsCount: '30',
    excellentCount: '12',
    veryGoodCount: '9',
    goodCount: '5',
    acceptableCount: '3',
    weakCount: '1',
  });
  assert.equal(matched.totalStudents, 30);
  assert.equal(matched.sumOfLevels, 30);
  assert.equal(matched.isMatched, true);
  assert.equal(matched.difference, 0);
  assert.equal(matched.levels[0].formattedPercentage, '40%'); // 12/30
  assert.equal(matched.levels[1].formattedPercentage, '30%'); // 9/30
  assert.equal(matched.levels[2].formattedPercentage, '16.7%'); // 5/30
  assert.equal(matched.levels[3].formattedPercentage, '10%'); // 3/30
  assert.equal(matched.levels[4].formattedPercentage, '3.3%'); // 1/30

  // Arabic-Indic digits support: ٢٠ total -> ١٠ + ٥ + ٣ + ٢ + ٠ = ٢٠
  const arabicDigitsDist = computeLearningLevelsDistribution({
    totalStudentsCount: '٢٠',
    excellentCount: '١٠',
    veryGoodCount: '٥',
    goodCount: '٣',
    acceptableCount: '٢',
    weakCount: '٠',
  });
  assert.equal(arabicDigitsDist.totalStudents, 20);
  assert.equal(arabicDigitsDist.sumOfLevels, 20);
  assert.equal(arabicDigitsDist.isMatched, true);
  assert.equal(arabicDigitsDist.levels[0].formattedPercentage, '50%');
  assert.equal(arabicDigitsDist.levels[1].formattedPercentage, '25%');

  // Mismatch (sum < total): 10 + 5 + 5 + 2 + 1 = 23 != 30
  const underSum = computeLearningLevelsDistribution({
    totalStudentsCount: '30',
    excellentCount: '10',
    veryGoodCount: '5',
    goodCount: '5',
    acceptableCount: '2',
    weakCount: '1',
  });
  assert.equal(underSum.isMatched, false);
  assert.equal(underSum.sumOfLevels, 23);
  assert.equal(underSum.difference, 7);

  // Validation rejects mismatched sum and accepts matched sum
  const sampleForm3 = createSampleTeacherReportFormData(
    'learning-outcomes-analysis'
  );
  assert.equal(validateTeacherProfessionalReport(sampleForm3).valid, true);

  const invalidForm3 = {
    ...sampleForm3,
    excellentCount: '20', // makes sum 38 != 30
  };
  const checkInvalid = validateTeacherProfessionalReport(invalidForm3);
  assert.equal(checkInvalid.valid, false);
  assert.ok(checkInvalid.errors.levelsDistribution);
});

test('Form 3 (تحليل نتائج التعلم): conditional fields for single-exam vs full-semester', () => {
  const settings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة النموذجية',
    principalName: 'أ. أحمد العتيبي',
  };

  // 1. Single exam mode
  const singleExamData = createSampleTeacherReportFormData(
    'learning-outcomes-analysis',
    settings
  );
  assert.equal(singleExamData.analysisScope, 'single-exam');
  const singleDoc = buildTeacherReportDocumentFromForm(
    singleExamData,
    settings,
    { templateStyle: 'waves' }
  );
  assert.equal(
    singleDoc.basicFields.some((f) => f.label === 'اسم الاختبار أو التقويم'),
    true
  );
  assert.equal(
    singleDoc.basicFields.some((f) => f.label === 'تاريخ التطبيق'),
    true
  );
  assert.equal(
    singleDoc.sections.some((s) => s.id === 'sec-semester-method'),
    false
  );

  // 2. Full semester mode
  const fullSemesterData = {
    ...singleExamData,
    analysisScope: 'full-semester' as const,
    examName: '', // Not required in full-semester mode!
    applicationDate: '', // Not required in full-semester mode!
  };
  const checkFullSemester = validateTeacherProfessionalReport(fullSemesterData);
  assert.equal(checkFullSemester.valid, true);

  const fullSemesterDoc = buildTeacherReportDocumentFromForm(
    fullSemesterData,
    settings,
    { templateStyle: 'waves' }
  );
  assert.equal(
    fullSemesterDoc.basicFields.some(
      (f) => f.label === 'اسم الاختبار أو التقويم'
    ),
    false,
    'Single-exam fields must not appear in full-semester PDF'
  );
  assert.equal(
    fullSemesterDoc.sections.some((s) => s.id === 'sec-semester-method'),
    true,
    'Full-semester assessment mechanism section must appear'
  );
});

test('Form 5 (تقرير إنجاز مهني): conditional «إنجاز آخر» field & optional subject/stage/grade omitted from PDF when empty', () => {
  assert.equal(PROFESSIONAL_ACHIEVEMENT_TYPES.length, 7);
  assert.equal(
    PROFESSIONAL_ACHIEVEMENT_TYPES.includes('إنجاز آخر'),
    true
  );

  const settings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة النموذجية',
    principalName: 'أ. أحمد العتيبي',
  };

  // Leave optional fields (subject, stage, grade) empty
  const form5OptionalEmpty = {
    ...createSampleTeacherReportFormData('professional-achievement', settings),
    subject: '',
    stage: '',
    grade: '',
  };

  const validation1 = validateTeacherProfessionalReport(form5OptionalEmpty);
  assert.equal(
    validation1.valid,
    true,
    'Optional subject, stage, and grade must not be required'
  );

  const doc1 = buildTeacherReportDocumentFromForm(
    form5OptionalEmpty,
    settings,
    { templateStyle: 'waves' }
  );
  assert.equal(
    doc1.basicFields.some((f) => f.label === 'المادة الدراسية'),
    false,
    'Empty subject must be omitted from PDF basicFields'
  );
  assert.equal(
    doc1.basicFields.some((f) => f.label === 'المرحلة الدراسية'),
    false,
    'Empty stage must be omitted from PDF basicFields'
  );
  assert.equal(
    doc1.basicFields.some((f) => f.label === 'الصف'),
    false,
    'Empty grade must be omitted from PDF basicFields'
  );

  // Conditional 'إنجاز آخر' requires customAchievementType
  const form5OtherInvalid = {
    ...form5OptionalEmpty,
    achievementType: 'إنجاز آخر' as const,
    customAchievementType: '   ',
  };
  const validation2 = validateTeacherProfessionalReport(form5OtherInvalid);
  assert.equal(validation2.valid, false);
  assert.ok(validation2.errors.customAchievementType);

  const form5OtherValid = {
    ...form5OtherInvalid,
    customAchievementType: 'تأليف دليل تطبيقي للمختبرات الافتراضية',
  };
  const validation3 = validateTeacherProfessionalReport(form5OtherValid);
  assert.equal(validation3.valid, true);

  const doc2 = buildTeacherReportDocumentFromForm(form5OtherValid, settings, {
    templateStyle: 'waves',
  });
  const typeField = doc2.basicFields.find((f) => f.label === 'نوع الإنجاز');
  assert.equal(
    typeField?.value,
    'تأليف دليل تطبيقي للمختبرات الافتراضية'
  );
});

test('LocalStorage persistence: saves, restores, and resets drafts independently for all 5 forms', () => {
  const store = createMemoryStorage();
  const settings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    userName: 'أ. محمد الشهري',
  };

  const formIds: TeacherProfessionalReportId[] = [
    'strategy-implementation',
    'problem-remediation',
    'learning-outcomes-analysis',
    'distinguished-practice',
    'professional-achievement',
  ];

  for (const id of formIds) {
    const initial = loadTeacherReportDraftFromStorage(id, settings, store);
    assert.equal(initial.formId, id);
    assert.equal(initial.teacherName, 'أ. محمد الشهري');

    const sample = createSampleTeacherReportFormData(id, settings);
    saveTeacherReportDraftToStorage(id, sample, store);

    const restored = loadTeacherReportDraftFromStorage(id, settings, store);
    assert.deepEqual(restored, sample);
  }

  // Clearing one form does not affect the other 4 forms
  clearTeacherReportDraftInStorage('strategy-implementation', settings, store);
  const clearedForm1 = loadTeacherReportDraftFromStorage(
    'strategy-implementation',
    settings,
    store
  );
  assert.equal(clearedForm1.strategyName, '');

  const intactForm2 = loadTeacherReportDraftFromStorage(
    'problem-remediation',
    settings,
    store
  );
  assert.ok(intactForm2.remediationTopic.length > 0);
});

test('All 5 forms × 3 Templates (waves / waves-2 / geometric) × 3 Color Systems (green / blue / slate) generate valid A4 PDFs with header repetition and last-page principal signoff', async () => {
  const formIds: TeacherProfessionalReportId[] = [
    'strategy-implementation',
    'problem-remediation',
    'learning-outcomes-analysis',
    'distinguished-practice',
    'professional-achievement',
  ];
  const templates: TeacherPdfTemplateStyle[] = ['waves', 'waves-2', 'geometric'];
  const colors: TeacherPdfColorSystem[] = ['green', 'blue', 'slate'];

  const settingsWithPrincipal = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة النموذجية',
    educationDepartment: 'الإدارة العامة للتعليم',
    principalName: 'أ. أحمد العتيبي',
    userName: 'أ. عبدالرحمن القحطاني',
  };

  for (const formId of formIds) {
    const sampleData = createSampleTeacherReportFormData(
      formId,
      settingsWithPrincipal
    );
    const validation = validateTeacherProfessionalReport(sampleData);
    assert.equal(validation.valid, true, `Sample data for ${formId} must be valid`);

    for (const tpl of templates) {
      for (const col of colors) {
        const doc = buildTeacherReportDocumentFromForm(
          sampleData,
          settingsWithPrincipal,
          {
            templateStyle: tpl,
            colorSystem: col,
          }
        );

        assert.equal(doc.templateStyle, tpl);
        assert.equal(doc.colorSystem, col);
        assert.ok(doc.basicFields.length > 0);
        assert.ok(doc.sections.length > 0);

        const pages = paginateTeacherReportBlocks(doc, settingsWithPrincipal);
        assert.ok(pages.length >= 1);

        // Principal sign-off appears ONLY on the last page
        for (let i = 0; i < pages.length - 1; i++) {
          assert.equal(
            pages[i].blocks.some((b) => b.kind === 'signoff'),
            false,
            `Signoff must not appear on non-last page ${i + 1} for ${formId} (${tpl})`
          );
        }
        const lastPage = pages[pages.length - 1];
        assert.equal(
          lastPage.blocks.some((b) => b.kind === 'signoff'),
          true,
          `Signoff must appear on last page for ${formId} (${tpl})`
        );

        const pdfResult = await generateTeacherReportPdf(
          doc,
          settingsWithPrincipal
        );
        assert.equal(pdfResult.pageCount, pages.length);
        assert.equal(pdfResult.linkAnnotationsCount, 1);

        const pdfStr = new TextDecoder('latin1').decode(pdfResult.pdfBytes);
        assert.ok(pdfStr.startsWith('%PDF-1.4'));
        assert.ok(pdfStr.includes('/Subtype /Link'));
      }
    }

    // Verify that when principalName is empty in settings, signoff is omitted
    const settingsWithoutPrincipal = {
      ...settingsWithPrincipal,
      principalName: '',
    };
    const docNoPrincipal = buildTeacherReportDocumentFromForm(
      sampleData,
      settingsWithoutPrincipal
    );
    const pagesNoPrincipal = paginateTeacherReportBlocks(
      docNoPrincipal,
      settingsWithoutPrincipal
    );
    assert.equal(
      pagesNoPrincipal.some((p) => p.blocks.some((b) => b.kind === 'signoff')),
      false,
      `Signoff must be omitted when principalName is empty for ${formId}`
    );

    // Verify that initial empty form data produces no empty sections
    const emptyData = createInitialTeacherReportData(
      formId,
      settingsWithoutPrincipal
    );
    const emptyDoc = buildTeacherReportDocumentFromForm(
      emptyData,
      settingsWithoutPrincipal
    );
    assert.equal(
      emptyDoc.sections.some(
        (s) =>
          (s.type === 'text' && !s.content?.trim()) ||
          (s.type === 'list' && (!s.items || s.items.length === 0))
      ),
      false,
      `No empty text/list sections should ever be generated for ${formId}`
    );
  }
});
