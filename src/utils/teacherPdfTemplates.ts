import {
  SchoolSettings,
  TeacherPdfColorSystem,
  TeacherPdfTemplateStyle,
} from '../types';
import { drawQrCodeOnCanvas } from './qrCodeGenerator';
import {
  PdfLinkAnnotation,
  TeacherColorPalette,
  TeacherReportAttendanceRow,
  TeacherReportBasicField,
  TeacherReportContentSection,
  TeacherReportDocument,
  TeacherReportEvidenceLink,
  TeacherReportEvidencePhoto,
} from './teacherPdfEngine';

export interface TeacherTemplateDefinition {
  id: TeacherPdfTemplateStyle;
  name: string;
  shortName: string;
  description: string;
  referenceFeatures: string[];
}

export const TEACHER_TEMPLATE_DEFINITIONS: Record<
  TeacherPdfTemplateStyle,
  TeacherTemplateDefinition
> = {
  waves: {
    id: 'waves',
    name: 'قالب 1',
    shortName: 'قالب 1',
    description:
      'تصميم رسمي بزخارف منحنية، وجدول بيانات موحد متكيف الارتفاع، وبطاقات أقسام بلسان علوي بارز وأيقونات، واعتماد مدير المدرسة بسطر واحد أسفل الصفحة الأخيرة.',
    referenceFeatures: [
      'زخارف زاوية علوية يسارية وسفلية ممتدة متعددة الطبقات',
      'عنوان رئيسي يتوسط الصفحة تحته شريط لوني ثنائي',
      'جدول بيانات أساسية موحد بعمودين يتكيف ارتفاعه تلقائياً مع طول النص',
      'ألسنة عناوين أقسام بارزة أعلى يمين كل بطاقة بالتبادل اللوني',
      'اعتماد مدير المدرسة في سطر واحد أسفل الصفحة الأخيرة فقط',
    ],
  },
  'waves-2': {
    id: 'waves-2',
    name: 'قالب 2',
    shortName: 'قالب 2',
    description:
      'تصميم انسيابي يحتضن الترويسة من الجانبين، كبسولة عنوان فرعي ديناميكية، شريط بيانات أفقي بأيقونات، بطاقات بلسان ناعم، وحاوية شواهد ورموز QR مستقلة.',
    referenceFeatures: [
      'زخارف انسيابية مزدوجة على جانبي الترويسة وأسفل الصفحة',
      'منطقة مستقلة لاسم التقرير يسار الترويسة وتحته كبسولة العنوان الرئيسي',
      'شريط بيانات أفقي مقسّم بفواصل رأسية وأيقونات يتمدد ارتفاعه حسب المحتوى',
      'ألسنة عناوين أقسام بحافة منحنية وعلامات صح دائرية',
      'بطاقة شواهد بلسان وسطي تعلوها نجمة وحاوية QR مستقلة برمز رابط',
    ],
  },
  geometric: {
    id: 'geometric',
    name: 'قالب 3',
    shortName: 'قالب 3',
    description:
      'تصميم بزخارف زاوية مائلة، ترويسة مقسمة بفواصل رأسية، لافتة عنوان مشطوفة بشرطات مائلة، وألسنة أقسام مائلة مع شواهد وروابط QR.',
    referenceFeatures: [
      'زخارف أشرطة وأشكال بزاوية 45° في الزوايا العلوية والسفلية',
      'ترويسة من ثلاث مناطق مستقلة مفصولة بخطين رأسيين حول شعار وزارة التعليم',
      'لافتة عنوان رئيسي مشطوفة محاطة بشرطات متوازية مائلة (//)',
      'بطاقات أقسام بلسان مائل الحافة وعلامات صح دائرية',
      'قسم شواهد بأيقونة كاميرا وروابط برموز QR قابلة للمسح والنقر',
    ],
  },
};

export type TeacherIconKind =
  | 'book'
  | 'calendar'
  | 'user'
  | 'users'
  | 'graduation'
  | 'target'
  | 'document'
  | 'gear'
  | 'chart'
  | 'lightbulb'
  | 'camera'
  | 'star'
  | 'link'
  | 'check';

/**
 * Selects the appropriate vector icon for a basic field or content section based on its Arabic title/label.
 */
export function resolveIconForLabel(
  label: string,
  fallbackIndex = 0
): TeacherIconKind {
  const text = label.trim();
  if (
    text.includes('اسم البرنامج') ||
    text.includes('اسم الاستراتيجية') ||
    text.includes('اسم الممارسة') ||
    text.includes('الدرس') ||
    text.includes('المادة') ||
    text.includes('النشاط')
  ) {
    return 'book';
  }
  if (
    text.includes('تاريخ') ||
    text.includes('التاريخ') ||
    text.includes('الفترة') ||
    text.includes('مدة') ||
    text.includes('الأسبوع') ||
    text.includes('العام')
  ) {
    return 'calendar';
  }
  if (
    text.includes('الفصل') ||
    text.includes('المرحلة') ||
    text.includes('الصف')
  ) {
    return 'graduation';
  }
  if (
    (text.includes('المنفذ') && !text.includes('الجهة')) ||
    text.includes('المعلم')
  ) {
    return 'user';
  }
  if (
    text.includes('الفئة') ||
    text.includes('الجهة') ||
    text.includes('عدد الطلاب') ||
    text.includes('المستهدف') ||
    text.includes('المستفيدة')
  ) {
    return text.includes('الهدف') ? 'target' : 'users';
  }
  if (
    text.includes('هدف') ||
    text.includes('أهداف') ||
    text.includes('موضوع المعالجة') ||
    text.includes('اسم الإنجاز') ||
    text.includes('نوع الإنجاز') ||
    text.includes('نطاق')
  ) {
    return 'target';
  }
  if (
    text.includes('وصف') ||
    text.includes('ملخص') ||
    text.includes('فكرة') ||
    text.includes('المستوى') ||
    text.includes('الملاحظات') ||
    text.includes('البيانات الأساسية') ||
    text.includes('مكان') ||
    text.includes('الاختبار')
  ) {
    return 'document';
  }
  if (
    text.includes('محاور') ||
    text.includes('إجراءات') ||
    text.includes('خطوات') ||
    text.includes('آلية') ||
    text.includes('الأدوات') ||
    text.includes('الوسائل') ||
    text.includes('أسباب')
  ) {
    return 'gear';
  }
  if (
    text.includes('نتائج') ||
    text.includes('النتائج') ||
    text.includes('مؤشرات') ||
    text.includes('مخرجات') ||
    text.includes('توزيع') ||
    text.includes('القوة') ||
    text.includes('الضعف') ||
    text.includes('الأثر')
  ) {
    return 'chart';
  }
  if (
    text.includes('توصيات') ||
    text.includes('التوصيات') ||
    text.includes('الإجراءات') ||
    text.includes('الاستمرار') ||
    text.includes('التعميم')
  ) {
    return 'lightbulb';
  }

  const cycle: TeacherIconKind[] = [
    'target',
    'document',
    'gear',
    'chart',
    'lightbulb',
  ];
  return cycle[fallbackIndex % cycle.length];
}

/**
 * Draws clean, scalable vector icons directly onto a 2D Canvas context
 * using the active color palette or white for dark tabs.
 */
export function drawTeacherVectorIcon(
  ctx: CanvasRenderingContext2D,
  kind: TeacherIconKind,
  cx: number,
  cy: number,
  size: number,
  colorHex: string
): void {
  ctx.save();
  ctx.strokeStyle = colorHex;
  ctx.fillStyle = colorHex;
  ctx.lineWidth = Math.max(2, size * 0.085);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const r = size / 2;

  switch (kind) {
    case 'book': {
      const w = size * 0.88;
      const h = size * 0.68;
      const x = cx - w / 2;
      const y = cy - h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.15);
      ctx.quadraticCurveTo(cx - w * 0.25, y, x, y + h * 0.08);
      ctx.lineTo(x, y + h * 0.92);
      ctx.quadraticCurveTo(cx - w * 0.25, y + h * 0.84, cx, y + h);
      ctx.quadraticCurveTo(cx + w * 0.25, y + h * 0.84, x + w, y + h * 0.92);
      ctx.lineTo(x + w, y + h * 0.08);
      ctx.quadraticCurveTo(cx + w * 0.25, y, cx, y + h * 0.15);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.15);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
      break;
    }

    case 'calendar': {
      const w = size * 0.82;
      const h = size * 0.82;
      const x = cx - w / 2;
      const y = cy - h / 2 + 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.3);
      ctx.lineTo(x + w, y + h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.28, y - 4);
      ctx.lineTo(x + w * 0.28, y + 4);
      ctx.moveTo(x + w * 0.72, y - 4);
      ctx.lineTo(x + w * 0.72, y + 4);
      ctx.stroke();
      const dotR = Math.max(1.8, size * 0.055);
      for (const gx of [0.28, 0.5, 0.72]) {
        for (const gy of [0.52, 0.74]) {
          ctx.beginPath();
          ctx.arc(x + w * gx, y + h * gy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'user': {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.32, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.68, r * 0.62, Math.PI * 1.12, Math.PI * 1.88);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'users': {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.34, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.58, r * 0.52, Math.PI * 1.1, Math.PI * 1.9);
      ctx.closePath();
      ctx.fill();
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(
          cx + dir * r * 0.56,
          cy - r * 0.2,
          r * 0.21,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          cx + dir * r * 0.56,
          cy + r * 0.58,
          r * 0.38,
          Math.PI * 1.12,
          Math.PI * 1.88
        );
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'graduation': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.58);
      ctx.lineTo(cx + r * 0.88, cy - r * 0.12);
      ctx.lineTo(cx, cy + r * 0.32);
      ctx.lineTo(cx - r * 0.88, cy - r * 0.12);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - r * 0.48, cy + r * 0.15);
      ctx.lineTo(cx - r * 0.48, cy + r * 0.55);
      ctx.quadraticCurveTo(cx, cy + r * 0.8, cx + r * 0.48, cy + r * 0.55);
      ctx.lineTo(cx + r * 0.48, cy + r * 0.15);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx + r * 0.76, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.76, cy + r * 0.55);
      ctx.stroke();
      break;
    }

    case 'target': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.12, cy - r * 0.12);
      ctx.lineTo(cx + r * 0.85, cy - r * 0.85);
      ctx.stroke();
      break;
    }

    case 'document': {
      const w = size * 0.72;
      const h = size * 0.88;
      const x = cx - w / 2;
      const y = cy - h / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.stroke();
      for (const ly of [0.3, 0.52, 0.74]) {
        ctx.beginPath();
        ctx.moveTo(x + w * 0.22, y + h * ly);
        ctx.lineTo(x + w * 0.78, y + h * ly);
        ctx.stroke();
      }
      break;
    }

    case 'gear': {
      const outerR = r * 0.82;
      const innerR = r * 0.34;
      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const rad = i % 2 === 0 ? outerR : outerR * 0.74;
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'chart': {
      const baseLineY = cy + r * 0.72;
      const barW = size * 0.16;
      const bars = [
        { x: cx - r * 0.58, h: size * 0.32 },
        { x: cx - barW / 2, h: size * 0.52 },
        { x: cx + r * 0.58 - barW, h: size * 0.74 },
      ];
      for (const b of bars) {
        ctx.beginPath();
        ctx.roundRect(b.x, baseLineY - b.h, barW, b.h, 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy - r * 0.05);
      ctx.lineTo(cx, cy - r * 0.42);
      ctx.lineTo(cx + r * 0.52, cy - r * 0.78);
      ctx.stroke();
      break;
    }

    case 'lightbulb': {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.16, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.24, cy + r * 0.44);
      ctx.lineTo(cx + r * 0.24, cy + r * 0.44);
      ctx.moveTo(cx - r * 0.18, cy + r * 0.64);
      ctx.lineTo(cx + r * 0.18, cy + r * 0.64);
      ctx.stroke();
      for (const ang of [-Math.PI * 0.85, -Math.PI * 0.5, -Math.PI * 0.15]) {
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(ang) * r * 0.64,
          cy - r * 0.16 + Math.sin(ang) * r * 0.64
        );
        ctx.lineTo(
          cx + Math.cos(ang) * r * 0.86,
          cy - r * 0.16 + Math.sin(ang) * r * 0.86
        );
        ctx.stroke();
      }
      break;
    }

    case 'camera': {
      const w = size * 0.86;
      const h = size * 0.64;
      const x = cx - w / 2;
      const y = cy - h / 2 + 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 2, r * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.22, y);
      ctx.lineTo(cx - w * 0.12, y - 5);
      ctx.lineTo(cx + w * 0.12, y - 5);
      ctx.lineTo(cx + w * 0.22, y);
      ctx.stroke();
      break;
    }

    case 'star': {
      const spikes = 5;
      const outer = r * 0.84;
      const inner = r * 0.38;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'link': {
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      const pillW = size * 0.52;
      const pillH = size * 0.32;
      ctx.beginPath();
      ctx.roundRect(-pillW * 0.75, -pillH / 2, pillW, pillH, pillH / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-pillW * 0.25, -pillH / 2, pillW, pillH, pillH / 2);
      ctx.stroke();
      break;
    }

    case 'check': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(2.2, size * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.36, cy + r * 0.02);
      ctx.lineTo(cx - r * 0.08, cy + r * 0.32);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.26);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillHex?: string,
  strokeHex?: string,
  lineWidth = 1.8
): void {
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

  if (fillHex) {
    ctx.fillStyle = fillHex;
    ctx.fill();
  }
  if (strokeHex) {
    ctx.strokeStyle = strokeHex;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawRotatedDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfDiagonal: number,
  fillHex: string,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillHex;
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfDiagonal);
  ctx.lineTo(cx + halfDiagonal, cy);
  ctx.lineTo(cx, cy + halfDiagonal);
  ctx.lineTo(cx - halfDiagonal, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiagonalStripe(
  ctx: CanvasRenderingContext2D,
  xTop: number,
  yTop: number,
  xBottom: number,
  yBottom: number,
  thickness: number,
  fillHex: string,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillHex;
  ctx.beginPath();
  ctx.moveTo(xTop, yTop);
  ctx.lineTo(xTop + thickness, yTop);
  ctx.lineTo(xBottom + thickness, yBottom);
  ctx.lineTo(xBottom, yBottom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================================
// CORE TEXT MEASUREMENT & ARABIC WRAPPING ENGINE
// ============================================================================

/**
 * Measures the width of an Arabic/mixed string in pixels.
 * Uses real 2D canvas font measurement when `ctx` is provided, or a calibrated
 * Tajawal glyph width model in headless Node.js unit tests.
 */
export function measureArabicTextWidth(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  fontSizePx = 19,
  isBold = false
): number {
  const str = String(text || '');
  if (!str) return 0;
  if (ctx) {
    ctx.font = `${isBold ? 'bold' : '600'} ${fontSizePx}px "Tajawal", sans-serif`;
    return ctx.measureText(str).width;
  }
  // Calibrated average character width for Tajawal font in Arabic (~78 chars per 1048px at 19px)
  const weightFactor = isBold ? 0.68 : 0.695;
  return str.length * fontSizePx * weightFactor;
}

/**
 * Breaks a single unbroken ultra-long word/token into chunks that each fit within `maxWidth`.
 */
function splitOversizedToken(
  ctx: CanvasRenderingContext2D | null,
  token: string,
  maxWidth: number,
  fontSizePx: number,
  isBold: boolean
): string[] {
  if (measureArabicTextWidth(ctx, token, fontSizePx, isBold) <= maxWidth) {
    return [token];
  }
  const chunks: string[] = [];
  let current = '';
  for (const ch of token) {
    const candidate = current + ch;
    if (
      measureArabicTextWidth(ctx, candidate, fontSizePx, isBold) > maxWidth &&
      current.length > 0
    ) {
      chunks.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [token];
}

/**
 * Wraps Arabic/mixed text into lines that strictly fit within `maxWidth` without
 * any truncation or ellipsis (`...`).
 */
export function wrapCanvasLines(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  maxWidth: number,
  fontSizePx = 19,
  isBold = false
): string[] {
  const safeMaxW = Math.max(40, maxWidth);
  const rawParagraphs = String(text || '—').split(/\r?\n/);
  const allLines: string[] = [];

  if (ctx) {
    ctx.font = `${isBold ? 'bold' : '600'} ${fontSizePx}px "Tajawal", sans-serif`;
  }

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const rawWords = trimmed.split(/\s+/);
    const words: string[] = [];
    for (const rw of rawWords) {
      words.push(...splitOversizedToken(ctx, rw, safeMaxW, fontSizePx, isBold));
    }

    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const w = measureArabicTextWidth(ctx, testLine, fontSizePx, isBold);
      if (w > safeMaxW && currentLine) {
        allLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines.length > 0 ? allLines : ['—'];
}

export interface BoundedTextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  totalHeight: number;
  maxLineWidth: number;
}

/**
 * Balances a 2-line Arabic title so the two lines have visually harmonious lengths
 * whenever splitting the words near the middle fits within `maxWidth`.
 */
function tryBalancedTwoLineSplit(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  maxWidth: number,
  fontSizePx: number,
  isBold: boolean
): string[] | null {
  const clean = text.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  if (words.length < 2) return null;

  let bestPair: [string, string] | null = null;
  let bestDiff = Infinity;

  for (let splitIdx = 1; splitIdx < words.length; splitIdx++) {
    const line1 = words.slice(0, splitIdx).join(' ');
    const line2 = words.slice(splitIdx).join(' ');
    const w1 = measureArabicTextWidth(ctx, line1, fontSizePx, isBold);
    const w2 = measureArabicTextWidth(ctx, line2, fontSizePx, isBold);
    if (w1 <= maxWidth && w2 <= maxWidth) {
      const diff = Math.abs(w1 - w2);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPair = [line1, line2];
      }
    }
  }

  return bestPair;
}

/**
 * Layouts a title, heading, or bounded header string within `maxWidth`:
 * 1. Tries fitting on 1 line by stepping font size down gently (by at most `singleLineShrinkAllowance` px).
 * 2. If still wider than `maxWidth`, wraps into 2 balanced lines (or more if very long) while stepping font size
 *    within `[minFontSize, preferredFontSize]` so text is never tiny, never clipped, and never leaves its zone.
 */
export function fitAndWrapBoundedText(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  options: {
    maxWidth: number;
    preferredFontSize: number;
    minFontSize: number;
    singleLineShrinkAllowance?: number;
    lineHeightRatio?: number;
    isBold?: boolean;
    preferBalancedTwoLines?: boolean;
  }
): BoundedTextLayout {
  const cleanText = String(text || '—').trim() || '—';
  const maxWidth = Math.max(60, options.maxWidth);
  const preferred = options.preferredFontSize;
  const minSize = Math.min(preferred, options.minFontSize);
  const shrinkAllowance = options.singleLineShrinkAllowance ?? 3;
  const lineHeightRatio = options.lineHeightRatio ?? 1.32;
  const isBold = options.isBold ?? true;
  const preferBalanced = options.preferBalancedTwoLines ?? true;

  // Step 1: Try fitting on a single line with only minor font size reduction
  const minSingleLineFont = Math.max(minSize, preferred - shrinkAllowance);
  for (let fs = preferred; fs >= minSingleLineFont; fs -= 1) {
    if (!cleanText.includes('\n')) {
      const w = measureArabicTextWidth(ctx, cleanText, fs, isBold);
      if (w <= maxWidth) {
        const lh = Math.round(fs * lineHeightRatio);
        return {
          lines: [cleanText],
          fontSize: fs,
          lineHeight: lh,
          totalHeight: lh,
          maxLineWidth: w,
        };
      }
    }
  }

  // Step 2: Try fitting cleanly on 2 lines (preferring balanced 2-line split)
  const twoLineStartFont = Math.max(minSize, preferred - 2);
  for (let fs = twoLineStartFont; fs >= minSize; fs -= 1) {
    if (!cleanText.includes('\n') && preferBalanced) {
      const balanced = tryBalancedTwoLineSplit(
        ctx,
        cleanText,
        maxWidth,
        fs,
        isBold
      );
      if (balanced) {
        const lh = Math.round(fs * lineHeightRatio);
        const w1 = measureArabicTextWidth(ctx, balanced[0], fs, isBold);
        const w2 = measureArabicTextWidth(ctx, balanced[1], fs, isBold);
        return {
          lines: balanced,
          fontSize: fs,
          lineHeight: lh,
          totalHeight: balanced.length * lh,
          maxLineWidth: Math.max(w1, w2),
        };
      }
    }

    const wrapped = wrapCanvasLines(ctx, cleanText, maxWidth, fs, isBold);
    if (wrapped.length <= 2) {
      const lh = Math.round(fs * lineHeightRatio);
      const maxW = wrapped.reduce(
        (m, ln) => Math.max(m, measureArabicTextWidth(ctx, ln, fs, isBold)),
        0
      );
      return {
        lines: wrapped,
        fontSize: fs,
        lineHeight: lh,
        totalHeight: wrapped.length * lh,
        maxLineWidth: maxW,
      };
    }
  }

  // Step 3: For very long titles (3+ lines), wrap at `minSize` without ever clipping
  const wrappedAtMin = wrapCanvasLines(
    ctx,
    cleanText,
    maxWidth,
    minSize,
    isBold
  );
  const lh = Math.round(minSize * lineHeightRatio);
  const maxW = wrappedAtMin.reduce(
    (m, ln) => Math.max(m, measureArabicTextWidth(ctx, ln, minSize, isBold)),
    0
  );
  return {
    lines: wrappedAtMin,
    fontSize: minSize,
    lineHeight: lh,
    totalHeight: wrappedAtMin.length * lh,
    maxLineWidth: maxW,
  };
}

/**
 * Draws the exact top & bottom decorative ornaments for the 3 templates:
 * 1. `waves` (قالب 1)
 * 2. `waves-2` (قالب 2)
 * 3. `geometric` (قالب 3)
 */
export function drawReferenceTemplateOrnaments(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  pageH: number,
  templateStyle: TeacherPdfTemplateStyle,
  palette: TeacherColorPalette,
  headerBackdropBottomY?: number
): void {
  ctx.save();

  if (templateStyle === 'waves') {
    // =========================================================================
    // TEMPLATE 1 (قالب 1)
    // Top-left corner multi-layered sweeping waves + Bottom full-width layered waves
    // =========================================================================
    ctx.fillStyle = palette.lightRibbonHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(395, 0);
    ctx.bezierCurveTo(300, 72, 165, 168, 0, 194);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.midToneHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(305, 0);
    ctx.bezierCurveTo(225, 64, 128, 144, 0, 164);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(225, 0);
    ctx.bezierCurveTo(175, 58, 96, 124, 0, 142);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(208, 0);
    ctx.bezierCurveTo(160, 52, 86, 114, 0, 132);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.secondaryHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(156, 0);
    ctx.bezierCurveTo(118, 42, 62, 92, 0, 108);
    ctx.closePath();
    ctx.fill();

    // Bottom Multi-Layered Sweeping Waves across the full width
    ctx.fillStyle = palette.lightRibbonHex;
    ctx.beginPath();
    ctx.moveTo(0, pageH);
    ctx.lineTo(0, pageH - 118);
    ctx.bezierCurveTo(
      pageW * 0.28,
      pageH - 76,
      pageW * 0.62,
      pageH - 48,
      pageW,
      pageH - 154
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(pageW * 0.56, pageH);
    ctx.bezierCurveTo(
      pageW * 0.72,
      pageH - 64,
      pageW * 0.86,
      pageH - 108,
      pageW,
      pageH - 128
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.midToneHex;
    ctx.beginPath();
    ctx.moveTo(pageW * 0.58, pageH);
    ctx.bezierCurveTo(
      pageW * 0.74,
      pageH - 58,
      pageW * 0.87,
      pageH - 100,
      pageW,
      pageH - 120
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pageW * 0.68, pageH);
    ctx.bezierCurveTo(
      pageW * 0.8,
      pageH - 44,
      pageW * 0.9,
      pageH - 76,
      pageW,
      pageH - 92
    );
    ctx.stroke();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(pageW * 0.69, pageH);
    ctx.bezierCurveTo(
      pageW * 0.81,
      pageH - 40,
      pageW * 0.91,
      pageH - 70,
      pageW,
      pageH - 86
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.secondaryHex;
    ctx.beginPath();
    ctx.moveTo(0, pageH);
    ctx.lineTo(0, pageH - 80);
    ctx.bezierCurveTo(
      pageW * 0.24,
      pageH - 54,
      pageW * 0.46,
      pageH - 22,
      pageW * 0.66,
      pageH
    );
    ctx.closePath();
    ctx.fill();
  } else if (templateStyle === 'waves-2') {
    // =========================================================================
    // TEMPLATE 2 (قالب 2)
    // Top-down flowing corner waves anchored at the top edge (y = 0)
    // + Dynamic soft header backdrop + Full-width flowing bottom waves
    // =========================================================================
    const backdropY = Math.max(182, headerBackdropBottomY ?? 182);

    ctx.fillStyle = palette.cardBgHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(pageW, 0);
    ctx.lineTo(pageW, backdropY - 2);
    ctx.bezierCurveTo(
      pageW * 0.72,
      backdropY + 12,
      pageW * 0.28,
      backdropY + 12,
      0,
      backdropY - 2
    );
    ctx.closePath();
    ctx.fill();

    // Top-Left multi-layered wave ribbons
    ctx.fillStyle = palette.softToneHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(335, 0);
    ctx.bezierCurveTo(195, 10, 88, 60, 0, 114);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.midToneHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(300, 0);
    ctx.bezierCurveTo(172, 8, 76, 46, 0, 92);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(270, 0);
    ctx.bezierCurveTo(154, 7, 66, 36, 0, 72);
    ctx.stroke();

    ctx.fillStyle = palette.secondaryHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(265, 0);
    ctx.bezierCurveTo(150, 6, 64, 34, 0, 68);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(305, 0);
    ctx.bezierCurveTo(178, 4, 74, 18, 0, 40);
    ctx.closePath();
    ctx.fill();

    // Top-Right multi-layered wave ribbons
    ctx.fillStyle = palette.softToneHex;
    ctx.beginPath();
    ctx.moveTo(pageW, 0);
    ctx.lineTo(pageW - 295, 0);
    ctx.bezierCurveTo(pageW - 165, 8, pageW - 68, 46, pageW, 92);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(pageW, 0);
    ctx.lineTo(pageW - 260, 0);
    ctx.bezierCurveTo(pageW - 145, 6, pageW - 58, 32, pageW, 66);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pageW - 230, 0);
    ctx.bezierCurveTo(pageW - 128, 5, pageW - 50, 22, pageW, 46);
    ctx.stroke();

    ctx.fillStyle = palette.secondaryHex;
    ctx.beginPath();
    ctx.moveTo(pageW, 0);
    ctx.lineTo(pageW - 225, 0);
    ctx.bezierCurveTo(pageW - 124, 4, pageW - 48, 20, pageW, 42);
    ctx.closePath();
    ctx.fill();

    // Subtle lower border curve of the header backdrop
    ctx.strokeStyle = palette.borderHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, backdropY);
    ctx.bezierCurveTo(
      pageW * 0.3,
      backdropY + 12,
      pageW * 0.7,
      backdropY + 12,
      pageW - 64,
      backdropY
    );
    ctx.stroke();

    // Bottom Full-Width Multi-Layered Waves
    ctx.fillStyle = palette.lightRibbonHex;
    ctx.beginPath();
    ctx.moveTo(0, pageH);
    ctx.lineTo(0, pageH - 42);
    ctx.bezierCurveTo(
      pageW * 0.35,
      pageH - 18,
      pageW * 0.62,
      pageH - 138,
      pageW,
      pageH - 108
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(pageW * 0.36, pageH);
    ctx.bezierCurveTo(
      pageW * 0.58,
      pageH - 86,
      pageW * 0.78,
      pageH - 118,
      pageW,
      pageH - 96
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pageW * 0.42, pageH);
    ctx.bezierCurveTo(
      pageW * 0.64,
      pageH - 64,
      pageW * 0.82,
      pageH - 86,
      pageW,
      pageH - 62
    );
    ctx.stroke();

    ctx.fillStyle = palette.secondaryHex;
    ctx.beginPath();
    ctx.moveTo(0, pageH);
    ctx.lineTo(0, pageH - 26);
    ctx.bezierCurveTo(
      pageW * 0.22,
      pageH - 4,
      pageW * 0.45,
      pageH - 12,
      pageW * 0.56,
      pageH - 44
    );
    ctx.bezierCurveTo(
      pageW * 0.72,
      pageH - 82,
      pageW * 0.86,
      pageH - 78,
      pageW,
      pageH - 52
    );
    ctx.lineTo(pageW, pageH);
    ctx.closePath();
    ctx.fill();
  } else {
    // =========================================================================
    // TEMPLATE 3 (قالب 3)
    // 45° Diagonal Geometric Stripes + Overlapping Diamonds in Corners
    // =========================================================================
    drawDiagonalStripe(ctx, -20, 155, 155, -20, 90, palette.lightRibbonHex, 0.55);
    drawDiagonalStripe(ctx, -10, 115, 115, -10, 44, palette.secondaryHex, 1);
    drawDiagonalStripe(ctx, 48, 128, 176, 0, 26, palette.primaryHex, 1);
    drawDiagonalStripe(ctx, 110, 96, 206, 0, 10, palette.secondaryHex, 0.9);

    drawRotatedDiamond(ctx, 46, 52, 28, palette.lightRibbonHex, 0.65);
    drawRotatedDiamond(ctx, 74, 82, 24, palette.softToneHex, 0.75);
    drawRotatedDiamond(ctx, 34, 124, 30, palette.softToneHex, 0.65);
    drawRotatedDiamond(ctx, 64, 154, 24, palette.lightRibbonHex, 0.8);

    // Top-Right Corner Geometric Stripes
    drawDiagonalStripe(
      ctx,
      pageW - 140,
      -10,
      pageW + 10,
      140,
      56,
      palette.lightRibbonHex,
      0.55
    );
    drawDiagonalStripe(
      ctx,
      pageW - 72,
      -10,
      pageW + 10,
      72,
      36,
      palette.midToneHex,
      0.85
    );
    drawRotatedDiamond(ctx, pageW - 36, 48, 22, palette.softToneHex, 0.6);

    // Bottom-Right Corner Geometric Stripes & Diamonds
    drawDiagonalStripe(
      ctx,
      pageW - 260,
      pageH + 10,
      pageW + 10,
      pageH - 260,
      95,
      palette.lightRibbonHex,
      0.5
    );
    drawDiagonalStripe(
      ctx,
      pageW - 195,
      pageH + 10,
      pageW + 10,
      pageH - 195,
      46,
      palette.primaryHex,
      1
    );
    drawDiagonalStripe(
      ctx,
      pageW - 125,
      pageH + 10,
      pageW + 10,
      pageH - 125,
      42,
      palette.secondaryHex,
      1
    );
    drawDiagonalStripe(
      ctx,
      pageW - 220,
      pageH + 10,
      pageW - 95,
      pageH - 115,
      10,
      palette.secondaryHex,
      0.9
    );

    drawRotatedDiamond(
      ctx,
      pageW - 72,
      pageH - 142,
      26,
      palette.softToneHex,
      0.75
    );
    drawRotatedDiamond(
      ctx,
      pageW - 38,
      pageH - 112,
      22,
      palette.lightRibbonHex,
      0.85
    );
    drawRotatedDiamond(
      ctx,
      pageW - 112,
      pageH - 64,
      24,
      palette.lightRibbonHex,
      0.65
    );
  }

  ctx.restore();
}

// ============================================================================
// UNIFIED HEADER LAYOUT & MEASUREMENT (3 STRICTLY ISOLATED ZONES)
// ============================================================================

interface ComputedHeaderPlan {
  templateStyle: TeacherPdfTemplateStyle;
  headerTopY: number;
  rightLines: Array<{ text: string; fontSize: number; y: number }>;
  rightZoneBottomY: number;
  logoCenterX: number;
  logoTopY: number;
  logoWidthPx: number;
  // Template 1 (`waves`) specific
  wavesDividerY: number;
  wavesTitleLayout: BoundedTextLayout;
  wavesSubtitleLayout: BoundedTextLayout | null;
  wavesAccentBarY: number;
  // Template 2 (`waves-2`) specific
  waves2LeftCenterX: number;
  waves2TitleLayout: BoundedTextLayout;
  waves2TitleTopY: number;
  waves2PillLayout: BoundedTextLayout;
  waves2PillX: number;
  waves2PillY: number;
  waves2PillW: number;
  waves2PillH: number;
  waves2BackdropBottomY: number;
  // Template 3 (`geometric`) specific
  geoLeftCenterX: number;
  geoLeftDividerX: number;
  geoRightDividerX: number;
  geoTitleLayout: BoundedTextLayout;
  geoHorizontalLineY: number;
  geoBannerLayout: BoundedTextLayout;
  geoBannerX: number;
  geoBannerY: number;
  geoBannerW: number;
  geoBannerH: number;
  // Final cursorY after header
  nextCursorY: number;
}

/**
 * Computes the exact non-overlapping geometry of the 3 header zones (Right Official Info,
 * Center Ministry Logo, Left Report Title) and any main title banner below the header.
 */
export function computeReferenceTemplateHeaderPlan(
  ctx: CanvasRenderingContext2D | null,
  pageW: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  settings: SchoolSettings,
  doc: TeacherReportDocument
): ComputedHeaderPlan {
  const eduDeptText =
    settings.educationDepartment?.trim() || 'الإدارة التعليمية';
  const schoolNameText = settings.schoolName?.trim() || 'اسم المدرسة';
  const reportTypeText = doc.reportTypeLabel?.trim() || 'تقرير تنفيذ برنامج';
  const mainTitleText =
    doc.reportMainTitle?.trim() ||
    doc.reportTypeLabel?.trim() ||
    'تقرير تنفيذ برنامج';

  // Right zone safe width:
  // Center logo occupies [482, 758] (and dividers in geometric are at 478 and 762).
  // Right zone is [774, 1170] -> maxWidth = 386px.
  const rightMaxW = templateStyle === 'waves' ? 396 : 380;
  const headerTopY =
    templateStyle === 'waves' ? 52 : templateStyle === 'waves-2' ? 38 : 48;

  const rawRightEntries = [
    { text: 'المملكة العربية السعودية', preferred: 22, min: 18 },
    { text: 'وزارة التعليم', preferred: 21, min: 18 },
    { text: eduDeptText, preferred: 20, min: 15 },
    { text: schoolNameText, preferred: 20, min: 15 },
  ];

  const rightLines: Array<{ text: string; fontSize: number; y: number }> = [];
  let rightCursorY = headerTopY + 4;

  for (const entry of rawRightEntries) {
    const fitted = fitAndWrapBoundedText(ctx, entry.text, {
      maxWidth: rightMaxW,
      preferredFontSize: entry.preferred,
      minFontSize: entry.min,
      singleLineShrinkAllowance: 5,
      lineHeightRatio: 1.32,
      isBold: true,
      preferBalancedTwoLines: true,
    });
    for (const ln of fitted.lines) {
      rightLines.push({
        text: ln,
        fontSize: fitted.fontSize,
        y: rightCursorY,
      });
      rightCursorY += Math.max(26, fitted.lineHeight + 3);
    }
  }
  const rightZoneBottomY = rightCursorY;

  // Dummy defaults for template-specific fields
  const emptyLayout: BoundedTextLayout = {
    lines: [],
    fontSize: 20,
    lineHeight: 26,
    totalHeight: 0,
    maxLineWidth: 0,
  };

  if (templateStyle === 'waves') {
    const wavesDividerY = Math.max(headerTopY + 162, rightZoneBottomY + 14);
    const wavesTitleLayout = fitAndWrapBoundedText(ctx, reportTypeText, {
      maxWidth: contentW - 80,
      preferredFontSize: 36,
      minFontSize: 24,
      singleLineShrinkAllowance: 6,
      lineHeightRatio: 1.3,
      isBold: true,
      preferBalancedTwoLines: true,
    });

    // Show subtitle if mainTitleText is distinct from reportTypeText and not the default placeholder
    const hasDistinctSubtitle =
      Boolean(mainTitleText) &&
      mainTitleText !== reportTypeText &&
      mainTitleText !== 'تقرير تنفيذ برنامج';

    const wavesSubtitleLayout = hasDistinctSubtitle
      ? fitAndWrapBoundedText(ctx, mainTitleText, {
          maxWidth: contentW - 120,
          preferredFontSize: 22,
          minFontSize: 17,
          singleLineShrinkAllowance: 4,
          lineHeightRatio: 1.32,
          isBold: true,
          preferBalancedTwoLines: true,
        })
      : null;

    const titleBlockH =
      wavesTitleLayout.totalHeight +
      (wavesSubtitleLayout ? wavesSubtitleLayout.totalHeight + 8 : 0);
    const wavesAccentBarY = wavesDividerY + 18 + titleBlockH + 14;
    const nextCursorY = wavesAccentBarY + 20;

    return {
      templateStyle,
      headerTopY,
      rightLines,
      rightZoneBottomY,
      logoCenterX: pageW / 2 - 10,
      logoTopY: headerTopY + 2,
      logoWidthPx: 210,
      wavesDividerY,
      wavesTitleLayout,
      wavesSubtitleLayout,
      wavesAccentBarY,
      waves2LeftCenterX: 0,
      waves2TitleLayout: emptyLayout,
      waves2TitleTopY: 0,
      waves2PillLayout: emptyLayout,
      waves2PillX: 0,
      waves2PillY: 0,
      waves2PillW: 0,
      waves2PillH: 0,
      waves2BackdropBottomY: 182,
      geoLeftCenterX: 0,
      geoLeftDividerX: 0,
      geoRightDividerX: 0,
      geoTitleLayout: emptyLayout,
      geoHorizontalLineY: 0,
      geoBannerLayout: emptyLayout,
      geoBannerX: 0,
      geoBannerY: 0,
      geoBannerW: 0,
      geoBannerH: 0,
      nextCursorY,
    };
  }

  if (templateStyle === 'waves-2') {
    // Dedicated independent Left Zone:
    // Title text maxWidth = 250px centered at x = 298 (spanning [173, 423]),
    // keeping generous breathing room from both top-left waves and center Ministry logo (x >= 519).
    const waves2LeftCenterX = 298;
    const titleMaxW = 250;
    const pillOuterMaxW = 296;

    const waves2TitleLayout = fitAndWrapBoundedText(ctx, reportTypeText, {
      maxWidth: titleMaxW,
      preferredFontSize: 27,
      minFontSize: 20,
      singleLineShrinkAllowance: 2,
      lineHeightRatio: 1.28,
      isBold: true,
      preferBalancedTwoLines: true,
    });

    const waves2TitleTopY =
      waves2TitleLayout.lines.length === 1 ? headerTopY + 20 : headerTopY + 10;

    const pillTextRaw =
      mainTitleText !== reportTypeText
        ? mainTitleText.replace(/^تقرير تنفيذ برنامج\s*/, '').trim() ||
          mainTitleText
        : mainTitleText;

    const waves2PillLayout = fitAndWrapBoundedText(ctx, pillTextRaw, {
      maxWidth: pillOuterMaxW - 34,
      preferredFontSize: 18,
      minFontSize: 15,
      singleLineShrinkAllowance: 2,
      lineHeightRatio: 1.28,
      isBold: true,
      preferBalancedTwoLines: true,
    });

    const waves2PillW = Math.min(
      pillOuterMaxW,
      Math.max(200, waves2PillLayout.maxLineWidth + 36)
    );
    const waves2PillH = Math.max(
      40,
      waves2PillLayout.lines.length * waves2PillLayout.lineHeight + 16
    );
    const waves2PillX = waves2LeftCenterX - waves2PillW / 2;
    const waves2PillY =
      waves2TitleTopY + waves2TitleLayout.totalHeight + 8;

    const leftZoneBottomY = waves2PillY + waves2PillH;
    const waves2BackdropBottomY = Math.max(
      182,
      rightZoneBottomY + 14,
      leftZoneBottomY + 14
    );
    const nextCursorY = waves2BackdropBottomY + 34;

    return {
      templateStyle,
      headerTopY,
      rightLines,
      rightZoneBottomY,
      logoCenterX: pageW / 2,
      logoTopY: headerTopY + 2,
      logoWidthPx: 202,
      wavesDividerY: 0,
      wavesTitleLayout: emptyLayout,
      wavesSubtitleLayout: null,
      wavesAccentBarY: 0,
      waves2LeftCenterX,
      waves2TitleLayout,
      waves2TitleTopY,
      waves2PillLayout,
      waves2PillX,
      waves2PillY,
      waves2PillW,
      waves2PillH,
      waves2BackdropBottomY,
      geoLeftCenterX: 0,
      geoLeftDividerX: 0,
      geoRightDividerX: 0,
      geoTitleLayout: emptyLayout,
      geoHorizontalLineY: 0,
      geoBannerLayout: emptyLayout,
      geoBannerX: 0,
      geoBannerY: 0,
      geoBannerW: 0,
      geoBannerH: 0,
      nextCursorY,
    };
  }

  // =========================================================================
  // TEMPLATE 3 (`geometric` / قالب 3):
  // Left Divider at x = 478, Right Divider at x = 762.
  // Dedicated Left Zone: centered at x = 304 with maxWidth = 250px (spanning [179, 429]).
  // Leaves ~50px of clean whitespace before leftDividerX (478) and clears top-left stripes!
  // =========================================================================
  const geoLeftDividerX = pageW / 2 - 142; // 478
  const geoRightDividerX = pageW / 2 + 142; // 762
  const geoLeftMaxW = 250;
  const geoLeftCenterX = 304;

  const geoTitleLayout = fitAndWrapBoundedText(ctx, reportTypeText, {
    maxWidth: geoLeftMaxW,
    preferredFontSize: 27,
    minFontSize: 20,
    singleLineShrinkAllowance: 2,
    lineHeightRatio: 1.32,
    isBold: true,
    preferBalancedTwoLines: true,
  });

  const leftTitleBottomY = headerTopY + 24 + geoTitleLayout.totalHeight;
  const geoHorizontalLineY = Math.max(
    headerTopY + 154,
    rightZoneBottomY + 14,
    leftTitleBottomY + 18
  );

  // Chamfered Dark Main Title Banner below horizontal line
  const geoBannerLayout = fitAndWrapBoundedText(ctx, mainTitleText, {
    maxWidth: 680,
    preferredFontSize: 25,
    minFontSize: 18,
    singleLineShrinkAllowance: 4,
    lineHeightRatio: 1.3,
    isBold: true,
    preferBalancedTwoLines: true,
  });

  const geoBannerW = Math.min(
    780,
    Math.max(580, geoBannerLayout.maxLineWidth + 96)
  );
  const geoBannerH = Math.max(
    54,
    geoBannerLayout.lines.length * geoBannerLayout.lineHeight + 20
  );
  const geoBannerX = (pageW - geoBannerW) / 2;
  const geoBannerY = geoHorizontalLineY + 14;
  const nextCursorY = geoBannerY + geoBannerH + 18;

  return {
    templateStyle,
    headerTopY,
    rightLines,
    rightZoneBottomY,
    logoCenterX: pageW / 2,
    logoTopY: headerTopY + 2,
    logoWidthPx: 198,
    wavesDividerY: 0,
    wavesTitleLayout: emptyLayout,
    wavesSubtitleLayout: null,
    wavesAccentBarY: 0,
    waves2LeftCenterX: 0,
    waves2TitleLayout: emptyLayout,
    waves2TitleTopY: 0,
    waves2PillLayout: emptyLayout,
    waves2PillX: 0,
    waves2PillY: 0,
    waves2PillW: 0,
    waves2PillH: 0,
    waves2BackdropBottomY: 182,
    geoLeftCenterX,
    geoLeftDividerX,
    geoRightDividerX,
    geoTitleLayout,
    geoHorizontalLineY,
    geoBannerLayout,
    geoBannerX,
    geoBannerY,
    geoBannerW,
    geoBannerH,
    nextCursorY,
  };
}

/**
 * Pure height measurement for the header & title banner (used by the paginator).
 */
export function measureReferenceTemplateHeaderHeight(
  ctx: CanvasRenderingContext2D | null,
  pageW: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  settings: SchoolSettings,
  doc: TeacherReportDocument
): number {
  return computeReferenceTemplateHeaderPlan(
    ctx,
    pageW,
    marginX,
    contentW,
    templateStyle,
    settings,
    doc
  ).nextCursorY;
}

/**
 * Draws the header and main title banner according to the active reference template.
 * Returns the next `cursorY` after the header and main title.
 */
export function drawReferenceTemplateHeader(
  ctx: CanvasRenderingContext2D,
  pageW: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  palette: TeacherColorPalette,
  settings: SchoolSettings,
  doc: TeacherReportDocument,
  logoImg: HTMLImageElement | null,
  _isFirstPage: boolean
): number {
  const plan = computeReferenceTemplateHeaderPlan(
    ctx,
    pageW,
    marginX,
    contentW,
    templateStyle,
    settings,
    doc
  );

  // Helper to draw the official Ministry of Education logo in its original colors
  const drawOfficialMinistryLogo = (
    centerX: number,
    topY: number,
    widthPx = 206
  ) => {
    if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
      const cropX = logoImg.width * 0.26;
      const cropY = logoImg.height * 0.31;
      const cropW = logoImg.width * 0.48;
      const cropH = logoImg.height * 0.38;
      const targetH = (cropH / cropW) * widthPx;
      ctx.drawImage(
        logoImg,
        cropX,
        cropY,
        cropW,
        cropH,
        centerX - widthPx / 2,
        topY,
        widthPx,
        targetH
      );
    }
  };

  if (templateStyle === 'waves') {
    const rightAnchorX = pageW - marginX - 10;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.secondaryHex;

    for (const item of plan.rightLines) {
      ctx.font = `bold ${item.fontSize}px "Tajawal", sans-serif`;
      ctx.fillText(item.text, rightAnchorX, item.y);
    }

    // Center Ministry Logo
    drawOfficialMinistryLogo(plan.logoCenterX, plan.logoTopY, plan.logoWidthPx);

    // Full-width horizontal divider line
    ctx.strokeStyle = palette.dividerHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(marginX, plan.wavesDividerY);
    ctx.lineTo(pageW - marginX, plan.wavesDividerY);
    ctx.stroke();

    // Large Centered Main Title (supports 1 or more wrapped lines)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.secondaryHex;
    ctx.font = `bold ${plan.wavesTitleLayout.fontSize}px "Tajawal", sans-serif`;

    let titleY = plan.wavesDividerY + 16;
    for (const ln of plan.wavesTitleLayout.lines) {
      ctx.fillText(ln, pageW / 2, titleY);
      titleY += plan.wavesTitleLayout.lineHeight;
    }

    if (plan.wavesSubtitleLayout && plan.wavesSubtitleLayout.lines.length > 0) {
      titleY += 6;
      ctx.fillStyle = palette.primaryHex;
      ctx.font = `bold ${plan.wavesSubtitleLayout.fontSize}px "Tajawal", sans-serif`;
      for (const subLn of plan.wavesSubtitleLayout.lines) {
        ctx.fillText(subLn, pageW / 2, titleY);
        titleY += plan.wavesSubtitleLayout.lineHeight;
      }
    }

    // Two-tone horizontal bar underneath the title
    const barTotalW = 360;
    const barStartX = (pageW - barTotalW) / 2;
    ctx.fillStyle = palette.softToneHex;
    ctx.fillRect(barStartX, plan.wavesAccentBarY, barTotalW * 0.45, 6);
    ctx.fillStyle = palette.primaryHex;
    ctx.fillRect(
      barStartX + barTotalW * 0.45,
      plan.wavesAccentBarY,
      barTotalW * 0.55,
      6
    );

    ctx.restore();
    return plan.nextCursorY;
  }

  if (templateStyle === 'waves-2') {
    // Right Zone Center: x = 968 (inside [774, 1162])
    const rightCenterX = 968;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.secondaryHex;

    for (const item of plan.rightLines) {
      ctx.font = `bold ${item.fontSize}px "Tajawal", sans-serif`;
      ctx.fillText(item.text, rightCenterX, item.y);
    }

    // Center Ministry Logo
    drawOfficialMinistryLogo(plan.logoCenterX, plan.logoTopY, plan.logoWidthPx);

    // Left Zone: Bounded Report Type Title (1 or 2+ balanced lines inside [136, 464])
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.secondaryHex;
    ctx.font = `bold ${plan.waves2TitleLayout.fontSize}px "Tajawal", sans-serif`;

    let tY = plan.waves2TitleTopY;
    for (const ln of plan.waves2TitleLayout.lines) {
      ctx.fillText(ln, plan.waves2LeftCenterX, tY);
      tY += plan.waves2TitleLayout.lineHeight;
    }

    // Dynamic Rounded Pill Badge under Report Type
    drawRoundedRectPath(
      ctx,
      plan.waves2PillX,
      plan.waves2PillY,
      plan.waves2PillW,
      plan.waves2PillH,
      Math.min(22, plan.waves2PillH / 2),
      palette.headerBgHex,
      palette.borderHex,
      1.5
    );

    ctx.fillStyle = palette.primaryHex;
    ctx.font = `bold ${plan.waves2PillLayout.fontSize}px "Tajawal", sans-serif`;
    ctx.textBaseline = 'middle';
    const pillBlockH =
      plan.waves2PillLayout.lines.length * plan.waves2PillLayout.lineHeight;
    let pillLineCenterY =
      plan.waves2PillY +
      (plan.waves2PillH - pillBlockH) / 2 +
      plan.waves2PillLayout.lineHeight / 2;

    for (const ln of plan.waves2PillLayout.lines) {
      ctx.fillText(ln, plan.waves2LeftCenterX, pillLineCenterY + 1);
      pillLineCenterY += plan.waves2PillLayout.lineHeight;
    }

    ctx.restore();
    return plan.nextCursorY;
  }

  // =========================================================================
  // TEMPLATE 3 HEADER (`geometric` / قالب 3)
  // =========================================================================
  ctx.save();

  // Right column (centered in right zone [776, 1160] -> center = 968)
  const rightColCenterX = 968;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.secondaryHex;

  for (const item of plan.rightLines) {
    ctx.font = `bold ${item.fontSize}px "Tajawal", sans-serif`;
    ctx.fillText(item.text, rightColCenterX, item.y);
  }

  // Two vertical separator lines flanking the Ministry Logo
  ctx.strokeStyle = palette.secondaryHex;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plan.geoLeftDividerX, plan.headerTopY + 6);
  ctx.lineTo(plan.geoLeftDividerX, plan.geoHorizontalLineY - 14);
  ctx.moveTo(plan.geoRightDividerX, plan.headerTopY + 6);
  ctx.lineTo(plan.geoRightDividerX, plan.geoHorizontalLineY - 14);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Center Ministry Logo
  drawOfficialMinistryLogo(plan.logoCenterX, plan.logoTopY, plan.logoWidthPx);

  // Left column: Report Type Name strictly bounded in [142, 462] (center = 302)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.secondaryHex;
  ctx.font = `bold ${plan.geoTitleLayout.fontSize}px "Tajawal", sans-serif`;

  const headerBandTop = plan.headerTopY + 10;
  const headerBandBottom = plan.geoHorizontalLineY - 14;
  const headerBandCenterY = (headerBandTop + headerBandBottom) / 2;
  const totalTitleH =
    plan.geoTitleLayout.lines.length * plan.geoTitleLayout.lineHeight;
  let titleLineCenterY =
    headerBandCenterY -
    totalTitleH / 2 +
    plan.geoTitleLayout.lineHeight / 2;

  for (const ln of plan.geoTitleLayout.lines) {
    ctx.fillText(ln, plan.geoLeftCenterX, titleLineCenterY);
    titleLineCenterY += plan.geoTitleLayout.lineHeight;
  }

  // Full-width horizontal line
  ctx.strokeStyle = palette.primaryHex;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, plan.geoHorizontalLineY);
  ctx.lineTo(pageW, plan.geoHorizontalLineY);
  ctx.stroke();

  // Chamfered Dark Main Title Banner flanked by angled parallelogram slashes (//)
  const { geoBannerX: bannerX, geoBannerY: bannerY, geoBannerW: bannerW, geoBannerH: bannerH } = plan;
  const slant = 28;

  const drawSlash = (
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx + 20, sy);
    ctx.lineTo(sx + sw + 20, sy);
    ctx.lineTo(sx + sw, sy + sh);
    ctx.lineTo(sx, sy + sh);
    ctx.closePath();
    ctx.fill();
  };

  const slashH = Math.min(42, bannerH - 12);
  const slashY = bannerY + (bannerH - slashH) / 2 + 2;

  // Left slashes
  drawSlash(bannerX - 90, slashY, 22, slashH, palette.softToneHex);
  drawSlash(bannerX - 56, slashY, 22, slashH, palette.primaryHex);

  // Right slashes
  drawSlash(bannerX + bannerW + 16, slashY, 22, slashH, palette.primaryHex);
  drawSlash(bannerX + bannerW + 50, slashY, 22, slashH, palette.softToneHex);

  // Center Chamfered Trapezoid Banner
  ctx.fillStyle = palette.secondaryHex;
  ctx.beginPath();
  ctx.moveTo(bannerX + slant, bannerY);
  ctx.lineTo(bannerX + bannerW - slant, bannerY);
  ctx.lineTo(bannerX + bannerW, bannerY + bannerH);
  ctx.lineTo(bannerX, bannerY + bannerH);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${plan.geoBannerLayout.fontSize}px "Tajawal", sans-serif`;

  const totalBannerTextH =
    plan.geoBannerLayout.lines.length * plan.geoBannerLayout.lineHeight;
  let bannerLineCenterY =
    bannerY +
    (bannerH - totalBannerTextH) / 2 +
    plan.geoBannerLayout.lineHeight / 2 +
    1;

  for (const ln of plan.geoBannerLayout.lines) {
    ctx.fillText(ln, pageW / 2, bannerLineCenterY);
    bannerLineCenterY += plan.geoBannerLayout.lineHeight;
  }

  ctx.restore();
  return plan.nextCursorY;
}

// ============================================================================
// DYNAMIC BASIC METADATA FIELDS LAYOUT & MEASUREMENT
// ============================================================================

interface WavesRowCellMeasurement {
  field: TeacherReportBasicField;
  labelLines: string[];
  valueLines: string[];
  requiredHeight: number;
}

interface WavesBasicTablePlan {
  rows: Array<{
    right?: WavesRowCellMeasurement;
    left?: WavesRowCellMeasurement;
    rowH: number;
  }>;
  totalTableH: number;
}

function computeWavesBasicTablePlan(
  ctx: CanvasRenderingContext2D | null,
  contentW: number,
  fields: TeacherReportBasicField[]
): WavesBasicTablePlan {
  const halfW = contentW / 2;
  const labelCellW = 220;
  const labelMaxTextW = labelCellW - 64; // 156px (icon takes right 48px)
  const lineH = 25;

  const measureCell = (
    field: TeacherReportBasicField | undefined,
    isFullRow = false
  ): WavesRowCellMeasurement | undefined => {
    if (!field) return undefined;
    const cellW = isFullRow ? contentW : halfW;
    const valueAreaW = cellW - labelCellW;
    const valueMaxTextW = valueAreaW - 28;
    const labelLines = wrapCanvasLines(
      ctx,
      field.label.trim() || '—',
      labelMaxTextW,
      18,
      true
    );
    const valueLines = wrapCanvasLines(
      ctx,
      field.value?.trim() || '—',
      valueMaxTextW,
      18,
      true
    );
    const maxLines = Math.max(1, labelLines.length, valueLines.length);
    const requiredHeight = Math.max(50, maxLines * lineH + 22);
    return {
      field,
      labelLines,
      valueLines,
      requiredHeight,
    };
  };

  const rowsCount = Math.ceil(fields.length / 2);
  const rows: WavesBasicTablePlan['rows'] = [];
  let totalTableH = 0;

  for (let rIdx = 0; rIdx < rowsCount; rIdx++) {
    const rawRight = fields[rIdx * 2];
    const rawLeft = fields[rIdx * 2 + 1];
    const isFullRow = Boolean(rawRight && !rawLeft);
    const right = measureCell(rawRight, isFullRow);
    const left = measureCell(rawLeft, false);
    const rowH = Math.max(
      50,
      right?.requiredHeight ?? 50,
      left?.requiredHeight ?? 50
    );
    rows.push({ right, left, rowH });
    totalTableH += rowH;
  }

  return { rows, totalTableH };
}

interface HorizontalBarCellMeasurement {
  field: TeacherReportBasicField;
  labelLines: string[];
  valueLines: string[];
  requiredHeight: number;
}

interface HorizontalBarRowPlan {
  cells: HorizontalBarCellMeasurement[];
  colsCount: number;
  colW: number;
  rowH: number;
}

interface HorizontalBarPlan {
  rows: HorizontalBarRowPlan[];
  totalBarH: number;
}

function computeHorizontalMetadataBarPlan(
  ctx: CanvasRenderingContext2D | null,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  fields: TeacherReportBasicField[]
): HorizontalBarPlan {
  const maxColsPerRow = templateStyle === 'waves-2' ? 3 : 4;
  const fieldChunks: TeacherReportBasicField[][] = [];

  if (fields.length <= maxColsPerRow) {
    fieldChunks.push(fields);
  } else if (fields.length <= maxColsPerRow * 2) {
    // Balance fields cleanly across 2 rows (e.g. 5 -> 3 + 2, 6 -> 3 + 3, 7 -> 4 + 3)
    const firstRowCount = Math.min(
      maxColsPerRow,
      Math.ceil(fields.length / 2)
    );
    fieldChunks.push(fields.slice(0, firstRowCount));
    fieldChunks.push(fields.slice(firstRowCount));
  } else {
    for (let i = 0; i < fields.length; i += maxColsPerRow) {
      fieldChunks.push(fields.slice(i, i + maxColsPerRow));
    }
  }

  const labelLineH = 22;
  const valueLineH = 22;
  let totalBarH = 0;

  const rows: HorizontalBarRowPlan[] = fieldChunks.map((rowFields) => {
    const colsCount = Math.max(1, rowFields.length);
    const colW = contentW / colsCount;
    const textMaxW = Math.max(90, colW - 72);

    const cells: HorizontalBarCellMeasurement[] = rowFields.map((field) => {
      const labelLines = wrapCanvasLines(
        ctx,
        field.label.trim() || '—',
        textMaxW,
        17,
        true
      );
      const valueLines = wrapCanvasLines(
        ctx,
        field.value?.trim() || '—',
        textMaxW,
        16.5,
        true
      );
      const minRowH = fieldChunks.length > 1 ? 72 : 82;
      const contentH =
        labelLines.length * labelLineH +
        5 +
        valueLines.length * valueLineH +
        22;
      return {
        field,
        labelLines,
        valueLines,
        requiredHeight: Math.max(minRowH, contentH),
      };
    });

    const minRowH = fieldChunks.length > 1 ? 72 : 82;
    const rowH = cells.reduce(
      (maxH, c) => Math.max(maxH, c.requiredHeight),
      minRowH
    );
    totalBarH += rowH;
    return { cells, colsCount, colW, rowH };
  });

  return { rows, totalBarH };
}

/**
 * Pure height measurement for the `basic-fields` block (used by the paginator).
 */
export function measureReferenceTemplateBasicFieldsHeight(
  ctx: CanvasRenderingContext2D | null,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  fields: TeacherReportBasicField[]
): number {
  if (!fields || fields.length === 0) return 0;
  if (templateStyle === 'waves') {
    const plan = computeWavesBasicTablePlan(ctx, contentW, fields);
    return plan.totalTableH + 22;
  }
  const barPlan = computeHorizontalMetadataBarPlan(
    ctx,
    contentW,
    templateStyle,
    fields
  );
  return barPlan.totalBarH + 18;
}

/**
 * Draws the Basic Metadata Fields block according to the active reference template
 * with dynamic row/bar height and full Arabic line wrapping (zero truncation).
 */
export function drawReferenceTemplateBasicFields(
  ctx: CanvasRenderingContext2D,
  cursorY: number,
  _pageW: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  palette: TeacherColorPalette,
  fields: TeacherReportBasicField[]
): number {
  if (!fields || fields.length === 0) return cursorY;

  ctx.save();

  if (templateStyle === 'waves') {
    const plan = computeWavesBasicTablePlan(ctx, contentW, fields);
    const tableH = plan.totalTableH;
    const halfW = contentW / 2;
    const labelCellW = 220;
    const r = 16;
    const lineH = 25;

    ctx.save();
    drawRoundedRectPath(ctx, marginX, cursorY, contentW, tableH, r, '#FFFFFF');
    ctx.clip();

    // Right-half shaded label column (always present on all rows)
    ctx.fillStyle = palette.headerBgHex;
    ctx.fillRect(marginX + contentW - labelCellW, cursorY, labelCellW, tableH);

    let rowTopY = cursorY;
    plan.rows.forEach((rowPlan, rIdx) => {
      const { rowH, right, left } = rowPlan;
      const midY = rowTopY + rowH / 2;
      const isSingleFullRow = Boolean(right && !left);

      // Left-half shaded label column only for two-column rows
      if (!isSingleFullRow) {
        ctx.fillStyle = palette.headerBgHex;
        ctx.fillRect(marginX + halfW - labelCellW, rowTopY, labelCellW, rowH);
      }

      if (rIdx > 0) {
        ctx.strokeStyle = palette.borderHex;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(marginX, rowTopY);
        ctx.lineTo(marginX + contentW, rowTopY);
        ctx.stroke();
      }

      const drawRowCell = (
        cell: WavesRowCellMeasurement | undefined,
        cellStartX: number,
        cellWidth: number,
        idxSeed: number
      ) => {
        if (!cell) return;
        const labelRightX = cellStartX + cellWidth;
        const labelLeftX = labelRightX - labelCellW;
        const valueAreaW = cellWidth - labelCellW;

        // Icon on the right of the shaded label cell
        const iconKind = resolveIconForLabel(cell.field.label, idxSeed);
        drawTeacherVectorIcon(
          ctx,
          iconKind,
          labelRightX - 26,
          midY,
          23,
          palette.secondaryHex
        );

        // Multi-line Label text to the left of the icon
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = palette.secondaryHex;
        ctx.font = 'bold 18px "Tajawal", sans-serif';

        const totalLabelH = cell.labelLines.length * lineH;
        let labelLineY = midY - totalLabelH / 2 + lineH / 2 + 1;
        for (const ln of cell.labelLines) {
          ctx.fillText(ln, labelRightX - 50, labelLineY);
          labelLineY += lineH;
        }

        // Vertical thin separator between label cell and value cell
        ctx.strokeStyle = palette.borderHex;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(labelLeftX, rowTopY);
        ctx.lineTo(labelLeftX, rowTopY + rowH);
        ctx.stroke();

        // Multi-line Value text inside the white cell (never truncated)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 18px "Tajawal", sans-serif';

        const totalValueH = cell.valueLines.length * lineH;
        let valLineY = midY - totalValueH / 2 + lineH / 2 + 1;
        for (const ln of cell.valueLines) {
          ctx.fillText(ln, cellStartX + valueAreaW / 2, valLineY);
          valLineY += lineH;
        }
      };

      if (isSingleFullRow) {
        drawRowCell(right, marginX, contentW, rIdx * 2);
      } else {
        drawRowCell(right, marginX + halfW, halfW, rIdx * 2);
        drawRowCell(left, marginX, halfW, rIdx * 2 + 1);

        // Center vertical divider between right half and left half for this two-column row
        ctx.strokeStyle = palette.borderHex;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(marginX + halfW, rowTopY);
        ctx.lineTo(marginX + halfW, rowTopY + rowH);
        ctx.stroke();
      }

      rowTopY += rowH;
    });

    ctx.restore();

    // Outer rounded border
    drawRoundedRectPath(
      ctx,
      marginX,
      cursorY,
      contentW,
      tableH,
      r,
      undefined,
      palette.borderHex,
      2
    );

    ctx.restore();
    return cursorY + tableH + 22;
  }

  // =========================================================================
  // TEMPLATE 2 (`waves-2` / قالب 2) & TEMPLATE 3 (`geometric` / قالب 3):
  // Dynamic-Height Multi-Row Horizontal Rounded Metadata Bar
  // =========================================================================
  const barPlan = computeHorizontalMetadataBarPlan(
    ctx,
    contentW,
    templateStyle,
    fields
  );
  const { rows, totalBarH } = barPlan;
  const r = 16;
  const labelLineH = 22;
  const valueLineH = 22;

  drawRoundedRectPath(
    ctx,
    marginX,
    cursorY,
    contentW,
    totalBarH,
    r,
    palette.headerBgHex,
    palette.borderHex,
    1.8
  );

  let rowCursorY = cursorY;
  let runningFieldSeed = 0;

  rows.forEach((rowPlan, rowIdx) => {
    const { cells, colW, rowH } = rowPlan;

    if (rowIdx > 0) {
      ctx.strokeStyle = palette.borderHex;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(marginX + 16, rowCursorY);
      ctx.lineTo(marginX + contentW - 16, rowCursorY);
      ctx.stroke();
    }

    cells.forEach((cell, idx) => {
      const colRightX = marginX + contentW - idx * colW;
      const colLeftX = colRightX - colW;

      if (idx > 0) {
        ctx.strokeStyle = palette.borderHex;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(colRightX, rowCursorY + 12);
        ctx.lineTo(colRightX, rowCursorY + rowH - 12);
        ctx.stroke();
      }

      const iconKind = resolveIconForLabel(
        cell.field.label,
        runningFieldSeed++
      );
      const iconCenterX = colRightX - 30;
      const iconCenterY = rowCursorY + rowH / 2;

      drawTeacherVectorIcon(
        ctx,
        iconKind,
        iconCenterX,
        iconCenterY,
        28,
        palette.secondaryHex
      );

      // Text area sits to the left of the icon with 12px left margin and 56px right margin
      const textAreaLeftX = colLeftX + 12;
      const textAreaRightX = colRightX - 56;
      const textAreaCenterX = (textAreaLeftX + textAreaRightX) / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const totalTextH =
        cell.labelLines.length * labelLineH +
        5 +
        cell.valueLines.length * valueLineH;
      let lineY = rowCursorY + (rowH - totalTextH) / 2 + labelLineH / 2;

      ctx.fillStyle = palette.secondaryHex;
      ctx.font = 'bold 17px "Tajawal", sans-serif';
      for (const ln of cell.labelLines) {
        ctx.fillText(ln, textAreaCenterX, lineY);
        lineY += labelLineH;
      }

      lineY += 5;
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 16.5px "Tajawal", sans-serif';
      for (const ln of cell.valueLines) {
        ctx.fillText(ln, textAreaCenterX, lineY);
        lineY += valueLineH;
      }
    });

    rowCursorY += rowH;
  });

  ctx.restore();
  return cursorY + totalBarH + 18;
}

// ============================================================================
// DYNAMIC CONTENT SECTIONS (TEXT, LIST, FIELDS) LAYOUT & MEASUREMENT
// ============================================================================

interface SubFieldCellPlan {
  field: TeacherReportBasicField;
  lines: string[];
  isFullWidth: boolean;
  boxW: number;
}

interface SubFieldRowPlan {
  cells: SubFieldCellPlan[];
  rowH: number;
}

interface AttendanceTableRowPlan {
  row: TeacherReportAttendanceRow;
  nameLines: string[];
  rowH: number;
}

interface SectionMeasurementPlan {
  tabTitleLayout: BoundedTextLayout;
  tabW: number;
  tabH: number;
  bodyContentH: number;
  wrappedParagraphLines: string[];
  wrappedListItems: string[][];
  subFieldRows: SubFieldRowPlan[];
  attendanceTableRows: AttendanceTableRowPlan[];
  totalSectionAdvanceY: number;
}

function computeSectionMeasurementPlan(
  ctx: CanvasRenderingContext2D | null,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  section: TeacherReportContentSection
): SectionMeasurementPlan {
  const lineH = 34;

  // 1. Measure dynamic section tab title (expands width for medium titles, wraps to 2 lines if very long)
  const maxAllowedTabW = Math.min(contentW - 60, 560);
  const minTabW = templateStyle === 'waves' ? 310 : 325;
  const tabTitleLayout = fitAndWrapBoundedText(ctx, section.title, {
    maxWidth: maxAllowedTabW - 76,
    preferredFontSize: templateStyle === 'waves' ? 21 : 20,
    minFontSize: 17,
    singleLineShrinkAllowance: 3,
    lineHeightRatio: 1.25,
    isBold: true,
    preferBalancedTwoLines: true,
  });

  const tabW = Math.min(
    maxAllowedTabW,
    Math.max(minTabW, tabTitleLayout.maxLineWidth + 78)
  );
  const baseTabH = templateStyle === 'waves' ? 46 : 44;
  const tabH =
    tabTitleLayout.lines.length <= 1
      ? baseTabH
      : Math.max(baseTabH, tabTitleLayout.totalHeight + 18);

  // 2. Measure body content height
  let bodyContentH = 68;
  let wrappedParagraphLines: string[] = [];
  let wrappedListItems: string[][] = [];
  const subFieldRows: SubFieldRowPlan[] = [];
  const attendanceTableRows: AttendanceTableRowPlan[] = [];

  if (section.type === 'text') {
    wrappedParagraphLines = wrapCanvasLines(
      ctx,
      section.content || '—',
      contentW - 64,
      19,
      false
    );
    bodyContentH = Math.max(62, wrappedParagraphLines.length * lineH + 22);
  } else if (section.type === 'list') {
    const rawItems = (section.items || []).filter((i) => i.trim().length > 0);
    wrappedListItems = rawItems.map((item) =>
      wrapCanvasLines(ctx, item, contentW - 92, 19, false)
    );
    const totalLines = wrappedListItems.reduce((s, arr) => s + arr.length, 0);
    bodyContentH = Math.max(
      62,
      totalLines * lineH + Math.max(0, wrappedListItems.length - 1) * 4 + 22
    );
  } else if (
    section.type === 'attendance-table' &&
    Array.isArray(section.attendanceRows)
  ) {
    const padX = templateStyle === 'waves' ? 28 : 24;
    const tableW = contentW - padX * 2;
    const colIndexW = 96;
    const colNameW = Math.round((tableW - colIndexW) * 0.56);
    const nameMaxTextW = colNameW - 36;
    const headerH = 52;
    const nameLineH = 26;

    for (const r of section.attendanceRows) {
      const nameLines = wrapCanvasLines(
        ctx,
        r.name.trim() || '—',
        nameMaxTextW,
        18.5,
        true
      );
      const rowH = Math.max(58, nameLines.length * nameLineH + 26);
      attendanceTableRows.push({
        row: r,
        nameLines,
        rowH,
      });
    }

    const totalDataRowsH = attendanceTableRows.reduce(
      (sum, item) => sum + item.rowH,
      0
    );
    bodyContentH = Math.max(110, headerH + totalDataRowsH + 28);
  } else if (section.type === 'fields' && section.fields) {
    const padX = templateStyle === 'waves' ? 28 : 24;
    const subGap = 20;
    const fullRowW = contentW - padX * 2;
    const halfColW = (fullRowW - subGap) / 2;
    const subFieldLineH = 26;

    // Pair fields into rows (a field with width === 'full' or isLongText takes a full row)
    let idx = 0;
    const allFields = section.fields;
    while (idx < allFields.length) {
      const f1 = allFields[idx];
      const f1Text = f1.isSignatureSpace
        ? `${f1.label}:`
        : `${f1.label}: ${f1.value?.trim() || '—'}`;
      const f1NeedsFull =
        f1.width === 'full' || Boolean(f1.isLongText);

      if (f1NeedsFull) {
        const lines1 = wrapCanvasLines(
          ctx,
          f1Text,
          fullRowW - 32,
          18,
          true
        );
        const minH = f1.isSignatureSpace ? 58 : 50;
        const rowH = Math.max(minH, lines1.length * subFieldLineH + 20);
        subFieldRows.push({
          cells: [
            {
              field: f1,
              lines: lines1,
              isFullWidth: true,
              boxW: fullRowW,
            },
          ],
          rowH,
        });
        idx += 1;
      } else if (
        idx + 1 < allFields.length &&
        allFields[idx + 1].width !== 'full' &&
        !allFields[idx + 1].isLongText
      ) {
        const f2 = allFields[idx + 1];
        const f2Text = f2.isSignatureSpace
          ? `${f2.label}:`
          : `${f2.label}: ${f2.value?.trim() || '—'}`;
        const lines1 = wrapCanvasLines(
          ctx,
          f1Text,
          halfColW - 28,
          18,
          true
        );
        const lines2 = wrapCanvasLines(
          ctx,
          f2Text,
          halfColW - 28,
          18,
          true
        );
        const minH = f1.isSignatureSpace || f2.isSignatureSpace ? 58 : 50;
        const h1 = Math.max(minH, lines1.length * subFieldLineH + 20);
        const h2 = Math.max(minH, lines2.length * subFieldLineH + 20);
        const rowH = Math.max(h1, h2);
        subFieldRows.push({
          cells: [
            {
              field: f1,
              lines: lines1,
              isFullWidth: false,
              boxW: halfColW,
            },
            {
              field: f2,
              lines: lines2,
              isFullWidth: false,
              boxW: halfColW,
            },
          ],
          rowH,
        });
        idx += 2;
      } else {
        // Last odd field in the list: if its text is long (> 1 line in halfColW), give it fullRowW for balanced layout, else halfColW
        const linesHalf = wrapCanvasLines(
          ctx,
          f1Text,
          halfColW - 28,
          18,
          true
        );
        const minH = f1.isSignatureSpace ? 58 : 50;
        if (linesHalf.length > 1) {
          const linesFull = wrapCanvasLines(
            ctx,
            f1Text,
            fullRowW - 32,
            18,
            true
          );
          const rowH = Math.max(minH, linesFull.length * subFieldLineH + 20);
          subFieldRows.push({
            cells: [
              {
                field: f1,
                lines: linesFull,
                isFullWidth: true,
                boxW: fullRowW,
              },
            ],
            rowH,
          });
        } else {
          const rowH = Math.max(minH, linesHalf.length * subFieldLineH + 20);
          subFieldRows.push({
            cells: [
              {
                field: f1,
                lines: linesHalf,
                isFullWidth: false,
                boxW: halfColW,
              },
            ],
            rowH,
          });
        }
        idx += 1;
      }
    }

    const totalRowsH = subFieldRows.reduce((sum, r) => sum + r.rowH, 0);
    const totalGapsH = Math.max(0, subFieldRows.length - 1) * 12;
    bodyContentH = Math.max(62, totalRowsH + totalGapsH + 24);
  }

  if (templateStyle === 'waves') {
    const tabOverlap = Math.min(28, Math.round(tabH * 0.6));
    const boxOffsetTop = tabH - tabOverlap;
    const boxH = bodyContentH + 26;
    const totalSectionAdvanceY = boxOffsetTop + boxH + 16;
    return {
      tabTitleLayout,
      tabW,
      tabH,
      bodyContentH,
      wrappedParagraphLines,
      wrappedListItems,
      subFieldRows,
      attendanceTableRows,
      totalSectionAdvanceY,
    };
  }

  const boxH = tabH + bodyContentH + 6;
  const totalSectionAdvanceY = boxH + 14;
  return {
    tabTitleLayout,
    tabW,
    tabH,
    bodyContentH,
    wrappedParagraphLines,
    wrappedListItems,
    subFieldRows,
    attendanceTableRows,
    totalSectionAdvanceY,
  };
}

/**
 * Pure height measurement for a content section card (used by the paginator).
 */
export function measureReferenceTemplateSectionHeight(
  ctx: CanvasRenderingContext2D | null,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  section: TeacherReportContentSection
): number {
  return computeSectionMeasurementPlan(
    ctx,
    contentW,
    templateStyle,
    section
  ).totalSectionAdvanceY;
}

/**
 * Draws a single Content Section card according to the active reference template
 * with dynamic-height field boxes and dynamic section tab sizing.
 */
export function drawReferenceTemplateSection(
  ctx: CanvasRenderingContext2D,
  cursorY: number,
  pageW: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  palette: TeacherColorPalette,
  section: TeacherReportContentSection,
  sectionIndex: number
): number {
  ctx.save();

  const iconKind = resolveIconForLabel(section.title, sectionIndex);
  const lineH = 34;
  const subFieldLineH = 26;
  const plan = computeSectionMeasurementPlan(
    ctx,
    contentW,
    templateStyle,
    section
  );
  const {
    tabTitleLayout,
    tabW,
    tabH,
    bodyContentH,
    wrappedParagraphLines,
    wrappedListItems,
    subFieldRows,
    attendanceTableRows,
  } = plan;

  const drawAttendanceTable = (startY: number, padX: number) => {
    const tableX = marginX + padX;
    const tableW = contentW - padX * 2;
    const colIndexW = 96;
    const colNameW = Math.round((tableW - colIndexW) * 0.56);
    const colSigW = tableW - colIndexW - colNameW;
    const headerH = 52;
    const nameLineH = 26;
    const totalDataRowsH = attendanceTableRows.reduce(
      (sum, item) => sum + item.rowH,
      0
    );
    const totalTableH = headerH + totalDataRowsH;
    const tableR = 12;

    // RTL Column horizontal boundaries:
    // Column 1 (م.): [col1LeftX, tableRightX]
    // Column 2 (الاسم): [col2LeftX, col1LeftX]
    // Column 3 (التوقيع): [tableX, col2LeftX]
    const tableRightX = tableX + tableW;
    const col1LeftX = tableRightX - colIndexW;
    const col2LeftX = col1LeftX - colNameW;

    ctx.save();
    drawRoundedRectPath(
      ctx,
      tableX,
      startY,
      tableW,
      totalTableH,
      tableR,
      '#FFFFFF'
    );
    ctx.clip();

    // Header row shaded background
    ctx.fillStyle = palette.headerBgHex;
    ctx.fillRect(tableX, startY, tableW, headerH);

    // Header labels (RTL: م. | الاسم | التوقيع)
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.secondaryHex;
    ctx.font = 'bold 19px "Tajawal", sans-serif';

    ctx.textAlign = 'center';
    ctx.fillText('م.', col1LeftX + colIndexW / 2, startY + headerH / 2 + 1);
    ctx.fillText('الاسم', col2LeftX + colNameW / 2, startY + headerH / 2 + 1);
    ctx.fillText('التوقيع', tableX + colSigW / 2, startY + headerH / 2 + 1);

    // Horizontal line below header
    ctx.strokeStyle = palette.borderHex;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(tableX, startY + headerH);
    ctx.lineTo(tableRightX, startY + headerH);
    ctx.stroke();

    // Draw each participant row
    let rowY = startY + headerH;
    attendanceTableRows.forEach((item, rIdx) => {
      // Subtle alternating row tint
      if (rIdx % 2 === 1) {
        ctx.fillStyle = '#FAFCFD';
        ctx.fillRect(tableX, rowY, tableW, item.rowH);
      }

      if (rIdx > 0) {
        ctx.strokeStyle = palette.borderHex;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tableX, rowY);
        ctx.lineTo(tableRightX, rowY);
        ctx.stroke();
      }

      const rowMidY = rowY + item.rowH / 2;

      // 1. Column م. (automatic sequential number)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.secondaryHex;
      ctx.font = 'bold 18px "Tajawal", sans-serif';
      ctx.fillText(
        String(item.row.index),
        col1LeftX + colIndexW / 2,
        rowMidY + 1
      );

      // 2. Column الاسم (pure name only, right-aligned inside the Name cell)
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 18.5px "Tajawal", sans-serif';

      const totalNameH = item.nameLines.length * nameLineH;
      let lineCenterY =
        rowY + (item.rowH - totalNameH) / 2 + nameLineH / 2 + 1;
      for (const ln of item.nameLines) {
        ctx.fillText(ln, col1LeftX - 20, lineCenterY);
        lineCenterY += nameLineH;
      }

      // 3. Column التوقيع is intentionally left completely empty for signing with a pen after printing

      rowY += item.rowH;
    });

    // Vertical column dividers (separating م. | الاسم | التوقيع)
    ctx.strokeStyle = palette.borderHex;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(col1LeftX, startY);
    ctx.lineTo(col1LeftX, startY + totalTableH);
    ctx.moveTo(col2LeftX, startY);
    ctx.lineTo(col2LeftX, startY + totalTableH);
    ctx.stroke();

    ctx.restore();

    // Crisp outer rounded border for the table
    drawRoundedRectPath(
      ctx,
      tableX,
      startY,
      tableW,
      totalTableH,
      tableR,
      undefined,
      palette.borderHex,
      2
    );
  };

  const drawSubFieldRows = (
    startY: number,
    padX: number,
    boxBgHex: string
  ) => {
    const subGap = 20;
    let rowY = startY;

    for (const row of subFieldRows) {
      row.cells.forEach((cell, cIdx) => {
        const sx = cell.isFullWidth
          ? marginX + padX
          : cIdx === 0
            ? marginX + padX + cell.boxW + subGap // Right column in RTL
            : marginX + padX; // Left column in RTL

        const isSigSpace = Boolean(cell.field.isSignatureSpace);

        drawRoundedRectPath(
          ctx,
          sx,
          rowY,
          cell.boxW,
          row.rowH,
          10,
          isSigSpace ? '#FFFFFF' : boxBgHex,
          palette.borderHex,
          isSigSpace ? 1.5 : 1.2
        );

        ctx.textBaseline = 'middle';
        ctx.fillStyle = palette.secondaryHex;
        ctx.font = 'bold 18px "Tajawal", sans-serif';

        const totalLinesH = cell.lines.length * subFieldLineH;
        let lineCenterY =
          rowY + (row.rowH - totalLinesH) / 2 + subFieldLineH / 2 + 1;

        if (isSigSpace) {
          ctx.textAlign = 'right';
          for (const ln of cell.lines) {
            ctx.fillText(ln, sx + cell.boxW - 22, lineCenterY);
            lineCenterY += subFieldLineH;
          }
        } else {
          ctx.textAlign = 'center';
          for (const ln of cell.lines) {
            ctx.fillText(ln, sx + cell.boxW / 2, lineCenterY);
            lineCenterY += subFieldLineH;
          }
        }
      });

      rowY += row.rowH + 12;
    }
  };

  if (templateStyle === 'waves') {
    const tabOverlap = Math.min(28, Math.round(tabH * 0.6));
    const boxY = cursorY + (tabH - tabOverlap);
    const boxH = bodyContentH + 26;
    const tabX = pageW - marginX - tabW;
    const tabY = cursorY;

    const tabColors = [
      palette.primaryHex,
      palette.secondaryHex,
      palette.midToneHex,
    ];
    const tabFill = tabColors[sectionIndex % tabColors.length];

    // Main white rounded box
    drawRoundedRectPath(
      ctx,
      marginX,
      boxY,
      contentW,
      boxH,
      14,
      '#FFFFFF',
      palette.borderHex,
      2
    );

    // Floating top-right rounded tab
    drawRoundedRectPath(ctx, tabX, tabY, tabW, tabH, 13, tabFill);

    // Icon on right inside tab + white title
    drawTeacherVectorIcon(
      ctx,
      iconKind,
      tabX + tabW - 28,
      tabY + tabH / 2,
      25,
      '#FFFFFF'
    );

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${tabTitleLayout.fontSize}px "Tajawal", sans-serif`;

    const totalTabTitleH =
      tabTitleLayout.lines.length * tabTitleLayout.lineHeight;
    let tabLineY =
      tabY + (tabH - totalTabTitleH) / 2 + tabTitleLayout.lineHeight / 2 + 1;
    for (const ln of tabTitleLayout.lines) {
      ctx.fillText(ln, tabX + tabW - 54, tabLineY);
      tabLineY += tabTitleLayout.lineHeight;
    }

    // Render body content inside box
    const contentStartY = boxY + 34;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1c1917';
    ctx.font = '600 19px "Tajawal", sans-serif';

    if (section.type === 'text') {
      wrappedParagraphLines.forEach((ln, idx) => {
        ctx.fillText(
          ln,
          pageW - marginX - 28,
          contentStartY + idx * lineH
        );
      });
    } else if (section.type === 'list') {
      let itemY = contentStartY;
      wrappedListItems.forEach((lines) => {
        drawTeacherVectorIcon(
          ctx,
          'check',
          pageW - marginX - 30,
          itemY + 14,
          20,
          palette.primaryHex
        );
        lines.forEach((ln) => {
          ctx.fillText(ln, pageW - marginX - 52, itemY);
          itemY += lineH;
        });
        itemY += 4;
      });
    } else if (section.type === 'attendance-table') {
      drawAttendanceTable(contentStartY, 28);
    } else if (section.type === 'fields' && section.fields) {
      drawSubFieldRows(contentStartY, 28, palette.headerBgHex);
    }

    ctx.restore();
    return boxY + boxH + 16;
  }

  // =========================================================================
  // TEMPLATE 2 (`waves-2` / قالب 2) & TEMPLATE 3 (`geometric` / قالب 3)
  // =========================================================================
  const boxH = tabH + bodyContentH + 6;
  const boxY = cursorY;
  const r = templateStyle === 'waves-2' ? 16 : 12;

  drawRoundedRectPath(
    ctx,
    marginX,
    boxY,
    contentW,
    boxH,
    r,
    palette.cardBgHex,
    palette.borderHex,
    1.6
  );

  const tabRightX = pageW - marginX;
  const tabLeftX = tabRightX - tabW;

  ctx.save();
  drawRoundedRectPath(ctx, marginX, boxY, contentW, boxH, r);
  ctx.clip();

  if (templateStyle === 'waves-2') {
    ctx.fillStyle = palette.softToneHex;
    ctx.beginPath();
    ctx.moveTo(tabRightX, boxY);
    ctx.lineTo(tabLeftX - 18, boxY);
    ctx.bezierCurveTo(
      tabLeftX - 4,
      boxY + tabH * 0.15,
      tabLeftX - 24,
      boxY + tabH * 0.85,
      tabLeftX + 10,
      boxY + tabH
    );
    ctx.lineTo(tabRightX, boxY + tabH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.primaryHex;
    ctx.beginPath();
    ctx.moveTo(tabRightX, boxY);
    ctx.lineTo(tabLeftX, boxY);
    ctx.bezierCurveTo(
      tabLeftX + 14,
      boxY + tabH * 0.18,
      tabLeftX - 10,
      boxY + tabH * 0.82,
      tabLeftX + 24,
      boxY + tabH
    );
    ctx.lineTo(tabRightX, boxY + tabH);
    ctx.closePath();
    ctx.fill();
  } else {
    const tabFill =
      sectionIndex % 2 === 0 ? palette.secondaryHex : palette.primaryHex;
    ctx.fillStyle = tabFill;
    ctx.beginPath();
    ctx.moveTo(tabRightX, boxY);
    ctx.lineTo(tabLeftX + 24, boxY);
    ctx.lineTo(tabLeftX, boxY + tabH);
    ctx.lineTo(tabRightX, boxY + tabH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Icon & Title inside the top-right tab
  drawTeacherVectorIcon(
    ctx,
    iconKind,
    tabRightX - 28,
    boxY + tabH / 2,
    24,
    '#FFFFFF'
  );

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${tabTitleLayout.fontSize}px "Tajawal", sans-serif`;

  const totalTabTitleH =
    tabTitleLayout.lines.length * tabTitleLayout.lineHeight;
  let tabLineY =
    boxY + (tabH - totalTabTitleH) / 2 + tabTitleLayout.lineHeight / 2 + 1;
  for (const ln of tabTitleLayout.lines) {
    ctx.fillText(ln, tabRightX - 52, tabLineY);
    tabLineY += tabTitleLayout.lineHeight;
  }

  // Content inside card below the tab
  const contentStartY = boxY + tabH + 10;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1c1917';
  ctx.font = '600 19px "Tajawal", sans-serif';

  if (section.type === 'text') {
    wrappedParagraphLines.forEach((ln, idx) => {
      ctx.fillText(ln, pageW - marginX - 24, contentStartY + idx * lineH);
    });
  } else if (section.type === 'list') {
    let itemY = contentStartY;
    wrappedListItems.forEach((lines) => {
      drawTeacherVectorIcon(
        ctx,
        'check',
        pageW - marginX - 28,
        itemY + 14,
        21,
        palette.primaryHex
      );
      lines.forEach((ln) => {
        ctx.fillText(ln, pageW - marginX - 50, itemY);
        itemY += lineH;
      });
      itemY += 4;
    });
  } else if (section.type === 'attendance-table') {
    drawAttendanceTable(contentStartY, 24);
  } else if (section.type === 'fields' && section.fields) {
    drawSubFieldRows(contentStartY, 24, '#FFFFFF');
  }

  ctx.restore();
  return boxY + boxH + 14;
}

/**
 * Pure height measurement for the `الشواهد` block (used by the paginator).
 */
export function measureReferenceTemplateEvidenceHeight(
  photosCount: number,
  linksCount: number
): number {
  const hasPhotos = photosCount > 0;
  const hasLinks = linksCount > 0;
  if (!hasPhotos && !hasLinks) return 0;
  if (hasPhotos && hasLinks) return 386;
  if (hasPhotos) return 260;
  return 172;
}

/**
 * Draws the `«الشواهد»` section with completely independent Photos (`0..2`) and Slim QR Link Rectangles (`0..2`).
 */
export function drawReferenceTemplateEvidenceAndLinks(
  ctx: CanvasRenderingContext2D,
  cursorY: number,
  pageW: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  palette: TeacherColorPalette,
  photos: TeacherReportEvidencePhoto[],
  links: TeacherReportEvidenceLink[],
  evidenceImagesMap: Map<string, HTMLImageElement | null>,
  pageLinks: PdfLinkAnnotation[]
): number {
  const validPhotos = (photos || [])
    .filter((p) => Boolean(p && p.imageDataUrl && p.imageDataUrl.trim()))
    .slice(0, 2);
  const validLinks = (links || [])
    .filter((l) => Boolean(l && l.url && l.url.trim()))
    .slice(0, 2);

  if (validPhotos.length === 0 && validLinks.length === 0) {
    return cursorY;
  }

  ctx.save();
  let y = cursorY;

  const tabW = 290;
  const tabH = 42;
  const tabX = (pageW - tabW) / 2;

  const drawEvidenceHeaderTab = (topY: number) => {
    drawRoundedRectPath(ctx, tabX, topY, tabW, tabH, 12, palette.secondaryHex);

    const badgeIcon: TeacherIconKind =
      templateStyle === 'waves-2'
        ? 'star'
        : validPhotos.length > 0
          ? 'camera'
          : 'link';
    drawTeacherVectorIcon(
      ctx,
      badgeIcon,
      pageW / 2 + 52,
      topY + tabH / 2,
      24,
      '#FFFFFF'
    );

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "Tajawal", sans-serif';
    ctx.fillText('الشواهد', pageW / 2 - 14, topY + tabH / 2 + 1);
  };

  // 1. Independent Photos Container (rendered ONLY when validPhotos.length > 0)
  if (validPhotos.length > 0) {
    const evBoxY = y + 18;
    const photoH = 184;
    const evBoxH = photoH + 46;

    drawRoundedRectPath(
      ctx,
      marginX,
      evBoxY,
      contentW,
      evBoxH,
      16,
      templateStyle === 'waves' ? '#FFFFFF' : palette.cardBgHex,
      palette.borderHex,
      1.8
    );

    drawEvidenceHeaderTab(y);

    const innerPadX = 22;
    const gap = 22;
    const isSinglePhoto = validPhotos.length === 1;
    const frameW = isSinglePhoto
      ? Math.min(contentW - innerPadX * 2, 660)
      : (contentW - innerPadX * 2 - gap) / 2;
    const frameY = evBoxY + 32;

    validPhotos.forEach((photo, idx) => {
      const frameX = isSinglePhoto
        ? marginX + (contentW - frameW) / 2
        : idx === 0
          ? marginX + innerPadX + frameW + gap
          : marginX + innerPadX;

      drawRoundedRectPath(
        ctx,
        frameX,
        frameY,
        frameW,
        photoH,
        12,
        '#FFFFFF',
        palette.borderHex,
        1.5
      );

      const imgEl = evidenceImagesMap.get(photo.id) ?? null;
      if (imgEl && imgEl.width > 0 && imgEl.height > 0) {
        const innerX = frameX + 4;
        const innerY = frameY + 4;
        const innerW = frameW - 8;
        const innerH = photoH - 8;

        ctx.save();
        drawRoundedRectPath(
          ctx,
          innerX,
          innerY,
          innerW,
          innerH,
          9,
          palette.titleBgHex
        );
        ctx.clip();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const imgAspect = imgEl.width / imgEl.height;
        const frameAspect = innerW / innerH;
        const aspectDiffRatio =
          Math.abs(imgAspect - frameAspect) / frameAspect;

        const scale =
          aspectDiffRatio <= 0.45
            ? Math.max(innerW / imgEl.width, innerH / imgEl.height)
            : Math.min(innerW / imgEl.width, innerH / imgEl.height);

        const drawW = imgEl.width * scale;
        const drawH = imgEl.height * scale;
        ctx.drawImage(
          imgEl,
          innerX + (innerW - drawW) / 2,
          innerY + (innerH - drawH) / 2,
          drawW,
          drawH
        );
        ctx.restore();
      }
    });

    y = evBoxY + evBoxH + 12;
  }

  // 2. Independent Slim QR Links Rectangles (rendered ONLY when validLinks.length > 0)
  if (validLinks.length > 0) {
    const needsSectionTab = validPhotos.length === 0;
    const linksTopY = needsSectionTab ? y + 18 : y;
    const slimCardH = 112;
    const outerWrapH = needsSectionTab ? slimCardH + 44 : slimCardH;

    if (needsSectionTab) {
      drawRoundedRectPath(
        ctx,
        marginX,
        linksTopY,
        contentW,
        outerWrapH,
        16,
        templateStyle === 'waves' ? '#FFFFFF' : palette.cardBgHex,
        palette.borderHex,
        1.8
      );
      drawEvidenceHeaderTab(y);
    }

    const rowY = needsSectionTab ? linksTopY + 30 : linksTopY;
    const innerPad = needsSectionTab ? 22 : 0;
    const availW = contentW - innerPad * 2;
    const gap = 20;
    const isSingleLink = validLinks.length === 1;
    const rectW = isSingleLink
      ? Math.min(availW, 560)
      : (availW - gap) / 2;

    validLinks.forEach((linkItem, lIdx) => {
      const cleanUrl = linkItem.url.trim();
      const rectX = isSingleLink
        ? marginX + (contentW - rectW) / 2
        : lIdx === 0
          ? marginX + innerPad + rectW + gap
          : marginX + innerPad;

      drawRoundedRectPath(
        ctx,
        rectX,
        rowY,
        rectW,
        slimCardH,
        14,
        needsSectionTab ? '#FFFFFF' : palette.cardBgHex,
        palette.borderHex,
        1.6
      );

      const qrSize = 86;
      const qrBoxSize = qrSize + 12;
      const qrSquareX = rectX + 18;
      const qrSquareY = rowY + (slimCardH - qrBoxSize) / 2;

      drawRoundedRectPath(
        ctx,
        qrSquareX,
        qrSquareY,
        qrBoxSize,
        qrBoxSize,
        10,
        '#FFFFFF',
        palette.borderHex,
        1.4
      );

      drawQrCodeOnCanvas(
        ctx,
        cleanUrl,
        qrSquareX + 6,
        qrSquareY + 6,
        qrSize,
        palette.secondaryHex,
        '#FFFFFF',
        2
      );

      pageLinks.push({
        xPx: qrSquareX,
        yPx: qrSquareY,
        wPx: qrBoxSize,
        hPx: qrBoxSize,
        url: cleanUrl,
      });

      const rightAreaStartX = qrSquareX + qrBoxSize + 16;
      const rightAreaW = rectX + rectW - 18 - rightAreaStartX;
      const textCenterX = rightAreaStartX + rightAreaW / 2;

      const badgeX = rectX + rectW - 36;
      const badgeY = rowY + slimCardH / 2;
      ctx.fillStyle = palette.headerBgHex;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 18, 0, Math.PI * 2);
      ctx.fill();
      drawTeacherVectorIcon(
        ctx,
        'link',
        badgeX,
        badgeY,
        20,
        palette.primaryHex
      );

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.secondaryHex;
      ctx.font = 'bold 19px "Tajawal", sans-serif';
      ctx.fillText(
        'امسح الرمز للوصول إلى الرابط',
        textCenterX - 14,
        rowY + slimCardH / 2 + 1
      );
    });

    y = linksTopY + outerWrapH + 14;
  }

  ctx.restore();
  return y;
}

/**
 * Draws the Last-Page Sign-Off (`منفذ التقرير` / `السجل المدني` / `التوقيع` + `مدير المدرسة`)
 * matching the exact footer style of the active reference template.
 */
export function drawReferenceTemplateSignoff(
  ctx: CanvasRenderingContext2D,
  cursorY: number,
  pageW: number,
  pageH: number,
  marginX: number,
  contentW: number,
  templateStyle: TeacherPdfTemplateStyle,
  palette: TeacherColorPalette,
  signoff: {
    executorName?: string;
    nationalId?: string;
    signatureDataUrl?: string;
    principalTitle: string;
    principalName: string;
  },
  signatureImg: HTMLImageElement | null
): void {
  ctx.save();

  let y = cursorY;
  const hasExecutorName = Boolean(
    signoff.executorName && signoff.executorName.trim()
  );
  const hasNationalId = Boolean(
    signoff.nationalId && signoff.nationalId.trim()
  );
  const hasSignature = Boolean(
    signoff.signatureDataUrl &&
      signoff.signatureDataUrl.trim() &&
      signatureImg
  );

  if (hasExecutorName || hasNationalId || hasSignature) {
    const execBarH = 54;
    drawRoundedRectPath(
      ctx,
      marginX,
      y,
      contentW,
      execBarH,
      12,
      palette.cardBgHex,
      palette.borderHex,
      1.4
    );

    const activeCount =
      (hasExecutorName ? 1 : 0) +
      (hasNationalId ? 1 : 0) +
      (hasSignature ? 1 : 0);
    const colW = (contentW - 40) / Math.max(1, activeCount);
    let colIdx = 0;
    const midY = y + execBarH / 2;
    ctx.textBaseline = 'middle';

    if (hasExecutorName) {
      const rx = pageW - marginX - 20 - colIdx * colW;
      ctx.textAlign = 'right';
      ctx.fillStyle = palette.secondaryHex;
      ctx.font = 'bold 18px "Tajawal", sans-serif';
      ctx.fillText(`منفذ التقرير: ${signoff.executorName}`, rx, midY);
      colIdx++;
    }

    if (hasNationalId) {
      const rx = pageW - marginX - 20 - colIdx * colW;
      ctx.textAlign = 'right';
      ctx.fillStyle = palette.secondaryHex;
      ctx.font = 'bold 18px "Tajawal", sans-serif';
      ctx.fillText(`السجل المدني: ${signoff.nationalId}`, rx, midY);
      colIdx++;
    }

    if (hasSignature && signatureImg) {
      const rx = pageW - marginX - 20 - colIdx * colW;
      ctx.textAlign = 'right';
      ctx.fillStyle = palette.secondaryHex;
      ctx.font = 'bold 18px "Tajawal", sans-serif';
      ctx.fillText('التوقيع:', rx, midY);
      const labelW = ctx.measureText('التوقيع: ').width + 10;
      const scale = Math.min(130 / signatureImg.width, 42 / signatureImg.height);
      const dw = signatureImg.width * scale;
      const dh = signatureImg.height * scale;
      ctx.drawImage(signatureImg, rx - labelW - dw, midY - dh / 2, dw, dh);
    }

    y += execBarH + 14;
  }

  // Principal single-line footer positioned at the bottom of the last page only.
  // Do NOT render if principalName is empty/unavailable.
  const trimmedPrincipalName = signoff.principalName?.trim() || '';
  if (!trimmedPrincipalName) {
    ctx.restore();
    return;
  }

  const titleLabel = signoff.principalTitle?.trim() || 'مدير المدرسة';
  const fullPrincipalText = `${titleLabel}: ${trimmedPrincipalName}`;

  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.secondaryHex;

  // Scale down gently if principal name is very long so it stays on 1 clean horizontal line
  let principalFontSize = 22;
  ctx.font = `bold ${principalFontSize}px "Tajawal", sans-serif`;
  while (
    principalFontSize > 16 &&
    ctx.measureText(fullPrincipalText).width > contentW * 0.62
  ) {
    principalFontSize -= 1;
    ctx.font = `bold ${principalFontSize}px "Tajawal", sans-serif`;
  }

  if (templateStyle === 'waves') {
    const lineY = Math.max(y + 20, pageH - 142);
    ctx.textAlign = 'left';
    ctx.fillText(fullPrincipalText, marginX + 12, lineY);
  } else {
    const lineY = Math.max(y + 22, pageH - 126);
    ctx.textAlign = 'left';
    ctx.fillText(fullPrincipalText, marginX + 12, lineY);
  }

  ctx.restore();
}
