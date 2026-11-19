import React from 'react';
import { SectionId, SectionTheme } from '../types';
import {
  ArrowLeftLineIcon,
  GiftedLineIcon,
  PerformanceLineIcon,
  ProfessionalDevLineIcon,
} from './brand/MaktbyIcons';

interface SectionCardProps {
  section: SectionTheme;
  roleTitle: string;
  onSelect: (id: SectionId) => void;
}

function renderSectionIcon(id: SectionId) {
  switch (id) {
    case 'professional-development':
      return <ProfessionalDevLineIcon className="w-7 h-7" />;
    case 'gifted':
      return <GiftedLineIcon className="w-7 h-7" />;
    case 'teacher':
      return <PerformanceLineIcon className="w-7 h-7" />;
  }
}

export const SectionCard: React.FC<SectionCardProps> = ({
  section,
  roleTitle,
  onSelect,
}) => {
  return (
    <article
      data-testid={`home-section-card-${section.id}`}
      className={`group relative bg-white rounded-2xl border border-[#E2E5E6] ${section.accentHoverBorderClass} p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 hover:shadow-md`}
    >
      <div>
        {/* Top Row: Section-Colored Calm Line Icon & Quiet Role Metadata */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div
            className={`w-13 h-13 rounded-2xl ${section.iconBgClass} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]`}
          >
            {renderSectionIcon(section.id)}
          </div>
          <span className="text-xs font-medium text-[#626D72] pt-1 text-left">
            الصفة:{' '}
            <strong className="font-semibold text-[#292F33]">
              {roleTitle || 'غير محددة'}
            </strong>
          </span>
        </div>

        {/* Section Title */}
        <h2 className="text-xl sm:text-2xl font-bold font-display text-[#292F33] mb-2.5">
          {section.title}
        </h2>

        {/* Section Short Description */}
        <p className="text-sm sm:text-base text-[#626D72] leading-relaxed mb-6">
          {section.shortDescription}
        </p>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-[#E2E5E6]/80">
        <button
          type="button"
          onClick={() => onSelect(section.id)}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer"
        >
          <span>الدخول إلى قسم {section.title}</span>
          <ArrowLeftLineIcon className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-1" />
        </button>
      </div>
    </article>
  );
};
