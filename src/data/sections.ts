import { SectionId, SectionTheme } from '../types';

export const SECTIONS: Record<SectionId, SectionTheme> = {
  'professional-development': {
    id: 'professional-development',
    title: 'التطوير المهني',
    shortDescription:
      'توثيق البرامج والدورات التدريبية وورش العمل، والتقرير الختامي لتدريب الفصل الدراسي، وإصدار شهادات المدربين والمتدربين.',
    detailedDescription:
      'مساحة مخصصة لتنظيم وتوثيق خطط التدريب المدرسي، اللقاءات التربوية، وبرامج رفع الكفاءة المهنية في المدرسة.',
    futureFormsMessage:
      'النماذج المعتمدة لقسم التطوير المهني ستضاف في المرحلة القادمة بإذن الله، وسترتبط تلقائياً ببيانات المدرسة والصفة الوظيفية المحددة لهذا القسم في الإعدادات المركزية.',
    roleKey: 'professionalDevelopment',
    colorName: 'عنابي',
    primaryHex: '#7C1D34',
    badgeTextClass: 'text-[#7C1D34]',
    accentBgClass: 'bg-[#7C1D34]',
    accentSoftBgClass: 'bg-[#FAF1F3]',
    accentBorderClass: 'border-[#E6C7CF]',
    accentHoverBorderClass: 'hover:border-[#7C1D34]',
    accentTextClass: 'text-[#7C1D34]',
    buttonBgClass: 'bg-[#7C1D34] hover:bg-[#631629] text-white',
    iconBgClass: 'bg-[#7C1D34] text-white',
  },
  gifted: {
    id: 'gifted',
    title: 'الموهوبين',
    shortDescription:
      'سجل منسق الموهوبين: إدارة وتوثيق الخطة التنفيذية، البرامج الوزارية، المبادرات، المسابقات العلمية، ومتابعة الطلبة الموهوبين وإنجازاتهم.',
    detailedDescription:
      'مساحة مخصصة لإدارة وتوثيق أعمال منسق الموهوبين بالمدرسة، بدءاً من الخطة التنفيذية والبرامج الوزارية والمبادرات، ومروراً بسجل التنفيذ والطلاب والشواهد، وانتهاءً بالتقارير الإدارية المختصرة.',
    futureFormsMessage:
      'سجل منسق الموهوبين مرتبط تلقائياً ببيانات المدرسة والصفة الوظيفية المحددة لهذا القسم في الإعدادات المركزية.',
    roleKey: 'gifted',
    colorName: 'عنابي وفحمي',
    primaryHex: '#7F1D3F',
    badgeTextClass: 'text-[#26323B]',
    accentBgClass: 'bg-[#26323B]',
    accentSoftBgClass: 'bg-[#F9EFF2]',
    accentBorderClass: 'border-[#E6C7D0]',
    accentHoverBorderClass: 'hover:border-[#26323B]',
    accentTextClass: 'text-[#7F1D3F]',
    buttonBgClass:
      'bg-gradient-to-l from-[#26323B] via-[#312332] to-[#7F1D3F] hover:from-[#1C262D] hover:to-[#641631] text-white',
    iconBgClass:
      'bg-gradient-to-br from-[#26323B] to-[#7F1D3F] text-white ring-2 ring-[#E6C7D0]',
  },
  teacher: {
    id: 'teacher',
    title: 'المعلم',
    shortDescription:
      'توثيق المهام التدريسية، الخطط الفصلية، الشواهد التعليمية، وأعمال التقويم والمتابعة الصفية.',
    detailedDescription:
      'مساحة مخصصة لتنظيم وتوثيق الأداء التدريسي، تنفيذ الحصص، المبادرات الصفية، وتقارير الإنجاز الدورية.',
    futureFormsMessage:
      'النماذج المعتمدة لقسم المعلم ستضاف في المرحلة القادمة بإذن الله، وسترتبط تلقائياً ببيانات المدرسة والصفة الوظيفية المحددة لهذا القسم في الإعدادات المركزية.',
    roleKey: 'teacher',
    colorName: 'أزرق',
    primaryHex: '#1E4D8C',
    badgeTextClass: 'text-[#1E4D8C]',
    accentBgClass: 'bg-[#1E4D8C]',
    accentSoftBgClass: 'bg-[#F0F5FA]',
    accentBorderClass: 'border-[#C5D7EE]',
    accentHoverBorderClass: 'hover:border-[#1E4D8C]',
    accentTextClass: 'text-[#1E4D8C]',
    buttonBgClass: 'bg-[#1E4D8C] hover:bg-[#163B6B] text-white',
    iconBgClass: 'bg-[#1E4D8C] text-white',
  },
};

export const SECTIONS_LIST: SectionTheme[] = [
  SECTIONS['professional-development'],
  SECTIONS['gifted'],
  SECTIONS['teacher'],
];

export const PLC_SECTION_THEME = {
  id: 'plc' as const,
  title: 'مجتمعات التعلّم المهنية',
  colorName: 'تركوازي',
  primaryHex: '#0F766E',
  hoverHex: '#115E59',
  softBgHex: '#F0FDFA',
  softHoverBgHex: '#CCFBF1',
  borderHex: '#99F6E4',
  badgeTextClass: 'text-plc',
  accentBgClass: 'bg-plc',
  accentSoftBgClass: 'bg-plc-soft',
  accentBorderClass: 'border-plc-border',
  accentHoverBorderClass: 'hover:border-plc',
  accentTextClass: 'text-plc',
  buttonBgClass: 'bg-plc hover:bg-plc-hover text-white',
  iconBgClass: 'bg-plc text-white',
};

