import { SchoolSettings, UserGender } from '../types';
import {
  calculatePlanExecutedHours,
  createEmptyEvaluationResponses,
  deriveQuarterlyHoursReport,
  getDefaultPdAttachmentRepository,
  getPdEvaluationItems,
  getPdGenderedTerms,
  PdAcademicPeriodRecord,
  PdAttachmentRepository,
  PdProgramEvaluationRecord,
  resolvePdOfficialHeader,
} from './pdCoordinatorEngine';
import { buildMultiPagePdfFromJpegs, PageJpegData } from './reportPdfGenerator';
import { sanitizeFilenameSegment } from './zipBuilder';

// A4 Portrait at ~150 DPI (1240 x 1754) matching crisp high-res print layout
const CANVAS_W = 1240;
const CANVAS_H = 1754;
// A4 Landscape at ~150 DPI (1754 x 1240) dedicated to Form 01 (الخطة العامة)
const LAND_CANVAS_W = 1754;
const LAND_CANVAS_H = 1240;
const MARGIN_X = 64;
const MARGIN_TOP = 54;
const FOOTER_BOTTOM = CANVAS_H - 54;
const LAND_FOOTER_BOTTOM = LAND_CANVAS_H - 54;
const CONTENT_W = CANVAS_W - MARGIN_X * 2;
const LAND_CONTENT_W = LAND_CANVAS_W - MARGIN_X * 2;
const FONT_SANS = '"IBM Plex Sans Arabic", "Tajawal", sans-serif';
const FONT_DISPLAY = '"Tajawal", "IBM Plex Sans Arabic", sans-serif';

// Paper-faithful neutral & charcoal tones paired with Burgundy (#7C1D34) section accent
const INK = '#18181B';
const BORDER_DARK = '#3F3F46';
const BORDER_MED = '#A1A1AA';
const HEADER_FILL = '#E4E4E7';
const SUBHEADER_FILL = '#F4F4F5';
const ACCENT_BURGUNDY = '#7C1D34';

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

export interface PdPdfResult {
  pdfBytes: Uint8Array;
  filename: string;
  pageCount: number;
}

function makeHeadlessFallbackPdf(
  filename: string,
  pageCount = 1,
  pageWidthPt = 595.28,
  pageHeightPt = 841.89,
  pixelWidth = CANVAS_W,
  pixelHeight = CANVAS_H
): PdPdfResult {
  const pages: PageJpegData[] = Array.from(
    { length: Math.max(1, pageCount) },
    () => ({
      jpegBytes: MINIMAL_WHITE_JPEG,
      pixelWidth,
      pixelHeight,
    })
  );
  return {
    pdfBytes: buildMultiPagePdfFromJpegs(pages, pageWidthPt, pageHeightPt),
    filename,
    pageCount: pages.length,
  };
}

async function waitForFonts(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font load errors
    }
  }
}

let cachedMoeLogoImage: HTMLImageElement | null = null;

function loadImageElement(
  src: string,
  useCrossOrigin = false
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (useCrossOrigin) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Ignore decode rejection if image dimensions already exist
      }
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadMoeLogo(): Promise<HTMLImageElement | null> {
  if (
    cachedMoeLogoImage &&
    cachedMoeLogoImage.complete &&
    cachedMoeLogoImage.naturalWidth > 0
  ) {
    return cachedMoeLogoImage;
  }

  if (typeof document !== 'undefined') {
    const existingImgs = Array.from(document.querySelectorAll('img'));
    const alreadyLoaded = existingImgs.find(
      (el) =>
        el.src.includes('moe-logo') && el.complete && el.naturalWidth > 0
    );
    if (alreadyLoaded) {
      cachedMoeLogoImage = alreadyLoaded;
      return alreadyLoaded;
    }
  }

  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const candidates = Array.from(
    new Set([
      `${normalizedBase}moe-logo.png`,
      './moe-logo.png',
      '/moe-logo.png',
    ])
  );

  for (const src of candidates) {
    const img = await loadImageElement(src, false);
    if (img) {
      cachedMoeLogoImage = img;
      return img;
    }
  }

  if (typeof fetch === 'function') {
    for (const src of candidates) {
      try {
        const res = await fetch(src);
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('FileReader error'));
          reader.readAsDataURL(blob);
        });
        const img = await loadImageElement(dataUrl, false);
        if (img) {
          cachedMoeLogoImage = img;
          return img;
        }
      } catch {
        // Try next candidate
      }
    }
  }

  return null;
}

function drawVectorMinistryLogoFallback(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  widthPx = 128
) {
  ctx.save();
  const scale = widthPx / 220;
  const baseY = topY + 18 * scale;
  const cols = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  for (let r = 0; r < 3; r++) {
    for (const c of cols) {
      if (c === 0 && r < 2) continue;
      const dist = Math.abs(c);
      const dx = centerX + c * 18 * scale;
      const dy = baseY + r * 14 * scale + (4 - dist) * 5 * scale;
      const radius = Math.max(2.2, (3.2 + dist * 0.7 - r * 0.4) * scale);
      ctx.fillStyle = c >= 0 ? '#145B59' : '#153C43';
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#145B59';
  ctx.font = `700 ${Math.round(24 * scale)}px ${FONT_DISPLAY}`;
  ctx.fillText('وزارة التعليم', centerX, topY + 86 * scale);
  ctx.font = `600 ${Math.round(13 * scale)}px sans-serif`;
  ctx.fillStyle = '#153C43';
  ctx.fillText('Ministry of Education', centerX, topY + 114 * scale);
  ctx.restore();
}

async function loadAttachmentImage(
  repo: PdAttachmentRepository,
  blobKey: string
): Promise<HTMLImageElement | null> {
  try {
    const att = await repo.getAttachment(blobKey);
    if (!att || att.bytes.length === 0) return null;
    const blob = new Blob([new Uint8Array(att.bytes)], {
      type: att.mimeType || 'image/jpeg',
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

function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality = 0.92
): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const fallback = () => {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';
      const binStr = atob(base64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      resolve(bytes);
    };
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            fallback();
            return;
          }
          resolve(new Uint8Array(await blob.arrayBuffer()));
        },
        'image/jpeg',
        quality
      );
    } else {
      fallback();
    }
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const safeMax = Math.max(28, maxWidth);
  const cleaned = (text || '').trim();
  if (!cleaned) return [''];
  const paragraphs = cleaned.split(/\r?\n/);
  const result: string[] = [];

  const splitLongWord = (word: string): string[] => {
    if (ctx.measureText(word).width <= safeMax) return [word];
    const parts: string[] = [];
    let cur = '';
    for (const ch of word) {
      const cand = cur + ch;
      if (ctx.measureText(cand).width <= safeMax || cur.length === 0) {
        cur = cand;
      } else {
        parts.push(cur);
        cur = ch;
      }
    }
    if (cur) parts.push(cur);
    return parts;
  };

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean).flatMap(splitLongWord);
    if (words.length === 0) {
      result.push('');
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const cand = `${line} ${words[i]}`;
      if (ctx.measureText(cand).width <= safeMax) {
        line = cand;
      } else {
        result.push(line);
        line = words[i];
      }
    }
    result.push(line);
  }
  return result.length > 0 ? result : [''];
}

function drawCheckbox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  checked: boolean
) {
  ctx.save();
  ctx.fillStyle = checked ? ACCENT_BURGUNDY : '#FFFFFF';
  ctx.strokeStyle = checked ? ACCENT_BURGUNDY : BORDER_DARK;
  ctx.lineWidth = 1.6;
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);

  if (checked) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.22, y + size * 0.52);
    ctx.lineTo(x + size * 0.44, y + size * 0.75);
    ctx.lineTo(x + size * 0.8, y + size * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCellRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fillHex?: string,
  strokeHex = BORDER_DARK,
  lineWidth = 1.4
) {
  ctx.save();
  if (fillHex) {
    ctx.fillStyle = fillHex;
    ctx.fillRect(x, y, w, h);
  }
  if (strokeHex) {
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

function drawCenteredCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  font = `600 16px ${FONT_SANS}`,
  color = INK,
  lineH = 21
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text, w - 12);
  const totalTextH = lines.length * lineH;
  const startY = y + h / 2 - totalTextH / 2 + lineH / 2;
  lines.forEach((ln, idx) => {
    ctx.fillText(ln, x + w / 2, startY + idx * lineH);
  });
  ctx.restore();
}

function drawRightAlignedCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  font = `500 15.5px ${FONT_SANS}`,
  color = INK,
  lineH = 21,
  padX = 10
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text, w - padX * 2);
  const totalTextH = lines.length * lineH;
  const startY = y + h / 2 - totalTextH / 2 + lineH / 2;
  lines.forEach((ln, idx) => {
    ctx.fillText(ln, x + w - padX, startY + idx * lineH);
  });
  ctx.restore();
}

function drawTopRightAlignedCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  font = `500 15px ${FONT_SANS}`,
  color = INK,
  lineH = 22,
  padX = 14,
  padY = 14
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, text, w - padX * 2);
  const maxLines = Math.max(1, Math.floor((h - padY * 2) / lineH));
  lines.slice(0, maxLines).forEach((ln, idx) => {
    ctx.fillText(ln, x + w - padX, y + padY + idx * lineH);
  });
  ctx.restore();
}

function createOfficialPage(
  logoImg: HTMLImageElement | null,
  header: ReturnType<typeof resolvePdOfficialHeader>,
  isContinuation = false,
  continuationTitle = '',
  pageW = CANVAS_W,
  pageH = CANVAS_H
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; y: number } {
  const canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create PDF canvas context');
  }
  ctx.direction = 'rtl';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pageW, pageH);

  // Outer fine frame matching official form border aesthetic
  ctx.strokeStyle = BORDER_DARK;
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 36, pageW - 76, pageH - 72);

  let cursorY = MARGIN_TOP;

  if (!isContinuation) {
    // Top official header strip (3 columns matching official A4 layout)
    ctx.save();
    ctx.textBaseline = 'top';

    // Right Block: Centered stack (المملكة العربية السعودية -> وزارة التعليم -> الإدارة العامة للتعليم -> اسم المدرسة)
    const rightBlockW = 350;
    const rightCenterX = pageW - MARGIN_X - rightBlockW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `bold 17px ${FONT_SANS}`;
    ctx.fillText('المملكة العربية السعودية', rightCenterX, cursorY + 2, rightBlockW);
    ctx.font = `bold 16px ${FONT_SANS}`;
    ctx.fillText('وزارة التعليم', rightCenterX, cursorY + 26, rightBlockW);
    ctx.font = `600 14.5px ${FONT_SANS}`;
    ctx.fillText(header.educationDepartment, rightCenterX, cursorY + 50, rightBlockW);
    ctx.font = `600 14.5px ${FONT_SANS}`;
    ctx.fillText(header.schoolName, rightCenterX, cursorY + 74, rightBlockW);

    // Center Logo (Official MoE image or vector MoE emblem fallback — never text replacement)
    const logoW = logoImg?.naturalWidth || logoImg?.width || 0;
    const logoH = logoImg?.naturalHeight || logoImg?.height || 0;
    if (logoImg && logoW > 0 && logoH > 0) {
      const cropX = logoW * 0.25;
      const cropY = logoH * 0.30;
      const cropW = logoW * 0.50;
      const cropH = logoH * 0.39;
      const targetH = 98;
      const targetW = (cropW / cropH) * targetH;
      ctx.drawImage(
        logoImg,
        cropX,
        cropY,
        cropW,
        cropH,
        (pageW - targetW) / 2,
        cursorY + (102 - targetH) / 2,
        targetW,
        targetH
      );
    } else {
      drawVectorMinistryLogoFallback(ctx, pageW / 2, cursorY + 4, 136);
    }

    // Left: Unit Title ('التطوير المهني') & Academic Year
    ctx.textAlign = 'left';
    ctx.fillStyle = ACCENT_BURGUNDY;
    ctx.font = `bold 16px ${FONT_DISPLAY}`;
    ctx.fillText('التطوير المهني', MARGIN_X, cursorY + 16);
    ctx.fillStyle = INK;
    ctx.font = `600 15px ${FONT_SANS}`;
    ctx.fillText(`العام الدراسي: ${header.academicYear}`, MARGIN_X, cursorY + 48);
    ctx.restore();

    cursorY += 108;
    ctx.strokeStyle = BORDER_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, cursorY);
    ctx.lineTo(pageW - MARGIN_X, cursorY);
    ctx.stroke();
    cursorY += 18;
  } else {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    ctx.font = `bold 17px ${FONT_DISPLAY}`;
    ctx.fillText(`${continuationTitle} — تابع`, pageW - MARGIN_X, cursorY);
    ctx.textAlign = 'left';
    ctx.font = `600 15px ${FONT_SANS}`;
    ctx.fillText(header.schoolName, MARGIN_X, cursorY);
    ctx.restore();
    cursorY += 34;
    ctx.strokeStyle = BORDER_MED;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, cursorY);
    ctx.lineTo(pageW - MARGIN_X, cursorY);
    ctx.stroke();
    cursorY += 16;
  }

  return { canvas, ctx, y: cursorY };
}

function drawPageNumbersFooter(pages: HTMLCanvasElement[]) {
  const total = pages.length;
  pages.forEach((canvas, idx) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.direction = 'rtl';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#52525B';
    ctx.font = `500 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(`صفحة ${idx + 1} من ${total}`, MARGIN_X, canvas.height - 42);
    ctx.restore();
  });
}

async function finalizeCanvasesToPdf(
  canvases: HTMLCanvasElement[],
  filename: string,
  pageWidthPt = 595.28,
  pageHeightPt = 841.89
): Promise<PdPdfResult> {
  drawPageNumbersFooter(canvases);
  const pageJpegs: PageJpegData[] = [];
  for (const canvas of canvases) {
    const jpegBytes = await canvasToJpegBytes(canvas, 0.92);
    pageJpegs.push({
      jpegBytes,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    });
  }
  return {
    pdfBytes: buildMultiPagePdfFromJpegs(pageJpegs, pageWidthPt, pageHeightPt),
    filename,
    pageCount: pageJpegs.length,
  };
}

function drawAuthFooterBlock(
  ctx: CanvasRenderingContext2D,
  y: number,
  options: {
    rightTitle: string;
    rightName: string;
    leftTitle: string;
    leftName: string;
  },
  pageW = CANVAS_W
) {
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;

  const rowY = y + 6;
  const boxW = 510;
  const boxH = 110;

  // Right Signoff: Coordinator (borderless, preserving title, name & signature line)
  drawCenteredCellText(
    ctx,
    `${options.rightTitle}\n${options.rightName || '........................'}\nالتوقيع: ..................`,
    pageW - MARGIN_X - boxW,
    rowY,
    boxW,
    boxH,
    `600 15.5px ${FONT_SANS}`,
    INK,
    27
  );

  // Left Signoff: Principal (borderless, preserving title, name & signature line)
  drawCenteredCellText(
    ctx,
    `${options.leftTitle}\n${options.leftName || '........................'}\nالتوقيع: ..................`,
    MARGIN_X,
    rowY,
    boxW,
    boxH,
    `600 15.5px ${FONT_SANS}`,
    INK,
    27
  );

  ctx.restore();
}

// ============================================================================
// PDF 1: الخطة العامة للتطوير المهني للمدرسة (A4 Landscape — 11 Columns)
// ============================================================================

export async function generatePdGeneralPlanPdfBytes(
  period: PdAcademicPeriodRecord,
  settings: SchoolSettings
): Promise<PdPdfResult> {
  const filename = `الخطة_العامة_للتطوير_المهني_${sanitizeFilenameSegment(period.academicYear)}_${sanitizeFilenameSegment(period.semester)}.pdf`;
  if (typeof document === 'undefined') {
    return makeHeadlessFallbackPdf(
      filename,
      1,
      841.89,
      595.28,
      LAND_CANVAS_W,
      LAND_CANVAS_H
    );
  }
  await waitForFonts();

  const logo = await loadMoeLogo();
  const header = resolvePdOfficialHeader(period, settings);
  const titleText = `الخطة العامة للتطوير المهني للمدرسة للعام الدراسي ( ${header.academicYear} )`;

  const pages: HTMLCanvasElement[] = [];
  let page = createOfficialPage(
    logo,
    header,
    false,
    '',
    LAND_CANVAS_W,
    LAND_CANVAS_H
  );
  pages.push(page.canvas);
  let y = page.y;
  let ctx = page.ctx;

  // Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 22px ${FONT_DISPLAY}`;
  ctx.fillText(titleText, LAND_CANVAS_W / 2, y);
  ctx.restore();
  y += 38;

  // Metadata Header Table (RTL): اسم المدرسة | المرحلة الدراسية (ب م ث) | الفصل الدراسي (الأول الثاني)
  const metaH = 42;
  const colSchoolW = 680;
  const colStageW = 470;
  const colSemW = LAND_CONTENT_W - colSchoolW - colStageW;

  const schoolX = LAND_CANVAS_W - MARGIN_X - colSchoolW;
  const stageX = schoolX - colStageW;
  const semX = MARGIN_X;

  drawCellRect(ctx, schoolX, y, colSchoolW, metaH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'اسم المدرسة', schoolX, y, colSchoolW, metaH, `bold 16px ${FONT_DISPLAY}`);
  drawCellRect(ctx, schoolX, y + metaH, colSchoolW, metaH, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(ctx, header.schoolName, schoolX, y + metaH, colSchoolW, metaH, `600 16px ${FONT_SANS}`);

  drawCellRect(ctx, stageX, y, colStageW, metaH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'المرحلة الدراسية', stageX, y, colStageW, metaH, `bold 16px ${FONT_DISPLAY}`);
  drawCellRect(ctx, stageX, y + metaH, colStageW, metaH, '#FFFFFF', BORDER_DARK);
  // Checkboxes ب م ث inside stage value cell
  {
    const stages: Array<'ب' | 'م' | 'ث'> = ['ب', 'م', 'ث'];
    const segW = colStageW / 3;
    stages.forEach((st, idx) => {
      const rx = stageX + colStageW - (idx + 1) * segW;
      const checked = period.schoolStages.includes(st);
      ctx.save();
      ctx.font = `bold 16px ${FONT_SANS}`;
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(st, rx + segW - 34, y + metaH + metaH / 2);
      drawCheckbox(ctx, rx + 34, y + metaH + 11, 20, checked);
      ctx.restore();
    });
  }

  drawCellRect(ctx, semX, y, colSemW, metaH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'الفصل الدراسي', semX, y, colSemW, metaH, `bold 16px ${FONT_DISPLAY}`);
  drawCellRect(ctx, semX, y + metaH, colSemW, metaH, '#FFFFFF', BORDER_DARK);
  {
    const semOptions = ['الأول', 'الثاني'];
    const segW = colSemW / 2;
    semOptions.forEach((lbl, idx) => {
      const rx = semX + colSemW - (idx + 1) * segW;
      const checked =
        (lbl === 'الأول' && period.semester === 'الفصل الدراسي الأول') ||
        (lbl === 'الثاني' && period.semester === 'الفصل الدراسي الثاني');
      ctx.save();
      ctx.font = `bold 16px ${FONT_SANS}`;
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, rx + segW - 36, y + metaH + metaH / 2);
      drawCheckbox(ctx, rx + 34, y + metaH + 11, 20, checked);
      ctx.restore();
    });
  }

  y += metaH * 2 + 16;

  // RTL Column definitions matching Page 3 (all 11 columns cleanly widened for A4 Landscape)
  const cols = [
    { key: 'num', label: 'م', w: 48 },
    { key: 'vessel', label: 'الوعاء', w: 165 },
    { key: 'topicNum', label: '', w: 38 },
    { key: 'topic', label: 'الموضوع', w: 262 },
    { key: 'presenter', label: 'الاسم', w: 195 },
    { key: 'spec', label: 'التخصص', w: 145 },
    { key: 'date', label: 'التاريخ', w: 120 },
    { key: 'hours', label: 'عدد الساعات', w: 90 },
    { key: 'location', label: 'مقر التنفيذ', w: 155 },
    { key: 'executed', label: 'نفذ', w: 64 },
    { key: 'notExecuted', label: 'لم ينفذ', w: 74 },
    {
      key: 'reason',
      label: 'سبب عدم التنفيذ',
      w: LAND_CONTENT_W - (48 + 165 + 38 + 262 + 195 + 145 + 120 + 90 + 155 + 64 + 74),
    },
  ];

  // Compute RTL X bounds for each column
  const colPositions: Array<{ x: number; w: number; label: string; key: string }> = [];
  let rightCursor = LAND_CANVAS_W - MARGIN_X;
  for (const col of cols) {
    rightCursor -= col.w;
    colPositions.push({ ...col, x: rightCursor });
  }

  const drawPlanTableHeader = () => {
    const hdrH = 50;
    const numC = colPositions[0];
    const vesC = colPositions[1];
    const tNumC = colPositions[2];
    const tNameC = colPositions[3];

    drawCellRect(ctx, numC.x, y, numC.w, hdrH, HEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, 'م', numC.x, y, numC.w, hdrH, `bold 15.5px ${FONT_DISPLAY}`);

    drawCellRect(ctx, vesC.x, y, vesC.w, hdrH, HEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, 'الوعاء', vesC.x, y, vesC.w, hdrH, `bold 15.5px ${FONT_DISPLAY}`);

    drawCellRect(ctx, tNameC.x, y, tNumC.w + tNameC.w, hdrH, HEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, 'الموضوع', tNameC.x, y, tNumC.w + tNameC.w, hdrH, `bold 15.5px ${FONT_DISPLAY}`);

    for (let i = 4; i < colPositions.length; i++) {
      const c = colPositions[i];
      drawCellRect(ctx, c.x, y, c.w, hdrH, HEADER_FILL, BORDER_DARK);
      drawCenteredCellText(ctx, c.label, c.x, y, c.w, hdrH, `bold 15px ${FONT_DISPLAY}`, INK, 18);
    }
    y += hdrH;
  };

  drawPlanTableHeader();

  // Render vessels cleanly grouped across Landscape page breaks
  const maxContentY = LAND_FOOTER_BOTTOM - 46;

  period.generalPlan.vessels.forEach((vessel, vIdx) => {
    const rows = vessel.rows.length > 0 ? vessel.rows : [];
    let chunkStartIdx = 0;

    while (chunkStartIdx < rows.length) {
      let chunkEndIdx = chunkStartIdx;
      let chunkHeight = 0;
      const measuredRows: Array<{ rowH: number }> = [];

      while (chunkEndIdx < rows.length) {
        const r = rows[chunkEndIdx];
        ctx.save();
        ctx.font = `500 14.5px ${FONT_SANS}`;
        const lTopic = wrapText(ctx, r.topic, colPositions[3].w - 16).length;
        const lPres = wrapText(ctx, r.presenterName, colPositions[4].w - 12).length;
        const lSpec = wrapText(ctx, r.specialization, colPositions[5].w - 12).length;
        const lLoc = wrapText(ctx, r.executionLocation, colPositions[8].w - 12).length;
        const lReason = wrapText(ctx, r.notExecutedReason, colPositions[11].w - 16).length;
        ctx.restore();
        const maxLines = Math.max(1, lTopic, lPres, lSpec, lLoc, lReason);
        const rowH = Math.max(36, maxLines * 20 + 12);

        if (y + chunkHeight + rowH > maxContentY) {
          if (chunkHeight > 0) {
            break;
          }
          page = createOfficialPage(
            logo,
            header,
            true,
            titleText,
            LAND_CANVAS_W,
            LAND_CANVAS_H
          );
          pages.push(page.canvas);
          ctx = page.ctx;
          y = page.y;
          drawPlanTableHeader();
        }
        measuredRows.push({ rowH });
        chunkHeight += rowH;
        chunkEndIdx++;
      }

      // Draw merged vessel index 'م' and vessel title 'الوعاء' for this chunk
      const numC = colPositions[0];
      const vesC = colPositions[1];
      drawCellRect(ctx, numC.x, y, numC.w, chunkHeight, SUBHEADER_FILL, BORDER_DARK);
      drawCenteredCellText(ctx, String(vIdx + 1), numC.x, y, numC.w, chunkHeight, `bold 16px ${FONT_SANS}`);

      drawCellRect(ctx, vesC.x, y, vesC.w, chunkHeight, '#FFFFFF', BORDER_DARK);
      drawCenteredCellText(
        ctx,
        vessel.vesselName.trim(),
        vesC.x,
        y,
        vesC.w,
        chunkHeight,
        `bold 15px ${FONT_DISPLAY}`,
        INK,
        20
      );

      // Draw each topic row inside this chunk
      let rowY = y;
      for (let i = chunkStartIdx; i < chunkEndIdx; i++) {
        const r = rows[i];
        const { rowH } = measuredRows[i - chunkStartIdx];
        const tNumC = colPositions[2];
        const tC = colPositions[3];
        const pC = colPositions[4];
        const sC = colPositions[5];
        const dC = colPositions[6];
        const hC = colPositions[7];
        const lC = colPositions[8];
        const exC = colPositions[9];
        const nxC = colPositions[10];
        const rsC = colPositions[11];

        drawCellRect(ctx, tNumC.x, rowY, tNumC.w, rowH, SUBHEADER_FILL, BORDER_MED);
        drawCenteredCellText(ctx, String(i + 1), tNumC.x, rowY, tNumC.w, rowH, `bold 14.5px ${FONT_SANS}`);

        drawCellRect(ctx, tC.x, rowY, tC.w, rowH, '#FFFFFF', BORDER_MED);
        drawRightAlignedCellText(ctx, r.topic, tC.x, rowY, tC.w, rowH, `500 14.5px ${FONT_SANS}`, INK, 20);

        drawCellRect(ctx, pC.x, rowY, pC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(ctx, r.presenterName, pC.x, rowY, pC.w, rowH, `500 14.5px ${FONT_SANS}`, INK, 20);

        drawCellRect(ctx, sC.x, rowY, sC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(ctx, r.specialization, sC.x, rowY, sC.w, rowH, `500 14.5px ${FONT_SANS}`, INK, 20);

        drawCellRect(ctx, dC.x, rowY, dC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(ctx, r.executionDate, dC.x, rowY, dC.w, rowH, `500 14px ${FONT_SANS}`, INK, 19);

        drawCellRect(ctx, hC.x, rowY, hC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(ctx, r.hoursCount, hC.x, rowY, hC.w, rowH, `bold 14.5px ${FONT_SANS}`, INK, 19);

        drawCellRect(ctx, lC.x, rowY, lC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(ctx, r.executionLocation, lC.x, rowY, lC.w, rowH, `500 14px ${FONT_SANS}`, INK, 19);

        drawCellRect(ctx, exC.x, rowY, exC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(
          ctx,
          r.executionStatus === 'executed' ? '✓' : '',
          exC.x,
          rowY,
          exC.w,
          rowH,
          `bold 18px ${FONT_SANS}`,
          ACCENT_BURGUNDY
        );

        drawCellRect(ctx, nxC.x, rowY, nxC.w, rowH, '#FFFFFF', BORDER_MED);
        drawCenteredCellText(
          ctx,
          r.executionStatus === 'not_executed' ? '✓' : '',
          nxC.x,
          rowY,
          nxC.w,
          rowH,
          `bold 18px ${FONT_SANS}`,
          '#DC2626'
        );

        drawCellRect(ctx, rsC.x, rowY, rsC.w, rowH, '#FFFFFF', BORDER_MED);
        drawRightAlignedCellText(ctx, r.notExecutedReason, rsC.x, rowY, rsC.w, rowH, `500 14px ${FONT_SANS}`, INK, 19);

        rowY += rowH;
      }

      y += chunkHeight;
      chunkStartIdx = chunkEndIdx;

      if (chunkStartIdx < rows.length) {
        page = createOfficialPage(
          logo,
          header,
          true,
          titleText,
          LAND_CANVAS_W,
          LAND_CANVAS_H
        );
        pages.push(page.canvas);
        ctx = page.ctx;
        y = page.y;
        drawPlanTableHeader();
      }
    }
  });

  // Total Executed Hours Footer Row + Auth Signoff Block
  const totRowH = 44;
  if (y + totRowH + 18 + 125 > LAND_FOOTER_BOTTOM) {
    page = createOfficialPage(
      logo,
      header,
      true,
      titleText,
      LAND_CANVAS_W,
      LAND_CANVAS_H
    );
    pages.push(page.canvas);
    ctx = page.ctx;
    y = page.y;
  }

  const executedTotal = calculatePlanExecutedHours(period.generalPlan);
  const hoursCol = colPositions[7];
  const rightSpanW = LAND_CANVAS_W - MARGIN_X - (hoursCol.x + hoursCol.w);
  const leftSpanW = hoursCol.x - MARGIN_X;

  drawCellRect(ctx, hoursCol.x + hoursCol.w, y, rightSpanW, totRowH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(
    ctx,
    'مجموع الساعات المنفذة',
    hoursCol.x + hoursCol.w,
    y,
    rightSpanW,
    totRowH,
    `bold 16.5px ${FONT_DISPLAY}`
  );
  drawCellRect(ctx, hoursCol.x, y, hoursCol.w, totRowH, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(
    ctx,
    String(executedTotal),
    hoursCol.x,
    y,
    hoursCol.w,
    totRowH,
    `bold 17px ${FONT_SANS}`,
    ACCENT_BURGUNDY
  );
  drawCellRect(ctx, MARGIN_X, y, leftSpanW, totRowH, SUBHEADER_FILL, BORDER_DARK);
  y += totRowH + 18;

  drawAuthFooterBlock(
    ctx,
    Math.max(y, LAND_FOOTER_BOTTOM - 130),
    {
      rightTitle: header.coordinatorTitle,
      rightName: period.generalPlan.coordinatorAuthName || header.coordinatorName,
      leftTitle: header.principalTitle,
      leftName: period.generalPlan.principalAuthName || header.principalName,
    },
    LAND_CANVAS_W
  );

  return finalizeCanvasesToPdf(pages, filename, 841.89, 595.28);
}

// ============================================================================
// PDF 2: تقرير تنفيذ برنامج تطوير مهني (Page 4 Literal Match + Evidence Pages)
// ============================================================================

export async function generatePdExecutionReportPdfBytes(
  period: PdAcademicPeriodRecord,
  settings: SchoolSettings,
  attachmentRepo?: PdAttachmentRepository
): Promise<PdPdfResult> {
  const filename = `تقرير_تنفيذ_برنامج_تطوير_مهني_${sanitizeFilenameSegment(period.academicYear)}_${sanitizeFilenameSegment(period.semester)}.pdf`;
  if (typeof document === 'undefined') {
    return makeHeadlessFallbackPdf(filename, 1);
  }
  await waitForFonts();

  const repo = attachmentRepo ?? getDefaultPdAttachmentRepository();
  const logo = await loadMoeLogo();
  const header = resolvePdOfficialHeader(period, settings);
  const pdTerms = getPdGenderedTerms(settings.gender);
  const er = period.executionReport;

  const pages: HTMLCanvasElement[] = [];
  let page = createOfficialPage(logo, header, false);
  pages.push(page.canvas);
  let y = page.y;
  let ctx = page.ctx;

  // Title & Subtitle matching Page 4
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 23px ${FONT_DISPLAY}`;
  ctx.fillText('تقرير تنفيذ برنامج تطوير مهني', CANVAS_W / 2, y);
  ctx.font = `600 17.5px ${FONT_DISPLAY}`;
  ctx.fillText(
    `(ضمن مشروع توطين التطوير المهني بالمدارس للعام ${header.academicYear})`,
    CANVAS_W / 2,
    y + 34
  );
  ctx.restore();
  y += 74;

  // Section 1: أولاً- بيانات المدرسة
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 18px ${FONT_DISPLAY}`;
  ctx.fillText('أولاً- بيانات المدرسة:', CANVAS_W - MARGIN_X, y);
  ctx.restore();
  y += 30;

  const lblW = 210;
  const valRightW = 270;
  const lblLeftW = 300;
  const valLeftW = CONTENT_W - lblW - valRightW - lblLeftW;
  const sRowH = 44;

  const stageValue =
    er.stageLabel.trim() ||
    (period.schoolStages.length > 0 ? period.schoolStages.join(' / ') : '—');

  // Row 1
  drawCellRect(ctx, CANVAS_W - MARGIN_X - lblW, y, lblW, sRowH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'اسم المدرسة', CANVAS_W - MARGIN_X - lblW, y, lblW, sRowH, `bold 15px ${FONT_DISPLAY}`);
  drawCellRect(ctx, CANVAS_W - MARGIN_X - lblW - valRightW, y, valRightW, sRowH, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(ctx, header.schoolName, CANVAS_W - MARGIN_X - lblW - valRightW, y, valRightW, sRowH, `600 15px ${FONT_SANS}`);

  drawCellRect(ctx, MARGIN_X + valLeftW, y, lblLeftW, sRowH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'المرحلة', MARGIN_X + valLeftW, y, lblLeftW, sRowH, `bold 15px ${FONT_DISPLAY}`);
  drawCellRect(ctx, MARGIN_X, y, valLeftW, sRowH, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(ctx, stageValue, MARGIN_X, y, valLeftW, sRowH, `600 15px ${FONT_SANS}`);
  y += sRowH;

  // Row 2
  const sRow2H = 54;
  drawCellRect(ctx, CANVAS_W - MARGIN_X - lblW, y, lblW, sRow2H, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, pdTerms.teachersCountLabel, CANVAS_W - MARGIN_X - lblW, y, lblW, sRow2H, `bold 15px ${FONT_DISPLAY}`);
  drawCellRect(ctx, CANVAS_W - MARGIN_X - lblW - valRightW, y, valRightW, sRow2H, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(ctx, er.totalTeachersCount || '—', CANVAS_W - MARGIN_X - lblW - valRightW, y, valRightW, sRow2H, `bold 16px ${FONT_SANS}`);

  drawCellRect(ctx, MARGIN_X + valLeftW, y, lblLeftW, sRow2H, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(
    ctx,
    pdTerms.participatingTeachersCountLabel,
    MARGIN_X + valLeftW,
    y,
    lblLeftW,
    sRow2H,
    `bold 14px ${FONT_DISPLAY}`,
    INK,
    18
  );
  drawCellRect(ctx, MARGIN_X, y, valLeftW, sRow2H, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(ctx, er.participatingTeachersCount || '—', MARGIN_X, y, valLeftW, sRow2H, `bold 16px ${FONT_SANS}`);
  y += sRow2H + 22;

  // Section 2: ثانياً- بيانات المدربين / المدربات
  const ensureSectionSpace = (minH: number) => {
    if (y + minH > FOOTER_BOTTOM - 50) {
      page = createOfficialPage(
        logo,
        header,
        true,
        'تقرير تنفيذ برنامج تطوير مهني'
      );
      pages.push(page.canvas);
      ctx = page.ctx;
      y = page.y;
    }
  };

  ensureSectionSpace(140);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 18px ${FONT_DISPLAY}`;
  ctx.fillText(pdTerms.trainersSectionHeading, CANVAS_W - MARGIN_X, y);
  ctx.restore();
  y += 30;

  const tCols = [
    { key: 'm', label: 'م', w: 54 },
    { key: 'name', label: pdTerms.trainerNameLabel, w: 360 },
    { key: 'nid', label: 'السجل المدني', w: 230 },
    { key: 'mobile', label: 'رقم الجوال', w: 210 },
    { key: 'qual', label: 'المؤهل الدراسي', w: CONTENT_W - (54 + 360 + 230 + 210) },
  ];
  const tPos: Array<{ x: number; w: number; label: string; key: string }> = [];
  {
    let rc = CANVAS_W - MARGIN_X;
    for (const c of tCols) {
      rc -= c.w;
      tPos.push({ ...c, x: rc });
    }
  }

  const drawTrainersHeader = () => {
    const h = 42;
    tPos.forEach((c) => {
      drawCellRect(ctx, c.x, y, c.w, h, HEADER_FILL, BORDER_DARK);
      drawCenteredCellText(ctx, c.label, c.x, y, c.w, h, `bold 15px ${FONT_DISPLAY}`);
    });
    y += h;
  };
  drawTrainersHeader();

  er.trainers.forEach((tr, idx) => {
    const rowH = 38;
    if (y + rowH > FOOTER_BOTTOM - 60) {
      page = createOfficialPage(
        logo,
        header,
        true,
        `تقرير تنفيذ برنامج تطوير مهني — ${pdTerms.trainersSectionHeading.replace(':', '')}`
      );
      pages.push(page.canvas);
      ctx = page.ctx;
      y = page.y;
      drawTrainersHeader();
    }
    const vals = [String(idx + 1), tr.name, tr.nationalId, tr.mobile, tr.qualification];
    tPos.forEach((c, cIdx) => {
      drawCellRect(ctx, c.x, y, c.w, rowH, cIdx === 0 ? SUBHEADER_FILL : '#FFFFFF', BORDER_DARK);
      if (cIdx === 1) {
        drawRightAlignedCellText(ctx, vals[cIdx], c.x, y, c.w, rowH, `500 14.5px ${FONT_SANS}`);
      } else {
        drawCenteredCellText(ctx, vals[cIdx], c.x, y, c.w, rowH, `600 14.5px ${FONT_SANS}`);
      }
    });
    y += rowH;
  });

  y += 24;

  // Section 3: ثالثاً- بيانات البرامج المنفذة
  ensureSectionSpace(140);
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 18px ${FONT_DISPLAY}`;
  ctx.fillText('ثالثاً- بيانات البرامج المنفذة:', CANVAS_W - MARGIN_X, y);
  ctx.restore();
  y += 30;

  const pCols = [
    { key: 'm', label: 'م', w: 54 },
    { key: 'prog', label: 'اسم البرنامج', w: 340 },
    { key: 'days', label: 'عدد الأيام', w: 120 },
    { key: 'hrs', label: 'عدد الساعات', w: 130 },
    { key: 'trCount', label: pdTerms.traineesCountLabel, w: 170 },
    { key: 'trainer', label: pdTerms.trainerExecutorLabel, w: CONTENT_W - (54 + 340 + 120 + 130 + 170) },
  ];
  const pPos: Array<{ x: number; w: number; label: string; key: string }> = [];
  {
    let rc = CANVAS_W - MARGIN_X;
    for (const c of pCols) {
      rc -= c.w;
      pPos.push({ ...c, x: rc });
    }
  }

  const drawProgramsHeader = () => {
    const h = 42;
    pPos.forEach((c) => {
      drawCellRect(ctx, c.x, y, c.w, h, HEADER_FILL, BORDER_DARK);
      drawCenteredCellText(ctx, c.label, c.x, y, c.w, h, `bold 14.5px ${FONT_DISPLAY}`);
    });
    y += h;
  };
  drawProgramsHeader();

  er.programs.forEach((prog, idx) => {
    ctx.save();
    ctx.font = `500 14.5px ${FONT_SANS}`;
    const pLines = wrapText(ctx, prog.programName, pPos[1].w - 16).length;
    const tLines = wrapText(ctx, prog.trainerName, pPos[5].w - 16).length;
    ctx.restore();
    const rowH = Math.max(38, Math.max(pLines, tLines) * 20 + 14);

    if (y + rowH > FOOTER_BOTTOM - 60) {
      page = createOfficialPage(logo, header, true, 'تقرير تنفيذ برنامج تطوير مهني — بيانات البرامج المنفذة');
      pages.push(page.canvas);
      ctx = page.ctx;
      y = page.y;
      drawProgramsHeader();
    }

    const benCountDisplay =
      prog.traineesCount.trim() ||
      (prog.beneficiaries.length > 0 ? String(prog.beneficiaries.length) : '');
    const vals = [
      String(idx + 1),
      prog.programName,
      prog.daysCount,
      prog.hoursCount,
      benCountDisplay,
      prog.trainerName,
    ];
    pPos.forEach((c, cIdx) => {
      drawCellRect(ctx, c.x, y, c.w, rowH, cIdx === 0 ? SUBHEADER_FILL : '#FFFFFF', BORDER_DARK);
      if (cIdx === 1) {
        drawRightAlignedCellText(ctx, vals[cIdx], c.x, y, c.w, rowH, `500 14.5px ${FONT_SANS}`);
      } else {
        drawCenteredCellText(ctx, vals[cIdx], c.x, y, c.w, rowH, `600 14.5px ${FONT_SANS}`);
      }
    });
    y += rowH;
  });

  y += 28;
  if (y + 140 > FOOTER_BOTTOM) {
    page = createOfficialPage(logo, header, true, 'تقرير تنفيذ برنامج تطوير مهني — التوقيع');
    pages.push(page.canvas);
    ctx = page.ctx;
    y = page.y;
  }

  drawAuthFooterBlock(ctx, Math.max(y, FOOTER_BOTTOM - 135), {
    rightTitle: header.coordinatorTitle,
    rightName: er.coordinatorAuthName || header.coordinatorName,
    leftTitle: header.principalTitle,
    leftName: er.principalAuthName || header.principalName,
  });

  // Appendix Evidence Pages when photos exist
  const allPhotos: Array<{ progTitle: string; title: string; blobKey: string }> = [];
  for (const prog of er.programs) {
    for (const ph of prog.evidencePhotos) {
      allPhotos.push({
        progTitle: prog.programName || 'برنامج تطوير مهني',
        title: ph.title,
        blobKey: ph.blobKey,
      });
    }
  }

  if (allPhotos.length > 0) {
    for (let i = 0; i < allPhotos.length; i += 4) {
      const batch = allPhotos.slice(i, i + 4);
      const evPage = createOfficialPage(
        logo,
        header,
        true,
        'ملحق الصور وشواهد التنفيذ — تقرير تنفيذ برنامج تطوير مهني'
      );
      pages.push(evPage.canvas);
      const eCtx = evPage.ctx;
      const startY = evPage.y + 10;
      const cardGap = 24;
      const cardW = (CONTENT_W - cardGap) / 2;
      const cardH = 660;

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const colIdx = j % 2;
        const rowIdx = Math.floor(j / 2);
        const cx =
          colIdx === 0 ? CANVAS_W - MARGIN_X - cardW : MARGIN_X;
        const cy = startY + rowIdx * (cardH + cardGap);

        drawCellRect(eCtx, cx, cy, cardW, cardH, '#FFFFFF', BORDER_DARK, 1.5);
        drawCellRect(eCtx, cx, cy, cardW, 56, HEADER_FILL, BORDER_DARK, 1.5);
        drawCenteredCellText(
          eCtx,
          `${item.progTitle} — ${item.title}`,
          cx,
          cy,
          cardW,
          56,
          `bold 15px ${FONT_DISPLAY}`
        );

        const loaded = await loadAttachmentImage(repo, item.blobKey);
        const boxPad = 14;
        const innerW = cardW - boxPad * 2;
        const innerH = cardH - 56 - boxPad * 2;
        if (loaded && loaded.width > 0 && loaded.height > 0) {
          const scale = Math.min(innerW / loaded.width, innerH / loaded.height);
          const dw = loaded.width * scale;
          const dh = loaded.height * scale;
          eCtx.drawImage(
            loaded,
            cx + boxPad + (innerW - dw) / 2,
            cy + 56 + boxPad + (innerH - dh) / 2,
            dw,
            dh
          );
        } else {
          drawCenteredCellText(
            eCtx,
            'صورة شاهد تنفيذ محفوظة',
            cx + boxPad,
            cy + 56 + boxPad,
            innerW,
            innerH,
            `600 15px ${FONT_SANS}`,
            '#52525B'
          );
        }
      }
    }
  }

  return finalizeCanvasesToPdf(pages, filename);
}

// ============================================================================
// PDF 3: نموذج تقييم برنامج تطوير مهني (Page 5 LITERAL MATCH — Zero Extra Stats)
// ============================================================================

function drawSingleEvaluationPageOnCanvas(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  evaluation: PdProgramEvaluationRecord,
  gender?: UserGender
) {
  let y = yStart;
  const pdTerms = getPdGenderedTerms(gender);
  const evalItems = getPdEvaluationItems(gender);

  // Title matching Page 5
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 23px ${FONT_DISPLAY}`;
  ctx.fillText('نموذج تقييم برنامج تطوير مهني', CANVAS_W / 2, y);
  ctx.restore();
  y += 40;

  // Header 6-cell grid (3 rows x 2 label/value pairs in RTL)
  const lblW = 160;
  const valW = (CONTENT_W - lblW * 2) / 2;
  const hdrRowH = 42;

  const metaRows: Array<[string, string, string, string]> = [
    ['اسم البرنامج', evaluation.programName, pdTerms.targetAudienceLabel, evaluation.targetAudience],
    [pdTerms.targetCountLabel, evaluation.targetCount, 'تاريخ التنفيذ', evaluation.executionDate],
    ['مكان التنفيذ', evaluation.executionLocation, pdTerms.trainerNameLabel, evaluation.trainerName],
  ];

  metaRows.forEach(([rLbl, rVal, lLbl, lVal]) => {
    const rLblX = CANVAS_W - MARGIN_X - lblW;
    const rValX = rLblX - valW;
    const lLblX = rValX - lblW;
    const lValX = MARGIN_X;

    drawCellRect(ctx, rLblX, y, lblW, hdrRowH, HEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, rLbl, rLblX, y, lblW, hdrRowH, `bold 15px ${FONT_DISPLAY}`);
    drawCellRect(ctx, rValX, y, valW, hdrRowH, '#FFFFFF', BORDER_DARK);
    drawCenteredCellText(ctx, rVal, rValX, y, valW, hdrRowH, `600 15px ${FONT_SANS}`);

    drawCellRect(ctx, lLblX, y, lblW, hdrRowH, HEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, lLbl, lLblX, y, lblW, hdrRowH, `bold 15px ${FONT_DISPLAY}`);
    drawCellRect(ctx, lValX, y, valW, hdrRowH, '#FFFFFF', BORDER_DARK);
    drawCenteredCellText(ctx, lVal, lValX, y, valW, hdrRowH, `600 15px ${FONT_SANS}`);
    y += hdrRowH;
  });

  y += 22;

  // 15-Item Evaluation Matrix (2-row header matching Page 5)
  const wM = 48;
  const wItem = 365;
  const wOpt = 82; // عالية, متوسطة, منخفضة, لا أوافق (each 82)
  const wReason = CONTENT_W - (wM + wItem + wOpt * 4);

  const xM = CANVAS_W - MARGIN_X - wM;
  const xItem = xM - wItem;
  const xHigh = xItem - wOpt;
  const xMed = xHigh - wOpt;
  const xLow = xMed - wOpt;
  const xDisagree = xLow - wOpt;
  const xReason = MARGIN_X;

  const hTop = 34;
  const hSub = 34;
  const hHdr = hTop + hSub;

  drawCellRect(ctx, xM, y, wM, hHdr, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'م', xM, y, wM, hHdr, `bold 15.5px ${FONT_DISPLAY}`);

  drawCellRect(ctx, xItem, y, wItem, hHdr, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'العنصر', xItem, y, wItem, hHdr, `bold 16px ${FONT_DISPLAY}`);

  drawCellRect(ctx, xLow, y, wOpt * 3, hTop, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'أوافق بدرجة', xLow, y, wOpt * 3, hTop, `bold 15px ${FONT_DISPLAY}`);

  drawCellRect(ctx, xHigh, y + hTop, wOpt, hSub, SUBHEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'عالية', xHigh, y + hTop, wOpt, hSub, `bold 14px ${FONT_DISPLAY}`);
  drawCellRect(ctx, xMed, y + hTop, wOpt, hSub, SUBHEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'متوسطة', xMed, y + hTop, wOpt, hSub, `bold 14px ${FONT_DISPLAY}`);
  drawCellRect(ctx, xLow, y + hTop, wOpt, hSub, SUBHEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'منخفضة', xLow, y + hTop, wOpt, hSub, `bold 14px ${FONT_DISPLAY}`);

  drawCellRect(ctx, xDisagree, y, wOpt, hHdr, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'لا أوافق', xDisagree, y, wOpt, hHdr, `bold 15px ${FONT_DISPLAY}`);

  drawCellRect(ctx, xReason, y, wReason, hHdr, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'سبب اختيار عدم الموافقة', xReason, y, wReason, hHdr, `bold 15px ${FONT_DISPLAY}`);

  y += hHdr;

  const responseMap = new Map(evaluation.responses.map((r) => [r.itemId, r]));

  evalItems.forEach((item) => {
    const ans = responseMap.get(item.id);
    const reasonText = ans?.disagreeReason || '';
    ctx.save();
    ctx.font = `600 14.5px ${FONT_SANS}`;
    const itemLines = wrapText(ctx, item.label, wItem - 14).length;
    ctx.font = `500 13px ${FONT_SANS}`;
    const reasonLines = wrapText(ctx, reasonText, wReason - 12).length;
    ctx.restore();
    const rowH = Math.max(44, Math.max(itemLines, reasonLines) * 20 + 12);

    drawCellRect(ctx, xM, y, wM, rowH, SUBHEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, String(item.index), xM, y, wM, rowH, `bold 15px ${FONT_SANS}`);

    drawCellRect(ctx, xItem, y, wItem, rowH, '#FFFFFF', BORDER_DARK);
    drawRightAlignedCellText(ctx, item.label, xItem, y, wItem, rowH, `600 14.5px ${FONT_SANS}`, INK, 19);

    drawCellRect(ctx, xHigh, y, wOpt, rowH, '#FFFFFF', BORDER_DARK);
    if (ans?.rating === 'high') {
      drawCenteredCellText(ctx, '✓', xHigh, y, wOpt, rowH, `bold 20px ${FONT_SANS}`, ACCENT_BURGUNDY);
    }
    drawCellRect(ctx, xMed, y, wOpt, rowH, '#FFFFFF', BORDER_DARK);
    if (ans?.rating === 'medium') {
      drawCenteredCellText(ctx, '✓', xMed, y, wOpt, rowH, `bold 20px ${FONT_SANS}`, ACCENT_BURGUNDY);
    }
    drawCellRect(ctx, xLow, y, wOpt, rowH, '#FFFFFF', BORDER_DARK);
    if (ans?.rating === 'low') {
      drawCenteredCellText(ctx, '✓', xLow, y, wOpt, rowH, `bold 20px ${FONT_SANS}`, ACCENT_BURGUNDY);
    }
    drawCellRect(ctx, xDisagree, y, wOpt, rowH, '#FFFFFF', BORDER_DARK);
    if (ans?.rating === 'disagree') {
      drawCenteredCellText(ctx, '✓', xDisagree, y, wOpt, rowH, `bold 20px ${FONT_SANS}`, '#DC2626');
    }

    drawCellRect(ctx, xReason, y, wReason, rowH, '#FFFFFF', BORDER_DARK);
    drawRightAlignedCellText(ctx, reasonText, xReason, y, wReason, rowH, `500 13px ${FONT_SANS}`, INK, 18);

    y += rowH;
  });

  y += 20;

  // Footer: Enlarged أبرز الإيجابيات & أبرز التحديات boxes fitting comfortably on 1 A4 page
  const footerLblW = 190;
  const footerValW = CONTENT_W - footerLblW;
  const availableH = Math.max(160, FOOTER_BOTTOM - 26 - y);
  const perBoxMax = Math.floor((availableH - 12) / 2);

  ctx.save();
  ctx.font = `500 15px ${FONT_SANS}`;
  const posLines = wrapText(ctx, evaluation.positives, footerValW - 28).length;
  const chalLines = wrapText(ctx, evaluation.challenges, footerValW - 28).length;
  ctx.restore();

  const desiredPosH = Math.max(125, posLines * 22 + 30);
  const desiredChalH = Math.max(125, chalLines * 22 + 30);
  const posH = Math.min(perBoxMax, Math.min(200, desiredPosH));
  const chalH = Math.min(perBoxMax, Math.min(200, desiredChalH));

  drawCellRect(ctx, CANVAS_W - MARGIN_X - footerLblW, y, footerLblW, posH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'أبرز الإيجابيات', CANVAS_W - MARGIN_X - footerLblW, y, footerLblW, posH, `bold 16px ${FONT_DISPLAY}`);
  drawCellRect(ctx, MARGIN_X, y, footerValW, posH, '#FFFFFF', BORDER_DARK);
  drawTopRightAlignedCellText(ctx, evaluation.positives, MARGIN_X, y, footerValW, posH, `500 15px ${FONT_SANS}`, INK, 22, 14, 14);
  y += posH + 10;

  drawCellRect(ctx, CANVAS_W - MARGIN_X - footerLblW, y, footerLblW, chalH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(ctx, 'أبرز التحديات', CANVAS_W - MARGIN_X - footerLblW, y, footerLblW, chalH, `bold 16px ${FONT_DISPLAY}`);
  drawCellRect(ctx, MARGIN_X, y, footerValW, chalH, '#FFFFFF', BORDER_DARK);
  drawTopRightAlignedCellText(ctx, evaluation.challenges, MARGIN_X, y, footerValW, chalH, `500 15px ${FONT_SANS}`, INK, 22, 14, 14);
}

export async function generatePdEvaluationPdfBytes(
  evaluations: PdProgramEvaluationRecord[],
  period: PdAcademicPeriodRecord,
  settings: SchoolSettings,
  blankPrintable = false
): Promise<PdPdfResult> {
  const filename = blankPrintable
    ? `نموذج_تقييم_برنامج_تطوير_مهني_فارغ_${sanitizeFilenameSegment(period.academicYear)}.pdf`
    : `نموذج_تقييم_برنامج_تطوير_مهني_${sanitizeFilenameSegment(period.academicYear)}.pdf`;

  const list: PdProgramEvaluationRecord[] =
    blankPrintable || evaluations.length === 0
      ? [
          {
            id: 'blank',
            programName: evaluations[0]?.programName || '',
            targetAudience: evaluations[0]?.targetAudience || '',
            targetCount: evaluations[0]?.targetCount || '',
            executionDate: evaluations[0]?.executionDate || '',
            executionLocation: evaluations[0]?.executionLocation || '',
            trainerName: evaluations[0]?.trainerName || '',
            traineeLabel: '',
            responses: createEmptyEvaluationResponses(),
            positives: '',
            challenges: '',
            createdAt: '',
            updatedAt: '',
          },
        ]
      : evaluations;

  if (typeof document === 'undefined') {
    return makeHeadlessFallbackPdf(filename, list.length);
  }
  await waitForFonts();

  const logo = await loadMoeLogo();
  const header = resolvePdOfficialHeader(period, settings);

  const pages: HTMLCanvasElement[] = list.map((evalRec) => {
    const page = createOfficialPage(logo, header, false);
    drawSingleEvaluationPageOnCanvas(page.ctx, page.y, evalRec, settings.gender);
    return page.canvas;
  });

  return finalizeCanvasesToPdf(pages, filename);
}

// ============================================================================
// PDF 4: التقرير الفصلي بعدد ساعات التطوير المهني (Page 6 Literal Match)
// ============================================================================

export async function generatePdQuarterlyHoursReportPdfBytes(
  period: PdAcademicPeriodRecord,
  settings: SchoolSettings
): Promise<PdPdfResult> {
  const filename = `التقرير_الفصلي_لساعات_التطوير_المهني_${sanitizeFilenameSegment(period.academicYear)}_${sanitizeFilenameSegment(period.semester)}.pdf`;
  const pdTerms = getPdGenderedTerms(settings.gender);
  const derived = deriveQuarterlyHoursReport(period, settings.gender);
  const estPages = derived.beneficiaryRows.length > 15 ? 2 : 1;

  if (typeof document === 'undefined') {
    return makeHeadlessFallbackPdf(filename, estPages);
  }
  await waitForFonts();

  const logo = await loadMoeLogo();
  const header = resolvePdOfficialHeader(period, settings);
  const titleText = `تقرير فصلي بعدد ساعات التطوير المهني المتحقق ${pdTerms.schoolStaffDative} خلال العام الدراسي ( ${header.academicYear} )`;

  const pages: HTMLCanvasElement[] = [];
  let page = createOfficialPage(logo, header, false);
  pages.push(page.canvas);
  let ctx = page.ctx;
  let y = page.y;

  // Title (can wrap cleanly across 2 centered lines like Page 6)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 20.5px ${FONT_DISPLAY}`;
  const titleLines = wrapText(ctx, titleText, CONTENT_W - 20);
  titleLines.forEach((ln, idx) => {
    ctx.fillText(ln, CANVAS_W / 2, y + idx * 30);
  });
  ctx.restore();
  y += titleLines.length * 30 + 16;

  // Header strip: اسم المدرسة | المرحلة [ب] [م] [ث] | الفصل الدراسي [الأول] [الثاني]
  const barH = 42;
  const wSchoolLbl = 120;
  const wSchoolVal = 260;
  const wStageLbl = 85;
  const wStageChecks = 200;
  const wSemLbl = 130;
  const wSemChecks = CONTENT_W - (wSchoolLbl + wSchoolVal + wStageLbl + wStageChecks + wSemLbl);

  let rc = CANVAS_W - MARGIN_X;
  const drawStripBlock = (w: number, fill: string) => {
    rc -= w;
    drawCellRect(ctx, rc, y, w, barH, fill, BORDER_DARK);
    return rc;
  };

  const xSLbl = drawStripBlock(wSchoolLbl, HEADER_FILL);
  drawCenteredCellText(ctx, 'اسم المدرسة', xSLbl, y, wSchoolLbl, barH, `bold 14.5px ${FONT_DISPLAY}`);
  const xSVal = drawStripBlock(wSchoolVal, '#FFFFFF');
  drawCenteredCellText(ctx, header.schoolName, xSVal, y, wSchoolVal, barH, `600 14.5px ${FONT_SANS}`);

  const xStLbl = drawStripBlock(wStageLbl, HEADER_FILL);
  drawCenteredCellText(ctx, 'المرحلة', xStLbl, y, wStageLbl, barH, `bold 14.5px ${FONT_DISPLAY}`);
  const xStChecks = drawStripBlock(wStageChecks, '#FFFFFF');
  (['ب', 'م', 'ث'] as const).forEach((st, idx) => {
    const segW = wStageChecks / 3;
    const rx = xStChecks + wStageChecks - (idx + 1) * segW;
    ctx.save();
    ctx.font = `bold 15px ${FONT_SANS}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(st, rx + segW - 10, y + barH / 2);
    drawCheckbox(ctx, rx + 10, y + 11, 18, period.schoolStages.includes(st));
    ctx.restore();
  });

  const xSemLbl = drawStripBlock(wSemLbl, HEADER_FILL);
  drawCenteredCellText(ctx, 'الفصل الدراسي', xSemLbl, y, wSemLbl, barH, `bold 14px ${FONT_DISPLAY}`);
  const xSemChecks = drawStripBlock(wSemChecks, '#FFFFFF');
  (['الأول', 'الثاني'] as const).forEach((lbl, idx) => {
    const segW = wSemChecks / 2;
    const rx = xSemChecks + wSemChecks - (idx + 1) * segW;
    const checked =
      (lbl === 'الأول' && period.semester === 'الفصل الدراسي الأول') ||
      (lbl === 'الثاني' && period.semester === 'الفصل الدراسي الثاني');
    ctx.save();
    ctx.font = `bold 14.5px ${FONT_SANS}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(lbl, rx + segW - 8, y + barH / 2);
    drawCheckbox(ctx, rx + 8, y + 11, 18, checked);
    ctx.restore();
  });
  y += barH + 18;

  // Table 1: م | نوع وعاء التطوير المهني | تاريخ التنفيذ | عدد المستفيدين/المستفيدات | عدد الساعات
  const vCols = [
    { label: 'م', w: 54 },
    { label: 'نوع وعاء التطوير المهني', w: 460 },
    { label: 'تاريخ التنفيذ', w: 220 },
    { label: pdTerms.beneficiariesCountLabel, w: 190 },
    { label: 'عدد الساعات', w: CONTENT_W - (54 + 460 + 220 + 190) },
  ];
  const vPos: Array<{ x: number; w: number; label: string }> = [];
  {
    let x = CANVAS_W - MARGIN_X;
    for (const c of vCols) {
      x -= c.w;
      vPos.push({ ...c, x });
    }
  }

  const drawVesselSummaryHeader = () => {
    const h = 42;
    vPos.forEach((c) => {
      drawCellRect(ctx, c.x, y, c.w, h, HEADER_FILL, BORDER_DARK);
      drawCenteredCellText(ctx, c.label, c.x, y, c.w, h, `bold 15px ${FONT_DISPLAY}`);
    });
    y += h;
  };
  drawVesselSummaryHeader();

  // At least 6 rows like paper template Page 6 (or unlimited when more!)
  const vesselDisplayCount = Math.max(6, derived.vesselRows.length);
  for (let i = 0; i < vesselDisplayCount; i++) {
    const row = derived.vesselRows[i];
    const rowH = 34;
    if (y + rowH > FOOTER_BOTTOM - 60) {
      page = createOfficialPage(logo, header, true, titleText);
      pages.push(page.canvas);
      ctx = page.ctx;
      y = page.y;
      drawVesselSummaryHeader();
    }
    const labelStr = row
      ? row.programTitle && row.vesselTypeLabel !== row.programTitle
        ? `${row.vesselTypeLabel} — ${row.programTitle}`
        : row.vesselTypeLabel
      : '';
    const vals = [
      String(i + 1),
      labelStr,
      row ? row.executionDate : '',
      row ? (row.beneficiariesCount > 0 ? String(row.beneficiariesCount) : '') : '',
      row ? (row.hoursCount > 0 ? String(row.hoursCount) : '') : '',
    ];
    vPos.forEach((c, cIdx) => {
      drawCellRect(ctx, c.x, y, c.w, rowH, cIdx === 0 ? SUBHEADER_FILL : '#FFFFFF', BORDER_DARK);
      if (cIdx === 1) {
        drawRightAlignedCellText(ctx, vals[cIdx], c.x, y, c.w, rowH, `500 14.5px ${FONT_SANS}`);
      } else {
        drawCenteredCellText(ctx, vals[cIdx], c.x, y, c.w, rowH, `600 14.5px ${FONT_SANS}`);
      }
    });
    y += rowH;
  }

  y += 22;

  // Section Heading: المستفيدين / المستفيدات
  if (y + 180 > FOOTER_BOTTOM) {
    page = createOfficialPage(logo, header, true, titleText);
    pages.push(page.canvas);
    ctx = page.ctx;
    y = page.y;
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `bold 19px ${FONT_DISPLAY}`;
  ctx.fillText(pdTerms.beneficiariesTitle, CANVAS_W / 2, y);
  ctx.restore();
  y += 32;

  // Table 2: م | الاسم | الهوية الوطنية (10-digit grid like Page 6!) | مجموع الساعات
  const bCols = [
    { label: 'م', w: 54 },
    { label: 'الاسم', w: 460 },
    { label: 'الهوية الوطنية', w: 410 }, // 10 digit boxes x 41px
    { label: 'مجموع الساعات', w: CONTENT_W - (54 + 460 + 410) },
  ];
  const bPos: Array<{ x: number; w: number; label: string }> = [];
  {
    let x = CANVAS_W - MARGIN_X;
    for (const c of bCols) {
      x -= c.w;
      bPos.push({ ...c, x });
    }
  }

  const drawBeneficiariesHeader = () => {
    const h = 40;
    bPos.forEach((c) => {
      drawCellRect(ctx, c.x, y, c.w, h, HEADER_FILL, BORDER_DARK);
      drawCenteredCellText(ctx, c.label, c.x, y, c.w, h, `bold 15px ${FONT_DISPLAY}`);
    });
    y += h;
  };
  drawBeneficiariesHeader();

  // At least 15 rows like Page 6 paper form (unlimited pagination beyond 15!)
  const benDisplayCount = Math.max(15, derived.beneficiaryRows.length);
  for (let i = 0; i < benDisplayCount; i++) {
    const ben = derived.beneficiaryRows[i];
    const rowH = 34;
    if (y + rowH > FOOTER_BOTTOM - 56) {
      page = createOfficialPage(
        logo,
        header,
        true,
        `${titleText} — كشف ${pdTerms.beneficiariesTitle}`
      );
      pages.push(page.canvas);
      ctx = page.ctx;
      y = page.y;
      drawBeneficiariesHeader();
    }

    // Col 0: م
    drawCellRect(ctx, bPos[0].x, y, bPos[0].w, rowH, SUBHEADER_FILL, BORDER_DARK);
    drawCenteredCellText(ctx, String(i + 1), bPos[0].x, y, bPos[0].w, rowH, `bold 14.5px ${FONT_SANS}`);

    // Col 1: الاسم
    drawCellRect(ctx, bPos[1].x, y, bPos[1].w, rowH, '#FFFFFF', BORDER_DARK);
    drawRightAlignedCellText(ctx, ben ? ben.name : '', bPos[1].x, y, bPos[1].w, rowH, `600 14.5px ${FONT_SANS}`);

    // Col 2: الهوية الوطنية (10-digit grid matching Page 6)
    const idX = bPos[2].x;
    const idW = bPos[2].w;
    const digitBoxW = idW / 10;
    const digits = (ben?.nationalId || '').slice(0, 10).split('');
    for (let d = 0; d < 10; d++) {
      const boxX = idX + d * digitBoxW;
      drawCellRect(ctx, boxX, y, digitBoxW, rowH, '#FFFFFF', BORDER_MED, 1);
      const digitChar = digits[d] || '';
      if (digitChar) {
        drawCenteredCellText(ctx, digitChar, boxX, y, digitBoxW, rowH, `bold 15px ${FONT_SANS}`);
      }
    }
    drawCellRect(ctx, idX, y, idW, rowH, undefined, BORDER_DARK, 1.4);

    // Col 3: مجموع الساعات
    drawCellRect(ctx, bPos[3].x, y, bPos[3].w, rowH, '#FFFFFF', BORDER_DARK);
    drawCenteredCellText(
      ctx,
      ben ? String(ben.totalHours) : '',
      bPos[3].x,
      y,
      bPos[3].w,
      rowH,
      `bold 15px ${FONT_SANS}`,
      ACCENT_BURGUNDY
    );

    y += rowH;
  }

  // Footer Sum Row inside Table 2
  if (y + 42 > FOOTER_BOTTOM - 140) {
    page = createOfficialPage(logo, header, true, titleText);
    pages.push(page.canvas);
    ctx = page.ctx;
    y = page.y;
  }

  const totalLabelW = bPos[0].w + bPos[1].w + bPos[2].w;
  const totalValW = bPos[3].w;
  const sumRowH = 40;
  drawCellRect(ctx, bPos[2].x, y, totalLabelW, sumRowH, HEADER_FILL, BORDER_DARK);
  drawCenteredCellText(
    ctx,
    `مجموع ساعات التطوير المهني ${pdTerms.schoolStaffDative}`,
    bPos[2].x,
    y,
    totalLabelW,
    sumRowH,
    `bold 16px ${FONT_DISPLAY}`
  );
  drawCellRect(ctx, bPos[3].x, y, totalValW, sumRowH, '#FFFFFF', BORDER_DARK);
  drawCenteredCellText(
    ctx,
    String(derived.totalSchoolHours),
    bPos[3].x,
    y,
    totalValW,
    sumRowH,
    `bold 17px ${FONT_SANS}`,
    ACCENT_BURGUNDY
  );
  y += sumRowH + 20;

  drawAuthFooterBlock(ctx, Math.max(y, FOOTER_BOTTOM - 135), {
    rightTitle: header.coordinatorTitle,
    rightName: period.executionReport.coordinatorAuthName || header.coordinatorName,
    leftTitle: header.principalTitle,
    leftName: period.executionReport.principalAuthName || header.principalName,
  });

  return finalizeCanvasesToPdf(pages, filename);
}
