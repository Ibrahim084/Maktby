import React from 'react';
import { PageId } from '../types';
import {
  MenuLineIcon,
  SettingsLineIcon,
} from './brand/MaktbyIcons';
import { MaktbyLogo } from './brand/MaktbyLogo';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenMobileMenu?: () => void;
}

const PAGE_TITLES: Record<PageId, { title: string; subtitle: string }> = {
  home: {
    title: 'مرحباً بك في مكتبي',
    subtitle: 'منصة شاملة لإدارة وتوثيق أعمالك المدرسية',
  },
  'professional-development': {
    title: 'التطوير المهني',
    subtitle: 'خطط التدريب وتقارير التنفيذ والتقييم والساعات الفصلية',
  },
  plc: {
    title: 'مجتمعات التعلّم المهنية',
    subtitle: 'إدارة وتوثيق مجتمعات التعلّم المهنية والتقرير الختامي',
  },
  gifted: {
    title: 'الموهوبين',
    subtitle: 'سجل منسق الموهوبين والطلبة والبرامج والتقارير',
  },
  teacher: {
    title: 'المعلم',
    subtitle: 'الخطط والتقارير والزيارات والشواهد والأداء الوظيفي',
  },
  settings: {
    title: 'الإعدادات المركزية',
    subtitle: 'البيانات الموحدة للمدرسة والمعلم والصفات الوظيفية',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  onOpenMobileMenu,
}) => {
  const pageMeta = PAGE_TITLES[currentPage];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E2E5E6] print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Right Zone (RTL): Mobile Drawer Trigger + Mobile Brand OR Desktop Contextual Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                aria-label="فتح القائمة الجانبية"
                className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl border border-[#E2E5E6] bg-[#FBFBF9] text-[#292F33] hover:bg-[#EAF2F1] hover:text-[#315E62] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <MenuLineIcon className="w-5 h-5" />
              </button>
            )}

            {/* Mobile Compact Brand Logo */}
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="lg:hidden flex items-center shrink-0 rounded-lg px-0.5 cursor-pointer"
              aria-label="العودة إلى الرئيسية - مكتبي"
            >
              <MaktbyLogo compact className="h-10 w-auto" />
            </button>

            {/* Desktop Contextual Page Heading */}
            <div className="hidden lg:block min-w-0">
              <p className="text-base font-extrabold font-display text-[#292F33] leading-tight truncate">
                {pageMeta.title}
              </p>
              <p className="text-xs text-[#626D72] mt-0.5 truncate">
                {pageMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Left Zone (RTL): Compact Official MOE Slot (mobile/tablet) + Secondary Settings Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              data-testid="moe-logo-slot"
              className="hidden sm:flex lg:hidden items-center px-2 py-1 rounded-xl bg-[#FBFBF9] border border-[#E2E5E6]"
            >
              <img
                src="./moe-logo.png"
                alt="شعار وزارة التعليم"
                referrerPolicy="no-referrer"
                className="w-20 h-auto object-contain select-none"
              />
            </div>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              aria-current={currentPage === 'settings' ? 'page' : undefined}
              className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentPage === 'settings'
                  ? 'bg-[#376B70] text-white'
                  : 'bg-[#EAF2F1] text-[#315E62] border border-[#C4D8D6] hover:bg-[#DCE9E8]'
              }`}
            >
              <SettingsLineIcon className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">الإعدادات</span>
              <span className="hidden sm:inline">الإعدادات المركزية</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
