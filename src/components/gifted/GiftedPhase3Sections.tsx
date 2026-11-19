import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Layers,
  Link2,
  Plus,
  QrCode,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  addEvidenceLinkToTargetInRecord,
  addEvidencePhotoToTargetInRecord,
  buildGiftedFinalRecordReportModel,
  buildGiftedInnovationSpaceProgressReportModel,
  buildGiftedProgramOrEventReportModel,
  deleteEvidenceLinkFromTargetInRecord,
  deleteEvidencePhotoFromTargetInRecord,
  getDefaultGiftedAttachmentRepository,
  getEvidenceBundleForTarget,
  getGiftedEvidenceTargetsCatalog,
  getGiftedNonExecutedItemsSummary,
  GIFTED_CLASSIFICATION_LABELS,
  GIFTED_EXECUTION_STATUS_LABELS,
  GIFTED_PARTICIPATION_CATEGORY_LABELS,
  GiftedCompletionMetricsReport,
  GiftedCoordinatorRecord,
  GiftedEvidenceTargetCategory,
  GiftedFinalRecordReportMode,
  MAX_GIFTED_EVIDENCE_LINKS,
  MAX_GIFTED_EVIDENCE_PHOTOS,
  setTargetShowEvidencesInReportInRecord,
  updateEvidenceLinkInTargetInRecord,
  updateEvidencePhotoInTargetInRecord,
  updateGiftedEvaluationSummaryInRecord,
  updateInnovationProgressReportOverridesInRecord,
  updateProgramEventReportOverridesInRecord,
} from '../../utils/giftedRecordEngine';
import {
  downloadGiftedPdfBytes,
  generateGiftedFinalRecordPdf,
  generateGiftedInnovationSpaceProgressReportPdf,
  generateGiftedProgramOrEventReportPdf,
} from '../../utils/giftedReportPdfGenerator';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';

export type GiftedAllSectionNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

interface GiftedPhase3SectionsProps {
  activeSection: 8 | 9 | 10;
  record: GiftedCoordinatorRecord;
  settings: SchoolSettings;
  metrics: GiftedCompletionMetricsReport;
  updateRecord: (
    updater: (prev: GiftedCoordinatorRecord) => GiftedCoordinatorRecord
  ) => void;
  onRefreshAttachments: () => Promise<void>;
  onNavigateToSection: (sectionNumber: GiftedAllSectionNumber) => void;
}

type Section10ReportTab =
  | 'program_or_event'
  | 'innovation_space_progress'
  | 'final_administrative_record';

export const GiftedPhase3Sections: React.FC<GiftedPhase3SectionsProps> = ({
  activeSection,
  record,
  settings,
  updateRecord,
  onRefreshAttachments,
  onNavigateToSection,
}) => {
  // ===========================================================================
  // SECTION 08 STATE: مستودع الشواهد (بحد أقصى 4 صور و4 روابط لكل سجل)
  // ===========================================================================
  const targetsCatalog = useMemo(
    () => getGiftedEvidenceTargetsCatalog(record),
    [record]
  );

  const [targetCategoryFilter, setTargetCategoryFilter] = useState<
    'all' | GiftedEvidenceTargetCategory
  >('all');

  const filteredTargets = useMemo(() => {
    if (targetCategoryFilter === 'all') return targetsCatalog;
    return targetsCatalog.filter((t) => t.category === targetCategoryFilter);
  }, [targetsCatalog, targetCategoryFilter]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    () => targetsCatalog[0]?.targetId || 'prog-awareness'
  );

  useEffect(() => {
    if (
      targetsCatalog.length > 0 &&
      !targetsCatalog.some((t) => t.targetId === selectedTargetId)
    ) {
      setSelectedTargetId(targetsCatalog[0].targetId);
    }
  }, [targetsCatalog, selectedTargetId]);

  const selectedTargetMeta = useMemo(
    () =>
      targetsCatalog.find((t) => t.targetId === selectedTargetId) ||
      targetsCatalog[0],
    [targetsCatalog, selectedTargetId]
  );

  const activeEvidenceBundle = useMemo(
    () => getEvidenceBundleForTarget(record, selectedTargetId),
    [record, selectedTargetId]
  );

  const [photoTitleDraft, setPhotoTitleDraft] = useState('');
  const [photoCaptionDraft, setPhotoCaptionDraft] = useState('');
  const [photoForProgramReport, setPhotoForProgramReport] = useState(true);
  const [photoForFinalRecord, setPhotoForFinalRecord] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [linkTitleDraft, setLinkTitleDraft] = useState('');
  const [linkUrlDraft, setLinkUrlDraft] = useState('');
  const [linkForProgramReport, setLinkForProgramReport] = useState(true);
  const [linkForFinalRecord, setLinkForFinalRecord] = useState(true);

  const [evidenceAlert, setEvidenceAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const photoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Map of blobKey -> objectURL for rendering saved IndexedDB photos
  const [photoObjectUrls, setPhotoObjectUrls] = useState<Record<string, string>>(
    {}
  );

  const allReferencedBlobKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.values(record.evidenceBundles || {}).forEach((b) => {
      (b.photos || []).forEach((p) => {
        if (p.blobKey) keys.add(p.blobKey);
      });
    });
    return Array.from(keys);
  }, [record.evidenceBundles]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    const loadPreviews = async () => {
      const repo = getDefaultGiftedAttachmentRepository();
      const nextMap: Record<string, string> = {};
      for (const blobKey of allReferencedBlobKeys) {
        try {
          const att = await repo.getAttachment(blobKey);
          if (att && att.bytes && att.bytes.length > 0) {
            const blob = new Blob([new Uint8Array(att.bytes)], {
              type: att.mimeType || 'image/png',
            });
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            nextMap[blobKey] = url;
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) {
        setPhotoObjectUrls(nextMap);
      }
    };

    void loadPreviews();

    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [allReferencedBlobKeys]);

  const handleUploadEvidencePhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTargetMeta) return;
    setEvidenceAlert(null);

    if (activeEvidenceBundle.photos.length >= MAX_GIFTED_EVIDENCE_PHOTOS) {
      setEvidenceAlert({
        type: 'error',
        message: `الحد الأقصى للشواهد المصورة لهذا السجل هو ${MAX_GIFTED_EVIDENCE_PHOTOS} صور فقط.`,
      });
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const blobKey = `ev-img-${selectedTargetMeta.targetId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const repo = getDefaultGiftedAttachmentRepository();
      await repo.putAttachment({
        blobKey,
        filename: file.name,
        mimeType: file.type || 'image/png',
        bytes,
        createdAt: new Date().toISOString(),
      });

      const titleToUse =
        photoTitleDraft.trim() ||
        file.name.replace(/\.[^/.]+$/, '') ||
        `شاهد مصور (${activeEvidenceBundle.photos.length + 1})`;

      updateRecord((prev) =>
        addEvidencePhotoToTargetInRecord(prev, selectedTargetMeta.targetId, {
          blobKey,
          title: titleToUse,
          caption: photoCaptionDraft.trim() || undefined,
          selectedForProgramReport: photoForProgramReport,
          selectedForFinalRecord: photoForFinalRecord,
        })
      );

      await onRefreshAttachments();
      setPhotoTitleDraft('');
      setPhotoCaptionDraft('');
      setEvidenceAlert({
        type: 'success',
        message: `تم حفظ الصورة (${titleToUse}) في قاعدة IndexedDB وربطها بسجل «${selectedTargetMeta.title}» لتُدرج تلقائياً في النسخة الاحتياطية ZIP.`,
      });
    } catch (err) {
      setEvidenceAlert({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'تعذر رفع الصورة وحفظها في قاعدة IndexedDB.',
      });
    } finally {
      setIsUploadingPhoto(false);
      if (photoFileInputRef.current) {
        photoFileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteEvidencePhoto = async (
    targetId: string,
    photoId: string,
    blobKey: string
  ) => {
    setEvidenceAlert(null);
    updateRecord((prev) =>
      deleteEvidencePhotoFromTargetInRecord(prev, targetId, photoId)
    );
    try {
      const repo = getDefaultGiftedAttachmentRepository();
      await repo.deleteAttachment(blobKey);
      await onRefreshAttachments();
    } catch {
      // ignore
    }
  };

  const handleAddEvidenceLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetMeta) return;
    setEvidenceAlert(null);

    if (activeEvidenceBundle.links.length >= MAX_GIFTED_EVIDENCE_LINKS) {
      setEvidenceAlert({
        type: 'error',
        message: `الحد الأقصى للروابط الإلكترونية لهذا السجل هو ${MAX_GIFTED_EVIDENCE_LINKS} روابط فقط.`,
      });
      return;
    }

    const cleanUrl = linkUrlDraft.trim();
    if (!cleanUrl) {
      setEvidenceAlert({
        type: 'error',
        message: 'يرجى إدخال الرابط الإلكتروني لتوليد رمز الاستجابة السريعة QR.',
      });
      return;
    }

    const normalizedUrl =
      /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;

    const cleanTitle =
      linkTitleDraft.trim() ||
      `رابط شاهد (${activeEvidenceBundle.links.length + 1})`;

    try {
      updateRecord((prev) =>
        addEvidenceLinkToTargetInRecord(prev, selectedTargetMeta.targetId, {
          title: cleanTitle,
          url: normalizedUrl,
          selectedForProgramReport: linkForProgramReport,
          selectedForFinalRecord: linkForFinalRecord,
        })
      );
      setLinkTitleDraft('');
      setLinkUrlDraft('');
      setEvidenceAlert({
        type: 'success',
        message: `تمت إضافة الرابط الإلكتروني (${cleanTitle}) وتوليد رمز QR تلقائياً.`,
      });
    } catch (err) {
      setEvidenceAlert({
        type: 'error',
        message: err instanceof Error ? err.message : 'تعذر إضافة الرابط.',
      });
    }
  };

  // ===========================================================================
  // SECTION 09 DATA: المتابعة والتقييم (قراءة تلقائية لغير المنفذ + 4 حقول تقييم فقط)
  // ===========================================================================
  const nonExecutedItems = useMemo(
    () => getGiftedNonExecutedItemsSummary(record),
    [record]
  );

  // ===========================================================================
  // SECTION 10 STATE & MODELS: التقارير النهائية والدورية (٣ نماذج معتمدة)
  // ===========================================================================
  const [activeReportTab, setActiveReportTab] =
    useState<Section10ReportTab>('program_or_event');
  const [reportTargetId, setReportTargetId] = useState<string>(
    () => targetsCatalog[0]?.targetId || 'prog-awareness'
  );
  const [finalReportMode, setFinalReportMode] =
    useState<GiftedFinalRecordReportMode>('concise');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (
      targetsCatalog.length > 0 &&
      !targetsCatalog.some((t) => t.targetId === reportTargetId)
    ) {
      setReportTargetId(targetsCatalog[0].targetId);
    }
  }, [targetsCatalog, reportTargetId]);

  const programOrEventReportModel = useMemo(
    () =>
      buildGiftedProgramOrEventReportModel(record, settings, reportTargetId),
    [record, settings, reportTargetId]
  );

  const innovationProgressReportModel = useMemo(
    () => buildGiftedInnovationSpaceProgressReportModel(record, settings),
    [record, settings]
  );

  const finalRecordReportModel = useMemo(
    () =>
      buildGiftedFinalRecordReportModel(record, settings, {
        mode: finalReportMode,
      }),
    [record, settings, finalReportMode]
  );

  const handleExportCurrentReportPdf = async () => {
    setIsExportingPdf(true);
    setPdfFeedback(null);
    try {
      const repo = getDefaultGiftedAttachmentRepository();
      if (activeReportTab === 'program_or_event') {
        const pdfBytes = await generateGiftedProgramOrEventReportPdf(
          programOrEventReportModel,
          repo
        );
        const safeName = programOrEventReportModel.generalInfo.eventName
          .replace(/\s+/g, '_')
          .slice(0, 40);
        downloadGiftedPdfBytes(pdfBytes, `تقرير_برنامج_أو_فعالية_${safeName}.pdf`);
        setPdfFeedback(
          `تم تصدير «تقرير برنامج أو فعالية: ${programOrEventReportModel.generalInfo.eventName}» بصيغة A4 PDF بنجاح.`
        );
      } else if (activeReportTab === 'innovation_space_progress') {
        const pdfBytes = await generateGiftedInnovationSpaceProgressReportPdf(
          innovationProgressReportModel,
          repo
        );
        downloadGiftedPdfBytes(
          pdfBytes,
          `التقرير_المرحلي_لبرنامج_مساحة_الابتكار_${innovationProgressReportModel.basicData.schoolName.replace(/\s+/g, '_')}.pdf`
        );
        setPdfFeedback(
          'تم تصدير «التقرير المرحلي لبرنامج مساحة الابتكار (نموذج ص ٢١)» بصيغة A4 PDF بنجاح.'
        );
      } else {
        const pdfBytes = await generateGiftedFinalRecordPdf(
          finalRecordReportModel,
          repo
        );
        const modeTag =
          finalReportMode === 'detailed' ? 'الشامل_المفصل' : 'المختصر_الشامل';
        downloadGiftedPdfBytes(
          pdfBytes,
          `التقرير_الإداري_الختامي_لسجل_الموهوبين_${modeTag}.pdf`
        );
        setPdfFeedback(
          `تم تصدير «التقرير الإداري الختامي (${
            finalReportMode === 'detailed' ? 'نسخة شاملة ومفصلة' : 'نسخة مختصرة وشاملة'
          })» بصيغة A4 PDF بنجاح.`
        );
      }
    } catch (err) {
      setPdfFeedback(
        err instanceof Error
          ? `تعذر إصدار ملف PDF: ${err.message}`
          : 'حدث خطأ أثناء إصدار ملف PDF.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const totalSavedPhotosCount = useMemo(
    () => targetsCatalog.reduce((acc, t) => acc + t.photosCount, 0),
    [targetsCatalog]
  );

  const totalSavedLinksCount = useMemo(
    () => targetsCatalog.reduce((acc, t) => acc + t.linksCount, 0),
    [targetsCatalog]
  );

  return (
    <>
      {/* =====================================================================
          SECTION 08: مستودع الشواهد (بحد أقصى 4 صور و4 روابط لكل سجل)
         ===================================================================== */}
      {activeSection === 8 && (
        <section data-testid="gifted-section-8-view" className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#8A6125] text-white font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                08
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#8A6125] rotate-45 inline-block" />
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-[#292F33]">
                    مستودع الشواهد المصورة والروابط الإلكترونية
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  توثيق الشواهد المرتبطة بالبرامج الوزارية ومبادرات المنسق والمسابقات العلمية بحد أقصى (٤ صور) و(٤ روابط) لكل سجل، مع حفظ الصور في IndexedDB وتوليد رمز QR تلقائياً لكل رابط.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div
                data-testid="s8-total-photos-badge"
                className="px-3.5 py-2 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] text-xs font-bold text-[#292F33] flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4 text-[#956C2E]" />
                <span>إجمالي الصور المحفوظة: {totalSavedPhotosCount}</span>
              </div>
              <div
                data-testid="s8-total-links-badge"
                className="px-3.5 py-2 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] text-xs font-bold text-[#292F33] flex items-center gap-2"
              >
                <QrCode className="w-4 h-4 text-[#956C2E]" />
                <span>إجمالي روابط QR: {totalSavedLinksCount}</span>
              </div>
            </div>
          </div>

          {evidenceAlert && (
            <div
              data-testid="s8-evidence-alert"
              className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 border ${
                evidenceAlert.type === 'success'
                  ? 'bg-[#EEF5EE] text-[#2F6846] border-[#C5DCC7]'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {evidenceAlert.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{evidenceAlert.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceAlert(null)}
                className="text-xs underline cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Right Sidebar: Target Selector (Ministerial Programs, Initiatives, Competitions) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5CFA7] overflow-hidden">
              <div className="bg-[#292F33] text-white px-5 py-3.5 flex items-center justify-between">
                <span className="font-bold text-sm">
                  اختر السجل المراد توثيق شواهده
                </span>
                <span className="text-[11px] bg-white/15 px-2 py-0.5 rounded tabular-nums">
                  {filteredTargets.length} سجل
                </span>
              </div>

              {/* Category Filter Tabs */}
              <div className="p-3 bg-[#FBF6EC] border-b border-[#E5CFA7]/70 grid grid-cols-4 gap-1.5 text-[11px] font-bold">
                {(
                  [
                    { key: 'all', label: 'الكل' },
                    { key: 'ministerial_program', label: 'برامج وزارية' },
                    { key: 'custom_initiative', label: 'مبادرات' },
                    { key: 'scientific_competition', label: 'مسابقات' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    data-testid={`s8-filter-${tab.key}`}
                    onClick={() => setTargetCategoryFilter(tab.key)}
                    className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                      targetCategoryFilter === tab.key
                        ? 'bg-[#8A6125] text-white'
                        : 'bg-white text-[#292F33] border border-stone-200 hover:bg-[#F7EBD5]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-stone-200/80 max-h-[620px] overflow-y-auto">
                {filteredTargets.map((item) => {
                  const isSelected = item.targetId === selectedTargetId;
                  return (
                    <button
                      key={item.targetId}
                      type="button"
                      data-testid={`s8-target-item-${item.targetId}`}
                      onClick={() => setSelectedTargetId(item.targetId)}
                      className={`w-full text-right px-4 py-3.5 transition-colors flex flex-col gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#F7EBD5] border-r-4 border-r-[#956C2E]'
                          : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                            isSelected
                              ? 'bg-[#8A6125] text-white'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {item.categoryLabel}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">
                          <span className="px-2 py-0.5 rounded bg-white border border-stone-200 text-[#956C2E]">
                            صور: {item.photosCount}/{MAX_GIFTED_EVIDENCE_PHOTOS}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-stone-200 text-[#292F33]">
                            روابط: {item.linksCount}/{MAX_GIFTED_EVIDENCE_LINKS}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-[#292F33]">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center justify-between">
                        <span>{item.stageLabel}</span>
                        <span>
                          {item.showEvidencesInReport
                            ? 'مفعّل للتقارير'
                            : 'مخفي من التقارير'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Left Main Content: Evidence Bundle Editor for Selected Target */}
            {selectedTargetMeta && (
              <div className="lg:col-span-8 space-y-6">
                {/* Selected Target Summary & Report Visibility Master Toggle */}
                <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-[#956C2E]">
                      <span>{selectedTargetMeta.categoryLabel}</span>
                      <span>•</span>
                      <span>{selectedTargetMeta.stageLabel}</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-extrabold text-[#292F33]">
                      {selectedTargetMeta.title}
                    </h4>
                    <p className="text-xs text-stone-500">
                      الفئة المستهدفة: {selectedTargetMeta.targetAudience} • الفترة:{' '}
                      {selectedTargetMeta.scheduledPeriod}
                    </p>
                  </div>

                  <label
                    data-testid="s8-master-show-in-report-toggle"
                    className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#E5CFA7] bg-[#FBF6EC] cursor-pointer select-none shrink-0"
                  >
                    <input
                      type="checkbox"
                      checked={activeEvidenceBundle.showEvidencesInReport}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        updateRecord((prev) =>
                          setTargetShowEvidencesInReportInRecord(
                            prev,
                            selectedTargetMeta.targetId,
                            checked
                          )
                        );
                      }}
                      className="w-4 h-4 accent-[#956C2E] rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#292F33] flex items-center gap-1.5">
                      {activeEvidenceBundle.showEvidencesInReport ? (
                        <Eye className="w-4 h-4 text-[#956C2E]" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-stone-400" />
                      )}
                      <span>إظهار شواهد هذا السجل في التقارير</span>
                    </span>
                  </label>
                </div>

                {/* 1. Photographic Evidences Card (Max 4 Photos in IndexedDB) */}
                <div className="bg-white rounded-2xl border border-[#E5CFA7] overflow-hidden">
                  <div className="bg-[#8A6125] text-white px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      <span className="font-bold text-sm">
                        أولاً: الشواهد المصورة (تُحفظ في IndexedDB وتُدرج في ZIP)
                      </span>
                    </div>
                    <span
                      data-testid="s8-target-photos-counter"
                      className="text-xs font-extrabold bg-white/15 px-2.5 py-1 rounded tabular-nums"
                    >
                      {activeEvidenceBundle.photos.length} /{' '}
                      {MAX_GIFTED_EVIDENCE_PHOTOS} صور
                    </span>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Upload Photo Form */}
                    <div className="rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#292F33] mb-1">
                            عنوان الشاهد المصور
                          </label>
                          <input
                            type="text"
                            data-testid="s8-photo-title-input"
                            placeholder="مثال: جانب من تنفيذ ورشة الأولمبياد"
                            value={photoTitleDraft}
                            onChange={(e) => setPhotoTitleDraft(e.target.value)}
                            disabled={
                              activeEvidenceBundle.photos.length >=
                              MAX_GIFTED_EVIDENCE_PHOTOS
                            }
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold focus:outline-none focus:border-[#956C2E] disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#292F33] mb-1">
                            وصف مختصر (اختياري)
                          </label>
                          <input
                            type="text"
                            data-testid="s8-photo-caption-input"
                            placeholder="توضيح مختصر للصورة عند العرض في التقرير"
                            value={photoCaptionDraft}
                            onChange={(e) => setPhotoCaptionDraft(e.target.value)}
                            disabled={
                              activeEvidenceBundle.photos.length >=
                              MAX_GIFTED_EVIDENCE_PHOTOS
                            }
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold focus:outline-none focus:border-[#956C2E] disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#292F33]">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoForProgramReport}
                              onChange={(e) =>
                                setPhotoForProgramReport(e.target.checked)
                              }
                              className="w-3.5 h-3.5 accent-[#956C2E]"
                            />
                            <span>إظهار في تقرير البرنامج</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoForFinalRecord}
                              onChange={(e) =>
                                setPhotoForFinalRecord(e.target.checked)
                              }
                              className="w-3.5 h-3.5 accent-[#956C2E]"
                            />
                            <span>إظهار في التقرير الختامي</span>
                          </label>
                        </div>

                        <div>
                          <input
                            ref={photoFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadEvidencePhoto}
                            className="hidden"
                            data-testid="s8-photo-file-input"
                          />
                          <button
                            type="button"
                            data-testid="s8-upload-photo-btn"
                            disabled={
                              isUploadingPhoto ||
                              activeEvidenceBundle.photos.length >=
                                MAX_GIFTED_EVIDENCE_PHOTOS
                            }
                            onClick={() => photoFileInputRef.current?.click()}
                            className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#8A6125] hover:bg-[#704E1D] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>
                              {activeEvidenceBundle.photos.length >=
                              MAX_GIFTED_EVIDENCE_PHOTOS
                                ? 'اكتمل الحد الأقصى (٤ صور)'
                                : isUploadingPhoto
                                  ? 'جاري الحفظ في IndexedDB...'
                                  : 'رفع صورة شاهد (IndexedDB)'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Photos Grid */}
                    {activeEvidenceBundle.photos.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                        لا توجد شواهد مصورة مضافة لهذا السجل حالياً. يمكنك رفع حتى ٤ صور ليتم حفظها في قاعدة IndexedDB وتضمينها في النسخة الاحتياطية ZIP.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeEvidenceBundle.photos.map((photo, idx) => {
                          const previewUrl = photoObjectUrls[photo.blobKey];
                          return (
                            <div
                              key={photo.id}
                              data-testid={`s8-photo-card-${idx + 1}`}
                              className="rounded-xl border border-[#E5CFA7] bg-white overflow-hidden flex flex-col justify-between"
                            >
                              <div className="h-40 bg-[#FBF6EC] border-b border-stone-200 flex items-center justify-center overflow-hidden relative">
                                {previewUrl ? (
                                  <img
                                    src={previewUrl}
                                    alt={photo.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="text-center p-4 text-xs text-[#956C2E] font-bold">
                                    <ImageIcon className="w-7 h-7 mx-auto mb-1 opacity-75" />
                                    <span>محفوظ في IndexedDB ({photo.blobKey})</span>
                                  </div>
                                )}
                                <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#292F33]/85 text-white text-[11px] font-bold tabular-nums">
                                  صورة {idx + 1} من {MAX_GIFTED_EVIDENCE_PHOTOS}
                                </span>
                              </div>

                              <div className="p-3.5 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-extrabold text-[#292F33]">
                                      {photo.title}
                                    </div>
                                    {photo.caption && (
                                      <div className="text-[11px] text-stone-500 mt-0.5">
                                        {photo.caption}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    data-testid={`s8-delete-photo-${idx + 1}`}
                                    onClick={() =>
                                      void handleDeleteEvidencePhoto(
                                        selectedTargetMeta.targetId,
                                        photo.id,
                                        photo.blobKey
                                      )
                                    }
                                    className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="حذف الشاهد المصور"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="pt-2 border-t border-stone-200/80 flex flex-wrap items-center gap-3 text-[11px] font-bold text-[#292F33]">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      data-testid={`s8-photo-prog-report-toggle-${idx + 1}`}
                                      checked={photo.selectedForProgramReport}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        updateRecord((prev) =>
                                          updateEvidencePhotoInTargetInRecord(
                                            prev,
                                            selectedTargetMeta.targetId,
                                            photo.id,
                                            { selectedForProgramReport: checked }
                                          )
                                        );
                                      }}
                                      className="w-3.5 h-3.5 accent-[#956C2E]"
                                    />
                                    <span>إظهار في تقرير البرنامج</span>
                                  </label>

                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      data-testid={`s8-photo-final-report-toggle-${idx + 1}`}
                                      checked={photo.selectedForFinalRecord}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        updateRecord((prev) =>
                                          updateEvidencePhotoInTargetInRecord(
                                            prev,
                                            selectedTargetMeta.targetId,
                                            photo.id,
                                            { selectedForFinalRecord: checked }
                                          )
                                        );
                                      }}
                                      className="w-3.5 h-3.5 accent-[#956C2E]"
                                    />
                                    <span>إظهار في التقرير الختامي</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Electronic Links & Auto QR Generator Card (Max 4 Links) */}
                <div className="bg-white rounded-2xl border border-[#E5CFA7] overflow-hidden">
                  <div className="bg-[#292F33] text-white px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#EFE0C2]" />
                      <span className="font-bold text-sm">
                        ثانياً: الروابط الإلكترونية الاختيارية (مع توليد QR تلقائياً لكل رابط)
                      </span>
                    </div>
                    <span
                      data-testid="s8-target-links-counter"
                      className="text-xs font-extrabold bg-white/15 px-2.5 py-1 rounded tabular-nums"
                    >
                      {activeEvidenceBundle.links.length} /{' '}
                      {MAX_GIFTED_EVIDENCE_LINKS} روابط
                    </span>
                  </div>

                  <div className="p-5 space-y-5">
                    <form
                      onSubmit={handleAddEvidenceLink}
                      className="rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#292F33] mb-1">
                            عنوان الرابط الإلكتروني
                          </label>
                          <input
                            type="text"
                            data-testid="s8-link-title-input"
                            placeholder="مثال: مجلد شواهد أسبوع الموهبة على Drive"
                            value={linkTitleDraft}
                            onChange={(e) => setLinkTitleDraft(e.target.value)}
                            disabled={
                              activeEvidenceBundle.links.length >=
                              MAX_GIFTED_EVIDENCE_LINKS
                            }
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold focus:outline-none focus:border-[#956C2E] disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#292F33] mb-1">
                            الرابط الإلكتروني (URL)
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            data-testid="s8-link-url-input"
                            placeholder="https://drive.google.com/..."
                            value={linkUrlDraft}
                            onChange={(e) => setLinkUrlDraft(e.target.value)}
                            disabled={
                              activeEvidenceBundle.links.length >=
                              MAX_GIFTED_EVIDENCE_LINKS
                            }
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold text-left focus:outline-none focus:border-[#956C2E] disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#292F33]">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkForProgramReport}
                              onChange={(e) =>
                                setLinkForProgramReport(e.target.checked)
                              }
                              className="w-3.5 h-3.5 accent-[#956C2E]"
                            />
                            <span>إظهار في تقرير البرنامج</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkForFinalRecord}
                              onChange={(e) =>
                                setLinkForFinalRecord(e.target.checked)
                              }
                              className="w-3.5 h-3.5 accent-[#956C2E]"
                            />
                            <span>إظهار في التقرير الختامي</span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          data-testid="s8-add-link-btn"
                          disabled={
                            activeEvidenceBundle.links.length >=
                            MAX_GIFTED_EVIDENCE_LINKS
                          }
                          className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#292F33] hover:bg-[#292F33] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {activeEvidenceBundle.links.length >=
                            MAX_GIFTED_EVIDENCE_LINKS
                              ? 'اكتمل الحد الأقصى (٤ روابط)'
                              : 'إضافة رابط وتوليد QR'}
                          </span>
                        </button>
                      </div>
                    </form>

                    {activeEvidenceBundle.links.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
                        الروابط الإلكترونية اختيارية. عند إضافة أي رابط (حتى ٤ روابط لكل سجل) يتم توليد رمز استجابة سريعة (QR) تلقائياً للعرض والطباعة في التقارير.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeEvidenceBundle.links.map((linkItem, idx) => {
                          const qrDataUrl = generateQrSvgDataUrl(
                            linkItem.url,
                            '#292F33',
                            '#FFFFFF',
                            2
                          );
                          return (
                            <div
                              key={linkItem.id}
                              data-testid={`s8-link-card-${idx + 1}`}
                              className="rounded-xl border border-[#E5CFA7] bg-white p-4 flex items-start gap-3.5"
                            >
                              <img
                                src={qrDataUrl}
                                alt={`QR ${linkItem.title}`}
                                data-testid={`s8-link-qr-img-${idx + 1}`}
                                className="w-20 h-20 rounded-lg border border-stone-200 shrink-0 bg-white p-1"
                              />
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-extrabold text-[#292F33] truncate">
                                      {linkItem.title}
                                    </div>
                                    <a
                                      href={linkItem.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      dir="ltr"
                                      className="text-[11px] text-[#956C2E] hover:underline inline-flex items-center gap-1 truncate max-w-full mt-0.5"
                                    >
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{linkItem.url}</span>
                                    </a>
                                  </div>
                                  <button
                                    type="button"
                                    data-testid={`s8-delete-link-${idx + 1}`}
                                    onClick={() =>
                                      updateRecord((prev) =>
                                        deleteEvidenceLinkFromTargetInRecord(
                                          prev,
                                          selectedTargetMeta.targetId,
                                          linkItem.id
                                        )
                                      )
                                    }
                                    className="p-1 rounded-lg text-red-700 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                    title="حذف الرابط"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="pt-2 border-t border-stone-200/80 flex flex-wrap items-center gap-3 text-[11px] font-bold text-[#292F33]">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      data-testid={`s8-link-prog-report-toggle-${idx + 1}`}
                                      checked={linkItem.selectedForProgramReport}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        updateRecord((prev) =>
                                          updateEvidenceLinkInTargetInRecord(
                                            prev,
                                            selectedTargetMeta.targetId,
                                            linkItem.id,
                                            { selectedForProgramReport: checked }
                                          )
                                        );
                                      }}
                                      className="w-3.5 h-3.5 accent-[#956C2E]"
                                    />
                                    <span>إظهار في تقرير البرنامج</span>
                                  </label>

                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      data-testid={`s8-link-final-report-toggle-${idx + 1}`}
                                      checked={linkItem.selectedForFinalRecord}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        updateRecord((prev) =>
                                          updateEvidenceLinkInTargetInRecord(
                                            prev,
                                            selectedTargetMeta.targetId,
                                            linkItem.id,
                                            { selectedForFinalRecord: checked }
                                          )
                                        );
                                      }}
                                      className="w-3.5 h-3.5 accent-[#956C2E]"
                                    />
                                    <span>إظهار في التقرير الختامي</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 09: المتابعة والتقييم (قراءة تلقائية لغير المنفذ + 4 حقول تقييم فقط)
         ===================================================================== */}
      {activeSection === 9 && (
        <section data-testid="gifted-section-9-view" className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#8A6125] text-white font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                09
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#8A6125] rotate-45 inline-block" />
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-[#292F33]">
                    المتابعة والتقييم الختامي
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  عرض تلقائي للبرامج والمبادرات والمسابقات والإجراءات التي حالتها «لم ينفذ» مع أسبابها من الأقسام السابقة دون إعادة إدخال، وتوثيق حقول التقييم الختامي الأربعة المعتمدة.
                </p>
              </div>
            </div>

            <div
              data-testid="s9-non-executed-count-badge"
              className="px-4 py-2.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] text-xs font-extrabold text-[#956C2E] flex items-center gap-2 shrink-0 tabular-nums"
            >
              <XCircle className="w-4 h-4" />
              <span>إجمالي البنود بحالة «لم ينفذ»: {nonExecutedItems.length}</span>
            </div>
          </div>

          {/* 1. Automatic Read-Only Table of Non-Executed Items & Reasons */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] overflow-hidden">
            <div className="bg-[#292F33] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#EFE0C2]" />
                <span className="font-bold text-sm">
                  أولاً: بيان تلقائي بالبرامج والمبادرات والمسابقات والإجراءات التي حالتها «لم ينفذ»
                </span>
              </div>
              <span className="text-[11px] bg-white/15 px-2.5 py-0.5 rounded">
                قراءة تلقائية من الأقسام ٢ و ٣ و ٦ دون إعادة إدخال
              </span>
            </div>

            <div className="p-5">
              {nonExecutedItems.length === 0 ? (
                <div
                  data-testid="s9-empty-non-executed"
                  className="rounded-xl bg-[#EEF5EE] border border-[#C5DCC7] p-5 text-center space-y-1"
                >
                  <CheckCircle2 className="w-6 h-6 text-[#2F6846] mx-auto" />
                  <div className="text-xs sm:text-sm font-extrabold text-[#2F6846]">
                    لا توجد أي برامج أو مبادرات أو مسابقات أو إجراءات مسجلة بحالة «لم ينفذ» حالياً.
                  </div>
                  <p className="text-xs text-[#2F6846]">
                    عند تغيير حالة أي بند أو إجراء قياسي إلى «لم ينفذ» في الأقسام (٢ أو ٣ أو ٦) سيظهر هنا تلقائياً مع سبب عدم التنفيذ المسجل.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    data-testid="s9-non-executed-table"
                    className="w-full text-right border-collapse text-xs"
                  >
                    <thead>
                      <tr className="bg-[#FBF6EC] text-[#292F33] border-b border-[#E5CFA7]">
                        <th className="py-3 px-3 font-extrabold w-10">#</th>
                        <th className="py-3 px-3 font-extrabold">المصدر</th>
                        <th className="py-3 px-3 font-extrabold">
                          البرنامج / الفئة الأم
                        </th>
                        <th className="py-3 px-3 font-extrabold">
                          البند أو الإجراء غير المنفذ
                        </th>
                        <th className="py-3 px-3 font-extrabold">
                          سبب عدم التنفيذ المسجل
                        </th>
                        <th className="py-3 px-3 font-extrabold w-28">
                          الانتقال للمصدر
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/80">
                      {nonExecutedItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          data-testid={`s9-non-executed-row-${idx + 1}`}
                          className="hover:bg-[#FBF6EC]/60"
                        >
                          <td className="py-3 px-3 font-bold tabular-nums text-stone-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#F7EBD5] text-[#956C2E] font-bold text-[11px]">
                              {item.sourceTypeLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-[#292F33]">
                            {item.parentTitle}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#292F33] max-w-md">
                            {item.itemTitle}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-900 border border-red-200 font-bold">
                              <XCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />
                              <span>{item.nonExecutionReason}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToSection(item.sourceSectionNumber)
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 hover:border-[#956C2E] text-[11px] font-bold text-[#292F33] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>القسم 0{item.sourceSectionNumber}</span>
                              <ArrowUpLeft className="w-3 h-3 text-[#956C2E]" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 2. The 4 Approved Final Evaluation Fields ONLY */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] overflow-hidden">
            <div className="bg-[#8A6125] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EFE0C2]" />
                <span className="font-bold text-sm">
                  ثانياً: حقول التقييم الختامي المعتمدة للسجل (٤ محاور أساسية)
                </span>
              </div>
              <span className="text-[11px] bg-white/15 px-2.5 py-0.5 rounded">
                حفظ تلقائي وتضمين مباشر في التقارير الختامية
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. الإيجابيات ونقاط القوة */}
              <div className="rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] p-4 space-y-2">
                <label
                  htmlFor="s9-eval-strengths"
                  className="block text-xs sm:text-sm font-extrabold text-[#956C2E]"
                >
                  ١. الإيجابيات ونقاط القوة
                </label>
                <p className="text-[11px] text-stone-500">
                  أبرز عوامل النجاح والتميز في تنفيذ برامج ورعاية الموهوبين خلال الفصل الدراسي.
                </p>
                <textarea
                  id="s9-eval-strengths"
                  data-testid="s9-eval-strengths"
                  rows={4}
                  value={record.evaluation.strengths}
                  onChange={(e) => {
                    const strengths = e.target.value;
                    updateRecord((prev) =>
                      updateGiftedEvaluationSummaryInRecord(prev, { strengths })
                    );
                  }}
                  placeholder="اكتب الإيجابيات ونقاط القوة المرصودة..."
                  className="w-full p-3 rounded-lg bg-white border border-stone-300 text-xs sm:text-sm font-medium text-[#292F33] focus:outline-none focus:border-[#956C2E]"
                />
              </div>

              {/* 2. الصعوبات والتحديات */}
              <div className="rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] p-4 space-y-2">
                <label
                  htmlFor="s9-eval-challenges"
                  className="block text-xs sm:text-sm font-extrabold text-[#956C2E]"
                >
                  ٢. الصعوبات والتحديات
                </label>
                <p className="text-[11px] text-stone-500">
                  المعوقات أو التحديات التي واجهت تنفيذ بعض البرامج والحلول المتخذة لمعالجتها.
                </p>
                <textarea
                  id="s9-eval-challenges"
                  data-testid="s9-eval-challenges"
                  rows={4}
                  value={record.evaluation.challenges}
                  onChange={(e) => {
                    const challenges = e.target.value;
                    updateRecord((prev) =>
                      updateGiftedEvaluationSummaryInRecord(prev, { challenges })
                    );
                  }}
                  placeholder="اكتب الصعوبات والتحديات المرصودة..."
                  className="w-full p-3 rounded-lg bg-white border border-stone-300 text-xs sm:text-sm font-medium text-[#292F33] focus:outline-none focus:border-[#956C2E]"
                />
              </div>

              {/* 3. الجهات الداعمة إن وجدت */}
              <div className="rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] p-4 space-y-2">
                <label
                  htmlFor="s9-eval-supporting-entities"
                  className="block text-xs sm:text-sm font-extrabold text-[#956C2E]"
                >
                  ٣. الجهات الداعمة إن وجدت
                </label>
                <p className="text-[11px] text-stone-500">
                  الجهات أو الشراكات المدرسية والمجتمعية الداعمة لبرامج ومبادرات الموهوبين.
                </p>
                <textarea
                  id="s9-eval-supporting-entities"
                  data-testid="s9-eval-supporting-entities"
                  rows={4}
                  value={record.evaluation.supportingEntities}
                  onChange={(e) => {
                    const supportingEntities = e.target.value;
                    updateRecord((prev) =>
                      updateGiftedEvaluationSummaryInRecord(prev, {
                        supportingEntities,
                      })
                    );
                  }}
                  placeholder="مثال: قسم الموهوبين بالإدارة التعليمية، إدارة المدرسة، أولياء الأمور..."
                  className="w-full p-3 rounded-lg bg-white border border-stone-300 text-xs sm:text-sm font-medium text-[#292F33] focus:outline-none focus:border-[#956C2E]"
                />
              </div>

              {/* 4. المقترحات التطويرية */}
              <div className="rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] p-4 space-y-2">
                <label
                  htmlFor="s9-eval-improvement-proposals"
                  className="block text-xs sm:text-sm font-extrabold text-[#956C2E]"
                >
                  ٤. المقترحات التطويرية
                </label>
                <p className="text-[11px] text-stone-500">
                  التوصيات والمقترحات التطويرية لتجويد برامج رعاية الموهوبين في الفصول القادمة.
                </p>
                <textarea
                  id="s9-eval-improvement-proposals"
                  data-testid="s9-eval-improvement-proposals"
                  rows={4}
                  value={record.evaluation.improvementProposals}
                  onChange={(e) => {
                    const improvementProposals = e.target.value;
                    updateRecord((prev) =>
                      updateGiftedEvaluationSummaryInRecord(prev, {
                        improvementProposals,
                      })
                    );
                  }}
                  placeholder="اكتب المقترحات التطويرية..."
                  className="w-full p-3 rounded-lg bg-white border border-stone-300 text-xs sm:text-sm font-medium text-[#292F33] focus:outline-none focus:border-[#956C2E]"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          SECTION 10: التقارير النهائية والدورية (النماذج الثلاثة المعتمدة بصيغة PDF)
         ===================================================================== */}
      {activeSection === 10 && (
        <section data-testid="gifted-section-10-view" className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#8A6125] text-white font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                10
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#8A6125] rotate-45 inline-block" />
                  <h3 className="text-lg sm:text-xl font-extrabold font-display text-[#292F33]">
                    التقارير النهائية والدورية المعتمدة (توليد تلقائي وتصدير A4 PDF)
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  تُسحب جميع البيانات تلقائياً من الأقسام السابقة (١ إلى ٩) دون إعادة إدخال، وتظهر الشواهد فقط إذا اختارها المنسق في القسم الثامن، مع تصدير فوري بصيغة A4 PDF بالهوية العنابية والفحمية.
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="s10-export-pdf-btn"
              disabled={isExportingPdf}
              onClick={() => void handleExportCurrentReportPdf()}
              className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#8A6125] hover:bg-[#704E1D] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExportingPdf
                  ? 'جاري تجهيز ملف PDF...'
                  : 'تصدير التقرير المعروض بصيغة A4 PDF'}
              </span>
            </button>
          </div>

          {pdfFeedback && (
            <div
              data-testid="s10-pdf-feedback"
              className="rounded-xl bg-[#F7EBD5] border border-[#E5CFA7] px-4 py-3 text-xs sm:text-sm font-bold text-[#956C2E] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>{pdfFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setPdfFeedback(null)}
                className="text-xs underline cursor-pointer shrink-0"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* 3 Approved Report Type Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              data-testid="s10-tab-program-or-event"
              onClick={() => setActiveReportTab('program_or_event')}
              className={`text-right rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                activeReportTab === 'program_or_event'
                  ? 'bg-[#8A6125] text-white border-[#956C2E] shadow-xs'
                  : 'bg-white hover:bg-[#FBF6EC] text-[#292F33] border-[#E5CFA7]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                    activeReportTab === 'program_or_event'
                      ? 'bg-white text-[#956C2E]'
                      : 'bg-[#F7EBD5] text-[#956C2E]'
                  }`}
                >
                  النموذج الأول (ص ١١ و ٢٤)
                </span>
                <FileText className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-sm font-extrabold">
                  ١. تقرير برنامج أو فعالية
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    activeReportTab === 'program_or_event'
                      ? 'text-stone-200'
                      : 'text-stone-500'
                  }`}
                >
                  معلومات عامة + بيانات عن الفعالية والشواهد المختارة
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="s10-tab-innovation-progress"
              onClick={() => setActiveReportTab('innovation_space_progress')}
              className={`text-right rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                activeReportTab === 'innovation_space_progress'
                  ? 'bg-[#8A6125] text-white border-[#956C2E] shadow-xs'
                  : 'bg-white hover:bg-[#FBF6EC] text-[#292F33] border-[#E5CFA7]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                    activeReportTab === 'innovation_space_progress'
                      ? 'bg-white text-[#956C2E]'
                      : 'bg-[#F7EBD5] text-[#956C2E]'
                  }`}
                >
                  النموذج الثاني (ص ٢١)
                </span>
                <Layers className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-sm font-extrabold">
                  ٢. التقرير المرحلي لبرنامج مساحة الابتكار
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    activeReportTab === 'innovation_space_progress'
                      ? 'text-stone-200'
                      : 'text-stone-500'
                  }`}
                >
                  البيانات الأساسية + بيانات التنفيذ والمخرجات المتميزة
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="s10-tab-final-record"
              onClick={() => setActiveReportTab('final_administrative_record')}
              className={`text-right rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                activeReportTab === 'final_administrative_record'
                  ? 'bg-[#8A6125] text-white border-[#956C2E] shadow-xs'
                  : 'bg-white hover:bg-[#FBF6EC] text-[#292F33] border-[#E5CFA7]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                    activeReportTab === 'final_administrative_record'
                      ? 'bg-white text-[#956C2E]'
                      : 'bg-[#F7EBD5] text-[#956C2E]'
                  }`}
                >
                  النموذج الثالث (الختامي الموحد)
                </span>
                <FileCheck2 className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-sm font-extrabold">
                  ٣. التقرير الإداري الختامي المختصر والشامل
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    activeReportTab === 'final_administrative_record'
                      ? 'text-stone-200'
                      : 'text-stone-500'
                  }`}
                >
                  مختصر واحترافي افتراضياً مع خيار تضمين التفاصيل دون تكرار
                </div>
              </div>
            </button>
          </div>

          {/* =================================================================
              REPORT 1 VIEW: تقرير برنامج أو فعالية (ص 11 و 24)
             ================================================================= */}
          {activeReportTab === 'program_or_event' && (
            <div
              data-testid="s10-report-program-or-event-view"
              className="space-y-5"
            >
              {/* Program/Event Selector + Optional Completion Fields */}
              <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200/80 pb-4">
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-[#292F33]">
                      إعدادات «تقرير برنامج أو فعالية» (مطابق لصفحتي ١١ و ٢٤)
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                      اختر البرنامج الوزاري أو المبادرة أو المسابقة ليتم تعبئة التقرير تلقائياً من السجل، مع إمكانية استكمال اليوم أو المدة عند الحاجة.
                    </p>
                  </div>

                  <div className="min-w-[260px]">
                    <label
                      htmlFor="s10-program-report-select"
                      className="block text-xs font-bold text-[#956C2E] mb-1"
                    >
                      البرنامج / الفعالية المستهدفة بالتقرير
                    </label>
                    <select
                      id="s10-program-report-select"
                      data-testid="s10-program-report-select"
                      value={reportTargetId}
                      onChange={(e) => setReportTargetId(e.target.value)}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] text-xs font-bold text-[#292F33] focus:outline-none focus:border-[#956C2E]"
                    >
                      {targetsCatalog.map((t) => (
                        <option key={t.targetId} value={t.targetId}>
                          [{t.categoryLabel}] {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional Override Inputs (Day, Duration, Beneficiaries) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      اليوم (استكمال اختياري)
                    </label>
                    <input
                      type="text"
                      data-testid="s10-prog-day-input"
                      placeholder={programOrEventReportModel.generalInfo.dayLabel}
                      value={
                        record.programReportsOverrides?.[reportTargetId]
                          ?.dayLabel || ''
                      }
                      onChange={(e) => {
                        const dayLabel = e.target.value;
                        updateRecord((prev) =>
                          updateProgramEventReportOverridesInRecord(
                            prev,
                            reportTargetId,
                            { dayLabel }
                          )
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      مدة التنفيذ (استكمال اختياري)
                    </label>
                    <input
                      type="text"
                      data-testid="s10-prog-duration-input"
                      placeholder={
                        programOrEventReportModel.generalInfo.durationLabel
                      }
                      value={
                        record.programReportsOverrides?.[reportTargetId]
                          ?.durationLabel || ''
                      }
                      onChange={(e) => {
                        const durationLabel = e.target.value;
                        updateRecord((prev) =>
                          updateProgramEventReportOverridesInRecord(
                            prev,
                            reportTargetId,
                            { durationLabel }
                          )
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      عدد المستفيدين (يُحسب تلقائياً أو يُعدل)
                    </label>
                    <input
                      type="text"
                      data-testid="s10-prog-beneficiaries-input"
                      placeholder={
                        programOrEventReportModel.eventData.beneficiariesCount
                      }
                      value={
                        record.programReportsOverrides?.[reportTargetId]
                          ?.beneficiariesCountOverride || ''
                      }
                      onChange={(e) => {
                        const beneficiariesCountOverride = e.target.value;
                        updateRecord((prev) =>
                          updateProgramEventReportOverridesInRecord(
                            prev,
                            reportTargetId,
                            { beneficiariesCountOverride }
                          )
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                </div>
              </div>

              {/* Official A4 Preview of Report 1 (Pages 11 & 24) */}
              <div
                data-testid="s10-program-report-a4-preview"
                className="bg-white rounded-2xl border-2 border-[#E5CFA7] overflow-hidden shadow-xs"
              >
                {/* Official Report Header */}
                <div className="bg-[#8A6125] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#EFE0C2]">
                      المملكة العربية السعودية • وزارة التعليم •{' '}
                      {programOrEventReportModel.basicInfo.educationDepartment}
                    </div>
                    <h4 className="text-lg sm:text-xl font-extrabold font-display">
                      تقرير برنامج أو فعالية —{' '}
                      {programOrEventReportModel.generalInfo.eventName}
                    </h4>
                    <div className="text-xs text-stone-200">
                      {programOrEventReportModel.basicInfo.schoolName} •{' '}
                      {programOrEventReportModel.basicInfo.academicYear} (
                      {programOrEventReportModel.basicInfo.semesterLabel})
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-bold shrink-0">
                    {programOrEventReportModel.sourcePagesLabel}
                  </span>
                </div>

                <div className="p-5 sm:p-6 space-y-6">
                  {/* أولاً: معلومات عامة */}
                  <div className="space-y-3">
                    <div className="bg-[#8A6125] text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-between">
                      <span>أولاً: معلومات عامة</span>
                      <span className="text-[11px] text-[#EFE0C2]">
                        {programOrEventReportModel.targetCategoryLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">اسم الفعالية</div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {programOrEventReportModel.generalInfo.eventName}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">اليوم</div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {programOrEventReportModel.generalInfo.dayLabel}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">التاريخ</div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {programOrEventReportModel.generalInfo.executionDate}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">مدة التنفيذ</div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {programOrEventReportModel.generalInfo.durationLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ثانياً: بيانات عن الفعالية */}
                  <div className="space-y-3">
                    <div className="bg-[#292F33] text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold">
                      ثانياً: بيانات عن الفعالية
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">الهدف</div>
                        <div className="font-bold text-[#292F33] mt-1 leading-relaxed">
                          {programOrEventReportModel.eventData.objective}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                          <div className="text-[#956C2E] font-bold">
                            الفئة المستهدفة
                          </div>
                          <div className="font-bold text-[#292F33] mt-1">
                            {programOrEventReportModel.eventData.targetAudience}
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                          <div className="text-[#956C2E] font-bold">
                            عدد المستفيدين
                          </div>
                          <div className="font-extrabold text-[#292F33] mt-1">
                            {
                              programOrEventReportModel.eventData
                                .beneficiariesCount
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7] text-xs space-y-1">
                      <div className="text-[#956C2E] font-extrabold">
                        آلية التنفيذ (مسحوبة تلقائياً من الإجراءات المنفذة)
                      </div>
                      <div className="font-semibold text-[#292F33] whitespace-pre-line leading-relaxed">
                        {programOrEventReportModel.eventData.executionMechanism}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-extrabold">
                          الصعوبات
                        </div>
                        <div className="font-semibold text-[#292F33] mt-1">
                          {programOrEventReportModel.eventData.difficulties}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-extrabold">
                          الاقتراحات
                        </div>
                        <div className="font-semibold text-[#292F33] mt-1">
                          {programOrEventReportModel.eventData.suggestions}
                        </div>
                      </div>
                    </div>

                    {/* شواهد التنفيذ المختارة فقط */}
                    <div
                      data-testid="s10-prog-report-evidences-box"
                      className="p-4 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#956C2E]">
                          شواهد التنفيذ (تظهر فقط عند اختيارها من قِبل المنسق في القسم ٨)
                        </span>
                        <span className="text-[11px] font-bold text-stone-600 tabular-nums">
                          صور مختارة:{' '}
                          {programOrEventReportModel.eventData.selectedPhotos.length}{' '}
                          • روابط QR مختارة:{' '}
                          {programOrEventReportModel.eventData.selectedLinks.length}
                        </span>
                      </div>

                      {!programOrEventReportModel.eventData.showEvidences ? (
                        <div className="text-xs text-stone-500">
                          لم يتم تحديد شواهد لإظهارها في تقرير هذا البرنامج. يمكنك تحديد الصور أو روابط QR المطلوبة من القسم الثامن (مستودع الشواهد).
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {programOrEventReportModel.eventData.selectedPhotos
                            .length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {programOrEventReportModel.eventData.selectedPhotos.map(
                                (p) => (
                                  <div
                                    key={p.id}
                                    className="rounded-lg bg-white border border-stone-200 p-2 text-center space-y-1"
                                  >
                                    {photoObjectUrls[p.blobKey] ? (
                                      <img
                                        src={photoObjectUrls[p.blobKey]}
                                        alt={p.title}
                                        className="w-full h-24 object-cover rounded"
                                      />
                                    ) : (
                                      <div className="h-24 rounded bg-[#F7EBD5] flex items-center justify-center text-[11px] font-bold text-[#956C2E]">
                                        شاهد مصور
                                      </div>
                                    )}
                                    <div className="text-[11px] font-bold text-[#292F33] truncate">
                                      {p.title}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {programOrEventReportModel.eventData.selectedLinks
                            .length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {programOrEventReportModel.eventData.selectedLinks.map(
                                (l) => (
                                  <div
                                    key={l.id}
                                    className="rounded-lg bg-white border border-stone-200 p-2.5 flex items-center gap-3"
                                  >
                                    <img
                                      src={generateQrSvgDataUrl(
                                        l.url,
                                        '#292F33',
                                        '#FFFFFF',
                                        2
                                      )}
                                      alt={l.title}
                                      className="w-14 h-14 rounded border border-stone-200 shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-extrabold text-[#292F33] truncate">
                                        {l.title}
                                      </div>
                                      <div
                                        dir="ltr"
                                        className="text-[11px] text-[#956C2E] truncate"
                                      >
                                        {l.url}
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Official Signoff Strip */}
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-stone-200 text-center text-xs">
                    <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="font-bold text-[#956C2E]">
                        {programOrEventReportModel.basicInfo.coordinatorTitle}
                      </div>
                      <div className="font-extrabold text-[#292F33] mt-1">
                        {programOrEventReportModel.basicInfo.coordinatorName}
                      </div>
                      <div className="text-stone-500 font-semibold mt-1.5">
                        التوقيع
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="font-bold text-[#956C2E]">
                        {programOrEventReportModel.basicInfo.principalTitle}
                      </div>
                      <div className="font-extrabold text-[#292F33] mt-1">
                        {programOrEventReportModel.basicInfo.principalName}
                      </div>
                      <div className="text-stone-500 font-semibold mt-1.5">
                        التوقيع
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              REPORT 2 VIEW: التقرير المرحلي لبرنامج مساحة الابتكار (ص 21)
             ================================================================= */}
          {activeReportTab === 'innovation_space_progress' && (
            <div
              data-testid="s10-report-innovation-progress-view"
              className="space-y-5"
            >
              {/* Optional Completion Controls for Page 21 */}
              <div className="bg-white rounded-2xl border border-[#E5CFA7] p-5 space-y-4">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#292F33]">
                    استكمال حقول «التقرير المرحلي لبرنامج مساحة الابتكار» (مطابق لصفحة ٢١)
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    تُسحب البيانات الأساسية والوحدات الإثرائية وأعداد المستفيدين والتقييم تلقائياً من السجل، ويمكنك تخصيص أعداد المخرجات أو اسم معلم مساحة الابتكار عند الحاجة.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      {innovationProgressReportModel.basicData.innovationTeacherTitle}
                    </label>
                    <input
                      type="text"
                      data-testid="s10-innov-teacher-input"
                      placeholder={
                        innovationProgressReportModel.basicData
                          .innovationTeacherName
                      }
                      value={
                        record.innovationProgressReportOverrides
                          ?.innovationTeacherName || ''
                      }
                      onChange={(e) => {
                        const innovationTeacherName = e.target.value;
                        updateRecord((prev) =>
                          updateInnovationProgressReportOverridesInRecord(prev, {
                            innovationTeacherName,
                          })
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      الوحدة الإثرائية
                    </label>
                    <input
                      type="text"
                      data-testid="s10-innov-unit-input"
                      placeholder={
                        innovationProgressReportModel.executionData.enrichmentUnit
                      }
                      value={
                        record.innovationProgressReportOverrides
                          ?.enrichmentUnitOverride || ''
                      }
                      onChange={(e) => {
                        const enrichmentUnitOverride = e.target.value;
                        updateRecord((prev) =>
                          updateInnovationProgressReportOverridesInRecord(prev, {
                            enrichmentUnitOverride,
                          })
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      عدد المخرجات
                    </label>
                    <input
                      type="text"
                      data-testid="s10-innov-outputs-input"
                      placeholder={
                        innovationProgressReportModel.executionData.outputsCount
                      }
                      value={
                        record.innovationProgressReportOverrides?.outputsCount ||
                        ''
                      }
                      onChange={(e) => {
                        const outputsCount = e.target.value;
                        updateRecord((prev) =>
                          updateInnovationProgressReportOverridesInRecord(prev, {
                            outputsCount,
                          })
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#292F33] mb-1">
                      عدد المخرجات المتميزة
                    </label>
                    <input
                      type="text"
                      data-testid="s10-innov-distinguished-count-input"
                      placeholder={
                        innovationProgressReportModel.executionData
                          .distinguishedOutputsCount
                      }
                      value={
                        record.innovationProgressReportOverrides
                          ?.distinguishedOutputsCount || ''
                      }
                      onChange={(e) => {
                        const distinguishedOutputsCount = e.target.value;
                        updateRecord((prev) =>
                          updateInnovationProgressReportOverridesInRecord(prev, {
                            distinguishedOutputsCount,
                          })
                        );
                      }}
                      className="w-full min-h-[36px] px-3 py-1 rounded-lg bg-[#FBF6EC] border border-stone-300 font-semibold focus:outline-none focus:border-[#956C2E]"
                    />
                  </div>
                </div>
              </div>

              {/* Official A4 Preview of Report 2 (Page 21) */}
              <div
                data-testid="s10-innovation-report-a4-preview"
                className="bg-white rounded-2xl border-2 border-[#E5CFA7] overflow-hidden shadow-xs"
              >
                <div className="bg-[#8A6125] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#EFE0C2]">
                      المملكة العربية السعودية • وزارة التعليم •{' '}
                      {innovationProgressReportModel.basicData.educationDepartment}
                    </div>
                    <h4 className="text-lg sm:text-xl font-extrabold font-display">
                      التقرير المرحلي لبرنامج مساحة الابتكار
                    </h4>
                    <div className="text-xs text-stone-200">
                      {innovationProgressReportModel.basicData.schoolName} •{' '}
                      {innovationProgressReportModel.basicData.semesterLabel}
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-bold shrink-0">
                    {innovationProgressReportModel.sourcePagesLabel}
                  </span>
                </div>

                <div className="p-5 sm:p-6 space-y-6">
                  {/* أولاً: البيانات الأساسية */}
                  <div className="space-y-3">
                    <div className="bg-[#8A6125] text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold">
                      أولاً: البيانات الأساسية
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          الإدارة التعليمية
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.basicData
                              .educationDepartment
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          الفصل الدراسي
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {innovationProgressReportModel.basicData.semesterLabel}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">المدرسة</div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {innovationProgressReportModel.basicData.schoolName}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          {innovationProgressReportModel.basicData.principalTitle}
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {innovationProgressReportModel.basicData.principalName}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          المرحلة التعليمية
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.basicData
                              .educationalStage
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          {
                            innovationProgressReportModel.basicData
                              .innovationTeacherTitle
                          }
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.basicData
                              .innovationTeacherName
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ثانياً: بيانات التنفيذ */}
                  <div className="space-y-3">
                    <div className="bg-[#292F33] text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-between">
                      <span>ثانياً: بيانات التنفيذ</span>
                      <span className="text-[11px] text-[#EFE0C2] tabular-nums">
                        الإجراءات القياسية المنفذة:{' '}
                        {
                          innovationProgressReportModel.executionData
                            .executedActionsCount
                        }{' '}
                        من{' '}
                        {
                          innovationProgressReportModel.executionData
                            .totalActionsCount
                        }
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          الوحدة الإثرائية
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.executionData
                              .enrichmentUnit
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          المرحلة الدراسية
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.executionData
                              .targetGrade
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          عدد المستفيدين
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1 tabular-nums">
                          {
                            innovationProgressReportModel.executionData
                              .beneficiariesCount
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          عدد المخرجات
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1 tabular-nums">
                          {
                            innovationProgressReportModel.executionData
                              .outputsCount
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          عدد المخرجات المتميزة
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1 tabular-nums">
                          {
                            innovationProgressReportModel.executionData
                              .distinguishedOutputsCount
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-bold">
                          الجهات الداعمة إن وجدت
                        </div>
                        <div className="font-extrabold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.executionData
                              .supportingEntities
                          }
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7] text-xs">
                      <div className="text-[#956C2E] font-extrabold">
                        وصف مختصر للمخرجات المتميزة
                      </div>
                      <div className="font-semibold text-[#292F33] mt-1 leading-relaxed">
                        {
                          innovationProgressReportModel.executionData
                            .distinguishedOutputsSummary
                        }
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-extrabold">
                          الإيجابيات
                        </div>
                        <div className="font-semibold text-[#292F33] mt-1">
                          {innovationProgressReportModel.executionData.strengths}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-extrabold">
                          التحديات
                        </div>
                        <div className="font-semibold text-[#292F33] mt-1">
                          {innovationProgressReportModel.executionData.challenges}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5CFA7]">
                        <div className="text-[#956C2E] font-extrabold">
                          المقترحات التطويرية
                        </div>
                        <div className="font-semibold text-[#292F33] mt-1">
                          {
                            innovationProgressReportModel.executionData
                              .improvementProposals
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              REPORT 3 VIEW: التقرير الإداري الختامي المختصر والشامل بصيغة PDF
             ================================================================= */}
          {activeReportTab === 'final_administrative_record' && (
            <div
              data-testid="s10-report-final-record-view"
              className="space-y-5"
            >
              {/* Mode Selector Bar (Concise Default vs Detailed) */}
              <div className="bg-white rounded-2xl border border-[#E5CFA7] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-[#292F33]">
                    مستوى عرض «التقرير الإداري الختامي»
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    التقرير مختصر واحترافي افتراضياً لسهولة المراجعة الإدارية، مع خيار تضمين التفاصيل الكاملة للإجراءات والطلاب دون تكرار للمعلومات.
                  </p>
                </div>

                <div className="inline-flex rounded-xl bg-[#FBF6EC] p-1 border border-[#E5CFA7] shrink-0">
                  <button
                    type="button"
                    data-testid="s10-final-mode-concise"
                    onClick={() => setFinalReportMode('concise')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                      finalReportMode === 'concise'
                        ? 'bg-[#8A6125] text-white'
                        : 'text-[#292F33] hover:bg-white'
                    }`}
                  >
                    نسخة تنفيذية مختصرة (افتراضي)
                  </button>
                  <button
                    type="button"
                    data-testid="s10-final-mode-detailed"
                    onClick={() => setFinalReportMode('detailed')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                      finalReportMode === 'detailed'
                        ? 'bg-[#8A6125] text-white'
                        : 'text-[#292F33] hover:bg-white'
                    }`}
                  >
                    تضمين التفاصيل الكاملة
                  </button>
                </div>
              </div>

              {/* Official A4 Preview of Final Administrative Report */}
              <div
                data-testid="s10-final-report-a4-preview"
                className="bg-white rounded-2xl border-2 border-[#E5CFA7] overflow-hidden shadow-xs space-y-6"
              >
                {/* Header */}
                <div className="bg-[#8A6125] text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#EFE0C2]">
                      المملكة العربية السعودية • وزارة التعليم •{' '}
                      {finalRecordReportModel.basicInfo.educationDepartment}
                    </div>
                    <h4 className="text-xl font-extrabold font-display">
                      التقرير الإداري الختامي لسجل منسق الموهوبين
                    </h4>
                    <div className="text-xs text-stone-200">
                      {finalRecordReportModel.basicInfo.schoolName} (
                      {finalRecordReportModel.basicInfo.schoolStageLabel}) •{' '}
                      {finalRecordReportModel.basicInfo.academicYear} —{' '}
                      {finalRecordReportModel.basicInfo.semesterLabel}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="px-3 py-1 rounded-lg bg-white/15 text-xs font-extrabold">
                      {finalReportMode === 'detailed'
                        ? 'نسخة شاملة ومفصلة'
                        : 'نسخة تنفيذية مختصرة وشاملة'}
                    </span>
                    <span className="text-[11px] text-[#EFE0C2]">
                      {finalRecordReportModel.basicInfo.coordinatorTitle}:{' '}
                      {finalRecordReportModel.basicInfo.coordinatorName}
                    </span>
                  </div>
                </div>

                <div className="px-6 pb-6 space-y-6">
                  {/* 1. Dual Completion Indicators Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="text-[#956C2E] font-bold">
                        مؤشر إنجاز الخطة التنفيذية (القسم ٢)
                      </div>
                      <div className="text-xl font-extrabold text-[#292F33] mt-1 tabular-nums">
                        {
                          finalRecordReportModel.completionMetrics
                            .executivePlanMetrics.completionPercentage
                        }
                        %
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                        نفذ{' '}
                        {
                          finalRecordReportModel.completionMetrics
                            .executivePlanMetrics.executed
                        }{' '}
                        من{' '}
                        {
                          finalRecordReportModel.completionMetrics
                            .executivePlanMetrics.totalActive
                        }
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="text-[#956C2E] font-bold">
                        مؤشر إنجاز إجراءات البرامج (القسم ٦)
                      </div>
                      <div className="text-xl font-extrabold text-[#292F33] mt-1 tabular-nums">
                        {
                          finalRecordReportModel.completionMetrics
                            .programActionsMetrics.completionPercentage
                        }
                        %
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                        نفذ{' '}
                        {
                          finalRecordReportModel.completionMetrics
                            .programActionsMetrics.executed
                        }{' '}
                        من{' '}
                        {
                          finalRecordReportModel.completionMetrics
                            .programActionsMetrics.totalActive
                        }{' '}
                        إجراء قياسي
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="text-[#956C2E] font-bold">
                        إجمالي الطلبة الموهوبين (القسم ٧)
                      </div>
                      <div className="text-xl font-extrabold text-[#292F33] mt-1 tabular-nums">
                        {finalRecordReportModel.studentsSummary.totalStudents}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                        المشاركات:{' '}
                        {
                          finalRecordReportModel.studentsSummary
                            .totalParticipations
                        }{' '}
                        • المتأهلون:{' '}
                        {
                          finalRecordReportModel.studentsSummary
                            .qualifiedStudentsCount
                        }
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="text-[#956C2E] font-bold">
                        الشواهد المختارة للتقرير الختامي
                      </div>
                      <div className="text-xl font-extrabold text-[#292F33] mt-1 tabular-nums">
                        {finalRecordReportModel.selectedEvidenceGroups.reduce(
                          (acc, g) => acc + g.photos.length + g.links.length,
                          0
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                        موزعة على{' '}
                        {finalRecordReportModel.selectedEvidenceGroups.length}{' '}
                        برامج/مبادرات
                      </div>
                    </div>
                  </div>

                  {/* 2. Applicable Ministerial Programs Table */}
                  <div className="space-y-2.5">
                    <div className="bg-[#8A6125] text-white px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-between">
                      <span>
                        ملخص البرامج الوزارية المطبقة على مرحلة المدرسة (
                        {finalRecordReportModel.applicablePrograms.length} برامج)
                      </span>
                      <span className="text-[11px] text-[#EFE0C2]">
                        تُحتسب النسبة من الإجراءات القياسية المفعلة
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FBF6EC] text-[#292F33] border-b border-[#E5CFA7]">
                            <th className="py-2.5 px-3 font-extrabold">
                              البرنامج الوزاري
                            </th>
                            <th className="py-2.5 px-3 font-extrabold">
                              الفئة المستهدفة
                            </th>
                            <th className="py-2.5 px-3 font-extrabold">
                              الإجراءات المنفذة
                            </th>
                            <th className="py-2.5 px-3 font-extrabold">
                              نسبة الإنجاز
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200/80">
                          {finalRecordReportModel.applicablePrograms.map(
                            (prog) => (
                              <tr key={prog.id}>
                                <td className="py-2.5 px-3 font-extrabold text-[#292F33]">
                                  {prog.title}
                                </td>
                                <td className="py-2.5 px-3 text-stone-600">
                                  {prog.targetAudience}
                                </td>
                                <td className="py-2.5 px-3 font-bold tabular-nums">
                                  {prog.executedCount} / {prog.totalCount}
                                </td>
                                <td className="py-2.5 px-3 font-extrabold text-[#956C2E] tabular-nums">
                                  {prog.completionPercentage}%
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Optional Detailed View Section (Only rendered when finalReportMode === 'detailed') */}
                  {finalReportMode === 'detailed' && (
                    <div
                      data-testid="s10-final-detailed-breakdown"
                      className="space-y-4 pt-2 border-t border-[#E5CFA7]"
                    >
                      <div className="bg-[#292F33] text-white px-4 py-2 rounded-lg text-xs font-extrabold">
                        ملحق تفصيلي: الإجراءات المنفذة فعلياً وقائمة الطلبة المشاركين (يظهر في الوضع الشامل المفصل)
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {finalRecordReportModel.applicablePrograms.map((p) => (
                          <div
                            key={p.id}
                            className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] space-y-1.5"
                          >
                            <div className="font-extrabold text-[#956C2E] flex items-center justify-between">
                              <span>{p.title}</span>
                              <span className="tabular-nums">
                                {p.executedCount}/{p.totalCount}
                              </span>
                            </div>
                            {p.executedActionsTexts.length === 0 ? (
                              <div className="text-[11px] text-stone-500">
                                لا توجد إجراءات منفذة مسجلة بعد.
                              </div>
                            ) : (
                              <ul className="list-disc list-inside space-y-1 text-[11px] text-[#292F33] font-medium">
                                {p.executedActionsTexts.map((txt, i) => (
                                  <li key={i}>{txt}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Selected Evidences for Final Record */}
                  {finalRecordReportModel.selectedEvidenceGroups.length > 0 && (
                    <div
                      data-testid="s10-final-selected-evidences"
                      className="space-y-3"
                    >
                      <div className="bg-[#292F33] text-white px-4 py-2 rounded-lg text-xs font-extrabold">
                        الشواهد المختارة للتقرير الختامي (بحسب اختيار المنسق في القسم الثامن)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {finalRecordReportModel.selectedEvidenceGroups.map(
                          (group) => (
                            <div
                              key={group.targetId}
                              className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7] space-y-2 text-xs"
                            >
                              <div className="font-extrabold text-[#956C2E]">
                                [{group.targetCategoryLabel}] {group.targetTitle}
                              </div>
                              <div className="text-[11px] text-[#292F33] font-semibold">
                                صور مختارة: {group.photos.length} • روابط QR
                                مختارة: {group.links.length}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. Final Evaluation (4 Fields) & Non-Executed Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="font-extrabold text-[#956C2E]">
                        ١. الإيجابيات ونقاط القوة
                      </div>
                      <div className="font-semibold text-[#292F33] mt-1">
                        {finalRecordReportModel.evaluation.strengths ||
                          'لا توجد بيانات مسجلة'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="font-extrabold text-[#956C2E]">
                        ٢. الصعوبات والتحديات
                      </div>
                      <div className="font-semibold text-[#292F33] mt-1">
                        {finalRecordReportModel.evaluation.challenges ||
                          'لا توجد بيانات مسجلة'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="font-extrabold text-[#956C2E]">
                        ٣. الجهات الداعمة إن وجدت
                      </div>
                      <div className="font-semibold text-[#292F33] mt-1">
                        {finalRecordReportModel.evaluation.supportingEntities ||
                          'لا توجد بيانات مسجلة'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FBF6EC] border border-[#E5CFA7]">
                      <div className="font-extrabold text-[#956C2E]">
                        ٤. المقترحات التطويرية
                      </div>
                      <div className="font-semibold text-[#292F33] mt-1">
                        {finalRecordReportModel.evaluation
                          .improvementProposals ||
                          'لا توجد بيانات مسجلة'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
};
