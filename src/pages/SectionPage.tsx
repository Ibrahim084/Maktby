import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  Lightbulb,
  Presentation,
  Settings,
} from 'lucide-react';
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
      return <Presentation className="w-8 h-8" aria-hidden="true" />;
    case 'gifted':
      return <Lightbulb className="w-8 h-8" aria-hidden="true" />;
    case 'teacher':
      return <GraduationCap className="w-8 h-8" aria-hidden="true" />;
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
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-stone-300 text-sm font-semibold text-stone-800 hover:bg-stone-100 transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>العودة للرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-stone-200 text-xs sm:text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>تعديل الصفة أو بيانات المدرسة</span>
        </button>
      </div>

      {/* Section Header Card */}
      <section
        className={`bg-white rounded-2xl border ${section.accentBorderClass} p-6 sm:p-8 print:hidden`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div
            className={`w-16 h-16 rounded-2xl ${section.iconBgClass} flex items-center justify-center shrink-0`}
          >
            {renderSectionHeaderIcon(section.id)}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold">
              <span className={section.accentTextClass}>قسم مستقل</span>
              <span aria-hidden="true" className="text-stone-300">
                ·
              </span>
              <span className="text-stone-700">
                الصفة المعتمدة: {roleTitle || 'غير محددة'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-stone-900">
              {section.title}
            </h1>

            <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-4xl">
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
          className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-10"
        >
          <div className="border-b border-stone-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2
                id="future-forms-heading"
                className="text-lg sm:text-xl font-bold font-display text-stone-900"
              >
                مساحة النماذج والتقارير المعتمدة — {section.title}
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                مرتبطة تلقائياً ببيانات الإعدادات المركزية وصفة (
                {roleTitle || 'غير محددة'})
              </p>
            </div>
            <span className="text-xs text-stone-500 tabular-nums">
              النماذج المسجلة حالياً: {registeredForms.length}
            </span>
          </div>

          {registeredForms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredForms.map((formItem) => (
                <article
                  key={formItem.id}
                  className={`rounded-2xl border ${section.accentBorderClass} p-5 flex flex-col justify-between gap-4 bg-white hover:shadow-xs transition-shadow`}
                >
                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-display text-stone-900 mb-1.5">
                      {formItem.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                      {formItem.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveForm(formItem)}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${section.buttonBgClass}`}
                  >
                    <span>فتح النموذج وإعداد التقرير</span>
                    <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div
              className={`rounded-2xl border border-dashed ${section.accentBorderClass} ${section.accentSoftBgClass} p-8 sm:p-12 text-center max-w-2xl mx-auto my-2 space-y-5`}
            >
              <div
                className={`w-12 h-12 rounded-xl ${section.iconBgClass} flex items-center justify-center mx-auto`}
              >
                <FolderOpen className="w-6 h-6" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-stone-900">
                  النماذج ستضاف لاحقاً
                </h3>

                <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
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
                  className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${section.buttonBgClass}`}
                >
                  <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
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
