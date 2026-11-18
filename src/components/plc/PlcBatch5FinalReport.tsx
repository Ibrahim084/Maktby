import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { SchoolSettings } from '../../types';
import {
  buildPlcFinalReport,
  PlcCommunityRecord,
  PlcFinalReportChartModel,
  regeneratePlcFinalReport,
  updatePlcFinalReportNotes,
} from '../../utils/plcEngine';
import {
  generatePlcDetailedReportPdfArtifact,
  preloadPlcEvidenceImages,
  renderPlcDetailedReportPagesToCanvases,
} from '../../utils/plcDetailedReportPdfGenerator';
import {
  generatePlcFinalReportPdfArtifact,
  PLC_REPORT_DESIGN_SYSTEM,
  preloadPlcMoeLogo,
  renderPlcFinalReportPagesToCanvases,
  resolveEvidenceActionUri,
  selectKeyEvidencesForExecutiveReport,
} from '../../utils/plcFinalReportPdfGenerator';
import { generateQrSvgDataUrl } from '../../utils/qrCodeGenerator';
import { getGenderedLabels } from '../../utils/settingsStorage';

interface PlcBatch5FinalReportProps {
  community: PlcCommunityRecord;
  settings: SchoolSettings;
  onUpdateCommunity: (updated: PlcCommunityRecord, message?: string) => void;
  onNavigateForm: (formNum: number) => void;
  readOnly?: boolean;
}

export const PlcBatch5FinalReport: React.FC<PlcBatch5FinalReportProps> = ({
  community,
  settings,
  onUpdateCommunity,
  onNavigateForm,
  readOnly = false,
}) => {
  const [customExecutiveNotes, setCustomExecutiveNotes] = useState<string>(
    community.finalReportCustomization?.customExecutiveNotes ?? ''
  );
  const [customClosingNotes, setCustomClosingNotes] = useState<string>(
    community.finalReportCustomization?.customClosingNotes ?? ''
  );
  const [regenVersion, setRegenVersion] = useState<string>(
    community.finalReportCustomization?.lastGeneratedAt || new Date().toISOString()
  );
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'concise' | 'detailed'>('concise');
  const [previewPageImages, setPreviewPageImages] = useState<string[]>([]);
  const [isExportingConcisePdf, setIsExportingConcisePdf] = useState<boolean>(false);
  const [isExportingDetailedPdf, setIsExportingDetailedPdf] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<{
    title: string;
    typeLabel: string;
    whatItProves: string;
    linkedSummary: string;
    uri: string;
    fileDataUrl?: string;
    linkUrl?: string;
  } | null>(null);
  const exportLockRef = useRef<boolean>(false);

  const { petrolGreen, deepTurquoise, mutedGold, white } =
    PLC_REPORT_DESIGN_SYSTEM.colors;

  useEffect(() => {
    void preloadPlcMoeLogo();
    void preloadPlcEvidenceImages(community);
  }, [community]);

  useEffect(() => {
    setCustomExecutiveNotes(
      community.finalReportCustomization?.customExecutiveNotes ?? ''
    );
    setCustomClosingNotes(
      community.finalReportCustomization?.customClosingNotes ?? ''
    );
  }, [
    community.id,
    community.finalReportCustomization?.customExecutiveNotes,
    community.finalReportCustomization?.customClosingNotes,
  ]);

  const effectiveCommunity = useMemo(() => {
    return updatePlcFinalReportNotes(community, {
      customExecutiveNotes,
      customClosingNotes,
    });
  }, [community, customExecutiveNotes, customClosingNotes]);

  const report = useMemo(() => {
    return buildPlcFinalReport(effectiveCommunity, regenVersion);
  }, [effectiveCommunity, regenVersion]);

  const selectedEvidences = useMemo(() => {
    return selectKeyEvidencesForExecutiveReport(report);
  }, [report]);

  const genderedLabels = useMemo(
    () => getGenderedLabels(settings.gender),
    [settings.gender]
  );

  const isExportingAnyPdf = isExportingConcisePdf || isExportingDetailedPdf;

  const showTempFeedback = (msg: string) => {
    setStatusFeedback(msg);
    window.setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const handleSaveClosingNotes = () => {
    if (readOnly) return;
    const updated = updatePlcFinalReportNotes(community, {
      customExecutiveNotes,
      customClosingNotes,
    });
    onUpdateCommunity(
      updated,
      'تم حفظ الملاحظات والتوصيات الختامية للتقرير دون المساس ببيانات النماذج الأساسية.'
    );
    showTempFeedback('تم حفظ الملاحظات والتوصيات الختامية بنجاح.');
  };

  const handleRegenerateReport = () => {
    if (readOnly) return;
    const nowIso = new Date().toISOString();
    const withCurrentNotes = updatePlcFinalReportNotes(community, {
      customExecutiveNotes,
      customClosingNotes,
    });
    const { community: regeneratedComm } = regeneratePlcFinalReport(
      withCurrentNotes,
      nowIso
    );
    setRegenVersion(nowIso);
    onUpdateCommunity(
      regeneratedComm,
      'تمت إعادة توليد التقرير النهائي وتحديث الجداول والتحليلات والرسوم مع الحفاظ على الملاحظات الختامية.'
    );
    showTempFeedback('تمت إعادة توليد التقرير النهائي من أحدث بيانات المجتمع.');
  };

  const handleOpenPdfPreview = async (mode: 'concise' | 'detailed' = 'concise') => {
    setExportError(null);
    setPreviewMode(mode);
    try {
      await preloadPlcMoeLogo();
      await preloadPlcEvidenceImages(effectiveCommunity);
      if (mode === 'detailed') {
        const { canvases } = renderPlcDetailedReportPagesToCanvases(
          effectiveCommunity,
          settings,
          report
        );
        const dataUrls = canvases.map((c) => c.toDataURL('image/jpeg', 0.92));
        setPreviewPageImages(dataUrls);
      } else {
        const { canvases } = renderPlcFinalReportPagesToCanvases(report, settings);
        const dataUrls = canvases.map((c) => c.toDataURL('image/jpeg', 0.92));
        setPreviewPageImages(dataUrls);
      }
      setShowPdfPreviewModal(true);
    } catch {
      setExportError(
        'تعذّر فتح معاينة صفحات PDF حالياً. بيانات المجتمع محفوظة بالكامل ويمكنك المحاولة مرة أخرى.'
      );
    }
  };

  const conciseDownloadButtonLabel = 'تنزيل التقرير النهائي المختصر';
  const detailedDownloadButtonLabel = 'تنزيل التقرير التفصيلي للمجتمع';

  const handleExportConcisePdf = async () => {
    if (exportLockRef.current || isExportingAnyPdf) {
      return;
    }
    exportLockRef.current = true;
    setIsExportingConcisePdf(true);
    setExportError(null);
    setStatusFeedback(null);

    const win = window as unknown as {
      __plcPdfExportAttemptsCount?: number;
      __simulatePlcPdfExportFailure?: boolean;
      __lastPlcFinalReportPdfExport?: {
        filename: string;
        byteLength: number;
        pageCount: number;
        headerSignature: string;
        communityId: string;
        communityName: string;
        isDemo: boolean;
        reportKind: 'concise' | 'detailed';
        qrScannabilityCount: number;
        textSample: string;
      };
    };
    win.__plcPdfExportAttemptsCount = (win.__plcPdfExportAttemptsCount || 0) + 1;

    try {
      await preloadPlcMoeLogo();
      await new Promise((resolve) => window.setTimeout(resolve, 40));

      if (win.__simulatePlcPdfExportFailure) {
        throw new Error('SIMULATED_PDF_EXPORT_FAILURE');
      }

      const artifact = generatePlcFinalReportPdfArtifact(
        effectiveCommunity,
        settings,
        report
      );

      if (!artifact || !artifact.pdfBytes || artifact.pdfBytes.byteLength < 100) {
        throw new Error('INVALID_PDF_ARTIFACT');
      }

      const headerSignature = new TextDecoder().decode(
        artifact.pdfBytes.slice(0, 8)
      );
      if (!headerSignature.startsWith('%PDF-')) {
        throw new Error('INVALID_PDF_HEADER');
      }

      win.__lastPlcFinalReportPdfExport = {
        filename: artifact.filename,
        byteLength: artifact.pdfBytes.byteLength,
        pageCount: artifact.pageCount,
        headerSignature,
        communityId: community.id,
        communityName: community.name,
        isDemo: Boolean(readOnly),
        reportKind: 'concise',
        qrScannabilityCount: artifact.pagesModel.pages.reduce(
          (sum, p) => sum + (p.plannedQrSpots?.length || 0),
          0
        ),
        textSample: artifact.pagesModel.allTextTokens.slice(0, 60).join(' | '),
      };

      const blob = new Blob([artifact.pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);

      showTempFeedback(
        `تم تنزيل التقرير النهائي المختصر PDF بنجاح (${artifact.pageCount} صفحات A4 — ${artifact.filename}).`
      );
    } catch {
      setExportError(
        'تعذّر إعداد أو تنزيل ملف التقرير النهائي المختصر PDF. جميع بيانات المجتمع محفوظة بالكامل ويمكنك المحاولة مرة أخرى.'
      );
    } finally {
      exportLockRef.current = false;
      setIsExportingConcisePdf(false);
    }
  };

  const handleExportDetailedPdf = async () => {
    if (exportLockRef.current || isExportingAnyPdf) {
      return;
    }
    exportLockRef.current = true;
    setIsExportingDetailedPdf(true);
    setExportError(null);
    setStatusFeedback(null);

    const win = window as unknown as {
      __plcDetailedPdfExportAttemptsCount?: number;
      __simulatePlcPdfExportFailure?: boolean;
      __lastPlcDetailedReportPdfExport?: {
        filename: string;
        byteLength: number;
        pageCount: number;
        headerSignature: string;
        communityId: string;
        communityName: string;
        isDemo: boolean;
        reportKind: 'concise' | 'detailed';
        qrScannabilityCount: number;
        textSample: string;
      };
    };
    win.__plcDetailedPdfExportAttemptsCount =
      (win.__plcDetailedPdfExportAttemptsCount || 0) + 1;

    try {
      await preloadPlcMoeLogo();
      await preloadPlcEvidenceImages(effectiveCommunity);
      await new Promise((resolve) => window.setTimeout(resolve, 40));

      if (win.__simulatePlcPdfExportFailure) {
        throw new Error('SIMULATED_PDF_EXPORT_FAILURE');
      }

      const artifact = generatePlcDetailedReportPdfArtifact(
        effectiveCommunity,
        settings,
        report
      );

      if (!artifact || !artifact.pdfBytes || artifact.pdfBytes.byteLength < 100) {
        throw new Error('INVALID_DETAILED_PDF_ARTIFACT');
      }

      const headerSignature = new TextDecoder().decode(
        artifact.pdfBytes.slice(0, 8)
      );
      if (!headerSignature.startsWith('%PDF-')) {
        throw new Error('INVALID_DETAILED_PDF_HEADER');
      }

      win.__lastPlcDetailedReportPdfExport = {
        filename: artifact.filename,
        byteLength: artifact.pdfBytes.byteLength,
        pageCount: artifact.pageCount,
        headerSignature,
        communityId: community.id,
        communityName: community.name,
        isDemo: Boolean(readOnly),
        reportKind: 'detailed',
        qrScannabilityCount: artifact.pagesModel.pages.reduce(
          (sum, p) => sum + (p.plannedQrSpots?.length || 0),
          0
        ),
        textSample: artifact.pagesModel.allTextTokens.slice(0, 80).join(' | '),
      };

      const blob = new Blob([artifact.pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);

      showTempFeedback(
        `تم تنزيل التقرير التفصيلي للمجتمع PDF بنجاح (${artifact.pageCount} صفحات A4 شاملة النماذج التسعة ومستودع الشواهد — ${artifact.filename}).`
      );
    } catch {
      setExportError(
        'تعذّر إعداد أو تنزيل ملف التقرير التفصيلي للمجتمع PDF. جميع بيانات المجتمع محفوظة بالكامل ويمكنك المحاولة مرة أخرى.'
      );
    } finally {
      exportLockRef.current = false;
      setIsExportingDetailedPdf(false);
    }
  };

  const renderSectionBanner = (
    sectionNumber: string,
    title: string,
    subtitle: string,
    badgeText?: string
  ) => (
    <div
      className="rounded-2xl border-2 border-[#C5A15D] bg-[#153C43] text-white p-4 sm:p-5 shadow-xs mb-6"
      data-testid={`plc-section-banner-${sectionNumber}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#C5A15D] text-[#153C43] font-black text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-xs">
            {sectionNumber}
          </div>
          <div className="text-center sm:text-right">
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-[#F2EFE7] mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        {badgeText && (
          <div className="px-3.5 py-1.5 rounded-xl bg-[#145B59] border border-[#C5A15D] text-white text-xs font-extrabold shrink-0">
            {badgeText}
          </div>
        )}
      </div>
    </div>
  );

  const renderChartCard = (chart: PlcFinalReportChartModel) => {
    const maxVal = Math.max(
      1,
      ...chart.items.map((it) => Math.max(it.value || 0, it.secondaryValue || 0))
    );
    const totalSingleSum = chart.items.reduce((acc, it) => acc + (it.value || 0), 0);

    return (
      <div
        key={chart.id}
        data-testid={`plc-report-chart-${chart.id}`}
        className="bg-white rounded-2xl border-2 border-[#B8C9CB] overflow-hidden shadow-xs flex flex-col justify-between"
      >
        <div className="bg-[#F2EFE7] px-5 py-3.5 border-b border-[#B8C9CB]">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="text-sm font-extrabold text-[#153C43] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#145B59] shrink-0" />
              <span>{chart.title}</span>
            </h4>
            <span className="text-xs font-bold text-[#145B59]">
              {chart.hasSufficientData ? 'بيانات موثقة' : 'بيانات غير كافية'}
            </span>
          </div>
          <p className="text-xs font-medium text-[#0D262A]">{chart.subtitle}</p>
        </div>

        <div className="p-5">
          {!chart.hasSufficientData ? (
            <div className="bg-[#F2EFE7] border border-[#C5A15D] rounded-xl p-4 text-center my-2">
              <p className="text-xs font-bold text-[#153C43]">{chart.emptyMessage}</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {chart.items.map((item, idx) => {
                const primaryPct = Math.max(
                  5,
                  Math.min(100, Math.round((item.value / maxVal) * 100))
                );
                const secondaryPct =
                  item.secondaryValue !== undefined
                    ? Math.max(
                        5,
                        Math.min(100, Math.round((item.secondaryValue / maxVal) * 100))
                      )
                    : null;
                const sharePct =
                  totalSingleSum > 0
                    ? Math.round((item.value / totalSingleSum) * 100)
                    : 0;

                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-[#0D262A]">
                      <span className="leading-snug">{item.label}</span>
                      {chart.chartKind === 'paired_bar' &&
                      item.secondaryValue !== undefined ? (
                        <span className="text-[#0D262A] tabular-nums">
                          المستهدف: <strong className="text-[#C5A15D]">{item.value}</strong>{' '}
                          | الفعلي:{' '}
                          <strong className="text-[#153C43]">
                            {item.secondaryValue}
                          </strong>{' '}
                          {item.unit || ''}
                        </span>
                      ) : (
                        <span className="text-[#153C43] tabular-nums">
                          {item.value} {item.unit || ''}{' '}
                          {!item.unit && totalSingleSum > 0 ? `(${sharePct}٪)` : ''}
                        </span>
                      )}
                    </div>

                    {chart.chartKind === 'paired_bar' && secondaryPct !== null ? (
                      <div className="space-y-1">
                        <div className="w-full h-2.5 bg-[#F2EFE7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${primaryPct}%`,
                              backgroundColor: mutedGold,
                            }}
                          />
                        </div>
                        <div className="w-full h-2.5 bg-[#F2EFE7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${secondaryPct}%`,
                              backgroundColor: petrolGreen,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-3 bg-[#F2EFE7] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${primaryPct}%`,
                            backgroundColor: idx % 2 === 0 ? petrolGreen : deepTurquoise,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const s1 = report.section9_1;
  const s2 = report.section9_2;
  const s3 = report.section9_3;
  const s4 = report.section9_4;
  const s5 = report.section9_5;
  const s6 = report.section9_6;
  const s7 = report.section9_7;
  const s8 = report.section9_8;
  const s9 = report.section9_9;
  const s10 = report.section9_10;
  const s11 = report.section9_11;
  const s12 = report.section9_12;
  const s13 = report.section9_13;

  const executedActivitiesCount =
    s6.byType.program.executed +
    s6.byType.activity.executed +
    s6.byType.mutual_visit.executed +
    s6.byType.community_partnership.executed;

  const achievedKpisCount = s7.kpiRows.filter(
    (k) =>
      k.isCalculated &&
      k.achievementPercentage !== null &&
      k.achievementPercentage >= 100
  ).length;

  const completedRecsCount = s5.recommendationsRows.filter(
    (r) => r.followupStatus === 'completed'
  ).length;

  const schoolNameDisplay = settings.schoolName?.trim() || 'غير محدد';
  const eduDeptDisplay = settings.educationDepartment?.trim() || 'الإدارة العامة للتعليم';
  const principalNameDisplay = settings.principalName?.trim() || 'غير محدد';

  const verifiedImpactRows = s8.rows.filter((r) => r.classification === 'verified_impact');
  const primaryNeedText =
    s3.rows.length > 0
      ? `${s3.rows[0].needDescription} (الأولوية: ${s3.rows[0].priorityLabel})`
      : 'تحليل الاحتياجات المهنية وتحديد فجوات الأداء الصفي';
  const primaryGoalText =
    s2.goals.length > 0
      ? s2.goals[0].text
      : s2.missionDisplay !== 'بيانات هذا القسم غير مكتملة.'
      ? s2.missionDisplay
      : 'تطوير الممارسات التدريسية التشاركية وتحسين نواتج التعلم';
  const primaryActionText =
    s4.rows.length > 0
      ? `${s4.rows[0].actionTitle} (${s4.completedCount} من ${s4.totalActionsCount} مكتمل)`
      : `تنفيذ ${executedActivitiesCount} برامج وزيارات تبادلية وورش تطبيقية`;
  const primaryResultText =
    verifiedImpactRows.length > 0
      ? `${verifiedImpactRows[0].impactDescriptionDisplay} [${verifiedImpactRows[0].baselineDisplay} ← ${verifiedImpactRows[0].actualResultDisplay}]`
      : s7.kpiRows.length > 0
      ? `تحقق ${achievedKpisCount} من ${s7.kpiRows.length} مؤشرات أداء بنسبة تنفيذ خطة ${s4.completionDisplay}`
      : report.generalAnalysis.planExecutionLevelText;

  return (
    <div className="space-y-8" dir="rtl" data-testid="plc-model-9-final-report">
      {/* شريط التحكم العلوي للنموذج التاسع (بالهوية البصرية الرسمية: الأخضر البترولي والتركواز والذهبي والعاجي) */}
      <div className="bg-white rounded-2xl border-2 border-[#153C43] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#145B59] mb-1.5">
              <FileCheck2 className="w-4 h-4 shrink-0 text-[#153C43]" />
              <span>النموذج التاسع (٩) · التقرير النهائي والتفصيلي لمجتمع التعلّم المهني</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#153C43] leading-snug">
              التقرير النهائي لمجتمع التعلّم المهني — {report.communityName}
            </h2>
            <p className="text-sm font-medium text-[#0D262A] mt-1">
              وثيقة مدرسية رسمية تعرض حصيلة أعمال المجتمع المهني بنسختين معتمدتين: التقرير النهائي المختصر (٦ صفحات) والتقرير التفصيلي الشامل للنماذج التسعة ومستودع الشواهد.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {!readOnly && (
              <button
                type="button"
                onClick={handleRegenerateReport}
                data-testid="plc-regenerate-report-btn"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#153C43] bg-white hover:bg-[#F2EFE7] text-[#153C43] text-sm font-extrabold transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#145B59] shrink-0" />
                <span>إعادة توليد التقرير</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenPdfPreview('concise')}
              data-testid="plc-preview-pdf-btn"
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#C5A15D] bg-[#F2EFE7] hover:bg-[#E8E3D6] text-[#153C43] text-sm font-extrabold transition cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#153C43] shrink-0" />
              <span>معاينة التقريرين (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleExportConcisePdf}
              disabled={isExportingAnyPdf}
              data-testid="plc-export-pdf-btn"
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#153C43] hover:bg-[#145B59] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-extrabold border border-[#C5A15D] shadow-xs transition cursor-pointer"
            >
              {isExportingConcisePdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0 text-[#C5A15D]" />
              )}
              <span>
                {isExportingConcisePdf
                  ? 'جارٍ تنزيل التقرير المختصر...'
                  : conciseDownloadButtonLabel}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportDetailedPdf}
              disabled={isExportingAnyPdf}
              data-testid="plc-export-detailed-pdf-btn"
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#145B59] hover:bg-[#153C43] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-extrabold border-2 border-[#C5A15D] shadow-xs transition cursor-pointer"
            >
              {isExportingDetailedPdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Layers className="w-4 h-4 shrink-0 text-[#C5A15D]" />
              )}
              <span>
                {isExportingDetailedPdf
                  ? 'جارٍ تنزيل التقرير التفصيلي...'
                  : detailedDownloadButtonLabel}
              </span>
            </button>
          </div>
        </div>

        {/* روابط سريعة للعودة واستعراض/تعديل البيانات من النماذج 1-8 */}
        <div className="mt-4 pt-4 border-t border-[#B8C9CB] flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-[#153C43] ml-2">
            {readOnly
              ? 'التنقل السريع بين نماذج المجتمع التجريبي:'
              : 'العودة لتعديل البيانات المصدرية:'}
          </span>
          {[
            { num: 1, label: '١. بيانات المجتمع' },
            { num: 2, label: '٢. التعريف والأهداف' },
            { num: 3, label: '٣. الاحتياجات' },
            { num: 4, label: '٤. الخطة التشغيلية' },
            { num: 5, label: '٥. الاجتماعات' },
            { num: 6, label: '٦. البرامج والأنشطة' },
            { num: 7, label: '٧. التقويم والمؤشرات' },
            { num: 8, label: '٨. قياس الأثر والشواهد' },
          ].map((f) => (
            <button
              key={f.num}
              type="button"
              onClick={() => onNavigateForm(f.num)}
              className="px-3 py-1.5 rounded-lg bg-[#F2EFE7] hover:bg-[#153C43] hover:text-white text-[#153C43] border border-[#B8C9CB] text-xs font-bold transition cursor-pointer"
            >
              {f.label}
            </button>
          ))}
        </div>

        {statusFeedback && (
          <div
            data-testid="plc-report-export-success"
            className="mt-3 p-3 rounded-xl bg-[#EBF3F2] border border-[#145B59] text-[#153C43] text-xs font-extrabold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#145B59] shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {exportError && (
          <div
            data-testid="plc-report-export-error"
            className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      {/* =====================================================================
          الصفحة ١: بطاقة الغلاف الرسمي المعتمد (Official Cover Page View)
          - الهوية الرسمية تحت الشعار في 4 سطور مستقلة موسّطة
          - بطاقتا أسفل الغلاف تحتويان على الاسمين فقط دون المسميات الوظيفية ودون تكرار اسم المدرسة
         ===================================================================== */}
      <section
        data-testid="plc-report-cover-card"
        className="bg-[#F2EFE7] rounded-3xl border-4 border-[#153C43] p-4 sm:p-8 shadow-sm relative overflow-hidden"
      >
        <div className="bg-white rounded-2xl border-2 border-[#C5A15D] p-6 sm:p-10 space-y-8">
          {/* شريط علوي رسمي بالأخضر البترولي والذهبي */}
          <div className="h-3 bg-[#153C43] border-b-4 border-[#C5A15D] rounded-full" />

          {/* الشعار الرسمي والهوية الوزارية والمدرسية في 4 سطور مستقلة موسّطة */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 pt-2">
            <div className="p-4 rounded-2xl bg-[#F2EFE7] border-2 border-[#C5A15D] shadow-2xs">
              <img
                src="./moe-logo.png"
                alt="شعار وزارة التعليم"
                className="h-24 w-auto object-contain mx-auto"
              />
            </div>
            <p
              data-testid="plc-cover-line-1"
              className="text-base sm:text-lg font-extrabold text-[#153C43] pt-1"
            >
              المملكة العربية السعودية
            </p>
            <p
              data-testid="plc-cover-line-2"
              className="text-base sm:text-lg font-extrabold text-[#153C43]"
            >
              وزارة التعليم
            </p>
            <p
              data-testid="plc-cover-line-3"
              className="text-sm sm:text-base font-bold text-[#145B59]"
            >
              {eduDeptDisplay}
            </p>
            <p
              data-testid="plc-cover-line-4"
              className="text-base sm:text-lg font-extrabold text-[#0D262A]"
            >
              {schoolNameDisplay}
            </p>
            <div className="w-36 h-1 bg-[#C5A15D] rounded-full mx-auto" />
          </div>

          {/* اللوحة المركزية لعنوان التقرير واسم المجتمع المهني (في منتصف الغلاف) */}
          <div className="rounded-2xl bg-[#153C43] text-white p-6 sm:p-10 text-center border-2 border-[#C5A15D] space-y-4 max-w-4xl mx-auto shadow-xs">
            <div className="inline-block px-5 py-1.5 rounded-full bg-[#145B59] border border-[#C5A15D] text-[#F2EFE7] text-xs sm:text-sm font-extrabold">
              وثيقة مدرسية رسمية • مجتمعات التعلّم المهنية
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              التقرير النهائي لمجتمع التعلّم المهني
            </h1>
            <div className="w-32 h-1.5 bg-[#C5A15D] mx-auto rounded-full" />
            <div className="bg-white text-[#153C43] rounded-2xl px-6 py-4 max-w-3xl mx-auto border-2 border-[#C5A15D] shadow-xs">
              <p className="text-lg sm:text-2xl font-extrabold leading-relaxed">
                {report.communityName}
              </p>
            </div>
            <p className="text-sm sm:text-base font-bold text-[#F2EFE7] pt-1">
              المجال / التخصص: {s1.specialty}
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-[#C5A15D]">
              العام الدراسي: {s1.academicYear}   |   فترة التنفيذ: {s1.semesterLabel}
            </p>
          </div>

          {/* بطاقة تعريفية موجزة برؤية المجتمع ونطاق عمله (لتعزيز توازن الغلاف وتكامل عناصره) */}
          <div
            data-testid="plc-cover-vision-scope-card"
            className="rounded-2xl bg-[#F2EFE7] border-2 border-[#145B59] overflow-hidden max-w-4xl mx-auto text-center shadow-2xs"
          >
            <div className="bg-[#145B59] text-white py-2 px-4 text-xs sm:text-sm font-extrabold border-b border-[#C5A15D]">
              التعريف الموجز برؤية المجتمع ونطاق عمله المهني
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs sm:text-sm font-bold text-[#0D262A] leading-relaxed">
                {s2.visionDisplay !== 'بيانات هذا القسم غير مكتملة.'
                  ? s2.visionDisplay
                  : s2.missionDisplay !== 'بيانات هذا القسم غير مكتملة.'
                  ? s2.missionDisplay
                  : `مجتمع تعلّم مهني متخصص في (${s1.specialty}) يُعنى بتطوير الممارسات التدريسية التشاركية وتحسين نواتج التعلم.`}
              </p>
              <div className="pt-2 border-t border-[#D6CEBF] flex flex-wrap items-center justify-center gap-3 text-xs font-extrabold text-[#153C43]">
                <span>أعضاء المجتمع: {s1.membersCount}</span>
                <span className="text-[#C5A15D]">•</span>
                <span>إجراءات الخطة: {s4.completedCount}/{s4.totalActionsCount}</span>
                <span className="text-[#C5A15D]">•</span>
                <span>الاجتماعات الموثقة: {s5.totalMeetingsCount}</span>
                <span className="text-[#C5A15D]">•</span>
                <span>البرامج والأنشطة: {executedActivitiesCount}/{s6.totalRecordsCount}</span>
              </div>
            </div>
          </div>

          {/* البطاقات التوثيقية للغلاف (موسّطة بالكامل) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: 'الإدارة التعليمية', value: eduDeptDisplay },
              { label: 'اسم المدرسة', value: schoolNameDisplay },
              { label: 'المجال / التخصص', value: s1.specialty },
              {
                label: 'العام الدراسي وفترة التنفيذ',
                value: `${s1.academicYear} · ${s1.semesterLabel}`,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#F2EFE7] border-2 border-[#B8C9CB] text-center"
              >
                <span className="block text-xs font-extrabold text-[#145B59]">
                  {item.label}
                </span>
                <span className="block text-sm font-extrabold text-[#0D262A] mt-1.5 leading-snug">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* بطاقتا أسفل الغلاف: الاسمين فقط، دون المسميات الوظيفية، مع عدم تكرار اسم المدرسة تحت اسم مدير المدرسة */}
          <div
            dir="ltr"
            className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto pt-2"
          >
            {/* المنطقة اليسرى (Left Zone): اسم مدير المدرسة فقط */}
            <div
              dir="rtl"
              data-testid="plc-cover-principal-left"
              className="rounded-2xl bg-white border-2 border-[#145B59] overflow-hidden text-center shadow-2xs"
            >
              <div className="h-2.5 bg-[#145B59] border-b border-[#C5A15D]" />
              <div className="p-5 flex items-center justify-center text-center">
                <p className="text-base sm:text-lg font-extrabold text-[#0D262A]">
                  {principalNameDisplay}
                </p>
              </div>
            </div>

            {/* المنطقة اليمنى (Right Zone): اسم رئيس المجتمع فقط */}
            <div
              dir="rtl"
              data-testid="plc-cover-leader-right"
              className="rounded-2xl bg-white border-2 border-[#153C43] overflow-hidden text-center shadow-2xs"
            >
              <div className="h-2.5 bg-[#153C43] border-b border-[#C5A15D]" />
              <div className="p-5 flex items-center justify-center text-center">
                <p className="text-base sm:text-lg font-extrabold text-[#0D262A]">
                  {s1.leaderNameDisplay}
                </p>
              </div>
            </div>
          </div>

          <div className="h-3 bg-[#153C43] border-t-4 border-[#C5A15D] rounded-full" />
        </div>
      </section>

      {/* بيان حالة اكتمال التوثيق (عرض معلوماتي هادئ) */}
      <div
        className="bg-white rounded-2xl border-2 border-[#B8C9CB] p-5 shadow-xs select-text"
        data-testid="plc-report-completeness-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#153C43] flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#145B59]" />
              <span>حالة اكتمال سجلات التوثيق المصدرية للمجتمع</span>
            </h3>
            <p className="text-xs font-medium text-[#0D262A] mt-0.5">
              {report.completeness.overallSummaryText}
            </p>
          </div>
          <div className="text-xs font-extrabold text-[#153C43] tabular-nums">
            المجالات المكتملة: {report.completeness.completedSectionsCount} /{' '}
            {report.completeness.totalSectionsCount}
          </div>
        </div>

        {!report.completeness.allComplete && (
          <div
            data-testid="plc-report-incomplete-notice"
            className="mb-3 p-3.5 rounded-xl bg-[#F9F4E8] border border-[#C5A15D] text-[#0D262A] text-xs space-y-1"
          >
            <div className="font-extrabold flex items-center gap-1.5 text-[#153C43]">
              <AlertCircle className="w-4 h-4 text-[#C5A15D] shrink-0" />
              <span>
                تنبيه معلوماتي: يوجد ({report.completeness.incompleteSectionsCount}) قسم غير مكتمل في سجلات المجتمع الحالية
              </span>
            </div>
            <p className="text-[#0D262A] leading-relaxed">
              الأقسام التي ينقصها بيانات:{' '}
              <strong>
                {report.completeness.sections
                  .filter((s) => !s.isComplete)
                  .map((s) => s.label)
                  .join('، ')}
              </strong>
              . يمكنك تنزيل التقرير النهائي بصيغة PDF الآن بالبيانات المتوفرة حالياً، وسيوضح التقرير تلقائياً البنود غير المتوفرة دون اختلاق أي نتائج أو نسب.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {report.completeness.sections.map((sec) => (
            <div
              key={sec.id}
              data-testid={`plc-completeness-item-${sec.id}`}
              className={`p-2.5 rounded-xl border text-xs text-center ${
                sec.isComplete
                  ? 'bg-[#EBF3F2] border-[#145B59] text-[#0D262A]'
                  : 'bg-[#F9F4E8] border-[#C5A15D] text-[#0D262A]'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="font-extrabold leading-tight">{sec.label}</span>
                {sec.isComplete ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#145B59] shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-[#C5A15D] shrink-0" />
                )}
              </div>
              <p className="text-[11px] font-medium text-[#153C43] mt-1 leading-snug">
                {sec.isComplete ? sec.detailsText : sec.statusText}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================================
          الصفحة ٢: 01 الملخص العام للأداء (بدون لفظ التنفيذي/التنفيذية)
         ===================================================================== */}
      <section
        data-testid="plc-report-general-analysis"
        className="bg-white rounded-2xl border-2 border-[#B8C9CB] p-6 shadow-xs space-y-6"
      >
        {renderSectionBanner(
          '01',
          'الملخص العام للأداء',
          'بطاقة قراءة سريعة لحصيلة عمل المجتمع المهني ومسار الترابط بين الاحتياج والهدف والإجراء والنتيجة',
          `الحالة: ${s1.statusLabel}`
        )}

        {/* بطاقات الأرقام الإحصائية الست (موسّطة ومتوازنة بصرياً) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            {
              label: 'عدد الاجتماعات',
              value: `${s5.totalMeetingsCount}`,
              sub: `${completedRecsCount}/${s5.recommendationsRows.length} توصية منجزة`,
              headerBg: 'bg-[#153C43]',
            },
            {
              label: 'البرامج والأنشطة',
              value: `${executedActivitiesCount}/${s6.totalRecordsCount}`,
              sub: 'برامج · أنشطة · زيارات · شراكات',
              headerBg: 'bg-[#145B59]',
            },
            {
              label: 'مؤشرات الأداء',
              value: `${achievedKpisCount}/${s7.kpiRows.length}`,
              sub: 'مؤشرات متحققة فعليًا',
              headerBg: 'bg-[#153C43]',
            },
            {
              label: 'تنفيذ الخطة',
              value: s4.completionDisplay,
              sub: `${s4.completedCount} من ${s4.totalActionsCount} إجراءات مكتملة`,
              headerBg: 'bg-[#145B59]',
            },
            {
              label: 'الشواهد المختارة',
              value: `${selectedEvidences.length}/${s9.totalEvidencesCount}`,
              sub: `شواهد مرتبطة: ${s9.linkedEvidencesCount}`,
              headerBg: 'bg-[#153C43]',
            },
            {
              label: 'سجلات قياس الأثر',
              value: `${s8.totalImpactRecordsCount}`,
              sub: `${s8.verifiedImpactsCount} أثر تعليمي مقاس`,
              headerBg: 'bg-[#145B59]',
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-xl bg-white border-2 border-[#153C43] overflow-hidden flex flex-col justify-between text-center shadow-2xs"
            >
              <div className={`h-2 ${stat.headerBg}`} />
              <div className="p-3.5 flex flex-col items-center justify-between flex-1">
                <span className="text-xs font-extrabold text-[#153C43]">
                  {stat.label}
                </span>
                <span className="text-2xl font-black text-[#153C43] my-1.5 tabular-nums">
                  {stat.value}
                </span>
                <span className="text-[11px] font-bold text-[#0D262A] leading-tight">
                  {stat.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* المسار البصري المهم: الاحتياج → الهدف → الإجراء → النتيجة */}
        <div
          data-testid="plc-report-traceability-chain"
          className="rounded-2xl bg-[#F2EFE7] border-2 border-[#153C43] overflow-hidden"
        >
          <div className="bg-[#145B59] text-white px-5 py-3 text-center border-b-2 border-[#C5A15D]">
            <h4 className="text-sm sm:text-base font-extrabold">
              مسار الترابط المهني: الاحتياج ← الهدف ← الإجراء ← النتيجة
            </h4>
            <p className="text-xs text-[#F2EFE7] mt-0.5">
              {s3.traceabilitySummary}
            </p>
          </div>

          <div
            data-testid="plc-report-section-9-2"
            className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch"
          >
            {[
              {
                step: '١',
                stage: 'الاحتياج',
                headline: `الاحتياجات المرصودة (${s3.totalNeedsCount})`,
                detail: primaryNeedText,
                headerBg: 'bg-[#153C43]',
              },
              {
                step: '٢',
                stage: 'الهدف',
                headline: `الأهداف المعتمدة (${s2.goals.length})`,
                detail: primaryGoalText,
                headerBg: 'bg-[#145B59]',
              },
              {
                step: '٣',
                stage: 'الإجراء',
                headline: `تنفيذ الخطة (${s4.completionDisplay})`,
                detail: primaryActionText,
                headerBg: 'bg-[#153C43]',
              },
              {
                step: '٤',
                stage: 'النتيجة',
                headline:
                  s8.verifiedImpactsCount > 0
                    ? `أثر مقاس (${s8.verifiedImpactsCount})`
                    : `مؤشرات متحققة (${achievedKpisCount})`,
                detail: primaryResultText,
                headerBg: 'bg-[#145B59]',
              },
            ].map((st, idx) => (
              <div
                key={idx}
                className="relative flex flex-col justify-between rounded-xl bg-white border-2 border-[#153C43] overflow-hidden text-center shadow-2xs"
              >
                <div className={`${st.headerBg} text-[#C5A15D] py-2 px-3 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5`}>
                  <span>
                    {st.step}. {st.stage}
                  </span>
                  {idx < 3 && (
                    <ArrowLeft className="w-3.5 h-3.5 text-[#C5A15D] hidden md:inline-block" />
                  )}
                </div>
                <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-center">
                  <p className="text-xs font-extrabold text-[#153C43]">
                    {st.headline}
                  </p>
                  <p className="text-xs font-bold text-[#0D262A] leading-relaxed">
                    {st.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* الخلاصة العامة للأداء في نقاط مختصرة، كل فكرة في سطر مستقل بمحاذاة لليمين */}
        <div
          data-testid="plc-report-section-9-3"
          className="p-5 rounded-xl bg-[#EBF3F2] border-2 border-[#145B59] text-right space-y-2.5"
        >
          <h4 className="text-xs sm:text-sm font-extrabold text-[#153C43] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#145B59]" />
            <span>الخلاصة العامة للأداء</span>
          </h4>
          <ul className="space-y-1.5 text-xs font-bold text-[#0D262A] leading-relaxed text-right">
            <li>• الرؤية والرسالة: {s2.visionDisplay.replace(/التنفيذية|التنفيذي/g, '')} — {s2.missionDisplay.replace(/التنفيذية|التنفيذي/g, '')}</li>
            <li>• تشخيص الاحتياجات: {s3.traceabilitySummary.replace(/التنفيذية|التنفيذي/g, '')}</li>
            {report.generalAnalysis.paragraphs.map((p, idx) => (
              <li key={idx}>• {p.replace(/التنفيذية|التنفيذي/g, '').replace(/\s+/g, ' ').trim()}</li>
            ))}
          </ul>
        </div>

        {/* القراءة التحليلية المشتقة من بيانات الرسمين البيانيين */}
        <div
          data-testid="plc-page2-charts-analytical-reading"
          className="p-4 rounded-xl bg-[#F2EFE7] border-2 border-[#153C43] text-right space-y-1.5"
        >
          <h5 className="text-xs font-extrabold text-[#153C43] text-right">
            قراءة تحليلية لتوازن التنفيذ وتنوع الأنشطة:
          </h5>
          <p className="text-xs font-bold text-[#0D262A] leading-relaxed text-right">
            • تُظهر مقارنة مسارات العمل توازناً منهجياً بين إجراءات الخطة المعتمدة وتنوع البرامج التطويرية والزيارات التبادلية والشراكات المساندة؛ مما يعكس انتقال المجتمع من التخطيط النظري إلى التطبيق الصفي المباشر وتكامل أدوات المتابعة الميدانية.
          </p>
        </div>

        {/* استثمار المساحة التحليلية البصرية في الصفحة الثانية: مؤشرات الإنجاز الدائرية (Donut) + التوزيع الفئوي + مقارنة المستهدف بالمتحقق */}
        <div
          data-testid="plc-page2-visual-analytics"
          className="space-y-5 pt-2"
        >
          {/* ١. المؤشرات الدائرية الثلاثة (Donut Progress Indicators) */}
          <div className="rounded-2xl bg-[#F2EFE7] border-2 border-[#153C43] overflow-hidden">
            <div className="bg-[#153C43] text-white px-5 py-2.5 text-center border-b-2 border-[#C5A15D]">
              <h5 className="text-xs sm:text-sm font-extrabold">
                مؤشرات الإنجاز والتحقق الدائرية (بناءً على بيانات المجتمع الفعلية)
              </h5>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: 'مؤشر إنجاز الخطة التشغيلية',
                  pct:
                    s4.completionPercentage ??
                    (s4.totalActionsCount > 0
                      ? Math.round((s4.completedCount / s4.totalActionsCount) * 100)
                      : 0),
                  ratio: `${s4.completedCount} من ${s4.totalActionsCount} إجراءات مكتملة`,
                  sub: `قيد التنفيذ: ${s4.inProgressCount} | متبقٍ: ${Math.max(
                    0,
                    s4.totalActionsCount - s4.completedCount - s4.inProgressCount
                  )}`,
                  strokeColor: '#153C43',
                },
                {
                  title: 'مؤشر تحقق المستهدفات القياسية',
                  pct:
                    s7.kpiRows.length > 0
                      ? Math.round((achievedKpisCount / s7.kpiRows.length) * 100)
                      : 0,
                  ratio: `${achievedKpisCount} من ${s7.kpiRows.length} مؤشرات متحققة`,
                  sub: `المؤشرات المقاسة كميًا: ${
                    s7.kpiRows.filter((k) => k.isCalculated).length
                  } من ${s7.kpiRows.length}`,
                  strokeColor: '#145B59',
                },
                {
                  title: 'مؤشر تنفيذ قرارات الاجتماعات',
                  pct:
                    s5.recommendationsRows.length > 0
                      ? Math.round(
                          (completedRecsCount / s5.recommendationsRows.length) * 100
                        )
                      : 0,
                  ratio: `${completedRecsCount} من ${s5.recommendationsRows.length} توصية منجزة`,
                  sub: `عبر ${s5.totalMeetingsCount} اجتماعات موثقة`,
                  strokeColor: '#C5A15D',
                },
              ].map((d, idx) => {
                const clamped = Math.max(0, Math.min(100, d.pct));
                const radius = 38;
                const circumference = 2 * Math.PI * radius;
                const dashOffset =
                  circumference - (clamped / 100) * circumference;
                return (
                  <div
                    key={idx}
                    className="rounded-xl bg-white border-2 border-[#B8C9CB] p-4 flex items-center gap-4 shadow-2xs"
                  >
                    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          fill="none"
                          stroke="#E5E0D4"
                          strokeWidth="10"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          fill="none"
                          stroke={d.strokeColor}
                          strokeWidth="10"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-base font-black text-[#153C43] tabular-nums">
                        {clamped}%
                      </span>
                    </div>
                    <div className="text-right space-y-1 flex-1">
                      <p className="text-xs font-extrabold text-[#153C43]">
                        {d.title}
                      </p>
                      <p className="text-xs font-bold text-[#145B59]">
                        {d.ratio}
                      </p>
                      <p className="text-[11px] font-medium text-[#0D262A]">
                        {d.sub}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ٢. بطاقتان تحليليتان متقابلتان: التوزيع البصري للأنشطة + مقارنة المستهدف بالمتحقق */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* البطاقة اليمنى: التوزيع البصري للأعمال والأنشطة بحسب تصنيفاتها */}
            <div className="rounded-2xl bg-[#F2EFE7] border-2 border-[#153C43] overflow-hidden">
              <div className="bg-[#145B59] text-white px-4 py-2.5 text-center border-b-2 border-[#C5A15D]">
                <h5 className="text-xs sm:text-sm font-extrabold">
                  التوزيع البصري للأعمال والأنشطة بحسب تصنيفاتها ({executedActivitiesCount}/{s6.totalRecordsCount} منفذ)
                </h5>
              </div>
              <div className="p-4 space-y-3 bg-white">
                {[
                  {
                    label: 'البرامج التدريبية وورش العمل',
                    executed: s6.byType.program.executed,
                    total: s6.byType.program.total,
                    barBg: 'bg-[#153C43]',
                  },
                  {
                    label: 'الأنشطة التطبيقية والممارسات الصفية',
                    executed: s6.byType.activity.executed,
                    total: s6.byType.activity.total,
                    barBg: 'bg-[#145B59]',
                  },
                  {
                    label: 'الزيارات التبادلة والملاحظة الصفية',
                    executed: s6.byType.mutual_visit.executed,
                    total: s6.byType.mutual_visit.total,
                    barBg: 'bg-[#C5A15D]',
                  },
                  {
                    label: 'الشراكات المجتمعية والمهنية',
                    executed: s6.byType.community_partnership.executed,
                    total: s6.byType.community_partnership.total,
                    barBg: 'bg-[#153C43]',
                  },
                ].map((cat, idx) => {
                  const pct =
                    cat.total > 0
                      ? Math.round((cat.executed / cat.total) * 100)
                      : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="text-[#0D262A]">{cat.label}</span>
                        <span className="text-[#153C43] tabular-nums">
                          {cat.executed} / {cat.total} منفذ ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[#E5E0D4] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cat.barBg}`}
                          style={{ width: `${Math.max(pct, cat.executed > 0 ? 10 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* البطاقة اليسرى: مقارنة المستهدف بالمتحقق وترابط الاحتياجات بالأثر */}
            <div className="rounded-2xl bg-[#F2EFE7] border-2 border-[#153C43] overflow-hidden">
              <div className="bg-[#153C43] text-white px-4 py-2.5 text-center border-b-2 border-[#C5A15D]">
                <h5 className="text-xs sm:text-sm font-extrabold">
                  مقارنة المستهدف بالمتحقق وترابط الاحتياجات بالأثر
                </h5>
              </div>
              <div className="p-4 space-y-3 bg-white">
                {s7.kpiRows.slice(0, 3).map((k, idx) => {
                  const pct = Math.max(
                    0,
                    Math.min(100, Math.round(k.achievementPercentage ?? 0))
                  );
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-extrabold gap-2">
                        <span className="text-[#0D262A] truncate">
                          {k.indicatorName}
                        </span>
                        <span className="text-[#145B59] shrink-0 tabular-nums">
                          المستهدف: {k.targetDisplay} | المتحقق: {k.actualDisplay} ({k.achievementDisplay})
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-[#E5E0D4] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100
                              ? 'bg-[#153C43]'
                              : pct >= 75
                              ? 'bg-[#145B59]'
                              : 'bg-[#C5A15D]'
                          }`}
                          style={{ width: `${Math.max(pct, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-[#D6CEBF] flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold text-[#153C43]">
                  <span>الاحتياجات المهنية: {s3.totalNeedsCount}</span>
                  <span>•</span>
                  <span>الأثر المقاس: {s8.verifiedImpactsCount}/{s8.totalImpactRecordsCount}</span>
                  <span>•</span>
                  <span>الشواهد الموثقة: {s9.linkedEvidencesCount}/{s9.totalEvidencesCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          الصفحة ٣: 02 أبرز الإنجازات والممارسات المنفذة (أبرز الأعمال والنتائج)
         ===================================================================== */}
      <section
        data-testid="plc-report-section-9-6"
        className="bg-white rounded-2xl border-2 border-[#B8C9CB] p-6 shadow-xs space-y-8"
      >
        {renderSectionBanner(
          '02',
          'أبرز الإنجازات والممارسات المنفذة',
          'أبرز الأعمال والنتائج المحققة من برامج وزيارات تبادلية وشراكات وإجراءات تشغيلية',
          `تنفيذ الخطة: ${s4.completionDisplay}`
        )}

        {/* ١. أبرز الأعمال والنتائج المحققة (نقاط واضحة، كل فكرة في سطر مستقل، بمحاذاة لليمين) */}
        <div data-testid="plc-report-section-9-10" className="space-y-3">
          <h4 className="text-sm font-extrabold text-[#153C43] text-right flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#145B59]" />
            <span>١. أبرز الأعمال والنتائج المحققة</span>
          </h4>
          {s10.items.length === 0 ? (
            <p className="text-xs font-bold text-[#0D262A] bg-[#F2EFE7] p-4 rounded-xl border border-[#B8C9CB] text-right">
              • {s10.emptyMessage}
            </p>
          ) : (
            <div className="p-4 rounded-xl bg-[#F2EFE7] border-2 border-[#145B59] text-right space-y-2">
              {s10.items.map((item) => (
                <p
                  key={item.id}
                  className="text-xs font-bold leading-relaxed text-[#0D262A] text-right"
                >
                  • {item.statement.replace(/التنفيذية|التنفيذي/g, '').replace(/\s+/g, ' ').trim()}{' '}
                  <span className="inline-block px-2 py-0.5 rounded-md bg-[#153C43] text-white text-[10px] font-bold mr-1">
                    {item.source.split('(')[0].trim()}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* ٢. الجدول الأول: البرامج والأنشطة والزيارات والشراكات */}
        <div className="space-y-3">
          <div className="text-center space-y-1">
            <h4 className="text-sm font-extrabold text-[#153C43]">
              ٢. جدول البرامج والأنشطة والزيارات التبادلية والشراكات المنفذة
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-[#145B59]">
              <span>برامج: {s6.byType.program.executed}/{s6.byType.program.total}</span>
              <span>•</span>
              <span>أنشطة: {s6.byType.activity.executed}/{s6.byType.activity.total}</span>
              <span>•</span>
              <span>زيارات تبادلية: {s6.byType.mutual_visit.executed}/{s6.byType.mutual_visit.total}</span>
              <span>•</span>
              <span>شراكات: {s6.byType.community_partnership.executed}/{s6.byType.community_partnership.total}</span>
            </div>
          </div>

          {s6.rows.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#F9F4E8] border border-[#C5A15D] text-[#153C43] text-xs font-extrabold text-center">
              لم تُسجل برامج أو أنشطة أو زيارات تبادلية في هذا المجتمع حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border-2 border-[#7E999D]">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#153C43] text-white font-extrabold border-b-4 border-[#C5A15D]">
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      الممارسة / البرنامج المنفذ
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      النوع والفئة المستهدفة
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      حالة التنفيذ
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      أبرز المخرجات والنتائج المباشرة
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {s6.rows.map((r) => (
                    <tr key={r.recordId} className="bg-white hover:bg-[#F8F6F1]">
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#153C43] text-center">
                        {r.title}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-bold text-[#0D262A] text-center">
                        {r.typeLabel} — {r.targetAudienceDisplay}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#145B59] text-center">
                        {r.statusLabel}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-semibold text-[#0D262A] leading-relaxed text-center">
                        {r.executiveResultsDisplay
                          .replace(/^النتائج التنفيذية المباشرة:\s*/, '')
                          .replace(/التنفيذية|التنفيذي/g, '')
                          .trim()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ٣. الجدول الثاني: إجراءات الخطة التشغيلية */}
        <div
          data-testid="plc-report-section-9-4"
          className="space-y-3 pt-2"
        >
          <div className="text-center space-y-1">
            <h4 className="text-sm font-extrabold text-[#153C43]">
              ٣. جدول تنفيذ إجراءات الخطة التشغيلية ({s4.totalActionsCount}) — الإنجاز: {s4.completionDisplay}
            </h4>
          </div>

          {s4.rows.length === 0 ? (
            <p className="text-xs text-[#153C43] font-bold text-center bg-[#F9F4E8] p-4 rounded-xl border border-[#C5A15D]">
              بيانات الخطة التشغيلية غير مكتملة.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border-2 border-[#7E999D]">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#153C43] text-white font-extrabold border-b-4 border-[#C5A15D]">
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      الإجراء التشغيلي
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      الهدف المرتبط
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      المسؤول والفترة
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      الحالة والإنجاز
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {s4.rows.map((r) => (
                    <tr key={r.actionId} className="bg-white hover:bg-[#F8F6F1]">
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#153C43] text-center">
                        {r.actionTitle}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-semibold text-[#0D262A] text-center">
                        {r.goalDisplay}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-bold text-[#0D262A] text-center">
                        {r.responsibleDisplay} ({r.periodDisplay})
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#145B59] tabular-nums text-center">
                        {r.statusLabel} ({r.completionDisplay})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ٤. حصيلة الاجتماعات المهنية (نقاط مرقمة ١. ٢. ٣. بمحاذاة لليمين) + أعضاء الفريق في بطاقات مستقلة */}
        <div
          data-testid="plc-report-section-9-1"
          className="p-5 rounded-2xl bg-[#F2EFE7] border-2 border-[#B8C9CB] space-y-4 text-right"
        >
          <div data-testid="plc-report-section-9-5" className="space-y-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#153C43] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#145B59]" />
              <span>٤. حصيلة الاجتماعات المهنية</span>
            </h4>
            <div className="space-y-1.5 text-xs font-bold text-[#0D262A] leading-relaxed text-right">
              <p>
                ١. عُقدت ({s5.totalMeetingsCount}) اجتماعات مهنية موثقة بحضور تراكمي بلغ ({s5.totalPresentEntries}) مشاركاً من أعضاء المجتمع.
              </p>
              <p>
                ٢. صدرت عن الاجتماعات ({s5.recommendationsRows.length}) توصيات مرتبطة بالخطة التشغيلية أُنجز منها ({completedRecsCount}) توصيات مكتملة.
              </p>
              <p>
                ٣. شملت متابعة الاجتماعات {s5.meetingsList.length > 0 ? s5.meetingsList.map((m) => `الاجتماع (${m.meetingNumber}) بتاريخ ${m.date}`).join('، ') : 'توثيق جدول الأعمال والتوصيات'}.
              </p>
            </div>
          </div>

          {s1.members.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#B8C9CB]">
              <h5 className="text-xs font-extrabold text-[#153C43] text-right">
                أعضاء فريق مجتمع التعلّم المهني ({s1.membersCount} أعضاء — كل اسم في بطاقة مستقلة):
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {s1.members.map((m) => (
                  <div
                    key={m.id}
                    data-testid={`plc-team-member-card-${m.id}`}
                    className="bg-white rounded-xl border-2 border-[#153C43] overflow-hidden text-center shadow-2xs"
                  >
                    <div className="h-1.5 bg-[#153C43]" />
                    <div className="p-3 space-y-1">
                      <span className="block text-xs font-extrabold text-[#153C43]">
                        {m.name}
                      </span>
                      <span className="block text-[11px] font-bold text-[#145B59]">
                        {m.rolesLabels.join(' · ')} — {m.specialty || s1.specialty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          الصفحة ٤: 03 مؤشرات الأداء (KPIs & Analytical Readings)
         ===================================================================== */}
      <section
        data-testid="plc-report-section-9-7"
        className="bg-white rounded-2xl border-2 border-[#B8C9CB] p-6 shadow-xs space-y-6"
      >
        {renderSectionBanner(
          '03',
          'مؤشرات الأداء المهنية (KPIs)',
          'تحليل كمي ونوعي للمؤشرات ومقارنة خط الأساس والمستهدف بالفعلي وفق اتجاه كل مؤشر',
          `إجمالي المؤشرات: ${s7.kpiRows.length}`
        )}

        {s7.kpiRows.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#F9F4E8] border border-[#C5A15D] text-[#153C43] text-xs font-extrabold text-center">
            لا تتوفر مؤشرات أداء مدخلة في هذا المجتمع؛ وتُعد الحالة غير قابلة للحكم الرقمي.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border-2 border-[#7E999D]">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-[#153C43] text-white font-extrabold border-b-4 border-[#C5A15D]">
                  <th className="p-3.5 border border-[#7E999D] text-center">المؤشر</th>
                  <th className="p-3.5 border border-[#7E999D] text-center">خط الأساس</th>
                  <th className="p-3.5 border border-[#7E999D] text-center">المستهدف</th>
                  <th className="p-3.5 border border-[#7E999D] text-center">الفعلي</th>
                  <th className="p-3.5 border border-[#7E999D] text-center">اتجاه المؤشر</th>
                  <th className="p-3.5 border border-[#7E999D] text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {s7.kpiRows.map((k) => {
                  const isMet =
                    k.isCalculated &&
                    k.achievementPercentage !== null &&
                    k.achievementPercentage >= 100;
                  const statusLabel =
                    k.direction === 'not_applicable'
                      ? 'وصفي (لا ينطبق حساب نسبة)'
                      : !k.isCalculated || k.achievementPercentage === null
                      ? 'غير قابل للحكم لنقص البيانات'
                      : isMet
                      ? `متحقق (${k.achievementDisplay})`
                      : `دون المستهدف (${k.achievementDisplay})`;

                  return (
                    <tr key={k.kpiId} className="bg-white hover:bg-[#F8F6F1]">
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#153C43] text-center">
                        {k.indicatorName}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-bold text-[#0D262A] tabular-nums text-center">
                        {k.baselineDisplay}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#0D262A] tabular-nums text-center">
                        {k.targetDisplay}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-black text-[#153C43] tabular-nums text-center">
                        {k.actualDisplay}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-bold text-[#145B59] text-center">
                        {k.directionLabel}
                      </td>
                      <td
                        className={`p-3.5 border border-[#7E999D] font-extrabold tabular-nums text-center ${
                          k.direction === 'not_applicable' || !k.isCalculated
                            ? 'text-[#0D262A]'
                            : isMet
                            ? 'text-[#145B59]'
                            : 'text-[#153C43]'
                        }`}
                      >
                        {statusLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* القراءة التحليلية لنتائج المؤشرات (كل مؤشر في سطر مستقل وبمحاذاة لليمين) */}
        <div
          data-testid="plc-kpi-analytical-reading-box"
          className="p-5 rounded-xl bg-[#F2EFE7] border-2 border-[#153C43] text-right space-y-2"
        >
          <h4 className="text-xs sm:text-sm font-extrabold text-[#153C43] text-right">
            ٢. القراءة التحليلية لنتائج المؤشرات (كل مؤشر في سطر مستقل)
          </h4>
          <div className="space-y-1.5 text-xs font-bold text-[#0D262A] leading-relaxed text-right">
            {s7.kpiRows.map((k) => (
              <p key={k.kpiId} className="text-right">
                • {k.indicatorName} ({k.directionLabel}): خط الأساس [{k.baselineDisplay}] ← المستهدف [{k.targetDisplay}] ← المتحقق [{k.actualDisplay}] — {k.descriptiveComparison}
              </p>
            ))}
          </div>
        </div>

        {/* الرسوم البيانية التحليلية */}
        <div
          data-testid="plc-report-section-9-13"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {s13.allCharts.map((chart) => renderChartCard(chart))}
        </div>

        {/* القراءة التحليلية القصيرة أسفل الرسم البياني للمؤشرات */}
        <div
          data-testid="plc-kpi-chart-analytical-reading"
          className="p-4 rounded-xl bg-[#EBF3F2] border-2 border-[#145B59] text-right space-y-1.5"
        >
          <h5 className="text-xs font-extrabold text-[#153C43] text-right">
            قراءة تحليلية للرسم البياني ومؤشرات الأداء:
          </h5>
          <p className="text-xs font-bold text-[#0D262A] leading-relaxed text-right">
            • في المؤشرات التصاعدية (كلما ارتفع كان أفضل) تجاوزت القراءة الفعلية القيمة المستهدفة، وفي المؤشرات التنازلية (كلما انخفض كان أفضل) انخفضت القراءة الفعلية دون السقف المستهدف؛ مما يؤكد اتساق اتجاه التحسن الكمي عبر جميع المؤشرات المقاسة وتكاملها مع مخرجات البرامج المنفذة.
          </p>
        </div>
      </section>

      {/* =====================================================================
          الصفحة ٥: 04 قياس الأثر والشواهد المختارة (Impact & Selected Evidences)
         ===================================================================== */}
      <section
        data-testid="plc-report-section-9-8"
        className="bg-white rounded-2xl border-2 border-[#B8C9CB] p-6 shadow-xs space-y-6"
      >
        {renderSectionBanner(
          '04',
          'قياس الأثر والشواهد المختارة',
          'التمييز المنهجي بين مخرجات التنفيذ، والتحسن المهني، والأثر التعليمي المقاس مع أهم الشواهد الموثقة',
          `${s9.totalEvidencesCount} شواهد مسجلة، ${selectedEvidences.length} شواهد مختارة للعرض`
        )}

        {/* بطاقات التمييز المنهجي الثلاث (موسّطة) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border-2 border-[#153C43] overflow-hidden text-center">
            <div className="bg-[#153C43] text-white py-2.5 px-3 text-xs font-extrabold">
              ١. مخرجات التنفيذ (ما تم فعليًا)
            </div>
            <div className="p-4 space-y-1.5">
              <p className="text-sm font-extrabold text-[#153C43] tabular-nums">
                {executedActivitiesCount} برامج/أنشطة منفذة · {s4.completedCount} إجراءات مكتملة
              </p>
              <p className="text-xs font-semibold text-[#0D262A] leading-relaxed">
                إتمام الاجتماعات والورش والزيارات التبادلية وإعداد الأدوات؛ وهي مخرجات عمل مباشرة.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#F9F4E8] border-2 border-[#C5A15D] overflow-hidden text-center">
            <div className="bg-[#145B59] text-white py-2.5 px-3 text-xs font-extrabold">
              ٢. التحسن المهني (ممارسة الفريق)
            </div>
            <div className="p-4 space-y-1.5">
              <p className="text-sm font-extrabold text-[#145B59] tabular-nums">
                {s8.describedOutcomesCount} سجل تحسن مهني مرصود
              </p>
              <p className="text-xs font-semibold text-[#0D262A] leading-relaxed">
                تطور الممارسات التدريسية وتبادل الخبرات بين المعلمين المرصود عبر الملاحظة الصفية والتقويم النوعي.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#EBF3F2] border-2 border-[#145B59] overflow-hidden text-center">
            <div className="bg-[#153C43] text-white py-2.5 px-3 text-xs font-extrabold">
              ٣. الأثر التعليمي المقاس (النتيجة)
            </div>
            <div className="p-4 space-y-1.5">
              <p className="text-sm font-extrabold text-[#153C43] tabular-nums">
                {s8.verifiedImpactsCount} سجل أثر كمي مقاس ومثبت
              </p>
              <p className="text-xs font-semibold text-[#0D262A] leading-relaxed">
                {s8.verifiedImpactsCount > 0
                  ? 'تحسن فعلي مقاس بأدوات قبلية وبعدية ومقارنة رقمية بين خط الأساس والمستهدف والمتحقق.'
                  : 'لم تُسجل قراءات قياس كمية قبلية/بعدية كافية لإثبات أثر رقمي مقارن.'}
              </p>
            </div>
          </div>
        </div>

        {/* جدول خلاصة قياس الأثر (موسّط وواضح) */}
        {s8.rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border-2 border-[#7E999D]">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-[#153C43] text-white font-extrabold border-b-4 border-[#C5A15D]">
                  <th className="p-3.5 border border-[#7E999D] text-center">
                    الفئة المستهدفة والمجال
                  </th>
                  <th className="p-3.5 border border-[#7E999D] text-center">
                    أداة وطريقة القياس
                  </th>
                  <th className="p-3.5 border border-[#7E999D] text-center">
                    الأساس ← المستهدف ← الفعلي
                  </th>
                  <th className="p-3.5 border border-[#7E999D] text-center">
                    خلاصة الأثر وقرار التحسين
                  </th>
                  <th className="p-3.5 border border-[#7E999D] text-center">
                    تصنيف الدليل
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {s8.rows.map((imp) => (
                  <tr key={imp.impactId} className="bg-white hover:bg-[#F8F6F1]">
                    <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#153C43] text-center">
                      {imp.beneficiaryCategoryDisplay}
                      <div className="text-[11px] font-bold text-[#145B59] mt-0.5">
                        {imp.activityDisplay !== 'غير مرتبط بنشاط محدد'
                          ? imp.activityDisplay
                          : imp.goalDisplay}
                      </div>
                    </td>
                    <td className="p-3.5 border border-[#7E999D] font-bold text-[#0D262A] text-center">
                      {imp.measurementMethodDisplay}
                    </td>
                    <td className="p-3.5 border border-[#7E999D] font-bold text-[#0D262A] tabular-nums text-center">
                      أساس: {imp.baselineDisplay} | مستهدف: {imp.targetDisplay} | فعلي:{' '}
                      <strong className="text-[#153C43]">{imp.actualResultDisplay}</strong>
                    </td>
                    <td className="p-3.5 border border-[#7E999D] text-[#0D262A] leading-relaxed text-center">
                      <p className="font-bold text-[#0D262A]">
                        {imp.impactDescriptionDisplay}
                      </p>
                      <span className="text-[11px] font-extrabold text-[#145B59]">
                        قرار التحسين: {imp.improvementDecisionDisplay}
                      </span>
                    </td>
                    <td className="p-3.5 border border-[#7E999D] font-extrabold text-center">
                      <span className="text-[#153C43]">{imp.classificationLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* الشواهد المختارة الأكثر دلالة على الإنجاز (مع رموز QR مكبرة وقابلة للضغط + رابط نصي مباشر بجوارها) */}
        <div
          data-testid="plc-report-section-9-9"
          className="pt-3 border-t border-[#B8C9CB] space-y-3"
        >
          <div className="text-center space-y-1">
            <h4 className="text-sm font-extrabold text-[#153C43] flex items-center justify-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#145B59]" />
              <span>
                الشواهد المختارة الأكثر دلالة على الإنجاز ({s9.totalEvidencesCount} شواهد مسجلة، {selectedEvidences.length} شواهد مختارة للعرض)
              </span>
            </h4>
            <p className="text-xs font-bold text-[#0D262A]">
              جميع الشواهد الـ ({s9.totalEvidencesCount}) معروضة بالكامل مع المرفقات البصرية في «التقرير التفصيلي للمجتمع» — مرتبطة بالأثر: ({s9.impactLinkedEvidencesCount}) · مرتبطة بالمؤشرات: ({s9.kpiLinkedEvidencesCount})
            </p>
          </div>

          {selectedEvidences.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#F9F4E8] border border-[#C5A15D] text-[#153C43] text-xs font-extrabold text-center">
              لا توجد شواهد مسجلة في مستودع الشواهد الموحد حتى الآن.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedEvidences.map((ev) => {
                const actionUri = resolveEvidenceActionUri(ev);
                const qrDataUrl = generateQrSvgDataUrl(actionUri, '#000000', white, 4);
                const rawEv = (effectiveCommunity.evidenceRepository || []).find(
                  (item) => item.id === ev.evidenceId
                );

                const handleOpenEvidenceAction = (e: React.MouseEvent) => {
                  if (rawEv?.fileDataUrl || actionUri.startsWith('#/') || actionUri.startsWith('plc://')) {
                    e.preventDefault();
                    setActiveEvidenceModal({
                      title: ev.title,
                      typeLabel: ev.typeLabel,
                      whatItProves: ev.whatItProves,
                      linkedSummary: ev.linkedSummary,
                      uri: actionUri,
                      fileDataUrl: rawEv?.fileDataUrl,
                      linkUrl: rawEv?.externalUrl,
                    });
                  }
                };

                return (
                  <div
                    key={ev.evidenceId}
                    data-testid={`plc-selected-evidence-card-${ev.evidenceId}`}
                    className="p-4 rounded-xl bg-[#F2EFE7] border-2 border-[#153C43] flex flex-col sm:flex-row items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0 text-right w-full">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-[#153C43]">
                          {ev.title}
                        </span>
                        <span className="text-[11px] font-bold text-[#145B59]">
                          ({ev.typeLabel})
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#0D262A] leading-relaxed">
                        <strong className="text-[#153C43]">ما يثبته الشاهد:</strong>{' '}
                        {ev.whatItProves}
                      </p>
                      <p className="text-[11px] font-extrabold text-[#145B59]">
                        الارتباط: {ev.linkedSummary}
                      </p>

                      {/* الرابط النصي القابل للضغط بجوار/أسفل بيانات الشاهد المؤدي لنفس وجهة رمز QR */}
                      <div className="pt-1.5">
                        <a
                          href={actionUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleOpenEvidenceAction}
                          data-testid={`plc-evidence-text-link-${ev.evidenceId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EBF3F2] hover:bg-[#145B59] text-[#145B59] hover:text-white border border-[#145B59] text-xs font-extrabold underline transition cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>فتح الشاهد / عرض الرابط</span>
                        </a>
                      </div>
                    </div>

                    {qrDataUrl && (
                      <a
                        href={actionUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleOpenEvidenceAction}
                        data-testid={`plc-evidence-qr-link-${ev.evidenceId}`}
                        title={`فتح الشاهد: ${ev.title}`}
                        className="shrink-0 flex flex-col items-center gap-1.5 bg-white p-2.5 rounded-xl border-2 border-[#153C43] hover:border-[#C5A15D] shadow-2xs transition cursor-pointer"
                      >
                        <img
                          src={qrDataUrl}
                          alt={`رمز QR للشاهد ${ev.title}`}
                          className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <span className="text-[10px] font-extrabold text-[#153C43] flex items-center gap-1">
                          <QrCode className="w-3 h-3 text-[#145B59]" />
                          <span>امسح أو اضغط للفتح</span>
                        </span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          الصفحة ٦: 05 التحديات والتوصيات والخطوات القادمة + التوقيع والختم
         ===================================================================== */}
      <section className="bg-white rounded-2xl border-2 border-[#B8C9CB] p-6 shadow-xs space-y-8">
        {renderSectionBanner(
          '05',
          'التحديات والتوصيات والخطوات القادمة',
          'استخلاص التحديات الموثقة وربطها بتوصيات إجرائية قابلة للتنفيذ وأولويات الدورة القادمة للمجتمع'
        )}

        {/* ١. جدول التحديات الفعلية المرصودة */}
        <div
          data-testid="plc-report-section-9-11"
          className="space-y-3"
        >
          <h4 className="text-sm font-extrabold text-[#153C43] text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C5A15D] shrink-0" />
            <span>١. التحديات الفعلية المرصودة وأسبابها الموثقة</span>
          </h4>
          {s11.items.length === 0 ? (
            <p className="text-xs font-bold text-[#0D262A] text-center bg-[#F2EFE7] p-4 rounded-xl border border-[#B8C9CB]">
              {s11.emptyMessage}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border-2 border-[#7E999D]">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#153C43] text-white font-extrabold border-b-4 border-[#C5A15D]">
                    <th className="p-3.5 border border-[#7E999D] text-center w-14">م</th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      التحدي الفعلي المرصود
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      السبب / الملاحظة الموثقة
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center">
                      مصدر الرصد
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {s11.items.slice(0, 5).map((item, idx) => (
                    <tr key={item.id} className="bg-white hover:bg-[#F8F6F1]">
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#153C43] text-center">
                        {idx + 1}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#0D262A] text-center">
                        {item.statement}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-semibold text-[#0D262A] text-center">
                        {item.recordedNote || 'مرصود أثناء متابعة التنفيذ والقياس'}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-bold text-[#145B59] text-center">
                        {item.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ٢. جدول التوصيات الإجرائية والأولويات القادمة (بدون عمود الاستحقاق وبدون أي تواريخ) */}
        <div
          data-testid="plc-report-section-9-12"
          className="space-y-3"
        >
          <h4 className="text-sm font-extrabold text-[#153C43] text-center flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4 text-[#145B59] shrink-0" />
            <span>٢. التوصيات الإجرائية والأولويات القادمة للتحسين المستمر</span>
          </h4>
          {s12.extractedRecommendations.length === 0 ? (
            <p className="text-xs text-[#0D262A] font-bold text-center bg-[#F2EFE7] p-4 rounded-xl border border-[#B8C9CB]">
              لا توجد توصيات مستخرجة آليًا في السجلات الحالية.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border-2 border-[#7E999D]">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#153C43] text-white font-extrabold border-b-4 border-[#C5A15D]">
                    <th className="p-3.5 border border-[#7E999D] text-center w-[10%]">م</th>
                    <th className="p-3.5 border border-[#7E999D] text-center w-[58%]">
                      التوصية الإجرائية / الأولوية القادمة
                    </th>
                    <th className="p-3.5 border border-[#7E999D] text-center w-[32%]">
                      الجهة المسؤولة / القرار
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {s12.extractedRecommendations.slice(0, 5).map((rec, idx) => (
                    <tr key={rec.id} className="bg-white hover:bg-[#F8F6F1]">
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#153C43] text-center">
                        {idx + 1}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-extrabold text-[#0D262A] text-center">
                        {rec.statement.replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '').trim()}
                      </td>
                      <td className="p-3.5 border border-[#7E999D] font-bold text-[#145B59] text-center">
                        {(rec.responsibleOrDecision || 'فريق المجتمع المهني').replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '').trim()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ٣. الملاحظات والمرئيات الختامية (بدون لفظ التنفيذية + عناوين فرعية ملونة متبوعة بنصها في نفس السطر) */}
        <div
          data-testid="plc-report-closing-notes-box"
          className="p-5 rounded-xl bg-[#F2EFE7] border-2 border-[#153C43] text-right space-y-2.5"
        >
          <h4 className="text-xs sm:text-sm font-extrabold text-[#153C43] text-right">
            ٣. الملاحظات والمرئيات الختامية
          </h4>
          <div className="space-y-2 text-xs font-semibold text-[#0D262A] leading-relaxed text-right">
            <p className="text-right">
              <strong className="font-extrabold text-[#145B59]">• خلاصة: </strong>
              <span>
                {(s12.customExecutiveNotes || report.generalAnalysis.paragraphs[0] || 'انتظم عمل المجتمع المهني وفق خطته المعتمدة وحقق تكاملاً بين البرامج المنفذة وأدوات القياس.')
                  .replace(/التنفيذية|التنفيذي/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()}
              </span>
            </p>
            <p className="text-right">
              <strong className="font-extrabold text-[#153C43]">• التشخيص الدقيق للاحتياجات: </strong>
              <span>
                {(s3.rows.length > 0
                  ? `ارتكزت تدخلات المجتمع على معالجة (${s3.rows[0].needDescription}) وربطها مباشرة بأهداف التحسين الصفي.`
                  : s3.traceabilitySummary
                )
                  .replace(/التنفيذية|التنفيذي/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()}
              </span>
            </p>
            <p className="text-right">
              <strong className="font-extrabold text-[#145B59]">• الأولويات القادمة: </strong>
              <span>
                {(
                  s12.customClosingNotes ||
                  (s12.extractedRecommendations.length > 0
                    ? s12.extractedRecommendations[0].statement
                    : 'استدامة الزيارات التبادلية وتعميق أثر الممارسات التدريسية في الفصول الدراسية.')
                )
                  .replace(/التنفيذية|التنفيذي/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()}
              </span>
            </p>
          </div>
        </div>

        {/* الحقل اليدوي الوحيد المسموح: تعديل الملاحظات والمرئيات الختامية لرئيس المجتمع */}
        <div className="pt-4 border-t border-[#B8C9CB] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-[#153C43]">
              تخصيص الملاحظات والتوصيات الختامية لرئيس المجتمع (تُحفظ وتبقى عند إعادة التوليد)
            </h4>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSaveClosingNotes}
                data-testid="plc-save-closing-notes-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#153C43] hover:bg-[#145B59] text-white text-xs font-bold transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ الملاحظات الختامية</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-[#153C43] mb-1">
                ملاحظات ختامية إضافية لرئيس المجتمع (اختياري)
              </label>
              <textarea
                rows={3}
                value={customExecutiveNotes}
                readOnly={readOnly}
                onChange={(e) => {
                  if (!readOnly) setCustomExecutiveNotes(e.target.value);
                }}
                data-testid="plc-custom-executive-notes-input"
                placeholder="أدخل أي ملاحظات ختامية تخص أعمال المجتمع..."
                className="w-full rounded-xl border-2 border-[#B8C9CB] px-3 py-2 text-xs text-[#0D262A] focus:outline-none focus:ring-2 focus:ring-[#153C43] read-only:bg-[#F2EFE7]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#153C43] mb-1">
                توصيات ختامية وأولويات التحسين للدورة القادمة (اختياري)
              </label>
              <textarea
                rows={3}
                value={customClosingNotes}
                readOnly={readOnly}
                onChange={(e) => {
                  if (!readOnly) setCustomClosingNotes(e.target.value);
                }}
                data-testid="plc-custom-closing-notes-input"
                placeholder="أدخل التوصيات الختامية المقترحة لتطوير أعمال المجتمع..."
                className="w-full rounded-xl border-2 border-[#B8C9CB] px-3 py-2 text-xs text-[#0D262A] focus:outline-none focus:ring-2 focus:ring-[#153C43] read-only:bg-[#F2EFE7]"
              />
            </div>
          </div>
        </div>

        {/* ===================================================================
            أسفل الصفحة الأخيرة: التوقيع والختم (حسب الضوابط 2.8)
            - اليمين: صفة رئيس المجتمع، الاسم، التخصص (دون كلمة «التوقيع»)
            - الوسط: كلمة «الختم» فقط دون إطار أو جدول مستقل حولها ودون عبارة «مكان الختم الرسمي للمدرسة»
            - اليسار: صفة مدير المدرسة والاسم فقط (دون اسم المدرسة ودون «التوقيع والختم»)
           =================================================================== */}
        <div
          data-testid="plc-report-official-signoff"
          className="rounded-2xl bg-[#F2EFE7] border-2 border-[#153C43] overflow-hidden space-y-4"
        >
          <div className="bg-[#153C43] text-white py-3 px-4 text-center border-b-2 border-[#C5A15D]">
            <h4 className="text-sm sm:text-base font-extrabold text-white">
              التوقيع والختم الرسمي
            </h4>
          </div>

          <div className="px-5 pt-1 pb-5 space-y-4">
            <p className="text-xs font-bold text-[#0D262A] text-center max-w-3xl mx-auto">
              وثّق هذا التقرير النهائي حصيلة أعمال وشواهد «{report.communityName}» خلال {s1.semesterLabel} من العام الدراسي {s1.academicYear}.
            </p>

            {/* توزيع أفقي ثلاثي متوازن: اليسار = مدير المدرسة | الوسط = الختم فقط دون إطار | اليمين = رئيس المجتمع */}
            <div
              dir="ltr"
              className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center"
            >
              {/* الجهة اليسرى (Left Side): صفة مدير المدرسة والاسم فقط */}
              <div
                dir="rtl"
                data-testid="plc-report-signoff-principal-left"
                className="rounded-xl bg-white border-2 border-[#145B59] overflow-hidden shadow-2xs flex flex-col justify-between text-center"
              >
                <div className="px-3 py-2 bg-[#145B59] text-white text-xs font-extrabold text-center">
                  {genderedLabels.principalTitle}
                </div>
                <div className="p-5 flex items-center justify-center text-center">
                  <p className="text-sm sm:text-base font-extrabold text-[#0D262A]">
                    {principalNameDisplay}
                  </p>
                </div>
              </div>

              {/* الوسط (Center): كلمة «الختم» فقط دون إطار أو جدول مستقل حولها */}
              <div
                dir="rtl"
                data-testid="plc-report-signoff-stamp-center"
                className="py-6 flex items-center justify-center text-center"
              >
                <span className="text-base sm:text-lg font-extrabold text-[#153C43]">
                  الختم
                </span>
              </div>

              {/* الجهة اليمنى (Right Side): صفة رئيس المجتمع، الاسم، التخصص فقط */}
              <div
                dir="rtl"
                data-testid="plc-report-signoff-leader-right"
                className="rounded-xl bg-white border-2 border-[#153C43] overflow-hidden shadow-2xs flex flex-col justify-between text-center"
              >
                <div className="px-3 py-2 bg-[#153C43] text-white text-xs font-extrabold text-center">
                  رئيس مجتمع التعلّم المهني
                </div>
                <div className="p-4 space-y-1.5 text-center">
                  <p className="text-sm sm:text-base font-extrabold text-[#0D262A]">
                    {s1.leaderNameDisplay}
                  </p>
                  <p className="text-xs font-bold text-[#145B59]">
                    {s1.leaderSpecialtyDisplay}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* شريط التنقل السفلي وتنزيل التقريرين (المختصر والتفصيلي) PDF */}
      <div
        data-testid="plc-report-footer-bar"
        className="bg-white rounded-2xl border-2 border-[#153C43] p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-0.5">
            <p
              data-testid="plc-report-readiness-text"
              className="text-xs sm:text-sm font-extrabold text-[#153C43]"
            >
              {report.completeness.allComplete
                ? 'حالة التقرير النهائي: مكتمل بالكامل (٩ / ٩ أقسام) وجاهز للتنزيل بالنسختين المختصرة والتفصيلية بصيغة PDF.'
                : `حالة التقرير النهائي: مكتمل جزئياً (${report.completeness.completedSectionsCount} / ${report.completeness.totalSectionsCount} أقسام) ومتاح للتنزيل بصيغة PDF بالبيانات المتوفرة.`}
            </p>
            <p className="text-[11px] font-medium text-[#0D262A]">
              يمكنك تنزيل «التقرير النهائي المختصر» (٦ صفحات A4) أو «التقرير التفصيلي للمجتمع» الشامل للنماذج التسعة ومستودع الشواهد الكامل والمرفقات البصرية.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => onNavigateForm(8)}
              data-testid="plc-report-back-to-form8-btn"
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#153C43] bg-white hover:bg-[#F2EFE7] text-[#153C43] text-xs sm:text-sm font-extrabold transition cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" />
              <span>النموذج السابق (٨. الشواهد)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPdfPreview('concise')}
              data-testid="plc-footer-preview-pdf-btn"
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#C5A15D] bg-[#F2EFE7] hover:bg-[#E8E3D6] text-[#153C43] text-xs sm:text-sm font-extrabold transition cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#153C43] shrink-0" />
              <span>معاينة PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportConcisePdf}
              disabled={isExportingAnyPdf}
              data-testid="plc-footer-export-pdf-btn"
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#153C43] hover:bg-[#145B59] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-extrabold border border-[#C5A15D] shadow-xs transition cursor-pointer"
            >
              {isExportingConcisePdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0 text-[#C5A15D]" />
              )}
              <span>
                {isExportingConcisePdf
                  ? 'جارٍ تنزيل التقرير المختصر...'
                  : conciseDownloadButtonLabel}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportDetailedPdf}
              disabled={isExportingAnyPdf}
              data-testid="plc-footer-export-detailed-pdf-btn"
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#145B59] hover:bg-[#153C43] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-extrabold border-2 border-[#C5A15D] shadow-xs transition cursor-pointer"
            >
              {isExportingDetailedPdf ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Layers className="w-4 h-4 shrink-0 text-[#C5A15D]" />
              )}
              <span>
                {isExportingDetailedPdf
                  ? 'جارٍ تنزيل التقرير التفصيلي...'
                  : detailedDownloadButtonLabel}
              </span>
            </button>
          </div>
        </div>

        {statusFeedback && (
          <div
            data-testid="plc-report-footer-export-success"
            className="p-3 rounded-xl bg-[#EBF3F2] border border-[#145B59] text-[#153C43] text-xs font-extrabold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#145B59] shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {exportError && (
          <div
            data-testid="plc-report-footer-export-error"
            className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      {/* نافذة استعراض الشاهد والمرفق البصري عند الضغط على رمز QR أو رابط الشاهد */}
      {activeEvidenceModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          data-testid="plc-evidence-viewer-modal"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border-2 border-[#153C43] overflow-hidden">
            <div className="p-4 bg-[#153C43] text-white border-b-2 border-[#C5A15D] flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold">
                  معاينة الشاهد الموثق: {activeEvidenceModal.title}
                </h3>
                <p className="text-xs text-[#C5A15D] mt-0.5">
                  النوع: {activeEvidenceModal.typeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveEvidenceModal(null)}
                data-testid="plc-close-evidence-viewer-btn"
                className="px-3 py-1.5 rounded-lg bg-white text-[#153C43] text-xs font-extrabold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <div className="p-5 space-y-4 text-right">
              <div className="p-3.5 rounded-xl bg-[#F2EFE7] border border-[#B8C9CB] space-y-1.5 text-xs">
                <p className="font-bold text-[#0D262A]">
                  <strong className="text-[#153C43]">ما يثبته الشاهد:</strong>{' '}
                  {activeEvidenceModal.whatItProves}
                </p>
                <p className="font-bold text-[#145B59]">
                  <strong>الارتباط بالسجلات:</strong> {activeEvidenceModal.linkedSummary}
                </p>
              </div>

              {activeEvidenceModal.fileDataUrl && (
                <div className="p-3 rounded-xl bg-white border-2 border-[#153C43] text-center space-y-2">
                  <p className="text-xs font-extrabold text-[#153C43]">
                    المرفق البصري المضمن في الشاهد:
                  </p>
                  <img
                    src={activeEvidenceModal.fileDataUrl}
                    alt={activeEvidenceModal.title}
                    className="max-h-80 w-auto mx-auto rounded-lg border border-[#B8C9CB]"
                  />
                </div>
              )}

              {activeEvidenceModal.linkUrl && (
                <div className="p-3 rounded-xl bg-[#EBF3F2] border border-[#145B59] flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#153C43] truncate" dir="ltr">
                    {activeEvidenceModal.linkUrl}
                  </span>
                  <a
                    href={activeEvidenceModal.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#153C43] text-white font-extrabold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح الرابط الخارجي</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة معاينة صفحات PDF المطابقة (A4) للتقرير المختصر والتقرير التفصيلي */}
      {showPdfPreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          data-testid="plc-pdf-preview-modal"
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#153C43] overflow-hidden">
            <div className="p-4 border-b border-[#B8C9CB] flex flex-wrap items-center justify-between gap-3 bg-[#F2EFE7]">
              <div>
                <h3 className="text-base font-extrabold text-[#153C43] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#145B59]" />
                  <span>
                    {previewMode === 'detailed'
                      ? `معاينة التقرير التفصيلي للمجتمع (${previewPageImages.length} صفحات A4)`
                      : `معاينة التقرير النهائي المختصر (${previewPageImages.length} صفحات A4)`}
                  </span>
                </h3>
                <p className="text-xs font-medium text-[#0D262A]">
                  المعاينة مطابقة تمامًا لملف PDF المصدّر شاملة الغلاف الرسمي وشعار وزارة التعليم والزخارف الهندسية ورموز QR القابلة للمسح والضغط والتوقيع والختم.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPdfPreview('concise')}
                  data-testid="plc-preview-mode-concise"
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    previewMode === 'concise'
                      ? 'bg-[#153C43] text-white border-[#C5A15D]'
                      : 'bg-white text-[#153C43] border-[#153C43]'
                  }`}
                >
                  التقرير المختصر (٦ صفحات)
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPdfPreview('detailed')}
                  data-testid="plc-preview-mode-detailed"
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    previewMode === 'detailed'
                      ? 'bg-[#145B59] text-white border-[#C5A15D]'
                      : 'bg-white text-[#145B59] border-[#145B59]'
                  }`}
                >
                  التقرير التفصيلي الشامل
                </button>
                <button
                  type="button"
                  onClick={
                    previewMode === 'detailed'
                      ? handleExportDetailedPdf
                      : handleExportConcisePdf
                  }
                  disabled={isExportingAnyPdf}
                  data-testid="plc-modal-export-pdf-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#153C43] hover:bg-[#145B59] disabled:opacity-60 text-white text-xs font-extrabold border border-[#C5A15D] transition cursor-pointer"
                >
                  {isExportingAnyPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[#C5A15D]" />
                  )}
                  <span>
                    {previewMode === 'detailed'
                      ? detailedDownloadButtonLabel
                      : conciseDownloadButtonLabel}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfPreviewModal(false)}
                  data-testid="plc-close-pdf-preview-btn"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#153C43] hover:bg-[#EBF3F2] text-[#153C43] text-xs font-extrabold cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>إغلاق المعاينة</span>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-[#F2EFE7]/70">
              {previewPageImages.map((imgUrl, idx) => (
                <div
                  key={idx}
                  data-testid={`plc-pdf-preview-page-${idx + 1}`}
                  className="bg-white rounded-xl shadow-md border-2 border-[#B8C9CB] p-2 max-w-3xl mx-auto"
                >
                  <div className="text-xs font-extrabold text-[#153C43] mb-2 px-2 flex justify-between">
                    <span>
                      {idx === 0
                        ? 'الصفحة ١ — الغلاف الرسمي'
                        : `الصفحة ${idx + 1} — رقم الفوتر: ${idx + 1}`}
                    </span>
                    <span>تخطيط طباعي رسمي A4</span>
                  </div>
                  <img
                    src={imgUrl}
                    alt={`صفحة ${idx + 1} من التقرير`}
                    className="w-full h-auto rounded-lg border border-[#B8C9CB]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

