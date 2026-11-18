import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  APPROVED_SCHOOL_SEMESTERS,
  ApprovedSchoolSemester,
  checkGiftedStudentDuplicateOrSimilarity,
  GIFTED_APPROVED_STUDENT_GENDERS,
  GiftedCoordinatorRecord,
  GiftedStudentGender,
  GiftedStudentRecord,
  resolveDefaultAcademicYearAndSemester,
  safeDeleteGiftedStudentFromRecord,
} from '../../utils/giftedRecordEngine';
import { normalizeApprovedSemester } from '../../utils/settingsStorage';

interface GiftedStudentsRegistrySectionProps {
  record: GiftedCoordinatorRecord;
  updateRecord: (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => void;
  onSelectStudentForParticipation?: (studentId: string) => void;
  embeddedInSection7?: boolean;
  gender?: 'male' | 'female';
}

interface StudentFormState {
  name: string;
  civilId: string;
  gender: GiftedStudentGender;
  grade: string;
  academicYear: string;
  semester: ApprovedSchoolSemester;
  studentMobile: string;
  guardianName: string;
}

const APPROVED_TEN_STUDENT_GRADES = [
  'ثالث ابتدائي',
  'رابع ابتدائي',
  'خامس ابتدائي',
  'سادس ابتدائي',
  'أول متوسط',
  'ثاني متوسط',
  'ثالث متوسط',
  'أول ثانوي',
  'ثاني ثانوي',
  'ثالث ثانوي',
] as const;

const LEGACY_GRADE_TO_APPROVED_MAP: Record<string, (typeof APPROVED_TEN_STUDENT_GRADES)[number]> = {
  'ثالث ابتدائي': 'ثالث ابتدائي',
  'الثالث الابتدائي': 'ثالث ابتدائي',
  'الصف الثالث الابتدائي': 'ثالث ابتدائي',
  'رابع ابتدائي': 'رابع ابتدائي',
  'الرابع الابتدائي': 'رابع ابتدائي',
  'الصف الرابع الابتدائي': 'رابع ابتدائي',
  'خامس ابتدائي': 'خامس ابتدائي',
  'الخامس الابتدائي': 'خامس ابتدائي',
  'الصف الخامس الابتدائي': 'خامس ابتدائي',
  'سادس ابتدائي': 'سادس ابتدائي',
  'السادس الابتدائي': 'سادس ابتدائي',
  'الصف السادس الابتدائي': 'سادس ابتدائي',
  'أول متوسط': 'أول متوسط',
  'الأول المتوسط': 'أول متوسط',
  'الصف الأول المتوسط': 'أول متوسط',
  'ثاني متوسط': 'ثاني متوسط',
  'الثاني المتوسط': 'ثاني متوسط',
  'الصف الثاني المتوسط': 'ثاني متوسط',
  'ثالث متوسط': 'ثالث متوسط',
  'الثالث المتوسط': 'ثالث متوسط',
  'الصف الثالث المتوسط': 'ثالث متوسط',
  'أول ثانوي': 'أول ثانوي',
  'الأول الثانوي': 'أول ثانوي',
  'الصف الأول الثانوي': 'أول ثانوي',
  'ثاني ثانوي': 'ثاني ثانوي',
  'الثاني الثانوي': 'ثاني ثانوي',
  'الصف الثاني الثانوي': 'ثاني ثانوي',
  'ثالث ثانوي': 'ثالث ثانوي',
  'الثالث الثانوي': 'ثالث ثانوي',
  'الصف الثالث الثانوي': 'ثالث ثانوي',
};

function normalizeToApprovedTenGrade(rawGrade?: string): string {
  const trimmed = (rawGrade || '').trim();
  if (!trimmed) return '';
  return LEGACY_GRADE_TO_APPROVED_MAP[trimmed] || '';
}

export const GiftedStudentsRegistrySection: React.FC<
  GiftedStudentsRegistrySectionProps
> = ({ record, updateRecord, gender = 'male' }) => {
  const { settings } = useSettings();
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const centralDefaults = useMemo(
    () => resolveDefaultAcademicYearAndSemester(settings),
    [settings]
  );

  const defaultGender: GiftedStudentGender =
    gender === 'female' ? 'طالبة' : 'طالب';

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formState, setFormState] = useState<StudentFormState>(() => ({
    name: '',
    civilId: '',
    gender: defaultGender,
    grade: '',
    academicYear: centralDefaults.academicYear,
    semester: centralDefaults.semester,
    studentMobile: '',
    guardianName: '',
  }));

  useEffect(() => {
    if (!editingStudentId) {
      setFormState((prev) => ({
        ...prev,
        gender: defaultGender,
        academicYear: centralDefaults.academicYear,
        semester: centralDefaults.semester,
      }));
    }
  }, [
    centralDefaults.academicYear,
    centralDefaults.semester,
    defaultGender,
    editingStudentId,
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [deleteBlockedError, setDeleteBlockedError] = useState<string | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bypassSimilarWarning, setBypassSimilarWarning] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const duplicateCheck = useMemo(
    () =>
      checkGiftedStudentDuplicateOrSimilarity(record, {
        id: editingStudentId || undefined,
        name: formState.name,
        civilId: formState.civilId,
        grade: formState.grade,
      }),
    [
      record,
      editingStudentId,
      formState.name,
      formState.civilId,
      formState.grade,
    ]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim();
    return record.students.filter((stu) => {
      if (gradeFilter !== 'all') {
        const normalizedStuGrade = normalizeToApprovedTenGrade(stu.grade);
        if (stu.grade !== gradeFilter && normalizedStuGrade !== gradeFilter) {
          return false;
        }
      }
      if (q) {
        const matchesName = stu.name.includes(q);
        const matchesCivilId = (stu.civilId || '').includes(q);
        const matchesGrade = (stu.grade || '').includes(q);
        const matchesGuardian = (stu.guardianName || '').includes(q);
        if (
          !matchesName &&
          !matchesCivilId &&
          !matchesGrade &&
          !matchesGuardian
        ) {
          return false;
        }
      }
      return true;
    });
  }, [record.students, searchQuery, gradeFilter]);

  // القائمة المغلقة للصفوف العشرة المعتمدة فقط (من ثالث ابتدائي إلى ثالث ثانوي)
  const gradeOptionsForForm = APPROVED_TEN_STUDENT_GRADES;

  const resetForm = () => {
    setEditingStudentId(null);
    setBypassSimilarWarning(false);
    setFormState({
      name: '',
      civilId: '',
      gender: defaultGender,
      grade: '',
      academicYear: centralDefaults.academicYear,
      semester: centralDefaults.semester,
      studentMobile: '',
      guardianName: '',
    });
  };

  const handleStartEditStudent = (stu: GiftedStudentRecord) => {
    setEditingStudentId(stu.id);
    setBypassSimilarWarning(false);
    setDeleteBlockedError(null);
    setFeedbackBanner(null);
    setFormState({
      name: stu.name,
      civilId: stu.civilId || '',
      gender: stu.gender === 'طالبة' || stu.gender === 'طالب' ? stu.gender : defaultGender,
      grade: normalizeToApprovedTenGrade(stu.grade),
      academicYear:
        stu.academicYear !== undefined
          ? stu.academicYear
          : centralDefaults.academicYear,
      semester: stu.semester
        ? normalizeApprovedSemester(stu.semester)
        : centralDefaults.semester,
      studentMobile: stu.studentMobile || '',
      guardianName: stu.guardianName || '',
    });
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleSaveStudent = () => {
    const cleanName = formState.name.trim();
    if (!cleanName) {
      setFeedbackBanner({
        type: 'error',
        message: 'الرجاء إدخال الاسم الرباعي قبل الحفظ.',
      });
      nameInputRef.current?.focus();
      return;
    }

    const approvedGrade = normalizeToApprovedTenGrade(formState.grade);
    if (!approvedGrade) {
      setFeedbackBanner({
        type: 'error',
        message: 'الرجاء اختيار الصف الدراسي من الصفوف العشرة المعتمدة قبل الحفظ.',
      });
      return;
    }

    if (duplicateCheck.status === 'duplicate_blocked') {
      setFeedbackBanner({
        type: 'error',
        message:
          duplicateCheck.reason ||
          'لا يمكن حفظ سجل مكرر بالاسم أو رقم الهوية الوطنية.',
      });
      return;
    }

    if (duplicateCheck.status === 'similar_warning' && !bypassSimilarWarning) {
      setBypassSimilarWarning(true);
      return;
    }

    const cleanCivilId = formState.civilId.trim();
    const cleanAcademicYear = formState.academicYear.trim();
    const cleanStudentMobile = formState.studentMobile.trim();
    const cleanGuardianName = formState.guardianName.trim();
    const normalizedSem = normalizeApprovedSemester(formState.semester);
    const isEditing = Boolean(editingStudentId);

    updateRecord((prev) => {
      const existingStudent = editingStudentId
        ? prev.students.find((s) => s.id === editingStudentId)
        : undefined;

      const studentId =
        existingStudent?.id ||
        `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const updatedStudent: GiftedStudentRecord = {
        id: studentId,
        name: cleanName,
        ...(cleanCivilId ? { civilId: cleanCivilId } : {}),
        gender: formState.gender,
        grade: approvedGrade,
        ...(cleanAcademicYear ? { academicYear: cleanAcademicYear } : {}),
        semester: normalizedSem,
        ...(cleanStudentMobile ? { studentMobile: cleanStudentMobile } : {}),
        ...(cleanGuardianName ? { guardianName: cleanGuardianName } : {}),
        // الحقول القديمة تبقى محفوظة للتوافق الخلفي ولا تظهر في الواجهة الجديدة
        level: existingStudent?.level ?? 'المستوى الأول',
        talentDomain: existingStudent?.talentDomain ?? 'موهبة علمية وإبداعية',
        score: existingStudent?.score ?? '',
        classification: existingStudent?.classification ?? 'gifted',
        notes: existingStudent?.notes ?? '',
      };

      const exists = prev.students.some((s) => s.id === studentId);
      const nextStudents = exists
        ? prev.students.map((s) => (s.id === studentId ? updatedStudent : s))
        : [...prev.students, updatedStudent];

      return {
        ...prev,
        students: nextStudents,
      };
    });

    setFeedbackBanner({
      type: 'success',
      message: isEditing
        ? `تم تحديث بيانات «${cleanName}» بنجاح.`
        : `تمت إضافة «${cleanName}» بنجاح.`,
    });
    resetForm();
  };

  const handleConfirmSafeDelete = (studentId: string) => {
    setDeleteBlockedError(null);

    // التحقق من ارتباط الطالب في البرامج والتقارير والمبادرات (القسم 02) أو السجلات والنماذج (القسم 03)
    const linkedSection2Titles = (record.unifiedRecords || [])
      .filter((rec) =>
        (rec.participants || []).some((p) => p.studentId === studentId)
      )
      .map((rec) => `«${rec.title}» (${rec.recordType})`);

    const sec3 = record.section3Data;
    const linkedSec3Locations: string[] = [];
    if (sec3) {
      if ((sec3.giftedStudentsLog || []).some((r) => r.studentId === studentId)) {
        linkedSec3Locations.push('سجل الطلاب الموهوبين');
      }
      if (
        (sec3.programParticipantsLog || []).some((r) => r.studentId === studentId)
      ) {
        linkedSec3Locations.push('سجل الطلاب المشاركين في البرامج');
      }
      if (
        (sec3.studentAchievementsLog || []).some((r) => r.studentId === studentId)
      ) {
        linkedSec3Locations.push('سجل إنجازات الطلاب');
      }
      if (
        (sec3.readyTemplates || []).some((t) =>
          (t.participants || []).some((p) => p.studentId === studentId)
        )
      ) {
        linkedSec3Locations.push('النماذج الجاهزة');
      }
    }

    const checkResult = safeDeleteGiftedStudentFromRecord(record, studentId);
    if (
      !checkResult.deleted ||
      linkedSection2Titles.length > 0 ||
      linkedSec3Locations.length > 0
    ) {
      const targetStu = record.students.find((s) => s.id === studentId);
      const stuName = targetStu?.name || 'الطالب';
      const reasons: string[] = [];
      if (linkedSection2Titles.length > 0) {
        reasons.push(
          `مرتبط في البرامج والتقارير والمبادرات: ${linkedSection2Titles.join('، ')}`
        );
      }
      if (linkedSec3Locations.length > 0) {
        reasons.push(
          `مرتبط في النماذج والسجلات: ${linkedSec3Locations.join('، ')}`
        );
      }
      if (!checkResult.deleted && checkResult.check.reason) {
        reasons.push(checkResult.check.reason);
      }
      setDeleteBlockedError(
        reasons.length > 0
          ? `لا يمكن حذف بيانات «${stuName}» من السجل المركزي لوجود سجلات مرتبطة به (${reasons.join(' — ')}). يرجى إزالة ارتباطه من تلك السجلات أولاً قبل الحذف.`
          : 'تعذر حذف السجل لارتباطه بسجلات أخرى في البرنامج.'
      );
      setConfirmDeleteId(null);
      return;
    }

    updateRecord((prev) => safeDeleteGiftedStudentFromRecord(prev, studentId).record);
    if (editingStudentId === studentId) {
      resetForm();
    }
    setConfirmDeleteId(null);
    setFeedbackBanner({
      type: 'success',
      message: `تم حذف السجل من القائمة بنجاح.`,
    });
  };

  return (
    <div
      dir="rtl"
      data-testid="gifted-students-registry-section"
      className="space-y-6 text-[#26323B]"
    >
      {/* نموذج إضافة أو تعديل طالب/طالبة بالحقول الثمانية المعتمدة فقط */}
      <section
        data-testid="student-registry-form-card"
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          editingStudentId
            ? 'bg-[#F9EFF2]/50 border-[#7F1D3F]'
            : 'bg-white border-[#E6C7D0]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#7F1D3F] text-white flex items-center justify-center">
              {editingStudentId ? (
                <Edit3 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4" aria-hidden="true" />
              )}
            </span>
            <h3 className="text-base sm:text-lg font-extrabold font-display text-[#26323B]">
              {editingStudentId
                ? 'تعديل بيانات الطالب / الطالبة'
                : 'إضافة طالب / طالبة'}
            </h3>
          </div>

          {editingStudentId && (
            <button
              type="button"
              data-testid="student-cancel-edit-btn"
              onClick={resetForm}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إلغاء التعديل</span>
            </button>
          )}
        </div>

        {/* الحقول الثمانية المعتمدة بالترتيب المرجعي الدقيق */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. الاسم الرباعي */}
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-bold text-stone-700 block">
              الاسم الرباعي *
            </span>
            <input
              ref={nameInputRef}
              type="text"
              data-testid="student-field-1-name"
              value={formState.name}
              onChange={(e) => {
                setBypassSimilarWarning(false);
                setFormState((s) => ({ ...s, name: e.target.value }));
              }}
              placeholder="الاسم الرباعي الكامل..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#7F1D3F]"
            />
          </label>

          {/* 2. رقم الهوية الوطنية */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-stone-700 block">
              رقم الهوية الوطنية
            </span>
            <input
              type="text"
              inputMode="numeric"
              data-testid="student-field-2-civilId"
              value={formState.civilId}
              onChange={(e) => {
                setBypassSimilarWarning(false);
                setFormState((s) => ({ ...s, civilId: e.target.value }));
              }}
              placeholder="رقم الهوية الوطنية (١٠ أرقام)"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-sm tabular-nums focus:outline-none focus:border-[#7F1D3F]"
            />
          </label>

          {/* 3. الجنس */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-stone-700 block">
              الجنس
            </span>
            <select
              data-testid="student-field-3-gender"
              value={formState.gender}
              onChange={(e) =>
                setFormState((s) => ({
                  ...s,
                  gender: e.target.value as GiftedStudentGender,
                }))
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white border border-stone-300 text-sm font-semibold focus:outline-none focus:border-[#7F1D3F]"
            >
              {GIFTED_APPROVED_STUDENT_GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          {/* 4. الصف */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-stone-700 block">
              الصف *
            </span>
            <select
              data-testid="student-field-4-grade"
              value={formState.grade}
              onChange={(e) =>
                setFormState((s) => ({ ...s, grade: e.target.value }))
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white border border-stone-300 text-sm font-semibold focus:outline-none focus:border-[#7F1D3F]"
            >
              <option value="" disabled>
                اختر الصف
              </option>
              {gradeOptionsForForm.map((gr) => (
                <option key={gr} value={gr}>
                  {gr}
                </option>
              ))}
            </select>
          </label>

          {/* 5. العام الدراسي */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-stone-700 block">
              العام الدراسي
            </span>
            <input
              type="text"
              data-testid="student-field-5-academicYear"
              value={formState.academicYear}
              onChange={(e) =>
                setFormState((s) => ({ ...s, academicYear: e.target.value }))
              }
              placeholder="مثال: ١٤٤٧هـ"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#7F1D3F]"
            />
          </label>

          {/* 6. الفصل الدراسي */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-stone-700 block">
              الفصل الدراسي
            </span>
            <select
              data-testid="student-field-6-semester"
              value={formState.semester}
              onChange={(e) =>
                setFormState((s) => ({
                  ...s,
                  semester: normalizeApprovedSemester(e.target.value),
                }))
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white border border-stone-300 text-sm font-semibold focus:outline-none focus:border-[#7F1D3F]"
            >
              {APPROVED_SCHOOL_SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </label>

          {/* 7. جوال الطالب (اختياري) */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-stone-700 block">
              جوال الطالب (اختياري)
            </span>
            <input
              type="tel"
              inputMode="tel"
              data-testid="student-field-7-studentMobile"
              value={formState.studentMobile}
              onChange={(e) =>
                setFormState((s) => ({ ...s, studentMobile: e.target.value }))
              }
              placeholder="اختياري..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-sm tabular-nums focus:outline-none focus:border-[#7F1D3F]"
            />
          </label>

          {/* 8. اسم ولي الأمر (اختياري) */}
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-bold text-stone-700 block">
              اسم ولي الأمر (اختياري)
            </span>
            <input
              type="text"
              data-testid="student-field-8-guardianName"
              value={formState.guardianName}
              onChange={(e) =>
                setFormState((s) => ({ ...s, guardianName: e.target.value }))
              }
              placeholder="اختياري..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#7F1D3F]"
            />
          </label>

          {/* زر الحفظ */}
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button
              type="button"
              data-testid="student-save-btn"
              disabled={duplicateCheck.status === 'duplicate_blocked'}
              onClick={handleSaveStudent}
              className="w-full sm:w-auto min-h-[42px] px-6 py-2 rounded-xl bg-[#7F1D3F] hover:bg-[#641631] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {editingStudentId
                  ? 'حفظ التعديلات'
                  : bypassSimilarWarning
                    ? 'تأكيد الإضافة رغم تشابه الاسم'
                    : 'حفظ الطالب / الطالبة'}
              </span>
            </button>
          </div>
        </div>

        {/* رسائل التحقق من التكرار أو التشابه */}
        {duplicateCheck.status === 'duplicate_blocked' && (
          <div
            data-testid="student-duplicate-blocked-alert"
            className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-900 flex items-center gap-2"
          >
            <AlertCircle
              className="w-4 h-4 text-red-700 shrink-0"
              aria-hidden="true"
            />
            <span>{duplicateCheck.reason}</span>
          </div>
        )}

        {duplicateCheck.status === 'similar_warning' && (
          <div
            data-testid="student-similar-warning-alert"
            className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-900 flex items-center gap-2"
          >
            <AlertTriangle
              className="w-4 h-4 text-amber-700 shrink-0"
              aria-hidden="true"
            />
            <span>
              {duplicateCheck.reason}{' '}
              {bypassSimilarWarning
                ? '— اضغط زر الحفظ مرة أخرى لتأكيد الإضافة.'
                : ''}
            </span>
          </div>
        )}
      </section>

      {/* رسائل التنبيه */}
      {feedbackBanner && (
        <div
          data-testid="student-feedback-banner"
          className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 border ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{feedbackBanner.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            إغلاق
          </button>
        </div>
      )}

      {deleteBlockedError && (
        <div
          data-testid="student-delete-blocked-alert"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-900 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              className="w-4 h-4 text-red-700 shrink-0"
              aria-hidden="true"
            />
            <span>{deleteBlockedError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteBlockedError(null)}
            className="text-xs underline cursor-pointer shrink-0"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* جدول عرض الطلاب والطالبات بالحقول الثمانية المعتمدة فقط */}
      <section className="bg-white rounded-2xl border border-[#E6C7D0] overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 bg-[#FAF7F5] border-b border-[#E6C7D0] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#7F1D3F]" aria-hidden="true" />
            <h4 className="text-sm sm:text-base font-extrabold text-[#26323B]">
              سجل الطلاب والطالبات ({filteredStudents.length})
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:flex-none">
              <Search
                className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                data-testid="student-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الهوية..."
                className="w-full min-h-[38px] pr-9 pl-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-semibold focus:outline-none focus:border-[#7F1D3F]"
              />
            </div>

            <select
              data-testid="student-grade-filter-select"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              aria-label="تصفية حسب الصف"
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-semibold text-stone-700 focus:outline-none focus:border-[#7F1D3F]"
            >
              <option value="all">جميع الصفوف</option>
              {APPROVED_TEN_STUDENT_GRADES.map((gr) => (
                <option key={gr} value={gr}>
                  {gr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            data-testid="students-registry-table"
            className="w-full text-right border-collapse"
          >
            <thead>
              <tr className="bg-stone-100 text-stone-700 text-xs font-extrabold border-b border-stone-200">
                <th className="py-3 px-3 w-10 text-center">م</th>
                <th className="py-3 px-3">الاسم الرباعي</th>
                <th className="py-3 px-3">رقم الهوية الوطنية</th>
                <th className="py-3 px-3">الجنس</th>
                <th className="py-3 px-3">الصف</th>
                <th className="py-3 px-3">العام الدراسي</th>
                <th className="py-3 px-3">الفصل الدراسي</th>
                <th className="py-3 px-3">جوال الطالب</th>
                <th className="py-3 px-3">اسم ولي الأمر</th>
                <th className="py-3 px-3 w-32 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-xs sm:text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 px-4 text-center text-stone-500 font-medium"
                  >
                    لا توجد سجلات طلاب أو طالبات مطابقة حالياً.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu, idx) => {
                  const isEditingThis = editingStudentId === stu.id;
                  const displayGender =
                    stu.gender === 'طالبة' || stu.gender === 'طالب'
                      ? stu.gender
                      : defaultGender;
                  const displayAcademicYear =
                    stu.academicYear || centralDefaults.academicYear || '—';
                  const displaySemester = stu.semester
                    ? normalizeApprovedSemester(stu.semester)
                    : centralDefaults.semester;

                  return (
                    <tr
                      key={stu.id}
                      data-testid={`student-row-${stu.id}`}
                      className={
                        isEditingThis ? 'bg-[#F9EFF2]/40' : 'hover:bg-stone-50/70'
                      }
                    >
                      <td className="py-3 px-3 text-center font-bold text-stone-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-extrabold text-[#26323B]">
                        {stu.name}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold tabular-nums">
                        {stu.civilId || '—'}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold">
                        {displayGender}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold">
                        {stu.grade || '—'}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold">
                        {displayAcademicYear}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold">
                        {displaySemester}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold tabular-nums">
                        {stu.studentMobile || '—'}
                      </td>
                      <td className="py-3 px-3 text-stone-700 font-semibold">
                        {stu.guardianName || '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {confirmDeleteId === stu.id ? (
                          <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">
                            <button
                              type="button"
                              data-testid={`student-confirm-delete-btn-${stu.id}`}
                              onClick={() => handleConfirmSafeDelete(stu.id)}
                              className="px-2 py-0.5 rounded bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              تأكيد
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 rounded bg-white text-stone-700 border border-stone-300 text-[11px] font-semibold cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              data-testid={`student-edit-btn-${stu.id}`}
                              onClick={() => handleStartEditStudent(stu)}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 hover:border-[#7F1D3F] text-[#26323B] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              data-testid={`student-delete-btn-${stu.id}`}
                              onClick={() => setConfirmDeleteId(stu.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>حذف</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
