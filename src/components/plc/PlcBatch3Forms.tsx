import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderKanban,
  Handshake,
  Layers,
  Link2,
  MapPin,
  Paperclip,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  addPlcActivityRecord,
  addPlcMeetingRecord,
  attachPlcEvidenceToRecord,
  buildInitialMeetingAttendanceFromMembers,
  buildPlcRecordQrPayload,
  computePlcExecutionOverview,
  computePlcMeetingsOverview,
  deletePlcActivityRecord,
  deletePlcMeetingRecord,
  filterAndSortPlcActivities,
  filterAndSortPlcMeetings,
  generatePlcEntityId,
  generatePlcRecordQrSvgDataUrl,
  getPlcRecordEvidences,
  parsePlcRecordQrPayload,
  PLC_ACTIVITY_STATUS_LABELS,
  PLC_ACTIVITY_TYPE_LABELS,
  PLC_FOLLOWUP_STATUS_LABELS,
  PLC_FORMS_CATALOG,
  PLC_MAX_EVIDENCES_PER_RECORD,
  PLC_PRIORITY_LABELS,
  PlcActivityRecord,
  PlcActivityRecordStatus,
  PlcActivityRecordType,
  PlcCommunityRecord,
  PlcEvidenceItem,
  PlcFollowupStatus,
  PlcFormNumber,
  PlcMeetingAttendanceEntry,
  PlcMeetingRecommendation,
  PlcMeetingRecord,
  removePlcEvidenceFromRecord,
  replacePlcEvidenceOnRecord,
  resolvePlcActivityRecordLinks,
  resolvePlcMeetingAttendance,
  resolvePlcMeetingRecommendationLinks,
  updatePlcActivityRecord,
  updatePlcMeetingRecord,
} from '../../utils/plcEngine';

interface PlcBatch3FormsProps {
  community: PlcCommunityRecord;
  activeFormNumber: 5 | 6;
  onSelectFormNumber: (formNumber: PlcFormNumber) => void;
  onUpdateCommunity: (
    updater: (current: PlcCommunityRecord) => PlcCommunityRecord
  ) => void;
  onShowBanner: (message: string) => void;
  readOnly?: boolean;
}

const MEETING_TYPE_SUGGESTIONS = [
  'اجتماع دوري',
  'اجتماع تأسيسي',
  'اجتماع تخطيط ومتابعة',
  'اجتماع تحليل نتائج الطلاب',
  'اجتماع تقويم ومراجعة',
];

export const PlcBatch3Forms: React.FC<PlcBatch3FormsProps> = ({
  community,
  activeFormNumber,
  onSelectFormNumber,
  onUpdateCommunity,
  onShowBanner,
  readOnly = false,
}) => {
  // ==========================================================================
  // ١. حالات النموذج الخامس: الاجتماعات ومحاضرها
  // ==========================================================================
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(
    () => (readOnly && community.meetings.length > 0 ? community.meetings[0].id : null)
  );
  const [confirmDeleteMeetingId, setConfirmDeleteMeetingId] = useState<
    string | null
  >(null);

  const nextSuggestedMeetingNumber = useMemo(
    () =>
      community.meetings.reduce(
        (max, m) => Math.max(max, m.meetingNumber || 0),
        0
      ) + 1,
    [community.meetings]
  );

  const [mtgNumber, setMtgNumber] = useState<number>(
    nextSuggestedMeetingNumber
  );
  const [mtgDate, setMtgDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [mtgType, setMtgType] = useState<string>('اجتماع دوري');
  const [mtgVenue, setMtgVenue] = useState<string>(community.venue || '');
  const [mtgAttendance, setMtgAttendance] = useState<
    PlcMeetingAttendanceEntry[]
  >(() => buildInitialMeetingAttendanceFromMembers(community.members));
  const [mtgAgenda, setMtgAgenda] = useState<string[]>([]);
  const [newAgendaItemText, setNewAgendaItemText] = useState('');
  const [mtgDiscussionSummary, setMtgDiscussionSummary] = useState('');
  const [mtgRecommendations, setMtgRecommendations] = useState<
    PlcMeetingRecommendation[]
  >([]);

  // حقول إضافة توصية داخل الاجتماع
  const [recText, setRecText] = useState('');
  const [recResponsibleMemberId, setRecResponsibleMemberId] = useState('');
  const [recResponsibleCustomName, setRecResponsibleCustomName] = useState('');
  const [recTargetDate, setRecTargetDate] = useState('');
  const [recFollowupStatus, setRecFollowupStatus] =
    useState<PlcFollowupStatus>('not_started');
  const [recFollowupNotes, setRecFollowupNotes] = useState('');
  const [recLinkedActionId, setRecLinkedActionId] = useState('');

  // البحث والترتيب في الاجتماعات
  const [meetingsSearchQuery, setMeetingsSearchQuery] = useState('');
  const [meetingsSortBy, setMeetingsSortBy] = useState<
    'number_asc' | 'number_desc' | 'date_desc' | 'date_asc'
  >('number_asc');

  // ==========================================================================
  // ٢. حالات النموذج السادس: البرامج والأنشطة والزيارات والشراكات
  // ==========================================================================
  const [editingActivityId, setEditingActivityId] = useState<string | null>(
    null
  );
  const [confirmDeleteActivityId, setConfirmDeleteActivityId] = useState<
    string | null
  >(null);

  const [actType, setActType] = useState<PlcActivityRecordType>('program');
  const [actTitle, setActTitle] = useState('');
  const [actNeedId, setActNeedId] = useState('');
  const [actGoalId, setActGoalId] = useState('');
  const [actActionId, setActActionId] = useState('');
  const [actObjectiveText, setActObjectiveText] = useState('');
  const [actTargetAudience, setActTargetAudience] = useState('');
  const [actExecutionDateOrPeriod, setActExecutionDateOrPeriod] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [actResponsibleMemberIds, setActResponsibleMemberIds] = useState<
    string[]
  >([]);
  const [actResponsibleCustomNames, setActResponsibleCustomNames] =
    useState('');
  const [actStatus, setActStatus] =
    useState<PlcActivityRecordStatus>('planned');
  const [actActualExecutionDescription, setActActualExecutionDescription] =
    useState('');
  const [actResults, setActResults] = useState('');

  // حقول خاصة بالزيارة المتبادلة
  const [actHostOrVisitingEntity, setActHostOrVisitingEntity] = useState('');
  const [actParticipantsText, setActParticipantsText] = useState('');
  const [actKeyObservations, setActKeyObservations] = useState('');
  const [actLessonsLearned, setActLessonsLearned] = useState('');

  // حقول خاصة بالشراكة المجتمعية
  const [actPartnerEntity, setActPartnerEntity] = useState('');
  const [actPartnershipType, setActPartnershipType] = useState('');

  // البحث والتصفية في سجلات التنفيذ
  const [activitiesSearchQuery, setActivitiesSearchQuery] = useState('');
  const [activitiesTypeFilter, setActivitiesTypeFilter] = useState<
    PlcActivityRecordType | 'all'
  >('all');
  const [activitiesStatusFilter, setActivitiesStatusFilter] = useState<
    PlcActivityRecordStatus | 'all'
  >('all');

  // ==========================================================================
  // ٣. حالات الشواهد ورمز QR والمعاينة
  // ==========================================================================
  const [evidenceErrorBanner, setEvidenceErrorBanner] = useState<string | null>(
    null
  );
  const [previewEvidenceItem, setPreviewEvidenceItem] =
    useState<PlcEvidenceItem | null>(null);
  const [confirmDeleteEvidenceRef, setConfirmDeleteEvidenceRef] = useState<{
    targetType: 'activity' | 'meeting';
    targetId: string;
    evidenceId: string;
  } | null>(null);

  const [qrModalInfo, setQrModalInfo] = useState<{
    title: string;
    subtitle: string;
    recordKind: 'meeting' | 'activity';
    recordId: string;
    qrCodeToken: string;
  } | null>(null);

  // ==========================================================================
  // المجاميع والبيانات المشتقة
  // ==========================================================================
  const meetingsOverview = useMemo(
    () => computePlcMeetingsOverview(community),
    [community]
  );

  const executionOverview = useMemo(
    () => computePlcExecutionOverview(community),
    [community]
  );

  const filteredMeetings = useMemo(
    () =>
      filterAndSortPlcMeetings(community.meetings, community, {
        searchQuery: meetingsSearchQuery,
        sortBy: meetingsSortBy,
      }),
    [community, meetingsSearchQuery, meetingsSortBy]
  );

  const filteredActivities = useMemo(
    () =>
      filterAndSortPlcActivities(community.activities, community, {
        searchQuery: activitiesSearchQuery,
        typeFilter: activitiesTypeFilter,
        statusFilter: activitiesStatusFilter,
      }),
    [
      community,
      activitiesSearchQuery,
      activitiesTypeFilter,
      activitiesStatusFilter,
    ]
  );

  // ==========================================================================
  // دوال النموذج الخامس (الاجتماعات ومحاضرها)
  // ==========================================================================
  const resetMeetingForm = (nextNum?: number) => {
    setEditingMeetingId(null);
    setMtgNumber(nextNum ?? nextSuggestedMeetingNumber);
    setMtgDate(new Date().toISOString().slice(0, 10));
    setMtgType('اجتماع دوري');
    setMtgVenue(community.venue || '');
    setMtgAttendance(
      buildInitialMeetingAttendanceFromMembers(community.members)
    );
    setMtgAgenda([]);
    setNewAgendaItemText('');
    setMtgDiscussionSummary('');
    setMtgRecommendations([]);
    setRecText('');
    setRecResponsibleMemberId('');
    setRecResponsibleCustomName('');
    setRecTargetDate('');
    setRecFollowupStatus('not_started');
    setRecFollowupNotes('');
    setRecLinkedActionId('');
  };

  // مزامنة أعضاء المجتمع مع قائمة الحضور في النموذج الحالي دون مسح اختيارات الحضور
  const syncedFormAttendance = useMemo(() => {
    const mapById = new Map(mtgAttendance.map((a) => [a.memberId, a]));
    return community.members.map((mbr) => {
      const existing = mapById.get(mbr.id);
      return {
        memberId: mbr.id,
        memberName: mbr.name,
        specialty: mbr.specialty,
        present: existing ? existing.present : true,
        absenceNote: existing ? existing.absenceNote || '' : '',
      };
    });
  }, [community.members, mtgAttendance]);

  const handleSetMemberAttendanceInForm = (
    memberId: string,
    present: boolean
  ) => {
    setMtgAttendance((prev) => {
      const exists = prev.some((a) => a.memberId === memberId);
      if (exists) {
        return prev.map((a) =>
          a.memberId === memberId
            ? {
                ...a,
                present,
                absenceNote: present ? '' : a.absenceNote || '',
              }
            : a
        );
      }
      return [
        ...prev,
        ...community.members
          .filter((m) => !prev.some((p) => p.memberId === m.id))
          .map((m) => ({
            memberId: m.id,
            present: m.id === memberId ? present : true,
            absenceNote: '',
          })),
      ];
    });
  };

  const handleSetMemberAbsenceNoteInForm = (
    memberId: string,
    absenceNote: string
  ) => {
    setMtgAttendance((prev) =>
      prev.map((a) => (a.memberId === memberId ? { ...a, absenceNote } : a))
    );
  };

  const handleAddAgendaItem = () => {
    if (!newAgendaItemText.trim()) return;
    setMtgAgenda((prev) => [...prev, newAgendaItemText.trim()]);
    setNewAgendaItemText('');
  };

  const handleRemoveAgendaItem = (idx: number) => {
    setMtgAgenda((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddRecommendationToForm = () => {
    if (!recText.trim() && !recLinkedActionId) return;

    const linkedAction = community.operationalPlan.find(
      (a) => a.id === recLinkedActionId
    );
    const finalRecText =
      recText.trim() ||
      (linkedAction ? `متابعة تنفيذ: ${linkedAction.title}` : '');
    if (!finalRecText) return;

    const newRec: PlcMeetingRecommendation = {
      id: generatePlcEntityId('rec'),
      text: finalRecText,
      responsibleMemberId: recResponsibleMemberId,
      responsibleName: recResponsibleMemberId
        ? ''
        : recResponsibleCustomName.trim(),
      targetDate: recTargetDate,
      followupStatus: recFollowupStatus,
      followupNotes: recFollowupNotes.trim(),
      linkedActionId: recLinkedActionId,
    };

    setMtgRecommendations((prev) => [...prev, newRec]);
    setRecText('');
    setRecResponsibleMemberId('');
    setRecResponsibleCustomName('');
    setRecTargetDate('');
    setRecFollowupStatus('not_started');
    setRecFollowupNotes('');
    setRecLinkedActionId('');
  };

  const handleRemoveRecommendationFromForm = (recId: string) => {
    setMtgRecommendations((prev) => prev.filter((r) => r.id !== recId));
  };

  const handleSubmitMeetingForm = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedAttendance: PlcMeetingAttendanceEntry[] =
      syncedFormAttendance.map((item) => ({
        memberId: item.memberId,
        present: item.present,
        absenceNote: item.present ? '' : item.absenceNote,
      }));

    // إذا كتب المستخدم بند جدول أعمال أو توصية في الحقل ولم يضغط زر الإضافة الفرعي، ندرجهما تلقائياً حتى لا تضيع بياناته
    const finalAgenda = newAgendaItemText.trim()
      ? [...mtgAgenda, newAgendaItemText.trim()]
      : mtgAgenda;

    let finalRecommendations = [...mtgRecommendations];
    if (recText.trim()) {
      finalRecommendations.push({
        id: generatePlcEntityId('rec'),
        text: recText.trim(),
        responsibleMemberId: recResponsibleMemberId,
        responsibleName: recResponsibleMemberId
          ? ''
          : recResponsibleCustomName.trim(),
        targetDate: recTargetDate,
        followupStatus: recFollowupStatus,
        followupNotes: recFollowupNotes.trim(),
        linkedActionId: recLinkedActionId,
      });
    }

    onUpdateCommunity((current) => {
      if (editingMeetingId) {
        return {
          ...current,
          meetings: updatePlcMeetingRecord(current.meetings, editingMeetingId, {
            meetingNumber: mtgNumber,
            date: mtgDate,
            meetingType: mtgType,
            venue: mtgVenue,
            attendance: normalizedAttendance,
            agenda: finalAgenda,
            discussionSummary: mtgDiscussionSummary,
            recommendations: finalRecommendations,
          }),
        };
      }
      return {
        ...current,
        meetings: addPlcMeetingRecord(
          current.meetings,
          {
            meetingNumber: mtgNumber,
            date: mtgDate,
            meetingType: mtgType,
            venue: mtgVenue,
            attendance: normalizedAttendance,
            agenda: finalAgenda,
            discussionSummary: mtgDiscussionSummary,
            recommendations: finalRecommendations,
          },
          current.members,
          current.venue
        ),
      };
    });

    const wasEditing = Boolean(editingMeetingId);
    const nextNumAfterSave = wasEditing
      ? nextSuggestedMeetingNumber
      : Math.max(nextSuggestedMeetingNumber, mtgNumber) + 1;
    resetMeetingForm(nextNumAfterSave);
    onShowBanner(
      wasEditing
        ? 'تم حفظ تعديلات محضر الاجتماع بنجاح.'
        : 'تم إنشاء وحفظ سجل الاجتماع الجديد كسجل مستقل بنجاح.'
    );
  };

  const handleStartEditMeeting = (mtg: PlcMeetingRecord) => {
    setEditingMeetingId(mtg.id);
    setMtgNumber(mtg.meetingNumber);
    setMtgDate(mtg.date);
    setMtgType(mtg.meetingType);
    setMtgVenue(mtg.venue || '');
    setMtgAttendance(
      mtg.attendance.map((a) => ({
        memberId: a.memberId,
        present: a.present,
        absenceNote: a.absenceNote || '',
      }))
    );
    setMtgAgenda([...mtg.agenda]);
    setMtgDiscussionSummary(mtg.discussionSummary || '');
    setMtgRecommendations(
      mtg.recommendations.map((r) => ({
        ...r,
        responsibleMemberId:
          r.responsibleMemberId &&
          community.members.some((m) => m.id === r.responsibleMemberId)
            ? r.responsibleMemberId
            : '',
        linkedActionId:
          r.linkedActionId &&
          community.operationalPlan.some((a) => a.id === r.linkedActionId)
            ? r.linkedActionId
            : '',
      }))
    );
  };

  const handleInlineUpdateRecommendationStatus = (
    meetingId: string,
    recId: string,
    nextStatus: PlcFollowupStatus
  ) => {
    onUpdateCommunity((current) => ({
      ...current,
      meetings: current.meetings.map((mtg) => {
        if (mtg.id !== meetingId) return mtg;
        return {
          ...mtg,
          recommendations: mtg.recommendations.map((r) =>
            r.id === recId ? { ...r, followupStatus: nextStatus } : r
          ),
        };
      }),
    }));
    onShowBanner('تم تحديث حالة متابعة التوصية بنجاح.');
  };

  const handleConfirmDeleteMeeting = (meetingId: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      meetings: deletePlcMeetingRecord(current.meetings, meetingId),
    }));
    if (editingMeetingId === meetingId) {
      resetMeetingForm();
    }
    if (expandedMeetingId === meetingId) {
      setExpandedMeetingId(null);
    }
    setConfirmDeleteMeetingId(null);
    onShowBanner('تم حذف سجل الاجتماع فقط دون المساس بالأعضاء أو الخطة.');
  };

  // ==========================================================================
  // دوال النموذج السادس (البرامج والأنشطة والزيارات والشراكات)
  // ==========================================================================
  const resetActivityForm = () => {
    setEditingActivityId(null);
    setActTitle('');
    setActNeedId('');
    setActGoalId('');
    setActActionId('');
    setActObjectiveText('');
    setActTargetAudience('');
    setActExecutionDateOrPeriod(new Date().toISOString().slice(0, 10));
    setActResponsibleMemberIds([]);
    setActResponsibleCustomNames('');
    setActStatus('planned');
    setActActualExecutionDescription('');
    setActResults('');
    setActHostOrVisitingEntity('');
    setActParticipantsText('');
    setActKeyObservations('');
    setActLessonsLearned('');
    setActPartnerEntity('');
    setActPartnershipType('');
  };

  const handleToggleActivityResponsibleMember = (memberId: string) => {
    setActResponsibleMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmitActivityForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;

    onUpdateCommunity((current) => {
      if (editingActivityId) {
        return {
          ...current,
          activities: updatePlcActivityRecord(
            current.activities,
            editingActivityId,
            {
              title: actTitle,
              type: actType,
              needId: actNeedId,
              goalId: actGoalId,
              actionId: actActionId,
              objectiveText: actObjectiveText,
              targetAudience: actTargetAudience,
              executionDateOrPeriod: actExecutionDateOrPeriod,
              responsibleMemberIds: actResponsibleMemberIds,
              responsibleNames: actResponsibleCustomNames,
              status: actStatus,
              actualExecutionDescription: actActualExecutionDescription,
              results: actResults,
              hostOrVisitingEntity: actHostOrVisitingEntity,
              participantsText: actParticipantsText,
              keyObservations: actKeyObservations,
              lessonsLearned: actLessonsLearned,
              partnerEntity: actPartnerEntity,
              partnershipType: actPartnershipType,
            }
          ),
        };
      }
      return {
        ...current,
        activities: addPlcActivityRecord(current.activities, {
          title: actTitle,
          type: actType,
          needId: actNeedId,
          goalId: actGoalId,
          actionId: actActionId,
          objectiveText: actObjectiveText,
          targetAudience: actTargetAudience,
          executionDateOrPeriod: actExecutionDateOrPeriod,
          responsibleMemberIds: actResponsibleMemberIds,
          responsibleNames: actResponsibleCustomNames,
          status: actStatus,
          actualExecutionDescription: actActualExecutionDescription,
          results: actResults,
          hostOrVisitingEntity: actHostOrVisitingEntity,
          participantsText: actParticipantsText,
          keyObservations: actKeyObservations,
          lessonsLearned: actLessonsLearned,
          partnerEntity: actPartnerEntity,
          partnershipType: actPartnershipType,
        }),
      };
    });

    const wasEditing = Boolean(editingActivityId);
    resetActivityForm();
    onShowBanner(
      wasEditing
        ? 'تم حفظ تعديلات سجل التنفيذ بنجاح.'
        : `تم إنشاء سجل «${PLC_ACTIVITY_TYPE_LABELS[actType]}» بمعرف ثابت ورمز QR مستقل بنجاح.`
    );
  };

  const handleStartEditActivity = (rec: PlcActivityRecord) => {
    const validNeedExists =
      rec.needId && community.needs.some((n) => n.id === rec.needId);
    const validGoalExists =
      rec.goalId && community.identity.goals.some((g) => g.id === rec.goalId);
    const validActionExists =
      rec.actionId &&
      community.operationalPlan.some((a) => a.id === rec.actionId);
    const validMemberIds = (rec.responsibleMemberIds ?? []).filter((mId) =>
      community.members.some((m) => m.id === mId)
    );

    setEditingActivityId(rec.id);
    setActType(rec.type);
    setActTitle(rec.title);
    setActNeedId(validNeedExists ? rec.needId || '' : '');
    setActGoalId(validGoalExists ? rec.goalId || '' : '');
    setActActionId(validActionExists ? rec.actionId || '' : '');
    setActObjectiveText(rec.objectiveText || '');
    setActTargetAudience(rec.targetAudience || '');
    setActExecutionDateOrPeriod(rec.executionDateOrPeriod || '');
    setActResponsibleMemberIds(validMemberIds);
    setActResponsibleCustomNames(rec.responsibleNames || '');
    setActStatus(rec.status);
    setActActualExecutionDescription(rec.actualExecutionDescription || '');
    setActResults(rec.results || '');
    setActHostOrVisitingEntity(rec.hostOrVisitingEntity || '');
    setActParticipantsText(rec.participantsText || '');
    setActKeyObservations(rec.keyObservations || '');
    setActLessonsLearned(rec.lessonsLearned || '');
    setActPartnerEntity(rec.partnerEntity || '');
    setActPartnershipType(rec.partnershipType || '');
  };

  const handleInlineUpdateActivityStatus = (
    recordId: string,
    nextStatus: PlcActivityRecordStatus
  ) => {
    onUpdateCommunity((current) => ({
      ...current,
      activities: updatePlcActivityRecord(current.activities, recordId, {
        status: nextStatus,
      }),
    }));
    onShowBanner('تم تحديث حالة سجل التنفيذ.');
  };

  const handleConfirmDeleteActivity = (recordId: string) => {
    onUpdateCommunity((current) => ({
      ...current,
      activities: deletePlcActivityRecord(current.activities, recordId),
    }));
    if (editingActivityId === recordId) {
      resetActivityForm();
    }
    setConfirmDeleteActivityId(null);
    onShowBanner(
      'تم حذف سجل التنفيذ فقط دون المساس بالهدف أو الاحتياج أو الإجراء المرتبط.'
    );
  };

  // ==========================================================================
  // دوال الشواهد والمرفقات (بحد أقصى ٤ شواهد لكل سجل)
  // ==========================================================================
  const handleFileUploadForRecord = (
    targetType: 'activity' | 'meeting',
    targetId: string,
    files: FileList | null,
    replaceOldEvidenceId?: string
  ) => {
    if (!files || files.length === 0) return;
    setEvidenceErrorBanner(null);

    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      let errorMsg: string | null = null;

      onUpdateCommunity((current) => {
        const result = replaceOldEvidenceId
          ? replacePlcEvidenceOnRecord(
              current,
              targetType,
              targetId,
              replaceOldEvidenceId,
              {
                title: file.name,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                fileDataUrl: dataUrl,
              }
            )
          : attachPlcEvidenceToRecord(current, targetType, targetId, {
              title: file.name,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileDataUrl: dataUrl,
            });

        if (!result.ok) {
          errorMsg = result.error || 'تعذر إرفاق الشاهد.';
          return current;
        }
        return result.community;
      });

      if (errorMsg) {
        setEvidenceErrorBanner(errorMsg);
      } else {
        onShowBanner(
          replaceOldEvidenceId
            ? `تم استبدال الشاهد بالملف «${file.name}» بنجاح.`
            : `تم إرفاق الشاهد «${file.name}» بالسجل بنجاح.`
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLinkExistingEvidenceToRecord = (
    targetType: 'activity' | 'meeting',
    targetId: string,
    existingEvidenceId: string
  ) => {
    if (!existingEvidenceId) return;
    setEvidenceErrorBanner(null);

    const foundEv = community.evidenceRepository.find(
      (e) => e.id === existingEvidenceId
    );
    if (!foundEv) return;

    let errorMsg: string | null = null;
    onUpdateCommunity((current) => {
      const res = attachPlcEvidenceToRecord(current, targetType, targetId, {
        existingEvidenceId: foundEv.id,
        fileName: foundEv.fileName || foundEv.title,
        mimeType: foundEv.mimeType || 'application/octet-stream',
      });
      if (!res.ok) {
        errorMsg = res.error || 'تعذر ربط الشاهد.';
        return current;
      }
      return res.community;
    });

    if (errorMsg) {
      setEvidenceErrorBanner(errorMsg);
    } else {
      onShowBanner(
        'تم ربط الشاهد الموجود في مستودع المجتمع بهذا السجل دون تكرار رفعه.'
      );
    }
  };

  const handleConfirmRemoveEvidence = () => {
    if (!confirmDeleteEvidenceRef) return;
    const { targetType, targetId, evidenceId } = confirmDeleteEvidenceRef;
    onUpdateCommunity((current) =>
      removePlcEvidenceFromRecord(current, targetType, targetId, evidenceId)
    );
    setConfirmDeleteEvidenceRef(null);
    onShowBanner('تم حذف الشاهد المرتبط بهذا السجل فقط دون حذف السجل نفسه.');
  };

  // مكون فرعي لإدارة الشواهد الاختيارية (بحد أقصى ٤ شواهد) داخل أي سجل تنفيذ أو اجتماع
  const renderRecordEvidencesManager = (
    targetType: 'activity' | 'meeting',
    targetId: string,
    evidenceIds: string[] = []
  ) => {
    const attachedEvidences = getPlcRecordEvidences(community, evidenceIds);
    const availableRepoEvidences = community.evidenceRepository.filter(
      (ev) => !evidenceIds.includes(ev.id)
    );
    const isAtLimit = attachedEvidences.length >= PLC_MAX_EVIDENCES_PER_RECORD;

    return (
      <div
        data-testid={`plc-evidences-box-${targetId}`}
        className="rounded-xl bg-stone-50 border border-stone-200 p-3.5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-plc" />
            <span className="text-xs font-extrabold text-stone-900">
              الشواهد والمرفقات التوثيقية (اختيارية • بحد أقصى ٤ شواهد للسجل)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-plc-soft text-plc text-[11px] font-extrabold tabular-nums">
              {attachedEvidences.length} / {PLC_MAX_EVIDENCES_PER_RECORD}
            </span>
          </div>

          {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <label
              data-testid={`plc-upload-evidence-label-${targetId}`}
              className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isAtLimit
                  ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                  : 'bg-plc hover:bg-plc-hover text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>رفع شاهد جديد</span>
              <input
                type="file"
                disabled={isAtLimit}
                data-testid={`plc-upload-evidence-input-${targetId}`}
                onChange={(e) => {
                  handleFileUploadForRecord(
                    targetType,
                    targetId,
                    e.target.files
                  );
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            {availableRepoEvidences.length > 0 && !isAtLimit && (
              <select
                data-testid={`plc-link-existing-evidence-select-${targetId}`}
                defaultValue=""
                onChange={(e) => {
                  handleLinkExistingEvidenceToRecord(
                    targetType,
                    targetId,
                    e.target.value
                  );
                  e.target.value = '';
                }}
                className="min-h-[34px] px-2.5 py-1 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-800 focus:outline-none focus:border-plc"
              >
                <option value="" disabled>
                  + ربط شاهد موجود في المستودع دون إعادة رفعه
                </option>
                {availableRepoEvidences.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.fileName || ev.title} ({ev.mimeType || 'ملف'})
                  </option>
                ))}
              </select>
            )}
          </div>
          )}
        </div>

        {isAtLimit && (
          <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            وصل هذا السجل إلى الحد الأقصى المسموح به للمرفقات (٤ شواهد). يمكنك
            استبدال أحد الشواهد الحالية أو حذفه.
          </p>
        )}

        {attachedEvidences.length === 0 ? (
          <p className="text-xs text-stone-500">
            لا توجد شواهد مرفقة بهذا السجل حالياً (إرفاق الشواهد اختياري).
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {attachedEvidences.map((ev, evIdx) => {
              const isConfirmingDel =
                confirmDeleteEvidenceRef?.targetId === targetId &&
                confirmDeleteEvidenceRef?.evidenceId === ev.id;

              return (
                <div
                  key={ev.id}
                  data-testid={`plc-evidence-card-${targetId}-${evIdx}`}
                  className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-extrabold text-stone-900 truncate">
                        {ev.fileName || ev.title}
                      </p>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                        النوع: {ev.mimeType || 'ملف توثيقي'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid={`plc-preview-evidence-btn-${targetId}-${evIdx}`}
                        onClick={() => setPreviewEvidenceItem(ev)}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                        title="معاينة الشاهد"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {!readOnly && (
                        <>
                          <label
                            className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                            title="استبدال الشاهد"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              onChange={(e) => {
                                handleFileUploadForRecord(
                                  targetType,
                                  targetId,
                                  e.target.files,
                                  ev.id
                                );
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="button"
                            data-testid={`plc-delete-evidence-btn-${targetId}-${evIdx}`}
                            onClick={() =>
                              setConfirmDeleteEvidenceRef({
                                targetType,
                                targetId,
                                evidenceId: ev.id,
                              })
                            }
                            className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            title="حذف الشاهد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isConfirmingDel && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-red-900">
                        حذف هذا الشاهد فقط؟
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`plc-confirm-delete-evidence-yes-${targetId}-${evIdx}`}
                          onClick={handleConfirmRemoveEvidence}
                          className="px-2.5 py-1 rounded-md bg-red-700 text-white font-extrabold cursor-pointer"
                        >
                          نعم، حذف الشاهد
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteEvidenceRef(null)}
                          className="px-2 py-1 rounded-md bg-white border border-stone-300 text-stone-700 font-bold cursor-pointer"
                        >
                          تراجع
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // أزرار التنقل السفلي بين النماذج
  const renderFormNavigationFooter = () => {
    const prevForm = (activeFormNumber - 1) as PlcFormNumber;
    const nextForm =
      activeFormNumber < 8 ? ((activeFormNumber + 1) as PlcFormNumber) : null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
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
    );
  };

  // نافذة معاينة رمز QR المستقل للسجل
  const renderQrModal = () => {
    if (!qrModalInfo) return null;
    const payload = buildPlcRecordQrPayload(
      community.id,
      qrModalInfo.recordKind,
      qrModalInfo.recordId,
      qrModalInfo.qrCodeToken
    );
    const svgUrl = generatePlcRecordQrSvgDataUrl(
      community.id,
      qrModalInfo.recordKind,
      qrModalInfo.recordId,
      qrModalInfo.qrCodeToken
    );
    const parsedCheck = parsePlcRecordQrPayload(payload);

    return (
      <div
        data-testid="plc-qr-modal"
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl border border-plc-border max-w-md w-full p-6 space-y-4 shadow-xl text-center">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="text-right">
              <span className="text-xs font-extrabold text-plc block">
                رمز QR مستقل وآمن للسجل
              </span>
              <h4 className="text-base font-extrabold text-stone-900">
                {qrModalInfo.title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setQrModalInfo(null)}
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-plc-soft/50 border border-plc-border rounded-2xl p-4 flex flex-col items-center gap-3">
            <img
              src={svgUrl}
              alt="رمز QR للسجل"
              data-testid="plc-qr-modal-img"
              className="w-44 h-44 rounded-xl border border-plc-border bg-white p-2"
            />
            <p className="text-xs font-bold text-stone-700">
              {qrModalInfo.subtitle}
            </p>
            <code
              dir="ltr"
              data-testid="plc-qr-modal-payload"
              className="text-[11px] bg-white px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700 break-all block w-full"
            >
              {payload}
            </code>
          </div>

          <p className="text-[11px] text-stone-600 leading-relaxed text-right">
            يحتوي رمز QR حصرياً على المعرف الداخلي للسجل (
            <strong>{parsedCheck?.recordId}</strong>) ولا يتضمن أي بيانات شخصية
            أو محتوى مباشر للشواهد حفاظاً على الخصوصية، وهو جاهز للتضمين المباشر
            في التقرير الختامي (PDF).
          </p>

          <button
            type="button"
            onClick={() => setQrModalInfo(null)}
            className="w-full min-h-[40px] rounded-xl bg-plc text-white text-xs font-extrabold cursor-pointer"
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    );
  };

  // نافذة معاينة الشاهد
  const renderEvidencePreviewModal = () => {
    if (!previewEvidenceItem) return null;
    const isImage =
      previewEvidenceItem.mimeType?.startsWith('image/') ||
      previewEvidenceItem.fileDataUrl?.startsWith('data:image/');

    return (
      <div
        data-testid="plc-evidence-preview-modal"
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl border border-plc-border max-w-xl w-full p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <span className="text-xs font-extrabold text-plc block">
                معاينة الشاهد المرفق
              </span>
              <h4 className="text-base font-extrabold text-stone-900">
                {previewEvidenceItem.fileName || previewEvidenceItem.title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setPreviewEvidenceItem(null)}
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-xs space-y-2">
            <div>
              <strong>اسم الملف:</strong>{' '}
              {previewEvidenceItem.fileName || previewEvidenceItem.title}
            </div>
            <div>
              <strong>نوع الملف:</strong>{' '}
              {previewEvidenceItem.mimeType || 'ملف توثيقي'}
            </div>
            {isImage && previewEvidenceItem.fileDataUrl && (
              <div className="pt-2 flex justify-center">
                <img
                  src={previewEvidenceItem.fileDataUrl}
                  alt={previewEvidenceItem.fileName}
                  className="max-h-72 rounded-xl border border-stone-200 object-contain bg-white"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPreviewEvidenceItem(null)}
            className="w-full min-h-[40px] rounded-xl bg-plc text-white text-xs font-extrabold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // العرض ١: النموذج الخامس — الاجتماعات ومحاضرها
  // ==========================================================================
  if (activeFormNumber === 5) {
    return (
      <section
        data-testid="plc-form-5-container"
        className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>الدفعة الثالثة: الاجتماعات والتنفيذ والتوثيق • النموذج ٥</span>
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              النموذج الخامس: الاجتماعات ومحاضرها
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              توثيق اجتماعات المجتمع كسجلات مستقلة، ورصد الحضور والغياب تلقائياً
              من أعضاء النموذج الأول، وربط التوصيات بإجراءات الخطة التشغيلية
              بمعرفاتها الثابتة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
            <span className="px-3 py-1.5 rounded-xl bg-plc-soft text-plc tabular-nums">
              عدد الاجتماعات: {meetingsOverview.totalMeetingsCount}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
              توصيات منفذة: {meetingsOverview.completedRecommendationsCount} /{' '}
              {meetingsOverview.totalRecommendationsCount}
            </span>
          </div>
        </div>

        {evidenceErrorBanner && (
          <div
            data-testid="plc-evidence-error-banner"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm font-bold text-red-900 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>{evidenceErrorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setEvidenceErrorBanner(null)}
              className="text-xs underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* نموذج إنشاء / تعديل اجتماع مستقل */}
        {!readOnly && (
        <form
          onSubmit={handleSubmitMeetingForm}
          data-testid="plc-f5-meeting-form"
          className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-3">
            <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
              {editingMeetingId
                ? `تعديل بيانات الاجتماع رقم (${mtgNumber})`
                : 'إنشاء محضر اجتماع جديد (سجل مستقل)'}
            </h4>
            <span className="text-xs text-stone-500">
              كل اجتماع يحفظ في سجل مستقل بمعرف فريد ورمز QR خاص به
            </span>
          </div>

          {/* ١. البيانات الأساسية للاجتماع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="plc-f5-number"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                رقم الاجتماع *
              </label>
              <input
                id="plc-f5-number"
                data-testid="plc-f5-number-input"
                type="number"
                min={1}
                required
                value={mtgNumber}
                onChange={(e) =>
                  setMtgNumber(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f5-date"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                تاريخ الاجتماع *
              </label>
              <input
                id="plc-f5-date"
                data-testid="plc-f5-date-input"
                type="date"
                required
                value={mtgDate}
                onChange={(e) => setMtgDate(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>

            <div>
              <label
                htmlFor="plc-f5-type"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                نوع الاجتماع (اختيار أو كتابة حرة) *
              </label>
              <input
                id="plc-f5-type"
                data-testid="plc-f5-type-input"
                type="text"
                required
                value={mtgType}
                onChange={(e) => setMtgType(e.target.value)}
                placeholder="مثال: اجتماع دوري / اجتماع تحليل نتائج"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {MEETING_TYPE_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setMtgType(sug)}
                    className="px-2 py-0.5 rounded-md bg-white border border-stone-200 hover:border-plc text-[10px] font-bold text-stone-700 cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="plc-f5-venue"
                className="block text-xs font-extrabold text-stone-800 mb-1"
              >
                مكان الاجتماع
              </label>
              <input
                id="plc-f5-venue"
                data-testid="plc-f5-venue-input"
                type="text"
                value={mtgVenue}
                onChange={(e) => setMtgVenue(e.target.value)}
                placeholder={community.venue || 'قاعة الاجتماعات / مصادر التعلم'}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
              />
            </div>
          </div>

          {/* ٢. الحضور والغياب (مستمد تلقائياً من أعضاء المجتمع في النموذج الأول عبر المعرف الثابت) */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
                  الحضور والغياب (مرتبط تلقائياً بأعضاء المجتمع في النموذج الأول)
                </h5>
                <p className="text-[11px] text-stone-500">
                  لا يلزم إعادة كتابة أسماء الأعضاء؛ أي تعديل في اسم العضو داخل
                  النموذج الأول ينعكس تلقائياً في جميع الاجتماعات.
                </p>
              </div>
              {community.members.length === 0 && (
                <button
                  type="button"
                  onClick={() => onSelectFormNumber(1)}
                  className="text-xs font-extrabold text-plc hover:underline cursor-pointer"
                >
                  الانتقال للنموذج الأول لإضافة أعضاء المجتمع
                </button>
              )}
            </div>

            {syncedFormAttendance.length === 0 ? (
              <p className="text-xs text-stone-500">
                لا يوجد أعضاء مسجلون في النموذج الأول حالياً.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {syncedFormAttendance.map((att, idx) => (
                  <div
                    key={att.memberId}
                    data-testid={`plc-f5-attendance-row-${idx}`}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs sm:text-sm font-extrabold text-stone-900 block">
                          {att.memberName}
                        </span>
                        {att.specialty && (
                          <span className="text-[11px] text-stone-500">
                            {att.specialty}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`plc-f5-att-present-btn-${idx}`}
                          onClick={() =>
                            handleSetMemberAttendanceInForm(att.memberId, true)
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold border cursor-pointer ${
                            att.present
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-stone-600 border-stone-300'
                          }`}
                        >
                          حاضر
                        </button>
                        <button
                          type="button"
                          data-testid={`plc-f5-att-absent-btn-${idx}`}
                          onClick={() =>
                            handleSetMemberAttendanceInForm(att.memberId, false)
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold border cursor-pointer ${
                            !att.present
                              ? 'bg-red-700 text-white border-red-700'
                              : 'bg-white text-stone-600 border-stone-300'
                          }`}
                        >
                          غائب
                        </button>
                      </div>
                    </div>

                    {!att.present && (
                      <input
                        type="text"
                        data-testid={`plc-f5-att-note-input-${idx}`}
                        value={att.absenceNote}
                        onChange={(e) =>
                          handleSetMemberAbsenceNoteInForm(
                            att.memberId,
                            e.target.value
                          )
                        }
                        placeholder="ملاحظة الغياب أو العذر (اختياري)..."
                        className="w-full min-h-[34px] px-3 py-1 rounded-lg border border-red-200 bg-white text-xs text-stone-800 focus:outline-none focus:border-red-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ٣. جدول الأعمال وملخص المناقشات */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <label
                htmlFor="plc-f5-agenda-input"
                className="block text-xs sm:text-sm font-extrabold text-stone-900"
              >
                جدول الأعمال
              </label>
              <div className="flex gap-2">
                <input
                  id="plc-f5-agenda-input"
                  data-testid="plc-f5-agenda-input"
                  type="text"
                  value={newAgendaItemText}
                  onChange={(e) => setNewAgendaItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAgendaItem();
                    }
                  }}
                  placeholder="أضف بنداً لجدول الأعمال..."
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
                <button
                  type="button"
                  data-testid="plc-f5-add-agenda-btn"
                  onClick={handleAddAgendaItem}
                  className="px-4 py-1.5 rounded-xl bg-plc text-white text-xs font-extrabold cursor-pointer shrink-0"
                >
                  + إضافة بند
                </button>
              </div>

              {mtgAgenda.length > 0 && (
                <ul className="space-y-1.5">
                  {mtgAgenda.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-stone-800"
                    >
                      <span>
                        {idx + 1}. {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAgendaItem(idx)}
                        className="text-red-600 hover:underline text-[11px] cursor-pointer"
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
              <label
                htmlFor="plc-f5-discussion"
                className="block text-xs sm:text-sm font-extrabold text-stone-900"
              >
                ملخص المناقشات
              </label>
              <textarea
                id="plc-f5-discussion"
                data-testid="plc-f5-discussion-textarea"
                rows={4}
                value={mtgDiscussionSummary}
                onChange={(e) => setMtgDiscussionSummary(e.target.value)}
                placeholder="ملخص أبرز ما دار في الاجتماع من مناقشات ومداولات مهنية..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc leading-relaxed"
              />
            </div>
          </div>

          {/* ٤. القرارات والتوصيات وربطها بالخطة التشغيلية */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
            <div>
              <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
                القرارات والتوصيات ومتابعة تنفيذها (مع الربط بالخطة التشغيلية)
              </h5>
              <p className="text-[11px] text-stone-500">
                يمكنك ربط التوصية بإجراء موجود في الخطة التشغيلية عبر معرفه دون
                إعادة كتابة اسم الإجراء.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              <div className="sm:col-span-2">
                <label className="block text-xs font-extrabold text-stone-800 mb-1">
                  نص التوصية أو القرار
                </label>
                <input
                  type="text"
                  data-testid="plc-f5-rec-text-input"
                  value={recText}
                  onChange={(e) => setRecText(e.target.value)}
                  placeholder="اكتب نص التوصية أو القرار..."
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-stone-800 mb-1">
                  ربط بإجراء في الخطة التشغيلية (اختياري)
                </label>
                <select
                  data-testid="plc-f5-rec-action-select"
                  value={recLinkedActionId}
                  onChange={(e) => setRecLinkedActionId(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                >
                  <option value="">-- بدون ربط بإجراء أو اختر إجراءً --</option>
                  {community.operationalPlan.map((act, i) => (
                    <option key={act.id} value={act.id}>
                      إجراء ({i + 1}): {act.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-stone-800 mb-1">
                  الشخص المسؤول (من الأعضاء)
                </label>
                <select
                  data-testid="plc-f5-rec-member-select"
                  value={recResponsibleMemberId}
                  onChange={(e) => setRecResponsibleMemberId(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                >
                  <option value="">-- اختر عضواً مسؤولاً --</option>
                  {community.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-stone-800 mb-1">
                  الموعد المستهدف للتنفيذ
                </label>
                <input
                  type="date"
                  data-testid="plc-f5-rec-date-input"
                  value={recTargetDate}
                  onChange={(e) => setRecTargetDate(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-stone-800 mb-1">
                  حالة المتابعة
                </label>
                <select
                  data-testid="plc-f5-rec-status-select"
                  value={recFollowupStatus}
                  onChange={(e) =>
                    setRecFollowupStatus(e.target.value as PlcFollowupStatus)
                  }
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                >
                  <option value="not_started">
                    {PLC_FOLLOWUP_STATUS_LABELS.not_started}
                  </option>
                  <option value="in_progress">
                    {PLC_FOLLOWUP_STATUS_LABELS.in_progress}
                  </option>
                  <option value="completed">
                    {PLC_FOLLOWUP_STATUS_LABELS.completed}
                  </option>
                  <option value="delayed">
                    {PLC_FOLLOWUP_STATUS_LABELS.delayed}
                  </option>
                  <option value="cancelled">
                    {PLC_FOLLOWUP_STATUS_LABELS.cancelled}
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-extrabold text-stone-800 mb-1">
                  ملاحظات المتابعة (اختياري)
                </label>
                <input
                  type="text"
                  data-testid="plc-f5-rec-notes-input"
                  value={recFollowupNotes}
                  onChange={(e) => setRecFollowupNotes(e.target.value)}
                  placeholder="أي ملاحظات حول متابعة التنفيذ..."
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  data-testid="plc-f5-add-rec-btn"
                  onClick={handleAddRecommendationToForm}
                  className="w-full min-h-[38px] px-4 py-1.5 rounded-xl bg-plc text-white text-xs font-extrabold cursor-pointer"
                >
                  + إدراج التوصية في الاجتماع
                </button>
              </div>
            </div>

            {mtgRecommendations.length > 0 && (
              <div className="space-y-2">
                {mtgRecommendations.map((rec, idx) => {
                  const resolved = resolvePlcMeetingRecommendationLinks(
                    rec,
                    community
                  );
                  return (
                    <div
                      key={rec.id}
                      data-testid={`plc-f5-form-rec-item-${idx}`}
                      className="p-3 rounded-xl border border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-extrabold text-stone-900">
                          {idx + 1}. {rec.text}
                        </p>
                        <p className="text-stone-600">
                          المسؤول: {resolved.responsibleDisplayName} • الموعد:{' '}
                          {rec.targetDate || '—'} • الحالة:{' '}
                          {resolved.followupStatusLabel}
                        </p>
                        {rec.linkedActionId && (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-plc-soft text-plc text-[11px] font-bold">
                            الإجراء المرتبط: {resolved.linkedActionDisplayTitle}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveRecommendationFromForm(rec.id)
                        }
                        className="text-red-700 hover:underline font-bold cursor-pointer"
                      >
                        حذف التوصية
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              data-testid="plc-f5-save-meeting-btn"
              className="min-h-[44px] px-6 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                {editingMeetingId
                  ? 'حفظ تعديلات الاجتماع'
                  : 'حفظ الاجتماع كسجل مستقل'}
              </span>
            </button>

            {editingMeetingId && (
              <button
                type="button"
                onClick={() => resetMeetingForm()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
        )}

        {/* شريط البحث والترتيب في قائمة الاجتماعات */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="plc-f5-search-input"
              value={meetingsSearchQuery}
              onChange={(e) => setMeetingsSearchQuery(e.target.value)}
              placeholder="ابحث برقم الاجتماع، النوع، جدول الأعمال، المناقشات، أو التوصيات..."
              className="w-full min-h-[40px] pr-10 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          <div>
            <select
              data-testid="plc-f5-sort-select"
              value={meetingsSortBy}
              onChange={(e) =>
                setMeetingsSortBy(
                  e.target.value as
                    | 'number_asc'
                    | 'number_desc'
                    | 'date_desc'
                    | 'date_asc'
                )
              }
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 focus:outline-none focus:border-plc"
            >
              <option value="number_asc">ترتيب حسب رقم الاجتماع (تصاعدي)</option>
              <option value="number_desc">
                ترتيب حسب رقم الاجتماع (تنازلي)
              </option>
              <option value="date_desc">الأحدث تاريخاً</option>
              <option value="date_asc">الأقدم تاريخاً</option>
            </select>
          </div>
        </div>

        {/* قائمة الاجتماعات المسجلة للمجتمع الحالي */}
        {filteredMeetings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs sm:text-sm text-stone-500">
            {community.meetings.length === 0
              ? 'لم تُسجل اجتماعات في هذا المجتمع حتى الآن. أنشئ أول محضر اجتماع من النموذج أعلاه.'
              : 'لا توجد اجتماعات مطابقة لمعايير البحث الحالية.'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeetings.map((mtg, idx) => {
              const resolvedAtt = resolvePlcMeetingAttendance(mtg, community);
              const presentCount = resolvedAtt.filter((a) => a.present).length;
              const absentCount = resolvedAtt.length - presentCount;
              const isExpanded = expandedMeetingId === mtg.id;
              const isConfirmingDel = confirmDeleteMeetingId === mtg.id;

              return (
                <article
                  key={mtg.id}
                  data-testid={`plc-meeting-card-${idx}`}
                  className="rounded-2xl border border-plc-border bg-white p-4 sm:p-5 space-y-4 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-plc text-white text-xs font-extrabold tabular-nums">
                          الاجتماع رقم ({mtg.meetingNumber})
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
                          {mtg.meetingType}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold tabular-nums">
                          التاريخ: {mtg.date}
                        </span>
                        {mtg.venue && (
                          <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold">
                            المكان: {mtg.venue}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 pt-1">
                        <span>
                          الحضور: <strong className="text-emerald-700">{presentCount}</strong>
                        </span>
                        <span>
                          الغياب: <strong className="text-red-700">{absentCount}</strong>
                        </span>
                        <span>
                          التوصيات: <strong>{mtg.recommendations.length}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid={`plc-meeting-qr-btn-${idx}`}
                        onClick={() =>
                          setQrModalInfo({
                            title: `الاجتماع رقم (${mtg.meetingNumber}) - ${mtg.meetingType}`,
                            subtitle: `تاريخ الانعقاد: ${mtg.date}`,
                            recordKind: 'meeting',
                            recordId: mtg.id,
                            qrCodeToken: mtg.qrCodeToken || mtg.id,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl border border-plc-border bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>رمز QR</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`plc-open-meeting-btn-${idx}`}
                        onClick={() =>
                          setExpandedMeetingId(isExpanded ? null : mtg.id)
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-extrabold cursor-pointer"
                      >
                        {isExpanded
                          ? 'إخفاء تفاصيل المحضر'
                          : 'فتح المحضر والتوصيات'}
                      </button>

                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            data-testid={`plc-edit-meeting-btn-${idx}`}
                            onClick={() => handleStartEditMeeting(mtg)}
                            className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                            title="تعديل الاجتماع"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            data-testid={`plc-delete-meeting-btn-${idx}`}
                            onClick={() => setConfirmDeleteMeetingId(mtg.id)}
                            className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            title="حذف الاجتماع"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isConfirmingDel && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-red-900">
                        هل أنت متأكد من حذف هذا الاجتماع؟ (سيُحذف الاجتماع فقط
                        دون المساس بالأعضاء أو الخطة التشغيلية).
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid={`plc-confirm-delete-meeting-yes-${idx}`}
                          onClick={() => handleConfirmDeleteMeeting(mtg.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-extrabold cursor-pointer"
                        >
                          نعم، حذف الاجتماع
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMeetingId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-bold cursor-pointer"
                        >
                          تراجع
                        </button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div
                      data-testid={`plc-meeting-details-${idx}`}
                      className="pt-3 border-t border-stone-100 space-y-4"
                    >
                      {/* جدول الحضور والغياب المسترجع من معرفات الأعضاء */}
                      <div className="space-y-2">
                        <h6 className="text-xs font-extrabold text-plc">
                          سجل الحضور والغياب:
                        </h6>
                        <div className="flex flex-wrap gap-2">
                          {resolvedAtt.map((att, aIdx) => (
                            <span
                              key={aIdx}
                              className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                att.present
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  : 'bg-red-50 text-red-900 border-red-200'
                              }`}
                            >
                              {att.displayName}: {att.present ? 'حاضر' : 'غائب'}
                              {!att.present && att.absenceNote
                                ? ` (${att.absenceNote})`
                                : ''}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* جدول الأعمال وملخص المناقشات */}
                      {mtg.agenda.length > 0 && (
                        <div>
                          <h6 className="text-xs font-extrabold text-plc mb-1">
                            جدول الأعمال:
                          </h6>
                          <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                            {mtg.agenda.map((ag, agIdx) => (
                              <li key={agIdx}>{ag}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {mtg.discussionSummary && (
                        <div>
                          <h6 className="text-xs font-extrabold text-plc mb-1">
                            ملخص المناقشات:
                          </h6>
                          <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                            {mtg.discussionSummary}
                          </p>
                        </div>
                      )}

                      {/* جدول التوصيات والمتابعة */}
                      <div className="space-y-2">
                        <h6 className="text-xs font-extrabold text-plc">
                          القرارات والتوصيات ومتابعة التنفيذ:
                        </h6>
                        {mtg.recommendations.length === 0 ? (
                          <p className="text-xs text-stone-500">
                            لا توجد توصيات مسجلة في هذا الاجتماع.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-stone-200">
                            <table className="w-full text-right text-xs border-collapse">
                              <thead>
                                <tr className="bg-plc-soft text-plc border-b border-plc-border">
                                  <th className="py-2.5 px-3 font-extrabold">
                                    نص التوصية
                                  </th>
                                  <th className="py-2.5 px-3 font-extrabold">
                                    المسؤول
                                  </th>
                                  <th className="py-2.5 px-3 font-extrabold">
                                    الموعد المستهدف
                                  </th>
                                  <th className="py-2.5 px-3 font-extrabold">
                                    الإجراء المرتبط بالخطة
                                  </th>
                                  <th className="py-2.5 px-3 font-extrabold">
                                    حالة المتابعة
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-200 bg-white">
                                {mtg.recommendations.map((rec, rIdx) => {
                                  const resolved =
                                    resolvePlcMeetingRecommendationLinks(
                                      rec,
                                      community
                                    );
                                  return (
                                    <tr key={rec.id}>
                                      <td className="py-2.5 px-3 font-bold text-stone-900">
                                        <div>{rec.text}</div>
                                        {rec.followupNotes && (
                                          <span className="text-[11px] text-stone-500 block">
                                            ملاحظة: {rec.followupNotes}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-stone-800 font-semibold">
                                        {resolved.responsibleDisplayName}
                                      </td>
                                      <td className="py-2.5 px-3 text-stone-600 tabular-nums">
                                        {rec.targetDate || '—'}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        {resolved.isLinkedActionDeleted ? (
                                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                                            {resolved.linkedActionDisplayTitle}
                                          </span>
                                        ) : resolved.linkedAction ? (
                                          <span className="px-2 py-0.5 rounded-md bg-plc-soft text-plc text-[11px] font-bold">
                                            {resolved.linkedActionDisplayTitle}
                                          </span>
                                        ) : (
                                          <span className="text-stone-400">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <select
                                          data-testid={`plc-meeting-${idx}-rec-status-${rIdx}`}
                                          value={rec.followupStatus}
                                          disabled={readOnly}
                                          onChange={(e) => {
                                            if (readOnly) return;
                                            handleInlineUpdateRecommendationStatus(
                                              mtg.id,
                                              rec.id,
                                              e.target.value as PlcFollowupStatus
                                            );
                                          }}
                                          className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-xs font-extrabold text-stone-900 focus:outline-none focus:border-plc disabled:bg-stone-100"
                                        >
                                          <option value="not_started">
                                            {
                                              PLC_FOLLOWUP_STATUS_LABELS.not_started
                                            }
                                          </option>
                                          <option value="in_progress">
                                            {
                                              PLC_FOLLOWUP_STATUS_LABELS.in_progress
                                            }
                                          </option>
                                          <option value="completed">
                                            {
                                              PLC_FOLLOWUP_STATUS_LABELS.completed
                                            }
                                          </option>
                                          <option value="delayed">
                                            {PLC_FOLLOWUP_STATUS_LABELS.delayed}
                                          </option>
                                          <option value="cancelled">
                                            {
                                              PLC_FOLLOWUP_STATUS_LABELS.cancelled
                                            }
                                          </option>
                                        </select>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* الشواهد الاختيارية للاجتماع (بحد أقصى ٤) */}
                      {renderRecordEvidencesManager(
                        'meeting',
                        mtg.id,
                        mtg.evidenceIds
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {renderFormNavigationFooter()}
        {renderQrModal()}
        {renderEvidencePreviewModal()}
      </section>
    );
  }

  // ==========================================================================
  // العرض ٢: النموذج السادس — البرامج والأنشطة والزيارات والشراكات
  // ==========================================================================
  const selectedGoalInActForm = community.identity.goals.find(
    (g) => g.id === actGoalId
  );
  const selectedNeedInActForm = community.needs.find((n) => n.id === actNeedId);
  const selectedPlanActionInActForm = community.operationalPlan.find(
    (a) => a.id === actActionId
  );

  return (
    <section
      data-testid="plc-form-6-container"
      className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
            <FolderKanban className="w-3.5 h-3.5" />
            <span>الدفعة الثالثة: الاجتماعات والتنفيذ والتوثيق • النموذج ٦</span>
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
            النموذج السادس: البرامج والأنشطة والزيارات والشراكات
          </h3>
          <p className="text-xs sm:text-sm text-stone-600">
            توثيق سجلات التنفيذ (البرامج، الأنشطة، الزيارات المتبادلة، الشراكات
            المجتمعية) وربطها بالاحتياجات والأهداف والخطة، مع الشواهد الاختيارية
            (حتى ٤ مرفقات) ورمز QR المستقل لكل سجل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold tabular-nums">
          <span className="px-3 py-1.5 rounded-xl bg-plc-soft text-plc">
            برامج: {executionOverview.programsCount}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-plc-soft text-plc">
            أنشطة: {executionOverview.activitiesCount}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-plc-soft text-plc">
            زيارات متبادلة: {executionOverview.mutualVisitsCount}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-plc-soft text-plc">
            شراكات: {executionOverview.partnershipsCount}
          </span>
        </div>
      </div>

      {evidenceErrorBanner && (
        <div
          data-testid="plc-evidence-error-banner"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs sm:text-sm font-bold text-red-900 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{evidenceErrorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setEvidenceErrorBanner(null)}
            className="text-xs underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* نموذج موحد لإنشاء / تعديل سجل تنفيذ جديد */}
      {!readOnly && (
      <form
        onSubmit={handleSubmitActivityForm}
        data-testid="plc-f6-activity-form"
        className="bg-stone-50 rounded-2xl border border-stone-200/90 p-4 sm:p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-3">
          <h4 className="text-sm sm:text-base font-extrabold text-stone-900">
            {editingActivityId
              ? 'تعديل سجل التنفيذ'
              : 'إنشاء سجل تنفيذ جديد (واجهة موحدة)'}
          </h4>
          <span className="text-xs text-stone-500">
            اختر نوع السجل أولاً لتظهر الحقول المخصصة له تلقائياً
          </span>
        </div>

        {/* ١. اختيار نوع السجل قبل الإنشاء */}
        <div className="space-y-2">
          <span className="block text-xs font-extrabold text-stone-800">
            ١. اختر نوع سجل التنفيذ *:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(
              [
                'program',
                'activity',
                'mutual_visit',
                'community_partnership',
              ] as PlcActivityRecordType[]
            ).map((tKey) => {
              const selected = actType === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  data-testid={`plc-f6-type-btn-${tKey}`}
                  onClick={() => setActType(tKey)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    selected
                      ? 'bg-plc text-white border-plc shadow-2xs'
                      : 'bg-white text-stone-800 border-stone-300 hover:border-plc/60'
                  }`}
                >
                  {PLC_ACTIVITY_TYPE_LABELS[tKey]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ٢. الربط الاختياري بالنماذج السابقة عبر المعرفات الثابتة دون إعادة كتابة البيانات */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
          <div>
            <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
              ٢. الربط بالاحتياجات والأهداف والخطة التشغيلية (عبر المعرفات الثابتة
              IDs • اختياري):
            </h5>
            <p className="text-[11px] text-stone-500">
              لا يلزم إعادة كتابة الهدف أو الإجراء إذا كان مسجلاً؛ اختره من
              القائمة لتظهر بياناته تلقائياً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-stone-800 mb-1">
                ربط باحتياج مهني (النموذج ٣)
              </label>
              <select
                data-testid="plc-f6-need-select"
                value={actNeedId}
                onChange={(e) => setActNeedId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="">-- بدون ربط باحتياج محدد --</option>
                {community.needs.map((n, i) => (
                  <option key={n.id} value={n.id}>
                    احتياج ({i + 1}): {n.description} (
                    {PLC_PRIORITY_LABELS[n.priority]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-stone-800 mb-1">
                ربط بهدف من أهداف المجتمع (النموذج ٢)
              </label>
              <select
                data-testid="plc-f6-goal-select"
                value={actGoalId}
                onChange={(e) => setActGoalId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="">-- بدون ربط بهدف محدد --</option>
                {community.identity.goals.map((g, i) => (
                  <option key={g.id} value={g.id}>
                    هدف ({i + 1}): {g.text}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-stone-800 mb-1">
                ربط بإجراء في الخطة التشغيلية (النموذج ٤)
              </label>
              <select
                data-testid="plc-f6-action-select"
                value={actActionId}
                onChange={(e) => setActActionId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
              >
                <option value="">-- بدون ربط بإجراء محدد --</option>
                {community.operationalPlan.map((a, i) => (
                  <option key={a.id} value={a.id}>
                    إجراء ({i + 1}): {a.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* عرض تلقائي لبيانات العناصر المرتبطة */}
          {(selectedNeedInActForm ||
            selectedGoalInActForm ||
            selectedPlanActionInActForm) && (
            <div
              data-testid="plc-f6-linked-preview-box"
              className="rounded-xl bg-plc-soft border border-plc-border p-3 text-xs space-y-1.5"
            >
              {selectedNeedInActForm && (
                <div>
                  <strong className="text-plc">الاحتياج المرتبط:</strong>{' '}
                  {selectedNeedInActForm.description} (الأولوية:{' '}
                  {PLC_PRIORITY_LABELS[selectedNeedInActForm.priority]})
                </div>
              )}
              {selectedGoalInActForm && (
                <div>
                  <strong className="text-plc">
                    الهدف المعروض تلقائياً:
                  </strong>{' '}
                  {selectedGoalInActForm.text}
                </div>
              )}
              {selectedPlanActionInActForm && (
                <div>
                  <strong className="text-plc">
                    بيانات إجراء الخطة المعروضة تلقائياً:
                  </strong>{' '}
                  {selectedPlanActionInActForm.title} • المؤشر:{' '}
                  {selectedPlanActionInActForm.indicatorText || '—'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ٣. الحقول المشتركة لسجل التنفيذ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="plc-f6-title"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              {actType === 'program'
                ? 'اسم البرنامج *'
                : actType === 'activity'
                  ? 'اسم النشاط *'
                  : actType === 'mutual_visit'
                    ? 'عنوان الزيارة المتبادلة *'
                    : 'عنوان الشراكة المجتمعية *'}
            </label>
            <input
              id="plc-f6-title"
              data-testid="plc-f6-title-input"
              type="text"
              required
              value={actTitle}
              onChange={(e) => setActTitle(e.target.value)}
              placeholder={`أدخل ${PLC_ACTIVITY_TYPE_LABELS[actType]}...`}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          <div>
            <label
              htmlFor="plc-f6-status"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              حالة التنفيذ * (يحددها المستخدم بناءً على الواقع)
            </label>
            <select
              id="plc-f6-status"
              data-testid="plc-f6-status-select"
              value={actStatus}
              onChange={(e) =>
                setActStatus(e.target.value as PlcActivityRecordStatus)
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-900 focus:outline-none focus:border-plc"
            >
              <option value="planned">
                {PLC_ACTIVITY_STATUS_LABELS.planned}
              </option>
              <option value="in_progress">
                {PLC_ACTIVITY_STATUS_LABELS.in_progress}
              </option>
              <option value="completed">
                {PLC_ACTIVITY_STATUS_LABELS.completed}
              </option>
              <option value="cancelled">
                {PLC_ACTIVITY_STATUS_LABELS.cancelled}
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="plc-f6-objective"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              {actType === 'mutual_visit'
                ? 'هدف الزيارة'
                : actType === 'community_partnership'
                  ? 'هدف الشراكة'
                  : 'الهدف'}{' '}
              {selectedGoalInActForm
                ? '(يُعرض تلقائياً من الهدف المرتبط إن تُرك فارغاً)'
                : ''}
            </label>
            <input
              id="plc-f6-objective"
              data-testid="plc-f6-objective-input"
              type="text"
              value={actObjectiveText}
              onChange={(e) => setActObjectiveText(e.target.value)}
              placeholder={
                selectedGoalInActForm
                  ? selectedGoalInActForm.text
                  : 'هدف السجل...'
              }
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          <div>
            <label
              htmlFor="plc-f6-audience"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              الفئة المستهدفة
            </label>
            <input
              id="plc-f6-audience"
              data-testid="plc-f6-audience-input"
              type="text"
              value={actTargetAudience}
              onChange={(e) => setActTargetAudience(e.target.value)}
              placeholder="مثال: معلمو التخصص / طلاب الصف الثالث"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>

          <div>
            <label
              htmlFor="plc-f6-date-period"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              {actType === 'program'
                ? 'فترة التنفيذ'
                : actType === 'mutual_visit'
                  ? 'تاريخ الزيارة'
                  : actType === 'community_partnership'
                    ? 'فترة الشراكة'
                    : 'تاريخ التنفيذ'}
            </label>
            <input
              id="plc-f6-date-period"
              data-testid="plc-f6-date-input"
              type="text"
              value={actExecutionDateOrPeriod}
              onChange={(e) => setActExecutionDateOrPeriod(e.target.value)}
              placeholder="مثال: 2026-10-15 أو الأسبوع الرابع"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          </div>
        </div>

        {/* اختيار المسؤولين من أعضاء النموذج الأول دون إعادة كتابة أسمائهم */}
        <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-2.5">
          <span className="block text-xs font-extrabold text-stone-800">
            المسؤولون عن التنفيذ (اختر من أعضاء المجتمع في النموذج الأول دون
            إعادة كتابة الأسماء):
          </span>
          {community.members.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {community.members.map((mbr, idx) => {
                const checked = actResponsibleMemberIds.includes(mbr.id);
                return (
                  <button
                    key={mbr.id}
                    type="button"
                    data-testid={`plc-f6-member-toggle-${idx}`}
                    onClick={() => handleToggleActivityResponsibleMember(mbr.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                      checked
                        ? 'bg-plc text-white border-plc'
                        : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>{mbr.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {actResponsibleMemberIds.length === 0 && (
            <input
              type="text"
              data-testid="plc-f6-custom-responsible-input"
              value={actResponsibleCustomNames}
              onChange={(e) => setActResponsibleCustomNames(e.target.value)}
              placeholder="أو اكتب اسم المسؤول عند عدم اختياره من القائمة أعلاه..."
              className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
            />
          )}
        </div>

        {/* ٤. الحقول الخاصة حسب نوع السجل (لا تظهر إلا للنوع المختار) */}
        {actType === 'mutual_visit' && (
          <div
            data-testid="plc-f6-mutual-visit-fields"
            className="bg-plc-soft/50 rounded-xl border border-plc-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-extrabold text-plc mb-1">
                الجهة المستضيفة أو الزائرة / المعلم المستضيف
              </label>
              <input
                type="text"
                data-testid="plc-f6-visit-host-input"
                value={actHostOrVisitingEntity}
                onChange={(e) => setActHostOrVisitingEntity(e.target.value)}
                placeholder="مثال: الصف الثاني أ - استضافة أ. محمد القحطاني"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-plc mb-1">
                المشاركون في الزيارة
              </label>
              <input
                type="text"
                data-testid="plc-f6-visit-participants-input"
                value={actParticipantsText}
                onChange={(e) => setActParticipantsText(e.target.value)}
                placeholder="معلمو التخصص المشاركون في الملاحظة الصفية"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-plc mb-1">
                أبرز ما تمت ملاحظته
              </label>
              <input
                type="text"
                data-testid="plc-f6-visit-observations-input"
                value={actKeyObservations}
                onChange={(e) => setActKeyObservations(e.target.value)}
                placeholder="أبرز الممارسات التدريسية والتفاعلات الصفية الملاحظة..."
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-plc mb-1">
                النتائج أو الممارسات المستفادة
              </label>
              <input
                type="text"
                data-testid="plc-f6-visit-lessons-input"
                value={actLessonsLearned}
                onChange={(e) => setActLessonsLearned(e.target.value)}
                placeholder="الممارسات المستفادة القابلة للتعميم..."
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>
          </div>
        )}

        {actType === 'community_partnership' && (
          <div
            data-testid="plc-f6-partnership-fields"
            className="bg-plc-soft/50 rounded-xl border border-plc-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-extrabold text-plc mb-1">
                الجهة الشريكة
              </label>
              <input
                type="text"
                data-testid="plc-f6-partner-entity-input"
                value={actPartnerEntity}
                onChange={(e) => setActPartnerEntity(e.target.value)}
                placeholder="مثال: أولياء الأمور / مركز التدريب التربوي / جامعة..."
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-plc mb-1">
                نوع الشراكة
              </label>
              <input
                type="text"
                data-testid="plc-f6-partnership-type-input"
                value={actPartnershipType}
                onChange={(e) => setActPartnershipType(e.target.value)}
                placeholder="مثال: شراكة معرفية / تدريبية / أسرية..."
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>
          </div>
        )}

        {/* ٥. الفرق الصارم بين «مخطط له» و«منفذ» */}
        {actStatus === 'planned' ? (
          <div
            data-testid="plc-f6-planned-only-notice"
            className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-bold"
          >
            تنبيه منهجي: حالة هذا السجل حالياً «مخطط له». تُحفظ هذه البيانات
            كبيانات تخطيط فقط ولا تُعرض كدليل على التنفيذ الفعلي حتى يقوم المستخدم
            بتحويل الحالة إلى «منفذ» أو «قيد التنفيذ» وتسجيل ما تم تنفيذه فعلياً.
          </div>
        ) : (
          <div
            data-testid="plc-f6-execution-details-fields"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/40 rounded-xl border border-emerald-200 p-4"
          >
            <div>
              <label className="block text-xs font-extrabold text-stone-800 mb-1">
                وصف التنفيذ الفعلي (ما تم تنفيذه فعلياً)
              </label>
              <textarea
                rows={3}
                data-testid="plc-f6-actual-exec-textarea"
                value={actActualExecutionDescription}
                onChange={(e) =>
                  setActActualExecutionDescription(e.target.value)
                }
                placeholder="وثّق ما تم تنفيذه على أرض الواقع..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-stone-800 mb-1">
                النتائج المتحققة
              </label>
              <textarea
                rows={3}
                data-testid="plc-f6-results-textarea"
                value={actResults}
                onChange={(e) => setActResults(e.target.value)}
                placeholder="سجل النتائج الفعلية المرصودة..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            data-testid="plc-f6-save-activity-btn"
            className="min-h-[44px] px-6 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>
              {editingActivityId
                ? 'حفظ تعديلات السجل'
                : `إضافة وحفظ سجل «${PLC_ACTIVITY_TYPE_LABELS[actType]}»`}
            </span>
          </button>

          {editingActivityId && (
            <button
              type="button"
              onClick={resetActivityForm}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
            >
              إلغاء التعديل
            </button>
          )}
        </div>
      </form>
      )}

      {/* شريط البحث والتصفية حسب النوع والحالة */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="plc-f6-search-input"
            value={activitiesSearchQuery}
            onChange={(e) => setActivitiesSearchQuery(e.target.value)}
            placeholder="بحث في سجلات التنفيذ..."
            className="w-full min-h-[40px] pr-10 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-plc"
          />
        </div>

        <div>
          <select
            data-testid="plc-f6-filter-type"
            value={activitiesTypeFilter}
            onChange={(e) =>
              setActivitiesTypeFilter(
                e.target.value as PlcActivityRecordType | 'all'
              )
            }
            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 focus:outline-none focus:border-plc"
          >
            <option value="all">جميع الأنواع (برامج / أنشطة / زيارات / شراكات)</option>
            <option value="program">{PLC_ACTIVITY_TYPE_LABELS.program}</option>
            <option value="activity">
              {PLC_ACTIVITY_TYPE_LABELS.activity}
            </option>
            <option value="mutual_visit">
              {PLC_ACTIVITY_TYPE_LABELS.mutual_visit}
            </option>
            <option value="community_partnership">
              {PLC_ACTIVITY_TYPE_LABELS.community_partnership}
            </option>
          </select>
        </div>

        <div>
          <select
            data-testid="plc-f6-filter-status"
            value={activitiesStatusFilter}
            onChange={(e) =>
              setActivitiesStatusFilter(
                e.target.value as PlcActivityRecordStatus | 'all'
              )
            }
            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-semibold text-stone-800 focus:outline-none focus:border-plc"
          >
            <option value="all">جميع حالات التنفيذ</option>
            <option value="planned">
              {PLC_ACTIVITY_STATUS_LABELS.planned}
            </option>
            <option value="in_progress">
              {PLC_ACTIVITY_STATUS_LABELS.in_progress}
            </option>
            <option value="completed">
              {PLC_ACTIVITY_STATUS_LABELS.completed}
            </option>
            <option value="cancelled">
              {PLC_ACTIVITY_STATUS_LABELS.cancelled}
            </option>
          </select>
        </div>
      </div>

      {/* قائمة سجلات التنفيذ المحفوظة للمجتمع الحالي */}
      {filteredActivities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs sm:text-sm text-stone-500">
          {community.activities.length === 0
            ? 'لم تُسجل برامج أو أنشطة أو زيارات أو شراكات في هذا المجتمع حتى الآن.'
            : 'لا توجد سجلات تنفيذ مطابقة لمعايير التصفية الحالية.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((rec, idx) => {
            const resolved = resolvePlcActivityRecordLinks(rec, community);
            const isConfirmingDel = confirmDeleteActivityId === rec.id;

            return (
              <article
                key={rec.id}
                data-testid={`plc-activity-card-${idx}`}
                className="rounded-2xl border border-plc-border bg-white p-4 sm:p-5 space-y-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-plc text-white text-xs font-extrabold">
                        {PLC_ACTIVITY_TYPE_LABELS[rec.type]}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                          rec.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : rec.status === 'planned'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : rec.status === 'in_progress'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-stone-100 text-stone-600 border-stone-200'
                        }`}
                      >
                        {rec.status === 'planned'
                          ? 'مخطط له (بيانات تخطيط فقط - لم يُنفذ بعد)'
                          : PLC_ACTIVITY_STATUS_LABELS[rec.status]}
                      </span>
                      {rec.executionDateOrPeriod && (
                        <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold tabular-nums">
                          التاريخ / الفترة: {rec.executionDateOrPeriod}
                        </span>
                      )}
                    </div>

                    <h5 className="text-base sm:text-lg font-extrabold text-stone-900">
                      {rec.title}
                    </h5>

                    <div className="text-xs text-stone-600 space-y-1">
                      <div>
                        <strong>الهدف:</strong> {resolved.resolvedObjectiveText}{' '}
                        • <strong>الفئة المستهدفة:</strong>{' '}
                        {rec.targetAudience || '—'} • <strong>المسؤولون:</strong>{' '}
                        {resolved.responsibleDisplayText}
                      </div>
                      {(rec.needId || rec.goalId || rec.actionId) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {rec.needId && (
                            <span className="px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-bold">
                              الاحتياج: {resolved.linkedNeedDisplay}
                            </span>
                          )}
                          {rec.goalId && (
                            <span className="px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-bold">
                              الهدف المرتبط: {resolved.linkedGoalDisplay}
                            </span>
                          )}
                          {rec.actionId && (
                            <span className="px-2.5 py-0.5 rounded-md bg-plc-soft text-plc text-[11px] font-bold">
                              الإجراء في الخطة: {resolved.linkedActionDisplay}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      data-testid={`plc-activity-status-select-${idx}`}
                      value={rec.status}
                      disabled={readOnly}
                      onChange={(e) => {
                        if (readOnly) return;
                        handleInlineUpdateActivityStatus(
                          rec.id,
                          e.target.value as PlcActivityRecordStatus
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-extrabold text-stone-900 disabled:bg-stone-100"
                    >
                      <option value="planned">
                        {PLC_ACTIVITY_STATUS_LABELS.planned}
                      </option>
                      <option value="in_progress">
                        {PLC_ACTIVITY_STATUS_LABELS.in_progress}
                      </option>
                      <option value="completed">
                        {PLC_ACTIVITY_STATUS_LABELS.completed}
                      </option>
                      <option value="cancelled">
                        {PLC_ACTIVITY_STATUS_LABELS.cancelled}
                      </option>
                    </select>

                    <button
                      type="button"
                      data-testid={`plc-activity-qr-btn-${idx}`}
                      onClick={() =>
                        setQrModalInfo({
                          title: `${PLC_ACTIVITY_TYPE_LABELS[rec.type]}: ${rec.title}`,
                          subtitle: `الحالة: ${PLC_ACTIVITY_STATUS_LABELS[rec.status]}`,
                          recordKind: 'activity',
                          recordId: rec.id,
                          qrCodeToken: rec.qrCodeToken || rec.id,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl border border-plc-border bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>رمز QR</span>
                    </button>

                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          data-testid={`plc-edit-activity-btn-${idx}`}
                          onClick={() => handleStartEditActivity(rec)}
                          className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                          title="تعديل السجل"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          data-testid={`plc-delete-activity-btn-${idx}`}
                          onClick={() => setConfirmDeleteActivityId(rec.id)}
                          className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="حذف السجل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isConfirmingDel && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-red-900">
                      هل أنت متأكد من حذف هذا السجل؟ (سيُحذف سجل التنفيذ فقط دون
                      المساس بالهدف أو الاحتياج أو الإجراء المرتبط به).
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`plc-confirm-delete-activity-yes-${idx}`}
                        onClick={() => handleConfirmDeleteActivity(rec.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-extrabold cursor-pointer"
                      >
                        نعم، حذف السجل
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteActivityId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-bold cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                )}

                {/* تفاصيل الزيارة المتبادلة أو الشراكة المجتمعية إن وجدت */}
                {rec.type === 'mutual_visit' &&
                  (rec.hostOrVisitingEntity ||
                    rec.participantsText ||
                    rec.keyObservations ||
                    rec.lessonsLearned) && (
                    <div className="bg-plc-soft/40 rounded-xl border border-plc-border p-3 text-xs space-y-1">
                      {rec.hostOrVisitingEntity && (
                        <div>
                          <strong>الجهة المستضيفة / الزائرة:</strong>{' '}
                          {rec.hostOrVisitingEntity}
                        </div>
                      )}
                      {rec.participantsText && (
                        <div>
                          <strong>المشاركون:</strong> {rec.participantsText}
                        </div>
                      )}
                      {rec.keyObservations && (
                        <div>
                          <strong>أبرز ما تمت ملاحظته:</strong>{' '}
                          {rec.keyObservations}
                        </div>
                      )}
                      {rec.lessonsLearned && (
                        <div>
                          <strong>الممارسات المستفادة:</strong>{' '}
                          {rec.lessonsLearned}
                        </div>
                      )}
                    </div>
                  )}

                {rec.type === 'community_partnership' &&
                  (rec.partnerEntity || rec.partnershipType) && (
                    <div className="bg-plc-soft/40 rounded-xl border border-plc-border p-3 text-xs space-y-1">
                      {rec.partnerEntity && (
                        <div>
                          <strong>الجهة الشريكة:</strong> {rec.partnerEntity}
                        </div>
                      )}
                      {rec.partnershipType && (
                        <div>
                          <strong>نوع الشراكة:</strong> {rec.partnershipType}
                        </div>
                      )}
                    </div>
                  )}

                {/* عرض بيانات التنفيذ الفعلي فقط عندما لا يكون السجل مجرد «مخطط له» */}
                {!resolved.isPlannedOnly &&
                  (rec.actualExecutionDescription || rec.results) && (
                    <div
                      data-testid={`plc-activity-executed-details-${idx}`}
                      className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-3 text-xs space-y-1"
                    >
                      {rec.actualExecutionDescription && (
                        <div>
                          <strong className="text-emerald-900">
                            ما تم تنفيذه فعلياً:
                          </strong>{' '}
                          {rec.actualExecutionDescription}
                        </div>
                      )}
                      {rec.results && (
                        <div>
                          <strong className="text-emerald-900">
                            النتائج المتحققة:
                          </strong>{' '}
                          {rec.results}
                        </div>
                      )}
                    </div>
                  )}

                {/* إدارة الشواهد والمرفقات الاختيارية للسجل (بحد أقصى ٤ شواهد) */}
                {renderRecordEvidencesManager(
                  'activity',
                  rec.id,
                  rec.evidenceIds
                )}
              </article>
            );
          })}
        </div>
      )}

      {renderFormNavigationFooter()}
      {renderQrModal()}
      {renderEvidencePreviewModal()}
    </section>
  );
};
