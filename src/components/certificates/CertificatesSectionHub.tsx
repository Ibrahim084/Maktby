import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Award,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  FilePlus2,
  FolderOpen,
  Globe,
  GraduationCap,
  Layers,
  Palette,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { triggerBlobDownload } from '../../utils/exportEngine';
import {
  AppreciationTargetRole,
  buildDefaultCertificateTexts,
  CERTIFICATE_COLOR_SYSTEMS,
  CERTIFICATE_TEMPLATES,
  CertificateCategoryType,
  CertificateColorSystemId,
  CertificateFormState,
  CertificateLanguage,
  CertificateTemplateId,
  createInitialCertificateFormState,
  ExcellenceSourceVariant,
  generateCertificatesPdf,
  loadCertificateDraft,
  parseCertificateBeneficiaryNames,
  RecipientGender,
  renderCertificatesToCanvases,
  RenderedCertificatePage,
} from '../../utils/certificatesEngine';
import { RecordDeletionImpact } from '../../utils/teacherArchiveEngine';
import {
  abandonActiveDraftAndCreateNewCertificate,
  CertificateDualStoreDivergenceInfo,
  CertificateDualStoreSyncError,
  computeCertificateDraftSignature,
  createNewBlankCertificateInArchive,
  deleteArchivedCertificateRecordSafely,
  extractValidCertificateBeneficiaryNames,
  filterCertificateArchiveRecords,
  getCertificateSubtypeArabicLabel,
  getCertificateTypeArabicLabel,
  getTeacherCertificateRecordTitle,
  hasMeaningfulCertificateDraftData,
  inspectArchivedCertificateDeletionImpact,
  listSavedCertificates,
  loadActiveCertificateDraft,
  loadArchivedCertificateById,
  loadCertificatesArchiveStore,
  migrateCertificatesToArchive,
  resolveCertificateDualStoreDivergence,
  saveCertificateToArchive,
  saveDraftToArchiveAndCreateNewCertificate,
  SCHOOL_CERTIFICATES_FORM_ID,
  syncActiveCertificateDraftToBothStores,
  TeacherCertificateArchiveRecord,
  validateCertificateForArchive,
} from '../../utils/teacherCertificatesArchive';

interface CertificatesSectionHubProps {
  onBackToTeacherHub?: () => void;
}

export const CertificatesSectionHub: React.FC<CertificatesSectionHubProps> = ({
  onBackToTeacherHub,
}) => {
  const { settings } = useSettings();

  const [formState, setFormState] = useState<CertificateFormState>(() =>
    loadCertificateDraft(settings)
  );
  const [renderedPages, setRenderedPages] = useState<RenderedCertificatePage[]>(
    []
  );
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [isExporting, setIsExporting] = useState(false);
  const [exportingRecordId, setExportingRecordId] = useState<string | null>(
    null
  );
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Unified Archive State (Group 7: school-certificates)
  const [savedRecords, setSavedRecords] = useState<
    TeacherCertificateArchiveRecord[]
  >([]);
  const [activeArchivedRecordId, setActiveArchivedRecordId] = useState<
    string | null
  >(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    undefined
  );
  const [hasStoredUnsavedDraft, setHasStoredUnsavedDraft] =
    useState<boolean>(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isSavingArchive, setIsSavingArchive] = useState<boolean>(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState<string>('');
  const [archiveTypeFilter, setArchiveTypeFilter] = useState<
    CertificateCategoryType | 'all'
  >('all');
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    record: TeacherCertificateArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);

  const [pendingCreateNewDialog, setPendingCreateNewDialog] = useState<{
    trigger: 'create-new' | 'reset';
    step: 'choose' | 'confirm-abandon';
    draftTitle: string;
    beneficiariesCount: number;
    typeLabel: string;
    sourceMode: 'active-draft' | 'stored-draft' | 'dirty-archived';
  } | null>(null);

  const [dualStoreDivergence, setDualStoreDivergence] =
    useState<CertificateDualStoreDivergenceInfo | null>(null);
  const [syncFailureLock, setSyncFailureLock] = useState<{
    message: string;
    rolledBackBoth: boolean;
    diverged: boolean;
  } | null>(null);
  const [isResolvingSyncIssue, setIsResolvingSyncIssue] =
    useState<boolean>(false);

  const isHydratingRef = useRef<boolean>(true);
  const isMountedRef = useRef<boolean>(true);
  const activeDraftIdRef = useRef<string | undefined>(undefined);
  const activeArchivedRecordIdRef = useRef<string | null>(null);
  const openedRecordBaselineJsonRef = useRef<string | null>(null);
  const lastCommittedDraftRef = useRef<CertificateFormState | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const syncBlockedRef = useRef<boolean>(false);
  const latestDraftContextRef = useRef<{
    formState: CertificateFormState;
    activeArchivedRecordId: string | null;
    settings: typeof settings;
  }>({
    formState,
    activeArchivedRecordId: null,
    settings,
  });

  latestDraftContextRef.current = {
    formState,
    activeArchivedRecordId,
    settings,
  };
  activeDraftIdRef.current = activeDraftId;
  activeArchivedRecordIdRef.current = activeArchivedRecordId;

  const isEditingLockedBySyncIssue =
    Boolean(dualStoreDivergence?.diverged) || Boolean(syncFailureLock);
  syncBlockedRef.current = isEditingLockedBySyncIssue;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshSavedRecords = () => {
    const list = listSavedCertificates();
    setSavedRecords(list);
    const store = loadCertificatesArchiveStore();
    const storedDraft = store.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID];
    setHasStoredUnsavedDraft(
      Boolean(
        storedDraft &&
          hasMeaningfulCertificateDraftData(storedDraft.payload, settings)
      )
    );
  };

  const handleSyncOrRollbackFailure = (
    err: unknown,
    opts?: { fromUnmount?: boolean }
  ) => {
    if (opts?.fromUnmount || !isMountedRef.current) return;

    const isDualErr = err instanceof CertificateDualStoreSyncError;
    const rolledBackBoth = isDualErr ? err.rolledBackBoth : false;
    const diverged = isDualErr ? err.diverged : false;
    const errMsg =
      err instanceof Error
        ? err.message
        : 'تعذر حفظ مسودة الشهادة في مخزني الأرشيف والمفتاح القديم؛ تم إيقاف التعديل لحماية البيانات من عدم التطابق.';

    syncBlockedRef.current = true;
    setSyncFailureLock({
      message: errMsg,
      rolledBackBoth,
      diverged,
    });

    if (rolledBackBoth && lastCommittedDraftRef.current) {
      isHydratingRef.current = true;
      setFormState(lastCommittedDraftRef.current);
      setTimeout(() => {
        if (isMountedRef.current) {
          isHydratingRef.current = false;
        }
      }, 0);
    }

    setStatusBanner({
      type: 'error',
      text: errMsg,
    });
  };

  const flushActiveDraftSynchronously = (opts?: {
    fromUnmount?: boolean;
  }): boolean => {
    if (isHydratingRef.current || syncBlockedRef.current) return false;
    const ctx = latestDraftContextRef.current;
    if (ctx.activeArchivedRecordId !== null) return true;

    const nextSignature = computeCertificateDraftSignature(
      ctx.formState,
      ctx.settings
    );
    if (nextSignature === lastSyncedSignatureRef.current) {
      return true;
    }

    try {
      const syncRes = syncActiveCertificateDraftToBothStores(ctx.formState, {
        draftId: activeDraftIdRef.current,
        settings: ctx.settings,
      });
      lastSyncedSignatureRef.current = nextSignature;
      lastCommittedDraftRef.current = ctx.formState;
      if (
        syncRes.draftRecord?.id &&
        syncRes.draftRecord.id !== activeDraftIdRef.current
      ) {
        activeDraftIdRef.current = syncRes.draftRecord.id;
        if (!opts?.fromUnmount && isMountedRef.current) {
          setActiveDraftId(syncRes.draftRecord.id);
        }
      }
      if (!opts?.fromUnmount && isMountedRef.current) {
        setHasStoredUnsavedDraft(
          hasMeaningfulCertificateDraftData(ctx.formState, ctx.settings)
        );
      }
      return true;
    } catch (err) {
      handleSyncOrRollbackFailure(err, { fromUnmount: opts?.fromUnmount });
      return false;
    }
  };

  // Run idempotent Group 7 migration once and load active draft + divergence check
  useEffect(() => {
    let cancelled = false;
    isHydratingRef.current = true;
    setActiveArchivedRecordId(null);
    activeArchivedRecordIdRef.current = null;
    openedRecordBaselineJsonRef.current = null;
    setPendingDeleteTarget(null);
    setPendingCreateNewDialog(null);
    setDualStoreDivergence(null);
    setSyncFailureLock(null);
    syncBlockedRef.current = false;
    setValidationErrors([]);
    setStatusBanner(null);

    const initArchiveAndDraft = async () => {
      try {
        await migrateCertificatesToArchive({ settings });
        const loaded = await loadActiveCertificateDraft({ settings });
        if (cancelled || !isMountedRef.current) return;

        activeDraftIdRef.current = loaded.draftRecord?.id;
        setActiveDraftId(loaded.draftRecord?.id);
        setFormState(loaded.formData);
        lastCommittedDraftRef.current = loaded.formData;
        lastSyncedSignatureRef.current = loaded.divergence.diverged
          ? null
          : computeCertificateDraftSignature(loaded.formData, settings);
        refreshSavedRecords();

        if (loaded.divergence.diverged) {
          syncBlockedRef.current = true;
          setDualStoreDivergence(loaded.divergence);
          setStatusBanner({
            type: 'error',
            text: loaded.divergence.message,
          });
        }
      } catch {
        if (!cancelled && isMountedRef.current) {
          const fallback = loadCertificateDraft(settings);
          setFormState(fallback);
          lastCommittedDraftRef.current = fallback;
          refreshSavedRecords();
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setTimeout(() => {
            if (isMountedRef.current) {
              isHydratingRef.current = false;
            }
          }, 0);
        }
      }
    };

    void initArchiveAndDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flush unsaved active draft on page reload, tab hide, or unmount (never call setState on unmount)
  useEffect(() => {
    const handleFlushOnLifecycle = () => {
      flushActiveDraftSynchronously();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushActiveDraftSynchronously();
      }
    };
    window.addEventListener('pagehide', handleFlushOnLifecycle);
    window.addEventListener('beforeunload', handleFlushOnLifecycle);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handleFlushOnLifecycle);
      window.removeEventListener('beforeunload', handleFlushOnLifecycle);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushActiveDraftSynchronously({ fromUnmount: true });
    };
  }, []);

  // Sync active draft edits to both stores (never write to legacy alone on failure)
  useEffect(() => {
    if (isHydratingRef.current || syncBlockedRef.current) return;
    if (activeArchivedRecordId !== null) {
      // Edits to an open archived record commit on explicit "حفظ التعديلات في الأرشيف"
      return;
    }
    flushActiveDraftSynchronously();
  }, [formState, activeArchivedRecordId]);

  const beneficiaryNames = useMemo(
    () => parseCertificateBeneficiaryNames(formState.beneficiariesInput),
    [formState.beneficiariesInput]
  );

  useEffect(() => {
    if (activePageIndex >= beneficiaryNames.length) {
      setActivePageIndex(Math.max(0, beneficiaryNames.length - 1));
    }
  }, [beneficiaryNames.length, activePageIndex]);

  useEffect(() => {
    let cancelled = false;
    renderCertificatesToCanvases(formState).then((pages) => {
      if (!cancelled) {
        setRenderedPages(pages);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [formState]);

  const presenterGender: RecipientGender =
    settings.gender === 'female' ? 'female' : 'male';

  const updateFormState = (
    updater: (prev: CertificateFormState) => CertificateFormState
  ) => {
    if (syncBlockedRef.current) return;
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => updater(prev));
  };

  const applyBlankDraftState = (
    blank: {
      draftRecord: TeacherCertificateArchiveRecord;
      formData: CertificateFormState;
    },
    bannerText: string,
    bannerType: 'info' | 'success' = 'info'
  ) => {
    isHydratingRef.current = true;
    openedRecordBaselineJsonRef.current = null;
    activeArchivedRecordIdRef.current = null;
    activeDraftIdRef.current = blank.draftRecord.id;
    lastCommittedDraftRef.current = blank.formData;
    lastSyncedSignatureRef.current = computeCertificateDraftSignature(
      blank.formData,
      settings
    );
    setActiveArchivedRecordId(null);
    setActiveDraftId(blank.draftRecord.id);
    setFormState(blank.formData);
    setActivePageIndex(0);
    setValidationErrors([]);
    setPendingCreateNewDialog(null);
    setMobileTab('edit');
    refreshSavedRecords();
    setStatusBanner({
      type: bannerType,
      text: bannerText,
    });
    setTimeout(() => {
      if (isMountedRef.current) {
        isHydratingRef.current = false;
      }
    }, 0);
  };

  const handleResolveDualStoreDivergence = async (
    choice: 'keep-archive' | 'keep-legacy'
  ) => {
    try {
      setIsResolvingSyncIssue(true);
      isHydratingRef.current = true;
      const resolved = await resolveCertificateDualStoreDivergence(choice, {
        settings,
      });
      if (!isMountedRef.current) return;
      activeArchivedRecordIdRef.current = null;
      activeDraftIdRef.current = resolved.draftRecord.id;
      lastCommittedDraftRef.current = resolved.formData;
      lastSyncedSignatureRef.current = computeCertificateDraftSignature(
        resolved.formData,
        settings
      );
      syncBlockedRef.current = false;
      setDualStoreDivergence(null);
      setSyncFailureLock(null);
      setActiveArchivedRecordId(null);
      setActiveDraftId(resolved.draftRecord.id);
      setFormState(resolved.formData);
      setActivePageIndex(0);
      refreshSavedRecords();
      setStatusBanner({
        type: 'success',
        text:
          choice === 'keep-archive'
            ? 'تم اعتماد نسخة مخزن أرشيف الشهادات الموحد ومزامنتها مع المفتاح التوافقي بنجاح.'
            : 'تم اعتماد نسخة المفتاح التوافقي القديم ومزامنتها مع مخزن أرشيف الشهادات بنجاح.',
      });
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    } finally {
      if (isMountedRef.current) {
        setIsResolvingSyncIssue(false);
        setTimeout(() => {
          if (isMountedRef.current) {
            isHydratingRef.current = false;
          }
        }, 0);
      }
    }
  };

  const handleRetrySyncAfterFailure = async () => {
    try {
      setIsResolvingSyncIssue(true);
      isHydratingRef.current = true;
      const loaded = await loadActiveCertificateDraft({ settings });
      if (!isMountedRef.current) return;
      if (loaded.divergence.diverged) {
        syncBlockedRef.current = true;
        setDualStoreDivergence(loaded.divergence);
        setSyncFailureLock(null);
        setStatusBanner({
          type: 'error',
          text: loaded.divergence.message,
        });
        return;
      }
      activeArchivedRecordIdRef.current = null;
      activeDraftIdRef.current = loaded.draftRecord?.id;
      lastCommittedDraftRef.current = loaded.formData;
      lastSyncedSignatureRef.current = computeCertificateDraftSignature(
        loaded.formData,
        settings
      );
      syncBlockedRef.current = false;
      setDualStoreDivergence(null);
      setSyncFailureLock(null);
      setActiveArchivedRecordId(null);
      setActiveDraftId(loaded.draftRecord?.id);
      setFormState(loaded.formData);
      refreshSavedRecords();
      setStatusBanner({
        type: 'info',
        text: 'تم التحقق من تطابق المخزنين واستعادة آخر نسخة محفوظة بنجاح؛ يمكنك استئناف التحرير الآن.',
      });
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    } finally {
      if (isMountedRef.current) {
        setIsResolvingSyncIssue(false);
        setTimeout(() => {
          if (isMountedRef.current) {
            isHydratingRef.current = false;
          }
        }, 0);
      }
    }
  };

  const applyConfigurationAndRefreshDefaults = (
    overrides: Partial<CertificateFormState>
  ) => {
    if (syncBlockedRef.current) return;
    setValidationErrors([]);
    setFormState((prev) => {
      const next: CertificateFormState = {
        ...prev,
        ...overrides,
      };

      const defaults = buildDefaultCertificateTexts({
        certificateType: next.certificateType,
        appreciationRole: next.appreciationRole,
        excellenceVariant: next.excellenceVariant,
        language: next.language,
        recipientGender: next.recipientGender,
        presenterGender,
        schoolName: next.schoolName,
        gradeName: next.gradeName,
        academicStage: next.academicStage,
        academicYear: next.academicYear,
      });

      const currentLines = parseCertificateBeneficiaryNames(
        prev.beneficiariesInput
      );
      const shouldReplaceSampleBeneficiary =
        currentLines.length <= 1 &&
        prev.beneficiariesInput !== '' &&
        (prev.beneficiariesInput.includes('...') ||
          overrides.language !== undefined ||
          overrides.certificateType !== undefined ||
          overrides.appreciationRole !== undefined ||
          overrides.excellenceVariant !== undefined ||
          overrides.recipientGender !== undefined);

      return {
        ...next,
        certificateTitle: defaults.certificateTitle,
        openingText: defaults.openingText,
        beneficiariesInput: shouldReplaceSampleBeneficiary
          ? defaults.defaultBeneficiarySample
          : prev.beneficiariesInput,
        mainText: defaults.mainText,
        additionalText: defaults.additionalText,
        presenterTitle: defaults.presenterTitle,
        principalTitle: defaults.principalTitle,
      };
    });
    setStatusBanner(null);
  };

  const handleStageOrYearChange = (
    field: 'academicStage' | 'academicYear',
    value: string
  ) => {
    updateFormState((prev) => {
      const next = { ...prev, [field]: value };
      if (next.certificateType === 'graduation') {
        const defaults = buildDefaultCertificateTexts({
          certificateType: next.certificateType,
          appreciationRole: next.appreciationRole,
          excellenceVariant: next.excellenceVariant,
          language: next.language,
          recipientGender: next.recipientGender,
          presenterGender,
          schoolName: next.schoolName,
          gradeName: next.gradeName,
          academicStage: next.academicStage,
          academicYear: next.academicYear,
        });
        next.mainText = defaults.mainText;
      }
      return next;
    });
  };

  const handleSchoolNameChange = (value: string) => {
    updateFormState((prev) => {
      const next = { ...prev, schoolName: value };
      const defaults = buildDefaultCertificateTexts({
        certificateType: next.certificateType,
        appreciationRole: next.appreciationRole,
        excellenceVariant: next.excellenceVariant,
        language: next.language,
        recipientGender: next.recipientGender,
        presenterGender,
        schoolName: value,
        gradeName: next.gradeName,
        academicStage: next.academicStage,
        academicYear: next.academicYear,
      });
      return {
        ...next,
        openingText: defaults.openingText,
      };
    });
  };

  const handleRestoreDefaultTexts = () => {
    if (syncBlockedRef.current) return;
    applyConfigurationAndRefreshDefaults({});
    setStatusBanner({
      type: 'info',
      text: 'تمت استعادة النصوص الافتراضية المعتمدة لهذا النوع.',
    });
  };

  const handleResetAll = () => {
    if (syncBlockedRef.current) return;
    if (
      activeArchivedRecordId === null &&
      hasMeaningfulCertificateDraftData(formState, settings)
    ) {
      const ok = flushActiveDraftSynchronously();
      if (!ok) return;
      setPendingCreateNewDialog({
        trigger: 'reset',
        step: 'confirm-abandon',
        draftTitle: getTeacherCertificateRecordTitle(formState),
        beneficiariesCount: extractValidCertificateBeneficiaryNames(
          formState.beneficiariesInput
        ).length,
        typeLabel: getCertificateTypeArabicLabel(formState.certificateType),
        sourceMode: 'active-draft',
      });
      return;
    }

    try {
      const created = createNewBlankCertificateInArchive({ settings });
      applyBlankDraftState(
        created,
        'تمت إعادة ضبط الشهادة إلى الإعدادات الافتراضية مع بقاء السجلات المحفوظة في الأرشيف دون تغيير.'
      );
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    }
  };

  const handleCreateNewRecord = () => {
    if (syncBlockedRef.current) return;
    if (activeArchivedRecordId === null) {
      if (hasMeaningfulCertificateDraftData(formState, settings)) {
        const ok = flushActiveDraftSynchronously();
        if (!ok) return;
        setPendingCreateNewDialog({
          trigger: 'create-new',
          step: 'choose',
          draftTitle: getTeacherCertificateRecordTitle(formState),
          beneficiariesCount: extractValidCertificateBeneficiaryNames(
            formState.beneficiariesInput
          ).length,
          typeLabel: getCertificateTypeArabicLabel(formState.certificateType),
          sourceMode: 'active-draft',
        });
        return;
      }
    } else {
      const isOpenedRecordDirty =
        openedRecordBaselineJsonRef.current !== null &&
        JSON.stringify(formState) !== openedRecordBaselineJsonRef.current;

      if (isOpenedRecordDirty) {
        setPendingCreateNewDialog({
          trigger: 'create-new',
          step: 'choose',
          draftTitle: getTeacherCertificateRecordTitle(formState),
          beneficiariesCount: extractValidCertificateBeneficiaryNames(
            formState.beneficiariesInput
          ).length,
          typeLabel: getCertificateTypeArabicLabel(formState.certificateType),
          sourceMode: 'dirty-archived',
        });
        return;
      }

      const store = loadCertificatesArchiveStore();
      const storedDraft =
        store.activeDraftByFormId?.[SCHOOL_CERTIFICATES_FORM_ID];
      const storedDraftHasData = Boolean(
        storedDraft &&
          hasMeaningfulCertificateDraftData(storedDraft.payload, settings)
      );
      if (storedDraftHasData && storedDraft) {
        setPendingCreateNewDialog({
          trigger: 'create-new',
          step: 'choose',
          draftTitle: storedDraft.title || 'مسودة شهادة غير محفوظة',
          beneficiariesCount: extractValidCertificateBeneficiaryNames(
            storedDraft.payload?.beneficiariesInput || ''
          ).length,
          typeLabel: getCertificateTypeArabicLabel(
            storedDraft.payload?.certificateType || 'appreciation'
          ),
          sourceMode: 'stored-draft',
        });
        return;
      }
    }

    try {
      const created = createNewBlankCertificateInArchive({ settings });
      applyBlankDraftState(
        created,
        'تم فتح مسودة شهادة جديدة فارغة مع الإبقاء على جميع السجلات المحفوظة في الأرشيف دون تعديل.'
      );
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    }
  };

  const handleSaveToArchive = async () => {
    if (syncBlockedRef.current) return;
    const errors = validateCertificateForArchive(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner({
        type: 'error',
        text: errors[0],
      });
      return;
    }

    setValidationErrors([]);
    try {
      setIsSavingArchive(true);
      const wasUnsavedDraft = activeArchivedRecordId === null;
      const saved = await saveCertificateToArchive(formState, {
        recordId: activeArchivedRecordId ?? undefined,
        resetActiveDraftAfterSave: wasUnsavedDraft,
        settings,
      });
      if (!isMountedRef.current) return;

      if (saved.newDraftRecord) {
        activeDraftIdRef.current = saved.newDraftRecord.id;
        setActiveDraftId(saved.newDraftRecord.id);
      }
      openedRecordBaselineJsonRef.current = JSON.stringify(formState);
      activeArchivedRecordIdRef.current = saved.record.id;
      setActiveArchivedRecordId(saved.record.id);
      refreshSavedRecords();
      setStatusBanner({
        type: 'success',
        text: saved.isNew
          ? `تم حفظ سجل الشهادة في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث سجل الشهادة المحفوظ في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
      });
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    } finally {
      if (isMountedRef.current) {
        setIsSavingArchive(false);
      }
    }
  };

  const handleGuardSaveAndCreateNew = async () => {
    if (!pendingCreateNewDialog || syncBlockedRef.current) return;
    try {
      setIsSavingArchive(true);
      let targetFormData = formState;
      let targetRecordId: string | undefined =
        pendingCreateNewDialog.sourceMode === 'dirty-archived'
          ? activeArchivedRecordId ?? undefined
          : undefined;
      let expectedDraftId =
        pendingCreateNewDialog.sourceMode === 'active-draft'
          ? activeDraftIdRef.current
          : undefined;

      if (pendingCreateNewDialog.sourceMode === 'stored-draft') {
        const loadedDraft = await loadActiveCertificateDraft({ settings });
        targetFormData = loadedDraft.formData;
        targetRecordId = undefined;
        expectedDraftId = loadedDraft.draftRecord?.id;
      }

      const res = await saveDraftToArchiveAndCreateNewCertificate(
        targetFormData,
        {
          recordId: targetRecordId,
          expectedDraftId,
          settings,
        }
      );
      if (!isMountedRef.current) return;

      if (!res.ok) {
        if (pendingCreateNewDialog.sourceMode === 'stored-draft') {
          isHydratingRef.current = true;
          activeArchivedRecordIdRef.current = null;
          setActiveArchivedRecordId(null);
          openedRecordBaselineJsonRef.current = null;
          setFormState(targetFormData);
          setTimeout(() => {
            if (isMountedRef.current) {
              isHydratingRef.current = false;
            }
          }, 0);
        }
        setPendingCreateNewDialog(null);
        setValidationErrors(res.validationErrors);
        setStatusBanner({
          type: 'error',
          text: 'تعذر حفظ المسودة في الأرشيف لعدم اكتمال البيانات المطلوبة (اسم مستفيد حقيقي واحد على الأقل وعنوان الشهادة والنص الرئيسي)؛ تم الإبقاء على مسودتك دون تغيير لاستكمالها.',
        });
        return;
      }

      applyBlankDraftState(
        {
          draftRecord: res.newDraftRecord,
          formData: res.newFormData,
        },
        `تم حفظ الشهادة السابقة في الأرشيف بالمعرف الثابت (${res.savedRecord.id}) وفتح مسودة شهادة جديدة فارغة بأمان.`,
        'success'
      );
    } catch (err) {
      if (isMountedRef.current) {
        setPendingCreateNewDialog(null);
      }
      handleSyncOrRollbackFailure(err);
    } finally {
      if (isMountedRef.current) {
        setIsSavingArchive(false);
      }
    }
  };

  const handleGuardConfirmAbandonAndCreateNew = async () => {
    if (!pendingCreateNewDialog || syncBlockedRef.current) return;
    try {
      setIsSavingArchive(true);
      if (pendingCreateNewDialog.sourceMode === 'dirty-archived') {
        const created = createNewBlankCertificateInArchive({ settings });
        applyBlankDraftState(
          created,
          'تم تجاهل التعديلات غير المحفوظة على السجل المفتوح وفتح مسودة جديدة فارغة مع بقاء السجل المحفوظ كما هو في الأرشيف.'
        );
        return;
      }

      const abandoned = await abandonActiveDraftAndCreateNewCertificate({
        settings,
      });
      if (!isMountedRef.current) return;
      applyBlankDraftState(
        abandoned,
        pendingCreateNewDialog.trigger === 'reset'
          ? 'تم التخلي عن المسودة السابقة وإعادة ضبط الشهادة إلى الوضع الافتراضي.'
          : 'تم التخلي عن المسودة غير المحفوظة وفتح مسودة شهادة جديدة فارغة.'
      );
    } catch (err) {
      if (isMountedRef.current) {
        setPendingCreateNewDialog(null);
      }
      handleSyncOrRollbackFailure(err);
    } finally {
      if (isMountedRef.current) {
        setIsSavingArchive(false);
      }
    }
  };

  const handleOpenArchivedRecord = async (recordId: string) => {
    if (syncBlockedRef.current) return;
    if (activeArchivedRecordId === null) {
      const ok = flushActiveDraftSynchronously();
      if (!ok) return;
    }

    const loaded = await loadArchivedCertificateById(recordId, { settings });
    if (!loaded.record || !loaded.formData || !isMountedRef.current) return;

    isHydratingRef.current = true;
    openedRecordBaselineJsonRef.current = JSON.stringify(loaded.formData);
    activeArchivedRecordIdRef.current = loaded.record.id;
    setActiveArchivedRecordId(loaded.record.id);
    setFormState(loaded.formData);
    setActivePageIndex(0);
    setValidationErrors([]);
    setPendingDeleteTarget(null);
    setPendingCreateNewDialog(null);
    setMobileTab('edit');
    refreshSavedRecords();
    setStatusBanner({
      type: 'info',
      text: `تم فتح سجل الشهادة المحفوظ «${loaded.record.title}» (${loaded.record.id}) للتحرير أو التصدير.`,
    });
    setTimeout(() => {
      if (isMountedRef.current) {
        isHydratingRef.current = false;
      }
    }, 0);
  };

  const handleResumeUnsavedDraft = async () => {
    if (syncBlockedRef.current) return;
    const loaded = await loadActiveCertificateDraft({ settings });
    if (!isMountedRef.current) return;
    isHydratingRef.current = true;
    openedRecordBaselineJsonRef.current = null;
    activeArchivedRecordIdRef.current = null;
    activeDraftIdRef.current = loaded.draftRecord?.id;
    setActiveArchivedRecordId(null);
    setActiveDraftId(loaded.draftRecord?.id);
    setFormState(loaded.formData);
    setActivePageIndex(0);
    setValidationErrors([]);
    setPendingDeleteTarget(null);
    setPendingCreateNewDialog(null);
    setMobileTab('edit');
    refreshSavedRecords();
    setStatusBanner({
      type: 'info',
      text: 'تمت استعادة المسودة غير المحفوظة لاستكمال تحريرها.',
    });
    setTimeout(() => {
      if (isMountedRef.current) {
        isHydratingRef.current = false;
      }
    }, 0);
  };

  const handleRequestDeleteArchivedRecord = (
    record: TeacherCertificateArchiveRecord
  ) => {
    const impact = inspectArchivedCertificateDeletionImpact(record.id);
    setPendingDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedRecord = async () => {
    if (!pendingDeleteTarget) return;
    const targetId = pendingDeleteTarget.record.id;
    const targetTitle = pendingDeleteTarget.record.title;
    const wasCurrentlyOpen = activeArchivedRecordId === targetId;

    const res = await deleteArchivedCertificateRecordSafely(targetId, {
      confirmUnlinkPortfolio: true,
    });
    if (!isMountedRef.current) return;

    if (res.deleted) {
      if (wasCurrentlyOpen) {
        setActiveArchivedRecordId(null);
        activeArchivedRecordIdRef.current = null;
        openedRecordBaselineJsonRef.current = null;
        try {
          const syncedDraft = syncActiveCertificateDraftToBothStores(
            formState,
            { settings }
          );
          activeDraftIdRef.current = syncedDraft.draftRecord.id;
          setActiveDraftId(syncedDraft.draftRecord.id);
          lastCommittedDraftRef.current = formState;
          lastSyncedSignatureRef.current = computeCertificateDraftSignature(
            formState,
            settings
          );
        } catch (err) {
          handleSyncOrRollbackFailure(err);
        }
      }
      setPendingDeleteTarget(null);
      refreshSavedRecords();
      setStatusBanner({
        type: 'info',
        text: wasCurrentlyOpen
          ? res.unlinkedElementIds.length > 0
            ? `تم حذف السجل «${targetTitle}» من الأرشيف نهائيًا وفك ارتباطه من (${res.unlinkedElementIds.length}) عنصر في ملف الأداء. المحتوى الظاهر حاليًا في المحرر أصبح مسودة مستقلة غير محفوظة في الأرشيف؛ يمكنك حفظه كشهادة جديدة أو الضغط على «إنشاء شهادة جديدة» لتفريغ المحرر.`
            : `تم حذف السجل «${targetTitle}» من الأرشيف نهائيًا. المحتوى الظاهر حاليًا في المحرر أصبح مسودة مستقلة غير محفوظة في الأرشيف؛ يمكنك حفظه كشهادة جديدة أو الضغط على «إنشاء شهادة جديدة» لتفريغ المحرر.`
          : res.unlinkedElementIds.length > 0
            ? `تم حذف السجل «${targetTitle}» من الأرشيف نهائيًا وفك ارتباطه من (${res.unlinkedElementIds.length}) عنصر في ملف الإنجاز.`
            : `تم حذف السجل «${targetTitle}» من الأرشيف نهائيًا بنجاح.`,
      });
    }
  };

  const handleExportArchivedRecordPdf = async (
    record: TeacherCertificateArchiveRecord
  ) => {
    try {
      setExportingRecordId(record.id);
      const loaded = await loadArchivedCertificateById(record.id, { settings });
      if (!loaded.formData) return;
      const result = await generateCertificatesPdf(loaded.formData);
      triggerBlobDownload(result.pdfBytes, 'application/pdf', result.filename);
      setStatusBanner({
        type: 'success',
        text: `تم تصدير ملف PDF لسجل الشهادة المحفوظ «${record.title}» بنجاح.`,
      });
    } catch {
      setValidationErrors(['تعذر تصدير ملف PDF لسجل الشهادة المحفوظ.']);
    } finally {
      setExportingRecordId(null);
    }
  };

  const handleLoadBatchSample = () => {
    if (syncBlockedRef.current) return;
    const sampleBatch =
      formState.language === 'en'
        ? [
            'Ahmed bin Saleh Al-Qahtani',
            'Mohammed bin Abdullah Al-Ghamdi',
            'Khalid bin Fahad Al-Otaibi',
          ].join('\n')
        : [
            'أحمد بن صالح القحطاني',
            'محمد بن عبدالله الغامدي',
            'خالد بن فهد العتيبي',
          ].join('\n');

    updateFormState((prev) => ({
      ...prev,
      beneficiariesInput: sampleBatch,
    }));
    setActivePageIndex(0);
    setStatusBanner({
      type: 'info',
      text: 'تم إدراج ٣ مستفيدين كمثال للإنشاء الجماعي — لكل مستفيد شهادة مستقلة في ملف PDF ويمكن حفظ الدفعة كاملة كسجل أرشيفي واحد.',
    });
  };

  const handleFillPresenterFromSettings = () => {
    if (syncBlockedRef.current) return;
    const teacherName = settings.userName?.trim() || '';
    if (!teacherName) {
      setStatusBanner({
        type: 'info',
        text: 'لم يتم تحديد اسم المعلم في الإعدادات المركزية بعد؛ يمكنك كتابته مباشرة في الحقل أو إضافته من الإعدادات المركزية.',
      });
      return;
    }
    updateFormState((prev) => ({
      ...prev,
      presenterName: teacherName,
    }));
    setStatusBanner({
      type: 'info',
      text: `تم إدراج اسم المعلم («${teacherName}») من الإعدادات المركزية في حقل مقدم الشهادة.`,
    });
  };

  const handleBackToTeacherHubSafe = () => {
    flushActiveDraftSynchronously();
    onBackToTeacherHub?.();
  };

  const handleExportAllPdf = async () => {
    setIsExporting(true);
    setStatusBanner(null);
    try {
      const result = await generateCertificatesPdf(formState);
      triggerBlobDownload(result.pdfBytes, 'application/pdf', result.filename);
      setStatusBanner({
        type: 'success',
        text:
          result.pageCount > 1
            ? `تم تصدير (${result.pageCount}) شهادات مستقلة في ملف PDF واحد متعدد الصفحات (${result.filename}).`
            : `تم تصدير الشهادة بصيغة PDF بنجاح (${result.filename}).`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSingleCurrentPdf = async () => {
    setIsExporting(true);
    setStatusBanner(null);
    try {
      const result = await generateCertificatesPdf(formState, {
        beneficiaryIndex: activePageIndex,
      });
      triggerBlobDownload(result.pdfBytes, 'application/pdf', result.filename);
      setStatusBanner({
        type: 'success',
        text: `تم تصدير شهادة المستفيد الحالي بصيغة PDF (${result.filename}).`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredArchiveRecords = useMemo(
    () =>
      filterCertificateArchiveRecords(savedRecords, {
        searchQuery: archiveSearchQuery,
        certificateType: archiveTypeFilter,
      }),
    [savedRecords, archiveSearchQuery, archiveTypeFilter]
  );

  const currentPagePreview =
    renderedPages[activePageIndex] || renderedPages[0] || null;

  return (
    <section
      aria-label="قسم الشهادات"
      data-testid="certificates-section-hub"
      className="space-y-6"
    >
      {/* شريط العنوان والإجراءات السريعة والأرشيف */}
      <div className="bg-white rounded-2xl border border-[#C4D8D6] p-5 sm:p-6 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {onBackToTeacherHub && (
              <button
                type="button"
                data-testid="back-from-certificates-to-teacher-btn"
                onClick={handleBackToTeacherHubSafe}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF2F1] hover:bg-[#DCE9E8] active:bg-[#C4D8D6] border border-[#C4D8D6] text-xs sm:text-sm font-bold text-[#376B70] inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>العودة إلى أقسام المعلم</span>
              </button>
            )}

            <button
              type="button"
              data-testid="toggle-certificates-archive-btn"
              onClick={() => setIsArchiveOpen((prev) => !prev)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isArchiveOpen
                  ? 'border-[#376B70] bg-[#376B70] text-white'
                  : 'border-[#C4D8D6] bg-white hover:bg-[#EAF2F1] text-[#376B70]'
              }`}
            >
              <Archive className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>الأرشيف المحفوظ ({savedRecords.length})</span>
            </button>

            <button
              type="button"
              data-testid="create-new-certificate-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={handleCreateNewRecord}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إنشاء شهادة جديدة</span>
            </button>

            <button
              type="button"
              data-testid="save-certificate-to-archive-btn"
              disabled={isSavingArchive || isEditingLockedBySyncIssue}
              onClick={handleSaveToArchive}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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

            <button
              type="button"
              data-testid="cert-restore-defaults-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={handleRestoreDefaultTexts}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#EAF2F1] hover:bg-[#DCE9E8] active:bg-[#C4D8D6] border border-[#C4D8D6] text-[#376B70] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>استعادة النص الافتراضي</span>
            </button>

            <button
              type="button"
              data-testid="cert-reset-all-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={handleResetAll}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-[#EAF2F1] hover:text-[#376B70] text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>إعادة ضبط</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="cert-toggle-mobile-preview-btn"
              onClick={() =>
                setMobileTab((prev) => (prev === 'edit' ? 'preview' : 'edit'))
              }
              className="xl:hidden min-h-[44px] px-4 py-2 rounded-xl border border-[#C4D8D6] bg-[#EAF2F1] hover:bg-[#DCE9E8] active:bg-[#C4D8D6] text-[#376B70] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {mobileTab === 'edit'
                  ? 'معاينة الشهادة (A4)'
                  : 'العودة لتحرير البيانات'}
              </span>
            </button>

            <button
              type="button"
              data-testid="cert-export-pdf-btn"
              disabled={isExporting}
              onClick={handleExportAllPdf}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isExporting
                  ? 'جاري تجهيز PDF...'
                  : beneficiaryNames.length > 1
                    ? `تصدير جميع الشهادات (${beneficiaryNames.length}) في PDF واحد`
                    : 'تصدير الشهادة بصيغة PDF'}
              </span>
            </button>
          </div>
        </div>

        {/* شريط حالة التوثيق الحالي (Group 7) */}
        <div
          data-testid="certificate-record-state-bar"
          className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
            <span>حالة التوثيق الحالي:</span>
            {activeArchivedRecordId ? (
              <span
                data-testid="certificate-active-record-status-text"
                className="text-[#315E62]"
              >
                سجل شهادة محفوظ في الأرشيف (المعرف الثابت:{' '}
                {activeArchivedRecordId})
              </span>
            ) : (
              <span
                data-testid="certificate-active-record-status-text"
                className="text-[#376B70]"
              >
                مسودة قيد التحرير (لا تُحتسب شاهدًا إلا بعد الحفظ والربط لاحقًا)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeArchivedRecordId && hasStoredUnsavedDraft && (
              <button
                type="button"
                data-testid="resume-unsaved-certificate-draft-btn"
                onClick={handleResumeUnsavedDraft}
                className="text-xs font-bold text-[#9A4A2E] hover:underline cursor-pointer"
              >
                استئناف المسودة غير المحفوظة
              </button>
            )}
            {savedRecords.length > 0 && !isArchiveOpen && (
              <button
                type="button"
                onClick={() => setIsArchiveOpen(true)}
                className="text-xs font-bold text-[#376B70] hover:underline cursor-pointer"
              >
                استعراض {savedRecords.length} سجل محفوظ
              </button>
            )}
          </div>
        </div>

        {/* نافذة حماية المسودة عند إنشاء شهادة جديدة أو إعادة الضبط */}
        {pendingCreateNewDialog && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="create-new-certificate-guard-heading"
            data-testid="create-new-certificate-guard-dialog"
            className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl p-5 sm:p-6 space-y-4">
              {pendingCreateNewDialog.step === 'choose' ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FDF2ED] border border-[#E8C9BA] flex items-center justify-center shrink-0">
                      <AlertTriangle
                        className="w-5 h-5 text-[#9A4A2E]"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3
                        id="create-new-certificate-guard-heading"
                        className="text-sm sm:text-base font-extrabold text-stone-900"
                      >
                        توجد مسودة شهادة نشطة غير محفوظة في الأرشيف
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                        {pendingCreateNewDialog.sourceMode === 'dirty-archived'
                          ? 'تحتوي الشهادة المفتوحة على تعديلات لم تُحفظ في الأرشيف بعد. اختر الإجراء المطلوب قبل إنشاء شهادة جديدة:'
                          : 'تحتوي المسودة الحالية على بيانات لم تُحفظ في الأرشيف بعد. اختر الإجراء المطلوب قبل فتح شهادة جديدة حتى لا تفقد بياناتك:'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-700 space-y-1">
                    <div className="font-bold text-stone-900 truncate">
                      المسودة الحالية: {pendingCreateNewDialog.draftTitle}
                    </div>
                    <div className="text-stone-600">
                      النوع: {pendingCreateNewDialog.typeLabel} · عدد المستفيدين
                      المدخلين: {pendingCreateNewDialog.beneficiariesCount}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-cert-save-and-create-new-btn"
                      onClick={handleGuardSaveAndCreateNew}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <BookmarkCheck
                        className="w-4 h-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        حفظ المسودة الحالية في الأرشيف ثم إنشاء شهادة جديدة
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-cert-request-abandon-btn"
                      onClick={() =>
                        setPendingCreateNewDialog((prev) =>
                          prev ? { ...prev, step: 'confirm-abandon' } : prev
                        )
                      }
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        إنشاء مسودة جديدة بعد التخلي عن المسودة الحالية
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-cert-cancel-create-new-btn"
                      onClick={() => setPendingCreateNewDialog(null)}
                      className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <span>إلغاء العملية والعودة للمسودة الحالية</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                      <AlertTriangle
                        className="w-5 h-5 text-red-700"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <h3
                        id="create-new-certificate-guard-heading"
                        className="text-sm sm:text-base font-extrabold text-red-900"
                      >
                        تأكيد صريح: التخلي عن بيانات الشهادة غير المحفوظة
                      </h3>
                      <p
                        data-testid="guard-cert-abandon-warning-text"
                        className="text-xs sm:text-sm text-red-800 leading-relaxed"
                      >
                        تنبيه صريح: ستُستبدل جميع البيانات غير المحفوظة في المسودة
                        الحالية («{pendingCreateNewDialog.draftTitle}» بما فيها
                        أسماء المستفيدين والنصوص المخصصة) بمسودة فارغة ولن يمكن
                        التراجع عن ذلك. لن تتأثر السجلات المحفوظة مسبقًا في
                        الأرشيف.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row-reverse items-stretch sm:items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-cert-confirm-abandon-create-new-btn"
                      onClick={handleGuardConfirmAbandonAndCreateNew}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span>
                        {pendingCreateNewDialog.trigger === 'reset'
                          ? 'تأكيد التخلي وإعادة الضبط'
                          : 'تأكيد التخلي وإنشاء شهادة جديدة'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-cert-back-to-cancel-abandon-btn"
                      onClick={() => setPendingCreateNewDialog(null)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <span>إلغاء والعودة للمسودة الحالية</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* لوحة الأرشيف متعدد السجلات (Group 7: الشهادات) */}
        {isArchiveOpen && (
          <div
            data-testid="certificates-archive-panel"
            className="rounded-2xl border border-[#C4D8D6] bg-[#FBFBF9] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات أرشيف الشهادات المحفوظة ({savedRecords.length})
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  يحتفظ كل سجل شهادة (مفردة أو دفعة مستفيدين) بمعرف ثابت مستقل،
                  ويمكن البحث فيه وتصفيته حسب النوع وإعادة فتحه وتعديله أو تصدير
                  PDF له دون التأثير على بقية السجلات.
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

            {savedRecords.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    data-testid="certificate-archive-search-input"
                    aria-label="ابحث في أرشيف الشهادات باسم المستفيد أو العنوان أو المدرسة أو المعرف"
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                    placeholder="ابحث باسم المستفيد أو عنوان الشهادة أو الفئة أو المعرف..."
                    className="w-full min-h-[38px] pr-9 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                  />
                </div>
                <select
                  aria-label="تصفية السجلات حسب نوع الشهادة"
                  data-testid="certificate-archive-type-filter"
                  value={archiveTypeFilter}
                  onChange={(e) =>
                    setArchiveTypeFilter(
                      e.target.value as CertificateCategoryType | 'all'
                    )
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:border-[#376B70]"
                >
                  <option value="all">جميع أنواع الشهادات</option>
                  <option value="appreciation">شهادة شكر وتقدير</option>
                  <option value="excellence">شهادة تفوق</option>
                  <option value="graduation">شهادة تخرج</option>
                </select>
              </div>
            )}

            {pendingDeleteTarget && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-delete-certificate-archive-heading"
                data-testid="delete-certificate-archive-confirm-panel"
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
                      id="confirm-delete-certificate-archive-heading"
                      className="font-extrabold"
                    >
                      تأكيد حذف سجل الشهادة «{pendingDeleteTarget.record.title}»
                    </div>
                    <p>
                      {pendingDeleteTarget.impact.warningMessage ||
                        'هل أنت متأكد من رغبتك في حذف سجل الشهادة المحفوظ من الأرشيف؟ لن تتأثر بقية السجلات المحفوظة.'}
                    </p>
                    {activeArchivedRecordId ===
                      pendingDeleteTarget.record.id && (
                      <p className="font-bold text-stone-800">
                        ملاحظة: هذا السجل مفتوح حاليًا في المحرر؛ سيؤدي حذفه إلى
                        إزالته من الأرشيف مع إبقاء البيانات الظاهرة في المحرر
                        كمسودة مستقلة غير محفوظة حمايةً من فقدان البيانات.
                      </p>
                    )}
                    {pendingDeleteTarget.impact.linkedElements.length > 0 && (
                      <ul className="list-disc pr-5 space-y-0.5 font-semibold">
                        {pendingDeleteTarget.impact.linkedElements.map((el) => (
                          <li key={el.elementId}>{el.elementTitle}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    data-testid="cancel-delete-certificate-archive-btn"
                    onClick={() => setPendingDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-certificate-archive-btn"
                    onClick={handleConfirmDeleteArchivedRecord}
                    className="min-h-[36px] px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold cursor-pointer"
                  >
                    {pendingDeleteTarget.impact.isLinked
                      ? 'تأكيد فك الارتباط والحذف النهائي'
                      : 'تأكيد الحذف'}
                  </button>
                </div>
              </div>
            )}

            {savedRecords.length === 0 ? (
              <div
                data-testid="certificates-archive-empty-state"
                className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center space-y-1.5"
              >
                <div className="text-xs sm:text-sm font-bold text-stone-700">
                  لا توجد شهادات محفوظة في الأرشيف حتى الآن
                </div>
                <p className="text-xs text-stone-500">
                  أدخل اسم المستفيد (أو مجموعة المستفيدين) واضغط على «حفظ في
                  الأرشيف» لحفظ الشهادة بسجل مستقل ذي معرف ثابت.
                </p>
              </div>
            ) : filteredArchiveRecords.length === 0 ? (
              <div
                data-testid="certificates-archive-no-matches"
                className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs font-bold text-stone-600"
              >
                لا توجد سجلات مطابقة لعبارة البحث أو التصفية المحددة.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredArchiveRecords.map((rec) => {
                  const isCurrent = activeArchivedRecordId === rec.id;
                  const p = rec.payload;
                  const typeLabel = getCertificateTypeArabicLabel(
                    p?.certificateType || 'appreciation'
                  );
                  const subtypeLabel = getCertificateSubtypeArabicLabel({
                    certificateType: p?.certificateType || 'appreciation',
                    appreciationRole: p?.appreciationRole || 'teacher',
                    excellenceVariant:
                      p?.excellenceVariant || 'school-administration',
                  });
                  const validBeneficiaries =
                    extractValidCertificateBeneficiaryNames(
                      p?.beneficiariesInput || ''
                    );

                  return (
                    <div
                      key={rec.id}
                      data-testid={`certificate-archive-record-card-${rec.id}`}
                      className={`rounded-xl border p-3.5 bg-white flex flex-col justify-between gap-3 transition-all ${
                        isCurrent
                          ? 'border-2 border-[#376B70] shadow-xs'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-extrabold text-xs sm:text-sm text-stone-900 line-clamp-1">
                            {rec.title}
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#EAF2F1] text-[#376B70] border border-[#C4D8D6] text-[11px] font-bold">
                            {typeLabel}
                          </span>
                        </div>
                        {rec.summary && (
                          <div className="text-xs text-stone-600 line-clamp-1">
                            {rec.summary}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                          <span>المعرف: {rec.id}</span>
                          <span>{subtypeLabel}</span>
                          <span>
                            المستفيدون: {validBeneficiaries.length || 1}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          data-testid={`open-certificate-archive-record-${rec.id}`}
                          onClick={() => handleOpenArchivedRecord(rec.id)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#EAF2F1] hover:bg-[#DCE9E8] text-[#376B70] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={exportingRecordId === rec.id}
                          data-testid={`export-certificate-archive-record-pdf-${rec.id}`}
                          onClick={() => handleExportArchivedRecordPdf(rec)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <FileDown
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          <span>
                            {exportingRecordId === rec.id
                              ? 'جاري...'
                              : 'تصدير PDF'}
                          </span>
                        </button>

                        <button
                          type="button"
                          data-testid={`delete-certificate-archive-record-${rec.id}`}
                          onClick={() => handleRequestDeleteArchivedRecord(rec)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
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

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#376B70]">
            <span>قسم المعلم · المجموعة السابعة</span>
            <span aria-hidden="true">·</span>
            <span>إصدار الشهادات المدرسية الفردية والجماعية (A4 أفقي)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
            الشهادات
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            تصميم وإصدار شهادات الشكر والتقدير، وشهادات التفوق، وشهادات التخرج
            باللغتين العربية والإنجليزية، مع معاينة حية وتصدير PDF عالي الجودة.
          </p>
        </div>

        {/* لافتة إيقاف التحرير عند التباين أو فشل المزامنة */}
        {isEditingLockedBySyncIssue && (
          <div
            role="alert"
            data-testid="certificate-sync-guard-banner"
            className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 sm:p-5 space-y-3 text-red-950"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-red-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1.5 text-xs sm:text-sm min-w-0">
                <div className="font-extrabold text-red-900">
                  {dualStoreDivergence?.diverged
                    ? 'تم اكتشاف اختلاف بين مخزن أرشيف الشهادات الموحد والمفتاح التوافقي القديم — تم إيقاف التحرير لحماية بياناتك'
                    : 'تعذر إتمام مزامنة التخزين المحلي — تم إيقاف التحرير حتى التأكد من تطابق البيانات'}
                </div>
                <p className="leading-relaxed text-red-900">
                  {dualStoreDivergence?.diverged
                    ? dualStoreDivergence.message
                    : syncFailureLock?.message}
                </p>
              </div>
            </div>

            {dualStoreDivergence?.diverged ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-red-200 bg-white px-3.5 py-2.5">
                    <div className="font-bold text-stone-700">
                      نسخة مخزن الأرشيف الموحد:
                    </div>
                    <div className="font-extrabold text-stone-900 truncate mt-0.5">
                      {dualStoreDivergence.archiveTitle || 'مسودة شهادة'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-white px-3.5 py-2.5">
                    <div className="font-bold text-stone-700">
                      نسخة المفتاح التوافقي القديم:
                    </div>
                    <div className="font-extrabold text-stone-900 truncate mt-0.5">
                      {dualStoreDivergence.legacyTitle || 'غير متوفر'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isResolvingSyncIssue}
                    data-testid="resolve-cert-divergence-keep-archive-btn"
                    onClick={() =>
                      handleResolveDualStoreDivergence('keep-archive')
                    }
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#376B70] hover:bg-[#315E62] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                  >
                    اعتماد نسخة مخزن الأرشيف ومزامنتها
                  </button>
                  {dualStoreDivergence.legacyData && (
                    <button
                      type="button"
                      disabled={isResolvingSyncIssue}
                      data-testid="resolve-cert-divergence-keep-legacy-btn"
                      onClick={() =>
                        handleResolveDualStoreDivergence('keep-legacy')
                      }
                      className="min-h-[40px] px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-900 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      اعتماد نسخة المفتاح التوافقي القديم ومزامنتها
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isResolvingSyncIssue}
                  data-testid="retry-cert-sync-after-failure-btn"
                  onClick={handleRetrySyncAfterFailure}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>إعادة فحص وتطابق المخزنين واستئناف التحرير</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* رسائل الحالة والتحقق */}
        {statusBanner && (
          <div
            data-testid="cert-status-banner"
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 ${
              statusBanner.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-[#EAF2F1] border-[#C4D8D6] text-[#284D50]'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                statusBanner.type === 'error'
                  ? 'text-red-600'
                  : 'text-[#376B70]'
              }`}
            />
            <span>{statusBanner.text}</span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div
            role="alert"
            data-testid="cert-validation-errors-box"
            className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2 text-red-900"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold">
              <AlertTriangle
                className="w-4 h-4 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>متطلبات الحفظ في الأرشيف:</span>
            </div>
            <ul className="list-disc pr-5 space-y-1 text-xs font-semibold">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* مساحة العمل الرئيسية: الإعداد والتحرير + المعاينة المباشرة */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* عمود الإعداد والتحرير */}
        <fieldset
          disabled={isEditingLockedBySyncIssue}
          className={`xl:col-span-7 space-y-5 min-w-0 border-0 p-0 m-0 ${
            mobileTab === 'preview' ? 'hidden xl:block' : 'block'
          } ${isEditingLockedBySyncIssue ? 'opacity-65 pointer-events-none' : ''}`}
        >
          {/* الخطوة ١: نوع الشهادة والفئة واللغة */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ١. نوع الشهادة والفئة واللغة
              </h3>
            </div>

            {/* اختيار نوع الشهادة */}
            <div className="space-y-2">
              <span className="block text-xs sm:text-sm font-extrabold text-stone-800">
                نوع الشهادة:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    {
                      id: 'appreciation' as CertificateCategoryType,
                      label: 'شهادة شكر وتقدير',
                      icon: <Award className="w-4 h-4 shrink-0" />,
                    },
                    {
                      id: 'excellence' as CertificateCategoryType,
                      label: 'شهادة تفوق',
                      icon: <Sparkles className="w-4 h-4 shrink-0" />,
                    },
                    {
                      id: 'graduation' as CertificateCategoryType,
                      label: 'شهادة تخرج',
                      icon: <GraduationCap className="w-4 h-4 shrink-0" />,
                    },
                  ] as const
                ).map((item) => {
                  const isSelected = formState.certificateType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`cert-type-${item.id}`}
                      onClick={() =>
                        applyConfigurationAndRefreshDefaults({
                          certificateType: item.id,
                        })
                      }
                      className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                          : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* الفئة الفرعية لنوع شهادة شكر وتقدير */}
            {formState.certificateType === 'appreciation' && (
              <div
                className="space-y-2"
                data-testid="cert-appreciation-role-box"
              >
                <span className="block text-xs sm:text-sm font-extrabold text-stone-800">
                  الفئة المستفيدة:
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'teacher' as AppreciationTargetRole,
                        label: 'معلم',
                      },
                      { id: 'admin' as AppreciationTargetRole, label: 'إداري' },
                      {
                        id: 'student' as AppreciationTargetRole,
                        label: 'طالب',
                      },
                    ] as const
                  ).map((role) => {
                    const isSelected = formState.appreciationRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        data-testid={`cert-appreciation-role-${role.id}`}
                        onClick={() =>
                          applyConfigurationAndRefreshDefaults({
                            appreciationRole: role.id,
                          })
                        }
                        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                        }`}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* النسخة الفرعية لنوع شهادة تفوق */}
            {formState.certificateType === 'excellence' && (
              <div
                className="space-y-2"
                data-testid="cert-excellence-variant-box"
              >
                <span className="block text-xs sm:text-sm font-extrabold text-stone-800">
                  نسخة شهادة التفوق:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        id: 'school-administration' as ExcellenceSourceVariant,
                        label: 'شهادة تفوق من إدارة المدرسة',
                      },
                      {
                        id: 'teacher' as ExcellenceSourceVariant,
                        label: 'شهادة تفوق مقدمة من المعلم أو المعلمة',
                      },
                    ] as const
                  ).map((variant) => {
                    const isSelected =
                      formState.excellenceVariant === variant.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        data-testid={`cert-excellence-variant-${variant.id}`}
                        onClick={() =>
                          applyConfigurationAndRefreshDefaults({
                            excellenceVariant: variant.id,
                          })
                        }
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                        }`}
                      >
                        {variant.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* جنس المستفيد + لغة الشهادة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <span className="block text-xs sm:text-sm font-extrabold text-stone-800">
                  صياغة المخاطب (جنس المستفيد):
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="cert-recipient-gender-male"
                    onClick={() =>
                      applyConfigurationAndRefreshDefaults({
                        recipientGender: 'male',
                      })
                    }
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                      formState.recipientGender === 'male'
                        ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                    }`}
                  >
                    مذكر (طالب / معلم)
                  </button>
                  <button
                    type="button"
                    data-testid="cert-recipient-gender-female"
                    onClick={() =>
                      applyConfigurationAndRefreshDefaults({
                        recipientGender: 'female',
                      })
                    }
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                      formState.recipientGender === 'female'
                        ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                    }`}
                  >
                    مؤنث (طالبة / معلمة)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs sm:text-sm font-extrabold text-stone-800 inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#376B70]" />
                  <span>لغة الشهادة:</span>
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'ar' as CertificateLanguage, label: 'العربية' },
                      { id: 'en' as CertificateLanguage, label: 'الإنجليزية' },
                    ] as const
                  ).map((lang) => {
                    const isSelected = formState.language === lang.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        data-testid={`cert-lang-${lang.id}`}
                        onClick={() =>
                          applyConfigurationAndRefreshDefaults({
                            language: lang.id,
                          })
                        }
                        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* الخطوة ٢: اختيار القالب (قالب 1، قالب 2، قالب 3) ونظام الألوان (1، 2، 3، 4) */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ٢. القالب ونظام الألوان
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* القوالب بأرقام فقط: قالب 1، قالب 2، قالب 3 */}
              <div className="space-y-2">
                <span className="text-xs sm:text-sm font-extrabold text-stone-800 inline-flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#376B70]" />
                  <span>القالب:</span>
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {CERTIFICATE_TEMPLATES.map((tpl) => {
                    const isSelected = formState.templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        data-testid={`cert-template-${tpl.id}`}
                        onClick={() =>
                          updateFormState((prev) => ({
                            ...prev,
                            templateId: tpl.id as CertificateTemplateId,
                          }))
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold border transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                            : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                        }`}
                      >
                        {tpl.uiLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* أنظمة الألوان بأرقام فقط: 1، 2، 3، 4 */}
              <div className="space-y-2">
                <span className="text-xs sm:text-sm font-extrabold text-stone-800 inline-flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-[#376B70]" />
                  <span>نظام الألوان:</span>
                </span>
                <div className="grid grid-cols-4 gap-2.5">
                  {(['1', '2', '3', '4'] as CertificateColorSystemId[]).map(
                    (colId) => {
                      const pal = CERTIFICATE_COLOR_SYSTEMS[colId];
                      const isSelected = formState.colorSystemId === colId;
                      return (
                        <button
                          key={colId}
                          type="button"
                          data-testid={`cert-color-${colId}`}
                          onClick={() =>
                            updateFormState((prev) => ({
                              ...prev,
                              colorSystemId: colId,
                            }))
                          }
                          className={`min-h-[44px] px-2.5 py-2 rounded-xl text-sm font-extrabold border inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
                            isSelected
                              ? 'bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] text-white border-[#376B70]'
                              : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-[#EAF2F1] hover:text-[#376B70] hover:border-[#C4D8D6]'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                            style={{ backgroundColor: pal.primaryHex }}
                          />
                          <span>{pal.uiLabel}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* الخطوة ٣: الحقول السياقية المستقلة (الصف الدراسي / المرحلة والعام الدراسي) */}
          {(formState.certificateType === 'graduation' ||
            (formState.certificateType === 'excellence' &&
              formState.excellenceVariant === 'school-administration')) && (
            <div
              data-testid="cert-contextual-fields-card"
              className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4"
            >
              <div className="border-b border-stone-100 pb-3">
                <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                  بيانات الصف أو المرحلة الدراسية
                </h3>
              </div>

              {formState.certificateType === 'excellence' &&
                formState.excellenceVariant === 'school-administration' && (
                  <div>
                    <label
                      htmlFor="cert-grade-input"
                      className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                    >
                      الصف الدراسي
                    </label>
                    <input
                      id="cert-grade-input"
                      data-testid="cert-grade-input"
                      type="text"
                      value={formState.gradeName}
                      onChange={(e) =>
                        updateFormState((prev) => ({
                          ...prev,
                          gradeName: e.target.value,
                        }))
                      }
                      placeholder="مثال: الأول الثانوي / الثالث المتوسط"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                    />
                  </div>
                )}

              {formState.certificateType === 'graduation' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cert-stage-input"
                      className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                    >
                      المرحلة الدراسية
                    </label>
                    <input
                      id="cert-stage-input"
                      data-testid="cert-stage-input"
                      type="text"
                      value={formState.academicStage}
                      onChange={(e) =>
                        handleStageOrYearChange('academicStage', e.target.value)
                      }
                      placeholder="مثال: الثانوية / المتوسطة"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cert-year-input"
                      className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                    >
                      العام الدراسي
                    </label>
                    <input
                      id="cert-year-input"
                      data-testid="cert-year-input"
                      type="text"
                      value={formState.academicYear}
                      onChange={(e) =>
                        handleStageOrYearChange('academicYear', e.target.value)
                      }
                      placeholder="مثال: ٢٠٢٦م / ١٤٤٧هـ"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* الخطوة ٤: تحرير الأقسام النصية الأربعة المستقلة وإدخال المستفيدين */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                  ٣. نصوص الشهادة وإدخال المستفيدين
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  جميع الحقول الأربعة قابلة للتحرير الكامل وتنعكس مباشرة على
                  المعاينة
                </p>
              </div>

              <button
                type="button"
                data-testid="cert-load-batch-sample-btn"
                onClick={handleLoadBatchSample}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#EAF2F1] hover:bg-[#DCE9E8] border border-[#C4D8D6] text-[#376B70] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>تجربة إدخال عدة مستفيدين</span>
              </button>
            </div>

            {/* عنوان الشهادة */}
            <div>
              <label
                htmlFor="cert-title-input"
                className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
              >
                عنوان الشهادة
              </label>
              <input
                id="cert-title-input"
                data-testid="cert-title-input"
                type="text"
                dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                value={formState.certificateTitle}
                onChange={(e) =>
                  updateFormState((prev) => ({
                    ...prev,
                    certificateTitle: e.target.value,
                  }))
                }
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-900 focus:outline-none focus:border-[#376B70]"
              />
            </div>

            {/* القسم النصي ١: النص الافتتاحي */}
            <div>
              <label
                htmlFor="cert-opening-text"
                className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
              >
                ١. النص الافتتاحي
              </label>
              <textarea
                id="cert-opening-text"
                data-testid="cert-opening-text"
                rows={2}
                dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                value={formState.openingText}
                onChange={(e) =>
                  updateFormState((prev) => ({
                    ...prev,
                    openingText: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#376B70]"
              />
            </div>

            {/* القسم النصي ٢: اسم المستفيد (أو عدة مستفيدين سطراً بسطر) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="cert-beneficiaries-input"
                  className="text-xs sm:text-sm font-extrabold text-stone-800"
                >
                  ٢. اسم المستفيد (أدخل اسماً واحداً أو عدة أسماء كل اسم في سطر
                  مستقل)
                </label>
                <span
                  data-testid="cert-beneficiaries-count"
                  className="text-xs font-bold text-[#376B70] tabular-nums"
                >
                  عدد الشهادات المستقلة: {beneficiaryNames.length}
                </span>
              </div>
              <textarea
                id="cert-beneficiaries-input"
                data-testid="cert-beneficiaries-input"
                rows={3}
                dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                value={formState.beneficiariesInput}
                onChange={(e) =>
                  updateFormState((prev) => ({
                    ...prev,
                    beneficiariesInput: e.target.value,
                  }))
                }
                placeholder={
                  formState.language === 'en'
                    ? 'Enter one beneficiary name per line...'
                    : 'أدخل اسم المستفيد (أو عدة مستفيدين، كل مستفيد في سطر مستقل)...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-900 leading-relaxed focus:outline-none focus:border-[#376B70]"
              />
            </div>

            {/* القسم النصي ٣: النص الرئيسي بعد الاسم */}
            <div>
              <label
                htmlFor="cert-main-text"
                className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
              >
                ٣. النص الرئيسي بعد الاسم
              </label>
              <textarea
                id="cert-main-text"
                data-testid="cert-main-text"
                rows={4}
                dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                value={formState.mainText}
                onChange={(e) =>
                  updateFormState((prev) => ({
                    ...prev,
                    mainText: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#376B70]"
              />
            </div>

            {/* القسم النصي ٤: نص إضافي اختياري */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="cert-additional-text"
                  className="text-xs sm:text-sm font-extrabold text-stone-800"
                >
                  ٤. نص إضافي اختياري (يُخفى تلقائياً عند تركه فارغاً)
                </label>
                {formState.additionalText && (
                  <button
                    type="button"
                    data-testid="cert-clear-additional-text-btn"
                    onClick={() =>
                      updateFormState((prev) => ({
                        ...prev,
                        additionalText: '',
                      }))
                    }
                    className="text-xs font-bold text-red-700 hover:underline cursor-pointer"
                  >
                    حذف النص الإضافي
                  </button>
                )}
              </div>
              <textarea
                id="cert-additional-text"
                data-testid="cert-additional-text"
                rows={2}
                dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                value={formState.additionalText}
                onChange={(e) =>
                  updateFormState((prev) => ({
                    ...prev,
                    additionalText: e.target.value,
                  }))
                }
                placeholder={
                  formState.language === 'en'
                    ? 'Optional additional closing text (leave blank to hide completely)...'
                    : 'نص إضافي اختياري (إذا تُرك فارغاً لا يظهر أي فراغ أو عنوان له)...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#376B70]"
              />
            </div>
          </div>

          {/* الخطوة ٥: بيانات الترويسة والتوقيعات الاختيارية */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ٤. بيانات الترويسة والتوقيعات (اختيارية)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                إذا تُرك أحد التوقيعات فارغاً تُخفى تسميته وخطوطه تلقائياً. وإذا
                كان مقدم الشهادة هو مدير المدرسة لا يتكرر الاسم مرتين.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cert-dept-input"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  الإدارة التعليمية
                </label>
                <input
                  id="cert-dept-input"
                  data-testid="cert-dept-input"
                  type="text"
                  dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                  value={formState.educationDepartment}
                  onChange={(e) =>
                    updateFormState((prev) => ({
                      ...prev,
                      educationDepartment: e.target.value,
                    }))
                  }
                  placeholder="الإدارة العامة للتعليم بمنطقة .........."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                />
              </div>

              <div>
                <label
                  htmlFor="cert-school-input"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  اسم المدرسة
                </label>
                <input
                  id="cert-school-input"
                  data-testid="cert-school-input"
                  type="text"
                  dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                  value={formState.schoolName}
                  onChange={(e) => handleSchoolNameChange(e.target.value)}
                  placeholder="اسم المدرسة..."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-4">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-bold text-stone-800">
                <input
                  type="checkbox"
                  data-testid="cert-presenter-is-principal-checkbox"
                  checked={formState.isPresenterSameAsPrincipal}
                  onChange={(e) =>
                    updateFormState((prev) => ({
                      ...prev,
                      isPresenterSameAsPrincipal: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-stone-300 text-[#376B70] focus:ring-[#376B70]"
                />
                <span>
                  مقدم الشهادة هو مدير المدرسة (عدم تكرار توقيع المدير مرتين)
                </span>
              </label>

              {!formState.isPresenterSameAsPrincipal && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cert-presenter-title-input"
                      className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                    >
                      مسمى مقدم الشهادة (اختياري)
                    </label>
                    <input
                      id="cert-presenter-title-input"
                      data-testid="cert-presenter-title-input"
                      type="text"
                      dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                      value={formState.presenterTitle}
                      onChange={(e) =>
                        updateFormState((prev) => ({
                          ...prev,
                          presenterTitle: e.target.value,
                        }))
                      }
                      placeholder={
                        formState.language === 'en'
                          ? 'e.g. Subject Teacher / Student Advisor'
                          : 'مثال: معلم المادة / الموجه الطلابي'
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="cert-presenter-name-input"
                        className="text-xs sm:text-sm font-extrabold text-stone-800"
                      >
                        اسم مقدم الشهادة (اختياري)
                      </label>
                      <button
                        type="button"
                        data-testid="cert-fill-presenter-from-settings-btn"
                        onClick={handleFillPresenterFromSettings}
                        className="text-xs font-bold text-[#376B70] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserCheck
                          className="w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>إدراج اسمي من الإعدادات</span>
                      </button>
                    </div>
                    <input
                      id="cert-presenter-name-input"
                      data-testid="cert-presenter-name-input"
                      type="text"
                      dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                      value={formState.presenterName}
                      onChange={(e) =>
                        updateFormState((prev) => ({
                          ...prev,
                          presenterName: e.target.value,
                        }))
                      }
                      placeholder={
                        formState.language === 'en'
                          ? 'Leave empty to hide presenter signature'
                          : 'اتركه فارغاً لإخفاء توقيع مقدم الشهادة'
                      }
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="cert-principal-title-input"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    مسمى مدير / مديرة المدرسة
                  </label>
                  <input
                    id="cert-principal-title-input"
                    data-testid="cert-principal-title-input"
                    type="text"
                    dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                    value={formState.principalTitle}
                    onChange={(e) =>
                      updateFormState((prev) => ({
                        ...prev,
                        principalTitle: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cert-principal-name-input"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    اسم مدير / مديرة المدرسة (اختياري)
                  </label>
                  <input
                    id="cert-principal-name-input"
                    data-testid="cert-principal-name-input"
                    type="text"
                    dir={formState.language === 'en' ? 'ltr' : 'rtl'}
                    value={formState.principalName}
                    onChange={(e) =>
                      updateFormState((prev) => ({
                        ...prev,
                        principalName: e.target.value,
                      }))
                    }
                    placeholder={
                      formState.language === 'en'
                        ? 'Leave empty to hide principal signature'
                        : 'اتركه فارغاً لإخفاء توقيع مدير المدرسة'
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#376B70]"
                  />
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* عمود المعاينة المباشرة (A4 أفقي) */}
        <div
          className={`xl:col-span-5 xl:sticky xl:top-6 space-y-4 ${
            mobileTab === 'edit' ? 'hidden xl:block' : 'block'
          }`}
        >
          <div className="bg-white rounded-2xl border border-[#C4D8D6] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                  معاينة الشهادة المباشرة (A4 أفقي)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                  قالب {formState.templateId} · نظام الألوان{' '}
                  {formState.colorSystemId} ·{' '}
                  {formState.language === 'en' ? 'LTR' : 'RTL'}
                </p>
              </div>

              {renderedPages.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="cert-prev-page-btn"
                    disabled={activePageIndex === 0}
                    onClick={() =>
                      setActivePageIndex((prev) => Math.max(0, prev - 1))
                    }
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#EAF2F1] hover:bg-[#DCE9E8] disabled:opacity-40 text-[#376B70] cursor-pointer"
                    aria-label="المستفيد السابق"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span
                    data-testid="cert-page-indicator"
                    className="text-xs font-extrabold text-[#376B70] px-2 tabular-nums"
                  >
                    {activePageIndex + 1} / {renderedPages.length}
                  </span>
                  <button
                    type="button"
                    data-testid="cert-next-page-btn"
                    disabled={activePageIndex >= renderedPages.length - 1}
                    onClick={() =>
                      setActivePageIndex((prev) =>
                        Math.min(renderedPages.length - 1, prev + 1)
                      )
                    }
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#EAF2F1] hover:bg-[#DCE9E8] disabled:opacity-40 text-[#376B70] cursor-pointer"
                    aria-label="المستفيد التالي"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* لوحة عرض صفحة A4 الأفقية */}
            <div className="bg-stone-100 rounded-xl p-3 sm:p-4 border border-stone-200/80 flex items-center justify-center">
              {currentPagePreview && currentPagePreview.dataUrl ? (
                <img
                  src={currentPagePreview.dataUrl}
                  alt={`معاينة شهادة ${currentPagePreview.beneficiaryDisplay}`}
                  data-testid="certificate-live-preview-img"
                  className="w-full h-auto aspect-[2380/1684] rounded-lg shadow-sm border border-stone-200 bg-white select-none object-contain"
                />
              ) : (
                <div className="aspect-[2380/1684] w-full bg-white rounded-lg border border-stone-200 flex items-center justify-center text-xs text-stone-400">
                  جاري تجهيز المعاينة...
                </div>
              )}
            </div>

            {/* أزرار التصدير الفردي والجماعي */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                data-testid="cert-preview-export-all-btn"
                disabled={isExporting}
                onClick={handleExportAllPdf}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#376B70] hover:bg-[#315E62] active:bg-[#284D50] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4 shrink-0" />
                <span>
                  {beneficiaryNames.length > 1
                    ? `تصدير جميع الشهادات (${beneficiaryNames.length}) في ملف PDF واحد`
                    : 'تصدير الشهادة بصيغة PDF (A4)'}
                </span>
              </button>

              {beneficiaryNames.length > 1 && (
                <button
                  type="button"
                  data-testid="cert-preview-export-single-btn"
                  disabled={isExporting}
                  onClick={handleExportSingleCurrentPdf}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#EAF2F1] hover:bg-[#DCE9E8] active:bg-[#C4D8D6] border border-[#C4D8D6] text-[#376B70] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  <span>
                    تصدير شهادة المستفيد المعروض حالياً فقط (#
                    {activePageIndex + 1})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
