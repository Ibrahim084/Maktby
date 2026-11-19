import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import { SECTIONS } from '../data/sections';
import {
  buildCertificatePdfFilename,
  buildDefaultCertificateTexts,
  CERTIFICATE_COLOR_SYSTEMS,
  CERTIFICATE_LANDSCAPE_HEIGHT_PX,
  CERTIFICATE_LANDSCAPE_WIDTH_PX,
  CERTIFICATE_PDF_HEIGHT_PT,
  CERTIFICATE_PDF_WIDTH_PT,
  CERTIFICATE_TEMPLATES,
  CertificateColorSystemId,
  CertificateFormState,
  CERTIFICATES_ATTACHED_FONTS,
  CertificateTemplateId,
  computeCertificateBodyLayout,
  createInitialCertificateFormState,
  formatBeneficiaryDisplayLine,
  generateCertificatesPdf,
  getCertificateColorPalette,
  getCertificateFontFamily,
  parseCertificateBeneficiaryNames,
  resolveCertificateFooterSignatures,
  stylizeArabicCalligraphicTitle,
} from './certificatesEngine';
import { parseHashToPage } from './settingsStorage';

test('اتجاه الشهادات: جميع الشهادات بمقاس A4 أفقي (Landscape: 2380×1684 px و 841.89×595.28 pt)', () => {
  assert.ok(
    CERTIFICATE_LANDSCAPE_WIDTH_PX > CERTIFICATE_LANDSCAPE_HEIGHT_PX,
    'يجب أن يكون عرض صفحة المعاينة أكبر من ارتفاعها (اتجاه أفقي Landscape)'
  );
  assert.equal(CERTIFICATE_LANDSCAPE_WIDTH_PX, 2380);
  assert.equal(CERTIFICATE_LANDSCAPE_HEIGHT_PX, 1684);
  assert.equal(CERTIFICATE_PDF_WIDTH_PT, 841.89);
  assert.equal(CERTIFICATE_PDF_HEIGHT_PT, 595.28);
});

test('الخطوط المرفقة والأصول المرجعية المستخرجة متوفرة محلياً ومستخدمة في العربية والإنجليزية', () => {
  assert.ok(CERTIFICATES_ATTACHED_FONTS.length >= 10);

  for (const fontDesc of CERTIFICATES_ATTACHED_FONTS) {
    const fullPath = path.join(process.cwd(), 'public', fontDesc.relativePath);
    assert.ok(
      fs.existsSync(fullPath),
      `ملف الخط المحلي المرفق يجب أن يكون موجوداً: ${fontDesc.relativePath}`
    );
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 10000, `ملف الخط يجب ألا يكون فارغاً: ${fontDesc.relativePath}`);
  }

  assert.ok(
    getCertificateFontFamily('ar', 'body').includes('IBM Plex Sans Arabic'),
    'يجب استخدام خط IBM Plex Sans Arabic المرفق للنصوص العربية'
  );
  assert.ok(
    getCertificateFontFamily('en', 'body').includes('HelveticaLocal'),
    'يجب استخدام خط Helvetica المرفق للنصوص الإنجليزية'
  );

  // التحقق من وجود المخطوطات المرجعية المستخرجة وختم الميدالية الذهبية
  const referenceAssets = [
    'public/certificates/title-appreciation-ar.png',
    'public/certificates/title-excellence-ar.png',
    'public/certificates/title-graduation-ar.png',
    'public/certificates/title-shukr-irfan-ar.png',
    'public/certificates/title-shukr-modern-ar.png',
    'public/certificates/title-shukr-wave-ar.png',
    'public/certificates/title-tafawuq-dirasi-ar.png',
    'public/certificates/medal-seal.png',
  ];
  for (const relAsset of referenceAssets) {
    const assetPath = path.join(process.cwd(), relAsset);
    assert.ok(fs.existsSync(assetPath), `الأصل المرجعي يجب أن يتوفر: ${relAsset}`);
    const header = fs.readFileSync(assetPath).subarray(0, 8);
    assert.deepEqual(
      Array.from(header),
      [137, 80, 78, 71, 13, 10, 26, 10],
      `يجب أن يكون الملف صورة PNG صالحة: ${relAsset}`
    );
  }
});

test('تصحيح مكان قسم الشهادات: يظهر داخل قسم المعلم فقط بعد البرامج والأنشطة التعليمية ولا يظهر في الشريط العلوي أو الأيقونات الثلاث', () => {
  // ١. الأيقونات الرئيسية الثلاث لم تتغير
  assert.equal(Object.keys(SECTIONS).length, 3);
  assert.deepEqual(
    Object.keys(SECTIONS),
    ['professional-development', 'gifted', 'teacher']
  );

  // ٢. مسار التنقل المستقل للشهادات غير موجود في القائمة الرئيسية
  assert.equal(parseHashToPage('#/certificates'), 'home');

  // ٣. فحص Header.tsx للتأكد من عدم وجود الشهادات في الشريط العلوي
  const headerSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/Header.tsx'),
    'utf8'
  );
  assert.ok(
    !headerSource.includes("'certificates'") && !headerSource.includes('الشهادات'),
    'يجب ألا يظهر قسم الشهادات في الشريط العلوي Header.tsx'
  );

  // ٤. فحص TeacherSectionHub.tsx للتأكد من وجود بطاقة الشهادات مباشرة بعد البرامج والأنشطة التعليمية
  const teacherHubSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/teacher/TeacherSectionHub.tsx'),
    'utf8'
  );
  const programsIdx = teacherHubSource.indexOf(
    'data-testid="enter-programs-activities-group-btn"'
  );
  const certificatesIdx = teacherHubSource.indexOf(
    'data-testid="teacher-group-card-certificates"'
  );
  assert.ok(programsIdx > 0 && certificatesIdx > programsIdx);
});

test('قوالب الشهادات تظهر للمستخدم بأرقام فقط (قالب 1، قالب 2، قالب 3) دون أسماء وصفية', () => {
  assert.equal(CERTIFICATE_TEMPLATES.length, 3);
  assert.deepEqual(
    CERTIFICATE_TEMPLATES.map((t) => t.uiLabel),
    ['قالب 1', 'قالب 2', 'قالب 3']
  );
  assert.deepEqual(
    CERTIFICATE_TEMPLATES.map((t) => t.id),
    ['1', '2', '3']
  );
});

test('أنظمة الألوان الأربعة تظهر للمستخدم بأرقام فقط (1، 2، 3، 4) وتعتمد على الألوان المعتمدة', () => {
  const ids: CertificateColorSystemId[] = ['1', '2', '3', '4'];
  const allowedCoreColors = new Set([
    '#07A869',
    '#0DA9A6',
    '#3D7EB9',
    '#15445A',
    '#C1B489',
    '#C2C1C1',
    '#FFFFFF',
  ]);

  for (const id of ids) {
    const palette = getCertificateColorPalette(id);
    assert.equal(palette.uiLabel, id);
    assert.ok(allowedCoreColors.has(palette.primaryHex));
    assert.ok(allowedCoreColors.has(palette.secondaryHex));
    assert.ok(allowedCoreColors.has(palette.accentHex));
    assert.ok(allowedCoreColors.has(palette.goldHex));
    assert.ok(allowedCoreColors.has(palette.neutralHex));
    assert.ok(allowedCoreColors.has(palette.whiteHex));
  }
});

test('١-٣. اختبار شهادة شكر وتقدير: معلم، إداري، طالب (مذكر ومؤنث) بالنصوص المعتمدة', () => {
  const teacherMale = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'teacher',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'male',
    schoolName: 'ابن سينا الثانوية',
  });
  assert.equal(teacherMale.certificateTitle, 'شهادة شكر وتقدير');
  assert.ok(
    teacherMale.openingText.includes(
      'تتقدم ادارة مدرسة ابن سينا الثانوية بوافر الشكر والتقدير الى'
    )
  );
  assert.ok(teacherMale.defaultBeneficiarySample.includes('الاستاذ'));
  assert.ok(
    teacherMale.mainText.includes(
      'تقديراً لجهوده المخلصة وعطائه المستمر في رسالة العلم السامية'
    )
  );
  assert.equal(teacherMale.additionalText, '');

  const teacherFemale = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'teacher',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'female',
    presenterGender: 'female',
    schoolName: 'الزهراء الثانوية',
  });
  assert.ok(teacherFemale.defaultBeneficiarySample.includes('الأستاذة'));
  assert.ok(teacherFemale.mainText.includes('تقديراً لجهودها المخلصة'));
  assert.equal(teacherFemale.principalTitle, 'مديرة المدرسة');

  const adminMale = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'admin',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'male',
    schoolName: 'الملك عبدالعزيز',
  });
  assert.equal(adminMale.certificateTitle, 'شهادة شكر وتقدير');
  assert.ok(
    adminMale.mainText.includes(
      'تقديراً لجهوده المتميزة وتفانيه في أداء عمله وحرصه الدائم على تنظيم وسير العمل بكفاءة وإتقان'
    )
  );
  assert.equal(adminMale.additionalText, '');

  const adminFemale = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'admin',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'female',
    schoolName: 'خديجة بنت خويلد',
  });
  assert.ok(
    adminFemale.mainText.includes(
      'تقديراً لجهودها المتميزة وتفانيها في أداء عملها'
    )
  );

  const studentMale = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'student',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'male',
    schoolName: 'الرواد',
  });
  assert.ok(
    studentMale.openingText.includes(
      'تتقدم ادارة مدرسة الرواد بالشكر والتقدير الى'
    )
  );
  assert.ok(studentMale.defaultBeneficiarySample.includes('الطالب /'));
  assert.ok(
    studentMale.mainText.includes(
      'وذلك لتميّزه الدراسي، واجتهاده المستمر، وأخلاقه العالية طوال العام الدراسي.'
    )
  );
  assert.equal(
    studentMale.additionalText,
    'متمنين له دوام التوفيق والنجاح في مسيرته التعليمية.'
  );

  const studentFemale = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'student',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'female',
    schoolName: 'الرواد',
  });
  assert.ok(studentFemale.defaultBeneficiarySample.includes('الطالبة /'));
  assert.ok(studentFemale.mainText.includes('وذلك لتميّزها الدراسي'));
  assert.equal(
    studentFemale.additionalText,
    'متمنين لها دوام التوفيق والنجاح في مسيرتها التعليمية.'
  );
});

test('٤-٥. اختبار شهادة تخرج لطالب ولطالبة مع حقلي المرحلة والعام الدراسي وعدم وجود صيغ مزدوجة', () => {
  const gradMale = buildDefaultCertificateTexts({
    certificateType: 'graduation',
    appreciationRole: 'student',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'male',
    schoolName: 'قرطبة الثانوية',
    academicStage: 'الثانوية',
    academicYear: '١٤٤٧هـ',
  });

  assert.equal(gradMale.certificateTitle, 'شهادة تخرج');
  assert.equal(
    gradMale.openingText,
    'تتقدم ادارة مدرسة قرطبة الثانوية بخالص التهاني والتبريكات الى الطالب'
  );
  assert.equal(
    gradMale.mainText,
    'بمناسبة تخرجه من المرحلة الثانوية للعام الدراسي ١٤٤٧هـ، وذلك بعد مسيرة حافلة بالجد والاجتهاد والتميز.'
  );
  assert.equal(
    gradMale.additionalText,
    'سائلين الله عز وجل له دوام التوفيق والنجاح في مسيرته العلمية والعملية القادمة، وأن ينفع به دينه ووطنه.'
  );
  assert.ok(!gradMale.openingText.includes('/'));
  assert.ok(!gradMale.mainText.includes('/'));
  assert.ok(!gradMale.additionalText.includes('/'));

  const gradFemale = buildDefaultCertificateTexts({
    certificateType: 'graduation',
    appreciationRole: 'student',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'female',
    schoolName: 'قرطبة الثانوية',
    academicStage: 'المتوسطة',
    academicYear: '١٤٤٧هـ',
  });

  assert.equal(
    gradFemale.openingText,
    'تتقدم ادارة مدرسة قرطبة الثانوية بخالص التهاني والتبريكات الى الطالبة'
  );
  assert.equal(
    gradFemale.mainText,
    'بمناسبة تخرجها من المرحلة المتوسطة للعام الدراسي ١٤٤٧هـ، وذلك بعد مسيرة حافلة بالجد والاجتهاد والتميز.'
  );
  assert.equal(
    gradFemale.additionalText,
    'سائلين الله عز وجل لها دوام التوفيق والنجاح في مسيرتها العلمية والعملية القادمة، وأن ينفع بها دينها ووطنها.'
  );
  assert.ok(!gradFemale.openingText.includes('/'));
  assert.ok(!gradFemale.mainText.includes('/'));
  assert.ok(!gradFemale.additionalText.includes('/'));
});

test('٦-٧. اختبار شهادة تفوق بنوعيها (من إدارة المدرسة مع الصف الدراسي، ومن المعلم أو المعلمة)', () => {
  const excSchoolMale = buildDefaultCertificateTexts({
    certificateType: 'excellence',
    appreciationRole: 'student',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender: 'male',
    schoolName: 'الفيصلية',
    gradeName: 'الثالث الثانوي',
  });

  assert.equal(excSchoolMale.certificateTitle, 'شهادة تفوق');
  assert.equal(
    excSchoolMale.openingText,
    'تتقدم إدارة مدرسة الفيصلية بخالص الشكر والتقدير للطالب المتميز:'
  );
  assert.equal(
    excSchoolMale.mainText,
    'وذلك تقديراً لتفوقه الدراسي الباهر وحصوله على أعلى الدرجات، متمنين له دوام التقدم والنجاح.'
  );

  const displayLineAr = formatBeneficiaryDisplayLine('أحمد بن خالد العتيبي', {
    certificateType: 'excellence',
    excellenceVariant: 'school-administration',
    gradeName: 'الثالث الثانوي',
    language: 'ar',
  });
  assert.equal(displayLineAr, 'أحمد بن خالد العتيبي بالصف الثالث الثانوي،');

  const excTeacherMale = buildDefaultCertificateTexts({
    certificateType: 'excellence',
    appreciationRole: 'student',
    excellenceVariant: 'teacher',
    language: 'ar',
    recipientGender: 'male',
    presenterGender: 'male',
  });
  assert.equal(excTeacherMale.openingText, 'الى الطالب المتميز');
  assert.ok(
    excTeacherMale.mainText.includes('إن التميز ليس غاية بل هو رحلة')
  );
  assert.ok(excTeacherMale.mainText.includes('داعياً الله لك'));
  assert.equal(excTeacherMale.presenterTitle, 'معلم المادة');

  const excTeacherFemale = buildDefaultCertificateTexts({
    certificateType: 'excellence',
    appreciationRole: 'student',
    excellenceVariant: 'teacher',
    language: 'ar',
    recipientGender: 'female',
    presenterGender: 'female',
  });
  assert.equal(excTeacherFemale.openingText, 'الى الطالبة المتميزة');
  assert.ok(excTeacherFemale.mainText.includes('داعيةً الله لكِ'));
  assert.equal(excTeacherFemale.presenterTitle, 'معلمة المادة');
});

test('٨. اختبار تبديل اللغة بين العربية والإنجليزية وانعكاس التوقيعات في الإنجليزية', () => {
  const enAppreciation = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'teacher',
    excellenceVariant: 'school-administration',
    language: 'en',
    recipientGender: 'male',
    schoolName: 'Al-Rowad High School',
  });

  assert.equal(enAppreciation.certificateTitle, 'Certificate of Appreciation');
  assert.ok(
    enAppreciation.openingText.includes(
      'The Administration of Al-Rowad High School proudly presents this Certificate of Appreciation to'
    )
  );
  assert.ok(enAppreciation.mainText.includes('In grateful recognition of his'));

  const sigsAr = resolveCertificateFooterSignatures({
    language: 'ar',
    presenterTitle: 'معلم المادة',
    presenterName: 'أ. فهد العتيبي',
    principalTitle: 'مدير المدرسة',
    principalName: 'أ. خالد السبيعي',
    isPresenterSameAsPrincipal: false,
  });
  assert.equal(sigsAr.rightBlock?.name, 'أ. فهد العتيبي');
  assert.equal(sigsAr.leftBlock?.name, 'أ. خالد السبيعي');

  const sigsEn = resolveCertificateFooterSignatures({
    language: 'en',
    presenterTitle: 'Subject Teacher',
    presenterName: 'Mr. Fahad Al-Otaibi',
    principalTitle: 'School Principal',
    principalName: 'Mr. Khalid Al-Subaie',
    isPresenterSameAsPrincipal: false,
  });
  assert.equal(sigsEn.leftBlock?.name, 'Mr. Fahad Al-Otaibi');
  assert.equal(sigsEn.rightBlock?.name, 'Mr. Khalid Al-Subaie');
});

test('١١. اختبار النصوص الطويلة والتكيف التلقائي لأحجام الخطوط دون قص أو تداخل في الاتجاه الأفقي', () => {
  const shortLayout = computeCertificateBodyLayout(null, {
    openingText: 'تتقدم إدارة المدرسة بالشكر والتقدير إلى',
    beneficiaryDisplay: 'الأستاذ محمد بن عبدالله القحطاني',
    mainText: 'تقديراً لجهوده المخلصة وعطائه المستمر في رسالة العلم السامية.',
    additionalText: '',
    language: 'ar',
    bodyTopY: 545,
    bodyBottomY: 1255,
    maxTextWidth: 1680,
  });

  const veryLongLayout = computeCertificateBodyLayout(null, {
    openingText:
      'تتقدم إدارة مدرسة الملك عبدالعزيز الثانوية بوافر الشكر وعظيم الامتنان والتقدير إلى سعادة المربي الفاضل',
    beneficiaryDisplay:
      'الأستاذ الدكتور عبدالرحمن بن محمد بن عبدالعزيز آل الشيخ المبارك التميمي',
    mainText:
      'تقديراً لجهوده المخلصة وعطائه المستمر في رسالة العلم السامية، ودوره المؤثر والريادي في بناء أجيال واعية ومتميزة، ومشاركته الفاعلة في قيادة المبادرات التربوية والبرامج الإثرائية وتطوير بيئة التعلم المدرسية طوال العام الدراسي بكفاءة واقتدار، متمنين له دوام التوفيق والسداد والنجاح.',
    additionalText:
      'نسأل الله العلي القدير أن يبارك في جهوده ويجعل ما قدمه في موازين حسناته، وأن يديم عليه التميز والإبداع في مسيرته التعليمية والتربوية.',
    language: 'ar',
    bodyTopY: 545,
    bodyBottomY: 1255,
    maxTextWidth: 1680,
  });

  assert.equal(shortLayout.scale, 1.0);
  assert.ok(
    veryLongLayout.scale < 1.0,
    'يجب تصغير المقياس تلقائياً عند زيادة طول النصوص'
  );
  assert.ok(
    veryLongLayout.beneficiaryFontPx <= shortLayout.beneficiaryFontPx,
    'يجب تصغير خط اسم المستفيد الطويل تلقائياً'
  );
  assert.ok(
    veryLongLayout.totalContentHeight <= 1255 - 545,
    'يجب ألا يتجاوز المحتوى ارتفاع المساحة المخصصة له لمنع القص والتداخل'
  );
});

test('١٢. اختبار الحقل الرابع الاختياري (نص إضافي اختياري) فارغاً ومملوءاً', () => {
  const emptyAdditional = computeCertificateBodyLayout(null, {
    openingText: 'تتقدم إدارة المدرسة بالشكر والتقدير إلى',
    beneficiaryDisplay: 'الطالب / سعد المالكي',
    mainText: 'وذلك لتميزه الدراسي واجتهاده المستمر.',
    additionalText: '   ',
    language: 'ar',
    bodyTopY: 545,
    bodyBottomY: 1255,
    maxTextWidth: 1680,
  });

  assert.equal(emptyAdditional.additionalLines.length, 0);
  assert.equal(emptyAdditional.gapAfterMain, 0);

  const filledAdditional = computeCertificateBodyLayout(null, {
    openingText: 'تتقدم إدارة المدرسة بالشكر والتقدير إلى',
    beneficiaryDisplay: 'الطالب / سعد المالكي',
    mainText: 'وذلك لتميزه الدراسي واجتهاده المستمر.',
    additionalText: 'متمنين له دوام التوفيق والنجاح في مسيرته التعليمية.',
    language: 'ar',
    bodyTopY: 545,
    bodyBottomY: 1255,
    maxTextWidth: 1680,
  });

  assert.ok(filledAdditional.additionalLines.length > 0);
  assert.ok(filledAdditional.gapAfterMain > 0);
  assert.ok(
    filledAdditional.totalContentHeight > emptyAdditional.totalContentHeight
  );
});

test('١٣. اختبار حقول التوقيع الاختيارية فارغة ومملوءة ومنع تكرار مدير المدرسة مرتين', () => {
  const bothEmpty = resolveCertificateFooterSignatures({
    language: 'ar',
    presenterTitle: 'معلم المادة',
    presenterName: '   ',
    principalTitle: 'مدير المدرسة',
    principalName: '',
    isPresenterSameAsPrincipal: false,
  });
  assert.equal(bothEmpty.rightBlock, null);
  assert.equal(bothEmpty.leftBlock, null);

  const sameByFlag = resolveCertificateFooterSignatures({
    language: 'ar',
    presenterTitle: 'مدير المدرسة',
    presenterName: 'أ. عبدالله الشهري',
    principalTitle: 'مدير المدرسة',
    principalName: 'أ. عبدالله الشهري',
    isPresenterSameAsPrincipal: true,
  });
  assert.equal(sameByFlag.rightBlock, null);
  assert.notEqual(sameByFlag.leftBlock, null);
  assert.equal(sameByFlag.leftBlock?.name, 'أ. عبدالله الشهري');

  const sameByName = resolveCertificateFooterSignatures({
    language: 'ar',
    presenterTitle: 'مقدم الشهادة',
    presenterName: 'أ. عبدالله الشهري',
    principalTitle: 'مدير المدرسة',
    principalName: 'أ. عبدالله الشهري',
    isPresenterSameAsPrincipal: false,
  });
  assert.equal(sameByName.rightBlock, null);
  assert.equal(sameByName.leftBlock?.name, 'أ. عبدالله الشهري');
});

test('٩-١٠ و١٤. اختبار جميع القوالب (1، 2، 3) وجميع أنظمة الألوان (1، 2، 3، 4) وإنشاء شهادات لعدة مستفيدين دفعة واحدة بمقاس A4 أفقي (Landscape PDF)', async () => {
  const baseState: CertificateFormState = {
    ...createInitialCertificateFormState(DEFAULT_SCHOOL_SETTINGS),
    educationDepartment: 'الإدارة العامة للتعليم بمنطقة الرياض',
    schoolName: 'ثانوية الرواد النموذجية',
    beneficiariesInput: [
      'أحمد بن محمد القحطاني',
      'خالد بن سعد العتيبي',
      'فهد بن عبدالرحمن الغامدي',
    ].join('\n'),
    principalName: 'أ. سلطان بن ناصر الدوسري',
    presenterTitle: 'رائد النشاط',
    presenterName: 'أ. ماجد بن علي الحربي',
  };

  const parsedNames = parseCertificateBeneficiaryNames(
    baseState.beneficiariesInput
  );
  assert.deepEqual(parsedNames, [
    'أحمد بن محمد القحطاني',
    'خالد بن سعد العتيبي',
    'فهد بن عبدالرحمن الغامدي',
  ]);

  const templateIds: CertificateTemplateId[] = ['1', '2', '3'];
  const colorIds: CertificateColorSystemId[] = ['1', '2', '3', '4'];

  for (const templateId of templateIds) {
    for (const colorSystemId of colorIds) {
      const stateVariant: CertificateFormState = {
        ...baseState,
        templateId,
        colorSystemId,
      };
      const pdfResult = await generateCertificatesPdf(stateVariant);

      assert.equal(
        pdfResult.pageCount,
        3,
        `يجب إنشاء ٣ صفحات مستقلة (قالب ${templateId} - لون ${colorSystemId})`
      );
      assert.equal(pdfResult.pages.length, 3);
      assert.equal(pdfResult.pages[0].pixelWidth, 2380);
      assert.equal(pdfResult.pages[0].pixelHeight, 1684);
      assert.equal(pdfResult.pages[0].beneficiaryName, 'أحمد بن محمد القحطاني');
      assert.equal(pdfResult.pages[1].beneficiaryName, 'خالد بن سعد العتيبي');
      assert.equal(
        pdfResult.pages[2].beneficiaryName,
        'فهد بن عبدالرحمن الغامدي'
      );

      const pdfText = new TextDecoder('latin1').decode(pdfResult.pdfBytes);
      assert.ok(pdfText.startsWith('%PDF-1.4'));
      assert.ok(
        pdfText.includes('/MediaBox [0 0 841.89 595.28]'),
        'يجب أن تكون الشهادة في ملف PDF بمقاس A4 أفقي (Landscape: 841.89 × 595.28 pt)'
      );
      assert.ok(
        pdfText.includes('/Count 3'),
        'يجب أن يضم ملف PDF عدد الصفحات المطابق للمستفيدين'
      );
    }
  }

  // اختبار تصدير شهادة مستفيد واحد محدد من الدفعة
  const singleBeneficiaryResult = await generateCertificatesPdf(baseState, {
    beneficiaryIndex: 1,
  });
  assert.equal(singleBeneficiaryResult.pageCount, 1);
  assert.equal(
    singleBeneficiaryResult.pages[0].beneficiaryName,
    'خالد بن سعد العتيبي'
  );
  assert.ok(
    singleBeneficiaryResult.filename.includes('خالد_بن_سعد_العتيبي'),
    'يجب أن يحمل ملف المستفيد الفردي اسمه بوضوح'
  );

  assert.ok(
    stylizeArabicCalligraphicTitle('شهادة شكر وتقدير', 'appreciation', 'ar').includes('شَ')
  );
  assert.equal(
    stylizeArabicCalligraphicTitle('', 'graduation', 'en'),
    'Certificate of Graduation'
  );
  assert.ok(
    buildCertificatePdfFilename(baseState).includes('دفعة_3_مستفيدين')
  );
});

test('١٥. جولة التصميم الثانية: حذف «حُررت بتاريخ» وشعار المدرسة نهائياً، وإضافة شعار وزارة التعليم فقط دون شعار رؤية 2030', () => {
  const engineSource = fs.readFileSync(
    path.join(process.cwd(), 'src/utils/certificatesEngine.ts'),
    'utf8'
  );
  const hubSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/certificates/CertificatesSectionHub.tsx'),
    'utf8'
  );

  // ١. التأكد من حذف «حُررت بتاريخ» وحقل التاريخ نهائياً من المحرك والواجهة
  assert.ok(
    !engineSource.includes('حُررت بتاريخ') &&
      !engineSource.includes('حررت بتاريخ') &&
      !engineSource.includes('Issued on:'),
    'يجب حذف «حُررت بتاريخ» نهائياً من محرك الشهادات'
  );
  assert.ok(
    !hubSource.includes('cert-issue-date-input') &&
      !hubSource.includes('حُررت بتاريخ'),
    'يجب حذف حقل «حُررت بتاريخ» نهائياً من واجهة الشهادات'
  );

  // ٢. التأكد من حذف شعار المدرسة نهائياً من الواجهة والمحرك
  assert.ok(
    !hubSource.includes('cert-school-logo-input') &&
      !hubSource.includes('شعار المدرسة'),
    'يجب حذف خيار رفع شعار المدرسة نهائياً من واجهة الشهادات'
  );
  assert.ok(
    !engineSource.includes('schoolLogoDataUrl'),
    'يجب حذف حقل شعار المدرسة نهائياً من حالة ومحرك الشهادات'
  );

  // ٣. التأكد من وجود شعار وزارة التعليم وعدم وجود شعار رؤية 2030
  assert.ok(
    engineSource.includes('moe-logo.png'),
    'يجب تضمين شعار وزارة التعليم في الترويسة العلوية للشهادة'
  );
  assert.ok(
    fs.existsSync(path.join(process.cwd(), 'public/moe-logo.png')),
    'يجب توفر ملف شعار وزارة التعليم public/moe-logo.png'
  );
  assert.ok(
    !engineSource.toLowerCase().includes('vision2030') &&
      !engineSource.toLowerCase().includes('vision-2030'),
    'يُمنع إضافة شعار رؤية المملكة 2030 في الشهادة'
  );
});

test('١٦. اعتماد الهوية البصرية النهائية (الأزرق البترولي الهادئ #376B70 وألوان الأقسام المتمايزة) في بطاقة وواجهة الشهادات دون المساس بألوان القوالب الداخلية', () => {
  const teacherHubSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/teacher/TeacherSectionHub.tsx'),
    'utf8'
  );
  const certsHubSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/certificates/CertificatesSectionHub.tsx'),
    'utf8'
  );

  // ١. التأكد من اعتماد الأزرق البترولي الهادئ #376B70 ودرجاته (#315E62 / #EAF2F1) ولون قسم المعلم الهادئ (#416B91 / #DCEAF5)
  assert.ok(
    teacherHubSource.includes('data-testid="teacher-group-card-certificates"') &&
      teacherHubSource.includes('#376B70') &&
      teacherHubSource.includes('#315E62') &&
      teacherHubSource.includes('#EAF2F1') &&
      teacherHubSource.includes('#416B91') &&
      teacherHubSource.includes('#DCEAF5'),
    'يجب أن تعتمد بطاقة قسم الشهادات اللون البترولي الهادئ (#376B70 / #EAF2F1) وبطاقات المعلم لون قسم المعلم الهادئ (#416B91 / #DCEAF5)'
  );

  // ٢. التأكد من خلو بطاقة الشهادات وواجهة الشهادات من الألوان السابقة (البني الترابي والعنابي والأخضر الفاقع)
  assert.ok(
    !teacherHubSource.includes('#795548') &&
      !teacherHubSource.includes('#634439') &&
      !teacherHubSource.includes('#07A869') &&
      !teacherHubSource.includes('#0DA9A6') &&
      !teacherHubSource.includes('#7A0F2E') &&
      !teacherHubSource.includes('emerald-'),
    'يجب عدم بقاء أي لون بني ترابي أو عنابي أو أخضر فاقع في بطاقة الشهادات داخل قسم المعلم'
  );
  assert.ok(
    certsHubSource.includes('#376B70') &&
      certsHubSource.includes('#315E62') &&
      certsHubSource.includes('#EAF2F1') &&
      !certsHubSource.includes('#795548') &&
      !certsHubSource.includes('#07A869') &&
      !certsHubSource.includes('#0DA9A6'),
    'يجب اعتماد الأزرق البترولي الهادئ #376B70 ودرجاته في عناصر التنقل والتحكم والأيقونات في واجهة الشهادات'
  );

  // ٣. التأكد من عدم تأثر ألوان القوالب الداخلية للشهادات والزخارف الذهبية
  assert.equal(Object.keys(CERTIFICATE_COLOR_SYSTEMS).length, 4);
  assert.equal(getCertificateColorPalette('1').goldHex, '#C1B489');
  assert.equal(getCertificateColorPalette('2').goldHex, '#C1B489');
  assert.equal(getCertificateColorPalette('3').goldHex, '#C1B489');
  assert.equal(getCertificateColorPalette('4').goldHex, '#C1B489');
});


