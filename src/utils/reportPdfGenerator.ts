import { SECTIONS } from '../data/sections';
import { SchoolSettings } from '../types';
import {
  EvidenceImageItem,
  FormDefinition,
  FormValues,
  TableRowData,
} from '../types/forms';
import { isFieldVisible, resolveReportFieldValue } from './formEngine';
import {
  getGenderedLabels,
  getRoleForSection,
} from './settingsStorage';
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

export interface PageJpegData {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Builds a valid, standards-compliant single- or multi-page A4 PDF 1.4 binary document
 * from an array of rendered JPEG pages.
 * Default page size: A4 Portrait (595.28pt x 841.89pt).
 */
export function buildMultiPagePdfFromJpegs(
  pages: PageJpegData[],
  pageWidthPt = 595.28,
  pageHeightPt = 841.89
): Uint8Array {
  const safePages =
    pages.length > 0
      ? pages
      : [{ jpegBytes: MINIMAL_WHITE_JPEG, pixelWidth: 1654, pixelHeight: 2339 }];

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

  const wPt = pageWidthPt.toFixed(2);
  const hPt = pageHeightPt.toFixed(2);

  // PDF 1.4 Header with binary marker
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

  // Each page uses 3 objects: Page (3 + i*3), Content Stream (4 + i*3), Image XObject (5 + i*3)
  const pageObjectIds = safePages.map((_, i) => 3 + i * 3);
  const kidsRefs = pageObjectIds.map((id) => `${id} 0 R`).join(' ');

  // Object 2: Pages Root
  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${kidsRefs}] /Count ${safePages.length} >>`
  );
  endObj();

  safePages.forEach((p, idx) => {
    const pageObjId = 3 + idx * 3;
    const contentObjId = 4 + idx * 3;
    const imgObjId = 5 + idx * 3;
    const imgName = `/Im${idx + 1}`;

    // Page Object
    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << ${imgName} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content Stream
    const contentStream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr('\nendstream');
    endObj();

    // Image XObject
    startObj(imgObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr('\nendstream');
    endObj();
  });

  const totalObjects = 2 + safePages.length * 3;
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

function wrapArabicText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const rawParagraphs = String(text || '—').split(/\r?\n/);
  const allLines: string[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = words[0] ?? '';

    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        allLines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines.length > 0 ? allLines : ['—'];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle?: string,
  strokeStyle?: string,
  lineWidth = 2
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function formatScalarText(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val.trim() || '—';
  if (Array.isArray(val)) {
    const cleaned = (val as string[]).filter(
      (item) => typeof item === 'string' && item.trim().length > 0
    );
    return cleaned.length > 0 ? cleaned.join(' ، ') : '—';
  }
  return '—';
}

function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality = 0.92
): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const dataUrlToBytes = () => {
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
            dataUrlToBytes();
            return;
          }
          const buf = await blob.arrayBuffer();
          resolve(new Uint8Array(buf));
        },
        'image/jpeg',
        quality
      );
    } else {
      dataUrlToBytes();
    }
  });
}

/**
 * Generates a high-resolution A4 Portrait (or Landscape) multi-page PDF binary
 * matching the ReportTemplate preview (RTL, Ministry logo, all fields, tables,
 * repeatable lists, uploaded evidence images, executor signature, and footer).
 */
export async function generateStandardReportPdfBytes(
  form: FormDefinition,
  values: FormValues,
  settings: SchoolSettings
): Promise<{ pdfBytes: Uint8Array; filename: string; pageCount: number }> {
  const rawTitle = form.reportTitle || form.title || 'تقرير';
  const programSegment =
    typeof values.programTitle === 'string' && values.programTitle.trim()
      ? `_${sanitizeFilenameSegment(values.programTitle.trim())}`
      : typeof values.semesterName === 'string' && values.semesterName.trim()
      ? `_${sanitizeFilenameSegment(values.semesterName.trim())}`
      : '';
  const filename = `${sanitizeFilenameSegment(rawTitle)}${programSegment}.pdf`;

  if (typeof document === 'undefined') {
    const fallbackBytes = buildMultiPagePdfFromJpegs(
      [{ jpegBytes: MINIMAL_WHITE_JPEG, pixelWidth: 1654, pixelHeight: 2339 }],
      595.28,
      841.89
    );
    return { pdfBytes: fallbackBytes, filename, pageCount: 1 };
  }

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue with system fallback fonts
    }
  }

  const section = SECTIONS[form.sectionId];
  const gendered = getGenderedLabels(settings.gender);
  const rawRoleTitle = getRoleForSection(settings, form.sectionId);
  const defaultRoleLabel =
    form.sectionId === 'teacher'
      ? gendered.teacherGeneralRole
      : form.sectionId === 'gifted'
      ? 'منسق الموهوبين'
      : 'منسق التطوير المهني';
  const roleTitle = rawRoleTitle || defaultRoleLabel;
  const layout = form.templateLayout ?? 'standard-report';
  const footerMode = form.footerMode ?? 'default';
  const fieldHeaderTheme = {
    headerBgHex: '#EFF6FF',
    borderHex: '#BFDBFE',
    headerTextHex: '#1E3A8A',
  };

  const effectiveAcademicYear =
    (typeof values.academicYearInput === 'string' &&
      values.academicYearInput.trim()) ||
    settings.academicYear ||
    'غير محدد';

  // A4 Portrait at 200 DPI: 1654 x 2339 px
  const PAGE_W = 1654;
  const PAGE_H = 2339;
  const MARGIN_X = 95;
  const MARGIN_TOP = 85;
  const FOOTER_RESERVE = 150;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const MAX_Y = PAGE_H - FOOTER_RESERVE;

  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const logoImg = await loadImageElement(`${normalizedBase}moe-logo.png`);

  // Helper to draw a unified data box with a light colored header strip and white value body
  const drawSplitFieldBox = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    headerH: number,
    totalH: number,
    radius: number,
    headerText: string
  ) => {
    // 1. White card background
    drawRoundedRect(c, x, y, w, totalH, radius, '#FFFFFF');

    // 2. Colored header strip clipped to rounded card
    c.save();
    const r = Math.min(radius, w / 2, totalH / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + totalH - r);
    c.quadraticCurveTo(x + w, y + totalH, x + w - r, y + totalH);
    c.lineTo(x + r, y + totalH);
    c.quadraticCurveTo(x, y + totalH, x, y + totalH - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.clip();

    c.fillStyle = fieldHeaderTheme.headerBgHex;
    c.fillRect(x, y, w, headerH);
    c.restore();

    // 3. Header bottom divider line
    c.strokeStyle = fieldHeaderTheme.borderHex;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y + headerH);
    c.lineTo(x + w, y + headerH);
    c.stroke();

    // 4. Outer border
    drawRoundedRect(
      c,
      x,
      y,
      w,
      totalH,
      radius,
      undefined,
      fieldHeaderTheme.borderHex,
      2
    );

    // 5. Centered Header Label
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = fieldHeaderTheme.headerTextHex;
    c.font = 'bold 21px "Tajawal", sans-serif';
    c.fillText(headerText, x + w / 2, y + headerH / 2);
    c.textBaseline = 'top';
  };

  // Preload evidence images
  const visibleBodyFields = form.fields.filter(
    (f) => isFieldVisible(f, values) && !f.hideInReportBody
  );
  const standardFields = visibleBodyFields.filter(
    (f) =>
      f.type !== 'table' &&
      f.type !== 'repeatable' &&
      f.type !== 'images' &&
      f.type !== 'signature'
  );
  const repeatableFields = visibleBodyFields.filter(
    (f) => f.type === 'repeatable'
  );
  const tableFields = visibleBodyFields.filter((f) => f.type === 'table');
  const imageFields = visibleBodyFields.filter((f) => f.type === 'images');

  const loadedEvidenceMap = new Map<string, HTMLImageElement | null>();
  for (const field of imageFields) {
    const imgs = Array.isArray(values[field.id])
      ? (values[field.id] as EvidenceImageItem[])
      : [];
    for (const item of imgs) {
      if (item.dataUrl) {
        const el = await loadImageElement(item.dataUrl);
        loadedEvidenceMap.set(item.id, el);
      }
    }
  }

  const signatureImg =
    typeof values.executorSignature === 'string' &&
    values.executorSignature.trim().length > 0
      ? await loadImageElement(values.executorSignature)
      : null;

  const canvases: HTMLCanvasElement[] = [];
  let currentCanvas!: HTMLCanvasElement;
  let ctx!: CanvasRenderingContext2D;
  let cursorY = MARGIN_TOP;

  const startNewPage = (isFirstPage: boolean) => {
    currentCanvas = document.createElement('canvas');
    currentCanvas.width = PAGE_W;
    currentCanvas.height = PAGE_H;
    const context = currentCanvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to initialize 2D canvas context');
    }
    ctx = context;
    ctx.direction = 'rtl';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    canvases.push(currentCanvas);
    cursorY = MARGIN_TOP;

    // Draw official header on first page, or compact continuation header on subsequent pages
    if (isFirstPage) {
      const eduDeptText = settings.educationDepartment || 'غير محدد';
      const schoolNameText = settings.schoolName || 'غير محدد';

      // Right Zone: Official Kingdom & School Details
      // Positioned near the center of the right side while text lines remain right-aligned
      const rightZoneCenterX = PAGE_W - MARGIN_X - CONTENT_W * 0.215;
      ctx.font = 'bold 25px "Tajawal", sans-serif';
      const w1 = ctx.measureText('المملكة العربية السعودية').width;
      ctx.font = 'bold 23px "Tajawal", sans-serif';
      const w2 = ctx.measureText('وزارة التعليم').width;
      ctx.font = '600 22px "Tajawal", sans-serif';
      const w3 = ctx.measureText(eduDeptText).width;
      const w4 = ctx.measureText(schoolNameText).width;
      const rightGroupWidth = Math.min(390, Math.max(w1, w2, w3, w4));
      const rightGroupAnchorX = Math.min(
        PAGE_W - MARGIN_X - 115,
        Math.round(rightZoneCenterX + rightGroupWidth / 2)
      );

      ctx.textBaseline = 'top';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0c0a09';
      ctx.font = 'bold 25px "Tajawal", sans-serif';
      ctx.fillText('المملكة العربية السعودية', rightGroupAnchorX, cursorY + 10);

      ctx.fillStyle = '#292524';
      ctx.font = 'bold 23px "Tajawal", sans-serif';
      ctx.fillText('وزارة التعليم', rightGroupAnchorX, cursorY + 48);

      ctx.fillStyle = '#1c1917';
      ctx.font = '600 22px "Tajawal", sans-serif';
      ctx.fillText(eduDeptText, rightGroupAnchorX, cursorY + 84);
      ctx.fillText(schoolNameText, rightGroupAnchorX, cursorY + 120);

      // Center Ministry Logo: horizontally centered, enlarged by cropping excess PNG margin while preserving 100% original aspect ratio
      if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
        const cropX = logoImg.width * 0.26;
        const cropY = logoImg.height * 0.31;
        const cropW = logoImg.width * 0.48;
        const cropH = logoImg.height * 0.38;
        const targetLogoW = 216;
        const targetLogoH = (cropH / cropW) * targetLogoW;
        ctx.drawImage(
          logoImg,
          cropX,
          cropY,
          cropW,
          cropH,
          (PAGE_W - targetLogoW) / 2,
          cursorY + (164 - targetLogoH) / 2,
          targetLogoW,
          targetLogoH
        );
      }

      // Left Zone: Section Title (without 'القسم:') & Academic Year below it
      // Positioned near the center of the left third (not stuck to the left edge)
      const leftZoneCenterX = MARGIN_X + CONTENT_W / 6;
      ctx.textAlign = 'center';
      ctx.fillStyle = fieldHeaderTheme.headerTextHex;
      ctx.font = 'bold 26px "Tajawal", sans-serif';
      ctx.fillText(section.title, leftZoneCenterX, cursorY + 42);

      ctx.fillStyle = '#1c1917';
      ctx.font = '600 22px "Tajawal", sans-serif';
      ctx.fillText(effectiveAcademicYear, leftZoneCenterX, cursorY + 86);

      cursorY += 168;

      // Unified Report Theme Bottom Border
      ctx.strokeStyle = fieldHeaderTheme.borderHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, cursorY);
      ctx.lineTo(PAGE_W - MARGIN_X, cursorY);
      ctx.stroke();

      cursorY += 28;

      // Report Main Title Banner — Unified with the official report visual identity
      const bannerH = 84;
      drawRoundedRect(
        ctx,
        MARGIN_X,
        cursorY,
        CONTENT_W,
        bannerH,
        18,
        fieldHeaderTheme.headerBgHex,
        fieldHeaderTheme.borderHex,
        2
      );
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fieldHeaderTheme.headerTextHex;
      ctx.font = 'bold 34px "Tajawal", sans-serif';
      ctx.fillText(
        form.reportTitle || form.title,
        PAGE_W / 2,
        cursorY + bannerH / 2
      );
      ctx.textBaseline = 'top';
      cursorY += bannerH + 26;
    } else {
      // Compact continuation header on Page 2+
      ctx.textBaseline = 'top';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#57534e';
      ctx.font = 'bold 20px "Tajawal", sans-serif';
      ctx.fillText(
        `${form.reportTitle || form.title} — تابع`,
        PAGE_W - MARGIN_X,
        cursorY
      );
      ctx.textAlign = 'left';
      ctx.fillText(
        settings.schoolName || 'غير محدد',
        MARGIN_X,
        cursorY
      );
      cursorY += 34;
      ctx.strokeStyle = fieldHeaderTheme.borderHex;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, cursorY);
      ctx.lineTo(PAGE_W - MARGIN_X, cursorY);
      ctx.stroke();
      cursorY += 26;
    }
  };

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight > MAX_Y) {
      startNewPage(false);
    }
  };

  // Start Page 1
  startNewPage(true);

  // Semester Final Report Summary Metrics Bar
  const executedProgramsRows: TableRowData[] =
    layout === 'semester-final-report' && Array.isArray(values.executedPrograms)
      ? (values.executedPrograms as TableRowData[]).filter((r) =>
          Object.values(r).some(
            (v) => typeof v === 'string' && v.trim().length > 0
          )
        )
      : [];
  const totalBeneficiaries = executedProgramsRows.reduce((sum, row) => {
    const num = Number((row.beneficiariesCount ?? '').trim());
    return Number.isNaN(num) ? sum : sum + num;
  }, 0);

  if (layout === 'semester-final-report') {
    const metrics = [
      { label: 'الفصل الدراسي', value: formatScalarText(values.semesterName) },
      { label: 'العام الدراسي', value: effectiveAcademicYear },
      {
        label: 'إجمالي البرامج المنفذة',
        value: String(executedProgramsRows.length),
      },
      { label: 'إجمالي المستفيدين', value: String(totalBeneficiaries) },
    ];
    const gap = 20;
    const cardW = (CONTENT_W - gap * 3) / 4;
    const headerH = 44;
    const cardH = 104;
    ensureSpace(cardH + 22);

    metrics.forEach((m, idx) => {
      // RTL order: index 0 on far right
      const cardX = PAGE_W - MARGIN_X - (idx + 1) * cardW - idx * gap;
      drawSplitFieldBox(
        ctx,
        cardX,
        cursorY,
        cardW,
        headerH,
        cardH,
        14,
        m.label
      );

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0c0a09';
      ctx.font = 'bold 24px "Tajawal", sans-serif';
      ctx.fillText(
        m.value,
        cardX + cardW / 2,
        cursorY + headerH + (cardH - headerH) / 2
      );
      ctx.textBaseline = 'top';
    });

    cursorY += cardH + 22;
  }

  // 1. Standard Fields Grid (2 columns in RTL or full width)
  if (standardFields.length > 0) {
    const colGap = 20;
    const halfW = (CONTENT_W - colGap) / 2;
    const padX = 24;
    const bodyPadY = 16;
    const headerH = 46;
    const lineH = 34;

    let i = 0;
    while (i < standardFields.length) {
      const field = standardFields[i];
      const isFull = field.width === 'full' || field.type === 'textarea';
      const isLongText = field.type === 'textarea';

      if (isFull) {
        ctx.font = '600 22px "Tajawal", sans-serif';
        const valText = formatScalarText(resolveReportFieldValue(field, values));
        const lines = wrapArabicText(ctx, valText, CONTENT_W - padX * 2);
        const bodyH = bodyPadY * 2 + lines.length * lineH;
        const boxH = headerH + bodyH;
        ensureSpace(boxH + 18);

        drawSplitFieldBox(
          ctx,
          MARGIN_X,
          cursorY,
          CONTENT_W,
          headerH,
          boxH,
          14,
          field.label
        );

        ctx.fillStyle = '#1c1917';
        ctx.font = '600 22px "Tajawal", sans-serif';
        if (isLongText) {
          ctx.textAlign = 'right';
          lines.forEach((ln, lIdx) => {
            ctx.fillText(
              ln,
              PAGE_W - MARGIN_X - padX,
              cursorY + headerH + bodyPadY + lIdx * lineH
            );
          });
        } else {
          ctx.textAlign = 'center';
          lines.forEach((ln, lIdx) => {
            ctx.fillText(
              ln,
              MARGIN_X + CONTENT_W / 2,
              cursorY + headerH + bodyPadY + lIdx * lineH
            );
          });
        }

        cursorY += boxH + 18;
        i += 1;
      } else {
        // Pair two half-width fields if next is also half-width
        const nextField =
          i + 1 < standardFields.length &&
          standardFields[i + 1].width !== 'full' &&
          standardFields[i + 1].type !== 'textarea'
            ? standardFields[i + 1]
            : null;

        ctx.font = '600 22px "Tajawal", sans-serif';
        const rightLines = wrapArabicText(
          ctx,
          formatScalarText(resolveReportFieldValue(field, values)),
          halfW - padX * 2
        );
        const leftLines = nextField
          ? wrapArabicText(
              ctx,
              formatScalarText(resolveReportFieldValue(nextField, values)),
              halfW - padX * 2
            )
          : [];
        const maxLines = Math.max(rightLines.length, leftLines.length, 1);
        const bodyH = bodyPadY * 2 + maxLines * lineH;
        const boxH = headerH + bodyH;
        ensureSpace(boxH + 18);

        // Right box
        const rightBoxX = PAGE_W - MARGIN_X - halfW;
        drawSplitFieldBox(
          ctx,
          rightBoxX,
          cursorY,
          halfW,
          headerH,
          boxH,
          14,
          field.label
        );

        ctx.textAlign = 'center';
        ctx.fillStyle = '#1c1917';
        ctx.font = '600 22px "Tajawal", sans-serif';
        rightLines.forEach((ln, lIdx) => {
          ctx.fillText(
            ln,
            rightBoxX + halfW / 2,
            cursorY + headerH + bodyPadY + lIdx * lineH
          );
        });

        // Left box if paired
        if (nextField) {
          const leftBoxX = MARGIN_X;
          drawSplitFieldBox(
            ctx,
            leftBoxX,
            cursorY,
            halfW,
            headerH,
            boxH,
            14,
            nextField.label
          );

          ctx.textAlign = 'center';
          ctx.fillStyle = '#1c1917';
          ctx.font = '600 22px "Tajawal", sans-serif';
          leftLines.forEach((ln, lIdx) => {
            ctx.fillText(
              ln,
              leftBoxX + halfW / 2,
              cursorY + headerH + bodyPadY + lIdx * lineH
            );
          });
        }

        cursorY += boxH + 18;
        i += nextField ? 2 : 1;
      }
    }
  }

  // 2. Repeatable Fields Lists (Objectives, Topics, Outputs, Recommendations: Centered Header, Right-aligned RTL body)
  for (const field of repeatableFields) {
    const rawItems = Array.isArray(values[field.id])
      ? (values[field.id] as string[])
      : [];
    const populated = rawItems.filter(
      (item) => typeof item === 'string' && item.trim().length > 0
    );
    const itemsToDraw = populated.length > 0 ? populated : ['—'];

    const padX = 26;
    const bodyPadY = 18;
    const headerH = 48;
    const lineH = 34;
    ctx.font = '600 22px "Tajawal", sans-serif';

    const wrappedPerItem = itemsToDraw.map((item, idx) =>
      wrapArabicText(
        ctx,
        populated.length > 0 ? `${idx + 1}. ${item.trim()}` : '—',
        CONTENT_W - padX * 2
      )
    );
    const totalLines = wrappedPerItem.reduce((s, arr) => s + arr.length, 0);
    const bodyH =
      bodyPadY * 2 + totalLines * lineH + (itemsToDraw.length - 1) * 8;
    const boxH = headerH + bodyH;
    ensureSpace(boxH + 18);

    drawSplitFieldBox(
      ctx,
      MARGIN_X,
      cursorY,
      CONTENT_W,
      headerH,
      boxH,
      14,
      field.label
    );

    let itemY = cursorY + headerH + bodyPadY;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#292524';
    ctx.font = '600 22px "Tajawal", sans-serif';
    for (const lines of wrappedPerItem) {
      for (const ln of lines) {
        ctx.fillText(ln, PAGE_W - MARGIN_X - padX, itemY);
        itemY += lineH;
      }
      itemY += 8;
    }

    cursorY += boxH + 18;
  }

  // 3. Structured Tables (e.g., Executed Programs in Semester Final Report)
  for (const field of tableFields) {
    const cols = field.columns ?? [];
    const rawRows = Array.isArray(values[field.id])
      ? (values[field.id] as TableRowData[])
      : [];
    const rows =
      rawRows.length > 0
        ? rawRows
        : [
            cols.reduce((acc, c) => {
              acc[c.key] = '—';
              return acc;
            }, {} as TableRowData),
          ];

    ensureSpace(170);

    // Table Section Title Box Header
    const sectionHeaderH = 48;
    ctx.fillStyle = fieldHeaderTheme.headerBgHex;
    ctx.fillRect(MARGIN_X, cursorY, CONTENT_W, sectionHeaderH);
    ctx.strokeStyle = fieldHeaderTheme.borderHex;
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN_X, cursorY, CONTENT_W, sectionHeaderH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fieldHeaderTheme.headerTextHex;
    ctx.font = 'bold 22px "Tajawal", sans-serif';
    ctx.fillText(field.label, MARGIN_X + CONTENT_W / 2, cursorY + sectionHeaderH / 2);
    ctx.textBaseline = 'top';
    cursorY += sectionHeaderH;

    // Column widths in RTL (starting from right: index column 'م', then cols[0..n])
    const indexColW = 70;
    const remainingW = CONTENT_W - indexColW;
    const weights = cols.map((c) => {
      if (c.key === 'programName' || c.key === 'keyOutputs') return 1.35;
      if (c.key === 'beneficiariesCount') return 0.7;
      if (c.key === 'executionDate') return 0.85;
      return 0.9;
    });
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    const colWidths = weights.map((w) => (w / weightSum) * remainingW);

    const drawTableHeader = () => {
      const headerH = 54;
      ctx.fillStyle = fieldHeaderTheme.headerBgHex;
      ctx.fillRect(MARGIN_X, cursorY, CONTENT_W, headerH);
      ctx.strokeStyle = fieldHeaderTheme.borderHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN_X, cursorY, CONTENT_W, headerH);

      let colRightX = PAGE_W - MARGIN_X;
      // Draw 'م' column
      ctx.textAlign = 'center';
      ctx.fillStyle = fieldHeaderTheme.headerTextHex;
      ctx.font = 'bold 20px "Tajawal", sans-serif';
      ctx.fillText('م', colRightX - indexColW / 2, cursorY + 15);
      colRightX -= indexColW;

      ctx.beginPath();
      ctx.moveTo(colRightX, cursorY);
      ctx.lineTo(colRightX, cursorY + headerH);
      ctx.stroke();

      cols.forEach((col, cIdx) => {
        const w = colWidths[cIdx];
        ctx.textAlign = 'center';
        ctx.fillText(col.label, colRightX - w / 2, cursorY + 15);
        colRightX -= w;
        if (cIdx < cols.length - 1) {
          ctx.beginPath();
          ctx.moveTo(colRightX, cursorY);
          ctx.lineTo(colRightX, cursorY + headerH);
          ctx.stroke();
        }
      });

      cursorY += headerH;
    };

    drawTableHeader();

    // Draw Table Rows with automatic page-break if a row exceeds MAX_Y
    const lineH = 30;
    const cellPadY = 14;
    const cellPadX = 12;

    rows.forEach((row, rIdx) => {
      ctx.font = '600 20px "Tajawal", sans-serif';
      const wrappedCols = cols.map((col, cIdx) =>
        wrapArabicText(
          ctx,
          row[col.key]?.trim() || '—',
          colWidths[cIdx] - cellPadX * 2
        )
      );
      const maxRowLines = Math.max(
        ...wrappedCols.map((lines) => lines.length),
        1
      );
      const rowH = cellPadY * 2 + maxRowLines * lineH;

      if (cursorY + rowH > MAX_Y) {
        startNewPage(false);
        drawTableHeader();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(MARGIN_X, cursorY, CONTENT_W, rowH);
      ctx.strokeStyle = fieldHeaderTheme.borderHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN_X, cursorY, CONTENT_W, rowH);

      let colRightX = PAGE_W - MARGIN_X;
      // Row number
      ctx.textAlign = 'center';
      ctx.fillStyle = '#57534e';
      ctx.font = 'bold 20px "Tajawal", sans-serif';
      ctx.fillText(String(rIdx + 1), colRightX - indexColW / 2, cursorY + cellPadY);
      colRightX -= indexColW;

      ctx.beginPath();
      ctx.moveTo(colRightX, cursorY);
      ctx.lineTo(colRightX, cursorY + rowH);
      ctx.stroke();

      ctx.fillStyle = '#1c1917';
      ctx.font = '600 20px "Tajawal", sans-serif';
      cols.forEach((col, cIdx) => {
        const w = colWidths[cIdx];
        const lines = wrappedCols[cIdx];
        const isLongCol =
          col.key === 'programName' || col.key === 'keyOutputs';
        ctx.textAlign = isLongCol ? 'right' : 'center';
        lines.forEach((ln, lIdx) => {
          ctx.fillText(
            ln,
            isLongCol ? colRightX - cellPadX : colRightX - w / 2,
            cursorY + cellPadY + lIdx * lineH
          );
        });
        colRightX -= w;
        if (cIdx < cols.length - 1) {
          ctx.beginPath();
          ctx.moveTo(colRightX, cursorY);
          ctx.lineTo(colRightX, cursorY + rowH);
          ctx.stroke();
        }
      });

      cursorY += rowH;
    });

    cursorY += 22;
  }

  // 4. Evidence Images Grid (الشواهد المصورة)
  for (const field of imageFields) {
    const imgs = Array.isArray(values[field.id])
      ? (values[field.id] as EvidenceImageItem[])
      : [];
    if (imgs.length === 0) continue;

    const colGap = 24;
    const cardW = (CONTENT_W - colGap) / 2;
    const imgBoxH = 310;
    const cardH = 385;
    const headerH = 48;

    ensureSpace(headerH + cardH + 24);

    // Section Header Bar
    drawSplitFieldBox(
      ctx,
      MARGIN_X,
      cursorY,
      CONTENT_W,
      headerH,
      headerH,
      12,
      field.label
    );
    cursorY += headerH + 14;

    for (let i = 0; i < imgs.length; i += 2) {
      ensureSpace(cardH + 20);

      for (let offset = 0; offset < 2; offset++) {
        const imgItem = imgs[i + offset];
        if (!imgItem) continue;

        // RTL: offset 0 on right, offset 1 on left
        const cardX =
          offset === 0 ? PAGE_W - MARGIN_X - cardW : MARGIN_X;

        drawRoundedRect(
          ctx,
          cardX,
          cursorY,
          cardW,
          cardH,
          14,
          '#FFFFFF',
          fieldHeaderTheme.borderHex,
          2
        );

        // Inner white image box
        const innerPad = 16;
        const innerW = cardW - innerPad * 2;
        drawRoundedRect(
          ctx,
          cardX + innerPad,
          cursorY + innerPad,
          innerW,
          imgBoxH,
          10,
          '#FFFFFF',
          '#F5F5F4',
          1
        );

        const loadedEl = loadedEvidenceMap.get(imgItem.id);
        if (loadedEl && loadedEl.width > 0 && loadedEl.height > 0) {
          const scale = Math.min(
            (innerW - 12) / loadedEl.width,
            (imgBoxH - 12) / loadedEl.height
          );
          const drawW = loadedEl.width * scale;
          const drawH = loadedEl.height * scale;
          const drawX = cardX + innerPad + (innerW - drawW) / 2;
          const drawY = cursorY + innerPad + (imgBoxH - drawH) / 2;
          ctx.drawImage(loadedEl, drawX, drawY, drawW, drawH);
        }

        // Caption
        const captionText =
          imgItem.caption?.trim() || `شاهد (${i + offset + 1})`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#44403c';
        ctx.font = '600 20px "Tajawal", sans-serif';
        const capLines = wrapArabicText(ctx, captionText, innerW);
        ctx.fillText(
          capLines[0] ?? captionText,
          cardX + cardW / 2,
          cursorY + innerPad + imgBoxH + 16
        );
      }

      cursorY += cardH + 20;
    }
  }

  // 5. End-of-Report Preparer & Signature Block
  // Format: معد التقرير: [الاسم] | السجل المدني: [الرقم] | التوقيع: [التوقيع أو بدون إطار فارغ]
  {
    const hasSignature =
      footerMode === 'executor' &&
      signatureImg &&
      signatureImg.width > 0 &&
      signatureImg.height > 0;
    const preparerBoxH = hasSignature ? 110 : 78;
    ensureSpace(preparerBoxH + 20);

    drawRoundedRect(
      ctx,
      MARGIN_X,
      cursorY,
      CONTENT_W,
      preparerBoxH,
      14,
      '#FFFFFF',
      fieldHeaderTheme.borderHex,
      2
    );

    const padX = 28;
    const centerY = cursorY + preparerBoxH / 2;
    ctx.textBaseline = 'middle';

    if (footerMode === 'executor') {
      const colW = (CONTENT_W - padX * 2) / 3;
      const preparerName =
        typeof values.executorName === 'string' && values.executorName.trim()
          ? values.executorName.trim()
          : settings.userName || 'غير محدد';

      // Right Column: معد التقرير: [الاسم]
      const col1Right = PAGE_W - MARGIN_X - padX;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 21px "Tajawal", sans-serif';
      ctx.fillText(`معد التقرير: ${preparerName}`, col1Right, centerY);

      // Center Column: السجل المدني: [الرقم]
      const col2Right = col1Right - colW;
      ctx.fillText(
        `السجل المدني: ${formatScalarText(values.executorNationalId)}`,
        col2Right,
        centerY
      );

      // Left Column: التوقيع: [التوقيع أو كلمة التوقيع: فقط دون مربع فارغ]
      const col3Right = col2Right - colW;
      ctx.fillText('التوقيع:', col3Right, centerY);

      if (hasSignature && signatureImg) {
        const labelW = ctx.measureText('التوقيع: ').width + 12;
        const maxSigW = 190;
        const maxSigH = 74;
        const scale = Math.min(
          maxSigW / signatureImg.width,
          maxSigH / signatureImg.height
        );
        const drawW = signatureImg.width * scale;
        const drawH = signatureImg.height * scale;
        const sigX = col3Right - labelW - drawW;
        const sigY = centerY - drawH / 2;
        ctx.drawImage(signatureImg, sigX, sigY, drawW, drawH);
      }
    } else {
      // Semester Final Report: معد التقرير: [الاسم] + التوقيع:
      const col1Right = PAGE_W - MARGIN_X - padX;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 21px "Tajawal", sans-serif';
      ctx.fillText(
        `معد التقرير: ${settings.userName || 'غير محدد'}`,
        col1Right,
        centerY
      );

      const colLeft = MARGIN_X + padX + 260;
      ctx.fillText('التوقيع:', colLeft, centerY);
    }

    ctx.textBaseline = 'top';
    cursorY += preparerBoxH + 20;
  }

  // Draw Official Footer on every page:
  // Right: منسق التطوير المهني: [الاسم] | Left: مدير المدرسة: [الاسم] (No Academic Year in Footer)
  canvases.forEach((canvasPage) => {
    const pCtx = canvasPage.getContext('2d');
    if (!pCtx) return;
    pCtx.direction = 'rtl';
    pCtx.textBaseline = 'top';

    const footerTop = PAGE_H - 115;
    pCtx.strokeStyle = '#E7E5E4';
    pCtx.lineWidth = 3;
    pCtx.beginPath();
    pCtx.moveTo(MARGIN_X, footerTop);
    pCtx.lineTo(PAGE_W - MARGIN_X, footerTop);
    pCtx.stroke();

    // Right: Coordinator / Role Title + Name
    pCtx.textAlign = 'right';
    pCtx.fillStyle = '#1c1917';
    pCtx.font = 'bold 22px "Tajawal", sans-serif';
    pCtx.fillText(
      `${roleTitle}: ${settings.userName || 'غير محدد'}`,
      PAGE_W - MARGIN_X,
      footerTop + 26
    );

    // Left: School Principal Title + Name
    pCtx.textAlign = 'left';
    pCtx.fillStyle = '#1c1917';
    pCtx.font = 'bold 22px "Tajawal", sans-serif';
    pCtx.fillText(
      `${gendered.principalTitle}: ${settings.principalName || 'غير محدد'}`,
      MARGIN_X,
      footerTop + 26
    );
  });

  const pageJpegs: PageJpegData[] = [];
  for (const c of canvases) {
    const jpegBytes = await canvasToJpegBytes(c, 0.92);
    pageJpegs.push({
      jpegBytes,
      pixelWidth: c.width,
      pixelHeight: c.height,
    });
  }

  const pdfBytes = buildMultiPagePdfFromJpegs(pageJpegs, 595.28, 841.89);
  return {
    pdfBytes,
    filename,
    pageCount: pageJpegs.length,
  };
}
