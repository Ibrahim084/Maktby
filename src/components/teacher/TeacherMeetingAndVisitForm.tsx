import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookmarkCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  ClipboardPaste,
  Eye,
  FileDown,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Link2,
  Palette,
  PenTool,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../../types';
import { getGenderedLabels } from '../../utils/settingsStorage';
import { RecordDeletionImpact } from '../../utils/teacherArchiveEngine';
import {
  createNewBlankMeetingInArchive,
  deleteArchivedMeetingRecordSafely,
  inspectArchivedMeetingDeletionImpact,
  listSavedMeetings,
  loadActiveMeetingDraftWithMedia,
  loadArchivedMeetingWithMedia,
  migrateMeetingMinutesToArchive,
  saveActiveMeetingDraftWithMedia,
  saveMeetingToArchive,
  TeacherMeetingArchiveRecord,
} from '../../utils/teacherMeetingsArchive';
import {
  createNewBlankPeerVisitInArchive,
  deleteArchivedPeerVisitRecordSafely,
  inspectArchivedPeerVisitDeletionImpact,
  listSavedPeerVisits,
  loadActivePeerVisitDraftWithMedia,
  loadArchivedPeerVisitWithMedia,
  migratePeerVisitsToArchive,
  saveActivePeerVisitDraftWithMedia,
  savePeerVisitToArchive,
  TeacherPeerVisitArchiveRecord,
} from '../../utils/teacherPeerVisitsArchive';
import {
  bytesToDataUrl,
  getDefaultTeacherMediaRepository,
  saveMediaBytes,
  saveMediaDataUrl,
} from '../../utils/teacherMediaStorage';
import {
  buildTeacherMeetingOrVisitDocument,
  clearMeetingOrVisitDraft,
  createInitialAgendaItem,
  createInitialAttendeeItem,
  createInitialDecisionItem,
  createInitialMeetingOrVisitState,
  createSampleMeetingOrVisitState,
  loadMeetingOrVisitDraft,
  MAX_MEETING_ATTENDEES,
  MEETING_AGENDA_PRESETS,
  MEETING_DECISION_PRESETS,
  MEETING_EXECUTOR_ROLE_OPTIONS,
  MEETING_TYPE_OPTIONS,
  MeetingAgendaItem,
  MeetingDecisionItem,
  MeetingExecutorRoleType,
  MeetingMinutesFormState,
  MeetingTypeOption,
  parseBulkAttendeeNames,
  PEER_VISIT_PRACTICE_TO_APPLY_PRESETS,
  PEER_VISIT_SCOPE_OPTIONS,
  PEER_VISIT_TAKEAWAY_PRESETS,
  PEER_VISIT_TOPIC_OPTIONS,
  PeerVisitReportFormState,
  PeerVisitScopeOption,
  PeerVisitTopicOption,
  resolveMeetingExecutorLabel,
  saveMeetingOrVisitDraft,
  TEACHER_MEETINGS_AND_VISITS_CATALOG,
  TeacherMeetingAndVisitFormId,
  validateMeetingOrVisitState,
} from '../../utils/teacherMeetingsAndVisitsEngine';
import {
  createDefaultSampleEvidencePhotos,
  generateTeacherReportPdf,
  getTeacherColorPalette,
  paginateTeacherReportBlocks,
  renderTeacherReportPagesToCanvases,
  TEACHER_COLOR_PALETTES,
  TEACHER_TEMPLATE_DEFINITIONS,
  TeacherPageJpegWithLinks,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from '../../utils/teacherPdfEngine';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';

interface TeacherMeetingAndVisitFormProps {
  formId: TeacherMeetingAndVisitFormId;
  onBackToGroup: () => void;
  onBackToTeacherHub: () => void;
}

const ALL_TEMPLATES: TeacherPdfTemplateStyle[] = [
  'waves',
  'waves-2',
  'geometric',
];

const ALL_COLOR_SYSTEMS: TeacherPdfColorSystem[] = [
  'green',
  'blue',
  'slate',
];

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file result'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export const TeacherMeetingAndVisitForm: React.FC<
  TeacherMeetingAndVisitFormProps
> = ({ formId, onBackToGroup, onBackToTeacherHub }) => {
  const { settings, updateSettings } = useSettings();
  const gendered = getGenderedLabels(settings.gender);

  const catalogMeta = useMemo(
    () =>
      TEACHER_MEETINGS_AND_VISITS_CATALOG.find((item) => item.id === formId)!,
    [formId]
  );

  const groupLabel =
    catalogMeta.groupId === 'meetings-and-committees'
      ? 'الاجتماعات واللجان'
      : 'الزيارات والتبادل المهني';

  const templateStyle: TeacherPdfTemplateStyle =
    settings.teacherPdfTemplate ?? 'waves';
  const colorSystem: TeacherPdfColorSystem =
    settings.teacherPdfColorSystem ?? 'green';
  const palette = getTeacherColorPalette(colorSystem);
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];

  const isMeetingArchiveEnabled = formId === 'meeting-minutes';
  const isPeerVisitArchiveEnabled = formId === 'peer-visit-report';

  const [formState, setFormState] = useState(() =>
    loadMeetingOrVisitDraft(formId, settings)
  );
  const [bulkNamesInput, setBulkNamesInput] = useState<string>('');
  const [showBulkPasteBox, setShowBulkPasteBox] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [renderedPages, setRenderedPages] = useState<
    TeacherPageJpegWithLinks[]
  >([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Unified Archive State (Group 3: meeting-minutes | Group 4: peer-visit-report)
  const [activeArchivedRecordId, setActiveArchivedRecordId] = useState<
    string | null
  >(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    undefined
  );
  const [savedRecords, setSavedRecords] = useState<
    TeacherMeetingArchiveRecord[]
  >(() => (formId === 'meeting-minutes' ? listSavedMeetings() : []));
  const [savedPeerVisitRecords, setSavedPeerVisitRecords] = useState<
    TeacherPeerVisitArchiveRecord[]
  >(() => (formId === 'peer-visit-report' ? listSavedPeerVisits() : []));
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isSavingArchive, setIsSavingArchive] = useState<boolean>(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    record: TeacherMeetingArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);
  const [pendingPeerDeleteTarget, setPendingPeerDeleteTarget] = useState<{
    record: TeacherPeerVisitArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);
  const isHydratingRef = useRef<boolean>(true);

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );

  const refreshSavedMeetings = () => {
    if (formId === 'meeting-minutes') {
      setSavedRecords(listSavedMeetings());
    } else {
      setSavedRecords([]);
    }
  };

  const refreshSavedPeerVisits = () => {
    if (formId === 'peer-visit-report') {
      setSavedPeerVisitRecords(listSavedPeerVisits());
    } else {
      setSavedPeerVisitRecords([]);
    }
  };

  useEffect(() => {
    setValidationErrors([]);
    setStatusBanner(null);
    setActiveTab('edit');
    setBulkNamesInput('');
    setShowBulkPasteBox(false);
    setActiveArchivedRecordId(null);
    setPendingDeleteTarget(null);
    setPendingPeerDeleteTarget(null);
    setMediaNotice(null);

    let cancelled = false;
    isHydratingRef.current = true;

    if (formId === 'meeting-minutes') {
      setSavedPeerVisitRecords([]);
      const initMeetingArchiveAndDraft = async () => {
        try {
          await migrateMeetingMinutesToArchive({ settings });
          const hydrated = await loadActiveMeetingDraftWithMedia({ settings });
          if (cancelled) return;
          setFormState(hydrated.formData);
          setActiveDraftId(hydrated.draftRecord?.id);
          setSavedRecords(listSavedMeetings());
          if (hydrated.integrityWarnings.length > 0) {
            setStatusBanner({
              type: 'error',
              text: hydrated.integrityWarnings[0],
            });
          }
        } catch {
          if (!cancelled) {
            setFormState(loadMeetingOrVisitDraft(formId, settings));
            setSavedRecords(listSavedMeetings());
          }
        } finally {
          if (!cancelled) {
            setTimeout(() => {
              isHydratingRef.current = false;
            }, 0);
          }
        }
      };

      initMeetingArchiveAndDraft();
      return () => {
        cancelled = true;
      };
    }

    // Group 4: peer-visit-report
    setSavedRecords([]);
    const initPeerVisitArchiveAndDraft = async () => {
      try {
        await migratePeerVisitsToArchive({ settings });
        const hydrated = await loadActivePeerVisitDraftWithMedia({ settings });
        if (cancelled) return;
        setFormState(hydrated.formData);
        setActiveDraftId(hydrated.draftRecord?.id);
        setSavedPeerVisitRecords(listSavedPeerVisits());
        if (hydrated.integrityWarnings.length > 0) {
          setStatusBanner({
            type: 'error',
            text: hydrated.integrityWarnings[0],
          });
        }
      } catch {
        if (!cancelled) {
          setFormState(loadMeetingOrVisitDraft(formId, settings));
          setSavedPeerVisitRecords(listSavedPeerVisits());
        }
      } finally {
        if (!cancelled) {
          setTimeout(() => {
            isHydratingRef.current = false;
          }, 0);
        }
      }
    };

    initPeerVisitArchiveAndDraft();
    return () => {
      cancelled = true;
    };
  }, [formId]);

  useEffect(() => {
    if (isHydratingRef.current) return;
    if (activeArchivedRecordId) {
      // Edits to an open archived record commit on explicit "حفظ التعديلات في الأرشيف"
      return;
    }

    if (formId === 'meeting-minutes') {
      if (formState.formId !== 'meeting-minutes') return;
      let cancelled = false;
      const persistMeetingDraft = async () => {
        try {
          const res = await saveActiveMeetingDraftWithMedia(formState, {
            draftId: activeDraftId,
            settings,
          });
          if (
            !cancelled &&
            res.draftRecord?.id &&
            res.draftRecord.id !== activeDraftId
          ) {
            setActiveDraftId(res.draftRecord.id);
          }
        } catch {
          saveMeetingOrVisitDraft(formState);
        }
      };
      persistMeetingDraft();
      return () => {
        cancelled = true;
      };
    }

    if (formId === 'peer-visit-report') {
      if (formState.formId !== 'peer-visit-report') return;
      let cancelled = false;
      const persistPeerVisitDraft = async () => {
        try {
          const res = await saveActivePeerVisitDraftWithMedia(formState, {
            draftId: activeDraftId,
            settings,
          });
          if (
            !cancelled &&
            res.draftRecord?.id &&
            res.draftRecord.id !== activeDraftId
          ) {
            setActiveDraftId(res.draftRecord.id);
          }
        } catch {
          saveMeetingOrVisitDraft(formState);
        }
      };
      persistPeerVisitDraft();
      return () => {
        cancelled = true;
      };
    }
  }, [formId, formState, activeArchivedRecordId]);

  const reportDocument = useMemo(
    () =>
      buildTeacherMeetingOrVisitDocument(formState, settings, {
        templateStyle,
        colorSystem,
      }),
    [formState, settings, templateStyle, colorSystem]
  );

  const paginatedPages = useMemo(
    () => paginateTeacherReportBlocks(reportDocument, settings),
    [reportDocument, settings]
  );

  useEffect(() => {
    let cancelled = false;
    renderTeacherReportPagesToCanvases(reportDocument, settings)
      .then((pages) => {
        if (!cancelled) {
          setRenderedPages(pages);
        }
      })
      .catch(() => {
        // Ignore transient canvas errors
      });
    return () => {
      cancelled = true;
    };
  }, [reportDocument, settings]);

  const handleLoadSampleData = () => {
    const sample = createSampleMeetingOrVisitState(formId, settings);
    setFormState(sample);
    setValidationErrors([]);
    setMediaNotice(null);
    setStatusBanner({
      type: 'info',
      text: 'تم تعبئة النموذج ببيانات تجريبية متكاملة للمعاينة والتجربة.',
    });
  };

  const handleResetForm = () => {
    clearMeetingOrVisitDraft(formId);
    const fresh = createInitialMeetingOrVisitState(formId, settings);
    setFormState(fresh);
    setActiveArchivedRecordId(null);
    setMediaNotice(null);
    setValidationErrors([]);
    setBulkNamesInput('');
    setStatusBanner({
      type: 'info',
      text: 'تمت إعادة ضبط الحقول إلى الوضع الافتراضي.',
    });
  };

  const handleSaveMeetingToArchive = async () => {
    if (formState.formId !== 'meeting-minutes') return;
    const errors = validateMeetingOrVisitState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل حفظ محضر الاجتماع في الأرشيف.',
      });
      return;
    }

    setValidationErrors([]);
    try {
      setIsSavingArchive(true);
      const saved = await saveMeetingToArchive(formState, {
        recordId: activeArchivedRecordId ?? undefined,
        settings,
      });
      setActiveArchivedRecordId(saved.record.id);
      refreshSavedMeetings();
      setStatusBanner({
        type: 'success',
        text: saved.isNew
          ? `تم حفظ محضر الاجتماع سجلًا مستقلًا في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث سجل محضر الاجتماع في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'تعذر حفظ محضر الاجتماع في الأرشيف. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsSavingArchive(false);
    }
  };

  const handleCreateNewMeeting = () => {
    if (formId !== 'meeting-minutes') return;
    isHydratingRef.current = true;
    const created = createNewBlankMeetingInArchive({ settings });
    setActiveArchivedRecordId(null);
    setActiveDraftId(created.draftRecord.id);
    setFormState(created.formData);
    setValidationErrors([]);
    setMediaNotice(null);
    setBulkNamesInput('');
    setActiveTab('edit');
    setStatusBanner({
      type: 'info',
      text: 'تم فتح مسودة محضر اجتماع جديد فارغة مع الإبقاء على جميع المحاضر المحفوظة في الأرشيف دون تعديل.',
    });
    setTimeout(() => {
      isHydratingRef.current = false;
    }, 0);
  };

  const handleOpenArchivedMeeting = async (
    record: TeacherMeetingArchiveRecord
  ) => {
    if (formId !== 'meeting-minutes') return;
    try {
      isHydratingRef.current = true;
      const loaded = await loadArchivedMeetingWithMedia(record.id, {
        settings,
      });
      if (!loaded) {
        setStatusBanner({
          type: 'error',
          text: 'تعذر العثور على محضر الاجتماع المطلوب في الأرشيف.',
        });
        return;
      }
      setActiveArchivedRecordId(loaded.record.id);
      setFormState(loaded.formData);
      setValidationErrors([]);
      setMediaNotice(null);
      setActiveTab('edit');
      setStatusBanner(
        loaded.integrityWarnings.length > 0
          ? {
              type: 'error',
              text: loaded.integrityWarnings[0],
            }
          : {
              type: 'info',
              text: `تم فتح المحضر المحفوظ (${loaded.record.title}) للتعديل بالمعرف الثابت ${loaded.record.id}.`,
            }
      );
    } finally {
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    }
  };

  const handleRequestDeleteArchivedMeeting = (
    record: TeacherMeetingArchiveRecord
  ) => {
    const impact = inspectArchivedMeetingDeletionImpact(record.id);
    setPendingDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedMeeting = async () => {
    if (!pendingDeleteTarget) return;
    const { record } = pendingDeleteTarget;
    const outcome = await deleteArchivedMeetingRecordSafely(record.id, {
      confirmUnlink: true,
    });
    setPendingDeleteTarget(null);
    refreshSavedMeetings();
    if (activeArchivedRecordId === record.id) {
      setActiveArchivedRecordId(null);
    }
    if (outcome.result.deleted) {
      const unlinkedNote =
        outcome.result.unlinkedElementIds.length > 0
          ? ` وتم فك الارتباط في ${outcome.result.unlinkedElementIds.length} عنصر أداء مع تسجيل التدقيق.`
          : '';
      const sharedNote =
        outcome.result.preservedSharedBlobKeys.length > 0
          ? ' مع الإبقاء على المرفقات المشتركة في السجلات الأخرى.'
          : '';
      setStatusBanner({
        type: 'success',
        text: `تم حذف محضر الاجتماع «${record.title}» من الأرشيف بأمان${unlinkedNote}${sharedNote}`,
      });
    }
  };

  // Group 4 Archive Handlers (Strictly scoped to `peer-visit-report`)
  const handleSavePeerVisitToArchive = async () => {
    if (formState.formId !== 'peer-visit-report') return;
    const errors = validateMeetingOrVisitState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل حفظ تقرير الزيارة في الأرشيف.',
      });
      return;
    }

    setValidationErrors([]);
    try {
      setIsSavingArchive(true);
      const saved = await savePeerVisitToArchive(formState, {
        recordId: activeArchivedRecordId ?? undefined,
        settings,
      });
      setActiveArchivedRecordId(saved.record.id);
      refreshSavedPeerVisits();
      setStatusBanner({
        type: 'success',
        text: saved.isNew
          ? `تم حفظ تقرير الزيارة التبادلية سجلًا مستقلًا في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث سجل تقرير الزيارة التبادلية في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'تعذر حفظ تقرير الزيارة التبادلية في الأرشيف. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsSavingArchive(false);
    }
  };

  const handleCreateNewPeerVisit = () => {
    if (formId !== 'peer-visit-report') return;
    isHydratingRef.current = true;
    const created = createNewBlankPeerVisitInArchive({ settings });
    setActiveArchivedRecordId(null);
    setActiveDraftId(created.draftRecord.id);
    setFormState(created.formData);
    setValidationErrors([]);
    setMediaNotice(null);
    setActiveTab('edit');
    setStatusBanner({
      type: 'info',
      text: 'تم فتح مسودة تقرير زيارة تبادلية جديد فارغة مع الإبقاء على جميع التقارير المحفوظة في الأرشيف دون تعديل.',
    });
    setTimeout(() => {
      isHydratingRef.current = false;
    }, 0);
  };

  const handleOpenArchivedPeerVisit = async (
    record: TeacherPeerVisitArchiveRecord
  ) => {
    if (formId !== 'peer-visit-report') return;
    try {
      isHydratingRef.current = true;
      const loaded = await loadArchivedPeerVisitWithMedia(record.id, {
        settings,
      });
      if (!loaded) {
        setStatusBanner({
          type: 'error',
          text: 'تعذر العثور على تقرير الزيارة التبادلية المطلوب في الأرشيف.',
        });
        return;
      }
      setActiveArchivedRecordId(loaded.record.id);
      setFormState(loaded.formData);
      setValidationErrors([]);
      setMediaNotice(null);
      setActiveTab('edit');
      setStatusBanner(
        loaded.integrityWarnings.length > 0
          ? {
              type: 'error',
              text: loaded.integrityWarnings[0],
            }
          : {
              type: 'info',
              text: `تم فتح تقرير الزيارة المحفوظ (${loaded.record.title}) للتعديل بالمعرف الثابت ${loaded.record.id}.`,
            }
      );
    } finally {
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    }
  };

  const handleRequestDeleteArchivedPeerVisit = (
    record: TeacherPeerVisitArchiveRecord
  ) => {
    const impact = inspectArchivedPeerVisitDeletionImpact(record.id);
    setPendingPeerDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedPeerVisit = async () => {
    if (!pendingPeerDeleteTarget) return;
    const { record } = pendingPeerDeleteTarget;
    const wasOpenInEditor = activeArchivedRecordId === record.id;
    const outcome = await deleteArchivedPeerVisitRecordSafely(record.id, {
      confirmUnlink: true,
    });
    setPendingPeerDeleteTarget(null);
    refreshSavedPeerVisits();
    if (wasOpenInEditor) {
      setActiveArchivedRecordId(null);
    }
    if (outcome.result.deleted) {
      const unlinkedNote =
        outcome.result.unlinkedElementIds.length > 0
          ? ` وتم فك الارتباط في ${outcome.result.unlinkedElementIds.length} عنصر أداء مع تسجيل التدقيق.`
          : '';
      const sharedNote =
        outcome.result.preservedSharedBlobKeys.length > 0
          ? ' مع الإبقاء على المرفقات المشتركة في السجلات الأخرى.'
          : '';
      setStatusBanner({
        type: 'success',
        text: wasOpenInEditor
          ? `تم حذف سجل الزيارة «${record.title}» من الأرشيف نهائيًا${unlinkedNote}${sharedNote} وأصبح المحتوى الذي لا يزال ظاهرًا في المحرر مسودة مستقلة غير محفوظة في الأرشيف، وليس السجل المحذوف؛ يمكنك حفظه كزيارة جديدة أو الضغط على «إنشاء زيارة جديدة» لتفريغ المحرر.`
          : `تم حذف تقرير الزيارة «${record.title}» من الأرشيف بأمان${unlinkedNote}${sharedNote}`,
      });
    }
  };

  const handleExportPdf = async () => {
    const errors = validateMeetingOrVisitState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل تصدير ملف PDF.',
      });
      return;
    }

    setValidationErrors([]);
    setIsExporting(true);
    setStatusBanner(null);

    try {
      const pdfResult = await generateTeacherReportPdf(
        reportDocument,
        settings
      );
      const blob = new Blob([new Uint8Array(pdfResult.pdfBytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      setStatusBanner({
        type: 'success',
        text: `تم توليد وتصدير ملف PDF بنجاح (${pdfResult.pageCount} صفحات — ${pdfResult.filename}).`,
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'حدث خطأ أثناء توليد ملف PDF، يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // Handlers for Meeting Minutes (`meeting-minutes`)
  // ============================================================================
  const updateMeetingState = (
    updater: (prev: MeetingMinutesFormState) => MeetingMinutesFormState
  ) => {
    setFormState((prev) => {
      if (prev.formId !== 'meeting-minutes') return prev;
      return updater(prev);
    });
  };

  const handleAddAgendaItem = () => {
    updateMeetingState((prev) => ({
      ...prev,
      agendaItems: [
        ...prev.agendaItems,
        createInitialAgendaItem(prev.agendaItems.length + 1),
      ],
    }));
  };

  const handleUpdateAgendaItem = (
    id: string,
    patch: Partial<MeetingAgendaItem>
  ) => {
    updateMeetingState((prev) => ({
      ...prev,
      agendaItems: prev.agendaItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  };

  const handleRemoveAgendaItem = (id: string) => {
    updateMeetingState((prev) => {
      if (prev.agendaItems.length <= 1) return prev;
      return {
        ...prev,
        agendaItems: prev.agendaItems.filter((item) => item.id !== id),
      };
    });
  };

  const handleAddDecisionItem = () => {
    updateMeetingState((prev) => ({
      ...prev,
      decisions: [
        ...prev.decisions,
        createInitialDecisionItem(prev.decisions.length + 1),
      ],
    }));
  };

  const handleUpdateDecisionItem = (
    id: string,
    patch: Partial<MeetingDecisionItem>
  ) => {
    updateMeetingState((prev) => ({
      ...prev,
      decisions: prev.decisions.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  };

  const handleRemoveDecisionItem = (id: string) => {
    updateMeetingState((prev) => {
      if (prev.decisions.length <= 1) return prev;
      return {
        ...prev,
        decisions: prev.decisions.filter((item) => item.id !== id),
      };
    });
  };

  const handleAddAttendeeItem = () => {
    updateMeetingState((prev) => {
      if (prev.attendees.length >= MAX_MEETING_ATTENDEES) return prev;
      return {
        ...prev,
        attendees: [
          ...prev.attendees,
          createInitialAttendeeItem(prev.attendees.length + 1),
        ],
      };
    });
  };

  const handleUpdateAttendeeName = (id: string, attendeeName: string) => {
    updateMeetingState((prev) => ({
      ...prev,
      attendees: prev.attendees.map((item) =>
        item.id === id ? { ...item, attendeeName } : item
      ),
    }));
  };

  const handleRemoveAttendeeItem = (id: string) => {
    updateMeetingState((prev) => {
      if (prev.attendees.length <= 1) return prev;
      return {
        ...prev,
        attendees: prev.attendees.filter((item) => item.id !== id),
      };
    });
  };

  const handleApplyBulkPastedNames = (
    rawText: string,
    mode: 'replace' | 'append' = 'replace'
  ) => {
    const parsedNames = parseBulkAttendeeNames(rawText, MAX_MEETING_ATTENDEES);
    if (parsedNames.length === 0) return;

    updateMeetingState((prev) => {
      const existingNonEmpty =
        mode === 'append'
          ? prev.attendees.filter((a) => Boolean(a.attendeeName.trim()))
          : [];
      const combinedNames = [
        ...existingNonEmpty.map((a) => a.attendeeName.trim()),
        ...parsedNames,
      ].slice(0, MAX_MEETING_ATTENDEES);

      return {
        ...prev,
        enableAttendanceSheet: true,
        attendees: combinedNames.map((name, idx) =>
          createInitialAttendeeItem(idx + 1, name)
        ),
      };
    });

    setBulkNamesInput('');
    setShowBulkPasteBox(false);
    setStatusBanner({
      type: 'info',
      text: `تم إدراج الأسماء في جدول كشف الحضور بنجاح (${parsedNames.length} أسماء).`,
    });
  };

  const handlePasteOnSingleAttendeeInput = (
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    const clipText = e.clipboardData?.getData('text') || '';
    if (!clipText.includes('\n') && !clipText.includes('\r')) {
      return; // Normal single-line paste
    }
    const parsedNames = parseBulkAttendeeNames(clipText, MAX_MEETING_ATTENDEES);
    if (parsedNames.length <= 1) {
      return;
    }

    e.preventDefault();
    updateMeetingState((prev) => {
      const before = prev.attendees
        .slice(0, index)
        .filter((a) => Boolean(a.attendeeName.trim()));
      const after = prev.attendees
        .slice(index + 1)
        .filter((a) => Boolean(a.attendeeName.trim()));

      const combinedNames = [
        ...before.map((a) => a.attendeeName.trim()),
        ...parsedNames,
        ...after.map((a) => a.attendeeName.trim()),
      ].slice(0, MAX_MEETING_ATTENDEES);

      return {
        ...prev,
        attendees: combinedNames.map((name, idx) =>
          createInitialAttendeeItem(idx + 1, name)
        ),
      };
    });
  };

  // ============================================================================
  // ============================================================================
  // Handlers for Peer Visit Report (`peer-visit-report`) & Shared Evidence/Links
  // ============================================================================
  const updatePeerVisitState = (
    updater: (prev: PeerVisitReportFormState) => PeerVisitReportFormState
  ) => {
    setFormState((prev) => {
      if (prev.formId !== 'peer-visit-report') return prev;
      return updater(prev);
    });
  };

  const handleUploadNewPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const currentPhotos = formState.evidencePhotos || [];
      const remainingSlots = Math.max(0, 2 - currentPhotos.length);
      const filesToRead = files.slice(0, Math.max(1, remainingSlots));

      const repo = getDefaultTeacherMediaRepository();
      const savedResults = await Promise.all(
        filesToRead.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const mimeType = file.type || 'image/png';
          const saved = await saveMediaBytes(
            {
              bytes,
              fileName:
                file.name ||
                (formState.formId === 'meeting-minutes'
                  ? 'meeting-evidence-image'
                  : 'peer-visit-evidence-image'),
              mimeType,
              sourceTag: 'upload',
            },
            repo
          );
          return {
            dataUrl: bytesToDataUrl(bytes, mimeType),
            deduplicated: saved.deduplicated,
          };
        })
      );

      const nextPhotos: TeacherReportEvidencePhoto[] = [
        ...currentPhotos,
        ...savedResults.map((item, idx) => ({
          id: `${formState.formId}-photo-${Date.now()}-${idx + 1}`,
          imageDataUrl: item.dataUrl,
        })),
      ].slice(0, 2);

      setFormState((prev) => ({
        ...prev,
        evidencePhotos: nextPhotos,
      }));

      const anyDeduplicated = savedResults.some((r) => r.deduplicated);
      setMediaNotice(
        anyDeduplicated
          ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
          : 'تم حفظ المرفق الثنائي والتحقق من بصمته (SHA-256 / CRC-32) في IndexedDB.'
      );
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleReplacePhotoAt = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const repo = getDefaultTeacherMediaRepository();
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const mimeType = file.type || 'image/png';
      const saved = await saveMediaBytes(
        {
          bytes,
          fileName:
            file.name ||
            (formState.formId === 'meeting-minutes'
              ? 'meeting-evidence-image'
              : 'peer-visit-evidence-image'),
          mimeType,
          sourceTag: 'upload',
        },
        repo
      );
      const dataUrl = bytesToDataUrl(bytes, mimeType);
      setFormState((prev) => ({
        ...prev,
        evidencePhotos: (prev.evidencePhotos || []).map((p, idx) =>
          idx === index
            ? {
                id: `${prev.formId}-photo-replaced-${Date.now()}-${index + 1}`,
                imageDataUrl: dataUrl,
              }
            : p
        ),
      }));
      setMediaNotice(
        saved.deduplicated
          ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
          : 'تم تحديث المرفق وحفظه في مستودع المرفقات مع بصمة SHA-256.'
      );
    } catch {
      // Ignore invalid image read
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhotoAt = (index: number) => {
    setMediaNotice(null);
    setFormState((prev) => ({
      ...prev,
      evidencePhotos: (prev.evidencePhotos || []).filter(
        (_, idx) => idx !== index
      ),
    }));
  };

  const handleLoadSamplePhotos = async () => {
    const samples = createDefaultSampleEvidencePhotos(colorSystem);
    const chosen = [samples[0], samples[1]];
    setFormState((prev) => ({
      ...prev,
      evidencePhotos: chosen,
    }));
    const repo = getDefaultTeacherMediaRepository();
    const prefix =
      formState.formId === 'meeting-minutes' ? 'meeting' : 'peer-visit';
    await Promise.all(
      chosen.map((p, idx) =>
        saveMediaDataUrl(
          {
            id: p.id,
            dataUrl: p.imageDataUrl,
            fileName: `${prefix}-sample-evidence-${idx + 1}.svg`,
            sourceTag: 'sample',
          },
          repo
        )
      )
    );
    setMediaNotice('تم حفظ الصور التجريبية في مستودع المرفقات الموحد.');
  };

  const handleAddLink = () => {
    setFormState((prev) => {
      const currentLinks = prev.evidenceLinks || [];
      if (currentLinks.length >= 2) return prev;
      const nextLink: TeacherReportEvidenceLink = {
        id: `${prev.formId}-link-${Date.now()}-${currentLinks.length + 1}`,
        url: '',
      };
      return {
        ...prev,
        evidenceLinks: [...currentLinks, nextLink],
      };
    });
  };

  const handleUpdateLinkUrl = (index: number, url: string) => {
    setFormState((prev) => ({
      ...prev,
      evidenceLinks: (prev.evidenceLinks || []).map((item, idx) =>
        idx === index ? { ...item, url } : item
      ),
    }));
  };

  const handleDeleteLinkAt = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      evidenceLinks: (prev.evidenceLinks || []).filter(
        (_, idx) => idx !== index
      ),
    }));
  };

  const handleLoadSampleLinks = () => {
    const prefix = formState.formId === 'meeting-minutes' ? 'mm' : 'pv';
    setFormState((prev) => ({
      ...prev,
      evidenceLinks: [
        {
          id: `${prefix}-sample-link-1`,
          url: 'https://moe.gov.sa/ar/education/Pages/default.aspx',
        },
        {
          id: `${prefix}-sample-link-2`,
          url: 'https://ien.edu.sa/',
        },
      ],
    }));
  };

  return (
    <div
      data-testid={`teacher-meeting-visit-form-${formId}`}
      className="space-y-6"
    >
      {/* Top Navigation & Template/Color Bar */}
      <div className="bg-white rounded-2xl border border-[#E2E5E6] p-5 sm:p-6 space-y-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-group-btn"
              onClick={onBackToGroup}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>العودة إلى {groupLabel}</span>
            </button>

            <button
              type="button"
              data-testid="back-to-teacher-hub-btn"
              onClick={onBackToTeacherHub}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-xs sm:text-sm font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>العودة لقسم المعلم</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMeetingArchiveEnabled && (
              <>
                <button
                  type="button"
                  data-testid="toggle-meetings-archive-btn"
                  onClick={() => setIsArchiveOpen((prev) => !prev)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isArchiveOpen
                      ? 'border-[#416B91] bg-[#376B70] text-white'
                      : 'border-[#E2E5E6] bg-white hover:bg-[#DCEAF5] text-[#416B91]'
                  }`}
                >
                  <Archive className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>الأرشيف المحفوظ ({savedRecords.length})</span>
                </button>

                <button
                  type="button"
                  data-testid="create-new-meeting-btn"
                  onClick={handleCreateNewMeeting}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>إنشاء محضر جديد</span>
                </button>

                <button
                  type="button"
                  data-testid="save-meeting-to-archive-btn"
                  disabled={isSavingArchive}
                  onClick={handleSaveMeetingToArchive}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isSavingArchive
                      ? 'جاري الحفظ...'
                      : activeArchivedRecordId
                        ? 'حفظ التعديلات في الأرشيف'
                        : 'حفظ في الأرشيف'}
                  </span>
                </button>
              </>
            )}

            {isPeerVisitArchiveEnabled && (
              <>
                <button
                  type="button"
                  data-testid="toggle-peer-visits-archive-btn"
                  onClick={() => setIsArchiveOpen((prev) => !prev)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isArchiveOpen
                      ? 'border-[#416B91] bg-[#376B70] text-white'
                      : 'border-[#E2E5E6] bg-white hover:bg-[#DCEAF5] text-[#416B91]'
                  }`}
                >
                  <Archive className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>الأرشيف المحفوظ ({savedPeerVisitRecords.length})</span>
                </button>

                <button
                  type="button"
                  data-testid="create-new-peer-visit-btn"
                  onClick={handleCreateNewPeerVisit}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>إنشاء زيارة جديدة</span>
                </button>

                <button
                  type="button"
                  data-testid="save-peer-visit-to-archive-btn"
                  disabled={isSavingArchive}
                  onClick={handleSavePeerVisitToArchive}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isSavingArchive
                      ? 'جاري الحفظ...'
                      : activeArchivedRecordId
                        ? 'حفظ التعديلات في الأرشيف'
                        : 'حفظ في الأرشيف'}
                  </span>
                </button>
              </>
            )}

            <button
              type="button"
              data-testid="load-sample-meeting-visit-btn"
              onClick={handleLoadSampleData}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#DCEAF5] hover:bg-[#CCE0F0] border border-[#E2E5E6] text-[#416B91] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تعبئة بيانات تجريبية</span>
            </button>

            <button
              type="button"
              data-testid="reset-meeting-visit-btn"
              onClick={handleResetForm}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إعادة ضبط</span>
            </button>
          </div>
        </div>

        {/* Active Meeting Record Context Bar (Group 3: Meeting Minutes ONLY) */}
        {isMeetingArchiveEnabled && (
          <div
            data-testid="meeting-record-state-bar"
            className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
              <span>حالة المحضر الحالي:</span>
              {activeArchivedRecordId ? (
                <span
                  data-testid="meeting-active-record-status-text"
                  className="text-[#2F6846]"
                >
                  سجل محفوظ في الأرشيف (المعرف الثابت: {activeArchivedRecordId})
                </span>
              ) : (
                <span
                  data-testid="meeting-active-record-status-text"
                  className="text-[#416B91]"
                >
                  مسودة قيد التحرير (لا تُحتسب شاهدًا إلا بعد الحفظ والربط لاحقًا)
                </span>
              )}
            </div>
            {savedRecords.length > 0 && !isArchiveOpen && (
              <button
                type="button"
                onClick={() => setIsArchiveOpen(true)}
                className="text-xs font-bold text-[#416B91] hover:underline cursor-pointer"
              >
                استعراض {savedRecords.length} سجل محفوظ
              </button>
            )}
          </div>
        )}

        {/* Multi-Record Archive Panel (Group 3: Meeting Minutes ONLY) */}
        {isMeetingArchiveEnabled && isArchiveOpen && (
          <div
            data-testid="meetings-archive-panel"
            className="rounded-2xl border border-[#E2E5E6] bg-[#FBFBF9] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات الأرشيف المحفوظة — محاضر الاجتماعات
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  يحتفظ كل محضر اجتماع محفوظ بمعرف ثابت مستقل، ويمكن فتحه وتعديله أو حذفه بأمان دون التأثير على المسودات أو بقية السجلات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="min-h-[34px] px-3 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 cursor-pointer"
              >
                إغلاق الأرشيف
              </button>
            </div>

            {pendingDeleteTarget && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-delete-meeting-archive-heading"
                data-testid="delete-meeting-archive-confirm-panel"
                className={`rounded-xl border p-4 space-y-3 ${
                  pendingDeleteTarget.impact.isLinked
                    ? 'border-red-300 bg-red-50 text-red-950'
                    : 'border-[#E8C9BA] bg-[#FDF2ED] text-[#9A4A2E]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-5 h-5 shrink-0 mt-0.5 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div
                      id="confirm-delete-meeting-archive-heading"
                      className="font-extrabold"
                    >
                      تأكيد حذف السجل «{pendingDeleteTarget.record.title}»
                    </div>
                    <p className="leading-relaxed">
                      {pendingDeleteTarget.impact.warningMessage ||
                        'سيؤدي هذا الإجراء إلى حذف محضر الاجتماع المحفوظ من الأرشيف وإزالة المرفقات غير المستخدمة في أي سجل آخر.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    data-testid="cancel-delete-meeting-archive-record-btn"
                    onClick={() => setPendingDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-meeting-archive-record-btn"
                    onClick={handleConfirmDeleteArchivedMeeting}
                    className="min-h-[36px] px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {pendingDeleteTarget.impact.isLinked
                      ? 'تأكيد الحذف وفك الارتباط'
                      : 'تأكيد الحذف'}
                  </button>
                </div>
              </div>
            )}

            {savedRecords.length === 0 ? (
              <div
                data-testid="meetings-archive-empty"
                className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs sm:text-sm text-stone-600"
              >
                لا توجد محاضر اجتماعات محفوظة في الأرشيف حتى الآن. استكمل البيانات واضغط «حفظ في الأرشيف» لحفظ السجل بمعرف مستقل.
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedRecords.map((rec) => {
                  const isCurrent = activeArchivedRecordId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      data-testid={`meeting-archive-record-item-${rec.id}`}
                      className={`rounded-xl border bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                        isCurrent
                          ? 'border-[#416B91] ring-1 ring-[#416B91]/20'
                          : 'border-stone-200'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-extrabold text-sm text-stone-900 truncate">
                          {rec.title}
                        </div>
                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {rec.summary && <span>{rec.summary}</span>}
                          <span className="tabular-nums text-stone-500">
                            المعرف: {rec.id}
                          </span>
                          <span className="tabular-nums text-stone-500">
                            المرفقات: {rec.mediaRefs.length}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          data-testid={`open-meeting-archive-record-${rec.id}`}
                          onClick={() => handleOpenArchivedMeeting(rec)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#294660] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-meeting-archive-record-${rec.id}`}
                          aria-label={`حذف السجل ${rec.title}`}
                          onClick={() => handleRequestDeleteArchivedMeeting(rec)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active Peer Visit Record Context Bar (Group 4: Peer Visit Report ONLY) */}
        {isPeerVisitArchiveEnabled && (
          <div
            data-testid="peer-visit-record-state-bar"
            className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
              <span>حالة تقرير الزيارة الحالي:</span>
              {activeArchivedRecordId ? (
                <span
                  data-testid="peer-visit-active-record-status-text"
                  className="text-[#2F6846]"
                >
                  سجل محفوظ في الأرشيف (المعرف الثابت: {activeArchivedRecordId})
                </span>
              ) : (
                <span
                  data-testid="peer-visit-active-record-status-text"
                  className="text-[#416B91]"
                >
                  مسودة قيد التحرير (لا تُحتسب شاهدًا إلا بعد الحفظ والربط لاحقًا)
                </span>
              )}
            </div>
            {savedPeerVisitRecords.length > 0 && !isArchiveOpen && (
              <button
                type="button"
                onClick={() => setIsArchiveOpen(true)}
                className="text-xs font-bold text-[#416B91] hover:underline cursor-pointer"
              >
                استعراض {savedPeerVisitRecords.length} سجل محفوظ
              </button>
            )}
          </div>
        )}

        {/* Multi-Record Archive Panel (Group 4: Peer Visit Report ONLY) */}
        {isPeerVisitArchiveEnabled && isArchiveOpen && (
          <div
            data-testid="peer-visits-archive-panel"
            className="rounded-2xl border border-[#E2E5E6] bg-[#FBFBF9] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات الأرشيف المحفوظة — تقارير الزيارات التبادلية
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  يحتفظ كل تقرير زيارة تبادلية محفوظ بمعرف ثابت مستقل، ويمكن فتحه وتعديله أو حذفه بأمان دون التأثير على المسودات أو بقية السجلات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="min-h-[34px] px-3 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 cursor-pointer"
              >
                إغلاق الأرشيف
              </button>
            </div>

            {pendingPeerDeleteTarget && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-delete-peer-visit-archive-heading"
                data-testid="delete-peer-visit-archive-confirm-panel"
                className={`rounded-xl border p-4 space-y-3 ${
                  pendingPeerDeleteTarget.impact.isLinked
                    ? 'border-red-300 bg-red-50 text-red-950'
                    : 'border-[#E8C9BA] bg-[#FDF2ED] text-[#9A4A2E]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-5 h-5 shrink-0 mt-0.5 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div
                      id="confirm-delete-peer-visit-archive-heading"
                      className="font-extrabold"
                    >
                      تأكيد حذف السجل «{pendingPeerDeleteTarget.record.title}»
                    </div>
                    <p className="leading-relaxed">
                      {pendingPeerDeleteTarget.impact.warningMessage ||
                        'سيؤدي هذا الإجراء إلى حذف تقرير الزيارة التبادلية المحفوظ من الأرشيف وإزالة المرفقات غير المستخدمة في أي سجل آخر.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    data-testid="cancel-delete-peer-visit-archive-record-btn"
                    onClick={() => setPendingPeerDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-peer-visit-archive-record-btn"
                    onClick={handleConfirmDeleteArchivedPeerVisit}
                    className="min-h-[36px] px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {pendingPeerDeleteTarget.impact.isLinked
                      ? 'تأكيد الحذف وفك الارتباط'
                      : 'تأكيد الحذف'}
                  </button>
                </div>
              </div>
            )}

            {savedPeerVisitRecords.length === 0 ? (
              <div
                data-testid="peer-visits-archive-empty"
                className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs sm:text-sm text-stone-600"
              >
                لا توجد تقارير زيارات تبادلية محفوظة في الأرشيف حتى الآن. استكمل البيانات واضغط «حفظ في الأرشيف» لحفظ السجل بمعرف مستقل.
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedPeerVisitRecords.map((rec) => {
                  const isCurrent = activeArchivedRecordId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      data-testid={`peer-visit-archive-record-item-${rec.id}`}
                      className={`rounded-xl border bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                        isCurrent
                          ? 'border-[#416B91] ring-1 ring-[#416B91]/20'
                          : 'border-stone-200'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-extrabold text-sm text-stone-900 truncate">
                          {rec.title}
                        </div>
                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {rec.summary && <span>{rec.summary}</span>}
                          <span className="tabular-nums text-stone-500">
                            المعرف: {rec.id}
                          </span>
                          <span className="tabular-nums text-stone-500">
                            المرفقات: {rec.mediaRefs.length}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          data-testid={`open-peer-visit-archive-record-${rec.id}`}
                          onClick={() => handleOpenArchivedPeerVisit(rec)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-xs font-bold text-[#294660] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-peer-visit-archive-record-${rec.id}`}
                          aria-label={`حذف السجل ${rec.title}`}
                          onClick={() => handleRequestDeleteArchivedPeerVisit(rec)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Form Title & Description */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCEAF5] border border-[#E2E5E6] text-[#416B91] text-xs font-bold">
              {formId === 'meeting-minutes' ? (
                <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>قسم المعلم · {groupLabel}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
              {catalogMeta.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 max-w-3xl leading-relaxed">
              {catalogMeta.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="toggle-preview-tab-btn"
              onClick={() =>
                setActiveTab((prev) => (prev === 'edit' ? 'preview' : 'edit'))
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-[#416B91] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>
                {activeTab === 'edit'
                  ? `معاينة صفحات PDF (${paginatedPages.length})`
                  : 'العودة لتعديل الحقول'}
              </span>
            </button>

            <button
              type="button"
              data-testid="export-meeting-visit-pdf-btn"
              disabled={isExporting}
              onClick={handleExportPdf}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              <span>
                {isExporting ? 'جاري التصدير...' : 'تصدير التقرير PDF'}
              </span>
            </button>
          </div>
        </div>

        {/* Template & Color Quick Selector */}
        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#416B91]" />
              <span>قالب PDF:</span>
            </span>
            {ALL_TEMPLATES.map((tpl) => {
              const def = TEACHER_TEMPLATE_DEFINITIONS[tpl];
              const isSelected = templateStyle === tpl;
              return (
                <button
                  key={tpl}
                  type="button"
                  data-testid={`select-template-${tpl}`}
                  onClick={() =>
                    updateSettings({ ...settings, teacherPdfTemplate: tpl })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#376B70] text-white border-[#416B91]'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {def.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-stone-700">
              النظام اللوني:
            </span>
            {ALL_COLOR_SYSTEMS.map((col) => {
              const pal = TEACHER_COLOR_PALETTES[col];
              const isSelected = colorSystem === col;
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`select-color-${col}`}
                  onClick={() =>
                    updateSettings({ ...settings, teacherPdfColorSystem: col })
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: pal.primaryHex }}
                  />
                  <span>{pal.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status & Validation Banners */}
      {statusBanner && (
        <div
          data-testid="meeting-visit-status-banner"
          className={`rounded-2xl p-4 border text-xs sm:text-sm font-bold flex items-center gap-2.5 ${
            statusBanner.type === 'success'
              ? 'bg-[#EEF5EE] border-[#C5DCC7] text-[#2F6846]'
              : statusBanner.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-[#DCEAF5] border-[#E2E5E6] text-[#416B91]'
          }`}
        >
          {statusBanner.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div
          data-testid="meeting-visit-validation-errors"
          className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2"
        >
          <div className="text-xs sm:text-sm font-extrabold text-red-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>يرجى مراجعة الحقول التالية قبل التصدير:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content Layout: Form Fields + Live A4 Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Form Editor Column */}
        <div
          className={`xl:col-span-7 space-y-6 ${
            activeTab === 'preview' ? 'hidden xl:block' : ''
          }`}
        >
          {formState.formId === 'meeting-minutes' ? (
            /* ================================================================
               النموذج الأول: محضر اجتماع
               ================================================================ */
            <>
              {/* 1. بيانات الاجتماع */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ١. بيانات الاجتماع الأساسية
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    حدّد عنوان الاجتماع ونوعه وتاريخه ووقته ومكان انعقاده
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="mm-title-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      عنوان الاجتماع <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="mm-title-input"
                      data-testid="mm-title-input"
                      type="text"
                      value={formState.meetingTitle}
                      onChange={(e) =>
                        updateMeetingState((prev) => ({
                          ...prev,
                          meetingTitle: e.target.value,
                        }))
                      }
                      placeholder="مثال: الاجتماع الدوري لمعلمي التخصص للفصل الدراسي الثاني"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="mm-type-select"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        نوع الاجتماع <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="mm-type-select"
                        data-testid="mm-type-select"
                        value={formState.meetingType}
                        onChange={(e) =>
                          updateMeetingState((prev) => ({
                            ...prev,
                            meetingType: e.target.value as MeetingTypeOption,
                          }))
                        }
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      >
                        {MEETING_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formState.meetingType === 'نوع آخر' && (
                      <div>
                        <label
                          htmlFor="mm-custom-type-input"
                          className="block text-xs font-bold text-stone-800 mb-1.5"
                        >
                          تحديد نوع الاجتماع المخصص{' '}
                          <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="mm-custom-type-input"
                          data-testid="mm-custom-type-input"
                          type="text"
                          value={formState.customMeetingType}
                          onChange={(e) =>
                            updateMeetingState((prev) => ({
                              ...prev,
                              customMeetingType: e.target.value,
                            }))
                          }
                          placeholder="اكتب نوع الاجتماع..."
                          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="mm-date-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        تاريخ الاجتماع <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="mm-date-input"
                        data-testid="mm-date-input"
                        type="text"
                        value={formState.meetingDate}
                        onChange={(e) =>
                          updateMeetingState((prev) => ({
                            ...prev,
                            meetingDate: e.target.value,
                          }))
                        }
                        placeholder="١٤٤٧/٠٨/٢٢هـ"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="mm-time-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        وقت الاجتماع <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="mm-time-input"
                        data-testid="mm-time-input"
                        type="text"
                        value={formState.meetingTime}
                        onChange={(e) =>
                          updateMeetingState((prev) => ({
                            ...prev,
                            meetingTime: e.target.value,
                          }))
                        }
                        placeholder="٠٩:٣٠ صباحاً"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="mm-location-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        مكان الاجتماع <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="mm-location-input"
                        data-testid="mm-location-input"
                        type="text"
                        value={formState.meetingLocation}
                        onChange={(e) =>
                          updateMeetingState((prev) => ({
                            ...prev,
                            meetingLocation: e.target.value,
                          }))
                        }
                        placeholder="قاعة الاجتماعات بالمدرسة"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. صفة المنفذ */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900">
                      ٢. صفة المنفذ أو المنظم
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      اختر الصفة ليظهر المسمى تلقائيًا في التقرير بصيغة «
                      {resolveMeetingExecutorLabel(
                        formState.executorRoleType,
                        formState.customExecutorRole
                      )}
                      : {formState.executorName.trim() || '[الاسم]'}»
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MEETING_EXECUTOR_ROLE_OPTIONS.map((roleOpt) => {
                    const isSelected = formState.executorRoleType === roleOpt;
                    return (
                      <button
                        key={roleOpt}
                        type="button"
                        data-testid={`mm-executor-role-${roleOpt}`}
                        onClick={() =>
                          updateMeetingState((prev) => ({
                            ...prev,
                            executorRoleType:
                              roleOpt as MeetingExecutorRoleType,
                          }))
                        }
                        className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#376B70] text-white border-[#416B91]'
                            : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {roleOpt}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formState.executorRoleType === 'صفة أخرى' && (
                    <div>
                      <label
                        htmlFor="mm-custom-executor-role-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        المسمى المخصص لصفة المنفذ{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="mm-custom-executor-role-input"
                        data-testid="mm-custom-executor-role-input"
                        type="text"
                        value={formState.customExecutorRole}
                        onChange={(e) =>
                          updateMeetingState((prev) => ({
                            ...prev,
                            customExecutorRole: e.target.value,
                          }))
                        }
                        placeholder="مثال: رئيس اللجنة / منسق القسم"
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  )}

                  <div
                    className={
                      formState.executorRoleType === 'صفة أخرى'
                        ? ''
                        : 'sm:col-span-2'
                    }
                  >
                    <label
                      htmlFor="mm-executor-name-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      {resolveMeetingExecutorLabel(
                        formState.executorRoleType,
                        formState.customExecutorRole
                      )}{' '}
                      (الاسم) <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="mm-executor-name-input"
                      data-testid="mm-executor-name-input"
                      type="text"
                      value={formState.executorName}
                      onChange={(e) =>
                        updateMeetingState((prev) => ({
                          ...prev,
                          executorName: e.target.value,
                        }))
                      }
                      placeholder="الاسم الثلاثي..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>
                </div>
              </section>

              {/* 3. محاور الاجتماع */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900">
                      ٣. محاور الاجتماع وموجز المناقشات
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      يمكنك إضافة أكثر من محور وتخصيص مساحة مناقشة مستقلة لكل
                      محور
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="mm-add-agenda-btn"
                    onClick={handleAddAgendaItem}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#DCEAF5] hover:bg-[#CCE0F0] border border-[#E2E5E6] text-[#416B91] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>إضافة محور جديد</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formState.agendaItems.map((item, idx) => (
                    <div
                      key={item.id}
                      data-testid={`mm-agenda-card-${idx + 1}`}
                      className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#416B91] bg-[#DCEAF5] px-2.5 py-1 rounded-lg border border-[#E2E5E6]">
                          المحور ({idx + 1})
                        </span>

                        {formState.agendaItems.length > 1 && (
                          <button
                            type="button"
                            data-testid={`mm-remove-agenda-btn-${idx + 1}`}
                            onClick={() => handleRemoveAgendaItem(item.id)}
                            className="min-h-[30px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف المحور</span>
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-800 mb-1.5">
                          اختيار عنوان المحور{' '}
                          <span className="text-red-600">*</span>
                        </label>
                        <select
                          data-testid={`mm-agenda-preset-select-${idx + 1}`}
                          value={item.selectedPreset}
                          onChange={(e) =>
                            handleUpdateAgendaItem(item.id, {
                              selectedPreset: e.target.value,
                            })
                          }
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                        >
                          {MEETING_AGENDA_PRESETS.map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                        </select>
                      </div>

                      {item.selectedPreset === '+ إضافة بند' && (
                        <div>
                          <label className="block text-xs font-bold text-stone-800 mb-1.5">
                            عنوان المحور المخصص{' '}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            data-testid={`mm-agenda-custom-title-${idx + 1}`}
                            value={item.customTitle}
                            onChange={(e) =>
                              handleUpdateAgendaItem(item.id, {
                                customTitle: e.target.value,
                              })
                            }
                            placeholder="اكتب عنوان المحور..."
                            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-stone-800 mb-1.5">
                          موجز مناقشة المحور ({idx + 1}){' '}
                          <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          rows={2}
                          data-testid={`mm-agenda-discussion-${idx + 1}`}
                          value={item.discussion}
                          onChange={(e) =>
                            handleUpdateAgendaItem(item.id, {
                              discussion: e.target.value,
                            })
                          }
                          placeholder="اكتب ما تم طرحه ومناقشته في هذا المحور باختصار..."
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. القرارات والتوصيات */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900">
                      ٤. القرارات والتوصيات الختامية
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      قسم ختامي موحد يجمع القرارات والتوصيات مع إمكانية تحديد
                      المسؤول وموعد التنفيذ عند الحاجة
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="mm-add-decision-btn"
                    onClick={handleAddDecisionItem}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#DCEAF5] hover:bg-[#CCE0F0] border border-[#E2E5E6] text-[#416B91] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>إضافة قرار أو توصية</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {formState.decisions.map((item, idx) => (
                    <div
                      key={item.id}
                      data-testid={`mm-decision-card-${idx + 1}`}
                      className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[#2F6846] bg-[#EEF5EE] px-2.5 py-1 rounded-lg border border-[#C5DCC7]">
                          القرار / التوصية ({idx + 1})
                        </span>

                        {formState.decisions.length > 1 && (
                          <button
                            type="button"
                            data-testid={`mm-remove-decision-btn-${idx + 1}`}
                            onClick={() => handleRemoveDecisionItem(item.id)}
                            className="min-h-[30px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-800 mb-1.5">
                          نص القرار أو التوصية{' '}
                          <span className="text-red-600">*</span>
                        </label>
                        <select
                          data-testid={`mm-decision-preset-select-${idx + 1}`}
                          value={item.selectedPreset}
                          onChange={(e) =>
                            handleUpdateDecisionItem(item.id, {
                              selectedPreset: e.target.value,
                            })
                          }
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                        >
                          {MEETING_DECISION_PRESETS.map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                        </select>
                      </div>

                      {item.selectedPreset === '+ إضافة بند' && (
                        <div>
                          <label className="block text-xs font-bold text-stone-800 mb-1.5">
                            كتابة نص القرار أو التوصية المخصصة{' '}
                            <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            data-testid={`mm-decision-custom-text-${idx + 1}`}
                            value={item.customDecisionText}
                            onChange={(e) =>
                              handleUpdateDecisionItem(item.id, {
                                customDecisionText: e.target.value,
                              })
                            }
                            placeholder="اكتب نص القرار أو التوصية..."
                            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1">
                            المسؤول عن المتابعة أو التنفيذ (اختياري)
                          </label>
                          <input
                            type="text"
                            data-testid={`mm-decision-responsible-${idx + 1}`}
                            value={item.responsiblePerson}
                            onChange={(e) =>
                              handleUpdateDecisionItem(item.id, {
                                responsiblePerson: e.target.value,
                              })
                            }
                            placeholder="مثال: معلمو القسم / منسق التخصص"
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#416B91]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1">
                            موعد التنفيذ (اختياري)
                          </label>
                          <input
                            type="text"
                            data-testid={`mm-decision-deadline-${idx + 1}`}
                            value={item.executionDeadline}
                            onChange={(e) =>
                              handleUpdateDecisionItem(item.id, {
                                executionDeadline: e.target.value,
                              })
                            }
                            placeholder="مثال: خلال أسبوعين / نهاية الشهر"
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:border-[#416B91]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. بيانات ختامية */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٥. بيانات ختامية (اختيارية)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    في حال ترك الملاحظة الختامية أو اسم مُعدّ المحضر فارغًا لن
                    تظهر مساحته في ملف PDF
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="mm-closing-note-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      ملاحظة ختامية (اختياري)
                    </label>
                    <textarea
                      id="mm-closing-note-input"
                      data-testid="mm-closing-note-input"
                      rows={2}
                      value={formState.closingNote}
                      onChange={(e) =>
                        updateMeetingState((prev) => ({
                          ...prev,
                          closingNote: e.target.value,
                        }))
                      }
                      placeholder="اتركه فارغاً إذا لم تكن هناك ملاحظة ختامية..."
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="mm-recorder-name-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      اسم مُعدّ المحضر (حقل مستقل اختياري)
                    </label>
                    <input
                      id="mm-recorder-name-input"
                      data-testid="mm-recorder-name-input"
                      type="text"
                      value={formState.recorderName}
                      onChange={(e) =>
                        updateMeetingState((prev) => ({
                          ...prev,
                          recorderName: e.target.value,
                        }))
                      }
                      placeholder="اكتب اسم مُعدّ المحضر عند الرغبة في إظهاره..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>
                </div>
              </section>

              {/* 6. الشواهد (0..2 صور اختيارية) */}
              <section
                data-testid="mm-photos-section"
                className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                      <Camera
                        className="w-4 h-4 text-[#416B91]"
                        aria-hidden="true"
                      />
                      <span>٦. الشواهد (اختياري — بحد أقصى صورتان)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      يدعم رفع الصور من الجهاز مع المعاينة والاستبدال والحذف؛
                      وإذا لم ترفق أي شاهد فلا يظهر القسم أو أي إطار فارغ في PDF
                    </p>
                  </div>

                  <span
                    data-testid="mm-photos-count"
                    className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
                  >
                    {(formState.evidencePhotos || []).length} / 2
                  </span>
                </div>

                <input
                  ref={addPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  data-testid="mm-upload-photo-input"
                  onChange={handleUploadNewPhotos}
                  className="hidden"
                />

                {(formState.evidencePhotos || []).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(formState.evidencePhotos || []).map((photo, idx) => (
                      <div
                        key={photo.id}
                        data-testid={`mm-photo-card-${idx + 1}`}
                        className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="aspect-[16/10] w-full rounded-lg border border-stone-200 bg-white overflow-hidden flex items-center justify-center">
                          <img
                            src={photo.imageDataUrl}
                            alt={`معاينة صورة الشاهد ${idx + 1}`}
                            className="w-full h-full object-contain block"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-stone-700">
                            صورة الشاهد ({idx + 1})
                          </span>

                          <div className="flex items-center gap-1.5">
                            <input
                              ref={(el) => {
                                replacePhotoInputRefs.current[idx] = el;
                              }}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              data-testid={`mm-replace-photo-input-${idx + 1}`}
                              onChange={(e) => handleReplacePhotoAt(idx, e)}
                              className="hidden"
                            />
                            <button
                              type="button"
                              data-testid={`mm-replace-photo-btn-${idx + 1}`}
                              onClick={() =>
                                replacePhotoInputRefs.current[idx]?.click()
                              }
                              className="min-h-[30px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>استبدال</span>
                            </button>

                            <button
                              type="button"
                              data-testid={`mm-delete-photo-btn-${idx + 1}`}
                              onClick={() => handleDeletePhotoAt(idx)}
                              className="min-h-[30px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                    لم يتم إرفاق أي شاهد مصور حاليًا — لن يظهر قسم الشواهد أو أي
                    مساحة فارغة في ملف PDF.
                  </div>
                )}

                {mediaNotice && (
                  <div
                    role="status"
                    data-testid="mm-media-store-notice"
                    className="rounded-xl border border-[#C5DCC7] bg-[#EEF5EE] px-3.5 py-2 text-xs font-bold text-[#2F6846] flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{mediaNotice}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {(formState.evidencePhotos || []).length < 2 && (
                    <button
                      type="button"
                      data-testid="mm-add-photo-btn"
                      onClick={() => addPhotoInputRef.current?.click()}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>رفع صورة من الجهاز (JPG / PNG / WebP)</span>
                    </button>
                  )}

                  {(formState.evidencePhotos || []).length === 0 && (
                    <button
                      type="button"
                      data-testid="mm-load-sample-photos-btn"
                      onClick={handleLoadSamplePhotos}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>إدراج صورتين تجريبيتين للمعاينة</span>
                    </button>
                  )}
                </div>
              </section>

              {/* 7. الروابط والباركود (0..2 روابط اختيارية) */}
              <section
                data-testid="mm-links-section"
                className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                      <QrCode
                        className="w-4 h-4 text-[#416B91]"
                        aria-hidden="true"
                      />
                      <span>٧. الروابط والباركود (اختياري — بحد أقصى رابطان)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      يُنشئ رمز QR منفصلاً لكل رابط قابل للفتح بالنقر من ملف PDF
                      دون عرض الرابط الطويل كنص؛ وعند عدم إضافة روابط لا يظهر أي
                      إطار أو رمز QR
                    </p>
                  </div>

                  <span
                    data-testid="mm-links-count"
                    className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
                  >
                    {(formState.evidenceLinks || []).length} / 2
                  </span>
                </div>

                {(formState.evidenceLinks || []).length > 0 ? (
                  <div className="space-y-3">
                    {(formState.evidenceLinks || []).map((linkItem, idx) => {
                      const cleanUrl = linkItem.url.trim();
                      const qrPreviewUrl = cleanUrl
                        ? generateQrSvgDataUrl(cleanUrl, palette.secondaryHex)
                        : '';
                      return (
                        <div
                          key={linkItem.id}
                          data-testid={`mm-link-card-${idx + 1}`}
                          className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="w-full flex-1 space-y-1.5">
                            <label
                              htmlFor={`mm-link-input-${idx + 1}`}
                              className="block text-xs font-bold text-stone-800"
                            >
                              الرابط الإلكتروني ({idx + 1})
                            </label>
                            <input
                              id={`mm-link-input-${idx + 1}`}
                              data-testid={`mm-link-input-${idx + 1}`}
                              type="url"
                              dir="ltr"
                              value={linkItem.url}
                              onChange={(e) =>
                                handleUpdateLinkUrl(idx, e.target.value)
                              }
                              placeholder="https://example.com/file"
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                            />
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center">
                            {qrPreviewUrl && (
                              <div className="w-12 h-12 rounded-lg border border-stone-200 bg-white p-1 shrink-0 flex items-center justify-center">
                                <img
                                  src={qrPreviewUrl}
                                  alt={`معاينة باركود الرابط ${idx + 1}`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}

                            <button
                              type="button"
                              data-testid={`mm-delete-link-btn-${idx + 1}`}
                              onClick={() => handleDeleteLinkAt(idx)}
                              className="min-h-[34px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                    لم يتم إضافة أي رابط حاليًا — لن يظهر قسم الروابط أو أي رمز
                    QR في ملف PDF.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {(formState.evidenceLinks || []).length < 2 && (
                    <button
                      type="button"
                      data-testid="mm-add-link-btn"
                      onClick={handleAddLink}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>إضافة رابط إلكتروني (مع باركود QR مستقل)</span>
                    </button>
                  )}

                  {(formState.evidenceLinks || []).length === 0 && (
                    <button
                      type="button"
                      data-testid="mm-load-sample-links-btn"
                      onClick={handleLoadSampleLinks}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>إدراج رابطين تجريبيين للمعاينة</span>
                    </button>
                  )}
                </div>
              </section>

              {/* 8. كشف الحضور والتوقيعات (جدول من 3 أعمدة: م. | الاسم | التوقيع) */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900">
                      ٨. كشف الحضور والتوقيعات (اختياري — صفحة مستقلة)
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      يعرض جدولاً منظماً من ٣ أعمدة (م. | الاسم | التوقيع) في
                      صفحة مستقلة، مع بقاء اعتماد {gendered.principalTitle} في
                      أسفل الصفحة الأولى للمحضر
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none bg-[#DCEAF5] px-3.5 py-2 rounded-xl border border-[#E2E5E6]">
                    <input
                      type="checkbox"
                      data-testid="mm-enable-attendance-toggle"
                      checked={formState.enableAttendanceSheet}
                      onChange={(e) =>
                        updateMeetingState((prev) => ({
                          ...prev,
                          enableAttendanceSheet: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-[#416B91] rounded cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-[#416B91]">
                      إرفاق كشف الحضور والتوقيعات
                    </span>
                  </label>
                </div>

                {formState.enableAttendanceSheet ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        data-testid="mm-attendees-count-badge"
                        className="text-xs font-bold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 tabular-nums"
                      >
                        عدد الأسماء: {formState.attendees.length} /{' '}
                        {MAX_MEETING_ATTENDEES}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          data-testid="mm-toggle-bulk-paste-btn"
                          onClick={() => setShowBulkPasteBox((prev) => !prev)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-[#E2E5E6] bg-[#DCEAF5] hover:bg-[#CCE0F0] text-[#416B91] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ClipboardPaste className="w-3.5 h-3.5" />
                          <span>لصق قائمة أسماء دفعة واحدة</span>
                        </button>

                        {formState.attendees.length < MAX_MEETING_ATTENDEES && (
                          <button
                            type="button"
                            data-testid="mm-add-attendee-btn"
                            onClick={handleAddAttendeeItem}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة صف جديد</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bulk Paste Box */}
                    {showBulkPasteBox && (
                      <div
                        data-testid="mm-bulk-paste-container"
                        className="rounded-xl border border-[#E2E5E6] bg-[#DCEAF5]/60 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="mm-bulk-paste-textarea"
                            className="text-xs font-extrabold text-[#416B91]"
                          >
                            الصق قائمة الأسماء (اسم واحد في كل سطر — حتى ٣٠
                            اسماً):
                          </label>
                        </div>

                        <textarea
                          id="mm-bulk-paste-textarea"
                          data-testid="mm-bulk-paste-textarea"
                          rows={5}
                          value={bulkNamesInput}
                          onChange={(e) => setBulkNamesInput(e.target.value)}
                          placeholder={
                            'إبراهيم غرم الله الغامدي\nخالد بن سعد الدوسري\nفهد بن عبدالله الحربي'
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid="mm-apply-bulk-replace-btn"
                            onClick={() =>
                              handleApplyBulkPastedNames(
                                bulkNamesInput,
                                'replace'
                              )
                            }
                            className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-bold cursor-pointer"
                          >
                            اعتماد الأسماء واستبدال القائمة الحالية
                          </button>

                          <button
                            type="button"
                            data-testid="mm-apply-bulk-append-btn"
                            onClick={() =>
                              handleApplyBulkPastedNames(
                                bulkNamesInput,
                                'append'
                              )
                            }
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold cursor-pointer"
                          >
                            إضافة إلى الأسماء الحالية
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 3-Column RTL Table Preview & Editor (م. | الاسم | التوقيع) */}
                    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                      <table
                        data-testid="mm-attendance-editor-table"
                        className="w-full border-collapse text-right"
                      >
                        <thead>
                          <tr className="bg-stone-100 border-b border-stone-200 text-xs font-extrabold text-stone-800">
                            <th className="w-14 py-2.5 px-3 text-center border-l border-stone-200">
                              م.
                            </th>
                            <th className="py-2.5 px-3.5 border-l border-stone-200">
                              الاسم
                            </th>
                            <th className="w-36 py-2.5 px-3 text-center">
                              التوقيع
                            </th>
                            <th className="w-16 py-2.5 px-2 text-center">
                              إجراء
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 text-xs sm:text-sm">
                          {formState.attendees.map((att, idx) => (
                            <tr
                              key={att.id}
                              data-testid={`mm-attendee-row-${idx + 1}`}
                              className="hover:bg-stone-50/70"
                            >
                              <td className="py-2 px-3 text-center font-bold text-stone-700 border-l border-stone-200 tabular-nums">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3 border-l border-stone-200">
                                <input
                                  type="text"
                                  data-testid={`mm-attendee-name-${idx + 1}`}
                                  value={att.attendeeName}
                                  onChange={(e) =>
                                    handleUpdateAttendeeName(
                                      att.id,
                                      e.target.value
                                    )
                                  }
                                  onPaste={(e) =>
                                    handlePasteOnSingleAttendeeInput(idx, e)
                                  }
                                  placeholder="اكتب الاسم (أو الصق قائمة أسماء هنا)..."
                                  className="w-full min-h-[36px] px-3 py-1 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                                />
                              </td>
                              <td className="py-2 px-3 text-center text-stone-300 select-none">
                                {/* خلية التوقيع فارغة ليوقع المشارك بالقلم بعد الطباعة */}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {formState.attendees.length > 1 && (
                                  <button
                                    type="button"
                                    data-testid={`mm-remove-attendee-btn-${idx + 1}`}
                                    onClick={() =>
                                      handleRemoveAttendeeItem(att.id)
                                    }
                                    className="min-h-[30px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 inline-flex items-center justify-center cursor-pointer"
                                    title="حذف الصف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                    كشف الحضور والتوقيعات غير مفعّل حاليًا — لن يتم إنشاء صفحة
                    إضافية له في ملف PDF.
                  </div>
                )}
              </section>
            </>
          ) : (
            /* ================================================================
               النموذج الثاني: تقرير زيارة تبادلية بين المعلمين
               ================================================================ */
            <>
              {/* 1. نطاق الزيارة و 2. بيانات المعلمين */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ١. نطاق الزيارة وبيانات المعلمين
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    توثيق الزيارة التبادلية لتبادل الخبرات المهنية بين الزملاء
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-2">
                    نطاق الزيارة <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PEER_VISIT_SCOPE_OPTIONS.map((scopeOpt) => {
                      const isSelected = formState.visitScope === scopeOpt;
                      return (
                        <button
                          key={scopeOpt}
                          type="button"
                          data-testid={`pv-scope-${scopeOpt}`}
                          onClick={() =>
                            updatePeerVisitState((prev) => ({
                              ...prev,
                              visitScope: scopeOpt as PeerVisitScopeOption,
                            }))
                          }
                          className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#376B70] text-white border-[#416B91]'
                              : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {scopeOpt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pv-visiting-teacher-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      المعلم الزائر <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pv-visiting-teacher-input"
                      data-testid="pv-visiting-teacher-input"
                      type="text"
                      value={formState.visitingTeacherName}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          visitingTeacherName: e.target.value,
                        }))
                      }
                      placeholder="اسم المعلم الزائر..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pv-host-teacher-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      المعلم المستضيف <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pv-host-teacher-input"
                      data-testid="pv-host-teacher-input"
                      type="text"
                      value={formState.hostTeacherName}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          hostTeacherName: e.target.value,
                        }))
                      }
                      placeholder="اسم المعلم المستضيف..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="pv-date-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      تاريخ الزيارة <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pv-date-input"
                      data-testid="pv-date-input"
                      type="text"
                      value={formState.visitDate}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          visitDate: e.target.value,
                        }))
                      }
                      placeholder="١٤٤٧/٠٨/٢٢هـ"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pv-specialization-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      التخصص (عند الحاجة)
                    </label>
                    <input
                      id="pv-specialization-input"
                      data-testid="pv-specialization-input"
                      type="text"
                      value={formState.specialization}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          specialization: e.target.value,
                        }))
                      }
                      placeholder="مثال: الرياضيات / العلوم..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pv-grade-input"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      الصف أو المرحلة (عند الحاجة)
                    </label>
                    <input
                      id="pv-grade-input"
                      data-testid="pv-grade-input"
                      type="text"
                      value={formState.gradeOrStage}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          gradeOrStage: e.target.value,
                        }))
                      }
                      placeholder="مثال: الصف الثاني المتوسط"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>
                </div>
              </section>

              {/* 3. موضوع الزيارة و 4. بيانات الزيارة */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٢. موضوع الزيارة والممارسة التعليمية المشاهَدة
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    اختر موضوع الزيارة ودوّن وصفًا مختصرًا للممارسة التعليمية
                    التي تمت مشاهدتها
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="pv-topic-select"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      موضوع الزيارة <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="pv-topic-select"
                      data-testid="pv-topic-select"
                      value={formState.visitTopic}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          visitTopic: e.target.value as PeerVisitTopicOption,
                        }))
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    >
                      {PEER_VISIT_TOPIC_OPTIONS.map((topicOpt) => (
                        <option key={topicOpt} value={topicOpt}>
                          {topicOpt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formState.visitTopic === 'موضوع آخر' && (
                    <div>
                      <label
                        htmlFor="pv-custom-topic-input"
                        className="block text-xs font-bold text-stone-800 mb-1.5"
                      >
                        تحديد موضوع الزيارة المخصص{' '}
                        <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pv-custom-topic-input"
                        data-testid="pv-custom-topic-input"
                        type="text"
                        value={formState.customVisitTopic}
                        onChange={(e) =>
                          updatePeerVisitState((prev) => ({
                            ...prev,
                            customVisitTopic: e.target.value,
                          }))
                        }
                        placeholder="اكتب موضوع الزيارة..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="pv-practice-title-input"
                    className="block text-xs font-bold text-stone-800 mb-1.5"
                  >
                    موضوع الممارسة التعليمية التي تمت مشاهدتها{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="pv-practice-title-input"
                    data-testid="pv-practice-title-input"
                    type="text"
                    value={formState.observedPracticeTitle}
                    onChange={(e) =>
                      updatePeerVisitState((prev) => ({
                        ...prev,
                        observedPracticeTitle: e.target.value,
                      }))
                    }
                    placeholder="مثال: توظيف المحطات التعليمية التفاعلية في تدريس المعادلات"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pv-practice-desc-input"
                    className="block text-xs font-bold text-stone-800 mb-1.5"
                  >
                    وصف مختصر للممارسة أو الإجراء الذي تمت ملاحظته{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="pv-practice-desc-input"
                    data-testid="pv-practice-desc-input"
                    rows={3}
                    value={formState.observedPracticeDescription}
                    onChange={(e) =>
                      updatePeerVisitState((prev) => ({
                        ...prev,
                        observedPracticeDescription: e.target.value,
                      }))
                    }
                    placeholder="صف باختصار خطوات أو آلية تنفيذ الممارسة التعليمية التي شاهدتها خلال الحصة..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pv-additional-details-input"
                    className="block text-xs font-bold text-stone-800 mb-1.5"
                  >
                    تفاصيل إضافية لتوثيق الزيارة (اختياري)
                  </label>
                  <textarea
                    id="pv-additional-details-input"
                    data-testid="pv-additional-details-input"
                    rows={2}
                    value={formState.additionalVisitDetails}
                    onChange={(e) =>
                      updatePeerVisitState((prev) => ({
                        ...prev,
                        additionalVisitDetails: e.target.value,
                      }))
                    }
                    placeholder="أي تفاصيل أو ملاحظات إضافية داعمة لتوثيق الزيارة (إن وجدت)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                  />
                </div>
              </section>

              {/* 5. خلاصة الاستفادة */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-base font-extrabold font-display text-stone-900">
                    ٣. خلاصة الاستفادة والتطبيق المهني
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    حدد أبرز ما استفاد منه المعلم الزائر والممارسة التي يرغب في
                    تطبيقها في فصوله
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="pv-takeaway-preset-select"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      أبرز ما استفاد منه المعلم الزائر (اختيار سريع أو كتابة
                      مخصصة) <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="pv-takeaway-preset-select"
                      data-testid="pv-takeaway-preset-select"
                      value={formState.selectedTakeawayPreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          selectedTakeawayPreset: val,
                          keyTakeaways:
                            val === '+ إضافة بند' ? prev.keyTakeaways : val,
                        }));
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91] mb-2"
                    >
                      {PEER_VISIT_TAKEAWAY_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>

                    <textarea
                      id="pv-takeaways-textarea"
                      data-testid="pv-takeaways-textarea"
                      rows={2}
                      value={formState.keyTakeaways}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          keyTakeaways: e.target.value,
                        }))
                      }
                      placeholder="دوّن أبرز الفوائد والخبرات المكتسبة من الزيارة..."
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pv-apply-preset-select"
                      className="block text-xs font-bold text-stone-800 mb-1.5"
                    >
                      الممارسة التي يرغب في تطبيقها (اختيار سريع أو كتابة
                      مخصصة) <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="pv-apply-preset-select"
                      data-testid="pv-apply-preset-select"
                      value={formState.selectedPracticeToApplyPreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          selectedPracticeToApplyPreset: val,
                          practiceToApply:
                            val === '+ إضافة بند' ? prev.practiceToApply : val,
                        }));
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91] mb-2"
                    >
                      {PEER_VISIT_PRACTICE_TO_APPLY_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>

                    <textarea
                      id="pv-apply-textarea"
                      data-testid="pv-apply-textarea"
                      rows={2}
                      value={formState.practiceToApply}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          practiceToApply: e.target.value,
                        }))
                      }
                      placeholder="دوّن الممارسة أو الأسلوب الذي يعتزم المعلم الزائر تطبيقه..."
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                    />
                  </div>
                </div>
              </section>

              {/* 6. الشواهد المصورة (0..2 صور اختيارية) */}
              <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                      <Camera
                        className="w-4 h-4 text-[#416B91]"
                        aria-hidden="true"
                      />
                      <span>٤. الشواهد المصورة (اختياري — بحد أقصى صورتان)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      يمكنك رفع صورة واحدة أو صورتين من الجهاز مع المعاينة
                      والاستبدال والحذف؛ وعند عدم رفع صور لا تظهر أي مساحة فارغة
                      في التقرير
                    </p>
                  </div>

                  <span
                    data-testid="pv-photos-count"
                    className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
                  >
                    {formState.evidencePhotos.length} / 2
                  </span>
                </div>

                <input
                  ref={addPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  data-testid="pv-upload-photo-input"
                  onChange={handleUploadNewPhotos}
                  className="hidden"
                />

                {formState.evidencePhotos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {formState.evidencePhotos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        data-testid={`pv-photo-card-${idx + 1}`}
                        className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="aspect-[16/10] w-full rounded-lg border border-stone-200 bg-white overflow-hidden flex items-center justify-center">
                          <img
                            src={photo.imageDataUrl}
                            alt={`معاينة صورة الشاهد ${idx + 1}`}
                            className="w-full h-full object-contain block"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-stone-700">
                            صورة الشاهد ({idx + 1})
                          </span>

                          <div className="flex items-center gap-1.5">
                            <input
                              ref={(el) => {
                                replacePhotoInputRefs.current[idx] = el;
                              }}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              data-testid={`pv-replace-photo-input-${idx + 1}`}
                              onChange={(e) => handleReplacePhotoAt(idx, e)}
                              className="hidden"
                            />
                            <button
                              type="button"
                              data-testid={`pv-replace-photo-btn-${idx + 1}`}
                              onClick={() =>
                                replacePhotoInputRefs.current[idx]?.click()
                              }
                              className="min-h-[30px] px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>استبدال</span>
                            </button>

                            <button
                              type="button"
                              data-testid={`pv-delete-photo-btn-${idx + 1}`}
                              onClick={() => handleDeletePhotoAt(idx)}
                              className="min-h-[30px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                    لم يتم رفع أي صور شواهد حاليًا — لن تظهر مساحة فارغة للشواهد
                    في ملف PDF.
                  </div>
                )}

                {mediaNotice && (
                  <div
                    role="status"
                    data-testid="pv-media-store-notice"
                    className="rounded-xl border border-[#C5DCC7] bg-[#EEF5EE] px-3.5 py-2 text-xs font-bold text-[#2F6846] flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{mediaNotice}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {formState.evidencePhotos.length < 2 && (
                    <button
                      type="button"
                      data-testid="pv-add-photo-btn"
                      onClick={() => addPhotoInputRef.current?.click()}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>رفع صورة من الجهاز (JPG / PNG / WebP)</span>
                    </button>
                  )}

                  {formState.evidencePhotos.length === 0 && (
                    <button
                      type="button"
                      data-testid="pv-load-sample-photos-btn"
                      onClick={handleLoadSamplePhotos}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>إدراج صورتين تجريبيتين للمعاينة</span>
                    </button>
                  )}
                </div>
              </section>

              {/* 5. الروابط والباركود (0..2 روابط اختيارية) */}
              <section
                data-testid="pv-links-section"
                className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                      <QrCode
                        className="w-4 h-4 text-[#416B91]"
                        aria-hidden="true"
                      />
                      <span>٥. الروابط والباركود (اختياري — بحد أقصى رابطان)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      يُنشئ رمز QR منفصلاً لكل رابط قابل للفتح بالنقر من ملف PDF
                      دون عرض الرابط الطويل كنص؛ وعند عدم إضافة روابط لا يظهر أي
                      إطار أو رمز QR
                    </p>
                  </div>

                  <span
                    data-testid="pv-links-count"
                    className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 tabular-nums"
                  >
                    {(formState.evidenceLinks || []).length} / 2
                  </span>
                </div>

                {(formState.evidenceLinks || []).length > 0 ? (
                  <div className="space-y-3">
                    {(formState.evidenceLinks || []).map((linkItem, idx) => {
                      const cleanUrl = linkItem.url.trim();
                      const qrPreviewUrl = cleanUrl
                        ? generateQrSvgDataUrl(cleanUrl, palette.secondaryHex)
                        : '';
                      return (
                        <div
                          key={linkItem.id}
                          data-testid={`pv-link-card-${idx + 1}`}
                          className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="w-full flex-1 space-y-1.5">
                            <label
                              htmlFor={`pv-link-input-${idx + 1}`}
                              className="block text-xs font-bold text-stone-800"
                            >
                              الرابط الإلكتروني ({idx + 1})
                            </label>
                            <input
                              id={`pv-link-input-${idx + 1}`}
                              data-testid={`pv-link-input-${idx + 1}`}
                              type="url"
                              dir="ltr"
                              value={linkItem.url}
                              onChange={(e) =>
                                handleUpdateLinkUrl(idx, e.target.value)
                              }
                              placeholder="https://example.com/resource"
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#416B91]"
                            />
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center">
                            {qrPreviewUrl && (
                              <div className="w-12 h-12 rounded-lg border border-stone-200 bg-white p-1 shrink-0 flex items-center justify-center">
                                <img
                                  src={qrPreviewUrl}
                                  alt={`معاينة باركود الرابط ${idx + 1}`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}

                            <button
                              type="button"
                              data-testid={`pv-delete-link-btn-${idx + 1}`}
                              onClick={() => handleDeleteLinkAt(idx)}
                              className="min-h-[34px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                    لم يتم إضافة أي رابط حاليًا — لن يظهر قسم الروابط أو أي رمز
                    QR في ملف PDF.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {(formState.evidenceLinks || []).length < 2 && (
                    <button
                      type="button"
                      data-testid="pv-add-link-btn"
                      onClick={handleAddLink}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-dashed border-[#416B91]/50 bg-[#FBFBF9] hover:bg-[#DCEAF5] text-xs font-bold text-[#416B91] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>إضافة رابط إلكتروني (مع باركود QR مستقل)</span>
                    </button>
                  )}

                  {(formState.evidenceLinks || []).length === 0 && (
                    <button
                      type="button"
                      data-testid="pv-load-sample-links-btn"
                      onClick={handleLoadSampleLinks}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>إدراج رابطين تجريبيين للمعاينة</span>
                    </button>
                  )}
                </div>
              </section>

              {/* 6. أسماء المعلمين والتوقيعات (قسم اختياري مستقل في نهاية التقرير) */}
              <section
                data-testid="pv-signatures-section"
                className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold font-display text-stone-900 flex items-center gap-2">
                      <PenTool
                        className="w-4 h-4 text-[#416B91]"
                        aria-hidden="true"
                      />
                      <span>٦. أسماء المعلمين والتوقيعات (اختياري)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      عند التفعيل، تُدرج أسماء المعلم الزائر والمعلم المستضيف
                      تلقائيًا في نهاية التقرير مع مساحة مخصصة للتوقيع بعد
                      الطباعة
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none bg-[#DCEAF5] px-3.5 py-2 rounded-xl border border-[#E2E5E6]">
                    <input
                      type="checkbox"
                      data-testid="pv-enable-signatures-toggle"
                      checked={Boolean(formState.enableTeacherSignatures)}
                      onChange={(e) =>
                        updatePeerVisitState((prev) => ({
                          ...prev,
                          enableTeacherSignatures: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-[#416B91] rounded cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-[#416B91]">
                      إظهار قسم أسماء المعلمين والتوقيعات
                    </span>
                  </label>
                </div>

                {formState.enableTeacherSignatures ? (
                  <div
                    data-testid="pv-signatures-preview-grid"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-xs sm:text-sm font-bold text-stone-800">
                      المعلم الزائر:{' '}
                      <span className="text-[#416B91]">
                        {formState.visitingTeacherName.trim() || 'غير محدد'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-xs sm:text-sm font-bold text-stone-700 flex items-center justify-between">
                      <span>توقيع المعلم الزائر:</span>
                      <span className="w-28 h-5 border-b border-dashed border-stone-300" />
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-xs sm:text-sm font-bold text-stone-800">
                      المعلم المستضيف:{' '}
                      <span className="text-[#416B91]">
                        {formState.hostTeacherName.trim() || 'غير محدد'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-xs sm:text-sm font-bold text-stone-700 flex items-center justify-between">
                      <span>توقيع المعلم المستضيف:</span>
                      <span className="w-28 h-5 border-b border-dashed border-stone-300" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4 text-center text-xs text-stone-500">
                    قسم أسماء المعلمين والتوقيعات غير مفعّل حاليًا — لن تظهر
                    خانات التوقيع أو أي مساحة فارغة في ملف PDF.
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Live A4 Canvas Preview Column */}
        <div
          data-testid="meeting-visit-live-preview-pane"
          className={`xl:col-span-5 space-y-4 xl:sticky xl:top-6 ${
            activeTab === 'edit' ? 'hidden xl:block' : ''
          }`}
        >
          <div className="bg-white rounded-2xl border border-[#E2E5E6] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                  المعاينة الحية للتقرير (A4 عمودي)
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  القالب: {activeTemplateDef.name} · {palette.name}
                </p>
              </div>
              <span
                data-testid="meeting-visit-page-count-badge"
                className="px-3 py-1 rounded-full bg-[#DCEAF5] border border-[#E2E5E6] text-[#416B91] text-xs font-extrabold tabular-nums"
              >
                عدد الصفحات: {paginatedPages.length}
              </span>
            </div>

            <div className="space-y-5 max-h-[820px] overflow-y-auto pr-1">
              {renderedPages.map((page, idx) => (
                <div
                  key={idx}
                  data-testid={`meeting-visit-preview-page-${idx + 1}`}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 px-1">
                    <span>
                      الصفحة {idx + 1} من {renderedPages.length}
                    </span>
                    {formId === 'meeting-minutes' &&
                      idx > 0 &&
                      formState.formId === 'meeting-minutes' &&
                      formState.enableAttendanceSheet && (
                        <span className="text-[#2F6846]">
                          صفحة جدول الحضور والتوقيعات المستقلة
                        </span>
                      )}
                  </div>
                  <div className="rounded-xl border border-stone-300 bg-stone-100 overflow-hidden shadow-xs">
                    {page.dataUrl ? (
                      <img
                        src={page.dataUrl}
                        alt={`معاينة الصفحة ${idx + 1}`}
                        className="w-full h-auto block"
                      />
                    ) : (
                      <div className="aspect-[1/1.414] flex items-center justify-center text-xs text-stone-400">
                        جاري تجهيز المعاينة...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
