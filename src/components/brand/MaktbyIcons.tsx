import React from 'react';
import { PageId } from '../../types';

export interface LineIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

/** الرئيسية: منزل خطي هادئ */
export const HomeLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M3.5 10.5L12 3.5L20.5 10.5" />
    <path d="M5.5 9.5V19.5C5.5 20.05 5.95 20.5 6.5 20.5H17.5C18.05 20.5 18.5 20.05 18.5 19.5V9.5" />
    <path d="M9.5 20.5V14.5C9.5 13.95 9.95 13.5 10.5 13.5H13.5C14.05 13.5 14.5 13.95 14.5 14.5V20.5" />
  </svg>
);

/** الأداء الوظيفي / المعلم: شخص مع نجمة صغيرة */
export const PerformanceLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <circle cx="10" cy="7.5" r="3.5" />
    <path d="M3.5 19.5C3.5 16.2 6.4 13.8 10 13.8C11.4 13.8 12.7 14.2 13.8 14.8" />
    <path d="M17.5 12.2L18.6 14.5L21 14.8L19.2 16.5L19.6 19L17.5 17.8L15.4 19L15.8 16.5L14 14.8L16.4 14.5L17.5 12.2Z" />
  </svg>
);

/** الشواهد: مستند مع علامة اعتماد */
export const EvidenceLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M14 3.5H6.5C5.4 3.5 4.5 4.4 4.5 5.5V18.5C4.5 19.6 5.4 20.5 6.5 20.5H12.5" />
    <path d="M14 3.5L18.5 8V10.5" />
    <path d="M8 9.5H13.5" />
    <path d="M8 13H11.5" />
    <circle cx="16.8" cy="15.8" r="3.2" />
    <path d="M15.4 15.8L16.4 16.8L18.3 14.9" />
    <path d="M15.2 18.7L14.5 21.5L16.8 20.3L19.1 21.5L18.4 18.7" />
  </svg>
);

/** التقارير: ورقة تقرير */
export const ReportsLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M14 3.5H6.5C5.4 3.5 4.5 4.4 4.5 5.5V18.5C4.5 19.6 5.4 20.5 6.5 20.5H17.5C18.6 20.5 19.5 19.6 19.5 18.5V9L14 3.5Z" />
    <path d="M14 3.5V9H19.5" />
    <path d="M8.5 13H15.5" />
    <path d="M8.5 16.5H13" />
    <path d="M8.5 9.5H11" />
  </svg>
);

/** التحضير والدروس: كتاب مفتوح */
export const LessonsLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M12 6.5C10.2 5.2 7.4 4.8 4 5.5V18.5C7.4 17.8 10.2 18.2 12 19.5" />
    <path d="M12 6.5C13.8 5.2 16.6 4.8 20 5.5V18.5C16.6 17.8 13.8 18.2 12 19.5V6.5Z" />
    <path d="M6.8 9.5H9.5" />
    <path d="M6.8 13H9.5" />
    <path d="M14.5 9.5H17.2" />
    <path d="M14.5 13H17.2" />
  </svg>
);

/** الزيارات الصفية: تقويم/قائمة زيارة */
export const ClassroomVisitLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <rect x="4" y="5" width="16" height="15.5" rx="2.5" />
    <path d="M8 3.2V6.5" />
    <path d="M16 3.2V6.5" />
    <path d="M4 9.8H20" />
    <path d="M8.5 13.8L10 15.2L12.6 12.6" />
    <path d="M14.8 14H16.8" />
    <path d="M8.5 17.3H16.5" />
  </svg>
);

/** التطوير المهني: محطات التطور (مسار متدرج يمر بمراحل متتابعة ويبلغ علامة مرحلة متقدمة) */
export const ProfessionalDevLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    {/* المسار الصاعد بين محطات النمو المهني */}
    <path d="M6 18L9.6 14.4" />
    <path d="M12.8 11.2L15.4 8.6" />
    {/* المحطة الأولى */}
    <circle cx="4.5" cy="19.5" r="2" />
    {/* المحطة الثانية */}
    <circle cx="11.2" cy="12.8" r="2.1" />
    {/* تفصيلة بلوغ المرحلة المتقدمة (نجمة/معين هندسي متوازن) */}
    <path d="M18 3.2L19.15 5.85L21.8 7L19.15 8.15L18 10.8L16.85 8.15L14.2 7L16.85 5.85L18 3.2Z" />
    {/* خطا التدرج السفلي لبناء المهارات وصقل القدرات */}
    <path d="M11 19.5H19.5" />
    <path d="M14.5 16H19.5" />
  </svg>
);

/** الخطط: تقويم أو مخطط منظم */
export const PlansLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <rect x="4" y="5" width="16" height="15.5" rx="2.5" />
    <path d="M8.5 3.2V6.5" />
    <path d="M15.5 3.2V6.5" />
    <path d="M4 9.8H20" />
    <circle cx="8.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="17" r="0.8" fill="currentColor" stroke="none" />
    <path d="M11.5 17H16" />
  </svg>
);

/** النتائج والمتابعة: رسم بياني صاعد */
export const ResultsLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M4.5 19.5H19.5" />
    <path d="M7 19.5V14.5" />
    <path d="M12 19.5V11.5" />
    <path d="M17 19.5V8.5" />
    <path d="M5.5 11.5L10.5 7.5L13.5 9.5L18.5 5" />
    <path d="M15.5 5H18.5V8" />
  </svg>
);

/** النماذج: مستند رسمي منظم */
export const FormsLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <rect x="5" y="3.5" width="14" height="17" rx="2.2" />
    <path d="M8.5 8.5H15.5" />
    <path d="M8.5 12H15.5" />
    <path d="M8.5 15.5H12.5" />
  </svg>
);

/** الإعدادات: ترس خطي متناسق */
export const SettingsLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 1 1 16.96 19.71L16.9 19.65A1.65 1.65 0 0 0 15.08 19.32A1.65 1.65 0 0 0 14.08 20.83V21A2 2 0 1 1 10.08 21V20.91A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.18 19.73L7.12 19.79A2 2 0 1 1 4.29 16.96L4.35 16.9A1.65 1.65 0 0 0 4.68 15.08A1.65 1.65 0 0 0 3.17 14.08H3A2 2 0 1 1 3 10.08H3.09A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.27 7.18L4.21 7.12A2 2 0 1 1 7.04 4.29L7.1 4.35A1.65 1.65 0 0 0 8.92 4.68H9A1.65 1.65 0 0 0 10 3.17V3A2 2 0 1 1 14 3V3.09A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21A2 2 0 1 1 19.71 7.04L19.65 7.1A1.65 1.65 0 0 0 19.32 8.92V9A1.65 1.65 0 0 0 20.83 10H21A2 2 0 1 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z" />
  </svg>
);

/** المساعدة: علامة استفهام داخل إطار بسيط */
export const HelpLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M5 4.5H19C19.83 4.5 20.5 5.17 20.5 6V16.5C20.5 17.33 19.83 18 19 18H10.5L6.5 20.5V18H5C4.17 18 3.5 17.33 3.5 16.5V6C3.5 5.17 4.17 4.5 5 4.5Z" />
    <path d="M9.6 9.2C9.8 8 10.8 7.3 12 7.3C13.4 7.3 14.3 8.2 14.3 9.4C14.3 10.6 13.3 11.1 12.6 11.6C12.2 11.9 12 12.3 12 12.8" />
    <circle cx="12" cy="15.2" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

/** مجتمعات التعلّم المهنية: مجموعة متعاونة */
export const PlcLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <circle cx="9.5" cy="8" r="3" />
    <path d="M4 18.8C4 15.8 6.4 13.8 9.5 13.8C12.6 13.8 15 15.8 15 18.8" />
    <circle cx="16.5" cy="9.2" r="2.3" />
    <path d="M16.5 14C18.6 14 20.3 15.4 20.5 17.8" />
  </svg>
);

/** الموهوبين: مصباح إبداع خطي ناعم */
export const GiftedLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M9.5 16.5H14.5" />
    <path d="M10.2 19.5H13.8" />
    <path d="M9.5 16.5C9.5 14.9 8.4 13.8 7.5 12.6C6.6 11.5 6.2 10.1 6.4 8.5C6.8 5.9 9 3.9 11.6 3.7C15 3.5 17.8 6.2 17.8 9.5C17.8 11 17.2 12.2 16.3 13.2C15.5 14.1 14.5 15.1 14.5 16.5" />
    <path d="M12 8.2V11.2" />
    <path d="M10.5 9.7H13.5" />
  </svg>
);

/** القائمة (للجوال) */
export const MenuLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M4 7H20" />
    <path d="M4 12H20" />
    <path d="M4 17H15" />
  </svg>
);

/** إغلاق */
export const CloseLineIcon: React.FC<LineIconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M6 6L18 18" />
    <path d="M18 6L6 18" />
  </svg>
);

/** سهم يسار (اتجاه التقدم في RTL) */
export const ArrowLeftLineIcon: React.FC<LineIconProps> = ({ className = 'w-4 h-4', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M19 12H5" />
    <path d="M11 6L5 12L11 18" />
  </svg>
);

/** سهم يمين (اتجاه الرجوع في RTL) */
export const ArrowRightLineIcon: React.FC<LineIconProps> = ({ className = 'w-4 h-4', ...props }) => (
  <svg {...baseProps} className={className} {...props}>
    <path d="M5 12H19" />
    <path d="M13 6L19 12L13 18" />
  </svg>
);

export const PageLineIcon: React.FC<{ pageId: PageId; className?: string }> = ({
  pageId,
  className = 'w-5 h-5',
}) => {
  switch (pageId) {
    case 'home':
      return <HomeLineIcon className={className} />;
    case 'professional-development':
      return <ProfessionalDevLineIcon className={className} />;
    case 'plc':
      return <PlcLineIcon className={className} />;
    case 'gifted':
      return <GiftedLineIcon className={className} />;
    case 'teacher':
      return <PerformanceLineIcon className={className} />;
    case 'settings':
      return <SettingsLineIcon className={className} />;
  }
};
