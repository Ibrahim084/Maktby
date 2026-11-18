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
  buildTeacherPlanDocumentFromForm,
  clearTeacherPlanDraftInStorage,
  createEmptyEnrichmentActivity,
  createEmptyGroupRemedialSkill,
  createEmptyIndividualRemedialGoal,
  createEmptyProfessionalDevGoal,
  createEmptyStudentProduct,
  createEmptyWeeklyLesson,
  createInitialTeacherPlanData,
  createSampleTeacherPlanFormData,
  getPlansForPath,
  loadTeacherPlanDraftFromStorage,
  saveTeacherPlanDraftToStorage,
  TEACHER_PLANS_CATALOG,
  TeacherPlanFormId,
  validateTeacherPlanForm,
} from './teacherPlansEngine';

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

test('Group «الخطط» catalog defines the exact 5 approved models across the 2 paths', () => {
  assert.equal(TEACHER_PLANS_CATALOG.length, 5);

  const teacherPlans = getPlansForPath('teacher-plans');
  assert.equal(teacherPlans.length, 2);
  assert.deepEqual(
    teacherPlans.map((p) => p.title),
    [
      'خطة التطوير المهني وتحسين الأداء التدريسي',
      'الخطة الأسبوعية للمعلم',
    ]
  );

  const studentPlans = getPlansForPath('student-plans');
  assert.equal(studentPlans.length, 3);
  assert.deepEqual(
    studentPlans.map((p) => p.title),
    [
      'الخطة العلاجية الفردية',
      'الخطة العلاجية الجماعية',
      'الخطة الإثرائية',
    ]
  );
});

test('Model 1 (خطة التطوير المهني): supports custom need diagnosis, multiple goals, default monthly follow-up, and optional principal notes/approval', () => {
  const settings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة الفيصلية المتوسطة',
    principalName: 'أ. خالد بن سعد القحطاني',
  };

  const data = createSampleTeacherPlanFormData(
    'professional-development-plan',
    settings
  );
  assert.equal(data.followUpFrequency, 'شهرية');
  assert.equal(data.goals.length, 2);

  // Add a 3rd goal dynamically
  data.goals.push({
    ...createEmptyProfessionalDevGoal(3),
    goalTitle: 'تطوير مهارات بناء المهام الأدائية',
    currentLevel: 'متوسط',
    targetLevel: 'متميز',
    actions: 'تصميم ٣ مهام أدائية فصلية',
    resources: 'دليل التقويم',
    indicators: 'جودة مشاريع الطلاب',
    result: 'تحقق بنسبة ٩٠٪',
  });

  // Test custom need diagnosis
  data.needDiagnosisCategory = 'احتياج آخر';
  data.customNeedDiagnosis = 'توظيف المختبرات الافتراضية ثلاثية الأبعاد';

  const validation = validateTeacherPlanForm(
    'professional-development-plan',
    data
  );
  assert.equal(validation.valid, true);

  const docWithPrincipal = buildTeacherPlanDocumentFromForm(
    'professional-development-plan',
    data,
    settings
  );
  assert.equal(
    docWithPrincipal.reportMainTitle,
    'توظيف المختبرات الافتراضية ثلاثية الأبعاد'
  );
  assert.equal(docWithPrincipal.includePrincipalSignoff, true);
  assert.ok(
    docWithPrincipal.sections.some((s) => s.id === 'principalNotes'),
    'Principal notes section should be present when filled'
  );

  // When principal notes are empty and approval is unchecked
  data.principalNotes = '';
  data.includePrincipalApproval = false;
  const docWithoutPrincipal = buildTeacherPlanDocumentFromForm(
    'professional-development-plan',
    data,
    settings
  );
  assert.equal(docWithoutPrincipal.includePrincipalSignoff, false);
  assert.ok(
    !docWithoutPrincipal.sections.some((s) => s.id === 'principalNotes'),
    'Principal notes section should be omitted when empty'
  );
});

test('Model 2 (الخطة الأسبوعية للمعلم): supports multiple lessons, optional teacher notes, and has NO execution tracking log', () => {
  const settings = { ...DEFAULT_SCHOOL_SETTINGS };
  const data = createSampleTeacherPlanFormData('weekly-teacher-plan', settings);

  data.lessons.push({
    ...createEmptyWeeklyLesson(3),
    lessonTitle: 'الدرس الثالث: التفاعلات الكيميائية والطاقة',
    learningOutcomes: 'التمييز بين التفاعلات الطاردة والماصة للحرارة',
    strategiesAndActivities: 'التجربة الاستهلالية والعصف الذهني',
    toolsAndResources: 'كواشف كيميائية وميزان حرارة',
    assessmentMethods: 'ورقة عمل تفاعلية',
    homeworkOrTasks: 'مراجعة الفصل ص ٦٢',
  });

  const validation = validateTeacherPlanForm('weekly-teacher-plan', data);
  assert.equal(validation.valid, true);

  const doc = buildTeacherPlanDocumentFromForm(
    'weekly-teacher-plan',
    data,
    settings
  );
  assert.equal(doc.sections.length, 4); // 3 lessons + 1 teacherNotes

  // Verify no execution status fields exist
  const allTitlesAndLabels = JSON.stringify(doc);
  assert.ok(!allTitlesAndLabels.includes('ما تم تنفيذه'));
  assert.ok(!allTitlesAndLabels.includes('لم يتم تنفيذه'));

  // When teacherNotes is empty, it is omitted
  data.teacherNotes = '';
  const docNoNotes = buildTeacherPlanDocumentFromForm(
    'weekly-teacher-plan',
    data,
    settings
  );
  assert.equal(docNoNotes.sections.length, 3);
});

test('Model 3 (الخطة العلاجية الفردية): conditional weakness source, conditional diagnostic test, 5-point scale, and strict 1–2 page limit', () => {
  const settings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'مدرسة الرواد الابتدائية',
    principalName: 'أ. فهد العتيبي',
  };

  const data = createSampleTeacherPlanFormData(
    'individual-remedial-plan',
    settings
  );

  // Standard sample data should fit on 1 page (target: 1 page)
  const sampleDoc = buildTeacherPlanDocumentFromForm(
    'individual-remedial-plan',
    data,
    settings
  );
  const samplePages = paginateTeacherReportBlocks(sampleDoc, settings);
  assert.equal(samplePages.length, 1);

  // Test diagnostic test = 'لا'
  data.hasDiagnosticTest = 'لا';
  const docNoDiag = buildTeacherPlanDocumentFromForm(
    'individual-remedial-plan',
    data,
    settings
  );
  const diagField = docNoDiag.basicFields.find(
    (f) => f.id === 'diagnosticTestInfo'
  );
  assert.equal(diagField?.value, 'لا');

  // Add 6 goals and long text to verify it never exceeds 2 pages max
  for (let i = 3; i <= 6; i++) {
    data.goals.push({
      ...createEmptyIndividualRemedialGoal(i),
      goalText: `هدف علاجي إضافي رقم ${i} لمعالجة مهارة العمليات الحسابية وحل المسائل اللفظية`,
      remedialActions: 'تدريبات مكثفة وأوراق عمل علاجية فردية بإشراف المعلم',
      duration: 'أسبوعان',
    });
  }
  const heavyDoc = buildTeacherPlanDocumentFromForm(
    'individual-remedial-plan',
    data,
    settings
  );
  const heavyPages = paginateTeacherReportBlocks(heavyDoc, settings);
  assert.ok(
    heavyPages.length <= 2,
    `Individual remedial plan must not exceed 2 pages, got ${heavyPages.length}`
  );
});

test('Model 4 (الخطة العلاجية الجماعية): multiple skills with pre/post descriptive evaluation, impact metrics, and max 3 pages', () => {
  const settings = { ...DEFAULT_SCHOOL_SETTINGS };
  const data = createSampleTeacherPlanFormData('group-remedial-plan', settings);

  for (let i = 3; i <= 6; i++) {
    data.skills.push({
      ...createEmptyGroupRemedialSkill(i),
      skillName: `مهارة لغوية مستهدفة رقم ${i}`,
      preAssessment: 'ضعف واضح في التطبيق الكتابي قبل البدء بالمعالجة',
      postAssessment: 'تحسن ملحوظ وإتقان القاعدة بعد التدريبات الجماعية',
    });
  }

  const validation = validateTeacherPlanForm('group-remedial-plan', data);
  assert.equal(validation.valid, true);

  const doc = buildTeacherPlanDocumentFromForm(
    'group-remedial-plan',
    data,
    settings
  );
  const pages = paginateTeacherReportBlocks(doc, settings);
  assert.ok(
    pages.length <= 3,
    `Group remedial plan must not exceed 3 pages, got ${pages.length}`
  );
});

test('Model 5 (الخطة الإثرائية): multi-select enrichment types, multiple activities, independent «منتجات الطلاب وإنجازاتهم» section, and max 3 pages', () => {
  const settings = { ...DEFAULT_SCHOOL_SETTINGS };
  const data = createSampleTeacherPlanFormData('enrichment-plan', settings);

  data.enrichmentTypes.push('نوع آخر');
  data.customEnrichmentType = 'برمجة الروبوت والذكاء الاصطناعي';

  data.activities.push({
    ...createEmptyEnrichmentActivity(3),
    activityTitle: 'تصميم خوارزمية ذكية لتصنيف البيانات',
    activityDescription: 'بناء نموذج برمجي تطبيقي بلغة بايثون',
    executionMethod: 'معمل الحاسب الآلي ومجموعات العمل',
  });

  data.studentProducts.push({
    ...createEmptyStudentProduct(3),
    productName: 'تطبيق المساعد العلمي المدرسي',
    productType: 'مشروع برمجي',
    productDescription: 'برنامج تفاعلي يجيب عن تساؤلات التجارب العلمية',
    participatingStudents: 'جميع طلاب المجموعة الإثرائية',
  });

  const validation = validateTeacherPlanForm('enrichment-plan', data);
  assert.equal(validation.valid, true);

  const doc = buildTeacherPlanDocumentFromForm(
    'enrichment-plan',
    data,
    settings
  );
  const prodSection = doc.sections.find(
    (s) => s.id === 'studentProductsSection'
  );
  assert.ok(prodSection);
  assert.equal(prodSection.title, 'منتجات الطلاب وإنجازاتهم');

  const pages = paginateTeacherReportBlocks(doc, settings);
  assert.ok(
    pages.length <= 3,
    `Enrichment plan must not exceed 3 pages, got ${pages.length}`
  );
});

test('LocalStorage persistence: saves, restores, and resets drafts independently for all 5 plan models', () => {
  const storage = createMemoryStorage();
  const allIds: TeacherPlanFormId[] = [
    'professional-development-plan',
    'weekly-teacher-plan',
    'individual-remedial-plan',
    'group-remedial-plan',
    'enrichment-plan',
  ];

  for (const id of allIds) {
    const sample = createSampleTeacherPlanFormData(id, DEFAULT_SCHOOL_SETTINGS);
    sample.planTitle = `عنوان مخصص — ${id}`;
    saveTeacherPlanDraftToStorage(id, sample, storage);

    const loaded = loadTeacherPlanDraftFromStorage(
      id,
      DEFAULT_SCHOOL_SETTINGS,
      storage
    );
    assert.equal(loaded.planTitle, `عنوان مخصص — ${id}`);

    clearTeacherPlanDraftInStorage(id, storage);
    const resetLoaded = loadTeacherPlanDraftFromStorage(
      id,
      DEFAULT_SCHOOL_SETTINGS,
      storage
    );
    const fresh = createInitialTeacherPlanData(id, DEFAULT_SCHOOL_SETTINGS);
    assert.equal(resetLoaded.planTitle, fresh.planTitle);
  }
});

test('All 5 plan models generate valid A4 PDF binaries across all 3 templates and 3 color systems', async () => {
  const settings = {
    ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: 'ثانوية الملك فهد النموذجية',
    educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
    principalName: 'أ. عبدالرحمن بن محمد السديري',
  };

  const allIds: TeacherPlanFormId[] = [
    'professional-development-plan',
    'weekly-teacher-plan',
    'individual-remedial-plan',
    'group-remedial-plan',
    'enrichment-plan',
  ];
  const templates: TeacherPdfTemplateStyle[] = [
    'waves',
    'waves-2',
    'geometric',
  ];
  const colors: TeacherPdfColorSystem[] = ['green', 'blue', 'slate'];

  for (const id of allIds) {
    const sample = createSampleTeacherPlanFormData(id, settings);
    for (const tpl of templates) {
      for (const col of colors) {
        const doc = buildTeacherPlanDocumentFromForm(id, sample, settings, {
          templateStyle: tpl,
          colorSystem: col,
        });
        const pdfResult = await generateTeacherReportPdf(doc, settings);
        assert.ok(pdfResult.pdfBytes.length > 500);
        const header = new TextDecoder().decode(
          pdfResult.pdfBytes.slice(0, 8)
        );
        assert.ok(header.startsWith('%PDF-1.'));
      }
    }
  }
});
