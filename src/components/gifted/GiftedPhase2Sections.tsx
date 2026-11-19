import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Filter,
  GraduationCap,
  Layers,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  addOrUpdateGiftedStudentInRecord,
  addOrUpdateGiftedStudentParticipationInRecord,
  computeGiftedStudentsAndAchievementsSummary,
  deleteGiftedStudentParticipationFromRecord,
  getUnifiedExecutionActionsCatalog,
  GIFTED_APPROVAL_STATUS_LABELS,
  GIFTED_CLASSIFICATION_LABELS,
  GIFTED_EXECUTION_STATUS_LABELS,
  GIFTED_NOMINATION_TYPE_LABELS,
  GIFTED_PARTICIPATION_CATEGORY_LABELS,
  GiftedApprovalStatus,
  GiftedClassificationLevel,
  GiftedCompletionMetricsReport,
  GiftedCoordinatorRecord,
  GiftedExecutionStatus,
  GiftedNominationType,
  GiftedParticipationCategory,
  resolveStudentParticipationsWithStudentInfo,
  updateProgramActionInRecord,
} from '../../utils/giftedRecordEngine';
import { GiftedStudentsRegistrySection } from './GiftedStudentsRegistrySection';

export type ActiveGiftedSectionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface GiftedPhase2SectionsProps {
  activeSection: ActiveGiftedSectionNumber;
  record: GiftedCoordinatorRecord;
  metrics: GiftedCompletionMetricsReport;
  updateRecord: (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => void;
  onNavigateToSection: (sectionNumber: ActiveGiftedSectionNumber) => void;
}

const STATUS_BADGE_STYLES: Record<
  GiftedExecutionStatus,
  { bgHex: string; textHex: string; borderHex: string }
> = {
  executed: {
    bgHex: '#EEF5EE',
    textHex: '#2F6846',
    borderHex: '#C5DCC7',
  },
  pending: {
    bgHex: '#FDF2ED',
    textHex: '#9A4A2E',
    borderHex: '#E8C9BA',
  },
  not_executed: {
    bgHex: '#FEE2E2',
    textHex: '#991B1B',
    borderHex: '#FECACA',
  },
};

function StatusBadge({ status }: { status: GiftedExecutionStatus }) {
  const style = STATUS_BADGE_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
      style={{
        backgroundColor: style.bgHex,
        color: style.textHex,
        borderColor: style.borderHex,
      }}
    >
      {status === 'executed' && (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      )}
      {status === 'pending' && <Clock className="w-3.5 h-3.5 shrink-0" />}
      {status === 'not_executed' && (
        <XCircle className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{GIFTED_EXECUTION_STATUS_LABELS[status]}</span>
    </span>
  );
}

export const GiftedPhase2Sections: React.FC<GiftedPhase2SectionsProps> = ({
  activeSection,
  record,
  metrics,
  updateRecord,
  onNavigateToSection,
}) => {
  // ---------------------------------------------------------------------------
  // Section 6 (سجل التنفيذ ومحرك الإجراءات) State
  // ---------------------------------------------------------------------------
  const [section6Tab, setSection6Tab] = useState<
    'ministerial_actions' | 'initiatives_and_competitions'
  >('ministerial_actions');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<
    string | 'all'
  >('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    GiftedExecutionStatus | 'all'
  >('all');
  const [onlyApplicableProgramsFilter, setOnlyApplicableProgramsFilter] =
    useState<boolean>(true);
  const [actionSearchQuery, setActionSearchQuery] = useState<string>('');

  // ---------------------------------------------------------------------------
  // Section 7 (سجل الطلاب والمشاركات والإنجازات) State
  // ---------------------------------------------------------------------------
  const [section7Tab, setSection7Tab] = useState<
    'students_registry' | 'participations_and_achievements'
  >('students_registry');

  const [participationCategoryFilter, setParticipationCategoryFilter] =
    useState<GiftedParticipationCategory | 'all'>('all');
  const [onlyQualifiedFilter, setOnlyQualifiedFilter] =
    useState<boolean>(false);
  const [quickAddStudentMode, setQuickAddStudentMode] =
    useState<boolean>(false);

  const [newParticipationForm, setNewParticipationForm] = useState<{
    studentId: string;
    quickStudentName: string;
    quickStudentGrade: string;
    quickStudentCivilId: string;
    quickStudentClassification: GiftedClassificationLevel;
    category: GiftedParticipationCategory;
    nominationType: GiftedNominationType;
    score: string;
    classificationResult: string;
    projectTitle: string;
    projectField: string;
    scientificTrack: string;
    enrichmentUnit: string;
    approvalStatus: GiftedApprovalStatus;
    competitionTitle: string;
    qualifiedToNextStage: boolean;
    achievementText: string;
    notes: string;
  }>({
    studentId: '',
    quickStudentName: '',
    quickStudentGrade: '',
    quickStudentCivilId: '',
    quickStudentClassification: 'gifted',
    category: 'national_identification',
    nominationType: 'supported',
    score: '',
    classificationResult: 'موهوب',
    projectTitle: '',
    projectField: '',
    scientificTrack: 'الرياضيات',
    enrichmentUnit: '',
    approvalStatus: 'approved',
    competitionTitle:
      record.scientificCompetitions[0]?.title || 'مسابقة الكانجارو للرياضيات',
    qualifiedToNextStage: false,
    achievementText: '',
    notes: '',
  });

  const studentsSummary = useMemo(
    () => computeGiftedStudentsAndAchievementsSummary(record),
    [record]
  );

  // Filtered Ministerial Programs for Section 6
  const visibleProgramsForSection6 = useMemo(() => {
    return record.ministerialPrograms.filter((prog) => {
      if (onlyApplicableProgramsFilter && !prog.applicableToSchool) {
        return false;
      }
      if (
        selectedProgramFilter !== 'all' &&
        prog.id !== selectedProgramFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    record.ministerialPrograms,
    onlyApplicableProgramsFilter,
    selectedProgramFilter,
  ]);

  const filteredFlatActionsCount = useMemo(() => {
    return getUnifiedExecutionActionsCatalog(record, {
      programId: selectedProgramFilter,
      status: selectedStatusFilter,
      onlyApplicableToSchool: onlyApplicableProgramsFilter,
      searchQuery: actionSearchQuery,
    }).length;
  }, [
    record,
    selectedProgramFilter,
    selectedStatusFilter,
    onlyApplicableProgramsFilter,
    actionSearchQuery,
  ]);

  // Resolved Participations for Section 7B
  const resolvedParticipations = useMemo(() => {
    return resolveStudentParticipationsWithStudentInfo(record, {
      category: participationCategoryFilter,
      onlyQualified: onlyQualifiedFilter,
    });
  }, [record, participationCategoryFilter, onlyQualifiedFilter]);

  const handleOpenProgramInSection6 = (programId: string) => {
    setSelectedProgramFilter(programId);
    setSelectedStatusFilter('all');
    setOnlyApplicableProgramsFilter(false);
    setSection6Tab('ministerial_actions');
    onNavigateToSection(6);
  };

  const handleAddParticipationSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateRecord((prev) => {
      let currentRecord = prev;
      let targetStudentId = newParticipationForm.studentId;

      if (quickAddStudentMode || !targetStudentId) {
        if (!newParticipationForm.quickStudentName.trim()) {
          return prev;
        }
        const created = addOrUpdateGiftedStudentInRecord(currentRecord, {
          name: newParticipationForm.quickStudentName,
          grade: newParticipationForm.quickStudentGrade || 'الأول الثانوي',
          level: 'المستوى الأول',
          civilId: newParticipationForm.quickStudentCivilId,
          talentDomain:
            GIFTED_PARTICIPATION_CATEGORY_LABELS[newParticipationForm.category],
          score: newParticipationForm.score,
          classification: newParticipationForm.quickStudentClassification,
          notes: '',
        });
        currentRecord = created.record;
        targetStudentId = created.student.id;
      }

      if (
        !targetStudentId ||
        !currentRecord.students.some((s) => s.id === targetStudentId)
      ) {
        return currentRecord;
      }

      return addOrUpdateGiftedStudentParticipationInRecord(currentRecord, {
        studentId: targetStudentId,
        category: newParticipationForm.category,
        nominationType:
          newParticipationForm.category === 'national_identification'
            ? newParticipationForm.nominationType
            : undefined,
        score:
          newParticipationForm.category === 'national_identification' ||
          newParticipationForm.category === 'acceleration'
            ? newParticipationForm.score
            : undefined,
        classificationResult:
          newParticipationForm.category === 'national_identification'
            ? newParticipationForm.classificationResult
            : undefined,
        projectTitle:
          newParticipationForm.category === 'olympiad_research'
            ? newParticipationForm.projectTitle
            : undefined,
        projectField:
          newParticipationForm.category === 'olympiad_research'
            ? newParticipationForm.projectField
            : undefined,
        scientificTrack:
          newParticipationForm.category === 'olympiad_scientific'
            ? newParticipationForm.scientificTrack
            : undefined,
        enrichmentUnit:
          newParticipationForm.category === 'innovation_space'
            ? newParticipationForm.enrichmentUnit
            : undefined,
        approvalStatus:
          newParticipationForm.category === 'acceleration'
            ? newParticipationForm.approvalStatus
            : undefined,
        competitionTitle:
          newParticipationForm.category === 'scientific_competition'
            ? newParticipationForm.competitionTitle
            : undefined,
        qualifiedToNextStage: newParticipationForm.qualifiedToNextStage,
        achievementText: newParticipationForm.achievementText,
        notes: newParticipationForm.notes,
      });
    });

    setNewParticipationForm((prev) => ({
      ...prev,
      quickStudentName: '',
      quickStudentGrade: '',
      quickStudentCivilId: '',
      score: '',
      projectTitle: '',
      projectField: '',
      enrichmentUnit: '',
      qualifiedToNextStage: false,
      achievementText: '',
      notes: '',
    }));
    setQuickAddStudentMode(false);
  };

  return (
    <>
      {/* =====================================================================
          SECTION 05: مؤشرات التنفيذ
         ===================================================================== */}
      {activeSection === 5 && (
        <section data-testid="gifted-section-5-view" className="space-y-6">
          {/* Section 05 Header */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#8A6125] text-white font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                05
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#8A6125] rotate-45 inline-block" />
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-[#292F33]">
                    مؤشرات التنفيذ ونسب الإنجاز المعتمدة
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  تُحتسب النسبة وفق المعادلة المعتمدة: (عدد الإجراءات المنفذة ÷ إجمالي الإجراءات المفعّلة × ١٠٠)، مع إظهار المعلق وغير المنفذ بصورة مستقلة، واستبعاد البرامج غير المطبقة على مرحلة المدرسة، والتمييز التام بين إنجاز الخطة التنفيذية وإنجاز إجراءات البرامج.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToSection(6)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#8A6125] hover:bg-[#704E1D] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>الانتقال إلى سجل التنفيذ (القسم 06)</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToSection(7)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#292F33] hover:bg-[#292F33] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>سجل الطلاب والمشاركات (القسم 07)</span>
              </button>
            </div>
          </div>

          {/* Dual Primary Indicators: Executive Plan vs Program Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Primary Indicator 1: Executive Plan Completion */}
            <div
              data-testid="section5-executive-plan-card"
              className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded bg-[#F7EBD5] text-[#956C2E] text-[11px] font-bold">
                    المؤشر المستقل الأول • القسم 02
                  </span>
                  <h4 className="text-base sm:text-lg font-extrabold font-display text-[#292F33] mt-1">
                    مؤشر إنجاز بنود الخطة التنفيذية العامة
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    يقيس إنجاز البنود العامة المدرجة في جدول الخطة التنفيذية للعام الدراسي المفعّلة لمرحلة المدرسة.
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <div
                    data-testid="section5-plan-percentage"
                    className="text-3xl font-extrabold text-[#956C2E] tabular-nums"
                  >
                    {metrics.executivePlanMetrics.completionPercentage}%
                  </div>
                  <div className="text-[11px] text-stone-500 font-semibold tabular-nums">
                    {metrics.executivePlanMetrics.executed} منفذ من{' '}
                    {metrics.executivePlanMetrics.totalActive}
                  </div>
                </div>
              </div>

              {/* Burgundy Progress Bar */}
              <div className="w-full h-3 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full bg-[#8A6125] rounded-full transition-all duration-300"
                  style={{
                    width: `${metrics.executivePlanMetrics.completionPercentage}%`,
                  }}
                />
              </div>

              {/* Independent Breakdown Boxes: Executed, Pending, Not Executed */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] p-3 text-center">
                  <div className="text-[11px] text-[#2F6846] font-bold">
                    بنود منفذة (نفذ)
                  </div>
                  <div className="text-xl font-extrabold text-[#2F6846] tabular-nums mt-0.5">
                    {metrics.executivePlanMetrics.executed}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FDF2ED] border border-[#E8C9BA] p-3 text-center">
                  <div className="text-[11px] text-[#9A4A2E] font-bold">
                    معلقة / قيد التنفيذ
                  </div>
                  <div className="text-xl font-extrabold text-[#9A4A2E] tabular-nums mt-0.5">
                    {metrics.executivePlanMetrics.pending}
                  </div>
                </div>
                <div className="rounded-xl bg-red-50/80 border border-red-200 p-3 text-center">
                  <div className="text-[11px] text-red-900 font-bold">
                    غير منفذة (لم ينفذ)
                  </div>
                  <div className="text-xl font-extrabold text-red-800 tabular-nums mt-0.5">
                    {metrics.executivePlanMetrics.notExecuted}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Indicator 2: Program Actions Completion */}
            <div
              data-testid="section5-program-actions-card"
              className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded bg-[#292F33] text-white text-[11px] font-bold">
                    المؤشر المستقل الثاني • القسم 06
                  </span>
                  <h4 className="text-base sm:text-lg font-extrabold font-display text-[#292F33] mt-1">
                    مؤشر إنجاز الإجراءات التفصيلية للبرامج المطبقة
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    مجموع الإجراءات المنفذة ÷ مجموع الإجراءات المفعّلة × ١٠٠ عبر البرامج الوزارية المطبقة ({metrics.applicableProgramsCount} من 7 برامج، ومستبعد للمرحلة: {metrics.excludedProgramsCount}).
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <div
                    data-testid="section5-actions-percentage"
                    className="text-3xl font-extrabold text-[#956C2E] tabular-nums"
                  >
                    {metrics.programActionsMetrics.completionPercentage}%
                  </div>
                  <div className="text-[11px] text-stone-500 font-semibold tabular-nums">
                    {metrics.programActionsMetrics.executed} منفذ من{' '}
                    {metrics.programActionsMetrics.totalActive}
                  </div>
                </div>
              </div>

              {/* Burgundy Progress Bar */}
              <div className="w-full h-3 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full bg-[#8A6125] rounded-full transition-all duration-300"
                  style={{
                    width: `${metrics.programActionsMetrics.completionPercentage}%`,
                  }}
                />
              </div>

              {/* Independent Breakdown Boxes: Executed, Pending, Not Executed */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] p-3 text-center">
                  <div className="text-[11px] text-[#2F6846] font-bold">
                    إجراءات منفذة (نفذ)
                  </div>
                  <div className="text-xl font-extrabold text-[#2F6846] tabular-nums mt-0.5">
                    {metrics.programActionsMetrics.executed}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FDF2ED] border border-[#E8C9BA] p-3 text-center">
                  <div className="text-[11px] text-[#9A4A2E] font-bold">
                    معلقة / قيد التنفيذ
                  </div>
                  <div className="text-xl font-extrabold text-[#9A4A2E] tabular-nums mt-0.5">
                    {metrics.programActionsMetrics.pending}
                  </div>
                </div>
                <div className="rounded-xl bg-red-50/80 border border-red-200 p-3 text-center">
                  <div className="text-[11px] text-red-900 font-bold">
                    غير منفذة (لم ينفذ)
                  </div>
                  <div className="text-xl font-extrabold text-red-800 tabular-nums mt-0.5">
                    {metrics.programActionsMetrics.notExecuted}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary KPI Row: Initiatives, Competitions, Students, & Qualifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                <span>مبادرات وبرامج المنسق</span>
                <Sparkles className="w-4 h-4 text-[#956C2E]" />
              </div>
              <div className="text-2xl font-extrabold text-[#292F33] tabular-nums">
                {metrics.customInitiativesMetrics.completionPercentage}%
              </div>
              <div className="text-[11px] text-stone-600 tabular-nums">
                نفذ: {metrics.customInitiativesMetrics.executed} • معلق:{' '}
                {metrics.customInitiativesMetrics.pending} • لم ينفذ:{' '}
                {metrics.customInitiativesMetrics.notExecuted}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                <span>المسابقات العلمية</span>
                <Trophy className="w-4 h-4 text-[#956C2E]" />
              </div>
              <div className="text-2xl font-extrabold text-[#292F33] tabular-nums">
                {metrics.competitionsMetrics.completionPercentage}%
              </div>
              <div className="text-[11px] text-stone-600 tabular-nums">
                نفذ: {metrics.competitionsMetrics.executed} • معلق:{' '}
                {metrics.competitionsMetrics.pending} • لم ينفذ:{' '}
                {metrics.competitionsMetrics.notExecuted}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                <span>حصر الطلبة الموهوبين</span>
                <Users className="w-4 h-4 text-[#956C2E]" />
              </div>
              <div className="text-2xl font-extrabold text-[#956C2E] tabular-nums">
                {studentsSummary.totalStudents}
              </div>
              <div className="text-[11px] text-stone-600 tabular-nums">
                موهبة استثنائية: {studentsSummary.exceptionalGiftedCount} • موهوب:{' '}
                {studentsSummary.giftedCount}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                <span>المشاركات والتأهل والإنجازات</span>
                <Award className="w-4 h-4 text-[#956C2E]" />
              </div>
              <div className="text-2xl font-extrabold text-[#292F33] tabular-nums">
                {studentsSummary.totalParticipations}
              </div>
              <div className="text-[11px] text-stone-600 tabular-nums">
                متأهلون: {studentsSummary.qualifiedStudentsCount} • إنجازات موثقة:{' '}
                {studentsSummary.documentedAchievementsCount}
              </div>
            </div>
          </div>

          {/* Per-Program Execution Breakdown Table (Matching Reference Image 2 Page 5 "متابعة التنفيذ") */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#956C2E]" />
                <div>
                  <h4 className="text-base sm:text-lg font-extrabold font-display text-[#292F33]">
                    متابعة التنفيذ التفصيلية للبرامج الوزارية السبعة
                  </h4>
                  <p className="text-xs text-stone-500">
                    البرامج غير المطبقة على مرحلة المدرسة تظهر بعلامة «مستبعد من المؤشر» ولا تؤثر سلباً على نسبة الإنجاز.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table
                data-testid="section5-per-program-table"
                className="w-full text-right text-xs sm:text-sm border-collapse"
              >
                <thead>
                  <tr className="bg-[#8A6125] text-white">
                    <th className="py-3 px-3 font-bold w-10 text-center">م</th>
                    <th className="py-3 px-3 font-bold min-w-[230px]">
                      البرنامج الوزاري المعتمد
                    </th>
                    <th className="py-3 px-3 font-bold w-36 text-center">
                      حالة الانطباق بالمدرسة
                    </th>
                    <th className="py-3 px-3 font-bold min-w-[210px]">
                      نسبة الإنجاز
                    </th>
                    <th className="py-3 px-2.5 font-bold w-20 text-center">
                      نفذ
                    </th>
                    <th className="py-3 px-2.5 font-bold w-20 text-center">
                      معلق
                    </th>
                    <th className="py-3 px-2.5 font-bold w-20 text-center">
                      لم ينفذ
                    </th>
                    <th className="py-3 px-2.5 font-bold w-24 text-center">
                      الإجمالي
                    </th>
                    <th className="py-3 px-3 font-bold w-36 text-center">
                      سجل التنفيذ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {metrics.perProgramBreakdown.map((item, idx) => (
                    <tr
                      key={item.programId}
                      className={
                        !item.applicableToSchool
                          ? 'bg-stone-100/80 text-stone-400'
                          : idx % 2 === 0
                          ? 'bg-white'
                          : 'bg-[#FBF6EC]/60'
                      }
                    >
                      <td className="py-3 px-3 font-bold text-center tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#292F33]">
                        {item.programTitle}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.applicableToSchool ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EEF5EE] text-[#2F6846] border border-[#C5DCC7] text-[11px] font-bold">
                            مطبق (يدخل بالمؤشر)
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-600 text-[11px] font-bold">
                            مستبعد لمرحلة المدرسة
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {item.applicableToSchool ? (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 rounded-full bg-stone-200 overflow-hidden">
                              <div
                                className="h-full bg-[#8A6125] rounded-full transition-all"
                                style={{
                                  width: `${item.completionPercentage}%`,
                                }}
                              />
                            </div>
                            <span className="w-11 text-left font-extrabold text-[#956C2E] tabular-nums text-xs">
                              {item.completionPercentage}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 font-semibold">
                            غير محتسب بالمؤشر
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2.5 text-center font-bold text-[#2F6846] tabular-nums">
                        {item.applicableToSchool ? item.executed : '—'}
                      </td>
                      <td className="py-3 px-2.5 text-center font-bold text-[#9A4A2E] tabular-nums">
                        {item.applicableToSchool ? item.pending : '—'}
                      </td>
                      <td className="py-3 px-2.5 text-center font-bold text-red-700 tabular-nums">
                        {item.applicableToSchool ? item.notExecuted : '—'}
                      </td>
                      <td className="py-3 px-2.5 text-center font-extrabold text-[#292F33] tabular-nums">
                        {item.applicableToSchool ? item.totalActive : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenProgramInSection6(item.programId)
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#FBF6EC] hover:bg-[#8A6125] text-[#956C2E] hover:text-white border border-[#E5CFA7] text-xs font-bold transition-colors cursor-pointer"
                        >
                          متابعة الإجراءات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 06: سجل التنفيذ ومحرك الإجراءات الموحد
         ===================================================================== */}
      {activeSection === 6 && (
        <section data-testid="gifted-section-6-view" className="space-y-6">
          {/* Section 06 Header */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#8A6125] text-white font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                06
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#8A6125] rotate-45 inline-block" />
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-[#292F33]">
                    سجل التنفيذ ومحرك الإجراءات الموحد
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  محرك موحد لمتابعة وتحديث الإجراءات الـ ٤٦ الأصلية المعتمدة للبرامج الوزارية السبعة (٨ إجراءات مستقلة للبحثي و٧ للعلمي) بالإضافة إلى مبادرات المنسق والمسابقات العلمية — مرتبط مباشرةً بالقسمين الثالث والخامس دون تكرار الإدخال.
                </p>
              </div>
            </div>

            {/* Sub-tab Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#FBF6EC] p-1.5 rounded-xl border border-[#E5CFA7]">
              <button
                type="button"
                data-testid="section6-tab-ministerial"
                onClick={() => setSection6Tab('ministerial_actions')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  section6Tab === 'ministerial_actions'
                    ? 'bg-[#8A6125] text-white'
                    : 'text-[#292F33] hover:bg-white'
                }`}
              >
                إجراءات البرامج الوزارية ({metrics.programActionsMetrics.totalActive})
              </button>
              <button
                type="button"
                data-testid="section6-tab-initiatives"
                onClick={() => setSection6Tab('initiatives_and_competitions')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  section6Tab === 'initiatives_and_competitions'
                    ? 'bg-[#8A6125] text-white'
                    : 'text-[#292F33] hover:bg-white'
                }`}
              >
                تنفيذ مبادرات المنسق والمسابقات (
                {record.customInitiatives.length +
                  record.scientificCompetitions.length}
                )
              </button>
            </div>
          </div>

          {section6Tab === 'ministerial_actions' && (
            <div className="space-y-5">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Program Selector */}
                  <div className="md:col-span-4">
                    <label
                      htmlFor="section6-program-filter"
                      className="block text-xs font-bold text-[#292F33] mb-1"
                    >
                      تصفية حسب البرنامج الوزاري
                    </label>
                    <select
                      id="section6-program-filter"
                      data-testid="section6-program-filter"
                      value={selectedProgramFilter}
                      onChange={(e) => setSelectedProgramFilter(e.target.value)}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-[#FBF6EC] text-xs font-bold text-[#292F33]"
                    >
                      <option value="all">
                        جميع البرامج الوزارية (٧ برامج)
                      </option>
                      {record.ministerialPrograms.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.actions.length} إجراءات)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Selector */}
                  <div className="md:col-span-3">
                    <label
                      htmlFor="section6-status-filter"
                      className="block text-xs font-bold text-[#292F33] mb-1"
                    >
                      تصفية حسب حالة التنفيذ
                    </label>
                    <select
                      id="section6-status-filter"
                      data-testid="section6-status-filter"
                      value={selectedStatusFilter}
                      onChange={(e) =>
                        setSelectedStatusFilter(
                          e.target.value as GiftedExecutionStatus | 'all'
                        )
                      }
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-[#FBF6EC] text-xs font-bold text-[#292F33]"
                    >
                      <option value="all">جميع الحالات (نفذ / معلق / لم ينفذ)</option>
                      <option value="executed">المنفذة فقط (نفذ)</option>
                      <option value="pending">المعلقة / قيد التنفيذ فقط</option>
                      <option value="not_executed">غير المنفذة فقط (لم ينفذ)</option>
                    </select>
                  </div>

                  {/* Search Input */}
                  <div className="md:col-span-5">
                    <label
                      htmlFor="section6-action-search"
                      className="block text-xs font-bold text-[#292F33] mb-1"
                    >
                      بحث نصي في الإجراءات أو أسباب عدم التنفيذ
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5" />
                      <input
                        id="section6-action-search"
                        type="text"
                        placeholder="ابحث بكلمة مفتاحية داخل الإجراءات..."
                        value={actionSearchQuery}
                        onChange={(e) => setActionSearchQuery(e.target.value)}
                        className="w-full min-h-[38px] pr-9 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200/70 text-xs">
                  <label className="inline-flex items-center gap-2 font-bold text-[#292F33] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyApplicableProgramsFilter}
                      onChange={(e) =>
                        setOnlyApplicableProgramsFilter(e.target.checked)
                      }
                      className="rounded accent-[#956C2E] w-4 h-4"
                    />
                    <span>
                      عرض البرامج المطبقة على مرحلة المدرسة فقط (إخفاء المستبعدة)
                    </span>
                  </label>

                  <div className="flex items-center gap-3 font-semibold text-stone-600 tabular-nums">
                    <span>
                      الإجراءات المطابقة للعرض الحالي: {filteredFlatActionsCount}
                    </span>
                    <span className="text-[#956C2E] font-extrabold">
                      إجمالي الإنجاز الموزون: {metrics.programActionsMetrics.completionPercentage}% (
                      {metrics.programActionsMetrics.executed} من{' '}
                      {metrics.programActionsMetrics.totalActive})
                    </span>
                  </div>
                </div>
              </div>

              {/* Ministerial Programs Action Tables */}
              {visibleProgramsForSection6.map((prog) => {
                const progSummary = metrics.perProgramBreakdown.find(
                  (b) => b.programId === prog.id
                );
                const q = actionSearchQuery.trim();
                const visibleActions = prog.actions.filter((act) => {
                  if (
                    selectedStatusFilter !== 'all' &&
                    act.status !== selectedStatusFilter
                  ) {
                    return false;
                  }
                  if (
                    q &&
                    !act.actionText.includes(q) &&
                    !prog.title.includes(q) &&
                    !(act.nonExecutionReason || '').includes(q)
                  ) {
                    return false;
                  }
                  return true;
                });

                if (visibleActions.length === 0 && (selectedStatusFilter !== 'all' || q)) {
                  return null;
                }

                return (
                  <div
                    key={prog.id}
                    data-testid={`section6-program-block-${prog.code}`}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                      prog.applicableToSchool
                        ? 'border-[#E5CFA7]'
                        : 'border-stone-200 opacity-85'
                    }`}
                  >
                    {/* Program Top Bar */}
                    <div className="bg-[#FBF6EC] border-b border-[#E5CFA7]/80 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#8A6125] text-white text-xs font-extrabold tabular-nums">
                            ص {prog.sourcePageNumber}
                          </span>
                          <h4 className="text-sm sm:text-base font-extrabold font-display text-[#292F33]">
                            {prog.title}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F7EBD5] text-[#956C2E] border border-[#E5CFA7] text-[11px] font-bold tabular-nums">
                            {prog.actions.length} إجراءات معتمدة
                          </span>
                          {!prog.applicableToSchool && (
                            <span className="px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[11px] font-bold">
                              مستبعد من مؤشر مرحلة المدرسة
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-600">
                          المرحلة: <strong className="text-[#292F33]">{prog.stageLabel}</strong> • الفئة المستهدفة:{' '}
                          <strong className="text-[#292F33]">{prog.targetAudience}</strong> • الموعد:{' '}
                          <strong className="text-[#292F33]">{prog.scheduledPeriod}</strong>
                        </p>
                      </div>

                      {/* Program Progress Summary */}
                      <div className="flex flex-wrap items-center gap-2">
                        {progSummary && prog.applicableToSchool && (
                          <div className="px-3 py-1.5 rounded-xl bg-white border border-[#E5CFA7] text-xs font-bold tabular-nums flex items-center gap-2">
                            <span className="text-[#956C2E] font-extrabold">
                              {progSummary.completionPercentage}%
                            </span>
                            <span className="text-stone-400">|</span>
                            <span className="text-[#2F6846]">
                              نفذ: {progSummary.executed}
                            </span>
                            <span className="text-[#9A4A2E]">
                              معلق: {progSummary.pending}
                            </span>
                            <span className="text-red-700">
                              لم ينفذ: {progSummary.notExecuted}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Table */}
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-stone-200">
                        <table className="w-full text-right text-xs sm:text-sm border-collapse">
                          <thead>
                            <tr className="bg-[#8A6125] text-white">
                              <th className="py-2.5 px-2.5 font-bold w-10 text-center">
                                م
                              </th>
                              <th className="py-2.5 px-3 font-bold min-w-[260px]">
                                الإجراء التنفيذي المعتمد
                              </th>
                              <th className="py-2.5 px-2.5 font-bold w-36">
                                تاريخ التنفيذ
                              </th>
                              <th className="py-2.5 px-2.5 font-bold w-28">
                                الأسبوع (اختياري)
                              </th>
                              <th className="py-2.5 px-2.5 font-bold w-40">
                                حالة التنفيذ
                              </th>
                              <th className="py-2.5 px-3 font-bold min-w-[180px]">
                                أسباب عدم التنفيذ (إن وُجد)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200">
                            {visibleActions.map((act) => (
                              <tr
                                key={act.id}
                                className={
                                  act.status === 'executed'
                                    ? 'bg-[#EEF5EE]'
                                    : act.status === 'not_executed'
                                    ? 'bg-red-50/30'
                                    : 'bg-white'
                                }
                              >
                                <td className="py-2.5 px-2.5 font-bold text-center tabular-nums">
                                  {act.order}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-[#292F33] leading-relaxed">
                                    {act.actionText}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2.5">
                                  <input
                                    type="text"
                                    placeholder="تاريخ التنفيذ..."
                                    aria-label={`تاريخ تنفيذ الإجراء ${act.order} في ${prog.shortTitle}`}
                                    value={act.executionDate}
                                    onChange={(e) => {
                                      const executionDate = e.target.value;
                                      updateRecord((prev) =>
                                        updateProgramActionInRecord(
                                          prev,
                                          prog.id,
                                          act.id,
                                          { executionDate }
                                        )
                                      );
                                    }}
                                    className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs focus:border-[#956C2E] focus:outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2.5">
                                  <input
                                    type="text"
                                    placeholder="اختياري"
                                    aria-label={`الأسبوع الدراسي للإجراء ${act.order} في ${prog.shortTitle}`}
                                    value={act.weekLabel || ''}
                                    onChange={(e) => {
                                      const weekLabel = e.target.value;
                                      updateRecord((prev) =>
                                        updateProgramActionInRecord(
                                          prev,
                                          prog.id,
                                          act.id,
                                          { weekLabel }
                                        )
                                      );
                                    }}
                                    className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs focus:border-[#956C2E] focus:outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2.5">
                                  <select
                                    aria-label={`حالة تنفيذ الإجراء ${act.order} في ${prog.shortTitle}`}
                                    value={act.status}
                                    onChange={(e) => {
                                      const status = e.target
                                        .value as GiftedExecutionStatus;
                                      updateRecord((prev) =>
                                        updateProgramActionInRecord(
                                          prev,
                                          prog.id,
                                          act.id,
                                          { status }
                                        )
                                      );
                                    }}
                                    className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-bold text-[#292F33]"
                                  >
                                    <option value="executed">نفذ</option>
                                    <option value="pending">
                                      معلق / قيد التنفيذ
                                    </option>
                                    <option value="not_executed">لم ينفذ</option>
                                  </select>
                                </td>
                                <td className="py-2.5 px-3">
                                  {act.status === 'not_executed' ? (
                                    <input
                                      type="text"
                                      placeholder="اكتب سبب عدم التنفيذ..."
                                      value={act.nonExecutionReason}
                                      onChange={(e) => {
                                        const nonExecutionReason = e.target.value;
                                        updateRecord((prev) =>
                                          updateProgramActionInRecord(
                                            prev,
                                            prog.id,
                                            act.id,
                                            { nonExecutionReason }
                                          )
                                        );
                                      }}
                                      className="w-full rounded-lg border border-red-300 bg-red-50/50 px-2.5 py-1 text-xs text-red-900 placeholder:text-red-400 focus:outline-none"
                                    />
                                  ) : (
                                    <span className="text-xs text-stone-400">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {section6Tab === 'initiatives_and_competitions' && (
            <div className="space-y-6">
              {/* Custom Initiatives Execution Tracking */}
              <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base sm:text-lg font-extrabold font-display text-[#292F33]">
                      سجل تنفيذ البرامج والمبادرات المعدة من منسق الموهوبين (ص 27)
                    </h4>
                    <p className="text-xs text-stone-500">
                      متابعة حالة التنفيذ ومؤشر الإنجاز وأسباب عدم التنفيذ للمبادرات المدرجة في القسم الثالث.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToSection(3)}
                    className="px-3 py-1.5 rounded-lg bg-[#FBF6EC] hover:bg-[#F7EBD5] text-[#956C2E] border border-[#E5CFA7] text-xs font-bold cursor-pointer"
                  >
                    إدارة المبادرات في القسم 03
                  </button>
                </div>

                {record.customInitiatives.length === 0 ? (
                  <div className="rounded-xl bg-[#FBF6EC] border border-dashed border-[#E5CFA7] p-6 text-center text-xs text-stone-600">
                    لا توجد مبادرات إضافية مسجلة حالياً — يمكنك إضافة مبادرات المنسق من «القسم 03: البرامج والمبادرات» وستظهر هنا تلقائياً لمتابعة تنفيذها.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-stone-200">
                    <table className="w-full text-right text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#8A6125] text-white">
                          <th className="py-2.5 px-2.5 font-bold w-10 text-center">
                            م
                          </th>
                          <th className="py-2.5 px-3 font-bold min-w-[180px]">
                            اسم المبادرة / الفعالية
                          </th>
                          <th className="py-2.5 px-2.5 font-bold w-24">
                            النوع
                          </th>
                          <th className="py-2.5 px-3 font-bold min-w-[180px]">
                            المهام المنفذة
                          </th>
                          <th className="py-2.5 px-2.5 font-bold w-32">
                            تاريخ التنفيذ
                          </th>
                          <th className="py-2.5 px-2.5 font-bold w-36">
                            حالة التنفيذ
                          </th>
                          <th className="py-2.5 px-3 font-bold min-w-[160px]">
                            مؤشر الإنجاز / سبب عدم التنفيذ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {record.customInitiatives.map((init, idx) => (
                          <tr key={init.id} className="hover:bg-[#FBF6EC]">
                            <td className="py-2.5 px-2.5 font-bold text-center tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#292F33]">
                              {init.title}
                            </td>
                            <td className="py-2.5 px-2.5 text-xs font-semibold">
                              {init.initiativeType}
                            </td>
                            <td className="py-2.5 px-3 text-xs">
                              {init.executedTasks}
                            </td>
                            <td className="py-2.5 px-2.5 text-xs">
                              {init.executionDate}
                            </td>
                            <td className="py-2.5 px-2.5">
                              <select
                                value={init.status}
                                onChange={(e) => {
                                  const status = e.target
                                    .value as GiftedExecutionStatus;
                                  updateRecord((prev) => ({
                                    ...prev,
                                    customInitiatives:
                                      prev.customInitiatives.map((row) =>
                                        row.id === init.id
                                          ? { ...row, status }
                                          : row
                                      ),
                                  }));
                                }}
                                className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-bold text-[#292F33]"
                              >
                                <option value="executed">نفذ</option>
                                <option value="pending">
                                  معلق / قيد التنفيذ
                                </option>
                                <option value="not_executed">لم ينفذ</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-xs">
                              {init.status === 'not_executed' ? (
                                <input
                                  type="text"
                                  placeholder="اذكر سبب عدم التنفيذ..."
                                  value={init.nonExecutionReason}
                                  onChange={(e) => {
                                    const nonExecutionReason = e.target.value;
                                    updateRecord((prev) => ({
                                      ...prev,
                                      customInitiatives:
                                        prev.customInitiatives.map((row) =>
                                          row.id === init.id
                                            ? { ...row, nonExecutionReason }
                                            : row
                                        ),
                                    }));
                                  }}
                                  className="w-full rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-900"
                                />
                              ) : (
                                <span className="font-semibold text-[#956C2E]">
                                  {init.achievementIndicator}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Scientific Competitions Execution Tracking */}
              <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 space-y-4">
                <div>
                  <h4 className="text-base sm:text-lg font-extrabold font-display text-[#292F33]">
                    سجل تنفيذ المسابقات العلمية (ص 28)
                  </h4>
                  <p className="text-xs text-stone-500">
                    متابعة حالة تفعيل المسابقات العلمية بالمدرسة وتاريخ التنفيذ.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-right text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#292F33] text-white">
                        <th className="py-2.5 px-2.5 font-bold w-10 text-center">
                          م
                        </th>
                        <th className="py-2.5 px-3 font-bold min-w-[200px]">
                          المسابقة العلمية
                        </th>
                        <th className="py-2.5 px-3 font-bold">المرحلة</th>
                        <th className="py-2.5 px-3 font-bold">تاريخ البداية</th>
                        <th className="py-2.5 px-3 font-bold w-40">
                          حالة التنفيذ
                        </th>
                        <th className="py-2.5 px-3 font-bold min-w-[180px]">
                          سبب عدم التنفيذ / ملاحظات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {record.scientificCompetitions.map((comp, idx) => (
                        <tr key={comp.id} className="hover:bg-[#FBF6EC]">
                          <td className="py-2.5 px-2.5 font-bold text-center tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#292F33]">
                            {comp.title}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-semibold">
                            {comp.stage}
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            {comp.startDate}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={comp.status}
                              onChange={(e) => {
                                const status = e.target
                                  .value as GiftedExecutionStatus;
                                updateRecord((prev) => ({
                                  ...prev,
                                  scientificCompetitions:
                                    prev.scientificCompetitions.map((row) =>
                                      row.id === comp.id
                                        ? { ...row, status }
                                        : row
                                    ),
                                }));
                              }}
                              className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-bold text-[#292F33]"
                            >
                              <option value="executed">نفذ</option>
                              <option value="pending">معلق / قيد التنفيذ</option>
                              <option value="not_executed">لم ينفذ</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            {comp.status === 'not_executed' ? (
                              <input
                                type="text"
                                placeholder="سبب عدم التنفيذ..."
                                value={comp.nonExecutionReason}
                                onChange={(e) => {
                                  const nonExecutionReason = e.target.value;
                                  updateRecord((prev) => ({
                                    ...prev,
                                    scientificCompetitions:
                                      prev.scientificCompetitions.map((row) =>
                                        row.id === comp.id
                                          ? { ...row, nonExecutionReason }
                                          : row
                                      ),
                                  }));
                                }}
                                className="w-full rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-900"
                              />
                            ) : (
                              <StatusBadge status={comp.status} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          SECTION 07: سجل الطلاب والمشاركات والإنجازات
         ===================================================================== */}
      {activeSection === 7 && (
        <section data-testid="gifted-section-7-view" className="space-y-6">
          {/* Section 07 Header */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#8A6125] text-white font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                07
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#8A6125] rotate-45 inline-block" />
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-[#292F33]">
                    سجل الطلاب والمشاركات والترشيحات والتأهل والإنجازات
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  قاعدة بيانات موحدة لحصر الطلبة الموهوبين بالمدرسة (السجل المدني اختياري، وبدون رقم جوال الطالب نهائياً)، مرتبطة تلقائياً بالمعرّف (ID) بجميع جداول الكشف الوطني والأولمبياد البحثي والعلمي ومساحة الابتكار والتسريع والمسابقات العلمية.
                </p>
              </div>
            </div>

            {/* Section 7 Sub-Tab Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#FBF6EC] p-1.5 rounded-xl border border-[#E5CFA7]">
              <button
                type="button"
                data-testid="section7-tab-students"
                onClick={() => setSection7Tab('students_registry')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  section7Tab === 'students_registry'
                    ? 'bg-[#8A6125] text-white'
                    : 'text-[#292F33] hover:bg-white'
                }`}
              >
                ١. حصر الطلبة الموهوبين ({studentsSummary.totalStudents})
              </button>
              <button
                type="button"
                data-testid="section7-tab-participations"
                onClick={() => setSection7Tab('participations_and_achievements')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  section7Tab === 'participations_and_achievements'
                    ? 'bg-[#8A6125] text-white'
                    : 'text-[#292F33] hover:bg-white'
                }`}
              >
                ٢. المشاركات والتأهل والإنجازات ({studentsSummary.totalParticipations})
              </button>
            </div>
          </div>

          {/* Summary KPI Cards matching Reference Image 2 Page 3 ("حصر الموهوبين") */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <div
              data-testid="students-kpi-total"
              className="bg-white rounded-2xl border border-[#E5CFA7] p-4 text-center space-y-1"
            >
              <Users className="w-5 h-5 text-[#956C2E] mx-auto" />
              <div className="text-xs font-bold text-stone-500">
                إجمالي الموهوبين
              </div>
              <div className="text-2xl font-extrabold text-[#292F33] tabular-nums">
                {studentsSummary.totalStudents}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 text-center space-y-1">
              <Sparkles className="w-5 h-5 text-[#956C2E] mx-auto" />
              <div className="text-xs font-bold text-stone-500">
                موهبة استثنائية
              </div>
              <div className="text-2xl font-extrabold text-[#956C2E] tabular-nums">
                {studentsSummary.exceptionalGiftedCount}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 text-center space-y-1">
              <GraduationCap className="w-5 h-5 text-[#292F33] mx-auto" />
              <div className="text-xs font-bold text-stone-500">
                موهوب / واعد
              </div>
              <div className="text-2xl font-extrabold text-[#292F33] tabular-nums">
                {studentsSummary.giftedCount + studentsSummary.promisingCount}
              </div>
            </div>

            <div
              data-testid="students-kpi-participations"
              className="bg-white rounded-2xl border border-[#E5CFA7] p-4 text-center space-y-1"
            >
              <Layers className="w-5 h-5 text-[#956C2E] mx-auto" />
              <div className="text-xs font-bold text-stone-500">
                إجمالي المشاركات والترشيحات
              </div>
              <div className="text-2xl font-extrabold text-[#292F33] tabular-nums">
                {studentsSummary.totalParticipations}
              </div>
            </div>

            <div
              data-testid="students-kpi-qualified"
              className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-[#E5CFA7] p-4 text-center space-y-1"
            >
              <Trophy className="w-5 h-5 text-[#956C2E] mx-auto" />
              <div className="text-xs font-bold text-stone-500">
                المتأهلون والإنجازات
              </div>
              <div className="text-2xl font-extrabold text-[#2F6846] tabular-nums">
                {studentsSummary.qualifiedStudentsCount} /{' '}
                {studentsSummary.documentedAchievementsCount}
              </div>
            </div>
          </div>

          {/* =================================================================
              SUB-TAB 7A: Master Gifted Students Registry (ص 30)
             ================================================================= */}
          {section7Tab === 'students_registry' && (
            <GiftedStudentsRegistrySection
              embeddedInSection7
              record={record}
              updateRecord={updateRecord}
              onSelectStudentForParticipation={(stuId) => {
                setNewParticipationForm((pf) => ({
                  ...pf,
                  studentId: stuId,
                }));
                setSection7Tab('participations_and_achievements');
              }}
            />
          )}

          {/* =================================================================
              SUB-TAB 7B: Student Participations, Nominations, Qualifications & Achievements
              (ص 13، 15، 16، 18، 19، 22، 26، 29)
             ================================================================= */}
          {section7Tab === 'participations_and_achievements' && (
            <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 space-y-5">
              {/* Category Filter Pills */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setParticipationCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      participationCategoryFilter === 'all'
                        ? 'bg-[#8A6125] text-white'
                        : 'bg-[#FBF6EC] text-[#292F33] border border-[#E5CFA7]'
                    }`}
                  >
                    الكل ({studentsSummary.totalParticipations})
                  </button>
                  {(
                    Object.keys(
                      GIFTED_PARTICIPATION_CATEGORY_LABELS
                    ) as GiftedParticipationCategory[]
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      data-testid={`filter-part-${cat}`}
                      onClick={() => {
                        setParticipationCategoryFilter(cat);
                        setNewParticipationForm((pf) => ({
                          ...pf,
                          category: cat,
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        participationCategoryFilter === cat
                          ? 'bg-[#8A6125] text-white'
                          : 'bg-[#FBF6EC] text-[#292F33] border border-[#E5CFA7]'
                      }`}
                    >
                      {GIFTED_PARTICIPATION_CATEGORY_LABELS[cat]} (
                      {studentsSummary.byCategoryCount[cat] || 0})
                    </button>
                  ))}
                </div>

                {/* Qualified Only Toggle (ص 16 للمرحلة الثانية للبحثي، ص 19 للنهائي للعلمي) */}
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] text-xs font-bold text-[#2F6846] cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    data-testid="filter-only-qualified-checkbox"
                    checked={onlyQualifiedFilter}
                    onChange={(e) => setOnlyQualifiedFilter(e.target.checked)}
                    className="rounded accent-[#956C2E] w-4 h-4"
                  />
                  <span>
                    عرض المتأهلين للمرحلة الثانية / النهائي فقط ({studentsSummary.qualifiedStudentsCount})
                  </span>
                </label>
              </div>

              {/* Add Linked Participation Form */}
              <form
                onSubmit={handleAddParticipationSubmit}
                data-testid="add-student-participation-form"
                className="bg-[#FBF6EC] rounded-xl border border-[#E5CFA7] p-4 space-y-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-[#956C2E] flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>
                      ربط طالب/ـة ببرنامج أو أولمبياد أو مسابقة وتوثيق الترشيح والتأهل والإنجاز
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setQuickAddStudentMode((prevMode) => !prevMode)
                    }
                    className="text-xs font-bold text-[#956C2E] underline cursor-pointer"
                  >
                    {quickAddStudentMode
                      ? 'العودة لاختيار طالب مسجل مسبقاً'
                      : '+ تسجيل طالب جديد مباشرةً وربطه'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Student Selection or Quick Add */}
                  {!quickAddStudentMode && record.students.length > 0 ? (
                    <div>
                      <label
                        htmlFor="part-student-select"
                        className="block text-[11px] font-bold text-[#292F33] mb-1"
                      >
                        الطالب/ـة (من قاعدة بيانات الموهوبين) *
                      </label>
                      <select
                        id="part-student-select"
                        data-testid="part-student-select"
                        required
                        value={
                          newParticipationForm.studentId ||
                          record.students[0]?.id ||
                          ''
                        }
                        onChange={(e) =>
                          setNewParticipationForm((p) => ({
                            ...p,
                            studentId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-bold text-[#292F33]"
                      >
                        {record.students.map((stu) => (
                          <option key={stu.id} value={stu.id}>
                            {stu.name} — ({stu.grade})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor="quick-stu-name"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          اسم الطالب/ـة الجديد *
                        </label>
                        <input
                          id="quick-stu-name"
                          type="text"
                          required
                          placeholder="اسم الطالب/ـة..."
                          value={newParticipationForm.quickStudentName}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              quickStudentName: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="quick-stu-grade"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          الصف الدراسي *
                        </label>
                        <input
                          id="quick-stu-grade"
                          type="text"
                          required
                          placeholder="مثال: الثالث المتوسط"
                          value={newParticipationForm.quickStudentGrade}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              quickStudentGrade: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                        />
                      </div>
                    </>
                  )}

                  {/* Participation Track / Category */}
                  <div>
                    <label
                      htmlFor="part-category-select"
                      className="block text-[11px] font-bold text-[#292F33] mb-1"
                    >
                      البرنامج / المسار / المسابقة *
                    </label>
                    <select
                      id="part-category-select"
                      data-testid="part-category-select"
                      value={newParticipationForm.category}
                      onChange={(e) =>
                        setNewParticipationForm((p) => ({
                          ...p,
                          category: e.target
                            .value as GiftedParticipationCategory,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-bold text-[#292F33]"
                    >
                      {(
                        Object.keys(
                          GIFTED_PARTICIPATION_CATEGORY_LABELS
                        ) as GiftedParticipationCategory[]
                      ).map((cat) => (
                        <option key={cat} value={cat}>
                          {GIFTED_PARTICIPATION_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contextual Fields by PDF Track */}
                  {newParticipationForm.category ===
                    'national_identification' && (
                    <>
                      <div>
                        <label
                          htmlFor="part-nomination-select"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          نوع الترشيح (ص 13)
                        </label>
                        <select
                          id="part-nomination-select"
                          value={newParticipationForm.nominationType}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              nominationType: e.target
                                .value as GiftedNominationType,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-bold"
                        >
                          <option value="supported">مدعوم</option>
                          <option value="self">ذاتي</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="part-nat-score"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          الدرجة والتصنيف (ص 13)
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="part-nat-score"
                            type="text"
                            placeholder="الدرجة"
                            value={newParticipationForm.score}
                            onChange={(e) =>
                              setNewParticipationForm((p) => ({
                                ...p,
                                score: e.target.value,
                              }))
                            }
                            className="w-1/2 px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-xs tabular-nums"
                          />
                          <input
                            type="text"
                            placeholder="التصنيف"
                            value={newParticipationForm.classificationResult}
                            onChange={(e) =>
                              setNewParticipationForm((p) => ({
                                ...p,
                                classificationResult: e.target.value,
                              }))
                            }
                            className="w-1/2 px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {newParticipationForm.category === 'olympiad_research' && (
                    <>
                      <div>
                        <label
                          htmlFor="part-project-title"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          اسم المشروع البحثي (ص 15)
                        </label>
                        <input
                          id="part-project-title"
                          data-testid="part-project-title"
                          type="text"
                          placeholder="عنوان المشروع البحثي..."
                          value={newParticipationForm.projectTitle}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              projectTitle: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="part-project-field"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          مجال المشروع (ص 15–16)
                        </label>
                        <input
                          id="part-project-field"
                          data-testid="part-project-field"
                          type="text"
                          placeholder="مثال: الطاقة، الطب الحيوي، الذكاء الاصطناعي..."
                          value={newParticipationForm.projectField}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              projectField: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                        />
                      </div>
                    </>
                  )}

                  {newParticipationForm.category === 'olympiad_scientific' && (
                    <div>
                      <label
                        htmlFor="part-scientific-track"
                        className="block text-[11px] font-bold text-[#292F33] mb-1"
                      >
                        المسار العلمي (ص 18–19)
                      </label>
                      <input
                        id="part-scientific-track"
                        data-testid="part-scientific-track"
                        type="text"
                        placeholder="الرياضيات / الفيزياء / الكيمياء / الأحياء / المعلوماتية"
                        value={newParticipationForm.scientificTrack}
                        onChange={(e) =>
                          setNewParticipationForm((p) => ({
                            ...p,
                            scientificTrack: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                      />
                    </div>
                  )}

                  {newParticipationForm.category === 'innovation_space' && (
                    <div>
                      <label
                        htmlFor="part-enrichment-unit"
                        className="block text-[11px] font-bold text-[#292F33] mb-1"
                      >
                        الوحدة الإثرائية (ص 22)
                      </label>
                      <input
                        id="part-enrichment-unit"
                        data-testid="part-enrichment-unit"
                        type="text"
                        placeholder="اسم الوحدة الإثرائية..."
                        value={newParticipationForm.enrichmentUnit}
                        onChange={(e) =>
                          setNewParticipationForm((p) => ({
                            ...p,
                            enrichmentUnit: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                      />
                    </div>
                  )}

                  {newParticipationForm.category === 'acceleration' && (
                    <>
                      <div>
                        <label
                          htmlFor="part-accel-score"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          درجة المقياس (ص 26)
                        </label>
                        <input
                          id="part-accel-score"
                          type="text"
                          placeholder="درجة مقياس موهبة..."
                          value={newParticipationForm.score}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              score: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs tabular-nums"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="part-accel-approval"
                          className="block text-[11px] font-bold text-[#292F33] mb-1"
                        >
                          حالة الموافقة (ص 26)
                        </label>
                        <select
                          id="part-accel-approval"
                          value={newParticipationForm.approvalStatus}
                          onChange={(e) =>
                            setNewParticipationForm((p) => ({
                              ...p,
                              approvalStatus: e.target
                                .value as GiftedApprovalStatus,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-bold"
                        >
                          <option value="approved">موافق</option>
                          <option value="pending">قيد الإجراء</option>
                          <option value="rejected">غير موافق</option>
                        </select>
                      </div>
                    </>
                  )}

                  {newParticipationForm.category ===
                    'scientific_competition' && (
                    <div>
                      <label
                        htmlFor="part-competition-title"
                        className="block text-[11px] font-bold text-[#292F33] mb-1"
                      >
                        المسابقة العلمية (ص 29)
                      </label>
                      <input
                        id="part-competition-title"
                        data-testid="part-competition-title"
                        type="text"
                        list="gifted-competitions-datalist"
                        placeholder="مسابقة الكانجارو / بيبراس..."
                        value={newParticipationForm.competitionTitle}
                        onChange={(e) =>
                          setNewParticipationForm((p) => ({
                            ...p,
                            competitionTitle: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold"
                      />
                      <datalist id="gifted-competitions-datalist">
                        {record.scientificCompetitions.map((c) => (
                          <option key={c.id} value={c.title} />
                        ))}
                      </datalist>
                    </div>
                  )}

                  {/* Achievement & Qualification Row */}
                  <div>
                    <label
                      htmlFor="part-achievement-input"
                      className="block text-[11px] font-bold text-[#292F33] mb-1"
                    >
                      الإنجاز المحقق / النتيجة
                    </label>
                    <input
                      id="part-achievement-input"
                      data-testid="part-achievement-input"
                      type="text"
                      placeholder="مثال: التأهل للمرحلة الثانية / ميدالية ذهبية"
                      value={newParticipationForm.achievementText}
                      onChange={(e) =>
                        setNewParticipationForm((p) => ({
                          ...p,
                          achievementText: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                    />
                  </div>

                  <div className="flex items-end justify-between gap-2 sm:col-span-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-stone-300 text-xs font-bold text-[#292F33] cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="part-qualified-checkbox"
                        checked={newParticipationForm.qualifiedToNextStage}
                        onChange={(e) =>
                          setNewParticipationForm((p) => ({
                            ...p,
                            qualifiedToNextStage: e.target.checked,
                          }))
                        }
                        className="rounded accent-[#956C2E] w-4 h-4"
                      />
                      <span>
                        متأهل للمرحلة الثانية / النهائي (يُدرج تلقائياً في جداول المتأهلين ص 16 وص 19)
                      </span>
                    </label>

                    <button
                      type="submit"
                      data-testid="submit-student-participation-btn"
                      className="h-[36px] px-4 rounded-lg bg-[#8A6125] hover:bg-[#704E1D] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تسجيل المشاركة</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Resolved Participations & Achievements Table */}
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table
                  data-testid="student-participations-table"
                  className="w-full text-right text-xs sm:text-sm border-collapse"
                >
                  <thead>
                    <tr className="bg-[#8A6125] text-white">
                      <th className="py-3 px-2.5 font-bold w-10 text-center">
                        م
                      </th>
                      <th className="py-3 px-3 font-bold min-w-[180px]">
                        اسم الطالب/ـة
                      </th>
                      <th className="py-3 px-3 font-bold min-w-[120px]">
                        الصف الدراسي
                      </th>
                      <th className="py-3 px-3 font-bold w-32">
                        السجل المدني (اختياري)
                      </th>
                      <th className="py-3 px-3 font-bold min-w-[180px]">
                        البرنامج / المسار / المسابقة
                      </th>
                      <th className="py-3 px-3 font-bold min-w-[200px]">
                        تفاصيل المشاركة / المشروع / الوحدة
                      </th>
                      <th className="py-3 px-2.5 font-bold w-32 text-center">
                        حالة التأهل
                      </th>
                      <th className="py-3 px-3 font-bold min-w-[170px]">
                        الإنجاز / النتيجة المحققة
                      </th>
                      <th className="py-3 px-2 font-bold w-12 text-center">
                        حذف
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {resolvedParticipations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-8 text-center text-xs text-stone-500"
                        >
                          لا توجد مشاركات مسجلة ضمن هذا التصنيف حالياً.
                        </td>
                      </tr>
                    ) : (
                      resolvedParticipations.map((part, idx) => (
                        <tr
                          key={part.id}
                          className={
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#FBF6EC]/60'
                          }
                        >
                          <td className="py-2.5 px-2.5 font-bold text-center tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#292F33]">
                            {part.studentName}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-semibold">
                            {part.studentGrade}
                          </td>
                          <td className="py-2.5 px-3 text-xs tabular-nums text-stone-600">
                            {part.studentCivilId || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2.5 py-0.5 rounded bg-[#F7EBD5] text-[#956C2E] text-[11px] font-bold">
                              {GIFTED_PARTICIPATION_CATEGORY_LABELS[part.category]}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-[#292F33]">
                            {part.category === 'national_identification' && (
                              <span>
                                الترشيح:{' '}
                                <strong>
                                  {part.nominationType
                                    ? GIFTED_NOMINATION_TYPE_LABELS[
                                        part.nominationType
                                      ]
                                    : 'مدعوم'}
                                </strong>
                                {part.score ? ` • الدرجة: ${part.score}` : ''}
                                {part.classificationResult
                                  ? ` • (${part.classificationResult})`
                                  : ''}
                              </span>
                            )}
                            {part.category === 'olympiad_research' && (
                              <div>
                                <div className="font-bold">
                                  {part.projectTitle || 'مشروع بحثي'}
                                </div>
                                {part.projectField && (
                                  <div className="text-stone-500">
                                    المجال: {part.projectField}
                                  </div>
                                )}
                              </div>
                            )}
                            {part.category === 'olympiad_scientific' && (
                              <span>
                                المسار العلمي:{' '}
                                <strong>{part.scientificTrack || 'عام'}</strong>
                              </span>
                            )}
                            {part.category === 'innovation_space' && (
                              <span>
                                الوحدة الإثرائية:{' '}
                                <strong>
                                  {part.enrichmentUnit || 'وحدة الابتكار'}
                                </strong>
                              </span>
                            )}
                            {part.category === 'acceleration' && (
                              <span>
                                درجة المقياس:{' '}
                                <strong>{part.score || '—'}</strong> • الموافقة:{' '}
                                <strong>
                                  {part.approvalStatus
                                    ? GIFTED_APPROVAL_STATUS_LABELS[
                                        part.approvalStatus
                                      ]
                                    : 'موافق'}
                                </strong>
                              </span>
                            )}
                            {part.category === 'scientific_competition' && (
                              <span className="font-bold">
                                {part.competitionTitle || 'مسابقة علمية'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                updateRecord((prev) =>
                                  addOrUpdateGiftedStudentParticipationInRecord(
                                    prev,
                                    {
                                      ...part,
                                      qualifiedToNextStage:
                                        !part.qualifiedToNextStage,
                                    }
                                  )
                                )
                              }
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                                part.qualifiedToNextStage
                                  ? 'bg-[#DFEFE0] text-[#2F6846] border border-[#C5DCC7]'
                                  : 'bg-stone-100 text-stone-600 border border-stone-200'
                              }`}
                            >
                              {part.qualifiedToNextStage
                                ? 'متأهل ✓'
                                : 'مشارك'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="توثيق الإنجاز أو المركز..."
                              value={part.achievementText}
                              onChange={(e) => {
                                const achievementText = e.target.value;
                                updateRecord((prev) =>
                                  addOrUpdateGiftedStudentParticipationInRecord(
                                    prev,
                                    {
                                      ...part,
                                      achievementText,
                                    }
                                  )
                                );
                              }}
                              className="w-full bg-transparent text-xs font-semibold text-[#956C2E] border-b border-stone-200 focus:border-[#956C2E] focus:outline-none py-0.5"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              aria-label={`حذف مشاركة ${part.studentName}`}
                              onClick={() =>
                                updateRecord((prev) =>
                                  deleteGiftedStudentParticipationFromRecord(
                                    prev,
                                    part.id
                                  )
                                )
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
};
