import { PLC_SECTION_THEME } from '../data/sections';
import { SchoolSettings } from '../types';
import {
  PlcCommunityRecord,
  PlcFormNumber,
} from './plcEngine';

/**
 * البادئة المحجوزة حصرياً لمعرفات المعاينة التجريبية (Batch 5.5)
 * لضمان العزل الكامل وعدم التعارض مع أي معرف لمجتمع حقيقي.
 */
export const PLC_DEMO_PREVIEW_ID_PREFIX = 'plc_demo_preview_';

export const PLC_DEMO_COMMUNITY_ID = `${PLC_DEMO_PREVIEW_ID_PREFIX}community_arabic_reading_01`;

export const PLC_DEMO_SCHOOL_NAME = 'مدرسة التميز المتوسطة النموذجية';

export const PLC_DEMO_TARGET_AUDIENCE = 'معلمو اللغة العربية';

export const PLC_DEMO_STAGE_LABEL = 'المرحلة المتوسطة';

/**
 * يتحقق مما إذا كان المعرف ينتمي إلى طبقة المعاينة التجريبية المعزولة.
 */
export function isPlcDemoPreviewId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith(PLC_DEMO_PREVIEW_ID_PREFIX);
}

/**
 * تلميحات إرشادية قصيرة وواضحة لكل نموذج داخل وضع المعاينة التجريبية.
 */
export const PLC_DEMO_FORM_HINTS: Record<PlcFormNumber, string> = {
  1: 'هنا تسجل البيانات التأسيسية للمجتمع وأعضائه وتحدد أدوارهم (رئيس المجتمع، المنسق، المقرر، الأعضاء) دون تكرار السجلات.',
  2: 'هنا توثق هوية المجتمع المهني: الرؤية، الرسالة، الأهداف، القيم، والمبادئ المهنية الحاكمة لعمل الفريق.',
  3: 'هنا تسجل احتياجات المجتمع المهنية ومصادرها ومبرراتها وتربطها بأهداف المجتمع.',
  4: 'هنا تربط الاحتياج بالهدف والإجراء في خطة تشغيلية زمنية وتتابع حالة التنفيذ.',
  5: 'هنا توثق محاضر الاجتماعات الدورية والحضور والغياب وتربط التوصيات بإجراءات الخطة التشغيلية.',
  6: 'هنا توثق البرامج والأنشطة والزيارات التبادلية والشراكات وتفصل بين النتائج التنفيذية المباشرة والأثر.',
  7: 'هنا تتابع التنفيذ وتقيس الأثر وتحلل مؤشرات الأداء بمختلف اتجاهاتها.',
  8: 'هنا تظهر الشواهد والمرفقات في مستودع موحد مرتبط بالسجلات دون تكرار رفع الملفات.',
  9: 'هنا تظهر الشواهد والتقرير الختامي الشامل مع الجداول والرسوم البيانية التلقائية ومعاينة وتصدير PDF.',
};

/**
 * يبني صورة SVG تجريبية آمنة ومضمنة (Data URL) للشواهد التجريبية دون أي ارتباط بروابط خارجية.
 */
function buildDemoEvidenceSvgDataUrl(
  title: string,
  subtitle: string,
  accentHex = PLC_SECTION_THEME.primaryHex
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520" dir="rtl">
    <rect width="800" height="520" rx="24" fill="#FAF8F5" />
    <rect x="24" y="24" width="752" height="472" rx="18" fill="#FFFFFF" stroke="${accentHex}" stroke-width="3" />
    <rect x="24" y="24" width="752" height="86" rx="16" fill="${accentHex}" />
    <text x="740" y="64" text-anchor="start" fill="#FFFFFF" font-family="Tajawal, Cairo, sans-serif" font-size="22" font-weight="bold">${title}</text>
    <text x="740" y="94" text-anchor="start" fill="#FDE68A" font-family="Tajawal, Cairo, sans-serif" font-size="15">${PLC_DEMO_SCHOOL_NAME} • وثيقة شاهد تجريبي</text>
    <rect x="56" y="142" width="688" height="90" rx="12" fill="${PLC_SECTION_THEME.softBgHex}" stroke="${PLC_SECTION_THEME.borderHex}" stroke-width="1.5" />
    <text x="720" y="182" text-anchor="start" fill="#1F2937" font-family="Tajawal, Cairo, sans-serif" font-size="18" font-weight="bold">${subtitle}</text>
    <text x="720" y="212" text-anchor="start" fill="#4B5563" font-family="Tajawal, Cairo, sans-serif" font-size="14">مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي — المرحلة المتوسطة</text>
    <rect x="56" y="256" width="210" height="110" rx="12" fill="#F8FAFC" stroke="#CBD5E1" />
    <text x="161" y="295" text-anchor="middle" fill="#64748B" font-family="Tajawal, Cairo, sans-serif" font-size="14">المجال والتخصص</text>
    <text x="161" y="330" text-anchor="middle" fill="#0F172A" font-family="Tajawal, Cairo, sans-serif" font-size="17" font-weight="bold">اللغة العربية</text>
    <rect x="295" y="256" width="210" height="110" rx="12" fill="#F8FAFC" stroke="#CBD5E1" />
    <text x="400" y="295" text-anchor="middle" fill="#64748B" font-family="Tajawal, Cairo, sans-serif" font-size="14">الفئة المستهدفة</text>
    <text x="400" y="330" text-anchor="middle" fill="#0F172A" font-family="Tajawal, Cairo, sans-serif" font-size="17" font-weight="bold">معلمو اللغة العربية</text>
    <rect x="534" y="256" width="210" height="110" rx="12" fill="#F0FDF4" stroke="#BBF7D0" />
    <text x="639" y="295" text-anchor="middle" fill="#166534" font-family="Tajawal, Cairo, sans-serif" font-size="14">حالة التوثيق</text>
    <text x="639" y="330" text-anchor="middle" fill="#15803D" font-family="Tajawal, Cairo, sans-serif" font-size="17" font-weight="bold">شاهد نموذجي مكتمل</text>
    <text x="400" y="435" text-anchor="middle" fill="${PLC_SECTION_THEME.primaryHex}" font-family="Tajawal, Cairo, sans-serif" font-size="15" font-weight="bold">نموذج تطبيقي للمعاينة التجريبية — معزول تماماً عن بيانات المستخدم الفعلية</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * يرجع إعدادات مدرسة افتراضية خاصة بالمعاينة التجريبية فقط دون تعديل إعدادات المستخدم.
 */
export function getPlcDemoPreviewSchoolSettings(
  baseSettings: SchoolSettings
): SchoolSettings {
  return {
    ...baseSettings,
    schoolName: PLC_DEMO_SCHOOL_NAME,
    educationDepartment: baseSettings.educationDepartment || 'إدارة التعليم النموذجية',
    academicYear: baseSettings.academicYear || '١٤٤٧هـ',
    principalName: 'أ. فهد بن عبدالعزيز الراشد (بيانات تجريبية)',
    userName: 'أ. عبدالرحمن بن صالح المنصور',
    roles: {
      ...baseSettings.roles,
      teacher: 'أ. عبدالرحمن بن صالح المنصور',
    },
  };
}

/**
 * ينشئ نسخة جديدة ومعزولة تماماً من المجتمع المهني النموذجي المكتمل
 * «مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي»
 * مع كافة النماذج (1 إلى 9) مترابطة بالمعرفات الثابتة.
 */
export function getPlcDemoPreviewCommunity(
  academicYear = '١٤٤٧هـ'
): PlcCommunityRecord {
  const effectiveYear = academicYear && academicYear.trim() ? academicYear.trim() : '١٤٤٧هـ';

  // معرفات الأعضاء (النموذج 1) — رئيس المجتمع عضو فعلي داخل قائمة الأعضاء دون تكرار
  const mbrLeaderId = `${PLC_DEMO_PREVIEW_ID_PREFIX}mbr_leader_01`;
  const mbrCoordId = `${PLC_DEMO_PREVIEW_ID_PREFIX}mbr_coord_02`;
  const mbrRappId = `${PLC_DEMO_PREVIEW_ID_PREFIX}mbr_rapp_03`;
  const mbrFollowupId = `${PLC_DEMO_PREVIEW_ID_PREFIX}mbr_followup_04`;
  const mbrMemberId = `${PLC_DEMO_PREVIEW_ID_PREFIX}mbr_member_05`;

  // معرفات الأهداف (النموذج 2)
  const goal1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}goal_01`;
  const goal2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}goal_02`;
  const goal3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}goal_03`;
  const goal4Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}goal_04`;

  // معرفات الاحتياجات (النموذج 3)
  const need1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}need_01`;
  const need2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}need_02`;
  const need3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}need_03`;
  const need4Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}need_04`;

  // معرفات إجراءات الخطة التشغيلية (النموذج 4)
  const act1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}action_01`;
  const act2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}action_02`;
  const act3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}action_03`;
  const act4Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}action_04`;
  const act5Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}action_05`;

  // معرفات الاجتماعات والتوصيات (النموذج 5)
  const mtg1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}meeting_01`;
  const mtg2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}meeting_02`;
  const mtg3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}meeting_03`;

  const rec1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}rec_01`;
  const rec2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}rec_02`;
  const rec3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}rec_03`;
  const rec4Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}rec_04`;
  const rec5Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}rec_05`;
  const rec6Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}rec_06`;

  // معرفات البرامج والأنشطة والزيارات والشراكات (النموذج 6)
  const execProgramId = `${PLC_DEMO_PREVIEW_ID_PREFIX}exec_program_01`;
  const execActivityId = `${PLC_DEMO_PREVIEW_ID_PREFIX}exec_activity_02`;
  const execVisitId = `${PLC_DEMO_PREVIEW_ID_PREFIX}exec_visit_03`;
  const execPartnerId = `${PLC_DEMO_PREVIEW_ID_PREFIX}exec_partner_04`;

  // معرفات التقويم والمؤشرات وقياس الأثر (النموذج 7)
  const eval1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}eval_01`;
  const eval2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}eval_02`;
  const eval3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}eval_03`;

  const kpi1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}kpi_01`;
  const kpi2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}kpi_02`;
  const kpi3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}kpi_03`;
  const kpi4Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}kpi_04`;

  const imp1Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}impact_01`;
  const imp2Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}impact_02`;
  const imp3Id = `${PLC_DEMO_PREVIEW_ID_PREFIX}impact_03`;

  // معرفات مستودع الشواهد الموحد (النموذج 8)
  const evd1MinutesId = `${PLC_DEMO_PREVIEW_ID_PREFIX}evd_minutes_01`;
  const evd2SurveyId = `${PLC_DEMO_PREVIEW_ID_PREFIX}evd_survey_02`;
  const evd3ResultsReportId = `${PLC_DEMO_PREVIEW_ID_PREFIX}evd_results_report_03`;
  const evd4ActivityPhotoId = `${PLC_DEMO_PREVIEW_ID_PREFIX}evd_activity_photo_04`;
  const evd5ObservationFormId = `${PLC_DEMO_PREVIEW_ID_PREFIX}evd_observation_form_05`;
  const evd6ImpactFileId = `${PLC_DEMO_PREVIEW_ID_PREFIX}evd_impact_file_06`;

  return {
    id: PLC_DEMO_COMMUNITY_ID,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-11-05T10:30:00.000Z',

    // ========================================================================
    // النموذج 1: بيانات المجتمع وأعضاؤه
    // ========================================================================
    name: 'مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي',
    specialty: 'اللغة العربية — الفئة المستهدفة: معلمو اللغة العربية — المرحلة المتوسطة',
    academicYear: effectiveYear,
    semester: 'full_year',
    venue: `قاعة التطوير المهني ومصادر التعلّم — ${PLC_DEMO_SCHOOL_NAME}`,
    foundationDate: '2026-09-01',
    status: 'active',
    members: [
      {
        id: mbrLeaderId,
        name: 'أ. عبدالرحمن بن صالح المنصور',
        specialty: 'اللغة العربية',
        jobRole: 'معلم متقدم (المرحلة المتوسطة)',
        roles: ['leader'],
        email: 'almansour.demo@school.edu.sa',
        phone: '0500001001',
        notes: 'رئيس المجتمع والمشرف على تصميم حقيبة الفهم القرائي',
      },
      {
        id: mbrCoordId,
        name: 'أ. فيصل بن محمد العتيبي',
        specialty: 'اللغة العربية',
        jobRole: 'معلم (الصف الثاني المتوسط)',
        roles: ['coordinator'],
        email: 'alotaibi.demo@school.edu.sa',
        phone: '0500001002',
        notes: 'منسق المجتمع ومسؤول جدولة الزيارات التبادلية',
      },
      {
        id: mbrRappId,
        name: 'أ. خالد بن عبدالله السبيعي',
        specialty: 'اللغة العربية',
        jobRole: 'معلم (الصف الأول المتوسط)',
        roles: ['rapporteur'],
        email: 'alsubaie.demo@school.edu.sa',
        phone: '0500001003',
        notes: 'مقرر المجتمع ومسؤول توثيق المحاضر والشواهد',
      },
      {
        id: mbrFollowupId,
        name: 'أ. ماجد بن ناصر القحطاني',
        specialty: 'اللغة العربية',
        jobRole: 'معلم (الصف الثالث المتوسط)',
        roles: ['member', 'followup'],
        email: 'alkahtani.demo@school.edu.sa',
        phone: '0500001004',
        notes: 'عضو ومسؤول متابعة تنفيذ التوصيات وأدوات القياس',
      },
      {
        id: mbrMemberId,
        name: 'أ. ياسر بن فهد الدوسري',
        specialty: 'اللغة العربية — مصادر التعلّم',
        jobRole: 'معلم لغة عربية وأمين مصادر التعلّم',
        roles: ['member'],
        email: 'aldosari.demo@school.edu.sa',
        phone: '0500001005',
        notes: 'منسق أنشطة القراءة الإثرائية والشراكة مع مصادر التعلّم',
      },
    ],

    // ========================================================================
    // النموذج 2: التعريف بالمجتمع
    // ========================================================================
    identity: {
      vision:
        'الريادة في تمكين طلاب المرحلة المتوسطة من مهارات القراءة الواعية والفهم القرائي العميق وتحليل النصوص وتذوقها بكفاءة عالية.',
      mission:
        'بناء بيئة تعلّم مهنية تشاركية لمعلمي اللغة العربية في المرحلة المتوسطة لتطوير استراتيجيات تدريس الفهم القرائي، وتصميم أدوات تقويم تشخيصية وتكوينية دقيقة، وتبادل الممارسات الصفية المبنية على الدليل لتحسين نواتج التعلّم.',
      goals: [
        {
          id: goal1Id,
          text: 'رفع مستوى إتقان طلاب المرحلة المتوسطة لمهارات الفهم القرائي الاستنتاجي والنقدي في النصوص القرائية.',
          order: 1,
        },
        {
          id: goal2Id,
          text: 'تمكين معلمي اللغة العربية من توظيف استراتيجيات التدريس التبادلي والقراءة الموجهة داخل الصف الدراسي.',
          order: 2,
        },
        {
          id: goal3Id,
          text: 'تطوير أدوات التقويم التشخيصي والتكويني لقياس الفاقد القرائي ومعالجة تعثر الطلاب بصورة مستمرة.',
          order: 3,
        },
        {
          id: goal4Id,
          text: 'تفعيل الشراكة المهنية والمجتمعية مع مركز مصادر التعلّم والأسرة لدعم عادات القراءة الواعية لدى الطلاب.',
          order: 4,
        },
      ],
      values: [
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}val_01`,
          text: 'التشاركية والتعاون المهني بين معلمي التخصص',
          order: 1,
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}val_02`,
          text: 'المسؤولية المشتركة عن تقدم جميع الطلاب في مهارات القراءة',
          order: 2,
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}val_03`,
          text: 'الموضوعية والشفافية في قراءة نتائج الطلاب وتحليلها',
          order: 3,
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}val_04`,
          text: 'الالتزام بالتحسين المستمر للممارسات التدريسية',
          order: 4,
        },
      ],
      principles: [
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}prin_01`,
          text: 'التركيز على نواتج التعلّم القرائية الفعلية للطالب بدلاً من الاكتفاء بإنجاز المهام الشكلية',
          order: 1,
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}prin_02`,
          text: 'اتخاذ القرارات التعليمية والعلاجية استناداً إلى نتائج القياس القبلي والبعدي والشواهد الصفية',
          order: 2,
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}prin_03`,
          text: 'الفصل المنهجي الواضح بين مخرجات التنفيذ المباشرة وبين الأثر التربوي المتحقق',
          order: 3,
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}prin_04`,
          text: 'التأمل المهني المستمر من خلال الزيارات الصفية التبادلية ومناقشة نماذج أعمال الطلاب',
          order: 4,
        },
      ],
    },

    // ========================================================================
    // النموذج 3: الاحتياجات والأولويات
    // ========================================================================
    needs: [
      {
        id: need1Id,
        description:
          'انخفاض نسبة إتقان الطلاب لمهارات الفهم القرائي الاستنتاجي (استنتاج الفكرة الضمنية، وتحليل العلاقات بين الفقرات، والتمييز بين الحقيقة والرأي).',
        source: 'student_results',
        justification:
          'أظهرت نتائج الاختبار التشخيصي القبلي في بداية العام الدراسي أن متوسط الإتقان في أسئلة الفهم الاستنتاجي بلغ 58% فقط مع وجود 32% من الطلاب دون مستوى التمكن الأدنى.',
        priority: 'high',
        proposedAction:
          'تصميم وتطبيق حقيبة نصوص تشخيصية قصيرة متدرجة المستويات مع تدريبات أسبوعية مركزة في الحصص.',
        linkedGoalIds: [goal1Id, goal3Id],
        notes: 'أولوية قصوى للفصل الدراسي الحالي تشمل الصفوف الأول والثاني والثالث المتوسط.',
      },
      {
        id: need2Id,
        description:
          'الحاجة إلى تنويع استراتيجيات تدريس الفهم القرائي وتفعيل التدريس التبادلي (التنبؤ، التساؤل، التوضيح، التلخيص) داخل الحصة.',
        source: 'classroom_observation',
        justification:
          'رصدت بطاقات الملاحظة الصفية الأولية اعتماد معظم الحصص على القراءة الجهرية التقليدية والأسئلة المباشرة بنسبة 60% من زمن الحصة.',
        priority: 'high',
        proposedAction:
          'عقد برنامج تدريبي تطبيقي للمعلمين يتبعه تنفيذ زيارات صفية تبادلية لنمذجة استراتيجيات التدريس التبادلي.',
        linkedGoalIds: [goal2Id],
        notes: 'يرتبط مباشرة بتطوير الأداء التدريسي لمعلمي اللغة العربية.',
      },
      {
        id: need3Id,
        description:
          'الحاجة إلى توحيد معايير التقويم التكويني لمهارات القراءة وبناء سلالم تقدير لفظية ورقمية مشتركة بين معلمي المرحلة المتوسطة.',
        source: 'performance_analysis',
        justification:
          'تفاوت أدوات التقويم المستخدمة بين الفصول الدراسية مما يصعّب مقارنة تقدم الطلاب وتتبع معالجة الفاقد القرائي بدقة.',
        priority: 'medium',
        proposedAction:
          'بناء بنك نصوص واختبارات تكوينية قصيرة موحدة المعايير وتطبيقها دورياً كل أسبوعين.',
        linkedGoalIds: [goal3Id, goal1Id],
        notes: 'يُنفذ بالتشارك بين جميع معلمي اللغة العربية في المدرسة.',
      },
      {
        id: need4Id,
        description:
          'ضعف دافعية بعض الطلاب نحو القراءة الإثرائية الحرة خارج الكتاب المدرسي وقلة استثمار أوعية مركز مصادر التعلّم.',
        source: 'survey',
        justification:
          'أشارت نتائج استبانة الميول القرائية إلى أن 64% من الطلاب لا يمارسون القراءة الحرة الأسبوعية خارج المقررات الدراسية.',
        priority: 'low',
        proposedAction:
          'إطلاق شراكة مع مركز مصادر التعلّم وأولياء الأمور لتنفيذ مبادرة «القارئ الواعي» وتخصيص جواز سفر قرائي للطالب.',
        linkedGoalIds: [goal4Id],
        notes: 'احتياج داعم ومساند للخطة الأساسية.',
      },
    ],

    // ========================================================================
    // النموذج 4: الخطة التشغيلية (تغطي الحالات: منفذ، قيد التنفيذ، متعثر، لم يبدأ)
    // ========================================================================
    operationalPlan: [
      {
        id: act1Id,
        goalId: goal2Id,
        needId: need2Id,
        needIds: [need2Id],
        title:
          'تنفيذ برنامج تدريبي تطبيقي لمعلمي اللغة العربية حول استراتيجيات التدريس التبادلي وتعميق الفهم القرائي',
        responsibleMemberId: mbrLeaderId,
        responsibleName: 'أ. عبدالرحمن بن صالح المنصور',
        startDate: '2026-09-10',
        endDate: '2026-09-25',
        resources: 'حقيبة تدريبية تطبيقية، نماذج نصوص قرائية، قاعة التطوير المهني',
        indicatorId: kpi4Id,
        indicatorText: 'تدريب 100% من معلمي اللغة العربية وإعداد 4 نماذج دروس تطبيقية',
        status: 'completed',
        completionPercentage: 100,
        notes: 'تم التنفيذ بالكامل وإيداع النماذج في مستودع الشواهد.',
      },
      {
        id: act2Id,
        goalId: goal1Id,
        needId: need1Id,
        needIds: [need1Id, need3Id],
        title:
          'تصميم وتطبيق حقيبة النصوص التشخيصية القصيرة والاختبارات التكوينية لنواتج الفهم القرائي الاستنتاجي',
        responsibleMemberId: mbrCoordId,
        responsibleName: 'أ. فيصل بن محمد العتيبي',
        startDate: '2026-09-20',
        endDate: '2026-11-30',
        resources: 'نصوص قرائية متدرجة، نماذج تقويم تكويني، كشوف رصد معيارية',
        indicatorId: kpi1Id,
        indicatorText: 'إنجاز 12 نصاً تشخيصياً ورفع متوسط الإتقان إلى 80%',
        status: 'in_progress',
        completionPercentage: 75,
        notes: 'تم اعتماد الـ 12 نصاً وتطبيق 9 نصوص منها في الفصول حتى الآن.',
      },
      {
        id: act3Id,
        goalId: goal2Id,
        needId: need2Id,
        needIds: [need2Id],
        title:
          'تنفيذ برنامج الزيارات الصفية التبادلية لنمذجة حصص الفهم القرائي العميق وتحليل استجابات الطلاب',
        responsibleMemberId: mbrRappId,
        responsibleName: 'أ. خالد بن عبدالله السبيعي',
        startDate: '2026-10-01',
        endDate: '2026-10-28',
        resources: 'بطاقة ملاحظة صفية مقننة، جدول حصص معلن، نماذج تأمل مهني',
        indicatorId: kpi4Id,
        indicatorText: 'تنفيذ 4 زيارات تبادلية موثقة ببطاقات ملاحظة صفية',
        status: 'completed',
        completionPercentage: 100,
        notes: 'نفذت الزيارات التبادلية ونوقشت تغذيتها الراجعة في الاجتماع الثاني.',
      },
      {
        id: act4Id,
        goalId: goal4Id,
        needId: need4Id,
        needIds: [need4Id],
        title:
          'تفعيل مبادرة الشراكة القرائية «القارئ الواعي» بالتعاون مع مركز مصادر التعلّم وأولياء الأمور',
        responsibleMemberId: mbrFollowupId,
        responsibleName: 'أ. ماجد بن ناصر القحطاني',
        startDate: '2026-10-10',
        endDate: '2026-11-05',
        resources: 'مكتبة مصادر التعلّم، بطاقات متابعة أسرية، نشرات توجيهية',
        indicatorText: 'مشاركة 70% من الطلاب وأسرهم في سجل القراءة الأسبوعي',
        status: 'stalled',
        completionPercentage: 30,
        notes: 'تأخر إطلاق المرحلة الثانية بسبب تزامنها مع فترة الاختبارات الفترية وإعادة جدولة حصص المصادر.',
      },
      {
        id: act5Id,
        goalId: goal3Id,
        needId: need3Id,
        needIds: [need3Id],
        title:
          'إقامة المعرض القرائي الختامي لمخرجات الطلاب في تلخيص النصوص ونقدها وتكريم الطلاب المتحسنين',
        responsibleMemberId: mbrMemberId,
        responsibleName: 'أ. ياسر بن فهد الدوسري',
        startDate: '2026-12-01',
        endDate: '2026-12-15',
        resources: 'قاعة مصادر التعلّم، لوحات عرض، نماذج أعمال الطلاب',
        indicatorText: 'عرض مخرجات 6 فصول دراسية في المعرض الختامي',
        status: 'not_started',
        completionPercentage: 0,
        notes: 'مجدول للتنفيذ في نهاية الفصل الدراسي بعد استكمال التطبيق البعدي.',
      },
    ],

    // ========================================================================
    // النموذج 5: الاجتماعات ومحاضرها (3 اجتماعات نموذجية مكتملة)
    // ========================================================================
    meetings: [
      {
        id: mtg1Id,
        meetingNumber: 1,
        date: '2026-09-05',
        meetingType: 'اجتماع تأسيسي وتحليل الاحتياجات',
        venue: `قاعة التطوير المهني — ${PLC_DEMO_SCHOOL_NAME}`,
        attendance: [
          { memberId: mbrLeaderId, present: true },
          { memberId: mbrCoordId, present: true },
          { memberId: mbrRappId, present: true },
          { memberId: mbrFollowupId, present: true },
          { memberId: mbrMemberId, present: true },
        ],
        agenda: [
          'اعتماد رؤية ورسالة وأهداف مجتمع معلمي اللغة العربية وتوزيع الأدوار.',
          'تحليل نتائج الاختبار التشخيصي القبلي واستبانة الميول القرائية لطلاب المرحلة المتوسطة.',
          'إقرار قائمة الاحتياجات المهنية ذات الأولوية واعتماد الخطة التشغيلية الفصلية.',
        ],
        discussionSummary:
          'استعرض رئيس المجتمع نتائج الاختبار التشخيصي القبلي لطلاب الصفوف الثلاثة، واتفق الأعضاء على أن التحدي الأبرز يتمثل في أسئلة الفهم الاستنتاجي والتمييز بين الحقيقة والرأي، وتم إقرار البدء بالورشة التدريبية وتصميم حقيبة النصوص المتدرجة.',
        recommendations: [
          {
            id: rec1Id,
            text: 'إعداد وتنفيذ الورشة التطبيقية لاستراتيجيات التدريس التبادلي قبل نهاية الأسبوع الثالث.',
            responsibleMemberId: mbrLeaderId,
            responsibleName: 'أ. عبدالرحمن بن صالح المنصور',
            targetDate: '2026-09-25',
            followupStatus: 'completed',
            followupNotes: 'نفذت الورشة بحضور جميع معلمي التخصص وتم توثيقها.',
            linkedActionId: act1Id,
          },
          {
            id: rec2Id,
            text: 'بناء 12 نصاً قرائياً تشخيصياً قصيراً متدرج المستوى مع أسئلة استنتاجية ونقدية مقننة.',
            responsibleMemberId: mbrCoordId,
            responsibleName: 'أ. فيصل بن محمد العتيبي',
            targetDate: '2026-10-05',
            followupStatus: 'completed',
            followupNotes: 'تم اعتماد النصوص الـ 12 وتوزيعها على الفصول للتطبيق الأسبوعي.',
            linkedActionId: act2Id,
          },
        ],
        evidenceIds: [evd1MinutesId, evd2SurveyId],
        qrCodeToken: 'PLC_DEMO_QR_MTG_01',
      },
      {
        id: mtg2Id,
        meetingNumber: 2,
        date: '2026-10-12',
        meetingType: 'اجتماع متابعة التنفيذ ومراجعة الزيارات التبادلية',
        venue: `قاعة مصادر التعلّم — ${PLC_DEMO_SCHOOL_NAME}`,
        attendance: [
          { memberId: mbrLeaderId, present: true },
          { memberId: mbrCoordId, present: true },
          { memberId: mbrRappId, present: true },
          { memberId: mbrFollowupId, present: true },
          {
            memberId: mbrMemberId,
            present: false,
            absenceNote: 'مشارك في لقاء تدريبي خارجي لأمناء مصادر التعلّم بعذر رسمي',
          },
        ],
        agenda: [
          'مناقشة مخرجات الزيارات الصفية التبادلية وبطاقات الملاحظة الصفية المطبقة.',
          'مراجعة نتائج التطبيق المرحلي لحقيبة النصوص التشخيصية في الصفين الأول والثاني المتوسط.',
          'بحث أسباب تأخر إطلاق المرحلة الثانية من مبادرة الشراكة القرائية مع الأسرة.',
        ],
        discussionSummary:
          'ناقش الفريق نتائج الزيارات التبادلية التي أظهرت تحسناً واضحاً في توظيف التساؤل الذاتي والتلخيص، كما استعرض أسباب تعثر مبادرة القراءة الأسرية بسبب ضغط الاختبارات الفترية وقرر إعادة جدولتها وتبسيط نموذج المتابعة.',
        recommendations: [
          {
            id: rec3Id,
            text: 'استكمال تطبيق النصوص التشخيصية من النص السابع إلى التاسع ورصد تقدم الطلاب المتعثرين.',
            responsibleMemberId: mbrCoordId,
            responsibleName: 'أ. فيصل بن محمد العتيبي',
            targetDate: '2026-11-10',
            followupStatus: 'in_progress',
            followupNotes: 'جارٍ التطبيق في جميع الفصول وفق الجدول المعدل.',
            linkedActionId: act2Id,
          },
          {
            id: rec4Id,
            text: 'تعديل آلية مبادرة «القارئ الواعي» لتقتصر على نص أسبوعي واحد من مصادر التعلّم لتجاوز التعثر.',
            responsibleMemberId: mbrFollowupId,
            responsibleName: 'أ. ماجد بن ناصر القحطاني',
            targetDate: '2026-11-05',
            followupStatus: 'delayed',
            followupNotes: 'تأخر التسليم أسبوعاً واحداً لحين اعتماد النماذج المختصرة.',
            linkedActionId: act4Id,
          },
        ],
        evidenceIds: [evd3ResultsReportId, evd5ObservationFormId],
        qrCodeToken: 'PLC_DEMO_QR_MTG_02',
      },
      {
        id: mtg3Id,
        meetingNumber: 3,
        date: '2026-11-04',
        meetingType: 'اجتماع تقويم المؤشرات وتحليل قياس الأثر',
        venue: `قاعة التطوير المهني — ${PLC_DEMO_SCHOOL_NAME}`,
        attendance: [
          { memberId: mbrLeaderId, present: true },
          { memberId: mbrCoordId, present: true },
          { memberId: mbrRappId, present: true },
          { memberId: mbrFollowupId, present: true },
          { memberId: mbrMemberId, present: true },
        ],
        agenda: [
          'تحليل نتائج القياس البعدي لمؤشرات الأداء (KPIs) ومقارنتها بخط الأساس والمستهدف.',
          'مراجعة سجلات قياس الأثر وتصنيفها بين الأثر المثبت كمياً والنتائج الموصوفة نوعياً.',
          'اعتماد قرارات التحسين والتوصيات الختامية وإعداد التقرير الختامي للمجتمع.',
        ],
        discussionSummary:
          'تمت مقارنة قراءات خط الأساس بالقراءات الفعلية بعد تطبيق النصوص التشخيصية والتدريس التبادلي، حيث ارتفع متوسط إتقان الفهم الاستنتاجي من 58% إلى 76%، وانخفضت نسبة المتعثرين من 32% إلى 15%، وتم إقرار التوسع في الحقيبة للفصل القادم.',
        recommendations: [
          {
            id: rec5Id,
            text: 'اعتماد ملف نتائج قياس الأثر وتعميم حقيبة النصوص التشخيصية على جميع فصول المرحلة المتوسطة.',
            responsibleMemberId: mbrLeaderId,
            responsibleName: 'أ. عبدالرحمن بن صالح المنصور',
            targetDate: '2026-11-15',
            followupStatus: 'completed',
            followupNotes: 'تم إيداع التقرير التحليلي في مستودع الشواهد وربطه بالتقرير الختامي.',
            linkedActionId: act2Id,
          },
          {
            id: rec6Id,
            text: 'البدء في تجهيز أركان المعرض القرائي الختامي لعرض ملخصات الطلاب ونماذج نقد النصوص.',
            responsibleMemberId: mbrMemberId,
            responsibleName: 'أ. ياسر بن فهد الدوسري',
            targetDate: '2026-12-05',
            followupStatus: 'not_started',
            followupNotes: 'يبدأ الإعداد مطلع الشهر القادم.',
            linkedActionId: act5Id,
          },
        ],
        evidenceIds: [evd3ResultsReportId, evd6ImpactFileId],
        qrCodeToken: 'PLC_DEMO_QR_MTG_03',
      },
    ],

    // ========================================================================
    // النموذج 6: البرامج والأنشطة والزيارات والشراكات (مع الفصل التام بين النتائج والأثر)
    // ========================================================================
    activities: [
      {
        id: execProgramId,
        title: 'البرنامج التدريبي التطبيقي: استراتيجيات التدريس التبادلي وتعميق الفهم القرائي',
        type: 'program',
        goalId: goal2Id,
        needId: need2Id,
        actionId: act1Id,
        objectiveText:
          'تمكين معلمي اللغة العربية من تطبيق خطوات التدريس التبادلي الأربع (التنبؤ، التساؤل، التوضيح، التلخيص) وتصميم أنشطة فهم قرائي مستندة إلى النص.',
        targetAudience: 'معلمو اللغة العربية بالمرحلة المتوسطة (5 معلمين)',
        executionDateOrPeriod: '2026-09-14 إلى 2026-09-18',
        responsibleMemberIds: [mbrLeaderId, mbrCoordId],
        responsibleNames: 'أ. عبدالرحمن بن صالح المنصور، أ. فيصل بن محمد العتيبي',
        actualExecutionDescription:
          'تم تنفيذ 3 جلسات تدريبية وورشة عمل تطبيقية بواقع 6 ساعات تدريبية تضمنت تحليل نصوص مختارة من مقررات الصفوف الثلاثة وتصميم بطاقات عمل صفية.',
        results:
          'النتائج التنفيذية المباشرة: اكتمال تدريب 5 معلمين بنسبة حضور 100%، وإنتاج 4 نماذج دروس تطبيقية، وتصميم 12 نصاً تشخيصياً قصيراً.',
        status: 'completed',
        evidenceIds: [evd4ActivityPhotoId, evd1MinutesId],
        qrCodeToken: 'PLC_DEMO_QR_EXEC_01',
      },
      {
        id: execActivityId,
        title: 'النشاط التطبيقي: تطبيق بطاقات التساؤل الذاتي واستنتاج المعنى الضمني في حصص القراءة',
        type: 'activity',
        goalId: goal1Id,
        needId: need1Id,
        actionId: act2Id,
        objectiveText:
          'تدريب الطلاب عملياً داخل الحصة على صياغة أسئلة استنتاجية حول النص وتحديد الفكرة الرئيسة والضمنية.',
        targetAudience: 'طلاب الصفوف الأول والثاني والثالث المتوسط (120 طالباً)',
        executionDateOrPeriod: '2026-09-25 إلى 2026-11-20',
        responsibleMemberIds: [mbrCoordId, mbrFollowupId],
        responsibleNames: 'أ. فيصل بن محمد العتيبي، أ. ماجد بن ناصر القحطاني',
        actualExecutionDescription:
          'تطبيق نشاط قرائي أسبوعي مدته 15 دقيقة في بداية حصة فهم المقروء باستخدام النصوص القصيرة المتدرجة وتوزيع أدوار القراءة التشاركية بين مجموعات الطلاب.',
        results:
          'النتائج التنفيذية المباشرة: تنفيذ 18 حصة تطبيقية في 6 فصول دراسية، وتطبيق 9 نصوص تشخيصية من أصل 12 نصاً معتمداً في الحقيبة.',
        status: 'in_progress',
        evidenceIds: [evd3ResultsReportId],
        qrCodeToken: 'PLC_DEMO_QR_EXEC_02',
      },
      {
        id: execVisitId,
        title: 'الزيارة الصفية التبادلية لنمذجة تدريس مهارة استنتاج الفكرة الضمنية والتمييز بين الحقيقة والرأي',
        type: 'mutual_visit',
        goalId: goal2Id,
        needId: need2Id,
        actionId: act3Id,
        objectiveText:
          'تبادل الخبرات التدريسية وملاحظة تطبيق استراتيجية التدريس التبادلي وتفاعل الطلاب مع الأسئلة العميقة.',
        targetAudience: 'معلمو اللغة العربية بالمرحلة المتوسطة',
        executionDateOrPeriod: '2026-10-08',
        responsibleMemberIds: [mbrRappId, mbrLeaderId],
        responsibleNames: 'أ. خالد بن عبدالله السبيعي، أ. عبدالرحمن بن صالح المنصور',
        actualExecutionDescription:
          'تنفيذ 4 زيارات صفية تبادلية مجدولة في فصول الصفين الأول والثاني المتوسط متبوعة بجلسة مداولة مهنية لمناقشة بطاقات الملاحظة.',
        results:
          'النتائج التنفيذية المباشرة: إنجاز 4 زيارات تبادلية موثقة ببطاقات ملاحظة صفية مقننة ومشاركة جميع معلمي التخصص الخمسة.',
        status: 'completed',
        hostOrVisitingEntity: 'المعلم المستضيف: أ. فيصل بن محمد العتيبي (الصف الثاني المتوسط — ب)',
        participantsText: 'أ. عبدالرحمن المنصور، أ. خالد السبيعي، أ. ماجد القحطاني، أ. ياسر الدوسري',
        keyObservations:
          'توزيع فاعل لأدوار المجموعات القرائية (المتنبئ، المتسائل، الموضح، الملخص) واستخدام بطاقات सبر الفهم قبل الانتقال للفقرة التالية.',
        lessonsLearned:
          'تخصيص 5 دقائق في ختام الحصة لكتابة جملة تلخيصية فردية لكل طالب يسهل من خلالها فرز الطلاب المحتاجين لدعم فوري.',
        evidenceIds: [evd5ObservationFormId],
        qrCodeToken: 'PLC_DEMO_QR_EXEC_03',
      },
      {
        id: execPartnerId,
        title: 'شراكة مهنية ومجتمعية مع مركز مصادر التعلّم وأولياء الأمور في مبادرة «القارئ الواعي»',
        type: 'community_partnership',
        goalId: goal4Id,
        needId: need4Id,
        actionId: act4Id,
        objectiveText:
          'ربط أنشطة الفهم القرائي الصفية بالقراءة الإثرائية المنتظمة في مركز مصادر التعلّم والمنزل.',
        targetAudience: 'طلاب المرحلة المتوسطة وأولياء أمورهم',
        executionDateOrPeriod: 'الفصل الدراسي الأول — 2026-10-15 إلى 2026-12-10',
        responsibleMemberIds: [mbrMemberId, mbrFollowupId],
        responsibleNames: 'أ. ياسر بن فهد الدوسري، أ. ماجد بن ناصر القحطاني',
        actualExecutionDescription:
          'تم تجهيز قائمة الكتب والنصوص المختارة في مركز مصادر التعلّم وإرسال دليل الأسرة القرائي، وجارٍ جدولة حصص الاستعارة الموجهة.',
        results:
          'النتائج التنفيذية المباشرة: اعتماد قائمة تضم 30 كتاباً ونصاً إثرائياً وتجهيز بطاقة متابعة قرائية مبسطة للطلاب.',
        status: 'planned',
        partnerEntity: 'مركز مصادر التعلّم بالمدرسة + مجلس أولياء الأمور',
        partnershipType: 'شراكة تربوية ومجتمعية لدعم القراءة الإثرائية',
        evidenceIds: [evd2SurveyId],
        qrCodeToken: 'PLC_DEMO_QR_EXEC_04',
      },
    ],

    // ========================================================================
    // النموذج 7: التقويم ومؤشرات الأداء وقياس الأثر
    // ========================================================================
    evaluation: {
      executionEvaluations: [
        {
          id: eval1Id,
          targetKind: 'plan_action',
          actionOrActivityId: act1Id,
          actionOrActivityTitle:
            'تنفيذ برنامج تدريبي تطبيقي لمعلمي اللغة العربية حول استراتيجيات التدريس التبادلي وتعميق الفهم القرائي',
          executionLevel: 'منفذ وفق الخطة',
          notes: 'نُفذ في موعده المحدد بحضور كامل أعضاء المجتمع.',
          strengths: 'ارتباط التدريب مباشرة بنصوص المقررات الدراسية وإنتاج أدوات جاهزة للتطبيق الصفي.',
          improvements: 'إضافة نماذج مصورة قصيرة لمواقف صفية تطبيقية في الورش القادمة.',
        },
        {
          id: eval2Id,
          targetKind: 'plan_action',
          actionOrActivityId: act2Id,
          actionOrActivityTitle:
            'تصميم وتطبيق حقيبة النصوص التشخيصية القصيرة والاختبارات التكوينية لنواتج الفهم القرائي الاستنتاجي',
          executionLevel: 'منفذ جزئياً',
          notes: 'تم إنجاز 75% من التطبيق الميداني للنصوص المعتمدة.',
          strengths: 'انتظام القياس الأسبوعي وسهولة رصد تقدم الطلاب في كل مهارة.',
          improvements: 'تخصيص حصة علاجية إضافية للطلاب الذين لم يتجاوزوا 60% في النص الخامس.',
        },
        {
          id: eval3Id,
          targetKind: 'plan_action',
          actionOrActivityId: act4Id,
          actionOrActivityTitle:
            'تفعيل مبادرة الشراكة القرائية «القارئ الواعي» بالتعاون مع مركز مصادر التعلّم وأولياء الأمور',
          executionLevel: 'متأخر عن الجدول الزمني',
          notes: 'تأثر الجدول الزمني بفترة الاختبارات الفترية.',
          strengths: 'تجهيز أوعية مصادر التعلّم وتصنيفها حسب مستوى الصعوبة القرائية.',
          improvements: 'اختصار نموذج المتابعة الأسري ليكون إلكترونياً أسبوعياً بدلاً من النموذج الورقي المطول.',
        },
      ],

      // مؤشرات الأداء (KPIs) تغطي الاتجاهات الثلاثة: كلما زادت القيمة كان أفضل، كلما قلت القيمة كان أفضل، الهدف قيمة محددة
      kpiIndicators: [
        {
          id: kpi1Id,
          name: 'متوسط إتقان الطلاب لمهارات الفهم القرائي الاستنتاجي في الاختبارات التكوينية',
          description:
            'يقيس متوسط درجات إتقان طلاب المرحلة المتوسطة في أسئلة استنتاج الفكرة الضمنية والعلاقات المنطقية في النص.',
          linkedGoalId: goal1Id,
          linkedNeedId: need1Id,
          linkedActionId: act2Id,
          linkedActivityId: execActivityId,
          baselineValue: 58,
          targetValue: 80,
          achievedValue: 76,
          unit: 'نسبة مئوية',
          targetUnit: 'نسبة مئوية',
          actualUnit: 'نسبة مئوية',
          indicatorType: 'higher_is_better',
          dataSource: 'سجلات رصد نتائج الاختبار التشخيصي القبلي والاختبارات التكوينية الموحدة',
          measurementPeriod: 'الفصل الدراسي الأول (قياس مرحلي بعد النص التاسع)',
          periodStartDate: '2026-09-05',
          periodEndDate: '2026-11-02',
          measurementDate: '2026-11-03',
          calculationMethod: 'مجموع درجات الطلاب في معايير الفهم الاستنتاجي مقسوماً على الدرجة الكلية × 100',
          notes: 'تحسن ملحوظ بمقدار +18 نقطة مئوية مقارنة بخط الأساس، واقترب من المستهدف (80%).',
        },
        {
          id: kpi2Id,
          name: 'نسبة الطلاب المتعثرين في مهارات القراءة الأساسية وتحديد الفكرة الرئيسة',
          description:
            'يقيس نسبة الطلاب الحاصلين على أقل من 50% في مهارات الفهم القرائي الأساسي (اتجاه المؤشر: كلما قلت القيمة كان أفضل).',
          linkedGoalId: goal3Id,
          linkedNeedId: need1Id,
          linkedActionId: act2Id,
          linkedActivityId: execActivityId,
          baselineValue: 32,
          targetValue: 12,
          achievedValue: 15,
          unit: 'نسبة مئوية',
          targetUnit: 'نسبة مئوية',
          actualUnit: 'نسبة مئوية',
          indicatorType: 'lower_is_better',
          dataSource: 'كشوف الفرز التشخيصي لطلاب التدخل العلاجي في الصفوف الثلاثة',
          measurementPeriod: 'الفصل الدراسي الأول',
          periodStartDate: '2026-09-05',
          periodEndDate: '2026-11-02',
          measurementDate: '2026-11-03',
          calculationMethod: 'عدد الطلاب الحاصلين على أقل من 50% مقسوماً على إجمالي عدد الطلاب × 100',
          notes: 'انخفضت نسبة التعثر من 32% إلى 15% بفضل التدخلات العلاجية المركزة.',
        },
        {
          id: kpi3Id,
          name: 'عدد النصوص التشخيصية المتدرجة المعتمدة في حقيبة الفهم القرائي الفصلية',
          description:
            'يقيس التزام المجتمع ببناء العدد المستهدف المحدد من النصوص التشخيصية المحكّمة (اتجاه المؤشر: الهدف قيمة محددة).',
          linkedGoalId: goal3Id,
          linkedNeedId: need3Id,
          linkedActionId: act2Id,
          linkedActivityId: execProgramId,
          baselineValue: 4,
          targetValue: 12,
          achievedValue: 12,
          unit: 'عدد',
          targetUnit: 'عدد',
          actualUnit: 'عدد',
          indicatorType: 'exact_target',
          dataSource: 'حقيبة الفهم القرائي المعتمدة في مستودع شواهد المجتمع',
          measurementPeriod: 'نهاية الشهر الأول من الخطة التشغيلية',
          periodStartDate: '2026-09-10',
          periodEndDate: '2026-10-05',
          measurementDate: '2026-10-05',
          calculationMethod: 'العدد الفعلي للنصوص المحكّمة والمعتمدة بمفاتيح الإجابة وسلالم التقدير',
          notes: 'تحقق الهدف المحدد بالكامل (12 نصاً متدرجاً بواقع 4 نصوص لكل صف دراسي).',
        },
        {
          id: kpi4Id,
          name: 'نسبة توظيف استراتيجيات التدريس التبادلي في الزيارات الصفية الموثقة',
          description:
            'يقيس مدى التزام معلمي اللغة العربية بتطبيق خطوات التدريس التبادلي وفق بطاقة الملاحظة الصفية.',
          linkedGoalId: goal2Id,
          linkedNeedId: need2Id,
          linkedActionId: act3Id,
          linkedActivityId: execVisitId,
          baselineValue: 40,
          targetValue: 90,
          achievedValue: 90,
          unit: 'نسبة مئوية',
          targetUnit: 'نسبة مئوية',
          actualUnit: 'نسبة مئوية',
          indicatorType: 'higher_is_better',
          dataSource: 'بطاقات الملاحظة الصفية للزيارات التبادلية الأربع',
          measurementPeriod: 'شهر أكتوبر 2026',
          periodStartDate: '2026-10-01',
          periodEndDate: '2026-10-28',
          measurementDate: '2026-10-29',
          calculationMethod: 'متوسط درجات تحقق بنود التدريس التبادلي في بطاقات الملاحظة الصفية',
          notes: 'حقق المؤشر النسبة المستهدفة (90%) مقارنة بخط الأساس (40%).',
        },
        {
          id: `${PLC_DEMO_PREVIEW_ID_PREFIX}kpi_05`,
          name: 'مؤشر التنوع النوعي لأوعية القراءة الإثرائية المختارة في مصادر التعلّم',
          description:
            'مؤشر وصفي نوعي يوثق تنوع المجالات القرائية المختارة لمبادرة القراءة الحرة (اتجاه المؤشر: لا ينطبق عليه حساب نسبة رقمية آلياً).',
          linkedGoalId: goal4Id,
          linkedNeedId: need4Id,
          linkedActionId: act4Id,
          linkedActivityId: execPartnerId,
          baselineValue: null,
          targetValue: null,
          achievedValue: null,
          unit: 'أخرى',
          customUnit: 'تقييم وصفي نوعي',
          indicatorType: 'not_applicable',
          dataSource: 'سجل تصنيف أوعية مركز مصادر التعلّم',
          measurementPeriod: 'الفصل الدراسي الأول',
          periodStartDate: '2026-10-01',
          periodEndDate: '2026-11-01',
          measurementDate: '2026-11-01',
          calculationMethod: 'مراجعة نوعية لتوازن المجالات الأدبية والعلمية والقصصية دون نسبة مئوية آلية',
          notes: 'مؤشر نوعي لا تُحتسب له نسبة إنجاز رقمية آلياً التزاماً بضوابط المؤشرات.',
        },
      ],

      // قياس الأثر: يتضمن سجلات «أثر مثبت» (بيانات قبلية وبعدية كمية) وسجل «نتيجة موصوفة» (رصد نوعي دون أرقام قبلية/بعدية)
      impactMeasurements: [
        {
          id: imp1Id,
          linkedGoalId: goal1Id,
          linkedNeedId: need1Id,
          linkedActionId: act2Id,
          linkedActivityId: execActivityId,
          beneficiaryCategory: 'طلاب المرحلة المتوسطة (120 طالباً في 6 فصول)',
          measurementMethod: 'pre_post_comparison',
          baselineDate: '2026-09-04',
          measurementDate: '2026-11-03',
          measurementTool: 'اختبار الفهم القرائي المعياري (قبلي / بعدي) + كشوف تحليل المهارات',
          baselineValue: 58,
          targetValue: 80,
          actualValue: 76,
          unit: 'نسبة مئوية',
          targetUnit: 'نسبة مئوية',
          actualUnit: 'نسبة مئوية',
          measurementResults:
            'ارتفاع متوسط إتقان مهارات الفهم القرائي الاستنتاجي من 58% في القياس القبلي إلى 76% في القياس البعدي، مع انخفاض نسبة الطلاب غير المتقنين من 32% إلى 15%.',
          observedChangeDescription:
            'تحسن قدرة الطلاب على استخراج الفكرة الضمنية، وتقديم أدلة نصية لتعليل إجاباتهم، والتمييز الدقيق بين الحقيقة والرأي في النصوص المعلوماتية والأدبية.',
          supportingEvidenceIds: [evd3ResultsReportId, evd6ImpactFileId],
          improvementDecision: 'expand',
          improvementOpportunities:
            'التوسع في تطبيق حقيبة النصوص التشخيصية لتشمل نصوصاً علمية ومقارنة في الفصل الدراسي الثاني، مع تخصيص مجموعات مساندة للـ 15% المتبقين.',
          notes: 'أثر مثبت كمياً ببيانات قبلية وبعدية وشواهد موثقة.',
        },
        {
          id: imp2Id,
          linkedGoalId: goal2Id,
          linkedNeedId: need2Id,
          linkedActionId: act3Id,
          linkedActivityId: execVisitId,
          beneficiaryCategory: 'معلمو اللغة العربية بالمرحلة المتوسطة (5 معلمين)',
          measurementMethod: 'classroom_observation',
          baselineDate: '2026-09-08',
          measurementDate: '2026-10-29',
          measurementTool: 'بطاقة الملاحظة الصفية المقننة لمهارات تدريس الفهم القرائي',
          baselineValue: 40,
          targetValue: 90,
          actualValue: 90,
          unit: 'نسبة مئوية',
          targetUnit: 'نسبة مئوية',
          actualUnit: 'نسبة مئوية',
          measurementResults:
            'انتقال ممارسات المعلمين الصفية من القراءة الجهرية التقليدية إلى تطبيق استراتيجيات التدريس التبادلي وتوزع الأدوار القرائية بنسبة التزام بلغت 90% مقابل 40% في الرصد القبلي.',
          observedChangeDescription:
            'تزايد زمن تفاعل الطلاب الفعلي مع النص داخل الحصة، وتوظيف المعلمين لبطاقات سبر الفهم التكويني أثناء القراءة بدلاً من الانتظار لنهاية الدرس.',
          supportingEvidenceIds: [evd5ObservationFormId, evd6ImpactFileId],
          improvementDecision: 'continue',
          improvementOpportunities:
            'الاستمرار في عقد جولتين من الزيارات الصفية التبادلية كل فصل دراسي وتوثيق أفضل الممارسات.',
          notes: 'أثر مهني مثبت ببطاقات ملاحظة قبلية وبعدية.',
        },
        {
          id: imp3Id,
          linkedGoalId: goal4Id,
          linkedNeedId: need4Id,
          linkedActionId: act4Id,
          linkedActivityId: execPartnerId,
          beneficiaryCategory: 'طلاب الصف الأول المتوسط المشاركون في حصص مصادر التعلّم',
          measurementMethod: 'qualitative_indicator',
          measurementDate: '2026-11-01',
          measurementTool: 'سجل الملاحظات النوعية لأمين مصادر التعلّم ومداولات المعلمين',
          baselineValue: null,
          targetValue: null,
          actualValue: null,
          unit: 'أخرى',
          customUnit: 'تقييم وصفي نوعي',
          measurementResults:
            'رصد تحسن نوعي أولي في إقبال طلاب فصلي (1/أ) و(1/ب) على استعارة القصص والكتيبات القصيرة خلال حصص النشاط، دون اكتمال القياس الكمي القبلي والبعدي لجميع الفصول حتى تاريخه.',
          observedChangeDescription:
            'بدء تفاعل الطلاب مع نقاشات الكتب المختارة شفهياً، مع الحاجة لاستكمال تطبيق أداة القياس الكمية بعد انتهاء المرحلة الثانية من المبادرة.',
          supportingEvidenceIds: [evd2SurveyId, evd6ImpactFileId],
          improvementDecision: 'modify',
          improvementOpportunities:
            'تعديل جدول زيارات مركز مصادر التعلّم واستكمال القياس الكمي لمعدل القراءة الحرة في نهاية الفصل.',
          notes: 'يُصنف آلياً كـ «نتيجة موصوفة» لعدم إدخال قراءات رقمية قبلية وبعدية مكتملة بعد.',
        },
      ],
    },

    // ========================================================================
    // النموذج 8: الشواهد والمرفقات (6 شواهد متنوعة، مع إعادة استخدام الشاهد لأكثر من سجل دون تكرار)
    // ========================================================================
    evidenceRepository: [
      {
        id: evd1MinutesId,
        title: 'محضر الاجتماع التأسيسي وخطة توزيع الأدوار والمهام',
        evidenceType: 'document',
        category: 'document',
        description:
          'وثيقة محضر الاجتماع الأول المتضمنة تشكيل المجتمع وتوزيع المسؤوليات واعتماد قائمة الاحتياجات والخطة التشغيلية.',
        evidenceDate: '2026-09-05',
        sourceOrEntity: 'مقرر المجتمع: أ. خالد بن عبدالله السبيعي',
        fileName: 'محضر_الاجتماع_التأسيسي_مجتمع_اللغة_العربية.pdf',
        mimeType: 'image/svg+xml',
        fileDataUrl: buildDemoEvidenceSvgDataUrl(
          'محضر الاجتماع التأسيسي للمجتمع المهني (١)',
          'توزيع الأدوار واعتماد الرؤية والأهداف والخطة التشغيلية الفصلية',
          PLC_SECTION_THEME.primaryHex
        ),
        notes: 'مرتبط بالاجتماع الأول وبالإجراء التدريبي الأول في الخطة التشغيلية دون تكرار.',
        createdAt: '2026-09-05T10:00:00.000Z',
        qrCodeToken: 'PLC_DEMO_QR_EVD_01',
        links: [
          { targetType: 'meeting', targetId: mtg1Id },
          { targetType: 'plan_action', targetId: act1Id },
          { targetType: 'program', targetId: execProgramId },
        ],
      },
      {
        id: evd2SurveyId,
        title: 'نتائج استبانة تشخيص الاحتياجات والميول القرائية للطلاب والمعلمين',
        evidenceType: 'spreadsheet',
        category: 'spreadsheet',
        description:
          'جدول إحصائي يلخص نتائج استبانة الاحتياجات المهنية للمعلمين واستبانة الميول القرائية لطلاب المرحلة المتوسطة.',
        evidenceDate: '2026-09-04',
        sourceOrEntity: 'منسق المجتمع: أ. فيصل بن محمد العتيبي',
        fileName: 'نتائج_استبانة_الاحتياجات_والميول_القرائية.xlsx',
        mimeType: 'image/svg+xml',
        fileDataUrl: buildDemoEvidenceSvgDataUrl(
          'نتائج استبانة الاحتياجات والميول القرائية',
          'تحليل استجابات 5 معلمين و 120 طالباً في المرحلة المتوسطة',
          '#0284C7'
        ),
        notes: 'شاهد مشترك مرتبط بالاحتياجات والاجتماع الأول والشراكة المجتمعية.',
        createdAt: '2026-09-04T11:00:00.000Z',
        qrCodeToken: 'PLC_DEMO_QR_EVD_02',
        links: [
          { targetType: 'need', targetId: need1Id },
          { targetType: 'need', targetId: need4Id },
          { targetType: 'meeting', targetId: mtg1Id },
          { targetType: 'community_partnership', targetId: execPartnerId },
          { targetType: 'impact', targetId: imp3Id },
        ],
      },
      {
        id: evd3ResultsReportId,
        title: 'تقرير تحليل نتائج الاختبار التشخيصي القبلي والقياسات التكوينية للفهم القرائي',
        evidenceType: 'pdf',
        category: 'pdf',
        description:
          'تقرير تحليلي مقارن لدرجات الطلاب في مهارات الفهم القرائي الاستنتاجي وتحديد الفكرة الرئيسة (خط الأساس 58% مقابل المتحقق 76%).',
        evidenceDate: '2026-11-02',
        sourceOrEntity: 'رئيس المجتمع: أ. عبدالرحمن بن صالح المنصور',
        fileName: 'تقرير_تحليل_نتائج_الفهم_القرائي_قبلي_بعدي.pdf',
        mimeType: 'image/svg+xml',
        fileDataUrl: buildDemoEvidenceSvgDataUrl(
          'تقرير تحليل نتائج الفهم القرائي (قبلي / بعدي)',
          'ارتفاع متوسط الإتقان من 58% إلى 76% وانخفاض نسبة المتعثرين من 32% إلى 15%',
          '#059669'
        ),
        notes: 'مرتبط بمؤشرات الأداء وسجل النشاط التطبيقي وسجل قياس الأثر الكمي.',
        createdAt: '2026-11-02T09:30:00.000Z',
        qrCodeToken: 'PLC_DEMO_QR_EVD_03',
        links: [
          { targetType: 'kpi', targetId: kpi1Id },
          { targetType: 'kpi', targetId: kpi2Id },
          { targetType: 'activity', targetId: execActivityId },
          { targetType: 'impact', targetId: imp1Id },
          { targetType: 'meeting', targetId: mtg2Id },
          { targetType: 'meeting', targetId: mtg3Id },
        ],
      },
      {
        id: evd4ActivityPhotoId,
        title: 'صورة توثيقية لورشة العمل التطبيقية في استراتيجيات التدريس التبادلي',
        evidenceType: 'image',
        category: 'image',
        description:
          'توثيق بصري لجانب من ورشة تصميم بطاقات القراءة الموجهة والتدريس التبادلي لمعلمي اللغة العربية.',
        evidenceDate: '2026-09-16',
        sourceOrEntity: 'لجنة التوثيق بمجتمع اللغة العربية',
        fileName: 'صورة_ورشة_التدريس_التبادلي.png',
        mimeType: 'image/svg+xml',
        fileDataUrl: buildDemoEvidenceSvgDataUrl(
          'صورة نشاط: ورشة استراتيجيات التدريس التبادلي',
          'تطبيق عملي لتصميم بطاقات التنبؤ والتساؤل والتوضيح والتلخيص',
          PLC_SECTION_THEME.primaryHex
        ),
        notes: 'مرتبط بالبرنامج التدريبي وإجراء الخطة الأول.',
        createdAt: '2026-09-16T12:00:00.000Z',
        qrCodeToken: 'PLC_DEMO_QR_EVD_04',
        links: [
          { targetType: 'program', targetId: execProgramId },
          { targetType: 'plan_action', targetId: act1Id },
        ],
      },
      {
        id: evd5ObservationFormId,
        title: 'نموذج بطاقة الملاحظة الصفية للزيارات التبادلية في فهم المقروء',
        evidenceType: 'document',
        category: 'document',
        description:
          'بطاقة ملاحظة صفية مقننة توثق مدى تحقق معايير التدريس التبادلي وتفاعل الطلاب خلال الزيارات التبادلية الأربع.',
        evidenceDate: '2026-10-08',
        sourceOrEntity: 'معلمو اللغة العربية المشاركون في الزيارات التبادلية',
        fileName: 'بطاقة_الملاحظة_الصفية_للزيارات_التبادلية.pdf',
        mimeType: 'image/svg+xml',
        fileDataUrl: buildDemoEvidenceSvgDataUrl(
          'نموذج بطاقة الملاحظة الصفية للزيارات التبادلية',
          'نسبة تحقق معايير التدريس التبادلي في الحصص الملاحظة: 90%',
          '#4F46E5'
        ),
        notes: 'مرتبط بالزيارة التبادلية ومؤشر الأداء الرابع وقياس أثر الممارسات التدريسية.',
        createdAt: '2026-10-08T13:15:00.000Z',
        qrCodeToken: 'PLC_DEMO_QR_EVD_05',
        links: [
          { targetType: 'mutual_visit', targetId: execVisitId },
          { targetType: 'kpi', targetId: kpi4Id },
          { targetType: 'impact', targetId: imp2Id },
          { targetType: 'meeting', targetId: mtg2Id },
        ],
      },
      {
        id: evd6ImpactFileId,
        title: 'ملف نتائج قياس الأثر التربوي وقرارات التحسين للفصل القادم',
        evidenceType: 'pdf',
        category: 'pdf',
        description:
          'ملف متكامل يوثق نتائج القياس القبلي والبعدي، والتمييز بين الأثر المثبت والنتائج الموصوفة، وخطة التوسع للفصل الدراسي القادم.',
        evidenceDate: '2026-11-04',
        sourceOrEntity: 'مسؤول المتابعة والقياس: أ. ماجد بن ناصر القحطاني',
        fileName: 'ملف_نتائج_قياس_الأثر_وقرارات_التحسين.pdf',
        mimeType: 'image/svg+xml',
        fileDataUrl: buildDemoEvidenceSvgDataUrl(
          'ملف نتائج قياس الأثر التربوي والمهني',
          'خلاصة الأثر المثبت كمياً والنتائج الموصوفة نوعياً وقرارات التحسين المعتمدة',
          '#0D9488'
        ),
        notes: 'مرتبط بسجلات قياس الأثر الثلاثة والاجتماع الثالث والتقرير الختامي.',
        createdAt: '2026-11-04T14:00:00.000Z',
        qrCodeToken: 'PLC_DEMO_QR_EVD_06',
        links: [
          { targetType: 'impact', targetId: imp1Id },
          { targetType: 'impact', targetId: imp2Id },
          { targetType: 'impact', targetId: imp3Id },
          { targetType: 'meeting', targetId: mtg3Id },
          { targetType: 'final_report', targetId: PLC_DEMO_COMMUNITY_ID },
        ],
      },
    ],

    // ========================================================================
    // النموذج 9: تخصيص التقرير الختامي
    // ========================================================================
    finalReportCustomization: {
      customExecutiveNotes:
        'حقق مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي تكاملاً منهجياً بين التشخيص الدقيق للاحتياجات، والتدريب التطبيقي للمعلمين، والتطبيق الصفي لنماذج التدريس التبادلي وحقيبة النصوص المتدرجة، مما انعكس إيجاباً في رفع متوسط الإتقان وتقليص نسبة التعثر القرائي.',
      customClosingNotes:
        'يوصي أعضاء المجتمع بالاستمرار في تطبيق حقيبة النصوص التشخيصية في الفصل الدراسي الثاني، وإضافة نصوص معلوماتية وعلمية مقننة، وإعادة جدولة المرحلة الثانية من مبادرة الشراكة القرائية مع الأسرة ومصادر التعلّم بصورة مبسطة.',
      lastGeneratedAt: '2026-11-05T10:30:00.000Z',
    },
  };
}
