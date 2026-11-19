import React, { useMemo } from 'react';
import {
  ArrowLeftLineIcon,
  EvidenceLineIcon,
  GiftedLineIcon,
  PlcLineIcon,
  ProfessionalDevLineIcon,
} from '../components/brand/MaktbyIcons';
import { MaktbyFolderIllustration } from '../components/brand/MaktbyLogo';
import { OfficialInfoBar } from '../components/OfficialInfoBar';
import { SectionCard } from '../components/SectionCard';
import { useSettings } from '../context/SettingsContext';
import { PLC_SECTION_THEME, SECTIONS_LIST } from '../data/sections';
import { PageId, SectionId } from '../types';
import { loadGiftedRecordFromStorage } from '../utils/giftedRecordEngine';
import { loadPdUnitStore } from '../utils/pdCoordinatorEngine';
import { loadPlcCommunitiesFromStorage } from '../utils/plcEngine';
import { getRoleForSection } from '../utils/settingsStorage';
import { resolveFullPortfolioOverview } from '../utils/teacherPortfolioEngine';

interface HomePageProps {
  onNavigate: (page: PageId) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { settings } = useSettings();

  const handleSelectSection = (sectionId: SectionId) => {
    onNavigate(sectionId);
  };

  const handleScrollToSections = () => {
    const target = document.getElementById('sections-grid');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Real live counts derived strictly from local browser stores (zero mock figures)
  const liveStats = useMemo(() => {
    let teacherEvidences = 0;
    let pdPrograms = 0;
    let plcCount = 0;
    let giftedEntries = 0;

    try {
      const portfolio = resolveFullPortfolioOverview();
      teacherEvidences = portfolio.totalCombinedEvidencesCount;
    } catch {
      teacherEvidences = 0;
    }

    try {
      const pdStore = loadPdUnitStore(undefined, settings);
      for (const period of Object.values(pdStore.periods)) {
        const planItems = Array.isArray(period.generalPlan?.vessels)
          ? period.generalPlan.vessels.reduce(
              (sum, vessel) =>
                sum +
                vessel.rows.filter((row) => row.topic.trim().length > 0).length,
              0
            )
          : 0;
        const execItems = Array.isArray(period.executionReport?.programs)
          ? period.executionReport.programs.filter(
              (prog) => prog.programName.trim().length > 0
            ).length
          : 0;
        pdPrograms += planItems + execItems;
      }
    } catch {
      pdPrograms = 0;
    }

    try {
      plcCount = loadPlcCommunitiesFromStorage().length;
    } catch {
      plcCount = 0;
    }

    try {
      const gifted = loadGiftedRecordFromStorage(undefined, settings);
      giftedEntries =
        (gifted.students?.length ?? 0) + (gifted.unifiedRecords?.length ?? 0);
    } catch {
      giftedEntries = 0;
    }

    return [
      {
        id: 'teacher-evidences',
        label: 'شواهد الأداء الموثقة',
        value: teacherEvidences,
        target: 'teacher' as PageId,
        iconBg: 'bg-[#DCEAF5] text-[#416B91] border border-[#B8D2E8]',
        hoverBorder: 'hover:border-[#416B91]',
        icon: <EvidenceLineIcon className="w-5 h-5" />,
      },
      {
        id: 'pd-programs',
        label: 'سجلات التطوير المهني',
        value: pdPrograms,
        target: 'professional-development' as PageId,
        iconBg: 'bg-[#E1EFE5] text-[#477B59] border border-[#BBD8C4]',
        hoverBorder: 'hover:border-[#477B59]',
        icon: <ProfessionalDevLineIcon className="w-5 h-5" />,
      },
      {
        id: 'plc-communities',
        label: 'مجتمعات التعلّم المهنية',
        value: plcCount,
        target: 'plc' as PageId,
        iconBg: 'bg-[#E5E9E7] text-[#60776B] border border-[#C5D0CA]',
        hoverBorder: 'hover:border-[#60776B]',
        icon: <PlcLineIcon className="w-5 h-5" />,
      },
      {
        id: 'gifted-records',
        label: 'سجلات وطلبة الموهوبين',
        value: giftedEntries,
        target: 'gifted' as PageId,
        iconBg: 'bg-[#F7EBD5] text-[#956C2E] border border-[#E5CFA7]',
        hoverBorder: 'hover:border-[#956C2E]',
        icon: <GiftedLineIcon className="w-5 h-5" />,
      },
    ];
  }, [settings]);

  return (
    <div className="space-y-7">
      {/* Main Welcome Hero Banner — Multi-Section Platform Introduction */}
      <section className="relative overflow-hidden bg-white rounded-2xl border border-[#E2E5E6] p-6 sm:p-8 lg:p-9 shadow-xs">
        {/* Subtle organic background wave in ultra-light petrol tint */}
        <svg
          viewBox="0 0 900 220"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-80"
        >
          <path
            d="M0 160 C210 95 420 215 660 120 C760 80 840 90 900 110 L900 220 L0 220 Z"
            fill="#EAF2F1"
          />
          <path
            d="M0 195 C260 155 520 225 900 155 L900 220 L0 220 Z"
            fill="#DCE9E8"
            opacity="0.45"
          />
        </svg>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-right max-w-2xl space-y-3">
            <h1
              className="text-3xl sm:text-4xl font-extrabold font-display text-[#292F33] tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              مرحبًا بك في مكتبي
            </h1>
            <p className="text-sm sm:text-base text-[#626D72] leading-relaxed">
              منصة تجمع أعمالك ومهامك المدرسية في مكان واحد — اختر من أقسام التطوير المهني، مجتمعات التعلّم المهنية، الموهوبين، أو المعلم لإدارة السجلات وتصدير التقارير والشهادات.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <button
                type="button"
                data-testid="browse-sections-btn"
                onClick={handleScrollToSections}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>تصفح أقسام الموقع</span>
                <ArrowLeftLineIcon className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#EAF2F1] border border-[#C4D8D6] text-[#315E62] hover:bg-[#DCE9E8] text-sm font-semibold transition-colors cursor-pointer"
              >
                إعداد بيانات المدرسة
              </button>
            </div>
          </div>

          <div className="shrink-0">
            <MaktbyFolderIllustration className="w-40 sm:w-48 h-auto" />
          </div>
        </div>
      </section>

      {/* 4 Real-Data Statistical Cards (Each with its distinct calm section color) */}
      <section aria-label="ملخص السجلات المحفوظة" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {liveStats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => onNavigate(stat.target)}
            className={`group bg-white rounded-2xl border border-[#E2E5E6] ${stat.hoverBorder} p-4 sm:p-5 text-right flex flex-col justify-between gap-3 transition-all duration-200 hover:shadow-sm cursor-pointer`}
          >
            <div
              className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}
            >
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold font-display text-[#292F33] tabular-nums leading-none">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#626D72]">
                {stat.label}
              </p>
            </div>
          </button>
        ))}
      </section>

      {/* Unified School & Teacher Information Bar */}
      <OfficialInfoBar onEditSettings={() => onNavigate('settings')} />

      {/* Main Independent Sections */}
      <section
        id="sections-grid"
        aria-labelledby="sections-heading"
        className="space-y-4 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2
            id="sections-heading"
            className="text-lg sm:text-xl font-bold font-display text-[#292F33]"
          >
            الأقسام الرئيسية للنظام
          </h2>
          <span className="text-xs sm:text-sm text-[#626D72]">
            اختر القسم للانتقال إلى مساحته المستقلة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 foldable-grid gap-5 sm:gap-6">
          <SectionCard
            section={SECTIONS_LIST[0]}
            roleTitle={getRoleForSection(settings, SECTIONS_LIST[0].id)}
            onSelect={handleSelectSection}
          />

          {/* Independent PLC Section Card (#/plc) — Dedicated Calm Sage-Gray Palette */}
          <article
            data-testid="home-section-card-plc"
            className="group bg-white rounded-2xl border border-[#E2E5E6] hover:border-[#60776B] p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="w-13 h-13 rounded-2xl bg-[#E5E9E7] border border-[#C5D0CA] text-[#60776B] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]">
                  <PlcLineIcon className="w-7 h-7" />
                </div>
                <span className="text-xs font-medium text-[#626D72] pt-1">
                  وحدة مستقلة · <strong className="font-semibold text-[#292F33]">٩ نماذج مترابطة</strong>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold font-display text-[#292F33] mb-2.5">
                {PLC_SECTION_THEME.title}
              </h2>

              <p className="text-sm sm:text-base text-[#626D72] leading-relaxed mb-6">
                إدارة وتوثيق مجتمعات التعلّم المهنية داخل المدرسة، بدءاً من تأسيس المجتمع وأعضائه، ومروراً بالخطة والاجتماعات والبرامج والشواهد وقياس الأثر، وانتهاءً بالتقرير الختامي التلقائي.
              </p>
            </div>

            <div className="pt-4 border-t border-[#E2E5E6]/80">
              <button
                type="button"
                data-testid="enter-plc-section-btn"
                onClick={() => onNavigate('plc')}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>الدخول إلى قسم مجتمعات التعلّم المهنية</span>
                <ArrowLeftLineIcon className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-1" />
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

      {/* Subtle Brand Tagline Strip (Calm Petrol Blue Accent) */}
      <section
        aria-label="هوية منصة مكتبي"
        className="relative overflow-hidden rounded-2xl border border-[#C4D8D6] bg-[#EAF2F1]/75 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div
          aria-hidden="true"
          className="hidden sm:block absolute left-0 top-0 bottom-0 w-2 bg-[#5D8C91]"
        />
        <div className="space-y-1 text-center sm:text-right">
          <p className="text-base sm:text-lg font-extrabold font-display text-[#292F33]">
            مكتبي .. شريكك في تنظيم وإنجاز أعمالك المدرسية
          </p>
          <p className="text-xs sm:text-sm text-[#626D72]">
            توثيق منظم وتقارير جاهزة للطباعة والتصدير مع حفظ آمن ومباشر داخل جهازك
          </p>
        </div>
        <div className="w-12 h-1 rounded-full bg-[#5D8C91]/50 shrink-0 sm:hidden" aria-hidden="true" />
      </section>
    </div>
  );
};
