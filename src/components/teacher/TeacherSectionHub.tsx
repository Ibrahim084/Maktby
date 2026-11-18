import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  Handshake,
  Lightbulb,
  Sparkles,
  Users,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { SECTIONS } from '../../data/sections';
import {
  TEACHER_MEETINGS_AND_VISITS_CATALOG,
  TEACHER_MEETINGS_GROUP,
  TEACHER_PEER_VISITS_GROUP,
  TeacherMeetingAndVisitFormId,
  TeacherMeetingAndVisitGroupId,
} from '../../utils/teacherMeetingsAndVisitsEngine';
import {
  getTeacherColorPalette,
  TEACHER_TEMPLATE_DEFINITIONS,
} from '../../utils/teacherPdfEngine';
import {
  getPlansForPath,
  TeacherPlanFormId,
} from '../../utils/teacherPlansEngine';
import {
  TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG,
  TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP,
  TeacherProgramsAndActivitiesFormId,
} from '../../utils/teacherProgramsAndActivitiesEngine';
import {
  TEACHER_PLANS_GROUP,
  TEACHER_PLANS_PATHS,
  TEACHER_PROFESSIONAL_REPORTS_CATALOG,
  TEACHER_PROFESSIONAL_REPORTS_GROUP,
  TeacherPlansPathId,
  TeacherProfessionalReportId,
} from '../../utils/teacherReportsEngine';
import {
  TEACHER_TESTS_AND_EVALUATION_CATALOG,
  TEACHER_TESTS_AND_EVALUATION_GROUP,
  TeacherTestsAndEvaluationFormId,
} from '../../utils/teacherTestsAndEvaluationEngine';
import { TeacherArchiveGroupId } from '../../utils/teacherArchiveEngine';
import { TeacherMeetingAndVisitForm } from './TeacherMeetingAndVisitForm';
import { TeacherPdfMasterPreview } from './TeacherPdfMasterPreview';
import { TeacherPlanForm } from './TeacherPlanForm';
import { TeacherPortfolioHub } from './TeacherPortfolioHub';
import { TeacherProfessionalReportForm } from './TeacherProfessionalReportForm';
import { TeacherProgramsAndActivitiesForm } from './TeacherProgramsAndActivitiesForm';
import { TeacherTestsAndEvaluationForm } from './TeacherTestsAndEvaluationForm';
import { CertificatesSectionHub } from '../certificates/CertificatesSectionHub';

type TeacherHubView =
  | 'groups'
  | 'catalog'
  | 'form'
  | 'pdf-studio'
  | 'plans-hub'
  | 'plan-path'
  | 'plan-form'
  | 'meeting-visit-group'
  | 'meeting-visit-form'
  | 'tests-evaluation-group'
  | 'tests-evaluation-form'
  | 'programs-activities-group'
  | 'programs-activities-form'
  | 'certificates-hub'
  | 'portfolio-hub';

function renderReportIcon(id: TeacherProfessionalReportId) {
  switch (id) {
    case 'strategy-implementation':
      return <BookOpenCheck className="w-6 h-6" aria-hidden="true" />;
    case 'problem-remediation':
      return <ClipboardCheck className="w-6 h-6" aria-hidden="true" />;
    case 'learning-outcomes-analysis':
      return <BarChart3 className="w-6 h-6" aria-hidden="true" />;
    case 'distinguished-practice':
      return <Sparkles className="w-6 h-6" aria-hidden="true" />;
    case 'professional-achievement':
      return <Award className="w-6 h-6" aria-hidden="true" />;
  }
}

function renderPlanIcon(id: TeacherPlanFormId) {
  switch (id) {
    case 'professional-development-plan':
      return <Award className="w-6 h-6" aria-hidden="true" />;
    case 'weekly-teacher-plan':
      return <CalendarRange className="w-6 h-6" aria-hidden="true" />;
    case 'individual-remedial-plan':
      return <ClipboardCheck className="w-6 h-6" aria-hidden="true" />;
    case 'group-remedial-plan':
      return <Users className="w-6 h-6" aria-hidden="true" />;
    case 'enrichment-plan':
      return <Sparkles className="w-6 h-6" aria-hidden="true" />;
  }
}

export const TeacherSectionHub: React.FC = () => {
  const { settings } = useSettings();
  const section = SECTIONS.teacher;
  const templateStyle = settings.teacherPdfTemplate ?? 'waves';
  const colorSystem = settings.teacherPdfColorSystem ?? 'green';
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];
  const palette = getTeacherColorPalette(colorSystem);

  const [view, setView] = useState<TeacherHubView>('groups');
  const [selectedReportId, setSelectedReportId] =
    useState<TeacherProfessionalReportId | null>(null);
  const [selectedPlanPathId, setSelectedPlanPathId] =
    useState<TeacherPlansPathId | null>(null);
  const [selectedPlanFormId, setSelectedPlanFormId] =
    useState<TeacherPlanFormId | null>(null);
  const [selectedMeetingVisitGroupId, setSelectedMeetingVisitGroupId] =
    useState<TeacherMeetingAndVisitGroupId | null>(null);
  const [selectedMeetingVisitFormId, setSelectedMeetingVisitFormId] =
    useState<TeacherMeetingAndVisitFormId | null>(null);
  const [selectedTestEvalFormId, setSelectedTestEvalFormId] =
    useState<TeacherTestsAndEvaluationFormId | null>(null);
  const [selectedProgramActivityFormId, setSelectedProgramActivityFormId] =
    useState<TeacherProgramsAndActivitiesFormId | null>(null);

  const handleOpenReportForm = (reportId: TeacherProfessionalReportId) => {
    setSelectedReportId(reportId);
    setView('form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenPlanPath = (pathId: TeacherPlansPathId) => {
    setSelectedPlanPathId(pathId);
    setView('plan-path');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenPlanForm = (planId: TeacherPlanFormId) => {
    setSelectedPlanFormId(planId);
    setView('plan-form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenMeetingVisitGroup = (
    groupId: TeacherMeetingAndVisitGroupId
  ) => {
    setSelectedMeetingVisitGroupId(groupId);
    setView('meeting-visit-group');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenMeetingVisitForm = (
    formId: TeacherMeetingAndVisitFormId,
    groupId: TeacherMeetingAndVisitGroupId
  ) => {
    setSelectedMeetingVisitGroupId(groupId);
    setSelectedMeetingVisitFormId(formId);
    setView('meeting-visit-form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenTestsEvaluationGroup = () => {
    setView('tests-evaluation-group');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenTestsEvaluationForm = (
    formId: TeacherTestsAndEvaluationFormId
  ) => {
    setSelectedTestEvalFormId(formId);
    setView('tests-evaluation-form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenProgramsActivitiesGroup = () => {
    setView('programs-activities-group');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenProgramsActivitiesForm = (
    formId: TeacherProgramsAndActivitiesFormId
  ) => {
    setSelectedProgramActivityFormId(formId);
    setView('programs-activities-form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (view === 'form' && selectedReportId) {
    return (
      <TeacherProfessionalReportForm
        key={selectedReportId}
        formId={selectedReportId}
        onBackToCatalog={() => {
          setView('catalog');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'plan-form' && selectedPlanFormId) {
    return (
      <TeacherPlanForm
        key={selectedPlanFormId}
        formId={selectedPlanFormId}
        onBackToPath={() => {
          setView('plan-path');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onBackToTeacherHub={() => {
          setView('groups');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'meeting-visit-form' && selectedMeetingVisitFormId) {
    return (
      <TeacherMeetingAndVisitForm
        key={selectedMeetingVisitFormId}
        formId={selectedMeetingVisitFormId}
        onBackToGroup={() => {
          setView('meeting-visit-group');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onBackToTeacherHub={() => {
          setView('groups');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'tests-evaluation-form' && selectedTestEvalFormId) {
    return (
      <TeacherTestsAndEvaluationForm
        key={selectedTestEvalFormId}
        formId={selectedTestEvalFormId}
        onBackToGroup={() => {
          setView('tests-evaluation-group');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onBackToTeacherHub={() => {
          setView('groups');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'programs-activities-form' && selectedProgramActivityFormId) {
    return (
      <TeacherProgramsAndActivitiesForm
        key={selectedProgramActivityFormId}
        formId={selectedProgramActivityFormId}
        onBackToGroup={() => {
          setView('programs-activities-group');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onBackToTeacherHub={() => {
          setView('groups');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'certificates-hub') {
    return (
      <CertificatesSectionHub
        onBackToTeacherHub={() => {
          setView('groups');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'portfolio-hub') {
    return (
      <TeacherPortfolioHub
        onBackToTeacherHub={() => {
          setView('groups');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onNavigateToSourceGroup={(groupId) => {
          switch (groupId) {
            case 'professional-reports':
              setView('catalog');
              break;
            case 'plans':
              setView('plans-hub');
              break;
            case 'meetings-visits':
              handleOpenMeetingVisitGroup('meetings-and-committees');
              return;
            case 'peer-visits':
              handleOpenMeetingVisitGroup('peer-visits-and-exchange');
              return;
            case 'tests-evaluation':
              handleOpenTestsEvaluationGroup();
              return;
            case 'programs-activities':
              handleOpenProgramsActivitiesGroup();
              return;
            case 'certificates':
              setView('certificates-hub');
              break;
          }
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    );
  }

  if (view === 'pdf-studio') {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            data-testid="back-from-studio-to-groups-btn"
            onClick={() => setView('groups')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى أقسام المعلم</span>
          </button>

          <button
            type="button"
            data-testid="switch-studio-to-reports-catalog-btn"
            onClick={() => setView('catalog')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${section.buttonBgClass}`}
          >
            <FolderKanban className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>الانتقال إلى التقارير المهنية والتعليمية (٥ نماذج)</span>
          </button>
        </div>

        <TeacherPdfMasterPreview />
      </div>
    );
  }

  if (view === 'catalog') {
    return (
      <section
        aria-labelledby="professional-reports-catalog-heading"
        data-testid="teacher-professional-reports-catalog"
        className="bg-white rounded-2xl border border-[#BFDBFE] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <button
            type="button"
            data-testid="back-to-teacher-groups-btn"
            onClick={() => {
              setView('groups');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قسم المعلم</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
              القالب النشط: {activeTemplateDef.name}
            </span>
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.primaryHex }}
              />
              <span>{palette.name}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold">
            <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
            <span>قسم المعلم · مجموعة التقارير المعتمدة</span>
          </div>
          <h2
            id="professional-reports-catalog-heading"
            className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
          >
            {TEACHER_PROFESSIONAL_REPORTS_GROUP.title}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            اختر أحد النماذج الخمسة المعتمدة للانتقال إلى صفحة إدخال البيانات
            المستقلة الخاصة به، ثم معاينة التقرير وتصديره بصيغة PDF (A4 عمودي).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TEACHER_PROFESSIONAL_REPORTS_CATALOG.map((reportItem) => (
            <article
              key={reportItem.id}
              data-testid={`teacher-report-card-${reportItem.id}`}
              className="rounded-2xl border border-[#BFDBFE] bg-white hover:border-[#2563EB] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all shadow-2xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    {renderReportIcon(reportItem.id)}
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-extrabold border border-[#BFDBFE]">
                    {reportItem.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                    {reportItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1.5">
                    {reportItem.description}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {reportItem.highlights.map((hl, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-stone-700 flex items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#2563EB] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                data-testid={`select-teacher-report-${reportItem.id}`}
                onClick={() => handleOpenReportForm(reportItem.id)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white"
              >
                <span>فتح النموذج وتعبئة البيانات</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Independent Plans Hub View (`view === 'plans-hub'`): Displays the 2 approved paths
  if (view === 'plans-hub') {
    return (
      <section
        aria-labelledby="plans-hub-heading"
        data-testid="teacher-plans-hub"
        className="bg-white rounded-2xl border border-[#BFDBFE] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <button
            type="button"
            data-testid="back-to-teacher-groups-from-plans-btn"
            onClick={() => {
              setView('groups');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قسم المعلم</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
              القالب النشط: {activeTemplateDef.name}
            </span>
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.primaryHex }}
              />
              <span>{palette.name}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold">
            <CalendarRange className="w-3.5 h-3.5" aria-hidden="true" />
            <span>قسم المعلم · مجموعة الخطط المعتمدة</span>
          </div>
          <h2
            id="plans-hub-heading"
            className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
          >
            {TEACHER_PLANS_GROUP.title}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            {TEACHER_PLANS_GROUP.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TEACHER_PLANS_PATHS.map((pathItem) => (
            <article
              key={pathItem.id}
              data-testid={`plans-path-card-${pathItem.id}`}
              className="rounded-2xl border border-[#BFDBFE] bg-white hover:border-[#2563EB] p-6 sm:p-7 flex flex-col justify-between gap-5 transition-all shadow-2xs"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-13 h-13 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    {pathItem.id === 'teacher-plans' ? (
                      <CalendarRange className="w-6 h-6" aria-hidden="true" />
                    ) : (
                      <Users className="w-6 h-6" aria-hidden="true" />
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-extrabold border border-[#BFDBFE]">
                    {pathItem.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
                    {pathItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1.5">
                    {pathItem.description}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {pathItem.highlights.map((hl, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-stone-700 flex items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#2563EB] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                data-testid={`select-path-${pathItem.id}`}
                onClick={() => handleOpenPlanPath(pathItem.id)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white"
              >
                <span>فتح مسار {pathItem.title}</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Independent Plan Path View (`view === 'plan-path'`): Displays the approved plan models for the selected path
  if (view === 'plan-path' && selectedPlanPathId) {
    const pathMeta = TEACHER_PLANS_PATHS.find(
      (p) => p.id === selectedPlanPathId
    );
    const pathPlans = getPlansForPath(selectedPlanPathId);

    return (
      <section
        aria-labelledby="plan-path-heading"
        data-testid={`teacher-plan-path-${selectedPlanPathId}`}
        className="bg-white rounded-2xl border border-[#BFDBFE] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-plans-hub-btn"
              onClick={() => {
                setView('plans-hub');
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>العودة إلى مسارات الخطط</span>
            </button>

            <button
              type="button"
              data-testid="back-to-teacher-from-path-btn"
              onClick={() => {
                setView('groups');
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-xs sm:text-sm font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>العودة لقسم المعلم</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
              القالب النشط: {activeTemplateDef.name}
            </span>
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.primaryHex }}
              />
              <span>{palette.name}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold">
            <CalendarRange className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              قسم المعلم · الخطط · {pathMeta?.title} ({pathPlans.length} نماذج
              معتمدة)
            </span>
          </div>
          <h2
            id="plan-path-heading"
            className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
          >
            {pathMeta?.title}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            {pathMeta?.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pathPlans.map((planItem) => (
            <article
              key={planItem.id}
              data-testid={`teacher-plan-card-${planItem.id}`}
              className="rounded-2xl border border-[#BFDBFE] bg-white hover:border-[#2563EB] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all shadow-2xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    {renderPlanIcon(planItem.id)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {planItem.targetPagesLabel && (
                      <span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#1E3A8A] text-[11px] font-bold border border-[#BFDBFE]">
                        {planItem.targetPagesLabel}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-extrabold border border-[#BFDBFE]">
                      {planItem.badge}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                    {planItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1.5">
                    {planItem.description}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {planItem.highlights.map((hl, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-stone-700 flex items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#2563EB] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                data-testid={`select-teacher-plan-${planItem.id}`}
                onClick={() => handleOpenPlanForm(planItem.id)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white"
              >
                <span>فتح الخطة وتعبئة البيانات</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Independent Group View for Meetings & Committees or Peer Visits (`view === 'meeting-visit-group'`)
  if (view === 'meeting-visit-group' && selectedMeetingVisitGroupId) {
    const groupMeta =
      selectedMeetingVisitGroupId === 'meetings-and-committees'
        ? TEACHER_MEETINGS_GROUP
        : TEACHER_PEER_VISITS_GROUP;
    const groupModels = TEACHER_MEETINGS_AND_VISITS_CATALOG.filter(
      (item) => item.groupId === selectedMeetingVisitGroupId
    );

    return (
      <section
        aria-labelledby="meeting-visit-group-heading"
        data-testid={`teacher-group-view-${selectedMeetingVisitGroupId}`}
        className="bg-white rounded-2xl border border-[#BFDBFE] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <button
            type="button"
            data-testid="back-to-teacher-groups-from-meeting-visit-btn"
            onClick={() => {
              setView('groups');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قسم المعلم</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
              القالب النشط: {activeTemplateDef.name}
            </span>
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.primaryHex }}
              />
              <span>{palette.name}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold">
            {selectedMeetingVisitGroupId === 'meetings-and-committees' ? (
              <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Handshake className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>قسم المعلم · {groupMeta.title}</span>
          </div>
          <h2
            id="meeting-visit-group-heading"
            className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
          >
            {groupMeta.title}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            {groupMeta.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {groupModels.map((modelItem) => (
            <article
              key={modelItem.id}
              data-testid={`teacher-meeting-visit-card-${modelItem.id}`}
              className="rounded-2xl border border-[#BFDBFE] bg-white hover:border-[#2563EB] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all shadow-2xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    {modelItem.id === 'meeting-minutes' ? (
                      <ClipboardList className="w-6 h-6" aria-hidden="true" />
                    ) : (
                      <Handshake className="w-6 h-6" aria-hidden="true" />
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-extrabold border border-[#BFDBFE]">
                    {modelItem.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                    {modelItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1.5">
                    {modelItem.description}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {modelItem.highlights.map((hl, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-stone-700 flex items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#2563EB] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                data-testid={`select-meeting-visit-form-${modelItem.id}`}
                onClick={() =>
                  handleOpenMeetingVisitForm(modelItem.id, modelItem.groupId)
                }
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white"
              >
                <span>فتح النموذج وتعبئة البيانات</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Independent Group View for Tests & Evaluation (`view === 'tests-evaluation-group'`)
  if (view === 'tests-evaluation-group') {
    return (
      <section
        aria-labelledby="tests-evaluation-group-heading"
        data-testid="teacher-group-view-tests-and-evaluation"
        className="bg-white rounded-2xl border border-[#BFDBFE] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <button
            type="button"
            data-testid="back-to-teacher-groups-from-tests-eval-btn"
            onClick={() => {
              setView('groups');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قسم المعلم</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
              القالب النشط: {activeTemplateDef.name}
            </span>
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.primaryHex }}
              />
              <span>{palette.name}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold">
            <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>قسم المعلم · {TEACHER_TESTS_AND_EVALUATION_GROUP.title}</span>
          </div>
          <h2
            id="tests-evaluation-group-heading"
            className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
          >
            {TEACHER_TESTS_AND_EVALUATION_GROUP.title}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            {TEACHER_TESTS_AND_EVALUATION_GROUP.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TEACHER_TESTS_AND_EVALUATION_CATALOG.map((modelItem) => (
            <article
              key={modelItem.id}
              data-testid={`teacher-test-eval-card-${modelItem.id}`}
              className="rounded-2xl border border-[#BFDBFE] bg-white hover:border-[#2563EB] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all shadow-2xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    {modelItem.id === 'internal-test-execution' ? (
                      <FileCheck2 className="w-6 h-6" aria-hidden="true" />
                    ) : (
                      <ClipboardCheck className="w-6 h-6" aria-hidden="true" />
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-extrabold border border-[#BFDBFE]">
                    {modelItem.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                    {modelItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1.5">
                    {modelItem.description}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {modelItem.highlights.map((hl, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-stone-700 flex items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#2563EB] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                data-testid={`select-test-eval-form-${modelItem.id}`}
                onClick={() => handleOpenTestsEvaluationForm(modelItem.id)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white"
              >
                <span>فتح النموذج وتعبئة البيانات</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Independent Group View for Educational Programs & Activities (`view === 'programs-activities-group'`)
  if (view === 'programs-activities-group') {
    return (
      <section
        aria-labelledby="programs-activities-group-heading"
        data-testid="teacher-group-view-programs-and-activities"
        className="bg-white rounded-2xl border border-[#BFDBFE] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <button
            type="button"
            data-testid="back-to-teacher-groups-from-programs-btn"
            onClick={() => {
              setView('groups');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>العودة إلى قسم المعلم</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200">
              القالب النشط: {activeTemplateDef.name}
            </span>
            <span className="px-3 py-1 rounded-lg bg-stone-100 border border-stone-200 inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: palette.primaryHex }}
              />
              <span>{palette.name}</span>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-xs font-bold">
            <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              قسم المعلم · {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.title}
            </span>
          </div>
          <h2
            id="programs-activities-group-heading"
            className="text-xl sm:text-2xl font-extrabold font-display text-stone-900"
          >
            {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.title}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.map((modelItem) => (
            <article
              key={modelItem.id}
              data-testid={`teacher-program-activity-card-${modelItem.id}`}
              className="rounded-2xl border border-[#BFDBFE] bg-white hover:border-[#2563EB] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all shadow-2xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    <Lightbulb className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-extrabold border border-[#BFDBFE]">
                    {modelItem.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                    {modelItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mt-1.5">
                    {modelItem.description}
                  </p>
                </div>

                <ul className="space-y-1.5 pt-1">
                  {modelItem.highlights.map((hl, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-stone-700 flex items-center gap-2"
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-[#2563EB] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                data-testid={`select-program-activity-form-${modelItem.id}`}
                onClick={() => handleOpenProgramsActivitiesForm(modelItem.id)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white"
              >
                <span>فتح النموذج وتعبئة البيانات</span>
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Default Hub View (`view === 'groups'`): Displays the approved primary group cards
  return (
    <section
      aria-labelledby="teacher-groups-heading"
      data-testid="teacher-section-groups-hub"
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl border border-stone-200/90 p-6 sm:p-8 space-y-6">
        <div className="border-b border-stone-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2
              id="teacher-groups-heading"
              className="text-lg sm:text-xl font-extrabold font-display text-stone-900"
            >
              مجموعات وأقسام المعلم المعتمدة
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              اختر المجموعة للدخول إلى النماذج المعتمدة وإعداد التقارير والخطط
              والمحاضر والزيارات والاختبارات
            </p>
          </div>
          <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-3 py-1.5 rounded-xl border border-[#BFDBFE]">
            القالب المعتمد: {activeTemplateDef.name} · {palette.name}
          </span>
        </div>

        {/* Master Aggregator Gateway: ملف شواهد أداء المعلم الموحد */}
        <article
          data-testid="teacher-unified-portfolio-card"
          onClick={() => {
            setView('portfolio-hub');
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="group rounded-2xl border-2 border-[#1D4ED8] bg-gradient-to-l from-[#EFF6FF] via-[#EFF6FF]/60 to-white p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs hover:border-[#1E40AF] hover:shadow-md transition-all cursor-pointer"
        >
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs">
                <BookOpenCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="px-3.5 py-1 rounded-full bg-[#1D4ED8] text-white text-xs font-extrabold">
                الطبقة التجميعية الموحدة • ١١ عنصر أداء وظيفي
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-[#BFDBFE] text-[#1D4ED8] text-xs font-bold">
                ربط مرجعي مباشر من المجموعات ١–٧ دون تكرار للبيانات
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#1D4ED8] transition-colors">
                ملف شواهد أداء المعلم الموحد
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                تنظيم وربط السجلات المحفوظة في المجموعات السبع المعتمدة بعناصر
                الأداء الوظيفي الأحد عشر، مع الملاحظات التوثيقية وتصدير ملف شواهد
                الأداء بصيغة PDF موحدة (الغلاف، الفهرس، أقسام العناصر، وملحق
                المرفقات دون تكرار).
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="enter-teacher-portfolio-hub-btn"
            onClick={(e) => {
              e.stopPropagation();
              setView('portfolio-hub');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="w-full lg:w-auto shrink-0 min-h-[48px] px-6 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] active:bg-[#1E3A8A] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
          >
            <span>فتح ملف شواهد الأداء الموحد</span>
            <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
          </button>
        </article>

        {/* Displaying the 7 approved primary group cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Group Card 1: التقارير المهنية والتعليمية */}
          <article
            data-testid="teacher-group-card-professional-reports"
            onClick={() => {
              setView('catalog');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <FolderKanban className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  ٥ نماذج مستقلة معتمدة
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  {TEACHER_PROFESSIONAL_REPORTS_GROUP.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {TEACHER_PROFESSIONAL_REPORTS_GROUP.description}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>
                    تشتمل على ٥ نماذج متخصصة لتوثيق الأنشطة ومعالجة الفجوات
                    والتحصيل الدراسي والممارسات والإنجازات المهنية
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-professional-reports-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                setView('catalog');
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى التقارير المهنية والتعليمية</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>

          {/* Group Card 2: الخطط */}
          <article
            data-testid="teacher-group-card-plans"
            onClick={() => {
              setView('plans-hub');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <CalendarRange className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  مساران معتمدان
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  {TEACHER_PLANS_GROUP.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {TEACHER_PLANS_GROUP.description}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>
                    تشتمل على مسار «خطط المعلم» ومسار «خطط المعلم للطلاب»
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-plans-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                setView('plans-hub');
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى قسم الخطط</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>

          {/* Group Card 3: الاجتماعات واللجان */}
          <article
            data-testid="teacher-group-card-meetings"
            onClick={() => handleOpenMeetingVisitGroup('meetings-and-committees')}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <ClipboardList className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  {TEACHER_MEETINGS_GROUP.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  {TEACHER_MEETINGS_GROUP.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {TEACHER_MEETINGS_GROUP.description}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>{TEACHER_MEETINGS_GROUP.summaryHighlight}</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-meetings-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenMeetingVisitGroup('meetings-and-committees');
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى الاجتماعات واللجان</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>

          {/* Group Card 4: الزيارات والتبادل المهني */}
          <article
            data-testid="teacher-group-card-peer-visits"
            onClick={() => handleOpenMeetingVisitGroup('peer-visits-and-exchange')}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <Handshake className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  {TEACHER_PEER_VISITS_GROUP.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  {TEACHER_PEER_VISITS_GROUP.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {TEACHER_PEER_VISITS_GROUP.description}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>{TEACHER_PEER_VISITS_GROUP.summaryHighlight}</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-peer-visits-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenMeetingVisitGroup('peer-visits-and-exchange');
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى الزيارات والتبادل المهني</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>

          {/* Group Card 5: الاختبارات والتقويم */}
          <article
            data-testid="teacher-group-card-tests-evaluation"
            onClick={handleOpenTestsEvaluationGroup}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <FileCheck2 className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  {TEACHER_TESTS_AND_EVALUATION_GROUP.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  {TEACHER_TESTS_AND_EVALUATION_GROUP.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {TEACHER_TESTS_AND_EVALUATION_GROUP.description}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>
                    {TEACHER_TESTS_AND_EVALUATION_GROUP.summaryHighlight}
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-tests-evaluation-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenTestsEvaluationGroup();
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى الاختبارات والتقويم</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>

          {/* Group Card 6: البرامج والأنشطة التعليمية */}
          <article
            data-testid="teacher-group-card-programs-activities"
            onClick={handleOpenProgramsActivitiesGroup}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <Lightbulb className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.description}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>
                    {TEACHER_PROGRAMS_AND_ACTIVITIES_GROUP.summaryHighlight}
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-programs-activities-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenProgramsActivitiesGroup();
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى البرامج والأنشطة التعليمية</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>

          {/* Group Card 7: الشهادات */}
          <article
            data-testid="teacher-group-card-certificates"
            onClick={() => {
              setView('certificates-hub');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="group rounded-2xl border-2 border-[#2563EB] bg-gradient-to-b from-[#EFF6FF]/80 to-white p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs hover:border-[#1D4ED8] hover:shadow-md transition-all cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-all">
                  <Award className="w-7 h-7" aria-hidden="true" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-[#2563EB] text-white text-xs font-extrabold">
                  المجموعة السابعة • ٣ أنواع شهادات
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900 group-hover:text-[#2563EB] transition-colors">
                  الشهادات
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  إصدار شهادات الشكر والتقدير، وشهادات التفوق، وشهادات التخرج بثلاثة قوالب احترافية وأربعة أنظمة ألوان وباللغتين العربية والإنجليزية للمستفيد المفرد أو المجموعات.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#BFDBFE] font-bold text-[#2563EB]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>
                    شكر وتقدير • تفوق • تخرج • تصدير PDF أفقي موحد (A4 Landscape)
                  </span>
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="enter-certificates-group-btn"
              onClick={(e) => {
                e.stopPropagation();
                setView('certificates-hub');
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="w-full sm:w-auto self-start min-h-[48px] px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-extrabold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
            >
              <span>الدخول إلى الشهادات</span>
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          </article>
        </div>
      </div>
    </section>
  );
};

