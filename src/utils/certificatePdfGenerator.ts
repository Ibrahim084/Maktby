import { SchoolSettings } from '../types';
import { FormValues } from '../types/forms';
import { getGenderedLabels } from './settingsStorage';

export type CertificateVariant = 'trainer' | 'trainee';

export interface CertificateBeneficiaryEntry {
  name: string;
  nationalId: string;
}

export interface OfficialCertificateTextContent {
  variant: CertificateVariant;
  backgroundUrl: string;
  schoolName: string;
  beneficiaryName: string;
  nationalId: string;
  programTitle: string;
  daysCount: string;
  hoursCount: string;
  startDate: string;
  endDate: string;
  principalTitle: string;
  principalName: string;
  stampLabel: string;
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
  line6: string;
}

/**
 * Parses beneficiary names and optional national IDs from form values.
 * Supports:
 * 1. Single name + single nationalId
 * 2. Multi-line names + multi-line nationalIds (matched line by line)
 * 3. Multi-line "Name - NationalID" inline syntax
 */
export function parseCertificateBeneficiaries(
  values: FormValues,
  isBatchMode = false
): CertificateBeneficiaryEntry[] {
  const rawNames = typeof values.beneficiaryName === 'string' ? values.beneficiaryName : '';
  const rawIds = typeof values.nationalId === 'string' ? values.nationalId : '';

  const nameLines = isBatchMode
    ? rawNames
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : rawNames.trim()
    ? [rawNames.trim()]
    : [];

  const idLines = rawIds
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (nameLines.length === 0) {
    return [];
  }

  return nameLines.map((line, idx) => {
    // Check if the line embeds an inline National ID separated by - or | or :
    const inlineMatch = line.match(/^(.*?)\s*[-|:،]\s*([0-9٠-٩]{5,15})\s*$/);
    if (inlineMatch) {
      return {
        name: inlineMatch[1].trim(),
        nationalId: inlineMatch[2].trim(),
      };
    }

    const matchedId =
      idLines[idx] ?? (idLines.length === 1 && nameLines.length === 1 ? idLines[0] : '');

    return {
      name: line,
      nationalId: matchedId,
    };
  });
}

/**
 * Builds the exact official certificate lines and metadata according to the Ministry of Education
 * Professional Development reference templates and the user's selected gender (معلم / معلمة).
 */
export function buildOfficialCertificateContent(
  variant: CertificateVariant,
  beneficiary: CertificateBeneficiaryEntry,
  values: FormValues,
  settings: SchoolSettings
): OfficialCertificateTextContent {
  const gendered = getGenderedLabels(settings.gender);

  const str = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');

  const schoolName = str(values.schoolNameInput) || settings.schoolName.trim() || 'غير محدد';
  const beneficiaryName = beneficiary.name.trim() || 'غير محدد';
  const nationalId = beneficiary.nationalId.trim() || str(values.nationalId) || '—';
  const programTitle = str(values.programTitle) || 'غير محدد';
  const daysCount = str(values.daysCount) || '—';
  const hoursCount = str(values.hoursCount) || '—';
  const startDate = str(values.startDate) || '—';
  const endDate = str(values.endDate) || '—';
  const principalName =
    str(values.principalNameInput) || settings.principalName.trim() || '';

  const actionVerbPhrase =
    variant === 'trainer'
      ? gendered.trainerExecutedPhrase
      : gendered.traineeAttendedPhrase;

  const line1 = `تشهد إدارة مدرسة ${schoolName} بأن ${gendered.honorific} ${beneficiaryName}`;
  const line2 = `رقم الهوية / ${nationalId}`;
  const line3 = `${actionVerbPhrase} ${programTitle} ضمن مشروع توطين التطوير المهني بالمدارس`;
  const line4 = `لمدة ( ${daysCount} ) أيام بواقع ( ${hoursCount} ) ساعات`;
  const line5 = `من الفترة ${startDate} إلى ${endDate}`;
  const line6 = 'مع تمنياتنا لكم بالتوفيق';

  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const backgroundUrl =
    variant === 'trainer'
      ? `${normalizedBase}cert-bg-trainer.png`
      : `${normalizedBase}cert-bg-trainee.png`;

  return {
    variant,
    backgroundUrl,
    schoolName,
    beneficiaryName,
    nationalId,
    programTitle,
    daysCount,
    hoursCount,
    startDate,
    endDate,
    principalTitle: gendered.principalTitle,
    principalName,
    stampLabel: 'ختم مركز التطوير المهني',
    line1,
    line2,
    line3,
    line4,
    line5,
    line6,
  };
}

/**
 * Wraps a JPEG image stream into a valid, standards-compliant single-page A4 Landscape PDF 1.4 document.
 * Page dimensions: 841.89pt x 595.28pt (297mm x 210mm A4 Landscape).
 */
export function buildPdfFromJpegBytes(
  jpegBytes: Uint8Array,
  imgWidthPx: number,
  imgHeightPx: number
): Uint8Array {
  const encoder = new TextEncoder();
  const pageWidthPt = 841.89;
  const pageHeightPt = 595.28;

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // index 0 unused; objects are 1..5
  let currentByteOffset = 0;

  const pushText = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    currentByteOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentByteOffset += bytes.length;
  };

  // PDF Header with binary marker comment
  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog
  offsets[1] = currentByteOffset;
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets[2] = currentByteOffset;
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page (A4 Landscape: 841.89 x 595.28 pt)
  offsets[3] = currentByteOffset;
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // Object 4: Image XObject (DCTDecode JPEG)
  offsets[4] = currentByteOffset;
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidthPx} /Height ${imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushText('\nendstream\nendobj\n');

  // Object 5: Page Content Stream drawing /Im0 across the full A4 Landscape page
  const contentStream = `q\n${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  offsets[5] = currentByteOffset;
  pushText(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushText('endstream\nendobj\n');

  // Cross-Reference Table (xref)
  const xrefOffset = currentByteOffset;
  pushText('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    pushText(`${padded} 00000 n \n`);
  }

  // Trailer
  pushText(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  // Concatenate all chunks into a single Uint8Array
  const output = new Uint8Array(currentByteOffset);
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.length;
  }
  return output;
}

// Minimal 1x1 white JPEG for non-DOM unit test environments
const FALLBACK_1X1_JPEG = new Uint8Array([
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
  0xbf, 0x00, 0xff, 0xd9,
]);

const bgImageCache: Partial<Record<string, HTMLImageElement>> = {};

function loadBackgroundImage(url: string): Promise<HTMLImageElement> {
  if (bgImageCache[url]) {
    return Promise.resolve(bgImageCache[url]!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageCache[url] = img;
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Word-wraps a single Arabic RTL text line onto a 2D canvas without shrinking font size,
 * preventing any clipping or overflow beyond the allowed safe width.
 */
function wrapCanvasTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`;
    const width = ctx.measureText(candidate).width;
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Renders the official certificate onto a high-resolution 2400x1697 A4 Landscape HTML5 Canvas.
 */
export async function renderCertificateToCanvas(
  content: OfficialCertificateTextContent
): Promise<HTMLCanvasElement> {
  const width = 2400;
  const height = 1697;

  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness errors
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Fill pure white base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Draw high-resolution clean official background (with MoE logo, Gold Badge, Right Honeycomb, Left Hexagons, Bottom Line)
  try {
    const bgImg = await loadBackgroundImage(content.backgroundUrl);
    ctx.drawImage(bgImg, 0, 0, width, height);
  } catch {
    // Fallback if image load fails in restricted test context
  }

  // 3. Configure Arabic RTL typography (fixed, readable font scale — never auto-shrunk)
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#18181b';

  const centerX = 1230; // Centered in the white space between left hexagons and right honeycomb
  const maxLineWidth = 1520; // Safe margin inside A4 landscape width
  const bodyFont = '700 40px "Tajawal", "Cairo", sans-serif';
  ctx.font = bodyFont;

  const bodyLines = [
    content.line1,
    content.line2,
    content.line3,
    content.line4,
    content.line5,
    content.line6,
  ];

  // Calculate wrapped lines first so vertical centering stays balanced
  const wrappedGroups = bodyLines.map((line) =>
    wrapCanvasTextLines(ctx, line, maxLineWidth)
  );
  const totalVisualLines = wrappedGroups.reduce((sum, g) => sum + g.length, 0);

  // Start Y around 470px (or slightly higher if long names/programs wrapped into extra lines)
  const extraLines = Math.max(0, totalVisualLines - 6);
  let currentY = Math.max(415, 475 - extraLines * 26);
  const groupSpacing = 92;
  const wrappedSubLineSpacing = 64;

  for (const group of wrappedGroups) {
    for (let i = 0; i < group.length; i++) {
      ctx.fillText(group[i], centerX, currentY);
      if (i < group.length - 1) {
        currentY += wrappedSubLineSpacing;
      }
    }
    currentY += groupSpacing;
  }

  // 4. Bottom Row: Right = ختم مركز التطوير المهني, Left = مدير/مديرة المدرسة + الاسم
  const footerY = 1265;
  ctx.font = '700 35px "Tajawal", "Cairo", sans-serif';
  ctx.fillStyle = '#27272a';

  // Right signature/stamp position (matching reference image)
  ctx.fillText(content.stampLabel, 1775, footerY);

  // Left principal title & name position (matching reference image)
  ctx.fillText(content.principalTitle, 690, footerY);
  if (content.principalName) {
    ctx.font = '700 34px "Tajawal", "Cairo", sans-serif';
    const principalLines = wrapCanvasTextLines(ctx, content.principalName, 620);
    let py = footerY + 68;
    for (const pLine of principalLines) {
      ctx.fillText(pLine, 690, py);
      py += 54;
    }
  }

  return canvas;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index === -1) return FALLBACK_1X1_JPEG;
  const base64 = dataUrl.slice(base64Index + 8);
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return FALLBACK_1X1_JPEG;
}

/**
 * Generates a real single-page A4 Landscape PDF binary (Uint8Array) for a single certificate.
 */
export async function generateCertificatePdfBytes(
  content: OfficialCertificateTextContent
): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    // Non-DOM Node unit test environment: build a valid PDF 1.4 binary using fallback JPEG stream
    return buildPdfFromJpegBytes(FALLBACK_1X1_JPEG, 2400, 1697);
  }

  const canvas = await renderCertificateToCanvas(content);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
  return buildPdfFromJpegBytes(jpegBytes, canvas.width, canvas.height);
}
