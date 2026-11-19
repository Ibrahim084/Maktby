import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { SECTIONS } from '../data/sections';
import { SectionId } from '../types';
import { getGenderedLabels, getRoleForSection } from '../utils/settingsStorage';
import { SettingsLineIcon } from './brand/MaktbyIcons';

interface OfficialInfoBarProps {
  sectionId?: SectionId;
  onEditSettings?: () => void;
}

export const OfficialInfoBar: React.FC<OfficialInfoBarProps> = ({
  sectionId,
  onEditSettings,
}) => {
  const { settings } = useSettings();
  const activeRole = sectionId ? getRoleForSection(settings, sectionId) : null;
  const activeSectionTheme = sectionId ? SECTIONS[sectionId] : null;
  const { principalTitle } = getGenderedLabels(settings.gender);

  return (
    <section
      aria-label="البيانات الأساسية للمدرسة والمعلم"
      className="bg-white rounded-2xl border border-[#E2E5E6] p-4 sm:p-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#626D72]">
            <span>
              الإدارة التعليمية:{' '}
              <strong className="font-semibold text-[#292F33]">
                {settings.educationDepartment || 'غير محدد'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
            <span>
              المدرسة:{' '}
              <strong className="font-semibold text-[#292F33]">
                {settings.schoolName || 'غير محدد'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
            <span>
              العام الدراسي:{' '}
              <strong className="font-semibold text-[#292F33] tabular-nums">
                {settings.academicYear || 'غير محدد'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#626D72]">
            <span>
              الاسم:{' '}
              <strong className="font-semibold text-[#292F33]">
                {settings.userName || 'غير محدد'}
              </strong>
            </span>
            {sectionId && (
              <>
                <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
                <span>
                  الصفة الوظيفية في هذا القسم:{' '}
                  <strong
                    className={`font-semibold ${
                      activeSectionTheme?.badgeTextClass ?? 'text-[#376B70]'
                    }`}
                  >
                    {activeRole || 'غير محددة'}
                  </strong>
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-[#9AA5AA]">·</span>
            <span>
              {principalTitle}:{' '}
              <strong className="font-semibold text-[#292F33]">
                {settings.principalName || 'غير محدد'}
              </strong>
            </span>
          </div>
        </div>

        {onEditSettings && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={onEditSettings}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-[#C4D8D6] bg-[#EAF2F1] text-xs sm:text-sm font-semibold text-[#315E62] hover:bg-[#DCE9E8] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <SettingsLineIcon className="w-4 h-4 shrink-0" />
              <span>تعديل بيانات المدرسة والصفات</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
