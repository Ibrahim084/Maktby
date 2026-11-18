import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import {
  decodeQrMatrix,
  generateQrMatrix,
  generateQrSvgDataUrl,
} from './qrCodeGenerator';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from './settingsStorage';
import {
  createDefaultSampleEvidencePhotos,
  createSampleTeacherReportDocument,
  generateTeacherReportPdf,
  getActiveTeacherEvidenceItems,
  getTeacherColorPalette,
  normalizeTeacherEvidence,
  paginateTeacherReportBlocks,
  TEACHER_COLOR_PALETTES,
} from './teacherPdfEngine';
import {
  computeReferenceTemplateHeaderPlan,
  measureReferenceTemplateBasicFieldsHeight,
  measureReferenceTemplateSectionHeight,
  TEACHER_TEMPLATE_DEFINITIONS,
} from './teacherPdfTemplates';

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

test('Teacher PDF settings: all 3 visual templates (قالب 1 / قالب 2 / قالب 3) and 3 color systems persist in site settings', () => {
  assert.equal(DEFAULT_SCHOOL_SETTINGS.teacherPdfTemplate, 'waves');
  assert.equal(DEFAULT_SCHOOL_SETTINGS.teacherPdfColorSystem, 'green');
  assert.equal(Object.keys(TEACHER_TEMPLATE_DEFINITIONS).length, 3);
  assert.equal(TEACHER_TEMPLATE_DEFINITIONS.waves.name, 'قالب 1');
  assert.equal(TEACHER_TEMPLATE_DEFINITIONS['waves-2'].name, 'قالب 2');
  assert.equal(TEACHER_TEMPLATE_DEFINITIONS.geometric.name, 'قالب 3');

  const store = createMemoryStorage();
  saveSettingsToStorage(
    {
      ...DEFAULT_SCHOOL_SETTINGS,
      teacherPdfTemplate: 'waves-2',
      teacherPdfColorSystem: 'blue',
    },
    store
  );

  const loaded1 = loadSettingsFromStorage(store);
  assert.equal(loaded1.teacherPdfTemplate, 'waves-2');
  assert.equal(loaded1.teacherPdfColorSystem, 'blue');

  saveSettingsToStorage(
    {
      ...loaded1,
      teacherPdfTemplate: 'geometric',
      teacherPdfColorSystem: 'slate',
    },
    store
  );
  const loaded2 = loadSettingsFromStorage(store);
  assert.equal(loaded2.teacherPdfTemplate, 'geometric');
  assert.equal(loaded2.teacherPdfColorSystem, 'slate');
});

test('Teacher Color Systems match exact specifications (#07A869 + #15445A for green, #3D7EB9 + #15445A for blue, أزرق رمادي for slate) and derive full ornamental shades', () => {
  const green = getTeacherColorPalette('green');
  assert.equal(green.primaryHex, '#07A869');
  assert.equal(green.secondaryHex, '#15445A');
  assert.ok(green.midToneHex.startsWith('#'));
  assert.ok(green.softToneHex.startsWith('#'));
  assert.ok(green.lightRibbonHex.startsWith('#'));
  assert.ok(green.headerBgHex.startsWith('#'));
  assert.ok(green.cardBgHex.startsWith('#'));

  const blue = getTeacherColorPalette('blue');
  assert.equal(blue.primaryHex, '#3D7EB9');
  assert.equal(blue.secondaryHex, '#15445A');
  assert.notEqual(blue.primaryHex, green.primaryHex);
  assert.notEqual(blue.softToneHex, green.softToneHex);

  const slate = getTeacherColorPalette('slate');
  assert.equal(slate.id, 'slate');
  assert.equal(slate.name, 'أزرق رمادي');
  assert.equal(slate.name.includes('مزرق'), false);
  assert.notEqual(slate.primaryHex, slate.headerBgHex);
  assert.equal(Object.keys(TEACHER_COLOR_PALETTES).length, 3);
});

test('Dynamic Header & Basic Fields Layout: prevents title overlap with logo and expands field rows/bars for long Arabic strings across all 3 templates', () => {
  const templates: TeacherPdfTemplateStyle[] = ['waves', 'waves-2', 'geometric'];
  const longReportDoc = {
    ...createSampleTeacherReportDocument({ mode: 'short' }),
    reportTypeLabel: 'تقرير معالجة مشكلة تعليمية وتطوير المهارات الأساسية للطلاب',
    reportMainTitle:
      'ضعف مهارة العمليات الحسابية على الكسور الاعتيادية والأعداد الكسرية وتوحيد المقامات في الصف الأول المتوسط',
  };

  for (const tpl of templates) {
    const plan = computeReferenceTemplateHeaderPlan(
      null,
      1240,
      64,
      1112,
      tpl,
      {
        ...DEFAULT_SCHOOL_SETTINGS,
        educationDepartment: 'الإدارة العامة للتعليم بمنطقة الباحة',
        schoolName: 'متوسطة الملك عبدالعزيز بقلوة للبنين',
      },
      { ...longReportDoc, templateStyle: tpl }
    );

    if (tpl === 'geometric') {
      // Title in left zone must wrap into 2+ lines and stay strictly within 320px (never crossing leftDividerX = 478)
      assert.ok(plan.geoTitleLayout.lines.length >= 2);
      assert.ok(plan.geoTitleLayout.maxLineWidth <= 320);
      assert.ok(plan.geoBannerLayout.lines.length >= 2);
      assert.ok(plan.geoBannerH > 54);
    } else if (tpl === 'waves-2') {
      assert.ok(plan.waves2TitleLayout.lines.length >= 2);
      assert.ok(plan.waves2TitleLayout.maxLineWidth <= 320);
      assert.ok(plan.waves2PillLayout.lines.length >= 2);
      assert.ok(plan.waves2PillH > 42);
    } else {
      assert.ok(plan.wavesTitleLayout.lines.length >= 1);
      assert.ok(plan.wavesSubtitleLayout && plan.wavesSubtitleLayout.lines.length >= 2);
    }

    // Dynamic basic fields height increases when field values are long
    const shortFieldsH = measureReferenceTemplateBasicFieldsHeight(
      null,
      1112,
      tpl,
      [
        { id: '1', label: 'اسم الممارسة', value: 'مختبر العلوم' },
        { id: '2', label: 'المادة الدراسية', value: 'العلوم' },
        { id: '3', label: 'المرحلة الدراسية', value: 'المتوسطة' },
        { id: '4', label: 'الصف', value: 'الأول المتوسط' },
      ]
    );
    const longFieldsH = measureReferenceTemplateBasicFieldsHeight(
      null,
      1112,
      tpl,
      [
        {
          id: '1',
          label: 'اسم الممارسة',
          value:
            'مختبر التحديات الرقمية التفاعلية لتعزيز مهارات التفكير البرمجي وحل المشكلات التقنية المعقدة داخل معمل الحاسب الآلي',
        },
        {
          id: '2',
          label: 'المادة الدراسية',
          value: 'المهارات الرقمية والحاسب وتقنية المعلومات والذكاء الاصطناعي',
        },
        { id: '3', label: 'المرحلة الدراسية', value: 'المرحلة الثانوية - المسار العام' },
        { id: '4', label: 'الصف', value: 'الأول الثانوي (الفصول ١ / ٢ / ٣)' },
      ]
    );
    assert.ok(
      longFieldsH > shortFieldsH,
      `Expected long basic fields height (${longFieldsH}) > short basic fields height (${shortFieldsH}) on ${tpl}`
    );

    // Dynamic section fields height increases when sub-field values are long
    const shortSubSecH = measureReferenceTemplateSectionHeight(null, 1112, tpl, {
      id: 'sec-sub',
      title: 'البيانات الأساسية',
      type: 'fields',
      fields: [
        { id: 'f1', label: 'مكان التطبيق', value: 'معمل الحاسب' },
        { id: 'f2', label: 'مدة التطبيق', value: 'أسبوعان' },
      ],
    });
    const longSubSecH = measureReferenceTemplateSectionHeight(null, 1112, tpl, {
      id: 'sec-sub',
      title: 'البيانات الأساسية',
      type: 'fields',
      fields: [
        {
          id: 'f1',
          label: 'مكان التطبيق',
          value:
            'معمل الحاسب الآلي المتقدم ومركز مصادر التعلم التفاعلي في المبنى المدرسي الرئيسي بالتعاون مع نادي الروبوت',
        },
        {
          id: 'f2',
          label: 'مدة التطبيق',
          value:
            'فصل دراسي كامل بواقع حصتين أسبوعياً وتدريبات إثرائية مساندة عبر منصة مدرستي',
        },
      ],
    });
    assert.ok(
      longSubSecH > shortSubSecH,
      `Expected long sub-fields section height (${longSubSecH}) > short sub-fields section height (${shortSubSecH}) on ${tpl}`
    );
  }
});

test('QR Code Generator & Scanner: generates ISO 18004 matrix and decodes back to exact original URL (camera-scannable)', () => {
  const urlsToTest = [
    'https://moe.gov.sa/ar/education/Pages/default.aspx',
    'https://ien.edu.sa/',
    'https://madrasati.sa/teacher/reports/evidence?id=2026&sec=active-learning',
  ];

  for (const url of urlsToTest) {
    const matrix = generateQrMatrix(url, 2);
    assert.ok(matrix.length >= 25);
    assert.equal(matrix.length, matrix[0].length);

    // Decode the QR matrix using ISO/IEC 18004 unmasking & zigzag reader
    const decodedUrl = decodeQrMatrix(matrix, 2);
    assert.equal(decodedUrl, url);

    const svgDataUrl = generateQrSvgDataUrl(url, '#15445A', '#FFFFFF', 2);
    assert.ok(svgDataUrl.startsWith('data:image/svg+xml;utf8,'));
  }
});

test('Independent Evidence Cases 1–5: (2 photos / 0 links), (0 photos / 2 links), (1 photo / 1 link), (2 photos / 2 links), and (0 photos / 0 links)', async () => {
  assert.equal(getActiveTeacherEvidenceItems([]).length, 0);

  // Case 1: 2 photos without links (صورتان دون روابط)
  const docCase1 = createSampleTeacherReportDocument({
    photoCount: 2,
    linkCount: 0,
  });
  const norm1 = normalizeTeacherEvidence(docCase1);
  assert.equal(norm1.photos.length, 2);
  assert.equal(norm1.links.length, 0);
  assert.equal(norm1.hasAny, true);
  const pdf1 = await generateTeacherReportPdf(docCase1, DEFAULT_SCHOOL_SETTINGS);
  assert.equal(pdf1.linkAnnotationsCount, 0);
  const pdfStr1 = new TextDecoder('latin1').decode(pdf1.pdfBytes);
  assert.equal(pdfStr1.includes('/Subtype /Link'), false);

  // Case 2: 2 links without photos (رابطان دون صور)
  const docCase2 = createSampleTeacherReportDocument({
    photoCount: 0,
    linkCount: 2,
  });
  const norm2 = normalizeTeacherEvidence(docCase2);
  assert.equal(norm2.photos.length, 0);
  assert.equal(norm2.links.length, 2);
  assert.equal(norm2.hasAny, true);
  const pdf2 = await generateTeacherReportPdf(docCase2, DEFAULT_SCHOOL_SETTINGS);
  assert.equal(pdf2.linkAnnotationsCount, 2);
  const pdfStr2 = new TextDecoder('latin1').decode(pdf2.pdfBytes);
  assert.equal(pdfStr2.includes('/Subtype /Link'), true);

  // Case 3: 1 photo and 1 link (صورة واحدة ورابط واحد)
  const docCase3 = createSampleTeacherReportDocument({
    photoCount: 1,
    linkCount: 1,
  });
  const norm3 = normalizeTeacherEvidence(docCase3);
  assert.equal(norm3.photos.length, 1);
  assert.equal(norm3.links.length, 1);
  const pdf3 = await generateTeacherReportPdf(docCase3, DEFAULT_SCHOOL_SETTINGS);
  assert.equal(pdf3.linkAnnotationsCount, 1);

  // Case 4: 2 photos and 2 links (صورتان ورابطان)
  const docCase4 = createSampleTeacherReportDocument({
    photoCount: 2,
    linkCount: 2,
  });
  const norm4 = normalizeTeacherEvidence(docCase4);
  assert.equal(norm4.photos.length, 2);
  assert.equal(norm4.links.length, 2);
  const pdf4 = await generateTeacherReportPdf(docCase4, DEFAULT_SCHOOL_SETTINGS);
  assert.equal(pdf4.linkAnnotationsCount, 2);

  // Case 5: No photos and no links (عدم إضافة أي صور أو روابط)
  const docCase5 = createSampleTeacherReportDocument({
    photoCount: 0,
    linkCount: 0,
  });
  const norm5 = normalizeTeacherEvidence(docCase5);
  assert.equal(norm5.photos.length, 0);
  assert.equal(norm5.links.length, 0);
  assert.equal(norm5.hasAny, false);
  const pages5 = paginateTeacherReportBlocks(docCase5, DEFAULT_SCHOOL_SETTINGS);
  const hasEvidenceBlock5 = pages5.some((p) =>
    p.blocks.some((b) => b.kind === 'evidence')
  );
  assert.equal(hasEvidenceBlock5, false);
});

test('Independent Evidence Cases 6–8: deleting a photo, replacing a photo, and editing a link before PDF export', async () => {
  const initialPhotos = createDefaultSampleEvidencePhotos('green');

  // Case 6: Delete photo 1 after upload -> leaves 1 photo
  const afterDeletePhotos = initialPhotos.filter((_, idx) => idx !== 0);
  assert.equal(afterDeletePhotos.length, 1);
  assert.equal(afterDeletePhotos[0].id, 'photo-2');

  // Case 7: Replace photo with a new custom PNG/WebP data URL
  const replacementDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const afterReplacePhotos = afterDeletePhotos.map((p, idx) =>
    idx === 0 ? { id: 'photo-replaced-1', imageDataUrl: replacementDataUrl } : p
  );
  assert.equal(afterReplacePhotos[0].imageDataUrl, replacementDataUrl);

  // Case 8: Edit link URL after entering it -> PDF link annotation & QR code update to new URL
  const editedUrl = 'https://madrasati.sa/evidence/updated-program-2026';
  const docEdited = createSampleTeacherReportDocument({
    evidencePhotos: afterReplacePhotos,
    evidenceLinks: [{ id: 'link-1', url: editedUrl }],
  });

  const pdfResult = await generateTeacherReportPdf(
    docEdited,
    DEFAULT_SCHOOL_SETTINGS
  );
  assert.equal(pdfResult.linkAnnotationsCount, 1);
  const pdfString = new TextDecoder('latin1').decode(pdfResult.pdfBytes);
  assert.ok(pdfString.includes(`/URI (${editedUrl})`));
  assert.equal(decodeQrMatrix(generateQrMatrix(editedUrl, 2), 2), editedUrl);
});

test('Cases 11 & 12: Pagination & Multi-Page handling across all 9 combinations (3 Templates × 3 Color Systems)', async () => {
  const templates: TeacherPdfTemplateStyle[] = ['waves', 'waves-2', 'geometric'];
  const colors: TeacherPdfColorSystem[] = ['green', 'blue', 'slate'];

  for (const tpl of templates) {
    for (const col of colors) {
      // Short report with 2 photos + 2 links stays on 1 page
      const shortDoc = createSampleTeacherReportDocument({
        templateStyle: tpl,
        colorSystem: col,
        mode: 'short',
        photoCount: 2,
        linkCount: 2,
      });
      const result = await generateTeacherReportPdf(shortDoc, {
        ...DEFAULT_SCHOOL_SETTINGS,
        schoolName: 'مدرسة النموذجية',
        educationDepartment: 'الإدارة التعليمية',
        principalName: 'أ. أحمد العتيبي',
      });

      assert.equal(result.pageCount, 1);
      assert.equal(result.linkAnnotationsCount, 2);
      assert.ok(result.filename.includes(tpl));
      assert.ok(result.filename.includes(col));

      const pdfString = new TextDecoder('latin1').decode(result.pdfBytes);
      assert.ok(pdfString.startsWith('%PDF-1.4'));
      assert.ok(pdfString.includes('/Subtype /Link'));
      assert.ok(
        pdfString.includes(
          '/URI (https://moe.gov.sa/ar/education/Pages/default.aspx)'
        )
      );
      assert.ok(pdfString.includes('/URI (https://ien.edu.sa/)'));

      // Multi-page report (3 pages minimum) flows cleanly without empty pages across all 3 templates
      const longDoc = createSampleTeacherReportDocument({
        templateStyle: tpl,
        colorSystem: col,
        mode: 'multi-page',
        photoCount: 2,
        linkCount: 2,
      });
      const longPages = paginateTeacherReportBlocks(
        longDoc,
        DEFAULT_SCHOOL_SETTINGS
      );
      assert.equal(longPages.length, 3);
      for (const p of longPages) {
        assert.ok(p.blocks.length > 0, 'No empty page is ever created');
      }
      assert.equal(
        longPages[0].blocks.some((b) => b.kind === 'signoff'),
        false,
        'Principal sign-off must not appear on Page 1 of a multi-page report'
      );
      assert.equal(
        longPages[1].blocks.some((b) => b.kind === 'signoff'),
        false,
        'Principal sign-off must not appear on Page 2 of a multi-page report'
      );
      const lastPage = longPages[longPages.length - 1];
      assert.equal(
        lastPage.blocks.some((b) => b.kind === 'signoff'),
        true,
        'Principal sign-off must appear on the last page (Page 3)'
      );

      // When principalName is empty/unavailable (in doc or in settings), sign-off footer is omitted and reserves 0 space
      const noPrincipalDoc = createSampleTeacherReportDocument({
        templateStyle: tpl,
        colorSystem: col,
        mode: 'short',
        principalName: '',
      });
      const noPrincipalPages = paginateTeacherReportBlocks(
        noPrincipalDoc,
        DEFAULT_SCHOOL_SETTINGS
      );
      assert.equal(
        noPrincipalPages.some((p) =>
          p.blocks.some((b) => b.kind === 'signoff')
        ),
        false,
        'Principal sign-off must be omitted when doc.principalName is empty'
      );

      const emptySettingsPrincipalDoc = {
        ...createSampleTeacherReportDocument({
          templateStyle: tpl,
          colorSystem: col,
          mode: 'short',
        }),
        principalName: undefined,
      };
      const emptySettingsPages = paginateTeacherReportBlocks(
        emptySettingsPrincipalDoc,
        {
          ...DEFAULT_SCHOOL_SETTINGS,
          principalName: '   ',
        }
      );
      assert.equal(
        emptySettingsPages.some((p) =>
          p.blocks.some((b) => b.kind === 'signoff')
        ),
        false,
        'Principal sign-off must be omitted when settings.principalName is empty and doc.principalName is undefined'
      );

      const longPdfResult = await generateTeacherReportPdf(
        longDoc,
        DEFAULT_SCHOOL_SETTINGS
      );
      assert.equal(longPdfResult.pageCount, 3);
      assert.equal(longPdfResult.linkAnnotationsCount, 2);
      const longPdfStr = new TextDecoder('latin1').decode(
        longPdfResult.pdfBytes
      );
      assert.ok(longPdfStr.includes('/Count 3'));
      assert.ok(longPdfStr.includes('/Im1'));
      assert.ok(longPdfStr.includes('/Im2'));
      assert.ok(longPdfStr.includes('/Im3'));
    }
  }
});
