import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Layers,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  addPlcCommunityToList,
  assignPlcLeaderInMembers,
  computePlcExecutionOverview,
  computePlcFormsCompletionStatus,
  computePlcMeetingsOverview,
  computePlcSchoolAggregateSummary,
  createNewPlcCommunityRecord,
  deletePlcCommunityFromList,
  filterAndSortPlcCommunities,
  generatePlcEntityId,
  getPlcCommunityLeader,
  loadPlcCommunitiesFromStorage,
  PLC_FORMS_CATALOG,
  PLC_MEMBER_ROLE_LABELS,
  PLC_SEMESTER_LABELS,
  PLC_STATUS_LABELS,
  PlcCommunityRecord,
  PlcCommunityStatus,
  PlcFormNumber,
  PlcMember,
  PlcMemberRole,
  PlcSemester,
  PlcSortCriterion,
  savePlcCommunitiesToStorage,
  updatePlcCommunityInList,
} from '../../utils/plcEngine';
import {
  getPlcDemoPreviewCommunity,
  getPlcDemoPreviewSchoolSettings,
  PLC_DEMO_FORM_HINTS,
  PLC_DEMO_SCHOOL_NAME,
} from '../../utils/plcDemoCommunity';
import { PlcBatch2Forms } from './PlcBatch2Forms';

interface CommunityModalFormState {
  editingCommunityId: string | null;
  name: string;
  specialty: string;
  academicYear: string;
  semester: PlcSemester;
  venue: string;
  foundationDate: string;
  status: PlcCommunityStatus;
  leaderName: string;
  leaderSpecialty: string;
  leaderJobRole: string;
  leaderEmail: string;
  leaderPhone: string;
}

function createEmptyModalFormState(defaultAcademicYear: string): CommunityModalFormState {
  return {
    editingCommunityId: null,
    name: '',
    specialty: '',
    academicYear: defaultAcademicYear || '١٤٤٧هـ',
    semester: 'full_year',
    venue: '',
    foundationDate: new Date().toISOString().slice(0, 10),
    status: 'active',
    leaderName: '',
    leaderSpecialty: '',
    leaderJobRole: 'معلم',
    leaderEmail: '',
    leaderPhone: '',
  };
}

export const PlcSectionHub: React.FC = () => {
  const { settings } = useSettings();

  // القائمة الرئيسية لجميع مجتمعات التعلّم المهنية المحفوظة محلياً
  const [communities, setCommunities] = useState<PlcCommunityRecord[]>(() =>
    loadPlcCommunitiesFromStorage()
  );

  // معرف المجتمع المفتوح حالياً (null = عرض صفحة المجتمعات الرئيسية)
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(
    null
  );

  // النموذج المفتوح داخل مساحة المجتمع (في الدفعة الأولى نعرض لوحة النماذج التسعة + إدارة بيانات التأسيس والأعضاء)
  const [activeFormNumber, setActiveFormNumber] =
    useState<PlcFormNumber | null>(null);

  // حالة فتح «معاينة مجتمع مهني مكتمل» (الدفعة 5.5 — معزولة بالكامل للقراءة فقط)
  const [isDemoPreviewOpen, setIsDemoPreviewOpen] = useState<boolean>(false);
  const [demoActiveFormNumber, setDemoActiveFormNumber] =
    useState<PlcFormNumber>(1);
  const demoCommunity = useMemo(() => getPlcDemoPreviewCommunity(), []);
  const demoSettings = useMemo(
    () => getPlcDemoPreviewSchoolSettings(settings),
    [settings]
  );

  // البحث والتصفية والفرز
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlcCommunityStatus | 'all'>(
    'all'
  );
  const [semesterFilter, setSemesterFilter] = useState<PlcSemester | 'all'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<PlcSortCriterion>('newest');

  // تحديد المجتمعات لإنشاء التقرير الإجمالي للمدرسة
  const [selectedIdsForSchoolReport, setSelectedIdsForSchoolReport] = useState<
    string[]
  >([]);
  const [showSchoolAggregateModal, setShowSchoolAggregateModal] =
    useState(false);

  // نافذة إنشاء أو تعديل مجتمع
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<CommunityModalFormState>(() =>
    createEmptyModalFormState(settings.academicYear)
  );
  const [modalError, setModalError] = useState<string | null>(null);

  // تأكيد الحذف المضمن (بدون window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // رسائل الحالة والتنبيهات الواضحة
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // الحفظ التلقائي الدائم في LocalStorage عند أي تغيير
  useEffect(() => {
    savePlcCommunitiesToStorage(communities);
  }, [communities]);

  const showTemporaryBanner = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => {
      setBannerMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // المجتمع المفتوح حالياً
  const activeCommunity = useMemo(
    () => communities.find((c) => c.id === activeCommunityId) ?? null,
    [communities, activeCommunityId]
  );

  // القائمة المصفاة والمفرزة
  const filteredCommunities = useMemo(
    () =>
      filterAndSortPlcCommunities(communities, {
        searchQuery,
        statusFilter,
        semesterFilter,
        sortBy,
      }),
    [communities, searchQuery, statusFilter, semesterFilter, sortBy]
  );

  // الملخص الإجمالي للمدرسة للمجتمعات المحددة
  const schoolAggregateSummary = useMemo(
    () =>
      computePlcSchoolAggregateSummary(
        communities,
        selectedIdsForSchoolReport.length > 0
          ? selectedIdsForSchoolReport
          : undefined
      ),
    [communities, selectedIdsForSchoolReport]
  );

  // فتح نافذة إنشاء مجتمع جديد
  const handleOpenCreateModal = () => {
    setModalError(null);
    setModalForm(createEmptyModalFormState(settings.academicYear));
    setIsModalOpen(true);
  };

  // فتح نافذة تعديل البيانات الأساسية لمجتمع قائم
  const handleOpenEditModal = (community: PlcCommunityRecord) => {
    const leader = getPlcCommunityLeader(community);
    setModalError(null);
    setModalForm({
      editingCommunityId: community.id,
      name: community.name,
      specialty: community.specialty,
      academicYear: community.academicYear || settings.academicYear || '١٤٤٧هـ',
      semester: community.semester,
      venue: community.venue,
      foundationDate: community.foundationDate,
      status: community.status,
      leaderName: leader?.name || '',
      leaderSpecialty: leader?.specialty || community.specialty,
      leaderJobRole: leader?.jobRole || 'معلم',
      leaderEmail: leader?.email || '',
      leaderPhone: leader?.phone || '',
    });
    setIsModalOpen(true);
  };

  // حفظ المجتمع الجديد أو التعديلات على مجتمع قائم
  const handleSaveCommunityModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.name.trim()) {
      setModalError('يرجى إدخال اسم مجتمع التعلّم المهني.');
      return;
    }
    if (!modalForm.specialty.trim()) {
      setModalError('يرجى إدخال التخصص أو مجال المجتمع.');
      return;
    }

    if (modalForm.editingCommunityId) {
      const targetId = modalForm.editingCommunityId;
      setCommunities((prev) =>
        updatePlcCommunityInList(prev, targetId, (current) => {
          const updatedMembers = modalForm.leaderName.trim()
            ? assignPlcLeaderInMembers(current.members, {
                name: modalForm.leaderName.trim(),
                specialty:
                  modalForm.leaderSpecialty.trim() ||
                  modalForm.specialty.trim(),
                jobRole: modalForm.leaderJobRole.trim() || 'معلم',
                email: modalForm.leaderEmail.trim(),
                phone: modalForm.leaderPhone.trim(),
              })
            : current.members;

          return {
            ...current,
            name: modalForm.name.trim(),
            specialty: modalForm.specialty.trim(),
            academicYear:
              modalForm.academicYear.trim() ||
              settings.academicYear ||
              '١٤٤٧هـ',
            semester: modalForm.semester,
            venue: modalForm.venue.trim(),
            foundationDate: modalForm.foundationDate.trim(),
            status: modalForm.status,
            members: updatedMembers,
          };
        })
      );
      setIsModalOpen(false);
      showTemporaryBanner('تم حفظ تعديلات بيانات المجتمع بنجاح.');
      return;
    }

    const newRecord = createNewPlcCommunityRecord(
      {
        name: modalForm.name,
        specialty: modalForm.specialty,
        academicYear: modalForm.academicYear,
        semester: modalForm.semester,
        venue: modalForm.venue,
        foundationDate: modalForm.foundationDate,
        status: modalForm.status,
        leader: modalForm.leaderName.trim()
          ? {
              name: modalForm.leaderName.trim(),
              specialty:
                modalForm.leaderSpecialty.trim() || modalForm.specialty.trim(),
              jobRole: modalForm.leaderJobRole.trim() || 'معلم',
              email: modalForm.leaderEmail.trim(),
              phone: modalForm.leaderPhone.trim(),
            }
          : undefined,
      },
      settings
    );

    setCommunities((prev) => addPlcCommunityToList(prev, newRecord));
    setIsModalOpen(false);
    showTemporaryBanner(`تم إنشاء مجتمع «${newRecord.name}» كسجل مستقل بنجاح.`);
  };

  // حذف مجتمع مستقل
  const handleConfirmDeleteCommunity = (communityId: string) => {
    const target = communities.find((c) => c.id === communityId);
    setCommunities((prev) => deletePlcCommunityFromList(prev, communityId));
    setSelectedIdsForSchoolReport((prev) =>
      prev.filter((id) => id !== communityId)
    );
    if (activeCommunityId === communityId) {
      setActiveCommunityId(null);
      setActiveFormNumber(null);
    }
    setConfirmDeleteId(null);
    if (target) {
      showTemporaryBanner(`تم حذف مجتمع «${target.name}» بنجاح.`);
    }
  };

  // تبديل تحديد مجتمع للتقرير الإجمالي للمدرسة
  const handleToggleSelectForSchoolReport = (communityId: string) => {
    setSelectedIdsForSchoolReport((prev) =>
      prev.includes(communityId)
        ? prev.filter((id) => id !== communityId)
        : [...prev, communityId]
    );
  };

  const handleSelectAllFilteredForSchoolReport = () => {
    const filteredIds = filteredCommunities.map((c) => c.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedIdsForSchoolReport.includes(id));

    if (allSelected) {
      setSelectedIdsForSchoolReport((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      );
    } else {
      setSelectedIdsForSchoolReport((prev) =>
        Array.from(new Set([...prev, ...filteredIds]))
      );
    }
  };

  const renderStatusBadge = (status: PlcCommunityStatus) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EEF5EE] text-[#2F6846] border border-[#C5DCC7] text-xs font-extrabold">
          <span className="w-2 h-2 rounded-full bg-[#2F6846]" />
          <span>{PLC_STATUS_LABELS.active}</span>
        </span>
      );
    }
    if (status === 'paused') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FDF2ED] text-[#9A4A2E] border border-[#E8C9BA] text-xs font-extrabold">
          <span className="w-2 h-2 rounded-full bg-[#9A4A2E]" />
          <span>{PLC_STATUS_LABELS.paused}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc border border-plc-border text-xs font-extrabold">
        <span className="w-2 h-2 rounded-full bg-plc" />
        <span>{PLC_STATUS_LABELS.completed}</span>
      </span>
    );
  };

  // ==========================================================================
  // العرض ٠: مساحة «معاينة مجتمع مهني مكتمل» (الدفعة 5.5 — للقراءة فقط ومعزولة تماماً)
  // ==========================================================================
  if (isDemoPreviewOpen) {
    const completion = computePlcFormsCompletionStatus(demoCommunity);
    const leader = getPlcCommunityLeader(demoCommunity);
    const meetingsOverview = computePlcMeetingsOverview(demoCommunity);
    const executionOverview = computePlcExecutionOverview(demoCommunity);

    return (
      <div className="space-y-6" data-testid="plc-demo-preview-workspace">
        {/* شريط التنبيه العلوي الإلزامي لوضع المعاينة التجريبية */}
        <div
          data-testid="plc-demo-preview-banner-card"
          className="bg-[#FDF2ED] rounded-2xl border-2 border-[#E8C9BA] p-5 sm:p-6 space-y-4 shadow-xs"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-testid="plc-demo-preview-badge"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-[#9A4A2E] text-white text-xs font-extrabold"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>معاينة تجريبية</span>
                </span>
                <span className="px-3 py-1 rounded-lg bg-white border border-[#E8C9BA] text-[#9A4A2E] text-xs font-bold">
                  للقراءة والاستكشاف فقط • معزول تماماً عن مجتمعاتك الفعلية
                </span>
                <span className="px-3 py-1 rounded-lg bg-white border border-[#E8C9BA] text-stone-700 text-xs font-bold">
                  المدرسة الافتراضية: {PLC_DEMO_SCHOOL_NAME}
                </span>
              </div>

              <p
                data-testid="plc-demo-preview-warning"
                className="text-sm sm:text-base font-extrabold text-[#9A4A2E] leading-relaxed"
              >
                «أنت تستعرض مجتمعًا نموذجيًا ببيانات تجريبية. لن يتم حفظ أي تعديل ضمن مجتمعاتك الفعلية.»
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                data-testid="plc-demo-create-my-community-btn"
                onClick={() => {
                  setIsDemoPreviewOpen(false);
                  setDemoActiveFormNumber(1);
                  handleOpenCreateModal();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>إنشاء مجتمعي الآن</span>
              </button>

              <button
                type="button"
                data-testid="plc-demo-back-to-communities-btn"
                onClick={() => {
                  setIsDemoPreviewOpen(false);
                  setDemoActiveFormNumber(1);
                }}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span>العودة إلى المجتمعات</span>
              </button>
            </div>
          </div>
        </div>

        {/* بطاقة تعريف المجتمع النموذجي المفتوح */}
        <div className="bg-white rounded-2xl border border-plc-border p-5 sm:p-6 space-y-5">
          {bannerMessage && (
            <div
              data-testid="plc-demo-feedback-banner"
              className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] px-4 py-3 text-xs sm:text-sm font-bold text-[#2F6846] flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#2F6846] shrink-0" />
              <span>{bannerMessage}</span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-plc text-white text-xs font-extrabold">
                  نموذج تطبيقي مكتمل (١ إلى ٩)
                </span>
                {renderStatusBadge(demoCommunity.status)}
                <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold tabular-nums">
                  العام الدراسي: {demoCommunity.academicYear}
                </span>
                <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold">
                  {PLC_SEMESTER_LABELS[demoCommunity.semester]}
                </span>
                <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
                  الفئة: معلمو اللغة العربية • المرحلة المتوسطة
                </span>
              </div>

              <h2
                data-testid="plc-demo-community-title"
                className="text-2xl sm:text-3xl font-extrabold font-display text-stone-900"
              >
                {demoCommunity.name}
              </h2>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-stone-600 pt-1">
                <span className="inline-flex items-center gap-1.5 font-semibold text-plc">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>التخصص / المجال: {demoCommunity.specialty}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>المدرسة الافتراضية: {PLC_DEMO_SCHOOL_NAME}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>
                    رئيس المجتمع:{' '}
                    <strong className="text-stone-900">
                      {leader ? `${leader.name} (${leader.jobRole})` : 'غير محدد'}
                    </strong>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>عدد الأعضاء: {demoCommunity.members.length}</span>
                </span>
                {demoCommunity.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0 text-stone-500" />
                    <span>المكان: {demoCommunity.venue}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="bg-plc-soft border border-plc-border rounded-2xl p-4 min-w-[240px] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-extrabold text-plc">
                <span>اكتمال نماذج المجتمع النموذجي</span>
                <span className="tabular-nums">
                  {completion.completedFormsCount} / 9 نماذج مكتملة
                </span>
              </div>
              <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-plc-border">
                <div
                  className="h-full bg-plc transition-all duration-300"
                  style={{ width: `${completion.overallCompletionPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-stone-600 tabular-nums">
                نسبة التقدم الإجمالية للبيانات النموذجية:{' '}
                <strong>{completion.overallCompletionPercentage}%</strong>
              </p>
              <button
                type="button"
                data-testid="plc-demo-jump-to-report-btn"
                onClick={() => setDemoActiveFormNumber(9)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>فتح التقرير الختامي وتحميل PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* بطاقتا ملخص الاجتماعات والتنفيذ للمجتمع النموذجي */}
        <div
          data-testid="plc-demo-batch3-summary-cards"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-plc-soft text-plc inline-flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      بطاقة الاجتماعات ومحاضرها
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      النموذج الخامس • ملخص الاجتماعات ومتابعة التوصيات
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
                  {meetingsOverview.totalMeetingsCount} اجتماع
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-500">
                    إجمالي التوصيات
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {meetingsOverview.totalRecommendationsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] p-2.5">
                  <div className="text-[11px] font-bold text-[#2F6846]">
                    تم التنفيذ
                  </div>
                  <div className="text-sm font-extrabold text-[#2F6846] tabular-nums mt-0.5">
                    {meetingsOverview.completedRecommendationsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FDF2ED] border border-[#E8C9BA] p-2.5">
                  <div className="text-[11px] font-bold text-[#9A4A2E]">
                    قيد التنفيذ
                  </div>
                  <div className="text-sm font-extrabold text-[#9A4A2E] tabular-nums mt-0.5">
                    {meetingsOverview.inProgressRecommendationsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-red-50/70 border border-red-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-red-800">
                    متأخر / لم يبدأ
                  </div>
                  <div className="text-sm font-extrabold text-red-900 tabular-nums mt-0.5">
                    {meetingsOverview.delayedRecommendationsCount +
                      meetingsOverview.notStartedRecommendationsCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end">
              <button
                type="button"
                data-testid="plc-demo-summary-open-meetings-btn"
                onClick={() => setDemoActiveFormNumber(5)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>استعراض الاجتماعات ومحاضرها</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-plc-soft text-plc inline-flex items-center justify-center">
                    <FolderKanban className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      بطاقة التنفيذ: البرامج والأنشطة والزيارات والشراكات
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      النموذج السادس • التوزيع حسب النوع وحالة التنفيذ الفعلية
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
                  {executionOverview.totalRecordsCount} سجل
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">البرامج</div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.programsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">الأنشطة</div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.activitiesCount}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">
                    الزيارات المتبادلة
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.mutualVisitsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">
                    الشراكات المجتمعية
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.partnershipsCount}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end">
              <button
                type="button"
                data-testid="plc-demo-summary-open-execution-btn"
                onClick={() => setDemoActiveFormNumber(6)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>استعراض البرامج والأنشطة والزيارات والشراكات</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* خريطة النماذج التسعة المعتمدة للمعاينة */}
        <section
          aria-labelledby="plc-demo-nine-forms-heading"
          className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <h3
                id="plc-demo-nine-forms-heading"
                className="text-lg sm:text-xl font-extrabold font-display text-stone-900"
              >
                استكشاف النماذج التسعة المترابطة للمجتمع النموذجي
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                انقر على أي نموذج من النماذج التسعة لاستعراض بياناته المترابطة بالمعرفات (IDs) وتجربة التقرير الختامي وتصدير PDF.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLC_FORMS_CATALOG.map((formEntry) => {
              const formStatus = completion.forms[formEntry.formNumber];
              const isSelected = demoActiveFormNumber === formEntry.formNumber;

              return (
                <article
                  key={formEntry.id}
                  data-testid={`plc-demo-form-card-${formEntry.formNumber}`}
                  onClick={() => setDemoActiveFormNumber(formEntry.formNumber)}
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-2 border-plc bg-plc-soft/60 shadow-xs'
                      : 'border-stone-200 bg-white hover:border-plc/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-plc">
                        النموذج {formEntry.formNumber}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-[#EEF5EE] text-[#2F6846] border border-[#C5DCC7] text-[11px] font-extrabold">
                        مكتمل للمعاينة
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      {formEntry.shortTitle}
                    </h4>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {formEntry.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-[11px] text-stone-600">
                    <span className="font-semibold truncate">
                      {formStatus.summaryText}
                    </span>
                    <ArrowLeft className="w-4 h-4 text-plc shrink-0" />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* شريط تلميح منهجي قصير وغير مزعج يوضح دور النموذج الحالي */}
        <div
          data-testid="plc-demo-form-hint"
          className="rounded-xl bg-plc-soft border border-plc-border px-4 py-3 text-xs sm:text-sm font-bold text-plc flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{PLC_DEMO_FORM_HINTS[demoActiveFormNumber]}</span>
        </div>

        {/* عرض النموذج المحدد باستخدام نفس مكونات المجتمعات الحقيقية في وضع القراءة فقط */}
        <PlcBatch2Forms
          community={demoCommunity}
          activeFormNumber={demoActiveFormNumber}
          onSelectFormNumber={(num) => setDemoActiveFormNumber(num)}
          onUpdateCommunity={() => {}}
          onShowBanner={showTemporaryBanner}
          settings={demoSettings}
          readOnly={true}
        />
      </div>
    );
  }

  // ==========================================================================
  // العرض ١: مساحة عمل مجتمع مفتوح (Workspace لمجتمع مستقل)
  // ==========================================================================
  if (activeCommunity) {
    const completion = computePlcFormsCompletionStatus(activeCommunity);
    const leader = getPlcCommunityLeader(activeCommunity);
    const meetingsOverview = computePlcMeetingsOverview(activeCommunity);
    const executionOverview = computePlcExecutionOverview(activeCommunity);

    return (
      <div className="space-y-6" data-testid="plc-community-workspace">
        {/* شريط التنقل العلوي داخل المجتمع المفتوح */}
        <div className="bg-white rounded-2xl border border-plc-border p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <button
              type="button"
              data-testid="plc-back-to-communities-btn"
              onClick={() => {
                setActiveCommunityId(null);
                setActiveFormNumber(null);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" />
              <span>العودة إلى صفحة مجتمعات التعلّم المهنية</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="plc-workspace-edit-basic-btn"
                onClick={() => handleOpenEditModal(activeCommunity)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-plc-border bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4 shrink-0" />
                <span>تعديل البيانات التأسيسية</span>
              </button>
            </div>
          </div>

          {bannerMessage && (
            <div
              data-testid="plc-workspace-banner"
              className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] px-4 py-3 text-xs sm:text-sm font-bold text-[#2F6846] flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#2F6846] shrink-0" />
              <span>{bannerMessage}</span>
            </div>
          )}

          {/* بطاقة تعريف المجتمع المفتوح */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-plc text-white text-xs font-extrabold">
                  سجل مجتمع مستقل
                </span>
                {renderStatusBadge(activeCommunity.status)}
                <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold tabular-nums">
                  العام الدراسي: {activeCommunity.academicYear || 'غير محدد'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold">
                  {PLC_SEMESTER_LABELS[activeCommunity.semester]}
                </span>
              </div>

              <h2
                data-testid="plc-active-community-title"
                className="text-2xl sm:text-3xl font-extrabold font-display text-stone-900"
              >
                {activeCommunity.name}
              </h2>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-stone-600 pt-1">
                <span className="inline-flex items-center gap-1.5 font-semibold text-plc">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>التخصص / المجال: {activeCommunity.specialty}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>
                    رئيس المجتمع:{' '}
                    <strong className="text-stone-900">
                      {leader ? `${leader.name} (${leader.jobRole})` : 'لم يُحدد بعد'}
                    </strong>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>عدد الأعضاء: {activeCommunity.members.length}</span>
                </span>
                {activeCommunity.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0 text-stone-500" />
                    <span>المكان: {activeCommunity.venue}</span>
                  </span>
                )}
                {activeCommunity.foundationDate && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Calendar className="w-4 h-4 shrink-0 text-stone-500" />
                    <span>تاريخ التأسيس: {activeCommunity.foundationDate}</span>
                  </span>
                )}
              </div>
            </div>

            {/* مؤشر اكتمال النماذج التسعة للمجتمع */}
            <div className="bg-plc-soft border border-plc-border rounded-2xl p-4 min-w-[240px] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-extrabold text-plc">
                <span>حالة اكتمال نماذج المجتمع</span>
                <span className="tabular-nums">
                  {completion.completedFormsCount} / 9 نماذج مكتملة
                </span>
              </div>
              <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-plc-border">
                <div
                  className="h-full bg-plc transition-all duration-300"
                  style={{ width: `${completion.overallCompletionPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-stone-600 tabular-nums">
                نسبة التقدم الإجمالية استناداً للبيانات المسجلة:{' '}
                <strong>{completion.overallCompletionPercentage}%</strong>
              </p>
              <button
                type="button"
                data-testid="plc-real-jump-to-report-btn"
                onClick={() => setActiveFormNumber(9)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>فتح التقرير الختامي وتصدير PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* بطاقتا ملخص الاجتماعات والتنفيذ في الصفحة الرئيسية للمجتمع الحالي (الدفعة الثالثة) */}
        <div
          data-testid="plc-community-batch3-summary-cards"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* ١. بطاقة الاجتماعات */}
          <div
            data-testid="plc-community-meetings-summary-card"
            className="bg-white rounded-2xl border border-stone-200/90 p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-plc-soft text-plc inline-flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      بطاقة الاجتماعات ومحاضرها
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      النموذج الخامس • ملخص الاجتماعات ومتابعة التوصيات
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
                  {meetingsOverview.totalMeetingsCount} اجتماع
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-500">
                    إجمالي التوصيات
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {meetingsOverview.totalRecommendationsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] p-2.5">
                  <div className="text-[11px] font-bold text-[#2F6846]">
                    تم التنفيذ
                  </div>
                  <div className="text-sm font-extrabold text-[#2F6846] tabular-nums mt-0.5">
                    {meetingsOverview.completedRecommendationsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FDF2ED] border border-[#E8C9BA] p-2.5">
                  <div className="text-[11px] font-bold text-[#9A4A2E]">
                    قيد التنفيذ
                  </div>
                  <div className="text-sm font-extrabold text-[#9A4A2E] tabular-nums mt-0.5">
                    {meetingsOverview.inProgressRecommendationsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-red-50/70 border border-red-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-red-800">
                    متأخر / لم يبدأ
                  </div>
                  <div className="text-sm font-extrabold text-red-900 tabular-nums mt-0.5">
                    {meetingsOverview.delayedRecommendationsCount +
                      meetingsOverview.notStartedRecommendationsCount}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5 text-xs text-stone-700 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-stone-900">آخر اجتماع:</strong>{' '}
                  {meetingsOverview.latestMeeting
                    ? `الاجتماع (${meetingsOverview.latestMeeting.meetingNumber}) — ${meetingsOverview.latestMeeting.meetingType || 'اجتماع دوري'}`
                    : 'لم يُسجل أي اجتماع بعد'}
                </span>
                {meetingsOverview.latestMeeting?.date && (
                  <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-[11px] font-bold text-stone-600 tabular-nums">
                    {meetingsOverview.latestMeeting.date}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end">
              <button
                type="button"
                data-testid="plc-summary-open-meetings-btn"
                onClick={() => setActiveFormNumber(5)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>فتح سجل الاجتماعات ومحاضرها</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ٢. بطاقة التنفيذ */}
          <div
            data-testid="plc-community-execution-summary-card"
            className="bg-white rounded-2xl border border-stone-200/90 p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-plc-soft text-plc inline-flex items-center justify-center">
                    <FolderKanban className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      بطاقة التنفيذ: البرامج والأنشطة والزيارات والشراكات
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      النموذج السادس • التوزيع حسب النوع وحالة التنفيذ الفعلية
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
                  {executionOverview.totalRecordsCount} سجل
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">
                    البرامج
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.programsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">
                    الأنشطة
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.activitiesCount}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">
                    الزيارات المتبادلة
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.mutualVisitsCount}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-2.5">
                  <div className="text-[11px] font-bold text-stone-600">
                    الشراكات المجتمعية
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums mt-0.5">
                    {executionOverview.partnershipsCount}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5 text-xs text-stone-700 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-[#2F6846]">منفذ فعلياً:</strong>{' '}
                  <span className="font-extrabold tabular-nums">
                    {executionOverview.completedCount}
                  </span>
                </span>
                <span>
                  <strong className="text-[#9A4A2E]">قيد التنفيذ:</strong>{' '}
                  <span className="font-extrabold tabular-nums">
                    {executionOverview.inProgressCount}
                  </span>
                </span>
                <span>
                  <strong className="text-stone-700">مخطط له (غير منفذ):</strong>{' '}
                  <span className="font-extrabold tabular-nums">
                    {executionOverview.plannedCount}
                  </span>
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end">
              <button
                type="button"
                data-testid="plc-summary-open-execution-btn"
                onClick={() => setActiveFormNumber(6)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>فتح سجل البرامج والأنشطة والزيارات والشراكات</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* خريطة النماذج التسعة المعتمدة وحالة اكتمال كل نموذج */}
        <section
          aria-labelledby="plc-nine-forms-heading"
          className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4">
            <div>
              <h3
                id="plc-nine-forms-heading"
                className="text-lg sm:text-xl font-extrabold font-display text-stone-900"
              >
                النماذج التسعة المعتمدة لمجتمع التعلّم المهني
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                جميع النماذج مرتبطة بسجل هذا المجتمع فقط ({activeCommunity.name})
                ومعزولة تماماً عن بقية المجتمعات.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLC_FORMS_CATALOG.map((formEntry) => {
              const formStatus = completion.forms[formEntry.formNumber];
              const isSelected = activeFormNumber === formEntry.formNumber;

              const stateBadge =
                formStatus.state === 'completed' ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-[#EEF5EE] text-[#2F6846] border border-[#C5DCC7] text-[11px] font-extrabold">
                    مكتمل
                  </span>
                ) : formStatus.state === 'in_progress' ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FDF2ED] text-[#9A4A2E] border border-[#E8C9BA] text-[11px] font-extrabold">
                    قيد الإعداد
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-bold">
                    لم يبدأ
                  </span>
                );

              return (
                <article
                  key={formEntry.id}
                  data-testid={`plc-form-card-${formEntry.formNumber}`}
                  onClick={() => setActiveFormNumber(formEntry.formNumber)}
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-2 border-plc bg-plc-soft/60 shadow-xs'
                      : 'border-stone-200 bg-white hover:border-plc/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-plc">
                        النموذج {formEntry.formNumber}
                      </span>
                      {stateBadge}
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      {formEntry.shortTitle}
                    </h4>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {formEntry.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-[11px] text-stone-600">
                    <span className="font-semibold truncate">
                      {formStatus.summaryText}
                    </span>
                    <ArrowLeft className="w-4 h-4 text-plc shrink-0" />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* النماذج التفاعلية المعتمدة للمجتمع المفتوح (الدفعة الثانية: النماذج ١ - ٤) */}
        <PlcBatch2Forms
          community={activeCommunity}
          activeFormNumber={activeFormNumber ?? 1}
          onSelectFormNumber={(num) => setActiveFormNumber(num)}
          onUpdateCommunity={(updater) =>
            setCommunities((prev) =>
              updatePlcCommunityInList(prev, activeCommunity.id, updater)
            )
          }
          onShowBanner={showTemporaryBanner}
          settings={settings}
        />

        {/* نافذة تعديل البيانات الأساسية للمجتمع */}
        {isModalOpen && renderCreateOrEditCommunityModal()}
      </div>
    );
  }

  // ==========================================================================
  // دالة مساعدة لرسم نافذة إنشاء / تعديل مجتمع
  // ==========================================================================
  function renderCreateOrEditCommunityModal() {
    return (
      <div
        data-testid="plc-community-modal"
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div className="bg-white rounded-2xl border border-plc-border max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-xl my-8">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <span className="text-xs font-extrabold text-plc">
                مجتمعات التعلّم المهنية
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
                {modalForm.editingCommunityId
                  ? 'تعديل بيانات مجتمع التعلّم المهني'
                  : 'إنشاء مجتمع تعلّم مهني جديد'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {modalError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm font-bold text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <form onSubmit={handleSaveCommunityModal} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="plc-modal-name"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  اسم المجتمع *
                </label>
                <input
                  id="plc-modal-name"
                  data-testid="plc-modal-name-input"
                  type="text"
                  required
                  value={modalForm.name}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="مثال: مجتمع معلمي العلوم للتقويم التكويني"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-modal-specialty"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  التخصص أو مجال المجتمع *
                </label>
                <input
                  id="plc-modal-specialty"
                  data-testid="plc-modal-specialty-input"
                  type="text"
                  required
                  value={modalForm.specialty}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      specialty: e.target.value,
                    }))
                  }
                  placeholder="مثال: العلوم الطبيعية / الرياضيات / استراتيجيات التدريس"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-modal-year"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  العام الدراسي (يُستمد من الإعدادات وقابل للتعديل)
                </label>
                <input
                  id="plc-modal-year"
                  data-testid="plc-modal-year-input"
                  type="text"
                  value={modalForm.academicYear}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      academicYear: e.target.value,
                    }))
                  }
                  placeholder="مثال: ١٤٤٧هـ"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-modal-semester"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  الفصل الدراسي
                </label>
                <select
                  id="plc-modal-semester"
                  data-testid="plc-modal-semester-select"
                  value={modalForm.semester}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      semester: e.target.value as PlcSemester,
                    }))
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                >
                  <option value="first">{PLC_SEMESTER_LABELS.first}</option>
                  <option value="second">{PLC_SEMESTER_LABELS.second}</option>
                  <option value="full_year">
                    {PLC_SEMESTER_LABELS.full_year}
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-modal-venue"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  مكان انعقاد المجتمع (اختياري)
                </label>
                <input
                  id="plc-modal-venue"
                  data-testid="plc-modal-venue-input"
                  type="text"
                  value={modalForm.venue}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, venue: e.target.value }))
                  }
                  placeholder="مثال: قاعة مصادر التعلم / قاعة الاجتماعات"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-modal-date"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  تاريخ التأسيس
                </label>
                <input
                  id="plc-modal-date"
                  data-testid="plc-modal-date-input"
                  type="date"
                  value={modalForm.foundationDate}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      foundationDate: e.target.value,
                    }))
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5">
                  حالة المجتمع:
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    ['active', 'paused', 'completed'] as PlcCommunityStatus[]
                  ).map((st) => {
                    const selected = modalForm.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        data-testid={`plc-modal-status-${st}`}
                        onClick={() =>
                          setModalForm((prev) => ({ ...prev, status: st }))
                        }
                        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-plc text-white border-plc'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {PLC_STATUS_LABELS[st]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* بيانات رئيس المجتمع (يُسجل تلقائياً في جدول الأعضاء بدور رئيس المجتمع دون سجل مكرر) */}
            <div className="bg-plc-soft/60 rounded-2xl border border-plc-border p-4 space-y-3">
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-plc">
                  بيانات رئيس المجتمع (يُسجل ضمن جدول الأعضاء تلقائياً)
                </h4>
                <p className="text-[11px] text-stone-600">
                  يمكنك تحديد رئيس المجتمع الآن أو تعيينه لاحقاً من جدول الأعضاء.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="plc-modal-leader-name"
                    className="block text-xs font-bold text-stone-800 mb-1"
                  >
                    اسم رئيس المجتمع
                  </label>
                  <input
                    id="plc-modal-leader-name"
                    data-testid="plc-modal-leader-name-input"
                    type="text"
                    value={modalForm.leaderName}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        leaderName: e.target.value,
                      }))
                    }
                    placeholder="اسم رئيس المجتمع"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plc-modal-leader-specialty"
                    className="block text-xs font-bold text-stone-800 mb-1"
                  >
                    التخصص
                  </label>
                  <input
                    id="plc-modal-leader-specialty"
                    data-testid="plc-modal-leader-specialty-input"
                    type="text"
                    value={modalForm.leaderSpecialty}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        leaderSpecialty: e.target.value,
                      }))
                    }
                    placeholder={modalForm.specialty || 'التخصص'}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plc-modal-leader-job"
                    className="block text-xs font-bold text-stone-800 mb-1"
                  >
                    الدور الوظيفي
                  </label>
                  <input
                    id="plc-modal-leader-job"
                    data-testid="plc-modal-leader-job-input"
                    type="text"
                    value={modalForm.leaderJobRole}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        leaderJobRole: e.target.value,
                      }))
                    }
                    placeholder="مثال: معلم متقدم"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs sm:text-sm font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                data-testid="plc-modal-submit-btn"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {modalForm.editingCommunityId
                    ? 'حفظ التعديلات'
                    : 'إنشاء المجتمع'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // العرض ٢: الصفحة الرئيسية لقسم «مجتمعات التعلّم المهنية»
  // ==========================================================================
  return (
    <section
      aria-labelledby="plc-main-page-heading"
      data-testid="plc-main-page"
      className="space-y-6"
    >
      {/* بطاقة ترويسة صفحة مجتمعات التعلّم المهنية */}
      <div className="bg-white rounded-2xl border border-plc-border p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-plc">
              <span className="px-3 py-1 rounded-lg bg-plc-soft border border-plc-border">
                قسم مستقل • ٩ نماذج مترابطة
              </span>
              {settings.academicYear && (
                <span className="px-3 py-1 rounded-lg bg-stone-100 text-stone-700 tabular-nums">
                  العام الدراسي: {settings.academicYear}
                </span>
              )}
            </div>

            <h2
              id="plc-main-page-heading"
              className="text-2xl sm:text-3xl font-extrabold font-display text-plc"
            >
              مجتمعات التعلّم المهنية
            </h2>

            <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-3xl">
              إدارة وتوثيق مجتمعات التعلّم المهنية داخل المدرسة في سجلات مستقلة
              تماماً، بدءاً من التأسيس والتخطيط وتحديد الاحتياجات والخطة التشغيلية،
              ومروراً بالاجتماعات والبرامج والشواهد وقياس الأثر، وصولاً إلى التقرير
              الختامي التلقائي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              data-testid="plc-create-community-btn"
              onClick={handleOpenCreateModal}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span>إنشاء مجتمع جديد</span>
            </button>

            <button
              type="button"
              data-testid="plc-open-school-aggregate-btn"
              disabled={communities.length === 0}
              onClick={() => setShowSchoolAggregateModal(true)}
              className="min-h-[48px] px-4 py-3 rounded-xl border border-plc-border bg-plc-soft hover:bg-plc-soft-hover disabled:opacity-50 text-plc text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>
                تقرير إجمالي للمدرسة (
                {selectedIdsForSchoolReport.length > 0
                  ? `${selectedIdsForSchoolReport.length} محدد`
                  : `كل المجتمعات: ${communities.length}`}
                )
              </span>
            </button>
          </div>
        </div>

        {/* مؤشرات إحصائية حقيقية من السجلات المحفوظة */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-100">
          <div className="rounded-xl bg-plc-soft/70 border border-plc-border p-3.5">
            <span className="block text-xs font-bold text-stone-600">
              إجمالي المجتمعات المسجلة
            </span>
            <span
              data-testid="plc-stat-total"
              className="text-2xl font-extrabold text-plc tabular-nums"
            >
              {communities.length}
            </span>
          </div>

          <div className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] p-3.5">
            <span className="block text-xs font-bold text-[#2F6846]">
              مجتمعات نشطة
            </span>
            <span
              data-testid="plc-stat-active"
              className="text-2xl font-extrabold text-[#2F6846] tabular-nums"
            >
              {communities.filter((c) => c.status === 'active').length}
            </span>
          </div>

          <div className="rounded-xl bg-[#FDF2ED] border border-[#E8C9BA] p-3.5">
            <span className="block text-xs font-bold text-[#9A4A2E]">
              متوقفة مؤقتًا
            </span>
            <span
              data-testid="plc-stat-paused"
              className="text-2xl font-extrabold text-[#9A4A2E] tabular-nums"
            >
              {communities.filter((c) => c.status === 'paused').length}
            </span>
          </div>

          <div className="rounded-xl bg-stone-100 border border-stone-200 p-3.5">
            <span className="block text-xs font-bold text-stone-700">
              مجتمعات مكتملة
            </span>
            <span
              data-testid="plc-stat-completed"
              className="text-2xl font-extrabold text-stone-900 tabular-nums"
            >
              {communities.filter((c) => c.status === 'completed').length}
            </span>
          </div>
        </div>

        {bannerMessage && (
          <div
            data-testid="plc-main-banner"
            className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] px-4 py-3 text-xs sm:text-sm font-bold text-[#2F6846] flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#2F6846] shrink-0" />
            <span>{bannerMessage}</span>
          </div>
        )}
      </div>

      {/* شريط البحث والفرز والتصفية وتحديد المجتمعات للتقرير المدرسي */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* حقل البحث */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="plc-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المجتمع أو التخصص أو رئيس المجتمع..."
              className="w-full min-h-[42px] pr-10 pl-3.5 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          {/* تصفية حسب الحالة */}
          <div className="md:col-span-3">
            <select
              aria-label="تصفية حسب حالة المجتمع"
              data-testid="plc-filter-status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as PlcCommunityStatus | 'all')
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 focus:outline-none focus:border-plc"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="paused">متوقف مؤقتًا</option>
              <option value="completed">مكتمل</option>
            </select>
          </div>

          {/* تصفية حسب الفصل الدراسي */}
          <div className="md:col-span-2">
            <select
              aria-label="تصفية حسب الفصل الدراسي"
              data-testid="plc-filter-semester"
              value={semesterFilter}
              onChange={(e) =>
                setSemesterFilter(e.target.value as PlcSemester | 'all')
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 focus:outline-none focus:border-plc"
            >
              <option value="all">جميع الفصول</option>
              <option value="first">الفصل الأول</option>
              <option value="second">الفصل الثاني</option>
              <option value="full_year">العام كاملًا</option>
            </select>
          </div>

          {/* الفرز */}
          <div className="md:col-span-2">
            <select
              aria-label="ترتيب المجتمعات"
              data-testid="plc-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PlcSortCriterion)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 focus:outline-none focus:border-plc"
            >
              <option value="newest">الأحدث إنشاءً</option>
              <option value="oldest">الأقدم إنشاءً</option>
              <option value="name_asc">الاسم (أ - ي)</option>
              <option value="academic_year">السنة الدراسية</option>
            </select>
          </div>
        </div>

        {communities.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="plc-select-all-btn"
                onClick={handleSelectAllFilteredForSchoolReport}
                className="font-bold text-plc hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>
                  تحديد / إلغاء تحديد المجتمعات المعروضة للتقرير المدرسي الإجمالي
                </span>
              </button>
            </div>
            <span className="tabular-nums">
              المعروض حالياً: {filteredCommunities.length} من أصل{' '}
              {communities.length}
            </span>
          </div>
        )}
      </div>

      {/* بطاقات المجتمعات المسجلة */}
      {communities.length === 0 ? (
        <div
          data-testid="plc-empty-state"
          className="bg-white rounded-2xl border border-dashed border-plc-border p-10 sm:p-14 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-plc-soft text-plc flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              لا توجد مجتمعات تعلّم مهنية مسجلة حالياً
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              ابدأ بإنشاء أول مجتمع تعلّم مهني في المدرسة. يُحفظ كل مجتمع في سجل
              مستقل تماماً مع أعضائه وخطته واجتماعاته وشواهده وتقريره الختامي.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              data-testid="plc-empty-create-btn"
              onClick={handleOpenCreateModal}
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>إنشاء مجتمع تعلّم مهني جديد</span>
            </button>
          </div>
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-600">
          لا توجد مجتمعات مطابقة لمعايير البحث أو التصفية الحالية.
        </div>
      ) : (
        <div
          data-testid="plc-communities-grid"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {filteredCommunities.map((community) => {
            const leader = getPlcCommunityLeader(community);
            const completion = computePlcFormsCompletionStatus(community);
            const isSelectedForReport = selectedIdsForSchoolReport.includes(
              community.id
            );
            const isConfirmingDelete = confirmDeleteId === community.id;

            return (
              <article
                key={community.id}
                data-testid={`plc-community-card-${community.id}`}
                className="bg-white rounded-2xl border border-plc-border hover:border-plc transition-all p-5 sm:p-6 flex flex-col justify-between gap-5 shadow-2xs"
              >
                <div className="space-y-4">
                  {/* السطر العلوي للبطاقة: تحديد للتقرير الإجمالي + الحالة + السنة الدراسية */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      data-testid={`plc-select-community-${community.id}`}
                      onClick={() =>
                        handleToggleSelectForSchoolReport(community.id)
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-plc cursor-pointer"
                    >
                      {isSelectedForReport ? (
                        <CheckSquare className="w-4 h-4 text-plc" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-400" />
                      )}
                      <span>تضمين في التقرير المدرسي</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold tabular-nums">
                        {community.academicYear || 'بدون عام'}
                      </span>
                      {renderStatusBadge(community.status)}
                    </div>
                  </div>

                  {/* اسم المجتمع والتخصص */}
                  <div className="space-y-1.5">
                    <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
                      {community.name}
                    </h3>
                    <p className="text-xs sm:text-sm font-bold text-plc">
                      التخصص / المجال: {community.specialty}
                    </p>
                  </div>

                  {/* تفاصيل مختصرة: رئيس المجتمع، عدد الأعضاء، الفصل الدراسي */}
                  <div className="grid grid-cols-2 gap-2.5 bg-plc-soft/50 rounded-xl p-3 border border-plc-border/60 text-xs text-stone-700">
                    <div>
                      <span className="text-stone-500 block">رئيس المجتمع:</span>
                      <strong className="text-stone-900">
                        {leader ? leader.name : 'غير محدد'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">عدد الأعضاء:</span>
                      <strong className="text-stone-900 tabular-nums">
                        {community.members.length} عضو
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">الفصل الدراسي:</span>
                      <strong className="text-stone-900">
                        {PLC_SEMESTER_LABELS[community.semester]}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">تاريخ التأسيس:</span>
                      <strong className="text-stone-900 tabular-nums">
                        {community.foundationDate || '—'}
                      </strong>
                    </div>
                  </div>

                  {/* شريط اكتمال النماذج التسعة */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-600 tabular-nums">
                      <span>اكتمال النماذج التسعة</span>
                      <span className="text-plc">
                        {completion.completedFormsCount} / 9 مكتمل (
                        {completion.overallCompletionPercentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-plc"
                        style={{
                          width: `${completion.overallCompletionPercentage}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* أزرار البطاقة */}
                {isConfirmingDelete ? (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-red-900">
                      هل أنت متأكد من حذف هذا المجتمع نهائياً؟
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`plc-confirm-delete-yes-${community.id}`}
                        onClick={() =>
                          handleConfirmDeleteCommunity(community.id)
                        }
                        className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-extrabold cursor-pointer"
                      >
                        نعم، حذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-bold cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      data-testid={`plc-open-community-${community.id}`}
                      onClick={() => {
                        setActiveCommunityId(community.id);
                        setActiveFormNumber(1);
                      }}
                      className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>فتح المجتمع وإدارة نماذجه</span>
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    </button>

                    <button
                      type="button"
                      data-testid={`plc-edit-community-${community.id}`}
                      onClick={() => handleOpenEditModal(community)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      title="تعديل بيانات المجتمع"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>تعديل</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`plc-delete-community-${community.id}`}
                      onClick={() => setConfirmDeleteId(community.id)}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 hover:bg-red-50 hover:text-red-700 text-stone-600 text-xs font-bold inline-flex items-center cursor-pointer"
                      title="حذف المجتمع"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* نافذة إنشاء أو تعديل مجتمع */}
      {isModalOpen && renderCreateOrEditCommunityModal()}

      {/* نافذة الملخص الإجمالي للمدرسة للمجتمعات المحددة */}
      {showSchoolAggregateModal && (
        <div
          data-testid="plc-school-aggregate-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-plc-border max-w-4xl w-full p-6 sm:p-7 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <span className="text-xs font-extrabold text-plc">
                  التقرير الإجمالي للمدرسة • {settings.schoolName || 'المدرسة'}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
                  ملخص مجتمعات التعلّم المهنية المحددة (
                  {schoolAggregateSummary.selectedCommunitiesCount} مجتمع)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSchoolAggregateModal(false)}
                className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-plc-soft border border-plc-border p-3">
                <span className="block text-xs text-stone-600">
                  المجتمعات المشمولة
                </span>
                <strong className="text-xl font-extrabold text-plc tabular-nums">
                  {schoolAggregateSummary.selectedCommunitiesCount}
                </strong>
              </div>
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <span className="block text-xs text-stone-600">
                  إجمالي الأعضاء
                </span>
                <strong className="text-xl font-extrabold text-stone-900 tabular-nums">
                  {schoolAggregateSummary.totalMembersCount}
                </strong>
              </div>
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <span className="block text-xs text-stone-600">
                  الاحتياجات المرصودة
                </span>
                <strong className="text-xl font-extrabold text-stone-900 tabular-nums">
                  {schoolAggregateSummary.totalNeedsCount}
                </strong>
              </div>
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                <span className="block text-xs text-stone-600">
                  نسبة تنفيذ الخطط المسجلة
                </span>
                <strong className="text-xl font-extrabold text-stone-900 tabular-nums">
                  {schoolAggregateSummary.planExecutionPercentage !== null
                    ? `${schoolAggregateSummary.planExecutionPercentage}%`
                    : 'بيانات غير كافية بعد'}
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-plc-soft text-plc border-b border-plc-border">
                    <th className="py-2.5 px-3 font-extrabold">اسم المجتمع</th>
                    <th className="py-2.5 px-3 font-extrabold">التخصص</th>
                    <th className="py-2.5 px-3 font-extrabold">العام</th>
                    <th className="py-2.5 px-3 font-extrabold">الحالة</th>
                    <th className="py-2.5 px-3 font-extrabold">رئيس المجتمع</th>
                    <th className="py-2.5 px-3 font-extrabold">الأعضاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {schoolAggregateSummary.communitiesBreakdown.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 px-3 font-bold text-stone-900">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {row.specialty}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700 tabular-nums">
                        {row.academicYear}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {row.statusLabel}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {row.leaderName}
                      </td>
                      <td className="py-2.5 px-3 font-bold tabular-nums">
                        {row.membersCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100 text-xs text-stone-500">
              <span>
                جميع الإحصاءات أعلاه مستخرجة من السجلات الفعلية المحفوظة دون
                بيانات مفترضة. سيتم تفعيل تصدير التقرير المدرسي الإجمالي بصيغة PDF
                في الدفعة الخامسة.
              </span>
              <button
                type="button"
                onClick={() => setShowSchoolAggregateModal(false)}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-plc text-white font-bold cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
