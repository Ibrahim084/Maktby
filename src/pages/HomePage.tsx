import React from 'react';
import { ArrowLeft, Users } from 'lucide-react';
import { OfficialInfoBar } from '../components/OfficialInfoBar';
import { SectionCard } from '../components/SectionCard';
import { useSettings } from '../context/SettingsContext';
import { PLC_SECTION_THEME, SECTIONS_LIST } from '../data/sections';
import { PageId, SectionId } from '../types';
import { getRoleForSection } from '../utils/settingsStorage';

interface HomePageProps {
  onNavigate: (page: PageId) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { settings } = useSettings();

  const handleSelectSection = (sectionId: SectionId) => {
    onNavigate(sectionId);
  };

  return (
    <div className="space-y-8">
      {/* Main Hero Heading */}
      <section className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 lg:p-10 text-center sm:text-right">
        <div className="max-w-3xl">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display text-stone-900 tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            مكتبي المدرسي
          </h1>
          <p className="mt-3 text-base sm:text-lg text-stone-600 leading-relaxed">
            مساحة منظمة لتوثيق أعمالي ومهامي المدرسية
          </p>
        </div>
      </section>

      {/* Unified School & Teacher Information Bar */}
      <OfficialInfoBar onEditSettings={() => onNavigate('settings')} />

      {/* Main Independent Sections */}
      <section aria-labelledby="sections-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2
            id="sections-heading"
            className="text-lg sm:text-xl font-bold font-display text-stone-900"
          >
            الأقسام الرئيسية للنظام
          </h2>
          <span className="text-xs sm:text-sm text-stone-500">
            اختر القسم للانتقال إلى مساحته المستقلة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 foldable-grid gap-5 sm:gap-6">
          <SectionCard
            section={SECTIONS_LIST[0]}
            roleTitle={getRoleForSection(settings, SECTIONS_LIST[0].id)}
            onSelect={handleSelectSection}
          />

          {/* Independent PLC Section Card (#/plc) */}
          <article
            data-testid="home-section-card-plc"
            className={`group bg-white rounded-2xl border ${PLC_SECTION_THEME.accentBorderClass} ${PLC_SECTION_THEME.accentHoverBorderClass} p-6 sm:p-7 flex flex-col justify-between transition-all duration-150 hover:shadow-md`}
          >
            <div>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className={`w-14 h-14 rounded-2xl ${PLC_SECTION_THEME.iconBgClass} flex items-center justify-center shrink-0 shadow-xs`}>
                  <Users className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${PLC_SECTION_THEME.accentSoftBgClass} ${PLC_SECTION_THEME.badgeTextClass}`}>
                  وحدة مستقلة · ٩ نماذج مترابطة
                </span>
              </div>

              <h2 className={`text-xl sm:text-2xl font-bold font-display ${PLC_SECTION_THEME.accentTextClass} mb-2.5`}>
                {PLC_SECTION_THEME.title}
              </h2>

              <p className="text-sm sm:text-base text-stone-600 leading-relaxed mb-6">
                إدارة وتوثيق مجتمعات التعلّم المهنية داخل المدرسة، بدءاً من تأسيس المجتمع وأعضائه، ومروراً بالخطة والاجتماعات والبرامج والشواهد وقياس الأثر، وانتهاءً بالتقرير الختامي التلقائي.
              </p>
            </div>

            <div className="pt-4 border-t border-stone-100">
              <button
                type="button"
                data-testid="enter-plc-section-btn"
                onClick={() => onNavigate('plc')}
                className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer ${PLC_SECTION_THEME.buttonBgClass}`}
              >
                <span>الدخول إلى قسم مجتمعات التعلّم المهنية</span>
                <ArrowLeft
                  className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-1"
                  aria-hidden="true"
                />
              </button>
            </div>
          </article>

          {SECTIONS_LIST.slice(1).map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              roleTitle={getRoleForSection(settings, section.id)}
              onSelect={handleSelectSection}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
