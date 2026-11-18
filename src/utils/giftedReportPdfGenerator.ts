/**
 * محرك توليد التقارير الرسمية بصيغة A4 PDF لقسم الموهوبين (المرحلة الثالثة — القسم العاشر)
 * يدعم النماذج الثلاثة المعتمدة بالهوية العنابية (#7F1D3F) والفحمية (#26323B):
 * 1. تقرير برنامج أو فعالية (مطابق لصفحتي 11 و24 من الدليل المرجعي)
 * 2. التقرير المرحلي لبرنامج مساحة الابتكار (مطابق لصفحة 21 من الدليل المرجعي)
 * 3. التقرير الإداري الختامي المختصر والشامل بصيغة PDF
 */

import {
  GIFTED_CLASSIFICATION_LABELS,
  GIFTED_COORDINATOR_WORK_KIND_LABELS,
  GIFTED_EXECUTION_STATUS_LABELS,
  GIFTED_PARTICIPATION_CATEGORY_LABELS,
  GiftedAttachmentRepository,
  GiftedComprehensiveFinalReportModel,
  GiftedEvidenceLinkItem,
  GiftedEvidencePhotoRef,
  GiftedFinalRecordReportModel,
  GiftedInnovationSpaceProgressReportModel,
  GiftedPeriodicReportModel,
  GiftedProgramOrEventReportModel,
  GiftedStatisticalReportModel,
  GiftedUnifiedProgramReportModel,
  getDefaultGiftedAttachmentRepository,
} from './giftedRecordEngine';
import { drawQrCodeOnCanvas } from './qrCodeGenerator';

const CANVAS_W = 1240;
const CANVAS_H = 1754;
const PDF_PAGE_W_PT = 595.28;
const PDF_PAGE_H_PT = 841.89;

const BURGUNDY = '#7F1D3F';
const BURGUNDY_LIGHT = '#F9EFF2';
const BURGUNDY_BORDER = '#E6C7D0';
const CHARCOAL = '#26323B';
const WARM_IVORY = '#FAF7F5';
const MUTED_TEXT = '#57534E';

// Minimal 1x1 white JPEG for Node.js headless unit tests (where HTMLCanvasElement is unavailable)
const MINIMAL_WHITE_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03,
  0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06,
  0x06, 0x05, 0x06, 0x09, 0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a,
  0x0c, 0x0f, 0x0c, 0x0a, 0x0b, 0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d,
  0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10, 0x0a, 0x0c, 0x12, 0x13, 0x12, 0x10,
  0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x7f, 0x80, 0xff, 0xd9,
]);

export interface GiftedPdfLinkAnnotation {
  pageIndex: number;
  xPx: number;
  yPx: number;
  wPx: number;
  hPx: number;
  url: string;
}

export interface GiftedPdfRenderedPage {
  jpegBytes: Uint8Array;
  width: number;
  height: number;
  links: GiftedPdfLinkAnnotation[];
}

function escapePdfLiteralString(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * تجميع صفحات JPEG متعددة مع روابط تفاعلية في ملف PDF 1.4 قياسي
 */
export function buildMultiPageJpegPdfBytes(
  pages: GiftedPdfRenderedPage[]
): Uint8Array {
  const safePages: GiftedPdfRenderedPage[] =
    pages.length > 0
      ? pages
      : [
          {
            jpegBytes: MINIMAL_WHITE_JPEG,
            width: 1,
            height: 1,
            links: [],
          },
        ];

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr('\nendobj\n');
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const n = safePages.length;
  const pageObjIds: number[] = [];
  const imgObjIds: number[] = [];
  const contentObjIds: number[] = [];
  const annotObjIdsByPage: number[][] = [];

  let nextObjId = 3;
  for (let i = 0; i < n; i++) {
    pageObjIds.push(nextObjId++);
    imgObjIds.push(nextObjId++);
    contentObjIds.push(nextObjId++);
    const pageLinkIds: number[] = [];
    for (let j = 0; j < safePages[i].links.length; j++) {
      pageLinkIds.push(nextObjId++);
    }
    annotObjIdsByPage.push(pageLinkIds);
  }
  const totalObjects = nextObjId - 1;

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds
      .map((id) => `${id} 0 R`)
      .join(' ')}] /Count ${n} >>`
  );
  endObj();

  for (let i = 0; i < n; i++) {
    const pageObjId = pageObjIds[i];
    const imgObjId = imgObjIds[i];
    const contentObjId = contentObjIds[i];
    const annotIds = annotObjIdsByPage[i];
    const page = safePages[i];
    const imgName = `/Im${i + 1}`;

    const annotsEntry =
      annotIds.length > 0
        ? ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(' ')}]`
        : '';

    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_W_PT} ${PDF_PAGE_H_PT}] /Resources << /XObject << ${imgName} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R${annotsEntry} >>`
    );
    endObj();

    startObj(imgObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(page.jpegBytes);
    pushStr('\nendstream');
    endObj();

    const contentStream = `q\n${PDF_PAGE_W_PT} 0 0 ${PDF_PAGE_H_PT} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr('endstream');
    endObj();

    for (let j = 0; j < page.links.length; j++) {
      const link = page.links[j];
      const annotId = annotIds[j];

      const scaleX = PDF_PAGE_W_PT / Math.max(1, page.width);
      const scaleY = PDF_PAGE_H_PT / Math.max(1, page.height);
      const llx = (link.xPx * scaleX).toFixed(2);
      const urx = ((link.xPx + link.wPx) * scaleX).toFixed(2);
      const ury = (PDF_PAGE_H_PT - link.yPx * scaleY).toFixed(2);
      const lly = (PDF_PAGE_H_PT - (link.yPx + link.hPx) * scaleY).toFixed(2);

      const safeUrl = escapePdfLiteralString(link.url);
      startObj(annotId);
      pushStr(
        `<< /Type /Annot /Subtype /Link /Rect [${llx} ${lly} ${urx} ${ury}] /Border [0 0 0] /A << /Type /Action /S /URI /URI (${safeUrl}) >> >>`
      );
      endObj();
    }
  }

  const xrefOffset = currentOffset;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    const padded = String(offsets[id] || 0).padStart(10, '0');
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

function createA4Canvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تهيئة سياق الرسم الثنائي لإصدار التقرير.');
  }
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  return { canvas, ctx };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillHex?: string,
  strokeHex?: string,
  lineWidth = 1.5
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fillHex) {
    ctx.fillStyle = fillHex;
    ctx.fill();
  }
  if (strokeHex) {
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function wrapArabicText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const normalized = (text || '—').trim();
  if (!normalized) return ['—'];
  const safeMaxW = Math.max(60, maxWidth);
  const paragraphs = normalized.split(/\r?\n/);
  const lines: string[] = [];

  const breakLongToken = (token: string): string[] => {
    if (ctx.measureText(token).width <= safeMaxW) return [token];
    const parts: string[] = [];
    let chunk = '';
    for (const ch of token) {
      const next = chunk + ch;
      if (ctx.measureText(next).width <= safeMaxW || chunk.length === 0) {
        chunk = next;
      } else {
        parts.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) parts.push(chunk);
    return parts.length > 0 ? parts : [token];
  };

  for (const para of paragraphs) {
    const rawWords = para.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) {
      lines.push('');
      continue;
    }
    const words = rawWords.flatMap(breakLongToken);
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= safeMaxW) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : ['—'];
}

function wrapUrlText(
  ctx: CanvasRenderingContext2D,
  url: string,
  maxWidth: number
): string[] {
  const clean = (url || '').trim();
  if (!clean) return ['—'];
  const safeMaxW = Math.max(80, maxWidth);
  if (ctx.measureText(clean).width <= safeMaxW) return [clean];

  // Break preferentially after '/', '-', '_', '.', '?', '&', '='
  const tokens = clean.match(/[^/\-_?&=]+[/\-_?&=]?/g) || [clean];
  const lines: string[] = [];
  let current = '';

  for (const tok of tokens) {
    const candidate = current + tok;
    if (ctx.measureText(candidate).width <= safeMaxW) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(tok).width <= safeMaxW) {
        current = tok;
      } else {
        // Hard character wrap for very long unbroken token
        let sub = '';
        for (const ch of tok) {
          if (ctx.measureText(sub + ch).width <= safeMaxW || sub.length === 0) {
            sub += ch;
          } else {
            lines.push(sub);
            sub = ch;
          }
        }
        current = sub;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [clean];
}

function fillTextAutoFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseFontPx: number,
  fontWeight: string,
  fontFamily: string,
  minFontPx = 11
) {
  let size = baseFontPx;
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  while (size > minFontPx && ctx.measureText(text).width > maxWidth) {
    size -= 0.5;
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  }
  ctx.fillText(text, x, y);
}

function drawPageFrameHeader(
  ctx: CanvasRenderingContext2D,
  options: {
    mainTitle: string;
    subTitle: string;
    schoolName: string;
    educationDepartment: string;
    academicYear: string;
  }
) {
  // White A4 background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Outer burgundy frame
  drawRoundedRect(
    ctx,
    36,
    36,
    CANVAS_W - 72,
    CANVAS_H - 72,
    18,
    undefined,
    BURGUNDY_BORDER,
    2
  );

  // Top Header Banner (Burgundy + Charcoal)
  drawRoundedRect(ctx, 56, 52, CANVAS_W - 112, 128, 16, CHARCOAL);
  drawRoundedRect(ctx, 56, 52, 420, 128, 16, BURGUNDY);

  // Right side: Kingdom & Ministry & Department & School
  const rightAreaMaxW = CANVAS_W - 84 - 492;
  ctx.save();
  ctx.textAlign = 'right';

  const combinedDeptSchool = `${options.educationDepartment} • ${options.schoolName}`;
  ctx.font = '600 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  const deptSchoolLines = wrapArabicText(ctx, combinedDeptSchool, rightAreaMaxW);

  if (deptSchoolLines.length <= 1) {
    ctx.fillStyle = '#FFFFFF';
    fillTextAutoFit(
      ctx,
      'المملكة العربية السعودية — وزارة التعليم',
      CANVAS_W - 84,
      88,
      rightAreaMaxW,
      20,
      'bold',
      '"Cairo", "Tajawal", sans-serif'
    );

    ctx.fillStyle = '#F6D5DF';
    fillTextAutoFit(
      ctx,
      combinedDeptSchool,
      CANVAS_W - 84,
      121,
      rightAreaMaxW,
      16.5,
      '600',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
      11
    );

    ctx.fillStyle = '#E7E5E4';
    fillTextAutoFit(
      ctx,
      `سجل منسق الموهوبين — ${options.academicYear}`,
      CANVAS_W - 84,
      154,
      rightAreaMaxW,
      15,
      '600',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
      10.5
    );
  } else {
    ctx.fillStyle = '#FFFFFF';
    fillTextAutoFit(
      ctx,
      'المملكة العربية السعودية — وزارة التعليم',
      CANVAS_W - 84,
      80,
      rightAreaMaxW,
      19,
      'bold',
      '"Cairo", "Tajawal", sans-serif'
    );

    ctx.fillStyle = '#F6D5DF';
    const firstLine = deptSchoolLines[0];
    const secondLine = deptSchoolLines.slice(1).join(' ');
    fillTextAutoFit(
      ctx,
      firstLine,
      CANVAS_W - 84,
      108,
      rightAreaMaxW,
      14,
      '600',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
      10
    );
    fillTextAutoFit(
      ctx,
      secondLine,
      CANVAS_W - 84,
      131,
      rightAreaMaxW,
      14,
      '600',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
      10
    );

    ctx.fillStyle = '#E7E5E4';
    fillTextAutoFit(
      ctx,
      `سجل منسق الموهوبين — ${options.academicYear}`,
      CANVAS_W - 84,
      159,
      rightAreaMaxW,
      14,
      '600',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
      10.5
    );
  }

  // Left side (inside Burgundy box): Report Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  fillTextAutoFit(
    ctx,
    options.mainTitle,
    266,
    108,
    392,
    23,
    'bold',
    '"Cairo", "Tajawal", sans-serif',
    11
  );

  ctx.fillStyle = '#F6D5DF';
  fillTextAutoFit(
    ctx,
    options.subTitle,
    266,
    144,
    392,
    15,
    '600',
    '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
    10.5
  );
  ctx.restore();
}

function drawPageFooterStrip(
  ctx: CanvasRenderingContext2D,
  schoolName: string,
  pageNumber: number,
  totalPages: number
) {
  drawRoundedRect(
    ctx,
    56,
    CANVAS_H - 102,
    CANVAS_W - 112,
    48,
    10,
    WARM_IVORY,
    BURGUNDY_BORDER,
    1
  );
  ctx.save();
  ctx.fillStyle = CHARCOAL;
  ctx.textAlign = 'right';
  fillTextAutoFit(
    ctx,
    `سجل منسق الموهوبين — ${schoolName}`,
    CANVAS_W - 76,
    CANVAS_H - 72,
    CANVAS_W - 320,
    15,
    'bold',
    '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
    9.5
  );
  ctx.textAlign = 'left';
  ctx.fillStyle = BURGUNDY;
  ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  ctx.fillText(`صفحة ${pageNumber} من ${totalPages}`, 76, CANVAS_H - 72);
  ctx.restore();
}

const MAX_CONTENT_BOTTOM_Y = CANVAS_H - 112;

interface MultiPageCanvasController {
  ctx: CanvasRenderingContext2D;
  y: number;
  pageIndex: number;
  ensureSpace: (neededHeight: number) => void;
  pushLinkOnCurrentPage: (
    xPx: number,
    yPx: number,
    wPx: number,
    hPx: number,
    url: string
  ) => void;
  finalizeToPdfPages: () => Promise<GiftedPdfRenderedPage[]>;
}

function createMultiPageController(headerOptions: {
  mainTitle: string;
  subTitle: string;
  schoolName: string;
  educationDepartment: string;
  academicYear: string;
}): MultiPageCanvasController {
  const pages: Array<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    links: GiftedPdfLinkAnnotation[];
  }> = [];

  const openNewPage = () => {
    const { canvas, ctx } = createA4Canvas();
    drawPageFrameHeader(ctx, headerOptions);
    pages.push({ canvas, ctx, links: [] });
  };

  openNewPage();

  const controller: MultiPageCanvasController = {
    get ctx() {
      return pages[pages.length - 1].ctx;
    },
    y: 192,
    get pageIndex() {
      return pages.length - 1;
    },
    ensureSpace(neededHeight: number) {
      if (this.y + neededHeight > MAX_CONTENT_BOTTOM_Y && this.y > 212) {
        openNewPage();
        this.y = 192;
      }
    },
    pushLinkOnCurrentPage(xPx, yPx, wPx, hPx, url) {
      pages[pages.length - 1].links.push({
        pageIndex: pages.length - 1,
        xPx,
        yPx,
        wPx,
        hPx,
        url,
      });
    },
    async finalizeToPdfPages() {
      const total = pages.length;
      const out: GiftedPdfRenderedPage[] = [];
      for (let i = 0; i < total; i++) {
        drawPageFooterStrip(
          pages[i].ctx,
          headerOptions.schoolName,
          i + 1,
          total
        );
        const jpegBytes = await canvasToJpegBytes(pages[i].canvas);
        out.push({
          jpegBytes,
          width: CANVAS_W,
          height: CANVAS_H,
          links: pages[i].links,
        });
      }
      return out;
    },
  };

  return controller;
}

function drawSectionBanner(
  ctrl: MultiPageCanvasController,
  title: string,
  badgeText?: string,
  minFollowingHeight = 80
) {
  ctrl.ensureSpace(44 + minFollowingHeight);
  const { ctx, y } = ctrl;
  drawRoundedRect(ctx, 56, y, CANVAS_W - 112, 37, 10, BURGUNDY);
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'right';
  const maxTitleW = badgeText ? CANVAS_W - 360 : CANVAS_W - 150;
  fillTextAutoFit(
    ctx,
    title,
    CANVAS_W - 78,
    y + 25,
    maxTitleW,
    17.5,
    'bold',
    '"Cairo", "Tajawal", sans-serif'
  );
  if (badgeText) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F6D5DF';
    fillTextAutoFit(
      ctx,
      badgeText,
      78,
      y + 24,
      240,
      13.5,
      '600',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif'
    );
  }
  ctx.restore();
  ctrl.y = y + 43;
}

function drawKeyValueGrid2Cols(
  ctrl: MultiPageCanvasController,
  pairs: Array<{ label: string; value: string }>
) {
  const colW = (CANVAS_W - 128) / 2;
  const textMaxW = colW - 36;
  const valueLineH = 19;
  const labelLineH = 17;

  for (let i = 0; i < pairs.length; i += 2) {
    const rightItem = pairs[i];
    const leftItem = pairs[i + 1];

    const measureItem = (item?: { label: string; value: string }) => {
      if (!item) return { labelLines: [] as string[], valueLines: [] as string[], h: 0 };
      const ctx = ctrl.ctx;
      ctx.save();
      ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      const labelLines = wrapArabicText(ctx, item.label, textMaxW);
      ctx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      const valueLines = wrapArabicText(ctx, item.value || '—', textMaxW);
      ctx.restore();
      const h =
        8 +
        labelLines.length * labelLineH +
        2 +
        valueLines.length * valueLineH +
        7;
      return { labelLines, valueLines, h: Math.max(48, h) };
    };

    const rightMeasured = measureItem(rightItem);
    const leftMeasured = measureItem(leftItem);
    const rowH = Math.max(rightMeasured.h, leftMeasured.h);

    ctrl.ensureSpace(rowH + 5);
    const { ctx, y } = ctrl;

    // Right card
    drawRoundedRect(
      ctx,
      CANVAS_W - 56 - colW,
      y,
      colW,
      rowH,
      10,
      WARM_IVORY,
      BURGUNDY_BORDER,
      1
    );
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = BURGUNDY;
    ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    let rCursorY = y + 18;
    for (const lLine of rightMeasured.labelLines) {
      ctx.fillText(lLine, CANVAS_W - 74, rCursorY);
      rCursorY += labelLineH;
    }
    ctx.fillStyle = CHARCOAL;
    ctx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    rCursorY += 2;
    for (const vLine of rightMeasured.valueLines) {
      ctx.fillText(vLine, CANVAS_W - 74, rCursorY);
      rCursorY += valueLineH;
    }
    ctx.restore();

    // Left card
    if (leftItem) {
      drawRoundedRect(ctx, 56, y, colW, rowH, 10, WARM_IVORY, BURGUNDY_BORDER, 1);
      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = BURGUNDY;
      ctx.font = 'bold 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      let lCursorY = y + 18;
      for (const lLine of leftMeasured.labelLines) {
        ctx.fillText(lLine, 56 + colW - 18, lCursorY);
        lCursorY += labelLineH;
      }
      ctx.fillStyle = CHARCOAL;
      ctx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      lCursorY += 2;
      for (const vLine of leftMeasured.valueLines) {
        ctx.fillText(vLine, 56 + colW - 18, lCursorY);
        lCursorY += valueLineH;
      }
      ctx.restore();
    }

    ctrl.y = y + rowH + 5;
  }
}

function drawLabeledParagraphBox(
  ctrl: MultiPageCanvasController,
  label: string,
  content: string
) {
  const lineH = 21;
  ctrl.ctx.save();
  ctrl.ctx.font = '500 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  const lines = wrapArabicText(ctrl.ctx, content || '—', CANVAS_W - 156);
  ctrl.ctx.font = 'bold 13.5px "Cairo", "Tajawal", sans-serif';
  const measuredLabelW = ctrl.ctx.measureText(label).width;
  ctrl.ctx.restore();

  const pillW = Math.min(CANVAS_W - 130, Math.max(220, measuredLabelW + 36));
  const boxH = 30 + lines.length * lineH + 8;

  ctrl.ensureSpace(boxH + 6);
  const { ctx, y } = ctrl;

  drawRoundedRect(
    ctx,
    56,
    y,
    CANVAS_W - 112,
    boxH,
    10,
    '#FFFFFF',
    BURGUNDY_BORDER,
    1.2
  );
  drawRoundedRect(ctx, CANVAS_W - 56 - pillW, y, pillW, 26, 8, BURGUNDY_LIGHT);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = BURGUNDY;
  fillTextAutoFit(
    ctx,
    label,
    CANVAS_W - 72,
    y + 18,
    pillW - 28,
    13.5,
    'bold',
    '"Cairo", "Tajawal", sans-serif'
  );

  ctx.fillStyle = CHARCOAL;
  ctx.font = '500 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  lines.forEach((line, idx) => {
    ctx.fillText(line, CANVAS_W - 74, y + 44 + idx * lineH);
  });
  ctx.restore();
  ctrl.y = y + boxH + 6;
}

function drawSignoffBlock(
  ctrl: MultiPageCanvasController,
  rightRoleTitle: string,
  rightPersonName: string,
  leftRoleTitle: string,
  leftPersonName: string
) {
  const boxW = (CANVAS_W - 136) / 2;
  const innerMaxW = boxW - 36;

  ctrl.ctx.save();
  ctrl.ctx.font = 'bold 15px "Cairo", "Tajawal", sans-serif';
  const rRoleLines = wrapArabicText(ctrl.ctx, rightRoleTitle || 'منسق الموهوبين', innerMaxW);
  const lRoleLines = wrapArabicText(ctrl.ctx, leftRoleTitle || 'مدير المدرسة', innerMaxW);
  ctrl.ctx.font = 'bold 16px "Cairo", "Tajawal", sans-serif';
  const rNameLines = wrapArabicText(ctrl.ctx, rightPersonName || 'غير محدد', innerMaxW);
  const lNameLines = wrapArabicText(ctrl.ctx, leftPersonName || 'غير محدد', innerMaxW);
  ctrl.ctx.restore();

  const maxRoleLines = Math.max(rRoleLines.length, lRoleLines.length);
  const maxNameLines = Math.max(rNameLines.length, lNameLines.length);
  const boxH = Math.max(96, 18 + maxRoleLines * 19 + maxNameLines * 21 + 32);

  ctrl.ensureSpace(boxH + 4);
  const y = Math.max(ctrl.y + 4, Math.min(1490, MAX_CONTENT_BOTTOM_Y - boxH));
  const { ctx } = ctrl;

  // Right Box (Coordinator / Teacher)
  drawRoundedRect(
    ctx,
    CANVAS_W - 56 - boxW,
    y,
    boxW,
    boxH,
    12,
    WARM_IVORY,
    BURGUNDY_BORDER,
    1.5
  );
  ctx.save();
  ctx.textAlign = 'center';
  const rightCenter = CANVAS_W - 56 - boxW / 2;
  ctx.fillStyle = BURGUNDY;
  ctx.font = 'bold 15px "Cairo", "Tajawal", sans-serif';
  let ry = y + 25;
  for (const line of rRoleLines) {
    ctx.fillText(line, rightCenter, ry);
    ry += 19;
  }
  ctx.fillStyle = CHARCOAL;
  ctx.font = 'bold 16px "Cairo", "Tajawal", sans-serif';
  ry += 3;
  for (const line of rNameLines) {
    ctx.fillText(line, rightCenter, ry);
    ry += 21;
  }
  ctx.fillStyle = MUTED_TEXT;
  ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  ctx.fillText('التوقيع', rightCenter, y + boxH - 14);

  // Left Box (Principal)
  drawRoundedRect(ctx, 56, y, boxW, boxH, 12, WARM_IVORY, BURGUNDY_BORDER, 1.5);
  const leftCenter = 56 + boxW / 2;
  ctx.fillStyle = BURGUNDY;
  ctx.font = 'bold 15px "Cairo", "Tajawal", sans-serif';
  let ly = y + 25;
  for (const line of lRoleLines) {
    ctx.fillText(line, leftCenter, ly);
    ly += 19;
  }
  ctx.fillStyle = CHARCOAL;
  ctx.font = 'bold 16px "Cairo", "Tajawal", sans-serif';
  ly += 3;
  for (const line of lNameLines) {
    ctx.fillText(line, leftCenter, ly);
    ly += 21;
  }
  ctx.fillStyle = MUTED_TEXT;
  ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  ctx.fillText('التوقيع', leftCenter, y + boxH - 14);
  ctx.restore();

  ctrl.y = y + boxH + 10;
}

async function loadImageFromAttachmentRepo(
  repo: GiftedAttachmentRepository,
  blobKey: string
): Promise<HTMLImageElement | null> {
  try {
    const att = await repo.getAttachment(blobKey);
    if (!att || !att.bytes || att.bytes.length === 0) return null;
    const blob = new Blob([new Uint8Array(att.bytes)], {
      type: att.mimeType || 'image/png',
    });
    const url = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

async function drawEvidencesSectionOnCanvas(
  ctrl: MultiPageCanvasController,
  photos: GiftedEvidencePhotoRef[],
  links: GiftedEvidenceLinkItem[],
  repo: GiftedAttachmentRepository
) {
  const maxPhotos = photos.slice(0, 4);
  const maxLinks = links.slice(0, 4);
  const cardW = (CANVAS_W - 142) / 4;
  const captionMaxW = cardW - 18;
  const captionLineH = 16.5;
  const imgBoxH = 98;

  // Pre-measure photo cards so banner knows exact height of following block
  ctrl.ctx.save();
  const wrappedPhotoCaptions = maxPhotos.map((photo, idx) => {
    ctrl.ctx.font = 'bold 12px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    const titleLines = wrapArabicText(
      ctrl.ctx,
      photo.title || `شاهد ${idx + 1}`,
      captionMaxW
    );
    ctrl.ctx.font = '500 11px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    const capLines = photo.caption
      ? wrapArabicText(ctrl.ctx, photo.caption, captionMaxW)
      : [];
    return { titleLines, capLines };
  });
  ctrl.ctx.restore();

  const maxCaptionLinesCount =
    maxPhotos.length > 0
      ? Math.max(
          1,
          ...wrappedPhotoCaptions.map(
            (c) => c.titleLines.length + c.capLines.length
          )
        )
      : 0;
  const photoRowH =
    maxPhotos.length > 0
      ? 14 + imgBoxH + 8 + maxCaptionLinesCount * captionLineH + 8
      : 0;

  const linkCardW = (CANVAS_W - 128) / 2;
  const linkTextMaxW = linkCardW - 118;
  const titleLineH = 18.5;
  const urlLineH = 15.5;

  const measureLinkCard = (item?: GiftedEvidenceLinkItem, idx = 0) => {
    if (!item) {
      return {
        titleLines: [] as string[],
        urlLines: [] as string[],
        h: 0,
      };
    }
    const ctx = ctrl.ctx;
    ctx.save();
    ctx.font = 'bold 13px "Cairo", "Tajawal", sans-serif';
    const titleLines = wrapArabicText(
      ctx,
      item.title || `رابط شاهد ${idx + 1}`,
      linkTextMaxW
    );
    ctx.font = '500 11.5px "IBM Plex Sans Arabic", monospace';
    const urlLines = wrapUrlText(ctx, item.url, linkTextMaxW);
    ctx.restore();
    const h =
      14 +
      titleLines.length * titleLineH +
      3 +
      urlLines.length * urlLineH +
      22 +
      8;
    return { titleLines, urlLines, h: Math.max(102, h) };
  };

  const firstLinkRowH =
    maxLinks.length > 0
      ? Math.max(
          measureLinkCard(maxLinks[0], 0).h,
          measureLinkCard(maxLinks[1], 1).h
        )
      : 0;

  const firstFollowingBlockH =
    photoRowH > 0 ? photoRowH + 10 : firstLinkRowH > 0 ? firstLinkRowH + 10 : 120;

  drawSectionBanner(
    ctrl,
    'شواهد التنفيذ المختارة (صور التوثيق والروابط الإلكترونية)',
    `صور: ${photos.length} • روابط QR: ${links.length}`,
    firstFollowingBlockH
  );

  if (maxPhotos.length > 0) {
    const cardH = photoRowH;
    ctrl.ensureSpace(cardH + 8);
    const { ctx, y } = ctrl;

    for (let i = 0; i < maxPhotos.length; i++) {
      const photo = maxPhotos[i];
      const { titleLines, capLines } = wrappedPhotoCaptions[i];
      const cardX = CANVAS_W - 56 - (i + 1) * cardW - i * 10;
      drawRoundedRect(
        ctx,
        cardX,
        y,
        cardW,
        cardH,
        10,
        WARM_IVORY,
        BURGUNDY_BORDER,
        1.2
      );

      const img = await loadImageFromAttachmentRepo(repo, photo.blobKey);
      const boxX = cardX + 8;
      const boxY = y + 8;
      const boxW = cardW - 16;
      drawRoundedRect(
        ctx,
        boxX,
        boxY,
        boxW,
        imgBoxH,
        6,
        '#FFFFFF',
        BURGUNDY_BORDER,
        1
      );
      if (img) {
        ctx.save();
        const natW = Math.max(1, img.naturalWidth || img.width || 1);
        const natH = Math.max(1, img.naturalHeight || img.height || 1);
        const scale = Math.min((boxW - 8) / natW, (imgBoxH - 8) / natH);
        const drawW = Math.max(1, Math.round(natW * scale));
        const drawH = Math.max(1, Math.round(natH * scale));
        const drawX = boxX + Math.floor((boxW - drawW) / 2);
        const drawY = boxY + Math.floor((imgBoxH - drawH) / 2);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
      } else {
        drawRoundedRect(
          ctx,
          boxX,
          boxY,
          boxW,
          imgBoxH,
          6,
          BURGUNDY_LIGHT,
          BURGUNDY_BORDER,
          1
        );
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = BURGUNDY;
        ctx.font = 'bold 12.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
        ctx.fillText('شاهد مصور محفوظ', cardX + cardW / 2, y + 60);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = CHARCOAL;
      ctx.font = 'bold 12px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
      let textY = y + 8 + imgBoxH + 18;
      for (const tLine of titleLines) {
        ctx.fillText(tLine, cardX + cardW / 2, textY);
        textY += captionLineH;
      }
      if (capLines.length > 0) {
        ctx.fillStyle = MUTED_TEXT;
        ctx.font = '500 11px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
        for (const cLine of capLines) {
          ctx.fillText(cLine, cardX + cardW / 2, textY);
          textY += captionLineH;
        }
      }
      ctx.restore();
    }
    ctrl.y = y + cardH + 8;
  }

  if (maxLinks.length > 0) {
    for (let i = 0; i < maxLinks.length; i += 2) {
      const rightLink = maxLinks[i];
      const leftLink = maxLinks[i + 1];

      const rightM = measureLinkCard(rightLink, i);
      const leftM = measureLinkCard(leftLink, i + 1);
      const rowH = Math.max(rightM.h, leftM.h);

      ctrl.ensureSpace(rowH + 8);
      const { ctx, y } = ctrl;

      const drawSingleLinkCard = (
        item: GiftedEvidenceLinkItem,
        measured: { titleLines: string[]; urlLines: string[] },
        cardX: number
      ) => {
        drawRoundedRect(
          ctx,
          cardX,
          y,
          linkCardW,
          rowH,
          10,
          '#FFFFFF',
          BURGUNDY_BORDER,
          1.2
        );

        const qrSize = 84;
        const qrY = y + Math.max(8, Math.floor((rowH - qrSize) / 2));
        drawQrCodeOnCanvas(
          ctx,
          item.url,
          cardX + 12,
          qrY,
          qrSize,
          CHARCOAL,
          '#FFFFFF',
          2
        );

        ctx.save();
        ctx.textAlign = 'right';
        ctx.fillStyle = BURGUNDY;
        ctx.font = 'bold 13px "Cairo", "Tajawal", sans-serif';
        let curY = y + 23;
        for (const tLine of measured.titleLines) {
          ctx.fillText(tLine, cardX + linkCardW - 16, curY);
          curY += titleLineH;
        }

        ctx.fillStyle = CHARCOAL;
        ctx.font = '500 11.5px "IBM Plex Sans Arabic", monospace';
        curY += 2;
        for (const uLine of measured.urlLines) {
          ctx.fillText(uLine, cardX + linkCardW - 16, curY);
          curY += urlLineH;
        }

        ctx.fillStyle = MUTED_TEXT;
        ctx.font = '600 11px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
        ctx.fillText(
          'امسح رمز QR أو انقر لفتح الشاهد الإلكتروني',
          cardX + linkCardW - 16,
          y + rowH - 12
        );
        ctx.restore();

        ctrl.pushLinkOnCurrentPage(cardX, y, linkCardW, rowH, item.url);
      };

      drawSingleLinkCard(rightLink, rightM, CANVAS_W - 56 - linkCardW);
      if (leftLink) {
        drawSingleLinkCard(leftLink, leftM, 56);
      }

      ctrl.y = y + rowH + 8;
    }
  }
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) return MINIMAL_WHITE_JPEG;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// ١. توليد PDF «تقرير برنامج أو فعالية» (مطابق لصفحتي 11 و24 من الدليل المرجعي)
// ============================================================================

export async function generateGiftedProgramOrEventReportPdf(
  model: GiftedProgramOrEventReportModel,
  attachmentRepo?: GiftedAttachmentRepository
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: model.eventData.showEvidences
          ? model.eventData.selectedLinks.map((l, idx) => ({
              pageIndex: 0,
              xPx: 60,
              yPx: 900 + idx * 40,
              wPx: 300,
              hPx: 35,
              url: l.url,
            }))
          : [],
      },
    ]);
  }

  const repo = attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const ctrl = createMultiPageController({
    mainTitle: 'تقرير برنامج أو فعالية',
    subTitle: model.sourcePagesLabel,
    schoolName: model.basicInfo.schoolName,
    educationDepartment: model.basicInfo.educationDepartment,
    academicYear: `${model.basicInfo.academicYear} — ${model.basicInfo.semesterLabel}`,
  });

  // أولاً: معلومات عامة
  drawSectionBanner(ctrl, 'أولاً: معلومات عامة', model.targetCategoryLabel);

  drawKeyValueGrid2Cols(ctrl, [
    { label: 'اسم الفعالية / البرنامج', value: model.generalInfo.eventName },
    { label: 'اليوم', value: model.generalInfo.dayLabel },
    { label: 'التاريخ', value: model.generalInfo.executionDate },
    { label: 'مدة التنفيذ', value: model.generalInfo.durationLabel },
  ]);

  ctrl.y += 4;

  // ثانياً: بيانات عن الفعالية
  drawSectionBanner(ctrl, 'ثانياً: بيانات عن الفعالية');

  drawKeyValueGrid2Cols(ctrl, [
    { label: 'الفئة المستهدفة', value: model.eventData.targetAudience },
    { label: 'عدد المستفيدين', value: model.eventData.beneficiariesCount },
  ]);

  drawLabeledParagraphBox(
    ctrl,
    'الهدف من البرنامج / الفعالية',
    model.eventData.objective
  );

  drawLabeledParagraphBox(
    ctrl,
    'آلية التنفيذ والإجراءات المنفذة',
    model.eventData.executionMechanism
  );

  drawLabeledParagraphBox(
    ctrl,
    'الصعوبات والتحديات',
    model.eventData.difficulties
  );

  drawLabeledParagraphBox(
    ctrl,
    'الاقتراحات التطويرية',
    model.eventData.suggestions
  );

  if (model.eventData.showEvidences) {
    await drawEvidencesSectionOnCanvas(
      ctrl,
      model.eventData.selectedPhotos,
      model.eventData.selectedLinks,
      repo
    );
  }

  drawSignoffBlock(
    ctrl,
    model.basicInfo.coordinatorTitle,
    model.basicInfo.coordinatorName,
    model.basicInfo.principalTitle,
    model.basicInfo.principalName
  );

  const renderedPages = await ctrl.finalizeToPdfPages();
  return buildMultiPageJpegPdfBytes(renderedPages);
}

// ============================================================================
// ٢. توليد PDF «التقرير المرحلي لبرنامج مساحة الابتكار» (مطابق لصفحة 21 من الدليل المرجعي)
// ============================================================================

export async function generateGiftedInnovationSpaceProgressReportPdf(
  model: GiftedInnovationSpaceProgressReportModel,
  attachmentRepo?: GiftedAttachmentRepository
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: model.executionData.showEvidences
          ? model.executionData.selectedLinks.map((l, idx) => ({
              pageIndex: 0,
              xPx: 60,
              yPx: 900 + idx * 40,
              wPx: 300,
              hPx: 35,
              url: l.url,
            }))
          : [],
      },
    ]);
  }

  const repo = attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const ctrl = createMultiPageController({
    mainTitle: 'التقرير المرحلي لبرنامج مساحة الابتكار',
    subTitle: 'نموذج صفحة ٢١ المعتمد',
    schoolName: model.basicData.schoolName,
    educationDepartment: model.basicData.educationDepartment,
    academicYear: model.basicData.semesterLabel,
  });

  // أولاً: البيانات الأساسية (6 حقول مطابقة لصفحة 21)
  drawSectionBanner(ctrl, 'أولاً: البيانات الأساسية');
  drawKeyValueGrid2Cols(ctrl, [
    { label: 'الإدارة التعليمية', value: model.basicData.educationDepartment },
    { label: 'الفصل الدراسي', value: model.basicData.semesterLabel },
    { label: 'المدرسة', value: model.basicData.schoolName },
    {
      label: model.basicData.principalTitle,
      value: model.basicData.principalName,
    },
    { label: 'المرحلة التعليمية', value: model.basicData.educationalStage },
    {
      label: model.basicData.innovationTeacherTitle,
      value: model.basicData.innovationTeacherName,
    },
  ]);

  ctrl.y += 4;

  // ثانياً: بيانات التنفيذ (10 حقول مطابقة لصفحة 21)
  drawSectionBanner(
    ctrl,
    'ثانياً: بيانات التنفيذ والمخرجات الابتكارية',
    `الإجراءات المنفذة: ${model.executionData.executedActionsCount} من ${model.executionData.totalActionsCount}`
  );

  drawKeyValueGrid2Cols(ctrl, [
    { label: 'الوحدة الإثرائية', value: model.executionData.enrichmentUnit },
    { label: 'المرحلة الدراسية', value: model.executionData.targetGrade },
    { label: 'عدد المستفيدين', value: model.executionData.beneficiariesCount },
    { label: 'عدد المخرجات', value: model.executionData.outputsCount },
    {
      label: 'عدد المخرجات المتميزة',
      value: model.executionData.distinguishedOutputsCount,
    },
    {
      label: 'الجهات الداعمة إن وجدت',
      value: model.executionData.supportingEntities,
    },
  ]);

  drawLabeledParagraphBox(
    ctrl,
    'وصف مختصر للمخرجات المتميزة',
    model.executionData.distinguishedOutputsSummary
  );

  drawLabeledParagraphBox(
    ctrl,
    'الإيجابيات',
    model.executionData.strengths
  );

  drawLabeledParagraphBox(
    ctrl,
    'التحديات',
    model.executionData.challenges
  );

  drawLabeledParagraphBox(
    ctrl,
    'المقترحات التطويرية',
    model.executionData.improvementProposals
  );

  if (model.executionData.showEvidences) {
    await drawEvidencesSectionOnCanvas(
      ctrl,
      model.executionData.selectedPhotos,
      model.executionData.selectedLinks,
      repo
    );
  }

  drawSignoffBlock(
    ctrl,
    model.basicData.innovationTeacherTitle,
    model.basicData.innovationTeacherName,
    model.basicData.principalTitle,
    model.basicData.principalName
  );

  const renderedPages = await ctrl.finalizeToPdfPages();
  return buildMultiPageJpegPdfBytes(renderedPages);
}

// ============================================================================
// ٣. توليد PDF «التقرير الإداري الختامي المختصر والشامل»
// ============================================================================

export async function generateGiftedFinalRecordPdf(
  model: GiftedFinalRecordReportModel,
  attachmentRepo?: GiftedAttachmentRepository
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    const allLinks = model.selectedEvidenceGroups.flatMap((g) => g.links);
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: [],
      },
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: allLinks.map((l, idx) => ({
          pageIndex: 1,
          xPx: 60,
          yPx: 400 + idx * 40,
          wPx: 300,
          hPx: 35,
          url: l.url,
        })),
      },
    ]);
  }

  const repo = attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const ctrl = createMultiPageController({
    mainTitle: 'التقرير الإداري الختامي لسجل الموهوبين',
    subTitle:
      model.mode === 'detailed'
        ? 'نسخة شاملة ومفصلة'
        : 'نسخة تنفيذية مختصرة وشاملة',
    schoolName: model.basicInfo.schoolName,
    educationDepartment: model.basicInfo.educationDepartment,
    academicYear: `${model.basicInfo.academicYear} — ${model.basicInfo.semesterLabel}`,
  });

  // --------------------------------------------------------------------------
  // القسم الأول: البيانات الأساسية + مؤشرات الإنجاز + ملخص البرامج والمبادرات والطلاب
  // --------------------------------------------------------------------------
  drawSectionBanner(
    ctrl,
    'أولاً: البيانات الأساسية ومؤشرات الإنجاز المعتمدة'
  );

  drawKeyValueGrid2Cols(ctrl, [
    { label: 'الإدارة التعليمية', value: model.basicInfo.educationDepartment },
    {
      label: 'المدرسة والمرحلة',
      value: `${model.basicInfo.schoolName} (${model.basicInfo.schoolStageLabel})`,
    },
    { label: model.basicInfo.coordinatorTitle, value: model.basicInfo.coordinatorName },
    { label: model.basicInfo.principalTitle, value: model.basicInfo.principalName },
    {
      label: 'مؤشر إنجاز الخطة التنفيذية (القسم ٢)',
      value: `${model.completionMetrics.executivePlanMetrics.completionPercentage}% (نفذ ${model.completionMetrics.executivePlanMetrics.executed} من ${model.completionMetrics.executivePlanMetrics.totalActive})`,
    },
    {
      label: 'مؤشر إنجاز إجراءات البرامج القياسية (القسم ٦)',
      value: `${model.completionMetrics.programActionsMetrics.completionPercentage}% (نفذ ${model.completionMetrics.programActionsMetrics.executed} من ${model.completionMetrics.programActionsMetrics.totalActive})`,
    },
  ]);

  ctrl.y += 6;

  // جدول ملخص البرامج الوزارية المطبقة بالمدرسة (مع التفاف تلقائي للنصوص الطويلة وارتفاع ديناميكي للصفوف)
  drawSectionBanner(
    ctrl,
    'ثانياً: ملخص تنفيذ البرامج الوزارية المطبقة بالمدرسة',
    `البرامج المطبقة: ${model.applicablePrograms.length} من ٧`,
    120
  );

  drawRoundedRect(ctrl.ctx, 56, ctrl.y, CANVAS_W - 112, 40, 8, CHARCOAL);
  ctrl.ctx.save();
  ctrl.ctx.fillStyle = '#FFFFFF';
  ctrl.ctx.font = 'bold 14px "Cairo", "Tajawal", sans-serif';
  ctrl.ctx.textAlign = 'right';
  ctrl.ctx.fillText('البرنامج الوزاري', CANVAS_W - 74, ctrl.y + 26);
  ctrl.ctx.fillText('الفئة المستهدفة', CANVAS_W - 470, ctrl.y + 26);
  ctrl.ctx.fillText('الإجراءات المنفذة', 310, ctrl.y + 26);
  ctrl.ctx.fillText('نسبة الإنجاز', 165, ctrl.y + 26);
  ctrl.ctx.restore();
  ctrl.y += 46;

  const progTitleMaxW = 375;
  const audienceMaxW = 425;
  const tableLineH = 20;

  for (const prog of model.applicablePrograms) {
    ctrl.ctx.save();
    ctrl.ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    const titleLines = wrapArabicText(ctrl.ctx, prog.title, progTitleMaxW);
    ctrl.ctx.font = '500 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    const audienceLines = wrapArabicText(
      ctrl.ctx,
      prog.targetAudience,
      audienceMaxW
    );
    ctrl.ctx.restore();

    const maxLinesInRow = Math.max(titleLines.length, audienceLines.length);
    const rowH = Math.max(44, 14 + maxLinesInRow * tableLineH + 10);

    ctrl.ensureSpace(rowH + 8);
    const { ctx, y } = ctrl;

    drawRoundedRect(
      ctx,
      56,
      y,
      CANVAS_W - 112,
      rowH,
      6,
      WARM_IVORY,
      BURGUNDY_BORDER,
      1
    );
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = CHARCOAL;
    ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    let tY = y + 25;
    for (const line of titleLines) {
      ctx.fillText(line, CANVAS_W - 74, tY);
      tY += tableLineH;
    }

    ctx.fillStyle = MUTED_TEXT;
    ctx.font = '500 13px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    let aY = y + 25;
    for (const line of audienceLines) {
      ctx.fillText(line, CANVAS_W - 470, aY);
      aY += tableLineH;
    }

    const centerMetricY = y + Math.floor(rowH / 2) + 5;
    ctx.fillStyle = CHARCOAL;
    ctx.font = 'bold 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText(
      `${prog.executedCount} / ${prog.totalCount}`,
      310,
      centerMetricY
    );
    ctx.fillStyle = BURGUNDY;
    ctx.fillText(`${prog.completionPercentage}%`, 165, centerMetricY);
    ctx.restore();

    ctrl.y = y + rowH + 6;
  }

  ctrl.y += 8;

  // ثالثاً: ملخص سجل الطلاب الموهوبين والمشاركات والتأهل
  drawSectionBanner(
    ctrl,
    'ثالثاً: إحصائية الطلبة الموهوبين والمشاركات والتأهل (القسم ٧)',
    `إجمالي الموهوبين: ${model.studentsSummary.totalStudents}`
  );

  drawKeyValueGrid2Cols(ctrl, [
    {
      label: 'إجمالي الطلبة المسجلين بقاعدة الموهوبين',
      value: `${model.studentsSummary.totalStudents} طالب/ـة (استثنائي: ${model.studentsSummary.exceptionalGiftedCount} • موهوب: ${model.studentsSummary.giftedCount} • واعد: ${model.studentsSummary.promisingCount})`,
    },
    {
      label: 'إجمالي المشاركات والتأهل والإنجازات',
      value: `المشاركات: ${model.studentsSummary.totalParticipations} • المتأهلون: ${model.studentsSummary.qualifiedStudentsCount} • الإنجازات الموثقة: ${model.studentsSummary.documentedAchievementsCount}`,
    },
    {
      label: 'مبادرات المنسق الإضافية (القسم ٣)',
      value: `${model.customInitiatives.length} مبادرة (منفذ: ${model.completionMetrics.customInitiativesMetrics.executed})`,
    },
    {
      label: 'المسابقات العلمية (القسم ٣)',
      value: `${model.scientificCompetitions.length} مسابقة (منفذ: ${model.completionMetrics.competitionsMetrics.executed})`,
    },
  ]);

  if (model.qualifiedParticipations.length > 0) {
    const topQualifiers = model.qualifiedParticipations
      .map(
        (q) =>
          `${q.studentName} (${q.studentGrade} — ${
            GIFTED_PARTICIPATION_CATEGORY_LABELS[q.category]
          }): ${q.achievementText || 'تأهل للمرحلة التالية'}`
      )
      .join('\n');
    drawLabeledParagraphBox(
      ctrl,
      'أبرز الطلبة المتأهلين والمنجزين',
      topQualifiers
    );
  }

  // --------------------------------------------------------------------------
  // الملحق التفصيلي الاختياري (عند اختيار الوضع الشامل المفصل فقط)
  // --------------------------------------------------------------------------
  if (model.mode === 'detailed') {
    // Force start of detailed breakdown on a fresh page if we are still on Page 1
    if (ctrl.y > 230) {
      ctrl.ensureSpace(MAX_CONTENT_BOTTOM_Y);
    }

    drawSectionBanner(
      ctrl,
      'تفصيل الإجراءات القياسية المنفذة في البرامج الوزارية'
    );

    for (const prog of model.applicablePrograms) {
      const summaryText =
        prog.executedActionsTexts.length > 0
          ? prog.executedActionsTexts
              .map((t, idx) => `${idx + 1}. ${t}`)
              .join('\n')
          : 'لم تسجل إجراءات منفذة بعد.';
      drawLabeledParagraphBox(
        ctrl,
        `${prog.title} (المنفذ: ${prog.executedCount}/${prog.totalCount})`,
        summaryText
      );
    }

    if (model.students.length > 0) {
      drawSectionBanner(
        ctrl,
        'كشف الطلبة المسجلين في قاعدة الموهوبين بالمدرسة'
      );
      const studentsLines = model.students
        .map(
          (s, idx) =>
            `${idx + 1}. ${s.name} — الصف: ${s.grade} — التصنيف: ${
              GIFTED_CLASSIFICATION_LABELS[s.classification]
            } — مجال الموهبة: ${s.talentDomain}`
        )
        .join('\n');
      drawLabeledParagraphBox(
        ctrl,
        `بيانات الطلبة الموهوبين (${model.students.length})`,
        studentsLines
      );
    }
  }

  // --------------------------------------------------------------------------
  // القسم الختامي: الشواهد المختارة + غير المنفذ + التقييم الختامي (4 حقول) + الاعتماد
  // --------------------------------------------------------------------------
  if (ctrl.y > 230) {
    ctrl.ensureSpace(MAX_CONTENT_BOTTOM_Y);
  }

  const allSelectedPhotos = model.selectedEvidenceGroups
    .flatMap((g) =>
      g.photos.map((p) => ({
        ...p,
        title: `${g.targetTitle} — ${p.title}`,
      }))
    )
    .slice(0, 4);

  const allSelectedLinks = model.selectedEvidenceGroups
    .flatMap((g) =>
      g.links.map((l) => ({
        ...l,
        title: `${g.targetTitle} — ${l.title}`,
      }))
    )
    .slice(0, 4);

  if (allSelectedPhotos.length > 0 || allSelectedLinks.length > 0) {
    await drawEvidencesSectionOnCanvas(
      ctrl,
      allSelectedPhotos,
      allSelectedLinks,
      repo
    );
  }

  // خامساً: البرامج والإجراءات التي حالتها «لم ينفذ» وأسبابها (تلقائياً من الأقسام السابقة)
  drawSectionBanner(
    ctrl,
    'البرامج والإجراءات غير المنفذة وأسباب عدم التنفيذ (القسم ٩)',
    `العدد: ${model.nonExecutedItems.length}`
  );

  const nonExecSummaryText =
    model.nonExecutedItems.length > 0
      ? model.nonExecutedItems
          .map(
            (item, idx) =>
              `${idx + 1}. [${item.parentTitle}] ${item.itemTitle} — السبب: ${item.nonExecutionReason}`
          )
          .join('\n')
      : 'لا توجد برامج أو إجراءات مسجلة بحالة (لم ينفذ).';

  drawLabeledParagraphBox(
    ctrl,
    'بيان العناصر غير المنفذة وأسبابها',
    nonExecSummaryText
  );

  // سادساً: حقول التقييم الختامي الأربعة المعتمدة فقط
  drawSectionBanner(ctrl, 'التقييم الختامي لأعمال الموهوبين بالمدرسة');

  drawLabeledParagraphBox(
    ctrl,
    '١. الإيجابيات ونقاط القوة',
    model.evaluation.strengths || 'لا توجد بيانات مسجلة'
  );

  drawLabeledParagraphBox(
    ctrl,
    '٢. الصعوبات والتحديات',
    model.evaluation.challenges || 'لا توجد بيانات مسجلة'
  );

  drawLabeledParagraphBox(
    ctrl,
    '٣. الجهات الداعمة إن وجدت',
    model.evaluation.supportingEntities || 'لا توجد بيانات مسجلة'
  );

  drawLabeledParagraphBox(
    ctrl,
    '٤. المقترحات التطويرية',
    model.evaluation.improvementProposals || 'لا توجد بيانات مسجلة'
  );

  drawSignoffBlock(
    ctrl,
    model.basicInfo.coordinatorTitle,
    model.basicInfo.coordinatorName,
    model.basicInfo.principalTitle,
    model.basicInfo.principalName
  );

  const renderedPages = await ctrl.finalizeToPdfPages();
  return buildMultiPageJpegPdfBytes(renderedPages);
}

/**
 * أداة مساعدة لتنزيل ملف PDF المتولد في المتصفح
 */
export function downloadGiftedPdfBytes(pdfBytes: Uint8Array, filename: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([new Uint8Array(pdfBytes)], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// ٤. المرحلة الثانية: مولدات تقارير A4 PDF للمحرك الرابع (Engine 04 — التقارير)
// - [01] تقرير برنامج (generateGiftedUnifiedProgramReportPdf)
// - [02] التقرير الدوري (generateGiftedPeriodicReportPdf)
// - [03] التقرير النهائي الشامل مع صفحة الغلاف (generateGiftedComprehensiveFinalReportPdf)
// - [04] التقرير الإحصائي البصري (generateGiftedStatisticalReportPdf)
// ============================================================================

/**
 * يحمّل شعار وزارة التعليم الرسمي المعتمد من أصول المشروع (/public/moe-logo.png)
 */
async function loadOfficialMinistryLogoImage(): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return null;
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = './moe-logo.png';
  });
}

/**
 * يرسم صفحة الغلاف الرسمية الكاملة للتقرير النهائي مع شعار وزارة التعليم المعتمد
 */
function drawOfficialFinalReportCoverPage(
  ctx: CanvasRenderingContext2D,
  model: GiftedComprehensiveFinalReportModel,
  moeLogoImg: HTMLImageElement | null
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // الإطار الخارجي المزدوج الفاخر
  drawRoundedRect(
    ctx,
    36,
    36,
    CANVAS_W - 72,
    CANVAS_H - 72,
    24,
    undefined,
    BURGUNDY,
    3
  );
  drawRoundedRect(
    ctx,
    52,
    52,
    CANVAS_W - 104,
    CANVAS_H - 104,
    18,
    undefined,
    BURGUNDY_BORDER,
    1.5
  );

  // الشريط العلوي الزخرفي
  drawRoundedRect(ctx, 84, 84, CANVAS_W - 168, 16, 8, BURGUNDY);

  const centerX = CANVAS_W / 2;

  // ١. شعار وزارة التعليم الرسمي المعتمد في الأعلى بالمنتصف (دون رسم أي شعار وهمي أو مخمن)
  if (
    moeLogoImg &&
    moeLogoImg.naturalWidth > 0 &&
    moeLogoImg.naturalHeight > 0
  ) {
    const maxLogoW = 250;
    const maxLogoH = 148;
    const scale = Math.min(
      maxLogoW / moeLogoImg.naturalWidth,
      maxLogoH / moeLogoImg.naturalHeight
    );
    const drawW = moeLogoImg.naturalWidth * scale;
    const drawH = moeLogoImg.naturalHeight * scale;
    const drawX = centerX - drawW / 2;
    const drawY = 128 + (maxLogoH - drawH) / 2;
    ctx.drawImage(moeLogoImg, drawX, drawY, drawW, drawH);
  }

  ctx.save();
  ctx.textAlign = 'center';

  // ٢. المملكة العربية السعودية — وزارة التعليم + الإدارة التعليمية + المدرسة
  ctx.fillStyle = CHARCOAL;
  fillTextAutoFit(
    ctx,
    model.coverPage.ministryHeader,
    centerX,
    318,
    CANVAS_W - 220,
    24,
    'bold',
    '"Cairo", "Tajawal", sans-serif'
  );

  ctx.fillStyle = BURGUNDY;
  fillTextAutoFit(
    ctx,
    model.coverPage.educationDepartment,
    centerX,
    365,
    CANVAS_W - 220,
    22,
    'bold',
    '"Cairo", "Tajawal", sans-serif'
  );

  ctx.fillStyle = CHARCOAL;
  fillTextAutoFit(
    ctx,
    model.coverPage.schoolName,
    centerX,
    412,
    CANVAS_W - 220,
    22,
    'bold',
    '"Cairo", "Tajawal", sans-serif'
  );

  // ٣. لوحة عنوان السجل الرئيسية في منتصف الغلاف
  drawRoundedRect(
    ctx,
    110,
    475,
    CANVAS_W - 220,
    280,
    24,
    BURGUNDY,
    CHARCOAL,
    2
  );
  drawRoundedRect(
    ctx,
    130,
    495,
    CANVAS_W - 260,
    240,
    18,
    undefined,
    '#F6D5DF',
    1.2
  );

  ctx.fillStyle = '#F6D5DF';
  ctx.font = 'bold 20px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  ctx.fillText('التقرير النهائي الشامل والمؤشرات التنفيذية', centerX, 558);

  ctx.fillStyle = '#FFFFFF';
  fillTextAutoFit(
    ctx,
    model.coverPage.recordTitle,
    centerX,
    632,
    CANVAS_W - 300,
    44,
    'bold',
    '"Cairo", "Tajawal", sans-serif',
    24
  );

  ctx.fillStyle = '#F6D5DF';
  fillTextAutoFit(
    ctx,
    `العام الدراسي: ${model.coverPage.academicYear} — ${model.coverPage.semesterLabel}`,
    centerX,
    696,
    CANVAS_W - 300,
    21,
    'bold',
    '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
    14
  );

  // ٤. بطاقة ملخص المؤشرات السريعة على الغلاف
  const statBoxY = 815;
  const statBoxW = (CANVAS_W - 260) / 4;
  const coverStats = [
    {
      label: 'الطلبة الموهوبون',
      val: String(model.studentStats.totalStudents),
    },
    {
      label: 'البرامج النشطة',
      val: String(model.programStats.totalActivePrograms),
    },
    {
      label: 'نسبة إنجاز البرامج',
      val: `${model.programStats.programCompletionPercentage}%`,
    },
    {
      label: 'نسبة إكمال الإجراءات',
      val: `${model.programStats.actionCompletionPercentage}%`,
    },
  ];

  for (let i = 0; i < coverStats.length; i++) {
    const item = coverStats[i];
    const x = CANVAS_W - 110 - (i + 1) * statBoxW - i * 13;
    drawRoundedRect(
      ctx,
      x,
      statBoxY,
      statBoxW,
      118,
      16,
      WARM_IVORY,
      BURGUNDY_BORDER,
      1.5
    );
    ctx.fillStyle = BURGUNDY;
    ctx.font = 'bold 30px "Cairo", "Tajawal", sans-serif';
    ctx.fillText(item.val, x + statBoxW / 2, statBoxY + 56);
    ctx.fillStyle = CHARCOAL;
    ctx.font = 'bold 14.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText(item.label, x + statBoxW / 2, statBoxY + 94);
  }

  // ٥. بطاقتا اسم المنسق/المنسقة ومدير/مديرة المدرسة في أسفل الغلاف
  const cardY = 1020;
  const cardW = (CANVAS_W - 244) / 2;

  // بطاقة المنسق (يمين)
  const rightCardX = CANVAS_W - 110 - cardW;
  drawRoundedRect(
    ctx,
    rightCardX,
    cardY,
    cardW,
    170,
    18,
    WARM_IVORY,
    BURGUNDY,
    1.8
  );
  ctx.fillStyle = BURGUNDY;
  ctx.font = 'bold 18px "Cairo", "Tajawal", sans-serif';
  ctx.fillText(
    `إعداد ${model.coverPage.coordinatorTitle}`,
    rightCardX + cardW / 2,
    cardY + 52
  );
  ctx.fillStyle = CHARCOAL;
  fillTextAutoFit(
    ctx,
    model.coverPage.coordinatorName,
    rightCardX + cardW / 2,
    cardY + 104,
    cardW - 40,
    22,
    'bold',
    '"Cairo", "Tajawal", sans-serif',
    14
  );
  ctx.fillStyle = MUTED_TEXT;
  ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  ctx.fillText('التوقيع', rightCardX + cardW / 2, cardY + 146);

  // بطاقة المدير (يسار)
  const leftCardX = 110;
  drawRoundedRect(
    ctx,
    leftCardX,
    cardY,
    cardW,
    170,
    18,
    WARM_IVORY,
    CHARCOAL,
    1.8
  );
  ctx.fillStyle = CHARCOAL;
  ctx.font = 'bold 18px "Cairo", "Tajawal", sans-serif';
  ctx.fillText(
    `اعتماد ${model.coverPage.principalTitle}`,
    leftCardX + cardW / 2,
    cardY + 52
  );
  ctx.fillStyle = BURGUNDY;
  fillTextAutoFit(
    ctx,
    model.coverPage.principalName,
    leftCardX + cardW / 2,
    cardY + 104,
    cardW - 40,
    22,
    'bold',
    '"Cairo", "Tajawal", sans-serif',
    14
  );
  ctx.fillStyle = MUTED_TEXT;
  ctx.font = 'bold 15px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
  ctx.fillText('التوقيع', leftCardX + cardW / 2, cardY + 146);

  ctx.restore();
}

/**
 * [01] توليد PDF «تقرير برنامج» الموحد من بيانات المحركين 01 و02
 */
export async function generateGiftedUnifiedProgramReportPdf(
  model: GiftedUnifiedProgramReportModel,
  attachmentRepo?: GiftedAttachmentRepository
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: model.selectedLinks.map((l, idx) => ({
          pageIndex: 0,
          xPx: 60,
          yPx: 1200 + idx * 50,
          wPx: 400,
          hPx: 40,
          url: l.url,
        })),
      },
    ]);
  }

  const repo = attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const ctrl = createMultiPageController({
    mainTitle: 'تقرير تنفيذ برنامج',
    subTitle: model.categoryLabel,
    schoolName: model.basicInfo.schoolName,
    educationDepartment: model.basicInfo.educationDepartment,
    academicYear: `${model.basicInfo.academicYear} — ${model.basicInfo.semesterLabel}`,
  });

  drawSectionBanner(
    ctrl,
    'أولاً: بيانات البرنامج وحالة التنفيذ ومؤشر الإجراءات',
    `الحالة: ${model.executionStatusLabel} • الإجراءات: ${model.actionCompletionPercentage}%`
  );

  drawKeyValueGrid2Cols(ctrl, [
    { label: 'اسم البرنامج', value: model.programTitle },
    { label: 'التصنيف والمرحلة', value: `${model.categoryLabel} (${model.stageLabel})` },
    { label: 'الفئة المستهدفة', value: model.targetAudience },
    { label: 'تاريخ التنفيذ', value: model.executionDate },
    { label: 'الأسبوع الدراسي', value: model.weekLabel },
    {
      label: 'حالة التنفيذ المعتمدة (بيد المنسق)',
      value: model.executionStatusLabel,
    },
    {
      label: 'نسبة إكمال الإجراءات (تلقائياً)',
      value: `${model.actionCompletionPercentage}% (${model.completedActionsCount} من ${model.totalActionsCount})`,
    },
    {
      label: 'عدد الطلاب/الطالبات المشاركين',
      value: `${model.participatingStudentsCount}`,
    },
  ]);

  drawLabeledParagraphBox(ctrl, 'الهدف من البرنامج', model.objective);

  // الأنشطة والإجراءات
  drawSectionBanner(
    ctrl,
    'ثانياً: الأنشطة والإجراءات التنفيذية',
    `المكتمل: ${model.completedActionsCount} / ${model.totalActionsCount}`
  );

  const actionsText =
    model.actionsList.length > 0
      ? model.actionsList
          .map(
            (a) =>
              `${a.order}. [${a.completed ? 'مكتمل' : 'غير مكتمل'}] ${a.actionText}`
          )
          .join('\n')
      : 'غير مسجل';

  drawLabeledParagraphBox(ctrl, 'قائمة الإجراءات وحالة إكمالها', actionsText);

  // الطلاب المشاركون
  drawSectionBanner(
    ctrl,
    'ثالثاً: الطلاب/الطالبات المشاركون والنتائج والإنجازات',
    `عدد المشاركين: ${model.participatingStudentsCount}`
  );

  const participantsText =
    model.participatingStudents.length > 0
      ? model.participatingStudents
          .map(
            (stu, idx) =>
              `${idx + 1}. ${stu.studentName} — الصف وقت المشاركة: ${stu.historicalGrade} (${stu.historicalClassificationLabel}) — النتيجة: ${stu.resultOrScore} — الإنجاز: ${stu.achievementText}${stu.qualifiedToNextStage ? ' [متأهل]' : ''}`
          )
          .join('\n')
      : 'لا توجد بيانات مسجلة';

  drawLabeledParagraphBox(ctrl, 'بيان المشاركين في البرنامج', participantsText);
  drawLabeledParagraphBox(ctrl, 'النتائج المسجلة', model.results);
  drawLabeledParagraphBox(
    ctrl,
    'الإنجازات أو المخرجات',
    model.achievementsOrOutputs
  );

  // التحديات والتوصيات والملاحظات
  drawSectionBanner(ctrl, 'رابعاً: التحديات والتوصيات والملاحظات');
  drawKeyValueGrid2Cols(ctrl, [
    { label: 'التحديات', value: model.challenges },
    { label: 'التوصيات', value: model.recommendations },
  ]);
  drawLabeledParagraphBox(ctrl, 'الملاحظات', model.notes);

  // الشواهد المختارة من الجيل النشط فقط
  if (
    model.showEvidences &&
    (model.selectedPhotos.length > 0 || model.selectedLinks.length > 0)
  ) {
    await drawEvidencesSectionOnCanvas(
      ctrl,
      model.selectedPhotos,
      model.selectedLinks,
      repo
    );
  }

  drawSignoffBlock(
    ctrl,
    model.basicInfo.coordinatorTitle,
    model.basicInfo.coordinatorName,
    model.basicInfo.principalTitle,
    model.basicInfo.principalName
  );

  const renderedPages = await ctrl.finalizeToPdfPages();
  return buildMultiPageJpegPdfBytes(renderedPages);
}

/**
 * [02] توليد PDF «التقرير الدوري»
 */
export async function generateGiftedPeriodicReportPdf(
  model: GiftedPeriodicReportModel
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: [],
      },
    ]);
  }

  const ctrl = createMultiPageController({
    mainTitle: 'التقرير الدوري لأعمال الموهوبين',
    subTitle: model.periodLabel,
    schoolName: model.basicInfo.schoolName,
    educationDepartment: model.basicInfo.educationDepartment,
    academicYear: `${model.basicInfo.academicYear} — ${model.basicInfo.semesterLabel}`,
  });

  drawSectionBanner(
    ctrl,
    'أولاً: مؤشرات الأداء والإنجاز خلال الفترة',
    model.periodLabel
  );

  drawKeyValueGrid2Cols(ctrl, [
    {
      label: 'إجمالي البرامج المشمولة في الفترة',
      value: `${model.totalProgramsCount} برامج`,
    },
    {
      label: 'حالات تنفيذ البرامج',
      value: `منفذ: ${model.executedProgramsCount} • قيد التنفيذ: ${model.pendingProgramsCount} • لم ينفذ: ${model.notExecutedProgramsCount}`,
    },
    {
      label: 'نسبة إنجاز البرامج',
      value: `${model.programCompletionPercentage}%`,
    },
    {
      label: 'نسبة إكمال الإجراءات التنفيذية',
      value: `${model.actionCompletionPercentage}% (${model.completedActionsCount} من ${model.totalActionsCount})`,
    },
    {
      label: 'عدد الطلاب/الطالبات المستفيدين',
      value: `${model.beneficiaryStudentsCount}`,
    },
    {
      label: 'عدد المشاركات والإنجازات في الفترة',
      value: `المشاركات: ${model.participationsCount} • الإنجازات والتأهلات: ${model.achievementsCount}`,
    },
  ]);

  drawSectionBanner(
    ctrl,
    'ثانياً: أبرز البرامج المنفذة والمتابعة خلال الفترة',
    `العدد: ${model.programsSummaryRows.length}`
  );
  drawLabeledParagraphBox(
    ctrl,
    'بيان البرامج وحالة تنفيذها ونسبة إجراءاتها',
    model.topProgramsText
  );

  drawSectionBanner(
    ctrl,
    `ثالثاً: أعمال ${model.basicInfo.coordinatorTitle} خلال الفترة`,
    `العدد: ${model.coordinatorWorksCount}`
  );
  drawLabeledParagraphBox(
    ctrl,
    'سجل الاجتماعات والتواصل والأعمال الإضافية',
    model.coordinatorWorksText
  );

  drawSectionBanner(ctrl, 'رابعاً: أبرز النتائج والتحديات والتوصيات');
  drawLabeledParagraphBox(ctrl, 'أبرز النتائج', model.topResultsText);
  drawLabeledParagraphBox(ctrl, 'أبرز التحديات', model.topChallengesText);
  drawLabeledParagraphBox(ctrl, 'التوصيات', model.recommendationsText);

  drawSignoffBlock(
    ctrl,
    model.basicInfo.coordinatorTitle,
    model.basicInfo.coordinatorName,
    model.basicInfo.principalTitle,
    model.basicInfo.principalName
  );

  const renderedPages = await ctrl.finalizeToPdfPages();
  return buildMultiPageJpegPdfBytes(renderedPages);
}

/**
 * [03] توليد PDF «التقرير النهائي» الشامل والمنظم (يبدأ بصفحة غلاف رسمية كاملة)
 */
export async function generateGiftedComprehensiveFinalReportPdf(
  model: GiftedComprehensiveFinalReportModel,
  attachmentRepo?: GiftedAttachmentRepository
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    const allLinks = model.selectedEvidenceGroups.flatMap((g) => g.links);
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: [],
      },
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: allLinks.map((l, idx) => ({
          pageIndex: 1,
          xPx: 60,
          yPx: 400 + idx * 40,
          wPx: 300,
          hPx: 35,
          url: l.url,
        })),
      },
    ]);
  }

  const repo = attachmentRepo ?? getDefaultGiftedAttachmentRepository();
  const moeLogoImg = await loadOfficialMinistryLogoImage();

  // ١. رسم صفحة الغلاف الرسمية كصفحة أولى مستقلة
  const coverCanvasObj = createA4Canvas();
  drawOfficialFinalReportCoverPage(coverCanvasObj.ctx, model, moeLogoImg);

  // ٢. صفحات المحتوى التالية
  const ctrl = createMultiPageController({
    mainTitle: 'التقرير النهائي الشامل',
    subTitle: model.coverPage.recordTitle,
    schoolName: model.basicInfo.schoolName,
    educationDepartment: model.basicInfo.educationDepartment,
    academicYear: `${model.basicInfo.academicYear} — ${model.basicInfo.semesterLabel}`,
  });

  drawSectionBanner(ctrl, 'أولاً: الملخص التنفيذي');
  drawLabeledParagraphBox(ctrl, 'ملخص تنفيذي للسجل', model.executiveSummaryText);

  drawSectionBanner(
    ctrl,
    'ثانياً: إحصاءات البرامج والطلاب والمشاركات والإنجازات'
  );
  drawKeyValueGrid2Cols(ctrl, [
    {
      label: 'إحصاءات البرامج النشطة',
      value: `الإجمالي: ${model.programStats.totalActivePrograms} (منفذ: ${model.programStats.executedCount} • قيد التنفيذ: ${model.programStats.pendingCount} • لم ينفذ: ${model.programStats.notExecutedCount})`,
    },
    {
      label: 'مؤشرات التنفيذ والإجراءات',
      value: `إنجاز البرامج: ${model.programStats.programCompletionPercentage}% • إكمال الإجراءات: ${model.programStats.actionCompletionPercentage}% (${model.programStats.completedActionsCount}/${model.programStats.totalActionsCount})`,
    },
    {
      label: 'إحصاءات الطلاب/الطالبات بالسجل المركزي',
      value: `الإجمالي: ${model.studentStats.totalStudents} (استثنائي: ${model.studentStats.exceptionalGiftedCount} • موهوب: ${model.studentStats.giftedCount} • واعد: ${model.studentStats.promisingCount})`,
    },
    {
      label: 'المستفيدون والمشاركات والإنجازات',
      value: `المستفيدون: ${model.studentStats.uniqueBeneficiaryStudentsCount} • المشاركات: ${model.participationsAndAchievements.totalParticipations} • التأهل والإنجازات: ${model.participationsAndAchievements.documentedAchievementsCount + model.participationsAndAchievements.qualifiedStudentsCount}`,
    },
  ]);

  drawLabeledParagraphBox(
    ctrl,
    'المشاركات والإنجازات الموثقة',
    model.participationsAndAchievements.achievementsText
  );

  drawSectionBanner(
    ctrl,
    `ثالثاً: أعمال ${model.basicInfo.coordinatorTitle}`,
    `العدد: ${model.coordinatorWorks.length}`
  );
  drawLabeledParagraphBox(
    ctrl,
    `سجل أعمال ${model.basicInfo.coordinatorTitle}`,
    model.coordinatorWorksText
  );

  drawSectionBanner(
    ctrl,
    'رابعاً: مؤشرات التنفيذ وأبرز البرامج والمبادرات',
    `البرامج: ${model.executionIndicators.length}`
  );
  drawLabeledParagraphBox(
    ctrl,
    'بيان البرامج وحالة التنفيذ ونسبة إكمال الإجراءات',
    model.keyProgramsText
  );

  drawSectionBanner(ctrl, 'خامساً: أبرز النتائج والتحديات والتوصيات');
  drawLabeledParagraphBox(ctrl, 'أبرز النتائج ونقاط القوة', model.keyResultsText);
  drawLabeledParagraphBox(ctrl, 'التحديات', model.challengesText);
  drawLabeledParagraphBox(ctrl, 'التوصيات والمقترحات', model.recommendationsText);
  drawLabeledParagraphBox(ctrl, 'الجهات الداعمة', model.supportingEntitiesText);

  if (model.includeEvidences && model.selectedEvidenceGroups.length > 0) {
    const allPhotos = model.selectedEvidenceGroups
      .flatMap((g) =>
        g.photos.map((p) => ({
          ...p,
          title: `${g.targetTitle} — ${p.title}`,
        }))
      )
      .slice(0, 4);
    const allLinks = model.selectedEvidenceGroups
      .flatMap((g) =>
        g.links.map((l) => ({
          ...l,
          title: `${g.targetTitle} — ${l.title}`,
        }))
      )
      .slice(0, 4);

    if (allPhotos.length > 0 || allLinks.length > 0) {
      await drawEvidencesSectionOnCanvas(ctrl, allPhotos, allLinks, repo);
    }
  }

  drawSectionBanner(ctrl, 'سادساً: خاتمة التقرير والاعتماد');
  drawLabeledParagraphBox(ctrl, 'خاتمة مختصرة', model.conclusionText);

  drawSignoffBlock(
    ctrl,
    model.basicInfo.coordinatorTitle,
    model.basicInfo.coordinatorName,
    model.basicInfo.principalTitle,
    model.basicInfo.principalName
  );

  const bodyPages = await ctrl.finalizeToPdfPages();

  // ترقيم صفحة الغلاف كصفحة 1 وتحديث ترقيم صفحات المتن
  const totalPagesWithCover = bodyPages.length + 1;
  drawPageFooterStrip(
    coverCanvasObj.ctx,
    model.basicInfo.schoolName,
    1,
    totalPagesWithCover
  );
  const coverJpegBytes = await canvasToJpegBytes(coverCanvasObj.canvas);

  const shiftedBodyPages: GiftedPdfRenderedPage[] = bodyPages.map((p, idx) => ({
    ...p,
    links: p.links.map((l) => ({
      ...l,
      pageIndex: idx + 1,
    })),
  }));

  return buildMultiPageJpegPdfBytes([
    {
      jpegBytes: coverJpegBytes,
      width: CANVAS_W,
      height: CANVAS_H,
      links: [],
    },
    ...shiftedBodyPages,
  ]);
}

/**
 * يرسم أشرطة بيانية أفقية واضحة ومنظمة داخل لوحة A4 للتقرير الإحصائي
 */
function drawHorizontalDistributionChartOnCanvas(
  ctrl: MultiPageCanvasController,
  chartTitle: string,
  rows: Array<{
    label: string;
    valueText: string;
    percentage: number;
    barColorHex: string;
  }>
) {
  const rowH = 42;
  const boxH = 48 + Math.max(1, rows.length) * rowH + 14;
  ctrl.ensureSpace(boxH + 10);
  const { ctx, y } = ctrl;

  drawRoundedRect(
    ctx,
    56,
    y,
    CANVAS_W - 112,
    boxH,
    12,
    '#FFFFFF',
    BURGUNDY_BORDER,
    1.2
  );
  drawRoundedRect(ctx, 56, y, CANVAS_W - 112, 36, 10, CHARCOAL);

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14.5px "Cairo", "Tajawal", sans-serif';
  ctx.fillText(chartTitle, CANVAS_W - 76, y + 24);

  if (rows.length === 0) {
    ctx.fillStyle = MUTED_TEXT;
    ctx.font = '500 14px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText('غير مسجل', CANVAS_W - 76, y + 66);
    ctx.restore();
    ctrl.y = y + boxH + 8;
    return;
  }

  const labelRightX = CANVAS_W - 76;
  const barRightX = CANVAS_W - 390;
  const barMaxW = 620;

  rows.forEach((r, idx) => {
    const rowY = y + 48 + idx * rowH;
    ctx.textAlign = 'right';
    ctx.fillStyle = CHARCOAL;
    fillTextAutoFit(
      ctx,
      r.label,
      labelRightX,
      rowY + 22,
      295,
      14,
      'bold',
      '"IBM Plex Sans Arabic", "Tajawal", sans-serif',
      11
    );

    // الخلفية الرمادية للشريط
    const trackX = barRightX - barMaxW;
    drawRoundedRect(ctx, trackX, rowY + 8, barMaxW, 18, 6, WARM_IVORY, BURGUNDY_BORDER, 1);

    // الشريط المملوء من اليمين إلى اليسار
    const safePct = Math.max(0, Math.min(100, r.percentage));
    const fillW = Math.round((safePct / 100) * barMaxW);
    if (fillW > 0) {
      drawRoundedRect(
        ctx,
        barRightX - fillW,
        rowY + 8,
        Math.max(10, fillW),
        18,
        6,
        r.barColorHex
      );
    }

    // القيمة الرقمية والنسبة في أقصى اليسار
    ctx.textAlign = 'left';
    ctx.fillStyle = BURGUNDY;
    ctx.font = 'bold 13.5px "IBM Plex Sans Arabic", "Tajawal", sans-serif';
    ctx.fillText(r.valueText, 76, rowY + 22);
  });

  ctx.restore();
  ctrl.y = y + boxH + 8;
}

/**
 * [04] توليد PDF «التقرير الإحصائي» المختصر والبصري
 */
export async function generateGiftedStatisticalReportPdf(
  model: GiftedStatisticalReportModel
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    return buildMultiPageJpegPdfBytes([
      {
        jpegBytes: MINIMAL_WHITE_JPEG,
        width: CANVAS_W,
        height: CANVAS_H,
        links: [],
      },
    ]);
  }

  const ctrl = createMultiPageController({
    mainTitle: 'التقرير الإحصائي لسجل الموهوبين',
    subTitle: 'ملخص كمي وبصري لمؤشرات الإنجاز',
    schoolName: model.basicInfo.schoolName,
    educationDepartment: model.basicInfo.educationDepartment,
    academicYear: `${model.basicInfo.academicYear} — ${model.basicInfo.semesterLabel}`,
  });

  drawSectionBanner(ctrl, 'أولاً: الملخص الإحصائي العام للسجل');

  drawKeyValueGrid2Cols(ctrl, [
    {
      label: 'إجمالي الطلاب/الطالبات بالسجل',
      value: `${model.totalStudents} (المستفيدون في البرامج: ${model.uniqueBeneficiaryStudentsCount})`,
    },
    {
      label: 'إجمالي البرامج النشطة',
      value: `${model.totalPrograms} برنامجاً`,
    },
    {
      label: 'حالات البرامج (منفذ / قيد التنفيذ / لم ينفذ)',
      value: `منفذ: ${model.executedProgramsCount} • قيد التنفيذ: ${model.pendingProgramsCount} • لم ينفذ: ${model.notExecutedProgramsCount}`,
    },
    {
      label: 'نسبة إنجاز البرامج مقابل نسبة الإجراءات',
      value: `إنجاز البرامج: ${model.programCompletionPercentage}% • إكمال الإجراءات: ${model.actionCompletionPercentage}% (${model.completedActionsCount}/${model.totalActionsCount})`,
    },
    {
      label: 'إجمالي المشاركات والتأهل والإنجازات',
      value: `المشاركات: ${model.totalParticipations} • المتأهلون: ${model.qualifiedStudentsCount} • الإنجازات: ${model.totalAchievements}`,
    },
    {
      label: `إجمالي أعمال ${model.basicInfo.coordinatorTitle}`,
      value: `${model.totalCoordinatorWorks}`,
    },
  ]);

  drawSectionBanner(ctrl, 'ثانياً: التمثيل البصري لتوزيع البرامج والطلبة');

  drawHorizontalDistributionChartOnCanvas(
    ctrl,
    '١. توزيع البرامج حسب حالة التنفيذ',
    model.distributionByStatus.map((row) => ({
      label: row.label,
      valueText: `${row.count} (${row.percentage}%)`,
      percentage: row.percentage,
      barColorHex:
        row.status === 'executed'
          ? '#15803D'
          : row.status === 'not_executed'
            ? '#B91C1C'
            : '#B45309',
    }))
  );

  drawHorizontalDistributionChartOnCanvas(
    ctrl,
    '٢. توزيع البرامج ونسبة الإنجاز حسب النوع / التصنيف',
    model.distributionByCategory.map((row) => ({
      label: row.categoryLabel,
      valueText: `منفذ ${row.executedCount}/${row.totalCount} (${row.completionPercentage}%)`,
      percentage: row.completionPercentage,
      barColorHex: BURGUNDY,
    }))
  );

  drawHorizontalDistributionChartOnCanvas(
    ctrl,
    '٣. توزيع الطلاب/الطالبات حسب تصنيف الموهبة',
    model.distributionByStudentClassification.map((row) => ({
      label: row.label,
      valueText: `${row.count} (${row.percentage}%)`,
      percentage: row.percentage,
      barColorHex: CHARCOAL,
    }))
  );

  if (model.distributionByWeek.length > 0) {
    const weeksSummary = model.distributionByWeek
      .map(
        (w) =>
          `${w.weekLabel}: البرامج (${w.programsCount}) • أعمال التنسيق (${w.coordinatorWorksCount})`
      )
      .join(' — ');
    drawLabeledParagraphBox(
      ctrl,
      'توزيع التنفيذ حسب الأسابيع الدراسية المسجلة',
      weeksSummary
    );
  }

  drawSignoffBlock(
    ctrl,
    model.basicInfo.coordinatorTitle,
    model.basicInfo.coordinatorName,
    model.basicInfo.principalTitle,
    model.basicInfo.principalName
  );

  const renderedPages = await ctrl.finalizeToPdfPages();
  return buildMultiPageJpegPdfBytes(renderedPages);
}

