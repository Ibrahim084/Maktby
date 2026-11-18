import { SchoolSettings } from '../types';
import {
  buildTeacherPdfBinaryWithLinks,
  TeacherPageJpegWithLinks,
} from './teacherPdfEngine';
import { sanitizeFilenameSegment } from './zipBuilder';

// Minimal 1x1 white JPEG for Node.js unit-test fallback when HTMLCanvasElement is unavailable
const MINIMAL_WHITE_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03,
  0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03,
  0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06, 0x06, 0x05, 0x06, 0x09,
  0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a, 0x0b,
  0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10,
  0x0a, 0x0c, 0x12, 0x13, 0x12, 0x10, 0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0,
  0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
  0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x7f, 0x9f, 0xff, 0xd9,
]);

// ============================================================================
// ١. الأبعاد القياسية للشهادات (A4 Landscape - اتجاه أفقي) والخطوط المحلية
// ============================================================================

export const CERTIFICATE_LANDSCAPE_WIDTH_PX = 2380;
export const CERTIFICATE_LANDSCAPE_HEIGHT_PX = 1684;
export const CERTIFICATE_PDF_WIDTH_PT = 841.89;
export const CERTIFICATE_PDF_HEIGHT_PT = 595.28;

export interface LocalCertificateFontDescriptor {
  family: string;
  relativePath: string;
  weight: string;
  style: string;
  scriptSupport: 'ar-en' | 'en';
}

/**
 * قائمة ملفات الخطوط المحلية المرفقة والمستخرجة داخل المشروع (IBM Plex Sans Arabic + Helvetica)
 */
export const CERTIFICATES_ATTACHED_FONTS: LocalCertificateFontDescriptor[] = [
  {
    family: 'IBM Plex Sans Arabic',
    relativePath: 'fonts/IBMPlexSansArabic-Light.ttf',
    weight: '300',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
  {
    family: 'IBM Plex Sans Arabic',
    relativePath: 'fonts/IBMPlexSansArabic-Regular.ttf',
    weight: '400',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
  {
    family: 'IBM Plex Sans Arabic',
    relativePath: 'fonts/IBMPlexSansArabic-Medium.ttf',
    weight: '500',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
  {
    family: 'IBM Plex Sans Arabic',
    relativePath: 'fonts/IBMPlexSansArabic-SemiBold.ttf',
    weight: '600',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
  {
    family: 'IBM Plex Sans Arabic',
    relativePath: 'fonts/IBMPlexSansArabic-Bold.ttf',
    weight: '700',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
  {
    family: 'HelveticaLocal',
    relativePath: 'fonts/helvetica/helvetica-light-587ebe5a59211.ttf',
    weight: '300',
    style: 'normal',
    scriptSupport: 'en',
  },
  {
    family: 'HelveticaLocal',
    relativePath: 'fonts/helvetica/Helvetica.ttf',
    weight: '400',
    style: 'normal',
    scriptSupport: 'en',
  },
  {
    family: 'HelveticaLocal',
    relativePath: 'fonts/helvetica/Helvetica-Oblique.ttf',
    weight: '400',
    style: 'italic',
    scriptSupport: 'en',
  },
  {
    family: 'HelveticaLocal',
    relativePath: 'fonts/helvetica/Helvetica-Bold.ttf',
    weight: '700',
    style: 'normal',
    scriptSupport: 'en',
  },
  {
    family: 'HelveticaLocal',
    relativePath: 'fonts/helvetica/Helvetica-BoldOblique.ttf',
    weight: '700',
    style: 'italic',
    scriptSupport: 'en',
  },
  {
    family: 'HelveticaRoundedLocal',
    relativePath: 'fonts/helvetica/helvetica-rounded-bold-5871d05ead8de.otf',
    weight: '700',
    style: 'normal',
    scriptSupport: 'en',
  },
  {
    family: 'Noto Naskh Arabic',
    relativePath: 'fonts/NotoNaskhArabic-Regular.ttf',
    weight: '400',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
  {
    family: 'Noto Naskh Arabic',
    relativePath: 'fonts/NotoNaskhArabic-Bold.ttf',
    weight: '700',
    style: 'normal',
    scriptSupport: 'ar-en',
  },
];

// ============================================================================
// ٢. الأنواع الأساسية لقسم الشهادات (Certificate Types & Options)
// ============================================================================

export type CertificateCategoryType =
  | 'appreciation' // شهادة شكر وتقدير
  | 'excellence' // شهادة تفوق
  | 'graduation'; // شهادة تخرج

export type AppreciationTargetRole =
  | 'teacher' // معلم
  | 'admin' // إداري
  | 'student'; // طالب

export type ExcellenceSourceVariant =
  | 'school-administration' // شهادة تفوق من إدارة المدرسة
  | 'teacher'; // شهادة تفوق مقدمة من المعلم أو المعلمة

export type CertificateLanguage = 'ar' | 'en';

export type CertificateTemplateId = '1' | '2' | '3';

export type CertificateColorSystemId = '1' | '2' | '3' | '4';

export type RecipientGender = 'male' | 'female';

export interface CertificateTemplateOption {
  id: CertificateTemplateId;
  uiLabel: string; // يظهر للمستخدم بأرقام فقط: قالب 1، قالب 2، قالب 3
}

export const CERTIFICATE_TEMPLATES: CertificateTemplateOption[] = [
  { id: '1', uiLabel: 'قالب 1' },
  { id: '2', uiLabel: 'قالب 2' },
  { id: '3', uiLabel: 'قالب 3' },
];

export interface CertificateColorPalette {
  id: CertificateColorSystemId;
  uiLabel: string; // يظهر للمستخدم بأرقام فقط: 1، 2، 3، 4
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  goldHex: string;
  neutralHex: string;
  whiteHex: string;
  headerBarHex: string;
  subLineHex: string;
  softTintHex: string;
  textDarkHex: string;
}

/**
 * أنظمة الألوان الأربعة المكونة حصرياً من الألوان المعتمدة:
 * #07A869, #0DA9A6, #3D7EB9, #15445A, #C1B489, #C2C1C1, #FFFFFF
 * تظهر للمستخدم بأرقام فقط: 1، 2، 3، 4.
 */
export const CERTIFICATE_COLOR_SYSTEMS: Record<
  CertificateColorSystemId,
  CertificateColorPalette
> = {
  '1': {
    id: '1',
    uiLabel: '1',
    primaryHex: '#07A869',
    secondaryHex: '#15445A',
    accentHex: '#0DA9A6',
    goldHex: '#C1B489',
    neutralHex: '#C2C1C1',
    whiteHex: '#FFFFFF',
    headerBarHex: '#07A869',
    subLineHex: '#0DA9A6',
    softTintHex: '#F4F9F6',
    textDarkHex: '#15445A',
  },
  '2': {
    id: '2',
    uiLabel: '2',
    primaryHex: '#15445A',
    secondaryHex: '#C1B489',
    accentHex: '#0DA9A6',
    goldHex: '#C1B489',
    neutralHex: '#C2C1C1',
    whiteHex: '#FFFFFF',
    headerBarHex: '#15445A',
    subLineHex: '#0DA9A6',
    softTintHex: '#F6F8FA',
    textDarkHex: '#15445A',
  },
  '3': {
    id: '3',
    uiLabel: '3',
    primaryHex: '#3D7EB9',
    secondaryHex: '#15445A',
    accentHex: '#0DA9A6',
    goldHex: '#C1B489',
    neutralHex: '#C2C1C1',
    whiteHex: '#FFFFFF',
    headerBarHex: '#15445A',
    subLineHex: '#0DA9A6',
    softTintHex: '#F4F8FC',
    textDarkHex: '#15445A',
  },
  '4': {
    id: '4',
    uiLabel: '4',
    primaryHex: '#0DA9A6',
    secondaryHex: '#07A869',
    accentHex: '#3D7EB9',
    goldHex: '#C1B489',
    neutralHex: '#C2C1C1',
    whiteHex: '#FFFFFF',
    headerBarHex: '#07A869',
    subLineHex: '#0DA9A6',
    softTintHex: '#F3FAFA',
    textDarkHex: '#15445A',
  },
};

export function getCertificateColorPalette(
  id: CertificateColorSystemId
): CertificateColorPalette {
  return CERTIFICATE_COLOR_SYSTEMS[id] ?? CERTIFICATE_COLOR_SYSTEMS['1'];
}

// ============================================================================
// ٣. نموذج بيانات الشهادة (Certificate Form State)
// ============================================================================

export interface CertificateFormState {
  certificateType: CertificateCategoryType;
  appreciationRole: AppreciationTargetRole;
  excellenceVariant: ExcellenceSourceVariant;
  language: CertificateLanguage;
  templateId: CertificateTemplateId;
  colorSystemId: CertificateColorSystemId;
  recipientGender: RecipientGender;

  // بيانات المدرسة والترويسة وحقول التخصيص المستقلة
  educationDepartment: string;
  schoolName: string;
  gradeName: string; // حقل مستقل للصف الدراسي (في شهادة التفوق من إدارة المدرسة)
  academicStage: string; // حقل مستقل للمرحلة الدراسية (في شهادة التخرج)
  academicYear: string; // حقل مستقل للعام الدراسي (في شهادة التخرج)

  // عنوان الشهادة القابل للتعديل
  certificateTitle: string;

  // الأقسام النصية الأربعة المستقلة
  openingText: string; // ١. النص الافتتاحي
  beneficiariesInput: string; // ٢. اسم المستفيد (يدعم مستفيداً واحداً أو عدة مستفيدين سطراً بسطر)
  mainText: string; // ٣. النص الرئيسي بعد الاسم
  additionalText: string; // ٤. نص إضافي اختياري

  // حقول التوقيع الاختيارية
  presenterTitle: string;
  presenterName: string;
  principalTitle: string;
  principalName: string;
  isPresenterSameAsPrincipal: boolean;
}

// ============================================================================
// ٤. توليد النصوص الافتراضية المعتمدة (Default Texts Builder - AR & EN)
// ============================================================================

export interface DefaultCertificateTextBundle {
  certificateTitle: string;
  openingText: string;
  defaultBeneficiarySample: string;
  mainText: string;
  additionalText: string;
  presenterTitle: string;
  principalTitle: string;
}

export function buildDefaultCertificateTexts(params: {
  certificateType: CertificateCategoryType;
  appreciationRole: AppreciationTargetRole;
  excellenceVariant: ExcellenceSourceVariant;
  language: CertificateLanguage;
  recipientGender: RecipientGender;
  presenterGender?: RecipientGender;
  schoolName?: string;
  gradeName?: string;
  academicStage?: string;
  academicYear?: string;
}): DefaultCertificateTextBundle {
  const {
    certificateType,
    appreciationRole,
    excellenceVariant,
    language,
    recipientGender,
    presenterGender = 'male',
    schoolName = '',
    academicStage = '',
    academicYear = '',
  } = params;

  const isFemaleRecipient = recipientGender === 'female';
  const isFemalePresenter = presenterGender === 'female';

  if (language === 'en') {
    const cleanSchoolEn = schoolName.trim() || '........... School';
    const cleanStageEn = academicStage.trim() || 'High School';
    const cleanYearEn = academicYear.trim() || '2026';
    const hisHer = isFemaleRecipient ? 'her' : 'his';
    const himHer = isFemaleRecipient ? 'her' : 'him';
    const principalTitleEn = 'School Principal';

    if (certificateType === 'appreciation') {
      if (appreciationRole === 'teacher') {
        return {
          certificateTitle: 'Certificate of Appreciation',
          openingText: `The Administration of ${cleanSchoolEn} proudly presents this Certificate of Appreciation to`,
          defaultBeneficiarySample: isFemaleRecipient
            ? 'Ms. ...........'
            : 'Mr. ...........',
          mainText: `In grateful recognition of ${hisHer} sincere dedication, continuous contribution to the noble mission of education, and inspiring role in nurturing conscious and distinguished generations, wishing ${himHer} continued success and excellence.`,
          additionalText: '',
          presenterTitle: '',
          principalTitle: principalTitleEn,
        };
      }

      if (appreciationRole === 'admin') {
        return {
          certificateTitle: 'Certificate of Appreciation',
          openingText: `The Administration of ${cleanSchoolEn} proudly presents this Certificate of Appreciation to`,
          defaultBeneficiarySample: isFemaleRecipient
            ? 'Ms. ...........'
            : 'Mr. ...........',
          mainText: `In appreciation of ${hisHer} outstanding efforts, dedication to ${hisHer} duties, and constant commitment to organizing and advancing school work with efficiency and excellence, with our sincere wishes for continued distinction.`,
          additionalText: '',
          presenterTitle: '',
          principalTitle: principalTitleEn,
        };
      }

      return {
        certificateTitle: 'Certificate of Appreciation',
        openingText: `The Administration of ${cleanSchoolEn} presents this Certificate of Appreciation to`,
        defaultBeneficiarySample: 'Student Name',
        mainText: `In recognition of ${hisHer} academic distinction, continuous diligence, and exemplary conduct throughout the academic year.`,
        additionalText: `Wishing ${himHer} continued success and achievement in ${hisHer} educational journey.`,
        presenterTitle: isFemalePresenter ? 'Teacher' : 'Teacher',
        principalTitle: principalTitleEn,
      };
    }

    if (certificateType === 'graduation') {
      return {
        certificateTitle: 'Certificate of Graduation',
        openingText: `The Administration of ${cleanSchoolEn} extends its warmest congratulations and best wishes to the student`,
        defaultBeneficiarySample: 'Student Name',
        mainText: `On the occasion of ${hisHer} graduation from the ${cleanStageEn} stage for the academic year ${cleanYearEn}, following a distinguished journey of diligence, perseverance, and excellence.`,
        additionalText: `We pray to Almighty Allah to grant ${himHer} continued success in ${hisHer} upcoming academic and professional endeavors, and to make ${himHer} a source of benefit to ${hisHer} faith and nation.`,
        presenterTitle: '',
        principalTitle: principalTitleEn,
      };
    }

    if (excellenceVariant === 'school-administration') {
      return {
        certificateTitle: 'Certificate of Excellence',
        openingText: `The Administration of ${cleanSchoolEn} extends its sincere appreciation to the distinguished student:`,
        defaultBeneficiarySample: 'Student Name',
        mainText: `In recognition of ${hisHer} outstanding academic excellence and achievement of the highest grades, wishing ${himHer} continued progress and success.`,
        additionalText: '',
        presenterTitle: '',
        principalTitle: principalTitleEn,
      };
    }

    return {
      certificateTitle: 'Certificate of Excellence',
      openingText: 'To the Distinguished Student',
      defaultBeneficiarySample: 'Student Name',
      mainText:
        'Excellence is not a destination, but a continuous journey. Throughout this academic year, you have proven to be a true model of diligence, perseverance, and passion for learning. It gives me great pleasure to express my profound appreciation for your achievement and excellence, praying to Allah to grant you continued success and distinction.',
      additionalText: '',
      presenterTitle: 'Subject Teacher',
      principalTitle: principalTitleEn,
    };
  }

  // ==========================================================================
  // النصوص الافتراضية باللغة العربية (مطابقة تماماً للمواصفات مع منع تكرار لفظ مدرسة)
  // ==========================================================================
  const rawSchoolTrimmed = schoolName.trim().replace(/^مدرسة\s+/u, '');
  const cleanSchoolAr = rawSchoolTrimmed || '.......';
  const cleanStageAr = academicStage.trim().replace(/^المرحلة\s+/u, '') || 'الثانوية';
  const cleanYearAr = academicYear.trim() || '٢٠٢٦م';
  const principalTitleAr = isFemalePresenter ? 'مديرة المدرسة' : 'مدير المدرسة';

  if (certificateType === 'appreciation') {
    if (appreciationRole === 'teacher') {
      return {
        certificateTitle: 'شهادة شكر وتقدير',
        openingText: `تتقدم ادارة مدرسة ${cleanSchoolAr} بوافر الشكر والتقدير الى`,
        defaultBeneficiarySample: isFemaleRecipient
          ? 'الأستاذة ...........'
          : 'الاستاذ ...........',
        mainText: isFemaleRecipient
          ? 'تقديراً لجهودها المخلصة وعطائها المستمر في رسالة العلم السامية، ودورها المؤثر في بناء أجيال واعية ومتميزة، متمنين لها دوام التوفيق والنجاح.'
          : 'تقديراً لجهوده المخلصة وعطائه المستمر في رسالة العلم السامية، ودوره المؤثر في بناء أجيال واعية ومتميزة، متمنين له دوام التوفيق والنجاح.',
        additionalText: '',
        presenterTitle: '',
        principalTitle: principalTitleAr,
      };
    }

    if (appreciationRole === 'admin') {
      return {
        certificateTitle: 'شهادة شكر وتقدير',
        openingText: `تتقدم ادارة مدرسة ${cleanSchoolAr} بوافر الشكر والتقدير الى`,
        defaultBeneficiarySample: isFemaleRecipient
          ? 'الأستاذة ...........'
          : 'الاستاذ ...........',
        mainText: isFemaleRecipient
          ? 'تقديراً لجهودها المتميزة وتفانيها في أداء عملها وحرصها الدائم على تنظيم وسير العمل بكفاءة وإتقان، مع خالص تمنياتنا لها بمزيد من التألق والتميّز'
          : 'تقديراً لجهوده المتميزة وتفانيه في أداء عمله وحرصه الدائم على تنظيم وسير العمل بكفاءة وإتقان، مع خالص تمنياتنا له بمزيد من التألق والتميّز',
        additionalText: '',
        presenterTitle: '',
        principalTitle: principalTitleAr,
      };
    }

    const cleanSchoolStudent = rawSchoolTrimmed || '..............';
    return {
      certificateTitle: 'شهادة شكر وتقدير',
      openingText: `تتقدم ادارة مدرسة ${cleanSchoolStudent} بالشكر والتقدير الى`,
      defaultBeneficiarySample: isFemaleRecipient
        ? 'الطالبة / ...........'
        : 'الطالب / ...........',
      mainText: isFemaleRecipient
        ? 'وذلك لتميّزها الدراسي، واجتهادها المستمر، وأخلاقها العالية طوال العام الدراسي.'
        : 'وذلك لتميّزه الدراسي، واجتهاده المستمر، وأخلاقه العالية طوال العام الدراسي.',
      additionalText: isFemaleRecipient
        ? 'متمنين لها دوام التوفيق والنجاح في مسيرتها التعليمية.'
        : 'متمنين له دوام التوفيق والنجاح في مسيرته التعليمية.',
      presenterTitle: isFemalePresenter ? 'معلمة المادة' : 'معلم المادة',
      principalTitle: principalTitleAr,
    };
  }

  if (certificateType === 'graduation') {
    const cleanSchoolGrad = rawSchoolTrimmed || '..........';
    return {
      certificateTitle: 'شهادة تخرج',
      openingText: isFemaleRecipient
        ? `تتقدم ادارة مدرسة ${cleanSchoolGrad} بخالص التهاني والتبريكات الى الطالبة`
        : `تتقدم ادارة مدرسة ${cleanSchoolGrad} بخالص التهاني والتبريكات الى الطالب`,
      defaultBeneficiarySample: isFemaleRecipient
        ? 'الطالبة / ...........'
        : 'الطالب / ...........',
      mainText: isFemaleRecipient
        ? `بمناسبة تخرجها من المرحلة ${cleanStageAr} للعام الدراسي ${cleanYearAr}، وذلك بعد مسيرة حافلة بالجد والاجتهاد والتميز.`
        : `بمناسبة تخرجه من المرحلة ${cleanStageAr} للعام الدراسي ${cleanYearAr}، وذلك بعد مسيرة حافلة بالجد والاجتهاد والتميز.`,
      additionalText: isFemaleRecipient
        ? 'سائلين الله عز وجل لها دوام التوفيق والنجاح في مسيرتها العلمية والعملية القادمة، وأن ينفع بها دينها ووطنها.'
        : 'سائلين الله عز وجل له دوام التوفيق والنجاح في مسيرته العلمية والعملية القادمة، وأن ينفع به دينه ووطنه.',
      presenterTitle: '',
      principalTitle: principalTitleAr,
    };
  }

  if (excellenceVariant === 'school-administration') {
    const cleanSchoolExc = rawSchoolTrimmed || '..........';
    return {
      certificateTitle: 'شهادة تفوق',
      openingText: isFemaleRecipient
        ? `تتقدم إدارة مدرسة ${cleanSchoolExc} بخالص الشكر والتقدير للطالبة المتميزة:`
        : `تتقدم إدارة مدرسة ${cleanSchoolExc} بخالص الشكر والتقدير للطالب المتميز:`,
      defaultBeneficiarySample: isFemaleRecipient
        ? 'الطالبة / ...........'
        : 'الطالب / ...........',
      mainText: isFemaleRecipient
        ? 'وذلك تقديراً لتفوقها الدراسي الباهر وحصولها على أعلى الدرجات، متمنين لها دوام التقدم والنجاح.'
        : 'وذلك تقديراً لتفوقه الدراسي الباهر وحصوله على أعلى الدرجات، متمنين له دوام التقدم والنجاح.',
      additionalText: '',
      presenterTitle: '',
      principalTitle: principalTitleAr,
    };
  }

  const prayerWord = isFemalePresenter ? 'داعيةً' : 'داعياً';
  return {
    certificateTitle: 'شهادة تفوق',
    openingText: isFemaleRecipient
      ? 'الى الطالبة المتميزة'
      : 'الى الطالب المتميز',
    defaultBeneficiarySample: isFemaleRecipient
      ? 'الطالبة / ...........'
      : 'الطالب / ...........',
    mainText: isFemaleRecipient
      ? `إن التميز ليس غاية بل هو رحلة، وقد أثبتِّ خلال هذا العام الدراسي أنكِ عنوان للجد والاجتهاد والشغف بالعلم. لذا يطيب لي أن أعبر عن بالغ تقديري لإنجازكِ وتفوقكِ، ${prayerWord} الله لكِ بمزيد من العطاء والتفوق.`
      : `إن التميز ليس غاية بل هو رحلة، وقد أثبتّ خلال هذا العام الدراسي أنك عنوان للجد والاجتهاد والشغف بالعلم. لذا يطيب لي أن أعبر عن بالغ تقديري لإنجازك وتفوقك، ${prayerWord} الله لك بمزيد من العطاء والتفوق.`,
    additionalText: '',
    presenterTitle: isFemalePresenter ? 'معلمة المادة' : 'معلم المادة',
    principalTitle: principalTitleAr,
  };
}

// ============================================================================
// ٥. إنشاء الحالة الابتدائية وحفظ المسودات (Initial State & LocalStorage)
// ============================================================================

const CERTIFICATES_STORAGE_KEY = 'maktabi_certificates_section_draft_v1';

export function createInitialCertificateFormState(
  settings: SchoolSettings
): CertificateFormState {
  const recipientGender: RecipientGender =
    settings.gender === 'female' ? 'female' : 'male';
  const schoolName = settings.schoolName?.trim() || '';
  const educationDepartment = settings.educationDepartment?.trim() || '';
  const academicYear = settings.academicYear?.trim() || '';
  const gradeName = 'الأول الثانوي';
  const academicStage = 'الثانوية';

  const defaults = buildDefaultCertificateTexts({
    certificateType: 'appreciation',
    appreciationRole: 'teacher',
    excellenceVariant: 'school-administration',
    language: 'ar',
    recipientGender,
    presenterGender: recipientGender,
    schoolName,
    gradeName,
    academicStage,
    academicYear,
  });

  return {
    certificateType: 'appreciation',
    appreciationRole: 'teacher',
    excellenceVariant: 'school-administration',
    language: 'ar',
    templateId: '1',
    colorSystemId: '1',
    recipientGender,
    educationDepartment,
    schoolName,
    gradeName,
    academicStage,
    academicYear,
    certificateTitle: defaults.certificateTitle,
    openingText: defaults.openingText,
    beneficiariesInput: '',
    mainText: defaults.mainText,
    additionalText: defaults.additionalText,
    presenterTitle: defaults.presenterTitle,
    presenterName: '',
    principalTitle: defaults.principalTitle,
    principalName: settings.principalName?.trim() || '',
    isPresenterSameAsPrincipal: false,
  };
}

export function loadCertificateDraft(
  settings: SchoolSettings
): CertificateFormState {
  const fallback = createInitialCertificateFormState(settings);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(CERTIFICATES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
}

export function saveCertificateDraft(state: CertificateFormState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CERTIFICATES_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function clearCertificateDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CERTIFICATES_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// ٦. تحليل قائمة المستفيدين وتجهيز اسم كل مستفيد في الشهادة المستقلة
// ============================================================================

export function parseCertificateBeneficiaryNames(rawInput: string): string[] {
  const lines = String(rawInput ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [''];
  }
  return lines;
}

export function formatBeneficiaryDisplayLine(
  beneficiaryName: string,
  state: Pick<
    CertificateFormState,
    'certificateType' | 'excellenceVariant' | 'gradeName' | 'language'
  >
): string {
  const cleanName = beneficiaryName.trim();
  if (!cleanName) return '—';

  if (
    state.certificateType === 'excellence' &&
    state.excellenceVariant === 'school-administration' &&
    state.gradeName.trim()
  ) {
    const rawGrade = state.gradeName.trim();
    if (state.language === 'en') {
      const normalizedGradeEn = rawGrade.replace(/^grade\s+/i, '');
      if (
        cleanName.toLowerCase().includes('grade') ||
        cleanName.includes(rawGrade)
      ) {
        return cleanName;
      }
      return `${cleanName}, Grade ${normalizedGradeEn}`;
    } else {
      const normalizedGradeAr = rawGrade.replace(/^(بالصف|الصف)\s+/u, '');
      if (cleanName.includes('بالصف') || cleanName.includes(normalizedGradeAr)) {
        return cleanName;
      }
      return `${cleanName} بالصف ${normalizedGradeAr}،`;
    }
  }

  return cleanName;
}

// ============================================================================
// ٧. حل التوقيعات الذكي ومنع تكرار مدير المدرسة أو إظهار حقول فارغة
// ============================================================================

export interface ResolvedSignatureBlock {
  title: string;
  name: string;
}

export interface ResolvedCertificateFooterSignatures {
  /** في العربية: الجهة اليمنى = مقدم الشهادة، الجهة اليسرى = مدير المدرسة. وفي الإنجليزية تنعكس الجهتان */
  rightBlock: ResolvedSignatureBlock | null;
  leftBlock: ResolvedSignatureBlock | null;
}

export function resolveCertificateFooterSignatures(
  state: Pick<
    CertificateFormState,
    | 'language'
    | 'presenterTitle'
    | 'presenterName'
    | 'principalTitle'
    | 'principalName'
    | 'isPresenterSameAsPrincipal'
  >
): ResolvedCertificateFooterSignatures {
  const pName = state.principalName.trim();
  const pTitle =
    state.principalTitle.trim() ||
    (state.language === 'en' ? 'School Principal' : 'مدير المدرسة');

  const presName = state.presenterName.trim();
  const presTitle = state.presenterTitle.trim();

  const normalizedPrincipal = pName.replace(/\s+/g, ' ').toLowerCase();
  const normalizedPresenter = presName.replace(/\s+/g, ' ').toLowerCase();
  const isTitlePrincipal =
    presTitle === 'مدير المدرسة' ||
    presTitle === 'مديرة المدرسة' ||
    presTitle.toLowerCase() === 'school principal';

  const isDuplicatePrincipal =
    state.isPresenterSameAsPrincipal ||
    isTitlePrincipal ||
    (Boolean(normalizedPrincipal) &&
      Boolean(normalizedPresenter) &&
      normalizedPrincipal === normalizedPresenter);

  const principalBlock: ResolvedSignatureBlock | null = pName
    ? { title: pTitle, name: pName }
    : null;

  const presenterBlock: ResolvedSignatureBlock | null =
    !isDuplicatePrincipal && presName
      ? {
          title:
            presTitle ||
            (state.language === 'en' ? 'Presented By' : 'مقدم الشهادة'),
          name: presName,
        }
      : null;

  if (state.language === 'en') {
    return {
      leftBlock: presenterBlock,
      rightBlock: principalBlock,
    };
  }

  return {
    rightBlock: presenterBlock,
    leftBlock: principalBlock,
  };
}

// ============================================================================
// ٨. محرك قياس وتقسيم النصوص والضبط التلقائي للأحجام في الاتجاه الأفقي (Landscape)
// ============================================================================

export interface CertificateBodyLayoutPlan {
  scale: number;
  openingFontPx: number;
  beneficiaryFontPx: number;
  mainFontPx: number;
  additionalFontPx: number;
  openingLines: string[];
  beneficiaryLines: string[];
  mainLines: string[];
  additionalLines: string[];
  beneficiaryBoxHeight: number;
  totalContentHeight: number;
  startY: number;
  gapAfterOpening: number;
  gapAfterBeneficiary: number;
  gapAfterMain: number;
}

function estimateTextWidthFallback(text: string, fontPx: number): number {
  return text.length * fontPx * 0.5;
}

function measureLinePx(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  fontPx: number,
  fontFamily: string,
  fontWeight = '700'
): number {
  if (!ctx) {
    return estimateTextWidthFallback(text, fontPx);
  }
  ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

export function wrapCertificateTextLines(
  ctx: CanvasRenderingContext2D | null,
  rawText: string,
  maxWidthPx: number,
  fontPx: number,
  fontFamily: string,
  fontWeight = '600'
): string[] {
  const cleaned = String(rawText ?? '').trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let currentLine = '';

    for (const word of words) {
      const wordWidth = measureLinePx(ctx, word, fontPx, fontFamily, fontWeight);

      if (wordWidth > maxWidthPx) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        let chunk = '';
        for (const ch of Array.from(word)) {
          const candidateChunk = chunk + ch;
          if (
            measureLinePx(ctx, candidateChunk, fontPx, fontFamily, fontWeight) <=
              maxWidthPx ||
            chunk.length === 0
          ) {
            chunk = candidateChunk;
          } else {
            lines.push(chunk);
            chunk = ch;
          }
        }
        if (chunk) {
          currentLine = chunk;
        }
        continue;
      }

      if (!currentLine) {
        currentLine = word;
      } else {
        const candidate = `${currentLine} ${word}`;
        const width = measureLinePx(
          ctx,
          candidate,
          fontPx,
          fontFamily,
          fontWeight
        );
        if (width <= maxWidthPx) {
          currentLine = candidate;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export function getCertificateFontFamily(
  language: CertificateLanguage,
  role: 'body' | 'name' | 'header' | 'title'
): string {
  if (language === 'en') {
    if (role === 'title' || role === 'name') {
      return '"HelveticaLocal", "HelveticaRoundedLocal", "IBM Plex Sans Arabic", sans-serif';
    }
    return '"HelveticaLocal", "IBM Plex Sans Arabic", sans-serif';
  }
  if (role === 'title') {
    return '"Noto Naskh Arabic", "IBM Plex Sans Arabic", serif';
  }
  return '"IBM Plex Sans Arabic", "Noto Naskh Arabic", sans-serif';
}

export function computeCertificateBodyLayout(
  ctx: CanvasRenderingContext2D | null,
  params: {
    openingText: string;
    beneficiaryDisplay: string;
    mainText: string;
    additionalText: string;
    language: CertificateLanguage;
    bodyTopY: number;
    bodyBottomY: number;
    maxTextWidth: number;
  }
): CertificateBodyLayoutPlan {
  const {
    openingText,
    beneficiaryDisplay,
    mainText,
    additionalText,
    language,
    bodyTopY,
    bodyBottomY,
    maxTextWidth,
  } = params;

  const availableHeight = Math.max(360, bodyBottomY - bodyTopY);
  const bodyFontFamily = getCertificateFontFamily(language, 'body');
  const nameFontFamily = getCertificateFontFamily(language, 'name');

  const hasAdditional = additionalText.trim().length > 0;

  const scales = [
    1.0, 0.94, 0.88, 0.82, 0.76, 0.7, 0.65, 0.6, 0.55, 0.5,
  ];

  let chosenPlan: CertificateBodyLayoutPlan | null = null;

  for (const scale of scales) {
    // أحجام خطوط متوازنة تمنح الشهادة حضوراً بصرياً غنياً وتقضي على الفراغ المفرط
    const openingFontPx = Math.round(42 * scale);
    let beneficiaryFontPx = Math.round(68 * scale);
    const mainFontPx = Math.round(42 * scale);
    const additionalFontPx = Math.round(36 * scale);

    const beneMaxWidth = Math.min(1260, maxTextWidth - 140);
    while (
      beneficiaryFontPx > Math.round(32 * scale) &&
      measureLinePx(ctx, beneficiaryDisplay, beneficiaryFontPx, nameFontFamily, '700') >
        beneMaxWidth
    ) {
      beneficiaryFontPx -= 2;
    }

    const openingLines = wrapCertificateTextLines(
      ctx,
      openingText,
      maxTextWidth,
      openingFontPx,
      bodyFontFamily,
      '600'
    );

    const beneficiaryLines = wrapCertificateTextLines(
      ctx,
      beneficiaryDisplay,
      beneMaxWidth,
      beneficiaryFontPx,
      nameFontFamily,
      '700'
    );

    const mainLines = wrapCertificateTextLines(
      ctx,
      mainText,
      maxTextWidth,
      mainFontPx,
      bodyFontFamily,
      '600'
    );

    const additionalLines = hasAdditional
      ? wrapCertificateTextLines(
          ctx,
          additionalText,
          maxTextWidth - 60,
          additionalFontPx,
          bodyFontFamily,
          '600'
        )
      : [];

    const openingLineH = Math.round(openingFontPx * 1.58);
    const beneLineH = Math.round(beneficiaryFontPx * 1.36);
    const mainLineH = Math.round(mainFontPx * 1.76);
    const additionalLineH = Math.round(additionalFontPx * 1.65);

    const openingBlockH = openingLines.length * openingLineH;
    const beneficiaryBoxHeight = Math.max(
      Math.round(144 * scale),
      beneficiaryLines.length * beneLineH + Math.round(52 * scale)
    );
    const mainBlockH = mainLines.length * mainLineH;
    const additionalBlockH = hasAdditional
      ? additionalLines.length * additionalLineH + Math.round(16 * scale)
      : 0;

    const gapAfterOpening = openingLines.length > 0 ? Math.round(40 * scale) : 0;
    const gapAfterBeneficiary = Math.round(48 * scale);
    const gapAfterMain = hasAdditional ? Math.round(32 * scale) : 0;

    const totalContentHeight =
      openingBlockH +
      gapAfterOpening +
      beneficiaryBoxHeight +
      gapAfterBeneficiary +
      mainBlockH +
      gapAfterMain +
      additionalBlockH;

    const startY =
      bodyTopY + Math.max(8, Math.round((availableHeight - totalContentHeight) / 2));

    chosenPlan = {
      scale,
      openingFontPx,
      beneficiaryFontPx,
      mainFontPx,
      additionalFontPx,
      openingLines,
      beneficiaryLines,
      mainLines,
      additionalLines,
      beneficiaryBoxHeight,
      totalContentHeight,
      startY,
      gapAfterOpening,
      gapAfterBeneficiary,
      gapAfterMain,
    };

    const totalLinesCount =
      openingLines.length +
      beneficiaryLines.length +
      mainLines.length +
      additionalLines.length;
    const totalCharLength =
      openingText.trim().length +
      beneficiaryDisplay.trim().length +
      mainText.trim().length +
      additionalText.trim().length;

    const fitsHeightComfortably = totalContentHeight <= availableHeight * 0.88;
    const fitsLineDensity =
      scale <= 0.82 || (totalLinesCount <= 7 && totalCharLength <= 340);

    if (fitsHeightComfortably && fitsLineDensity) {
      break;
    }
  }

  return chosenPlan!;
}

// ============================================================================
// ٩. تحميل الخطوط المحلية وشعار وزارة التعليم والمخطوطات الخطية العربية
// ============================================================================

let localFontsLoadedPromise: Promise<void> | null = null;

export function ensureLocalCertificateFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    return Promise.resolve();
  }
  if (localFontsLoadedPromise) {
    return localFontsLoadedPromise;
  }

  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  localFontsLoadedPromise = Promise.all(
    CERTIFICATES_ATTACHED_FONTS.map(async (fd) => {
      try {
        const face = new FontFace(
          fd.family,
          `url(${normalizedBase}${fd.relativePath})`,
          {
            weight: fd.weight,
            style: fd.style,
          }
        );
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        // Fallback gracefully if already loaded via CSS @font-face
      }
    })
  )
    .then(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    })
    .then(() => undefined);

  return localFontsLoadedPromise;
}

const imageCache = new Map<string, HTMLImageElement | null>();

function loadLocalImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src) ?? null);
  }
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(src, null);
      resolve(null);
    };
    img.src = src;
  });
}

interface CertificateVisualAssets {
  moeLogo: HTMLImageElement | null;
  titleAppreciationAr: HTMLImageElement | null;
  titleExcellenceAr: HTMLImageElement | null;
  titleGraduationAr: HTMLImageElement | null;
  titleShukrIrfanAr: HTMLImageElement | null;
  titleShukrModernAr: HTMLImageElement | null;
  titleShukrWaveAr: HTMLImageElement | null;
  titleTafawuqDirasiAr: HTMLImageElement | null;
  medalSeal: HTMLImageElement | null;
}

async function loadCertificateVisualAssets(): Promise<CertificateVisualAssets> {
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  const [
    moeLogo,
    titleAppreciationAr,
    titleExcellenceAr,
    titleGraduationAr,
    titleShukrIrfanAr,
    titleShukrModernAr,
    titleShukrWaveAr,
    titleTafawuqDirasiAr,
    medalSeal,
  ] = await Promise.all([
    loadLocalImage(`${normalizedBase}moe-logo.png`),
    loadLocalImage(`${normalizedBase}certificates/title-appreciation-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/title-excellence-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/title-graduation-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/title-shukr-irfan-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/title-shukr-modern-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/title-shukr-wave-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/title-tafawuq-dirasi-ar.png`),
    loadLocalImage(`${normalizedBase}certificates/medal-seal.png`),
  ]);

  return {
    moeLogo,
    titleAppreciationAr,
    titleExcellenceAr,
    titleGraduationAr,
    titleShukrIrfanAr,
    titleShukrModernAr,
    titleShukrWaveAr,
    titleTafawuqDirasiAr,
    medalSeal,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '').trim();
  const num = parseInt(cleaned, 16);
  if (Number.isNaN(num)) return { r: 21, g: 68, b: 90 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

const tintedAssetCache = new Map<string, HTMLCanvasElement>();

/**
 * يرسم المخطوطة الخطية العربية مع تلوين الحبر الأساسي والتشكيل الزخرفي بدقة عالية
 * مع تخزين مؤقت (Caching) لضمان سرعة المعاينة المباشرة.
 */
function drawPaletteTintedAsset(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  targetW: number,
  targetH: number,
  darkTargetHex: string,
  goldTargetHex = '#C1B489'
) {
  if (typeof document === 'undefined') return;
  const cacheKey = `${img.src}|${darkTargetHex.toUpperCase()}|${goldTargetHex.toUpperCase()}`;
  let cachedCanvas = tintedAssetCache.get(cacheKey);

  if (!cachedCanvas) {
    const off = document.createElement('canvas');
    off.width = img.naturalWidth || img.width;
    off.height = img.naturalHeight || img.height;
    const offCtx = off.getContext('2d');
    if (!offCtx || off.width === 0 || off.height === 0) {
      ctx.drawImage(
        img,
        centerX - targetW / 2,
        centerY - targetH / 2,
        targetW,
        targetH
      );
      return;
    }

    offCtx.drawImage(img, 0, 0);
    const targetRgb = hexToRgb(darkTargetHex);
    const goldRgb = hexToRgb(goldTargetHex);
    const isWhiteInk = darkTargetHex.toUpperCase() === '#FFFFFF';

    const imgData = offCtx.getImageData(0, 0, off.width, off.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 8) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const isGoldPixel = r > 125 && g > 95 && r > b + 20;
      if (isGoldPixel) {
        data[i] = goldRgb.r;
        data[i + 1] = goldRgb.g;
        data[i + 2] = goldRgb.b;
      } else if (isWhiteInk) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const shade = Math.min(1.18, Math.max(0.78, lum * 1.75));
        data[i] = Math.min(255, Math.round(targetRgb.r * shade));
        data[i + 1] = Math.min(255, Math.round(targetRgb.g * shade));
        data[i + 2] = Math.min(255, Math.round(targetRgb.b * shade));
      }
    }
    offCtx.putImageData(imgData, 0, 0);
    cachedCanvas = off;
    tintedAssetCache.set(cacheKey, off);
  }

  const srcW = cachedCanvas.width || targetW;
  const srcH = cachedCanvas.height || targetH;
  const scale = Math.min(targetW / srcW, targetH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;

  ctx.drawImage(
    cachedCanvas,
    centerX - drawW / 2,
    centerY - drawH / 2,
    drawW,
    drawH
  );
}

// ============================================================================
// ١٠. رسم العناوين الخطية العربية الأصيلة بحضور بصري فخم ومتمركز
// ============================================================================

export function stylizeArabicCalligraphicTitle(
  rawTitle: string,
  certificateType: CertificateCategoryType,
  language: CertificateLanguage
): string {
  const trimmed = rawTitle.trim();
  if (language === 'en') {
    return (
      trimmed ||
      (certificateType === 'appreciation'
        ? 'Certificate of Appreciation'
        : certificateType === 'excellence'
          ? 'Certificate of Excellence'
          : 'Certificate of Graduation')
    );
  }

  if (
    trimmed === 'شهادة شكر وتقدير' ||
    (!trimmed && certificateType === 'appreciation')
  ) {
    return 'شَهَادَةُ شُكْرٍ وَتَقْدِيرٍ';
  }
  if (
    trimmed === 'شهادة تفوق' ||
    (!trimmed && certificateType === 'excellence')
  ) {
    return 'شَهَادَةُ تَفَوُّقٍ';
  }
  if (
    trimmed === 'شهادة تخرج' ||
    (!trimmed && certificateType === 'graduation')
  ) {
    return 'شَهَادَةُ تَخَرُّجٍ';
  }
  return trimmed;
}

function isStandardArabicTitleForType(
  rawTitle: string,
  certificateType: CertificateCategoryType
): boolean {
  const trimmed = rawTitle.trim();
  if (!trimmed) return true;
  if (certificateType === 'appreciation') {
    return (
      trimmed === 'شهادة شكر وتقدير' ||
      trimmed === 'شَهَادَةُ شُكْرٍ وَتَقْدِيرٍ' ||
      trimmed === 'شكر وتقدير' ||
      trimmed === 'شكر وعرفان'
    );
  }
  if (certificateType === 'excellence') {
    return (
      trimmed === 'شهادة تفوق' ||
      trimmed === 'شَهَادَةُ تَفَوُّقٍ' ||
      trimmed === 'شهادة تفوق دراسي' ||
      trimmed === 'شهادة تميز'
    );
  }
  if (certificateType === 'graduation') {
    return trimmed === 'شهادة تخرج' || trimmed === 'شَهَادَةُ تَخَرُّجٍ';
  }
  return false;
}

/**
 * اختيار المخطوطة الخطية العربية المناسبة لكل نوع من الأنواع الستة بحجم كبير وواضح
 * يجعل العنوان المخطوط نقطة التركيز الرئيسية في الجزء العلوي من الشهادة.
 */
function selectCalligraphicManuscriptForState(
  state: CertificateFormState,
  assets: CertificateVisualAssets
): { img: HTMLImageElement | null; maxW: number; maxH: number } {
  const trimmed = state.certificateTitle.trim();

  if (trimmed === 'شكر وعرفان' && assets.titleShukrIrfanAr) {
    return { img: assets.titleShukrIrfanAr, maxW: 720, maxH: 285 };
  }
  if (trimmed === 'شكر وتقدير' && assets.titleShukrWaveAr) {
    return { img: assets.titleShukrWaveAr, maxW: 790, maxH: 265 };
  }
  if (trimmed === 'شهادة تفوق دراسي' && assets.titleTafawuqDirasiAr) {
    return { img: assets.titleTafawuqDirasiAr, maxW: 820, maxH: 275 };
  }

  if (state.certificateType === 'appreciation') {
    if (state.appreciationRole === 'teacher') {
      if (state.templateId === '3' && assets.titleAppreciationAr) {
        return { img: assets.titleAppreciationAr, maxW: 860, maxH: 235 };
      }
      return {
        img: assets.titleShukrModernAr ?? assets.titleAppreciationAr,
        maxW: 820,
        maxH: 290,
      };
    }

    if (state.appreciationRole === 'admin') {
      if (state.templateId === '1' && assets.titleShukrIrfanAr) {
        return { img: assets.titleShukrIrfanAr, maxW: 720, maxH: 285 };
      }
      return {
        img: assets.titleAppreciationAr ?? assets.titleShukrModernAr,
        maxW: 860,
        maxH: 235,
      };
    }

    if (state.templateId === '2' && assets.titleShukrModernAr) {
      return { img: assets.titleShukrModernAr, maxW: 760, maxH: 265 };
    }
    return {
      img: assets.titleShukrWaveAr ?? assets.titleAppreciationAr,
      maxW: 780,
      maxH: 265,
    };
  }

  if (state.certificateType === 'excellence') {
    if (state.excellenceVariant === 'school-administration') {
      if (state.templateId === '2' && assets.titleExcellenceAr) {
        return { img: assets.titleExcellenceAr, maxW: 680, maxH: 270 };
      }
      return {
        img: assets.titleTafawuqDirasiAr ?? assets.titleExcellenceAr,
        maxW: 830,
        maxH: 280,
      };
    }

    return {
      img: assets.titleExcellenceAr ?? assets.titleTafawuqDirasiAr,
      maxW: 720,
      maxH: 290,
    };
  }

  return {
    img: assets.titleGraduationAr,
    maxW: 740,
    maxH: 310,
  };
}

/**
 * يرسم الفاصل الزخرفي الهندسي الممتد تحت العنوان المخطوط لربطه بالزخارف الجانبية والمحتوى المركزي
 */
function drawOrnamentalTitleDivider(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  halfSpan: number,
  goldHex: string,
  accentHex: string,
  darkHex: string,
  variant: 'diamonds' | 'rings' | 'architectural' = 'diamonds'
) {
  ctx.save();

  const drawDiamond = (cx: number, cy: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  // خط رئيسي ذهبي ممتد لربط الوسط بالجانبين
  const rightGrad = ctx.createLinearGradient(
    centerX + 54,
    y,
    centerX + halfSpan,
    y
  );
  rightGrad.addColorStop(0, goldHex);
  rightGrad.addColorStop(0.65, goldHex);
  rightGrad.addColorStop(1, 'rgba(193, 180, 137, 0.12)');
  ctx.strokeStyle = rightGrad;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(centerX + 54, y);
  ctx.lineTo(centerX + halfSpan, y);
  ctx.stroke();

  const leftGrad = ctx.createLinearGradient(
    centerX - 54,
    y,
    centerX - halfSpan,
    y
  );
  leftGrad.addColorStop(0, goldHex);
  leftGrad.addColorStop(0.65, goldHex);
  leftGrad.addColorStop(1, 'rgba(193, 180, 137, 0.12)');
  ctx.strokeStyle = leftGrad;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(centerX - 54, y);
  ctx.lineTo(centerX - halfSpan, y);
  ctx.stroke();

  // خط موازٍ رفيع أسفل الخط الرئيسي لإضفاء عمق معماري
  ctx.strokeStyle = 'rgba(193, 180, 137, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(centerX - halfSpan * 0.62, y + 8);
  ctx.lineTo(centerX - 64, y + 8);
  ctx.moveTo(centerX + 64, y + 8);
  ctx.lineTo(centerX + halfSpan * 0.62, y + 8);
  ctx.stroke();

  // عقد زخرفية على أطراف الفاصل تربطه بصرياً بالزخارف الجانبية
  drawDiamond(centerX - halfSpan * 0.62, y, 7, goldHex);
  drawDiamond(centerX + halfSpan * 0.62, y, 7, goldHex);
  drawDiamond(centerX - halfSpan * 0.85, y, 5, accentHex);
  drawDiamond(centerX + halfSpan * 0.85, y, 5, accentHex);

  if (variant === 'rings') {
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.arc(centerX, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = goldHex;
    ctx.beginPath();
    ctx.arc(centerX, y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darkHex;
    ctx.beginPath();
    ctx.arc(centerX - 36, y, 6, 0, Math.PI * 2);
    ctx.arc(centerX + 36, y, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 'architectural') {
    ctx.fillStyle = darkHex;
    ctx.fillRect(centerX - 24, y - 5, 48, 10);
    drawDiamond(centerX, y, 6, goldHex);
    drawDiamond(centerX - 40, y, 8, goldHex);
    drawDiamond(centerX + 40, y, 8, goldHex);
  } else {
    drawDiamond(centerX, y, 17, goldHex);
    drawDiamond(centerX, y, 7.5, darkHex);
    drawDiamond(centerX - 34, y, 9, accentHex);
    drawDiamond(centerX + 34, y, 9, accentHex);
  }

  ctx.restore();
}

/**
 * يرسم عنوان الشهادة المخطوط في أعلى الوسط بحجم بارز ومتمركز
 */
function drawCertificateCalligraphicHeaderTitle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  state: CertificateFormState,
  palette: CertificateColorPalette,
  assets: CertificateVisualAssets,
  options?: {
    insideDarkMedallion?: boolean;
    dividerVariant?: 'diamonds' | 'rings' | 'architectural' | 'none';
  }
) {
  ctx.save();
  const insideDarkMedallion = options?.insideDarkMedallion ?? false;
  const dividerVariant = options?.dividerVariant ?? 'diamonds';

  const useExtractedCalligraphy =
    state.language === 'ar' &&
    isStandardArabicTitleForType(state.certificateTitle, state.certificateType);

  const darkHex =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;
  const titleInkHex = insideDarkMedallion ? '#FFFFFF' : darkHex;
  const goldInkHex = insideDarkMedallion ? '#E6D8B4' : palette.goldHex;

  if (useExtractedCalligraphy) {
    const selected = selectCalligraphicManuscriptForState(state, assets);
    if (selected.img) {
      const scaleFactor = insideDarkMedallion ? 0.8 : 1.0;
      drawPaletteTintedAsset(
        ctx,
        selected.img,
        centerX,
        centerY,
        selected.maxW * scaleFactor,
        selected.maxH * scaleFactor,
        titleInkHex,
        goldInkHex
      );

      if (!insideDarkMedallion && dividerVariant !== 'none') {
        drawOrnamentalTitleDivider(
          ctx,
          centerX,
          centerY + selected.maxH * 0.48 + 18,
          520,
          palette.goldHex,
          palette.primaryHex,
          darkHex,
          dividerVariant
        );
      }
      ctx.restore();
      return;
    }
  }

  // مسار الرسم النصي المزخرف (للغة الإنجليزية أو عند إدخال عنوان مخصص)
  const stylizedText = stylizeArabicCalligraphicTitle(
    state.certificateTitle,
    state.certificateType,
    state.language
  );
  const titleFontFamily = getCertificateFontFamily(state.language, 'title');
  const maxAllowedW = insideDarkMedallion ? 560 : 1240;
  let fontPx = insideDarkMedallion
    ? state.language === 'en'
      ? 48
      : 64
    : state.language === 'en'
      ? 74
      : 96;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  while (fontPx > 32) {
    ctx.font = `700 ${fontPx}px ${titleFontFamily}`;
    if (ctx.measureText(stylizedText).width <= maxAllowedW) break;
    fontPx -= 3;
  }

  ctx.fillStyle = goldInkHex;
  ctx.globalAlpha = insideDarkMedallion ? 0.28 : 0.34;
  ctx.fillText(stylizedText, centerX + 3, centerY + 4);
  ctx.globalAlpha = 1;

  ctx.fillStyle = titleInkHex;
  ctx.fillText(stylizedText, centerX, centerY);

  if (!insideDarkMedallion && dividerVariant !== 'none') {
    drawOrnamentalTitleDivider(
      ctx,
      centerX,
      centerY + 84,
      520,
      palette.goldHex,
      palette.primaryHex,
      darkHex,
      dividerVariant
    );
  }

  ctx.restore();
}

// ============================================================================
// ١١. رسم الترويسة العلوية الموحدة:
// شعار وزارة التعليم واضح ومقروء في أعلى اليسار ← العنوان في الوسط ← بيانات الجهة في أعلى اليمين
// ============================================================================

function drawCornerHeaderTextAndLogo(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  state: CertificateFormState,
  palette: CertificateColorPalette,
  moeLogo: HTMLImageElement | null,
  topY: number,
  sideMarginX: number
) {
  ctx.save();
  const isEn = state.language === 'en';
  const headerFont = getCertificateFontFamily(state.language, 'header');

  const deptRaw = state.educationDepartment.trim();
  const schoolRaw = state.schoolName.trim();

  const deptLine = isEn
    ? deptRaw || 'General Administration of Education'
    : deptRaw
      ? deptRaw.startsWith('الإدارة') || deptRaw.startsWith('إدارة')
        ? deptRaw
        : `الإدارة العامة للتعليم بمنطقة ${deptRaw}`
      : 'الإدارة العامة للتعليم';

  const schoolLine = isEn
    ? schoolRaw || ''
    : schoolRaw
      ? schoolRaw.startsWith('مدرسة') ||
        schoolRaw.startsWith('ثانوية') ||
        schoolRaw.startsWith('متوسطة') ||
        schoolRaw.startsWith('ابتدائية') ||
        schoolRaw.startsWith('مجمع')
        ? schoolRaw
        : `مدرسة ${schoolRaw}`
      : '';

  const textAnchorX = isEn ? sideMarginX + 245 : pageW - sideMarginX - 245;
  const logoAnchorX = isEn ? pageW - sideMarginX - 220 : sideMarginX + 220;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const darkHex =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  // ١. كتلة بيانات الجهة التعليمية في أعلى اليمين (أو أعلى اليسار في الإنجليزية)
  ctx.fillStyle = palette.textDarkHex;
  ctx.font = `700 26px ${headerFont}`;
  ctx.fillText(
    isEn ? 'Kingdom of Saudi Arabia' : 'المملكة العربية السعودية',
    textAnchorX,
    topY
  );

  ctx.font = `700 25px ${headerFont}`;
  ctx.fillText(
    isEn ? 'Ministry of Education' : 'وزارة التعليم',
    textAnchorX,
    topY + 38
  );

  ctx.font = `600 22px ${headerFont}`;
  ctx.fillStyle = darkHex;
  ctx.fillText(deptLine, textAnchorX, topY + 75);

  if (schoolLine) {
    ctx.font = `700 24px ${headerFont}`;
    ctx.fillStyle = palette.primaryHex;
    ctx.fillText(schoolLine, textAnchorX, topY + 112);
  }

  // خط زخرفي ذهبي متوازن أسفل بيانات الجهة التعليمية
  const ruleY = topY + (schoolLine ? 148 : 112);
  ctx.strokeStyle = palette.goldHex;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(textAnchorX - 115, ruleY);
  ctx.lineTo(textAnchorX + 115, ruleY);
  ctx.stroke();

  ctx.fillStyle = palette.goldHex;
  ctx.beginPath();
  ctx.moveTo(textAnchorX, ruleY - 5);
  ctx.lineTo(textAnchorX + 5, ruleY);
  ctx.lineTo(textAnchorX, ruleY + 5);
  ctx.lineTo(textAnchorX - 5, ruleY);
  ctx.closePath();
  ctx.fill();

  // ٢. شعار وزارة التعليم السعودية في أعلى اليسار (مع قص الهوامش الشفافة الزائدة ليظهر بحجم واضح ومقروء ومحاذي للترويسة دون ملامسة الخطوط)
  if (moeLogo) {
    const natW = moeLogo.naturalWidth || moeLogo.width || 0;
    const natH = moeLogo.naturalHeight || moeLogo.height || 0;

    const useTightCrop = natW >= 4000 && natH >= 4000;
    const sx = useTightCrop ? 1280 : 0;
    const sy = useTightCrop ? 1505 : 0;
    const sw = useTightCrop ? 1945 : Math.max(1, natW);
    const sh = useTightCrop ? 1485 : Math.max(1, natH);

    const targetBoxW = 224;
    const targetBoxH = 160;
    const ratio = Math.min(targetBoxW / sw, targetBoxH / sh);
    const drawW = sw * ratio;
    const drawH = sh * ratio;

    // محاذاة مركز الشعار بصرياً مع مركز كتلة بيانات الجهة التعليمية المقابلة مع ترك مسافة مريحة فوق الخط الذهبي
    const blockCenterY = topY + (schoolLine ? 50 : 36);
    ctx.drawImage(
      moeLogo,
      sx,
      sy,
      sw,
      sh,
      logoAnchorX - drawW / 2,
      blockCenterY - drawH / 2,
      drawW,
      drawH
    );

    // خط ذهبي رفيع أسفل الشعار يطابق خط بيانات الجهة المقابلة لتحقيق التماثل البصري
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(logoAnchorX - 95, ruleY);
    ctx.lineTo(logoAnchorX + 95, ruleY);
    ctx.stroke();

    ctx.fillStyle = palette.goldHex;
    ctx.beginPath();
    ctx.moveTo(logoAnchorX, ruleY - 5);
    ctx.lineTo(logoAnchorX + 5, ruleY);
    ctx.lineTo(logoAnchorX, ruleY + 5);
    ctx.lineTo(logoAnchorX - 5, ruleY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// ١٢. الإطار المعماري الموحد والزخارف الجانبية الممتدة والمتصلة بالمنطقة المركزية
// ============================================================================

/**
 * يرسم الإطار الهيكلي المزدوج والزوايا المعمارية والزخرفة المركزية السفلية
 * التي تربط الترويسة والزخارف الجانبية والتوقيعات في تكوين واحد متماسك.
 */
function drawUnifiedArchitecturalStageFrame(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  palette: CertificateColorPalette,
  options?: { skipTopEdge?: boolean }
) {
  ctx.save();
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;
  const skipTopEdge = options?.skipTopEdge ?? false;

  const outerPad = 48;
  const midPad = 68;
  const innerRailX = 182;

  // ١. الإطار الخارجي المزدوج المحيط بالصفحة
  ctx.strokeStyle = darkCol;
  ctx.lineWidth = 3.2;
  if (!skipTopEdge) {
    ctx.strokeRect(
      outerPad,
      outerPad,
      pageW - outerPad * 2,
      pageH - outerPad * 2
    );
  } else {
    ctx.beginPath();
    ctx.moveTo(outerPad, 160);
    ctx.lineTo(outerPad, pageH - outerPad);
    ctx.lineTo(pageW - outerPad, pageH - outerPad);
    ctx.lineTo(pageW - outerPad, 160);
    ctx.stroke();
  }

  ctx.strokeStyle = palette.goldHex;
  ctx.lineWidth = 2.0;
  if (!skipTopEdge) {
    ctx.strokeRect(midPad, midPad, pageW - midPad * 2, pageH - midPad * 2);
  } else {
    ctx.beginPath();
    ctx.moveTo(midPad, 180);
    ctx.lineTo(midPad, pageH - midPad);
    ctx.lineTo(pageW - midPad, pageH - midPad);
    ctx.lineTo(pageW - midPad, 180);
    ctx.stroke();
  }

  // ٢. السكك الزخرفية الجانبية الداخلية (Inner Side Rails) تبدأ أسفل الترويسة العلوية تماماً دون تداخل
  ctx.strokeStyle = 'rgba(193, 180, 137, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // السكة اليمنى
  ctx.moveTo(pageW - innerRailX, 336);
  ctx.lineTo(pageW - innerRailX, pageH - 270);
  // السكة اليسرى
  ctx.moveTo(innerRailX, 336);
  ctx.lineTo(innerRailX, pageH - 270);
  ctx.stroke();

  // أركان معمارية متدرجة تربط السكك الجانبية بالإطار العلوي والسفلي دون ملامسة الشعار
  const drawCornerBridge = (x: number, y: number, dx: number, dy: number) => {
    ctx.save();
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * 48, y);
    ctx.lineTo(x + dx * 48, y + dy * 30);
    ctx.lineTo(x + dx * 95, y + dy * 30);
    ctx.stroke();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(x + dx * 48, y + dy * 15 - 6);
    ctx.lineTo(x + dx * 48 + 6, y + dy * 15);
    ctx.lineTo(x + dx * 48, y + dy * 15 + 6);
    ctx.lineTo(x + dx * 48 - 6, y + dy * 15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawCornerBridge(innerRailX, 336, 1, -1);
  drawCornerBridge(pageW - innerRailX, 336, -1, -1);
  drawCornerBridge(innerRailX, pageH - 270, 1, 1);
  drawCornerBridge(pageW - innerRailX, pageH - 270, -1, 1);

  // ٣. الحلية الهندسية المركزية في قاعدة الإطار السفلي (تملأ أسفل الوسط بتكوين متوازن بدون أي تاريخ)
  const botY = pageH - midPad;
  const cx = pageW / 2;

  ctx.strokeStyle = palette.goldHex;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - 320, botY - 18);
  ctx.lineTo(cx - 58, botY - 18);
  ctx.moveTo(cx + 58, botY - 18);
  ctx.lineTo(cx + 320, botY - 18);
  ctx.stroke();

  // معين مركزي مزدوج على قاعدة الشهادة
  const drawBottomDiamond = (
    dx: number,
    dy: number,
    r: number,
    col: string
  ) => {
    ctx.beginPath();
    ctx.moveTo(dx, dy - r);
    ctx.lineTo(dx + r, dy);
    ctx.lineTo(dx, dy + r);
    ctx.lineTo(dx - r, dy);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };

  drawBottomDiamond(cx, botY - 18, 22, palette.goldHex);
  drawBottomDiamond(cx, botY - 18, 12, darkCol);
  drawBottomDiamond(cx, botY - 18, 5, '#FFFFFF');
  drawBottomDiamond(cx - 42, botY - 18, 8, palette.primaryHex);
  drawBottomDiamond(cx + 42, botY - 18, 8, palette.primaryHex);
  drawBottomDiamond(cx - 320, botY - 18, 6, palette.goldHex);
  drawBottomDiamond(cx + 320, botY - 18, 6, palette.goldHex);

  ctx.restore();
}

/**
 * ١٢-أ: زخرفة المعينات الهندسية المتدرجة الممتدة رأسيًا على الجانبين والمتصلة بالوسط
 * (مستلهمة من النموذج المرجعي jZwAgpq - رقم 037)
 */
function drawSideDiamondLatticeMotif(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  palette: CertificateColorPalette
) {
  ctx.save();
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  const drawRotatedSquare = (
    cx: number,
    cy: number,
    side: number,
    fillOrStroke: 'fill' | 'stroke',
    style: string | CanvasGradient,
    lineWidth = 2.4,
    alpha = 1
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = alpha;
    if (fillOrStroke === 'fill') {
      ctx.fillStyle = style;
      ctx.fillRect(-side / 2, -side / 2, side, side);
    } else {
      ctx.strokeStyle = style;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(-side / 2, -side / 2, side, side);
    }
    ctx.restore();
  };

  const drawSideColumn = (side: 'left' | 'right') => {
    const baseX = side === 'left' ? 58 : pageW - 58;
    const inwardDir = side === 'left' ? 1 : -1;
    const centerY = pageH * 0.53;
    const stepY = 235;

    // ٥ معينات هندسية متدرجة ممتدة رأسيًا على طول الجانب
    const offsets = [-2, -1, 0, 1, 2];
    for (const factor of offsets) {
      const cy = centerY + factor * stepY;
      const isCenterDiamond = factor === 0;
      const diamondSide = isCenterDiamond ? 168 : 148;

      const grad = ctx.createLinearGradient(
        baseX - 90,
        cy - 90,
        baseX + inwardDir * 130,
        cy + 90
      );
      grad.addColorStop(0, darkCol);
      grad.addColorStop(0.55, palette.primaryHex);
      grad.addColorStop(1, palette.accentHex);

      drawRotatedSquare(baseX, cy, diamondSide, 'fill', grad, 2, 0.95);

      // إطار ماسي مزدوج مزاح للداخل يربط المعينات بالسكة الداخلية (innerRailX = 182)
      drawRotatedSquare(
        baseX + inwardDir * 32,
        cy,
        diamondSide,
        'stroke',
        darkCol,
        2.4,
        0.8
      );
      drawRotatedSquare(
        baseX + inwardDir * 52,
        cy,
        diamondSide * 0.82,
        'stroke',
        palette.goldHex,
        1.8,
        0.75
      );
    }

    // معينات متداخلة وعقد هندسية تمتد نحو المنطقة المركزية (حتى x = 235)
    for (const midFactor of [-1.5, -0.5, 0.5, 1.5]) {
      const cy = centerY + midFactor * stepY;
      drawRotatedSquare(
        baseX + inwardDir * 92,
        cy,
        96,
        'stroke',
        palette.goldHex,
        2.2,
        0.82
      );
      drawRotatedSquare(
        baseX + inwardDir * 146,
        cy,
        28,
        'fill',
        darkCol,
        1,
        0.92
      );
      drawRotatedSquare(
        baseX + inwardDir * 116,
        cy - 48,
        18,
        'fill',
        palette.goldHex,
        1,
        0.9
      );
      drawRotatedSquare(
        baseX + inwardDir * 116,
        cy + 48,
        18,
        'fill',
        palette.primaryHex,
        1,
        0.85
      );
    }

    // الجسر الزخرفي الأوسط عند مستوى اسم المستفيد (يربط الزخرفة الجانبية باسم المستفيد في المركز)
    const bridgeY = centerY;
    ctx.save();
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(baseX + inwardDir * 124, bridgeY);
    ctx.lineTo(baseX + inwardDir * 225, bridgeY);
    ctx.stroke();
    drawRotatedSquare(
      baseX + inwardDir * 195,
      bridgeY,
      22,
      'fill',
      palette.goldHex,
      1,
      0.95
    );
    drawRotatedSquare(
      baseX + inwardDir * 195,
      bridgeY,
      10,
      'fill',
      darkCol,
      1,
      1
    );
    ctx.restore();
  };

  drawSideColumn('left');
  drawSideColumn('right');
  ctx.restore();
}

/**
 * ١٢-ب: زخرفة الأعمدة والأقواس الهندسية والمربعات الممتدة والمتوازنة بين اليمين واليسار
 * (مستلهمة من النموذجين المرجعيين xAaxqqY رقم 036 و NKvqZXD رقم 035)
 */
function drawCornerArchitecturalBarsMotif(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  palette: CertificateColorPalette
) {
  ctx.save();
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  const drawQuarterRoundedBar = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    roundCorner: 'tl' | 'tr' | 'bl' | 'br',
    alpha = 1
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const r = Math.min(w, h);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, [
      roundCorner === 'tl' ? r : 0,
      roundCorner === 'tr' ? r : 0,
      roundCorner === 'br' ? r : 0,
      roundCorner === 'bl' ? r : 0,
    ]);
    ctx.fill();
    ctx.restore();
  };

  // تشكيل هندسي معماري متناظر وممتد على الجانبين الأيمن والأيسر (وليس محصوراً في الزوايا فقط)
  const drawArchitecturalSide = (side: 'left' | 'right') => {
    const isLeft = side === 'left';
    const xBase = isLeft ? 56 : pageW - 56;
    const dir = isLeft ? 1 : -1;
    const midY = pageH * 0.53;

    // أعمدة وأقواس هندسية وسطى على يمين ويسار المحتوى المركزي (y = 330..1310)
    const barW = 46;
    const col1X = isLeft ? xBase : xBase - barW;
    const col2X = isLeft ? xBase + 58 : xBase - 58 - barW;
    const col3X = isLeft ? xBase + 116 : xBase - 116 - 38;

    // العمود العلوي الأوسط
    drawQuarterRoundedBar(
      col1X,
      midY - 380,
      barW,
      230,
      darkCol,
      isLeft ? 'br' : 'bl',
      0.95
    );
    drawQuarterRoundedBar(
      col2X,
      midY - 310,
      barW,
      165,
      palette.primaryHex,
      isLeft ? 'tr' : 'tl',
      0.92
    );

    // التكوين الهندسي المركزي المحاذي لمنطقة اسم المستفيد
    drawQuarterRoundedBar(
      col1X,
      midY - 125,
      barW,
      250,
      palette.primaryHex,
      isLeft ? 'tr' : 'tl',
      0.95
    );
    drawQuarterRoundedBar(
      col2X,
      midY - 85,
      barW,
      170,
       palette.goldHex,
      isLeft ? 'br' : 'bl',
      0.9
    );
    drawQuarterRoundedBar(
      col3X,
      midY - 36,
      38,
      72,
      darkCol,
      isLeft ? 'tr' : 'tl',
      0.92
    );

    // العمود السفلي الأوسط
    drawQuarterRoundedBar(
      col1X,
      midY + 150,
      barW,
      230,
      darkCol,
      isLeft ? 'tr' : 'tl',
      0.95
    );
    drawQuarterRoundedBar(
      col2X,
      midY + 145,
      barW,
      165,
      palette.neutralHex,
      isLeft ? 'br' : 'bl',
      0.6
    );

    // مربعات هندسية كحلية وذهبية تربط الأعمدة بالسكة الداخلية (innerRailX = 182)
    const sqX = isLeft ? xBase + 124 : xBase - 124 - 28;
    ctx.fillStyle = darkCol;
    ctx.fillRect(sqX, midY - 185, 28, 28);
    ctx.fillRect(sqX, midY + 157, 28, 28);

    ctx.fillStyle = palette.goldHex;
    ctx.fillRect(sqX + dir * 38, midY - 115, 22, 22);
    ctx.fillRect(sqX + dir * 38, midY + 93, 22, 22);

    // خط ربط أفقي يتجه نحو قلب الشهادة
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(isLeft ? xBase + 154 : xBase - 154, midY);
    ctx.lineTo(isLeft ? xBase + 228 : xBase - 228, midY);
    ctx.stroke();
  };

  drawArchitecturalSide('left');
  drawArchitecturalSide('right');

  ctx.restore();
}

/**
 * ١٢-ج: زخرفة الحلقات والدوائر الهندسية المتداخلة وأرباع الدوائر الممتدة على الجانبين والزوايا
 * (مستلهمة من النموذج المرجعي dPAvZdr - رقم 033)
 */
function drawCornerConcentricRingsMotif(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  palette: CertificateColorPalette
) {
  ctx.save();
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  const drawConcentricRingSet = (
    cx: number,
    cy: number,
    outerR: number,
    ringColor: string,
    innerFillColor?: string
  ) => {
    ctx.save();
    ctx.strokeStyle = ringColor;
    for (let i = 0; i < 4; i++) {
      const r = outerR - i * 12;
      if (r <= 4) break;
      ctx.lineWidth = i === 0 ? 3.4 : 1.9;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (innerFillColor && outerR > 48) {
      ctx.fillStyle = innerFillColor;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR - 48, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawQuarterWedge = (
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    color: string,
    alpha = 1
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const midY = pageH * 0.53;

  // ١. التكوين الدائري الممتد على الجانب الأيسر (من الأعلى للوسط للأسفل)
  drawConcentricRingSet(118, 355, 64, palette.goldHex, palette.primaryHex);
  drawQuarterWedge(68, midY - 120, 115, 0, darkCol, 0.9);
  drawQuarterWedge(68, midY, 115, -Math.PI / 2, palette.primaryHex, 0.88);
  drawConcentricRingSet(145, midY, 78, palette.goldHex, darkCol);
  drawConcentricRingSet(118, midY + 215, 58, palette.primaryHex);

  // الزاوية السفلية اليسرى
  drawQuarterWedge(68, pageH - 68, 170, -Math.PI / 2, palette.neutralHex, 0.32);
  drawConcentricRingSet(195, pageH - 140, 84, palette.primaryHex, darkCol);
  drawQuarterWedge(285, pageH - 68, 76, Math.PI, palette.goldHex, 0.88);

  // ٢. التكوين الدائري الممتد والمتناظر على الجانب الأيمن
  drawConcentricRingSet(pageW - 118, 355, 64, palette.goldHex, darkCol);
  drawQuarterWedge(pageW - 68, midY - 120, 115, Math.PI / 2, darkCol, 0.9);
  drawQuarterWedge(
    pageW - 68,
    midY,
    115,
    Math.PI,
    palette.primaryHex,
    0.88
  );
  drawConcentricRingSet(pageW - 145, midY, 78, palette.goldHex, darkCol);
  drawConcentricRingSet(pageW - 118, midY + 215, 58, palette.primaryHex);

  // الزاوية السفلية اليمنى
  drawQuarterWedge(pageW - 68, pageH - 68, 170, Math.PI, darkCol, 0.92);
  drawConcentricRingSet(
    pageW - 195,
    pageH - 140,
    84,
    palette.goldHex,
    palette.primaryHex
  );
  drawQuarterWedge(
    pageW - 285,
    pageH - 68,
    76,
    -Math.PI / 2,
    palette.goldHex,
    0.88
  );

  // دوائر ذهبية وكحلية صغيرة تربط الحلقات الجانبية بالسكة الداخلية والوسط
  for (const side of ['left', 'right'] as const) {
    const sx = side === 'left' ? 235 : pageW - 235;
    ctx.fillStyle = palette.goldHex;
    ctx.beginPath();
    ctx.arc(sx, midY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.arc(sx, midY - 165, 7, 0, Math.PI * 2);
    ctx.arc(sx, midY + 165, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * ١٢-د: وسام النجمة المسننة الدائري (Scalloped Rosette Seal)
 * (مستلهم من النموذج المرجعي pQjgjrg - رقم 034)
 */
function drawScallopedRosetteMedallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
  fillHex: string,
  ringHex: string,
  goldHex: string
) {
  ctx.save();
  const totalSteps = points * 2;
  const outerFactor = 1.05;
  const innerFactor = 0.94;

  ctx.beginPath();
  for (let i = 0; i <= totalSteps; i++) {
    const angle = (i * Math.PI * 2) / totalSteps;
    const factor = i % 2 === 0 ? outerFactor : innerFactor;
    const px = cx + Math.cos(angle) * rx * factor;
    const py = cy + Math.sin(angle) * ry * factor;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillHex;
  ctx.fill();

  ctx.strokeStyle = ringHex;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.87, ry * 0.87, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = goldHex;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// ١٣. تصميم القوالب الثلاثة (A4 Landscape - 2380 × 1684 px)
// مع تكوين بصري ممتلئ ومتوازن يدمج الترويسة والزخارف الجانبية والوسط والتوقيع
// ============================================================================

export type BeneficiaryHighlightStyle =
  | 'diamond-flanked'
  | 'architectural-underline'
  | 'golden-pill'
  | 'academic-laurel';

interface TemplateBodyStageBounds {
  bodyTopY: number;
  bodyBottomY: number;
  maxTextWidth: number;
  highlightStyle: BeneficiaryHighlightStyle;
}

/**
 * القالب ١: التكوين الهندسي المرجعي المتكامل
 */
function drawTemplate1LuxuryClassicLandscape(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  state: CertificateFormState,
  palette: CertificateColorPalette,
  assets: CertificateVisualAssets
): TemplateBodyStageBounds {
  ctx.save();

  // ١. خلفية ناصعة مع مسحة لونية دافئة/رسمية خفيفة جداً داخل منطقة المسرح المركزي
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pageW, pageH);

  ctx.fillStyle = palette.softTintHex;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(182, 295, pageW - 364, pageH - 550);
  ctx.globalAlpha = 1;

  // ٢. الإطار الهيكلي المزدوج والسكك الجانبية المتصلة
  drawUnifiedArchitecturalStageFrame(ctx, pageW, pageH, palette);

  let dividerVariant: 'diamonds' | 'rings' | 'architectural' = 'diamonds';
  let highlightStyle: BeneficiaryHighlightStyle = 'diamond-flanked';
  const headerSideMarginX = 96;

  // ٣. رسم الزخارف الجانبية الممتدة والمتصلة بالمنطقة المركزية حسب نوع الشهادة
  if (
    (state.certificateType === 'appreciation' &&
      state.appreciationRole === 'teacher') ||
    (state.certificateType === 'excellence' &&
      state.excellenceVariant === 'school-administration')
  ) {
    drawSideDiamondLatticeMotif(ctx, pageW, pageH, palette);
    dividerVariant = 'diamonds';
    highlightStyle =
      state.certificateType === 'excellence'
        ? 'academic-laurel'
        : 'diamond-flanked';
  } else if (
    (state.certificateType === 'appreciation' &&
      state.appreciationRole === 'admin') ||
    (state.certificateType === 'excellence' &&
      state.excellenceVariant === 'teacher')
  ) {
    drawCornerArchitecturalBarsMotif(ctx, pageW, pageH, palette);
    dividerVariant = 'architectural';
    highlightStyle = 'architectural-underline';
  } else {
    drawCornerConcentricRingsMotif(ctx, pageW, pageH, palette);
    dividerVariant = 'rings';
    highlightStyle =
      state.certificateType === 'graduation' ? 'golden-pill' : 'diamond-flanked';
  }

  // ٤. شارة نجمة التفوق العلوية في شهادات التفوق
  if (state.certificateType === 'excellence') {
    const darkHex =
      palette.id === '2' ? palette.primaryHex : palette.secondaryHex;
    drawScallopedRosetteMedallion(
      ctx,
      pageW / 2,
      128,
      44,
      44,
      18,
      darkHex,
      '#FFFFFF',
      palette.goldHex
    );
    ctx.save();
    ctx.fillStyle = palette.goldHex;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 20 : 9;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const sx = pageW / 2 + Math.cos(a) * r;
      const sy = 128 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ٥. الترويسة العلوية الموحدة: شعار وزارة التعليم يساراً وبيانات الجهة يميناً
  drawCornerHeaderTextAndLogo(
    ctx,
    pageW,
    state,
    palette,
    assets.moeLogo,
    116,
    headerSideMarginX
  );

  // ٦. العنوان المخطوط الكبير كنقطة تركيز رئيسية في أعلى الوسط
  drawCertificateCalligraphicHeaderTitle(
    ctx,
    pageW / 2,
    348,
    state,
    palette,
    assets,
    {
      insideDarkMedallion: false,
      dividerVariant,
    }
  );

  ctx.restore();

  return {
    bodyTopY: 525,
    bodyBottomY: 1280,
    maxTextWidth: 1520,
    highlightStyle,
  };
}

/**
 * القالب ٢: تصميم الوسام الدائري المسنن والأجنحة الهندسية العلوية والجانبية المتكاملة
 * (مستلهم مباشرة من pQjgjrg - رقم 034)
 */
function drawTemplate2ModernGeometricLandscape(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  state: CertificateFormState,
  palette: CertificateColorPalette,
  assets: CertificateVisualAssets
): TemplateBodyStageBounds {
  ctx.save();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pageW, pageH);

  ctx.fillStyle = palette.softTintHex;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(182, 460, pageW - 364, pageH - 720);
  ctx.globalAlpha = 1;

  const darkMedallionHex =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  // ١. الإطار الهيكلي المزدوج والسكك الجانبية
  drawUnifiedArchitecturalStageFrame(ctx, pageW, pageH, palette, {
    skipTopEdge: true,
  });

  // ٢. الشريط الهندسي العلوي على شكل حرف V عريض (Top V-Chevron Wings) بارتفاع جانبي مدروس يترك الترويسة والشعار على خلفية ناصعة تماماً
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pageW, 0);
  ctx.lineTo(pageW, 38);
  ctx.lineTo(pageW * 0.72, 108);
  ctx.lineTo(pageW / 2, 338);
  ctx.lineTo(pageW * 0.28, 108);
  ctx.lineTo(0, 38);
  ctx.closePath();
  ctx.fillStyle = '#E8EDF2';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pageW, 0);
  ctx.lineTo(pageW, 22);
  ctx.lineTo(pageW * 0.72, 82);
  ctx.lineTo(pageW / 2, 294);
  ctx.lineTo(pageW * 0.28, 82);
  ctx.lineTo(0, 22);
  ctx.closePath();
  const topChevronGrad = ctx.createLinearGradient(0, 0, pageW, 270);
  topChevronGrad.addColorStop(0, darkMedallionHex);
  topChevronGrad.addColorStop(0.5, palette.primaryHex);
  topChevronGrad.addColorStop(1, darkMedallionHex);
  ctx.fillStyle = topChevronGrad;
  ctx.fill();

  ctx.strokeStyle = palette.goldHex;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(pageW * 0.28, 95);
  ctx.lineTo(pageW / 2, 312);
  ctx.lineTo(pageW * 0.72, 95);
  ctx.lineTo(pageW, 30);
  ctx.stroke();
  ctx.restore();

  // ٣. التكوينات الهندسية الجانبية الممتدة على اليمين واليسار والمتصلة بالوسط
  const drawSideChevronColumns = (side: 'left' | 'right') => {
    ctx.save();
    const xEdge = side === 'left' ? 48 : pageW - 48;
    const dir = side === 'left' ? 1 : -1;
    const midY = pageH * 0.56;

    // شريط هندسي كحلي/أخضر مائل علوي
    ctx.beginPath();
    ctx.moveTo(xEdge, 345);
    ctx.lineTo(xEdge + dir * 116, 445);
    ctx.lineTo(xEdge + dir * 116, midY - 30);
    ctx.lineTo(xEdge, midY - 135);
    ctx.closePath();
    ctx.fillStyle = darkMedallionHex;
    ctx.globalAlpha = 0.92;
    ctx.fill();

    // شريط ذهبي مائل أوسط
    ctx.beginPath();
    ctx.moveTo(xEdge, midY - 92);
    ctx.lineTo(xEdge + dir * 138, midY + 32);
    ctx.lineTo(xEdge + dir * 138, midY + 118);
    ctx.lineTo(xEdge, midY - 8);
    ctx.closePath();
    ctx.fillStyle = palette.goldHex;
    ctx.globalAlpha = 0.88;
    ctx.fill();

    // شريط هندسي أساسي مائل سفلي ممتد
    ctx.beginPath();
    ctx.moveTo(xEdge, midY + 320);
    ctx.lineTo(xEdge + dir * 116, midY + 205);
    ctx.lineTo(xEdge + dir * 116, midY + 35);
    ctx.lineTo(xEdge, midY + 145);
    ctx.closePath();
    ctx.fillStyle = palette.primaryHex;
    ctx.globalAlpha = 0.9;
    ctx.fill();

    ctx.globalAlpha = 1;

    // إطار ذهبي مائل متداخل يربط الأشرطة بالسكة الداخلية
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(xEdge + dir * 32, 375);
    ctx.lineTo(xEdge + dir * 150, 485);
    ctx.lineTo(xEdge + dir * 150, midY + 195);
    ctx.lineTo(xEdge + dir * 32, midY + 305);
    ctx.stroke();

    // معينات ذهبية وكحلية تربط الأشرطة المائلة بالمنطقة المركزية
    const drawDiamond = (dx: number, dy: number, r: number, col: string) => {
      ctx.beginPath();
      ctx.moveTo(dx, dy - r);
      ctx.lineTo(dx + r, dy);
      ctx.lineTo(dx, dy + r);
      ctx.lineTo(dx - r, dy);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };

    drawDiamond(xEdge + dir * 168, midY, 20, darkMedallionHex);
    drawDiamond(xEdge + dir * 168, midY, 9, palette.goldHex);
    drawDiamond(xEdge + dir * 168, midY - 155, 12, palette.goldHex);
    drawDiamond(xEdge + dir * 168, midY + 155, 12, palette.goldHex);
    drawDiamond(xEdge + dir * 150, midY - 260, 9, palette.primaryHex);
    drawDiamond(xEdge + dir * 150, midY + 260, 9, palette.primaryHex);

    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(xEdge + dir * 188, midY);
    ctx.lineTo(xEdge + dir * 255, midY);
    ctx.stroke();

    ctx.restore();
  };
  drawSideChevronColumns('left');
  drawSideChevronColumns('right');

  // ٤. الترويسة العلوية الموحدة على جانبي الوسام المركزي فوق خلفية بيضاء صافية تماماً
  drawCornerHeaderTextAndLogo(
    ctx,
    pageW,
    state,
    palette,
    assets.moeLogo,
    114,
    92
  );

  // ٥. الوسام البيضاوي المسنن الكبير في المنتصف العلوي وبداخله المخطوطة البيضاء والذهبية
  const medCenterY = 294;
  drawScallopedRosetteMedallion(
    ctx,
    pageW / 2,
    medCenterY,
    365,
    176,
    34,
    darkMedallionHex,
    '#FFFFFF',
    palette.goldHex
  );

  drawCertificateCalligraphicHeaderTitle(
    ctx,
    pageW / 2,
    medCenterY,
    state,
    palette,
    assets,
    {
      insideDarkMedallion: true,
      dividerVariant: 'none',
    }
  );

  // فاصل زخرفي ذهبي رشيق أسفل الوسام المركزي يربطه بكتلة النص
  drawOrnamentalTitleDivider(
    ctx,
    pageW / 2,
    512,
    460,
    palette.goldHex,
    palette.primaryHex,
    darkMedallionHex,
    'architectural'
  );

  ctx.restore();

  return {
    bodyTopY: 540,
    bodyBottomY: 1265,
    maxTextWidth: 1520,
    highlightStyle: 'golden-pill',
  };
}

/**
 * القالب ٣: الأمواج العلوية والسفلية المزدوجة المنسابة مع الإطار الداخلي والزخارف الجانبية
 * (مستلهم مباشرة من النموذج المرجعي AQgBoD - رقم 025)
 */
function drawTemplate3OfficialEducationalLandscape(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  state: CertificateFormState,
  palette: CertificateColorPalette,
  assets: CertificateVisualAssets
): TemplateBodyStageBounds {
  ctx.save();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pageW, pageH);

  ctx.fillStyle = palette.softTintHex;
  ctx.globalAlpha = 0.44;
  ctx.fillRect(182, 320, pageW - 364, pageH - 580);
  ctx.globalAlpha = 1;

  const darkWaveHex =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  // ١. الموجة السفلية المزدوجة الممتدة في قاعدة الشهادة (تملأ أسفل الشهادة بفخامة بدون أي تاريخ)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, pageH);
  ctx.lineTo(pageW, pageH);
  ctx.lineTo(pageW, pageH - 135);
  ctx.bezierCurveTo(
    pageW * 0.68,
    pageH - 42,
    pageW * 0.35,
    pageH - 195,
    0,
    pageH - 95
  );
  ctx.closePath();
  ctx.fillStyle = '#EAECEF';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, pageH);
  ctx.lineTo(pageW, pageH);
  ctx.lineTo(pageW, pageH - 85);
  ctx.bezierCurveTo(
    pageW * 0.66,
    pageH - 10,
    pageW * 0.34,
    pageH - 140,
    0,
    pageH - 52
  );
  ctx.closePath();
  ctx.fillStyle = darkWaveHex;
  ctx.fill();

  ctx.strokeStyle = palette.goldHex;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(0, pageH - 105);
  ctx.bezierCurveTo(
    pageW * 0.35,
    pageH - 205,
    pageW * 0.68,
    pageH - 52,
    pageW,
    pageH - 145
  );
  ctx.stroke();
  ctx.restore();

  // ٢. الموجة العلوية المزدوجة المنسابة بارتفاع رشيق عند الزوايا لا يلامس الشعار أو الترويسة أبداً
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pageW, 0);
  ctx.lineTo(pageW, 74);
  ctx.bezierCurveTo(
    pageW * 0.68,
    158,
    pageW * 0.34,
    36,
    0,
    92
  );
  ctx.closePath();
  const goldWaveGrad = ctx.createLinearGradient(0, 0, pageW, 160);
  goldWaveGrad.addColorStop(0, '#B5A372');
  goldWaveGrad.addColorStop(0.5, '#DECFA4');
  goldWaveGrad.addColorStop(1, '#C1B489');
  ctx.fillStyle = goldWaveGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pageW, 0);
  ctx.lineTo(pageW, 52);
  ctx.bezierCurveTo(
    pageW * 0.66,
    132,
    pageW * 0.32,
    18,
    0,
    68
  );
  ctx.closePath();
  const mainWaveGrad = ctx.createLinearGradient(0, 0, pageW, 130);
  mainWaveGrad.addColorStop(0, darkWaveHex);
  mainWaveGrad.addColorStop(0.6, palette.primaryHex);
  mainWaveGrad.addColorStop(1, darkWaveHex);
  ctx.fillStyle = mainWaveGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.bezierCurveTo(
    pageW * 0.34,
    12,
    pageW * 0.66,
    112,
    pageW,
    42
  );
  ctx.stroke();
  ctx.restore();

  // ٣. الإطار الداخلي المستطيل ذو الزوايا الدائرية الناعمة + الزخارف الجانبية المتصلة
  const framePadX = 76;
  const framePadY = 72;
  ctx.save();
  ctx.strokeStyle = darkWaveHex;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(
    framePadX,
    framePadY,
    pageW - framePadX * 2,
    pageH - framePadY * 2,
    34
  );
  ctx.stroke();

  ctx.strokeStyle = palette.goldHex;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.roundRect(
    framePadX + 14,
    framePadY + 14,
    pageW - (framePadX + 14) * 2,
    pageH - (framePadY + 14) * 2,
    26
  );
  ctx.stroke();

  // تكوينات زخرفية جانبية بارزة على يمين ويسار المحتوى المركزي لربط الإطار بالوسط
  const drawWaveSideOrnament = (side: 'left' | 'right') => {
    const isLeft = side === 'left';
    const baseX = isLeft ? framePadX + 14 : pageW - framePadX - 14;
    const dir = isLeft ? 1 : -1;
    const midY = pageH * 0.55;

    // شريط هلالي ناعم ملون يملأ الجانب الداخلي
    ctx.save();
    ctx.fillStyle = palette.primaryHex;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(baseX, midY - 340);
    ctx.quadraticCurveTo(baseX + dir * 135, midY, baseX, midY + 340);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // قوس ثلاثي ذهبي وكحلي وأساسي يمتد رأسيًا على الجانب
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(baseX, midY - 340);
    ctx.quadraticCurveTo(baseX + dir * 135, midY, baseX, midY + 340);
    ctx.stroke();

    ctx.strokeStyle = darkWaveHex;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(baseX, midY - 270);
    ctx.quadraticCurveTo(baseX + dir * 98, midY, baseX, midY + 270);
    ctx.stroke();

    ctx.strokeStyle = palette.primaryHex;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(baseX, midY - 195);
    ctx.quadraticCurveTo(baseX + dir * 64, midY, baseX, midY + 195);
    ctx.stroke();

    // معينات متدرجة على طول القوس الجانبي
    const drawDiamond = (dx: number, dy: number, r: number, col: string) => {
      ctx.beginPath();
      ctx.moveTo(dx, dy - r);
      ctx.lineTo(dx + r, dy);
      ctx.lineTo(dx, dy + r);
      ctx.lineTo(dx - r, dy);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };

    drawDiamond(baseX + dir * 78, midY, 24, darkWaveHex);
    drawDiamond(baseX + dir * 78, midY, 11, palette.goldHex);
    drawDiamond(baseX + dir * 56, midY - 135, 14, palette.primaryHex);
    drawDiamond(baseX + dir * 56, midY + 135, 14, palette.primaryHex);
    drawDiamond(baseX + dir * 32, midY - 235, 10, palette.goldHex);
    drawDiamond(baseX + dir * 32, midY + 235, 10, palette.goldHex);

    // جسر أفقي يربط القوس الجانبي بمنطقة اسم المستفيد
    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(baseX + dir * 104, midY);
    ctx.lineTo(baseX + dir * 185, midY);
    ctx.stroke();
  };

  drawWaveSideOrnament('left');
  drawWaveSideOrnament('right');
  ctx.restore();

  // ٤. الترويسة في الزاويتين العلويتين تحت الموجة بمسافة مريحة وواضحة
  drawCornerHeaderTextAndLogo(
    ctx,
    pageW,
    state,
    palette,
    assets.moeLogo,
    132,
    102
  );

  // ٥. العنوان المخطوط الكبير في المساحة العلوية الوسطى
  drawCertificateCalligraphicHeaderTitle(
    ctx,
    pageW / 2,
    348,
    state,
    palette,
    assets,
    {
      insideDarkMedallion: false,
      dividerVariant: 'diamonds',
    }
  );

  ctx.restore();

  return {
    bodyTopY: 530,
    bodyBottomY: 1265,
    maxTextWidth: 1520,
    highlightStyle: 'architectural-underline',
  };
}

// ============================================================================
// ١٤. إبراز اسم المستفيد والأقسام النصية الأربعة والتذييل الرسمي للتوقيعات
// ============================================================================

/**
 * يبرز اسم المستفيد في قلب الشهادة بوزن بصري فخم مع أجنحة هندسية جانبية
 * تربطه بصريًا بالزخارف الجانبية وتقضي على إحساس العوم في الفراغ.
 */
function drawBeneficiaryNameHighlight(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  width: number,
  height: number,
  palette: CertificateColorPalette,
  style: BeneficiaryHighlightStyle
) {
  ctx.save();
  const halfW = width / 2;
  const xL = centerX - halfW;
  const xR = centerX + halfW;
  const cy = topY + height / 2;
  const botY = topY + height;
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  const drawDiamond = (dx: number, dy: number, r: number, col: string) => {
    ctx.beginPath();
    ctx.moveTo(dx, dy - r);
    ctx.lineTo(dx + r, dy);
    ctx.lineTo(dx, dy + r);
    ctx.lineTo(dx - r, dy);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };

  // أجنحة أفقية ذهبية تمتد من يمين ويسار إطار اسم المستفيد باتجاه الزخارف الجانبية
  const wingLen = 115;
  const leftWingGrad = ctx.createLinearGradient(xL, cy, xL - wingLen, cy);
  leftWingGrad.addColorStop(0, palette.goldHex);
  leftWingGrad.addColorStop(1, 'rgba(193, 180, 137, 0.08)');
  ctx.strokeStyle = leftWingGrad;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(xL - 12, cy);
  ctx.lineTo(xL - wingLen, cy);
  ctx.stroke();

  const rightWingGrad = ctx.createLinearGradient(xR, cy, xR + wingLen, cy);
  rightWingGrad.addColorStop(0, palette.goldHex);
  rightWingGrad.addColorStop(1, 'rgba(193, 180, 137, 0.08)');
  ctx.strokeStyle = rightWingGrad;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(xR + 12, cy);
  ctx.lineTo(xR + wingLen, cy);
  ctx.stroke();

  if (style === 'golden-pill' || style === 'academic-laurel') {
    // شريط تكريمي مزدوج الإطار بخلفية ناعمة وحليات ماسية بارزة
    ctx.fillStyle = palette.softTintHex;
    ctx.beginPath();
    ctx.roundRect(xL, topY + 4, width, height - 8, (height - 8) / 2);
    ctx.fill();

    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.roundRect(xL, topY + 4, width, height - 8, (height - 8) / 2);
    ctx.stroke();

    ctx.strokeStyle = darkCol;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.roundRect(
      xL + 10,
      topY + 12,
      width - 20,
      height - 24,
      (height - 24) / 2
    );
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawDiamond(xL, cy, 12, darkCol);
    drawDiamond(xL, cy, 6, palette.goldHex);
    drawDiamond(xR, cy, 12, darkCol);
    drawDiamond(xR, cy, 6, palette.goldHex);
    drawDiamond(xL - 26, cy, 7.5, palette.primaryHex);
    drawDiamond(xR + 26, cy, 7.5, palette.primaryHex);
  } else if (style === 'architectural-underline') {
    // إطار معماري مفتوح الجوانب مع خلفية خفيفة وخطين علوي وسفلي متدرجين
    ctx.fillStyle = palette.softTintHex;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(xL + 18, topY + 8, width - 36, height - 16);
    ctx.globalAlpha = 1;

    const topGrad = ctx.createLinearGradient(xL, topY + 8, xR, topY + 8);
    topGrad.addColorStop(0, 'rgba(193, 180, 137, 0.15)');
    topGrad.addColorStop(0.5, palette.goldHex);
    topGrad.addColorStop(1, 'rgba(193, 180, 137, 0.15)');
    ctx.strokeStyle = topGrad;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(xL + 24, topY + 8);
    ctx.lineTo(xR - 24, topY + 8);
    ctx.stroke();

    const botGrad = ctx.createLinearGradient(xL, botY - 6, xR, botY - 6);
    botGrad.addColorStop(0, 'rgba(193, 180, 137, 0.15)');
    botGrad.addColorStop(0.2, palette.goldHex);
    botGrad.addColorStop(0.5, palette.primaryHex);
    botGrad.addColorStop(0.8, palette.goldHex);
    botGrad.addColorStop(1, 'rgba(193, 180, 137, 0.15)');
    ctx.strokeStyle = botGrad;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(xL + 12, botY - 6);
    ctx.lineTo(xR - 12, botY - 6);
    ctx.stroke();

    drawDiamond(centerX, botY - 6, 8.5, palette.goldHex);
    drawDiamond(xL + 12, cy, 10, darkCol);
    drawDiamond(xR - 12, cy, 10, darkCol);
    drawDiamond(xL - 12, cy, 6.5, palette.goldHex);
    drawDiamond(xR + 12, cy, 6.5, palette.goldHex);
  } else {
    // diamond-flanked: شريط مركزي أنيق مع خطين مزدوجين وحليات ماسية متدرجة
    ctx.fillStyle = palette.softTintHex;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.roundRect(xL + 16, topY + 8, width - 32, height - 16, 22);
    ctx.fill();
    ctx.globalAlpha = 1;

    const lineGrad = ctx.createLinearGradient(xL + 24, botY - 6, xR - 24, botY - 6);
    lineGrad.addColorStop(0, 'rgba(193, 180, 137, 0.1)');
    lineGrad.addColorStop(0.25, palette.goldHex);
    lineGrad.addColorStop(0.5, darkCol);
    lineGrad.addColorStop(0.75, palette.goldHex);
    lineGrad.addColorStop(1, 'rgba(193, 180, 137, 0.1)');

    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(xL + 24, botY - 6);
    ctx.lineTo(xR - 24, botY - 6);
    ctx.stroke();

    drawDiamond(centerX, botY - 6, 8, palette.goldHex);
    drawDiamond(xL + 20, cy, 11, palette.primaryHex);
    drawDiamond(xL - 4, cy, 7, palette.goldHex);
    drawDiamond(xR - 20, cy, 11, palette.primaryHex);
    drawDiamond(xR + 4, cy, 7, palette.goldHex);
  }

  ctx.restore();
}

function drawCertificateBodyContent(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  state: CertificateFormState,
  palette: CertificateColorPalette,
  plan: CertificateBodyLayoutPlan,
  highlightStyle: BeneficiaryHighlightStyle
) {
  ctx.save();
  const centerX = pageW / 2;
  const bodyFont = getCertificateFontFamily(state.language, 'body');
  const nameFont = getCertificateFontFamily(state.language, 'name');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let cursorY = plan.startY;

  // ١. القسم الأول: عبارة التكريم الافتتاحية (openingText)
  if (plan.openingLines.length > 0) {
    const lineH = Math.round(plan.openingFontPx * 1.58);
    ctx.font = `600 ${plan.openingFontPx}px ${bodyFont}`;
    ctx.fillStyle = '#1E293B';

    for (const line of plan.openingLines) {
      ctx.fillText(line, centerX, cursorY + lineH / 2);
      cursorY += lineH;
    }
    cursorY += plan.gapAfterOpening;
  }

  // ٢. القسم الثاني: اسم المستفيد البارز في قلب الشهادة
  const beneLineH = Math.round(plan.beneficiaryFontPx * 1.36);
  let maxMeasuredNameW = 0;
  ctx.font = `700 ${plan.beneficiaryFontPx}px ${nameFont}`;
  for (const line of plan.beneficiaryLines) {
    const w = ctx.measureText(line).width;
    if (w > maxMeasuredNameW) maxMeasuredNameW = w;
  }

  const boxW = Math.min(1380, Math.max(820, maxMeasuredNameW + 220));
  const boxH = plan.beneficiaryBoxHeight;

  drawBeneficiaryNameHighlight(
    ctx,
    centerX,
    cursorY,
    boxW,
    boxH,
    palette,
    highlightStyle
  );

  // كتابة اسم المستفيد بوزن بصري بارز ولون الهوية الأساسي
  ctx.font = `700 ${plan.beneficiaryFontPx}px ${nameFont}`;
  ctx.fillStyle = palette.primaryHex;

  const totalBeneLinesH = plan.beneficiaryLines.length * beneLineH;
  let beneTextY = cursorY + (boxH - totalBeneLinesH) / 2 + beneLineH / 2;
  for (const line of plan.beneficiaryLines) {
    ctx.fillText(line, centerX, beneTextY);
    beneTextY += beneLineH;
  }

  cursorY += boxH + plan.gapAfterBeneficiary;

  // ٣. القسم الثالث: النص التفصيلي الرئيسي بعد الاسم (mainText)
  if (plan.mainLines.length > 0) {
    const mainLineH = Math.round(plan.mainFontPx * 1.76);
    ctx.font = `600 ${plan.mainFontPx}px ${bodyFont}`;
    ctx.fillStyle = '#1E293B';

    for (const line of plan.mainLines) {
      ctx.fillText(line, centerX, cursorY + mainLineH / 2);
      cursorY += mainLineH;
    }
  }

  // ٤. القسم الرابع: نص إضافي اختياري (إذا تُرك فارغاً لا يظهر مكانه أي فراغ أو عنوان)
  if (plan.additionalLines.length > 0) {
    cursorY += plan.gapAfterMain;

    const addLineH = Math.round(plan.additionalFontPx * 1.65);
    ctx.font = `600 ${plan.additionalFontPx}px ${bodyFont}`;
    ctx.fillStyle =
      palette.secondaryHex === '#C1B489'
        ? palette.primaryHex
        : palette.secondaryHex;

    for (const line of plan.additionalLines) {
      ctx.fillText(line, centerX, cursorY + addLineH / 2);
      cursorY += addLineH;
    }
  }

  // ٥. حلية زخرفية سفلية متوازنة تحت النص الرئيسي تربط كتلة النص بمنطقة التوقيعات
  const flourishY = Math.min(1295, cursorY + Math.round(42 * plan.scale));
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  const leftGrad = ctx.createLinearGradient(centerX - 310, flourishY, centerX - 36, flourishY);
  leftGrad.addColorStop(0, 'rgba(193, 180, 137, 0.05)');
  leftGrad.addColorStop(1, palette.goldHex);
  ctx.strokeStyle = leftGrad;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(centerX - 310, flourishY);
  ctx.lineTo(centerX - 36, flourishY);
  ctx.stroke();

  const rightGrad = ctx.createLinearGradient(centerX + 36, flourishY, centerX + 310, flourishY);
  rightGrad.addColorStop(0, palette.goldHex);
  rightGrad.addColorStop(1, 'rgba(193, 180, 137, 0.05)');
  ctx.strokeStyle = rightGrad;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(centerX + 36, flourishY);
  ctx.lineTo(centerX + 310, flourishY);
  ctx.stroke();

  const drawSmallDiamond = (dx: number, dy: number, r: number, col: string) => {
    ctx.beginPath();
    ctx.moveTo(dx, dy - r);
    ctx.lineTo(dx + r, dy);
    ctx.lineTo(dx, dy + r);
    ctx.lineTo(dx - r, dy);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };

  drawSmallDiamond(centerX, flourishY, 11, palette.goldHex);
  drawSmallDiamond(centerX, flourishY, 5, darkCol);
  drawSmallDiamond(centerX - 24, flourishY, 6, palette.primaryHex);
  drawSmallDiamond(centerX + 24, flourishY, 6, palette.primaryHex);
  drawSmallDiamond(centerX - 180, flourishY, 4.5, palette.goldHex);
  drawSmallDiamond(centerX + 180, flourishY, 4.5, palette.goldHex);

  ctx.restore();
}

/**
 * يرسم التوقيعات الرسمية في أسفل الشهادة كجزء متكامل من التكوين العام.
 */
function drawCertificateSignaturesFooter(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  state: CertificateFormState,
  palette: CertificateColorPalette
) {
  ctx.save();
  const resolved = resolveCertificateFooterSignatures(state);
  if (!resolved.rightBlock && !resolved.leftBlock) {
    ctx.restore();
    return;
  }

  const footerBaseY = pageH - 274;
  const bodyFont = getCertificateFontFamily(state.language, 'body');
  const darkCol =
    palette.id === '2' ? palette.primaryHex : palette.secondaryHex;

  const rightCenterX = pageW - 545;
  const leftCenterX = 545;

  const drawSingleSignatureBlock = (
    block: ResolvedSignatureBlock,
    cx: number
  ) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // خلفية إطار ناعمة لكتلة التوقيع تمنحها حضوراً رسمياً متماسكاً
    ctx.fillStyle = palette.softTintHex;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.roundRect(cx - 235, footerBaseY - 42, 470, 152, 18);
    ctx.fill();
    ctx.globalAlpha = 1;

    // خط علوي ذهبي قصير يمهد لكتلة التوقيع ويربطها بالتكوين العام
    ctx.strokeStyle = 'rgba(193, 180, 137, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 105, footerBaseY - 38);
    ctx.lineTo(cx + 105, footerBaseY - 38);
    ctx.stroke();

    // المسمى الوظيفي (مثل: مدير المدرسة / معلم المادة)
    ctx.font = `700 33px ${bodyFont}`;
    ctx.fillStyle = '#1E293B';
    ctx.fillText(block.title, cx, footerBaseY);

    // الاسم بحضور واضح ومتوازن
    ctx.font = `700 37px ${bodyFont}`;
    ctx.fillStyle = palette.primaryHex;
    ctx.fillText(block.name, cx, footerBaseY + 58);

    // قاعدة التوقيع المزدوجة المتكاملة مع الإطار السفلي
    ctx.strokeStyle = darkCol;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx - 220, footerBaseY + 108);
    ctx.lineTo(cx + 220, footerBaseY + 108);
    ctx.stroke();

    ctx.strokeStyle = palette.goldHex;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 165, footerBaseY + 116);
    ctx.lineTo(cx + 165, footerBaseY + 116);
    ctx.stroke();

    // حلية ماسية في منتصف خط التوقيع وعلى طرفيه
    const drawDiamond = (dx: number, dy: number, r: number, col: string) => {
      ctx.beginPath();
      ctx.moveTo(dx, dy - r);
      ctx.lineTo(dx + r, dy);
      ctx.lineTo(dx, dy + r);
      ctx.lineTo(dx - r, dy);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };

    drawDiamond(cx, footerBaseY + 108, 8, palette.goldHex);
    drawDiamond(cx - 220, footerBaseY + 108, 5.5, palette.primaryHex);
    drawDiamond(cx + 220, footerBaseY + 108, 5.5, palette.primaryHex);

    ctx.restore();
  };

  if (resolved.rightBlock) {
    drawSingleSignatureBlock(resolved.rightBlock, rightCenterX);
  }

  if (resolved.leftBlock) {
    drawSingleSignatureBlock(resolved.leftBlock, leftCenterX);
  }

  ctx.restore();
}

// ============================================================================
// ١٥. تحويل الشهادة إلى صفحة مرئية عالية الدقة (A4 Landscape) وتصدير PDF
// ============================================================================

export interface RenderedCertificatePage extends TeacherPageJpegWithLinks {
  dataUrl: string;
  beneficiaryName: string;
  beneficiaryDisplay: string;
  layoutPlan: CertificateBodyLayoutPlan;
}

function canvasToJpegAndDataUrl(
  canvas: HTMLCanvasElement,
  quality = 0.95
): { jpegBytes: Uint8Array; dataUrl: string } {
  if (typeof canvas.toDataURL !== 'function') {
    return {
      jpegBytes: MINIMAL_WHITE_JPEG,
      dataUrl: 'data:image/jpeg;base64,',
    };
  }
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return { jpegBytes: MINIMAL_WHITE_JPEG, dataUrl };
  }
  const base64 = dataUrl.slice(commaIdx + 1);
  if (!base64) {
    return { jpegBytes: MINIMAL_WHITE_JPEG, dataUrl };
  }
  const binaryStr =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { jpegBytes: bytes, dataUrl };
}

/**
 * ينشئ صفحات الشهادات بمقاس A4 أفقي (Landscape: 2380 × 1684 px).
 * كل مستفيد يحصل على صفحة شهادة مستقلة تماماً باسمه.
 */
export async function renderCertificatesToCanvases(
  state: CertificateFormState
): Promise<RenderedCertificatePage[]> {
  await ensureLocalCertificateFontsLoaded();

  const beneficiaries = parseCertificateBeneficiaryNames(
    state.beneficiariesInput
  );
  const palette = getCertificateColorPalette(state.colorSystemId);
  const assets = await loadCertificateVisualAssets();

  const PAGE_W = CERTIFICATE_LANDSCAPE_WIDTH_PX;
  const PAGE_H = CERTIFICATE_LANDSCAPE_HEIGHT_PX;

  const renderedPages: RenderedCertificatePage[] = [];

  for (const beneficiaryName of beneficiaries) {
    if (typeof document === 'undefined') {
      const beneficiaryDisplay = formatBeneficiaryDisplayLine(
        beneficiaryName,
        state
      );
      const layoutPlan = computeCertificateBodyLayout(null, {
        openingText: state.openingText,
        beneficiaryDisplay,
        mainText: state.mainText,
        additionalText: state.additionalText,
        language: state.language,
        bodyTopY: 525,
        bodyBottomY: 1280,
        maxTextWidth: 1520,
      });
      renderedPages.push({
        jpegBytes: MINIMAL_WHITE_JPEG,
        dataUrl: 'data:image/jpeg;base64,',
        pixelWidth: PAGE_W,
        pixelHeight: PAGE_H,
        links: [],
        beneficiaryName,
        beneficiaryDisplay,
        layoutPlan,
      });
      continue;
    }

    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to initialize 2D canvas context for certificate');
    }

    ctx.direction = state.language === 'en' ? 'ltr' : 'rtl';

    // ١. رسم إطار وترويسة القالب المختار (1 أو 2 أو 3) بالاتجاه الأفقي (Landscape)
    const stageBounds =
      state.templateId === '1'
        ? drawTemplate1LuxuryClassicLandscape(
            ctx,
            PAGE_W,
            PAGE_H,
            state,
            palette,
            assets
          )
        : state.templateId === '2'
          ? drawTemplate2ModernGeometricLandscape(
              ctx,
              PAGE_W,
              PAGE_H,
              state,
              palette,
              assets
            )
          : drawTemplate3OfficialEducationalLandscape(
              ctx,
              PAGE_W,
              PAGE_H,
              state,
              palette,
              assets
            );

    // ٢. حساب التخطيط التلقائي للنصوص الأربعة الخاصة بهذا المستفيد
    const beneficiaryDisplay = formatBeneficiaryDisplayLine(
      beneficiaryName,
      state
    );
    const layoutPlan = computeCertificateBodyLayout(ctx, {
      openingText: state.openingText,
      beneficiaryDisplay,
      mainText: state.mainText,
      additionalText: state.additionalText,
      language: state.language,
      bodyTopY: stageBounds.bodyTopY,
      bodyBottomY: stageBounds.bodyBottomY,
      maxTextWidth: stageBounds.maxTextWidth,
    });

    // ٣. رسم الأقسام النصية الأربعة وإبراز اسم المستفيد
    drawCertificateBodyContent(
      ctx,
      PAGE_W,
      state,
      palette,
      layoutPlan,
      stageBounds.highlightStyle
    );

    // ٤. رسم تذييل التوقيعات الرسمي المتوازن بدون أي تاريخ
    drawCertificateSignaturesFooter(ctx, PAGE_W, PAGE_H, state, palette);

    const { jpegBytes, dataUrl } = canvasToJpegAndDataUrl(canvas, 0.95);
    renderedPages.push({
      jpegBytes,
      dataUrl,
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
      links: [],
      beneficiaryName,
      beneficiaryDisplay,
      layoutPlan,
    });
  }

  return renderedPages;
}

export interface GeneratedCertificatesPdfResult {
  pdfBytes: Uint8Array;
  filename: string;
  pageCount: number;
  pages: RenderedCertificatePage[];
}

export function buildCertificatePdfFilename(
  state: CertificateFormState,
  singleBeneficiaryName?: string
): string {
  const typeLabel =
    state.language === 'en'
      ? state.certificateType === 'appreciation'
        ? 'Appreciation_Certificate'
        : state.certificateType === 'excellence'
          ? 'Excellence_Certificate'
          : 'Graduation_Certificate'
      : state.certificateType === 'appreciation'
        ? 'شهادة_شكر_وتقدير'
        : state.certificateType === 'excellence'
          ? 'شهادة_تفوق'
          : 'شهادة_تخرج';

  const beneficiaries = parseCertificateBeneficiaryNames(
    state.beneficiariesInput
  );

  if (singleBeneficiaryName !== undefined || beneficiaries.length === 1) {
    const rawName =
      singleBeneficiaryName !== undefined
        ? singleBeneficiaryName
        : beneficiaries[0] || '';
    const safeName = sanitizeFilenameSegment(rawName) || 'مستفيد';
    return `${typeLabel}_${safeName}_قالب${state.templateId}_لون${state.colorSystemId}.pdf`;
  }

  return `${typeLabel}_دفعة_${beneficiaries.length}_مستفيدين_قالب${state.templateId}_لون${state.colorSystemId}.pdf`;
}

/**
 * يصدر جميع الشهادات في ملف PDF واحد متعدد الصفحات بمقاس A4 أفقي (Landscape: 841.89 × 595.28 pt)
 * أو يصدر شهادة مستفيد محدد في ملف PDF مستقل.
 */
export async function generateCertificatesPdf(
  state: CertificateFormState,
  options?: { beneficiaryIndex?: number }
): Promise<GeneratedCertificatesPdfResult> {
  const allPages = await renderCertificatesToCanvases(state);
  const selectedPages =
    options?.beneficiaryIndex !== undefined &&
    allPages[options.beneficiaryIndex]
      ? [allPages[options.beneficiaryIndex]]
      : allPages;

  const pdfBytes = buildTeacherPdfBinaryWithLinks(
    selectedPages,
    CERTIFICATE_PDF_WIDTH_PT,
    CERTIFICATE_PDF_HEIGHT_PT
  );

  const singleName =
    selectedPages.length === 1 ? selectedPages[0].beneficiaryName : undefined;
  const filename = buildCertificatePdfFilename(state, singleName);

  return {
    pdfBytes,
    filename,
    pageCount: selectedPages.length,
    pages: selectedPages,
  };
}
