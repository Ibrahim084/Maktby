import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import { decodeQrMatrix, generateQrMatrix } from './qrCodeGenerator';
import {
  createDefaultSampleEvidencePhotos,
  generateTeacherReportPdf,
  normalizeTeacherEvidence,
  paginateTeacherReportBlocks,
} from './teacherPdfEngine';
import {
  buildTeacherEducationalInitiativeDocument,
  createInitialEducationalInitiativeState,
  createSampleEducationalInitiativeState,
  doesBeneficiariesRequireGrades,
  INITIATIVE_BENEFICIARIES_OPTIONS,
  INITIATIVE_EXECUTION_NATURE_OPTIONS,
  INITIATIVE_SCOPE_OPTIONS,
  INITIATIVE_TYPE_OPTIONS,
  isValidElectronicUrl,
  resolveBeneficiariesDisplayValue,
  resolveInitiativeTypeDisplayValue,
  TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG,
  TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP,
  validateEducationalInitiativeState,
  validateElectronicLinks,
} from './teacherProgramsAndActivitiesEngine';

const mockSettings: SchoolSettings = {
  ...DEFAULT_SCHOOL_SETTINGS,
  educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
  schoolName: 'متوسطة الفيصلية النموذجية',
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

test('Group 6 metadata and catalog contain only the single approved model «توثيق مبادرة تعليمية»', () => {
  assert.equal(
    TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.id,
    'programs-and-activities'
  );
  assert.equal(
    TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.title,
    'البرامج والأنشطة التعليمية'
  );
  assert.equal(TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.length, 1);
  assert.equal(
    TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG[0].id,
    'educational-initiative-documentation'
  );
  assert.equal(
    TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG[0].title,
    'توثيق مبادرة تعليمية'
  );

  // Verify approved option lists match exact specifications
  assert.deepEqual(INITIATIVE_SCOPE_OPTIONS, [
    'صفية',
    'على مستوى المدرسة',
    'عامة',
  ]);
  assert.deepEqual(INITIATIVE_BENEFICIARIES_OPTIONS, [
    'طلاب صف محدد',
    'عدة صفوف',
    'طلاب المدرسة',
    'المعلمون',
    'طلاب ومعلمو المدرسة',
    'فئة أخرى',
  ]);
  assert.deepEqual(INITIATIVE_TYPE_OPTIONS, [
    'تعليمية',
    'علاجية',
    'إثرائية',
    'تقنية ورقمية',
    'قرائية',
    'مهارية',
    'تحفيزية',
    'نوع آخر',
  ]);
  assert.deepEqual(INITIATIVE_EXECUTION_NATURE_OPTIONS, [
    'مبادرة فردية',
    'مبادرة جماعية',
  ]);
});

test('1. Individual Initiative (مبادرة فردية): full fields validation, executor name, and no forced team list', () => {
  const sample = createSampleEducationalInitiativeState(mockSettings, {
    executionNature: 'مبادرة فردية',
  });
  sample.participants = []; // Ensure individual initiative never requires participants array

  const errors = validateEducationalInitiativeState(sample);
  assert.equal(errors.length, 0);

  const doc = buildTeacherEducationalInitiativeDocument(sample, mockSettings);
  assert.equal(doc.reportTypeLabel, 'توثيق مبادرة تعليمية');
  assert.equal(
    doc.reportMainTitle,
    'مبادرة «تحدي الإتقان الصباحي» لتعزيز المفاهيم الأساسية ومهارات التفكير المنطقي'
  );

  // Basic fields check (including الصف المستفيد because beneficiaries === 'طلاب صف محدد')
  const basicLabels = doc.basicFields.map((f) => f.label);
  assert.deepEqual(basicLabels, [
    'نطاق المبادرة',
    'نوع المبادرة',
    'المستفيدون من المبادرة',
    'الصف المستفيد',
    'تاريخ التنفيذ أو الفترة الزمنية',
    'مكان التنفيذ',
  ]);

  // Execution nature section for individual initiative
  assert.equal(doc.sections[0].title, 'طبيعة تنفيذ المبادرة والمنفذ');
  const natureFields = doc.sections[0].fields || [];
  assert.equal(natureFields.length, 2);
  assert.equal(natureFields[0].label, 'طبيعة تنفيذ المبادرة');
  assert.equal(natureFields[0].value, 'مبادرة فردية');
  assert.equal(natureFields[1].label, 'اسم منفذ المبادرة');
  assert.equal(natureFields[1].value, 'أ. عبدالرحمن بن خالد الغامدي');

  // Details section check
  assert.equal(
    doc.sections[1].title,
    'تفاصيل المبادرة التعليمية وآلية تنفيذها وأثرها'
  );
  const detailLabels = (doc.sections[1].fields || []).map((f) => f.label);
  assert.deepEqual(detailLabels, [
    'الهدف من المبادرة',
    'وصف المبادرة وفكرتها',
    'آلية التنفيذ',
    'أبرز النتائج أو الأثر',
  ]);

  // Additional notes present when filled
  assert.equal(doc.sections.length, 3);
  assert.equal(doc.sections[2].title, 'ملاحظات إضافية');
  assert.equal(doc.principalName, 'أ. فهد بن عبدالله السالم');
  assert.equal(doc.includePrincipalSignoff, true);
});

test('2. Group Initiative (مبادرة جماعية): adding, editing, deleting multiple participants and rendering organized list in PDF', () => {
  const sample = createSampleEducationalInitiativeState(mockSettings, {
    executionNature: 'مبادرة جماعية',
  });

  // When participants are empty in group mode, validation fails
  sample.participants = [{ id: 'p1', name: '   ' }];
  const errorsEmpty = validateEducationalInitiativeState(sample);
  assert.ok(
    errorsEmpty.some((e) =>
      e.includes('إضافة اسم مشارك واحد على الأقل في المبادرة الجماعية')
    )
  );

  // Add 3 participants, edit 2nd, delete 1 -> leaves 3 organized participants
  sample.participants = [
    { id: 'p1', name: 'أ. عبدالرحمن بن خالد الغامدي' },
    { id: 'p2', name: 'أ. خالد بن سعد الدوسري' },
    { id: 'p3', name: 'أ. فهد بن عبدالله الحربي' },
    { id: 'p4', name: 'أ. سلطان بن محمد القحطاني' },
  ];
  // Simulate deleting p3 and editing p2
  sample.participants = sample.participants
    .filter((p) => p.id !== 'p3')
    .map((p) =>
      p.id === 'p2' ? { ...p, name: 'أ. خالد بن سعد الدوسري (معدّل)' } : p
    );

  const errorsValid = validateEducationalInitiativeState(sample);
  assert.equal(errorsValid.length, 0);

  const doc = buildTeacherEducationalInitiativeDocument(sample, mockSettings);
  assert.equal(doc.sections[0].title, 'طبيعة تنفيذ المبادرة وأسماء المشاركين');
  const pFields = doc.sections[0].fields || [];
  assert.equal(pFields.length, 4); // nature + 3 participants
  assert.equal(pFields[0].label, 'طبيعة تنفيذ المبادرة');
  assert.equal(pFields[0].value, 'مبادرة جماعية');
  assert.equal(pFields[1].label, 'المشارك (1)');
  assert.equal(pFields[1].value, 'أ. عبدالرحمن بن خالد الغامدي');
  assert.equal(pFields[2].label, 'المشارك (2)');
  assert.equal(pFields[2].value, 'أ. خالد بن سعد الدوسري (معدّل)');
  assert.equal(pFields[3].label, 'المشارك (3)');
  assert.equal(pFields[3].value, 'أ. سلطان بن محمد القحطاني');
});

test('3. Beneficiaries & Initiative Types options including conditional grades and «فئة أخرى» / «نوع آخر»', () => {
  assert.equal(doesBeneficiariesRequireGrades('طلاب صف محدد'), true);
  assert.equal(doesBeneficiariesRequireGrades('عدة صفوف'), true);
  assert.equal(doesBeneficiariesRequireGrades('طلاب المدرسة'), false);
  assert.equal(doesBeneficiariesRequireGrades('المعلمون'), false);
  assert.equal(doesBeneficiariesRequireGrades('طلاب ومعلمو المدرسة'), false);
  assert.equal(doesBeneficiariesRequireGrades('فئة أخرى'), false);

  const state = createSampleEducationalInitiativeState(mockSettings);

  // Test «عدة صفوف» requires targetGradeOrGrades
  state.beneficiaries = 'عدة صفوف';
  state.targetGradeOrGrades = '';
  assert.ok(
    validateEducationalInitiativeState(state).some((e) =>
      e.includes('تحديد الصفوف المستفيدة')
    )
  );
  state.targetGradeOrGrades = 'الأول والثاني المتوسط';
  assert.equal(validateEducationalInitiativeState(state).length, 0);
  const docMultiGrades = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );
  assert.ok(
    docMultiGrades.basicFields.some(
      (f) => f.label === 'الصفوف المستفيدة' && f.value === 'الأول والثاني المتوسط'
    )
  );

  // Test «فئة أخرى» requires customBeneficiaries and omits grade field
  state.beneficiaries = 'فئة أخرى';
  state.customBeneficiaries = '';
  assert.ok(
    validateEducationalInitiativeState(state).some((e) =>
      e.includes('كتابة الفئة المستفيدة')
    )
  );
  state.customBeneficiaries = 'أولياء الأمور واللجنة المجتمعية بالمدرسة';
  assert.equal(
    resolveBeneficiariesDisplayValue(state),
    'أولياء الأمور واللجنة المجتمعية بالمدرسة'
  );

  // Test «نوع آخر» requires customInitiativeType
  state.initiativeType = 'نوع آخر';
  state.customInitiativeType = '';
  assert.ok(
    validateEducationalInitiativeState(state).some((e) =>
      e.includes('كتابة نوع المبادرة المخصص')
    )
  );
  state.customInitiativeType = 'مبادرة قيمية وتطوعية طلابية';
  assert.equal(
    resolveInitiativeTypeDisplayValue(state),
    'مبادرة قيمية وتطوعية طلابية'
  );
  assert.equal(validateEducationalInitiativeState(state).length, 0);

  const docCustom = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );
  assert.equal(
    docCustom.basicFields.find((f) => f.label === 'المستفيدون من المبادرة')
      ?.value,
    'أولياء الأمور واللجنة المجتمعية بالمدرسة'
  );
  assert.equal(
    docCustom.basicFields.find((f) => f.label === 'نوع المبادرة')?.value,
    'مبادرة قيمية وتطوعية طلابية'
  );
  // Grade field must NOT be present when beneficiaries === 'فئة أخرى'
  assert.equal(
    docCustom.basicFields.some(
      (f) => f.label === 'الصف المستفيد' || f.label === 'الصفوف المستفيدة'
    ),
    false
  );
});

test('4, 5, 6. Leaving optional notes empty and testing 0, 1, 2 photos with replace & delete', async () => {
  const state = createSampleEducationalInitiativeState(mockSettings);
  state.additionalNotes = '   ';
  state.evidencePhotos = [];
  state.evidenceLinks = [];

  assert.equal(validateEducationalInitiativeState(state).length, 0);
  const docEmpty = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );

  // Additional notes section omitted -> only 2 sections
  assert.equal(docEmpty.sections.length, 2);
  assert.equal(
    docEmpty.sections.some((s) => s.title === 'ملاحظات إضافية'),
    false
  );

  // Evidence section completely hidden when 0 photos & 0 links
  const norm0 = normalizeTeacherEvidence(docEmpty);
  assert.equal(norm0.hasAny, false);
  const pages0 = paginateTeacherReportBlocks(docEmpty, mockSettings);
  assert.equal(
    pages0.some((p) => p.blocks.some((b) => b.kind === 'evidence')),
    false
  );

  // Upload 1 photo -> evidence block appears with 1 photo
  const samplePhotos = createDefaultSampleEvidencePhotos('green');
  state.evidencePhotos = [samplePhotos[0]];
  const doc1Photo = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );
  assert.equal(doc1Photo.evidencePhotos?.length, 1);
  assert.equal(normalizeTeacherEvidence(doc1Photo).photos.length, 1);

  // Upload 2nd photo -> 2 photos
  state.evidencePhotos = [samplePhotos[0], samplePhotos[1]];
  const doc2Photos = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );
  assert.equal(doc2Photos.evidencePhotos?.length, 2);

  // Replace 1st photo and delete 2nd photo
  const customDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  state.evidencePhotos = [{ id: 'replaced-photo-1', imageDataUrl: customDataUrl }];
  const docAfterReplaceDelete = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );
  assert.equal(docAfterReplaceDelete.evidencePhotos?.length, 1);
  assert.equal(
    docAfterReplaceDelete.evidencePhotos?.[0].imageDataUrl,
    customDataUrl
  );
});

test('7, 8, 9, 10, 11. QR Links (0, 1, 2 links), URL validation, QR scannability, clickable PDF links, and all 3 templates', async () => {
  const state = createSampleEducationalInitiativeState(mockSettings, {
    executionNature: 'مبادرة جماعية',
  });
  state.evidencePhotos = [];

  // Invalid link blocked
  state.evidenceLinks = [{ id: 'l1', url: 'bad-url' }];
  assert.ok(
    validateEducationalInitiativeState(state).some((e) =>
      e.includes('صيغة الرابط الإلكتروني (1) غير صحيحة')
    )
  );
  assert.equal(isValidElectronicUrl('bad-url'), false);
  assert.equal(validateElectronicLinks([{ id: 'l1', url: '' }]).length, 1);

  // 1 valid link -> 1 QR code, scannable, clickable in PDF
  const url1 = 'https://madrasati.sa/initiatives/morning-mastery-1447';
  state.evidenceLinks = [{ id: 'l1', url: url1 }];
  assert.equal(validateEducationalInitiativeState(state).length, 0);
  assert.equal(decodeQrMatrix(generateQrMatrix(url1, 2), 2), url1);

  const doc1Link = buildTeacherEducationalInitiativeDocument(
    state,
    mockSettings
  );
  assert.equal(doc1Link.evidenceLinks?.length, 1);
  const pdf1 = await generateTeacherReportPdf(doc1Link, mockSettings);
  assert.equal(pdf1.linkAnnotationsCount, 1);
  const pdfStr1 = new TextDecoder('latin1').decode(pdf1.pdfBytes);
  assert.ok(pdfStr1.includes(`/URI (${url1})`));

  // 2 valid links across all 3 templates and 3 color systems
  const url2 = 'https://moe.gov.sa/ar/education/school-initiatives-1447';
  state.evidenceLinks = [
    { id: 'l1', url: url1 },
    { id: 'l2', url: url2 },
  ];
  assert.equal(validateEducationalInitiativeState(state).length, 0);
  assert.equal(decodeQrMatrix(generateQrMatrix(url2, 2), 2), url2);

  const templates: TeacherPdfTemplateStyle[] = ['waves', 'waves-2', 'geometric'];
  const colors: TeacherPdfColorSystem[] = ['green', 'blue', 'slate'];

  for (const tpl of templates) {
    for (const col of colors) {
      const doc2 = buildTeacherEducationalInitiativeDocument(
        state,
        mockSettings,
        {
          templateStyle: tpl,
          colorSystem: col,
        }
      );
      const pdf2 = await generateTeacherReportPdf(doc2, mockSettings);
      assert.ok(pdf2.pageCount >= 1);
      assert.equal(pdf2.linkAnnotationsCount, 2);
      const pdfStr2 = new TextDecoder('latin1').decode(pdf2.pdfBytes);
      assert.ok(pdfStr2.includes('/Subtype /Link'));
      assert.ok(pdfStr2.includes(`/URI (${url1})`));
      assert.ok(pdfStr2.includes(`/URI (${url2})`));
    }
  }

  assert.equal(
    createInitialEducationalInitiativeState(mockSettings).formId,
    'educational-initiative-documentation'
  );
});
