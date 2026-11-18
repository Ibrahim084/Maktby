import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  BookmarkCheck,
  Camera,
  CheckCircle2,
  Eye,
  FileDown,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Lightbulb,
  Link2,
  Palette,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  User,
  Users,
  Wand2,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../../types';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';
import { RecordDeletionImpact } from '../../utils/teacherArchiveEngine';
import {
  bytesToDataUrl,
  getDefaultTeacherMediaRepository,
  saveMediaBytes,
  saveMediaDataUrl,
  UnifiedMediaRef,
} from '../../utils/teacherMediaStorage';
import {
  abandonActiveDraftAndCreateNewProgramActivity,
  cleanupUnreferencedProgramActivityBlobs,
  computeProgramActivityDraftSignature,
  createNewBlankProgramActivityInArchive,
  deleteArchivedProgramActivityRecordSafely,
  filterProgramActivityArchiveRecords,
  getTeacherProgramActivityRecordTitle,
  hasMeaningfulProgramActivityDraftData,
  inspectArchivedProgramActivityDeletionImpact,
  inspectProgramActivityDualStoreConsistency,
  listSavedProgramsAndActivities,
  loadActiveProgramActivityDraftWithMedia,
  loadArchivedProgramActivityWithMedia,
  loadProgramsActivitiesArchiveStore,
  migrateProgramsAndActivitiesToArchive,
  ProgramActivityDualStoreDivergenceInfo,
  ProgramActivityDualStoreSyncError,
  resolveProgramActivityDualStoreDivergence,
  saveActiveProgramActivityDraftWithMedia,
  saveDraftToArchiveAndCreateNewProgramActivity,
  saveProgramActivityToArchive,
  syncActiveProgramActivityDraftToBothStores,
  TeacherProgramActivityArchiveRecord,
} from '../../utils/teacherProgramsAndActivitiesArchive';
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
import {
  buildTeacherEducationalInitiativeDocument,
  createInitialEducationalInitiativeState,
  createSampleEducationalInitiativeState,
  doesBeneficiariesRequireGrades,
  EducationalInitiativeFormState,
  INITIATIVE_BENEFICIARIES_OPTIONS,
  INITIATIVE_EXECUTION_NATURE_OPTIONS,
  INITIATIVE_SCOPE_OPTIONS,
  INITIATIVE_TYPE_OPTIONS,
  InitiativeBeneficiariesOption,
  InitiativeExecutionNatureOption,
  InitiativeScopeOption,
  InitiativeTypeOption,
  isValidElectronicUrl,
  loadEducationalInitiativeDraft,
  TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG,
  TeacherProgramsAndActivitiesFormId,
  validateEducationalInitiativeState,
} from '../../utils/teacherProgramsAndActivitiesEngine';

interface TeacherProgramsAndActivitiesFormProps {
  formId: TeacherProgramsAndActivitiesFormId;
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

export const TeacherProgramsAndActivitiesForm: React.FC<
  TeacherProgramsAndActivitiesFormProps
> = ({ formId, onBackToGroup, onBackToTeacherHub }) => {
  const { settings, updateSettings } = useSettings();
  const modelMeta = useMemo(
    () =>
      TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG.find(
        (item) => item.id === formId
      ) || TEACHER_PROGRAMS_AND_ACTIVITIES_CATALOG[0],
    [formId]
  );

  const [formState, setFormState] = useState<EducationalInitiativeFormState>(
    () => loadEducationalInitiativeDraft(settings)
  );

  const [templateStyle, setTemplateStyle] = useState<TeacherPdfTemplateStyle>(
    settings.teacherPdfTemplate ?? 'waves'
  );
  const [colorSystem, setColorSystem] = useState<TeacherPdfColorSystem>(
    settings.teacherPdfColorSystem ?? 'green'
  );

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [renderedPages, setRenderedPages] = useState<
    TeacherPageJpegWithLinks[]
  >([]);
  const [isExporting, setIsExporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Unified Archive State (Group 6: educational-initiative-documentation)
  const [activeArchivedRecordId, setActiveArchivedRecordId] = useState<
    string | null
  >(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(
    undefined
  );
  const [savedRecords, setSavedRecords] = useState<
    TeacherProgramActivityArchiveRecord[]
  >(() => listSavedProgramsAndActivities(formId));
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveNatureFilter, setArchiveNatureFilter] = useState<
    InitiativeExecutionNatureOption | 'all'
  >('all');
  const [isSavingArchive, setIsSavingArchive] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    record: TeacherProgramActivityArchiveRecord;
    impact: RecordDeletionImpact;
  } | null>(null);
  const [pendingCreateNewDialog, setPendingCreateNewDialog] = useState<{
    trigger: 'create-new' | 'reset';
    step: 'choose' | 'confirm-abandon';
    draftTitle: string;
    photosCount: number;
    linksCount: number;
    sourceMode: 'active-draft' | 'stored-draft' | 'dirty-archived';
  } | null>(null);
  const [hasStoredUnsavedDraft, setHasStoredUnsavedDraft] = useState(false);
  const [dualStoreDivergence, setDualStoreDivergence] =
    useState<ProgramActivityDualStoreDivergenceInfo | null>(null);
  const [syncFailureLock, setSyncFailureLock] = useState<{
    message: string;
    rolledBackBoth: boolean;
    diverged: boolean;
  } | null>(null);
  const [isResolvingSyncIssue, setIsResolvingSyncIssue] = useState(false);

  const isEditingLockedBySyncIssue = Boolean(
    dualStoreDivergence?.diverged || syncFailureLock
  );

  const isMountedRef = useRef<boolean>(true);
  const isHydratingRef = useRef<boolean>(true);
  const syncBlockedRef = useRef<boolean>(false);
  const knownMediaRefsRef = useRef<Map<string, UnifiedMediaRef>>(new Map());
  const pendingUnpersistedBlobKeysRef = useRef<Set<string>>(new Set());
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const lastCommittedDraftRef = useRef<EducationalInitiativeFormState | null>(
    null
  );
  const draftGenerationRef = useRef<number>(0);
  const activeArchivedRecordIdRef = useRef<string | null>(
    activeArchivedRecordId
  );
  activeArchivedRecordIdRef.current = activeArchivedRecordId;
  const activeDraftIdRef = useRef<string | undefined>(activeDraftId);
  activeDraftIdRef.current = activeDraftId;
  const openedRecordBaselineJsonRef = useRef<string | null>(null);
  const latestDraftContextRef = useRef({
    formState,
    activeArchivedRecordId,
    activeDraftId,
    settings,
    formId,
  });
  latestDraftContextRef.current = {
    formState,
    activeArchivedRecordId,
    activeDraftId,
    settings,
    formId,
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {}
  );

  const cleanupPendingUnpersistedBlobs = async () => {
    if (pendingUnpersistedBlobKeysRef.current.size === 0) return;
    const keysToClean = Array.from(pendingUnpersistedBlobKeysRef.current);
    pendingUnpersistedBlobKeysRef.current.clear();
    try {
      await cleanupUnreferencedProgramActivityBlobs(keysToClean);
    } catch {
      // Best-effort orphan cleanup
    }
  };

  const restoreInMemoryDraftToLastCommitted = () => {
    const committed = lastCommittedDraftRef.current;
    if (!committed || !isMountedRef.current) return;
    isHydratingRef.current = true;
    setFormState(committed);
    setTimeout(() => {
      if (isMountedRef.current) {
        isHydratingRef.current = false;
      }
    }, 0);
  };

  const refreshSavedRecords = (
    targetFormId: TeacherProgramsAndActivitiesFormId = formId
  ) => {
    if (!isMountedRef.current) return;
    setSavedRecords(listSavedProgramsAndActivities(targetFormId));
    try {
      const store = loadProgramsActivitiesArchiveStore();
      const storedDraft = store.activeDraftByFormId?.[targetFormId];
      setHasStoredUnsavedDraft(
        Boolean(
          storedDraft &&
            hasMeaningfulProgramActivityDraftData(
              {
                ...storedDraft.payload,
                evidencePhotos: (storedDraft.mediaRefs || []).map((r) => ({
                  id: r.id,
                  imageDataUrl: r.blobKey,
                })),
              },
              settings
            )
        )
      );
    } catch {
      setHasStoredUnsavedDraft(false);
    }
  };

  const handleSyncOrRollbackFailure = (
    err: unknown,
    opts?: { fromUnmount?: boolean }
  ) => {
    syncBlockedRef.current = true;
    lastSyncedSignatureRef.current = null;
    void cleanupPendingUnpersistedBlobs();

    const isSyncErr = err instanceof ProgramActivityDualStoreSyncError;
    const diverged = isSyncErr ? err.diverged : false;
    const rolledBackBoth = isSyncErr ? err.rolledBackBoth : true;
    const errMsg =
      err instanceof Error && err.message
        ? err.message
        : 'تعذر مزامنة المسودة في التخزين المحلي؛ تم إيقاف المتابعة حمايةً للبيانات حتى تتم معالجة المشكلة.';

    if (opts?.fromUnmount || !isMountedRef.current) {
      return;
    }

    if (diverged) {
      try {
        const inspected = inspectProgramActivityDualStoreConsistency(
          latestDraftContextRef.current.settings
        );
        if (inspected.diverged) {
          setDualStoreDivergence(inspected);
        }
      } catch {
        // Ignore read issue while reporting failure
      }
    }

    if (rolledBackBoth && !diverged) {
      restoreInMemoryDraftToLastCommitted();
    }

    setSyncFailureLock({
      message: errMsg,
      rolledBackBoth,
      diverged,
    });
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
    if (ctx.formState.formId !== ctx.formId) return true;

    const currentRefs = Array.from(knownMediaRefsRef.current.values());
    const nextSignature = computeProgramActivityDraftSignature(
      ctx.formState,
      currentRefs,
      ctx.settings
    );

    // Prevent redundant identical writes when visibilitychange -> beforeunload -> pagehide -> unmount fire sequentially
    if (
      nextSignature === lastSyncedSignatureRef.current &&
      pendingUnpersistedBlobKeysRef.current.size === 0
    ) {
      return true;
    }

    try {
      const syncRes = syncActiveProgramActivityDraftToBothStores(
        ctx.formState,
        {
          draftId: activeDraftIdRef.current,
          knownMediaRefs: currentRefs,
          settings: ctx.settings,
        }
      );
      lastSyncedSignatureRef.current = nextSignature;
      lastCommittedDraftRef.current = ctx.formState;
      for (const r of syncRes.mediaRefs) {
        pendingUnpersistedBlobKeysRef.current.delete(r.blobKey);
      }
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
          hasMeaningfulProgramActivityDraftData(ctx.formState, ctx.settings)
        );
      }
      return true;
    } catch (err) {
      handleSyncOrRollbackFailure(err, { fromUnmount: opts?.fromUnmount });
      return false;
    }
  };

  // Run idempotent Group 6 migration once and hydrate active draft + IndexedDB photos
  useEffect(() => {
    let cancelled = false;
    isHydratingRef.current = true;
    draftGenerationRef.current += 1;
    setActiveArchivedRecordId(null);
    activeArchivedRecordIdRef.current = null;
    openedRecordBaselineJsonRef.current = null;
    setPendingDeleteTarget(null);
    setPendingCreateNewDialog(null);
    setDualStoreDivergence(null);
    setSyncFailureLock(null);
    syncBlockedRef.current = false;
    pendingUnpersistedBlobKeysRef.current.clear();
    setValidationErrors([]);
    setStatusBanner(null);
    setMediaNotice(null);
    setArchiveSearchQuery('');
    setArchiveNatureFilter('all');
    setActiveTab('edit');

    const initArchiveAndDraft = async () => {
      try {
        await migrateProgramsAndActivitiesToArchive({ settings });
        const hydrated = await loadActiveProgramActivityDraftWithMedia({
          settings,
        });
        if (cancelled || !isMountedRef.current) return;
        knownMediaRefsRef.current.clear();
        for (const ref of hydrated.mediaRefs) {
          knownMediaRefsRef.current.set(ref.id, ref);
        }
        activeDraftIdRef.current = hydrated.draftRecord?.id;
        setFormState(hydrated.formData);
        setActiveDraftId(hydrated.draftRecord?.id);
        lastCommittedDraftRef.current = hydrated.formData;
        lastSyncedSignatureRef.current = hydrated.divergence.diverged
          ? null
          : computeProgramActivityDraftSignature(
              hydrated.formData,
              hydrated.mediaRefs,
              settings
            );
        refreshSavedRecords(formId);

        if (hydrated.divergence.diverged) {
          syncBlockedRef.current = true;
          setDualStoreDivergence(hydrated.divergence);
          setStatusBanner({
            type: 'error',
            text: hydrated.divergence.message,
          });
        } else if (hydrated.integrityWarnings.length > 0) {
          setStatusBanner({
            type: 'error',
            text: hydrated.integrityWarnings[0],
          });
        }
      } catch {
        if (!cancelled && isMountedRef.current) {
          const fallback = loadEducationalInitiativeDraft(settings);
          setFormState(fallback);
          lastCommittedDraftRef.current = fallback;
          refreshSavedRecords(formId);
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

    initArchiveAndDraft();
    return () => {
      cancelled = true;
    };
  }, [formId]);

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

  // Persist active draft edits immediately (sync metadata + async media extraction only when photos change)
  useEffect(() => {
    if (isHydratingRef.current || syncBlockedRef.current) return;
    if (formState.formId !== formId) return;
    if (activeArchivedRecordId !== null) {
      // Edits to an open archived record commit on explicit "حفظ التعديلات في الأرشيف"
      return;
    }

    const myEpoch = ++draftGenerationRef.current;
    const syncedOk = flushActiveDraftSynchronously();
    if (!syncedOk) return;

    const hasUnextractedDataUrl = (formState.evidencePhotos || []).some((p) =>
      Boolean(p?.imageDataUrl?.startsWith('data:'))
    );
    const currentPhotoCount = (formState.evidencePhotos || []).length;
    const storedDraftRefs =
      loadProgramsActivitiesArchiveStore().activeDraftByFormId?.[formId]
        ?.mediaRefs ?? [];
    const mediaCountChanged = currentPhotoCount !== storedDraftRefs.length;

    if (!hasUnextractedDataUrl && !mediaCountChanged) {
      return;
    }

    let cancelled = false;
    const persistDraftMedia = async () => {
      try {
        const res = await saveActiveProgramActivityDraftWithMedia(formState, {
          draftId: activeDraftIdRef.current,
          settings,
          shouldCommit: () =>
            !cancelled &&
            isMountedRef.current &&
            !syncBlockedRef.current &&
            myEpoch === draftGenerationRef.current &&
            activeArchivedRecordIdRef.current === null,
        });
        if (cancelled || !isMountedRef.current || res.aborted) return;
        for (const ref of res.mediaRefs) {
          knownMediaRefsRef.current.set(ref.id, ref);
          pendingUnpersistedBlobKeysRef.current.delete(ref.blobKey);
        }
        lastCommittedDraftRef.current = formState;
        lastSyncedSignatureRef.current = computeProgramActivityDraftSignature(
          formState,
          res.mediaRefs,
          settings
        );
        if (
          res.draftRecord?.id &&
          res.draftRecord.id !== activeDraftIdRef.current
        ) {
          activeDraftIdRef.current = res.draftRecord.id;
          setActiveDraftId(res.draftRecord.id);
        }
      } catch (err) {
        if (cancelled || !isMountedRef.current) return;
        // Strict rule: NEVER fall back to legacy-only write!
        handleSyncOrRollbackFailure(err);
      }
    };

    void persistDraftMedia();
    return () => {
      cancelled = true;
    };
  }, [formId, formState, activeArchivedRecordId]);

  const reportDoc = useMemo(
    () =>
      buildTeacherEducationalInitiativeDocument(formState, settings, {
        templateStyle,
        colorSystem,
      }),
    [formState, settings, templateStyle, colorSystem]
  );

  const paginatedPages = useMemo(
    () => paginateTeacherReportBlocks(reportDoc, settings),
    [reportDoc, settings]
  );

  useEffect(() => {
    let cancelled = false;
    renderTeacherReportPagesToCanvases(reportDoc, settings).then((pages) => {
      if (!cancelled) {
        setRenderedPages(pages);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reportDoc, settings]);

  const updateState = (
    updater: (
      prev: EducationalInitiativeFormState
    ) => EducationalInitiativeFormState
  ) => {
    if (syncBlockedRef.current) return;
    setValidationErrors((prev) => (prev.length > 0 ? [] : prev));
    setFormState((prev) => updater(prev));
  };

  const handleSelectTemplate = (nextTemplate: TeacherPdfTemplateStyle) => {
    setTemplateStyle(nextTemplate);
    updateSettings({ ...settings, teacherPdfTemplate: nextTemplate });
  };

  const handleSelectColorSystem = (nextColor: TeacherPdfColorSystem) => {
    setColorSystem(nextColor);
    updateSettings({ ...settings, teacherPdfColorSystem: nextColor });
  };

  const handleLoadSample = (nature: InitiativeExecutionNatureOption) => {
    if (syncBlockedRef.current) return;
    const sample = createSampleEducationalInitiativeState(settings, {
      executionNature: nature,
    });
    setFormState(sample);
    setValidationErrors([]);
    setMediaNotice(null);
    setStatusBanner({
      type: 'info',
      text:
        nature === 'مبادرة فردية'
          ? 'تم تعبئة النموذج ببيانات نموذجية لمبادرة فردية جاهزة للمعاينة والتصدير أو الحفظ في الأرشيف.'
          : 'تم تعبئة النموذج ببيانات نموذجية لمبادرة جماعية جاهزة للمعاينة والتصدير أو الحفظ في الأرشيف.',
    });
  };

  const applyBlankDraftState = (
    blank: {
      draftRecord: TeacherProgramActivityArchiveRecord;
      formData: EducationalInitiativeFormState;
    },
    bannerText: string,
    bannerType: 'info' | 'success' = 'info'
  ) => {
    isHydratingRef.current = true;
    draftGenerationRef.current += 1;
    knownMediaRefsRef.current.clear();
    pendingUnpersistedBlobKeysRef.current.clear();
    openedRecordBaselineJsonRef.current = null;
    activeArchivedRecordIdRef.current = null;
    activeDraftIdRef.current = blank.draftRecord.id;
    lastCommittedDraftRef.current = blank.formData;
    lastSyncedSignatureRef.current = computeProgramActivityDraftSignature(
      blank.formData,
      [],
      settings
    );
    setActiveArchivedRecordId(null);
    setActiveDraftId(blank.draftRecord.id);
    setFormState(blank.formData);
    setValidationErrors([]);
    setMediaNotice(null);
    setPendingCreateNewDialog(null);
    setActiveTab('edit');
    refreshSavedRecords(formId);
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
      draftGenerationRef.current += 1;
      const resolved = await resolveProgramActivityDualStoreDivergence(choice, {
        settings,
      });
      if (!isMountedRef.current) return;
      knownMediaRefsRef.current.clear();
      for (const ref of resolved.mediaRefs) {
        knownMediaRefsRef.current.set(ref.id, ref);
      }
      pendingUnpersistedBlobKeysRef.current.clear();
      activeArchivedRecordIdRef.current = null;
      activeDraftIdRef.current = resolved.draftRecord.id;
      lastCommittedDraftRef.current = resolved.formData;
      lastSyncedSignatureRef.current = computeProgramActivityDraftSignature(
        resolved.formData,
        resolved.mediaRefs,
        settings
      );
      syncBlockedRef.current = false;
      setDualStoreDivergence(null);
      setSyncFailureLock(null);
      setActiveArchivedRecordId(null);
      setActiveDraftId(resolved.draftRecord.id);
      setFormState(resolved.formData);
      refreshSavedRecords(formId);
      setStatusBanner({
        type: 'success',
        text:
          choice === 'keep-archive'
            ? 'تم اعتماد نسخة مخزن الأرشيف الموحد ومزامنتها مع المفتاح التوافقي بنجاح.'
            : 'تم اعتماد نسخة المفتاح التوافقي القديم ومزامنتها مع مخزن الأرشيف الموحد بنجاح.',
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
      draftGenerationRef.current += 1;
      const loaded = await loadActiveProgramActivityDraftWithMedia({
        settings,
      });
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
      knownMediaRefsRef.current.clear();
      for (const ref of loaded.mediaRefs) {
        knownMediaRefsRef.current.set(ref.id, ref);
      }
      pendingUnpersistedBlobKeysRef.current.clear();
      activeArchivedRecordIdRef.current = null;
      activeDraftIdRef.current = loaded.draftRecord?.id;
      lastCommittedDraftRef.current = loaded.formData;
      lastSyncedSignatureRef.current = computeProgramActivityDraftSignature(
        loaded.formData,
        loaded.mediaRefs,
        settings
      );
      syncBlockedRef.current = false;
      setDualStoreDivergence(null);
      setSyncFailureLock(null);
      setActiveArchivedRecordId(null);
      setActiveDraftId(loaded.draftRecord?.id);
      setFormState(loaded.formData);
      refreshSavedRecords(formId);
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

  const handleResetForm = () => {
    if (syncBlockedRef.current) return;
    if (
      activeArchivedRecordId === null &&
      hasMeaningfulProgramActivityDraftData(formState, settings)
    ) {
      const ok = flushActiveDraftSynchronously();
      if (!ok) return;
      setPendingCreateNewDialog({
        trigger: 'reset',
        step: 'confirm-abandon',
        draftTitle: getTeacherProgramActivityRecordTitle(formState),
        photosCount: (formState.evidencePhotos || []).length,
        linksCount: (formState.evidenceLinks || []).filter((l) =>
          Boolean(l?.url?.trim())
        ).length,
        sourceMode: 'active-draft',
      });
      return;
    }

    try {
      const created = createNewBlankProgramActivityInArchive({ settings });
      applyBlankDraftState(
        created,
        'تمت إعادة تعيين الحقول إلى الوضع الافتراضي مع بقاء السجلات المحفوظة في الأرشيف دون تغيير.'
      );
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    }
  };

  const handleSaveToArchive = async () => {
    if (syncBlockedRef.current) return;
    const errors = validateEducationalInitiativeState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner({
        type: 'error',
        text: 'يرجى استكمال الحقول الأساسية المطلوبة قبل حفظ المبادرة في الأرشيف.',
      });
      return;
    }

    setValidationErrors([]);
    try {
      setIsSavingArchive(true);
      draftGenerationRef.current += 1;
      const wasUnsavedDraft = activeArchivedRecordId === null;
      const saved = await saveProgramActivityToArchive(formState, {
        recordId: activeArchivedRecordId ?? undefined,
        resetActiveDraftAfterSave: wasUnsavedDraft,
        settings,
      });
      if (!isMountedRef.current) return;

      for (const ref of saved.mediaRefs) {
        pendingUnpersistedBlobKeysRef.current.delete(ref.blobKey);
      }
      if (saved.newDraftRecord) {
        activeDraftIdRef.current = saved.newDraftRecord.id;
        setActiveDraftId(saved.newDraftRecord.id);
      }
      knownMediaRefsRef.current.clear();
      for (const ref of saved.mediaRefs) {
        knownMediaRefsRef.current.set(ref.id, ref);
      }
      openedRecordBaselineJsonRef.current = JSON.stringify(formState);
      activeArchivedRecordIdRef.current = saved.record.id;
      setActiveArchivedRecordId(saved.record.id);
      refreshSavedRecords(formId);
      setStatusBanner({
        type: 'success',
        text: saved.isNew
          ? `تم حفظ المبادرة سجلًا مستقلًا في الأرشيف بالمعرف الثابت (${saved.record.id}).`
          : `تم تحديث سجل المبادرة المحفوظ في الأرشيف مع الحفاظ على معرفه الثابت (${saved.record.id}).`,
      });
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    } finally {
      if (isMountedRef.current) {
        setIsSavingArchive(false);
      }
    }
  };

  const handleCreateNewRecord = () => {
    if (syncBlockedRef.current) return;
    if (activeArchivedRecordId === null) {
      if (hasMeaningfulProgramActivityDraftData(formState, settings)) {
        const ok = flushActiveDraftSynchronously();
        if (!ok) return;
        setPendingCreateNewDialog({
          trigger: 'create-new',
          step: 'choose',
          draftTitle: getTeacherProgramActivityRecordTitle(formState),
          photosCount: (formState.evidencePhotos || []).length,
          linksCount: (formState.evidenceLinks || []).filter((l) =>
            Boolean(l?.url?.trim())
          ).length,
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
          draftTitle: getTeacherProgramActivityRecordTitle(formState),
          photosCount: (formState.evidencePhotos || []).length,
          linksCount: (formState.evidenceLinks || []).filter((l) =>
            Boolean(l?.url?.trim())
          ).length,
          sourceMode: 'dirty-archived',
        });
        return;
      }

      const store = loadProgramsActivitiesArchiveStore();
      const storedDraft = store.activeDraftByFormId?.[formId];
      const storedDraftHasData = Boolean(
        storedDraft &&
          hasMeaningfulProgramActivityDraftData(
            {
              ...storedDraft.payload,
              evidencePhotos: (storedDraft.mediaRefs || []).map((r) => ({
                id: r.id,
                imageDataUrl: r.blobKey,
              })),
            },
            settings
          )
      );
      if (storedDraftHasData && storedDraft) {
        setPendingCreateNewDialog({
          trigger: 'create-new',
          step: 'choose',
          draftTitle: storedDraft.title || 'مسودة غير محفوظة',
          photosCount: (storedDraft.mediaRefs || []).length,
          linksCount: (storedDraft.payload?.evidenceLinks || []).filter((l) =>
            Boolean(l?.url?.trim())
          ).length,
          sourceMode: 'stored-draft',
        });
        return;
      }
    }

    try {
      const created = createNewBlankProgramActivityInArchive({ settings });
      applyBlankDraftState(
        created,
        'تم فتح مسودة مبادرة جديدة فارغة مع الإبقاء على جميع السجلات المحفوظة في الأرشيف دون تعديل.'
      );
    } catch (err) {
      handleSyncOrRollbackFailure(err);
    }
  };

  const handleGuardSaveAndCreateNew = async () => {
    if (!pendingCreateNewDialog || syncBlockedRef.current) return;
    try {
      setIsSavingArchive(true);
      draftGenerationRef.current += 1;
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
        const loadedDraft = await loadActiveProgramActivityDraftWithMedia({
          settings,
        });
        targetFormData = loadedDraft.formData;
        targetRecordId = undefined;
        expectedDraftId = loadedDraft.draftRecord?.id;
      }

      const res = await saveDraftToArchiveAndCreateNewProgramActivity(
        targetFormData,
        {
          recordId: targetRecordId,
          expectedDraftId,
          settings,
        }
      );
      if (!isMountedRef.current) return;

      if (!res.ok) {
        // Keep the unsaved draft 100% intact and highlight missing fields so the teacher can complete them
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
          text: 'تعذر حفظ المسودة في الأرشيف لعدم اكتمال الحقول المطلوبة؛ تم الإبقاء على مسودتك دون تغيير لاستكمال البيانات.',
        });
        return;
      }

      applyBlankDraftState(
        {
          draftRecord: res.newDraftRecord,
          formData: res.newFormData,
        },
        `تم حفظ المبادرة السابقة في الأرشيف بالمعرف الثابت (${res.savedRecord.id}) وفتح مسودة مبادرة جديدة فارغة بأمان.`,
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
      draftGenerationRef.current += 1;
      if (pendingCreateNewDialog.sourceMode === 'dirty-archived') {
        const created = createNewBlankProgramActivityInArchive({ settings });
        applyBlankDraftState(
          created,
          'تم تجاهل التعديلات غير المحفوظة على السجل المفتوح وفتح مسودة جديدة فارغة مع بقاء السجل المحفوظ كما هو في الأرشيف.'
        );
        return;
      }

      const abandoned = await abandonActiveDraftAndCreateNewProgramActivity({
        settings,
      });
      if (!isMountedRef.current) return;
      applyBlankDraftState(
        {
          draftRecord: abandoned.draftRecord,
          formData: abandoned.formData,
        },
        pendingCreateNewDialog.trigger === 'reset'
          ? 'تم تأكيد التخلي عن المسودة غير المحفوظة وإفراغ الحقول مع الحفاظ على السجلات المحفوظة ومرفقاتها المشتركة.'
          : 'تم التخلي عن المسودة غير المحفوظة وفتح مسودة مبادرة جديدة فارغة مع الحفاظ على جميع السجلات المحفوظة في الأرشيف.'
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

  const handleResumeUnsavedDraft = async () => {
    try {
      isHydratingRef.current = true;
      draftGenerationRef.current += 1;
      const hydrated = await loadActiveProgramActivityDraftWithMedia({
        settings,
      });
      if (!isMountedRef.current) return;
      knownMediaRefsRef.current.clear();
      for (const ref of hydrated.mediaRefs) {
        knownMediaRefsRef.current.set(ref.id, ref);
      }
      pendingUnpersistedBlobKeysRef.current.clear();
      openedRecordBaselineJsonRef.current = null;
      activeArchivedRecordIdRef.current = null;
      activeDraftIdRef.current = hydrated.draftRecord?.id;
      lastCommittedDraftRef.current = hydrated.formData;
      lastSyncedSignatureRef.current = hydrated.divergence.diverged
        ? null
        : computeProgramActivityDraftSignature(
            hydrated.formData,
            hydrated.mediaRefs,
            settings
          );
      setActiveArchivedRecordId(null);
      setActiveDraftId(hydrated.draftRecord?.id);
      setFormState(hydrated.formData);
      setValidationErrors([]);
      setMediaNotice(null);
      setActiveTab('edit');
      refreshSavedRecords(formId);
      if (hydrated.divergence.diverged) {
        syncBlockedRef.current = true;
        setDualStoreDivergence(hydrated.divergence);
        setStatusBanner({
          type: 'error',
          text: hydrated.divergence.message,
        });
      } else {
        setStatusBanner({
          type: 'info',
          text: 'تم استئناف المسودة غير المحفوظة قيد التحرير.',
        });
      }
    } finally {
      setTimeout(() => {
        if (isMountedRef.current) {
          isHydratingRef.current = false;
        }
      }, 0);
    }
  };

  const handleBackToGroupSafe = () => {
    flushActiveDraftSynchronously();
    onBackToGroup();
  };

  const handleBackToTeacherHubSafe = () => {
    flushActiveDraftSynchronously();
    onBackToTeacherHub();
  };

  const handleOpenArchivedRecord = async (
    record: TeacherProgramActivityArchiveRecord
  ) => {
    if (syncBlockedRef.current) return;
    try {
      flushActiveDraftSynchronously();
      isHydratingRef.current = true;
      draftGenerationRef.current += 1;
      const loaded = await loadArchivedProgramActivityWithMedia(record.id, {
        settings,
      });
      if (!isMountedRef.current) return;
      if (!loaded) {
        setStatusBanner({
          type: 'error',
          text: 'تعذر العثور على السجل المطلوب في أرشيف البرامج والأنشطة.',
        });
        return;
      }
      knownMediaRefsRef.current.clear();
      for (const ref of loaded.record.mediaRefs || []) {
        knownMediaRefsRef.current.set(ref.id, ref);
      }
      pendingUnpersistedBlobKeysRef.current.clear();
      openedRecordBaselineJsonRef.current = JSON.stringify(loaded.formData);
      activeArchivedRecordIdRef.current = loaded.record.id;
      setActiveArchivedRecordId(loaded.record.id);
      setFormState(loaded.formData);
      setValidationErrors([]);
      setMediaNotice(null);
      setActiveTab('edit');
      refreshSavedRecords(formId);
      setStatusBanner(
        loaded.integrityWarnings.length > 0
          ? {
              type: 'error',
              text: loaded.integrityWarnings[0],
            }
          : {
              type: 'info',
              text: `تم فتح السجل المحفوظ (${loaded.record.title}) للتعديل بالمعرف الثابت ${loaded.record.id}.`,
            }
      );
    } finally {
      setTimeout(() => {
        if (isMountedRef.current) {
          isHydratingRef.current = false;
        }
      }, 0);
    }
  };

  const handleRequestDeleteArchivedRecord = (
    record: TeacherProgramActivityArchiveRecord
  ) => {
    const impact = inspectArchivedProgramActivityDeletionImpact(record.id);
    setPendingDeleteTarget({ record, impact });
  };

  const handleConfirmDeleteArchivedRecord = async () => {
    if (!pendingDeleteTarget) return;
    const { record } = pendingDeleteTarget;
    const wasOpenInEditor = activeArchivedRecordId === record.id;
    const outcome = await deleteArchivedProgramActivityRecordSafely(record.id, {
      confirmUnlink: true,
      activeUiDraftMediaRefs:
        activeArchivedRecordId === null
          ? Array.from(knownMediaRefsRef.current.values())
          : undefined,
    });
    setPendingDeleteTarget(null);
    refreshSavedRecords(formId);
    if (wasOpenInEditor) {
      openedRecordBaselineJsonRef.current = null;
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
          ? `تم حذف السجل «${record.title}» من الأرشيف نهائيًا${unlinkedNote}${sharedNote} وأصبح المحتوى الذي لا يزال ظاهرًا في المحرر مسودة مستقلة غير محفوظة في الأرشيف، وليس السجل المحذوف؛ يمكنك حفظه كمبادرة جديدة أو الضغط على «إنشاء مبادرة جديدة» لتفريغ المحرر.`
          : `تم حذف السجل «${record.title}» من الأرشيف بأمان${unlinkedNote}${sharedNote}`,
      });
    }
  };

  const handleExportPdf = async () => {
    const errors = validateEducationalInitiativeState(formState);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setStatusBanner(null);
      return;
    }

    setValidationErrors([]);
    setIsExporting(true);
    try {
      const { pdfBytes, filename } = await generateTeacherReportPdf(
        reportDoc,
        settings
      );
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatusBanner({
        type: 'success',
        text: `تم تصدير ملف PDF بنجاح (${filename}).`,
      });
    } catch {
      setValidationErrors(['حدث خطأ غير متوقع أثناء توليد ملف PDF.']);
    } finally {
      setIsExporting(false);
    }
  };

  // ==========================================================================
  // إدارة المشاركين في المبادرة الجماعية
  // ==========================================================================

  const handleAddParticipant = () => {
    updateState((prev) => ({
      ...prev,
      participants: [
        ...(prev.participants || []),
        {
          id: `part-${Date.now()}-${(prev.participants || []).length + 1}`,
          name: '',
        },
      ],
    }));
  };

  const handleUpdateParticipantName = (index: number, nextName: string) => {
    updateState((prev) => ({
      ...prev,
      participants: (prev.participants || []).map((item, idx) =>
        idx === index ? { ...item, name: nextName } : item
      ),
    }));
  };

  const handleDeleteParticipantAt = (index: number) => {
    updateState((prev) => ({
      ...prev,
      participants: (prev.participants || []).filter((_, idx) => idx !== index),
    }));
  };

  // ==========================================================================
  // إدارة الشواهد المصورة (0..2)
  // ==========================================================================

  const handleUploadNewPhotos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || syncBlockedRef.current) return;

    try {
      const currentPhotos = formState.evidencePhotos || [];
      const remainingSlots = Math.max(0, 2 - currentPhotos.length);
      const filesToRead = files.slice(0, Math.max(1, remainingSlots));

      const repo = getDefaultTeacherMediaRepository();
      const savedResults = await Promise.all(
        filesToRead.map(async (file, idx) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const mimeType = file.type || 'image/png';
          const saved = await saveMediaBytes(
            {
              bytes,
              fileName: file.name || `${formState.formId}-evidence-image`,
              mimeType,
              sourceTag: 'upload',
            },
            repo
          );
          return {
            id: `init-photo-${Date.now()}-${idx + 1}`,
            dataUrl: bytesToDataUrl(bytes, mimeType),
            deduplicated: saved.deduplicated,
            mediaRef: saved.mediaRef,
          };
        })
      );

      for (const item of savedResults) {
        knownMediaRefsRef.current.set(item.id, {
          ...item.mediaRef,
          id: item.id,
        });
        if (!item.deduplicated) {
          pendingUnpersistedBlobKeysRef.current.add(item.mediaRef.blobKey);
        }
      }

      const nextPhotos: TeacherReportEvidencePhoto[] = [
        ...currentPhotos,
        ...savedResults.map((item) => ({
          id: item.id,
          imageDataUrl: item.dataUrl,
        })),
      ].slice(0, 2);

      updateState((prev) => ({
        ...prev,
        evidencePhotos: nextPhotos,
      }));
      const anyDeduplicated = savedResults.some((r) => r.deduplicated);
      setMediaNotice(
        anyDeduplicated
          ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
          : 'تم حفظ المرفق الثنائي والتحقق من بصمته (SHA-256 / CRC-32) في IndexedDB.'
      );
      setStatusBanner({
        type: 'success',
        text: 'تم إرفاق صورة الشاهد وحفظها في مستودع المرفقات بنجاح.',
      });
    } catch {
      setValidationErrors(['تعذر قراءة ملف الصورة المرفوعة أو حفظه في IndexedDB.']);
    } finally {
      e.target.value = '';
    }
  };

  const handleReplacePhotoAt = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || syncBlockedRef.current) return;

    try {
      const repo = getDefaultTeacherMediaRepository();
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const mimeType = file.type || 'image/png';
      const saved = await saveMediaBytes(
        {
          bytes,
          fileName: file.name || `${formState.formId}-evidence-image`,
          mimeType,
          sourceTag: 'upload',
        },
        repo
      );
      const dataUrl = bytesToDataUrl(bytes, mimeType);
      const replacedPhotoId = `init-photo-replaced-${Date.now()}-${index + 1}`;
      knownMediaRefsRef.current.set(replacedPhotoId, {
        ...saved.mediaRef,
        id: replacedPhotoId,
      });
      if (!saved.deduplicated) {
        pendingUnpersistedBlobKeysRef.current.add(saved.mediaRef.blobKey);
      }
      updateState((prev) => ({
        ...prev,
        evidencePhotos: (prev.evidencePhotos || []).map((photo, idx) =>
          idx === index
            ? {
                id: replacedPhotoId,
                imageDataUrl: dataUrl,
              }
            : photo
        ),
      }));
      setMediaNotice(
        saved.deduplicated
          ? 'تمت مطابقة بصمة SHA-256 واستخدام المرفق المحفوظ مسبقًا دون تكرار في IndexedDB.'
          : 'تم تحديث المرفق وحفظه في مستودع المرفقات مع بصمة SHA-256.'
      );
      setStatusBanner({
        type: 'success',
        text: `تم استبدال صورة الشاهد (${index + 1}) بنجاح.`,
      });
    } catch {
      setValidationErrors(['تعذر استبدال صورة الشاهد أو حفظها في IndexedDB.']);
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhotoAt = (index: number) => {
    if (syncBlockedRef.current) return;
    setMediaNotice(null);
    updateState((prev) => ({
      ...prev,
      evidencePhotos: (prev.evidencePhotos || []).filter(
        (_, idx) => idx !== index
      ),
    }));
    setStatusBanner({
      type: 'info',
      text: `تم حذف صورة الشاهد (${index + 1}).`,
    });
  };

  const handleLoadSamplePhotos = async () => {
    if (syncBlockedRef.current) return;
    try {
      const samplePhotos = createDefaultSampleEvidencePhotos(colorSystem);
      const chosen = [samplePhotos[0], samplePhotos[1]];
      const repo = getDefaultTeacherMediaRepository();
      const savedSamples = await Promise.all(
        chosen.map((p, idx) =>
          saveMediaDataUrl(
            {
              id: p.id,
              dataUrl: p.imageDataUrl,
              fileName: `${formId}-sample-evidence-${idx + 1}.svg`,
              sourceTag: 'sample',
            },
            repo
          )
        )
      );
      savedSamples.forEach((s, idx) => {
        knownMediaRefsRef.current.set(chosen[idx].id, {
          ...s.mediaRef,
          id: chosen[idx].id,
        });
        if (!s.deduplicated) {
          pendingUnpersistedBlobKeysRef.current.add(s.mediaRef.blobKey);
        }
      });
      updateState((prev) => ({
        ...prev,
        evidencePhotos: chosen,
      }));
      setMediaNotice('تم حفظ الصور التجريبية في مستودع المرفقات الموحد.');
      setStatusBanner({
        type: 'success',
        text: 'تم إدراج صورتين تجريبيتين في قسم الشواهد.',
      });
    } catch {
      setValidationErrors(['تعذر حفظ الصور التجريبية في مستودع المرفقات.']);
    }
  };

  // ==========================================================================
  // إدارة الروابط الإلكترونية ورموز QR (0..2)
  // ==========================================================================

  const handleAddLink = () => {
    const currentLinks = formState.evidenceLinks || [];
    if (currentLinks.length >= 2) return;
    const nextLinks: TeacherReportEvidenceLink[] = [
      ...currentLinks,
      {
        id: `init-link-${Date.now()}-${currentLinks.length + 1}`,
        url: '',
      },
    ];
    updateState((prev) => ({
      ...prev,
      evidenceLinks: nextLinks,
    }));
  };

  const handleUpdateLinkUrl = (index: number, nextUrl: string) => {
    updateState((prev) => ({
      ...prev,
      evidenceLinks: (prev.evidenceLinks || []).map((link, idx) =>
        idx === index ? { ...link, url: nextUrl } : link
      ),
    }));
  };

  const handleDeleteLinkAt = (index: number) => {
    updateState((prev) => ({
      ...prev,
      evidenceLinks: (prev.evidenceLinks || []).filter(
        (_, idx) => idx !== index
      ),
    }));
    setStatusBanner({
      type: 'info',
      text: `تم حذف الرابط الإلكتروني (${index + 1}).`,
    });
  };

  const activePalette = getTeacherColorPalette(colorSystem);
  const activeTemplateDef = TEACHER_TEMPLATE_DEFINITIONS[templateStyle];
  const requiresGrades = doesBeneficiariesRequireGrades(
    formState.beneficiaries
  );

  return (
    <section
      aria-label={modelMeta.title}
      data-testid={`teacher-program-activity-form-${formId}`}
      className="space-y-6"
    >
      {/* Top Navigation & Quick Actions Card */}
      <div className="bg-white rounded-2xl border border-[#C5D7EE] p-5 sm:p-6 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-programs-activities-group-btn"
              onClick={handleBackToGroupSafe}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs sm:text-sm font-bold text-stone-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>العودة إلى البرامج والأنشطة التعليمية</span>
            </button>

            <button
              type="button"
              data-testid="back-to-teacher-hub-from-programs-btn"
              onClick={handleBackToTeacherHubSafe}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-xs sm:text-sm font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>العودة لقسم المعلم</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-programs-activities-archive-btn"
              onClick={() => setIsArchiveOpen((prev) => !prev)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isArchiveOpen
                  ? 'border-[#1E4D8C] bg-[#1E4D8C] text-white'
                  : 'border-[#C5D7EE] bg-white hover:bg-[#F0F5FA] text-[#1E4D8C]'
              }`}
            >
              <Archive className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>الأرشيف المحفوظ ({savedRecords.length})</span>
            </button>

            <button
              type="button"
              data-testid="create-new-program-activity-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={handleCreateNewRecord}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-bold text-stone-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FilePlus2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إنشاء مبادرة جديدة</span>
            </button>

            <button
              type="button"
              data-testid="save-program-activity-to-archive-btn"
              disabled={isSavingArchive || isEditingLockedBySyncIssue}
              onClick={handleSaveToArchive}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
              data-testid="init-load-individual-sample-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={() => handleLoadSample('مبادرة فردية')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F0F5FA] hover:bg-[#E1ECF7] border border-[#C5D7EE] text-[#1E4D8C] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تعبئة نموذجية (مبادرة فردية)</span>
            </button>

            <button
              type="button"
              data-testid="init-load-group-sample-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={() => handleLoadSample('مبادرة جماعية')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تعبئة نموذجية (مبادرة جماعية)</span>
            </button>

            <button
              type="button"
              data-testid="init-reset-form-btn"
              disabled={isEditingLockedBySyncIssue}
              onClick={handleResetForm}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>إفراغ الحقول</span>
            </button>
          </div>
        </div>

        {/* Active Record Context Bar (Group 6) */}
        <div
          data-testid="program-activity-record-state-bar"
          className="rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-stone-800 font-bold">
            <span>حالة التوثيق الحالي:</span>
            {activeArchivedRecordId ? (
              <span
                data-testid="program-activity-active-record-status-text"
                className="text-emerald-800"
              >
                سجل محفوظ في الأرشيف (المعرف الثابت: {activeArchivedRecordId})
              </span>
            ) : (
              <span
                data-testid="program-activity-active-record-status-text"
                className="text-[#1E4D8C]"
              >
                مسودة قيد التحرير (لا تُحتسب شاهدًا إلا بعد الحفظ والربط لاحقًا)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeArchivedRecordId && hasStoredUnsavedDraft && (
              <button
                type="button"
                data-testid="resume-unsaved-program-activity-draft-btn"
                onClick={handleResumeUnsavedDraft}
                className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
              >
                استئناف المسودة غير المحفوظة
              </button>
            )}
            {savedRecords.length > 0 && !isArchiveOpen && (
              <button
                type="button"
                onClick={() => setIsArchiveOpen(true)}
                className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                استعراض {savedRecords.length} سجل محفوظ
              </button>
            )}
          </div>
        </div>

        {/* Guard Dialog for Creating New Initiative / Abandoning Non-Empty Unsaved Draft */}
        {pendingCreateNewDialog && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="create-new-program-activity-guard-heading"
            data-testid="create-new-program-activity-guard-dialog"
            className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl p-5 sm:p-6 space-y-4">
              {pendingCreateNewDialog.step === 'choose' ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                      <AlertTriangle
                        className="w-5 h-5 text-amber-700"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h3
                        id="create-new-program-activity-guard-heading"
                        className="text-sm sm:text-base font-extrabold text-stone-900"
                      >
                        توجد مسودة نشطة غير محفوظة في الأرشيف
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                        {pendingCreateNewDialog.sourceMode === 'dirty-archived'
                          ? 'تحتوي نسختك المفتوحة على تعديلات لم تُحفظ في الأرشيف بعد. اختر الإجراء المطلوب قبل إنشاء مبادرة جديدة:'
                          : 'تحتوي المسودة الحالية على بيانات لم تُحفظ في الأرشيف بعد. اختر الإجراء المطلوب قبل فتح مبادرة جديدة حتى لا تفقد بياناتك:'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-700 space-y-1">
                    <div className="font-bold text-stone-900 truncate">
                      المسودة الحالية: {pendingCreateNewDialog.draftTitle}
                    </div>
                    <div className="text-stone-600">
                      المرفقات: {pendingCreateNewDialog.photosCount} صور · الروابط:{' '}
                      {pendingCreateNewDialog.linksCount}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-save-and-create-new-btn"
                      onClick={handleGuardSaveAndCreateNew}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>حفظ المسودة الحالية في الأرشيف ثم إنشاء مبادرة جديدة</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-request-abandon-btn"
                      onClick={() =>
                        setPendingCreateNewDialog((prev) =>
                          prev ? { ...prev, step: 'confirm-abandon' } : prev
                        )
                      }
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>إنشاء مسودة جديدة بعد التخلي عن المسودة الحالية</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-cancel-create-new-btn"
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
                        id="create-new-program-activity-guard-heading"
                        className="text-sm sm:text-base font-extrabold text-red-900"
                      >
                        تأكيد صريح: التخلي عن البيانات غير المحفوظة
                      </h3>
                      <p
                        data-testid="guard-abandon-warning-text"
                        className="text-xs sm:text-sm text-red-800 leading-relaxed"
                      >
                        تنبيه صريح: ستُستبدل جميع البيانات غير المحفوظة في المسودة الحالية («
                        {pendingCreateNewDialog.draftTitle}» بما فيها النصوص والصور والروابط غير
                        المحفوظة في الأرشيف) بمسودة فارغة ولن يمكن التراجع عن ذلك. لن تتأثر
                        السجلات المحفوظة مسبقًا في الأرشيف.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row-reverse items-stretch sm:items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-confirm-abandon-create-new-btn"
                      onClick={handleGuardConfirmAbandonAndCreateNew}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span>
                        {pendingCreateNewDialog.trigger === 'reset'
                          ? 'تأكيد التخلي وإفراغ الحقول'
                          : 'تأكيد التخلي وإنشاء مبادرة جديدة'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSavingArchive}
                      data-testid="guard-back-to-cancel-abandon-btn"
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

        {/* Multi-Record Archive Panel (Group 6: Programs & Activities) */}
        {isArchiveOpen && (
          <div
            data-testid="programs-activities-archive-panel"
            className="rounded-2xl border border-[#BFDBFE] bg-[#F8FAFC] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  سجلات الأرشيف المحفوظة — {modelMeta.title}
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  يحتفظ كل سجل محفوظ بمعرف ثابت مستقل، ويمكن البحث فيه وتصفيته وفتحه وتعديله أو حذفه بأمان دون التأثير على المسودات أو بقية السجلات.
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
                    data-testid="program-activity-archive-search-input"
                    aria-label="ابحث في الأرشيف باسم المبادرة أو النطاق أو المشاركين أو المعرف"
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                    placeholder="ابحث باسم المبادرة أو النطاق أو المشاركين أو المعرف..."
                    className="w-full min-h-[38px] pr-9 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                  />
                </div>
                <select
                  aria-label="تصفية السجلات حسب طبيعة التنفيذ"
                  data-testid="program-activity-archive-nature-filter"
                  value={archiveNatureFilter}
                  onChange={(e) =>
                    setArchiveNatureFilter(
                      e.target.value as InitiativeExecutionNatureOption | 'all'
                    )
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm font-bold text-stone-800 focus:outline-none focus:border-[#1E4D8C]"
                >
                  <option value="all">جميع المبادرات</option>
                  <option value="مبادرة فردية">المبادرات الفردية فقط</option>
                  <option value="مبادرة جماعية">المبادرات الجماعية فقط</option>
                </select>
              </div>
            )}

            {pendingDeleteTarget && (
              <div
                role="alertdialog"
                aria-labelledby="confirm-delete-program-activity-archive-heading"
                data-testid="delete-program-activity-archive-confirm-panel"
                className={`rounded-xl border p-4 space-y-3 ${
                  pendingDeleteTarget.impact.isLinked
                    ? 'border-red-300 bg-red-50 text-red-950'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-5 h-5 shrink-0 mt-0.5 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div
                      id="confirm-delete-program-activity-archive-heading"
                      className="font-extrabold"
                    >
                      تأكيد حذف السجل «{pendingDeleteTarget.record.title}»
                    </div>
                    <p className="leading-relaxed">
                      {pendingDeleteTarget.impact.warningMessage ||
                        'سيؤدي هذا الإجراء إلى حذف السجل المحفوظ من الأرشيف وإزالة المرفقات غير المستخدمة في أي سجل آخر.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    data-testid="cancel-delete-program-activity-archive-record-btn"
                    onClick={() => setPendingDeleteTarget(null)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-delete-program-activity-archive-record-btn"
                    onClick={handleConfirmDeleteArchivedRecord}
                    className="min-h-[36px] px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {pendingDeleteTarget.impact.isLinked
                      ? 'تأكيد الحذف وفك الارتباط'
                      : 'تأكيد الحذف'}
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const filteredRecords = filterProgramActivityArchiveRecords(
                savedRecords,
                {
                  executionNatureFilter: archiveNatureFilter,
                  searchQuery: archiveSearchQuery,
                }
              );
              if (savedRecords.length === 0) {
                return (
                  <div
                    data-testid="programs-activities-archive-empty"
                    className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-center text-xs sm:text-sm text-stone-600"
                  >
                    لا توجد سجلات محفوظة في أرشيف هذا النموذج حتى الآن. استكمل البيانات واضغط «حفظ في الأرشيف» لحفظ السجل بمعرف مستقل.
                  </div>
                );
              }
              if (filteredRecords.length === 0) {
                return (
                  <div
                    data-testid="programs-activities-archive-no-matches"
                    className="rounded-xl border border-dashed border-stone-300 bg-white p-4 text-center text-xs text-stone-600"
                  >
                    لا توجد سجلات مطابقة لمعايير البحث والتصفية المحددة.
                  </div>
                );
              }
              return (
                <div className="space-y-2.5">
                  {filteredRecords.map((rec) => {
                    const isCurrent = activeArchivedRecordId === rec.id;
                    return (
                      <div
                        key={rec.id}
                        data-testid={`program-activity-archive-record-item-${rec.id}`}
                        className={`rounded-xl border bg-white p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                          isCurrent
                            ? 'border-[#2563EB] ring-1 ring-[#2563EB]/20'
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
                            data-testid={`open-program-activity-archive-record-${rec.id}`}
                            onClick={() => handleOpenArchivedRecord(rec)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-bold text-[#1E40AF] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <FolderOpen
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>{isCurrent ? 'مفتوح حاليًا' : 'فتح وتعديل'}</span>
                          </button>

                          <button
                            type="button"
                            data-testid={`delete-program-activity-archive-record-${rec.id}`}
                            aria-label={`حذف السجل ${rec.title}`}
                            onClick={() => handleRequestDeleteArchivedRecord(rec)}
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
              );
            })()}
          </div>
        )}

        {/* Form Header & Export Action */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F5FA] border border-[#C5D7EE] text-[#1E4D8C] text-xs font-extrabold">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                قسم المعلم · البرامج والأنشطة التعليمية · {modelMeta.badge}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-stone-900">
              {modelMeta.title}
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
              {modelMeta.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="toggle-init-preview-tab-btn"
              onClick={() =>
                setActiveTab((prev) => (prev === 'edit' ? 'preview' : 'edit'))
              }
              className="xl:hidden min-h-[44px] px-4 py-2.5 rounded-xl border border-[#C5D7EE] bg-[#F0F5FA] text-[#1E4D8C] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {activeTab === 'edit'
                  ? 'معاينة التقرير (A4)'
                  : 'العودة لتعديل البيانات'}
              </span>
            </button>

            <button
              type="button"
              data-testid="export-initiative-pdf-btn"
              disabled={isExporting}
              onClick={handleExportPdf}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1E4D8C] hover:bg-[#163B6B] disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isExporting
                  ? 'جاري تجهيز ملف PDF...'
                  : 'تصدير التقرير بصيغة PDF'}
              </span>
            </button>
          </div>
        </div>

        {/* Template & Color System Selector Bar */}
        <div className="pt-3 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-stone-700">
              قالب التقرير:
            </span>
            {ALL_TEMPLATES.map((tpl) => {
              const def = TEACHER_TEMPLATE_DEFINITIONS[tpl];
              const isSelected = templateStyle === tpl;
              return (
                <button
                  key={tpl}
                  type="button"
                  data-testid={`init-select-template-${tpl}`}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E4D8C] text-white border-[#1E4D8C]'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {def.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-stone-700 inline-flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-[#1E4D8C]" />
              <span>النظام اللوني:</span>
            </span>
            {ALL_COLOR_SYSTEMS.map((col) => {
              const pal = TEACHER_COLOR_PALETTES[col];
              const isSelected = colorSystem === col;
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`init-select-color-${col}`}
                  onClick={() => handleSelectColorSystem(col)}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: pal.primaryHex }}
                  />
                  <span>{pal.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sync Lock / Divergence Resolution Guard (Blocks silent overwrites until resolved) */}
        {isEditingLockedBySyncIssue && (
          <div
            role="alert"
            data-testid="program-activity-sync-guard-banner"
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
                    ? 'تم اكتشاف اختلاف بين مخزن الأرشيف الموحد والمفتاح التوافقي القديم — تم إيقاف التحرير لحماية بياناتك'
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
                      {dualStoreDivergence.archiveTitle || 'مسودة فارغة'}
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
                    data-testid="resolve-divergence-keep-archive-btn"
                    onClick={() =>
                      handleResolveDualStoreDivergence('keep-archive')
                    }
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1E4D8C] hover:bg-[#163B6B] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                  >
                    اعتماد نسخة مخزن الأرشيف ومزامنتها
                  </button>
                  {dualStoreDivergence.legacyData && (
                    <button
                      type="button"
                      disabled={isResolvingSyncIssue}
                      data-testid="resolve-divergence-keep-legacy-btn"
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
                  data-testid="retry-sync-after-failure-btn"
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

        {/* Status or Validation Messages */}
        {statusBanner && (
          <div
            data-testid="init-status-banner"
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 ${
              statusBanner.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : statusBanner.type === 'info'
                  ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                statusBanner.type === 'error'
                  ? 'text-red-600'
                  : statusBanner.type === 'info'
                    ? 'text-[#2563EB]'
                    : 'text-emerald-600'
              }`}
            />
            <span>{statusBanner.text}</span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div
            data-testid="init-validation-errors"
            className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>يرجى استكمال أو تصحيح الحقول التالية قبل تصدير PDF:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-800 space-y-1 pr-2">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Two-Column Workspace: Form Editor + Live A4 Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <div
          className={`xl:col-span-7 space-y-5 ${
            activeTab === 'preview' ? 'hidden xl:block' : 'block'
          }`}
        >
          <fieldset
            disabled={isEditingLockedBySyncIssue}
            className="contents"
          >
          {/* Section 1: Basic Data, Scope, Type & Beneficiaries */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ١. البيانات الأساسية وتصنيف المبادرة
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                تحديد اسم المبادرة ونطاقها ونوعها والفئة المستفيدة وتاريخ ومكان
                التنفيذ
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="init-name-input"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  اسم المبادرة <span className="text-red-600">*</span>
                </label>
                <input
                  id="init-name-input"
                  data-testid="init-name-input"
                  type="text"
                  value={formState.initiativeName}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      initiativeName: e.target.value,
                    }))
                  }
                  placeholder="مثال: مبادرة «تحدي الإتقان الصباحي» لتعزيز المفاهيم الأساسية"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="init-scope-select"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    نطاق المبادرة <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="init-scope-select"
                    data-testid="init-scope-select"
                    value={formState.initiativeScope}
                    onChange={(e) =>
                      updateState((prev) => ({
                        ...prev,
                        initiativeScope: e.target
                          .value as InitiativeScopeOption,
                      }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                  >
                    {INITIATIVE_SCOPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="init-type-select"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    نوع المبادرة <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="init-type-select"
                    data-testid="init-type-select"
                    value={formState.initiativeType}
                    onChange={(e) =>
                      updateState((prev) => ({
                        ...prev,
                        initiativeType: e.target.value as InitiativeTypeOption,
                      }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                  >
                    {INITIATIVE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formState.initiativeType === 'نوع آخر' && (
                <div>
                  <label
                    htmlFor="init-custom-type-input"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    اكتب نوع المبادرة <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="init-custom-type-input"
                    data-testid="init-custom-type-input"
                    type="text"
                    value={formState.customInitiativeType}
                    onChange={(e) =>
                      updateState((prev) => ({
                        ...prev,
                        customInitiativeType: e.target.value,
                      }))
                    }
                    placeholder="اكتب نوع المبادرة المخصص..."
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#1E4D8C] bg-[#F0F5FA]/40 text-sm text-stone-900 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="init-beneficiaries-select"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    المستفيدون من المبادرة{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="init-beneficiaries-select"
                    data-testid="init-beneficiaries-select"
                    value={formState.beneficiaries}
                    onChange={(e) =>
                      updateState((prev) => ({
                        ...prev,
                        beneficiaries: e.target
                          .value as InitiativeBeneficiariesOption,
                      }))
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                  >
                    {INITIATIVE_BENEFICIARIES_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {requiresGrades && (
                  <div>
                    <label
                      htmlFor="init-target-grades-input"
                      className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                    >
                      {formState.beneficiaries === 'طلاب صف محدد'
                        ? 'الصف المستفيد'
                        : 'الصفوف المستفيدة'}{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="init-target-grades-input"
                      data-testid="init-target-grades-input"
                      type="text"
                      value={formState.targetGradeOrGrades}
                      onChange={(e) =>
                        updateState((prev) => ({
                          ...prev,
                          targetGradeOrGrades: e.target.value,
                        }))
                      }
                      placeholder={
                        formState.beneficiaries === 'طلاب صف محدد'
                          ? 'مثال: الصف الثاني المتوسط (٢/أ)'
                          : 'مثال: صفوف الأول والثاني والثالث المتوسط'
                      }
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#1E4D8C] bg-[#F0F5FA]/40 text-sm text-stone-900 focus:outline-none"
                    />
                  </div>
                )}

                {formState.beneficiaries === 'فئة أخرى' && (
                  <div>
                    <label
                      htmlFor="init-custom-beneficiaries-input"
                      className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                    >
                      اكتب الفئة المستفيدة{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="init-custom-beneficiaries-input"
                      data-testid="init-custom-beneficiaries-input"
                      type="text"
                      value={formState.customBeneficiaries}
                      onChange={(e) =>
                        updateState((prev) => ({
                          ...prev,
                          customBeneficiaries: e.target.value,
                        }))
                      }
                      placeholder="اكتب الفئة المستفيدة من المبادرة..."
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#1E4D8C] bg-[#F0F5FA]/40 text-sm text-stone-900 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="init-date-period-input"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    تاريخ التنفيذ أو الفترة الزمنية{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="init-date-period-input"
                    data-testid="init-date-period-input"
                    type="text"
                    value={formState.executionDateOrPeriod}
                    onChange={(e) =>
                      updateState((prev) => ({
                        ...prev,
                        executionDateOrPeriod: e.target.value,
                      }))
                    }
                    placeholder="مثال: الفصل الدراسي الثاني ١٤٤٧هـ — لمدة ٤ أسابيع"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="init-place-input"
                    className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                  >
                    مكان التنفيذ <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="init-place-input"
                    data-testid="init-place-input"
                    type="text"
                    value={formState.executionPlace}
                    onChange={(e) =>
                      updateState((prev) => ({
                        ...prev,
                        executionPlace: e.target.value,
                      }))
                    }
                    placeholder="مثال: القاعة الصفية / مركز مصادر التعلم"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Execution Nature (Individual vs Group) */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ٢. طبيعة تنفيذ المبادرة
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                حدد ما إذا كانت المبادرة فردية (منفذ واحد) أو جماعية (قائمة
                بأسماء المشاركين)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {INITIATIVE_EXECUTION_NATURE_OPTIONS.map((natureOpt) => {
                const isSelected = formState.executionNature === natureOpt;
                return (
                  <button
                    key={natureOpt}
                    type="button"
                    data-testid={
                      natureOpt === 'مبادرة فردية'
                        ? 'init-nature-individual-btn'
                        : 'init-nature-group-btn'
                    }
                    onClick={() =>
                      updateState((prev) => ({
                        ...prev,
                        executionNature: natureOpt,
                      }))
                    }
                    className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E4D8C] text-white border-[#1E4D8C]'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {natureOpt === 'مبادرة فردية' ? (
                      <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{natureOpt}</span>
                  </button>
                );
              })}
            </div>

            {formState.executionNature === 'مبادرة فردية' ? (
              <div data-testid="init-individual-executor-panel">
                <label
                  htmlFor="init-executor-name-input"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  اسم منفذ المبادرة <span className="text-red-600">*</span>
                </label>
                <input
                  id="init-executor-name-input"
                  data-testid="init-executor-name-input"
                  type="text"
                  value={formState.executorName}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      executorName: e.target.value,
                    }))
                  }
                  placeholder="أدخل اسم المعلم منفذ المبادرة..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                />
              </div>
            ) : (
              <div
                data-testid="init-group-participants-panel"
                className="space-y-3 pt-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-stone-800">
                    أسماء المشاركين في المبادرة الجماعية{' '}
                    <span className="text-red-600">*</span>
                  </span>
                  <button
                    type="button"
                    data-testid="init-add-participant-btn"
                    onClick={handleAddParticipant}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#F0F5FA] hover:bg-[#E1ECF7] border border-[#C5D7EE] text-[#1E4D8C] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إضافة مشارك</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(formState.participants || []).map((participant, idx) => (
                    <div
                      key={participant.id}
                      data-testid={`init-participant-row-${idx + 1}`}
                      className="flex items-center gap-2.5"
                    >
                      <span className="w-24 shrink-0 text-xs font-extrabold text-stone-600 bg-stone-100 border border-stone-200 rounded-xl px-3 py-2.5 text-center">
                        المشارك ({idx + 1})
                      </span>
                      <input
                        type="text"
                        aria-label={`اسم المشارك ${idx + 1}`}
                        data-testid={`init-participant-input-${idx + 1}`}
                        value={participant.name}
                        onChange={(e) =>
                          handleUpdateParticipantName(idx, e.target.value)
                        }
                        placeholder={`أدخل اسم المشارك (${idx + 1})...`}
                        className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#1E4D8C]"
                      />
                      <button
                        type="button"
                        aria-label={`حذف المشارك ${idx + 1}`}
                        data-testid={`init-delete-participant-btn-${idx + 1}`}
                        onClick={() => handleDeleteParticipantAt(idx)}
                        className="min-h-[42px] px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>حذف</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Initiative Goal, Description, Mechanism & Impact */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ٣. تفاصيل المبادرة وفكرتها وآلية تنفيذها وأثرها
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                توثيق الهدف من المبادرة وفكرتها وخطوات تنفيذها وأبرز نتائجها
                وأثرها التربوي
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="init-goal-textarea"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  الهدف من المبادرة <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="init-goal-textarea"
                  data-testid="init-goal-textarea"
                  rows={3}
                  value={formState.initiativeGoal}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      initiativeGoal: e.target.value,
                    }))
                  }
                  placeholder="وضّح الهدف التربوي أو التعليمي الذي تسعى المبادرة إلى تحقيقه..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#1E4D8C]"
                />
              </div>

              <div>
                <label
                  htmlFor="init-description-textarea"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  وصف المبادرة وفكرتها <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="init-description-textarea"
                  data-testid="init-description-textarea"
                  rows={3}
                  value={formState.initiativeDescription}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      initiativeDescription: e.target.value,
                    }))
                  }
                  placeholder="اشرح فكرة المبادرة ومحتواها التربوي أو المهاري باختصار..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#1E4D8C]"
                />
              </div>

              <div>
                <label
                  htmlFor="init-mechanism-textarea"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1.5"
                >
                  آلية التنفيذ <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="init-mechanism-textarea"
                  data-testid="init-mechanism-textarea"
                  rows={3}
                  value={formState.executionMechanism}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      executionMechanism: e.target.value,
                    }))
                  }
                  placeholder="وضّح خطوات وآلية تطبيق المبادرة عملياً..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#1E4D8C]"
                />
              </div>

              <div>
                <label
                  htmlFor="init-impact-textarea"
                  className="block text-xs sm:text-sm font-extrabold text-stone-800 mb-1"
                >
                  أبرز النتائج أو الأثر <span className="text-red-600">*</span>
                </label>
                <p className="text-[11px] text-stone-500 mb-1.5">
                  وصف مختصر للأثر التربوي أو التعليمي الذي نتج عن المبادرة (وليس
                  تحليلاً رقمياً أو إحصائياً لنتائج الطلاب)
                </p>
                <textarea
                  id="init-impact-textarea"
                  data-testid="init-impact-textarea"
                  rows={3}
                  value={formState.keyResultsOrImpact}
                  onChange={(e) =>
                    updateState((prev) => ({
                      ...prev,
                      keyResultsOrImpact: e.target.value,
                    }))
                  }
                  placeholder="صف أبرز النتائج والأثر الملاحظ بعد تنفيذ المبادرة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#1E4D8C]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Optional Additional Notes */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-3">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                ٤. ملاحظات إضافية (اختياري)
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                إذا تُركت فارغة فلن يظهر قسم الملاحظات الإضافية في ملف PDF
              </p>
            </div>

            <textarea
              id="init-additional-notes-textarea"
              aria-label="ملاحظات إضافية"
              data-testid="init-additional-notes-textarea"
              rows={2}
              value={formState.additionalNotes}
              onChange={(e) =>
                updateState((prev) => ({
                  ...prev,
                  additionalNotes: e.target.value,
                }))
              }
              placeholder="أي توصيات أو ملاحظات إضافية حول المبادرة (اختياري)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 leading-relaxed focus:outline-none focus:border-[#1E4D8C]"
            />
          </div>

          {/* Section 5: Optional Photo Evidence (Up to 2 Photos) */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900 inline-flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#1E4D8C]" />
                  <span>الشواهد (اختياري – بحد أقصى صورتان)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  يدعم رفع الصور من الجهاز مع المعاينة والاستبدال والحذف، وعند
                  عدم إرفاق صور لا يظهر قسم الشواهد أو أي إطار فارغ في ملف PDF
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-xs font-extrabold text-stone-700">
                {(formState.evidencePhotos || []).length} / 2
              </span>
            </div>

            <input
              ref={addPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              data-testid="init-photo-file-input"
              onChange={handleUploadNewPhotos}
              className="hidden"
            />

            {(formState.evidencePhotos || []).length === 0 ? (
              <div
                data-testid="init-empty-photos-notice"
                className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-5 text-center space-y-2"
              >
                <p className="text-xs font-bold text-stone-600">
                  لم يتم إرفاق أي شاهد مصور حالياً — لن يظهر قسم الشواهد أو أي
                  مساحة فارغة في ملف PDF.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(formState.evidencePhotos || []).map((photo, idx) => (
                  <div
                    key={photo.id}
                    data-testid={`init-photo-card-${idx + 1}`}
                    className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-stone-800">
                        الشاهد المصور ({idx + 1})
                      </span>
                    </div>

                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-white border border-stone-200 flex items-center justify-center">
                      <img
                        src={photo.imageDataUrl}
                        alt={`معاينة الشاهد ${idx + 1}`}
                        data-testid={`init-photo-preview-${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <input
                      ref={(el) => {
                        replacePhotoInputRefs.current[idx] = el;
                      }}
                      type="file"
                      accept="image/*"
                      data-testid={`init-replace-photo-input-${idx + 1}`}
                      onChange={(e) => handleReplacePhotoAt(idx, e)}
                      className="hidden"
                    />

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid={`init-replace-photo-btn-${idx + 1}`}
                        onClick={() =>
                          replacePhotoInputRefs.current[idx]?.click()
                        }
                        className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-xs font-bold text-stone-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>استبدال</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`init-delete-photo-btn-${idx + 1}`}
                        onClick={() => handleDeletePhotoAt(idx)}
                        className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {(formState.evidencePhotos || []).length < 2 && (
                <button
                  type="button"
                  data-testid="init-upload-photo-btn"
                  onClick={() => addPhotoInputRef.current?.click()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F0F5FA] hover:bg-[#E1ECF7] border border-[#C5D7EE] text-[#1E4D8C] text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 shrink-0" />
                  <span>رفع صورة من الجهاز (JPG / PNG / WebP)</span>
                </button>
              )}

              <button
                type="button"
                data-testid="init-load-sample-photos-btn"
                onClick={handleLoadSamplePhotos}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>إدراج صورتين تجريبيتين للمعاينة</span>
              </button>
            </div>

            {mediaNotice && (
              <div
                data-testid="init-media-store-notice"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
              >
                {mediaNotice}
              </div>
            )}
          </div>

          {/* Section 6: Optional Electronic Links & QR Codes (Up to 2 Links) */}
          <div
            data-testid="init-links-section"
            className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold font-display text-stone-900 inline-flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-[#1E4D8C]" />
                  <span>روابط إلكترونية</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  قسم اختياري لإضافة رابط واحد أو رابطين مستقلين؛ يُنشأ لكل رابط
                  رمز QR مستقل قابل للمسح والنقر داخل ملف PDF دون عرض الرابط
                  الطويل كنص، وعند عدم إدخال أي رابط يختفي القسم تماماً
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-xs font-extrabold text-stone-700">
                {(formState.evidenceLinks || []).length} / 2
              </span>
            </div>

            {(formState.evidenceLinks || []).length === 0 ? (
              <div
                data-testid="init-empty-links-notice"
                className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-4 text-center"
              >
                <p className="text-xs font-bold text-stone-600">
                  لم يتم إدخال أي رابط إلكتروني حالياً — لن يظهر أي رمز QR أو
                  إطار فارغ في المعاينة أو ملف PDF.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(formState.evidenceLinks || []).map((linkItem, idx) => {
                  const trimmedUrl = linkItem.url.trim();
                  const isUrlValid = isValidElectronicUrl(trimmedUrl);
                  const qrSvgDataUrl = isUrlValid
                    ? generateQrSvgDataUrl(
                        trimmedUrl,
                        activePalette.secondaryHex,
                        '#FFFFFF',
                        2
                      )
                    : null;

                  return (
                    <div
                      key={linkItem.id}
                      data-testid={`init-link-card-${idx + 1}`}
                      className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 space-y-1.5">
                          <label
                            htmlFor={`init-link-input-${idx + 1}`}
                            className="block text-xs font-extrabold text-stone-800"
                          >
                            الرابط الإلكتروني ({idx + 1})
                          </label>
                          <input
                            id={`init-link-input-${idx + 1}`}
                            data-testid={`init-link-input-${idx + 1}`}
                            type="url"
                            dir="ltr"
                            value={linkItem.url}
                            onChange={(e) =>
                              handleUpdateLinkUrl(idx, e.target.value)
                            }
                            placeholder="https://madrasati.sa/..."
                            className={`w-full min-h-[40px] px-3 py-1.5 rounded-lg border bg-white text-xs sm:text-sm text-stone-900 text-left focus:outline-none ${
                              trimmedUrl && !isUrlValid
                                ? 'border-red-400 focus:border-red-600'
                                : 'border-stone-300 focus:border-[#1E4D8C]'
                            }`}
                          />
                          {trimmedUrl && !isUrlValid && (
                            <p
                              data-testid={`init-link-error-${idx + 1}`}
                              className="text-[11px] font-bold text-red-600"
                            >
                              صيغة الرابط غير صحيحة — يجب أن يبدأ بـ https:// أو
                              http://
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-center">
                          {qrSvgDataUrl && (
                            <a
                              href={trimmedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`init-link-qr-preview-${idx + 1}`}
                              title="انقر لفتح الرابط أو امسح رمز QR"
                              className="w-14 h-14 rounded-lg bg-white border border-stone-200 p-1 flex items-center justify-center shrink-0 hover:border-[#1E4D8C] transition-colors"
                            >
                              <img
                                src={qrSvgDataUrl}
                                alt={`رمز QR للرابط ${idx + 1}`}
                                className="w-full h-full object-contain"
                              />
                            </a>
                          )}

                          <button
                            type="button"
                            data-testid={`init-delete-link-btn-${idx + 1}`}
                            onClick={() => handleDeleteLinkAt(idx)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(formState.evidenceLinks || []).length < 2 && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  data-testid="init-add-link-btn"
                  onClick={handleAddLink}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F0F5FA] hover:bg-[#E1ECF7] border border-[#C5D7EE] text-[#1E4D8C] text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span>
                    {(formState.evidenceLinks || []).length === 0
                      ? 'إضافة رابط إلكتروني (رمز QR)'
                      : 'إضافة رابط إلكتروني ثانٍ (رمز QR مستقل)'}
                  </span>
                </button>
              </div>
            )}
          </div>
          </fieldset>
        </div>

        {/* Live A4 Preview Column */}
        <div
          className={`xl:col-span-5 xl:sticky xl:top-24 space-y-4 ${
            activeTab === 'edit' ? 'hidden xl:block' : 'block'
          }`}
        >
          <div className="bg-white rounded-2xl border border-[#C5D7EE] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                  المعاينة الحية للتقرير (A4 عمودي)
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  القالب: {activeTemplateDef.name} · {activePalette.name}
                </p>
              </div>
              <span
                data-testid="init-preview-page-count-badge"
                className="px-2.5 py-1 rounded-lg bg-[#F0F5FA] border border-[#C5D7EE] text-xs font-extrabold text-[#1E4D8C]"
              >
                عدد الصفحات: {paginatedPages.length}
              </span>
            </div>

            <div
              data-testid="init-live-preview-pages-container"
              className="space-y-4 max-h-[78vh] overflow-y-auto pr-1"
            >
              {renderedPages.map((page, idx) => (
                <div
                  key={idx}
                  data-testid={`init-preview-page-${idx + 1}`}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 px-1">
                    <span>
                      الصفحة {idx + 1} من {renderedPages.length}
                    </span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-stone-300 shadow-xs bg-stone-100">
                    {page.dataUrl ? (
                      <>
                        <img
                          src={page.dataUrl}
                          alt={`معاينة الصفحة ${idx + 1}`}
                          className="w-full h-auto block"
                        />
                        {page.links &&
                          page.links.map((lnk, lIdx) => (
                            <a
                              key={`${idx + 1}-lnk-${lIdx}`}
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`init-preview-qr-link-${idx + 1}-${
                                lIdx + 1
                              }`}
                              title="انقر لفتح الرابط المرتبط برمز QR"
                              style={{
                                position: 'absolute',
                                left: `${(lnk.xPx / page.pixelWidth) * 100}%`,
                                top: `${(lnk.yPx / page.pixelHeight) * 100}%`,
                                width: `${(lnk.wPx / page.pixelWidth) * 100}%`,
                                height: `${(lnk.hPx / page.pixelHeight) * 100}%`,
                              }}
                              className="block cursor-pointer hover:ring-2 hover:ring-[#1E4D8C]/60 rounded-md transition-all"
                            >
                              <span className="sr-only">
                                فتح الرابط الإلكتروني ({lIdx + 1})
                              </span>
                            </a>
                          ))}
                      </>
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
    </section>
  );
};
