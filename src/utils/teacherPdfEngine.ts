import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import {
  generateQrMatrix,
  generateQrSvgDataUrl,
} from './qrCodeGenerator';
import { getGenderedLabels } from './settingsStorage';
import {
  computeReferenceTemplateHeaderPlan,
  drawReferenceTemplateBasicFields,
  drawReferenceTemplateEvidenceAndLinks,
  drawReferenceTemplateHeader,
  drawReferenceTemplateOrnaments,
  drawReferenceTemplateSection,
  drawReferenceTemplateSignoff,
  measureReferenceTemplateBasicFieldsHeight,
  measureReferenceTemplateEvidenceHeight,
  measureReferenceTemplateHeaderHeight,
  measureReferenceTemplateSectionHeight,
  TEACHER_TEMPLATE_DEFINITIONS,
  wrapCanvasLines,
} from './teacherPdfTemplates';
import { sanitizeFilenameSegment } from './zipBuilder';

// Minimal 1x1 white JPEG for Node.js unit-test fallback when HTMLCanvasElement is unavailable
const MINIMAL_WHITE_JPEG = new Uint8Array([
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

export interface TeacherColorPalette {
  id: TeacherPdfColorSystem;
  name: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
  midToneHex: string;
  softToneHex: string;
  lightRibbonHex: string;
  headerBgHex: string;
  sectionBgHex: string;
  titleBgHex: string;
  cardBgHex: string;
  borderHex: string;
  accentSoftHex: string;
  dividerHex: string;
}

export const TEACHER_COLOR_PALETTES: Record<
  TeacherPdfColorSystem,
  TeacherColorPalette
> = {
  green: {
    id: 'green',
    name: 'النظام الأخضر الرسمي',
    description:
      'الأخضر الرسمي (#07A869) مع الكحلي (#15445A) ودرجات مشتقة للموجات والمعينات والخلفيات',
    primaryHex: '#07A869',
    secondaryHex: '#15445A',
    midToneHex: '#1E6F6D',
    softToneHex: '#7BC5AE',
    lightRibbonHex: '#CBECE0',
    headerBgHex: '#E3F5EE',
    sectionBgHex: '#DCF2E9',
    titleBgHex: '#F2FAF6',
    cardBgHex: '#F3FAF7',
    borderHex: '#94D2B9',
    accentSoftHex: '#D1F3E3',
    dividerHex: '#15445A',
  },
  blue: {
    id: 'blue',
    name: 'النظام الأزرق السماوي',
    description:
      'الأزرق السماوي (#3D7EB9) مع الكحلي (#15445A) ودرجات مشتقة للموجات والمعينات والخلفيات',
    primaryHex: '#3D7EB9',
    secondaryHex: '#15445A',
    midToneHex: '#286090',
    softToneHex: '#84B4DF',
    lightRibbonHex: '#CFE4F6',
    headerBgHex: '#E4F0FA',
    sectionBgHex: '#DCEBF8',
    titleBgHex: '#F3F8FC',
    cardBgHex: '#F3F8FC',
    borderHex: '#9AC0E3',
    accentSoftHex: '#D3E5F5',
    dividerHex: '#15445A',
  },
  slate: {
    id: 'slate',
    name: 'أزرق رمادي',
    description:
      'درجات متناسقة وهادئة من الأزرق الرمادي للعناوين والزخارف والبطاقات',
    primaryHex: '#4A657A',
    secondaryHex: '#2B3E4E',
    midToneHex: '#3B5264',
    softToneHex: '#8CA3B5',
    lightRibbonHex: '#D4E0E9',
    headerBgHex: '#E7EEF3',
    sectionBgHex: '#E0E8EF',
    titleBgHex: '#F4F7FA',
    cardBgHex: '#F4F7F9',
    borderHex: '#ACC0D0',
    accentSoftHex: '#D8E2EB',
    dividerHex: '#2B3E4E',
  },
};

export function getTeacherColorPalette(
  system?: TeacherPdfColorSystem
): TeacherColorPalette {
  if (system === 'blue') return TEACHER_COLOR_PALETTES.blue;
  if (system === 'slate') return TEACHER_COLOR_PALETTES.slate;
  return TEACHER_COLOR_PALETTES.green;
}

export interface TeacherReportBasicField {
  id: string;
  label: string;
  value: string;
  width?: 'half' | 'third' | 'full';
  isLongText?: boolean;
  /** When true, renders the label on the right of a white box and leaves the rest blank for manual pen signature */
  isSignatureSpace?: boolean;
}

export interface TeacherReportAttendanceRow {
  index: number;
  name: string;
}

export interface TeacherReportContentSection {
  id: string;
  title: string;
  type: 'text' | 'list' | 'fields' | 'attendance-table';
  content?: string;
  items?: string[];
  fields?: TeacherReportBasicField[];
  attendanceRows?: TeacherReportAttendanceRow[];
  /** When true, this section starts on a dedicated new page */
  forceNewPage?: boolean;
  /** When true, this section is placed after the evidence/links block at the end of the report */
  placeAfterEvidence?: boolean;
}

export interface TeacherReportEvidencePhoto {
  id: string;
  imageDataUrl: string;
}

export interface TeacherReportEvidenceLink {
  id: string;
  url: string;
}

export interface TeacherReportEvidenceItem {
  id: string;
  title?: string;
  description?: string;
  imageDataUrl?: string;
  linkUrl?: string;
}

export interface TeacherReportDocument {
  reportTypeLabel: string;
  reportMainTitle: string;
  templateStyle: TeacherPdfTemplateStyle;
  colorSystem: TeacherPdfColorSystem;
  basicFields: TeacherReportBasicField[];
  sections: TeacherReportContentSection[];
  /** Independent uploaded photos (max 2) */
  evidencePhotos?: TeacherReportEvidencePhoto[];
  /** Independent electronic links converted to QR codes (max 2) */
  evidenceLinks?: TeacherReportEvidenceLink[];
  /** Optional legacy combined items (supported for backward compatibility) */
  evidenceItems?: TeacherReportEvidenceItem[];
  executorName?: string;
  nationalId?: string;
  signatureDataUrl?: string;
  principalName?: string;
  includePrincipalSignoff?: boolean;
  /** When true, places the principal sign-off at the end of the main report before any forceNewPage section (e.g. standalone attendance sheet) */
  signoffBeforeNewPageSections?: boolean;
}

export interface PdfLinkAnnotation {
  xPx: number;
  yPx: number;
  wPx: number;
  hPx: number;
  url: string;
}

export interface TeacherPageJpegWithLinks {
  jpegBytes: Uint8Array;
  dataUrl?: string;
  pixelWidth: number;
  pixelHeight: number;
  links: PdfLinkAnnotation[];
}

export interface NormalizedTeacherEvidence {
  photos: TeacherReportEvidencePhoto[];
  links: TeacherReportEvidenceLink[];
  hasAny: boolean;
}

/**
 * Normalizes independent evidence photos (0..2) and electronic links (0..2) from a TeacherReportDocument.
 * Photos and links are completely independent:
 * - 0..2 photos without links
 * - 0..2 links without photos
 * - 1 photo + 1 link
 * - 2 photos + 2 links
 */
export function normalizeTeacherEvidence(
  doc: Pick<
    TeacherReportDocument,
    'evidencePhotos' | 'evidenceLinks' | 'evidenceItems'
  >
): NormalizedTeacherEvidence {
  const hasExplicitPhotos = Array.isArray(doc.evidencePhotos);
  const hasExplicitLinks = Array.isArray(doc.evidenceLinks);

  let photos: TeacherReportEvidencePhoto[] = [];
  let links: TeacherReportEvidenceLink[] = [];

  if (hasExplicitPhotos || hasExplicitLinks) {
    photos = (doc.evidencePhotos || [])
      .filter((p) => Boolean(p && p.imageDataUrl && p.imageDataUrl.trim()))
      .slice(0, 2)
      .map((p, idx) => ({
        id: p.id || `photo-${idx + 1}`,
        imageDataUrl: p.imageDataUrl.trim(),
      }));

    links = (doc.evidenceLinks || [])
      .filter((l) => Boolean(l && l.url && l.url.trim()))
      .slice(0, 2)
      .map((l, idx) => ({
        id: l.id || `link-${idx + 1}`,
        url: l.url.trim(),
      }));
  } else if (Array.isArray(doc.evidenceItems)) {
    photos = doc.evidenceItems
      .filter((item) =>
        Boolean(item && item.imageDataUrl && item.imageDataUrl.trim())
      )
      .slice(0, 2)
      .map((item, idx) => ({
        id: item.id || `photo-${idx + 1}`,
        imageDataUrl: item.imageDataUrl!.trim(),
      }));

    links = doc.evidenceItems
      .filter((item) => Boolean(item && item.linkUrl && item.linkUrl.trim()))
      .slice(0, 2)
      .map((item, idx) => ({
        id: item.id || `link-${idx + 1}`,
        url: item.linkUrl!.trim(),
      }));
  }

  return {
    photos,
    links,
    hasAny: photos.length > 0 || links.length > 0,
  };
}

/**
 * Filter and normalize up to 2 valid evidence items (backward compatibility helper).
 */
export function getActiveTeacherEvidenceItems(
  items?: TeacherReportEvidenceItem[]
): TeacherReportEvidenceItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => {
      if (!item) return false;
      const hasImg = Boolean(item.imageDataUrl && item.imageDataUrl.trim());
      const hasLink = Boolean(item.linkUrl && item.linkUrl.trim());
      return hasImg || hasLink;
    })
    .slice(0, 2);
}

/**
 * Builds a valid multi-page A4 Portrait PDF 1.4 binary document with embedded
 * clickable `/Subtype /Link` `/URI` annotations over QR codes.
 */
export function buildTeacherPdfBinaryWithLinks(
  pages: TeacherPageJpegWithLinks[],
  pageWidthPt = 595.28,
  pageHeightPt = 841.89
): Uint8Array {
  const safePages: TeacherPageJpegWithLinks[] =
    pages.length > 0
      ? pages
      : [
          {
            jpegBytes: MINIMAL_WHITE_JPEG,
            pixelWidth: 1240,
            pixelHeight: 1754,
            links: [],
          },
        ];

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const pushStr = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr('\nendobj\n');
  };

  const escapePdfUri = (uri: string): string => {
    return uri
      .trim()
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  };

  const wPt = pageWidthPt.toFixed(2);
  const hPt = pageHeightPt.toFixed(2);

  // PDF 1.4 Header
  pushBytes(
    new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3,
      0xcf, 0xd3, 0x0a,
    ])
  );

  // Object 1: Catalog
  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  let nextObjId = 3;
  const pagePlans = safePages.map((p) => {
    const pageObjId = nextObjId++;
    const contentObjId = nextObjId++;
    const imgObjId = nextObjId++;
    const annotObjIds = p.links.map(() => nextObjId++);
    return {
      pageData: p,
      pageObjId,
      contentObjId,
      imgObjId,
      annotObjIds,
    };
  });

  const kidsRefs = pagePlans.map((plan) => `${plan.pageObjId} 0 R`).join(' ');

  // Object 2: Pages Root
  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${kidsRefs}] /Count ${pagePlans.length} >>`
  );
  endObj();

  pagePlans.forEach((plan, idx) => {
    const { pageData, pageObjId, contentObjId, imgObjId, annotObjIds } = plan;
    const imgName = `/Im${idx + 1}`;
    const annotsEntry =
      annotObjIds.length > 0
        ? ` /Annots [${annotObjIds.map((id) => `${id} 0 R`).join(' ')}]`
        : '';

    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << ${imgName} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R${annotsEntry} >>`
    );
    endObj();

    const contentStream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr('\nendstream');
    endObj();

    startObj(imgObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${pageData.pixelWidth} /Height ${pageData.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pageData.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(pageData.jpegBytes);
    pushStr('\nendstream');
    endObj();

    pageData.links.forEach((link, linkIdx) => {
      const annotId = annotObjIds[linkIdx];
      const llx = ((link.xPx / pageData.pixelWidth) * pageWidthPt).toFixed(2);
      const urx = (
        ((link.xPx + link.wPx) / pageData.pixelWidth) *
        pageWidthPt
      ).toFixed(2);
      const ury = (
        pageHeightPt -
        (link.yPx / pageData.pixelHeight) * pageHeightPt
      ).toFixed(2);
      const lly = (
        pageHeightPt -
        ((link.yPx + link.hPx) / pageData.pixelHeight) * pageHeightPt
      ).toFixed(2);

      const safeUrl = escapePdfUri(link.url);
      startObj(annotId);
      pushStr(
        `<< /Type /Annot /Subtype /Link /Rect [${llx} ${lly} ${urx} ${ury}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${safeUrl}) >> >>`
      );
      endObj();
    });
  });

  const totalObjects = nextObjId - 1;
  const xrefOffset = currentOffset;

  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjects; i++) {
    const padded = String(offsets[i] ?? 0).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const output = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.length;
  }
  return output;
}

export type PaginatedReportBlock =
  | { kind: 'basic-fields'; fields: TeacherReportBasicField[] }
  | { kind: 'section'; section: TeacherReportContentSection }
  | {
      kind: 'evidence';
      photos: TeacherReportEvidencePhoto[];
      links: TeacherReportEvidenceLink[];
      items: TeacherReportEvidenceItem[];
    }
  | {
      kind: 'signoff';
      executorName?: string;
      nationalId?: string;
      signatureDataUrl?: string;
      principalTitle: string;
      principalName: string;
    };

export interface PaginatedTeacherPage {
  pageIndex: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  blocks: PaginatedReportBlock[];
}

let sharedMeasureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasurementCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (sharedMeasureCtx !== undefined) return sharedMeasureCtx;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.direction = 'rtl';
    }
    sharedMeasureCtx = ctx;
    return ctx;
  } catch {
    sharedMeasureCtx = null;
    return null;
  }
}

function estimateBlockHeightPx(
  ctx: CanvasRenderingContext2D | null,
  block: PaginatedReportBlock,
  templateStyle: TeacherPdfTemplateStyle,
  contentW = 1112
): number {
  switch (block.kind) {
    case 'basic-fields': {
      return measureReferenceTemplateBasicFieldsHeight(
        ctx,
        contentW,
        templateStyle,
        block.fields
      );
    }
    case 'section': {
      return measureReferenceTemplateSectionHeight(
        ctx,
        contentW,
        templateStyle,
        block.section
      );
    }
    case 'evidence': {
      return measureReferenceTemplateEvidenceHeight(
        block.photos.length,
        block.links.length
      );
    }
    case 'signoff': {
      const hasExec = Boolean(
        (block.executorName && block.executorName.trim()) ||
          (block.nationalId && block.nationalId.trim()) ||
          (block.signatureDataUrl && block.signatureDataUrl.trim())
      );
      const hasPrincipal = Boolean(
        block.principalName && block.principalName.trim()
      );
      return (hasExec ? 58 : 0) + (hasPrincipal ? 36 : 0);
    }
  }
}

/**
 * Distributes report blocks across 1 or more A4 pages so:
 * - Short reports fit on 1 page matching the reference images.
 * - Long reports flow naturally onto additional pages.
 * - Whole sections that do not fit in remaining page space move cleanly to the next page.
 * - Extremely long multi-paragraph text or multi-item list sections split across pages only when needed.
 * - Evidence stays within the report flow on the same page when space permits.
 * - Never creates an empty evidence page.
 * - Principal sign-off appears at the end of the LAST page only.
 */
export function paginateTeacherReportBlocks(
  doc: TeacherReportDocument,
  settings: SchoolSettings
): PaginatedTeacherPage[] {
  const PAGE_W = 1240;
  const MARGIN_X = 64;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const measureCtx = getMeasurementCanvasContext();

  const gendered = getGenderedLabels(settings.gender);
  const rawBlocks: PaginatedReportBlock[] = [];

  const nonEmptyBasic = (doc.basicFields || []).filter(
    (f) => f.label && f.label.trim()
  );
  if (nonEmptyBasic.length > 0) {
    rawBlocks.push({ kind: 'basic-fields', fields: nonEmptyBasic });
  }

  for (const sec of doc.sections || []) {
    if (sec.type === 'text') {
      const paragraphs = String(sec.content || '')
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      const allLines = wrapCanvasLines(
        measureCtx,
        sec.content || '',
        CONTENT_W - 64,
        19,
        false
      );
      if (allLines.length > 14 && paragraphs.length > 1) {
        let chunkParas: string[] = [];
        let chunkLineCount = 0;
        let partIndex = 1;
        for (const p of paragraphs) {
          const pLines = wrapCanvasLines(
            measureCtx,
            p,
            CONTENT_W - 64,
            19,
            false
          ).length;
          if (chunkLineCount + pLines > 11 && chunkParas.length > 0) {
            rawBlocks.push({
              kind: 'section',
              section: {
                ...sec,
                id: `${sec.id}-part-${partIndex}`,
                title: partIndex === 1 ? sec.title : `${sec.title} (يتبع)`,
                content: chunkParas.join('\n'),
                forceNewPage: partIndex === 1 ? sec.forceNewPage : false,
              },
            });
            partIndex++;
            chunkParas = [p];
            chunkLineCount = pLines;
          } else {
            chunkParas.push(p);
            chunkLineCount += pLines;
          }
        }
        if (chunkParas.length > 0) {
          rawBlocks.push({
            kind: 'section',
            section: {
              ...sec,
              id: `${sec.id}-part-${partIndex}`,
              title: partIndex === 1 ? sec.title : `${sec.title} (يتبع)`,
              content: chunkParas.join('\n'),
              forceNewPage: partIndex === 1 ? sec.forceNewPage : false,
            },
          });
        }
      } else if (allLines.length > 26 && paragraphs.length === 1) {
        // Single giant paragraph (> 26 wrapped lines): split into chunks of 14 lines so it never overflows a page
        let partIndex = 1;
        for (let i = 0; i < allLines.length; i += 14) {
          const sliceLines = allLines.slice(i, i + 14);
          rawBlocks.push({
            kind: 'section',
            section: {
              ...sec,
              id: `${sec.id}-part-${partIndex}`,
              title: partIndex === 1 ? sec.title : `${sec.title} (يتبع)`,
              content: sliceLines.join('\n'),
              forceNewPage: partIndex === 1 ? sec.forceNewPage : false,
            },
          });
          partIndex++;
        }
      } else {
        rawBlocks.push({ kind: 'section', section: sec });
      }
    } else if (sec.type === 'list' && Array.isArray(sec.items)) {
      const items = sec.items.filter((i) => i.trim().length > 0);
      const totalMeasuredH = measureReferenceTemplateSectionHeight(
        measureCtx,
        CONTENT_W,
        doc.templateStyle,
        sec
      );
      if (totalMeasuredH > 1150 && items.length > 2) {
        let chunkItems: string[] = [];
        let chunkLines = 0;
        let partIndex = 1;
        for (const item of items) {
          const itemLines = wrapCanvasLines(
            measureCtx,
            item,
            CONTENT_W - 92,
            19,
            false
          ).length;
          if (chunkLines + itemLines > 14 && chunkItems.length > 0) {
            rawBlocks.push({
              kind: 'section',
              section: {
                ...sec,
                id: `${sec.id}-part-${partIndex}`,
                title: partIndex === 1 ? sec.title : `${sec.title} (يتبع)`,
                items: chunkItems,
                forceNewPage: partIndex === 1 ? sec.forceNewPage : false,
              },
            });
            partIndex++;
            chunkItems = [item];
            chunkLines = itemLines;
          } else {
            chunkItems.push(item);
            chunkLines += itemLines;
          }
        }
        if (chunkItems.length > 0) {
          rawBlocks.push({
            kind: 'section',
            section: {
              ...sec,
              id: `${sec.id}-part-${partIndex}`,
              title: partIndex === 1 ? sec.title : `${sec.title} (يتبع)`,
              items: chunkItems,
              forceNewPage: partIndex === 1 ? sec.forceNewPage : false,
            },
          });
        }
      } else {
        rawBlocks.push({ kind: 'section', section: sec });
      }
    } else if (
      sec.type === 'attendance-table' &&
      Array.isArray(sec.attendanceRows) &&
      sec.attendanceRows.length > 0
    ) {
      const maxRowsPerPage = 15;
      if (sec.attendanceRows.length > maxRowsPerPage) {
        let partIndex = 1;
        for (
          let i = 0;
          i < sec.attendanceRows.length;
          i += maxRowsPerPage
        ) {
          const sliceRows = sec.attendanceRows.slice(i, i + maxRowsPerPage);
          rawBlocks.push({
            kind: 'section',
            section: {
              ...sec,
              id: `${sec.id}-part-${partIndex}`,
              title: partIndex === 1 ? sec.title : `${sec.title} (يتبع)`,
              attendanceRows: sliceRows,
              forceNewPage: true,
            },
          });
          partIndex++;
        }
      } else {
        rawBlocks.push({ kind: 'section', section: sec });
      }
    } else {
      rawBlocks.push({ kind: 'section', section: sec });
    }
  }

  // Separate post-evidence sections (e.g., Peer Visit teacher signatures at the end of the report)
  const postEvidenceBlocks: PaginatedReportBlock[] = [];
  for (let i = rawBlocks.length - 1; i >= 0; i--) {
    const b = rawBlocks[i];
    if (b.kind === 'section' && b.section.placeAfterEvidence) {
      postEvidenceBlocks.unshift(b);
      rawBlocks.splice(i, 1);
    }
  }

  const normalizedEv = normalizeTeacherEvidence(doc);
  let evidenceBlock: PaginatedReportBlock | null = null;
  if (normalizedEv.hasAny) {
    const maxLen = Math.max(
      normalizedEv.photos.length,
      normalizedEv.links.length
    );
    const compatItems: TeacherReportEvidenceItem[] = Array.from(
      { length: maxLen },
      (_, idx) => ({
        id: `ev-${idx + 1}`,
        imageDataUrl: normalizedEv.photos[idx]?.imageDataUrl,
        linkUrl: normalizedEv.links[idx]?.url,
      })
    );
    evidenceBlock = {
      kind: 'evidence',
      photos: normalizedEv.photos,
      links: normalizedEv.links,
      items: compatItems,
    };
  }

  const hasExplicitEmptyDocPrincipal =
    doc.principalName !== undefined && doc.principalName.trim() === '';
  const resolvedPrincipalName =
    doc.includePrincipalSignoff === false || hasExplicitEmptyDocPrincipal
      ? ''
      : settings.principalName?.trim() ||
        (doc.principalName !== undefined ? doc.principalName.trim() : '');
  const resolvedExecutorName = doc.executorName?.trim() || '';
  const resolvedNationalId = doc.nationalId?.trim() || '';
  const resolvedSignature = doc.signatureDataUrl?.trim() || '';

  let signoffBlock: PaginatedReportBlock | null = null;
  if (
    resolvedPrincipalName ||
    resolvedExecutorName ||
    resolvedNationalId ||
    resolvedSignature
  ) {
    signoffBlock = {
      kind: 'signoff',
      executorName: resolvedExecutorName,
      nationalId: resolvedNationalId,
      signatureDataUrl: resolvedSignature,
      principalTitle: gendered.principalTitle,
      principalName: resolvedPrincipalName,
    };
  }

  const tailBlocks: PaginatedReportBlock[] = [];
  if (evidenceBlock) {
    tailBlocks.push(evidenceBlock);
  }
  if (postEvidenceBlocks.length > 0) {
    tailBlocks.push(...postEvidenceBlocks);
  }
  if (signoffBlock) {
    tailBlocks.push(signoffBlock);
  }

  if (tailBlocks.length > 0) {
    const firstForceNewPageIdx = doc.signoffBeforeNewPageSections
      ? rawBlocks.findIndex(
          (b) => b.kind === 'section' && b.section.forceNewPage
        )
      : -1;

    if (firstForceNewPageIdx !== -1) {
      rawBlocks.splice(firstForceNewPageIdx, 0, ...tailBlocks);
    } else {
      rawBlocks.push(...tailBlocks);
    }
  }

  // Dynamic header height measurement: accounts for 2-line report titles or multi-line school/department names
  const headerBottomY = measureReferenceTemplateHeaderHeight(
    measureCtx,
    PAGE_W,
    MARGIN_X,
    CONTENT_W,
    doc.templateStyle,
    settings,
    doc
  );

  // Safe bottom content limit Y (1613px) so content never overlaps bottom ornaments or Principal sign-off
  const dynamicPageCapacity = Math.min(
    1365,
    Math.max(850, 1613 - headerBottomY)
  );

  const pages: PaginatedReportBlock[][] = [[]];
  let currentUsed = 0;

  for (const block of rawBlocks) {
    const blockH = estimateBlockHeightPx(
      measureCtx,
      block,
      doc.templateStyle,
      CONTENT_W
    );
    const currentPageIdx = pages.length - 1;
    const capacity = dynamicPageCapacity;

    if (
      block.kind === 'section' &&
      block.section.forceNewPage &&
      pages[currentPageIdx].length > 0
    ) {
      pages.push([block]);
      currentUsed = blockH;
      continue;
    }

    if (
      pages[currentPageIdx].length > 0 &&
      currentUsed + blockH > capacity
    ) {
      // Never put a standalone principal-only sign-off on a blank new page if it can sit in the footer margin
      if (
        block.kind === 'signoff' &&
        !block.executorName &&
        !block.nationalId &&
        !block.signatureDataUrl &&
        currentUsed <= capacity + 18
      ) {
        pages[currentPageIdx].push(block);
        currentUsed += blockH;
      } else {
        pages.push([block]);
        currentUsed = blockH;
      }
    } else {
      pages[currentPageIdx].push(block);
      currentUsed += blockH;
    }
  }

  return pages.map((blocks, idx) => ({
    pageIndex: idx,
    isFirstPage: idx === 0,
    isLastPage: idx === pages.length - 1,
    blocks,
  }));
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasToJpegAndDataUrl(
  canvas: HTMLCanvasElement,
  quality = 0.94
): { jpegBytes: Uint8Array; dataUrl: string } {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index === -1) {
    return { jpegBytes: MINIMAL_WHITE_JPEG, dataUrl: '' };
  }
  const base64 = dataUrl.slice(base64Index + 8);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { jpegBytes: bytes, dataUrl };
}

export interface GeneratedTeacherPdfResult {
  pdfBytes: Uint8Array;
  filename: string;
  pageCount: number;
  linkAnnotationsCount: number;
}

/**
 * Renders all pages of a `TeacherReportDocument` onto high-resolution A4 canvases (`1240 × 1754`)
 * using the exact visual identity of the selected reference template (`waves`, `waves-2`, `geometric`)
 * and color system (`green`, `blue`, `slate`).
 *
 * Used by BOTH the live preview/comparison studio AND `generateTeacherReportPdf` so the visual
 * preview is 100% identical to the exported PDF.
 */
export async function renderTeacherReportPagesToCanvases(
  doc: TeacherReportDocument,
  settings: SchoolSettings
): Promise<TeacherPageJpegWithLinks[]> {
  const palette = getTeacherColorPalette(doc.colorSystem);
  const paginatedPages = paginateTeacherReportBlocks(doc, settings);

  // Node.js unit-test fallback
  if (typeof document === 'undefined') {
    const normalizedEv = normalizeTeacherEvidence(doc);
    return paginatedPages.map((pagePlan) => {
      const hasEvidenceOnPage = pagePlan.blocks.some(
        (b) => b.kind === 'evidence'
      );
      const links: PdfLinkAnnotation[] = hasEvidenceOnPage
        ? normalizedEv.links.map((linkItem, idx) => {
            generateQrMatrix(linkItem.url);
            return {
              xPx: 120 + idx * 540,
              yPx: 1350,
              wPx: 112,
              hPx: 112,
              url: linkItem.url,
            };
          })
        : [];
      return {
        jpegBytes: MINIMAL_WHITE_JPEG,
        dataUrl: '',
        pixelWidth: 1240,
        pixelHeight: 1754,
        links,
      };
    });
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN_X = 64;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const logoImg = await loadImageElement('./moe-logo.png');
  const signatureImg =
    doc.signatureDataUrl && doc.signatureDataUrl.trim()
      ? await loadImageElement(doc.signatureDataUrl.trim())
      : null;

  const normalizedEv = normalizeTeacherEvidence(doc);
  const evidenceImagesMap = new Map<string, HTMLImageElement | null>();
  for (const photo of normalizedEv.photos) {
    if (photo.imageDataUrl && photo.imageDataUrl.trim()) {
      const imgEl = await loadImageElement(photo.imageDataUrl.trim());
      evidenceImagesMap.set(photo.id, imgEl);
    }
  }

  const renderedPages: TeacherPageJpegWithLinks[] = [];
  let runningSectionIndex = 0;

  for (const pagePlan of paginatedPages) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to initialize 2D canvas context');
    }

    ctx.direction = 'rtl';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    const headerPlan = computeReferenceTemplateHeaderPlan(
      ctx,
      PAGE_W,
      MARGIN_X,
      CONTENT_W,
      doc.templateStyle,
      settings,
      doc
    );

    // 1. Draw Top & Bottom Reference Ornaments (قالب 1, قالب 2, or قالب 3)
    drawReferenceTemplateOrnaments(
      ctx,
      PAGE_W,
      PAGE_H,
      doc.templateStyle,
      palette,
      headerPlan.waves2BackdropBottomY
    );

    const pageLinks: PdfLinkAnnotation[] = [];

    // 2. Draw Reference Header & Main Title
    let cursorY = drawReferenceTemplateHeader(
      ctx,
      PAGE_W,
      MARGIN_X,
      CONTENT_W,
      doc.templateStyle,
      palette,
      settings,
      doc,
      logoImg,
      pagePlan.isFirstPage
    );

    // 3. Draw Paginated Blocks
    for (const block of pagePlan.blocks) {
      if (block.kind === 'basic-fields') {
        cursorY = drawReferenceTemplateBasicFields(
          ctx,
          cursorY,
          PAGE_W,
          MARGIN_X,
          CONTENT_W,
          doc.templateStyle,
          palette,
          block.fields
        );
      } else if (block.kind === 'section') {
        cursorY = drawReferenceTemplateSection(
          ctx,
          cursorY,
          PAGE_W,
          MARGIN_X,
          CONTENT_W,
          doc.templateStyle,
          palette,
          block.section,
          runningSectionIndex++
        );
      } else if (block.kind === 'evidence') {
        cursorY = drawReferenceTemplateEvidenceAndLinks(
          ctx,
          cursorY,
          PAGE_W,
          MARGIN_X,
          CONTENT_W,
          doc.templateStyle,
          palette,
          block.photos,
          block.links,
          evidenceImagesMap,
          pageLinks
        );
      } else if (block.kind === 'signoff') {
        drawReferenceTemplateSignoff(
          ctx,
          cursorY,
          PAGE_W,
          PAGE_H,
          MARGIN_X,
          CONTENT_W,
          doc.templateStyle,
          palette,
          block,
          signatureImg
        );
      }
    }

    const { jpegBytes, dataUrl } = canvasToJpegAndDataUrl(canvas, 0.94);
    renderedPages.push({
      jpegBytes,
      dataUrl,
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
      links: pageLinks,
    });
  }

  return renderedPages;
}

/**
 * Generates a real A4 Portrait PDF document for the Teacher section with
 * the selected reference template (`waves`, `waves-2`, or `geometric`) and
 * color system (`green`, `blue`, or `slate`).
 */
export async function generateTeacherReportPdf(
  doc: TeacherReportDocument,
  settings: SchoolSettings
): Promise<GeneratedTeacherPdfResult> {
  const renderedPages = await renderTeacherReportPagesToCanvases(doc, settings);

  const safeTitle = sanitizeFilenameSegment(
    doc.reportMainTitle || doc.reportTypeLabel || 'تقرير_المعلم'
  );
  const filename = `${safeTitle}_${doc.templateStyle}_${doc.colorSystem}.pdf`;

  const pdfBytes = buildTeacherPdfBinaryWithLinks(
    renderedPages,
    595.28,
    841.89
  );
  const linkAnnotationsCount = renderedPages.reduce(
    (sum, p) => sum + p.links.length,
    0
  );

  return {
    pdfBytes,
    filename,
    pageCount: renderedPages.length,
    linkAnnotationsCount,
  };
}

/**
 * Generates the two default sample evidence photos (SVG Data URLs) styled with the active color palette.
 */
export function createDefaultSampleEvidencePhotos(
  colorSystem: TeacherPdfColorSystem = 'green'
): [TeacherReportEvidencePhoto, TeacherReportEvidencePhoto] {
  const palette = getTeacherColorPalette(colorSystem);

  const samplePhoto1 = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="310" viewBox="0 0 520 310">
      <rect width="520" height="310" fill="#ECEAE4"/>
      <rect x="34" y="18" width="380" height="230" rx="4" fill="#1E293B"/>
      <rect x="44" y="26" width="360" height="214" rx="2" fill="#E0F2FE"/>
      <circle cx="224" cy="96" r="28" fill="${palette.primaryHex}" opacity="0.22"/>
      <text x="224" y="142" font-family="Tajawal, sans-serif" font-size="22" font-weight="bold" fill="${palette.secondaryHex}" text-anchor="middle">وزارة التعليم</text>
      <text x="224" y="168" font-family="Tajawal, sans-serif" font-size="16" font-weight="bold" fill="${palette.primaryHex}" text-anchor="middle">التعلم النشط</text>
      <circle cx="95" cy="278" r="32" fill="#7F1D1D"/>
      <circle cx="195" cy="285" r="28" fill="#1E293B"/>
      <circle cx="295" cy="282" r="30" fill="#334155"/>
      <circle cx="395" cy="286" r="27" fill="#0F172A"/>
    </svg>`
  )}`;

  const samplePhoto2 = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="310" viewBox="0 0 520 310">
      <rect width="520" height="310" fill="#D6B892"/>
      <g transform="rotate(-14 250 165)">
        <rect x="95" y="45" width="280" height="220" rx="8" fill="${palette.secondaryHex}"/>
        <rect x="108" y="45" width="268" height="220" rx="6" fill="#F8FAFC"/>
        <circle cx="242" cy="118" r="24" fill="${palette.primaryHex}" opacity="0.25"/>
        <text x="242" y="164" font-family="Tajawal, sans-serif" font-size="22" font-weight="bold" fill="${palette.secondaryHex}" text-anchor="middle">التعلم النشط</text>
        <rect x="162" y="184" width="160" height="8" rx="4" fill="${palette.softToneHex}"/>
      </g>
      <line x1="365" y1="95" x2="445" y2="215" stroke="#0F172A" stroke-width="10" stroke-linecap="round"/>
      <circle cx="455" cy="58" r="42" fill="#F8FAFC"/>
      <circle cx="455" cy="52" r="34" fill="#15803D"/>
    </svg>`
  )}`;

  return [
    { id: 'photo-1', imageDataUrl: samplePhoto1 },
    { id: 'photo-2', imageDataUrl: samplePhoto2 },
  ];
}

/**
 * Creates a realistic default experimental Teacher Report document
 * matching the reference templates (`تقرير تنفيذ برنامج`, `تعزيز مهارات التعلم النشط`).
 */
export function createSampleTeacherReportDocument(
  options?: Partial<{
    templateStyle: TeacherPdfTemplateStyle;
    colorSystem: TeacherPdfColorSystem;
    mode: 'short' | 'multi-page';
    evidenceCount: 0 | 1 | 2;
    photoCount: 0 | 1 | 2;
    linkCount: 0 | 1 | 2;
    evidencePhotos: TeacherReportEvidencePhoto[];
    evidenceLinks: TeacherReportEvidenceLink[];
    includeExecutor: boolean;
    includeNationalId: boolean;
    includeSignature: boolean;
    schoolYear: string;
    teacherName: string;
    principalName: string;
  }>
): TeacherReportDocument {
  const templateStyle = options?.templateStyle ?? 'waves';
  const colorSystem = options?.colorSystem ?? 'green';
  const palette = getTeacherColorPalette(colorSystem);
  const mode = options?.mode ?? 'short';
  const fallbackCount = options?.evidenceCount ?? 2;
  const photoCount = options?.photoCount ?? fallbackCount;
  const linkCount = options?.linkCount ?? fallbackCount;
  const includeExecutor = options?.includeExecutor ?? false;
  const includeNationalId = options?.includeNationalId ?? false;
  const includeSignature = options?.includeSignature ?? false;

  const defaultPhotos = createDefaultSampleEvidencePhotos(colorSystem);
  const defaultLinks: [TeacherReportEvidenceLink, TeacherReportEvidenceLink] = [
    {
      id: 'link-1',
      url: 'https://moe.gov.sa/ar/education/Pages/default.aspx',
    },
    {
      id: 'link-2',
      url: 'https://ien.edu.sa/',
    },
  ];

  const resolvedPhotos = Array.isArray(options?.evidencePhotos)
    ? options!.evidencePhotos.slice(0, 2)
    : defaultPhotos.slice(0, photoCount);

  const resolvedLinks = Array.isArray(options?.evidenceLinks)
    ? options!.evidenceLinks.slice(0, 2)
    : defaultLinks.slice(0, linkCount);

  const sampleSignatureSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
      <path d="M25 55 C55 18, 95 65, 135 30 C160 12, 185 48, 215 24" stroke="${palette.secondaryHex}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M50 62 Q120 48 195 58" stroke="${palette.primaryHex}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`
  )}`;

  const maxEvLen = Math.max(resolvedPhotos.length, resolvedLinks.length);
  const compatEvidenceItems: TeacherReportEvidenceItem[] = Array.from(
    { length: maxEvLen },
    (_, idx) => ({
      id: `ev-${idx + 1}`,
      imageDataUrl: resolvedPhotos[idx]?.imageDataUrl,
      linkUrl: resolvedLinks[idx]?.url,
    })
  );

  // Basic fields tailored cleanly for 6-cell table (`waves`), 3-cell bar (`waves-2`), and 4-cell bar (`geometric`)
  const basicFields: TeacherReportBasicField[] =
    templateStyle === 'waves'
      ? [
          {
            id: 'bf-program',
            label: 'اسم البرنامج',
            value: 'تعزيز مهارات التعلم النشط',
            width: 'half',
          },
          {
            id: 'bf-date',
            label: 'التاريخ',
            value: '2025 / 04 / 24',
            width: 'half',
          },
          {
            id: 'bf-period',
            label: 'الفترة',
            value: 'الأسبوع السادس · الحصة الثالثة',
            width: 'half',
          },
          {
            id: 'bf-semester',
            label: 'الفصل الدراسي',
            value: 'الفصل الدراسي الأول',
            width: 'half',
          },
          {
            id: 'bf-executor',
            label: 'المنفذ',
            value:
              options?.teacherName?.trim() || 'أ. عبدالرحمن بن صالح القحطاني',
            width: 'half',
          },
          {
            id: 'bf-dept',
            label: 'جهة التنفيذ',
            value: 'قسم المعلم · معلمو المدرسة',
            width: 'half',
          },
        ]
      : templateStyle === 'waves-2'
        ? [
            {
              id: 'bf-date',
              label: 'تاريخ التنفيذ',
              value: '2025 / 04 / 24',
              width: 'third',
            },
            {
              id: 'bf-target',
              label: 'الفئة المستهدفة',
              value: 'معلمو المدرسة',
              width: 'third',
            },
            {
              id: 'bf-entity',
              label: 'الجهة المنفذة',
              value: 'قسم المعلم',
              width: 'third',
            },
          ]
        : [
            {
              id: 'bf-date',
              label: 'تاريخ التنفيذ',
              value: '2025 / 04 / 24',
              width: 'third',
            },
            {
              id: 'bf-goal',
              label: 'الهدف المستهدف',
              value: 'معلمو المدرسة',
              width: 'third',
            },
            {
              id: 'bf-target',
              label: 'الفئة المستهدفة',
              value: 'جميع المعلمين',
              width: 'third',
            },
            {
              id: 'bf-entity',
              label: 'الجهة المنفذة',
              value: 'قسم المعلم',
              width: 'third',
            },
          ];

  const hasAnyEvidence = resolvedPhotos.length > 0 || resolvedLinks.length > 0;

  const baseSections: TeacherReportContentSection[] = [
    {
      id: 'sec-goal',
      title: templateStyle === 'waves' ? 'أهداف البرنامج' : 'الهدف من البرنامج',
      type: 'text',
      content:
        'تعزيز مهارات التعلم النشط لدى المعلمين من خلال تطبيق استراتيجيات حديثة وفعالة في البيئة التعليمية.',
    },
    {
      id: 'sec-desc',
      title: 'وصف البرنامج',
      type: 'text',
      content:
        'برنامج تدريبي وتفاعلي يهدف إلى تزويد المعلمين بأدوات واستراتيجيات التعلم النشط، مع تطبيقات عملية داخل الصف.',
    },
    ...(templateStyle === 'waves' && !hasAnyEvidence
      ? [
          {
            id: 'sec-axes',
            title: 'محاور التنفيذ',
            type: 'text' as const,
            content:
              'التخطيط التشاركي للأنشطة الصفية، وتفعيل مجموعات التعلم التعاوني، وتطبيق أدوات التقويم البنائي المستمر.',
          },
        ]
      : []),
    {
      id: 'sec-results',
      title: 'النتائج',
      type: 'list',
      items: [
        'تحسن ملحوظ في تطبيق استراتيجيات التعلم النشط.',
        'تفاعل إيجابي من المعلمين والمستفيدين.',
      ],
    },
    {
      id: 'sec-recommendations',
      title: 'التوصيات',
      type: 'list',
      items: [
        'الاستمرار في تنفيذ مثل هذه البرامج بشكل دوري.',
        'توسيع نطاق الاستفادة ليشمل جميع المعلمين.',
      ],
    },
  ];

  const multiPageExtraSections: TeacherReportContentSection[] =
    mode === 'multi-page'
      ? [
          {
            id: 'sec-axes-detailed',
            title: 'محاور التنفيذ',
            type: 'text',
            content:
              'مرّ تنفيذ البرنامج بعدة مراحل منهجية متتابعة بدأت بتشخيص واقع الأداء الصفي وتحديد المهارات المستهدفة بدقة، تلا ذلك تصميم أنشطة متدرجة تراعي الفروق الفردية وتدمج المهام الأدائية الفردية والجماعية.\nوخلال الحصص الدراسية تم تفعيل مجموعات التعلم التعاوني وتوزيع الأدوار القيادية والبحثية، مما أسهم في إيجاد بيئة تعلم محفزة قائمة على الحوار العلمي والتساؤل المنهجي وتبادل الخبرات بين الأقران.',
          },
          {
            id: 'sec-strategies',
            title: 'الاستراتيجيات التدريسية',
            type: 'list',
            items: [
              'تطبيق استراتيجية التفكير الناقد وحل المشكلات عبر سيناريوهات تعليمية واقعية مرتبطة بالمقرر الدراسي.',
              'تفعيل استراتيجية المعلم الصغير والتعلم بالأقران لترسيخ المفاهيم الأساسية وتنمية الثقة بالنفس.',
              'توظيف الخرائط المفاهيمية والمنظمات البصرية لتلخيص الوحدات الدراسية وربط المعارف السابقة باللاحقة.',
              'دمج الأنشطة الرقمية التفاعلية وأوراق العمل التعاونية لرفع مستوى الدافعية والمشاركة الصفية.',
            ],
          },
          {
            id: 'sec-metrics',
            title: 'مؤشرات القياس',
            type: 'fields',
            fields: [
              {
                id: 'metric-attendance',
                label: 'نسبة التفاعل والحضور',
                value: '96%',
                width: 'half',
              },
              {
                id: 'metric-mastery',
                label: 'نسبة تحقق الأهداف المستهدفة',
                value: '92%',
                width: 'half',
              },
              {
                id: 'metric-activities',
                label: 'عدد الأنشطة التطبيقية المنفذة',
                value: '14 نشاطًا تطبيقيًا',
                width: 'half',
              },
              {
                id: 'metric-beneficiaries',
                label: 'نسبة رضا المستفيدين من البرنامج',
                value: '95%',
                width: 'half',
              },
            ],
          },
          {
            id: 'sec-observations',
            title: 'رصد التفاعل الصفي',
            type: 'text',
            content:
              'أظهرت بطاقات الملاحظة الصفية والزيارات التبادلية ارتفاعًا ملموسًا في جودة الأسئلة الصفية المطروحة ومستوى النقاشات العلمية داخل المجموعات، مع التزام واضح بإدارة الوقت وتوزيع المهام بعدالة.\nكما لوحظ تحسن كبير في قدرة المتعلمين على صياغة الاستنتاجات وتقديم التغذية الراجعة البناءة لزملائهم، مما عكس نضجًا في الممارسات التعليمية وتحقيقًا فعليًا لمستهدفات البرنامج.',
          },
          {
            id: 'sec-impact',
            title: 'الأثر التعليمي',
            type: 'list',
            items: [
              'ارتفاع متوسط الأداء في المهام الأدائية والاختبارات القصيرة بعد تطبيق استراتيجيات التعلم النشط.',
              'تنمية مهارات التواصل الفعال والعمل الجماعي وتحمل المسؤولية المشتركة داخل فرق العمل.',
              'انخفاض ملحوظ في مظاهر التشتت الذهني أو العزوف عن المشاركة خلال الحصص الدراسية.',
              'تطوير حقيبة أنشطة إثرائية وعلاجية مساندة يسهل الرجوع إليها وتطويرها خلال الفصول القادمة.',
            ],
          },
          {
            id: 'sec-evaluation-tools',
            title: 'أدوات التقويم',
            type: 'list',
            items: [
              'بطاقات الملاحظة الصفية المقننة لرصد مستوى التفاعل الفردي والجماعي أثناء تنفيذ الأنشطة.',
              'سلالم التقدير اللفظية والعددية لتقييم جودة المشاريع والمهام الأدائية المقدمة.',
              'الاختبارات القبلية والبعدية القصيرة لقياس حجم النمو المعرفي والمهاري المتحقق.',
              'استبانات التقييم الذاتي والتأمل المهني لاستطلاع آراء المستفيدين وتطوير الأداء.',
            ],
          },
          {
            id: 'sec-followup',
            title: 'خطة المتابعة',
            type: 'text',
            content:
              'تتضمن خطة المتابعة المرحلة القادمة عقد لقاءات دورية لمجتمعات التعلم المهنية لمراجعة نتائج التطبيق الصفي وتبادل النماذج المتميزة بين معلمي التخصصات المختلفة في المدرسة.\nوسيتم توثيق الممارسات الناجحة في مكتبة رقمية مدرسية مشتركة تتيح لجميع المعلمين الاستفادة من أوراق العمل والأنشطة المصممة وتكييفها وفق احتياجات طلابهم.',
          },
        ]
      : [];

  return {
    reportTypeLabel: 'تقرير تنفيذ برنامج',
    reportMainTitle: 'تعزيز مهارات التعلم النشط',
    templateStyle,
    colorSystem,
    basicFields,
    sections: [...baseSections, ...multiPageExtraSections],
    evidencePhotos: resolvedPhotos,
    evidenceLinks: resolvedLinks,
    evidenceItems: compatEvidenceItems,
    executorName: includeExecutor
      ? options?.teacherName?.trim() || 'أ. عبدالرحمن بن صالح القحطاني'
      : '',
    nationalId: includeNationalId ? '1048291736' : '',
    signatureDataUrl: includeSignature ? sampleSignatureSvg : '',
    principalName:
      options?.principalName !== undefined
        ? options.principalName
        : 'أ. أحمد العتيبي',
    includePrincipalSignoff: true,
  };
}

export { generateQrSvgDataUrl, TEACHER_TEMPLATE_DEFINITIONS };
