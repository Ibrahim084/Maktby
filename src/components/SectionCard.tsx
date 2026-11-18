import React from 'react';
import { ArrowLeft, GraduationCap, Lightbulb, Presentation } from 'lucide-react';
import { SectionId, SectionTheme } from '../types';

interface SectionCardProps {
  section: SectionTheme;
  roleTitle: string;
  onSelect: (id: SectionId) => void;
}

function renderSectionIcon(id: SectionId) {
  switch (id) {
    case 'professional-development':
      return <Presentation className="w-7 h-7" aria-hidden="true" />;
    case 'gifted':
      return <Lightbulb className="w-7 h-7" aria-hidden="true" />;
    case 'teacher':
      return <GraduationCap className="w-7 h-7" aria-hidden="true" />;
  }
}

export const SectionCard: React.FC<SectionCardProps> = ({
  section,
  roleTitle,
  onSelect,
}) => {
  const isGifted = section.id === 'gifted';
  return (
    <article
      data-testid={`home-section-card-${section.id}`}
      className={`group relative overflow-hidden bg-white rounded-2xl border ${
        isGifted
          ? 'border-[#26323B]/25 hover:border-[#26323B]'
          : `${section.accentBorderClass} ${section.accentHoverBorderClass}`
      } p-6 sm:p-7 flex flex-col justify-between transition-all duration-150 hover:shadow-md`}
    >
      {isGifted && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-[#26323B] via-[#312332] to-[#7F1D3F]"
        />
      )}
      <div>
        {/* Top Row: Icon & Section Color Identity */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div
            className={`w-14 h-14 rounded-2xl ${section.iconBgClass} flex items-center justify-center shrink-0 shadow-xs`}
          >
            {renderSectionIcon(section.id)}
          </div>
          <span
            className={`text-xs font-semibold ${
              isGifted
                ? 'px-2.5 py-1 rounded-lg bg-[#26323B]/8 text-[#26323B] border border-[#26323B]/15'
                : section.accentTextClass
            }`}
          >
            الصفة: {roleTitle || 'غير محددة'}
          </span>
        </div>

        {/* Section Title */}
        <h2 className="text-xl sm:text-2xl font-bold font-display text-stone-900 mb-2.5">
          {section.title}
        </h2>

        {/* Section Short Description */}
        <p className="text-sm sm:text-base text-stone-600 leading-relaxed mb-6">
          {section.shortDescription}
        </p>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-stone-100">
        <button
          type="button"
          onClick={() => onSelect(section.id)}
          className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer ${section.buttonBgClass}`}
        >
          <span>الدخول إلى قسم {section.title}</span>
          <ArrowLeft className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
