import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from '../data/sections';
import { createEngineVerificationForm, getFormsForSection } from '../forms/registry';
import {
  PD_SEMESTER_FINAL_REPORT_FORM,
  PD_TRAINEE_CERTIFICATE_FORM,
  PD_TRAINER_CERTIFICATE_FORM,
  PD_TRAINING_EXECUTION_FORM,
} from '../forms/professionalDevelopmentForms';
import { PD_SEMESTER_OPTIONS } from '../forms/professionalDevelopmentOptions';
import {
  buildCourseFromExecutionValues,
  deleteSavedCourseFromRegistry,
  filterCoursesByAcademicPeriod,
  loadSavedCoursesFromStorage,
  SAVED_COURSES_STORAGE_KEY,
  saveCourseToLocalRegistry,
  updateSavedCourseInRegistry,
} from './coursesRegistryStorage';
import {
  buildOfficialCertificateContent,
  buildPdfFromJpegBytes,
  CERTIFICATE_RECIPIENT_MAX_FONT_PX,
  CERTIFICATE_RECIPIENT_MIN_FONT_PX,
  CERTIFICATE_RECIPIENT_SAFE_WIDTH_PX,
  computeSingleLineAutoFitFontSize,
  generateCertificatePdfBytes,
} from './certificatePdfGenerator';
import {
  buildMultiPagePdfFromJpegs,
  generateStandardReportPdfBytes,
} from './reportPdfGenerator';
import { buildDocHtmlContent, buildSpreadsheetCsvContent } from './exportEngine';
import {
  addCustomMultiSelectOption,
  addEvidenceImages,
  addRepeatableItem,
  addTableRow,
  createInitialFormValues,
  formatGregorianToUmmAlQuraHijri,
  isFieldVisible,
  isFormDirty,
  removeEvidenceImage,
  removeRepeatableItem,
  removeTableRow,
  resolveReportFieldValue,
  selectSuggestedRepeatableItem,
  toggleArrayOption,
  updateEvidenceImageCaption,
  updateRepeatableItem,
  updateTableCell,
  validateFormValues,
} from './formEngine';
import {
  buildTraineeCertificateFiles,
  createZipArchiveBytes,
  parseBatchTraineeNames,
} from './zipBuilder';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

test('Section 1: Gifted section title is corrected to الموهوبين everywhere', () => {
  assert.equal(SECTIONS.gifted.title, 'الموهوبين');
  assert.notEqual(SECTIONS.gifted.title, 'الموهوبون');
});

test('Section 2: Official Trainer & Trainee Certificates in Male (معلم) and Female (معلمة) modes without dual slashes or coordinator fields', () => {
  const maleSettings = {
    schoolName: 'مدرسة الفيصلية الثانوية',
    educationDepartment: 'تعليم الرياض',
    principalName: 'فهد بن سعد القحطاني',
    userName: 'محمد بن علي السالم',
    academicYear: '1447 هـ',
    gender: 'male' as const,
    roles: {
      professionalDevelopment: 'منسق التطوير المهني',
      gifted: 'منسق الموهوبين',
      teacher: 'معلم',
    },
  };

  const femaleSettings = {
    ...maleSettings,
    schoolName: 'الثانوية الأولى للبنات',
    principalName: 'نورة بنت عبدالله العتيبي',
    gender: 'female' as const,
  };

  const certValues = createInitialFormValues(PD_TRAINER_CERTIFICATE_FORM);
  certValues.schoolNameInput = 'مدرسة الفيصلية الثانوية';
  certValues.beneficiaryName = 'سلطان بن عبدالرحمن الشهري';
  certValues.nationalId = '1045678901';
  certValues.programTitle = 'توظيف الذكاء الاصطناعي في التعليم';
  certValues.daysCount = '3';
  certValues.hoursCount = '15';
  certValues.startDate = '1447/04/10 هـ';
  certValues.endDate = '1447/04/12 هـ';
  certValues.principalNameInput = 'فهد بن سعد القحطاني';

  // 1) Trainer Certificate - Male
  const maleBeneficiary = {
    name: 'سلطان بن عبدالرحمن الشهري',
    nationalId: '1045678901',
  };
  const trainerMale = buildOfficialCertificateContent(
    'trainer',
    maleBeneficiary,
    certValues,
    maleSettings
  );
  assert.equal(
    trainerMale.line1,
    'تشهد إدارة مدرسة مدرسة الفيصلية الثانوية بأن الأستاذ سلطان بن عبدالرحمن الشهري'
  );
  assert.equal(trainerMale.line2, 'رقم الهوية / 1045678901');
  assert.equal(
    trainerMale.line3,
    'قد نفذ البرنامج التدريبي توظيف الذكاء الاصطناعي في التعليم ضمن مشروع توطين التطوير المهني بالمدارس'
  );
  assert.equal(trainerMale.line4, 'لمدة ( 3 ) أيام بواقع ( 15 ) ساعات');
  assert.equal(trainerMale.line5, 'من الفترة 1447/04/10 هـ إلى 1447/04/12 هـ');
  assert.equal(trainerMale.line6, 'مع تمنياتنا لكم بالتوفيق');
  assert.equal(trainerMale.stampLabel, 'ختم مركز التطوير المهني');
  assert.equal(trainerMale.principalTitle, 'مدير المدرسة');
  assert.equal(trainerMale.principalName, 'فهد بن سعد القحطاني');

  // 2) Trainer Certificate - Female
  const femaleBeneficiary = {
    name: 'سارة بنت خالد الدوسري',
    nationalId: '1045678901',
  };
  const femaleValues = {
    ...certValues,
    schoolNameInput: 'الثانوية الأولى للبنات',
    beneficiaryName: 'سارة بنت خالد الدوسري',
    principalNameInput: 'نورة بنت عبدالله العتيبي',
  };
  const trainerFemale = buildOfficialCertificateContent(
    'trainer',
    femaleBeneficiary,
    femaleValues,
    femaleSettings
  );
  assert.equal(
    trainerFemale.line1,
    'تشهد إدارة مدرسة الثانوية الأولى للبنات بأن الأستاذة سارة بنت خالد الدوسري'
  );
  assert.equal(
    trainerFemale.line3,
    'قد نفذت البرنامج التدريبي توظيف الذكاء الاصطناعي في التعليم ضمن مشروع توطين التطوير المهني بالمدارس'
  );
  assert.equal(trainerFemale.principalTitle, 'مديرة المدرسة');
  assert.equal(trainerFemale.principalName, 'نورة بنت عبدالله العتيبي');

  // 3) Trainee Certificate - Male
  const traineeMale = buildOfficialCertificateContent(
    'trainee',
    maleBeneficiary,
    certValues,
    maleSettings
  );
  assert.equal(
    traineeMale.line3,
    'قد حضر البرنامج التدريبي توظيف الذكاء الاصطناعي في التعليم ضمن مشروع توطين التطوير المهني بالمدارس'
  );
  assert.equal(traineeMale.principalTitle, 'مدير المدرسة');

  // 4) Trainee Certificate - Female
  const traineeFemale = buildOfficialCertificateContent(
    'trainee',
    femaleBeneficiary,
    femaleValues,
    femaleSettings
  );
  assert.equal(
    traineeFemale.line3,
    'قد حضرت البرنامج التدريبي توظيف الذكاء الاصطناعي في التعليم ضمن مشروع توطين التطوير المهني بالمدارس'
  );
  assert.equal(traineeFemale.principalTitle, 'مديرة المدرسة');

  // 5) Verify NO dual forms (الأستاذ/ة, مدير/ة, نفذ/ت, حضر/ت) or coordinator/preparer appear
  for (const cert of [trainerMale, trainerFemale, traineeMale, traineeFemale]) {
    const joined = Object.values(cert).join(' ');
    assert.equal(joined.includes('الأستاذ/ة'), false);
    assert.equal(joined.includes('مدير/ة'), false);
    assert.equal(joined.includes('نفذ/ت'), false);
    assert.equal(joined.includes('حضر/ت'), false);
    assert.equal(joined.includes('منسق التطوير المهني'), false);
    assert.equal(joined.includes('معد التقرير'), false);
    assert.equal(joined.includes('محمد بن علي السالم'), false);
  }
});

test('Section 2b: Batch Trainee Certificate supports 10 and 20 names at once and builds valid PDF files and ZIP archive containing ONLY .pdf files', () => {
  const settings = {
    schoolName: 'مدرسة الفيصلية',
    educationDepartment: 'تعليم الرياض',
    principalName: 'أ. فهد القحطاني',
    userName: 'أ. محمد السالم',
    academicYear: '1447 - 1448 هـ',
    gender: 'male' as const,
    roles: {
      professionalDevelopment: 'منسق التطوير المهني',
      gifted: 'منسق الموهوبين',
      teacher: 'معلم',
    },
  };

  const vals = createInitialFormValues(PD_TRAINEE_CERTIFICATE_FORM);
  vals.schoolNameInput = 'مدرسة الفيصلية';
  vals.programTitle = 'استراتيجيات التدريس الحديثة';
  vals.daysCount = '3';
  vals.hoursCount = '12';
  vals.startDate = '1447/05/01 هـ';
  vals.endDate = '1447/05/03 هـ';
  vals.principalNameInput = 'أ. فهد القحطاني';

  // Test 10 names batch
  const tenNamesText = Array.from({ length: 10 }, (_, i) => `متدرب رقم ${i + 1}`).join('\n');
  vals.beneficiaryName = tenNamesText;
  const parsed10 = parseBatchTraineeNames(vals.beneficiaryName);
  assert.equal(parsed10.length, 10);

  const files10 = buildTraineeCertificateFiles(parsed10, vals, settings);
  assert.equal(files10.length, 10);
  const decoder = new TextDecoder();
  for (let i = 0; i < 10; i++) {
    assert.ok(files10[i].filename.endsWith('.pdf'));
    assert.equal(files10[i].filename.endsWith('.html'), false);
    assert.ok(files10[i].filename.includes(`متدرب_رقم_${i + 1}`));
    assert.ok(files10[i].filename.includes('استراتيجيات_التدريس_الحديثة'));
    assert.ok(files10[i].content instanceof Uint8Array);
    const pdfText = decoder.decode(files10[i].content as Uint8Array);
    assert.ok(pdfText.startsWith('%PDF-1.4'));
    assert.ok(pdfText.includes('/MediaBox [0 0 841.89 595.28]'));
    assert.ok(pdfText.trim().endsWith('%%EOF'));
  }

  // Test 20 names batch
  const twentyNamesText = Array.from({ length: 20 }, (_, i) => `المعلم المتدرب ${i + 1}`).join('\n');
  vals.beneficiaryName = twentyNamesText;
  const parsed20 = parseBatchTraineeNames(vals.beneficiaryName);
  assert.equal(parsed20.length, 20);

  const files20 = buildTraineeCertificateFiles(parsed20, vals, settings);
  assert.equal(files20.length, 20);
  const zipBytes = createZipArchiveBytes(files20);
  // Verify PKZIP signature 0x50 0x4b 0x03 0x04 ('PK\x03\x04')
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);
  const zipAscii = decoder.decode(zipBytes);
  assert.ok(zipAscii.includes('.pdf'));
  assert.equal(zipAscii.includes('.html'), false);

  // Verify buildPdfFromJpegBytes embeds JPEG image stream in A4 landscape PDF
  const sampleJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pdfFromJpeg = buildPdfFromJpegBytes(sampleJpeg, 2400, 1697);
  const pdfHeader = decoder.decode(pdfFromJpeg.subarray(0, 64));
  assert.ok(pdfHeader.startsWith('%PDF-1.4'));
});

test('Section 3: Third semester is completely removed; only First and Second semester exist', () => {
  assert.deepEqual(PD_SEMESTER_OPTIONS, [
    'الفصل الدراسي الأول',
    'الفصل الدراسي الثاني',
  ]);
  assert.equal(PD_SEMESTER_OPTIONS.includes('الفصل الدراسي الثالث'), false);

  for (const form of [PD_TRAINING_EXECUTION_FORM, PD_SEMESTER_FINAL_REPORT_FORM]) {
    const semField = form.fields.find((f) => f.id === 'semesterName');
    const yearField = form.fields.find((f) => f.id === 'academicYearInput');
    assert.ok(semField);
    assert.ok(yearField);
    assert.deepEqual(semField.options, ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني']);
  }
});

test('Section 4: Header includes Coordinator/Teacher & Principal; Footer keeps Report Preparer; Executor is independent', () => {
  const settings = {
    schoolName: 'مدرسة الرواد',
    educationDepartment: 'إدارة تعليم جدة',
    principalName: 'سعد بن عبدالعزيز المالكي',
    userName: 'خالد بن عمر الغامدي',
    academicYear: '1447 هـ',
    gender: 'male' as const,
    roles: {
      professionalDevelopment: 'منسق التطوير المهني',
      gifted: 'منسق الموهوبين',
      teacher: 'معلم أول',
    },
  };

  const vals = createInitialFormValues(PD_TRAINING_EXECUTION_FORM);
  vals.programTitle = 'توظيف التقنية';
  vals.executionDomain = 'تطوير الأداء';
  vals.semesterName = 'الفصل الدراسي الأول';
  vals.academicYearInput = '1447 هـ';
  vals.executionLocation = 'قاعة التدريب';
  vals.beneficiariesCount = '15';
  vals.executionDate = '2026-11-02';
  vals.executionHijriDate = formatGregorianToUmmAlQuraHijri('2026-11-02');
  vals.targetGroups = ['الهيئة التعليمية'];
  vals.summaryDescription = 'ملخص الدورة';
  vals.objectivesList = ['هدف 1'];
  vals.topicsList = ['التخطيط للتدريس'];
  vals.trainingMethods = ['ورشة عمل'];
  vals.outputsList = ['إعداد خطة تطبيقية'];
  vals.recommendationsList = ['تطبيق المهارات المكتسبة'];
  vals.executorName = 'منفذ مستقل للبرنامج';
  vals.executorNationalId = '1098765432';

  const docHtml = buildDocHtmlContent({
    form: PD_TRAINING_EXECUTION_FORM,
    values: vals,
    settings,
  });

  // Header contains coordinator & principal from settings
  assert.ok(docHtml.includes('منسق التطوير المهني'));
  assert.ok(docHtml.includes('خالد بن عمر الغامدي'));
  assert.ok(docHtml.includes('سعد بن عبدالعزيز المالكي'));
  // Executor is independent
  assert.ok(docHtml.includes('منفذ مستقل للبرنامج'));
  // Footer keeps report preparer (not replaced by executor)
  assert.ok(docHtml.includes('معد التقرير (منسق التطوير المهني):</strong> خالد بن عمر الغامدي'));

  const csvContent = buildSpreadsheetCsvContent({
    form: PD_TRAINING_EXECUTION_FORM,
    values: vals,
    settings,
  });
  assert.ok(csvContent.includes('معد التقرير (منسق التطوير المهني)'));
});

test('Section 5 & 6: Local course registry saves, deduplicates, filters by year/semester, deletes, and never stores images or national ID', () => {
  const memStore = createMemoryStorage();

  const execValues = createInitialFormValues(PD_TRAINING_EXECUTION_FORM);
  execValues.programTitle = 'دورة التعلم النشط';
  execValues.executionDomain = 'تطوير الأداء';
  execValues.semesterName = 'الفصل الدراسي الأول';
  execValues.academicYearInput = '1447 هـ';
  execValues.executionDate = '2026-10-10';
  execValues.executionLocation = 'قاعة 1';
  execValues.beneficiariesCount = '20';
  execValues.outputsList = ['إعداد خطة تطبيقية'];
  execValues.executorName = 'أحمد علي';
  execValues.executorNationalId = '1055555555';
  execValues.executorSignature = 'data:image/png;base64,SECRET_SIG';
  execValues.evidencePhotos = [
    { id: '1', name: 'pic.png', dataUrl: 'data:image/png;base64,SECRET_IMG' },
  ];

  const coursePayload = buildCourseFromExecutionValues(execValues, '1447 هـ');
  const firstSave = saveCourseToLocalRegistry(coursePayload, memStore);
  assert.equal(firstSave.updatedExisting, false);
  assert.equal(firstSave.allCourses.length, 1);

  // Saving the exact same course again updates in place without duplicating
  execValues.beneficiariesCount = '25';
  const secondPayload = buildCourseFromExecutionValues(execValues, '1447 هـ');
  const secondSave = saveCourseToLocalRegistry(secondPayload, memStore);
  assert.equal(secondSave.updatedExisting, true);
  assert.equal(secondSave.allCourses.length, 1);
  assert.equal(secondSave.saved.beneficiariesCount, '25');

  // Verify raw localStorage string NEVER contains national ID, signature, or images
  const rawStoredJson = memStore.getItem(SAVED_COURSES_STORAGE_KEY) || '';
  assert.equal(rawStoredJson.includes('1055555555'), false);
  assert.equal(rawStoredJson.includes('SECRET_SIG'), false);
  assert.equal(rawStoredJson.includes('SECRET_IMG'), false);

  // Add a second course in Semester 2 and a third course in another Academic Year
  saveCourseToLocalRegistry(
    {
      academicYear: '1447 هـ',
      semester: 'الفصل الدراسي الثاني',
      programName: 'دورة التقويم البديل',
      domain: 'متابعة وتقويم',
      executionDate: '2027-02-15',
      location: 'قاعة 2',
      beneficiariesCount: '18',
      keyOutputs: 'أداة تقويم',
    },
    memStore
  );
  saveCourseToLocalRegistry(
    {
      academicYear: '1448 هـ',
      semester: 'الفصل الدراسي الأول',
      programName: 'دورة العام القادم',
      domain: 'برامج إثرائية',
      executionDate: '2027-09-10',
      location: 'قاعة 3',
      beneficiariesCount: '30',
      keyOutputs: 'حقيبة إثرائية',
    },
    memStore
  );

  const allLoaded = loadSavedCoursesFromStorage(memStore);
  assert.equal(allLoaded.length, 3);

  // Filter by 1447 هـ + الفصل الدراسي الأول -> only 1 course
  const sem1Courses = filterCoursesByAcademicPeriod(allLoaded, '1447 هـ', 'الفصل الدراسي الأول');
  assert.equal(sem1Courses.length, 1);
  assert.equal(sem1Courses[0].programName, 'دورة التعلم النشط');

  // Filter by 1447 هـ + الفصل الدراسي الثاني -> only 1 course
  const sem2Courses = filterCoursesByAcademicPeriod(allLoaded, '1447 هـ', 'الفصل الدراسي الثاني');
  assert.equal(sem2Courses.length, 1);
  assert.equal(sem2Courses[0].programName, 'دورة التقويم البديل');

  // Verify all entered course fields are persisted (not just course name)
  execValues.executionHijriDate = '1447/04/18 هـ';
  execValues.targetGroups = ['الهيئة التعليمية'];
  execValues.summaryDescription = 'ملخص شامل للدورة التدريبية';
  execValues.objectivesList = ['تطوير مهارات التدريس'];
  execValues.topicsList = ['استراتيجيات التعلم النشط'];
  execValues.trainingMethods = ['ورشة عمل'];
  execValues.recommendationsList = ['تعميم الحقيبة التدريبية'];
  const fullPayload = buildCourseFromExecutionValues(execValues, '1447 هـ');
  const fullSave = saveCourseToLocalRegistry(fullPayload, memStore);
  assert.equal(fullSave.updatedExisting, true);
  assert.equal(fullSave.allCourses.length, 3);
  assert.equal(fullSave.saved.executionHijriDate, '1447/04/18 هـ');
  assert.deepEqual(fullSave.saved.targetGroups, ['الهيئة التعليمية']);
  assert.equal(fullSave.saved.summaryDescription, 'ملخص شامل للدورة التدريبية');
  assert.deepEqual(fullSave.saved.objectives, ['تطوير مهارات التدريس']);
  assert.deepEqual(fullSave.saved.topics, ['استراتيجيات التعلم النشط']);
  assert.deepEqual(fullSave.saved.trainingMethods, ['ورشة عمل']);
  assert.deepEqual(fullSave.saved.recommendations, ['تعميم الحقيبة التدريبية']);

  // Verify changing executionDate on the same course and clicking save again updates in-place without duplicating
  execValues.executionDate = '2026-10-12';
  const dateChangedSave = saveCourseToLocalRegistry(
    buildCourseFromExecutionValues(execValues, '1447 هـ'),
    memStore
  );
  assert.equal(dateChangedSave.updatedExisting, true);
  assert.equal(dateChangedSave.allCourses.length, 3);
  assert.equal(dateChangedSave.saved.executionDate, '2026-10-12');

  // Verify filterCoursesByAcademicPeriod tolerates formatting differences ("1447" vs "1447 هـ" vs "١٤٤٧")
  assert.equal(
    filterCoursesByAcademicPeriod(dateChangedSave.allCourses, '1447', 'الفصل الدراسي الأول').length,
    1
  );
  assert.equal(
    filterCoursesByAcademicPeriod(dateChangedSave.allCourses, '١٤٤٧ هـ', 'الفصل الدراسي الأول').length,
    1
  );

  // Update a saved course
  const updatedList = updateSavedCourseInRegistry(
    sem1Courses[0].id,
    { programName: 'دورة التعلم النشط المطورة' },
    memStore
  );
  assert.equal(
    updatedList.find((c) => c.id === sem1Courses[0].id)?.programName,
    'دورة التعلم النشط المطورة'
  );

  // Delete a saved course and verify it no longer appears
  const afterDelete = deleteSavedCourseFromRegistry(sem1Courses[0].id, memStore);
  assert.equal(afterDelete.length, 2);
  assert.equal(
    filterCoursesByAcademicPeriod(afterDelete, '1447 هـ', 'الفصل الدراسي الأول').length,
    0
  );
});

test('National ID field has explicit red privacy warning defined in schema', () => {
  const natIdField = PD_TRAINING_EXECUTION_FORM.fields.find(
    (f) => f.id === 'executorNationalId'
  );
  assert.ok(natIdField);
  assert.equal(
    natIdField.privacyWarning,
    'تنبيه: لن يتم حفظ بيانات السجل المدني في الموقع'
  );
});

test('Core form engine helpers work accurately', () => {
  const form = createEngineVerificationForm('gifted', 'الموهوبين');
  const initial = createInitialFormValues(form);
  assert.equal(isFormDirty(form, initial), false);

  let items = [''];
  items = selectSuggestedRepeatableItem(items, 'التخطيط للتدريس', 4);
  assert.deepEqual(items, ['التخطيط للتدريس']);

  let selected: string[] = [];
  selected = toggleArrayOption(selected, 'ورشة عمل');
  selected = addCustomMultiSelectOption(selected, 'التدريب المصغر');
  assert.deepEqual(selected, ['ورشة عمل', 'التدريب المصغر']);

  let rows: Record<string, string>[] = [{ taskName: '', status: '' }];
  rows = updateTableCell(rows, 0, 'taskName', 'مهمة 1');
  rows = addTableRow([{ key: 'taskName', label: 'المهمة' }], rows, 5);
  assert.equal(rows.length, 2);
  rows = removeTableRow(rows, 0, 1);
  assert.equal(rows.length, 1);

  items = updateRepeatableItem(items, 0, 'هدف معدل');
  items = addRepeatableItem(items, 'هدف 2', 4);
  items = removeRepeatableItem(items, 0, 1);
  assert.deepEqual(items, ['هدف 2']);

  let imgs = addEvidenceImages([], [
    { id: 'img-1', name: 'photo1.png', dataUrl: 'data:image/png;base64,AAA' },
  ]);
  imgs = updateEvidenceImageCaption(imgs, 'img-1', 'وصف الشاهد');
  assert.equal(imgs[0].caption, 'وصف الشاهد');
  imgs = removeEvidenceImage(imgs, 'img-1');
  assert.equal(imgs.length, 0);

  assert.equal(getFormsForSection('professional-development').length, 4);
  assert.equal(isFieldVisible(form.fields[0], initial), true);
  assert.equal(validateFormValues(PD_TRAINER_CERTIFICATE_FORM, createInitialFormValues(PD_TRAINER_CERTIFICATE_FORM)).valid, false);
});

test('Section 7: Custom Training Domain (أخرى) shows input field and substitutes custom text in report preview and exports', () => {
  const settings = {
    schoolName: 'مدرسة النخبة',
    educationDepartment: 'تعليم مكة',
    principalName: 'أ. عبدالرحمن الحربي',
    userName: 'أ. تركي الزهراني',
    academicYear: '1447 هـ',
    gender: 'male' as const,
    roles: {
      professionalDevelopment: 'منسق التطوير المهني',
      gifted: 'منسق الموهوبين',
      teacher: 'معلم',
    },
  };

  const vals = createInitialFormValues(PD_TRAINING_EXECUTION_FORM);
  const domainField = PD_TRAINING_EXECUTION_FORM.fields.find((f) => f.id === 'executionDomain')!;
  const customDomainField = PD_TRAINING_EXECUTION_FORM.fields.find((f) => f.id === 'customExecutionDomain')!;

  // Initially customExecutionDomain is hidden
  assert.equal(isFieldVisible(customDomainField, vals), false);

  // When selecting أخرى, customExecutionDomain becomes visible and required
  vals.executionDomain = 'أخرى';
  assert.equal(isFieldVisible(customDomainField, vals), true);
  const checkBeforeCustom = validateFormValues(PD_TRAINING_EXECUTION_FORM, vals);
  assert.ok(checkBeforeCustom.errors.customExecutionDomain);

  // When entering custom domain text, resolveReportFieldValue returns the custom text instead of أخرى
  vals.customExecutionDomain = 'الأمن السيبراني والتحول الرقمي';
  assert.equal(
    resolveReportFieldValue(domainField, vals),
    'الأمن السيبراني والتحول الرقمي'
  );

  // Also verify DOCX and CSV exports include the custom domain text rather than أخرى
  vals.programTitle = 'تأمين الحسابات التعليمية';
  vals.semesterName = 'الفصل الدراسي الأول';
  vals.academicYearInput = '1447 هـ';
  vals.executionLocation = 'معمل الحاسب';
  vals.beneficiariesCount = '22';
  vals.executionDate = '2026-11-05';
  vals.executionHijriDate = formatGregorianToUmmAlQuraHijri('2026-11-05');
  vals.targetGroups = ['الهيئة التعليمية'];
  vals.summaryDescription = 'وصف البرنامج';
  vals.objectivesList = ['حماية البيانات'];
  vals.topicsList = ['الوعي السيبراني'];
  vals.trainingMethods = ['تطبيق عملي'];
  vals.outputsList = ['دليل إرشادي'];
  vals.recommendationsList = ['تفعيل التحقق الثنائي'];
  vals.executorName = 'م. ياسر القحطاني';

  const docHtml = buildDocHtmlContent({
    form: PD_TRAINING_EXECUTION_FORM,
    values: vals,
    settings,
  });
  assert.ok(docHtml.includes('الأمن السيبراني والتحول الرقمي'));

  const csvContent = buildSpreadsheetCsvContent({
    form: PD_TRAINING_EXECUTION_FORM,
    values: vals,
    settings,
  });
  assert.ok(csvContent.includes('الأمن السيبراني والتحول الرقمي'));
});

test('Section 8: Professional Development reports support ONLY PDF export (no Word/Excel) and generate real A4 Portrait PDF binaries', async () => {
  assert.deepEqual(PD_TRAINING_EXECUTION_FORM.supportedExports, ['pdf']);
  assert.equal(PD_TRAINING_EXECUTION_FORM.supportedExports.includes('docx'), false);
  assert.equal(PD_TRAINING_EXECUTION_FORM.supportedExports.includes('xlsx'), false);

  assert.deepEqual(PD_SEMESTER_FINAL_REPORT_FORM.supportedExports, ['pdf']);
  assert.equal(PD_SEMESTER_FINAL_REPORT_FORM.supportedExports.includes('docx'), false);
  assert.equal(PD_SEMESTER_FINAL_REPORT_FORM.supportedExports.includes('xlsx'), false);

  // Verify buildMultiPagePdfFromJpegs creates a valid multi-page A4 Portrait PDF
  const sampleJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const multiPdf = buildMultiPagePdfFromJpegs([
    { jpegBytes: sampleJpeg, pixelWidth: 1654, pixelHeight: 2339 },
    { jpegBytes: sampleJpeg, pixelWidth: 1654, pixelHeight: 2339 },
  ]);
  const decoder = new TextDecoder();
  const multiText = decoder.decode(multiPdf);
  assert.ok(multiText.startsWith('%PDF-1.4'));
  assert.ok(multiText.includes('/MediaBox [0 0 595.28 841.89]'));
  assert.ok(multiText.includes('/Count 2'));
  assert.ok(multiText.trim().endsWith('%%EOF'));

  const settings = {
    schoolName: 'مدرسة الفيصلية',
    educationDepartment: 'تعليم الرياض',
    principalName: 'أ. فهد القحطاني',
    userName: 'أ. محمد السالم',
    academicYear: '1447 هـ',
    gender: 'male' as const,
    roles: {
      professionalDevelopment: 'منسق التطوير المهني',
      gifted: 'منسق الموهوبين',
      teacher: 'معلم',
    },
  };

  // Test generateStandardReportPdfBytes for PD_TRAINING_EXECUTION_FORM
  const execValues = createInitialFormValues(PD_TRAINING_EXECUTION_FORM);
  execValues.programTitle = 'توظيف الذكاء الاصطناعي';
  execValues.executionDomain = 'تطوير الأداء';
  execValues.executionLocation = 'قاعة التدريب';
  execValues.beneficiariesCount = '24';

  const execPdf = await generateStandardReportPdfBytes(
    PD_TRAINING_EXECUTION_FORM,
    execValues,
    settings
  );
  assert.ok(execPdf.filename.endsWith('.pdf'));
  assert.ok(execPdf.filename.includes('توظيف_الذكاء_الاصطناعي'));
  const execPdfText = decoder.decode(execPdf.pdfBytes);
  assert.ok(execPdfText.startsWith('%PDF-1.4'));
  assert.ok(execPdfText.includes('/MediaBox [0 0 595.28 841.89]'));
  assert.ok(execPdfText.trim().endsWith('%%EOF'));

  // Test generateStandardReportPdfBytes for PD_SEMESTER_FINAL_REPORT_FORM
  const finalValues = createInitialFormValues(PD_SEMESTER_FINAL_REPORT_FORM);
  finalValues.semesterName = 'الفصل الدراسي الأول';
  finalValues.academicYearInput = '1447 هـ';
  finalValues.executedPrograms = [
    {
      programName: 'توظيف الذكاء الاصطناعي',
      domain: 'تطوير الأداء',
      executionDate: '2026-11-05',
      location: 'قاعة التدريب',
      beneficiariesCount: '24',
      keyOutputs: 'إعداد خطة تطبيقية',
    },
  ];
  finalValues.overallSummary = 'تم تنفيذ الخطة بنجاح';

  const finalPdf = await generateStandardReportPdfBytes(
    PD_SEMESTER_FINAL_REPORT_FORM,
    finalValues,
    settings
  );
  assert.ok(finalPdf.filename.endsWith('.pdf'));
  const finalPdfText = decoder.decode(finalPdf.pdfBytes);
  assert.ok(finalPdfText.startsWith('%PDF-1.4'));
  assert.ok(finalPdfText.includes('/MediaBox [0 0 595.28 841.89]'));
  assert.ok(finalPdfText.trim().endsWith('%%EOF'));
});

test('Certificate Long-Name Single-Line Auto-Fit: Short, medium, long, and very long Arabic names stay on 1 independent line above National ID for both Trainer and Trainee certificates', async () => {
  const settings = {
    schoolName: 'متوسطة وثانوية الأمير سلطان التعليمية',
    educationDepartment: 'تعليم الرياض',
    principalName: 'فهد بن سعد القحطاني',
    userName: 'محمد بن علي السالم',
    academicYear: '1447 - 1448 هـ',
    gender: 'male' as const,
    roles: {
      professionalDevelopment: 'منسق التطوير المهني',
      gifted: 'منسق الموهوبين',
      teacher: 'معلم',
    },
  };

  const baseValues = createInitialFormValues(PD_TRAINER_CERTIFICATE_FORM);
  baseValues.schoolNameInput = settings.schoolName;
  baseValues.programTitle = 'مهارات التصميم التعليمي وتقنيات التعلم النشط';
  baseValues.daysCount = '3';
  baseValues.hoursCount = '15';
  baseValues.startDate = '1447/06/01 هـ';
  baseValues.endDate = '1447/06/03 هـ';
  baseValues.principalNameInput = settings.principalName;

  const testCases = [
    {
      label: 'short',
      name: 'أحمد علي',
      expectedScaleDown: false,
      expectedMinFloor: false,
    },
    {
      label: 'medium',
      name: 'سلطان بن عبدالرحمن الشهري',
      expectedScaleDown: false,
      expectedMinFloor: false,
    },
    {
      label: 'long',
      name: 'عبدالرحمن بن محمد بن عبدالعزيز بن إبراهيم آل عبداللطيف السبيعي',
      expectedScaleDown: true,
      expectedMinFloor: false,
    },
    {
      label: 'very-long',
      name: 'عبدالعزيز بن عبدالرحمن بن محمد بن عبدالله بن إبراهيم بن سليمان آل عبداللطيف القحطاني الدوسري الشمراني',
      expectedScaleDown: true,
      expectedMinFloor: true,
    },
  ];

  // Realistic Arabic bold glyph width model (~0.56 * fontSize per Arabic character)
  const measureArabicLineWidth = (text: string) => (fontSizePx: number) =>
    text.length * fontSizePx * 0.56;

  for (const variant of ['trainer', 'trainee'] as const) {
    let previousFontSize = CERTIFICATE_RECIPIENT_MAX_FONT_PX;

    for (const tc of testCases) {
      const content = buildOfficialCertificateContent(
        variant,
        { name: tc.name, nationalId: '1045678901' },
        baseValues,
        settings
      );

      // 1. Intro line and Recipient name are cleanly separated so the name sits on 1 independent line
      assert.equal(content.introLine, `تشهد إدارة مدرسة ${settings.schoolName} بأن`);
      assert.equal(content.recipientLine, `الأستاذ ${tc.name}`);
      // 2. National ID is ALWAYS on its own separate line (line2)
      assert.equal(content.line2, 'رقم الهوية / 1045678901');
      assert.equal(content.recipientLine.includes('رقم الهوية'), false);

      // 3. Auto-fit calculation scales progressively down and respects the readable minimum floor
      const fit = computeSingleLineAutoFitFontSize(
        content.recipientLine,
        CERTIFICATE_RECIPIENT_SAFE_WIDTH_PX,
        measureArabicLineWidth(content.recipientLine)
      );

      assert.equal(fit.didScaleDown, tc.expectedScaleDown, `${variant}/${tc.label} scaleDown`);
      assert.equal(fit.reachedMinFontSize, tc.expectedMinFloor, `${variant}/${tc.label} minFloor`);
      assert.ok(
        fit.fontSizePx >= CERTIFICATE_RECIPIENT_MIN_FONT_PX &&
          fit.fontSizePx <= CERTIFICATE_RECIPIENT_MAX_FONT_PX,
        `${variant}/${tc.label} font size stays within [${CERTIFICATE_RECIPIENT_MIN_FONT_PX}, ${CERTIFICATE_RECIPIENT_MAX_FONT_PX}]`
      );
      assert.ok(
        fit.fontSizePx <= previousFontSize,
        `${variant}/${tc.label} font size scales monotonically downward for longer names`
      );
      if (!tc.expectedMinFloor) {
        assert.equal(
          fit.fitsWithinMaxWidth,
          true,
          `${variant}/${tc.label} fits cleanly inside safe width without overflow`
        );
      }
      previousFontSize = fit.fontSizePx;

      // 4. PDF generation succeeds with valid A4 Landscape PDF 1.4 binary
      const pdfBytes = await generateCertificatePdfBytes(content);
      const pdfStr = new TextDecoder('latin1').decode(pdfBytes);
      assert.ok(pdfStr.startsWith('%PDF-1.4'));
      assert.ok(pdfStr.includes('/MediaBox [0 0 841.89 595.28]'));
      assert.ok(pdfStr.trim().endsWith('%%EOF'));
    }
  }
});



