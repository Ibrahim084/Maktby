import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Link2,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  APPROVED_SCHOOL_SEMESTERS,
  ApprovedSchoolSemester,
  formatGregorianToHijriDate,
  getDefaultGiftedAttachmentRepository,
  GIFTED_APPROVED_DURATION_OPTIONS,
  GIFTED_PARTICIPANT_STATUS_ROLES,
  GIFTED_PROGRAM_EXECUTION_SCOPES,
  GIFTED_SECTION2_RECORD_TYPES,
  GiftedApprovedDurationOption,
  GiftedCoordinatorRecord,
  GiftedParticipantStatusRole,
  GiftedProgramExecutionScope,
  GiftedSection2EvidenceItem,
  GiftedSection2InitiativeFields,
  GiftedSection2LinkItem,
  GiftedSection2ParticipantItem,
  GiftedSection2ProgramFields,
  GiftedSection2RecordType,
  GiftedSection2ReportFields,
  GiftedUnifiedSection2Record,
  MAX_GIFTED_SECTION2_EVIDENCES,
  MAX_GIFTED_SECTION2_LINKS,
  registerAttachmentBlobKeyInRecord,
  resolveDefaultAcademicYearAndSemester,
} from '../../utils/giftedRecordEngine';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';

interface GiftedProgramsLibrarySectionProps {
  record: GiftedCoordinatorRecord;
  updateRecord: (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => void;
  gender?: 'male' | 'female';
  onRefreshAttachments?: () => Promise<void>;
}

type DateOrDurationMode = 'date' | 'duration';

/**
 * تحويل الأرقام العربية/الفارسية إلى أرقام لاتينية قياسية
 */
function normalizeDigitsToAscii(raw: string): string {
  return (raw || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * استخراج (سنة، شهر، يوم) بتقويم أم القرى من كائن Date بتوقيت UTC
 */
function getUmmAlQuraPartsFromUtcDate(utcDate: Date): {
  year: number;
  month: number;
  day: number;
} | null {
  try {
    const formatter = new Intl.DateTimeFormat(
      'en-u-ca-islamic-umalqura-nu-latn',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC',
      }
    );
    const parts = formatter.formatToParts(utcDate);
    const yearStr = parts.find((p) => p.type === 'year')?.value || '';
    const monthStr = parts.find((p) => p.type === 'month')?.value || '';
    const dayStr = parts.find((p) => p.type === 'day')?.value || '';
    const year = Number(yearStr.replace(/[^\d]/g, ''));
    const month = Number(monthStr.replace(/[^\d]/g, ''));
    const day = Number(dayStr.replace(/[^\d]/g, ''));
    if (!year || !month || !day) return null;
    return { year, month, day };
  } catch {
    return null;
  }
}

/**
 * تحويل التاريخ الميلادي (YYYY-MM-DD) إلى تاريخ هجري رقمي متناسق (YYYY/MM/DD) وفق تقويم أم القرى
 */
export function convertGregorianToHijriYmd(gregorianIso: string): string {
  const clean = normalizeDigitsToAscii(gregorianIso).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!match) return '';
  const gYear = Number(match[1]);
  const gMonth = Number(match[2]);
  const gDay = Number(match[3]);
  if (!gYear || gMonth < 1 || gMonth > 12 || gDay < 1 || gDay > 31) return '';

  const utcDate = new Date(Date.UTC(gYear, gMonth - 1, gDay, 12, 0, 0));
  if (Number.isNaN(utcDate.getTime())) return '';

  const parts = getUmmAlQuraPartsFromUtcDate(utcDate);
  if (!parts) return '';
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * تحويل التاريخ الهجري (YYYY/MM/DD أو YYYY-MM-DD بالأرقام العربية أو الإنجليزية) إلى ميلادي (YYYY-MM-DD)
 */
export function convertHijriToGregorianYmd(hijriInput: string): string {
  const normalized = normalizeDigitsToAscii(hijriInput)
    .replace(/هـ/g, '')
    .trim();
  if (!normalized) return '';

  let hYear = 0;
  let hMonth = 0;
  let hDay = 0;

  const ymdMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normalized);
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(normalized);

  if (ymdMatch) {
    hYear = Number(ymdMatch[1]);
    hMonth = Number(ymdMatch[2]);
    hDay = Number(ymdMatch[3]);
  } else if (dmyMatch) {
    hDay = Number(dmyMatch[1]);
    hMonth = Number(dmyMatch[2]);
    hYear = Number(dmyMatch[3]);
  } else {
    return '';
  }

  if (
    hYear < 1350 ||
    hYear > 1500 ||
    hMonth < 1 ||
    hMonth > 12 ||
    hDay < 1 ||
    hDay > 30
  ) {
    return '';
  }

  // تقدير أولي لعدد الأيام منذ هجرة النبي صلى الله عليه وسلم (19 يوليو 622م)
  const hijriEpochMs = Date.UTC(622, 6, 19, 12, 0, 0);
  const approxDays =
    (hYear - 1) * 354.367056 + (hMonth - 1) * 29.530588 + (hDay - 1);
  const baseMs = hijriEpochMs + Math.round(approxDays) * 86400000;

  for (let offset = -25; offset <= 25; offset++) {
    const candidateDate = new Date(baseMs + offset * 86400000);
    const parts = getUmmAlQuraPartsFromUtcDate(candidateDate);
    if (
      parts &&
      parts.year === hYear &&
      parts.month === hMonth &&
      parts.day === hDay
    ) {
      const gy = String(candidateDate.getUTCFullYear()).padStart(4, '0');
      const gm = String(candidateDate.getUTCMonth() + 1).padStart(2, '0');
      const gd = String(candidateDate.getUTCDate()).padStart(2, '0');
      return `${gy}-${gm}-${gd}`;
    }
  }

  return '';
}

function createEmptyProgramFields(): GiftedSection2ProgramFields {
  return {
    executionScope: 'مدرسة',
    programTypeOrField: '',
    objective: '',
    targetAudience: '',
    executingEntity: '',
    results: '',
    notesAndRecommendations: '',
  };
}

function createEmptyReportFields(): GiftedSection2ReportFields {
  return {
    reportObjectives: '',
    resultsAndOutputs: '',
    achievementIndicators: '',
    challengesAndDifficulties: '',
    recommendationsAndProposals: '',
    notes: '',
  };
}

function createEmptyInitiativeFields(): GiftedSection2InitiativeFields {
  return {
    initiativeIdea: '',
    initiativeObjectives: '',
    targetAudience: '',
    executionSteps: '',
    resultsAndImpact: '',
    challenges: '',
    recommendations: '',
  };
}

function normalizeExternalUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const RECORD_TYPE_BADGE_STYLES: Record<
  GiftedSection2RecordType,
  { bg: string; text: string; border: string }
> = {
  برنامج: {
    bg: 'bg-[#7F1D3F]/10',
    text: 'text-[#7F1D3F]',
    border: 'border-[#7F1D3F]/25',
  },
  تقرير: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
  },
  مبادرة: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
  },
};

export const GiftedProgramsLibrarySection: React.FC<
  GiftedProgramsLibrarySectionProps
> = ({ record, updateRecord, onRefreshAttachments }) => {
  const { settings } = useSettings();
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const evidenceFileInputRef = useRef<HTMLInputElement | null>(null);

  const centralDefaults = useMemo(
    () => resolveDefaultAcademicYearAndSemester(settings),
    [settings]
  );
  const defaultAcademicYear = centralDefaults.academicYear || '١٤٤٨هـ';

  // حالة النموذج الموحد
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordType, setRecordType] =
    useState<GiftedSection2RecordType>('برنامج');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateOrDurationMode, setDateOrDurationMode] =
    useState<DateOrDurationMode>('date');
  const [gregorianDate, setGregorianDate] = useState('');
  const [hijriDate, setHijriDate] = useState('');
  const [durationOption, setDurationOption] =
    useState<GiftedApprovedDurationOption>('أسبوع');
  const [location, setLocation] = useState('');
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [semester, setSemester] = useState<ApprovedSchoolSemester>(
    centralDefaults.semester
  );

  // الحقول الخاصة بكل نوع
  const [programFields, setProgramFields] =
    useState<GiftedSection2ProgramFields>(createEmptyProgramFields);
  const [reportFields, setReportFields] =
    useState<GiftedSection2ReportFields>(createEmptyReportFields);
  const [initiativeFields, setInitiativeFields] =
    useState<GiftedSection2InitiativeFields>(createEmptyInitiativeFields);

  // المشاركون والشواهد والروابط
  const [participants, setParticipants] = useState<
    GiftedSection2ParticipantItem[]
  >([]);
  const [evidences, setEvidences] = useState<GiftedSection2EvidenceItem[]>([]);
  const [links, setLinks] = useState<GiftedSection2LinkItem[]>([]);

  // حقول فرعية لإضافة شاهد أو رابط أو البحث عن طالب
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('');
  const [newEvidenceCaption, setNewEvidenceCaption] = useState('');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  // الفلاتر والمعاينة والحذف
  const [typeFilter, setTypeFilter] = useState<
    'all' | GiftedSection2RecordType
  >('all');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [previewRecordId, setPreviewRecordId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // معاينات الملفات الثنائية من IndexedDB (blobKey -> dataUrl / objectUrl)
  const [attachmentPreviewMap, setAttachmentPreviewMap] = useState<
    Record<string, { url: string; mimeType: string; filename: string }>
  >({});

  // تحديث العام والفصل الافتراضيين عند تغيير إعدادات مكتبي المركزية (في وضع الإضافة الجديدة فقط)
  useEffect(() => {
    if (!editingRecordId) {
      setAcademicYear(defaultAcademicYear);
      setSemester(centralDefaults.semester);
    }
  }, [defaultAcademicYear, centralDefaults.semester, editingRecordId]);

  const unifiedRecords: GiftedUnifiedSection2Record[] = useMemo(
    () => (Array.isArray(record.unifiedRecords) ? record.unifiedRecords : []),
    [record.unifiedRecords]
  );

  // جمع كافة مفاتيح الشواهد المطلوبة لتحميل معايناتها من IndexedDB
  const neededBlobKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const ev of evidences) {
      if (ev.blobKey) keys.add(ev.blobKey);
    }
    for (const rec of unifiedRecords) {
      for (const ev of rec.evidences || []) {
        if (ev.blobKey) keys.add(ev.blobKey);
      }
    }
    return Array.from(keys);
  }, [evidences, unifiedRecords]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const repo = getDefaultGiftedAttachmentRepository();
      const nextMap: Record<
        string,
        { url: string; mimeType: string; filename: string }
      > = {};

      for (const key of neededBlobKeys) {
        try {
          const att = await repo.getAttachment(key);
          if (att && att.bytes && att.bytes.length > 0) {
            const blob = new Blob([new Uint8Array(att.bytes)], {
              type: att.mimeType || 'application/octet-stream',
            });
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            nextMap[key] = {
              url,
              mimeType: att.mimeType,
              filename: att.filename,
            };
          }
        } catch {
          // تجاهل خطأ القراءة الفردي
        }
      }

      if (!cancelled) {
        setAttachmentPreviewMap(nextMap);
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
      for (const u of createdUrls) {
        URL.revokeObjectURL(u);
      }
    };
  }, [neededBlobKeys]);

  // خريطة الطلاب للوصول السريع بالمعرف studentId
  const studentMap = useMemo(() => {
    const map = new Map<string, { name: string; grade: string }>();
    for (const stu of record.students || []) {
      map.set(stu.id, { name: stu.name, grade: stu.grade });
    }
    return map;
  }, [record.students]);

  const filteredStudentsForPicker = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    const all = record.students || [];
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.grade && s.grade.toLowerCase().includes(q)) ||
        (s.civilId && s.civilId.includes(q))
    );
  }, [record.students, studentSearchQuery]);

  // التعامل مع التغيير الثنائي للتاريخ الميلادي -> الهجري
  const handleGregorianDateChange = (nextGregorian: string) => {
    setGregorianDate(nextGregorian);
    if (!nextGregorian.trim()) {
      setHijriDate('');
      return;
    }
    const computedHijri = convertGregorianToHijriYmd(nextGregorian);
    if (computedHijri) {
      setHijriDate(computedHijri);
    }
  };

  // التعامل مع التغيير الثنائي للتاريخ الهجري -> الميلادي
  const handleHijriDateChange = (nextHijri: string) => {
    setHijriDate(nextHijri);
    if (!nextHijri.trim()) {
      setGregorianDate('');
      return;
    }
    const computedGregorian = convertHijriToGregorianYmd(nextHijri);
    if (computedGregorian) {
      setGregorianDate(computedGregorian);
    }
  };

  const resetForm = () => {
    setEditingRecordId(null);
    setRecordType('برنامج');
    setTitle('');
    setDescription('');
    setDateOrDurationMode('date');
    setGregorianDate('');
    setHijriDate('');
    setDurationOption('أسبوع');
    setLocation('');
    setAcademicYear(defaultAcademicYear);
    setSemester(centralDefaults.semester);
    setProgramFields(createEmptyProgramFields());
    setReportFields(createEmptyReportFields());
    setInitiativeFields(createEmptyInitiativeFields());
    setParticipants([]);
    setEvidences([]);
    setLinks([]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewEvidenceTitle('');
    setNewEvidenceCaption('');
    setFeedbackBanner(null);
  };

  const handleEditRecord = (target: GiftedUnifiedSection2Record) => {
    setEditingRecordId(target.id);
    setRecordType(target.recordType);
    setTitle(target.title);
    setDescription(target.description || '');
    if (target.durationOption && !target.gregorianDate && !target.hijriDate) {
      setDateOrDurationMode('duration');
      setDurationOption(target.durationOption);
      setGregorianDate('');
      setHijriDate('');
    } else {
      setDateOrDurationMode('date');
      setGregorianDate(target.gregorianDate || '');
      setHijriDate(target.hijriDate || '');
      setDurationOption(target.durationOption || 'أسبوع');
    }
    setLocation(target.location || '');
    setAcademicYear(target.academicYear || defaultAcademicYear);
    setSemester(target.semester || centralDefaults.semester);
    setProgramFields(
      target.programFields
        ? { ...target.programFields }
        : createEmptyProgramFields()
    );
    setReportFields(
      target.reportFields
        ? { ...target.reportFields }
        : createEmptyReportFields()
    );
    setInitiativeFields(
      target.initiativeFields
        ? { ...target.initiativeFields }
        : createEmptyInitiativeFields()
    );
    setParticipants(
      (target.participants || []).map((p) => ({
        studentId: p.studentId,
        studentGradeAtParticipation: p.studentGradeAtParticipation,
        ...(p.scoreOrEvaluation
          ? { scoreOrEvaluation: p.scoreOrEvaluation }
          : {}),
        ...(p.statusRole ? { statusRole: p.statusRole } : {}),
        ...(p.participationType
          ? { participationType: p.participationType }
          : {}),
        ...(p.achievement ? { achievement: p.achievement } : {}),
      }))
    );
    setEvidences((target.evidences || []).map((ev) => ({ ...ev })));
    setLinks((target.links || []).map((lnk) => ({ ...lnk })));
    setFeedbackBanner(null);
    titleInputRef.current?.focus();
  };

  // تبديل اختيار طالب من القائمة المركزية (مع حفظ فوري في السجل عند إزالة طالب أثناء تعديل سجل محفوظ)
  const handleToggleStudentParticipant = (studentId: string) => {
    const exists = participants.some((p) => p.studentId === studentId);
    if (exists) {
      const nextParticipants = participants.filter(
        (p) => p.studentId !== studentId
      );
      setParticipants(nextParticipants);
      if (editingRecordId) {
        const nowIso = new Date().toISOString();
        updateRecord((prev) => ({
          ...prev,
          unifiedRecords: (prev.unifiedRecords || []).map((r) =>
            r.id === editingRecordId
              ? {
                  ...r,
                  participants: (r.participants || []).filter(
                    (p) => p.studentId !== studentId
                  ),
                  updatedAt: nowIso,
                }
              : r
          ),
        }));
        setFeedbackBanner({
          type: 'success',
          message:
            'تمت إزالة الطالب من قائمة المشاركين في هذا السجل وحفظ التحديث تلقائياً (دون المساس ببياناته في السجل المركزي).',
        });
      }
      return;
    }

    const stu = (record.students || []).find((s) => s.id === studentId);
    const snapshotGrade = stu?.grade || '';
    setParticipants((prev) => [
      ...prev,
      {
        studentId,
        studentGradeAtParticipation: snapshotGrade,
      },
    ]);
  };

  // إزالة طالب مباشرة من سجل محفوظ (برنامج / تقرير / مبادرة) مع الحفظ الفوري في التخزين
  const handleRemoveParticipantFromSavedRecord = (
    targetRecordId: string,
    studentId: string
  ) => {
    const nowIso = new Date().toISOString();
    updateRecord((prev) => ({
      ...prev,
      unifiedRecords: (prev.unifiedRecords || []).map((r) =>
        r.id === targetRecordId
          ? {
              ...r,
              participants: (r.participants || []).filter(
                (p) => p.studentId !== studentId
              ),
              updatedAt: nowIso,
            }
          : r
      ),
    }));
    if (editingRecordId === targetRecordId) {
      setParticipants((prev) =>
        prev.filter((p) => p.studentId !== studentId)
      );
    }
    setFeedbackBanner({
      type: 'success',
      message:
        'تمت إزالة الطالب من قائمة المشاركين في السجل وحفظ التغيير مباشرة (دون حذفه من السجل المركزي).',
    });
  };

  const handleUpdateParticipantField = (
    studentId: string,
    field: keyof Omit<
      GiftedSection2ParticipantItem,
      'studentId' | 'studentGradeAtParticipation'
    >,
    value: string
  ) => {
    setParticipants((prev) =>
      prev.map((item) => {
        if (item.studentId !== studentId) return item;
        const next: GiftedSection2ParticipantItem = { ...item };
        const trimmed = value;
        if (field === 'statusRole') {
          if (
            trimmed === 'موهوب' ||
            trimmed === 'مشارك' ||
            trimmed === 'متأهل لمرحلة من منافسة'
          ) {
            next.statusRole = trimmed;
          } else {
            delete next.statusRole;
          }
        } else if (field === 'scoreOrEvaluation') {
          if (trimmed) next.scoreOrEvaluation = trimmed;
          else delete next.scoreOrEvaluation;
        } else if (field === 'participationType') {
          if (trimmed) next.participationType = trimmed;
          else delete next.participationType;
        } else if (field === 'achievement') {
          if (trimmed) next.achievement = trimmed;
          else delete next.achievement;
        }
        return next;
      })
    );
  };

  // رفع شاهد جديد (صورة أو PDF) وحفظه في IndexedDB
  const handleEvidenceFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (evidences.length >= MAX_GIFTED_SECTION2_EVIDENCES) {
      setFeedbackBanner({
        type: 'error',
        message: `الحد الأقصى المسموح به للشواهد هو ${MAX_GIFTED_SECTION2_EVIDENCES} شواهد لكل سجل.`,
      });
      e.target.value = '';
      return;
    }

    const file = files[0];
    const mimeType = file.type || '';
    const isImage = mimeType.startsWith('image/');
    const isPdf =
      mimeType === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      setFeedbackBanner({
        type: 'error',
        message: 'يُسمح فقط برفع الصور (image/*) أو ملفات PDF.',
      });
      e.target.value = '';
      return;
    }

    setIsUploadingEvidence(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const nowIso = new Date().toISOString();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const blobKey = `sec2-att-${Date.now()}-${randomSuffix}`;
      const normalizedMime = isPdf ? 'application/pdf' : mimeType;

      const repo = getDefaultGiftedAttachmentRepository();
      await repo.putAttachment({
        blobKey,
        filename: file.name,
        mimeType: normalizedMime,
        bytes,
        createdAt: nowIso,
      });

      // تسجيل مفتاح المرفق في السجل لضمان شموله في النسخ الاحتياطي ZIP
      updateRecord((prev) => registerAttachmentBlobKeyInRecord(prev, blobKey));

      if (onRefreshAttachments) {
        await onRefreshAttachments();
      }

      const evTitle =
        newEvidenceTitle.trim() || file.name.replace(/\.[^.]+$/, '');
      const evCaption = newEvidenceCaption.trim();

      const newEvidenceItem: GiftedSection2EvidenceItem = {
        id: `ev-${Date.now()}-${randomSuffix}`,
        blobKey,
        filename: file.name,
        mimeType: normalizedMime,
        title: evTitle,
        ...(evCaption ? { caption: evCaption } : {}),
        createdAt: nowIso,
      };

      setEvidences((prev) => [...prev, newEvidenceItem]);
      setNewEvidenceTitle('');
      setNewEvidenceCaption('');
      setFeedbackBanner({
        type: 'success',
        message: `تم إرفاق الشاهد «${file.name}» وحفظه في قاعدة المرفقات المحلية.`,
      });
    } catch {
      setFeedbackBanner({
        type: 'error',
        message: 'تعذّر حفظ الشاهد في التخزين المحلي IndexedDB.',
      });
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = (evidenceId: string) => {
    const targetEv = evidences.find((item) => item.id === evidenceId);
    setEvidences((prev) => prev.filter((item) => item.id !== evidenceId));
    const orphanKey = targetEv?.blobKey?.trim();
    if (!orphanKey) return;
    const stillReferencedInSaved =
      (record.unifiedRecords || []).some((r) =>
        (r.evidences || []).some((ev) => ev.blobKey === orphanKey)
      ) ||
      Object.values(record.evidenceBundles || {}).some((b) =>
        (b?.photos || []).some((p) => p.blobKey === orphanKey)
      );
    if (!stillReferencedInSaved) {
      updateRecord((prev) => ({
        ...prev,
        activeAttachmentBlobKeys: Array.isArray(prev.activeAttachmentBlobKeys)
          ? prev.activeAttachmentBlobKeys.filter((k) => k !== orphanKey)
          : prev.activeAttachmentBlobKeys,
      }));
      void getDefaultGiftedAttachmentRepository()
        .deleteAttachment(orphanKey)
        .then(() => onRefreshAttachments?.())
        .catch(() => {});
    }
  };

  // إضافة رابط إلكتروني (بحد أقصى رابطين)
  const handleAddLink = () => {
    if (links.length >= MAX_GIFTED_SECTION2_LINKS) {
      setFeedbackBanner({
        type: 'error',
        message: `الحد الأقصى للروابط هو رابطان (${MAX_GIFTED_SECTION2_LINKS}) لكل سجل.`,
      });
      return;
    }

    const cleanUrl = normalizeExternalUrl(newLinkUrl);
    if (!cleanUrl) {
      setFeedbackBanner({
        type: 'error',
        message: 'يرجى إدخال عنوان الرابط الإلكتروني أولاً.',
      });
      return;
    }

    const cleanTitle = newLinkTitle.trim() || cleanUrl;
    const newLink: GiftedSection2LinkItem = {
      id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: cleanTitle,
      url: cleanUrl,
    };

    setLinks((prev) => [...prev, newLink]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setFeedbackBanner(null);
  };

  const handleRemoveLink = (linkId: string) => {
    setLinks((prev) => prev.filter((item) => item.id !== linkId));
  };

  // حفظ السجل الموحد (برنامج / تقرير / مبادرة)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanLocation = location.trim();
    const cleanAcademicYear = academicYear.trim() || defaultAcademicYear;

    if (!cleanTitle) {
      setFeedbackBanner({
        type: 'error',
        message: 'يرجى إدخال عنوان السجل.',
      });
      return;
    }

    if (dateOrDurationMode === 'date' && !gregorianDate.trim() && !hijriDate.trim()) {
      setFeedbackBanner({
        type: 'error',
        message: 'يرجى تحديد التاريخ (الهجري أو الميلادي) أو اختيار مدة التنفيذ.',
      });
      return;
    }

    const nowIso = new Date().toISOString();

    const cleanedParticipants: GiftedSection2ParticipantItem[] = participants.map(
      (p) => {
        const score = (p.scoreOrEvaluation || '').trim();
        const partType = (p.participationType || '').trim();
        const ach = (p.achievement || '').trim();
        return {
          studentId: p.studentId,
          studentGradeAtParticipation: p.studentGradeAtParticipation,
          ...(score ? { scoreOrEvaluation: score } : {}),
          ...(p.statusRole ? { statusRole: p.statusRole } : {}),
          ...(partType ? { participationType: partType } : {}),
          ...(ach ? { achievement: ach } : {}),
        };
      }
    );

    const recordPayload: GiftedUnifiedSection2Record = {
      id:
        editingRecordId ||
        `sec2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recordType,
      title: cleanTitle,
      description: cleanDescription,
      ...(dateOrDurationMode === 'date' && gregorianDate.trim()
        ? { gregorianDate: gregorianDate.trim() }
        : {}),
      ...(dateOrDurationMode === 'date' && hijriDate.trim()
        ? { hijriDate: hijriDate.trim() }
        : {}),
      ...(dateOrDurationMode === 'duration'
        ? { durationOption }
        : {}),
      ...(cleanLocation ? { location: cleanLocation } : {}),
      academicYear: cleanAcademicYear,
      semester,
      participants: cleanedParticipants,
      evidences: evidences.slice(0, MAX_GIFTED_SECTION2_EVIDENCES),
      links: links.slice(0, MAX_GIFTED_SECTION2_LINKS),
      ...(recordType === 'برنامج'
        ? {
            programFields: {
              executionScope: programFields.executionScope,
              programTypeOrField: programFields.programTypeOrField.trim(),
              objective: programFields.objective.trim(),
              targetAudience: programFields.targetAudience.trim(),
              executingEntity: programFields.executingEntity.trim(),
              results: programFields.results.trim(),
              notesAndRecommendations:
                programFields.notesAndRecommendations.trim(),
            },
          }
        : {}),
      ...(recordType === 'تقرير'
        ? {
            reportFields: {
              reportObjectives: reportFields.reportObjectives.trim(),
              resultsAndOutputs: reportFields.resultsAndOutputs.trim(),
              achievementIndicators: reportFields.achievementIndicators.trim(),
              challengesAndDifficulties:
                reportFields.challengesAndDifficulties.trim(),
              recommendationsAndProposals:
                reportFields.recommendationsAndProposals.trim(),
              notes: reportFields.notes.trim(),
            },
          }
        : {}),
      ...(recordType === 'مبادرة'
        ? {
            initiativeFields: {
              initiativeIdea: initiativeFields.initiativeIdea.trim(),
              initiativeObjectives:
                initiativeFields.initiativeObjectives.trim(),
              targetAudience: initiativeFields.targetAudience.trim(),
              executionSteps: initiativeFields.executionSteps.trim(),
              resultsAndImpact: initiativeFields.resultsAndImpact.trim(),
              challenges: initiativeFields.challenges.trim(),
              recommendations: initiativeFields.recommendations.trim(),
            },
          }
        : {}),
      createdAt: editingRecordId
        ? unifiedRecords.find((r) => r.id === editingRecordId)?.createdAt ||
          nowIso
        : nowIso,
      updatedAt: nowIso,
    };

    const deletedBlobKeysFromEdit: string[] = [];
    updateRecord((prev) => {
      const currentList = Array.isArray(prev.unifiedRecords)
        ? prev.unifiedRecords
        : [];
      const previousEditingRecord = editingRecordId
        ? currentList.find((r) => r.id === editingRecordId)
        : undefined;
      const nextList = editingRecordId
        ? currentList.map((r) => (r.id === editingRecordId ? recordPayload : r))
        : [...currentList, recordPayload];

      if (previousEditingRecord) {
        const retainedKeys = new Set(
          recordPayload.evidences.map((ev) => ev.blobKey)
        );
        for (const oldEv of previousEditingRecord.evidences || []) {
          if (!oldEv.blobKey || retainedKeys.has(oldEv.blobKey)) continue;
          const usedElsewhere =
            nextList.some((r) =>
              (r.evidences || []).some((ev) => ev.blobKey === oldEv.blobKey)
            ) ||
            Object.values(prev.evidenceBundles || {}).some((b) =>
              (b?.photos || []).some((p) => p.blobKey === oldEv.blobKey)
            );
          if (!usedElsewhere) {
            deletedBlobKeysFromEdit.push(oldEv.blobKey);
          }
        }
      }

      let updated: GiftedCoordinatorRecord = {
        ...prev,
        updatedAt: nowIso,
        unifiedRecords: nextList,
        ...(deletedBlobKeysFromEdit.length > 0 &&
        Array.isArray(prev.activeAttachmentBlobKeys)
          ? {
              activeAttachmentBlobKeys: prev.activeAttachmentBlobKeys.filter(
                (k) => !deletedBlobKeysFromEdit.includes(k)
              ),
            }
          : {}),
      };
      for (const ev of recordPayload.evidences) {
        if (ev.blobKey) {
          updated = registerAttachmentBlobKeyInRecord(updated, ev.blobKey);
        }
      }
      return updated;
    });

    if (deletedBlobKeysFromEdit.length > 0) {
      const repo = getDefaultGiftedAttachmentRepository();
      void Promise.all(
        deletedBlobKeysFromEdit.map((k) => repo.deleteAttachment(k))
      )
        .then(() => onRefreshAttachments?.())
        .catch(() => {});
    }

    const savedTypeLabel = recordType;
    const wasEditing = Boolean(editingRecordId);
    resetForm();
    setFeedbackBanner({
      type: 'success',
      message: wasEditing
        ? `تم تحديث سجل (${savedTypeLabel}: ${cleanTitle}) بنجاح.`
        : `تم حفظ سجل (${savedTypeLabel}: ${cleanTitle}) بنجاح.`,
    });
  };

  const handleConfirmDelete = (targetId: string) => {
    const target = unifiedRecords.find((r) => r.id === targetId);
    const orphanedBlobKeys: string[] = [];
    updateRecord((prev) => {
      const remainingRecords = (prev.unifiedRecords || []).filter(
        (r) => r.id !== targetId
      );
      const removedRec = (prev.unifiedRecords || []).find(
        (r) => r.id === targetId
      );
      for (const ev of removedRec?.evidences || []) {
        if (!ev.blobKey) continue;
        const stillReferenced =
          remainingRecords.some((r) =>
            (r.evidences || []).some((item) => item.blobKey === ev.blobKey)
          ) ||
          Object.values(prev.evidenceBundles || {}).some((b) =>
            (b?.photos || []).some((p) => p.blobKey === ev.blobKey)
          );
        if (!stillReferenced) {
          orphanedBlobKeys.push(ev.blobKey);
        }
      }
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        unifiedRecords: remainingRecords,
        ...(orphanedBlobKeys.length > 0 &&
        Array.isArray(prev.activeAttachmentBlobKeys)
          ? {
              activeAttachmentBlobKeys: prev.activeAttachmentBlobKeys.filter(
                (k) => !orphanedBlobKeys.includes(k)
              ),
            }
          : {}),
      };
    });
    if (orphanedBlobKeys.length > 0) {
      const repo = getDefaultGiftedAttachmentRepository();
      void Promise.all(orphanedBlobKeys.map((k) => repo.deleteAttachment(k)))
        .then(() => onRefreshAttachments?.())
        .catch(() => {});
    }
    if (editingRecordId === targetId) {
      resetForm();
    }
    if (previewRecordId === targetId) {
      setPreviewRecordId(null);
    }
    setConfirmDeleteId(null);
    if (target) {
      setFeedbackBanner({
        type: 'success',
        message: `تم حذف السجل «${target.title}».`,
      });
    }
  };

  const filteredRecords = useMemo(() => {
    const q = listSearchQuery.trim().toLowerCase();
    return unifiedRecords.filter((item) => {
      if (typeFilter !== 'all' && item.recordType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q))
      );
    });
  }, [unifiedRecords, typeFilter, listSearchQuery]);

  const previewRecord = useMemo(
    () => unifiedRecords.find((r) => r.id === previewRecordId) || null,
    [unifiedRecords, previewRecordId]
  );

  // تحضير الحقول غير الفارغة فقط للمعاينة النهائية (قاعدة: الحقول الفارغة لا تظهر في المخرجات النهائية)
  const buildNonEmptyTypeFieldsForPreview = (
    rec: GiftedUnifiedSection2Record
  ): Array<{ label: string; value: string }> => {
    const rows: Array<{ label: string; value: string }> = [];
    if (rec.recordType === 'برنامج' && rec.programFields) {
      const pf = rec.programFields;
      if (pf.executionScope?.trim()) {
        rows.push({ label: 'نطاق التنفيذ', value: pf.executionScope.trim() });
      }
      if (pf.programTypeOrField?.trim()) {
        rows.push({
          label: 'نوع أو مجال البرنامج',
          value: pf.programTypeOrField.trim(),
        });
      }
      if (pf.objective?.trim()) {
        rows.push({ label: 'الهدف', value: pf.objective.trim() });
      }
      if (pf.targetAudience?.trim()) {
        rows.push({
          label: 'الفئة المستهدفة',
          value: pf.targetAudience.trim(),
        });
      }
      if (pf.executingEntity?.trim()) {
        rows.push({
          label: 'الجهة المنفذة',
          value: pf.executingEntity.trim(),
        });
      }
      if (pf.results?.trim()) {
        rows.push({ label: 'النتائج', value: pf.results.trim() });
      }
      if (pf.notesAndRecommendations?.trim()) {
        rows.push({
          label: 'ملاحظات أو توصيات',
          value: pf.notesAndRecommendations.trim(),
        });
      }
    } else if (rec.recordType === 'تقرير' && rec.reportFields) {
      const rf = rec.reportFields;
      if (rf.reportObjectives?.trim()) {
        rows.push({
          label: 'أهداف التقرير',
          value: rf.reportObjectives.trim(),
        });
      }
      if (rf.resultsAndOutputs?.trim()) {
        rows.push({
          label: 'النتائج أو المخرجات',
          value: rf.resultsAndOutputs.trim(),
        });
      }
      if (rf.achievementIndicators?.trim()) {
        rows.push({
          label: 'مؤشرات الإنجاز',
          value: rf.achievementIndicators.trim(),
        });
      }
      if (rf.challengesAndDifficulties?.trim()) {
        rows.push({
          label: 'التحديات أو الصعوبات',
          value: rf.challengesAndDifficulties.trim(),
        });
      }
      if (rf.recommendationsAndProposals?.trim()) {
        rows.push({
          label: 'التوصيات أو المقترحات',
          value: rf.recommendationsAndProposals.trim(),
        });
      }
      if (rf.notes?.trim()) {
        rows.push({ label: 'ملاحظات', value: rf.notes.trim() });
      }
    } else if (rec.recordType === 'مبادرة' && rec.initiativeFields) {
      const inf = rec.initiativeFields;
      if (inf.initiativeIdea?.trim()) {
        rows.push({
          label: 'فكرة المبادرة',
          value: inf.initiativeIdea.trim(),
        });
      }
      if (inf.initiativeObjectives?.trim()) {
        rows.push({
          label: 'أهداف المبادرة',
          value: inf.initiativeObjectives.trim(),
        });
      }
      if (inf.targetAudience?.trim()) {
        rows.push({
          label: 'الفئة المستهدفة',
          value: inf.targetAudience.trim(),
        });
      }
      if (inf.executionSteps?.trim()) {
        rows.push({
          label: 'خطوات التنفيذ',
          value: inf.executionSteps.trim(),
        });
      }
      if (inf.resultsAndImpact?.trim()) {
        rows.push({
          label: 'النتائج أو الأثر',
          value: inf.resultsAndImpact.trim(),
        });
      }
      if (inf.challenges?.trim()) {
        rows.push({ label: 'التحديات', value: inf.challenges.trim() });
      }
      if (inf.recommendations?.trim()) {
        rows.push({ label: 'التوصيات', value: inf.recommendations.trim() });
      }
    }
    return rows;
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* ترويسة القسم الثاني */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-stone-900">
              02 البرامج والتقارير والمبادرات
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              النموذج الموحد لتوثيق البرامج والتقارير والمبادرات وربطها بالطلاب
              والشواهد والروابط الإلكترونية
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {GIFTED_SECTION2_RECORD_TYPES.map((t) => {
              const count = unifiedRecords.filter(
                (r) => r.recordType === t
              ).length;
              const style = RECORD_TYPE_BADGE_STYLES[t];
              return (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${style.bg} ${style.text} ${style.border}`}
                >
                  <span>{t}:</span>
                  <span>{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* رسائل التغذية الراجعة */}
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

      {/* النموذج الموحد */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
          <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
            {editingRecordId ? (
              <>
                <Edit3 className="w-4 h-4 text-[#7F1D3F]" />
                <span>تعديل السجل ({recordType})</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-[#7F1D3F]" />
                <span>إضافة سجل جديد ({recordType})</span>
              </>
            )}
          </h3>
          {editingRecordId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إلغاء التعديل</span>
            </button>
          )}
        </div>

        {/* أزرار اختيار نوع السجل (برنامج / تقرير / مبادرة) */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-2">
            نوع السجل <span className="text-red-600">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {GIFTED_SECTION2_RECORD_TYPES.map((typeOption) => {
              const active = recordType === typeOption;
              return (
                <button
                  key={typeOption}
                  type="button"
                  onClick={() => setRecordType(typeOption)}
                  aria-pressed={active}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-extrabold transition-all ${
                    active
                      ? 'bg-[#7F1D3F] text-white border-[#7F1D3F] shadow-sm'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {typeOption}
                </button>
              );
            })}
          </div>
        </div>

        {/* الحقول المشتركة */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* العنوان */}
            <div className="sm:col-span-2">
              <label
                htmlFor="sec2-title"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                العنوان <span className="text-red-600">*</span>
              </label>
              <input
                ref={titleInputRef}
                id="sec2-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`عنوان ال${recordType}`}
                className="w-full rounded-xl border border-stone-300 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 focus:bg-white focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>

            {/* العام الدراسي */}
            <div>
              <label
                htmlFor="sec2-academic-year"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                العام الدراسي <span className="text-red-600">*</span>
              </label>
              <input
                id="sec2-academic-year"
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="مثال: 1447هـ"
                className="w-full rounded-xl border border-stone-300 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 focus:bg-white focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>

            {/* الفصل الدراسي */}
            <div>
              <label
                htmlFor="sec2-semester"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                الفصل الدراسي <span className="text-red-600">*</span>
              </label>
              <select
                id="sec2-semester"
                value={semester}
                onChange={(e) =>
                  setSemester(e.target.value as ApprovedSchoolSemester)
                }
                className="w-full rounded-xl border border-stone-300 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 focus:bg-white focus:border-[#7F1D3F] focus:outline-none"
              >
                {APPROVED_SCHOOL_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* الوصف والموقع */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="sec2-description"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                الوصف
              </label>
              <textarea
                id="sec2-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`وصف موجز عن ال${recordType}...`}
                className="w-full rounded-xl border border-stone-300 bg-stone-50/60 px-3.5 py-2 text-sm text-stone-900 focus:bg-white focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="sec2-location"
                className="block text-xs font-bold text-stone-700 mb-1.5"
              >
                الموقع{' '}
                <span className="text-stone-400 font-normal">(اختياري)</span>
              </label>
              <input
                id="sec2-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: قاعة الموهوبين / عن بعد"
                className="w-full rounded-xl border border-stone-300 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 focus:bg-white focus:border-[#7F1D3F] focus:outline-none"
              />
            </div>
          </div>

          {/* التاريخ أو المدة */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-stone-800">
                التاريخ أو المدة <span className="text-red-600">*</span>
              </span>
              <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setDateOrDurationMode('date')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    dateOrDurationMode === 'date'
                      ? 'bg-[#7F1D3F] text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  تاريخ محدد (هجري / ميلادي)
                </button>
                <button
                  type="button"
                  onClick={() => setDateOrDurationMode('duration')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    dateOrDurationMode === 'duration'
                      ? 'bg-[#7F1D3F] text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  مدة التنفيذ (بدون تاريخ محدد)
                </button>
              </div>
            </div>

            {dateOrDurationMode === 'date' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="sec2-hijri-date"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    التاريخ الهجري (YYYY/MM/DD)
                  </label>
                  <input
                    id="sec2-hijri-date"
                    type="text"
                    dir="ltr"
                    value={hijriDate}
                    onChange={(e) => handleHijriDateChange(e.target.value)}
                    placeholder="1448/04/15"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                  {gregorianDate && (
                    <p className="text-[11px] text-stone-500 mt-1">
                      الموافق نصاً: {formatGregorianToHijriDate(gregorianDate)}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="sec2-gregorian-date"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    التاريخ الميلادي (YYYY-MM-DD)
                  </label>
                  <input
                    id="sec2-gregorian-date"
                    type="date"
                    dir="ltr"
                    value={gregorianDate}
                    onChange={(e) => handleGregorianDateChange(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="sec2-duration-option"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  المدة المعتمدة
                </label>
                <select
                  id="sec2-duration-option"
                  value={durationOption}
                  onChange={(e) =>
                    setDurationOption(
                      e.target.value as GiftedApprovedDurationOption
                    )
                  }
                  className="w-full sm:w-72 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                >
                  {GIFTED_APPROVED_DURATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* الحقول الخاصة بحسب النوع المختار */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-4">
          <h4 className="text-xs font-extrabold text-[#7F1D3F] border-b border-stone-200 pb-2">
            حقول {recordType === 'برنامج' ? 'البرنامج' : recordType === 'تقرير' ? 'التقرير' : 'المبادرة'}
          </h4>

          {recordType === 'برنامج' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. نطاق التنفيذ */}
              <div>
                <label
                  htmlFor="prog-execution-scope"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  نطاق التنفيذ
                </label>
                <select
                  id="prog-execution-scope"
                  value={programFields.executionScope}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      executionScope: e.target
                        .value as GiftedProgramExecutionScope,
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                >
                  {GIFTED_PROGRAM_EXECUTION_SCOPES.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. نوع أو مجال البرنامج */}
              <div>
                <label
                  htmlFor="prog-type-or-field"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  نوع أو مجال البرنامج
                </label>
                <input
                  id="prog-type-or-field"
                  type="text"
                  value={programFields.programTypeOrField}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      programTypeOrField: e.target.value,
                    }))
                  }
                  placeholder="مثال: إثرائي علمي / بحثي / تقني"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 4. الفئة المستهدفة */}
              <div>
                <label
                  htmlFor="prog-target-audience"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  الفئة المستهدفة
                </label>
                <input
                  id="prog-target-audience"
                  type="text"
                  value={programFields.targetAudience}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      targetAudience: e.target.value,
                    }))
                  }
                  placeholder="مثال: الطلاب الموهوبون في المرحلة المتوسطة"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 5. الجهة المنفذة */}
              <div>
                <label
                  htmlFor="prog-executing-entity"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  الجهة المنفذة
                </label>
                <input
                  id="prog-executing-entity"
                  type="text"
                  value={programFields.executingEntity}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      executingEntity: e.target.value,
                    }))
                  }
                  placeholder="مثال: منسق الموهوبين / إدارة الموهوبين"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 3. الهدف */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="prog-objective"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  الهدف
                </label>
                <textarea
                  id="prog-objective"
                  rows={2}
                  value={programFields.objective}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      objective: e.target.value,
                    }))
                  }
                  placeholder="أهداف البرنامج..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 6. النتائج */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="prog-results"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  النتائج
                </label>
                <textarea
                  id="prog-results"
                  rows={2}
                  value={programFields.results}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      results: e.target.value,
                    }))
                  }
                  placeholder="أبرز النتائج المحققة..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 7. ملاحظات أو توصيات */}
              <div>
                <label
                  htmlFor="prog-notes-recommendations"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  ملاحظات أو توصيات
                </label>
                <textarea
                  id="prog-notes-recommendations"
                  rows={2}
                  value={programFields.notesAndRecommendations}
                  onChange={(e) =>
                    setProgramFields((prev) => ({
                      ...prev,
                      notesAndRecommendations: e.target.value,
                    }))
                  }
                  placeholder="ملاحظات أو توصيات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          {recordType === 'تقرير' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. أهداف التقرير */}
              <div>
                <label
                  htmlFor="rep-objectives"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  أهداف التقرير
                </label>
                <textarea
                  id="rep-objectives"
                  rows={2}
                  value={reportFields.reportObjectives}
                  onChange={(e) =>
                    setReportFields((prev) => ({
                      ...prev,
                      reportObjectives: e.target.value,
                    }))
                  }
                  placeholder="أهداف التقرير..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 2. النتائج أو المخرجات */}
              <div>
                <label
                  htmlFor="rep-results-outputs"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  النتائج أو المخرجات
                </label>
                <textarea
                  id="rep-results-outputs"
                  rows={2}
                  value={reportFields.resultsAndOutputs}
                  onChange={(e) =>
                    setReportFields((prev) => ({
                      ...prev,
                      resultsAndOutputs: e.target.value,
                    }))
                  }
                  placeholder="النتائج أو المخرجات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 3. مؤشرات الإنجاز */}
              <div>
                <label
                  htmlFor="rep-indicators"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  مؤشرات الإنجاز
                </label>
                <textarea
                  id="rep-indicators"
                  rows={2}
                  value={reportFields.achievementIndicators}
                  onChange={(e) =>
                    setReportFields((prev) => ({
                      ...prev,
                      achievementIndicators: e.target.value,
                    }))
                  }
                  placeholder="مؤشرات الإنجاز..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 4. التحديات أو الصعوبات */}
              <div>
                <label
                  htmlFor="rep-challenges"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  التحديات أو الصعوبات
                </label>
                <textarea
                  id="rep-challenges"
                  rows={2}
                  value={reportFields.challengesAndDifficulties}
                  onChange={(e) =>
                    setReportFields((prev) => ({
                      ...prev,
                      challengesAndDifficulties: e.target.value,
                    }))
                  }
                  placeholder="التحديات أو الصعوبات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 5. التوصيات أو المقترحات */}
              <div>
                <label
                  htmlFor="rep-recommendations"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  التوصيات أو المقترحات
                </label>
                <textarea
                  id="rep-recommendations"
                  rows={2}
                  value={reportFields.recommendationsAndProposals}
                  onChange={(e) =>
                    setReportFields((prev) => ({
                      ...prev,
                      recommendationsAndProposals: e.target.value,
                    }))
                  }
                  placeholder="التوصيات أو المقترحات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 6. ملاحظات */}
              <div>
                <label
                  htmlFor="rep-notes"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  ملاحظات
                </label>
                <textarea
                  id="rep-notes"
                  rows={2}
                  value={reportFields.notes}
                  onChange={(e) =>
                    setReportFields((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="ملاحظات إضافية..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}

          {recordType === 'مبادرة' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. فكرة المبادرة */}
              <div>
                <label
                  htmlFor="init-idea"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  فكرة المبادرة
                </label>
                <textarea
                  id="init-idea"
                  rows={2}
                  value={initiativeFields.initiativeIdea}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      initiativeIdea: e.target.value,
                    }))
                  }
                  placeholder="فكرة المبادرة..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 2. أهداف المبادرة */}
              <div>
                <label
                  htmlFor="init-objectives"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  أهداف المبادرة
                </label>
                <textarea
                  id="init-objectives"
                  rows={2}
                  value={initiativeFields.initiativeObjectives}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      initiativeObjectives: e.target.value,
                    }))
                  }
                  placeholder="أهداف المبادرة..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 3. الفئة المستهدفة */}
              <div>
                <label
                  htmlFor="init-target-audience"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  الفئة المستهدفة
                </label>
                <input
                  id="init-target-audience"
                  type="text"
                  value={initiativeFields.targetAudience}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      targetAudience: e.target.value,
                    }))
                  }
                  placeholder="مثال: الطلاب الموهوبون في المرحلة المتوسطة"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 4. خطوات التنفيذ */}
              <div>
                <label
                  htmlFor="init-steps"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  خطوات التنفيذ
                </label>
                <textarea
                  id="init-steps"
                  rows={2}
                  value={initiativeFields.executionSteps}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      executionSteps: e.target.value,
                    }))
                  }
                  placeholder="خطوات التنفيذ..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 5. النتائج أو الأثر */}
              <div>
                <label
                  htmlFor="init-results-impact"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  النتائج أو الأثر
                </label>
                <textarea
                  id="init-results-impact"
                  rows={2}
                  value={initiativeFields.resultsAndImpact}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      resultsAndImpact: e.target.value,
                    }))
                  }
                  placeholder="النتائج أو الأثر..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 6. التحديات */}
              <div>
                <label
                  htmlFor="init-challenges"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  التحديات
                </label>
                <textarea
                  id="init-challenges"
                  rows={2}
                  value={initiativeFields.challenges}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      challenges: e.target.value,
                    }))
                  }
                  placeholder="التحديات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>

              {/* 7. التوصيات */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="init-recommendations"
                  className="block text-xs font-bold text-stone-700 mb-1.5"
                >
                  التوصيات
                </label>
                <textarea
                  id="init-recommendations"
                  rows={2}
                  value={initiativeFields.recommendations}
                  onChange={(e) =>
                    setInitiativeFields((prev) => ({
                      ...prev,
                      recommendations: e.target.value,
                    }))
                  }
                  placeholder="التوصيات..."
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* اختيار الطلاب من القائمة المركزية (يُسمح بالحفظ مع 0 طلاب) */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#7F1D3F]" />
              <span className="text-xs font-extrabold text-stone-900">
                الطلاب المشاركون من السجل المركزي ({participants.length})
              </span>
              <span className="text-[11px] text-stone-500">
                (اختياري — يُسمح بحفظ السجل مع 0 طلاب)
              </span>
            </div>
            {(record.students || []).length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="بحث عن طالب في السجل المركزي..."
                  className="w-full rounded-lg border border-stone-300 bg-white pr-8 pl-3 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                />
              </div>
            )}
          </div>

          {(record.students || []).length === 0 ? (
            <p className="text-xs text-stone-500">
              لا يوجد طلاب مسجلون في السجل المركزي حالياً. يمكنك حفظ هذا السجل
              بدون طلاب أو إضافة الطلاب من قسم «01 الطلاب والطالبات».
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
              {filteredStudentsForPicker.map((stu) => {
                const isSelected = participants.some(
                  (p) => p.studentId === stu.id
                );
                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => handleToggleStudentParticipant(stu.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#7F1D3F] text-white border-[#7F1D3F]'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    <span>{stu.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {stu.grade}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* حقول مشاركة الطالب الاختيارية للطلاب المختارين */}
          {participants.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-stone-700">
                بيانات مشاركة الطلاب المختارين (حقول اختيارية — لا تظهر في
                المخرجات إذا تُركت فارغة):
              </div>
              {participants.map((part) => {
                const stuInfo = studentMap.get(part.studentId);
                return (
                  <div
                    key={part.studentId}
                    className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-stone-900">
                          {stuInfo?.name || part.studentId}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                          الصف وقت المشاركة: {part.studentGradeAtParticipation}
                        </span>
                      </div>
                      <button
                        type="button"
                        data-testid={`sec2-form-remove-participant-${part.studentId}`}
                        onClick={() =>
                          handleToggleStudentParticipant(part.studentId)
                        }
                        className="text-xs font-bold text-red-700 hover:underline cursor-pointer"
                      >
                        إزالة الطالب
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* 1. الدرجة أو التقييم */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          الدرجة أو التقييم (اختياري)
                        </label>
                        <input
                          type="text"
                          value={part.scoreOrEvaluation || ''}
                          onChange={(e) =>
                            handleUpdateParticipantField(
                              part.studentId,
                              'scoreOrEvaluation',
                              e.target.value
                            )
                          }
                          placeholder="مثال: 98% / ممتاز"
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                        />
                      </div>

                      {/* 2. الحالة أو الدور */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          الحالة أو الدور (اختياري)
                        </label>
                        <select
                          value={part.statusRole || ''}
                          onChange={(e) =>
                            handleUpdateParticipantField(
                              part.studentId,
                              'statusRole',
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                        >
                          <option value="">— غير محدد —</option>
                          {GIFTED_PARTICIPANT_STATUS_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. نوع المشاركة */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          نوع المشاركة (اختياري)
                        </label>
                        <input
                          type="text"
                          value={part.participationType || ''}
                          onChange={(e) =>
                            handleUpdateParticipantField(
                              part.studentId,
                              'participationType',
                              e.target.value
                            )
                          }
                          placeholder="مثال: بحث علمي / ورشة"
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                        />
                      </div>

                      {/* 4. الإنجاز */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">
                          الإنجاز (اختياري)
                        </label>
                        <input
                          type="text"
                          value={part.achievement || ''}
                          onChange={(e) =>
                            handleUpdateParticipantField(
                              part.studentId,
                              'achievement',
                              e.target.value
                            )
                          }
                          placeholder="مثال: المركز الأول"
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* الشواهد والروابط */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* الشواهد (بحد أقصى 4: صور أو PDF) */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#7F1D3F]" />
                <span className="text-xs font-extrabold text-stone-900">
                  الشواهد والمرفقات ({evidences.length}/
                  {MAX_GIFTED_SECTION2_EVIDENCES})
                </span>
              </div>
              <span className="text-[11px] text-stone-500">
                صور أو ملفات PDF
              </span>
            </div>

            {evidences.length < MAX_GIFTED_SECTION2_EVIDENCES ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newEvidenceTitle}
                    onChange={(e) => setNewEvidenceTitle(e.target.value)}
                    placeholder="عنوان الشاهد (اختياري)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newEvidenceCaption}
                    onChange={(e) => setNewEvidenceCaption(e.target.value)}
                    placeholder="تعليق توضيحي (اختياري)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    ref={evidenceFileInputRef}
                    id="sec2-evidence-file-input"
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={handleEvidenceFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingEvidence}
                    onClick={() => evidenceFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#7F1D3F]" />
                    <span>
                      {isUploadingEvidence
                        ? 'جاري الحفظ...'
                        : 'إرفاق شاهد (صورة أو PDF)'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                تم الوصول إلى الحد الأقصى للشواهد (
                {MAX_GIFTED_SECTION2_EVIDENCES} شواهد لكل سجل).
              </p>
            )}

            {evidences.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {evidences.map((ev) => {
                  const preview = attachmentPreviewMap[ev.blobKey];
                  const isPdf = ev.mimeType === 'application/pdf';
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-stone-200 bg-white p-2.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900 truncate">
                            {ev.title}
                          </div>
                          {ev.caption && (
                            <div className="text-[11px] text-stone-500 truncate">
                              {ev.caption}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEvidence(ev.id)}
                          aria-label={`حذف الشاهد ${ev.title}`}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {preview ? (
                        isPdf ? (
                          <div className="space-y-1.5">
                            <object
                              data={preview.url}
                              type="application/pdf"
                              aria-label={`معاينة ملف PDF ${ev.title}`}
                              className="w-full h-36 rounded-lg border border-stone-200 bg-stone-50"
                            >
                              <div className="p-3 text-center text-[11px] text-stone-600">
                                وثيقة PDF مرفقة ({ev.filename})
                              </div>
                            </object>
                            <div className="flex items-center justify-between bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7F1D3F]">
                                <FileText className="w-3.5 h-3.5" />
                                <span>معاينة وثيقة PDF</span>
                              </span>
                              <a
                                href={preview.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-stone-700 underline hover:text-[#7F1D3F]"
                              >
                                فتح الوثيقة كاملة
                              </a>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={preview.url}
                            alt={ev.title}
                            className="w-full h-28 object-cover rounded-lg border border-stone-200"
                          />
                        )
                      ) : (
                        <div className="h-24 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center text-[11px] text-stone-500">
                          {isPdf ? 'وثيقة PDF محفوظة' : 'صورة شاهد محفوظة'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* الروابط الإلكترونية (بحد أقصى 2 مع توليد رمز QR قابل للنقر) */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <div className="flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-[#7F1D3F]" />
                <span className="text-xs font-extrabold text-stone-900">
                  الروابط الإلكترونية ورموز QR ({links.length}/
                  {MAX_GIFTED_SECTION2_LINKS})
                </span>
              </div>
              <span className="text-[11px] text-stone-500">
                بحد أقصى رابطان
              </span>
            </div>

            {links.length < MAX_GIFTED_SECTION2_LINKS ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    id="sec2-new-link-title"
                    type="text"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    placeholder="عنوان الرابط"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                  <input
                    id="sec2-new-link-url"
                    type="text"
                    dir="ltr"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#7F1D3F] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#7F1D3F]" />
                  <span>إضافة الرابط وتوليد QR</span>
                </button>
              </div>
            ) : (
              <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                تم الوصول إلى الحد الأقصى للروابط ({MAX_GIFTED_SECTION2_LINKS}{' '}
                روابط لكل سجل).
              </p>
            )}

            {links.length > 0 && (
              <div className="space-y-2 pt-1">
                {links.map((lnk) => {
                  const qrDataUrl = generateQrSvgDataUrl(
                    lnk.url,
                    '#7F1D3F',
                    '#FFFFFF',
                    2
                  );
                  return (
                    <div
                      key={lnk.id}
                      className="rounded-xl border border-stone-200 bg-white p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {qrDataUrl && (
                          <a
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`فتح الرابط: ${lnk.title}`}
                            className="shrink-0 block rounded-lg border border-stone-200 p-1 hover:border-[#7F1D3F] transition-colors"
                          >
                            <img
                              src={qrDataUrl}
                              alt={`رمز QR للرابط ${lnk.title}`}
                              className="w-14 h-14 object-contain"
                            />
                          </a>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900 truncate">
                            {lnk.title}
                          </div>
                          <a
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                            className="text-[11px] text-[#7F1D3F] underline truncate block"
                          >
                            {lnk.url}
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(lnk.id)}
                        aria-label={`حذف الرابط ${lnk.title}`}
                        className="text-red-600 hover:text-red-800 p-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* زر الحفظ */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#7F1D3F] hover:bg-[#681733] transition-colors shadow-sm"
          >
            {editingRecordId ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>حفظ السجل في المكتبة</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* قائمة السجلات المحفوظة */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-extrabold text-stone-900">
              السجلات الموثقة ({filteredRecords.length})
            </h3>
            <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-0.5">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  typeFilter === 'all'
                    ? 'bg-[#7F1D3F] text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                الكل
              </button>
              {GIFTED_SECTION2_RECORD_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    typeFilter === t
                      ? 'bg-[#7F1D3F] text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder="بحث في البرامج والتقارير والمبادرات..."
              className="w-full rounded-xl border border-stone-300 bg-stone-50/60 pr-9 pl-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-[#7F1D3F] focus:outline-none"
            />
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center text-stone-500 text-sm">
            لا توجد سجلات موثقة في هذا القسم حتى الآن.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredRecords.map((rec) => {
              const badgeStyle = RECORD_TYPE_BADGE_STYLES[rec.recordType];
              const isPreviewOpen = previewRecordId === rec.id;
              return (
                <div
                  key={rec.id}
                  className="p-4 sm:p-5 hover:bg-stone-50/50 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg border text-xs font-extrabold ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                        >
                          {rec.recordType}
                        </span>
                        <h4 className="text-sm font-extrabold text-stone-900">
                          {rec.title}
                        </h4>
                        <span className="text-xs text-stone-500">
                          ({rec.academicYear} — {rec.semester})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                        {(rec.hijriDate || rec.gregorianDate) && (
                          <span>
                            التاريخ:{' '}
                            {[rec.hijriDate, rec.gregorianDate]
                              .filter(Boolean)
                              .join(' | ')}
                          </span>
                        )}
                        {rec.durationOption &&
                          !rec.hijriDate &&
                          !rec.gregorianDate && (
                            <span>المدة: {rec.durationOption}</span>
                          )}
                        {rec.location && <span>الموقع: {rec.location}</span>}
                        <span>الطلاب: {rec.participants.length}</span>
                        <span>الشواهد: {rec.evidences.length}</span>
                        <span>الروابط: {rec.links.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewRecordId(isPreviewOpen ? null : rec.id)
                        }
                        aria-label={`معاينة ${rec.title}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-[#7F1D3F] bg-[#7F1D3F]/10 hover:bg-[#7F1D3F]/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {isPreviewOpen ? 'إخفاء المخرج' : 'معاينة المخرج'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditRecord(rec)}
                        aria-label={`تعديل ${rec.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      {confirmDeleteId === rec.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(rec.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold text-white bg-red-600 hover:bg-red-700"
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 rounded-lg text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rec.id)}
                          aria-label={`حذف ${rec.title}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* بطاقة المعاينة والمخرج النهائي (تلتزم بعدم إظهار أي حقل فارغ) */}
      {previewRecord && (
        <div
          data-testid="sec2-record-preview"
          className="bg-white rounded-2xl border-2 border-[#7F1D3F]/30 shadow-md p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#7F1D3F] text-white text-xs font-extrabold">
                  {previewRecord.recordType}
                </span>
                <h3 className="text-base font-extrabold text-stone-900">
                  {previewRecord.title}
                </h3>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                العام الدراسي: {previewRecord.academicYear} —{' '}
                {previewRecord.semester}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewRecordId(null)}
              aria-label="إغلاق المعاينة"
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* البيانات الأساسية المشتركة غير الفارغة فقط */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {previewRecord.description?.trim() && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-xl bg-stone-50 p-3 border border-stone-200">
                <div className="text-[11px] font-bold text-stone-500 mb-1">
                  الوصف
                </div>
                <div className="text-xs font-semibold text-stone-900 whitespace-pre-wrap">
                  {previewRecord.description.trim()}
                </div>
              </div>
            )}

            {previewRecord.hijriDate?.trim() && (
              <div className="rounded-xl bg-stone-50 p-3 border border-stone-200">
                <div className="text-[11px] font-bold text-stone-500 mb-0.5">
                  التاريخ الهجري
                </div>
                <div className="text-xs font-bold text-stone-900" dir="ltr">
                  {previewRecord.hijriDate.trim()}
                </div>
              </div>
            )}

            {previewRecord.gregorianDate?.trim() && (
              <div className="rounded-xl bg-stone-50 p-3 border border-stone-200">
                <div className="text-[11px] font-bold text-stone-500 mb-0.5">
                  التاريخ الميلادي
                </div>
                <div className="text-xs font-bold text-stone-900" dir="ltr">
                  {previewRecord.gregorianDate.trim()}
                </div>
              </div>
            )}

            {previewRecord.durationOption &&
              !previewRecord.hijriDate?.trim() &&
              !previewRecord.gregorianDate?.trim() && (
                <div className="rounded-xl bg-stone-50 p-3 border border-stone-200">
                  <div className="text-[11px] font-bold text-stone-500 mb-0.5">
                    المدة
                  </div>
                  <div className="text-xs font-bold text-stone-900">
                    {previewRecord.durationOption}
                  </div>
                </div>
              )}

            {previewRecord.location?.trim() && (
              <div className="rounded-xl bg-stone-50 p-3 border border-stone-200">
                <div className="text-[11px] font-bold text-stone-500 mb-0.5">
                  الموقع
                </div>
                <div className="text-xs font-bold text-stone-900">
                  {previewRecord.location.trim()}
                </div>
              </div>
            )}
          </div>

          {/* الحقول التفصيلية غير الفارغة فقط */}
          {(() => {
            const nonEmptyRows = buildNonEmptyTypeFieldsForPreview(previewRecord);
            if (nonEmptyRows.length === 0) return null;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {nonEmptyRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl bg-stone-50 p-3 border border-stone-200"
                  >
                    <div className="text-[11px] font-bold text-[#7F1D3F] mb-1">
                      {row.label}
                    </div>
                    <div className="text-xs font-semibold text-stone-900 whitespace-pre-wrap">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* قائمة الطلاب المشاركين (تعرض الصف التاريخي وقت المشاركة، وتخفي الحقول الاختيارية الفارغة) */}
          {previewRecord.participants.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-stone-900">
                الطلاب المشاركون ({previewRecord.participants.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {previewRecord.participants.map((part) => {
                  const stuInfo = studentMap.get(part.studentId);
                  return (
                    <div
                      key={part.studentId}
                      className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-stone-900">
                            {stuInfo?.name || part.studentId}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700">
                            الصف: {part.studentGradeAtParticipation}
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid={`sec2-preview-remove-participant-${previewRecord.id}-${part.studentId}`}
                          onClick={() =>
                            handleRemoveParticipantFromSavedRecord(
                              previewRecord.id,
                              part.studentId
                            )
                          }
                          className="text-xs font-bold text-red-700 hover:underline cursor-pointer shrink-0"
                        >
                          إزالة الطالب
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px] text-stone-700">
                        {part.scoreOrEvaluation?.trim() && (
                          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">
                            الدرجة أو التقييم: {part.scoreOrEvaluation.trim()}
                          </span>
                        )}
                        {part.statusRole && (
                          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">
                            الحالة أو الدور: {part.statusRole}
                          </span>
                        )}
                        {part.participationType?.trim() && (
                          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">
                            نوع المشاركة: {part.participationType.trim()}
                          </span>
                        )}
                        {part.achievement?.trim() && (
                          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">
                            الإنجاز: {part.achievement.trim()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* الشواهد المرفقة (معاينة مرئية للصور ووثائق PDF) */}
          {previewRecord.evidences.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-stone-900">
                الشواهد المرفقة ({previewRecord.evidences.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewRecord.evidences.map((ev) => {
                  const preview = attachmentPreviewMap[ev.blobKey];
                  const isPdf = ev.mimeType === 'application/pdf';
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2"
                    >
                      <div className="text-xs font-extrabold text-stone-900">
                        {ev.title}
                      </div>
                      {ev.caption?.trim() && (
                        <div className="text-[11px] text-stone-600">
                          {ev.caption.trim()}
                        </div>
                      )}
                      {preview ? (
                        isPdf ? (
                          <div className="space-y-2">
                            <object
                              data={preview.url}
                              type="application/pdf"
                              aria-label={`معاينة PDF ${ev.title}`}
                              className="w-full h-48 rounded-lg border border-stone-200 bg-white"
                            >
                              <div className="p-4 text-center text-xs text-stone-600">
                                معاينة وثيقة PDF ({ev.filename})
                              </div>
                            </object>
                            <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-stone-200">
                              <span className="text-[11px] font-bold text-[#7F1D3F]">
                                وثيقة PDF مضمنة
                              </span>
                              <a
                                href={preview.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-800 hover:text-[#7F1D3F] underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>عرض الوثيقة كاملة</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={preview.url}
                            alt={ev.title}
                            className="w-full h-44 object-contain bg-white rounded-lg border border-stone-200"
                          />
                        )
                      ) : (
                        <div className="h-32 rounded-lg border border-stone-200 bg-white flex items-center justify-center text-xs text-stone-500">
                          {isPdf ? 'معاينة وثيقة PDF' : 'معاينة صورة الشاهد'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* الروابط الإلكترونية ورموز QR القابلة للنقر */}
          {previewRecord.links.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-stone-900">
                الروابط الإلكترونية ورموز الاستجابة السريعة (QR)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {previewRecord.links.map((lnk) => {
                  const qrSvgUrl = generateQrSvgDataUrl(
                    lnk.url,
                    '#7F1D3F',
                    '#FFFFFF',
                    3
                  );
                  return (
                    <div
                      key={lnk.id}
                      className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex items-center gap-3"
                    >
                      {qrSvgUrl && (
                        <a
                          href={lnk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`رمز QR قابل للنقر للرابط ${lnk.title}`}
                          className="shrink-0 rounded-xl border border-stone-200 bg-white p-1.5 hover:border-[#7F1D3F] transition-colors"
                        >
                          <img
                            src={qrSvgUrl}
                            alt={`QR ${lnk.title}`}
                            className="w-20 h-20 object-contain"
                          />
                        </a>
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-extrabold text-stone-900">
                          {lnk.title}
                        </div>
                        <a
                          href={lnk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7F1D3F] underline break-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>{lnk.url}</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
