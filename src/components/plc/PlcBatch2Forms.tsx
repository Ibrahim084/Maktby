import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CheckSquare,
  Compass,
  Edit3,
  Filter,
  Flag,
  Layers,
  ListChecks,
  Plus,
  Save,
  Search,
  Sparkles,
  Square,
  Target,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  addPlcIdentityListItem,
  addPlcMember,
  addPlcNeedItem,
  addPlcPlanActionItem,
  deletePlcIdentityListItem,
  deletePlcMember,
  deletePlcNeedItem,
  deletePlcPlanActionItem,
  filterAndSortPlcNeeds,
  getPlcActionNeedIds,
  getPlcCommunityLeader,
  getPlcNeedSourceDisplayLabel,
  PLC_ACTION_STATUS_LABELS,
  PLC_FORMS_CATALOG,
  PLC_IDENTITY_SUGGESTIONS,
  PLC_MEMBER_ROLE_LABELS,
  PLC_NEED_SOURCE_LABELS,
  PLC_PRIORITY_LABELS,
  PLC_SEMESTER_LABELS,
  PLC_STATUS_LABELS,
  PlcActionExecutionStatus,
  PlcCommunityRecord,
  PlcCommunityStatus,
  PlcFormNumber,
  PlcIdentityListField,
  PlcIdentityListItem,
  PlcMember,
  PlcMemberRole,
  PlcNeedItem,
  PlcNeedSource,
  PlcPlanActionItem,
  PlcPriorityLevel,
  PlcSemester,
  reorderPlcIdentityListItem,
  resolvePlcPlanActionLinks,
  setPlcMemberAsLeader,
  updatePlcIdentityListItem,
  updatePlcMember,
  updatePlcNeedItem,
  updatePlcPlanActionItem,
} from '../../utils/plcEngine';
import { PlcBatch3Forms } from './PlcBatch3Forms';
import { PlcBatch4Forms } from './PlcBatch4Forms';
import { PlcBatch5FinalReport } from './PlcBatch5FinalReport';

interface PlcBatch2FormsProps {
  community: PlcCommunityRecord;
  activeFormNumber: PlcFormNumber;
  onSelectFormNumber: (formNumber: PlcFormNumber) => void;
  onUpdateCommunity: (
    updater: (current: PlcCommunityRecord) => PlcCommunityRecord
  ) => void;
  onShowBanner: (message: string) => void;
  settings: SchoolSettings;
  readOnly?: boolean;
}

export const PlcBatch2Forms: React.FC<PlcBatch2FormsProps> = ({
  community,
  activeFormNumber,
  onSelectFormNumber,
  onUpdateCommunity,
  onShowBanner,
  settings,
  readOnly = false,
}) => {
  // ==========================================================================
  // ١. حالات النموذج الأول: بيانات المجتمع وأعضاؤه
  // ==========================================================================
  const [basicName, setBasicName] = useState(community.name);
  const [basicSpecialty, setBasicSpecialty] = useState(community.specialty);
  const [basicAcademicYear, setBasicAcademicYear] = useState(
    community.academicYear || settings.academicYear || '١٤٤٧هـ'
  );
  const [basicSemester, setBasicSemester] = useState<PlcSemester>(
    community.semester
  );
  const [basicVenue, setBasicVenue] = useState(community.venue);
  const [basicFoundationDate, setBasicFoundationDate] = useState(
    community.foundationDate
  );
  const [basicStatus, setBasicStatus] = useState<PlcCommunityStatus>(
    community.status
  );

  // مزامنة الحقول عند تبديل المجتمع المفتوح أو تعديله من النافذة
  useEffect(() => {
    setBasicName(community.name);
    setBasicSpecialty(community.specialty);
    setBasicAcademicYear(
      community.academicYear || settings.academicYear || '١٤٤٧هـ'
    );
    setBasicSemester(community.semester);
    setBasicVenue(community.venue);
    setBasicFoundationDate(community.foundationDate);
    setBasicStatus(community.status);
  }, [
    community.id,
    community.name,
    community.specialty,
    community.academicYear,
    community.semester,
    community.venue,
    community.foundationDate,
    community.status,
    settings.academicYear,
  ]);

  // حالة نموذج إضافة / تعديل عضو في النموذج الأول
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberSpecialty, setMemberSpecialty] = useState('');
  const [memberJobRole, setMemberJobRole] = useState('معلم');
  const [memberRoles, setMemberRoles] = useState<PlcMemberRole[]>(['member']);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberNotes, setMemberNotes] = useState('');

  // ==========================================================================
  // ٢. حالات النموذج الثاني: التعريف بالمجتمع
  // ==========================================================================
  const [newGoalText, setNewGoalText] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalText, setEditingGoalText] = useState('');

  const [newValueText, setNewValueText] = useState('');
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueText, setEditingValueText] = useState('');

  const [newPrincipleText, setNewPrincipleText] = useState('');
  const [editingPrincipleId, setEditingPrincipleId] = useState<string | null>(
    null
  );
  const [editingPrincipleText, setEditingPrincipleText] = useState('');

  // ==========================================================================
  // ٣. حالات النموذج الثالث: الاحتياجات والأولويات
  // ==========================================================================
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  const [needDescription, setNeedDescription] = useState('');
  const [needSource, setNeedSource] =
    useState<PlcNeedSource>('student_results');
  const [needCustomSource, setNeedCustomSource] = useState('');
  const [needJustification, setNeedJustification] = useState('');
  const [needPriority, setNeedPriority] = useState<PlcPriorityLevel>('high');
  const [needProposedAction, setNeedProposedAction] = useState('');
  const [needLinkedGoalIds, setNeedLinkedGoalIds] = useState<string[]>([]);
  const [needNotes, setNeedNotes] = useState('');

  // بحث وتصفية وترتيب جدول الاحتياجات
  const [needsSearchQuery, setNeedsSearchQuery] = useState('');
  const [needsPriorityFilter, setNeedsPriorityFilter] = useState<
    PlcPriorityLevel | 'all'
  >('all');
  const [needsSourceFilter, setNeedsSourceFilter] = useState<
    PlcNeedSource | 'all'
  >('all');
  const [needsSortByPriority, setNeedsSortByPriority] = useState(true);

  // ==========================================================================
  // ٤. حالات النموذج الرابع: الخطة التشغيلية
  // ==========================================================================
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionGoalId, setActionGoalId] = useState('');
  const [quickNewGoalText, setQuickNewGoalText] = useState('');
  const [showQuickGoalInput, setShowQuickGoalInput] = useState(false);

  const [actionNeedIds, setActionNeedIds] = useState<string[]>([]);
  const [actionTitle, setActionTitle] = useState('');
  const [actionResponsibleMemberId, setActionResponsibleMemberId] =
    useState('');
  const [actionResponsibleCustomName, setActionResponsibleCustomName] =
    useState('');
  const [actionStartDate, setActionStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [actionEndDate, setActionEndDate] = useState('');
  const [actionResources, setActionResources] = useState('');
  const [actionIndicatorText, setActionIndicatorText] = useState('');
  const [actionStatus, setActionStatus] =
    useState<PlcActionExecutionStatus>('not_started');
  const [actionCompletionPercentage, setActionCompletionPercentage] =
    useState<string>('');
  const [actionNotes, setActionNotes] = useState('');

  // تصفية الخطة التشغيلية
  const [planStatusFilter, setPlanStatusFilter] = useState<
    PlcActionExecutionStatus | 'all'
  >('all');
  const [planSearchQuery, setPlanSearchQuery] = useState('');

  // ==========================================================================
  // الدوال المساعدة للنموذج الأول
  // ==========================================================================
  const leader = useMemo(
    () => getPlcCommunityLeader(community),
    [community]
  );

  const updateBasicFieldImmediately = (
    partial: Partial<
      Pick<
        PlcCommunityRecord,
        | 'name'
        | 'specialty'
        | 'academicYear'
        | 'semester'
        | 'venue'
        | 'foundationDate'
        | 'status'
      >
    >
  ) => {
    onUpdateCommunity((current) => ({
      ...current,
      ...partial,
      name:
        partial.name !== undefined && partial.name.trim()
          ? partial.name.trim()
          : current.name,
      specialty:
        partial.specialty !== undefined && partial.specialty.trim()
          ? partial.specialty.trim()
          : current.specialty,
    }));
  };

  const handleSaveBasicInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!basicName.trim() || !basicSpecialty.trim()) return;

    onUpdateCommunity((current) => ({
      ...current,
      name: basicName.trim(),
      specialty: basicSpecialty.trim(),
      academicYear:
        basicAcademicYear.trim() || settings.academicYear || '١٤٤٧هـ',
      semester: basicSemester,
      venue: basicVenue.trim(),
      foundationDate: basicFoundationDate.trim(),
      status: basicStatus,
    }));
    onShowBanner('تم حفظ البيانات الأساسية للمجتمع في النموذج الأول بنجاح.');
  };

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setMemberName('');
    setMemberSpecialty('');
    setMemberJobRole('معلم');
    setMemberRoles(['member']);
    setMemberEmail('');
    setMemberPhone('');
    setMemberNotes('');
  };

  const handleToggleMemberRole = (role: PlcMemberRole) => {
    setMemberRoles((prev) => {
      if (prev.includes(role)) {
        const next = prev.filter((r) => r !== role);
        return next.length > 0 ? next : ['member'];
      }
      return [...prev, role];
    });
  };

  const handleSubmitMemberForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    const resolvedSpecialty =
      memberSpecialty.trim() ||
      community.specialty.trim() ||
      '';

    onUpdateCommunity((current) => {
      if (editingMemberId) {
        return {
          ...current,
          members: updatePlcMember(current.members, editingMemberId, {
            name: memberName,
            specialty: resolvedSpecialty,
            jobRole: memberJobRole,
            roles: memberRoles,
            email: memberEmail,
            phone: memberPhone,
            notes: memberNotes,
          }),
        };
      }
      return {
        ...current,
        members: addPlcMember(current.members, {
          name: memberName,
          specialty: resolvedSpecialty,
          jobRole: memberJobRole,
          roles: memberRoles,
          email: memberEmail,
          phone: memberPhone,
          notes: memberNotes,
        }),
      };
    });

    const wasEditing = Boolean(editingMemberId);
    resetMemberForm();
    onShowBanner(
      wasEditing
        ? 'تم تحديث بيانات العضو في جدول أعضاء المجتمع.'
        : 'تمت إضافة العضو إلى جدول أعضاء المجتمع بنجاح.'
    );
  };

  const handleStartEditMember = (mbr: PlcMember) => {
    setEditingMemberId(mbr.id);
    setMemberName(mbr.name);
    setMemberSpecialty(mbr.specialty);
    setMemberJobRole(mbr.jobRole || 'معلم');
    setMemberRoles(mbr.roles.length > 0 ? mbr.roles : ['member']);
    setMemberEmail(mbr.email || '');
    setMemberPhone(mbr.phone || '');
    setMemberNotes(mbr.notes || '');
  };

  const handleRemoveMember = (memberId: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      members: deletePlcMember(current.members, memberId),
    }));
    if (editingMemberId === memberId) {
      resetMemberForm();
    }
    onShowBanner('تم حذف العضو من جدول المجتمع.');
  };

  const handleQuickAssignLeader = (memberId: string) => {
    if (!memberId) return;
    onUpdateCommunity((current) => ({
      ...current,
      members: setPlcMemberAsLeader(current.members, memberId),
    }));
    onShowBanner(
      'تم تعيين رئيس المجتمع تلقائياً من جدول الأعضاء دون تكرار السجل.'
    );
  };

  // ==========================================================================
  // الدوال المساعدة للنموذج الثاني (التعريف بالمجتمع)
  // ==========================================================================
  const handleUpdateVision = (newVision: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      identity: {
        ...current.identity,
        vision: newVision,
      },
    }));
  };

  const handleUpdateMission = (newMission: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      identity: {
        ...current.identity,
        mission: newMission,
      },
    }));
  };

  const handleAddIdentityItem = (
    field: PlcIdentityListField,
    text: string,
    clearInput: () => void
  ) => {
    if (!text.trim()) return;
    const prefixMap: Record<PlcIdentityListField, string> = {
      goals: 'goal',
      values: 'val',
      principles: 'prn',
    };
    onUpdateCommunity((current) => ({
      ...current,
      identity: {
        ...current.identity,
        [field]: addPlcIdentityListItem(
          current.identity[field],
          text,
          prefixMap[field]
        ),
      },
    }));
    clearInput();
  };

  const handleSaveEditedIdentityItem = (
    field: PlcIdentityListField,
    itemId: string,
    newText: string,
    clearEditing: () => void
  ) => {
    if (!newText.trim()) return;
    onUpdateCommunity((current) => ({
      ...current,
      identity: {
        ...current.identity,
        [field]: updatePlcIdentityListItem(
          current.identity[field],
          itemId,
          newText
        ),
      },
    }));
    clearEditing();
    onShowBanner('تم حفظ التعديل بنجاح.');
  };

  const handleDeleteIdentityItem = (
    field: PlcIdentityListField,
    itemId: string
  ) => {
    onUpdateCommunity((current) => ({
      ...current,
      identity: {
        ...current.identity,
        [field]: deletePlcIdentityListItem(current.identity[field], itemId),
      },
    }));
  };

  const handleReorderIdentityItem = (
    field: PlcIdentityListField,
    itemId: string,
    direction: 'up' | 'down'
  ) => {
    onUpdateCommunity((current) => ({
      ...current,
      identity: {
        ...current.identity,
        [field]: reorderPlcIdentityListItem(
          current.identity[field],
          itemId,
          direction
        ),
      },
    }));
  };

  // ==========================================================================
  // الدوال المساعدة للنموذج الثالث (الاحتياجات والأولويات)
  // ==========================================================================
  const filteredNeeds = useMemo(
    () =>
      filterAndSortPlcNeeds(community.needs, {
        searchQuery: needsSearchQuery,
        priorityFilter: needsPriorityFilter,
        sourceFilter: needsSourceFilter,
        sortByPriority: needsSortByPriority,
      }),
    [
      community.needs,
      needsSearchQuery,
      needsPriorityFilter,
      needsSourceFilter,
      needsSortByPriority,
    ]
  );

  const resetNeedForm = () => {
    setEditingNeedId(null);
    setNeedDescription('');
    setNeedSource('student_results');
    setNeedCustomSource('');
    setNeedJustification('');
    setNeedPriority('high');
    setNeedProposedAction('');
    setNeedLinkedGoalIds([]);
    setNeedNotes('');
  };

  const handleSubmitNeedForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!needDescription.trim()) return;

    onUpdateCommunity((current) => {
      if (editingNeedId) {
        return {
          ...current,
          needs: updatePlcNeedItem(
            current.needs,
            editingNeedId,
            {
              description: needDescription,
              source: needSource,
              customSource: needCustomSource,
              justification: needJustification,
              priority: needPriority,
              proposedAction: needProposedAction,
              linkedGoalIds: needLinkedGoalIds,
              notes: needNotes,
            },
            needsSortByPriority
          ),
        };
      }
      return {
        ...current,
        needs: addPlcNeedItem(
          current.needs,
          {
            description: needDescription,
            source: needSource,
            customSource: needCustomSource,
            justification: needJustification,
            priority: needPriority,
            proposedAction: needProposedAction,
            linkedGoalIds: needLinkedGoalIds,
            notes: needNotes,
          },
          needsSortByPriority
        ),
      };
    });

    const wasEditing = Boolean(editingNeedId);
    resetNeedForm();
    onShowBanner(
      wasEditing
        ? 'تم تحديث بيانات الاحتياج المهني وترتيب الأولويات.'
        : 'تمت إضافة الاحتياج المهني وترتيبه حسب الأولوية بنجاح.'
    );
  };

  const handleStartEditNeed = (need: PlcNeedItem) => {
    setEditingNeedId(need.id);
    setNeedDescription(need.description);
    setNeedSource(need.source);
    setNeedCustomSource(need.customSource || '');
    setNeedJustification(need.justification);
    setNeedPriority(need.priority);
    setNeedProposedAction(need.proposedAction);
    setNeedLinkedGoalIds(need.linkedGoalIds || []);
    setNeedNotes(need.notes || '');
  };

  const handleDeleteNeed = (needId: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      needs: deletePlcNeedItem(current.needs, needId),
    }));
    if (editingNeedId === needId) {
      resetNeedForm();
    }
    onShowBanner('تم حذف الاحتياج المهني من السجل.');
  };

  // ==========================================================================
  // الدوال المساعدة للنموذج الرابع (الخطة التشغيلية)
  // ==========================================================================
  const resetActionForm = () => {
    setEditingActionId(null);
    setActionGoalId('');
    setQuickNewGoalText('');
    setShowQuickGoalInput(false);
    setActionNeedIds([]);
    setActionTitle('');
    setActionResponsibleMemberId('');
    setActionResponsibleCustomName('');
    setActionStartDate(new Date().toISOString().slice(0, 10));
    setActionEndDate('');
    setActionResources('');
    setActionIndicatorText('');
    setActionStatus('not_started');
    setActionCompletionPercentage('');
    setActionNotes('');
  };

  const handleToggleActionNeedSelection = (needId: string) => {
    setActionNeedIds((prev) =>
      prev.includes(needId)
        ? prev.filter((id) => id !== needId)
        : [...prev, needId]
    );
  };

  const handleQuickCreateGoalForPlan = () => {
    if (!quickNewGoalText.trim()) return;
    let createdGoalId = '';
    onUpdateCommunity((current) => {
      const updatedGoals = addPlcIdentityListItem(
        current.identity.goals,
        quickNewGoalText.trim(),
        'goal'
      );
      const newest = updatedGoals[updatedGoals.length - 1];
      if (newest) createdGoalId = newest.id;
      return {
        ...current,
        identity: {
          ...current.identity,
          goals: updatedGoals,
        },
      };
    });
    if (createdGoalId) {
      setActionGoalId(createdGoalId);
    }
    setQuickNewGoalText('');
    setShowQuickGoalInput(false);
    onShowBanner(
      'تمت إضافة الهدف الجديد إلى أهداف المجتمع (النموذج الثاني) وربطه بالإجراء الحالي.'
    );
  };

  const handleSubmitActionForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim()) return;

    const selectedMember = community.members.find(
      (m) => m.id === actionResponsibleMemberId
    );
    const resolvedResponsibleName =
      selectedMember?.name || actionResponsibleCustomName.trim() || 'غير محدد';

    const parsedPct =
      actionCompletionPercentage.trim() !== ''
        ? Number(actionCompletionPercentage)
        : null;

    onUpdateCommunity((current) => {
      if (editingActionId) {
        return {
          ...current,
          operationalPlan: updatePlcPlanActionItem(
            current.operationalPlan,
            editingActionId,
            {
              goalId: actionGoalId,
              needIds: actionNeedIds,
              title: actionTitle,
              responsibleMemberId: actionResponsibleMemberId,
              responsibleName: resolvedResponsibleName,
              startDate: actionStartDate,
              endDate: actionEndDate,
              resources: actionResources,
              indicatorText: actionIndicatorText,
              status: actionStatus,
              completionPercentage: parsedPct,
              notes: actionNotes,
            }
          ),
        };
      }
      return {
        ...current,
        operationalPlan: addPlcPlanActionItem(current.operationalPlan, {
          goalId: actionGoalId,
          needIds: actionNeedIds,
          title: actionTitle,
          responsibleMemberId: actionResponsibleMemberId,
          responsibleName: resolvedResponsibleName,
          startDate: actionStartDate,
          endDate: actionEndDate,
          resources: actionResources,
          indicatorText: actionIndicatorText,
          status: actionStatus,
          completionPercentage: parsedPct,
          notes: actionNotes,
        }),
      };
    });

    const wasEditing = Boolean(editingActionId);
    resetActionForm();
    onShowBanner(
      wasEditing
        ? 'تم تحديث بيانات الإجراء في الخطة التشغيلية.'
        : 'تمت إضافة الإجراء إلى الخطة التشغيلية وربطه بالأهداف والاحتياجات بنجاح.'
    );
  };

  const handleStartEditAction = (action: PlcPlanActionItem) => {
    const validGoalExists = community.identity.goals.some(
      (g) => g.id === action.goalId
    );
    const validNeedIds = getPlcActionNeedIds(action).filter((nId) =>
      community.needs.some((n) => n.id === nId)
    );
    const validMember = action.responsibleMemberId
      ? community.members.find((m) => m.id === action.responsibleMemberId) ??
        null
      : null;

    setEditingActionId(action.id);
    setActionGoalId(validGoalExists ? action.goalId : '');
    setActionNeedIds(validNeedIds);
    setActionTitle(action.title);
    setActionResponsibleMemberId(validMember ? validMember.id : '');
    setActionResponsibleCustomName(
      validMember
        ? validMember.name
        : action.responsibleMemberId
          ? ''
          : action.responsibleName || ''
    );
    setActionStartDate(action.startDate || '');
    setActionEndDate(action.endDate || '');
    setActionResources(action.resources || '');
    setActionIndicatorText(action.indicatorText || '');
    setActionStatus(action.status);
    setActionCompletionPercentage(
      action.completionPercentage !== null &&
        action.completionPercentage !== undefined
        ? String(action.completionPercentage)
        : ''
    );
    setActionNotes(action.notes || '');
  };

  const handleDeleteAction = (actionId: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      operationalPlan: deletePlcPlanActionItem(
        current.operationalPlan,
        actionId
      ),
    }));
    if (editingActionId === actionId) {
      resetActionForm();
    }
    onShowBanner('تم حذف الإجراء من الخطة التشغيلية.');
  };

  const handleInlineUpdateActionStatus = (
    actionId: string,
    nextStatus: PlcActionExecutionStatus
  ) => {
    onUpdateCommunity((current) => ({
      ...current,
      operationalPlan: updatePlcPlanActionItem(
        current.operationalPlan,
        actionId,
        { status: nextStatus }
      ),
    }));
    onShowBanner('تم تحديث حالة تنفيذ الإجراء في الخطة التشغيلية.');
  };

  const handleInlineUpdateActionPercentage = (
    actionId: string,
    rawVal: string
  ) => {
    const parsed = rawVal.trim() === '' ? null : Number(rawVal);
    onUpdateCommunity((current) => ({
      ...current,
      operationalPlan: updatePlcPlanActionItem(
        current.operationalPlan,
        actionId,
        { completionPercentage: parsed }
      ),
    }));
  };

  const filteredPlanActions = useMemo(() => {
    const q = planSearchQuery.trim().toLowerCase();
    return community.operationalPlan.filter((action) => {
      if (planStatusFilter !== 'all' && action.status !== planStatusFilter) {
        return false;
      }
      if (q) {
        const resolved = resolvePlcPlanActionLinks(action, community);
        const haystack = [
          action.title,
          action.resources,
          action.indicatorText,
          resolved.goalText,
          resolved.responsibleDisplayName,
          ...resolved.linkedNeeds.map((ln) => ln.need.description),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [community, planStatusFilter, planSearchQuery]);

  // الاحتياجات المختارة حالياً في نموذج الخطة التشغيلية لعرض وصفها ومستوى أولويتها فوراً
  const selectedNeedsPreviewForPlan = useMemo(
    () =>
      actionNeedIds
        .map((id) => community.needs.find((n) => n.id === id))
        .filter((n): n is PlcNeedItem => Boolean(n)),
    [actionNeedIds, community.needs]
  );

  const renderPriorityBadge = (priority: PlcPriorityLevel) => {
    if (priority === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-red-50 text-red-800 border border-red-200 text-xs font-extrabold">
          <span>أولوية: {PLC_PRIORITY_LABELS.high}</span>
        </span>
      );
    }
    if (priority === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-extrabold">
          <span>أولوية: {PLC_PRIORITY_LABELS.medium}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold">
        <span>أولوية: {PLC_PRIORITY_LABELS.low}</span>
      </span>
    );
  };

  // ==========================================================================
  // أزرار التنقل السفلي بين النماذج (النموذج السابق / النموذج التالي)
  // ==========================================================================
  const renderFormNavigationFooter = () => {
    const prevForm =
      activeFormNumber > 1 ? ((activeFormNumber - 1) as PlcFormNumber) : null;
    const nextForm =
      activeFormNumber < 6 ? ((activeFormNumber + 1) as PlcFormNumber) : null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
        <div>
          {prevForm ? (
            <button
              type="button"
              data-testid={`plc-prev-form-btn-${prevForm}`}
              onClick={() => onSelectFormNumber(prevForm)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" />
              <span>
                الانتقال إلى{' '}
                {PLC_FORMS_CATALOG.find((f) => f.formNumber === prevForm)
                  ?.shortTitle ?? ''}
              </span>
            </button>
          ) : (
            <span className="text-xs text-stone-500">
              أنت في النموذج التأسيسي الأول للمجتمع
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {nextForm && (
            <button
              type="button"
              data-testid={`plc-next-form-btn-${nextForm}`}
              onClick={() => onSelectFormNumber(nextForm)}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>
                الانتقال إلى{' '}
                {PLC_FORMS_CATALOG.find((f) => f.formNumber === nextForm)
                  ?.shortTitle ?? ''}
              </span>
              <ArrowLeft className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // العرض 1: النموذج الأول — بيانات المجتمع وأعضاؤه
  // ==========================================================================
  if (activeFormNumber === 1) {
    return (
      <section
        data-testid="plc-form-1-container"
        className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
              <Users className="w-3.5 h-3.5" />
              <span>الدفعة الثانية: البيانات والتخطيط • النموذج ١ من ٤</span>
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              النموذج الأول: بيانات المجتمع وأعضاؤه
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              إدارة البيانات الأساسية للمجتمع، وتحديد رئيس المجتمع من جدول الأعضاء
              دون تكرار السجلات، وتحديد أدوار ومسؤوليات الأعضاء.
            </p>
          </div>
        </div>

        {/* أ) بيانات المجتمع الأساسية */}
        <form
          onSubmit={handleSaveBasicInfo}
          data-testid="plc-form1-basic-info-form"
          className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-3">
            <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
              أولًا: بيانات المجتمع الأساسية
            </h4>
            <span className="text-[11px] font-bold text-stone-500">
              مرتبط بمعرّف المجتمع المستقل: {community.id}
            </span>
          </div>

          <fieldset disabled={readOnly} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="plc-f1-name"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                اسم المجتمع *
              </label>
              <input
                id="plc-f1-name"
                data-testid="plc-f1-name-input"
                type="text"
                required
                value={basicName}
                onChange={(e) => {
                  const v = e.target.value;
                  setBasicName(v);
                  if (v.trim()) updateBasicFieldImmediately({ name: v.trim() });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f1-specialty"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                التخصص أو مجال المجتمع *
              </label>
              <input
                id="plc-f1-specialty"
                data-testid="plc-f1-specialty-input"
                type="text"
                required
                value={basicSpecialty}
                onChange={(e) => {
                  const v = e.target.value;
                  setBasicSpecialty(v);
                  if (v.trim())
                    updateBasicFieldImmediately({ specialty: v.trim() });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="plc-f1-academic-year"
                  className="block text-xs font-extrabold text-stone-800"
                >
                  العام الدراسي *
                </label>
                {!readOnly &&
                  settings.academicYear &&
                  basicAcademicYear !== settings.academicYear && (
                    <button
                      type="button"
                      onClick={() => {
                        setBasicAcademicYear(settings.academicYear);
                        updateBasicFieldImmediately({
                          academicYear: settings.academicYear,
                        });
                      }}
                      className="text-[11px] font-bold text-plc hover:underline cursor-pointer"
                    >
                      جلب من بيانات المدرسة ({settings.academicYear})
                    </button>
                  )}
              </div>
              <input
                id="plc-f1-academic-year"
                data-testid="plc-f1-year-input"
                type="text"
                required
                value={basicAcademicYear}
                onChange={(e) => {
                  const v = e.target.value;
                  setBasicAcademicYear(v);
                  updateBasicFieldImmediately({ academicYear: v.trim() });
                }}
                placeholder="مثال: ١٤٤٧هـ"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f1-semester"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                الفصل الدراسي
              </label>
              <select
                id="plc-f1-semester"
                data-testid="plc-f1-semester-select"
                value={basicSemester}
                onChange={(e) => {
                  const v = e.target.value as PlcSemester;
                  setBasicSemester(v);
                  updateBasicFieldImmediately({ semester: v });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
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
                htmlFor="plc-f1-venue"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                مكان انعقاد المجتمع (اختياري)
              </label>
              <input
                id="plc-f1-venue"
                data-testid="plc-f1-venue-input"
                type="text"
                value={basicVenue}
                onChange={(e) => {
                  const v = e.target.value;
                  setBasicVenue(v);
                  updateBasicFieldImmediately({ venue: v.trim() });
                }}
                placeholder="مثال: قاعة التطوير المهني / مصادر التعلم"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f1-foundation-date"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                تاريخ تأسيس المجتمع
              </label>
              <input
                id="plc-f1-foundation-date"
                data-testid="plc-f1-date-input"
                type="date"
                value={basicFoundationDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setBasicFoundationDate(v);
                  updateBasicFieldImmediately({ foundationDate: v.trim() });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f1-status"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                حالة المجتمع
              </label>
              <select
                id="plc-f1-status"
                data-testid="plc-f1-status-select"
                value={basicStatus}
                onChange={(e) => {
                  const v = e.target.value as PlcCommunityStatus;
                  setBasicStatus(v);
                  updateBasicFieldImmediately({ status: v });
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
              >
                <option value="active">{PLC_STATUS_LABELS.active}</option>
                <option value="paused">{PLC_STATUS_LABELS.paused}</option>
                <option value="completed">{PLC_STATUS_LABELS.completed}</option>
              </select>
            </div>
          </fieldset>

          {!readOnly && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                data-testid="plc-f1-save-basic-btn"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>حفظ بيانات المجتمع الأساسية</span>
              </button>
            </div>
          )}
        </form>

        {/* ب) خانة رئيس المجتمع (مرتبطة عضوياً بجدول الأعضاء دون تكرار السجلات) */}
        <div
          data-testid="plc-f1-leader-card"
          className="rounded-2xl border border-plc-border bg-plc-soft/60 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-plc-border/70 pb-3">
            <div className="space-y-0.5">
              <h4 className="text-sm sm:text-base font-extrabold text-plc flex items-center gap-2">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>ثانيًا: خانة رئيس المجتمع (مُستخرجة تلقائياً من جدول الأعضاء)</span>
              </h4>
              <p className="text-xs text-stone-600">
                رئيس المجتمع عضو داخل جدول الأعضاء نفسه وليس سجلاً منفصلاً مكرراً.
                عند تحديد أي عضو بصفته «رئيس المجتمع» تظهر بياناته هنا تلقائياً.
              </p>
            </div>

            {!readOnly && community.members.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="plc-f1-leader-select"
                  className="text-xs font-extrabold text-stone-800 whitespace-nowrap"
                >
                  تحديد الرئيس من الأعضاء:
                </label>
                <select
                  id="plc-f1-leader-select"
                  data-testid="plc-f1-quick-leader-select"
                  value={leader?.id || ''}
                  onChange={(e) => handleQuickAssignLeader(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-plc/40 bg-white text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-plc"
                >
                  <option value="" disabled>
                    -- اختر عضواً ليكون رئيس المجتمع --
                  </option>
                  {community.members.map((mbr) => (
                    <option key={mbr.id} value={mbr.id}>
                      {mbr.name} ({mbr.specialty || 'بدون تخصص'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {leader ? (
            <div
              data-testid="plc-f1-leader-details"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white rounded-xl border border-plc-border p-3.5 text-xs sm:text-sm"
            >
              <div>
                <span className="text-stone-500 block text-[11px] font-bold">
                  اسم رئيس المجتمع
                </span>
                <strong className="text-stone-900 font-extrabold">
                  {leader.name}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px] font-bold">
                  التخصص / الدور الوظيفي
                </span>
                <strong className="text-stone-800">
                  {leader.specialty || community.specialty} •{' '}
                  {leader.jobRole || 'معلم'}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px] font-bold">
                  المسؤوليات المسندة
                </span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {leader.roles.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded-md bg-plc-soft text-plc text-[11px] font-extrabold"
                    >
                      {PLC_MEMBER_ROLE_LABELS[r]}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px] font-bold">
                  بيانات التواصل / الملاحظات
                </span>
                <span className="text-stone-700 tabular-nums">
                  {[leader.phone, leader.email, leader.notes]
                    .filter(Boolean)
                    .join(' • ') || '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white border border-dashed border-plc-border p-4 text-xs sm:text-sm text-stone-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-plc shrink-0" />
              <span>
                لم يُحدد رئيس المجتمع بعد. أضف الأعضاء في الجدول أدناه واختر مسؤولية
                «رئيس المجتمع» لأحدهم أو اختره من القائمة أعلاه.
              </span>
            </div>
          )}
        </div>

        {/* ج) جدول الأعضاء الديناميكي */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
                ثالثًا: جدول أعضاء المجتمع والأدوار والمسؤوليات
              </h4>
              <p className="text-xs text-stone-600">
                يمكن إسناد أكثر من مسؤولية لعضو واحد (رئيس المجتمع، منسق، مقرر، عضو،
                مسؤول متابعة).
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
              إجمالي الأعضاء المسجلين: {community.members.length}
            </span>
          </div>

          {!readOnly && (
          <form
            onSubmit={handleSubmitMemberForm}
            data-testid="plc-f1-member-form"
            className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="plc-f1-mbr-name"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  اسم العضو *
                </label>
                <input
                  id="plc-f1-mbr-name"
                  data-testid="plc-member-name-input"
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="الاسم الثلاثي أو الرباعي"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="plc-f1-mbr-specialty"
                    className="block text-xs font-extrabold text-stone-800"
                  >
                    التخصص
                  </label>
                  {community.specialty && (
                    <button
                      type="button"
                      onClick={() =>
                        setMemberSpecialty(community.specialty || '')
                      }
                      className="text-[11px] font-bold text-plc hover:underline cursor-pointer"
                    >
                      تعبئة تلقائية ({community.specialty})
                    </button>
                  )}
                </div>
                <input
                  id="plc-f1-mbr-specialty"
                  data-testid="plc-member-specialty-input"
                  type="text"
                  value={memberSpecialty}
                  onChange={(e) => setMemberSpecialty(e.target.value)}
                  placeholder={
                    community.specialty ||
                    'يُستمد تلقائياً من تخصص المجتمع مع إمكانية التعديل'
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f1-mbr-job"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الدور الوظيفي
                </label>
                <input
                  id="plc-f1-mbr-job"
                  data-testid="plc-member-job-role-input"
                  type="text"
                  value={memberJobRole}
                  onChange={(e) => setMemberJobRole(e.target.value)}
                  placeholder="مثال: معلم / معلم متقدم / معلم خبير"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f1-mbr-email"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  id="plc-f1-mbr-email"
                  data-testid="plc-member-email-input"
                  type="email"
                  dir="ltr"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="teacher@school.edu.sa"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f1-mbr-phone"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  رقم التواصل (اختياري)
                </label>
                <input
                  id="plc-f1-mbr-phone"
                  data-testid="plc-member-phone-input"
                  type="text"
                  dir="ltr"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f1-mbr-notes"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  ملاحظات اختيارية
                </label>
                <input
                  id="plc-f1-mbr-notes"
                  data-testid="plc-member-notes-input"
                  type="text"
                  value={memberNotes}
                  onChange={(e) => setMemberNotes(e.target.value)}
                  placeholder="أي ملاحظات أو مهام مساندة"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-extrabold text-stone-800">
                المسؤوليات أو الأدوار داخل المجتمع (يمكن اختيار أكثر من مسؤولية):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    'leader',
                    'coordinator',
                    'rapporteur',
                    'member',
                    'followup',
                  ] as PlcMemberRole[]
                ).map((roleKey) => {
                  const checked = memberRoles.includes(roleKey);
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      data-testid={`plc-member-role-toggle-${roleKey}`}
                      onClick={() => handleToggleMemberRole(roleKey)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-2 transition-colors cursor-pointer ${
                        checked
                          ? 'bg-plc text-white border-plc'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{PLC_MEMBER_ROLE_LABELS[roleKey]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                data-testid="plc-save-member-btn"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>
                  {editingMemberId ? 'حفظ تعديلات العضو' : 'إضافة العضو للجدول'}
                </span>
              </button>

              {editingMemberId && (
                <button
                  type="button"
                  onClick={resetMemberForm}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </form>
          )}

          {community.members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs sm:text-sm text-stone-500">
              لم يُسجل أعضاء في هذا المجتمع حتى الآن. أضف الأعضاء من النموذج أعلاه.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table
                data-testid="plc-members-table"
                className="w-full text-right text-xs sm:text-sm border-collapse"
              >
                <thead>
                  <tr className="bg-plc-soft text-plc border-b border-plc-border">
                    <th className="py-3 px-4 font-extrabold">م</th>
                    <th className="py-3 px-4 font-extrabold">اسم العضو</th>
                    <th className="py-3 px-4 font-extrabold">التخصص</th>
                    <th className="py-3 px-4 font-extrabold">
                      المسؤوليات أو الأدوار
                    </th>
                    <th className="py-3 px-4 font-extrabold">
                      ملاحظات / تواصل
                    </th>
                    {!readOnly && (
                      <th className="py-3 px-4 font-extrabold text-center">
                        إجراءات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {community.members.map((mbr, idx) => {
                    const isLeader = mbr.roles.includes('leader');
                    return (
                      <tr
                        key={mbr.id}
                        data-testid={`plc-member-row-${idx}`}
                        className={isLeader ? 'bg-plc-soft/40' : ''}
                      >
                        <td className="py-3 px-4 font-bold text-stone-600 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-stone-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{mbr.name}</span>
                            {isLeader && (
                              <span className="px-2 py-0.5 rounded-md bg-plc text-white text-[10px] font-extrabold">
                                رئيس المجتمع
                              </span>
                            )}
                          </div>
                          {mbr.jobRole && (
                            <span className="text-[11px] text-stone-500 font-normal block">
                              {mbr.jobRole}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-700">
                          {mbr.specialty || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {mbr.roles.map((r) => (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  r === 'leader'
                                    ? 'bg-plc text-white'
                                    : 'bg-stone-100 text-stone-800'
                                }`}
                              >
                                {PLC_MEMBER_ROLE_LABELS[r]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-stone-600 text-xs">
                          {[mbr.notes, mbr.phone, mbr.email]
                            .filter(Boolean)
                            .join(' • ') || '—'}
                        </td>
                        {!readOnly && (
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isLeader && (
                                <button
                                  type="button"
                                  data-testid={`plc-make-leader-btn-${idx}`}
                                  onClick={() => handleQuickAssignLeader(mbr.id)}
                                  className="px-2.5 py-1 rounded-lg bg-plc-soft hover:bg-plc-soft-hover text-plc text-[11px] font-extrabold cursor-pointer"
                                  title="تعيين رئيساً للمجتمع"
                                >
                                  تعيين رئيساً
                                </button>
                              )}
                              <button
                                type="button"
                                data-testid={`plc-edit-member-btn-${idx}`}
                                onClick={() => handleStartEditMember(mbr)}
                                className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                                title="تعديل العضو"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                data-testid={`plc-delete-member-btn-${idx}`}
                                onClick={() => handleRemoveMember(mbr.id)}
                                className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                title="حذف العضو"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {renderFormNavigationFooter()}
      </section>
    );
  }

  // ==========================================================================
  // العرض 2: النموذج الثاني — التعريف بالمجتمع (٥ عناصر مستقلة تماماً)
  // ==========================================================================
  if (activeFormNumber === 2) {
    const renderDynamicIdentityListSection = (config: {
      field: PlcIdentityListField;
      sectionNumberLabel: string;
      title: string;
      description: string;
      placeholder: string;
      items: PlcIdentityListItem[];
      newValue: string;
      setNewValue: (v: string) => void;
      editingId: string | null;
      setEditingId: (id: string | null) => void;
      editingText: string;
      setEditingText: (t: string) => void;
      suggestions: string[];
    }) => {
      return (
        <div
          data-testid={`plc-f2-${config.field}-section`}
          className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-3">
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
                {config.sectionNumberLabel}: {config.title}
              </h4>
              <p className="text-xs text-stone-600 mt-0.5">
                {config.description}
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
              العدد المسجل: {config.items.length}
            </span>
          </div>

          {/* صياغات استرشادية اختيارية */}
          {!readOnly && (
            <>
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-plc" />
                  <span>صياغات استرشادية اختيارية (انقر للإضافة السريعة عند الرغبة):</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {config.suggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        handleAddIdentityItem(config.field, sug, () => {})
                      }
                      className="text-right px-3 py-1.5 rounded-xl bg-white hover:bg-plc-soft border border-stone-200 hover:border-plc/40 text-xs text-stone-700 hover:text-plc transition-colors cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* حقل إضافة عنصر جديد */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  data-testid={`plc-f2-${config.field}-input`}
                  value={config.newValue}
                  onChange={(e) => config.setNewValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddIdentityItem(config.field, config.newValue, () =>
                        config.setNewValue('')
                      );
                    }
                  }}
                  placeholder={config.placeholder}
                  className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
                <button
                  type="button"
                  data-testid={`plc-f2-${config.field}-add-btn`}
                  onClick={() =>
                    handleAddIdentityItem(config.field, config.newValue, () =>
                      config.setNewValue('')
                    )
                  }
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>إضافة</span>
                </button>
              </div>
            </>
          )}

          {/* قائمة العناصر المسجلة مع التعديل والحذف وإعادة الترتيب */}
          {config.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-4 text-center text-xs text-stone-500">
              لا توجد عناصر مسجلة في «{config.title}» حتى الآن.
            </div>
          ) : (
            <ul
              data-testid={`plc-f2-${config.field}-list`}
              className="space-y-2"
            >
              {config.items.map((item, idx) => {
                const isEditing = config.editingId === item.id;
                return (
                  <li
                    key={item.id}
                    data-testid={`plc-f2-${config.field}-item-${idx}`}
                    className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-plc-soft text-plc text-xs font-extrabold inline-flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                        {idx + 1}
                      </span>
                      {isEditing ? (
                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            data-testid={`plc-f2-${config.field}-edit-input-${idx}`}
                            value={config.editingText}
                            onChange={(e) =>
                              config.setEditingText(e.target.value)
                            }
                            className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-plc bg-white text-sm text-stone-900 focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid={`plc-f2-${config.field}-save-edit-btn-${idx}`}
                              onClick={() =>
                                handleSaveEditedIdentityItem(
                                  config.field,
                                  item.id,
                                  config.editingText,
                                  () => {
                                    config.setEditingId(null);
                                    config.setEditingText('');
                                  }
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-plc text-white text-xs font-extrabold cursor-pointer"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                config.setEditingId(null);
                                config.setEditingText('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-stone-800 leading-relaxed">
                          {item.text}
                        </span>
                      )}
                    </div>

                    {!isEditing && !readOnly && (
                      <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          data-testid={`plc-f2-${config.field}-up-btn-${idx}`}
                          onClick={() =>
                            handleReorderIdentityItem(
                              config.field,
                              item.id,
                              'up'
                            )
                          }
                          className="p-1.5 rounded-lg text-stone-500 hover:text-plc hover:bg-plc-soft disabled:opacity-30 cursor-pointer"
                          title="تحريك للأعلى"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === config.items.length - 1}
                          data-testid={`plc-f2-${config.field}-down-btn-${idx}`}
                          onClick={() =>
                            handleReorderIdentityItem(
                              config.field,
                              item.id,
                              'down'
                            )
                          }
                          className="p-1.5 rounded-lg text-stone-500 hover:text-plc hover:bg-plc-soft disabled:opacity-30 cursor-pointer"
                          title="تحريك للأسفل"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          data-testid={`plc-f2-${config.field}-edit-btn-${idx}`}
                          onClick={() => {
                            config.setEditingId(item.id);
                            config.setEditingText(item.text);
                          }}
                          className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          data-testid={`plc-f2-${config.field}-delete-btn-${idx}`}
                          onClick={() =>
                            handleDeleteIdentityItem(config.field, item.id)
                          }
                          className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    };

    return (
      <section
        data-testid="plc-form-2-container"
        className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
              <Compass className="w-3.5 h-3.5" />
              <span>الدفعة الثانية: البيانات والتخطيط • النموذج ٢ من ٤</span>
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              النموذج الثاني: التعريف بالمجتمع
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              توثيق الرؤية، الرسالة، الأهداف، القيم، والمبادئ المهنية الحاكمة لعمل
              المجتمع مع الفصل التام بين القيم والمبادئ المهنية.
            </p>
          </div>
        </div>

        {/* أولًا: الرؤية */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="plc-f2-vision"
              className="text-sm sm:text-base font-extrabold text-stone-900"
            >
              أولًا: الرؤية
            </label>
            <span className="text-[11px] font-bold text-emerald-700">
              حفظ تلقائي وفوري
            </span>
          </div>

          {!readOnly && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-plc" />
                <span>صياغات استرشادية اختيارية للرؤية:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLC_IDENTITY_SUGGESTIONS.vision.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleUpdateVision(sug)}
                    className="text-right px-3 py-1.5 rounded-xl bg-white hover:bg-plc-soft border border-stone-200 hover:border-plc/40 text-xs text-stone-700 hover:text-plc transition-colors cursor-pointer"
                  >
                    استخدام الصياغة {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            id="plc-f2-vision"
            data-testid="plc-f2-vision-textarea"
            rows={3}
            readOnly={readOnly}
            value={community.identity.vision}
            onChange={(e) => {
              if (!readOnly) handleUpdateVision(e.target.value);
            }}
            placeholder="اكتب رؤية مجتمع التعلّم المهني بحرية..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc leading-relaxed read-only:bg-stone-50"
          />
        </div>

        {/* ثانيًا: الرسالة */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="plc-f2-mission"
              className="text-sm sm:text-base font-extrabold text-stone-900"
            >
              ثانيًا: الرسالة
            </label>
            <span className="text-[11px] font-bold text-emerald-700">
              {readOnly ? 'للقراءة فقط' : 'حفظ تلقائي وفوري'}
            </span>
          </div>

          {!readOnly && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-plc" />
                <span>صياغات استرشادية اختيارية للرسالة:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLC_IDENTITY_SUGGESTIONS.mission.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleUpdateMission(sug)}
                    className="text-right px-3 py-1.5 rounded-xl bg-white hover:bg-plc-soft border border-stone-200 hover:border-plc/40 text-xs text-stone-700 hover:text-plc transition-colors cursor-pointer"
                  >
                    استخدام الصياغة {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            id="plc-f2-mission"
            data-testid="plc-f2-mission-textarea"
            rows={3}
            readOnly={readOnly}
            value={community.identity.mission}
            onChange={(e) => {
              if (!readOnly) handleUpdateMission(e.target.value);
            }}
            placeholder="اكتب رسالة مجتمع التعلّم المهني بحرية..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc leading-relaxed read-only:bg-stone-50"
          />
        </div>

        {/* ثالثًا: الأهداف */}
        {renderDynamicIdentityListSection({
          field: 'goals',
          sectionNumberLabel: 'ثالثًا',
          title: 'الأهداف',
          description:
            'قائمة ديناميكية بأهداف المجتمع. ترتبط هذه الأهداف مباشرة بالاحتياجات المهنية والخطة التشغيلية بمعرفاتها الثابتة.',
          placeholder: 'أدخل هدفاً جديداً من أهداف المجتمع...',
          items: community.identity.goals,
          newValue: newGoalText,
          setNewValue: setNewGoalText,
          editingId: editingGoalId,
          setEditingId: setEditingGoalId,
          editingText: editingGoalText,
          setEditingText: setEditingGoalText,
          suggestions: PLC_IDENTITY_SUGGESTIONS.goals,
        })}

        {/* رابعًا: القيم (مستقلة تماماً عن المبادئ المهنية) */}
        {renderDynamicIdentityListSection({
          field: 'values',
          sectionNumberLabel: 'رابعًا',
          title: 'القيم',
          description:
            'القيم التربوية والأخلاقية الحاكمة لعمل أعضاء المجتمع (مستقلة عن المبادئ المهنية).',
          placeholder: 'أدخل قيمة جديدة (مثال: التشاركية والتعاون المهني)...',
          items: community.identity.values,
          newValue: newValueText,
          setNewValue: setNewValueText,
          editingId: editingValueId,
          setEditingId: setEditingValueId,
          editingText: editingValueText,
          setEditingText: setEditingValueText,
          suggestions: PLC_IDENTITY_SUGGESTIONS.values,
        })}

        {/* خامسًا: المبادئ المهنية (مستقلة تماماً عن القيم) */}
        {renderDynamicIdentityListSection({
          field: 'principles',
          sectionNumberLabel: 'خامسًا',
          title: 'المبادئ المهنية',
          description:
            'المبادئ والمنطلقات المهنية التخصصية التي يلتزم بها المجتمع في التخطيط والتنفيذ والقياس (مستقلة عن القيم).',
          placeholder:
            'أدخل مبدأً مهنياً جديداً (مثال: التركيز على نواتج التعلم الفعلية)...',
          items: community.identity.principles,
          newValue: newPrincipleText,
          setNewValue: setNewPrincipleText,
          editingId: editingPrincipleId,
          setEditingId: setEditingPrincipleId,
          editingText: editingPrincipleText,
          setEditingText: setEditingPrincipleText,
          suggestions: PLC_IDENTITY_SUGGESTIONS.principles,
        })}

        {renderFormNavigationFooter()}
      </section>
    );
  }

  // ==========================================================================
  // العرض 3: النموذج الثالث — الاحتياجات والأولويات
  // ==========================================================================
  if (activeFormNumber === 3) {
    return (
      <section
        data-testid="plc-form-3-container"
        className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
              <Flag className="w-3.5 h-3.5" />
              <span>الدفعة الثانية: البيانات والتخطيط • النموذج ٣ من ٤</span>
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              النموذج الثالث: الاحتياجات والأولويات
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              تحديد الاحتياجات المهنية، ومصادرها، ومبررات اختيارها، وترتيبها حسب
              مستوى الأولوية، وربطها بالخطة التشغيلية.
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
            إجمالي الاحتياجات المسجلة: {community.needs.length}
          </span>
        </div>

        {/* نموذج إضافة / تعديل احتياج مهني */}
        {!readOnly && (
        <form
          onSubmit={handleSubmitNeedForm}
          data-testid="plc-f3-need-form"
          className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-4"
        >
          <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
            {editingNeedId
              ? 'تعديل بيانات الاحتياج المهني'
              : 'إضافة احتياج مهني جديد'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="plc-f3-desc"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                وصف الاحتياج المهني *
              </label>
              <input
                id="plc-f3-desc"
                data-testid="plc-f3-desc-input"
                type="text"
                required
                value={needDescription}
                onChange={(e) => setNeedDescription(e.target.value)}
                placeholder="مثال: الحاجة إلى تنويع أدوات التقويم التكويني لمعالجة الفاقد في مهارات الفهم القرائي"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f3-priority"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                مستوى الأولوية *
              </label>
              <select
                id="plc-f3-priority"
                data-testid="plc-f3-priority-select"
                value={needPriority}
                onChange={(e) =>
                  setNeedPriority(e.target.value as PlcPriorityLevel)
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="high">{PLC_PRIORITY_LABELS.high}</option>
                <option value="medium">{PLC_PRIORITY_LABELS.medium}</option>
                <option value="low">{PLC_PRIORITY_LABELS.low}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="plc-f3-source"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                مصدر تحديد الاحتياج *
              </label>
              <select
                id="plc-f3-source"
                data-testid="plc-f3-source-select"
                value={needSource}
                onChange={(e) =>
                  setNeedSource(e.target.value as PlcNeedSource)
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="student_results">
                  {PLC_NEED_SOURCE_LABELS.student_results}
                </option>
                <option value="classroom_observation">
                  {PLC_NEED_SOURCE_LABELS.classroom_observation}
                </option>
                <option value="performance_analysis">
                  {PLC_NEED_SOURCE_LABELS.performance_analysis}
                </option>
                <option value="survey">{PLC_NEED_SOURCE_LABELS.survey}</option>
                <option value="other">{PLC_NEED_SOURCE_LABELS.other}</option>
              </select>
            </div>

            {needSource === 'other' && (
              <div>
                <label
                  htmlFor="plc-f3-custom-source"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  حدد المصدر الآخر *
                </label>
                <input
                  id="plc-f3-custom-source"
                  data-testid="plc-f3-custom-source-input"
                  type="text"
                  required
                  value={needCustomSource}
                  onChange={(e) => setNeedCustomSource(e.target.value)}
                  placeholder="مثال: نتائج الاختبارات الوطنية (نافس)"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>
            )}

            <div className={needSource === 'other' ? '' : 'sm:col-span-2'}>
              <label
                htmlFor="plc-f3-justification"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                مبررات اختيار الاحتياج *
              </label>
              <input
                id="plc-f3-justification"
                data-testid="plc-f3-justification-input"
                type="text"
                required
                value={needJustification}
                onChange={(e) => setNeedJustification(e.target.value)}
                placeholder="مثال: انخفاض متوسط الإتقان في التقويمات التشخيصية لبداية الفصل"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="plc-f3-proposed-action"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                الإجراء المقترح لمعالجة الاحتياج *
              </label>
              <input
                id="plc-f3-proposed-action"
                data-testid="plc-f3-proposed-action-input"
                type="text"
                required
                value={needProposedAction}
                onChange={(e) => setNeedProposedAction(e.target.value)}
                placeholder="مثال: تصميم حقيبة تقويم تكويني وتنفيذ ورشة تطبيقية وتبادل زيارات صفية"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f3-notes"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                ملاحظات اختيارية
              </label>
              <input
                id="plc-f3-notes"
                data-testid="plc-f3-notes-input"
                type="text"
                value={needNotes}
                onChange={(e) => setNeedNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>
          </div>

          {/* تثبيت قرار الدفعة الثانية: إخفاء أزرار الربط المباشر بالهدف من واجهة النموذج الثالث والاكتفاء بالربط المنهجي الموحد في الخطة التشغيلية مع الاحتفاظ بالحقل داخلياً */}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              data-testid="plc-f3-save-need-btn"
              className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                {editingNeedId
                  ? 'حفظ تعديلات الاحتياج المهني'
                  : 'إضافة الاحتياج المهني للجدول'}
              </span>
            </button>

            {editingNeedId && (
              <button
                type="button"
                onClick={resetNeedForm}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
        )}

        {/* شريط البحث والتصفية والترتيب حسب الأولوية */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="plc-f3-search-input"
              value={needsSearchQuery}
              onChange={(e) => setNeedsSearchQuery(e.target.value)}
              placeholder="بحث في الاحتياجات والمبررات..."
              className="w-full min-h-[40px] pr-10 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-500 shrink-0" />
            <select
              data-testid="plc-f3-filter-priority"
              value={needsPriorityFilter}
              onChange={(e) =>
                setNeedsPriorityFilter(
                  e.target.value as PlcPriorityLevel | 'all'
                )
              }
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            >
              <option value="all">جميع مستويات الأولوية</option>
              <option value="high">أولوية مرتفعة</option>
              <option value="medium">أولوية متوسطة</option>
              <option value="low">أولوية منخفضة</option>
            </select>
          </div>

          <div>
            <select
              data-testid="plc-f3-filter-source"
              value={needsSourceFilter}
              onChange={(e) =>
                setNeedsSourceFilter(e.target.value as PlcNeedSource | 'all')
              }
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            >
              <option value="all">جميع مصادر تحديد الاحتياج</option>
              <option value="student_results">
                {PLC_NEED_SOURCE_LABELS.student_results}
              </option>
              <option value="classroom_observation">
                {PLC_NEED_SOURCE_LABELS.classroom_observation}
              </option>
              <option value="performance_analysis">
                {PLC_NEED_SOURCE_LABELS.performance_analysis}
              </option>
              <option value="survey">{PLC_NEED_SOURCE_LABELS.survey}</option>
              <option value="other">{PLC_NEED_SOURCE_LABELS.other}</option>
            </select>
          </div>

          <div>
            <button
              type="button"
              data-testid="plc-f3-sort-priority-toggle"
              onClick={() => setNeedsSortByPriority((prev) => !prev)}
              className={`w-full min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                needsSortByPriority
                  ? 'bg-plc-soft border-plc text-plc'
                  : 'bg-white border-stone-300 text-stone-700'
              }`}
            >
              <span>
                {needsSortByPriority
                  ? 'مرتب تلقائياً حسب الأولوية (مرتفع ← منخفض)'
                  : 'الترتيب حسب الأولوية: غير مفعل'}
              </span>
            </button>
          </div>
        </div>

        {/* جدول الاحتياجات والأولويات الموحد */}
        {filteredNeeds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs sm:text-sm text-stone-500">
            {community.needs.length === 0
              ? 'لم تُسجل احتياجات مهنية في هذا المجتمع حتى الآن. أضف الاحتياجات من النموذج أعلاه ليتم ربطها بالخطة التشغيلية.'
              : 'لا توجد احتياجات مطابقة لمعايير البحث أو التصفية الحالية.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table
              data-testid="plc-needs-table"
              className="w-full text-right text-xs sm:text-sm border-collapse"
            >
              <thead>
                <tr className="bg-plc-soft text-plc border-b border-plc-border">
                  <th className="py-3 px-4 font-extrabold">م</th>
                  <th className="py-3 px-4 font-extrabold">
                    وصف الاحتياج المهني
                  </th>
                  <th className="py-3 px-4 font-extrabold">
                    مصدر تحديد الاحتياج
                  </th>
                  <th className="py-3 px-4 font-extrabold">
                    مبررات اختيار الاحتياج
                  </th>
                  <th className="py-3 px-4 font-extrabold">مستوى الأولوية</th>
                  <th className="py-3 px-4 font-extrabold">الإجراء المقترح</th>
                  <th className="py-3 px-4 font-extrabold">ملاحظات</th>
                  {!readOnly && (
                    <th className="py-3 px-4 font-extrabold text-center">
                      إجراءات
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {filteredNeeds.map((need, idx) => {
                  const linkedPlanActionsCount =
                    community.operationalPlan.filter((act) =>
                      getPlcActionNeedIds(act).includes(need.id)
                    ).length;

                  return (
                    <tr key={need.id} data-testid={`plc-need-row-${idx}`}>
                      <td className="py-3 px-4 font-bold text-stone-600 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-stone-900">
                        <div>{need.description}</div>
                        {linkedPlanActionsCount > 0 && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                            مرتبط بـ {linkedPlanActionsCount} إجراء في الخطة
                            التشغيلية
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-700 font-semibold">
                        {getPlcNeedSourceDisplayLabel(need)}
                      </td>
                      <td className="py-3 px-4 text-stone-700">
                        {need.justification || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {renderPriorityBadge(need.priority)}
                      </td>
                      <td className="py-3 px-4 text-stone-800 font-semibold">
                        {need.proposedAction || '—'}
                      </td>
                      <td className="py-3 px-4 text-stone-600 text-xs">
                        {need.notes || '—'}
                      </td>
                      {!readOnly && (
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              data-testid={`plc-edit-need-btn-${idx}`}
                              onClick={() => handleStartEditNeed(need)}
                              className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                              title="تعديل الاحتياج"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              data-testid={`plc-delete-need-btn-${idx}`}
                              onClick={() => handleDeleteNeed(need.id)}
                              className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              title="حذف الاحتياج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {renderFormNavigationFooter()}
      </section>
    );
  }

  // ==========================================================================
  // العرض 4: النموذج الرابع — الخطة التشغيلية
  // ==========================================================================
  if (activeFormNumber === 4) {
    return (
      <section
        data-testid="plc-form-4-container"
        className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
              <ListChecks className="w-3.5 h-3.5" />
              <span>الدفعة الثانية: البيانات والتخطيط • النموذج ٤ من ٤</span>
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              النموذج الرابع: الخطة التشغيلية
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              ربط الإجراءات والأنشطة بالأهداف المسجلة والاحتياجات المهنية وأعضاء
              المجتمع بمعرفاتها الثابتة، ومتابعة حالة التنفيذ ونسبة الإنجاز الفعلية.
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
            إجمالي إجراءات الخطة: {community.operationalPlan.length}
          </span>
        </div>

        {/* تنبيه منهجي حول النزاهة بين التنفيذ والأثر */}
        <div className="rounded-xl bg-plc-soft/70 border border-plc-border px-4 py-3 text-xs text-stone-700 flex items-start gap-2.5">
          <Target className="w-4 h-4 text-plc shrink-0 mt-0.5" />
          <div>
            <strong className="text-plc font-extrabold">
              ضابط منهجي:
            </strong>{' '}
            تُحدث نسبة الإنجاز وحالة التنفيذ بناءً على بيانات التنفيذ المدخلة
            فعلياً دون افتراض نسب وهمية. علماً بأن تسجيل حالة الإجراء «منفذ» يثبت
            إتمام النشاط إجرائياً ولا يعني وحده تحقق الأثر التعليمي أو المهني.
          </div>
        </div>

        {/* نموذج إضافة / تعديل إجراء في الخطة التشغيلية */}
        {!readOnly && (
        <form
          onSubmit={handleSubmitActionForm}
          data-testid="plc-f4-action-form"
          className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-4"
        >
          <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
            {editingActionId
              ? 'تعديل إجراء في الخطة التشغيلية'
              : 'إضافة إجراء أو نشاط جديد إلى الخطة التشغيلية'}
          </h4>

          {/* ١. اختيار الهدف المرتبط به (أو إضافة هدف جديد فوراً) */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="plc-f4-goal-select"
                className="text-xs sm:text-sm font-extrabold text-stone-800"
              >
                ١. الهدف المرتبط به (من أهداف النموذج الثاني أو إضافة هدف جديد):
              </label>
              <button
                type="button"
                data-testid="plc-f4-toggle-quick-goal-btn"
                onClick={() => setShowQuickGoalInput((prev) => !prev)}
                className="text-xs font-extrabold text-plc hover:underline cursor-pointer"
              >
                {showQuickGoalInput
                  ? 'إغلاق الإضافة السريعة للهدف'
                  : '+ إضافة هدف جديد مباشرة'}
              </button>
            </div>

            {showQuickGoalInput && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  data-testid="plc-f4-quick-goal-input"
                  value={quickNewGoalText}
                  onChange={(e) => setQuickNewGoalText(e.target.value)}
                  placeholder="اكتب نص الهدف الجديد ليُحفظ في النموذج الثاني ويُربط بهذا الإجراء..."
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-plc bg-white text-xs sm:text-sm text-stone-900 focus:outline-none"
                />
                <button
                  type="button"
                  data-testid="plc-f4-save-quick-goal-btn"
                  onClick={handleQuickCreateGoalForPlan}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc text-white text-xs font-extrabold cursor-pointer shrink-0"
                >
                  حفظ الهدف وربطه
                </button>
              </div>
            )}

            <select
              id="plc-f4-goal-select"
              data-testid="plc-f4-goal-select"
              value={actionGoalId}
              onChange={(e) => setActionGoalId(e.target.value)}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
            >
              <option value="">-- اختر الهدف المرتبط من أهداف المجتمع --</option>
              {community.identity.goals.map((g, idx) => (
                <option key={g.id} value={g.id}>
                  هدف ({idx + 1}): {g.text}
                </option>
              ))}
            </select>
          </div>

          {/* ٢. اختيار الاحتياج المهني الذي يعالجه (واحد أو أكثر) مع إظهار وصفه وأولويته فوراً */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-stone-800">
                ٢. الاحتياج المهني الذي يعالجه الإجراء (يمكن ربط الإجراء باحتياج
                واحد أو أكثر):
              </span>
              {community.needs.length === 0 && (
                <button
                  type="button"
                  onClick={() => onSelectFormNumber(3)}
                  className="text-xs font-extrabold text-plc hover:underline cursor-pointer"
                >
                  الانتقال للنموذج الثالث لإضافة احتياجات مهنية
                </button>
              )}
            </div>

            {community.needs.length === 0 ? (
              <div className="text-xs text-stone-500">
                لا توجد احتياجات مسجلة في النموذج الثالث حالياً. يمكنك تسجيل
                احتياجات في النموذج الثالث وربطها هنا.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {community.needs.map((need, idx) => {
                  const isChecked = actionNeedIds.includes(need.id);
                  return (
                    <div
                      key={need.id}
                      data-testid={`plc-f4-need-option-${idx}`}
                      onClick={() => handleToggleActionNeedSelection(need.id)}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isChecked
                          ? 'border-2 border-plc bg-plc-soft/50'
                          : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-plc shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-extrabold text-stone-900">
                            {need.description}
                          </p>
                          <p className="text-[11px] text-stone-600">
                            المصدر: {getPlcNeedSourceDisplayLabel(need)}
                            {need.proposedAction
                              ? ` • الإجراء المقترح: ${need.proposedAction}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {renderPriorityBadge(need.priority)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* بطاقة معاينة تفاصيل الاحتياجات المختارة لمساعدة المستخدم في صياغة الإجراء المناسب */}
            {selectedNeedsPreviewForPlan.length > 0 && (
              <div
                data-testid="plc-f4-selected-needs-preview"
                className="rounded-xl bg-plc-soft border border-plc-border p-3 space-y-2"
              >
                <span className="text-xs font-extrabold text-plc block">
                  تفاصيل الاحتياجات المختارة ومستوى أولويتها (لمساعدتك في اختيار
                  الإجراء المناسب):
                </span>
                <ul className="space-y-1.5">
                  {selectedNeedsPreviewForPlan.map((sn) => (
                    <li
                      key={sn.id}
                      className="text-xs text-stone-800 flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-plc-border"
                    >
                      <div>
                        <strong className="font-extrabold">
                          {sn.description}
                        </strong>
                        {sn.proposedAction && (
                          <span className="text-stone-600 block text-[11px]">
                            الإجراء المقترح في سجل الاحتياج: {sn.proposedAction}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {renderPriorityBadge(sn.priority)}
                        {sn.proposedAction && !actionTitle.trim() && (
                          <button
                            type="button"
                            onClick={() => setActionTitle(sn.proposedAction)}
                            className="px-2 py-0.5 rounded-md bg-plc text-white text-[11px] font-bold cursor-pointer"
                          >
                            اعتماد كعنوان للإجراء
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ٣. بقية حقول الخطة التشغيلية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="plc-f4-title"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                الإجراء أو النشاط *
              </label>
              <input
                id="plc-f4-title"
                data-testid="plc-f4-title-input"
                type="text"
                required
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder="مثال: تنفيذ ورشة عمل تطبيقية لتصميم اختبارات قصيرة تشخيصية وتحليل نتائجها"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f4-member-select"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                الشخص المسؤول (من أعضاء المجتمع)
              </label>
              <select
                id="plc-f4-member-select"
                data-testid="plc-f4-member-select"
                value={actionResponsibleMemberId}
                onChange={(e) => {
                  const mId = e.target.value;
                  setActionResponsibleMemberId(mId);
                  const found = community.members.find((m) => m.id === mId);
                  if (found) {
                    setActionResponsibleCustomName(found.name);
                  }
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="">-- اختر من أعضاء المجتمع أو اكتب اسماً --</option>
                {community.members.map((mbr) => (
                  <option key={mbr.id} value={mbr.id}>
                    {mbr.name} (
                    {mbr.roles
                      .map((r) => PLC_MEMBER_ROLE_LABELS[r])
                      .join('، ')}
                    )
                  </option>
                ))}
              </select>
            </div>

            {!actionResponsibleMemberId && (
              <div>
                <label
                  htmlFor="plc-f4-custom-responsible"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  اسم المسؤول (كتابة يدوية عند عدم اختياره من القائمة)
                </label>
                <input
                  id="plc-f4-custom-responsible"
                  data-testid="plc-f4-custom-responsible-input"
                  type="text"
                  value={actionResponsibleCustomName}
                  onChange={(e) =>
                    setActionResponsibleCustomName(e.target.value)
                  }
                  placeholder="اسم العضو أو فريق العمل المسؤول"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="plc-f4-start-date"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                تاريخ البداية
              </label>
              <input
                id="plc-f4-start-date"
                data-testid="plc-f4-start-date-input"
                type="date"
                value={actionStartDate}
                onChange={(e) => setActionStartDate(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f4-end-date"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                تاريخ النهاية
              </label>
              <input
                id="plc-f4-end-date"
                data-testid="plc-f4-end-date-input"
                type="date"
                value={actionEndDate}
                onChange={(e) => setActionEndDate(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f4-resources"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                الموارد المطلوبة
              </label>
              <input
                id="plc-f4-resources"
                data-testid="plc-f4-resources-input"
                type="text"
                value={actionResources}
                onChange={(e) => setActionResources(e.target.value)}
                placeholder="مثال: نماذج تحليل نتائج، قاعة التدريب، عرض تقديمي"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f4-indicator"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                مؤشر الإنجاز *
              </label>
              <input
                id="plc-f4-indicator"
                data-testid="plc-f4-indicator-input"
                type="text"
                required
                value={actionIndicatorText}
                onChange={(e) => setActionIndicatorText(e.target.value)}
                placeholder="مثال: إعداد ٣ نماذج تقويم تكويني وتطبيقها في جميع الفصول"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f4-status"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                حالة التنفيذ
              </label>
              <select
                id="plc-f4-status"
                data-testid="plc-f4-status-select"
                value={actionStatus}
                onChange={(e) =>
                  setActionStatus(e.target.value as PlcActionExecutionStatus)
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="not_started">
                  {PLC_ACTION_STATUS_LABELS.not_started}
                </option>
                <option value="in_progress">
                  {PLC_ACTION_STATUS_LABELS.in_progress}
                </option>
                <option value="completed">
                  {PLC_ACTION_STATUS_LABELS.completed}
                </option>
                <option value="stalled">
                  {PLC_ACTION_STATUS_LABELS.stalled}
                </option>
                <option value="cancelled">
                  {PLC_ACTION_STATUS_LABELS.cancelled}
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="plc-f4-pct"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                نسبة الإنجاز الفعلية (%) (بناءً على بيانات التنفيذ)
              </label>
              <input
                id="plc-f4-pct"
                data-testid="plc-f4-pct-input"
                type="number"
                min={0}
                max={100}
                value={actionCompletionPercentage}
                onChange={(e) => setActionCompletionPercentage(e.target.value)}
                placeholder="تُدخل حسب التنفيذ الفعلي (٠ - ١٠٠)"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              data-testid="plc-f4-save-action-btn"
              className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                {editingActionId
                  ? 'حفظ تعديلات الإجراء'
                  : 'إضافة الإجراء إلى الخطة التشغيلية'}
              </span>
            </button>

            {editingActionId && (
              <button
                type="button"
                onClick={resetActionForm}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
        )}

        {/* شريط البحث والتصفية في الخطة التشغيلية */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="plc-f4-search-input"
              value={planSearchQuery}
              onChange={(e) => setPlanSearchQuery(e.target.value)}
              placeholder="بحث في الإجراءات، الأهداف، الاحتياجات، المسؤولين..."
              className="w-full min-h-[40px] pr-10 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-stone-500 shrink-0" />
            <select
              data-testid="plc-f4-filter-status"
              value={planStatusFilter}
              onChange={(e) =>
                setPlanStatusFilter(
                  e.target.value as PlcActionExecutionStatus | 'all'
                )
              }
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            >
              <option value="all">جميع حالات التنفيذ</option>
              <option value="not_started">
                {PLC_ACTION_STATUS_LABELS.not_started}
              </option>
              <option value="in_progress">
                {PLC_ACTION_STATUS_LABELS.in_progress}
              </option>
              <option value="completed">
                {PLC_ACTION_STATUS_LABELS.completed}
              </option>
              <option value="stalled">
                {PLC_ACTION_STATUS_LABELS.stalled}
              </option>
              <option value="cancelled">
                {PLC_ACTION_STATUS_LABELS.cancelled}
              </option>
            </select>
          </div>
        </div>

        {/* جدول الخطة التشغيلية الديناميكي */}
        {filteredPlanActions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs sm:text-sm text-stone-500">
            {community.operationalPlan.length === 0
              ? 'لم تُسجل إجراءات في الخطة التشغيلية حتى الآن. أضف الإجراءات من النموذج أعلاه.'
              : 'لا توجد إجراءات مطابقة لمعايير البحث أو التصفية الحالية.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table
              data-testid="plc-plan-table"
              className="w-full text-right text-xs sm:text-sm border-collapse"
            >
              <thead>
                <tr className="bg-plc-soft text-plc border-b border-plc-border">
                  <th className="py-3 px-3 font-extrabold">م</th>
                  <th className="py-3 px-3 font-extrabold">الهدف المرتبط به</th>
                  <th className="py-3 px-3 font-extrabold">
                    الاحتياج المهني الذي يعالجه
                  </th>
                  <th className="py-3 px-3 font-extrabold">
                    الإجراء أو النشاط
                  </th>
                  <th className="py-3 px-3 font-extrabold">الشخص المسؤول</th>
                  <th className="py-3 px-3 font-extrabold">
                    فترة التنفيذ والموارد
                  </th>
                  <th className="py-3 px-3 font-extrabold">مؤشر الإنجاز</th>
                  <th className="py-3 px-3 font-extrabold">
                    حالة التنفيذ ونسبة الإنجاز
                  </th>
                  {!readOnly && (
                    <th className="py-3 px-3 font-extrabold text-center">
                      إجراءات
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {filteredPlanActions.map((act, idx) => {
                  const resolved = resolvePlcPlanActionLinks(act, community);
                  return (
                    <tr key={act.id} data-testid={`plc-plan-row-${idx}`}>
                      <td className="py-3 px-3 font-bold text-stone-600 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 text-stone-800 font-bold max-w-[200px]">
                        {resolved.goalText}
                      </td>
                      <td className="py-3 px-3 max-w-[240px]">
                        {resolved.linkedNeeds.length === 0 ? (
                          <span className="text-stone-400 text-xs">
                            غير مرتبط باحتياج
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            {resolved.linkedNeeds.map((ln) => (
                              <div
                                key={ln.need.id}
                                className="p-2 rounded-lg bg-stone-50 border border-stone-200 space-y-1"
                              >
                                <div className="font-bold text-stone-800 text-xs">
                                  {ln.need.description}
                                </div>
                                <div>
                                  {renderPriorityBadge(ln.need.priority)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-stone-900 max-w-[220px]">
                        {act.title}
                      </td>
                      <td className="py-3 px-3 text-stone-800 font-semibold">
                        {resolved.responsibleDisplayName}
                      </td>
                      <td className="py-3 px-3 text-xs text-stone-600 tabular-nums">
                        <div>
                          من: {act.startDate || '—'} إلى: {act.endDate || '—'}
                        </div>
                        {act.resources && (
                          <div className="text-stone-500 mt-0.5">
                            الموارد: {act.resources}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-stone-800 text-xs font-semibold">
                        {act.indicatorText || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-2 min-w-[140px]">
                          <select
                            data-testid={`plc-plan-row-status-select-${idx}`}
                            value={act.status}
                            disabled={readOnly}
                            onChange={(e) => {
                              if (readOnly) return;
                              handleInlineUpdateActionStatus(
                                act.id,
                                e.target.value as PlcActionExecutionStatus
                              );
                            }}
                            className="w-full px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-xs font-extrabold text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
                          >
                            <option value="not_started">
                              {PLC_ACTION_STATUS_LABELS.not_started}
                            </option>
                            <option value="in_progress">
                              {PLC_ACTION_STATUS_LABELS.in_progress}
                            </option>
                            <option value="completed">
                              {PLC_ACTION_STATUS_LABELS.completed}
                            </option>
                            <option value="stalled">
                              {PLC_ACTION_STATUS_LABELS.stalled}
                            </option>
                            <option value="cancelled">
                              {PLC_ACTION_STATUS_LABELS.cancelled}
                            </option>
                          </select>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-stone-600">
                              الإنجاز:
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              disabled={readOnly}
                              data-testid={`plc-plan-row-pct-input-${idx}`}
                              value={
                                act.completionPercentage !== null &&
                                act.completionPercentage !== undefined
                                  ? String(act.completionPercentage)
                                  : ''
                              }
                              onChange={(e) => {
                                if (readOnly) return;
                                handleInlineUpdateActionPercentage(
                                  act.id,
                                  e.target.value
                                );
                              }}
                              placeholder="—"
                              className="w-16 px-2 py-0.5 rounded-md border border-stone-300 text-xs font-bold text-center tabular-nums disabled:bg-stone-100"
                            />
                            <span className="text-[11px] font-bold text-stone-600">
                              %
                            </span>
                          </div>
                        </div>
                      </td>
                      {!readOnly && (
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              data-testid={`plc-edit-action-btn-${idx}`}
                              onClick={() => handleStartEditAction(act)}
                              className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                              title="تعديل الإجراء"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              data-testid={`plc-delete-action-btn-${idx}`}
                              onClick={() => handleDeleteAction(act.id)}
                              className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              title="حذف الإجراء"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {renderFormNavigationFooter()}
      </section>
    );
  }

  // ==========================================================================
  // العرض 5 و6: الدفعة الثالثة (الاجتماعات ومحاضرها + البرامج والأنشطة والزيارات والشراكات)
  // ==========================================================================
  if (activeFormNumber === 5 || activeFormNumber === 6) {
    return (
      <PlcBatch3Forms
        community={community}
        activeFormNumber={activeFormNumber}
        onSelectFormNumber={onSelectFormNumber}
        onUpdateCommunity={onUpdateCommunity}
        onShowBanner={onShowBanner}
        readOnly={readOnly}
      />
    );
  }

  // ==========================================================================
  // العرض 7 و8: الدفعة الرابعة (التقويم ومؤشرات الأداء وقياس الأثر + مستودع الشواهد والمرفقات)
  // ==========================================================================
  if (activeFormNumber === 7 || activeFormNumber === 8) {
    return (
      <PlcBatch4Forms
        community={community}
        activeFormNumber={activeFormNumber}
        onSelectFormNumber={onSelectFormNumber}
        onUpdateCommunity={onUpdateCommunity}
        onShowBanner={onShowBanner}
        readOnly={readOnly}
      />
    );
  }

  // ==========================================================================
  // العرض 9: النموذج التاسع (الدفعة الخامسة — التقرير الختامي لمجتمع التعلّم المهني)
  // ==========================================================================
  return (
    <PlcBatch5FinalReport
      community={community}
      settings={settings}
      onUpdateCommunity={(updated, message) => {
        if (readOnly) return;
        onUpdateCommunity(() => updated);
        if (message) {
          onShowBanner(message);
        }
      }}
      onNavigateForm={(formNum) => onSelectFormNumber(formNum as PlcFormNumber)}
      readOnly={readOnly}
    />
  );
};
