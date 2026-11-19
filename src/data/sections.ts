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
    colorName: 'أخضر هادئ',
    primaryHex: '#477B59',
    badgeTextClass: 'text-[#386347]',
    accentBgClass: 'bg-[#477B59]',
    accentSoftBgClass: 'bg-[#E1EFE5]',
    accentBorderClass: 'border-[#BBD8C4]',
    accentHoverBorderClass: 'hover:border-[#477B59]',
    accentTextClass: 'text-[#477B59]',
    buttonBgClass: 'bg-[#376B70] hover:bg-[#315E62] text-white',
    iconBgClass: 'bg-[#E1EFE5] text-[#477B59] border border-[#BBD8C4]',
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
    colorName: 'عنبر رملي هادئ',
    primaryHex: '#956C2E',
    badgeTextClass: 'text-[#785522]',
    accentBgClass: 'bg-[#956C2E]',
    accentSoftBgClass: 'bg-[#F7EBD5]',
    accentBorderClass: 'border-[#E5CFA7]',
    accentHoverBorderClass: 'hover:border-[#956C2E]',
    accentTextClass: 'text-[#956C2E]',
    buttonBgClass: 'bg-[#376B70] hover:bg-[#315E62] text-white',
    iconBgClass: 'bg-[#F7EBD5] text-[#956C2E] border border-[#E5CFA7]',
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
    colorName: 'أزرق سماوي هادئ',
    primaryHex: '#416B91',
    badgeTextClass: 'text-[#335675]',
    accentBgClass: 'bg-[#416B91]',
    accentSoftBgClass: 'bg-[#DCEAF5]',
    accentBorderClass: 'border-[#B8D2E8]',
    accentHoverBorderClass: 'hover:border-[#416B91]',
    accentTextClass: 'text-[#416B91]',
    buttonBgClass: 'bg-[#376B70] hover:bg-[#315E62] text-white',
    iconBgClass: 'bg-[#DCEAF5] text-[#416B91] border border-[#B8D2E8]',
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
  colorName: 'رمادي مريمي هادئ',
  primaryHex: '#60776B',
  hoverHex: '#495D53',
  softBgHex: '#E5E9E7',
  softHoverBgHex: '#D6DFDA',
  borderHex: '#C5D0CA',
  badgeTextClass: 'text-[#495D53]',
  accentBgClass: 'bg-[#60776B]',
  accentSoftBgClass: 'bg-[#E5E9E7]',
  accentBorderClass: 'border-[#C5D0CA]',
  accentHoverBorderClass: 'hover:border-[#60776B]',
  accentTextClass: 'text-[#60776B]',
  buttonBgClass: 'bg-[#376B70] hover:bg-[#315E62] text-white',
  iconBgClass: 'bg-[#E5E9E7] text-[#60776B] border border-[#C5D0CA]',
};

export const CERTIFICATES_SECTION_THEME = {
  id: 'certificates' as const,
  title: 'الشهادات والتقارير',
  primaryHex: '#376B70',
  hoverHex: '#315E62',
  softBgHex: '#EAF2F1',
  borderHex: '#C4D8D6',
};

export const SETTINGS_SECTION_THEME = {
  id: 'settings' as const,
  title: 'الإعدادات',
  primaryHex: '#65727A',
  hoverHex: '#4E5A61',
  softBgHex: '#EEF0F3',
  borderHex: '#D2D8DE',
};
