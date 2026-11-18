import { FormDefinition } from '../types/forms';
import {
  PD_EXECUTION_DOMAINS_WITH_OTHER,
  PD_SEMESTER_OPTIONS,
  PD_SUGGESTED_OBJECTIVES,
  PD_SUGGESTED_OUTPUTS,
  PD_SUGGESTED_RECOMMENDATIONS,
  PD_SUGGESTED_TOPICS,
  PD_TARGET_GROUPS,
  PD_TRAINING_METHODS,
} from './professionalDevelopmentOptions';

/**
 * 1. نموذج تقرير تنفيذ دورة تدريبية
 */
export const PD_TRAINING_EXECUTION_FORM: FormDefinition = {
  id: 'pd-training-execution-report',
  sectionId: 'professional-development',
  title: 'تقرير تنفيذ دورة تدريبية',
  description:
    'توثيق شامل لتنفيذ برنامج تدريبي أو ورشة عمل، يشمل بيانات البرنامج، التاريخ الميلادي والهجري (تقويم أم القرى)، ملخص المحتوى، الأهداف، المحاور، أساليب التدريب، المخرجات، التوصيات، وبيانات المنفذ، مع إمكانية حفظ الدورة في السجل المحلي للتقرير الختامي.',
  reportTitle: 'تقرير تنفيذ دورة تدريبية',
  orientation: 'portrait',
  templateLayout: 'standard-report',
  footerMode: 'executor',
  enableCourseSaveToLocalRegistry: true,
  supportedExports: ['pdf'],
  fields: [
    // أولاً: بيانات البرنامج
    {
      id: 'programTitle',
      label: 'اسم البرنامج التدريبي',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم البرنامج التدريبي أو الدورة...',
      sectionTitle: 'بيانات البرنامج',
      sectionDescription: 'المعلومات الأساسية للبرنامج التدريبي وتاريخ ومكان التنفيذ والفصل الدراسي.',
      width: 'half',
    },
    {
      id: 'executionDomain',
      label: 'المجال',
      type: 'select',
      required: true,
      options: PD_EXECUTION_DOMAINS_WITH_OTHER,
      width: 'half',
    },
    {
      id: 'customExecutionDomain',
      label: 'اسم المجال (أخرى)',
      type: 'text',
      required: true,
      placeholder: 'اكتب اسم المجال التدريبي...',
      hideInReportBody: true,
      visibleWhen: {
        fieldId: 'executionDomain',
        equals: 'أخرى',
      },
      width: 'full',
    },
    {
      id: 'semesterName',
      label: 'الفصل الدراسي',
      type: 'select',
      required: false,
      options: PD_SEMESTER_OPTIONS,
      width: 'half',
    },
    {
      id: 'academicYearInput',
      label: 'العام الدراسي',
      type: 'text',
      required: false,
      placeholder: 'مثال: 1447 - 1448 هـ',
      width: 'half',
    },
    {
      id: 'executionLocation',
      label: 'مكان التنفيذ',
      type: 'text',
      required: false,
      placeholder: 'اكتب مكان التنفيذ (مثال: قاعة التدريب بالمدرسة / عن بُعد)...',
      width: 'half',
    },
    {
      id: 'beneficiariesCount',
      label: 'عدد المستفيدين',
      type: 'number',
      required: false,
      placeholder: 'مثال: 20',
      width: 'half',
    },
    {
      id: 'executionDate',
      label: 'تاريخ التنفيذ الميلادي',
      type: 'date',
      required: false,
      width: 'half',
    },
    {
      id: 'executionHijriDate',
      label: 'التاريخ الهجري المقابل (تقويم أم القرى)',
      type: 'text',
      required: false,
      autoHijriFromFieldId: 'executionDate',
      placeholder: 'يُحسب تلقائياً من التاريخ الميلادي ويمكنك تعديله يدوياً...',
      helpText: 'يتم تحويل التاريخ الميلادي تلقائياً وفق تقويم أم القرى مع إمكانية التعديل اليدوي عند الحاجة.',
      width: 'half',
    },
    {
      id: 'targetGroups',
      label: 'الفئات المستهدفة',
      type: 'multi-select',
      required: false,
      options: PD_TARGET_GROUPS,
      allowCustomOption: true,
      customOptionPlaceholder: 'أضف فئة مستهدفة مخصصة...',
      customOptionButtonLabel: 'إضافة فئة مخصصة',
      width: 'full',
    },

    // ثانياً: محتوى البرنامج
    {
      id: 'summaryDescription',
      label: 'ملخص محتوى البرنامج التدريبي',
      type: 'textarea',
      required: false,
      placeholder: 'اكتب وصفاً تفصيلياً لمحتوى الدورة التدريبية وما تم تناوله خلالها...',
      sectionTitle: 'محتوى البرنامج',
      width: 'full',
    },

    // ثالثاً: أهداف البرنامج
    {
      id: 'objectivesList',
      label: 'أهداف البرنامج',
      type: 'repeatable',
      required: false,
      minRows: 1,
      maxRows: 4,
      repeatableItemLabel: 'هدف',
      addRowLabel: 'إضافة هدف',
      placeholder: 'اكتب الهدف التدريبي أو اختر من الأهداف المقترحة...',
      helpText: 'الحد الأقصى 4 أهداف. يمكنك الاختيار من الأهداف المقترحة أو كتابة هدف مخصص في كل خانة.',
      suggestedOptions: PD_SUGGESTED_OBJECTIVES,
      sectionTitle: 'أهداف البرنامج',
      width: 'full',
    },

    // رابعاً: محاور البرنامج التدريبي
    {
      id: 'topicsList',
      label: 'محاور البرنامج التدريبي',
      type: 'repeatable',
      required: false,
      minRows: 1,
      maxRows: 4,
      repeatableItemLabel: 'محور',
      addRowLabel: 'إضافة محور',
      placeholder: 'اكتب محور البرنامج أو اختر من المحاور الجاهزة...',
      helpText: 'الحد الأقصى 4 محاور. اختر من المحاور الجاهزة أو اكتب محوراً مخصصاً في كل خانة.',
      suggestedOptions: PD_SUGGESTED_TOPICS,
      sectionTitle: 'محاور البرنامج التدريبي',
      width: 'full',
    },

    // خامساً: أساليب التدريب
    {
      id: 'trainingMethods',
      label: 'أساليب التدريب',
      type: 'multi-select',
      required: false,
      options: PD_TRAINING_METHODS,
      allowCustomOption: true,
      customOptionPlaceholder: 'اكتب أسلوب تدريب مخصص...',
      customOptionButtonLabel: 'إضافة أسلوب مخصص',
      helpText: 'يمكنك اختيار أكثر من أسلوب تدريبي، كما يمكنك إضافة أسلوب مخصص.',
      sectionTitle: 'أساليب التدريب',
      width: 'full',
    },

    // سادساً: مخرجات البرنامج
    {
      id: 'outputsList',
      label: 'مخرجات البرنامج',
      type: 'repeatable',
      required: false,
      minRows: 1,
      maxRows: 4,
      repeatableItemLabel: 'مخرج',
      addRowLabel: 'إضافة مخرج',
      placeholder: 'اكتب مخرج البرنامج أو اختر من المخرجات المقترحة وعدّلها...',
      helpText: 'الحد الأقصى 4 مخرجات. يمكنك اختيار مخرج مقترح وتعديله أو كتابة مخرج مخصص.',
      suggestedOptions: PD_SUGGESTED_OUTPUTS,
      sectionTitle: 'مخرجات البرنامج',
      width: 'full',
    },

    // سابعاً: التوصيات
    {
      id: 'recommendationsList',
      label: 'التوصيات',
      type: 'repeatable',
      required: false,
      minRows: 1,
      maxRows: 4,
      repeatableItemLabel: 'توصية',
      addRowLabel: 'إضافة توصية',
      placeholder: 'اكتب التوصية أو اختر من التوصيات الجاهزة...',
      helpText: 'الحد الأقصى 4 توصيات. يمكنك الاختيار من التوصيات الجاهزة أو كتابة توصية مخصصة.',
      suggestedOptions: PD_SUGGESTED_RECOMMENDATIONS,
      sectionTitle: 'التوصيات',
      width: 'full',
    },

    // ثامناً: الشواهد المصورة (اختياري)
    {
      id: 'evidencePhotos',
      label: 'الشواهد المصورة (اختياري)',
      type: 'images',
      required: false,
      maxImages: 4,
      sectionTitle: 'الشواهد والمرفقات المصورة',
      width: 'full',
    },

    // تاسعاً: بيانات منفذ البرنامج (في تقرير تنفيذ الدورة فقط، مستقلة عن معد التقرير والمنسق والمدير)
    {
      id: 'executorName',
      label: 'اسم منفذ البرنامج',
      type: 'text',
      required: false,
      placeholder: 'أدخل اسم منفذ البرنامج رباعياً أو ثلاثياً...',
      sectionTitle: 'بيانات منفذ البرنامج',
      sectionDescription:
        'بيانات منفذ الدورة مستقلة عن بيانات معد التقرير والمنسق ومدير المدرسة، وتظهر في التقرير دون إضافة اعتماد أو ختم.',
      hideInReportBody: true,
      width: 'half',
    },
    {
      id: 'executorNationalId',
      label: 'رقم السجل المدني',
      type: 'text',
      required: false,
      placeholder: 'أدخل رقم السجل المدني...',
      privacyWarning: 'تنبيه: لن يتم حفظ بيانات السجل المدني في الموقع',
      hideInReportBody: true,
      width: 'half',
    },
    {
      id: 'executorSignature',
      label: 'التوقيع (اختياري)',
      type: 'signature',
      required: false,
      helpText:
        'يمكنك رفع صورة التوقيع لإدراجها في التقرير، أو ترك الحقل فارغاً ليظهر مكان مخصص للتوقيع يمكنك التوقيع عليه من الجوال بعد تصدير ملف PDF.',
      hideInReportBody: true,
      width: 'full',
    },
  ],
};

/**
 * 2. التقرير الختامي لبرامج التدريب خلال الفصل الدراسي
 */
export const PD_SEMESTER_FINAL_REPORT_FORM: FormDefinition = {
  id: 'pd-semester-final-report',
  sectionId: 'professional-development',
  title: 'التقرير الختامي لبرامج التدريب خلال الفصل الدراسي',
  description:
    'توثيق شامل لكافة البرامج والدورات التدريبية المنفذة خلال الفصل الدراسي (الأول أو الثاني)، مع استدعاء تلقائي للدورات المحفوظة محلياً وإمكانية اختيارها أو تعديلها أو إضافة برامج جديدة وعرضها في جدول منظم.',
  reportTitle: 'التقرير الختامي لبرامج التطوير المهني والتدريب خلال الفصل الدراسي',
  orientation: 'portrait',
  templateLayout: 'semester-final-report',
  footerMode: 'default',
  enableCourseRecallFromLocalRegistry: true,
  supportedExports: ['pdf'],
  fields: [
    {
      id: 'semesterName',
      label: 'الفصل الدراسي',
      type: 'select',
      required: false,
      options: PD_SEMESTER_OPTIONS,
      sectionTitle: 'بيانات الفصل الدراسي والعام الدراسي',
      hideInReportBody: true,
      width: 'half',
    },
    {
      id: 'academicYearInput',
      label: 'العام الدراسي',
      type: 'text',
      required: false,
      placeholder: 'مثال: 1447 - 1448 هـ',
      helpText: 'العام الدراسي حقل مستقل يُستخدم لفرز واستدعاء الدورات الخاصة بهذا العام.',
      hideInReportBody: true,
      width: 'half',
    },
    {
      id: 'overallSummary',
      label: 'ملخص إجمالي للبرامج المنفذة',
      type: 'textarea',
      required: false,
      placeholder:
        'اكتب ملخصاً عاماً يوضح جهود التطوير المهني خلال الفصل الدراسي وأثر البرامج المنفذة على الأداء المدرسي...',
      sectionTitle: 'الملخص الإجمالي للبرامج المنفذة',
      width: 'full',
    },
    {
      id: 'executedPrograms',
      label: 'تفاصيل البرامج التدريبية المنفذة',
      type: 'table',
      required: true,
      minRows: 1,
      displayAsCardsInForm: true,
      cardItemLabel: 'برنامج تدريبي',
      addRowLabel: 'إضافة برنامج تدريبي جديد',
      helpText:
        'يمكنك اختيار الدورات المحفوظة أعلاه لتضمينها تلقائياً، أو إضافة وحذف البرامج يدوياً حسب الحاجة دون حد ثابت.',
      sectionTitle: 'جدول البرامج التدريبية المضمنة في التقرير الختامي',
      columns: [
        {
          key: 'programName',
          label: 'اسم البرنامج',
          type: 'text',
          required: true,
          placeholder: 'اسم الدورة أو البرنامج التدريبي...',
        },
        {
          key: 'domain',
          label: 'المجال',
          type: 'text',
          required: false,
          placeholder: 'تطوير الأداء / برامج إثرائية / ...',
        },
        {
          key: 'executionDate',
          label: 'تاريخ التنفيذ',
          type: 'date',
          required: false,
        },
        {
          key: 'location',
          label: 'مكان التنفيذ',
          type: 'text',
          required: false,
          placeholder: 'قاعة التدريب / المدرسة / عن بُعد...',
        },
        {
          key: 'beneficiariesCount',
          label: 'عدد المستفيدين',
          type: 'number',
          required: false,
          placeholder: 'مثال: 18',
        },
        {
          key: 'keyOutputs',
          label: 'أبرز المخرجات',
          type: 'text',
          required: false,
          placeholder: 'أهم مخرجات البرنامج التدريبي...',
        },
      ],
      width: 'full',
    },
    {
      id: 'evidencePhotos',
      label: 'شواهد مختارة من برامج الفصل الدراسي (اختياري)',
      type: 'images',
      required: false,
      maxImages: 4,
      sectionTitle: 'الشواهد المصورة (اختياري)',
      width: 'full',
    },
  ],
};

/**
 * 3. نموذج شهادة مدرب (مطابق للنموذج الرسمي المعتمد من إدارة التعليم - قسم التطوير المهني)
 */
export const PD_TRAINER_CERTIFICATE_FORM: FormDefinition = {
  id: 'pd-trainer-certificate',
  sectionId: 'professional-development',
  title: 'شهادة مدرب',
  description:
    'قالب الشهادة الرسمي المعتمد لتنفيذ برنامج تدريبي ضمن مشروع توطين التطوير المهني بالمدارس، يصدر بصيغة PDF فعلية بمقاس A4 أفقي مع دعم صيغتي المذكر والمؤنث.',
  reportTitle: 'شهادة مدرب',
  orientation: 'landscape',
  templateLayout: 'certificate-trainer',
  footerMode: 'none',
  supportedExports: ['pdf'],
  fields: [
    {
      id: 'schoolNameInput',
      label: 'اسم المدرسة',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم المدرسة...',
      sectionTitle: 'بيانات شهادة المدرب الرسمية',
      sectionDescription:
        'تُستدعى بيانات المدرسة ومدير/مديرة المدرسة تلقائياً من الإعدادات المركزية مع إمكانية تعديلها، وتُضبط الصياغة (مذكر / مؤنث) تلقائياً حسب اختيارك في الإعدادات.',
      width: 'half',
    },
    {
      id: 'beneficiaryName',
      label: 'اسم المدرب / المدربة',
      type: 'text',
      required: true,
      placeholder: 'أدخل الاسم الثلاثي أو الرباعي...',
      width: 'half',
    },
    {
      id: 'nationalId',
      label: 'رقم الهوية',
      type: 'text',
      required: true,
      placeholder: 'أدخل رقم الهوية الوطنية...',
      privacyWarning: 'تنبيه: لن يتم حفظ بيانات السجل المدني في الموقع',
      width: 'half',
    },
    {
      id: 'programTitle',
      label: 'اسم البرنامج التدريبي',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم البرنامج التدريبي المنفذ...',
      width: 'half',
    },
    {
      id: 'daysCount',
      label: 'عدد الأيام',
      type: 'number',
      required: true,
      placeholder: 'مثال: 3',
      width: 'half',
    },
    {
      id: 'hoursCount',
      label: 'عدد الساعات',
      type: 'number',
      required: true,
      placeholder: 'مثال: 15',
      width: 'half',
    },
    {
      id: 'startDate',
      label: 'تاريخ بداية البرنامج',
      type: 'text',
      required: true,
      placeholder: 'مثال: ١٤٤٧/٠٤/١٥ هـ',
      width: 'half',
    },
    {
      id: 'endDate',
      label: 'تاريخ نهاية البرنامج',
      type: 'text',
      required: true,
      placeholder: 'مثال: ١٤٤٧/٠٤/١٧ هـ',
      width: 'half',
    },
    {
      id: 'principalNameInput',
      label: 'اسم مدير / مديرة المدرسة',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم مدير أو مديرة المدرسة...',
      width: 'full',
    },
  ],
};

/**
 * 4. نموذج شهادة متدرب (مطابق للنموذج الرسمي المعتمد، يدعم إصدار شهادة PDF فردية أو شهادات PDF جماعية داخل ملف ZIP)
 */
export const PD_TRAINEE_CERTIFICATE_FORM: FormDefinition = {
  id: 'pd-trainee-certificate',
  sectionId: 'professional-development',
  title: 'شهادة متدرب',
  description:
    'قالب الشهادة الرسمي المعتمد لحضور برنامج تدريبي ضمن مشروع توطين التطوير المهني بالمدارس، يدعم إصدار شهادة PDF فردية أو شهادات PDF مستقلة لمجموعة متدربين وتنزيلها دفعة واحدة داخل ملف ZIP.',
  reportTitle: 'شهادة متدرب',
  orientation: 'landscape',
  templateLayout: 'certificate-trainee',
  footerMode: 'none',
  enableBatchCertificateGeneration: true,
  supportedExports: ['pdf'],
  fields: [
    {
      id: 'schoolNameInput',
      label: 'اسم المدرسة',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم المدرسة...',
      sectionTitle: 'بيانات شهادة المتدرب الرسمية',
      sectionDescription:
        'تُستدعى بيانات المدرسة ومدير/مديرة المدرسة تلقائياً من الإعدادات المركزية، ويمكنك إدخال اسم متدرب واحد أو لصق قائمة أسماء لإصدار ملف PDF مستقل لكل متدرب.',
      width: 'half',
    },
    {
      id: 'programTitle',
      label: 'اسم البرنامج التدريبي',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم البرنامج التدريبي...',
      width: 'half',
    },
    {
      id: 'beneficiaryName',
      label: 'أسماء المتدربين (كل اسم في سطر مستقل)',
      type: 'textarea',
      required: true,
      enableLineCountBadge: true,
      enableClipboardPasteButton: true,
      placeholder:
        'اكتب اسم المتدرب أو الصق قائمة أسماء المتدربين هنا (كل اسم في سطر مستقل)...\nمثال:\nمحمد بن عبدالله السالم\nخالد بن عبدالرحمن العتيبي\nأو مع رقم الهوية: محمد بن عبدالله السالم - 1023456789',
      helpText:
        'يقبل النموذج اسماً واحداً أو 10 أو 20 اسماً أو أكثر. ضع كل اسم في سطر مستقل (ويمكنك كتابة رقم الهوية بجانب الاسم مفصولاً بشرطة أو إدخاله في خانة رقم الهوية).',
      width: 'full',
    },
    {
      id: 'nationalId',
      label: 'رقم الهوية (أو أرقام الهوية سطراً بسطر)',
      type: 'textarea',
      required: false,
      placeholder:
        'أدخل رقم الهوية للمتدرب (أو قائمة أرقام الهوية كل رقم في سطر مقابل اسم المتدرب)...',
      privacyWarning: 'تنبيه: لن يتم حفظ بيانات السجل المدني في الموقع',
      width: 'full',
    },
    {
      id: 'daysCount',
      label: 'عدد الأيام',
      type: 'number',
      required: true,
      placeholder: 'مثال: 3',
      width: 'half',
    },
    {
      id: 'hoursCount',
      label: 'عدد الساعات',
      type: 'number',
      required: true,
      placeholder: 'مثال: 15',
      width: 'half',
    },
    {
      id: 'startDate',
      label: 'تاريخ بداية البرنامج',
      type: 'text',
      required: true,
      placeholder: 'مثال: ١٤٤٧/٠٤/١٥ هـ',
      width: 'half',
    },
    {
      id: 'endDate',
      label: 'تاريخ نهاية البرنامج',
      type: 'text',
      required: true,
      placeholder: 'مثال: ١٤٤٧/٠٤/١٧ هـ',
      width: 'half',
    },
    {
      id: 'principalNameInput',
      label: 'اسم مدير / مديرة المدرسة',
      type: 'text',
      required: true,
      placeholder: 'أدخل اسم مدير أو مديرة المدرسة...',
      width: 'full',
    },
  ],
};

export const PROFESSIONAL_DEVELOPMENT_FORMS: FormDefinition[] = [
  PD_TRAINING_EXECUTION_FORM,
  PD_SEMESTER_FINAL_REPORT_FORM,
  PD_TRAINER_CERTIFICATE_FORM,
  PD_TRAINEE_CERTIFICATE_FORM,
];
