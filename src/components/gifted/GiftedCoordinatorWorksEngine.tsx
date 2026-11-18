import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Edit3,
  FileText,
  FolderOpen,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  createEmptySection3Data,
  GIFTED_COORDINATOR_WORK_KIND_LABELS,
  GIFTED_READY_TEMPLATE_KINDS,
  GIFTED_SECTION3_FIXED_LOG_LABELS,
  GiftedCoordinatorRecord,
  GiftedMeetingsFixedLogRow,
  GiftedPersonParticipantRef,
  GiftedProgramParticipantsFixedLogRow,
  GiftedReadyTemplateEntry,
  GiftedReadyTemplateKind,
  GiftedSection3Data,
  GiftedSection3FixedLogKind,
  GiftedStudentAchievementsFixedLogRow,
  GiftedStudentsFixedLogRow,
  GiftedVisitsAndPartnershipsFixedLogRow,
  resolveDefaultAcademicYearAndSemester,
} from '../../utils/giftedRecordEngine';

interface GiftedCoordinatorWorksEngineProps {
  record: GiftedCoordinatorRecord;
  settings: SchoolSettings;
  updateRecord: (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => void;
}

const FIXED_LOG_ORDER: readonly GiftedSection3FixedLogKind[] = [
  'giftedStudentsLog',
  'programParticipantsLog',
  'studentAchievementsLog',
  'meetingsLog',
  'visitsAndPartnershipsLog',
] as const;

export const GiftedCoordinatorWorksEngine: React.FC<
  GiftedCoordinatorWorksEngineProps
> = ({ record, settings, updateRecord }) => {
  const centralDefaults = useMemo(
    () => resolveDefaultAcademicYearAndSemester(settings),
    [settings]
  );

  const section3Data: GiftedSection3Data = useMemo(
    () => record.section3Data ?? createEmptySection3Data(),
    [record.section3Data]
  );

  const students = useMemo(() => record.students || [], [record.students]);
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  const legacyArchiveItems = useMemo(
    () => record.coordinatorAdditionalWorks || [],
    [record.coordinatorAdditionalWorks]
  );

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ==========================================================================
  // أولاً: السجلات الخمسة الثابتة
  // ==========================================================================
  const [activeLogKind, setActiveLogKind] =
    useState<GiftedSection3FixedLogKind>('giftedStudentsLog');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(
    null
  );

  // ١. حقول سجل الطلاب الموهوبين (الطالب، الصف، مجال الموهبة، ملاحظات)
  const [gslStudentId, setGslStudentId] = useState('');
  const [gslTalentDomain, setGslTalentDomain] = useState('');
  const [gslNotes, setGslNotes] = useState('');

  // ٢. حقول سجل الطلاب المشاركين في البرامج (الطالب، البرنامج، تاريخ المشاركة، نوع المشاركة)
  const [pplStudentId, setPplStudentId] = useState('');
  const [pplProgramTitle, setPplProgramTitle] = useState('');
  const [pplParticipationDate, setPplParticipationDate] = useState('');
  const [pplParticipationType, setPplParticipationType] = useState('');

  // ٣. حقول سجل إنجازات الطلاب (الطالب، الإنجاز، الجهة أو المسابقة، التاريخ)
  const [salStudentId, setSalStudentId] = useState('');
  const [salAchievement, setSalAchievement] = useState('');
  const [salEntityOrCompetition, setSalEntityOrCompetition] = useState('');
  const [salDate, setSalDate] = useState('');

  // ٤. حقول سجل الاجتماعات (التاريخ، موضوع الاجتماع، الحضور، أبرز التوصيات)
  const [mtgDate, setMtgDate] = useState('');
  const [mtgTopic, setMtgTopic] = useState('');
  const [mtgAttendees, setMtgAttendees] = useState<
    GiftedPersonParticipantRef[]
  >([]);
  const [mtgKeyRecommendations, setMtgKeyRecommendations] = useState('');
  const [mtgSelectedStudentId, setMtgSelectedStudentId] = useState('');
  const [mtgStaffName, setMtgStaffName] = useState('');
  const [mtgStaffRoleTitle, setMtgStaffRoleTitle] = useState('');

  // ٥. حقول سجل الزيارات والشراكات (الجهة أو المكان، التاريخ، الهدف، أبرز النتائج)
  const [vplEntityOrPlace, setVplEntityOrPlace] = useState('');
  const [vplDate, setVplDate] = useState('');
  const [vplPurpose, setVplPurpose] = useState('');
  const [vplKeyResults, setVplKeyResults] = useState('');

  // الصف التلقائي للطالب المختار في السجلات الفردية الثلاثة
  const gslSelectedStudentGrade = useMemo(() => {
    if (!gslStudentId) return '';
    return studentMap.get(gslStudentId)?.grade || '';
  }, [gslStudentId, studentMap]);

  const pplSelectedStudentGrade = useMemo(() => {
    if (!pplStudentId) return '';
    return studentMap.get(pplStudentId)?.grade || '';
  }, [pplStudentId, studentMap]);

  const salSelectedStudentGrade = useMemo(() => {
    if (!salStudentId) return '';
    return studentMap.get(salStudentId)?.grade || '';
  }, [salStudentId, studentMap]);

  const resetFixedLogForm = () => {
    setEditingRowId(null);
    setGslStudentId('');
    setGslTalentDomain('');
    setGslNotes('');
    setPplStudentId('');
    setPplProgramTitle('');
    setPplParticipationDate('');
    setPplParticipationType('');
    setSalStudentId('');
    setSalAchievement('');
    setSalEntityOrCompetition('');
    setSalDate('');
    setMtgDate('');
    setMtgTopic('');
    setMtgAttendees([]);
    setMtgKeyRecommendations('');
    setMtgSelectedStudentId('');
    setMtgStaffName('');
    setMtgStaffRoleTitle('');
    setVplEntityOrPlace('');
    setVplDate('');
    setVplPurpose('');
    setVplKeyResults('');
  };

  const handleSwitchFixedLog = (kind: GiftedSection3FixedLogKind) => {
    setActiveLogKind(kind);
    resetFixedLogForm();
    setConfirmDeleteRowId(null);
    setFeedbackBanner(null);
  };

  const updateSection3 = (
    updater: (prevSec3: GiftedSection3Data) => GiftedSection3Data
  ) => {
    updateRecord((prev) => {
      const currentSec3 = prev.section3Data ?? createEmptySection3Data();
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        section3Data: updater(currentSec3),
      };
    });
  };

  // إضافة حاضر (طالب من السجل المركزي) إلى سجل الاجتماعات
  const handleAddMeetingStudentAttendee = () => {
    if (!mtgSelectedStudentId) return;
    const stu = studentMap.get(mtgSelectedStudentId);
    if (!stu) return;
    if (
      mtgAttendees.some(
        (a) => a.personType === 'student' && a.studentId === stu.id
      )
    ) {
      setMtgSelectedStudentId('');
      return;
    }
    const newAttendee: GiftedPersonParticipantRef = {
      id: `att-stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      personType: 'student',
      studentId: stu.id,
      name: stu.name,
      studentGradeSnapshot: stu.grade,
    };
    setMtgAttendees((prev) => [...prev, newAttendee]);
    setMtgSelectedStudentId('');
  };

  // إضافة حاضر يدوي (معلم / عضو لجنة / إداري) مع roleTitle إلى سجل الاجتماعات
  const handleAddMeetingStaffAttendee = () => {
    const cleanName = mtgStaffName.trim();
    const cleanRole = mtgStaffRoleTitle.trim();
    if (!cleanName) {
      setFeedbackBanner({
        type: 'error',
        message: 'يرجى إدخال اسم المعلم أو عضو اللجنة أو الإداري.',
      });
      return;
    }
    const newAttendee: GiftedPersonParticipantRef = {
      id: `att-stf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      personType: 'staff',
      name: cleanName,
      ...(cleanRole ? { roleTitle: cleanRole } : {}),
    };
    setMtgAttendees((prev) => [...prev, newAttendee]);
    setMtgStaffName('');
    setMtgStaffRoleTitle('');
  };

  const handleRemoveMeetingAttendee = (attendeeId: string) => {
    setMtgAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
  };

  // حفظ صف في السجل الثابت النشط
  const handleSubmitFixedLogRow = (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const defaultYear = centralDefaults.academicYear || '١٤٤٨هـ';
    const defaultSem = centralDefaults.semester;

    if (activeLogKind === 'giftedStudentsLog') {
      if (!gslStudentId) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى اختيار الطالب من السجل المركزي.',
        });
        return;
      }
      const cleanDomain = gslTalentDomain.trim();
      if (!cleanDomain) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى إدخال مجال الموهبة.',
        });
        return;
      }
      const stu = studentMap.get(gslStudentId);
      const existingRow = section3Data.giftedStudentsLog.find(
        (r) => r.id === editingRowId
      );
      const rowPayload: GiftedStudentsFixedLogRow = {
        id:
          editingRowId ||
          `gsl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        studentId: gslStudentId,
        studentGradeSnapshot:
          stu?.grade || existingRow?.studentGradeSnapshot || '',
        talentDomain: cleanDomain,
        notes: gslNotes.trim(),
        academicYear: defaultYear,
        semester: defaultSem,
        createdAt: existingRow?.createdAt || nowIso,
      };
      updateSection3((prev) => ({
        ...prev,
        giftedStudentsLog: editingRowId
          ? prev.giftedStudentsLog.map((r) =>
              r.id === editingRowId ? rowPayload : r
            )
          : [...prev.giftedStudentsLog, rowPayload],
      }));
      resetFixedLogForm();
      setFeedbackBanner({
        type: 'success',
        message: 'تم حفظ الصف في سجل الطلاب الموهوبين.',
      });
      return;
    }

    if (activeLogKind === 'programParticipantsLog') {
      if (!pplStudentId) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى اختيار الطالب من السجل المركزي.',
        });
        return;
      }
      const cleanProg = pplProgramTitle.trim();
      if (!cleanProg) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى إدخال اسم البرنامج.',
        });
        return;
      }
      const stu = studentMap.get(pplStudentId);
      const existingRow = section3Data.programParticipantsLog.find(
        (r) => r.id === editingRowId
      );
      const rowPayload: GiftedProgramParticipantsFixedLogRow = {
        id:
          editingRowId ||
          `ppl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        studentId: pplStudentId,
        studentGradeSnapshot:
          stu?.grade || existingRow?.studentGradeSnapshot || '',
        programTitle: cleanProg,
        participationDate: pplParticipationDate.trim(),
        participationType: pplParticipationType.trim(),
        academicYear: defaultYear,
        semester: defaultSem,
        createdAt: existingRow?.createdAt || nowIso,
      };
      updateSection3((prev) => ({
        ...prev,
        programParticipantsLog: editingRowId
          ? prev.programParticipantsLog.map((r) =>
              r.id === editingRowId ? rowPayload : r
            )
          : [...prev.programParticipantsLog, rowPayload],
      }));
      resetFixedLogForm();
      setFeedbackBanner({
        type: 'success',
        message: 'تم حفظ الصف في سجل الطلاب المشاركين في البرامج.',
      });
      return;
    }

    if (activeLogKind === 'studentAchievementsLog') {
      if (!salStudentId) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى اختيار الطالب من السجل المركزي.',
        });
        return;
      }
      const cleanAch = salAchievement.trim();
      if (!cleanAch) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى إدخال الإنجاز.',
        });
        return;
      }
      const stu = studentMap.get(salStudentId);
      const existingRow = section3Data.studentAchievementsLog.find(
        (r) => r.id === editingRowId
      );
      const rowPayload: GiftedStudentAchievementsFixedLogRow = {
        id:
          editingRowId ||
          `sal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        studentId: salStudentId,
        studentGradeSnapshot:
          stu?.grade || existingRow?.studentGradeSnapshot || '',
        achievement: cleanAch,
        entityOrCompetition: salEntityOrCompetition.trim(),
        date: salDate.trim(),
        academicYear: defaultYear,
        semester: defaultSem,
        createdAt: existingRow?.createdAt || nowIso,
      };
      updateSection3((prev) => ({
        ...prev,
        studentAchievementsLog: editingRowId
          ? prev.studentAchievementsLog.map((r) =>
              r.id === editingRowId ? rowPayload : r
            )
          : [...prev.studentAchievementsLog, rowPayload],
      }));
      resetFixedLogForm();
      setFeedbackBanner({
        type: 'success',
        message: 'تم حفظ الصف في سجل إنجازات الطلاب.',
      });
      return;
    }

    if (activeLogKind === 'meetingsLog') {
      const cleanTopic = mtgTopic.trim();
      if (!cleanTopic) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى إدخال موضوع الاجتماع.',
        });
        return;
      }
      const existingRow = section3Data.meetingsLog.find(
        (r) => r.id === editingRowId
      );
      const rowPayload: GiftedMeetingsFixedLogRow = {
        id:
          editingRowId ||
          `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: mtgDate.trim(),
        topic: cleanTopic,
        attendees: mtgAttendees,
        keyRecommendations: mtgKeyRecommendations.trim(),
        academicYear: defaultYear,
        semester: defaultSem,
        createdAt: existingRow?.createdAt || nowIso,
      };
      updateSection3((prev) => ({
        ...prev,
        meetingsLog: editingRowId
          ? prev.meetingsLog.map((r) =>
              r.id === editingRowId ? rowPayload : r
            )
          : [...prev.meetingsLog, rowPayload],
      }));
      resetFixedLogForm();
      setFeedbackBanner({
        type: 'success',
        message: 'تم حفظ الصف في سجل الاجتماعات.',
      });
      return;
    }

    if (activeLogKind === 'visitsAndPartnershipsLog') {
      const cleanEntity = vplEntityOrPlace.trim();
      if (!cleanEntity) {
        setFeedbackBanner({
          type: 'error',
          message: 'يرجى إدخال الجهة أو المكان.',
        });
        return;
      }
      const existingRow = section3Data.visitsAndPartnershipsLog.find(
        (r) => r.id === editingRowId
      );
      const rowPayload: GiftedVisitsAndPartnershipsFixedLogRow = {
        id:
          editingRowId ||
          `vpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        entityOrPlace: cleanEntity,
        date: vplDate.trim(),
        purpose: vplPurpose.trim(),
        keyResults: vplKeyResults.trim(),
        academicYear: defaultYear,
        semester: defaultSem,
        createdAt: existingRow?.createdAt || nowIso,
      };
      updateSection3((prev) => ({
        ...prev,
        visitsAndPartnershipsLog: editingRowId
          ? prev.visitsAndPartnershipsLog.map((r) =>
              r.id === editingRowId ? rowPayload : r
            )
          : [...prev.visitsAndPartnershipsLog, rowPayload],
      }));
      resetFixedLogForm();
      setFeedbackBanner({
        type: 'success',
        message: 'تم حفظ الصف في سجل الزيارات والشراكات.',
      });
    }
  };

  const handleStartEditFixedRow = (rowId: string) => {
    setEditingRowId(rowId);
    setFeedbackBanner(null);

    if (activeLogKind === 'giftedStudentsLog') {
      const target = section3Data.giftedStudentsLog.find((r) => r.id === rowId);
      if (!target) return;
      setGslStudentId(target.studentId);
      setGslTalentDomain(target.talentDomain);
      setGslNotes(target.notes || '');
      return;
    }
    if (activeLogKind === 'programParticipantsLog') {
      const target = section3Data.programParticipantsLog.find(
        (r) => r.id === rowId
      );
      if (!target) return;
      setPplStudentId(target.studentId);
      setPplProgramTitle(target.programTitle);
      setPplParticipationDate(target.participationDate || '');
      setPplParticipationType(target.participationType || '');
      return;
    }
    if (activeLogKind === 'studentAchievementsLog') {
      const target = section3Data.studentAchievementsLog.find(
        (r) => r.id === rowId
      );
      if (!target) return;
      setSalStudentId(target.studentId);
      setSalAchievement(target.achievement);
      setSalEntityOrCompetition(target.entityOrCompetition || '');
      setSalDate(target.date || '');
      return;
    }
    if (activeLogKind === 'meetingsLog') {
      const target = section3Data.meetingsLog.find((r) => r.id === rowId);
      if (!target) return;
      setMtgDate(target.date || '');
      setMtgTopic(target.topic);
      setMtgAttendees((target.attendees || []).map((a) => ({ ...a })));
      setMtgKeyRecommendations(target.keyRecommendations || '');
      return;
    }
    if (activeLogKind === 'visitsAndPartnershipsLog') {
      const target = section3Data.visitsAndPartnershipsLog.find(
        (r) => r.id === rowId
      );
      if (!target) return;
      setVplEntityOrPlace(target.entityOrPlace);
      setVplDate(target.date || '');
      setVplPurpose(target.purpose || '');
      setVplKeyResults(target.keyResults || '');
    }
  };

  const handleDeleteFixedRow = (rowId: string) => {
    updateSection3((prev) => ({
      ...prev,
      giftedStudentsLog:
        activeLogKind === 'giftedStudentsLog'
          ? prev.giftedStudentsLog.filter((r) => r.id !== rowId)
          : prev.giftedStudentsLog,
      programParticipantsLog:
        activeLogKind === 'programParticipantsLog'
          ? prev.programParticipantsLog.filter((r) => r.id !== rowId)
          : prev.programParticipantsLog,
      studentAchievementsLog:
        activeLogKind === 'studentAchievementsLog'
          ? prev.studentAchievementsLog.filter((r) => r.id !== rowId)
          : prev.studentAchievementsLog,
      meetingsLog:
        activeLogKind === 'meetingsLog'
          ? prev.meetingsLog.filter((r) => r.id !== rowId)
          : prev.meetingsLog,
      visitsAndPartnershipsLog:
        activeLogKind === 'visitsAndPartnershipsLog'
          ? prev.visitsAndPartnershipsLog.filter((r) => r.id !== rowId)
          : prev.visitsAndPartnershipsLog,
    }));
    if (editingRowId === rowId) {
      resetFixedLogForm();
    }
    setConfirmDeleteRowId(null);
  };

  // ==========================================================================
  // ثانياً: النماذج الجاهزة الأربعة (readyTemplates)
  // ==========================================================================
  const [selectedTemplateKind, setSelectedTemplateKind] =
    useState<GiftedReadyTemplateKind>('محضر اجتماع');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<
    string | null
  >(null);

  const [tplTitle, setTplTitle] = useState('');
  const [tplDate, setTplDate] = useState('');
  const [tplSubjectOrPurpose, setTplSubjectOrPurpose] = useState('');
  const [tplRecipientOrEntity, setTplRecipientOrEntity] = useState('');
  const [tplBodyContent, setTplBodyContent] = useState('');
  const [tplRecommendationsOrNotes, setTplRecommendationsOrNotes] =
    useState('');
  const [tplParticipants, setTplParticipants] = useState<
    GiftedPersonParticipantRef[]
  >([]);
  const [tplSelectedStudentId, setTplSelectedStudentId] = useState('');
  const [tplStaffName, setTplStaffName] = useState('');
  const [tplStaffRoleTitle, setTplStaffRoleTitle] = useState('');

  const resetReadyTemplateForm = (keepKind?: GiftedReadyTemplateKind) => {
    setEditingTemplateId(null);
    if (keepKind) setSelectedTemplateKind(keepKind);
    setTplTitle('');
    setTplDate('');
    setTplSubjectOrPurpose('');
    setTplRecipientOrEntity('');
    setTplBodyContent('');
    setTplRecommendationsOrNotes('');
    setTplParticipants([]);
    setTplSelectedStudentId('');
    setTplStaffName('');
    setTplStaffRoleTitle('');
  };

  const handleAddTemplateStudentParticipant = () => {
    if (!tplSelectedStudentId) return;
    const stu = studentMap.get(tplSelectedStudentId);
    if (!stu) return;
    if (
      tplParticipants.some(
        (p) => p.personType === 'student' && p.studentId === stu.id
      )
    ) {
      setTplSelectedStudentId('');
      return;
    }
    setTplParticipants((prev) => [
      ...prev,
      {
        id: `tpl-stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        personType: 'student',
        studentId: stu.id,
        name: stu.name,
        studentGradeSnapshot: stu.grade,
      },
    ]);
    setTplSelectedStudentId('');
  };

  const handleAddTemplateStaffParticipant = () => {
    const cleanName = tplStaffName.trim();
    const cleanRole = tplStaffRoleTitle.trim();
    if (!cleanName) return;
    setTplParticipants((prev) => [
      ...prev,
      {
        id: `tpl-stf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        personType: 'staff',
        name: cleanName,
        ...(cleanRole ? { roleTitle: cleanRole } : {}),
      },
    ]);
    setTplStaffName('');
    setTplStaffRoleTitle('');
  };

  const handleRemoveTemplateParticipant = (participantId: string) => {
    setTplParticipants((prev) => prev.filter((p) => p.id !== participantId));
  };

  const handleSubmitReadyTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = tplTitle.trim();
    if (!cleanTitle) {
      setFeedbackBanner({
        type: 'error',
        message: 'يرجى إدخال عنوان النموذج الجاهز.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = section3Data.readyTemplates.find(
      (t) => t.id === editingTemplateId
    );
    const cleanNotes = tplRecommendationsOrNotes.trim();
    const cleanRecipient = tplRecipientOrEntity.trim();

    const entryPayload: GiftedReadyTemplateEntry = {
      id:
        editingTemplateId ||
        `rtpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      templateKind: selectedTemplateKind,
      title: cleanTitle,
      date: tplDate.trim(),
      subjectOrPurpose: tplSubjectOrPurpose.trim(),
      bodyContent: tplBodyContent.trim(),
      ...(cleanNotes ? { recommendationsOrNotes: cleanNotes } : {}),
      ...(cleanRecipient ? { recipientOrEntity: cleanRecipient } : {}),
      participants: tplParticipants,
      academicYear: centralDefaults.academicYear || '١٤٤٨هـ',
      semester: centralDefaults.semester,
      createdAt: existing?.createdAt || nowIso,
    };

    updateSection3((prev) => ({
      ...prev,
      readyTemplates: editingTemplateId
        ? prev.readyTemplates.map((t) =>
            t.id === editingTemplateId ? entryPayload : t
          )
        : [...prev.readyTemplates, entryPayload],
    }));

    const savedKind = selectedTemplateKind;
    resetReadyTemplateForm(savedKind);
    setFeedbackBanner({
      type: 'success',
      message: `تم حفظ النموذج الجاهز (${savedKind}: ${cleanTitle}).`,
    });
  };

  const handleStartEditReadyTemplate = (entry: GiftedReadyTemplateEntry) => {
    setEditingTemplateId(entry.id);
    setSelectedTemplateKind(entry.templateKind);
    setTplTitle(entry.title);
    setTplDate(entry.date || '');
    setTplSubjectOrPurpose(entry.subjectOrPurpose || '');
    setTplRecipientOrEntity(entry.recipientOrEntity || '');
    setTplBodyContent(entry.bodyContent || '');
    setTplRecommendationsOrNotes(entry.recommendationsOrNotes || '');
    setTplParticipants((entry.participants || []).map((p) => ({ ...p })));
    setFeedbackBanner(null);
  };

  const handleDeleteReadyTemplate = (templateId: string) => {
    updateSection3((prev) => ({
      ...prev,
      readyTemplates: prev.readyTemplates.filter((t) => t.id !== templateId),
    }));
    if (editingTemplateId === templateId) {
      resetReadyTemplateForm(selectedTemplateKind);
    }
    setConfirmDeleteTemplateId(null);
  };

  const resolveStudentDisplay = (
    studentId: string,
    gradeSnapshot?: string
  ): { name: string; grade: string } => {
    const stu = studentMap.get(studentId);
    return {
      name: stu?.name || studentId,
      grade: stu?.grade || gradeSnapshot || '—',
    };
  };

  return (
    <div dir="rtl" className="space-y-8">
      {/* ترويسة القسم الثالث */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <h2 className="text-lg font-extrabold text-stone-900">
          03 نماذج أخرى
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          السجلات الخمسة الثابتة والنماذج الجاهزة الأربعة المعتمدة لمنسق
          الموهوبين
        </p>
      </div>

      {/* تنبيه التغذية الراجعة */}
      {feedbackBanner && (
        <div
          role="alert"
          className={`rounded-xl border p-4 flex items-start gap-3 ${
            feedbackBanner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {feedbackBanner.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-bold flex-1">
            {feedbackBanner.message}
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold underline hover:opacity-80"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* أولاً: السجلات الخمسة الثابتة */}
      {/* ==================================================================== */}
      <section
        aria-label="السجلات الخمسة الثابتة"
        className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-5"
      >
        <div className="border-b border-stone-100 pb-3">
          <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#7F1D3F]" />
            <span>السجلات الخمسة الثابتة</span>
          </h3>
        </div>

        {/* أزرار التبديل بين السجلات الخمسة فقط */}
        <div
          role="tablist"
          aria-label="اختيار السجل الثابت"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2"
        >
          {FIXED_LOG_ORDER.map((logKind) => {
            const label = GIFTED_SECTION3_FIXED_LOG_LABELS[logKind];
            const isActive = activeLogKind === logKind;
            const rowsCount = section3Data[logKind].length;
            return (
              <button
                key={logKind}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSwitchFixedLog(logKind)}
                className={`px-3 py-2.5 rounded-xl border text-right transition-all flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-[#7F1D3F] text-white border-[#7F1D3F] shadow-sm'
                    : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="text-xs font-extrabold leading-snug">
                  {label}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200/70 text-stone-700'
                  }`}
                >
                  {rowsCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* نموذج إضافة / تعديل صف في السجل المفتوح */}
        <form
          onSubmit={handleSubmitFixedLogRow}
          className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2.5">
            <h4 className="text-xs font-extrabold text-[#7F1D3F]">
              {editingRowId ? 'تعديل صف في ' : 'إضافة صف إلى '}
              {GIFTED_SECTION3_FIXED_LOG_LABELS[activeLogKind]}
            </h4>
            {editingRowId && (
              <button
                type="button"
                onClick={resetFixedLogForm}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          {/* ١. سجل الطلاب الموهوبين: الطالب، الصف، مجال الموهبة، ملاحظات */}
          {activeLogKind === 'giftedStudentsLog' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label
                  htmlFor="gsl-student-select"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الطالب <span className="text-red-600">*</span>
                </label>
                <select
                  id="gsl-student-select"
                  value={gslStudentId}
                  onChange={(e) => setGslStudentId(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                >
                  <option value="">— اختر الطالب من السجل المركزي —</option>
                  {students.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="gsl-auto-grade"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الصف (تلقائي من السجل المركزي)
                </label>
                <input
                  id="gsl-auto-grade"
                  type="text"
                  readOnly
                  value={gslSelectedStudentGrade}
                  placeholder="يُجلب تلقائياً عند اختيار الطالب"
                  className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700"
                />
              </div>

              <div>
                <label
                  htmlFor="gsl-talent-domain"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  مجال الموهبة <span className="text-red-600">*</span>
                </label>
                <input
                  id="gsl-talent-domain"
                  type="text"
                  value={gslTalentDomain}
                  onChange={(e) => setGslTalentDomain(e.target.value)}
                  placeholder="مثال: تفوق علمي / ابتكار / رياضيات"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="gsl-notes"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  ملاحظات
                </label>
                <input
                  id="gsl-notes"
                  type="text"
                  value={gslNotes}
                  onChange={(e) => setGslNotes(e.target.value)}
                  placeholder="ملاحظات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ٢. سجل الطلاب المشاركين في البرامج: الطالب، البرنامج، تاريخ المشاركة، نوع المشاركة */}
          {activeLogKind === 'programParticipantsLog' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label
                  htmlFor="ppl-student-select"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الطالب <span className="text-red-600">*</span>
                </label>
                <select
                  id="ppl-student-select"
                  value={pplStudentId}
                  onChange={(e) => setPplStudentId(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                >
                  <option value="">— اختر الطالب من السجل المركزي —</option>
                  {students.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ppl-auto-grade"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الصف (تلقائي)
                </label>
                <input
                  id="ppl-auto-grade"
                  type="text"
                  readOnly
                  value={pplSelectedStudentGrade}
                  placeholder="يُجلب تلقائياً"
                  className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700"
                />
              </div>

              <div>
                <label
                  htmlFor="ppl-program-title"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  البرنامج <span className="text-red-600">*</span>
                </label>
                <input
                  id="ppl-program-title"
                  type="text"
                  value={pplProgramTitle}
                  onChange={(e) => setPplProgramTitle(e.target.value)}
                  placeholder="اسم البرنامج..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="ppl-participation-date"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  تاريخ المشاركة
                </label>
                <input
                  id="ppl-participation-date"
                  type="date"
                  dir="ltr"
                  value={pplParticipationDate}
                  onChange={(e) => setPplParticipationDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="ppl-participation-type"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  نوع المشاركة
                </label>
                <input
                  id="ppl-participation-type"
                  type="text"
                  value={pplParticipationType}
                  onChange={(e) => setPplParticipationType(e.target.value)}
                  placeholder="مثال: حضور / بحث / مشروع"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ٣. سجل إنجازات الطلاب: الطالب، الإنجاز، الجهة أو المسابقة، التاريخ */}
          {activeLogKind === 'studentAchievementsLog' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label
                  htmlFor="sal-student-select"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الطالب <span className="text-red-600">*</span>
                </label>
                <select
                  id="sal-student-select"
                  value={salStudentId}
                  onChange={(e) => setSalStudentId(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                >
                  <option value="">— اختر الطالب من السجل المركزي —</option>
                  {students.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sal-auto-grade"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الصف (تلقائي)
                </label>
                <input
                  id="sal-auto-grade"
                  type="text"
                  readOnly
                  value={salSelectedStudentGrade}
                  placeholder="يُجلب تلقائياً"
                  className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700"
                />
              </div>

              <div>
                <label
                  htmlFor="sal-achievement"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الإنجاز <span className="text-red-600">*</span>
                </label>
                <input
                  id="sal-achievement"
                  type="text"
                  value={salAchievement}
                  onChange={(e) => setSalAchievement(e.target.value)}
                  placeholder="مثال: المركز الأول / ميدالية ذهبية"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sal-entity-competition"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الجهة أو المسابقة
                </label>
                <input
                  id="sal-entity-competition"
                  type="text"
                  value={salEntityOrCompetition}
                  onChange={(e) => setSalEntityOrCompetition(e.target.value)}
                  placeholder="مثال: أولمبياد إبداع / موهبة"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sal-date"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  التاريخ
                </label>
                <input
                  id="sal-date"
                  type="date"
                  dir="ltr"
                  value={salDate}
                  onChange={(e) => setSalDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ٤. سجل الاجتماعات: التاريخ، موضوع الاجتماع، الحضور، أبرز التوصيات */}
          {activeLogKind === 'meetingsLog' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label
                    htmlFor="mtg-date"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    التاريخ
                  </label>
                  <input
                    id="mtg-date"
                    type="date"
                    dir="ltr"
                    value={mtgDate}
                    onChange={(e) => setMtgDate(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="mtg-topic"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    موضوع الاجتماع <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="mtg-topic"
                    type="text"
                    value={mtgTopic}
                    onChange={(e) => setMtgTopic(e.target.value)}
                    placeholder="موضوع الاجتماع..."
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                </div>
              </div>

              {/* قسم الحضور (طلاب عبر studentId + معلمون/أعضاء لجنة/إداريون يدوياً مع roleTitle) */}
              <div className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-3">
                <div className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#7F1D3F]" />
                  <span>الحضور ({mtgAttendees.length})</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* إضافة طالب من السجل المركزي */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      aria-label="اختيار طالب للحضور في الاجتماع"
                      value={mtgSelectedStudentId}
                      onChange={(e) => setMtgSelectedStudentId(e.target.value)}
                      className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                    >
                      <option value="">
                        — إضافة طالب من السجل المركزي —
                      </option>
                      {students.map((stu) => (
                        <option key={stu.id} value={stu.id}>
                          {stu.name} ({stu.grade})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMeetingStudentAttendee}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة طالب</span>
                    </button>
                  </div>

                  {/* إضافة معلم / عضو لجنة / إداري يدوياً مع roleTitle */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="mtg-staff-name"
                      type="text"
                      value={mtgStaffName}
                      onChange={(e) => setMtgStaffName(e.target.value)}
                      placeholder="اسم المعلم / عضو اللجنة / الإداري"
                      className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                    />
                    <input
                      id="mtg-staff-role"
                      type="text"
                      value={mtgStaffRoleTitle}
                      onChange={(e) => setMtgStaffRoleTitle(e.target.value)}
                      placeholder="الصفة (roleTitle) مثل: عضو لجنة"
                      className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddMeetingStaffAttendee}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#7F1D3F]/10 hover:bg-[#7F1D3F]/20 text-xs font-bold text-[#7F1D3F] shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>إضافة للحضور</span>
                    </button>
                  </div>
                </div>

                {mtgAttendees.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {mtgAttendees.map((att) => {
                      const isStu = att.personType === 'student';
                      const stuDisplay =
                        isStu && att.studentId
                          ? resolveStudentDisplay(
                              att.studentId,
                              att.studentGradeSnapshot
                            )
                          : null;
                      return (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 text-xs font-bold text-stone-800"
                        >
                          <span>{stuDisplay ? stuDisplay.name : att.name}</span>
                          {isStu && stuDisplay && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                              طالب — {stuDisplay.grade}
                            </span>
                          )}
                          {!isStu && att.roleTitle && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7F1D3F]/10 text-[#7F1D3F]">
                              {att.roleTitle}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMeetingAttendee(att.id)}
                            aria-label={`إزالة ${att.name}`}
                            className="text-red-600 hover:text-red-800 mr-1"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="mtg-recommendations"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  أبرز التوصيات
                </label>
                <textarea
                  id="mtg-recommendations"
                  rows={2}
                  value={mtgKeyRecommendations}
                  onChange={(e) => setMtgKeyRecommendations(e.target.value)}
                  placeholder="أبرز التوصيات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ٥. سجل الزيارات والشراكات: الجهة أو المكان، التاريخ، الهدف، أبرز النتائج */}
          {activeLogKind === 'visitsAndPartnershipsLog' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label
                  htmlFor="vpl-entity-place"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الجهة أو المكان <span className="text-red-600">*</span>
                </label>
                <input
                  id="vpl-entity-place"
                  type="text"
                  value={vplEntityOrPlace}
                  onChange={(e) => setVplEntityOrPlace(e.target.value)}
                  placeholder="الجهة أو المكان..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vpl-date"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  التاريخ
                </label>
                <input
                  id="vpl-date"
                  type="date"
                  dir="ltr"
                  value={vplDate}
                  onChange={(e) => setVplDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vpl-purpose"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  الهدف
                </label>
                <input
                  id="vpl-purpose"
                  type="text"
                  value={vplPurpose}
                  onChange={(e) => setVplPurpose(e.target.value)}
                  placeholder="الهدف من الزيارة أو الشراكة..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vpl-key-results"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  أبرز النتائج
                </label>
                <input
                  id="vpl-key-results"
                  type="text"
                  value={vplKeyResults}
                  onChange={(e) => setVplKeyResults(e.target.value)}
                  placeholder="أبرز النتائج..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-[#7F1D3F] hover:bg-[#681733] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingRowId ? 'حفظ تعديل الصف' : 'إضافة صف إلى السجل'}
              </span>
            </button>
          </div>
        </form>

        {/* عرض صفوف السجل المفتوح */}
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          {activeLogKind === 'giftedStudentsLog' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100 text-stone-700 font-extrabold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">م</th>
                  <th className="py-2.5 px-3">الطالب</th>
                  <th className="py-2.5 px-3">الصف</th>
                  <th className="py-2.5 px-3">مجال الموهبة</th>
                  <th className="py-2.5 px-3">ملاحظات</th>
                  <th className="py-2.5 px-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {section3Data.giftedStudentsLog.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-stone-500"
                    >
                      لا توجد صفوف مسجلة في سجل الطلاب الموهوبين حالياً.
                    </td>
                  </tr>
                ) : (
                  section3Data.giftedStudentsLog.map((row, idx) => {
                    const stu = resolveStudentDisplay(
                      row.studentId,
                      row.studentGradeSnapshot
                    );
                    return (
                      <tr key={row.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-bold text-stone-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-stone-900">
                          {stu.name}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {stu.grade}
                        </td>
                        <td className="py-2.5 px-3 text-stone-800">
                          {row.talentDomain}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">
                          {row.notes || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditFixedRow(row.id)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                            >
                              تعديل
                            </button>
                            {confirmDeleteRowId === row.id ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteFixedRow(row.id)}
                                className="px-2 py-1 rounded bg-red-600 text-white font-bold"
                              >
                                تأكيد
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRowId(row.id)}
                                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeLogKind === 'programParticipantsLog' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100 text-stone-700 font-extrabold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">م</th>
                  <th className="py-2.5 px-3">الطالب</th>
                  <th className="py-2.5 px-3">الصف</th>
                  <th className="py-2.5 px-3">البرنامج</th>
                  <th className="py-2.5 px-3">تاريخ المشاركة</th>
                  <th className="py-2.5 px-3">نوع المشاركة</th>
                  <th className="py-2.5 px-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {section3Data.programParticipantsLog.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-stone-500"
                    >
                      لا توجد صفوف مسجلة في سجل الطلاب المشاركين في البرامج
                      حالياً.
                    </td>
                  </tr>
                ) : (
                  section3Data.programParticipantsLog.map((row, idx) => {
                    const stu = resolveStudentDisplay(
                      row.studentId,
                      row.studentGradeSnapshot
                    );
                    return (
                      <tr key={row.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-bold text-stone-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-stone-900">
                          {stu.name}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {stu.grade}
                        </td>
                        <td className="py-2.5 px-3 text-stone-800">
                          {row.programTitle}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600" dir="ltr">
                          {row.participationDate || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">
                          {row.participationType || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditFixedRow(row.id)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                            >
                              تعديل
                            </button>
                            {confirmDeleteRowId === row.id ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteFixedRow(row.id)}
                                className="px-2 py-1 rounded bg-red-600 text-white font-bold"
                              >
                                تأكيد
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRowId(row.id)}
                                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeLogKind === 'studentAchievementsLog' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100 text-stone-700 font-extrabold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">م</th>
                  <th className="py-2.5 px-3">الطالب</th>
                  <th className="py-2.5 px-3">الصف</th>
                  <th className="py-2.5 px-3">الإنجاز</th>
                  <th className="py-2.5 px-3">الجهة أو المسابقة</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {section3Data.studentAchievementsLog.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-stone-500"
                    >
                      لا توجد صفوف مسجلة في سجل إنجازات الطلاب حالياً.
                    </td>
                  </tr>
                ) : (
                  section3Data.studentAchievementsLog.map((row, idx) => {
                    const stu = resolveStudentDisplay(
                      row.studentId,
                      row.studentGradeSnapshot
                    );
                    return (
                      <tr key={row.id} className="hover:bg-stone-50/70">
                        <td className="py-2.5 px-3 font-bold text-stone-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-stone-900">
                          {stu.name}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {stu.grade}
                        </td>
                        <td className="py-2.5 px-3 text-stone-800">
                          {row.achievement}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700">
                          {row.entityOrCompetition || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600" dir="ltr">
                          {row.date || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditFixedRow(row.id)}
                              className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                            >
                              تعديل
                            </button>
                            {confirmDeleteRowId === row.id ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteFixedRow(row.id)}
                                className="px-2 py-1 rounded bg-red-600 text-white font-bold"
                              >
                                تأكيد
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRowId(row.id)}
                                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeLogKind === 'meetingsLog' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100 text-stone-700 font-extrabold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">م</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">موضوع الاجتماع</th>
                  <th className="py-2.5 px-3">الحضور</th>
                  <th className="py-2.5 px-3">أبرز التوصيات</th>
                  <th className="py-2.5 px-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {section3Data.meetingsLog.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-stone-500"
                    >
                      لا توجد صفوف مسجلة في سجل الاجتماعات حالياً.
                    </td>
                  </tr>
                ) : (
                  section3Data.meetingsLog.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-stone-50/70">
                      <td className="py-2.5 px-3 font-bold text-stone-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600" dir="ltr">
                        {row.date || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-stone-900">
                        {row.topic}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(row.attendees || []).map((att) => {
                            const isStu = att.personType === 'student';
                            const stuInfo =
                              isStu && att.studentId
                                ? resolveStudentDisplay(
                                    att.studentId,
                                    att.studentGradeSnapshot
                                  )
                                : null;
                            return (
                              <span
                                key={att.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-[11px] font-bold text-stone-800"
                              >
                                <span>{stuInfo ? stuInfo.name : att.name}</span>
                                {isStu && stuInfo && (
                                  <span className="text-stone-500">
                                    ({stuInfo.grade})
                                  </span>
                                )}
                                {!isStu && att.roleTitle && (
                                  <span className="text-[#7F1D3F]">
                                    ({att.roleTitle})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {row.keyRecommendations || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditFixedRow(row.id)}
                            className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                          >
                            تعديل
                          </button>
                          {confirmDeleteRowId === row.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteFixedRow(row.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-bold"
                            >
                              تأكيد
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRowId(row.id)}
                              className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold"
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeLogKind === 'visitsAndPartnershipsLog' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-100 text-stone-700 font-extrabold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">م</th>
                  <th className="py-2.5 px-3">الجهة أو المكان</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">الهدف</th>
                  <th className="py-2.5 px-3">أبرز النتائج</th>
                  <th className="py-2.5 px-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {section3Data.visitsAndPartnershipsLog.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-stone-500"
                    >
                      لا توجد صفوف مسجلة في سجل الزيارات والشراكات حالياً.
                    </td>
                  </tr>
                ) : (
                  section3Data.visitsAndPartnershipsLog.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-stone-50/70">
                      <td className="py-2.5 px-3 font-bold text-stone-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-stone-900">
                        {row.entityOrPlace}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600" dir="ltr">
                        {row.date || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {row.purpose || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {row.keyResults || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditFixedRow(row.id)}
                            className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold"
                          >
                            تعديل
                          </button>
                          {confirmDeleteRowId === row.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteFixedRow(row.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-bold"
                            >
                              تأكيد
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRowId(row.id)}
                              className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-bold"
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* ثانياً: النماذج الجاهزة الأربعة (مستقلة عن السجلات الخمسة) */}
      {/* ==================================================================== */}
      <section
        aria-label="النماذج الجاهزة الأربعة"
        className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-5"
      >
        <div className="border-b border-stone-100 pb-3">
          <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#7F1D3F]" />
            <span>النماذج الجاهزة الأربعة</span>
          </h3>
        </div>

        {/* أزرار اختيار النموذج الجاهز المعتمد */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GIFTED_READY_TEMPLATE_KINDS.map((kind) => {
            const isSelected = selectedTemplateKind === kind;
            const savedCount = section3Data.readyTemplates.filter(
              (t) => t.templateKind === kind
            ).length;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedTemplateKind(kind);
                  if (editingTemplateId) {
                    resetReadyTemplateForm(kind);
                  }
                }}
                className={`px-3 py-2.5 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#7F1D3F] text-white border-[#7F1D3F] shadow-sm'
                    : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span>{kind}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-200/70 text-stone-700'
                  }`}
                >
                  {savedCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* نموذج تعبئة وحفظ القالب الجاهز */}
        <form
          onSubmit={handleSubmitReadyTemplate}
          className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2">
            <h4 className="text-xs font-extrabold text-[#7F1D3F]">
              {editingTemplateId ? 'تعديل نموذج: ' : 'تعبئة نموذج: '}
              {selectedTemplateKind}
            </h4>
            {editingTemplateId && (
              <button
                type="button"
                onClick={() => resetReadyTemplateForm(selectedTemplateKind)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-stone-700 bg-white border border-stone-300 hover:bg-stone-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label
                htmlFor="tpl-title"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                العنوان <span className="text-red-600">*</span>
              </label>
              <input
                id="tpl-title"
                type="text"
                value={tplTitle}
                onChange={(e) => setTplTitle(e.target.value)}
                placeholder={`عنوان ${selectedTemplateKind}...`}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="tpl-date"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                التاريخ
              </label>
              <input
                id="tpl-date"
                type="date"
                dir="ltr"
                value={tplDate}
                onChange={(e) => setTplDate(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="tpl-recipient"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                الجهة أو المرسل إليه (اختياري)
              </label>
              <input
                id="tpl-recipient"
                type="text"
                value={tplRecipientOrEntity}
                onChange={(e) => setTplRecipientOrEntity(e.target.value)}
                placeholder="الجهة المعنية..."
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="tpl-subject"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                الموضوع أو الغرض
              </label>
              <input
                id="tpl-subject"
                type="text"
                value={tplSubjectOrPurpose}
                onChange={(e) => setTplSubjectOrPurpose(e.target.value)}
                placeholder="موضوع النموذج..."
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="tpl-recommendations"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                التوصيات أو الملاحظات (اختياري)
              </label>
              <input
                id="tpl-recommendations"
                type="text"
                value={tplRecommendationsOrNotes}
                onChange={(e) => setTplRecommendationsOrNotes(e.target.value)}
                placeholder="توصيات أو ملاحظات..."
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="tpl-body"
              className="block text-xs font-bold text-stone-700 mb-1"
            >
              محتوى النموذج
            </label>
            <textarea
              id="tpl-body"
              rows={3}
              value={tplBodyContent}
              onChange={(e) => setTplBodyContent(e.target.value)}
              placeholder={`اكتب نص ومحتوى ${selectedTemplateKind}...`}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
            />
          </div>

          {/* المشاركون / المرشحون / الحضور في النموذج الجاهز */}
          <div className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-3">
            <div className="text-xs font-extrabold text-stone-800">
              المرتبطون بالنموذج (طلاب من السجل المركزي أو معلمون/أعضاء لجنة/إداريون):
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  aria-label="اختيار طالب للنموذج الجاهز"
                  value={tplSelectedStudentId}
                  onChange={(e) => setTplSelectedStudentId(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                >
                  <option value="">— اختيار طالب من السجل المركزي —</option>
                  {students.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name} ({stu.grade})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddTemplateStudentParticipant}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة طالب</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="tpl-staff-name"
                  type="text"
                  value={tplStaffName}
                  onChange={(e) => setTplStaffName(e.target.value)}
                  placeholder="اسم المعلم / عضو اللجنة / الإداري"
                  className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
                <input
                  id="tpl-staff-role"
                  type="text"
                  value={tplStaffRoleTitle}
                  onChange={(e) => setTplStaffRoleTitle(e.target.value)}
                  placeholder="الصفة (roleTitle)"
                  className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTemplateStaffParticipant}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#7F1D3F]/10 hover:bg-[#7F1D3F]/20 text-xs font-bold text-[#7F1D3F] shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            {tplParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {tplParticipants.map((p) => {
                  const isStu = p.personType === 'student';
                  const stuInfo =
                    isStu && p.studentId
                      ? resolveStudentDisplay(
                          p.studentId,
                          p.studentGradeSnapshot
                        )
                      : null;
                  return (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 text-xs font-bold text-stone-800"
                    >
                      <span>{stuInfo ? stuInfo.name : p.name}</span>
                      {isStu && stuInfo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                          {stuInfo.grade}
                        </span>
                      )}
                      {!isStu && p.roleTitle && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7F1D3F]/10 text-[#7F1D3F]">
                          {p.roleTitle}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveTemplateParticipant(p.id)}
                        className="text-red-600 hover:text-red-800 mr-1"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-[#7F1D3F] hover:bg-[#681733] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingTemplateId ? 'حفظ تعديل النموذج' : 'حفظ النموذج الجاهز'}
              </span>
            </button>
          </div>
        </form>

        {/* قائمة النماذج الجاهزة المحفوظة */}
        {section3Data.readyTemplates.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-500 border border-stone-200 rounded-xl">
            لا توجد نماذج جاهزة محفوظة حالياً.
          </div>
        ) : (
          <div className="space-y-2.5">
            {section3Data.readyTemplates.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-stone-200 bg-stone-50/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-[#7F1D3F]/10 text-[#7F1D3F] text-xs font-extrabold">
                      {entry.templateKind}
                    </span>
                    <span className="text-xs font-extrabold text-stone-900">
                      {entry.title}
                    </span>
                    {entry.date && (
                      <span className="text-[11px] text-stone-500" dir="ltr">
                        ({entry.date})
                      </span>
                    )}
                  </div>
                  {entry.subjectOrPurpose && (
                    <div className="text-xs text-stone-700">
                      الموضوع: {entry.subjectOrPurpose}
                    </div>
                  )}
                  {entry.bodyContent && (
                    <div className="text-xs text-stone-600 line-clamp-2">
                      {entry.bodyContent}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEditReadyTemplate(entry)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  {confirmDeleteTemplateId === entry.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteReadyTemplate(entry.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                    >
                      تأكيد الحذف
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTemplateId(entry.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* ثالثاً: أرشيف الأعمال الإضافية القديم (يظهر منفصلاً للقراءة فقط إن وُجد) */}
      {/* ==================================================================== */}
      {legacyArchiveItems.length > 0 && (
        <section
          aria-label="أرشيف الأعمال الإضافية السابق"
          data-testid="legacy-coordinator-works-archive"
          className="bg-stone-50 rounded-2xl border border-stone-300 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-3">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-stone-700" />
              <h3 className="text-sm font-extrabold text-stone-900">
                أرشيف الأعمال الإضافية السابق ({legacyArchiveItems.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-stone-200 text-stone-700">
              أرشيف مستقل للقراءة فقط
            </span>
          </div>

          <div className="space-y-2.5">
            {legacyArchiveItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-1"
              >
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-extrabold text-stone-900">
                    {GIFTED_COORDINATOR_WORK_KIND_LABELS[item.workKind] ||
                      item.workKind}
                  </span>
                  {item.meetingNumber && (
                    <span className="text-stone-600">
                      — {item.meetingNumber}
                    </span>
                  )}
                  {item.executionDate && (
                    <span className="text-stone-500" dir="ltr">
                      ({item.executionDate})
                    </span>
                  )}
                  {item.weekLabel && (
                    <span className="text-stone-500">— {item.weekLabel}</span>
                  )}
                </div>
                <p className="text-xs text-stone-700">{item.summary}</p>
                {item.notesAndRecommendations && (
                  <p className="text-[11px] text-stone-500">
                    {item.notesAndRecommendations}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
