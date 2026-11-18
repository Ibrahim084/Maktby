import { SchoolSettings } from '../types';
import {
  buildPlcFinalReport,
  PlcCommunityRecord,
  PlcFinalReportChartModel,
  PlcGeneratedFinalReport,
} from './plcEngine';
import { drawQrCodeOnCanvas } from './qrCodeGenerator';
import {
  getGenderedLabels,
} from './settingsStorage';
import { sanitizeFilenameSegment } from './zipBuilder';

/**
 * Centralized Design System for the PLC Final Report (Model 9)
 * Shared between the PDF canvas renderer, the Detailed Report generator,
 * and the on-screen React preview (`PlcBatch5FinalReport.tsx`).
 *
 * Palette:
 * - Petrol Green (`#153C43`): Primary color for titles, headers, and official identity.
 * - Deep Turquoise (`#145B59`): Secondary sections and analytical elements.
 * - Muted Gold (`#C5A15D`): Highlight and accent only (not dominant).
 * - Ivory (`#F2EFE7`): Calm background areas when needed.
 * - White (`#FFFFFF`): Data and table cell backgrounds.
 */
export const PLC_REPORT_DESIGN_SYSTEM = {
  colors: {
    petrolGreen: '#153C43',
    deepTurquoise: '#145B59',
    mutedGold: '#C5A15D',
    ivory: '#F2EFE7',
    white: '#FFFFFF',
    softIvory: '#F8F6F1',
    darkInk: '#0D262A',
    bodyInk: '#153C43',
    mutedInk: '#35565B',
    tableBorder: '#7E999D',
    cardBorder: '#B8C9CB',
    goldSubtleBg: '#F9F4E8',
    turquoiseSubtleBg: '#EBF3F2',
  },
  fonts: {
    family: '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
    coverMainTitlePx: 48,
    coverCommunityNamePx: 34,
    sectionNumberPx: 30,
    sectionTitlePx: 25,
    kpiValuePx: 26,
    tableHeaderPx: 17,
    tableCellPx: 16,
    bodyPx: 17,
    footerPageNumPx: 20,
  },
  borders: {
    outerFrameWidth: 3.5,
    innerFrameWidth: 1.6,
    tableBorderWidth: 1.8,
    cardBorderWidth: 1.8,
    goldAccentWidth: 3,
    radiusLg: 20,
    radiusMd: 14,
    radiusSm: 10,
  },
  spacing: {
    pageWidth: 1654,
    pageHeight: 2339,
    marginX: 82,
    interiorHeaderTopY: 52,
    interiorHeaderHeight: 146,
    interiorContentStartY: 260, // 62px clear whitespace below header (52 + 146 = 198 -> 260)
    footerReserveHeight: 148,
    blockGap: 20,
    tableGap: 32, // Generous separation between consecutive tables
  },
} as const;

// Minimal 1x1 white JPEG for Node.js unit-test fallback when HTMLCanvasElement is unavailable
export const MINIMAL_WHITE_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03,
  0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03,
  0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06, 0x06, 0x05, 0x06, 0x09,
  0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a, 0x0b,
  0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10,
  0x0a, 0x0c, 0x12, 0x13, 0x12, 0x10, 0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0,
  0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
  0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x7f, 0x9f, 0xff, 0xd9,
]);

const PAGE_W = PLC_REPORT_DESIGN_SYSTEM.spacing.pageWidth;
const PAGE_H = PLC_REPORT_DESIGN_SYSTEM.spacing.pageHeight;
const MARGIN_X = PLC_REPORT_DESIGN_SYSTEM.spacing.marginX;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const INTERIOR_START_Y = PLC_REPORT_DESIGN_SYSTEM.spacing.interiorContentStartY;
const FOOTER_RESERVE_H = PLC_REPORT_DESIGN_SYSTEM.spacing.footerReserveHeight;
const MAX_CONTENT_Y = PAGE_H - FOOTER_RESERVE_H;
const FONT_FAMILY = PLC_REPORT_DESIGN_SYSTEM.fonts.family;

// Preloaded official Saudi Ministry of Education logo (`./moe-logo.png`)
let cachedMoeLogoImage: HTMLImageElement | null = null;
let moeLogoLoadingPromise: Promise<HTMLImageElement | null> | null = null;

export function preloadPlcMoeLogo(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  if (cachedMoeLogoImage && cachedMoeLogoImage.complete && cachedMoeLogoImage.naturalWidth > 0) {
    return Promise.resolve(cachedMoeLogoImage);
  }
  if (moeLogoLoadingPromise) {
    return moeLogoLoadingPromise;
  }

  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  moeLogoLoadingPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedMoeLogoImage = img;
      resolve(img);
    };
    img.onerror = () => {
      moeLogoLoadingPromise = null;
      resolve(null);
    };
    img.src = `${normalizedBase}moe-logo.png`;
  });

  return moeLogoLoadingPromise;
}

export function getCachedPlcMoeLogo(): HTMLImageElement | null {
  return cachedMoeLogoImage;
}

// Trigger preload immediately in browser environments
if (typeof window !== 'undefined') {
  void preloadPlcMoeLogo();
}

export interface PlcPdfLinkAnnotation {
  xPx: number;
  yPx: number;
  wPx: number;
  hPx: number;
  url: string;
  kind: 'qr' | 'text';
  targetId: string;
  label: string;
}

export interface PlcRenderedQrSpot {
  targetId: string;
  title: string;
  payload: string;
  qrX: number;
  qrY: number;
  qrSize: number;
  quietZoneModules: number;
  textLinkRect: {
    xPx: number;
    yPx: number;
    wPx: number;
    hPx: number;
    url: string;
  };
}

export interface PlcPdfPageJpegWithLinks {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  links: PlcPdfLinkAnnotation[];
  qrSpots: PlcRenderedQrSpot[];
}

export interface PlcCoverMetadataItem {
  label: string;
  value: string;
}

export interface PlcKpiStatCardItem {
  label: string;
  value: string;
  sublabel: string;
  tone: 'petrol' | 'turquoise' | 'gold' | 'ivory';
}

export interface PlcSelectedEvidenceCardItem {
  evidenceId: string;
  title: string;
  typeLabel: string;
  whatItProves: string;
  linkedSummary: string;
  qrPayload?: string;
  destinationUri?: string;
  linkLabel?: string;
  hasValidQr: boolean;
}

export interface PlcTraceabilityChainStage {
  stepNumber: string;
  stageTitle: string;
  headline: string;
  detailLines: string[];
  tone: 'petrol' | 'turquoise' | 'gold' | 'ivory';
}

export interface PlcHighlightedNoteItem {
  prefix: string;
  text: string;
  prefixColorHex: string;
}

export interface PlcTeamMemberCardItem {
  memberId: string;
  name: string;
  roleLabel: string;
  specialty: string;
  isLeader: boolean;
}

export interface PlcDonutIndicatorItem {
  id: string;
  title: string;
  percentage: number;
  centerPrimaryText: string;
  centerSecondaryText: string;
  completedLabel: string;
  remainingLabel: string;
  ringColorHex: string;
  secondaryRingColorHex: string;
}

export interface PlcCategoryDistributionItem {
  id: string;
  label: string;
  executedCount: number;
  totalCount: number;
  percentage: number;
  colorHex: string;
}

export interface PlcTargetActualComparisonItem {
  id: string;
  label: string;
  baselineDisplay: string;
  targetValue: number;
  actualValue: number;
  unitDisplay: string;
  achievementPercentage: number;
  directionLabel: string;
}

export type PlcPdfBlock =
  | {
      kind: 'cover_page';
      sectionCode: string;
      pageGroup: number;
      reportMainTitle?: string;
      reportBadgeLabel?: string;
      communityNameLines: string[];
      specialtyLines: string[];
      academicYear: string;
      semesterLabel: string;
      leaderName: string;
      leaderRoleLabel: string;
      principalName: string;
      principalRoleLabel: string;
      membersCount: number;
      venueDisplay: string;
      visionLines: string[];
      metadataItems: PlcCoverMetadataItem[];
      estimatedHeight: number;
    }
  | {
      kind: 'section_header';
      sectionCode: string;
      pageGroup: number;
      sectionNumber: string;
      title: string;
      subtitle?: string;
      badgeText?: string;
      estimatedHeight: number;
    }
  | {
      kind: 'kpi_stat_cards';
      sectionCode: string;
      pageGroup: number;
      cards: PlcKpiStatCardItem[];
      estimatedHeight: number;
    }
  | {
      kind: 'traceability_chain';
      sectionCode: string;
      pageGroup: number;
      title: string;
      subtitle: string;
      stages: PlcTraceabilityChainStage[];
      estimatedHeight: number;
    }
  | {
      kind: 'kv_grid';
      sectionCode: string;
      pageGroup: number;
      items: Array<{ label: string; valueLines: string[] }>;
      columns: 2 | 3 | 4;
      rowHeights: number[];
      estimatedHeight: number;
    }
  | {
      kind: 'paragraphs_box';
      sectionCode: string;
      pageGroup: number;
      title?: string;
      lines: string[];
      highlightedNotes?: PlcHighlightedNoteItem[];
      tone?: 'neutral' | 'emerald' | 'amber' | 'indigo' | 'maroon';
      centerAligned?: boolean;
      estimatedHeight: number;
    }
  | {
      kind: 'team_members_cards';
      sectionCode: string;
      pageGroup: number;
      title: string;
      members: PlcTeamMemberCardItem[];
      estimatedHeight: number;
    }
  | {
      kind: 'impact_distinction_strip';
      sectionCode: string;
      pageGroup: number;
      items: Array<{
        title: string;
        metric: string;
        descriptionLines: string[];
        tone: 'slate' | 'amber' | 'emerald';
      }>;
      estimatedHeight: number;
    }
  | {
      kind: 'table';
      sectionCode: string;
      pageGroup: number;
      title?: string;
      subtitleNote?: string;
      headers: string[];
      columnWeightPercents: number[];
      wrappedRows: string[][][];
      rowHeights: number[];
      headerHeight: number;
      estimatedHeight: number;
    }
  | {
      kind: 'chart';
      sectionCode: string;
      pageGroup: number;
      chart: PlcFinalReportChartModel;
      wrappedItemLabels: string[][];
      itemRowHeights: number[];
      analyticalReadingLines?: string[];
      estimatedHeight: number;
    }
  | {
      kind: 'dual_charts';
      sectionCode: string;
      pageGroup: number;
      rightChart: PlcFinalReportChartModel;
      leftChart: PlcFinalReportChartModel;
      analyticalParagraphLines?: string[];
      chartsHeight: number;
      estimatedHeight: number;
    }
  | {
      kind: 'page2_visual_analytics';
      sectionCode: string;
      pageGroup: number;
      donuts: PlcDonutIndicatorItem[];
      categoryDistributions: PlcCategoryDistributionItem[];
      targetVsActualItems: PlcTargetActualComparisonItem[];
      needsPrioritySummary: {
        high: number;
        medium: number;
        low: number;
        totalNeeds: number;
        totalGoals: number;
        verifiedImpacts: number;
      };
      estimatedHeight: number;
    }
  | {
      kind: 'selected_evidences_qr_grid';
      sectionCode: string;
      pageGroup: number;
      registeredCount: number;
      selectedCount: number;
      summaryLine: string;
      typeBreakdownLine: string;
      cards: PlcSelectedEvidenceCardItem[];
      estimatedHeight: number;
    }
  | {
      kind: 'official_signoff_block';
      sectionCode: string;
      pageGroup: number;
      signoffHeading: string;
      closingStatementLines: string[];
      leaderTitle: string;
      leaderName: string;
      leaderSpecialty: string;
      stampLabel: string;
      principalTitle: string;
      principalName: string;
      schoolName: string;
      estimatedHeight: number;
    };

export interface PlcPdfPagePlan {
  pageNumber: number;
  totalPages: number;
  isCoverPage?: boolean;
  pageTitle: string;
  footerLabel: string;
  createdDateText: string;
  blocks: PlcPdfBlock[];
  plannedLinks: PlcPdfLinkAnnotation[];
  plannedQrSpots: PlcRenderedQrSpot[];
}

export interface PlcFinalReportPagesModel {
  communityId: string;
  communityName: string;
  reportTitle: string;
  generatedDateDisplay: string;
  pages: PlcPdfPagePlan[];
  sectionsIncluded: string[];
  allTextTokens: string[];
}

/**
 * Deterministic Arabic/RTL text wrapper that works in both Canvas 2D and Node.js environments
 * and guarantees that long strings never overflow the allocated column width.
 */
export function wrapArabicCellText(
  text: string,
  maxWidthPx: number,
  approxCharWidthPx = 11.5,
  ctx?: CanvasRenderingContext2D | null
): string[] {
  const normalized = (text || 'غير متوفر').replace(/\r\n/g, '\n').trim() || 'غير متوفر';
  const safeMaxW = Math.max(60, maxWidthPx - 28);
  const maxCharsPerLine = Math.max(6, Math.floor(safeMaxW / approxCharWidthPx));

  const measureFits = (candidate: string): boolean => {
    if (candidate.length > maxCharsPerLine) {
      return false;
    }
    if (ctx) {
      return ctx.measureText(candidate).width <= safeMaxW * 0.9;
    }
    return true;
  };

  const splitOversizedWord = (word: string): string[] => {
    if (measureFits(word)) return [word];
    const parts: string[] = [];
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (!measureFits(next) && chunk.length > 0) {
        parts.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  };

  const result: string[] = [];
  const paragraphs = normalized.split('\n');

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const rawWords = trimmed.split(/\s+/);
    const words: string[] = [];
    for (const w of rawWords) {
      words.push(...splitOversizedWord(w));
    }

    let currentLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (!measureFits(candidate)) {
        result.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result.length > 0 ? result : ['غير متوفر'];
}

function buildTableBlock(
  sectionCode: string,
  pageGroup: number,
  headers: string[],
  weights: number[],
  rows: string[][],
  title?: string,
  subtitleNote?: string,
  ctx?: CanvasRenderingContext2D | null,
  maxLinesPerCell?: number
): PlcPdfBlock[] {
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 100;
  const colWidths = weights.map((w) => Math.floor((w / totalWeight) * CONTENT_W));
  const lineH = 28;
  const headerH = 52;

  const allWrappedRows: string[][][] = [];
  const allRowHeights: number[] = [];

  for (const row of rows) {
    const wrappedCells: string[][] = headers.map((_, colIdx) => {
      const rawCell = row[colIdx] ?? 'غير متوفر';
      const lines = wrapArabicCellText(rawCell, colWidths[colIdx] - 12, 11.4, ctx);
      return maxLinesPerCell && lines.length > maxLinesPerCell
        ? lines.slice(0, maxLinesPerCell)
        : lines;
    });
    const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
    const rHeight = Math.max(48, maxLines * lineH + 20);
    allWrappedRows.push(wrappedCells);
    allRowHeights.push(rHeight);
  }

  const maxChunkHeight = MAX_CONTENT_Y - INTERIOR_START_Y - 120;
  const blocks: PlcPdfBlock[] = [];

  let chunkWrappedRows: string[][][] = [];
  let chunkRowHeights: number[] = [];
  const titleOverhead = (title ? 44 : 0) + (subtitleNote ? 30 : 0);
  let currentHeight = headerH + titleOverhead + 24;
  let chunkIndex = 0;

  for (let i = 0; i < allWrappedRows.length; i++) {
    const rH = allRowHeights[i];
    if (chunkWrappedRows.length > 0 && currentHeight + rH > maxChunkHeight) {
      blocks.push({
        kind: 'table',
        sectionCode,
        pageGroup,
        title: chunkIndex === 0 ? title : title ? `${title} (تابع)` : undefined,
        subtitleNote: chunkIndex === 0 ? subtitleNote : undefined,
        headers,
        columnWeightPercents: weights,
        wrappedRows: chunkWrappedRows,
        rowHeights: chunkRowHeights,
        headerHeight: headerH,
        estimatedHeight: currentHeight,
      });
      chunkWrappedRows = [];
      chunkRowHeights = [];
      currentHeight = headerH + (title ? 44 : 0) + 24;
      chunkIndex += 1;
    }
    chunkWrappedRows.push(allWrappedRows[i]);
    chunkRowHeights.push(rH);
    currentHeight += rH;
  }

  if (chunkWrappedRows.length > 0) {
    blocks.push({
      kind: 'table',
      sectionCode,
      pageGroup,
      title: chunkIndex === 0 ? title : title ? `${title} (تابع)` : undefined,
      subtitleNote: chunkIndex === 0 ? subtitleNote : undefined,
      headers,
      columnWeightPercents: weights,
      wrappedRows: chunkWrappedRows,
      rowHeights: chunkRowHeights,
      headerHeight: headerH,
      estimatedHeight: currentHeight,
    });
  }

  return blocks;
}

function buildParagraphBox(
  sectionCode: string,
  pageGroup: number,
  rawLines: string[],
  title?: string,
  tone: 'neutral' | 'emerald' | 'amber' | 'indigo' | 'maroon' = 'neutral',
  ctx?: CanvasRenderingContext2D | null,
  centerAligned = false,
  highlightedNotes?: PlcHighlightedNoteItem[]
): PlcPdfBlock {
  const wrappedLines: string[] = [];
  for (const line of rawLines) {
    const subLines = wrapArabicCellText(line, CONTENT_W - 88, 12.2, ctx);
    wrappedLines.push(...subLines);
  }
  const safeLines = wrappedLines.length > 0 ? wrappedLines : ['غير متوفر'];
  const titleH = title ? 40 : 0;

  let notesHeight = 0;
  if (highlightedNotes && highlightedNotes.length > 0) {
    for (const note of highlightedNotes) {
      const combined = `${note.prefix}: ${note.text}`;
      const noteSubLines = wrapArabicCellText(combined, CONTENT_W - 88, 12.2, ctx).slice(0, 2);
      notesHeight += noteSubLines.length * 29 + 6;
    }
  }

  const estimatedHeight =
    titleH +
    (highlightedNotes && highlightedNotes.length > 0
      ? notesHeight + 26
      : safeLines.length * 29 + 28);

  return {
    kind: 'paragraphs_box',
    sectionCode,
    pageGroup,
    title,
    lines: safeLines,
    highlightedNotes,
    tone,
    centerAligned,
    estimatedHeight,
  };
}

function buildSingleChartBlock(
  sectionCode: string,
  pageGroup: number,
  chart: PlcFinalReportChartModel,
  ctx?: CanvasRenderingContext2D | null,
  rawAnalyticalReadingLines?: string[]
): PlcPdfBlock {
  const wrappedReadingLines: string[] = [];
  if (rawAnalyticalReadingLines && rawAnalyticalReadingLines.length > 0) {
    for (const line of rawAnalyticalReadingLines) {
      wrappedReadingLines.push(
        ...wrapArabicCellText(line, CONTENT_W - 88, 11.8, ctx).slice(0, 2)
      );
    }
  }
  const readingExtraH =
    wrappedReadingLines.length > 0 ? wrappedReadingLines.length * 26 + 24 : 0;

  if (!chart.hasSufficientData) {
    return {
      kind: 'chart',
      sectionCode,
      pageGroup,
      chart,
      wrappedItemLabels: [],
      itemRowHeights: [],
      analyticalReadingLines:
        wrappedReadingLines.length > 0 ? wrappedReadingLines : undefined,
      estimatedHeight: 112 + readingExtraH,
    };
  }

  const labelMaxW = 390;
  const wrappedItemLabels = chart.items.map((it) =>
    wrapArabicCellText(it.label, labelMaxW, 11.2, ctx).slice(0, 2)
  );
  const itemRowHeights = wrappedItemLabels.map((lines) =>
    Math.max(48, lines.length * 26 + 20)
  );
  const totalRowsH = itemRowHeights.reduce((a, b) => a + b, 0);

  return {
    kind: 'chart',
    sectionCode,
    pageGroup,
    chart,
    wrappedItemLabels,
    itemRowHeights,
    analyticalReadingLines:
      wrappedReadingLines.length > 0 ? wrappedReadingLines : undefined,
    estimatedHeight: 88 + totalRowsH + 18 + readingExtraH,
  };
}

/**
 * Selects the most meaningful evidences (up to 4) for the concise final report without duplicating
 * the full evidence repository or repeating the same item across sections.
 * Guarantees that `qrPayload` and `destinationUri` point to the exact same target URI.
 */
export function selectKeyEvidencesForExecutiveReport(
  report: PlcGeneratedFinalReport
): PlcSelectedEvidenceCardItem[] {
  const rows = report.section9_9.rows;
  if (rows.length === 0) return [];

  // Prioritize evidences linked to Impact or KPIs, then those with valid QR codes
  const scored = [...rows].map((row, idx) => {
    const joinedLinks = row.linkedRecordsDisplay.join(' ');
    let score = 0;
    if (joinedLinks.includes('أثر')) score += 30;
    if (joinedLinks.includes('مؤشر')) score += 20;
    if (row.hasValidQr) score += 15;
    if (row.linkedRecordsCount > 1) score += 10;
    return { row, score, idx };
  });

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));

  return scored.slice(0, 4).map(({ row }) => {
    const cleanWhatItProves = (
      row.whatItProvesSummary ||
      (row.descriptionDisplay !== 'غير متوفر'
        ? row.descriptionDisplay
        : 'يوثق تنفيذ ومخرجات أعمال المجتمع المهني')
    )
      .replace(/التنفيذي/g, 'العام')
      .replace(/التنفيذية/g, 'العملية');

    const unifiedUri = row.hasValidQr && row.qrPayload ? row.qrPayload : undefined;

    return {
      evidenceId: row.evidenceId,
      title: row.title,
      typeLabel: row.evidenceTypeLabel,
      whatItProves: cleanWhatItProves,
      linkedSummary: row.linkedRecordsDisplay.slice(0, 2).join(' • '),
      qrPayload: unifiedUri,
      destinationUri: unifiedUri,
      linkLabel: 'فتح الشاهد / عرض الرابط',
      hasValidQr: Boolean(unifiedUri),
    };
  });
}

/**
 * Resolves the unified destination URI for a selected evidence item so that both
 * its QR code and its adjacent clickable text link point to the exact same URI.
 */
export function resolveEvidenceActionUri(ev: PlcSelectedEvidenceCardItem): string {
  return ev.destinationUri || ev.qrPayload || `#/plc?evidenceId=${encodeURIComponent(ev.evidenceId)}`;
}

/**
 * Strips any occurrence of the prohibited words `التنفيذي` / `التنفيذية` / `تنفيذي` / `تنفيذية`
 * from generated text in the Concise Final Report.
 */
function sanitizeExecutiveWord(text: string): string {
  return (text || '')
    .replace(/الملخص التنفيذي/g, 'الملخص العام')
    .replace(/التقرير التنفيذي/g, 'التقرير المختصر')
    .replace(/تلخيص تنفيذي/g, 'أبرز الأعمال والنتائج')
    .replace(/الملاحظات التنفيذية/g, 'الملاحظات الختامية')
    .replace(/خلاصة تنفيذية/g, 'خلاصة')
    .replace(/التنفيذي/g, 'العام')
    .replace(/التنفيذية/g, 'المباشرة')
    .replace(/تنفيذيًا/g, 'عمليًا')
    .replace(/تنفيذي/g, 'عملي')
    .replace(/تنفيذية/g, 'عملية');
}

/**
 * Builds the 6-page pagination plan for the PLC Concise Final Report (Model 9):
 * - Page 1: Official Cover Page (4 separate centered identity lines below logo, improved vertical centering, bottom two cards contain ONLY the two names).
 * - Page 2: `01 الملخص العام للمجتمع` (zero occurrence of `التنفيذي`, balanced stat cards, right-aligned bulleted summary, dual charts + analytical paragraph below charts).
 * - Page 3: `02 أبرز الإنجازات والممارسات المنفذة` (`أبرز الأعمال والنتائج`, right-aligned bulleted achievements, numbered `١. ٢. ٣.` right-aligned meetings summary, and separate individual cards for each team member).
 * - Page 4: `03 مؤشرات الأداء المهنية (KPIs)` (KPI comparison table, KPI chart + analytical reading directly below chart respecting indicator direction, and right-aligned per-indicator reading lines).
 * - Page 5: `04 قياس الأثر والشواهد المختارة` (explicit `${registeredCount} شواهد مسجلة، ${selectedCount} شواهد مختارة للعرض`, enlarged high-res clickable QR codes + clickable text links to the exact same URI).
 * - Page 6: `05 التحديات والتوصيات والخطوات القادمة` (recommendations table without `الاستحقاق`/dates, right-aligned concise closing notes with highlighted sub-headings `خلاصة`, `التشخيص الدقيق للاحتياجات`, `الأولويات القادمة`, and 3-part Sign-off & unframed `الختم`).
 */
export function buildPlcFinalReportPdfPagesModel(
  report: PlcGeneratedFinalReport,
  settings?: SchoolSettings,
  ctx?: CanvasRenderingContext2D | null
): PlcFinalReportPagesModel {
  const rawBlocks: PlcPdfBlock[] = [];
  const textTokens: string[] = [];
  const recordToken = (t: string | undefined | null) => {
    if (t && t.trim()) textTokens.push(sanitizeExecutiveWord(t.trim()));
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

  const schoolNameDisplay = settings?.schoolName?.trim() || 'غير محدد';
  const eduDeptDisplay = settings?.educationDepartment?.trim() || 'إدارة التعليم';
  const principalNameDisplay = settings?.principalName?.trim() || 'غير محدد';
  const genderedLabels = getGenderedLabels(settings?.gender);

  // Record domain tokens for verification & searchability
  recordToken('التقرير النهائي لمجتمع التعلّم المهني');
  recordToken('التقرير الختامي لمجتمع التعلّم المهني');
  recordToken(report.communityName);
  recordToken(schoolNameDisplay);
  recordToken(eduDeptDisplay);
  recordToken(s1.leaderNameDisplay);
  recordToken(s1.specialty);
  recordToken(s1.academicYear);
  recordToken(s1.semesterLabel);
  recordToken(report.completeness.overallSummaryText);

  const isRichCommunity =
    s4.totalActionsCount > 0 ||
    s6.totalRecordsCount > 0 ||
    s7.kpiRows.length > 0 ||
    s8.totalImpactRecordsCount > 0;

  // ==========================================================================
  // PAGE 1 (pageGroup 0): الغلاف الرسمي المستقل والمتوازن بصريًا
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
      : s2.missionDisplay !== 'بيانات هذا القسم غير مكتملة.'
      ? s2.missionDisplay
      : 'تطوير الممارسات التدريسية التشاركية وتحسين نواتج التعلّم المبنية على الدليل.',
    CONTENT_W - 160,
    12.5,
    ctx
  ).slice(0, 3);

  rawBlocks.push({
    kind: 'cover_page',
    sectionCode: '9.1',
    pageGroup: 0,
    reportMainTitle: 'التقرير النهائي لمجتمع التعلّم المهني',
    reportBadgeLabel: 'وثيقة مدرسية رسمية • مجتمعات التعلّم المهنية',
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
  });

  // ==========================================================================
  // PAGE 2 (pageGroup 1): 01 الملخص العام للمجتمع (بدون كلمة "التنفيذي")
  // ==========================================================================
  const executedActivitiesCount =
    s6.byType.program.executed +
    s6.byType.activity.executed +
    s6.byType.mutual_visit.executed +
    s6.byType.community_partnership.executed;

  const achievedKpisCount = s7.kpiRows.filter(
    (k) => k.isCalculated && k.achievementPercentage !== null && k.achievementPercentage >= 100
  ).length;
  const calculatedKpisCount = s7.kpiRows.filter((k) => k.isCalculated).length;
  const completedRecsCount = s5.recommendationsRows.filter(
    (r) => r.followupStatus === 'completed'
  ).length;
  const selectedEvidences = selectKeyEvidencesForExecutiveReport(report);

  rawBlocks.push({
    kind: 'section_header',
    sectionCode: '9.0',
    pageGroup: 1,
    sectionNumber: '01',
    title: 'الملخص العام للمجتمع',
    subtitle: `بطاقة قراءة شاملة لحصيلة عمل المجتمع المهني (${report.completeness.completedSectionsCount} من ${report.completeness.totalSectionsCount} مجالات توثيق مكتملة)`,
    badgeText: `الحالة: ${s1.statusLabel}`,
    estimatedHeight: 92,
  });

  rawBlocks.push({
    kind: 'kpi_stat_cards',
    sectionCode: '9.0',
    pageGroup: 1,
    cards: [
      {
        label: 'عدد الاجتماعات الموثقة',
        value: `${s5.totalMeetingsCount}`,
        sublabel: `توصيات منجزة: ${completedRecsCount} من ${s5.recommendationsRows.length}`,
        tone: 'petrol',
      },
      {
        label: 'البرامج والأنشطة المنفذة',
        value: `${executedActivitiesCount} / ${s6.totalRecordsCount}`,
        sublabel: `برامج • أنشطة • زيارات • شراكات`,
        tone: 'turquoise',
      },
      {
        label: 'مؤشرات الأداء المتحققة',
        value: `${achievedKpisCount} / ${s7.kpiRows.length}`,
        sublabel: `${calculatedKpisCount} مؤشرات مقاسة كميًا`,
        tone: 'petrol',
      },
      {
        label: 'نسبة تنفيذ الخطة',
        value: s4.completionDisplay,
        sublabel: `مكتمل: ${s4.completedCount} من ${s4.totalActionsCount} إجراءات`,
        tone: 'gold',
      },
      {
        label: 'الشواهد المختارة للعرض',
        value: `${selectedEvidences.length} / ${s9.totalEvidencesCount}`,
        sublabel: `${s9.totalEvidencesCount} شواهد مسجلة (${s9.linkedEvidencesCount} مرتبطة)`,
        tone: 'turquoise',
      },
      {
        label: 'سجلات قياس الأثر',
        value: `${s8.totalImpactRecordsCount}`,
        sublabel: `${s8.verifiedImpactsCount} أثر تعليمي مقاس ومثبت`,
        tone: 'petrol',
      },
    ],
    estimatedHeight: 208,
  });

  // مسار بصري مهم: الاحتياج ← الهدف ← الإجراء ← النتيجة
  if (s2.visionDisplay && s2.visionDisplay !== 'بيانات هذا القسم غير مكتملة.') {
    recordToken(s2.visionDisplay);
  }
  if (s2.missionDisplay && s2.missionDisplay !== 'بيانات هذا القسم غير مكتملة.') {
    recordToken(s2.missionDisplay);
  }
  s2.goals.forEach((g) => recordToken(g.text));
  recordToken(s3.traceabilitySummary);

  const stageW = Math.floor((CONTENT_W - 60) / 4) - 16;
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
  const verifiedImpactRows = s8.rows.filter((r) => r.classification === 'verified_impact');
  const primaryResultText =
    verifiedImpactRows.length > 0
      ? `${verifiedImpactRows[0].impactDescriptionDisplay} [${verifiedImpactRows[0].baselineDisplay} ← ${verifiedImpactRows[0].actualResultDisplay}]`
      : s7.kpiRows.length > 0
      ? `تحقق ${achievedKpisCount} من ${s7.kpiRows.length} مؤشرات أداء بنسبة تنفيذ خطة ${s4.completionDisplay}`
      : sanitizeExecutiveWord(report.generalAnalysis.planExecutionLevelText);

  if (verifiedImpactRows.length > 0) {
    verifiedImpactRows.forEach((v) => recordToken(v.impactDescriptionDisplay));
  }
  report.generalAnalysis.paragraphs.forEach(recordToken);

  rawBlocks.push({
    kind: 'traceability_chain',
    sectionCode: '9.2',
    pageGroup: 1,
    title: 'مسار الترابط التخطيطي: الاحتياج ← الهدف ← الإجراء ← النتيجة',
    subtitle: `${sanitizeExecutiveWord(s3.traceabilitySummary)} • إجمالي الاحتياجات (${s3.totalNeedsCount}) • الأهداف (${s2.goals.length}) • الإجراءات (${s4.totalActionsCount})`,
    stages: [
      {
        stepNumber: '١',
        stageTitle: 'الاحتياج',
        headline: `الاحتياجات المرصودة (${s3.totalNeedsCount})`,
        detailLines: wrapArabicCellText(primaryNeedText, stageW, 10.5, ctx).slice(0, 3),
        tone: 'petrol',
      },
      {
        stepNumber: '٢',
        stageTitle: 'الهدف',
        headline: `الأهداف المعتمدة (${s2.goals.length})`,
        detailLines: wrapArabicCellText(primaryGoalText, stageW, 10.5, ctx).slice(0, 3),
        tone: 'turquoise',
      },
      {
        stepNumber: '٣',
        stageTitle: 'الإجراء',
        headline: `تنفيذ الخطة (${s4.completionDisplay})`,
        detailLines: wrapArabicCellText(primaryActionText, stageW, 10.5, ctx).slice(0, 3),
        tone: 'gold',
      },
      {
        stepNumber: '٤',
        stageTitle: 'النتيجة',
        headline:
          s8.verifiedImpactsCount > 0
            ? `أثر مقاس (${s8.verifiedImpactsCount})`
            : `مؤشرات متحققة (${achievedKpisCount})`,
        detailLines: wrapArabicCellText(primaryResultText, stageW, 10.5, ctx).slice(0, 3),
        tone: 'petrol',
      },
    ],
    estimatedHeight: 242,
  });

  // 2.3: تحويل نص الخلاصة إلى نقاط مختصرة، كل فكرة في سطر مستقل، بمحاذاة إلى اليمين
  const summaryBulletLines: string[] = [
    `• محور عمل المجتمع المهني: ${sanitizeExecutiveWord(
      s2.visionDisplay !== 'بيانات هذا القسم غير مكتملة.' ? s2.visionDisplay : s1.specialty
    )}`,
    `• مسار تنفيذ الخطة التشغيلية: ${sanitizeExecutiveWord(report.generalAnalysis.planExecutionLevelText)}`,
    `• حصيلة المؤشرات والأثر: ${sanitizeExecutiveWord(report.generalAnalysis.kpisStatusText)}`,
  ];

  rawBlocks.push(
    buildParagraphBox(
      '9.3',
      1,
      summaryBulletLines,
      'الخلاصة العامة للأداء',
      'emerald',
      ctx,
      false // محاذاة إلى اليمين
    )
  );

  // 2.3: رسم بياني مزدوج مختصر + فقرة تحليلية مختصرة أسفل الرسمين البيانيين تستند إلى بياناتهما الفعلية دون تكرار نصي لأرقام البطاقات
  if (
    s13.operationalPlanStatusChart.hasSufficientData ||
    s13.activitiesByStatusChart.hasSufficientData
  ) {
    const rightChart = s13.operationalPlanStatusChart;
    const leftChart = s13.activitiesByStatusChart.hasSufficientData
      ? s13.activitiesByStatusChart
      : s13.needsByPriorityChart;

    const topRightItem = [...rightChart.items].sort((a, b) => b.value - a.value)[0];
    const topLeftItem = [...leftChart.items].sort((a, b) => b.value - a.value)[0];

    const chartAnalyticalRaw =
      topRightItem && topLeftItem
        ? `قراءة تحليلية للرسمين البيانيين: يُظهر التوزيع البياني تركز إجراءات الخطة في فئة «${topRightItem.label}» بالتوازي مع تصدّر فئة «${topLeftItem.label}» في سجل الممارسات، مما يعكس اتساق التنفيذ الميداني مع المسار التخطيطي المعتمد واستقرار وتيرة الإنجاز الدوري.`
        : 'قراءة تحليلية للرسمين البيانيين: يعكس التوزيع البياني لحالات الخطة التشغيلية والأنشطة المنفذة توازنًا بين التخطيط والتطبيق الفعلي داخل المجتمع المهني.';

    recordToken(chartAnalyticalRaw);

    const wrappedChartParagraph = wrapArabicCellText(
      chartAnalyticalRaw,
      CONTENT_W - 88,
      11.8,
      ctx
    ).slice(0, 2);

    const chartsH = 254;
    const paragraphBoxH = wrappedChartParagraph.length * 26 + 24;

    rawBlocks.push({
      kind: 'dual_charts',
      sectionCode: '9.4',
      pageGroup: 1,
      rightChart,
      leftChart,
      analyticalParagraphLines: wrappedChartParagraph,
      chartsHeight: chartsH,
      estimatedHeight: chartsH + paragraphBoxH + 10,
    });
  }

  // استثمار المساحة السفلية في الصفحة الثانية برسوم حلقية (Donut Charts) ومؤشرات دائرية وتوزيع تصنيفي ومقارنة المستهدف بالمتحقق
  const page2Donuts: PlcDonutIndicatorItem[] = [];
  if (s4.totalActionsCount > 0 && s4.completionPercentage !== null) {
    const pct = Math.max(0, Math.min(100, Math.round(s4.completionPercentage)));
    page2Donuts.push({
      id: 'donut_plan_completion',
      title: 'مؤشر إنجاز الخطة التشغيلية',
      percentage: pct,
      centerPrimaryText: `${pct}%`,
      centerSecondaryText: `${s4.completedCount}/${s4.totalActionsCount} إجراءات`,
      completedLabel: `مكتمل: ${s4.completedCount}`,
      remainingLabel: `قيد المتابعة/التنفيذ: ${s4.totalActionsCount - s4.completedCount}`,
      ringColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
      secondaryRingColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
    });
  }
  if (calculatedKpisCount > 0) {
    const kpiPct = Math.max(
      0,
      Math.min(100, Math.round((achievedKpisCount / calculatedKpisCount) * 100))
    );
    page2Donuts.push({
      id: 'donut_kpi_achievement',
      title: 'مؤشر تحقق المستهدفات القياسية',
      percentage: kpiPct,
      centerPrimaryText: `${kpiPct}%`,
      centerSecondaryText: `${achievedKpisCount}/${calculatedKpisCount} مؤشرات`,
      completedLabel: `بلغ المستهدف: ${achievedKpisCount}`,
      remainingLabel: `تحقق جزئي: ${calculatedKpisCount - achievedKpisCount}`,
      ringColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise,
      secondaryRingColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
    });
  }
  if (s5.recommendationsRows.length > 0) {
    const recPct = Math.max(
      0,
      Math.min(100, Math.round((completedRecsCount / s5.recommendationsRows.length) * 100))
    );
    page2Donuts.push({
      id: 'donut_meetings_recommendations',
      title: 'مؤشر تنفيذ قرارات الاجتماعات',
      percentage: recPct,
      centerPrimaryText: `${recPct}%`,
      centerSecondaryText: `${completedRecsCount}/${s5.recommendationsRows.length} توصيات`,
      completedLabel: `منجز: ${completedRecsCount}`,
      remainingLabel: `قيد المتابعة: ${s5.recommendationsRows.length - completedRecsCount}`,
      ringColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold,
      secondaryRingColorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
    });
  }

  const categoryDistributions: PlcCategoryDistributionItem[] =
    s6.totalRecordsCount > 0
      ? [
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
            label: 'الزيارات المتبادلة',
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
            label: 'الشراكات المجتمعية',
            executedCount: s6.byType.community_partnership.executed,
            totalCount: s6.byType.community_partnership.total,
            percentage:
              s6.totalRecordsCount > 0
                ? Math.round(
                    (s6.byType.community_partnership.total / s6.totalRecordsCount) * 100
                  )
                : 0,
            colorHex: PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen,
          },
        ]
      : [];

  const targetVsActualItems: PlcTargetActualComparisonItem[] = s7.kpiRows
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

  if (
    isRichCommunity &&
    (page2Donuts.length > 0 ||
      categoryDistributions.length > 0 ||
      targetVsActualItems.length > 0)
  ) {
    rawBlocks.push({
      kind: 'page2_visual_analytics',
      sectionCode: '9.13',
      pageGroup: 1,
      donuts: page2Donuts,
      categoryDistributions,
      targetVsActualItems,
      needsPrioritySummary: {
        high: s3.priorityDistribution.high,
        medium: s3.priorityDistribution.medium,
        low: s3.priorityDistribution.low,
        totalNeeds: s3.totalNeedsCount,
        totalGoals: s2.goals.length,
        verifiedImpacts: s8.verifiedImpactsCount,
      },
      estimatedHeight: 590,
    });
  }

  // ==========================================================================
  // PAGE 3 (pageGroup 2): 02 أبرز الإنجازات والممارسات المنفذة
  // - استبدال «تلخيص تنفيذي» بـ «أبرز الأعمال والنتائج»
  // - تحويل جميع الملخصات إلى نقاط واضحة، كل فكرة في سطر مستقل، بمحاذاة إلى اليمين
  // - تنظيم «حصيلة الاجتماعات» في نقاط مرقمة (١.، ٢.، ٣.) كل نقطة في سطر مستقل بمحاذاة اليمين
  // - عرض أسماء فريق المجتمع في بطاقات منفصلة، كل اسم في بطاقة مستقلة
  // ==========================================================================
  const group2 = isRichCommunity ? 2 : 1;

  rawBlocks.push({
    kind: 'section_header',
    sectionCode: '9.6',
    pageGroup: group2,
    sectionNumber: '02',
    title: 'أبرز الإنجازات والممارسات المنفذة',
    subtitle:
      'أبرز الأعمال والنتائج لما خطط له المجتمع ونفذه من برامج وزيارات تبادلية وشراكات وإجراءات تشغيلية',
    badgeText: `تنفيذ الخطة: ${s4.completionDisplay}`,
    estimatedHeight: 92,
  });
  recordToken('أبرز الأعمال والنتائج');

  // أبرز الأعمال والنتائج في نقاط واضحة بمحاذاة اليمين
  const conciseAchievementsLines =
    s10.items.length > 0
      ? s10.items
          .slice(0, 4)
          .map((it) => `• ${sanitizeExecutiveWord(it.statement)}`)
      : [`• ${sanitizeExecutiveWord(s10.emptyMessage)}`];
  s10.items.forEach((it) => recordToken(it.statement));

  rawBlocks.push(
    buildParagraphBox(
      '9.10',
      group2,
      conciseAchievementsLines,
      '١. أبرز الأعمال والنتائج المحققة',
      'emerald',
      ctx,
      false // محاذاة إلى اليمين
    )
  );

  // جدول مختصر للبرامج والأنشطة والزيارات والشراكات وأبرز مخرجاتها (بدون كلمة التنفيذية)
  if (s6.rows.length > 0) {
    rawBlocks.push(
      ...buildTableBlock(
        '9.6',
        group2,
        [
          'الممارسة / البرنامج المنفذ',
          'النوع والفئة المستهدفة',
          'حالة التنفيذ',
          'أبرز المخرجات والنتائج المباشرة',
        ],
        [28, 22, 14, 36],
        s6.rows.map((r) => {
          recordToken(r.title);
          recordToken(r.executiveResultsDisplay);
          return [
            r.title,
            `${r.typeLabel} — ${r.targetAudienceDisplay}`,
            r.statusLabel,
            sanitizeExecutiveWord(r.executiveResultsDisplay),
          ];
        }),
        '٢. جدول البرامج والأنشطة والزيارات المتبادلة والشراكات المنفذة',
        undefined,
        ctx,
        2
      )
    );
  }

  // جدول مختصر للخطة التشغيلية ومسار التتبع
  if (s4.rows.length > 0) {
    rawBlocks.push(
      ...buildTableBlock(
        '9.4',
        group2,
        ['الإجراء التشغيلي', 'الهدف المرتبط', 'المسؤول والفترة', 'الحالة والإنجاز'],
        [28, 34, 22, 16],
        s4.rows.map((r) => {
          recordToken(r.actionTitle);
          recordToken(r.responsibleDisplay);
          recordToken(r.needsDisplay);
          return [
            r.actionTitle,
            `${r.goalDisplay}`,
            `${r.responsibleDisplay} (${r.periodDisplay})`,
            `${r.statusLabel} (${r.completionDisplay})`,
          ];
        }),
        '٣. جدول تنفيذ إجراءات الخطة التشغيلية',
        undefined,
        ctx,
        2
      )
    );
  }

  // ٤. تنظيم «حصيلة الاجتماعات» في نقاط مرقمة (١.، ٢.، ٣.) كل نقطة في سطر مستقل بمحاذاة إلى اليمين
  const arabicNumerals = ['١', '٢', '٣', '٤', '٥', '٦'];
  const meetingsNumberedLines: string[] = [];
  if (s5.totalMeetingsCount > 0) {
    const typesSummary = s5.meetingsByType.map((t) => `${t.meetingType} (${t.count})`).join('، ');
    const topicsSummary =
      s5.keyTopics.slice(0, 3).join(' • ') || 'متابعة الخطة وتطوير الممارسات الصفية';
    meetingsNumberedLines.push(
      `${arabicNumerals[0]}. عقد (${s5.totalMeetingsCount}) اجتماعات مهنية رسمية [${typesSummary}] بإجمالي حضور موثق (${s5.totalPresentEntries}) مشاركًا.`
    );
    meetingsNumberedLines.push(
      `${arabicNumerals[1]}. ناقشت الاجتماعات محاور رئيسة شملت: ${sanitizeExecutiveWord(topicsSummary)}.`
    );
    meetingsNumberedLines.push(
      `${arabicNumerals[2]}. صدر عن الاجتماعات (${s5.recommendationsRows.length}) قرارات وتوصيات إجرائية، أُنجز منها (${completedRecsCount}) توصيات مكتملة المتابعة.`
    );
    s5.recommendationsRows.forEach((rec) => {
      recordToken(rec.recommendationText);
      recordToken(rec.responsibleDisplay);
      recordToken(rec.linkedActionDisplay);
    });
  } else {
    meetingsNumberedLines.push(
      '١. لم تُسجل اجتماعات رسمية في هذا المجتمع حتى تاريخ إعداد التقرير.'
    );
  }
  meetingsNumberedLines.forEach(recordToken);

  rawBlocks.push(
    buildParagraphBox(
      '9.5',
      group2,
      meetingsNumberedLines,
      '٤. حصيلة الاجتماعات المهنية',
      'neutral',
      ctx,
      false // محاذاة إلى اليمين
    )
  );

  // ٥. عرض أسماء فريق المجتمع في بطاقات منفصلة، كل اسم في بطاقة مستقلة
  if (s1.members.length > 0) {
    s1.members.forEach((m) => recordToken(m.name));
    const memberCols = Math.min(4, Math.max(2, s1.members.length));
    const memberRows = Math.ceil(s1.members.length / memberCols);
    rawBlocks.push({
      kind: 'team_members_cards',
      sectionCode: '9.1',
      pageGroup: group2,
      title: `٥. أعضاء فريق مجتمع التعلّم المهني (${s1.membersCount} أعضاء — كل عضو في بطاقة مستقلة)`,
      members: s1.members.map((m) => ({
        memberId: m.id,
        name: m.name,
        roleLabel: m.rolesLabels.join(' / '),
        specialty: m.specialty,
        isLeader: s1.leaderMember?.id === m.id || m.rolesLabels.some((r) => r.includes('رئيس')),
      })),
      estimatedHeight: 46 + memberRows * 82 + 12,
    });
  }

  // ==========================================================================
  // PAGE 4 (pageGroup 3): 03 مؤشرات الأداء (KPIs)
  // - في «القراءة التحليلية لنتائج المؤشرات»: وضع كل مؤشر في سطر مستقل، ومحاذاة النص إلى اليمين
  // - إضافة قراءة تحليلية مختصرة مباشرة أسفل الرسم البياني للمؤشرات تستند إلى نتائج المؤشرات الفعلية واتجاه كل مؤشر
  // ==========================================================================
  const group3 = isRichCommunity ? 3 : 1;

  rawBlocks.push({
    kind: 'section_header',
    sectionCode: '9.7',
    pageGroup: group3,
    sectionNumber: '03',
    title: 'مؤشرات الأداء المهنية (KPIs)',
    subtitle: 'تحليل كمي ونوعي للمؤشرات ومقارنة خط الأساس والمستهدف بالفعلي وفق اتجاه كل مؤشر',
    badgeText: `إجمالي المؤشرات: ${s7.kpiRows.length}`,
    estimatedHeight: 92,
  });

  if (s7.kpiRows.length > 0) {
    rawBlocks.push(
      ...buildTableBlock(
        '9.7',
        group3,
        ['المؤشر', 'خط الأساس', 'المستهدف', 'الفعلي', 'اتجاه المؤشر', 'الحالة'],
        [30, 12, 12, 12, 14, 20],
        s7.kpiRows.map((k) => {
          recordToken(k.indicatorName);
          recordToken(k.achievementDisplay);
          let verificationStatus = k.achievementDisplay;
          if (k.direction === 'not_applicable') {
            verificationStatus = `وصفي (لا ينطبق حساب نسبة)`;
          } else if (!k.isCalculated || k.achievementPercentage === null) {
            verificationStatus = `غير قابل للحكم (نقص بيانات)`;
          } else if (k.achievementPercentage >= 100) {
            verificationStatus = `متحقق (${k.achievementDisplay})`;
          } else {
            verificationStatus = `دون المستهدف (${k.achievementDisplay})`;
          }
          return [
            k.indicatorName,
            k.baselineDisplay,
            k.targetDisplay,
            k.actualDisplay,
            k.directionLabel,
            verificationStatus,
          ];
        }),
        '١. جدول مقارنة مؤشرات الأداء المهنية (خط الأساس • المستهدف • الفعلي • الحالة)',
        'تُحتسب نسبة التحقق حسب اتجاه المؤشر (الأعلى أفضل / الأقل أفضل / مطابقة الهدف / لا ينطبق).',
        ctx
      )
    );
  } else {
    rawBlocks.push(
      buildParagraphBox(
        '9.7',
        group3,
        [
          '• لم يتم إدراج مؤشرات أداء كمية أو نوعية في سجلات المجتمع الحالية؛ وتُعد الحالة غير قابلة للحكم الرقمي.',
        ],
        'حالة مؤشرات الأداء',
        'amber',
        ctx,
        false
      )
    );
  }

  // قراءة تحليلية مختصرة مباشرة أسفل الرسم البياني للمؤشرات مع مراعاة اتجاه كل مؤشر
  const kpiChartReadingLines: string[] = [];
  if (s7.kpiRows.length > 0) {
    const higherCount = s7.kpiRows.filter((k) => k.direction === 'higher_is_better').length;
    const lowerCount = s7.kpiRows.filter((k) => k.direction === 'lower_is_better').length;
    const exactCount = s7.kpiRows.filter((k) => k.direction === 'exact_target').length;
    const dirParts: string[] = [];
    if (higherCount > 0) dirParts.push(`الأعلى أفضل (${higherCount})`);
    if (lowerCount > 0) dirParts.push(`الأقل أفضل (${lowerCount})`);
    if (exactCount > 0) dirParts.push(`مطابقة الهدف (${exactCount})`);
    kpiChartReadingLines.push(
      `قراءة تحليلية للرسم البياني ومؤشرات الأداء: يقارن التمثيل البياني القيم الفعلية بالمستهدفة لـ (${calculatedKpisCount}) مؤشرات كمية وفق اتجاه كل مؤشر [${dirParts.join(' • ') || 'قياسي'}]: حيث تحققت المستهدفات الكاملة في (${achievedKpisCount}) مؤشرات من أصل (${s7.kpiRows.length}).`
    );
  }
  kpiChartReadingLines.forEach(recordToken);

  // الرسم البياني المقارن للمؤشرات (المستهدف مقابل الفعلي) + القراءة التحليلية أسفله مباشرة
  rawBlocks.push(
    buildSingleChartBlock(
      '9.13',
      group3,
      s13.kpiTargetVsActualChart,
      ctx,
      kpiChartReadingLines
    )
  );
  recordToken(s13.kpiTargetVsActualChart.title);

  // ٢. القراءة التحليلية لنتائج المؤشرات: كل مؤشر في سطر مستقل، ومحاذاة النص إلى اليمين
  const perIndicatorRightAlignedLines: string[] =
    s7.kpiRows.length > 0
      ? s7.kpiRows.map((k, idx) => {
          const dirNote =
            k.direction === 'lower_is_better'
              ? 'اتجاه عكسي: الأقل أفضل'
              : k.direction === 'higher_is_better'
              ? 'اتجاه طردي: الأعلى أفضل'
              : k.direction === 'exact_target'
              ? 'مطابقة الهدف'
              : 'مؤشر وصفي';
          const statusNote =
            k.direction === 'not_applicable'
              ? 'تقييم وصفي'
              : k.isCalculated && k.achievementPercentage !== null
              ? k.achievementPercentage >= 100
                ? `متحقق بالكامل (${k.achievementDisplay})`
                : `تحقق جزئي (${k.achievementDisplay})`
              : 'غير قابل للحكم الرقمي';
          return `${arabicNumerals[idx] || `${idx + 1}`}. ${k.indicatorName}: انتقل من خط الأساس (${k.baselineDisplay}) إلى الفعلي (${k.actualDisplay}) مقابل المستهدف (${k.targetDisplay}) [${dirNote} — ${statusNote}].`;
        })
      : s7.kpiDescriptiveAnalysis.slice(0, 4).map((ln) => sanitizeExecutiveWord(ln));

  s7.kpiDescriptiveAnalysis.forEach(recordToken);
  if (perIndicatorRightAlignedLines.length > 0) {
    rawBlocks.push(
      buildParagraphBox(
        '9.7',
        group3,
        perIndicatorRightAlignedLines,
        '٢. القراءة التحليلية لنتائج المؤشرات (كل مؤشر في سطر مستقل)',
        'neutral',
        ctx,
        false // محاذاة النص إلى اليمين
      )
    );
  }

  // ==========================================================================
  // PAGE 5 (pageGroup 4): 04 قياس الأثر والشواهد المختارة
  // - توضيح عدد الشواهد المسجلة والمختارة: «6 شواهد مسجلة، 4 شواهد مختارة للعرض»
  // - تكبير رموز QR وإضافة رابط نصي قابل للنقر بجانب الرمز يوجه لنفس الوجهة
  // ==========================================================================
  const group4 = isRichCommunity ? 4 : 2;

  rawBlocks.push({
    kind: 'section_header',
    sectionCode: '9.8',
    pageGroup: group4,
    sectionNumber: '04',
    title: 'قياس الأثر والشواهد المختارة',
    subtitle:
      'التمييز المنهجي بين مخرجات التنفيذ، والتحسن المهني، والأثر التعليمي المقاس مع أهم الشواهد الموثقة',
    badgeText: s8.overallClassificationLabel,
    estimatedHeight: 92,
  });
  recordToken(s8.overallClassificationLabel);

  // شريط التمييز الثلاثي بين مخرجات التنفيذ والتحسن المهني والأثر التعليمي المقاس
  rawBlocks.push({
    kind: 'impact_distinction_strip',
    sectionCode: '9.8',
    pageGroup: group4,
    items: [
      {
        title: '١. مخرجات التنفيذ (ما تم فعليًا)',
        metric: `${executedActivitiesCount} نشاط منفذ • ${s4.completedCount} إجراء مكتمل`,
        descriptionLines: wrapArabicCellText(
          'إتمام الاجتماعات والورش والزيارات التبادلية وإعداد الأدوات؛ وهي مخرجات عمل تطبيقية مباشرة.',
          Math.floor((CONTENT_W - 28) / 3) - 28,
          11,
          ctx
        ),
        tone: 'slate',
      },
      {
        title: '٢. التحسن المهني (ممارسة الفريق)',
        metric: `${s8.describedOutcomesCount} سجل تحسن مهني مرصود`,
        descriptionLines: wrapArabicCellText(
          'تطور الممارسات التدريسية وتبادل الخبرات بين المعلمين المرصود عبر الملاحظة الصفية والتقويم النوعي.',
          Math.floor((CONTENT_W - 28) / 3) - 28,
          11,
          ctx
        ),
        tone: 'amber',
      },
      {
        title: '٣. الأثر التعليمي المقاس (النتيجة)',
        metric: `${s8.verifiedImpactsCount} سجل أثر كمي مقاس ومثبت`,
        descriptionLines: wrapArabicCellText(
          s8.verifiedImpactsCount > 0
            ? 'تحسن فعلي مقاس بأدوات قبلية وبعدية ومقارنة رقمية بين خط الأساس والمستهدف والمتحقق.'
            : 'لم تُسجل قراءات قياس كمية قبلية/بعدية كافية لإثبات أثر رقمي مقارن.',
          Math.floor((CONTENT_W - 28) / 3) - 28,
          11,
          ctx
        ),
        tone: s8.verifiedImpactsCount > 0 ? 'emerald' : 'slate',
      },
    ],
    estimatedHeight: 168,
  });

  if (s8.rows.length > 0) {
    rawBlocks.push(
      ...buildTableBlock(
        '9.8',
        group4,
        [
          'الفئة المستهدفة والمجال',
          'أداة وطريقة القياس',
          'الأساس ← المستهدف ← الفعلي',
          'خلاصة الأثر المرصود وقرار التحسين',
          'تصنيف الدليل',
        ],
        [20, 18, 18, 28, 16],
        s8.rows.map((imp) => {
          recordToken(imp.impactDescriptionDisplay);
          recordToken(imp.classificationLabel);
          imp.supportingEvidencesTitles.forEach(recordToken);
          return [
            `${imp.beneficiaryCategoryDisplay} (${imp.activityDisplay !== 'غير مرتبط بنشاط محدد' ? imp.activityDisplay : imp.goalDisplay})`,
            imp.measurementMethodDisplay,
            `أساس: ${imp.baselineDisplay} | مستهدف: ${imp.targetDisplay} | فعلي: ${imp.actualResultDisplay}`,
            `${sanitizeExecutiveWord(imp.impactDescriptionDisplay)} [القرار: ${sanitizeExecutiveWord(imp.improvementDecisionDisplay)}]`,
            imp.classificationLabel,
          ];
        }),
        '١. جدول سجلات قياس الأثر المهني والتعليمي',
        undefined,
        ctx
      )
    );
  }

  if (s13.impactMeasurementChart.hasSufficientData) {
    rawBlocks.push(
      buildSingleChartBlock('9.8', group4, s13.impactMeasurementChart, ctx)
    );
  }

  // الشواهد المختارة الأكثر دلالة على الإنجاز (مع توضيح: 6 شواهد مسجلة، 4 شواهد مختارة للعرض)
  s9.rows.forEach((ev) => recordToken(ev.title));

  const explicitEvidenceCountPhrase = `${s9.totalEvidencesCount} شواهد مسجلة، ${selectedEvidences.length} شواهد مختارة للعرض`;
  recordToken(explicitEvidenceCountPhrase);

  const typeBreakdownLine =
    s9.byEvidenceType.length > 0
      ? `توزيع الشواهد حسب النوع: ${s9.byEvidenceType.map((t) => `${t.label} (${t.count})`).join(' • ')}`
      : 'لا توجد شواهد مصنفة في المستودع حاليًا.';

  const evRowsCount = Math.ceil(Math.max(1, selectedEvidences.length) / 2);
  const evCardH = 162; // Enlarged to comfortably fit 124px QR code + clickable link pill
  const evGridHeight =
    selectedEvidences.length > 0 ? 106 + evRowsCount * (evCardH + 14) : 124;

  rawBlocks.push({
    kind: 'selected_evidences_qr_grid',
    sectionCode: '9.9',
    pageGroup: group4,
    registeredCount: s9.totalEvidencesCount,
    selectedCount: selectedEvidences.length,
    summaryLine: `${explicitEvidenceCountPhrase} — مرتبطة بقياس الأثر: (${s9.impactLinkedEvidencesCount}) • مرتبطة بالمؤشرات: (${s9.kpiLinkedEvidencesCount}) • مرتبطة بالاجتماعات والأنشطة: (${s9.meetingsAndActivitiesLinkedEvidencesCount})`,
    typeBreakdownLine,
    cards: selectedEvidences,
    estimatedHeight: evGridHeight,
  });

  // ==========================================================================
  // PAGE 6 (pageGroup 5): 05 التحديات والتوصيات والخطوات القادمة + التوقيع والختم
  // - في جدول «التوصيات الإجرائية»: حذف عمود «الاستحقاق» والتواريخ بالكامل وإعادة توزيع الأعمدة بتوازن
  // - حذف كلمة «التنفيذية» من «الملاحظات التنفيذية»
  // - اختصار الملاحظات (سطر إلى سطرين لكل ملاحظة) بمحاذاة اليمين وتمييز العناوين الفرعية بلون مختلف متناسق
  // ==========================================================================
  const group5 = isRichCommunity ? 5 : 2;

  rawBlocks.push({
    kind: 'section_header',
    sectionCode: '9.11',
    pageGroup: group5,
    sectionNumber: '05',
    title: 'التحديات والتوصيات والخطوات القادمة',
    subtitle:
      'استخلاص التحديات الموثقة وربطها بتوصيات إجرائية قابلة للتنفيذ وأولويات الدورة القادمة للمجتمع',
    estimatedHeight: 92,
  });

  // ١. جدول التحديات الفعلية المرصودة
  const challengeRows: string[][] =
    s11.items.length > 0
      ? s11.items.slice(0, 4).map((ch, idx) => {
          recordToken(ch.statement);
          return [
            `${idx + 1}`,
            sanitizeExecutiveWord(ch.statement),
            sanitizeExecutiveWord(ch.recordedNote || 'مرصود أثناء متابعة التنفيذ والقياس'),
            sanitizeExecutiveWord(ch.source),
          ];
        })
      : [['١', s11.emptyMessage, 'لا توجد معوقات حرجة مسجلة', 'المتابعة الدورية']];

  rawBlocks.push(
    ...buildTableBlock(
      '9.11',
      group5,
      ['م', 'التحدي الفعلي المرصود', 'السبب / الملاحظة التفسيرية الموثقة', 'مصدر الرصد'],
      [8, 42, 32, 18],
      challengeRows,
      '١. التحديات الفعلية المرصودة وأسبابها الموثقة',
      undefined,
      ctx,
      2
    )
  );

  // ٢. جدول التوصيات الإجرائية والأولويات القادمة (حذف عمود الاستحقاق والتواريخ بالكامل وإعادة توزيع الأعمدة بتوازن)
  const stripDatesFromText = (str: string): string =>
    sanitizeExecutiveWord(str)
      .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*هـ?\b/g, '')
      .replace(/\(\s*الاستحقاق\s*:[^)]*\)/g, '')
      .replace(/تاريخ الاستحقاق\s*:?\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const recRows: string[][] = [];
  if (s12.extractedRecommendations.length > 0) {
    for (let i = 0; i < Math.min(4, s12.extractedRecommendations.length); i++) {
      const rec = s12.extractedRecommendations[i];
      const cleanedStatement = stripDatesFromText(rec.statement);
      recordToken(cleanedStatement);
      recRows.push([
        `${i + 1}`,
        cleanedStatement,
        stripDatesFromText(rec.responsibleOrDecision || 'فريق المجتمع المهني'),
      ]);
    }
  } else {
    recRows.push([
      '١',
      'استكمال توثيق مؤشرات الأداء وقياس الأثر الدوري في الدورة القادمة للمجتمع.',
      'فريق المجتمع المهني',
    ]);
  }

  rawBlocks.push(
    ...buildTableBlock(
      '9.12',
      group5,
      ['م', 'التوصية الإجرائية / الأولوية القادمة', 'الجهة المسؤولة / القرار'],
      [10, 58, 32],
      recRows,
      '٢. التوصيات الإجرائية والأولويات القادمة للتحسين المستمر',
      undefined,
      ctx,
      2
    )
  );

  // ٣. الملاحظات والمرئيات الختامية (بدون كلمة التنفيذية، وبعناوين فرعية مميزة لونيًا: خلاصة، التشخيص الدقيق للاحتياجات، الأولويات القادمة)
  const rawSummaryNote = s12.customExecutiveNotes
    ? stripDatesFromText(s12.customExecutiveNotes)
    : `حقّق المجتمع تكاملًا منهجيًا بين التخطيط والتطبيق التشاركي بنسبة إنجاز (${s4.completionDisplay}) وأثر مقاس موثق بالشواهد.`;
  const rawNeedsDiagnosisNote =
    s3.rows.length > 0
      ? `ارتكزت التدخلات على تشخيص (${s3.totalNeedsCount}) احتياجات مهنية ذات أولوية مرتبطة مباشرةً بفجوات الأداء الصفي الفعلي.`
      : 'ارتكزت أنشطة المجتمع على رصد الاحتياجات المهنية الفعلية لأعضاء الفريق.';
  const rawFuturePrioritiesNote = s12.customClosingNotes
    ? stripDatesFromText(s12.customClosingNotes)
    : 'توسيع الزيارات الصفية التبادلة، وتعميم نماذج الدروس المحسّنة، واستدامة قياس الأثر القبلي والبعدي.';

  if (s12.customExecutiveNotes) recordToken(s12.customExecutiveNotes);
  if (s12.customClosingNotes) recordToken(s12.customClosingNotes);

  const highlightedNotes: PlcHighlightedNoteItem[] = [
    {
      prefix: 'خلاصة',
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

  const fallbackNoteLines = highlightedNotes.map((n) => `${n.prefix}: ${n.text}`);

  rawBlocks.push(
    buildParagraphBox(
      '9.12',
      group5,
      fallbackNoteLines,
      '٣. الملاحظات والمرئيات الختامية',
      'emerald',
      ctx,
      false, // محاذاة إلى اليمين
      highlightedNotes
    )
  );

  // ٤. التوقيع والختم في أسفل الصفحة الأخيرة وفق البند 2.8:
  // - اليمين: صفة رئيس المجتمع، الاسم، التخصص (حذف كلمة "التوقيع")
  // - الوسط: كلمة «الختم» فقط دون عبارة «مكان الختم الرسمي للمدرسة» ودون إطار أو جدول مستقل حولها
  // - اليسار: صفة مدير المدرسة والاسم فقط (حذف اسم المدرسة وحذف "التوقيع والختم")
  const closingSummaryText = `وثّق هذا التقرير النهائي حصيلة أعمال وشواهد «${report.communityName}» خلال ${s1.semesterLabel} من العام الدراسي ${s1.academicYear}.`;

  const closingStatementLines = wrapArabicCellText(
    closingSummaryText,
    CONTENT_W - 96,
    12.2,
    ctx
  ).slice(0, 2);

  rawBlocks.push({
    kind: 'official_signoff_block',
    sectionCode: '9.12',
    pageGroup: group5,
    signoffHeading: 'التوثيق الختامي للمجتمع المهني',
    closingStatementLines,
    leaderTitle: 'رئيس مجتمع التعلّم المهني',
    leaderName: s1.leaderNameDisplay,
    leaderSpecialty: s1.leaderSpecialtyDisplay,
    stampLabel: 'الختم',
    principalTitle: genderedLabels.principalTitle,
    principalName: principalNameDisplay,
    schoolName: '',
    estimatedHeight: 236,
  });

  // ==========================================================================
  // PAGINATION ENGINE:
  // - Respects `pageGroup` boundaries so each major thematic chapter starts cleanly,
  //   while preventing orphan headers or overflow past `MAX_CONTENT_Y`.
  // ==========================================================================
  const pageGroupTitles: Record<number, string> = {
    0: 'غلاف التقرير النهائي لمجتمع التعلّم المهني',
    1: '01 الملخص العام للمجتمع',
    2: '02 أبرز الإنجازات والممارسات المنفذة',
    3: '03 مؤشرات الأداء المهنية (KPIs)',
    4: '04 قياس الأثر والشواهد المختارة',
    5: '05 التحديات والتوصيات والخطوات القادمة',
  };

  const pagesBlocks: Array<{ pageGroup: number; blocks: PlcPdfBlock[] }> = [];
  let currentPageBlocks: PlcPdfBlock[] = [];
  let currentGroup = 0;
  let currentY: number = INTERIOR_START_Y;

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const nextBlock = i + 1 < rawBlocks.length ? rawBlocks[i + 1] : null;
    const prevBlock =
      currentPageBlocks.length > 0 ? currentPageBlocks[currentPageBlocks.length - 1] : null;

    if (block.kind === 'cover_page') {
      if (currentPageBlocks.length > 0) {
        pagesBlocks.push({ pageGroup: currentGroup, blocks: currentPageBlocks });
        currentPageBlocks = [];
      }
      pagesBlocks.push({ pageGroup: 0, blocks: [block] });
      currentGroup = 1;
      currentY = INTERIOR_START_Y;
      continue;
    }

    // Start a new page when moving to a new thematic chapter (`pageGroup`)
    if (currentPageBlocks.length > 0 && block.pageGroup !== currentGroup) {
      pagesBlocks.push({ pageGroup: currentGroup, blocks: currentPageBlocks });
      currentPageBlocks = [];
      currentGroup = block.pageGroup;
      currentY = INTERIOR_START_Y;
    } else if (currentPageBlocks.length === 0) {
      currentGroup = block.pageGroup;
    }

    const extraTableSpacing =
      prevBlock && prevBlock.kind === 'table' && block.kind === 'table'
        ? PLC_REPORT_DESIGN_SYSTEM.spacing.tableGap - PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap
        : 0;

    const requiredHeight =
      block.kind === 'section_header' && nextBlock && nextBlock.pageGroup === block.pageGroup
        ? block.estimatedHeight + Math.min(nextBlock.estimatedHeight, 170)
        : block.estimatedHeight + extraTableSpacing;

    if (currentPageBlocks.length > 0 && currentY + requiredHeight > MAX_CONTENT_Y) {
      pagesBlocks.push({ pageGroup: currentGroup, blocks: currentPageBlocks });
      currentPageBlocks = [];
      currentY = INTERIOR_START_Y;
    }

    currentPageBlocks.push(block);
    currentY +=
      block.estimatedHeight + PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap + extraTableSpacing;
  }

  if (currentPageBlocks.length > 0) {
    pagesBlocks.push({ pageGroup: currentGroup, blocks: currentPageBlocks });
  }

  const nonEmptyPages = pagesBlocks.filter((p) => p.blocks.length > 0);
  const totalPages = Math.max(1, nonEmptyPages.length);

  // Pre-compute deterministic QR and Link coordinates for every page containing `selected_evidences_qr_grid`
  const pages: PlcPdfPagePlan[] = nonEmptyPages.map((entry, idx) => {
    const isCover = entry.blocks.some((b) => b.kind === 'cover_page');
    const plannedLinks: PlcPdfLinkAnnotation[] = [];
    const plannedQrSpots: PlcRenderedQrSpot[] = [];

    if (!isCover) {
      let simY = INTERIOR_START_Y;
      for (let bIdx = 0; bIdx < entry.blocks.length; bIdx++) {
        const blk = entry.blocks[bIdx];
        const nextKind =
          bIdx + 1 < entry.blocks.length ? entry.blocks[bIdx + 1].kind : undefined;

        if (blk.kind === 'selected_evidences_qr_grid' && blk.cards.length > 0) {
          const gapX = 18;
          const gapY = 14;
          const cardW = Math.floor((CONTENT_W - 48 - gapX) / 2);
          const cardH = 162;
          const cardsStartY = simY + 106;
          const qrBoxSize = 126;

          blk.cards.forEach((evCard, cIdx) => {
            const r = Math.floor(cIdx / 2);
            const isRight = cIdx % 2 === 0;
            const cardX = isRight ? PAGE_W - MARGIN_X - 24 - cardW : MARGIN_X + 24;
            const cardY = cardsStartY + r * (cardH + gapY);
            const targetUri = evCard.destinationUri || evCard.qrPayload;

            if (evCard.hasValidQr && targetUri) {
              const qrX = cardX + 14;
              const qrY = cardY + Math.round((cardH - qrBoxSize) / 2);
              const textZoneX = cardX + qrBoxSize + 24;
              const textZoneW = cardW - qrBoxSize - 38;
              const linkPillW = Math.min(260, textZoneW - 16);
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
        }

        const stepGap =
          blk.kind === 'table' && nextKind === 'table'
            ? PLC_REPORT_DESIGN_SYSTEM.spacing.tableGap
            : PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap;
        simY += blk.estimatedHeight + stepGap;
      }
    }

    return {
      pageNumber: idx + 1,
      totalPages,
      isCoverPage: isCover,
      pageTitle: pageGroupTitles[entry.pageGroup] || 'التقرير النهائي لمجتمع التعلّم المهني',
      footerLabel: isCover ? '' : `${idx + 1}`,
      createdDateText: '',
      blocks: entry.blocks,
      plannedLinks,
      plannedQrSpots,
    };
  });

  // Record all underlying domain section codes covered by the final report
  const sectionsSet = new Set<string>([
    '9.0',
    '9.1',
    '9.2',
    '9.3',
    '9.4',
    '9.5',
    '9.6',
    '9.7',
    '9.8',
    '9.9',
    '9.10',
    '9.11',
    '9.12',
    '9.13',
  ]);
  for (const b of rawBlocks) {
    sectionsSet.add(b.sectionCode);
  }

  return {
    communityId: report.communityId,
    communityName: report.communityName,
    reportTitle: `التقرير النهائي لمجتمع التعلّم المهني — ${report.communityName}`,
    generatedDateDisplay: '',
    pages,
    sectionsIncluded: Array.from(sectionsSet),
    allTextTokens: textTokens,
  };
}

export function drawPlcRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const safeR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.arcTo(x + w, y, x + w, y + h, safeR);
  ctx.arcTo(x + w, y + h, x, y + h, safeR);
  ctx.arcTo(x, y + h, x, y, safeR);
  ctx.arcTo(x, y, x + w, y, safeR);
  ctx.closePath();
}

const drawRoundedBox = drawPlcRoundedBox;

/**
 * Draws ultra-subtle, contemporary Saudi educational visual touches (Requirement 4):
 * - A calm, thin vertical accent line along one side of the page (`#145B59` + small `#C5A15D` tick).
 * - A barely-noticeable, transparent minimalist geometric accent in a single corner outside the content area.
 * - No heavy/dense Islamic rosettes or certificate-like decorative borders.
 */
export function drawPlcCornerOrnamentsAndSideLines(
  ctx: CanvasRenderingContext2D,
  frameInset = 36
) {
  const { petrolGreen, deepTurquoise, mutedGold } = PLC_REPORT_DESIGN_SYSTEM.colors;
  ctx.save();

  // 1. Calm, thin vertical accent line along the right side of the page
  const rightAccentX = PAGE_W - frameInset - 12;
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = deepTurquoise;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(rightAccentX, frameInset + 110);
  ctx.lineTo(rightAccentX, PAGE_H - frameInset - 110);
  ctx.stroke();

  // Limited Muted Gold small accent ticks on the calm side line
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = mutedGold;
  ctx.fillRect(rightAccentX - 1.5, frameInset + 110, 3, 28);
  ctx.fillRect(rightAccentX - 1.5, PAGE_H - frameInset - 138, 3, 28);

  // 2. Minimal, transparent contemporary geometric pattern in a single corner (bottom-left outer corner)
  const cornerX = frameInset + 22;
  const cornerY = PAGE_H - frameInset - 22;
  ctx.save();
  ctx.translate(cornerX, cornerY);
  ctx.globalAlpha = 0.085;
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.strokeStyle = mutedGold;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(13, 0);
  ctx.lineTo(0, 13);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/**
 * Draws a very faint minimalist watermark ONLY when a large empty whitespace region exists below `contentEndY`
 * (never behind text, cards, charts, or tables).
 */
export function drawPlcEmptySpaceWatermark(
  ctx: CanvasRenderingContext2D,
  contentEndY: number
) {
  const freeBottomY = MAX_CONTENT_Y - 20;
  const availableEmptyH = freeBottomY - contentEndY;
  if (availableEmptyH < 210) {
    return; // Never draw behind content or when page space is well-utilized
  }

  const centerX = PAGE_W / 2;
  const centerY = contentEndY + availableEmptyH / 2;
  const radius = Math.min(46, Math.floor((availableEmptyH - 50) / 2));
  if (radius < 24) return;

  const { petrolGreen, mutedGold } = PLC_REPORT_DESIGN_SYSTEM.colors;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalAlpha = 0.032;
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius - 28, 0);
  ctx.lineTo(radius + 28, 0);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws the official Saudi Ministry of Education logo using the preloaded `/moe-logo.png` asset.
 * If executed synchronously before image decode, draws a faithful vector emblem + wordmark.
 */
export function drawOfficialMinistryLogo(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  widthPx: number
) {
  if (
    cachedMoeLogoImage &&
    cachedMoeLogoImage.complete &&
    cachedMoeLogoImage.naturalWidth > 0 &&
    cachedMoeLogoImage.naturalHeight > 0
  ) {
    const img = cachedMoeLogoImage;
    const cropX = img.naturalWidth * 0.26;
    const cropY = img.naturalHeight * 0.31;
    const cropW = img.naturalWidth * 0.48;
    const cropH = img.naturalHeight * 0.38;
    const targetH = (cropH / cropW) * widthPx;
    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropW,
      cropH,
      centerX - widthPx / 2,
      topY,
      widthPx,
      targetH
    );
    return;
  }

  ctx.save();
  const scale = widthPx / 220;
  const baseY = topY + 28 * scale;
  const cols = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  for (let r = 0; r < 3; r++) {
    for (const c of cols) {
      if (c === 0 && r < 2) continue;
      const dist = Math.abs(c);
      const dx = centerX + c * 18 * scale;
      const dy = baseY + r * 14 * scale + (4 - dist) * 5 * scale;
      const radius = Math.max(2.5, (3.2 + dist * 0.7 - r * 0.4) * scale);
      ctx.fillStyle = c >= 0 ? '#145B59' : '#153C43';
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen;
  ctx.font = `700 ${Math.round(24 * scale)}px ${FONT_FAMILY}`;
  ctx.fillText('وزارة التعليم', centerX, topY + 98 * scale);
  ctx.font = `600 ${Math.round(13 * scale)}px sans-serif`;
  ctx.fillStyle = PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise;
  ctx.fillText('Ministry of Education', centerX, topY + 120 * scale);
  ctx.restore();
}

/**
 * Renders Page 1: Dedicated Official Cover Page (`الغلاف`):
 * 1. Ministry of Education logo anchored in the TOP zone of the page, centered.
 * 2. Directly below the logo, the 4 official lines on separate centered lines:
 *    - المملكة العربية السعودية
 *    - وزارة التعليم
 *    - إدارة التعليم
 *    - اسم المدرسة
 * 3. After a short, clear vertical gap (`48px`), the Report Title & Community Hero Panel begins.
 * 4. Remaining elements (Community Vision & Scope card, 4 Metadata cards, and Bottom Two Name Cards)
 *    are balanced vertically down to the bottom of the cover page.
 * 5. Bottom two cards contain ONLY the two names (`coverBlock.leaderName` on Right, `coverBlock.principalName` on Left),
 *    without job titles and without repeating the school name below the principal's card.
 */
export function drawOfficialCoverPage(
  ctx: CanvasRenderingContext2D,
  _report: PlcGeneratedFinalReport,
  settings: SchoolSettings,
  coverBlock: Extract<PlcPdfBlock, { kind: 'cover_page' }>
) {
  const {
    petrolGreen,
    deepTurquoise,
    mutedGold,
    ivory,
    white,
    softIvory,
    darkInk,
    cardBorder,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  // 1. Calm Ivory & White Institutional Background
  ctx.fillStyle = ivory;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Clean contemporary outer sheet frame
  drawRoundedBox(ctx, 52, 52, PAGE_W - 104, PAGE_H - 104, 24);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Subtle contemporary side line & single corner accent
  drawPlcCornerOrnamentsAndSideLines(ctx, 52);

  // Top Petrol Green & Muted Gold Crown Band
  drawRoundedBox(ctx, 52, 52, PAGE_W - 104, 22, 12);
  ctx.fillStyle = petrolGreen;
  ctx.fill();
  ctx.fillStyle = mutedGold;
  ctx.fillRect(52, 71, PAGE_W - 104, 4);

  // Bottom Petrol Green & Muted Gold Base Band
  drawRoundedBox(ctx, 52, PAGE_H - 74, PAGE_W - 104, 22, 12);
  ctx.fillStyle = petrolGreen;
  ctx.fill();
  ctx.fillStyle = mutedGold;
  ctx.fillRect(52, PAGE_H - 78, PAGE_W - 104, 4);

  // =========================================================================
  // 2. TOP-ANCHORED OFFICIAL IDENTITY ZONE (Logo + 4 Centered Lines)
  // Positioned right at the top of the cover page (Y = 114), NOT pushed to the middle!
  // =========================================================================
  const commNameLines = coverBlock.communityNameLines;
  const specLines = coverBlock.specialtyLines;

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // Official Ministry of Education Logo centered in the top zone
  const logoCardW = 340;
  const logoCardH = 186;
  const logoCardX = (PAGE_W - logoCardW) / 2;
  const logoCardY = 114;
  drawRoundedBox(ctx, logoCardX, logoCardY, logoCardW, logoCardH, 18);
  ctx.fillStyle = ivory;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawOfficialMinistryLogo(ctx, PAGE_W / 2, logoCardY + 8, 226);

  // Directly below the logo: 4 Separate Centered Lines for Official Identity
  const identityY = logoCardY + logoCardH + 38;
  const eduDeptText = settings.educationDepartment?.trim() || 'الإدارة العامة للتعليم';
  const schoolNameText = settings.schoolName?.trim() || 'المدرسة';

  ctx.fillStyle = petrolGreen;
  ctx.font = `700 26px ${FONT_FAMILY}`;
  ctx.fillText('المملكة العربية السعودية', PAGE_W / 2, identityY);

  ctx.fillStyle = petrolGreen;
  ctx.font = `700 24px ${FONT_FAMILY}`;
  ctx.fillText('وزارة التعليم', PAGE_W / 2, identityY + 40);

  ctx.fillStyle = deepTurquoise;
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.fillText(eduDeptText, PAGE_W / 2, identityY + 80);

  ctx.fillStyle = darkInk;
  ctx.font = `700 24px ${FONT_FAMILY}`;
  ctx.fillText(schoolNameText, PAGE_W / 2, identityY + 122);

  // Subtle Muted Gold divider marking the end of the Official Identity Zone
  const identityDividerY = identityY + 146;
  drawRoundedBox(ctx, PAGE_W / 2 - 140, identityDividerY, 280, 3.5, 2);
  ctx.fillStyle = mutedGold;
  ctx.fill();

  // =========================================================================
  // 3. SHORT, CLEAR VERTICAL GAP (`48px`), THEN REPORT TITLE & COMMUNITY INFO
  // =========================================================================
  const shortClearGap = 48;
  const heroBoxX = 128;
  const heroBoxY = identityDividerY + shortClearGap;
  const heroBoxW = PAGE_W - 256;
  const heroBoxH = 476 + (commNameLines.length - 1) * 50 + (specLines.length - 1) * 36;

  drawRoundedBox(ctx, heroBoxX, heroBoxY, heroBoxW, heroBoxH, 26);
  ctx.fillStyle = petrolGreen;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Inner Deep Turquoise accent banner at top of Hero Box
  const badgeW = 520;
  const badgeH = 48;
  const badgeX = (PAGE_W - badgeW) / 2;
  const badgeY = heroBoxY + 36;
  drawRoundedBox(ctx, badgeX, badgeY, badgeW, badgeH, 24);
  ctx.fillStyle = deepTurquoise;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = ivory;
  ctx.font = `700 20px ${FONT_FAMILY}`;
  ctx.fillText(
    coverBlock.reportBadgeLabel || 'وثيقة مدرسية رسمية • مجتمعات التعلّم المهنية',
    PAGE_W / 2,
    badgeY + 32
  );

  // Main Report Title
  ctx.fillStyle = white;
  ctx.font = `700 48px ${FONT_FAMILY}`;
  ctx.fillText(
    coverBlock.reportMainTitle || 'التقرير النهائي لمجتمع التعلّم المهني',
    PAGE_W / 2,
    heroBoxY + 156
  );

  // Muted Gold rule under main title
  drawRoundedBox(ctx, PAGE_W / 2 - 150, heroBoxY + 184, 300, 5, 2.5);
  ctx.fillStyle = mutedGold;
  ctx.fill();

  // White Community Name Card inside Hero Box
  const commCardW = heroBoxW - 120;
  const commCardH = 98 + (commNameLines.length - 1) * 50;
  const commCardX = heroBoxX + 60;
  const commCardY = heroBoxY + 218;

  drawRoundedBox(ctx, commCardX, commCardY, commCardW, commCardH, 18);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = petrolGreen;
  ctx.font = `700 35px ${FONT_FAMILY}`;
  let cLineY = commCardY + 62;
  for (const ln of commNameLines) {
    ctx.fillText(ln, PAGE_W / 2, cLineY);
    cLineY += 50;
  }

  // Domain / Specialty & Academic Period inside Hero Box
  ctx.fillStyle = ivory;
  ctx.font = `700 23px ${FONT_FAMILY}`;
  let sLineY = commCardY + commCardH + 54;
  for (const ln of specLines) {
    ctx.fillText(`المجال / التخصص: ${ln}`, PAGE_W / 2, sLineY);
    sLineY += 36;
  }

  ctx.fillStyle = mutedGold;
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.fillText(
    `العام الدراسي: ${coverBlock.academicYear}   |   فترة التنفيذ: ${coverBlock.semesterLabel}`,
    PAGE_W / 2,
    sLineY + 18
  );

  // =========================================================================
  // 4. BALANCED VERTICAL DISTRIBUTION OF REMAINING COVER ELEMENTS
  // Distribute Vision & Scope card, 4 Metadata cards, and Bottom Name cards
  // evenly across the remaining space between `heroBoxY + heroBoxH` and `PAGE_H - 130`
  // =========================================================================
  const remainingStartY = heroBoxY + heroBoxH;
  const bottomLimitY = PAGE_H - 130;
  const visionLines = (coverBlock.visionLines || []).slice(0, 2);
  const visionCardH = 148 + (visionLines.length - 1) * 28;
  const metaCardH = 122;
  const metaSectionH = 2 * metaCardH + 24;
  const leadCardH = 128;

  const totalLowerContentH = visionCardH + metaSectionH + leadCardH;
  const totalFreeVerticalSpace = Math.max(
    120,
    bottomLimitY - remainingStartY - totalLowerContentH
  );
  const sectionVerticalGap = Math.round(totalFreeVerticalSpace / 3);

  // 4A. Community Vision & Team Scope Card
  const visionCardY = remainingStartY + sectionVerticalGap;
  drawRoundedBox(ctx, heroBoxX, visionCardY, heroBoxW, visionCardH, 18);
  ctx.fillStyle = softIvory;
  ctx.fill();
  ctx.strokeStyle = deepTurquoise;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  drawRoundedBox(ctx, heroBoxX, visionCardY, heroBoxW, 42, 14);
  ctx.fillStyle = deepTurquoise;
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = white;
  ctx.font = `700 19px ${FONT_FAMILY}`;
  ctx.fillText(
    `الرسالة والرؤية المهنية للمجتمع  •  أعضاء الفريق: (${coverBlock.membersCount})  •  المقر: ${coverBlock.venueDisplay}`,
    PAGE_W / 2,
    visionCardY + 28
  );

  ctx.fillStyle = darkInk;
  ctx.font = `600 20px ${FONT_FAMILY}`;
  visionLines.forEach((vLn, idx) => {
    ctx.fillText(vLn, PAGE_W / 2, visionCardY + 86 + idx * 32);
  });

  // 4B. Structured Metadata Grid (4 Cards)
  const metaY = visionCardY + visionCardH + sectionVerticalGap;
  const metaGap = 24;
  const metaCols = 2;
  const metaCardW = Math.floor((heroBoxW - metaGap) / metaCols);

  coverBlock.metadataItems.forEach((item, idx) => {
    const r = Math.floor(idx / metaCols);
    const isRight = idx % metaCols === 0;
    const cardX = isRight ? PAGE_W - 128 - metaCardW : 128;
    const cardY = metaY + r * (metaCardH + 24);

    drawRoundedBox(ctx, cardX, cardY, metaCardW, metaCardH, 16);
    ctx.fillStyle = ivory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Top thin accent bar on metadata card
    drawRoundedBox(ctx, cardX + 24, cardY, metaCardW - 48, 5, 2.5);
    ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
    ctx.fill();

    // Centered label & value inside each metadata card
    const centerCardX = cardX + metaCardW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = deepTurquoise;
    ctx.font = `700 19px ${FONT_FAMILY}`;
    ctx.fillText(item.label, centerCardX, cardY + 44);

    ctx.fillStyle = darkInk;
    ctx.font = `700 23px ${FONT_FAMILY}`;
    const valLines = wrapArabicCellText(item.value, metaCardW - 48, 12.5, ctx).slice(0, 2);
    if (valLines.length === 1) {
      ctx.fillText(valLines[0], centerCardX, cardY + 88);
    } else {
      ctx.font = `700 20px ${FONT_FAMILY}`;
      ctx.fillText(valLines[0], centerCardX, cardY + 74);
      ctx.fillText(valLines[1], centerCardX, cardY + 102);
    }
  });

  // =========================================================================
  // 5. BOTTOM TWO CARDS: ONLY THE TWO NAMES (Requirement 2.2)
  // «الاكتفاء في البطاقتين السفليتين بالاسمين فقط، دون المسميات الوظيفية، مع عدم تكرار اسم المدرسة تحت اسم مدير المدرسة»
  // =========================================================================
  const leadTopY = metaY + metaSectionH + sectionVerticalGap;
  const leadCardW = Math.floor((heroBoxW - 36) / 2);

  // Right Card (`الجهة اليمنى`): Name of PLC Leader ONLY
  const rightCardX = PAGE_W - 128 - leadCardW;
  const rightCenterX = rightCardX + leadCardW / 2;

  drawRoundedBox(ctx, rightCardX, leadTopY, leadCardW, leadCardH, 18);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Top Petrol Green & Muted Gold accent bar (no job title text)
  drawRoundedBox(ctx, rightCardX, leadTopY, leadCardW, 12, 8);
  ctx.fillStyle = petrolGreen;
  ctx.fill();
  ctx.fillStyle = mutedGold;
  ctx.fillRect(rightCardX + 36, leadTopY + 12, leadCardW - 72, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = darkInk;
  ctx.font = `700 28px ${FONT_FAMILY}`;
  ctx.fillText(coverBlock.leaderName, rightCenterX, leadTopY + 78);

  // Left Card (`الجهة اليسرى`): Name of School Principal ONLY (no job title, no school name)
  const leftCardX = 128;
  const leftCenterX = leftCardX + leadCardW / 2;

  drawRoundedBox(ctx, leftCardX, leadTopY, leadCardW, leadCardH, 18);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.strokeStyle = deepTurquoise;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Top Deep Turquoise & Muted Gold accent bar (no job title text)
  drawRoundedBox(ctx, leftCardX, leadTopY, leadCardW, 12, 8);
  ctx.fillStyle = deepTurquoise;
  ctx.fill();
  ctx.fillStyle = mutedGold;
  ctx.fillRect(leftCardX + 36, leadTopY + 12, leadCardW - 72, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = darkInk;
  ctx.font = `700 28px ${FONT_FAMILY}`;
  ctx.fillText(coverBlock.principalName, leftCenterX, leadTopY + 78);
}

/**
 * Draws the official Interior Page Header (Pages 2..N):
 * - Independent top zone (`Y = 52..198`) with 62px clear whitespace before page content (`INTERIOR_START_Y = 260`).
 * - Right Zone: Kingdom / Ministry / Education Department / School Name.
 * - Center Zone: Official Saudi Ministry of Education Logo (`./moe-logo.png`).
 * - Left Zone: Report Title, Community Name, Academic Year & Semester.
 */
export function drawInteriorPageHeader(
  ctx: CanvasRenderingContext2D,
  report: PlcGeneratedFinalReport,
  settings: SchoolSettings,
  _pagePlan: PlcPdfPagePlan,
  customReportTitle?: string
) {
  const { petrolGreen, deepTurquoise, mutedGold, ivory, white, darkInk, cardBorder } =
    PLC_REPORT_DESIGN_SYSTEM.colors;

  // Crisp page background & subtle outer institutional border
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 2.2;
  drawRoundedBox(ctx, 36, 36, PAGE_W - 72, PAGE_H - 72, 18);
  ctx.stroke();

  // Subtle Islamic geometric corner ornaments & thin semi-transparent side lines (Requirement 2.9)
  drawPlcCornerOrnamentsAndSideLines(ctx, 36);

  // Top Petrol Green & Muted Gold accent bar
  const headerBoxY = PLC_REPORT_DESIGN_SYSTEM.spacing.interiorHeaderTopY;
  const headerBoxH = PLC_REPORT_DESIGN_SYSTEM.spacing.interiorHeaderHeight;

  drawRoundedBox(ctx, MARGIN_X, headerBoxY, CONTENT_W, headerBoxH, 16);
  ctx.fillStyle = ivory;
  ctx.fill();
  ctx.strokeStyle = petrolGreen;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Top Petrol Green stripe inside header box
  drawRoundedBox(ctx, MARGIN_X, headerBoxY, CONTENT_W, 10, 6);
  ctx.fillStyle = petrolGreen;
  ctx.fill();

  // Bottom Muted Gold rule on header box
  ctx.fillStyle = mutedGold;
  ctx.fillRect(MARGIN_X + 20, headerBoxY + headerBoxH - 4, CONTENT_W - 40, 3);

  // Right Zone: Official Ministry & School Identity (Centered in Right Zone)
  const rightZoneW = 520;
  const rightCenterX = PAGE_W - MARGIN_X - rightZoneW / 2;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = petrolGreen;
  ctx.font = `700 19px ${FONT_FAMILY}`;
  ctx.fillText('المملكة العربية السعودية — وزارة التعليم', rightCenterX, headerBoxY + 42);

  ctx.fillStyle = deepTurquoise;
  ctx.font = `600 17px ${FONT_FAMILY}`;
  const eduText = settings.educationDepartment?.trim() || 'الإدارة العامة للتعليم';
  ctx.fillText(eduText, rightCenterX, headerBoxY + 76);

  ctx.fillStyle = darkInk;
  ctx.font = `700 19px ${FONT_FAMILY}`;
  const schoolText = settings.schoolName?.trim() || 'المدرسة';
  ctx.fillText(schoolText, rightCenterX, headerBoxY + 112);

  // Center Zone: Official Ministry of Education Logo (`./moe-logo.png`)
  drawOfficialMinistryLogo(ctx, PAGE_W / 2, headerBoxY + 14, 152);

  // Left Zone: Report Title, Full Community Name & Academic Year
  const leftZoneW = 540;
  const leftCenterX = MARGIN_X + leftZoneW / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = petrolGreen;
  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.fillText(
    customReportTitle || 'التقرير النهائي لمجتمع التعلّم المهني',
    leftCenterX,
    headerBoxY + 36
  );

  ctx.fillStyle = darkInk;
  ctx.font = `700 16px ${FONT_FAMILY}`;
  const commWrapped = wrapArabicCellText(report.communityName, 510, 10.2, ctx).slice(0, 2);
  if (commWrapped.length === 1) {
    ctx.fillText(commWrapped[0], leftCenterX, headerBoxY + 74);
  } else {
    ctx.fillText(commWrapped[0], leftCenterX, headerBoxY + 64);
    ctx.fillText(commWrapped[1], leftCenterX, headerBoxY + 90);
  }

  ctx.fillStyle = deepTurquoise;
  ctx.font = `600 15px ${FONT_FAMILY}`;
  ctx.fillText(
    `العام الدراسي: ${report.section9_1.academicYear} • ${report.section9_1.semesterLabel}`,
    leftCenterX,
    headerBoxY + 122
  );
}

/**
 * Draws the official Interior Page Footer (Pages 2..N):
 * - Contains ONLY the page number (e.g. `"2"`, NOT `"2 of 6"`).
 */
export function drawInteriorPageFooter(
  ctx: CanvasRenderingContext2D,
  _report: PlcGeneratedFinalReport,
  _settings: SchoolSettings,
  pagePlan: PlcPdfPagePlan
) {
  if (pagePlan.isCoverPage || !pagePlan.footerLabel) return;

  const { petrolGreen, mutedGold, ivory, white } = PLC_REPORT_DESIGN_SYSTEM.colors;
  const footerY = PAGE_H - 112;

  // Subtle horizontal Muted Gold & Ivory line flanking the centered page number
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + 180, footerY + 24);
  ctx.lineTo(PAGE_W / 2 - 54, footerY + 24);
  ctx.moveTo(PAGE_W / 2 + 54, footerY + 24);
  ctx.lineTo(PAGE_W - MARGIN_X - 180, footerY + 24);
  ctx.stroke();

  // Centered Page Number Medallion (ONLY page number, e.g. "2")
  const badgeW = 76;
  const badgeH = 48;
  const badgeX = (PAGE_W - badgeW) / 2;
  const badgeY = footerY;

  drawRoundedBox(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = petrolGreen;
  ctx.fill();
  ctx.strokeStyle = mutedGold;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = white || ivory;
  ctx.font = `700 ${PLC_REPORT_DESIGN_SYSTEM.fonts.footerPageNumPx}px ${FONT_FAMILY}`;
  ctx.fillText(pagePlan.footerLabel, PAGE_W / 2, badgeY + 32);
}

function drawMiniChartBox(
  ctx: CanvasRenderingContext2D,
  chart: PlcFinalReportChartModel,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const { petrolGreen, deepTurquoise, mutedGold, ivory, white, darkInk, cardBorder } =
    PLC_REPORT_DESIGN_SYSTEM.colors;

  drawRoundedBox(ctx, x, y, w, h, 14);
  ctx.fillStyle = white;
  ctx.fill();
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Top header band inside chart card
  drawRoundedBox(ctx, x, y, w, 62, 12);
  ctx.fillStyle = ivory;
  ctx.fill();

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = petrolGreen;
  ctx.font = `700 19px ${FONT_FAMILY}`;
  ctx.fillText(chart.title, x + w / 2, y + 29);

  ctx.fillStyle = deepTurquoise;
  ctx.font = `600 14px ${FONT_FAMILY}`;
  ctx.fillText(chart.subtitle, x + w / 2, y + 52);

  if (!chart.hasSufficientData || chart.items.length === 0) {
    ctx.fillStyle = mutedGold;
    ctx.font = `700 17px ${FONT_FAMILY}`;
    ctx.fillText(chart.emptyMessage, x + w / 2, y + 120);
    return;
  }

  const maxVal = Math.max(1, ...chart.items.map((it) => Math.max(it.value || 0, 0)));
  const totalVal = chart.items.reduce((acc, it) => acc + (it.value || 0), 0);
  const labelZoneW = 165;
  const valueZoneW = 135;
  const barRightX = x + w - 20 - labelZoneW;
  const barMaxW = Math.max(80, w - 40 - labelZoneW - valueZoneW);

  let rowY = y + 76;
  const barPalette = [petrolGreen, deepTurquoise, mutedGold, '#1E6B68', '#2C5E66'];
  chart.items.slice(0, 5).forEach((item, idx) => {
    ctx.textAlign = 'right';
    ctx.fillStyle = darkInk;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(item.label, x + w - 20, rowY + 20);

    // Track background
    drawRoundedBox(ctx, barRightX - barMaxW, rowY + 5, barMaxW, 18, 6);
    ctx.fillStyle = ivory;
    ctx.fill();

    // Active bar
    const barW = item.value > 0 ? Math.max(12, Math.round((item.value / maxVal) * barMaxW)) : 4;
    drawRoundedBox(ctx, barRightX - barW, rowY + 5, barW, 18, 6);
    ctx.fillStyle = barPalette[idx % barPalette.length];
    ctx.fill();

    // Numeric value + percentage next to bar
    const pct = totalVal > 0 ? Math.round((item.value / totalVal) * 100) : 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = darkInk;
    ctx.font = `700 14.5px ${FONT_FAMILY}`;
    ctx.fillText(`${item.value} (${pct}٪)`, x + 18, rowY + 20);

    rowY += 34;
  });
}

export function drawBlockOnCanvas(
  ctx: CanvasRenderingContext2D,
  block: PlcPdfBlock,
  startY: number,
  _settings: SchoolSettings,
  nextBlockKind?: PlcPdfBlock['kind'],
  pageLinksOut?: PlcPdfLinkAnnotation[],
  pageQrSpotsOut?: PlcRenderedQrSpot[]
): number {
  const {
    petrolGreen,
    deepTurquoise,
    mutedGold,
    ivory,
    white,
    softIvory,
    darkInk,
    bodyInk,
    tableBorder,
    cardBorder,
    goldSubtleBg,
    turquoiseSubtleBg,
  } = PLC_REPORT_DESIGN_SYSTEM.colors;

  ctx.direction = 'rtl';

  // =========================================================================
  // 1. STANDALONE SECTION HEADER (`01` .. `05` + Prominent Title)
  // =========================================================================
  if (block.kind === 'section_header') {
    const boxH = block.estimatedHeight;
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, boxH, 16);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Bottom Muted Gold rule inside section banner
    ctx.fillStyle = mutedGold;
    ctx.fillRect(MARGIN_X + 24, startY + boxH - 6, CONTENT_W - 48, 4);

    // Prominent Section Number Badge (`01`, `02`, `03`, `04`, `05`) on the Right
    const numBoxW = 84;
    const numBoxH = boxH - 24;
    const numBoxX = PAGE_W - MARGIN_X - 16 - numBoxW;
    const numBoxY = startY + 10;
    drawRoundedBox(ctx, numBoxX, numBoxY, numBoxW, numBoxH, 12);
    ctx.fillStyle = mutedGold;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 ${PLC_REPORT_DESIGN_SYSTEM.fonts.sectionNumberPx}px ${FONT_FAMILY}`;
    ctx.fillText(block.sectionNumber, numBoxX + numBoxW / 2, numBoxY + numBoxH / 2 + 11);

    // Centered Section Title & Subtitle in the main banner area
    const centerTitleX = PAGE_W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 ${PLC_REPORT_DESIGN_SYSTEM.fonts.sectionTitlePx}px ${FONT_FAMILY}`;
    ctx.fillText(block.title, centerTitleX, startY + (block.subtitle ? 38 : 54));

    if (block.subtitle) {
      ctx.font = `600 16px ${FONT_FAMILY}`;
      ctx.fillStyle = ivory;
      ctx.fillText(block.subtitle, centerTitleX, startY + 68);
    }

    if (block.badgeText) {
      const badgeW = 236;
      const badgeH = 40;
      const badgeX = MARGIN_X + 18;
      const badgeY = startY + (boxH - badgeH) / 2 - 2;
      drawRoundedBox(ctx, badgeX, badgeY, badgeW, badgeH, 10);
      ctx.fillStyle = deepTurquoise;
      ctx.fill();
      ctx.strokeStyle = mutedGold;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = white;
      ctx.font = `700 16px ${FONT_FAMILY}`;
      ctx.fillText(block.badgeText, badgeX + badgeW / 2, badgeY + 26);
    }

    return startY + boxH + 22;
  }

  // =========================================================================
  // 2. KPI STAT CARDS (Page 2 Summary — Balanced & High Contrast)
  // =========================================================================
  if (block.kind === 'kpi_stat_cards') {
    const cols = 3;
    const gapX = 20;
    const gapY = 16;
    const cardW = Math.floor((CONTENT_W - gapX * (cols - 1)) / cols);
    const cardH = 96;

    const tonePalette = {
      petrol: { bg: white, headerBg: petrolGreen, border: petrolGreen, val: petrolGreen },
      turquoise: { bg: white, headerBg: deepTurquoise, border: deepTurquoise, val: deepTurquoise },
      gold: { bg: goldSubtleBg, headerBg: petrolGreen, border: mutedGold, val: petrolGreen },
      ivory: { bg: ivory, headerBg: deepTurquoise, border: cardBorder, val: darkInk },
    };

    block.cards.forEach((card, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const cardX = PAGE_W - MARGIN_X - (c + 1) * cardW - c * gapX;
      const cardY = startY + r * (cardH + gapY);
      const pal = tonePalette[card.tone];
      const centerX = cardX + cardW / 2;

      drawRoundedBox(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.fillStyle = pal.bg;
      ctx.fill();
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Top accent bar on each KPI card
      drawRoundedBox(ctx, cardX, cardY, cardW, 8, 4);
      ctx.fillStyle = pal.headerBg;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = bodyInk;
      ctx.font = `700 16px ${FONT_FAMILY}`;
      ctx.fillText(card.label, centerX, cardY + 30);

      ctx.fillStyle = pal.val;
      ctx.font = `700 ${PLC_REPORT_DESIGN_SYSTEM.fonts.kpiValuePx}px ${FONT_FAMILY}`;
      ctx.fillText(card.value, centerX, cardY + 62);

      ctx.fillStyle = darkInk;
      ctx.font = `600 14px ${FONT_FAMILY}`;
      const subLines = wrapArabicCellText(card.sublabel, cardW - 28, 10, ctx);
      ctx.fillText(subLines[0], centerX, cardY + 84);
    });

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 3. VISUAL TRACEABILITY CHAIN (`الاحتياج ← الهدف ← الإجراء ← النتيجة`)
  // =========================================================================
  if (block.kind === 'traceability_chain') {
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, block.estimatedHeight, 16);
    ctx.fillStyle = ivory;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Header band inside traceability box
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 64, 14);
    ctx.fillStyle = deepTurquoise;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 20px ${FONT_FAMILY}`;
    ctx.fillText(block.title, PAGE_W / 2, startY + 29);

    ctx.fillStyle = ivory;
    ctx.font = `600 15px ${FONT_FAMILY}`;
    ctx.fillText(block.subtitle, PAGE_W / 2, startY + 53);

    // 4 Connected Visual Stages (Right-to-Left: 1 Need -> 2 Goal -> 3 Action -> 4 Result)
    const stageCount = block.stages.length;
    const arrowGap = 32;
    const innerPadX = 24;
    const totalStagesW = CONTENT_W - innerPadX * 2 - arrowGap * (stageCount - 1);
    const stageW = Math.floor(totalStagesW / stageCount);
    const stageH = block.estimatedHeight - 88;
    const stageY = startY + 74;

    block.stages.forEach((st, idx) => {
      const stageX = PAGE_W - MARGIN_X - innerPadX - (idx + 1) * stageW - idx * arrowGap;
      const stageCenterX = stageX + stageW / 2;

      drawRoundedBox(ctx, stageX, stageY, stageW, stageH, 12);
      ctx.fillStyle = white;
      ctx.fill();
      ctx.strokeStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Stage Pill Header
      drawRoundedBox(ctx, stageX, stageY, stageW, 38, 10);
      ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = mutedGold;
      ctx.font = `700 18px ${FONT_FAMILY}`;
      ctx.fillText(`${st.stepNumber}. ${st.stageTitle}`, stageCenterX, stageY + 26);

      ctx.fillStyle = petrolGreen;
      ctx.font = `700 16px ${FONT_FAMILY}`;
      ctx.fillText(st.headline, stageCenterX, stageY + 64);

      ctx.fillStyle = darkInk;
      ctx.font = `600 14px ${FONT_FAMILY}`;
      st.detailLines.slice(0, 3).forEach((ln, lIdx) => {
        ctx.fillText(ln, stageCenterX, stageY + 90 + lIdx * 22);
      });

      // Draw directional RTL arrow (`←`) between stages
      if (idx < stageCount - 1) {
        const arrowCenterX = stageX - arrowGap / 2;
        const arrowCenterY = stageY + stageH / 2;
        ctx.fillStyle = mutedGold;
        ctx.font = `700 26px ${FONT_FAMILY}`;
        ctx.fillText('←', arrowCenterX, arrowCenterY + 8);
      }
    });

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 4. KEY-VALUE GRID
  // =========================================================================
  if (block.kind === 'kv_grid') {
    const cols = block.columns;
    const gap = 14;
    const cellW = Math.floor((CONTENT_W - gap * (cols - 1)) / cols);

    let rowY = startY;
    const rowCount = block.rowHeights.length;
    for (let r = 0; r < rowCount; r++) {
      const cellH = block.rowHeights[r];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= block.items.length) break;
        const item = block.items[idx];
        const cellX = PAGE_W - MARGIN_X - (c + 1) * cellW - c * gap;
        const centerX = cellX + cellW / 2;

        drawRoundedBox(ctx, cellX, rowY, cellW, cellH, 10);
        ctx.fillStyle = white;
        ctx.fill();
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = deepTurquoise;
        ctx.font = `700 16px ${FONT_FAMILY}`;
        ctx.fillText(item.label, centerX, rowY + 26);

        ctx.fillStyle = darkInk;
        ctx.font = `700 18px ${FONT_FAMILY}`;
        item.valueLines.forEach((ln, lIdx) => {
          ctx.fillText(ln, centerX, rowY + 54 + lIdx * 25);
        });
      }
      rowY += cellH + 10;
    }

    return startY + block.estimatedHeight + 18;
  }

  // =========================================================================
  // 5. PARAGRAPHS / SUMMARY CARD (Supports Right-Aligned Bullets & Highlighted Sub-headings)
  // =========================================================================
  if (block.kind === 'paragraphs_box') {
    const toneStyles = {
      neutral: { bg: softIvory, border: cardBorder, headerBg: petrolGreen, title: white },
      emerald: { bg: turquoiseSubtleBg, border: deepTurquoise, headerBg: deepTurquoise, title: white },
      amber: { bg: goldSubtleBg, border: mutedGold, headerBg: petrolGreen, title: white },
      indigo: { bg: softIvory, border: petrolGreen, headerBg: petrolGreen, title: white },
      maroon: { bg: ivory, border: petrolGreen, headerBg: petrolGreen, title: white },
    }[block.tone || 'neutral'];

    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, block.estimatedHeight, 14);
    ctx.fillStyle = toneStyles.bg;
    ctx.fill();
    ctx.strokeStyle = toneStyles.border;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    let textY = startY + 34;
    if (block.title) {
      drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 40, 12);
      ctx.fillStyle = toneStyles.headerBg;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = toneStyles.title;
      ctx.font = `700 18px ${FONT_FAMILY}`;
      ctx.fillText(block.title, PAGE_W / 2, startY + 27);
      textY = startY + 68;
    }

    const rightEdgeX = PAGE_W - MARGIN_X - 24;

    if (block.highlightedNotes && block.highlightedNotes.length > 0) {
      for (const note of block.highlightedNotes) {
        const prefixText = `• ${note.prefix}: `;
        ctx.textAlign = 'right';
        ctx.font = `700 17px ${FONT_FAMILY}`;
        ctx.fillStyle = note.prefixColorHex || deepTurquoise;
        ctx.fillText(prefixText, rightEdgeX, textY);

        const prefixW = ctx.measureText(prefixText).width || prefixText.length * 10.5;
        const firstLineMaxW = Math.max(240, CONTENT_W - 88 - prefixW);
        const bodyLines = wrapArabicCellText(note.text, firstLineMaxW, 11.8, ctx).slice(0, 2);

        ctx.font = `600 17px ${FONT_FAMILY}`;
        ctx.fillStyle = darkInk;
        if (bodyLines.length > 0) {
          ctx.fillText(bodyLines[0], rightEdgeX - prefixW, textY);
          textY += 29;
        }
        if (bodyLines.length > 1) {
          ctx.fillText(bodyLines[1], rightEdgeX - 18, textY);
          textY += 29;
        }
        textY += 4;
      }
    } else {
      ctx.fillStyle = darkInk;
      ctx.font = `700 17px ${FONT_FAMILY}`;
      for (const line of block.lines) {
        if (block.centerAligned) {
          ctx.textAlign = 'center';
          ctx.fillText(line, PAGE_W / 2, textY);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(line, rightEdgeX, textY);
        }
        textY += 29;
      }
    }

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 5B. TEAM MEMBERS INDIVIDUAL CARDS (Page 3 — Each Member in a Separate Card)
  // =========================================================================
  if (block.kind === 'team_members_cards') {
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, block.estimatedHeight, 14);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 40, 12);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(block.title, PAGE_W / 2, startY + 27);

    const count = block.members.length;
    if (count > 0) {
      const cols = Math.min(4, Math.max(2, count));
      const gapX = 16;
      const gapY = 12;
      const innerPadX = 20;
      const cardW = Math.floor((CONTENT_W - innerPadX * 2 - gapX * (cols - 1)) / cols);
      const cardH = 70;
      const cardsStartY = startY + 50;

      block.members.forEach((m, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const cardX = PAGE_W - MARGIN_X - innerPadX - (c + 1) * cardW - c * gapX;
        const cardY = cardsStartY + r * (cardH + gapY);
        const centerX = cardX + cardW / 2;

        drawRoundedBox(ctx, cardX, cardY, cardW, cardH, 10);
        ctx.fillStyle = white;
        ctx.fill();
        ctx.strokeStyle = m.isLeader ? mutedGold : deepTurquoise;
        ctx.lineWidth = m.isLeader ? 2 : 1.6;
        ctx.stroke();

        // Top accent bar inside each individual member card
        drawRoundedBox(ctx, cardX, cardY, cardW, 7, 4);
        ctx.fillStyle = m.isLeader ? petrolGreen : deepTurquoise;
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.fillStyle = darkInk;
        ctx.font = `700 17px ${FONT_FAMILY}`;
        const nameLine = wrapArabicCellText(m.name, cardW - 18, 10.5, ctx)[0];
        ctx.fillText(nameLine, centerX, cardY + 34);

        ctx.fillStyle = m.isLeader ? petrolGreen : deepTurquoise;
        ctx.font = `600 14px ${FONT_FAMILY}`;
        const roleLine = wrapArabicCellText(
          `${m.roleLabel}${m.specialty ? ` • ${m.specialty}` : ''}`,
          cardW - 18,
          9.5,
          ctx
        )[0];
        ctx.fillText(roleLine, centerX, cardY + 57);
      });
    }

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 6. IMPACT DISTINCTION STRIP (Page 5 — 3-Part Visual Distinction)
  // =========================================================================
  if (block.kind === 'impact_distinction_strip') {
    const gap = 16;
    const cardW = Math.floor((CONTENT_W - gap * 2) / 3);
    const cardH = block.estimatedHeight;

    const stripTones = {
      slate: { bg: white, headerBg: petrolGreen, border: petrolGreen, metric: petrolGreen },
      amber: { bg: goldSubtleBg, headerBg: deepTurquoise, border: mutedGold, metric: deepTurquoise },
      emerald: { bg: turquoiseSubtleBg, headerBg: petrolGreen, border: deepTurquoise, metric: petrolGreen },
    };

    block.items.forEach((item, idx) => {
      const cardX = PAGE_W - MARGIN_X - (idx + 1) * cardW - idx * gap;
      const centerX = cardX + cardW / 2;
      const st = stripTones[item.tone];

      drawRoundedBox(ctx, cardX, startY, cardW, cardH, 14);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.strokeStyle = st.border;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      drawRoundedBox(ctx, cardX, startY, cardW, 40, 12);
      ctx.fillStyle = st.headerBg;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = white;
      ctx.font = `700 17px ${FONT_FAMILY}`;
      ctx.fillText(item.title, centerX, startY + 26);

      ctx.fillStyle = st.metric;
      ctx.font = `700 18px ${FONT_FAMILY}`;
      ctx.fillText(item.metric, centerX, startY + 68);

      ctx.fillStyle = darkInk;
      ctx.font = `600 15px ${FONT_FAMILY}`;
      item.descriptionLines.slice(0, 3).forEach((ln, lIdx) => {
        ctx.fillText(ln, centerX, startY + 98 + lIdx * 24);
      });
    });

    return startY + block.estimatedHeight + 22;
  }

  // =========================================================================
  // 7. OFFICIAL TABLE (Unified Petrol Green Header, White Cells, Thick Borders, CENTERED TEXT)
  // =========================================================================
  if (block.kind === 'table') {
    let curY = startY;
    if (block.title) {
      ctx.textAlign = 'center';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 20px ${FONT_FAMILY}`;
      ctx.fillText(block.title, PAGE_W / 2, curY + 28);
      curY += 42;
    }
    if (block.subtitleNote) {
      ctx.textAlign = 'center';
      ctx.fillStyle = deepTurquoise;
      ctx.font = `600 15px ${FONT_FAMILY}`;
      ctx.fillText(block.subtitleNote, PAGE_W / 2, curY + 20);
      curY += 30;
    }

    const totalWeight = block.columnWeightPercents.reduce((a, b) => a + b, 0) || 100;
    const colWidths = block.columnWeightPercents.map((w) =>
      Math.floor((w / totalWeight) * CONTENT_W)
    );

    // Header Row: Unified Petrol Green (`#153C43`) background, White centered text, Muted Gold bottom rule
    let colRightX = PAGE_W - MARGIN_X;
    for (let c = 0; c < block.headers.length; c++) {
      const colW = c === block.headers.length - 1 ? colRightX - MARGIN_X : colWidths[c];
      const cellX = colRightX - colW;
      const cellCenterX = cellX + colW / 2;

      ctx.fillStyle = petrolGreen;
      ctx.fillRect(cellX, curY, colW, block.headerHeight);

      // Muted Gold accent line at the bottom of the table header
      ctx.fillStyle = mutedGold;
      ctx.fillRect(cellX, curY + block.headerHeight - 4, colW, 4);

      ctx.strokeStyle = tableBorder;
      ctx.lineWidth = PLC_REPORT_DESIGN_SYSTEM.borders.tableBorderWidth;
      ctx.strokeRect(cellX, curY, colW, block.headerHeight);

      ctx.textAlign = 'center';
      ctx.fillStyle = white;
      ctx.font = `700 ${PLC_REPORT_DESIGN_SYSTEM.fonts.tableHeaderPx}px ${FONT_FAMILY}`;
      ctx.fillText(block.headers[c], cellCenterX, curY + 33);

      colRightX -= colW;
    }
    curY += block.headerHeight;

    // Data Rows: Crisp White (`#FFFFFF`) background, thick clear borders, horizontally & vertically centered dark text
    for (let r = 0; r < block.wrappedRows.length; r++) {
      const rowCells = block.wrappedRows[r];
      const rH = block.rowHeights[r];
      let rColRightX = PAGE_W - MARGIN_X;

      for (let c = 0; c < block.headers.length; c++) {
        const colW = c === block.headers.length - 1 ? rColRightX - MARGIN_X : colWidths[c];
        const cellX = rColRightX - colW;
        const cellCenterX = cellX + colW / 2;

        ctx.fillStyle = white;
        ctx.fillRect(cellX, curY, colW, rH);
        ctx.strokeStyle = tableBorder;
        ctx.lineWidth = PLC_REPORT_DESIGN_SYSTEM.borders.tableBorderWidth;
        ctx.strokeRect(cellX, curY, colW, rH);

        ctx.textAlign = 'center';
        ctx.fillStyle = c === 0 ? petrolGreen : darkInk;
        ctx.font = `${c === 0 ? '700' : '600'} ${PLC_REPORT_DESIGN_SYSTEM.fonts.tableCellPx}px ${FONT_FAMILY}`;
        const cellLines = rowCells[c] || ['غير متوفر'];
        const totalTextH = cellLines.length * 28;
        const firstBaselineY = curY + Math.max(28, Math.round((rH - totalTextH) / 2) + 21);

        for (let lIdx = 0; lIdx < cellLines.length; lIdx++) {
          ctx.fillText(cellLines[lIdx], cellCenterX, firstBaselineY + lIdx * 28);
        }

        rColRightX -= colW;
      }
      curY += rH;
    }

    const gapAfterTable =
      nextBlockKind === 'table'
        ? PLC_REPORT_DESIGN_SYSTEM.spacing.tableGap
        : PLC_REPORT_DESIGN_SYSTEM.spacing.blockGap;

    return startY + block.estimatedHeight + gapAfterTable;
  }

  // =========================================================================
  // 8. DUAL SUMMARY CHARTS + ANALYTICAL PARAGRAPH BELOW CHARTS (Page 2 — Req 2.3)
  // =========================================================================
  if (block.kind === 'dual_charts') {
    const gap = 20;
    const halfW = Math.floor((CONTENT_W - gap) / 2);
    const rightX = PAGE_W - MARGIN_X - halfW;
    const leftX = MARGIN_X;
    const chartsH = block.chartsHeight || block.estimatedHeight;

    drawMiniChartBox(ctx, block.rightChart, rightX, startY, halfW, chartsH);
    drawMiniChartBox(ctx, block.leftChart, leftX, startY, halfW, chartsH);

    if (block.analyticalParagraphLines && block.analyticalParagraphLines.length > 0) {
      const boxY = startY + chartsH + 10;
      const boxH = block.estimatedHeight - chartsH - 10;
      drawRoundedBox(ctx, MARGIN_X, boxY, CONTENT_W, boxH, 10);
      ctx.fillStyle = softIvory;
      ctx.fill();
      ctx.strokeStyle = mutedGold;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `600 15.5px ${FONT_FAMILY}`;
      block.analyticalParagraphLines.forEach((ln, idx) => {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 20, boxY + 26 + idx * 25);
      });
    }

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 8B. PAGE 2 VISUAL ANALYTICS: DONUT CHARTS + CATEGORICAL DISTRIBUTION + TARGET VS ACTUAL
  // =========================================================================
  if (block.kind === 'page2_visual_analytics') {
    const curH = block.estimatedHeight;
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, curH, 16);
    ctx.fillStyle = ivory;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Top Header Band
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 42, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.fillStyle = mutedGold;
    ctx.fillRect(MARGIN_X + 20, startY + 39, CONTENT_W - 40, 3);

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 18px ${FONT_FAMILY}`;
    ctx.fillText(
      'المؤشرات الدائرية لتحقق المستهدفات والتوزيع التصنيفي للأعمال والممارسات المهنية',
      PAGE_W / 2,
      startY + 28
    );

    // ROW 1: 3 Harmonious Donut / Circular Progress Indicators
    const donuts = block.donuts.slice(0, 3);
    const row1Y = startY + 54;
    const row1H = 244;

    if (donuts.length > 0) {
      const gapX = 16;
      const innerPadX = 18;
      const dCardW = Math.floor(
        (CONTENT_W - innerPadX * 2 - gapX * (donuts.length - 1)) / donuts.length
      );

      donuts.forEach((d, idx) => {
        const cardX = PAGE_W - MARGIN_X - innerPadX - (idx + 1) * dCardW - idx * gapX;
        const centerX = cardX + dCardW / 2;

        drawRoundedBox(ctx, cardX, row1Y, dCardW, row1H, 12);
        ctx.fillStyle = white;
        ctx.fill();
        ctx.strokeStyle = cardBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Card title
        ctx.textAlign = 'center';
        ctx.fillStyle = petrolGreen;
        ctx.font = `700 16px ${FONT_FAMILY}`;
        ctx.fillText(d.title, centerX, row1Y + 28);

        // Donut ring
        const ringCx = centerX;
        const ringCy = row1Y + 118;
        const ringRadius = 56;
        const ringThickness = 15;

        ctx.save();
        ctx.lineWidth = ringThickness;
        ctx.lineCap = 'round';

        // Background track ring
        ctx.strokeStyle = softIvory;
        ctx.beginPath();
        ctx.arc(ringCx, ringCy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Secondary segment (remaining)
        ctx.strokeStyle = d.secondaryRingColorHex;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(ringCx, ringCy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Primary progress arc
        const clampedPct = Math.max(0, Math.min(100, d.percentage));
        if (clampedPct > 0) {
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (clampedPct / 100) * Math.PI * 2;
          ctx.strokeStyle = d.ringColorHex;
          ctx.beginPath();
          ctx.arc(ringCx, ringCy, ringRadius, startAngle, endAngle);
          ctx.stroke();
        }
        ctx.restore();

        // Center percentage & fraction inside Donut
        ctx.textAlign = 'center';
        ctx.fillStyle = darkInk;
        ctx.font = `700 22px ${FONT_FAMILY}`;
        ctx.fillText(d.centerPrimaryText, ringCx, ringCy + 4);

        ctx.fillStyle = deepTurquoise;
        ctx.font = `600 13px ${FONT_FAMILY}`;
        ctx.fillText(d.centerSecondaryText, ringCx, ringCy + 24);

        // Legend pills at bottom of Donut card
        ctx.font = `600 13.5px ${FONT_FAMILY}`;
        ctx.fillStyle = d.ringColorHex;
        ctx.fillText(
          `● ${d.completedLabel}   |   ○ ${d.remainingLabel}`,
          centerX,
          row1Y + row1H - 18
        );
      });
    }

    // ROW 2: Two Complementary Visual Panels (Right: Categorical Breakdown of Activities | Left: Target vs Actual & Priority Matrix)
    const row2Y = row1Y + row1H + 14;
    const row2H = curH - (row2Y - startY) - 14;
    const panelGap = 16;
    const innerPadX = 18;
    const panelW = Math.floor((CONTENT_W - innerPadX * 2 - panelGap) / 2);
    const rightPanelX = PAGE_W - MARGIN_X - innerPadX - panelW;
    const leftPanelX = MARGIN_X + innerPadX;

    // Right Panel: التوزيع البصري للأعمال والأنشطة بحسب تصنيفاتها
    drawRoundedBox(ctx, rightPanelX, row2Y, panelW, row2H, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawRoundedBox(ctx, rightPanelX, row2Y, panelW, 36, 10);
    ctx.fillStyle = deepTurquoise;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(
      'التوزيع البصري للأعمال والأنشطة بحسب تصنيفاتها',
      rightPanelX + panelW / 2,
      row2Y + 24
    );

    if (block.categoryDistributions.length > 0) {
      // Proportional multi-segment horizontal bar at the top of the panel
      const segBarX = rightPanelX + 20;
      const segBarY = row2Y + 48;
      const segBarW = panelW - 40;
      const segBarH = 16;
      drawRoundedBox(ctx, segBarX, segBarY, segBarW, segBarH, 6);
      ctx.fillStyle = softIvory;
      ctx.fill();

      let segCursorRight = segBarX + segBarW;
      const totalCats =
        block.categoryDistributions.reduce((s, c) => s + c.totalCount, 0) || 1;
      block.categoryDistributions.forEach((cat, cIdx) => {
        if (cat.totalCount <= 0) return;
        const w = Math.max(
          24,
          Math.round((cat.totalCount / totalCats) * segBarW)
        );
        const drawW = Math.min(w, segCursorRight - segBarX);
        if (drawW > 0) {
          ctx.fillStyle =
            cIdx % 3 === 0
              ? petrolGreen
              : cIdx % 3 === 1
              ? deepTurquoise
              : mutedGold;
          ctx.fillRect(segCursorRight - drawW, segBarY, drawW, segBarH);
          segCursorRight -= drawW;
        }
      });

      let catRowY = row2Y + 82;
      block.categoryDistributions.forEach((cat) => {
        const rightLabelX = rightPanelX + panelW - 18;
        ctx.textAlign = 'right';
        ctx.fillStyle = darkInk;
        ctx.font = `700 14.5px ${FONT_FAMILY}`;
        ctx.fillText(cat.label, rightLabelX, catRowY + 14);

        const barRightX = rightPanelX + panelW - 165;
        const barMaxW = Math.max(120, panelW - 310);
        const execRatio =
          cat.totalCount > 0 ? cat.executedCount / cat.totalCount : 0;
        const fillW =
          cat.executedCount > 0
            ? Math.max(14, Math.round(execRatio * barMaxW))
            : 0;

        drawRoundedBox(ctx, barRightX - barMaxW, catRowY + 2, barMaxW, 14, 5);
        ctx.fillStyle = ivory;
        ctx.fill();

        if (fillW > 0) {
          drawRoundedBox(ctx, barRightX - fillW, catRowY + 2, fillW, 14, 5);
          ctx.fillStyle = cat.colorHex;
          ctx.fill();
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = petrolGreen;
        ctx.font = `700 13.5px ${FONT_FAMILY}`;
        ctx.fillText(
          `منفذ: ${cat.executedCount}/${cat.totalCount} (${cat.percentage}%)`,
          rightPanelX + 16,
          catRowY + 14
        );

        catRowY += 44;
      });
    }

    // Left Panel: مقارنة مرئية بين المستهدف والمتحقق وعلاقتها بالاحتياجات والأهداف
    drawRoundedBox(ctx, leftPanelX, row2Y, panelW, row2H, 12);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawRoundedBox(ctx, leftPanelX, row2Y, panelW, 36, 10);
    ctx.fillStyle = petrolGreen;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 15.5px ${FONT_FAMILY}`;
    ctx.fillText(
      'مقارنة المستهدف بالمتحقق وترابط الاحتياجات بالأثر',
      leftPanelX + panelW / 2,
      row2Y + 24
    );

    // Compact Needs-to-Impact relational pill strip at top of left panel
    const np = block.needsPrioritySummary;
    const relStripY = row2Y + 46;
    drawRoundedBox(ctx, leftPanelX + 16, relStripY, panelW - 32, 34, 8);
    ctx.fillStyle = softIvory;
    ctx.fill();
    ctx.strokeStyle = mutedGold;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = darkInk;
    ctx.font = `700 13.5px ${FONT_FAMILY}`;
    ctx.fillText(
      `الاحتياجات (${np.totalNeeds}: عالية ${np.high} • متوسطة ${np.medium}) ← الأهداف (${np.totalGoals}) ← أثر مقاس (${np.verifiedImpacts})`,
      leftPanelX + panelW / 2,
      relStripY + 22
    );

    // Paired Target vs Actual visual bars for top KPIs
    let kpiCompY = relStripY + 48;
    block.targetVsActualItems.forEach((item) => {
      const rightLabelX = leftPanelX + panelW - 16;
      const shortLabel = wrapArabicCellText(item.label, panelW - 36, 10.5, ctx)[0];
      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 13.5px ${FONT_FAMILY}`;
      ctx.fillText(shortLabel, rightLabelX, kpiCompY + 13);

      const barRight = leftPanelX + panelW - 18;
      const barMaxW = Math.max(120, panelW - 315);
      const maxRef = Math.max(1, item.targetValue, item.actualValue);
      const targetW = Math.max(12, Math.round((item.targetValue / maxRef) * barMaxW));
      const actualW = Math.max(12, Math.round((item.actualValue / maxRef) * barMaxW));

      // Target bar (Muted Gold) & Actual bar (Petrol Green)
      drawRoundedBox(ctx, barRight - barMaxW, kpiCompY + 20, barMaxW, 8, 4);
      ctx.fillStyle = ivory;
      ctx.fill();
      drawRoundedBox(ctx, barRight - targetW, kpiCompY + 20, targetW, 8, 4);
      ctx.fillStyle = mutedGold;
      ctx.fill();

      drawRoundedBox(ctx, barRight - barMaxW, kpiCompY + 31, barMaxW, 8, 4);
      ctx.fillStyle = ivory;
      ctx.fill();
      drawRoundedBox(ctx, barRight - actualW, kpiCompY + 31, actualW, 8, 4);
      ctx.fillStyle = petrolGreen;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = deepTurquoise;
      ctx.font = `700 12.5px ${FONT_FAMILY}`;
      ctx.fillText(
        `المستهدف: ${item.targetValue} | المتحقق: ${item.actualValue} (${item.achievementPercentage}%)`,
        leftPanelX + 16,
        kpiCompY + 33
      );

      kpiCompY += 54;
    });

    return startY + curH + 20;
  }

  // =========================================================================
  // 9. SINGLE ANALYTICAL CHART + ANALYTICAL READING BELOW CHART (Page 4 & Page 5 — Req 2.5)
  // =========================================================================
  if (block.kind === 'chart') {
    const chart = block.chart;
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, block.estimatedHeight, 14);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 66, 12);
    ctx.fillStyle = ivory;
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 20px ${FONT_FAMILY}`;
    ctx.fillText(chart.title, PAGE_W - MARGIN_X - 24, startY + 32);

    ctx.fillStyle = deepTurquoise;
    ctx.font = `600 15px ${FONT_FAMILY}`;
    ctx.fillText(chart.subtitle, PAGE_W - MARGIN_X - 24, startY + 56);

    if (chart.chartKind === 'paired_bar' && chart.hasSufficientData) {
      ctx.textAlign = 'right';
      ctx.font = `700 15px ${FONT_FAMILY}`;

      // Swatch 1: المستهدف / المرجعي
      ctx.fillStyle = mutedGold;
      ctx.fillRect(MARGIN_X + 356, startY + 24, 16, 14);
      ctx.fillStyle = darkInk;
      ctx.fillText('المستهدف / المرجعي', MARGIN_X + 348, startY + 36);

      // Swatch 2: الفعلي المتحقق
      ctx.fillStyle = petrolGreen;
      ctx.fillRect(MARGIN_X + 168, startY + 24, 16, 14);
      ctx.fillStyle = darkInk;
      ctx.fillText('الفعلي المتحقق', MARGIN_X + 160, startY + 36);
    }

    if (!chart.hasSufficientData) {
      ctx.textAlign = 'center';
      ctx.fillStyle = mutedGold;
      ctx.font = `700 18px ${FONT_FAMILY}`;
      ctx.fillText(chart.emptyMessage, PAGE_W / 2, startY + 96);
      return startY + block.estimatedHeight + 20;
    }

    const maxVal = Math.max(
      1,
      ...chart.items.map((it) => Math.max(it.value || 0, it.secondaryValue || 0))
    );

    const labelZoneW = 410;
    const valueZoneW = 310;
    const barAreaRight = PAGE_W - MARGIN_X - 24 - labelZoneW;
    const barMaxW = Math.max(180, CONTENT_W - 48 - labelZoneW - valueZoneW);
    let rowY = startY + 86;

    chart.items.forEach((item, idx) => {
      const labelLines = block.wrappedItemLabels[idx] || [item.label];
      const rowH = block.itemRowHeights[idx] || 52;

      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `700 16px ${FONT_FAMILY}`;
      labelLines.forEach((ln, lIdx) => {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 24, rowY + 22 + lIdx * 24);
      });

      if (chart.chartKind === 'paired_bar' && item.secondaryValue !== undefined) {
        const w1 = Math.max(10, Math.round((item.value / maxVal) * barMaxW));
        const w2 = Math.max(10, Math.round((item.secondaryValue / maxVal) * barMaxW));

        // Track 1 (Target / Baseline)
        drawRoundedBox(ctx, barAreaRight - barMaxW, rowY + 6, barMaxW, 15, 5);
        ctx.fillStyle = ivory;
        ctx.fill();
        drawRoundedBox(ctx, barAreaRight - w1, rowY + 6, w1, 15, 5);
        ctx.fillStyle = mutedGold;
        ctx.fill();

        // Track 2 (Actual)
        drawRoundedBox(ctx, barAreaRight - barMaxW, rowY + 25, barMaxW, 15, 5);
        ctx.fillStyle = ivory;
        ctx.fill();
        drawRoundedBox(ctx, barAreaRight - w2, rowY + 25, w2, 15, 5);
        ctx.fillStyle = petrolGreen;
        ctx.fill();

        // Values printed clearly next to the bars
        ctx.textAlign = 'left';
        ctx.fillStyle = darkInk;
        ctx.font = `700 15px ${FONT_FAMILY}`;
        ctx.fillText(
          `المستهدف: ${item.value} | الفعلي: ${item.secondaryValue} ${item.unit || ''}`,
          MARGIN_X + 24,
          rowY + 28
        );
      } else {
        const w = Math.max(10, Math.round((item.value / maxVal) * barMaxW));
        drawRoundedBox(ctx, barAreaRight - barMaxW, rowY + 10, barMaxW, 22, 6);
        ctx.fillStyle = ivory;
        ctx.fill();

        drawRoundedBox(ctx, barAreaRight - w, rowY + 10, w, 22, 6);
        ctx.fillStyle = idx % 2 === 0 ? petrolGreen : deepTurquoise;
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.fillStyle = darkInk;
        ctx.font = `700 16px ${FONT_FAMILY}`;
        ctx.fillText(
          `${item.value}${item.unit ? ` ${item.unit}` : ''}`,
          MARGIN_X + 28,
          rowY + 27
        );
      }

      rowY += rowH;
    });

    // Analytical reading directly below the chart bars (Requirement 2.5)
    if (block.analyticalReadingLines && block.analyticalReadingLines.length > 0) {
      const readBoxY = rowY + 6;
      const readBoxH = block.analyticalReadingLines.length * 25 + 16;
      drawRoundedBox(ctx, MARGIN_X + 18, readBoxY, CONTENT_W - 36, readBoxH, 8);
      ctx.fillStyle = turquoiseSubtleBg;
      ctx.fill();
      ctx.strokeStyle = deepTurquoise;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = darkInk;
      ctx.font = `600 15px ${FONT_FAMILY}`;
      block.analyticalReadingLines.forEach((ln, idx) => {
        ctx.fillText(ln, PAGE_W - MARGIN_X - 34, readBoxY + 23 + idx * 24);
      });
    }

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 10. SELECTED KEY EVIDENCES + ENLARGED CLICKABLE QR CODES & CLICKABLE TEXT LINKS (Req 2.1 & 2.6)
  // =========================================================================
  if (block.kind === 'selected_evidences_qr_grid') {
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, block.estimatedHeight, 16);
    ctx.fillStyle = ivory;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 42, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 19px ${FONT_FAMILY}`;
    ctx.fillText(
      `٢. الشواهد المختارة الأكثر دلالة على الإنجاز والأثر (${block.registeredCount} شواهد مسجلة، ${block.selectedCount} شواهد مختارة للعرض)`,
      PAGE_W / 2,
      startY + 28
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = darkInk;
    ctx.font = `700 15px ${FONT_FAMILY}`;
    ctx.fillText(block.summaryLine, PAGE_W / 2, startY + 66);

    ctx.fillStyle = deepTurquoise;
    ctx.font = `600 14px ${FONT_FAMILY}`;
    ctx.fillText(block.typeBreakdownLine, PAGE_W / 2, startY + 88);

    if (block.cards.length === 0) {
      ctx.fillStyle = mutedGold;
      ctx.font = `700 17px ${FONT_FAMILY}`;
      ctx.fillText(
        'لم تُرفق شواهد موثقة في مستودع المجتمع حتى الآن.',
        PAGE_W / 2,
        startY + 114
      );
      return startY + block.estimatedHeight + 20;
    }

    const gapX = 18;
    const gapY = 14;
    const cardW = Math.floor((CONTENT_W - 48 - gapX) / 2);
    const cardH = 162; // Enlarged card height to fit 126px high-res QR + clickable text link pill
    const cardsStartY = startY + 106;
    const qrBoxSize = 126;

    block.cards.forEach((evCard, idx) => {
      const r = Math.floor(idx / 2);
      const isRight = idx % 2 === 0;
      const cardX = isRight ? PAGE_W - MARGIN_X - 24 - cardW : MARGIN_X + 24;
      const cardY = cardsStartY + r * (cardH + gapY);

      drawRoundedBox(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.fillStyle = white;
      ctx.fill();
      ctx.strokeStyle = cardBorder;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const targetUri = evCard.destinationUri || evCard.qrPayload;
      const hasQr = evCard.hasValidQr && Boolean(targetUri);
      const textZoneX = hasQr ? cardX + qrBoxSize + 24 : cardX + 16;
      const textZoneW = hasQr ? cardW - qrBoxSize - 38 : cardW - 32;
      const textCenterX = textZoneX + textZoneW / 2;

      if (hasQr && targetUri) {
        const qrX = cardX + 14;
        const qrY = cardY + Math.round((cardH - qrBoxSize) / 2);
        drawRoundedBox(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 8);
        ctx.fillStyle = white;
        ctx.fill();
        ctx.strokeStyle = petrolGreen;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Ultra-sharp integer-snapped dark QR modules on pure white with 4-module Quiet Zone
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

        // Adjacent clickable text link button pointing to the exact same URI
        const linkPillW = Math.min(260, textZoneW - 16);
        const linkPillH = 30;
        const linkPillX = textZoneX + Math.round((textZoneW - linkPillW) / 2);
        const linkPillY = cardY + cardH - linkPillH - 12;

        drawRoundedBox(ctx, linkPillX, linkPillY, linkPillW, linkPillH, 8);
        ctx.fillStyle = turquoiseSubtleBg;
        ctx.fill();
        ctx.strokeStyle = deepTurquoise;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = deepTurquoise;
        ctx.font = `700 14px ${FONT_FAMILY}`;
        ctx.fillText(
          evCard.linkLabel || 'فتح الشاهد / عرض الرابط',
          linkPillX + linkPillW / 2,
          linkPillY + 20
        );

        if (pageLinksOut) {
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
        }
        if (pageQrSpotsOut) {
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
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = petrolGreen;
      ctx.font = `700 16.5px ${FONT_FAMILY}`;
      const titleLines = wrapArabicCellText(
        `${evCard.title} (${evCard.typeLabel})`,
        textZoneW,
        10.6,
        ctx
      );
      ctx.fillText(titleLines[0], textCenterX, cardY + 28);

      ctx.fillStyle = darkInk;
      ctx.font = `600 14.5px ${FONT_FAMILY}`;
      const proofLines = wrapArabicCellText(
        `ما يثبته الشاهد: ${evCard.whatItProves}`,
        textZoneW,
        10.2,
        ctx
      ).slice(0, 2);
      proofLines.forEach((ln, lIdx) => {
        ctx.fillText(ln, textCenterX, cardY + 54 + lIdx * 22);
      });

      ctx.fillStyle = bodyInk;
      ctx.font = `600 13.5px ${FONT_FAMILY}`;
      const linkLines = wrapArabicCellText(evCard.linkedSummary, textZoneW, 10, ctx);
      ctx.fillText(linkLines[0], textCenterX, cardY + 102);
    });

    return startY + block.estimatedHeight + 20;
  }

  // =========================================================================
  // 11. OFFICIAL SIGN-OFF & STAMP BLOCK (Bottom of Last Page — Requirement 2.8)
  // - Right (`الجهة اليمنى`): صفة رئيس المجتمع، الاسم، التخصص (حذف كلمة «التوقيع»).
  // - Center (`الوسط`): كلمة «الختم» فقط، دون عبارة «مكان الختم الرسمي للمدرسة»، ودون إطار أو جدول مستقل حولها.
  // - Left (`الجهة اليسرى`): صفة مدير المدرسة والاسم فقط، مع حذف اسم المدرسة وحذف «التوقيع والختم».
  // =========================================================================
  if (block.kind === 'official_signoff_block') {
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, block.estimatedHeight, 18);
    ctx.fillStyle = ivory;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Top Header Bar
    drawRoundedBox(ctx, MARGIN_X, startY, CONTENT_W, 42, 14);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 19px ${FONT_FAMILY}`;
    ctx.fillText(block.signoffHeading, PAGE_W / 2, startY + 28);

    ctx.fillStyle = darkInk;
    ctx.font = `600 15.5px ${FONT_FAMILY}`;
    let cY = startY + 68;
    for (const ln of block.closingStatementLines) {
      ctx.fillText(ln, PAGE_W / 2, cY);
      cY += 25;
    }

    const sigBoxTopY = startY + 102;
    const sigBoxH = 116;
    const innerPad = 24;
    const colGap = 24;
    const stampZoneW = 260;
    const sideBoxW = Math.floor((CONTENT_W - innerPad * 2 - stampZoneW - colGap * 2) / 2);

    // 1. RIGHT COLUMN (`الجهة اليمنى`): صفة رئيس المجتمع، الاسم، التخصص (بدون كلمة التوقيع)
    const rightBoxX = PAGE_W - MARGIN_X - innerPad - sideBoxW;
    const rightCenterX = rightBoxX + sideBoxW / 2;

    drawRoundedBox(ctx, rightBoxX, sigBoxTopY, sideBoxW, sigBoxH, 14);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = petrolGreen;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundedBox(ctx, rightBoxX, sigBoxTopY, sideBoxW, 36, 12);
    ctx.fillStyle = petrolGreen;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 17.5px ${FONT_FAMILY}`;
    ctx.fillText(block.leaderTitle, rightCenterX, sigBoxTopY + 25);

    ctx.fillStyle = darkInk;
    ctx.font = `700 19px ${FONT_FAMILY}`;
    ctx.fillText(block.leaderName, rightCenterX, sigBoxTopY + 68);

    ctx.fillStyle = deepTurquoise;
    ctx.font = `600 16px ${FONT_FAMILY}`;
    ctx.fillText(block.leaderSpecialty, rightCenterX, sigBoxTopY + 98);

    // 2. CENTER ZONE (`الوسط`): كلمة «الختم» فقط، دون إطار أو جدول مستقل حولها، ودون عبارة «مكان الختم الرسمي للمدرسة»
    const centerStampX = PAGE_W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = petrolGreen;
    ctx.font = `700 22px ${FONT_FAMILY}`;
    ctx.fillText('الختم', centerStampX, sigBoxTopY + sigBoxH / 2 + 8);

    // 3. LEFT COLUMN (`الجهة اليسرى`): صفة مدير المدرسة والاسم فقط (حذف اسم المدرسة وحذف التوقيع والختم)
    const leftBoxX = MARGIN_X + innerPad;
    const leftCenterX = leftBoxX + sideBoxW / 2;

    drawRoundedBox(ctx, leftBoxX, sigBoxTopY, sideBoxW, sigBoxH, 14);
    ctx.fillStyle = white;
    ctx.fill();
    ctx.strokeStyle = deepTurquoise;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    drawRoundedBox(ctx, leftBoxX, sigBoxTopY, sideBoxW, 36, 12);
    ctx.fillStyle = deepTurquoise;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = white;
    ctx.font = `700 17.5px ${FONT_FAMILY}`;
    ctx.fillText(block.principalTitle, leftCenterX, sigBoxTopY + 25);

    ctx.fillStyle = darkInk;
    ctx.font = `700 19px ${FONT_FAMILY}`;
    ctx.fillText(block.principalName, leftCenterX, sigBoxTopY + 78);

    return startY + block.estimatedHeight + 16;
  }

  return startY + 20;
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return MINIMAL_WHITE_JPEG;
}

/**
 * Builds a multi-page PDF 1.4 binary from JPEG page images and embeds clickable
 * `/Subtype /Link` `/URI` annotations for every QR code and every adjacent clickable text link.
 */
export function buildPlcPdfBinaryWithLinks(
  pages: PlcPdfPageJpegWithLinks[],
  pageWidthPt = 595.28,
  pageHeightPt = 841.89
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed PDF object byte offsets
  let currentOffset = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.byteLength;
  };
  const pushStr = (str: string) => pushBytes(encoder.encode(str));
  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => pushStr(`endobj\n`);

  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  // Object 1: Catalog, Object 2: Pages
  // Each page i uses 3 base objects:
  //   pageObjId = 3 + i * 3
  //   contentObjId = 4 + i * 3
  //   imageObjId = 5 + i * 3
  // Followed by link annotation objects starting at `3 + pages.length * 3`
  let nextAnnotObjId = 3 + pages.length * 3;
  const pageAnnotIds: number[][] = pages.map((p) =>
    p.links.map(() => nextAnnotObjId++)
  );

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>\n`);
  endObj();

  const kidsRef = pages.map((_, idx) => `${3 + idx * 3} 0 R`).join(' ');
  startObj(2);
  pushStr(`<< /Type /Pages /Count ${pages.length} /Kids [ ${kidsRef} ] >>\n`);
  endObj();

  const wPt = pageWidthPt.toFixed(2);
  const hPt = pageHeightPt.toFixed(2);

  pages.forEach((p, idx) => {
    const pageObjId = 3 + idx * 3;
    const contentObjId = 4 + idx * 3;
    const imageObjId = 5 + idx * 3;
    const imgName = `/Im${idx + 1}`;
    const annotIds = pageAnnotIds[idx];
    const annotsEntry =
      annotIds.length > 0
        ? ` /Annots [ ${annotIds.map((id) => `${id} 0 R`).join(' ')} ]`
        : '';

    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << ${imgName} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R${annotsEntry} >>\n`
    );
    endObj();

    const contentStream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr(`\nendstream\n`);
    endObj();

    startObj(imageObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr(`\nendstream\n`);
    endObj();
  });

  // Emit clickable Link Annotation objects (`/Subtype /Link` with `/S /URI`)
  pages.forEach((p, idx) => {
    const annotIds = pageAnnotIds[idx];
    p.links.forEach((lnk, lIdx) => {
      const objId = annotIds[lIdx];
      const scaleX = pageWidthPt / p.pixelWidth;
      const scaleY = pageHeightPt / p.pixelHeight;
      const llx = (lnk.xPx * scaleX).toFixed(2);
      const urx = ((lnk.xPx + lnk.wPx) * scaleX).toFixed(2);
      const ury = (pageHeightPt - lnk.yPx * scaleY).toFixed(2);
      const lly = (pageHeightPt - (lnk.yPx + lnk.hPx) * scaleY).toFixed(2);
      const safeUrl = lnk.url
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

      startObj(objId);
      pushStr(
        `<< /Type /Annot /Subtype /Link /Rect [${llx} ${lly} ${urx} ${ury}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${safeUrl}) >> >>\n`
      );
      endObj();
    });
  });

  const totalObjects = nextAnnotObjId;
  const xrefOffset = currentOffset;
  pushStr(`xref\n0 ${totalObjects}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id < totalObjects; id++) {
    const padded = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const out = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}

/**
 * Renders the PLC Concise Final Report pages to HTMLCanvasElement instances for live UI preview
 * and multi-page A4 JPEG -> PDF conversion with clickable QR and text link annotations.
 */
export function renderPlcFinalReportPagesToCanvases(
  report: PlcGeneratedFinalReport,
  settings: SchoolSettings
): {
  canvases: HTMLCanvasElement[];
  pagesModel: PlcFinalReportPagesModel;
} {
  if (typeof document === 'undefined') {
    return {
      canvases: [],
      pagesModel: buildPlcFinalReportPdfPagesModel(report, settings, null),
    };
  }

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (measureCtx) {
    measureCtx.font = `600 18px ${FONT_FAMILY}`;
  }

  const pagesModel = buildPlcFinalReportPdfPagesModel(report, settings, measureCtx);
  const canvases: HTMLCanvasElement[] = [];

  for (const pagePlan of pagesModel.pages) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const coverBlock = pagePlan.blocks.find(
      (b): b is Extract<PlcPdfBlock, { kind: 'cover_page' }> => b.kind === 'cover_page'
    );

    if (pagePlan.isCoverPage && coverBlock) {
      drawOfficialCoverPage(ctx, report, settings, coverBlock);
    } else {
      drawInteriorPageHeader(ctx, report, settings, pagePlan);
      let cursorY: number = INTERIOR_START_Y;
      const renderedLinks: PlcPdfLinkAnnotation[] = [];
      const renderedQrSpots: PlcRenderedQrSpot[] = [];

      for (let bIdx = 0; bIdx < pagePlan.blocks.length; bIdx++) {
        const block = pagePlan.blocks[bIdx];
        const nextBlockKind =
          bIdx + 1 < pagePlan.blocks.length ? pagePlan.blocks[bIdx + 1].kind : undefined;
        cursorY = drawBlockOnCanvas(
          ctx,
          block,
          cursorY,
          settings,
          nextBlockKind,
          renderedLinks,
          renderedQrSpots
        );
      }

      if (renderedLinks.length > 0) {
        pagePlan.plannedLinks = renderedLinks;
      }
      if (renderedQrSpots.length > 0) {
        pagePlan.plannedQrSpots = renderedQrSpots;
      }

      // Draw faint geometric watermark ONLY in empty whitespace below `cursorY` (Requirement 2.9)
      drawPlcEmptySpaceWatermark(ctx, cursorY);
      drawInteriorPageFooter(ctx, report, settings, pagePlan);
    }

    canvases.push(canvas);
  }

  return { canvases, pagesModel };
}

/**
 * Generates the real multi-page A4 PDF binary (`%PDF-1.4`) for a PLC Community's Concise Final Report (Model 9)
 * including clickable `/Subtype /Link` annotations over every QR code and every adjacent text link.
 */
export function generatePlcFinalReportPdfArtifact(
  community: PlcCommunityRecord,
  settings: SchoolSettings,
  reportOverride?: PlcGeneratedFinalReport
): {
  pdfBytes: Uint8Array;
  filename: string;
  pageCount: number;
  pagesModel: PlcFinalReportPagesModel;
  report: PlcGeneratedFinalReport;
} {
  const report = reportOverride ?? buildPlcFinalReport(community);
  const { canvases, pagesModel } = renderPlcFinalReportPagesToCanvases(report, settings);

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
  const filename = `التقرير_النهائي_المختصر_${safeName}.pdf`;

  return {
    pdfBytes,
    filename,
    pageCount: pagesModel.pages.length,
    pagesModel,
    report,
  };
}

