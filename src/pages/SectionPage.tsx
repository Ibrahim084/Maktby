import React, { useEffect, useState } from 'react';
import {
  ArrowLeftLineIcon,
  ArrowRightLineIcon,
  EvidenceLineIcon,
  FormsLineIcon,
  GiftedLineIcon,
  PerformanceLineIcon,
  ProfessionalDevLineIcon,
  SettingsLineIcon,
} from '../components/brand/MaktbyIcons';
import { FormRenderer } from '../components/forms/FormRenderer';
import { GiftedCoordinatorHub } from '../components/gifted/GiftedCoordinatorHub';
import { OfficialInfoBar } from '../components/OfficialInfoBar';
import { PdSectionHub } from '../components/pd/PdSectionHub';
import { TeacherSectionHub } from '../components/teacher/TeacherSectionHub';
import { useSettings } from '../context/SettingsContext';
import { SECTIONS } from '../data/sections';
import {
  createEngineVerificationForm,
  getFormsForSection,
} from '../forms/registry';
import { FormDefinition, PageId, SectionId } from '../types';
import { getRoleForSection } from '../utils/settingsStorage';

interface SectionPageProps {
  sectionId: SectionId;
  onNavigate: (page: PageId) => void;
}

function renderSectionHeaderIcon(id: SectionId) {
  switch (id) {
    case 'professional-development':
      return <ProfessionalDevLineIcon className="w-8 h-8" />;
    case 'gifted':
      return <GiftedLineIcon className="w-8 h-8" />;
    case 'teacher':
      return <PerformanceLineIcon className="w-8 h-8" />;
  }
}

export const SectionPage: React.FC<SectionPageProps> = ({
  sectionId,
  onNavigate,
}) => {
  const { settings } = useSettings();
  const section = SECTIONS[sectionId];
  const roleTitle = getRoleForSection(settings, sectionId);
  const registeredForms = getFormsForSection(sectionId);

  const [activeForm, setActiveForm] = useState<FormDefinition | null>(null);

  // Reset active form when switching between sections
  useEffect(() => {
    setActiveForm(null);
  }, [sectionId]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar with Return to Home Button (Hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#E2E5E6] text-sm font-semibold text-[#292F33] hover:bg-[#EAF2F1] hover:border-[#C4D8D6] hover:text-[#315E62] transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowRightLineIcon className="w-4 h-4 shrink-0 text-[#376B70]" />
          <span>العودة للرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EAF2F1] border border-[#C4D8D6] text-xs sm:text-sm font-semibold text-[#315E62] hover:bg-[#DCE9E8] transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <SettingsLineIcon className="w-4 h-4 shrink-0" />
          <span>تعديل الصفة أو بيانات المدرسة</span>
        </button>
      </div>

      {/* Section Header Card — Displays Section's Dedicated Calm Palette */}
      <section className="bg-white rounded-2xl border border-[#E2E5E6] p-6 sm:p-8 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div
            className={`w-16 h-16 rounded-2xl ${section.iconBgClass} flex items-center justify-center shrink-0`}
          >
            {renderSectionHeaderIcon(section.id)}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#626D72]">
              <span className={`font-semibold ${section.badgeTextClass}`}>قسم مستقل</span>
              <span aria-hidden="true" className="text-[#9AA5AA]">
                ·
              </span>
              <span>
                الصفة المعتمدة:{' '}
                <strong className="font-semibold text-[#292F33]">
                  {roleTitle || 'غير محددة'}
                </strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#292F33]">
              {section.title}
            </h1>

            <p className="text-sm sm:text-base text-[#626D72] leading-relaxed max-w-4xl">
              {section.detailedDescription}
            </p>
          </div>
        </div>
      </section>

      {/* Unified School & Section Role Metadata */}
      <div className="print:hidden">
        <OfficialInfoBar sectionId={sectionId} />
      </div>

      {/* Professional Development Hub, Teacher Section Hub, Gifted Coordinator Hub, OR Registered Section Forms */}
      {sectionId === 'professional-development' && !activeForm ? (
        <PdSectionHub
          onOpenCertificateForm={(formId) => {
            const match = registeredForms.find((f) => f.id === formId);
            if (match) {
              setActiveForm(match);
            }
          }}
        />
      ) : sectionId === 'teacher' && !activeForm ? (
        <TeacherSectionHub />
      ) : sectionId === 'gifted' && !activeForm ? (
        <GiftedCoordinatorHub />
      ) : activeForm ? (
        <FormRenderer
          key={activeForm.id}
          form={activeForm}
          onClose={() => setActiveForm(null)}
        />
      ) : (
        <section
          aria-labelledby="future-forms-heading"
          className="bg-white rounded-2xl border border-[#E2E5E6] p-6 sm:p-10"
        >
          <div className="border-b border-[#E2E5E6] pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2
                id="future-forms-heading"
                className="text-lg sm:text-xl font-bold font-display text-[#292F33]"
              >
                مساحة النماذج والتقارير المعتمدة — {section.title}
              </h2>
              <p className="text-xs sm:text-sm text-[#626D72] mt-0.5">
                مرتبطة تلقائياً ببيانات الإعدادات المركزية وصفة (
                {roleTitle || 'غير محددة'})
              </p>
            </div>
            <span className="text-xs text-[#626D72] tabular-nums">
              النماذج المسجلة حالياً: {registeredForms.length}
            </span>
          </div>

          {registeredForms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredForms.map((formItem) => (
                <article
                  key={formItem.id}
                  className={`rounded-2xl border border-[#E2E5E6] ${section.accentHoverBorderClass} p-5 flex flex-col justify-between gap-4 bg-white hover:shadow-xs transition-all`}
                >
                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-display text-[#292F33] mb-1.5">
                      {formItem.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#626D72] leading-relaxed">
                      {formItem.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveForm(formItem)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>فتح النموذج وإعداد التقرير</span>
                    <ArrowLeftLineIcon className="w-4 h-4 shrink-0" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C4D8D6] bg-[#FBFBF9] p-8 sm:p-12 text-center max-w-2xl mx-auto my-2 space-y-5">
              <div
                className={`w-12 h-12 rounded-xl ${section.iconBgClass} flex items-center justify-center mx-auto`}
              >
                <FormsLineIcon className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-[#292F33]">
                  النماذج ستضاف لاحقاً
                </h3>

                <p className="text-sm sm:text-base text-[#626D72] leading-relaxed">
                  {section.futureFormsMessage}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="open-engine-test-form"
                  onClick={() =>
                    setActiveForm(
                      createEngineVerificationForm(section.id, section.title)
                    )
                  }
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <EvidenceLineIcon className="w-4 h-4 shrink-0" />
                  <span>تجربة محرك النماذج والتقارير الموحد</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
