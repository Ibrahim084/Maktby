import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { PageId } from '../types';
import {
  CloseLineIcon,
  GiftedLineIcon,
  HomeLineIcon,
  PerformanceLineIcon,
  PlcLineIcon,
  ProfessionalDevLineIcon,
  SettingsLineIcon,
} from './brand/MaktbyIcons';
import { MaktbyLogo } from './brand/MaktbyLogo';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const PRIMARY_NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  iconBg: string;
  iconColor: string;
  renderIcon: (className: string) => React.ReactNode;
}> = [
  {
    id: 'home',
    label: 'الرئيسية',
    iconBg: 'bg-[#EAF2F1]',
    iconColor: 'text-[#376B70]',
    renderIcon: (cls) => <HomeLineIcon className={cls} />,
  },
  {
    id: 'teacher',
    label: 'المعلم والأداء الوظيفي',
    iconBg: 'bg-[#DCEAF5]',
    iconColor: 'text-[#416B91]',
    renderIcon: (cls) => <PerformanceLineIcon className={cls} />,
  },
  {
    id: 'professional-development',
    label: 'التطوير المهني',
    iconBg: 'bg-[#E1EFE5]',
    iconColor: 'text-[#477B59]',
    renderIcon: (cls) => <ProfessionalDevLineIcon className={cls} />,
  },
  {
    id: 'plc',
    label: 'مجتمعات التعلّم المهنية',
    iconBg: 'bg-[#E5E9E7]',
    iconColor: 'text-[#60776B]',
    renderIcon: (cls) => <PlcLineIcon className={cls} />,
  },
  {
    id: 'gifted',
    label: 'الموهوبين',
    iconBg: 'bg-[#F7EBD5]',
    iconColor: 'text-[#956C2E]',
    renderIcon: (cls) => <GiftedLineIcon className={cls} />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const { settings } = useSettings();

  const handleSelect = (page: PageId) => {
    onNavigate(page);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white text-[#292F33]">
      {/* Brand Logo Zone */}
      <div className="px-5 pt-5 pb-4 border-b border-[#E2E5E6] flex items-center justify-between gap-2 bg-[#FBFBF9]">
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="mx-auto focus-visible:outline-2 focus-visible:outline-[#376B70] rounded-xl p-1 transition-opacity hover:opacity-90 cursor-pointer"
          aria-label="الانتقال إلى الصفحة الرئيسية لمنصة مكتبي"
        >
          <MaktbyLogo className="h-20 w-auto" />
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl border border-[#E2E5E6] bg-white text-[#292F33] hover:bg-[#EAF2F1] hover:text-[#315E62] flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="إغلاق القائمة الجانبية"
        >
          <CloseLineIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <nav
        aria-label="القائمة الجانبية الرئيسية"
        className="flex-1 overflow-y-auto px-3.5 py-5 space-y-1.5"
      >
        <p className="px-3 pb-1.5 text-[11px] font-semibold text-[#626D72]">
          أقسام المنصة
        </p>

        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full min-h-[46px] px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all duration-150 cursor-pointer text-right ${
                isActive
                  ? 'bg-[#376B70] text-white font-bold shadow-xs'
                  : 'text-[#292F33] font-medium hover:bg-[#F4F6F6] hover:text-[#315E62]'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : `${item.iconBg} ${item.iconColor}`
                }`}
              >
                {item.renderIcon('w-4 h-4 shrink-0')}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-4 mt-4 border-t border-[#E2E5E6] space-y-1.5">
          <p className="px-3 pb-1 text-[11px] font-semibold text-[#626D72]">
            الإعدادات والنظام
          </p>
          <button
            type="button"
            onClick={() => handleSelect('settings')}
            aria-current={currentPage === 'settings' ? 'page' : undefined}
            className={`w-full min-h-[46px] px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all duration-150 cursor-pointer text-right ${
              currentPage === 'settings'
                ? 'bg-[#376B70] text-white font-bold shadow-xs'
                : 'text-[#292F33] font-medium hover:bg-[#F4F6F6] hover:text-[#315E62]'
            }`}
          >
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                currentPage === 'settings'
                  ? 'bg-white/15 text-white'
                  : 'bg-[#EEF0F3] text-[#65727A]'
              }`}
            >
              <SettingsLineIcon className="w-4 h-4 shrink-0" />
            </span>
            <span className="truncate">الإعدادات المركزية</span>
          </button>
        </div>
      </nav>

      {/* Calm School Identity Footer inside Sidebar */}
      <div className="p-4 border-t border-[#E2E5E6] bg-[#FBFBF9] space-y-2.5">
        <div className="flex items-center justify-center py-1">
          <img
            src="./moe-logo.png"
            alt="شعار وزارة التعليم"
            referrerPolicy="no-referrer"
            className="w-28 h-auto object-contain select-none opacity-90"
          />
        </div>
        {(settings.schoolName || settings.academicYear) && (
          <div className="text-center text-xs text-[#626D72] space-y-0.5 pt-1 border-t border-[#E2E5E6]/80">
            {settings.schoolName && (
              <p className="font-semibold text-[#292F33] truncate">
                {settings.schoolName}
              </p>
            )}
            {settings.academicYear && (
              <p className="text-[11px] text-[#626D72] tabular-nums">
                العام الدراسي {settings.academicYear}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Right Sidebar (RTL) */}
      <aside
        aria-label="الشريط الجانبي"
        className="hidden lg:block w-64 shrink-0 border-l border-[#E2E5E6] bg-white sticky top-0 h-screen print:hidden"
      >
        {navContent}
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
        >
          <div
            className="fixed inset-0 bg-[#292F33]/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[84vw] h-full shadow-xl border-l border-[#E2E5E6]">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
