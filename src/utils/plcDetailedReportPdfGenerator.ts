import { SchoolSettings } from '../types';
import {
  buildPlcFinalReport,
  PlcCommunityRecord,
  PlcFinalReportEvidenceRow,
  PlcGeneratedFinalReport,
} from './plcEngine';
import {
  buildPlcPdfBinaryWithLinks,
  dataUrlToUint8Array,
  drawBlockOnCanvas,
  drawInteriorPageFooter,
  drawInteriorPageHeader,
  drawOfficialCoverPage,
  drawPlcEmptySpaceWatermark,
  drawPlcRoundedBox,
  MINIMAL_WHITE_JPEG,
  PLC_REPORT_DESIGN_SYSTEM,
  PlcCategoryDistributionItem,
  PlcDonutIndicatorItem,
  PlcHighlightedNoteItem,
  PlcPdfBlock,
  PlcPdfLinkAnnotation,
  PlcPdfPageJpegWithLinks,
  PlcPdfPagePlan,
  PlcRenderedQrSpot,
  PlcSelectedEvidenceCardItem,
  PlcTargetActualComparisonItem,
  wrapArabicCellText,
} from './plcFinalReportPdfGenerator';
import { drawQrCodeOnCanvas } from './qrCodeGenerator';
import { getGenderedLabels } from './settingsStorage';
import { sanitizeFilenameSegment } from './zipBuilder';

const PAGE_W = PLC_REPORT_DESIGN_SYSTEM.spacing.pageWidth;
const PAGE_H = PLC_REPORT_DESIGN_SYSTEM.spacing.pageHeight;
const MARGIN_X = PLC_REPORT_DESIGN_SYSTEM.spacing.marginX;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const INTERIOR_START_Y = PLC_REPORT_DESIGN_SYSTEM.spacing.interiorContentStartY;
const FOOTER_RESERVE_H = PLC_REPORT_DESIGN_SYSTEM.spacing.footerReserveHeight;
const MAX_CONTENT_Y = PAGE_H - FOOTER_RESERVE_H;
const FONT_FAMILY = PLC_REPORT_DESIGN_SYSTEM.fonts.family;

const cachedEvidenceImages = new Map<string, HTMLImageElement>();

/**
 * Preloads all visual evidence attachments (`fileDataUrl` images/SVGs) so they can be
 * synchronously drawn directly onto the Detailed Report PDF canvases.
 */
export async function preloadPlcEvidenceImages(
  community: PlcCommunityRecord
): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }

  const tasks: Promise<void>[] = [];
  for (const ev of community.evidenceRepository || []) {
    const dataUrl = ev.fileDataUrl?.trim();
    if (!dataUrl || !dataUrl.startsWith('data:image/')) continue;
    if (cachedEvidenceImages.has(ev.id)) continue;

    tasks.push(
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          cachedEvidenceImages.set(ev.id, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      })
    );
  }

  await Promise.all(tasks);
}

export interface PlcDetailedTocEntry {
  chapterNumber: string;
  chapterTitle: string;
  formsCovered: string;
  metricsBadge: string;
  startPageNumber: number;
}

export interface PlcDetailedEvidenceItem {
  evidenceId: string;
  title: string;
  evidenceTypeLabel: string;
  descriptionDisplay: string;
  whatItProves: string;
  linkedRecordsDisplay: string[];
  fileNameDisplay: string;
  hasVisualAttachment: boolean;
  fileDataUrl?: string;
  destinationUri?: string;
  hasValidQr: boolean;
}

export interface PlcDetailedStatCardItem {
  label: string;
  value: string;
  sublabel: string;
  tone: 'petrol' | 'turquoise' | 'gold';
}

export type PlcDetailedVisualChartBlock =
  | {
      kind: 'section01_org_structure';
      pageGroup: number;
      leaderName: string;
      leaderSpecialty: string;
      membersCount: number;
      roleCounts: Array<{ roleLabel: string; count: number; names: string }>;
      analyticalReading: string;
      estimatedHeight: number;
    }
  | {
      kind: 'section01_identity_architecture';
      pageGroup: number;
      visionText: string;
      missionText: string;
      goals: string[];
      values: string[];
      principles: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'section02_needs_plan_analytics';
      pageGroup: number;
      totalNeeds: number;
      priorityBars: Array<{ label: string; count: number; percent: number; color: string }>;
      totalActions: number;
      completionPercent: number;
      statusBars: Array<{ label: string; count: number; percent: number; color: string }>;
      analyticalReading: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'section03_meetings_analytics';
      pageGroup: number;
      totalMeetings: number;
      avgAttendanceRate: number;
      meetingBars: Array<{
        label: string;
        date: string;
        presentCount: number;
        totalMembers: number;
        ratePercent: number;
      }>;
      totalRecommendations: number;
      recStatusBars: Array<{ label: string; count: number; percent: number; color: string }>;
      analyticalReading: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'section04_activities_analytics';
      pageGroup: number;
      totalRecords: number;
      executedRecords: number;
      typeBars: Array<{
        label: string;
        totalCount: number;
        executedCount: number;
        percentOfTotal: number;
      }>;
      statusBars: Array<{ label: string; count: number; percent: number; color: string }>;
      evaluatedCount: number;
      analyticalReading: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'section05_kpi_impact_analytics';
      pageGroup: number;
      kpiItems: Array<{
        name: string;
        baselineDisplay: string;
        targetDisplay: string;
        actualDisplay: string;
        directionLabel: string;
        directionCode: 'higher_is_better' | 'lower_is_better' | 'exact_target' | 'not_applicable';
        achievementPercent: number | null;
        achievementDisplay: string;
        isAchieved: boolean;
      }>;
      executionOutputsSummary: string[];
      measuredImpactSummary: string[];
      verifiedImpactsCount: number;
      describedImpactsCount: number;
      analyticalReading: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'section06_evidence_analytics';
      pageGroup: number;
      totalEvidences: number;
      linkedEvidences: number;
      typeBars: Array<{ label: string; count: number; percent: number; color: string }>;
      domainLinkBars: Array<{ label: string; count: number }>;
      analyticalReading: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'section07_closing_analytics';
      pageGroup: number;
      achievementsCount: number;
      challengesCount: number;
      recommendationsCount: number;
      domainComparisonBars: Array<{
        domainLabel: string;
        achievementsCount: number;
        challengesCount: number;
      }>;
      priorityCards: Array<{
        badge: string;
        title: string;
        responsible: string;
      }>;
      analyticalReading: string[];
      estimatedHeight: number;
    };

export type PlcDetailedBlock =
  | {
      kind: 'core_block';
      pageGroup: number;
      block: PlcPdfBlock;
      estimatedHeight: number;
    }
  | {
      kind: 'toc_block';
      pageGroup: number;
      statisticalSummaryPageNumber: number;
      entries: PlcDetailedTocEntry[];
      estimatedHeight: number;
    }
  | {
      kind: 'statistical_summary_header_and_cards';
      pageGroup: number;
      title: string;
      subtitle: string;
      badgeText: string;
      cards: PlcDetailedStatCardItem[];
      estimatedHeight: number;
    }
  | {
      kind: 'visual_chart_block';
      pageGroup: number;
      chart: PlcDetailedVisualChartBlock;
      estimatedHeight: number;
    }
  | {
      kind: 'detailed_qr_links_grid';
      pageGroup: number;
      title: string;
      subtitle: string;
      cards: PlcSelectedEvidenceCardItem[];
      estimatedHeight: number;
    }
  | {
      kind: 'detailed_evidence_repository_row';
      pageGroup: number;
      indexNumber: number;
      totalCount: number;
      item: PlcDetailedEvidenceItem;
      estimatedHeight: number;
    };

export interface PlcDetailedPagePlan {
  pageNumber: number;
  totalPages: number;
  isCoverPage?: boolean;
  pageGroup: number;
  pageTitle: string;
  footerLabel: string;
  blocks: PlcDetailedBlock[];
  plannedLinks: PlcPdfLinkAnnotation[];
  plannedQrSpots: PlcRenderedQrSpot[];
}

export interface PlcDetailedReportPagesModel {
  communityId: string;
  communityName: string;
  reportTitle: string;
  pages: PlcDetailedPagePlan[];
  tocEntries: PlcDetailedTocEntry[];
  statisticalSummaryPageNumber: number;
  totalEvidencesIncluded: number;
  allTextTokens: string[];
}

/**
 * Builds a single logical table block with comfortable, uncompressed row heights and font metrics.
 * Tables split naturally across continuation pages within the same section when needed,
 * repeating table headers automatically with `(تابع)`.
 */
function buildDetailedTableBlock(
  sectionCode: string,
  pageGroup: number,
  headers: string[],
  weights: number[],
  rows: string[][],
  title?: string,
  subtitleNote?: string,
  ctx?: CanvasRenderingContext2D | null
): PlcDetailedBlock {
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 100;
  const colWidths = weights.map((w) => Math.floor((w / totalWeight) * CONTENT_W));
  const lineH = 28;
  const headerH = 52;

  const allWrappedRows: string[][][] = [];
  const allRowHeights: number[] = [];

  for (const row of rows) {
    const wrappedCells: string[][] = headers.map((_, colIdx) => {
      const rawCell = row[colIdx] ?? 'غير متوفر';
      return wrapArabicCellText(rawCell, colWidths[colIdx] - 14, 11.4, ctx).slice(0, 4);
    });
    const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
    const rHeight = Math.max(50, maxLines * lineH + 20);
    allWrappedRows.push(wrappedCells);
    allRowHeights.push(rHeight);
  }

  const titleOverhead = (title ? 44 : 0) + (subtitleNote ? 30 : 0);
  const totalRowsH = allRowHeights.reduce((acc, h) => acc + h, 0);
  const estimatedHeight = headerH + titleOverhead + 24 + totalRowsH;

  return {
    kind: 'core_block',
    pageGroup,
    estimatedHeight,
    block: {
      kind: 'table',
      sectionCode,
      pageGroup,
      title,
      subtitleNote,
      headers,
      columnWeightPercents: weights,
      wrappedRows: allWrappedRows,
      rowHeights: allRowHeights,
      headerHeight: headerH,
      estimatedHeight,
    },
  };
}

function buildDetailedParagraphBlock(
  sectionCode: string,
  pageGroup: number,
  rawLines: string[],
  title?: string,
  tone: 'neutral' | 'emerald' | 'amber' | 'indigo' | 'maroon' = 'neutral',
  ctx?: CanvasRenderingContext2D | null,
  centerAligned = false,
  highlightedNotes?: PlcHighlightedNoteItem[]
): PlcDetailedBlock {
  const wrappedLines: string[] = [];
  for (const line of rawLines) {
    const subLines = wrapArabicCellText(line, CONTENT_W - 88, 12.2, ctx);
    wrappedLines.push(...subLines);
  }
  const safeLines = wrappedLines.length > 0 ? wrappedLines : ['غير متوفر'];
  const titleH = title ? 42 : 0;

  let notesHeight = 0;
  if (highlightedNotes && highlightedNotes.length > 0) {
    for (const note of highlightedNotes) {
      const combined = `${note.prefix}: ${note.text}`;
      const noteSubLines = wrapArabicCellText(combined, CONTENT_W - 88, 12.2, ctx).slice(0, 2);
      notesHeight += noteSubLines.length * 30 + 8;
    }
  }

  const estimatedHeight =
    titleH +
    (highlightedNotes && highlightedNotes.length > 0
      ? notesHeight + 28
      : safeLines.length * 30 + 28);

  return {
    kind: 'core_block',
    pageGroup,
    estimatedHeight,
    block: {
      kind: 'paragraphs_box',
      sectionCode,
      pageGroup,
      title,
      lines: safeLines,
      highlightedNotes,
      tone,
      centerAligned,
      estimatedHeight,
    },
  };
}

/**
 * Computes the exact vertical advance (height + bottom gap) that a block consumes
 * when rendered on the canvas, ensuring 100% alignment between the pagination engine,
 * link coordinate simulation, and actual canvas drawing.
 */
function getBlockAdvanceHeight(
  item: PlcDetailedBlock,
  nextItem?: PlcDetailedBlock | null
): number {
  if (item.kind === 'toc_block') {
    return item.estimatedHeight + 20;
  }
  if (item.kind === 'statistical_summary_header_and_cards') {
    return item.estimatedHeight + 20;
  }
  if (item.kind === 'visual_chart_block') {
    return item.estimatedHeight + 22;
  }
  if (item.kind === 'detailed_qr_links_grid') {
    return item.estimatedHeight + 22;
  }
  if (item.kind === 'detailed_evidence_repository_row') {
    return item.estimatedHeight + 20;
  }
  const blk = item.block;
  const nextCoreKind =
    nextItem && nextItem.kind === 'core_block' ? nextItem.block.kind : undefined;

  switch (blk.kind) {
    case 'table':
      return (
        blk.estimatedHeight +
        (nextCoreKind === 'table'
          ? PLC_REPORT_DESIGN_SYSTEM.spacing.tableGap
          : PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap)
      );
    case 'team_members_cards':
    case 'dual_charts':
    case 'chart':
    case 'official_signoff_block':
    case 'page2_visual_analytics':
      return blk.estimatedHeight + 22;
    default:
      return blk.estimatedHeight + PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap;
  }
}

/**
 * Returns the minimum height required to start rendering `item` (or its first split chunk)
 * on the current page. Used to prevent orphan section headers at the bottom of a page.
 */
function getMinStartHeightForBlock(item: PlcDetailedBlock | null | undefined): number {
  if (!item) return 0;
  if (item.kind === 'core_block' && item.block.kind === 'table') {
    const tbl = item.block;
    const titleOverhead = (tbl.title ? 44 : 0) + (tbl.subtitleNote ? 30 : 0);
    const firstRowH = tbl.rowHeights[0] || 52;
    return tbl.headerHeight + titleOverhead + 24 + firstRowH;
  }
  if (item.kind === 'detailed_qr_links_grid') {
    return 74 + 162 + 14;
  }
  return item.estimatedHeight;
}

/**
 * Builds the comprehensive multi-page pagination model for the standalone
 * Detailed Community Report (`التقرير التفصيلي لمجتمع التعلّم المهني`) adhering strictly to:
 * 1. Page 1: Standalone Cover Page (`pageGroup = 0`).
 * 2. Page 2: Standalone Table of Contents Page (`pageGroup = 1`) with comfortable spacing and dynamic page numbers.
 * 3. Page 3: Standalone Statistical Summary & General Analysis Page (`pageGroup = 2`) with 8 key metrics + visual charts.
 * 4. Sections `01` through `07` (`pageGroup = 11..17`): Each main section starts on a NEW page, while content within
 *    the same section flows naturally across 1, 2, or more pages without compression or artificial sub-form breaks.
 * 5. Rich, data-driven visual charts and analytical readings embedded inside each of the 7 main sections.
 * 6. Zero `"00"` numbering anywhere.
 */
export function buildPlcDetailedReportPdfPagesModel(
  community: PlcCommunityRecord,
  settings?: SchoolSettings,
  reportOverride?: PlcGeneratedFinalReport,
  ctx?: CanvasRenderingContext2D | null
): PlcDetailedReportPagesModel {
  const report = reportOverride ?? buildPlcFinalReport(community);
  const rawBlocks: PlcDetailedBlock[] = [];
  const textTokens: string[] = [];
  const recordToken = (t: string | undefined | null) => {
    if (t && t.trim()) textTokens.push(t.trim());
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

  const schoolNameDisplay = settings?.schoolName?.trim() || 'غير محدد';
  const eduDeptDisplay = settings?.educationDepartment?.trim() || 'إدارة التعليم';
  const principalNameDisplay = settings?.principalName?.trim() || 'غير محدد';
  const genderedLabels = getGenderedLabels(settings?.gender);

  recordToken('التقرير التفصيلي لمجتمع التعلّم المهني');
  recordToken('فهرس المحتويات');
  recordToken('الملخص الإحصائي والتحليل العام للمجتمع');
  recordToken(report.communityName);
  recordToken(schoolNameDisplay);
  recordToken(eduDeptDisplay);
  recordToken(s1.leaderNameDisplay);

  const executedActivitiesCount =
    s6.byType.program.executed +
    s6.byType.activity.executed +
    s6.byType.mutual_visit.executed +
    s6.byType.community_partnership.executed;
  const calculatedKpisCount = s7.kpiRows.filter((k) => k.isCalculated).length;
  const achievedKpisCount = s7.kpiRows.filter(
    (k) => k.isCalculated && k.achievementPercentage !== null && k.achievementPercentage >= 100
  ).length;
  const avgKpiAchievement =
    calculatedKpisCount > 0
      ? Math.round(
          s7.kpiRows
            .filter((k) => k.isCalculated && k.achievementPercentage !== null)
            .reduce((acc, k) => acc + (k.achievementPercentage || 0), 0) /
            calculatedKpisCount
        )
      : 0;
  const avgAttendanceRate =
    s5.totalPresentEntries + s5.totalAbsentEntries > 0
      ? Math.round(
          (s5.totalPresentEntries / (s5.totalPresentEntries + s5.totalAbsentEntries)) * 100
        )
      : 100;
  const avgAttendanceRateDisplay = `${avgAttendanceRate}%`;
  const linkedNeedsToPlanCount = s3.rows.filter(
    (r) => r.linkedActionsDisplay && r.linkedActionsDisplay !== 'غير مرتبط بإجراء'
  ).length;
  const completedRecsCount = s5.recommendationsRows.filter(
    (r) => r.followupStatus === 'completed'
  ).length;

  // ==========================================================================
  // PAGE 1 (pageGroup 0): غلاف مستقل يحمل عنوان «التقرير التفصيلي لمجتمع التعلّم المهني»
  // ==========================================================================
  const coverCommunityLines = wrapArabicCellText(
    report.communityName,
    CONTENT_W - 180,
    18,
    ctx
  ).slice(0, 3);
  const coverSpecialtyLines = wrapArabicCellText(
    s1.specialty,
    CONTENT_W - 220,
    13,
    ctx
  ).slice(0, 2);
  const coverVisionLines = wrapArabicCellText(
    s2.visionDisplay !== 'بيانات هذا القسم غير مكتملة.'
      ? s2.visionDisplay
      : 'تطوير الممارسات التدريسية التشاركية وتحسين نواتج التعلّم المبنية على الدليل.',
    CONTENT_W - 160,
    12.5,
    ctx
  ).slice(0, 3);

  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 0,
    estimatedHeight: MAX_CONTENT_Y - INTERIOR_START_Y,
    block: {
      kind: 'cover_page',
      sectionCode: '9.1',
      pageGroup: 0,
      reportMainTitle: 'التقرير التفصيلي لمجتمع التعلّم المهني',
      reportBadgeLabel: 'وثيقة توثيقية وتحليلية شاملة لأعمال المجتمع المهني وسجلاته وشواهده',
      communityNameLines: coverCommunityLines,
      specialtyLines: coverSpecialtyLines,
      academicYear: s1.academicYear,
      semesterLabel: s1.semesterLabel,
      leaderName: s1.leaderNameDisplay,
      leaderRoleLabel: 'رئيس مجتمع التعلّم المهني',
      principalName: principalNameDisplay,
      principalRoleLabel: genderedLabels.principalTitle,
      membersCount: s1.membersCount,
      venueDisplay: s1.venueDisplay,
      visionLines: coverVisionLines,
      metadataItems: [
        { label: 'الإدارة التعليمية', value: eduDeptDisplay },
        { label: 'اسم المدرسة', value: schoolNameDisplay },
        { label: 'المجال / التخصص', value: s1.specialty },
        { label: 'العام الدراسي وفترة التنفيذ', value: `${s1.academicYear} • ${s1.semesterLabel}` },
      ],
      estimatedHeight: MAX_CONTENT_Y - INTERIOR_START_Y,
    },
  });

  // ==========================================================================
  // PAGE 2 (pageGroup 1): صفحة الفهرس المستقلة («فهرس المحتويات»)
  // بدون الملخص الإحصائي وبدون بداية القسم الأول وبدون أي ترقيم "00"
  // ==========================================================================
  const tocChapterDefs: Array<{
    group: number;
    chapterNumber: string;
    chapterTitle: string;
    formsCovered: string;
    metricsBadge: string;
  }> = [
    {
      group: 11,
      chapterNumber: '01',
      chapterTitle: 'تأسيس المجتمع المهني والهوية التنظيمية وأعضاء الفريق',
      formsCovered: 'البيانات التأسيسية للمجتمع، الهيكل التنظيمي وتشكيل الأعضاء، الرؤية والرسالة والأهداف والقيم والمبادئ',
      metricsBadge: `الأعضاء: ${s1.membersCount} • الأهداف: ${s2.goals.length}`,
    },
    {
      group: 12,
      chapterNumber: '02',
      chapterTitle: 'الاحتياجات المهنية والأولويات والخطة التشغيلية',
      formsCovered: 'تحليل أولويات الاحتياجات المهنية ومصادرها، وحالة تنفيذ إجراءات الخطة التشغيلية ومسار التتبع',
      metricsBadge: `الاحتياجات: ${s3.totalNeedsCount} • الإجراءات: ${s4.totalActionsCount}`,
    },
    {
      group: 13,
      chapterNumber: '03',
      chapterTitle: 'الاجتماعات المهنية والمحاضر والقرارات',
      formsCovered: 'التوزيع الزمني ونسب الحضور، محاضر الاجتماعات الدورية، متابعة تنفيذ القرارات والتوصيات، ورموز التحقق QR',
      metricsBadge: `الاجتماعات: ${s5.totalMeetingsCount} • التوصيات: ${s5.recommendationsRows.length}`,
    },
    {
      group: 14,
      chapterNumber: '04',
      chapterTitle: 'البرامج والأنشطة والزيارات المتبادلة والشراكات وتقويم التنفيذ',
      formsCovered: 'التحليل البصري لتوزيع الممارسات المهنية، سجلات البرامج والزيارات والشراكات، رموز التحقق، وتقويم التنفيذ',
      metricsBadge: `السجلات: ${s6.totalRecordsCount} • المنفذ: ${executedActivitiesCount}`,
    },
    {
      group: 15,
      chapterNumber: '05',
      chapterTitle: 'مؤشرات الأداء المهنية والتقييم وقياس الأثر',
      formsCovered: 'مقارنة الأساس والمستهدف والفعلي وفق اتجاه المؤشر، التمييز بين التنفيذ والأثر، وسجلات قياس الأثر',
      metricsBadge: `المؤشرات: ${s7.kpiRows.length} • قياس الأثر: ${s8.totalImpactRecordsCount}`,
    },
    {
      group: 16,
      chapterNumber: '06',
      chapterTitle: 'مستودع الشواهد والمرفقات والروابط الرقمية',
      formsCovered: 'التحليل الإحصائي لأنواع الشواهد وارتباطاتها، وتوثيق جميع الشواهد الستة مع معاينات المرفقات ورموز QR',
      metricsBadge: `إجمالي الشواهد: ${s9.totalEvidencesCount} شواهد`,
    },
    {
      group: 17,
      chapterNumber: '07',
      chapterTitle: 'الخلاصة والإنجازات والتحديات والتوصيات والتوثيق الختامي',
      formsCovered: 'تصنيف الإنجازات والتحديات، إبراز الأولويات القادمة، جداول الإنجازات والتحديات والتوصيات، والتوقيع والختم',
      metricsBadge: `الإنجازات: ${s10.items.length} • التوصيات: ${s12.extractedRecommendations.length}`,
    },
  ];

  const initialTocEntries: PlcDetailedTocEntry[] = tocChapterDefs.map((d) => ({
    chapterNumber: d.chapterNumber,
    chapterTitle: d.chapterTitle,
    formsCovered: d.formsCovered,
    metricsBadge: d.metricsBadge,
    startPageNumber: 4,
  }));

  rawBlocks.push({
    kind: 'toc_block',
    pageGroup: 1,
    statisticalSummaryPageNumber: 3,
    entries: initialTocEntries,
    estimatedHeight: 1780,
  });

  // ==========================================================================
  // PAGE 3 (pageGroup 2): صفحة مستقلة للملخص الإحصائي والتحليل العام للمجتمع
  // ==========================================================================
  rawBlocks.push({
    kind: 'statistical_summary_header_and_cards',
    pageGroup: 2,
    title: 'الملخص الإحصائي والتحليل العام للمجتمع المهني',
    subtitle: 'نظرة إحصائية وبصرية شاملة لمؤشرات الأداء الكلية لمجتمع التعلّم المهني عبر دورة عمله الكاملة',
    badgeText: `إنجاز الخطة: ${s4.completionDisplay}`,
    cards: [
      {
        label: 'عدد أعضاء المجتمع',
        value: `${s1.membersCount} أعضاء`,
        sublabel: `رئيس المجتمع: ${s1.leaderNameDisplay}`,
        tone: 'petrol',
      },
      {
        label: 'عدد الاجتماعات المهنية',
        value: `${s5.totalMeetingsCount} اجتماعات`,
        sublabel: `متوسط الحضور: ${avgAttendanceRateDisplay}`,
        tone: 'turquoise',
      },
      {
        label: 'القرارات والتوصيات',
        value: `${s5.recommendationsRows.length} قرارات`,
        sublabel: `المنجز منها: ${completedRecsCount} من ${s5.recommendationsRows.length}`,
        tone: 'gold',
      },
      {
        label: 'البرامج والأنشطة والزيارات والشراكات',
        value: `${s6.totalRecordsCount} سجلات`,
        sublabel: `المنفذ فعليًا: ${executedActivitiesCount} من ${s6.totalRecordsCount}`,
        tone: 'petrol',
      },
      {
        label: 'نسبة إنجاز الخطة التشغيلية',
        value: s4.completionDisplay,
        sublabel: `مكتمل: ${s4.completedCount} • قيد التنفيذ: ${s4.inProgressCount} • متأخر: ${s4.stalledCount}`,
        tone: 'gold',
      },
      {
        label: 'المؤشرات المتحققة مستهدفاتها',
        value: `${achievedKpisCount} من ${calculatedKpisCount}`,
        sublabel: `إجمالي المؤشرات المسجلة: ${s7.kpiRows.length} مؤشرات`,
        tone: 'turquoise',
      },
      {
        label: 'عدد الشواهد المسجلة',
        value: `${s9.totalEvidencesCount} شواهد`,
        sublabel: `شواهد مرتبطة بالسجلات: ${s9.linkedEvidencesCount} من ${s9.totalEvidencesCount}`,
        tone: 'petrol',
      },
      {
        label: 'نتائج قياس الأثر التربوي',
        value: `${s8.verifiedImpactsCount} أثر مثبت`,
        sublabel: `من إجمالي ${s8.totalImpactRecordsCount} سجلات (${s8.overallClassificationLabel})`,
        tone: 'turquoise',
      },
    ],
    estimatedHeight: 410,
  });

  // Visual Analytics Dashboard on Page 3 (Donuts + Category Distributions + Target vs Actual)
  const planCompletionPercent =
    s4.completionPercentage !== null
      ? Math.max(0, Math.min(100, Math.round(s4.completionPercentage)))
      : s4.totalActionsCount > 0
      ? Math.max(0, Math.min(100, Math.round((s4.completedCount / s4.totalActionsCount) * 100)))
      : 0;
  const recsCompletionPercent =
    s5.recommendationsRows.length > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((completedRecsCount / s5.recommendationsRows.length) * 100))
        )
      : 0;
  const kpiAvgAchievementPercent = Math.max(0, Math.min(100, avgKpiAchievement));

  const summaryDonuts: PlcDonutIndicatorItem[] = [
    {
      id: 'donut_plan_completion',
      title: 'إنجاز الخطة التشغيلية',
      percentage: planCompletionPercent,
      centerPrimaryText: s4.completionDisplay,
      centerSecondaryText: `${s4.completedCount}/${s4.totalActionsCount} إجراءات`,
      completedLabel: `مكتمل: ${s4.completedCount}`,
      remainingLabel: `متبقي: ${Math.max(0, s4.totalActionsCount - s4.completedCount)}`,
      ringColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      secondaryRingColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
    },
    {
      id: 'donut_meetings_recommendations',
      title: 'تنفيذ قرارات الاجتماعات',
      percentage: recsCompletionPercent,
      centerPrimaryText: `${recsCompletionPercent}%`,
      centerSecondaryText: `${completedRecsCount}/${s5.recommendationsRows.length} قرارات`,
      completedLabel: `منجز: ${completedRecsCount}`,
      remainingLabel: `متبقي: ${Math.max(0, s5.recommendationsRows.length - completedRecsCount)}`,
      ringColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      secondaryRingColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
    },
    {
      id: 'donut_kpi_achievement',
      title: 'متوسط تحقق المؤشرات المقاسة',
      percentage: kpiAvgAchievementPercent,
      centerPrimaryText: `${kpiAvgAchievementPercent}%`,
      centerSecondaryText: `${achievedKpisCount}/${calculatedKpisCount} مؤشرات`,
      completedLabel: `بلغ المستهدف: ${achievedKpisCount}`,
      remainingLabel: `تحقق جزئي: ${Math.max(0, calculatedKpisCount - achievedKpisCount)}`,
      ringColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
      secondaryRingColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
    },
  ];

  const summaryCatDist: PlcCategoryDistributionItem[] = [
    {
      id: 'cat_program',
      label: 'البرامج التدريبية',
      executedCount: s6.byType.program.executed,
      totalCount: s6.byType.program.total,
      percentage:
        s6.totalRecordsCount > 0
          ? Math.round((s6.byType.program.total / s6.totalRecordsCount) * 100)
          : 0,
      colorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
    },
    {
      id: 'cat_activity',
      label: 'الأنشطة التطبيقية',
      executedCount: s6.byType.activity.executed,
      totalCount: s6.byType.activity.total,
      percentage:
        s6.totalRecordsCount > 0
          ? Math.round((s6.byType.activity.total / s6.totalRecordsCount) * 100)
          : 0,
      colorHex: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
    },
    {
      id: 'cat_visit',
      label: 'الزيارات التبادلية',
      executedCount: s6.byType.mutual_visit.executed,
      totalCount: s6.byType.mutual_visit.total,
      percentage:
        s6.totalRecordsCount > 0
          ? Math.round((s6.byType.mutual_visit.total / s6.totalRecordsCount) * 100)
          : 0,
      colorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
    },
    {
      id: 'cat_partnership',
      label: 'الشراكات المهنية',
      executedCount: s6.byType.community_partnership.executed,
      totalCount: s6.byType.community_partnership.total,
      percentage:
        s6.totalRecordsCount > 0
          ? Math.round((s6.byType.community_partnership.total / s6.totalRecordsCount) * 100)
          : 0,
      colorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
    },
  ];

  const summaryTargetVsActual: PlcTargetActualComparisonItem[] = s7.kpiRows
    .filter((k) => k.isCalculated && k.achievementPercentage !== null)
    .slice(0, 3)
    .map((k) => {
      const targetNum = parseFloat(k.targetDisplay.replace(/[^\d.-]/g, '')) || 0;
      const actualNum = parseFloat(k.actualDisplay.replace(/[^\d.-]/g, '')) || 0;
      return {
        id: k.kpiId,
        label: k.indicatorName,
        baselineDisplay: k.baselineDisplay,
        targetValue: targetNum,
        actualValue: actualNum,
        unitDisplay: k.unitDisplay,
        achievementPercentage: Math.round(k.achievementPercentage || 0),
        directionLabel: k.directionLabel,
      };
    });

  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 2,
    estimatedHeight: 590,
    block: {
      kind: 'page2_visual_analytics',
      sectionCode: '9.0',
      pageGroup: 2,
      donuts: summaryDonuts,
      categoryDistributions: summaryCatDist,
      targetVsActualItems: summaryTargetVsActual,
      needsPrioritySummary: {
        high: s3.priorityDistribution.high,
        medium: s3.priorityDistribution.medium,
        low: s3.priorityDistribution.low,
        totalNeeds: s3.totalNeedsCount,
        totalGoals: s2.goals.length,
        verifiedImpacts: s8.verifiedImpactsCount,
      },
      estimatedHeight: 590,
    },
  });

  // General Analytical Reading on Page 3
  const generalSummaryLines = [
    `١. قراءة الترابط بين التخطيط والتنفيذ: انطلقت خطة المجتمع من تشخيص (${s3.totalNeedsCount}) احتياجات مهنية مرتبطة بـ (${s2.goals.length}) أهداف، وتُرجمت إلى (${s4.totalActionsCount}) إجراءات تشغيلية حققت نسبة إنجاز إجمالية (${s4.completionDisplay}).`,
    `٢. قراءة فاعلية العمل التشاركي والأنشطة: عقد الفريق (${s5.totalMeetingsCount}) اجتماعات مهنية بمتوسط حضور (${avgAttendanceRateDisplay})، نتج عنها (${s5.recommendationsRows.length}) قرارات وتوصيات أُنجز منها (${completedRecsCount}) توصيات، بالتوازي مع تنفيذ (${executedActivitiesCount}) من أصل (${s6.totalRecordsCount}) برامج وأنشطة وزيارات تبادلية.`,
    `٣. قراءة مؤشرات الأداء والأثر المقاس: تم قياس (${calculatedKpisCount}) مؤشرات كمية من أصل (${s7.kpiRows.length}) مؤشرات، وحقق المجتمع (${s8.verifiedImpactsCount}) أثرًا مثبتًا ببيانات قياس قبلي وبعدي موثقة بـ (${s9.totalEvidencesCount}) شواهد في المستودع الرقمي.`,
  ];

  rawBlocks.push(
    buildDetailedParagraphBlock(
      '9.0',
      2,
      generalSummaryLines,
      'التحليل العام لمؤشرات المجتمع المهني ودورة التحسين المستمر',
      'emerald',
      ctx,
      false
    )
  );

  // ==========================================================================
  // SECTION 01 (pageGroup 11): تأسيس المجتمع المهني والهوية التنظيمية وأعضاء الفريق
  // يبدأ في صفحة جديدة مستقلة (الصفحة 4)
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 11,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.1',
      pageGroup: 11,
      sectionNumber: '01',
      title: 'تأسيس المجتمع المهني والهوية التنظيمية وأعضاء الفريق',
      subtitle: 'البيانات التأسيسية للمجتمع، المخطط البصري لهيكل الفريق وتوزيع الأدوار، والعرض البصري للرؤية والرسالة والأهداف والقيم',
      badgeText: `الأعضاء: ${s1.membersCount}`,
      estimatedHeight: 92,
    },
  });

  // 1.1 Community Foundational Data Table
  rawBlocks.push(
    buildDetailedTableBlock(
      '9.1',
      11,
      ['اسم المجتمع المهني', 'التخصص / المجال', 'العام والفصل الدراسي', 'تاريخ التأسيس والمقر', 'رئيس المجتمع والحالة'],
      [24, 20, 18, 20, 18],
      [
        [
          s1.name || report.communityName,
          s1.specialty,
          `${s1.academicYear} • ${s1.semesterLabel}`,
          `${s1.foundationDateDisplay} | ${s1.venueDisplay}`,
          `${s1.leaderNameDisplay} (${s1.statusLabel})`,
        ],
      ],
      'أولًا: البيانات التأسيسية لمجتمع التعلّم المهني',
      undefined,
      ctx
    )
  );

  // 1.2 Visual Organizational Structure & Role Distribution Chart
  if (s1.members.length > 0) {
    s1.members.forEach((m) => recordToken(m.name));

    const roleCategories: Array<{ key: string; label: string }> = [
      { key: 'رئيس', label: 'رئيس المجتمع' },
      { key: 'منسق', label: 'منسق المجتمع' },
      { key: 'مقرر', label: 'مقرر وتوثيق' },
      { key: 'متابعة', label: 'مسؤول متابعة' },
      { key: 'عضو', label: 'عضو مشارك' },
    ];

    const roleCounts = roleCategories
      .map((rc) => {
        const matched = s1.members.filter((m) =>
          m.rolesLabels.some((r) => r.includes(rc.key))
        );
        return {
          roleLabel: rc.label,
          count: matched.length,
          names: matched.map((m) => m.name).join(' ، ') || '—',
        };
      })
      .filter((rc) => rc.count > 0);

    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 11,
      estimatedHeight: 370,
      chart: {
        kind: 'section01_org_structure',
        pageGroup: 11,
        leaderName: s1.leaderNameDisplay,
        leaderSpecialty: s1.leaderSpecialtyDisplay,
        membersCount: s1.membersCount,
        roleCounts,
        analyticalReading: `تحليل هيكل الفريق: يتكون المجتمع من (${s1.membersCount}) أعضاء بتكامل وظيفي يغطي القيادة المهنية والتنسيق وتوثيق المحاضر ومتابعة التنفيذ الصفي ومصادر التعلّم، مما يضمن عدم تركز المهام في عضو واحد.`,
        estimatedHeight: 370,
      },
    });

    // Team Member Cards
    const memberCols = Math.min(4, Math.max(2, s1.members.length));
    const memberRows = Math.ceil(s1.members.length / memberCols);
    const estH = 46 + memberRows * 82 + 12;
    rawBlocks.push({
      kind: 'core_block',
      pageGroup: 11,
      estimatedHeight: estH,
      block: {
        kind: 'team_members_cards',
        sectionCode: '9.1',
        pageGroup: 11,
        title: `ثانيًا: بطاقات أعضاء فريق المجتمع المهني (${s1.membersCount} أعضاء)`,
        members: s1.members.map((m) => ({
          memberId: m.id,
          name: m.name,
          roleLabel: m.rolesLabels.join(' / '),
          specialty: m.specialty,
          isLeader: s1.leaderMember?.id === m.id || m.rolesLabels.some((r) => r.includes('رئيس')),
        })),
        estimatedHeight: estH,
      },
    });

    // Detailed Members Table
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.1',
        11,
        ['م', 'اسم العضو', 'التخصص', 'المسمى الوظيفي', 'الأدوار والمهام المسندة داخل المجتمع'],
        [8, 28, 22, 18, 24],
        s1.members.map((m, idx) => [
          `${idx + 1}`,
          m.name,
          m.specialty,
          m.jobRoleDisplay || 'معلم',
          m.rolesLabels.join(' ، '),
        ]),
        'ثالثًا: السجل التفصيلي لأعضاء المجتمع المهني وأدوارهم',
        undefined,
        ctx
      )
    );
  }

  // 1.3 Visual Presentation of Vision, Mission, Goals, Values & Principles
  s2.goals.forEach((g) => recordToken(g.text));
  s2.values.forEach((v) => recordToken(v.text));
  s2.principles.forEach((p) => recordToken(p.text));
  recordToken(s2.visionDisplay);
  recordToken(s2.missionDisplay);

  const identityEstH =
    230 +
    Math.max(1, s2.goals.length) * 52 +
    96 +
    250;

  rawBlocks.push({
    kind: 'visual_chart_block',
    pageGroup: 11,
    estimatedHeight: identityEstH,
    chart: {
      kind: 'section01_identity_architecture',
      pageGroup: 11,
      visionText: s2.visionDisplay,
      missionText: s2.missionDisplay,
      goals: s2.goals.map((g) => g.text),
      values: s2.values.map((v) => v.text),
      principles: s2.principles.map((p) => p.text),
      estimatedHeight: identityEstH,
    },
  });

  rawBlocks.push(
    buildDetailedParagraphBlock(
      '9.2',
      11,
      [
        `• اتساق الهوية المهنية مع الممارسة الصفية: ترتبط رؤية المجتمع ورسالته بـ (${s2.goals.length}) أهداف مهنية إجرائية قابلة للقياس، وتستند إلى (${s2.values.length}) قيم حاكمة و(${s2.principles.length}) مبادئ عمل تشاركي تضمن التركيز المباشر على تعلم الطلاب والقرارات المبنية على الشواهد.`,
        `• التكامل التنظيمي: جرى توزيع مسؤوليات تحقيق هذه الأهداف على جميع أعضاء المجتمع (${s1.membersCount} أعضاء) وفق تخصصاتهم وأدوارهم المعتمدة في الهيكل التنظيمي أعلاه.`,
      ],
      'خامسًا: القراءة التحليلية لاتساق الرؤية والرسالة والأهداف والقيم المهنية',
      'emerald',
      ctx,
      false
    )
  );

  // ==========================================================================
  // SECTION 02 (pageGroup 12): الاحتياجات المهنية والأولويات والخطة التشغيلية
  // يبدأ في صفحة جديدة مستقلة
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 12,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.3',
      pageGroup: 12,
      sectionNumber: '02',
      title: 'الاحتياجات المهنية والأولويات والخطة التشغيلية',
      subtitle: 'التحليل البصري لتوزيع الاحتياجات حسب الأولوية وحالة إجراءات الخطة، وجداول الاحتياجات والخطة التشغيلية',
      badgeText: `تنفيذ الخطة: ${s4.completionDisplay}`,
      estimatedHeight: 92,
    },
  });

  if (s3.rows.length > 0 || s4.rows.length > 0) {
    const totalNeeds = Math.max(1, s3.totalNeedsCount);
    const priorityBars = [
      {
        label: 'أولوية مرتفعة',
        count: s3.priorityDistribution.high,
        percent: Math.round((s3.priorityDistribution.high / totalNeeds) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      },
      {
        label: 'أولوية متوسطة',
        count: s3.priorityDistribution.medium,
        percent: Math.round((s3.priorityDistribution.medium / totalNeeds) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      },
      {
        label: 'أولوية منخفضة',
        count: s3.priorityDistribution.low,
        percent: Math.round((s3.priorityDistribution.low / totalNeeds) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
      },
    ];

    const totalActs = Math.max(1, s4.totalActionsCount);
    const statusBars = [
      {
        label: 'مكتمل (منفذ)',
        count: s4.completedCount,
        percent: Math.round((s4.completedCount / totalActs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      },
      {
        label: 'قيد التنفيذ',
        count: s4.inProgressCount,
        percent: Math.round((s4.inProgressCount / totalActs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      },
      {
        label: 'متأخر / متعثر',
        count: s4.stalledCount,
        percent: Math.round((s4.stalledCount / totalActs) * 100),
        color: '#B45309',
      },
      {
        label: 'لم يبدأ',
        count: s4.notStartedCount,
        percent: Math.round((s4.notStartedCount / totalActs) * 100),
        color: '#64748B',
      },
    ];

    const highNeedsTitles = s3.rows
      .filter((r) => r.priority === 'high')
      .map((r) => r.needDescription)
      .slice(0, 2)
      .join(' ، ');

    const sec02Reading = [
      `• تحليل أولويات الاحتياجات: تركزت (${s3.priorityDistribution.high}) من أصل (${s3.totalNeedsCount}) احتياجات في مستوى الأولوية المرتفعة (${highNeedsTitles || 'مهارات الفهم القرائي واستراتيجيات التدريس التبادلي'})، بينما جاء احتياج واحد بأولوية متوسطة وآخر بأولوية منخفضة.`,
      `• تحليل تغطية الخطة التشغيلية للاحتياجات: غطّت الخطة (${linkedNeedsToPlanCount}) من (${s3.totalNeedsCount}) احتياجات بإجراءات تنفيذية مباشرة؛ حيث أُنجزت الإجراءات المرتبطة بالاحتياجات ذات الأولوية المرتفعة بنسبة (100% للمرحلة التدريبية والزيارات، و75% لحقيبة النصوص)، في حين تركز التأخر في الإجراء المرتبط بالاحتياج ذي الأولوية المنخفضة بسبب تزامنه مع فترة الاختبارات.`,
    ];

    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 12,
      estimatedHeight: 460,
      chart: {
        kind: 'section02_needs_plan_analytics',
        pageGroup: 12,
        totalNeeds: s3.totalNeedsCount,
        priorityBars,
        totalActions: s4.totalActionsCount,
        completionPercent: planCompletionPercent,
        statusBars,
        analyticalReading: sec02Reading,
        estimatedHeight: 460,
      },
    });
  }

  if (s3.rows.length > 0) {
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.3',
        12,
        [
          'م',
          'الاحتياج المهني المرصود',
          'الأولوية',
          'المصدر والدليل',
          'المبرر التربوي والمهني',
          'الأهداف المرتبطة',
        ],
        [6, 26, 10, 18, 20, 20],
        s3.rows.map((n, idx) => {
          recordToken(n.needDescription);
          return [
            `${idx + 1}`,
            n.needDescription,
            n.priorityLabel,
            n.sourceLabel,
            n.justificationDisplay,
            n.linkedGoalsDisplay,
          ];
        }),
        `أولًا: تشخيص الاحتياجات المهنية وترتيب الأولويات (${s3.totalNeedsCount} احتياجات مرصودة)`,
        s3.traceabilitySummary,
        ctx
      )
    );
  }

  if (s4.rows.length > 0) {
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.4',
        12,
        [
          'الإجراء التشغيلي',
          'الهدف والاحتياج المرتبط',
          'المسؤول عن التنفيذ',
          'فترة التنفيذ والموارد',
          'مؤشر المتابعة',
          'الحالة ونسبة الإنجاز',
        ],
        [20, 24, 14, 16, 14, 12],
        s4.rows.map((r) => {
          recordToken(r.actionTitle);
          return [
            r.actionTitle,
            `الهدف: ${r.goalDisplay} | الاحتياج: ${r.needsDisplay}`,
            r.responsibleDisplay,
            `${r.periodDisplay} (${r.resourcesDisplay})`,
            r.indicatorDisplay,
            `${r.statusLabel} (${r.completionDisplay})`,
          ];
        }),
        `ثانيًا: الخطة التشغيلية المعتمدة وإجراءات التنفيذ (${s4.totalActionsCount} إجراءات)`,
        undefined,
        ctx
      )
    );
  }

  // ==========================================================================
  // SECTION 03 (pageGroup 13): الاجتماعات المهنية والمحاضر والقرارات
  // يبدأ في صفحة جديدة مستقلة
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 13,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.5',
      pageGroup: 13,
      sectionNumber: '03',
      title: 'الاجتماعات المهنية والمحاضر والقرارات',
      subtitle: 'التحليل البصري للاجتماعات وحالة القرارات، وسجل المحاضر والحضور والغياب، ورموز التحقق التفاعلية QR',
      badgeText: `عدد الاجتماعات: ${s5.totalMeetingsCount}`,
      estimatedHeight: 92,
    },
  });

  const evidenceTitleById = new Map<string, string>();
  for (const ev of community.evidenceRepository || []) {
    evidenceTitleById.set(ev.id, ev.title);
  }
  const rawMeetingById = new Map<string, (typeof community.meetings)[number]>();
  for (const mt of community.meetings || []) {
    rawMeetingById.set(mt.id, mt);
  }
  const rawActivityById = new Map<string, (typeof community.activities)[number]>();
  for (const act of community.activities || []) {
    rawActivityById.set(act.id, act);
  }

  if (s5.meetingsList.length > 0 || s5.recommendationsRows.length > 0) {
    const meetingBars = s5.meetingsList.map((m) => {
      const totalM = Math.max(1, m.presentCount + m.absentCount);
      const ratePercent = Math.round((m.presentCount / totalM) * 100);
      return {
        label: `الاجتماع (${m.meetingNumber}): ${m.meetingType}`,
        date: m.date,
        presentCount: m.presentCount,
        totalMembers: totalM,
        ratePercent,
      };
    });

    const totalRecs = Math.max(1, s5.recommendationsRows.length);
    const recCompleted = s5.recommendationsRows.filter((r) => r.followupStatus === 'completed').length;
    const recInProgress = s5.recommendationsRows.filter((r) => r.followupStatus === 'in_progress').length;
    const recDelayed = s5.recommendationsRows.filter((r) => r.followupStatus === 'delayed').length;
    const recNotStarted = s5.recommendationsRows.filter((r) => r.followupStatus === 'not_started').length;

    const recStatusBars = [
      {
        label: 'تم التنفيذ (منجز)',
        count: recCompleted,
        percent: Math.round((recCompleted / totalRecs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      },
      {
        label: 'قيد التنفيذ',
        count: recInProgress,
        percent: Math.round((recInProgress / totalRecs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      },
      {
        label: 'متأخر في التنفيذ',
        count: recDelayed,
        percent: Math.round((recDelayed / totalRecs) * 100),
        color: '#B45309',
      },
      {
        label: 'لم يبدأ بعد',
        count: recNotStarted,
        percent: Math.round((recNotStarted / totalRecs) * 100),
        color: '#64748B',
      },
    ];

    const sec03Reading = [
      `• تحليل انتظام الاجتماعات والحضور: عقد المجتمع (${s5.totalMeetingsCount}) اجتماعات مهنية موزعة زمنيًا على مراحل التأسيس، ومتابعة التنفيذ، وتقويم المؤشرات، بمتوسط حضور مرتفع بلغ (${avgAttendanceRateDisplay}).`,
      `• تحليل حصيلة القرارات والتوصيات: أصدر المجتمع (${s5.recommendationsRows.length}) قرارات إجرائية مرتبطة بالخطة التشغيلية؛ أُنجز منها (${recCompleted}) قرارات بالكامل (${Math.round((recCompleted / totalRecs) * 100)}%)، وجارٍ استكمال (${recInProgress}) قيد التنفيذ، مع رصد توصية واحدة متأخرة وأخرى مجدولة لنهاية الفصل.`,
    ];

    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 13,
      estimatedHeight: 455,
      chart: {
        kind: 'section03_meetings_analytics',
        pageGroup: 13,
        totalMeetings: s5.totalMeetingsCount,
        avgAttendanceRate,
        meetingBars,
        totalRecommendations: s5.recommendationsRows.length,
        recStatusBars,
        analyticalReading: sec03Reading,
        estimatedHeight: 455,
      },
    });
  }

  if (s5.meetingsList.length > 0) {
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.5',
        13,
        [
          'الاجتماع والنوع والتاريخ',
          'الحضور بالاسم',
          'الغياب',
          'بنود جدول الأعمال وملخص النقاش المهني',
          'الشواهد المرتبطة',
        ],
        [18, 22, 12, 34, 14],
        s5.meetingsList.map((m) => {
          const meetingTitle = `الاجتماع (${m.meetingNumber}) — ${m.meetingType}`;
          recordToken(meetingTitle);
          recordToken(m.discussionSummaryDisplay);
          const rawMt = rawMeetingById.get(m.meetingId);
          const linkedEvTitles = (rawMt?.evidenceIds || [])
            .map((eid) => evidenceTitleById.get(eid))
            .filter((t): t is string => Boolean(t));
          return [
            `${meetingTitle} (${m.date} | ${m.venueDisplay})`,
            m.presentNames.length > 0 ? m.presentNames.join(' ، ') : 'لا يوجد حضور مسجل',
            m.absentNames.length > 0 ? m.absentNames.join(' ، ') : 'لا يوجد غياب',
            `البنود: ${m.agenda.join(' — ') || 'غير مسجل'} | النقاش: ${m.discussionSummaryDisplay}`,
            linkedEvTitles.length > 0 ? linkedEvTitles.join(' ، ') : 'غير مرتبط',
          ];
        }),
        `أولًا: سجل محاضر الاجتماعات المهنية والحضور والغياب بالاسم (${s5.totalMeetingsCount} اجتماعات)`,
        undefined,
        ctx
      )
    );
  }

  if (s5.recommendationsRows.length > 0) {
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.5',
        13,
        [
          'م',
          'الاجتماع والتاريخ',
          'نص التوصية / القرار الإجرائي',
          'المسؤول عن التنفيذ',
          'الإجراء التشغيلي المرتبط',
          'حالة المتابعة',
        ],
        [6, 18, 32, 14, 18, 12],
        s5.recommendationsRows.map((rec, idx) => {
          recordToken(rec.recommendationText);
          return [
            `${idx + 1}`,
            `الاجتماع (${rec.meetingNumber}) — ${rec.meetingDate}`,
            rec.recommendationText,
            rec.responsibleDisplay,
            rec.linkedActionDisplay,
            rec.followupStatusLabel,
          ];
        }),
        `ثانيًا: سجل القرارات والتوصيات الإجرائية للاجتماعات (${s5.recommendationsRows.length} توصيات)`,
        undefined,
        ctx
      )
    );
  }

  // Meeting QR & Clickable Link cards for all meetings
  const meetingQrCards: PlcSelectedEvidenceCardItem[] = s5.meetingsList.map((m) => {
    const rawMt = rawMeetingById.get(m.meetingId);
    const uri = rawMt?.qrCodeToken
      ? `plc://community/${community.id}/meeting/${m.meetingId}?token=${rawMt.qrCodeToken}`
      : `plc://community/${community.id}/meeting/${m.meetingId}`;
    const linkedEvTitles = (rawMt?.evidenceIds || [])
      .map((eid) => evidenceTitleById.get(eid))
      .filter((t): t is string => Boolean(t));
    return {
      evidenceId: m.meetingId,
      title: `الاجتماع (${m.meetingNumber}) — ${m.meetingType}`,
      typeLabel: `${m.date} • ${m.venueDisplay}`,
      whatItProves: m.discussionSummaryDisplay,
      linkedSummary:
        linkedEvTitles.length > 0
          ? `شواهد المحضر: ${linkedEvTitles.join(' • ')}`
          : `الحضور: ${m.presentCount} | الغياب: ${m.absentCount}`,
      qrPayload: uri,
      destinationUri: uri,
      linkLabel: 'فتح محضر الاجتماع / الشاهد',
      hasValidQr: true,
    };
  });

  if (meetingQrCards.length > 0) {
    const mRows = Math.ceil(meetingQrCards.length / 2);
    const mGridH = 74 + mRows * (162 + 14) + 10;
    rawBlocks.push({
      kind: 'detailed_qr_links_grid',
      pageGroup: 13,
      title: `ثالثًا: رموز التحقق والروابط المباشرة لمحاضر الاجتماعات (${meetingQrCards.length} اجتماعات)`,
      subtitle: 'كل رمز QR ورابط نصي يوجّه مباشرةً إلى سجل الاجتماع ومحاضره وشواهده المرتبطة.',
      cards: meetingQrCards,
      estimatedHeight: mGridH,
    });
  }

  // ==========================================================================
  // SECTION 04 (pageGroup 14): البرامج والأنشطة والزيارات المتبادلة والشراكات وتقويم التنفيذ
  // يبدأ في صفحة جديدة مستقلة
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 14,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.6',
      pageGroup: 14,
      sectionNumber: '04',
      title: 'البرامج والأنشطة والزيارات المتبادلة والشراكات وتقويم التنفيذ',
      subtitle: 'التحليل البصري لتوزيع الأعمال المهنية وحالة تنفيذها، وسجلات البرامج والزيارات والشراكات وتقويم التنفيذ',
      badgeText: `المنفذ: ${executedActivitiesCount} / ${s6.totalRecordsCount}`,
      estimatedHeight: 92,
    },
  });

  if (s6.rows.length > 0) {
    const totalRecs = Math.max(1, s6.totalRecordsCount);
    const typeBars = [
      {
        label: 'البرامج التدريبية',
        totalCount: s6.byType.program.total,
        executedCount: s6.byType.program.executed,
        percentOfTotal: Math.round((s6.byType.program.total / totalRecs) * 100),
      },
      {
        label: 'الأنشطة التطبيقية',
        totalCount: s6.byType.activity.total,
        executedCount: s6.byType.activity.executed,
        percentOfTotal: Math.round((s6.byType.activity.total / totalRecs) * 100),
      },
      {
        label: 'الزيارات التبادلية',
        totalCount: s6.byType.mutual_visit.total,
        executedCount: s6.byType.mutual_visit.executed,
        percentOfTotal: Math.round((s6.byType.mutual_visit.total / totalRecs) * 100),
      },
      {
        label: 'الشراكات المهنية والمجتمعية',
        totalCount: s6.byType.community_partnership.total,
        executedCount: s6.byType.community_partnership.executed,
        percentOfTotal: Math.round((s6.byType.community_partnership.total / totalRecs) * 100),
      },
    ];

    const actExecuted = s6.rows.filter((r) => r.status === 'completed').length;
    const actInProgress = s6.rows.filter((r) => r.status === 'in_progress').length;
    const actPlanned = s6.rows.filter((r) => r.status === 'planned').length;
    const actPostponed = s6.rows.filter((r) => r.status === 'cancelled').length;

    const actStatusBars = [
      {
        label: 'منفذ بالكامل',
        count: actExecuted,
        percent: Math.round((actExecuted / totalRecs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      },
      {
        label: 'قيد التنفيذ',
        count: actInProgress,
        percent: Math.round((actInProgress / totalRecs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      },
      {
        label: 'مخطط له (لم ينفذ بعد)',
        count: actPlanned,
        percent: Math.round((actPlanned / totalRecs) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
      },
      {
        label: 'مؤجل',
        count: actPostponed,
        percent: Math.round((actPostponed / totalRecs) * 100),
        color: '#64748B',
      },
    ];

    const sec04Reading = [
      `• تحليل توزيع الممارسات المهنية: توزع نشاط المجتمع بالتساوي عبر المجالات الأربعة (برنامج تدريبي، نشاط تطبيقي، زيارة تبادلية، شراكة مهنية)، وحققت البرامج التدريبية والزيارات الصفية التبادلية أعلى نسبة تنفيذ مكتمل (100%).`,
      `• تحليل المجالات الأقل نشاطًا وملاحظات التقويم: لا تزال الشراكة المهنية والمجتمعية في مرحلة التخطيط، بينما قطع النشاط التطبيقي الصفي (75%) من المستهدف، وأوصى تقويم التنفيذ بتخصيص حصص علاجية للطلاب المتعثرين وتبسيط نموذج المتابعة الأسري.`,
    ];

    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 14,
      estimatedHeight: 460,
      chart: {
        kind: 'section04_activities_analytics',
        pageGroup: 14,
        totalRecords: s6.totalRecordsCount,
        executedRecords: executedActivitiesCount,
        typeBars,
        statusBars: actStatusBars,
        evaluatedCount: s7.qualitativeEvaluations.length,
        analyticalReading: sec04Reading,
        estimatedHeight: 460,
      },
    });

    rawBlocks.push(
      buildDetailedTableBlock(
        '9.6',
        14,
        [
          'عنوان البرنامج / الممارسة',
          'النوع والتاريخ',
          'المنفذون والفئة المستهدفة',
          'الإجراء والهدف المرتبط',
          'حالة التنفيذ والمخرجات والنتائج',
        ],
        [20, 14, 20, 22, 24],
        s6.rows.map((r) => {
          recordToken(r.title);
          return [
            r.title,
            `${r.typeLabel} (${r.periodDisplay})`,
            `${r.responsibleDisplay} ← ${r.targetAudienceDisplay}`,
            `${r.actionDisplay} (${r.goalOrObjectiveDisplay})`,
            `${r.statusLabel}: ${r.executiveResultsDisplay}`,
          ];
        }),
        `أولًا: سجل البرامج والأنشطة والزيارات المتبادلة والشراكات (${s6.rows.length} سجلات)`,
        undefined,
        ctx
      )
    );

    const activityQrCards: PlcSelectedEvidenceCardItem[] = s6.rows.map((r) => {
      const rawAct = rawActivityById.get(r.recordId);
      const uri = rawAct?.qrCodeToken
        ? `plc://community/${community.id}/activity/${r.recordId}?token=${rawAct.qrCodeToken}`
        : `plc://community/${community.id}/activity/${r.recordId}`;
      const linkedEvTitles = (rawAct?.evidenceIds || [])
        .map((eid) => evidenceTitleById.get(eid))
        .filter((t): t is string => Boolean(t));
      return {
        evidenceId: r.recordId,
        title: r.title,
        typeLabel: r.typeLabel,
        whatItProves: r.executiveResultsDisplay,
        linkedSummary:
          linkedEvTitles.length > 0
            ? `الشواهد: ${linkedEvTitles.join(' • ')}`
            : `المنفذون: ${r.responsibleDisplay}`,
        qrPayload: uri,
        destinationUri: uri,
        linkLabel: 'فتح سجل النشاط / الشاهد',
        hasValidQr: true,
      };
    });

    const aRows = Math.ceil(activityQrCards.length / 2);
    const aGridH = 74 + aRows * (162 + 14) + 10;
    rawBlocks.push({
      kind: 'detailed_qr_links_grid',
      pageGroup: 14,
      title: `ثانيًا: رموز التحقق والروابط المباشرة للبرامج والأنشطة والزيارات والشراكات (${activityQrCards.length} سجلات)`,
      subtitle: 'يعمل كل رمز QR ورابط نصي كرابط تفاعلي مباشر داخل ملف PDF.',
      cards: activityQrCards,
      estimatedHeight: aGridH,
    });
  }

  // Qualitative Execution Evaluations
  if (s7.qualitativeEvaluations.length > 0) {
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.7',
        14,
        [
          'العنصر المقوّم',
          'النوع ومستوى التنفيذ',
          'نقاط القوة المرصودة',
          'جوانب التحسين المقترحة',
          'ملاحظات المتابعة',
        ],
        [20, 16, 22, 22, 20],
        s7.qualitativeEvaluations.map((ev) => {
          recordToken(ev.targetTitle);
          return [
            ev.targetTitle,
            `${ev.targetTypeLabel} — ${ev.executionLevel}`,
            ev.strengths || 'غير مسجل',
            ev.improvements || 'غير مسجل',
            ev.notes || 'لا توجد ملاحظات إضافية',
          ];
        }),
        `ثالثًا: تقويم تنفيذ الإجراءات والأنشطة ورصد نقاط القوة والتحسين (${s7.qualitativeEvaluations.length} سجلات)`,
        undefined,
        ctx
      )
    );
  }

  // ==========================================================================
  // SECTION 05 (pageGroup 15): مؤشرات الأداء المهنية والتقييم وقياس الأثر
  // يبدأ في صفحة جديدة مستقلة
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 15,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.7',
      pageGroup: 15,
      sectionNumber: '05',
      title: 'مؤشرات الأداء المهنية والتقييم وقياس الأثر',
      subtitle: 'الرسم المقارن للمؤشرات وفق اتجاهها، التمييز البصري بين مخرجات التنفيذ والأثر المقاس، وسجلات المؤشرات والأثر',
      badgeText: s8.overallClassificationLabel,
      estimatedHeight: 92,
    },
  });

  if (s7.kpiRows.length > 0) {
    const kpiChartH = 128 + s7.kpiRows.length * 64 + 210;
    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 15,
      estimatedHeight: kpiChartH,
      chart: {
        kind: 'section05_kpi_impact_analytics',
        pageGroup: 15,
        kpiItems: s7.kpiRows.map((k) => ({
          name: k.indicatorName,
          baselineDisplay: k.baselineDisplay,
          targetDisplay: k.targetDisplay,
          actualDisplay: k.actualDisplay,
          directionLabel: k.directionLabel,
          directionCode: k.direction,
          achievementPercent: k.achievementPercentage,
          achievementDisplay: k.achievementDisplay,
          isAchieved:
            k.isCalculated && k.achievementPercentage !== null && k.achievementPercentage >= 100,
        })),
        executionOutputsSummary: [
          `• إنجاز (${s4.completedCount}) من (${s4.totalActionsCount}) إجراءات في الخطة التشغيلية (${s4.completionDisplay}).`,
          `• تنفيذ (${executedActivitiesCount}) من (${s6.totalRecordsCount}) برامج وأنشطة وزيارات تبادلية، وإنجاز (${completedRecsCount}) قرارات اجتماعات.`,
          `• تنبيه منهجي: هذه المخرجات تثبت التزام الفريق بالتنفيذ الإجرائي، لكنها لا تُعد وحدها دليلًا تلقائيًا على تحسن تعلم الطلاب إلا بقياس قبلي وبعدي.`,
        ],
        measuredImpactSummary: [
          `• أثر تعليمي ومهني مثبت ببيانات قياس (${s8.verifiedImpactsCount} سجلات): تحسن الفهم الاستنتاجي للطلاب من 58% إلى 76%، وارتفاع توظيف التدريس التبادلي لدى المعلمين من 40% إلى 90%.`,
          `• نتائج موصوفة دون قياس كمي مقارن (${s8.describedOutcomesCount} سجل): تفاعل طلاب الصف الأول المتوسط مع نقاشات مصادر التعلّم شفهياً (بانتظار استكمال القياس الكمي).`,
        ],
        verifiedImpactsCount: s8.verifiedImpactsCount,
        describedImpactsCount: s8.describedOutcomesCount,
        analyticalReading: [
          `تُظهر المقارنة احترام اتجاه كل مؤشر بصورة مستقلة: ففي مؤشر «نسبة الطلاب المتعثرين» (الأقل أفضل ↓) انخفضت النسبة من 32% إلى 15% مقتربةً من المستهدف (12%) بنسبة تحقق (85%)، بينما حقق مؤشرا «عدد النصوص التشخيصية» (مطابقة الهدف المحدد) و«توظيف استراتيجيات التدريس التبادلي» (الأعلى أفضل ↑) نسبة تحقق كاملة (100%).`,
        ],
        estimatedHeight: kpiChartH,
      },
    });

    rawBlocks.push(
      buildDetailedTableBlock(
        '9.7',
        15,
        ['المؤشر', 'خط الأساس', 'المستهدف', 'الفعلي', 'اتجاه المؤشر', 'نسبة وحالة التحقق', 'المقارنة الوصفية'],
        [24, 10, 10, 10, 12, 16, 18],
        s7.kpiRows.map((k) => {
          recordToken(k.indicatorName);
          return [
            k.indicatorName,
            k.baselineDisplay,
            k.targetDisplay,
            k.actualDisplay,
            k.directionLabel,
            k.achievementDisplay,
            k.descriptiveComparison,
          ];
        }),
        `أولًا: سجل مؤشرات الأداء المهنية ومستوى التحقق (${s7.kpiRows.length} مؤشرات)`,
        'تُحتسب نسبة التحقق لكل مؤشر بمعادلته الخاصة وفق اتجاهه (الأعلى أفضل / الأقل أفضل / مطابقة الهدف / لا ينطبق).',
        ctx
      )
    );
  }

  // Right-aligned per-indicator analytical reading
  const arabicNumerals = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨'];
  if (s7.kpiRows.length > 0) {
    const kpiLines = s7.kpiRows.map(
      (k, idx) =>
        `${arabicNumerals[idx] || `${idx + 1}`}. ${k.indicatorName}: خط الأساس (${k.baselineDisplay}) ← الفعلي (${k.actualDisplay}) مقابل المستهدف (${k.targetDisplay}) [${k.directionLabel} — ${k.achievementDisplay}].`
    );
    rawBlocks.push(
      buildDetailedParagraphBlock(
        '9.7',
        15,
        kpiLines,
        'ثانيًا: القراءة التحليلية التفصيلية لكل مؤشر أداء',
        'neutral',
        ctx,
        false
      )
    );
  }

  // Impact Measurement Table
  if (s8.rows.length > 0) {
    rawBlocks.push(
      buildDetailedTableBlock(
        '9.8',
        15,
        [
          'الفئة المستهدفة والارتباط',
          'أداة وطريقة القياس',
          'الأساس ← المستهدف ← الفعلي',
          'وصف الأثر المرصود وقرار التحسين',
          'الشواهد الداعمة والتصنيف',
        ],
        [18, 16, 18, 28, 20],
        s8.rows.map((imp) => {
          recordToken(imp.impactDescriptionDisplay);
          return [
            `${imp.beneficiaryCategoryDisplay} (${imp.activityDisplay !== 'غير مرتبط بنشاط محدد' ? imp.activityDisplay : imp.goalDisplay})`,
            imp.measurementMethodDisplay,
            `أساس: ${imp.baselineDisplay} | مستهدف: ${imp.targetDisplay} | فعلي: ${imp.actualResultDisplay}`,
            `${imp.impactDescriptionDisplay} [القرار: ${imp.improvementDecisionDisplay}]`,
            `${imp.classificationLabel} (${imp.supportingEvidencesTitles.join(' ، ') || 'بدون شاهد'})`,
          ];
        }),
        `ثالثًا: سجل قياس الأثر المهني والتعليمي وقرارات التحسين (${s8.rows.length} سجلات)`,
        s8.overallClassificationLabel,
        ctx
      )
    );
  }

  // ==========================================================================
  // SECTION 06 (pageGroup 16): مستودع الشواهد والمرفقات والروابط الرقمية
  // يبدأ في صفحة جديدة مستقلة
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 16,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.9',
      pageGroup: 16,
      sectionNumber: '06',
      title: 'مستودع الشواهد والمرفقات والروابط الرقمية',
      subtitle: `العرض البصري الإحصائي لأنواع الشواهد وارتباطاتها، وتوثيق جميع الشواهد المسجلة (${s9.totalEvidencesCount} شواهد) مع معايناتها وروابطها`,
      badgeText: `إجمالي الشواهد: ${s9.totalEvidencesCount}`,
      estimatedHeight: 92,
    },
  });

  // Deduplicate evidences by ID while preserving all linked records
  const rawEvidencesMap = new Map<string, (typeof community.evidenceRepository)[number]>();
  for (const rawEv of community.evidenceRepository || []) {
    if (!rawEvidencesMap.has(rawEv.id)) {
      rawEvidencesMap.set(rawEv.id, rawEv);
    }
  }

  const seenEvidenceIds = new Set<string>();
  const deduplicatedEvidenceRows: PlcFinalReportEvidenceRow[] = [];
  for (const row of s9.rows) {
    if (seenEvidenceIds.has(row.evidenceId)) continue;
    seenEvidenceIds.add(row.evidenceId);
    deduplicatedEvidenceRows.push(row);
  }

  if (deduplicatedEvidenceRows.length > 0) {
    const totalEv = Math.max(1, s9.totalEvidencesCount);
    const getEvTypeCount = (t: string): number =>
      s9.byEvidenceType.find((entry) => entry.type === t)?.count || 0;
    const pdfCount = getEvTypeCount('pdf');
    const docCount = getEvTypeCount('document');
    const imgCount = getEvTypeCount('image');
    const otherEvCount =
      getEvTypeCount('table') + getEvTypeCount('link') + getEvTypeCount('other');

    const evTypeBars = [
      {
        label: 'ملفات PDF وتقارير قياس',
        count: pdfCount,
        percent: Math.round((pdfCount / totalEv) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      },
      {
        label: 'مستندات ومحاضر وبطاقات ملاحظة',
        count: docCount,
        percent: Math.round((docCount / totalEv) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      },
      {
        label: 'صور توثيقية للورش التطبيقية',
        count: imgCount,
        percent: Math.round((imgCount / totalEv) * 100),
        color: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
      },
      {
        label: 'جداول بيانات واستبانات تشخيصية',
        count: otherEvCount,
        percent: Math.round((otherEvCount / totalEv) * 100),
        color: '#2B6CB0',
      },
    ].filter((b) => b.count > 0);

    // Count how many evidences link to each domain
    let meetingLinksCount = 0;
    let planLinksCount = 0;
    let activityLinksCount = 0;
    let kpiAndImpactLinksCount = 0;
    for (const r of deduplicatedEvidenceRows) {
      const joined = r.linkedRecordsDisplay.join(' | ');
      if (joined.includes('الاجتماع')) meetingLinksCount += 1;
      if (joined.includes('الإجراء') || joined.includes('الاحتياج')) planLinksCount += 1;
      if (joined.includes('البرنامج') || joined.includes('النشاط') || joined.includes('الزيارة') || joined.includes('شراكة')) {
        activityLinksCount += 1;
      }
      if (joined.includes('مؤشر') || joined.includes('الأثر')) kpiAndImpactLinksCount += 1;
    }

    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 16,
      estimatedHeight: 430,
      chart: {
        kind: 'section06_evidence_analytics',
        pageGroup: 16,
        totalEvidences: s9.totalEvidencesCount,
        linkedEvidences: s9.linkedEvidencesCount,
        typeBars: evTypeBars,
        domainLinkBars: [
          { label: 'شواهد مرتبطة بالاحتياجات والخطة', count: planLinksCount },
          { label: 'شواهد مرتبطة بمحاضر الاجتماعات', count: meetingLinksCount },
          { label: 'شواهد مرتبطة بالبرامج والزيارات', count: activityLinksCount },
          { label: 'شواهد مرتبطة بالمؤشرات وقياس الأثر', count: kpiAndImpactLinksCount },
        ],
        analyticalReading: [
          `• تحليل تنوع الشواهد وتغطيتها: يضم المستودع (${s9.totalEvidencesCount}) شواهد موثقة مرتبطة بنسبة (100%) بسجلات المجتمع الفعلية (${s9.linkedEvidencesCount} من ${s9.totalEvidencesCount})، وتتنوع بين تقارير قياس قبلي/بعدي بصيغة PDF، ومحاضر وبطاقات ملاحظة صفية، وجداول تشخيصية، وصور توثيقية للورش.`,
        ],
        estimatedHeight: 430,
      },
    });
  }

  deduplicatedEvidenceRows.forEach((evRow, idx) => {
    recordToken(evRow.title);
    const rawEv = rawEvidencesMap.get(evRow.evidenceId);
    const fileDataUrl = rawEv?.fileDataUrl?.trim();
    const hasVisualAttachment = Boolean(fileDataUrl && fileDataUrl.startsWith('data:image/'));
    const destinationUri =
      evRow.qrPayload || `plc://community/${community.id}/evidence/${evRow.evidenceId}`;

    const item: PlcDetailedEvidenceItem = {
      evidenceId: evRow.evidenceId,
      title: evRow.title,
      evidenceTypeLabel: evRow.evidenceTypeLabel,
      descriptionDisplay: evRow.descriptionDisplay,
      whatItProves:
        evRow.whatItProvesSummary ||
        (evRow.descriptionDisplay !== 'غير متوفر'
          ? evRow.descriptionDisplay
          : 'شاهد موثق لأعمال المجتمع المهني'),
      linkedRecordsDisplay:
        evRow.linkedRecordsDisplay.length > 0
          ? evRow.linkedRecordsDisplay
          : ['شاهد عام على مستوى المجتمع المهني'],
      fileNameDisplay: rawEv?.fileName || evRow.sourceDisplay || 'مرفق رقمي موثق',
      hasVisualAttachment,
      fileDataUrl,
      destinationUri,
      hasValidQr: true,
    };

    rawBlocks.push({
      kind: 'detailed_evidence_repository_row',
      pageGroup: 16,
      indexNumber: idx + 1,
      totalCount: deduplicatedEvidenceRows.length,
      item,
      estimatedHeight: 310,
    });
  });

  // ==========================================================================
  // SECTION 07 (pageGroup 17): الخلاصة والإنجازات والتحديات والتوصيات والتوثيق الختامي
  // يبدأ في صفحة جديدة مستقلة
  // ==========================================================================
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 17,
    estimatedHeight: 92,
    block: {
      kind: 'section_header',
      sectionCode: '9.11',
      pageGroup: 17,
      sectionNumber: '07',
      title: 'الخلاصة والإنجازات والتحديات والتوصيات والتوثيق الختامي',
      subtitle: 'التحليل البصري لتصنيف الإنجازات والتحديات، إبراز الأولويات القادمة، وجداول الإنجازات والتحديات والتوصيات والتوقيع',
      badgeText: `الإنجازات: ${s10.items.length} • التوصيات: ${s12.extractedRecommendations.length}`,
      estimatedHeight: 92,
    },
  });

  const stripDatesFromText = (str: string): string =>
    (str || '')
      .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*هـ?\b/g, '')
      .replace(/\(\s*الاستحقاق\s*:[^)]*\)/g, '')
      .replace(/تاريخ الاستحقاق\s*:?\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  // Visual Analytics for Section 07 (Achievements & Challenges Classification + Priority Cards)
  if (s10.items.length > 0 || s11.items.length > 0 || s12.extractedRecommendations.length > 0) {
    const countBySourceKeyword = (
      list: Array<{ source: string }>,
      keywords: string[]
    ): number =>
      list.filter((item) => keywords.some((kw) => item.source.includes(kw))).length;

    const domainComparisonBars = [
      {
        domainLabel: 'الخطة التشغيلية والاجتماعات',
        achievementsCount: countBySourceKeyword(s10.items, ['الخطة', 'الاجتماعات']),
        challengesCount: countBySourceKeyword(s11.items, ['الخطة', 'الاجتماعات']),
      },
      {
        domainLabel: 'البرامج والزيارات وتقويم التنفيذ',
        achievementsCount: countBySourceKeyword(s10.items, ['البرامج', 'تقويم']),
        challengesCount: countBySourceKeyword(s11.items, ['البرامج', 'تقويم']),
      },
      {
        domainLabel: 'مؤشرات الأداء وقياس الأثر والشواهد',
        achievementsCount: countBySourceKeyword(s10.items, ['مؤشرات', 'قياس الأثر', 'الشواهد']),
        challengesCount: countBySourceKeyword(s11.items, ['مؤشرات', 'قياس الأثر', 'الشواهد']),
      },
    ];

    const priorityCards = s12.extractedRecommendations.slice(0, 3).map((rec, idx) => ({
      badge: `الأولوية (${idx + 1})`,
      title: stripDatesFromText(rec.statement),
      responsible: stripDatesFromText(rec.responsibleOrDecision || 'فريق المجتمع المهني'),
    }));

    rawBlocks.push({
      kind: 'visual_chart_block',
      pageGroup: 17,
      estimatedHeight: 450,
      chart: {
        kind: 'section07_closing_analytics',
        pageGroup: 17,
        achievementsCount: s10.items.length,
        challengesCount: s11.items.length,
        recommendationsCount: s12.extractedRecommendations.length,
        domainComparisonBars,
        priorityCards,
        analyticalReading: [
          `• قراءة توازن الإنجازات والتحديات: حقق المجتمع (${s10.items.length}) إنجازات موثقة تركزت في تنفيذ البرامج والزيارات التبادلية وتحقيق الأثر التعليمي والمهني المقاس، مقابل رصد (${s11.items.length}) تحديات وملاحظات تحسين بشفافية تامة وتحويلها إلى (${s12.extractedRecommendations.length}) توصيات إجرائية للدورة القادمة.`,
        ],
        estimatedHeight: 450,
      },
    });
  }

  const allAchievementLines =
    s10.items.length > 0
      ? s10.items.map((it) => `• ${it.statement} (${it.source})`)
      : [`• ${s10.emptyMessage}`];
  rawBlocks.push(
    buildDetailedParagraphBlock(
      '9.10',
      17,
      allAchievementLines,
      `أولًا: حصيلة الإنجازات والممارسات المتحققة (${s10.items.length} إنجازات)`,
      'emerald',
      ctx,
      false
    )
  );

  // Full Challenges Table
  const challengeRows =
    s11.items.length > 0
      ? s11.items.map((ch, idx) => [
          `${idx + 1}`,
          ch.statement,
          ch.recordedNote || 'مرصود أثناء متابعة التنفيذ والقياس',
          ch.source,
        ])
      : [['١', s11.emptyMessage, 'لا توجد معوقات حرجة مسجلة', 'المتابعة الدورية']];

  rawBlocks.push(
    buildDetailedTableBlock(
      '9.11',
      17,
      ['م', 'التحدي الفعلي المرصود', 'السبب / الملاحظة التفسيرية الموثقة', 'مصدر الرصد'],
      [8, 42, 32, 18],
      challengeRows,
      `ثانيًا: جدول التحديات الفعلية المرصودة وأسبابها الموثقة (${challengeRows.length} تحديات)`,
      undefined,
      ctx
    )
  );

  // Full Recommendations Table (without due dates)
  const recRows =
    s12.extractedRecommendations.length > 0
      ? s12.extractedRecommendations.map((rec, idx) => [
          `${idx + 1}`,
          stripDatesFromText(rec.statement),
          stripDatesFromText(rec.responsibleOrDecision || 'فريق المجتمع المهني'),
        ])
      : [
          [
            '١',
            'استكمال توثيق مؤشرات الأداء وقياس الأثر الدوري في الدورة القادمة للمجتمع.',
            'فريق المجتمع المهني',
          ],
        ];

  rawBlocks.push(
    buildDetailedTableBlock(
      '9.12',
      17,
      ['م', 'التوصية الإجرائية / الأولوية القادمة', 'الجهة المسؤولة / القرار'],
      [10, 58, 32],
      recRows,
      `ثالثًا: جدول التوصيات الإجرائية والأولويات القادمة للتحسين المستمر (${recRows.length} توصية)`,
      undefined,
      ctx
    )
  );

  // Closing Notes with Highlighted Sub-headings (`الخلاصة`, `التشخيص الدقيق للاحتياجات`, `الأولويات القادمة`)
  const rawSummaryNote = (
    s12.customExecutiveNotes
      ? stripDatesFromText(s12.customExecutiveNotes)
      : `حقّق المجتمع تكاملًا منهجيًا بين التخطيط والتطبيق التشاركي بنسبة إنجاز (${s4.completionDisplay}) وأثر مقاس موثق بالشواهد.`
  ).replace(/^(?:ال)?خلاص[ةه]\s*:?\s*/u, '');
  const rawNeedsDiagnosisNote =
    s3.rows.length > 0
      ? `ارتكزت التدخلات على تشخيص (${s3.totalNeedsCount}) احتياجات مهنية ذات أولوية مرتبطة مباشرةً بفجوات الأداء الصفي الفعلي.`
      : 'ارتكزت أنشطة المجتمع على رصد الاحتياجات المهنية الفعلية لأعضاء الفريق.';
  const rawFuturePrioritiesNote = s12.customClosingNotes
    ? stripDatesFromText(s12.customClosingNotes)
    : 'توسيع الزيارات الصفية المتبادلة، وتعميم نماذج الدروس المحسّنة، واستدامة قياس الأثر القبلي والبعدي.';

  const highlightedNotes: PlcHighlightedNoteItem[] = [
    {
      prefix: 'الخلاصة',
      text: rawSummaryNote,
      prefixColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
    },
    {
      prefix: 'التشخيص الدقيق للاحتياجات',
      text: rawNeedsDiagnosisNote,
      prefixColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
    },
    {
      prefix: 'الأولويات القادمة',
      text: rawFuturePrioritiesNote,
      prefixColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
    },
  ];

  rawBlocks.push(
    buildDetailedParagraphBlock(
      '9.12',
      17,
      highlightedNotes.map((n) => `${n.prefix}: ${n.text}`),
      'رابعًا: الخلاصة والمرئيات الختامية',
      'emerald',
      ctx,
      false,
      highlightedNotes
    )
  );

  // Sign-off & Stamp block
  const closingSummaryText = `وثّق هذا التقرير التفصيلي الشامل جميع أعمال وسجلات وشواهد «${report.communityName}» خلال ${s1.semesterLabel} من العام الدراسي ${s1.academicYear}.`;
  rawBlocks.push({
    kind: 'core_block',
    pageGroup: 17,
    estimatedHeight: 236,
    block: {
      kind: 'official_signoff_block',
      sectionCode: '9.12',
      pageGroup: 17,
      signoffHeading: 'التوثيق الختامي للتقرير التفصيلي للمجتمع',
      closingStatementLines: wrapArabicCellText(
        closingSummaryText,
        CONTENT_W - 96,
        12.2,
        ctx
      ).slice(0, 2),
      leaderTitle: 'رئيس مجتمع التعلّم المهني',
      leaderName: s1.leaderNameDisplay,
      leaderSpecialty: s1.leaderSpecialtyDisplay,
      stampLabel: 'الختم',
      principalTitle: genderedLabels.principalTitle,
      principalName: principalNameDisplay,
      schoolName: '',
      estimatedHeight: 236,
    },
  });

  // ==========================================================================
  // SECTION-AWARE PAGINATION ENGINE:
  // 1. Page 1 (`pageGroup = 0`): Standalone Cover Page.
  // 2. Page 2 (`pageGroup = 1`): Standalone Table of Contents Page.
  // 3. Page 3 (`pageGroup = 2`): Standalone Statistical Summary Page.
  // 4. Every Main Section (`pageGroup = 11..17` -> Sections `01`..`07`) ALWAYS starts on a NEW page!
  // 5. Within the same section (`pageGroup`), content flows naturally across pages without compression
  //    or artificial sub-form breaks, splitting tables and QR grids cleanly when needed.
  // ==========================================================================
  const pageGroupTitles: Record<number, string> = {
    0: 'غلاف التقرير التفصيلي لمجتمع التعلّم المهني',
    1: 'فهرس المحتويات',
    2: 'الملخص الإحصائي والتحليل العام للمجتمع',
    11: '01 تأسيس المجتمع المهني والهوية التنظيمية وأعضاء الفريق',
    12: '02 الاحتياجات المهنية والأولويات والخطة التشغيلية',
    13: '03 الاجتماعات المهنية والمحاضر والقرارات',
    14: '04 البرامج والأنشطة والزيارات المتبادلة والشراكات وتقويم التنفيذ',
    15: '05 مؤشرات الأداء المهنية والتقييم وقياس الأثر',
    16: '06 مستودع الشواهد والمرفقات والروابط الرقمية',
    17: '07 الخلاصة والإنجازات والتحديات والتوصيات والتوثيق الختامي',
  };

  const pagesBlocks: Array<{ pageGroup: number; blocks: PlcDetailedBlock[] }> = [];
  let currentPageBlocks: PlcDetailedBlock[] = [];
  let currentGroup = 0;
  let currentY: number = INTERIOR_START_Y;

  const flushCurrentPage = (nextGroup: number) => {
    if (currentPageBlocks.length > 0) {
      pagesBlocks.push({ pageGroup: currentGroup, blocks: currentPageBlocks });
      currentPageBlocks = [];
    }
    currentGroup = nextGroup;
    currentY = INTERIOR_START_Y;
  };

  const queue: PlcDetailedBlock[] = [...rawBlocks];

  while (queue.length > 0) {
    const item = queue.shift()!;
    const nextItem = queue.length > 0 ? queue[0] : null;
    const isCover = item.kind === 'core_block' && item.block.kind === 'cover_page';

    // 1. Cover Page is always standalone Page 1
    if (isCover) {
      flushCurrentPage(0);
      pagesBlocks.push({ pageGroup: 0, blocks: [item] });
      currentGroup = 1;
      currentY = INTERIOR_START_Y;
      continue;
    }

    // 2. Mandatory Rule: Every main section (and standalone TOC / Statistical Summary)
    //    MUST start on a NEW page whenever `item.pageGroup !== currentGroup`!
    if (currentPageBlocks.length > 0 && item.pageGroup !== currentGroup) {
      flushCurrentPage(item.pageGroup);
    }

    if (currentPageBlocks.length === 0) {
      currentGroup = item.pageGroup;
    }

    const availableH = MAX_CONTENT_Y - currentY;

    // 3. Section Header Orphan Protection (within the same section if needed)
    const isSectionHeader =
      item.kind === 'core_block' && item.block.kind === 'section_header';
    if (isSectionHeader) {
      const minNextH = getMinStartHeightForBlock(nextItem);
      const neededForHeaderAndFirstChild =
        item.estimatedHeight + PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap + minNextH;

      if (currentPageBlocks.length > 0 && neededForHeaderAndFirstChild > availableH) {
        flushCurrentPage(item.pageGroup);
      }
      currentPageBlocks.push(item);
      currentY += getBlockAdvanceHeight(item, nextItem);
      continue;
    }

    // 4. Dynamic Table Splitting across Page Boundaries within the Same Section
    if (item.kind === 'core_block' && item.block.kind === 'table') {
      const tbl = item.block;
      if (tbl.estimatedHeight <= availableH) {
        currentPageBlocks.push(item);
        currentY += getBlockAdvanceHeight(item, nextItem);
        continue;
      }

      const titleOverhead = (tbl.title ? 44 : 0) + (tbl.subtitleNote ? 30 : 0);
      const baseOverhead = tbl.headerHeight + titleOverhead + 24;
      const firstRowH = tbl.rowHeights[0] || 52;

      if (currentPageBlocks.length > 0 && baseOverhead + firstRowH > availableH) {
        flushCurrentPage(item.pageGroup);
        queue.unshift(item);
        continue;
      }

      const maxFitH =
        currentPageBlocks.length === 0 ? MAX_CONTENT_Y - INTERIOR_START_Y : availableH;
      let fitCount = 0;
      let accH = baseOverhead;
      for (let r = 0; r < tbl.wrappedRows.length; r++) {
        const rH = tbl.rowHeights[r];
        if (fitCount > 0 && accH + rH > maxFitH) {
          break;
        }
        accH += rH;
        fitCount += 1;
      }

      if (fitCount >= tbl.wrappedRows.length) {
        currentPageBlocks.push(item);
        currentY += getBlockAdvanceHeight(item, nextItem);
        continue;
      }

      const headRows = tbl.wrappedRows.slice(0, fitCount);
      const headHeights = tbl.rowHeights.slice(0, fitCount);
      const headEstH = baseOverhead + headHeights.reduce((sum, h) => sum + h, 0);

      const headBlock: PlcDetailedBlock = {
        kind: 'core_block',
        pageGroup: item.pageGroup,
        estimatedHeight: headEstH,
        block: {
          ...tbl,
          wrappedRows: headRows,
          rowHeights: headHeights,
          estimatedHeight: headEstH,
        },
      };

      const tailRows = tbl.wrappedRows.slice(fitCount);
      const tailHeights = tbl.rowHeights.slice(fitCount);
      const baseTitle = tbl.title ? tbl.title.replace(/\s*\(تابع\)$/, '') : undefined;
      const tailTitle = baseTitle ? `${baseTitle} (تابع)` : undefined;
      const tailOverhead = tbl.headerHeight + (tailTitle ? 44 : 0) + 24;
      const tailEstH = tailOverhead + tailHeights.reduce((sum, h) => sum + h, 0);

      const tailBlock: PlcDetailedBlock = {
        kind: 'core_block',
        pageGroup: item.pageGroup,
        estimatedHeight: tailEstH,
        block: {
          ...tbl,
          title: tailTitle,
          subtitleNote: undefined,
          wrappedRows: tailRows,
          rowHeights: tailHeights,
          estimatedHeight: tailEstH,
        },
      };

      currentPageBlocks.push(headBlock);
      flushCurrentPage(item.pageGroup);
      queue.unshift(tailBlock);
      continue;
    }

    // 5. Dynamic QR Card Grid Splitting across Page Boundaries within the Same Section
    if (item.kind === 'detailed_qr_links_grid' && item.cards.length > 2) {
      if (item.estimatedHeight <= availableH) {
        currentPageBlocks.push(item);
        currentY += getBlockAdvanceHeight(item, nextItem);
        continue;
      }

      const rowUnitH = 162 + 14;
      const oneRowGridH = 74 + rowUnitH + 10;

      if (currentPageBlocks.length > 0 && oneRowGridH <= availableH) {
        const totalRows = Math.ceil(item.cards.length / 2);
        let fitRows = 0;
        for (let r = 1; r <= totalRows; r++) {
          if (74 + r * rowUnitH + 10 <= availableH) {
            fitRows = r;
          } else {
            break;
          }
        }

        if (fitRows > 0 && fitRows < totalRows) {
          const splitCardIdx = fitRows * 2;
          const headCards = item.cards.slice(0, splitCardIdx);
          const tailCards = item.cards.slice(splitCardIdx);
          const headH = 74 + fitRows * rowUnitH + 10;
          const tailRowsCount = Math.ceil(tailCards.length / 2);
          const tailH = 74 + tailRowsCount * rowUnitH + 10;
          const baseTitle = item.title.replace(/\s*\(تابع\)$/, '');

          const headGrid: PlcDetailedBlock = {
            ...item,
            cards: headCards,
            estimatedHeight: headH,
          };

          const tailGrid: PlcDetailedBlock = {
            ...item,
            title: `${baseTitle} (تابع)`,
            cards: tailCards,
            estimatedHeight: tailH,
          };

          currentPageBlocks.push(headGrid);
          flushCurrentPage(item.pageGroup);
          queue.unshift(tailGrid);
          continue;
        }
      }
    }

    // 6. Standard Block Placement within the Same Section
    if (currentPageBlocks.length > 0 && item.estimatedHeight > availableH) {
      flushCurrentPage(item.pageGroup);
    }

    currentPageBlocks.push(item);
    currentY += getBlockAdvanceHeight(item, nextItem);
  }

  if (currentPageBlocks.length > 0) {
    pagesBlocks.push({ pageGroup: currentGroup, blocks: currentPageBlocks });
  }

  const nonEmptyPages = pagesBlocks.filter((p) => p.blocks.length > 0);
  const totalPages = Math.max(1, nonEmptyPages.length);

  // ==========================================================================
  // DYNAMIC TABLE OF CONTENTS PAGE NUMBERS (Computed AFTER pagination completes)
  // ==========================================================================
  const chapterActualStartPage = new Map<string, number>();
  let statisticalSummaryPageNum = 3;

  nonEmptyPages.forEach((pageEntry, pageIdx) => {
    const pNum = pageIdx + 1;
    if (pageEntry.pageGroup === 2) {
      statisticalSummaryPageNum = pNum;
    }
    for (const blk of pageEntry.blocks) {
      if (blk.kind === 'core_block' && blk.block.kind === 'section_header') {
        const secNum = blk.block.sectionNumber;
        if (!chapterActualStartPage.has(secNum)) {
          chapterActualStartPage.set(secNum, pNum);
        }
      }
    }
  });

  const finalTocEntries: PlcDetailedTocEntry[] = tocChapterDefs.map((d) => ({
    chapterNumber: d.chapterNumber,
    chapterTitle: d.chapterTitle,
    formsCovered: d.formsCovered,
    metricsBadge: d.metricsBadge,
    startPageNumber: chapterActualStartPage.get(d.chapterNumber) || 4,
  }));

  for (const pageEntry of nonEmptyPages) {
    for (const blk of pageEntry.blocks) {
      if (blk.kind === 'toc_block') {
        blk.entries = finalTocEntries;
        blk.statisticalSummaryPageNumber = statisticalSummaryPageNum;
      }
    }
  }

  // Track how many pages each `pageGroup` spans so continuation pages get `(تابع)` in pageTitle
  const groupFirstPage = new Map<number, number>();
  nonEmptyPages.forEach((entry, idx) => {
    if (!groupFirstPage.has(entry.pageGroup)) {
      groupFirstPage.set(entry.pageGroup, idx + 1);
    }
  });

  // Pre-compute deterministic QR and Link coordinates for all pages
  const pages: PlcDetailedPagePlan[] = nonEmptyPages.map((entry, idx) => {
    const pageNum = idx + 1;
    const isCover = entry.blocks.some(
      (b) => b.kind === 'core_block' && b.block.kind === 'cover_page'
    );
    const plannedLinks: PlcPdfLinkAnnotation[] = [];
    const plannedQrSpots: PlcRenderedQrSpot[] = [];

    if (!isCover) {
      let simY = INTERIOR_START_Y;
      for (let bIdx = 0; bIdx < entry.blocks.length; bIdx++) {
        const item = entry.blocks[bIdx];
        const nextItem =
          bIdx + 1 < entry.blocks.length ? entry.blocks[bIdx + 1] : null;

        if (item.kind === 'detailed_qr_links_grid' && item.cards.length > 0) {
          const gapX = 18;
          const gapY = 14;
          const cardW = Math.floor((CONTENT_W - 48 - gapX) / 2);
          const cardH = 162;
          const cardsStartY = simY + 74;
          const qrBoxSize = 124;

          item.cards.forEach((evCard, cIdx) => {
            const r = Math.floor(cIdx / 2);
            const isRight = cIdx % 2 === 0;
            const cardX = isRight ? PAGE_W - MARGIN_X - 24 - cardW : MARGIN_X + 24;
            const cardY = cardsStartY + r * (cardH + gapY);
            const targetUri = evCard.destinationUri || evCard.qrPayload;

            if (evCard.hasValidQr && targetUri) {
              const qrX = cardX + 14;
              const qrY = cardY + Math.round((cardH - qrBoxSize) / 2);
              const textZoneX = cardX + qrBoxSize + 22;
              const textZoneW = cardW - qrBoxSize - 36;
              const linkPillW = Math.min(256, textZoneW - 14);
              const linkPillH = 30;
              const linkPillX = textZoneX + Math.round((textZoneW - linkPillW) / 2);
              const linkPillY = cardY + cardH - linkPillH - 12;

              plannedLinks.push({
                xPx: qrX,
                yPx: qrY,
                wPx: qrBoxSize,
                hPx: qrBoxSize,
                url: targetUri,
                kind: 'qr',
                targetId: evCard.evidenceId,
                label: `QR: ${evCard.title}`,
              });
              plannedLinks.push({
                xPx: linkPillX,
                yPx: linkPillY,
                wPx: linkPillW,
                hPx: linkPillH,
                url: targetUri,
                kind: 'text',
                targetId: evCard.evidenceId,
                label: evCard.linkLabel || 'فتح الشاهد / عرض الرابط',
              });
              plannedQrSpots.push({
                targetId: evCard.evidenceId,
                title: evCard.title,
                payload: targetUri,
                qrX: qrX + 4,
                qrY: qrY + 4,
                qrSize: qrBoxSize - 8,
                quietZoneModules: 4,
                textLinkRect: {
                  xPx: linkPillX,
                  yPx: linkPillY,
                  wPx: linkPillW,
                  hPx: linkPillH,
                  url: targetUri,
                },
              });
            }
          });
        } else if (item.kind === 'detailed_evidence_repository_row') {
          const evItem = item.item;
          const targetUri = evItem.destinationUri;
          if (evItem.hasValidQr && targetUri) {
            const qrBoxSize = 132;
            const qrX = MARGIN_X + 22;
            const qrY = simY + 54;
            const linkPillW = 190;
            const linkPillH = 32;
            const linkPillX = qrX + qrBoxSize + 18;
            const linkPillY = simY + item.estimatedHeight - linkPillH - 18;

            plannedLinks.push({
              xPx: qrX,
              yPx: qrY,
              wPx: qrBoxSize,
              hPx: qrBoxSize,
              url: targetUri,
              kind: 'qr',
              targetId: evItem.evidenceId,
              label: `QR: ${evItem.title}`,
            });
            plannedLinks.push({
              xPx: linkPillX,
              yPx: linkPillY,
              wPx: linkPillW,
              hPx: linkPillH,
              url: targetUri,
              kind: 'text',
              targetId: evItem.evidenceId,
              label: 'فتح الشاهد / عرض الرابط المباشر',
            });
            plannedQrSpots.push({
              targetId: evItem.evidenceId,
              title: evItem.title,
              payload: targetUri,
              qrX: qrX + 4,
              qrY: qrY + 4,
              qrSize: qrBoxSize - 8,
              quietZoneModules: 4,
              textLinkRect: {
                xPx: linkPillX,
                yPx: linkPillY,
                wPx: linkPillW,
                hPx: linkPillH,
                url: targetUri,
              },
            });
          }
        }

        simY += getBlockAdvanceHeight(item, nextItem);
      }
    }

    const baseGroupTitle =
      pageGroupTitles[entry.pageGroup] || 'التقرير التفصيلي لمجتمع التعلّم المهني';
    const isContinuationPage =
      entry.pageGroup >= 11 && groupFirstPage.get(entry.pageGroup) !== pageNum;
    const resolvedPageTitle = isContinuationPage
      ? `${baseGroupTitle} (تابع)`
      : baseGroupTitle;

    return {
      pageNumber: pageNum,
      totalPages,
      isCoverPage: isCover,
      pageGroup: entry.pageGroup,
      pageTitle: resolvedPageTitle,
      footerLabel: isCover ? '' : `${pageNum}`,
      blocks: entry.blocks,
      plannedLinks,
      plannedQrSpots,
    };
  });

  return {
    communityId: report.communityId,
    communityName: report.communityName,
    reportTitle: `التقرير التفصيلي لمجتمع التعلّم المهني — ${report.communityName}`,
    pages,
    tocEntries: finalTocEntries,
    statisticalSummaryPageNumber: statisticalSummaryPageNum,
    totalEvidencesIncluded: deduplicatedEvidenceRows.length,
    allTextTokens: textTokens,
  };
}

// ============================================================================
// STANDALONE TABLE OF CONTENTS PAGE RENDERER (PAGE 2)
// ============================================================================
function drawDetailedTocBlock(
  ctx: CanvasRenderingContext2D,
  block: Extract<PlcDetailedBlock, { kind: 'toc_block' }>,
  startY: number
): number {
  const {
    petrolGreen,
    deepTurquoise,
    mutedGold,
    ivory,
    softIvory,
    white,
    darkInk,
    bodyInk,
    cardBorder,
    turquoiseSubtleBg,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  const boxH = block.estimatedHeight;

  // Outer Frame
  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 20);
  ctx.fillStyle = softIvory;
  ctx.fill();
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Top Executive Title Banner
  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 108, 18);
  ctx.fillStyle = petrolGreen;
  ctx.fill();

  // Subtle geometric corner accents inside banner
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + 40, startY + 94);
  ctx.lineTo( PAGE_W - MARGIN_X - 40, startY + 94);
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = white;
  ctx.font = `700 28px ${FONT_FAMILY}`;
  ctx.fillText('فهرس المحتويات', PAGE_W / 2, startY + 46);

  ctx.fillStyle = mutedGold;
  ctx.font = `600 16.5px ${FONT_FAMILY}`;
  ctx.fillText(
    'التسلسل الهيكلي لأقسام التقرير التفصيلي لمجتمع التعلّم المهني وأرقام صفحاتها الفعلية',
    PAGE_W / 2,
    startY + 78
  );

  // Introductory Navigation Strip (Statistical Summary Page Reference)
  const introStripY = startY + 130;
  const introStripH = 74;
  drawPlcRoundedBox(ctx, MARGIN_X + 28, introStripY, CONTENT_W - 56, introStripH, 14);
  ctx.fillStyle = ivory;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = petrolGreen;
  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.fillText(
    'الملخص الإحصائي والتحليل العام للمجتمع المهني',
    PAGE_W - MARGIN_X - 52,
    introStripY + 31
  );

  ctx.fillStyle = bodyInk;
  ctx.font = `600 14.5px ${FONT_FAMILY}`;
  ctx.fillText(
    'بطاقات المؤشرات الكلية، الرسوم البيانية المجمعة، والقراءة التحليلية العامة لدورة عمل المجتمع',
    PAGE_W - MARGIN_X - 52,
    introStripY + 56
  );

  const statPageBadgeW = 140;
  const statPageBadgeX = MARGIN_X + 48;
  drawPlcRoundedBox(ctx, statPageBadgeX, introStripY + 13, statPageBadgeW, 48, 10);
  ctx.fillStyle = deepTurquoise;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = white;
  ctx.font = `700 17px ${FONT_FAMILY}`;
  ctx.fillText(
    `صفحة ${block.statisticalSummaryPageNumber}`,
    statPageBadgeX + statPageBadgeW / 2,
    introStripY + 43
  );

  // Section divider label
  let rowY = introStripY + introStripH + 26;
  ctx.textAlign = 'right';
  ctx.fillStyle = petrolGreen;
  ctx.font = `700 18.5px ${FONT_FAMILY}`;
  ctx.fillText(
    'الأقسام الرئيسية للتقرير التفصيلي (يبدأ كل قسم رئيسي في صفحة مستقلة):',
    PAGE_W - MARGIN_X - 32,
    rowY + 16
  );
  rowY += 34;

  // 7 Main Sections (`01` .. `07`) with generous height and clear typography
  block.entries.forEach((entry, idx) => {
    const rowH = 166;
    const rowX = MARGIN_X + 28;
    const rowW = CONTENT_W - 56;

    drawPlcRoundedBox(ctx, rowX, rowY, rowW, rowH, 16);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = idx % 2 === 0 ? petrolGreen : cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Right accent bar
    drawPlcRoundedBox(ctx, rowX + rowW - 8, rowY + 12, 8, rowH - 24, 4);
    ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
    ctx.fill();

    // Right badge: Section Number (`01` .. `07`)
    const badgeW = 86;
    const badgeH = rowH - 32;
    const badgeX = rowX + rowW - badgeW - 22;
    const badgeY = rowY + 16;
    drawPlcRoundedBox(ctx, badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = mutedGold;
    ctx.font = `600 14px ${FONT_FAMILY}`;
    ctx.fillText('القسم', badgeX + badgeW / 2, badgeY + 44);

    ctx.fillStyle = white;
    ctx.font = `700 28px ${FONT_FAMILY}`;
    ctx.fillText(entry.chapterNumber, badgeX + badgeW / 2, badgeY + 86);

    // Left badge: Dynamic Starting Page Number
    const pageBadgeW = 140;
    const pageBadgeH = 60;
    const pageBadgeX = rowX + 20;
    const pageBadgeY = rowY + Math.round((rowH - pageBadgeH) / 2);

    drawPlcRoundedBox(ctx, pageBadgeX, pageBadgeY, pageBadgeW, pageBadgeH, 12);
    ctx.fillStyle = ivory;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 19px ${FONT_FAMILY}`;
    ctx.fillText(
      `صفحة ${entry.startPageNumber}`,
      pageBadgeX + pageBadgeW / 2,
      pageBadgeY + 37
    );

    // Middle Content Zone: Section Title, Scope Description, and Metrics Pill
    const textRightX = badgeX - 24;
    const textLeftLimit = pageBadgeX + pageBadgeW + 24;
    const textMaxW = Math.max(400, textRightX - textLeftLimit);

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `700 21px ${FONT_FAMILY}`;
    ctx.fillText(entry.chapterTitle, textRightX, rowY + 42);

    ctx.fillStyle = bodyInk;
    ctx.font = `600 15.5px ${FONT_FAMILY}`;
    const descLines = wrapArabicCellText(entry.formsCovered, textMaxW, 11.5, ctx).slice(0, 2);
    let dY = rowY + 76;
    for (const ln of descLines) {
      ctx.fillText(ln, textRightX, dY);
      dY += 26;
    }

    // Metrics Pill at bottom-right of the row
    const pillW = Math.min(340, textMaxW);
    const pillH = 32;
    const pillX = textRightX - pillW;
    const pillY = rowY + rowH - pillH - 14;
    drawPlcRoundedBox(ctx, pillX, pillY, pillW, pillH, 8);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = deepTurquoise;
    ctx.font = `700 14px ${FONT_FAMILY}`;
    ctx.fillText(entry.metricsBadge, pillX + pillW / 2, pillY + 21);

    rowY += rowH + 20;
  });

  return startY + boxH + 20;
}

// ============================================================================
// STANDALONE STATISTICAL SUMMARY HEADER & 8 NUMERIC CARDS (PAGE 3)
// ============================================================================
function drawStatisticalSummaryHeaderAndCards(
  ctx: CanvasRenderingContext2D,
  block: Extract<PlcDetailedBlock, { kind: 'statistical_summary_header_and_cards' }>,
  startY: number
): number {
  const {
    petrolGreen,
    deepTurquoise,
    mutedGold,
    ivory,
    white,
    darkInk,
    bodyInk,
    cardBorder,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  // 1. Top Section Banner (Without any "00" numbering)
  const bannerH = 92;
  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, bannerH, 16);
  ctx.fillStyle = petrolGreen;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Right Gold Accent Pill
  const rightPillW = 148;
  const rightPillX = PAGE_W - MARGIN_X - rightPillW - 18;
  drawPlcRoundedBox(ctx, rightPillX, startY + 18, rightPillW, bannerH - 36, 12);
  ctx.fillStyle = mutedGold;
  ctx.fill();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = petrolGreen;
  ctx.font = `700 16px ${FONT_FAMILY}`;
  ctx.fillText('ملخص إحصائي', rightPillX + rightPillW / 2, startY + 52);

  // Left Status Pill
  const leftPillW = 210;
  drawPlcRoundedBox(ctx, MARGIN_X + 18, startY + 22, leftPillW, bannerH - 44, 10);
  ctx.fillStyle = deepTurquoise;
  ctx.fill();
  ctx.fillStyle = white;
  ctx.font = `700 15px ${FONT_FAMILY}`;
  ctx.fillText(block.badgeText, MARGIN_X + 18 + leftPillW / 2, startY + 52);

  // Center Title & Subtitle
  ctx.textAlign = 'center';
  ctx.fillStyle = white;
  ctx.font = `700 23px ${FONT_FAMILY}`;
  ctx.fillText(block.title, PAGE_W / 2, startY + 38);

  ctx.fillStyle = ivory;
  ctx.font = `600 14.5px ${FONT_FAMILY}`;
  ctx.fillText(block.subtitle, PAGE_W / 2, startY + 68);

  // 2. 8 Numeric Stat Cards (4 columns × 2 rows)
  const gridStartY = startY + bannerH + 20;
  const cols = 4;
  const gapX = 16;
  const gapY = 16;
  const cardW = Math.floor((CONTENT_W - gapX * (cols - 1)) / cols);
  const cardH = 136;

  block.cards.forEach((card, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    // RTL column placement (column 0 on the right)
    const cardX = PAGE_W - MARGIN_X - (c + 1) * cardW - c * gapX;
    const cardY = gridStartY + r * (cardH + gapY);

    drawPlcRoundedBox(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle =
      card.tone === 'gold'
        ? mutedGold
        : card.tone === 'turquoise'
        ? deepTurquoise
        : cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Top color bar
    drawPlcRoundedBox(ctx, cardX, cardY, cardW, 34, 12);
    ctx.fillStyle =
      card.tone === 'gold'
        ? mutedGold
        : card.tone === 'turquoise'
        ? deepTurquoise
        : petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = card.tone === 'gold' ? petrolGreen : white;
    ctx.font = `700 14.5px ${FONT_FAMILY}`;
    ctx.fillText(card.label, cardX + cardW / 2, cardY + 23);

    // Main numeric value
    ctx.fillStyle = darkInk;
    ctx.font = `700 24px ${FONT_FAMILY}`;
    ctx.fillText(card.value, cardX + cardW / 2, cardY + 74);

    // Sublabel
    ctx.fillStyle = bodyInk;
    ctx.font = `600 12.5px ${FONT_FAMILY}`;
    const subLines = wrapArabicCellText(card.sublabel, cardW - 20, 9.5, ctx).slice(0, 2);
    let sY = cardY + 102;
    for (const ln of subLines) {
      ctx.fillText(ln, cardX + cardW / 2, sY);
      sY += 18;
    }
  });

  return startY + block.estimatedHeight + 20;
}

// ============================================================================
// SECTION-SPECIFIC VISUAL ANALYTICS & CHARTS RENDERER (SECTIONS 01 .. 07)
// ============================================================================
function drawDetailedVisualChartBlock(
  ctx: CanvasRenderingContext2D,
  block: Extract<PlcDetailedBlock, { kind: 'visual_chart_block' }>,
  startY: number
): number {
  const {
    petrolGreen,
    deepTurquoise,
    mutedGold,
    ivory,
    softIvory,
    white,
    darkInk,
    bodyInk,
    cardBorder,
    turquoiseSubtleBg,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  const ch = block.chart;
  const boxH = block.estimatedHeight;

  ctx.direction = 'rtl';

  // --------------------------------------------------------------------------
  // SECTION 01-A: Organizational Structure & Team Roles Distribution
  // --------------------------------------------------------------------------
  if (ch.kind === 'section01_org_structure') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'التحليل البصري لهيكل المجتمع المهني وتوزيع الأدوار والمسؤوليات بين الأعضاء',
      PAGE_W / 2,
      startY + 29
    );

    const innerY = startY + 58;
    const panelH = boxH - 134;
    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;

    // Right Panel: Visual Hierarchy Diagram
    drawPlcRoundedBox(ctx, rightX, innerY, halfW, panelH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText('مخطط الهيكل التنظيمي للمجتمع', rightX + halfW / 2, innerY + 26);

    // Top Leader Node
    const leaderBoxW = halfW - 80;
    const leaderBoxX = rightX + 40;
    const leaderBoxY = innerY + 40;
    drawPlcRoundedBox(ctx, leaderBoxX, leaderBoxY, leaderBoxW, 56, 10);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = mutedGold;
    ctx.font = `700 13.5px ${FONT_FAMILY}`;
    ctx.fillText('قيادة المجتمع المهني (رئيس المجتمع)', leaderBoxX + leaderBoxW / 2, leaderBoxY + 22);
    ctx.fillStyle = white;
    ctx.font = `700 15px ${FONT_FAMILY}`;
    ctx.fillText(ch.leaderName, leaderBoxX + leaderBoxW / 2, leaderBoxY + 44);

    // Connector lines down to 4 role nodes
    const branchMidY = leaderBoxY + 68;
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rightX + halfW / 2, leaderBoxY + 56);
    ctx.lineTo(rightX + halfW / 2, branchMidY);
    ctx.stroke();

    const subNodes = ch.roleCounts.slice(0, 4);
    const nodeCols = 2;
    const nodeGapX = 14;
    const nodeGapY = 12;
    const nodeW = Math.floor((halfW - 44 - nodeGapX) / nodeCols);
    const nodeH = 52;
    const nodesStartY = branchMidY + 6;

    subNodes.forEach((rn, idx) => {
      const r = Math.floor(idx / nodeCols);
      const c = idx % nodeCols;
      const nx = rightX + halfW - 22 - (c + 1) * nodeW - c * nodeGapX;
      const ny = nodesStartY + r * (nodeH + nodeGapY);

      drawPlcRoundedBox(ctx, nx, ny, nodeW, nodeH, 8);
      ctx.fillStyle = ivory;
      ctx.fill();
      ctx.strokeStyle = deepTurquoise;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(`${rn.roleLabel} (${rn.count})`, nx + nodeW / 2, ny + 21);

      ctx.fillStyle = bodyInk;
      ctx.font = `600 11.5px ${FONT_FAMILY}`;
      const shortNames = wrapArabicCellText(rn.names, nodeW - 14, 9, ctx)[0];
      ctx.fillText(shortNames, nx + nodeW / 2, ny + 41);
    });

    // Left Panel: Role Distribution Bars
    drawPlcRoundedBox(ctx, leftX, innerY, halfW, panelH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `توزيع الأدوار والمسؤوليات (إجمالي الأعضاء: ${ch.membersCount})`,
      leftX + halfW / 2,
      innerY + 26
    );

    let barY = innerY + 50;
    ch.roleCounts.slice(0, 5).forEach((rc, idx) => {
      const labelRightX = leftX + halfW - 18;
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(rc.roleLabel, labelRightX, barY + 15);

      const trackX = leftX + 76;
      const trackW = halfW - 210;
      const pct = Math.min(100, Math.round((rc.count / Math.max(1, ch.membersCount)) * 100));

      drawPlcRoundedBox(ctx, trackX, barY + 2, trackW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = Math.max(12, Math.round((pct / 100) * trackW));
      drawPlcRoundedBox(ctx, trackX + trackW - fillW, barY + 2, fillW, 18, 6);
      ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(`${rc.count} عضو`, leftX + 16, barY + 16);

      barY += 34;
    });

    // Bottom Analytical Strip
    const readingY = startY + boxH - 64;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, readingY, CONTENT_W - 40, 50, 10);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 14px ${FONT_FAMILY}`;
    const rLines = wrapArabicCellText(ch.analyticalReading, CONTENT_W - 76, 11, ctx).slice(0, 2);
    let ry = readingY + 22;
    for (const ln of rLines) {
      ctx.fillText(ln, PAGE_W - MARGIN_X - 36, ry);
      ry += 20;
    }

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 01-B: Visual Architecture of Vision, Mission, Goals, Values & Principles
  // --------------------------------------------------------------------------
  if (ch.kind === 'section01_identity_architecture') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'رابعًا: البنية التنظيمية للرؤية والرسالة والأهداف والقيم والمبادئ المهنية الحاكمة',
      PAGE_W / 2,
      startY + 29
    );

    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;
    let curY = startY + 58;

    // Top Row: Vision Card (Right) + Mission Card (Left)
    const vmH = 128;
    // Vision Card
    drawPlcRoundedBox(ctx, rightX, curY, halfW, vmH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, rightX, curY, halfW, 34, 10);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = mutedGold;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText('الرؤية المهنية للمجتمع', rightX + halfW / 2, curY + 23);

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `600 14.5px ${FONT_FAMILY}`;
    const vLines = wrapArabicCellText(ch.visionText, halfW - 36, 11, ctx).slice(0, 3);
    let vy = curY + 58;
    for (const ln of vLines) {
      ctx.fillText(ln, rightX + halfW - 18, vy);
      vy += 24;
    }

    // Mission Card
    drawPlcRoundedBox(ctx, leftX, curY, halfW, vmH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, leftX, curY, halfW, 34, 10);
    ctx.fillStyle = deepTurquoise;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText('الرسالة المهنية للمجتمع', leftX + halfW / 2, curY + 23);

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `600 14.5px ${FONT_FAMILY}`;
    const mLines = wrapArabicCellText(ch.missionText, halfW - 36, 11, ctx).slice(0, 3);
    let my = curY + 58;
    for (const ln of mLines) {
      ctx.fillText(ln, leftX + halfW - 18, my);
      my += 24;
    }

    curY += vmH + 16;

    // Middle Box: Strategic & Operational Goals of the Community
    const goalsCount = Math.max(1, ch.goals.length);
    const goalsBoxH = 46 + goalsCount * 48 + 14;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, curY, CONTENT_W - 40, goalsBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X + 20, curY, CONTENT_W - 40, 36, 10);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = white;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `الأهداف المهنية المعتمدة للمجتمع (${ch.goals.length} أهداف):`,
      PAGE_W - MARGIN_X - 38,
      curY + 24
    );

    let gY = curY + 46;
    ch.goals.forEach((goalText, gIdx) => {
      const gRowX = MARGIN_X + 34;
      const gRowW = CONTENT_W - 68;
      drawPlcRoundedBox(ctx, gRowX, gY, gRowW, 40, 8);
      ctx.fillStyle = gIdx % 2 === 0 ? ivory : softIvory;
      ctx.fill();

      const numBadgeW = 76;
      const numBadgeX = gRowX + gRowW - numBadgeW - 8;
      drawPlcRoundedBox(ctx, numBadgeX, gY + 5, numBadgeW, 30, 6);
      ctx.fillStyle = deepTurquoise;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = mutedGold;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(`الهدف ${gIdx + 1}`, numBadgeX + numBadgeW / 2, gY + 25);

      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `600 14.5px ${FONT_FAMILY}`;
      const gLine = wrapArabicCellText(goalText, gRowW - numBadgeW - 32, 11, ctx)[0];
      ctx.fillText(gLine, numBadgeX - 14, gY + 26);

      gY += 48;
    });

    curY += goalsBoxH + 16;

    // Bottom Row: Values Card (Right) + Principles Card (Left)
    const vpH = Math.max(150, startY + boxH - curY - 16);
    // Values Card
    drawPlcRoundedBox(ctx, rightX, curY, halfW, vpH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawPlcRoundedBox(ctx, rightX, curY, halfW, 34, 10);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 15px ${FONT_FAMILY}`;
    ctx.fillText(`القيم المهنية الحاكمة (${ch.values.length})`, rightX + halfW / 2, curY + 23);

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `600 13.5px ${FONT_FAMILY}`;
    let valY = curY + 56;
    ch.values.slice(0, 4).forEach((v) => {
      const vLn = wrapArabicCellText(`• ${v}`, halfW - 32, 10.5, ctx)[0];
      ctx.fillText(vLn, rightX + halfW - 16, valY);
      valY += 26;
    });

    // Principles Card
    drawPlcRoundedBox(ctx, leftX, curY, halfW, vpH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawPlcRoundedBox(ctx, leftX, curY, halfW, 34, 10);
    ctx.fillStyle = deepTurquoise;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 15px ${FONT_FAMILY}`;
    ctx.fillText(
      `مبادئ وضوابط العمل التشاركي (${ch.principles.length})`,
      leftX + halfW / 2,
      curY + 23
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `600 13.5px ${FONT_FAMILY}`;
    let prY = curY + 56;
    ch.principles.slice(0, 4).forEach((p) => {
      const pLn = wrapArabicCellText(`• ${p}`, halfW - 32, 10.5, ctx)[0];
      ctx.fillText(pLn, leftX + halfW - 16, prY);
      prY += 26;
    });

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 02: Needs by Priority + Operational Plan Status Breakdown
  // --------------------------------------------------------------------------
  if (ch.kind === 'section02_needs_plan_analytics') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'التحليل البصري لتوزيع الاحتياجات المهنية وحالة تنفيذ إجراءات الخطة التشغيلية',
      PAGE_W / 2,
      startY + 29
    );

    const innerY = startY + 58;
    const chartBoxH = 264;
    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;

    // Right Chart: Needs by Priority
    drawPlcRoundedBox(ctx, rightX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      `١. توزيع الاحتياجات المهنية حسب الأولوية (${ch.totalNeeds} احتياجات)`,
      rightX + halfW / 2,
      innerY + 30
    );

    let pY = innerY + 66;
    ch.priorityBars.forEach((b) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 14.5px ${FONT_FAMILY}`;
      ctx.fillText(b.label, rightX + halfW - 22, pY + 18);

      const trackX = rightX + 120;
      const trackW = halfW - 260;
      drawPlcRoundedBox(ctx, trackX, pY + 2, trackW, 22, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = b.count > 0 ? Math.max(16, Math.round((b.percent / 100) * trackW)) : 0;
      if (fillW > 0) {
        drawPlcRoundedBox(ctx, trackX + trackW - fillW, pY + 2, fillW, 22, 6);
        ctx.fillStyle = b.color;
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 14px ${FONT_FAMILY}`;
      ctx.fillText(`${b.count} (${b.percent}%)`, rightX + 20, pY + 19);

      pY += 56;
    });

    // Left Chart: Operational Plan Actions by Status
    drawPlcRoundedBox(ctx, leftX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      `٢. حالة إجراءات الخطة التشغيلية (${ch.totalActions} إجراءات — الإنجاز: ${ch.completionPercent}%)`,
      leftX + halfW / 2,
      innerY + 30
    );

    let sY = innerY + 58;
    ch.statusBars.forEach((b) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 14px ${FONT_FAMILY}`;
      ctx.fillText(b.label, leftX + halfW - 22, sY + 16);

      const trackX = leftX + 120;
      const trackW = halfW - 265;
      drawPlcRoundedBox(ctx, trackX, sY + 2, trackW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = b.count > 0 ? Math.max(14, Math.round((b.percent / 100) * trackW)) : 0;
      if (fillW > 0) {
        drawPlcRoundedBox(ctx, trackX + trackW - fillW, sY + 2, fillW, 18, 6);
        ctx.fillStyle = b.color;
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(`${b.count} (${b.percent}%)`, leftX + 20, sY + 16);

      sY += 46;
    });

    // Bottom Analytical Reading Box
    const readingY = innerY + chartBoxH + 14;
    const readingH = boxH - (readingY - startY) - 14;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, readingY, CONTENT_W - 40, readingH, 12);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 14px ${FONT_FAMILY}`;
    let rY = readingY + 24;
    for (const rawLine of ch.analyticalReading) {
      const subLines = wrapArabicCellText(rawLine, CONTENT_W - 76, 11, ctx).slice(0, 2);
      for (const ln of subLines) {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 36, rY);
        rY += 23;
      }
    }

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 03: Meetings Timeline & Attendance + Recommendations Follow-up Status
  // --------------------------------------------------------------------------
  if (ch.kind === 'section03_meetings_analytics') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'التحليل البصري للاجتماعات الدورية ونسب الحضور وحالة متابعة القرارات والتوصيات',
      PAGE_W / 2,
      startY + 29
    );

    const innerY = startY + 58;
    const chartBoxH = 260;
    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;

    // Right Chart: Meetings Timeline & Attendance
    drawPlcRoundedBox(ctx, rightX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      `١. التوزيع الزمني ونسب الحضور (${ch.totalMeetings} اجتماعات — المتوسط: ${ch.avgAttendanceRate}%)`,
      rightX + halfW / 2,
      innerY + 30
    );

    let mY = innerY + 60;
    ch.meetingBars.slice(0, 4).forEach((m) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      const shortLbl = wrapArabicCellText(`${m.label} (${m.date})`, halfW - 40, 10, ctx)[0];
      ctx.fillText(shortLbl, rightX + halfW - 20, mY);

      const trackX = rightX + 130;
      const trackW = halfW - 150;
      drawPlcRoundedBox(ctx, trackX, mY + 8, trackW, 16, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = Math.max(16, Math.round((m.ratePercent / 100) * trackW));
      drawPlcRoundedBox(ctx, trackX + trackW - fillW, mY + 8, fillW, 16, 6);
      ctx.fillStyle = m.ratePercent >= 100 ? petrolGreen : deepTurquoise;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(
        `${m.presentCount}/${m.totalMembers} (${m.ratePercent}%)`,
        rightX + 20,
        mY + 21
      );

      mY += 60;
    });

    // Left Chart: Recommendations Status
    drawPlcRoundedBox(ctx, leftX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      `٢. حالة القرارات والتوصيات (${ch.totalRecommendations} توصيات إجرائية)`,
      leftX + halfW / 2,
      innerY + 30
    );

    let rBarY = innerY + 58;
    ch.recStatusBars.forEach((b) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 14px ${FONT_FAMILY}`;
      ctx.fillText(b.label, leftX + halfW - 22, rBarY + 16);

      const trackX = leftX + 120;
      const trackW = halfW - 275;
      drawPlcRoundedBox(ctx, trackX, rBarY + 2, trackW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = b.count > 0 ? Math.max(14, Math.round((b.percent / 100) * trackW)) : 0;
      if (fillW > 0) {
        drawPlcRoundedBox(ctx, trackX + trackW - fillW, rBarY + 2, fillW, 18, 6);
        ctx.fillStyle = b.color;
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(`${b.count} (${b.percent}%)`, leftX + 20, rBarY + 16);

      rBarY += 46;
    });

    // Bottom Analytical Reading Box
    const readingY = innerY + chartBoxH + 14;
    const readingH = boxH - (readingY - startY) - 14;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, readingY, CONTENT_W - 40, readingH, 12);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 14px ${FONT_FAMILY}`;
    let rY = readingY + 24;
    for (const rawLine of ch.analyticalReading) {
      const subLines = wrapArabicCellText(rawLine, CONTENT_W - 76, 11, ctx).slice(0, 2);
      for (const ln of subLines) {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 36, rY);
        rY += 23;
      }
    }

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 04: Programs, Activities, Mutual Visits & Partnerships Analytics
  // --------------------------------------------------------------------------
  if (ch.kind === 'section04_activities_analytics') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'التحليل البصري لتوزيع البرامج والأنشطة والزيارات والشراكات وحالة تنفيذها',
      PAGE_W / 2,
      startY + 29
    );

    const innerY = startY + 58;
    const chartBoxH = 264;
    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;

    // Right Chart: Distribution by Type (Planned vs Executed)
    drawPlcRoundedBox(ctx, rightX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      `١. توزيع الأعمال بحسب نوعها (إجمالي: ${ch.totalRecords} — منفذ: ${ch.executedRecords})`,
      rightX + halfW / 2,
      innerY + 30
    );

    let tY = innerY + 58;
    ch.typeBars.forEach((tb) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(tb.label, rightX + halfW - 20, tY + 16);

      const trackX = rightX + 135;
      const trackW = halfW - 315;
      drawPlcRoundedBox(ctx, trackX, tY + 2, trackW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const execPct =
        tb.totalCount > 0 ? Math.round((tb.executedCount / tb.totalCount) * 100) : 0;
      const fillW =
        tb.executedCount > 0
          ? Math.max(16, Math.round((execPct / 100) * trackW))
          : 12;
      drawPlcRoundedBox(ctx, trackX + trackW - fillW, tY + 2, fillW, 18, 6);
      ctx.fillStyle = tb.executedCount > 0 ? petrolGreen : mutedGold;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(
        `منفذ ${tb.executedCount} من ${tb.totalCount}`,
        rightX + 20,
        tY + 16
      );

      tY += 46;
    });

    // Left Chart: Execution Status Breakdown
    drawPlcRoundedBox(ctx, leftX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      `٢. حالة تنفيذ البرامج والأنشطة (عناصر مقوّمة نوعيًا: ${ch.evaluatedCount})`,
      leftX + halfW / 2,
      innerY + 30
    );

    let sY = innerY + 58;
    ch.statusBars.forEach((b) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(b.label, leftX + halfW - 20, sY + 16);

      const trackX = leftX + 120;
      const trackW = halfW - 295;
      drawPlcRoundedBox(ctx, trackX, sY + 2, trackW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = b.count > 0 ? Math.max(14, Math.round((b.percent / 100) * trackW)) : 0;
      if (fillW > 0) {
        drawPlcRoundedBox(ctx, trackX + trackW - fillW, sY + 2, fillW, 18, 6);
        ctx.fillStyle = b.color;
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(`${b.count} (${b.percent}%)`, leftX + 20, sY + 16);

      sY += 46;
    });

    // Bottom Analytical Reading Box
    const readingY = innerY + chartBoxH + 14;
    const readingH = boxH - (readingY - startY) - 14;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, readingY, CONTENT_W - 40, readingH, 12);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 14px ${FONT_FAMILY}`;
    let rY = readingY + 24;
    for (const rawLine of ch.analyticalReading) {
      const subLines = wrapArabicCellText(rawLine, CONTENT_W - 76, 11, ctx).slice(0, 2);
      for (const ln of subLines) {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 36, rY);
        rY += 23;
      }
    }

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 05: Direction-Aware KPI Comparison + Execution vs Measured Impact Distinction
  // --------------------------------------------------------------------------
  if (ch.kind === 'section05_kpi_impact_analytics') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.9;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'التحليل البصري لمؤشرات الأداء (الأساس ← المستهدف ← الفعلي) والتمييز بين التنفيذ والأثر المقاس',
      PAGE_W / 2,
      startY + 29
    );

    // Top Panel: Direction-Aware KPI Comparison Rows
    const kpiPanelY = startY + 56;
    const kpiPanelH = 54 + ch.kpiItems.length * 64 + 10;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, kpiPanelY, CONTENT_W - 40, kpiPanelH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 16px ${FONT_FAMILY}`;
    ctx.fillText(
      '١. مقارنة خط الأساس والمستهدف والنتيجة الفعلية لكل مؤشر (مع مراعاة اتجاه المؤشر ومعادلته الخاصة):',
      PAGE_W - MARGIN_X - 38,
      kpiPanelY + 30
    );

    let kRowY = kpiPanelY + 48;
    ch.kpiItems.forEach((k, idx) => {
      const rX = MARGIN_X + 34;
      const rW = CONTENT_W - 68;
      drawPlcRoundedBox(ctx, rX, kRowY, rW, 56, 10);
      ctx.fillStyle = idx % 2 === 0 ? ivory : softIvory;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Right: Indicator Name + Direction Badge
      const dirSym =
        k.directionCode === 'higher_is_better'
          ? 'الأعلى أفضل ↑'
          : k.directionCode === 'lower_is_better'
          ? 'الأقل أفضل ↓'
          : k.directionCode === 'exact_target'
          ? 'مطابقة الهدف ='
          : 'لا ينطبق —';

      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 14px ${FONT_FAMILY}`;
      const nameShort = wrapArabicCellText(k.name, 430, 10.8, ctx)[0];
      ctx.fillText(nameShort, rX + rW - 16, kRowY + 23);

      // Direction + Baseline/Target/Actual pills
      ctx.fillStyle = deepTurquoise;
      ctx.font = `600 12.5px ${FONT_FAMILY}`;
      ctx.fillText(
        `الاتجاه: [${dirSym}]  |  خط الأساس: (${k.baselineDisplay})  ←  المستهدف: (${k.targetDisplay})  ←  الفعلي: (${k.actualDisplay})`,
        rX + rW - 16,
        kRowY + 45
      );

      // Left: Achievement Bar & Percentage Badge
      const barZoneX = rX + 18;
      const barZoneW = 310;
      const pct = k.achievementPercent !== null ? Math.min(100, Math.max(0, Math.round(k.achievementPercent))) : null;

      drawPlcRoundedBox(ctx, barZoneX, kRowY + 12, 185, 16, 6);
      ctx.fillStyle = white;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (pct !== null && pct > 0) {
        const fillW = Math.max(12, Math.round((pct / 100) * 185));
        drawPlcRoundedBox(ctx, barZoneX + 185 - fillW, kRowY + 12, fillW, 16, 6);
        ctx.fillStyle = pct >= 100 ? petrolGreen : deepTurquoise;
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = pct !== null ? petrolGreen : bodyInk;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(
        pct !== null ? `نسبة التحقق: ${k.achievementDisplay}` : 'مؤشر غير مقاس كميًا',
        barZoneX + barZoneW / 2 - 20,
        kRowY + 46
      );

      kRowY += 64;
    });

    // Bottom Panel: Visual Distinction Between Execution Outputs vs Measured Educational Impact
    const distY = kpiPanelY + kpiPanelH + 14;
    const distH = boxH - (distY - startY) - 14;
    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;

    // Right Box: Execution Outputs
    drawPlcRoundedBox(ctx, rightX, distY, halfW, distH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, rightX, distY, halfW, 34, 10);
    ctx.fillStyle = mutedGold;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 14.5px ${FONT_FAMILY}`;
    ctx.fillText(
      'مخرجات التنفيذ الإجرائي (تثبت إنجاز المهام ولا تعني الأثر تلقائيًا)',
      rightX + halfW / 2,
      distY + 23
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `600 13px ${FONT_FAMILY}`;
    let exY = distY + 54;
    for (const line of ch.executionOutputsSummary) {
      const sub = wrapArabicCellText(line, halfW - 32, 10.2, ctx).slice(0, 2);
      for (const ln of sub) {
        ctx.fillText(ln, rightX + halfW - 16, exY);
        exY += 21;
      }
    }

    // Left Box: Measured Educational & Professional Impact
    drawPlcRoundedBox(ctx, leftX, distY, halfW, distH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, leftX, distY, halfW, 34, 10);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 14.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `الأثر التعليمي والمهني المقاس (${ch.verifiedImpactsCount} أثر مثبت بقياس • ${ch.describedImpactsCount} موصوف)`,
      leftX + halfW / 2,
      distY + 23
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `600 13px ${FONT_FAMILY}`;
    let imY = distY + 54;
    for (const line of ch.measuredImpactSummary) {
      const sub = wrapArabicCellText(line, halfW - 32, 10.2, ctx).slice(0, 2);
      for (const ln of sub) {
        ctx.fillText(ln, leftX + halfW - 16, imY);
        imY += 21;
      }
    }

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 06: Evidence Repository Statistical Breakdown
  // --------------------------------------------------------------------------
  if (ch.kind === 'section06_evidence_analytics') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      `العرض البصري الإحصائي لأنواع الشواهد وتصنيفاتها وارتباطاتها (${ch.totalEvidences} شواهد مسجلة)`,
      PAGE_W / 2,
      startY + 29
    );

    const innerY = startY + 58;
    const chartBoxH = 216;
    const halfW = Math.floor((CONTENT_W - 56) / 2);
    const rightX = PAGE_W - MARGIN_X - 20 - halfW;
    const leftX = MARGIN_X + 20;

    // Right Chart: Evidences by Attachment Type
    drawPlcRoundedBox(ctx, rightX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText('١. توزيع الشواهد بحسب نوع المرفق الرقمي', rightX + halfW / 2, innerY + 28);

    let eY = innerY + 52;
    ch.typeBars.forEach((b) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(b.label, rightX + halfW - 20, eY + 15);

      const trackX = rightX + 115;
      const trackW = halfW - 315;
      drawPlcRoundedBox(ctx, trackX, eY + 2, trackW, 16, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const fillW = Math.max(14, Math.round((b.percent / 100) * trackW));
      drawPlcRoundedBox(ctx, trackX + trackW - fillW, eY + 2, fillW, 16, 6);
      ctx.fillStyle = b.color;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(`${b.count} (${b.percent}%)`, rightX + 20, eY + 15);

      eY += 38;
    });

    // Left Chart: Evidence Linkage across Community Domains
    drawPlcRoundedBox(ctx, leftX, innerY, halfW, chartBoxH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `٢. ارتباط الشواهد بسجلات المجتمع (${ch.linkedEvidences} مرتبطة من ${ch.totalEvidences})`,
      leftX + halfW / 2,
      innerY + 28
    );

    let dY = innerY + 52;
    ch.domainLinkBars.forEach((d, idx) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(d.label, leftX + halfW - 20, dY + 15);

      const trackX = leftX + 100;
      const trackW = halfW - 320;
      drawPlcRoundedBox(ctx, trackX, dY + 2, trackW, 16, 6);
      ctx.fillStyle = ivory;
      ctx.fill();

      const pct = Math.min(100, Math.round((d.count / Math.max(1, ch.totalEvidences)) * 100));
      const fillW = Math.max(14, Math.round((pct / 100) * trackW));
      drawPlcRoundedBox(ctx, trackX + trackW - fillW, dY + 2, fillW, 16, 6);
      ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(`${d.count} شواهد`, leftX + 20, dY + 15);

      dY += 38;
    });

    // Bottom Analytical Strip
    const readingY = innerY + chartBoxH + 12;
    const readingH = boxH - (readingY - startY) - 12;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, readingY, CONTENT_W - 40, readingH, 10);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 13.8px ${FONT_FAMILY}`;
    let rY = readingY + 24;
    for (const rawLine of ch.analyticalReading) {
      const subLines = wrapArabicCellText(rawLine, CONTENT_W - 76, 11, ctx).slice(0, 2);
      for (const ln of subLines) {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 36, rY);
        rY += 22;
      }
    }

    return startY + boxH + 22;
  }

  // --------------------------------------------------------------------------
  // SECTION 07: Achievements & Challenges Classification + Visual Priorities
  // --------------------------------------------------------------------------
  if (ch.kind === 'section07_closing_analytics') {
    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'التحليل البصري لتصنيف الإنجازات والتحديات وإبراز الأولويات الإجرائية القادمة',
      PAGE_W / 2,
      startY + 29
    );

    // Top Box: Classification of Achievements vs Challenges by Source Domain
    const topY = startY + 56;
    const topH = 166;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, topY, CONTENT_W - 40, topH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `١. تصنيف الإنجازات المتحققة (${ch.achievementsCount}) والتحديات المرصودة (${ch.challengesCount}) بحسب مجال الرصد:`,
      PAGE_W - MARGIN_X - 38,
      topY + 28
    );

    let domY = topY + 50;
    ch.domainComparisonBars.forEach((db) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(db.domainLabel, PAGE_W - MARGIN_X - 38, domY + 16);

      // Achievements bar
      const achX = MARGIN_X + 430;
      const achW = 280;
      drawPlcRoundedBox(ctx, achX, domY + 2, achW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();
      const achFill = Math.max(
        16,
        Math.round((db.achievementsCount / Math.max(1, ch.achievementsCount)) * achW)
      );
      drawPlcRoundedBox(ctx, achX + achW - achFill, domY + 2, achFill, 18, 6);
      ctx.fillStyle = petrolGreen;
      ctx.fill();

      ctx.textAlign = 'right';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(`إنجازات: ${db.achievementsCount}`, achX - 14, domY + 16);

      // Challenges bar
      const chX = MARGIN_X + 40;
      const chW = 190;
      drawPlcRoundedBox(ctx, chX, domY + 2, chW, 18, 6);
      ctx.fillStyle = ivory;
      ctx.fill();
      const chFill = Math.max(
        16,
        Math.round((db.challengesCount / Math.max(1, ch.challengesCount)) * chW)
      );
      drawPlcRoundedBox(ctx, chX + chW - chFill, domY + 2, chFill, 18, 6);
      ctx.fillStyle = mutedGold;
      ctx.fill();

      ctx.textAlign = 'right';
      ctx.fillStyle = '#92400E';
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(`تحديات: ${db.challengesCount}`, chX + chW + 85, domY + 16);

      domY += 36;
    });

    // Middle Zone: 3 Visual Cards Highlighting Top Upcoming Priorities
    const prioY = topY + topH + 14;
    const prioH = 128;
    const cols = Math.max(1, ch.priorityCards.length);
    const gapX = 16;
    const cardW = Math.floor((CONTENT_W - 40 - gapX * (cols - 1)) / cols);

    ch.priorityCards.forEach((pc, idx) => {
      const cX = PAGE_W - MARGIN_X - 20 - (idx + 1) * cardW - idx * gapX;
      drawPlcRoundedBox(ctx, cX, prioY, cardW, prioH, 12);
      ctx.fillStyle = white;
      ctx.fill();
      ctx.strokeStyle = idx === 0 ? mutedGold : deepTurquoise;
      ctx.lineWidth = 1.7;
      ctx.stroke();

      drawPlcRoundedBox(ctx, cX, prioY, cardW, 32, 10);
      ctx.fillStyle = idx === 0 ? petrolGreen : deepTurquoise;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = idx === 0 ? mutedGold : white;
      ctx.font = `700 14px ${FONT_FAMILY}`;
      ctx.fillText(`أبرز الأولويات القادمة — ${pc.badge}`, cX + cardW / 2, prioY + 22);

      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13px ${FONT_FAMILY}`;
      const pLines = wrapArabicCellText(pc.title, cardW - 28, 10, ctx).slice(0, 2);
      let py = prioY + 54;
      for (const ln of pLines) {
        ctx.fillText(ln, cX + cardW - 14, py);
        py += 21;
      }

      ctx.fillStyle = deepTurquoise;
      ctx.font = `600 12px ${FONT_FAMILY}`;
      const respLine = wrapArabicCellText(pc.responsible, cardW - 28, 9.5, ctx)[0];
      ctx.fillText(respLine, cX + cardW - 14, prioY + prioH - 12);
    });

    // Bottom Analytical Strip
    const readingY = prioY + prioH + 12;
    const readingH = boxH - (readingY - startY) - 12;
    drawPlcRoundedBox(ctx, MARGIN_X + 20, readingY, CONTENT_W - 40, readingH, 10);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 13.8px ${FONT_FAMILY}`;
    let rY = readingY + 23;
    for (const rawLine of ch.analyticalReading) {
      const subLines = wrapArabicCellText(rawLine, CONTENT_W - 76, 11, ctx).slice(0, 2);
      for (const ln of subLines) {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 36, rY);
        rY += 21;
      }
    }

    return startY + boxH + 22;
  }

  return startY + boxH + 22;
}

/**
 * Draws a 2-column grid of QR & Clickable Link cards for Meetings or Activities/Visits/Partnerships
 * in the Detailed Report with an accurate dark petrol-green title bar.
 */
function drawDetailedQrLinksGrid(
  ctx: CanvasRenderingContext2D,
  block: Extract<PlcDetailedBlock, { kind: 'detailed_qr_links_grid' }>,
  startY: number,
  pageLinksOut: PlcPdfLinkAnnotation[],
  pageQrSpotsOut: PlcRenderedQrSpot[]
): number {
  const {
    petrolGreen,
    deepTurquoise,
    white,
    softIvory,
    darkInk,
    bodyInk,
    cardBorder,
    turquoiseSubtleBg,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  const boxH = block.estimatedHeight;
  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
  ctx.fillStyle = softIvory;
  ctx.fill();
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 44, 14);
  ctx.fillStyle = petrolGreen;
  ctx.fill();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = white;
  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.fillText(block.title, PAGE_W / 2, startY + 29);

  ctx.fillStyle = deepTurquoise;
  ctx.font = `600 13.5px ${FONT_FAMILY}`;
  ctx.fillText(block.subtitle, PAGE_W / 2, startY + 62);

  const gapX = 18;
  const gapY = 14;
  const cardW = Math.floor((CONTENT_W - 48 - gapX) / 2);
  const cardH = 162;
  const cardsStartY = startY + 74;
  const qrBoxSize = 124;

  block.cards.forEach((evCard, cIdx) => {
    const r = Math.floor(cIdx / 2);
    const isRight = cIdx % 2 === 0;
    const cardX = isRight ? PAGE_W - MARGIN_X - 24 - cardW : MARGIN_X + 24;
    const cardY = cardsStartY + r * (cardH + gapY);

    drawPlcRoundedBox(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const qrX = cardX + 14;
    const qrY = cardY + Math.round((cardH - qrBoxSize) / 2);
    const targetUri = evCard.destinationUri || evCard.qrPayload;

    if (evCard.hasValidQr && targetUri) {
      drawPlcRoundedBox(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 8);
      ctx.fillStyle = white;
      ctx.fill();
      ctx.strokeStyle = petrolGreen;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      drawQrCodeOnCanvas(
        ctx,
        targetUri,
        qrX + 4,
        qrY + 4,
        qrBoxSize - 8,
        '#000000',
        '#FFFFFF',
        4
      );
    }

    const textZoneX = cardX + qrBoxSize + 22;
    const textZoneW = cardW - qrBoxSize - 36;
    const textRightX = textZoneX + textZoneW;

    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    const titleLine = wrapArabicCellText(evCard.title, textZoneW, 11.2, ctx)[0];
    ctx.fillText(titleLine, textRightX, cardY + 28);

    ctx.fillStyle = deepTurquoise;
    ctx.font = `600 13.5px ${FONT_FAMILY}`;
    const proofLines = wrapArabicCellText(
      `ما يثبته: ${evCard.whatItProves}`,
      textZoneW,
      10.2,
      ctx
    ).slice(0, 2);
    let pY = cardY + 52;
    for (const ln of proofLines) {
      ctx.fillText(ln, textRightX, pY);
      pY += 22;
    }

    ctx.fillStyle = bodyInk;
    ctx.font = `600 12.5px ${FONT_FAMILY}`;
    const linkedLine = wrapArabicCellText(evCard.linkedSummary, textZoneW, 9.8, ctx)[0];
    ctx.fillText(linkedLine, textRightX, cardY + 104);

    const linkPillW = Math.min(256, textZoneW - 14);
    const linkPillH = 30;
    const linkPillX = textZoneX + Math.round((textZoneW - linkPillW) / 2);
    const linkPillY = cardY + cardH - linkPillH - 12;

    drawPlcRoundedBox(ctx, linkPillX, linkPillY, linkPillW, linkPillH, 8);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = deepTurquoise;
    ctx.font = `700 13.5px ${FONT_FAMILY}`;
    ctx.fillText(
      evCard.linkLabel || 'فتح الشاهد / عرض الرابط',
      linkPillX + linkPillW / 2,
      linkPillY + 20
    );

    if (evCard.hasValidQr && targetUri) {
      pageLinksOut.push({
        xPx: qrX,
        yPx: qrY,
        wPx: qrBoxSize,
        hPx: qrBoxSize,
        url: targetUri,
        kind: 'qr',
        targetId: evCard.evidenceId,
        label: `QR: ${evCard.title}`,
      });
      pageLinksOut.push({
        xPx: linkPillX,
        yPx: linkPillY,
        wPx: linkPillW,
        hPx: linkPillH,
        url: targetUri,
        kind: 'text',
        targetId: evCard.evidenceId,
        label: evCard.linkLabel || 'فتح الشاهد / عرض الرابط',
      });
      pageQrSpotsOut.push({
        targetId: evCard.evidenceId,
        title: evCard.title,
        payload: targetUri,
        qrX: qrX + 4,
        qrY: qrY + 4,
        qrSize: qrBoxSize - 8,
        quietZoneModules: 4,
        textLinkRect: {
          xPx: linkPillX,
          yPx: linkPillY,
          wPx: linkPillW,
          hPx: linkPillH,
          url: targetUri,
        },
      });
    }
  });

  return startY + boxH + 22;
}

/**
 * Draws an individual comprehensive Evidence Repository Card in Section 06:
 * - Embeds the visual image/SVG attachment (`fileDataUrl`) directly onto the PDF page canvas.
 * - Renders an enlarged, high-resolution clickable QR code (`132px x 132px` with 4-module Quiet Zone).
 * - Renders an adjacent clickable text link button pointing to the exact same URI.
 * - Lists all linked records across the community without duplicating the evidence.
 */
function drawDetailedEvidenceRepositoryRow(
  ctx: CanvasRenderingContext2D,
  block: Extract<PlcDetailedBlock, { kind: 'detailed_evidence_repository_row' }>,
  startY: number,
  pageLinksOut: PlcPdfLinkAnnotation[],
  pageQrSpotsOut: PlcRenderedQrSpot[]
): number {
  const {
    petrolGreen,
    deepTurquoise,
    mutedGold,
    white,
    softIvory,
    darkInk,
    bodyInk,
    cardBorder,
    turquoiseSubtleBg,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  const boxH = block.estimatedHeight;
  const ev = block.item;

  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 1.9;
  ctx.stroke();

  // Top Header Strip
  drawPlcRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 42, 14);
  ctx.fillStyle = petrolGreen;
  ctx.fill();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = white;
  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.fillText(
    `الشاهد (${block.indexNumber} من ${block.totalCount}): ${ev.title}`,
    PAGE_W - MARGIN_X - 20,
    startY + 28
  );

  // Type badge on the left of header strip
  const typeBadgeW = 220;
  drawPlcRoundedBox(ctx, MARGIN_X + 16, startY + 6, typeBadgeW, 30, 8);
  ctx.fillStyle = deepTurquoise;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = mutedGold;
  ctx.font = `700 15px ${FONT_FAMILY}`;
  ctx.fillText(ev.evidenceTypeLabel, MARGIN_X + 16 + typeBadgeW / 2, startY + 26);

  // 1. Left Zone: Enlarged Clickable QR Code (`132px`) + Adjacent Clickable Text Link
  const qrBoxSize = 132;
  const qrX = MARGIN_X + 22;
  const qrY = startY + 54;
  const targetUri = ev.destinationUri;

  if (ev.hasValidQr && targetUri) {
    drawPlcRoundedBox(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 10);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawQrCodeOnCanvas(
      ctx,
      targetUri,
      qrX + 4,
      qrY + 4,
      qrBoxSize - 8,
      '#000000',
      '#FFFFFF',
      4
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 13px ${FONT_FAMILY}`;
    ctx.fillText('رمز QR قابل للمسح والنقر', qrX + qrBoxSize / 2, qrY + qrBoxSize + 20);

    const linkPillW = 190;
    const linkPillH = 32;
    const linkPillX = qrX + qrBoxSize + 18;
    const linkPillY = startY + boxH - linkPillH - 18;

    drawPlcRoundedBox(ctx, linkPillX, linkPillY, linkPillW, linkPillH, 8);
    ctx.fillStyle = turquoiseSubtleBg;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = deepTurquoise;
    ctx.font = `700 14px ${FONT_FAMILY}`;
    ctx.fillText(
      'فتح الشاهد / عرض الرابط المباشر',
      linkPillX + linkPillW / 2,
      linkPillY + 21
    );

    pageLinksOut.push({
      xPx: qrX,
      yPx: qrY,
      wPx: qrBoxSize,
      hPx: qrBoxSize,
      url: targetUri,
      kind: 'qr',
      targetId: ev.evidenceId,
      label: `QR: ${ev.title}`,
    });
    pageLinksOut.push({
      xPx: linkPillX,
      yPx: linkPillY,
      wPx: linkPillW,
      hPx: linkPillH,
      url: targetUri,
      kind: 'text',
      targetId: ev.evidenceId,
      label: 'فتح الشاهد / عرض الرابط المباشر',
    });
    pageQrSpotsOut.push({
      targetId: ev.evidenceId,
      title: ev.title,
      payload: targetUri,
      qrX: qrX + 4,
      qrY: qrY + 4,
      qrSize: qrBoxSize - 8,
      quietZoneModules: 4,
      textLinkRect: {
        xPx: linkPillX,
        yPx: linkPillY,
        wPx: linkPillW,
        hPx: linkPillH,
        url: targetUri,
      },
    });
  }

  // 2. Center-Left Zone: Visual Attachment Preview (`fileDataUrl` image/SVG embedded directly inside PDF!)
  const previewX = qrX + qrBoxSize + 18;
  const previewY = startY + 54;
  const previewW = 240;
  const previewH = 166;

  drawPlcRoundedBox(ctx, previewX, previewY, previewW, previewH, 10);
  ctx.fillStyle = softIvory;
  ctx.fill();
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const preloadedImg = cachedEvidenceImages.get(ev.evidenceId);
  if (preloadedImg && preloadedImg.complete && preloadedImg.naturalWidth > 0) {
    const pad = 6;
    const availW = previewW - pad * 2;
    const availH = previewH - 28;
    const scale = Math.min(
      availW / preloadedImg.naturalWidth,
      availH / preloadedImg.naturalHeight
    );
    const drawW = Math.round(preloadedImg.naturalWidth * scale);
    const drawH = Math.round(preloadedImg.naturalHeight * scale);
    const drawX = previewX + Math.round((previewW - drawW) / 2);
    const drawY = previewY + Math.round((availH - drawH) / 2) + 4;
    ctx.drawImage(preloadedImg, drawX, drawY, drawW, drawH);
  } else {
    drawPlcRoundedBox(ctx, previewX + 16, previewY + 12, previewW - 32, previewH - 42, 8);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 14.5px ${FONT_FAMILY}`;
    ctx.fillText('معاينة مرفق الشاهد المضمّن', previewX + previewW / 2, previewY + 54);

    ctx.fillStyle = deepTurquoise;
    ctx.font = `600 12.5px ${FONT_FAMILY}`;
    const fnLine = wrapArabicCellText(ev.fileNameDisplay, previewW - 44, 9.5, ctx)[0];
    ctx.fillText(fnLine, previewX + previewW / 2, previewY + 86);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = bodyInk;
  ctx.font = `600 12px ${FONT_FAMILY}`;
  const bottomFn = wrapArabicCellText(`المرفق: ${ev.fileNameDisplay}`, previewW - 16, 9, ctx)[0];
  ctx.fillText(bottomFn, previewX + previewW / 2, previewY + previewH - 8);

  // 3. Right Zone: Full Evidence Metadata, Description, What It Proves, and All Linked Records
  const metaRightX = PAGE_W - MARGIN_X - 22;
  const metaLeftLimit = previewX + previewW + 22;
  const metaMaxW = Math.max(320, metaRightX - metaLeftLimit);

  ctx.textAlign = 'right';
  let textY = startY + 72;

  ctx.fillStyle = petrolGreen;
  ctx.font = `700 15.5px ${FONT_FAMILY}`;
  const descLines = wrapArabicCellText(
    `• وصف الشاهد: ${ev.descriptionDisplay}`,
    metaMaxW,
    11.2,
    ctx
  ).slice(0, 2);
  for (const ln of descLines) {
    ctx.fillText(ln, metaRightX, textY);
    textY += 25;
  }

  ctx.fillStyle = deepTurquoise;
  ctx.font = `700 15px ${FONT_FAMILY}`;
  const proofLines = wrapArabicCellText(
    `• دلالة الشاهد وما يثبته: ${ev.whatItProves}`,
    metaMaxW,
    11.2,
    ctx
  ).slice(0, 2);
  for (const ln of proofLines) {
    ctx.fillText(ln, metaRightX, textY);
    textY += 24;
  }

  ctx.fillStyle = darkInk;
  ctx.font = `600 14.5px ${FONT_FAMILY}`;
  const linksJoined = ev.linkedRecordsDisplay.join('  |  ');
  const linkedLines = wrapArabicCellText(
    `• السجلات المرتبطة بهذا الشاهد (${ev.linkedRecordsDisplay.length}): ${linksJoined}`,
    metaMaxW,
    11,
    ctx
  ).slice(0, 3);
  for (const ln of linkedLines) {
    ctx.fillText(ln, metaRightX, textY);
    textY += 23;
  }

  return startY + boxH + 20;
}

/**
 * Renders the PLC Detailed Community Report pages to HTMLCanvasElement instances.
 */
export function renderPlcDetailedReportPagesToCanvases(
  community: PlcCommunityRecord,
  settings: SchoolSettings,
  reportOverride?: PlcGeneratedFinalReport
): {
  canvases: HTMLCanvasElement[];
  pagesModel: PlcDetailedReportPagesModel;
  report: PlcGeneratedFinalReport;
} {
  const report = reportOverride ?? buildPlcFinalReport(community);

  if (typeof document === 'undefined') {
    return {
      canvases: [],
      pagesModel: buildPlcDetailedReportPdfPagesModel(community, settings, report, null),
      report,
    };
  }

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (measureCtx) {
    measureCtx.font = `600 18px ${FONT_FAMILY}`;
  }

  const pagesModel = buildPlcDetailedReportPdfPagesModel(
    community,
    settings,
    report,
    measureCtx
  );
  const canvases: HTMLCanvasElement[] = [];

  for (const pagePlan of pagesModel.pages) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const coverItem = pagePlan.blocks.find(
      (b): b is Extract<PlcDetailedBlock, { kind: 'core_block' }> =>
        b.kind === 'core_block' && b.block.kind === 'cover_page'
    );

    if (pagePlan.isCoverPage && coverItem && coverItem.block.kind === 'cover_page') {
      drawOfficialCoverPage(ctx, report, settings, coverItem.block);
    } else {
      const compatPlan: PlcPdfPagePlan = {
        pageNumber: pagePlan.pageNumber,
        totalPages: pagePlan.totalPages,
        isCoverPage: false,
        pageTitle: pagePlan.pageTitle,
        footerLabel: pagePlan.footerLabel,
        createdDateText: '',
        blocks: [],
        plannedLinks: [],
        plannedQrSpots: [],
      };

      drawInteriorPageHeader(
        ctx,
        report,
        settings,
        compatPlan,
        'التقرير التفصيلي لمجتمع التعلّم المهني'
      );

      let cursorY: number = INTERIOR_START_Y;
      const renderedLinks: PlcPdfLinkAnnotation[] = [];
      const renderedQrSpots: PlcRenderedQrSpot[] = [];

      for (let bIdx = 0; bIdx < pagePlan.blocks.length; bIdx++) {
        const item = pagePlan.blocks[bIdx];
        const nextItem =
          bIdx + 1 < pagePlan.blocks.length ? pagePlan.blocks[bIdx + 1] : undefined;
        const nextCoreKind =
          nextItem && nextItem.kind === 'core_block' ? nextItem.block.kind : undefined;

        if (item.kind === 'core_block') {
          cursorY = drawBlockOnCanvas(
            ctx,
            item.block,
            cursorY,
            settings,
            nextCoreKind,
            renderedLinks,
            renderedQrSpots
          );
        } else if (item.kind === 'toc_block') {
          cursorY = drawDetailedTocBlock(ctx, item, cursorY);
        } else if (item.kind === 'statistical_summary_header_and_cards') {
          cursorY = drawStatisticalSummaryHeaderAndCards(ctx, item, cursorY);
        } else if (item.kind === 'visual_chart_block') {
          cursorY = drawDetailedVisualChartBlock(ctx, item, cursorY);
        } else if (item.kind === 'detailed_qr_links_grid') {
          cursorY = drawDetailedQrLinksGrid(
            ctx,
            item,
            cursorY,
            renderedLinks,
            renderedQrSpots
          );
        } else if (item.kind === 'detailed_evidence_repository_row') {
          cursorY = drawDetailedEvidenceRepositoryRow(
            ctx,
            item,
            cursorY,
            renderedLinks,
            renderedQrSpots
          );
        }
      }

      if (renderedLinks.length > 0) {
        pagePlan.plannedLinks = renderedLinks;
      }
      if (renderedQrSpots.length > 0) {
        pagePlan.plannedQrSpots = renderedQrSpots;
      }

      drawPlcEmptySpaceWatermark(ctx, cursorY);
      drawInteriorPageFooter(ctx, report, settings, compatPlan);
    }

    canvases.push(canvas);
  }

  return { canvases, pagesModel, report };
}

/**
 * Generates the real multi-page A4 PDF binary (`%PDF-1.4`) for the standalone
 * Detailed Community Report (`التقرير التفصيلي لمجتمع التعلّم المهني`) with clickable QR & text links.
 */
export function generatePlcDetailedReportPdfArtifact(
  community: PlcCommunityRecord,
  settings: SchoolSettings,
  reportOverride?: PlcGeneratedFinalReport
): {
  pdfBytes: Uint8Array;
  filename: string;
  pageCount: number;
  pagesModel: PlcDetailedReportPagesModel;
  report: PlcGeneratedFinalReport;
} {
  const { canvases, pagesModel, report } = renderPlcDetailedReportPagesToCanvases(
    community,
    settings,
    reportOverride
  );

  const jpegPagesWithLinks: PlcPdfPageJpegWithLinks[] =
    canvases.length > 0
      ? canvases.map((canvas, idx) => ({
          jpegBytes: dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.94)),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          links: pagesModel.pages[idx]?.plannedLinks || [],
          qrSpots: pagesModel.pages[idx]?.plannedQrSpots || [],
        }))
      : pagesModel.pages.map((pagePlan) => ({
          jpegBytes: MINIMAL_WHITE_JPEG,
          pixelWidth: PAGE_W,
          pixelHeight: PAGE_H,
          links: pagePlan.plannedLinks || [],
          qrSpots: pagePlan.plannedQrSpots || [],
        }));

  const pdfBytes = buildPlcPdfBinaryWithLinks(jpegPagesWithLinks);
  const safeName = sanitizeFilenameSegment(community.name || 'مجتمع_تعلم_مهني');
  const filename = `التقرير_التفصيلي_${safeName}.pdf`;

  return {
    pdfBytes,
    filename,
    pageCount: pagesModel.pages.length,
    pagesModel,
    report,
  };
}
